/*
 * 点击处的粒子尾迹（动效批 II · D 组改过三处，理由见各自的位置）：
 *   · 颜色从主题令牌 --signal 取，不再是随机浅灰（见 signalRgb / Circle.draw）；
 *   · 半径随机 1.5~3，给一点点景深（见 Circle.draw）；
 *   · 视口尺寸跟随 resize（见 CursorSpecialEffects.handleResize）。
 * 减少动态效果的闸门在文件末尾，那一条没动。
 */

/**
 * 主题信号色的 RGB 分量缓存。
 *
 * 每次点击都要拿它算一次粒子色，但 getComputedStyle 会强制样式重算，
 * 不该跟着 mousedown 走。所以只在「读不到」和「根元素 class 变了」两种时候刷新：
 * --signal 在 body.night-mode / html.night-mode 下是另一个值（tokens.scss:160），
 * 切主题不重新读，夜间模式的粒子会一整晚继续用白昼那支饱和蓝。
 */
var signalCache = null;

/** @returns {{r: number, g: number, b: number}} 解析失败时退回 #0F62FE */
function signalRgb() {
    if (signalCache) return signalCache;
    var raw = '';
    if (window.getComputedStyle) {
        raw = getComputedStyle(document.documentElement).getPropertyValue('--signal').trim();
    }
    signalCache = /^#([0-9a-f]{6})$/i.test(raw)
        ? {
            r: parseInt(RegExp.$1.substr(0, 2), 16),
            g: parseInt(RegExp.$1.substr(2, 2), 16),
            b: parseInt(RegExp.$1.substr(4, 2), 16)
        }
        : { r: 15, g: 98, b: 254 };
    return signalCache;
}

// 主题切换（含纸色）都会动根元素的 class，这是最省事且不会漏的失效信号。
if (window.MutationObserver) {
    new MutationObserver(function () { signalCache = null; })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
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
     * 一颗粒子的填充色：主题信号色本体，往上提一点亮度、随机给一点透明度。
     *
     * 换掉原来的 randomColor() 是必需的而不是审美偏好——那版在每个通道上从
     * 8~F 里随机取一位十六进制，结果永远落在 #888 以上，等于只在夜间看得见、
     * 白昼这张纸上点一下等于什么都没发生。现在两支主题色都能站上对比度，
     * 且粒子中「全站唯一的饱和色」这一族（刊头信号线、当前栏目墨线、链接下划线）。
     * 提亮只往白色方向混，不改变色相，所以它仍然读作「那一支蓝」。
     * @returns {string} rgba() 串
     */
    pickColor() {
        const s = signalRgb();
        const lift = this.randomRange(0, .34);
        const to255 = (v) => Math.round(v + (255 - v) * lift);
        return 'rgba(' + to255(s.r) + ',' + to255(s.g) + ',' + to255(s.b) + ',' +
            this.randomRange(.5, .92).toFixed(2) + ')';
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
