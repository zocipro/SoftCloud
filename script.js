/**
 * 软云网络 - JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    // === 元素 ===
    const html = document.documentElement;
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const themeToggle = document.getElementById('theme-toggle');
    const sections = document.querySelectorAll('section[id]');

    // === 主题切换 ===
    const getStoredTheme = () => localStorage.getItem('theme');
    const setStoredTheme = (theme) => localStorage.setItem('theme', theme);
    
    const getPreferredTheme = () => {
        const stored = getStoredTheme();
        if (stored) return stored;
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    };

    const setTheme = (theme) => {
        html.setAttribute('data-theme', theme);
        setStoredTheme(theme);
    };

    // 初始化主题
    setTheme(getPreferredTheme());

    // 主题切换按钮
    themeToggle.addEventListener('click', () => {
        const current = html.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        setTheme(next);
    });

    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!getStoredTheme()) {
            setTheme(e.matches ? 'dark' : 'light');
        }
    });

    // === 导航栏滚动效果 ===
    let lastScroll = 0;
    
    const handleScroll = () => {
        const currentScroll = window.scrollY;
        
        if (currentScroll > 50) {
            navbar.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.12)';
        } else {
            navbar.style.boxShadow = 'none';
        }
        
        lastScroll = currentScroll;
    };

    // === 移动端菜单 ===
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (navToggle) {
                navToggle.classList.remove('active');
            }
            if (navMenu) {
                navMenu.classList.remove('active');
            }
        });
    });

    // === 平滑滚动 ===
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const target = document.querySelector(targetId);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // === 导航高亮 ===
    const setActiveLink = () => {
        const scrollY = window.scrollY + 150;
        
        sections.forEach(section => {
            const top = section.offsetTop;
            const height = section.offsetHeight;
            const id = section.getAttribute('id');
            const link = document.querySelector(`.nav-link[href="#${id}"]`);
            
            if (link) {
                if (scrollY >= top && scrollY < top + height) {
                    navLinks.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                }
            }
        });
    };

    // === 滚动动画 ===
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.about-card, .contact-card, .project-showcase').forEach(el => {
        el.classList.add('fade-in');
        observer.observe(el);
    });

    // === 滚动事件 ===
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                handleScroll();
                setActiveLink();
                ticking = false;
            });
            ticking = true;
        }
    });

    // === 窗口大小变化 ===
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            if (navToggle) {
                navToggle.classList.remove('active');
            }
            if (navMenu) {
                navMenu.classList.remove('active');
            }
        }
    });

    // === 初始化 ===
    handleScroll();
    setActiveLink();
});
