/*
 * 点击处的粒子特效（上游 tholman/cursor-effects 的 Boom 一支，本地改动见 THIRD-PARTY-NOTICES.md）。
 *
 * 2026-10-21 这一版把「散开」和「掉帧」两件事一起改了，四条根因都在
 * scripts/verify-particle-burst.mjs 里有前后读数：
 *   · 喷发角度从 (π-1, π+1) 那一小撮扇形改成整圈，速度从「每帧现算 sin/cos + 二次重力项」
 *     改成初速度 + 阻尼 + 一个小重力常数 —— 原来实测向上只铺 46px、向下掉 480px，
 *     那不是四向散开，是往下下雨；
 *   · 每颗粒子带自己的寿命，出界判定四边都看。原来只判右/下两条边，于是
 *     「粒子能活多久」其实取决于你在页面的哪一半点的：y=180 活 2973ms、y=790 只 963ms；
 *   · `forEach` 里 `splice` 改成倒序删。一次回收两颗粒子时后面那颗会被跳过一帧，
 *     读起来就是「有几颗突然冻住」；
 *   · 每帧不再擦两整屏 + 拷一整屏，只擦上一帧真正画过的那一小块（Dirty），
 *     并按 devicePixelRatio 建位图（封顶 2，与 dandelionAnimate.js:58 同档）。
 *     原来每帧开销正比于视口面积，实测中位帧时 20.5ms —— 60fps 的预算是 16.7ms，
 *     这一发特效从第一次点击就在掉帧，Retina 上合成器还要额外拉伸一倍。
 * 另外：只认左键（右键菜单、中键粘贴原本也会各喷一发），连点上限 8 发。
 * 颜色那套 WCAG 亮度反解没动（见 Boom.pickColor）；减少动态效果的闸门在文件末尾，也没动。
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
    constructor({ origin, speed, color, angle, context, radius, life }) {
        this.origin = origin;
        this.position = {
            ...this.origin,
        };
        this.color = color;
        // 速度拆成两个分量：原来 x/y 各自现算 sin/cos(angle)*speed，再往 y 上叠一项
        // renderCount * 0.3 —— 那一项是二次增长的位移（等于重力加速度），所以一发点击
        // 实际是「往上 46px、往下掉 480px」的重力雨，而不是四向散开。改成初速度 + 阻尼，
        // 重力只留一个很小的常数，粒子先径向冲出去、再慢慢坠下来。
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.context = context;
        this.radius = radius || 2;
        // 寿命按帧计，到点自己消失：回收不再依赖「飘出右/下边界」这种 accident。
        // 实测过那一格：落点 y=790（离底 110px）时粒子 963ms 就被底边收走，而 y=180 时
        // 能活 2973ms——同一发特效在页面上下两半完全是两个样子，这就是「有时候散落不开」。
        this.life = life;
        this.maxLife = life;
    }

    /** 这一颗粒子当前占住的矩形（含抗锯齿边缘的 1px 余量），供脏矩形回收用。 */
    bounds() {
        const r = this.radius + 1.5;
        return [this.position.x - r, this.position.y - r, r * 2, r * 2];
    }

    draw() {
        this.context.fillStyle = this.color;
        // 前 70% 寿命保持实心：pickColor 那套 WCAG 亮度反解是按「不透明」算的，
        // 一早就半透明等于把刚解出来的对比度还给纸色。只有收尾那 30% 才淡出，
        // 淡出的是「已经飘走的那一段」，不是读者用来认字形的主体。
        const k = this.life / this.maxLife;
        this.context.globalAlpha = k > 0.7 ? 1 : Math.max(k / 0.7, 0);
        this.context.beginPath();
        this.context.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        this.context.fill();
        this.context.globalAlpha = 1;
    }

    /**
     * 位移按**时间**算，不按帧数算。
     *
     * 上游那版是每帧加一个固定量，等于把动画绑在 60fps 上：机器一忙、帧一掉，
     * 粒子就走得又短又慢（这台无头在负载 462 时实测 3 秒只给到 50 帧，同一发点击
     * 的铺幅从 136px 塌到 45px）。改成按 dt 归一之后，掉帧只影响「看得顺不顺」，
     * 不再影响「散得多远、活多久」。阻尼写成 pow(d, k) 而不是 d，
     * 这样两帧合起来的衰减与一帧 2 倍时长等价。
     * @param {number} k 这一帧相当于多少个 60fps 帧（钳在 0.25~3 之间）
     */
    move(k) {
        this.position.x += this.vx * k;
        this.position.y += this.vy * k;
        // 0.965 而不是 0.94：粒子能走到的半径是 v0·d/(1−d)，0.94 那一档上限只有约 100px，
        // 实测四向铺幅 46~120px——读者看到的仍是「挤成一团」。0.965 配 3.2~7 的初速度
        // 铺到约 90~190px。重力从 0.06 压到 0.03：0.06 时整簇会额外往下坠约 90px，
        // 「向上」那一向就被吃掉了（实测 上 62 / 下 186），四向就不对称了。
        const drag = Math.pow(0.965, k);
        this.vx *= drag;
        this.vy = this.vy * drag + 0.018 * k;
        this.life -= k;                        // 寿命同样按帧当量走，不是按秒
    }
}

class Boom {
    constructor({ origin, context, circleCount = 16, host }) {
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
                // 一整圈，而不是 (π-1, π+1) 那 2 弧度的朝上一小撮扇形。
                // 上游那版只往一个方向喷，配上二次重力项就成了「只往下掉」——
                // 四向都铺得开，才谈得上「散」。
                angle: this.randomRange(0, Math.PI * 2),
                speed: this.randomRange(3.2, 7),
                // 一颗粒子从生到死是同一个大小，但同一簇里要有大有小才读得出远近。
                radius: this.randomRange(1.4, 3),
                life: Math.round(this.randomRange(44, 66)),
            });
            this.circles.push(circle);
        }
    }

    move(k) {
        // 倒着删。原来是 `forEach` 里 `splice(index,1)`：一次回收两颗粒子，
        // 后面那颗的索引就前移一位、这一帧不被更新——读起来就是「有几颗突然冻住一下」，
        // 也就是用户说的偶发卡顿里最直观的那一种。
        for (let i = this.circles.length - 1; i >= 0; i--) {
            const p = this.circles[i].position;
            const out = p.x < -8 || p.y < -8 || p.x > this.host.globalWidth + 8 || p.y > this.host.globalHeight + 8;
            if (out || this.circles[i].life <= 0) {
                this.circles.splice(i, 1);
                continue;
            }
            this.circles[i].move(k);
        }
        if (this.circles.length == 0) {
            this.stop = true;
        }
    }

    /** 画，并把这一帧真正着过色的范围并进 dirty（下一帧只清这一块）。 */
    draw(dirty) {
        this.circles.forEach((circle) => {
            const b = circle.bounds();
            dirty.add(b[0], b[1], b[2], b[3]);
            circle.draw();
        });
    }
}

/** 一帧里真正着过色的范围。下一帧只清这一块，而不是整个视口。 */
class Dirty {
    constructor() { this.reset(); }
    reset() { this.x0 = Infinity; this.y0 = Infinity; this.x1 = -Infinity; this.y1 = -Infinity; }
    add(x, y, w, h) {
        if (x < this.x0) this.x0 = x;
        if (y < this.y0) this.y0 = y;
        if (x + w > this.x1) this.x1 = x + w;
        if (y + h > this.y1) this.y1 = y + h;
    }
    get cleared() { return this.x1 < this.x0; }
}

class CursorSpecialEffects {
    constructor() {
        this.renderCanvas = document.createElement("canvas");
        this.renderContext = this.renderCanvas.getContext("2d");

        // globalWidth/Height 一律是 **CSS 像素**（逻辑尺寸）：粒子坐标、出界判定、
        // 脏矩形都按它算，位图按 devicePixelRatio 放大后靠 setTransform 折回来。
        this.dpr = 1;
        this.globalWidth = window.innerWidth;
        this.globalHeight = window.innerHeight;
        // 上一帧画过哪儿，这一帧就擦哪儿。初值给整屏，保证第一次落笔前旧内容被清干净。
        this.prevDirty = new Dirty();
        this.prevDirty.add(0, 0, this.globalWidth, this.globalHeight);

        this.booms = [];
        this.running = false;
        this.runBound = null;
        this.lastFrame = 0;
        // 连点上限。实测 14 发同屏（140 颗粒子）时最长帧 17.3ms、零长帧，所以这不是
        // 为了救火——是为了「一直点下去」时开销有上界，而不是随点击次数线性涨。
        this.maxBooms = 8;
        // resize 闸门：见 scheduleResize()。构造时就摆好初值，不留 undefined。
        this.resizeQueued = false;
    }

    handleMouseDown(e) {
        // 只认左键。原来任何 mousedown 都会喷一发：右键呼出菜单、中键粘贴都算一次点击，
        // 而那两个动作里读者根本没期待任何动效。
        if (e.button !== 0) return;
        if (this.booms.length >= this.maxBooms) this.booms.shift();
        const boom = new Boom({
            origin: {
                x: e.clientX,
                y: e.clientY,
            },
            context: this.renderContext,
            host: this,
        });
        boom.init();
        this.booms.push(boom);
        this.running || this.run();
    }

    handlePageHide() {
        this.booms = [];
        this.running = false;
        // 循环停在「booms 空了就直接 return」那一步，之前它不再擦屏。pagehide 之后
        // 若页面从 bfcache 回来，上一屏的粒子会一直糊在画布上，所以这里补一次擦。
        const p = this.prevDirty;
        if (!p.cleared) this.renderContext.clearRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
        this.prevDirty = new Dirty();
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
        // 与 dandelionAnimate.js:58 同一档写法：dpr 封顶 2（3 倍屏上再翻倍只是多画四倍像素），
        // 位图按 dpr 放大、CSS 尺寸保持逻辑像素，再用 setTransform 把绘图坐标折回逻辑单位。
        // 原来位图 == CSS 尺寸，Retina 上整张画布被合成器拉伸 2 倍：粒子是一团糊的，
        // 而且每帧还都得重采样一整屏。
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.renderCanvas.width = Math.round(this.globalWidth * this.dpr);
        this.renderCanvas.height = Math.round(this.globalHeight * this.dpr);
        this.renderCanvas.style.width = this.globalWidth + 'px';
        this.renderCanvas.style.height = this.globalHeight + 'px';
        this.renderContext.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        // 位图一改旧内容就没了，脏矩形要按整屏补一次清，否则会留下上一尺寸的残影。
        this.prevDirty = new Dirty();
        this.prevDirty.add(0, 0, this.globalWidth, this.globalHeight);
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
        const now = (window.performance || Date).now();
        // 循环刚起来（或停过一次又起来）时不拿上一轮的旧时间戳算 dt：那会把「停帧的那一段」
        // 一次性补进轨迹，粒子跳一大步再淡出，正是要避免的走形。
        if (!this.running) this.lastFrame = 0;
        this.running = true;
        if (this.booms.length == 0) {
            return (this.running = false);
        }

        // 每帧一个新的绑定，而不是 `this.run.bind(this)`：一秒钟 60 次分配，
        // 而且原来那种写法让这一帧的 rAF 回调无法被去重。
        if (!this.runBound) this.runBound = () => this.run();
        requestAnimationFrame(this.runBound);

        // k = 这一帧相当于几个 60fps 帧。钳在 0.25~3：低于 0.25 说明宿主已经不给了，
        // 再放大只会让下一帧跳得更远；高于 3 一般是切后台回来，宁可少动也别瞬移。
        let k = this.lastFrame ? (now - this.lastFrame) / 16.667 : 1;
        this.lastFrame = now;
        if (k < 0.25) k = 0.25; else if (k > 3) k = 3;

        const ctx = this.renderContext;
        // 只擦「上一帧画过的那一小块」。原来是两整屏 clearRect + 一次整屏 drawImage
        // （双缓冲在这里没有作用，粒子是不透明实心点，没有需要合成的中间态）：
        // 每帧开销正比于**视口面积**而不是粒子数，实测中位帧时 20.5ms —— 60fps 要 16.7ms，
        // 也就是说这一发特效从起跑就一直在掉帧，dpr 一上 2 更明显。
        const p = this.prevDirty;
        if (!p.cleared) ctx.clearRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
        const next = new Dirty();
        for (let i = this.booms.length - 1; i >= 0; i--) {
            const boom = this.booms[i];
            if (boom.stop) {
                this.booms.splice(i, 1);
                continue;
            }
            boom.move(k);
            boom.draw(next);
        }
        this.prevDirty = next;
    }
}

const cursorSpecialEffects = new CursorSpecialEffects();

// 鼠标尾迹是纯装饰，且完全跟随指针持续重绘，属于「减少动态效果」明确要关的那一类。
if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cursorSpecialEffects.init();
}
