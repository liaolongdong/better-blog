#!/usr/bin/env node
/**
 * 为没有 cover 的文章生成 1200×630 的分享卡（og:image），并维护 _data/og_images.yml。
 *
 * 为什么要有这个脚本：全站 68 篇里 34 篇的 front matter 没有 cover，社交与 SERP 卡片
 * 一律落到站点兜底图 assets/img/social-default.jpg——同一张图发给所有文章，转发行里
 * 认不出是哪篇，标题信息等于白送不要。
 *
 * 为什么产物入库、构建期不出图：GitHub Pages 的构建镜像里没有 Chrome，而中文标题
 * 必须真实排版才能定字号（见 cardHtml 的注释）。所以图在本地生成、提交进仓库。
 * `--check` 是配套的自检：完整校验，缺图或过期以非零码退出，不写任何文件——
 * 但它目前只在本地跑（pnpm og:check），.github/workflows/jekyll.yml 里还没有这一步，
 * 加了会让分享卡漂移直接卡住部署，是否要这道闸门由维护者定。
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
function writeManifest({ wanted, covered }) {
    const rows = [
        ...covered.map((c) => [c.url, { image: c.image }]),
        ...wanted.map((w) => [w.url, { image: w.asset, sig: w.sig }]),
    ].sort((a, b) => (a[0] < b[0] ? -1 : 1));

    const body = rows.map(([u, v]) => `${u}:\n  image: ${v.image}${v.sig ? `\n  sig: ${v.sig}` : ''}`).join('\n');

    fs.writeFileSync(abs(MANIFEST), `# 分享卡片（og:image）的取值表：page.url -> 用哪张图。
# 由 scripts/og-images.mjs 生成，请勿手改：新增文章或改了文章标题/日期/分类之后，
# 跑 \`node scripts/og-images.mjs\` 重画并刷新这张表（--check 会揪出没刷新的提交）。
# seoMeta.html 只在 front matter 没有 cover 时查这张表；表里 cover 那几篇的条目
# 是「已经安排好了」的记录，作用是让自检能分清「有 cover」和「漏生成」。
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
 *   4. assets/img/og 下不躺孤儿 jpg（删了文章、改了 slug 之后剩下的旧卡）；
 *   5. 表里的每个 page.url 在 _site 里真有一个页面（_site 存在时才做，见函数体注释）。
 */
function verify({ wanted, covered }) {
    const manifest = loadManifest();
    const problems = [];

    for (const [url, v] of Object.entries(manifest)) {
        const img = v.image || '';
        if (img.includes('://')) continue; // 外链 cover 由 seoMeta.html 那道闸处理，不查磁盘
        if (!fs.existsSync(abs(img))) problems.push(`${url}: 表指向 ${img}，磁盘上没有`);
    }

    for (const w of wanted) {
        const v = manifest[w.url];
        if (!v) problems.push(`${w.url}: 既无 cover 也不在表里（卡片漏生成）`);
        else if (v.sig !== w.sig) problems.push(`${w.url}: 卡片内容已变（${v.sig || '无'} -> ${w.sig}），需要重画`);
    }

    const expect = new Set(wanted.map((w) => w.name));
    if (fs.existsSync(abs(OUT_DIR))) {
        for (const f of fs.readdirSync(abs(OUT_DIR)).sort()) {
            if (!f.endsWith('.jpg')) problems.push(`${f}: 扩展名不是 .jpg`);
            else if (!expect.has(f)) problems.push(`${f}: 表里没有文章引用它（孤儿卡片）`);
        }
    }

    for (const w of wanted) {
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
    const manifest = loadManifest();
    const stale = wanted.filter((w) => !manifest[w.url] || manifest[w.url].sig !== w.sig);
    const todo = HAS('--all') ? wanted : stale;

    if (HAS('--print')) {
        for (const w of wanted) {
            const mark = manifest[w.url]?.sig === w.sig ? '最新' : manifest[w.url] ? '过期' : '缺卡';
            console.log(`${mark}  ${w.url}  ->  ${w.asset}  ${w.category} · ${w.date}  ${w.title}`);
        }
        console.log(`# 需要卡片 ${wanted.length} 篇（其中待画 ${stale.length}）、走 cover ${covered.length} 篇`);
        for (const s of skipped) console.log(`# 跳过 ${s.file}：${s.why}`);
        return;
    }

    console.log(`${wanted.length + covered.length} 篇文章：${wanted.length} 篇无 cover 需要卡片，${covered.length} 篇走 front matter cover。`);
    if (skipped.length) console.log(`跳过 ${skipped.length} 篇：${skipped.map((s) => `${s.file}（${s.why}）`).join('、')}`);

    if (HAS('--check')) {
        if (stale.length) console.log(`${stale.length} 张待生成或重画：\n  ${stale.map((c) => c.asset).join('\n  ')}`);
        const { problems, manifestCount } = verify({ wanted, covered });
        report(problems, `自检通过：表 ${manifestCount} 条，卡片 ${wanted.length} 张全部在磁盘上、尺寸 ${W}x${H}、无孤儿文件。`);
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

    const written = writeManifest({ wanted, covered });
    console.log(`\n${MANIFEST}：${written} 条。`);
    const { problems, manifestCount } = verify({ wanted, covered });
    report(problems, `自检通过：表 ${manifestCount} 条，卡片 ${wanted.length} 张全部在磁盘上、尺寸 ${W}x${H}、无孤儿文件。`);
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
