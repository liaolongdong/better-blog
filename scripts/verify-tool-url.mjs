#!/usr/bin/env node
/**
 * 工具页「档位 ↔ 地址栏」的浏览器验证器（子项目 2 第一刀的量具，U1–U7）。
 *
 * 为什么判据必须活在真浏览器里：被验的东西是「`replaceState` 落下去之后地址栏本身长成什么样」——
 * 键序、别人的参数、`#hash`、历史条数，全是 `window.history` 与 `location` 的行为。
 * `scripts/tool-url-state-tests.mjs` 那十二判用的是假 `history`：它量得出「`sync` 调了几次
 * `replaceState`、第三个参数是哪一枚串」，量不出真浏览器会不会把 `?` 补在 `#` 前面、`length`
 * 到底涨不涨、进站那一次读有没有真的落到控件上。两边各量一半：纯函数那半归 Node，镜像落地那半归这里。
 *
 * 用法：
 *   TU_SITE_DIR=/tmp/sp2-teeth/_site node scripts/verify-tool-url.mjs
 *   TU_SITE_DIR=… node scripts/verify-tool-url.mjs --only=U3   # 只跑编号含该串的那一组
 *
 * `TU_SITE_DIR` 必填，且不许指到仓库自己的 `_site`（与 `verify-tools-browser.mjs` 同一条隔离门）：
 * 那一格是 `pnpm dev` 与并行会话共用的输出，指到这儿既有读到旧产物的风险，也会让牙齿那一本往
 * 别人正在看的那棵树上注错。
 *
 * 四条房规（前三条沿用 SP3 那本量具，第四条是本格自己的账）：
 *   1. 端口一律自己抢（`listen(0)`）并打出来。猜端口会量到上一轮遗留的服务，那种读数一路全绿而
 *      量的却是旧产物。
 *   2. 开局自证磁盘与服务器吐出的三本产物（`toolkitCore` / `toolJson` / `toolDiff`）同一份 md5。
 *      对不上就是量具在端旧产物，后面的每一条判据都不必再看。
 *   3. 1 分钟负载 > 16 先等它落下来，等 90s 仍在则 exit 2 拒测；所有等待走 `until()` 轮询，
 *      **不写定长 sleep**——定长 sleep 在负载下会把「渲染慢」读成「功能坏了」。
 *   4. **键名清单逐字来自 spec §2，档位选项与默认档从 `_site` 的骨架现读**，两处都不抄装配层那张表
 *      （`JSON_SPEC` / `DIFF_SPEC`）。本格要判的正是「装配层的名单与页面的控件是不是同一批、默认档
 *      是不是同一枚」，量具若从那张表抄，漂了也一起漂，判据恒真。
 *
 * 退出码：0 全绿 / 1 有红点 / 2 环境没起来或量具自己挂了（不算通过，也不算产物缺陷）。
 */
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const a = argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const die = (msg) => { console.log(`✗ 环境没起来：${msg}`); process.exit(2); };

/** 隔离门：只认显式给出的快照，仓库 `_site` 是共享构建输出 */
if (!process.env.TU_SITE_DIR) {
  die('没给 TU_SITE_DIR。本格只认隔离快照（仓库 _site 是 pnpm dev 与并行会话共用的输出，读到旧产物就一路全绿了）');
}
const SITE = path.resolve(process.env.TU_SITE_DIR);
if (SITE === path.join(REPO, '_site')) die(`TU_SITE_DIR 指到了仓库自己的 _site（${SITE}）——那一格是共享构建输出，不许往里注错`);
if (!fs.existsSync(path.join(SITE, 'tools/json.html'))) die(`产物里没有 ${SITE}/tools/json.html——先跑 npx vite build && bundle exec jekyll build`);
const ONLY = opt('only', null);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = '/better-blog';
if (!fs.existsSync(CHROME)) die(`认不到 Chrome：${CHROME}`);
const LOAD1 = () => (os.loadavg ? os.loadavg()[0].toFixed(1) : '—');
{
  const WAIT_MS = 90000;
  const t0 = Date.now();
  for (;;) {
    if (os.loadavg()[0] <= 16) break;
    if (Date.now() - t0 >= WAIT_MS) die(`1 分钟负载 ${LOAD1()} > 16 且等了 ${Math.round((Date.now() - t0) / 1000)}s 没落下来，量具连自己那几发 CDP 都排不到，宁可不交`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (Date.now() - t0 > 1000) console.log(`· 负载闸门：等了 ${Math.round((Date.now() - t0) / 1000)}s 才降到 ${LOAD1()}`);
}

// ── 静态服务 ────────────────────────────────────────────────────────────────
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.once('listening', () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
    probe.listen(0, '127.0.0.1');
  });
}
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon', '.map': 'application/json',
};
/** 挂一棵树：BASE 前缀剥掉后落到 siteDir，其余一律 404。 */
function serve(siteDir) {
  return freePort().then((port) => new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.startsWith(BASE)) p = p.slice(BASE.length);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(siteDir, p);
      if (!f.startsWith(siteDir)) { res.writeHead(403); return res.end('403'); }
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404 ' + p); }
      res.writeHead(200, {
        'content-type': (MIME[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8',
        'cache-control': 'no-store',
      });
      res.end(fs.readFileSync(f));
    });
    server.listen(port, '127.0.0.1', () => resolve({ port, server }));
  }));
}
const MAIN_S = await serve(SITE);
const ORIGIN = `http://127.0.0.1:${MAIN_S.port}`;
console.log(`· 量的是 ${SITE}（端口 main=${MAIN_S.port}，从 0 抢的）`);

const md5 = (abs) => crypto.createHash('md5').update(fs.readFileSync(abs)).digest('hex');
{
  const lines = [];
  for (const b of ['toolkitCore.min.js', 'toolJson.min.js', 'toolDiff.min.js']) {
    const abs = path.join(SITE, 'assets/js', b);
    if (!fs.existsSync(abs)) die(`产物里没有 assets/js/${b}（vite build 没跑？）`);
    const want = md5(abs);
    const got = await fetch(`${ORIGIN}${BASE}/assets/js/${b}`).then((r) => r.text())
      .then((t) => crypto.createHash('md5').update(t).digest('hex'));
    if (got !== want) die(`服务端点自证失败：${b} 磁盘 md5 ${want} ≠ 服务器吐的 ${got}（量具在端旧产物，后面的判据一条都别信）`);
    lines.push(`${b} ${want.slice(0, 8)}/${fs.statSync(abs).size}B`);
  }
  console.log(`· 端点自证：三本产物磁盘与服务器同一份（${lines.join('、')}）`);
}

// ── 键表：名单从 spec §2 逐字抄，选项与默认档从骨架现读 ──────────────────────
const SPEC_KEYS = {
  json: ['jt-view', 'jt-indent', 'jt-sort'],
  diff: ['df-mode', 'df-layout', 'df-context', 'df-ws', 'df-case'],
};
const PREFIX = { json: 'jt', diff: 'df' };

/** DOM id → 裸控件 id（`jt-in-workbench-view` → `view`）；形状对不上就是骨架漂了 */
const ctlOf = (id, prefix, where) => {
  const m = new RegExp(`^${prefix}-in-([a-z]+)-(.+)$`).exec(id);
  if (!m) die(`${where} 里一枚 id="${id}" 不认「{prefix}-in-{面板}-{控件}」这个形状：骨架的 id 口径变了，键名推不出来`);
  return m[2];
};
/**
 * 从 `_site` 的骨架读那几枚档位控件的**可选值与默认档**。
 *
 * 默认档取 `<option selected>`，没有 `selected` 才落第一枚——这一格不是抠细节：对比页的
 * `df-in-workbench-context` 四档里钉默认的是第二枚（`3`），照「第一枚即默认」去推会把 `diff`
 * 当成默认档，于是「落回默认删键」那条判据从进站那一刻起就没有基准。
 */
function harvest(page) {
  const prefix = PREFIX[page];
  const file = path.join(SITE, 'tools', `${page}.html`);
  const html = fs.readFileSync(file, 'utf8');
  const found = new Map();
  for (const m of html.matchAll(/<select id="([^"]+)"[\s\S]*?<\/select>/g)) {
    const id = m[1];
    const tags = [...m[0].matchAll(/<option[^>]*>/g)].map((x) => x[0]);
    const options = tags.map((t) => (/value="([^"]*)"/.exec(t) || [])[1]).filter((v) => v !== undefined);
    if (!tags.length || options.length !== tags.length) die(`${file} 的 <select id="${id}"> 里有 <option> 没写 value：骨架的档位值读不全，默认档与可选值无从独立核对`);
    const sel = tags.map((t, i) => (/\bselected\b/.test(t) ? i : -1)).filter((i) => i >= 0);
    if (sel.length > 1) die(`${file} 的 <select id="${id}"> 里有 ${sel.length} 枚 selected：默认档不唯一，量具没法独立于装配层定这一格`);
    const control = ctlOf(id, prefix, file);
    found.set(`${prefix}-${control}`, { control, kind: 'select', options, dflt: options[sel.length ? sel[0] : 0] });
  }
  for (const m of html.matchAll(/<input[^>]*>/g)) {
    if (!/\btype="checkbox"/.test(m[0])) continue;
    const id = (/id="([^"]+)"/.exec(m[0]) || [])[1];
    if (!id) continue;
    const control = ctlOf(id, prefix, file);
    // spec §2 第三口径：这两页的勾选框默认都是未勾选，所以「取消勾选」在地址栏里的形状就是键缺席
    if (/\bchecked\b/.test(m[0])) die(`${file} 里 <input id="${id}"> 的骨架默认是勾选态：spec「check 只有 '1' 一档、默认未勾选」那条口径在这一枚上不成立，先改 spec 再来动量具`);
    found.set(`${prefix}-${control}`, { control, kind: 'check', options: ['1'], dflt: false });
  }
  for (const k of SPEC_KEYS[page]) {
    if (!found.has(k)) die(`骨架里没有 spec §2 名单上的「${k}」这一枚控件：spec 与 ${page}.html 漂了，U1 的逐键两读有一条无从落地`);
  }
  const extra = [...found.keys()].filter((k) => !SPEC_KEYS[page].includes(k));
  console.log(`· 键表（骨架现读）：${page} 名单 ${SPEC_KEYS[page].length} 枚 = ${SPEC_KEYS[page].join(' ')}；骨架里另有 ${extra.length} 枚按 spec 不进地址栏（${extra.join(' ') || '无'}）`);
  return found;
}
const KEYS = { json: harvest('json'), diff: harvest('diff') };

/** 四页名单从 `_data/onlineTools.yml` 现读，不在脚本里再抄一张页表 */
const PAGES4 = JSON.parse(execFileSync('ruby',
  ['-e', 'require "yaml"; require "json"; puts YAML.load_file(ARGV[0]).to_json', path.join(REPO, '_data/onlineTools.yml')],
  { encoding: 'utf8' }))
  .filter((e) => e.status === 'ready')
  .map((e) => ({ slug: e.slug, url: e.url, prefix: e.prefix }));
if (PAGES4.length < 4) die(`_data/onlineTools.yml 里 status: ready 的只有 ${PAGES4.length} 页：U6 的四页回归锁读不到名单`);

// ── Chrome + CDP ────────────────────────────────────────────────────────────
const chromeProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'tu-chrome-'));
const chrome = spawn(CHROME, ['--headless', '--remote-debugging-port=0',
  `--user-data-dir=${chromeProfile}`, '--disable-gpu', '--no-first-run',
  '--disable-background-networking', '--window-size=1280,900',
  '--proxy-server=direct://', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
/** 只杀自己那一个 pid：这台机器上常有并发会话的 Chrome，宽匹配 pkill 会连别人的量具一起带走。 */
process.on('exit', () => { try { chrome.kill(); } catch (e) { /* 已经没了 */ } });
/** 端点只认这行 stderr：它出自上面那个 pid，所以「连上别人的浏览器」从根上排除。 */
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
}).catch((err) => die(`Chrome 调试端点没拿到：${err.message}`));

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
}
const c = new Conn(wsUrl);
await c.open();
const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });

const CDP_MS = 30000;
const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 80);
let GROUP = '(前置)';
const S = (m, p = {}, ms = CDP_MS) => {
  const call = c.send(m, p, sessionId);
  call.catch(() => {});
  const label = m === 'Runtime.evaluate' ? `${m} «${oneLine(p.expression)}»` : m;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`CDP ${label} 在 ${ms / 1000}s 内没有回应（当时正在跑「${GROUP}」，本机 1 分钟负载 ${LOAD1()}）`)), ms);
    call.then(resolve, reject).finally(() => clearTimeout(timer));
  });
};
const evalJs = async (expression, ms = CDP_MS) => {
  const r = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, ms);
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
    if (await evalJs('document.readyState') === 'complete') return;
    await wait(60);
  }
  throw new Error('加载超时：' + url);
};
/** 轮询到某个页内状态落定，或到点；tookMs 进读数，慢要能自证是谁的钟慢。 */
const until = async (predicateExpr, ms = 4000) => {
  const t0 = Date.now();
  for (;;) {
    if (await evalJs(`!!(${predicateExpr})`)) return { settled: true, tookMs: Date.now() - t0 };
    if (Date.now() - t0 >= ms) return { settled: false, tookMs: Date.now() - t0 };
    await wait(80);
  }
};
await S('Network.setCacheDisabled', { cacheDisabled: true });
await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
{
  const w = await evalJs('window.innerWidth');
  if (w !== 1280) die(`视口自证失败：setDeviceMetricsOverride 之后 innerWidth=${w}（要 1280）`);
}

// ── 页内小工具 ──────────────────────────────────────────────────────────────
const fid = (page, control) => `${PREFIX[page]}-in-workbench-${control}`;
const pageUrl = (page, search = '', hash = '') => `${ORIGIN}${BASE}/tools/${page}.html${search ? `?${search}` : ''}${hash}`;
/** 地址栏 + 历史条数一次读回 */
const readLoc = () => evalJs('({search: location.search, href: location.href, hash: location.hash, pathname: location.pathname, len: history.length})');
/** 控件当前读数：check 读 `checked`、其余读 `value`，一律 `String()` 化（`true` 与 `'true'` 不是同一个东西） */
const readCtl = (page, control, kind) => evalJs(`(() => {
  const el = document.getElementById(${JSON.stringify(fid(page, control))});
  if (!el) return 'NO-SUCH-CONTROL';
  return String(${JSON.stringify(kind)} === 'check' ? el.checked : el.value);
})()`);
/** 用户那条路：写控件 + 派发 `change`（监听就挂在这枚控件上，冒泡与否不影响它） */
const setCtl = (page, control, kind, value) => evalJs(`(() => {
  const el = document.getElementById(${JSON.stringify(fid(page, control))});
  if (!el) return 'NO-SUCH-CONTROL';
  if (${JSON.stringify(kind)} === 'check') el.checked = ${value === true || value === '1' ? 'true' : 'false'};
  else el.value = ${JSON.stringify(String(value))};
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return String(el.type === 'checkbox' ? el.checked : el.value);
})()`);
/** 等一枚控件落到期望读数（进站那条路是同步挂载，落不定就只说明慢，不等长 sleep） */
const settleCtl = (page, control, kind, want, ms = 3000) => until(
  `document.getElementById(${JSON.stringify(fid(page, control))}) && String(document.getElementById(${JSON.stringify(fid(page, control))}).${kind === 'check' ? 'checked' : 'value'}) === ${JSON.stringify(String(want))}`, ms);
/** 地址栏里属于这一页前缀的那几枚键（顺序就是 `search` 里的顺序） */
const ownKeys = (search, prefix) => [...new URLSearchParams(search).keys()].filter((k) => k.startsWith(`${prefix}-`));
const qof = (search, name) => new URLSearchParams(search).get(name);
/** 空地址栏在台账里要念成「（空）」而不是 `""`——那两种写法在读者眼里是两件事 */
const showSearch = (s) => (s === '' ? '（空）' : JSON.stringify(s));

// ── 报告器 ──────────────────────────────────────────────────────────────────
/**
 * 量具自己抛（页内异常、CDP 那一只 Promise 超时、表达式拼错）算环境账，退 2。
 *
 * 为什么要专门钉这一格：Node 默认让未捕获异常退 1，而 1 在本族的口径里是「产物有红点」——
 * 一句 stack trace 会被读成「门量出了缺陷」，而它其实是量具挂了（台账里连汇总行都没有，
 * 缺汇总行本身就是这一格的签名）。环境账与产物账必须分成两个退出码。
 */
const crash = (err) => {
  console.log(`✗ 量具自己挂了（不算通过，也不算产物缺陷）：${err && err.message ? err.message : err}`);
  try { chrome.kill(); } catch (e) { /* 已经没了 */ }
  MAIN_S.server.close();
  process.exit(2);
};
process.on('uncaughtException', crash);
process.on('unhandledRejection', crash);
const fails = [];
let passed = 0;
const group = (name) => { GROUP = name; if (!ONLY || name.includes(ONLY)) console.log(`\n── ${name}`); };
const ok = (name, detail) => { if (!ONLY || name.includes(ONLY)) { passed += 1; console.log(`  ✓ ${name}：${detail}`); } };
const bad = (name, entry, msg) => { fails.push(`[${name}] ${entry}：${msg}`); console.log(`  ✗ ${name}·${entry}：${msg}`); };

/**
 * 前置：先到 JSON 页，再确认页内那本共用层真的挂着 `url`。
 *
 * 这一格红而下面的判据也红时，红出来的因果是不同的：`Tk` 整只不在，说明 `toolkitCore.min.js` 没跑
 * 起来（两页的装配层都会构造期抛，U1–U7 跟着全红是连带，不是八条独立缺陷）；`Tk` 在而 `url` 不在，
 * 说明第五只没挂进来。两种都是产物账，所以走 `bad()` 而不是 `die()`——退 2 会说「环境没起来」，
 * 而那正好替产物缺陷开了脱。
 */
{
  await goto(pageUrl('json'));
  const tk = await evalJs('({ names: window.Tk ? Object.keys(window.Tk).sort() : null, url: window.Tk && window.Tk.url ? Object.keys(window.Tk.url).sort() : null })');
  if (!tk.names) {
    bad('U0 前置', '页内 toolkit 活着', `页面加载完没有 window.Tk（实读 ${JSON.stringify(tk.names)}）：toolkitCore.min.js 没跑起来，两页的装配层都在构造期缺依赖，下面每一条红都是这一条的连带`);
  } else if (!tk.url) {
    bad('U0 前置', 'Tk.url 挂在面上', `Tk 有 ${JSON.stringify(tk.names)} 却没有 url 这一格：那一本纯模块没被挂进来，档位进不了地址栏`);
  } else {
    const want = ['nextSearch', 'parse', 'sync'];
    if (want.join() !== tk.url.join()) {
      bad('U0 前置', 'Tk.url 的三面', `实得 ${JSON.stringify(tk.url)}，要 ${JSON.stringify(want)}：页里能摸到的与 Node 侧那十二判的不是同一本模块`);
    } else {
      ok('U0 Tk.url 已在面上', `五格里第三只是它（${tk.url.join(' / ')}），下面的镜像写判据都有实现可走`);
    }
  }
}

// ── U1 进站按参数落定：逐键两读 ──────────────────────────────────────────────
group('U1 进站按参数落定（逐键两读）');
for (const page of ['json', 'diff']) {
  const prefix = PREFIX[page];
  for (const name of SPEC_KEYS[page]) {
    const k = KEYS[page].get(name);
    const want = k.kind === 'check' ? '1' : k.options.find((o) => o !== k.dflt);
    if (want === undefined) die(`${page} 的「${name}」只有一档（${JSON.stringify(k.options)}）：U1 取不到非默认档，这一格会恒真`);
    await goto(pageUrl(page, `${name}=${encodeURIComponent(want)}`));
    const landed = await settleCtl(page, k.control, k.kind, k.kind === 'check' ? true : want);
    const ctl = await readCtl(page, k.control, k.kind);
    const loc = await readLoc();
    const expectCtl = k.kind === 'check' ? 'true' : want;
    if (ctl !== expectCtl) {
      bad('U1', `${page} 的「${name}」落进控件`, `进站带 ?${name}=${want}，${landed.tookMs}ms 后控件实读 ${JSON.stringify(ctl)}（要 ${JSON.stringify(expectCtl)}）：地址栏里那一档没被采纳，深链开出来还是默认档`);
    } else if (qof(loc.search, name) !== want) {
      bad('U1', `${page} 的「${name}」不被抹`, `控件已经是 ${want} 了，地址栏却读回 ${showSearch(loc.search)}：进站那一次读顺手洗了地址栏（镜像是结果的镜像，不是来源）`);
    } else {
      const from = k.kind === 'check'
        ? 'spec §2 给 check 的唯一一档（骨架只钉了「默认未勾选」那一半）'
        : `骨架的 ${JSON.stringify(k.options)} 里现取的那一枚（量具认的默认档是 ${JSON.stringify(k.dflt)}）`;
      ok(`U1 ${page}·${name}`, `?${name}=${want} 进站 → 控件 ${ctl}、地址栏仍是 ${showSearch(loc.search)}（两读同档；非默认档「${want}」是从 ${from}）`);
    }
  }
  // 空地址栏基线：骨架给的默认档必须与量具从 `selected` 推出的那一枚同字
  const blanks = [];
  for (const name of SPEC_KEYS[page]) {
    const k = KEYS[page].get(name);
    await goto(pageUrl(page));
    const ctl = await readCtl(page, k.control, k.kind);
    const expect = k.kind === 'check' ? 'false' : k.dflt;
    if (ctl !== expect) blanks.push(`${name}：骨架默认 ${JSON.stringify(expect)}、空地址栏进站控件 ${JSON.stringify(ctl)}`);
  }
  if (blanks.length) bad('U1', `${page} 的空地址栏基线`, `${blanks.length}/${SPEC_KEYS[page].length} 枚对不上（${blanks[0]}）：量具认的默认档与骨架给的不是同一枚，上面与 U5/U7 那几条「落回默认」的判据全部失去基准`);
  else ok(`U1 ${page}·空地址栏`, `${SPEC_KEYS[page].length} 枚控件在裸 URL 下都停在骨架那一档（${SPEC_KEYS[page].map((n) => `${n}=${KEYS[page].get(n).dflt}`).join(' ')}）——默认档基准与骨架同字`);
}

// ── U2 非法值忽略、别人的参数与那枚非法值都不抹 ─────────────────────────────
group('U2 非法值忽略、别人的参数与那枚非法值都不抹');
{
  const cases = [
    // 故意用「像档位又不是档位」的串：白名单写宽了才认得出区别
    { page: 'json', name: 'jt-view', raw: 'treeish' },
    { page: 'diff', name: 'df-mode', raw: 'treeish' },
    // spec §2 第三口径：写侧从不产 `0`，所以 `0` 是「没人说话」而不是「未勾选」，一律进 ignored
    { page: 'diff', name: 'df-ws', raw: '0' },
  ];
  for (const cs of cases) {
    const k = KEYS[cs.page].get(cs.name);
    const search = `${cs.name}=${encodeURIComponent(cs.raw)}&keep=1&utm_source=x`;
    await goto(pageUrl(cs.page, search));
    const ctl = await readCtl(cs.page, k.control, k.kind);
    const loc = await readLoc();
    const expect = k.kind === 'check' ? 'false' : k.dflt;
    const foreign = loc.search.includes('keep=1') && loc.search.includes('utm_source=x');
    const kept = qof(loc.search, cs.name) === cs.raw;
    if (ctl !== expect) {
      bad('U2', `${cs.page} 的「${cs.name}=${cs.raw}」不采纳`, `控件落到了 ${JSON.stringify(ctl)}（默认档是 ${JSON.stringify(expect)}）：白名单门被写宽了，地址栏里任何一串都能当档位`);
    } else if (!foreign) {
      bad('U2', `${cs.page} 的别人的参数没抹`, `进站带 ${JSON.stringify(search)}，地址栏读回 ${showSearch(loc.search)}：keep / utm_source 少了——别人往落地页塞的参数被这一页洗掉了`);
    } else if (!kept) {
      bad('U2', `${cs.page} 的那枚非法值没抹`, `控件稳稳停在默认档 ${expect}，非法值本身却从地址栏消失了（实读 ${showSearch(loc.search)}）：读侧顺手洗了地址栏，「不采纳」变成了「替用户改链接」`);
    } else {
      ok(`U2 ${cs.page}·${cs.name}`, `?${cs.name}=${cs.raw} 非法 → 控件仍是默认档 ${expect}，而 ${showSearch(loc.search)} 一个字节没动（别人的两枚 + 那枚非法值全在）`);
    }
  }
}

// ── U3 只用 replaceState：history.length 增量 + 页内 pushState 计数 ──────────
group('U3 只用 replaceState（连改 20 次档位）');
{
  /**
   * 两页都**空着输入**连打 20 发——这一格量的就是那条抛出来的路：对比页的 `mode` 换档会先过
   * `compute()`，两边空着必抛 `FieldError`，档位同步因此被挪到了 `finally`（镜像跟控件走，不跟
   * 计算成败走）。如果这里先给两栏铺上内容，那条 `finally` 就永远走不到，U3 量的是「一切顺利时
   * 不 push」，而它该量的是「不论顺利与否都不 push、且照样镜像」。
   */
  const Hammers = ['json', 'diff'];
  for (const page of Hammers) {
    const hm = { page };
    const prefix = PREFIX[hm.page];
    const names = SPEC_KEYS[hm.page];
    await goto(pageUrl(hm.page));
    const before = await readLoc();
    /**
     * 两道读数各自独立：`history.length` 差值是真浏览器的账（后退键会不会先退档位），页内
     * `pushState` 计数直接点名那一只手。**不用** `getEntriesByType('navigation')`——那个条目数
     * 每文档恒 1，`pushState` 不往里加（SP3 spec §11.4 第 3 条记的就是这枚计划级假牙）。
     */
    await evalJs('window.__pushes = 0; (() => { const p = history.pushState.bind(history); history.pushState = function () { window.__pushes += 1; return p.apply(history, arguments); }; return true; })()');
    const seq = [];
    for (let i = 0; i < 20; i += 1) {
      const name = names[i % names.length];
      const k = KEYS[hm.page].get(name);
      // 值在骨架那几档里轮着走，包括落回默认的那一档——删键那一路也跟着量了
      const value = k.kind === 'check' ? i % 2 === 0 : k.options[(i + 1) % k.options.length];
      const got = await setCtl(hm.page, k.control, k.kind, value);
      seq.push(`${name}=${got}`);
      await settleCtl(hm.page, k.control, k.kind, value, 1500);
    }
    const after = await readLoc();
    const pushes = await evalJs('window.__pushes');
    const mine = ownKeys(after.search, prefix);
    if (!mine.length) {
      bad('U3', `${hm.page} 的「确实写过」前置`, `连改 20 次档位（${seq.slice(0, 4).join(' ')}…）之后地址栏里一枚自己的键都没有（实读 ${showSearch(after.search)}）：length 差 0 只是「一次都没写」的另一种说法，这一格会恒真`);
    } else if (after.len !== before.len || pushes !== 0) {
      bad('U3', `${hm.page} 只用 replace`, `改档位前后 history.length ${before.len} → ${after.len}（要差 0），页内 pushState 计数 ${pushes}（要 0）：拨一次下拉就多一条历史，后退键得先退完档位才退得出这一页`);
    } else {
      ok(`U3 ${hm.page}·只用 replace`, `20 次档位改动（${seq[0]}、${seq[1]}、…）→ length ${before.len} 纹丝不动、pushState 计数 0，而地址栏确实写着 ${showSearch(after.search)}（写了 ${mine.length} 枚键却没加一条历史）`);
    }
  }
  /**
   * 抛了也要镜像（只有对比页有这条路）：两边空着把 `mode` 拨到 JSON ——`compute()` 必抛
   * `FieldError`，控件与 `s.mode` 却已经落到 json。同步排在那一发之前的话就跟着一起跳了，
   * 屏幕上下拉指着「JSON」而链接里写着「text」，刷新即回弹。这一格钉的就是「镜像跟控件走」。
   */
  {
    await goto(pageUrl('diff'));
    const got = await setCtl('diff', 'mode', 'select', 'json');
    await until("location.search.includes('df-mode=json')", 2500);
    const loc = await readLoc();
    const line = String(await evalJs(`(document.getElementById('df-status-workbench-bar') || {}).textContent || ''`));
    if (got !== 'json') bad('U3', 'diff·抛了也要镜像', `控件读数 ${JSON.stringify(got)}：这一发没打到 json 档，后面的断言没有基准`);
    // 前提自证：这一格量的是「抛了之后还镜不镜像」，那一次计算若压根没抛，量到的就只是普通同步
    else if (!/比不了|空着/.test(line)) {
      die(`两边空着把 mode 拨到 JSON，状态行读回 ${JSON.stringify(line.slice(0, 40))}：「这一发会抛 FieldError」的前提没成立，这一格量不到「抛了也要镜像」那件事`);
    } else if (qof(loc.search, 'df-mode') !== 'json') {
      bad('U3', 'diff·抛了也要镜像', `控件是 json、状态行也报了「${line.slice(0, 24)}」，地址栏却是 ${showSearch(loc.search)}：档位同步排在那一发计算之后，被抛错一起跳过了——刷新之后下拉回到「文本」，而用户明明没动过它`);
    } else ok('U3 diff·抛了也要镜像', `空输入拨 mode=json → 状态行「${line.slice(0, 24)}」而地址栏照样 ${showSearch(loc.search)}：镜像跟的是控件，不是那一次计算的成败`);
  }
}

// ── U4 别人的键一字不动、顺序不变，我新增的排末尾 ────────────────────────────
group('U4 别人的键一字不动、顺序不变');
{
  const cases = [
    { page: 'json', name: 'jt-indent', control: 'indent', kind: 'select', value: 'four' },
    // layout 那一路只换视图、不重算，两边空着也不抛，是对比页这一发最干净的落点
    { page: 'diff', name: 'df-layout', control: 'layout', kind: 'select', value: 'inline' },
  ];
  for (const cs of cases) {
    await goto(pageUrl(cs.page, 'z=9&keep=1&utm_source=x'));
    const before = await readLoc();
    await setCtl(cs.page, cs.control, cs.kind, cs.value);
    await until(`location.search.includes(${JSON.stringify(`${cs.name}=${cs.value}`)})`, 3000);
    const after = await readLoc();
    const order = [...new URLSearchParams(after.search).keys()];
    const sameOrder = order.slice(0, 3).join('&') === 'z&keep&utm_source';
    const sameVals = qof(after.search, 'z') === '9' && qof(after.search, 'keep') === '1' && qof(after.search, 'utm_source') === 'x';
    const mineLast = order[order.length - 1] === cs.name;
    if (!sameOrder || !sameVals) {
      bad('U4', `${cs.page} 的别人的键`, `进站 ${showSearch(before.search)} → 动一枚档位后 ${showSearch(after.search)}：别人的键少了、值变了或顺序动了（实得键序 ${JSON.stringify(order)}）——「从空 search 起建新串」就是这个形状`);
    } else if (!mineLast) {
      bad('U4', `${cs.page} 的新键排末尾`, `键序 ${JSON.stringify(order)}：我新增的「${cs.name}」不在末尾（实读 ${showSearch(after.search)}）`);
    } else {
      ok(`U4 ${cs.page}·别人的键不动`, `?z=9&keep=1&utm_source=x 动档位之后 → ${showSearch(after.search)}：那三枚逐键同值同序，${cs.name} 新增在末尾`);
    }
  }
}

// ── U5 程序化路径也跟（只挂 change 监听不算全）──────────────────────────────
group('U5 程序化写回档位也跟');
{
  const click = (id) => evalJs(`(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return 'NO-SUCH-BUTTON'; if (el.disabled) return 'DISABLED'; el.click(); return 'CLICKED'; })()`);
  await goto(pageUrl('diff', 'df-layout=inline'));
  const c1 = await click('df-btn-workbench-expand');
  await until(`location.search.includes('df-context=all')`, 3000);
  const afterExpand = await readLoc();
  const ctlNow = await readCtl('diff', 'context', 'select');
  if (c1 !== 'CLICKED') bad('U5', '点「全部展开」', `按钮读数 ${c1}：这一发根本没打到页面上，后面的地址栏断言无从谈起`);
  else if (qof(afterExpand.search, 'df-context') !== 'all') {
    bad('U5', '点「全部展开」', `按钮点了、控件也写到 all 了（实读 ${JSON.stringify(ctlNow)}），地址栏却是 ${showSearch(afterExpand.search)}：这一枚档位是折叠按钮程序化写回的，「挂在 change 上就算全了」那个口径漏了这一条路`);
  } else ok('U5 展开跟到地址栏', `点 df-btn-workbench-expand → ${showSearch(afterExpand.search)}（含 df-context=all；这一发与下拉的「change」共用 retune 那一个出口）`);

  const c2 = await click('df-btn-workbench-reset');
  await until("!location.search.includes('df-context')", 3000);
  const afterReset = await readLoc();
  if (c2 !== 'CLICKED') bad('U5', '点「恢复默认档」', `按钮读数 ${c2}：这一发没打到页面上`);
  else if (ownKeys(afterReset.search, 'df').length) {
    bad('U5', '「恢复默认档」把键删干净', `五枚档位都回默认了，地址栏却还留着 ${showSearch(afterReset.search)}：落回默认必须删键，不然「这一页的默认态」和「停在用户拨过的那一档」在链接上长成一个样子`);
  } else ok('U5 重置删键', `点 df-btn-workbench-reset → 地址栏 ${showSearch(afterReset.search)}：df-context 连同其余档位键一起消失，程序化那条路的两端都跟着`);
}

// ── U6 输入不进地址栏（四页回归锁）─────────────────────────────────────────
group('U6 输入不进地址栏（四页）');
for (const pg of PAGES4) {
  const tok = `ZQX${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  await goto(`${ORIGIN}${BASE}${pg.url}`);
  const filled = await evalJs(`(() => {
    const tok = ${JSON.stringify(tok)};
    const hit = [...document.querySelectorAll('textarea, input[type=text], input[type=search], input[type=checkbox]')]
      .filter((el) => el.id && el.id.startsWith(${JSON.stringify(pg.prefix + '-')}));
    for (const el of hit) {
      if (el.type === 'checkbox') el.checked = true; else el.value = tok;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return { ids: hit.map((el) => el.id), held: hit.filter((el) => el.value === tok).length, texts: hit.filter((el) => el.type !== 'checkbox').length };
  })()`);
  if (!filled.ids.length) die(`${pg.slug} 页里按前缀「${pg.prefix}-」找不到一枚可输入的控件：U6 在这页读不到东西，那条锁是空的`);
  if (!filled.texts) die(`${pg.slug} 页里 ${filled.ids.length} 枚可输入控件没有一枚装得了文本（全是勾选框）：token 无处可打，「href 里没有它」会恒真`);
  if (filled.held !== filled.texts) die(`${pg.slug} 页里 ${filled.texts} 枚文本格只接住了 ${filled.held} 枚 ${tok}：填充没全落地，没接住的那几枚会让这一格变成恒真`);
  const acted = await evalJs(`(() => {
    const sel = [...document.querySelectorAll('select, input[type=checkbox]')].filter((el) => el.id && el.id.startsWith(${JSON.stringify(pg.prefix + '-')}));
    for (const el of sel) {
      if (el.type === 'checkbox') el.checked = !el.checked;
      else if (el.options.length > 1) el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const btn = [...document.querySelectorAll('button')].find((b) => b.id.startsWith(${JSON.stringify(pg.prefix + '-btn-')})
      && !/file|download/.test(b.id) && !b.disabled);
    if (btn) btn.click();
    return { selects: sel.length, btn: btn ? btn.id : null };
  })()`);
  if (!acted.selects && !acted.btn) die(`${pg.slug} 页上既没有档位控件、也没有可按的「${pg.prefix}-btn-」按钮：这一页没有「会重绘的动作」，U6 无从驱动`);
  const loc = await readLoc();
  const allowed = SPEC_KEYS[pg.slug] || [];
  const leaked = ownKeys(loc.search, pg.prefix);
  const beyond = leaked.filter((k) => !allowed.includes(k));
  if (loc.href.includes(tok)) {
    bad('U6', `${pg.slug} 的输入不进地址栏`, `把 ${JSON.stringify(tok)} 铺进 ${filled.held} 枚文本格与 ${filled.ids.length - filled.texts} 枚勾选框、又拨了 ${acted.selects} 枚档位并按下 ${acted.btn}，地址栏里就出现了它（实读 ${showSearch(loc.search)}）：用户粘进来的内容进了链接——分享链接即分享内容`);
  } else if (beyond.length) {
    bad('U6', `${pg.slug} 的名单不许变大`, `地址栏里多出 spec §2 名单之外的键 ${JSON.stringify(beyond)}（这一页的名单是 ${JSON.stringify(allowed)}）：白名单被写宽了，输入框或勾选框那一类控件进了镜像`);
  } else {
    ok(`U6 ${pg.slug}·输入不进地址栏`, `${filled.held}/${filled.texts} 枚文本格（另有 ${filled.ids.length - filled.texts} 枚勾选框按勾选打；含 ${filled.ids.filter((i) => /query|text|payload|read/.test(i)).slice(0, 2).join('、') || '无'}）全打上 ${tok}，拨完 ${acted.selects} 枚档位、按过 ${acted.btn || '没有按钮'}，地址栏 ${showSearch(loc.search)} 里没有它，也没有名单外的键${allowed.length ? `（这一页确实在写镜像：${leaked.length}/${allowed.length} 枚）` : '（这一页本轮不加新键，这一格是回归锁）'}`);
  }
}

// ── U7 落回默认删键 + hash 共存 ────────────────────────────────────────────
group('U7 落回默认删键、与 #hash 共存');
{
  // 锚点用骨架里真存在的 `#main`，不凭空造 `#section-2`：那一枚在这两页的 HTML 里没有落点
  const HASH = '#main';
  await goto(pageUrl('diff', 'df-context=all', HASH));
  const landed = await readLoc();
  const ctl = await readCtl('diff', 'context', 'select');
  if (qof(landed.search, 'df-context') !== 'all' || landed.hash !== HASH) {
    bad('U7', '档位与 hash 共存进站', `带 ?df-context=all${HASH} 进站，实读 ${showSearch(landed.search)} + hash ${JSON.stringify(landed.hash)}：链接里两件事先丢了一件，下面的「重置」读数没有基准`);
  } else if (ctl !== 'all') {
    bad('U7', '档位与 hash 共存进站', `地址栏在，控件却读 ${JSON.stringify(ctl)}（要 all）：带了 ${HASH} 的那条 URL 让进站读没走通`);
  } else {
    const clicked = await evalJs(`(() => { const el = document.getElementById('df-btn-workbench-reset'); if (!el) return 'NO-SUCH-BUTTON'; el.click(); return 'CLICKED'; })()`);
    await until("!location.search.includes('df-context')", 3000);
    const after = await readLoc();
    if (clicked !== 'CLICKED') bad('U7', '点「恢复默认档」', `按钮读数 ${clicked}：这一发没打到页面上`);
    else if (qof(after.search, 'df-context') !== null) {
      bad('U7', '重置删键', `地址栏仍是 ${showSearch(after.search)}：df-context 落回默认档却还写着，「落回默认即删键」那条口径没落地`);
    } else if (after.hash !== HASH) {
      bad('U7', '写地址栏不许洗 hash', `键删掉了，hash 却从 ${HASH} 变成 ${JSON.stringify(after.hash)}：拼 URL 时没带走 location.hash，档位一改就把用户原来盯着的那一节弄丢`);
    } else {
      ok('U7 删键不洗 hash', `?df-context=all${HASH} → 点重置 → 地址栏 ${showSearch(after.search)} + hash ${JSON.stringify(after.hash)}：档位键消失，锚点原样留着（两件事共存）`);
    }
  }
}

console.log(`\n${fails.length ? '✗' : '✓'} 工具页地址栏验证：${fails.length ? `${fails.length} 条红点` : `全绿（${passed} 条）`}｜产物 ${SITE}`);
if (fails.length) for (const f of fails) console.log('  ' + f);
chrome.kill();
MAIN_S.server.close();
process.exit(fails.length ? 1 : 0);
