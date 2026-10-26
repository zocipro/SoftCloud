const html = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
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

// Scroll reveal, staggered among siblings.
if ('IntersectionObserver' in window && !reducedMotion.matches) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.remove('is-pending');
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    document.querySelectorAll('.reveal').forEach((element) => {
        const siblings = [...element.parentElement.children].filter((child) => child.classList.contains('reveal'));
        element.style.setProperty('--delay', `${Math.min(siblings.indexOf(element), 5) * 0.07}s`);
        if (element.getBoundingClientRect().top > window.innerHeight) element.classList.add('is-pending');
        observer.observe(element);
    });
}

// Cards carry a soft spotlight that follows the pointer.
document.querySelectorAll('.product-card').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
        card.style.setProperty('--my', `${event.clientY - rect.top}px`);
    }, { passive: true });
});

// The manifesto lights up character by character as it scrolls through the viewport.
const manifesto = document.querySelector('[data-manifesto]');
if (manifesto) {
    const chars = [...manifesto.textContent];
    manifesto.setAttribute('aria-label', manifesto.textContent);
    manifesto.textContent = '';
    chars.forEach((char, index) => {
        const span = document.createElement('span');
        span.className = 'char';
        span.setAttribute('aria-hidden', 'true');
        span.style.setProperty('--i', index);
        span.textContent = char;
        manifesto.append(span);
    });
    manifesto.style.setProperty('--n', chars.length + 6);
    let ticking = false;
    const update = () => {
        ticking = false;
        if (reducedMotion.matches) { manifesto.style.setProperty('--progress', 1); return; }
        const rect = manifesto.getBoundingClientRect();
        const start = window.innerHeight * 0.88, end = window.innerHeight * 0.32;
        const progress = Math.min(1, Math.max(0, (start - rect.top) / (start - end + rect.height * 0.6)));
        manifesto.style.setProperty('--progress', progress.toFixed(3));
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
}

// Count the headline numbers up once they come into view.
const counters = document.querySelectorAll('[data-count]');
if (counters.length && 'IntersectionObserver' in window && !reducedMotion.matches) {
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            counterObserver.unobserve(entry.target);
            const target = Number(entry.target.dataset.count);
            const begin = performance.now();
            const tick = (now) => {
                const t = Math.min(1, (now - begin) / 1200);
                const eased = 1 - Math.pow(1 - t, 4);
                entry.target.textContent = String(Math.round(target * eased)).padStart(2, '0');
                if (t < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        });
    }, { threshold: 0.6 });
    counters.forEach((counter) => counterObserver.observe(counter));
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
            const { createSculpture } = await import('./scene.js?v=18');
            createSculpture(setSceneState);
        } catch (error) {
            setSceneState('unavailable');
            console.warn('3D visual unavailable; static view retained.', error);
        }
    }));
}
