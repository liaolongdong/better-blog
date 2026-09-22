/**
 * 首页刊头的蒲公英飘籽层。
 *
 * 画布只铺在 .g-masthead 里（那层已经是 position:relative + overflow:hidden），
 * 所以它天然是「刊头的一块纸纹」，不跟着正文往下滚。
 *
 * 三条约束：
 * 1. 颜色从 CSS 变量 --ink-4 取，明暗主题共用一份绘制代码，切换时重读；
 * 2. 刊头滚出视口、标签页切走时停掉 rAF，不在长页面下方白烧帧；
 * 3. prefers-reduced-motion 下只画一帧静止画面——装饰对这类用户是「多余」，
 *    但留一张静图比留一块空白更符合「这是一层纸纹」的预期。
 */
(function (window, document) {
    var canvas = document.querySelector('#dandelionCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    function random(min, max) {
        return Math.random() * (max - min) + min;
    }

    var W = 0;
    var H = 0;
    var ink = '#8A93A6';

    function readInk() {
        var v = window.getComputedStyle(document.documentElement).getPropertyValue('--ink-4');
        if (v && v.trim()) ink = v.trim();
    }

    function resize() {
        var box = canvas.getBoundingClientRect();
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = Math.round(box.width);
        H = Math.round(box.height);
        canvas.width = Math.max(1, Math.round(W * dpr));
        canvas.height = Math.max(1, Math.round(H * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function Seed(scale) {
        this.r = (scale || 1) * random(7, 15);
        this.x = random(0, Math.max(1, W));
        this.y = random(-this.r, Math.max(this.r, H));
        this.vx = random(0.10, 0.30);
        this.phase = random(0, Math.PI * 2);
        this.tilt = random(-0.4, 0.4);
        this.spin = random(-0.0016, 0.0016);
        this.alpha = random(0.26, 0.58);
        this.hairs = 9 + Math.round(random(0, 4));
    }

    Seed.prototype.recycle = function () {
        this.x = -this.r * 2;
        this.y = random(-this.r, Math.max(this.r, H));
        this.vx = random(0.10, 0.30);
        this.phase = random(0, Math.PI * 2);
    };

    Seed.prototype.update = function (t) {
        this.x += this.vx;
        this.y += 0.02 + Math.sin(t * 0.0006 + this.phase) * 0.16;
        this.tilt += this.spin;
        if (this.x - this.r * 2 > W || this.y - this.r > H) this.recycle();
    };

    Seed.prototype.draw = function () {
        var r = this.r;
        var i;
        var a;
        var ex;
        var ey;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.tilt);
        ctx.globalAlpha = this.alpha;
        ctx.strokeStyle = ink;
        ctx.fillStyle = ink;
        ctx.lineWidth = 1;

        // 冠毛：朝上半圈张开的一把细线，每根末端带一粒小点
        for (i = 0; i < this.hairs; i++) {
            a = -Math.PI / 2 + (i / (this.hairs - 1) - 0.5) * Math.PI * 1.15;
            ex = Math.cos(a) * r;
            ey = Math.sin(a) * r;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(ex, ey);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(ex, ey, 0.9, 0, Math.PI * 2);
            ctx.fill();
        }

        // 喙与瘦果：往下收的一小段，给这团东西一个「根」
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, r * 0.72);
        ctx.stroke();
        ctx.beginPath();
        if (ctx.ellipse) ctx.ellipse(0, r * 0.84, 1.1, 2.4, 0, 0, Math.PI * 2);
        else ctx.arc(0, r * 0.84, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    };

    var seeds = [];

    function populate() {
        // 按面积给密度：刊头越高越宽籽越多，但封顶 26 颗，免得大屏变成雪片。
        var n = Math.max(8, Math.min(26, Math.round(W * H / 26000)));
        var i;
        seeds.length = 0;
        for (i = 0; i < n; i++) {
            // 三档半径做景深，小的一颗更淡，读起来像远处飘着的
            seeds.push(new Seed(i % 3 === 0 ? 0.62 : (i % 3 === 1 ? 1 : 1.35)));
        }
    }

    var running = false;
    var onScreen = true;
    var raf = null;
    var reduced = false;

    function frame(t) {
        if (!running) return;
        raf = window.requestAnimationFrame(frame);
        ctx.clearRect(0, 0, W, H);
        for (var i = 0; i < seeds.length; i++) {
            seeds[i].update(t);
            seeds[i].draw();
        }
    }

    // reduced 是硬闸：IntersectionObserver 首次回调必然以「可见」触发一次 start()，
    // 少了这道闸，减少动态效果下的那一帧静止画面会被它就地重新开成循环。
    function start() {
        if (running || !onScreen || document.hidden || reduced) return;
        running = true;
        raf = window.requestAnimationFrame(frame);
    }

    function stop() {
        running = false;
        if (raf !== null) {
            window.cancelAnimationFrame(raf);
            raf = null;
        }
    }

    function still() {
        ctx.clearRect(0, 0, W, H);
        for (var i = 0; i < seeds.length; i++) seeds[i].draw();
    }

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

    function render() {
        resize();
        populate();
        reduced = !!(reduce && reduce.matches);
        if (reduced) {
            stop();
            still();
        } else {
            start();
        }
    }

    function boot() {
        readInk();
        render();

        var rt = null;
        window.addEventListener('resize', function () {
            window.clearTimeout(rt);
            rt = window.setTimeout(render, 180);
        }, { passive: true });

        // 系统偏好中途改了（比如开了辅助功能里的减少动态）要立刻重排一次
        if (reduce && reduce.addEventListener) {
            reduce.addEventListener('change', render);
        }

        document.addEventListener('visibilitychange', function () {
            if (document.hidden) stop();
            else start();
        });

        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                onScreen = entries[0].isIntersecting;
                if (onScreen) start();
                else stop();
            }, { threshold: 0 }).observe(canvas);
        }

        // 主题切换时 --ink-4 变了：在跑的话下一帧自然用新色，停着的话补画一帧。
        if ('MutationObserver' in window) {
            new MutationObserver(function () {
                readInk();
                if (!running) still();
            }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        }
    }

    // 脚本挂在刊头区块开头，此时 .masthead-inner 还没解析，量出来的高度是 0；
    // 必须等 DOM 解析完再量盒子。
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(window, document);
