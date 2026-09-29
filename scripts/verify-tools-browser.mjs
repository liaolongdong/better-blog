#!/usr/bin/env node
/**
 * 段 4 Task 8：在线工具三页的**公共六族**浏览器核验 + JSON 页专有那四族。
 * 真 Chrome + CDP，无第三方依赖（Node 22 的全局 WebSocket），骨架照 `verify-codec-browser.mjs`
 * （段 3 Task 8）与 `verify-idcard-browser.mjs`（段 2 Task 10）。
 *
 * 为什么新建一本而不是改那两本（计划 §0.8 的原文，本格照做）：
 * `verify-idcard-browser.mjs` 正被另一路会话改着（`M` 态），`verify-codec-browser.mjs` 身上钉着
 * `verify-codec-browser-teeth.mjs` 那五刀（按字符串与行号耦合）。把它俩合成公共表只有两种落笔：
 * 替别人发表未提交的改动，或者和它抢同一个文件。本文件把**通用六族提成 profile 驱动的表**，
 * profile 从 `_data/onlineTools.yml` 现读（`slug` / `url` / `prefix` / `layout` / `panels`），
 * 脚本里不再抄第二张页表——§4.2 那条「同一份事实不写第二遍」对核验脚本同样成立。
 * 重复面（通用六族在编码页那一本里还有一份）记在段 4 Task 9 的收口账第 3 笔。
 *
 * 证件页那四条缺口（spec §8.3 对账表末「方向键 / 真 `Enter` / `Esc` / Console 监听」）由
 * **本文件的 `panels` 那一支**关掉：三页逐族都跑，idcard 是其中一条 profile，不动它自己的脚本。
 *
 * 判据分组（每一项的编号前带 `<slug>/`，三页各算各的数）：
 *   0) 环境与快照自证：隔离快照、无重建进程、md5 同源、闸门常数从源码现读。
 *   1) 十档视口 360/640/641/880/900/901/920/940/1280/1920：横向溢出、分栏换挡点**只许落在 SCSS
 *      现读出来的那几个 `(max-width: N)` 上**、`layout` 各自的退档形状、901–1100 带长行输入的撑破。
 *   2) 昼/夜 × 三档纸色温 = 6 组 × 每页三处正文，现算对比度（判线 4.5）+ 档位与类名一致。
 *   3) 键盘（`Input.dispatchKeyEvent` 真按）：`Tab` 链走进下拉、焦点环不是 `outline:none`、
 *      `Esc` 关公共层 ⌘K 且不许把工具面板带走——这四条是公共层。`layout` 分派那一条：
 *      `panels` 是方向键切面板（selected / roving / hidden / 焦点 / hash 五件事一起跟上）＋
 *      方向族键落在 tab 上不许触发浏览器默认滚动；`workbench` 换成「↑/↓ 不许劫持 textarea 的
 *      原生滚动」。再加两族 `Enter`：粘贴框里裸 `Enter` 不算（且那一次换行要真的落进框里）、
 *      真 `Enter` 落在复制按钮上走的是与 `click` 同一条通道、载荷逐字相同。
 *   4) 禁 JS：同源副本摘掉全部 `<script>` 并把 `<noscript>` 摊平，核控件还在、结果区空、
 *      那两句口径逐条还在、正文不少于开 JS 那一版的 90%。
 *   5) 首屏阻塞集：按 `renderBlockingStatus` 现量；本页专属那几件（清单在 `PER_PAGE`，
 *      并**自证每一件真的出现在资源表里**，防止清单自己漂成第二处口径）全不在阻塞集。
 *   6) Console 三档归因：本源 error 级 0 条、本页专属那几件与页面本身 0 条、站级 warning 只列账。
 *   ── 7–10 是 JSON 页专有（§V ③ 的真浏览器版 / §W 的复制与下载 / §7 深样本那一档）──
 *   7) 树视图滚动上界：常驻节点恰三块、任意滚动位置下 DOM 行数 ≤ `RENDER_WINDOW`、
 *      垫片 + 行容器 + padding 与 `scrollHeight` 自洽（总行数按夹具构造独立数出来）、
 *      行高 == `--jt-row-h` 那把尺、滚到底拿得到最后一行。
 *   8) Pointer 点击复制（真鼠标 + 命中测试自证）：载荷 == 本脚本**自己按 RFC 6901 现算**的那一条
 *      （键名带 `/` 与 `~`，转义档必须露出来），同时 == 那一行自己的 `data-jt-copy`。
 *   9) 三档硬输入：5 MiB 整放行、5 MiB+1 整体拒绝且不回显那一大串、200 层放行且给得出统计；
 *      外加「粘贴 2 MB 连发 20 次 `input`，点按钮之前不出现解析结果、整段不卡死」。
 *  10) 下载 `.json`：`createObjectURL` 收到的那一枚是真 `Blob`、其内容逐字节 == 当前那一栏的正文、
 *      MIME 与文件名跟着栏目类别走、`revokeObjectURL` 被叫到、body 里不留游离 `<a>`。
 *  11) §7 那两行的**先量后立**（Node 侧，不开页）：口径按计划 §0.5 写死的那一把尺，
 *      `cat f | gzip -9 | wc -c` 走 stdin，并复算 level 6↔9；证件页与编码页那四行同表重算，
 *      给 Task 9 的对账账本用。
 *
 * 两条硬口径（计划原文）：
 *   · `TK_SITE_DIR` **必须**指向一份隔离快照；指到仓库自己的 `_site`（或不设）直接退 2——
 *     那一格是 `pnpm dev` 与并行会话共用的构建输出，往里注错等于量别人正在改的产物。
 *   · 开跑前先证明 `jekyll serve` / `vite build --watch` 都没在跑，并按 md5 证明快照与工作树
 *     的产物是同一批字节（段 3 Task 8 的规矩）。
 *
 * 跑法：`TK_SITE_DIR=/tmp/seg4t8/_site node scripts/verify-tools-browser.mjs`
 * 退出码 0 = 全绿，1 = 有红项，2 = 环境没起来 / 量具自己挂了。
 */
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.TK_SITE_DIR ? path.resolve(process.env.TK_SITE_DIR) : null;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = '/better-blog';
const VPS = [360, 640, 641, 880, 900, 901, 920, 940, 1280, 1920];
const die = (msg) => { console.log(`✗ 环境没起来：${msg}`); process.exit(2); };

if (!SITE) die('没给 TK_SITE_DIR。本格只认隔离快照（仓库 _site 是 pnpm dev 与并行会话共用的输出）');
if (SITE === path.join(ROOT, '_site')) {
  die(`TK_SITE_DIR 指到了仓库自己的 _site（${SITE}）——那一格是共享构建输出，不许往里注错`);
}
if (!fs.existsSync(SITE)) die(`TK_SITE_DIR=${SITE} 不存在`);

/**
 * profile 从数据源现读，不在脚本里再抄一张页表（§4.2）。
 * 读法照 `check-tools-surface.mjs`：Ruby 的 psych 把 yml 转 JSON，Node 侧不引 YAML 依赖。
 */
const YML_PATH = path.join(ROOT, '_data/onlineTools.yml');
const ALL_PROFILES = JSON.parse(execFileSync('ruby',
  ['-e', 'require "yaml"; require "json"; puts YAML.load_file(ARGV[0]).to_json', YML_PATH],
  { encoding: 'utf8' })).filter((e) => e.status === 'ready');
/**
 * `TK_PAGES=idcard,json` 只跑其中几页——**开发期的迭代开关，不是门禁的跑法**。
 * 留在这里而不是每次改代码临时加，是因为它必须响亮地承认自己跑的是子集：汇总行会带
 * 「部分页」，否则一次单页绿的读数长得和六道门禁里那一格全绿一模一样（记忆规则
 * 「管道会吞掉退出码」的同一家族：读数不能骗人）。
 */
const ONLY = (process.env.TK_PAGES || '').split(',').map((s) => s.trim()).filter(Boolean);
const PROFILES = ONLY.length ? ALL_PROFILES.filter((p) => ONLY.includes(p.slug)) : ALL_PROFILES;
if (ONLY.length && PROFILES.length !== ONLY.length) {
  die(`TK_PAGES 里有认不出的页名：${ONLY.filter((s) => !ALL_PROFILES.some((p) => p.slug === s)).join(' ')}`
    + `（可选 ${ALL_PROFILES.map((p) => p.slug).join('/')}）`);
}

/**
 * 每页那张**不可避免**的小表：样本输入、那两句口径的正则、本页专属件清单。
 * 为什么不并进 `_data/onlineTools.yml`：那份数据源的消费者是模板与门禁，往里加一栏「核验用的
 * 样本号码」等于让线上页面背上测试夹具。样本只有一条真约束——必须是**这一页能算出非空结果**的
 * 输入，红在「结果区是空的」时第一个要怀疑的就是这一格，所以每一格都写清了它凭什么。
 */
const PER_PAGE = {
  idcard: {
    // GB 11643 的校验位算得过，所以「读」那一栏给得出非空结果
    sample: '11010519491231002X',
    /**
     * 第二份样本只给 3e 用：判"Ctrl+Enter 才算"必须让两次按键面对**不同**的内容，
     * 否则"结果区没变"既可能是"没算"也可能是"算了但答案恰好一样"。这一枚校验位是错的。
     */
    sample2: '11010519491231002Y',
    caveat: [/不得用于任何真实身份用途/, /不发请求/],
    own: ['toolkit.min.css', 'toolkitCore.min.js', 'toolIdcard.min.js'],
  },
  codec: {
    sample: 'Better',                 // Base64 → QmV0dGVy，Node 侧同一条现算
    sample2: 'Qoder',                 // 同 idcard 那一格的理由：这条的编码结果与 Better 那条不同
    caveat: [/1 MiB/, /超限整体拒绝/],
    own: ['toolkit.min.css', 'toolkitCore.min.js', 'toolCodec.min.js'],
  },
  json: {
    sample: '{"a":1}',                // 合法 JSON，格式化给得出非空结果
    caveat: [/5 MiB/, /1000 层/],
    own: ['toolkit.min.css', 'toolJson.min.css', 'toolkitCore.min.js', 'toolJson.min.js'],
  },
};

/**
 * 分栏形状按 `layout` 分派。两支共同的形状是「换挡点 + 各档该长什么样」；
 * `shift` 是脚本侧的期望，声明集从 SCSS 现读（`declaredBps`），**两边不一致才叫发现事实**——
 * 单方面照抄另一边只是同义反复。
 */
const LAYOUT = {
  panels: {
    primary: '.tk-workspace',
    shift: 900,
    inner: { sel: '.tk-cols', shift: 640, oneClass: 'tk-cols--one' },
    index: '.tk-index',
    hint: '.tk-index__hint',
  },
  workbench: {
    primary: '.jt-workspace',
    shift: 900,
    gap: { wide: '20px', narrow: '18px' },
    treeHeight: (w, vh) => (w > 900 ? Math.min(520, 0.58 * vh) : w > 640 ? Math.min(420, 0.52 * vh) : Math.min(360, 0.46 * vh)),
    optColumn: { sel: '.jt-bar__group--opt', shift: 640 },
    gutter: { sel: '.jt-gutter', shift: 640, em: 3 },
  },
};

/** 从 SCSS 源文件现读 `(max-width: N)` 声明集：这是"换挡只许落在声明过的那一档"的那把尺。 */
function declaredBps(layout) {
  const files = layout === 'workbench' ? ['dev/sass/toolkit.scss', 'dev/sass/toolJson.scss']
    : ['dev/sass/toolkit.scss'];
  const out = new Set();
  for (const f of files) {
    for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8')
      .matchAll(/@media[^{]*?\(max-width:\s*(\d+)px\)/g)) out.add(Number(m[1]));
  }
  return [...out].sort((a, b) => a - b);
}

// ── 预检一：这台机器上有没有别人正在重建产物 ───────────────────────────────
/**
 * `jekyll serve` / `vite build --watch` 在跑时，快照或 `assets/` 会在量的中途被换掉，
 * 于是"红的是页面还是量具"根本分不开（段 3 Task 9 记的那条并行 watcher 假红）。
 * 这一格只**读**进程表，不杀任何进程（共享机上宽匹配 pkill 会连带杀别人的工装）。
 */
const ps = spawnSync('ps', ['-eo', 'pid,command'], { encoding: 'utf8' }).stdout || '';
const watchers = ps.split('\n').filter((l) => /jekyll\s+(serve|--watch)|vite\s+build\s+--watch/.test(l));
if (watchers.length) die(`有重建进程在跑，量的中途产物会换：\n    ${watchers.join('\n    ')}`);

// ── 预检二：md5 自证快照与工作树是同一批字节 ───────────────────────────────
/**
 * Task 7 之后如果谁又跑了一次 `pnpm build:assets`，快照里就是旧字节，而 §7 那两行量的正是这批
 * 字节——"量具与磁盘不一致"这一族静默说谎只有 md5 拦得住。
 */
const md5 = (f) => execFileSync('md5', ['-q', f], { encoding: 'utf8' }).trim();
const ASSET_RE = /assets\/(?:js|css)\/[A-Za-z0-9._-]+\.min\.(?:js|css)/g;
for (const p of PROFILES) {
  if (!PER_PAGE[p.slug]) die(`profile ${p.slug} 没有样本与专属件那两格——新登记一条 ready 条目要同时补这里`);
  if (!fs.existsSync(path.join(SITE, p.url.slice(1)))) die(`${SITE} 里没有 ${p.url}——先构建隔离快照`);
}
const md5Rows = [];
for (const p of PROFILES) {
  const html = fs.readFileSync(path.join(SITE, p.url.slice(1)), 'utf8');
  for (const rel of [...new Set(html.match(ASSET_RE) || [])]) {
    const inSnap = path.join(SITE, rel);
    const inWork = path.join(ROOT, rel);
    if (!fs.existsSync(inSnap)) die(`快照里缺 ${rel}`);
    if (!fs.existsSync(inWork)) die(`工作树里缺 ${rel}（快照有、磁盘没有 → 产物不是同一批）`);
    const a = md5(inSnap); const b = md5(inWork);
    md5Rows.push({ page: p.slug, rel, snap: a, work: b, same: a === b });
  }
}
const md5Bad = md5Rows.filter((r) => !r.same);

/**
 * §7 那两行的尺（计划 §0.5 原话）：`cat f | gzip -9 | wc -c` 走 **stdin**。
 * 不是 `gzip -9 -c f`（FNAME 头每件 +16–19B），也不是 `zlib.gzipSync`（同批字节差 293B 那一档）。
 * @param {string} f 绝对路径
 * @param {number} level 压缩级（6 与 9 两档都要量，抖动写进读数）
 * @returns {number} gzip 后的字节数
 */
const gz = (f, level = 9) => Number(execFileSync('sh',
  ['-c', 'cat "$1" | gzip -' + level + ' | wc -c', 'sh', f], { encoding: 'utf8' }).trim());

/** 闸门常数从源码现读，不抄第二遍 */
const CORE_SRC = fs.readFileSync(path.join(ROOT, 'dev/js/tools/json-core.js'), 'utf8');
const MAX_BYTES = Number(/export const MAX_INPUT_BYTES\s*=\s*(\d+)/.exec(CORE_SRC)[1]);
const MAX_DEPTH = Number(/export const MAX_DEPTH\s*=\s*(\d+)/.exec(CORE_SRC)[1]);
const DEEP_NOTE = /deepSample:\s*'([^']+)'/.exec(CORE_SRC)[1];

// ── 静态服务 ───────────────────────────────────────────────────────────────
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.once('listening', () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
    probe.listen(0, '127.0.0.1');
  });
}
const PORT = await freePort();
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon', '.map': 'application/json',
  '.mjs': 'text/javascript',
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
     * 禁 JS 那一档做三件事，少做一件就漏（编码页那一本的教训原样继承）：
     *   ① **先摘 HTML 注释**——不摘的话下面那条 `<script>` 正则会从注释**里面**那个假 `<script>`
     *      一路吞到下一个真 `</script>`：JSON 页写着「`toolJson.min.js` 的加载位置与 toolkitCore
     *      的先后是硬前提」那句注释，实测被吞掉 7,445B，`<main>` 整块没了，4a 当场以
     *      "页内异常 TypeError" 收场（那是量具的洞，不是页面的缺陷）；
     *   ② 摘掉全部 `<script>`；
     *   ③ **把 `<noscript>` 的子节点摊平**——Chrome 里 scripting 仍算 enabled，不摊平的话
     *      `querySelector('.tk-compliance--noscript')` 恒为 null，判据里就凭空挂着一句测不到的东西：
     *      红的时候看着像页面缺陷，绿的时候其实是没测。
     */
    body = Buffer.from(body.toString('utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<noscript>([\s\S]*?)<\/noscript>/gi, '$1'), 'utf8');
  }
  res.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

// ── JSON 专有四族的夹具（全部在 Node 侧构造，浏览器那一侧只回答"算得对不对"）──
/** 恰好 `MAX_INPUT_BYTES` 字节的合法 JSON：一个键 + ASCII 填充，长度按字节精确凑 */
const JSON_AT_LIMIT = (() => {
  const head = '{"pad":"'; const tail = '"}';
  const pad = MAX_BYTES - Buffer.byteLength(head + tail, 'utf8');
  if (pad < 1) die(`MAX_INPUT_BYTES=${MAX_BYTES} 小得凑不出填充串，夹具构造要重想`);
  return head + 'x'.repeat(pad) + tail;
})();
/** 越界那一条只多 1 字节：判的是"整体拒绝并说明差多少"，不是一眼能看出的大数 */
const JSON_OVER_LIMIT = JSON_AT_LIMIT.slice(0, -2) + 'x"}';
if (Buffer.byteLength(JSON_AT_LIMIT, 'utf8') !== MAX_BYTES) die('5 MiB 整那份夹具长度不对');
if (Buffer.byteLength(JSON_OVER_LIMIT, 'utf8') !== MAX_BYTES + 1) die('5 MiB+1 那份夹具长度不对');
/** 200 层嵌套：在 `MAX_DEPTH` 之下、正好落在 `DEEP_SAMPLE_DEPTH` 那一档，必须放行并且给得出统计 */
const JSON_DEEP_200 = `${'{"n":'.repeat(200)}1${'}'.repeat(200)}`;
/** 树视图那份多行文档：500 只对象 × 每只 10 键 ⇒ 默认展开就有 1 + 500×11 = 5,501 行 ≫ 80 */
const TREE_DOC = (() => {
  const o = {};
  for (let i = 0; i < 500; i += 1) {
    const inner = {};
    for (let k = 0; k < 10; k += 1) inner[`f${k}`] = i * 10 + k;
    o[`e${i}`] = inner;
  }
  return JSON.stringify(o, null, 2);
})();
/** 树那一族**独立**数出来的总行数（不叫页面自己报数，也不 import 站内那本 flatten） */
const TREE_ROWS = 1 + 500 * 11;
/**
 * Pointer 那一族的小文档：键名故意带 `/` 与 `~`，因为 RFC 6901 的转义（`~`→`~0`、`/`→`~1`）
 * **只有在这两枚键名上才露得出来**——不含它们的样本会让"照抄上游实现"和"按规范自己算"
 * 两种写法都能过，那一格就白测了。
 */
const POINTER_DOC = {
  普通键: { 'a/b': [1, 2, { 'c~d': 'x' }] },
  '带~波浪': { '斜杠/键': 'v' },
  数字串: { 0: 'zero' },
};
/**
 * 本脚本**自己按 RFC 6901** 现算的指针表：与 `json-core` 的 flatten 不共享一行代码。
 * 拿它比浏览器复制到的载荷，比的才是"两条独立实现算出同一条地址"，而不是页面自己跟自己对账。
 * @param {unknown} value 文档
 * @param {string[]} trail 已走过的段
 * @param {Map<string, string>} out 指针 → 一行可读的类型标签（拿去比 DOM 里那一行）
 */
function pointersOf(value, trail = [], out = new Map()) {
  if (value !== null && typeof value === 'object') {
    for (const k of Object.keys(value)) {
      const seg = `/${k.replace(/~/g, '~0').replace(/\//g, '~1')}`;
      const p = [...trail, seg].join('');
      out.set(p, Array.isArray(value[k]) ? 'array' : (value[k] !== null && typeof value[k] === 'object' ? 'object' : typeof value[k]));
      pointersOf(value[k], [...trail, seg], out);
    }
  }
  return out;
}
const POINTER_TABLE = pointersOf(POINTER_DOC);
/** 带转义的那一枚指针，脚本侧现算，等浏览器复制到的载荷逐字对上 */
const POINTER_ESCAPED = [...POINTER_TABLE.keys()].find((p) => p.includes('~1') || p.includes('~0'));
/** 2 MB 那一档：粘贴不自动解析 + 整段不卡死用的大输入（ASCII，字节数好算） */
const PASTE_2MB = `{"big":"${'y'.repeat(2 * 1024 * 1024)}"}`;

// ── Chrome + CDP ───────────────────────────────────────────────────────────
/**
 * flag 那一族照段 3 那本更稳的一版：本机开着系统代理时 `--host-resolver-rules` 一条都不参与，
 * 必须把代理一起摘掉（`direct://`）规则才开始说话；`MAP * ~NOTFOUND` 让站外**秒失败**而不是
 * 连上去等人回话，于是 `readyState` 不会永远不落 complete（段 2 那条"量具泡在网络里"的教训），
 * 也让 5a 那条"可复算的数只算本地块"真的稳。`EXCLUDE 127.0.0.1` 保住这一格自己的静态服务。
 */
const chromeProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'seg4t8-chrome-'));
const chrome = spawn(CHROME, ['--headless', '--remote-debugging-port=0',
  `--user-data-dir=${chromeProfile}`, '--disable-gpu', '--no-first-run',
  '--disable-background-networking', '--window-size=1280,900',
  '--proxy-server=direct://', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
/** 端点只认这行 stderr：它出自上面那个 pid，所以"连上别人的浏览器"从根上排除。 */
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
  on(fn) { this.handlers.push(fn); }
}
const c = new Conn(wsUrl);
await c.open();
const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });

/**
 * 每条 CDP 调用带死线，并把"当时正在跑哪一组"一起报出来：挂了的位置要自己报出来。
 * 死线串里必须带**那一发的表达式开头**——只报组名的话，一组里那十几发长得一模一样，
 * 下一轮排查还是得靠外面另写探针（本段 codec 第 3 族那次挂住就是这样）。
 * `TK_TRACE=1` 另开一档在途日志（→ 发出 / ← 落定 + 耗时），挂住时最后一条只有 → 没有 ←。
 */
const CDP_MS = 30000;
const TRACE = !!process.env.TK_TRACE;
let SEQ = 0;
const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 80);
let GROUP = '(启动)';
const S = (m, p = {}) => {
  const call = c.send(m, p, sessionId);
  call.catch(() => {}); // 超时之后那条迟到的拒绝不该把进程带崩
  const reqId = ++SEQ;
  const label = m === 'Runtime.evaluate' ? `${m} «${oneLine(p.expression)}»` : m;
  const t0 = Date.now();
  if (TRACE) process.stderr.write(`… ${reqId} → ${GROUP} :: ${label}\n`);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`CDP ${label} 在 ${CDP_MS / 1000}s 内没有回应（当时正在跑「${GROUP}」）`)), CDP_MS);
    call.then((r) => { if (TRACE) process.stderr.write(`… ${reqId} ← ${Date.now() - t0}ms\n`); resolve(r); },
      (e) => { if (TRACE) process.stderr.write(`… ${reqId} ✗ ${oneLine(e.message)}\n`); reject(e); })
      .finally(() => clearTimeout(timer));
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
  for (let i = 0; i < 250; i += 1) {
    if (await evalJs('document.readyState') === 'complete') return;
    await wait(60);
  }
  throw new Error('加载超时：' + url);
};
const setVp = (width, height = 900) => S('Emulation.setDeviceMetricsOverride',
  { width, height, deviceScaleFactor: 1, mobile: false });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/**
 * 真按键。`Enter` 那一次必须带 `text:'\r'`：`<button>` 上"Enter 等于点一下"走的是 Blink 的
 * 默认动作（keypress 转 click），只发 keyDown 时监听器收得到、默认动作整条不发生
 * （段 3 的 3f 就假红在这个缺口感应成"复制坏了"）。
 * `focus()` 允许是程序给的——被判的是按键处理，不是焦点怎么来。
 * @param {string} key `KeyboardEvent.key`
 * @param {string} code `KeyboardEvent.code`
 * @param {number} vk 虚拟键码
 * @param {number} [modifiers] CDP 位掩码：Alt 1 / Ctrl 2 / Meta 4 / Shift 8
 * @param {string} [text] 显式字符文本
 */
const press = async (key, code, vk, modifiers = 0, text = undefined) => {
  const base = { key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  if (modifiers) base.modifiers = modifiers;
  const txt = text ?? (key.length === 1 ? key : (key === 'Enter' ? '\r' : undefined));
  if (txt !== undefined) base.text = txt;
  await S('Input.dispatchKeyEvent', { type: 'keyDown', ...base });
  await S('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await wait(80);
};
/** 把焦点放到那一格上并**自证真放上了**：面板还 hidden 时 `focus()` 是静默失败的 */
const focusOn = (id) => evalJs(`(() => { const el=document.getElementById(${JSON.stringify(id)});`
  + ' if(!el) return "no-node"; el.focus();'
  + ' return document.activeElement && document.activeElement.id === ' + JSON.stringify(id) + ' ? "ok" : (document.activeElement.tagName||"?"); })()');
/**
 * 真鼠标点一击（§V 那两族「点 Pointer 复制 / 点容器行展开」的浏览器版）。
 * **先做命中测试**：`elementFromPoint` 拿到的必须就是目标自己或它的子节点，否则这一击落在视口外，
 * 会伪装成"交互坏了"的假红（记忆规则「真鼠标点击验证先做命中测试」）。
 * @param {string} sel 目标的选择器
 * @param {number} [nth] 同一选择器里的第几枚
 * @returns {Promise<{ok: boolean, why: string, x: number, y: number}>} ok=false 时带着没打中的原因
 */
const realClick = async (sel, nth = 0) => {
  const h = await evalJs(`(() => { const all=document.querySelectorAll(${JSON.stringify(sel)});`
    + ` const el=all[${nth}]; if(!el) return {ok:false,why:'no-node(n='+all.length+')',x:0,y:0};`
    + ` el.scrollIntoView({block:'center',inline:'center'});`
    + ' const r=el.getBoundingClientRect(); const x=Math.round(r.left+r.width/2), y=Math.round(r.top+r.height/2);'
    + ' const hit=document.elementFromPoint(x,y);'
    + " if(!hit) return {ok:false,why:'elementFromPoint=null',x,y};"
    + " if(!(hit===el||el.contains(hit)||hit.contains(el))) return {ok:false,why:'命中在别处:'+((hit.className||hit.tagName)+'').slice(0,40),x,y};"
    + ' return {ok:true,why:"hit",x,y}; })()');
  if (!h.ok) return h;
  await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: h.x, y: h.y });
  await S('Input.dispatchMouseEvent', { type: 'mousePressed', x: h.x, y: h.y, button: 'left', buttons: 1, clickCount: 1 });
  await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x: h.x, y: h.y, button: 'left', buttons: 0, clickCount: 1 });
  await wait(120);
  return h;
};
/** 往格子里写值并**补一次 input**：闸门读数挂在 input 监听上，只设 `.value` 不刷新读数 */
const putValue = (id, value, fire = true) => evalJs(`(() => { const el=document.getElementById(${JSON.stringify(id)});`
  + ' if(!el) return "missing"; el.value=' + JSON.stringify(String(value)) + ';'
  + (fire ? ' el.dispatchEvent(new Event("input",{bubbles:true}));' : '')
  + ' return String(el.value).length; })()');
const setSelect = (id, value) => evalJs(`(() => { const el=document.getElementById(${JSON.stringify(id)});`
  + ' if(!el) return "missing"; el.value=' + JSON.stringify(String(value)) + ';'
  + ' el.dispatchEvent(new Event("change",{bubbles:true})); return el.value; })()');
const clickById = (id) => evalJs(`(() => { const el=document.getElementById(${JSON.stringify(id)});`
  + ' if(!el) return "missing"; el.click(); return "clicked"; })()');
const readOut = (sel) => evalJs(`(() => { const el=document.querySelector(${JSON.stringify(sel)});`
  + ' return el ? { text: el.innerText.replace(/\\s+/g," ").trim(), html: el.innerHTML.length } : null; })()');
/** 只读纯文本那一格（状态读数那一行没有 markup，判它按文本判） */
const readText = (sel) => evalJs(`(() => { const el=document.querySelector(${JSON.stringify(sel)});`
  + ' return el ? el.innerText.replace(/\\s+/g," ").trim() : null; })()');
/**
 * 读一条**由防抖写出来**的读数：不是"等固定毫秒再读一次"，而是轮询到它**落定**才认。
 *
 * 为什么必须有这一只：段 4 Task 8 整轮（三页 72 项）里 `9d` 红过一次，单跑 `TK_PAGES=json`
 * 又立刻绿——那一格把 2 MB 灌进 `value` 后连发 20 次 `input`，然后 `await wait(500)` 读一次状态行，
 * 而前面那些组刚把主线程占满，防抖那一只 `setTimeout`（`jsonWorkbench.js` 的 `DEBOUNCE_MS`）
 * 在 500ms 内根本没轮到跑，读回来的是**开页时的旧账单**（`字节 0 · 行 1`）。
 * 这与段 3 那条"`focus()` 落在 `display:none` 子树里静默失败、读回来的是上一轮旧账单"是同一族的假红，
 * 只是这次的时钟是防抖，不是样式。
 *
 * 落定 = 连续 `NEED_SAME` 次采样同文（每次间隔 `POLL_MS`，合计要盖过 `DEBOUNCE_MS`），
 * 最多等 `timeoutMs`；**它不等任何期望值**，所以页面真把字节数算错时，照样带着那个错的数变红
 * （牙齿不在这格里丢）。耗时与采样数进读数，红的时候分得开"没落定"与"落定成错的数"。
 *
 * @param {string} sel 状态行选择器
 * @param {number} [timeoutMs] 落定上限
 * @returns {Promise<{text: string|null, settledMs: number, samples: number, quiet: boolean}>}
 *   落定后的文本、耗时、采样次数，以及"是否真的落定"（`false` = 到上限还在漂）
 */
const readSettledText = async (sel, timeoutMs = 4000, POLL_MS = 100, NEED_SAME = 3) => {
  const t0 = Date.now();
  let prev = null;
  let same = 0;
  let samples = 0;
  let cur = null;
  for (;;) {
    samples += 1;
    cur = await readText(sel);
    same = cur === prev ? same + 1 : 1;
    prev = cur;
    if (same >= NEED_SAME) return { text: cur, settledMs: Date.now() - t0, samples, quiet: true };
    if (Date.now() - t0 >= timeoutMs) return { text: cur, settledMs: Date.now() - t0, samples, quiet: false };
    await wait(POLL_MS);
  }
};

/**
 * 记账钩子。装不上就**抛**，让量具退 2 而不是让计数器安静停在 0——"钩子没装上"和
 * "钩子记到 0 次"在两处判定里长得一模一样（段 3 那本的假牙教训原样继承）。
 * 每次 `goto()` 都是新文档，所以每组的第一个动作前要重装；`resetSpy()` 只清计数。
 * @returns {Promise<string>} 安装形状自证串
 */
const installSpies = () => evalJs(`(() => {
  window.__spy = { copy: [], exec: 0, create: 0, revoke: 0, blobType: null, blobSize: null, isBlob: false, anchorName: null };
  const shape = [];
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText = (t) => { window.__spy.copy.push(String(t)); return Promise.resolve(); };
    shape.push('clipboard=on');
  } else shape.push('clipboard=absent');
  const oe = document.execCommand;
  if (oe) { document.execCommand = function (cmd) { if (cmd === 'copy') { window.__spy.exec += 1;
      // 兜底那一级复制的是临时 textarea：activeElement 就是它。选区读回来当第二证，
      // 免得"载荷是空串"这一格既可能是真复制了空、也可能是钩子抓错了地方。
      const ae = document.activeElement;
      const val = ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT') ? String(ae.value) : '';
      window.__spy.copy.push(val !== '' ? val : String(document.getSelection ? document.getSelection() : '')); }
      return oe.apply(document, arguments); }; shape.push('exec=on'); }
  if (typeof URL.createObjectURL !== 'function' || typeof URL.revokeObjectURL !== 'function')
    throw new Error('包不上：URL.createObjectURL / revokeObjectURL 不可调');
  const oc = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (b) => { window.__spy.create += 1;
    window.__spy.isBlob = (typeof Blob === 'function') && b instanceof Blob;
    window.__spy.blobType = b && b.type; window.__spy.blobSize = b && b.size;
    window.__lastBlob = b; return oc(b); };
  const rv = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = (u) => { window.__spy.revoke += 1; return rv(u); };
  // 下载那枚 <a> 在 finally 里就被摘掉了，事后读不到文件名 → 在 appendChild 那一格记下它的 download
  const oadd = Node.prototype.appendChild;
  Node.prototype.appendChild = function (n) {
    if (n && n.tagName === 'A' && n.download) window.__spy.anchorName = n.download;
    return oadd.apply(this, arguments);
  };
  shape.push('createObjectURL=on revoke=on appendChild=on');
  window.__spied = 1;
  return shape.join(' ');
})()`);
const resetSpy = () => evalJs('window.__spy = { copy: [], exec: 0, create: 0, revoke: 0, blobType: null, blobSize: null, isBlob: false, anchorName: null }; 1');
/** 把 spy 里那一枚 Blob 的内容读出来（Blob 对象不能跨 CDP 序列化，只能在页内 `.text()`；
 *  `evalJs` 带 `awaitPromise`，所以这里返回的 Promise 会在这一侧落定） */
const readBlobText = () => evalJs('window.__lastBlob && typeof window.__lastBlob.text === "function"'
  + ' ? window.__lastBlob.text() : null');

await S('Page.enable'); await S('Runtime.enable'); await S('Network.enable');
await S('Log.enable'); await S('DOM.enable');
await S('Network.setCacheDisabled', { cacheDisabled: true });

// ── 第 6 族：Console 三档归因（每页换一次账本） ─────────────────────────────
/**
 * 分层判线（段 3 那本原样继承，它红过一次就因为"本源"三个字不够细）：
 *   ① 异常与 error 级：本源一条都不许有；② 本页专属那几件与页面本身：任何级别 0 条；
 *   ③ 其余本源 warning：不判红但逐条列账——列不出归属就是②没兜住。
 * 站外一律 `~NOTFOUND`，那些网络失败是本格自己制造的噪声，单独计数、不进判据。
 */
let noise = blankNoise();
function blankNoise() { return { exceptionThrown: [], consoleError: [], logOwn: [], logRemote: 0 }; }
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
let OWN_RE = /$^/;
const noiseCount = () => ({
  err: noise.exceptionThrown.length
    + noise.consoleError.filter((x) => x.t === 'error').length
    + noise.logOwn.filter((x) => x.level === 'error').length,
  pageOwn: noise.logOwn.filter((x) => OWN_RE.test(x.url)).length
    + noise.consoleError.filter((x) => OWN_RE.test(x.url)).length,
  warnRest: noise.logOwn.filter((x) => x.level !== 'error' && !OWN_RE.test(x.url)).length,
});
const noiseGrouped = () => {
  const by = new Map();
  noise.logOwn.filter((x) => x.level !== 'error' && !OWN_RE.test(x.url)).forEach((x) => {
    const k = `${x.level}|${x.url}|${x.text.slice(0, 60)}`;
    by.set(k, (by.get(k) || 0) + 1);
  });
  return [...by.entries()].map(([k, n]) => `${k}×${n}`).join(' ；') || '(无)';
};
const noisePass = () => { const q = noiseCount(); return q.err === 0 && q.pageOwn === 0; };
const noiseShot = () => {
  const q = noiseCount();
  return `本源 error 级合计 ${q.err}（异常 ${noise.exceptionThrown.length}、console ${noise.consoleError.filter((x) => x.t === 'error').length}、`
    + `Log ${noise.logOwn.filter((x) => x.level === 'error').length}）、本页专属件与页面本身 ${q.pageOwn} 条、`
    + `站级 warning 不判红但列账 ${q.warnRest} 条；站外被排除 ${noise.logRemote} 条。非专属件归因：${noiseGrouped()}`
    + (noise.exceptionThrown.length ? ` 异常 ${JSON.stringify(noise.exceptionThrown.slice(0, 2))}` : '')
    + (noise.consoleError.length ? ` console ${JSON.stringify(noise.consoleError.slice(0, 2))}` : '');
};

const results = [];
const check = (id, pass, detail) => { results.push({ id, pass, detail }); console.log(`${pass ? '✓' : '✗'} ${id} — ${detail}`); };
/** 量具自己挂了走**单独一档退出码（2）**，不能和"判据红（1）"混成一个数 */
const teardown = () => {
  chrome.kill();
  server.close();
  // Chrome 的子进程在收到 SIGKILL 之后还会往 profile 里落最后几个字节，`rmSync` 撞上一个
  // 正在被写目录会抛 `ENOTEMPTY`（段 4 Task 8 的六刀变异里 T1、T5 两刀就这么挂的：25 项判据
  // 全量完了、期望那一条也点了，唯独收尾删目录抛错把退出码抬成 2，看着像"环境不对"）。
  // 删不干净只是留下一个临时目录，不是测量失败，所以：先给它 5 次 × 100ms 的机会，
  // 还删不掉就**明说**并继续——绝不让收尾把已经量出的读数盖掉。
  let err = null;
  for (let i = 0; i < 5; i += 1) {
    try { fs.rmSync(chromeProfile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); err = null; break; }
    catch (e) { err = e; }
  }
  if (err) console.log(`# ⚠ 收尾没删掉 Chrome profile ${chromeProfile}（${err.code || err.message}）——`
    + '只剩一个临时目录，读数与退出码都不受影响');
};
process.on('uncaughtException', (err) => {
  const red = results.filter((r) => !r.pass);
  console.log(`✗ 量具挂了（脚手架问题，不是页面缺陷）：当时正在跑「${GROUP}」\n  ${err.message}`);
  console.log(`  已量出 ${results.length} 项（红 ${red.length}）：${red.map((r) => r.id.split(' ')[0]).join('、') || '无'}`);
  teardown();
  process.exit(2);
});
// 顶层 await 里的拒绝在 ESM 下走 unhandledRejection，不走 uncaughtException，两条都得挂。
process.on('unhandledRejection', (err) => {
  process.emit('uncaughtException', err instanceof Error ? err : new Error(String(err)));
});
const tracks = (v) => String(v).trim().split(/\s+/).length;
const URL_OF = (p) => `${ORIGIN}${BASE}${p}`;
const px = (v) => Math.round(parseFloat(String(v)));
/** WCAG 2.x 相对亮度与对比度：判线 4.5 用的是这一把尺，不是"看着差不多" */
const lum = (rgb) => {
  const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number)
    .map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
/** 等宽 em 换算：`3em` 这类声明只能按**那一枚元素自己的 font-size** 折成 px 才对得上 */
const emOf = (sel) => evalJs(`(() => { const el=document.querySelector(${JSON.stringify(sel)});`
  + ' if(!el) return null; const cs=getComputedStyle(el);'
  + ' return { w: Math.round(parseFloat(cs.width)), fs: parseFloat(cs.fontSize) }; })()');
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
/** 滚到"页中间"并回报落点：Home/End 的默认动作分别甩向 0 与页底，只有从中间起步才分得出 */
const scrollToMid = async () => {
  await evalJs(`(() => { const de=document.documentElement;`
    + ` window.scrollTo({ top: Math.round((de.scrollHeight - window.innerHeight) / 2), behavior: 'instant' }); return 1; })()`);
  return readYStable();
};

console.log(`# Chrome pid=${chrome.pid} profile=${chromeProfile}`);
console.log(`# 快照 ${SITE}（与仓库 _site 无关）· profile 来自 ${path.relative(ROOT, YML_PATH)}`);
console.log(`# profile ${PROFILES.map((p) => `${p.slug}(${p.layout})`).join(' / ')} · 视口 ${VPS.join('/')}`);
if (ONLY.length) console.log(`# ⚠ TK_PAGES=${ONLY.join(',')} —— 本轮只跑 ${PROFILES.length}/${ALL_PROFILES.length} 页，`
  + '这是迭代用的子集读数，**不算门禁**（六道门禁那一格要三页全跑）');

// ══ 0) 环境与快照自证 ═══════════════════════════════════════════════════════
GROUP = '0) 环境与快照 0a–0d';
check('0a TK_SITE_DIR 是隔离快照，不是仓库自己的 _site', SITE !== path.join(ROOT, '_site'),
  `TK_SITE_DIR=${SITE}`);
check('0b 没有 jekyll serve / vite build --watch 在跑（否则量的中途产物会换）', watchers.length === 0,
  watchers.length ? watchers.join(' ; ') : '进程表里 0 条重建进程');
check('0c 快照里页面引用的每一件 min 产物与工作树逐字节同 md5', md5Bad.length === 0,
  `比对 ${md5Rows.length} 件（三页各自引用的 min 件，去重后）${md5Bad.length ? ` ← 不同源：${md5Bad.map((r) => `${r.page}:${r.rel}`).join(' ')}` : ' 全等'}`);
check('0d 闸门常数从 json-core.js 现读：5 MiB / 1000 层，夹具按字节精确凑',
  MAX_BYTES === 5242880 && MAX_DEPTH === 1000,
  `MAX_INPUT_BYTES=${MAX_BYTES}、MAX_DEPTH=${MAX_DEPTH}；夹具 整=${Buffer.byteLength(JSON_AT_LIMIT)}B / +1=${Buffer.byteLength(JSON_OVER_LIMIT)}B / 深=${JSON_DEEP_200.length}B`);

// ══ 逐页跑通用六族 ══════════════════════════════════════════════════════════
/** 每页的读数都带 `<slug>/` 前缀：三页同一族的形状对得上、数各算各的。 */
for (const P of PROFILES) {
  const cfg = PER_PAGE[P.slug];
  const L = LAYOUT[P.layout];
  const bps = declaredBps(P.layout);
  const pref = P.prefix;
  const html = fs.readFileSync(path.join(SITE, P.url.slice(1)), 'utf8');
  /** 面板键清单：`panels` 支读 yml，`workbench` 支读产物骨架那格 `data-jt-ids`（两处都是现读，不抄） */
  const panelKeys = P.layout === 'workbench'
    ? /data-jt-ids="([^"]+)"/.exec(html)[1].split(',').map((s) => s.trim())
    : P.panels.map((x) => x.slug);
  const PK = panelKeys[0];
  /**
   * 结果栏选择器。**只在 `workbench` 那一支有唯一答案**（这一页只有 `main` 一栏），
   * `panels` 支的栏位是 `read`/`gen` 两栏且随面板变，所以那一支从 DOM 现读（见 3e 的 `ids.out`），
   * 这里留 null 而不是猜一个——猜出来的选择器查不到节点时判据会假绿，那比红更难查。
   */
  const OUTSEL = P.layout === 'workbench' ? `#${pref}-out-${PK}-main` : null;
  /**
   * 现挑一块**真的有 `<textarea>`** 的面板，并把它那一栏的按钮 / 复制 / 结果区一起读回来。
   *
   * 为什么不按 `panelKeys[0]` 拿：编码页第一块是 `#timestamp`，那一块只有单行格——上一版按它查
   * `textarea` 拿回 `null`，`putValue` 吐回 `"missing"`，判据里那句"输入 missing 字"量的其实是
   * "输入根本没写进去"，那条红是量具的缺陷不是页面的。证件页反过来：`#idcard` 有粘贴框，
   * 但同一块里有 `gen`/`read` 两栏，栏位也不能猜。
   *
   * 栏位从**按钮 id 现读**，不按输入框自己的后缀推：编码页 `tk-in-base64-text` 配的是
   * `tk-btn-base64-main`（后缀 `text` 那一栏根本不存在），证件页 `tk-in-idcard-read` 才与
   * `tk-btn-idcard-read` 同名。两页只差一处，写死任一种口径都会在另一页假红。
   */
  const pickTaPanel = () => evalJs(`(() => {
    const keys = ${JSON.stringify(panelKeys)}, pre = '${pref}';
    for (const k of keys) {
      const p = document.getElementById(pre + '-panel-' + k); if (!p) continue;
      const ta = p.querySelector('textarea'); if (!ta) continue;
      const bp = pre + '-btn-' + k + '-', op = pre + '-out-' + k + '-', cp = pre + '-copy-' + k + '-';
      const sides = [...new Set([...p.querySelectorAll('button[id]')].map((b) => b.id)
        .filter((i) => i.indexOf(bp) === 0).map((i) => i.slice(bp.length)))];
      const own = ta.id.slice((pre + '-in-' + k + '-').length);
      const side = sides.indexOf(own) >= 0 ? own : sides[0];
      if (!side || !document.getElementById(op + side)) continue;
      return { k, side, ta: ta.id, btn: bp + side, out: op + side,
        copy: document.getElementById(cp + side) ? cp + side : null, nSides: sides.length };
    }
    return null; })()`);
  OWN_RE = new RegExp(cfg.own.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));
  noise = blankNoise();
  const id = (t) => `${P.slug}/${t}`;

  // ── 1) 十档视口 ─────────────────────────────────────────────────────────
  GROUP = `1) ${P.slug} 十档视口 1a–1e`;
  await setVp(1280); await goto(URL_OF(P.url)); await wait(300);
  const rows = [];
  for (const w of VPS) {
    await setVp(w); await wait(150);
    const shape = await evalJs(`(() => {
      const de=document.documentElement, g=(s)=>{const el=document.querySelector(s);return el?getComputedStyle(el):null;};
      const prim=g(${JSON.stringify(L.primary)});
      return { sw:de.scrollWidth, cw:de.clientWidth, vh:window.innerHeight,
        primT: prim?prim.gridTemplateColumns:null, primGap: prim?prim.gap:null,
        primW: prim?Math.round(document.querySelector(${JSON.stringify(L.primary)}).getBoundingClientRect().width):null,
        idxPos:(()=>{const e=g(${JSON.stringify(L.index || '.tk-index')});return e?e.position:null;})(),
        hintDisp:(()=>{const e=g(${JSON.stringify(L.hint || '.tk-index__hint')});return e?e.display:null;})(),
        cols:[...document.querySelectorAll('.tk-cols')].map((el)=>({ one: el.classList.contains('tk-cols--one'),
          t:getComputedStyle(el).gridTemplateColumns, vis: el.getBoundingClientRect().width > 0 })),
        optDir:(()=>{const e=g(${JSON.stringify(L.optColumn ? L.optColumn.sel : '.jt-bar__group--opt')});return e?e.flexDirection:null;})(),
        gutterW:(()=>{const e=document.querySelector('.jt-gutter');return e?Math.round(parseFloat(getComputedStyle(e).width)):null;})(),
        treeH:(()=>{const e=g('.jt-tree');return e?Math.round(parseFloat(e.height)):null;})() };
    })()`);
    rows.push(Object.assign({ w }, shape));
  }
  const badOverflow = rows.filter((r) => r.sw - r.cw > 1);
  check(id('1a 十档视口无横向溢出（scrollWidth − clientWidth ≤ 1）'), badOverflow.length === 0,
    badOverflow.length ? `溢出档：${badOverflow.map((r) => `${r.w}px(+${r.sw - r.cw})`).join(' ')}`
      : rows.map((r) => `${r.w}:${r.sw}/${r.cw}`).join(' '));

  /**
   * 观察到的换挡点：这一格轨道数在哪些宽度上变了（十档按序走一遍）。
   * **落在 `shift + 1` 而不是 `shift`**：`VPS` 是升序的，媒体查询写在 `max-width: 900px`，
   * 于是 900 那一档还是新值（单栏）、901 才是"变了"的那一档。上一版把期望写成 `=== L.shift`，
   * 三条视口判据一起假红——判据里"换挡点"这个词指的是**观察位置**，不是声明位置，两回事得说明白。
   */
  const flipAt = (vals) => {
    const out = [];
    for (let i = 1; i < vals.length; i += 1) if (vals[i].n !== vals[i - 1].n) out.push(vals[i].w);
    return out;
  };
  const FLIP = (shift) => shift + 1;
  const primSeries = rows.map((r) => ({ w: r.w, n: tracks(r.primT) }));
  const primFlips = flipAt(primSeries);
  check(id(`1b 主分栏（${L.primary}）两栏↔单栏换挡，换挡点只许落在 SCSS 现读声明过的档上`),
    rows.every((r) => tracks(r.primT) === (r.w <= L.shift ? 1 : 2))
      && primFlips.length === 1 && primFlips[0] === FLIP(L.shift) && bps.includes(L.shift),
    `轨道数 ${primSeries.map((x) => `${x.w}:${x.n}`).join(' ')}；观察到的换挡档=${primFlips.join() || '(无)'}`
      + `（期望声明 ${L.shift}px → 观察 ${FLIP(L.shift)}px）；SCSS 声明集=${bps.join('/')}px`);

  if (P.layout === 'panels') {
    /**
     * 栏内分栏要**逐块面板**量，不能只量"当前看得见的那一块"：其余面板虽然 `hidden`，
     * 它们的 `.tk-cols` 仍会出现在 `querySelectorAll` 里，而**没参与布局的元素拿回的是声明值**
     * `minmax(0, 1fr)`——按空白一切正好两段，于是"单栏"读成"两栏"、"两栏"读成"三栏"，
     * 第一版就是被这一格假红的（`双=1,2,2,2` 里那三个 2 全是没布局的）。
     * 所以这里按面板轮流点一遍，只认 `vis`（`getBoundingClientRect().width > 0`）的那几格。
     */
    const colsByPanel = [];
    for (const k of panelKeys) {
      await evalJs(`(() => { const t=document.getElementById('${pref}-tab-${k}'); if(t) t.click(); return 1; })()`);
      await wait(90);
      for (const w of [360, 640, 641, 1280]) {
        await setVp(w); await wait(140);
        const got = await evalJs(`(() => [...document.querySelectorAll('#${pref}-panel-${k} ${L.inner.sel}')]`
          + `.map((el)=>({ one: el.classList.contains('${L.inner.oneClass}'),`
          + ' t:getComputedStyle(el).gridTemplateColumns, vis: el.getBoundingClientRect().width > 0 })))()');
        colsByPanel.push({ k, w, got });
      }
    }
    await setVp(1280); await wait(120);
    const wantTracks = (x, w) => (x.one ? 1 : w <= L.inner.shift ? 1 : 2);
    const colsWrong = colsByPanel.filter((r) => r.got.filter((x) => x.vis)
      .some((x) => tracks(x.t) !== wantTracks(x, r.w)));
    const noVis = colsByPanel.filter((r) => r.got.filter((x) => x.vis).length === 0);
    const perPanel = panelKeys.map((k) => {
      const mine = colsByPanel.filter((r) => r.k === k);
      return `${k}:${mine.map((r) => `${r.w}[${r.got.filter((x) => x.vis).map((x) => `${x.one ? '一' : '双'}=${tracks(x.t)}:${x.t}`).join(',')}]`).join(' ')}`;
    });
    const innerFlips = flipAt(colsByPanel.filter((r) => r.k === panelKeys[0])
      .map((r) => ({ w: r.w, n: tracks((r.got.find((x) => x.vis && !x.one) || { t: '' }).t) })));
    check(id(`1c 栏内两栏（${L.inner.sel}）逐块面板都量：在 ${L.inner.shift}px 换挡、带 ${L.inner.oneClass} 的恒单栏，换挡点也在声明集里`),
      colsWrong.length === 0 && noVis.length === 0
        && innerFlips.length === 1 && innerFlips[0] === FLIP(L.inner.shift) && bps.includes(L.inner.shift),
      `${panelKeys.length} 块面板 × 4 档 = ${colsByPanel.length} 次现量；错位=${colsWrong.map((r) => `${r.k}@${r.w}`).join() || '无'}；`
        + `看得见为零的档=${noVis.map((r) => `${r.k}@${r.w}`).join() || '无'}；首页换挡观察=${innerFlips.join()}`
        + `；逐块读数 ${perPanel.join(' ')}`.slice(0, 1500));
    const idxWrong = rows.filter((r) => (r.w <= L.shift ? r.idxPos !== 'static' : r.idxPos === 'static'));
    const hintWrong = rows.filter((r) => (r.w <= L.shift ? r.hintDisp !== 'none' : r.hintDisp === 'none'));
    check(id('1d 索引条 ≤900 退成 static chip、提示语同档隐藏，>900 回到 sticky 且提示语在'),
      idxWrong.length === 0 && hintWrong.length === 0,
      rows.map((r) => `${r.w}:${r.idxPos}/hint=${r.hintDisp}`).join(' '));
  } else {
    const gapWrong = rows.filter((r) => px(r.primGap) !== (r.w <= L.shift ? px(L.gap.narrow) : px(L.gap.wide)));
    const optFlips = flipAt(rows.map((r) => ({ w: r.w, n: r.optDir === 'column' ? 1 : 0 })));
    const gFlips = flipAt(rows.map((r) => ({ w: r.w, n: r.gutterW })));
    const treeWrong = rows.filter((r) => r.treeH !== null && Math.abs(r.treeH - Math.round(L.treeHeight(r.w, r.vh))) > 1);
    check(id(`1c 工作台形状三族各自换挡：分栏 gap ${L.gap.wide}↔${L.gap.narrow}、选项组排向与行号槽定宽换在 ${L.optColumn.shift}、树高按 min() 三档`),
      gapWrong.length === 0 && optFlips.length === 1 && optFlips[0] === FLIP(L.optColumn.shift)
        && gFlips.length === 1 && gFlips[0] === FLIP(L.gutter.shift) && treeWrong.length === 0
        && bps.includes(L.optColumn.shift),
      `gap ${rows.map((r) => `${r.w}:${px(r.primGap)}`).join(' ')}；选项组排向=${rows.map((r) => `${r.w}:${(r.optDir || '-')[0]}`).join(' ')}（换在 ${optFlips.join()}）；`
        + `行号槽宽 ${rows.map((r) => `${r.w}:${r.gutterW}`).join(' ')}（换在 ${gFlips.join()}）；`
        + `树高实测 ${rows.map((r) => `${r.w}:${r.treeH}`).join(' ')} vs 期望 ${rows.map((r) => Math.round(L.treeHeight(r.w, r.vh))).join(' ')}；`
        + `声明集=${bps.join('/')}px`);
    await setVp(640); await wait(160); const g640 = await emOf(L.gutter.sel);
    await setVp(641); await wait(160); const g641 = await emOf(L.gutter.sel);
    check(id(`1e 640 那一档行号槽确实是 ${L.gutter.em}em 定宽（按它自己的 font-size 折 px），641 那一档不是`),
      !!g640 && !!g641 && g640.w === Math.round(L.gutter.em * g640.fs) && g641.w !== Math.round(L.gutter.em * g641.fs),
      `640px：宽 ${g640 && g640.w}px，${L.gutter.em}×font-size ${g640 && g640.fs}=${g640 && Math.round(L.gutter.em * g640.fs)}；`
        + `641px：宽 ${g641 && g641.w}px ≠ ${g641 && Math.round(L.gutter.em * g641.fs)}`);
    await setVp(1280);
  }

  /**
   * 901–1100 那一段带着**真长行**量：SCSS 注释明写这一段的分栏靠 `minmax(0, …)` 自己收缩，
   * `min-width:0` 一漏，一行几百 KB 的压缩 JSON 就把整栏撑破——而 §7 那两格量的都是首屏字节，
   * 看不见它（段 2 立的十档清单里 901/920/940 三档欠的就是这一笔实测）。
   */
  GROUP = `1) ${P.slug} 中间档带长行 1f`;
  await setVp(920); await goto(URL_OF(P.url)); await wait(320);
  const longLine = `"${'z'.repeat(400 * 1024)}"`;
  /**
   * 长行往哪儿灌：`workbench` 支是粘贴框，`panels` 支**现挑**那一块带 `<textarea>` 的面板
   * （上一版按 `panelKeys[0]` 找，编码页那块是只有单行格的 #timestamp——400KB 灌不进
   * `type=number`，`value.length` 吐回 -1，判据读到的"输入没写进去"和"页面真的溢出了"两回事）。
   */
  let loaded = -1;
  let loadedWhere = '';
  if (P.layout === 'workbench') {
    loadedWhere = `${PK}/doc`;
    loaded = await putValue(`${pref}-in-${PK}-doc`, `{"k":${longLine}}`);
  } else {
    const ta1f = await pickTaPanel();
    if (ta1f) {
      loadedWhere = `${ta1f.k}/${ta1f.side}`;
      loaded = await putValue(ta1f.ta, `https://x.test/?${longLine}`);
    } else loadedWhere = '(这一页挑不出粘贴框)';
  }
  await wait(340);
  const mid = [];
  for (const w of [901, 920, 940, 1100]) {
    await setVp(w); await wait(170);
    const mshape = await evalJs(`(() => { const de=document.documentElement;`
      + ` const p=document.querySelector(${JSON.stringify(L.primary)}); const cs=getComputedStyle(p);`
      + ' return { sw:de.scrollWidth, cw:de.clientWidth, primW:Math.round(p.getBoundingClientRect().width),'
      + ' tracks:cs.gridTemplateColumns }; })()');
    mid.push(Object.assign({ w }, mshape));
  }
  /**
   * 计算值按**空白**分段（`176px 657px` → 两段）。上一版在这里用了一只"逗号分隔、跳过括号内逗号"
   * 的解析器，那是给 `repeat(2, minmax(0, 1fr))` 那种**声明值**写的；用在布局后的计算值上，
   * 一段都数不出来，于是 1f 永远假红。同一把尺（`tracks`）从 1b 到这里只用一只。
   */
  const midBad = mid.filter((r) => r.sw - r.cw > 1);
  check(id('1f 901–1100 四档带着 400KB 单行长输入：主分栏仍两轨、栏宽>0、无横向溢出（min-width:0 那把尺还管用）'),
    midBad.length === 0 && mid.every((r) => tracks(r.tracks) === 2 && r.primW > 0)
      && typeof loaded === 'number' && loaded > 400000,
    mid.map((r) => `${r.w}px 溢出${r.sw - r.cw}、栏宽${r.primW}、轨道=${String(r.tracks).replace(/\s+/g, ' ')}`).join(' ；')
      + `；输入落在 ${loadedWhere}、长度=${loaded}（两支都要 >400000，量具自己先把"输入没写进去"这种假绿挡掉）`);
  await setVp(1280);

  // ── 2) 昼夜 × 三档纸色温 ────────────────────────────────────────────────
  GROUP = `2) ${P.slug} 昼夜 × 纸色温 2a–2c`;
  const combos = [];
  for (const mode of ['day', 'night']) {
    for (const paper of ['warm', 'cool', 'sage']) {
      await setVp(1280); await goto(URL_OF(P.url));
      await evalJs(`localStorage.setItem('daytimeMode','${mode}');`
        + `localStorage.setItem('readerPrefs', JSON.stringify({p:'${paper}'})); 1`);
      await goto(URL_OF(P.url)); await wait(320);
      const o = await evalJs(`(() => { const de=document.documentElement, body=document.body;
        const bgh=(el)=>{ let n=el; while(n){ const v=getComputedStyle(n).backgroundColor;
          if(v && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(v)) return v; n=n.parentElement; } return 'rgb(255, 255, 255)'; };
        const picks=[...document.querySelectorAll('h1, .tk-compliance, ${P.layout === 'workbench' ? '.jt-side__title' : '.tk-panel h2'}')].slice(0,3);
        return { night: de.classList.contains('night-mode'), rs: de.getAttribute('data-rs-paper')||'',
          bodyBg: bgh(body), n:picks.length,
          samples: picks.map(el=>({ tag:(el.className||el.tagName)+'', color:getComputedStyle(el).color, bg:bgh(el) })) }; })()`);
      const ratios = o.samples.map((s) => +ratio(s.color, s.bg).toFixed(2));
      combos.push({ mode, paper, ...o, ratios, min: Math.min(...ratios) });
    }
  }
  check(id('2a 六组（昼/夜 × warm/cool/sage）× 每页三处正文的对比度全过 4.5'),
    combos.every((x) => x.n === 3 && x.min >= 4.5),
    combos.map((x) => `${x.mode}/${x.paper}:${x.ratios.join('/')}`).join(' '));
  const dayDistinct = new Set(combos.filter((x) => x.mode === 'day').map((x) => x.bodyBg)).size === 3;
  const nightFlat = new Set(combos.filter((x) => x.mode === 'night').map((x) => x.bodyBg)).size === 1;
  check(id('2b 纸色温三档：白昼 body 底色三个不同值、夜间恒一个值，且 data-rs-paper 只写非默认档'),
    dayDistinct && nightFlat && combos.every((x) => x.rs === (x.paper === 'warm' ? '' : x.paper)),
    combos.map((x) => `${x.mode}/${x.paper}:attr=${x.rs || '(空)'}/body=${x.bodyBg}`).join(' '));
  check(id('2c 档位与类名一致：night-mode 只在 night 档出现'),
    combos.every((x) => x.night === (x.mode === 'night')),
    combos.map((x) => `${x.mode}:${x.night ? 'night' : 'day'}`).join(' '));

  // ── 3) 键盘（真按键；§0.5 第 2、3 条那两族欠账在这一组兑现）──────────────
  GROUP = `3) ${P.slug} 键盘 3a–3g`;
  await setVp(1280); await goto(URL_OF(P.url)); await wait(340);
  const chain = [];
  for (let i = 0; i < 26; i += 1) {
    await press('Tab', 'Tab', 9);
    chain.push(await evalJs(`(() => { const a=document.activeElement; if(!a) return 'null';
      return [a.tagName.toLowerCase(), (a.className||'').toString().split(' ')[0],
        (a.textContent||'').trim().slice(0,8), a.closest('.nav-sub')?1:0].join('|'); })()`));
  }
  check(id('3a Tab 链在离开头部之前能走进下拉子项（:focus-within 打开）'),
    chain.some((s) => /nav-sub-link/.test(s)), `前 12 跳：${chain.slice(0, 12).join(' | ')}`);
  const ring = await evalJs(`(async () => { const b=document.querySelector('.tk-btn');`
    + ' await new Promise(r=>{ b.focus(); requestAnimationFrame(()=>requestAnimationFrame(r)); });'
    + ' const cs=getComputedStyle(b);'
    + " return { outline: cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor, matches: b.matches(':focus-visible') }; })()");
  check(id('3b 焦点环不是 outline:none（.tk-btn，经 focus() 读 :focus-visible 态）'),
    ring.outline.split(' ')[0] !== 'none' && parseFloat(ring.outline.split(' ')[1]) >= 1,
    `outline=${ring.outline}；:focus-visible=${ring.matches}`);

  /**
   * 3c 按 `layout` 分派那一族。
   * `panels`：五件事一起跟上才算切成功——selected / roving tabindex / 只显示这一块 / 焦点 / hash。
   * `workbench`：这一页没有索引条，换判"↑/↓ 落在粘贴框上是浏览器原生行为"——不劫持、不吞。
   */
  if (P.layout === 'panels') {
    /** 面板互锁的现场：哪块 aria-selected、哪块还没 hidden、焦点在哪、地址栏 hash 是什么 */
    const panelState = () => evalJs(`(() => {
      const tabs=[...document.querySelectorAll('.${pref}-index__link')];
      const sel=tabs.filter(t=>t.getAttribute('aria-selected')==='true').map(t=>t.id.replace('${pref}-tab-',''));
      const roving=tabs.filter(t=>t.tabIndex===0).map(t=>t.id.replace('${pref}-tab-',''));
      const shown=[...document.querySelectorAll('.${pref}-panel')].filter(p=>!p.hidden).map(p=>p.id.replace('${pref}-panel-',''));
      return { sel, roving, shown, hash: location.hash, focus: document.activeElement.id || '' }; })()`);
    const want = (st, k) => st.sel.join() === k && st.roving.join() === k && st.shown.join() === k
      && st.focus === `${pref}-tab-${k}` && st.hash === `#${k}`;
    const shot = (k, st) => `${k}→sel=${st.sel.join()}/roving=${st.roving.join()}/shown=${st.shown.join()}`
      + `/focus=${(st.focus || '').replace(`${pref}-tab-`, '')}/hash=${st.hash}`;
    await evalJs('window.scrollTo(0,0); 1');
    await focusOn(`${pref}-tab-${PK}`);
    await press('ArrowRight', 'ArrowRight', 39); const sRight = await panelState();
    await press('ArrowLeft', 'ArrowLeft', 37); const sLeft = await panelState();
    await press('End', 'End', 35); const sEnd = await panelState();
    await press('Home', 'Home', 36); const sHome = await panelState();
    await press('ArrowDown', 'ArrowDown', 40); const sDown = await panelState();
    const LAST = panelKeys[panelKeys.length - 1];
    check(id(`3c 真按方向键切面板：→/←/↓ 与 Home/End 各换到该去的那块，`
      + 'roving tabindex、hidden 互锁、焦点与 hash 四件事一起跟上'),
      want(sRight, panelKeys[1]) && want(sLeft, PK) && want(sEnd, LAST)
        && want(sHome, PK) && want(sDown, panelKeys[1]),
      [['→', sRight], ['←', sLeft], ['End', sEnd], ['Home', sHome], ['↓', sDown]].map(([k, st]) => shot(k, st)).join(' ；'));

    /**
     * 3d 不自写像素阈值，而是**当场造一把尺子**：先把焦点放到没有键盘处理器的 `main` 上，
     * 按同一族键量出"默认动作走多远"；再放到 tab 上按同样的键量一遍。判的是后者远小于前者。
     * 这样它既有牙（摘掉 `panel-dom.js` 那句 `preventDefault()` 就回到尺子的量级），
     * 又不会被 `focus()` 把新 tab 蹭进视口那几十 px 误杀（段 3 第一版写死 `=== 0` 就是假红）。
     */
    await evalJs(`(() => { const m=document.querySelector('main'); m.tabIndex=-1; m.focus(); return m.tagName; })()`);
    const mid0 = await scrollToMid(); await press('End', 'End', 35); const ctlEnd = await readYStable();
    const mid1 = await scrollToMid(); await press('Home', 'Home', 36); const ctlHome = await readYStable();
    await focusOn(`${pref}-tab-${PK}`);
    const mid2 = await scrollToMid(); await press('End', 'End', 35); const tabEnd = await readYStable();
    await focusOn(`${pref}-tab-${PK}`);
    const mid3 = await scrollToMid(); await press('Home', 'Home', 36); const tabHome = await readYStable();
    await evalJs('window.scrollTo({ top: 0, behavior: "instant" }); 1'); await wait(140);
    const dEnd = Math.abs(ctlEnd - mid0); const dHome = Math.abs(ctlHome - mid1);
    const tEnd = Math.abs(tabEnd - mid2); const tHome = Math.abs(tabHome - mid3);
    check(id('3d 方向族键落在 tab 上时不触发浏览器默认滚动（与"无处理器的同一族键"当面对照）'),
      mid0 > 40 && dEnd >= 100 && dHome >= 100 && tEnd < dEnd * 0.25 && tHome < dHome * 0.25,
      `从中间起步：无处理器 End 走 ${dEnd}px、Home 走 ${dHome}px；落在 tab 上 End 走 ${tEnd}px、`
        + `Home 走 ${tHome}px（判线 <25%）；mid=${mid0}/${mid1}/${mid2}/${mid3}`);
  } else {
    /**
     * workbench 那一支的 3c：粘贴框上 ↑/↓ 走的是浏览器原生那一条。
     * 判据形状 = "文本框自己滚了 + 选区随按键移动 + 页面没被劫持去滚别处"。
     * 摘掉这一格靠的是"根本没写 keydown"，所以它的牙反着来：谁给粘贴框加了 preventDefault，
     * 这里就红在 scrollTop 不动上（§W 没这一族监听，红一次就是多写了监听）。
     *
     * 起步之前先把**整块框摆进视口**，并用 `getBoundingClientRect()` 自证摆进去了。
     * 上一版的基准是"`focus()` 之后那一格 `scrollY`"，改完之后仍然红在 `0→324`：
     * 那 324px 不是焦点副作用，是按键本身——caret 往第 60 行走，浏览器为了把 caret 露出来
     * 顺手把**页面**也滚到了底（页底 324px 就是这一页在 1280×900 的全部可滚量）。
     * 框的底边还在视口外时，这一下是浏览器的原生 scroll-into-view，不是页面多写了监听，
     * 判线扣在它头上就是拿量具的构图去告页面。所以先让框完整可见，把这条原生路径关掉，
     * 剩下的 `scrollY` 位移才真的归这一族判。
     */
    const DOCID = `${pref}-in-${PK}-doc`;
    const fit = async () => evalJs(`(() => { const el=document.getElementById(${JSON.stringify(DOCID)});`
      + ' if(!el) return { found: false };'
      + ' const de=document.documentElement, max=Math.max(0, de.scrollHeight - window.innerHeight);'
      + ' let r=el.getBoundingClientRect(); let y=window.scrollY;'
      + ' if (r.bottom > window.innerHeight - 8) y += r.bottom - (window.innerHeight - 8);'
      + ' if (r.top < 8) y += r.top - 8;'
      + ' y = Math.max(0, Math.min(max, Math.round(y)));'
      + ' window.scrollTo({ top: y, behavior: "instant" });'
      + ' r = el.getBoundingClientRect();'
      + ' return { found: true, h: Math.round(r.height), top: Math.round(r.top),'
      + ' bottom: Math.round(r.bottom), ih: window.innerHeight, pageMax: max, y: Math.round(window.scrollY),'
      + ' fully: r.top >= 0 && r.bottom <= window.innerHeight }; })()');
    await putValue(DOCID, Array.from({ length: 400 }, (_, i) => `line${i}`).join('\n'));
    await wait(120);
    await evalJs(`(() => { const el=document.getElementById(${JSON.stringify(DOCID)});`
      + ` el.scrollTop=0; el.setSelectionRange(0,0); return 1; })()`);
    const f0 = await fit();
    await focusOn(DOCID);
    const f1 = await fit();          // focus() 自己也可能挪框，以这一次的形状为准
    const yBefore = await readYStable();
    for (let i = 0; i < 60; i += 1) await press('ArrowDown', 'ArrowDown', 40);
    const after = await evalJs(`(() => { const el=document.getElementById(${JSON.stringify(DOCID)});`
      + ' const r=el.getBoundingClientRect();'
      + ' return { top: Math.round(el.scrollTop), sel: el.selectionStart, y: Math.round(window.scrollY),'
      + ' h: Math.round(el.clientHeight), boxTop: Math.round(r.top), boxBottom: Math.round(r.bottom), active: document.activeElement.id }; })()');
    /**
     * 前置条件（框完整可见）不满足时**这一格直接红**，不让它带着一个不可比的基准通过：
     * "判据没量到"和"量到了且绿"在汇总里长得一样（记忆规则「少一族在汇总里长得和全绿一样」）。
     */
    check(id('3c 粘贴框上真按 60 次 ↓：文本框自己滚（原生滚动没被劫持）、选区跟着走、页面没被带着滚'),
      f1.found && f1.fully && after.top > 0 && after.sel > 300 && Math.abs(after.y - yBefore) <= 40,
      `框整块进视口=${JSON.stringify(f1)}（先一次=${JSON.stringify(f0)}）；`
        + `scrollTop 0→${after.top}px（框高 ${after.h}px）、selectionStart→${after.sel}、焦点在=${after.active}、`
        + `window.scrollY ${yBefore}→${after.y}（判线 ≤40px，框底边此刻在 ${after.boxBottom}px / 视口 ${f1.ih}px）`);
    /** Home/End 落在粘贴框上是"回到行首/行尾"，不是"甩到页顶/页底"：同一把尺现场对照 */
    await evalJs(`(() => { const m=document.querySelector('main'); m.tabIndex=-1; m.focus(); return 1; })()`);
    const midA = await scrollToMid(); await press('End', 'End', 35); const ctlEnd = await readYStable();
    await evalJs(`(() => { const el=document.getElementById('${pref}-in-${PK}-doc'); el.focus();`
      + ` el.setSelectionRange(3,6); return 1; })()`);
    const midB = await scrollToMid(); await press('End', 'End', 35);
    const boxEnd = await evalJs(`(() => { const el=document.getElementById('${pref}-in-${PK}-doc');`
      + ' return { y: Math.round(window.scrollY), sel: el.selectionStart }; })()');
    /**
     * 尺子的下限写死 **100px**、比例判 25%：这一族判的是"劫持与不劫持差得远"，
     * 绝对值只是"这把尺够不够长"的自检。上一格用 `> 200`，在证件页与编码页量得到（页面足够高），
     * 而 JSON 工作台整页在 1280×900 只有 324px 可滚——尺子本身只有 162px，于是"0px vs 162px"
     * 这一对清清楚楚的读数被门限判成红。162px 的差别够判；真的没有 100px 可滚时这一格红着报，
     * 不许静默通过。
     */
    check(id('3d End 落在粘贴框上：只把 caret 移到行尾，不许把整页甩到页底（与无处理器的同一键对照）'),
      Math.abs(ctlEnd - midA) >= 100 && Math.abs(boxEnd.y - midB) < Math.abs(ctlEnd - midA) * 0.25,
      `无处理器 End 走 ${Math.abs(ctlEnd - midA)}px（尺子下限 100px）；`
        + `粘贴框上 End 走 ${Math.abs(boxEnd.y - midB)}px、selectionStart=${boxEnd.sel}；mid=${midA}/${midB}`);
  }

  /**
   * 3e/3f 两族 `Enter`：
   *   ① 粘贴框里**裸 Enter 不许触发计算**（吞掉用户敲的那次换行本身就是缺陷）；
   *   ② 真 Enter 落在按钮上必须走**与 click 同一条通道**——同一枚按钮点一次记到的载荷与
   *      Enter 记到的载荷逐字相等，判的才是"这条按键接到了那一件事"，而不是"按钮改口了"。
   */
  await setVp(1280); await goto(URL_OF(P.url)); await wait(340); await installSpies();
  const docId = `${pref}-in-${PK}-doc`;
  if (P.layout === 'workbench') {
    await putValue(docId, cfg.sample); await wait(260);
    const before = await readOut(OUTSEL);
    const lenBefore = await evalJs(`document.getElementById(${JSON.stringify(docId)}).value.length`);
    await focusOn(docId); await press('Enter', 'Enter', 13);
    const afterEnter = await evalJs(`(() => { const el=document.getElementById(${JSON.stringify(docId)});`
      + ` return { len: el.value.length, nl: (el.value.match(/\\n/g)||[]).length }; })()`);
    const afterOut = await readOut(OUTSEL);
    const spyBare = await evalJs('window.__spy.copy.length');
    /**
     * 判"没算"量的是**结果栏容器自己的 innerHTML 与文本**，不是"`.jt-out__body` 查得到吗"：
     * 空态那一栏画的是 `.jt-empty` 那一行，`.jt-out__body` 只在算过之后才存在，
     * 拿"子节点在不在"当证据会因为空态换 markup 而假红；容器整体前后一致才判得住。
     */
    check(id('3e 粘贴框里裸 Enter 不算：结果区一个字节都没变，而那一次换行真的落进了框里（没被吞）'),
      !!before && !!afterOut && before.html === afterOut.html && before.text === afterOut.text
        && afterEnter.len === lenBefore + 1 && afterEnter.nl >= 1 && spyBare === 0,
      `按键前 value=${lenBefore} 字、结果栏 ${before && before.html}B「${String(before && before.text).slice(0, 24)}」；`
        + `按键后 value=${afterEnter.len} 字（换行 ${afterEnter.nl} 处）、结果栏 ${afterOut && afterOut.html}B「`
        + `${String(afterOut && afterOut.text).slice(0, 24)}」、复制记账 ${spyBare} 次`);
    await putValue(docId, cfg.sample); await clickById(`${pref}-btn-${PK}-format`); await wait(240);
    const outText = await evalJs(`(() => { const el=document.querySelector(${JSON.stringify(OUTSEL + ' .jt-out__body')});`
      + ' return el ? el.textContent : null; })()');
    await resetSpy(); await focusOn(`${pref}-btn-${PK}-copy`); await press('Enter', 'Enter', 13); await wait(150);
    const viaEnter = await evalJs('window.__spy.copy.slice()');
    await resetSpy(); await clickById(`${pref}-copy-${PK}-main`); await wait(150);
    const viaMainCopy = await evalJs('window.__spy.copy.slice()');
    await resetSpy(); await clickById(`${pref}-btn-${PK}-copy`); await wait(150);
    const viaClick = await evalJs('window.__spy.copy.slice()');
    check(id('3f 真 Enter 落在复制按钮上 = 与 click 同一条通道、载荷逐字等于结果区那一栏的正文'),
      viaEnter.length === 1 && viaClick.length === 1 && viaMainCopy.length === 1
        && viaEnter[0] === viaClick[0] && viaMainCopy[0] === viaClick[0] && viaEnter[0] === outText,
      `Enter=${JSON.stringify(String(viaEnter[0] || '').slice(0, 40))}；click=${JSON.stringify(String(viaClick[0] || '').slice(0, 40))}；`
        + `结果栏那枚=${JSON.stringify(String(viaMainCopy[0] || '').slice(0, 40))}；正文=${JSON.stringify(String(outText || '').slice(0, 40))}`);
  } else {
    const ta = await pickTaPanel();
    if (!ta) {
      /**
       * 挑不出粘贴框就当缺陷报，不让它静默跳过：这一族的判据 whole 一条都不剩，
       * 而"少一族"在汇总里长得和"全绿"一样。
       */
      check(id('3e 粘贴框里裸 Enter 不算、Ctrl+Enter 才算（吞掉用户敲的那次换行是缺陷）'), false,
        `这个页面挑不出带 <textarea> 的面板（panelKeys=${panelKeys.join()}）：判据一条没量到，按缺陷报而不是跳过`);
    } else {
      /** 栏位形状自己报一遍：三页的栏位命名不同，读数要能看出这一条量的是哪一栏。 */
      const shot = `栏=${ta.k}/${ta.side}（该块 ${ta.nSides} 栏）`;
      await evalJs(`document.getElementById('${pref}-tab-${ta.k}').click(); 1`); await wait(140);
      const readOutRow = (sel) => evalJs(`(() => { const el=document.getElementById(${JSON.stringify(sel)});`
        + ' return el ? { html: el.innerHTML.length, text: el.innerText.replace(/\\s+/g," ").trim() } : null; })()');
      /**
       * 四步一把尺，每一步都只换一件事：
       *   ① 灌 `sample` → 点按钮 → `out1`（这一栏"算过之后"的基准）；
       *   ② **不派发 input** 地换成 `sample2` → 结果区必须还停在 `out1`（没事件就不许自己算，
       *      这一步是给 ③④ 造"陈旧"起点的，否则"没变"永远测不出东西）；
       *   ③ Ctrl+Enter → 必须离开 `out1`（内容真的换了，"变了"只能来自这一次按键）；
       *   ④ 裸 Enter → 必须还停在 `out2`，而框里多出那一次换行（吞掉用户敲的换行是缺陷）。
       * 判"变了 / 没变"用**文本**而不是 innerHTML 长度：`Better` 与 `Qoder` 的 Base64 同为 8 字，
       * 按字节数比会漏判（上一版正是拿 `html` 比，把一次真实的"算了"读成了"没算"）。
       */
      const lenPut1 = await putValue(ta.ta, cfg.sample); await wait(160);
      await clickById(ta.btn); await wait(320);
      const out1 = await readOutRow(ta.out);
      const lenPut2 = await putValue(ta.ta, cfg.sample2, false); await wait(200);
      const outStale = await readOutRow(ta.out);
      await focusOn(ta.ta);
      await press('Enter', 'Enter', 13, 2); await wait(340);
      const out2 = await readOutRow(ta.out);
      const lenBefore = await evalJs(`document.getElementById(${JSON.stringify(ta.ta)}).value.length`);
      await press('Enter', 'Enter', 13); await wait(200);
      const afterBare = await evalJs(`(() => { const el=document.getElementById(${JSON.stringify(ta.ta)});`
        + ' return { len: el.value.length, nl: (el.value.match(/\\n/g)||[]).length }; })()');
      const outBare = await readOutRow(ta.out);
      const spyBare = await evalJs('window.__spy.copy.length');
      check(id('3e 粘贴框里裸 Enter 不算、Ctrl+Enter 才算（吞掉用户敲的那次换行是缺陷）'),
        typeof lenPut1 === 'number' && lenPut1 > 0 && typeof lenPut2 === 'number' && lenPut2 > 0
          && out1 !== null && outStale !== null && out2 !== null && outBare !== null
          && outStale.text === out1.text
          && out2.text !== out1.text
          && outBare.text === out2.text
          && afterBare.len === lenBefore + 1 && afterBare.nl >= 1 && spyBare === 0,
        `${shot}；①「${cfg.sample}」→ out=「${String(out1 && out1.text).slice(0, 22)}」；`
          + `②静默换「${cfg.sample2}」后 out=「${String(outStale && outStale.text).slice(0, 22)}」；`
          + `③Ctrl+Enter 后 out=「${String(out2 && out2.text).slice(0, 22)}」；`
          + `④裸 Enter 后 out=「${String(outBare && outBare.text).slice(0, 22)}」、框内 ${lenBefore}→${afterBare.len} 字`
          + `（换行 ${afterBare.nl} 处）、复制记账 ${spyBare} 次`);
      await resetSpy();
      /**
       * 内容此时是 `sample2 + '\n'`，而 `sample2` 是**故意算错校验位**的那一枚（3e 靠它证明"内容真的换了"）。
       * 直接把它带进 3f 会得到一枚点不动的复制按钮：证件页的读栏只把 `state === 'valid'` 的行收进
       * 可复制正文（`workbench.js` 的 `copies.set(key(panel,'read'), valid.join('\n'))`），
       * 全栏没有合法行 → 正文是空串 → `copyInto` 早退 → 按钮 `disabled`。
       * 于是 Enter 与 click 两发都在"什么都没发生"上取到同一个值，这一族量的就成了量具自己。
       * 所以这里把**能算出正文**的 `sample` 灌回去再算一次，让两条按键路径面对同一份有内容的成绩。
       */
      const len3f = await putValue(ta.ta, cfg.sample); await wait(160);
      const c3f = await clickById(ta.btn); await wait(320);
      const copyState = await evalJs(`(() => { const el=document.getElementById(${JSON.stringify(ta.copy || '')});`
        + ' if(!el) return { found: false }; const o=document.getElementById(' + JSON.stringify(ta.out) + ');'
        + ' return { found: true, disabled: el.disabled, tag: el.tagName,'
        + ' outText: (o ? o.innerText : "").replace(/\\s+/g," ").trim().slice(0, 24) }; })()');
      await resetSpy();
      await focusOn(ta.copy); await press('Enter', 'Enter', 13); await wait(180);
      const viaEnter = await evalJs('window.__spy.copy.slice()');
      await resetSpy(); await clickById(ta.copy); await wait(180);
      const viaClick = await evalJs('window.__spy.copy.slice()');
      check(id('3f 真 Enter 落在复制按钮上 = 与 click 同一条通道、载荷逐字相同且非空'),
        ta.copy !== null && viaEnter.length === 1 && viaClick.length === 1
          && viaEnter[0] === viaClick[0] && viaEnter[0].length > 0,
        `${shot}；复制按钮=${ta.copy === null ? '该块没有' : ta.copy}（=${JSON.stringify(copyState)}）；`
          + `起手 输入=${len3f} 字、算一次=${c3f}；`
          + `Enter 记账 ${viaEnter.length} 次 载荷=${JSON.stringify(String(viaEnter[0] ?? '(没记账)').slice(0, 48))}；`
          + `click 记账 ${viaClick.length} 次 载荷=${JSON.stringify(String(viaClick[0] ?? '(没记账)').slice(0, 48))}`);
    }
  }

  /** 3g Esc 是**公共层**的回归，工具层不自造它（§0.5 第 3 条）：⌘K 开 → 真按 Esc → #cmdk 回 hidden */
  const beforeCmdk = await evalJs(`(() => { const t=[...document.querySelectorAll('.${pref}-index__link')];`
    + ` const s=t.filter(x=>x.getAttribute('aria-selected')==='true').map(x=>x.id);`
    + ` const shown=[...document.querySelectorAll('.${pref}-panel')].filter(p=>!p.hidden).map(p=>p.id);`
    + ' return { s, shown, n: document.querySelectorAll(\'.' + pref + '-panel\').length }; })()');
  await press('k', 'KeyK', 75, 2); await wait(300);
  const cmdkOpen = await evalJs(`(() => { const m=document.getElementById('cmdk');`
    + ' return m ? { exists: true, hidden: m.hidden, disp: getComputedStyle(m).display } : { exists: false }; })()');
  await press('Escape', 'Escape', 27); await wait(300);
  const cmdkAfter = await evalJs(`(() => { const m=document.getElementById('cmdk');`
    + ' return m ? { exists: true, hidden: m.hidden, disp: getComputedStyle(m).display } : { exists: false }; })()');
  const afterEsc = await evalJs(`(() => { const t=[...document.querySelectorAll('.${pref}-index__link')];`
    + ` const s=t.filter(x=>x.getAttribute('aria-selected')==='true').map(x=>x.id);`
    + ` const shown=[...document.querySelectorAll('.${pref}-panel')].filter(p=>!p.hidden).map(p=>p.id);`
    + ' return { s, shown, n: document.querySelectorAll(\'.' + pref + '-panel\').length }; })()');
  check(id('3g Esc 的公共层回归：页内搜索快捷键（metaKey||ctrlKey + k）开得出、真按 Esc 之后 #cmdk 回 hidden，工具面板一块都没被带走'),
    cmdkOpen.exists && cmdkOpen.hidden === false && cmdkAfter.exists && cmdkAfter.hidden === true
      && JSON.stringify(beforeCmdk) === JSON.stringify(afterEsc),
    `⌘K 前状态=${JSON.stringify(beforeCmdk)}；⌘K 后 hidden=${cmdkOpen.hidden}/display=${cmdkOpen.disp}；`
      + `Esc 后 hidden=${cmdkAfter.hidden}/display=${cmdkAfter.disp}，工具状态=${JSON.stringify(afterEsc)}`);

  // ── 4) 禁 JS 降级 ───────────────────────────────────────────────────────
  GROUP = `4) ${P.slug} 禁 JS 降级 4a`;
  await goto(URL_OF(P.url)); await wait(420);
  const withJs = await evalJs(`document.querySelector('main').innerText.replace(/\\s+/g,'').length`);
  await goto(URL_OF('/nojs' + P.url)); await wait(120);
  const nj = await evalJs(`(() => ({ panels: document.querySelectorAll('.${pref}-panel').length,
    hiddenPanels: [...document.querySelectorAll('.${pref}-panel')].filter((p)=>p.hidden).length,
    links: document.querySelectorAll('.${pref}-index__link').length,
    scripts: document.querySelectorAll('script').length,
    workspace: !!document.querySelector(${JSON.stringify(L.primary)}),
    text: document.querySelector('main').innerText.replace(/\\s+/g,'').length,
    controls: document.querySelectorAll('.${pref}-panel input, .${pref}-panel select, .${pref}-panel textarea,`
      + ` .${pref}-side input, .${pref}-side select, .${pref}-side textarea, .${pref}-bar button').length,
    btns: document.querySelectorAll('button[id^="${pref}-btn-"]').length,
    outs: [...document.querySelectorAll('[id^="${pref}-out-"], .tk-out, .jt-out')].map((el)=>el.innerHTML.trim().length),
    caveat: ${JSON.stringify(cfg.caveat.map(String))}.map(s=>new RegExp(s.slice(1,-1)).test(document.querySelector('main').innerText)),
    noscript: !!document.querySelector('.tk-compliance--noscript'),
    noscriptText: (document.querySelector('.tk-compliance--noscript')||{}).innerText || '' }))()`);
  check(id('4a 摘掉全部 <script>：骨架与控件全在、结果区一个字节都不长、那两句口径逐条还在、正文不少于开 JS 那一版的 90%'),
    nj.scripts === 0 && nj.workspace && nj.text >= withJs * 0.9 && nj.outs.every((n) => n === 0)
      && nj.caveat.every(Boolean) && nj.noscript && nj.noscriptText.replace(/\s+/g, '').length >= 20
      && (P.layout === 'workbench' ? nj.btns === P.actions && nj.controls >= 18
        : (nj.panels === P.panels.length && nj.hiddenPanels === 0 && nj.links === P.panels.length)),
    `面板 ${nj.panels}（展开 ${nj.panels - nj.hiddenPanels}）、索引 ${nj.links}、按钮 ${nj.btns}（profile 声明 ${P.actions ?? '—'}）、控件 ${nj.controls}；`
      + `结果区 innerHTML 长度 ${nj.outs.join('/')}（全 0 才对：没有脚本就没有换算）；`
      + `口径句 ${JSON.stringify(nj.caveat)}；noscript 那句摊平后 ${nj.noscriptText.replace(/\s+/g, ' ').trim().slice(0, 36)}；`
      + `正文 禁JS ${nj.text} 字 / 开JS ${withJs} 字（${(nj.text / withJs * 100).toFixed(1)}%）、脚本 ${nj.scripts}`);

  // ── 5) 首屏阻塞资源现量 ─────────────────────────────────────────────────
  GROUP = `5) ${P.slug} 首屏阻塞资源 5a`;
  await goto(URL_OF(P.url)); await wait(520);
  const rl = await evalJs(`(() => {
    const res = performance.getEntriesByType('resource').map((e) => ({
      name: e.name.replace(location.origin + ${JSON.stringify(BASE)}, ''), rb: e.renderBlockingStatus || 'n/a',
      xfer: e.transferSize || 0 }));
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const blocking = res.filter((r) => r.rb === 'blocking');
    const local = blocking.filter((b) => b.name[0] === '/');
    const remote = blocking.filter((b) => b.name[0] !== '/');
    const mine = ${JSON.stringify(cfg.own)};
    const seen = mine.map((f) => ({ f, hit: res.filter((r) => r.name.split('/').pop() === f)
      .map((r) => r.rb + '/' + r.xfer).join(',') || '(不在资源表)' }));
    return { htmlBytes: nav.transferSize || nav.encodedBodySize || 0, all: res.length,
      blocking: blocking.map((b) => b.name + ':' + b.xfer).join(' '),
      blockLocalSum: local.reduce((s, b) => s + b.xfer, 0), localCount: local.length,
      remoteBlock: remote.map((b) => b.name + ':' + b.xfer).join(' ') || '(无)',
      nonBlock: res.filter((r) => r.rb !== 'blocking').length, seen }; })()`);
  /**
   * 判据只认这一页专属那几件的**确切文件名**：宽松正则会把全站公共件 `index.min.css`、
   * `normalize.min.css` 也拉进来，而阻塞集里本来就该有它们。
   * `accountedFor` 兜另一种红法：资源表空 / 导航失败时"专属件都不在阻塞集"会一起真，于是假绿。
   */
  const blockingNames = rl.blocking.split(' ').filter(Boolean).map((e) => e.split(':')[0].split('/').pop());
  const mineInBlocking = blockingNames.filter((b) => cfg.own.includes(b));
  const mineNonBlocking = rl.seen.every((x) => x.hit !== '(不在资源表)'
    && x.hit.split(',').every((h) => h.startsWith('non-blocking')));
  const accountedFor = rl.htmlBytes > 1000 && rl.localCount >= 3 && rl.blockLocalSum >= 50000;
  check(id('5a 阻塞集里不含本页专属件（每一件都在资源表里、且全为 non-blocking），并现量阻塞集的本地字节'),
    mineNonBlocking && mineInBlocking.length === 0 && accountedFor,
    `HTML ${rl.htmlBytes}B；阻塞集本地 ${rl.blockLocalSum}B（${rl.localCount} 件，可复算）+ 外链 ${rl.remoteBlock}；`
      + `本页专属那几件实测 ${rl.seen.map((x) => `${x.f}=${x.hit}`).join(' ')}；非阻塞 ${rl.nonBlock} 件 / 资源表共 ${rl.all} 件`);

  // ── 6) §0.5 第 1 条：监听累计 ───────────────────────────────────────────
  GROUP = `6) ${P.slug} 监听累计 6a`;
  check(id('6a 全程：本源异常与 error 级为 0，且本页专属那几件与页面本身一条都不出（站级 warning 不判红、逐条列账归因）'),
    noisePass(), noiseShot());

  // ══ 7–10) JSON 页专有那四族 ══════════════════════════════════════════════
  if (P.slug === 'json') {
    const OUT = OUTSEL;
    const TREE = `#${pref}-tree-${PK}-main`;
    // ── 7) 树视图滚动上界（§V ③ 的真浏览器版）─────────────────────────────
    GROUP = '7) json 树视图滚动 7a–7c';
    await setVp(1280); await goto(URL_OF(P.url)); await wait(360); await installSpies();
    await putValue(docId, TREE_DOC); await wait(320);
    await clickById(`${pref}-btn-${PK}-validate`); await wait(400);
    await setSelect(`${pref}-in-${PK}-view`, 'tree'); await wait(420);
    const treeShape = await evalJs(`(() => { const box=document.querySelector(${JSON.stringify(TREE)});`
      + ` if(!box) return null; const kids=[...box.children];`
      + " const pads=kids.filter(k=>k.classList.contains('jt-tree__pad'));"
      + " const rowsBox=kids.find(k=>k.classList.contains('jt-tree__rows'));"
      + ' const cs=getComputedStyle(box);'
      + " const row=document.querySelector('.jt-tree__row');"
      + ' return { kids: kids.map(k=>k.className), padN: pads.length, hasRows: !!rowsBox,'
      + ' role: rowsBox?rowsBox.getAttribute("role"):null, scrollTop: box.scrollTop, scrollH: box.scrollHeight,'
      + ' clientH: Math.round(box.clientHeight), rowH: row?row.offsetHeight:null,'
      + ' padHeights: pads.map(p=>Math.round(parseFloat(p.style.height)||0)),'
      + ' rowN: rowsBox?rowsBox.children.length:0, token: cs.getPropertyValue("--jt-row-h").trim(),'
      + ' overflow: cs.overflowY||cs.overflow }; })()');
    check(id('7a 树视图常驻节点恰三块（两垫片 + 行容器 role=tree）、行高就是 --jt-row-h 那把尺、容器自己可滚'),
      !!treeShape && treeShape.kids.length === 3 && treeShape.padN === 2 && treeShape.hasRows
        && treeShape.role === 'tree' && treeShape.token === '24px' && treeShape.rowH === 24
        && /auto|scroll/.test(treeShape.overflow),
      `children=${JSON.stringify(treeShape && treeShape.kids)}；--jt-row-h=${treeShape && treeShape.token}、行高 ${treeShape && treeShape.rowH}px；`
        + `overflow=${treeShape && treeShape.overflow}；垫片高度 ${treeShape && treeShape.padHeights.join('/')}`);

    /**
     * 把容器滚到某个绝对位置，再**另起一次往返**读那一帧的窗口形状。
     * 原先这里在页内 `await` 一枚 `{once:true}` 的 `scroll` 事件——第一枪 `top=0` 时 `scrollTop`
     * 压根没变，事件不发，于是这一发要一直挂到 CDP 的 30s 超时、把量具自己拖成 exit 2（假故障）。
     * 拆成"设位置 / 等一拍 / 读形状"三次往返，判据不变，只是不再赌事件会不会来。
     */
    const scrollProbe = async (top) => {
      const applied = await evalJs(`(() => { const box=document.querySelector(${JSON.stringify(TREE)});`
        + ` if(!box) return null; box.scrollTop=${top}; return Math.round(box.scrollTop); })()`);
      if (applied === null) return null;
      await wait(200);
      return evalJs(`(() => { const box=document.querySelector(${JSON.stringify(TREE)});`
        + " const rowsBox=[...box.children].find(k=>k.classList.contains('jt-tree__rows'));"
        + ' const rows=[...rowsBox.children];'
        + ' const first=rows[0], last=rows[rows.length-1];'
        + ' const cp=(el)=>{ const b=el && el.querySelector("[data-jt-copy]"); return b?b.getAttribute("data-jt-copy"):null; };'
        + ' return { scrollTop: Math.round(box.scrollTop), want: ' + top + ', scrollH: box.scrollHeight, n: rows.length,'
        + ' firstP: cp(first), lastP: cp(last), padTop: Math.round(parseFloat(box.children[0].style.height)||0),'
        + ' padBot: Math.round(parseFloat(box.children[2].style.height)||0),'
        + ' clientH: Math.round(box.clientHeight),'
        + ' rowsH: Math.round(rowsBox.getBoundingClientRect().height) }; })()');
    };
    const probes = [];
    for (const top of [0, 2000, 20000, 60000, 200000]) {
      const p = await scrollProbe(top);
      if (p) probes.push(p);
    }
    const RENDER_WINDOW = Number(/export const RENDER_WINDOW\s*=\s*(\d+)/.exec(
      fs.readFileSync(path.join(ROOT, 'dev/js/tools/json-tree.js'), 'utf8'))[1]);
    const overWindow = probes.filter((p) => p.n > RENDER_WINDOW);
    /**
     * 总长自洽那条用的是**夹具侧独立数出来的行数**（`TREE_ROWS`，本脚本自己按构造数），
     * 不是问页面"你有多少行"——问它自己报数就是把 flatten 的账再核一遍 flatten。
     */
    const wantScrollH = TREE_ROWS * 24 + 12;      // 12 = `.jt-tree` 上下各 6px 的 padding
    const sumShape = probes.map((p) => p.padTop + p.rowsH + p.padBot + 12);
    check(id(`7b 任意滚动位置下 DOM 行数 ≤ RENDER_WINDOW(${RENDER_WINDOW})，且垫片+行容器+padding == scrollHeight`),
      overWindow.length === 0 && probes.length >= 4 && probes.every((p, i) => Math.abs(p.scrollH - wantScrollH) <= 2
        && Math.abs(sumShape[i] - p.scrollH) <= 26),
      `总行数按夹具构造独立数出=${TREE_ROWS}（根 1 + 500×11），期望 scrollHeight=${wantScrollH}px；实测 `
        + probes.map((p, i) => `top${p.scrollTop}:行${p.n}/高${p.scrollH}/三段和${sumShape[i]}`).join(' ')
        + (overWindow.length ? ` ← 越过窗口 ${overWindow.length} 档` : ''));
    const bottom = probes[probes.length - 1];
    const lastPointer = `/e499/f9`;
    check(id('7c 滚到窗口上界之外仍然夹得住：最后一行落在夹具的真末尾（独立算出的那一条指针）'),
      !!bottom && bottom.lastP === lastPointer && bottom.scrollTop + bottom.clientH <= bottom.scrollH + 1
        && bottom.firstP !== null,
      `滚到 200000 后 scrollTop=${bottom && bottom.scrollTop}/${bottom && bottom.scrollH}（可视 ${bottom && bottom.clientH}）、`
        + `窗口首行=${bottom && bottom.firstP}、末行=${bottom && bottom.lastP}（要 ${lastPointer}）、行数 ${bottom && bottom.n}`);

    // ── 8) Pointer 点击复制（真鼠标 + 独立现算的 RFC 6901）──────────────────
    GROUP = '8) json Pointer 复制 8a–8b';
    await putValue(docId, JSON.stringify(POINTER_DOC, null, 2)); await wait(300);
    await clickById(`${pref}-btn-${PK}-validate`); await wait(300);
    await setSelect(`${pref}-in-${PK}-view`, 'tree'); await wait(380);
    const domPointers = await evalJs(`(() => [...document.querySelectorAll(${JSON.stringify(TREE + ' [data-jt-copy]')})]`
      + '.map(b=>b.getAttribute("data-jt-copy")))()');
    const UNKNOWN = '\u0000不在表里';
    const offTable = domPointers.filter((p) => !POINTER_TABLE.has(p));
    check(id('8a DOM 里每一行的 Pointer 都能在本脚本按 RFC 6901 现算的表里找到（含 ~0/~1 转义那两枚键名）'),
      domPointers.length > 0 && offTable.length === 0 && domPointers.includes(POINTER_ESCAPED),
      `渲染 ${domPointers.length} 枚、独立算出 ${POINTER_TABLE.size} 条；对不上的=${JSON.stringify(offTable)}；`
        + `转义那一条=${POINTER_ESCAPED}（在 DOM=${domPointers.includes(POINTER_ESCAPED)}）`);
    await resetSpy();
    const nth = domPointers.indexOf(POINTER_ESCAPED);
    const clicked = await realClick(`${TREE} [data-jt-copy]`, nth);
    const payload = await evalJs('window.__spy.copy.slice()');
    const flashLabel = await evalJs(`(() => { const b=[...document.querySelectorAll(${JSON.stringify(TREE + ' [data-jt-copy]')})][${nth}];`
      + ' return b ? b.textContent.trim() : null; })()');
    await wait(1700);
    const restored = await evalJs(`(() => { const b=[...document.querySelectorAll(${JSON.stringify(TREE + ' [data-jt-copy]')})][${nth}];`
      + ' return b ? b.textContent.trim() : null; })()');
    check(id('8b 真鼠标点那一枚 Pointer：命中测试自证、载荷逐字 == 独立算出的 RFC 6901 指针、改口之后会复原'),
      clicked.ok && payload.length === 1 && payload[0] === POINTER_ESCAPED && flashLabel !== restored,
      `命中=${JSON.stringify(clicked)}；第 ${nth} 枚（${POINTER_ESCAPED}）；载荷=${JSON.stringify(payload[0] || '')}；`
        + `改口=${JSON.stringify(flashLabel)} → 1.7s 后=${JSON.stringify(restored)}`);

    // ── 9) 三档硬输入 ─────────────────────────────────────────────────────
    GROUP = '9) json 三档硬输入 9a–9d';
    await setSelect(`${pref}-in-${PK}-view`, 'text'); await wait(200);
    await putValue(docId, JSON_AT_LIMIT); await wait(400);
    await clickById(`${pref}-btn-${PK}-validate`); await wait(1200);
    const atLimit = await readOut(OUT);
    check(id(`9a 恰好 ${MAX_BYTES} 字节（5 MiB 整）：放行，并且给得出统计那一行（不是"看着像成功"）`),
      !!atLimit && !/超出上限/.test(atLimit.text) && /字节/.test(atLimit.text) && atLimit.html > 200,
      `结果区 ${atLimit && atLimit.html}B；读数前 90 字=${String(atLimit && atLimit.text).slice(0, 90)}`);
    await putValue(docId, JSON_OVER_LIMIT); await wait(400);
    await clickById(`${pref}-btn-${PK}-validate`); await wait(900);
    const over = await readOut(OUT);
    const copyDisabled = await evalJs(`(() => { const b=document.getElementById('${pref}-btn-${PK}-copy');`
      + ' const m=document.getElementById(\'jt-copy-' + PK + '-main\'); return [b&&b.disabled, m&&m.disabled]; })()');
    check(id('9b 越界 1 字节：整体拒绝、点名差多少、结果区不许把那一大串再打一遍、复制按钮不许解锁'),
      !!over && /超出上限/.test(over.text) && /1\s*字节/.test(over.text) && over.html < 4000
        && copyDisabled.every((x) => x === true),
      `结果区 ${over && over.html}B（判线 <4000）；话=${String(over && over.text).slice(0, 120)}；`
        + `两枚复制按钮 disabled=${JSON.stringify(copyDisabled)}`);
    await putValue(docId, JSON_DEEP_200); await wait(300);
    await clickById(`${pref}-btn-${PK}-validate`); await wait(900);
    const deep = await readOut(OUT);
    check(id('9c 200 层嵌套（闸门之下、深样本那一档）：放行、给得出深度统计、并且把代价那句话说出来'),
      !!deep && !/超出上限/.test(deep.text) && deep.text.includes(DEEP_NOTE.replace(/\\"/g, '"'))
        && /深度/.test(deep.text),
      `结果区 ${deep && deep.html}B；深样本那句（从 json-core.js 现读）=${JSON.stringify(DEEP_NOTE.slice(0, 30))}；`
        + `读数=${String(deep && deep.text).slice(0, 150)}`);
    /**
     * 9d 粘贴不自动解析 + 不卡死：2 MB 输入连发 20 次 `input`。
     * "解析发生 0 次"这一格在 §W 的 Node 判据里数的是注入 `later` 的调用次数与 `coreParse` 的调用——
     * 页内那本模块没有对外计数口，浏览器这一头判的是**能观察到的那一面**：点按钮之前结果区一个字节都不长、
     * 读数跟着防抖走、整段墙钟时间不失控。两头的口径都写出来，别让读的人以为这里数了解析次数。
     */
    await setVp(1280); await goto(URL_OF(P.url)); await wait(360);
    const outBefore = await evalJs(`(() => { const el=document.querySelector(${JSON.stringify(OUT)});`
      + ' return el ? el.innerHTML.length : -1; })()');
    const t0 = Date.now();
    await evalJs(`(() => { const el=document.getElementById(${JSON.stringify(docId)});`
      + ` el.value=${JSON.stringify(PASTE_2MB)};`
      + " for (let i=0;i<20;i+=1) el.dispatchEvent(new Event('input',{bubbles:true}));"
      + ' return String(el.value.length); })()');
    /** 状态行由防抖写出来，所以"落定才读"，不是"等 500ms 读一次"（理由见 `readSettledText` 那一段）。 */
    const stat = await readSettledText(`#${pref}-status-${PK}-main`);
    const statusAfter = stat.text;
    const outDuringPaste = await evalJs(`(() => { const el=document.querySelector(${JSON.stringify(OUT)});`
      + ' return el ? el.innerHTML.length : -1; })()');
    await clickById(`${pref}-btn-${PK}-format`); await wait(1400);
    const outAfterBtn = await evalJs(`(() => { const el=document.querySelector(${JSON.stringify(OUT)});`
      + ' return el ? el.innerHTML.length : -1; })()');
    const wall = Date.now() - t0;
    /**
     * 期望字节数从**夹具自己**算，不写死数字：`PASTE_2MB` 里的 `2 * 1024 * 1024` 是体那一段，
     * 外壳的 `{"big":"…"` 与 `"}` 也进字节数。上一版把判据写成 `209715[0-9]|209714[0-9]` 两个前缀，
     * 而真实读数是 2,097,162——**两个前缀都匹不上**，这一枪永远红。
     */
    const wantBytes = Buffer.byteLength(PASTE_2MB, 'utf8');
    check(id('9d 2 MB 输入连发 20 次 input：点按钮之前结果区一字节都不长（粘贴不自动解析）、读数跟着防抖走、整段不卡死'),
      outDuringPaste === outBefore && outAfterBtn > outBefore && stat.quiet
        && String(statusAfter).includes(`字节 ${wantBytes}`) && wall < 12000,
      `out.innerHTML 粘贴中=${outDuringPaste}B（与初始 ${outBefore}B 相同）→ 按按钮后=${outAfterBtn}B；`
        + `读数=${JSON.stringify(statusAfter)}（要含「字节 ${wantBytes}」，由 Buffer.byteLength(夹具) 现算）；`
        + `状态行落定 ${stat.settledMs}ms / ${stat.samples} 次采样（${stat.quiet ? '已落定' : '到 4s 上限仍在漂'}）；`
        + `20 次 input + 一次动作墙钟 ${wall}ms`);

    // ── 10) 下载 .json 那一条 ─────────────────────────────────────────────
    GROUP = '10) json 下载 10a–10b';
    await setVp(1280); await goto(URL_OF(P.url)); await wait(360);
    /**
     * 钩子形状、每一次点击的返回值、下载按钮自己的状态，三样都要落到读数里。
     * 上一版这三样一概不报，于是 `create=0` 那一条红得没有指向：它既可能是"页面没造 Blob"，
     * 也可能是"按钮 disabled 所以那一次 `click()` 是空转"，还可能是"钩子根本没装上"——
     * 三种因的修法完全不同，读数必须一眼分得开（记忆规则「核验脚手架自己会静默说谎」）。
     * 注入的那三件（`BlobCtor` / `createObjectURL` / `revokeObjectURL`）在装配层是
     * `(b) => URL.createObjectURL(b)` 这样的**调用时才查表**的箭头，所以挂载之后再包 `URL`
     * 是看得见的；这一格不需要 `addScriptToEvaluateOnNewDocument`，但需要能自证包上了。
     */
    const spyShape = await installSpies();
    const DL = `${pref}-btn-${PK}-download`;
    const btnState = () => evalJs(`(() => { const el=document.getElementById(${JSON.stringify(DL)});`
      + ' return el ? { found: true, disabled: el.disabled, tag: el.tagName, type: el.type'
      + ' } : { found: false }; })()');
    const lenPut = await putValue(docId, '{"a":[1,2],"b":{"c":"值"}}'); await wait(260);
    const cFmt = await clickById(`${pref}-btn-${PK}-format`); await wait(320);
    const bodyText = await evalJs(`(() => { const el=document.querySelector(${JSON.stringify(OUT + ' .jt-out__body')});`
      + ' return el ? el.textContent : null; })()');
    await resetSpy();
    const b0 = await btnState();
    const cDl = await clickById(DL); await wait(400);
    const dl = await evalJs(`(() => ({ ...window.__spy, anchors: document.querySelectorAll('body a[download]').length }))()`);
    const blobText = await readBlobText();
    check(id('10a 下载 .json：createObjectURL 收到的是真 Blob、内容逐字节 == 结果栏正文、MIME 是 application/json、revoke 被叫到、body 不留游离 <a>'),
      // MIME 那一格读的是 `blobType`：上一版写成 `dl.type`（`__spy` 里没有这个键），
      // 于是 `undefined === 'application/json'` 恒假——读数里明明印着 `type="application/json"`，
      // 判据量的却是另一枚根本不存在的字段。读数和判据必须点同一枚字段。
      dl.create === 1 && dl.isBlob && dl.blobType === 'application/json' && dl.revoke >= 1 && dl.anchors === 0
        && dl.anchorName === 'data.json' && typeof blobText === 'string' && blobText === bodyText
        && dl.blobSize === Buffer.byteLength(String(bodyText), 'utf8'),
      `钩子=${spyShape}；输入=${lenPut} 字、格式化点击=${cFmt}、下载按钮=${JSON.stringify(b0)}、下载点击=${cDl}；`
        + `create=${dl.create}、isBlob=${dl.isBlob}、type=${JSON.stringify(dl.blobType)}、size=${dl.blobSize}（Node 算 ${Buffer.byteLength(String(bodyText), 'utf8')}）、`
        + `revoke=${dl.revoke}、文件名=${JSON.stringify(dl.anchorName)}、body 里残留 <a download> ${dl.anchors} 枚；`
        + `Blob 内容 == 结果栏正文=${blobText === bodyText}（正文 ${bodyText === null ? '没读到' : `${bodyText.length} 字`}）`);
    /** 类别跟着栏目走那一格（评审 P2-10）：生成 TypeScript 之后下载得到的必须是 .ts，不是 data.json */
    const cTs = await clickById(`${pref}-btn-${PK}-ts`); await wait(400); await resetSpy();
    const b1 = await btnState();
    const cDl2 = await clickById(DL); await wait(400);
    const dlTs = await evalJs(`(() => ({ create: window.__spy.create, type: window.__spy.blobType,`
      + ` name: window.__spy.anchorName, revoke: window.__spy.revoke }))()`);
    check(id('10b 类别跟着栏目走：生成 TypeScript 之后下载得到 data.ts 与 text/plain，不是 data.json'),
      dlTs.create === 1 && dlTs.name === 'data.ts' && dlTs.type === 'text/plain' && dlTs.revoke >= 1,
      `TypeScript 点击=${cTs}、下载按钮=${JSON.stringify(b1)}、下载点击=${cDl2}；${JSON.stringify(dlTs)}`);
  }
}

// ══ 11) §7 那两行的先量后立（Node 侧，不开页）═══════════════════════════════
GROUP = '11) §7 字节 11a–11c';
/**
 * 口径逐行写死在这里，因为 spec §7 那几行读的就是这一把尺（计划 §0.5 的原文）。
 *
 * **预算余量的分母统一是「预算」，不是「实测」**（2026-09-30 Task 8 收口时改的）：
 * §7 正文四条老行从头到尾都写「73,359 对 77,824 余 4,465B（5.7%）」这种「(预算 − 实测) ÷ 预算」，
 * 而这一格此前打的是「÷ 实测」——同一件事两个数（证件页首屏 463B 在 §7 是 2.8%、在这里是 2.9%，
 * JSON 页 JS+CSS 更是差到 124.9% 这种没法读的形状）。判据与文档必须指向同一把尺，
 * 否则"余量掉没掉到 5% 以下"这件事两边各判一次、各得一个结论。
 * 老那一格（11a 的设计期 120KB）也一起改口，并且把分母写进明细串，让人不必猜。
 *
 * 两行 JSON 的 `budget` 是**按本次实测量立出来的**（不是设计期拍的数），推导过程由 11c 现算：
 * 取 L6/L9 里**较大的那一档**当最坏读数（压缩级抖动必须被余量吸收，§7 第一段那条理由），
 * 再要求「(预算 − 最坏) ÷ 预算 ≥ 5%」（段 3 计划 §0.4 立的线），最后向上取到 1024 的整数倍。
 * 立出来的两个数：JS+CSS **58,368B（57KB）**、首屏 **17,408B（17KB）**。
 */
const ROWS = [
  { row: '证件页 JS+CSS', files: ['assets/css/toolkit.min.css', 'assets/js/toolkitCore.min.js', 'assets/js/toolIdcard.min.js'], budget: 77824 },
  { row: '证件页自身增量的首屏成本', files: ['assets/css/toolkit.min.css', 'tools/idcard.html'], budget: 16384 },
  { row: '编码页 JS+CSS', files: ['assets/css/toolkit.min.css', 'assets/js/toolkitCore.min.js', 'assets/js/toolCodec.min.js'], budget: 32768 },
  { row: '编码页自身增量的首屏成本', files: ['assets/css/toolkit.min.css', 'tools/codec.html'], budget: 17408 },
  { row: 'JSON 页 JS+CSS', files: ['assets/css/toolkit.min.css', 'assets/js/toolkitCore.min.js', 'assets/js/toolJson.min.js', 'assets/css/toolJson.min.css'], budget: 58368 },
  { row: 'JSON 页自身增量的首屏成本', files: ['assets/css/toolkit.min.css', 'assets/css/toolJson.min.css', 'tools/json.html'], budget: 17408 },
];
/** §7 表里 JSON 那一行设计期拍的 120KB：它只服务一件事——判要不要触发"YAML 降到仅序列化"那一档 */
const DESIGN_YAML_CAP = 122880;
const measured = ROWS.map((r) => {
  const per = r.files.map((f) => {
    const abs = path.join(SITE, f);
    if (!fs.existsSync(abs)) die(`§7 口径里的 ${f} 不在快照里`);
    return { f, raw: fs.statSync(abs).size, g9: gz(abs, 9), g6: gz(abs, 6) };
  });
  const sum9 = per.reduce((s, x) => s + x.g9, 0);
  const sum6 = per.reduce((s, x) => s + x.g6, 0);
  return { ...r, per, sum9, sum6, worst: Math.max(sum9, sum6) };
});
/** 「(预算 − 实测) ÷ 预算」——§7 正文用的那把尺，这里逐字打成 `余 NB=NN.N%` */
const margin = (budget, at) => `余 ${budget - at}B=${((budget - at) / budget * 100).toFixed(1)}% 相对预算`;
const jsonTotal = measured.find((m) => m.row === 'JSON 页 JS+CSS');
check('11a JSON 页 JS+CSS 实测远在 120KB（设计期拍的数）之下，不触发"YAML 降到仅序列化"那一档',
  jsonTotal.sum9 < DESIGN_YAML_CAP,
  `实测 ${jsonTotal.sum9}B（gzip -9，逐件 ${jsonTotal.per.map((x) => `${x.f.split('/').pop()}=${x.g9}`).join(' + ')}）；`
    + `设计期那一档 ${DESIGN_YAML_CAP}B → ${margin(DESIGN_YAML_CAP, jsonTotal.sum9)}`);
/**
 * 判的是**两条老规矩**：① 每一件都量得出非零字节，② L6↔L9 抖动 < 4,000B（超过就说明压缩器
 * 或数据形状变了，那不再是"参数抖动"而是"该重新决定预算"），③ 有预算的行**两档读数都在档内**。
 * ≥5% 那一档**不在这里判**：它是**立预算**时的规则（11c 判），不是**守预算**时的规则——
 * §7 现有四行里已有两行落在 5% 以下（证件页首屏、编码页 JS+CSS），那是 Task 8 量出来的事实、
 * 要人重新决定档位，不是把档位松开就能绿的事；把它写成判据会让这一格从第一天就红着，
 * 而红着的门禁和没门禁等价。低于 5% 的行在明细里**逐行点名**，不藏。
 */
check('11b 六行全部同表重算，压缩级抖动 level 6↔9 逐行报出（预算余量必须吸收得掉它）',
  measured.every((m) => m.sum9 > 0 && m.sum6 > 0 && Math.abs(m.sum6 - m.sum9) < 4000
    && m.worst <= m.budget),
  measured.map((m) => `${m.row}: L9=${m.sum9}B / L6=${m.sum6}B（抖 ${m.sum6 - m.sum9 >= 0 ? '+' : ''}${m.sum6 - m.sum9}）`
    + ` / 预算 ${m.budget}B、${margin(m.budget, m.sum9)}`
    + `${(m.budget - m.sum9) / m.budget < 0.05 ? ' ⚠低于5%' : ''}`).join('；'));
/**
 * 新立的那两行按 §0.4 的取档规则**当场回算一遍**：判「写进 ROWS 的档 ≥ 最坏读数 ÷ 0.95」，
 * 并打出"满足这一条的最小 1024 倍数"。字节只减不增时这一条继续绿（不必跟着缩档，
 * §7 的老两行就是同一形状）；一旦增长到吸收不掉 5%，红的就是这一条，且明细直接给出该立的新档。
 */
check('11c 新立的 JSON 两行按"最坏读数 ÷ 0.95 再向上取 1024 倍"当场回算得出台账里写的档（≥5% 是立预算的规则）',
  measured.filter((m) => /JSON/.test(m.row)).every((m) => m.budget >= Math.ceil(m.worst / 0.95 / 1024) * 1024),
  measured.filter((m) => /JSON/.test(m.row)).map((m) => `${m.row}: 最坏读数=${m.worst}B（L6/L9 取大）`
    + ` → ÷0.95=${Math.ceil(m.worst / 0.95)}B → 取 1024 倍=${Math.ceil(m.worst / 0.95 / 1024) * 1024}B`
    + ` ｜ 台账写 ${m.budget}B、${margin(m.budget, m.worst)}`).join('；')
    + '；口径：预算 − 最坏读数，分母是预算');


// ══ 汇总 ════════════════════════════════════════════════════════════════════
const red = results.filter((r) => !r.pass);
console.log(`\n# 合计 ${results.length} 项，红 ${red.length} 项`
  + (red.length ? `：${red.map((r) => r.id.split(' ')[0]).join('、')}` : ''));
console.log(`# 分组：${[...new Set(results.map((r) => r.id.split('/')[0]))].join(' / ')}`);
teardown();
process.exit(red.length ? 1 : 0);
