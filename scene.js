import * as THREE from './vendor/three.module.min.js';
import logoContours from './assets/logo-shapes.js';
import { createLogoMotion } from './assets/logo-motion.js';

const host = document.getElementById('hero-visual');
const canvas = document.getElementById('sculpture');
const interaction = document.getElementById('rotation-surface');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export function createSculpture(setState) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.95;
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
        color: 0xffffff, vertexColors: true, metalness: 0.12, roughness: 0.3,
        clearcoat: 1, clearcoatRoughness: 0.16, envMapIntensity: 0.5,
    });
    const overlayMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xf8fcff, metalness: 0.04, roughness: 0.2,
        clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1,
    });
    // The body carries the original mark's teal crown, ocean base and cyan flank.
    const palette = { ocean: new THREE.Color(0x1d74a8), teal: new THREE.Color(0x0fae9e), cyan: new THREE.Color(0x2fa9d2) };
    function paintGradient(geometry) {
        const position = geometry.attributes.position;
        const colors = new Float32Array(position.count * 3);
        const color = new THREE.Color();
        for (let i = 0; i < position.count; i++) {
            const x = position.getX(i), y = position.getY(i);
            const flank = THREE.MathUtils.clamp((x + 0.3) / 2.2, 0, 1) * THREE.MathUtils.clamp((0.5 - y) / 1.5, 0, 1);
            const crown = THREE.MathUtils.smoothstep(y - 0.18 * x, -0.7, 1.0);
            color.copy(palette.ocean).lerp(palette.cyan, flank).lerp(palette.teal, crown);
            color.toArray(colors, i * 3);
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    // Both contours are traced from ruanyun.png, including its distinctive white overlay.
    function extrudeLogo(points, depth, bevel, surface, z) {
        const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
        const shape = new THREE.Shape(curve.getPoints(320).map(({ x, y }) => new THREE.Vector2(x, y)));
        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth, steps: 1, bevelEnabled: true, bevelThickness: bevel,
            bevelSize: bevel * 0.65, bevelSegments: 6,
        });
        if (surface.vertexColors) paintGradient(geometry);
        const mesh = new THREE.Mesh(geometry, surface);
        mesh.position.z = z;
        return mesh;
    }
    sculpture.add(extrudeLogo(logoContours.body, 0.42, 0.10, material, -0.25));
    sculpture.add(extrudeLogo(logoContours.overlay, 0.12, 0.065, overlayMaterial, 0.22));
    // A soft pool of light under the cloud, echoing the shadow in the original artwork.
    function createShadowTexture() {
        const size = 256;
        const paint = document.createElement('canvas');
        paint.width = paint.height = size;
        const context = paint.getContext('2d');
        const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.45, 'rgba(255,255,255,.45)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);
        const texture = new THREE.CanvasTexture(paint);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }
    const shadowMaterial = new THREE.MeshBasicMaterial({ map: createShadowTexture(), color: 0x3ea7d6, transparent: true, opacity: 0.42, depthWrite: false });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMaterial);
    shadow.position.set(0, -1.95, -0.6);
    shadow.scale.set(4.2, 0.42, 1);
    scene.add(shadow);
    const motion = createLogoMotion(reducedMotion.matches);
    scene.add(sculpture);
    scene.add(new THREE.HemisphereLight(0xf2faff, 0x517d9a, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(-3, 4, 5);
    scene.add(key);

    let shadowBase = 0.42;
    let frame = 0;
    let revealFrame = 0;
    let lastTime = 0;
    let visible = true;
    let contextLost = false;
    let failed = false;
    let revealed = false;
    let drag = null;
    const canAnimate = () => visible && !document.hidden && !contextLost && !failed;
    function failScene(error) {
        failed = true;
        finishDrag();
        motion.cancel();
        cancelAnimationFrame(frame);
        cancelAnimationFrame(revealFrame);
        frame = revealFrame = 0;
        setState('unavailable');
        console.warn('3D visual unavailable; static view retained.', error);
    }
    const render = () => {
        if (contextLost || failed) return;
        const pose = motion.sample();
        sculpture.rotation.set(pose.x, pose.y, pose.z, 'YXZ');
        sculpture.position.set(pose.floatX, pose.floatY, 0);
        const lift = THREE.MathUtils.clamp(pose.floatY * 4, -1, 1);
        shadow.position.x = pose.floatX * 0.8;
        shadow.scale.set(4.2 * (1 - lift * 0.08), 0.42 * (1 - lift * 0.08), 1);
        shadowMaterial.opacity = shadowBase * (1 - lift * 0.25);
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
    function animate(time) {
        frame = 0;
        if (!canAnimate()) return;
        const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
        lastTime = time;
        motion.step(delta);
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
        if (!visible) { finishDrag(); motion.cancel(); }
        syncAnimation();
    }, { threshold: 0 }).observe(host);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { finishDrag(); motion.cancel(); }
        syncAnimation();
    });
    function finishDrag(event) {
        if (!drag || (event && event.pointerId !== drag.pointerId)) return;
        const { pointerId } = drag;
        const release = event?.type === 'pointerup';
        if (release && drag.started && event.timeStamp - drag.time < 110) motion.release(drag.vx, drag.vy);
        else if (release) motion.release(0, 0);
        else motion.cancel();
        drag = null;
        interaction.classList.remove('is-dragging');
        if (interaction.hasPointerCapture(pointerId)) interaction.releasePointerCapture(pointerId);
    }
    interaction.addEventListener('pointerdown', (event) => {
        if (!event.isPrimary || event.button !== 0 || drag || contextLost || failed || !revealed) return;
        motion.begin();
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
        const scale = 1.35 / Math.max(canvas.getBoundingClientRect().width, 1);
        const dx = (event.clientX - drag.x) * scale, dy = (event.clientY - drag.y) * scale * 0.65;
        motion.move(dy, dx);
        const delta = Math.max((event.timeStamp - drag.time) / 1000, 1 / 240);
        for (const [movement, speedKey] of [[dy, 'vx'], [dx, 'vy']]) {
            const speed = THREE.MathUtils.clamp(movement / delta, -2.4, 2.4);
            if (delta > 0.12 || drag[speedKey] * speed < 0) drag[speedKey] = speed;
            else drag[speedKey] = THREE.MathUtils.damp(drag[speedKey], speed, 35, delta);
        }
        drag.x = event.clientX;
        drag.y = event.clientY;
        drag.time = event.timeStamp;
    }, { passive: true });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((event) => interaction.addEventListener(event, finishDrag));
    interaction.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('blur', () => { finishDrag(); motion.cancel(); });
    canvas.addEventListener('keydown', (event) => {
        if (contextLost || failed || event.altKey || event.ctrlKey || event.metaKey) return;
        const step = Math.PI / 18;
        const directions = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        if (!directions[event.key] && event.key !== 'Home') return;
        event.preventDefault();
        finishDrag();
        if (event.key === 'Home') motion.reset();
        else {
            const [yaw, pitch] = directions[event.key];
            motion.nudge(pitch, yaw);
        }
    });
    reducedMotion.addEventListener('change', () => motion.setReduced(reducedMotion.matches));
    const syncTheme = () => {
        const light = document.documentElement.dataset.theme === 'light';
        material.emissive.set(light ? 0x000000 : 0x0b3a4c);
        material.emissiveIntensity = light ? 0 : 0.55;
        shadowMaterial.color.set(light ? 0x3ea7d6 : 0x3fd0e8);
        shadowBase = light ? 0.42 : 0.3;
        shadowMaterial.opacity = shadowBase;
        render();
    };
    new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        contextLost = true;
        revealed = false;
        finishDrag();
        motion.cancel();
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
