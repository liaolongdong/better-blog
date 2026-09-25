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
const MS_DAY = 86400000;
const pad2 = (n) => String(n).padStart(2, '0');
/** 下界的整日基准，给生成侧按天取窗口用（与 BIRTH_FLOOR 同源，不另写一个 1900） */
const BIRTH_FLOOR_UTC = (() => {
  const [y, m, d] = BIRTH_FLOOR.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
})();

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

/** 报错文案里的"收到什么"。绝不 String() 一个 Symbol / 无原型对象（那会自己先抛）。 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (v instanceof Date) return 'Date';
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}

function wallClock() {
  const n = new Date();
  return makeDay(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

/**
 * 归一"某一天"。**只有两种形状被接受**：`YYYY-MM-DD` 字符串（且必须是真实存在的日历日期）
 * 与 `Date`（取本地分量，与 makeDay 的 utc 同基准）。别的形状一律抛 `TypeError` 并点名是哪条入参。
 *
 * 为什么从"静默回落墙钟"改成抛（`what` 就是为这句报错存在的）：
 *   1. `today: '昨天'` 此前静默按今天的墙钟判，而"注入 today"是 §B 全部年龄判据可复现的前提——
 *      实测 `parseIdCard('110101199003073503', { today: '昨天' })` 与不传 today 的输出逐字相同。
 *   2. `birthDate: '1999-02-30'` 此前只查格式不查日历，一路摇到自检那一关，抛出来的是
 *      `RangeError: 内部不变量：生成的 420581199902302791 自检为 malformed`——调用方的输入
 *      错误被记成实现有 bug。现在入参阶段就报，且不说"内部不变量"。
 * @param {string|Date} input 入参
 * @param {string} what 报错里点名的入参，如 `generateIdCards 的 options.birthDate`
 */
function toDay(input, what) {
  if (typeof input === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
    if (!m) throw new TypeError(`${what} 应为 YYYY-MM-DD 字符串或 Date，收到 ${JSON.stringify(input)}`);
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (d < 1 || d > daysInMonth(y, mo)) {
      throw new TypeError(`${what} 是 ${y} 年 ${mo} 月不存在的日期（该月最多 ${daysInMonth(y, mo)} 天）：${input}`);
    }
    return makeDay(y, mo, d);
  }
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return makeDay(input.getFullYear(), input.getMonth() + 1, input.getDate());
  }
  throw new TypeError(`${what} 应为 YYYY-MM-DD 字符串或 Date，收到 ${shapeOf(input)}`);
}

/**
 * 可选的"今天"。`undefined` 与 `null` 都算"没传"→ 墙钟——段 2 的面板在用户没指定日期时
 * 发的就是 null，这一条与 `options.count === undefined` 那道"只把没传当默认值"同族；
 * 而**传了值**（哪怕是 `'昨天'`）就必须解得开，解不开要报，不许静默按今天的墙钟判。
 * @param {string|Date|null|undefined} input 入参
 * @param {string} what 报错里点名的入参
 */
function todayOf(input, what) {
  return input === undefined || input === null ? wallClock() : toDay(input, what);
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
 * **结构非法时不出货解释性结论**（与 region.js 的 `rejectRegion` 同一条契约）：
 * `sex` 与四个"规范形态/建议形态"字段一律给空串，因为被否决的号码旁边挂一个「性别：男」
 * 或一个"建议号码"，正是这层设计要防的"看着像成功了"——`000000199003070015` 的建议形态
 * `000000199003070014` 本身还是区划非法的号。留下的两样是：原始回显（`areaCode` /
 * `birthRaw` / `seq` / `body17` 与 `value`）和逐项表，面板要说得出"坏在哪一段"只能靠它们。
 * 分两级，与"解到哪一步才崩"对齐：长度 / 字符集那一关就出局的（`110101 199003073503`、
 * 17 位串）连 `info` 都不给（null）——那时根本没有可描述的六段结构；走到解码之后再被
 * 区划 / 生日否决的，`info` 与逐项表照给，只把 `sex` 与四个形态字段收空。
 * `checkdigit` 态**不**收紧，两态的分工见下面 out.state 那一段的注释。
 *
 * @param {string|number} raw 用户输入
 * @param {{today?: string|Date}} [opts] 注入"今天"，让年龄与上限判据可复现；
 *   `opts` 与 `opts.today` 传 null 都等于没传，`today` 传别的形状则抛 `TypeError`
 * @throws {TypeError} `opts.today` 既不是 `YYYY-MM-DD` 字符串也不是 `Date`
 */
export function parseIdCard(raw, opts = {}) {
  const today = todayOf((opts ?? {}).today, 'parseIdCard 的 options.today');
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

  // 3) 行政区划：三种结论必须各归一档——现行 / 历史码 = true，未收录（父级能解）= null，
  //    省码根本不在表里 = **false**。上一版的 false 那一支零判据：把 unknown 一路归成 null
  //    之后 21 条判据一条都不红，而 990101199003070015 被判成 valid（B12 现在钉住这三档）。
  //    未收录只给 null + note，绝不下"无效"（§5.4）。
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
  /**
   * `ship` = 这一条号码允许被当成"解码结果"出货。**两态不同**是故意的：
   *   - `malformed`：长度 / 字符集 / 区划 / 生日 / 顺序码里有一项不成立，整个号不是"一个
   *     只是末位抄错的号码"，此时性别、15 位等价写法、建议形态都是凭坏数据推出来的结论。
   *   - `checkdigit`：五道结构闸门全过，只有末位与算式不符（§5.4 把这一态单列出来，
   *     面板要给的正是「算得 X / 你填 Y」和一个可以直接抄走的建议形态）。
   * 收回去的只有 `sex` 与那四个形态字段；`info.birth` 不在其内——1899-12-31 这类
   * "日期本身成立、只是越出本站下界"的解出来的日期要留给用户看（B5 钉着）。
   */
  const ship = !structuralFailed;

  const sum = out.lengthType === 18 ? weightSum(body17) : 0;
  out.info = {
    lengthType: out.lengthType, areaCode, region,
    birth: b.ok ? b.day.iso : null, birthRaw,
    ageYears: b.ok && birthOk ? ageInYears(b.day, today) : null,
    sex: ship ? (seqNum % 2 === 1 ? '男' : '女') : '', seq, body17,
    checkBit: given, expectedCheckBit: expected,
    checkWork: out.lengthType === 18 ? { sum, mod: sum % 11, table: CHECK_MAP } : null,
    datasetVersion: REGION_META.datasetVersion,
  };
  out.expectedCheckBit = expected || '';

  // 规范形态：18 位输入原样保留（错末位正是判据要显示的东西），另外给建议形态
  if (out.lengthType === 18) {
    if (ship) {
      out.id18 = compact;
      if (checkOk === false && expected) out.suggestedId18 = body17 + expected;
      if (b.ok && b.day.y >= 1900 && b.day.y <= 1999) {
        out.id15 = `${areaCode}${String(b.day.y).slice(2)}${pad2(b.day.m)}${pad2(b.day.d)}${seq}`;
        out.id15Note = '由 18 位去世纪位得来的等价写法（15 位无法表达 20xx 出生，仅作等价展示，不代表曾以 15 位签发）';
      }
    }
  } else if (ship) {
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

/**
 * 摇一个生日，使**周岁**恰好落在 [minAge, maxAge] 内；取不到任何日期时返回 null。
 *
 * 周岁对生日日期单调不增，所以"合法生日"是一整段连续的日期：
 *   上界 = 刚满 minAge 周岁那一天 = 今天往前推 minAge 年；
 *   下界 = 刚满 maxAge+1 周岁那一天的次日 = 今天往前推 maxAge+1 年再加一天。
 * 两端都按目标年份的 2 月实际天数收一下（today 落在 2/29、而目标年非闰时，2/29 这一格
 * 不存在，取 2/28——周岁照样成立，因为 2/28 不比今天晚）。再拿 BIRTH_FLOOR 夹一次下界：
 * 只往"更年轻"的方向收窄，不会把周岁推到 minAge 之下。
 *
 * 为什么不再写 `year = today.y - age`：那句没算"今年的生日过没过"，minAge:18 会生成
 * 17 周岁的人（B11 钉它；复算口径写在 B11 里——种子 s = 1..60 各 50 条，3,000 条里 19 条
 * 17 岁）。而它旁边那句"生日未到 → 整体退一年"的分支只在 age===0
 * 时才可达（生成年份至少比今年早一整年），今天没有任何判据看着它——按日期区间取号之后
 * 两个分支都不需要，周岁达标由构造保证。
 *
 * @returns {{y:number,m:number,d:number,iso:string,utc:number}|null}
 */
function randomBirthDay(rng, minAge, maxAge, today) {
  const at = (y, clampMonth = today.m) => Date.UTC(y, clampMonth - 1,
    Math.min(today.d, daysInMonth(y, clampMonth)));
  const hi = at(today.y - minAge);
  const lo = Math.max(at(today.y - maxAge - 1) + MS_DAY, BIRTH_FLOOR_UTC);
  if (lo > hi) return null;
  const span = Math.floor((hi - lo) / MS_DAY) + 1;
  const d = new Date(lo + Math.floor(rng() * span) * MS_DAY);
  return makeDay(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * 校验并包一层可注入随机源。`null` / `undefined` = 没传 → 时间种子；别的形状一律抛。
 *
 * 为什么连"取值"也要查（I-6 同族）：`rng: () => 2` 此前不抛，`pool[Math.floor(2 * len)]`
 * 直接取到 `undefined`，一路摇成 `undefined192225011999null` 那样的字符串，最后由自检
 * 那一关抛一句"内部不变量"——又一次把调用方的错误记成实现的 bug。现在第一次取值就报，
 * 且点名 options.rng。
 * @param {(() => number)|null|undefined} input 入参
 * @returns {() => number} 每次取值都保证落在 [0, 1) 的包装函数
 */
function checkedRng(input) {
  if (input === undefined || input === null) return seededRandom(Date.now());
  if (typeof input !== 'function') {
    throw new TypeError(`generateIdCards 的 options.rng 应为 () => number，收到 ${shapeOf(input)}`);
  }
  return () => {
    const v = input();
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1) {
      throw new TypeError(`generateIdCards 的 options.rng 每次应给出 [0, 1) 内的有限数，收到 ${shapeOf(v)}`);
    }
    return v;
  };
}

/**
 * 取地址收窄前缀：`areaCode` > `cityCode` > `provinceCode`，只看传了的那一个。
 *
 * M-11：旧写法 `String(options.areaCode ?? options.cityCode ?? options.provinceCode)`
 * 有两处洗白——数值 `110101` 被 String() 成全码、`cityCode: null` 被当成"没传"而静默
 * 放开整张现行表（2,978 条地址）。region.js 的 `normalizePrefix` 刚为同一族收过口：
 * 非字符串 → null → 空集。生成侧比它更进一步：干脆抛，因为这唯一的调用方就是段 2 的面板。
 * 空串与全空白串同样抛（"收窄到空"与"没收窄"是两种完全不同的用户意图，不许混）。
 * @param {{areaCode?:unknown, cityCode?:unknown, provinceCode?:unknown}} o 入参对象
 * @returns {string} 去空白后的前缀
 */
function prefixOf(o) {
  for (const key of ['areaCode', 'cityCode', 'provinceCode']) {
    const v = o[key];
    if (v === undefined) continue;
    if (typeof v !== 'string' || v.trim() === '') {
      throw new TypeError(`generateIdCards 的 options.${key} 应为非空字符串（区划前缀），收到 ${shapeOf(v)}`);
    }
    return v.trim();
  }
  return '';
}

/**
 * 生成校验位成立的测试号。**地址只能出自现行区划表**（§5.4：历史码只许解、不许生成）。
 * 每条生成后立刻用 parseIdCard 自检，判不得 valid 就抛——生成器与校验器互为对手。
 *
 * 入参口径与 `parseIdCard` 一致（B10 钉住这一条）：`today` 与 `birthDate` 接受
 * `YYYY-MM-DD` 字符串或 `Date`，`null` / `undefined` 都算"没传"；`areaCode` / `cityCode` /
 * `provinceCode` 只接受**非空字符串**，`null` 与数值在这里一律抛——把它们当成"没传"等于
 * 把一次类型错误放大成"从 2,978 条地址里出货"，那道 `String(options.areaCode ?? …)`
 * 正是 region.js 的 `normalizePrefix` 刚堵掉的洗白路径。
 *
 * @param {{areaCode?:string, cityCode?:string, provinceCode?:string, birthDate?:string|Date,
 *   minAge?:number, maxAge?:number, sex?:'male'|'female'|null, count?:number,
 *   today?:string|Date, rng?:() => number}} [options]
 * @throws {RangeError} 数量 / 性别 / 年龄区间 / 区划前缀无候选 / 日期越界等业务规则不成立
 * @throws {TypeError} 任一入参的形状或类型不对（不是"传了个坏值"，是"根本不该这么传"）
 */
export function generateIdCards(options = {}) {
  const o = options ?? {};
  const today = todayOf(o.today, 'generateIdCards 的 options.today');
  const rng = checkedRng(o.rng);
  // 只把「没传」当默认值：`?? 1` 会把 count: null 也吞成 1，等于一次类型错误静默出货一条号码
  const count = o.count === undefined ? 1 : o.count;
  if (!Number.isInteger(count) || count < 1 || count > GENERATE_MAX) {
    throw new RangeError(`数量应为 1..${GENERATE_MAX} 的整数，收到 ${shapeOf(o.count)}`);
  }
  const sex = o.sex ?? null;
  if (sex !== null && sex !== 'male' && sex !== 'female') {
    throw new RangeError(`性别只接受 male / female / null，收到 ${shapeOf(o.sex)}`);
  }
  const minAge = o.minAge ?? 18;
  const maxAge = o.maxAge ?? 60;
  if (o.minAge !== undefined && o.minAge !== null && !Number.isInteger(o.minAge)) {
    throw new TypeError(`generateIdCards 的 options.minAge 应为整数周岁，收到 ${shapeOf(o.minAge)}`);
  }
  if (o.maxAge !== undefined && o.maxAge !== null && !Number.isInteger(o.maxAge)) {
    throw new TypeError(`generateIdCards 的 options.maxAge 应为整数周岁，收到 ${shapeOf(o.maxAge)}`);
  }
  let fixedBirth = null;
  if (o.birthDate !== undefined && o.birthDate !== null) {
    fixedBirth = toDay(o.birthDate, 'generateIdCards 的 options.birthDate');
    if (fixedBirth.iso < BIRTH_FLOOR) {
      throw new RangeError(`generateIdCards 的 options.birthDate（${fixedBirth.iso}）不得早于 ${BIRTH_FLOOR}`);
    }
    if (fixedBirth.utc > today.utc) {
      throw new RangeError(`generateIdCards 的 options.birthDate（${fixedBirth.iso}）不得晚于今天（${today.iso}）`);
    }
  } else if (!Number.isInteger(minAge) || !Number.isInteger(maxAge) || minAge < 0 || maxAge < minAge || maxAge > 120) {
    throw new RangeError(
      `generateIdCards 的 options.minAge / options.maxAge 应为 0..120 之间的整数且 min ≤ max，`
      + `收到 [${shapeOf(o.minAge)}, ${shapeOf(o.maxAge)}]`);
  }

  const prefix = prefixOf(options);
  const pool = currentCountyCodes(prefix);
  if (pool.length === 0) {
    throw new RangeError(`没有可生成的行政区划（前缀「${prefix || '空'}」，区划数据截止 ${REGION_META.datasetVersion}）`);
  }

  const list = [];
  for (let i = 0; i < count; i += 1) {
    const areaCode = pool[Math.floor(rng() * pool.length)];
    const birth = fixedBirth ?? randomBirthDay(rng, minAge, maxAge, today);
    if (!birth) {
      throw new RangeError(`周岁区间 [${minAge}, ${maxAge}] 在 ${today.iso} 这天与本站下界 ${BIRTH_FLOOR} 之间取不到任何生日`);
    }
    const seq = pickSeq(rng, sex);
    const body17 = `${areaCode}${birth.y}${pad2(birth.m)}${pad2(birth.d)}${seq}`;
    const checkBit = computeCheckDigit(body17);
    const id18 = body17 + checkBit;
    const self = parseIdCard(id18, { today: today.iso });
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
