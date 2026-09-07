import * as THREE from './vendor/three.module.min.js';
import logoContours from './assets/logo-shapes.js';

const host = document.getElementById('hero-visual');
const canvas = document.getElementById('sculpture');
const toggle = document.getElementById('motion-toggle');
const label = document.getElementById('motion-label');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function createSculpture() {
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
    sculpture.rotation.set(-0.12, -0.38, -0.06, 'YXZ');
    scene.add(sculpture);
    scene.add(new THREE.HemisphereLight(0xf2faff, 0x517d9a, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(-3, 4, 5);
    scene.add(key);

    let frame = 0;
    let lastTime = 0;
    let phase = 0;
    let visible = true;
    let paused = reducedMotion.matches;
    let contextLost = false;
    let drag = null;
    const canAnimate = () => !paused && !drag && visible && !document.hidden && !contextLost;
    const render = () => { if (!contextLost) renderer.render(scene, camera); };
    const syncToggle = () => {
        toggle.setAttribute('aria-pressed', String(paused));
        toggle.setAttribute('aria-label', paused ? '开启自动旋转' : '暂停自动旋转');
        label.textContent = paused ? '自动旋转' : '暂停旋转';
        toggle.querySelector('.motion-icon use').setAttribute('href', paused ? '#play' : '#pause');
    };
    function animate(time) {
        frame = 0;
        if (!canAnimate()) return;
        const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
        lastTime = time;
        const previousPhase = phase;
        phase += delta;
        // Apply only the automatic motion's change, preserving the user's chosen angle.
        sculpture.position.y += (Math.sin(phase * 0.7) - Math.sin(previousPhase * 0.7)) * 0.07;
        sculpture.rotation.y += (Math.sin(phase * 0.3) - Math.sin(previousPhase * 0.3)) * 0.22;
        sculpture.rotation.z += (Math.sin(phase * 0.24) - Math.sin(previousPhase * 0.24)) * 0.025;
        render();
        frame = requestAnimationFrame(animate);
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
        if (!visible) finishDrag();
        syncAnimation();
    }, { threshold: 0 }).observe(host);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) finishDrag();
        syncAnimation();
    });
    function finishDrag(event) {
        if (!drag || (event && event.pointerId !== drag.pointerId)) return;
        const { pointerId } = drag;
        drag = null;
        canvas.classList.remove('is-dragging');
        if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
        syncAnimation();
    }
    function rotateBy(x, y) {
        sculpture.rotation.y += x;
        sculpture.rotation.x = THREE.MathUtils.clamp(sculpture.rotation.x + y, -Math.PI / 2, Math.PI / 2);
        render();
    }
    canvas.addEventListener('pointerdown', (event) => {
        if (!event.isPrimary || event.button !== 0 || drag || contextLost) return;
        drag = { pointerId: event.pointerId, type: event.pointerType, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, started: false };
        canvas.setPointerCapture(event.pointerId);
        syncAnimation();
    });
    canvas.addEventListener('pointermove', (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        if (drag.type === 'mouse' && !(event.buttons & 1)) { finishDrag(event); return; }
        if (!drag.started) {
            const x = event.clientX - drag.startX, y = event.clientY - drag.startY;
            if (Math.hypot(x, y) < 6) return;
            // Vertical touch gestures belong to page scrolling, including native pinch zoom.
            if (drag.type === 'touch' && Math.abs(y) >= Math.abs(x)) { finishDrag(event); return; }
            drag.started = true;
            paused = true;
            canvas.classList.add('is-dragging');
            syncToggle();
        }
        const scale = Math.PI * 2 / Math.max(canvas.getBoundingClientRect().width, 1);
        rotateBy((event.clientX - drag.x) * scale, drag.type === 'touch' ? 0 : (event.clientY - drag.y) * scale);
        drag.x = event.clientX;
        drag.y = event.clientY;
    }, { passive: true });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((event) => canvas.addEventListener(event, finishDrag));
    window.addEventListener('blur', () => finishDrag());
    canvas.addEventListener('keydown', (event) => {
        if (contextLost || event.altKey || event.ctrlKey || event.metaKey) return;
        const step = Math.PI / 18;
        const directions = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        if (!directions[event.key] && event.key !== 'Home') return;
        event.preventDefault();
        paused = true;
        finishDrag();
        if (event.key === 'Home') {
            sculpture.rotation.set(-0.12, -0.38, -0.06, 'YXZ');
            sculpture.position.y = 0;
            phase = 0;
        } else rotateBy(...directions[event.key]);
        syncToggle();
        syncAnimation();
    });
    toggle.addEventListener('click', () => { finishDrag(); paused = !paused; syncToggle(); syncAnimation(); });
    reducedMotion.addEventListener('change', () => { finishDrag(); paused = reducedMotion.matches; syncToggle(); syncAnimation(); });
    const syncTheme = () => {
        const light = document.documentElement.dataset.theme === 'light';
        material.color.set(light ? 0x258daf : 0x41aacf);
        render();
    };
    new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        contextLost = true;
        finishDrag();
        syncAnimation();
        host.classList.remove('ready');
        canvas.tabIndex = -1;
        toggle.hidden = true;
    });
    canvas.addEventListener('webglcontextrestored', () => {
        contextLost = false;
        environment.dispose();
        environment = createEnvironment();
        scene.environment = environment.texture;
        resize();
        host.classList.add('ready');
        canvas.tabIndex = 0;
        toggle.hidden = false;
        syncAnimation();
    });
    resize();
    syncTheme();
    syncToggle();
    host.classList.add('ready');
    canvas.tabIndex = 0;
    toggle.hidden = false;
    syncAnimation();
}
try { createSculpture(); } catch (error) {
    // The original logo keeps the page complete on devices without WebGL.
    host.classList.remove('ready');
    toggle.hidden = true;
    console.warn('3D visual unavailable; static view retained.', error);
}
