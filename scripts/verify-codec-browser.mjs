#!/usr/bin/env node
/**
 * 段 3 Task 8：编码页（`/tools/codec.html`）浏览器侧核验。真 Chrome + CDP，无第三方依赖，
 * Node 22 的全局 WebSocket。骨架照 `scripts/verify-idcard-browser.mjs`（段 2 Task 10 那一格），
 * 判据集合 = 段 2 那 13 项里**形状通用**的那些 + §0.5 四条欠账 + codec 专有那三件。
 *
 * 为什么这一格新建一份脚本，而不是按计划默认「把 `verify-idcard-browser.mjs` 提成参数表后共用」：
 * 写这一格的时候，那份脚本正被另一路会话改着（`--host-resolver-rules` 那一族 flag 换成了
 * `--proxy-server=direct://` + `MAP * ~NOTFOUND`，未提交）。把它提成公共表只有两种落笔方式：
 * 要么把别人没发表的改动一起带进我这一格，要么和它抢同一个文件——两条都不做。
 * 本文件**照抄了那一族更稳的 flag**（改动是降噪、不是改判据，理由见下面 spawn 处的注释），
 * 于是两份脚本的重复面就剩「静态服务 + Conn + goto + 断点矩阵」这一族。Task 9 那格在另一路
 * 会话的改动落地之后再提公共表，提的时候这一格要跟着改，别留两份各自漂。
 *
 * 判据分十组，编号与段 2 那份对齐（1a…5a 同形状，6 之后是本格新增）：
 *   1) 十档视口 360/640/641/880/900/901/920/940/1280/1920（§0.5 第 4 条沿用段 2 那一族）：
 *      溢出 + 两处换挡（工作区 900 / 时间戳那块的 `.tk-cols` 640）+ 索引条退档 + 901–959 中段。
 *      codec 比证件页多一条：五块面板里**只有 `#timestamp` 是左右两栏**，其余四块 `.tk-cols--one`
 *      恒单栏——所以 1c 既要在 640 换挡，也要在四块单栏面板上「永远不换挡」。
 *   2) 昼/夜 × 三档纸色温 = 6 组，现算正文与面板底色对比度（判线 4.5）。
 *   3) 键盘：段 2 交回的两条真按键欠账在这里兑现——方向键切面板、`Enter` 触发复制都用
 *      `Input.dispatchKeyEvent` 真按（`focus()` 允许是程序给的，被判的是按键处理）；再加公共层
 *      的 `Esc` 回归（§0.5 第 3 条：开 ⌘K → 按 Esc → 断 `#cmdk` 回 `hidden`，工具层不自造 Esc）。
 *   4) 禁 JS：摘掉全部 `<script>` 的同一份产物，核五块面板、索引条与那两句口径还在。
 *   5) 首屏阻塞资源：按 entry.renderBlockingStatus 现量，核本页那三件不在阻塞集里。
 *   6) §0.5 第 1 条：全程挂 `Runtime.enable` + `Runtime.exceptionThrown` +
 *      `Runtime.consoleAPICalled` + `Log.entryAdded`，本源（这台静态服务的 origin）一条都不许有。
 *   7) 五块面板各真算一次，结果对着已知答案核（MD5/SHA 的教科书向量、Base64、URL 两档、时间戳）。
 *   8) 正则四档闸门：语法档 / 500 字符档 / 静态可疑形状档（high 一次都不执行）/ 命中上限档。
 *   9) 字节闸门三块面板同一把尺子：Base64 与正则都拿 1 MiB 那一条线，正好放行、+1 整拒、
 *      拒的时候结果区不许把那一大串再打一遍、复制按钮也不许解锁。
 *  10) 文件通道走 `ArrayBuffer`：>5 MiB 的文件按**声明字节**拒且一次都不 `arrayBuffer()`；
 *      200 KB 的文件走字节通道算出五行，`File.prototype.text` 全程 0 次，
 *      `subtle.digest` 收到的字节数 == 文件字节数，MD5 与 Node 侧对同一份字节算出的值逐字相等。
 *
 * 读产物：默认 `ROOT/_site`，环境变量 `TK_SITE_DIR` 可以指到别处。本格跑的是
 * `bundle exec jekyll build --destination /tmp/t8/_site` 那一份快照——仓库的 `_site` 是共享的，
 * 另一路会话正在它上面量离线层，这一格不去覆写它。
 *
 * 跑法：`node scripts/verify-codec-browser.mjs`（先有一次 vite 构建与一次 Jekyll 构建；
 * 退出码 0 = 全绿，1 = 有红项，2 = 环境没起来）。
 */
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.TK_SITE_DIR ? path.resolve(process.env.TK_SITE_DIR) : path.join(ROOT, '_site');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PAGE = '/tools/codec.html';
const BASE = '/better-blog';
if (!fs.existsSync(path.join(SITE, PAGE.slice(1)))) {
  console.log(`✗ ${SITE} 里没有 ${PAGE}——先构建产物，或用 TK_SITE_DIR 指到快照`);
  process.exit(2);
}

/**
 * 静态服务端口现抢（段 2 那条教训：写死端口时被上一轮遗留进程占着，脚本照常往下跑）。
 * Chrome 的调试端口不在这里挑：`--remote-debugging-port=0` 让 Chrome 自己挑，再从**它自己的
 * stderr** 读 `DevTools listening on ws://…`——那行日志只可能出自这个 pid，于是"连上别人的
 * 浏览器"这一族静默说谎从根上排除（出处见段 2 Task 10 的整改记录 `623ef16`）。
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
const PORT = await freePort();
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon', '.map': 'application/json',
};

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
  if (nojs) {
    /**
     * 这一条路由模拟的是"用户关掉 JavaScript 之后看到的那一份"，所以要做两件事，只做第一件会漏：
     * 1. 摘掉全部 `<script>`；
     * 2. **把 `<noscript>` 的contents摊平出来**——浏览器的真实行为是"脚本被禁用才把 noscript
     *    的子节点当 DOM 解析"，而这一格只是不让脚本跑（Chrome 里 scripting 仍是 enabled），
     *    于是 noscript 的子节点在这一帧里根本不存在成元素。第一版 4a 直接
     *    `querySelector('.tk-compliance--noscript')`，那一条**永远是 null**，判据里凭空挂着一句
     *    测不到的东西——红的时候看着像页面缺陷，绿的时候其实是没测。摊平之后那句真的可查。
     */
    body = Buffer.from(body.toString('utf8')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<noscript>([\s\S]*?)<\/noscript>/gi, '$1'), 'utf8');
  }
  res.writeHead(200, {
    'content-type': (MIME[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

// ── 文件通道的两份夹具：200 KB 真算，5 MiB + 1 越界 ──────────────────────────
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 't8-codec-'));
const FILE_OK = path.join(scratch, 'ok-200k.bin');
const FILE_BIG = path.join(scratch, 'big-5m-plus-1.bin');
const OK_BYTES = 200 * 1024;
(() => {
  const seed = Buffer.from('better-blog 段 3 Task 8 编码页文件通道夹具\n', 'utf8');
  const buf = Buffer.alloc(OK_BYTES);
  for (let i = 0; i < OK_BYTES; i += 1) buf[i] = seed[i % seed.length] ^ (i & 0xff);
  fs.writeFileSync(FILE_OK, buf);
})();
fs.writeFileSync(FILE_BIG, Buffer.alloc(5242881, 7));
/** Node 侧对同一份字节算出的答案，浏览器那一侧必须逐字对上 */
const FILE_ANSWER = ['md5', 'sha1', 'sha256'].map((a) => ({
  algo: a, hex: crypto.createHash(a).update(fs.readFileSync(FILE_OK)).digest('hex'),
}));

/**
 * Chrome flag 里这一族是**照段 2 那份脚本工作区里更稳的一版抄的**（不是本格的改动）：
 * 本机开着系统代理（127.0.0.1:65532）时，走代理的请求由代理解析域名，`--host-resolver-rules`
 * 一条都不参与；只有把代理一起摘掉（`direct://`）规则才开始说话，而 `MAP * ~NOTFOUND` 是
 * "解析不出来"而不是"连上去等人回话"，所以站外那几件外链秒失败、外链字节恒为 0B，
 * 5a 那条"可复算的数只算本地块"才真的稳。`EXCLUDE 127.0.0.1` 保住这一格自己的静态服务。
 *
 * 站外一件都不给成功，也顺带排除了另一族静默说谎：外链卡住时 readyState 永远不落 complete，
 * `goto()` 变成"加载超时"，看着像页面坏了、其实是量具泡在网络里。
 */
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 't8-chrome-'));
const chrome = spawn(CHROME, ['--headless', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run',
  '--disable-background-networking', '--window-size=1280,900',
  '--proxy-server=direct://', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
/** 端点只认这行 stderr：出自上面那个 pid，所以不可能连到别人启动的浏览器。 */
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
console.log(`# Chrome pid=${chrome.pid} profile=${profile}\n# CDP ${wsUrl}`);
console.log(`# 产物 ${SITE}\n# 静态服务 ${ORIGIN}${BASE}   夹具 ${OK_BYTES}B / 5,242,881B`);

const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });
/**
 * 每一条 CDP 调用带 25s 死线，并把"当时正在跑哪一组"一起报出来。
 * 这一条是量具自己的保险：第一版跑到 3f 之后静默挂住五分钟，日志一个字都没多——
 * "脚手架挂了"和"页面挂了"长得一模一样（§0.5 第 1 条那三条监听只管页面，管不到量具）。
 * 有了死线，挂住的位置会自己报出来，而不是让整格变成一次无意义的等待。
 */
const CDP_MS = 25000;
let GROUP = '(启动)';
const S = (m, p = {}) => {
  const call = c.send(m, p, sessionId);
  call.catch(() => {}); // 超时之后那条迟到的拒绝不该把进程带崩
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(
      `CDP ${m} 在 ${CDP_MS / 1000}s 内没有回应（当时正在跑「${GROUP}」）`)), CDP_MS);
    call.then(resolve, reject).finally(() => clearTimeout(timer));
  });
};
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
  for (let i = 0; i < 200; i += 1) {
    if (await evalJs('document.readyState') === 'complete') return;
    await new Promise((r) => setTimeout(r, 60));
  }
  throw new Error('加载超时：' + url);
};
const setVp = (width, height = 900) => S('Emulation.setDeviceMetricsOverride',
  { width, height, deviceScaleFactor: 1, mobile: false });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/**
 * 真按键：只走 `Input.dispatchKeyEvent`，不用 `element.dispatchEvent(new KeyboardEvent(...))`——
 * 后者的 `isTrusted` 是假的，而 §0.5 第 2 条要的就是"真按一遍"。
 * `focus()` 仍然允许是程序给的：被判的是按键处理，不是焦点怎么来。
 * @param {string} key `KeyboardEvent.key`
 * @param {string} code `KeyboardEvent.code`
 * @param {number} vk windows 虚拟键码（Tab 9 / Enter 13 / Escape 27 / Home 36 / End 35 / 方向键 37–40）
 * @param {number} [modifiers] CDP 位掩码：Alt 1 / Ctrl 2 / Meta 4 / Shift 8
 * @param {string} [text] 显式字符文本；不给就按 `key` 推（单字符键用自身，`Enter` 用 `\r`）
 */
const press = async (key, code, vk, modifiers = 0, text = undefined) => {
  const base = { key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  if (modifiers) base.modifiers = modifiers;
  // **`Enter` 那一次必须带 `text: '\r'`**：`<button>` 上"按 Enter 等于点一下"走的是 Blink 的
  // 默认动作（keypress 转 click），只发 `keyDown` 时监听器收得到、默认动作整条不发生。
  // 第一版 3f 就是这个缺口感应成"复制坏了"，所以这一行是判据成立的前提，不是风格问题。
  const txt = text ?? (key.length === 1 ? key : (key === 'Enter' ? '\r' : undefined));
  if (txt !== undefined) base.text = txt;
  await S('Input.dispatchKeyEvent', { type: 'keyDown', ...base });
  await S('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await wait(90);
};
/** 把焦点放到那一格上并**自证真放上了**：面板还 hidden 时 focus() 是静默失败的 */
const focusOn = (id) => evalJs(`(() => { const el = document.getElementById(${JSON.stringify(id)});`
  + ' if (!el) return "no-node"; el.focus();'
  + ' return document.activeElement && document.activeElement.id === ' + JSON.stringify(id) + ' ? "ok" : (document.activeElement.tagName||"?"); })()');
/** 焦点 + 真按 Enter；`mods` 用 CDP 位掩码（2 = Ctrl） */
const enterOn = async (id, mods = 0) => { const at = await focusOn(id); await press('Enter', 'Enter', 13, mods); return at; };
const readOut = (id) => evalJs(`(() => { const el = document.getElementById(${JSON.stringify(id)});`
  + ' if (!el) return null;'
  + ' const v = el.querySelector(".tk-verdict .tk-state");'
  + ' return { text: el.innerText.replace(/\\s+/g," ").trim(), full: el.innerText,'
  + ' verdict: v ? v.textContent.trim() : "",'
  + ' html: el.innerHTML.length, rows: [...el.querySelectorAll("table")].map((t)=>t.querySelectorAll("tbody tr").length) }; })()');
/** 往格子里写值：值本身不是被判的东西，被判的是"按下去以后发生什么" */
const putValue = (id, value) => evalJs(`(() => { const el = document.getElementById(${JSON.stringify(id)});`
  + ' if (!el) return "missing"; el.value = ' + JSON.stringify(String(value)) + '; return String(el.value).length; })()');
/**
 * `<select>` 换档：设值之后要补一次 `change`，因为 `applySwitch` 挂的是 change 监听。
 * 这一处允许是程序派发的事件——被判的是"显隐跟着开关走"这条接线，键盘与鼠标那几条用的是真输入。
 */
const setSelect = (id, value) => evalJs(`(() => { const el = document.getElementById(${JSON.stringify(id)});`
  + ' if (!el) return "missing"; el.value = ' + JSON.stringify(String(value)) + ';'
  + ' el.dispatchEvent(new Event("change", { bubbles: true })); return el.value; })()');

/**
 * 装上四条记账钩子：剪贴板两路 + **字节通道两路** + `subtle.digest`。
 *
 * 这一本是本格最险的一处，因为"钩子没装上"和"钩子记到 0 次"在两处判定里长得一模一样：
 * 第一版 9b/10a/10b 那句 `ab === 0 && digest.length === 0` 读的是从没被执行过的计数器，
 * 红不了、也绿得没意义（假牙）。所以这里做三件事：
 * 1. **装不上就抛**——File/Blob 与 subtle 拿不到可调的原方法时直接 `throw`，让量具以退出码 2
 *    响，而不是让计数器安静地停在 0。
 * 2. **回报钩子落在哪一层原型上**：`file.arrayBuffer()` 在 Chrome 里究竟走 `File.prototype`
 *    还是继承来的 `Blob.prototype`，是实现细节、不是我能假设的东西；两处都包，再把
 *    "自有属性在哪层"读出来打进详情，人对账时看得出包到的就是页面实际调的那一条。
 * 3. 每次 `goto()` 都是新文档，钩子随之消失，所以 `window.__spied` 那面守卫旗也只活一帧——
 *    每组的第一个动作前重新装一遍，`resetSpy()` 只清计数、不重包装。
 * @returns {Promise<string>} 安装形状自证串
 */
const installSpies = () => evalJs(`(() => {
  window.__spy = { copy: [], exec: 0, digest: [], ab: 0, text: 0 };
  const shape = [];
  if (navigator.clipboard && navigator.clipboard.writeText) {
    const o = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = (t) => { window.__spy.copy.push(String(t)); return Promise.resolve(); };
    shape.push('clipboard=on');
  } else shape.push('clipboard=absent');
  const oe = document.execCommand;
  if (oe) { document.execCommand = function (cmd) { if (cmd === 'copy') { window.__spy.exec += 1;
      window.__spy.copy.push((document.activeElement && document.activeElement.value) || ''); }
      return oe.apply(document, arguments); }; shape.push('exec=on'); }
  const own = (proto, key) => (proto && Object.prototype.hasOwnProperty.call(proto, key));
  const wrap = (proto, key, kind) => { const o = proto[key];
    if (typeof o !== 'function') throw new Error('包不上：' + kind + '.' + key + ' 不是函数');
    proto[key] = function () { window.__spy[kind] += 1; return o.apply(this, arguments); }; };
  if (own(File.prototype, 'arrayBuffer')) { wrap(File.prototype, 'arrayBuffer', 'ab'); shape.push('ab@File'); }
  else { wrap(Blob.prototype, 'arrayBuffer', 'ab'); shape.push('ab@Blob'); }
  if (own(File.prototype, 'text')) { wrap(File.prototype, 'text', 'text'); shape.push('text@File'); }
  else { wrap(Blob.prototype, 'text', 'text'); shape.push('text@Blob'); }
  const sub = window.crypto && window.crypto.subtle;
  if (!sub || typeof sub.digest !== 'function') throw new Error('包不上：crypto.subtle.digest 不可调');
  const od = sub.digest.bind(sub);
  sub.digest = (alg, data) => { window.__spy.digest.push({ algo: typeof alg === 'string' ? alg : String(alg && alg.name),
      bytes: data && data.byteLength }); return od(alg, data); };
  shape.push('digest=on');
  window.__spied = 1;
  return shape.join(' ') + ' | File 自有 arrayBuffer=' + (own(File.prototype, 'arrayBuffer') ? '是' : '否（继承 Blob）');
})()`);
const resetSpy = () => evalJs('window.__spy = { copy: [], exec: 0, digest: [], ab: 0, text: 0 }; 1');

await S('Page.enable'); await S('Runtime.enable'); await S('Network.enable');
await S('Log.enable'); await S('DOM.enable');
await S('Network.setCacheDisabled', { cacheDisabled: true });

// ── §0.5 第 1 条：三条监听，全程累计 ────────────────────────────────────────
/**
 * 段 2 交回的那句话是"全仓库零处监听"，所以这一格是第一次把它们接上。
 * 分类口径写清楚，因为**混在一起会红得不讲道理**：这台机器上站外一律 `~NOTFOUND`，
 * 外链失败会以 `Log.entryAdded`（source `network`）与 `consoleAPICalled` 的形式出现——
 * 那是这一格自己制造的噪声，不是页面缺陷。于是站外那一族单独计数、不进判据，供人对账
 * "排除掉的确实都长得像网络失败"。本源这一侧的分层判线在下面的 `PAGE_OWN` 那一段写死，
 * 它红过一次就是因为"本源"三个字不够细（`soPush.min.js` 那 32 条站级告警）。
 */
const noise = { exceptionThrown: [], consoleError: [], logOwn: [], logRemote: 0 };
c.on((m) => {
  if (m.sessionId !== sessionId) return;
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails || {};
    noise.exceptionThrown.push({ url: (d.url || '(无 url)').replace(ORIGIN + BASE, ''), text: String(d.text || '').slice(0, 100),
      desc: String(d.exception?.description || '').split('\n')[0].slice(0, 150) });
  } else if (m.method === 'Runtime.consoleAPICalled') {
    const t = m.params.type;
    if (t !== 'error' && t !== 'warning') return;
    const url = (m.params.stackTrace?.callFrames || []).map((f) => f.url).filter(Boolean)[0] || '';
    const text = (m.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ').slice(0, 150);
    if (url.startsWith(ORIGIN)) noise.consoleError.push({ t, url: url.replace(ORIGIN + BASE, ''), text });
    else noise.logRemote += 1;
  } else if (m.method === 'Log.entryAdded') {
    const e = m.params.entry || {};
    if ((e.url || '').startsWith(ORIGIN)) {
      noise.logOwn.push({ src: e.source, level: e.level, text: String(e.text).slice(0, 150), url: e.url.replace(ORIGIN + BASE, '') });
    } else noise.logRemote += 1;
  }
});
/**
 * 什么算"这一页的账"。第一版把**本源**当成一把整齐的尺子，结果 6a/11a 各红在 32 条
 * `A parser-blocking, cross site script … is invoked via document.write` 上——那 32 条的 url
 * 是 `/assets/js/soPush.min.js`（站级的百度推送脚本，证件页那一格同样在付，只是那一格的
 * 监听还没接上所以没现形），与编码页新加的这三件一个字节的关系都没有。
 * 一刀切成"本源任何一条都不许有"会把站级既有事实变成这一格的红灯；一刀切成"只数 error"
 * 又放走了"本页自己的文件出一条 warning"。所以判线分三层，每层各归各的账：
 *   ① 异常与 error 级：本源一条都不许有（§0.5 第 1 条的原话）；
 *   ② **本页专属那三件 + 页面本身**：任何级别一条都不许有；
 *   ③ 其余本源 warning：不判红，但必须逐条列出来人对账——列不出归属就是②没兜住。
 */
const PAGE_OWN = /\/tools\/codec\.html|toolkit\.min\.css|toolkitCore\.min\.js|toolCodec\.min\.js/;
const isPageOwn = (u) => PAGE_OWN.test(String(u || ''));
const noiseCount = () => ({
  err: noise.exceptionThrown.length
    + noise.consoleError.filter((x) => x.t === 'error').length
    + noise.logOwn.filter((x) => x.level === 'error').length,
  pageOwn: noise.logOwn.filter((x) => isPageOwn(x.url)).length
    + noise.consoleError.filter((x) => isPageOwn(x.url)).length,
  warnRest: noise.logOwn.filter((x) => x.level !== 'error' && !isPageOwn(x.url)).length,
});
const noiseGrouped = () => {
  const by = new Map();
  noise.logOwn.filter((x) => x.level !== 'error' && !isPageOwn(x.url)).forEach((x) => {
    const k = `${x.level}|${x.url}|${x.text.slice(0, 60)}`;
    by.set(k, (by.get(k) || 0) + 1);
  });
  return [...by.entries()].map(([k, n]) => `${k}×${n}`).join(' ；') || '(无)';
};
const noisePass = () => { const q = noiseCount(); return q.err === 0 && q.pageOwn === 0; };
const noiseShot = () => {
  const q = noiseCount();
  return `本源 error 级合计 ${q.err}（异常 ${noise.exceptionThrown.length}、console ${noise.consoleError.filter((x) => x.t === 'error').length}、`
    + `Log ${noise.logOwn.filter((x) => x.level === 'error').length}）、本页那三件与页面本身 ${q.pageOwn} 条、`
    + `站级 warning 不判红但列账 ${q.warnRest} 条；站外被排除（~NOTFOUND 的网络失败）${noise.logRemote} 条。`
    + `非本页 warning 归因：${noiseGrouped()}`
    + (noise.exceptionThrown.length ? ` 异常 ${JSON.stringify(noise.exceptionThrown.slice(0, 2))}` : '')
    + (noise.consoleError.length ? ` console ${JSON.stringify(noise.consoleError.slice(0, 2))}` : '');
};

const results = [];
const check = (id, pass, detail) => { results.push({ id, pass, detail }); console.log(`${pass ? '✓' : '✗'} ${id} — ${detail}`); };
/**
 * 量具自己挂了要走**单独一档退出码（2）**，不能和"判据红（1）"混成一个数：
 * 第一版跑到 3f 之后整条静默挂住五分钟，日志停在原处——那种形状既不像页面坏了，
 * 也不像判据没过，谁都得重新猜。现在挂的位置、挂的原因、已经量到哪几项一起打出来。
 */
process.on('uncaughtException', (err) => {
  const red = results.filter((r) => !r.pass);
  console.log(`✗ 量具挂了（脚手架问题，不是页面缺陷）：当时正在跑「${GROUP}」\n  ${err.message}`);
  console.log(`  已量出 ${results.length} 项（红 ${red.length}）：${red.map((r) => r.id.split(' ')[0]).join('、') || '无'}`);
  console.log(`  本源监听：异常 ${noise.exceptionThrown.length}、console error/warning ${noise.consoleError.length}、Log ${noise.logOwn.length}`);
  chrome.kill(); server.close();
  fs.rmSync(scratch, { recursive: true, force: true });
  process.exit(2);
});
// 顶层 await 里的拒绝在 ESM 下走 unhandledRejection，不走 uncaughtException，两条都得挂。
process.on('unhandledRejection', (err) => {
  const e = err instanceof Error ? err : new Error(String(err));
  process.emit('uncaughtException', e);
});
const tracks = (v) => String(v).trim().split(/\s+/).length;
const URL_OF = (p) => `${ORIGIN}${BASE}${p}`;

/* ══ 1) 断点矩阵 ══════════════════════════════════════════════════════════ */
GROUP = "1) 断点矩阵 1a–1e";
const VPS = [360, 640, 641, 880, 900, 901, 920, 940, 1280, 1920];
const rows = [];
await setVp(1280); await goto(URL_OF(PAGE));
for (const w of VPS) {
  await setVp(w); await wait(140);
  // 五块面板里只有当前那块可见，其余四块挂着 hidden——而 display:none 子树里
  // getComputedStyle().gridTemplateColumns 返回的是**未解析的指定值**（形如 minmax(0px, 1fr)
  // 这种自带空格的函数串），按空白切 token 就把"一栏"数成两栏。第一版 1c 正是被这个缺口
  // 判成红的（单=2,2,2,2），不是页面形状错了。所以在同一帧里把五块全掀开、量完立刻盖回去：
  // 读到的每一条都是真正落地的 px 轨道，而这一帧之外没有任何可见状态变化。
  const r = await evalJs(`(() => {
    const de = document.documentElement, g = (s) => { const el = document.querySelector(s); return el ? getComputedStyle(el) : null; };
    const ws = g('.tk-workspace'), idx = g('.tk-index'), hint = g('.tk-index__hint');
    const pan = document.querySelector('.tk-panel');
    const hid = [...document.querySelectorAll('.tk-panel[hidden]')];
    hid.forEach((p) => { p.hidden = false; });
    const cols = [...document.querySelectorAll('.tk-panel .tk-cols')].map((el) => ({
      one: el.classList.contains('tk-cols--one'), t: getComputedStyle(el).gridTemplateColumns }));
    const rect = pan ? Math.round(pan.getBoundingClientRect().width) : null;
    hid.forEach((p) => { p.hidden = true; });
    const chips = [...document.querySelectorAll('.tk-index__link')].map((a) => Math.round(a.getBoundingClientRect().right));
    return { sw: de.scrollWidth, cw: de.clientWidth, wsT: ws ? ws.gridTemplateColumns : null,
      idxPos: idx ? idx.position : null, hint: hint ? hint.display : null,
      panW: rect, cols,
      chipMax: chips.length ? Math.max(...chips) : 0, chipN: chips.length,
      panelN: document.querySelectorAll('.tk-panel').length };
  })()`);
  rows.push({ w, ...r });
}
const badOverflow = rows.filter((r) => r.sw - r.cw > 1);
check('1a 十档视口无横向溢出（scrollWidth − clientWidth ≤ 1）', badOverflow.length === 0,
  badOverflow.length ? `溢出档：${badOverflow.map((r) => `${r.w}px(+${r.sw - r.cw})`).join(' ')}`
    : rows.map((r) => `${r.w}:${r.sw}/${r.cw}`).join(' '));
const wsWrong = rows.filter((r) => tracks(r.wsT) !== (r.w <= 900 ? 1 : 2));
check('1b 工作区两栏↔单栏恰好落在 900', wsWrong.length === 0,
  rows.map((r) => `${r.w}:${tracks(r.wsT)}栏`).join(' ') + (wsWrong.length ? ` ← 错位档 ${wsWrong.map((r) => r.w).join()}` : ''));
// 五块面板里只有 #timestamp 是两栏：`.tk-cols` 在 640 换挡，`.tk-cols--one` 恒一栏。
// 这一条同时是"编码页比证件页多的那一半形状"——照抄证件页那份、写死两栏的假设在这里会露。
const twoAt = (r) => r.cols.filter((x) => !x.one).map((x) => tracks(x.t));
const oneAt = (r) => r.cols.filter((x) => x.one).map((x) => tracks(x.t));
const colsWrong = rows.filter((r) => twoAt(r).some((n) => n !== (r.w <= 640 ? 1 : 2))
  || oneAt(r).some((n) => n !== 1) || twoAt(r).length !== 1 || oneAt(r).length !== 4);
check('1c 两栏↔单栏落在 640 的只有 #timestamp 那一块，其余四块 .tk-cols--one 恒单栏', colsWrong.length === 0,
  rows.map((r) => `${r.w}:双=${twoAt(r).join()}/单=${oneAt(r).join()}`).join(' ')
    + (colsWrong.length ? ` ← 错位档 ${colsWrong.map((r) => r.w).join()}` : ''));
const idxWrong = rows.filter((r) => (r.w <= 900 ? r.idxPos !== 'static' : r.idxPos === 'static'));
check('1d 索引条 ≤900 退成 static chip、提示语在 chip 档隐藏，五块面板与五条链接都在',
  idxWrong.length === 0 && rows.filter((r) => r.w <= 900).every((r) => r.hint === 'none')
  && rows.filter((r) => r.w > 900).every((r) => r.hint !== 'none')
  && rows.every((r) => r.panelN === 5 && r.chipN === 5),
  rows.map((r) => `${r.w}:${r.idxPos[0]}/hint=${r.hint === 'none' ? '藏' : '现'}`).join(' '));
const mid = rows.filter((r) => r.w >= 901 && r.w <= 959);
check('1e 901–959 那一段：面板宽度与 chip 右沿都在视口内',
  mid.length === 3 && mid.every((r) => r.panW > 0 && r.chipMax <= r.cw + 1),
  mid.map((r) => `${r.w}px 面板${r.panW}px、chip 最右 ${r.chipMax}/${r.cw}`).join(' '));

/* ══ 2) 昼夜 × 三档纸色温 ═════════════════════════════════════════════════ */
GROUP = "2) 昼夜 × 纸色温 2a–2d";
const lum = (rgb) => {
  const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number)
    .map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const combos = [];
for (const mode of ['day', 'night']) {
  for (const p of ['warm', 'cool', 'sage']) {
    await setVp(1280); await goto(URL_OF(PAGE));
    await evalJs(`localStorage.setItem('daytimeMode','${mode}');`
      + `localStorage.setItem('readerPrefs', JSON.stringify({p:'${p}'})); 1`);
    await goto(URL_OF(PAGE)); await wait(280);
    const o = await evalJs(`(() => { const panel=document.querySelector('.tk-panel'); const body=document.body;
      const bgh=(el)=>{ let n=el; while(n){ const v=getComputedStyle(n).backgroundColor; if(v && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(v)) return v; n=n.parentElement; } return 'rgb(255, 255, 255)'; };
      const t=document.querySelector('.tk-panel p, .tk-compliance');
      return { night: document.documentElement.classList.contains('night-mode'),
        rs: document.documentElement.getAttribute('data-rs-paper') || '',
        panelBg: bgh(panel), text: getComputedStyle(t).color, bodyBg: bgh(body),
        panelSelf: getComputedStyle(panel).backgroundColor, label: t.textContent.trim().slice(0, 10) }; })()`);
    combos.push({ mode, p, ...o, r: +ratio(o.text, o.panelBg).toFixed(2) });
  }
}
check('2a 六组（昼/夜 × warm/cool/sage）正文对比度全过 4.5', combos.every((x) => x.r >= 4.5),
  combos.map((x) => `${x.mode}/${x.p}:${x.r}`).join(' '));
const dayDistinct = new Set(combos.filter((x) => x.mode === 'day').map((x) => x.bodyBg)).size === 3;
const nightFlat = new Set(combos.filter((x) => x.mode === 'night').map((x) => x.bodyBg)).size === 1;
// warm 是默认档：themeBootstrap/editorial.js 明写"只写非默认值"，所以默认档属性为空。
const attrWritten = combos.every((x) => x.rs === (x.p === 'warm' ? '' : x.p));
check('2b 纸色温三档：白昼 body 底色三个不同值、夜间恒一个值，且属性只写非默认档',
  dayDistinct && nightFlat && attrWritten,
  combos.map((x) => `${x.mode}/${x.p}:attr=${x.rs || '(空)'}/body=${x.bodyBg}`).join(' '));
check('2c 档位与类名一致：night-mode 只在 night 档出现',
  combos.every((x) => x.night === (x.mode === 'night')),
  combos.map((x) => `${x.mode}:${x.night ? 'night' : 'day'}`).join(' '));
check('2d 面板底色跟不跟纸色温（不判、只报：--surface 一族本就不吃 --paper）', true,
  `panel 三档全不同=${['day', 'night'].every((m) => new Set(combos.filter((x) => x.mode === m).map((x) => x.panelSelf)).size === 3)}；`
    + combos.map((x) => `${x.mode}/${x.p}:panel=${x.panelSelf}`).join(' '));

/* ══ 3) 键盘（含 §0.5 第 2、3 条真按键）══════════════════════════════════ */
GROUP = "3) 键盘 3a–3g";
await setVp(1280); await goto(URL_OF(PAGE)); await wait(320);
const chain = [];
for (let i = 0; i < 26; i += 1) {
  await press('Tab', 'Tab', 9);
  chain.push(await evalJs(`(() => { const a=document.activeElement; if(!a) return 'null';
    return [a.tagName.toLowerCase(), (a.className||'').toString().split(' ')[0],
      (a.textContent||'').trim().slice(0,8), a.closest('.nav-sub')?1:0].join('|'); })()`));
}
check('3a Tab 链在离开头部之前能走进下拉子项（:focus-within 打开）',
  chain.some((s) => /nav-sub-link/.test(s)), `前 12 跳：${chain.slice(0, 12).join(' | ')}`);
const ring = await evalJs(`(async () => { const b=document.querySelector('.tk-btn');
  await new Promise(r=>{ b.focus(); requestAnimationFrame(()=>requestAnimationFrame(r)); });
  const cs=getComputedStyle(b);
  return { outline: cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor, matches: b.matches(':focus-visible') }; })()`);
check('3b 焦点环不是 outline:none（.tk-btn，经 .focus() 读 :focus-visible 态）',
  ring.outline.split(' ')[0] !== 'none' && parseFloat(ring.outline.split(' ')[1]) >= 1,
  `outline=${ring.outline}；:focus-visible=${ring.matches}`);

/** 面板互锁的现场：哪块 aria-selected、哪块还没 hidden、焦点在哪、地址栏 hash 是什么 */
const panelState = () => evalJs(`(() => {
  const tabs=[...document.querySelectorAll('.tk-index__link')];
  const sel=tabs.filter(t=>t.getAttribute('aria-selected')==='true').map(t=>t.id.replace('tk-tab-',''));
  const roving=tabs.filter(t=>t.tabIndex===0).map(t=>t.id.replace('tk-tab-',''));
  const shown=[...document.querySelectorAll('.tk-panel')].filter(p=>!p.hidden).map(p=>p.id.replace('tk-panel-',''));
  return { sel, roving, shown, hash: location.hash, focus: document.activeElement.id || '',
    scrollY: Math.round(window.scrollY), broken: document.querySelectorAll('.tk-panel__error').length }; })()`);
/** 五件事一起跟上才算切成功：selected / roving / 只显示这一块 / 焦点 / hash */
const want = (st, id) => st.sel.join() === id && st.roving.join() === id && st.shown.join() === id
  && st.focus === `tk-tab-${id}` && st.hash === `#${id}`;
const shot = (k, st) => `${k}→sel=${st.sel.join()}/roving=${st.roving.join()}/shown=${st.shown.join()}`
  + `/focus=${(st.focus || '').replace('tk-tab-', '')}/hash=${st.hash}`;

await evalJs('window.scrollTo(0,0); 1');
const Y0 = (await panelState()).scrollY;
await focusOn('tk-tab-timestamp');
await press('ArrowRight', 'ArrowRight', 39);
const sRight = await panelState();
await press('ArrowLeft', 'ArrowLeft', 37);
const sLeft = await panelState();
await press('End', 'End', 35);
const sEnd = await panelState();
await press('Home', 'Home', 36);
const sHome = await panelState();
await press('ArrowDown', 'ArrowDown', 40);
const sDown = await panelState();
check('3c 真按方向键切面板：ArrowRight/Left/Down 与 Home/End 各换到该去的那块，'
  + 'roving tabindex、hidden 互锁、焦点与 hash 四件事一起跟上',
  want(sRight, 'base64') && want(sLeft, 'timestamp') && want(sEnd, 'regex')
  && want(sHome, 'timestamp') && want(sDown, 'base64'),
  [['→', sRight], ['←', sLeft], ['End', sEnd], ['Home', sHome], ['↓', sDown]].map(([k, st]) => shot(k, st)).join(' ；'));
/** 读到滚动落定为止：站点若开了 `scroll-behavior:smooth`，一次固定 sleep 会量到半路 */
const readYStable = async () => {
  let prev = await evalJs('Math.round(window.scrollY)');
  for (let i = 0; i < 25; i += 1) {
    await wait(80);
    const y = await evalJs('Math.round(window.scrollY)');
    if (y === prev) return y;
    prev = y;
  }
  return prev;
};
/** 滚到"页中间"并回报落点：Home/End 的浏览器默认动作分别甩向 0 与页底，只有从中间起步才分得出 */
const scrollToMid = async () => {
  await evalJs(`(() => { const de=document.documentElement;
    window.scrollTo({ top: Math.round((de.scrollHeight - window.innerHeight) / 2), behavior: 'instant' });
    return 1; })()`);
  return readYStable();
};
/**
 * 3d 不自写像素阈值，而是**当场造一把尺子**：先把焦点放到没有键盘处理器的 `main` 上，
 * 按同一族键量出"默认动作走多远"；再放到 tab 上按同样的键量一遍。判的是后者远小于前者。
 * 这样它既有牙（摘掉 `panel-dom.js:197` 那句 `preventDefault()` 就回到尺子的量级），
 * 又不会被 `focus()` 把新 tab 蹭进视口那几十 px 误杀（第一版写死 `=== Y0` 就是假红）。
 */
await evalJs(`(() => { const m=document.querySelector('main'); m.tabIndex = -1; m.focus(); return m.tagName; })()`);
const mid0 = await scrollToMid(); await press('End', 'End', 35);
const ctlEnd = await readYStable();
const mid1 = await scrollToMid(); await press('Home', 'Home', 36);
const ctlHome = await readYStable();
await focusOn('tk-tab-timestamp');
const mid2 = await scrollToMid(); await press('End', 'End', 35);
const tabEnd = await readYStable();
await focusOn('tk-tab-timestamp');
const mid3 = await scrollToMid(); await press('Home', 'Home', 36);
const tabHome = await readYStable();
await evalJs('window.scrollTo({ top: 0, behavior: "instant" }); 1'); await wait(120);
const dEnd = Math.abs(ctlEnd - mid0); const dHome = Math.abs(ctlHome - mid1);
const tEnd = Math.abs(tabEnd - mid2); const tHome = Math.abs(tabHome - mid3);
check('3d 方向族键落在 tab 上时不触发浏览器默认滚动（与"无处理器的同一族键"当面对照）',
  mid0 > 40 && dEnd > 200 && dHome > 200 && tEnd < dEnd * 0.25 && tHome < dHome * 0.25,
  `从中间起步：无处理器 End 走 ${dEnd}px、Home 走 ${dHome}px；落在 tab 上 End 走 ${tEnd}px、`
    + `Home 走 ${tHome}px（判线 <25%）；mid=${mid0}/${mid1}/${mid2}/${mid3} y=${ctlEnd}/${ctlHome}/${tabEnd}/${tabHome}`);

// 复制那一条：先把 base64 这块切出来，再用真按键把这一栏算出来（粘贴框上裸 Enter 不许算、
// Ctrl+Enter 才算），最后把焦点落到复制按钮上真按 Enter。剪贴板那一路与 execCommand 兜底
// 那一路各挂一个 spy，两条都记账——只判"按钮改口了"等于没判复制到的到底是谁。
await evalJs(`document.getElementById('tk-tab-base64').click(); 1`); await wait(80);
await installSpies();
await putValue('tk-in-base64-text', 'Better');
await enterOn('tk-in-base64-text');
const b64Bare = await readOut('tk-out-base64-main');
await enterOn('tk-in-base64-text', 2);
const b64Ctrl = await readOut('tk-out-base64-main');
/**
 * 裸 Enter 那一次**把换行敲进了粘贴框**（这正是 3e 要判的行为），于是紧接着的复制拿到的载荷
 * 是 `Better\\n` 的编码，不是 `Better` 的。第一版把期望写死成 `QmV0dGVy` 就红了——那一条红
 * 得没有道理：复制到的正是屏幕上那一行结果。所以这里显式把输入清回 `Better` 再算一次，
 * 期望值由 Node 侧现算（不是抄来的串），判的才是"按钮 Enter → 复制到的 == 这次算出来的载荷"。
 */
await putValue('tk-in-base64-text', 'Better');
await enterOn('tk-btn-base64-main');
const COPY_WANT = Buffer.from('Better', 'utf8').toString('base64');
const copyBefore = await evalJs(`(() => { const b=document.getElementById('tk-copy-base64-main');
  return { disabled: b.disabled, label: b.textContent.trim() }; })()`);
const focusCopy = await focusOn('tk-copy-base64-main');
await press('Enter', 'Enter', 13);
await wait(140);
const copyFlash = await evalJs(`(() => { const b=document.getElementById('tk-copy-base64-main');
  return { label: b.textContent.trim(), spy: window.__spy.copy.slice(), exec: window.__spy.exec }; })()`);
await wait(1750);
const copyAfter = await evalJs(`document.getElementById('tk-copy-base64-main').textContent.trim()`);
check('3e 粘贴框里裸 Enter 不算、Ctrl+Enter 才算（吞掉用户敲的那次换行是缺陷）',
  !/QmV0dGVy/.test(b64Bare.text) && /QmV0dGVy/.test(b64Ctrl.text),
  `裸 Enter 后 out=「${b64Bare.text.slice(0, 46)}」；Ctrl+Enter 后 out=「${b64Ctrl.text.slice(0, 46)}」`);
check('3f 真按 Enter 触发复制：算过之后按钮才解除 disabled，Enter 走 clipboard 或兜底那一条并记下原文，'
  + '改口"已复制"之后 1.6s 恢复原案',
  focusCopy === 'ok' && copyBefore.disabled === false && copyFlash.spy.length === 1
  && copyFlash.spy[0] === COPY_WANT && copyFlash.label === '已复制' && copyAfter === '复制结果',
  `焦点=${focusCopy}；期望载荷=${COPY_WANT}（Node 现算 Buffer.from('Better')）；`
    + `原案=「${copyBefore.label}」(disabled=${copyBefore.disabled}) → 按下后=「${copyFlash.label}」`
    + ` → 1.9s 后=「${copyAfter}」；spy=${JSON.stringify(copyFlash.spy)}，execCommand 兜底走了 ${copyFlash.exec} 次`);

// §0.5 第 3 条：Esc 是**公共层**的回归，工具层不自造它。⌘K 开 → 真按 Esc → #cmdk 回 hidden，
// 并且这一族按键不许把工具面板带走（判前后同一块面板还选中着，而不是硬编码某一块）。
// 用 **Ctrl+K 而不是 Meta+K**：`editorial.js:745` 那条判的是 `metaKey || ctrlKey`，两把都认；
// 而 Meta+K 在 macOS 上是浏览器自己的"聚焦地址栏"加速器，无头窗口没有地址栏——第一版就是
// 在这一步整条挂死（CDP 命令发出去没有回音，日志停在 3f 之后五分钟一个字都不多）。
// 这一族改成"页内快捷键仍然真按，但按的是页面自己认的那一把"，量的还是真输入。
const beforeCmdk = await panelState();
await press('k', 'KeyK', 75, 2);
await wait(280);
const cmdkOpen = await evalJs(`(() => { const m=document.getElementById('cmdk');
  return m ? { exists: true, hidden: m.hidden, disp: getComputedStyle(m).display } : { exists: false }; })()`);
await press('Escape', 'Escape', 27);
await wait(280);
const cmdkAfter = await evalJs(`(() => { const m=document.getElementById('cmdk');
  return m ? { exists: true, hidden: m.hidden, disp: getComputedStyle(m).display } : { exists: false }; })()`);
const afterEsc = await panelState();
check('3g Esc 的公共层回归：页内搜索快捷键（metaKey||ctrlKey + k）开得出、真按 Esc 之后 #cmdk 回到 hidden，工具面板一块都没被带走',
  cmdkOpen.exists && cmdkOpen.hidden === false && cmdkAfter.exists && cmdkAfter.hidden === true
  && afterEsc.sel.join() === beforeCmdk.sel.join() && afterEsc.shown.join() === beforeCmdk.shown.join()
  && afterEsc.broken === 0,
  `⌘K 前面板=${beforeCmdk.sel.join()}；⌘K 后 hidden=${cmdkOpen.hidden}/display=${cmdkOpen.disp}；`
    + `Esc 后 hidden=${cmdkAfter.hidden}/display=${cmdkAfter.disp}，面板=${afterEsc.sel.join()}（标坏 ${afterEsc.broken} 块）`);

/* ══ 4) 禁 JS 降级 ═══════════════════════════════════════════════════════ */
GROUP = "4) 禁 JS 降级 4a";
await goto(URL_OF(PAGE)); await wait(420);
const withJs = await evalJs(`document.querySelector('main').innerText.replace(/\\s+/g,'').length`);
await goto(URL_OF('/nojs' + PAGE));
const nj = await evalJs(`(() => ({ panels: document.querySelectorAll('.tk-panel').length,
  links: document.querySelectorAll('.tk-index__link').length, scripts: document.querySelectorAll('script').length,
  text: document.querySelector('main').innerText.replace(/\\s+/g,'').length,
  forms: document.querySelectorAll('.tk-panel input, .tk-panel select, .tk-panel textarea').length,
  outs: [...document.querySelectorAll('.tk-out')].map((el)=>el.innerHTML.trim().length),
  caveat: /1 MiB/.test(document.querySelector('.tk-compliance').innerText),
  noscript: !!document.querySelector('.tk-compliance--noscript'),
  noscriptText: (document.querySelector('.tk-compliance--noscript') || {}).innerText || '',
  hiddenPanels: [...document.querySelectorAll('.tk-panel')].filter((p)=>p.hidden).length }))()`);
check('4a 摘掉全部 <script>：五块面板全展开、索引条五条链接、两句上限口径还在、正文不少于开 JS 那一版的 90%',
  nj.panels === 5 && nj.links === 5 && nj.scripts === 0 && nj.text >= withJs * 0.9
  && nj.caveat && nj.noscript && nj.hiddenPanels === 0 && nj.outs.every((n) => n === 0),
  `面板 ${nj.panels}、索引 ${nj.links}、控件 ${nj.forms}、展开 ${5 - nj.hiddenPanels}/5、`
    + `结果区 innerHTML 长度 ${nj.outs.join('/')}（全 0 才对：没有脚本就没有换算）；`
    + `口径句 1 MiB=${nj.caveat}、noscript 那句=${nj.noscript ? '在 DOM 里' : '不在'}（摊平后）`
    + `「${String(nj.noscriptText).replace(/\s+/g, ' ').trim().slice(0, 40)}」；`
    + `正文 禁JS ${nj.text} 字 / 开JS ${withJs} 字（${(nj.text / withJs * 100).toFixed(1)}%）、脚本 ${nj.scripts}`);

/* ══ 5) 首屏阻塞资源现量 ═════════════════════════════════════════════════ */
GROUP = "5) 首屏阻塞资源 5a";
await goto(URL_OF(PAGE)); await wait(500);
const rl = await evalJs(`(() => {
  const res = performance.getEntriesByType('resource').map((e) => ({
    name: e.name.replace(location.origin + ${JSON.stringify(BASE)}, ''), rb: e.renderBlockingStatus || 'n/a',
    xfer: e.transferSize || 0 }));
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const blocking = res.filter((r) => r.rb === 'blocking');
  const isLocal = (b) => b.name[0] === '/';
  const local = blocking.filter(isLocal), remote = blocking.filter((b) => !isLocal(b));
  return { htmlBytes: nav.transferSize || nav.encodedBodySize || 0, all: res.length,
    blocking: blocking.map((b) => b.name + ':' + b.xfer).join(' '),
    blockLocalSum: local.reduce((s, b) => s + b.xfer, 0), localCount: local.length,
    remoteBlock: remote.map((b) => b.name + ':' + b.xfer).join(' ') || '(无)',
    nonBlock: res.filter((r) => r.rb !== 'blocking').length,
    mine: res.filter((r) => /toolkit\\.min\\.css|toolkitCore|toolCodec/.test(r.name))
      .map((r) => r.name.split('/').pop() + '=' + r.rb + '/' + r.xfer).join(' ') }; })()`);
/**
 * 与段 2 的 5a 同一条形状，本页那三件换成 `toolkit.min.css` / `toolkitCore.min.js` /
 * `toolCodec.min.js`。判据只认这三件的**确切文件名**：宽松正则会把手伸进全站公共件
 * `index.min.css`、`normalize.min.css`，把阻塞集里本来就该有的东西当成缺陷。
 * `accountedFor` 兜另一种红法：资源表空/导航失败时"三件都不在阻塞集"会一起真，于是假绿。
 */
const MINE = ['toolkit.min.css', 'toolkitCore.min.js', 'toolCodec.min.js'];
const mineInBlocking = rl.blocking.split(' ').filter(Boolean)
  .map((e) => e.split(':')[0].split('/').pop()).filter((b) => MINE.includes(b));
const mineNonBlocking = MINE.every((f) => rl.mine.includes(`${f}=non-blocking`));
const accountedFor = rl.htmlBytes > 1000 && rl.localCount >= 3 && rl.blockLocalSum >= 50000;
check('5a 阻塞集里不含编码页专属件（三件全 non-blocking），并现量阻塞集的本地字节',
  mineNonBlocking && mineInBlocking.length === 0 && accountedFor,
  `HTML ${rl.htmlBytes}B；阻塞集本地 ${rl.blockLocalSum}B（${rl.localCount} 件，可复算）+ 外链 `
    + `${rl.remoteBlock}；本页三件实测 ${rl.mine}；非阻塞 ${rl.nonBlock} 件 / 资源表共 ${rl.all} 件`);

/* ══ 6) §0.5 第 1 条：监听累计（前半程）══════════════════════════════════ */
GROUP = "6) 监听累计 6a";
check('6a 到目前为止：本源异常与 error 级为 0，且本页那三件与页面本身一条都不出'
  + '（站级 warning 不判红、逐条列账归因）',
  noisePass(), noiseShot());

/* ══ 7) 五块面板各真算一次 ═══════════════════════════════════════════════ */
GROUP = "7) 五块面板各真算 7a–7e";
/** 切到某块面板（点 tab），并自证真切过去了 */
const selectPanel = async (tab) => {
  await evalJs(`document.getElementById('tk-tab-${tab}').click(); 1`);
  await wait(80);
  const st = await panelState();
  if (st.sel.join() !== tab) throw new Error(`切面板失败：要点 ${tab}，实际选中 ${st.sel.join()}`);
  return st;
};
await selectPanel('timestamp');
await putValue('tk-in-timestamp-value', '1700000000');
await enterOn('tk-in-timestamp-value');
const tsOut = await readOut('tk-out-timestamp-main');
const tsDiff = await readOut('tk-out-timestamp-diff');
const tsCopyDisabled = await evalJs(`document.getElementById('tk-copy-timestamp-main').disabled`);
check('7a #timestamp 单行格裸 Enter 就提交：1700000000 推出 2023-11-14T22:13:20Z，求差那一栏不被带着算',
  /2023-11-14/.test(tsOut.text) && /22:13:20/.test(tsOut.text) && tsCopyDisabled === false
  && /等待输入/.test(tsDiff.text),
  `main out=「${tsOut.text.slice(0, 88)}」；diff 仍是「${tsDiff.text.slice(0, 20)}」；复制 disabled=${tsCopyDisabled}`);

await selectPanel('base64');
await putValue('tk-in-base64-text', '编码 Better ✔');
await enterOn('tk-btn-base64-main');
const b64 = await readOut('tk-out-base64-main');
const B64_WANT = Buffer.from('编码 Better ✔', 'utf8').toString('base64');
check('7b #base64 中文 + 符号：编码串与 Node Buffer 现算逐字相等',
  b64.text.includes(B64_WANT),
  `out=「${b64.text.slice(0, 110)}」；期望载荷 ${B64_WANT}`);

await selectPanel('url');
await putValue('tk-in-url-text', 'a b?c=d&e 中');
await enterOn('tk-btn-url-main');
const url = await readOut('tk-out-url-main');
check('7c #url 两档给不同答案：encodeURI 留住 ? 与 =，encodeURIComponent 把它们也编掉',
  /a%20b\?c=d&e%20/.test(url.text) && /c%3Dd/.test(url.text),
  `out=「${url.text.slice(0, 160)}」`);

await selectPanel('digest');
await setSelect('tk-in-digest-mode', 'text');
await putValue('tk-in-digest-payload', 'abc');
await enterOn('tk-btn-digest-main');
for (let i = 0; i < 40 && (await evalJs(`document.getElementById('tk-copy-digest-main').disabled`)) === true; i += 1) await wait(100);
const dig = await readOut('tk-out-digest-main');
/**
 * 期望值**在这里现算**，不抄常量。第一版把五条教科书向量抄成字面量，其中 sha384 抄错了
 * （错在中间 8 个十六进制位上），于是 7d 红成"页面算错了"——红的是量具。
 * `crypto` 从 Node 侧现算正好是 §8.1 立的那条对拍口径（"SHA-* 与 Node crypto 逐条对拍"、
 * "MD5 与旧实现对拍"），抄来的串反而不是口径。'abc' 这五个值同时是各算法的官方向量，
 * 所以这一条既是对拍、也是向量。
 */
const ABC = Object.fromEntries(['md5', 'sha-1', 'sha-256', 'sha-384', 'sha-512'].map((a) => [
  a, crypto.createHash(a).update('abc').digest('hex'),
]));
const digAll = dig.text.toLowerCase().replace(/ /g, '');
const digMiss = Object.entries(ABC).filter(([a, h]) => !digAll.includes(h)).map(([a]) => a);
check('7d #digest 文本通道五行全出：MD5 自实现 + SHA-1/256/384/512 与 Node crypto 对同一串现算逐字相等',
  dig.rows.reduce((a, b) => a + b, 0) >= 5 && digMiss.length === 0,
  `表 ${JSON.stringify(dig.rows)} 行；Node 现算 md5=${ABC.md5.slice(0, 12)}… sha384=${ABC['sha-384'].slice(0, 12)}…；`
    + `未命中=[${digMiss.join(',') || '无'}]；out=「${dig.text.slice(0, 70)}」`);

await selectPanel('regex');
await putValue('tk-in-regex-pattern', '(\\d+)-(\\d+)');
await putValue('tk-in-regex-flags', 'g');
await putValue('tk-in-regex-text', 'a 12-34 b 56-78');
await enterOn('tk-btn-regex-main');
const rgx = await readOut('tk-out-regex-main');
check('7e #regex 命中表与捕获组表同时出：2 处命中、组 1 与组 2 各两行，复制按钮跟着解除 disabled',
  /2 处/.test(rgx.text) && rgx.rows.reduce((a, b) => a + b, 0) >= 4
  && rgx.text.includes('12') && rgx.text.includes('78')
  && (await evalJs(`document.getElementById('tk-copy-regex-main').disabled`)) === false,
  `out=「${rgx.text.slice(0, 150)}」；各表行数 ${JSON.stringify(rgx.rows)}`);

/* ══ 8) 正则四档闸门（codec 专有：不炸页）═══════════════════════════════ */
GROUP = "8) 正则四档闸门 8a–8f";
await selectPanel('regex');
/**
 * 走一遍正则这一栏：切到这一块 + 填三格 + 可选的 limit，真按 Enter 触发主按钮，回结果区与页面状态。
 * **每次都先 `selectPanel('regex')`**：`focus()` 落在 `display:none` 的子树上是静默失败的，
 * Enter 就会打到别处，而 `readOut` 读到的是**上一轮的陈旧结果**——第一版 9c 正是这样：
 * 组 9 开头切去了 base64，9c 却直接在正则那栏按键，读回来的是 8f 那句「上限 7」，
 * 看着像"正则那一路的尺子和 Base64 不一致"，其实是量具读到了一张旧账单。
 * @returns {Promise<{ms:number,out:object,broken:number,alive:boolean}>}
 */
const regexCase = async (pattern, flags, text, limit) => {
  await selectPanel('regex');
  await putValue('tk-in-regex-pattern', pattern);
  await putValue('tk-in-regex-flags', flags);
  await putValue('tk-in-regex-text', text);
  await putValue('tk-in-regex-limit', limit === undefined ? '' : String(limit));
  const t0 = Date.now();
  const at = await enterOn('tk-btn-regex-main');
  const ms = Date.now() - t0;
  const out = await readOut('tk-out-regex-main');
  const st = await panelState();
  return { ms, out, broken: st.broken, alive: !!out && at === 'ok' && st.shown.join() === 'regex' };
};
const gSyntax = await regexCase('(', 'g', 'abc');
check('8a 闸门①语法档：非法模式交回 native 原话，面板不标坏、页面还在',
  gSyntax.out.text.length > 0 && !/等待输入/.test(gSyntax.out.text) && gSyntax.broken === 0 && gSyntax.alive,
  `耗时 ${gSyntax.ms}ms；out=「${gSyntax.out.text.slice(0, 120)}」；标坏的面板 ${gSyntax.broken} 块`);
const gLen = await regexCase('a'.repeat(501), 'g', 'aaa');
check('8b 闸门①长度档：501 字符的模式整体拒绝、不截断，句子里两个数都在',
  /501/.test(gLen.out.text) && /500/.test(gLen.out.text) && /整体拒绝|不截断/.test(gLen.out.text),
  `耗时 ${gLen.ms}ms；out=「${gLen.out.text.slice(0, 120)}」`);
const gHigh = await regexCase('(a+)+$', '', 'a'.repeat(300) + 'b');
check('8c 闸门②静态可疑形状档（high）：(a+)+$ 一次都不执行并点名 F1，页面当场回话——"不炸页"就是这一条',
  /F1/.test(gHigh.out.text) && /一次都不执行/.test(gHigh.out.text) && gHigh.ms < 2000 && gHigh.broken === 0,
  `耗时 ${gHigh.ms}ms（判线 2000ms）；out=「${gHigh.out.text.slice(0, 150)}」`);
const gMedLong = await regexCase('a*a*a*a*a', '', 'a'.repeat(129));
const gMedEdge = await regexCase('a*a*a*a*a', '', 'a'.repeat(128));
/**
 * 判的是**结论徽章**，不是全文里出没出现"不截断"这三个字。
 * 第一版写 `!/不截断|整体拒绝/.test(gMedEdge.out.text)` 想要"128 放行"，可那一块面板的
 * 静态口径句（`regex.js:32`）本来就带着「都整体拒绝、不截断」，它印在结果区里、每轮都在——
 * 于是这条负判据永远为假，128 那一档怎么放行都会红。徽章是视图层唯一表达"这一轮的结论"的
 * 地方（`codecView.js` 的 `.tk-verdict`），拿它比才是拿被判断的东西比。
 */
check('8d 闸门②的 medium 档：可疑形状只对 ≤128 字符的输入求解，129 拒、128 放行（数的是字符不是字节）',
  gMedLong.out.verdict === '已拒收' && /实际 129 字符/.test(gMedLong.out.text)
  && gMedEdge.out.verdict === '有命中' && /可疑形状/.test(gMedEdge.out.text)
  && /不超过 128 字符/.test(gMedEdge.out.text),
  `129 字符→徽章「${gMedLong.out.verdict}」out=「${gMedLong.out.text.slice(0, 90)}」；`
    + `128 字符→徽章「${gMedEdge.out.verdict}」out=「${gMedEdge.out.text.slice(0, 90)}」`);
const gCap = await regexCase('a', 'g', 'a'.repeat(5000));
const capMax = Math.max(0, ...gCap.out.rows);
check('8e 闸门④命中上限档：5000 个命中只列前 1000，并且明说后面还有、不静默截断',
  capMax === 1000 && /1000/.test(gCap.out.text) && /不静默截断/.test(gCap.out.text),
  `各表行数 ${JSON.stringify(gCap.out.rows)}；out 头部=「${gCap.out.text.slice(0, 130)}」`);
const gLimit = await regexCase('a', 'g', 'a'.repeat(5000), 7);
check('8f 命中上限那一格用户能往下调：limit=7 就只列 7 行（上一格 1000 的账跟着变）',
  Math.max(0, ...gLimit.out.rows) === 7,
  `各表行数 ${JSON.stringify(gLimit.out.rows)}；out 头部=「${gLimit.out.text.slice(0, 120)}」`);

/* ══ 9) 字节闸门：三块面板同一把 1 MiB 尺子 ═════════════════════════════ */
GROUP = "9) 1 MiB 字节闸门 9a–9c";
const BIG_TEXT = 'a'.repeat(1048577);
const EXACT_TEXT = 'a'.repeat(1048576);
const spyOf = () => evalJs('JSON.stringify(window.__spy)');
/** 上一次 goto 是新文档，钩子随之没了；这一组的第一个动作前重新装，并记下安装形状 */
const SPY9 = await installSpies();
await selectPanel('base64');
await resetSpy();
await putValue('tk-in-base64-text', BIG_TEXT);
await enterOn('tk-btn-base64-main');
const b64Over = await readOut('tk-out-base64-main');
const overCopyDisabled = await evalJs(`document.getElementById('tk-copy-base64-main').disabled`);
const spy9 = JSON.parse(await spyOf());
await putValue('tk-in-base64-text', EXACT_TEXT);
await enterOn('tk-btn-base64-main');
const b64Exact = await readOut('tk-out-base64-main');
check('9a 1 MiB 是"超过才拒"：正好 1,048,576 字节的 Base64 算得出结果，1,048,577 字节的整体拒绝并说明差多少',
  /1048577/.test(b64Over.text) && /整体拒绝|不截断/.test(b64Over.text)
  && !/1048577/.test(b64Exact.text) && b64Exact.html > 200,
  `+1 拒：「${b64Over.text.slice(0, 96)}」；正好：out 的 innerHTML ${b64Exact.html}B、全文 ${b64Exact.full.length} 字、`
    + `头部「${b64Exact.text.slice(0, 30)}」`);
check('9b 越界的输入不进计算通道，也不被回显：拒收那一轮复制按钮仍 disabled、结果区全文 < 600 字、没叫过 subtle.digest',
  overCopyDisabled === true && b64Over.full.length < 600 && spy9.digest.length === 0,
  `钩子安装形状：${SPY9}；复制 disabled=${overCopyDisabled}；out 全文 ${b64Over.full.length} 字（判线 < 600）；`
    + `spy=${JSON.stringify(spy9).slice(0, 140)}`);
const rxOver = await regexCase('a', 'g', BIG_TEXT);
check('9c 正则那一路用的是同一把尺子：1,048,577 字节的输入整体拒绝，句子里的数与 Base64 那格一致',
  rxOver.alive && /1048577/.test(rxOver.out.text) && /1048576|1 MiB/.test(rxOver.out.text)
  && rxOver.out.verdict === '已拒收' && rxOver.broken === 0,
  `alive=${rxOver.alive}（假=面板没切过去、读到的是上一轮旧账单）；徽章「${rxOver.out.verdict}」`
    + `out=「${rxOver.out.text.slice(0, 130)}」；耗时 ${rxOver.ms}ms`);

/* ══ 10) 文件通道：走 ArrayBuffer，不走字符串 ═══════════════════════════ */
GROUP = "10) 文件通道 10a–10c";
await selectPanel('digest');
const switchMode = async (mode) => {
  await setSelect('tk-in-digest-mode', mode);
  return evalJs(`(() => ({ payload: document.getElementById('tk-when-digest-payload').hidden,
    upload: document.getElementById('tk-when-digest-upload').hidden }))()`);
};
const hiddenState = await switchMode('file');
/**
 * `DOM.setFileInputFiles` 要 objectId：先 `Runtime.evaluate` 拿到那个 `<input>` 的对象 id，
 * 再让浏览器**自己**给这个 input 填上 files——这是"用户真选了文件"在这台 headless 上唯一的
 * 等价物（没有原生文件选择器可点）。填完之后的那一次计算走真按键。
 * @param {string} id 输入框 id
 * @param {string[]} files 本机绝对路径
 */
const setFiles = async (id, files) => {
  const r = await S('Runtime.evaluate', { expression: `document.getElementById(${JSON.stringify(id)})`, objectGroup: 't8' });
  if (r.exceptionDetails || !r.result.objectId) throw new Error(`拿不到 ${id} 的 objectId：${JSON.stringify(r).slice(0, 160)}`);
  await S('DOM.setFileInputFiles', { files, objectId: r.result.objectId });
  return evalJs(`(() => { const el=document.getElementById(${JSON.stringify(id)});
    return { n: el.files.length, name: el.files[0] ? el.files[0].name : '', size: el.files[0] ? el.files[0].size : 0 }; })()`);
};
await resetSpy();
const bigFile = await setFiles('tk-in-digest-upload', [FILE_BIG]);
await enterOn('tk-btn-digest-main');
await wait(160);
const bigOut = await readOut('tk-out-digest-main');
const bigSpy = JSON.parse(await spyOf());
check('10a 文件超 5 MiB：按**声明字节**整体拒绝、明说"不读进内存"，arrayBuffer 一次都没被叫',
  bigFile.n === 1 && bigFile.size === 5242881 && /5242881/.test(bigOut.text)
  && /5242880|5 MiB/.test(bigOut.text) && /不读进内存/.test(bigOut.text)
  && bigOut.verdict === '已拒收' && bigSpy.ab === 0 && bigSpy.digest.length === 0,
  `钩子安装形状：${SPY9}；files=${JSON.stringify(bigFile)}；out=「${bigOut.text.slice(0, 130)}」；`
    + `spy ab=${bigSpy.ab} text=${bigSpy.text} digest=${bigSpy.digest.length}`);
await resetSpy();
const okFile = await setFiles('tk-in-digest-upload', [FILE_OK]);
await enterOn('tk-btn-digest-main');
for (let i = 0; i < 60 && (await evalJs(`document.getElementById('tk-copy-digest-main').disabled`)) === true; i += 1) await wait(120);
const fileOut = await readOut('tk-out-digest-main');
const fileSpy = JSON.parse(await spyOf());
const fileHex = fileOut.text.replace(/ /g, '').toLowerCase();
/** SHA 四档各一次 `subtle.digest`，且每一次收到的字节数都正好是整个文件 */
const SHA_ALGOS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
const shaSeen = fileSpy.digest.map((d) => d.algo).sort().join(',');
const shaWanted = [...SHA_ALGOS].sort().join(',');
check('10b 200 KB 的文件走字节通道算出五行：arrayBuffer 被叫而 text() 全程 0 次，'
  + 'subtle.digest 四次收到的字节数 == 文件字节数，MD5/SHA-1/SHA-256 与 Node 对同一份字节算出的值逐字相等',
  okFile.n === 1 && fileSpy.ab >= 1 && fileSpy.text === 0
  && fileSpy.digest.length === 4 && shaSeen === shaWanted
  && fileSpy.digest.every((d) => d.bytes === OK_BYTES)
  && fileOut.rows.reduce((a, b) => a + b, 0) >= 5
  && FILE_ANSWER.every((a) => fileHex.includes(a.hex)),
  `files=${JSON.stringify(okFile)}；spy ab=${fileSpy.ab} text=${fileSpy.text} `
    + `digest=${JSON.stringify(fileSpy.digest)}；SHA 档命中=[${shaSeen}]（应为 ${shaWanted}）；`
    + `Node md5=${FILE_ANSWER[0].hex.slice(0, 16)}… `
    + `浏览器命中=${FILE_ANSWER.map((a) => a.algo + '=' + (fileHex.includes(a.hex) ? '✓' : '✗')).join(' ')}；`
    + `out=「${fileOut.text.slice(0, 80)}」`);
check('10c 两条通道两个闸门：切到「本地文件」时文本框整段 hidden、文件框露出（不留孤儿控件）',
  hiddenState.payload === true && hiddenState.upload === false,
  `file 档：payload hidden=${hiddenState.payload}、upload hidden=${hiddenState.upload}`);

/* ══ 11) 收尾再核监听：大输入与文件那几轮没引出异常 ════════════════════ */
GROUP = "11) 收尾再核监听 11a";
check('11a 全程结束时：本源异常与 error 级仍为 0、本页那三件仍一条都不出'
  + '（含 1 MiB 边界、5 MiB 文件、灾难形状与各次真按键）',
  noisePass(), noiseShot());

/* ══ 汇总 ═══════════════════════════════════════════════════════════════ */
const red = results.filter((r) => !r.pass);
console.log(`\n合计 ${results.length} 项，红 ${red.length} 项`
  + (red.length ? `：${red.map((r) => r.id.split(' ')[0]).join('、')}` : ''));
console.log(`# Chrome pid=${chrome.pid}（本轮自己 spawn 的那一台）；站外噪声（被排除、不进判据）${noise.logRemote} 条`);

fs.rmSync(scratch, { recursive: true, force: true });
chrome.kill();
server.close();
process.exit(red.length ? 1 : 0);
