#!/usr/bin/env node
/**
 * 移动端导航下拉「点父项 = 展开／收起开关」的专项量具。
 *
 * 它盯的是 2026-09-29 那一次改口的**用户可见结果**，不是某个类名：
 * `dev/js/editorial.js` 的 `initTouchDropdown` 在触屏与 ≤695 抽屉档下，父项「工具箱」
 * 从旧的「首次点击展开、再次点击才跳转」改成纯粹的展开／收起开关。
 * 新旧语义在源码里只差一个条件，在页面上差的是「第二次点下去会不会离开这一页」，
 * 而这条差别此前全仓零覆盖：`check-tools-surface.mjs` 只比产物 HTML 里的类名字符串，
 * `verify-motion-batch4.mjs` 与 `verify-idcard-browser.mjs` 一律 mobile:false、只有真鼠标，
 * 连一条触摸事件都没发过——本文件是全仓第一处 `Input.dispatchTouchEvent`。
 *
 * 判据七组：
 *   1 量具自证   —— 移动视口与触摸档真的生效；服务的字节 == 磁盘；被量那份产物里确实
 *                    躺着本次改动；**真触摸确实合成了 click**。最后一条不成立时下面全部
 *                    判据都是假的，所以它红就整轮退 2，不记在产物头上。
 *   2 触屏抽屉   —— 首点展开（URL 不动）、二点收起（URL 不动、面板真的没有高度、
 *                    aria-expanded 说真话、焦点被摘掉、箭头回到原位）、点面板外收起。
 *   3 修饰键     —— Ctrl/Meta/Shift/Alt 的 click 与非主键 click 一律不被吞。
 *   4 平板档     —— >695 且 (hover:none)：走的是桌面那一组钩子，两点同样只展开／收起、
 *                    不跳转，收起后没有粘 hover 把面板顶回来（抽屉那一组管不着这一档）。
 *   5 桌面档不变 —— 1280 下 hover 仍展开、点父项照旧进 /tools.html（这次只改触屏档）。
 *   6 键盘档不变 —— ≤695 与 1280 下焦点落进这一项都算展开，收起态按 Enter 只展开不跳转，
 *                    真按 Tab 走出这一项之后 aria-expanded 回落 false、面板跟着收起。
 *   7 篇幅账     —— 三档视口的收起／展开抽屉高度与落点行可点区，
 *                    `dev/sass/common/editorial.scss` ≤695 那段注释里的数字由这组负责。
 *
 * 牙齿（最后一组）：每处变异驱动**它自己的探针**，每处都必须让指名道姓的那条预期翻转；
 * 没翻转就是量具没干活，报红而不是报绿。条数由 `MUTATIONS` 决定，不写死在提示里。
 * 变异只改**响应**不改磁盘——磁盘那份是
 * 第 1 组「服务的字节 == 磁盘」的对照物，动它就动了自证。
 *
 * 跑法：`node scripts/verify-nav-touch.mjs`（先 `npx vite build` 再建一次 Jekyll 快照）。
 * `NAV_SITE` 指到快照目录（默认 `ROOT/_site`），`NAV_BASE` 是该快照的 baseurl
 * （默认 `/better-blog`；用 `--baseurl ""` 建的快照要显式给空串）。
 * 退出码 0 = 全绿，1 = 有红项，2 = 环境没起来或量具自己失效。
 */
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.NAV_SITE ? path.resolve(process.env.NAV_SITE) : path.join(ROOT, '_site');
const BASE = process.env.NAV_BASE === undefined ? '/better-blog' : process.env.NAV_BASE;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PARENT = '.nav-item.has-sub .nav-link';
const SUB_BUNDLE = 'assets/js/editorial.min.js';
/** 抽屉的顶栏占位高度，篇幅账里 `可视高 = 视口高 - 56`（来源见 editorial.scss ≤695 那条注释）。 */
const HEADER_H = 56;

if (!fs.existsSync(path.join(SITE, 'index.html'))) {
  console.log(`✗ ${SITE} 里没有 index.html——先构建产物，或用 NAV_SITE 指到快照`);
  process.exit(2);
}
const DISK_JS_TEXT = fs.readFileSync(path.join(SITE, SUB_BUNDLE), 'utf8');
const CSS_BUNDLE = 'assets/css/index.min.css';
const DISK_CSS_TEXT = fs.readFileSync(path.join(SITE, CSS_BUNDLE), 'utf8');
/**
 * 本次改动在**压缩后产物**里的锚点。按产物形状写而不是按源变量名：压缩器把 `plainTap`
 * 改了名（这份里叫 `t`），但属性访问与 `.blur()` 这样的调用形状原样保留。
 * 收起这条路有两个闸门，一个在 JS（摘 .is-open 与焦点），一个在 CSS（把 :hover 关进
 * (hover:hover)，否则触屏点完留下的粘 hover 会替用户"保持展开"）——只验 JS 那份，
 * CSS 被改回去时判据 7 才会红，而红了以后分不清是哪儿的问题，所以两边都在开工前钉住。
 */
const PRODUCT_ANCHORS = [
  { text: DISK_JS_TEXT, re: /e\.ctrlKey\|\|e\.metaKey\|\|e\.shiftKey\|\|e\.altKey/, what: '修饰键放行', where: SUB_BUNDLE },
  { text: DISK_JS_TEXT, re: /\.blur\s*&&\s*\w+\.blur\(\)/, what: '收起时摘焦点那一句', where: SUB_BUNDLE },
  { text: DISK_CSS_TEXT, re: /@media screen and \(max-width:695px\)and \(hover:hover\)\{\.g-header \.nav-item\.has-sub:hover \.nav-sub\{display:block/, what: '抽屉里 :hover 钩子的 (hover:hover) 闸门', where: CSS_BUNDLE },
  { text: DISK_CSS_TEXT, re: /@media\(hover:hover\)\{\.g-header \.nav-item\.has-sub:hover \.nav-sub\{opacity:1/, what: '横排档（含平板）:hover 钩子的 (hover:hover) 闸门', where: CSS_BUNDLE },
  { text: DISK_CSS_TEXT, re: /@media\(hover:hover\)\{\.g-header \.nav-item\.has-sub:hover \.nav-caret\{/, what: '箭头 :hover 钩子的 (hover:hover) 闸门', where: CSS_BUNDLE },
  { text: DISK_CSS_TEXT, re: /\.g-header \.nav-sub \.nav-sub-more\{padding:13px 10px/, what: '「全部工具」行的触屏可点区', where: CSS_BUNDLE },
];
for (const a of PRODUCT_ANCHORS) {
  if (!a.re.test(a.text)) {
    console.log(`✗ ${SITE}/${a.where} 里找不到「${a.what}」——这份快照不含本次改动，量了也白量`);
    process.exit(2);
  }
}
/**
 * 快照必须与 `assets/` 那份同源产物逐字节一致：`npx vite build` 写的是 `assets/`，
 * jekyll 只是把它复制进快照。少了这一格，"改了源码没重建"与"重建了没重新建站"两种
 * 半拉子状态都会让下面所有判据去量一份旧代码，而且绿得很难看。
 */
const LIVE_PAIRS = [[SUB_BUNDLE, DISK_JS_TEXT], [CSS_BUNDLE, DISK_CSS_TEXT]];
for (const [rel, snap] of LIVE_PAIRS) {
  const livePath = path.join(ROOT, 'assets', rel.replace(/^assets\//, ''));
  if (path.resolve(SITE, rel) === path.resolve(livePath) || !fs.existsSync(livePath)) continue;
  const live = fs.readFileSync(livePath, 'utf8');
  if (live.length !== snap.length || live !== snap) {
    console.log(`✗ 快照里的 ${rel}（${snap.length}B）与 assets/ 那份（${live.length}B）不是同一份产物——先 npx vite build 再重建快照`);
    process.exit(2);
  }
}

/* ───────────────────────────── 静态服务 ───────────────────────────── */
/** 端口现抢：写死端口会被上一轮遗留进程占着，脚本照常往下跑，量的却是旧产物。 */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.once('listening', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
    probe.listen(0, '127.0.0.1');
  });
}
const PORT = await freePort();
const ORIGIN = `http://127.0.0.1:${PORT}`;
const HOME = `${ORIGIN}${BASE}/`;
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon',
};
/**
 * 第 7 组的变异钩子：非空时把对应产物的**响应**文本过一遍这道改写。
 * 两个钩子是因为这个功能有两层闸门——JS 那层负责摘 .is-open 与焦点，CSS 那层负责
 * 把 :hover 关进 (hover:hover)。只给 JS 装牙齿的话，CSS 那半行改回去没人报警。
 */
let JS_MUTATE = null;
let CSS_MUTATE = null;
let mutateMiss = 0;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(SITE, p);
  if (!f.startsWith(SITE)) { res.writeHead(403); return res.end('403'); }
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('404 ' + p); }
  let body = fs.readFileSync(f);
  const mut = f.endsWith(SUB_BUNDLE) && JS_MUTATE ? JS_MUTATE(DISK_JS_TEXT)
    : f.endsWith(CSS_BUNDLE) && CSS_MUTATE ? CSS_MUTATE(DISK_CSS_TEXT) : undefined;
  if (mut !== undefined) {
    const src = f.endsWith(SUB_BUNDLE) ? DISK_JS_TEXT : DISK_CSS_TEXT;
    // 变异没命中就 500：静默原样返回会把「什么都没改」读成「实现没问题」。
    if (typeof mut !== 'string' || mut === src) {
      mutateMiss += 1;
      res.writeHead(500);
      return res.end('mutation missed');
    }
    body = Buffer.from(mut, 'utf8');
  }
  res.writeHead(200, {
    'content-type': (MIME[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

/* ───────────────────────────── Chrome ───────────────────────────── */
/**
 * 本机常开系统代理时 `--host-resolver-rules` 一条都不参与，必须先把代理摘成 direct://
 * 规则才说话；`MAP * ~NOTFOUND` 让站外那几件外链秒失败，`EXCLUDE 127.0.0.1` 保住本格自己。
 */
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'navtouch-chrome-'));
const chrome = spawn(CHROME, ['--headless', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run',
  '--disable-background-networking', '--window-size=1280,900',
  '--proxy-server=direct://', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  const cleanup = () => { clearTimeout(timer); chrome.stderr.off('data', onData); chrome.off('exit', onExit); };
  const timer = setTimeout(() => { cleanup(); reject(new Error('20s 内没读到 DevTools listening 那行 stderr')); }, 20000);
  const onExit = () => { cleanup(); reject(new Error(`Chrome 子进程提前退出（pid ${chrome.pid}）`)); };
  function onData(chunk) {
    buf += chunk.toString('utf8');
    const m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(buf);
    if (m) { cleanup(); resolve(m[1]); }
  }
  chrome.stderr.on('data', onData);
  chrome.once('exit', onExit);
}).catch((err) => { console.log(`✗ Chrome 调试端点没拿到：${err.message}`); chrome.kill(); process.exit(2); });

const reap = () => { try { chrome.kill(); } catch { /* 已经没了就别再抛一次 */ } try { server.close(); } catch { /* 同上 */ } };
process.on('uncaughtException', (err) => {
  console.log(`\n✗ 量具自己抛了（不是产物红）：${(err && err.stack) || err}`);
  reap();
  process.exit(2);
});
process.on('exit', reap);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGALRM', 'SIGHUP']) {
  process.on(sig, () => { console.log(`\n✗ 收到 ${sig}，收尸后退场`); reap(); process.exit(2); });
}

class Conn {
  constructor(url) {
    this.ws = new WebSocket(url); this.id = 0; this.pending = new Map(); this.handlers = [];
    this.ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id !== undefined) { const p = this.pending.get(m.id); this.pending.delete(m.id); if (p) p(m); }
      else this.handlers.forEach((h) => h(m));
    });
  }
  open() { return new Promise((r) => this.ws.addEventListener('open', r)); }
  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
      this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    });
  }
  on(fn) { this.handlers.push(fn); }
}
const c = new Conn(wsUrl);
await c.open();
const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });
const CDP_MS = 30000;
const S = (m, p = {}) => {
  const call = c.send(m, p, sessionId);
  call.catch(() => {});
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`CDP ${m} 在 ${CDP_MS / 1000}s 内没有回应`)), CDP_MS);
    call.then(resolve, reject).finally(() => clearTimeout(timer));
  });
};
/** 可选的 CDP 命令：不同 Chrome 版本的方法名与存活度不一样，缺了不算红，由自证那格判定。 */
const Soft = async (m, p = {}) => { try { await S(m, p); return true; } catch { return false; } };
const jsErrors = [];
/**
 * 变异轮里脚本本来就是坏的（第 4 组那一处就是要让它恒真、还有 500 的轮次），
 * 把那些 SyntaxError 与「EditorialTheme 没了导致 bottomFixedBtn 读 .get」记在产物头上，
 * 等于量具自己给自己判红。所以变异期间只数清轮的账。
 */
let MUTATING = false;
c.on((m) => {
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error'
    && String(m.params.entry.source || '').startsWith('javascript') && !MUTATING) jsErrors.push('log:' + m.params.entry.text.slice(0, 160));
  if (m.method === 'Runtime.exceptionThrown' && !MUTATING) {
    const d = m.params.exceptionDetails;
    jsErrors.push('exc:' + (d.exception?.description || d.text || '').replace(/\s+/g, ' ').slice(0, 160));
  }
});
await S('Runtime.enable');
await S('Log.enable');
await S('Page.enable');
/** 缺这句的话，磁盘 md5 是新的、浏览器读的是旧产物（段 2 踩过）。 */
await S('Network.setCacheDisabled', { cacheDisabled: true });
await S('Page.bringToFront');

const evalJs = async (expression) => {
  const r = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    throw new Error('页内异常：' + (r.exceptionDetails.exception?.description
      || r.exceptionDetails.text) + ' @ ' + expression.replace(/\s+/g, ' ').slice(0, 90));
  }
  return r.result.value;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const goto = async (url) => {
  await S('Page.navigate', { url });
  for (let i = 0; i < 250; i += 1) {
    if (await evalJs('document.readyState') === 'complete') break;
    await wait(60);
  }
  await wait(150);
};

/* ───────────────────────────── 记账 ───────────────────────────── */
const results = [];
const mark = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? '  ✓' : '  ✗'} ${id} ${detail}`);
  return ok;
};
const note = (id, detail) => console.log(`  · ${id} ${detail}`);

/* ─────────────────────── 视口、点按与读数 ─────────────────────── */
/**
 * `mobile:true` 才会让 `(hover: none)` 成立、才会按移动视口布局；只改 deviceMetrics
 * 而不开触摸的那一档测到的是「窄窗口 + 有 hover」，`initTouchDropdown` 里 hover:none
 * 那一支根本没进。headless 默认视口也不是桌面尺寸，所以一律显式写死并回读自证。
 */
async function setTouchVp(width, height) {
  await S('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true });
  const touchOk = await Soft('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const got = JSON.parse(await evalJs('JSON.stringify({w:innerWidth,h:innerHeight,m:matchMedia("(hover: none)").matches,t:navigator.maxTouchPoints})'));
  return { ...got, touchOk };
}
async function setDesktopVp(width = 1280, height = 900) {
  await S('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await Soft('Emulation.setTouchEmulationEnabled', { enabled: false });
  return JSON.parse(await evalJs('JSON.stringify({w:innerWidth,m:matchMedia("(hover: none)").matches})'));
}
/**
 * 进页面：视口与触摸档在导航**之后再钉一次**。只在 about:blank 上钉的那一轮会被导航冲掉，
 * 2026-09-29 首轮就栽在这里——390×844 量到 innerWidth=980（Chrome 拿不到有效布局视口时的
 * 兜底宽），也就是那一档实际在量桌面横排，而 375×667 恰好没被冲，两档读出不一样的东西。
 * 判据 1 的回读负责报警，补钉负责让它别响。
 */
async function enterTouchPage(w, h) {
  await setTouchVp(w, h);
  await goto(HOME);
  return setTouchVp(w, h);
}
async function enterDesktopPage() {
  await setDesktopVp(1280, 900);
  await goto(HOME);
  return setDesktopVp(1280, 900);
}
/**
 * 等下拉的 opacity 落定再读数。桌面那组的显示是 opacity/visibility 过渡（.18s），
 * 固定 120ms 会采样到半程（0.76），看起来像"hover 没展开"。每 60ms 回读一次，
 * 到阈值就返回，最多 1s——超时不抛错，让判据自己决定怎么算，因为"没落定"本身就是红项。
 */
async function settleOpacity(at = 0.999, limit = 1000) {
  let last = null;
  for (let spent = 0; spent <= limit; spent += 60) {
    last = JSON.parse(await evalJs(`(() => {
      const item = document.querySelector('.nav-item.has-sub');
      const sub = item.querySelector('.nav-sub');
      const cs = getComputedStyle(sub);
      return JSON.stringify({ display: cs.display, visibility: cs.visibility, opacity: Number(cs.opacity),
        aria: item.querySelector('.nav-link').getAttribute('aria-expanded'),
        settled: Number(cs.opacity) >= ${at} });
    })()`));
    if (last.settled) return last;
    await wait(60);
  }
  return last;
}
/**
 * 平板档（>695 且 hover:none）与箭头朝向共用一条前提：显示走 opacity/visibility 过渡、
 * 箭头走 transform .2s 过渡，采样必须等落定。这一把不管方向，只等两件事同时成立——
 * opacity 离开 (0,1) 开区间（展开等它到 1、收起等它到 0），且 caret 的 transform 串
 * 连续两次采样相同（还在转的箭头读出来是中间值，会让判据红成「朝向不诚实」）。
 */
async function readStable(limit = 1200) {
  let prev = null;
  let last = null;
  for (let spent = 0; spent <= limit; spent += 60) {
    last = await read();
    const o = Number(last.opacity);
    if ((o <= 0.001 || o >= 0.999) && prev && prev.caret === last.caret) return last;
    prev = last;
    await wait(60);
  }
  return last;
}
/**
 * 页内 click 计数器：真触摸到底有没有合成 click，只有事件自己知道。
 * 有这一格才能把「量具失效」和「产物缺陷」分开——没有它，触摸不合成 click 时
 * 后面每组都会红成「实现坏了」，而实际上什么都没测。
 */
const armCounter = () => evalJs(`(() => {
  if (window.__armed) return 'again';
  window.__armed = 1; window.__clicks = 0; window.__last = '';
  document.addEventListener('click', (e) => {
    window.__clicks += 1;
    const t = e.target.closest ? e.target.closest('a,button') : null;
    window.__last = ((t && t.className) || e.target.tagName || '?') + '|btn' + e.button
      + '|mod' + (e.ctrlKey ? 'C' : '') + (e.metaKey ? 'D' : '') + (e.shiftKey ? 'S' : '') + (e.altKey ? 'A' : '');
  }, true);
  return 'ok';
})()`);
/** 命中测试先行：视口外的落点会伪装成「交互坏了」的假红。 */
async function hit(sel, nth = 0) {
  const t = await evalJs(`(async () => {
    const el = [...document.querySelectorAll(${JSON.stringify(sel)})][${nth}];
    if (!el) return { err: 'no-node' };
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    await new Promise(r => setTimeout(r, 60));
    const r = el.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
    const top = document.elementFromPoint(x, y);
    return { x, y, w: Math.round(r.width), h: Math.round(r.height),
      hit: top ? (top.tagName + '.' + (top.className || '')).slice(0, 70) : 'none',
      ok: !!top && (top === el || el.contains(top) || top.contains(el)) };
  })()`);
  if (t.err || !t.ok) throw new Error(`命中测试失败 ${sel}: ${JSON.stringify(t)}`);
  return t;
}
/** 真触摸一次点按；点完等 260ms，把 jQuery 抽屉那 200ms 的滑动也等进去。 */
async function tap(sel, nth = 0) {
  const t = await hit(sel, nth);
  await S('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: t.x, y: t.y, id: 1 }] });
  await wait(50);
  await S('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(260);
  return t;
}
/** 坐标版点按（顶栏空白那种不属于任何链接的落点用得上）。 */
async function tapAt(x, y) {
  await S('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await wait(50);
  await S('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(260);
}
/**
 * 一次读数。面板可见性看 computed display 与真实高度，不看类名——类名是过程，
 * 这两样才是用户眼里的结果。`href` 一起回，跳转后的读数必须先证明还是同一页。
 */
const read = () => evalJs(`(() => {
  const item = document.querySelector('.nav-item.has-sub');
  const link = item && item.querySelector('.nav-link');
  const sub = item && item.querySelector('.nav-sub');
  const cs = sub && getComputedStyle(sub);
  const r = sub && sub.getBoundingClientRect();
  const nav = document.querySelector('.g-nav');
  return {
    path: location.pathname, file: location.pathname.split('/').pop(),
    isOpen: !!(item && item.classList.contains('is-open')),
    aria: link && link.getAttribute('aria-expanded'),
    display: cs && cs.display, visibility: cs && cs.visibility, opacity: cs && cs.opacity,
    subH: r ? Math.round(r.height) : -1,
    navH: nav ? Math.round(nav.getBoundingClientRect().height) : -1,
    // 焦点在不在这枚父项里：Tab 走出这一项之后，落点十有八九还是兄弟导航项的 .nav-link，
    // 所以判据只能问「还在不在这一项内部」，不能问标签名——问名字会把正常行为读成失败。
    inSubItem: (() => {
      const a = document.activeElement;
      return !!(a && a.closest && item && a.closest('.nav-item.has-sub') === item);
    })(),
    // 箭头朝向：展开态应该是 rotate(180deg)，收起态必须回到原位。
    // 它和面板是两套钩子（.nav-caret 那三条），面板绿了不代表箭头也诚实。
    caret: (() => {
      const caret = item && item.querySelector('.nav-caret');
      return caret ? getComputedStyle(caret).transform : 'none';
    })(),
    focused: !!(link && document.activeElement === link),
    activeTag: ((document.activeElement.tagName || '') + '.' + (document.activeElement.className || '')).slice(0, 40),
    clicks: window.__clicks, lastClick: window.__last,
  };
})()`);
const box = (sel, nth = 0) => evalJs(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(sel)})][${nth}];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height) };
})()`);

/* ───────────────────────────── 探针 ─────────────────────────────
 * 探针只回原始读数，不下判断；判据在 suite 里，牙齿也复用同一批探针。
 * 每个探针自带导航与视口，跑完不依赖上一个探针留下的状态。
 * ─────────────────────────────────────────────────────────────── */
/** 触屏抽屉：开抽屉 → 点父项 → 再点父项，回三次读数。 */
async function probeTapPair(w = 390, h = 844) {
  const vp = await enterTouchPage(w, h);
  await armCounter();
  const served = JSON.parse(await evalJs(`(async () => {
    const r = await fetch(${JSON.stringify(`${BASE}/${SUB_BUNDLE}`)}, { cache: 'no-store' });
    const t = await r.text();
    return JSON.stringify({ status: r.status, len: t.length,
      tags: [...document.scripts].filter((s) => /editorial\\.min\\.js/.test(s.src)).length });
  })()`));
  const t = await tap('.menu-toggle');
  const drawerDisplay = await evalJs('getComputedStyle(document.querySelector(".g-nav")).display');
  const before = await read();
  await tap(PARENT);
  const first = await readStable();
  await tap(PARENT);
  const second = await readStable();
  return { vp, served, t, drawerDisplay, before, first, second };
}
/**
 * 平板档：>695 且 (hover:none)。这一档走的是**桌面那一组**的显示钩子
 * （`.is-open` 无条件、`:hover` 关在 (hover:hover) 里），抽屉那一组根本没参与，
 * 所以 editorial.scss 386 行那句「平板（>695 且 hover:none）走的就是这一组」必须有
 * 自己的探针，否则它只是注释。点父项两下，看它是不是真的展开／收起而不跳转。
 */
async function probeTablet(w = 768, h = 1024) {
  const vp = await enterTouchPage(w, h);
  await armCounter();
  const navDisplay = await evalJs('getComputedStyle(document.querySelector(".g-nav")).display');
  const before = await readStable();
  await tap(PARENT);
  const first = await readStable();
  await tap(PARENT);
  const second = await readStable();
  return { vp, navDisplay, before, first, second };
}
/** 触屏抽屉：展开后点顶栏空白（不属于任何导航项的落点）。 */
async function probeOutsideTap(w = 390, h = 844) {
  const vp = await enterTouchPage(w, h);
  await armCounter();
  await tap('.menu-toggle');
  await tap(PARENT);
  const opened = await read();
  const spot = await evalJs(`(async () => {
    const el = document.querySelector('.g-header');
    const r = el.getBoundingClientRect();
    const x = Math.round(r.width / 2), y = Math.round(r.height / 2);
    const top = document.elementFromPoint(x, y);
    return { x, y, hit: top ? (top.tagName + '.' + (top.className || '')).slice(0, 60) : 'none',
      safe: !!top && !(top.closest && top.closest('.nav-item.has-sub')) };
  })()`);
  await tapAt(spot.x, spot.y);
  const after = await read();
  return { vp, opened, spot, after };
}
/**
 * 修饰键。不靠真导航判：Ctrl+点是在**新标签**里开，当前页 URL 根本不动，
 * 拿它当判据会把「正确」读成「没跳转」。判的是事件本身——派发两种 click，
 * 看默认动作有没有被 preventDefault；这也正好是本功能唯一的那道闸门。
 */
async function probeModifiers() {
  await enterTouchPage(390, 844);
  await armCounter();
  await tap('.menu-toggle');
  return JSON.parse(await evalJs(`(() => {
    const link = document.querySelector(${JSON.stringify(PARENT)});
    const fire = (init) => {
      const e = new MouseEvent('click', Object.assign({ bubbles: true, cancelable: true, button: 0 }, init));
      link.dispatchEvent(e);
      return e.defaultPrevented;
    };
    return JSON.stringify({
      plain: fire({}), ctrl: fire({ ctrlKey: true }), meta: fire({ metaKey: true }),
      shift: fire({ shiftKey: true }), alt: fire({ altKey: true }), middle: fire({ button: 1 }),
      again: fire({}),
    });
  })()`));
}
/** 桌面 1280：hover 展开 + 点父项应当照常跳转（本次只改触屏档，别把桌面也改了）。 */
async function probeDesktop() {
  const vp = await enterDesktopPage();
  await armCounter();
  const t = await hit(PARENT);
  await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: t.x, y: t.y });
  // 桌面那组的显示走 opacity/visibility，过渡是 .18s——120ms 就采样会读到 0.76 这种半程值，
  // 长得像"hover 没生效"。等到落定或超时，别跟动画抢读数。
  const hovered = await settleOpacity(0.999);
  await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 8, y: 780 });
  await wait(360);
  const before = await read();
  await S('Input.dispatchMouseEvent', { type: 'mousePressed', x: t.x, y: t.y, button: 'left', buttons: 1, clickCount: 1 });
  await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x: t.x, y: t.y, button: 'left', buttons: 0, clickCount: 1 });
  await wait(500);
  const after = await read();
  const h1 = await evalJs('(document.querySelector("h1")||{}).innerText||""');
  return { vp, t, hovered, before, after, h1: String(h1) };
}
/** 键盘档：窄屏焦点即展开 + 收起态按 Enter；桌面焦点路径。 */
async function probeKeyboard() {
  await enterTouchPage(390, 844);
  await armCounter();
  await tap('.menu-toggle');
  const narrow = JSON.parse(await evalJs(`(async () => {
    const link = document.querySelector(${JSON.stringify(PARENT)});
    link.focus();
    await new Promise(r => setTimeout(r, 80));
    const sub = link.parentElement.querySelector('.nav-sub');
    return JSON.stringify({ display: getComputedStyle(sub).display, aria: link.getAttribute('aria-expanded'),
      open: link.parentElement.classList.contains('is-open') });
  })()`));
  /**
   * Enter 必须走 CDP 真按键，不能在页内 `dispatchEvent(new KeyboardEvent(...))`：
   * 脚本合成的键盘事件不触发浏览器的默认激活行为，也就是不会合成那一下 click，
   * 于是「按 Enter 什么也没发生」在这把量具里长得和「按 Enter 被正确接管」一模一样。
   * 焦点用 .focus() 落（这是状态，不是事件），按键用 Input.dispatchKeyEvent 发。
   */
  const keyEnter = async () => {
    await S('Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
      text: '\r', unmodifiedText: '\r',
    });
    await wait(50);
    await S('Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
    });
    await wait(420);
  };
  /** Tab 同一条前提：只有真按键才走浏览器的焦点移动，页内合成的 KeyboardEvent 不会挪焦点。 */
  const keyTab = async () => {
    await S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await wait(50);
    await S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await wait(420);
  };
  await evalJs(`document.querySelector(${JSON.stringify(PARENT)}).blur(), 1`);
  await wait(80);
  const blurred = await read();
  await evalJs(`document.querySelector(${JSON.stringify(PARENT)}).focus(), 1`);
  await wait(80);
  await keyEnter();
  const entered = await read();
  await keyEnter();
  const collapsed = await read();
  /**
   * Tab 走出这一项这一路：editorial.js 注释里那句「focusout 把属性改回 false（已实测）」
   * 必须有读数，不然它是断言不是事实。落点是面板里最后一行 `.nav-sub-more`——
   * 从它再 Tab 一下必然离开 `.nav-item.has-sub`，比"数几下 Tab"确定。
   */
  await evalJs(`document.querySelector(${JSON.stringify(PARENT)}).focus(), 1`);
  await wait(120);
  await evalJs(`document.querySelector('.nav-sub-more').focus(), 1`);
  await wait(120);
  const inPanel = await readStable();
  await keyTab();
  const tabOut = await readStable();
  await enterDesktopPage();
  await armCounter();
  await evalJs(`document.querySelector(${JSON.stringify(PARENT)}).focus(), 1`);
  // 桌面档的焦点路径同样是 .18s 过渡，采样必须等落定（同 probeDesktop 那条理由）
  const wide = await settleOpacity();
  return { narrow, blurred, entered, collapsed, inPanel, tabOut, wide };
}
/** 篇幅账：三档视口下收起／展开的抽屉高度与两行落点的可点区。 */
async function probeGeometry(w, h) {
  await enterTouchPage(w, h);
  await armCounter();
  await tap('.menu-toggle');
  const collapsed = (await read()).navH;
  await tap(PARENT);
  const expanded = (await read()).navH;
  // 行高必须在**展开态**量：pair 探针的收尾是收起态，那时 .nav-sub 是 display:none，
  // getBoundingClientRect 一律回 0×0——读起来像「落点行没了」，其实是量错了时机。
  const more = await box('.nav-sub-more');
  const child = await box('.nav-sub-link');
  const parentRow = await box(PARENT);
  const group = await box('.nav-sub-group');
  // 「全部工具」行是触屏档里唯一还能进总览页的落点（父项现在是开关，不再跳转），
  // 所以它得真的可聚焦、真的指向 tools.html——不然这次改口就少了一条出路。
  // 只断言「可聚焦 + 指向」，不断言在不在视口内：375×667 展开态本来就比可视高长，
  // 在不在视口是篇幅账那组的事，混在这里会让两组判据抢同一个失败原因。
  const moreLink = JSON.parse(await evalJs(`(() => {
    const el = document.querySelector('.nav-sub-more');
    if (!el) return JSON.stringify({ err: 'no-node' });
    el.focus();
    return JSON.stringify({ focused: document.activeElement === el, tag: el.tagName,
      href: el.getAttribute('href') || '', visibility: getComputedStyle(el).visibility });
  })()`));
  return { w, h, collapsed, expanded, parentRow, more, child, group, moreLink };
}

/* ───────────────────────────── 判据 ───────────────────────────── */
let touchWorks = true;
async function suiteTouch(w, h) {
  const tag = `触屏${w}×${h}`;
  console.log(`\n【${tag}】`);
  const p = await probeTapPair(w, h);
  mark(`${tag}/1 移动视口与触摸档生效`, p.vp.w === w && p.vp.m === true && p.vp.t > 0,
    `innerWidth=${p.vp.w} hover:none=${p.vp.m} maxTouchPoints=${p.vp.t} 触摸通道=${p.vp.touchOk ? 'setTouchEmulationEnabled 可用' : '仅靠 mobile:true'}`);
  mark(`${tag}/2 服务的字节 == 磁盘`, p.served.status === 200 && p.served.len === DISK_JS_TEXT.length && p.served.tags === 1,
    `响应 ${p.served.len}B vs 磁盘 ${DISK_JS_TEXT.length}B，页面里 editorial 脚本 ${p.served.tags} 条`);
  mark(`${tag}/3 汉堡开得了抽屉`, p.drawerDisplay !== 'none' && p.before.clicks >= 1,
    `抽屉 display=${p.drawerDisplay}，汉堡那一下产生了 ${p.before.clicks} 次 click`);
  mark(`${tag}/4 真触摸合成了 click`, p.first.clicks > p.before.clicks,
    `点父项后 click ${p.before.clicks}→${p.first.clicks}，命中=${p.first.lastClick}`);
  if (p.first.clicks === p.before.clicks) {
    touchWorks = false;
    console.log(`\n✗ ${tag}：真触摸没有合成 click，后面每一组的读数都不成立——整轮作废（退出码 2）`);
    return;
  }
  mark(`${tag}/5 首点=展开`, p.first.isOpen && p.first.display === 'block' && p.first.subH > 80 && p.first.aria === 'true',
    `is-open=${p.first.isOpen} display=${p.first.display} 面板高=${p.first.subH} aria-expanded=${p.first.aria}`);
  mark(`${tag}/6 首点不跳转`, p.first.path === p.before.path, `${p.before.path} → ${p.first.path}`);
  mark(`${tag}/7 二点=收起`, !p.second.isOpen && p.second.display === 'none' && p.second.subH === 0,
    `is-open=${p.second.isOpen} display=${p.second.display} 面板高=${p.second.subH}`);
  mark(`${tag}/8 二点不跳转`, p.second.path === p.before.path, `${p.first.path} → ${p.second.path}`);
  mark(`${tag}/9 二点后 aria 说真话`, p.second.aria === 'false', `aria-expanded=${p.second.aria}`);
  mark(`${tag}/10 收起时把焦点摘掉`, p.second.focused === false && !/nav-link/.test(p.second.activeTag),
    `activeElement=${p.second.activeTag}`);
  note(`${tag}/10b 抽屉高度`, `收起 ${p.before.navH}px → 展开 ${p.first.navH}px → 再收起 ${p.second.navH}px，汉堡行高 ${p.t.h}px（父项行高见篇幅账）`);

  const o = await probeOutsideTap(w, h);
  mark(`${tag}/11 点外落点确实不在面板上`, o.spot.safe === true, `命中=${o.spot.hit}`);
  mark(`${tag}/12 点面板外收起`, !o.after.isOpen && o.after.display === 'none' && o.after.path === o.opened.path,
    `is-open=${o.after.isOpen} display=${o.after.display} URL=${o.after.path}`);
  // 箭头是另一套钩子（.nav-caret 三条：focus-within / .is-open / 关进 (hover:hover) 的 hover），
  // 面板绿不代表它诚实。收起态还指着上就是「看着像还开着」，与这次改口要修的是同一类错觉。
  mark(`${tag}/13 展开态箭头朝上`, /matrix\(-1/.test(p.first.caret), `transform=${p.first.caret}`);
  mark(`${tag}/14 收起态箭头回到原位`, p.second.caret === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(p.second.caret),
    `transform=${p.second.caret}`);
}
/**
 * 平板档（>695 且 hover:none）：这一档走的是桌面那组的显示钩子（.is-open 无条件、
 * :hover 关在 (hover:hover) 里），抽屉那一组压根没参与。editorial.scss 里那句
 * 「平板（>695 且 hover:none）走的就是这一组」此前只有注释没有读数，这组就是那笔账。
 * 断言全部压在 opacity/visibility 上：>695 的 .nav-sub 永远 display:block，收起靠的是
 * visibility:hidden + opacity:0，用 ≤695 那套 display 判据会一路假红。
 */
async function suiteTablet() {
  const tag = '平板768×1024';
  console.log(`\n【${tag}】`);
  const p = await probeTablet();
  mark(`${tag}/1 宽屏 + 无 hover 这一档真的生效`, p.vp.w > 695 && p.vp.m === true && p.vp.t > 0,
    `innerWidth=${p.vp.w} hover:none=${p.vp.m} maxTouchPoints=${p.vp.t} 横排 display=${p.navDisplay}`);
  mark(`${tag}/2 真触摸合成了 click`, p.first.clicks > p.before.clicks,
    `点父项后 click ${p.before.clicks}→${p.first.clicks}，命中=${p.first.lastClick}`);
  mark(`${tag}/3 首点=展开（走 .is-open，不是 hover）`, p.first.isOpen && p.first.visibility === 'visible' && Number(p.first.opacity) >= 0.999 && p.first.subH > 80 && p.first.aria === 'true',
    `is-open=${p.first.isOpen} visibility=${p.first.visibility} opacity=${p.first.opacity} 面板高=${p.first.subH} aria-expanded=${p.first.aria}`);
  mark(`${tag}/4 二点=收起且没有粘 hover 顶上来`, !p.second.isOpen && p.second.visibility === 'hidden' && Number(p.second.opacity) <= 0.001,
    `is-open=${p.second.isOpen} visibility=${p.second.visibility} opacity=${p.second.opacity}`);
  mark(`${tag}/5 两点全程不跳转`, p.first.path === p.before.path && p.second.path === p.before.path,
    `${p.before.path} → ${p.first.path} → ${p.second.path}`);
  mark(`${tag}/6 收起态箭头回到原位`, p.second.caret === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(p.second.caret),
    `transform=${p.second.caret}`);
}
async function suiteModifiers() {
  console.log('\n【修饰键放行】');
  const m = await probeModifiers();
  mark('修饰键/1 普通点按被接管', m.plain === true, `plain click defaultPrevented=${m.plain}`);
  mark('修饰键/2 带修饰与非主键一律放行',
    m.ctrl === false && m.meta === false && m.shift === false && m.alt === false && m.middle === false,
    `defaultPrevented：ctrl=${m.ctrl} meta=${m.meta} shift=${m.shift} alt=${m.alt} button1=${m.middle}`);
  mark('修饰键/3 收起后再点仍然被接管', m.again === true, `再点一次 defaultPrevented=${m.again}`);
}
async function suiteDesktop() {
  console.log('\n【桌面 1280 不变】');
  const d = await probeDesktop();
  mark('桌面/1 视口生效', d.vp.w === 1280 && d.vp.m === false, `innerWidth=${d.vp.w} hover:none=${d.vp.m}`);
  mark('桌面/2 hover 仍展开', d.hovered.display !== 'none' && d.hovered.visibility === 'visible' && d.hovered.settled === true,
    `display=${d.hovered.display} visibility=${d.hovered.visibility} opacity=${d.hovered.opacity}（等落定，上限 1s）`);
  mark('桌面/3 点父项照旧进总览页', d.after.path !== d.before.path && /tools/.test(d.after.path),
    `${d.before.path} → ${d.after.path}`);
  mark('桌面/4 总览页真的渲染了', d.h1.includes('工具'), `h1=${d.h1.slice(0, 24)}`);
}
async function suiteKeyboard() {
  console.log('\n【键盘档不变】');
  const k = await probeKeyboard();
  mark('键盘/1 窄屏焦点落进父项即展开', k.narrow.display === 'block' && k.narrow.aria === 'true',
    `display=${k.narrow.display} aria-expanded=${k.narrow.aria} is-open=${k.narrow.open}（CSS 走 :focus-within）`);
  mark('键盘/2 摘掉焦点后面板真的没了', k.blurred.display === 'none' && k.blurred.subH === 0 && k.blurred.focused === false,
    `display=${k.blurred.display} 面板高=${k.blurred.subH} 焦点=${k.blurred.activeTag}`);
  mark('键盘/3 真按 Enter 合成了 click', k.entered.clicks > k.blurred.clicks,
    `click ${k.blurred.clicks}→${k.entered.clicks}，命中=${k.entered.lastClick}（不成立就是按键没送到，下面两条判据都是假的）`);
  mark('键盘/4 收起态按 Enter 只展开不跳转',
    k.entered.isOpen && k.entered.display === 'block' && k.entered.subH > 80 && k.entered.path === k.blurred.path,
    `is-open=${k.entered.isOpen} display=${k.entered.display} 面板高=${k.entered.subH} ${k.blurred.path} → ${k.entered.path}`);
  mark('键盘/5 再按 Enter 收起、焦点摘掉、仍不跳转',
    !k.collapsed.isOpen && k.collapsed.display === 'none' && k.collapsed.subH === 0
    && k.collapsed.focused === false && k.collapsed.path === k.blurred.path,
    `is-open=${k.collapsed.isOpen} display=${k.collapsed.display} 面板高=${k.collapsed.subH} 焦点=${k.collapsed.activeTag} URL=${k.collapsed.path}`);
  mark('键盘/6 桌面焦点路径不变', k.wide.visibility === 'visible' && k.wide.settled === true && k.wide.aria === 'true',
    `visibility=${k.wide.visibility} opacity=${k.wide.opacity} aria-expanded=${k.wide.aria}（等落定，上限 1s）`);
  mark('键盘/7 焦点真的落在面板最后一行', /nav-sub-more/.test(k.inPanel.activeTag) && k.inPanel.aria === 'true',
    `activeElement=${k.inPanel.activeTag} aria-expanded=${k.inPanel.aria} display=${k.inPanel.display}（不成立就是这一路没走通，下一条是假的）`);
  mark('键盘/8 Tab 走出这一项：属性回落、面板收起',
    k.tabOut.inSubItem === false && k.tabOut.aria === 'false' && k.tabOut.display === 'none',
    `焦点 ${k.inPanel.activeTag} → ${k.tabOut.activeTag}（仍在这一项内=${k.tabOut.inSubItem}），aria-expanded=${k.tabOut.aria} display=${k.tabOut.display} 面板高=${k.tabOut.subH}`);
}
async function suiteGeometry() {
  console.log('\n【篇幅账（editorial.scss ≤695 那段注释的数字来源）】');
  for (const [w, h] of [[375, 667], [390, 844], [414, 896]]) {
    const g = await probeGeometry(w, h);
    const fold = h - HEADER_H;
    mark(`篇幅账/${w}×${h} 收起态在折线内`, g.collapsed > 0 && g.collapsed <= fold,
      `收起 ${g.collapsed}px / 展开 ${g.expanded}px / 抽屉可视高 ${fold}px`);
    mark(`篇幅账/${w}×${h} 落点行够按`, g.more.h >= 40 && g.child.h >= 40,
      `「全部工具」行 ${g.more.w}×${g.more.h}，子项行 ${g.child.w}×${g.child.h}，父项行 ${g.parentRow.w}×${g.parentRow.h}`);
    note(`篇幅账/${w}×${h} 分组标题`, `.nav-sub-group ${g.group && g.group.h}px（不是落点，只作对账参考）`);
    mark(`篇幅账/${w}×${h} 「全部工具」行可达`, g.moreLink.focused === true && /tools\.html$/.test(g.moreLink.href) && g.moreLink.visibility === 'visible',
      `activeElement=${g.moreLink.focused} tag=${g.moreLink.tag} href=${g.moreLink.href} visibility=${g.moreLink.visibility}`);
  }
}

/* ───────────────────────────── 牙齿 ─────────────────────────────
 * 每处变异写的是**产物里的形状**（压缩器改过名），并指名要哪个探针的哪条预期翻转。
 * 变异没命中 → 响应 500 → 探针拿到的是一份没有编辑脚本的页面，几乎必然翻转，
 * 所以那一格另外看 mutateMiss：命中数为 0 直接判红，不给「什么都没改却全绿」留余地。
 * ─────────────────────────────────────────────────────────────── */
const MUTATIONS = [
  {
    name: '摘掉收起时的那句 blur',
    probe: 'pair',
    /** 摘掉之后 Chrome 点按留下的焦点会让 :focus-within 把面板原地撑回来。 */
    apply: (j) => j.replace(/!\w+&&(\w+)\.blur&&\1\.blur\(\)/, 'void 0'),
    expect: '二点没有真收起（面板还有高度或焦点还在）',
    test: (p) => !(p.second.display === 'none' && p.second.subH === 0 && p.second.focused === false),
  },
  {
    name: '退回旧的两段式（二点跳转）',
    probe: 'pair',
    /**
     * 产物里是 `&&t(n)){var i=!r.classList.contains("is-open");`——`t(n)` 的右括号与
     * `if(` 的右括号是两枚，正则必须写 `\)\)\{`。少一层就静默不命中，
     * 而「不命中」在这一格里长得和「变异成功但没影响」一模一样。
     */
    apply: (j) => j.replace(
      /&&t\((\w)\)\)\{var (\w)=!\w\.classList\.contains\("is-open"\);/,
      '&&t($1)&&!r.classList.contains("is-open")){var $2=!0;',
    ),
    expect: '二点跳了页或面板没收起',
    test: (p) => p.second.path !== p.before.path || p.first.path !== p.before.path,
  },
  {
    name: '吞掉带修饰键的点击',
    probe: 'modifiers',
    /**
     * 产物里 `&&t(n)){` 的两枚右括号，一枚属于 `t(n)`、一枚属于 `if(`：换掉整个调用之后
     * 只剩 `if(` 那一枚，写成 `&&1)){` 会多出一枚右括号，脚本直接 SyntaxError——
     * 那一轮确实"翻转"了，但翻的是"脚本没跑起来"，不是这条判据要看的形状。
     */
    apply: (j) => j.replace(/&&t\((\w)\)\)\{var /, '&&1){var '),
    expect: '某条修饰键被 preventDefault 吞掉',
    test: (m) => [m.ctrl, m.meta, m.shift, m.alt, m.middle].some((v) => v === true),
  },
  {
    name: '把「这一档可展开」的判据拉成恒真',
    probe: 'desktop',
    apply: (j) => j.replace(/\(window\.innerWidth<=695\|\|window\.matchMedia\("\(hover: none\)"\)\.matches\)/, '!0'),
    expect: '桌面点父项不再跳转',
    test: (d) => d.after.path === d.before.path,
  },
  {
    name: '把抽屉里那条 :hover 显示钩子从 (hover:hover) 放出来',
    layer: 'css',
    probe: 'pair',
    /** 放出来之后，触屏点完留下的粘 hover 会替用户"保持展开"：第二下摘掉了 .is-open，面板照旧亮着。 */
    apply: (c) => c.replace(
      '@media screen and (max-width:695px)and (hover:hover){.g-header .nav-item.has-sub:hover .nav-sub{display:block',
      '@media screen and (max-width:695px){.g-header .nav-item.has-sub:hover .nav-sub{display:block',
    ),
    expect: '二点后面板还亮着（粘 hover 顶上来了）',
    test: (p) => p.second.display !== 'none' || p.second.subH > 0,
  },
  {
    name: '把「全部工具」行的触屏内边距退回桌面的 9px/5px',
    layer: 'css',
    probe: 'geometry',
    apply: (c) => c.replace('.g-header .nav-sub .nav-sub-more{padding:13px 10px;', '.g-header .nav-sub .nav-sub-more{padding:9px 10px 5px;'),
    expect: '落点行高掉回 40px 以下',
    test: (g) => g.more.h < 40,
  },
  {
    name: '把横排档那条 :hover 显示钩子从 (hover:hover) 放出来',
    layer: 'css',
    probe: 'tablet',
    /** >695 且无 hover 的平板走的就是这一组：放出来之后粘 hover 替第二下"保持展开"，收起判据必须红。 */
    apply: (c) => c.replace(
      '@media(hover:hover){.g-header .nav-item.has-sub:hover .nav-sub{opacity:1',
      '@media all{.g-header .nav-item.has-sub:hover .nav-sub{opacity:1',
    ),
    expect: '平板二点后面板还亮着（visibility 仍 visible 或 opacity 仍 1）',
    test: (p) => p.second.visibility === 'visible' || Number(p.second.opacity) >= 0.999,
  },
  {
    name: '把箭头那条 :hover 钩子从 (hover:hover) 放出来',
    layer: 'css',
    probe: 'pair',
    /** 面板收起、箭头还朝上＝「看着像还开着」，与这次改口要修的是同一类错觉，所以给它单独的牙齿。
     *  两处换法都只把 `(hover:hover)` 换成 `all`，条件块的左右花括号原样留着——
     *  整段删掉前缀会在产物里剩一枚孤立的 `}`，那一轮翻的是「CSS 解析报错」，不是这条判据要看的形状。 */
    apply: (c) => c.replace(
      '@media(hover:hover){.g-header .nav-item.has-sub:hover .nav-caret{',
      '@media all{.g-header .nav-item.has-sub:hover .nav-caret{',
    ),
    expect: '二点收起后箭头仍 rotate(180deg)',
    test: (p) => /matrix\(-1/.test(p.second.caret),
  },
];

async function teeth() {
  console.log(`\n【牙齿：${MUTATIONS.length} 处变异必须各自点名点燃】`);
  for (const mut of MUTATIONS) {
    const missesBefore = mutateMiss;
    let hits = 0;
    const rewrite = (src) => {
      const out = mut.apply(src);
      if (typeof out !== 'string' || out === src) return null;
      hits += 1;
      return out;
    };
    if (mut.layer === 'css') CSS_MUTATE = rewrite; else JS_MUTATE = rewrite;
    MUTATING = true;
    let flipped = false;
    let err = '';
    try {
      const raw = mut.probe === 'pair' ? await probeTapPair()
        : mut.probe === 'modifiers' ? await probeModifiers()
          : mut.probe === 'desktop' ? await probeDesktop()
            : mut.probe === 'tablet' ? await probeTablet()
              : mut.probe === 'geometry' ? await probeGeometry(375, 667) : await probeKeyboard();
      flipped = mut.test(raw);
    } catch (e) { err = String((e && e.message) || e).slice(0, 90); }
    JS_MUTATE = null;
    CSS_MUTATE = null;
    MUTATING = false;
    const missed = mutateMiss > missesBefore;
    mark(`牙齿/${mut.name}`, !missed && hits > 0 && flipped,
      hits ? `${mut.layer === 'css' ? '样式' : '脚本'}响应改写命中 ${hits} 次，预期翻转=${flipped}（要看见的是：${mut.expect}）${err ? ` 探针抛错：${err}` : ''}`
        : `变异串没在产物里命中——这一格等于没测`);
  }
}


/* ───────────────────────────── 正跑 ───────────────────────────── */
console.log(`读快照：${SITE}${BASE ? `（baseurl ${BASE}）` : '（无 baseurl）'} · 服务在 ${ORIGIN}`);
await suiteTouch(390, 844);
if (!touchWorks) { reap(); process.exit(2); }
await suiteTouch(375, 667);
await suiteModifiers();
await suiteTablet();
await suiteDesktop();
await suiteKeyboard();
await suiteGeometry();
await teeth();

/* ───────────────────────────── 汇总 ───────────────────────────── */
mark('页面零报错', jsErrors.length === 0, jsErrors.length ? [...new Set(jsErrors)].slice(0, 3).join(' | ') : '无 error 级日志与异常');
const reds = results.filter((r) => !r.ok);
const behavior = results.filter((r) => !r.id.startsWith('牙齿/'));
const teethAll = results.filter((r) => r.id.startsWith('牙齿/'));
const teethLit = teethAll.filter((r) => r.ok).length;
if (reds.length) {
  console.log('\n✗ 红项清单：');
  for (const r of reds) console.log(`   · ${r.id} — ${r.detail}`);
}
console.log(`\n${reds.length ? '✗' : '✓'} 移动端下拉点按门禁：判据 ${behavior.length} 条 红 ${reds.length - (teethAll.length - teethLit)} 条 · 牙齿 ${teethLit}/${teethAll.length} 组变异如期点名`);
reap();
process.exit(reds.length ? 1 : 0);
