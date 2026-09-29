#!/usr/bin/env node
/**
 * 动效增强批 IV（M24 · M25 · M26 · M27 · M28 · M29）浏览器侧核验：真 Chrome + CDP，无第三方依赖，
 * 用 Node 22 的全局 WebSocket。骨架照 `scripts/verify-codec-browser.mjs`（段 3 Task 8 那一格），
 * 那里已经踩过并修好的量具坑（端口现抢、调试端点只认自己子进程的 stderr、CDP 死线、
 * 真按键 / 真鼠标、外链走 direct:// + MAP ~NOTFOUND）这一格一律沿用，不重新发明。
 *
 * 为什么这一格不复用那两份脚本：那两个判的是工具页的功能，这一格判的是「一层浮出去
 * 有没有被看见」——同一个文件里叠两组判据，红的时候分不出是谁的锅。
 *
 * 判据分十组：
 *   1) 量具自证：这台 Chrome 真的支持 allow-discrete / @starting-style / dialog 顶层过渡，
 *      并且服务的字节 == 磁盘字节（否则量的是上一轮产物）。
 *   2) M24 七个浮层的**退场**：⌘K / 书架 / 灯箱 / 金句药丸 / 金句卡 / TOC 抽屉 / 偏好面板 /
 *      预览卡。每条都要一段 rAF 采样轨迹，判据形状统一为
 *      「开→落定→关」之后存在一帧「还渲染着、但已经不在终值」，且终帧确实不再渲染。
 *      位移类（抽屉）不看 opacity，改看 rect 的几何行程——它只动 translate，不看透明度。
 *   3) M24 的 ::backdrop 淡化：开与关两个方向都要有中间帧（遮罩是这一批唯一新增的入场效果）。
 *   4) M24 没改坏入场：带 keyframes 的那几层，打开后第一帧仍在跑那条动画
 *      （animationName 非 none），且「关→开」那一瞬间不产生新的过渡（过渡在未渲染→渲染的方向不运行）。
 *   5) reduce 档：同一批层在 prefers-reduced-motion: reduce 下必须「开就看得见、
 *      关就看不见」，中间不许有停留的半透明帧，也不许出现「藏了不再显」。
 *   6) M25 文章页首屏入场：刊头六件 + 头图的 animationName/时长/延迟逐条对；头图那一层要
 *      「插值得到、但全程 opacity=1」（只揭不淡）；挂上 .is-vt-entry 之后必须全压成 none。
 *      末尾那条 LCP 三臂 A/B（不摘 / 摘掉 heroWipe / 换成淡入）是这一组的立论根据：
 *      注释里写「头图是本文页的 LCP 候选」「淡入要多背几百毫秒」，就得由这里量出来。
 *   7) M26 目录指示器：线的满高 = 列表的 scrollHeight（不是 overflow:auto 的可视框高），
 *      长度只由 scaleY 给（布局高在三个滚动位置恒定、transitionProperty 里没有 height），
 *      线头那颗点与线读同一个 --toc-y 且落定后在同一处；reduce 档仍是功能，抽屉里线点同摘。
 *   8) M27 揭示覆盖面 + 解码闸门：三条新选择器所在的元素都要拿到 is-in；正文懒加载图那一行
 *      在图没到时必须不显（/__slow.webp 的 700ms 与 5000ms 两支分别验「等 load」与「1200ms 保险」）；
 *      被简写吃掉过的 hover 过渡要还在；摘掉 js-reveal 与 reduce 两态都必须看得见。
 *   9) M28 跨页转场的命名唯一性：从 index.min.css 抽出每条 view-transition-name，先与真
 *      CSSOM 对账（防文本解析器把 at-rule 的 prelude 当成选择器），再逐页保守数实例，
 *      任何一页同名 >1 即红——撞名会让整次跨页转场静默不跑，没有别的症状。
 *      这一格自带牙齿夹具（dup.html 写两遍同一个 class、decoy.html 放前缀诱饵），
 *      数不出重复就红，因为「全站最多 0 个」那种绿是量具坏了。
 *  10) M29 工具层的「状态变了」要看得见：/tools/idcard.html 上量三条 tkIn/tkShake——
 *      换面板重跑入场、判定药丸同一条动画只降一档时长、红条只在第一次插入时抖；
 *      外加令牌流到工具页、服务的字节 == 磁盘、焦点环仍归 ringGrow，以及 reduce /
 *      禁 JS / reduce+禁 JS 三态都必须「内容照常可见、没有停在 opacity:0」。
 *      禁 JS 两态靠 HTML_MUTATE 摘掉响应里的 <script>（不是改磁盘，也不是 CDP 的
 *      setScriptExecutionDisabled——那会把 Runtime 一起停掉，量不到任何东西）。
 *
 * 读产物：`MOTION_SITE` 指到一次 Jekyll 快照（默认 `ROOT/_site`）；`MOTION_BASE` 是快照的
 * baseurl（用 `--baseurl ""` 建的快照留空）。跑法 `node scripts/verify-motion-batch4.mjs`，
 * 退出码 0 = 全绿，1 = 有红项，2 = 环境没起来。
 */
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.MOTION_SITE ? path.resolve(process.env.MOTION_SITE) : path.join(ROOT, '_site');
const BASE = process.env.MOTION_BASE === undefined ? '/better-blog' : process.env.MOTION_BASE;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ARTICLE = '/2026/09/21/security-audit-two-validators.html';
const HOME = '/';
if (!fs.existsSync(path.join(SITE, ARTICLE.slice(1)))) {
  console.log(`✗ ${SITE} 里没有 ${ARTICLE}——先构建产物，或用 MOTION_SITE 指到快照`);
  process.exit(2);
}

/** 端口现抢：写死端口会被上一轮遗留进程占着，脚本照常往下跑（段 2 那条教训）。 */
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
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.json': 'application/json', '.xml': 'application/xml',
  '.txt': 'text/plain', '.ico': 'image/x-icon', '.map': 'application/json',
};
/** 第 6 组用：非空时把 index.min.css 的响应文本过一遍这道改写。 */
let CSS_MUTATE = null;
/**
 * 第 10 组用：非空时把 HTML 响应文本过一遍这道改写。
 * 之所以改响应而不是改磁盘——`Page.setScriptExecutionDisabled` 会把 Runtime 一起停掉
 * （段 2 踩过：一摘脚本连读数都没有，只能量「摘了脚本的副本」），而磁盘那份是第 1 组
 * 「服务的字节 == 磁盘」的对照物。钩子置空即原样。
 */
let HTML_MUTATE = null;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length);
  if (p.endsWith('/')) p += 'index.html';
  /**
   * M27 的解码闸门要有「一张还在路上的图」可测。真站上这张图本地只要十几毫秒就 complete，
   * 闸门那一支根本来不及被读到；所以本站点挂一个慢响应端点，把正文里某张懒加载图的 src
   * 指过来，让「未解码」这段状态拉长到可采样的量级（第 8 组用）。字节就是真头图的字节。
   */
  if (p === '/__slow.webp') {
    const ms = Math.min(5000, Math.max(0, Number((new URL(req.url, ORIGIN)).searchParams.get('ms') || 0)));
    const img = path.join(SITE, 'assets/img/security-audit-two-validators/banner.webp');
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'image/webp', 'cache-control': 'no-store' });
      res.end(fs.readFileSync(img));
    }, ms);
    return;
  }
  const f = path.join(SITE, p);
  if (!f.startsWith(SITE)) { res.writeHead(403); return res.end('403'); }
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('404 ' + p); }
  let body = fs.readFileSync(f);
  /**
   * 第 6 组的 LCP A/B 靠改写**响应**做变异，而不是改磁盘：磁盘那份是第 1 组
   * 「服务的字节 == 磁盘」的对照物，动它就动了自证。钩子置空即原样。
   */
  if (CSS_MUTATE && f.endsWith('assets/css/index.min.css')) {
    body = Buffer.from(CSS_MUTATE(body.toString('utf8')), 'utf8');
  }
  if (HTML_MUTATE && f.endsWith('.html')) {
    body = Buffer.from(HTML_MUTATE(body.toString('utf8')), 'utf8');
  }
  res.writeHead(200, {
    'content-type': (MIME[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

/**
 * 这一族 flag 是段 2 / 段 3 收口后的形状：本机常开系统代理时 `--host-resolver-rules` 一条都不参与，
 * 必须先把代理摘成 direct://，规则才说话；`MAP * ~NOTFOUND` 让站外那几件外链秒失败（外链字节恒 0），
 * `EXCLUDE 127.0.0.1` 保住本格自己的静态服务。
 */
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'batch4-chrome-'));
const chrome = spawn(CHROME, ['--headless', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run',
  '--disable-background-networking', '--window-size=1440,900',
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

/**
 * 崩溃也要收尸。第一版只在文件末尾 `chrome.kill()`，于是判据中途抛一次异常
 * （这一格真抛过一次 `sel.split is not a function`）就留下一台活着的 headless Chrome：
 * 它不报错、不占固定端口（`--remote-debugging-port=0`），在 `ps` 里只表现为一个
 * `batch4-chrome-*` 临时目录，下一轮那些按帧计数判的格（「200ms 内 416 帧恒 0」）就被它扰动。
 * 所以异常与退出两条路都要挂上收尸；kill 之后再退，退出码沿用 2 =「环境没起来」那一档。
 */
const reap = () => { try { chrome.kill(); } catch { /* 已经没了就别再抛一次 */ } try { server.close(); } catch { /* 同上 */ } };
process.on('uncaughtException', (err) => {
  console.log(`\n✗ 量具自己抛了（不是产物红）：${(err && err.stack) || err}`);
  reap();
  process.exit(2);
});
process.on('exit', reap);
/**
 * 信号那一路更要收：本节推荐的跑法是 `perl -e 'alarm shift; exec @ARGV' 900 node …`，
 * 超时打到 node 的是 SIGALRM——它不触发 `exit` 事件，也不走 `uncaughtException`，
 * 于是 `chrome.kill()` 那行永远轮不到。本机收摊时清掉过三台 `batch4-chrome-*` 的活体，
 * 而从 `ps` 里分不出它是崩溃留下的还是超时留下的——两条路都要堵上才知道区别。
 * 注册监听会把默认动作换成「收尸再退」，退出码与崩溃同一档 2。
 */
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
let GROUP = '(启动)';
const S = (m, p = {}) => {
  const call = c.send(m, p, sessionId);
  call.catch(() => {});
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`CDP ${m} 在 ${CDP_MS / 1000}s 内没有回应（当时正在跑「${GROUP}」）`)), CDP_MS);
    call.then(resolve, reject).finally(() => clearTimeout(timer));
  });
};
const errors = [];
c.on((m) => {
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error'
    && String(m.params.entry.source || '').startsWith('javascript')) errors.push('log:' + m.params.entry.text.slice(0, 160));
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    errors.push('exc:' + (d.exception?.description || d.text || '').replace(/\s+/g, ' ').slice(0, 160));
  }
});
await S('Runtime.enable');
await S('Log.enable');
await S('Page.enable');
await S('Network.setCacheDisabled', { cacheDisabled: true });
/**
 * headless 新建的 target 默认不是前台，而后台标签页里 requestAnimationFrame 不来。
 * 这一整格的轨迹全靠 rAF 采样，不 bringToFront 就会挂在第一条轨迹上——看着像页面坏了，
 * 其实是量具自己没帧可数。（第一次跑就是这么挂满 30s 的。）
 */
await S('Page.bringToFront');

const evalJs = async (expression) => {
  const r = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    throw new Error('页内异常：' + (r.exceptionDetails.exception?.description
      || r.exceptionDetails.text) + ' @ ' + expression.replace(/\s+/g, ' ').slice(0, 90));
  }
  return r.result.value;
};
const goto = async (url) => {
  await S('Page.navigate', { url });
  for (let i = 0; i < 250; i += 1) {
    if (await evalJs('document.readyState') === 'complete') return;
    await new Promise((r) => setTimeout(r, 60));
  }
  throw new Error('加载超时：' + url);
};
const setVp = (width, height = 900) => S('Emulation.setDeviceMetricsOverride',
  { width, height, deviceScaleFactor: 1, mobile: false });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** 只发事件、不等冷却——轨迹的触发动作要用它，否则 70ms 的 settle 白吃掉过渡的前 1/3。 */
const keyFast = async (k, code, vk, modifiers = 0) => {
  const base = { key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  if (modifiers) base.modifiers = modifiers;
  await S('Input.dispatchKeyEvent', { type: 'keyDown', ...base });
  // `char` 只给单字符键发：给 Escape 发一条 text=undefined 的 char 事件，CDP 会当成坏参数，
  // 于是「按了 Esc」这件事静默没发生，量具把「遮罩还在」报成页面缺陷。
  if (k.length === 1 && !modifiers) await S('Input.dispatchKeyEvent', { type: 'char', ...base, text: k });
  await S('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
};
const key = async (...a) => { await keyFast(...a); await wait(70); };
/**
 * 真鼠标点击前先做命中测试（memory 那条：视口外的落点会伪装成「交互坏了」的假红）。
 * 返回命中说明串；命中的不是目标（或其子孙）就抛，让这一组红得有名有姓。
 */
const hitTest = async (sel, nth = 0) => evalJs(`(async () => {
  const el = [...document.querySelectorAll(${JSON.stringify(sel)})][${nth}];
  if (!el) return { err: 'no-node' };
  el.scrollIntoView({ block: 'center', behavior: 'instant' });
  // 等滚动落定用 setTimeout 而不是两帧 rAF：headless 里没帧可调度的时候 rAF 根本不跑，
  // 命中测试会挂在半路（下面的采样密度判据量的就是这件事）。getBoundingClientRect 自己会强制布局。
  await new Promise(r => setTimeout(r, 40));
  const r = el.getBoundingClientRect();
  const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
  const top = document.elementFromPoint(x, y);
  return { x, y, w: Math.round(r.width), h: Math.round(r.height),
    hit: top ? (top.tagName + '.' + (top.className || '')).slice(0, 60) : 'none',
    ok: !!top && (top === el || el.contains(top) || top.contains(el)) };
})()`)
  .then((t) => { if (t.err || !t.ok) { mark(`hitTest FAIL ${sel} ${JSON.stringify(t)}`); throw new Error(`命中测试失败 ${sel}: ${JSON.stringify(t)}`); } mark(`hitTest ok ${sel} @${t.x},${t.y}`); return t; });
const clickAt = async (t) => {
  await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: t.x, y: t.y });
  await S('Input.dispatchMouseEvent', { type: 'mousePressed', x: t.x, y: t.y, button: 'left', buttons: 1, clickCount: 1 });
  await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x: t.x, y: t.y, button: 'left', buttons: 0, clickCount: 1 });
};
/** 真鼠标点击；Fast 版不等冷却，供轨迹当作触发动作用。 */
const clickFast = (sel, nth = 0) => hitTest(sel, nth).then(clickAt);
const click = async (sel, nth = 0) => { await clickFast(sel, nth); await wait(60); };

/**
 * 一次一格的单帧读数。轨迹由 Node 一侧一圈一圈「问」出来，不让页内自己数——这一条是踩实了的：
 * headless 里页内的 setTimeout 与 rAF 都挂在 BeginMainFrame 上，没有帧被调度时定时器根本不跑。
 * 上一版 12ms 一圈的页内采样，在 ⌘K 退场那 200ms 里连着 390ms 一个读数都没有（实测序列
 * t=71,84,96,109,123,137 之后直接跳到 t=527），于是把「有中间帧」判成了「没有中间帧」。
 * 而 Runtime.evaluate 本身会逼渲染进程跑一个任务，getComputedStyle 又强制样式重算，
 * 过渡插值走的是 document timeline（实测 400ms 线性过渡在 120ms 读到 .25、270ms 读到 .625），
 * 所以「一问一答」既有密度、又不依赖帧被提交。采样密度在第 1 组里单独立一条判据。
 */
const sampleOnce = (sel, pseudo) => evalJs(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return { err: 'no-node' };
  const cs = getComputedStyle(el, ${JSON.stringify(pseudo || null)});
  const r = el.getBoundingClientRect();
  return { op: +Number(cs.opacity).toFixed(3), disp: cs.display,
    rend: r.width > 0 && r.height > 0 ? 1 : 0, tr: cs.translate || '',
    top: Math.round(r.top), h: Math.round(r.height) };
})()`);

/** 先落下触发动作（真按键 / 真点击，不等冷却），随即一圈圈读，读满 ms 毫秒。 */
const traceAfter = async (action, sel, pseudo, ms = 520) => {
  const t0 = Date.now();
  await action();
  const out = [];
  while (Date.now() - t0 < ms) {
    const s = await sampleOnce(sel, pseudo);
    if (s.err) return { samples: out, err: s.err };
    out.push({ t: Date.now() - t0, op: s.op, disp: s.disp, rend: s.rend, tr: s.tr, top: s.top, h: s.h });
  }
  return { samples: out, n: out.length };
};
/**
 * 一次动作、多路读数：每圈把 targets 全读一遍，各留一条同一起点的轨迹。
 * 金句卡本体和它的 ::backdrop 是同一次 Esc 关掉的两层，分两次独立轨迹会把起点错开，
 * 于是要么读出「遮罩比卡片先没了」这种根本不存在的顺序，要么两路都错过中途。
 */
const tracePair = async (action, targets, ms = 520) => {
  const out = targets.map(() => ({ samples: [], err: '' }));
  const t0 = Date.now();
  await action();
  while (Date.now() - t0 < ms) {
    const t = Date.now() - t0;
    for (let i = 0; i < targets.length; i += 1) {
      if (out[i].err) continue;
      const s = await sampleOnce(targets[i][0], targets[i][1]);
      if (s.err) { out[i].err = s.err; continue; }
      out[i].samples.push({ t, op: s.op, disp: s.disp, rend: s.rend, tr: s.tr, top: s.top, h: s.h });
    }
  }
  return out;
};
const snap = (sel, pseudo) => evalJs(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return { err: 'no-node' };
  const cs = getComputedStyle(el${pseudo ? `, ${JSON.stringify(pseudo)}` : ''});
  const r = el.getBoundingClientRect();
  return { op: +Number(cs.opacity).toFixed(3), disp: cs.display, anim: cs.animationName,
    dur: cs.animationDuration, rend: r.width > 0 && r.height > 0 ? 1 : 0 };
})()`);

/** 轨迹里「还渲染着、但已离开终值」的那一帧——M24 要的就是这一帧存不存在。 */
const midFade = (s) => s.filter((x) => x.rend === 1 && x.op > 0.05 && x.op < 0.95);
const traceFail = (label, t, why) => { if (t.err) RED(label, `${why}（${t.err}，已读到 ${t.samples.length} 帧）`); else RED(label, why); };
/** 红项带上轨迹头部，分清「没中间帧」是页面没动还是量具没密度。 */
const tail = (t) => JSON.stringify(t.samples.slice(0, 6)) + '｜共 ' + t.samples.length + ' 帧';

let PASS = 0;
const REDS = [];
/**
 * 同步落盘的进度标记。第一版这条判据挂在 30s 死线上、stdout 一个字没吐——
 * stdout 是异步的，进程不退出就看不到已经跑过哪儿，「量具挂了」和「页面挂了」又长得一样。
 * appendFileSync 是同步的，挂住的那一格因此会自己报出来。MOTION_TRACE 指到别处即可。
 */
const TRACE_TO = process.env.MOTION_TRACE || '';
const mark = (s) => { if (TRACE_TO) fs.appendFileSync(TRACE_TO, `[${new Date().toISOString().slice(11, 23)}] ${s}\n`); };
const ok = (label, detail) => { PASS += 1; console.log(`  ✓ ${label}${detail ? ' — ' + detail : ''}`); };
const RED = (label, why) => { REDS.push(`${label} — ${why}`); console.log(`  ✗ ${label} — ${why}`); };
const group = (name) => { GROUP = name; console.log(`\n## ${name}`); };

/**
 * 一条浮层的 M24 判据：开 → 落定 → 关（关的同时采轨迹）。
 * kind='fade' 看透明度中间帧；kind='slide' 看 rect.top 的行程（抽屉只动 translate，没有淡出）。
 */
async function checkLayer(name, { sel, openSel, closeSel, closeKey, vp, kind = 'fade', ms = 520, dwell = 380, pseudo }) {
  mark(`[${name}] begin sel=${sel}`);
  if (vp) await setVp(vp[0], vp[1]);
  await goto(ORIGIN + BASE + ARTICLE);
  mark(`[${name}] loaded`);
  await wait(700);
  if (openSel) { mark(`[${name}] open-click ${openSel}`); await click(openSel); }
  else { mark(`[${name}] open-key`); await key('k', 'KeyK', 75, 4); }
  await wait(dwell);
  mark(`[${name}] before-snap`);
  const before = await snap(sel, pseudo);
  if (before.err || before.rend !== 1 || before.op < 0.97) {
    RED(`${name}·开`, `打开后不是终态：${JSON.stringify(before)}`); return;
  }
  mark(`[${name}] trace-start`);
  const close = () => (closeSel ? clickFast(closeSel) : closeKey ? keyFast(...closeKey) : clickFast(openSel));
  const t = await traceAfter(close, sel, pseudo, ms);
  mark(`[${name}] trace back, samples=${t.samples ? t.samples.length : t.err}`);
  if (t.err) { traceFail(`${name}·退场`, t, '轨迹没跑起来'); return; }
  const after = t.samples[t.samples.length - 1];
  if (kind === 'fade') {
    const mid = midFade(t.samples);
    if (!mid.length) RED(`${name}·退场`, `全程没有「还渲染着但已离开终值」的帧：${tail(t)}`);
    else ok(`${name}·退场`, `中间帧 ${mid.length} 个 / 共 ${t.samples.length} 帧，首帧 t=${mid[0].t} op=${mid[0].op}`);
  } else {
    const start = t.samples.find((x) => x.rend === 1);
    const moved = t.samples.filter((x) => x.rend === 1 && start && x.top > start.top + 4);
    if (!moved.length) RED(`${name}·退场`, `还渲染着的帧里没有一帧比打开位置向下滑过：top=${[...new Set(t.samples.map((x) => x.top))].join(',')}`);
    else ok(`${name}·退场`, `${moved.length} 帧在滑（共 ${t.samples.length} 帧），t=${moved[0].t} top ${start.top}→${moved[0].top}`);
  }
  if (after.rend !== 0) RED(`${name}·落定`, `轨迹末帧仍在渲染（display=${after.disp} op=${after.op}）——层没真的收走`);
  else ok(`${name}·落定`, `末帧 t=${after.t} display=${after.disp}`);
}

// ══════════════════════════════════════════════════════════════════
group('1) 量具自证');
await setVp(1440, 900);
await goto(ORIGIN + BASE + ARTICLE);
{
  const sup = await evalJs(`({ discrete: CSS.supports('transition-behavior','allow-discrete'),
    overlayProp: CSS.supports('overlay','auto'), topLayer: typeof document.createElement('dialog').showModal === 'function',
    startingStyle: (() => {
      // CSSOM 只遍历顶层规则会漏光：@starting-style 嵌在
      // @media (prefers-reduced-motion: no-preference) 里面，必须递归下钻。
      const walk = (rules) => {
        for (const r of (rules || [])) {
          if (r.constructor && /StartingStyle/.test(r.constructor.name)) return true;
          if (r.cssRules && walk(r.cssRules)) return true;
        }
        return false;
      };
      for (const sh of document.styleSheets) { try { if (walk(sh.cssRules)) return true; } catch (e) {} }
      return false;
    })() })`);
  if (!sup.discrete) RED('量具', '这台 Chrome 不支持 transition-behavior: allow-discrete，M24 的判据在这里恒为「退场不存在」');
  else ok('量具', JSON.stringify(sup));
  const css = fs.readFileSync(path.join(SITE, 'assets/css/index.min.css'), 'utf8');
  const served = await evalJs(`fetch('${ORIGIN + BASE}/assets/css/index.min.css').then(r=>r.text()).then(t=>({
    len: t.length, discrete: (t.match(/allow-discrete/g)||[]).length, starting: (t.match(/@starting-style/g)||[]).length }))`);
  const diskD = (css.match(/allow-discrete/g) || []).length;
  if (served.discrete !== diskD || served.starting !== 1) {
    RED('服务的字节 == 磁盘', `served{d:${served.discrete},s:${served.starting}} disk{d:${diskD}}`);
  } else ok('服务的字节 == 磁盘', `allow-discrete ${served.discrete} 处、@starting-style ${served.starting} 处`);
  if (!sup.startingStyle) ok('@starting-style 已解析', '递归 CSSOM 里没抓到类型名，改由第 3 组的行为判据兜底（遮罩淡入必须出现中间帧）');
  else ok('@starting-style 已解析', 'CSSOM 递归抓到了那条规则');

  /**
   * 采样密度自证。这一整批的判据都在问「关闭那 200ms 里有没有一帧停在半路」，
   * 所以先证明「那 200ms 确实被读到很多次」。上一版让页内自己数（setTimeout 12ms 一圈），
   * 实测在同一段时间里只拿到 6 个读数、随后 390ms 空窗——headless 没帧可调度时页内定时器根本不跑，
   * 量具没密度却把页面判成了「没有退场」。这一格走与轨迹完全相同的路径（Node 一圈一圈 evalJs）
   * 读一条注入的 300ms 线性过渡。
   *
   * 2026-09-29 把这条从「一项红」改成「环境不过就退 2」，因为同一天量到三把数：
   * 机器空闲时 299 帧 / 300ms，本机 load average 压在 22 到 55（8 个核）时读到 47 帧与 33 帧——
   * 后两把按老门槛（≥12 帧）算过，于是第 2 组到第 10 组跟着红 18 项（「⌘K 退场共 8 帧」「换面板重跑只读到 0 帧」「TOC 抽屉 top=9364」），
   * 红的全是机器，不是产物（同一批产物、同一套判据，299 帧那一轮 18 项全绿）。门槛取 120 帧 / 300ms
   * （约等于空闲读数的四成，离那两把饿死的读数还有三倍），且必须**致命**：
   * 一项混在 93 项里的红会让人去查浮层代码，而正确答案是等机器空下来重跑。
   */
  const dens = await traceAfter(() => evalJs(`(() => {
      const d = document.createElement('div');
      d.id = '__dens';
      d.style.cssText = 'position:fixed;left:0;top:0;width:20px;height:20px;opacity:0;transition:opacity .3s linear';
      document.body.appendChild(d); void d.offsetWidth; d.style.opacity = '1'; return 1;
    })()`), '#__dens', null, 300);
  const kinds = new Set(dens.samples.filter((s) => s.op > 0.02 && s.op < 0.98).map((s) => s.op));
  const span = dens.samples.length ? dens.samples[dens.samples.length - 1].t : 0;
  await evalJs(`(() => { const d = document.querySelector('#__dens'); if (d) d.remove(); return 1; })()`);
  if (dens.samples.length < 120 || kinds.size < 3) {
    console.log(`\n✗ 采样密度不足：300ms 只读到 ${dens.samples.length} 帧、中间取值 ${kinds.size} 个`
      + '——机器此刻不空（另有构建或另一台 headless 在跑）。'
      + '下面所有「有没有中间帧」的判据在这种密度下必然假红，不看产物，等空了重跑。');
    reap();
    process.exit(2);
  } else ok('采样密度', `${dens.samples.length} 帧 / ${span}ms，中间取值 ${kinds.size} 个`);
}

// ══════════════════════════════════════════════════════════════════
group('2) M24 各层退场（no-preference 档）');
await checkLayer('⌘K 面板', { sel: '#cmdk', closeKey: ['Escape', 'Escape', 27], dwell: 420 });
await checkLayer('书架', { sel: '#shelf-dlg', openSel: '[data-shelf-open]', closeKey: ['Escape', 'Escape', 27] });
await checkLayer('灯箱', { sel: '.lightbox', openSel: '.markdown-body img.is-zoomable',
  closeKey: ['Escape', 'Escape', 27], dwell: 560, ms: 900 });
await checkLayer('偏好面板', { sel: '#reader-panel', openSel: '.reader-btn', closeSel: '.reader-btn' });
await checkLayer('TOC 抽屉', { sel: '.post-rail', kind: 'slide',
  openSel: '.toc-fab', closeSel: '.toc-close', vp: [900, 800], dwell: 520, ms: 700 });

// ———— 2b) 三个要走「选中 / 悬停」才出现的层 ————
// 这三条的触发面不是点按钮：金句药丸等 selectionchange，预览卡等 mouseenter|focus。
// 允许用程序给的 focus 与 Range（被判的是「这一层收走时有没有一段可观察的时间」，
// 事件可信度不是这一格的判据），但每一步都自证状态真的到了（card.hidden===false 之类），
// 到不了就红得有名有姓，而不是拿一条空轨迹当绿。
group('2b) 预览卡 / 金句药丸 / 金句卡');
await setVp(1440, 900);
await goto(ORIGIN + BASE + ARTICLE);
await wait(900);
{
    /**
     * 预览卡：这一格原先按「站内文章链接」找目标，实测 2026 年 14 篇文章的 #post-body 里
     * 一条站内跳转都没有（系列块 / 相关阅读在 #post-body 之外，用浏览器逐篇查过），
     * find 返回 undefined，于是报成「预览卡·开 no-internal-link」。改走外链那一支：
     * describe() 认它（代码给这类链接挂了 .lp-external，这里顺手自证），
     * 且外链分支的 show() 不等语料回包，判据更干净。
     *
     * 「滚」和「focus」必须分成两次 evaluate。hide() 挂在 window scroll 的捕获阶段上
     * （卡片是 fixed，滚动会和链接脱开，这条收起是对的），而 scroll 事件是异步派的：
     * 同一次 evaluate 里先 scrollIntoView 再 focus，执行顺序成了 focus→show() 立刻跑、
     * 随后排队的 scroll→hide() 把刚亮的卡片掐灭——上一版正是这样红在「disp=none op=0」，
     * 是量具抢跑，不是页面没有退场载体。
     */
    const scrolled = await evalJs(`(() => {
        const links = [...document.querySelectorAll('#post-body a[href]')];
        const a = links.find(x => /^https?:\\/\\//.test(x.getAttribute('href') || ''));
        if (!a) return { err: 'no-external-link', total: links.length };
        window.__lp = a;
        a.scrollIntoView({ block: 'center', behavior: 'instant' });
        return { href: a.getAttribute('href').slice(0, 46), tagged: a.classList.contains('lp-external') };
    })()`);
    await wait(420);
    const shown = await evalJs(`(() => {
        const a = window.__lp;
        if (!a) return { err: 'no-handle' };
        a.focus();
        return { onTarget: document.activeElement === a ? 1 : 0 };
    })()`);
    await wait(320);
    const on = await snap('.lp-card');
    if (scrolled.err || !shown.onTarget || on.err || on.rend !== 1 || on.op < 0.97) {
      RED('预览卡·开', `${JSON.stringify(scrolled)} ${JSON.stringify(shown)} ${JSON.stringify(on)}`);
    } else {
      ok('预览卡·开', `href=${scrolled.href}${scrolled.tagged ? ' · 已标 .lp-external' : ' · 未标外链类（仍出卡）'}，op=${on.op}`);
    }
    const t = await traceAfter(() => evalJs('document.activeElement && document.activeElement.blur(); 1'),
      '.lp-card', null, 400);
    if (t.err) traceFail('预览卡·退场', t, '轨迹没跑起来');
    else {
        const mid = midFade(t.samples);
        const last = t.samples[t.samples.length - 1];
        if (!mid.length) RED('预览卡·退场', tail(t));
        else ok('预览卡·退场', `中间帧 ${mid.length} 个 / 共 ${t.samples.length} 帧（op=${mid.map((x) => x.op).join(',')}）`);
        if (last.rend) RED('预览卡·落定', `末帧仍在渲染：${JSON.stringify(last)}`);
    }

    // 金句药丸 + 金句卡：真选区驱动
    const sel = await evalJs(`(() => {
        const ps = [...document.querySelectorAll('#post-body p')];
        const p = ps.find(p => p.innerText.trim().length >= 20 && p.innerText.trim().length <= 150
            && !p.querySelector('a,code,img'));
        if (!p) return { err: 'no-paragraph' };
        p.scrollIntoView({ block: 'center', behavior: 'instant' });
        const r = document.createRange(); r.selectNodeContents(p);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        return { len: s.toString().trim().length };
    })()`);
    await wait(500);
    const barOn = await snap('.quote-bar');
    if (sel.err || barOn.err || barOn.rend !== 1) RED('金句药丸·开', `${JSON.stringify(sel)} ${JSON.stringify(barOn)}`);
    else ok('金句药丸·开', `选中 ${sel.len} 字，op=${barOn.op}`);
    // 点「做成卡片」→ dialog 出现（这一步用真鼠标，因为它同时验证药丸可点）
    await click('.quote-bar-btn');
    await wait(420);
    const dlgOn = await snap('.quote-dialog');
    if (dlgOn.err || dlgOn.rend !== 1 || dlgOn.op < 0.97) RED('金句卡·开', JSON.stringify(dlgOn));
    else ok('金句卡·开', `op=${dlgOn.op}`);
    // 一次 Esc 落下，卡片本体与 ::backdrop 各一条轨迹：两次独立轨迹会把起点错开
    const both = await tracePair(() => keyFast('Escape', 'Escape', 27),
      [['.quote-dialog', null], ['.quote-dialog', '::backdrop']], 520);
    for (const [i, label] of [[0, '金句卡·退场'], [1, '金句卡 backdrop·退场']]) {
      const s = both[i];
      if (s.err) { traceFail(label, s, '轨迹没跑起来'); continue; }
      const mid = midFade(s.samples);
      if (!mid.length) RED(label, tail(s));
      else ok(label, `中间帧 ${mid.length} 个 / 共 ${s.samples.length} 帧（op=${mid.slice(0, 4).map((x) => x.op).join(',')}）`);
    }
    // 药丸自己的退场：清空选区。这里要等过 --dur-2（200ms）再断言，否则量到的是退场途中
    await evalJs('getSelection().removeAllRanges()');
    await wait(320);
    const gone = await snap('.quote-bar');
    if (gone.rend) RED('金句药丸·落定', '清空选区后药丸仍在渲染');
    else ok('金句药丸·落定', '已不渲染');
}

// ══════════════════════════════════════════════════════════════════
// 遮罩是这一批唯一「新增的入场效果」：淡入靠 @starting-style，淡出靠 allow-discrete，
// 两个方向分别立判据。入场那一条从动作落下的瞬间就开始读，起点值 0 因此看得见。
group('3) M24 的 ::backdrop 淡化（开与关两个方向）');
for (const [name, sel, openSel] of [['书架', '#shelf-dlg', '[data-shelf-open]'],
  ['灯箱', '.lightbox', '.markdown-body img.is-zoomable']]) {
  await goto(ORIGIN + BASE + ARTICLE);
  await wait(700);
  const inT = await traceAfter(() => clickFast(openSel), sel, '::backdrop', 420);
  if (inT.err) traceFail(`${name} backdrop·入场`, inT, '轨迹没跑起来');
  else {
    const mid = midFade(inT.samples);
    if (!mid.length) RED(`${name} backdrop·入场`, `@starting-style 没给出中间帧：${tail(inT)}`);
    else ok(`${name} backdrop·入场`, `中间帧 ${mid.length} 个，首帧 t=${inT.samples[0].t} op=${inT.samples[0].op}`);
    const ended = await snap(sel, '::backdrop');
    if (ended.op < 0.97) RED(`${name} backdrop·开到底`, `终值只到 ${ended.op}`);
  }
  const outT = await traceAfter(() => keyFast('Escape', 'Escape', 27), sel, '::backdrop', 520);
  if (outT.err) traceFail(`${name} backdrop·退场`, outT, '轨迹没跑起来');
  else {
    const mid = midFade(outT.samples);
    if (!mid.length) RED(`${name} backdrop·退场`, tail(outT));
    else ok(`${name} backdrop·退场`, `中间帧 ${mid.length} 个 / 共 ${outT.samples.length} 帧，op=${mid.slice(0, 4).map((x) => x.op).join(',')}`);
  }
}

// ══════════════════════════════════════════════════════════════════
group('4) 入场没被改坏');
await goto(ORIGIN + BASE + ARTICLE);
await wait(700);
await key('k', 'KeyK', 75, 4);
{
  const early = await snap('.cmdk-panel');
  if (early.anim === 'none') RED('⌘K 入场', 'cmdkIn 没在跑'); else ok('⌘K 入场', `animationName=${early.anim}/${early.dur}`);
  const cont = await snap('#cmdk');
  if (cont.op < 0.97) RED('⌘K 入场·容器', `打开后容器透明度 ${cont.op}——入场被叠了第二层淡入`);
  else ok('⌘K 入场·容器', `容器 op=${cont.op}（@starting-style 之外还有一道「未渲染→渲染不运行过渡」的保险）`);
}
await key('Escape', 'Escape', 27);
await wait(300);
await click('.reader-btn');
{
    // 两条要分开量：animationName 在入场那 180ms 里才是 readerIn，终态 op 必须等它跑完才读
    const early = await snap('.reader-panel');
    if (early.anim !== 'readerIn') RED('偏好面板入场', `animationName=${early.anim}`);
    else ok('偏好面板入场', `${early.anim}/${early.dur}，填充已从 both 松开为 backwards`);
    await wait(320);
    const r = await snap('.reader-panel');
    if (r.op < 0.97) RED('偏好面板·终态', `op=${r.op}——去掉 both 之后 to 帧与基准值不一致，动画收尾跳变了`);
    else ok('偏好面板·终态', `op=${r.op}（readerIn 的 to 帧与基准逐字相同，松开填充没有收尾跳变）`);
}
await click('.reader-btn');
{
    // 这一格上一版是假红：点完立刻读，读到的正是 M24 新加的那 200ms 退场（还在渲染=应当如此）。
    // 「关」要判的是落定之后，所以先等过 --dur-2 再断言；退场途中可见由第 2 组那条负责。
    await wait(340);
    const off = await snap('.reader-panel');
    if (off.rend) RED('偏好面板·关', `再点一次之后仍在渲染：${JSON.stringify(off)}`);
    else ok('偏好面板·关', 'display 已翻回 none');
}

// ══════════════════════════════════════════════════════════════════
group('5) reduce 档');
await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
for (const [name, sel, openSel, closeSel] of [['⌘K', '#cmdk', null, null],
  ['书架', '#shelf-dlg', '[data-shelf-open]', null],
  ['灯箱', '.lightbox', '.markdown-body img.is-zoomable', null],
  ['偏好面板', '#reader-panel', '.reader-btn', '.reader-btn']]) {
  await goto(ORIGIN + BASE + ARTICLE);
  await wait(700);
  if (openSel) await click(openSel); else await key('k', 'KeyK', 75, 4);
  await wait(120);
  const on = await snap(sel);
  if (on.err || on.rend !== 1 || on.op < 0.99) RED(`reduce·${name}·看得见`, JSON.stringify(on));
  else ok(`reduce·${name}·看得见`, `op=${on.op} animation=${on.anim}`);
  const t = await traceAfter(() => (closeSel ? clickFast(closeSel) : keyFast('Escape', 'Escape', 27)), sel, null, 260);
  if (t.err) { traceFail(`reduce·${name}·不滞留`, t, '轨迹没跑起来'); continue; }
  const mid = midFade(t.samples);
  if (mid.length) RED(`reduce·${name}·不滞留`, `出现了 ${mid.length} 个半透明中间帧（共读 ${t.samples.length} 帧，op=${mid.map((x) => x.op).join(',')}）`);
  else ok(`reduce·${name}·不滞留`, `${t.samples.length} 帧里没有中间值，末帧 display=${t.samples[t.samples.length - 1].disp}`);
}
await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

// ══════════════════════════════════════════════════════════════════
// M25 的两件事分开量：「声明得对不对」读 computed 的 animationName/Duration/Delay 逐条对；
// 「揭幕是不是只裁不淡」要重启一次动画再逐帧读——载入那一趟跑到一半 document 就 complete 了，
// 抢那个时间窗只会读到终态，然后把「有中间值」判成「没有」。
// LCP 那一格是这一组的存在理由：注释里写着「头图是本文页的 LCP 候选、换成淡入要多背几百毫秒」，
// 那就得把这三件事分别量出来——谁是 LCP、摘掉动画差多少、换成淡入差多少。
group('6) M25 文章页首屏入场（含 LCP 的 A/B）');
await setVp(1440, 900);
await goto(ORIGIN + BASE + ARTICLE);
await wait(820);
{
  const EXPECT = [
    ['.post-masthead .post-crumb', 'riseIn', '0.32s', '0s', '面包屑'],
    ['.post-masthead .post-series', 'riseIn', '0.32s', '0s', '系列行（条件节点）'],
    ['.post-masthead .post-tags', 'riseIn', '0.32s', '0.04s', '标签行'],
    ['.post-masthead-title', 'mastWipe', '0.56s', '0.08s', '标题'],
    ['.post-masthead .post-masthead-lede', 'riseIn', '0.32s', '0.12s', '副题（条件节点）'],
    ['.post-masthead .post-meta', 'riseIn', '0.32s', '0.16s', '元信息'],
    ['.post-hero .g-container', 'heroWipe', '0.56s', '0s', '头图揭幕'],
  ];
  let declared = 0;
  for (const [sel, anim, dur, delay, label] of EXPECT) {
    const r = await evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)});
      if (!e) return { miss: 1 }; const cs = getComputedStyle(e);
      return { anim: cs.animationName, dur: cs.animationDuration, delay: cs.animationDelay }; })()`);
    if (r.miss) { ok(`入场声明·${label}`, '这一页没有这个节点，跳过'); continue; }
    declared += 1;
    const bad = r.anim !== anim ? `animationName=${r.anim}`
      : r.dur !== dur ? `时长 ${r.dur}≠${dur}`
        : r.delay !== delay ? `延迟 ${r.delay}≠${delay}` : '';
    if (bad) RED(`入场声明·${label}`, `${bad}（应为 ${anim}/${dur}/${delay}）`);
    else ok(`入场声明·${label}`, `${r.anim}/${r.dur}/${r.delay}`);
  }
  if (!declared) RED('入场声明', '七个目标一个都不在页面上——版面或选择器变了');

  const wipe = [];
  const restarted = await evalJs(`(() => { const e = document.querySelector('.post-hero .g-container');
    if (!e) return 0; e.style.animation = 'none'; void e.offsetWidth; e.style.animation = ''; return 1; })()`);
  const wT0 = Date.now();
  while (restarted && Date.now() - wT0 < 680) {
    const s = await evalJs(`(() => { const cs = getComputedStyle(document.querySelector('.post-hero .g-container'));
      return { op: +Number(cs.opacity).toFixed(3), cp: cs.clipPath }; })()`);
    wipe.push({ t: Date.now() - wT0, op: s.op, cp: s.cp });
  }
  {
    if (!wipe.length) { RED('头图揭幕·插值', '没跑起来（页面上找不到 .post-hero .g-container？）'); }
    else {
      const cps = [...new Set(wipe.map((x) => x.cp))];
      const last = wipe[wipe.length - 1];
      const mids = cps.filter((c) => c !== last.cp);
      if (mids.length < 3) RED('头图揭幕·插值', `clip-path 只读到 ${mids.length} 个中间取值：${cps.join(' → ')}`);
      else ok('头图揭幕·插值', `${mids.length} 个中间取值（${mids[0]} → … → ${last.cp}），共读 ${wipe.length} 帧`);
      const dimmed = wipe.filter((x) => x.op < 0.999);
      if (dimmed.length) RED('头图揭幕·不靠透明度', `${dimmed.length} 帧 opacity 离开 1（最低 ${Math.min(...dimmed.map((x) => x.op))}）——这一层在淡入，不是在揭幕`);
      else ok('头图揭幕·不靠透明度', `${wipe.length} 帧全程 opacity=1，首帧 t=${wipe[0].t}`);
    }
  }

  // 跨页转场落在同一块版面的那条压制：挂上 .is-vt-entry 之后，六件加头图都必须是 none。
  const sup = await evalJs(`(() => {
      document.documentElement.classList.add('is-vt-entry');
      const out = [];
      for (const s of ${JSON.stringify(EXPECT.map((x) => x[0]))}) {
        const e = document.querySelector(s);
        if (e) out.push([s.split(' ').pop(), getComputedStyle(e).animationName]);
      }
      document.documentElement.classList.remove('is-vt-entry');
      return out; })()`);
  const leak = sup.filter((x) => x[1] !== 'none');
  if (leak.length) RED('转场中的压制', `.is-vt-entry 挂上之后仍在跑：${leak.map((x) => x[0] + '=' + x[1]).join(', ')}`);
  else ok('转场中的压制', `${sup.length} 件全部 animationName=none（撤掉类之后恢复原样）`);

  // ———— LCP 的 A/B ————
  // 三臂交替跑，冷启动那一轮三臂都会吃到，取中位数而不是最小值；判据用「摘掉」那一臂当地基。
  const lcpReg = await S('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__lcp = []; window.__lcpErr = '';
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp.push({
          t: Math.round(e.startTime), size: Math.round(e.size),
          tag: e.element ? e.element.tagName : '(none)',
          inHero: e.element && e.element.closest ? (e.element.closest('.post-hero') ? 1 : 0) : -1,
          cls: e.element ? String(e.element.className).slice(0, 30) : '',
          url: e.url ? e.url.split('/').pop().slice(0, 26) : '' });
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (err) { window.__lcpErr = String(err).slice(0, 120); }`,
  });
  const STRIP = (t) => t.replace(/\.post-hero \.g-container\{[^}]*heroWipe[^}]*\}/g, '');
  const TOFADE = (t) => t.replace(/\.post-hero \.g-container\{[^}]*heroWipe[^}]*\}/g, (m) => m.replace(/heroWipe/g, 'riseIn'));
  const lcpRun = async (mode) => {
    CSS_MUTATE = mode === 'asbuilt' ? null : mode === 'strip' ? STRIP : TOFADE;
    await goto(ORIGIN + BASE + ARTICLE);
    await wait(1150);
    const decl = await evalJs(`(() => { const e = document.querySelector('.post-hero .g-container');
      return e ? getComputedStyle(e).animationName : 'no-node'; })()`);
    // LCP 要有一次输入才定稿；Shift 是这个页面上不挂任何快捷键的单键
    await keyFast('Shift', 'ShiftLeft', 16);
    await wait(150);
    CSS_MUTATE = null;
    const o = await evalJs('({ err: window.__lcpErr || "", last: window.__lcp[window.__lcp.length - 1] || null })');
    return { mode, decl, ...o };
  };
  const runs = [];
  for (let k = 0; k < 4; k += 1) { runs.push(await lcpRun('asbuilt')); runs.push(await lcpRun('strip')); runs.push(await lcpRun('fade')); }
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2); };
  const tOf = (mode) => runs.filter((r) => r.mode === mode).map((r) => r.last.t);
  const noLcp = runs.find((r) => r.err || !r.last);
  if (noLcp) RED('LCP 读到了', `${noLcp.mode} 那一臂没有 entry（${noLcp.err || 'observer 空'}）——这台 Chrome 里量不出来，后面三条都无意义`);
  else {
    const a = runs.find((r) => r.mode === 'asbuilt').last;
    if (a.inHero !== 1 || a.tag !== 'IMG') RED('LCP 归给头图', `实测末条是 ${a.tag}.${a.cls}（inHero=${a.inHero}，url=${a.url}）——注释里那句「LCP 候选就是头图那张 img」不成立`);
    else ok('LCP 归给头图', `${a.tag} ${a.url}，面积 ${a.size}，inHero=1（末条，五臂同判）`);
    const stripDecl = runs.filter((r) => r.mode === 'strip').map((r) => r.decl);
    const fadeDecl = runs.filter((r) => r.mode === 'fade').map((r) => r.decl);
    if (stripDecl.some((d) => d !== 'none') || fadeDecl.some((d) => d !== 'riseIn')) {
      RED('A/B 的变异生效', `strip 臂 computed=${[...new Set(stripDecl)].join('/')}、fade 臂=${[...new Set(fadeDecl)].join('/')}——服务端改写没落到页面上，这条 A/B 是在拿同一份产物比自己`);
    } else ok('A/B 的变异生效', `strip 臂 computed animationName=none、fade 臂=riseIn（响应侧摘掉 / 换掉 heroWipe 那条消费规则）`);
    const mA = med(tOf('asbuilt')), mS = med(tOf('strip')), mF = med(tOf('fade'));
    const detail = `不摘 ${mA}ms（${tOf('asbuilt').join(',')}）｜摘掉 ${mS}ms（${tOf('strip').join(',')}）｜换成淡入 ${mF}ms（${tOf('fade').join(',')}）`;
    if (mA - mS > 80) RED('揭幕不推迟 LCP', `clip 揭幕比「不动画」晚 ${mA - mS}ms：${detail}`);
    else ok('揭幕不推迟 LCP', `差 ${mA - mS}ms（阈值 80ms）｜${detail}`);
    if (mF - mA < 200) RED('这条判据有牙', `淡入写法只比不摘晚 ${mF - mA}ms，量不出「用淡入做首屏入场」的代价：${detail}`);
    else ok('这条判据有牙', `同长的淡入（riseIn）晚 ${mF - mA}ms，且 LCP 从头图移交给 ${runs.find((r) => r.mode === 'fade').last.tag}.${runs.find((r) => r.mode === 'fade').last.cls}`);
    console.log(`    · LCP 三轮中位：clip 揭幕 ${mA}ms / 摘掉动画 ${mS}ms / 淡入 ${mF}ms（本地 no-store、warm、四组交替）`);
  }
  await S('Page.removeScriptToEvaluateOnNewDocument', { identifier: lcpReg.identifier });
}

// ══════════════════════════════════════════════════════════════════
// M26 的三条硬要求：线的长度由 scaleY 给（不是 height，动布局属性是给列表加排）、
// 线的满高基准是**内容高**（scrollHeight）而不是可视框高（.toc-list 是 overflow:auto，
// 百分比高会解成可视 padding box，短一大截），以及点与线读同一个坐标、落在同一帧。
group('7) M26 目录滑动指示器');
await setVp(1440, 900);
{
  const tocState = () => evalJs(`(() => {
      const list = document.querySelector('.toc-list');
      const bar = list && list.querySelector('.toc-progress');
      if (!list || !bar) return { err: 'no-toc', links: document.querySelectorAll('.toc-link').length };
      const cs = getComputedStyle(bar), pe = getComputedStyle(list, '::after');
      const r = bar.getBoundingClientRect();
      const tr = cs.transform; let d = null;
      const mm = /matrix\\(([^)]+)\\)/.exec(tr);
      if (mm) d = Number(mm[1].split(',')[3]);
      else { const my = /scaleY\\(([^)]+)\\)/.exec(tr); if (my) d = Number(my[1]); }
      // 布局高用 offsetHeight：getBoundingClientRect 把 scaleY 已经乘进去了，
      // 拿它当「满高」再乘一次 d，就是上一版那三条红的根因。
      return { h: bar.offsetHeight, laid: parseFloat(cs.height) || 0, vis: Math.round(r.height),
        scrollH: list.scrollHeight, disp: cs.display, dotDisp: pe.display,
        p: Number(bar.style.getPropertyValue('--toc-p')), sh: bar.style.getPropertyValue('--toc-h'),
        y: parseFloat(list.style.getPropertyValue('--toc-y')) || 0,
        trY: parseFloat((pe.translate || '0 0').split(' ')[1] || '0') || 0,
        dotOp: +Number(pe.opacity).toFixed(3), live: list.classList.contains('is-live') ? 1 : 0,
        d, trProp: cs.transitionProperty, trDur: cs.transitionDuration, tr };
    })()`);
  const at = async (frac) => {
    await evalJs(`window.scrollTo(0, Math.round((document.body.scrollHeight - innerHeight) * ${frac})); 1`);
    await wait(540);
    return tocState();
  };
  await goto(ORIGIN + BASE + ARTICLE);
  await wait(760);
  const s1 = await at(0.3);
  if (s1.err) { RED('目录指示器', `页面上没有 .toc-list / .toc-progress（toc-link ${s1.links} 个）——这一格判不了，先修版面`); }
  else {
    const s2 = await at(0.62);
    const s3 = await at(0.88);
    if (!s1.live || !s2.live) RED('指示器已激活', `滚动之后 .toc-list 仍没挂 is-live：${JSON.stringify([s1.live, s2.live])}`);
    else ok('指示器已激活', 'is-live=1（--toc-p / --toc-y 都写在元素上，未挂类时点不出现）');
    if (!(s1.p > 0) || !(s2.p >= s1.p) || !(s3.p >= s2.p)) {
      RED('比例随阅读推进', `--toc-p = ${s1.p} → ${s2.p} → ${s3.p}（应单调不减且第一档就大于 0）`);
    } else ok('比例随阅读推进', `--toc-p ${s1.p}→${s2.p}→${s3.p}，scaleY ${s1.d.toFixed(4)}→${s2.d.toFixed(4)}→${s3.d.toFixed(4)}`);
    const drift = [s1, s2, s3].map((x) => Math.abs(x.d - x.p));
    if (drift.some((v) => v > 0.01)) RED('写进变量的比例就是画出来的比例', `|scaleY − --toc-p| = ${drift.map((v) => v.toFixed(4)).join('/')}（等 540ms 之后仍不等，说明这条 transform 没落定）`);
    else ok('写进变量的比例就是画出来的比例', `三档偏差 ≤ ${Math.max(...drift).toFixed(4)}（transform: scaleY(var(--toc-p)) 直接吃那个数）`);
    // 满高基准必须是内容高：这是当初那个 bug 的形状（百分比高解成可视框，线短一截）
    if (Math.abs(s1.h - s1.scrollH) > 2) RED('线的满高=内容高', `offsetHeight=${s1.h} 而 scrollHeight=${s1.scrollH}（--toc-h 写的是 ${s1.sh}）`);
    else if (!(s1.vis < s1.h - 4)) RED('线的满高=内容高', `画出来的高 ${s1.vis} 与布局高 ${s1.h} 差不多——scaleY 没生效（d=${s1.d}）`);
    else ok('线的满高=内容高', `布局高 ${s1.h}px = scrollHeight（--toc-h=${s1.sh}），实测画出来 ${s1.vis}px —— 短的那一截由 scaleY 给，不是 overflow:auto 的可视框高`);
    const hs = [...new Set([s1.h, s2.h, s3.h])];
    if (hs.length > 1) RED('长度不靠 height', `三个滚动位置的布局高量到 ${hs.join('/')}px——height 在跟着变，那就是在动布局属性`);
    else ok('长度不靠 height', `布局高恒 ${hs[0]}px，长度只由 scaleY 给（${s1.d.toFixed(3)}→${s3.d.toFixed(4)}）`);
    if (!/transform/.test(s1.trProp) || /height/.test(s1.trProp)) RED('过渡属性', `transitionProperty=${s1.trProp}`);
    else ok('过渡属性', `${s1.trProp} / ${s1.trDur}（没有 height）`);
    const off = [s1, s2, s3].map((x) => Math.abs(x.h * x.d - x.trY));
    if (off.some((v) => v > 3)) RED('线头与点同步', `|满高×scaleY − 点的 translate|=(${off.map((v) => v.toFixed(1)).join(', ')})px：点会跑在线前面`);
    else ok('线头与点同步', `三个位置最大偏差 ${Math.max(...off).toFixed(1)}px（同一个 --toc-y 喂给线与点，同一条 --dur-2）`);
    if (s3.dotOp < 0.99) RED('线头那颗点', `is-live 之后 ::after 的 opacity=${s3.dotOp}`);
    else ok('线头那颗点', `opacity=${s3.dotOp}，落在 ${s3.trY}px（--toc-y=${s3.y}）`);

    // reduce 档：这条线是功能不是装饰，位置照样要对，只是不再滑行
    await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await goto(ORIGIN + BASE + ARTICLE);
    await wait(700);
    const r1 = await at(0.3); const r2 = await at(0.8);
    const rOff = Math.abs(r2.h * r2.d - r2.trY);
    if (!r2.live || !(r2.p > 0) || r2.dotOp < 0.99 || rOff > 3) {
      RED('reduce·指示器仍是功能', `p=${r2.p} d=${r2.d == null ? '?' : r2.d.toFixed(4)} 点=${r2.trY}px（偏差 ${rOff.toFixed(1)}px）op=${r2.dotOp} live=${r2.live}`);
    } else ok('reduce·指示器仍是功能', `线长 ${(r2.h * r2.d).toFixed(0)}/${r2.h}px、点落 ${r2.trY}px（偏差 ${rOff.toFixed(1)}px），transitionDuration=${r2.trDur}`);
    await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

    // 抽屉那一态：线没有可贴的轨道，点必须跟着摘
    await setVp(900, 800);
    await goto(ORIGIN + BASE + ARTICLE);
    await wait(700);
    await click('.toc-fab');
    await wait(420);
    const dw = await evalJs(`(() => { const list = document.querySelector('.toc-list'); const bar = list && list.querySelector('.toc-progress');
      if (!list || !bar) return { err: 'no-toc-in-drawer' };
      return { hasToc: document.body.classList.contains('has-toc') ? 1 : 0, bar: getComputedStyle(bar).display,
        dot: getComputedStyle(list, '::after').display }; })()`);
    if (dw.err) RED('抽屉里的线与点', JSON.stringify(dw));
    else if (dw.bar !== 'none' || dw.dot !== 'none') RED('抽屉里的线与点', `body.has-toc=${dw.hasToc} 而 display=${dw.bar}/${dw.dot}（线/点）——抽屉左侧会浮出一颗孤零零的蓝点`);
    else ok('抽屉里的线与点', `has-toc=${dw.hasToc}，线与点都 display:none`);
    await setVp(1440, 900);
  }
}

// ══════════════════════════════════════════════════════════════════
// M27 的两半：覆盖面（三条新选择器真的在揭示）与解码闸门（图没到就不升）。
// 闸门要有「还在路上的图」才测得到，本站点那个 /__slow.webp 端点就是为它挂的；
// 700ms 那一臂验「等得到 load 就等 load」，5000ms 那一臂验「1200ms 的保险真的会落下」。
group('8) M27 揭示覆盖面 + 图片解码闸门');
await setVp(1440, 900);
await goto(ORIGIN + BASE + ARTICLE);
await wait(760);
{
  const lazyRows = await evalJs(`[...document.querySelectorAll('#post-body p')].filter(p => p.querySelector('img[loading="lazy"]')).length`);
  const gateRun = async (imgMs, arm) => {
    const prep = await evalJs(`(() => {
        const ps = [...document.querySelectorAll('#post-body p')]
          .filter(p => p.querySelector('img[loading="lazy"]') && !p.classList.contains('is-in'));
        if (!ps.length) return { err: 'no-unrevealed-lazy-row', left: ${lazyRows} };
        const p = ps[0], img = p.querySelector('img');
        window.__gp = p; window.__gi = img;
        img.src = ${JSON.stringify(ORIGIN + '/__slow.webp?ms=')} + ${imgMs};
        return { left: ps.length, complete: img.complete ? 1 : 0 };
      })()`);
    if (prep.err) { RED(`解码闸门·${arm}`, JSON.stringify(prep)); return; }
    await evalJs('window.__gp.scrollIntoView({ block: "center", behavior: "instant" }); 1');
    const sm = [];
    const gT0 = Date.now();
    while (Date.now() - gT0 < 2800) {
      const s = await evalJs('(() => { const p = window.__gp, i = window.__gi; return { op: +Number(getComputedStyle(p).opacity).toFixed(2), c: i.complete ? 1 : 0, isIn: p.classList.contains("is-in") ? 1 : 0 }; })()');
      sm.push({ t: Date.now() - gT0, ...s });
    }
    const firstIn = sm.find((x) => x.isIn === 1);
    const shownAt = sm.find((x) => x.op > 0.95);
    const held = sm.filter((x) => x.c === 0 && x.op < 0.05);
    const markLine = `共 ${sm.length} 帧｜is-in 落在 t=${firstIn ? firstIn.t : 'never'}（那一刻 complete=${firstIn ? firstIn.c : '?'}）｜opacity 到 1 于 t=${shownAt ? shownAt.t : 'never'}`;
    if (!firstIn || !shownAt) { RED(`解码闸门·${arm}`, `这一行停在未揭示态：${markLine}`); return; }
    if (!held.length) { RED(`解码闸门·${arm}`, `没有一帧是「图没到、这行不显」：${markLine}`); return; }
    // 两支的分别只在「是谁开的这一锁」：load 支要在图落地那一刻就升（远早于 1200ms 的保险），
    // 超时支必须在图还没到时、于 1200ms 那一档补上。
    if (arm === 'load 支') {
      if (firstIn.t > 1150) RED(`解码闸门·${arm}`, `等过 1200ms 才升（t=${firstIn.t}），分不清是图还是保险｜${markLine}`);
      else if (firstIn.t < imgMs) RED(`解码闸门·${arm}`, `图 ${imgMs}ms 才到，这行却在 t=${firstIn.t} 就升了——闸门没按住｜${markLine}`);
      else ok(`解码闸门·${arm}`, `按住 ${held.length} 帧，图于 ${imgMs}ms 落地这一行才升｜${markLine}`);
    } else if (firstIn.c === 1) RED(`解码闸门·超时支`, `图还没到时才走这一支，实测升起来时 complete=1｜${markLine}`);
    else if (firstIn.t < 1150 || firstIn.t > 2100) RED(`解码闸门·超时支`, `保险没在 1200ms 那一档落下（实测 t=${firstIn.t}）｜${markLine}`);
    else ok(`解码闸门·超时支`, `图 5000ms 才到，1200ms 的保险于 t=${firstIn.t} 补上这一次揭示｜${markLine}`);
  };
  await gateRun(700, 'load 支');
  await gateRun(5000, '超时支');

  // 覆盖面：从顶到底一段一段滚，让每一批都真的 intersect 过一次
  const sweep = async () => {
    const H = await evalJs('document.body.scrollHeight');
    for (let y = 0; y < H; y += 520) { await evalJs(`window.scrollTo(0, ${y}); 1`); await wait(90); }
    await evalJs(`window.scrollTo(0, ${H}); 1`);
    await wait(900);
  };
  await sweep();
  // 被揭示的是**那一段 <p>**，不是 img 本身（kramdown 把正文图包在 p 里），
  // 所以这三组都按段落数：is-in 与 opacity 都读在 p 上。
  const cov = await evalJs(`(() => { const stat = (n) => ({ n: n.length,
        isIn: n.filter(x => x.classList.contains('is-in')).length,
        minOp: n.length ? +Math.min(...n.map(x => Number(getComputedStyle(x).opacity))).toFixed(2) : 1 });
    const ps = [...document.querySelectorAll('#post-body p')];
    const g = (sel) => stat([...document.querySelectorAll(sel)]);
    return { related: g('.related-item'), readnext: g('.read-next-item'),
      lazy: stat(ps.filter(p => p.querySelector('img[loading="lazy"]'))),
      eager: stat(ps.filter(p => { const i = p.querySelector('img'); return i && !i.hasAttribute('loading'); })),
      eagerReveal: ps.filter(p => { const i = p.querySelector('img'); return i && !i.hasAttribute('loading'); })
        .filter(p => p.classList.contains('reveal')).length }; })()`);
  for (const [label, key] of [['相关行', 'related'], ['上下篇卡', 'readnext'], ['正文懒加载图所在段', 'lazy']]) {
    const c = cov[key];
    if (!c.n) RED(`揭示覆盖·${label}`, '这一页匹配到 0 个节点——选择器或版面变了');
    else if (c.isIn !== c.n || c.minOp < 0.95) RED(`揭示覆盖·${label}`, `${c.isIn}/${c.n} 个拿到 is-in，最低 opacity=${c.minOp}`);
    else ok(`揭示覆盖·${label}`, `${c.n} 个全部 is-in 且 opacity=${c.minOp}`);
  }
  if (!cov.eager.n) RED('首图不进揭示', '页面上找不到「img 不带 loading」的段落，这一条没牙');
  else if (cov.eagerReveal > 0 || cov.eager.isIn > 0) RED('首图不进揭示', `${cov.eagerReveal}/${cov.eager.n} 个第一图的段落挂了 reveal（is-in ${cov.eager.isIn}）——那是用 opacity:0 压住 LCP`);
  else ok('首图不进揭示', `第一张（img 无 loading 属性）所在 ${cov.eager.n} 段：reveal=0、is-in=0，闸门只收 loading="lazy"`);

  const hov = await evalJs(`(() => { const one = (sel) => { const e = document.querySelector(sel);
      return e ? { prop: getComputedStyle(e).transitionProperty, dur: getComputedStyle(e).transitionDuration, rev: e.classList.contains('reveal') ? 1 : 0 } : null; };
    return { related: one('.related-item'), readnext: one('.read-next-item') }; })()`);
  for (const [label, key, needs] of [['相关行 hover', 'related', ['opacity', 'transform', 'border-color']],
    ['上下篇 hover', 'readnext', ['opacity', 'transform', 'box-shadow', 'translate']]]) {
    const h = hov[key];
    if (!h) { RED(label, '没有节点'); continue; }
    const miss = needs.filter((n) => !h.prop.includes(n));
    if (h.rev !== 1) RED(label, `这一行没挂 .reveal，§12 第 8) 段那条合并规则不会生效`);
    else if (miss.length) RED(label, `transitionProperty=${h.prop}——少了 ${miss.join('/')}：被 body.js-reveal .reveal 的简写换掉了，hover 会变瞬移`);
    else ok(label, `${h.prop}（reveal 的淡入 + 原来的 hover 并存）`);
  }

  const nojs = await evalJs(`(() => { document.body.classList.remove('js-reveal');
      const out = { p: +Number(getComputedStyle(document.querySelector('#post-body p')).opacity).toFixed(2),
        r: +Number(getComputedStyle(document.querySelector('.related-item')).opacity).toFixed(2) };
      document.body.classList.add('js-reveal'); return out; })()`);
  if (nojs.p < 0.99 || nojs.r < 0.99) RED('摘掉 js-reveal 之后', `正文段 ${nojs.p} / 相关行 ${nojs.r}——脚本没跑的那一态把内容藏住了`);
  else ok('摘掉 js-reveal 之后', `正文段 ${nojs.p}、相关行 ${nojs.r}（未揭示态全部关在 body.js-reveal 里）`);

  await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await goto(ORIGIN + BASE + ARTICLE);
  await wait(700);
  const red = await evalJs(`(() => ({ jsReveal: document.body.classList.contains('js-reveal') ? 1 : 0,
      n: document.querySelectorAll('.related-item, .read-next-item').length,
      minOp: (() => { const x = [...document.querySelectorAll('.related-item, .read-next-item')];
        return x.length ? +Math.min(...x.map(e => Number(getComputedStyle(e).opacity))).toFixed(2) : -1; })() }))()`);
  if (red.jsReveal === 1 || red.minOp < 0.99) RED('reduce·新列的覆盖面不藏内容', `js-reveal=${red.jsReveal}，${red.n} 个里最低 opacity=${red.minOp}（没滚动）`);
  else ok('reduce·新列的覆盖面不藏内容', `initReveal 在 reduce 直接 return（js-reveal=${red.jsReveal}），${red.n} 个未滚动的行 opacity=${red.minOp}`);
  await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
}

// ══════════════════════════════════════════════════════════════════
// M28 落在这一格的是守卫，不是新特效。理由记在这儿，免得下一轮又去试那三件：
//   · 唯一性有代价可付：view-transition-name 撞名 = ViewTransition.ready 直接 reject、
//     整个跨页转场静默不跑（MDN：「If two rendered elements have the same
//     view-transition-name at the same time, the transition will be skipped」）。
//     今天产物里只有两个名字（site-header / page-masthead），这一格把它们在全站每一页上的
//     实例数判死；将来谁加第三个名字，这一格先红。
//   · 而「再加几个名字」这一轮是退的：logo 与主导航都在已命名的 .g-header 里面，命名子元素
//     会把它从父组的快照里摘出去（各成一族），换来的只是「原本整体交叉淡入的一块拆成三块淡」，
//     观感没有增益；.g-footer 每一页都在折叠线以下，旧页那份快照会被视口裁成空，
//     而新页在 scroll=0 根本没有对应组——于是页脚从底部导航走时会在新页面上留一块淡出的残影；
//     刊头标题按上一轮的决议不命名，.post-masthead 整块命名会让两篇文章的头图互相拉伸。
//   · 落位这一条只能静态自证：两个被命名的元素一个 position:fixed（顶栏，新旧两页都钉在
//     视口同一位置，morph 就是原地交叉淡入）、一个 position:relative（刊头内层，随文档流）。
//     真正的「转场那一刻画面上有没有混合帧」这台量具读不到：CDP 的 DOM.querySelector
//     带 pseudoElement 会把 ::view-transition 退化成 <html> 本身（实测 desc 一直是
//     nodeName=HTML、children=#comment,HEAD,BODY），所以下面不写这条判据，也不把它当已证。
group('9) 跨页转场的命名唯一性（全站产物扫描）');
{
  /**
   * 从压缩产物里抽出「哪个选择器挂了哪个名字」。
   *
   * 声明体必须写成 [^{}]* 而不是 [^}]*：后者容许体里再来一个 {，于是
   * `@media(prefers-reduced-motion:no-preference){.g-masthead .masthead-inner{view-transition-name:page-masthead}`
   * 被读成「选择器 = 那条 at-rule 的 prelude，体 = 里面整串」——正则取最左匹配，
   * 外层 prelude 先赢。上一版就是这么把 page-masthead 记到 @media 头上的，
   * 它一路走到「抽不出 class 令牌」那一步才露馅（红出来的就是那一格）。
   */
  const parseNaming = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*view-transition-name:[^{}]*)\}/g)]
    .map((m) => ({
      sel: m[1].trim().split(/\s*,\s*/).pop(),
      name: (/view-transition-name:\s*([A-Za-z0-9_-]+)/.exec(m[2]) || [])[1],
    }))
    .filter((d) => d.name && d.name !== 'none');

  /**
   * 一个选择器拿来「逐页找标签」的令牌：取最右复合选择器上的 class（或 id）名。
   * 口径是**高估**——`.g-masthead .masthead-inner` 在这里按全站所有 .masthead-inner 数，
   * 比浏览器真实命中的只多不少，所以这一格说 ≤1 就一定 ≤1；代价是同名 class 被别处
   * 复用时可能误报，那种误报要人来判，不静默放宽判据。
   *
   * 计数按「class 属性切成词表、整词比对」，不拿 `(?|^|[ ])令牌` 那种边界正则去贴：
   * 上一版就是那么写的，`class="g-header"`（令牌正好是属性里的第一个词）一条也没数到，
   * 于是全站报「最多 0 个」——绿得毫无牙齿，撞名永远抓不住。
   */
  const tokensOf = (sel) => {
    const last = (sel.split(/\s+/).pop() || '').replace(/::?[a-z-]+(\([^)]*\))?/g, '');
    const m = /[.#]([A-Za-z0-9_-]+)/.exec(last);
    return m ? { kind: last[m.index] === '#' ? 'id' : 'class', tok: m[1] } : null;
  };

  /** 扫 dir 下每一张 html，对每条声明的令牌数「这一页里出现几个」，返回逐页最大值。 */
  const scanNaming = (dir, decls) => {
    const recs = decls.map((d) => ({ ...d, tk: tokensOf(d.sel), worst: 0, at: '', total: 0 }));
    const files = [];
    const walk = (p) => {
      for (const e of fs.readdirSync(p, { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue;
        const q = path.join(p, e.name);
        if (e.isDirectory()) walk(q); else if (e.name.endsWith('.html')) files.push(q);
      }
    };
    walk(dir);
    for (const f of files) {
      const h = fs.readFileSync(f, 'utf8');
      const lists = [...h.matchAll(/class\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
        .map((m) => (m[1] === undefined ? m[2] : m[1]).split(/\s+/));
      for (const rec of recs) {
        if (!rec.tk) continue;
        const n = rec.tk.kind === 'id'
          ? (h.match(new RegExp(`id\\s*=\\s*["']${rec.tk.tok}["']`, 'g')) || []).length
          : lists.filter((l) => l.includes(rec.tk.tok)).length;
        rec.total += n;
        if (n > rec.worst) { rec.worst = n; rec.at = path.relative(dir, f); }
      }
    }
    return { pages: files.length, recs };
  };

  const css = fs.readFileSync(path.join(SITE, 'assets/css/index.min.css'), 'utf8');
  const DECL = parseNaming(css);
  const names = [...new Set(DECL.map((d) => d.name))];
  if (!DECL.length) RED('命名声明读到了', 'index.min.css 里一条 view-transition-name 都没有——跨页转场的定制整个没了');
  else ok('命名声明读到了', `${names.join(' / ')}（${DECL.map((d) => `${d.sel}=${d.name}`).join('；')}）`);

  const site = scanNaming(SITE, DECL);

  // 这一格必须先自证有牙：造两张假页面，一张把同一个 class 写两遍（必须报 2），
  // 一张放前缀相同的诱饵（g-header-y / masthead-inner-old，必须不计入）。
  // 数不出来就红——「全站最多 0 个」这种绿是量具坏了，不是产物干净。
  const FX = path.join(os.tmpdir(), `vt-teeth-${process.pid}`);
  fs.mkdirSync(FX, { recursive: true });
  fs.writeFileSync(path.join(FX, 'dup.html'),
    '<!doctype html><html><body><header class="g-header"></header><header class="g-header"></header></body></html>');
  fs.writeFileSync(path.join(FX, 'decoy.html'),
    '<!doctype html><html><body><div class="masthead-inner"></div><div class="masthead-inner-old"></div>'
    + '<div class="x g-header-y"></div><div class="g-header">ok</div></body></html>');
  const fx = scanNaming(FX, DECL);
  fs.rmSync(FX, { recursive: true, force: true });
  const fxByTok = new Map(fx.recs.map((r) => [r.tk && r.tk.tok, r]));
  const gh = fxByTok.get('g-header');
  const mi = fxByTok.get('masthead-inner');
  if (!site.recs.every((r) => r.tk)) {
    RED('保守计数的口径', site.recs.filter((r) => !r.tk).map((r) => r.sel).join(' / ')
      + ' 抽不出 class/id 令牌，这一格数不了');
  } else if (!gh || gh.worst !== 2 || !mi || mi.worst !== 1) {
    RED('这一格有牙', `夹具里该数到的没数到：g-header ${gh && gh.worst}（要 2）、masthead-inner ${mi && mi.worst}（要 1）`
      + '——计数口径一旦数不出重复，下面的「≤1」就是恒真');
  } else {
    ok('这一格有牙', `夹具 2 页：g-header 数到 ${gh.worst}（诱饵 g-header-y 未计入），masthead-inner 数到 ${mi.worst}`);
  }

  const collide = site.recs.filter((r) => r.worst > 1)
    .map((r) => `${r.sel}（名 ${r.name}）在 ${r.at} 上命中 ${r.worst} 个`);
  for (const r of site.recs) {
    if (!r.tk) continue;
    ok('每页实例数 ≤1', `全站 ${site.pages} 页里 ${r.sel} 最多 ${r.worst} 个（累计 ${r.total}，无该块的页为 0 属正常）`);
  }
  if (collide.length) RED('命名撞车（会静默废掉全部跨页转场）', collide.join(' ｜ '));
  else ok('命名撞车（会静默废掉全部跨页转场）', `${names.join(' / ')} 在全站每一页都至多一个实例`);

  // 真浏览器里的精确一遍：CSSOM 读出声明选择器，页面上 querySelectorAll 数一次，并补落位口径。
  const cssom = [];
  for (const page of [HOME, ARTICLE, '/tools.html']) {
    await goto(ORIGIN + BASE + page);
    await wait(420);
    const exact = await evalJs(`(() => {
        const decls = [];
        for (const sh of document.styleSheets) { try {
          const walk = (rs) => { for (const r of (rs || [])) {
            if (r.style && r.style.viewTransitionName && r.style.viewTransitionName !== 'none') decls.push([r.selectorText, r.style.viewTransitionName]);
            if (r.cssRules) walk(r.cssRules); } };
          walk(sh.cssRules); } catch (e) {} }
        const byName = {}; const detail = [];
        for (const [sel, name] of decls) {
          let n = 0; try { n = document.querySelectorAll(sel).length; } catch (e) { n = -1; }
          byName[name] = (byName[name] || 0) + n;
          const el = document.querySelector(sel);
          detail.push([sel, name, n, el ? getComputedStyle(el).position : '-']);
        }
        return { path: location.pathname, detail, dup: Object.entries(byName).filter(([, v]) => v > 1) };
      })()`);
    cssom.push(...exact.detail);
    const dup = (exact.dup || []).filter(([, v]) => v > 1);
    if (dup.length) RED(`页面精确计数·${exact.path}`, `同名多实例：${JSON.stringify(dup)}——这一页的跨页转场会被整体跳过`);
    else if (!exact.detail.length) RED(`页面精确计数·${exact.path}`, 'CSSOM 里没读到任何 view-transition-name 声明');
    else ok(`页面精确计数·${exact.path}`, exact.detail.map((d) => `${d[1]}:${d[2]} 个（${d[3]}）`).join(' ｜ '));
  }

  // 文本解析器与真 CSSOM 对一遍账。上面那条「at-rule 当选择器」的错就是靠这一格露馅的：
  // 静态侧多算出「选择器」，浏览器侧永远只给真选择器，两边一比对就穿。
  const sameTok = (a, b) => {
    const x = tokensOf(a), y = tokensOf(b);
    return x && y && x.kind === y.kind && x.tok === y.tok;
  };
  // cssom 那一份是四元组 [选择器, 名, 命中数, 落位]，逐位取用别靠解构错位——
  // 上一版写成 `[, cn, cs]`，把「命中数」当成了选择器传进 tokensOf，量具自己先抛。
  const orphan = DECL.filter((d) => !cssom.some((c) => c[1] === d.name && sameTok(d.sel, c[0])));
  const missed = cssom.filter((c) => !DECL.some((d) => d.name === c[1] && sameTok(d.sel, c[0])));
  if (orphan.length || missed.length) {
    RED('静态解析与 CSSOM 对账', `静态多 ${orphan.map((d) => `${d.sel}=${d.name}`).join(',') || '无'}`
      + ` ｜ CSSOM 多 ${missed.map((c) => `${c[0]}=${c[1]}×${c[2]}`).join(',') || '无'}`
      + '——逐页计数喂的是静态那份，读错了名字/选择器下面那一格就跟着错');
  } else {
    ok('静态解析与 CSSOM 对账', `${DECL.length} 条声明两边逐条一致（${[...new Set(cssom.map((c) => `${c[0]}→${c[1]}`))].join(' / ')}）`);
  }
}

// ══════════════════════════════════════════════════════════════════
// M29 工具层。这一格判的不是「好不好看」，而是 toolkit.scss 文末那三条声明各自的前提有没有成立：
//   · 面板入场靠的是「display:none→block 会重跑 CSS 动画」——panel.js:123 把非当前面板写成
//     hidden，所以换面板必须重新采到中间帧，采不到就说明那条机制是我想当然。
//   · 判定药丸每次由 view.js 的 innerHTML 新建（`<span class="tk-state …">`），走同一条 tkIn，
//     只把时长降一档：判定是一行短串，320ms 的升起看起来像还在加载。
//   · 红条只在**第一次插入**时抖：panel-dom.js:140 新建节点，:137 第二次只换 textContent，
//     节点没换 ⇒ 动画不重跑。这一格两条都量，因为 toolkit.scss 里把这句口径写死了。
// 另外两条是本层的依赖与降级：令牌是不是真从 index.min.css 流到了工具页（关键帧里不写 px 的
// 代价就是取值要靠它），以及 reduce / 禁 JS 两态都必须「一眼就看得见内容」。
const TOOL = '/tools/idcard.html';
group('10) M29 工具层三条状态反馈（含 reduce 与禁 JS）');
/** 带 transform 的读数：tkShake 动的是 translateX，tkIn 动的是 translateY，opacity 一家不够。 */
const smpT = (sel) => evalJs(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return { err: 'no-node' };
    const cs = getComputedStyle(el);
    const m = /matrix\\(([-\\d.,\\s]+)\\)/.exec(cs.transform);
    const p = m ? m[1].split(',').map(Number) : null;
    const r = el.getBoundingClientRect();
    return { op: +Number(cs.opacity).toFixed(3), tx: p ? +p[4].toFixed(2) : 0, ty: p ? +p[5].toFixed(2) : 0,
      anim: cs.animationName, dur: cs.animationDuration, disp: cs.display,
      rend: r.width > 0 && r.height > 0 ? 1 : 0, hidden: el.hidden ? 1 : 0 };
  })()`);
const traceT = async (action, sel, ms = 520) => {
  const t0 = Date.now();
  await action();
  const out = [];
  while (Date.now() - t0 < ms) {
    const s = await smpT(sel);
    if (s.err) return { samples: out, err: s.err };
    out.push({ t: Date.now() - t0, op: s.op, tx: s.tx, ty: s.ty, rend: s.rend, hidden: s.hidden });
  }
  return { samples: out, n: out.length };
};
const midOf = (list, key) => [...new Set(list.filter((x) => x > 0.05 && x < 0.95))];

await setVp(1440, 900);
await goto(ORIGIN + BASE + TOOL);
await wait(700);
{
  // —— 量具与依赖先自证 ——
  const dep = await evalJs(`(() => {
    const cs = getComputedStyle(document.documentElement);
    const grab = (n) => (cs.getPropertyValue(n) || '').trim();
    const panel = document.querySelector('.tk-panel');
    const pcs = panel ? getComputedStyle(panel) : null;
    return { travel: grab('--travel-s'), dur3: grab('--dur-3'), dur2: grab('--dur-2'),
      ease: grab('--ease-out'), sheets: [...document.styleSheets].length,
      anim: pcs && pcs.animationName, dur: pcs && pcs.animationDuration,
      panels: document.querySelectorAll('.tk-panel').length,
      visible: [...document.querySelectorAll('.tk-panel')].filter((e) => !e.hidden).length };
  })()`);
  if (!(parseFloat(dep.travel) > 0) || !dep.dur3 || !dep.dur2 || !dep.ease) {
    RED('令牌真的流到工具页', `--travel-s=${dep.travel} / --dur-3=${dep.dur3} / --dur-2=${dep.dur2} / --ease-out=${dep.ease}`
      + '——关键帧里不写 px，位移全指望 tokens.scss 那一族；取不到值就是只剩淡入的降级');
  } else ok('令牌真的流到工具页', `--travel-s=${dep.travel}、--dur-3=${dep.dur3}、--dur-2=${dep.dur2}（来自 index.min.css 的 :root）`);
  if (dep.anim !== 'tkIn' || !/^0\.32s/.test(dep.dur)) {
    RED('面板那条声明生效', `computed animationName=${dep.anim}、duration=${dep.dur}（要 tkIn / 0.32s）`);
  } else ok('面板那条声明生效', `tkIn / ${dep.dur}，全站 5 块面板里 ${dep.visible} 块此刻可见（其余 hidden）`);

  const cssDisk = fs.readFileSync(path.join(SITE, 'assets/css/toolkit.min.css'), 'utf8');
  const served = await evalJs(`fetch('${ORIGIN + BASE}/assets/css/toolkit.min.css')`
    + `.then(r=>r.text()).then(t=>({len:t.length,in:(t.match(/keyframes tkIn/g)||[]).length,shake:(t.match(/keyframes tkShake/g)||[]).length}))`);
  const dIn = (cssDisk.match(/keyframes tkIn/g) || []).length;
  const dShake = (cssDisk.match(/keyframes tkShake/g) || []).length;
  if (served.len !== cssDisk.length || served.in !== dIn || served.shake !== dShake) {
    RED('服务的字节 == 磁盘', `served{len:${served.len},tkIn:${served.in},shake:${served.shake}} disk{len:${cssDisk.length},tkIn:${dIn},shake:${dShake}}`);
  } else ok('服务的字节 == 磁盘', `toolkit.min.css ${served.len}B，tkIn ${served.in} 处、tkShake ${served.shake} 处`);

  // —— 换面板 = 入场重跑（这条是 M29 第一件的立论） ——
  const sw = await traceT(() => clickFast('#tk-tab-uscc'), '#tk-panel-uscc', 520);
  const swOp = midOf(sw.samples.map((s) => s.op), 'op');
  const ty = [...new Set(sw.samples.map((s) => s.ty))];
  const last = sw.samples[sw.samples.length - 1];
  if (sw.err || sw.samples.length < 12) {
    traceFail('换面板重跑', sw, `只读到 ${sw.samples.length} 帧（${tail(sw)}）——采样没密度，中间帧判不了`);
  } else if (swOp.length < 2 || !(last && last.op > 0.99 && last.hidden === 0)) {
    RED('换面板重跑', `中间取值 ${swOp.length} 个、末帧 op=${last && last.op} hidden=${last && last.hidden}（${tail(sw)}）`
      + '——hidden 摘掉时动画没重跑，那这一层的「换面板」还是一记硬切');
  } else ok('换面板重跑', `opacity 中间取值 ${swOp.length} 个、translateY 取值 ${ty.length} 个（${Math.max(...ty)}→0），末帧已落定`);

  // —— 判定药丸：同一条 tkIn、时长降一档 ——
  // 上一格把可见面板换到了 uscc，下面三格（药丸 / 红条 / 焦点环）全在 idcard 那块面板里。
  // `hidden` 的父级不产生布局盒：动画按规范根本不跑，真鼠标的命中测试还会直接抛
  // （hitTest 抛 = 整格崩，红都红不响）。所以先换回来，并把「换回来了」自证一次。
  await click('#tk-tab-idcard');
  await wait(420);
  const back = await evalJs(`(() => { const p = document.querySelector('#tk-panel-idcard');
    return { hidden: p.hidden ? 1 : 0, disp: getComputedStyle(p).display, op: +Number(getComputedStyle(p).opacity).toFixed(2) }; })()`);
  if (back.hidden || back.disp === 'none') {
    RED('换回 idcard 面板', JSON.stringify(back) + '——下面三格要有布局盒才量得了，这一格红就别读后面的数');
  } else ok('换回 idcard 面板', `hidden=0、display=${back.disp}、opacity=${back.op}`);
  await click('#tk-btn-idcard-gen');
  await wait(260);
  const num = await evalJs(`(() => {
    const t = document.querySelector('#tk-out-idcard-gen');
    const m = /\\b\\d{17}[\\dXx]\\b/.exec(t ? t.textContent : '');
    return m ? m[0] : '';
  })()`);
  if (!num) RED('判定药丸·拿得到一条号码', '生成那一栏里没读到 18 位号码，后面这一格没法喂');
  else {
    await evalJs(`(() => { const el = document.querySelector('#tk-in-idcard-read');
      el.value = ${JSON.stringify(num)}; return el.value; })()`);
    // 选择器必须锁在「判定」那一栏里：`renderRead` 逐行各出一枚徽章（`view.js:409` 的
    // `tk-verdict`），而 querySelector 按文档顺序取第一枚——不锁栏位就可能采到别处的，
    // 而「合成」那一栏在文档顺序里更靠前。
    const pill = await traceT(() => clickFast('#tk-btn-idcard-read'), '#tk-out-idcard-read .tk-state', 420);
    const got = await snap('#tk-out-idcard-read .tk-state');
    const pops = midOf(pill.samples.map((s) => s.op), 'op');
    if (pill.err || !pill.samples.length) RED('判定药丸·每次重跑', `没读到 .tk-state（${pill.err || '空轨迹'}）——判定那一栏没出结果？喂进去的是 ${num}`);
    else if (got.anim !== 'tkIn' || !/^0\.2s/.test(got.dur)) RED('判定药丸·同一条 tkIn 只降一档', `anim=${got.anim}、dur=${got.dur}（要 tkIn / 0.2s）`);
    else if (pops.length < 1 || got.op < 0.99) RED('判定药丸·出现这一下有过程', `中间取值 ${pops.length} 个、落定 op=${got.op}（${tail(pill)}）`);
    else ok('判定药丸·同一条 tkIn 只降一档', `dur=${got.dur}、中间取值 ${pops.length} 个、落定 opacity=${got.op}（号码 ${num.slice(0, 6)}…）`);
  }

  // —— 红条：第一次插入会抖，第二次换文案不重抖 ——
  const ins = await traceT(() => evalJs(`(() => {
      const p = document.querySelector('#tk-panel-idcard');
      const n = document.createElement('p');
      n.setAttribute('class', 'tk-panel__error');
      n.setAttribute('role', 'alert');
      n.id = '__tkerr';
      n.textContent = '这一块面板没能渲染出来：量具造的。其余面板不受影响。';
      p.insertBefore(n, p.firstChild);
      return 1;
    })()`), '#__tkerr', 420);
  const xs = [...new Set(ins.samples.map((s) => s.tx))];
  const errSnap = await snap('#__tkerr');
  if (ins.err || ins.samples.length < 10) {
    traceFail('红条第一次插入会抖', ins, `只读到 ${ins.samples.length} 帧`);
  } else if (errSnap.anim !== 'tkShake' || xs.filter((v) => v !== 0).length < 2) {
    RED('红条第一次插入会抖', `animationName=${errSnap.anim}、translateX 非零取值 ${xs.filter((v) => v !== 0).length} 个（${tail(ins)}）`
      + '——新插入的节点没跑起来，那这条规则等于没写');
  } else ok('红条第一次插入会抖', `tkShake / ${errSnap.dur}，translateX 走过 ${xs.slice(0, 4).join('→')}…，落定 ${ins.samples[ins.samples.length - 1].tx}`);
  await wait(120);
  const again = await traceT(() => evalJs(`(() => { const n = document.querySelector('#__tkerr');
      n.textContent = '第二条：只换文案，节点没换。'; return 1; })()`), '#__tkerr', 200);
  const moved = again.samples.filter((s) => s.tx !== 0).length;
  if (moved > 0) RED('第二次换文案不重抖', `换 textContent 之后仍读到 ${moved} 帧 translateX≠0（${tail(again)}）`
      + '——注释里那句「只在该面板第一次亮红条时出现」就不成立');
  else ok('第二次换文案不重抖', `换文案后 200ms 内 ${again.samples.length} 帧 translateX 恒 0（口径与 toolkit.scss 那段一致）`);
  await evalJs(`(() => { const n = document.querySelector('#__tkerr'); if (n) n.remove(); return 1; })()`);

  // —— 焦点环不必在本层重写：M14 那条是按元素类型列的，工具页的字段本来就有 ——
  const ring = await evalJs(`(() => {
      const el = document.querySelector('#tk-in-idcard-count');
      el.focus();
      const cs = getComputedStyle(el);
      return { anim: cs.animationName, w: cs.outlineWidth, st: cs.outlineStyle, act: document.activeElement.id };
    })()`);
  if (ring.act !== 'tk-in-idcard-count') RED('焦点环已在工具页生效', `activeElement=${ring.act}，聚焦没落地`);
  else if (ring.anim !== 'ringGrow' || ring.w !== '2px' || ring.st !== 'solid') {
    RED('焦点环已在工具页生效', `animationName=${ring.anim}、outline=${ring.w} ${ring.st}`
      + '——那 M29 注释里「已经付过了」这句不成立，本层得自己补一条');
  } else ok('焦点环已在工具页生效', `${ring.anim} / outline ${ring.w} ${ring.st}（editorial.scss §11 M14 按元素类型列，工具页的 input 也在里面）`);
  await evalJs('document.activeElement.blur()');
}

// —— reduce 档：动画还在，但一眼就得看得见 ——
await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await goto(ORIGIN + BASE + TOOL);
{
  const red = await evalJs(`(() => {
    const cs = (s) => getComputedStyle(document.querySelector(s));
    const p = cs('.tk-panel');
    const shown = [...document.querySelectorAll('.tk-panel')].filter((e) => !e.hidden);
    return { anim: p.animationName, dur: p.animationDuration, delay: p.animationDelay,
      op: shown.map((e) => +Number(getComputedStyle(e).opacity).toFixed(3)), n: shown.length };
  })()`);
  if (red.dur !== '1e-05s' && Number(red.dur) > 0.001) {
    RED('reduce·兜底真的吃到了工具层', `animation-duration=${red.dur}（base.scss:151 那条 !important 该把它压成 1e-05s）`);
  } else if (red.op.some((v) => v < 0.99)) {
    RED('reduce·入场不许藏内容', `${red.n} 块可见面板的 opacity = ${red.op.join(',')}（动画名 ${red.anim}、时长 ${red.dur}、延迟 ${red.delay}）`);
  } else ok('reduce·入场不藏内容', `${red.n} 块可见面板 opacity 全 1；这一档 animationName=${red.anim}`
    + '（那三条本来就关在 no-preference 里，reduce 档连声明都没有），而 base.scss:151 的兜底把 duration 压到 '
    + `${red.dur}、delay ${red.delay}——即便哪天有人把它们挪出媒体查询，也停在这一档`);
}

// —— 禁 JS：把 <script> 整个摘掉的副本（setScriptExecutionDisabled 会连 Runtime 一起停） ——
await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
HTML_MUTATE = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, '');
await goto(ORIGIN + BASE + TOOL);
await wait(700);
{
  const nj = await evalJs(`(() => {
    const ps = [...document.querySelectorAll('.tk-panel')];
    return { n: ps.length, scripts: document.querySelectorAll('script').length,
      hidden: ps.filter((e) => e.hidden).length,
      op: ps.map((e) => +Number(getComputedStyle(e).opacity).toFixed(2)),
      tabs: document.querySelectorAll('.tk-index__link[aria-selected]').length,
      body: (document.querySelector('#tk-panel-idcard .tk-panel__desc') || {}).textContent ? 1 : 0 };
  })()`);
  if (nj.scripts > 0 || nj.hidden !== 0 || nj.tabs !== 0) {
    RED('禁 JS 的副本真的没脚本', `script=${nj.scripts}、hidden 面板=${nj.hidden}、带 aria-selected 的索引=${nj.tabs}`
      + '——这条判据量的是「JS 一行没跑」那一版页面');
  } else if (nj.op.some((v) => v < 0.99)) {
    RED('禁 JS 时入场不藏正文', `5 块面板 opacity=${nj.op.join('/')}（没有 JS 就没有 hidden，五块全在屏上，动画必须收得住）`);
  } else ok('禁 JS 时入场不藏正文', `摘掉全部 <script>：${nj.n} 块面板全 display 正常、opacity=${[...new Set(nj.op)].join('/')}、面板正文读得到（aria-selected ${nj.tabs} 条=没有 JS 写的状态）`);
}
// reduce + 禁 JS 两态叠加：这一档是「最坏的那一位读者」，一眼看不见就是缺陷。
await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await goto(ORIGIN + BASE + TOOL);
{
  const both = await evalJs(`(() => {
    const ps = [...document.querySelectorAll('.tk-panel')];
    return { op: ps.map((e) => +Number(getComputedStyle(e).opacity).toFixed(2)), dur: getComputedStyle(ps[0]).animationDuration };
  })()`);
  if (both.op.some((v) => v < 0.99)) RED('reduce + 禁 JS', `opacity=${both.op.join('/')}（时长 ${both.dur}）`);
  else ok('reduce + 禁 JS', `${both.op.length} 块面板第一帧就 opacity=${[...new Set(both.op)].join('/')}，时长 ${both.dur}`);
}
HTML_MUTATE = null;
await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

console.log(`\n# 通过 ${PASS} 项，红 ${REDS.length} 项`);
if (errors.length) console.log('# 页内错误 ' + errors.length + ' 条：\n  ' + errors.slice(0, 8).join('\n  '));
if (REDS.length) console.log('# 红项：\n  ' + REDS.join('\n  '));
chrome.kill();
server.close();
process.exit(REDS.length || errors.length ? 1 : 0);
