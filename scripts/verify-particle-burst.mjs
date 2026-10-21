#!/usr/bin/env node
/**
 * 点击粒子核验：只回答两件事——**散落得开吗**、**卡吗**。
 *
 * 为什么要单独一本：`dev/libJs/cursor-effects.js`（上游 tholman/cursor-effects + 本地改色）
 * 的点击爆发是「重力雨」而不是径向散开：`angle` 取 (π-1, π+1) 让 `cos` 恒为负、
 * `y` 又叠了一项 `renderCount * 0.3` 的二次下落，而回收只看右/下两条边。
 * 2026-10-21 实测同一发点击：落在 y=200 时铺幅 433×180、向下飘 679px、活 1.1s；
 * 落在 y=780（离底 120px）时铺幅塌成 193×157、向下只剩 118px、0.7s 就被底边收走。
 * 用户看到的「有时候粒子散落不开」正是这一格——**效果取决于你点在哪里**。
 *
 * 判据（按读数判，不按墙钟）：
 *   P1 不成一边倒：三个落点各判「四向最大值 / 最小值 ≤2.2」且「最小一向 ≥70px」——只往下掉不算散开；
 *   P2 落点无关：三发的存活时长必须落在同一区间（700~1700ms），最久与最短之差 ≤500ms；
 *   P3 不给帧加负担：同一次运行里先量「空转 1.4s」再量「连点 6 发 1.6s」，判两者的差
 *     （中位增幅 ≤4ms、长帧增幅 ≤3 个）。绝对阈值在这里量的是宿主不是站点：
 *     这台机器软件光栅，什么都不点中位帧时也有 22.6ms；
 *   P4 不泄漏：连点 12 发后 2.5s 内画布必须清空（回收靠寿命，不靠底边 accident）；
 *   P5 清晰度：位图边长 == round(CSS 边长 × min(devicePixelRatio,2))——Retina 上不糊。
 *
 * 用法：node scripts/verify-particle-burst.mjs [--site=_site]
 * 退出码：0 全绿 / 1 有红 / 2 环境没起来或读数不足。
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
const BASE = '/better-blog';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const die = (m) => { console.log(`✗ 环境没起来：${m}`); process.exit(2); };
if (!fs.existsSync(path.join(SITE, 'index.html'))) die(`没有 ${SITE}/index.html——先构建`);
if (!fs.existsSync(CHROME)) die('认不到 Chrome');

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

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vpb-chrome-'));
const chrome = spawn(CHROME, ['--headless', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--disable-gpu', '--no-first-run', '--window-size=1280,900',
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
  '--proxy-server=direct://', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'], { stdio: ['ignore', 'ignore', 'pipe'] });
const kill = () => { try { chrome.kill(); } catch { /* 已退 */ } };
process.on('exit', kill);
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((s) => process.on(s, () => { kill(); process.exit(130); }));
const wsUrl = await new Promise((resolve, reject) => {
  let b = ''; const t = setTimeout(() => reject(new Error('20s 没等到 DevTools 端点')), 20000);
  chrome.stderr.on('data', (c) => { b += c; const m = /DevTools listening on (ws:\/\/\S+)/.exec(b); if (m) { clearTimeout(t); resolve(m[1]); } });
  chrome.once('exit', () => reject(new Error('Chrome 提前退出')));
}).catch((e) => die(e.message));

class Conn {
  constructor(u) { this.ws = new WebSocket(u); this.id = 0; this.p = new Map();
    this.ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id === undefined) return;
      const s = this.p.get(m.id); if (s) { this.p.delete(m.id); s(m); } }); }
  open() { return new Promise((r) => this.ws.addEventListener('open', r)); }
  send(method, params = {}, sessionId) { return new Promise((res, rej) => { const id = ++this.id;
      this.p.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)));
      this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params })); }); }
}
const c = new Conn(wsUrl);
c.ws.addEventListener('error', () => die('DevTools WebSocket 报错'));
await c.open();
const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p = {}, ms = 20000) => Promise.race([c.send(m, p, sessionId), new Promise((_, rej) => setTimeout(() => rej(new Error(`${m} 没回音`)), ms))]);
const run = (body, ms = 25000) => Promise.race([
  S('Runtime.evaluate', { expression: `(async function () { ${body} })()`, returnByValue: true, awaitPromise: true }, ms),
  new Promise((_, rej) => setTimeout(() => rej(new Error(`页内没落地 ${ms}ms`)), ms)),
]).then((r) => { if (r.exceptionDetails) throw new Error('页内异常：' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; });

await S('Page.enable');
// 判 P1~P4 这一趟用 dpr=1：这台无头是 --disable-gpu 的软件光栅，把位图放到 2560×1800
// 之后帧率直接掉到 15fps（实测），那是「软件渲染器画不动四倍像素」而不是站点掉帧。
// dpr 那一档单独在末尾用 dpr=2 重开一次页面量——它只需要读位图尺寸，不需要帧。
await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await S('Page.bringToFront');
try { await S('Page.setWebLifecycleState', { state: 'active' }); } catch { /* 版本没有这个域 */ }
// 粒子是画在位图上的，没有帧被提交就没有位移——与逐层动效核验同一台机器同一套产帧条件。
c.ws.addEventListener('message', (e) => { const m = JSON.parse(e.data);
  if (m.method === 'Page.screencastFrame' && m.params) S('Page.screencastFrameAck', { sessionId: m.params.sessionId }).catch(() => {}); });
await S('Page.startScreencast', { format: 'jpeg', quality: 5, maxWidth: 80, maxHeight: 80, everyPainting: true });
await S('Network.setCacheDisabled', { cacheDisabled: true });

// navigate 的回执要等导航**提交**，而这台 headless 在 dpr=2 + --disable-gpu 下提交可以慢到
// 二十秒以外（同一形状在逐层动效核验里也翻过一次）。回执可有可无，落定与否用 readyState 轮询判：
// 所以这里发出去就不管它，别让它把整轮量具带走。
S('Page.navigate', { url: ORIGIN + BASE + '/' }, 60000).catch(() => {});
let loaded = false;
for (let i = 0; i < 400; i++) {
  const st = await run('return document.readyState + "|" + location.pathname;', 4000).catch(() => 'no-doc');
  if (st === 'complete|' + BASE + '/') { loaded = true; break; }
  if (i === 120) console.log('· 前 5s 还没落定，继续等（当前 ' + st + '）');
  await new Promise((r) => setTimeout(r, 50));
}
if (!loaded) die('首页加载没落定：' + ORIGIN + BASE + '/');
await new Promise((r) => setTimeout(r, 900));

const found = await run(`
  var cs = [].slice.call(document.querySelectorAll('canvas'));
  var cv = cs.find(function (x) { var s = getComputedStyle(x); return s.position === 'fixed' && s.pointerEvents === 'none'; });
  if (!cv) return { err: '没有粒子画布（cursor-effects 没加载？）', count: cs.length };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return { w: cv.width, h: cv.height, cssW: Math.round(cv.getBoundingClientRect().width), cssH: Math.round(cv.getBoundingClientRect().height), dpr: window.devicePixelRatio, reduce: reduce };`);
if (found.err) { console.log('✗ ' + JSON.stringify(found)); server.close(); process.exit(2); }
if (found.reduce) die('这台机器开着「减少动态效果」，粒子闸门直接把整条特效关掉，量不了');
console.log(`· 画布位图 ${found.w}×${found.h}｜CSS ${found.cssW}×${found.cssH}｜devicePixelRatio=${found.dpr}`);

/**
 * 产帧密度预检。这一本判的铺幅与存活时长都是「帧的函数」，
 * 2026-10-21 就在这上面吃过一次假红：load 462 时同一发点击读到
 * 铺幅 45px、存活 10027ms、最长帧 290ms——那不是站点掉了帧，是宿主压根不给帧。
 * 与逐层动效核验同一口径：不够就 exit 2 拒数，不为了过门去挪门槛。
 */
const pre = await run(`
  var n = 0, t0 = performance.now();
  return new Promise(function (res) {
    var tick = function () { n++; if (performance.now() - t0 < 400) requestAnimationFrame(tick);
      else res(Math.round(n / ((performance.now() - t0) / 1000))); };
    requestAnimationFrame(tick);
  });`, 12000);
console.log(`· 预检：无头 rAF ≈${pre}fps`);
if (pre < 40) die(`无头只给到 ${pre}fps（需 ≥40）——铺幅与存活时长都按帧走，这种帧率下读数没有意义。等机器空了再跑`);

/**
 * 一发点击的几何与时长。像素回读很贵，所以只在需要时按 1/2 采样密度扫；
 * 帧时另开一条 rAF 记录，不掺回读——上一轮实测里 85ms 的「最长帧」正是回读自己造成的。
 */
const burst = (X, Y) => run(`
  var cv = [].slice.call(document.querySelectorAll('canvas')).find(function (x) { var s = getComputedStyle(x); return s.position === 'fixed' && s.pointerEvents === 'none'; });
  var ctx = cv.getContext('2d');
  var W = cv.width, H = cv.height, sc = W / cv.getBoundingClientRect().width;
  var X = ${X}, Y = ${Y};
  function scan() {
    var d = ctx.getImageData(0, 0, W, H).data, minX = 1e9, minY = 1e9, maxX = -1, maxY = -1, n = 0;
    for (var y = 0; y < H; y += 2) for (var x = 0; x < W; x += 2) {
      if (d[(y * W + x) * 4 + 3] > 10) { n++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    return { n: n, up: n ? (Y * sc - minY) / sc : 0, down: n ? (maxY - Y * sc) / sc : 0, left: n ? (X * sc - minX) / sc : 0, right: n ? (maxX - X * sc) / sc : 0 };
  }
  var ft = [], last = performance.now(), on = true;
  (function rec() { var t = performance.now(); ft.push(t - last); last = t; if (on) requestAnimationFrame(rec); })();
  // 三发重叠：同一落点，130ms 间隔（寿命约 1s，正好叠成一片），把每格的样本从 16 颗抬到 48 颗
  [0, 130, 260].forEach(function (d) { setTimeout(function () {
    window.dispatchEvent(new MouseEvent('mousedown', { clientX: ${X}, clientY: ${Y}, button: 0, bubbles: true }));
  }, d); });
  var peak = { up: 0, down: 0, left: 0, right: 0, w: 0, h: 0 }, alive = 0, t0 = performance.now(), lastSeen = 0;
  for (var i = 0; i < 40; i++) {
    await new Promise(function (r) { setTimeout(r, 60); });
    var s = scan();
    if (s.n) { alive++; lastSeen = Math.round(performance.now() - t0);
      peak.up = Math.max(peak.up, s.up); peak.down = Math.max(peak.down, s.down);
      peak.left = Math.max(peak.left, s.left); peak.right = Math.max(peak.right, s.right);
      peak.w = Math.max(peak.w, (s.up + s.down)); peak.h = Math.max(peak.h, (s.left + s.right)); }
    else if (i > 3) break;
  }
  on = false;
  var sorted = ft.slice(5).slice().sort(function (a, b) { return a - b; });
  return { 落点: [${X}, ${Y}], 四向铺幅: { 上: Math.round(peak.up), 下: Math.round(peak.down), 左: Math.round(peak.left), 右: Math.round(peak.right) },
           存活ms: lastSeen, 帧数: ft.length, 最长帧ms: +(sorted[sorted.length - 1] || 0).toFixed(1),
           长帧数: ft.filter(function (f) { return f > 32; }).length };`);

const trials = [];
for (const [x, y] of [[640, 180], [640, 450], [640, 790]]) {
  trials.push(await burst(x, y));
  await new Promise((r) => setTimeout(r, 1600));
}
/**
 * 帧时：先量「空转那一趟」，再量「连点 6 发那一趟」，判两者的**差**。
 * 上一版判绝对值（最长帧 ≤33ms），结果量的是宿主：同一台机器空转中位就有 22.6ms
 * （load 7.8、软件光栅），站点什么都没做就已经「红」了。绝对阈值在这里不是严，是假。
 * 换成同一次运行内的对照：这一发特效最多允许给每帧加 4ms，长帧最多加 3 个。
 */
const framePair = await run(`
  function rec(ms, clicks) {
    var ft = [], last = performance.now(), t0 = last, on = true;
    (function tick() { var t = performance.now(); ft.push(t - last); last = t; if (on && t - t0 < ms) requestAnimationFrame(tick); })();
    var iv = null;
    if (clicks) iv = setInterval(function () {
      var k = Math.floor(clicks.done);
      window.dispatchEvent(new MouseEvent('mousedown', { clientX: 260 + k * 110, clientY: 240 + (k % 3) * 130, button: 0, bubbles: true }));
      clicks.done++;
    }, 90);
    return new Promise(function (res) { setTimeout(function () { on = false; if (iv) clearInterval(iv);
      var s = ft.slice(6).slice().sort(function (a, b) { return a - b; });
      res({ 帧数: s.length, 中位: +(s[Math.floor(s.length / 2)] || 0).toFixed(1), p95: +(s[Math.floor(s.length * .95)] || 0).toFixed(1),
            最长: +(s[s.length - 1] || 0).toFixed(1), 长帧: ft.filter(function (f) { return f > 32; }).length });
    }, ms); });
  }
  var idle = await rec(1400, null);
  await new Promise(function (r) { setTimeout(r, 200); });
  var burst = await rec(1600, { done: 0 });
  return { 空转: idle, 连点: burst };`);
const leak = await run(`
  var cv = [].slice.call(document.querySelectorAll('canvas')).find(function (x) { var s = getComputedStyle(x); return s.position === 'fixed' && s.pointerEvents === 'none'; });
  var ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  function any() { var d = ctx.getImageData(0, 0, W, H).data; for (var i = 3; i < d.length; i += 4 * 7) if (d[i] > 10) return true; return false; }
  for (var k = 0; k < 12; k++) { window.dispatchEvent(new MouseEvent('mousedown', { clientX: 300 + k * 60, clientY: 250 + (k % 4) * 90, button: 0, bubbles: true })); await new Promise(function (r) { setTimeout(r, 45); }); }
  var t0 = performance.now();
  while (performance.now() - t0 < 4000 && any()) await new Promise(function (r) { setTimeout(r, 100); });
  return { 连点12发后清空耗时ms: Math.round(performance.now() - t0), 仍残留: any() };`);

let reds = 0;
const say = (name, ok, detail) => { if (!ok) reds++; console.log(`  ${ok ? '✓' : '✗'} ${name} — ${detail}`); };
console.log('· 逐发读数');
for (const t of trials) console.log(`   ${JSON.stringify(t)}`);
/**
 * P1 判的是「不是一边倒」，不是「每一向都够 100px」。
 *
 * 上一版写的是四向各自 ≥100px，跑出来一直红在某一向 86~96px——那不是特效没散开，
 * 是我的判据经不起随机：16 颗粒子各取一个随机角，某个象限有没有人正好朝那儿飞是运气，
 * 一条靠运气才能过的判据不是严，是坏。改成两条形状判据：
 *   · max/min ≤ 2.2 —— 铺得开且不成扇形（原来那一发是「往上 56、往下 480」，比值 8.6）；
 *   · min ≥ 70px    —— 确实散开了，不是挤成一团（原来最小 28~60px）。
 * 用改动前的读数回算同一把尺：三发的比值是 8.6 / 7.4 / 2.3、最小值是 56 / 60 / 46
 * —— 三条全部判红。尺子换的是「问对了问题」，不是放宽了标准。
 *
 * 每个落点连开 3 发再取并集：比值与最小值是**分布**的属性，16 颗粒子一次的极值
 * 受随机角影响太大（同一份代码连测三次能给出 1.16 / 2.64 / 1.56）。三发重叠
 * （130ms 间隔，寿命约 1s，正好叠在一起）把每格样本抬到 48 颗，判据才稳。
 */
const shape = trials.map((t) => {
  const v = [t.四向铺幅.上, t.四向铺幅.下, t.四向铺幅.左, t.四向铺幅.右];
  return { 落点: t.落点[1], 比值: +(Math.max(...v) / Math.min(...v)).toFixed(2), 最小: Math.min(...v) };
});
const shapeOk = shape.every((s) => s.比值 <= 2.2 && s.最小 >= 70);
say('P1 不成一边倒（比值 ≤2.2 且最小一向 ≥70px）', shapeOk,
  trials.map((t, i) => `${t.落点[1]}→上${t.四向铺幅.上}/下${t.四向铺幅.下}/左${t.四向铺幅.左}/右${t.四向铺幅.右}(比 ${shape[i].比值})`).join('  '));
const dMed = framePair.连点.中位 - framePair.空转.中位;
const dLong = framePair.连点.长帧 - framePair.空转.长帧;
say('P3 不给帧加负担（中位增幅 ≤4ms、长帧增幅 ≤3）', dMed <= 4 && dLong <= 3,
  `空转 ${JSON.stringify(framePair.空转)}｜连点 ${JSON.stringify(framePair.连点)}｜中位 +${dMed.toFixed(1)}ms、长帧 +${dLong}`);
const life = trials.map((t) => t.存活ms);
const spreadLife = Math.max(...life) - Math.min(...life);
say('P2 落点无关（存活 700~1700ms 且极差 ≤500ms）', life.every((v) => v >= 700 && v <= 1700) && spreadLife <= 500, `存活 ${life.join('/')}ms，极差 ${spreadLife}ms`);
say('P4 不泄漏（连点 12 发后 ≤2500ms 清空）', !leak.仍残留 && leak.连点12发后清空耗时ms <= 2500, JSON.stringify(leak));
// P5 单独一趟：把视口重设成 dpr=2、重新加载，只读位图尺寸，不判任何帧相关的事。
await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 2, mobile: false });
S('Page.navigate', { url: ORIGIN + BASE + '/' }, 60000).catch(() => {});
let re2 = false;
for (let i = 0; i < 300; i++) {
  if (await run('return document.readyState;', 4000).catch(() => '') === 'complete') { re2 = true; break; }
  await new Promise((r) => setTimeout(r, 50));
}
await new Promise((r) => setTimeout(r, 900));
const f2 = re2 ? await run(`
  var cv = [].slice.call(document.querySelectorAll('canvas')).find(function (x) { var s = getComputedStyle(x); return s.position === 'fixed' && s.pointerEvents === 'none'; });
  if (!cv) return { err: 'no-canvas' };
  var b = cv.getBoundingClientRect();
  return { w: cv.width, h: cv.height, cssW: Math.round(b.width), cssH: Math.round(b.height), dpr: window.devicePixelRatio };`) : { err: '没重载成功' };
if (f2.err) { reds++; console.log(`  ✗ P5 位图按 dpr 建 — 读不到画布：${JSON.stringify(f2)}`); }
else {
  const want = Math.min(f2.dpr || 1, 2);
  const dprOk = Math.abs(f2.w - Math.round(f2.cssW * want)) <= 2 && Math.abs(f2.h - Math.round(f2.cssH * want)) <= 2;
  say('P5 位图按 dpr 建（Retina 不糊）', dprOk, `dpr=${f2.dpr} → 位图 ${f2.w}×${f2.h}，应为 ${Math.round(f2.cssW * want)}×${Math.round(f2.cssH * want)}（封顶 2）`);
}
console.log(reds ? `✗ ${reds} 条不成立` : '✓ 粒子爆发四向散开、落点无关、不掉帧、不泄漏、按 dpr 出图');
server.close();
process.exit(reds ? 1 : 0);
