/**
 * 文件对比页的行级与 token 级对齐引擎（段 5 Task 2；§X）。这一本只管"两段文本怎么对齐、对齐成什么形状"，
 * 不碰 DOM、不读环境、不 `import` 本仓库任何模块——它是纯逻辑层，`diff-json.js` 与视图层、装配层
 * 都只能往下拿，不许往上问。
 *
 * 为什么对齐要自己写（而不是配一个贪心配点就交差）：这一页的**结论行**要写"增 N 行、删 M 行、改 K 处、
 * 差异块 P 个"，而 N/M/K/P 只有在**最短编辑脚本**上才有唯一含义。同一对文件用贪心配点对出来的
 * "改 12 处"和用 LCS 对出来的"改 7 处"都算"对上了"，但用户在页面上读到的那个数是这一页最硬的一句承诺。
 * 所以 §X 的 X4 拿测试侧独立实现的朴素 LCS DP 当长度尺子对拍，X5 钉三条覆盖不变式——
 * **先证它是最短的，再谈那几个数能写进句子**。
 *
 * 五条设计口径，逐条都有判据对着咬：
 *
 * 1. **归一化只影响判等，不影响展示与行号**（X6）。`compareKey` 是唯一的归一化出口，勾了"忽略空白 /
 *    忽略大小写"之后变的是键，行内容、行号与 `unifiedText` 的内容行一律抄原文。这一条是本页最容易
 *    说谎的地方：一旦归一化后的串漏进展示，页面上就会出现"用户看不见那处差异，却告诉他完全相同"。
 * 2. **降级不是截断**（X13、X14）。编辑距离越到 `MAX_COST` 就整块按"删 + 增"给，行数一行不少，
 *    只是不再配对；`cost` 在降级档报的是这条块脚本的长度，所以它必然 ≥ 不降级档——X14 钉的就是这一句。
 *    越线是**按盒子**判的：分治每一层先拿一道 O(len) 的**多重集合下界**快判（`matchCap`），下界已经越过
 *    `cap` 就只降级这一格。写在整份文件那一层会打出一个很难看的形状——十万行的文件中间改了 2500 行，
 *    全局下界越线就等于把剩下九万七千行逐行对上的功劳也一起抹掉。进 Myers 之前不做那道快判，
 *    另一头则是两份完全不相干的长文本要把格子跑满 `MAX_COST²` 个：页面上十几秒什么都没有，
 *    而那恰好是用户最该立刻看到结论的形状。
 * 3. **CRLF 与末行换行是两种不同的事实**（X1、X9、X10、X25）。`splitLines` 把行尾那个 `\r` 剥进
 *    `crlf[]`，所以行内容里剩下的 `\r` 是正文而不是行尾；`finalNewline` 单独一格，对应的正是 git 用
 *    `\ No newline at end of file` 标记的那件事。两者都不许被"统一 trim 一下"顺手吃掉。
 * 4. **`ops` 的形状是这一本对外的唯一合同**（X5）。按文档顺序、无重叠、覆盖两侧全部行；每个极大非等段
 *    由 `mergeRuns` 规范化成"一整块 `del` + 一整块 `ins`"（`segmentsOf` 再把它折成"成对 + 余下"），
 *    统计量、`hunksOf` 的 `change` 行、`unifiedText` 的 `@@` 区间三处全从这里派生，谁也不许另算一遍。
 * 5. **token 规则写死在这个顺序上**（X15、X16）：空白串 → ASCII 词（数字段跟着词一起）→ 其余逐码点。
 *    按 `\w+` 切会把一整句中文切成一个 token，行内高亮当场退化成整行着色；逐码点切则必须
 *    **不切出孤立代理项**，emoji 那一判拿 `encodeURIComponent` 会抛 `URIError` 这件事当尺子。
 *
 * 与 `json-core.js` 的关系：只有**口径**共享，没有一行代码共享（段 5 计划 §0.4 那条构建层红线——
 * 两个入口 reach 同一模块，Rollup 会切出带 `import{` 的共享 chunk，`iifeWrapPlugin` 包完就是整页
 * SyntaxError 而构建 exit=0）。`MAX_INPUT_BYTES` / `MAX_INPUT_LINES` 两格与 spec §7 输入硬上限那一行
 * 同源；字节尺子用的是与 `json-core.js:101` 同一份按码元数的写法（浏览器里没有 `Buffer`），
 * §X1 那条判据拿 Node 的 `Buffer.byteLength` 从外面量它，与 §S 的 S3/S18 是同一种对拍。
 *
 * 复算：`node --test scripts/toolkit-tests.mjs` 里的 §X 二十九判。
 */

/** `\n` 与 `\r` 的码元值：这一本只用这两个常量判行尾，别处不许另写 13/10 */
const LF = 10;
const CR = 13;

// ── 常量 ────────────────────────────────────────────────────────────────────

/** 每侧输入的 UTF-8 字节上限（5 MiB），与 JSON 页同一把尺；`gate()` 按侧判，不按两侧合计判 */
export const MAX_INPUT_BYTES = 5242880;

/** 每侧行数上限（20 万行）：超了就拒，不给"只看前 20 万行"的静默截断 */
export const MAX_INPUT_LINES = 200000;

/**
 * 行级对齐的编辑距离上限。越线走"整块删 + 整块增"的降级档（口径 2），不是走"少给你几行"。
 *
 * 为什么是 2000 这一档：这一格的账单随编辑距离**超线性**涨（V 表只开到 `[-D, D]` 那一扇窗口，
 * 分治每层还要 `minCost` 一遍），所以它就是"最坏一次对齐点多久"的直接旋钮。段 5 实测曲线
 * （Node 22 单线程、`load average` 5.4；构造钉死在两侧各 n=20000 行 `l0…l19999`、每
 * `step = 2n/D` 行换掉一行 ⇒ 换一行 = 一删一增 = `cost` 正好 D，`maxCost` 给 `1e9` 不夹）：
 * `D=1000 → 284ms`、`D=2000 → 649ms`、`D=2500 → 910ms`、`D=4000 → 2100ms`、`D=5000 → 3720ms`
 * ——5 倍的 D 换来 13 倍的时间。按这条曲线外推，契约 §1.1 原本写的 `20000` 那一档是**几十秒**
 * （二次模型给 100×649ms ≈ 65s，按实测涨法也有 40s 开外），一次粘贴就能把主线程锁死半分钟。
 * 取 2000 = 闸门线上最坏一次对齐压在桌面 0.7s 内，手机还要再慢三到五倍。对应的用户形状是
 * "一次改动两千行以内逐行配对，再多就按块给"，而那一档的产物本来也没人能读完。
 * 它不管"能喂多少行"——那一档是 `gate()` 的 `MAX_INPUT_LINES`。复算脚本见段 5 计划 §0.6 那一行。
 */
export const MAX_COST = 2000;

/** 单对行做行内细化的 token 上限（两侧之和）：越线那一对退化成整行着色，`stats.inlineSkipped` 计数。
 *  这一档管的是**形状**而不是时间——一对行切出四千枚 token，页面就要往那一行里塞四千来个 `<span>`，
 *  读不出任何东西；时间那一份由 `MAX_INLINE_WORK` 管，两档各判各的。 */
export const MAX_INLINE_TOKENS = 4000;

/**
 * 行内细化的**总量预算**，单位是"对齐格子数"（`4 × D²` 那一本账）——尺度与 `MAX_COST` 同源：
 * 上面那条曲线上一次对齐的耗时除以格子数，本机读到的是**每格 30–70ns** 一档。这一格存在的理由是
 * 那一族脚本真正的账单形状：行内那一步按**行对**逐个跑 Myers，单个行对再便宜，
 * `Σ 每对的格子数` 也会随改动行数累加——十万行的中文文件逐行改下来，光靠单对形状闸门
 * （`MAX_INLINE_TOKENS`）拦不住，页面会在行内那一步走掉十几秒。
 *
 * 每个行对记**两笔**：① 切分那一刀按 `min(字符数, MAX_INLINE_TOKENS)` 记——`tokenize` 带 limit，
 * 一侧最多切到四千零一枚就收手，所以这一笔记的是**真实上界**，不是"这一行有多长"；
 * ② 对齐最坏要走的格子数（`inlineWorkOf`：`4 × min(裁掉公共前后缀后余下的 token 数, MAX_COST)²`
 * ——前后缀一裁，余下的就是真在变的区段，而 `D` 越线之后走的是 O(n) 的降级快判，夹在 `MAX_COST` 才对）。
 * 3,000,000 那一格不是估的：段 5 用同一份输入跑 A/B（A = 现行常数，B = 只把这一格换成 `Infinity`
 * 的一份副本，构造钉死在"两侧各 10000 行、每行 8 个 ASCII 词、两侧逐词全不同"）——
 * **A 126ms（`inlineSkipped` 9191）/ B 857ms（跳过 0）**，比值 6.8×；同一台机 `load average` 5.4。
 * 也就是"整页行内那一步压在 0.1s 量级"是买到的，不是假设的。复算脚本见段 5 计划 §0.6 那一行。
 *
 * 装不下的行对**整行着色**（`DIFF_NOTES.inlineSkipped` 那句），规则是按文档顺序第一 fits：
 * 装得下就细化、装不下就跳过这一对继续看下一对，而不是"遇到一对超预算就把后面全掐掉"——
 * 后者会让一个 4000 token 的长行把整页的行内高亮带走，而它明明只需要跳过自己。
 * 按文档顺序而不是按大小排序，是为了同一份输入两次结果逐格相同（X28）。
 */
export const MAX_INLINE_WORK = 3000000;

/** 折叠时每个差异块首尾各保留的上下文行数，也是 `unifiedText` 的默认档 */
export const DEFAULT_CONTEXT = 3;

/** CRLF 那一档在界面上的形状：视图层拿它补进行尾，`␍` 是本模块与 `diffView.js` 之间唯一的字形约定 */
export const CR_GLYPH = '␍';

// ── 内部工具 ────────────────────────────────────────────────────────────────

/**
 * 报错里要说清"这里给的是什么东西"。只用 `typeof` 与 `Array.isArray`（不引 `node:util`，
 * 这一本要能在浏览器里直接跑），`null` 单独点名。
 * @param {unknown} v
 * @returns {string}
 */
function typeName(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

/**
 * UTF-8 字节数：代理对算 4，BMP 按 3/2/1。与 `json-core.js:101` 同一份算法而不是同一份代码，
 * 理由见文件头那句"两个入口"的红线；§X1 拿 `Buffer.byteLength` 从外面量它。
 * @param {string} text
 * @returns {number}
 */
function utf8Bytes(text) {
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) total += 1;
    else if (c < 0x800) total += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length
      && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) { total += 4; i++; }
    else total += 3;
  }
  return total;
}

/**
 * 归一化开关的取值档。三个键都必须是**布尔**：`{ws:'yes'}` 这种 truthy 但非法的值一律 `TypeError`（X27），
 * 未知键同样拒。装配层从 checkbox 拿的是 `input.checked`（真布尔），所以这里严格一档不会误伤；
 * 反过来，拼错的键名（`ignoreWs`）如果被静默忽略，页面上那个勾选框就成了一件装饰品，而它看上去在工作。
 * @param {object|undefined|null} opts
 * @param {string} at 报错署名的调用点
 * @param {boolean} [withCrlf] 这一层认不认 `crlf` 那一格（只有 `compareKey` 认）
 * @returns {{ws: boolean, case: boolean, crlf: boolean}}
 */
function normOpts(opts, at, withCrlf = false) {
  if (opts === undefined || opts === null) return { ws: false, case: false, crlf: false };
  if (typeof opts !== 'object' || Array.isArray(opts)) {
    throw new TypeError(`${at}：opts 必须是对象，这里是 ${typeName(opts)}`);
  }
  const out = { ws: false, case: false, crlf: false };
  for (const k of Object.keys(opts)) {
    if (k === 'ws' || k === 'case') {
      const v = opts[k];
      if (typeof v !== 'boolean') {
        throw new TypeError(`${at}：opts.${k} 必须是布尔值，这里是 ${typeName(v)}（truthy 不等于 true）`);
      }
      out[k] = v;
    } else if (k === 'crlf') {
      if (!withCrlf) throw new TypeError(`${at}：opts.crlf 只有 compareKey(line, opts) 认这一格`);
      const v = opts[k];
      if (typeof v !== 'boolean') throw new TypeError(`${at}：opts.crlf 必须是布尔值，这里是 ${typeName(v)}`);
      out.crlf = v;
    } else {
      throw new TypeError(`${at}：opts 里没有 ${k} 这一档（可用的是 ws / case${withCrlf ? ' / crlf' : ''}）`);
    }
  }
  return out;
}

// ── 拆行与归一化 ─────────────────────────────────────────────────────────────

/**
 * 拆行：只认 `\n`。行尾那个 `\r` 剥出来记进 `crlf[]`（所以行内容里的 `\r` 是正文，不是断行），
 * 末行没有 `\n` 时 `finalNewline` 为 `false`——那一档单独成判据（X10），因为它对应的是 git 用
 * `\ No newline at end of file` 标记的那件事，不是"少一行"。
 *
 * 空串给的是**零行**（`count: 0`、`finalNewline: true`），只有一枚 `\n` 给的是**一行空行**：
 * "这个文件没有内容"与"这个文件有一行，那一行是空的"是两件事，并成一档的话
 * 空文件比空文件就会报出非零的 `added/removed`。
 * @param {string} text 整段输入
 * @returns {{lines: string[], count: number, crlf: boolean[], finalNewline: boolean, bytes: number}}
 */
export function splitLines(text) {
  if (typeof text !== 'string') {
    throw new TypeError(`splitLines(text)：text 必须是字符串，这里是 ${typeName(text)}`);
  }
  const lines = [];
  const crlf = [];
  let start = 0;
  let finalNewline = true;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) !== LF) continue;
    let end = i;
    const isCrlf = end > start && text.charCodeAt(end - 1) === CR;
    if (isCrlf) end -= 1;
    lines.push(text.slice(start, end));
    crlf.push(isCrlf);
    start = i + 1;
  }
  if (start < text.length) {
    lines.push(text.slice(start));
    crlf.push(false);
    finalNewline = false;
  }
  return { lines, count: lines.length, crlf, finalNewline, bytes: utf8Bytes(text) };
}

/**
 * 比较键：**只用于判等**（口径 1，X6 钉这一句）。三档的先后是定死的：先补行尾 `\r`（当这一行的
 * `crlf` 为真），再按 `ws` 把连续空白并成一格并去掉首尾，最后按 `case` 落小写。
 *
 * `ws` 那一档"并成空格"而不是"删掉所有空白"，所以 `'a b'` 与 `'a  b'` 相同而 `'ab'` 与 `'a b'`
 * 不同（X7）：把空白全删掉会造出一批"看上去完全不同却被判相同"的行，那种"相同"用户在页面上读不出来。
 * @param {string} line 行原文（不含 `\n`）
 * @param {{ws?: boolean, case?: boolean, crlf?: boolean}} [opts]
 * @returns {string}
 */
export function compareKey(line, opts) {
  if (typeof line !== 'string') {
    throw new TypeError(`compareKey(line, opts)：line 必须是字符串，这里是 ${typeName(line)}`);
  }
  const o = normOpts(opts, 'compareKey(line, opts)', true);
  let s = o.crlf ? `${line}\r` : line;
  if (o.ws) s = s.replace(/\s+/g, ' ').trim();
  if (o.case) s = s.toLowerCase();
  return s;
}

// ── token 化（行内细化用）───────────────────────────────────────────────────

/**
 * token 的四条序（口径 5）：① 连续空白（含制表）成一枚 ② ASCII 词 `[A-Za-z0-9_]+` 成一枚
 * （数字段跟着词，所以不另起第三条）③ 其余逐码点。
 *
 * 两面都带 `y`（sticky）：从**下标**往前推，而不是每枚都 `slice` 一次剩下的整行——闸门允许
 * 单行 5 MiB，`slice` 版本在那一行上是 O(n²)，光切 token 就能吃掉好几秒。
 */
const WS_TOKEN = /\s+/y;
const WORD_TOKEN = /[A-Za-z0-9_]+/y;

/**
 * 把一行切成 token，每枚带 `text`（上色用原文）与 `key`（判等用归一化键）。于是行内细化与行级判等
 * 共用同一把尺子：勾了忽略大小写之后，行内也不该把 `Foo` 与 `foo` 标成两处改动。
 *
 * `limit` 是**单侧**的枚数上限：越线直接返回 `null`，不继续把剩下的行切完。传它是因为
 * `MAX_INLINE_TOKENS` 那道闸门看的是两侧之和，任何一侧单独越过这条线，那一和必然也越——
 * 于是"提前收手"不影响判定的结论，只影响要不要为一行 5 MiB 的样本建一张百万项的表。
 * @param {string} line
 * @param {{ws?: boolean, case?: boolean}} opts 已经过 `normOpts` 的那一份
 * @param {number} [limit] 单侧枚数上限，越线返回 `null`
 * @returns {{text: string, key: string}[]|null}
 */
function tokenize(line, opts, limit = Infinity) {
  const out = [];
  let i = 0;
  while (i < line.length) {
    WS_TOKEN.lastIndex = i;
    WORD_TOKEN.lastIndex = i;
    let text;
    const ws = WS_TOKEN.exec(line);
    if (ws) text = ws[0];
    else {
      const w = WORD_TOKEN.exec(line);
      if (w) text = w[0];
      else {
        // 逐码点：`codePointAt` 天然把代理对当成一枚取（X16 的那把尺就是这件事）
        const cp = line.codePointAt(i);
        if (Number.isNaN(cp)) break;
        text = String.fromCodePoint(cp);
      }
    }
    if (text === '') break;
    i += text.length;
    let key = text;
    if (opts.ws) key = key.replace(/\s+/g, ' ');
    if (opts.case) key = key.toLowerCase();
    out.push({ text, key });
    if (out.length > limit) return null;
  }
  return out;
}

// ── Myers：最短编辑脚本（线性空间分治）──────────────────────────────────────

/**
 * Myers 贪心推进的核心循环——**前向表、后向表、求最短步数三件事共用这一本**（夹边与"不可达"
 * 的规则只要写两遍，就会有一遍是错的；X4 的对拍第一轮抓到的正是这种第二遍）。
 *
 * 约定：`eq(i, j)` 的下标相对**盒子起点**，`0 ≤ i < n`、`0 ≤ j < m`；`backward` 为真时坐标从盒子
 * **右下角**往回数（`k = xb - yb`，与绝对对角线的关系是 `kb = delta - k`），规则本身一模一样。
 *
 * 两条"不可达"必须分开处理，混起来就是最短性的直接漏洞：
 * - 前驱对角线在范围外（`|k±1| > d-1`）或值是 `-1`：那一格这一步到不了。两侧都到不了就 `continue`
 *   留 `-1`——旧写法在这里会算出 `xx = 0`，把一条根本走不到的对角线当成"走到了起点"，
 *   那个假接点会顺着分治漏进子问题，报出的脚本长度既可能比最短的长、也可能比最短的**短**
 *   （后者更危险：它是一条根本不成立的编辑脚本，页面上却读起来完全合理）。
 * - `x` 超出盒子：夹到 `hi = min(n, m + k)`。夹在 `n` 是不够的——`k < n - m` 那一档夹到 `n`
 *   会留下 `y > m` 的假点，蛇形延伸再从假点出发，等于凭空多走了一步。
 *
 * `delta` 给了就每步末尾查一次终点（求 D 用），到了就返回那一步；不给就是把 `dMax` 步转满（分治用）。
 * @param {number} n 盒子 a 侧长度
 * @param {number} m 盒子 b 侧长度
 * @param {number} dMax 最多转这么多步
 * @param {(i: number, j: number) => boolean} eq 相对盒子起点
 * @param {boolean} [backward] 从右下角往回数
 * @param {number|null} [delta] 终点所在对角线 `n - m`；给了就在每步末尾查一次
 * @returns {{v: Int32Array, off: number, d: number}} `d` 为 -1 表示转满仍未到终点
 */
function greedy(n, m, dMax, eq, backward = false, delta = null) {
  const off = dMax;
  const v = new Int32Array(2 * dMax + 1).fill(-1);
  const at = backward ? (i, j) => eq(n - 1 - i, m - 1 - j) : eq;
  let x = 0;
  let y = 0;
  while (x < n && y < m && at(x, y)) { x += 1; y += 1; }
  v[off] = x;
  if (delta !== null && x >= n && y >= m) return { v, off, d: 0 };
  for (let d = 1; d <= dMax; d++) {
    for (let k = -d; k <= d; k += 2) {
      if (k > n || k < -m) continue;
      const down = Math.abs(k + 1) <= d - 1 ? v[off + k + 1] : -1;
      const right = Math.abs(k - 1) <= d - 1 ? v[off + k - 1] : -1;
      let xx = -1;
      if (down >= 0 && right >= 0) xx = right < down ? down : right + 1;
      else if (down >= 0) xx = down;
      else if (right >= 0) xx = right + 1;
      if (xx < 0) continue;
      const hi = m + k < n ? m + k : n;
      if (xx > hi) xx = hi;
      let yy = xx - k;
      while (xx < n && yy < m && at(xx, yy)) { xx += 1; yy += 1; }
      v[off + k] = xx;
    }
    if (delta !== null && Math.abs(delta) <= d && (d - delta) % 2 === 0 && v[off + delta] >= n) {
      return { v, off, d };
    }
  }
  return { v, off, d: -1 };
}

/**
 * 最少编辑步数（前向贪心，一维滚动表）。`cap` 是硬上限：转满 `cap` 步还没到终点就返回 `-1`，
 * 调用方据此走降级档。`n === 0` 或 `m === 0` 时直接给另一侧的长度——那一档不需要搜索。
 * @param {number} n
 * @param {number} m
 * @param {(i: number, j: number) => boolean} eq
 * @param {number} cap
 * @returns {number} 最短步数，或 `-1`（越线）
 */
function minCost(n, m, eq, cap) {
  if (n === 0) return m <= cap ? m : -1;
  if (m === 0) return n <= cap ? n : -1;
  // 表宽夹到 `n + m`：一个盒子的最短步数不可能超过两侧长度之和，而 `greedy` 的表宽是按**上限**开的。
  // 不夹这一档，分治的每一个小节点都要按 `MAX_COST` 开一张 8001 格的表并填 `-1`——
  // 那些格永远到不了，却是这一本真实存在过的开销里最没意义的一笔（实测见段 5 计划 §0.6）。
  const dMax = cap < n + m ? cap : n + m;
  return greedy(n, m, dMax, eq, false, n - m).d;
}

/**
 * 递归吐出 `ops`（线性空间的 Myers：Myers 论文算法 3 的"中间蛇"分治）。
 *
 * 每一层的动作：先裁公共前后缀（所以 `D == 1` 那一档在进 Myers 之前就成了 `n===0 || m===0` 的基例），
 * 再用 `minCost` 拿这一层的最短步数 `D`，取 `h = D >> 1`，前向表转到第 `h` 步、后向表转到第 `D-h` 步，
 * 两条路径必然在某条对角线上接上——那个接点把问题切成两半，两半各自最优（否则拼起来比 `D` 短，
 * 与 `D` 最小矛盾）。**这就是内存只随 `n+m` 走、不随 `D²` 走的原因**：按"每一步存一张 V 表"的
 * 教科书写法回溯，`MAX_COST` 那一档要 `MAX_COST²` 个格子，手机上这一页先把自己吃掉。
 *
 * 接点找不到是不该发生的事：那说明 `minCost` 与两张表的步数划分不自洽，或下标算错。
 * 那一档**不许**悄悄降级糊过去（那会把一个算法 bug 伪装成一次正常的性能退让，页面上读起来完全合理），
 * 所以它抛 `RangeError`，让 §X 与门禁①当场点名。
 * @param {(i: number, j: number) => boolean} eq 相对本层窗口起点 (aBase, bBase) 的下标
 * @param {number} n
 * @param {number} m
 * @param {number} aBase 本层窗口在原序列里的 a 起点（**绝对**下标：写进 `ops` 与取键都用它）
 * @param {number} bBase
 * @param {number} cap
 * @param {object[]} out
 * @param {{ka: string[], kb: string[]}|null} keys 快判用的键序列；`null` = 这一档不做快判
 * @returns {boolean} 这一层连同子层里有没有发生过降级
 */
function walk(eq, n, m, aBase, bBase, cap, out, keys) {
  // 约定：`eq(i, j)` 的下标是**相对本层窗口起点 (aBase, bBase)** 的，所以裁掉前缀之后必须换一本
  // 接下去用（`win` 那一格）。少了这一步，递归层会拿上一层的绝对下标去比，读到的行整体错位——
  // 而那正是"看上去对上了、统计量却在说谎"的形状，X4/X5 的对拍就是冲着它立的。
  let alo = 0;
  let blo = 0;
  while (alo < n && blo < m && eq(alo, blo)) { alo += 1; blo += 1; }
  let ahi = n;
  let bhi = m;
  while (ahi > alo && bhi > blo && eq(ahi - 1, bhi - 1)) { ahi -= 1; bhi -= 1; }
  if (alo > 0) out.push({ op: 'equal', a: aBase, aLen: alo, b: bBase, bLen: alo });
  const ab = aBase + alo;
  const bb = bBase + blo;
  const mn = ahi - alo;
  const mm = bhi - blo;
  const win = (i, j) => eq(alo + i, blo + j);
  let degraded = false;
  if (mn > 0 && mm > 0) {
    // 快判只在两侧都还长的时候有意义（小盒子进 Myers 本就几微秒，而按盒子建一张哈希反倒更贵）
    const bail = keys !== null && mn > 64 && mm > 64
      && mn + mm - 2 * matchCap(keys.ka, ab, ab + mn, keys.kb, bb, bb + mm) > cap;
    const d = bail ? -1 : minCost(mn, mm, win, cap);
    if (d < 0) {
      degraded = true;
      out.push({ op: 'del', a: ab, aLen: mn, b: bb, bLen: 0 });
      out.push({ op: 'ins', a: ab + mn, aLen: 0, b: bb, bLen: mm });
    } else {
      const h = d >> 1;
      const d2 = d - h;
      const f = greedy(mn, mm, h, win);
      const b = greedy(mn, mm, d2, win, true);
      const delta = mn - mm;
      let sx = -1;
      let sy = -1;
      for (let k = -h; k <= h; k += 2) {
        const kb = delta - k;
        if (kb < -d2 || kb > d2) continue;
        const xf = f.v[f.off + k];
        const xb = b.v[b.off + kb];
        if (!(xf >= 0 && xb >= 0 && xf + xb >= mn)) continue;
        const px = xf;
        const py = xf - k;
        // 接点落在盒子的起点或终点时，两条子问题里有一条会跟父问题同尺寸——递归不前进。
        // 最短路径中间必然还有别的对角线能接上（ Myers 论文算法 3 的那一句），所以这一档**换下一条**，
        // 而不是就地接受；真的一条都没有才让下面那句 `RangeError` 点名。
        if ((px === 0 && py === 0) || (px === mn && py === mm)) continue;
        sx = px;
        sy = py;
        break;
      }
      if (sx < 0) {
        throw new RangeError(`diffSeq：D=${d} 的前向 ${h} 步与后向 ${d2} 步没有找到接点（内部不变式破了）`);
      }
      const left = walk(win, sx, sy, ab, bb, cap, out, keys);
      // 右半边另起一本：它的窗口起点是接点 `(ab+sx, bb+sy)`，把 `win` 原样递下去会让这一层
      // 从接点**之前**的行开始判等——`ops` 里 `a` 侧下标还是对的、`b` 侧却整体偏移，
      // 于是页面上的配对是"自洽但错行"的（对拍第一轮抓到的正是这一条：cost 等于最短值，
      // 而 `equal` 那几格把 'a' 配给了 'b'）。
      const rightWin = (i, j) => win(sx + i, sy + j);
      const right = walk(rightWin, mn - sx, mm - sy, ab + sx, bb + sy, cap, out, keys);
      degraded = left || right;
    }
  } else if (mn > 0) {
    out.push({ op: 'del', a: ab, aLen: mn, b: bb, bLen: 0 });
  } else if (mm > 0) {
    out.push({ op: 'ins', a: ab, aLen: 0, b: bb, bLen: mm });
  }
  if (bhi < m) out.push({ op: 'equal', a: aBase + ahi, aLen: n - ahi, b: bBase + bhi, bLen: m - bhi });
  return degraded;
}

/**
 * 把一个极大非等段规范化成"一整块 `del` + 一整块 `ins`"（口径 4）。
 *
 * Myers 的路径可以在一段里左右交替（`del, ins, del`），那样"改 K 处"的 K 就没有唯一定义，
 * `hunksOf` 的 `change` 行与 `unifiedText` 的区间也得各算一遍。这一段把每个非等段压成至多两格，
 * 顺带保证 a 侧下标连续、b 侧下标连续——那正是 X5 那三条不变式的形状。
 * @param {object[]} ops
 * @returns {object[]}
 */
function mergeRuns(ops) {
  const out = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i].op === 'equal') { out.push(ops[i]); i += 1; continue; }
    let startA = Infinity;
    let startB = Infinity;
    let endA = 0;
    let endB = 0;
    let del = 0;
    let ins = 0;
    while (i < ops.length && ops[i].op !== 'equal') {
      const c = ops[i];
      startA = Math.min(startA, c.a);
      startB = Math.min(startB, c.b);
      if (c.op === 'del') { del += c.aLen; endA = c.a + c.aLen; endB = Math.max(endB, c.b); }
      else { ins += c.bLen; endB = c.b + c.bLen; endA = Math.max(endA, c.a); }
      i += 1;
    }
    endA = Math.max(endA, startA);
    endB = Math.max(endB, startB);
    if (del > 0) out.push({ op: 'del', a: startA, aLen: del, b: startB, bLen: 0 });
    if (ins > 0) out.push({ op: 'ins', a: endA, aLen: 0, b: startB, bLen: ins });
  }
  return out;
}

/**
 * 一段盒子"最多能配上多少行"的上界：拿 b 侧区间的键做多重集合，a 侧区间逐行去领额度，
 * 所以是 O(lenA + lenB)。公共行数 ≤ 它，于是这一格的编辑距离**下界** = `lenA + lenB − 2 × 上界`
 * （口径 2 的那道快判）。
 *
 * 它是**按盒子**算的，不是按整份文件算的——早期那一版写在全局，实测立刻打出一个难看的改道：
 * 十万行的文件中间改了 2500 行，全局下界越线，于是整份文件按"删十万行 + 增十万行"给出，
 * 页面上本该看到的是"中间那一块降级、其余照旧逐行对上"。搬进分治的盒子之后两种形状都对了：
 * 两份真不相干的文件在顶层盒子（裁完前后缀就是整份）照样一眼看穿、立刻降级，局部越线只降级局部。
 * @param {string[]} ka a 侧键序列
 * @param {number} aLo 盒子起点（绝对下标）
 * @param {number} aHi 盒子终点（开区间）
 * @param {string[]} kb b 侧键序列
 * @param {number} bLo
 * @param {number} bHi
 * @returns {number}
 */
function matchCap(ka, aLo, aHi, kb, bLo, bHi) {
  const pool = new Map();
  for (let j = bLo; j < bHi; j++) pool.set(kb[j], (pool.get(kb[j]) || 0) + 1);
  let hit = 0;
  for (let i = aLo; i < aHi; i++) {
    const left = pool.get(ka[i]);
    if (left > 0) { pool.set(ka[i], left - 1); hit += 1; }
  }
  return hit;
}

/**
 * 通用序列对齐引擎：行级与 token 级共用这一本。
 *
 * `a`/`b` 传的是**已经键化好的序列**（行级传 `compareKey` 的结果，token 级传 token 的 `key`），
 * `equals` 是这一本唯一允许的判等出口；`keyOf` 只服务于 `matchCap` 那道快判，默认按值本身取。
 * 这样"归一化只进键、原文只出来"这件事（口径 1）在实现上就只剩一条路可走。
 * @param {string[]} a 原序列
 * @param {string[]} b
 * @param {(x: string, y: string) => boolean} equals 必须是等价关系（自反、对称、传递），`matchCap` 靠它
 * @param {number} [maxCost] 编辑距离上限，越线返回降级形状
 * @param {(v: string) => string|null} [keyOf] `matchCap` 用的键取值器；返回 `null` 表示这一档不做快判
 * @returns {{ops: Array<{op: 'equal'|'del'|'ins', a: number, aLen: number, b: number, bLen: number}>, cost: number, degraded: boolean}}
 */
export function diffSeq(a, b, equals, maxCost = MAX_COST, keyOf = (v) => v) {
  const at = 'diffSeq(a, b, equals, maxCost, keyOf)';
  if (!Array.isArray(a)) throw new TypeError(`${at}：a 必须是数组，这里是 ${typeName(a)}`);
  if (!Array.isArray(b)) throw new TypeError(`${at}：b 必须是数组，这里是 ${typeName(b)}`);
  if (typeof equals !== 'function') throw new TypeError(`${at}：equals 必须是函数，这里是 ${typeName(equals)}`);
  if (!Number.isInteger(maxCost) || maxCost < 1) {
    throw new TypeError(`${at}：maxCost 必须是 ≥1 的整数，这里是 ${String(maxCost)}`);
  }
  const n = a.length;
  const m = b.length;
  // 快判用的键序列只在两侧都还长的时候才建（短样本进 Myers 本就几微秒，按盒子建哈希反倒更贵）；
  // 任何一格取不出字符串键就整本放弃快判——**判等永远只走 `equals` 那一本**，这一格不参与其中。
  let keys = null;
  if (n > 64 && m > 64 && typeof keyOf === 'function') {
    const ka = new Array(n);
    const kb = new Array(m);
    let ok = true;
    for (let i = 0; i < n; i++) { const k = keyOf(a[i]); if (k === null || typeof k !== 'string') { ok = false; break; } ka[i] = k; }
    if (ok) {
      for (let j = 0; j < m; j++) { const k = keyOf(b[j]); if (k === null || typeof k !== 'string') { ok = false; break; } kb[j] = k; }
    }
    if (ok) keys = { ka, kb };
  }
  const raw = [];
  let degraded = false;
  if (n === 0 && m === 0) raw.push({ op: 'equal', a: 0, aLen: 0, b: 0, bLen: 0 });
  else degraded = walk((i, j) => equals(a[i], b[j]), n, m, 0, 0, maxCost, raw, keys);
  const ops = mergeRuns(raw);
  let cost = 0;
  for (const o of ops) cost += o.op === 'del' ? o.aLen : o.op === 'ins' ? o.bLen : 0;
  return { ops, cost, degraded };
}

// ── 段（segment）：ops 与页面行之间的唯一换算 ────────────────────────────────

/**
 * 把 `ops` 折成"显示段"清单：`equal` 段与 `run` 段交替，`run` 段带成对数与余下的删/增数。
 *
 * 这一格是口径 4 的实现点：**"改 K 处"、`hunksOf` 的 `change` 行、`unifiedText` 的内容行、
 * 以及折叠条的计数四件事必须来自同一次配对**。配对规则只有一句——一段里 `pairs = min(删, 增)`，
 * 先按序配对成 `change`，剩下的才单独成 `del` 或 `ins` 行。
 * @param {object[]} ops `diffSeq` 那种（已经 `mergeRuns` 过）
 * @returns {Array<{kind: 'equal', a: number, b: number, len: number}|{kind: 'run', a: number, b: number, del: number, ins: number, pairs: number}>}
 */
function segmentsOf(ops) {
  const segs = [];
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    if (o.op === 'equal') { segs.push({ kind: 'equal', a: o.a, b: o.b, len: o.aLen }); continue; }
    const del = o.op === 'del' ? o.aLen : 0;
    const next = ops[i + 1];
    const ins = o.op === 'del' && next && next.op === 'ins' ? next.bLen : 0;
    const bStart = o.op === 'del' ? (next && next.op === 'ins' ? next.b : o.b) : o.b;
    const aStart = o.a;
    if (o.op === 'ins') {
      segs.push({ kind: 'run', a: aStart, b: bStart, del: 0, ins: o.bLen, pairs: 0 });
    } else {
      segs.push({ kind: 'run', a: aStart, b: bStart, del, ins, pairs: Math.min(del, ins) });
      if (ins > 0) i += 1;
    }
  }
  return segs;
}

/**
 * 一条显示行的形状（`hunksOf` 产出的就是它，视图层只认这些字段）。
 * `a`/`b` 是**从 0 起**的行号（视图层加 1 再画），另一侧没有对应行时为 `null`。
 * @param {string} kind
 * @param {number|null} a
 * @param {number|null} b
 * @param {object} side a 侧 `splitLines` 结果
 * @param {object} bside b 侧 `splitLines` 结果
 * @param {Array<{t: string, text: string}>|null} [inline]
 * @returns {object}
 */
function rowOf(kind, a, b, side, bside, inline = null) {
  return {
    kind,
    a,
    b,
    textA: a === null ? '' : side.lines[a],
    textB: b === null ? '' : bside.lines[b],
    inline,
    crlfA: a === null ? false : !!side.crlf[a],
    crlfB: b === null ? false : !!bside.crlf[b],
  };
}

/**
 * 把一个 `run` 段摊成显示行（`hunksOf` 与统计都调它，配对规则因此只有一份）。
 * @param {object} seg `segmentsOf` 里的 run 段
 * @param {object} side
 * @param {object} bside
 * @param {(ai: number, bi: number) => Array<{t: string, text: string}>|null} inlineOf
 * @returns {object[]}
 */
function rowsOfRun(seg, side, bside, inlineOf) {
  const out = [];
  for (let p = 0; p < seg.pairs; p++) {
    out.push(rowOf('change', seg.a + p, seg.b + p, side, bside, inlineOf(seg.a + p, seg.b + p)));
  }
  for (let p = seg.pairs; p < seg.del; p++) out.push(rowOf('del', seg.a + p, null, side, bside));
  for (let p = seg.pairs; p < seg.ins; p++) out.push(rowOf('ins', null, seg.b + p, side, bside));
  return out;
}

// ── 主入口 ───────────────────────────────────────────────────────────────────

/**
 * 输入闸门：按侧各判一次（不合起来判——那会让"一侧塞满、一侧空着"整页不可用，spec §5.6 第 1 条）。
 * `which` 说清是 a / b / both，`over` 给的是**超出的差额**（没超的那一格是 0），
 * 页面上那句"超出 N 字节"直接从它出，不另数一遍。
 *
 * 两档先后是定死的：先字节、后行数。同一侧两档都超时报字节——那一档量纲更大，也更需要用户动手删。
 * @param {string} textA
 * @param {string} textB
 * @returns {{ok: boolean, which: ('a'|'b'|'both'|null), reason: ('bytes'|'lines'|null),
 *   over: {bytesA: number, bytesB: number, linesA: number, linesB: number}, a: object, b: object}}
 */
export function gate(textA, textB) {
  const at = 'gate(textA, textB)';
  if (typeof textA !== 'string') throw new TypeError(`${at}：textA 必须是字符串，这里是 ${typeName(textA)}`);
  if (typeof textB !== 'string') throw new TypeError(`${at}：textB 必须是字符串，这里是 ${typeName(textB)}`);
  const a = splitLines(textA);
  const b = splitLines(textB);
  const over = {
    bytesA: Math.max(0, a.bytes - MAX_INPUT_BYTES),
    bytesB: Math.max(0, b.bytes - MAX_INPUT_BYTES),
    linesA: Math.max(0, a.count - MAX_INPUT_LINES),
    linesB: Math.max(0, b.count - MAX_INPUT_LINES),
  };
  const bytesBad = over.bytesA > 0 || over.bytesB > 0;
  const linesBad = over.linesA > 0 || over.linesB > 0;
  if (!bytesBad && !linesBad) return { ok: true, which: null, reason: null, over, a, b };
  const reason = bytesBad ? 'bytes' : 'lines';
  const hitA = reason === 'bytes' ? over.bytesA > 0 : over.linesA > 0;
  const hitB = reason === 'bytes' ? over.bytesB > 0 : over.linesB > 0;
  const which = hitA && hitB ? 'both' : hitA ? 'a' : 'b';
  return { ok: false, which, reason, over, a, b };
}

/** 闸门不过时那一档的统计形状：七个数全 0，而不是"没有这一格"（视图层可以直接摊进读数行） */
function emptyStats() {
  return { added: 0, removed: 0, changed: 0, unchanged: 0, blocks: 0, inlineSkipped: 0, ignored: 0 };
}

/**
 * 这一页的主入口：拆行 → 闸门 → 对齐 → 配对 → 行内细化 → 统计。
 *
 * 统计量的逐格定义（X18）：`added` = 只在 b 侧出现的行数（所有 `ins` 段与 run 段余下的增），
 * `removed` = 只在 a 侧出现的行，`changed` = 成对配上的 `change` 行数，`unchanged` = 完全对上的行数，
 * `blocks` = 极大非等段个数（一段里既删又增只算**一块**）。自洽关系：`added ≥ changed`、
 * `removed ≥ changed`、`blocks ≤ 非等段总数`，且 `unchanged + removed === a.count`、
 * `unchanged + added === b.count`。
 * @param {string} textA 左侧全文
 * @param {string} textB 右侧全文
 * @param {{ws?: boolean, case?: boolean}} [opts] 归一化开关（只影响判等，见口径 1）
 * @returns {object} `{a, b, ops, segments, stats, cost, degraded, opts, verdict, blocked}`
 */
export function diffLines(textA, textB, opts) {
  const at = 'diffLines(textA, textB, opts)';
  const o = normOpts(opts, at);
  const g = gate(needText(textA, `${at}：textA`), needText(textB, `${at}：textB`));
  if (!g.ok) {
    return {
      a: g.a, b: g.b, ops: [], segments: [], stats: emptyStats(), cost: 0, degraded: false,
      opts: o, verdict: 'blocked', blocked: { which: g.which, reason: g.reason, over: g.over },
      // 空表也要给：视图层拿 `inlineByKey` 是无条件的，"闸门那一档少一个键"会让它在最不该出错的
      // 那一条路径上 `undefined.size`（与 `emptyStats()` 同一个道理——形状相同、值全空）。
      inlineByKey: new Map(),
    };
  }
  const a = g.a;
  const b = g.b;
  const keyOf = (line, crlf) => compareKey(line, { ws: o.ws, case: o.case, crlf });
  const al = a.lines.map((l, i) => keyOf(l, a.crlf[i]));
  const bl = b.lines.map((l, i) => keyOf(l, b.crlf[i]));
  const r = diffSeq(al, bl, (x, y) => x === y, MAX_COST, (v) => v);
  const segments = segmentsOf(r.ops);

  /** 行内细化：同一对行的 token 结果只算一次，`hunksOf` 之后从这张表里拿 */
  const inlineByKey = new Map();
  // `inlineDiff` 那一层的 opts **不认 `crlf`**（行内拿的是行内容，行尾形状在行级已经判过等了），
  // 所以不能把上面那份规范化结果原样递下去——`normOpts` 对未知键一律判红，这正是它该有的样子。
  const inlineOpts = { ws: o.ws, case: o.case };
  let inlineSkipped = 0;
  let inlineWork = 0;
  let changed = 0;
  for (const seg of segments) {
    if (seg.kind !== 'run') continue;
    changed += seg.pairs;
    for (let p = 0; p < seg.pairs; p++) {
      const ai = seg.a + p;
      const bi = seg.b + p;
      const la = a.lines[ai];
      const lb = b.lines[bi];
      // 三道闸门各管一件事，顺序是"越便宜的越靠前"：
      // ① 切分那一刀先拦一道，记的是 `min(字符数, MAX_INLINE_TOKENS)`：`tokenize` 带 limit，
      //    一侧最多切到四千零一枚就收手，中文那种"一行一个码点一枚"的形状下这两个数几乎相等。
      //    它记的不是**总账**——所有改动行的字符数之和本来就被字节闸门按两侧各 5 MiB 框死了，
      //    长空白串那种"一枚 token 吃掉一百万字符"的偏松在这里也翻不了船（最坏就是那一本 10 MB 的扫描）。
      //    真正没被字节闸门框住的是 ③（`Σ D²` 可以随行对数一直涨），所以这一格只是顺手把切分的钱也记上，
      //    让"十万行逐行改"那种输入不至于把预算全花在切分上、一对都对不完。
      // ② 单对形状闸门 `MAX_INLINE_TOKENS`（X17）。
      // ③ 对齐那一份按 `inlineWorkOf` 记账，装不下就跳过这一对、继续看下一对（不是"后面全掐"）。
      //    公共前后缀因此要裁两遍（一遍记账、一遍真对齐）——O(token 数) 的重复，比把偏移算错的代价小得多。
      // 三处都按文档顺序判，同一份输入两次逐格相同（X28）；② ③ 拦下的那一对，① 的账也已经付过了，
      // 照记——它确实花了钱，只是没花出结果。
      const scan = Math.min(la.length, MAX_INLINE_TOKENS) + Math.min(lb.length, MAX_INLINE_TOKENS);
      if (inlineWork + scan > MAX_INLINE_WORK) { inlineSkipped += 1; continue; }
      inlineWork += scan;
      const t = tokensForPair(la, lb, inlineOpts);
      if (t === null) { inlineSkipped += 1; continue; }
      const work = inlineWorkOf(t.a, t.b);
      if (inlineWork + work > MAX_INLINE_WORK) { inlineSkipped += 1; continue; }
      inlineWork += work;
      inlineByKey.set(`${ai}:${bi}`, inlineFromTokens(t.a, t.b));
    }
  }
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  let ignored = 0;
  let blocks = 0;
  for (const seg of segments) {
    if (seg.kind === 'equal') {
      unchanged += seg.len;
      for (let i = 0; i < seg.len; i++) {
        const ai = seg.a + i;
        const bi = seg.b + i;
        if (a.lines[ai] !== b.lines[bi] || a.crlf[ai] !== b.crlf[bi]) ignored += 1;
      }
      continue;
    }
    blocks += 1;
    added += seg.ins;
    removed += seg.del;
  }
  const stats = { added, removed, changed, unchanged, blocks, inlineSkipped, ignored };
  return {
    a, b, ops: r.ops, segments, stats, cost: r.cost, degraded: r.degraded, opts: o,
    verdict: added === 0 && removed === 0 ? 'same' : 'diff',
    blocked: null,
    inlineByKey,
  };
}

/** `gate` 之上的入参形状关：非字符串一律 `TypeError` 点名（X26） */
function needText(v, name) {
  if (typeof v !== 'string') throw new TypeError(`${name} 必须是字符串，这里是 ${typeName(v)}`);
  return v;
}

/**
 * 切好一对行的 token，并把**形状闸门**（`MAX_INLINE_TOKENS`）判掉：过线返回 `null`。
 *
 * 单侧切完就立刻判一次，是为了不为一行 5 MiB 的样本建一张百万项的表——一侧越线，两侧之和必然越线。
 * @param {string} lineA
 * @param {string} lineB
 * @param {{ws?: boolean, case?: boolean}} o 已经过 `normOpts` 的那一份
 * @returns {{a: {text: string, key: string}[], b: {text: string, key: string}[]}|null}
 */
function tokensForPair(lineA, lineB, o) {
  const a = tokenize(lineA, o, MAX_INLINE_TOKENS);
  if (a === null) return null;
  const b = tokenize(lineB, o, MAX_INLINE_TOKENS);
  if (b === null) return null;
  if (a.length + b.length > MAX_INLINE_TOKENS) return null;
  return { a, b };
}

/**
 * 一对行做行内细化，**对齐那一份**要花多少格子（字符那一份由调用方按 `lineA.length + lineB.length`
 * 加进同一本账）。口径是 `4 × min(两侧裁掉公共前后缀之后余下的 token 数之和, MAX_COST)²`：
 * 前后缀一裁，余下的就是真在变的区段，而 Myers 的格子数按 `4D²` 量级走（`MAX_COST` 那一段推导）、
 * `D` 不会超过余下的 token 数；`D` 一旦越线走的是 O(n) 的降级快判，所以夹在 `MAX_COST` 才是对的账。
 * 交错改动会把这个数估大约四倍，宁可高估——预算不是账单。
 * @param {{text: string, key: string}[]} ta
 * @param {{text: string, key: string}[]} tb
 * @returns {number}
 */
function inlineWorkOf(ta, tb) {
  let lo = 0;
  const n = ta.length;
  const m = tb.length;
  while (lo < n && lo < m && ta[lo].key === tb[lo].key) lo += 1;
  let hi = 0;
  while (hi < n - lo && hi < m - lo && ta[n - 1 - hi].key === tb[m - 1 - hi].key) hi += 1;
  let rest = n - lo - hi + (m - lo - hi);
  if (rest > MAX_COST) rest = MAX_COST;
  return 4 * rest * rest;
}

/**
 * 拿到**已经切好**的两侧 token，对齐并折成着色片段。
 *
 * 拆出来只为了一件事：`diffLines` 要先知道"这一对花多少格"才能决定要不要花，而 token 数得切完才知道。
 * 两处各写一遍对齐，就回到 X4 第一轮抓到的那种"两遍里有一遍是错的"。闸门都在调用方：
 * 形状那道在 `tokensForPair`，预算那道在 `diffLines`——这一本里不做任何判定。
 * @param {{text: string, key: string}[]} ta
 * @param {{text: string, key: string}[]} tb
 * @returns {Array<{t: 'equal'|'del'|'ins', text: string}>}
 */
function inlineFromTokens(ta, tb) {
  const r = diffSeq(ta.map((x) => x.key), tb.map((x) => x.key), (x, y) => x === y, MAX_COST, (v) => v);
  const out = [];
  const push = (t, text) => {
    if (text === '') return;
    const last = out[out.length - 1];
    if (last && last.t === t) last.text += text;
    else out.push({ t, text });
  };
  for (const op of r.ops) {
    if (op.op === 'equal') for (let i = 0; i < op.aLen; i++) push('equal', ta[op.a + i].text);
    else if (op.op === 'del') for (let i = 0; i < op.aLen; i++) push('del', ta[op.a + i].text);
    else for (let i = 0; i < op.bLen; i++) push('ins', tb[op.b + i].text);
  }
  return out;
}

/**
 * 行内细化：对一对行做 token 级对齐，产出给两栏各自着色的片段序列。
 *
 * 越线（两侧 token 数之和 > `MAX_INLINE_TOKENS`）时返回 `null`——那一对的整行着色由视图层兜，
 * `stats.inlineSkipped` 由 `diffLines` 计数（X17）。返回的片段合并过相邻同类，所以
 * `[equal, del, equal, del]` 在页面上是四段，而不是一个 token 一个 `<span>`。
 *
 * 这一本只管**单对**的形状闸门；整页的总量预算（`MAX_INLINE_WORK`）在 `diffLines` 那一层，
 * 因为"已经花掉多少"是跨行对的状态，塞进这里就成了隐式的全局可变量。
 * @param {string} lineA
 * @param {string} lineB
 * @param {{ws?: boolean, case?: boolean}} [opts]
 * @returns {Array<{t: 'equal'|'del'|'ins', text: string}>|null}
 */
export function inlineDiff(lineA, lineB, opts) {
  const at = 'inlineDiff(lineA, lineB, opts)';
  if (typeof lineA !== 'string') throw new TypeError(`${at}：lineA 必须是字符串，这里是 ${typeName(lineA)}`);
  if (typeof lineB !== 'string') throw new TypeError(`${at}：lineB 必须是字符串，这里是 ${typeName(lineB)}`);
  const t = tokensForPair(lineA, lineB, normOpts(opts, at));
  if (t === null) return null;
  return inlineFromTokens(t.a, t.b);
}

// ── 折叠 ─────────────────────────────────────────────────────────────────────

/**
 * 折叠成显示用的块。`context` 是**每个块首尾各保留多少行相同上下文**，`Infinity` 就是全展开。
 *
 * 三格的形状（X20、X22 钉的就是这几条）：
 * - `aFrom/aTo` 与 `bFrom/bTo` 是**左闭右开**的下标区间，包含本块显示出来的上下文行；
 *   一块里全是另一侧的行时（纯插入），这一侧的区间是空区间（`aFrom === aTo`，落点在插入发生处）。
 * - `skipped` 数的是"上一块之后、这一块之前被折掉多少行"，第一块恒为 0。
 * - 末块之后的尾巴记在最后一块的 `tailSkipped` 上（视图层据此决定要不要再画一条尾折叠条），
 *   它不是第二块的 `skipped`——那一格会让"两块"凭空多出来。
 *
 * 相邻两个差异段之间的相同行 ≤ `2 × context` 时**合成一块**（中间的行全展示，`skipped` 为 0）：
 * 否则页面上会出现两条折叠条之间夹三行相同内容那种没人看得懂的形状。
 * @param {object} result `diffLines` 的返回值
 * @param {number} [context]
 * @returns {{aFrom: number, aTo: number, bFrom: number, bTo: number, skipped: number, tailSkipped: number, rows: object[]}[]}
 */
export function hunksOf(result, context = DEFAULT_CONTEXT) {
  const at = 'hunksOf(result, context)';
  if (!result || typeof result !== 'object' || !Array.isArray(result.ops)) {
    throw new TypeError(`${at}：result 必须是 diffLines 的返回值，这里是 ${typeName(result)}`);
  }
  if (typeof context !== 'number' || Number.isNaN(context)) {
    throw new TypeError(`${at}：context 必须是数字（想全展开请传 Infinity），这里是 ${String(context)}`);
  }
  if (context !== Infinity && (!Number.isInteger(context) || context < 0)) {
    throw new TypeError(`${at}：context 必须是 ≥0 的整数或 Infinity，这里是 ${String(context)}`);
  }
  if (result.verdict === 'blocked') return [];
  const a = result.a;
  const b = result.b;
  const segments = Array.isArray(result.segments) && result.segments.length > 0
    ? result.segments : segmentsOf(result.ops);
  const inlineOf = (ai, bi) => {
    const m = result.inlineByKey;
    if (m && m.has(`${ai}:${bi}`)) return m.get(`${ai}:${bi}`);
    return null;
  };
  // 1) 段先摊成"显示行游程"，每段记住它在虚拟行流里的起止
  const streams = [];
  let cursor = 0;
  for (const seg of segments) {
    if (seg.kind === 'equal') {
      if (seg.len > 0) { streams.push({ seg, from: cursor, to: cursor + seg.len }); cursor += seg.len; }
    } else {
      const n = Math.max(seg.pairs, 0) + Math.max(seg.del - seg.pairs, 0) + Math.max(seg.ins - seg.pairs, 0);
      if (n > 0) { streams.push({ seg, from: cursor, to: cursor + n }); cursor += n; }
    }
  }
  const total = cursor;
  if (total === 0) return [];
  // 2) 按 context 把相邻 run 段并块，并算出每块在虚拟行流里的起止
  const runs = streams.filter((s) => s.seg.kind === 'run');
  if (runs.length === 0) return [];
  const groups = [];
  for (const s of runs) {
    const lo = context === Infinity ? 0 : s.from - context;
    const hi = context === Infinity ? total : s.to + context;
    const last = groups[groups.length - 1];
    if (last && lo <= last.hi) { last.lo = Math.min(last.lo, lo); last.hi = Math.max(last.hi, hi); last.items.push(s); }
    else groups.push({ lo, hi, items: [s] });
  }
  for (const g of groups) {
    g.lo = Math.max(0, g.lo);
    g.hi = Math.min(total, g.hi);
  }
  // 3) 每块按虚拟行流取回落在其中的段，裁头尾后摊成行
  const out = [];
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const prevHi = gi === 0 ? 0 : groups[gi - 1].hi;
    const rows = [];
    for (const s of streams) {
      if (s.to <= g.lo || s.from >= g.hi) continue;
      const cutFrom = Math.max(s.from, g.lo);
      const cutTo = Math.min(s.to, g.hi);
      const offFrom = cutFrom - s.from;
      const offTo = cutTo - s.from;
      if (s.seg.kind === 'equal') {
        for (let k = offFrom; k < offTo; k++) rows.push(rowOf('equal', s.seg.a + k, s.seg.b + k, a, b));
      } else {
        const all = rowsOfRun(s.seg, a, b, inlineOf);
        for (let k = offFrom; k < offTo; k++) rows.push(all[k]);
      }
    }
    let aFrom = Infinity;
    let aTo = -Infinity;
    let bFrom = Infinity;
    let bTo = -Infinity;
    for (const r of rows) {
      if (r.a !== null) { aFrom = Math.min(aFrom, r.a); aTo = Math.max(aTo, r.a + 1); }
      if (r.b !== null) { bFrom = Math.min(bFrom, r.b); bTo = Math.max(bTo, r.b + 1); }
    }
    if (aFrom > aTo) { const p = anchorOf(streams, g.lo, 'a', a); aFrom = p; aTo = p; }
    if (bFrom > bTo) { const p = anchorOf(streams, g.lo, 'b', b); bFrom = p; bTo = p; }
    out.push({ aFrom, aTo, bFrom, bTo, skipped: g.lo - prevHi, tailSkipped: 0, rows });
  }
  out[out.length - 1].tailSkipped = total - groups[groups.length - 1].hi;
  return out;
}

/**
 * 一块里只有另一侧的行时，本侧的区间取"这里发生了什么"的落点（空区间 `[p, p)`）。
 * 拿虚拟流上第一个 ≥ `lo` 的段来定落点：那是用户看到这一块的第一个上下文位置，
 * 比"文件末尾"这种凭空造出来的数字可读。
 * @param {object[]} streams
 * @param {number} lo
 * @param {'a'|'b'} side
 * @param {object} s 那一侧的 `splitLines` 结果
 * @returns {number}
 */
function anchorOf(streams, lo, side, s) {
  for (const st of streams) {
    if (st.to <= lo) continue;
    const k = Math.max(0, lo - st.from);
    const idx = side === 'a' ? st.seg.a + k : st.seg.b + k;
    return Math.min(idx, s.count);
  }
  return s.count;
}

// ── unified 形状 ─────────────────────────────────────────────────────────────

/**
 * unified 形状的差异文本：复制与下载走同一串，页面上那一栏也是它。
 *
 * `@@ -a,b +c,d @@` 的**单行区间不省略 `,1`**（§0.6 第二行登记的那条偏差：省略是 git 的排版偏好，
 * 不是格式的必要部分，而本站的自证判据要逐字符对照）。行尾的 `\r` 原样写出（X25）；末行缺换行符
 * 补 `\ No newline at end of file`——那一行是 git 的形状，也是这一页唯一说得清"这里少一个换行"的写法。
 * 上下文行（`kind:'equal'`）的行尾形状取 a 侧：两侧到这里已经判等，那一格差别只在勾了归一化时才可能存在。
 * @param {object} result `diffLines` 的返回值
 * @param {{a?: string, b?: string, context?: number}} [names] 两名与上下文档
 * @returns {string} 闸门不过时给空串（那一档页面上没有可复制的结果）
 */
export function unifiedText(result, names = {}) {
  const at = 'unifiedText(result, names)';
  if (!result || typeof result !== 'object' || !Array.isArray(result.ops)) {
    throw new TypeError(`${at}：result 必须是 diffLines 的返回值，这里是 ${typeName(result)}`);
  }
  if (names === null || typeof names !== 'object' || Array.isArray(names)) {
    throw new TypeError(`${at}：names 必须是对象，这里是 ${typeName(names)}`);
  }
  if (result.verdict === 'blocked') return '';
  const nameA = typeof names.a === 'string' && names.a !== '' ? names.a : 'A';
  const nameB = typeof names.b === 'string' && names.b !== '' ? names.b : 'B';
  const context = names.context === undefined ? DEFAULT_CONTEXT : names.context;
  const hunks = hunksOf(result, context);
  const out = [`--- ${nameA}\n`, `+++ ${nameB}\n`];
  const a = result.a;
  const b = result.b;
  for (const h of hunks) {
    out.push(`@@ -${h.aFrom + 1},${h.aTo - h.aFrom} +${h.bFrom + 1},${h.bTo - h.bFrom} @@\n`);
    for (const r of h.rows) {
      const emits = r.kind === 'change'
        ? [['-', r.textA, r.a, r.crlfA], ['+', r.textB, r.b, r.crlfB]]
        : r.kind === 'del' ? [['-', r.textA, r.a, r.crlfA]]
          : r.kind === 'ins' ? [['+', r.textB, r.b, r.crlfB]]
            : [[' ', r.textA, r.a, r.crlfA]];
      let marker = false;
      for (const [mark, text, idx, crlf] of emits) {
        out.push(`${mark}${text}${crlf ? '\r' : ''}\n`);
        const lastA = mark !== '+' && idx === a.count - 1 && !a.finalNewline;
        const lastB = mark !== '-' && idx === b.count - 1 && !b.finalNewline;
        if (lastA || lastB) marker = true;
      }
      if (marker) out.push('\\ No newline at end of file\n');
    }
  }
  return out.join('');
}

// ── 面板上那六句人话 ─────────────────────────────────────────────────────────

/**
 * 六句说明，每句对应一个**用户看得见却容易被当成坏了**的形状。文案写在这一本里而不是视图层，
 * 是为了让 §X 能直接判"这一句非空、且说的是那一档"，§Z 再判"它原样出现在渲染结果里"。
 * 数字一律从常量插，不在文案里手抄第二遍（`MAX_COST` 改了而句子没改，是这一族最难发现的一类漂移）。
 */
export const DIFF_NOTES = {
  degraded: `两份内容有相当一段对不上（编辑距离超过 ${MAX_COST} 的上限）：那一段按"整块删除 + 整块新增"给出，行数一行不会少，只是不再替你把最相似的行两两配对。`,
  inlineSkipped: `部分改动行只按整行着色、不做行内逐字高亮（单对行超过 ${MAX_INLINE_TOKENS} 个 token，或行内细化那份 ${MAX_INLINE_WORK} 格的预算已按顺序分完）：行数与差异本身不受影响。`,
  ignored: '勾了忽略空白或忽略大小写之后，"相同"是被归一化过的结论：这些行的原文仍然有差别，只是没有计入差异统计。',
  gitApply: '这一段是按阅读习惯排的 unified 形状文本，不承诺能被 git apply 接住——本站不校验上下文行与文件头，也不生成可打的补丁。',
  noUpload: '文件在浏览器本地读取，输入不出本机：没有上传，也没有任何网络请求。',
  finalNewline: `某一侧的末行没有换行符，这里按"缺一个换行"单独报出来（行尾的回车符显示为 ${CR_GLYPH}）。`,
};
