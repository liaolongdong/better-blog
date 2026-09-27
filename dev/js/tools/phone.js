/**
 * 手机号：格式判定 + 三位号段判运营商 + 生成侧。
 *
 * 数据来自 `carrier-data.js`（第三方快照 `LSG-PolarBear/impulse` 的 `OPERATORS`，
 * 见该文件头与 `assets/data/LICENSES.md`）。**这一格的诚实边界必须写清楚**：
 *
 * - 设计文档 §5.1 原本写的是"3–7 位前缀表"，实际只做到**三位**一档。原因记在计划的 §0.4：
 *   工信部编号计划原文取不到，可交叉核对的归属地仓库全部无 license（等于保留所有权利），
 *   唯一能干净拿到许可的源只给到三位号段。七位段才能谈归属地，所以**本站不做归属地**，
 *   {@link CARRIER_NOTE} 里那一句就是面板要原样显示的解释。
 * - 号段是**发号**口径：携号转网之后不代表用户当前实际运营商。
 * - 因此 §F 只断自洽（56 段互不重叠、形状合法、生成侧与校验侧同结论），
 *   **不断外部正确性**——这不是判据偷懒，是这一格唯一说得出口的判法。
 *
 * 与 `idcard.js` / `bankcard.js` 同一套约定：纯函数、不碰 DOM、入参形状不对就抛。
 */
import { seededRandom } from './random.js';
import { CARRIER_META, CARRIER_SEGMENTS } from './carrier-data.js';

/**
 * 手机号格式：十一位、`1[3-9]` 开头。这一档是**硬结论**（格式），与号段那张软参考表无关。
 * 导出是为了让生成侧的自检与 §F 的判据都能对着同一个口径判，而不是各写各的正则。
 */
export const MOBILE_RE = /^1[3-9]\d{9}$/;
export const MOBILE_LENGTH = 11;
/** 单次生成的条数上限，与 `generateIdCards` / `generateBankCards` 同一档 */
export const GENERATE_MAX = 50;
export const CARRIER_SOURCE = `${CARRIER_META.provider} @ ${CARRIER_META.ref.slice(0, 7)}（快照 ${CARRIER_META.fetchedAt}）`;
export const MOBILE_CAVEAT =
  '格式判定（11 位、1[3-9] 开头）是硬结论；运营商按三位号段判定，是发号口径的参考。';
export const CARRIER_NOTE =
  `运营商来自第三方整理的三位号段表（${CARRIER_SOURCE}），单一来源、不承诺全量；`
  + '携号转网后不代表当前实际运营商。本站不做号码归属地：三位号段这一层判不到城市，'
  + '而能干净取到许可的来源只有这一层。';

/** 号段 → 运营商；`segment` 三位一组 */
const BY_SEGMENT = new Map();
for (const [carrier, segsText] of CARRIER_SEGMENTS) {
  for (const seg of segsText.split(' ')) BY_SEGMENT.set(seg, carrier);
}
/** 运营商 → 号段数组（顺序就是数据文件里的顺序，不做 locale 排序） */
const SEGMENTS_BY_CARRIER = new Map(
  CARRIER_SEGMENTS.map(([carrier, segsText]) => [carrier, segsText.split(' ')]));
/** 面板"选运营商"下拉的数据源：`count` 是这家在表内挂了几个号段 */
export const CARRIERS = CARRIER_SEGMENTS.map(([carrier, segsText]) => ({
  carrier, count: segsText.split(' ').length,
}));
/** 表内全部号段，按运营商分组顺序、组内保持数据文件顺序 */
export const SEGMENTS = [...BY_SEGMENT.keys()];

/** 报错文案里的"收到什么"，与 idcard / uscc / panel / bankcard 同档 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}

/**
 * 归一：去掉分隔符，再剥掉可识别的国家码前缀。
 * 与银行卡同族（卡号按 4 位分组、号码按 3-4-4 分组书写，粘进来带空格是正常输入），
 * 与身份证那一侧"内部空白判 malformed"相反，不是分叉。
 * @param {string} text 已 trim 的输入
 * @returns {{digits:string, stripped:string}} 纯数字与"被去掉了什么"的说明（供逐项表点名）
 */
function normalize(text) {
  const noSep = text.replace(/[ \t\u3000\u00A0\-\u2010-\u2015().（）]+/g, '');
  if (/^\+86(?=1[3-9])/.test(noSep)) {
    return { digits: noSep.slice(3), stripped: '去掉了国际前缀 +86' };
  }
  if (/^0086(?=1[3-9])/.test(noSep)) {
    return { digits: noSep.slice(4), stripped: '去掉了国际前缀 0086' };
  }
  // `86` 开头不能无条件剥：13 位串里 `86` 后接 `1[3-9]` 才是国家码写法；
  // 而十一位号本身以 `1` 开头，永远轮不到这一格——所以条件写成"长度 13 且 86 开头"。
  if (noSep.length === MOBILE_LENGTH + 2 && /^86(?=1[3-9])/.test(noSep)) {
    return { digits: noSep.slice(2), stripped: '去掉了国际前缀 86' };
  }
  return { digits: noSep, stripped: '' };
}

/** 3-4-4 分组的可读形态（`138 0013 8000`）；形状不对就原样返回，不猜 */
export function formatMobile(digits) {
  const s = typeof digits === 'string' ? digits : '';
  const m = /^(\d{3})(\d{4})(\d{4})$/.exec(s);
  return m === null ? s : `${m[1]} ${m[2]} ${m[3]}`;
}

/**
 * 三位号段判运营商。只认三位这一档（见文件头为什么不做到七位）。
 * @param {string} digits 纯数字；长度不足十一位时返回 null（无号段可谈）
 * @returns {{segment:string,carrier:string|null}|null} 非纯数字或不足十一位返回 null
 */
export function lookupCarrier(digits) {
  if (typeof digits !== 'string' || !/^\d+$/.test(digits)) return null;
  const segment = digits.slice(0, 3);
  if (segment.length < 3) return { segment, carrier: null };
  return { segment, carrier: BY_SEGMENT.get(segment) ?? null };
}

/**
 * 校验 / 解析一个手机号。四态：`empty` / `malformed` / `unlisted` / `valid`。
 *
 * 逐项表按"解到哪一步才崩"分两级（与 `parseIdCard` 的同一条契约）：
 * 字符 / 位数那一关就出局的只给前两行、`info` 为 null（那时连十一位结构都没有，
 * 号段无从谈起）；位数过了但开头不是 `1[3-9]` 的，四行照给、`info` 照给，
 * 只把 `carrier` 收空——在 `12800138000` 旁边挂一个"运营商：未收录"等于凭空造结论。
 * `ok` 三态，**只有 false 拖垮整体结论**：号段合法但表里没这一格是 `null` + `unlisted`，
 * 不是无效号（§5.4"查不到不等于无效"在这一页的落地）。
 *
 * @param {string|number} raw 用户输入；`null` / `undefined` 当空串。十一位在 2^53 之内，
 *   数值入参在这一格不会掉末位（与银行卡 19 位那一档不同），但口径仍建议传字符串。
 * @returns {{input:string,value:string,digits:string,normalized:string,state:string,
 *   checks:object[],info:object|null,segment:string,carrier:string,
 *   caveat:string,note:string,hasCaveat:boolean}} 结果
 */
export function parseMobile(raw) {
  const text = raw === null || raw === undefined ? '' : String(raw);
  const value = text.trim();
  const { digits, stripped } = normalize(value);
  const out = {
    input: text, value, digits, normalized: stripped, state: 'empty', checks: [],
    info: null, segment: '', carrier: '',
    caveat: MOBILE_CAVEAT, note: CARRIER_NOTE, hasCaveat: false,
  };
  if (value === '') return out;
  const checks = out.checks;
  const push = (key, label, ok, detail) => checks.push({ key, label, ok, detail });

  const bad = /[^0-9]/.exec(digits);
  push('charset', '字符', !bad, bad
    ? `含非数字字符「${bad[0]}」（去掉分隔符与国际前缀后的第 ${bad.index + 1} 位）`
    : `纯数字 ${digits.length} 位${stripped ? `（${stripped}）` : ''}`);
  const lengthOk = digits.length === MOBILE_LENGTH;
  push('length', '位数', lengthOk, lengthOk
    ? `${MOBILE_LENGTH} 位`
    : `${digits.length} 位，应为 ${MOBILE_LENGTH} 位${stripped ? `（${stripped}）` : ''}`);
  if (bad || !lengthOk) {
    out.state = 'malformed';
    return out;
  }

  const seg = lookupCarrier(digits);
  const segmentOk = /^1[3-9]\d$/.test(seg.segment);
  out.segment = seg.segment;
  push('segment', '号段', segmentOk, segmentOk
    ? `${seg.segment} 落在 1[3-9] 开头这一档（三位号段）`
    : `${seg.segment} 不是移动号段开头（应以 13–19 开头）`);
  const carrierName = segmentOk ? seg.carrier : null;
  out.carrier = carrierName ?? '';
  push('carrier', '运营商', segmentOk ? (carrierName === null ? null : true) : null,
    segmentOk
      ? (carrierName === null
        ? `${seg.segment} 未收录在号段表里，不据此判无效`
        : `${carrierName}（发号口径，携号转网后不代表当前运营商）`)
      : '号段不成立，不判运营商');

  out.info = {
    digits, length: digits.length, segment: out.segment, carrier: out.carrier,
    formatted: formatMobile(digits),
    source: CARRIER_SOURCE, datasetVersion: CARRIER_META.fetchedAt,
  };
  out.hasCaveat = true;
  if (!segmentOk) {
    out.state = 'malformed';
    return out;
  }
  out.state = carrierName === null ? 'unlisted' : 'valid';
  return out;
}

/** 每次取值都保证落在 [0,1) 的随机源；口径与 `generateIdCards` / `generateBankCards` 同档 */
function checkedRng(input) {
  if (input === undefined || input === null) return seededRandom(Date.now());
  if (typeof input !== 'function') {
    throw new TypeError(`generateMobiles 的 options.rng 应为 () => number，收到 ${shapeOf(input)}`);
  }
  return () => {
    const v = input();
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1) {
      throw new TypeError(`generateMobiles 的 options.rng 每次应给出 [0, 1) 内的有限数，收到 ${shapeOf(v)}`);
    }
    return v;
  };
}

/** 收窄用的字符串选项：只认非空字符串，`null` / 数值一律抛（同 idcard 的 `prefixOf` 口径） */
function textOption(o, key, pattern, label) {
  const v = o[key];
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string' || (pattern !== null && !pattern.test(v.trim()))
    || (pattern === null && v.trim() === '')) {
    throw new TypeError(`generateMobiles 的 options.${label} 应为${pattern ? `匹配 ${pattern}` : '非空字符串'}，收到 ${shapeOf(v)}`);
  }
  return v.trim();
}

/**
 * 生成合法测试手机号。**只从表内的号段出**，所以每一条都能被 `parseMobile` 判 `valid`；
 * 不做归属地，所以没有"城市"这一格可挑。生成后立即自检，不成立就抛内部不变量。
 *
 * @param {{count?:number, carrier?:string, segment?:string, rng?:() => number}} [options]
 *   整个对象传 `null` / `undefined` 等于没传
 * @throws {TypeError} `carrier` 不是非空字符串、`segment` 不是三位数字字符串、`rng` 形状不对
 * @throws {RangeError} `count` 不在 1..50、`carrier` 不在表内五家里、`segment` 不在表内号段里、
 *   两者同时给了但号段不属于这家
 * @returns {{number:string,formatted:string,segment:string,carrier:string,caveat:string,
 *   note:string}[]} 号码列表
 */
export function generateMobiles(options = {}) {
  const o = options ?? {};
  const rng = checkedRng(o.rng);
  const count = o.count === undefined ? 1 : o.count;
  if (!Number.isInteger(count) || count < 1 || count > GENERATE_MAX) {
    throw new RangeError(`generateMobiles 的 options.count 应为 1..${GENERATE_MAX} 的整数，收到 ${shapeOf(o.count)}`);
  }
  const carrier = textOption(o, 'carrier', null, 'carrier');
  if (carrier !== '' && !SEGMENTS_BY_CARRIER.has(carrier)) {
    throw new RangeError(
      `generateMobiles 的 options.carrier（${carrier}）不在表内 ${CARRIERS.length} 家运营商里`);
  }
  const segment = textOption(o, 'segment', /^\d{3}$/, 'segment');
  if (segment !== '' && !BY_SEGMENT.has(segment)) {
    throw new RangeError(
      `generateMobiles 的 options.segment（${segment}）不在表内 ${SEGMENTS.length} 个号段里`);
  }
  let pool = segment === '' ? SEGMENTS : [segment];
  if (carrier !== '') {
    const owned = SEGMENTS_BY_CARRIER.get(carrier);
    pool = pool.filter((s) => owned.includes(s));
    if (pool.length === 0) {
      throw new RangeError(`号段 ${segment} 不属于 ${carrier}（表内它归 ${BY_SEGMENT.get(segment)}）`);
    }
  }

  const list = [];
  for (let i = 0; i < count; i += 1) {
    const seg = pool[Math.floor(rng() * pool.length)];
    let tail = '';
    while (tail.length < MOBILE_LENGTH - 3) tail += String(Math.floor(rng() * 10));
    const number = seg + tail;
    const self = parseMobile(number);
    // 三条一起判：格式正则、状态、以及"读回来的号段就是本条用的号段"。
    // 后两条今天就能红（号段表若长出重叠段，§F0 从数据侧盯着，这一格从行为侧盯）；
    // 第一条是给 `MOBILE_RE` 本身留的牙——它一旦被改动，生成侧当场就报，而不是让
    // 页面上一堆"合法号码"和这条正则各说各话。
    if (!MOBILE_RE.test(number) || self.state !== 'valid' || self.segment !== seg) {
      const why = self.checks.filter((k) => k.ok === false).map((k) => `${k.label}：${k.detail}`).join(' / ');
      throw new Error(`内部不变量：生成的 ${number} 自检为 ${self.state}（${why}）`);
    }
    list.push({
      number, formatted: self.info.formatted, segment: seg,
      carrier: self.carrier, caveat: self.caveat, note: self.note,
    });
  }
  return list;
}
