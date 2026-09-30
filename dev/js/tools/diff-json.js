/**
 * 文件对比页的 JSON 感知比对（段 5 Task 3；§Y）。这一本只管"两份 JSON 按值比、差在哪一格"，
 * 不碰 DOM、不读环境。
 *
 * ── 为什么这里要自带一份 JSON 读侧（而不是 `import` `json-core.js`）──
 *
 * 这是构建层的硬约束，不是审美。`dev/js/tools/json-core.js` 今天的唯一 reach 者是
 * `jsonWorkbench.js`，而它只被 `toolJson.js` 那一个入口 reach；对比页的入口是 `toolDiff.js`。
 * 两个入口同时 import 同一本模块 → Rollup 把它切成带 `import{` 的共享 chunk，而本页的构建走
 * `iifeWrapPlugin` 包成 IIFE——包完就是**整页 SyntaxError 而构建 exit=0**
 * （`dev/js/toolkitCore.js:5-9` 记的正是这个坑，判据在门禁④的三列字节表里）。
 * 另一条出路是把 `json-core` 挂进 `window.Tk`：那要让已上线三页各自的 §7 总量格一起重算，
 * 还要把 `toolJson.js` 改成不直接 import、走 `Tk`——那是给存量页动手术。自带一份只涨这一页。
 *
 * 代价与补偿写在同一格里：既然自带，就必须**对拍**。§Y 的 Y1 拿同一批样本（§S 那 20 个坏样本
 * ＋ 14 个补分支的坏样本 ＋ 24 个好样本）同时喂 `json-core.parseJson` 与这里的 `readJson`，
 * 要求「合法/非法、非法时的行列、解出的值」三件同结论——**两个独立实现同结论才算过**，
 * 不是"复制一份就完事"（先例是 §B 的"与站内旧库对拍"）。
 *
 * ── 两份实现共享的是口径，不是代码 ──
 *
 *  · 深度闸门 `MAX_DEPTH = 1000`：与本文件里写死的字面量同一个数，由 Y2 钉"两本里的数相同"；
 *  · Pointer 转义：`~`→`~0`、`/`→`~1`，**先转 `~` 再转 `/`**（两趟反了会把键名 `~/` 编成 `~0~01`），
 *    由 Y6 逐字符对拍 `json-core.toPointer`、Y7 钉那一种次序唯一能分开的形状；
 *  · 行列口径：`line` 与 `column` 都从 1 起、列数 UTF-16 **码元**（一个 emoji 占两列）、
 *    换行只认 `\n`（CRLF 一行只推进一次）、只容忍头部**一个** BOM、EOF 那一格落在 `text.length`，
 *    全部由 Y1 那 34 格坏样本逐格核过；
 *  · 接受集：只认 JSON——不认 JSON5、注释、`NaN`/`Infinity`、单引号、未加引号的键、裸小数点、
 *    前导零，`1e999` 按 `bad-number` 拒（交出去的值必须还是合法 JSON）。
 *  改一处不改另一处就会红——这是"同一份事实不写第二遍"在无法复用时的替代做法。
 *
 * ── 字节与行数两档闸门不在这里 ──
 *
 * 本文件不复刻第二套 `gate`：那一族只在 `diff-core.js` 有一份，而且**按侧判**（`gate(textA, textB)`），
 * `diffJson` 的第一步就是它。所以 `readJson` 自己不带字节闸门——它被 `diffJson` 调到时那条路上
 * 闸门已经排在前面（Y16 钉的就是"闸门排在读之前，不许先把 5MB 解析完再拒"）。
 *
 * ── 比对口径（§Y 逐条咬，实现不许自创第二套）──
 *
 *  · 对象按**键名**比、键顺序无关；只有顺序不同判 `same-key-order`，不许直接判 `same`（Y3）；
 *  · 数组按**索引**比，不识别移动（Y5：把 `x[3]` 挪到 `x[1]` 会报成其后每一格都变了）；
 *  · 两侧类型档不同单列一档 `type`，并且**不再往里比**（Y4），免得把一处改动报成十几处；
 *    `null` 是一种值，不是一种"没有值"，所以 `null` → `1` 也是 `type`；
 *  · 一侧缺席是一档 `add` / `remove`，**整棵子树只报一格**（Y9）；
 *  · 数字按**值**判（`1` 与 `1.0` 与 `1e0` 同值，Y17），不按字面文本判；
 *  · 变更按**文档顺序**给（同一节点内先 A 侧键序、再 B 侧多出来的键，Y13），同一份输入两次逐格相同；
 *  · `MAX_CHANGES` 只截**列出的**格子，四个计数仍是全量（Y12）——截了列表顺手把总数也截了就是说谎。
 *
 * ── 纯计算 ──
 *
 * 不读任何环境：没有 `window` / `document` / `localStorage` / `process` / `Buffer`，不碰网络。
 * 本仓库的 import 面只有 `diff-core.js` 一本（同一个入口 reach 的两本纯逻辑模块不构成共享 chunk，
 * 门禁④ 数的是产物里的 `import{`），而 Y2 拿源码扫钉"本文件源码里 `json-core` 出现 0 次"。
 * 解析、比对、预览三族全部走**显式栈**：深度闸门是本站自己定的 1000 层，而 V8 的调用栈在千层上下
 * 就要抛 `RangeError: Maximum call stack size exceeded`——那意味着一份合法的深输入会先炸掉我的栈，
 * 再炸用户的页面（而且给不出任何可读错误）。
 *
 * @module dev/js/tools/diff-json.js
 */
import { gate, MAX_INPUT_BYTES, MAX_INPUT_LINES } from './diff-core.js';

/** 本站主动的容器嵌套上限；与 `json-core.js` 的 `MAX_DEPTH` 必须是同一个数（Y2 钉这一格） */
export const MAX_DEPTH = 1000;
/**
 * 一次比对最多**列出**多少格变更。越线只是不再往表里塞，四个计数仍然按全量累加（Y12），
 * 那句 `DIFF_JSON_NOTES.truncated` 负责把"后面还有没列出的"说在页面上——本站的规矩是
 * 真截了就必须明说，不许静默截断（spec §7 最后一列）。
 * 5000 那一档不是拍的：变更表是一行一个 DOM 节点，Task 7 的浏览器核验量的是它在真页面上的成本。
 */
export const MAX_CHANGES = 5000;
/**
 * 每格前后值的紧凑串预算，**含**末尾那一枚省略号。
 * 预览是给人对齐眼睛用的，不是给人复制全文用的——要看全文回文本模式比（那一条有 unified 导出）。
 */
export const PREVIEW_CHARS = 120;

const TAB = 9, LF = 10, CR = 13, SPACE = 32, QUOTE = 34, PLUS = 43, COMMA = 44, MINUS = 45,
  DOT = 46, ZERO = 48, NINE = 57, COLON = 58, BACKSLASH = 92, LB = 91, RB = 93,
  LC = 123, RC = 125, BOM = 0xfeff;
/** 数字记号的**贪婪字符集**：先读满这一串再验语法，于是 `01`、`1.`、`0.1.2` 都指认整记号 */
const NUMBER_CHARS = new Set([PLUS, MINUS, DOT, 0x65, 0x45,
  48, 49, 50, 51, 52, 53, 54, 55, 56, 57]);
const NUMBER_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const ESCAPE_SHORT = new Map([
  ['"', '\\"'], ['\\', '\\\\'], ['\b', '\\b'], ['\f', '\\f'], ['\n', '\\n'], ['\r', '\\r'], ['\t', '\\t'],
]);
const ESCAPE_VALUE = new Map([
  ['"', '"'], ['\\', '\\'], ['/', '/'], ['b', '\b'], ['f', '\f'], ['n', '\n'], ['r', '\r'], ['t', '\t'],
]);
const LITERALS = new Map([[0x74, 'true'], [0x66, 'false'], [0x6e, 'null']]);
const HIGH_SURROGATE = /[\ud800-\udbff]$/;

const isContainer = (v) => v !== null && typeof v === 'object';
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const clip = (token) => (token.length <= 40 ? token : `${token.slice(0, 40)}…`);
const typeName = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

/** 用 `defineProperty` 而不是赋值，`__proto__` 才会落成真属性（与 json-core 同一条：不然一份恶意 JSON 能污染后续所有对象） */
function setOwn(obj, key, value) {
  if (key === '__proto__') {
    Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
  } else obj[key] = value;
}

/**
 * 值 → 本站那六档类型名之一。`absent` 是给"这一侧压根没有这一格"用的第七档，
 * 只在 `aType` / `bType` 里出现，不会从 `typeOf` 出来。
 * @param {unknown} v
 * @returns {string}
 */
function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  const t = typeof v;
  if (t === 'object') return 'object';
  if (t === 'string' || t === 'number' || t === 'boolean') return t;
  return t;
}

const escPointer = (s) => s.replace(/~/g, '~0').replace(/\//g, '~1');

/**
 * 段数组 → RFC 6901 Pointer：`~`→`~0`、`/`→`~1`，空串段就是一格 `/`，根是空串。
 * 转义次序写死成"先 `~` 后 `/`"——反过来的两趟会把键名 `~/` 编成 `~0~01`，
 * 解回去就不是原来那个键了（Y7 拿 `~/` 那一格把两种次序分开）。
 * @param {Array<string|number>} segments
 * @returns {string}
 */
export function pointerOf(segments) {
  if (!Array.isArray(segments)) {
    throw new TypeError(`pointerOf(segments)：segments 必须是数组，这里是 ${typeName(segments)}`);
  }
  let out = '';
  for (const s of segments) out += `/${escPointer(String(s))}`;
  return out;
}

/**
 * 自带的那一份 JSON 读侧：只回"收不收、收的话值是什么、不收的话错在第几行第几列"。
 * 与 `json-core.parseJson` 的三处分歧都是**故意**的，且都不改结论：
 *   1. 不回 `index` / `length` / `snippet`——这一页没有"把病灶高亮进输入框"那一档交互，坏输入的
 *      呈现是一句点名行列的话（spec §5.6 的坏输入态）；位置仍然按同一族口径算，Y1 逐格核。
 *   2. 不回 `duplicateKeys`——重复键在两本里都是"后写的覆盖先写的"，值同结论同；
 *      那一格清单是 JSON 页的活（`CORE_NOTES.dupKey`），这里报第二份只会让两页的说法有机会分叉。
 *   3. 不做字节闸门——见文件头那一格。
 * 入参形状不对才抛 TypeError（那是调用侧的错，不许咽进返回值）。
 * @param {string} text
 * @returns {{ok: true, value: unknown} | {ok: false, kind: string, line: number, column: number, reason: string}}
 */
export function readJson(text) {
  if (typeof text !== 'string') throw new TypeError(`readJson 只收字符串，收到的是 ${typeName(text)}`);
  const n = text.length;

  /**
   * 下标 → 行列，每次调用重扫一遍换行（一次比对最多算一次，坏输入才要位置）。
   * 口径与 `json-core.locate` 同形：换行只认 `\n`，列数码元，越界钳到 `[0, n]`，
   * EOF 那一格的列号 = 最后一行的长度 + 1。
   */
  const locate = (index) => {
    const at = Math.max(0, Math.min(index | 0, n));
    let start = 0;
    let line = 1;
    for (let k = 0; k < at; k++) {
      if (text.charCodeAt(k) !== LF) continue;
      line += 1;
      start = k + 1;
    }
    return { line, column: at - start + 1 };
  };
  const fail = (kind, why, index) => {
    const pos = locate(index);
    return { ok: false, kind, line: pos.line, column: pos.column, reason: `${why}（第 ${pos.line} 行第 ${pos.column} 列）。` };
  };
  const eof = (kind, why) => fail(kind, why, n);
  const here = (index) => {
    const c = text.charCodeAt(index);
    return c >= 0x20 && c !== BOM && c !== BACKSLASH ? `「${text[index]}」` : `U+${c.toString(16).toUpperCase().padStart(4, '0')}`;
  };

  /** 只跳过头部那一个 BOM（从 Windows 文件里粘出来的常见形状）；第二个由调用侧点名 */
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
    if (k + 1 >= n) return { bad: '结尾的反斜杠后面没有内容', index: k };
    const nx = text[k + 1];
    if (nx === 'u') {
      const hex = text.slice(k + 2, k + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) return { bad: '\\u 后面必须是四位十六进制', index: k };
      return { ch: String.fromCharCode(parseInt(hex, 16)), next: k + 6 };
    }
    const value = ESCAPE_VALUE.get(nx);
    if (value === undefined) return { bad: `反斜杠后面的 ${nx} 不是转义字符`, index: k };
    return { ch: value, next: k + 2 };
  };

  /** `from` 指向开引号；返回 `{ok,value,next}` 或 `{bad:{kind,why,index}}` */
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
        if (e.bad) return { bad: { kind: 'bad-escape', why: `不是合法的 JSON 转义序列：${e.bad}`, index: e.index } };
        out += e.ch;
        k = e.next;
        cut = k;
        continue;
      }
      if (c === LF || c === CR) {
        return { bad: { kind: 'unterminated-string', why: `字符串没闭合就遇到了换行，前面还有 ${clip(text.slice(from, Math.min(k, from + 44)))}`, index: k } };
      }
      if (c < 32) {
        return { bad: { kind: 'unexpected-char', why: `字符串里有未转义的控制字符 U+${c.toString(16).toUpperCase().padStart(4, '0')}，要写成 \\n、\\t 或 \\uXXXX`, index: k } };
      }
      k += 1;
    }
    return { bad: { kind: 'unterminated-string', why: '字符串没闭合就到了输入结尾', index: n } };
  };

  const readNumber = (from) => {
    let k = from;
    while (k < n && NUMBER_CHARS.has(text.charCodeAt(k))) k += 1;
    const token = text.slice(from, k);
    if (!NUMBER_RE.test(token)) {
      return { bad: { kind: 'bad-number', why: `数字写法不合法：${clip(token)}（本站只认 JSON 的数字：不许前导零、不许裸小数点、不许 NaN 或 Infinity）`, index: from } };
    }
    const v = Number(token);
    if (!Number.isFinite(v)) {
      return { bad: { kind: 'bad-number', why: `数值超出可表示范围：${clip(token)} 会变成 Infinity，本站不产 Infinity`, index: from } };
    }
    return { ok: true, value: v, next: k };
  };

  const readLiteral = (from) => {
    let k = from;
    while (k < n && text.charCodeAt(k) >= 0x61 && text.charCodeAt(k) <= 0x7a) k += 1;
    const token = text.slice(from, k);
    const want = LITERALS.get(text.charCodeAt(from));
    if (token !== want) {
      return { bad: { kind: 'unexpected-char', why: `${clip(token)} 不是合法的 JSON 值（本站不认 NaN、Infinity、单引号与未加引号的键）`, index: from } };
    }
    return { ok: true, value: want === 'true' ? true : want === 'false' ? false : null, next: k };
  };

  const frames = [];
  let root;
  // 每放一个成员就把这一格的 count 加一：`[]` 与 `[1,]` 的分别全押在这一格上
  // （收尾分支靠 `count === 0` 认"空容器"，不是靠括号后面紧跟的字符）。
  const place = (v) => {
    if (!frames.length) { root = v; return; }
    const f = frames[frames.length - 1];
    f.count += 1;
    if (f.kind === 'arr') { f.node.push(v); return; }
    setOwn(f.node, f.key, v);
  };

  let state = 'value';
  let i = ws(0);
  if (i >= n) return fail('empty', '输入是空的或只有空白字符，没有任何可比对的内容', n);

  for (;;) {
    i = ws(i);
    const top = () => frames[frames.length - 1];

    if (state === 'value') {
      if (i >= n) return eof('unterminated', '这里在等一个值，输入却结束了');
      const c = text.charCodeAt(i);
      if (c === LC || c === LB) {
        if (frames.length + 1 > MAX_DEPTH) {
          return fail('depth', `嵌套深度超出上限：最多 ${MAX_DEPTH} 层，第 ${frames.length + 1} 层的容器出现在这里`, i);
        }
        frames.push({ kind: c === LC ? 'obj' : 'arr', node: c === LC ? {} : [], key: null, count: 0 });
        i += 1;
        state = c === LC ? 'key' : 'value';
        continue;
      }
      if (c === RB && frames.length && top().kind === 'arr' && top().count === 0) {
        const f = frames.pop(); i += 1; place(f.node); state = 'sep'; continue;
      }
      if (c === QUOTE) {
        const s = readString(i);
        if (s.bad) return fail(s.bad.kind, s.bad.why, s.bad.index);
        i = s.next; place(s.value); state = 'sep'; continue;
      }
      if (c === MINUS || (c >= ZERO && c <= NINE)) {
        const num = readNumber(i);
        if (num.bad) return fail(num.bad.kind, num.bad.why, num.bad.index);
        i = num.next; place(num.value); state = 'sep'; continue;
      }
      if (LITERALS.has(c)) {
        const lit = readLiteral(i);
        if (lit.bad) return fail(lit.bad.kind, lit.bad.why, lit.bad.index);
        i = lit.next; place(lit.value); state = 'sep'; continue;
      }
      return fail('unexpected-char', `这里该放一个值，来的是 ${here(i)}（本站只认 JSON，不猜 JSON5 与注释）`, i);
    }

    if (state === 'key') {
      if (i >= n) return eof('unterminated', '这里在等一个键名，输入却结束了');
      const f = top();
      if (text.charCodeAt(i) === RC && f.count === 0) { frames.pop(); i += 1; place(f.node); state = 'sep'; continue; }
      if (text.charCodeAt(i) !== QUOTE) {
        return fail('unexpected-char', `这里该放一个用双引号包起来的键名，来的是 ${here(i)}`, i);
      }
      const s = readString(i);
      if (s.bad) return fail(s.bad.kind, s.bad.why, s.bad.index);
      i = s.next; f.key = s.value; state = 'colon'; continue;
    }

    if (state === 'colon') {
      if (i >= n) return eof('unterminated', '键名读完在等冒号，输入却结束了');
      if (text.charCodeAt(i) !== COLON) {
        return fail('unexpected-char', `键名后面该是冒号，来的是 ${here(i)}`, i);
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
    return fail('unexpected-char', `值读完以后这里该是逗号或收尾的括号，来的是 ${here(i)}`, i);
  }

  const after = ws(i);
  if (after < n) {
    return fail('trailing', `根值已经读完，后面还多出 ${n - after} 个字符，第一个多余的是 ${here(after)}`, after);
  }
  return { ok: true, value: root };
}

/**
 * 值 → 紧凑 JSON 串的前 `PREVIEW_CHARS + 1` 码元（多要那一格只为了判断"到底越没越线"）。
 * 显式栈 + 提前收手：预算只有 120 格，所以一个 5MB 的字符串读到第 120 格上下就停，
 * 而一棵 1000 层的子树也不会因为"先拼完再切"变成七万字符的临时串（Y8 钉的是这两件事）。
 * @param {unknown} value
 * @returns {string|null} 缺席那一格给 `null`，在场的这一格永远给字符串
 */
function previewOf(value) {
  if (value === undefined) return null;
  const limit = PREVIEW_CHARS;
  const hex = (code) => `\\u${code.toString(16).padStart(4, '0')}`;
  /** 转义到 `room` 格就收手；代理对是一起写的，所以这一族自己不会切出孤立代理项 */
  const escapeInto = (text, room) => {
    let out = '';
    for (let k = 0; k < text.length && out.length < room; k++) {
      const short = ESCAPE_SHORT.get(text[k]);
      if (short) { out += short; continue; }
      const code = text.charCodeAt(k);
      if (code < 0x20) { out += hex(code); continue; }
      if (code >= 0xd800 && code <= 0xdfff) {
        const next = k + 1 < text.length ? text.charCodeAt(k + 1) : -1;
        if (code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { out += text[k] + text[k + 1]; k += 1; continue; }
        out += hex(code);
        continue;
      }
      out += text[k];
    }
    return out;
  };
  const chunks = [];
  let size = 0;
  const write = (s) => { chunks.push(s); size += s.length; };
  const leaf = (v) => {
    const t = typeof v;
    if (t === 'string') { write(`"${escapeInto(v, limit + 2 - size)}"`); return; }
    write(v === null ? 'null' : String(v));
  };
  const open = (v) => {
    if (!isContainer(v)) { leaf(v); return null; }
    const isArr = Array.isArray(v);
    write(isArr ? '[' : '{');
    return { v, isArr, keys: isArr ? null : Object.keys(v), i: 0, first: true };
  };
  const rootFrame = open(value);
  const stack = rootFrame ? [rootFrame] : [];
  while (stack.length && size <= limit + 1) {
    const f = stack[stack.length - 1];
    const len = f.isArr ? f.v.length : f.keys.length;
    if (f.i >= len) { write(f.isArr ? ']' : '}'); stack.pop(); continue; }
    const key = f.isArr ? null : f.keys[f.i];
    const child = f.isArr ? f.v[f.i] : f.v[key];
    f.i += 1;
    if (!f.first) write(',');
    f.first = false;
    if (!f.isArr) write(`"${escapeInto(key, limit + 2 - size)}":`);
    const frame = open(child);
    if (frame) stack.push(frame);
  }
  const raw = chunks.join('');
  if (raw.length <= limit) return raw;
  let cut = raw.slice(0, limit - 1);
  if (HIGH_SURROGATE.test(cut)) cut = cut.slice(0, -1);   // 切点落在代理对中间：退回去，交出去的才还是合法 JSON
  return `${cut}…`;
}

/** 坏输入那一档的统计形状：六个数全 0，而不是"没有这一格"（与 §X 的 `emptyStats` 同一形状） */
function emptyStats() {
  return { add: 0, remove: 0, change: 0, type: 0, compared: 0, depth: 0 };
}

/** 闸门不过时那一句：上限与实测都给，谁超了点谁，两侧都超就说"两侧" */
function gateReason(g) {
  const sides = (hitA, hitB) => (hitA && hitB ? '两侧' : hitA ? 'A 侧' : 'B 侧');
  if (g.reason === 'bytes') {
    const bytes = (which) => (which === 'a' ? g.a.bytes : g.b.bytes);
    const over = (which) => (which === 'a' ? g.over.bytesA : g.over.bytesB);
    const side = sides(g.which === 'a' || g.which === 'both', g.which === 'b' || g.which === 'both');
    const worst = g.which === 'b' ? 'b' : 'a';
    return `${side}输入超出上限：最多 ${MAX_INPUT_BYTES} 字节，实测 ${bytes(worst)} 字节`
      + `（超出 ${over(worst)} 字节）。本站不做截断，请删减后再比，或改用文本模式看差异。`;
  }
  const side = sides(g.which === 'a' || g.which === 'both', g.which === 'b' || g.which === 'both');
  const worst = g.which === 'b' ? 'b' : 'a';
  const count = worst === 'a' ? g.a.count : g.b.count;
  const over = worst === 'a' ? g.over.linesA : g.over.linesB;
  return `${side}行数超出上限：最多 ${MAX_INPUT_LINES} 行，实测 ${count} 行（超出 ${over} 行）。`
    + '本站不做截断，请删减后再比。';
}

/**
 * 主入口：两侧都合法才比；闸门排在读之前；坏的那一侧点名给行列。
 *
 * 遍历走**显式栈的先序**：一个节点把自己的子格（在场的进比对、缺席的进 `add`/`remove`）
 * 整批压栈，于是弹出顺序就是文档顺序——变更表的顺序是用户读的那一列，
 * 不能由栈的进出次序决定（Y13 钉这一格）。`stats` 的六个数按**全量**累加，
 * 与 `changes.length` 卡在 `MAX_CHANGES` 上是两件事（Y12）。
 * @param {string} textA 左侧全文（一份 JSON）
 * @param {string} textB 右侧全文（一份 JSON）
 * @returns {{verdict: string, changes: Array<object>, stats: object, truncated: boolean, error: (null|object)}}
 */
export function diffJson(textA, textB) {
  const at = 'diffJson(textA, textB)';
  if (typeof textA !== 'string') throw new TypeError(`${at}：textA 必须是字符串，这里是 ${typeName(textA)}`);
  if (typeof textB !== 'string') throw new TypeError(`${at}：textB 必须是字符串，这里是 ${typeName(textB)}`);

  const g = gate(textA, textB);
  if (!g.ok) {
    return { verdict: 'invalid', changes: [], stats: emptyStats(), truncated: false, error: { which: g.which, line: null, column: null, reason: gateReason(g) } };
  }
  const ra = readJson(textA);
  const rb = readJson(textB);
  if (!ra.ok || !rb.ok) {
    const which = !ra.ok && !rb.ok ? 'both' : ra.ok ? 'b' : 'a';
    const first = ra.ok ? rb : ra;
    const reason = which === 'both'
      ? `A 侧：${ra.reason}｜B 侧同样不合法：${rb.reason}`
      : first.reason;
    return {
      verdict: 'invalid', changes: [], stats: emptyStats(), truncated: false,
      error: { which, line: first.line, column: first.column, reason },
    };
  }

  const changes = [];
  const stats = emptyStats();
  let keyOrderDiffers = false;
  let truncated = false;

  const emit = (kind, pointer, owner, depth, a, b) => {
    stats[kind] += 1;
    if (changes.length >= MAX_CHANGES) { truncated = true; return; }
    changes.push({
      pointer, kind, owner, depth,
      aPreview: previewOf(a), bPreview: previewOf(b),
      aType: a === undefined ? 'absent' : typeOf(a),
      bType: b === undefined ? 'absent' : typeOf(b),
    });
  };

  const stack = [{ a: ra.value, b: rb.value, pointer: '', depth: 0 }];
  while (stack.length) {
    const item = stack.pop();
    const { a, b, pointer, depth } = item;
    if (item.only) {
      if (item.only === 'a') emit('remove', pointer, 'only-a', depth, a, undefined);
      else emit('add', pointer, 'only-b', depth, undefined, b);
      continue;
    }
    stats.compared += 1;
    if (depth > stats.depth) stats.depth = depth;
    const ta = typeOf(a);
    const tb = typeOf(b);
    if (ta !== tb) { emit('type', pointer, 'both', depth, a, b); continue; }
    if (ta === 'object' || ta === 'array') {
      const isArr = ta === 'array';
      const keysA = isArr ? null : Object.keys(a);
      const keysB = isArr ? null : Object.keys(b);
      const lenA = isArr ? a.length : keysA.length;
      const lenB = isArr ? b.length : keysB.length;
      /** 子格清单先按顺序攒齐，再整批**倒着**压栈——弹出顺序就是攒的顺序 */
      const kids = [];
      if (isArr) {
        const min = Math.min(lenA, lenB);
        for (let idx = 0; idx < min; idx++) kids.push({ a: a[idx], b: b[idx], pointer: `${pointer}/${idx}`, depth: depth + 1 });
        for (let idx = min; idx < lenA; idx++) kids.push({ a: a[idx], only: 'a', pointer: `${pointer}/${idx}`, depth: depth + 1 });
        for (let idx = min; idx < lenB; idx++) kids.push({ b: b[idx], only: 'b', pointer: `${pointer}/${idx}`, depth: depth + 1 });
      } else {
        const inB = new Set(keysB);
        let sameOrder = lenA === lenB;
        if (sameOrder) {
          for (let k = 0; k < lenA; k++) if (keysA[k] !== keysB[k]) { sameOrder = false; break; }
        }
        for (const key of keysA) {
          const childPointer = `${pointer}/${escPointer(key)}`;
          if (inB.has(key)) kids.push({ a: a[key], b: b[key], pointer: childPointer, depth: depth + 1 });
          else kids.push({ a: a[key], only: 'a', pointer: childPointer, depth: depth + 1 });
        }
        for (const key of keysB) {
          if (hasOwn(a, key)) continue;
          kids.push({ b: b[key], only: 'b', pointer: `${pointer}/${escPointer(key)}`, depth: depth + 1 });
        }
        // 键集合相同而书写次序不同：这是"值相同"里唯一会说谎的那一格（Y3）
        if (!sameOrder && keysA.every((k) => inB.has(k)) && keysB.every((k) => hasOwn(a, k))) keyOrderDiffers = true;
      }
      for (let k = kids.length - 1; k >= 0; k--) stack.push(kids[k]);
      continue;
    }
    if (a !== b) emit('change', pointer, 'both', depth, a, b);
  }

  const total = stats.add + stats.remove + stats.change + stats.type;
  return {
    verdict: total === 0 ? (keyOrderDiffers ? 'same-key-order' : 'same') : 'diff',
    changes,
    stats,
    truncated,
    error: null,
  };
}

/**
 * 面板上那六句人话。每句都带自己那个数（Y18 逐句钉），因为它们写的是"这一页给的结果
 * 在哪一档上打了折"——降级、截断、不识别这三族在本页各有一档，用户有权知道。
 * `renderJsonTable` 把它们与原样拼进表尾（Task 4 接 Y18 的第二半）。
 */
export const DIFF_JSON_NOTES = {
  keyOrder: '键顺序无关：同一层里键的书写次序不同、值全都对得上，这一格不算变更，结论写「按 JSON 值判为相同」'
    + '而不是「完全相同」。要连书写次序一起比，请改用文本模式比对。',
  arrayMove: '数组按索引逐格比对，不识别移动：把某个元素挪到别的位置，报出来的是它后面每一格都变了。'
    + '识别移动要另一套对齐算法，而且"哪一格是移动来的"本身没有唯一答案，所以这一页不猜。',
  typeChange: '类型变化单独一档：同一格从数字变字符串、对象变数组都记为「类型变」，不与「值变了」混在同一个数里；'
    + '类型不同的那一格不再往里比，免得把一处改动报成十几处。',
  truncated: `变更表最多列出 ${MAX_CHANGES} 格，越线只截列表——上面那四个计数仍是全量，`
    + '没列出来的差额照样存在，本站不做静默截断。要看全量请改用文本模式比对。',
  depth: `容器嵌套上限是 ${MAX_DEPTH} 层，越线整份拒并点名出现在第几列；`
    + '比对走的是显式栈，所以 1000 层的合法输入照样比得完、比得对。',
  previewCut: `每格前后值的紧凑串最长 ${PREVIEW_CHARS} 个字符（含末尾那枚省略号），超出切一刀；`
    + '切点不会把 emoji 切成半个。要看某一格的全文请回文本模式比，那一条有可复制的统一差异。',
};
