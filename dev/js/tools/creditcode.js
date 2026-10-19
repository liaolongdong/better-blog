/**
 * 机构信用代码（人民银行旧版“中征码”）：18 位。
 *
 * 结构：1 位准入登记管理机构类别（大写字母）+ 2 位机构类别 + 6 位行政区划
 * + 8 位结算账户开户许可证核准号标识 + 1 位校验位。校验算法来自公开流传的
 * 中征码实现：模 36，字符值 0–9 为 0–9、A–Z 为 10–35、`*` 为 36；
 * 从初值 36 起逐位 `s = (s + 值) % 36`，为 0 时记 36，再 `s = s * 2 % 37`；
 * 末位满足 `(s + 值) % 36 === 1`。该算法已用真实样例
 * `G1011010711628240R` 复核通过，但公开资料没有给出完整的官方口径，
 * 页面只把它当测试码使用，不承诺与央行系统完全一致。
 *
 * 行政区划段使用与统一社会信用代码相同的现行区划表；历史码只解不生成。
 */
import { seededRandom } from './random.js';
import { resolveRegion, currentCityCodes, REGION_META } from './region.js';

/** 单次生成上限 */
export const GENERATE_MAX = 50;
/** 生成侧口径 */
export const USE_NOTE = '随机合成的机构信用代码，只在格式与公开校验算法上自洽；与真实机构重合的概率可忽略，不得用于真实征信、开户或申报。';
/** 算法与结构口径 */
export const FORMAT_NOTE = '18 位＝1 位准入登记管理机构类别（字母）+ 2 位机构类别 + 6 位行政区划 + 8 位结算账户核准号标识 + 1 位校验位。校验按模 36 的中征码算法计算；公开资料未给出完整官方口径，结果仅作测试。';
/** 默认首字母：公开样例中的常见值，不解释其业务含义 */
export const DEFAULT_FIRST = 'G';

const isDigit = (ch) => ch >= '0' && ch <= '9';
const isLetter = (ch) => ch >= 'A' && ch <= 'Z';

/** 字符值：`*`=36，数字 0–9，字母 A–Z=10–35 */
export function charValue(ch) {
  if (typeof ch !== 'string' || ch.length !== 1) return null;
  if (ch === '*') return 36;
  if (isDigit(ch)) return ch.charCodeAt(0) - 48;
  if (isLetter(ch)) return ch.charCodeAt(0) - 55;
  return null;
}

/** 数值 0–35 → 字符（0–9 / A–Z） */
const charOf = (n) => (n < 10 ? String(n) : String.fromCharCode(55 + n));

/**
 * 由前 17 位算校验字符。
 * @param {string} body17 1 位字母 + 16 位数字
 * @returns {{char:string, value:number, s:number}|null}
 */
export function checkOf(body17) {
  const s0 = typeof body17 === 'string' ? body17 : '';
  if (!/^[A-Z][0-9]{16}$/.test(s0)) return null;
  let s = 36;
  for (let i = 0; i < 17; i += 1) {
    s = (s + charValue(s0[i])) % 36;
    if (s === 0) s = 36;
    s = (s * 2) % 37;
  }
  const value = (1 - s + 36) % 36;
  return { char: charOf(value), value, s };
}

/**
 * 解一个机构信用代码。空格与连字符会被忽略，小写会先转大写。
 * @param {string|number|null|undefined} raw
 * @returns {object}
 */
export function parseCreditCode(raw) {
  const text = raw === null || raw === undefined ? '' : String(raw);
  const trimmed = text.trim();
  const value = trimmed.toUpperCase();
  const compact = value.replace(/[\s-]+/g, '');
  const out = {
    input: text, value, code: '', normalized: value !== trimmed,
    state: 'empty', checks: [], info: null, caveat: '', hasCaveat: false, suggestedCode: '',
  };
  if (value === '') return out;

  const checks = out.checks;
  const push = (key, label, ok, detail) => checks.push({ key, label, ok, detail });

  const lengthOk = compact.length === 18;
  push('length', '长度', lengthOk, `${compact.length} 位${lengthOk ? '' : '（应为 18 位）'}`);
  out.code = compact;

  const shapeOk = /^[A-Z][0-9]{16}[0-9A-Z*]$/.test(compact);
  push('shape', '结构', shapeOk, shapeOk
    ? '1 位字母 + 16 位数字 + 1 位校验字符'
    : '应为 1 位字母、16 位数字，末位为数字/大写字母/*');
  if (!lengthOk || !shapeOk) {
    out.code = '';
    out.state = 'malformed';
    return out;
  }

  const body17 = compact.slice(0, 17);
  const checkChar = compact[17];
  const expected = checkOf(body17);
  const checkOk = expected.char === checkChar;
  push('checkBit', '校验位', checkOk, checkOk
    ? `校验位 ${checkChar}` : `期望 ${expected.char}，实际 ${checkChar}`);
  if (!checkOk) out.suggestedCode = body17 + expected.char;

  const regionCode = compact.slice(3, 9);
  const region = resolveRegion(regionCode);
  const regionOk = region.status === 'current' ? true : (region.status === 'abolished' ? null : false);
  push('region', '行政区划', regionOk, region.status === 'current'
    ? region.fullName : region.note);
  out.state = !checkOk ? 'checkdigit' : (regionOk === false ? 'unlisted' : 'valid');
  if (regionOk !== true) out.caveat = region.note;
  if (value !== trimmed) {
    out.caveat = out.caveat === '' ? '输入含小写字母，已转大写' : `${out.caveat}；输入含小写字母，已转大写`;
  }
  out.hasCaveat = out.caveat !== '';

  out.info = {
    firstChar: compact[0],
    category: compact.slice(1, 3),
    regionCode, region,
    identifier: compact.slice(9, 17),
    checkBit: checkChar, expected: expected.char,
    checksum: { s: expected.s, value: expected.value },
  };
  return out;
}

/** 报错文案里的"收到什么" */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}

function checkedRng(input) {
  if (input === undefined || input === null) return seededRandom(Date.now());
  if (typeof input !== 'function') throw new TypeError(`generateCreditCodes 的 options.rng 应为 () => number，收到 ${shapeOf(input)}`);
  return () => {
    const v = input();
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1) {
      throw new TypeError(`generateCreditCodes 的 options.rng 每次应给出 [0, 1) 内的有限数，收到 ${shapeOf(v)}`);
    }
    return v;
  };
}

/**
 * 生成校验位成立的测试代码。区划段只取现行市级码补 `00`。
 * @param {{count?:number, rng?:() => number, regionCode?:string, provinceCode?:string,
 *   first?:string, category?:string, identifier?:string}} [options]
 * @returns {Array<{code:string, first:string, category:string, regionCode:string,
 *   regionName:string, identifier:string, checkBit:string}>}
 */
export function generateCreditCodes(options = {}) {
  const o = options ?? {};
  const rng = checkedRng(o.rng);
  const count = o.count === undefined ? 1 : o.count;
  if (!Number.isInteger(count) || count < 1 || count > GENERATE_MAX) {
    throw new RangeError(`数量应为 1..${GENERATE_MAX} 的整数，收到 ${shapeOf(o.count)}`);
  }
  const first = o.first === undefined ? DEFAULT_FIRST : String(o.first).trim().toUpperCase();
  if (!/^[A-Z]$/.test(first)) throw new RangeError(`首字母应为 A–Z 的单个字母，收到 ${shapeOf(o.first)}`);

  let pool;
  if (o.regionCode !== undefined) {
    const code = String(o.regionCode).trim().toUpperCase();
    const r = resolveRegion(code);
    if (r.status !== 'current') throw new RangeError(`区划段 ${code} 不是现行码（${r.note || '表内未收录'}）`);
    pool = [code];
  } else {
    const prefix = o.provinceCode === undefined ? '' : String(o.provinceCode).trim();
    const cities = currentCityCodes(prefix);
    if (cities.length === 0) throw new RangeError(`省码 ${prefix} 下没有现行市级区划（区划数据截止 ${REGION_META.datasetVersion}）`);
    pool = cities.map((c) => `${c}00`);
  }

  const list = [];
  for (let i = 0; i < count; i += 1) {
    const regionCode = pool[Math.floor(rng() * pool.length)];
    const category = o.category === undefined
      ? String(Math.floor(rng() * 100)).padStart(2, '0') : String(o.category).padStart(2, '0');
    if (!/^\d{2}$/.test(category)) throw new RangeError(`机构类别应为 2 位数字，收到 ${shapeOf(o.category)}`);
    const identifier = o.identifier === undefined
      ? String(Math.floor(rng() * 100000000)).padStart(8, '0') : String(o.identifier).padStart(8, '0');
    if (!/^\d{8}$/.test(identifier)) throw new RangeError(`结算账户标识应为 8 位数字，收到 ${shapeOf(o.identifier)}`);
    const body17 = `${first}${category}${regionCode}${identifier}`;
    const check = checkOf(body17);
    const code = body17 + check.char;
    const self = parseCreditCode(code);
    if (self.state !== 'valid') throw new Error(`内部不变量被破坏：生成的 ${code} 自检未通过`);
    list.push({
      code, first, category, regionCode,
      regionName: self.info.region.fullName || '', identifier, checkBit: check.char,
    });
  }
  return list;
}
