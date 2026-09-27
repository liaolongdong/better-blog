/**
 * 摘要与校验码：MD5 与 SHA-1/256/384/512，编码工具箱页 `#digest` 那一格的纯逻辑。
 *
 * 这一格有三条不许让步的规矩，整套判据（§M）都是围着它们写的：
 *
 * 1. **MD5 自己实现，不借快捷方式**。`crypto.subtle` 根本不认 MD5（实测 Node 22 的 subtle 抛
 *    `NotSupportedError: Unrecognized algorithm name`），而 `crypto-js` 在 §2.2 的选型表里就是"不引"。
 *    所以 A/B/C/D 四个初值与 64 项 K 表全部写成硬编码常数——K 表**不能**用 `Math.sin` 现算，
 *    IEEE-754 的 `sin` 不保证跨引擎逐位一致，某台设备上算错一项就是"同一串两个摘要"。
 *    判据拿 Node 的 `createHash('md5')` 当外部对拍源（M1–M3、M18），不把自己的输出当标准。
 * 2. **两条通道两道闸门**。文本走 UTF-8 字节、闸门 1 MiB（与 `codec.js` 的 `MAX_INPUT_BYTES` 同一个
 *    数、同一把尺子，M9 逐样本核两处不分叉）；文件那一路走 `ArrayBuffer`/TypedArray、闸门 5 MiB，
 *    **不进字符串**——`String.fromCharCode` 拼二进制会把字节劈成两个 code unit，摘要就成假的了（M5）。
 *    越界一律整体拒绝且 `hex` 是空串，理由里点名实测字节数（半截摘要比报错更坏）。
 * 3. **算不成就说清是哪一格算不成**。`crypto.subtle` 只在安全上下文有（线上是 GitHub Pages HTTPS、
 *    本地 `http://localhost` 也算，`http://192.168.x.x` 就没有）。取不到时 SHA 四档各自
 *    `ok:false` 并写明"需要安全上下文"，同一批里的 MD5 那一格**照样出结果**（M13）；
 *    `digest` / `digestAll` 永不 reject——subtle 同步抛或异步拒，都收进 `{ok:false, reason}` 里，
 *    面板只有一条 await 路径要写。
 *
 * 与 `idcard.js` / `codec.js` / `time.js` 同一套约定：纯函数、不碰 DOM、同级工具模块互不 import
 * （`shapeOf` / `toText` / UTF-8 编码器因此又各多一份拷贝，代价由 M9 逐样本核一次），并且
 * **两档入参两种处理**：
 *   - **数据入参**（要摘要的那一串）：文本档照 `String(v === null || v === undefined ? '' : v)`
 *     归一不抛，字节档（`ArrayBuffer` 与任意 `ArrayBufferView`）原样直通；唯一例外还是无原型对象
 *     （`String()` 自己抛 `TypeError`，本站不替它兜，M8 逐入口钉）。
 *   - **控制入参**（算法名与 `options`）是闸门：算法名认不出必须响——静默回落到 MD5 等于把用户
 *     选的 SHA-256 显示成了别的算法的产物；`options` 只认 `subtle` 一键，键名拼错也要响。
 *
 * 异步口径是本模块与 §L 唯一的形状差：`subtle.digest` 本来就是 Promise，所以五个算法**全部**走
 * 同一条异步路径（连自己实现的 MD5 也是），校验错误一律以 rejection 送出而不是同步抛
 * （判据里用 `assert.rejects`——它不吃同步抛，写错形状会直接红，M7、M12 各钉一处）。
 *
 * 可复算口径：M6 那五条空输入官方值、M4 的 `'abc'` 向量、M1 的 RFC 1321 七条，都能用
 * `node -e "require('crypto').createHash('md5').update('').digest('hex')"` 一行复算；
 * K 表的第一项 `0xd76aa478` 与最后一项 `0xeb86d391` 由 M16 点名数满 64 项。
 */

/** 文本通道闸门（字节）：与 `codec.js` 的 `MAX_INPUT_BYTES` 同值同口径，§7 那句"文本类工具 1MB" */
export const MAX_TEXT_BYTES = 1048576;
/** 字节通道闸门（字节）：文件那一路单独一档，5 MiB = 5242880 字节；`超过`才拒，正好在数上放行 */
export const MAX_BYTES = 5242880;

/** 面板的五行按这个顺序排，`HEX_LEN` 的键集与它必须同集（M15 两处都核） */
export const ALGORITHMS = Object.freeze(['md5', 'sha-1', 'sha-256', 'sha-384', 'sha-512']);
/** 各档输出的十六进制长度：面板拿它判"这格是不是被截了"，判据拿它逐档核（M4） */
export const HEX_LEN = Object.freeze({ md5: 32, 'sha-1': 40, 'sha-256': 64, 'sha-384': 96, 'sha-512': 128 });

/** 一行的口径说明，面板原样显示（与 `TIME_CAVEAT`、`BASE64_CAVEAT` 同一角色，逐条对账由 M17 守着） */
export const DIGEST_CAVEAT =
  'MD5 由本站自己实现，SHA-1、SHA-256、SHA-384、SHA-512 走浏览器自带的 WebCrypto；'
  + '取不到时给明确提示、不静默出空值。文本按 UTF-8 字节计，文件走字节、不进字符串；'
  + '文本超 1 MiB（1048576 字节）、字节超 5 MiB（5242880 字节）整体拒绝、不截断。';

/** WebCrypto 认的是大写带横杠那一名，本站的规范名用它（判据里硬写期望名，不跟着这张表漂） */
const SUBTLE_NAME = { 'sha-1': 'SHA-1', 'sha-256': 'SHA-256', 'sha-384': 'SHA-384', 'sha-512': 'SHA-512' };
/** 算法名归一的查找表：键是"去掉分隔符的小写串" */
const BY_COMPACT = { md5: 'md5', sha1: 'sha-1', sha256: 'sha-256', sha384: 'sha-384', sha512: 'sha-512' };
const HEX_DIGITS = '0123456789abcdef';

/** 取不到 subtle 那一句：点名"只有 SHA 档受影响"，否则用户以为整格坏了（M13） */
const NO_SUBTLE = '当前环境取不到 crypto.subtle，SHA-* 做不了（需要 HTTPS 或 localhost 这类安全上下文）；'
  + 'MD5 由本站自己实现，不受这一档影响。';

/** 越界那一句要复用，理由里点名实测字节与两道闸门各自的上限（M9、M10） */
const overLimit = (n, limit, label) =>
  `输入 ${n} 字节，超过${label}上限 ${limit} 字节，整体拒绝、不截断`;

/** 与 `codec.js`、`time.js`、`uscc.js` 同一份口径的第四版：报错尾巴统一是「收到 <shapeOf(值)>」 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (typeof v === 'object') return v instanceof Date ? 'Date' : 'object';
  return typeof v;
}

const toText = (v) => String(v === null || v === undefined ? '' : v);

/** 代理区上下界与 `codec.js` 同一档：落单代理项不是合法字符，UTF-8 里也没有它的编码 */
const SUR_HIGH_LO = 0xD800;
const SUR_HIGH_HI = 0xDBFF;
const SUR_LOW_LO = 0xDC00;
const SUR_LOW_HI = 0xDFFF;

/** 找落单代理项，返回 1-based 字符位；干净就返回 0（M11 全靠它给位置） */
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

/** UTF-8 字节数：文本闸门的尺子。落单代理项按 3 字节计——它反正会在下一档被拒 */
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

/** 文本 → UTF-8 字节（先过 `loneSurrogateAt`，否则半代理项会被当三字节写出去） */
function utf8Write(text) {
  const out = new Uint8Array(utf8Len(text));
  let p = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) out[p++] = code;
    else if (code < 0x800) {
      out[p++] = 0xC0 | (code >> 6); out[p++] = 0x80 | (code & 0x3F);
    } else if (code >= SUR_HIGH_LO && code <= SUR_HIGH_HI) {
      const cp = 0x10000 + ((code - SUR_HIGH_LO) << 10) + (text.charCodeAt(i + 1) - SUR_LOW_LO);
      out[p++] = 0xF0 | (cp >> 18); out[p++] = 0x80 | ((cp >> 12) & 0x3F);
      out[p++] = 0x80 | ((cp >> 6) & 0x3F); out[p++] = 0x80 | (cp & 0x3F);
      i += 1;
    } else {
      out[p++] = 0xE0 | (code >> 12); out[p++] = 0x80 | ((code >> 6) & 0x3F);
      out[p++] = 0x80 | (code & 0x3F);
    }
  }
  return out;
}

/** 字节 → 小写十六进制。刻意不 import `codec.js` 的 Base64 那套：本站只承诺十六进制 */
function hexOf(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += HEX_DIGITS[bytes[i] >> 4] + HEX_DIGITS[bytes[i] & 15];
  return s;
}

/** 是"字节"吗：`ArrayBuffer` 与任意 `ArrayBufferView`（TypedArray、DataView）都算，其余走文本档 */
export function isBytes(v) {
  return v instanceof ArrayBuffer || ArrayBuffer.isView(v);
}

/** 文本档的 UTF-8 字节数，面板上的"输入多少字节"与文本闸门共用这一把尺子 */
export function byteLen(text) { return utf8Len(toText(text)); }

/** 字节形状统一成 `Uint8Array` 视图：带 `byteOffset` 的视图按自己的起点读，不从整块头部偷看（M5） */
function toView(v) {
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
}

/**
 * 算法名归一到规范名，认不出给 `null`（面板做即时校验用这一档，不抛）。
 * 大小写、横杠、下划线、空格都不算两种算法：`SHA256` / `sha-256` / `' Sha_256 '` 同一档。
 */
export function normalizeAlgo(v) {
  if (typeof v !== 'string') return null;
  return BY_COMPACT[v.trim().toLowerCase().replace(/[-_\s]/g, '')] || null;
}

/* ── MD5（RFC 1321）：四个初值 + 64 项 K + 64 项移位，全部硬编码常数 ────────── */

const MD5_INIT = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
/** K[i] = floor(2^32 × |sin(i+1)|)。这里写死常数，不在运行时算（文件头规矩 1） */
const MD5_K = [
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
  0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
  0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
  0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
  0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
  0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
  0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
  0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
  0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
];
/** 四组各 16 轮，每轮的左移位数 */
const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

/** 补位：`0x80` + 若干 `0x00` + 64 位小端长度，凑到 64 的整数倍（M3 逐边界对拍的那一档） */
function md5Pad(bytes) {
  const len = bytes.length;
  const total = (Math.floor((len + 8) / 64) + 1) * 64;
  const padded = new Uint8Array(total);
  padded.set(bytes);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  const bits = len * 8;
  view.setUint32(total - 8, bits >>> 0, true);
  view.setUint32(total - 4, Math.floor(bits / 4294967296), true);
  return padded;
}

/** 字节 → MD5 的 16 字节（小端写回，与 RFC 1321 的参考实现同一档字节序） */
function md5Digest(bytes) {
  const padded = md5Pad(bytes);
  const dv = new DataView(padded.buffer);
  let a = MD5_INIT[0]; let b = MD5_INIT[1]; let c = MD5_INIT[2]; let d = MD5_INIT[3];
  const words = new Uint32Array(16);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i += 1) words[i] = dv.getUint32(off + i * 4, true);
    const aa = a; const bb = b; const cc = c; const dd = d;
    for (let i = 0; i < 64; i += 1) {
      let f; let g;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) & 15; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) & 15; }
      else { f = c ^ (b | ~d); g = (7 * i) & 15; }
      const sum = (a + (f >>> 0) + words[g] + MD5_K[i]) >>> 0;
      const s = MD5_S[i];
      const rot = ((sum << s) | (sum >>> (32 - s))) >>> 0;
      a = d; d = c; c = b;
      b = (b + rot) >>> 0;
    }
    a = (a + aa) >>> 0; b = (b + bb) >>> 0; c = (c + cc) >>> 0; d = (d + dd) >>> 0;
  }
  const out = new Uint8Array(16);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, a, true); ov.setUint32(4, b, true);
  ov.setUint32(8, c, true); ov.setUint32(12, d, true);
  return out;
}

/* ── subtle 的取用与降级 ───────────────────────────────────────────────── */

/**
 * `{subtle}` 三档：缺席（`undefined`）读 `globalThis.crypto`；`null` 是调用方**显式声明**
 * "这就是取不到"，用来在非安全上下文里跑同一条降级路径（也是 §M 演那条路的唯一办法——
 * 测试环境的 `crypto.subtle` 一直在，删不掉）；给了对象但没有可调的 `digest`，同档按"取不到"算。
 */
function resolveSubtle(injected) {
  if (injected === null) return null;
  if (injected !== undefined) return typeof injected.digest === 'function' ? injected : null;
  const subtle = globalThis.crypto ? globalThis.crypto.subtle : undefined;
  return subtle && typeof subtle.digest === 'function' ? subtle : null;
}

/** `options` 闸门：只认 `subtle` 一键，键名拼错必须响——静默当默认等于用户的注入白开了 */
function gateOptions(who, options) {
  if (options === undefined || options === null) return undefined;
  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError(`${who} 的 options 应为对象，收到 ${shapeOf(options)}`);
  }
  for (const key of Object.keys(options)) {
    if (key !== 'subtle') throw new TypeError(`${who} 有未知 options 键「${key}」，只认 subtle`);
  }
  const s = options.subtle;
  if (s === undefined || s === null) return s;
  if (typeof s !== 'object') {
    throw new TypeError(`${who} 的 options.subtle 应为对象或 null，收到 ${shapeOf(s)}`);
  }
  return s;
}

/**
 * 数据闸门：字节档看 `MAX_BYTES`，文本档看 `MAX_TEXT_BYTES`，顺序固定是
 * "字节数越界 → 落单代理项 → 才编码"，越界优先于代理项（M11 末段），
 * 否则会给出一句"第 1048577 位"的假位置。
 */
function prepare(input) {
  if (isBytes(input)) {
    const view = toView(input);
    const n = view.byteLength;
    if (n > MAX_BYTES) return { ok: false, bytes: n, reason: overLimit(n, MAX_BYTES, '字节通道') };
    return { ok: true, bytes: n, view };
  }
  const s = toText(input);
  const n = utf8Len(s);
  if (n > MAX_TEXT_BYTES) {
    return { ok: false, bytes: n, reason: overLimit(n, MAX_TEXT_BYTES, '文本通道（1 MiB）') };
  }
  const lone = loneSurrogateAt(s);
  if (lone > 0) {
    return { ok: false, bytes: n, reason: `第 ${lone} 位是落单代理项（半个 emoji），UTF-8 里不存在` };
  }
  return { ok: true, bytes: n, view: utf8Write(s) };
}

/** 这一档本来会走哪条路：闸门拦下时也照此回显，面板才分得开"没算"与"算不成" */
const viaOf = (name, subtle) => (name === 'md5' ? 'self' : (subtle ? 'subtle' : 'unavailable'));

function one(name, prepared, subtle) {
  if (name === 'md5') {
    return Promise.resolve({ ok: true, algo: name, hex: hexOf(md5Digest(prepared.view)),
      bytes: prepared.bytes, via: 'self', reason: null });
  }
  if (!subtle) {
    return Promise.resolve({ ok: false, algo: name, hex: '', bytes: prepared.bytes,
      via: 'unavailable', reason: NO_SUBTLE });
  }
  return Promise.resolve()
    .then(() => subtle.digest(SUBTLE_NAME[name], prepared.view))
    .then((buf) => ({ ok: true, algo: name, hex: hexOf(new Uint8Array(buf)),
      bytes: prepared.bytes, via: 'subtle', reason: null }))
    .catch((err) => ({ ok: false, algo: name, hex: '', bytes: prepared.bytes, via: 'subtle',
      reason: `摘要失败：${(err && err.name) || 'Error'} ${(err && err.message) || ''}`.trim() }));
}

/**
 * 单档入口。`{ok, algo, hex, bytes, via, reason}` 六键恒定，成不成都不 reject。
 * 只有控制入参（算法名、`options`、无原型对象那一种）才抛。
 */
export async function digest(algo, input, options) {
  const name = normalizeAlgo(algo);
  if (name === null) {
    throw new TypeError(`digest 的算法名不在支持列表里，收到 ${shapeOf(algo)}`);
  }
  const subtle = resolveSubtle(gateOptions('digest', options));
  const prepared = prepare(input);
  if (!prepared.ok) {
    return { ok: false, algo: name, hex: '', bytes: prepared.bytes,
      via: viaOf(name, subtle), reason: prepared.reason };
  }
  return one(name, prepared, subtle);
}

/**
 * 五档并列（面板的那张表）。字节数只算一次、五格报同一个数；数据闸门失败时五格同一句理由，
 * 而个别档自己失败（只有 SHA 档取不到 subtle）不牵连邻居——`#digest` 的降级提示就靠这一档。
 */
export async function digestAll(input, options) {
  const subtle = resolveSubtle(gateOptions('digestAll', options));
  const prepared = prepare(input);
  const rows = [];
  for (const name of ALGORITHMS) {
    if (!prepared.ok) {
      rows.push({ ok: false, algo: name, hex: '', bytes: prepared.bytes,
        via: viaOf(name, subtle), reason: prepared.reason });
    } else {
      rows.push(await one(name, prepared, subtle));
    }
  }
  return { ok: rows.every((r) => r.ok), reason: prepared.ok ? null : prepared.reason,
    bytes: prepared.bytes, rows };
}
