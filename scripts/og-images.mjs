#!/usr/bin/env node
/**
 * 为没有 cover 的文章生成 1200×630 的分享卡（og:image），并维护 _data/og_images.yml。
 *
 * 为什么要有这个脚本：没有 cover 的文章与页面一律落到站点兜底图
 * assets/img/social-default.jpg——同一张图发给所有内容，转发行里认不出是哪篇，
 * 标题信息等于白送不要。
 *
 * 覆盖两族：`_posts` 里没有 cover 的篇目，以及 `_data/onlineTools.yml` 里每条
 * `status: ready` 的工具页 + 工具箱枢纽页。后一族原本**压根不在遍历范围内**（早先只走
 * `_posts`），于是全站意图最强的那几个地址——/tools.html 与每一条 ready 的在线工具页——共用一张兜底图。
 *
 * 为什么产物入库、构建期不出图：GitHub Pages 的构建镜像里没有 Chrome，而中文标题
 * 必须真实排版才能定字号（见 cardHtml 的注释）。所以图在本地生成、提交进仓库。
 * `--check` 是配套的自检：完整校验，缺图或过期以非零码退出，不写任何文件。
 * 它已在 CI 的门禁清单里（`jekyll.yml` 的 `gate 'check-og-images'`），分享卡漂移会直接卡住部署。
 *
 * 用法：
 *   node scripts/og-images.mjs            只画缺失或过期的卡，重写 _data/og_images.yml
 *   node scripts/og-images.mjs --all      连未过期的一起重画（改过模板就用这条）
 *   node scripts/og-images.mjs --check    只校验并以非零码报告问题
 *   node scripts/og-images.mjs --print    只打印清单，不启动浏览器、不写文件
 *
 * 视觉规则复用金句卡（dev/js/editorial.js §13）：同一套纸色/墨色/信号色令牌、
 * 同一条 5px 顶部色带，等宽体走元信息、衬线走标题。
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = 'assets/img/og'; // 相对仓库根
const MANIFEST = '_data/og_images.yml';
const W = 1200;
const H = 630;
const QUALITY = 86;

const argv = process.argv.slice(2);
const HAS = (f) => argv.includes(f);

const abs = (p) => path.join(ROOT, p);
const rel = (p) => path.relative(ROOT, p);
const readText = (p) => fs.readFileSync(p, 'utf8');
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/* ------------------------------------------------------------------ *
 * 1. front matter
 * ------------------------------------------------------------------ */

/**
 * 读一篇稿子的 front matter。
 *
 * 只认「一行一个 key: value」的标量：卡片用到的是 title / date / categories /
 * cover / slug，全部是标量或单行数组。缩进块、锚点、多行字符串仓库里没有，
 * 遇到不认识的行直接跳过，不让一个怪字段带走整表。
 *
 * @param {string} file _posts/xxx.md 的路径
 * @returns {Record<string, string>}
 */
function parseFm(file) {
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(readText(file));
    const out = {};
    if (!m) return out;
    for (const line of m[1].split(/\r?\n/)) {
        if (/^\s*(#|$)/.test(line)) continue; // 注释与被注释掉的 `# cover:` 都不当真
        const kv = /^([A-Za-z0-9_-]+):\s*(.*?)\s*$/.exec(line);
        if (!kv) continue;
        out[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
    }
    return out;
}

/**
 * 拼 Jekyll 真正会发出的 URL。
 *
 * :title 取自文件名去掉 `YYYY-MM-DD-` 前缀，但 front matter 的 slug 会覆盖它；
 * 而 permalink 里的 :year/:month/:day 取自 date 字段而非文件名——仓库里有四处
 * 文件名日期与 date 不一致的存量文章（逐条记录在 _data/series.yml 文件头），
 * 拿文件名日期拼出来的卡片地址会全部落空。
 */
function postUrl(file, fm) {
    const seg = fm.slug || path.basename(file, '.md').replace(/^\d{4}-\d{2}-\d{2}-/, '');
    const [y, mo, da] = String(fm.date).slice(0, 10).split('-');
    return { url: `/${y}/${mo}/${da}/${seg}.html`, seg };
}

/** 卡片上印的、会影响像素的字段。任一变了，已生成的图就是过期件。 */
const cardFace = (fm) => ({
    title: fm.title || '',
    date: String(fm.date).slice(0, 10),
    category: String(fm.categories || '').replace(/^\[|\]$/g, '').split(',')[0].trim(),
});

const sigOf = (o) => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 12);

/**
 * 把 _posts 分成「走 front matter cover」「需要卡片」「本就不该出卡」三堆。
 *
 * 「本就不该出卡」有两种，都必须在 --check 里保持安静，否则每次跑都吐一堆假警报：
 * 有 cover 的（卡片优先级轮不到它）、日期在未来的（Jekyll 默认 future: false，
 * 这种稿子压根不会被构建，给它出图就是往仓库里塞一张永远没人引用的 jpg）。
 */
function collect() {
    const wanted = [];
    const covered = [];
    const skipped = [];
    const now = new Date();
    for (const f of fs.readdirSync(abs('_posts')).filter((x) => x.endsWith('.md')).sort()) {
        const file = abs(path.join('_posts', f));
        const fm = parseFm(file);
        if (!fm.date || !fm.title) {
            skipped.push({ file: f, why: !fm.date ? '无 date' : '无 title' });
            continue;
        }
        if (new Date(`${String(fm.date).slice(0, 10)}T00:00:00`) > now) {
            skipped.push({ file: f, why: `date ${String(fm.date).slice(0, 10)} 在未来，Jekyll 不会构建它` });
            continue;
        }
        const { url, seg } = postUrl(file, fm);
        if (fm.cover) {
            covered.push({ url, image: fm.cover });
            continue;
        }
        const face = cardFace(fm);
        const sig = sigOf(face);
        const name = `${seg}.jpg`;
        wanted.push({ url, name, asset: `/${OUT_DIR}/${name}`, disk: abs(`${OUT_DIR}/${name}`), sig, ...face });
    }
    return { wanted, covered, skipped };
}

/* ------------------------------------------------------------------ *
 * 1b. 工具页与枢纽页
 * ------------------------------------------------------------------ */

/**
 * 卡片右上那一格（模板里的 `.date`）在文章上是发布日，在页面上没有日期可放，
 * 于是放的是**这页自己已经写过的说法**，不是这里新造的营销词：
 *   - 工具页 → 「输入不出本机」。四条 ready 的 yml `desc` 各自承诺过输入不发请求、不上传
 *     （证件：「所有输入只留在本机，不发请求、不上传、不写 localStorage」；编码：文件
 *     「字节在浏览器里读完就算，不上传、不留存」；JSON：「输入只在本地解析：不发请求、
 *     不上传，默认不写 localStorage，勾了「记住上次输入」才写本机」；对比：「不上传、
 *     不发请求、不读写 localStorage」）。JSON 那一档的 opt-in 写的是 localStorage，
 *     那是本机存储、不是出机器，所以「不出本机」这句仍然成立；
 *   - 枢纽页 → 「本地优先 · 开源可审计」，取的是 tools.html 自己那句话（原话用顿号，
 *     卡片这一格是等宽体元信息行，换成中点排版，词没换）。
 * 这两串是**卡片自己的说明文字**，所以住在这里；页面事实仍然只活在那两份源里。
 * 但别把它读成「有一道门盯着这两串与源一致」——没有。改这两串不会红，
 * 改了 tools.html 或 yml `desc` 里那句承诺也不会红。要对齐的是读代码的人。
 */
const PAGE_META = {
    hub: { category: '插件与在线工具', date: '本地优先 · 开源可审计' },
    tool: { category: '在线工具', date: '输入不出本机' },
};

/**
 * 读 `_data/onlineTools.yml` 的条目顶层字段。
 *
 * 只认「列表项自己那层的一行 `key: value`」：条目起始是顶格的 `- slug:`，它的字段在两个
 * 空格上；再往里（四个空格起）是 `panels:` / `features:` / 折行 `desc` 的正文，一概不收。
 * 这和 parseFm 是同一条口径——本仓库这两份文件都不是给人手改的通用 YAML，而是已知形状，
 * 认不出来的行直接跳过，不让一个怪字段带走整表。
 *
 * 为什么不在这里复用 `scripts/check-tools-surface.mjs` 的 `readYml`：那本是被计划文档
 * 逐字节镜像的**门禁**，import 它会把「生成器」和「收录面门禁」耦成一件事——它一被变异，
 * 出图脚本跟着一起坏，而两者坏掉的症状完全不同。
 */
function readToolEntries() {
    /** 与 parseFm 同一条取值口径：去外层引号。少了这一步，`title: "身份证校验"` 会把引号画进卡片。 */
    const val = (s) => s.replace(/^["']|["']$/g, '');
    const out = [];
    let cur = null;
    for (const raw of readText(abs('_data/onlineTools.yml')).split('\n')) {
        const start = /^- ([A-Za-z0-9_-]+):\s*(.*?)\s*$/.exec(raw);
        if (start) {
            cur = { [start[1]]: val(start[2]) };
            out.push(cur);
            continue;
        }
        if (!cur) continue; // 文件头的说明块，缩进再深也不该被当成字段
        const kv = /^  ([A-Za-z0-9_-]+):\s*(.*?)\s*$/.exec(raw);
        if (kv) cur[kv[1]] = val(kv[2]);
    }
    return out;
}

/**
 * 拼出该出卡的页面清单。标题一格都不新写：
 * 工具页取 yml 的 `title`（模版的 og:title、CollectionPage 的 name、页面 H1 三方对账由
 * check-tools-surface 的「页面源」组盯着），枢纽页取它自己 front matter 的
 * `seo_short_title`——那正是 seoMeta.html 给它发出去的 og:title。
 *
 * @param {Array<{url: string, name: string}>} postCards 文章卡片名，用来挡同名撞车
 */
function collectPages(postCards) {
    const rows = [];
    const hubFm = parseFm(abs('tools.html'));
    const hubTitle = (hubFm.seo_short_title || hubFm.title || '').trim();
    if (!hubTitle) throw new Error('tools.html 的 front matter 读不出 seo_short_title / title，枢纽页卡片无法命名');
    rows.push({ url: '/tools.html', title: hubTitle, ...PAGE_META.hub });

    const tools = readToolEntries().filter((t) => t.status === 'ready');
    if (!tools.length) throw new Error('_data/onlineTools.yml 里没有 status: ready 的条目，出图无事可做');
    for (const t of tools) {
        const url = (t.url || '').trim();
        const title = (t.title || '').trim();
        if (!/^\/tools\/[\w-]+\.html$/.test(url)) throw new Error(`${t.slug}: url="${url}" 不是 /tools/<slug>.html 的形状，卡片名会拼歪`);
        if (!title) throw new Error(`${t.slug}: yml 没有 title，卡片无法命名`);
        rows.push({ url, title, ...PAGE_META.tool });
    }

    const seen = new Set();
    for (const r of rows) {
        if (seen.has(r.url)) throw new Error(`${r.url}: 页面清单里出现两次，台账只能留一条`);
        seen.add(r.url);
        const name = `page-${r.url.replace(/^\//, '').replace(/\.html$/, '').replace(/\//g, '-')}.jpg`;
        if (postCards.some((w) => w.name === name)) throw new Error(`${r.url}: 卡片名 ${name} 与一篇同 slug 文章的卡片同名`);
        r.name = name;
        r.asset = `/${OUT_DIR}/${name}`;
        r.disk = abs(`${OUT_DIR}/${name}`);
        // sig 用与 cardFace 同一组键序（title, date, category）：两族内容共用一把尺子，
        // 否则"同一个 sigOf"会因为键序不同而给出两套哈希，将来没人在对账时能看出这是两件事。
        r.sig = sigOf({ title: r.title, date: r.date, category: r.category });
    }
    return rows;
}

/* ------------------------------------------------------------------ *
 * 2. _data/og_images.yml
 * ------------------------------------------------------------------ */

/**
 * yml 头注释里有一段说明文字，正文是 `url:` + 缩进的两行字段。
 * 只解析自己写出去的这个形状——它不是给人手改的，所以不需要容错到通用 YAML。
 * @returns {Record<string, {image?: string, sig?: string}>}
 */
function loadManifest() {
    const out = {};
    if (!fs.existsSync(abs(MANIFEST))) return out;
    let url = null;
    for (const raw of readText(abs(MANIFEST)).split('\n')) {
        const line = raw.replace(/\s+$/, '');
        if (!line.trim() || line.trim().startsWith('#')) continue;
        if (/^\s/.test(raw)) {
            const kv = /^\s+([a-z]+):\s*(.*)$/.exec(line);
            if (kv && url) out[url][kv[1]] = kv[2];
            continue;
        }
        if (!line.endsWith(':')) continue;
        url = line.slice(0, -1);
        out[url] = {};
    }
    return out;
}

/**
 * 封面取值表：page.url -> 用哪张图。
 *
 * cover 那几篇也登记进来，不是给它们抢优先级（seoMeta.html 仍然 cover 优先），
 * 而是让 --check 能把「有 cover、所以本就不该有卡片」和「漏了」区分开，
 * 顺带把每条 cover 指向的文件是否存在一起量一遍。
 */
function writeManifest({ wanted, covered, pages }) {
    const rows = [
        ...covered.map((c) => [c.url, { image: c.image }]),
        ...wanted.map((w) => [w.url, { image: w.asset, sig: w.sig }]),
        ...pages.map((p) => [p.url, { image: p.asset, sig: p.sig }]),
    ].sort((a, b) => (a[0] < b[0] ? -1 : 1));

    const body = rows.map(([u, v]) => `${u}:\n  image: ${v.image}${v.sig ? `\n  sig: ${v.sig}` : ''}`).join('\n');

    fs.writeFileSync(abs(MANIFEST), `# 分享卡片（og:image）的取值表：page.url -> 用哪张图。
# 由 scripts/og-images.mjs 生成，请勿手改：新增文章或改了文章标题/日期/分类之后，
# 跑 \`node scripts/og-images.mjs\` 重画并刷新这张表（--check 会揪出没刷新的提交）。
# seoMeta.html 只在 front matter 没有 cover 时查这张表；表里 cover 那几篇的条目
# 是「已经安排好了」的记录，作用是让自检能分清「有 cover」和「漏生成」。
# 页那一族（/tools.html 与每一条 ready 的在线工具页）走的是同一张表、同一个 sig 口径：
# 键就是 page.url，模版直接按它取值，不需要任何一条模板分支。
${body}
`);
    return rows.length;
}

/* ------------------------------------------------------------------ *
 * 3. 卡片模板
 * ------------------------------------------------------------------ */

let fontCache = null;
/** 两个 webfont 以 base64 内联：模板要能在 file:// 下独立打开，不依赖站点服务。 */
function fonts() {
    if (!fontCache) {
        fontCache = {
            display: fs.readFileSync(abs('assets/fonts/newsreader-latin-var.woff2')).toString('base64'),
            meta: fs.readFileSync(abs('assets/fonts/ibm-plex-mono-latin-400.woff2')).toString('base64'),
        };
    }
    return fontCache;
}

/**
 * 一张卡的完整 HTML。
 *
 * 字号交给页面自己量，不在 Node 里估：中文按字宽排、拉丁按比例字宽排，Node 里
 * 没有这两套度量。估大了标题溢出卡片（JPEG 里被裁掉，事后没人看得出来），估小了
 * 留一片空白。这里用真实的 Songti SC + Newsreader 从 96px 逐档降，取「还塞得下
 * 标题所在那块舞台」的最大值——舞台高度由 flex 剩出来，行数因此不用猜。
 */
function cardHtml(c) {
    const f = fonts();
    const payload = JSON.stringify({
        title: c.title,
        date: c.date,
        category: c.category,
        host: 'liaolongdong.github.io',
    }).replace(/<\//g, '<\\/'); // 标题里若出现 </ 会提前关掉这段内联 JSON

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>og card</title>
<style>
@font-face{font-family:'Display';src:url(data:font/woff2;base64,${f.display}) format('woff2');font-weight:400 700;font-style:normal}
@font-face{font-family:'Plex';src:url(data:font/woff2;base64,${f.meta}) format('woff2');font-weight:400}
:root{
    --paper:#FAF9F6;--ink:#14161A;--ink-2:#33373E;--ink-4:#A6ABB2;
    --rule:#E6E2D9;--signal:#0F62FE;
    --display:'Display',Georgia,'Songti SC','STSong','Noto Serif CJK SC','Source Han Serif SC',SimSun,serif;
    --meta:'Plex','SF Mono',Menlo,Consolas,'Courier New',monospace
}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{background:var(--paper);color:var(--ink);font-family:var(--display);-webkit-font-smoothing:antialiased}
.card{position:relative;height:100%;padding:52px 72px 0;display:flex;flex-direction:column}
.card::before{content:'';position:absolute;left:0;top:0;width:100%;height:5px;background:var(--signal)}
/* 右下那个淡圆是给纯色底留的一点呼吸，压在文字栏下方不参与排版 */
.card::after{content:'';position:absolute;right:-96px;bottom:-132px;width:380px;height:380px;
    border:1px solid var(--rule);border-radius:50%}
.meta{display:flex;align-items:baseline;justify-content:space-between;
    font-family:var(--meta);font-size:22px;color:var(--ink-4)}
.meta .cat{color:var(--signal)}
.rule{height:1px;background:var(--rule);margin-top:22px}
/* 标题在剩下的整块空间里垂直居中：短标题不会在中间留出一大片空白 */
.stage{flex:1;display:flex;align-items:center;position:relative}
.title{font-weight:600;font-size:96px;line-height:1.2;letter-spacing:-.01em}
.foot{padding-bottom:48px;display:flex;align-items:baseline;justify-content:space-between;position:relative}
.foot .brand{font-size:30px;font-weight:500;color:var(--ink-2)}
.foot .brand i{font-style:italic;font-weight:400}
.foot .host{font-family:var(--meta);font-size:21px;color:var(--ink-4)}
</style>
</head>
<body>
<div class="card">
    <div class="meta"><span class="cat"></span><span class="date"></span></div>
    <div class="rule"></div>
    <div class="stage"><h1 class="title"></h1></div>
    <div class="foot">
        <span class="brand">Better<i>’</i> study fairyland</span>
        <span class="host"></span>
    </div>
</div>
<script type="application/json" id="d">${payload}</script>
<script>
(function () {
    var d = JSON.parse(document.getElementById('d').textContent);
    document.querySelector('.cat').textContent = d.category;
    document.querySelector('.date').textContent = d.date;
    document.querySelector('.host').textContent = d.host;
    var t = document.querySelector('.title');
    t.textContent = d.title;
    // 从 96 起逐档降 2，取「还塞得下这块舞台」的最大字号。舞台高度是 flex 剩出来的，
    // 所以短标题会一路顶到 96，长标题自动落到 40 上下——不靠行数猜。
    var stage = document.querySelector('.stage').getBoundingClientRect();
    for (var s = 96; s > 28; s -= 2) {
        t.style.fontSize = s + 'px';
        if (t.scrollHeight <= Math.floor(stage.height)) break;
    }
}());
</script>
</body>
</html>`;
}

/* ------------------------------------------------------------------ *
 * 4. headless Chrome（CDP 直连，不引 Playwright）
 * ------------------------------------------------------------------ */

const CHROME_CANDIDATES = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean);

function findChrome() {
    for (const p of CHROME_CANDIDATES) if (fs.existsSync(p)) return p;
    throw new Error('找不到 Chrome，请设置 CHROME_PATH 指向可执行文件');
}

/** --remote-debugging-port=0 时端口由系统分配，Chrome 把它写进 profile 的第一个文件里。 */
function readPort(profile) {
    const file = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 160; i++) {
        if (fs.existsSync(file)) {
            const port = Number.parseInt(fs.readFileSync(file, 'utf8').split('\n')[0], 10);
            if (port > 0) return port;
        }
        sleepSync(250);
    }
    throw new Error('Chrome 没有写出 DevToolsActivePort');
}

/**
 * 取 Chrome 的 webSocketDebuggerUrl。
 *
 * 端口文件写出来之后，HTTP 端点还要晚一小会儿才肯应答；机器上同时跑着别的
 * headless Chrome 时这段能到几秒，所以一次 fetch 超时就断定「起不来」是不成立的，
 * 必须轮询到超时为止。
 */
async function debugInfo(port) {
    const url = `http://127.0.0.1:${port}/json/version`;
    for (let i = 0; i < 60; i++) {
        try {
            const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
            if (r.ok) return await r.json();
        } catch {
            /* 还没起来，接着等 */
        }
        await new Promise((res) => setTimeout(res, 500));
    }
    throw new Error(`调试端口 ${port} 上的 /json/version 迟迟没有响应`);
}

/** 极简 CDP 客户端：id 自增 + 按 sessionId/method 分派事件。 */
async function connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
        const timer = setTimeout(() => rej(new Error('CDP WebSocket 握手超时')), 30000);
        ws.onopen = () => {
            clearTimeout(timer);
            res();
        };
        ws.onerror = () => {
            clearTimeout(timer);
            rej(new Error('CDP WebSocket 连接失败'));
        };
    });
    let n = 0;
    const pending = new Map();
    const waiters = new Map();

    ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id) {
            const settle = pending.get(msg.id);
            if (!settle) return;
            pending.delete(msg.id);
            clearTimeout(settle.timer);
            msg.error ? settle.rej(new Error(JSON.stringify(msg.error))) : settle.res(msg.result);
            return;
        }
        if (!msg.method) return;
        const key = `${msg.sessionId || ''}|${msg.method}`;
        const list = waiters.get(key);
        if (list) for (const fn of list.splice(0)) fn(msg.params);
    };

    return {
        send(method, params = {}, sessionId) {
            return new Promise((res, rej) => {
                const id = ++n;
                const timer = setTimeout(() => {
                    pending.delete(id);
                    rej(new Error(`${method} 超时`));
                }, 60000);
                pending.set(id, { res, rej, timer });
                ws.send(JSON.stringify({ id, method, params, sessionId }));
            });
        },
        waitFor(method, sessionId, ms = 30000) {
            const key = `${sessionId || ''}|${method}`;
            return new Promise((res, rej) => {
                const list = waiters.get(key) || [];
                const timer = setTimeout(() => rej(new Error(`等待 ${method} 超时`)), ms);
                list.push((p) => {
                    clearTimeout(timer);
                    res(p);
                });
                waiters.set(key, list);
            });
        },
        close() {
            ws.close();
        },
    };
}

/**
 * 把每张卡的 HTML 截成 ${W}x${H} JPEG。
 *
 * 不引 Playwright 是因为装不上：本机 macOS 13 被拒装 chromium 与 ffmpeg（见
 * 仓库外的个人备忘）。这里只需要「导航 / 等字体 / 截图」三件事，CDP 原生够用。
 */
async function shoot(jobs) {
    const bin = findChrome();
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'og-chrome-'));
    const proc = spawn(
        bin,
        [
            '--headless=new',
            '--remote-debugging-port=0',
            `--user-data-dir=${profile}`,
            '--disable-gpu',
            '--hide-scrollbars',
            '--force-device-scale-factor=1',
            '--allow-file-access-from-files',
        ],
        { stdio: 'ignore' }
    );

    try {
        const port = readPort(profile);
        const info = await debugInfo(port);
        const cdp = await connect(info.webSocketDebuggerUrl);
        const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
        const at = (m, p) => cdp.send(m, p, sessionId);

        await at('Page.enable', {});
        await at('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

        for (let i = 0; i < jobs.length; i++) {
            const { html, disk } = jobs[i];
            const loaded = cdp.waitFor('Page.loadEventFired', sessionId);
            await at('Page.navigate', { url: `file://${html}` });
            await loaded;
            // base64 的 @font-face 是异步解码的：不等字距就位就按下去，
            // 截到的是系统衬线版，字宽不同、autofit 挑的字号也不同。
            await at('Runtime.evaluate', { expression: 'document.fonts.ready.then(function(){return 1})', awaitPromise: true });
            const shot = await at('Page.captureScreenshot', {
                format: 'jpeg',
                quality: QUALITY,
                clip: { x: 0, y: 0, width: W, height: H, scale: 1 },
                captureBeyondViewport: false,
            });
            fs.writeFileSync(disk, Buffer.from(shot.data, 'base64'));
            process.stdout.write(`  ${String(i + 1).padStart(2)}/${jobs.length} ${path.basename(disk)}\n`);
        }
        await cdp.send('Target.closeTarget', { targetId });
        cdp.close();
    } finally {
        proc.kill('SIGKILL');
        sleepSync(400);
        fs.rmSync(profile, { recursive: true, force: true });
    }
}

/* ------------------------------------------------------------------ *
 * 5. 自检
 * ------------------------------------------------------------------ */

/** 从 JPEG 的 SOF 段读固有宽高，不依赖第三方库。 */
function jpegDims(file) {
    if (!fs.existsSync(file)) return null;
    const b = fs.readFileSync(file);
    for (let i = 2; i < b.length - 9; i++) {
        if (b[i] !== 0xff) continue;
        const marker = b[i + 1];
        if (marker === 0xda || marker === 0xd9) break;
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
        }
        i += 2 + b.readUInt16BE(i + 2);
    }
    return null;
}

/**
 * 五件事，任一不过都是非零退出：
 *   1. 表里每条 image 指向的文件在磁盘上（含 front matter 的 cover）；
 *   2. 每张卡片确实是 ${W}x${H}（模板改坏、截图被裁都会中）；
 *   3. 该有卡片的篇目在表里、且 sig 与当前 front matter 对得上（对不上＝像素过期）；
 *   3b. 走 cover 的篇目也在表里、且记的就是那枚 cover（表是生成器的台账，缺一格就是一次意外 diff）；
 *   3c. 该有卡片的页面（枢纽页 + ready 工具页）在表里且 sig 对得上，表里也不许躺已死的页面行；
 *   4. assets/img/og 下不躺孤儿 jpg（删了文章、改了 slug 之后剩下的旧卡）；
 *   5. 表里的每个 page.url 在 _site 里真有一个页面（_site 存在时才做，见函数体注释）。
 */
function verify({ wanted, covered, pages }) {
    const manifest = loadManifest();
    const problems = [];

    /**
     * 形状先于磁盘：这张表的值会被 `_includes/seoMeta.html` 拼进 `content="…"`，
     * 一句带引号或尖括号的值就能破出属性。模板那侧现在自己转义了，这里再守一道——
     * 判据口径抄 `check-tools-surface.mjs` 的「插件数据面」那一组（同一把尺子，
     * 不另立一份）：只禁能破出上下文的字符，查询串照旧放行。
     */
    const UNSAFE = /["'<>\\\s\x00-\x1f]/;
    for (const [url, v] of Object.entries(manifest)) {
        const img = v.image || '';
        if (!/^(https?:\/\/|\/(?!\/))/.test(img)) problems.push(`${url}: image="${img}" 不是站内绝对路径，也不是 http(s) 绝对地址`);
        else if (UNSAFE.test(img)) problems.push(`${url}: image 含引号/尖括号/反斜杠/空白/控制符，会破出 meta content 属性`);
    }

    for (const [url, v] of Object.entries(manifest)) {
        const img = v.image || '';
        if (img.includes('://')) continue; // 外链 cover 由 seoMeta.html 那道闸处理，不查磁盘
        if (!fs.existsSync(abs(img))) problems.push(`${url}: 表指向 ${img}，磁盘上没有`);
    }

    for (const w of wanted) {
        const v = manifest[w.url];
        if (!v) problems.push(`${w.url}: 既无 cover 也不在表里（卡片漏生成）`);
        else if (v.image !== w.asset) problems.push(`${w.url}: 表里记的是 ${v.image || '空'}，生成器现在要写的是 ${w.asset}`);
        else if (v.sig !== w.sig) problems.push(`${w.url}: 卡片内容已变（${v.sig || '无'} -> ${w.sig}），需要重画`);
    }

    /**
     * 有 cover 的篇目也要在表里，且记的就是那枚 cover。原先只判 `wanted`，于是「表少了
     * 一条 cover 型条目」一句都不报——渲染侧确实无感（分享卡的三级取值链第一级就是 cover），
     * 但这张表是**生成器会写的那份台账**：少一条的意义是下一次 `pnpm og:images` 凭空多出
     * 一个 diff，而"跑一遍生成器才知道台账不齐"正是要靠 `--check` 消掉的那类意外。
     */
    for (const c of covered) {
        const v = manifest[c.url];
        if (!v) problems.push(`${c.url}: 有 front matter cover 却不在表里（跑一次生成器就会凭空多一条 diff）`);
        else if (v.image !== c.image) problems.push(`${c.url}: 表里记的是 ${v.image || '空'}，front matter 的 cover 已经是 ${c.image}`);
    }

    /**
     * 页面那一族双向判：yml 少一条 ready 工具页（改了 status、删了条目）与表里躺着一行
     * 已经不该存在的页面行，各自单独红。只判「该有卡片的在不在」的话，把某条的
     * `status: ready` 摘掉之后表里那行会变成一条谁都不认的死行——而孤儿那判扫的是
     * `assets/img/og` 的文件名，表里的死行压根没有症状。
     */
    const pageUrls = new Set(pages.map((p) => p.url));
    for (const p of pages) {
        const v = manifest[p.url];
        if (!v) problems.push(`${p.url}: 页面该有卡片却不在表里（漏生成）`);
        else if (v.image !== p.asset) problems.push(`${p.url}: 表里记的是 ${v.image || '空'}，生成器现在要写的是 ${p.asset}`);
        else if (v.sig !== p.sig) problems.push(`${p.url}: 页面卡片内容已变（${v.sig || '无'} -> ${p.sig}），需要重画`);
    }
    for (const url of Object.keys(manifest)) {
        if (/^\/tools/.test(url) && !pageUrls.has(url)) {
            problems.push(`${url}: 表里有这一行页面卡片，但 onlineTools.yml / tools.html 已经不再声明它（台账死行）`);
        }
    }

    const expect = new Set([...wanted, ...pages].map((w) => w.name));
    if (fs.existsSync(abs(OUT_DIR))) {
        for (const f of fs.readdirSync(abs(OUT_DIR)).sort()) {
            if (!f.endsWith('.jpg')) problems.push(`${f}: 扩展名不是 .jpg`);
            else if (!expect.has(f)) problems.push(`${f}: 表里没有文章或页面引用它（孤儿卡片）`);
        }
    }

    for (const w of [...wanted, ...pages]) {
        const d = jpegDims(w.disk);
        if (!d) problems.push(`${rel(w.disk)}: 读不出尺寸（不是有效 JPEG）`);
        else if (d[0] !== W || d[1] !== H) problems.push(`${rel(w.disk)}: ${d[0]}x${d[1]}，应为 ${W}x${H}`);
    }

    // 表里的键必须是 Jekyll 真正会发出的地址。postUrl() 是在仓库外推算 permalink，
    // 一旦有人给某篇文章加了 slug: 或 permalink:，推算就会偏——偏了不报错，
    // 只是 seoMeta.html 查不到这张卡、静默退回兜底图。_site 在的时候直接对一遍。
    if (fs.existsSync(abs('_site'))) {
        for (const url of Object.keys(manifest)) {
            if (!fs.existsSync(abs(path.join('_site', url)))) {
                problems.push(`${url}: 表里有这个地址，_site 里却没有对应页面（URL 推算与 Jekyll 不一致）`);
            }
        }
    }

    return { problems, manifestCount: Object.keys(manifest).length, coveredCount: covered.length };
}

/* ------------------------------------------------------------------ *
 * main
 * ------------------------------------------------------------------ */

async function main() {
    const { wanted, covered, skipped } = collect();
    const pages = collectPages(wanted);
    const manifest = loadManifest();
    const cards = [...wanted, ...pages];
    const stale = cards.filter((w) => !manifest[w.url] || manifest[w.url].sig !== w.sig);
    const todo = HAS('--all') ? cards : stale;

    if (HAS('--print')) {
        for (const w of wanted) {
            const mark = manifest[w.url]?.sig === w.sig ? '最新' : manifest[w.url] ? '过期' : '缺卡';
            console.log(`${mark}  ${w.url}  ->  ${w.asset}  ${w.category} · ${w.date}  ${w.title}`);
        }
        for (const p of pages) {
            const mark = manifest[p.url]?.sig === p.sig ? '最新' : manifest[p.url] ? '过期' : '缺卡';
            console.log(`${mark}  ${p.url}  ->  ${p.asset}  ${p.category} · ${p.date}  ${p.title}`);
        }
        console.log(`# 需要卡片 ${wanted.length} 篇文章 + ${pages.length} 个页面（其中待画 ${stale.length}）、走 cover ${covered.length} 篇`);
        for (const s of skipped) console.log(`# 跳过 ${s.file}：${s.why}`);
        return;
    }

    console.log(`${wanted.length + covered.length} 篇文章：${wanted.length} 篇无 cover 需要卡片，${covered.length} 篇走 front matter cover。另有 ${pages.length} 个页面（工具箱枢纽 + ready 工具页）。`);
    if (skipped.length) console.log(`跳过 ${skipped.length} 篇：${skipped.map((s) => `${s.file}（${s.why}）`).join('、')}`);

    if (HAS('--check')) {
        if (stale.length) console.log(`${stale.length} 张待生成或重画：\n  ${stale.map((c) => c.asset).join('\n  ')}`);
        const { problems, manifestCount } = verify({ wanted, covered, pages });
        report(problems, `自检通过：表 ${manifestCount} 条，卡片 ${cards.length} 张（文章 ${wanted.length} + 页面 ${pages.length}）全部在磁盘上、尺寸 ${W}x${H}、无孤儿文件。`);
        return;
    }

    if (todo.length) {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'og-src-'));
        fs.mkdirSync(abs(OUT_DIR), { recursive: true });
        const jobs = todo.map((c) => {
            const html = path.join(tmp, `${c.name.replace(/\.jpg$/, '')}.html`);
            fs.writeFileSync(html, cardHtml(c));
            return { html, disk: c.disk };
        });
        console.log(`\n画 ${jobs.length} 张 ${W}x${H} JPEG：`);
        await shoot(jobs);
        fs.rmSync(tmp, { recursive: true, force: true });
    } else {
        console.log('卡片全部为最新，无需重画。');
    }

    const written = writeManifest({ wanted, covered, pages });
    console.log(`\n${MANIFEST}：${written} 条。`);
    const { problems, manifestCount } = verify({ wanted, covered, pages });
    report(problems, `自检通过：表 ${manifestCount} 条，卡片 ${cards.length} 张（文章 ${wanted.length} + 页面 ${pages.length}）全部在磁盘上、尺寸 ${W}x${H}、无孤儿文件。`);
}

function report(problems, okMessage) {
    if (!problems.length) {
        console.log(okMessage);
        return;
    }
    console.error(`\n自检发现 ${problems.length} 个问题：`);
    for (const p of problems) console.error('  - ' + p);
    process.exitCode = 1;
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
