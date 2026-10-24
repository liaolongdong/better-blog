/**
 * /excerpts.html 的渲染、删除与导出。
 *
 * 数据源是 localStorage 的 `excerpts`，结构由 dev/js/readerExtras.js 的
 * window.BBExcerpts 维护：{ v: 1, items: [{ id, u, t, x, at }] }。
 * 这一页只读 + 删除/清空，不写新摘录；新摘录在文章页的选区药丸里产生。
 */
(function (window, document) {
    'use strict';

    var list = document.getElementById('excerpt-list');
    if (!list) return;

    var store = window.BBExcerpts;
    var empty = document.querySelector('[data-excerpt-empty]');
    var count = document.querySelector('[data-excerpt-count]');
    var exportBtn = document.querySelector('[data-excerpt-export]');
    var clearBtn = document.querySelector('[data-excerpt-clear]');

    function pad(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function when(ts) {
        var d = new Date(ts);
        return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate());
    }

    /** 存储是本机可写的边界：一条坏数据不该让整页空白，所以逐条验形状再进渲染。 */
    function items() {
        if (!store) return [];
        return store.list().filter(function (it) {
            return it && typeof it.x === 'string' && typeof it.u === 'string' && Number.isFinite(Number(it.at));
        });
    }

    function render() {
        var all = items();
        list.textContent = '';
        if (count) count.textContent = all.length + ' 条';
        if (empty) empty.hidden = all.length > 0;
        if (exportBtn) exportBtn.disabled = all.length === 0;
        if (clearBtn) clearBtn.disabled = all.length === 0;

        all.forEach(function (it) {
            var li = document.createElement('li');
            li.className = 'excerpt-item';

            var meta = document.createElement('p');
            meta.className = 'excerpt-meta';
            var link = document.createElement('a');
            if (/^(\/|https?:\/\/)/i.test(it.u)) link.href = it.u;
            link.textContent = it.t || it.u;
            meta.appendChild(link);
            var time = document.createElement('time');
            time.dateTime = new Date(it.at).toISOString();
            time.textContent = when(it.at);
            meta.appendChild(time);
            li.appendChild(meta);

            var quote = document.createElement('blockquote');
            quote.className = 'excerpt-text';
            quote.textContent = it.x;
            li.appendChild(quote);

            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'excerpt-del';
            del.textContent = '删除';
            del.setAttribute('aria-label', '删除这条摘录');
            del.addEventListener('click', function () {
                if (store) store.remove(it.id);
                render();
            });
            li.appendChild(del);
            list.appendChild(li);
        });
    }

    function exportMarkdown() {
        var all = items();
        if (!all.length) return;
        var lines = ['# 我的摘录', '', '> 从 ' + location.host + ' 摘下的句子；本文件由本机数据导出。', ''];
        all.forEach(function (it) {
            lines.push('## ' + (it.t || it.u));
            lines.push('');
            lines.push('> ' + String(it.x).replace(/\n/g, '\n> '));
            lines.push('');
            lines.push('来源：' + location.origin + it.u);
            lines.push('摘录于：' + new Date(it.at).toLocaleString('zh-CN'));
            lines.push('');
        });
        var blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'excerpts-' + new Date().toISOString().slice(0, 10) + '.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    }

    if (exportBtn) exportBtn.addEventListener('click', exportMarkdown);
    if (clearBtn) {
        clearBtn.addEventListener('click', function () {
            if (!items().length) return;
            if (!window.confirm('清空这台设备上的全部摘录？此操作不可撤销。')) return;
            if (store) store.clear();
            render();
        });
    }

    render();
})(window, document);
