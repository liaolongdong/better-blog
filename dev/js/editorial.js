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

    /**
     * 是否开启了「减少动态效果」。平滑滚动属于可关闭的装饰性动效。
     * @returns {boolean}
     */
    function prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

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
            var link = document.createElement('a');
            link.className = 'toc-link';
            link.href = '#' + heading.id;
            link.textContent = heading.textContent.trim();
            li.appendChild(link);
            list.appendChild(li);
            items.push({ heading: heading, link: link });
        }

        document.body.className += ' has-toc';

        var current = null;
        /** 高亮切换集中在一处，避免 observer 与滚动兜底互相抢状态。 */
        function activate(item) {
            if (!item || current === item) return;
            if (current) current.link.parentNode.classList.remove('is-active');
            current = item;
            item.link.parentNode.classList.add('is-active');
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

    /* ------------------------------------------------------------------
     * 2. 阅读进度条
     * ------------------------------------------------------------------ */

    function initReadingProgress() {
        var bar = document.querySelector('.reading-progress-bar');
        if (!bar) return;

        var ticking = false;
        function update() {
            ticking = false;
            var doc = document.documentElement;
            var scrollable = doc.scrollHeight - window.innerHeight;
            var ratio = scrollable > 0 ? doc.scrollTop / scrollable : 0;
            bar.style.transform = 'scaleX(' + Math.min(Math.max(ratio, 0), 1) + ')';
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
        var corpus = null;
        var loading = null;
        var activeIndex = -1;
        var matches = [];
        var seq = 0;

        function open(trigger) {
            lastTrigger = trigger || null;
            panel.hidden = false;
            document.body.classList.add('cmdk-open');
            input.value = '';
            window.setTimeout(function () { input.focus(); }, 0);
            render('');
        }

        function close() {
            panel.hidden = true;
            document.body.classList.remove('cmdk-open');
            if (lastTrigger) lastTrigger.focus();
        }

        /**
         * 拉取并缓存检索语料。搜索是低频动作，首次唤起时才请求。
         * @returns {Promise<Array>}
         */
        function load() {
            if (corpus) return Promise.resolve(corpus);
            if (!loading) {
                loading = fetch(BASE_URL + '/search.json')
                    .then(function (res) { return res.json(); })
                    .then(function (data) { corpus = data; return data; });
            }
            return loading;
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

        /**
         * 转义 HTML，查询词来自用户输入，必须按文本处理。
         * @param {string} str
         * @returns {string}
         */
        function esc(str) {
            return String(str).replace(/[&<>"]/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
            });
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
            load().then(function (data) {
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
                    return '<li id="cmdk-opt-' + idx + '" class="cmdk-item" role="option" aria-selected="' + (idx === 0 ? 'true' : 'false') + '">'
                        + '<a class="cmdk-item-link" href="' + esc(BASE_URL + item.url) + '">'
                        + '<span class="cmdk-item-title">' + mark(item.title || '', q) + '</span>'
                        + '<span class="cmdk-item-snippet">' + mark(snippet.slice(0, 90), q) + '</span>'
                        + '<span class="cmdk-item-meta">' + meta.join('</span><span class="cmdk-item-meta">') + '</span>'
                        + '</a></li>';
                }).join('');

                for (var k = 0; k < results.children.length; k++) {
                    (function (el, idx) {
                        el.addEventListener('mouseenter', function () { setActive(idx); });
                    })(results.children[k], k);
                }
            });
        }

        function go(url) {
            window.location.href = BASE_URL + url;
        }

        document.addEventListener('click', function (e) {
            var opener = e.target.closest('[data-search-open]');
            if (opener) {
                e.preventDefault();
                open(opener);
                return;
            }
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

    function boot() {
        initToc();
        initReadingProgress();
        initCodeCopy();
        initPalette();
        initTouchDropdown();
        initAnchorScroll();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
