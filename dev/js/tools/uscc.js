/**
 * 统一社会信用代码（GB 32100-2015）：31 字符集、双校验位、三态判定、测试码生成。
 *
 * 结构：1 位登记管理部门 + 1 位机构类别 + 6 位行政区划 + 9 位主体标识
 * （8 位本体 + 1 位组织机构代码校验位）+ 1 位本代码校验位。前 17 位按字符集下标取值、
 * 以 3^(i-1) mod 31 加权，末位 = 字符集[(31 − Σ mod 31) mod 31]。
 *
 * 第 1、2 位的取值含义表没取到可核实来源，所以这里只校验字符合法性、只给字符与值、
 * 不输出任何名称（见 REFERENCE_NOTE）。内层校验值 10 的两种写法未核实口径，
 * 解析侧两种都放行、生成侧直接回避——三档处理见设计文档 §5.1 与本段计划 §5.1。
 *
 * 入参闸门与同级模块 `idcard.js` 同档（判据是 §C 的「C9 入参闸门与身份证模块同档」）：
 * 整个 options 传 null / undefined 都等于没传；`count` 只把「没传」（undefined）当默认值；
 * `rng` 先验是不是函数、再验每次取值是否落在 [0, 1)；`regionCode` / `provinceCode` 只接受
 * **非空字符串**，空串、全空白、数值、null 一律抛并点名是哪个键。报错文案里的"收到什么"
 * 一律带类型（`string nope` / `number 2` / `null`）。
 */
import { resolveRegion, currentCityCodes } from './region.js';
import { seededRandom } from './random.js';

/** 字符集，下标即该字符参与加权时的值；剔除了 I O S Z V，共 31 个 */
export const USCC_CHARSET = '0123456789ABCDEFGHJKLMNPQRTUWXY';
/** 被剔除的五个字母。单独导出是为了让判据能反向核对字符集长度 */
export const FORBIDDEN_CHARS = ['I', 'O', 'S', 'Z', 'V'];
/** 前 17 位加权因子 = 3^(i-1) mod 31 */
export const USCC_WEIGHTS = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];
/** 内层组织机构代码校验位权重（GB 11714）= 2^(8-i) mod 11 */
export const ORG_WEIGHTS = [3, 7, 9, 10, 5, 8, 4, 2];
/** §11 风险表：不提供"批量导出上千条" */
export const GENERATE_MAX = 50;
/** §5.5 合规文案。页面直接取用这一份，别在页面里另抄一版 */
export const USE_NOTE = '随机合成的统一社会信用代码，只在算术上自洽；与真实登记主体重合的概率可忽略，不得用于任何真实主体的查询、申报或对账。';
/** 第 1、2 位为何不显示名称：这是页面必须挂出来的口径说明，不是脚注 */
export const REFERENCE_NOTE = '第 1、2 位（登记管理部门、机构类别）的取值含义表未取到可核实来源，本页只校验这两个字符在 31 字符集内，不给出名称。';

/** 单字符 → 加权值（即下标）。不在字符集内（含小写、空、多字符、非字符串）返回 null */
export function charValue(ch) {
  if (typeof ch !== 'string' || ch.length !== 1) return null;
  const i = USCC_CHARSET.indexOf(ch);
  return i === -1 ? null : i;
}

const allInSet = (s) => [...s].every((c) => charValue(c) !== null);

/** 内层校验值。调用方已保证 body8 为 8 位合法字符 */
function orgChecksum8(body8) {
  let sum = 0;
  for (let i = 0; i < 8; i += 1) sum += USCC_CHARSET.indexOf(body8[i]) * ORG_WEIGHTS[i];
  const remainder = sum % 11;
  return { sum, remainder, value: (11 - remainder) % 11 };
}

/**
 * 由第 9–16 位算内层组织机构代码校验值。
 * @param {string} body8 8 位主体标识本体
 * @returns {{sum:number, remainder:number, value:number}|null} 结构非法返回 null 不抛
 */
export function computeOrgCheckValue(body8) {
  const s = typeof body8 === 'string' ? body8 : '';
  return s.length === 8 && allInSet(s) ? orgChecksum8(s) : null;
}

/** 末位。调用方已保证 body17 为 17 位合法字符 */
function checksum17(body17) {
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += USCC_CHARSET.indexOf(body17[i]) * USCC_WEIGHTS[i];
  const remainder = sum % 31;
  // 余数为 0 时国标口径取字符 '0'。写成 31 − r 会得到 31 而越出字符集；这一档约占 1/31
  const value = (31 - remainder) % 31;
  return { sum, remainder, value, char: USCC_CHARSET[value] };
}

/**
 * 由前 17 位算第 18 位字符。
 * @param {string} body17
 * @returns {string|null} 结构非法返回 null 不抛
 */
export function computeCheckChar(body17) {
  const s = typeof body17 === 'string' ? body17 : '';
  return s.length === 17 && allInSet(s) ? checksum17(s).char : null;
}

/**
 * 解一个 18 位统一社会信用代码。
 *
 * 逐项表按固定顺序五行：字符集 → 长度 → 行政区划 → 主体标识校验位 → 本代码校验位。
 * 每行 `ok` 是三态：true / false / null（null = 这一项不下结论，例如区划未收录、
 * 第 17 位是字母）。**只有 false 才拖垮整体结论**，与身份证模块同口径（设计文档 §5.4）。
 *
 * @param {string|number|null} raw 用户输入
 * @returns {{input:string, value:string, code:string, normalized:boolean,
 *   state:'empty'|'malformed'|'checkdigit'|'valid', checks:Array, info:object|null,
 *   caveat:string, hasCaveat:boolean, repairedHint:string}}
 */
export function parseUscc(raw) {
  const text = raw === null || raw === undefined ? '' : String(raw);
  const trimmed = text.trim();
  const value = trimmed.toUpperCase();
  const compact = value.replace(/\s+/g, '');
  const out = {
    input: text, value, code: '', normalized: value !== trimmed,
    state: 'empty', checks: [], info: null,
    caveat: '', hasCaveat: false, repairedHint: '',
  };
  if (value === '') return out;

  const checks = out.checks;
  const push = (key, label, ok, detail) => checks.push({ key, label, ok, detail });

  // 1) 字符集：31 字符集之外的一切（被剔除的 I O S Z V、小写、别的字母符号）都不符
  const hasInnerSpace = /\s/.test(value);
  const badChars = [...new Set([...compact].filter((c) => charValue(c) === null))];
  const charsetOk = !hasInnerSpace && badChars.length === 0;
  push('charset', '字符集', charsetOk, charsetOk
    ? '全部在 31 字符集内（不含 I O S Z V）'
    : (hasInnerSpace ? '代码中间含空格' : `含非法字符 ${badChars.join(' ')}`));
  if (hasInnerSpace && compact.length === 18) out.repairedHint = compact;

  // 2) 长度
  const lengthOk = compact.length === 18;
  push('length', '长度', lengthOk, `${compact.length} 位${lengthOk ? '' : '（应为 18 位）'}`);
  if (!charsetOk || !lengthOk) {
    out.state = 'malformed';
    return out;
  }

  out.code = compact;
  const regionCode = compact.slice(2, 8);
  const body8 = compact.slice(8, 16);
  const orgChar = compact[16];
  const checkChar = compact[17];

  // 3) 区划段：整段复用 §A 的六档回落。未收录只给 null，绝不下"无效"（§5.4）
  const region = resolveRegion(regionCode);
  const regionOk = region.status === 'current' || region.status === 'abolished'
    ? true : region.status === 'uncoded' ? null : false;
  push('region', '行政区划', regionOk, regionOk === null ? region.note
    : (regionOk ? `${region.fullName}${region.status === 'abolished' ? '（历史码）' : ''}`
      : (region.note || `${regionCode} 无法解析`)));

  // 4) 内层校验位：值 10 的两种写法都放行，字母不下结论（口径见文件头）
  const org = orgChecksum8(body8);
  let orgOk;
  if (org.value === 10 && (orgChar === 'X' || orgChar === 'A')) orgOk = true;
  else if (orgChar >= '0' && orgChar <= '9') orgOk = Number(orgChar) === org.value;
  else orgOk = null;
  push('orgCheck', '主体标识校验位', orgOk,
    `期望 ${org.value === 10 ? '10（写作 X 或 A）' : org.value}，实际 ${orgChar}`);

  // 5) 本代码校验位
  const outer = checksum17(compact.slice(0, 17));
  const checkOk = outer.char === checkChar;
  push('checkBit', '校验位', checkOk, checkOk
    ? `末位 ${checkChar}` : `期望 ${outer.char}，实际 ${checkChar}`);

  out.state = regionOk === false ? 'malformed'
    : (!checkOk || orgOk === false) ? 'checkdigit' : 'valid';

  const caveats = [];
  // 历史码与未收录码都要留话：前者 ok=true 但措辞不能省，后者 ok=null。
  // "同码改名"这件事的账落在 scripts/build-id-fixture.mjs 的四成因统计
  // （renamed / renamedByCounty / renamedByLegacyPrefix / renamedByPlaceholder）
  // 与 region.js 文件头的历史层注释里，判据侧由 B7 的 EXPECT_POOLS 钉着那四个数——
  // 所以这里不留一个别人复算不出来的裸数字。caveats 的这套判据与 idcard.js 同族。
  if (region.status === 'abolished' || region.status === 'uncoded') caveats.push(region.note);
  if (orgOk === null) caveats.push(`第 17 位为字母 ${orgChar}，未按组织机构代码校验位判定`);
  if (out.normalized) caveats.push('输入含小写字母，已按 31 字符集转大写后判定');
  out.caveat = caveats.filter(Boolean).join('；');
  out.hasCaveat = out.caveat !== '';

  out.info = {
    regionCode, region,
    registry: { char: compact[0], value: charValue(compact[0]) },
    category: { char: compact[1], value: charValue(compact[1]) },
    subject: compact.slice(8, 17), body8, orgChar, orgChecksum: org,
    checksum: { sum: outer.sum, remainder: outer.remainder, value: outer.value },
    checkBit: checkChar, expectedCheckBit: outer.char,
  };
  return out;
}

/**
 * 按行解析：空行占一个行号、不静默压缩（用户看到的行号必须和粘贴时一致）。
 * 唯一的例外是"根本没粘贴"：null / undefined / 空串给 **0 行**，而不是凭空造一行 empty 结论
 * ——面板按 rows.length 报"共 N 条"，一行都不该有的时候报 1 条就是错的。
 * 这一格与 parseIdCardList 同形（旧注释写着"同形"、代码却给 1 行；§C 的
 * 「C9 入参闸门与身份证模块同档」现在逐格比对两个批量入口的行号与原文）。
 */
export function parseUsccList(text) {
  const s = String(text === null || text === undefined ? '' : text);
  if (s === '') return [];
  return s
    .split(/\r?\n/)
    .map((raw, i) => ({ no: i + 1, raw, result: parseUscc(raw) }));
}

/**
 * 报错文案里的"收到什么"——形状带上类型，`string nope` / `number 2` / `null`，
 * 让「收到 5」这种读起来像"值 5 不合法"的文案不再出现（数值 5 与字符串 '5' 得分得开）。
 * 绝不 String() 一个 Symbol / 无原型对象（那会自己先抛）。
 *
 * 为什么这里要有第二份、而不是去 import idcard.js 的那一个：shapeOf 在 idcard.js 里是
 * 文件私有的，而本站的同级工具模块互不 import（面板按模块取用，谁也不该因为另一个
 * 工具的口径改动而被拖着回归）。"跨模块口径一致"与"同级模块互不 import"这两条只能选
 * 前者靠判据兜：复制的这两份由 §C 的「C9 入参闸门与身份证模块同档」逐格对着 idcard.js
 * 核，谁单独改口径另一边的格子当场红。
 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? 'Date（Invalid Date）' : 'Date';
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}

/**
 * 校验并包一层可注入随机源。`null` / `undefined` = 没传 → 时间种子；别的形状一律抛。
 *
 * 为什么连"取值"也要查（与 idcard.js 的 checkedRng 同一档）：整改前 `rng: () => 2` 不抛，
 * `pool[Math.floor(2 * pool.length)]` 直接取到 undefined，一路摇成
 * `generateUsccCodes({ rng: () => 2 })` 出的 `91undefined20202020202020202B`，
 * 最后由自检那一关抛「内部不变量被破坏」——调用方的一次错被记成实现的 bug。
 * 现在第一次取值就报，且点名 options.rng。
 * @param {(() => number)|null|undefined} input 入参
 * @returns {() => number} 每次取值都保证落在 [0, 1) 的包装函数
 */
function checkedRng(input) {
  if (input === undefined || input === null) return seededRandom(Date.now());
  if (typeof input !== 'function') {
    throw new TypeError(`generateUsccCodes 的 options.rng 应为 () => number，收到 ${shapeOf(input)}`);
  }
  return () => {
    const v = input();
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1) {
      throw new TypeError(`generateUsccCodes 的 options.rng 每次应给出 [0, 1) 内的有限数，收到 ${shapeOf(v)}`);
    }
    return v;
  };
}

/** 第 1、2 位的默认字符：最常见的那一档，本站不解释其含义（见 REFERENCE_NOTE） */
const DEFAULT_REGISTRY = '9';
const DEFAULT_CATEGORY = '1';

/** 单字符 → 31 字符集内的字符，否则抛：第 1、2 位只校验合法性，不解释含义 */
function singleChar(raw, what) {
  const s = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (s.length !== 1 || charValue(s) === null) {
    throw new RangeError(`${what}应为 31 字符集内的单个字符，收到 ${shapeOf(raw)}`);
  }
  return s;
}

/**
 * 区划段候选：只能是现行码。指定 regionCode 时按 §5.4 拒绝历史码与未收录码。
 *
 * 两个键只接受**非空字符串**（与 idcard.js 的 prefixOf 同一档）：
 *   - `regionCode: 110100`（数值）从前被 `String()` 收下、照常出货——一次类型错误洗成合法入参；
 *   - `provinceCode: ''` 从前等于放开整张现行市级池（`currentCityCodes()` 那一串）——
 *     "收窄到零候选"与"没收窄"是两种完全不同的用户意图，不许混为一谈；
 *   - `null` 在这里跟 `undefined` 分家：undefined = 没传，null 一律抛。
 * idcard 的三个键是一条优先级链、只看传了的那一个；这里两个键各管一档（整码与前缀），
 * 所以**两个键都验**再谈优先级——只验第一个传了的键，等于给
 * `{ regionCode: '110100', provinceCode: null }` 这类拼错的载荷留一条静默通道。
 * @param {object} o 已通过 `options ?? {}` 归一的入参对象
 * @returns {string[]} 六个数字组成的区划段候选池
 */
function regionPool(o) {
  for (const key of ['regionCode', 'provinceCode']) {
    const v = o[key];
    if (v === undefined) continue;
    if (typeof v !== 'string' || v.trim() === '') {
      throw new TypeError(`generateUsccCodes 的 options.${key} 应为非空字符串（行政区划码），收到 ${shapeOf(v)}`);
    }
  }
  if (o.regionCode !== undefined) {
    const code = o.regionCode.trim().toUpperCase();
    const r = resolveRegion(code);
    if (r.status !== 'current') {
      const why = r.status === 'abolished' ? '历史码只许解、不许生成'
        : r.status === 'uncoded' ? '未收录码不能用于生成' : '省 / 市 / 县三级都落不到';
      throw new RangeError(`区划段 ${code} 不是现行码（${r.note || why}）；${why}`);
    }
    return [code];
  }
  const cities = currentCityCodes(o.provinceCode === undefined ? '' : o.provinceCode.trim());
  if (cities.length === 0) {
    throw new RangeError(`省码 ${o.provinceCode.trim()} 下没有现行市级区划`);
  }
  return cities.map((c) => `${c}00`);
}

/**
 * 8 位主体标识本体（数字）。掷完先算内层校验值，落在 10 就把末位挪一格：
 * 值 10 该写 'X' 还是 'A' 未核实（文件头），生成侧不碰这个分支就好。
 * 前 7 位固定时使值为 10 的末位在 0..9 里至多一个，所以挪一次必然避开。
 */
function rollBody8(rng) {
  const digits = [];
  for (let i = 0; i < 8; i += 1) digits.push(Math.floor(rng() * 10));
  if (orgChecksum8(digits.join('')).value === 10) {
    digits[7] = digits[7] === 0 ? 1 : digits[7] - 1;
  }
  return digits.join('');
}

/**
 * 生成校验位成立的测试码。**区划段只能出自现行表**（§5.4：历史码只许解、不许生成）。
 * 每条生成后立刻用 parseUscc 自检，逐项只要不是 true 就抛——生成器与校验器互为对手。
 *
 * 入参闸门与 `generateIdCards` 同档（逐格由 §C 的「C9 入参闸门与身份证模块同档」钉住）：
 * 整个 `options` 传 `null` / `undefined` 等于没传；`count` 只把 `undefined` 当默认值，
 * `null` / `'5'` / `1.5` / 越界一律 `RangeError`；`rng` 不是函数或取值越出 [0, 1) 抛
 * `TypeError` 并点名 options.rng；`regionCode` / `provinceCode` 只接受非空字符串，
 * 空串、全空白、数值、`null` 一律 `TypeError` 并点名是哪个键；`registry` / `category`
 * 必须是 31 字符集内的单个字符（数值从前被 `String()` 洗成合法字符，这一格跟着 M-11 堵掉；
 * 而它的 `null` / `undefined` 算"没传、用默认字符"——这与 idcard 的 `minAge ?? 18`、
 * `sex ?? null` 同一档，只有 `count` 那一格拆掉了 `??`，因为它吞下去的是"出几条"）。
 * 为什么 registry / category 这两格留 `RangeError` 而不是 `TypeError`：它把"是不是一个字符"
 * 与"在不在字符集里"写成了一次判定，与 `count` 那一格同族——idcard.js 的 m-4 已经把这种
 * "形状与取值混在一句"的分类法如实记过一笔，这里照同一档处理，不另立第三套口径。
 *
 * @param {{provinceCode?:string, regionCode?:string, registry?:string, category?:string,
 *   count?:number, rng?:() => number}} [options] registry / category 是第 1、2 位字符，
 *   只校验是否在 31 字符集内，默认 '9' 与 '1'（最常见的那一档，本站不解释其含义）。
 *   整个对象传 `null` / `undefined` 等于没传
 * @returns {Array<{code:string, regionCode:string, regionName:string, registryChar:string,
 *   categoryChar:string, subject:string, orgCheckBit:string, checkBit:string, caveat:string}>}
 */
export function generateUsccCodes(options = {}) {
  const o = options ?? {};
  const rng = checkedRng(o.rng);
  // 只把「没传」当默认值：`?? 1` 会把 count: null 也吞成 1，等于一次类型错误静默出货一条码
  // （idcard 的 B8 早把这个写法点名拆掉了，uscc 这一格从前照抄着踩同一个坑）
  const count = o.count === undefined ? 1 : o.count;
  if (!Number.isInteger(count) || count < 1 || count > GENERATE_MAX) {
    throw new RangeError(`数量应为 1..${GENERATE_MAX} 的整数，收到 ${shapeOf(o.count)}`);
  }
  const registry = singleChar(o.registry ?? DEFAULT_REGISTRY,
    'generateUsccCodes 的 options.registry（登记管理部门代码，第 1 位）');
  const category = singleChar(o.category ?? DEFAULT_CATEGORY,
    'generateUsccCodes 的 options.category（机构类别代码，第 2 位）');
  const pool = regionPool(o);
  const list = [];
  for (let i = 0; i < count; i += 1) {
    const regionCode = pool[Math.floor(rng() * pool.length)];
    const body8 = rollBody8(rng);
    const org = orgChecksum8(body8);
    const body17 = `${registry}${category}${regionCode}${body8}${org.value}`;
    const code = body17 + checksum17(body17).char;
    const self = parseUscc(code);
    const bad = self.checks.filter((k) => k.ok !== true);
    if (self.state !== 'valid' || bad.length > 0) {
      throw new Error(`内部不变量被破坏：生成的 ${code} 自检未通过（`
        + `state=${self.state}${bad.map((k) => `,${k.key}=${String(k.ok)}`).join('')}）`);
    }
    list.push({
      code, regionCode, regionName: self.info.region.fullName,
      registryChar: registry, categoryChar: category,
      subject: body17.slice(8, 17), orgCheckBit: String(org.value),
      checkBit: code[17], caveat: self.caveat,
    });
  }
  return list;
}
