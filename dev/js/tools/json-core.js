/**
 * JSON 核心：解析（精确行列）、格式化、压缩、排序、Pointer、转义、统计。
 * 设计文档 §5.3 的"解析 + 校验 + 精确定位 + 格式化 + 排序 + Pointer"族，段 4 Task 2 落地。
 *
 * ── 这一本为什么必须自己写一遍解析器 ──
 *
 * `JSON.parse` 给不出**位置**。V8 的 `SyntaxError` 消息是 `Unexpected token ',' in JSON at
 * position 7` 这一族（各引擎文案还不一样，Safari 与 Firefox 至今不同形），而 §5.3 要的是
 * "错误处标出精确行列号"并把那一格高亮到输入框上。位置错一格和没报错一样有害：用户照着提示
 * 去删字符，删完还是错。所以行列号只能自己算，`JSON.parse` 在本模块里一次都不出现——
 * §S 的 S16 拿它做**对拍**（同结论、同值），那是判据用的外部尺，不是运行时依赖。
 *
 * ── 位置口径（§S 钉死，实现不许自创第二套）──
 *
 * · `line` 与 `column` 都从 1 起；
 * · `column` 数 UTF-16 **码元**，一个 emoji 占两列——`setSelectionRange` 用的就是这个单位，
 *   两把尺一致高亮才不会错格；
 * · 换行只认 `\n`：CRLF 一行推进一次，`\r` 留在行内、由 `lineRange` 从行内容里切掉；
 * · BOM（U+FEFF）占第 1 行第 1 列，**不吞**它的列位；解析端只容忍头部那**一个** BOM
 *   （从 Windows 文件里粘出来的常见形状），第二个就按"不该出现的字符"点名；
 * · EOF 那一格 `index = text.length`、`length = 0`，列号 = 最后一行的长度 + 1。
 *
 * 与原生只有两处**故意**分歧，两处都由 §S 的判据钉住，不是偶然：
 *   1. `\uFEFF{}`（文件头带一个 BOM）：原生拒，本站收——就是上面那条 BOM 容忍；
 *   2. `1e999`：原生收成 `Infinity`，本站按 `bad-number` 拒——工具里出去的值必须
 *      还是合法 JSON，`Infinity` 到了下游只会变成静默的 `null`。
 *
 * ── 为什么解析、序列化、统计三族全是显式栈 ──
 *
 * 深度闸门 `MAX_DEPTH = 1000` 是本站自己定的，而 V8 的调用栈在递归下降解析器里大约撑到
 * 几百到一千多层就要抛 `RangeError: Maximum call stack size exceeded`——那意味着一份 1000 层的
 * 合法输入会先炸掉我的栈，再炸用户的页面（并且是 `undefined` 而不是任何可读错误）。
 * 所以 `parseJson` / `formatJson` / `minifyJson` / `statsOf` / `sortJson` 全部用显式栈迭代；
 * 判据里那两条 1000 层的样本就是这一族的验收（§S 的 S18）。
 *
 * ── 纯计算 ──
 *
 * 本模块不读任何环境：没有 `window` / `document` / `localStorage` / `process` / `Buffer` /
 * `TextEncoder`，不 `import` 任何东西，也不碰网络。UTF-8 字节数自己按码元算（`utf8Bytes`），
 * 因为浏览器里没有 `Buffer`；§S 的 S3/S18 拿 Node 的 `Buffer.byteLength` 当外部尺对这一族。
 *
 * ── `__proto__` ──
 *
 * 解析出来的对象一律用 `setOwn()` 写键：`obj['__proto__'] = v` 改的是原型而不是属性，
 * 一份恶意 JSON 可以借此污染后续所有对象。`Object.defineProperty` 那一支让它落成真属性，
 * 与 `JSON.parse` 的行为一致（§S 的 S16 样本集里带这一族对拍）。
 *
 * @module dev/js/tools/json-core.js
 */

/** 输入字节上限：spec §7「JSON 5MB」那一档，与编码页文本类的 1 MiB 是**两个不同的数** */
export const MAX_INPUT_BYTES = 5242880;
/** 输入行数上限：同一格里 §7 写的 20 万行 */
export const MAX_INPUT_LINES = 200000;
/** 容器嵌套上限：本站主动闸门；§7 的深样本是 200 层，必须放行 */
export const MAX_DEPTH = 1000;
/** 排序三档：不动 / 只动根 / 连数组元素一起动 */
export const SORT_MODES = ['off', 'shallow', 'deep'];
/** 缩进三档：两个空格、四个空格、制表符 */
export const INDENT_MODES = ['two', 'four', 'tab'];
/** 面板原样显示的两句话径（§W 不再自己编一句） */
export const CORE_NOTES = {
  deepSample: '深度闸门是 1000 层；§7 的深样本按 200 层量，这一档必须放行并且给得出统计。',
  dupKey: '重复键不算错：后写的值覆盖先写的，出现过的每一处按 Pointer 列出来（含次数）。',
};

const INDENTS = { two: '  ', four: '    ', tab: '\t' };
const TAB = 9, LF = 10, CR = 13, SPACE = 32, QUOTE = 34, PLUS = 43, COMMA = 44, MINUS = 45,
  DOT = 46, SLASH = 47, ZERO = 48, NINE = 57, COLON = 58, BACKSLASH = 92, LB = 91, RB = 93,
  LC = 123, RC = 125, TILDE = 126, BOM = 0xFEFF;
/** 码点区间展开成数组——`const` 有暂时性死区，这一把尺必须先于用它的那一行出现 */
const rangeOf = (from, to) => { const a = []; for (let c = from; c <= to; c++) a.push(c); return a; };
/** 数字记号的**贪婪字符集**：先读满这一串，再验语法。于是 `01`、`1.`、`0.1.2` 都指认整记号 */
const NUMBER_CHARS = new Set([PLUS, MINUS, DOT, ...rangeOf(ZERO, NINE), 0x45, 0x65]); // E e
const NUMBER_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const ESCAPE_SHORT = new Map([
  ['"', '\\"'], ['\\', '\\\\'], ['\b', '\\b'], ['\f', '\\f'], ['\n', '\\n'], ['\r', '\\r'], ['\t', '\\t'],
]);
const ESCAPE_VALUE = new Map([
  ['"', '"'], ['\\', '\\'], ['/', '/'], ['b', '\b'], ['f', '\f'], ['n', '\n'], ['r', '\r'], ['t', '\t'],
]);

const isContainer = (v) => v !== null && typeof v === 'object';
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const unitOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sortedKeys = (o) => Object.keys(o).sort(unitOrder);
const clip = (token) => (token.length <= 40 ? token : `${token.slice(0, 40)}…`);

/** 用 defineProperty 而不是赋值，`__proto__` 才会落成真属性（见文件头那一段） */
function setOwn(obj, key, value) {
  if (key === '__proto__') Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
  else obj[key] = value;
}

/**
 * UTF-8 字节数：代理对算 4，BMP 按 3/2/1。浏览器里没有 `Buffer`，这一族自己数；
 * 全模块只有这一个字节口径，`gate()` 与序列化那一族的 `bytes` 都从它出。
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
 * 每一行的起始下标，末格补 `text.length`（所以数组长度 = 行数 + 1）。
 * 换行只认 `\n`：这是 §S 的行口径，`gate()` 的行数、`locate()`、`lineRange()` 全读它。
 * @param {string} text
 * @returns {number[]}
 */
export function lineStarts(text) {
  const out = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === LF) out.push(i + 1);
  out.push(text.length);
  return out;
}

/**
 * 下标 → 行列。列数码元；`index` 越界时钳到 `[0, length]`，EOF 那一格也给得出行列。
 * **每次调用都重扫一遍换行**：一次定位（坏样本报错那一格）用它；要给 N 处位置算行列，
 * 先取一次 `lineStarts()` 自己二分，别把这一本放进循环——5 MiB 输入 × 一万次就是分钟级。
 * @param {string} text
 * @param {number} index
 * @returns {{line: number, column: number}}
 */
export function locate(text, index) {
  const starts = lineStarts(text);
  const at = Math.max(0, Math.min(index | 0, text.length));
  let lo = 0, hi = starts.length - 2, k = 0;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (starts[m] <= at) { k = m; lo = m + 1; } else hi = m - 1;
  }
  return { line: k + 1, column: at - starts[k] + 1 };
}

/**
 * 第 `line` 行的内容区间 `[start, end)`：不含 `\n`，也不含行尾那个 `\r`。
 * 读条与选区直接用这一格，所以 CRLF 的输入不会被高亮成"多一个字符"。
 * @param {string} text
 * @param {number} line 从 1 起；越界钳到第一行与最后一行
 * @returns {{start: number, end: number}}
 */
export function lineRange(text, line) {
  const starts = lineStarts(text);
  const lines = starts.length - 1;
  const k = Math.min(Math.max((line | 0) || 1, 1), Math.max(lines, 1)) - 1;
  const start = starts[k];
  let end = k + 1 < starts.length ? starts[k + 1] : text.length;
  if (end > start && text.charCodeAt(end - 1) === LF) end -= 1;
  if (end > start && text.charCodeAt(end - 1) === CR) end -= 1;
  return { start, end };
}

/**
 * 字节与行数两档闸门。`parseJson` 的第一步就是它，所以"上限"在全仓库只有一处口径。
 * @param {string} text
 * @returns {{ok: boolean, bytes: number, lines: number, kind: (string|null), limit: (number|null), message: string}}
 */
export function gate(text) {
  if (typeof text !== 'string') throw new TypeError(`gate 只收字符串，收到的是 ${text === null ? 'null' : typeof text}`);
  const bytes = utf8Bytes(text);
  const lines = lineStarts(text).length - 1;
  if (bytes > MAX_INPUT_BYTES) {
    return {
      ok: false, bytes, lines, kind: 'too-long', limit: MAX_INPUT_BYTES,
      message: `输入超出上限：最多 ${MAX_INPUT_BYTES} 字节，当前 ${bytes} 字节（超出 ${bytes - MAX_INPUT_BYTES} 字节）。请删减后再解析，本站不做截断。`,
    };
  }
  if (lines > MAX_INPUT_LINES) {
    return {
      ok: false, bytes, lines, kind: 'too-many-lines', limit: MAX_INPUT_LINES,
      message: `输入行数超出上限：最多 ${MAX_INPUT_LINES} 行，当前 ${lines} 行（超出 ${lines - MAX_INPUT_LINES} 行）。请删减后再解析，本站不做截断。`,
    };
  }
  return { ok: true, bytes, lines, kind: null, limit: null, message: '' };
}

/** 转义一段文本成 JSON 字符串字面量的**内容**（不带引号），短转义优先，其余控制字符走 \\uXXXX */
export function escapeText(text) {
  if (typeof text !== 'string') throw new TypeError(`escapeText 只收字符串，收到的是 ${typeof text}`);
  const hex = (code) => `\\u${code.toString(16).padStart(4, '0')}`;
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const short = ESCAPE_SHORT.get(c);
    if (short) { out += short; continue; }
    const code = text.charCodeAt(i);
    if (code < 0x20) { out += hex(code); continue; }
    if (code >= 0xd800 && code <= 0xdfff) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : -1;
      // 成对的代理项原样走（一个 emoji 就是两格码元，与原生同形）
      if (code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { out += c + text[i + 1]; i += 1; continue; }
      // 落单的那半个：原生从 ES2019 起转成 `\udXXX`（well-formed JSON.stringify），这里同形。
      // 吐一个裸的半个代理项出去，交出去的就**不再是合法 JSON**——与文件头拒 `Infinity` 同一条理由。
      out += hex(code);
      continue;
    }
    out += c;
  }
  return out;
}

const quoteText = (text) => `"${escapeText(text)}"`;

/**
 * `escapeText` 的反向：只认 JSON 那套转义序列，`\\xNN`、`\\'`、单独的 `\\` 一律点名拒。
 * 这一族只管转义序列，不校验串内的控制字符（那是 `parseJson` 在整文档层面管的事）。
 * @param {string} text
 * @returns {{ok: true, text: string, error?: undefined} | {ok: false, text: string, error: {kind: string, message: string, index: number, length: number}}}
 */
export function unescapeText(text) {
  if (typeof text !== 'string') throw new TypeError(`unescapeText 只收字符串，收到的是 ${typeof text}`);
  const bad = (index, length, why) => ({
    ok: false, text: '',
    error: { kind: 'bad-escape', message: `不是合法的 JSON 转义序列：${why}（第 ${index + 1} 格起）。`, index, length },
  });
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) !== BACKSLASH) { out += text[i]; continue; }
    if (i + 1 >= text.length) return bad(i, 1, '结尾的反斜杠后面没有内容');
    const nx = text[i + 1];
    if (nx === 'u') {
      const hex = text.slice(i + 2, i + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) return bad(i, 2, '\\u 后面必须是四位十六进制');
      out += String.fromCharCode(parseInt(hex, 16));
      i += 5;
      continue;
    }
    const value = ESCAPE_VALUE.get(nx);
    if (value === undefined) return bad(i, 2, `反斜杠后面的 ${nx === '\\' ? '（空）' : nx} 不是转义字符`);
    out += value;
    i += 1;
  }
  return { ok: true, text: out };
}

const escPointer = (s) => s.replace(/~/g, '~0').replace(/\//g, '~1');

/**
 * 段数组 → RFC 6901 Pointer。数组段用十进制下标；`~`→`~0`、`/`→`~1`。
 * @param {Array<string|number>} segments
 * @returns {string}
 */
export function toPointer(segments) {
  let out = '';
  for (const s of segments) out += `/${escPointer(String(s))}`;
  return out;
}

/**
 * Pointer → 段数组。解码按左到右单趟扫：`~01` 解成 `~1`（先 `~1`→`/` 再 `~0`→`~` 的两趟写法
 * 会把它读成 `/`，那是把用户的数据改坏）。拒的时候只给 `{message, column}`——
 * 指针不是文档，没有行列可言。
 * @param {string} pointer
 * @returns {{ok: true, segments: string[]} | {ok: false, error: {message: string, column: number}}}
 */
export function fromPointer(pointer) {
  if (typeof pointer !== 'string') {
    return { ok: false, error: { message: 'Pointer 必须是字符串。', column: 1 } };
  }
  if (pointer === '') return { ok: true, segments: [] };
  if (pointer.charCodeAt(0) !== SLASH) {
    return { ok: false, error: { message: `Pointer 必须以 / 起始（或以空串表示根），第 1 列这里是 ${pointer[0]}。`, column: 1 } };
  }
  const parts = pointer.slice(1).split('/');
  const segments = [];
  let offset = 1;                                  // parts[0] 在原串里的下标
  for (const part of parts) {
    let seg = '';
    for (let k = 0; k < part.length; k++) {
      if (part.charCodeAt(k) !== TILDE) { seg += part[k]; continue; }
      const nx = part[k + 1];
      if (nx !== '0' && nx !== '1') {
        return {
          ok: false,
          error: { message: `~ 后面只能是 0 或 1，第 ${offset + k + 1} 列这里是 ${nx === undefined ? '（结尾）' : nx}。`, column: offset + k + 1 },
        };
      }
      seg += nx === '0' ? '~' : '/';
      k += 1;
    }
    segments.push(seg);
    offset += part.length + 1;                     // 吃掉那一个 /
  }
  return { ok: true, segments };
}

/**
 * 父指针 + 子键 = 子指针。父串原样接上，不重解一遍再重编（那会丢已有的转义）。
 * @param {string} parent
 * @param {string|number} keyOrIndex
 * @returns {string}
 */
export function pointerChild(parent, keyOrIndex) {
  return `${parent}/${escPointer(String(keyOrIndex))}`;
}

/**
 * 统计五格：值节点总数、容器最大层数、键总数、数组元素总数、最长字符串的码元数。
 * 显式栈（见文件头那条），键与字符串值一起进"最长字符串"这一格。
 * @param {unknown} value
 * @returns {{nodes: number, depth: number, keys: number, arrayItems: number, longestStringChars: number}}
 */
export function statsOf(value) {
  const stats = { nodes: 0, depth: 0, keys: 0, arrayItems: 0, longestStringChars: 0 };
  const bumpString = (s) => { if (s.length > stats.longestStringChars) stats.longestStringChars = s.length; };
  if (typeof value === 'string') { stats.nodes = 1; bumpString(value); return stats; }
  if (!isContainer(value)) return { ...stats, nodes: 1 };
  const stack = [{ v: value, level: 1 }];
  while (stack.length) {
    const { v, level } = stack.pop();
    stats.nodes += 1;
    if (level > stats.depth) stats.depth = level;
    if (Array.isArray(v)) {
      stats.arrayItems += v.length;
      for (let i = 0; i < v.length; i++) {
        const c = v[i];
        if (isContainer(c)) stack.push({ v: c, level: level + 1 });
        else { stats.nodes += 1; if (typeof c === 'string') bumpString(c); }
      }
    } else {
      const keys = Object.keys(v);
      stats.keys += keys.length;
      for (const k of keys) {
        bumpString(k);
        const c = v[k];
        if (isContainer(c)) stack.push({ v: c, level: level + 1 });
        else { stats.nodes += 1; if (typeof c === 'string') bumpString(c); }
      }
    }
  }
  return stats;
}

/**
 * 唯一解析入口：不抛，坏输入返回 `{ok:false,error}`；入参不是字符串才抛 TypeError。
 * 错误七格 `{kind, message, index, length, line, column, snippet}` 里，`index` 指向出错那一个字符，
 * `unterminated*` 两类指向 EOF 那一格；闸门两档（`too-long` / `too-many-lines`）没有位置可指，
 * 位置给的是 EOF 那一格、`snippet` 给空串——绝不把那一大串回显出去。
 * @param {string} text
 * @returns {{ok: true, value: unknown, depth: number, nodeCount: number, duplicateKeys: Array<{pointer: string, times: number}>, stats: object}
 *   | {ok: false, error: {kind: string, message: string, index: number, length: number, line: number, column: number, snippet: string}}}
 */
export function parseJson(text) {
  if (typeof text !== 'string') throw new TypeError(`parseJson 只收字符串，收到的是 ${text === null ? 'null' : typeof text}`);
  const g = gate(text);
  if (!g.ok) {
    const pos = locate(text, text.length);
    return {
      ok: false,
      error: { kind: g.kind, message: g.message, index: text.length, length: 0, line: pos.line, column: pos.column, snippet: '' },
    };
  }

  const n = text.length;
  const fail = (kind, why, index, length) => {
    const at = Math.max(0, Math.min(index, n));
    const pos = locate(text, at);
    const range = lineRange(text, pos.line);
    return {
      ok: false,
      error: {
        kind, message: `${why}（第 ${pos.line} 行第 ${pos.column} 列）。`, index: at, length,
        line: pos.line, column: pos.column, snippet: text.slice(range.start, range.end),
      },
    };
  };
  const eof = (kind, why) => fail(kind, why, n, 0);
  const here = (index) => {
    const c = text.charCodeAt(index);
    return c >= 0x20 && c !== BOM && c !== BACKSLASH ? `「${text[index]}」` : `U+${c.toString(16).toUpperCase().padStart(4, '0')}`;
  };

  /** 只跳过头部那一个 BOM：其余非空白字符一律由调用侧点名 */
  const ws = (from) => {
    let k = from;
    while (k < n) {
      const c = text.charCodeAt(k);
      if (c === SPACE || c === TAB || c === LF || c === CR) { k += 1; continue; }
      if (c === BOM && k === 0) { k += 1; continue; }
      break;
    }
    return k;
  };

  const readEscape = (k) => {
    if (k + 1 >= n) return { bad: '结尾的反斜杠后面没有内容', index: k, length: 1 };
    const nx = text[k + 1];
    if (nx === 'u') {
      const hex = text.slice(k + 2, k + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) return { bad: '\\u 后面必须是四位十六进制', index: k, length: 2 };
      return { ch: String.fromCharCode(parseInt(hex, 16)), next: k + 6 };
    }
    const value = ESCAPE_VALUE.get(nx);
    if (value === undefined) return { bad: `反斜杠后面的 ${nx} 不是转义字符`, index: k, length: 2 };
    return { ch: value, next: k + 2 };
  };

  /** `from` 指向开引号；返回 {ok,value,next} 或 {bad:{kind,why,index,length}} */
  const readString = (from) => {
    let k = from + 1;
    let cut = k;
    let out = '';
    while (k < n) {
      const c = text.charCodeAt(k);
      if (c === QUOTE) return { ok: true, value: out + text.slice(cut, k), next: k + 1 };
      if (c === BACKSLASH) {
        out += text.slice(cut, k);
        const e = readEscape(k);
        if (e.bad) return { bad: { kind: 'bad-escape', why: `不是合法的 JSON 转义序列：${e.bad}`, index: e.index, length: e.length } };
        out += e.ch;
        k = e.next;
        cut = k;
        continue;
      }
      if (c === LF || c === CR) {
        return { bad: { kind: 'unterminated-string', why: `字符串没闭合就遇到了换行，前面还有 ${clip(text.slice(from, Math.min(k, from + 44)))}`, index: k, length: 1 } };
      }
      if (c < 32) {
        return { bad: { kind: 'unexpected-char', why: `字符串里有未转义的控制字符 U+${c.toString(16).toUpperCase().padStart(4, '0')}，要写成 \\n、\\t 或 \\uXXXX`, index: k, length: 1 } };
      }
      k += 1;
    }
    return { bad: { kind: 'unterminated-string', why: '字符串没闭合就到了输入结尾', index: n, length: 0 } };
  };

  const readNumber = (from) => {
    let k = from;
    while (k < n && NUMBER_CHARS.has(text.charCodeAt(k))) k += 1;
    const token = text.slice(from, k);
    if (!NUMBER_RE.test(token)) {
      return { bad: { kind: 'bad-number', why: `数字写法不合法：${clip(token)}（本站只认 JSON 的数字：不许前导零、不许裸小数点、不许 NaN 或 Infinity）`, index: from, length: token.length } };
    }
    const v = Number(token);
    if (!Number.isFinite(v)) {
      return { bad: { kind: 'bad-number', why: `数值超出可表示范围：${clip(token)} 会变成 Infinity，本站不产 Infinity`, index: from, length: token.length } };
    }
    return { ok: true, value: v, next: k };
  };

  const LITERALS = new Map([[0x74, 'true'], [0x66, 'false'], [0x6e, 'null']]);
  const readLiteral = (from) => {
    let k = from;
    while (k < n && /[a-z]/.test(text[k])) k += 1;
    const token = text.slice(from, k);
    const want = LITERALS.get(text.charCodeAt(from));
    if (token !== want) {
      return { bad: { kind: 'unexpected-char', why: `${clip(token)} 不是合法的 JSON 值（本站不认 NaN、Infinity、单引号与未加引号的键）`, index: from, length: 1 } };
    }
    return { ok: true, value: want === 'true' ? true : want === 'false' ? false : null, next: k };
  };

  const frames = [];
  const dupOrder = [];
  const dupTimes = new Map();
  let root = undefined, nodes = 0, maxDepth = 0;

  // 每放一个成员就把这一格的 count 加一：`[]` 与 `[1,]` 的分别、`{}` 与 `{"a":1,}` 的分别，
  // 全押在这一格上（收尾分支靠 count===0 认"空容器"，不是靠括号后面紧跟的字符）。
  const place = (v) => {
    nodes += 1;
    if (!frames.length) { root = v; return; }
    const f = frames[frames.length - 1];
    f.count += 1;
    if (f.kind === 'arr') { f.node.push(v); return; }
    if (hasOwn(f.node, f.key)) {
      const p = pointerChild(f.ptr, f.key);
      if (!dupTimes.has(p)) { dupTimes.set(p, 2); dupOrder.push(p); } else dupTimes.set(p, dupTimes.get(p) + 1);
    }
    setOwn(f.node, f.key, v);
  };

  let state = 'value';
  let i = ws(0);
  if (i >= n) return fail('empty', '输入是空的或只有空白字符，没有任何可解析的内容', n, 0);

  for (;;) {
    i = ws(i);
    const top = () => frames[frames.length - 1];

    if (state === 'value') {
      if (i >= n) return eof('unterminated', '这里在等一个值，输入却结束了');
      const c = text.charCodeAt(i);
      if (c === LC || c === LB) {
        if (frames.length + 1 > MAX_DEPTH) {
          return fail('depth', `嵌套深度超出上限：最多 ${MAX_DEPTH} 层，第 ${frames.length + 1} 层的容器出现在这里`, i, 1);
        }
        const parent = frames.length ? top() : null;
        const ptr = parent
          ? (parent.kind === 'arr' ? pointerChild(parent.ptr, parent.node.length) : pointerChild(parent.ptr, parent.key))
          : '';
        frames.push({ kind: c === LC ? 'obj' : 'arr', node: c === LC ? {} : [], key: null, ptr, count: 0 });
        if (frames.length > maxDepth) maxDepth = frames.length;
        i += 1;
        state = c === LC ? 'key' : 'value';
        continue;
      }
      if (c === RB && frames.length && top().kind === 'arr' && top().count === 0) {
        const f = frames.pop(); i += 1; place(f.node); state = 'sep'; continue;
      }
      if (c === QUOTE) {
        const s = readString(i);
        if (s.bad) return fail(s.bad.kind, s.bad.why, s.bad.index, s.bad.length);
        i = s.next; place(s.value); state = 'sep'; continue;
      }
      if (c === MINUS || (c >= ZERO && c <= NINE)) {
        const num = readNumber(i);
        if (num.bad) return fail(num.bad.kind, num.bad.why, num.bad.index, num.bad.length);
        i = num.next; place(num.value); state = 'sep'; continue;
      }
      if (LITERALS.has(c)) {
        const lit = readLiteral(i);
        if (lit.bad) return fail(lit.bad.kind, lit.bad.why, lit.bad.index, lit.bad.length);
        i = lit.next; place(lit.value); state = 'sep'; continue;
      }
      return fail('unexpected-char', `这里该放一个值，来的是 ${here(i)}（本站只认 JSON，不猜 JSON5 与注释）`, i, 1);
    }

    if (state === 'key') {
      if (i >= n) return eof('unterminated', '这里在等一个键名，输入却结束了');
      const f = top();
      if (text.charCodeAt(i) === RC && f.count === 0) { frames.pop(); i += 1; place(f.node); state = 'sep'; continue; }
      if (text.charCodeAt(i) !== QUOTE) {
        return fail('unexpected-char', `这里该放一个用双引号包起来的键名，来的是 ${here(i)}`, i, 1);
      }
      const s = readString(i);
      if (s.bad) return fail(s.bad.kind, s.bad.why, s.bad.index, s.bad.length);
      i = s.next; f.key = s.value; state = 'colon'; continue;
    }

    if (state === 'colon') {
      if (i >= n) return eof('unterminated', '键名读完在等冒号，输入却结束了');
      if (text.charCodeAt(i) !== COLON) {
        return fail('unexpected-char', `键名后面该是冒号，来的是 ${here(i)}`, i, 1);
      }
      i += 1; state = 'value'; continue;
    }

    // state === 'sep'
    if (!frames.length) break;
    if (i >= n) return eof('unterminated', '这里在等逗号或收尾的括号，输入却结束了');
    const f = top();
    const c = text.charCodeAt(i);
    if (c === COMMA) { i += 1; state = f.kind === 'arr' ? 'value' : 'key'; continue; }
    if ((f.kind === 'arr' && c === RB) || (f.kind === 'obj' && c === RC)) {
      frames.pop(); i += 1; place(f.node); state = 'sep'; continue;
    }
    return fail('unexpected-char', `值读完以后这里该是逗号或收尾的括号，来的是 ${here(i)}`, i, 1);
  }

  const after = ws(i);
  if (after < n) {
    return fail('trailing', `根值已经读完，后面还多出 ${n - after} 个字符，第一个多余的是 ${here(after)}`, after, 1);
  }

  const stats = statsOf(root);
  return {
    ok: true,
    value: root,
    depth: maxDepth,
    nodeCount: nodes,
    duplicateKeys: dupOrder.map((pointer) => ({ pointer, times: dupTimes.get(pointer) })),
    stats: { ...stats, bytes: g.bytes, lines: g.lines },
  };
}

/**
 * 值 → 文本。显式栈迭代（同文件头那一条），`unit` 是缩进单元、空串就是紧凑。
 * 转义走 `escapeText`，数字走 `String()`，两族都与原生同形。
 */
function serialize(value, unit) {
  if (!isContainer(value)) return value === undefined ? 'null' : typeof value === 'string' ? quoteText(value) : String(value);
  // 键名表与长度只在开框时数一次，存在框上：每轮都 `Object.keys(f.v)` 会让一个 n 键的对象读 n 次，
  // 整体退化成 O(n²)（§7 的预算量的是 5 MiB 那一档，这里省的是最坏情况）。
  const fresh = (v, level) => {
    const isArr = Array.isArray(v);
    const keys = isArr ? null : Object.keys(v);
    return { isArr, v, keys, len: isArr ? v.length : keys.length, i: 0, level, first: true };
  };
  const out = [];
  const stack = [];
  const open = (v, level) => {
    stack.push(fresh(v, level));
    out.push(Array.isArray(v) ? '[' : '{');
  };
  const sizeOf = (v) => (Array.isArray(v) ? v.length : Object.keys(v).length);
  open(value, 0);
  while (stack.length) {
    const f = stack[stack.length - 1];
    if (f.i < f.len) {
      const isArr = f.isArr;
      const key = isArr ? null : f.keys[f.i];
      const child = isArr ? f.v[f.i] : f.v[key];
      f.i += 1;
      if (!f.first) out.push(',');
      if (unit) out.push(`\n${unit.repeat(f.level + 1)}`);
      f.first = false;
      if (!isArr) out.push(`${quoteText(key)}:${unit ? ' ' : ''}`);
      if (isContainer(child) && sizeOf(child) > 0) open(child, f.level + 1);
      else if (isContainer(child)) out.push(Array.isArray(child) ? '[]' : '{}');
      else out.push(child === undefined ? 'null' : typeof child === 'string' ? quoteText(child) : String(child));
      continue;
    }
    if (unit && !f.first) out.push(`\n${unit.repeat(f.level)}`);
    out.push(f.isArr ? ']' : '}');
    stack.pop();
  }
  return out.join('');
}

/**
 * 三档枚举只有一把尺。**调用方给的模式不在那一族里就当场 `RangeError`**，消息里点出常量名，
 * 好让人顺着名字找到定义处（静默回退到默认档，是把"参数写错"藏成"输出莫名其妙"）。
 * @param {string} mode
 * @param {readonly string[]} list
 * @param {string} listName 常量名，只出现在消息里
 * @param {string} api 谁在收这个参数
 * @returns {string}
 */
const modeOf = (mode, list, listName, api) => {
  if (!list.includes(mode)) throw new RangeError(`${api} 只认 ${listName} 里的那几档：${list.join(' | ')}`);
  return mode;
};

/**
 * 文本 → 文本：解析、按需排序、按档缩进。坏输入把 `parseJson` 的那一格原样交出去，不吞也不改写。
 * @param {string} text
 * @param {{indent?: 'two'|'four'|'tab', sort?: 'off'|'shallow'|'deep'}} [options]
 * @returns {{ok: true, text: string, bytes: number, error?: undefined} | {ok: false, text: string, bytes: 0, error: object}}
 */
export function formatJson(text, options = {}) {
  const { indent = 'two', sort = 'off' } = options;
  modeOf(indent, INDENT_MODES, 'INDENT_MODES', 'formatJson 的 indent');
  modeOf(sort, SORT_MODES, 'SORT_MODES', 'formatJson 的 sort');
  const parsed = parseJson(text);
  if (!parsed.ok) return { ok: false, text: '', bytes: 0, error: parsed.error };
  const out = serialize(sortJson(parsed.value, sort), INDENTS[indent]);
  return { ok: true, text: out, bytes: utf8Bytes(out) };
}

/**
 * 文本 → 紧凑文本：只删容器之间的空白，字符串内部一个空格都不动。
 * @param {string} text
 * @returns {{ok: true, text: string, bytes: number, error?: undefined} | {ok: false, text: string, bytes: 0, error: object}}
 */
export function minifyJson(text) {
  const parsed = parseJson(text);
  if (!parsed.ok) return { ok: false, text: '', bytes: 0, error: parsed.error };
  const out = serialize(parsed.value, '');
  return { ok: true, text: out, bytes: utf8Bytes(out) };
}

/**
 * 值 → 排好键序的值。**不改入参**：`off` 交回同一个引用，`shallow` 只重建根，
 * `deep` 用显式栈把每一层容器重建（数组只克隆、元素顺序一个不挪）。
 * @param {unknown} value
 * @param {'off'|'shallow'|'deep'} mode
 * @returns {unknown}
 */
export function sortJson(value, mode) {
  modeOf(mode, SORT_MODES, 'SORT_MODES', 'sortJson 的 mode');
  if (mode === 'off' || !isContainer(value)) return value;
  if (mode === 'shallow') {
    if (Array.isArray(value)) return value;
    const out = {};
    for (const k of sortedKeys(value)) setOwn(out, k, value[k]);
    return out;
  }
  const copy = (v) => (Array.isArray(v) ? [] : {});
  const root = copy(value);
  const stack = [{ src: value, dst: root }];
  while (stack.length) {
    const { src, dst } = stack.pop();
    if (Array.isArray(src)) {
      for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (isContainer(c)) { const cc = copy(c); dst[i] = cc; stack.push({ src: c, dst: cc }); } else dst[i] = c;
      }
      continue;
    }
    for (const k of sortedKeys(src)) {
      const c = src[k];
      if (isContainer(c)) { const cc = copy(c); setOwn(dst, k, cc); stack.push({ src: c, dst: cc }); }
      else setOwn(dst, k, c);
    }
  }
  return root;
}
