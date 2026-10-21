/**
 * 金融许可证机构编码（15 位）。
 *
 * 公开的《金融许可证机构编码编制规则》把它分成六段：
 *   1 位机构类型代码（大写字母）
 *   4 位机构代码（数字）
 *   1 位组织类别代码（H 总行/总部、B 分行/分部、S 支行、O 其他分支机构）
 *   1 位发证机关代码（数字）
 *   3 位地址代码（省级行政区划前三位，如 110/230/360）
 *   5 位顺序代码（数字）
 * 合计 15 位，**没有公开的校验位**。因此本模块只能判结构与地址段是否可识别，
 * 不能判真伪；生成侧用 9000–9999 的机构代码测试段降低与真实机构重合的概率。
 */
import { seededRandom } from './random.js';
import { provinceCodes, provinceName } from './region.js';

/** 单次生成上限 */
export const GENERATE_MAX = 50;
/** 生成侧口径 */
export const USE_NOTE = '随机合成的金融许可证机构编码，只在格式上自洽；机构代码取 9000–9999 测试段，仍可能与真实机构重合，不得用于真实业务、资质证明或监管申报。';
/** 结构口径 */
export const FORMAT_NOTE = '15 位＝1 位机构类型 + 4 位机构代码 + 1 位组织类别 + 1 位发证机关 + 3 位地址 + 5 位顺序；该编码没有公开校验位，本页只判结构，不判真伪。';

/** 公开规则中能核实的机构类型；未列出的字母只判结构、不解释名称 */
export const LICENSE_TYPES = {
  A: '政策性银行',
  B: '商业银行',
  C: '农村合作银行',
  D: '城市信用社',
  E: '农村信用社',
  F: '资金互助社',
};
/** 组织类别：H 总部、B 分行/分部、S 支行、O 其他 */
export const ORG_CATEGORIES = {
  H: '总行 / 总部',
  B: '分行 / 分部',
  S: '支行',
  O: '其他分支机构',
};

const ADDR_BY_PREFIX = new Map();
for (const code of provinceCodes()) {
  // `provinceCodes()` 给的是 2 位省码（11/12/…）；许可证地址段是 3 位，取省码 + 0。
  ADDR_BY_PREFIX.set(`${code}0`, { code, name: provinceName(code) });
}

/** 报错文案里的"收到什么" */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}

/**
 * 解一个金融许可证机构编码。
 * @param {string|number|null|undefined} raw
 * @returns {object}
 */
export function parseFinLicense(raw) {
  const text = raw === null || raw === undefined ? '' : String(raw);
  const trimmed = text.trim();
  const value = trimmed.toUpperCase();
  const compact = value.replace(/[\s-]+/g, '');
  const out = {
    input: text, value, code: '', normalized: value !== trimmed,
    state: 'empty', checks: [], info: null, caveat: '', hasCaveat: false,
  };
  if (value === '') return out;

  const checks = out.checks;
  const push = (key, label, ok, detail) => checks.push({ key, label, ok, detail });
  const lengthOk = compact.length === 15;
  push('length', '长度', lengthOk, `${compact.length} 位${lengthOk ? '' : '（应为 15 位）'}`);

  const shapeOk = /^[A-Z][0-9]{4}[HBSO][0-9]{9}$/.test(compact);
  push('shape', '结构', shapeOk, shapeOk
    ? '类型 + 机构代码 + 组织类别 + 发证机关 + 地址 + 顺序'
    : '应为 1 位字母、4 位机构代码、1 位 H/B/S/O、1 位发证机关与 8 位地址/顺序数字');
  if (!lengthOk || !shapeOk) {
    out.state = 'malformed';
    return out;
  }

  out.code = compact;
  const type = compact[0];
  const instCode = compact.slice(1, 5);
  const orgCategory = compact[5];
  const issuer = compact[6];
  const addressCode = compact.slice(7, 10);
  const sequence = compact.slice(10, 15);
  const typeName = LICENSE_TYPES[type] || '';
  const orgName = ORG_CATEGORIES[orgCategory];
  const addr = ADDR_BY_PREFIX.get(addressCode) || null;

  push('type', '机构类型', typeName === '' ? null : true,
    typeName === '' ? `类型字母 ${type} 未收录名称，只按结构放行` : `${type} · ${typeName}`);
  push('orgCategory', '组织类别', true, `${orgCategory} · ${orgName}`);
  push('issuer', '发证机关代码', true, issuer);
  push('address', '地址代码', addr ? true : null,
    addr ? `${addressCode} · ${addr.name}` : `地址代码 ${addressCode} 未见于省级区划表`);
  push('sequence', '顺序代码', true, sequence);
  push('checkBit', '校验位', null, '该编码没有公开校验位，结构通过不等于真实存在');

  const structuralOk = checks.every((c) => c.ok !== false);
  out.state = !structuralOk ? 'malformed' : (addr ? 'valid' : 'unlisted');
  if (value !== trimmed) out.caveat = '输入含小写字母，已转大写';
  out.hasCaveat = out.caveat !== '';

  out.info = {
    type, typeName, instCode, orgCategory, orgCategoryName: orgName,
    issuer, addressCode, province: addr ? addr.name : '', provinceCode: addr ? addr.code : '',
    sequence,
  };
  return out;
}

function checkedRng(input) {
  if (input === undefined || input === null) return seededRandom(Date.now());
  if (typeof input !== 'function') throw new TypeError(`generateFinLicenses 的 options.rng 应为 () => number，收到 ${shapeOf(input)}`);
  return () => {
    const v = input();
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1) {
      throw new TypeError(`generateFinLicenses 的 options.rng 每次应给出 [0, 1) 内的有限数，收到 ${shapeOf(v)}`);
    }
    return v;
  };
}

/**
 * 生成格式成立的测试编码。
 * @param {{count?:number, rng?:() => number, type?:string, orgCategory?:string,
 *   issuer?:string, provinceCode?:string}} [options]
 * @returns {Array<object>}
 */
export function generateFinLicenses(options = {}) {
  const o = options ?? {};
  const rng = checkedRng(o.rng);
  const count = o.count === undefined ? 1 : o.count;
  if (!Number.isInteger(count) || count < 1 || count > GENERATE_MAX) {
    throw new RangeError(`数量应为 1..${GENERATE_MAX} 的整数，收到 ${shapeOf(o.count)}`);
  }
  const type = o.type === undefined ? 'B' : String(o.type).trim().toUpperCase();
  if (!/^[A-Z]$/.test(type) || !LICENSE_TYPES[type]) {
    throw new RangeError(`机构类型应为 ${Object.keys(LICENSE_TYPES).join(' / ')} 之一，收到 ${shapeOf(o.type)}`);
  }
  const orgCategory = o.orgCategory === undefined ? 'H' : String(o.orgCategory).trim().toUpperCase();
  if (!ORG_CATEGORIES[orgCategory]) {
    throw new RangeError(`组织类别应为 ${Object.keys(ORG_CATEGORIES).join(' / ')} 之一，收到 ${shapeOf(o.orgCategory)}`);
  }
  const issuer = o.issuer === undefined ? '1' : String(o.issuer).trim();
  if (!/^[0-9]$/.test(issuer)) throw new RangeError(`发证机关代码应为 1 位数字，收到 ${shapeOf(o.issuer)}`);
  const provinces = provinceCodes();
  const provinceCode = o.provinceCode === undefined
    ? provinces[Math.floor(rng() * provinces.length)]
    : String(o.provinceCode).trim();
  if (!/^\d{2}$/.test(provinceCode) || !provinces.includes(provinceCode)) {
    throw new RangeError(`省级区划码应为现行 2 位省码，收到 ${shapeOf(o.provinceCode)}`);
  }
  const addressCode = `${provinceCode}0`;
  const list = [];
  for (let i = 0; i < count; i += 1) {
    // 机构代码取 9000–9999：不是官方保留段，只是把与常见真实机构编码重合的概率压低。
    const instCode = String(9000 + Math.floor(rng() * 1000));
    const sequence = String(1 + Math.floor(rng() * 99999)).padStart(5, '0');
    const code = `${type}${instCode}${orgCategory}${issuer}${addressCode}${sequence}`;
    const self = parseFinLicense(code);
    if (self.state !== 'valid') throw new Error(`内部不变量被破坏：生成的 ${code} 自检未通过`);
    list.push({
      code, type, typeName: LICENSE_TYPES[type], instCode,
      orgCategory, orgCategoryName: ORG_CATEGORIES[orgCategory],
      issuer, addressCode, province: provinceName(provinceCode), sequence,
    });
  }
  return list;
}
