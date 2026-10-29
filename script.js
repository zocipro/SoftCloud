const html = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');
const syncThemeLabel = () => themeToggle.setAttribute('aria-label', html.dataset.theme === 'dark' ? '切换为浅色主题' : '切换为深色主题');
syncThemeLabel();
themeToggle.addEventListener('click', () => {
    html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('softcloud-theme-blue', html.dataset.theme); } catch (e) { /* Theme also works when storage is unavailable. */ }
    syncThemeLabel();
});

const navbar = document.getElementById('navbar');
const updateNavbar = () => navbar.classList.toggle('scrolled', window.scrollY > 24);
window.addEventListener('scroll', updateNavbar, { passive: true });
updateNavbar();

// Compact navigation on phones: a disclosure panel under the capsule.
const menuToggle = document.getElementById('menu-toggle');
const navLinks = document.getElementById('nav-links');
const setMenu = (open) => {
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
    navLinks.classList.toggle('open', open);
};
menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
navLinks.addEventListener('click', (event) => { if (event.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && navLinks.classList.contains('open')) { setMenu(false); menuToggle.focus(); } });
document.addEventListener('click', (event) => { if (!navbar.contains(event.target)) setMenu(false); });

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());

// The 3D scene pulls in Three.js, so it loads only once the hero is on screen and the browser is idle.
// Data-saver visitors keep the static cloud instead.
const sceneHost = document.getElementById('hero-visual');
if (sceneHost) {
    let loadingTimeout;
    const syncLoadingTimeout = () => {
        clearTimeout(loadingTimeout);
        if (sceneHost.dataset.sceneState === 'loading' && !document.hidden) {
            loadingTimeout = setTimeout(() => {
                if (!document.hidden && sceneHost.dataset.sceneState === 'loading') setSceneState('unavailable');
            }, 15000);
        }
    };
    const setSceneState = (state) => {
        sceneHost.dataset.sceneState = state;
        sceneHost.classList.toggle('ready', state === 'ready');
        sceneHost.setAttribute('aria-busy', String(state === 'loading'));
        document.getElementById('sculpture').tabIndex = state === 'ready' ? 0 : -1;
        syncLoadingTimeout();
    };
    const load = async () => {
        try {
            const { createSculpture } = await import('./scene.js?v=18');
            createSculpture(setSceneState);
        } catch (error) {
            setSceneState('unavailable');
            console.warn('3D visual unavailable; static view retained.', error);
        }
    };
    const whenIdle = (callback) => ('requestIdleCallback' in window ? requestIdleCallback(callback, { timeout: 1200 }) : setTimeout(callback, 200));
    if (navigator.connection?.saveData) {
        setSceneState('unavailable');
    } else {
        document.addEventListener('visibilitychange', syncLoadingTimeout);
        setSceneState('loading');
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver(([entry]) => {
                if (!entry.isIntersecting) return;
                observer.disconnect();
                whenIdle(load);
            });
            observer.observe(sceneHost);
        } else {
            whenIdle(load);
        }
    }
}
