#!/usr/bin/env node
/**
 * Task 10：证件页浏览器侧核验（真 Chrome + CDP，无第三方依赖，Node 22 的全局 WebSocket）。
 *   1) 断点矩阵 360/640/641/880/900/901/920/940/1280/1920 —— 溢出 + 三处换挡（含 toolkit.scss
 *      注释点名"本格没实测"的 901–959 那段）
 *   2) 昼/夜 × 三档纸色温 = 6 组，现算正文与面板底色对比度（判线 4.5）
 *   3) 键盘：从文档头开始 Tab，核下拉靠 :focus-within 打开、子项可达、焦点环不是 outline:none
 *   4) 禁 JS：摘掉全部 <script> 的同一份产物，核五块面板正文与索引条仍在
 *   5) 首屏阻塞资源：按 entry.renderBlockingStatus 现量，与 §7 的 15,546B 口径对账
 * 本地服务把 _site 挂在 /better-blog 下（产物里的 baseurl 就是这个），/nojs/ 那一档现摘脚本。
 */
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';

import os from 'node:os';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, '_site');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
/**
 * 静态服务端口现抢，不能像上一版那样写死 8791：上一版固定端口时，8791 与 9333 都可能被
 * 前一轮遗留的进程占着，脚本却照常往下跑。
 *
 * Chrome 的调试端口**不用这里挑**，而是 `--remote-debugging-port=0` 让 Chrome 自己挑，
 * 再从**它自己的 stderr** 里读 `DevTools listening on ws://…`（见下面的 spawn）。理由是一次
 * 现场事故：2026-09-27 这一轮固定 9333 正被上一轮遗留的 headless Chrome 占着
 * （`--user-data-dir=/tmp/t10/profile-…`），`/json/version` 秒回，脚本以为自己连上了刚 spawn
 * 的那台，实际连的是那台孤儿——URL 是自己的、数字看着也合理，唯独 `chrome.kill()` 关不掉它，
 * `--window-size` 等 flag 也未必一致。"结果看着对，测的却不是自己启动的那一台"是静默说谎里
 * 最难查的一种，从子进程 stderr 读端点可以从根上排除这个形状：那行日志只可能出自这个 pid。
 *
 * @returns {Promise<number>} 当前空闲的 127.0.0.1 端口
 */
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
const PORT = await freePort(); // 静态服务端口
const BASE = '/better-blog';
const PAGE = '/tools/idcard.html';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon', '.map': 'application/json' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  let nojs = false;
  if (p.startsWith('/nojs/')) { nojs = true; p = p.slice(5); }
  if (p.endsWith('/')) p += 'index.html';
  let f = path.join(SITE, p);
  if (!f.startsWith(SITE)) { res.writeHead(403); return res.end('403'); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('404 ' + p); }
  let body = fs.readFileSync(f);
  if (nojs) body = Buffer.from(body.toString('utf8').replace(/<script[\s\S]*?<\/script>/gi, ''), 'utf8');
  res.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8',
    'cache-control': 'no-store' });
  res.end(body);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 't10-chrome-'));
// 只 MAP 字体那一个 host：这一格现场试过把 360 推送链上的 `js.passport.qihucdn.com`、
// `s8.qhres2.com` 一起 MAP 到 127.0.0.1（想用"全都失败"把阻塞字节变成确定数），结果
// `document.readyState` 在 ~9.6s 内再也到不了 complete，第 2 组导航直接 `加载超时` 崩在这一步——
// 同步 <script> 的连接被拒后 Chrome 带退避重试，比让它真连上还慢。
// 所以外链的不确定性不在这里消，在判据里消：**5a 的可复算读数与断言只算本地块**，
// 外链件原样列出来但不进判据（同一份产物两轮的外链合计实测 6,869B 与 6,897B，本地恒 222,121B）。
const chrome = spawn(CHROME, ['--headless', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run',
  '--disable-background-networking', '--window-size=1280,900',
  '--host-resolver-rules=MAP at.alicdn.com 127.0.0.1'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
// 端点只认这行 stderr：它出自上面那个 pid，所以不可能连到别人启动的浏览器。
// 子进程中途退出 / 20 秒内没吐出这行，都算这一轮没起来，直接退 2，不做任何"降级继续"。
const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  const timer = setTimeout(() => { cleanup(); reject(new Error('20s 内没读到 DevTools listening 那行 stderr')); }, 20000);
  const onExit = () => { cleanup(); reject(new Error(`Chrome 子进程提前退出（pid ${chrome.pid}）`)); };
  const cleanup = () => { clearTimeout(timer); chrome.stderr.off('data', onData); chrome.off('exit', onExit); };
  function onData(chunk) {
    buf += chunk.toString('utf8');
    const m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(buf);
    if (m) { cleanup(); resolve(m[1]); }
  }
  chrome.stderr.on('data', onData);
  chrome.once('exit', onExit);
}).catch((err) => { console.log(`✗ Chrome 调试端点没拿到：${err.message}`); process.exit(2); });

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
// 出处打在第一时间：这一轮连的是哪个 pid、哪份 profile，跑完对一眼，别留"测了别人"的悬念
console.log(`# Chrome pid=${chrome.pid} profile=${profile}\n# CDP ${wsUrl}\n# 静态服务 http://127.0.0.1:${PORT}${BASE}`);
const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p = {}) => c.send(m, p, sessionId);
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
  for (let i = 0; i < 160; i += 1) {
    const st = await evalJs('document.readyState');
    if (st === 'complete') return;
    await new Promise((r) => setTimeout(r, 60));
  }
  throw new Error('加载超时：' + url);
};
await S('Page.enable'); await S('Runtime.enable'); await S('Network.enable');
await S('Network.setCacheDisabled', { cacheDisabled: true });

const results = [];
const check = (id, pass, detail) => { results.push({ id, pass, detail }); console.log(`${pass ? '✓' : '✗'} ${id} — ${detail}`); };
const tracks = (v) => String(v).trim().split(/\s+/).length;
const URL_OF = (p) => `http://127.0.0.1:${PORT}${BASE}${p}`;

await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await goto(URL_OF(PAGE));

/* ── 1) 断点矩阵 ─────────────────────────────────────────────── */
const VPS = [360, 640, 641, 880, 900, 901, 920, 940, 1280, 1920];
const rows = [];
for (const w of VPS) {
  await S('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
  await new Promise((r) => setTimeout(r, 120));
  const o = await evalJs(`(() => {
    const de = document.documentElement, g = (s) => { const el = document.querySelector(s); return el ? getComputedStyle(el) : null; };
    const ws = g('.tk-workspace'), cols = g('.tk-cols'), idx = g('.tk-index'), hint = g('.tk-index__hint');
    const pan = document.querySelector('.tk-panel');
    const chips = [...document.querySelectorAll('.tk-index__link')].map((a) => Math.round(a.getBoundingClientRect().right));
    return { sw: de.scrollWidth, cw: de.clientWidth, iw: window.innerWidth,
      wsT: ws ? ws.gridTemplateColumns : null, colsT: cols ? cols.gridTemplateColumns : null,
      idxPos: idx ? idx.position : null, idxDisp: idx ? idx.display : null,
      hint: hint ? hint.display : null,
      panW: pan ? Math.round(pan.getBoundingClientRect().width) : null,
      chipMax: chips.length ? Math.max(...chips) : 0, chipN: chips.length };
  })()`);
  rows.push({ w, ...o });
}
const badOverflow = rows.filter((r) => r.sw - r.cw > 1);
check('1a 十档视口无横向溢出（scrollWidth − clientWidth ≤ 1）', badOverflow.length === 0,
  badOverflow.length ? `溢出档：${badOverflow.map((r) => `${r.w}px(+${r.sw - r.cw})`).join(' ')}`
    : rows.map((r) => `${r.w}:${r.sw}/${r.cw}`).join(' '));
const wsWrong = rows.filter((r) => tracks(r.wsT) !== (r.w <= 900 ? 1 : 2));
const colsWrong = rows.filter((r) => tracks(r.colsT) !== (r.w <= 640 ? 1 : 2));
const idxWrong = rows.filter((r) => (r.w <= 900 ? r.idxPos !== 'static' : r.idxPos === 'static'));
check('1b 工作区两栏↔单栏恰好落在 900（含 901/920/940 三档实测）', wsWrong.length === 0,
  rows.map((r) => `${r.w}:${tracks(r.wsT)}栏`).join(' ') + (wsWrong.length ? ` ← 错位档 ${wsWrong.map((r) => r.w).join()}` : ''));
check('1c 生成/判定两栏↔单栏恰好落在 640', colsWrong.length === 0,
  rows.map((r) => `${r.w}:${tracks(r.colsT)}`).join(' ') + (colsWrong.length ? ` ← 错位档 ${colsWrong.map((r) => r.w).join()}` : ''));
check('1d 索引条 ≤900 退成 static chip、提示语在 chip 档隐藏', idxWrong.length === 0
  && rows.filter((r) => r.w <= 900).every((r) => r.hint === 'none') && rows.filter((r) => r.w > 900).every((r) => r.hint !== 'none'),
  rows.map((r) => `${r.w}:${r.idxPos[0]}/hint=${r.hint === 'none' ? '藏' : '现'}`).join(' '));
const mid = rows.filter((r) => r.w >= 901 && r.w <= 959);
check('1e 901–959 那一段（注释点名"本格没实测"）：面板宽度与 chip 右沿都在视口内',
  mid.every((r) => r.panW > 0 && r.chipMax <= r.cw + 1),
  mid.map((r) => `${r.w}px 面板${r.panW}B、chip 最右 ${r.chipMax}/${r.cw}`).join(' '));

/* ── 2) 昼夜 × 三档纸色温 ─────────────────────────────────────── */
const lum = (rgb) => { const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number)
    .map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const combos = [];
for (const mode of ['day', 'night']) {
  for (const p of ['warm', 'cool', 'sage']) {
    await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await goto(URL_OF(PAGE));
    await evalJs(`localStorage.setItem('daytimeMode','${mode}');
      localStorage.setItem('readerPrefs', JSON.stringify({p:'${p}'})); 1`);
    await goto(URL_OF(PAGE));
    await new Promise((r) => setTimeout(r, 260));
    const o = await evalJs(`(() => { const panel=document.querySelector('.tk-panel'); const body=document.body;
      const cs=getComputedStyle(panel); const p=document.querySelector('.tk-panel p, .tk-prose p, .post-content p');
      const bgh=(el)=>{ let n=el; while(n){ const v=getComputedStyle(n).backgroundColor; if(v && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(v)) return v; n=n.parentElement; } return 'rgb(255, 255, 255)'; };
      return { night: document.documentElement.classList.contains('night-mode'), attr: document.documentElement.getAttribute('data-paper')||'',
        rs: document.documentElement.getAttribute('data-rs-paper') || '',
        panelBg: bgh(panel), text: getComputedStyle(p||panel).color, bodyBg: bgh(body),
        panelSelf: getComputedStyle(panel).backgroundColor,
        paperVar: getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(),
        label: (p||panel).textContent.trim().slice(0, 12) }; })()`);
    combos.push({ mode, p, ...o, r: +ratio(o.text, o.panelBg).toFixed(2) });
  }
}
check('2a 六组（昼/夜 × warm/cool/sage）正文对比度全过 4.5', combos.every((x) => x.r >= 4.5),
  combos.map((x) => `${x.mode}/${x.p}:${x.r}`).join(' '));
const dayDistinct = new Set(combos.filter((x) => x.mode === 'day').map((x) => x.bodyBg)).size === 3;
const nightFlat = new Set(combos.filter((x) => x.mode === 'night').map((x) => x.bodyBg)).size === 1;
// warm 是默认档：themeBootstrap/editorial.js 明写"只写非默认值"，所以默认档属性为空。
const attrWritten = combos.every((x) => x.rs === (x.p === 'warm' ? '' : x.p));
check('2b 纸色温三档：白昼 body 底色三个不同值；夜间恒为一个值（tokens.scss 的 :not(.night-mode) 是设计）',
  dayDistinct && nightFlat && attrWritten,
  combos.map((x) => x.mode + '/' + x.p + ':attr=' + x.rs + '/body=' + x.bodyBg).join(' '));
const panelDistinct = ['day', 'night'].every((m) => new Set(combos.filter((x) => x.mode === m).map((x) => x.panelSelf)).size === 3);
check('2d 面板底色跟不跟纸色温（不判、只报：--surface 一族本就不吃 --paper）', true,
  `panel 三档全不同=${panelDistinct}；` + combos.map((x) => `${x.mode}/${x.p}:panel=${x.panelSelf}/--paper=${x.paperVar}`).join(' '));
check('2c 档位与类名一致：night-mode 只在 night 档出现',
  combos.every((x) => x.night === (x.mode === 'night')),
  combos.map((x) => `${x.mode}:${x.night ? 'night' : 'day'}`).join(' '));

/* ── 3) 键盘走查 ─────────────────────────────────────────────── */
await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await goto(URL_OF(PAGE));
await new Promise((r) => setTimeout(r, 300));
const chain = [];
for (let i = 0; i < 26; i += 1) {
  await S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  await S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  await new Promise((r) => setTimeout(r, 240));
  chain.push(await evalJs(`(() => { const a=document.activeElement; if(!a) return 'null';
    const sub = a.closest('.nav-sub'); return [a.tagName.toLowerCase(), (a.className||'').toString().split(' ')[0],
      (a.textContent||'').trim().slice(0,8), sub?1:0].join('|'); })()`));
}
const mq = await evalJs(`JSON.stringify({hover: matchMedia('(hover: hover)').matches, fine: matchMedia('(pointer: fine)').matches,
  w: innerWidth, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches})`);
const subState = await evalJs(`(async () => { const it=[...document.querySelectorAll('.nav-item.has-sub')].find(n=>/工具箱/.test(n.textContent));
  const sub=it.querySelector('.nav-sub'); const first=it.querySelector('.nav-sub-link');
  it.querySelector('.nav-link').focus();
  await new Promise(r=>setTimeout(r, 260)); const cs=getComputedStyle(sub);
  return { fw: it.matches(':focus-within'), disp: cs.display, vis: cs.visibility, op: cs.opacity,
    ti: first.getAttribute('tabindex'), rect: Math.round(first.getBoundingClientRect().width),
    after: (document.activeElement.className||'').split(' ')[0] }; })()`);
const hasSubLink = chain.some((s) => /nav-sub-link/.test(s));
const dropIdx = chain.findIndex((s) => /工具箱|nav-link/.test(s));
check('3a Tab 链在离开头部之前能走进下拉子项（:focus-within 打开）', hasSubLink,
  `前 14 跳：${chain.slice(0, 14).join(' | ')}；mq=${mq}；focus-within=${JSON.stringify(subState)}`);
const ring = await evalJs(`(async () => { const b=document.querySelector('.tk-btn');
  await new Promise(r=>{ b.focus(); requestAnimationFrame(()=>requestAnimationFrame(r)); });
  const cs=getComputedStyle(b);
  return { outline: cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor, matches: b.matches(':focus-visible') };
})()`);
check('3b 焦点环不是 outline:none（.tk-btn，经 .focus() 读 :focus-visible 态）',
  ring.outline.split(' ')[0] !== 'none' && parseFloat(ring.outline.split(' ')[1]) >= 1,
  `outline=${ring.outline}；:focus-visible=${ring.matches}（前 ${chain.length} 跳里落在 .tk-btn 上的有 ${chain.filter((x) => /tk-btn/.test(x)).length} 跳——面板在头部之后，跳数不够属正常，本条判的是样式不是序列）`);

/* ── 4) 禁 JS 降级 ───────────────────────────────────────────── */
await goto(URL_OF(PAGE));
await new Promise((r) => setTimeout(r, 400));
const withJs = await evalJs(`document.querySelector('main').innerText.replace(/\s+/g,'').length`);
await goto(URL_OF('/nojs' + PAGE));
const nj = await evalJs(`(() => ({ panels: document.querySelectorAll('.tk-panel').length,
  links: document.querySelectorAll('.tk-index__link').length,
  scripts: document.querySelectorAll('script').length,
  text: document.querySelector('main').innerText.replace(/\\s+/g,'').length,
  forms: document.querySelectorAll('.tk-panel input, .tk-panel select').length }))()`);
check('4a 摘掉全部 <script> 后：五块面板、索引条仍在，正文不少于开 JS 那一版的 90%',
  nj.panels === 5 && nj.links === 5 && nj.scripts === 0 && nj.text >= withJs * 0.9,
  `面板 ${nj.panels}、索引 ${nj.links}、控件 ${nj.forms}、正文 禁JS ${nj.text} 字 / 开JS ${withJs} 字（比值 ${(nj.text / withJs * 100).toFixed(1)}%）、脚本 ${nj.scripts}`);

/* ── 5) 首屏阻塞资源现量（与 §7 的 15,546B 对账） ─────────────── */
await goto(URL_OF(PAGE));
await new Promise((r) => setTimeout(r, 500));
const rl = await evalJs(`(() => {
  const res = performance.getEntriesByType('resource').map((e) => ({
    name: e.name.replace(location.origin + ${JSON.stringify(BASE)}, ''), rb: e.renderBlockingStatus || 'n/a',
    xfer: e.transferSize || 0 }));
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const blocking = res.filter((r) => r.rb === 'blocking');
  // 名字以 "/" 开头 = 本机产物（origin+baseurl 已被剥掉）；剩下的是外链，它们的 transferSize
  // **按当场成败浮动**（同一份产物两轮实测 222,121B 与 229,019B，差的正是 at.alicdn 6,244 +
  // qhres2 654），所以"可复算的那个数"只算本地块，外链单独列出来但不进判据。
  const isLocal = (b) => b.name[0] === '/';
  const local = blocking.filter(isLocal);
  const remote = blocking.filter((b) => !isLocal(b));
  return { htmlBytes: nav.transferSize || nav.encodedBodySize || 0,
    all: res.length, blocking: blocking.map((b) => b.name + ':' + b.xfer).join(' '),
    blockSum: blocking.reduce((s, b) => s + b.xfer, 0),
    blockLocalSum: local.reduce((s, b) => s + b.xfer, 0),
    localCount: local.length,
    remoteBlock: remote.map((b) => b.name + ':' + b.xfer).join(' ') || '(无)',
    nonBlock: res.filter((r) => r.rb !== 'blocking').length,
    mine: res.filter((r) => /toolkit\.min\.css|toolkitCore|toolIdcard/.test(r.name)).map((r) => r.name.split('/').pop() + '=' + r.rb + '/' + r.xfer).join(' ') }; })()`);
// 这一条**要有牙**：证件页新加的三件不该进阻塞集（`toolkit.min.css` 落在产物 <body> 第 332 行，
// 正是为此）。写成 `true` 的"只报"就等于给这一格发了张永久通行证——将来谁把它搬进 <head>，
// 这里一声不响，而 §7 那条 16KB 的口径当场失真。
// 判据只认这三件的**确切文件名**。上一版写成 `min\.css|idcard` 的宽松正则，把全站公共件
// `index.min.css`、`normalize.min.css` 也算成"本页件"，于是红了一条假缺陷——阻塞集里本来就该有
// 公共件，这一格管的是"证件页专属的那三件有没有被搬进 <head>"。
// `accountedFor` 兜另一种红法：资源表空/导航失败时三件都"不在阻塞集里"，前两个条件会**一起真**，
// 于是这一格假绿。所以这里要求量到的东西成得了像：HTML 上千字节、本地阻塞件不少于 3 件、
// 本地合计不少于 50KB（现量 7 件 / 222,121B；全站公共那一族要掉到 50KB 以下，等于 §7 的阻塞集
// 基线整段要重写，那时这一格变红是应该的）。
const MINE = ['toolkit.min.css', 'toolkitCore.min.js', 'toolIdcard.min.js'];
const mineInBlocking = rl.blocking
  .split(' ')
  .filter(Boolean)
  .map((e) => e.split(':')[0].split('/').pop())
  .filter((b) => MINE.includes(b));
const mineNonBlocking = MINE.every((f) => rl.mine.includes(`${f}=non-blocking`));
const accountedFor = rl.htmlBytes > 1000 && rl.localCount >= 3 && rl.blockLocalSum >= 50000;
check('5a 阻塞集里不含证件页专属件（三件全 non-blocking），并现量阻塞集的本地字节',
  mineNonBlocking && mineInBlocking.length === 0 && accountedFor,
  `HTML ${rl.htmlBytes}B；阻塞集本地 ${rl.blockLocalSum}B（${rl.localCount} 件，可复算）+ 外链当场 ${rl.blockSum - rl.blockLocalSum}B = ${rl.blockSum}B；资源共 ${rl.all} 条、non-blocking ${rl.nonBlock} 条；本页三件：${rl.mine}；本地阻塞清单=${rl.blocking}；外链阻塞清单=${rl.remoteBlock}`
    + `${mineInBlocking.length ? ' ← 阻塞集里出现了本页件：' + mineInBlocking.join(', ') : ''}`
    + `${mineNonBlocking ? '' : ' ← 三件没有全部以 non-blocking 出现在资源表里'}`
    + `${accountedFor ? '' : ' ← 资源表没量到东西（HTML/本地块数/本地合计三项不达标），前两项即便为真也不算过'}`);

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} 通过${results.filter((r) => !r.pass).length ? '，失败：' + results.filter((r) => !r.pass).map((f) => f.id).join(' / ') : ''}`);
chrome.kill(); server.close();
process.exit(results.some((r) => !r.pass) ? 1 : 0);
