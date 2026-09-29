/**
 * JSON ↔ YAML / XML / CSV 三对互转（设计文档 §5.3 的转换族，段 4 Task 4 落地）。
 * 判据是 §U 的 U6–U18（`scripts/toolkit-tests.mjs`），本文件的每一格口径都在那里钉着；
 * 注释与判据冲突时以判据为准，因为判据是要在 CI 里红给下一个改这一本的人看的。
 *
 * ── 为什么 YAML 那一族用的是一本**内置件**而不是 npm 依赖（段 4 计划 §0.4 的三条理由）──
 *
 * 1. `package.json` 与 `pnpm-lock.yaml` 是全站构建的公共件，本段落地期间它正被另一路
 *    会话占着（未提交的两条 `wechat:draft*` scripts）。加依赖要同批改这两个文件，
 *    而 CI 是 `--frozen-lockfile` —— 两处不同批就红在别人的批次上。
 * 2. 本仓库对**浏览器代码**的既有做法就是内置：`dev/libJs/` 里躺着 jquery、prism、
 *    social-share、canvas-nest、vue、vconsole、fastclick，`package.json` 的
 *    `dependencies` 一格根本没有（只有 7 项 devDependencies，全是构建工具）。
 *    `THIRD-PARTY-NOTICES.md` 第一节就是为这一族内置件设的账。
 * 3. 内置的价钱量得出来（2026-09-29 在 HEAD 导出树里真跑 `npx vite build` 的探针，
 *    exit=0，口径 `cat f | gzip -9 | wc -c`）：探针入口 `probeJson.min.js` 原文 56,955B /
 *    **gzip 16,912B**，同批对照 `toolCodec.min.js` 是 21,830B、`toolkitCore.min.js` 7,037B、
 *    `toolkit.min.css` 2,135B；24 本产物（基线 23 本 + 探针那一本，Task 1 复跑核对过清单）里
 *    `import{` 命中 0，且 `assets/js/` 没有多出
 *    一本 js-yaml —— `.mjs` 既不成 Vite 入口（`vite.config.js:110` 只收 `.js`），
 *    也不被 `copyMinifiedLibs` 复制（`:67` 只复制 `.min.js`）。
 *
 * ── 这一本是什么、能动到什么程度 ──
 *
 * `dev/libJs/js-yaml.esm.min.mjs` = npm tarball `js-yaml-5.4.2` 里那个
 * `package/dist/browser/js-yaml.esm.min.mjs` 成员，**逐字节**（78,721B /
 * sha256 `154ea2da…`，U1 钉它；整包 `js-yaml-5.4.2.tgz` 是 sha256 `0003d2f5…`，
 * 两个数一起才能从上游复算）。spec §7 指定的就是这个入口。不改名、不重排、不剥尾部那条
 * sourceMappingURL 引用（"逐字节等于上游"比"少一行指向站内不存在的 map"值钱，
 * `jquery.min.js` 同样挂着一条，线上多年无人受害）。
 *
 * **升级口径**：换版本 = 换文件 + 改 §U 那一族记下的 sha256 / 字节数 / banner 串
 * + 复跑 §U 与 §W 与门禁②③，并同步 `THIRD-PARTY-NOTICES.md` 那一行。
 * 不许 sed 内置件本身——那会让第一节那句"逐字节比对已确证"变成谎话。
 *
 * ── 三对各自的边界，都是判据而不是"尽力而为" ──
 *
 * · **YAML**：读侧用 YAML11 的 schema（不是默认的 CORE），因为只有它给得出 `!!binary`
 *   与时间戳这两类；价钱是 YAML 1.1 的历史包袱会真的生效（`yes/no/y/n/on/off` 是布尔、
 *   `0755` 是八进制、`2024-01-01` 是日期，连键位上单个 `y` 也是布尔）。写侧全靠引号挡住
 *   （U7 逐字钉住 dump 自己加的那些引号），读侧挡不住的由 U8 逐条点名、并由 `YAML_NOTES`
 *   如实告诉用户。深度闸门 `YAML_DEPTH_LIMIT` 是**在内置件上二分实测**出来的 98 层：
 *   写侧用同一个数，理由只有一条——写出去就必须读得回来。
 * · **XML**：只支持本站自己写的那个子集（`XML_CONVENTION` 那句话就是这张表的目录）：
 *   类型写在 `t` 属性上、数组元素一律 `<item>`、空白不 trim。命名空间、DOCTYPE、外部实体、
 *   非预定义实体一律拒，且指认到越界的那一个字符（U12 四十八档）。读侧比写侧宽：接受自闭合、
 *   单引号属性、注释、CDATA、数字引用与同名兄弟归并（U13），因为"编辑后再读"这条路要留着。
 * · **CSV**：按 RFC 4180 补三处（引号 doubling、内嵌换行、CRLF），读回来一律是字符串——
 *   它没有类型可保（`CSV_NOTES.fidelity` 就是说这件事）。形状只收"对象数组"与"单个对象"，
 *   嵌套容器压成一格 JSON 文本（不拒，因为拒了用户就没法把这份数据带出去）。
 *
 * ── 三条贯穿全本的口径 ──
 *
 * 1. **坏输入是返回值，入参错才是编程错**：三个写函数对"这份数据转不了"返回
 *    `{ok:false, error:{kind, message, path}}`，三个读函数对"这份文本读不懂"返回
 *    `{ok:false, error:{kind, message, line, column, index, snippet}}`；而非字符串入参、
 *    非法缩进档、非法分隔符一律当场 `TypeError` / `RangeError`（静默回退默认档，是把
 *    "参数写错"藏成"输出莫名其妙"）。
 * 2. **位置只有一把尺**：行列口径全借 `json-core` 的 `gate` / `locate` / `lineRange`，
 *    闸门那两档的消息交回 core 的原话（站内不许有第二句"超出上限"）。深度也只有一把尺：
 *    XML 两向都吃 `MAX_DEPTH`，本文件里不写字面量那一千。
 * 3. **显式栈**：`scanJson` 与两个写读器都是迭代。`MAX_DEPTH` 那一档的合法输入会先把
 *    递归下降的调用栈撑爆（`RangeError` 而不是行列号），而"报错报在第几行第几列"正是
 *    这一族存在的理由。
 *
 * ── 纯计算 ──
 *
 * 不读任何环境：没有 `window` / `document` / `localStorage` / `process` / `Buffer` /
 * `TextEncoder`，不用 `atob` / `btoa` / `DOMParser` / `XMLSerializer`，不碰网络，
 * base64 与 XML 与 CSV 的解析全部自己写（U18 钉这一族，也钉"只借 json-core 那七把尺"）。
 * 解析与序列化一律不外包给原生：`JSON.parse` / `JSON.stringify` 在本文件里一次都不出现
 * （CSV 单元格里的紧凑 JSON 用 `escapeText` 自己拼，数字用 `String(n)`）。
 *
 * `__proto__` 一律走本文件的 `setOwn()` 写：`obj['__proto__'] = v` 改的是原型而不是属性，
 * 一份恶意输入可以借此污染后续所有对象（U8 与 U13 各有一格盯着这条，它盯的是**依赖**）。
 *
 * @module dev/js/tools/json-convert.js
 */
import * as YAML from '../../libJs/js-yaml.esm.min.mjs';
import { INDENT_MODES, MAX_DEPTH, escapeText, gate, lineRange, locate, pointerChild } from './json-core.js';

/**
 * 面板与判据共读的那一句身份说明（U18 拿它与内置件首行 banner、与 §U 的路径同时逐字对账）。
 * @type {string}
 */
export const YAML_LIB = 'js-yaml 5.4.2 (MIT) · dev/libJs/js-yaml.esm.min.mjs';

/**
 * YAML 那一族的深度上限：在内置件的读侧上二分实测（2026-09-29），98 层能读回来、
 * 99 层它自己就抛。写侧用同一个数，是为了 `roundTrips().yaml` 给出的那个 ✓ 不是假话。
 * 它与 `MAX_DEPTH`（1000）是两个数：YAML 这一族窄，XML 那一族宽，面板照实显示。
 * @type {number}
 */
export const YAML_DEPTH_LIMIT = 98;

/**
 * 面板上"读 YAML 要知道的两件事"（键名由 §W 的面板按格读，加一格就要改面板）。
 * @type {{ambiguous: string, date: string}}
 */
export const YAML_NOTES = {
  ambiguous: 'YAML 1.1 把 yes/no/on/off/y/n 当布尔、0755 当八进制、2024-01-01 当日期：'
    + '本站写的时候每一格都加了引号，读你手上的 YAML 时它们会真的变成布尔与数字。',
  date: '日期与时间在 YAML 里是另一种类型：本站一律折成 UTC 的 ISO 8601 字符串'
    + '（形如 2024-01-01T00:00:00.000Z），!!binary 一律折成 base64 字符串。',
};

/**
 * XML 那一族的一句话约定说明（U18 钉它必须提到 `item` 与 `t=`，且长不过 200 字——
 * 长过这一档就该拆进 help 而不是堆在面板上）。
 * @type {string}
 */
export const XML_CONVENTION = '类型只写在 t= 属性上（obj / arr / str / num / bool / null），'
  + '数组元素一律叫 item，对象键名就是标签名；命名空间、DOCTYPE 与外部实体不读。';

/**
 * CSV 那一族的代价说明（面板那句 fidelity，也是 `roundTrips().csv === false` 的解释）。
 * @type {{fidelity: string}}
 */
export const CSV_NOTES = {
  fidelity: 'CSV 没有类型：每一格读回来都是字符串，数字、布尔与 null 都一样；'
    + '嵌套的对象与数组压成一格 JSON 文本写进去，读回来同样是字符串。',
};

/** 三档缩进的单位：与 `INDENT_MODES` 同名同序，档位合法性由那一本管（U10） */
const INDENT_UNIT = { two: '  ', four: '    ', tab: '\t' };

/** XML 的类型标签（写侧按它输出，读侧按它校验；`item` 不在这一族里，那是元素名） */
const XML_KINDS = ['obj', 'arr', 'str', 'num', 'bool', 'null'];

/** 读侧只认这五个预定义实体，其余具名实体一律点名拒（U12） */
const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** 合法名字：字母或下划线起始，后面跟字母、数字、点、下划线、连字符；`xml` 前缀与冒号拒（U11） */
const NAME_RE = /^[\p{L}_][\p{L}\p{Nd}._-]*$/u;
/** JSON 的数字记号（读侧按它校验 `t="num"` 的内容，所以 `+1`、`01`、`Infinity` 都进不来） */
const NUM_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

const LT = '<';
const GT = '>';
const AMP = '&';
const SLASH = '/';
const EQ = '=';
const QUOTE = '"';
const APOS = "'";
const SEMI = ';';
const TILDE = '~';

/** 内置件读侧遇到 JSON 装不下的类型时，`settle()` 交回的这个哨兵（只在本文件内流通） */
const NOT_JSON = Symbol('not-json');

/**
 * 把键写成 own 属性（`obj['__proto__'] = v` 改的是原型）。与 json-core 的同名内部件同形——
 * 那一本没有导出它，因为它是解析器 internals；这一本要的也只是 internals。
 * @param {Record<string, unknown>} obj
 * @param {string} key
 * @param {unknown} value
 */
const setOwn = (obj, key, value) => {
  Object.defineProperty(obj, key, { value, enumerable: true, writable: true, configurable: true });
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** 容器 = 数组或"干净的对象"（原型是 Object.prototype 或 null）；类实例、Map、Set 都不算 */
const isPlainObject = (v) => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

const isContainer = (v) => Array.isArray(v) || isPlainObject(v);

const CLASS_SCALAR = 0;
const CLASS_CONTAINER = 1;
const CLASS_BAD = 2;

/**
 * 三族共用的分类：哪些值能进 JSON、哪些是容器、哪些"JSON 里装不下"。
 * `Date` 与 `Uint8Array` 算标量，因为每一族都有明确的归一方式（ISO 串 / base64 串）；
 * 非有限的数（NaN 与两个 Infinity）算装不下——交出去就不是合法 JSON 了。
 * @param {unknown} v
 * @returns {number} `CLASS_SCALAR` | `CLASS_CONTAINER` | `CLASS_BAD`
 */
const classify = (v) => {
  const t = typeof v;
  if (v === null || t === 'string' || t === 'boolean') return CLASS_SCALAR;
  if (t === 'number') return Number.isFinite(v) ? CLASS_SCALAR : CLASS_BAD;
  if (t === 'object') {
    if (Array.isArray(v)) return CLASS_CONTAINER;
    if (v instanceof Date || v instanceof Uint8Array) return CLASS_SCALAR;
    return isPlainObject(v) ? CLASS_CONTAINER : CLASS_BAD;
  }
  return CLASS_BAD;
};

/** 容器的键序列：数组用下标，对象用 own 可枚举键（`__proto__` 在列，因为它就是 own 键） */
const keyListOf = (v) => (Array.isArray(v) ? Array.from(v, (unused, i) => i) : Object.keys(v));

const typeNameOf = (v) => {
  if (v === null) return 'null';
  if (v instanceof Date) return 'Date';
  if (v instanceof Uint8Array) return 'Uint8Array';
  const t = typeof v;
  if (t === 'object') return isPlainObject(v) ? 'object' : (v && v.constructor && v.constructor.name) || 'object';
  return t;
};

/** base64  alphabet：`atob` / `btoa` 在 U18 的禁令里（外包就等于不可审计），这一族自己写 */
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * 字节串 → base64（含 `=` 补齐）。空字节串得到空字符串，而不是"看起来像 null"的裸 `a:`。
 * @param {Uint8Array} bytes
 * @returns {string}
 */
const b64 = (bytes) => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const hasB = i + 1 < bytes.length;
    const hasC = i + 2 < bytes.length;
    const n = (a << 16) | ((hasB ? bytes[i + 1] : 0) << 8) | (hasC ? bytes[i + 2] : 0);
    out += B64_CHARS.charAt((n >> 18) & 63) + B64_CHARS.charAt((n >> 12) & 63);
    out += hasB ? B64_CHARS.charAt((n >> 6) & 63) : '=';
    out += hasC ? B64_CHARS.charAt(n & 63) : '=';
  }
  return out;
};

/**
 * 写侧共用的三道闸门：非 JSON 的值、环、深度。全部迭代，且**祖先栈只沿当前这条路径**——
 * 同一个对象被两个键引用（DAG）在 JSON 里就是两份拷贝，`seen` 判法会把它当环一起拒掉（U8）。
 * @param {unknown} value
 * @param {number} limit 层数上限（根算第 1 层）
 * @param {boolean} [countScalars] 标量叶算不算一层。XML 那一族要它（`true`）：本站的编码里
 *   **一个值恰好一个元素**，最深那一格是标量时元素层数 = 容器层数 + 1，而读侧的闸门数的就是元素层数
 *   （U12 钉死的既是它）。YAML 与 CSV 不数（`false`），它们的闸门各自窄一档/根本没有那一族。
 *   这一把尺不许有两套读法：写侧只数容器就会放出自己读不回来的东西（U11 最后那一族钉的是这个）。
 * @returns {{ok: true} | {ok: false, error: {kind: string, message: string, path: string}}}
 */
const scanJson = (value, limit, countScalars = false) => {
  const rootClass = classify(value);
  if (rootClass === CLASS_SCALAR) return { ok: true };
  if (rootClass === CLASS_BAD) {
    return { ok: false, error: { kind: 'non-json', message: nonJsonMessage(value), path: '' } };
  }
  const stack = [{ v: value, path: '', level: 1, keys: keyListOf(value), i: 0, anc: null }];
  let where = '';
  try {
    while (stack.length > 0) {
      const f = stack[stack.length - 1];
      if (f.i >= f.keys.length) { stack.pop(); continue; }
      const key = f.keys[f.i];
      f.i += 1;
      const path = pointerChild(f.path, key);
      where = path;
      const child = f.v[key];
      const cls = classify(child);
      if (cls === CLASS_BAD) return { ok: false, error: { kind: 'non-json', message: nonJsonMessage(child), path } };
      if (cls === CLASS_SCALAR) {
        const level = f.level + 1;
        if (countScalars && level > limit) {
          return { ok: false, error: { kind: 'depth', message: depthMessage(level, limit), path } };
        }
        continue;
      }
      if (child === f.v || hasAncestor(f.anc, child)) {
        return { ok: false, error: { kind: 'cycle', message: CYCLE_MESSAGE, path } };
      }
      const level = f.level + 1;
      if (level > limit) {
        return { ok: false, error: { kind: 'depth', message: depthMessage(level, limit), path } };
      }
      stack.push({ v: child, path, level, keys: keyListOf(child), i: 0, anc: { node: f.v, prev: f.anc } });
    }
  } catch {
    // 走到这里只剩一种可能：**读这一格的值时它自己抛了**（对象上的 getter 或 Proxy 的 trap）。
    // 面板喂进来的值一律出自 parseJson，那里头没有 getter，所以这一族不是"用户的数据"而是"别人
    // 直接调模块"才会撞上的形状；但出口那句"绝不抛给调用方"不许因为它破——三格并排的面板里，
    // 任何一格把异常抛出去就是整块面板一次未捕获异常。与"装不进 JSON"同一档，当场指认 Pointer。
    return { ok: false, error: { kind: 'non-json', message: THREW_MESSAGE, path: where } };
  }
  return { ok: true };
};

/** 沿祖先链表找有没有同一个对象（深度已先由闸门卡住，这一族最贵就是 limit 次比较） */
const hasAncestor = (anc, node) => {
  for (let p = anc; p !== null; p = p.prev) if (p.node === node) return true;
  return false;
};

const nonJsonMessage = (v) => `${typeNameOf(v)} 这种值装不进 JSON：本站只认对象、数组、`
  + '字符串、有限的数、布尔与 null。undefined 键与函数会被静默丢掉或改写，比报错更难查，所以当场拒。';

const CYCLE_MESSAGE = '这份数据里有自引用（对象或数组里出现了它自己）：JSON 里表达不了环，'
  + '本站不展开也不截断，请把它改成两份独立的值。';

/** `scanJson` 里那道 catch 的话：读值时对象自己抛了（getter / Proxy 的 trap） */
const THREW_MESSAGE = '取这一格的值时它自己抛了（对象上的 getter 或 Proxy 的 trap）：'
  + '那不是 JSON 里取得出的一份数据，本站当场拒，不改写成 null 也不跳过这一格。';

const depthMessage = (level, limit) => `嵌套到第 ${level} 层，超出这一族的上限 ${limit} 层：`
  + '本站不做静默压平，请减一层再转。';

/** 码点写成 `U+XXXX`（U11 钉这一族的写法：删掉它用户看不出来少了什么，必须点名） */
const hexPoint = (code) => `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;

/**
 * 读侧 error 的唯一造法：行列由 index 经 `locate` 推、snippet 由 `lineRange` 切，
 * 所以两套数字不会各说各话（U9 与 U12 各有一格自洽断言）。
 * @param {string} kind
 * @param {string} text
 * @param {number} index
 * @param {string} why
 */
const readError = (kind, text, index, why) => {
  const at = Math.max(0, Math.min(index | 0, text.length));
  const pos = locate(text, at);
  const rng = lineRange(text, pos.line);
  return {
    kind,
    message: `${why}（第 ${pos.line} 行第 ${pos.column} 列）`,
    line: pos.line,
    column: pos.column,
    index: at,
    snippet: text.slice(rng.start, rng.end),
  };
};

/** 闸门那一档：消息交回 json-core 的原话，不给 snippet（一行就是 5 MiB，指认到 EOF 那一格） */
const gateError = (g, text) => {
  const pos = locate(text, text.length);
  return {
    kind: g.kind, message: g.message, line: pos.line, column: pos.column, index: text.length, snippet: '',
  };
};

const typeGuard = (api, value) => {
  if (typeof value !== 'string') {
    throw new TypeError(`${api} 只收字符串，收到的是 ${value === null ? 'null' : typeof value}`);
  }
};

// ── YAML 那一族 ──────────────────────────────────────────────────────────────

/**
 * 值 → 交给内置件之前的归一：`Date` 变 ISO 串、`Uint8Array` 变 base64 串，其余原样。
 * 归一是为了"交出去的 YAML 与交进来的 JSON 同形"——别人拿别的 yaml→json 工具转一圈
 * 还得是同一份数据，所以不能让 dump 自己写 `!!binary` 或裸时间戳（U8）。
 * 递归在这里是安全的：`scanJson` 已经把它压到 98 层以内，栈顶还剩几十格余量。
 * @param {unknown} v
 * @returns {unknown}
 */
const normalizeForYaml = (v) => {
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array) return b64(v);
  if (Array.isArray(v)) return v.map((item) => normalizeForYaml(item));
  if (isPlainObject(v)) {
    const out = {};
    for (const key of Object.keys(v)) setOwn(out, key, normalizeForYaml(v[key]));
    return out;
  }
  return v;
};

/**
 * JSON 值 → YAML 文本。
 * @param {unknown} value
 * @returns {{ok: true, text: string} | {ok: false, error: {kind: string, message: string, path: string}}}
 */
export function jsonToYaml(value) {
  const scan = scanJson(value, YAML_DEPTH_LIMIT);
  if (!scan.ok) return { ok: false, error: scan.error };
  let text;
  try {
    // lineWidth=-1：500 字的串不许被折成多行（复制出去就不是同一份数据）
    // noRefs=true：DAG 写两份，与 JSON 同形；写成锚点引用是另一种"看起来一样"的东西
    text = YAML.dump(normalizeForYaml(value), { lineWidth: -1, noRefs: true });
  } catch (err) {
    return { ok: false, error: { kind: 'non-json', message: `内置件不肯写这一族值：${err && err.message}`, path: '' } };
  }
  return { ok: true, text: text.endsWith('\n') ? text : `${text}\n` };
}

/**
 * 在真正调用内置件之前，先把"整份输入没有文档"与"多于一个文档"这两档自己判掉：
 * 内置件给这两档的异常不带位置（mark 是 null），而 §5.3 要的是行列号。
 * 行口径借 §S 那一把尺（只认 `\n`），`---` 与 `...` 必须顶格才算标记（块标量里的缩进内容
 * 因此不会被误读成文档边界）。
 * @param {string} text
 * @returns {{kind: 'empty'|'multi-document', index: number} | null}
 */
const prescanYaml = (text) => {
  let pending = false;    // 最近一个文档标记之后有没有真正的内容
  let open = false;       // 当前这一份文档开着（`---` 起了头，或已经有内容）
  let everOpen = false;   // 整份输入里有没有开过文档——`...` 会关掉当前的，但不抹掉这一格
  let endAt = -1;         // 看到 `...` 但还没有内容跟着它——它下面一旦有内容就是第二份的边界
  let at = 0;
  for (;;) {
    const nl = text.indexOf('\n', at);
    const end = nl === -1 ? text.length : nl;
    const raw = text.slice(at, end);
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    const marker = /^---(?=[\s]|$)/.test(line) ? '---' : /^\.\.\.(?=[\s]|$)/.test(line) ? '...' : '';
    const blank = line.trim() === '';
    const comment = !blank && line.charAt(line.search(/[^\s]/)) === '#';
    if (marker === '---') {
      // 上面已经开过一份（哪怕内容是空的，`---\n---` 就是两份），这一行就是第二份的起始符
      if (endAt >= 0) return { kind: 'multi-document', index: endAt };
      if (pending || open) return { kind: 'multi-document', index: at };
      open = true;
      everOpen = true;
      pending = false;
    } else if (marker === '...') {
      // 已经关掉过就什么也不做：2026-09-29 实测内置件对"结束符之后再来一个 `...`"仍算同一份文档，
      // 这里抢先返回 multi 就是把**合法输入**误拒成两份——比漏拒更伤用户（U8 那一格钉的是它）。
      // 空文档也要记下结束位：`---` 开了它、`...` 关掉它，后面再出现 `---` 就是第二份（U9 那一格）。
      if (endAt < 0 && (pending || open)) endAt = at;
      open = false;
      pending = false;
    } else if (!blank && !comment) {
      if (endAt >= 0) return { kind: 'multi-document', index: endAt };
      open = true;
      everOpen = true;
      pending = true;
    }
    if (nl === -1) break;
    at = end + 1;
  }
  // 只有 `---` 也算一份文档（它的值是 null）；`...` 与注释不算——那才是"没有输入"
  if (!everOpen) return { kind: 'empty', index: text.length };
  return null;
};

/** 内置件的异常 → 本站的 kind：嵌套闸门、未知标签各一档，其余归 parse */
const yamlErrorKind = (message) => {
  if (/nesting exceeded|maximum nesting|maxDepth/i.test(message)) return 'depth';
  if (/unknown [\w ]*tag/i.test(message)) return 'unknown-tag';
  return 'parse';
};

/** 内置件消息的第一行（它后面还挂着源码上下文那几行，面板那一格只要这一句） */
const firstLine = (message) => String(message).split('\n', 1)[0];

/**
 * 内置件给的值 → JSON 给得起的值：Date → ISO 串、Uint8Array → base64 串、
 * 非有限的数 → null、JSON 装不下的那一族 → 交回 `NOT_JSON`。
 * 所有对象一律用 `setOwn` 重建：原型必须回到 Object.prototype，`__proto__` 落成 own 键（U8）。
 * 落到 `NOT_JSON` 的到底是哪一族，2026-09-29 实测过才这么写：`!!set` 与 `!!python/*` 那一族
 * 在内置件那关就报 unknown tag（走 `unknown-tag` 那一档，压根到不了这里）；`!!omap` 在 YAML11
 * 的 schema 里给回的就是"单键对象组成的数组"——那是 omap 在 JSON 里唯一成立的写法，原样收下，
 * 不是把类型换掉。所以这里拦到的只剩 bigint / symbol / function 与"原型不是 Object 的脏对象"
 * 这一族（站内可达的样本几乎没有，留着是因为换掉内置件的那天这一档就会不一样）。
 * @param {unknown} v
 * @returns {unknown} `NOT_JSON` 表示这份 YAML 里的东西 JSON 装不下
 */
const settleYamlValue = (v) => {
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array) return b64(v);
  if (Array.isArray(v)) {
    const out = [];
    for (const item of v) {
      const s = settleYamlValue(item);
      if (s === NOT_JSON) return NOT_JSON;
      out.push(s);
    }
    return out;
  }
  if (v !== null && typeof v === 'object') {
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return NOT_JSON;
    const out = {};
    for (const key of Object.keys(v)) {
      const s = settleYamlValue(v[key]);
      if (s === NOT_JSON) return NOT_JSON;
      setOwn(out, key, s);
    }
    return out;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === undefined || typeof v === 'bigint' || typeof v === 'symbol' || typeof v === 'function') return NOT_JSON;
  return v;
};

/**
 * YAML 文本 → JSON 值。读侧用 YAML11 的 schema（`YAML_NOTES` 那两格说的就是它的价钱）。
 * @param {string} text
 * @returns {{ok: true, value: unknown} | {ok: false, error: {kind: string, message: string, line: number, column: number, index: number, snippet: string}}}
 */
export function yamlToJson(text) {
  typeGuard('yamlToJson', text);
  const g = gate(text);
  if (!g.ok) return { ok: false, error: gateError(g, text) };
  const pre = prescanYaml(text);
  if (pre) {
    const why = pre.kind === 'empty'
      ? '没有可解析的 YAML 内容：整份输入是空的、只有空白，或者只有注释与文档结束符'
      : '这份文本里有多于一个 YAML 文档，本站一次只转一份';
    return { ok: false, error: readError(pre.kind, text, pre.index, why) };
  }
  let loaded;
  try {
    loaded = YAML.load(text, { schema: YAML.YAML11_SCHEMA });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const mark = err ? err.mark : null;
    const at = mark && typeof mark.position === 'number' ? mark.position : text.length;
    return { ok: false, error: readError(yamlErrorKind(message), text, at, `YAML 解析失败：${firstLine(message)}`) };
  }
  const value = settleYamlValue(loaded);
  if (value === NOT_JSON) {
    return {
      ok: false,
      error: readError('non-json', text, text.length,
        '这份 YAML 里有 JSON 装不下的类型（bigint、symbol、函数，或原型不是普通对象的那一族），'
        + '本站只认对象、数组、字符串、有限的数、布尔与 null'),
    };
  }
  return { ok: true, value };
}

// ── XML 那一族 ───────────────────────────────────────────────────────────────

const isWs = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r';

const skipWs = (text, at) => {
  let i = at;
  while (i < text.length && isWs(text.charAt(i))) i += 1;
  return i;
};

/** 名字合法性：字符集那一档 + `xml` 前缀那一档（U11 的合法/越界两族表就是它） */
const isLegalName = (name) => NAME_RE.test(name) && !/^xml/i.test(name);

/**
 * 这段文字里有没有写进 XML 就存不下的字符：C0 控制符（`\t` `\n` `\r` 除外）与落单代理项。
 * 命中就交回它的码点串，否则交回空串。`DEL`、U+0080、U+2028 都在 XML 1.0 的字符集里，
 * 闸门不许顺手多禁（U11 有一格专门钉这一条）。
 * @param {string} s
 * @returns {string}
 */
const badCharIn = (s) => {
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i);
    if (code < 0x20 && code !== 9 && code !== 10 && code !== 13) return hexPoint(code);
    if (code >= 0xd800 && code <= 0xdfff) {
      const next = i + 1 < s.length ? s.charCodeAt(i + 1) : -1;
      if (code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { i += 1; continue; }
      return hexPoint(code);
    }
  }
  return '';
};

/** 文本节点只转四格：`&` `<` `>` 与 `\r`（后者不数字化会被读侧按平台规矩当行尾吃掉） */
const xmlEscape = (s) => {
  let out = '';
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charAt(i);
    if (c === AMP) out += '&amp;';
    else if (c === LT) out += '&lt;';
    else if (c === GT) out += '&gt;';
    else if (c === '\r') out += '&#13;';
    else out += c;
  }
  return out;
};

/** 标量 → 写进标签中间的那段文字（负零是这一族唯一要偏离 `String(n)` 的地方，U10 钉它） */
const xmlLeafText = (v) => {
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array) return b64(v);
  if (v === null) return '';
  if (typeof v === 'number') return Object.is(v, -0) ? `-${String(0)}` : String(v);
  return String(v);
};

const xmlKindOf = (v) => {
  if (Array.isArray(v)) return 'arr';
  if (v === null) return 'null';
  if (v instanceof Date || v instanceof Uint8Array || typeof v === 'string') return 'str';
  if (typeof v === 'number') return 'num';
  if (typeof v === 'boolean') return 'bool';
  return 'obj';
};

/**
 * 写之前的一次预遍历：非法键名**一次列全**（按出场顺序），字符闸门指认第一个越界者。
 * 分两趟而不是边写边报，是因为"改三轮"与"改一轮"的差别就在这一格上。
 * @param {unknown} value
 */
const xmlWriteGate = (value) => {
  const badKeys = [];
  let firstKeyPath = '';
  let charError = null;
  const checkString = (s, path) => {
    if (charError !== null) return;
    const code = badCharIn(s);
    if (code) {
      charError = {
        kind: 'bad-char',
        message: `这个字符写进 XML 就丢了：${code}。XML 1.0 的字符集里没有它，`
          + '本站既不删也不转成数字引用，请把它换掉或删掉。',
        path,
      };
    }
  };
  if (typeof value === 'string') checkString(value, '');
  if (!isContainer(value)) {
    if (badKeys.length > 0) return { ok: false, error: invalidKeyError(badKeys, firstKeyPath) };
    return charError ? { ok: false, error: charError } : { ok: true };
  }
  const stack = [{ v: value, path: '', keys: keyListOf(value), i: 0 }];
  while (stack.length > 0) {
    const f = stack[stack.length - 1];
    if (f.i >= f.keys.length) { stack.pop(); continue; }
    const key = f.keys[f.i];
    f.i += 1;
    const child = f.v[key];
    const path = pointerChild(f.path, key);
    if (!Array.isArray(f.v) && !isLegalName(String(key))) {
      badKeys.push(String(key));
      if (firstKeyPath === '') firstKeyPath = path;
    }
    if (typeof child === 'string') checkString(child, path);
    else if (isContainer(child)) stack.push({ v: child, path, keys: keyListOf(child), i: 0 });
  }
  if (badKeys.length > 0) return { ok: false, error: invalidKeyError(badKeys, firstKeyPath) };
  if (charError !== null) return { ok: false, error: charError };
  return { ok: true };
};

const invalidKeyError = (keys, path) => ({
  kind: 'invalid-key',
  message: `这些对象键名不能当 XML 标签名：${keys.join('、')}。`
    + '标签名要字母或下划线起始，后面跟字母、数字、点、下划线或连字符，且不以 xml 起始、不带冒号。',
  path,
  keys,
});

/**
 * JSON 值 → XML 文本（本站自己那一族无损子集）。显式栈：`MAX_DEPTH` 那一档的合法输入
 * 用递归下降写会先炸调用栈，而炸栈的报错给不出用户要的那一格内容。
 * @param {unknown} value
 * @param {{root?: string, indent?: string}} [options]
 * @returns {{ok: true, text: string} | {ok: false, error: {kind: string, message: string, path: string, keys?: string[]}}}
 */
export function jsonToXml(value, options = {}) {
  const opts = options || {};
  const root = opts.root === undefined ? 'json' : String(opts.root);
  const indent = opts.indent === undefined ? 'two' : opts.indent;
  if (!INDENT_MODES.includes(indent)) {
    throw new RangeError(`jsonToXml 只认 INDENT_MODES 里的那几档：${INDENT_MODES.join(' | ')}`);
  }
  // 第三格 `true`：XML 这一族的层数要把标量叶也算上，与读侧那道闸门同一把尺（见 `scanJson` 的 JSDoc）。
  const scan = scanJson(value, MAX_DEPTH, true);
  if (!scan.ok) return { ok: false, error: scan.error };
  if (!isLegalName(root)) {
    return {
      ok: false,
      error: { kind: 'invalid-root', message: `根元素名 ${root === '' ? '（空）' : root} 不能当 XML 标签名。`, path: '' },
    };
  }
  const names = xmlWriteGate(value);
  if (!names.ok) return { ok: false, error: names.error };

  const unit = INDENT_UNIT[indent];
  const out = [];
  const stack = [{ name: root, v: value, level: 0, keys: null, i: 0 }];
  while (stack.length > 0) {
    const f = stack[stack.length - 1];
    if (f.keys === null) {
      const kind = xmlKindOf(f.v);
      const pad = unit.repeat(f.level);
      if (!isContainer(f.v)) {
        out.push(`${pad}<${f.name} t="${kind}">${xmlEscape(xmlLeafText(f.v))}</${f.name}>`);
        stack.pop();
        continue;
      }
      f.keys = keyListOf(f.v);
      f.i = 0;
      // 空容器一律写成对标签：两种写法都读得懂，选读侧只有一种解释的那一个（U10）
      if (f.keys.length === 0) {
        out.push(`${pad}<${f.name} t="${kind}"></${f.name}>`);
        stack.pop();
        continue;
      }
      out.push(`${pad}<${f.name} t="${kind}">`);
      continue;
    }
    if (f.i >= f.keys.length) {
      out.push(`${unit.repeat(f.level)}</${f.name}>`);
      stack.pop();
      continue;
    }
    const key = f.keys[f.i];
    f.i += 1;
    stack.push({
      name: Array.isArray(f.v) ? 'item' : String(key),
      v: f.v[key],
      level: f.level + 1,
      keys: null,
      i: 0,
    });
  }
  return { ok: true, text: `${out.join('\n')}\n` };
}

/** 读侧内部的中断信号：只在模块内抛与接，绝不越过导出面（越界处 + kind + 人话原因） */
class OutOfSubset {
  constructor(kind, index, why) {
    this.kind = kind;
    this.index = index;
    this.why = why;
  }
}

/** 在制品节点：`start` 是它 `<` 的位置，`contentStart` 是 `>` 之后第一格，`firstAt` 是内容里第一个非空白字符 */
const xmlFrame = (tag, start) => ({
  name: tag.name,
  kind: tag.kind,
  start,
  contentStart: tag.after,
  value: tag.kind === 'obj' ? {} : tag.kind === 'arr' ? [] : null,
  merged: null,
  buf: '',
  firstAt: -1,
});

const xmlIsContainerKind = (kind) => kind === 'obj' || kind === 'arr';

/** 一段内容写进缓冲区，并记住"第一个非空白字符"的位置（bad-value 指认它） */
const xmlAppend = (f, piece, at) => {
  if (f.firstAt < 0) {
    for (let i = 0; i < piece.length; i += 1) {
      if (!isWs(piece.charAt(i))) { f.firstAt = at + i; break; }
    }
  }
  f.buf += piece;
};

/** 读一个开始标签（根与子共用）。名字段扫到空白 / `/` / `>` 为止，整段一起校验，越界指认段首 */
const readOpenTag = (text, at, level) => {
  if (level > MAX_DEPTH) {
    throw new OutOfSubset('depth', at, `嵌套到第 ${level} 层，超出本站的 ${MAX_DEPTH} 层上限`);
  }
  const n = text.length;
  let k = at + 1;
  while (k < n && !isWs(text.charAt(k)) && text.charAt(k) !== GT && text.charAt(k) !== SLASH) k += 1;
  if (k >= n) throw new OutOfSubset('unterminated', at, '标签没有 > 收尾');
  const name = text.slice(at + 1, k);
  if (name === '') throw new OutOfSubset('bad-name', at + 1, '元素名一个字符都没有');
  if (!isLegalName(name)) throw new OutOfSubset('bad-name', at + 1, `元素名 ${name} 不合法`);
  let i = k;
  const attrs = [];
  let selfClosing = false;
  for (;;) {
    i = skipWs(text, i);
    if (i >= n) throw new OutOfSubset('unterminated', at, '标签没有 > 收尾');
    const c = text.charAt(i);
    if (c === GT) { i += 1; break; }
    if (c === SLASH) {
      if (text.charAt(i + 1) !== GT) throw new OutOfSubset('bad-attr', i, '斜杠后面不是 >');
      selfClosing = true;
      i += 2;
      break;
    }
    const s = i;
    while (i < n && !isWs(text.charAt(i)) && text.charAt(i) !== EQ && text.charAt(i) !== GT && text.charAt(i) !== SLASH) i += 1;
    const aName = text.slice(s, i);
    if (aName === '') throw new OutOfSubset('bad-attr', i, '属性名一个字符都没有');
    if (!isLegalName(aName)) throw new OutOfSubset('bad-name', s, `属性名 ${aName} 不合法`);
    i = skipWs(text, i);
    if (text.charAt(i) !== EQ) throw new OutOfSubset('bad-attr', s, `属性 ${aName} 后面没有等号`);
    i = skipWs(text, i + 1);
    const q = text.charAt(i);
    if (q !== QUOTE && q !== APOS) throw new OutOfSubset('bad-attr', s, `属性 ${aName} 的值没有引号`);
    const close = text.indexOf(q, i + 1);
    if (close === -1) throw new OutOfSubset('unterminated', i, '属性的引号没有合上');
    attrs.push({ name: aName, at: s, value: text.slice(i + 1, close), valueAt: i });
    i = close + 1;
  }
  if (attrs.length > 1) {
    throw new OutOfSubset('bad-attr', attrs[1].at, `元素 ${name} 上只许有 t 这一个属性`);
  }
  if (attrs.length === 0) {
    throw new OutOfSubset('bad-shape', at, `元素 ${name} 缺 t 属性：这一族把类型写在 t= 上`);
  }
  const t = attrs[0];
  if (t.name !== 't') throw new OutOfSubset('bad-attr', t.at, `元素 ${name} 的属性名是 ${t.name}，本站只认 t`);
  if (!XML_KINDS.includes(t.value)) {
    throw new OutOfSubset('bad-shape', t.valueAt, `t 的值 ${t.value} 不在册，只认 ${XML_KINDS.join(' / ')}`);
  }
  return { name, kind: t.value, selfClosing, after: i };
};

/** 注释：`<!--` 起始，越界指认它自己的 `<`（读不下去的时候，指认构造的开头最有用） */
const readComment = (text, at) => {
  const end = text.indexOf('-->', at + 4);
  if (end === -1) throw new OutOfSubset('unterminated', at, '注释没有 --> 收尾');
  return end + 3;
};

/** CDATA：内容原样进缓冲区，里面的尖括号与 & 都不算标签也不算实体（U13 的接受面） */
const readCdata = (text, at, f) => {
  const end = text.indexOf(']]>', at + 9);
  if (end === -1) throw new OutOfSubset('unterminated', at, 'CDATA 没有 ]]> 收尾');
  xmlAppend(f, text.slice(at + 9, end), at + 9);
  return end + 3;
};

/** 实体引用：五个预定义 + 数字引用，数字引用要过 XML 1.0 的字符集与代理项两档 */
const readEntity = (text, at, f) => {
  const semi = text.indexOf(SEMI, at + 1);
  if (semi === -1) throw new OutOfSubset('bad-entity', at, '实体引用没有分号收尾');
  const body = text.slice(at + 1, semi);
  if (body.charAt(0) === '#') {
    const hex = body.charAt(1) === 'x' || body.charAt(1) === 'X';
    const digits = hex ? body.slice(2) : body.slice(1);
    if (!digits || !/^[0-9a-fA-F]+$/.test(digits)) {
      throw new OutOfSubset('bad-entity', at, `数字引用 &#${hex ? 'x' : ''}${body.slice(1)}; 的数字不合法`);
    }
    const code = parseInt(digits, hex ? 16 : 10);
    if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) || !isXmlChar(code)) {
      throw new OutOfSubset('bad-entity', at, `数字引用指向的 ${hexPoint(code)} 不是 XML 1.0 能存的字符`);
    }
    xmlAppend(f, String.fromCodePoint(code), at);
    return semi + 1;
  }
  if (!hasOwn(XML_ENTITIES, body)) {
    throw new OutOfSubset('bad-entity', at,
      `未注册的实体 &${body};：这一族只认 ${Object.keys(XML_ENTITIES).map((k) => `&${k};`).join(' ')}，也不读外部实体`);
  }
  xmlAppend(f, XML_ENTITIES[body], at);
  return semi + 1;
};

/** XML 1.0 的字符集（数字引用那一档用它校验；C0 里只留 `\t` `\n` `\r`） */
const isXmlChar = (code) => code === 9 || code === 10 || code === 13
  || (code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd)
  || (code > 0xffff && code <= 0x10ffff);

/** 子元素完成 → 挂到父亲身上。对象键同名时归并成数组（本站的写器发不出这一族，它是为手改过的合法 XML 留的） */
const xmlAttach = (parent, name, value) => {
  if (parent.kind === 'arr') { parent.value.push(value); return; }
  if (hasOwn(parent.value, name)) {
    if (parent.merged === null) parent.merged = new Map();
    if (parent.merged.has(name)) { parent.merged.get(name).push(value); return; }
    const merged = [parent.value[name], value];
    parent.merged.set(name, merged);
    setOwn(parent.value, name, merged);
    return;
  }
  setOwn(parent.value, name, value);
};

/** 标量内容收口：`str` 不 trim，其余三档按 trim 后的内容校验，越界指认第一个非空白字符（U12） */
const xmlScalarValue = (f) => {
  if (f.kind === 'str') return f.buf;
  const trimmed = f.buf.trim();
  const at = f.firstAt < 0 ? f.contentStart : f.firstAt;
  if (f.kind === 'null') {
    if (trimmed !== '') throw new OutOfSubset('bad-value', at, `类型 null 的内容必须是空的，这里是 ${trimmed}`);
    return null;
  }
  if (f.kind === 'bool') {
    if (trimmed !== 'true' && trimmed !== 'false') {
      throw new OutOfSubset('bad-value', at, `类型 bool 的内容只能是 true 或 false，这里是 ${trimmed}`);
    }
    return trimmed === 'true';
  }
  if (!NUM_RE.test(trimmed)) {
    throw new OutOfSubset('bad-value', at, `${trimmed === '' ? '（空）' : trimmed} 不是合法的 JSON 数字`);
  }
  return Number(trimmed);
};

const xmlDone = (f) => (xmlIsContainerKind(f.kind) ? f.value : xmlScalarValue(f));

/**
 * 值树：显式栈，深度由 `readOpenTag` 那一格当场判（边扫边判，不然 1001 层的输入
 * 先炸调用栈，报出来的就不是行列号了）。
 * @returns {{value: unknown, next: number}}
 */
const readXmlTree = (text, at) => {
  const open = readOpenTag(text, at, 1);
  const rootFrame = xmlFrame(open, at);
  let i = open.after;
  if (open.selfClosing) return { value: xmlDone(rootFrame), next: i };
  const stack = [rootFrame];
  while (stack.length > 0) {
    const f = stack[stack.length - 1];
    if (xmlIsContainerKind(f.kind)) {
      i = skipWs(text, i);
      if (text.startsWith('<!--', i)) { i = readComment(text, i); continue; }
      const c = text.charAt(i);
      if (c === '') throw new OutOfSubset('unterminated', i, `元素 ${f.name} 没有闭合标签`);
      if (c === LT && text.startsWith(SLASH, i + 1)) {
        i = readCloseTag(text, i, f.name);
        const value = xmlDone(f);
        stack.pop();
        if (stack.length === 0) return { value, next: i };
        xmlAttach(stack[stack.length - 1], f.name, value);
        continue;
      }
      if (c === LT && !text.startsWith('![', i + 1)) {
        const childAt = i;
        const child = readOpenTag(text, i, stack.length + 1);
        if (f.kind === 'arr' && child.name !== 'item') {
          throw new OutOfSubset('bad-shape', childAt, `数组里的子元素必须叫 item，这里是 ${child.name}`);
        }
        i = child.after;
        const childFrame = xmlFrame(child, childAt);
        if (child.selfClosing) xmlAttach(f, child.name, xmlDone(childFrame));
        else stack.push(childFrame);
        continue;
      }
      throw new OutOfSubset('bad-shape', i,
        f.kind === 'arr' ? '数组里只能有 item 元素，这里出现了裸文本' : '对象里只能有子元素，这里出现了裸文本');
    }
    // 标量：一路读到 `</`，中间的 CDATA 与注释不算内容的一部分（注释跳过、CDATA 进文本）
    for (;;) {
      if (i >= text.length) throw new OutOfSubset('unterminated', i, `元素 ${f.name} 没有闭合标签`);
      const c = text.charAt(i);
      if (c === LT) {
        if (text.startsWith('!--', i + 1)) { i = readComment(text, i); continue; }
        if (text.startsWith('![CDATA[', i + 1)) { i = readCdata(text, i, f); continue; }
        if (text.startsWith(SLASH, i + 1)) break;
        throw new OutOfSubset('bad-shape', i, `类型 ${f.kind} 的内容里不许有子元素`);
      }
      if (c === AMP) { i = readEntity(text, i, f); continue; }
      let k = i;
      while (k < text.length && text.charAt(k) !== LT && text.charAt(k) !== AMP) k += 1;
      xmlAppend(f, text.slice(i, k), i);
      i = k;
    }
    i = readCloseTag(text, i, f.name);
    const value = xmlDone(f);
    stack.pop();
    if (stack.length === 0) return { value, next: i };
    xmlAttach(stack[stack.length - 1], f.name, value);
  }
  throw new OutOfSubset('bad-document', text.length, '没有读完一个完整的根元素');
};

/** 闭合标签：名字必须与开着的那个逐字相同，且不许带属性 */
const readCloseTag = (text, at, name) => {
  const n = text.length;
  const s = at + 2;
  let k = s;
  while (k < n && !isWs(text.charAt(k)) && text.charAt(k) !== GT) k += 1;
  if (k >= n) throw new OutOfSubset('unterminated', at, `闭合标签 </${name}> 没有 > 收尾`);
  const got = text.slice(s, k);
  if (got !== name) throw new OutOfSubset('bad-name', at, `闭合标签是 ${got}，但它要关的是 ${name}`);
  const after = skipWs(text, k);
  if (text.charAt(after) !== GT) throw new OutOfSubset('bad-attr', k, `闭合标签 </${name}> 里不许有属性`);
  return after + 1;
};

/**
 * XML 文本 → JSON 值。只读本站那一族子集，越界整体拒绝并指认位置（U12 四十八档逐个钉）。
 * BOM 与 CSV 同一条口径（U15、U16）：剥掉它才解析（它是字节序记号，不是内容，也不占"根元素之前"
 * 那一族的空白），但**位置一律指原文**——面板高亮吃的是用户粘进去的那一份，BOM 就占第 1 行第 1 列。
 * @param {string} text
 * @returns {{ok: true, value: unknown} | {ok: false, error: {kind: string, message: string, line: number, column: number, index: number, snippet: string}}}
 */
export function xmlToJson(text) {
  typeGuard('xmlToJson', text);
  const g = gate(text);
  if (!g.ok) return { ok: false, error: gateError(g, text) };
  const bom = text.charCodeAt(0) === 0xfeff;
  const body = bom ? text.slice(1) : text;
  const shift = bom ? 1 : 0;
  const at = (index) => index + shift;
  try {
    const n = body.length;
    let i = 0;
    let sawDecl = false;
    for (;;) {
      i = skipWs(body, i);
      if (i >= n) {
        return { ok: false, error: readError('empty', text, at(n), '没有找到根元素：整份输入是空的、只有空白，或只有声明与注释') };
      }
      if (body.charAt(i) !== LT) {
        return { ok: false, error: readError('bad-document', text, at(i), '根元素之前只许空白、注释、声明与处理指令') };
      }
      if (body.startsWith(SLASH, i + 1)) {
        return { ok: false, error: readError('bad-document', text, at(i), '文档以闭合标签开头，找不到要开的那个根元素') };
      }
      if (body.startsWith('!', i + 1)) {
        if (body.startsWith('--', i + 2)) { i = readComment(body, i); continue; }
        if (body.startsWith('[CDATA[', i + 2)) {
          return { ok: false, error: readError('bad-document', text, at(i), '根元素之前不许有 CDATA') };
        }
        return { ok: false, error: readError('doctype', text, at(i), '本站不读文档类型声明（DOCTYPE）与外部实体') };
      }
      if (body.startsWith('?', i + 1)) {
        const end = body.indexOf('?>', i);
        if (end === -1) throw new OutOfSubset('unterminated', i, '处理指令没有 ?> 收尾');
        let k = i + 2;
        while (k < n && !isWs(body.charAt(k)) && body.charAt(k) !== GT && body.charAt(k) !== '?') k += 1;
        if (body.slice(i + 2, k).toLowerCase() === 'xml') {
          if (sawDecl) {
            return { ok: false, error: readError('bad-document', text, at(i), 'XML 声明只能出现在文档最开头一次') };
          }
          sawDecl = true;
        }
        i = end + 2;
        continue;
      }
      break;
    }
    const tree = readXmlTree(body, i);
    const trailing = skipWs(body, tree.next);
    if (trailing < n) {
      return { ok: false, error: readError('trailing', text, at(trailing), '根元素之后还有内容：本站只读一个根元素') };
    }
    return { ok: true, value: tree.value };
  } catch (err) {
    if (err instanceof OutOfSubset) {
      return { ok: false, error: readError(err.kind, text, at(err.index), err.why) };
    }
    throw err;
  }
}

// ── CSV 那一族 ───────────────────────────────────────────────────────────────

/**
 * 分隔符是"档位"不是"字符串"：与 §S 的 modeOf 同形，非法值当场 `RangeError`。
 * `undefined` 走默认逗号（面板的控件把"没选"传成 undefined），其余一律单个字符、
 * 且不能是 `"` 或换行——那三种会让写出去的文本读不回来。
 */
const resolveDelimiter = (api, value) => {
  if (value === undefined) return ',';
  if (typeof value !== 'string' || value.length !== 1 || value === QUOTE || value === '\n' || value === '\r') {
    throw new RangeError(`${api} 的分隔符只认单个字符，且不能是引号或换行：收到的是 ${describeBad(value)}`);
  }
  return value;
};

const describeBad = (v) => (typeof v === 'string' ? JSONish(v) : String(v));

/** 把任意入参写成可看的样子，但不借 JSON.stringify（U18 那条禁令） */
const JSONish = (s) => `"${escapeText(s)}"`;

const cellText = (v) => {
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array) return b64(v);
  if (typeof v === 'string') return v;
  if (v === null) return '';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return compactJson(v);
};

/**
 * 嵌套容器 → 一格紧凑 JSON 文本。显式栈（同一族第二个理由：单元格里也可能藏着 999 层）。
 * 数字用 `String(n)`、字符串用 `escapeText`，所以这一格交出去的东西本身就是合法 JSON。
 * @param {unknown} root
 * @returns {string}
 */
const compactJson = (root) => {
  const out = [];
  const stack = [{ v: root, entered: false, keys: null, i: 0 }];
  while (stack.length > 0) {
    const f = stack[stack.length - 1];
    if (!f.entered) {
      f.entered = true;
      const isArr = Array.isArray(f.v);
      f.keys = keyListOf(f.v);
      out.push(isArr ? '[' : '{');
      if (f.keys.length === 0) {
        out.push(isArr ? ']' : '}');
        stack.pop();
      }
      continue;
    }
    if (f.i >= f.keys.length) {
      out.push(Array.isArray(f.v) ? ']' : '}');
      stack.pop();
      continue;
    }
    const key = f.keys[f.i];
    f.i += 1;
    if (f.i > 1) out.push(',');
    const child = f.v[key];
    if (!Array.isArray(f.v)) {
      out.push(`"${escapeText(String(key))}":`);
      if (child instanceof Date) out.push(`"${escapeText(child.toISOString())}"`);
      else if (child instanceof Uint8Array) out.push(`"${escapeText(b64(child))}"`);
      else if (isContainer(child)) stack.push({ v: child, entered: false, keys: null, i: 0 });
      else out.push(scalarJson(child));
      continue;
    }
    if (child instanceof Date) out.push(`"${escapeText(child.toISOString())}"`);
    else if (child instanceof Uint8Array) out.push(`"${escapeText(b64(child))}"`);
    else if (isContainer(child)) stack.push({ v: child, entered: false, keys: null, i: 0 });
    else out.push(scalarJson(child));
  }
  return out.join('');
};

const scalarJson = (v) => {
  if (typeof v === 'string') return `"${escapeText(v)}"`;
  if (v === null) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return 'null';
};

const csvQuote = (text, delimiter) => {
  let need = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charAt(i);
    if (c === delimiter || c === QUOTE || c === '\n' || c === '\r') { need = true; break; }
  }
  if (!need) return text;
  let out = QUOTE;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charAt(i);
    out += c === QUOTE ? '""' : c;
  }
  return out + QUOTE;
};

/** 表头占位与去重：空键名给 `col_<1 起的序号>`，撞名（含撞占位名）就往后加 `__2`、`__3`（U14/U15） */
const uniqueColumnName = (used, base, position) => {
  const root = base === '' ? `col_${position}` : base;
  if (!used.has(root)) {
    used.add(root);
    return root;
  }
  let k = 2;
  while (used.has(`${base}__${k}`)) k += 1;
  const name = `${base}__${k}`;
  used.add(name);
  return name;
};

const CSV_SHAPE_MESSAGE = 'CSV 只收两种形状：对象数组（每个对象一行）或单个对象（当一行看）。'
  + '标量、纯数组与数组套数组没有"列"这一层，写不成一张表。';

/**
 * JSON 值 → CSV 文本（CRLF 收尾、RFC 4180 的引号转义、嵌套容器压成一格 JSON 文本）。
 * @param {unknown} value
 * @param {{delimiter?: string}} [options]
 * @returns {{ok: true, text: string} | {ok: false, error: {kind: string, message: string, path: string}}}
 */
export function jsonToCsv(value, options = {}) {
  const opts = options || {};
  const delimiter = resolveDelimiter('jsonToCsv', opts.delimiter);
  const rows = Array.isArray(value) ? value : [value];
  const shapeError = csvShapeOf(value, rows);
  if (shapeError) return { ok: false, error: shapeError };
  const scan = scanJson(value, MAX_DEPTH);
  if (!scan.ok) return { ok: false, error: scan.error };

  // 列由**键的出场顺序**决定；`columns` 是给人看的名，`columnKey` 是取格子用的真键
  // （表头会改空键名与撞名，两者不是一回事，靠 indexOf 反查既慢又会在撞名时取错格子）
  const columns = [];
  const columnKey = [];
  const seen = new Map();
  const used = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.set(key, columns.length);
        columns.push(uniqueColumnName(used, key, columns.length + 1));
        columnKey.push(key);
      }
    }
  }
  if (columns.length === 0) {
    return {
      ok: false,
      error: { kind: 'empty', message: '这些对象一个键都没有，写不出表头：至少给一行带键的对象。', path: '' },
    };
  }
  const lines = [columns.map((name) => csvQuote(name, delimiter)).join(delimiter)];
  for (const row of rows) {
    const cells = [];
    for (let c = 0; c < columns.length; c += 1) {
      const key = columnKey[c];
      cells.push(csvQuote(cellText(hasOwn(row, key) ? row[key] : null), delimiter));
    }
    lines.push(cells.join(delimiter));
  }
  return { ok: true, text: `${lines.join('\r\n')}\r\n` };
}

/** 形状闸门：`[]` / `[{}]` / `{}` 落 empty（没有列可写），其余非"对象数组/对象"落 shape（U14） */
const csvShapeOf = (value, rows) => {
  const bad = (kind, message) => ({ kind, message, path: '' });
  if (Array.isArray(value)) {
    for (const row of rows) {
      if (!isPlainObject(row)) return bad('shape', CSV_SHAPE_MESSAGE);
    }
    return null;
  }
  if (isPlainObject(value)) return null;
  return bad('shape', CSV_SHAPE_MESSAGE);
};

/**
 * CSV 文本 → 对象数组。一律字符串（`meta.allStrings` 这一格就是说给它自己的），
 * 并交回六格 meta：面板上"几行几列、什么换行、有没有 BOM"读的就是它。
 * @param {string} text
 * @param {{delimiter?: string}} [options]
 * @returns {{ok: true, value: object[], meta: {rows: number, columns: number, delimiter: string, allStrings: boolean, bom: boolean, lineEnding: string}} | {ok: false, error: {kind: string, message: string, line: number, column: number, index: number, snippet: string}}}
 */
export function csvToJson(text, options = {}) {
  typeGuard('csvToJson', text);
  const opts = options || {};
  const delimiter = resolveDelimiter('csvToJson', opts.delimiter);
  const g = gate(text);
  if (!g.ok) return { ok: false, error: gateError(g, text) };
  const bom = text.charCodeAt(0) === 0xfeff;
  const body = bom ? text.slice(1) : text;
  // 位置一律报回**用户手里那一份文本**的坐标：BOM 是第 1 行第 1 列那一个字符，
  // 所以从 body 读回来的下标要整体加回去（面板拿它做选区，差一格就高亮错一格）。
  const shift = bom ? 1 : 0;
  const at = (index) => index + shift;
  try {
    if (onlyWhitespace(body)) {
      return {
        ok: false,
        error: readError('empty', text, text.length, '没有可解析的 CSV 内容：整份输入是空的、只有空白，或只有空行'),
      };
    }
    const { records, endings } = readRecords(body, delimiter);
    const header = records[0].cells;
    const used = new Set();
    const names = header.map((cell, index) => uniqueColumnName(used, cell, index + 1));
    const rows = [];
    for (let r = 1; r < records.length; r += 1) {
      const { cells, at: starts } = records[r];
      if (cells.length > names.length) {
        throw new OutOfCsv('ragged', starts[names.length],
          `这一行有 ${cells.length} 格，表头只有 ${names.length} 格`);
      }
      const row = {};
      for (let c = 0; c < names.length; c += 1) setOwn(row, names[c], cells[c] === undefined ? '' : cells[c]);
      rows.push(row);
    }
    const kinds = [...endings];
    return {
      ok: true,
      value: rows,
      meta: {
        rows: rows.length,
        columns: names.length,
        delimiter,
        allStrings: true,
        bom,
        lineEnding: kinds.length === 0 ? 'none' : kinds.length === 1 ? kinds[0] : 'mixed',
      },
    };
  } catch (err) {
    if (err instanceof OutOfCsv) {
      return { ok: false, error: readError(err.kind, text, at(err.index), err.why) };
    }
    throw err;
  }
}

/** 整份输入是不是只有空格、制表与换行（空行也算）——没有表头可读，就是"没有内容"那一档（U16） */
const onlyWhitespace = (text) => {
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charAt(i);
    if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') return false;
  }
  return true;
};

/** 读侧内部的 CSV 中断信号（与 XML 的 OutOfSubset 同一条理由：不外泄）。位置交给 readError 换算 */
class OutOfCsv {
  constructor(kind, index, why) {
    this.kind = kind;
    this.index = index;
    this.why = why;
  }
}

/**
 * RFC 4180 的状态机，补三处：引号 doubling、内嵌换行、CRLF（外加老 Mac 的裸 CR）。
 * 交回"记录 → 格子数组"与每格的起始下标，越界那一档才指认得出多出来的那一格。
 * @returns {{records: Array<{cells: string[], at: number[]}>, endings: Set<string>}}
 */
const readRecords = (text, delimiter) => {
  const records = [];
  const endings = new Set();
  let cells = [];
  let starts = [];
  let cell = '';
  let cellAt = 0;
  let cellStarted = false;
  let quoted = false;
  let quoteAt = -1;
  let i = 0;
  const flushCell = (at) => {
    cells.push(cell);
    starts.push(at);
    cell = '';
    cellStarted = false;
  };
  const flushRecord = () => {
    records.push({ cells, at: starts });
    cells = [];
    starts = [];
  };
  while (i < text.length) {
    const c = text.charAt(i);
    if (quoted) {
      if (c === QUOTE) {
        if (text.charAt(i + 1) === QUOTE) { cell += QUOTE; i += 2; continue; }
        quoted = false;
        i += 1;
        continue;
      }
      cell += c;
      i += 1;
      continue;
    }
    if (c === QUOTE && !cellStarted) {
      quoted = true;
      quoteAt = i;
      cellStarted = true;
      i += 1;
      continue;
    }
    if (c === delimiter) { flushCell(cellAt); cellAt = i + 1; i += 1; continue; }
    if (c === '\r' || c === '\n') {
      if (c === '\r' && text.charAt(i + 1) === '\n') { endings.add('crlf'); i += 2; } else {
        endings.add(c === '\r' ? 'cr' : 'lf');
        i += 1;
      }
      flushCell(cellAt);
      flushRecord();
      cellAt = i;
      continue;
    }
    cell += c;
    cellStarted = true;
    i += 1;
  }
  if (quoted) {
    throw new OutOfCsv('unterminated', quoteAt, '引号包住的字段没有闭合的引号');
  }
  if (cell !== '' || cellStarted || cells.length > 0) {
    flushCell(cellAt);
    flushRecord();
  }
  return { records, endings };
};

/**
 * 三个往返读数：面板上那三个"是否等价"。定义与判据里的手工往返逐字一致
 * （写侧不抛且 ok、读侧 ok、回来与原值深相等），所以它显示 ✓ 的时候一定真等价；
 * 转不了的那些族（环、非 JSON 值、超过 YAML 深度的嵌套）交回 false 而不是抛。
 * @param {unknown} value
 * @returns {{yaml: boolean, xml: boolean, csv: boolean}}
 */
export function roundTrips(value) {
  return {
    yaml: canRoundTrip(value, jsonToYaml, yamlToJson),
    xml: canRoundTrip(value, jsonToXml, xmlToJson),
    csv: canRoundTrip(value, jsonToCsv, csvToJson),
  };
}

const canRoundTrip = (value, write, read) => {
  try {
    const written = write(value);
    if (!written.ok) return false;
    const back = read(written.text);
    return back.ok === true && sameValue(back.value, value);
  } catch {
    return false;
  }
};

/**
 * 深相等，严格到把 `-0` 与 `+0` 分成两格（`uRound` 用的就是 assert.deepStrictEqual 的口径）。
 * 迭代而不是递归：这一族要处理 1000 层的合法输入。
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
const sameValue = (a, b) => {
  const stack = [[a, b]];
  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (Object.is(x, y)) continue;
    if (x === null || y === null || typeof x !== 'object' || typeof y !== 'object') return false;
    const xArr = Array.isArray(x);
    if (xArr !== Array.isArray(y)) return false;
    if (x instanceof Date || y instanceof Date || x instanceof Uint8Array || y instanceof Uint8Array) return false;
    const xa = xArr ? keyListOf(x) : Object.keys(x);
    const yb = xArr ? keyListOf(y) : Object.keys(y);
    if (xa.length !== yb.length) return false;
    for (let i = 0; i < xa.length; i += 1) {
      const key = xa[i];
      if (String(key) !== String(yb[i])) return false;
      stack.push([x[key], y[key]]);
    }
  }
  return true;
};
