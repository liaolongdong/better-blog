/*!
 * 全站搜索命令面板（⌘K）—— 从 editorial.js §4 拆出的独立延迟加载件。
 *
 * 为什么拆：check-sw.mjs 把每页都载的 editorial.min.js 卡在 17,408B gzip，而它自己的注释
 * 写明了做法——「若再涨，先把命令面板拆成独立延迟加载件，再谈加码」。命令面板是「按一次
 * ⌘K 才用一次」的东西，拆出去之后，从不打开面板的那部分访问一分钱不花。
 *
 * 本文件不出现在任何页面 HTML 里：editorial.js 的 §4 薄桩在第一次遇到 ⌘K / 搜索入口时
 * 注入它，加载完调 window.BBPalette.boot()。离线可用由 sw.js 的骨架清单兜。
 *
 * 共享件走 window.EditorialUtil（语料加载器留在 editorial.js，因为链接预览也用 getCorpus，
 * 两边各养一份缓存就会漂）。取不到时给的是「空语料 / 无操作」的退化实现，
 * 不是「抛异常」——桩在，面板就还能开，只是搜不到东西。
 */
(function () {
    'use strict';

    var U = window.EditorialUtil || {};
    var BASE_URL = U.baseUrl || (window.SITE_BASEURL || '');
    var prefersReducedMotion = U.prefersReducedMotion || function () { return false; };
    var copyText = U.copyText || function () { return Promise.resolve(false); };
    var getCorpus = U.getCorpus || function () { return Promise.resolve([]); };
    var getFullCorpus = U.getFullCorpus || function () { return Promise.resolve([]); };
    // esc 的唯一实现留在 editorial.js（§4 原本用的就是它）。取不到时退到本地等价件——
    // 这条兜底是 2026-10-20 补的：拆包第一版把 esc 放进了「允许的外部依赖」白名单，
    // 却没有真的提供它，于是面板一渲染结果就抛 ReferenceError，而 node --check 与三道
    // 静态门禁全都不会红。只有真跑页面才看得见。
    var esc = U.esc || function (s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
    };

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
        // 输入法组合态。标志位为主、事件上的 isComposing 为辅：Firefox 在「组合中按 Enter」
        // 这一路历史上不发 isComposing，只靠事件属性会漏；keyCode 229 是老 Chrome 的形状。
        var composing = false;
        // 全文模式：一旦用户主动加载过，本次会话里的后续查询都走全文语料。
        var fullTextMode = false;
        var fullBtn = document.getElementById('cmdk-full');

        // 面板打开那一刻记下的入口地址（pathname + search + hash，不含本次输入）。
        // null 表示面板没开，syncUrl 于是任何事都不做。
        var entryUrl = null;

        /**
         * 打开面板。
         * @param {HTMLElement|null} trigger 触发元素（关闭后把焦点还给它）
         * @param {string} [preset] 预填的查询词。深链进站必须一次到位：先开后塞值会渲染两次，
         *   第二次把 .is-fresh 的错峰入场摘掉，观感就是「闪一下才出结果」。
         */
        function open(trigger, preset) {
            // 键盘唤起时没有 trigger：记下此刻的焦点所在，关闭后还给读者，
            // 否则 ⌘K → Esc 之后焦点掉回 body，键盘读者等于每开一次就丢一次位置。
            var ae = document.activeElement;
            lastTrigger = trigger || (ae && ae !== document.body && ae.focus ? ae : null);
            entryUrl = location.pathname + location.search + location.hash;
            panel.hidden = false;
            document.body.classList.add('cmdk-open');
            input.value = preset || '';
            freshNext = true;
            window.setTimeout(function () {
                input.focus();
            }, 0);
            render(input.value);
        }

        function close() {
            panel.hidden = true;
            document.body.classList.remove('cmdk-open');
            syncUrl('');
            entryUrl = null;
            if (lastTrigger) lastTrigger.focus();
        }

        /**
         * 把当前查询写进地址栏。只用 replaceState：一条面板不该产生历史条目。
         *
         * 整段包 try 的理由不是「万一不支持」。boot()（本文件末尾）把 20 个 init 平铺直叙
         * 排下来、没有逐条守护，initPalette 抛出会连带掐死后面 14 项；而 Safari 对
         * replaceState 有明确限流（30 秒内超过 100 次直接抛），快打字加粘贴撞得上。
         * 一次限流抛异常的代价，不该是「这一页的目录、书架、灯箱全没了」。
         * @param {string} value 已 trim 的查询词，空串表示删掉 q
         */
        function syncUrl(value) {
            if (entryUrl === null) return;
            try {
                var u = new URL(entryUrl, location.href);
                if (value) u.searchParams.set('q', value);
                else u.searchParams.delete('q');
                window.history.replaceState(null, '', u.pathname + u.search + u.hash);
            } catch (e) {
                /* 限流/解析失败：这一轮 URL 不跟，检索照常 */
            }
        }

        /** 查询切成词：连续空白算一个分隔符。单词查询切出来就是它自己。 */
        function toTerms(query) {
            return query.split(/\s+/).filter(Boolean);
        }

        /**
         * 给单条结果打分：多个词之间是 AND —— 任一词在四个字段里都拿不到分，整条出局。
         *
         * 单词时走的仍是原来那条 `weights[i] - Math.min(idx, weights[i] - 1)` 的字段求和，
         * 一分没变：J6 拿 HEAD 产物对账，结果集与顺序必须逐条相等。
         * hits 允许出现重复下标（多词各命中同一字段时），消费点只做 indexOf(3) 判断，不去重。
         * @param {Object} item 检索条目
         * @param {string[]} terms 已小写化的词表
         * @returns {{score: number, hits: number[]}} score 为 0 表示不匹配
         */
        function score(item, terms, withBody) {
            var fields = [item.title || '', item.tags || '', item.category || '', item.excerpt || ''];
            var weights = [100, 40, 20, 8];
            // 全文模式追加 body（下标 4，权重 5）；渲染处用 hits.indexOf(4) 判断
            // 是否需要从正文截上下文，元数据命中仍走原来的摘要。
            if (withBody) {
                fields.push(item.body || '');
                weights.push(5);
            }
            var total = 0;
            var hits = [];
            for (var t = 0; t < terms.length; t++) {
                var termScore = 0;
                for (var i = 0; i < fields.length; i++) {
                    var idx = fields[i].toLowerCase().indexOf(terms[t]);
                    if (idx >= 0) {
                        termScore += weights[i] - Math.min(idx, weights[i] - 1);
                        hits.push(i);
                    }
                }
                if (!termScore) return { score: 0, hits: [] };
                total += termScore;
            }
            return { score: total, hits: hits };
        }

        /** 把用户输入当正则字面量使用之前必须转义，否则一个 `(` 就把构造打断。 */
        function escRe(s) {
            return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        /**
         * 用 <mark> 包住每个词的每一次命中，帮用户确认「为什么这条被搜到」。
         *
         * 文本仍是一段一段 esc() 之后再拼（与旧版同一条转义链），词只进正则不进 HTML。
         * 词表按长度降序排：并列的 | 分支取先匹配到的那一支，长词不排前面，
         * 「搜索引擎」就会在同一起点上输给「搜索」。
         * @param {string} text 原文
         * @param {string[]} terms 小写词表
         * @returns {string} 已转义的 HTML 片段
         */
        function mark(text, terms) {
            var s = String(text);
            if (!terms.length) return esc(s);
            var re = new RegExp('(' + terms.slice().sort(function (a, b) { return b.length - a.length; }).map(escRe).join('|') + ')', 'gi');
            var out = '';
            var last = 0;
            var m;
            while ((m = re.exec(s)) !== null) {
                if (!m[0]) { re.lastIndex++; continue; }
                out += esc(s.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
                last = m.index + m[0].length;
            }
            return out + esc(s.slice(last));
        }

        function setActive(next) {
            if (!matches.length || !results.children.length) return;
            activeIndex = (next + matches.length) % matches.length;
            var children = results.children;
            if (!children[activeIndex]) return;
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

        /**
         * 从正文里截一段命中上下文。先找最早出现的词（与 score 的 AND 无关），
         * 向前留 36 个字符，避免结果卡在词的正中间；两端加省略号，让读者知道这不是全文。
         * @param {string} body 已 normalize_whitespace 的正文
         * @param {string[]} terms 小写词表
         * @returns {string}
         */
        function bodySnippet(body, terms) {
            var text = String(body || '');
            if (!terms.length) return text.slice(0, 90);
            var lower = text.toLowerCase();
            var idx = -1;
            for (var i = 0; i < terms.length; i++) {
                var at = lower.indexOf(terms[i]);
                if (at >= 0 && (idx < 0 || at < idx)) idx = at;
            }
            if (idx < 0) return text.slice(0, 90);
            var start = Math.max(0, idx - 36);
            return (start > 0 ? '…' : '') + text.slice(start, start + 90) + (start + 90 < text.length ? '…' : '');
        }

        /**
         * 空查询时显示的动作。它们不占首屏、不额外请求：随机一篇与复制链接
         * 复用 search.json / clipboard，书架与主题复用页面上已有的入口。
         * @returns {Array<{title: string, meta: string, run: Function}>}
         */
        function paletteActions() {
            var actions = [
                {
                    title: '随机一篇',
                    meta: '从全部文章里抽一篇',
                    run: function () {
                        getCorpus().then(function (data) {
                            if (!data || !data.length) return;
                            go(data[Math.floor(Math.random() * data.length)].url);
                        });
                    }
                }
            ];
            if (window.EditorialTheme && document.getElementById('nm-switch')) {
                actions.push({
                    title: '切换主题',
                    meta: '白天 / 夜间',
                    run: function () {
                        window.EditorialTheme.set(document.documentElement.classList.contains('night-mode') ? 'day' : 'night');
                        close();
                    }
                });
            }
            actions.push({
                title: '打开书架',
                meta: '待读与阅读记录',
                run: function () {
                    close();
                    var btn = document.querySelector('[data-shelf-open]');
                    if (btn) btn.click();
                }
            });
            actions.push({
                title: '工具箱',
                meta: '浏览器插件与免安装工具',
                run: function () { go('/tools.html'); }
            });
            actions.push({
                title: '复制当前链接',
                meta: '把当前页地址复制到剪贴板',
                run: function () {
                    copyText(location.href).then(function (ok) {
                        var msg = ok ? '链接已复制' : '复制失败';
                        count.textContent = msg;
                        window.setTimeout(function () {
                            if (count.textContent === msg) count.textContent = '快捷操作 · 输入关键词搜索文章';
                        }, 1600);
                    });
                }
            });
            actions.push({
                title: '返回顶部',
                meta: '滚回页首',
                run: function () {
                    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
                    close();
                }
            });
            return actions;
        }

        /** 动作行没有 url，Enter 与点击都走 item.run；文章行仍走 go(item.url)。 */
        function runAction(idx) {
            var row = matches[idx];
            if (row && row.item && typeof row.item.run === 'function') row.item.run();
        }

        /** 空查询的头屏：动作列表。行结构与文章结果共用 .cmdk-item / setActive。 */
        function renderActions() {
            var actions = paletteActions();
            matches = actions.map(function (action) { return { item: action }; });
            activeIndex = actions.length ? 0 : -1;
            if (fullBtn) fullBtn.hidden = true;
            results.innerHTML = actions.map(function (action, idx) {
                return '<li id="cmdk-opt-' + idx + '" class="cmdk-item" role="option" aria-selected="' + (idx === 0 ? 'true' : 'false') + '" style="--i: ' + idx + '">'
                    + '<button type="button" class="cmdk-item-link cmdk-action">'
                    + '<span class="cmdk-item-title">' + esc(action.title) + '</span>'
                    + '<span class="cmdk-item-snippet">' + esc(action.meta) + '</span>'
                    + '</button></li>';
            }).join('');
            empty.hidden = true;
            count.textContent = '快捷操作 · 输入关键词搜索文章';
            input.removeAttribute('aria-activedescendant');
            if (panelBox) panelBox.classList.toggle('is-fresh', freshNext);
            freshNext = false;
            for (var k = 0; k < results.children.length; k++) {
                (function (el, idx) {
                    var btn = el.querySelector('.cmdk-action');
                    if (btn) btn.addEventListener('click', function () { runAction(idx); });
                    el.addEventListener('mouseenter', function () { setActive(idx); });
                })(results.children[k], k);
            }
            if (actions.length) setActive(0);
        }

        function render(query) {
            var token = ++seq;
            var terms = toTerms(query.trim().toLowerCase());
            if (fullBtn) fullBtn.hidden = !terms.length || fullTextMode;
            if (!terms.length) {
                renderActions();
                return;
            }
            var loader = fullTextMode ? getFullCorpus() : getCorpus();
            loader.then(function (data) {
                // 连续输入会让多次检索并发返回；只渲染最后一次查询的结果，
                // 否则慢响应可能覆盖快响应，出现「输入 b 却显示 a 的结果」。
                if (token !== seq) return;
                if (!data) {
                    // 全文索引加载失败：退回元数据搜索，并把按钮重新露出来，允许再试。
                    fullTextMode = false;
                    if (fullBtn) fullBtn.hidden = !input.value.trim();
                    count.textContent = '';
                    showEmpty('全文索引加载失败', '请检查网络后重试，或继续用标题与摘要搜索');
                    return;
                }
                var scored = [];
                for (var i = 0; i < data.length; i++) {
                    var s = score(data[i], terms, fullTextMode);
                    if (s.score > 0) scored.push({ item: data[i], hits: s.hits, score: s.score });
                }
                scored.sort(function (a, b) { return b.score - a.score; });
                scored = scored.slice(0, 20);

                matches = scored;
                activeIndex = scored.length ? 0 : -1;
                count.textContent = scored.length ? scored.length + ' 条结果' + (fullTextMode ? ' · 全文' : '') : '';
                if (scored.length) empty.hidden = true;
                else showEmpty('没有匹配的文章', defaultSub);

                results.innerHTML = scored.map(function (row, idx) {
                    var item = row.item;
                    var snippet;
                    if (fullTextMode && row.hits.indexOf(4) >= 0) snippet = bodySnippet(item.body, terms);
                    else if (row.hits.indexOf(3) >= 0) snippet = item.excerpt || '';
                    else snippet = item.title || '';
                    var meta = [];
                    if (item.date) meta.push(esc(item.date));
                    if (item.category) meta.push(esc(item.category));
                    if (item.tags) meta.push(esc(item.tags.split(/\s+/).filter(Boolean).slice(0, 2).join(' · ')));
                    return '<li id="cmdk-opt-' + idx + '" class="cmdk-item" role="option" aria-selected="' + (idx === 0 ? 'true' : 'false') + '" style="--i: ' + idx + '">'
                        + '<a class="cmdk-item-link" href="' + esc(BASE_URL + item.url) + '">'
                        + '<span class="cmdk-item-title">' + mark(item.title || '', terms) + '</span>'
                        + '<span class="cmdk-item-snippet">' + mark(snippet.slice(0, 90), terms) + '</span>'
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

        /**
         * 加载全文语料并重绘当前查询。点击「搜索全文」和 ⌘/Ctrl+Enter 共用。
         * 先 ++seq 让正在返回的元数据请求作废；加载失败时退回元数据模式，按钮重新露出。
         */
        function loadFull() {
            var q = input.value.trim();
            if (!q || fullTextMode) return;
            fullTextMode = true;
            seq++;
            if (fullBtn) fullBtn.hidden = true;
            count.textContent = '正在加载全文索引…';
            if (empty) empty.hidden = true;
            results.innerHTML = '';
            // 列表清空后必须同时清掉旧 matches：不然语料加载的 1–2 秒里，
            // ↑↓ 会把 activeIndex 指向一个不存在的行，Enter 还会打开一条看不见的旧结果。
            matches = [];
            activeIndex = -1;
            input.removeAttribute('aria-activedescendant');
            getFullCorpus().then(function (data) {
                if (!data) {
                    fullTextMode = false;
                    if (fullBtn) fullBtn.hidden = !input.value.trim();
                    count.textContent = '';
                    showEmpty('全文索引加载失败', '请检查网络后重试，或继续用标题与摘要搜索');
                    return;
                }
                if (panel.hidden) return;
                render(input.value);
            });
        }

        if (fullBtn) {
            fullBtn.addEventListener('click', loadFull);
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
            // 快捷键 dialog 是模态的：它开着时，搜索面板不能再接 ⌘K、/、↑↓、Enter、Esc，
            // 否则背景里的选中行会被键盘改动，甚至被 Enter 打开。原生 dialog 自己处理 Esc。
            var shortcutsDlg = document.getElementById('shortcuts-dlg');
            if (shortcutsDlg && shortcutsDlg.open) return;
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
            // 组合中的 Esc / ↑ / ↓ / Enter 整组归输入法。放在 panel.hidden 之后，所以 ⌘K 与 `/`
            // 这两个全局入口不受影响。
            if (composing || e.isComposing || e.keyCode === 229) return;
            // 面板里的 Tab 会被下面的输入框监听拦掉，全文按钮因此没有 Tab 路径；
            // 给键盘用户留一条 ⌘/Ctrl+Enter，与点击「搜索全文」走同一个 loadFull。
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                loadFull();
                return;
            }
            if (e.key === 'Escape') { e.preventDefault(); close(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIndex + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIndex - 1); }
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (activeIndex >= 0 && matches[activeIndex] && results.children.length) {
                    var chosen = matches[activeIndex].item;
                    if (typeof chosen.run === 'function') chosen.run();
                    else go(chosen.url);
                }
            }
        });

        input.addEventListener('compositionstart', function () { composing = true; });
        input.addEventListener('compositionend', function () {
            // 收尾必须自己补一遍 render + syncUrl：整场组合里 input 监听是被拦着的，
            // 不补的话屏幕上留的是上一个词的结果、地址栏停在进站那个词上。
            composing = false;
            render(input.value);
            syncUrl(input.value.trim());
        });
        input.addEventListener('input', function () {
            // 候选词还没落定就不重绘：拼音串每跳一次重排一次，打字看着像在闪。
            if (composing) return;
            render(input.value);
            syncUrl(input.value.trim());
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Tab') e.preventDefault();
        });

        // 深链进站。放在所有监听器之后：这一次 open 于是走的是与手动打开完全同一条路径，
        // 错峰入场、setActive(0)、aria-activedescendant 一并生效，不是「看起来像但少了几步」。
        // 读 URLSearchParams 也包 try——同上，一条查询串不许带走 boot() 里后面 14 项能力。
        var preset = '';
        try {
            preset = (new URL(location.href).searchParams.get('q') || '').trim();
        } catch (e) {
            preset = '';
        }
        if (preset) open(null, preset);
    }


    window.BBPalette = {
        boot: initPalette,
        // 这里**不暴露** open：面板的 open 是 initPalette 的局部函数，外层拿不到它。
        // 第一版写了 open: function (t) { open(t, ''); }，那句 open 解析到的是 window.open——
        // 不报错、不开面板，症状是「第一次 ⌘K 按了没反应」，只有真跑浏览器才看得见。
        // 桩改为注入完成后重放同一次交互，交给下面这个 initPalette 自己绑的监听器。
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { initPalette(); });
    } else {
        initPalette();
    }
})();
