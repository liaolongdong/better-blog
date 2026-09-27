/**
 * 正则测试与替换预览：编码工具箱页「正则」格子的纯逻辑，也是全站唯一"用户粘什么就得接住什么"的一格。
 *
 * 这一格最坏的一条路是**粘进来一个回溯炸开的正则，面板卡在 exec 里再也回不来**。JS 没有可打断的
 * 回溯步数计数器，V8 也不给单次 exec 中止钩子，所以"防炸页"只能全部做在执行**之前**，落成四档闸门：
 *   ① 模式长度（`MAX_PATTERN_CHARS`）与语法：语法一律交给 native 报原话，分词器不越权重发明错误；
 *   ② 静态可疑形状 `riskScan`：F1 嵌套无界量词、F2 分支互为重复、F3 相邻同源无界、F4 同 F1/F2 但外层有限。
 *      判成 high 的一次都不执行，判成 medium 的只对不超过 `MEDIUM_MAX_INPUT_CHARS` 字符的输入求解（超过就拒、不截断）；
 *   ③ 输入字节（`MAX_INPUT_BYTES`，与 `codec.js` / `digest.js` 同一把 UTF-8 尺子，超了整体拒、不截断）；
 *   ④ 匹配次数（`MAX_MATCHES`）与档间时间预算（`TIME_BUDGET_MS`，靠**注入的时钟**，本模块绝不自己读表）。
 * 四档的牙都在 §N 里逐条钉着，写成"注释里有、代码里没有"会被抓到。
 *
 * 与 `idcard.js` / `uscc.js` / `codec.js` / `digest.js` 同一套约定：纯函数、不碰 DOM、同级工具模块互不
 * import（所以 `toText` / `shapeOf` / `byteLen` 是本站的第若干份拷贝，代价由 §N 与 §L 各自核一遍口径），
 * 并且**两档入参两种处理**：文本入参（`pattern` / `flags` / `text` / `replacement`）归一成串、一律不抛，
 * 唯一例外还是无原型对象与 Symbol（`String()` 自己抛）；控制入参（`options`）走 `TypeError` 闸门，
 * 键名拼错必须响——静默当默认等于用户的 `maxMatches` 白写了。
 *
 * 结果口径以**引擎自己**为准：`matches` 的 `index` / `text` / 组序 / `named` 全部取自 native `exec`
 * 的一次性结果，多匹配的序列与 `matchAll` 逐格对拍（N6），替换预览直接交给 native `replace`（N15）。
 * `$0` 不是替换记号、`$$` 出一个字面 `$`、`$`` ` 是前导切片，这些都是 native 口径，不"顺手修正"。
 *
 * 可复算口径：§N 头部那批毫秒数是本机 Node 22.19 / V8 实测（同一进程、"必然失败"的输入形状），
 * `(a+)+$` 22 字符 839ms、28 字符 >2s；`(x|xx)+$` 32 字符 203ms、40 字符 6.4s；
 * `(\d{1,3}|\d)+$` 16 字符 823ms、20 字符 4.3s；而 `(x+a+)+$` 20 字符 0.0ms——
 * 分词器的 F1 规则（单个可变长度元素 / 含可空元素且无定宽元素）就是照这批数据切的。
 */

/** 面板口径说明，原样显示（与 `BASE64_CAVEAT` / `TIME_CAVEAT` / `DIGEST_CAVEAT` 同一角色，逐条对账由 N18 守着） */
export const REGEX_CAVEAT =
  '正则语义以引擎为准，flags 白名单 g i m s u y d，重复位归一后回显。模式超过 500 字符、输入超过 1 MiB（1048576 字节）'
  + '都整体拒绝、不截断；命中最多列前 1000 个，超出会明说还有没列出的、不静默截断。'
  + '嵌套无界量词这类疑似灾难性回溯的形状一次都不执行并点名构造，中等可疑的形状只对不超过 128 字符的输入求解。';

/** flags 白名单就这七位：`v` / `U` 一类会改语义的档位不收，加了要有新判据 */
export const ALLOWED_FLAGS = 'gimsuyd';
/** 模式长度上限：字符数，不是字节数 */
export const MAX_PATTERN_CHARS = 500;
/** 输入字节闸门：与 codec / digest 同档，超过才拒，正好 1 MiB 放行 */
export const MAX_INPUT_BYTES = 1048576;
/** 匹配次数硬上限：options 只能往下调，不许越过这一档 */
export const MAX_MATCHES = 1000;
/** 中等可疑形状允许求解的最大输入字符数（数的是字符，不是字节） */
export const MEDIUM_MAX_INPUT_CHARS = 128;
/** 档间时间预算：只在调用方注入时钟时才会被检查，默认 50 毫秒 */
export const TIME_BUDGET_MS = 50;

/** options 认得的键，别的都要响 */
const OPTION_KEYS = ['now', 'maxMatches', 'timeBudgetMs'];
/** 无界最大重复的量词档，静态检测里"会不会放大"就看这一档 */
const UNBOUNDED = Infinity;

/** 文本入参归一：与兄弟模块那句同档，无原型对象与 Symbol 由 `String()` 自己抛 */
const toText = (v) => String(v === null || v === undefined ? '' : v);
const isDigit = (ch) => ch >= '0' && ch <= '9';

/** 报错里的形状回显：与 `codec.js` / `digest.js` 各自的实现同一份口径 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (typeof v === 'object') return v instanceof Date ? 'Date' : 'object';
  return typeof v;
}

/**
 * UTF-8 字节数：闸门与面板计数共用这把尺子。落单代理项按 3 字节计——它反正会在 native 里当普通字符用，
 * 本模块不替用户修字节序，所以这一档只影响"多大"，不影响"对不对"。
 */
export function byteLen(value) {
  const src = toText(value);
  let n = 0;
  for (let i = 0; i < src.length; i += 1) {
    const code = src.charCodeAt(i);
    if (code < 0x80) n += 1;
    else if (code < 0x800) n += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < src.length ? src.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) { n += 4; i += 1; } else n += 3;
    } else n += 3;
  }
  return n;
}

/** 只收"字面量对象"：Date / Array / Map 这类带原型的对象当 options 用一定是用户写错了 */
function isPlainObject(v) {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** options 闸门：只认三个键，值各有一档类型，拼错与给错都要响；没给的键一律落到默认档而不是 undefined */
function readOptions(options, who) {
  if (options !== null && options !== undefined && !isPlainObject(options)) {
    throw new TypeError(`${who} 的 options 只收对象，收到 ${shapeOf(options)}`);
  }
  const picked = { now: null, maxMatches: null, timeBudgetMs: null };
  if (options === null || options === undefined) return picked;
  const unknown = Object.keys(options).filter((k) => !OPTION_KEYS.includes(k));
  if (unknown.length > 0) throw new TypeError(`${who} 的 options 里有不认识的键：${unknown.join('、')}`);
  const { now, maxMatches, timeBudgetMs } = options;
  if (now !== null && now !== undefined && typeof now !== 'function') {
    throw new TypeError(`${who} 的 now 要的是函数，收到 ${shapeOf(now)}`);
  }
  if (maxMatches !== null && maxMatches !== undefined && typeof maxMatches !== 'number') {
    throw new TypeError(`${who} 的 maxMatches 要的是数字，收到 ${shapeOf(maxMatches)}`);
  }
  if (timeBudgetMs !== null && timeBudgetMs !== undefined && typeof timeBudgetMs !== 'number') {
    throw new TypeError(`${who} 的 timeBudgetMs 要的是数字，收到 ${shapeOf(timeBudgetMs)}`);
  }
  picked.now = typeof now === 'function' ? now : null;
  picked.maxMatches = typeof maxMatches === 'number' && Number.isFinite(maxMatches) ? maxMatches : null;
  picked.timeBudgetMs = typeof timeBudgetMs === 'number' && Number.isFinite(timeBudgetMs) ? timeBudgetMs : null;
  return picked;
}

/** 有效上限：只能往下调，0 与负数按 1 兜，不给"一个都不算"的静默档 */
function effectiveCap(maxMatches) {
  if (maxMatches === null || maxMatches === undefined) return MAX_MATCHES;
  return Math.min(MAX_MATCHES, Math.max(1, Math.trunc(maxMatches)));
}

/** flags 归一：保留首次出现顺序、重复位回显、白名单外的位点名 */
export function normalizeFlags(value) {
  const raw = toText(value);
  let flags = '';
  const unknown = [];
  let deduplicated = false;
  for (const ch of raw) {
    if (!ALLOWED_FLAGS.includes(ch)) {
      if (!unknown.includes(ch)) unknown.push(ch);
      continue;
    }
    if (flags.includes(ch)) { deduplicated = true; continue; }
    flags += ch;
  }
  if (unknown.length > 0) {
    return {
      ok: false, flags: '', deduplicated,
      reason: `flag「${unknown.join('、')}」不在白名单 ${[...ALLOWED_FLAGS].join(' ')} 之内，这一格只收这七位`,
    };
  }
  return {
    ok: true, flags, deduplicated,
    reason: deduplicated ? `flags 里有重复位，已归一为「${flags}」` : null,
  };
}

/**
 * 编译：先长度、再 flags、最后才交给 native。
 * `kind` 分三档（`length` / `flags` / `pattern`），面板按档决定红条写在哪一格；
 * 失败时 `regex` 一律是 null，绝不把半残对象交出去。
 */
export function compile(pattern, flags, options) {
  readOptions(options, 'compile');
  const src = toText(pattern);
  if (src.length > MAX_PATTERN_CHARS) {
    return {
      ok: false, regex: null, flags: '', kind: 'length', deduplicated: false,
      reason: `模式 ${src.length} 字符，超过 ${MAX_PATTERN_CHARS} 字符上限，整体拒绝、不截断`,
    };
  }
  const norm = normalizeFlags(flags);
  if (!norm.ok) return { ok: false, regex: null, flags: '', kind: 'flags', deduplicated: false, reason: norm.reason };
  try {
    return {
      ok: true, regex: new RegExp(src, norm.flags), flags: norm.flags, kind: null,
      deduplicated: norm.deduplicated, reason: norm.reason,
    };
  } catch (err) {
    return {
      ok: false, regex: null, flags: norm.flags, kind: 'pattern', deduplicated: norm.deduplicated,
      reason: `语法错误：${err.message}`,
    };
  }
}

/* ---------------------------------------------------------------- 分词器 ---- */

/**
 * 极简递归下降：只为"形状"服务，不为"语义"服务——语义交给 native。
 * 走不通就返回 null，`riskScan` 据此报 `parsed:false`，把语法判定让回 `compile`。
 * 元素统一是 `{ atom:{kind,source,alts?}, min, max, at }`，`kind` 分 `group` / `other`。
 */
function tokenize(src) {
  let i = 0;

  function quantifier() {
    const ch = src[i];
    if (ch === '*' || ch === '+' || ch === '?') {
      i += 1;
      if (src[i] === '?' || src[i] === '+') i += 1;   // 懒惰档与（非法的）占有档一并跳过，形状判定不受影响
      return ch === '*' ? { min: 0, max: UNBOUNDED } : ch === '+' ? { min: 1, max: UNBOUNDED } : { min: 0, max: 1 };
    }
    if (ch !== '{') return { min: 1, max: 1 };
    const m = /^\{(\d+)(?:,(\d*))?\}/.exec(src.slice(i, i + 20));
    if (m === null) return { min: 1, max: 1 };        // 不是合法量词：`{` 在 native 里是字面量，这里也当字面量
    i += m[0].length;
    const lo = Number(m[1]);
    const hi = m[2] === undefined ? lo : m[2] === '' ? UNBOUNDED : Number(m[2]);
    return { min: lo, max: hi < lo ? lo : hi };
  }

  function primary() {
    const ch = src[i];
    if (ch === undefined) return null;
    if (ch === '(') return group();
    if (ch === '[') {
      const start = i;
      i += 1;
      if (src[i] === '^') i += 1;
      if (src[i] === ']') i += 1;                     // 首位的 `]` 是字面量，`[^]]` 同理
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === ']') { i += 1; return { kind: 'other', source: src.slice(start, i) }; }
        i += 1;
      }
      return null;
    }
    if (ch === '\\') {
      const next = src[i + 1];
      if (next === undefined) return null;
      if (next === 'p' || next === 'P') {
        if (src[i + 2] === '{') {
          const close = src.indexOf('}', i + 3);
          if (close < 0) return null;
          const source = src.slice(i, close + 1);
          i = close + 1;
          return { kind: 'other', source };
        }
        i += 2;
        return { kind: 'other', source: src.slice(i - 2, i) };
      }
      if (next === 'k' && src[i + 2] === '<') {
        const close = src.indexOf('>', i + 3);
        if (close < 0) return null;
        const source = src.slice(i, close + 1);
        i = close + 1;
        return { kind: 'other', source };
      }
      i += 2;
      return { kind: 'other', source: src.slice(i - 2, i) };
    }
    if (ch === '^' || ch === '$') { i += 1; return { kind: 'other', source: ch, zeroWidth: true }; }
    if (ch === '|' || ch === ')') return null;
    i += 1;
    return { kind: 'other', source: ch };
  }

  function element() {
    const at = i;
    const atom = primary();
    if (atom === null) return null;
    const q = quantifier();
    return { atom, min: q.min, max: q.max, at };
  }

  function sequence() {
    const out = [];
    for (;;) {
      if (i >= src.length || src[i] === '|' || src[i] === ')') return out;
      const e = element();
      if (e === null) return null;
      out.push(e);
    }
  }

  function group() {
    const at = i;
    i += 1;
    if (src[i] === '?') {
      i += 1;
      const c = src[i];
      if (c === undefined) return null;
      if (c === ':' || c === '=' || c === '!') i += 1;
      else if (c === '<') {
        if (src[i + 1] === '=' || src[i + 1] === '!') i += 2;
        else {
          const close = src.indexOf('>', i + 1);
          if (close < 0) return null;
          i = close + 1;
        }
      } else return null;
    }
    const alts = [];
    for (;;) {
      const s = sequence();
      if (s === null) return null;
      alts.push(s);
      if (src[i] === '|') { i += 1; continue; }
      break;
    }
    if (src[i] !== ')') return null;
    i += 1;
    return { kind: 'group', source: src.slice(at, i), alts, at };
  }

  const alts = [];
  for (;;) {
    const s = sequence();
    if (s === null) return null;
    alts.push(s);
    if (src[i] === '|') { i += 1; continue; }
    break;
  }
  if (i < src.length) return null;                    // 剩下了闭括号一类的东西：交给 compile 报原话
  return { alts };
}

/* ------------------------------------------------------------ 形状判定 ---- */

/** 序列里是否有一个"定宽且非空"的元素：它能钉住每次迭代的边界 */
const hasFixedWidth = (seq) => seq.some((e) => e.min === e.max && e.min >= 1);
const hasNullable = (seq) => seq.some((e) => e.min === 0 && e.max >= 1 && !e.atom.zeroWidth);

/**
 * F1 的内层条件：这一段自己就能让迭代边界滑动。
 * 两条口径来自实测——单个可变长度元素（`(a{1,3})+` 32 字符 5.4s）与
 * "含可空元素且没有定宽元素钉边界"（`(?:\s*\w+)*` 20 字符 30.8ms）；
 * 反过来 `(x+a+)+` 两个必填元素互相钉不住上限、但每步至少吃掉 2 个字符，20 字符 0.0ms，不算。
 */
function amplifies(seq) {
  if (seq.length === 1) return seq[0].min !== seq[0].max;
  return hasNullable(seq) && !hasFixedWidth(seq);
}

/** 序列的最小重复单元：`(ab|abab)` 的单元是 `ab`，`(x|xx|xxx)` 的单元是 `x` */
function unitOf(keys) {
  for (let len = 1; len <= keys.length; len += 1) {
    if (keys.length % len !== 0) continue;
    let ok = true;
    for (let k = 0; k < keys.length; k += 1) if (keys[k] !== keys[k % len]) { ok = false; break; }
    if (ok) return keys.slice(0, len);
  }
  return keys.slice();
}

/**
 * 把一个分支折成"单元 + 重复次数区间"。折不动（元素带无界量词、分支里混着不同长度）就标 irregular，
 * F2 不拿它跟别的分支比——宁可漏报，不可误杀。
 */
function shapeOfAlternative(seq) {
  if (seq.length === 0) return null;
  const keys = seq.map((e) => e.atom.source);
  if (seq.length === 1) {
    const e = seq[0];
    if (e.max === UNBOUNDED) return { unit: unitOf(keys), lo: e.min, hi: UNBOUNDED, irregular: true };
    return { unit: unitOf(keys), lo: e.min, hi: e.max, irregular: e.min === 0 };
  }
  if (!seq.every((e) => e.min === e.max && e.min >= 1)) return { unit: keys, lo: 1, hi: 1, irregular: true };
  const unit = unitOf(keys);
  const times = keys.length / unit.length;
  const flat = seq.every((e) => e.min === seq[0].min);
  if (!flat) return { unit, lo: times, hi: times, irregular: true };
  return { unit, lo: times, hi: times, irregular: false };
}

const sameUnit = (a, b) => a.unit.length === b.unit.length && a.unit.every((k, idx) => k === b.unit[idx]);
/** 两个分支能吃掉同一段文本的两种分法 → 回溯放大 */
const overlaps = (a, b) => a.lo <= b.hi && b.lo <= a.hi;
const multipleOf = (a, b) => (a.hi % b.lo === 0 && a.hi >= b.lo) || (b.hi % a.lo === 0 && b.hi >= a.lo);

const HINTS = {
  F1: '嵌套的无界量词会随输入指数放大：给内层量词收紧出上限（例如 {1,3}），或把这段重复拆成两步匹配',
  F2: '分支之间能互相拆着命中同一段文本：把分支改写成互不重叠的形状，或给外层量词收紧上限',
  F3: '相邻两段同源又都带无界量词：合并成一个量词（例如 a*a* 写成 a*），或给其中一段收紧上限',
  F4: '同 F1 的形状但外层是有限重复：先限制内层量词的上限，或拆成两步匹配',
};

/**
 * 命中条目：`level` 由**放大器**决定而不是由规则名决定——
 * 同一条 F2，组外是 `*` / `+` 就是 high，是 `{3}` 就只到 medium（N12 两条各钉一头）。
 */
const finding = (rule, at, level) => ({ rule, at, hint: HINTS[rule], level });

/** 对一个组节点做判定：外层量词决定这形状是 high 还是 medium */
function scanGroup(node, min, max, findings) {
  if (max <= 1) return;                                 // `(a+)?`、`(a+){1}`、`(a+)`：没有放大
  const unbounded = max === UNBOUNDED;
  for (const alt of node.alts) {
    if (amplifies(alt)) {
      findings.push(unbounded ? finding('F1', node.at, 'high') : finding('F4', node.at, 'medium'));
    }
  }
  const shapes = node.alts.map(shapeOfAlternative).filter((s) => s !== null);
  let reported = false;
  for (let p = 0; p < shapes.length && !reported; p += 1) {
    for (let q = p + 1; q < shapes.length && !reported; q += 1) {
      const a = shapes[p];
      const b = shapes[q];
      if (a.irregular || b.irregular || !sameUnit(a, b)) continue;
      if (overlaps(a, b) || multipleOf(a, b)) {
        findings.push(finding('F2', node.at, unbounded ? 'high' : 'medium'));
        reported = true;
      }
    }
  }
}

function scanSequence(seq, findings) {
  for (let k = 0; k + 1 < seq.length; k += 1) {
    const a = seq[k];
    const b = seq[k + 1];
    if (a.max !== UNBOUNDED || b.max !== UNBOUNDED) continue;
    if (a.atom.source === b.atom.source) findings.push(finding('F3', b.at, 'medium'));
  }
  for (const e of seq) {
    if (e.atom.kind !== 'group') continue;
    scanGroup(e.atom, e.min, e.max, findings);
    for (const alt of e.atom.alts) scanSequence(alt, findings);
  }
}

/**
 * 静态可疑形状检测：不看输入、不进引擎，只回答"这个形状会不会在回溯里炸开"。
 * 走不完分词就返回 `parsed:false` 且 `level:'none'`——语法判定是 `compile` 的活，这里不越权报错，
 * 但也不把半成品当"没风险"交出去（N13 钉这一档）。
 */
export function riskScan(pattern) {
  const src = toText(pattern);
  const tree = tokenize(src);
  if (tree === null) {
    return { level: 'none', findings: [], parsed: false, reason: '模式没能走完分词，语法判定交给编译那一档' };
  }
  const found = [];
  for (const alt of tree.alts) scanSequence(alt, found);
  const deduped = [];
  for (const f of found) {
    if (!deduped.some((g) => g.rule === f.rule && g.at === f.at)) deduped.push(f);
  }
  const level = deduped.some((f) => f.level === 'high') ? 'high' : deduped.length > 0 ? 'medium' : 'none';
  const rules = [...new Set(deduped.map((f) => f.rule))].join('/');
  return {
    level,
    findings: deduped,
    parsed: true,
    reason: deduped.length === 0 ? null : `可疑形状 ${rules}：${deduped[0].hint}`,
  };
}

/* -------------------------------------------------------------- 执行 ---- */

/** 一次 exec 结果 → 面板要的那一格：位置一律取自 native，`d` 没开就没有组位置 */
function cell(m, hasIndices) {
  const groups = [];
  for (let g = 1; g < m.length; g += 1) {
    const text = m[g];
    const span = hasIndices && m.indices ? m.indices[g] : null;
    groups.push({
      index: span ? span[0] : null, length: span ? span[1] - span[0] : null,
      text, participated: text !== undefined,
    });
  }
  const named = {};
  if (m.groups) {
    const spans = hasIndices && m.indices ? m.indices.groups : null;
    for (const key of Object.keys(m.groups)) {
      const text = m.groups[key];
      const span = spans ? spans[key] : null;
      named[key] = {
        index: span ? span[0] : null, length: span ? span[1] - span[0] : null,
        text, participated: text !== undefined,
      };
    }
  }
  return { index: m.index, length: m[0].length, text: m[0], groups, named };
}

/** 四档闸门里"执行之前"的那三段，`findMatches` 与 `previewReplace` 共用一把顺序（N3 / N14 / N17 钉先后） */
function gate(pattern, flags, body, cap) {
  const src = toText(pattern);
  const base = {
    ok: false, reason: null, pattern: src, flags: '', level: null, findings: [], executed: false,
    matches: [], count: 0, capped: cap, hitLimit: false, timedOut: false, elapsedMs: null,
    bytes: undefined, chars: body.length, regex: null,
  };
  if (src.length > MAX_PATTERN_CHARS) {
    return { ...base, reason: `模式 ${src.length} 字符，超过 ${MAX_PATTERN_CHARS} 字符上限，整体拒绝、不截断` };
  }
  const made = compile(src, flags);
  if (!made.ok) return { ...base, flags: made.flags, reason: made.reason };
  const risk = riskScan(src);
  base.level = risk.level;
  base.findings = risk.findings;
  base.flags = made.flags;
  if (risk.level === 'high') {
    const rules = [...new Set(risk.findings.map((f) => f.rule))].join('/');
    return { ...base, reason: `模式含疑似灾难性回溯的形状 ${rules}，引擎一次都不执行：${risk.findings[0].hint}` };
  }
  const bytes = byteLen(body);
  if (bytes > MAX_INPUT_BYTES) {
    return { ...base, bytes, reason: `输入 ${bytes} 字节，超过 ${MAX_INPUT_BYTES} 字节（1 MiB）上限，整体拒绝、不截断` };
  }
  if (risk.level === 'medium' && body.length > MEDIUM_MAX_INPUT_CHARS) {
    return {
      ...base, bytes,
      reason: `模式含可疑形状（${risk.findings.map((f) => f.rule).join('/')}），这一档只对不超过 ${MEDIUM_MAX_INPUT_CHARS} 字符的输入求解，实际 ${body.length} 字符、不截断`,
    };
  }
  return { ...base, bytes, regex: made.regex };
}

const emptyFind = (body, cap) => ({
  ok: false, reason: null, pattern: '', flags: '', level: null, findings: [], executed: false,
  matched: false, matches: [], count: 0, capped: cap, hitLimit: false, timedOut: false,
  elapsedMs: null, bytes: undefined, chars: body.length,
});

/**
 * 匹配求解：闸门顺序为 模式长度 → 编译 → 静态形状 → 输入字节 → medium 的字符档 → 执行循环。
 * 循环里只有两处收口：`capped` 次数档与注入时钟的时间档；零宽匹配手动推进一格，否则第一次命中就再也不动。
 */
export function findMatches(pattern, flags, text, options) {
  const opts = readOptions(options, 'findMatches');
  const cap = effectiveCap(opts.maxMatches);
  const body = toText(text);
  const shot = gate(pattern, flags, body, cap);
  if (shot.regex === null) return { ...emptyFind(body, cap), ...shot, matched: false };

  const re = shot.regex;
  const hasIndices = re.flags.includes('d');
  const multi = re.global || re.sticky;
  const clock = opts.now;
  const budget = opts.timeBudgetMs === null || opts.timeBudgetMs === undefined ? TIME_BUDGET_MS : opts.timeBudgetMs;
  const startMs = clock ? clock() : 0;
  const matches = [];
  let elapsedMs = clock ? 0 : null;
  let hitLimit = false;
  let timedOut = false;

  re.lastIndex = 0;
  for (;;) {
    if (clock) {
      elapsedMs = clock() - startMs;
      if (Number.isFinite(elapsedMs) && elapsedMs > budget) { timedOut = true; break; }
    }
    const m = re.exec(body);
    if (m === null) break;
    if (matches.length >= cap) { hitLimit = true; break; }
    matches.push(cell(m, hasIndices));
    if (m[0].length === 0) re.lastIndex += 1;
    if (!multi) break;
  }

  const notes = [];
  if (shot.level === 'medium') notes.push(`模式含可疑形状（${shot.findings.map((f) => f.rule).join('/')}），这一档只对不超过 ${MEDIUM_MAX_INPUT_CHARS} 字符的输入求解`);
  if (timedOut) notes.push(`超过档间时间预算 ${budget} 毫秒，只列前 ${matches.length} 格`);
  if (hitLimit) notes.push(`命中超过匹配次数上限 ${cap}，只列前 ${cap} 个，后面还有没列出的、不静默截断`);

  return {
    ok: true, reason: notes.length === 0 ? null : notes.join('；'),
    pattern: shot.pattern, flags: shot.flags, level: shot.level, findings: shot.findings,
    executed: true, matched: matches.length > 0, matches, count: matches.length,
    capped: cap, hitLimit, timedOut, elapsedMs, bytes: shot.bytes, chars: shot.chars,
  };
}

/**
 * 替换预览：吃同一套闸门，产物直接由 native `String.prototype.replace` 给出——
 * `$` 的每一种写法都以引擎为准（N15 逐条对拍），本模块绝不自己展开替换串。
 */
export function previewReplace(pattern, flags, text, replacement, options) {
  const opts = readOptions(options, 'previewReplace');
  const cap = effectiveCap(opts.maxMatches);
  const repl = toText(replacement);
  const body = toText(text);
  const shot = gate(pattern, flags, body, cap);
  if (shot.regex === null) {
    return {
      ok: false, reason: shot.reason, pattern: shot.pattern, flags: shot.flags, level: shot.level,
      findings: shot.findings, executed: false, out: '', changed: false,
      bytes: shot.bytes, chars: shot.chars, capped: cap,
    };
  }
  const out = body.replace(shot.regex, repl);
  return {
    ok: true, reason: shot.level === 'medium'
      ? `模式含可疑形状（${shot.findings.map((f) => f.rule).join('/')}），这一档只对不超过 ${MEDIUM_MAX_INPUT_CHARS} 字符的输入求解` : null,
    pattern: shot.pattern, flags: shot.flags, level: shot.level, findings: shot.findings,
    executed: true, out, changed: out !== body, bytes: shot.bytes, chars: shot.chars, capped: cap,
  };
}
