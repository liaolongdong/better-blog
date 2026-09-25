/**
 * 居民身份证号码（GB 11643-1999）：校验位、解码、三态判定、测试号生成。
 *
 * 只依赖 region.js 的返回结构、不碰 DOM：页面装配层（段 2 的 dev/js/toolIdcard.js）
 * 与 Node 判据共用同一份判定，杜绝"页面上说有效、测试里说无效"这种分裂。
 * 口径出处：设计文档 §2.2 / §5.1 / §5.4 / §5.5。
 */
import { REGION_META, resolveRegion, currentCountyCodes } from './region.js';
import { seededRandom } from './random.js';

/** 前 17 位加权因子，等价于 2^(18-i) mod 11（站内旧库就是这么算的） */
export const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
/** 下标 = Σ mod 11。旧库写作 12 − (Σ mod 11)，两种写法在 20 万条随机 body 上 0 分歧（§2.2） */
export const CHECK_MAP = '10X98765432';
/** 本站自设的出生日期下界：旧库整段注释掉了年份判断（见夹具 oracle.knownWeaknesses） */
export const BIRTH_FLOOR = '1900-01-01';
/** §11 风险表：不提供"批量导出 1 万条" */
export const GENERATE_MAX = 50;
/** §5.5 合规文案。页面与判据共用这一份，别在页面里另抄一版 */
export const USE_NOTE = '随机合成，与真实号码重合的概率可忽略；仅供开发与测试用途，不得用于任何真实身份用途。';

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const pad2 = (n) => String(n).padStart(2, '0');

export function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(year, month) {
  if (month < 1 || month > 12) return 0;
  return month === 2 && isLeapYear(year) ? 29 : DAYS[month - 1];
}

/** { y, m, d, iso, utc }：年份一律四位，utc 只做整日比较 */
function makeDay(y, m, d) {
  return { y, m, d, iso: `${y}-${pad2(m)}-${pad2(d)}`, utc: Date.UTC(y, m - 1, d) };
}

/** 接受 'YYYY-MM-DD' / Date / 缺省=今天。Date 走本地分量，与 makeDay 的 utc 同基准 */
function toDay(input) {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    return makeDay(y, m, d);
  }
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return makeDay(input.getFullYear(), input.getMonth() + 1, input.getDate());
  }
  const n = new Date();
  return makeDay(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

function ageInYears(birth, today) {
  let age = today.y - birth.y;
  if (today.m < birth.m || (today.m === birth.m && today.d < birth.d)) age -= 1;
  return age < 0 ? null : age;
}

function weightSum(body17) {
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += Number(body17[i]) * WEIGHTS[i];
  return sum;
}

/** 17 位本体 -> 校验位字符；本体不合规时返回 null（不抛，调用方判 ok 三态） */
export function computeCheckDigit(body17) {
  const s = body17 === null || body17 === undefined ? '' : String(body17);
  if (!/^\d{17}$/.test(s)) return null;
  return CHECK_MAP[weightSum(s) % 11];
}

/** 真实日历校验（含闰年）。年份：18 位取四位，15 位按 19yy 解释（§2.2） */
function decodeBirth(birthRaw, lengthType) {
  if (!/^\d+$/.test(birthRaw)) return { ok: false, reason: '出生日期含非数字字符' };
  const y = lengthType === 18 ? Number(birthRaw.slice(0, 4)) : 1900 + Number(birthRaw.slice(0, 2));
  const m = lengthType === 18 ? Number(birthRaw.slice(4, 6)) : Number(birthRaw.slice(2, 4));
  const d = lengthType === 18 ? Number(birthRaw.slice(6, 8)) : Number(birthRaw.slice(4, 6));
  if (m < 1 || m > 12) return { ok: false, reason: `月份 ${m} 不存在` };
  const last = daysInMonth(y, m);
  if (d < 1 || d > last) return { ok: false, reason: `${y} 年 ${m} 月没有 ${d} 日（该月最多 ${last} 天）` };
  return { ok: true, day: makeDay(y, m, d) };
}

/**
 * 校验 / 解码一个号码。三态：`valid` / `checkdigit` / `malformed`，另有 `empty` 表示没输入。
 *
 * 逐项表按固定顺序给出六行：字符集 → 长度 → 行政区划 → 出生日期 → 顺序码 → 校验位。
 * 每行 `ok` 是三态：true / false / null（null = 这一项不下结论，例如区划未收录、
 * 15 位无校验位）。**只有 false 才拖垮整体结论**——这是 §5.4"查不到不等于无效"的落地方式。
 *
 * @param {string|number} raw 用户输入
 * @param {{today?: string|Date}} [opts] 注入"今天"，让年龄与上限判据可复现
 */
export function parseIdCard(raw, opts = {}) {
  const today = toDay(opts.today);
  const text = raw === null || raw === undefined ? '' : String(raw);
  const value = text.trim().toUpperCase();
  const compact = value.replace(/\s+/g, '');

  const out = {
    input: text, value, state: 'empty', lengthType: null, checks: [], info: null,
    id18: '', id15: '', id15Note: '', expectedCheckBit: '', suggestedId18: '',
    caveat: '', hasCaveat: false, repairedHint: '',
  };
  if (value === '') return out;

  const checks = out.checks;
  const push = (key, label, ok, detail) => checks.push({ key, label, ok, detail });

  // 1) 字符集：只允许数字，X 仅可作为 18 位串的末位；内部空白不吞（旧库对 15 位末位字母放行，我们不）
  const hasInnerSpace = /\s/.test(value);
  const shapeOk = /^\d{18}$/.test(compact) || /^\d{15}$/.test(compact) || /^\d{17}X$/.test(compact);
  const charsetOk = !hasInnerSpace && shapeOk;
  push('charset', '字符集', charsetOk, charsetOk
    ? `仅数字${compact.endsWith('X') ? '，末位 X' : ''}`
    : (hasInnerSpace ? '号码中间含空格' : '只允许数字，X 只能出现在 18 位号码的末位'));
  if (hasInnerSpace && (compact.length === 15 || compact.length === 18)) out.repairedHint = compact;

  // 2) 长度
  out.lengthType = compact.length === 18 ? 18 : compact.length === 15 ? 15 : null;
  push('length', '长度', out.lengthType !== null,
    `${compact.length} 位${out.lengthType ? '' : '（应为 15 或 18 位）'}`);
  if (!charsetOk || out.lengthType === null) {
    out.state = 'malformed';
    return out;
  }

  const areaCode = compact.slice(0, 6);
  const birthRaw = compact.slice(6, out.lengthType === 18 ? 14 : 12);
  // 顺序码是**本体**的最后 3 位，不是整串的最后 3 位：18 位串上 `slice(-3)` 会把校验位
  // 一起当成顺序码（'…3503' 解成 503），性别奇偶与 000 判定同时错位——B2/B4/B6/B7/B8 五条
  // 判据一起抓到它，旧库那边 `code.body.slice(-3)` 吃的本来就是去掉末位的本体。
  const orderStart = out.lengthType === 18 ? 14 : 12;
  const seq = compact.slice(orderStart, orderStart + 3);
  const seqNum = Number(seq);

  // 3) 行政区划：未收录只给 null + note，绝不下"无效"（§5.4）
  const region = resolveRegion(areaCode);
  const regionOk = region.status === 'current' || region.status === 'abolished'
    ? true : region.status === 'uncoded' ? null : false;
  push('region', '行政区划', regionOk, regionOk === null ? region.note
    : (regionOk ? `${region.fullName}${region.status === 'abolished' ? '（历史码）' : ''}` : region.note || `${areaCode} 无法解析`));

  // 4) 出生日期：真实日历 + 上下界
  const b = decodeBirth(birthRaw, out.lengthType);
  let birthOk = true;
  let birthWhy = '';
  if (!b.ok) { birthOk = false; birthWhy = b.reason; } else if (b.day.iso < BIRTH_FLOOR) {
    birthOk = false; birthWhy = `早于 ${BIRTH_FLOOR}（本站自设下界）`;
  } else if (b.day.utc > today.utc) {
    birthOk = false; birthWhy = `晚于今天（${today.iso}）`;
  }
  push('birth', '出生日期', birthOk, birthOk ? b.day.iso : birthWhy);

  // 5) 顺序码：000 记一条但不否决
  const orderOk = seqNum === 0 ? null : true;
  push('order', '顺序码', orderOk, orderOk === null
    ? `${seq} 未分配（第 7–9 段实际取 001–999）`
    : `${seq} · 性别${seqNum % 2 === 1 ? '男' : '女'}`);

  // 6) 校验位：15 位无校验位；18 位把算式一并给出（§5.1 要求"看得见为什么不行"）
  //    18 位用用户填的本体，15 位按「区划 + 19 + yyMMdd + 顺序码」拼本体——不能错位取 8 位生日段
  const body17 = out.lengthType === 18 ? compact.slice(0, 17) : `${areaCode}19${birthRaw}${seq}`;
  const expected = computeCheckDigit(body17);
  const given = out.lengthType === 18 ? compact.slice(17) : '';
  let checkOk = null;
  if (out.lengthType === 15) {
    push('checkBit', '校验位', null, '15 位为第一代号码，无校验位');
  } else {
    checkOk = expected === given;
    const mod = weightSum(body17) % 11;
    push('checkBit', '校验位', checkOk, checkOk
      ? `Σ加权 mod 11 = ${mod} → ${expected}，与末位一致`
      : `算得 ${expected}，号码末位是 ${given}`);
  }

  const structuralFailed = checks.some((k) => k.key !== 'checkBit' && k.ok === false);
  out.state = structuralFailed ? 'malformed' : (checkOk === false ? 'checkdigit' : 'valid');

  const sum = out.lengthType === 18 ? weightSum(body17) : 0;
  out.info = {
    lengthType: out.lengthType, areaCode, region,
    birth: b.ok ? b.day.iso : null, birthRaw,
    ageYears: b.ok && birthOk ? ageInYears(b.day, today) : null,
    sex: seqNum % 2 === 1 ? '男' : '女', seq, body17,
    checkBit: given, expectedCheckBit: expected,
    checkWork: out.lengthType === 18 ? { sum, mod: sum % 11, table: CHECK_MAP } : null,
    datasetVersion: REGION_META.datasetVersion,
  };
  out.expectedCheckBit = expected || '';

  // 规范形态：18 位输入原样保留（错末位正是判据要显示的东西），另外给建议形态
  if (out.lengthType === 18) {
    out.id18 = compact;
    if (checkOk === false && expected) out.suggestedId18 = body17 + expected;
    if (b.ok && b.day.y >= 1900 && b.day.y <= 1999) {
      out.id15 = `${areaCode}${String(b.day.y).slice(2)}${pad2(b.day.m)}${pad2(b.day.d)}${seq}`;
      out.id15Note = '由 18 位去世纪位得来的等价写法（15 位无法表达 20xx 出生，仅作等价展示，不代表曾以 15 位签发）';
    }
  } else {
    out.id18 = expected ? body17 + expected : body17;
    out.id15 = compact;
    out.id15Note = '15 位为第一代号码本体，无校验位';
  }

  const caveats = [];
  if (region.status === 'abolished' || region.status === 'uncoded') caveats.push(region.note);
  if (seqNum === 0) caveats.push('顺序码 000 未分配');
  out.caveat = caveats.filter(Boolean).join('；');
  out.hasCaveat = out.caveat !== '';
  return out;
}

/**
 * 多行批量：每行一条结论，空行也占一条（用户看到的是粘贴时的行号）。
 * 例外是"根本没粘贴"：null / undefined / 空串给 0 行，而不是凭空造一行 empty 结论——
 * 面板按 rows.length 报"共 N 条"，一行都不该有的时候报 1 条就是错的。
 * @returns {Array<{no:number, raw:string, result:object}>}
 */
export function parseIdCardList(text, opts = {}) {
  const s = String(text === null || text === undefined ? '' : text);
  if (s === '') return [];
  return s
    .split(/\r?\n/)
    .map((raw, i) => ({ no: i + 1, raw, result: parseIdCard(raw, opts) }));
}

/** 顺序码 1..999，永不 000；需要指定性别时就近调奇偶，边界处向内收 */
function pickSeq(rng, want) {
  const n = 1 + Math.floor(rng() * 999);
  const parity = want === 'female' ? 0 : want === 'male' ? 1 : null;
  const adj = parity === null ? n : (n % 2 === parity ? n : (n < 999 ? n + 1 : n - 1));
  return String(adj).padStart(3, '0');
}

function randomBirthDay(rng, minAge, maxAge, today) {
  const age = minAge + Math.floor(rng() * (maxAge - minAge + 1));
  const year = today.y - age;
  const month = 1 + Math.floor(rng() * 12);
  const day = 1 + Math.floor(rng() * daysInMonth(year, month));
  const cand = makeDay(year, month, day);
  if (cand.utc > today.utc) {                       // 生日未到 → 整体退一年，绝不出未来日期
    const y2 = year - 1;
    return makeDay(y2, month, Math.min(day, daysInMonth(y2, month)));
  }
  return cand.iso < BIRTH_FLOOR ? toDay(BIRTH_FLOOR) : cand;
}

/**
 * 生成校验位成立的测试号。**地址只能出自现行区划表**（§5.4：历史码只许解、不许生成）。
 * 每条生成后立刻用 parseIdCard 自检，判不得 valid 就抛——生成器与校验器互为对手。
 *
 * @param {{areaCode?:string, cityCode?:string, provinceCode?:string, birthDate?:string,
 *   minAge?:number, maxAge?:number, sex?:'male'|'female'|null, count?:number,
 *   today?:string|Date, rng?:() => number}} [options]
 */
export function generateIdCards(options = {}) {
  const today = toDay(options.today);
  const rng = typeof options.rng === 'function' ? options.rng : seededRandom(Date.now());
  // 只把「没传」当默认值：`?? 1` 会把 count: null 也吞成 1，等于一次类型错误静默出货一条号码
  const count = options.count === undefined ? 1 : options.count;
  if (!Number.isInteger(count) || count < 1 || count > GENERATE_MAX) {
    throw new RangeError(`数量应为 1..${GENERATE_MAX} 的整数，收到 ${String(count)}`);
  }
  const sex = options.sex ?? null;
  if (sex !== null && sex !== 'male' && sex !== 'female') {
    throw new RangeError('性别只接受 male / female / null');
  }
  const minAge = options.minAge ?? 18;
  const maxAge = options.maxAge ?? 60;
  let fixedBirth = null;
  if (options.birthDate !== undefined && options.birthDate !== null) {
    fixedBirth = toDay(options.birthDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(options.birthDate))) throw new RangeError('出生日期应为 YYYY-MM-DD');
    if (fixedBirth.iso < BIRTH_FLOOR) throw new RangeError(`出生日期不得早于 ${BIRTH_FLOOR}`);
    if (fixedBirth.utc > today.utc) throw new RangeError(`出生日期不得晚于今天（${today.iso}）`);
  } else if (!Number.isInteger(minAge) || !Number.isInteger(maxAge) || minAge < 0 || maxAge < minAge || maxAge > 120) {
    throw new RangeError('年龄区间应为 0..120 之间的整数且 min ≤ max');
  }

  const prefix = String(options.areaCode ?? options.cityCode ?? options.provinceCode ?? '');
  const pool = currentCountyCodes(prefix);
  if (pool.length === 0) {
    throw new RangeError(`没有可生成的行政区划（前缀「${prefix || '空'}」，区划数据截止 ${REGION_META.datasetVersion}）`);
  }

  const list = [];
  for (let i = 0; i < count; i += 1) {
    const areaCode = pool[Math.floor(rng() * pool.length)];
    const birth = fixedBirth ?? randomBirthDay(rng, minAge, maxAge, today);
    const seq = pickSeq(rng, sex);
    const body17 = `${areaCode}${birth.y}${pad2(birth.m)}${pad2(birth.d)}${seq}`;
    const checkBit = computeCheckDigit(body17);
    const id18 = body17 + checkBit;
    const self = parseIdCard(id18, { today });
    if (self.state !== 'valid') {
      const why = self.checks.filter((k) => k.ok === false).map((k) => `${k.label}：${k.detail}`).join(' / ');
      throw new Error(`内部不变量：生成的 ${id18} 自检为 ${self.state}（${why}）`);
    }
    list.push({
      id18, id15: self.id15, areaCode, region: self.info.region.fullName,
      birth: birth.iso, age: self.info.ageYears, sex: self.info.sex, seq, checkBit,
      caveat: self.caveat,
    });
  }
  return list;
}
