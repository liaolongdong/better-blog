/**
 * 文章页的「听这篇」。只在 _layouts/post.html 加载，不进全站公共脚本。
 *
 * 为什么单开一本而不是塞进 editorial.js：editorial.min.js 每页都发，gzip 只剩
 * 约 1.6KB 余量（check-sw 的 17,408B 上限）。朗读只在文章页用，拆成一本按页加载，
 * 既不动主预算，也不会让首页/工具页多背一段用不到的代码。
 *
 * 三个克制的地方：
 * 1. 不用云端 TTS、不发请求：只走浏览器自带的 speechSynthesis；
 * 2. 不支持或没有中文声音时按钮保持 hidden，不给一颗按了没反应的按钮；
 * 3. 按句/段切块，单块 ≤120 字。Chrome 的长 utterance 会在十几秒后被截断，
 *    切块比把整篇一次性喂进去稳。
 */
(function (window, document) {
    'use strict';

    /* ------------------------------------------------------------------
     * 摘录本（本机）
     * ------------------------------------------------------------------ */
    // 与「金句卡」分键：卡片是当场生成的一张图，摘录是要攒起来、可导出 Markdown 的文本。
    // 结构固定为 { v: 1, items: [{ id, u, t, x, at }] }，/excerpts.html 与这里共用。
    var EXCERPT_KEY = 'excerpts';

    function readExcerpts() {
        var raw = null;
        try { raw = localStorage.getItem(EXCERPT_KEY); } catch (e) { return []; }
        if (!raw) return [];
        var data = null;
        try { data = JSON.parse(raw); } catch (e) { return []; }
        if (Array.isArray(data)) return data;
        return data && Array.isArray(data.items) ? data.items : [];
    }

    function writeExcerpts(items) {
        try {
            localStorage.setItem(EXCERPT_KEY, JSON.stringify({ v: 1, items: items }));
            return true;
        } catch (e) {
            return false;
        }
    }

    function newExcerptId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    window.BBExcerpts = {
        list: readExcerpts,
        add: function (item) {
            var text = String((item && item.x) || '').replace(/\s+/g, ' ').trim();
            if (text.length < 8 || text.length > 500) return 'invalid';
            var items = readExcerpts();
            var url = (item && item.u) || window.location.pathname;
            for (var i = 0; i < items.length; i += 1) {
                if (items[i].u === url && items[i].x === text) return 'dup';
            }
            items.unshift({
                id: newExcerptId(),
                u: url,
                t: String((item && item.t) || document.title).trim().slice(0, 120),
                x: text,
                at: Date.now()
            });
            if (items.length > 300) items.length = 300;
            return writeExcerpts(items) ? 'ok' : 'fail';
        },
        remove: function (id) {
            return writeExcerpts(readExcerpts().filter(function (it) { return it.id !== id; }));
        },
        clear: function () {
            try { localStorage.removeItem(EXCERPT_KEY); return true; } catch (e) { return false; }
        }
    };

    /**
     * 把「存摘录」接进 editorial.js §13 已经建好的 .quote-bar 药丸。
     * 不自己再造一颗浮层：两个浮层会抢同一个选区、同一套定位与收起时机。
     */
    function initExcerptBar() {
        var body = document.getElementById('post-body');
        if (!body || !window.getSelection) return;

        // 鼠标按在药丸上会把选区收掉，click 里再读 getSelection() 就为空。
        // 所以按下时先拦住默认收缩，同时留一份最近一次合规选区的快照兜底。
        var lastText = '';

        function current() {
            var sel = window.getSelection();
            if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
            var text = String(sel.toString()).replace(/\s+/g, ' ').trim();
            if (text.length < 8 || text.length > 500) return null;
            var anchor = sel.anchorNode;
            if (!anchor || !body.contains(anchor)) return null;
            var node = anchor.nodeType === 1 ? anchor : anchor.parentNode;
            if (node && node.closest && node.closest('pre, code')) return null;
            return text;
        }

        function place(bar) {
            var vp = document.documentElement.clientWidth;
            var w = bar.offsetWidth;
            var left = parseFloat(bar.style.left);
            if (isNaN(left)) return;
            if (left + w > vp - 12) bar.style.left = Math.max(12, vp - w - 12) + 'px';
        }

        function ensureButton() {
            var bar = document.querySelector('.quote-bar');
            if (!bar || bar.hidden) return;
            var selected = current();
            if (!selected) return;
            lastText = selected;
            var btn = bar.querySelector('.quote-bar-excerpt');
            if (!btn) {
                btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'quote-bar-btn quote-bar-excerpt';
                btn.textContent = '存摘录';
                btn.setAttribute('aria-label', '把选中的文字存为摘录');
                btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
                btn.addEventListener('click', function () {
                    var text = current() || lastText;
                    if (!text) {
                        btn.textContent = '选区失效';
                    } else {
                        var heading = document.querySelector('.post-masthead-title');
                        var title = heading ? heading.textContent : document.title;
                        var result = window.BBExcerpts.add({ u: window.location.pathname, t: title, x: text });
                        btn.textContent = result === 'ok' ? '已存' : (result === 'dup' ? '已存过' : '存不下');
                    }
                    window.setTimeout(function () { btn.textContent = '存摘录'; }, 1400);
                });
                bar.appendChild(btn);
            }
            place(bar);
        }

        var pending = false;
        document.addEventListener('selectionchange', function () {
            if (pending) return;
            pending = true;
            window.requestAnimationFrame(function () {
                pending = false;
                ensureButton();
            });
        });

        // 第一次划词时 .quote-bar 是 editorial.js 在同一次选区回调里建的；
        // 两边的 rAF 谁先谁后不保证，所以除了 selectionchange 再盯一次 bar 的插入：
        // 它一进 DOM 就把按钮补上，随后按新宽度把浮层钳回视口。
        if (window.MutationObserver) {
            new window.MutationObserver(function () { ensureButton(); })
                .observe(document.body, { childList: true });
        }
    }

    initExcerptBar();

    /* ------------------------------------------------------------------
     * 复制全文 Markdown
     * ------------------------------------------------------------------ */
    // 只把正文（#post-body）转成 Markdown，不复制导航、目录、相关阅读与评论。
    // 不引 Turndown：这一页只用到标题/段落/列表/代码块/图片/链接/引用/表格几类节点，
    // 一份 100 行的序列化器比多一个依赖更好审。
    function initMarkdownCopy() {
        var body = document.getElementById('post-body');
        var copyBtn = document.querySelector('[data-copy-markdown]');
        if (!body || !copyBtn) return;

        function abs(url) {
            try { return new URL(url, window.location.href).href; } catch (e) { return url || ''; }
        }

        // 正文里会出现 `<head>`、`<source type="image/jxl">` 这类字面量，不转义的话
        // 复制出去的 Markdown 会被渲染器当成原始 HTML 吞掉；`**` 也会把后面的字变成粗体。
        // 只转义 Markdown 的 ASCII 标点，中文标点保持原样。
        function mdText(value) {
            return String(value == null ? '' : value).replace(/([\\`*_\[\]<>])/g, '\\$1');
        }

        function inline(node) {
            if (!node) return '';
            if (node.nodeType === 3) return mdText(node.nodeValue.replace(/\s+/g, ' '));
            if (node.nodeType !== 1) return '';
            var tag = node.tagName.toLowerCase();
            if (node.classList && node.classList.contains('heading-anchor')) return '';
            if (tag === 'br') return '  \n';
            if (tag === 'img') {
                return '![' + mdText(node.getAttribute('alt') || '') + '](' + abs(node.getAttribute('src') || '') + ')';
            }
            if (tag === 'code') return '`' + node.textContent + '`';
            if (tag === 'strong' || tag === 'b') return '**' + inlineChildren(node) + '**';
            if (tag === 'em' || tag === 'i') return '*' + inlineChildren(node) + '*';
            if (tag === 'a') {
                var href = node.getAttribute('href');
                var label = inlineChildren(node);
                return href ? '[' + label + '](' + abs(href) + ')' : label;
            }
            return inlineChildren(node);
        }

        function inlineChildren(node) {
            var out = '';
            for (var i = 0; i < node.childNodes.length; i += 1) out += inline(node.childNodes[i]);
            return out;
        }

        function textOf(node) {
            return inlineChildren(node).replace(/[ \t]+/g, ' ').trim();
        }

        function table(node) {
            var rows = [];
            var trs = node.querySelectorAll('tr');
            for (var i = 0; i < trs.length; i += 1) {
                var cells = [];
                for (var j = 0; j < trs[i].children.length; j += 1) {
                    cells.push(textOf(trs[i].children[j]).replace(/\|/g, '\\|'));
                }
                if (cells.length) rows.push(cells);
            }
            if (!rows.length) return '';
            var out = ['| ' + rows[0].join(' | ') + ' |', '| ' + rows[0].map(function () { return '---'; }).join(' | ') + ' |'];
            for (var k = 1; k < rows.length; k += 1) out.push('| ' + rows[k].join(' | ') + ' |');
            return out.join('\n') + '\n\n';
        }

        function block(node, depth) {
            if (!node) return '';
            if (node.nodeType === 3) {
                var bare = mdText(node.nodeValue.replace(/\s+/g, ' '));
                return bare.trim() ? bare.trim() + '\n\n' : '';
            }
            if (node.nodeType !== 1) return '';
            var tag = node.tagName.toLowerCase();
            if (/^h[1-6]$/.test(tag)) {
                return new Array(Number(tag.charAt(1)) + 1).join('#') + ' ' + textOf(node) + '\n\n';
            }
            if (tag === 'p') return textOf(node) + '\n\n';
            if (tag === 'img') return inline(node) + '\n\n';
            if (tag === 'pre') {
                var codeEl = node.querySelector('code');
                var code = (codeEl || node).textContent.replace(/\n+$/, '');
                var lang = '';
                if (codeEl) {
                    var m = /(?:^|\s)language-([\w-]+)/.exec(codeEl.className || '');
                    if (m) lang = m[1].toLowerCase();
                }
                var fence = code.indexOf('```') >= 0 ? '````' : '```';
                return fence + lang + '\n' + code + '\n' + fence + '\n\n';
            }
            if (tag === 'ul' || tag === 'ol') {
                var lines = [];
                var indent = new Array(depth + 1).join('  ');
                for (var i = 0; i < node.children.length; i += 1) {
                    var li = node.children[i];
                    if (li.tagName.toLowerCase() !== 'li') continue;
                    var marker = tag === 'ol' ? (i + 1) + '.' : '-';
                    lines.push(indent + marker + ' ' + textOf(li).replace(/\n+/g, ' '));
                }
                return lines.join('\n') + '\n\n';
            }
            if (tag === 'blockquote') {
                var inner = blocks(node).trim();
                if (!inner) return '';
                return inner.split('\n').map(function (line) { return '> ' + line; }).join('\n') + '\n\n';
            }
            if (tag === 'figure') {
                var img = node.querySelector('img');
                var cap = node.querySelector('figcaption');
                var out = img ? inline(img) + '\n\n' : '';
                if (cap) out += '*' + textOf(cap) + '*\n\n';
                return out;
            }
            if (tag === 'table') return table(node);
            if (tag === 'hr') return '---\n\n';
            return blocks(node);
        }

        function blocks(node) {
            var out = '';
            for (var i = 0; i < node.childNodes.length; i += 1) out += block(node.childNodes[i], 0);
            return out;
        }

        function articleMarkdown() {
            var heading = document.querySelector('.post-masthead-title');
            var title = mdText(heading ? heading.textContent.trim() : document.title);
            var md = blocks(body).replace(/\n{3,}/g, '\n\n').trim();
            return '# ' + title + '\n\n> 来源：' + window.location.href.split('#')[0] + '\n\n' + md + '\n';
        }

        function fallbackCopy(text) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'absolute';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
            document.body.removeChild(ta);
            return ok;
        }

        function copy(text) {
            if (navigator.clipboard && window.isSecureContext) {
                return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
            }
            return Promise.resolve(fallbackCopy(text));
        }

        copyBtn.hidden = false;
        copyBtn.title = '复制标题、正文与来源为 Markdown';
        copyBtn.addEventListener('click', function () {
            copy(articleMarkdown()).then(function (ok) {
                copyBtn.textContent = ok ? '已复制全文' : '复制失败';
                window.setTimeout(function () { copyBtn.textContent = '复制全文'; }, 1600);
            });
        });

        // 量具/控制台可用：verify 脚本不需要为了读转换结果再走一次剪贴板权限。
        window.BBMarkdown = { fromArticle: articleMarkdown };
    }

    initMarkdownCopy();

    var btn = document.querySelector('[data-listen-article]');
    if (!btn) return;
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') return;

    var body = document.getElementById('post-body');
    if (!body) return;

    var synth = window.speechSynthesis;
    var label = btn.querySelector('.listen-text');
    var glyph = btn.querySelector('.listen-glyph');
    var stopBtn = document.querySelector('[data-listen-stop]');
    var state = 'idle'; // idle | speaking | paused
    var queue = [];
    var index = 0;
    var generation = 0;

    function pickVoice() {
        var voices = synth.getVoices ? synth.getVoices() : [];
        for (var i = 0; i < voices.length; i += 1) {
            if (/^zh/i.test(voices[i].lang || '')) return voices[i];
        }
        return null;
    }

    function setState(next) {
        state = next;
        var speaking = state === 'speaking';
        var paused = state === 'paused';
        if (label) label.textContent = speaking ? '暂停' : (paused ? '继续' : '听这篇');
        if (glyph) glyph.textContent = speaking ? 'Ⅱ' : '▶';
        btn.setAttribute('aria-pressed', speaking ? 'true' : 'false');
        btn.title = speaking ? '暂停朗读' : (paused ? '继续朗读' : '用浏览器语音朗读本文');
        if (stopBtn) stopBtn.hidden = state === 'idle';
    }

    function pushChunk(out, text) {
        var s = String(text || '').replace(/\s+/g, ' ').trim();
        while (s.length > 120) {
            out.push(s.slice(0, 120));
            s = s.slice(120);
        }
        if (s) out.push(s);
    }

    function collect() {
        var out = [];
        var seen = {};
        var nodes = body.querySelectorAll('h2, h3, p, li, blockquote');
        for (var i = 0; i < nodes.length; i += 1) {
            var node = nodes[i];
            if (node.closest && node.closest('pre, code, .toc-static, .wrap-up, .post-faq, .heading-anchor')) continue;
            // 外层 li/blockquote 若还包着 p，交给内层读，避免同一段念两遍。
            if (node.querySelector && node.querySelector('p, li, blockquote')) continue;
            var text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
            if (!text || text.length < 2 || seen[text]) continue;
            seen[text] = true;
            var parts = text.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [text];
            for (var j = 0; j < parts.length; j += 1) pushChunk(out, parts[j]);
        }
        return out;
    }

    function finish() {
        index = 0;
        setState('idle');
    }

    function speakNext() {
        if (index >= queue.length) {
            finish();
            return;
        }
        var utter = new window.SpeechSynthesisUtterance(queue[index]);
        index += 1;
        var myGen = generation;
        var voice = pickVoice();
        if (voice) utter.voice = voice;
        utter.lang = 'zh-CN';
        utter.rate = 1;
        utter.pitch = 1;
        utter.onend = function () {
            if (myGen !== generation) return;
            if (state === 'speaking') speakNext();
        };
        utter.onerror = function (e) {
            if (myGen !== generation) return;
            if (e && (e.error === 'canceled' || e.error === 'interrupted')) return;
            if (state === 'speaking') speakNext();
        };
        try {
            synth.speak(utter);
        } catch (err) {
            finish();
        }
    }

    function start() {
        generation += 1;
        try { synth.cancel(); } catch (err) { /* 某些 WebView 没有 cancel，照常往下走 */ }
        queue = collect();
        index = 0;
        if (!queue.length) {
            btn.hidden = true;
            return;
        }
        setState('speaking');
        speakNext();
    }

    btn.addEventListener('click', function () {
        if (state === 'speaking') {
            try { synth.pause(); } catch (err) { return; }
            setState('paused');
            return;
        }
        if (state === 'paused') {
            try { synth.resume(); } catch (err) { return; }
            setState('speaking');
            return;
        }
        start();
    });

    function stop() {
        generation += 1;
        try { synth.cancel(); } catch (err) { /* 同上 */ }
        index = 0;
        queue = [];
        setState('idle');
    }

    if (stopBtn) stopBtn.addEventListener('click', stop);

    // 离开文章就停：浏览器通常会在导航时自己取消，但 SPA 式转场与 bfcache
    // 不保证这一点，显式 cancel 一次，避免下一篇还听见上一篇的声音。
    window.addEventListener('pagehide', stop);

    btn.hidden = false;
    setState('idle');
})(window, document);
