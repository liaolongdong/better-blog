/**
 * 阅读报告页（/stats.html）。
 *
 * 数据源只有 localStorage 的 `shelf`，与 dev/js/editorial.js §14 同一份结构：
 *   { q: { path: {t,c,m,at} }, f: { path: {t,c,m,w,r,ms,at} }, d: { 'YYYY-MM-DD': ms } }
 * 这一页只读不写；字段名与 editorial.js 的 SHELF_KEY / dayKey 约定同名，改结构时两处
 * 必须一起改。页面是 noindex 的，入口在书架抽屉页脚。
 */
(function () {
    'use strict';

    var BASE = window.SITE_BASEURL || '';
    var SHELF_KEY = 'shelf';
    var DAY_MS = 24 * 60 * 60 * 1000;

    function emptyShelf() {
        return { q: {}, f: {}, d: {} };
    }

    /** 与 editorial.js §14 的 readShelf 同口径：坏一块只丢那一块，不整只书架归零。 */
    function readShelf() {
        var shelf = emptyShelf();
        var raw = null;
        try { raw = localStorage.getItem(SHELF_KEY); } catch (e) { return shelf; }
        if (!raw) return shelf;
        var data = null;
        try { data = JSON.parse(raw); } catch (e) { return shelf; }
        if (!data || typeof data !== 'object') return shelf;
        ['q', 'f', 'd'].forEach(function (zone) {
            if (data[zone] && typeof data[zone] === 'object') shelf[zone] = data[zone];
        });
        return shelf;
    }

    function hasOwn(obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
    }

    function countKeys(obj) {
        var n = 0;
        for (var k in obj) {
            if (hasOwn(obj, k)) n++;
        }
        return n;
    }

    function dayKey(ts) {
        var dt = new Date(ts);
        var m = dt.getMonth() + 1;
        var d = dt.getDate();
        return dt.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);
    }

    function parseDay(key) {
        var parts = String(key).split('-');
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }

    function humanizeMs(ms) {
        var sec = Math.max(Math.round(ms / 1000), 0);
        if (sec < 60) return sec + ' 秒';
        var min = Math.round(sec / 60);
        if (min < 60) return min + ' 分钟';
        return Math.floor(min / 60) + ' 小时 ' + (min % 60) + ' 分';
    }

    function humanizeAgo(ts) {
        if (!ts) return '较早';
        var days = Math.floor((Date.now() - ts) / DAY_MS);
        if (days <= 0) return '今天';
        if (days === 1) return '昨天';
        if (days < 30) return days + ' 天前';
        return dayKey(ts);
    }

    function setText(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    /** 一行「标签 / 条 / 数值」。label 是文本或 <a>，全部用 DOM 建，不拼 HTML。 */
    function barRow(label, value, ratio) {
        var li = document.createElement('li');
        var labelWrap = document.createElement('span');
        labelWrap.className = 'stats-bar-label';
        labelWrap.appendChild(label);
        var track = document.createElement('span');
        track.className = 'stats-bar-track';
        var fill = document.createElement('i');
        fill.className = 'stats-bar-fill';
        fill.style.width = Math.max(0, Math.min(100, Math.round(ratio * 100))) + '%';
        track.appendChild(fill);
        var val = document.createElement('span');
        val.className = 'stats-bar-value';
        val.textContent = value;
        li.appendChild(labelWrap);
        li.appendChild(track);
        li.appendChild(val);
        return li;
    }

    function addNone(list, text) {
        var li = document.createElement('li');
        li.className = 'stats-none';
        li.textContent = text;
        list.appendChild(li);
    }

    function renderHeatmap(days) {
        var heatmap = document.getElementById('stats-heatmap');
        if (!heatmap) return;
        heatmap.textContent = '';
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        // 从本周一往回推四周，得到 5 个完整自然周（35 格）；今天之后的格子留空。
        var mondayOffset = (today.getDay() + 6) % 7;
        var start = new Date(today);
        start.setDate(start.getDate() - mondayOffset - 28);

        var active = 0;
        var totalMs = 0;

        for (var i = 0; i < 35; i++) {
            var date = new Date(start);
            date.setDate(start.getDate() + i);
            var cell = document.createElement('span');
            cell.className = 'stats-day';
            cell.setAttribute('aria-hidden', 'true');

            if (date.getTime() > today.getTime()) {
                cell.classList.add('is-future');
                cell.title = '尚未到';
                heatmap.appendChild(cell);
                continue;
            }

            var ms = days[dayKey(date.getTime())] || 0;
            var minutes = Math.round(ms / 60000);
            var level = 0;
            if (ms > 0) {
                active++;
                totalMs += ms;
                level = minutes < 10 ? 1 : minutes < 30 ? 2 : minutes < 60 ? 3 : 4;
            }
            cell.dataset.level = String(level);
            cell.title = dayKey(date.getTime()) + ' · ' + (ms > 0 ? minutes + ' 分钟' : '没有记录');
            heatmap.appendChild(cell);
        }

        var summary = active
            ? '近五周有 ' + active + ' 天在阅读，累计 ' + humanizeMs(totalMs)
            : '近五周还没有阅读记录';
        setText('stats-heat-summary', summary);
        heatmap.setAttribute('aria-label', '近五周每日阅读时长热力图：' + summary);
    }

    function renderCategories(shelf) {
        var list = document.getElementById('stats-cats');
        if (!list) return;
        list.textContent = '';
        var counts = {};
        var paths = Object.keys(shelf.f);
        for (var i = 0; i < paths.length; i++) {
            var e = shelf.f[paths[i]];
            if (e && e.c) counts[e.c] = (counts[e.c] || 0) + 1;
        }
        var rows = Object.keys(counts).map(function (name) {
            return { name: name, count: counts[name] };
        }).sort(function (a, b) {
            return b.count - a.count || a.name.localeCompare(b.name);
        }).slice(0, 6);

        if (!rows.length) {
            addNone(list, '还没有分类记录');
            return;
        }
        var max = rows[0].count;
        rows.forEach(function (row) {
            list.appendChild(barRow(document.createTextNode(row.name), row.count + ' 篇', row.count / max));
        });
    }

    function renderSeries(shelf) {
        var list = document.getElementById('stats-series');
        var dataEl = document.getElementById('stats-series-data');
        if (!list) return;
        list.textContent = '';
        var series = [];
        try {
            series = dataEl ? JSON.parse(dataEl.textContent) : [];
        } catch (e) {
            series = [];
        }
        if (!Array.isArray(series)) series = [];

        var rows = [];
        series.forEach(function (s) {
            var posts = Array.isArray(s.posts) ? s.posts : [];
            if (!posts.length) return;
            var read = 0;
            var done = 0;
            posts.forEach(function (p) {
                var rec = shelf.f[BASE + p.url] || shelf.f[p.url];
                if (rec && rec.r > 0) {
                    read++;
                    if (rec.r >= 98) done++;
                }
            });
            if (read > 0) {
                rows.push({ title: s.title, slug: s.slug, read: read, done: done, total: posts.length });
            }
        });

        rows.sort(function (a, b) {
            return (b.done / b.total) - (a.done / a.total) || b.read - a.read || a.title.localeCompare(b.title);
        });

        if (!rows.length) {
            addNone(list, '还没有开始任何合集');
            return;
        }
        rows.slice(0, 6).forEach(function (row) {
            var a = document.createElement('a');
            a.href = BASE + '/series.html#' + encodeURIComponent(row.slug);
            a.textContent = row.title;
            list.appendChild(barRow(a, row.done + '/' + row.total, row.done / row.total));
        });
    }

    function renderRecent(shelf) {
        var list = document.getElementById('stats-recent');
        if (!list) return;
        list.textContent = '';
        var rows = Object.keys(shelf.f).map(function (path) {
            return { path: path, e: shelf.f[path] };
        }).filter(function (row) {
            return row.e && typeof row.e === 'object';
        }).sort(function (a, b) {
            return (b.e.at || 0) - (a.e.at || 0);
        }).slice(0, 6);

        if (!rows.length) {
            addNone(list, '还没有阅读足迹');
            return;
        }
        var shown = 0;
        rows.forEach(function (row) {
            // 书架路径由本站写入，正常是 /better-blog/...；这里仍然要求解析后的 origin
            // 与本站相同，避免 localStorage 被手工改成 //host、/\host 或 javascript:
            // 之后在报告里变成一条可点链接。正则挡不住反斜杠被浏览器当成斜杠的情况。
            var href = null;
            try {
                href = new URL(row.path, window.location.origin);
            } catch (e) {
                return;
            }
            if (href.origin !== window.location.origin) return;
            var li = document.createElement('li');
            var a = document.createElement('a');
            a.href = href.href;
            a.textContent = row.e.t || row.path;
            var meta = document.createElement('span');
            var bits = [];
            if (row.e.c) bits.push(row.e.c);
            if (row.e.r) bits.push(row.e.r + '%');
            bits.push(humanizeAgo(row.e.at));
            meta.textContent = bits.join(' · ');
            li.appendChild(a);
            li.appendChild(meta);
            list.appendChild(li);
            shown++;
        });
        if (!shown) addNone(list, '还没有阅读足迹');
    }

    function renderQueue(shelf) {
        var queue = Object.keys(shelf.q).map(function (path) {
            return shelf.q[path];
        }).filter(function (e) {
            return e && typeof e === 'object';
        });
        var minutes = queue.reduce(function (sum, e) {
            return sum + (parseInt(e.m, 10) || 0);
        }, 0);
        var summary = queue.length
            ? queue.length + ' 篇待读' + (minutes ? ' · 约 ' + minutes + ' 分钟' : '')
            : '队列空了，去书架加几篇';
        setText('stats-queue-summary', summary);

        var btn = document.getElementById('stats-open-shelf');
        if (btn && !btn.getAttribute('data-bound')) {
            btn.setAttribute('data-bound', '1');
            btn.addEventListener('click', function () {
                var opener = document.querySelector('[data-shelf-open]');
                if (opener) opener.click();
            });
        }
    }

    function init() {
        var shelf = readShelf();
        var report = document.getElementById('stats-report');
        var empty = document.getElementById('stats-empty');
        if (!report || !empty) return;

        // 只计算可见时长的总和（shelf.d）；足迹里的 ms 与 d 是同一笔账的两个落点。
        var days = shelf.d;
        var totalMs = 0;
        var recentDays = 0;
        for (var key in days) {
            if (!hasOwn(days, key) || !(days[key] > 0)) continue;
            totalMs += days[key];
            if (Date.now() - parseDay(key).getTime() <= 30 * DAY_MS) recentDays++;
        }

        var readCount = countKeys(shelf.f);
        var queueCount = countKeys(shelf.q);
        var hasData = readCount > 0 || queueCount > 0 || totalMs > 0;

        if (!hasData) {
            empty.hidden = false;
            report.hidden = true;
            return;
        }

        empty.hidden = true;
        report.hidden = false;

        // 连续天数：今天没读就从昨天起算，避免每天零点准时归零。
        var streak = 0;
        var cursor = new Date();
        cursor.setHours(0, 0, 0, 0);
        if (!(days[dayKey(cursor.getTime())] > 0)) cursor.setDate(cursor.getDate() - 1);
        while (streak < 400 && days[dayKey(cursor.getTime())] > 0) {
            streak++;
            cursor.setDate(cursor.getDate() - 1);
        }

        setText('stats-hero-read', readCount ? readCount + ' 篇' : '—');
        setText('stats-hero-time', totalMs ? humanizeMs(totalMs) : '—');
        setText('stats-hero-streak', streak ? streak + ' 天' : '—');
        setText('stats-hero-days', recentDays ? recentDays + ' 天' : '—');

        renderHeatmap(days);
        renderCategories(shelf);
        renderSeries(shelf);
        renderRecent(shelf);
        renderQueue(shelf);

        var raf = window.requestAnimationFrame || function (fn) { return window.setTimeout(fn, 0); };
        raf(function () { report.classList.add('is-ready'); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
