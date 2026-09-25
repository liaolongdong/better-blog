/**
 * 区划码表的读侧：解析生成物、拼三级全名、跑四级回落链。
 *
 * 为什么单独一层：region-data.js 是生成物、只放数据；回落规则（哪一级算命中、
 * 什么时候不下"无效"结论）是设计判断，混进生成文件等于把它写在模板字符串里，
 * 下次重新生成就会冲掉。口径出处：设计文档 §2.2 末尾 / §5.4。
 *
 * 关键一条：查不到县级码 ≠ 号码无效。真实存在的老号码带的是撤销建制的码，
 * 新设区划又可能晚于数据截止日（REGION_META.datasetVersion）。所以这里只返回
 * status，由调用方决定措辞；并且永远不会产出「未知地区」这类文案
 * （站内旧库 id-validator 的实测反面教材，§2.2 末尾）。
 */
import {
  REGION_META, RAW_PROVINCES, RAW_CITIES, RAW_COUNTIES, RAW_HISTORICAL,
} from './region-data.js';

export { REGION_META };

/** 市级名里不属于真实地名的占位段：拼全名时跳过，否则得到「北京市市辖区东城区」 */
const PLACEHOLDER_CITY = new Set(['市辖区', '县', '省直辖县级行政区划', '自治区直辖县级行政区划']);

/** 未收录时的统一措辞。判定不下的项一律用这句，别在别处另写一版 */
export const NOT_COLLECTED_NOTE = '区划码未收录（可能是已撤销建制、经济功能区，或晚于区划数据截止日的调整）';

/**
 * 历史层的口径说明。刻意不写成"已撤销建制"：这一层的定义是"见于 2015 年口径表、
 * 未见于现行表"，两表之差里有真撤销的（110103 崇文区），也有**同码改名**的——
 * 实读 1,934 条交集里有 63 条码在两表之间名字不同而码未变（150203 昆都伦区→昆都仑区、
 * 210112 东陵区→浑南区、210782 北宁市→北镇市 等），断言"已撤销建制"对这 63 条是错的。
 * 设计文档 §5.4 原本要求标"已撤销建制（现行码：xxx，若有）"，这里按实测改成诚实措辞，
 * 并同步回填进设计文档。
 */
export function historicalNote(level) {
  const who = level === 'city' ? '所属地市' : '该区划';
  return `${who}未见于现行区划表（截止 ${REGION_META.datasetVersion}），通常是撤销建制、改码或改名`;
}

const PROVINCES = new Map(); // 码2 -> 名
const CITIES = new Map(); // 码4 -> { code, provinceCode, name }
const COUNTIES = new Map(); // 码6 -> { code, cityCode, name }
const HISTORICAL = new Map(); // 码6 -> { code, name, level }
const COUNTY_CODES_BY_CITY = new Map(); // 码4 -> [码6…]
const COUNTY_CODES_BY_PROV = new Map(); // 码2 -> [码6…]
const ALL_COUNTY_CODES = [];

for (const row of RAW_PROVINCES.split('|')) {
  const [code, name] = row.split(',');
  PROVINCES.set(code, name);
}

const CITY_CODES_BY_PROV = new Map();
for (const row of RAW_CITIES.split('|')) {
  const [code, provinceCode, name] = row.split(',');
  CITIES.set(code, { code, provinceCode, name });
  if (!CITY_CODES_BY_PROV.has(provinceCode)) CITY_CODES_BY_PROV.set(provinceCode, []);
  CITY_CODES_BY_PROV.get(provinceCode).push(code);
}

for (const group of RAW_COUNTIES.split('|')) {
  const at = group.indexOf(',');
  const cityCode = group.slice(0, at);
  const list = [];
  for (const token of group.slice(at + 1).split(' ')) {
    const code = cityCode + token.slice(0, 2);
    COUNTIES.set(code, { code, cityCode, name: token.slice(2) });
    list.push(code);
  }
  COUNTY_CODES_BY_CITY.set(cityCode, list);
  ALL_COUNTY_CODES.push(...list);
}
ALL_COUNTY_CODES.sort();

for (const [p, list] of COUNTY_CODES_BY_CITY) {
  COUNTY_CODES_BY_PROV.set(p.slice(0, 2), (COUNTY_CODES_BY_PROV.get(p.slice(0, 2)) || []).concat(list));
}
for (const list of COUNTY_CODES_BY_PROV.values()) list.sort();

for (const row of RAW_HISTORICAL.split('|')) {
  const at = row.indexOf(',');
  const code = row.slice(0, at);
  const name = row.slice(at + 1);
  const level = code.endsWith('0000') ? 'province' : code.endsWith('00') ? 'city' : 'county';
  HISTORICAL.set(code, { code, name, level });
}

/** 省 + （非占位的）市 + 县 拼全名 */
function joinNames(provinceCode, cityCode, countyName) {
  const province = PROVINCES.get(provinceCode) || '';
  const city = CITIES.get(cityCode);
  const middle = city && !PLACEHOLDER_CITY.has(city.name) ? city.name : '';
  return `${province}${middle}${countyName || ''}`;
}

/**
 * 解一个 6 位行政区划码。返回结构在 §5.4 里定义，供身份证与统一代码两个面板共用。
 *
 * @param {string|null} code 6 位行政区划码。只接受字符串：数值、对象等即使数值合法也按结构非法落 none
 * @returns {{
 *   code:string, status:'current'|'abolished'|'uncoded'|'unknown',
 *   level:'county'|'city'|'province'|'none',
 *   provinceCode:string, cityCode:string, countyCode:string,
 *   province:string, city:string, county:string, fullName:string, note:string
 * }}
 */
export function resolveRegion(code) {
  const c6 = String(code ?? '').trim();
  const provinceCode = c6.slice(0, 2);
  const base = {
    code: c6, status: 'unknown', level: 'none',
    provinceCode, cityCode: c6.slice(0, 4), countyCode: c6,
    province: PROVINCES.get(provinceCode) || '', city: '', county: '',
    fullName: '', note: '',
  };
  // 码串按字符串处理，数值入参即使位数合法也拒绝：Number 表达不了前导零，
  // 静默 String(110101) 解出地名会把调用方的类型错误藏成一次"成功解析"。
  if (typeof code !== 'string' || !/^\d{6}$/.test(c6)) return { ...base, note: '行政区划码应为 6 位数字字符串' };

  // 优先级：现行县级 → 现行市/省级（6 位形如「市级码+00」）→ 历史层 → 市级回落 → 省级回落 → 落空
  const county = COUNTIES.get(c6);
  if (county) {
    const city = CITIES.get(county.cityCode);
    return {
      ...base, status: 'current', level: 'county', cityCode: county.cityCode,
      city: city ? city.name : '', county: county.name,
      fullName: joinNames(provinceCode, county.cityCode, county.name),
    };
  }
  // 统一信用代码的区划段常写成「市级码 + 00」（示例 350100 即福州市辖区）。
  // 这一档必须排进历史层之前：这类码在旧表里也存在，但那是同一建制的现行码，不是撤销项。
  if (c6.endsWith('00')) {
    const city = CITIES.get(c6.slice(0, 4));
    if (city) {
      return {
        ...base, status: 'current', level: 'city', city: city.name,
        fullName: joinNames(provinceCode, c6.slice(0, 4), ''),
      };
    }
    if (c6.endsWith('0000') && PROVINCES.has(provinceCode)) {
      return { ...base, status: 'current', level: 'province', fullName: base.province };
    }
  }
  const hist = HISTORICAL.get(c6);
  if (hist) {
    return {
      ...base, status: 'abolished', level: hist.level,
      county: hist.level === 'county' ? hist.name : '',
      fullName: hist.name,
      note: historicalNote(hist.level),
    };
  }
  const city = CITIES.get(base.cityCode);
  if (city) {
    return {
      ...base, status: 'uncoded', level: 'city', city: city.name,
      fullName: joinNames(provinceCode, base.cityCode, ''), note: NOT_COLLECTED_NOTE,
    };
  }
  const histCity = HISTORICAL.get(`${base.cityCode}00`);
  if (histCity) {
    return {
      ...base, status: 'abolished', level: 'city', fullName: histCity.name,
      note: historicalNote('city'),
    };
  }
  if (base.province) {
    return { ...base, status: 'uncoded', level: 'province', fullName: base.province, note: NOT_COLLECTED_NOTE };
  }
  return { ...base, status: 'unknown', level: 'none', note: '省级代码不存在' };
}

/**
 * 现行县级码集合，可按省码 / 市码 / 任意前缀收窄。
 * 这是生成侧唯一的地址来源：历史码永不进候选（§5.4）。
 */
export function currentCountyCodes(prefix = '') {
  const p = String(prefix ?? '');
  if (p === '') return ALL_COUNTY_CODES.slice();
  if (p.length === 2) return (COUNTY_CODES_BY_PROV.get(p) || []).slice();
  if (p.length === 4) return (COUNTY_CODES_BY_CITY.get(p) || []).slice();
  return ALL_COUNTY_CODES.filter((c) => c.startsWith(p));
}

/** 现行市级码集合，可按省码收窄（统一代码的区划段只到地市，用这条） */
export function currentCityCodes(provinceCode = '') {
  if (provinceCode === '') return [...CITIES.keys()].sort();
  return (CITY_CODES_BY_PROV.get(String(provinceCode).slice(0, 2)) || []).slice().sort();
}

export function provinceCodes() {
  return [...PROVINCES.keys()].sort();
}

export function historicalCodes() {
  return [...HISTORICAL.keys()].sort();
}

/** 该码能否作为生成地址（只有现行县级 / 现行市级可以） */
export function isGeneratable(code, level = 'county') {
  return level === 'county' ? COUNTIES.has(String(code)) : CITIES.has(String(code));
}

/** 省码 -> 省名；面板做三级级联时直接用 */
export function provinceName(code) {
  return PROVINCES.get(String(code).slice(0, 2)) || '';
}

export function cityName(code) {
  const c = CITIES.get(String(code).slice(0, 4));
  return c ? c.name : '';
}
