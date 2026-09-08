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
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.remove('is-pending');
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.08 });
    document.querySelectorAll('.reveal').forEach((element) => {
        if (element.getBoundingClientRect().top > window.innerHeight) element.classList.add('is-pending');
        observer.observe(element);
    });
}

// Let the lightweight loading treatment paint before initializing the 3D scene.
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
    document.addEventListener('visibilitychange', syncLoadingTimeout);
    setSceneState('loading');
    requestAnimationFrame(() => requestAnimationFrame(async () => {
        try {
            const { createSculpture } = await import('./scene.js?v=17');
            createSculpture(setSceneState);
        } catch (error) {
            setSceneState('unavailable');
            console.warn('3D visual unavailable; static view retained.', error);
        }
    }));
}
