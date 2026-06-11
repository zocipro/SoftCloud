/**
 * 软云网络 - JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    // === 北京时间时钟 ===
    const clock = document.getElementById('clock');
    if (clock) {
        const fmt = new Intl.DateTimeFormat('zh-CN', {
            timeZone: 'Asia/Shanghai',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
        const tick = () => {
            clock.textContent = `北京 ${fmt.format(new Date())}`;
        };
        tick();
        setInterval(tick, 1000);
    }

    // === 滚动入场动画 ===
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // === 自定义光标（仅桌面指针设备）===
    const cursor = document.getElementById('cursor');
    if (cursor && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        let tx = -100, ty = -100; // 目标位置
        let cx = -100, cy = -100; // 当前位置

        document.addEventListener('mousemove', (e) => {
            tx = e.clientX;
            ty = e.clientY;
            cursor.classList.add('on');
        });

        document.addEventListener('mouseleave', () => cursor.classList.remove('on'));

        const loop = () => {
            cx += (tx - cx) * 0.18;
            cy += (ty - cy) * 0.18;
            cursor.style.left = `${cx}px`;
            cursor.style.top = `${cy}px`;
            requestAnimationFrame(loop);
        };
        loop();

        // 悬停可点击元素时放大
        document.querySelectorAll('a, button').forEach(el => {
            el.addEventListener('mouseenter', () => cursor.classList.add('grow'));
            el.addEventListener('mouseleave', () => cursor.classList.remove('grow'));
        });
    }
});
