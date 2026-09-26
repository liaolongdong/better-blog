/**
 * 首页刊头的蒲公英飘籽层。
 *
 * 画布只铺在 .g-masthead 里（那层已经是 position:relative + overflow:hidden），
 * 所以它天然是「刊头的一块纸纹」，不跟着正文往下滚。
 *
 * 四条约束：
 * 1. 颜色从 CSS 变量 --ink-4 取，明暗主题共用一份绘制代码，切换时重读；
 * 2. 刊头滚出视口、标签页切走时停掉 rAF，不在长页面下方白烧帧；
 * 3. prefers-reduced-motion 下只画一帧静止画面——装饰对这类用户是「多余」，
 *    但留一张静图比留一块空白更符合「这是一层纸纹」的预期；
 * 4. （动效批 II 新加）指针经过时把籽轻轻拨开。加扰动而不是改原来的 vx/vy，
 *    是为了让「被拨开」永远是一个会自己弹回来的偏移量，而不是一次会累积的提速：
 *    后者会让籽越飘越快、越界回收、整层变成一场雪崩，而那正是这层纸纹不该有的样子。
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

    // 画布盒子：位置 + 尺寸一次读齐。指针坐标是视口口径，籽的坐标是画布口径，
    // 每帧都要换算一次——所以这个数绝不可以在帧循环里现读 getBoundingClientRect
    // （那是每帧一次强制布局）。它只在 resize 与 scroll 之后刷新，两处都过 rAF。
    var box = { left: 0, top: 0, w: 0, h: 0 };

    function measure() {
        var b = canvas.getBoundingClientRect();
        box.left = b.left;
        box.top = b.top;
        box.w = b.width;
        box.h = b.height;
    }

    // 指针。存视口坐标，换算与力都留到 frame() 里做，事件回调本身只有一次赋值。
    // 初值放在画布之外极远处：刚进页面还没有任何 pointermove 时，(0,0) 会被当成
    // 「指针停在左上角」，那一小片籽凭空让开一个缺口——用户还没碰过它就先动了。
    var pointer = { x: -1e4, y: -1e4 };

    function readInk() {
        var v = window.getComputedStyle(document.documentElement).getPropertyValue('--ink-4');
        if (v && v.trim()) ink = v.trim();
    }

    function resize() {
        // 这里原本是一个局部 var box = canvas.getBoundingClientRect()，
        // 与上面那个模块级的盒子缓存同名会形成遮蔽；改成直接复用 measure()，
        // 一次读取同时供「量尺寸」与「记位置」两个用途。
        measure();
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = Math.max(1, Math.round(box.w));
        H = Math.max(1, Math.round(box.h));
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // 扰动的三个常数。MAX_P 是位移封顶（画布像素），K 是回弹刚度，DAMP 是每帧阻尼。
    // 三个数一起决定「被拨开之后多久飘回来」。脱机跑同一份随机序列、只换指针的
    // 那一遍，量到的三个数（900×260 的画布、9 颗籽）：
    //   指针停着不动 30 帧 —— 峰值 14.6px，撤走 1.6s 后才稳在 1px 以内；
    //   每秒 1350px 扫过 —— 峰值 6.3px，1.1s 稳住；
    //   每秒 2200px 扫过 —— 峰值 2.4px，0.7s 稳住。
    // 「稳住」是连续 60 帧都 <1px，不是第一次 <1px：欠阻尼弹簧必然穿过零点，
    // 按后者量会得到 0.25s 这个漂亮的假数（第一版判据就栽在这里）。
    // 读下来是「静止才有形，路过只起皱」：把鼠标搁在刊头上不动（读标题时真会这样）
    // 能看到一小片让开，正常移动鼠标只是微微起皱——这层是纸纹，不是跟随玩具。
    // DAMP 往 1 靠一档（0.955→0.97，也就是阻尼更小）就是「荡五六下」，籽像被弹了
    // 一下还在颤，那正是这层最不该有的样子；刚度 K 再大一档则变成「躲一下立刻弹回」，
    // 读起来像有弹性的人工草皮。
    var MAX_P = 26;
    var K = 0.012;
    var DAMP = 0.955;

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
        // 扰动是「借来的位置」而不是第二次速度：px/py 是相对原位的偏移，
        // 每帧被弹簧拉回 0，所以它永远不会累积成「越飘越快、越界、整层雪崩」。
        // 原来的 x/y/vx 完全不被这段碰过，回收与边界判定因此一字未改。
        this.px = 0;
        this.py = 0;
        this.pvx = 0;
        this.pvy = 0;
        // 三档半径同时就是三层景深：近处（大、浓）的籽被指针拨得更远，
        // 远处那几层几乎不动。没有这一档，扰动是一整片齐刷刷让开，像推了一把玻璃。
        this.depth = scale || 1;
    }

    Seed.prototype.recycle = function () {
        this.x = -this.r * 2;
        this.y = random(-this.r, Math.max(this.r, H));
        this.vx = random(0.10, 0.30);
        this.phase = random(0, Math.PI * 2);
        // 回收时把扰动一并清零：一颗从左边重新飘进来的籽不该带着上一程的偏移量，
        // 那会让它一出场就偏离本该所在的行，边界外那半截也被算进画里。
        this.px = 0;
        this.py = 0;
        this.pvx = 0;
        this.pvy = 0;
    };

    /**
     * 给这颗籽加一次冲量（视口坐标下的推力，已按景深分档）。
     * @param {number} fx x 方向增量
     * @param {number} fy y 方向增量
     */
    Seed.prototype.push = function (fx, fy) {
        this.pvx += fx * this.depth;
        this.pvy += fy * this.depth;
    };

    Seed.prototype.update = function (t) {
        this.x += this.vx;
        this.y += 0.02 + Math.sin(t * 0.0006 + this.phase) * 0.16;
        this.tilt += this.spin;

        this.pvx += -this.px * K;
        this.pvy += -this.py * K;
        this.pvx *= DAMP;
        this.pvy *= DAMP;
        this.px = clamp(this.px + this.pvx, -MAX_P, MAX_P);
        this.py = clamp(this.py + this.pvy, -MAX_P, MAX_P);

        if (this.x - this.r * 2 > W || this.y - this.r > H) this.recycle();
    };

    /** @param {number} v @param {number} lo @param {number} hi @returns {number} 夹到 [lo,hi] */
    function clamp(v, lo, hi) {
        return v < lo ? lo : v > hi ? hi : v;
    }

    Seed.prototype.draw = function () {
        var r = this.r;
        var i;
        var a;
        var ex;
        var ey;

        ctx.save();
        ctx.translate(this.x + this.px, this.y + this.py);
        // 被拨开的时候整颗籽顺着偏移方向侧一点：只有位移没有侧身，
        // 读起来是「这团东西在平移」；带上侧身才是「被一股风推走了」。
        // 只用 px 不用 py——冠毛是朝上张开的，竖向倾斜没有对应的物理解释。
        ctx.rotate(this.tilt + this.px * 0.012);
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

    // 指针扰动的作用半径与强度（画布像素 / 每帧冲量）。
    // 92 是量出来的：比一颗籽的冠毛展开（r 最大约 20）大四倍半，
    // 指针扫过时先看到「一小片让开」而不是「一颗颗各自弹」，那才是风的读感。
    var REACH = 92;
    var PUSH = .30;

    /** 把指针位置换算成画布坐标，给半径内的每颗籽一次冲量。 */
    function gust() {
        var lx = pointer.x - box.left;
        var ly = pointer.y - box.top;
        if (lx < -REACH || lx > W + REACH || ly < -REACH || ly > H + REACH) return;
        var i;
        var s;
        var dx;
        var dy;
        var d;
        for (i = 0; i < seeds.length; i++) {
            s = seeds[i];
            dx = s.x - lx;
            dy = s.y - ly;
            d = Math.sqrt(dx * dx + dy * dy);
            if (d >= REACH) continue;
            // (1 - d/REACH) 让边缘的籽只是痒一下，正下方的才让开；
            // d < 1 时方向向量退化，直接给一个固定的右上方，不必为零点写分支。
            if (d < 1) { s.push(PUSH, -PUSH); continue; }
            s.push(dx / d * PUSH * (1 - d / REACH), dy / d * PUSH * (1 - d / REACH));
        }
    }

    function frame(t) {
        if (!running) return;
        raf = window.requestAnimationFrame(frame);
        gust();
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
        // 重新开跑之前补量一次盒子：停摆期间（刊头滚出视口、标签页切走）上面那个
        // scroll 监听是 `!running` 直接 return 的，box 一直是旧的。
        // 只在开跑这一刻量一次，不是每帧量——一帧一次 getBoundingClientRect
        // 就是一次强制布局，而这层本来就贴着 .g-masthead 那条 overflow 在跑。
        measure();
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

        // ———— 指针扰动（动效批 II · 约束 4）————
        // 判据与 CSS 那边磁吸按钮、下拉错峰用的是同一条：真有指针设备才挂。
        // 触屏不挂有两个理由，第二个比第一个硬：一是没有「悬停」这回事，
        // 二是手指落下那一刻的坐标换算成画布位置要晚一帧，扰动会从错误的点炸开。
        // reduced 也不用在这里判——那条闸门在 start() 上，循环不跑，扰动就没有读者。
        if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            window.addEventListener('pointermove', function (e) {
                pointer.x = e.clientX;
                pointer.y = e.clientY;
            }, { passive: true });

            // 指针离开窗那一刻把"它在哪"抹掉，否则鼠标停在刊头上、人去干别的，
            // 回来时那一小片籽还维持着让开的形状——静止的偏移比运动更难解释。
            window.addEventListener('blur', function () {
                pointer.x = -1e4;
                pointer.y = -1e4;
            });

            // 盒子的视口位置会随滚动变。每帧最多量一次，而且只在循环真的在跑的时候量：
            // 刊头滚出视口之后循环是停的，这时候再量就是白给一个每帧强制布局。
            // （量盒子这件事在 start() 里也补了一次，理由见那里。）
            var measuring = false;
            window.addEventListener('scroll', function () {
                if (measuring || !running) return;
                measuring = true;
                window.requestAnimationFrame(function () {
                    measuring = false;
                    measure();
                });
            }, { passive: true });
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
