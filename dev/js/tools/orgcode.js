/**
 * 全国组织机构代码（GB 11714-1997）：8 位本体 + 1 位校验位。
 *
 * 本体代码与校验位都只使用 31 字符集（0-9 与去掉 I O S Z V 的 A-Z），
 * 校验位按权重 3/7/9/10/5/8/4/2 求和后对 11 取模：`(11 - sum % 11) % 11`，
 * 值 10 写作 X。展示时第 9 位前加连字符，机读时可省略。
 *
 * 与 `uscc.js` 的关系：统一社会信用代码第 9–17 位复用同一套本体与校验算法；
 * 本模块只处理独立的 9 位代码，不读区划、不解释行业。
 */
import { seededRandom } from './random.js';

/** 31 字符集，下标即校验加权值 */
export const ORG_CHARSET = '0123456789ABCDEFGHJKLMNPQRTUWXY';
/** GB 11714 权重，下标 0 起 */
export const ORG_WEIGHTS = [3, 7, 9, 10, 5, 8, 4, 2];
/** 单次生成上限，与证件页其余面板同档 */
export const GENERATE_MAX = 50;
/** 生成侧口径 */
export const USE_NOTE = '随机合成的组织机构代码，只在算术上自洽；与真实机构重合的概率可忽略，不得用于真实登记、申报或资质证明。';
/** 结构口径 */
export const FORMAT_NOTE = '9 位＝8 位本体 + 1 位校验位；本体只使用 31 字符集（不含 I O S Z V），校验位按 GB 11714 的 mod 11 算法计算，10 写作 X。';

const charValue = (ch) => (typeof ch === 'string' && ch.length === 1 ? ORG_CHARSET.indexOf(ch) : -1);
const allInSet = (s) => [...s].every((c) => charValue(c) >= 0);

/** 本体 8 位 → 校验值与算式 */
export function checkOf(body8) {
  const s = typeof body8 === 'string' ? body8 : '';
  if (s.length !== 8 || !allInSet(s)) return null;
  let sum = 0;
  for (let i = 0; i < 8; i += 1) sum += charValue(s[i]) * ORG_WEIGHTS[i];
  const remainder = sum % 11;
  const value = (11 - remainder) % 11;
  return { sum, remainder, value, char: value === 10 ? 'X' : String(value) };
}

/**
 * 解一个组织机构代码。分隔符（空格、连字符）只影响回显，不参与判定。
 * @param {string|number|null|undefined} raw 用户输入
 * @returns {object} 与 `parseUscc` 同形的结果对象
 */
export function parseOrgCode(raw) {
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

  const lengthOk = compact.length === 9;
  push('length', '长度', lengthOk, `${compact.length} 位${lengthOk ? '' : '（应为 9 位）'}`);

  const body8 = compact.slice(0, 8);
  const checkChar = compact[8] || '';
  const charsetOk = lengthOk && allInSet(body8);
  push('charset', '字符集', charsetOk, charsetOk
    ? '本体全部在 31 字符集内（不含 I O S Z V）'
    : `本体含非法字符 ${[...new Set([...body8].filter((c) => charValue(c) < 0))].join(' ') || '（位数不足）'}`);

  const checkShapeOk = lengthOk && (/^[0-9X]$/.test(checkChar));
  push('checkShape', '校验位字符', checkShapeOk, checkShapeOk
    ? `第 9 位是 ${checkChar}` : `第 9 位应为 0–9 或 X，实际「${checkChar || '（缺）'}」`);

  if (!lengthOk || !charsetOk || !checkShapeOk) {
    out.state = 'malformed';
    return out;
  }

  out.code = compact;
  const expected = checkOf(body8);
  const checkOk = expected.char === checkChar;
  push('checkBit', '校验位', checkOk, checkOk
    ? `校验位 ${checkChar}（Σ ${expected.sum} · mod 11 = ${expected.remainder}）`
    : `期望 ${expected.char}，实际 ${checkChar}（Σ ${expected.sum} · mod 11 = ${expected.remainder}）`);
  out.state = checkOk ? 'valid' : 'checkdigit';
  if (!checkOk) out.suggestedCode = `${body8}-${expected.char}`;

  if (compact !== value) out.caveat = '已忽略输入中的空格或连字符';
  if (value !== trimmed) out.caveat = out.caveat === '' ? '输入含小写字母，已按 31 字符集转大写' : `${out.caveat}；输入含小写字母，已转大写`;
  out.hasCaveat = out.caveat !== '';

  out.info = {
    body8, checkBit: checkChar, expected: expected.char,
    checksum: { sum: expected.sum, remainder: expected.remainder, value: expected.value },
    formatted: `${body8}-${checkChar}`,
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
  if (typeof input !== 'function') throw new TypeError(`generateOrgCodes 的 options.rng 应为 () => number，收到 ${shapeOf(input)}`);
  return () => {
    const v = input();
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1) {
      throw new TypeError(`generateOrgCodes 的 options.rng 每次应给出 [0, 1) 内的有限数，收到 ${shapeOf(v)}`);
    }
    return v;
  };
}

/**
 * 生成校验位成立的测试代码。
 * @param {{count?:number, rng?:() => number}} [options]
 * @returns {Array<{code:string, body8:string, checkBit:string, sum:number, remainder:number}>}
 */
export function generateOrgCodes(options = {}) {
  const o = options ?? {};
  const rng = checkedRng(o.rng);
  const count = o.count === undefined ? 1 : o.count;
  if (!Number.isInteger(count) || count < 1 || count > GENERATE_MAX) {
    throw new RangeError(`数量应为 1..${GENERATE_MAX} 的整数，收到 ${shapeOf(o.count)}`);
  }
  const list = [];
  for (let i = 0; i < count; i += 1) {
    let body8 = '';
    for (let k = 0; k < 8; k += 1) body8 += ORG_CHARSET[Math.floor(rng() * ORG_CHARSET.length)];
    const check = checkOf(body8);
    const code = `${body8}-${check.char}`;
    const self = parseOrgCode(code);
    if (self.state !== 'valid') throw new Error(`内部不变量被破坏：生成的 ${code} 自检未通过`);
    list.push({ code, body8, checkBit: check.char, sum: check.sum, remainder: check.remainder });
  }
  return list;
}
