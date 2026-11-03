/*!
 * 转化漏斗埋点：记录「页面被打开 → 商店按钮进入视野 → 点击」三段，上报到本站自己的
 * Cloudflare Worker（Workers Analytics Engine），无 Cookie、无用户标识、无第三方域。
 *
 * 为什么要这一本：站内此前**没有任何事件埋点**——全仓 grep `sendBeacon|dataLayer|gtag|
 * _trackEvent|plausible|umami` 在 dev/ 与 _includes/ 里 0 命中，只有 Cloudflare beacon 的
 * 页面级 PV（`_includes/cloudflareAnalytics.html`）、busuanzi 的站级 PV/UV 与 Waline 的单篇
 * 阅读量。于是这三类问题一个都答不了：/tools.html 的 hub 卡、/extensions/<slug>.html 指南页、
 * 文章末产品卡这三种投放位哪个带来安装、多少人点了却没装、第 5 个工具值不值得开一页。
 * 商店链接上那串 utm_* 帮不上忙——`chromewebstore.google.com` 不消费查询参数，本站这头也没人记录点击。
 *
 * 为什么不用 Cloudflare Web Analytics 的自定义事件：官方 FAQ 写明不支持自报端点
 * （"all requests should originate from our beacon JavaScript"），这条路是死的。
 *
 * 为什么单独成件而不是塞 editorial.js：那一件被 check-sw.mjs 卡在 17,408B gzip（实测 15,741B，
 * 余量 1,667B），而且它的注册面判据把断言锚在产物字节偏移 ±300 的窗口上。本件只在**带 CTA 的页面**
 * 由模板发标签，非 CTA 页面一分钱不花，也不占那条上限。
 *
 * 隐私边界（写在这里，也写在 scripts/funnel-worker/README.md）：
 *   · 不发 Cookie、不发 localStorage/sessionStorage 里的任何东西、没有访客 ID，
 *     所以拿到的是**计数**而不是**个体轨迹**——算得出曝光→点击率，认不出某一个人；
 *   · 不发查询串与锚点：路径只取 location.pathname，站内搜索词因此不会被顺带送出去；
 *   · 不发 Referer：fetch 与 Image 两条路都显式写 referrerPolicy: 'no-referrer'。默认的
 *     strict-origin-when-cross-origin 会把**本站 origin** 发给接收端（2026-11-02 真浏览器实测），
 *     所以这一条靠策略撑着，不靠「反正只发 origin」撑着；
 *   · 尊重 doNotTrack 与 globalPrivacyControl：命中就整件不启动，读数按设计偏低；
 *   · 只在生产构建里由模板发标签（与 cloudflareAnalytics 同一条理由：本地不该计入统计）。
 *
 * 兼容：不依赖 IntersectionObserver 之外的新 API。没有 IO 的浏览器仍然记 view 与 click，
 * 只是记不到 impression——那在面板上是 view 远大于 impression 的形状，而不是一个假装正常的数。
 */
(function () {
    'use strict';

    var ATTR = 'data-funnel';
    var MIN_RATIO = 0.35;

    /** 取自身脚本标签上的配置：地址空 = 整件不启动（配置还没填时的形状与「关掉」一致） */
    function config() {
        var el = document.currentScript;
        if (!el) {
            var all = document.getElementsByTagName('script');
            for (var i = all.length - 1; i >= 0; i--) {
                if (all[i].getAttribute('data-funnel-endpoint')) { el = all[i]; break; }
            }
        }
        return {
            endpoint: el ? (el.getAttribute('data-funnel-endpoint') || '') : '',
            version: el ? (el.getAttribute('data-funnel-version') || '1') : '1'
        };
    }

    var CFG = config();
    if (!CFG.endpoint) return;

    var dnt = navigator.doNotTrack || window.doNotTrack || '';
    if (dnt === '1' || dnt === 'yes' || navigator.globalPrivacyControl === true) return;

    var pagePath = location.pathname || '/';

    /**
     * 上报两件事分开看：
     *   · 商店 / 仓库 / 演示三类是 target="_blank"，当前文档不会被卸载，普通 GET 就够；
     *   · 「使用指南」那一类是同标签跳转，文档会当场死掉——所以走 fetch(keepalive: true)，
     *     它正是为「页面已经走了还要送一发」设计的（上限 64KB，这一发不到 200B）。
     * 不用 sendBeacon：那是 POST，跨域会先撞 CORS 预检，为一条计数不值当。
     * kind 是 data-funnel 的第一段（store / demo / repo / guide / review）。少了它，同一投放位上
     * 「商店安装」「开源仓库」「使用指南」会混成面板里同一行——2026-10-28 真浏览器实测到的正是这一形：
     * 一次 scrollIntoView 打出四枚 impression，参数逐字相同，因为区分它们的那一段根本没被发出去。
     */
    function send(name, kind, placement, slug) {
        // 分隔符按 endpoint 现算：写死 `?` 的话，地址一旦自带查询串（`/e?t=1`）两个都会断。
        // 参数名保持 `?x=` / `&x=` 的字面形状——check-seo 的参数契约判据是从这里取的键名。
        var sep = CFG.endpoint.indexOf('?') >= 0 ? '&' : '?';
        var qs = sep + 'e=' + encodeURIComponent(name)
            + '&k=' + encodeURIComponent(kind || '-')
            + '&p=' + encodeURIComponent(placement || '-')
            + '&s=' + encodeURIComponent(slug || '-')
            + '&u=' + encodeURIComponent(pagePath)
            + '&v=' + encodeURIComponent(CFG.version);
        var url = CFG.endpoint + qs;
        try {
            if (window.fetch) {
                // referrerPolicy 必须显式写：默认策略是 strict-origin-when-cross-origin，
                // 跨源那一发会把**本站 origin** 带出去（2026-11-02 真浏览器实测：接收端日志里
                // referer = 本站 origin）。件头与 README 承诺的是「地址栏的东西不出页面」。
                fetch(url, { keepalive: true, mode: 'no-cors', cache: 'no-store', referrerPolicy: 'no-referrer' });
            } else {
                var img = new Image(1, 1);
                if ('referrerPolicy' in img) img.referrerPolicy = 'no-referrer';
                img.src = url;
            }
        } catch (err) {
            /* 埋点失败不该有任何可见后果：这里刻意不 console——它在每页每次点击上跑，
               一行噪音会把「漏斗没数」变成「控制台很吵」，两件事都更难查。 */
        }
    }

    /* 刻意不导出 window.BBFunnel：全站零调用方，而它是这 13 个页面上一个「任何人都能拿来
       发一发上报」的全局。将来真需要脚本化上报，再按调用方需要的最小形状加回来——
       现在加着只是让每一件都多带一段没人跑过的字节，而没跑过的代码不叫能力，叫债。 */

    function nodes(selector) {
        var list = document.querySelectorAll(selector), out = [];
        for (var i = 0; i < list.length; i++) out.push(list[i]);
        return out;
    }

    var cta = nodes('[' + ATTR + ']');

    /** 三段漏斗的分母：这一页打开了，且它确实带着至少一枚 CTA */
    if (cta.length) {
        var v0 = String(cta[0].getAttribute(ATTR)).split(':');
        send('view', v0[0], 'page', v0[2]);
    }

    /* ── 点击 ───────────────────────────────────────────────────────────────
       capture 阶段听 click：不 preventDefault、不改用户的跳转时机。
       只记 data-funnel 那一枚自己，冒泡到祖先的复合卡片不重复计。 */
    document.addEventListener('click', function (ev) {
        var t = ev.target;
        while (t && t !== document) {
            if (t.getAttribute && t.getAttribute(ATTR)) {
                var parts = String(t.getAttribute(ATTR)).split(':');
                send('click', parts[0], parts[1], parts[2]);
                return;
            }
            t = t.parentNode;
        }
    }, true);

    /* ── 曝光 ───────────────────────────────────────────────────────────────
       「按钮进了视野」和「这一页被打开」是两件事：文章末的产品卡在很多篇里落在
       正文很深的位置，用 PV 当分母会系统性低估卡片的可读性，也会把「换投放位」这件事
       判成没用。所以用 IntersectionObserver 单记一次，同一枚不重复计。 */
    if (!window.IntersectionObserver) return;

    var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
            var en = entries[i];
            if (!en.isIntersecting || en.intersectionRatio < MIN_RATIO) continue;
            io.unobserve(en.target);
            var parts = String(en.target.getAttribute(ATTR)).split(':');
            send('impression', parts[0], parts[1], parts[2]);
        }
    }, { threshold: [MIN_RATIO] });

    for (var j = 0; j < cta.length; j++) io.observe(cta[j]);
})();
