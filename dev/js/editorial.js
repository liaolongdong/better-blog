/**
 * 阅读体验增强脚本：目录、阅读进度、代码块复制、全站命令面板。
 *
 * 与 index.js（jQuery 时代的导航/分页逻辑）分开维护：这里一律用原生 DOM API，
 * 目的是让新增交互不依赖 jQuery 的加载顺序，也不再把 index.js 撑成巨型文件。
 * 每个能力都先做存在性探测，因此该文件可在任意页面（首页、文章页、工具页）引入。
 */
(function () {
    'use strict';

    var BASE_URL = window.SITE_BASEURL || '';

    // search.json 的共享缓存，见 getCorpus()
    var corpusCache = null;
    var corpusLoading = null;

    /**
     * 是否开启了「减少动态效果」。平滑滚动属于可关闭的装饰性动效。
     * @returns {boolean}
     */
    function prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /**
     * fixed 浮层可用的视口尺寸，用于把浮层钳回可视区。
     *
     * 口径与 realtime-draggable.js 的 viewport() 一致：fixed 能占的那一段不含经典滚动条，
     * 按 window.innerWidth/innerHeight 钳右/钳下会把浮层推出可视区，差值恰是那条滚动条的宽。
     * overlay 滚动条（移动端与 macOS 默认）下两值恒等，所以这条只影响 Windows / Linux 桌面
     * 和带常驻滚动条的触屏。两个文件各自打包、没有共享模块层，因此宁可各留一份也不抽公共库。
     *
     * 判「用户能看见多宽」或与媒体查询同基的地方不适用，那里 innerWidth 才是对的。
     * @returns {{w: number, h: number}} 可视宽与高（px）
     */
    function fixedViewport() {
        var de = document.documentElement;
        return { w: de.clientWidth, h: de.clientHeight };
    }

    /* ------------------------------------------------------------------
     * 0. 主题（白昼 / 夜间）
     * ------------------------------------------------------------------ */

    // 与 bottomFixedBtn.js 共用的旧键名，历史选择不会被丢弃。
    // 键缺失 = 用户没表过态 = 跟随系统；点过切换按钮后固定为其所选，不再跟随。
    var THEME_KEY = 'daytimeMode';

    function themeSwitchOn() {
        var sw = document.getElementById('nm-switch');
        return !!sw && sw.value === 'true';
    }

    function systemPrefersDark() {
        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    function storedTheme() {
        try {
            var v = localStorage.getItem(THEME_KEY);
            return (v === 'day' || v === 'night') ? v : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * 当前生效的模式。
     * @returns {'day'|'night'}
     */
    function currentTheme() {
        return storedTheme() || (systemPrefersDark() ? 'night' : 'day');
    }

    function applyTheme(mode) {
        if (!themeSwitchOn()) return;
        var night = mode === 'night';
        // <html> 上的标记由 _includes/themeBootstrap.html 的内联脚本先写好（避免白闪），
        // 这里把两边一起对齐，切换按钮只改 body 也不会和 <html> 脱节。
        var html = document.documentElement;
        if (night) {
            html.classList.add('night-mode');
            document.body.classList.add('night-mode');
        } else {
            html.classList.remove('night-mode');
            document.body.classList.remove('night-mode');
        }
    }

    /** setTheme 的每一处界面跟随者（§11 阅读设置面板是目前的唯一一个）。 */
    var themeWatchers = [];

    /**
     * 订阅主题变化。setTheme 是唯一的写入口（右下角那颗也走 window.EditorialTheme.set），
     * 所以「界面要跟着主题重刷」这件事只有这一个触发点。
     * @param {function()} fn
     */
    function onThemeChange(fn) {
        themeWatchers.push(fn);
    }

    /**
     * 设定模式；传 'auto' 交还给系统偏好。
     * @param {'day'|'night'|'auto'} mode
     */
    function setTheme(mode) {
        try {
            if (mode === 'auto') localStorage.removeItem(THEME_KEY);
            else localStorage.setItem(THEME_KEY, mode);
        } catch (e) {
            /* 隐私模式下 localStorage 会抛，主题仍然当场生效，只是下次进来回到 auto */
        }
        withEclipse(function () {
            applyTheme(mode === 'auto' ? currentTheme() : mode);
            for (var w = 0; w < themeWatchers.length; w++) themeWatchers[w]();
        });
    }

    /**
     * 页面「可见时长」。§14 记账与 §15 的篇末用时共用这一份，
     * 否则同一件事要在两处各自累计，切后台的扣减逻辑也会写两遍。
     */
    var dwell = { last: Date.now(), ms: 0 };

    function dwellTick() {
        var now = Date.now();
        if (document.visibilityState !== 'hidden') dwell.ms += now - dwell.last;
        dwell.last = now;
    }

    /**
     * @returns {number} 从打开这一页起、处于可见状态的累计毫秒数
     */
    function visibleMs() {
        dwellTick();
        return dwell.ms;
    }

    /* 最近一次真实点击的位置，用于判断主题切换是不是「用户主动按的」。 */
    var lastPress = { x: 0, y: 0, at: 0 };

    /* 日蚀转场的序号：连点两次时只有最后一次的收尾有权摘掉 .vt-eclipse。 */
    var eclipseSeq = 0;

    /**
     * 把一次 DOM 改动包成「从点击处扩散」的日蚀转场。
     *
     * 跨页跳转已经在用 @view-transition，同页切主题却只是 0.3s 变色，白瞎了
     * 全站令牌化这件事的存在感。这里给 <html> 临时挂上 .vt-eclipse，
     * editorial.scss §7.16 按这个类分派动画，跨页那套淡入淡出不受影响。
     * 不支持 startViewTransition 或开了「减少动态效果」时直接改 DOM，行为同一前。
     * @param {Function} mutate 真正改 DOM 的回调
     */
    function withEclipse(mutate) {
        if (!document.startViewTransition || prefersReducedMotion()) { mutate(); return; }
        // 系统偏好自动翻色时没有指针位置，不该从屏幕某个角落凭空扩出一个圆。
        if (Date.now() - lastPress.at > 800) { mutate(); return; }
        var x = lastPress.x;
        var y = lastPress.y;
        var radius = Math.ceil(Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)));
        var root = document.documentElement;
        root.style.setProperty('--vt-x', x + 'px');
        root.style.setProperty('--vt-y', y + 'px');
        root.style.setProperty('--vt-r', radius + 'px');
        var mine = ++eclipseSeq;
        root.classList.add('vt-eclipse');
        var done = function () {
            if (mine === eclipseSeq) root.classList.remove('vt-eclipse');
        };
        document.startViewTransition(mutate).finished.then(done, done);
    }

    // 捕获阶段记录，避免按钮上的 stopPropagation 让这里收不到。
    document.addEventListener('pointerdown', function (e) {
        lastPress.x = e.clientX;
        lastPress.y = e.clientY;
        lastPress.at = Date.now();
    }, true);

    function initTheme() {
        applyTheme(currentTheme());
        if (!window.matchMedia) return;

        var mq = window.matchMedia('(prefers-color-scheme: dark)');
        var onChange = function () {
            if (!storedTheme()) applyTheme(currentTheme());
        };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
    }

    window.EditorialTheme = {
        get: currentTheme,
        set: setTheme,
        /** @returns {boolean} 用户是否显式选过模式 */
        hasUserChoice: function () { return storedTheme() !== null; }
    };

    /* ------------------------------------------------------------------
     * 1. 文章目录（TOC）
     * ------------------------------------------------------------------ */

    /**
     * 从正文 h2/h3 构建右侧粘性目录。
     *
     * 少于 2 个章节时不生成——两三千字的短文加一栏目录只会挤占正文宽度，
     * 不如留给阅读进度条。
     */
    function initToc() {
        var body = document.getElementById('post-body');
        var list = document.getElementById('toc-list');
        if (!body || !list) return;

        var headings = body.querySelectorAll('h2, h3');
        if (headings.length < 2) return;

        var items = [];
        for (var i = 0; i < headings.length; i++) {
            var heading = headings[i];
            if (!heading.id) {
                heading.id = 'section-' + (i + 1);
            }
            var li = document.createElement('li');
            li.className = 'toc-item toc-' + heading.tagName.toLowerCase();
            // 序号交给 CSS §M6 的错峰延迟用；目录行只在这里构建一次，之后不再重建，
            // 所以下面那次 is-fresh 挂上就不必再摘。
            li.style.setProperty('--i', i);
            var link = document.createElement('a');
            link.className = 'toc-link';
            link.href = '#' + heading.id;
            link.textContent = heading.textContent.trim();
            li.appendChild(link);
            list.appendChild(li);
            items.push({ heading: heading, link: link });
        }

        document.body.className += ' has-toc';

        // 桌面栏和窄屏抽屉是同一份 DOM：加载时这一批错峰涌出只有桌面看得到，
        // 窄屏那一次留给抽屉自己的滑入动效，不叠第二层。
        var rail = list.closest('.post-rail');
        if (rail) rail.classList.add('is-fresh');

        // 贴在目录左竖线上的「读到第几节」进度线，高度随 activate() 更新。
        var progress = document.createElement('span');
        progress.className = 'toc-progress';
        progress.setAttribute('aria-hidden', 'true');
        list.appendChild(progress);

        var current = null;
        /** 高亮切换集中在一处，避免 observer 与滚动兜底互相抢状态。 */
        function activate(item) {
            if (!item || current === item) return;
            if (current) current.link.parentNode.classList.remove('is-active');
            current = item;
            item.link.parentNode.classList.add('is-active');
            var li = item.link.parentNode;
            progress.style.height = Math.max(0, li.offsetTop + li.offsetHeight / 2) + 'px';
        }

        if ('IntersectionObserver' in window) {
            // 只观察「进入视口上沿 20% 区域」的标题：rootMargin 把有效区间
            // 压成顶部一条窄带，这样高亮跟随的是正在读的小节，而不是屏幕中部的任意标题。
            var observer = new IntersectionObserver(function (entries) {
                for (var j = 0; j < entries.length; j++) {
                    if (entries[j].isIntersecting) {
                        for (var k = 0; k < items.length; k++) {
                            if (items[k].heading === entries[j].target) activate(items[k]);
                        }
                    }
                }
            }, { rootMargin: '-80px 0px -70% 0px', threshold: 0 });
            for (var m = 0; m < items.length; m++) observer.observe(items[m].heading);
        }

        // 兜底：快速滚动或长小节（无标题进入窄带）时，取视口上方最后一个标题。
        var ticking = false;
        window.addEventListener('scroll', function () {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(function () {
                ticking = false;
                var line = 96;
                var pick = null;
                for (var n = 0; n < items.length; n++) {
                    if (items[n].heading.getBoundingClientRect().top <= line) pick = items[n];
                }
                activate(pick || items[0]);
            });
        }, { passive: true });

        activate(items[0]);
    }

    /**
     * 窄屏目录抽屉：<1240px 时正文字栏和目录栏并排放不下，右侧栏位整栏隐藏，
     * 目录于是彻底消失。这里让左下角那颗「目录」按钮把它换成底部抽屉。
     *
     * 复用 initToc 建好的同一份列表与同一套高亮状态，避免为窄屏再写一套目录；
     * 因此必须在 initToc 之后调用（.toc-link 那时才存在）。
     */
    function initTocDrawer() {
        var fab = document.querySelector('.toc-fab');
        var rail = document.getElementById('post-rail');
        if (!fab || !rail || !document.body.classList.contains('has-toc')) return;

        function isOpen() {
            return document.body.classList.contains('toc-open');
        }
        /**
         * @param {boolean} restore 关掉后要不要把焦点接回那颗按钮。
         *   抽屉关掉时 .post-rail 回到 display:none，落在里面的焦点会被清零、
         *   掉回 <body>，下一次 Tab 从文档开头重新数 —— 那是把键盘用户扔回页首。
         *   只在焦点确实还留在抽屉里时接管：鼠标点遮罩那次不抢焦点。
         */
        function close(restore) {
            if (!isOpen()) return;
            document.body.classList.remove('toc-open');
            fab.setAttribute('aria-expanded', 'false');
            if (restore && rail.contains(document.activeElement)) fab.focus();
        }
        /**
         * 跳去某条目录项对应的小节：焦点交给标题，而不是弹回按钮。
         * 这里既不能 restore=true（人已经不在目录上了），也不能什么都不做
         * （实测那样焦点会掉成 <body>，下一次 Tab 从文档开头重数）。
         * 标题本身不可聚焦，按站内锚点的通行做法临时补一个 tabindex="-1"。
         * preventScroll：滚动是 <a href="#id"> 的默认动作，焦点只负责认领位置。
         */
        function jumpToSection(link) {
            close(false);
            var id = (link.getAttribute('href') || '').slice(1);
            var heading = id && document.getElementById(id);
            if (!heading) return;
            heading.setAttribute('tabindex', '-1');
            heading.focus({ preventScroll: true });
        }
        function toggle() {
            if (isOpen()) { close(true); return; }
            document.body.classList.add('toc-open');
            fab.setAttribute('aria-expanded', 'true');
        }

        fab.addEventListener('click', toggle);
        // 遮罩、关闭按钮、每条目录项都指向同一个关闭动作：点完目录应该立刻看到正文。
        // 两类的前景不一样，所以分开绑：目录项是「跳走」，其余是「关掉后回到按钮」。
        var closers = document.querySelectorAll('[data-toc-close]');
        for (var i = 0; i < closers.length; i++) closers[i].addEventListener('click', function () { close(true); });
        var links = document.querySelectorAll('.toc-link');
        for (var j = 0; j < links.length; j++) links[j].addEventListener('click', function (e) {
            jumpToSection(e.currentTarget || e.target);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') close(true);
        });

        // 抽屉打开时正文是锁滚的；窗口拉宽后目录回到右侧栏位，不收掉就留下一屏滚不动的正文。
        // 这条路径不还原焦点：栏位在宽屏下本来就看得见，焦点没丢。
        var mq = window.matchMedia('(max-width: 1239px)');
        var onViewport = function (e) { if (!e.matches) close(false); };
        if (mq.addEventListener) mq.addEventListener('change', onViewport);
        else if (mq.addListener) mq.addListener(onViewport);
    }

    /* ------------------------------------------------------------------
     * 2. 阅读进度条
     * ------------------------------------------------------------------ */

    /**
     * 当前阅读进度，进度条与续读记录共用同一口径。
     * @returns {number} 0~1
     */
    function readRatio() {
        var doc = document.documentElement;
        var scrollable = doc.scrollHeight - window.innerHeight;
        return scrollable > 0 ? Math.min(Math.max(doc.scrollTop / scrollable, 0), 1) : 0;
    }

    /**
     * 中文阅读速度，单位「字/分钟」。
     *
     * 这个数字不是估的：post.html 页头那行「约 N 字 · M 分钟」
     * 用的就是 `{{ chars | plus: 399 | divided_by: 400 }}`，即 ceil(chars / 400)。
     * 进度条末端的气泡必须跟它同一个口径，否则页头写「17 分钟」、
     * 滚到一半气泡却说「还剩 9 分钟」，同一页两套数字互相拆台。
     * 改这一处必须同时改 post.html 那一行。
     * @type {number}
     */
    var CHARS_PER_MIN = 400;

    function initReadingProgress() {
        var rail = document.querySelector('.reading-progress');
        var bar = rail && rail.querySelector('.reading-progress-bar');
        if (!bar) return;

        var body = document.getElementById('post-body');
        var chars = (body && parseInt(body.getAttribute('data-chars'), 10)) || 0;
        var eta = null;
        var lastMin = -1;
        if (chars > 0) {
            eta = document.createElement('span');
            eta.className = 'reading-progress-eta';
            rail.appendChild(eta);
        }

        var ticking = false;
        function update() {
            ticking = false;
            var p = readRatio();
            // 进度只写这一个自定义属性：细条的 scaleX 与气泡的 left 都读它（见
            // editorial.scss §10 M7）。此前是 bar.style.transform，那样气泡无从复用
            // 同一个数，两处各算各的必然错位。
            rail.style.setProperty('--rp-p', p);
            if (!eta) return;

            var done = p <= 0.02 || p >= 0.98;
            eta.classList.toggle('is-edge', done);
            eta.classList.add('is-on');
            if (done) return;

            // 与页头同式：ceil(剩余字数 / 400)，起手时它必须等于页头那个数
            var min = Math.ceil(chars * (1 - p) / CHARS_PER_MIN);
            if (min === lastMin) return;
            lastMin = min;
            eta.textContent = '还剩约 ' + min + ' 分钟';
        }
        function onScroll() {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(update);
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        update();
    }

    /* ------------------------------------------------------------------
     * 3. 代码块一键复制
     * ------------------------------------------------------------------ */

    /**
     * 复制文本。
     * @param {string} text 待复制内容
     * @returns {Promise<boolean>} 是否成功
     */
    function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).then(function () { return true; }, fallback);
        }
        return Promise.resolve(fallback());

        function fallback() {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'absolute';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
            document.body.removeChild(ta);
            return ok;
        }
    }

    function initCodeCopy() {
        var body = document.getElementById('post-body');
        if (!body) return;

        var blocks = body.querySelectorAll('pre');
        for (var i = 0; i < blocks.length; i++) {
            (function (pre) {
                if (pre.parentNode.classList.contains('code-wrap')) return;

                var holder = document.createElement('div');
                holder.className = 'code-wrap';
                pre.parentNode.insertBefore(holder, pre);
                holder.appendChild(pre);

                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'code-copy';
                btn.textContent = '复制';
                btn.addEventListener('click', function () {
                    copyText(pre.textContent.replace(/\n+$/, '')).then(function (ok) {
                        btn.textContent = ok ? '已复制' : '复制失败';
                        btn.classList.add('is-done');
                        window.setTimeout(function () {
                            btn.textContent = '复制';
                            btn.classList.remove('is-done');
                        }, 1600);
                    });
                });
                holder.appendChild(btn);
            })(blocks[i]);
        }
    }

    /**
     * 检索语料（search.json）：命令面板与链接预览共用同一份，
     * 前者按输入词打分，后者按 url 取标题与摘要，都是首次用到才拉。
     * @returns {Promise<Array>}
     */
    function getCorpus() {
        if (corpusCache) return Promise.resolve(corpusCache);
        if (!corpusLoading) {
            corpusLoading = fetch(BASE_URL + '/search.json')
                .then(function (res) { return res.json(); })
                .then(function (data) { corpusCache = data; return data; })
                .catch(function () { corpusLoading = null; return []; });
        }
        return corpusLoading;
    }

    /**
     * 转义 HTML。查询词、链接文本与摘要都来自数据或用户，必须按文本处理。
     * @param {string} str
     * @returns {string}
     */
    function esc(str) {
        return String(str).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    /* ------------------------------------------------------------------
     * 4. 全站搜索命令面板
     * ------------------------------------------------------------------ */

    function initPalette() {
        var panel = document.getElementById('cmdk');
        if (!panel) return;

        var input = document.getElementById('cmdk-input');
        var results = document.getElementById('cmdk-results');
        var count = document.getElementById('cmdk-count');
        var empty = document.getElementById('cmdk-empty');
        var emptyLead = document.getElementById('cmdk-empty-lead');
        var emptySub = document.getElementById('cmdk-empty-sub');
        // 零结果时要展示 header 模板里那份带「分类/标签」链接的提示，
        // 它会被 innerHTML 覆写，所以先把初始内容存下来。
        var defaultSub = emptySub.innerHTML;
        var lastTrigger = null;
        var activeIndex = -1;
        var matches = [];
        var seq = 0;
        // 错峰入场的开关挂在 .cmdk-panel 上（CSS §M6 的选择器就是它），不是外层 #cmdk：
        // 外层还管遮罩，把它一起淡入会连背景一起闪。
        var panelBox = panel.querySelector('.cmdk-panel');
        // 「这一次渲染是不是面板刚打开」——只有这一次给行挂入场动画，
        // 之后每敲一个字的重绘都直接出结果，否则打字看着像在闪。
        var freshNext = false;

        function open(trigger) {
            lastTrigger = trigger || null;
            panel.hidden = false;
            document.body.classList.add('cmdk-open');
            input.value = '';
            freshNext = true;
            window.setTimeout(function () { input.focus(); }, 0);
            render('');
        }

        function close() {
            panel.hidden = true;
            document.body.classList.remove('cmdk-open');
            if (lastTrigger) lastTrigger.focus();
        }

        /**
         * 给单条结果打分：标题命中权重最高，其次标签、分类、摘要。
         * @param {Object} item 检索条目
         * @param {string} q 已小写化的查询词
         * @returns {{score: number, hits: number[]}} score 为 0 表示不匹配
         */
        function score(item, q) {
            var fields = [item.title || '', item.tags || '', item.category || '', item.excerpt || ''];
            var weights = [100, 40, 20, 8];
            var total = 0;
            var hits = [];
            for (var i = 0; i < fields.length; i++) {
                var idx = fields[i].toLowerCase().indexOf(q);
                if (idx >= 0) {
                    total += weights[i] - Math.min(idx, weights[i] - 1);
                    hits.push(i);
                }
            }
            return { score: total, hits: hits };
        }

        /** 用 <mark> 包住第一个命中片段，帮助用户确认「为什么这条被搜到」。 */
        function mark(text, q) {
            var idx = text.toLowerCase().indexOf(q);
            if (idx < 0) return esc(text);
            return esc(text.slice(0, idx)) + '<mark>' + esc(text.slice(idx, idx + q.length)) + '</mark>' + esc(text.slice(idx + q.length));
        }

        function setActive(next) {
            if (!matches.length) return;
            activeIndex = (next + matches.length) % matches.length;
            var children = results.children;
            for (var i = 0; i < children.length; i++) {
                var on = i === activeIndex;
                children[i].classList.toggle('is-active', on);
                children[i].setAttribute('aria-selected', on ? 'true' : 'false');
            }
            input.setAttribute('aria-activedescendant', children[activeIndex].id);
            children[activeIndex].scrollIntoView({ block: 'nearest' });
        }

        /** 空查询与零结果共用同一个占位块，但文案语义不同，分别切换。 */
        function showEmpty(lead, sub) {
            empty.hidden = false;
            emptyLead.textContent = lead;
            emptySub.innerHTML = sub;
        }

        function render(query) {
            var token = ++seq;
            var q = query.trim().toLowerCase();
            if (!q) {
                results.innerHTML = '';
                matches = [];
                activeIndex = -1;
                input.removeAttribute('aria-activedescendant');
                count.textContent = '';
                showEmpty('输入关键词开始搜索', '↑ ↓ 选择条目，Enter 打开文章');
                return;
            }
            getCorpus().then(function (data) {
                // 连续输入会让多次检索并发返回；只渲染最后一次查询的结果，
                // 否则慢响应可能覆盖快响应，出现「输入 b 却显示 a 的结果」。
                if (token !== seq) return;
                var scored = [];
                for (var i = 0; i < data.length; i++) {
                    var s = score(data[i], q);
                    if (s.score > 0) scored.push({ item: data[i], hits: s.hits, score: s.score });
                }
                scored.sort(function (a, b) { return b.score - a.score; });
                scored = scored.slice(0, 20);

                matches = scored;
                activeIndex = scored.length ? 0 : -1;
                count.textContent = scored.length ? scored.length + ' 条结果' : '';
                if (scored.length) empty.hidden = true;
                else showEmpty('没有匹配的文章', defaultSub);

                results.innerHTML = scored.map(function (row, idx) {
                    var item = row.item;
                    var snippet = row.hits.indexOf(3) >= 0 ? (item.excerpt || '') : (item.title || '');
                    var meta = [];
                    if (item.date) meta.push(esc(item.date));
                    if (item.category) meta.push(esc(item.category));
                    if (item.tags) meta.push(esc(item.tags.split(/\s+/).filter(Boolean).slice(0, 2).join(' · ')));
                    return '<li id="cmdk-opt-' + idx + '" class="cmdk-item" role="option" aria-selected="' + (idx === 0 ? 'true' : 'false') + '" style="--i: ' + idx + '">'
                        + '<a class="cmdk-item-link" href="' + esc(BASE_URL + item.url) + '">'
                        + '<span class="cmdk-item-title">' + mark(item.title || '', q) + '</span>'
                        + '<span class="cmdk-item-snippet">' + mark(snippet.slice(0, 90), q) + '</span>'
                        + '<span class="cmdk-item-meta">' + meta.map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</span>'
                        + '</a></li>';
                }).join('');

                // 每一次渲染都重新裁决这个开关：挂上则这批行按 --i 错峰涌出，
                // 摘掉则这批行直接落位。行是每次新建的，所以不需要强制重排来重启动画。
                if (panelBox) panelBox.classList.toggle('is-fresh', freshNext);
                freshNext = false;

                for (var k = 0; k < results.children.length; k++) {
                    (function (el, idx) {
                        el.addEventListener('mouseenter', function () { setActive(idx); });
                    })(results.children[k], k);
                }

                // 首行必须补一遍 setActive。activeIndex 在上面已经置 0、HTML 串里也把
                // aria-selected="true" 烤进了第一行，但视觉高亮（.is-active）和
                // aria-activedescendant 只有 setActive 会挂。不叫它的后果：
                // 输入完那一下屏幕上没有任何选中指示（此时按 Enter 其实会打开第一条），
                // 而第一次按 ↓ 是从「看不见的 0」走到 1，看着像第一条被跳过。
                // 放在 mouseenter 之后：setActive 里的 scrollIntoView 走 block:'nearest'，
                // 刚渲染完列表停在顶部，第一行本就在视野内，不会产生滚动。
                if (scored.length) setActive(0);
            });
        }

        function go(url) {
            window.location.href = BASE_URL + url;
        }

        // 入口直接绑在按钮上，不走 document 委托：index.js 在 .g-nav 上无条件
        // stopPropagation（那是给移动端抽屉「点外面收起」用的），委托监听收得到
        // 侧栏 .search-trigger，却收不到顶栏那颗 .nav-search-btn——点了没反应。
        // 书架入口早就是同样的写法，这里补齐。
        var openers = document.querySelectorAll('[data-search-open]');
        for (var i = 0; i < openers.length; i++) {
            (function (el) {
                el.addEventListener('click', function (e) {
                    e.preventDefault();
                    open(el);
                });
            })(openers[i]);
        }

        document.addEventListener('click', function (e) {
            if (e.target.closest && e.target.closest('[data-search-close]')) close();
        });

        document.addEventListener('keydown', function (e) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (panel.hidden) open(null); else close();
                return;
            }
            // 单独的 "/" 是站内约定的搜索快捷键，但在输入框里应当照常打出斜杠。
            if (panel.hidden && e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) {
                e.preventDefault();
                open(null);
                return;
            }
            if (panel.hidden) return;
            if (e.key === 'Escape') { e.preventDefault(); close(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIndex + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIndex - 1); }
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (activeIndex >= 0 && matches[activeIndex]) go(matches[activeIndex].item.url);
            }
        });

        input.addEventListener('input', function () { render(input.value); });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Tab') e.preventDefault();
        });
    }

    /* ------------------------------------------------------------------
     * 5. 导航下拉（触屏兜底）
     * ------------------------------------------------------------------ */

    /**
     * 桌面端的下拉由 CSS :hover / :focus-within 驱动，但触屏没有可靠的 hover。
     * 这里在无 hover 能力且未折叠成移动菜单时，把「工具箱」项改成首次点击展开、
     * 再次点击才跳转，避免下拉在平板上成为点不到的死区。
     */
    function initTouchDropdown() {
        if (!window.matchMedia('(hover: none)').matches) return;
        var items = document.querySelectorAll('.nav-item.has-sub');
        for (var i = 0; i < items.length; i++) {
            (function (item) {
                var link = item.querySelector('.nav-link');
                if (!link) return;
                link.addEventListener('click', function (e) {
                    if (window.innerWidth <= 695) return;
                    if (!item.classList.contains('is-open')) {
                        e.preventDefault();
                        for (var j = 0; j < items.length; j++) items[j].classList.remove('is-open');
                        item.classList.add('is-open');
                    }
                });
            })(items[i]);
        }
        document.addEventListener('click', function (e) {
            if (!e.target.closest('.nav-item.has-sub')) {
                for (var k = 0; k < items.length; k++) items[k].classList.remove('is-open');
            }
        });
    }

    /* ------------------------------------------------------------------
     * 6. 平滑滚动锚点
     * ------------------------------------------------------------------ */

    function initAnchorScroll() {
        if (prefersReducedMotion()) return;
        document.addEventListener('click', function (e) {
            var a = e.target.closest('a[href*="#"]');
            if (!a || a.hostname !== window.location.hostname) return;
            var hash = a.getAttribute('href').split('#')[1];
            if (!hash) return;
            var target = document.getElementById(hash);
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            history.replaceState(null, '', '#' + hash);
        });
    }

    function initHeadingAnchors() {
        var body = document.getElementById('post-body');
        if (!body) return;

        // h1 也在内：被删掉的那套 legacy anchor 覆盖 h1/h2/h3，只留 h2/h3 会让
        // 正文里出现一级标题的文章丢掉这一枚锚点。
        var heads = body.querySelectorAll('h1[id], h2[id], h3[id]');
        for (var i = 0; i < heads.length; i++) {
            (function (heading) {
                var link = document.createElement('a');
                link.className = 'heading-anchor';
                link.href = '#' + heading.id;
                // 标题文本必须在这枚链接被 append 之前取，否则会把 "#" 自己念进去。
                // 每条各带小节名：全站一排 aria-label 完全相同的链接，读屏器列出来
                // 就是「复制这一节的链接 ×12」，等于没有信息。
                link.setAttribute('aria-label', '复制「' + heading.textContent.trim() + '」这一节的链接');
                link.textContent = '#';
                link.addEventListener('click', function () {
                    // 不拦默认行为：地址栏要真的变成 #id，复制到的链接才有锚点
                    copyText(window.location.href.split('#')[0] + '#' + heading.id).then(function (ok) {
                        if (!ok) return;
                        link.classList.add('is-done');
                        window.setTimeout(function () { link.classList.remove('is-done'); }, 1600);
                    });
                });
                heading.appendChild(link);
            })(heads[i]);
        }
    }

    /* ------------------------------------------------------------------
     * 7. 续读（跨会话记住没读完的那一篇）
     * ------------------------------------------------------------------ */

    // 只留「最近一篇没读完的」这一条，而不是一个书签列表：
    // 博客的阅读场景是「昨天那篇没看完，今天接着看」，列表反而要人认路。
    var RESUME_KEY = 'resumeRead';
    var RESUME_TTL = 7 * 24 * 60 * 60 * 1000;

    function readResume() {
        var data = null;
        try {
            var raw = localStorage.getItem(RESUME_KEY);
            if (!raw) return null;
            data = JSON.parse(raw);
        } catch (e) {
            return null;
        }
        // at 也在校验之列：缺它时 Date.now() - undefined 得 NaN，而 NaN > TTL 恒为
        // false，于是这条「上次读到」永远熬不过期，浮条一挂就是无限久。
        if (!data || typeof data.p !== 'string' || typeof data.r !== 'number' || typeof data.at !== 'number') return null;
        if (Date.now() - data.at > RESUME_TTL) {
            clearResume();
            return null;
        }
        return data;
    }

    function writeResume(data) {
        try {
            localStorage.setItem(RESUME_KEY, JSON.stringify(data));
        } catch (e) {
            /* 无痕模式下 setItem 会抛：续读没有，正文照读 */
        }
    }

    function clearResume() {
        try {
            localStorage.removeItem(RESUME_KEY);
        } catch (e) {
            /* 同上 */
        }
    }

    /**
     * 文章页：记录阅读进度；若是从首页那条「上次读到」浮条点进来的，
     * 直接把视口放回上次的位置（只在带 resumeJump 标记时发生，正常访问不被打断）。
     */
    function initResumeTracking() {
        var path = window.location.pathname;
        var heading = document.querySelector('.post-masthead-title');
        var title = ((heading && heading.textContent) || document.title).trim().slice(0, 60);

        function commit(force) {
            var pct = Math.round(readRatio() * 100);
            var current = readResume();
            if (pct >= 98) {
                if (current && current.p === path) clearResume();
                return;
            }
            // 只翻了个开头就划走的不算「在读」，否则浮条会被一次误点挂满一周。
            if (pct < 3) return;
            if (current && current.p === path && !force && Math.abs(current.r - pct) < 3) return;
            writeResume({ p: path, t: title, r: pct, at: Date.now() });
        }

        var jumpTo = null;
        var marked = null;
        try {
            marked = sessionStorage.getItem('resumeJump');
            sessionStorage.removeItem('resumeJump');
        } catch (e) {
            /* 拿不到 sessionStorage 就不跳位，只是少了个便利 */
        }
        var saved = readResume();
        if (marked === path && saved && saved.p === path && saved.r > 3 && saved.r < 98) jumpTo = saved.r;

        // 图片、代码高亮都在改变文档高度，等 load 之后量出来的位置才对得上。
        function restore() {
            if (jumpTo === null) return;
            var scrollable = document.documentElement.scrollHeight - window.innerHeight;
            window.scrollTo(0, Math.round(scrollable * jumpTo / 100));
        }
        if (window.addEventListener) {
            window.addEventListener('load', restore);
        }

        window.setInterval(function () { commit(false); }, 2000);
        window.addEventListener('pagehide', function () { commit(true); });
    }

    /**
     * 非文章页（首页、分类、合集…）：挂一条浮条把人接回没读完的那篇。
     */
    function initResumeBar() {
        var data = readResume();
        if (!data || data.p === window.location.pathname) return;

        var box = document.createElement('div');
        box.className = 'resume';

        var link = document.createElement('a');
        link.className = 'resume-link';
        // data.p 存的就是 location.pathname，本身已经带 baseurl，不能再 prepend 一次。
        link.href = data.p;
        link.addEventListener('click', function () {
            try {
                sessionStorage.setItem('resumeJump', data.p);
            } catch (e) {
                /* 只是少了「接着上次的位置」，链接照跳 */
            }
        });

        var kicker = document.createElement('span');
        kicker.className = 'resume-kicker';
        kicker.textContent = '上次读到';
        var title = document.createElement('span');
        title.className = 'resume-title';
        title.textContent = data.t;
        var pct = document.createElement('span');
        pct.className = 'resume-pct';
        pct.textContent = data.r + '%';
        link.appendChild(kicker);
        link.appendChild(title);
        link.appendChild(pct);

        var close = document.createElement('button');
        close.type = 'button';
        close.className = 'resume-close';
        close.setAttribute('aria-label', '收起续读提示');
        close.textContent = '×';
        close.addEventListener('click', function () {
            clearResume();
            if (box.parentNode) box.parentNode.removeChild(box);
        });

        box.appendChild(link);
        box.appendChild(close);
        document.body.appendChild(box);
    }

    function initResume() {
        if (document.getElementById('post-body')) initResumeTracking();
        else initResumeBar();
    }

    /* ------------------------------------------------------------------
     * 8. 正文图片灯箱
     * ------------------------------------------------------------------ */

    /**
     * 正文图片点击放大。用原生 <dialog>：遮罩、Esc、焦点都归浏览器管，
     * 不用自己再写一层模态框；不支持 showModal 的浏览器直接不启用（图片保持原样，
     * 也不会被挂上误导性的放大镜）。
     */
    function initLightbox() {
        var body = document.getElementById('post-body');
        var probe = document.createElement('dialog');
        if (!body || typeof probe.showModal !== 'function') return;

        var dlg = document.createElement('dialog');
        dlg.className = 'lightbox';
        dlg.setAttribute('aria-label', '图片查看');
        var big = document.createElement('img');
        // 建出来到第一次点开之间，这张图是没有任何属性的 <img>：dialog 关着时 display:none
        // 看不见，但它一直在 DOM 里，验证器/AT 按「img 缺 alt」记账（全站 69 篇文章各记一次，
        // 把真正漏写 alt 的图淹成噪声）。open() 里会用原图的 alt 覆盖这一行。
        big.alt = '';
        var cap = document.createElement('p');
        cap.className = 'lightbox-cap';
        dlg.appendChild(big);
        dlg.appendChild(cap);
        document.body.appendChild(dlg);

        // FLIP 的两次「首」：开是点的那张缩略图，关是它当时的位置（中间可能已滚动）。
        var origin = null;

        /**
         * 把对话框从它自己的终态矩形拉回缩略图的位置，再放开让它飞回去。
         *
         * 只写 transform（配 .is-flip 的 will-change），宽高一律不碰 —— 碰了就是
         * 逐帧重排一张 92vw 的图。缩放按 x/y 分别算，因为正文配图大多是横长条、
         * 灯箱里却是按 contain 摆的，等比缩放会先「跳」一下再飞。
         * @param {DOMRect} from 起点矩形
         * @param {boolean} [reverse] 反向：从终态飞回 from（关闭时用）
         */
        function fly(from, reverse) {
            var to = dlg.getBoundingClientRect();
            if (!to.width || !to.height || !from.width) return;
            var sx = from.width / to.width;
            var sy = from.height / to.height;
            var tf = 'translate(' + (from.left - to.left) + 'px,' + (from.top - to.top) + 'px)'
                + ' scale(' + sx + ',' + sy + ')';

            dlg.classList.add('is-flip');
            dlg.style.transformOrigin = '0 0';
            // 两个方向的差别只在「从哪儿起、到哪儿收」：
            // 开 = 先跳到缩略图位置（无过渡）再放开到终态；
            // 关 = 从终态（此刻 transform 正是 none）过渡到缩略图位置。
            // 早先这里两行都写 tf，反向那次起止同值，transition 不产生变化、
            // transitionend 也就不来，关闭只能靠 400ms 超时兜底 —— 看着像能用，
            // 实际是每次关都要等满 400ms。
            dlg.style.transition = 'none';
            dlg.style.transform = reverse ? 'none' : tf;
            void dlg.offsetWidth;
            dlg.style.transition = 'transform ' + (reverse ? 240 : 300) + 'ms cubic-bezier(.22,.61,.36,1)';
            dlg.style.transform = reverse ? tf : 'none';
        }

        /** 飞完/失败都要把内联样式收干净，否则下次打开还带着上一次的 transform。 */
        function settle() {
            dlg.classList.remove('is-flip');
            dlg.style.transition = '';
            dlg.style.transform = '';
            dlg.style.transformOrigin = '';
        }

        function open(img) {
            big.src = img.currentSrc || img.src;
            big.alt = img.alt || '';
            cap.textContent = img.alt || '';
            cap.hidden = !cap.textContent;
            origin = img;
            dlg.showModal();
            if (prefersReducedMotion()) { settle(); return; }
            // showModal 之后才拿得到终态矩形，所以起点先记着、这一步才做 FLIP。
            fly(img.getBoundingClientRect());
        }

        function close() {
            if (dlg.hasAttribute('data-closing')) return;
            var img = origin;
            if (prefersReducedMotion() || !img || !img.isConnected) { dlg.close(); return; }
            var r = img.getBoundingClientRect();
            // 缩略图已经滚出视口时不飞：那会画出一条冲出屏幕的长距离位移，
            // 看着像页面在抽风而不是图片在归位。
            if (r.bottom < 0 || r.top > window.innerHeight || !r.width) { dlg.close(); return; }
            dlg.setAttribute('data-closing', '1');
            fly(r, true);
            var done = false;
            var finish = function () {
                if (done) return;
                done = true;
                dlg.removeEventListener('transitionend', finish);
                dlg.removeAttribute('data-closing');
                settle();
                dlg.close();
            };
            dlg.addEventListener('transitionend', finish);
            // transitionend 不是一定会来的（标签页切走、被 CSS 打断都会让它不来），
            // 没有这道兜底就是一个关不掉的遮罩。
            setTimeout(finish, 400);
        }

        dlg.addEventListener('click', close);
        // Esc 走的是 cancel → close 这条原生路径，不拦的话遮罩直接消失、没有回程。
        dlg.addEventListener('cancel', function (e) {
            if (prefersReducedMotion()) return;
            e.preventDefault();
            close();
        });

        var imgs = body.querySelectorAll('img');
        for (var i = 0; i < imgs.length; i++) {
            (function (img) {
                // 表情包、行内小图标放大只会糊成一团；被 <a> 包住的图让链接先响应。
                if (img.offsetWidth < 160 || img.closest('a')) return;
                img.classList.add('is-zoomable');
                img.addEventListener('click', function () { open(img); });
            })(imgs[i]);
        }
    }

    /* ------------------------------------------------------------------
     * 9. 滚动揭示与刊头数字
     * ------------------------------------------------------------------ */

    /**
     * 首屏以下的行块淡入。
     *
     * 只处理「进页面时已经在折叠线以下」的元素：首屏内容一起淡入只会让人觉得
     * 加载慢。未揭示态由 body.js-reveal 限定，所以脚本没跑、或浏览器不支持
     * IntersectionObserver 时列表原样可见，不会留下一屏空白卡。
     */
    function initReveal() {
        if (!('IntersectionObserver' in window) || prefersReducedMotion()) return;

        var nodes = document.querySelectorAll('.article-list .article-item, .cat-row, .series-row');
        var below = [];
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].getBoundingClientRect().top > window.innerHeight) below.push(nodes[i]);
        }
        if (!below.length) return;

        document.body.classList.add('js-reveal');
        var io = new IntersectionObserver(function (entries) {
            var batch = [];
            for (var j = 0; j < entries.length; j++) {
                if (entries[j].isIntersecting) batch.push(entries[j].target);
            }
            for (var k = 0; k < batch.length; k++) {
                // 按「同一批里第几个」排延迟：按全局序号排会让靠后滚动到的行等得越来越久。
                batch[k].style.transitionDelay = Math.min(k, 5) * 60 + 'ms';
                batch[k].classList.add('is-in');
                io.unobserve(batch[k]);
            }
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

        for (var m = 0; m < below.length; m++) {
            below[m].classList.add('reveal');
            io.observe(below[m]);
        }
    }

    /**
     * 刊头统计数字从 0 数到真值。
     *
     * 只处理纯数字：日期（2026.09.21）和「MV3」这类值会被跳过，
     * 不做「解析失败就当 0」的猜测，免得把真实信息数成乱码。
     */
    function initCountUp() {
        var nums = document.querySelectorAll('.masthead-stats strong');
        if (!nums.length || prefersReducedMotion()) return;

        for (var i = 0; i < nums.length; i++) {
            (function (el) {
                var text = el.textContent.trim();
                var target = parseInt(text, 10);
                if (!text || String(target) !== text) return;

                var duration = 700 + String(target).length * 120;
                var start = null;
                el.textContent = '0';
                window.requestAnimationFrame(function step(now) {
                    if (start === null) start = now;
                    var t = Math.min((now - start) / duration, 1);
                    var eased = 1 - Math.pow(1 - t, 3);
                    el.textContent = String(Math.round(target * eased));
                    if (t < 1) window.requestAnimationFrame(step);
                });
            })(nums[i]);
        }
    }

    /* ------------------------------------------------------------------
     * 10. 窄屏悬浮按钮按滚动方向收放
     * ------------------------------------------------------------------ */

    /**
     * 手机上右下角那组悬浮按钮是 40×190 的常驻方块，正文（含合辑行的日期列）
     * 每次滚过它都会被压住。这里在向下滚动时把它收出屏幕，向上滚或到达文末时再放出来
     * ——「要往上翻才是找按钮」是这个范式下的用户预期。
     * 只在 ≤695px 生效，跨过断点时清掉状态类，免得桌面上按钮被永久藏掉。
     */
    function initFabAutoTuck() {
        var mq = window.matchMedia('(max-width: 695px)');
        var fab = document.querySelector('.bottom-fixed-btn');
        if (!fab) return;

        var lastY = window.pageYOffset;
        var ticking = false;

        function setTucked(on) {
            document.body.classList.toggle('fab-tucked', !!on);
        }

        function update() {
            ticking = false;
            if (!mq.matches) { setTucked(false); return; }

            var y = window.pageYOffset;
            var delta = y - lastY;
            if (Math.abs(delta) < 8) return;

            var atBottom = y + window.innerHeight >= document.documentElement.scrollHeight - 4;
            if (y < 120 || atBottom || delta < 0) setTucked(false);
            else setTucked(true);
            lastY = y;
        }

        function onScroll() {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(update);
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        // 竖屏横屏切换、桌面拖到窄窗时，跨过断点要立刻复位而不是等下一次滚动。
        var onBreak = function () { if (!mq.matches) setTucked(false); };
        if (mq.addEventListener) mq.addEventListener('change', onBreak);
        else if (mq.addListener) mq.addListener(onBreak);
    }

    /* ------------------------------------------------------------------
     * 11. 阅读偏好（字号 / 行宽 / 正文字体）
     * ------------------------------------------------------------------ */

    // 键名、取值域与默认值必须和 _includes/themeBootstrap.html 里那段无闪烁内联脚本一致：
    // 两边各自解析同一份 localStorage，任何一边改了枚举而另一边没改，
    // 表现都是「刷新后偏好悄悄回到默认」，很难在肉眼回归里发现。
    var READER_KEY = 'readerPrefs';
    // short 是 localStorage 里的键名，themeBootstrap.html 的内联脚本按同一套字母取值。
    var READER_GROUPS = {
        size: { attr: 'data-rs-size', values: ['sm', 'md', 'lg'], dft: 'md', short: 's' },
        width: { attr: 'data-rs-width', values: ['normal', 'wide'], dft: 'normal', short: 'w' },
        font: { attr: 'data-rs-font', values: ['sans', 'serif'], dft: 'sans', short: 'f' },
        // 纸色只在白昼档生效（tokens.scss 把这三档挂在 :not(.night-mode) 上）：
        // 夜间本就是墨蓝底，再叠一层暖白只会把对比度拉下来。
        paper: { attr: 'data-rs-paper', values: ['warm', 'cool', 'sage'], dft: 'warm', short: 'p' }
    };

    function readReaderPrefs() {
        var prefs = {};
        var raw = null;
        for (var g in READER_GROUPS) {
            if (READER_GROUPS.hasOwnProperty(g)) prefs[g] = READER_GROUPS[g].dft;
        }
        try {
            raw = localStorage.getItem(READER_KEY);
        } catch (e) {
            return prefs;
        }
        if (!raw) return prefs;
        var stored;
        try {
            stored = JSON.parse(raw);
        } catch (e) {
            return prefs;
        }
        for (var k in READER_GROUPS) {
            if (!READER_GROUPS.hasOwnProperty(k)) continue;
            var v = stored[READER_GROUPS[k].short];
            if (READER_GROUPS[k].values.indexOf(v) >= 0) prefs[k] = v;
        }
        return prefs;
    }

    function applyReaderPrefs(prefs) {
        var el = document.documentElement;
        for (var g in READER_GROUPS) {
            if (!READER_GROUPS.hasOwnProperty(g)) continue;
            var cfg = READER_GROUPS[g];
            if (prefs[g] === cfg.dft) el.removeAttribute(cfg.attr);
            else el.setAttribute(cfg.attr, prefs[g]);
        }
    }

    function writeReaderPrefs(prefs) {
        var out = {};
        var used = false;
        for (var g in READER_GROUPS) {
            if (!READER_GROUPS.hasOwnProperty(g)) continue;
            if (prefs[g] !== READER_GROUPS[g].dft) {
                out[READER_GROUPS[g].short] = prefs[g];
                used = true;
            }
        }
        try {
            // 全是默认值时删键而不是存 '{}'：head 的内联脚本据此直接早退，
            // 「没设过偏好」和「设过又改回默认」在存储层保持同一个状态。
            if (used) localStorage.setItem(READER_KEY, JSON.stringify(out));
            else localStorage.removeItem(READER_KEY);
        } catch (e) {
            /* 无痕模式下写不进去：本次浏览内依然生效，只是下次进来回到默认 */
        }
    }

    function initReaderPrefs() {
        var btn = document.querySelector('.reader-btn');
        var panel = document.getElementById('reader-panel');
        if (!btn || !panel) return;

        var opts = panel.querySelectorAll('.reader-opt');
        var reset = panel.querySelector('.reader-reset');
        // 昼夜那一行的存在与否由模板按 site.nightMode 决定；它存在时才是「面板里的一档」。
        var hasTheme = !!panel.querySelector('[data-rs="theme"]');
        var prefs = readReaderPrefs();
        // head 的内联脚本已经先应用过一次，这里以 JS 解析出的同一份状态为准再写一遍，
        // 保证「界面 aria-pressed」「html 属性」「localStorage」三者出自同一次读取。
        applyReaderPrefs(prefs);

        /**
         * 面板里某一档的当前值。昼夜不查 prefs —— 它的状态在 daytimeMode 里，
         * 由 §0 与 themeBootstrap.html 共同管，这里只是第二个入口。
         * @param {string} group
         * @returns {string}
         */
        function valueOf(group) {
            return group === 'theme' ? (storedTheme() || 'auto') : prefs[group];
        }

        function sync() {
            for (var i = 0; i < opts.length; i++) {
                var group = opts[i].getAttribute('data-rs');
                var value = opts[i].getAttribute('data-val');
                opts[i].setAttribute('aria-pressed', valueOf(group) === value ? 'true' : 'false');
            }
        }

        function open() {
            panel.hidden = false;
            btn.setAttribute('aria-expanded', 'true');
            // 桌面端面板是悬空的弹层，刊头那层 overflow:hidden 会把它裁掉半截，
            // 展开期间临时放行（editorial.scss §7.11）。
            document.body.classList.add('reader-open');
        }

        function close() {
            if (panel.hidden) return;
            panel.hidden = true;
            btn.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('reader-open');
        }

        sync();
        // 面板开着的时候点右下角那颗昼夜钮，aria-pressed 得跟着翻：读屏念到的选中态
        // 不能停在点击之前的那一档。写入口只有 setTheme 一个，所以订阅一次就够。
        if (hasTheme) onThemeChange(sync);

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (panel.hidden) open(); else close();
        });

        panel.addEventListener('click', function (e) {
            e.stopPropagation();
            var opt = e.target.closest ? e.target.closest('.reader-opt') : null;
            if (!opt) return;
            var group = opt.getAttribute('data-rs');
            var value = opt.getAttribute('data-val');
            if (!group || valueOf(group) === value) return;
            if (group === 'theme') {
                // 交回 §0：它负责写 daytimeMode、给 <html>/<body> 加 night-mode、
                // 以及那圈日食转场；aria-pressed 由上面订阅的 sync 重刷。
                // readerPrefs 里永远不出现 theme 这个键。
                setTheme(value);
                return;
            }
            prefs[group] = value;
            // 只给纸色档加转场：字号和行宽改的是排版量，套上转场会变成 250ms 的
            // 模糊重排，读者只想立刻看效果；纸色是纯变色，正好适合从点击处漫开。
            if (group === 'paper') {
                withEclipse(function () { applyReaderPrefs(prefs); });
            } else {
                applyReaderPrefs(prefs);
            }
            writeReaderPrefs(prefs);
            sync();
        });

        if (reset) {
            reset.addEventListener('click', function (e) {
                e.stopPropagation();
                for (var g in READER_GROUPS) {
                    if (READER_GROUPS.hasOwnProperty(g)) prefs[g] = READER_GROUPS[g].dft;
                }
                applyReaderPrefs(prefs);
                writeReaderPrefs(prefs);
                // 昼夜也一起交还系统：它就显示在同一块面板里，「恢复默认」不该留一档在面板外。
                // nightMode 关掉时这一行根本不渲染（hasTheme 为假），不去动别人可能存在的旧选择；
                // 键本来就不在时也不调 —— setTheme 会照常走一圈日食转场，无事可转就别闪这一下。
                if (hasTheme && storedTheme()) setTheme('auto');
                sync();
            });
        }

        // 点面板外任意处收起；面板内的点击上面已经 stopPropagation。
        document.addEventListener('click', close);
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (panel.hidden) return;
            close();
            btn.focus();
        });
        // Tab 走出面板也算「离开」，否则键盘用户要手动 Esc 才能关掉一个已经看不见的框。
        panel.addEventListener('focusout', function (e) {
            var next = e.relatedTarget;
            if (next && (panel.contains(next) || next === btn)) return;
            close();
        });
    }

    /* ------------------------------------------------------------------
     * 12. 文内链接预览卡
     * ------------------------------------------------------------------ */

    /**
     * 正文里的链接悬停片刻后浮出一张小卡：站内链接给标题、摘要与日期，
     * 站外链给主机名与路径并说明「会离开本站」。
     *
     * 只在真有 hover 能力的设备启用（触屏上它只会变成误触后赖着不走的浮层），
     * 卡片本身 pointer-events:none，指针永远进不到卡里，因此不需要「移入卡片保持显示」
     * 那套延迟切换，收起逻辑只有一条：指针离开链接即收。
     */
    function initLinkPreview() {
        var body = document.getElementById('post-body');
        if (!body) return;
        if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

        var card = null;
        var slots = null;
        var timer = null;
        var current = null;
        var index = null;

        function ensureCard() {
            if (card) return card;
            card = document.createElement('div');
            card.className = 'lp-card';
            card.id = 'lp-card';
            card.setAttribute('role', 'tooltip');
            card.hidden = true;
            slots = {
                kicker: document.createElement('p'),
                title: document.createElement('p'),
                excerpt: document.createElement('p'),
                meta: document.createElement('p')
            };
            slots.kicker.className = 'lp-kicker';
            slots.title.className = 'lp-title';
            slots.excerpt.className = 'lp-excerpt';
            slots.meta.className = 'lp-meta';
            card.appendChild(slots.kicker);
            card.appendChild(slots.title);
            card.appendChild(slots.excerpt);
            card.appendChild(slots.meta);
            document.body.appendChild(card);
            return card;
        }

        /**
         * 这条链接值不值得预览。返回 null 表示跳过。
         * @param {HTMLAnchorElement} link
         * @returns {Object|null}
         */
        function describe(link) {
            var href = link.getAttribute('href') || '';
            if (/^(mailto|tel|javascript):/i.test(href)) return null;
            // 同页锚点跳转（含正文标题的 #锚点）不是「去别处」，预览只会挡视线
            if (link.host === location.host && link.pathname === location.pathname && link.hash) return null;
            if (link.host !== location.host) {
                return { external: true, host: link.hostname, path: link.pathname + (link.search || '') };
            }
            var key = link.pathname;
            if (BASE_URL && key.indexOf(BASE_URL) === 0) key = key.slice(BASE_URL.length);
            return { external: false, key: key, hash: link.hash };
        }

        function fill(link, desc) {
            if (desc.external) {
                slots.kicker.textContent = '外部链接 · 会离开本站';
                slots.title.textContent = desc.host;
                slots.excerpt.textContent = desc.path;
                slots.meta.textContent = '点击将在当前标签页打开';
                return;
            }
            var item = index ? index[desc.key] : null;
            if (item) {
                slots.kicker.textContent = [item.category, item.date].filter(Boolean).join(' · ');
                slots.title.textContent = item.title || '';
                slots.excerpt.textContent = (item.excerpt || '').slice(0, 96);
                slots.meta.textContent = '站内文章 · 点击查看';
                return;
            }
            // 语料里只有文章，标签页 / 合集页 / 分类页这类站内目标退化成
            // 「链接文字 + 路径」，仍然比什么都不给有用，且不为此再加一份数据源。
            slots.kicker.textContent = '站内页面';
            slots.title.textContent = (link.textContent || '').trim().slice(0, 48);
            slots.excerpt.textContent = desc.key;
            slots.meta.textContent = '点击查看';
        }

        function place(link) {
            var r = link.getBoundingClientRect();
            var pad = 12;
            var cw = card.offsetWidth;
            var ch = card.offsetHeight;
            // 钳制基准走 fixedViewport()：卡片是 fixed，可用宽度不含经典滚动条。
            var vp = fixedViewport();
            var left = r.left + r.width / 2 - cw / 2;
            left = Math.max(pad, Math.min(left, vp.w - cw - pad));
            var top = r.bottom + 10;
            if (top + ch > vp.h - pad) top = r.top - ch - 10;
            if (top < pad) top = pad;
            card.style.left = Math.round(left) + 'px';
            card.style.top = Math.round(top) + 'px';
        }

        function hide() {
            window.clearTimeout(timer);
            if (current) current.removeAttribute('aria-describedby');
            current = null;
            if (card) card.hidden = true;
        }

        function show(link, desc) {
            fill(link, desc);
            card.hidden = false;
            // 卡片是全局复用的，只在显示期间挂描述关系，否则读屏会念到上一条链接的内容
            link.setAttribute('aria-describedby', 'lp-card');
            place(link);
        }

        function reveal(link, desc) {
            ensureCard();
            current = link;
            if (desc.external) {
                show(link, desc);
                return;
            }
            getCorpus().then(function (data) {
                if (!index) {
                    index = {};
                    for (var i = 0; i < data.length; i++) index[data[i].url] = data[i];
                }
                // 语料是异步回来的，期间指针可能已经移到另一根链接上
                if (current !== link) return;
                show(link, desc);
            });
        }

        function onEnter(link, delay) {
            var desc = describe(link);
            if (!desc) return;
            current = link;
            window.clearTimeout(timer);
            if (delay <= 0) reveal(link, desc);
            else timer = window.setTimeout(function () { reveal(link, desc); }, delay);
        }

        var links = body.querySelectorAll('a[href]');
        for (var i = 0; i < links.length; i++) {
            (function (link) {
                var desc = describe(link);
                if (desc && desc.external) link.classList.add('lp-external');
                link.addEventListener('mouseenter', function () { onEnter(link, 280); });
                link.addEventListener('mouseleave', hide);
                link.addEventListener('focus', function () { onEnter(link, 0); });
                link.addEventListener('blur', hide);
            })(links[i]);
        }

        // 卡片是 fixed 定位，一旦滚动就会和链接脱开；缩放同理。
        window.addEventListener('scroll', hide, { passive: true, capture: true });
        window.addEventListener('resize', hide, { passive: true });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') hide();
        });
    }

    /* ------------------------------------------------------------------
     * 13. 金句分享卡片
     * ------------------------------------------------------------------ */

    // 选中正文里的一段话 → 画成一张可以直接转发的图。
    // 太短的选中（一个词、一个数字）出不来好看的卡片，太长的会撑满卡片且不像「金句」，
    // 因此卡在 8~150 字之间；换行按字符测宽，中英文混排都成立。
    var QUOTE_MIN = 8;
    var QUOTE_MAX = 150;
    var QUOTE_W = 900;

    // §15 的篇末「生成金句卡」按钮要复用同一套画布逻辑，这里留一个窄接口，
    // 而不是把整块 canvas 代码再写一遍。initQuoteCard 探测到不支持 dialog 时保持为 null。
    var quoteCardCtl = null;

    function initQuoteCard() {
        var body = document.getElementById('post-body');
        if (!body) return;
        var probe = document.createElement('dialog');
        if (typeof probe.showModal !== 'function') return;

        var bar = null;
        var barBtn = null;
        var dlg = null;
        var canvas = null;
        var status = null;
        var quote = '';

        function ensureBar() {
            if (bar) return;
            bar = document.createElement('div');
            bar.className = 'quote-bar';
            bar.hidden = true;
            barBtn = document.createElement('button');
            barBtn.type = 'button';
            barBtn.className = 'quote-bar-btn';
            barBtn.textContent = '做成卡片';
            barBtn.addEventListener('click', function () { open(); });
            bar.appendChild(barBtn);
            document.body.appendChild(bar);
        }

        function hideBar() {
            if (bar) bar.hidden = true;
        }

        function showBar(rect) {
            ensureBar();
            bar.hidden = false;
            // 同 place()：药丸是 fixed，钳右/钳下要用不含经典滚动条的那一段宽度。
            var vp = fixedViewport();
            var w = bar.offsetWidth;
            var left = Math.max(12, Math.min(rect.left + rect.width / 2 - w / 2, vp.w - w - 12));
            var top = rect.bottom + 12;
            if (top + bar.offsetHeight > vp.h - 12) top = Math.max(12, rect.top - bar.offsetHeight - 12);
            bar.style.left = Math.round(left) + 'px';
            bar.style.top = Math.round(top) + 'px';
        }

        /** 页面上那根选区：必须整段落在正文里，且不在代码块内。 */
        function currentQuote() {
            var sel = window.getSelection && window.getSelection();
            if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
            var text = String(sel.toString()).replace(/\s+/g, ' ').trim();
            if (text.length < QUOTE_MIN || text.length > QUOTE_MAX) return null;
            var a = sel.anchorNode;
            var f = sel.focusNode;
            if (!a || !f || !body.contains(a) || !body.contains(f)) return null;
            var node = a.nodeType === 1 ? a : a.parentNode;
            if (node.closest && node.closest('pre, code')) return null;
            return { text: text, rect: sel.getRangeAt(0).getBoundingClientRect() };
        }

        function onSelected() {
            var q = currentQuote();
            if (!q) { hideBar(); return; }
            quote = q.text;
            showBar(q.rect);
        }

        /** 画布上用的四条墨色 + 纸色，全部取自当前生效的设计令牌。 */
        function ink() {
            var cs = window.getComputedStyle(document.documentElement);
            function v(name, dft) {
                var got = cs.getPropertyValue(name);
                return (got && got.trim()) || dft;
            }
            return {
                paper: v('--paper', '#FAF9F6'),
                ink: v('--ink', '#14161A'),
                ink2: v('--ink-2', '#33373E'),
                ink3: v('--ink-3', '#6E7480'),
                ink4: v('--ink-4', '#A6ABB2'),
                rule: v('--rule', '#E6E2D9'),
                signal: v('--signal', '#0F62FE')
            };
        }

        function meta() {
            var title = document.querySelector('.post-masthead-title');
            var time = document.querySelector('.post-masthead time .meta-text');
            var brand = document.querySelector('.logo-word');
            var url = location.href.replace(/^https?:\/\//, '');
            if (BASE_URL) url = url.replace(BASE_URL + '/', '');
            return {
                title: (title && title.textContent.trim()) || document.title,
                date: (time && time.textContent.trim()) || '',
                brand: (brand && brand.textContent.trim()) || '',
                url: url
            };
        }

        /**
         * 按字符测宽换行：中文没有空格可断，按词切分会整段溢出。
         * @returns {string[]}
         */
        function wrap(ctx, text, maxWidth) {
            var lines = [];
            var line = '';
            for (var i = 0; i < text.length; i++) {
                var next = line + text[i];
                if (line && ctx.measureText(next).width > maxWidth) {
                    lines.push(line);
                    line = text[i];
                } else {
                    line = next;
                }
            }
            if (line) lines.push(line);
            return lines;
        }

        function draw() {
            var m = meta();
            var c = ink();
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            var ctx = canvas.getContext('2d');
            var pad = 64;
            var boxW = QUOTE_W - pad * 2;
            // 字号自适应：短句子放大到 46，长句子缩到 30，避免出现半空的卡片
            var size = quote.length > 110 ? 30 : (quote.length > 60 ? 36 : 44);
            var lh = Math.round(size * 1.55);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.font = '400 ' + size + 'px Georgia, "Songti SC", "Noto Serif CJK SC", serif';
            var lines = wrap(ctx, quote, boxW);
            var h = 176 + lines.length * lh + 96;
            canvas.width = Math.round(QUOTE_W * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            ctx.fillStyle = c.paper;
            ctx.fillRect(0, 0, QUOTE_W, h);
            ctx.fillStyle = c.signal;
            ctx.fillRect(0, 0, QUOTE_W, 5);

            ctx.font = '400 16px "SF Mono", Menlo, Consolas, monospace';
            ctx.fillStyle = c.ink4;
            ctx.textBaseline = 'alphabetic';
            var top = 74;
            if (m.brand) ctx.fillText(m.brand.toUpperCase(), pad, top);
            if (m.date) {
                var dw = ctx.measureText(m.date).width;
                ctx.fillText(m.date, QUOTE_W - pad - dw, top);
            }

            // 引号只做质感，不参与排版计算
            ctx.font = '400 132px Georgia, serif';
            ctx.fillStyle = c.signal;
            ctx.globalAlpha = 0.16;
            ctx.fillText('“', pad - 14, 178);
            ctx.globalAlpha = 1;

            ctx.font = '400 ' + size + 'px Georgia, "Songti SC", "Noto Serif CJK SC", serif';
            ctx.fillStyle = c.ink;
            var y = 176 + size * 0.8;
            for (var i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], pad, y);
                y += lh;
            }

            var foot = h - 66;
            ctx.strokeStyle = c.rule;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pad, foot - 26 + 0.5);
            ctx.lineTo(QUOTE_W - pad, foot - 26 + 0.5);
            ctx.stroke();

            // 页脚一行要放两段文字（左标题、右本页 URL），两者都会溢出，所以先量 URL、
            // 把剩下的宽度给标题。固定预留 150px 是不够的：60 字符的 URL 按 15px 等宽实测 542px。
            ctx.font = '400 15px "SF Mono", Menlo, Consolas, monospace';
            var urlText = m.url;
            var uw = ctx.measureText(urlText).width;
            var urlCap = boxW * .45;
            if (uw > urlCap) {
                // 从左侧退字符：尾部是文件名，比协议和日期更能认出是哪篇
                while (urlText.length > 8 && ctx.measureText('…' + urlText).width > urlCap) urlText = urlText.slice(1);
                urlText = '…' + urlText;
                uw = ctx.measureText(urlText).width;
            }

            ctx.font = '400 20px -apple-system, "Helvetica Neue", sans-serif';
            ctx.fillStyle = c.ink2;
            var t = m.title;
            var titleCap = boxW - uw - 24;
            while (t.length > 1 && ctx.measureText(t + '…').width > titleCap) t = t.slice(0, -1);
            ctx.fillText(t + (t === m.title ? '' : '…'), pad, foot);
            ctx.font = '400 15px "SF Mono", Menlo, Consolas, monospace';
            ctx.fillStyle = c.ink4;
            ctx.fillText(urlText, QUOTE_W - pad - uw, foot);
        }

        function ensureDialog() {
            if (dlg) return;
            dlg = document.createElement('dialog');
            dlg.className = 'quote-dialog';
            dlg.setAttribute('aria-label', '金句分享卡片');
            canvas = document.createElement('canvas');
            canvas.className = 'quote-canvas';
            var hint = document.createElement('p');
            hint.className = 'quote-hint';
            hint.textContent = '选中的一段话已画成分享图';
            var actions = document.createElement('div');
            actions.className = 'quote-actions';
            actions.innerHTML = '<button class="quote-btn is-primary" type="button" data-act="download">下载图片</button>'
                + '<button class="quote-btn" type="button" data-act="copy">复制图片</button>'
                + '<button class="quote-btn" type="button" data-act="close">关闭</button>';
            status = document.createElement('p');
            status.className = 'quote-status';
            status.setAttribute('role', 'status');
            dlg.appendChild(hint);
            dlg.appendChild(canvas);
            dlg.appendChild(actions);
            dlg.appendChild(status);
            document.body.appendChild(dlg);

            actions.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-act]');
                if (!btn) return;
                var act = btn.getAttribute('data-act');
                if (act === 'close') dlg.close();
                else if (act === 'download') download();
                else if (act === 'copy') copyImage();
            });
            // 点遮罩关闭：只有落在 dialog 自身（即遮罩区域）的点击才收，画布上的不算
            dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
            // 主题在卡片打开期间被切换时，按当前墨色重画一次；关闭状态下不动画布
            new MutationObserver(function () { if (dlg.open) draw(); }).observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['class']
            });
        }

        function open() {
            if (!quote) return;
            ensureDialog();
            hideBar();
            draw();
            status.textContent = '';
            dlg.showModal();
        }

        function say(text) {
            status.textContent = text;
        }

        function download() {
            canvas.toBlob(function (blob) {
                if (!blob) { say('生成图片失败，请改用截图'); return; }
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = (meta().title || 'quote').replace(/[\\/:*?"<>|]/g, '').slice(0, 40).replace(/[\s—–·、，,]+$/, '') + '.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
                say('已下载 PNG');
            }, 'image/png');
        }

        function copyImage() {
            if (!navigator.clipboard || !window.ClipboardItem) {
                say('当前浏览器不支持复制图片，请长按或右键保存');
                return;
            }
            canvas.toBlob(function (blob) {
                if (!blob) { say('生成图片失败'); return; }
                navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]).then(
                    function () { say('图片已复制到剪贴板'); },
                    function () { say('复制被拒绝，请改用下载'); }
                );
            }, 'image/png');
        }

        var pending = null;
        document.addEventListener('selectionchange', function () {
            // 选中过程中的 mouseup / 方向键连发都会触发，合并到下一帧再量选区
            if (pending) return;
            pending = window.requestAnimationFrame(function () {
                pending = null;
                onSelected();
            });
        });

        document.addEventListener('mousedown', function (e) {
            if (bar && !bar.hidden && !bar.contains(e.target)) hideBar();
        });
        window.addEventListener('scroll', hideBar, { passive: true });
        window.addEventListener('resize', hideBar, { passive: true });
        window.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') hideBar();
        });

        quoteCardCtl = {
            /**
             * 拿当前选区直接开卡，供篇末收束层调用。
             * @returns {boolean} 选区不合规（空、太短、太长、在代码块里）时返回 false，
             * 由调用方就地给提示，而不是弹一张画了半句话的图
             */
            openFromSelection: function () {
                var q = currentQuote();
                if (!q) return false;
                quote = q.text;
                open();
                return true;
            }
        };
    }

    /* ------------------------------------------------------------------
     * 14. 书架（待读 / 足迹 / 账本）
     * ------------------------------------------------------------------ */

    // 与 §7 续读分键存储：续读是「昨天那篇没看完」的单条状态、带 7 天 TTL，
    // 书架是要一直攒下去的清单，合在一个键里会被那个 TTL 连坐清掉。
    // 两边只在一个点上对齐：读到 98% 时同时清续读、摘待读。
    var SHELF_KEY = 'shelf';
    var DAY_MS = 24 * 60 * 60 * 1000;

    // 点「清空」后本模块对本页停止写入。否则正在读的这篇会被下面的轮询立刻记回足迹，
    // 用户看到的是「清空没生效」。
    var shelfStopped = false;

    // 抽屉打开时由 initShelfDrawer 挂上重绘函数，书签切换与轮询都要它刷新列表。
    var shelfRerender = null;

    function emptyShelf() {
        return { q: {}, f: {}, d: {} };
    }

    function countKeys(obj) {
        var n = 0;
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) n++;
        }
        return n;
    }

    /**
     * @returns {{q: Object, f: Object, d: Object}} 待读队列 / 足迹 / 每日可见时长
     */
    function readShelf() {
        var shelf = emptyShelf();
        var raw = null;
        try {
            raw = localStorage.getItem(SHELF_KEY);
        } catch (e) {
            return shelf;
        }
        if (!raw) return shelf;
        var data = null;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            return shelf;
        }
        if (!data || typeof data !== 'object') return shelf;
        // 逐区合并而不是整体替换：某一块被旧版本或手工改成畸形结构时，坏的只是那一区，
        // 不会让整只书架解析失败、在界面上显示成一个「空书架」。
        var zones = ['q', 'f', 'd'];
        for (var i = 0; i < zones.length; i++) {
            if (data[zones[i]] && typeof data[zones[i]] === 'object') shelf[zones[i]] = data[zones[i]];
        }
        return shelf;
    }

    function writeShelf(shelf) {
        try {
            localStorage.setItem(SHELF_KEY, JSON.stringify(shelf));
        } catch (e) {
            /* 无痕模式写不进去：内存里那份照常工作，下次进来回到空书架 */
        }
    }

    function dayKey(ts) {
        var dt = new Date(ts);
        var m = dt.getMonth() + 1;
        var d = dt.getDate();
        return dt.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);
    }

    /**
     * @param {string} key 'YYYY-MM-DD'
     * @returns {Date} 当天零点（本地时区，与 dayKey 同一套口径）
     */
    function parseDay(key) {
        var parts = String(key).split('-');
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }

    /** 毫秒 → 「30 秒」/「42 分钟」/「3 小时 5 分」：账本里不该出现六位数字。 */
    function humanizeMs(ms) {
        var sec = Math.max(Math.round(ms / 1000), 0);
        if (sec < 60) return sec + ' 秒';
        var min = Math.round(sec / 60);
        if (min < 60) return min + ' 分钟';
        return Math.floor(min / 60) + ' 小时 ' + (min % 60) + ' 分';
    }

    /** 时间戳 → 「今天」/「昨天」/「3 天前」/「2026-05-01」。 */
    function humanizeAgo(ts) {
        if (!ts) return '较早';
        var days = Math.floor((Date.now() - ts) / DAY_MS);
        if (days <= 0) return '今天';
        if (days === 1) return '昨天';
        if (days < 30) return days + ' 天前';
        return dayKey(ts);
    }

    /** 过一万改说「x.x 万字」：六位数字在读屏和扫读里都没有量感。 */
    function humanizeChars(n) {
        return n >= 10000 ? (n / 10000).toFixed(1) + ' 万字' : n + ' 字';
    }

    /** 文章页自己就是目标：从刊头与 #post-body 的数据载体取。 */
    function shelfFromPage() {
        var body = document.getElementById('post-body');
        var heading = document.querySelector('.post-masthead-title');
        return {
            p: window.location.pathname,
            t: ((heading && heading.textContent) || document.title || '').replace(/\s+/g, ' ').trim().slice(0, 60),
            c: (body && body.getAttribute('data-cat')) || '',
            m: (body && parseInt(body.getAttribute('data-mins'), 10)) || 0,
            w: (body && parseInt(body.getAttribute('data-chars'), 10)) || 0
        };
    }

    /**
     * 一个 [data-shelf-add] 按钮指向哪篇。首页卡片把元数据挂在按钮上（那里没有正文可问），
     * 文章页与篇末不挂，回落到当前页。
     */
    function shelfTarget(btn) {
        var path = btn.getAttribute('data-path');
        if (!path) return shelfFromPage();
        return {
            p: path,
            t: btn.getAttribute('data-title') || '',
            c: btn.getAttribute('data-cat') || '',
            m: parseInt(btn.getAttribute('data-mins'), 10) || 0,
            w: 0
        };
    }

    /** 回填页面上所有书签按钮，让「已在架」这件事看得见、按得动。 */
    function syncShelfMarks(shelf) {
        var marks = document.querySelectorAll('[data-shelf-add]');
        for (var i = 0; i < marks.length; i++) {
            var btn = marks[i];
            var info = shelfTarget(btn);
            var on = !!(info.p && shelf.q[info.p]);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            btn.classList.toggle('is-on', on);
            // 卡片上那颗只有图标，状态走 aria-pressed 与 title 就够；
            // 文章页与篇末那两颗有可见文字，必须跟着变，否则点了像没反应。
            var label = btn.querySelector('.shelf-mark-text');
            if (label) label.textContent = on ? '已在书架' : '稍后再读';
            else if (btn.classList.contains('wrap-up-btn')) btn.textContent = on ? '已在书架' : '放进书架';
            if (btn.hasAttribute('data-path')) btn.title = on ? '已在书架，点击移出' : '放进书架，稍后再读';
        }
    }

    /** 角标只在待读非空时出现：空书架不该在顶栏占一个视觉位置。 */
    function syncShelfBadge(shelf) {
        var badge = document.querySelector('[data-shelf-count]');
        if (!badge) return;
        var n = countKeys(shelf.q);
        badge.textContent = n > 99 ? '99+' : String(n);
        badge.hidden = n === 0;
    }

    function toggleShelfQueue(btn) {
        var info = shelfTarget(btn);
        if (!info.p) return;
        var shelf = readShelf();
        if (shelf.q[info.p]) delete shelf.q[info.p];
        else shelf.q[info.p] = { t: info.t, c: info.c, m: info.m, at: Date.now() };
        writeShelf(shelf);
        syncShelfMarks(shelf);
        syncShelfBadge(shelf);
        if (shelfRerender) shelfRerender();
    }

    /**
     * 单行条目。列表内容全用 textContent 写入 —— 标题里出现引号或尖括号是常态，
     * 拼 HTML 字符串迟早要出事。
     * @param {boolean=} droppable 待读条目给「移出」按钮，足迹条目不给
     * @param {number=} idx 行在列表中的序号，写进 --i 供 CSS §M6 排错峰延迟
     */
    function shelfRow(href, title, metaText, ratio, droppable, idx) {
        var li = document.createElement('li');
        li.className = 'shelf-row';
        if (typeof idx === 'number') li.style.setProperty('--i', idx);

        var a = document.createElement('a');
        a.className = 'shelf-row-link';
        a.href = href;
        a.textContent = title;

        var p = document.createElement('p');
        p.className = 'shelf-row-meta';
        p.textContent = metaText;

        li.appendChild(a);
        li.appendChild(p);

        if (typeof ratio === 'number') {
            var bar = document.createElement('span');
            bar.className = 'shelf-row-bar';
            var fill = document.createElement('i');
            fill.style.width = Math.max(0, Math.min(100, Math.round(ratio * 100))) + '%';
            bar.appendChild(fill);
            li.appendChild(bar);
        }
        if (droppable) {
            var btn = document.createElement('button');
            btn.className = 'shelf-row-drop';
            btn.type = 'button';
            btn.setAttribute('data-shelf-drop', href);
            btn.setAttribute('aria-label', '把《' + title + '》移出书架');
            btn.textContent = '×';
            li.appendChild(btn);
        }
        return li;
    }

    function shelfMeta(c, m, extra) {
        var bits = [];
        if (c) bits.push(c);
        if (m) bits.push('约 ' + m + ' 分钟');
        if (extra) bits.push(extra);
        return bits.join(' · ');
    }

    /** 按时间倒序摊平一个区，供列表渲染。 */
    function shelfEntries(zone) {
        var out = [];
        for (var p in zone) {
            if (zone.hasOwnProperty(p) && zone[p] && typeof zone[p] === 'object') out.push({ p: p, e: zone[p] });
        }
        out.sort(function (x, y) { return (y.e.at || 0) - (x.e.at || 0); });
        return out;
    }

    function shelfStats(shelf) {
        var totalMs = 0;
        var chars = 0;
        var cats = {};
        var read = 0;
        for (var p in shelf.f) {
            if (!shelf.f.hasOwnProperty(p)) continue;
            var e = shelf.f[p];
            read++;
            chars += Math.round((e.w || 0) * Math.min(Math.max(e.r || 0, 0), 100) / 100);
            if (e.c) cats[e.c] = 1;
        }
        var days = [];
        for (var k in shelf.d) {
            if (!shelf.d.hasOwnProperty(k) || !(shelf.d[k] > 0)) continue;
            totalMs += shelf.d[k];
            days.push(k);
        }

        var recent = 0;
        for (var i = 0; i < days.length; i++) {
            if (Date.now() - parseDay(days[i]).getTime() <= 30 * DAY_MS) recent++;
        }
        // 从今天往回数；今天还没读就从昨天起算，否则「连续」会在每天零点准时归零。
        var streak = 0;
        var cursor = new Date();
        cursor.setHours(0, 0, 0, 0);
        if (!(shelf.d[dayKey(cursor.getTime())] > 0)) cursor.setDate(cursor.getDate() - 1);
        while (streak < 400 && shelf.d[dayKey(cursor.getTime())] > 0) {
            streak++;
            cursor.setDate(cursor.getDate() - 1);
        }

        return [
            ['读过', read + ' 篇'],
            ['累计在用', read ? humanizeMs(totalMs) : '—'],
            ['约当读完', chars ? humanizeChars(chars) : '—'],
            ['近 30 天', recent ? recent + ' 天' : '—'],
            ['连续', streak ? streak + ' 天' : '—'],
            ['覆盖分类', countKeys(cats) ? countKeys(cats) + ' 个' : '—']
        ];
    }

    function renderShelfStats(panel, shelf) {
        panel.innerHTML = '';
        var rows = shelfStats(shelf);
        var dl = document.createElement('dl');
        dl.className = 'shelf-ledger';
        for (var i = 0; i < rows.length; i++) {
            var cell = document.createElement('div');
            cell.className = 'shelf-cell';
            var dt = document.createElement('dt');
            dt.textContent = rows[i][0];
            var dd = document.createElement('dd');
            dd.textContent = rows[i][1];
            cell.appendChild(dt);
            cell.appendChild(dd);
            dl.appendChild(cell);
        }
        panel.appendChild(dl);
    }

    function initShelfDrawer() {
        var dlg = document.getElementById('shelf-dlg');
        if (!dlg || typeof dlg.showModal !== 'function') return null;

        var tabs = dlg.querySelectorAll('[data-shelf-tab]');
        var panels = dlg.querySelectorAll('[data-shelf-panel]');
        var emptyLine = dlg.querySelector('[data-shelf-empty]');
        var clearBtn = dlg.querySelector('[data-shelf-clear]');
        var current = 'queue';
        var armed = 0;
        var opener = null;
        // 与搜索面板同一套做法（CSS §M6）：只有「刚点开抽屉」的那一次渲染给行挂错峰入场，
        // 换标签页、移出、每 5 秒的足迹回写都只是重绘，不该再涌一遍。
        var shelfFresh = false;

        var EMPTY_TEXT = {
            queue: '待读队列是空的。文章页的书签、首页卡片右上角的小书签都能放进来。',
            log: '还没有阅读记录 —— 翻开任意一篇文章，读完或中途划走都会留痕。'
        };

        /**
         * 记下焦点落在「哪个面板 / 哪一行 / 行内哪个控件」上。
         * 只认行内的两个已知控件类，其余（标签页按钮、关闭键）不在重建范围内，
         * 返回 null 让调用方什么都不做。
         */
        function captureShelfFocus() {
            var af = document.activeElement;
            if (!af || !af.closest || !dlg.contains(af)) return null;
            var cls = af.className === 'shelf-row-link' ? 'shelf-row-link'
                : af.className === 'shelf-row-drop' ? 'shelf-row-drop' : '';
            var host = af.closest('[data-shelf-panel]');
            var key = af.getAttribute('href') || af.getAttribute('data-shelf-drop');
            if (!cls || !host || !key) return null;
            return { panel: host.getAttribute('data-shelf-panel'), cls: cls, key: key };
        }

        /** 按 captureShelfFocus 记下的坐标找回去。面板属性值只跟自家两个字面量比，不拼选择器。 */
        function restoreShelfFocus(snap) {
            if (!snap) return;
            var hosts = dlg.querySelectorAll('[data-shelf-panel]');
            for (var h = 0; h < hosts.length; h++) {
                if (hosts[h].getAttribute('data-shelf-panel') !== snap.panel) continue;
                var rows = hosts[h].children;
                for (var i = 0; i < rows.length; i++) {
                    var el = rows[i].querySelector('.' + snap.cls);
                    if (!el) continue;
                    if ((el.getAttribute('href') || el.getAttribute('data-shelf-drop')) === snap.key) {
                        // preventScroll 是必须的：不加这句浏览器会滚到那一行，
                        // 每 5 秒的足迹回写就把抽屉的位置挪一次。
                        el.focus({ preventScroll: true });
                        return;
                    }
                }
            }
        }

        function render() {
            var shelf = readShelf();
            var list = dlg.querySelector('[data-shelf-panel="queue"]');
            var foot = dlg.querySelector('[data-shelf-panel="log"]');

            // 两个列表都是整块 innerHTML='' 重建，而这条 render 每 5 秒会被足迹回写
            // 调一次（§10 的 setInterval）：不跨重建保焦点，键盘用户每 5 秒被踢回
            // <body> 一次，正读到的那一行也顺手销毁。认路径不认序号，因为这次的
            // 回写本身就可能改变排序。
            var focusSnap = captureShelfFocus();

            list.innerHTML = '';
            var qEntries = shelfEntries(shelf.q);
            for (var i = 0; i < qEntries.length; i++) {
                var q = qEntries[i];
                list.appendChild(shelfRow(q.p, q.e.t || q.p,
                    shelfMeta(q.e.c, q.e.m, humanizeAgo(q.e.at) + '加入'), null, true, i));
            }

            foot.innerHTML = '';
            var fEntries = shelfEntries(shelf.f);
            for (var j = 0; j < fEntries.length; j++) {
                var f = fEntries[j];
                var pct = Math.min(Math.max(f.e.r || 0, 0), 100);
                // 刚点开就算一次足迹，但「读到 0%」看着像坏了 —— 这一步用文案区分。
                var stage = pct >= 98 ? '读完' : pct < 3 ? '刚打开' : '读到 ' + pct + '%';
                foot.appendChild(shelfRow(f.p, f.e.t || f.p,
                    shelfMeta(f.e.c, f.e.m, stage + ' · ' + humanizeAgo(f.e.at)),
                    pct / 100, false, j));
            }

            // 错峰入场只属于「刚点开」那一次；两个列表都在这次渲染里被重建，
            // 但只有当前可见面板的行会被看到，隐藏面板的行不会启动动画。
            dlg.classList.toggle('is-fresh', shelfFresh);
            shelfFresh = false;

            renderShelfStats(dlg.querySelector('[data-shelf-panel="stats"]'), shelf);

            var nums = dlg.querySelectorAll('[data-shelf-n]');
            for (var k = 0; k < nums.length; k++) {
                var which = nums[k].getAttribute('data-shelf-n');
                var count = which === 'queue' ? qEntries.length : fEntries.length;
                nums[k].textContent = count ? String(count) : '';
            }

            // 空态只给列表类面板说一句话，账本面板永远有数字（哪怕是「—」），
            // 再叠一句空态就成了自相矛盾的废话。
            var isEmpty = current !== 'stats' && (current === 'queue' ? !qEntries.length : !fEntries.length);
            if (emptyLine) {
                emptyLine.hidden = !isEmpty;
                emptyLine.textContent = isEmpty ? EMPTY_TEXT[current] : '';
            }

            restoreShelfFocus(focusSnap);
        }

        function showTab(name) {
            current = name;
            for (var i = 0; i < tabs.length; i++) {
                var on = tabs[i].getAttribute('data-shelf-tab') === name;
                tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
                tabs[i].classList.toggle('is-on', on);
            }
            for (var j = 0; j < panels.length; j++) {
                panels[j].hidden = panels[j].getAttribute('data-shelf-panel') !== name;
            }
            render();
        }

        dlg.addEventListener('click', function (e) {
            if (e.target.closest && e.target.closest('[data-shelf-close]')) { dlg.close(); return; }

            var tab = e.target.closest ? e.target.closest('[data-shelf-tab]') : null;
            if (tab) { showTab(tab.getAttribute('data-shelf-tab')); return; }

            var drop = e.target.closest ? e.target.closest('[data-shelf-drop]') : null;
            if (drop) {
                var shelf = readShelf();
                delete shelf.q[drop.getAttribute('data-shelf-drop')];
                writeShelf(shelf);
                syncShelfMarks(shelf);
                syncShelfBadge(shelf);
                render();
                return;
            }
            if (e.target === dlg) dlg.close();   // 落在遮罩上（dialog 自身区域）才收
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                if (!armed) {
                    // 两步确认：足迹是几个月的阅读时间，不该被一次误点抹掉。
                    armed = Date.now();
                    clearBtn.classList.add('is-armed');
                    clearBtn.textContent = '再点一次，清空全部';
                    window.setTimeout(function () {
                        if (!armed) return;
                        armed = 0;
                        clearBtn.classList.remove('is-armed');
                        clearBtn.textContent = '清空';
                    }, 4000);
                    return;
                }
                armed = 0;
                clearBtn.classList.remove('is-armed');
                clearBtn.textContent = '清空';
                shelfStopped = true;
                writeShelf(emptyShelf());
                var fresh = emptyShelf();
                syncShelfMarks(fresh);
                syncShelfBadge(fresh);
                render();
            });
        }

        dlg.addEventListener('close', function () {
            shelfRerender = null;
            if (opener && opener.focus) opener.focus();
        });

        showTab('queue');
        return {
            open: function (from) {
                opener = from || null;
                shelfRerender = render;
                shelfFresh = true;
                dlg.showModal();
                render();
            }
        };
    }

    /** 文章页：每 5 秒结算一次足迹，读完就把这条从待读队列摘掉。 */
    function initShelfTracking() {
        var body = document.getElementById('post-body');
        if (!body) return;
        var page = shelfFromPage();
        if (!page.p || !page.t) return;

        var reportedMs = 0;
        var lastPct = -1;

        function flush(force) {
            if (shelfStopped) return;
            var pct = Math.round(readRatio() * 100);
            var gained = visibleMs() - reportedMs;
            if (!force && pct === lastPct && gained < 1000) return;
            lastPct = pct;

            var shelf = readShelf();
            var e = shelf.f[page.p];
            if (!e || typeof e !== 'object') e = shelf.f[page.p] = { r: 0, ms: 0, at: 0 };
            e.t = page.t;
            if (page.c) e.c = page.c;
            if (page.m) e.m = page.m;
            if (page.w) e.w = page.w;
            if (pct > (e.r || 0)) e.r = pct;
            e.at = Date.now();

            if (gained > 0) {
                e.ms = (e.ms || 0) + gained;
                reportedMs += gained;
                var key = dayKey(Date.now());
                shelf.d[key] = (shelf.d[key] || 0) + gained;
            }
            // 读完了就摘出「稍后再读」：这条不需要再被提醒，留在架上只会让角标虚高。
            // 与 §7 的 clearResume 是同一个阈值，两边的判断不会打架。
            var dropped = false;
            if (e.r >= 98) {
                e.r = 100;
                if (shelf.q[page.p]) {
                    delete shelf.q[page.p];
                    dropped = true;
                }
            }
            writeShelf(shelf);
            if (dropped || force) {
                syncShelfMarks(shelf);
                syncShelfBadge(shelf);
            }
            if (shelfRerender) shelfRerender();
        }

        window.setInterval(function () { flush(false); }, 5000);
        window.addEventListener('pagehide', function () { flush(true); });
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') flush(true);
        });
        flush(true);
    }

    function initShelf() {
        var drawer = initShelfDrawer();
        var marks = document.querySelectorAll('[data-shelf-add]');
        if (!drawer && !marks.length) return;

        if (!drawer) {
            // 老浏览器没有 <dialog>，抽屉没有承载面，把入口收掉而不是留一个
            // 点了没反应的按钮；书签本身仍然可用，它只是往 localStorage 写一条。
            var opens = document.querySelectorAll('[data-shelf-open]');
            for (var i = 0; i < opens.length; i++) {
                var item = opens[i].closest('.nav-shelf');
                if (item) item.hidden = true;
            }
        }

        var shelf = readShelf();
        syncShelfMarks(shelf);
        syncShelfBadge(shelf);

        // 直接绑在按钮上，不做 document 委托：顶栏导航那条链上有 stopPropagation
        // （实测委托监听根本收不到 .nav-shelf-btn 的点击），委托写法会让抽屉打不开。
        var binds = document.querySelectorAll('[data-shelf-add], [data-shelf-open]');
        for (var j = 0; j < binds.length; j++) {
            (function (el) {
                el.addEventListener('click', function (e) {
                    e.preventDefault();
                    if (el.hasAttribute('data-shelf-open')) {
                        if (drawer) drawer.open(el);
                        return;
                    }
                    toggleShelfQueue(el);
                });
            })(binds[j]);
        }

        initShelfTracking();
    }

    /* ------------------------------------------------------------------
     * 15. 篇末收束层
     * ------------------------------------------------------------------ */

    // 划到文末那一刻是「读完」这个动作唯一被感知的瞬间，也是唯一值得打断读者的位置。
    // 先把这一篇的用时、覆盖、字数结算出来（数字来自本地，不请求任何服务），
    // 再递两个留存动作：进书架、把刚读过的那句话做成图。
    function initWrapUp() {
        var body = document.getElementById('post-body');
        var card = document.getElementById('wrap-up');
        if (!body || !card) return;

        var chars = parseInt(body.getAttribute('data-chars'), 10) || 0;
        var heads = body.querySelectorAll('h2, h3');
        var note = card.querySelector('[data-wrap-note]');
        var done = false;
        var ticking = false;

        function put(what, text) {
            var cell = card.querySelector('[data-wrap="' + what + '"]');
            if (cell) cell.textContent = text;
        }

        /** 已滚过视口中线的章节数 —— 比百分比更能说明「读没读全」。 */
        function passedSections() {
            var n = 0;
            for (var i = 0; i < heads.length; i++) {
                if (heads[i].getBoundingClientRect().top < window.innerHeight * .5) n++;
            }
            return n;
        }

        function settle() {
            if (done) return;
            done = true;
            var pct = Math.round(readRatio() * 100);
            var read = pct >= 98 ? chars : Math.round(chars * pct / 100);

            put('time', humanizeMs(visibleMs()));
            put('sections', heads.length ? passedSections() + ' / ' + heads.length + ' 节' : '—');
            put('chars', read ? humanizeChars(read) : '—');

            card.hidden = false;
            // 类名与 hidden 分开用：hidden 是「这块存不存在」，is-in 只管入场动画，
            // 减少动态效果时前者照常、后者在样式里被关掉。
            card.classList.add('is-in');
        }

        function onScroll() {
            if (ticking || done) return;
            ticking = true;
            window.requestAnimationFrame(function () {
                ticking = false;
                if (done) return;
                // 短文一屏就读完，永远不会有滚动事件：这种情况下直接结算。
                if (document.documentElement.scrollHeight - window.innerHeight <= 0) { settle(); return; }
                if (readRatio() >= .96) settle();
            });
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('load', onScroll);
        onScroll();

        var quoteBtn = card.querySelector('[data-wrap-quote]');
        if (quoteBtn) {
            quoteBtn.addEventListener('click', function () {
                if (quoteCardCtl && quoteCardCtl.openFromSelection()) {
                    if (note) note.hidden = true;
                    return;
                }
                if (!note) return;
                // 没有选区（或选的是代码、太长太短）时不静默失败：说清楚要点哪颗按钮之前先做什么。
                note.hidden = false;
                note.textContent = quoteCardCtl
                    ? '先在正文里选中一句 8~150 字的话，再回来点这里。'
                    : '当前浏览器不支持卡片画布，请改用截图。';
            });
        }
    }

    function boot() {
        initTheme();
        initToc();
        initTocDrawer();
        initReadingProgress();
        initCodeCopy();
        initPalette();
        initTouchDropdown();
        initAnchorScroll();
        initHeadingAnchors();
        initResume();
        initLightbox();
        initReveal();
        initCountUp();
        initFabAutoTuck();
        initReaderPrefs();
        initLinkPreview();
        initQuoteCard();
        initShelf();
        initWrapUp();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
