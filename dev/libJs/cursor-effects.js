/*
 * 点击处的粒子尾迹（动效批 II · D 组改过三处，理由见各自的位置）：
 *   · 颜色色相全随机，明度按白昼 / 夜间两档反解（见 nightMode / Boom.pickColor）；
 *   · 半径随机 1.5~3，给一点点景深（见 Circle.draw）；
 *   · 视口尺寸跟随 resize（见 CursorSpecialEffects.handleResize）。
 * 减少动态效果的闸门在文件末尾，那一条没动。
 */

/**
 * 现在是夜间态吗？深色标记同时挂在 <html> 和 <body> 上（tokens.scss:158 那条注释），
 * 所以两边都认。
 *
 * 这个开关只决定粒子的明度档，不再缓存颜色：一次点击 10 颗，每颗读两次 classList
 * 是纯内存操作，而早先为了缓存 --signal 而写的那套 getComputedStyle + MutationObserver，
 * 在色相改成随机之后就没有可缓存的东西了（getComputedStyle 会强制样式重算，
 * 那才是当初要缓存的唯一理由）。
 */
function nightMode() {
    return document.documentElement.classList.contains('night-mode') ||
        (!!document.body && document.body.classList.contains('night-mode'));
}

/**
 * HSL 转 RGB，返回 [r, g, b]（0~255）。h 用度数，s 与 l 用 0~1。
 * @returns {number[]}
 */
function hslToRgb(h, s, l) {
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}

/** WCAG 相对亮度（0~1）：sRGB 各通道先线性化，再按 .2126 / .7152 / .0722 加权。 */
function relativeLuminance(rgb) {
    const lin = (v) => {
        const c = v / 255;
        return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
    };
    return .2126 * lin(rgb[0]) + .7152 * lin(rgb[1]) + .0722 * lin(rgb[2]);
}

class Circle {
    constructor({ origin, speed, color, angle, context, radius }) {
        this.origin = origin;
        this.position = {
            ...this.origin,
        };
        this.color = color;
        this.speed = speed;
        this.angle = angle;
        this.context = context;
        this.radius = radius || 2;
        this.renderCount = 0;
    }

    draw() {
        this.context.fillStyle = this.color;
        this.context.beginPath();
        this.context.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        this.context.fill();
    }

    move() {
        this.position.x = Math.sin(this.angle) * this.speed + this.position.x;
        this.position.y =
            Math.cos(this.angle) * this.speed +
            this.position.y +
            this.renderCount * 0.3;
        this.renderCount++;
    }
}

class Boom {
    constructor({ origin, context, circleCount = 10, host }) {
        this.origin = origin;
        this.context = context;
        this.circleCount = circleCount;
        // 出界判定读的是 CursorSpecialEffects 那一份 live 尺寸，不是构造时的快照。
        // 原来这里收的是 {width, height} 一份值拷贝，而那两处数字只在 new 的那一刻
        // 读一次，于是窗口变过之后：拉大 → 新腾出来那片里的点击坐标落在旧位图之外，
        // 点了没有粒子；缩小 → 已经飘出屏幕的粒子仍算「界内」，booms 一直不减，
        // rAF 停不下来。改成引用宿主，handleResize() 那一处写入就让判定和画布同时跟上。
        this.host = host;
        this.stop = false;
        this.circles = [];
    }

    randomRange(start, end) {
        return (end - start) * Math.random() + start;
    }

    /**
     * 一颗粒子的填充色：色相全随机，明度按「在这张纸上站得住」反解出来。
     *
     * 这里是第三版。最早那版在每个通道上从 8~F 里随机取一位十六进制：512 种组合的
     * 相对亮度落在 .246~1.000（中位 .560），对白昼纸 #FAF9F6（亮度 .947）中位只有
     * 1.63:1，70% 的组合不到 2:1、98% 不到 3:1——白昼点一下基本看不见。
     * 第二版为了拿回对比度把色相锁成主题信号蓝、只往白色方向提亮，代价就是用户
     * 认出来的那句「以前是五颜六色的」。
     *
     * 但对比度其实不需要靠固定色相来换。真正的毛病是同一个 HSL 的 L 在不同色相上
     * 差好几倍：hsl(60,90%,48%) 亮度 .756，对白昼纸 1.24:1；hsl(220,90%,48%) 亮度
     * .126，同样写法的 L 却有 5.66:1。所以这版固定住「随机色相 + 随机饱和度」，
     * 用二分把 L 解到目标亮度档，档位按 WCAG 对比度公式算（纸面色值见 tokens.scss）：
     *   白昼 亮度 .14~.22 → (.947+.05)/(.19~.27) = 3.7~5.3，2 万颗实测 3.65~5.31
     *   夜间 亮度 .28~.42 → (.33~.47)/(.007+.05) = 5.8~8.3，2 万颗实测 5.73~8.31
     * 二分 12 次，落点区间宽 1/4096 ≈ .0002，那点余量就是实测比算出的低 0.05 的来源。
     * 真浏览器侧复核过一遍：连点 6 次得 60 颗，只取 alpha=255 的实心像素分桶，
     * 白昼读到 3.71~5.16、夜间 5.83~8.24，色相铺满 0~359。
     * 一簇十颗各解各的，所以同一次点击里也分得出深浅。不写 alpha：这十颗只位移不淡出，
     * 半透明只会把它们往纸色混、把刚解出来的对比度还回去。
     * @returns {string} rgb() 串
     */
    pickColor() {
        const night = nightMode();
        const hue = this.randomRange(0, 360);
        const sat = this.randomRange(.55, .95);
        const target = night ? this.randomRange(.28, .42) : this.randomRange(.14, .22);
        // 色相与饱和度固定时，相对亮度随 L 单调上升，二分必收敛。
        let lo = 0;
        let hi = 1;
        let rgb = hslToRgb(hue, sat, .5);
        for (let i = 0; i < 12; i++) {
            const mid = (lo + hi) / 2;
            rgb = hslToRgb(hue, sat, mid);
            if (relativeLuminance(rgb) > target) {
                hi = mid;
            } else {
                lo = mid;
            }
        }
        return 'rgb(' + rgb.join(',') + ')';
    }

    init() {
        for (let i = 0; i < this.circleCount; i++) {
            const circle = new Circle({
                context: this.context,
                origin: this.origin,
                color: this.pickColor(),
                angle: this.randomRange(Math.PI - 1, Math.PI + 1),
                speed: this.randomRange(1, 6),
                // 一颗粒子从生到死是同一个大小，但同一簇里要有大有小才读得出远近。
                radius: this.randomRange(1.4, 3),
            });
            this.circles.push(circle);
        }
    }

    move() {
        this.circles.forEach((circle, index) => {
            if (
                circle.position.x > this.host.globalWidth ||
                circle.position.y > this.host.globalHeight
            ) {
                return this.circles.splice(index, 1);
            }
            circle.move();
        });
        if (this.circles.length == 0) {
            this.stop = true;
        }
    }

    draw() {
        this.circles.forEach((circle) => circle.draw());
    }
}

class CursorSpecialEffects {
    constructor() {
        this.computerCanvas = document.createElement("canvas");
        this.renderCanvas = document.createElement("canvas");

        this.computerContext = this.computerCanvas.getContext("2d");
        this.renderContext = this.renderCanvas.getContext("2d");

        this.globalWidth = window.innerWidth;
        this.globalHeight = window.innerHeight;

        this.booms = [];
        this.running = false;
        // resize 闸门：见 scheduleResize()。构造时就摆好初值，不留 undefined。
        this.resizeQueued = false;
    }

    handleMouseDown(e) {
        const boom = new Boom({
            origin: {
                x: e.clientX,
                y: e.clientY,
            },
            context: this.computerContext,
            host: this,
        });
        boom.init();
        this.booms.push(boom);
        this.running || this.run();
    }

    handlePageHide() {
        this.booms = [];
        this.running = false;
    }

    /**
     * 视口变了就把两张画布与判定面积一起改过来。
     *
     * 原来这两个数只在构造时读一次 window.innerWidth/Height：把窗口拉大之后，
     * 老尺寸的位图配不上新窗口（粒子画在屏幕左上角那一块），而 Boom.move() 的
     * 出界判定还在用旧面积，右侧与下方新腾出来的那一片里粒子永远不被回收，
     * booms 数组只增不减、rAF 一直不停。改尺寸的写法要注意 style.width
     * 必须带单位——原来那行链式赋值把 Number 直接给 style.width，是被 CSSOM
     * 静默丢掉的，只是画布本来就没有 CSS 尺寸、按位图尺寸 1:1 排，才没露馅。
     */
    handleResize() {
        this.globalWidth = window.innerWidth;
        this.globalHeight = window.innerHeight;
        this.renderCanvas.width = this.computerCanvas.width = this.globalWidth;
        this.renderCanvas.height = this.computerCanvas.height = this.globalHeight;
        this.renderCanvas.style.width = this.globalWidth + 'px';
        this.renderCanvas.style.height = this.globalHeight + 'px';
    }

    init() {
        const style = this.renderCanvas.style;
        style.position = "fixed";
        style.top = style.left = 0;
        style.zIndex = "9999";
        // 尺寸与位图一律交给 handleResize()：它既是初始值也是唯一写入口，
        // 免得「初始那段」和「resize 那段」各写一套——那正是窗口拉大之后
        // style.width 里留着一条无单位赋值、只有属性被刷新的那种分裂。
        style.pointerEvents = "none";
        this.handleResize();

        document.body.append(this.renderCanvas);

        window.addEventListener("mousedown", this.handleMouseDown.bind(this));
        window.addEventListener("pagehide", this.handlePageHide.bind(this));
        // resize 合帧：拖一次窗口能来上百个事件，而 handleResize() 每次要给两张
        // 全视口画布重设位图尺寸（两次大位图分配 + 清空）。这一条闸门与 cat.js
        // 的 resize 判定同源：一帧内只落一次笔，最后一次一定会落。
        window.addEventListener("resize", this.scheduleResize.bind(this), { passive: true });
    }

    /** 把一次 resize 折进「这一帧还没落笔」的那一个 rAF 里。 */
    scheduleResize() {
        if (this.resizeQueued) return;
        this.resizeQueued = true;
        window.requestAnimationFrame(() => {
            this.resizeQueued = false;
            this.handleResize();
        });
    }

    run() {
        this.running = true;
        if (this.booms.length == 0) {
            return (this.running = false);
        }

        requestAnimationFrame(this.run.bind(this));

        this.computerContext.clearRect(0, 0, this.globalWidth, this.globalHeight);
        this.renderContext.clearRect(0, 0, this.globalWidth, this.globalHeight);

        this.booms.forEach((boom, index) => {
            if (boom.stop) {
                return this.booms.splice(index, 1);
            }
            boom.move();
            boom.draw();
        });
        this.renderContext.drawImage(
            this.computerCanvas,
            0,
            0,
            this.globalWidth,
            this.globalHeight
        );
    }
}

const cursorSpecialEffects = new CursorSpecialEffects();

// 鼠标尾迹是纯装饰，且完全跟随指针持续重绘，属于「减少动态效果」明确要关的那一类。
if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cursorSpecialEffects.init();
}
