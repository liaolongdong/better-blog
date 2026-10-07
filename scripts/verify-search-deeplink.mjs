#!/usr/bin/env node
/**
 * 搜索深链 / 输入法 / 多词检索的浏览器验证器（子项目 3 的量具）。
 *
 * 为什么判据必须活在真浏览器里：被验的东西是 `dev/js/editorial.js` 的 `initPalette()` 闭包——
 * 打分、高亮、地址栏同步、组合输入门控全在里面，而 `dev/js/*.js` 每个文件都是一个独立的 vite
 * 入口（见 vite.config.js 的 getDevJsEntries），把它们抽成可 import 的模块会在 `assets/js/`
 * 落一枚孤儿产物。所以这一格只能「在浏览器里驱动真面板，在 Node 里另算一份期望」对账。
 * J5 那条独立实现就是这个用途：它不抄浏览器里的打分逻辑，直接从 search.json 算交集，
 * 两边口径一打架就说明其中一边在撒谎。
 *
 * 用法：
 *   node scripts/verify-search-deeplink.mjs                      # 量本树的 _site
 *   node scripts/verify-search-deeplink.mjs --site=/tmp/sp3/new/_site --head=/tmp/sp3/head/_site
 *   node scripts/verify-search-deeplink.mjs --only=J3            # 只跑编号含该串的那一组
 *
 * 三条房规（都对应过一次真实的假信号）：
 *   1. 端口一律自己抢（`listen(0)`），并把抢到的端口打出来。猜端口会量到上一轮遗留的服务，
 *      那种 A/B 两边读的是同一份旧产物，还一路全绿。
 *   2. 开局自证「服务器吐出来的 editorial.min.js 与磁盘上那份同一个 md5」。对不上就是量具在
 *      端旧产物，后面的每一条判据都不必再看。
 *   3. 1 分钟负载 > 16 直接 exit 2 拒测。这一档管的是「量具自己排不上队」，不是「动效采样不准」
 *      （那是 verify-motion-batch4 那一族的账）；本文件的每一条判据都是**状态**（hidden /
 *      value / 行数 / location.search），一律走 `until()` 轮询到落定或超时，不靠定长 sleep——
 *      定长 sleep 在负载下会把「渲染慢」读成「功能坏了」，那正是房规第 3 条要防的假红。
 *
 * 退出码：0 全绿 / 1 有红点 / 2 环境或量具自己没起来（不算通过，也不算产物缺陷）。
 */
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const a = argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const SITE = path.resolve(opt('site', path.join(REPO, '_site')));
const HEAD_SITE = opt('head', null);
const ONLY = opt('only', null);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = '/better-blog';
const die = (msg) => { console.log(`✗ 环境没起来：${msg}`); process.exit(2); };

if (!fs.existsSync(path.join(SITE, 'index.html'))) die(`产物里没有 ${SITE}/index.html——先跑 npx vite build && bundle exec jekyll build`);
if (!fs.existsSync(CHROME)) die(`认不到 Chrome：${CHROME}`);
const LOAD1 = () => (os.loadavg ? os.loadavg()[0].toFixed(1) : '—');
/**
 * 负载闸门：>16 不许开跑，但先等它落下来再拒绝。
 *
 * 为什么不是"看一眼就走"：这一族判据是 CDP 上的状态读数，高负载下的红可能是采样滞后，
 * 所以拒绝本身是对的。但牙齿那一本要连着跑七八轮，每轮都要新起一个 Chrome——
 * 整机负载是并发会话与 Chrome Helper 的曲线，一轮撞上尖峰就把六刀全报成"没有证据"，
 * 那份读数就白取了。等 90 秒仍在 >16 才退 2，阈值一个字节没动。
 */
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

// ── 静态服务（两棵树：新产物 + 可选的基线产物，A/B 用） ──────────────────────
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
const HEAD_S = HEAD_SITE ? await serve(path.resolve(HEAD_SITE)) : null;
const ORIGIN = `http://127.0.0.1:${MAIN_S.port}`;
const ORIGIN_HEAD = HEAD_S ? `http://127.0.0.1:${HEAD_S.port}` : null;
console.log(`· 量的是 ${SITE}（端口 main=${MAIN_S.port}${HEAD_S ? ` / head=${HEAD_S.port}` : ''}，都是从 0 抢的）`);

/** 磁盘 md5 —— 服务器端点自证的基准。 */
const md5 = (abs) => crypto.createHash('md5').update(fs.readFileSync(abs)).digest('hex');
const MINJS = path.join(SITE, 'assets/js/editorial.min.js');
if (!fs.existsSync(MINJS)) die(`产物里没有 assets/js/editorial.min.js（vite build 没跑？）`);
{
  const want = md5(MINJS);
  const got = await fetch(`${ORIGIN}${BASE}/assets/js/editorial.min.js`).then((r) => r.text())
    .then((t) => crypto.createHash('md5').update(t).digest('hex'));
  if (got !== want) die(`服务端点自证失败：磁盘 md5 ${want} ≠ 服务器吐的 ${got}（量具在端旧产物，后面的判据一条都别信）`);
  console.log(`· 端点自证：editorial.min.js 磁盘与服务器同一份（md5 ${want.slice(0, 12)}，${fs.statSync(MINJS).size}B）`);
}

// ── Node 侧语料 + 测试词自证 ────────────────────────────────────────────────
/**
 * 四个字段是检索的全部作用域，Node 与浏览器算的是同一件事的两种实现，字段口径必须锁死一处。
 */
const FIELDS = (it) => [it.title || '', it.tags || '', it.category || '', it.excerpt || ''];

/**
 * J1 深链用的词必须在语料里**真的有命中**，而 CORPUS 是 J5 的 AND 口径与 J7 的计数口径共用的
 * 唯一一份期望值来源。
 *
 * 为什么要在页外先数一遍：上一版的 J1 用的是「转场」，而 search.json 里一处也没有——
 * 于是 E1 落地之后它仍然红，红出来的是「0 行」，读起来像「深链那次 render 用错了词」，
 * 实际是测试词凭空造的。判据把「语料里没有这个词」错报成「功能坏了」，
 * 这种红比绿更危险：它会指挥人去改本来对的实现。词数不到就 exit 2，这是夹具问题。
 *
 * 为什么从**被测服务器**取而不是从磁盘读：磁盘 md5 那条自证只钉住 editorial.min.js，
 * search.json 那一份如果服务的是上一轮遗留（端口撞车就是这么发生的），磁盘口径就会拿旧集合
 * 去比新渲染，红出来长得像「AND 算错了」。让浏览器与 Node 读同一个 HTTP 端点，这类错位就没门。
 */
const WORD = '搜索';
const CORPUS = await fetch(`${ORIGIN}${BASE}/search.json`).then((r) => {
  if (!r.ok) die(`取 search.json 得到 ${r.status}：语料不在，J1 的命中数与 J5/J7 的独立口径都无从自证`);
  return r.json();
});
if (!Array.isArray(CORPUS)) die(`search.json 取回来不是数组（${Object.prototype.toString.call(CORPUS)}）：语料格式变了，独立口径没法算`);
/** 渲染出来的 href 就是 `BASE_URL + item.url`，用它把行反查回语料条目。 */
const BY_URL = new Map(CORPUS.map((it) => [`${BASE}${it.url}`, it]));
{
  const n = CORPUS.filter((x) => FIELDS(x).join(' ').includes(WORD)).length;
  if (n < 1) die(`测试词「${WORD}」在语料（${CORPUS.length} 条）里命中 ${n} 条——J1 的「有结果行」是恒假，换词或先修语料`);
  console.log(`· 测试词自证：「${WORD}」在这份 search.json（${CORPUS.length} 条，取自被测那台服务器）里有 ${n} 条命中（J1 的判据有料可查）`);
}

// ── Chrome + CDP ────────────────────────────────────────────────────────────
const chromeProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'sdl-chrome-'));
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
let GROUP = '(启动)';
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
/**
 * 轮询到某个页内状态落定，或到点。**为什么不写定长 sleep**：这一族的判据全是状态，
 * 而状态落定的时刻随整机负载走——睡固定 600ms 时，负载高就正好读到中间态，
 * 红出来的是「渲染慢」，报的却是「功能坏了」。tookMs 进读数，慢要能自证是谁的钟慢。
 * @param {string} predicateExpr 页内表达式，取真即落定
 * @param {number} ms 预算（毫秒）
 */
const until = async (predicateExpr, ms = 4000) => {
  const t0 = Date.now();
  for (;;) {
    if (await evalJs(`!!(${predicateExpr})`)) return { settled: true, tookMs: Date.now() - t0 };
    if (Date.now() - t0 >= ms) return { settled: false, tookMs: Date.now() - t0 };
    await wait(80);
  }
};
await S('Network.setCacheDisabled', { cacheDisabled: true });
// 视口自己钉住（headless 的默认视口不是桌面尺寸，不钉的话窄屏档会静默生效），
// 并在 J1 的读数里回读 innerWidth 自证真的驱动了布局。
await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
{
  const w = await evalJs('window.innerWidth');
  if (w !== 1280) die(`视口自证失败：setDeviceMetricsOverride 之后 innerWidth=${w}（要 1280）——断点驱动的显隐都量不准`);
}

// ── 报告器 ──────────────────────────────────────────────────────────────────
const fails = [];
let passed = 0;
const group = (name) => { GROUP = name; if (!ONLY || name.includes(ONLY)) console.log(`\n── ${name}`); };
const ok = (name, detail) => { if (!ONLY || name.includes(ONLY)) { passed += 1; console.log(`  ✓ ${name}：${detail}`); } };
const bad = (name, entry, msg) => { fails.push(`[${name}] ${entry}：${msg}`); console.log(`  ✗ ${name}·${entry}：${msg}`); };
/** 跳过项单独记账：汇总行必须把它念出来，"全绿"与"有一条没量"不能长成一个样子。 */
const skipped = [];

/** 面板此刻能读到的东西：行数与空态是否亮着。 */
const peekPanel = () => evalJs(`({ rows: document.getElementById('cmdk-results').children.length, empty: !document.getElementById('cmdk-empty').hidden })`);

/**
 * 等面板落到「有内容可读」那一态，落定分两道闸，缺一都会把「语料还在路上」读成「这个词搜不到」：
 *   ① ResourceTiming 里出现 search.json——这一条只在**响应落地之后**才进缓冲区；
 *   ② 之后行数与空态连着两次读一样才算稳（间隔 120ms）。
 * 只看「有行或空态」是不够的：J7 那半实测抓到过一次 0 行——空态先亮了一下，
 * 判据于是拿着一张还没填内容的结果去和语料对账，红得像是 AND 少切了一刀（那是量具的账，不是产物的）。
 * @param {number} loadMs 第一道闸的预算
 * @param {number} stableMs 第二道闸的预算
 */
const settlePanel = async (loadMs = 5000, stableMs = 4000) => {
  const loaded = await until("performance.getEntriesByType('resource').some((e) => /\\/search\\.json(\\?|$)/.test(e.name))", loadMs);
  if (!loaded.settled) return { settled: false, tookMs: loaded.tookMs, rows: 0, empty: false, why: `${loaded.tookMs}ms 内页面没取过 search.json，语料不在，结果无从读起` };
  const t0 = Date.now();
  let prev = await peekPanel();
  for (;;) {
    await wait(120);
    const cur = await peekPanel();
    if (cur.rows === prev.rows && cur.empty === prev.empty) return { settled: true, tookMs: Date.now() - t0, rows: cur.rows, empty: cur.empty, why: '' };
    if (Date.now() - t0 > stableMs) {
      return { settled: false, tookMs: Date.now() - t0, rows: cur.rows, empty: cur.empty, why: `结果在 ${Date.now() - t0}ms 里还在变（${prev.rows} → ${cur.rows} 行），量具等不到一个能读的状态` };
    }
    prev = cur;
  }
};

/**
 * 把一批查询铺进面板，走的是用户那条路：点入口按钮 → 写输入框 → 派发 `input` → 等落定。
 *
 * 为什么 J5/J6/J7 用这一条而不是 `?q=` 深链：这三组判的是打分、行数与 <mark> 根数，
 * 与 E1 的入口毫无关系。让它们寄生在深链上，代价是台账归因不动——M1（深链那一步整块摘掉）
 * 实测连带红 10 条，那种「一刀红十格」的红点清单里，注入与旁观者分不开。
 * 拆开之后 M1 只红 J1 与 J4 的前置那一格。
 *
 * 还有一个白捡的好处：J6 的对照树因此可以是 **E1 之前的纯基线**（那棵树读不了 `?q=`，
 * 但输入框照常能搜），单词口径的回归对账不必再挑一棵「已经会深链」的中间产物。
 * J1/J4 仍走深链：它们判的就是深链本身，且 J4 要的前置是「进站就有一批已选中的结果」——
 * 那正是产品自己铺的，不是量具连着点按钮点出来的。
 *
 * @param {string} query 要搜的词（原样进输入框，与用户敲进去的等价）
 * @param {string} origin 哪一棵产物
 */
const setQuery = async (query, origin = ORIGIN) => {
  await goto(`${origin}${BASE}/`);
  const ready = await until("document.querySelector('[data-search-open]') && document.getElementById('cmdk')", 4000);
  if (!ready.settled) return { settled: false, why: `${ready.tookMs}ms 内入口按钮或 #cmdk 没出现` };
  await evalJs(`(() => { document.querySelector('[data-search-open]').click(); return 1; })()`);
  const opened = await until("document.getElementById('cmdk') && !document.getElementById('cmdk').hidden", 2500);
  if (!opened.settled) return { settled: false, why: `点了入口按钮 ${opened.tookMs}ms 面板还关着` };
  await evalJs(`(() => {
      const i = document.getElementById('cmdk-input');
      i.value = ${JSON.stringify(query)};
      i.dispatchEvent(new Event('input', { bubbles: true }));
      return 1;
    })()`);
  return settlePanel();
};

// ══════════════════════════════════════════════════════════════════════════
// J1 深链进站。这一条在 E1 落地之前必须是红的——它就是「失败的测试」，
// 别在写实现之后才补它，那样它连自己防什么都没说清楚。
// ══════════════════════════════════════════════════════════════════════════
group('J1 深链进站：?q= 应当把面板开到「已经搜过」那一态');
{
  await goto(`${ORIGIN}${BASE}/?q=${encodeURIComponent(WORD)}`);
  // 分两段等：先等「面板开没开」落定，再等「结果行或空态」落定。合成一段等的后果是
  // search.json 还在路上就被判成「?q= 没人读」——那是量具的边界，不是产物的缺陷。
  const opened = await until("document.getElementById('cmdk') && !document.getElementById('cmdk').hidden", 2500);
  const listed = opened.settled ? await settlePanel() : { settled: false, tookMs: 0 };
  const s = await evalJs(`(() => {
      const p = document.getElementById('cmdk');
      const i = document.getElementById('cmdk-input');
      const r = document.getElementById('cmdk-results');
      return {
        hasPanel: !!p, hidden: p ? p.hidden : null, bodyCls: document.body.classList.contains('cmdk-open'),
        value: i ? i.value : null, rows: r ? r.children.length : 0,
        marks: r ? r.querySelectorAll('mark').length : 0,
        firstMark: r && r.querySelector('mark') ? r.querySelector('mark').textContent : null,
        innerWidth: window.innerWidth,
      };
    })()`);
  if (!s.hasPanel) bad('J1', '面板标记', '产物里没有 #cmdk——header.html 的 site.search 那一支没发出来，深链无处可开');
  else if (s.hidden) bad('J1', '深链开面板', `#cmdk 仍然 hidden（body.cmdk-open=${s.bodyCls}，等了 ${opened.tookMs}ms）：?q= 没人读`);
  else if (s.value !== WORD) bad('J1', '预填输入框', `期望「${WORD}」，实得 ${JSON.stringify(s.value)}`);
  else if (!listed.settled) bad('J1', '落地即出结果', `面板开了却没读到一份稳定的结果：${listed.why || `${listed.tookMs}ms 内既没有结果行也没有空态——search.json 没被拉，或拉回来解析失败`}`);
  else if (s.rows === 0) bad('J1', '落地即出结果', `空态出来了、0 行，而「${WORD}」在语料里确有命中（上面那条自证数过）：深链那次 render 用的词与输入框里的不是一个`);
  else if (!s.marks) bad('J1', '命中高亮', `${s.rows} 行里一个 <mark> 都没有`);
  else ok('J1 深链进站', `${s.rows} 行 / ${s.marks} 处高亮，首个高亮「${s.firstMark}」（面板 ${opened.tookMs}ms、结果 ${listed.tookMs}ms，视口 ${s.innerWidth}）`);

  // J1 的第二形态：`?q=` 空串不许开面板。这一格是给 E2 兜底的——SearchAction 的 urlTemplate
  // 就是 `?q={search_term_string}`，爬虫请求到空的那一份是正常流量，而端上一整屏遮罩
  // （面板开着 = `body{overflow:hidden}`）对着一个没人在搜的页面，是这一轮唯一还能发生的遮罩误开。
  // 反面判据的「活着」不能靠宽限时间，得有硬凭据：editorial.min.js 是普通阻塞脚本，
  // 而 goto() 等到 readyState=complete 才返回——complete 意味着这个文档的同步脚本全部执行完，
  // boot() 里那一步 preset 判断必然已经跑过。这时候的 hidden=false 才是产物真的开了。
  await goto(`${ORIGIN}${BASE}/?q=`);
  const ready = await evalJs('document.readyState');
  const quiet = await evalJs(`(() => {
      const p = document.getElementById('cmdk');
      const i = document.getElementById('cmdk-input');
      return {
        hidden: p ? p.hidden : null, open: document.body.classList.contains('cmdk-open'),
        value: i ? i.value : null,
        pulls: performance.getEntriesByType('resource').filter((e) => /\\/search\\.json(\\?|$)/.test(e.name)).length,
      };
    })()`);
  if (ready !== 'complete') bad('J1', '空串不开面板', `readyState 还停在 ${JSON.stringify(ready)}：同步脚本没跑完就读「没开」，这一格的绿不算数`);
  else if (!quiet.hidden) bad('J1', '空串不开面板', `?q= 空串把面板开成了 hidden=${quiet.hidden}、body.cmdk-open=${quiet.open}：空查询该是「什么都没发生」，不是一整屏遮罩`);
  else if (quiet.value) bad('J1', '空串不开面板', `面板关着但输入框里留着 ${JSON.stringify(quiet.value)}：上一次查询漏进了这一趟`);
  else if (quiet.pulls) bad('J1', '空串不开面板', `空串这一趟拉了 ${quiet.pulls} 次 search.json：没词就不该去取语料`);
  else ok('J1 空串 ?q= 不开面板', `面板仍 hidden、输入框空、语料请求 ${quiet.pulls} 次（readyState=${ready}，preset 那一步必然已过）`);
}

// ══════════════════════════════════════════════════════════════════════════
// J2 输入同步。带一个额外参数和一个片段进来，验的是「只动 q 这一个键」——
// 地址栏是用户复制粘贴的入口，同步时把 utm_* 或片段吃掉，比不同步更糟。
// 「只准 replace」这一格为什么量 history.length 而不是导航条目数：
// `performance.getEntriesByType('navigation')` 每个文档恒为 1 条，pushState 不往里加，
// 拿它当判据就是一张永远绿的空网（这一格自己就没牙）。session history 的条目数
// 才是 pushState 会 +1、replaceState 不动的那个数。
// ══════════════════════════════════════════════════════════════════════════
group('J2 输入时地址栏跟随（replaceState，且只动 q 这一个键）');
{
  await goto(`${ORIGIN}${BASE}/?utm_source=keep&x=1#frag`);
  const ready = await until("document.querySelector('[data-search-open]')", 4000);
  const before = await evalJs('history.length');
  await evalJs(`(() => { document.querySelector('[data-search-open]').click(); return 1; })()`);
  const opened = await until("!document.getElementById('cmdk').hidden", 2500);
  if (!ready.settled) bad('J2', '入口按钮', '[data-search-open] 没出现——顶栏那颗搜索按钮没渲染，没有入口可就同步');
  else if (!opened.settled) bad('J2', '点按钮开面板', `点了 ${opened.tookMs}ms 面板还关着：J2 验的是手动打开之后的同步，这一步不成就没有后一站`);
  else {
    await evalJs(`(() => {
        const i = document.getElementById('cmdk-input');
        i.value = '动效';
        i.dispatchEvent(new Event('input', { bubbles: true }));
        return 1;
      })()`);
    const synced = await until("new URLSearchParams(location.search).get('q') === '动效'", 3000);
    const a = await evalJs('({ search: location.search, hash: location.hash, len: history.length })');
    const params = new URLSearchParams(a.search);
    if (!synced.settled) bad('J2', 'q 跟随输入', `打字之后 ${synced.tookMs}ms 内地址栏没出现 q=动效，实得 ${JSON.stringify(a.search)}：syncUrl 没接进 input 监听`);
    else if (params.get('utm_source') !== 'keep' || params.get('x') !== '1') bad('J2', '别的参数不许丢', `search=${a.search}：同步把入口带来的参数吃掉了`);
    else if (a.hash !== '#frag') bad('J2', '片段不许被吃掉', `hash=${JSON.stringify(a.hash)}`);
    else if (a.len !== before) bad('J2', '只准 replace', `history.length 从 ${before} 变到 ${a.len}：那一下是 pushState，后退键要先退回上一个词才退得出面板`);
    else ok('J2 输入同步', `search=${decodeURIComponent(a.search)} 保留 utm_source/x/hash，history.length 仍是 ${a.len}（面板 ${opened.tookMs}ms、同步 ${synced.tookMs}ms）`);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// J3 关闭还原。面板是一次性的浮层，关掉之后地址栏必须回到「入口那一份」：
// 留着 q 的话，用户复制这一页的链接发给别人，别人打开是个没人在输入框里的查询串。
// 前面必须先咬住「关闭那一刻地址栏里真的有 q」：不这一条的话，J3 在 syncUrl
// 压根没实现时也是绿的（没有 q 就没什么可抹），绿得毫无牙齿——E1 落地之前它就是红的，
// 红了才说明这一格真的在防「关掉浮层地址栏还挂着查询串」。
// ══════════════════════════════════════════════════════════════════════════
group('J3 关面板把 q 抹回入口地址');
{
  const had = await evalJs('({ search: location.search, hidden: document.getElementById("cmdk").hidden })');
  await evalJs(`(() => { document.getElementById('cmdk-input')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 1; })()`);
  const closed = await until("document.getElementById('cmdk').hidden", 2500);
  const b = await evalJs('({ search: location.search, hash: location.hash })');
  if (had.hidden) bad('J3', '这一格的前置', `派发 Escape 时面板已经是关的（J2 那一站没把面板开着交过来），还原无从谈起`);
  else if (!/[?&]q=/.test(had.search)) bad('J3', '关闭前该有 q', `入口地址 ${JSON.stringify(had.search)} 里没有 q：没有可抹的东西，那下面的「抹干净」就是恒真`);
  else if (!closed.settled) bad('J3', 'Esc 收面板', `派发 Escape 之后 ${closed.tookMs}ms 面板还开着：这一格是 J3 的前置，收不了就没得验还原`);
  else if (/[?&]q=/.test(b.search)) bad('J3', '关闭后不该留 q', `search=${b.search}`);
  else if (!/utm_source=keep/.test(b.search) || b.hash !== '#frag') bad('J3', '还原要回到入口那一份', `search=${b.search} hash=${b.hash}`);
  else ok('J3 关闭还原', `从 ${decodeURIComponent(had.search)} 回到 ${decodeURIComponent(b.search)}${b.hash}（面板 ${closed.tookMs}ms 收起来）`);
}

// ══════════════════════════════════════════════════════════════════════════
// J4 输入法组合保护。两半各有一处必须防的恒真，都是写这一格时才发现的：
//   · 「组合中按 Enter 不许跳」——如果先把拼音串 input 进去再按 Enter，未修复的代码会
//     拿拼音串重绘一次（'piao' 谁都匹配不上），matches 空、activeIndex 变 −1，
//     Enter 于是天然无事可做。那样这一格改坏了也不会红。真实脆弱窗口是
//     compositionstart 之后、第一个 input 落地之前（屏幕上还是上一批结果、
//     activeIndex 指着第一条），所以这里就按那个次序走。
//   · 「组合结束要重绘」——反过来必须换个匹配的串：若 compositionend 不补渲染，
//     屏幕上留着的是拼音串那批（未修复）或 '搜索' 那批（已修复但漏了收尾），
//     都不是「输入框里的词」该有的行数，这一格才分得开。
// ══════════════════════════════════════════════════════════════════════════
group('J4 输入法组合中：Enter 不许跳文章，组合结束要补一次渲染');
{
  // 用深链进站：这样"屏幕上已有一批结果、第一行已选中"这个前置是产品自己铺的，
  // 不是量具连着点按钮点出来的。
  await goto(`${ORIGIN}${BASE}/?q=${encodeURIComponent(WORD)}`);
  const before = await settlePanel();
  const b = await evalJs('({ path: location.pathname, rows: document.getElementById("cmdk-results").children.length, active: !!document.querySelector(".cmdk-item.is-active") })');
  if (!before.settled || b.rows === 0 || !b.active) {
    bad('J4', '这一格的前置', `进站后 ${before.tookMs}ms 内没有已选中的结果行（rows=${b.rows}${before.why ? `；${before.why}` : ''}）：Enter 无处可跳，两半判据都会恒真`);
  } else {
    await evalJs(`(() => {
        const i = document.getElementById('cmdk-input');
        i.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true }));
        return 1;
      })()`);
    const afterEnter = await evalJs('({ path: location.pathname })');
    if (afterEnter.path !== b.path) {
      bad('J4', '组合中按 Enter', `跳到 ${afterEnter.path} 了——那一下是「确认候选词」，不是打开第一条结果`);
      // 已经离开这一页了，后半格与收尾断言都读不到东西：先跳回首页再各跑一遍自己的前置，
      // 否则后面的红点全是"页面没了"这一条的复述。
      await goto(`${ORIGIN}${BASE}/`);
    } else {
      ok('J4 组合中 Enter 不跳转', `地址仍在 ${afterEnter.path}（屏幕上是进站那批 ${b.rows} 行，activeIndex 指着第 1 条却没被打开）`);
      await evalJs(`(() => {
          const i = document.getElementById('cmdk-input');
          i.value = 'piao';
          i.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          return 1;
        })()`);
      const during = await evalJs('({ rows: document.getElementById("cmdk-results").children.length, q: new URLSearchParams(location.search).get("q") })');
      if (during.rows !== b.rows) bad('J4', '组合中不重绘', `拼音串 'piao' 一进去，结果行从 ${b.rows} 变成 ${during.rows}：候选词还没选定就重排，打字看着像在闪`);
      else if (during.q !== WORD) bad('J4', '组合中地址栏也不许跟', `q=${JSON.stringify(during.q)}：拼音串写进地址栏，复制链接出去就是一串没选的候选字母`);
      else ok('J4 组合中不重绘', `输入框已是 'piao'，结果行仍是 ${during.rows} 行、地址栏仍是 q=${during.q}`);
      await evalJs(`(() => {
          const i = document.getElementById('cmdk-input');
          i.value = '飘';
          i.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
          return 1;
        })()`);
      const ended = await until(`document.getElementById('cmdk-results').children.length !== ${b.rows}`, 4000);
      const a = await evalJs('({ rows: document.getElementById("cmdk-results").children.length, value: document.getElementById("cmdk-input").value, q: new URLSearchParams(location.search).get("q"), emptyShown: !document.getElementById("cmdk-empty").hidden })');
      if (a.value !== '飘') bad('J4', '组合结束后的输入框', `期望「飘」，实得 ${JSON.stringify(a.value)}`);
      else if (!ended.settled) bad('J4', '组合结束要补渲染', `compositionend 之后 ${ended.tookMs}ms 屏幕上还是进站那 ${a.rows} 行：候选词落定了却不重算，用户看到的是上一个词的结果`);
      else if (a.q !== '飘') bad('J4', '组合结束要同步 URL', `q=${JSON.stringify(a.q)}（要「飘」）：整场组合都被 input 守护拦着，收尾这一步不补同步，地址栏就停在进站那个词上`);
      else ok('J4 组合结束出结果', `「飘」→ ${a.rows} 行（空态=${a.emptyShown}），地址栏 q=${decodeURIComponent(a.q)}`);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// J5 多词 AND。期望集合在 Node 里**另算一遍**，不是把 editorial.js 里那段逻辑抄第二遍：
// 口径是「四个字段里存在一个包含该词（不区分大小写）就算这个词命中，词与词之间取交集」。
// 两边独立才对得上——抄一遍的话实现错在哪，量具就跟着错在哪。
//
// 用例是本会话里对着这一份 search.json 数出来的，不是凭空写的（上一版就凭空写了「转场」，
// 语料里一处也没有，功能做对了判据照样红）：diff 单独 3 条、工具 单独 21 条，
// 两者同取却是 0 条——这一条只有 AND 能过，OR 会给出 3 条，所以它是这一族的门闩。
// ══════════════════════════════════════════════════════════════════════════
group('J5 多词查询：结果集合等于 Node 侧独立算出的 AND 交集');
{
  const andSet = (query) => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return CORPUS
      .filter((it) => terms.every((t) => FIELDS(it).some((f) => f.toLowerCase().includes(t))))
      .map((it) => `${BASE}${it.url}`);
  };
  const QUERIES = ['浏览器 插件', '插件 浏览器', '性能 缓存', 'diff 工具', 'zzz不存在词 搜索', '输入法 中文', '工具'];
  for (const query of QUERIES) {
    const settled = await setQuery(query);
    const got = await evalJs(`(() => {
        const r = document.getElementById('cmdk-results');
        return { n: r.children.length, hrefs: [...r.children].map((li) => li.querySelector('a').getAttribute('href')) };
      })()`);
    const want = andSet(query);
    if (!settled.settled) bad('J5', query, `没落定：${settled.why}`);
    else if (got.n > 20) bad('J5', query, `返回 ${got.n} 行，超过 20 的上限`);
    else if (want.length > 20) ok('J5 多词集合', `「${query}」→ ${got.n} 行（独立口径 ${want.length} 条 > 20，只断言不越界：面板本来就有 top-20 截断）`);
    else if (want.length && got.n !== want.length) {
      const missing = want.filter((u) => !got.hrefs.includes(u));
      const extra = got.hrefs.filter((u) => !want.includes(u));
      bad('J5', query, `独立口径 ${want.length} 条、面板 ${got.n} 行（缺 ${missing.length}：${missing.slice(0, 2).join(' , ') || '无'}；多 ${extra.length}：${extra.slice(0, 2).join(' , ') || '无'}）——OR 会在这里给出比 AND 多的行`);
    } else if (!want.length && got.n) bad('J5', query, `独立口径判它零命中，面板却给了 ${got.n} 行——AND 没生效`);
    else ok('J5 多词集合', `「${query}」→ ${got.n} 行，与独立口径逐条相等（落定 ${settled.tookMs}ms）`);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// J6 单词回归对账。多词是新加的，单词不许变：把八个单词查询同时打在 HEAD 产物与本轮产物上，
// 逐条比 href 数组（含顺序）。顺序也在乎——评分公式一动，排名就动，而用户看得见的是顺序。
//
// 没有 --head= 时这一条**跳过**并计入汇总，不报绿也不报红。写成红的话基线那一跑
// 就恒红（牙齿那一本拿它当"注入前必须全绿"的门），写成绿的话就是"没量的东西算量过了"。
// 这八个词都是数过有命中的（搜索 4 / 性能 5 / 面试 5 / 浏览器 12 / 插件 6 / diff 3 /
// 缓存 2 / nginx 2）：两边都 0 行的等序是恒真，抓不到任何东西。
// ══════════════════════════════════════════════════════════════════════════
group('J6 单词回归：结果集与顺序对 --head= 那棵树逐条相等');
{
  const WORDS = ['搜索', '性能', '面试', '浏览器', '插件', 'diff', '缓存', 'nginx'];
  if (!ORIGIN_HEAD) {
    skipped.push('J6 单词回归（需要 --head=<上一棵产物的路径>，本轮没有可比的树）');
    console.log(`  — J6 跳过：没有 --head=，单词口径无从对比（不计绿也不计红）`);
  } else {
    const probe = async (origin, w) => {
      const st = await setQuery(w, origin);
      if (!st.settled) return { settled: false, why: st.why, hrefs: [] };
      return { settled: true, hrefs: await evalJs(`[...document.getElementById('cmdk-results').children].map((li) => li.querySelector('a').getAttribute('href'))`) };
    };
    for (const w of WORDS) {
      const a = await probe(ORIGIN, w);
      const b = await probe(ORIGIN_HEAD, w);
      if (!a.settled) bad('J6', `单词「${w}」的新产物`, `没落定：${a.why}`);
      else if (!b.settled) bad('J6', `单词「${w}」的对照树`, `没落定：${b.why}——对照树那一头连结果都铺不出来，等序判据无从对账`);
      else if (JSON.stringify(a.hrefs) !== JSON.stringify(b.hrefs)) {
        bad('J6', `单词「${w}」`, `新 ${a.hrefs.length} 行 vs 旧 ${b.hrefs.length} 行，前三条：新 ${a.hrefs.slice(0, 3).join('|') || '（空）'} ≠ 旧 ${b.hrefs.slice(0, 3).join('|') || '（空）'}`);
      } else ok('J6 单词口径未变', `「${w}」${a.hrefs.length} 行逐条等序`);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// J7 高亮逐处、逐词。<mark> 的**根数**在 Node 侧独立数出来，跟浏览器渲染的那一份对账。
//
// 为什么 J1 那条「这批行里有 <mark>」不够：把 `while ((m = re.exec(s)))` 写成 `if (...)`，
// 第一处高亮照样在，只有第二处丢——J1 看不出差别，用户却看得到「标题里同一个词只亮了一半」，
// 而他心里的疑问正是「这条凭什么被搜到」，高亮就是回答那一问的。
// 反过来 `terms.map(escRe).join('|')` 少切一支时 J5 也抓不到（它比的是集合，高亮不参与，
// 第二个词照样把整条筛进结果里），所以高亮这一族得自己有一格。
//
// 夹具先在 CORPUS 里自证，数不到就 exit 2——那是量具的账，不是产物的账（凭空的「转场」吃过一次）：
//   · 逐处：「微信内部浏览器H5支付(JSAPI支付)和微信外部浏览器H5支付总结」标题里「浏览器」写了两遍；
//   · 逐词：「浏览器 插件」交集 3 条里含「超好用的 chrome 浏览器插件推荐（外语阅读困难者福音）」，
//     标题同时含这两个词，摘要里另有 6 个「插件」。
// 计数口径是 `split(term).length − 1`：非重叠、从左到右，与页内那条 `gi` 正则同一种走法。
// 并列的词之间不许有包含关系（「搜索」与「搜索引擎」同查时长的先吃掉短的，根数必然对不上），
// 所以这一条先把夹具钉在那条之外。
// ══════════════════════════════════════════════════════════════════════════
group('J7 高亮逐处、逐词：<mark> 根数对账 Node 侧独立计数');
{
  const REP = '浏览器';
  const PAIR = ['浏览器', '插件'];
  const occ = (text, term) => String(text).toLowerCase().split(term).length - 1;
  const repHit = CORPUS.filter((it) => FIELDS(it).some((f) => f.toLowerCase().includes(REP)));
  const repTwin = CORPUS.filter((it) => occ(it.title, REP) >= 2);
  const andHit = CORPUS.filter((it) => PAIR.every((t) => FIELDS(it).some((f) => f.toLowerCase().includes(t))));
  const andShown = andHit.filter((it) => PAIR.every((t) => occ(`${it.title}\n${it.excerpt}`, t) >= 1));
  if (PAIR.some((a) => PAIR.some((b) => b !== a && b.includes(a)))) die(`J7 夹具：「${PAIR.join(' ')}」里有词互相包含，逐词计数不成立`);
  if (!repTwin.length) die(`J7 夹具：${CORPUS.length} 条语料里没有一条标题把「${REP}」写两遍，逐处高亮无从可验`);
  if (repHit.length > 20) die(`J7 夹具：「${REP}」命中 ${repHit.length} 条 > 20，top-20 会截断，标题重复那条可能在截断区外`);
  if (!andShown.length) die(`J7 夹具：「${PAIR.join(' ')}」交集 ${andHit.length} 条里没有一条标题+摘要同时含这两个词，逐词高亮无从可验`);
  console.log(`  · 夹具自证：「${REP}」有 ${repTwin.length} 条标题写了两遍（该词命中 ${repHit.length} 条，不触发截断）；「${PAIR.join(' ')}」交集 ${andHit.length} 条里 ${andShown.length} 条两词都落在可见文本上`);

  const readRows = () => evalJs(`(() => {
      const out = [];
      for (const li of document.getElementById('cmdk-results').children) {
          const t = li.querySelector('.cmdk-item-title');
          const s = li.querySelector('.cmdk-item-snippet');
          out.push({
              href: li.querySelector('a').getAttribute('href'),
              title: t ? t.textContent : '',
              snippet: s ? s.textContent : '',
              titleMarks: t ? [...t.querySelectorAll('mark')].map((m) => m.textContent) : [],
              rowMarks: [...li.querySelectorAll('mark')].map((m) => m.textContent),
          });
      }
      return out;
  })()`);

  // (a) 同一词在一行里出现两次：两处都得包起来。
  const st = await setQuery(REP);
  if (!st.settled) bad('J7', '逐处那一半的前置', `「${REP}」打完字没落定（${st.why || `${st.tookMs}ms`}），根数无从读起`);
  else {
    const rows = await readRows();
    const eaten = [];
    for (const r of rows) {
      const src = BY_URL.get(r.href);
      if (!src) eaten.push(`${r.href} 在语料里反查不到`);
      else if (r.title !== (src.title || '')) eaten.push(`${r.href}：渲染出的标题 ${JSON.stringify(r.title)} ≠ 语料 ${JSON.stringify(src.title)}`);
    }
    if (eaten.length) bad('J7', '高亮不许吃字', `${eaten.length}/${rows.length} 行的标题文本与语料不等（第一条：${eaten[0]}）：包 <mark> 时把文本切出了缺口`);
    else ok('J7 高亮不吃字', `${rows.length} 行的标题 textContent 与语料逐字相等——插进 <mark> 不许多不许少一个字符`);

    const twins = rows.filter((r) => occ(r.title, REP) >= 2);
    if (!twins.length) bad('J7', '逐处那一半的前置', `渲染的 ${rows.length} 行里没有一行标题把「${REP}」写两遍，而语料侧有 ${repTwin.length} 条：这一格读不到东西，判据会恒真`);
    else {
      const short = twins.filter((r) => r.titleMarks.length !== occ(r.title, REP) || r.titleMarks.some((m) => m.toLowerCase() !== REP));
      if (short.length) bad('J7', '同一词逐处高亮', `「${short[0].title.slice(0, 32)}」里「${REP}」出现 ${occ(short[0].title, REP)} 次，标题栏却只有 ${short[0].titleMarks.length} 处 <mark>（实得 ${JSON.stringify(short[0].titleMarks)}）：exec 循环被写成单次，第二处丢了`);
      else ok('J7 同一词逐处高亮', `${twins.length} 行标题各含「${REP}」${twins.map((r) => occ(r.title, REP)).join('/')} 次，每处都包住了（共 ${twins.reduce((s, r) => s + r.titleMarks.length, 0)} 处）`);
    }
  }

  // (b) 两个词并列：第二个词不许因为 alternation 少一支而一整批不亮。
  const st2 = await setQuery(PAIR.join(' '));
  if (!st2.settled) bad('J7', '逐词那一半的前置', `「${PAIR.join(' ')}」打完字 ${st2.tookMs}ms 内结果没落定`);
  else {
    const rows = await readRows();
    const both = rows.filter((r) => PAIR.every((t) => occ(`${r.title}\n${r.snippet}`, t) >= 1));
    if (!both.length) bad('J7', '逐词那一半的前置', `${rows.length} 行里没有一行在标题或摘要里同时留着这两个词（语料侧有 ${andShown.length} 条）：读不到东西，判据会恒真`);
    else {
      const miss = [];
      const counts = PAIR.map((t) => both.reduce((s, r) => s + occ(`${r.title}\n${r.snippet}`, t), 0));
      for (const r of both) {
        const shown = `${r.title}\n${r.snippet}`;
        for (const t of PAIR) {
          const got = r.rowMarks.filter((m) => m.toLowerCase() === t).length;
          if (got !== occ(shown, t)) miss.push(`「${r.title.slice(0, 18)}…」的「${t}」：文本 ${occ(shown, t)} 处、<mark> ${got} 处`);
        }
      }
      if (miss.length) bad('J7', '两个词都要有高亮', `${both.length} 行里 ${miss.length} 处对不上（前三：${miss.slice(0, 3).join('；')}）——alternation 少切一支时，后一个词照样筛得出结果却一处都不亮`);
      else ok('J7 两个词都要有高亮', `${both.length} 行同时含「${PAIR.join(' ')}」：${PAIR[0]} ${counts[0]} 处、${PAIR[1]} ${counts[1]} 处，逐处都有 <mark>`);
    }
  }
}

console.log(`\n${fails.length ? '✗' : '✓'} 搜索深链验证：${fails.length ? `${fails.length} 条红点` : `全绿（${passed} 条）`}${skipped.length ? `｜跳过 ${skipped.length} 条：${skipped.join('；')}` : ''}｜产物 ${SITE}`);
if (fails.length) for (const f of fails) console.log('  ' + f);
chrome.kill();
MAIN_S.server.close();
if (HEAD_S) HEAD_S.server.close();
process.exit(fails.length ? 1 : 0);
