#!/usr/bin/env node
/**
 * 离线层真机核验：真 Chrome + CDP，断网之后逐条问"这一页还读得到吗"。
 *
 * 为什么不能只靠 `scripts/check-sw.mjs`：那一份核的是**清单与口径**（地址存不存在、两边集合
 * 是否相等），它绿着也可能整个 SW 一次都没装上来。离线这件事的最后一公里只有断网才看得见：
 *   - 注册代码在 localhost 被闸门挡掉（那是刻意的，见 editorial.js 的 initOffline 第 3 道闸门），
 *     如果这条闸门写反了，check-sw 全绿而离线一次也没有；
 *   - `networkFirst` 的回落链（文档桶 → 兜底页 → 503）是三段 JS，写错任何一段都不会有构建错误；
 *   - 空闲补全跑不跑得完、跑完之后桶里到底有几条，是只有运行时才知道的数。
 * 所以这一份负责"跑一遍并记下真实读数"，check-sw 负责"改动之后还对不对"。
 *
 * 十格判据：
 *   S1  注册与作用域：scope 恰为 baseurl 根，SW 状态 activated
 *   S2  BB_PONG 回包：三份清单条数与 check-sw 同源，install 失败数为 0
 *   S3  骨架桶齐件（条数 === SHELL 清单条数）
 *   S4  空闲补全跑完（回包 done 为真、文档桶 ≥ DOC 条数、按清单逐条 match 到的封面 ≥ 1、失败 0）
 *   S5  断网读一篇**从未点过**的旧文章：标题与正文体量对得上
 *   S6  断网读一个未收录的地址：503 + 兜底页，不是 200 空页
 *   S7  断网时 feed.xml 直连失败（透传名单生效，缓存不许替订阅源说话）
 *   S8  断网时文章头图可读（封面桶里那张，naturalWidth > 0）
 *   S9  在线回访时 SW 代发资源的 transferSize === 0（这一格顺便解释 localhost 闸门为什么必须存在）
 *   S10 收尾注销： unregister 后三个桶都清干净（不给下一轮留状态）
 *
 * 用法：node scripts/verify-sw-offline.mjs
 * 前置：先 `bundle exec jekyll build`（这份核验读的是 `_site/`，且自带静态服务挂在 /better-blog 下）
 * 失败形状：任一格 ✗ 即 exit 1，末尾给通过数与关键读数；断网自证没过则 exit 2（那一轮全部读数作废）。
 *
 * "断网"这件事在这里是**拔服务**实现的，见下面 plugOut 的注释——CDP 的 offline 开关管不到 SW
 * 自己发出的请求，只用它会把"网络还通"量成"离线可用"。
 */
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, '_site');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = '/better-blog';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon' };

/**
 * 从产物 sw.js 里取三份清单与桶名——与 check-sw.mjs 同一取法（沙箱求值常量段），
 * 这里不再抄第二份"有几条"的字面量：抄本一旦过期，核验会变成"按错的期望值断言"。
 * @returns {object} BASE / BUCKET / SHELL_URLS / DOC_URLS / COVER_URLS
 */
function readArtifactManifest() {
  const src = fs.readFileSync(path.join(SITE, 'sw.js'), 'utf8');
  const cut = src.indexOf('function isPassthrough');
  const box = { exports: {} };
  vm.runInNewContext(
    `${src.slice(0, cut)}\nmodule.exports={BASE,BUCKET,SHELL_URLS,DEFERRED_URLS,DOC_URLS,COVER_URLS};`,
    { module: box, exports: box.exports },
  );
  return box.exports;
}
if (!fs.existsSync(path.join(SITE, 'sw.js'))) {
  console.error('✗ 产物里没有 _site/sw.js，先跑 bundle exec jekyll build');
  process.exit(2);
}
const MF = readArtifactManifest();

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.once('listening', () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
    probe.listen(0, '127.0.0.1');
  });
}
const PORT = await freePort();

/** 静态服务：与 verify-idcard-browser.mjs 同一份挂法（产物里的 baseurl 就是这一段） */
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(SITE, p);
  if (!f.startsWith(SITE)) { res.writeHead(403); return res.end('403'); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(path.join(f, 'index.html'))); }
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('404 ' + p); }
  res.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8', 'cache-control': 'no-store' });
  res.end(fs.readFileSync(f));
});
// 已建立的连接要能一把掐掉，见下面 plugOut 的注释
const liveSockets = new Set();
server.on('connection', (s) => { liveSockets.add(s); s.on('close', () => liveSockets.delete(s)); });
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

/**
 * 断网的手段：把这个静态服务**关掉**，而不是只用 CDP 的 offline 开关。
 *
 * 为什么不能只靠 `Network.emulateNetworkConditions({offline:true})`：这条命令的作用域是**页面
 * 所在的那个 session**，SW 自己 `fetch()` 出去的请求不受它约束——2026-09-28 第二轮就是这么暴露的：
 * 标着"断网"的那一轮里，`/page3/`（没进清单）返回的是 200 加**真的第 3 页正文**，说明
 * `networkFirst` 的那次回源成功了，回落链整条没被走到，S5/S8 那两格读的是网络而不是桶。
 * 关掉监听 + 掐断所有已建立的 socket，Origin 对页面和 SW 是同一个"到不了"，这时候任何一格
 * 出现 200 都只能来自 Cache Storage——判据这才叫"离线可用"。
 *
 * 只 `server.close()` 不够：它只停止接受新连接，Chrome 的 keep-alive 长连接会留着，
 * 而且 close 的回调要等这些连接自然结束才触发（这里不等它，直接把 socket 拆了）。
 * @returns {Promise<void>}
 */
async function plugOut() {
  server.close(() => {});
  for (const s of liveSockets) s.destroy();
  liveSockets.clear();
  await new Promise((r) => setTimeout(r, 150));
}
/** 恢复服务：S9 要的是"在线回访"，端口原地重开（同一 PORT，地址不变，SW 不受影响）。 */
async function plugBack() {
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-offline-'));
/**
 * 这一族启动参数做的事只有一件：**让首屏不再等站外的回答**。
 *
 * 为什么要管站外：`goto` 等的是 `document.readyState === 'complete'`，而 complete 要等页面上
 * **每一件子资源**收场——包括本站那几枚统计信标。2026-09-28 在同一台机器上量过三次：
 *   - 什么都不摘：navigate → complete **11,090ms**，其中 `http://s.360.cn/so/zz.gif` 一件占 **10,181ms**，
 *     其余最慢的 waline 请求 767ms；
 *   - 只给统计域名写 `--host-resolver-rules=MAP 域名 127.0.0.1`：**没用**，那一轮 360 那件还是 10,374ms。
 *     再单独做一次判别实验钉死为什么：把 `s.360.cn` 指到**这一族自己那台会秒回 404 的静态端口**上，
 *     结果静态服务收到的非本站请求是 **0 条**，而那一件照样 10,306ms（transferSize 0），15 秒内
 *     `complete` 根本没落定。也就是说这台机器开着系统代理（127.0.0.1:65532）时，**走代理的请求由
 *     代理去解析域名，Chrome 本地的 resolver rules 一条都不参与**——它不报错、参数照单收下，
 *     看起来像生效了，实际什么都没拦住。所以只写规则这一路不能用来降噪；
 *   - `--proxy-server=direct://` 加 `--host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"`：
 *     **1,583ms**，pending 0，最慢的几件变成站点自己的 realtime-draggable.min.js 826ms /
 *     editorial.min.js 823ms / index.min.js 685ms。同一 profile 第二次访问（SW 已接管）**216ms**。
 *     强制直连之后解析回到本地，`~NOTFOUND` 是"解析不出来"而不是"连上去等人回话"，所以它是秒失败。
 *
 * 也就是说这一格的 24 秒预算名义上很宽，实际上被一个与本站无关、也不受本机控制的第三方端点支配：
 * 它哪天回话慢于 24 秒，核验就红一条与离线层毫无关系的"加载超时"——2026-09-28 那条没能复现的
 * 超时就是这个形状。十格判据里没有一格断言统计脚本或阅读量（S1–S10 断的是 scope、清单、桶、
 * 503 兜底、透传、transferSize），cross-origin 的请求 SW 本来也一律不缓存（sw.js 的 opaque 分支），
 * 所以这里摘掉的是环境噪声，不是判据；`EXCLUDE 127.0.0.1` 保住了这一族自己的静态服务。
 */
const chrome = spawn(CHROME, ['--headless', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--disable-gpu', '--no-first-run', '--disable-background-networking', '--window-size=1280,900',
  '--proxy-server=direct://', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'],
{ stdio: ['ignore', 'ignore', 'pipe'] });
/**
 * 崩了也要收尾：中途抛错若只让 Node 退出，headless Chrome 会留在机器上，下一轮就多一个抢资源的
 * 遗留进程——这一条纪律本身是对的（2026-09-28 那次确实崩在 CDP 参数名上、留下了没被 kill 的 Chrome）。
 * 但同一天那条"加载超时"**不是**抢 CPU 抢出来的，根因见上面那段量出来的三个数。
 */
function teardown() {
  try { chrome.kill(); } catch { /* 已经退了 */ }
  try { server.close(); } catch { /* 没起来 */ }
}
process.on('exit', teardown);
process.on('uncaughtException', (err) => {
  console.error(`✗ 核验中途异常退出：${err && err.stack ? err.stack : err}`);
  teardown();
  process.exit(2);
});
const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  const timer = setTimeout(() => reject(new Error('20s 内没读到 DevTools listening 那行 stderr')), 20000);
  const onExit = () => reject(new Error(`Chrome 子进程提前退出（pid ${chrome.pid}）`));
  chrome.once('exit', onExit);
  chrome.stderr.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    const m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(buf);
    if (m) { clearTimeout(timer); resolve(m[1]); }
  });
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
const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p = {}) => c.send(m, p, sessionId);
console.log(`# Chrome pid=${chrome.pid}\n# 静态服务 http://127.0.0.1:${PORT}${BASE}`);
const evalJs = async (expression) => {
  const r = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    throw new Error('页内异常：' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)
      + ' @ ' + expression.replace(/\s+/g, ' ').slice(0, 80));
  }
  return r.result.value;
};
const URL_OF = (p) => `http://127.0.0.1:${PORT}${BASE}${p}`;
/**
 * 首屏落不下来的时候，光报"加载超时"等于没报——这一句把还挂在飞行中的地址交出来。
 * 口径：`performance` 的资源条目里 `responseEnd === 0` 就是**没结束**（成功与失败都会写 responseEnd，
 * 所以这一筛只会留下真挂着的，不会把 404 之类已结束的算进来）。
 * @returns {Promise<string>} 一条人读的现场描述
 */
const stallReport = async () => evalJs(`(() => {
  const rs = performance.getEntriesByType('resource');
  const pending = rs.filter((e) => !e.responseEnd).map((e) => e.name.slice(0, 120));
  const done = rs.length - pending.length;
  return 'readyState=' + document.readyState + ' · 资源 ' + rs.length + ' 条（已结束 ' + done +
    '，挂着 ' + pending.length + '）· 挂着的：' + (pending.slice(0, 6).join(' | ') || '无');
})()`);
const goto = async (url) => {
  await S('Page.navigate', { url });
  // 上限给到 ~24 秒。摘掉站外依赖之后这一族首屏实测 1,583ms（SW 接管后的回访 216ms，见上面
  // 启动参数那段），所以 24 秒是 15 倍余量——真到了用满预算的地步，不会是"机器慢"，而是某个请求
  // 挂着不返回；那时由下面的 stallReport 点名是哪一个，不靠猜。
  for (let i = 0; i < 400; i += 1) {
    if ((await evalJs('document.readyState')) === 'complete') return;
    await new Promise((r) => setTimeout(r, 60));
  }
  throw new Error('加载超时：' + url + ' —— ' + (await stallReport().catch(() => '连现场诊断都取不到（页面已不可评值）')));
};
await S('Page.enable'); await S('Runtime.enable'); await S('Network.enable');
await S('Network.setCacheDisabled', { cacheDisabled: true });
await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

const results = [];
const check = (id, pass, detail) => { results.push({ id, pass }); console.log(`${pass ? '✓' : '✗'} ${id} — ${detail}`); };

/* ── S1 注册与作用域 ─────────────────────────────────────────── */
// 首访带 ?swdev=1：editorial.js 的第 3 道闸门在 localhost 上默认不注册，这是唯一的开门方式
await goto(URL_OF('/?swdev=1'));
// 桶名、清单条数这些读数都来自 activate 之后的 SW，所以这里要等状态真的走到 activated：
// 只等 `serviceWorker.ready` 落定就一次性读 `active.state`，会拿到 'activating'（2026-09-28 第一轮的假红）。
let reg = { scope: '', state: 'none', controller: false };
for (let i = 0; i < 60; i += 1) {
  reg = await evalJs(`navigator.serviceWorker.ready.then((r) => ({
    scope: r.scope, state: r.active ? r.active.state : 'none', controller: !!navigator.serviceWorker.controller }))`);
  if (reg.state === 'activated') break;
  await new Promise((r) => setTimeout(r, 250));
}
// 作用域是 baseurl 那一段**带尾斜杠**的完整地址，而 `URL_OF('/')` 自己就带上那一个斜杠：
// 再拼一次成 `/better-blog//`，会把"注册在 /better-blog/ 下"这件对的事读成错（第二轮的假红）。
// controller 首访为 false 是正常的（注册发生在这一页的导航之后），只在回包里记一笔，不作判据。
check('S1 注册与作用域', reg.scope === URL_OF('/') && reg.state === 'activated',
  `scope=${reg.scope} 期望=${URL_OF('/')} state=${reg.state}（controller 就位=${reg.controller}）`);

/* ── S2 BB_PONG ──────────────────────────────────────────────── */
/** 问一次 SW 的自检回包（S2 与 S4 都用它，两处断言的是回包里的不同字段） */
const askPong = () => evalJs(`new Promise((res) => {
  const w = navigator.serviceWorker;
  const h = (e) => { if (e.data && e.data.type === 'BB_PONG') { w.removeEventListener('message', h); res(e.data); } };
  w.addEventListener('message', h);
  w.ready.then((r) => r.active.postMessage({ type: 'BB_PING' }));
  setTimeout(() => res({ type: 'timeout' }), 5000);
})`);
const pong = await askPong();
const counts = pong.counts || {};
check('S2 BB_PONG 回包', pong.type === 'BB_PONG' && counts.shell === MF.SHELL_URLS.length
  && counts.doc === MF.DOC_URLS.length && counts.cover === MF.COVER_URLS.length && pong.failed === 0,
  `counts=${JSON.stringify(counts)} install 失败=${pong.failed} build=${pong.build} 版本=${pong.version}`);

/* ── S3 骨架桶 ───────────────────────────────────────────────── */
const bucketNames = pong.buckets || Object.values(MF.BUCKET);
const sizeOf = (name) => evalJs(`caches.open(${JSON.stringify(name)}).then((c) => c.keys().then((k) => k.length))`);
const [shellName, docName, imgName] = bucketNames;
const shellN = await sizeOf(shellName);
check('S3 骨架桶齐件', shellN === MF.SHELL_URLS.length, `${shellN} / ${MF.SHELL_URLS.length} 件（桶 ${shellName}）`);

/**
 * 封面清单里有多少张真在桶里。
 * 只数 `img` 桶的条目不够：首页正文里的缩略图是 `destination: image`，走 cacheFirst 也会写进
 * 同一个桶（2026-09-28 那一轮"5 张"里有 1 张就是这么来的），所以按清单逐条 match 才是封面数。
 * @returns {Promise<number>} 命中的封面条数
 */
const coverHits = () => evalJs(`(async () => {
  const cache = await caches.open(${JSON.stringify(imgName)});
  const list = ${JSON.stringify(MF.COVER_URLS)};
  let n = 0;
  for (const u of list) { if (await cache.match(u)) n += 1; }
  return n;
})()`);

/* ── S4 空闲补全跑完 ─────────────────────────────────────────── */
// 等的是回包里的 `done`（队列走到底）或 `stop`（整批文档失败、判定已经离线而早停），
// 不是"文档桶凑满就抄读数"：封面排在队列后半段，凑满那一刻它才跑到一半——
// 同一份产物两次分别抄到 12 张与 5 张，差的只是采样时刻。
const DEADLINE = Date.now() + 240000;
let pong2 = { type: 'timeout' };
while (Date.now() < DEADLINE) {
  pong2 = await askPong();
  if (pong2.done || pong2.stop) break;
  await new Promise((r) => setTimeout(r, 1500));
}
const docN = await sizeOf(docName);
const imgN = await sizeOf(imgName);
const coverN = await coverHits();
check('S4 空闲补全跑完', !!pong2.done && !pong2.stop && docN >= MF.DOC_URLS.length
  && coverN >= 1 && (pong2.fillErr || 0) === 0 && (pong2.putErr || 0) === 0,
  `落定=${pong2.done ? '队列走完' : (pong2.stop || '没落定（超时）')} · 文档桶 ${docN}/${MF.DOC_URLS.length}`
  + ` · 封面入桶 ${coverN}/${MF.COVER_URLS.length} 张（记账 ${pong2.coverBytes}B / 预算 2,621,440B，图桶另有 ${imgN - coverN} 件是正文图随浏览进的）`
  + ` · 写入 ${pong2.filled} 条 · 跳过 ${pong2.skipped} 张 · 补全失败 ${pong2.fillErr || 0} 次${pong2.fillWhy ? `（首条：${pong2.fillWhy}）` : ''}`
  // 运行期写桶（networkFirst / cacheFirst 那两处）撞配额或体被提前读走时，以前在读数上是
  // 完全隐形的——它只往 SW 控制台丢一条 unhandled rejection。putErr 把这一族变成可判据的数。
  + ` · 运行期写桶失败 ${pong2.putErr || 0} 次${pong2.putWhy ? `（首条：${pong2.putWhy}）` : ''}`);

/* ── 断网：S5 起 ─────────────────────────────────────────────── */
// 页面的 offline 状态用 CDP 设（参数名是 downloadThroughput / uploadThroughput，写成 *Threshold
// 会被以 Invalid parameters 直接退回——2026-09-28 第一轮在这里崩，后面五格整批没跑）；
// Origin 的到不了靠 plugOut 关服务。两者都要，缺一个就不是这一格要的场景。
await S('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
await plugOut();
// 先自证"这一轮真的断到了"：页面直连一个没进任何桶的地址必须失败。它要是还能通，
// 后面 S5/S6/S8 读到的 200 都分不清来自桶还是来自服务，那一轮结论不算——所以这里直接退，不留绿。
const plugProbe = await evalJs(`fetch(${JSON.stringify(URL_OF('/plug-probe-no-such-page'))}, {cache:'no-store'})
  .then((r) => 'STILL-REACHABLE ' + r.status).catch((e) => 'down(' + e.name + ')')`);
if (!/^down/.test(plugProbe)) {
  console.log(`✗ 断网没生效：拔掉服务后页面仍能直连（${plugProbe}），这一轮的读数全部作废`);
  chrome.kill(); server.close();
  process.exit(2);
}
console.log(`# 断网自证：${plugProbe}`);

const oldPost = MF.DOC_URLS.filter((u) => /\/\d{4}\/\d{2}\/\d{2}\//.test(u)).slice(-1)[0].slice(BASE.length);
await goto(URL_OF(oldPost));
const off1 = await evalJs(`({ title: document.title, body: document.body.innerText.length,
  isFallback: document.title.indexOf('当前离线') === 0 })`);
// 产物标题从磁盘上那一份读，用来对"离线读到的确实是这一篇，不是兜底页"。
// 正则要单独一句：`const x = /re/.exec(h)` 这种写法里 `exec` 会被当成**正则的量词标记**，
// 报 SyntaxError: Invalid regular expression flags（2026-09-28 第一版就写成了那样）。
const diskTitleMatch = /title>([^<]*)</.exec(fs.readFileSync(path.join(SITE, oldPost.slice(1)), 'utf8'));
const diskTitle = diskTitleMatch ? diskTitleMatch[1] : '';
check('S5 断网读未点过的旧文', !off1.isFallback && off1.body > 800 && off1.title === diskTitle,
  `${oldPost} → 正文 ${off1.body} 字，标题「${off1.title.slice(0, 24)}」与产物标题「${diskTitle.slice(0, 24)}」${off1.title === diskTitle ? '一致' : '**不一致**'}`);

/* ── S6 未收录地址给 503 兜底 ────────────────────────────────── */
// 这一格必须走**导航**而不是页内 fetch()：`fetch('/page3/')` 的 `destination` 是 `fetch`，
// 进不到 `networkFirst` 那一条分支（判据是 `mode === 'navigate' || destination === 'document'`），
// 量到的是"没有 SW 代答所以直连失败"，而不是回落链末端的 503。状态码读 NavigationTiming 的
// `responseStatus`——它比"页面长得像兜底页"硬，因为兜底页的 200 与 503 在 DOM 上一模一样。
await goto(URL_OF('/page3/'));
const s6 = await evalJs(`(() => { const n = performance.getEntriesByType('navigation')[0];
  const h1 = document.querySelector('h1');
  return { status: n && n.responseStatus, title: document.title,
    h1: h1 ? h1.textContent : '', body: document.body.innerText.length }; })()`);
check('S6 未收录地址的形状', s6.status === 503 && s6.h1.indexOf('这个页面现在打不开') !== -1,
  `状态=${s6.status}（要 503，不能是 200：被抓取器当真内容收下就是一篇没有正文的重复页）· h1=「${s6.h1}」· 兜底页正文 ${s6.body} 字 · title=「${s6.title}」`);

/* ── S7 订阅源透传 ───────────────────────────────────────────── */
const s7 = await evalJs(`fetch(${JSON.stringify(URL_OF('/feed.xml'))}).then((r) => 'OK ' + r.status).catch((e) => 'ERR ' + e.name)`);
check('S7 断网时 feed.xml 直连', /^ERR/.test(s7), `结果=${s7}（透传名单里的地址不许由缓存代答）`);

/* ── S8 头图可读 ─────────────────────────────────────────────── */
const coverPost = MF.DOC_URLS.find((u) => /\/\d{4}\/\d{2}\/\d{2}\//.test(u)).slice(BASE.length);
const postHtml = fs.readFileSync(path.join(SITE, coverPost.slice(1)), 'utf8');
const coverRel = MF.COVER_URLS.find((u) => postHtml.includes(`src="${u}"`));
if (!coverRel) {
  check('S8 断网头图', false, `${coverPost} 的产物里找不到封面桶那种 <img src>，这一格没能核到（清单第 1 张 ${MF.COVER_URLS[0]}）`);
} else {
  await goto(URL_OF(coverPost));
  const s8 = await evalJs(`(() => { const im = [...document.images].find((i) => i.currentSrc.includes(${JSON.stringify(coverRel)}));
    return im ? { w: im.naturalWidth, complete: im.complete } : { w: 0, complete: false, missing: true }; })()`);
  check('S8 断网头图可读', s8.w > 0, `${coverRel} → naturalWidth=${s8.w} complete=${s8.complete}`);
}

/* ── S9 在线回访：SW 代发资源的 transferSize ─────────────────── */
await plugBack();
await S('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
await goto(URL_OF('/tools/idcard.html?swdev=1'));
const s9 = await evalJs(`(() => { const e = performance.getEntriesByType('resource')
    .find((x) => /editorial\\.min\\.js$/.test(x.name));
  return e ? { transfer: e.transferSize, encoded: e.encodedBodySize, dur: Math.round(e.duration) } : { missing: true }; })()`);
check('S9 SW 代发资源 transferSize 为 0', s9.transfer === 0 && s9.encoded > 0,
  `editorial.min.js transferSize=${s9.transfer} encodedBodySize=${s9.encoded}（这一格正是 verify-idcard-browser.mjs 5a 的量具陷阱，也是 initOffline 第 3 道闸门存在的理由）`);

/* ── S10 收尾注销 ────────────────────────────────────────────── */
const s10 = await evalJs(`navigator.serviceWorker.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.unregister()))
  .then(() => caches.keys()).then((ks) => Promise.all(ks.map((k) => caches.delete(k))))
  .then(() => caches.keys()).then((ks) => ks.filter((k) => k.startsWith(${JSON.stringify(BASE)})).length))`);
check('S10 注销与清桶', s10 === 0, `注销后残留桶 ${s10} 个`);

await c.send('Target.closeTarget', { targetId });
chrome.kill();
server.close();
// 等 Chrome 真退出再删 profile：它退出前还在写 Web Applications/Manifest Resources，
// 这时 rmSync 会撞 ENOTEMPTY 崩掉（2026-09-28 那个探针就死在收尾，判据反而没打出来）。
await new Promise((r) => (chrome.exitCode === null ? chrome.once('exit', r) : r()));
try {
  fs.rmSync(profile, { recursive: true, force: true });
} catch (err) {
  console.log(`（临时 profile 没删干净：${err.code} ${profile}——不影响判据，手动清即可）`);
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed === results.length ? '✓' : '✗'} 离线层核验 ${passed}/${results.length} 格通过`);
if (passed !== results.length) {
  console.log('红的是：' + results.filter((r) => !r.pass).map((r) => r.id).join('、'));
  process.exit(1);
}
