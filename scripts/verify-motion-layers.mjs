#!/usr/bin/env node
/**
 * 逐层动效核验（配套量具）：只回答一个问题——每一层打开后是否真的可见、退场时是否真的经过中间值。
 *
 * 为什么另起一本而不把 verify-motion-batch4 的第 2/3/2b 组修好：那一本在一场会话里连开 5 层、
 * 密集采样、还切视口与媒体仿真，剩下的红全带着那层污染。2026-10-21 三次实验各自否掉了
 * 「headless 读不到 ::backdrop」「产帧泵饿死提交」「采样节流能救」三个假设——同一份无头模式、
 * 一次只开一层时，backdrop 读到 op=1、readerIn 在 150ms 内走到 1.0。这一本因此做成最小形状：
 * **一层一次导航，开→采样→用真按键或真点击关→采样退场**，不碰任何全局仿真。
 *
 * 判据（不放宽，六层一视同仁，::backdrop 也不豁免）：
 *   开：实算 opacity 走到 ≥0.97 **且这一帧真的被排版出来**（rect>0）。只看 opacity 不够——
 *       `visibility:hidden`、被 `display:none` 祖先包着的节点都回 1，会把「根本不显示」报成绿；
 *   关：退场轨迹里必须存在「仍在渲染且 0.05<op<0.95」的中间帧，且最终不再渲染；
 *   环境：一次退场采样拿不到 15 帧就判「缺账」而不是红——无头里过渡时钟挂在被提交的帧上，
 *         帧不足是宿主机状态，不是站点缺陷（同 batch4 第 1 组的拒数口径）。有红时先报红。
 *
 * 用法：node scripts/verify-motion-layers.mjs [--site=_site] [--only=书架,灯箱]
 * 退出码：0 全绿 / 1 有红 / 2 环境没起来或帧数不足（没出数，不代表站点有问题）。
 */
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const SITE = path.resolve(REPO, opt('site', '_site'));
const ONLY = opt('only', '').split(',').map((x) => x.trim()).filter(Boolean);
const BASE = '/better-blog';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const die = (m) => { console.log(`✗ 环境没起来：${m}`); process.exit(2); };
if (!fs.existsSync(path.join(SITE, 'index.html'))) die(`没有 ${SITE}/index.html——先构建`);
if (!fs.existsSync(CHROME)) die('认不到 Chrome');

/** 夹具文章按内容找，不照抄任何回显：工具会把 /2026/09/21/ 显示成 /2026-09-21/，照抄就 404。 */
const findArticle = (needle) => {
  // 每一层都只走目录：Finder 会往 _site/2026/ 里丢 .DS_Store，把它当月份去 readdirSync
  // 会抛 ENOTDIR，整轮量具连一层读数都出不来（2026-10-21 现场翻过一次）。
  const dirs = (rel) => {
    try {
      return fs.readdirSync(path.join(SITE, rel), { withFileTypes: true })
        .filter((d) => d.isDirectory()).map((d) => d.name);
    } catch { return []; }
  };
  for (const y of dirs('').filter((d) => /^\d{4}$/.test(d)).sort().reverse()) {
    for (const mo of dirs(y)) {
      for (const dd of dirs(`${y}/${mo}`).filter((d) => /^\d{2}$/.test(d))) {
        const dir = path.join(SITE, y, mo, dd);
        for (const f of fs.readdirSync(dir)) if (f.includes(needle)) return `/${y}/${mo}/${dd}/${f}`;
      }
    }
  }
  return null;
};
const ARTICLE = findArticle('security-audit-two-validators');
if (!ARTICLE) die('找不到夹具文章（正文里有 3 枚外链与 7 张图的那篇）');

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon', '.webp': 'image/webp' };
const port = await new Promise((res, rej) => { const s = net.createServer(); s.once('error', rej); s.once('listening', () => { const p = s.address().port; s.close(() => res(p)); }); s.listen(0, '127.0.0.1'); });
const server = http.createServer((req, rsp) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch { rsp.writeHead(400); return rsp.end(); }
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(SITE, p);
  if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end('404'); }
  rsp.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8', 'cache-control': 'no-store' });
  rsp.end(fs.readFileSync(f));
});
server.on('clientError', () => {});
await new Promise((r) => server.listen(port, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${port}`;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vml-chrome-'));
const chrome = spawn(CHROME, ['--headless', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--disable-gpu', '--no-first-run', '--window-size=1280,900',
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--proxy-server=direct://', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
const killChrome = () => { try { chrome.kill(); } catch { /* 已退出 */ } };
process.on('exit', killChrome);
// 'exit' 不在 SIGINT/SIGTERM 的默认路径上：Ctrl-C 会留下一台活着的 headless Chrome 和一个
// 占着 /var/folders 的 profile（batch4 的注释里记过同一形状）。补上三个信号，杀完照原样退出。
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((sig) => process.on(sig, () => { killChrome(); process.exit(130); }));
const wsUrl = await new Promise((resolve, reject) => {
  let b = ''; const t = setTimeout(() => reject(new Error('20s 内没等到 DevTools 端点')), 20000);
  chrome.stderr.on('data', (c) => { b += c; const m = /DevTools listening on (ws:\/\/\S+)/.exec(b); if (m) { clearTimeout(t); resolve(m[1]); } });
  chrome.once('exit', () => reject(new Error('Chrome 提前退出')));
}).catch((e) => die(e.message));

class Conn {
  constructor(u) {
    this.ws = new WebSocket(u); this.id = 0; this.p = new Map(); this.ev = [];
    this.ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id === undefined) { this.ev.forEach((f) => f(m)); return; }
      const s = this.p.get(m.id); if (s) { this.p.delete(m.id); s(m); }
    });
  }
  open() { return new Promise((r) => this.ws.addEventListener('open', r)); }
  on(f) { this.ev.push(f); }
  send(method, params = {}, sessionId) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      this.p.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)));
      this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    });
  }
}
const c = new Conn(wsUrl);
c.ws.addEventListener('error', () => die('DevTools WebSocket 报错'));
await c.open();
const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p = {}, ms = 20000) => Promise.race([
  c.send(m, p, sessionId),
  new Promise((_, rej) => setTimeout(() => rej(new Error(`${m} ${ms}ms 没回音`)), ms)),
]);
// 页内 Promise 不落地就永远没回执（awaitPromise 只在 settled 时回），所以每条都要有自己的 watchdog。
const run = (body, ms = 12000) => Promise.race([
  S('Runtime.evaluate', { expression: `(function () { ${body} })()`, returnByValue: true, awaitPromise: true }, ms),
  new Promise((_, rej) => setTimeout(() => rej(new Error(`页内没落地 ${ms}ms`)), ms)),
]).then((r) => {
  if (r.exceptionDetails) throw new Error('页内异常：' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await S('Page.enable');
await S('Network.setCacheDisabled', { cacheDisabled: true });
/**
 * 三件缺一不可，全都在 batch4 的注释里有案可查：
 * bringToFront —— 新建 target 默认非前台，后台标签页里 rAF 不来，本量具的采样全是 rAF；
 * setWebLifecycleState active —— 否则 visibilityState 仍是 hidden，站里「过渡走完再收层」的收尾不进定时器；
 * startScreencast(everyPainting) —— 过渡与 @keyframes 的时钟挂在被提交的帧上，没帧则时间轴一步不走。
 */
await S('Page.bringToFront');
try { await S('Page.setWebLifecycleState', { state: 'active' }); } catch (e) { console.log('· setWebLifecycleState 不可用：' + e.message); }
let pumpFrames = 0;
c.on((m) => {
  if (m.method !== 'Page.screencastFrame') return;
  pumpFrames += 1;
  c.send('Page.screencastFrameAck', { sessionId: m.params.sessionId }, sessionId).catch(() => {});
});
await S('Page.startScreencast', { format: 'jpeg', quality: 5, maxWidth: 80, maxHeight: 80, everyPainting: true });
await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

const gotoArticle = async () => {
  // navigate 的回执要等导航**提交**才回。量具读的是盘上的产物，而本机常驻的 jekyll serve
  // 正在反复重写 _site（同一份文件被换掉时这一发请求可以卡到二十秒外），于是回执等不到。
  // 落定与否本来就能用 readyState + pathname 判，所以这里发出去就不管回执，别让它带走整轮。
  S('Page.navigate', { url: ORIGIN + BASE + ARTICLE }, 60000).catch(() => {});
  for (let i = 0; i < 300; i++) {
    // 单次轮询超时不算失败：宿主忙的时候一发 evaluate 自己就能排到 4s 之外，
    // 而「到底落定没有」下一轮再问一次就有答案。让它带走整轮是量具的毛病，不是页面的。
    const ok = await run(`return location.pathname === ${JSON.stringify(BASE + ARTICLE)} && document.readyState === 'complete';`, 4000).catch(() => false);
    if (ok) { await wait(600); return true; }
    await wait(40);
  }
  return false;
};

/**
 * 开工前先量两件事，避免把宿主状态写成站点缺陷：
 * 1) 产帧密度——这一本判的过渡最短 200ms（--dur-2），一帧 100ms 的机器上「中间帧」这件事
 *    本身就是运气，12 帧/300ms（≈40fps）是能看见回程的下限；不到就 exit 2 拒绝出数。
 * 2) hover 能力——预览卡整条功能在 `(hover:hover) and (pointer:fine)` 后面（editorial.js:1935），
 *    无头若不满足，这一层只能记缺账，改由正常渲染的浏览器判。
 */
await gotoArticle();
const pre = await run(`
    var frames = 0; var t0 = performance.now();
    return new Promise(function (res) {
      var tick = function () { frames++; if (performance.now() - t0 < 300) requestAnimationFrame(tick);
        else res({ fps: Math.round(frames / ((performance.now() - t0) / 1000)),
                   hover: window.matchMedia('(hover: hover) and (pointer: fine)').matches,
                   reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches }); };
      requestAnimationFrame(tick);
    });`, 12000);
console.log(`· 预检：无头 rAF ≈${pre.fps}fps｜(hover:hover)and(pointer:fine)=${pre.hover}｜prefers-reduced-motion=${pre.reduce ? 'reduce' : 'no-preference'}`);
if (!pre.hover) console.log('  · 记一笔：这台无头不满足 hover 闸门，预览卡那一层只能记缺账（正常渲染的浏览器才判得了它）');
if (pre.fps < 40) die(`无头只给到 ${pre.fps}fps（需 ≥40）——200ms 的过渡在这种帧率下抓不到中间帧，这是宿主机状态，不是站点行为。等机器空了再跑`);

/**
 * 关掉原生 <dialog> 之后，这台无头会把页面记成 visibilityState=hidden、document.timeline 冻住
 * （2026-10-21 实测：灯箱那层 0 帧、时钟停在 8856ms），后续每一层都继承这个状态、全部读 0 帧。
 * 所以每层开跑前与关闭动作后各拉一次前台。拉之前先读状态，只有真冻了才拉并记账——
 * 免得把「量具自己把页面唤醒了」这件事藏起来。
 */
const wake = async (tag) => {
  const st = await run('return document.visibilityState;', 4000).catch(() => 'unknown');
  if (st === 'hidden') {
    await S('Page.bringToFront');
    try { await S('Page.setWebLifecycleState', { state: 'active' }); } catch { /* 该版本没有这个域 */ }
    console.log(`      · ${tag}：页面被无头记成 hidden，已重新拉起（时钟冻结会让退场读成 0 帧）`);
  }
  return st;
};

const keyEsc = async () => {
  const base = { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 };
  await S('Input.dispatchKeyEvent', { type: 'keyDown', ...base });
  await S('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
};

/**
 * 分两段量，中间夹一个 Node 侧的关闭动作。
 * 为什么要拆：关原生 <dialog> 必须用真按键（合成 KeyboardEvent 关不掉，batch4 已记过这条），
 * 而页内脚本发不出 CDP 键事件——于是入场采样、关、退场采样各自一次 evaluate。
 * cfg.layer 必须**懒取**：.lightbox 与 #lp-card 都是运行时才建出来的节点，开之前先取会读到 null。
 */
const openPhase = (cfg) => run(`
    var layerOf = function () { ${cfg.layer} };
    var out = { anim: null, openOp: 0, openMs: null, openFrames: 0 };
    var opener = ${cfg.open};
    if (!opener) return { err: 'no-opener' };
    var t0 = performance.now();
    var res; var finished = false;
    var done = function (v) { if (finished) return; finished = true; v.openOp = Number(v.openOp.toFixed(3)); res(v); };
    // 页内自计时兜底：宿主不给帧时 rAF 一次都不跑，Promise 就永远不落地，
    // 量具会挂成「Runtime.evaluate 没回音」——那是量具挂了，不是层没退场。
    setTimeout(function () { out.stalled = true; done(out); }, 3500);
    var watch = function () {
      if (finished) return;
      var s = layerOf();
      var cs2 = s ? getComputedStyle(s, ${JSON.stringify(cfg.pseudo || null)}) : null;
      var r = s ? s.getBoundingClientRect() : { width: 0, height: 0 };
      var op = cs2 ? Number(cs2.opacity) : 0;
      if (cs2 && out.anim === null) out.anim = cs2.transitionProperty + ' | ' + cs2.animationName + ' | ' + cs2.transitionDuration + ' / ' + cs2.animationDuration;
      out.openFrames++;
      if (op > out.openOp) out.openOp = op;
      if (out.openMs === null && op >= 0.97 && r.width > 0 && r.height > 0) out.openMs = Math.round(performance.now() - t0);
      if (performance.now() - t0 < 2000) requestAnimationFrame(watch);
      else done(out);
    };
    // 灯箱与预览卡都是运行时才建出来的节点：先等它出现，最多 1200ms，别一上来就判 no-layer。
    var waited = 0;
    var appear = function () {
      if (finished) return;
      if (layerOf()) { requestAnimationFrame(watch); return; }
      waited++;
      if (performance.now() - t0 < 1200) requestAnimationFrame(appear);
      else { out.err = 'no-layer'; done(out); }
    };
    return new Promise(function (r2) { res = r2; requestAnimationFrame(appear); });
  `, 15000);

const closePhase = (cfg) => run(`
    var layerOf = function () { ${cfg.layer} };
    var out = { mid: 0, frames: 0, firstMid: null, gone: false, closeMs: null, endOp: null, timedOut: false };
    var c1 = performance.now();
    var done = function (v) { if (!finished) { finished = true; res(v); } };
    var finished = false; var res;
    // 页内自计时兜底：宿主不给帧时 rAF 一次都不跑，Promise 就永远不落地，
    // 量具会挂成「Runtime.evaluate 没回音」——那是量具挂了，不是层没退场。
    setTimeout(function () { out.timedOut = true; done(out); }, 4000);
    var watch = function () {
      if (finished) return;
      var el = layerOf();
      var cs = el ? getComputedStyle(el, ${JSON.stringify(cfg.pseudo || null)}) : null;
      var r = el ? el.getBoundingClientRect() : { width: 0, height: 0 };
      var op = cs ? Number(cs.opacity) : 0;
      var rend = r.width > 0 && r.height > 0;
      out.frames++; out.endOp = Number(op.toFixed(3));
      if (rend && op > 0.05 && op < 0.95) {
        out.mid++;
        if (!out.firstMid) out.firstMid = { t: Math.round(performance.now() - c1), op: Number(op.toFixed(3)) };
      }
      if (!el || !rend || op <= 0.02) { out.gone = true; out.closeMs = Math.round(performance.now() - c1); done(out); return; }
      if (performance.now() - c1 < 3000) requestAnimationFrame(watch); else done(out);
    };
    return new Promise(function (r2) { res = r2; requestAnimationFrame(watch); });
  `, 15000);

const LAYERS = [
  {
    // 淡化在容器 .cmdk 上，位移才在 .cmdk-panel 上（editorial.scss 6391 起那段注释写明了理由：
    // 面板上的 cmdkIn 带 both 填充，把 opacity 钉死在 1）。量错节点会读出「退场没有中间值」。
    name: '⌘K 面板',
    layer: 'return document.querySelector("#cmdk");',
    open: 'document.querySelector(".nav-search-btn")',
    realKey: true,
  },
  {
    name: '书架抽屉',
    layer: 'return document.querySelector("#shelf-dlg");',
    open: 'document.querySelector("[data-shelf-open]")',
    close: 'document.querySelector("#shelf-dlg .shelf-close")',
  },
  {
    name: '书架遮罩',
    layer: 'return document.querySelector("#shelf-dlg");',
    pseudo: '::backdrop',
    open: 'document.querySelector("[data-shelf-open]")',
    close: 'document.querySelector("#shelf-dlg .shelf-close")',
  },
  {
    name: '偏好面板',
    layer: 'return document.querySelector("#reader-panel");',
    open: 'document.querySelector(".reader-btn")',
    close: 'document.querySelector(".reader-btn")',
  },
  {
    name: '灯箱',
    layer: 'return document.querySelector(".lightbox");',
    open: 'document.querySelector(".markdown-body img.is-zoomable")',
    // 关闭走「点对话框任意处」这条（editorial.js:1300，nav 之外一律 close()），不走 Esc：
    // 原生 <dialog> 用 Esc 关掉之后，这台无头会把页面记成 hidden、时间轴冻住，
    // 而页内 400ms 的 transitionend 兜底（editorial.js:1296）会在唤醒的那一刻把遮罩硬收走
    // ——中间帧从此不可能出现。那是量具与宿主的相互作用，不是站点没有回程（真浏览器量过）。
    close: 'document.querySelector(".lightbox")',
    needs: ['可放大正文图', 'document.querySelectorAll(".markdown-body img.is-zoomable").length'],
  },
  {
    name: '预览卡（键盘）',
    // 只能用 focus 开、blur 关：真鼠标点这根外链会把页面导航走，#lp-card 于是永远读不到
    // （上一版报的 no-layer 就是这么来的，不是站点缺陷）。
    mode: 'focus',
    layer: 'return document.querySelector("#lp-card");',
    needs: ['正文外链', 'document.querySelectorAll("#post-body a.lp-external").length'],
    open: '(function () { var a = document.querySelector("#post-body a.lp-external"); if (!a) return null; a.scrollIntoView({ block: "center" }); a.focus(); return a; })()',
    close: '(function () { var a = document.querySelector("#post-body a.lp-external"); if (!a) return null; a.blur(); return a; })()',
  },
];

/** 红了先把页面当时的状态打出来：分不清「层没退」还是「页冻了」时，这一行就是证据。 */
const whyStuck = (L) => run(`
    var el = (function () { ${L.layer} })();
    var cs = el ? getComputedStyle(el, ${JSON.stringify(L.pseudo || null)}) : null;
    var r = el ? el.getBoundingClientRect() : null;
    var t = document.timeline ? document.timeline.currentTime : null;
    return { exists: !!el, hidden: el ? !!el.hidden : null, disp: cs ? cs.display : null,
             op: cs ? cs.opacity : null, rect: r ? [Math.round(r.width), Math.round(r.height)] : null,
             vis: document.visibilityState, dlgOpen: el && el.open !== undefined ? el.open : null,
             clock: document.querySelector('.lightbox') ? document.querySelector('.lightbox').open : null,
             now: Math.round(t === null ? -1 : t) };`, 6000).catch((e) => ({ err: e.message }));

/**
 * 打开：页内 click 一下拿不到真鼠标的命中判定，所以这里走真点击（先命中测试，落点在视口外就记缺账）。
 *
 * 第二件事是 2026-10-21 补的：只保证「落点在视口内」不够——那一发点下去到底谁接住了才算。
 * 当天给 .shelf-mark 撑 44px 命中区，伸出去 11px 盖住了同一行 .reader-btn 的中心点，
 * 真鼠标那点被 .shelf-mark 接走，偏好面板那一格报的是「开：峰值 0、hidden」，
 * 看着像面板坏了，其实是量具点到了一个不是它的东西上。所以现在比对命中者，
 * 不是本人（或其子孙/祖先里的可交互壳）就红得有名有姓。
 */
const clickViaMouse = async (jsHandle) => {
  const hit = await run(`
    var el = ${jsHandle};
    if (!el) return { err: 'no-node' };
    el.scrollIntoView({ block: "center", behavior: "instant" });
    var r = el.getBoundingClientRect();
    var x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
    var top = document.elementFromPoint(x, y);
    var who = top ? (top.tagName + '.' + String(top.className || '').split(' ')[0]) : 'null';
    var mine = top === el || el.contains(top) || (top && top.contains(el));
    return { x: x, y: y, w: Math.round(r.width), h: Math.round(r.height), who: who, mine: mine };`, 6000);
  if (hit.err) return hit;
  if (hit.y < 0 || hit.y > 900 || hit.w <= 0) return { err: `落点不在视口内（y=${hit.y} w=${hit.w}）` };
  if (!hit.mine) return { err: `那点被别人接走了：命中 ${hit.who} 而不是目标（撑命中区或遮挡的问题，不是这层坏了）` };
  for (const type of ['mousePressed', 'mouseReleased']) {
    await S('Input.dispatchMouseEvent', { type, x: hit.x, y: hit.y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0 });
  }
  return { ok: true };
};

let reds = 0; const starved = [];
console.log(`· 逐层动效核验｜夹具 ${ARTICLE}｜无头 Chrome，一层一次导航`);
for (const L of LAYERS) {
  if (ONLY.length && !ONLY.some((x) => L.name.includes(x))) continue;
  if (L.mode === 'focus' && !pre.hover) { console.log(`  ⚠ ${L.name} — 缺账：这台无头不满足 (hover:hover) and (pointer:fine)，功能本身在这道闸门后不开；改由正常渲染的浏览器判（2026-10-21 已在那边量过回程）`); starved.push(L.name); continue; }
  if (!await gotoArticle()) { console.log(`  ✗ ${L.name} — 文章加载不出来`); reds++; continue; }
  await wake('进场前');
  if (L.needs) {
    const n = await run(`return (${L.needs[1] || '0'});`, 6000).catch(() => -1);
    if (!n) { console.log(`  ⚠ ${L.name} — 缺账：夹具页没有${L.needs[0]}（实得 ${n}），这条判不了，换夹具而不是判站点`); starved.push(L.name); continue; }
  }
  const act = (js) => (L.mode === 'focus'
    ? run(`var el = ${js}; return el ? { ok: true } : { err: 'no-node' };`, 6000)
    : clickViaMouse(js));
  const clicked = await act(L.open).catch((e) => ({ err: e.message }));
  if (clicked.err) { console.log(`  ✗ ${L.name} — 开不了：${clicked.err}`); reds++; continue; }
  let a;
  try { a = await openPhase(L); } catch (e) { console.log(`  ✗ ${L.name} — 入场采样没落地：${e.message}`); reds++; continue; }
  if (a.err) { console.log(`  ✗ ${L.name} — ${a.err}`); reds++; continue; }
  const closer = L.realKey ? await keyEsc() : await act(L.close).catch((e) => ({ err: e.message }));
  if (!L.realKey && closer.err) { console.log(`  ✗ ${L.name} — 关不掉：${closer.err}`); reds++; continue; }
  let b;
  try { b = await closePhase(L); } catch (e) { console.log(`  ✗ ${L.name} — 退场采样没落地：${e.message}`); reds++; continue; }
  // 0 帧 = 页面在这一发关闭动作后被无头记成 hidden、时间轴冻住（灯箱那层实测如此）。
  // 只在真读到 0 帧时才唤醒重试一次，健康路径不吃这 100ms。
  if (b.frames === 0) {
    await wake('退场读到 0 帧');
    try { b = await closePhase(L); } catch (e) { console.log(`  ✗ ${L.name} — 重试的退场采样没落地：${e.message}`); reds++; continue; }
    b.retried = true;
  }

  // 判据一律不放宽（文件顶部第 12 行那条承诺）：
  // 开=必须真的被排版出来（rect>0）且 opacity≥0.97。只看 opacity 会把 visibility:hidden、
  // 祖先 display:none、以及没匹配上的伪元素一律读成 1，于是「这一层根本不显示」也能报绿。
  // 关=必须经过中间值。::backdrop 也一视同仁：遮罩那条 transition 被删掉时它必须报红，
  // 否则这一格的绿是空的（牙齿 K2 就是量这一条）。
  const openOk = a.openMs !== null;
  const exitOk = b.mid > 0 && b.gone;
  const thin = a.openFrames + b.frames < 15;
  const openTxt = a.openMs !== null ? `${a.openMs}ms 到 op=1`
    : (a.openOp >= 0.97 ? `opacity 到了 ${a.openOp} 但没有一帧被排版出来（rect 为 0，等于不显示）` : `没到 0.97（峰值 ${a.openOp}）`);
  const line = `开:${openTxt}｜退场:中间帧 ${b.mid} 个 / ${b.frames} 帧${b.firstMid ? `（首帧 ${JSON.stringify(b.firstMid)}）` : ''}${b.gone ? `，${b.closeMs}ms 收走` : `，3s 末读数 op=${b.endOp}`}${a.stalled || b.timedOut ? '｜⚠ 页内自计时兜底落地（宿主没给帧）' : ''}${b.retried ? '｜唤醒后重采' : ''}`;
  if (thin) { console.log(`  ⚠ ${L.name} — 缺账：入场 ${a.openFrames} 帧 + 退场 ${b.frames} 帧，宿主没给够帧（泵 ${pumpFrames} 帧），这条不计绿也不计红`); starved.push(L.name); continue; }
  if (openOk && exitOk) console.log(`  ✓ ${L.name} — ${line}`);
  else {
    reds++;
    const stuck = await whyStuck(L);
    console.log(`  ✗ ${L.name} — ${line}｜动画归属 ${a.anim}`);
    console.log(`      当时状态 ${JSON.stringify(stuck)}`);
  }
}
console.log(`· 产帧泵累计 ${pumpFrames} 帧`);
server.close();
// 红优先于缺账：一台忙碌的机器不能顺手把一条真实缺陷盖成「环境状态、别当站点缺陷」。
// 只有全部层都判了、其中部分没出数时，才走 exit 2。
if (reds) { console.log(`✗ 有 ${reds} 层不成立（判据：开要真被排版出来、退场要经过中间值）`); process.exit(1); }
if (starved.length) { console.log(`⚠ 有 ${starved.length} 层没出数（${starved.join('、')}）——机器状态或夹具问题，别当站点缺陷`); process.exit(2); }
console.log('全部通过');
process.exit(0);
