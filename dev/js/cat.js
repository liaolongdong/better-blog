/**
 * 左下角那只招财猫（样式与开关类名见 dev/sass/cat.scss）。
 *
 * 它有三个开关，从外到内：
 *   1. 构建期 site.showCat —— 关掉连这段 HTML 都不渲染，见 _layouts/default.html；
 *   2. 视口宽度 —— 窄屏不给它让位置；
 *   3. 用户自己收起过 —— 记在 localStorage 里，跨页生效。
 * 原来只有第 1 层和第 2 层那道 1500px 硬阈值，而且只在加载那一刻判一次：把窗口拉宽
 * 猫不会出来，想让它在窄一点屏幕上出现或者干脆消失，都没有出口。第 3 层就是那个出口，
 * 挂在猫身上的 .mao-toggle（收起后只剩耳朵尖，那颗扣子是唯一的恢复入口）。
 */
(function () {
    'use strict';

    // 低于这个宽度不给猫位置。1240 不是随手取的：`@media (max-width: 1239px)` 里
    // 左下角那颗「目录」浮标（.toc-fab，fixed bottom:20 left:16）就住在猫同一个角上，
    // 1024~1239 段实测两者叠在一起。再往下正文也贴着左边缘了。
    // 原来的 1500 是当初随手写的，比必要的门槛高出一大截。
    var MIN_W = 1240;
    var KEY = 'mao_tucked';

    var box = document.querySelector('.mao_box');
    if (!box) return;

    var toggle = box.querySelector('.mao-toggle');
    var pageRelPath = window.location.pathname.replace(window.SITE_BASEURL || '', '') || '/';
    // about 页那份排版是另一套（.p-about），猫会盖住时间线，这一条沿用原判断。
    var wanted = pageRelPath.indexOf('/about.html') === -1;
    var tucked = readTucked();
    // 这一页此刻是否真的看得见猫；视线跟随用它做短路，免得在 about 页和窄屏上
    // 白写样式。由 paint() 更新。
    var shown = false;
    // paint() 顺手刷新的半屏尺寸，供视线跟随换算归一化坐标（见下面的 mousemove）。
    var halfW = 1;
    var halfH = 1;

    /** @returns {boolean} 用户是否收起过；读不到就当作没有 */
    function readTucked() {
        try {
            return localStorage.getItem(KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    /**
     * 记住收放状态。
     * @param {boolean} on 收起为 true，放出为 false（false 时直接删键，不留默认值）
     */
    function writeTucked(on) {
        try {
            if (on) localStorage.setItem(KEY, '1');
            else localStorage.removeItem(KEY);
        } catch (e) {
            /* 隐私模式下 localStorage 会抛：这一页照样能收放，只是下次进来回到默认 */
        }
    }

    /**
     * 猫能占的那段视口宽度。口径与 editorial.js 的 fixedViewport() 一致：
     * fixed 浮层不含经典滚动条，用 window.innerWidth 会把阈值放宽那条滚动条的宽。
     * @returns {number}
     */
    function room() {
        return document.documentElement.clientWidth;
    }

    /** 宽度、about 页、用户偏好三者算出这一帧该是什么样子。 */
    function paint() {
        var w = room();
        shown = wanted && w >= MIN_W;
        halfW = w / 2;
        halfH = document.documentElement.clientHeight / 2;
        box.classList.toggle('is-on', shown);
        box.classList.toggle('is-tucked', shown && tucked);
        // 猫不在了，「手还放在它身上」这个状态就没有意义：收起 / 窄屏 / about 页
        // 这几种情况下盒子要么 pointer-events:none 要么整个不显，指针移开时不保证
        // 还收得到 pointerleave（样式改了命中测试，边界事件要等下一次指针真正动才补发）。
        // 不在这里复位的话，再放出猫来 mousemove 会一直命中 onCat 分支，
        // 视线永久居中，直到指针重新进出它一次才恢复。
        if (!shown || tucked) onCat = false;
        // 这里原先还往 body 上写一个 has-mao：左下角同一块地方钉着续读浮条 .resume，
        // 让位的那条规则要读它。浮条改成横向居中之后那条规则删了，这个标记也就没有读者
        // （全站 grep 只剩这一处写入）——判定收回来只喂 is-on / is-tucked 和下面的视线跟随。
        if (!toggle) return;
        var label = tucked ? '把小猫放出来' : '把小猫收起来';
        toggle.setAttribute('aria-expanded', shown && !tucked ? 'true' : 'false');
        toggle.setAttribute('aria-label', label);
        toggle.title = label;
    }

    if (toggle) {
        toggle.addEventListener('click', function () {
            tucked = !tucked;
            writeTucked(tucked);
            paint();
        });
    }

    // 拉窗口就重新判定。rAF 合帧，同阅读进度条那处的理由：resize 一帧能来好几次，
    // 而这里每次都要读 clientWidth（会触发布局）。
    var ticking = false;
    window.addEventListener('resize', function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
            ticking = false;
            paint();
        });
    }, { passive: true });

    // 视线跟随指针。--mx/--my 只写 -1~1 的归一化值，位移幅度留给 CSS 决定，
    // 这样「看多大一眼」改样式就行，不必回头动这段脚本。
    // 减弱动效下整个不挂：没有过渡的跟随会变成眼球抽搐。
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        var queued = false;
        // 两份数：lastX/lastY 是「已经写进 --mx/--my 的那一份」，nextX/nextY 是
        // 「最新想要的那一份」。分成两份是因为 rAF 只有一个在路上的名额——
        // 只用一份时，去重判定会在还没落笔之前就把目标值覆盖掉：指针刚进入猫身
        // 要写 (0,0)，可上一帧那个 (0.94,-0.87) 还排着队，于是这一句被丢掉、
        // lastX 却已经被改成 0，之后每次 look(0,0) 都被判定「没变化」而跳过，
        // 眼珠就永久钉在那个极值上——正是要避免的「像画坏了」那一幕。
        var lastX = 0;
        var lastY = 0;
        var nextX = 0;
        var nextY = 0;
        // 手已经放到猫身上了。这一段由 .mao_box 自己的 enter/leave 维护，
        // 不靠 mousemove 现量盒子（那等于每动一次强制一次布局计算）。
        var onCat = false;

        /**
         * 要一次视线值；变化不到半个视口就跳过。
         * @param {number} mx -1~1
         * @param {number} my -1~1
         */
        function look(mx, my) {
            var same = Math.abs(mx - lastX) < 0.02 && Math.abs(my - lastY) < 0.02;
            // 与已写入的一致、且没有待落笔的那一帧 —— 什么都不用做
            if (same && !queued) return;
            nextX = mx;
            nextY = my;
            // 有一帧在路上了：它落笔时读的就是上面这份 next，不再另开一帧
            if (queued) return;
            queued = true;
            window.requestAnimationFrame(function () {
                queued = false;
                lastX = nextX;
                lastY = nextY;
                box.style.setProperty('--mx', String(lastX));
                box.style.setProperty('--my', String(lastY));
            });
        }

        document.addEventListener('mousemove', function (e) {
            if (!shown || tucked) return;
            // 手在猫身上时「往指针方向看」是不成立的：指针就在它头顶那一片里，
            // 归一化值会顶到 ±1 附近，两颗眼珠斜到底、定在那儿不动，读起来像画坏了。
            // 这时把视线收回正中——「你摸到我了我才看向你」，比死盯屏幕一角像活物。
            if (onCat) { look(0, 0); return; }
            // 半屏尺寸用 paint() 里缓存的那份：在这里现读 clientWidth/clientHeight，
            // 等于鼠标每动一次就强制重算一次布局。
            look(clamp(e.clientX / halfW - 1), clamp(e.clientY / halfH - 1));
        }, { passive: true });

        // pointerenter/leave 而不是 mouseover/out：前者不冒泡，从猫的一层子元素
        // 走到另一层不会先「离开」再「进入」，onCat 不会抖。
        box.addEventListener('pointerenter', function () {
            if (!shown || tucked) return;
            onCat = true;
            look(0, 0);
        }, { passive: true });
        box.addEventListener('pointerleave', function () { onCat = false; }, { passive: true });
    }

    /** @param {number} v @returns {number} 夹到 -1~1 */
    function clamp(v) {
        return v < -1 ? -1 : v > 1 ? 1 : v;
    }

    paint();
})();
