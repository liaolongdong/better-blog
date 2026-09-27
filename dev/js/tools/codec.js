/**
 * Base64（UTF-8）与 URL 编解码：编码工具箱页四间格子（Base64 / data URI / URL / query）共用的纯逻辑。
 *
 * 这一格有三条不许让步的规矩，整套判据（§L）都是围着它们写的：
 *
 * 1. **不用运行时的编解码快捷方式**。浏览器侧没有 `Buffer`，而 `atob` / `btoa` 走的是 latin1
 *    字节序（`btoa('中')` 直接抛）、`TextEncoder` 又会把落单代理项**静默**换成 U+FFFD（实测
 *    `new TextEncoder().encode('\uD83D')` → `239,191,189`）。所以 UTF-8 与 Base64 全部自己实现，
 *    判据拿 Node 的 `Buffer` 当外部对拍源（L1、L2、L11、L13 四处），而不是把自己的输出当标准。
 * 2. **拒绝就给理由，位置算得出来**。`decodeURIComponent('%E4%B8')` 只会抛一句 `URIError: URI malformed`，
 *    面板拿它没法告诉用户"哪里坏了"。所以解码侧一律走自己的扫描器：语法错报**字符位**
 *    （"第 N 位的百分号…"），字节流错报**字节位**（"第 N 字节不是合法 UTF-8"），两类口径不混（L12）。
 * 3. **不静默补、不静默截**。缺的尾部 padding 补齐之后要在 `paddingImplied` 里说补了几位；
 *    剥掉的空白在 `whitespaceDropped` 里计数；超过 1 MiB 的输入整体拒绝且 `out` 必须是空串
 *    （半截产物比报错更坏，用户会拿它继续用）。
 *
 * 与 `idcard.js` / `bankcard.js` / `phone.js` / `uscc.js` / `time.js` 同一套约定：纯函数、不碰 DOM、
 * 同级工具模块互不 import（`shapeOf` 因此是第三份拷贝，代价由 L15 对着 `time.js` 与 `uscc.js` 核一次），
 * 并且**两档入参两种处理**：
 *   - **文本入参**照兄弟模块那句 `String(text === null || text === undefined ? '' : text)`，
 *     `null` / `undefined` 归一成空、其余 `String()` 之后再判形状，一律不抛；唯一例外还是无原型对象
 *     （`String()` 自己抛 `TypeError`，本站不替它兜，L15 逐入口钉）。
 *   - **options 入参**（`decodeBase64` 的 `{strict}`）与 `mime` 的形状档才是闸门：
 *     options 只收对象与 `null`/`undefined`，键名拼错必须响——静默当默认等于用户的 `strict` 白开了。
 *
 * 可复算口径：本文件所有硬编码期望值都能用 Node 独立复算，例如
 * `Buffer.from('中文','utf8').toString('base64')` → `5Lit5paH`、`Buffer.from('😀').toString('base64')`
 * → `8J+YgA==`、`Buffer.from('YR','base64').toString('hex')` → `61`（尾部填充比特两档都不校验，
 * 与 Node 的解码器同档；这一条由 L4 钉住，免得后来人"顺手"加一道非规范检查）。
 * `MAX_INPUT_BYTES` 就是 §7 表里"文本类工具 1MB"那一行，取 1 MiB = 1,048,576 字节。
 */

/** 输入闸门（字节）：`超过`才拒，正好 1 MiB 放行；面板上的"多少字节"与这道闸门共用 `byteLen` 这一把尺子 */
export const MAX_INPUT_BYTES = 1048576;

/** 一行的口径说明，面板原样显示（与 `TIME_CAVEAT` 同一角色，逐条对账由 L17 守着） */
export const BASE64_CAVEAT =
  'Base64 一律按 UTF-8 字节编解码。解码默认宽容档：剥掉空白并报告处数，缺的尾部 padding 补齐并注明补了几位；'
  + '字母表外的字符、长度不合法、解出的字节不是合法 UTF-8，三类都按位置拒绝、不给半截产物；'
  + '超过 1 MiB（1048576 字节）整体拒绝、不截断。';

/** 同上，管 URL 那一格：两档并列、`+` 的口径、query 的切分规则都在这里说明白 */
export const URL_CAVEAT =
  'URL 编码并列给出 encodeURI 与 encodeURIComponent 两档，两者对 18 个保留字符的处理不同。'
  + '解码只认百分号序列，「+」不当作空格；query 只按「&」切分，「;」不切，键与值只在第一个「=」处切一次；'
  + '单项解不开时保留原文并标注哪一档失败；超过 1 MiB（1048576 字节）整体拒绝、不截断。';

/** 标准字母表（含 `+` `/`）；URL 安全变体不在本模块，别在这一格悄悄换表 */
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** 字符 → 6 位值：`indexOf` 每次最多扫 64 个字符，长输入下是个不必要的常数因子 */
const BASE64_VALUE = new Map([...BASE64_ALPHABET].map((ch, i) => [ch, i]));
/** RFC 3986 的 mime `type/subtype`：够窄，`text plain` 这种带空格的必须响 */
const MIME_SHAPE = /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*$/;
/** 代理区两头的边界：编码侧先扫这一档，才谈得上"不静默替换" */
const SUR_HIGH_LO = 0xD800; const SUR_HIGH_HI = 0xDBFF;
const SUR_LOW_LO = 0xDC00; const SUR_LOW_HI = 0xDFFF;
/** ASCII 空白：刻意不用 `\s`，那是连 U+00A0、U+3000 都算的另一档口径 */
const ASCII_WS = /[ \t\n\r\f\v]/;
/** 上一档的全局版，只给 `match` / `replace` 用（这俩会自己把 `lastIndex` 归零，所以能共用一个实例） */
const ASCII_WS_G = /[ \t\n\r\f\v]/g;

/** 越界那一句要复用，理由里点名实测字节与上限（L8） */
const overLimit = (n) => `输入 ${n} 字节，超过 ${MAX_INPUT_BYTES} 字节上限（1 MiB），整体拒绝、不截断`;

/** 文本入参归一：与 `idcard.js` 那句同档，无原型对象由 `String()` 自己抛 */
const toText = (v) => String(v === null || v === undefined ? '' : v);

/**
 * 报错消息里的值回显。与 `time.js`、`uscc.js` 各自的实现同一份口径，
 * 三处任何一处改动都会被 L15 与 K12 分别抓到。
 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (typeof v === 'object') return v instanceof Date ? 'Date' : 'object';
  return typeof v;
}

/** 找落单代理项，返回 1-based 字符位；干净就返回 0（L3、L12 末段、L13 都靠这一档） */
function loneSurrogateAt(text) {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= SUR_HIGH_LO && code <= SUR_HIGH_HI) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (next < SUR_LOW_LO || next > SUR_LOW_HI) return i + 1;
      i += 1;
    } else if (code >= SUR_LOW_LO && code <= SUR_LOW_HI) {
      return i + 1;
    }
  }
  return 0;
}

/** UTF-8 字节数：闸门与面板计数都用它。落单代理项按 3 字节计——它反正会在下一档被拒 */
function utf8Len(text) {
  let n = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) n += 1;
    else if (code < 0x800) n += 2;
    else if (code >= SUR_HIGH_LO && code <= SUR_HIGH_HI) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (next >= SUR_LOW_LO && next <= SUR_LOW_HI) { n += 4; i += 1; } else n += 3;
    } else n += 3;
  }
  return n;
}

/** 字符串 → 字节数组（调用方必须先过 `loneSurrogateAt`，否则这里会把半代理项当三字节写出去） */
function utf8Write(text) {
  const out = [];
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
    else if (code >= SUR_HIGH_LO && code <= SUR_HIGH_HI) {
      const cp = 0x10000 + ((code - SUR_HIGH_LO) << 10) + (text.charCodeAt(i + 1) - SUR_LOW_LO);
      out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
      i += 1;
    } else out.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
  }
  return out;
}

/**
 * 字节数组 → 字符串，并在校验失败时给出**1-based 字节位**。
 * 口径照 WHATWG 的 UTF-8 解码器：拒绝过短序列（`0xC0`/`0xC1`）、代理区编码（`ED A0 80`）
 * 与超出 `U+10FFFF` 的序列（`F5`–`FF`）。不产出 U+FFFD——那是"把坏数据洗成能看"的另一件事。
 */
function utf8Read(bytes) {
  const parts = [];
  let i = 0;
  while (i < bytes.length) {
    const lead = bytes[i];
    let need; let cp; let lo; let hi;
    if (lead < 0x80) { parts.push(String.fromCodePoint(lead)); i += 1; continue; }
    else if (lead >= 0xC2 && lead <= 0xDF) { need = 1; cp = lead & 0x1F; lo = 0x80; hi = 0xBF; }
    else if (lead === 0xE0) { need = 2; cp = lead & 0x0F; lo = 0xA0; hi = 0xBF; }
    else if (lead >= 0xE1 && lead <= 0xEC) { need = 2; cp = lead & 0x0F; lo = 0x80; hi = 0xBF; }
    else if (lead === 0xED) { need = 2; cp = lead & 0x0F; lo = 0x80; hi = 0x9F; }
    else if (lead >= 0xEE && lead <= 0xEF) { need = 2; cp = lead & 0x0F; lo = 0x80; hi = 0xBF; }
    else if (lead === 0xF0) { need = 3; cp = lead & 0x07; lo = 0x90; hi = 0xBF; }
    else if (lead >= 0xF1 && lead <= 0xF3) { need = 3; cp = lead & 0x07; lo = 0x80; hi = 0xBF; }
    else if (lead === 0xF4) { need = 3; cp = lead & 0x07; lo = 0x80; hi = 0x8F; }
    else return { ok: false, text: '', badAt: i + 1 };
    for (let k = 1; k <= need; k += 1) {
      const cont = i + k < bytes.length ? bytes[i + k] : -1;
      if (cont < lo || cont > hi) return { ok: false, text: '', badAt: i + 1 };
      cp = (cp << 6) | (cont & 0x3F);
      lo = 0x80; hi = 0xBF;
    }
    parts.push(String.fromCodePoint(cp));
    i += need + 1;
  }
  return { ok: true, text: parts.join(''), badAt: 0 };
}

/** 三字节一组，尾部按 1/2 字节补 4 位与 1–2 个 `=`：与 Node 的规范输出逐字符一致（L1） */
function b64FromBytes(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const has1 = i + 1 < bytes.length;
    const has2 = i + 2 < bytes.length;
    const b1 = has1 ? bytes[i + 1] : 0;
    const b2 = has2 ? bytes[i + 2] : 0;
    out += BASE64_ALPHABET[b0 >> 2]
      + BASE64_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)]
      + (has1 ? BASE64_ALPHABET[((b1 & 0x0F) << 2) | (b2 >> 6)] : '=')
      + (has2 ? BASE64_ALPHABET[b2 & 0x3F] : '=');
  }
  return out;
}

/** 4 位一组还原；尾部那 2 位或 4 位填充比**不校验**（L4 钉住这一档，与 Node 的解码器同档） */
function b64ToBytes(core) {
  const out = [];
  const full = core.length - (core.length % 4);
  for (let i = 0; i < full; i += 4) {
    const a = BASE64_VALUE.get(core[i]);
    const b = BASE64_VALUE.get(core[i + 1]);
    const c = BASE64_VALUE.get(core[i + 2]);
    const d = BASE64_VALUE.get(core[i + 3]);
    out.push((a << 2) | (b >> 4), ((b & 0x0F) << 4) | (c >> 2), ((c & 0x03) << 6) | d);
  }
  const rem = core.length % 4;
  if (rem >= 2) {
    const a = BASE64_VALUE.get(core[full]);
    const b = BASE64_VALUE.get(core[full + 1]);
    out.push((a << 2) | (b >> 4));
    if (rem === 3) out.push(((b & 0x0F) << 4) | (BASE64_VALUE.get(core[full + 2]) >> 2));
  }
  return out;
}

/**
 * 百分号解码 + 计数，返回**字符位**或**字节位**两档之一的理由。
 * 不用 `decodeURIComponent` 出结果：它只会抛 `URIError: URI malformed`，位置信息全丢（规矩 2）。
 * `+` 一律原样保留——它在 form 编码里是空格，在 URI 里不是，本模块不替用户猜（URL_CAVEAT 里那句）。
 */
function pctDecode(raw) {
  const inBytes = utf8Len(raw);
  if (inBytes > MAX_INPUT_BYTES) return { ok: false, text: '', hits: 0, reason: overLimit(inBytes) };
  const lone = loneSurrogateAt(raw);
  if (lone > 0) {
    return { ok: false, text: '', hits: 0, reason: `第 ${lone} 位是落单代理项（半个 emoji），UTF-8 里不存在` };
  }
  const bytes = [];
  let hits = 0;
  let i = 0;
  while (i < raw.length) {
    const pct = raw.indexOf('%', i);
    if (pct < 0) {
      for (const b of utf8Write(raw.slice(i))) bytes.push(b);
      break;
    }
    if (pct > i) {
      // 字面量整段一次编码：一个字符一个字符地走会把代理对劈成两半，各半都是"非法 UTF-8"
      for (const b of utf8Write(raw.slice(i, pct))) bytes.push(b);
    }
    const hex = raw.slice(pct + 1, pct + 3);
    if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
      return { ok: false, text: '', hits, reason: `第 ${pct + 1} 位的百分号「%」后面必须紧跟两位十六进制数字（如 %20）` };
    }
    bytes.push(Number.parseInt(hex, 16));
    hits += 1;
    i = pct + 3;
  }
  const dec = utf8Read(bytes);
  if (!dec.ok) return { ok: false, text: '', hits, reason: `第 ${dec.badAt} 字节不是合法 UTF-8（百分号序列解出的字节流）` };
  return { ok: true, text: dec.text, hits, reason: null };
}

/**
 * 字符串 → Base64。先过字节闸门，再过代理项档，最后才动手编码：
 * 顺序反了会让"1 MiB 的半截 emoji"报成"越界"，用户看着像被截断了。
 */
export function encodeBase64(text) {
  const s = toText(text);
  const bytes = utf8Len(s);
  if (bytes > MAX_INPUT_BYTES) return { ok: false, out: '', bytes, reason: overLimit(bytes) };
  const lone = loneSurrogateAt(s);
  if (lone > 0) {
    return { ok: false, out: '', bytes, reason: `第 ${lone} 位是落单代理项（半个 emoji），Base64 无法表示` };
  }
  return { ok: true, out: b64FromBytes(utf8Write(s)), bytes, reason: null };
}

/** 结果外壳：`out` 与三个计数字段在所有分支都齐活，面板才不必为失败档准备另一套绑定 */
const b64Result = (ok, out, strict, reason, whitespaceDropped, paddingDropped, paddingImplied, badAt) =>
  ({ ok, out, strict, reason, whitespaceDropped, paddingDropped, paddingImplied, badAt });

/** 尾部连同一个字符的个数（只用来数 `=`，别拿它当通用的 run 压缩） */
const trailingRun = (s, ch) => {
  let n = 0;
  while (n < s.length && s[s.length - 1 - n] === ch) n += 1;
  return n;
};
const firstAsciiWs = (s) => {
  for (let i = 0; i < s.length; i += 1) if (ASCII_WS.test(s[i])) return i + 1;
  return 0;
};
const countAsciiWs = (s) => (s.match(ASCII_WS_G) || []).length;
const stripAsciiWs = (s) => s.replace(ASCII_WS_G, '');
/** 报错与消息里的字符回显：按码点取，代理对不会被劈成两半 */
const showChar = (s, i) => String.fromCodePoint(s.codePointAt(i));

/** `decodeBase64` 的 options 档：只认 `{strict}`，键名拼错必须响——静默当默认等于用户的 strict 白开了 */
function readStrictOption(fn, options) {
  if (options === null || options === undefined) return false;
  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError(`${fn} 的 options 应为对象，收到 ${shapeOf(options)}`);
  }
  for (const key of Object.keys(options)) {
    if (key !== 'strict') {
      throw new TypeError(`${fn} 收到未知 options 键「${key}」（可用键只有 strict）`);
    }
  }
  if (options.strict === undefined) return false;
  if (typeof options.strict !== 'boolean') {
    throw new TypeError(`${fn} 的 options.strict 应为布尔，收到 ${shapeOf(options.strict)}`);
  }
  return options.strict;
}

/**
 * Base64 → 字符串。两档口径分开（L4、L5）：
 *   - `strict: true` 照 MIME 之外的"规范串"要求：不许空白、总长度必须是 4 的倍数、`=` 的个数必须配余数；
 *   - 默认宽容档剥 ASCII 空白并计数、缺的 padding 补齐并在 `paddingImplied` 里说补了几位。
 * 尾部那几位填充比两档都不校验：Node 的解码器同样忽略（`'YR'` 与 `'YQ'` 都解出 `'a'`），
 * 加一道非规范检查只会让 L1 的往返样本莫名其妙少一条。
 */
export function decodeBase64(text, options) {
  const strict = readStrictOption('decodeBase64', options);
  const raw = toText(text);
  let body = raw;
  let whitespaceDropped = 0;
  if (strict) {
    const at = firstAsciiWs(raw);
    if (at > 0) return b64Result(false, '', true, `strict 档不接受空白（第 ${at} 位）`, 0, 0, 0, at);
  } else {
    whitespaceDropped = countAsciiWs(raw);
    body = stripAsciiWs(raw);
  }
  const padRun = trailingRun(body, '=');
  const coreEnd = body.length - padRun;
  for (let i = 0; i < coreEnd; i += 1) {
    if (!BASE64_VALUE.has(body[i])) {
      const why = `第 ${i + 1} 位字符「${showChar(body, i)}」不在 Base64 字母表`;
      return b64Result(false, '', strict, why, whitespaceDropped, 0, 0, i + 1);
    }
  }
  if (padRun > 2) {
    const at = coreEnd + 3;
    const why = `第 ${at} 位字符「=」不在 Base64 字母表（尾部 padding 最多两个「=」）`;
    return b64Result(false, '', strict, why, whitespaceDropped, 0, 0, at);
  }
  const rem = coreEnd % 4;
  if (rem === 1) {
    const why = `长度不合法：去掉尾部「=」剩 ${coreEnd} 位，Base64 的位数不可能余 1`;
    return b64Result(false, '', strict, why, whitespaceDropped, padRun, 0, 0);
  }
  const expected = rem === 2 ? 2 : rem === 3 ? 1 : 0;
  if (strict && padRun === 0 && rem !== 0) {
    const why = `长度不合法：strict 档要求总长度是 4 的倍数（实际 ${body.length} 位）`;
    return b64Result(false, '', true, why, 0, 0, 0, 0);
  }
  if (strict && padRun !== expected) {
    const why = `padding 与载荷位数不配：剩 ${rem} 位应配 ${expected} 个「=」，实际 ${padRun} 个`;
    return b64Result(false, '', true, why, 0, padRun, 0, 0);
  }
  const bytes = b64ToBytes(body.slice(0, coreEnd));
  if (bytes.length > MAX_INPUT_BYTES) {
    return b64Result(false, '', strict, overLimit(bytes.length), whitespaceDropped, padRun, 0, 0);
  }
  const dec = utf8Read(bytes);
  if (!dec.ok) {
    const why = `第 ${dec.badAt} 字节不是合法 UTF-8（Base64 解出的字节流）`;
    return b64Result(false, '', strict, why, whitespaceDropped, padRun, 0, 0);
  }
  const paddingImplied = Math.max(0, expected - padRun);
  return b64Result(true, dec.text, strict, null, whitespaceDropped, padRun, paddingImplied, 0);
}

/** 入参的 UTF-8 字节数：闸门用的就是这一把尺子，面板上"多少字节"也必须读它，别量字符数 */
export function byteLen(text) { return utf8Len(toText(text)); }

/**
 * 文本 → data URI（`charset=utf-8` + Base64 载荷）。
 * 空载荷在编码侧就拒：`data:text/plain;charset=utf-8;base64,` 这种一串"看着成功其实没内容"，
 * 用户复制过去只会拿到空文件（L10b 把两侧同档钉住）。
 */
export function encodeDataUri(text, mime) {
  const s = toText(text);
  const m = mime === null || mime === undefined ? 'text/plain' : toText(mime);
  if (!MIME_SHAPE.test(m)) {
    return { ok: false, out: '', bytes: 0, reason: `mime 形状不合法：应为 type/subtype，实际「${m}」` };
  }
  if (s === '') return { ok: false, out: '', bytes: 0, reason: '载荷为空：空文本不该包装成 data URI' };
  const enc = encodeBase64(s);
  if (!enc.ok) return { ok: false, out: '', bytes: enc.bytes, reason: enc.reason };
  return { ok: true, out: `data:${m};charset=utf-8;base64,${enc.out}`, bytes: enc.bytes, reason: null };
}

/** 解码结果外壳：七个描述字段在所有分支都齐活，失败时也有"我读到了什么"可展示 */
const dataUriResult = (ok, reason, mime, charset, mimeDefaulted, charsetDefaulted, isBase64,
  data, percentHits, whitespaceDropped, paddingImplied) =>
  ({ ok, reason, mime, charset, mimeDefaulted, charsetDefaulted, isBase64,
    data, percentHits, whitespaceDropped, paddingImplied });

/**
 * data URI → 结构化结果。声明了非 UTF-8 的 `charset` 一律拒绝：本模块只有 UTF-8 一条路，
 * 假装按 UTF-8 解出"能看的东西"是最坏的一种成功（L9）。
 */
export function decodeDataUri(text) {
  const s = toText(text);
  const blank = dataUriResult(false, '', '', '', false, false, false, '', 0, 0, 0);
  if (!/^data:/i.test(s)) return { ...blank, reason: '不是 data URI：要以 data: 开头' };
  const comma = s.indexOf(',');
  if (comma < 0) {
    return { ...blank, reason: '缺载荷分隔逗号：格式是 data:<mime>[;charset=…][;base64],<载荷>' };
  }
  const parts = s.slice(5, comma).split(';');
  let mime = parts[0];
  let charset = '';
  let isBase64 = false;
  for (const param of parts.slice(1)) {
    const one = param.trim();
    if (/^base64$/i.test(one)) { isBase64 = true; continue; }
    const eq = one.indexOf('=');
    if (eq > 0 && one.slice(0, eq).trim().toLowerCase() === 'charset') charset = one.slice(eq + 1).trim();
  }
  const mimeDefaulted = mime === '';
  if (mimeDefaulted) mime = 'text/plain';
  const charsetDefaulted = charset === '';
  if (!charsetDefaulted) {
    const norm = charset.toLowerCase();
    if (norm !== 'utf-8' && norm !== 'utf8') {
      const why = `charset 只支持 utf-8，声明的是「${charset}」，本模块不替它按 UTF-8 猜`;
      return { ...blank, mime, charset: '', mimeDefaulted, reason: why };
    }
    charset = 'utf-8';
  } else charset = 'utf-8';
  const payload = s.slice(comma + 1);
  const shape = { mime, charset, mimeDefaulted, charsetDefaulted, isBase64 };
  if (payload === '') {
    return { ...blank, ...shape, reason: '载荷为空：逗号后面什么都没有' };
  }
  if (isBase64) {
    const b = decodeBase64(payload);
    if (!b.ok) return { ...blank, ...shape, whitespaceDropped: b.whitespaceDropped, paddingImplied: b.paddingImplied, reason: `载荷不是合法 Base64：${b.reason}` };
    return { ...shape, ok: true, reason: null, data: b.out, percentHits: 0,
      whitespaceDropped: b.whitespaceDropped, paddingImplied: b.paddingImplied };
  }
  const p = pctDecode(payload);
  if (!p.ok) return { ...blank, ...shape, percentHits: p.hits, reason: `载荷里的百分号序列不合法：${p.reason}` };
  return { ...shape, ok: true, reason: null, data: p.text, percentHits: p.hits,
    whitespaceDropped: 0, paddingImplied: 0 };
}

/**
 * 编码侧共用那一档：字节闸门 → 落单代理项 → 才交给原生 `encodeURI` / `encodeURIComponent`。
 * 原生这两个函数是纯函数、不读运行环境（L16 只禁 DOM 与时钟），而且 L11 要的就是"与原生逐字符一致"，
 * 自己另写一张不需编码字符表只会多一处会写错的地方。
 */
function uriEncode(text, keepReserved) {
  const s = toText(text);
  const bytes = utf8Len(s);
  if (bytes > MAX_INPUT_BYTES) return { ok: false, out: '', bytes, reason: overLimit(bytes) };
  const lone = loneSurrogateAt(s);
  if (lone > 0) {
    return { ok: false, out: '', bytes, reason: `第 ${lone} 位是落单代理项（半个 emoji），URL 编码无法表示` };
  }
  return { ok: true, out: keepReserved ? encodeURI(s) : encodeURIComponent(s), bytes, reason: null };
}

/** `encodeURI` 档：保留字符原样留着，适合"整条 URL" */
export function encodeUrl(text) { return uriEncode(text, true); }

/** `encodeURIComponent` 档：连 `:/?#[]@` 一起编掉，适合"URL 里的一段" */
export function encodeUrlComponent(text) { return uriEncode(text, false); }

/** 百分号解码（含逐字符位/字节位的理由）：`+` 原样保留，不当空格 */
export function decodeUrlComponent(text) {
  const p = pctDecode(toText(text));
  return p.ok ? { ok: true, out: p.text, reason: null } : { ok: false, out: '', reason: p.reason };
}

/** 面板上"这一档解不开"的那一格：解得开就用原生结果，解不开才动用扫描器换位置信息 */
function tryDecode(field, raw, refusedReason) {
  if (refusedReason !== null) {
    return { field, ok: false, out: '', reason: refusedReason };
  }
  const native = field === 'decodeURI' ? decodeURI : decodeURIComponent;
  try {
    return { field, ok: true, out: native(raw), reason: null };
  } catch {
    return { field, ok: false, out: '', reason: pctDecode(raw).reason };
  }
}

/**
 * 一屏摆四格：两档编码 + 两档解码。§5.2 要的就是"并列展示"，让用户自己看见 `:` 在一档里是 `:`、
 * 在另一档里是 `%3A`。闸门越界时四格一起停且共用同一句理由（L13），免得面板写出两种解释；
 * 而解码档单独失败不牵连编码档——用户贴进来的多半就是"半解码"的串。
 */
export function urlPair(text) {
  const s = toText(text);
  const uri = uriEncode(s, true);
  const component = uriEncode(s, false);
  const reason = uri.ok === false ? uri.reason : null;
  return {
    ok: reason === null,
    reason,
    bytes: uri.bytes,
    encodeURI: uri.ok ? uri.out : '',
    encodeURIComponent: component.ok ? component.out : '',
    decodeTries: [tryDecode('decodeURI', s, reason), tryDecode('decodeURIComponent', s, reason)],
  };
}

/**
 * query 串 → 一行一格的表。三条口径都写进 `URL_CAVEAT` 并由 L17 逐条对账：只按 `&` 切、
 * 键值只在**第一个** `=` 处切一次、解不开的那一侧保留原文并用 `keyOk` / `valueOk` 标出来。
 * 这里不是解析器：不去重、不排序、不丢只含空白的段（那是用户的真实输入，替人丢一次就再也回不来）。
 */
export function splitQuery(text) {
  const rows = [];
  for (const raw of toText(text).split('&')) {
    if (raw === '') continue;
    const at = raw.indexOf('=');
    const hasEquals = at >= 0;
    const keyRaw = hasEquals ? raw.slice(0, at) : raw;
    const valueRaw = hasEquals ? raw.slice(at + 1) : '';
    const k = pctDecode(keyRaw);
    const v = pctDecode(valueRaw);
    const why = [];
    if (!k.ok) why.push(`键：${k.reason}`);
    if (!v.ok) why.push(`值：${v.reason}`);
    rows.push({
      raw,
      key: k.ok ? k.text : keyRaw,
      value: v.ok ? v.text : valueRaw,
      keyOk: k.ok,
      valueOk: v.ok,
      hasEquals,
      reason: why.length > 0 ? why.join('；') : null,
    });
  }
  return rows;
}
