const html = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');
const syncThemeLabel = () => themeToggle.setAttribute('aria-label', html.dataset.theme === 'dark' ? '切换为浅色主题' : '切换为深色主题');
syncThemeLabel();
themeToggle.addEventListener('click', () => {
    html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', html.dataset.theme); } catch (e) { /* Theme also works when storage is unavailable. */ }
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
