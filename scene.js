import * as THREE from './vendor/three.module.min.js';
import logoContours from './assets/logo-shapes.js';

const host = document.getElementById('hero-visual');
const canvas = document.getElementById('sculpture');
const toggle = document.getElementById('motion-toggle');
const label = document.getElementById('motion-label');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const pointerDevice = window.matchMedia('(hover: hover) and (pointer: fine)');

function createSculpture() {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
    camera.position.set(0, 0, 9.2);

    // Studio softboxes give the metal real reflections without downloading an HDR map.
    function createEnvironment() {
        const studio = new THREE.Scene();
        studio.background = new THREE.Color(0x24242a);
        const softboxes = [
            { position: [-3, 3, 2], size: [3, 6], color: 0xffffff, intensity: 6 },
            { position: [4, 1, 1], size: [2, 5], color: 0xe0e4ff, intensity: 4 },
            { position: [0, 5, -2], size: [5, 2], color: 0xffffff, intensity: 5 },
            { position: [-1, -4, 2], size: [4, 1], color: 0xb0b4cc, intensity: 2 },
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
        color: 0xb6b8c5, metalness: 0.94, roughness: 0.24,
        clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: 1.3,
    });
    const overlayMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xf6f6fa, metalness: 0.15, roughness: 0.2,
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
    sculpture.rotation.set(-0.12, -0.38, -0.06);
    scene.add(sculpture);
    scene.add(new THREE.HemisphereLight(0xf2f3ff, 0x24242e, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(-3, 4, 5);
    scene.add(key);

    let frame = 0;
    let lastTime = 0;
    let phase = 0;
    let visible = true;
    let paused = reducedMotion.matches;
    let contextLost = false;
    const target = { x: 0, y: 0 };
    const canAnimate = () => !paused && visible && !document.hidden && !contextLost;
    const render = () => { if (!contextLost) renderer.render(scene, camera); };
    const syncToggle = () => {
        toggle.setAttribute('aria-pressed', String(paused));
        toggle.setAttribute('aria-label', paused ? '播放 3D 动画' : '暂停 3D 动画');
        label.textContent = paused ? '播放动画' : '暂停动画';
        toggle.querySelector('.motion-icon').textContent = paused ? '▷' : 'Ⅱ';
    };
    function animate(time) {
        frame = 0;
        if (!canAnimate()) return;
        const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
        lastTime = time;
        phase += delta;
        sculpture.position.y = Math.sin(phase * 0.7) * 0.07;
        sculpture.rotation.x += (-0.12 + target.y * 0.10 - sculpture.rotation.x) * 0.045;
        sculpture.rotation.y += (-0.38 + Math.sin(phase * 0.3) * 0.22 + target.x * 0.16 - sculpture.rotation.y) * 0.045;
        sculpture.rotation.z = -0.06 + Math.sin(phase * 0.24) * 0.025;
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
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; syncAnimation(); }, { threshold: 0 }).observe(host);
    document.addEventListener('visibilitychange', syncAnimation);
    host.addEventListener('pointermove', (event) => {
        if (!pointerDevice.matches || paused) return;
        const rect = host.getBoundingClientRect();
        target.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        target.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    }, { passive: true });
    host.addEventListener('pointerleave', () => { target.x = 0; target.y = 0; });
    toggle.addEventListener('click', () => { paused = !paused; syncToggle(); syncAnimation(); });
    reducedMotion.addEventListener('change', () => { paused = reducedMotion.matches; target.x = 0; target.y = 0; syncToggle(); syncAnimation(); });
    const syncTheme = () => {
        const light = document.documentElement.dataset.theme === 'light';
        material.color.set(light ? 0x9093a1 : 0xb6b8c5);
        render();
    };
    new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        contextLost = true;
        syncAnimation();
        host.classList.remove('ready');
        toggle.hidden = true;
    });
    canvas.addEventListener('webglcontextrestored', () => {
        contextLost = false;
        environment.dispose();
        environment = createEnvironment();
        scene.environment = environment.texture;
        resize();
        host.classList.add('ready');
        toggle.hidden = false;
        syncAnimation();
    });
    resize();
    syncTheme();
    syncToggle();
    host.classList.add('ready');
    toggle.hidden = false;
    syncAnimation();
}
try { createSculpture(); } catch (error) {
    // The original logo keeps the page complete on devices without WebGL.
    host.classList.remove('ready');
    toggle.hidden = true;
    console.warn('3D visual unavailable; static view retained.', error);
}
