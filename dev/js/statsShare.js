/**
 * /stats.html 的「生成阅读报告卡片」。
 *
 * 数据只来自 window.BBStats.summary()（stats.js 暴露的那一份账），不再自己解析
 * localStorage，避免同一套 shelf 结构在两处各写一遍。画布 1200×630，与 og:image
 * 的推荐比例一致；下载/复制都不发请求。
 */
(function (window, document) {
    'use strict';

    var stats = window.BBStats;
    if (!stats) return;

    var btn = document.querySelector('[data-report-card]');
    var dlg = document.getElementById('report-card-dialog');
    var canvas = document.getElementById('report-card-canvas');
    if (!btn || !dlg || !canvas || typeof dlg.showModal !== 'function') return;

    var status = document.querySelector('[data-report-status]');
    var W = 1200;
    var H = 630;
    var summary = stats.summary();
    if (!summary || !summary.hasData) return;

    btn.hidden = false;

    function token(name, fallback) {
        var v = window.getComputedStyle(document.documentElement).getPropertyValue(name);
        return (v && v.trim()) || fallback;
    }

    function say(text) {
        if (status) status.textContent = text;
    }

    function fit(ctx, text, size, weight, family, maxW) {
        var s = size;
        do {
            ctx.font = weight + ' ' + s + 'px ' + family;
            if (ctx.measureText(text).width <= maxW || s <= 16) break;
            s -= 2;
        } while (s > 16);
        return s;
    }

    function paint() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        var ctx = canvas.getContext('2d');
        if (!ctx) return;

        var paper = token('--paper', '#FAF9F6');
        var ink = token('--ink', '#14161A');
        var ink2 = token('--ink-2', '#33373E');
        var ink3 = token('--ink-3', '#6E7480');
        var rule = token('--rule', '#E6E2D9');
        var signal = token('--signal', '#0F62FE');
        var display = "'Newsreader', Georgia, 'Songti SC', serif";
        var sans = "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
        var meta = "'IBM Plex Mono', Menlo, Consolas, monospace";
        var year = new Date().getFullYear();

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = signal;
        ctx.fillRect(0, 0, W, 6);

        ctx.fillStyle = ink3;
        ctx.font = '13px ' + meta;
        ctx.fillText('READING REPORT · ' + year, 56, 62);
        ctx.textAlign = 'right';
        ctx.fillText('LOCAL ONLY · 本机数据', W - 56, 62);
        ctx.textAlign = 'left';

        ctx.fillStyle = ink;
        ctx.font = '700 56px ' + display;
        ctx.fillText('我的阅读报告', 52, 140);

        ctx.fillStyle = ink3;
        ctx.font = '16px ' + sans;
        ctx.fillText('这台设备上的阅读记录，不上传、不追踪。', 52, 176);

        var items = [
            { label: '读完', value: summary.readCount ? summary.readCount + ' 篇' : '—' },
            { label: '累计用时', value: summary.totalMs ? stats.humanizeMs(summary.totalMs) : '—' },
            { label: '连续阅读', value: summary.streak ? summary.streak + ' 天' : '—' }
        ];
        var colW = 330;
        for (var i = 0; i < items.length; i += 1) {
            var x = 52 + i * 366;
            ctx.fillStyle = ink3;
            ctx.font = '14px ' + sans;
            ctx.fillText(items[i].label, x, 258);
            var size = fit(ctx, items[i].value, 54, '700', display, colW);
            ctx.font = '700 ' + size + 'px ' + display;
            ctx.fillStyle = ink;
            ctx.fillText(items[i].value, x, 330);
        }

        ctx.strokeStyle = rule;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(52, 382);
        ctx.lineTo(W - 52, 382);
        ctx.stroke();

        ctx.fillStyle = ink;
        ctx.font = '600 19px ' + sans;
        ctx.fillText('偏好分类', 52, 430);

        var cats = summary.cats || [];
        if (!cats.length) {
            ctx.fillStyle = ink3;
            ctx.font = '15px ' + sans;
            ctx.fillText('还没有分类记录。', 52, 468);
        } else {
            var max = cats[0].count || 1;
            for (var j = 0; j < cats.length; j += 1) {
                var y = 468 + j * 42;
                ctx.fillStyle = ink2;
                ctx.font = '15px ' + sans;
                ctx.fillText(cats[j].name, 52, y);
                var trackX = 236;
                var trackW = 330;
                ctx.fillStyle = rule;
                ctx.fillRect(trackX, y - 10, trackW, 6);
                ctx.fillStyle = signal;
                ctx.fillRect(trackX, y - 10, Math.max(6, Math.round(trackW * cats[j].count / max)), 6);
                ctx.fillStyle = ink3;
                ctx.font = '13px ' + meta;
                ctx.fillText(cats[j].count + ' 篇', trackX + trackW + 14, y);
            }
        }

        ctx.strokeStyle = rule;
        ctx.beginPath();
        ctx.moveTo(52, 566);
        ctx.lineTo(W - 52, 566);
        ctx.stroke();

        ctx.fillStyle = ink3;
        ctx.font = '14px ' + sans;
        ctx.fillText(summary.queueCount ? '待读 ' + summary.queueCount + ' 篇 · 数据只存在本机' : '待读队列空了 · 数据只存在本机', 52, 598);
        ctx.textAlign = 'right';
        ctx.fillStyle = ink;
        ctx.font = '600 16px ' + display;
        ctx.fillText('Better 前端博客', W - 56, 598);
        ctx.textAlign = 'left';

        canvas.setAttribute('aria-label',
            '阅读报告卡片：读完 ' + summary.readCount + ' 篇，累计 ' + stats.humanizeMs(summary.totalMs) +
            '，连续 ' + summary.streak + ' 天。');
    }

    function reset() {
        say('');
        try { summary = stats.summary(); } catch (e) { return false; }
        if (!summary || !summary.hasData) {
            btn.hidden = true;
            return false;
        }
        paint();
        return true;
    }

    btn.addEventListener('click', function () {
        if (!reset()) return;
        dlg.showModal();
    });

    var close = document.querySelector('[data-report-close]');
    if (close) close.addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });

    var dl = document.querySelector('[data-report-download]');
    if (dl) {
        dl.addEventListener('click', function () {
            canvas.toBlob(function (blob) {
                if (!blob) { say('生成图片失败，请改用截图'); return; }
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'reading-report-' + new Date().getFullYear() + '.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
                say('已下载 PNG');
            }, 'image/png');
        });
    }

    var cp = document.querySelector('[data-report-copy]');
    if (cp) {
        cp.addEventListener('click', function () {
            if (!navigator.clipboard || !window.ClipboardItem) {
                say('当前浏览器不支持复制图片，请下载');
                return;
            }
            canvas.toBlob(function (blob) {
                if (!blob) { say('生成图片失败'); return; }
                navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]).then(
                    function () { say('图片已复制到剪贴板'); },
                    function () { say('复制被拒绝，请改用下载'); }
                );
            }, 'image/png');
        });
    }

    // 主题切换时如果卡片开着，按新的纸色/墨色重画一次，避免白底黑字停在夜间页面里。
    if (window.MutationObserver) {
        new window.MutationObserver(function () {
            if (dlg.open) paint();
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
})(window, document);
