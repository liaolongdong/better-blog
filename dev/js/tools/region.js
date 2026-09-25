/**
 * 区划码表的读侧：解析生成物、拼三级全名、跑六档回落链（§5.4 的六档，不是四级）。
 *
 * 为什么单独一层：region-data.js 是生成物、只放数据；回落规则（哪一级算命中、
 * 什么时候不下"无效"结论）是设计判断，混进生成文件等于把它写在模板字符串里，
 * 下次重新生成就会冲掉。口径出处：设计文档 §2.2 末尾 / §5.4。
 *
 * 关键一条：查不到县级码 ≠ 号码无效。真实存在的老号码带的是撤销建制的码，
 * 新设区划又可能晚于数据截止日（REGION_META.datasetVersion）。所以这里只返回
 * status，由调用方决定措辞；并且永远不会产出「未知地区」这类文案
 * （站内旧库 id-validator 的实测反面教材，§2.2 末尾）。
 *
 * 还有一条：载入时自检。解析出来的四张索引必须与产物里 REGION_META.counts 逐项相等、
 * schema 必须是 1，否则直接抛——生成器与解析器"改一边必须改另一边"这条约定，
 * 在这之前只有人肉遵守过，机器一次都没验过（产物被截断 20% 都能安静加载）。
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
 * 未见于现行表"那 1,229 条（县级 1,159 + 市级 70，见 REGION_META.historicalLevels），
 * 而集合差里混着好几种东西。下面四种样本 2026-09-25 逐条实读自产物，status 均为 abolished：
 *   真撤销          110103 北京市崇文区（2010 年并入西城区）
 *   随父级一起改名  320801 江苏省淮阴市市辖区（现行 3208 就是淮安市，改的是名不是码）
 *   旧表的市/县口径 110200 北京市县、500300 重庆市(市)（现行表里没有这一档建制行）
 *   旧表的统计口径  460037 海南省西沙群岛
 *
 * 三个数字的分母各不相同，别混用：
 *   1,934  旧表的 6 位键**逐字**出现在现行县级表里的条数；其中 63 条码未变而县名已改
 *          （130502 桥东区→襄都区、150203 昆都伦区→昆都仑区、210112 东陵区→浑南区、
 *          210782 北宁市→北镇市 等）。这 63 条按县级命中，status 是 current，
 *          不在历史层里——本注释早期版本拿它们当历史层样本，是错的。
 *   2,236  REGION_META.legacyHitCurrent，口径是"按其自身层级（XX0000 省 / XXXX00 市 /
 *          其余县）能在现行表命中"，等于 3,465 减上面的 1,229。
 *   1,229  历史层本身。
 * 设计文档 §5.4 原本要求标"已撤销建制（现行码：xxx，若有）"，这里按实测改成诚实措辞，
 * 并同步回填进设计文档。括号里给的是**现行表的截止日**（决定"查不到"这件事的是它），
 * 历史层自己的口径是 GB/T 2015，记在 SOURCES.json 与产物头注释里，不塞进这句文案。
 * 尾句刻意写"可能是"而不是"通常是"：历史层那 1,229 条的四种成因（真撤销 / 随父级改名 /
 * 旧表口径没有这一档 / 统计口径）没有一份逐条统计过，"通常是撤销建制"是编不出来的话。
 */
export function historicalNote(level) {
  const who = level === 'city' ? '所属地市' : '该区划';
  return `${who}未见于现行区划表（截止 ${REGION_META.datasetVersion}），可能是撤销建制、改码或改名`;
}

const PROVINCES = new Map(); // 码2 -> 名
const CITIES = new Map(); // 码4 -> { code, provinceCode, name }
const COUNTIES = new Map(); // 码6 -> { code, cityCode, name }
const HISTORICAL = new Map(); // 码6 -> { code, name, level }
const COUNTY_CODES_BY_CITY = new Map(); // 码4 -> [码6…]
const COUNTY_CODES_BY_PROV = new Map(); // 码2 -> [码6…]
const ALL_COUNTY_CODES = [];

/**
 * 一行按 `,` 切开的字段闸门。生成器写出的四张表字段数是定死的，"这一行切不出 n 段"
 * 本身就是产物坏掉的证据，而且它是**唯一**看得见这件事的地方：2026-09-25 实测把每张表
 * 第一行的逗号换成全角冒号、再摘掉这道闸门，省级 / 市级 / 历史层三份都安静加载成功，
 * 四张索引的条数一个都没动（31 / 342 / 2978 / 1229）——丢分隔符只是让键变成一串垃圾、
 * 名字变成 undefined，条数照旧，所以后面那道与 REGION_META.counts 对表的自检拦不到它。
 * 县级另有下面那道 `at < 0` 兜着（组头切不出市码）。四种漂移如今都在这一处抛，
 * 报错点名到表名与行号。判据 A9 逐张表各注入一次。
 * @param {string} row 原始行
 * @param {number} n 期望字段数
 * @param {string} label 表名，出现在报错里
 * @param {number} i 行号（0 起），出现在报错里
 * @returns {string[]} 长度为 n 的字段数组
 */
function fields(row, n, label, i) {
  const parts = row.split(',');
  if (parts.length !== n || parts.some((p) => p === '')) {
    throw new Error(`region-data.js 的 ${label} 第 ${i} 行解析不出 ${n} 个字段：`
      + JSON.stringify(row.slice(0, 24)));
  }
  return parts;
}

for (const [i, row] of RAW_PROVINCES.split('|').entries()) {
  const [code, name] = fields(row, 2, 'RAW_PROVINCES', i);
  PROVINCES.set(code, name);
}

const CITY_CODES_BY_PROV = new Map();
for (const [i, row] of RAW_CITIES.split('|').entries()) {
  const [code, provinceCode, name] = fields(row, 3, 'RAW_CITIES', i);
  CITIES.set(code, { code, provinceCode, name });
  if (!CITY_CODES_BY_PROV.has(provinceCode)) CITY_CODES_BY_PROV.set(provinceCode, []);
  CITY_CODES_BY_PROV.get(provinceCode).push(code);
}

for (const [i, group] of RAW_COUNTIES.split('|').entries()) {
  const at = group.indexOf(',');
  if (at < 0) {
    throw new Error(`region-data.js 的 RAW_COUNTIES 第 ${i} 组切不出市码：${JSON.stringify(group.slice(0, 24))}`);
  }
  const cityCode = group.slice(0, at);
  const list = [];
  for (const token of group.slice(at + 1).split(' ')) {
    // token 形如 `01东城区`：后 2 位必须是数字，名字不能空——名字空掉时条数照样不变
    if (!/^\d{2}/.test(token) || token.length < 3) {
      throw new Error(`region-data.js 的 RAW_COUNTIES 第 ${i} 组（市码 ${cityCode}）里有坏项：${JSON.stringify(token)}`);
    }
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

for (const [i, row] of RAW_HISTORICAL.split('|').entries()) {
  const [code, name] = fields(row, 2, 'RAW_HISTORICAL', i);
  const level = code.endsWith('0000') ? 'province' : code.endsWith('00') ? 'city' : 'county';
  HISTORICAL.set(code, { code, name, level });
}

/**
 * 载完就自检：schema 版本必须是 1，四张索引的条数必须与生成器写进产物的 REGION_META.counts
 * 逐项相等。这一层此前是"生成器写了、读侧谁都不看"——实测把 RAW_COUNTIES 截掉 20%（字符串
 * 完整闭合）模块照样加载成功，浏览器里变成 2,389 个县对着一份声明 2,978 个的元信息，全静默。
 * 与上面那道 fields() 是分工不是重复：这里管"少了行"（截断最典型），
 * fields() 管"行数没变但行内坏了"——那种漂移在这里的条数是看不出来的（实测 31/342/2978/1229
 * 一个都不动），两道缺一条就有一类产物损坏安静出货。
 */
const PARSED_COUNTS = {
  provinces: PROVINCES.size,
  cities: CITIES.size,
  counties: COUNTIES.size,
  historical: HISTORICAL.size,
};
if (REGION_META.schema !== 1) {
  throw new Error(`region-data.js 的 schema 是 ${REGION_META.schema}，本解析器只认 1`);
}
for (const [key, got] of Object.entries(PARSED_COUNTS)) {
  const declared = (REGION_META.counts || {})[key];
  if (got !== declared) {
    throw new Error(`region-data.js 解析出 ${got} 条 ${key}，元信息声明 ${declared} 条：`
      + '产物被截断，或编码格式与解析器已经不同步');
  }
}

/** 省 + （非占位的）市 + 县 拼全名 */
function joinNames(provinceCode, cityCode, countyName) {
  const province = PROVINCES.get(provinceCode) || '';
  const city = CITIES.get(cityCode);
  const middle = city && !PLACEHOLDER_CITY.has(city.name) ? city.name : '';
  return `${province}${middle}${countyName || ''}`;
}

/**
 * 入参归一。resolveRegion 与 isGeneratable 共用它，两个入口对同一入参因而不可能给出
 * 互相矛盾的结论（此前 isGeneratable(' 110101 ') 是 false，而 resolveRegion(' 110101 ')
 * 解出东城区；isGeneratable(110101) 是 true，而 resolveRegion(110101) 落到 none）。
 * 只接受字符串并 trim；非字符串归一成 ''，由调用方按结构非法处理。
 * 类型判断必须在任何 String() 之前：`String(Object.create(null))` 抛
 * "Cannot convert object to primitive value"，而本层对外的承诺是永不抛（见 resolveRegion）。
 * @param {unknown} code 任意入参
 * @returns {string} 归一后的码串，非字符串入参得到 ''
 */
function normalizeCode(code) {
  return typeof code === 'string' ? code.trim() : '';
}

/**
 * 前缀型入参的归一，与 normalizeCode 同一条类型规则，但非法时给 null 而不是 ''。
 *
 * 差别是必须的：currentCountyCodes / currentCityCodes 里 '' 的含义是"不收窄、返回全表"，
 * 所以把 null / 数值 / 对象归一成 '' 等于把一次类型错误放大成 2,978 条候选地址。
 * 实测改之前：`currentCountyCodes(null)` 返回 2,978 条（`null ?? ''` 落到"全表"那一支），
 * `currentCountyCodes(Object.create(null))` 直接抛，`currentCountyCodes(1101)` 返回 16 条
 * 而 isGeneratable(1101, 'city') 为 false——同一份数字，两个入口一个认一个不认。
 * @param {unknown} prefix 任意入参
 * @returns {string|null} 字符串 trim 后的前缀；非字符串为 null，调用方返回空集
 */
function normalizePrefix(prefix) {
  return typeof prefix === 'string' ? prefix.trim() : null;
}

/**
 * 结构非法时的返回值：11 个键一个不少，但除 code 与 note 全为空。
 * 这个形状是本层自己定的契约（不是 §5.4 写的——§5.4 只规定"区划查不到时其余项照常判定"，
 * 那正是这里不能抛、也不能少键的理由）。此前这道分支照抄入参切片，于是
 * resolveRegion(110101) 在给出 level:'none' 的同时挂着 province「北京市」与
 * countyCode「110101」——被拒绝的数字旁边显示一个地名，正是这层设计要防的"看着像成功了"。
 * @param {string} c6 归一后的码串（非字符串入参传 ''）
 * @returns {ReturnType<typeof resolveRegion>}
 */
function rejectRegion(c6) {
  return {
    code: c6, status: 'unknown', level: 'none',
    provinceCode: '', cityCode: '', countyCode: '',
    province: '', city: '', county: '', fullName: '',
    note: '行政区划码应为 6 位数字字符串',
  };
}

/**
 * 解一个 6 位行政区划码。供身份证与统一代码两个面板共用。
 * §5.4 定的是回落链的六档顺序与 `level` 的四档取值（county / city / province / none），
 * 以及"区划查不到时其余项照常判定"；下面这套 11 个键的形状是本层自己定的。
 * 永不抛异常：任何形状的入参都拿到同一套键。
 *
 * @param {unknown} code 6 位行政区划码。只接受字符串（首尾空白会被 trim），
 *   数值、对象等即使位数合法也按结构非法落 level:'none'，且不带任何派生字段
 * @returns {{
 *   code:string, status:'current'|'abolished'|'uncoded'|'unknown',
 *   level:'county'|'city'|'province'|'none',
 *   provinceCode:string, cityCode:string, countyCode:string,
 *   province:string, city:string, county:string, fullName:string, note:string
 * }}
 */
export function resolveRegion(code) {
  // 第一道闸门是类型，而且是函数第一条语句：任何属性访问与转换都在它后面
  if (typeof code !== 'string') return rejectRegion('');
  const c6 = normalizeCode(code);
  // 码串按字符串处理，数值入参即使位数合法也拒绝：Number 表达不了前导零，
  // 静默 String(110101) 解出地名会把调用方的类型错误藏成一次"成功解析"。
  if (!/^\d{6}$/.test(c6)) return rejectRegion(c6);

  const provinceCode = c6.slice(0, 2);
  const base = {
    code: c6, status: 'unknown', level: 'none',
    provinceCode, cityCode: c6.slice(0, 4), countyCode: c6,
    province: PROVINCES.get(provinceCode) || '', city: '', county: '',
    fullName: '', note: '',
  };

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
 * 入参只接受字符串（trim 后比较），非字符串得到空集而不是全表——见 normalizePrefix。
 */
export function currentCountyCodes(prefix = '') {
  const p = normalizePrefix(prefix);
  if (p === null) return [];
  if (p === '') return ALL_COUNTY_CODES.slice();
  if (p.length === 2) return (COUNTY_CODES_BY_PROV.get(p) || []).slice();
  if (p.length === 4) return (COUNTY_CODES_BY_CITY.get(p) || []).slice();
  return ALL_COUNTY_CODES.filter((c) => c.startsWith(p));
}

/** 现行市级码集合，可按省码收窄（统一代码的区划段只到地市，用这条） */
export function currentCityCodes(provinceCode = '') {
  const p = normalizePrefix(provinceCode);
  if (p === null) return [];
  if (p === '') return [...CITIES.keys()].sort();
  return (CITY_CODES_BY_PROV.get(p.slice(0, 2)) || []).slice().sort();
}

export function provinceCodes() {
  return [...PROVINCES.keys()].sort();
}

export function historicalCodes() {
  return [...HISTORICAL.keys()].sort();
}

/**
 * 层级名 -> 该层的现行索引 + 该层存键的位数（县级 6、市级 4、省级 2）。
 * 一个层级只在这里出现一次：早先是 TIER_LEN / TIER_INDEX 两张平行表，
 * 加一档层级时只改一边就会得到「len 有、index 没有」的 TypeError，
 * 而这是给浏览器直接调的导出函数。
 */
const TIERS = {
  county: { len: 6, index: COUNTIES },
  city: { len: 4, index: CITIES },
  province: { len: 2, index: PROVINCES },
};

/**
 * 该码能否作为生成地址（只有现行表的三级可以，历史码永不算）。
 *
 * 与 resolveRegion 共用 normalizeCode，所以两条入参规则完全一致：只接受字符串、同样 trim。
 * 此前这里 `String(code)` 直通，于是 isGeneratable(110101) 为 true 而 resolveRegion(110101)
 * 落 none、isGeneratable(' 110101 ') 为 false 而 resolveRegion 解出东城区，两条入口互相打脸。
 *
 * 但问的问题不同，别当成同一件事：本函数问「这个码是不是 level 这一级的现行码」，
 * 查的是该层自己的成员；resolveRegion 的 level 说的是「这 6 位整体解析到哪一级」。
 * 两者只在三个不设区的地级市上分叉（4419 东莞 / 4420 中山 / 4604 儋州，2026-09-25 实读全表
 * 仅此三条）：那三个 4 位市码在市级表里存在，而各自的「市码+00」在县级表里也有一条，
 * 所以 resolveRegion('441900').level 是 county。
 * @param {unknown} code 候选码，字符串，位数须与该层存键位数一致
 * @param {'county'|'city'|'province'} [level] 期望层级，默认县级。
 *   未知层级一律 false——此前 'province' 会静默落进市级分支，给出一个看着成立的错误答案
 * @returns {boolean}
 */
export function isGeneratable(code, level = 'county') {
  const tier = TIERS[level];
  if (!tier || !tier.len) return false;
  const c = normalizeCode(code);
  return c.length === tier.len && tier.index.has(c);
}

/** 省码 -> 省名；面板做三级级联时直接用。非字符串入参得到 ''，不做 String() 猜测 */
export function provinceName(code) {
  return PROVINCES.get(normalizeCode(code).slice(0, 2)) || '';
}

/** 市码 -> 市名（现行表存 4 位市码，传 6 位县级码取其前 4 位） */
export function cityName(code) {
  const c = CITIES.get(normalizeCode(code).slice(0, 4));
  return c ? c.name : '';
}
