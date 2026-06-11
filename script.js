/**
 * 软云网络 - JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    // === 主题切换（默认浅色）===
    const html = document.documentElement;
    const themeToggle = document.getElementById('theme-toggle');

    const setTheme = (theme) => {
        html.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    };

    // 仅当用户之前手动选择过深色时才使用深色，否则一律默认浅色
    if (localStorage.getItem('theme') === 'dark') {
        html.setAttribute('data-theme', 'dark');
    }

    themeToggle.addEventListener('click', () => {
        setTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    // === 导航栏滚动状态 ===
    const navbar = document.getElementById('navbar');
    let ticking = false;

    const onScroll = () => {
        navbar.classList.toggle('scrolled', window.scrollY > 24);
    };

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                onScroll();
                ticking = false;
            });
            ticking = true;
        }
    });
    onScroll();

    // === 滚动入场动画 ===
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // === 卡片光斑跟随（仅桌面指针设备）===
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        document.querySelectorAll('.showcase').forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
                card.style.setProperty('--my', `${e.clientY - rect.top}px`);
            });
        });
    }
});
