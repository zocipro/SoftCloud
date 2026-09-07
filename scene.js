import * as THREE from './vendor/three.module.min.js';
import logoContours from './assets/logo-shapes.js';

const host = document.getElementById('hero-visual');
const canvas = document.getElementById('sculpture');
const interaction = document.getElementById('rotation-surface');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export function createSculpture(setState) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
    camera.position.set(0, 0, 9.2);

    // Studio softboxes give the metal real reflections without downloading an HDR map.
    function createEnvironment() {
        const studio = new THREE.Scene();
        studio.background = new THREE.Color(0xb9d3e4);
        const softboxes = [
            { position: [-3, 3, 2], size: [3, 6], color: 0xffffff, intensity: 6 },
            { position: [4, 1, 1], size: [2, 5], color: 0xc6edff, intensity: 4 },
            { position: [0, 5, -2], size: [5, 2], color: 0xffffff, intensity: 5 },
            { position: [-1, -4, 2], size: [4, 1], color: 0x86bfdc, intensity: 2 },
        ];
        softboxes.forEach(({ position, size, color, intensity }) => {
            const panel = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
            panel.position.set(...position);
            panel.lookAt(0, 0, 0);
            studio.add(panel);
        });
        const pmrem = new THREE.PMREMGenerator(renderer);
        const map = pmrem.fromScene(studio, 0.08);
        studio.traverse((object) => {
            if (!object.isMesh) return;
            object.geometry.dispose();
            object.material.dispose();
        });
        pmrem.dispose();
        return map;
    }
    let environment = createEnvironment();
    scene.environment = environment.texture;

    const sculpture = new THREE.Group();
    const material = new THREE.MeshPhysicalMaterial({
        color: 0x258daf, metalness: 0.22, roughness: 0.26,
        clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: 0.85,
    });
    const overlayMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xf8fcff, metalness: 0.04, roughness: 0.2,
        clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1,
    });
    // Both contours are traced from ruanyun.png, including its distinctive white overlay.
    function extrudeLogo(points, depth, bevel, surface, z) {
        const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
        const shape = new THREE.Shape(curve.getPoints(320).map(({ x, y }) => new THREE.Vector2(x, y)));
        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth, steps: 1, bevelEnabled: true, bevelThickness: bevel,
            bevelSize: bevel * 0.65, bevelSegments: 6,
        });
        const mesh = new THREE.Mesh(geometry, surface);
        mesh.position.z = z;
        return mesh;
    }
    sculpture.add(extrudeLogo(logoContours.body, 0.42, 0.10, material, -0.25));
    sculpture.add(extrudeLogo(logoContours.overlay, 0.12, 0.065, overlayMaterial, 0.22));
    const homeRotation = { x: -0.12, y: -0.38 };
    const rotationCenter = { ...homeRotation };
    const targetCenter = { ...homeRotation };
    const velocity = { x: 0, y: 0 };
    const rotationLimits = { x: THREE.MathUtils.degToRad(22), y: THREE.MathUtils.degToRad(50) };
    const sway = { x: THREE.MathUtils.degToRad(2), y: THREE.MathUtils.degToRad(8) };
    scene.add(sculpture);
    scene.add(new THREE.HemisphereLight(0xf2faff, 0x517d9a, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(-3, 4, 5);
    scene.add(key);

    let frame = 0;
    let revealFrame = 0;
    let lastTime = 0;
    let phase = 0;
    let visible = true;
    let contextLost = false;
    let failed = false;
    let revealed = false;
    let drag = null;
    const friction = 7.5;
    const response = 22;
    const canAnimate = () => !reducedMotion.matches && visible && !document.hidden && !contextLost && !failed;
    const clampCenter = (value, axis) => THREE.MathUtils.clamp(value, -rotationLimits[axis] + sway[axis], rotationLimits[axis] - sway[axis]);
    function stopMomentum() {
        velocity.x = velocity.y = 0;
        Object.assign(targetCenter, rotationCenter);
    }
    function failScene(error) {
        failed = true;
        finishDrag();
        stopMomentum();
        cancelAnimationFrame(frame);
        cancelAnimationFrame(revealFrame);
        frame = revealFrame = 0;
        setState('unavailable');
        console.warn('3D visual unavailable; static view retained.', error);
    }
    const render = () => {
        if (contextLost || failed) return;
        // Every input shares absolute limits, so the logo's front always faces the camera.
        sculpture.rotation.set(
            THREE.MathUtils.clamp(rotationCenter.x + Math.sin(phase * 0.42) * sway.x, -rotationLimits.x, rotationLimits.x),
            THREE.MathUtils.clamp(rotationCenter.y + Math.sin(phase * 0.3) * sway.y, -rotationLimits.y, rotationLimits.y),
            -0.06 + Math.sin(phase * 0.24) * 0.025,
            'YXZ',
        );
        sculpture.position.y = Math.sin(phase * 0.7) * 0.07;
        try { renderer.render(scene, camera); } catch (error) { failScene(error); return; }
        if (!revealed && !revealFrame) {
            // Reveal only after a real frame has been drawn; the original image is error-only.
            revealFrame = requestAnimationFrame(() => {
                revealFrame = 0;
                if (contextLost || failed) return;
                revealed = true;
                setState('ready');
            });
        }
    };
    function advanceMotion(delta) {
        const decay = Math.exp(-friction * delta);
        const follow = Math.exp(-response * delta);
        for (const axis of ['x', 'y']) {
            const oldTarget = targetCenter[axis];
            const speed = drag ? 0 : velocity[axis];
            const nextTarget = oldTarget + speed * (1 - decay) / friction;
            targetCenter[axis] = clampCenter(nextTarget, axis);
            if (targetCenter[axis] !== nextTarget) {
                velocity[axis] = 0;
                rotationCenter[axis] = THREE.MathUtils.damp(rotationCenter[axis], targetCenter[axis], response, delta);
            } else {
                // Exact damped follow of an exponentially slowing target, independent of refresh rate.
                rotationCenter[axis] = targetCenter[axis] + (rotationCenter[axis] - oldTarget) * follow
                    - speed * (decay - follow) / (response - friction);
                velocity[axis] = Math.abs(speed * decay) < 0.001 ? 0 : speed * decay;
            }
            rotationCenter[axis] = clampCenter(rotationCenter[axis], axis);
        }
    }
    function animate(time) {
        frame = 0;
        if (!canAnimate()) return;
        const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
        lastTime = time;
        phase += delta;
        advanceMotion(delta);
        render();
        if (canAnimate()) frame = requestAnimationFrame(animate);
    }
    const syncAnimation = () => {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
        if (canAnimate()) frame = requestAnimationFrame(animate);
        else if (visible && !document.hidden) render();
    };
    const resize = () => {
        const { width, height } = host.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.position.z = camera.aspect < 0.9 ? 10.8 : 9.2;
        camera.updateProjectionMatrix();
        render();
    };
    new ResizeObserver(resize).observe(host);
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) { finishDrag(); stopMomentum(); }
        syncAnimation();
    }, { threshold: 0 }).observe(host);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { finishDrag(); stopMomentum(); }
        syncAnimation();
    });
    function finishDrag(event) {
        if (!drag || (event && event.pointerId !== drag.pointerId)) return;
        const { pointerId } = drag;
        const release = event?.type === 'pointerup';
        if (release && drag.started && !reducedMotion.matches && event.timeStamp - drag.time < 90) {
            velocity.x = drag.vx;
            velocity.y = drag.vy;
        } else if (release) {
            velocity.x = velocity.y = 0;
        } else stopMomentum();
        drag = null;
        interaction.classList.remove('is-dragging');
        if (interaction.hasPointerCapture(pointerId)) interaction.releasePointerCapture(pointerId);
    }
    function moveTarget(x, y) {
        targetCenter.y = clampCenter(targetCenter.y + x, 'y');
        targetCenter.x = clampCenter(targetCenter.x + y, 'x');
        if (reducedMotion.matches) {
            Object.assign(rotationCenter, targetCenter);
            render();
        }
    }
    interaction.addEventListener('pointerdown', (event) => {
        if (!event.isPrimary || event.button !== 0 || drag || contextLost || failed || !revealed) return;
        stopMomentum();
        drag = { pointerId: event.pointerId, type: event.pointerType, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, time: event.timeStamp, vx: 0, vy: 0, started: false };
        interaction.setPointerCapture(event.pointerId);
        interaction.classList.add('is-dragging');
    });
    interaction.addEventListener('pointermove', (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        if (drag.type === 'mouse' && !(event.buttons & 1)) { finishDrag(event); return; }
        if (!drag.started) {
            if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 4) return;
            drag.started = true;
        }
        const scale = Math.PI / Math.max(canvas.getBoundingClientRect().width, 1);
        const dx = (event.clientX - drag.x) * scale, dy = (event.clientY - drag.y) * scale;
        const previous = { ...targetCenter };
        moveTarget(dx, dy);
        const delta = Math.max((event.timeStamp - drag.time) / 1000, 1 / 240);
        for (const [axis, movement, speedKey] of [['x', dy, 'vx'], ['y', dx, 'vy']]) {
            const actual = targetCenter[axis] - previous[axis];
            const speed = THREE.MathUtils.clamp(actual / delta, -1.8, 1.8);
            if (Math.abs(actual - movement) > 1e-8) drag[speedKey] = 0;
            else if (delta > 0.12 || drag[speedKey] * speed < 0) drag[speedKey] = speed;
            else drag[speedKey] = THREE.MathUtils.damp(drag[speedKey], speed, 30, delta);
        }
        drag.x = event.clientX;
        drag.y = event.clientY;
        drag.time = event.timeStamp;
    }, { passive: true });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((event) => interaction.addEventListener(event, finishDrag));
    interaction.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('blur', () => { finishDrag(); stopMomentum(); });
    canvas.addEventListener('keydown', (event) => {
        if (contextLost || failed || event.altKey || event.ctrlKey || event.metaKey) return;
        const step = Math.PI / 18;
        const directions = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        if (!directions[event.key] && event.key !== 'Home') return;
        event.preventDefault();
        finishDrag();
        velocity.x = velocity.y = 0;
        if (event.key === 'Home') {
            Object.assign(targetCenter, homeRotation);
            if (reducedMotion.matches) { Object.assign(rotationCenter, targetCenter); render(); }
        } else moveTarget(...directions[event.key]);
    });
    reducedMotion.addEventListener('change', () => {
        finishDrag();
        stopMomentum();
        syncAnimation();
    });
    const syncTheme = () => {
        const light = document.documentElement.dataset.theme === 'light';
        material.color.set(light ? 0x258daf : 0x41aacf);
        render();
    };
    new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        contextLost = true;
        revealed = false;
        finishDrag();
        stopMomentum();
        cancelAnimationFrame(revealFrame);
        revealFrame = 0;
        setState('loading');
        syncAnimation();
    });
    canvas.addEventListener('webglcontextrestored', () => {
        try {
            contextLost = false;
            environment.dispose();
            environment = createEnvironment();
            scene.environment = environment.texture;
            resize();
            syncAnimation();
        } catch (error) { failScene(error); }
    });
    resize();
    syncTheme();
    syncAnimation();
}
