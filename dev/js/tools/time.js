/**
 * 时间戳 ⇄ 日期换算：判档、格式化、相对时间、日历差。
 *
 * 这一格有两条不许让步的规矩，整套判据（§K）都是围着它们写的：
 *
 * 1. **判档不猜档**。十位当秒、十三位当毫秒，这两档是行业惯例里唯一说得出口的东西；
 *    其余位数一律不猜，同时把"按秒"与"按毫秒"两种解释摆给用户看（K2）。
 *    十四位是个有意思的例外：按秒必然越过 {@link EPOCH_MS_LIMIT}，所以能留下的只有毫秒档——
 *    "不猜"不等于"硬给两条解释"，越界的那一条本来就不成立（K2 末尾专门钉这一格）。
 * 2. **不读运行环境**。没有 `Date.now()`、没有无参 `new Date()`、没有 `getTimezoneOffset()`、
 *    没有 `Intl` 与 `toLocale*`：本地时间只能由调用方把偏移分钟数传进来（K6 用两个不同 `TZ`
 *    的子进程跑同一批入参、比逐字节输出来证这件事，K13/K14 从源码侧再钉一遍）。
 *    这不是洁癖——面板的判据要能复算，就必须有一个"与跑它的那台机器无关"的期望值。
 *
 * 可复算口径：本文件里所有硬编码的时刻锚点都能用 `date -u` 独立复算，例如
 * `date -u -r 1000000000` → `2001-09-09 01:46:40`、`date -u -r 1709164800` → `2024-02-29 00:00:00`、
 * `date -u -r 0` → `1970-01-01 00:00:00`（星期四）。`EPOCH_MS_LIMIT` 就是 ECMAScript 给
 * `Date` 定的 UTC 上限（±8,640,000,000,000,000 毫秒），正向落在 275,760-09-13、负向落在 -271,821 年：
 * 负年份的串会原样写成 `-271821-04-20T…`，本站不替它编一套 ISO 扩展形式。
 *
 * 与 `idcard.js` / `bankcard.js` / `phone.js` / `uscc.js` 同一套约定：纯函数、不碰 DOM，
 * 并且**两档入参两种处理**（这一档由 K12 对着那四个模块核，不是本模块自己定的）：
 *   - **文本入参**照兄弟模块那句 `String(text === null || text === undefined ? '' : text)`：
 *     `null` / `undefined` 归一成空、其余 `String()` 之后再判形状，一律不抛（`parseIdCard(123)`
 *     也不抛）。唯一的例外是无原型对象——`String()` 自己抛 `TypeError`，§C 末尾已把这件事
 *     钉成"两个模块同抛才对"，本站不替它兜。
 *   - **数值入参**（`epochMs` / `nowMs` / `offsetMinutes`）才是 `TypeError` 闸门：它们是调用方
 *     算出来的量，传进来个 `1000.5` 或 `undefined` 属于装配层写错，静默洗成结论等于替 bug 圆场。
 *     报错尾巴统一是「收到 <shapeOf(值)>」，与 `uscc.js` 的 options 闸门同档。
 */

/** 输入闸门：超过这么长的串根本不进解析，避免把"位数判定"变成大数游戏（K11） */
export const MAX_INPUT_LEN = 64;
/** `Date` 的 UTC 上下限（毫秒），等价于约 ±273,790 年 */
export const EPOCH_MS_LIMIT = 8640000000000000;
const DAY_MS = 86400000;
/** 一行的口径说明，面板原样显示（与 `CARRIER_NOTE` 同一角色，与实现的逐条对账由 K17 守着） */
export const TIME_CAVEAT =
  '本模块只按整数位数判档：10 位当秒、13 位当毫秒，其余位数不猜、同时给出两种解释；'
  + '带小数的串只按「10 位整数 + 1–3 位小数的秒」接受。相对时间的「月」按 30 天、「年」按 365 天计，'
  + '是固定档而不是日历月或日历年。本地时间一律由调用方传入偏移分钟数，本模块不读运行环境时区。';

/** 内置两张表：`getUTCDay() === 0` 是周日 */
const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月'];

/** 越界那一句要复用，理由里点名上限值与年份档（K4） */
const OUT_OF_RANGE =
  `超出 Date 可表示的时间范围（±${EPOCH_MS_LIMIT} 毫秒，约 ±273,790 年）`;

/**
 * 报错消息里的值回显。为什么这里要有第二份、而不是 import `phone.js` 的那一个：
 * 同级工具模块互不 import（谁也不该因为另一个工具的口径改动被拖着回归，理由同 `uscc.js:239`），
 * 代价是"跨模块口径一致"没有编译期保证——由 §K 的 K12 与 §C 的 C9 各自对着对方核一次。
 * `object` / `symbol` 一律不回显内容：`String(Object.create(null))` 自己就会抛。
 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}

/** 整数毫秒闸门：形状不对、越出 `Date` 范围，都抛 TypeError（点名是哪个入参） */
function msGate(fn, name, v) {
  if (!Number.isInteger(v)) {
    throw new TypeError(`${fn} 的 ${name} 应为整数毫秒，收到 ${shapeOf(v)}`);
  }
  if (Math.abs(v) > EPOCH_MS_LIMIT) {
    throw new TypeError(`${fn} 的 ${name} ${OUT_OF_RANGE}，收到 ${shapeOf(v)}`);
  }
  return v;
}

/** 偏移分钟数闸门：整数 + ±14 小时之内（±840 本身可取，K12/K15 钉边界） */
function offsetGate(fn, v) {
  if (!Number.isInteger(v)) {
    throw new TypeError(`${fn} 的 offsetMinutes 应为整数分钟，收到 ${shapeOf(v)}`);
  }
  if (Math.abs(v) > 840) {
    throw new TypeError(`${fn} 的 offsetMinutes 应在 ±14 小时（±840 分钟）之内，收到 ${shapeOf(v)}`);
  }
  return v;
}

const invalid = (reason) => ({ verdict: 'invalid', epochMs: null, readings: [], reason });

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** 闰年：四年一闰、百年不闰、四百年再闰（K7 四个样本各钉一次） */
function isLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y, m) {
  if (m === 2) return isLeap(y) ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

/** 只吃整数毫秒的 UTC 分量：`Date` 在这里只是"除法的机器"，不读任何环境量 */
function utcParts(ms) {
  const d = new Date(ms);
  return {
    y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, da: d.getUTCDate(),
    h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), dow: d.getUTCDay(),
  };
}

/** 年 → 四位以上原样、月/日/时分秒补零 */
const datePart = (p) => `${pad(p.y, 4)}-${pad(p.mo)}-${pad(p.da)}`;
const timePart = (p) => `${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`;

/** `+08:00` / `-14:00` / `+11:30`；偏移 0 写成 `+00:00`，不写 `Z`（Z 是"未知偏移"时的另一种口径） */
function offsetText(minutes) {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/**
 * 裸时间戳串 → 判档。**不猜**：认得出的档给一个答案，认不出的一律 `ambiguous` 给两种解释。
 *
 * @param {string} text 一串时间戳（首尾空白会被去掉，内部空白不认）
 * @returns {{verdict:'second'|'milli'|'ambiguous'|'invalid', epochMs:number|null,
 *   readings:Array<{kind:string, epochMs:number, isoUtc:string}>, reason:string|null}}
 */
export function parseTimestamp(text) {
  const raw = String(text === null || text === undefined ? '' : text).trim();
  if (raw.length > MAX_INPUT_LEN) {
    return invalid(`输入 ${raw.length} 个字符，超过 ${MAX_INPUT_LEN} 字符输入上限，未进入解析`);
  }
  if (raw === '') return invalid('输入为空');
  const m = /^([+-]?)(\d+)(?:\.(\d{1,3}))?$/.exec(raw);
  if (!m) return invalid(shapeReason(raw));

  const sign = m[1] === '-' ? -1 : 1;
  const digits = m[2];
  const frac = m[3];
  const n = digits.length;
  const v = Number(digits);

  // 小数只允许挂在秒档上：`1000000000.5` 是"十分之一秒"，`1000000000000.5` 那种是半毫秒，
  // 本站不替用户决定该不该丢掉它——直接拒，理由点名"小数"。
  if (frac !== undefined) {
    if (n !== 10) {
      return invalid(`带小数时整数部分必须是 10 位（这一档按秒解释），实际 ${n} 位：小数只按「10 位整数 + 1–3 位小数的秒」接受`);
    }
    return finish('second', sign * (v * 1000 + Number(frac) * 10 ** (3 - frac.length)));
  }
  if (n === 10) return finish('second', sign * v * 1000);
  if (n === 13) return finish('milli', sign * v);

  const cand = [
    { kind: 'second', epochMs: sign * v * 1000 },
    { kind: 'milli', epochMs: sign * v },
  ].filter((c) => Math.abs(c.epochMs) <= EPOCH_MS_LIMIT);
  if (cand.length === 0) return invalid(OUT_OF_RANGE);
  // 只剩一条时不硬凑"两种解释"：越界的那一档本来就不成立（十四位就是这一格）
  if (cand.length === 1) {
    return { verdict: cand[0].kind, epochMs: cand[0].epochMs, readings: [], reason: null };
  }
  return {
    verdict: 'ambiguous',
    epochMs: null,
    readings: cand.map((c) => ({ kind: c.kind, epochMs: c.epochMs, isoUtc: fromEpoch(c.epochMs, 0).isoUtc })),
    reason: `${n} 位不能唯一判档：按秒与按毫秒两种解释都成立，下面两条并列给出`,
  };
}

/** 形状不对的时候，理由要点名"是哪一种不对"（K3），只写"格式错误"等于把用户支走 */
function shapeReason(raw) {
  if (/\s/.test(raw)) return '数字之间有空白：只允许去掉首尾空白后的一串数字';
  if (raw.includes('_')) return '含下划线分隔符：本站不做 1_000_000 这种书写归一';
  if (raw.includes('.')) return '小数部分只允许 1–3 位';
  if (/^[-+]?$/.test(raw)) return '只有符号没有数字';
  return '不是十进制数字串（不认 0x、1e9、Infinity、NaN 这些写法）';
}

/** 已经认出的那一档：还要过一遍范围（K4） */
function finish(kind, epochMs) {
  if (Math.abs(epochMs) > EPOCH_MS_LIMIT) return invalid(OUT_OF_RANGE);
  return { verdict: kind, epochMs, readings: [], reason: null };
}

/**
 * epoch 毫秒 → 各种表示。**偏移由调用方给**：页面传 `-new Date().getTimezoneOffset()`，
 * 本模块自己不问环境（这正是 §K 可复算的前提）。
 *
 * @param {number} epochMs 整数毫秒，可为负
 * @param {number} offsetMinutes 本地相对 UTC 的偏移分钟数，东为正，范围 ±840
 */
export function fromEpoch(epochMs, offsetMinutes) {
  msGate('fromEpoch', 'epochMs', epochMs);
  offsetGate('fromEpoch', offsetMinutes);
  // 秒档一律向下取整：-1500 ms 是 1969-12-31T23:59:58.500Z，写成 :59 而不是 :00
  const sec = Math.floor(epochMs / 1000);
  const wholeMs = sec * 1000;
  const milli = epochMs - wholeMs;
  const u = utcParts(wholeMs);
  const l = utcParts(wholeMs + offsetMinutes * 60000);
  const off = offsetText(offsetMinutes);
  return {
    isoUtc: `${datePart(u)}T${timePart(u)}Z`,
    rfc3339Utc: `${datePart(u)}T${timePart(u)}.${pad(milli, 3)}Z`,
    isoLocal: `${datePart(l)}T${timePart(l)}${off}`,
    localDisplay: `${datePart(l)} ${timePart(l)} (UTC${off}) ${WEEKDAY[l.dow]}`,
    weekday: WEEKDAY[l.dow],
    monthName: MONTHS[l.mo - 1],
    unixSeconds: sec,
    unixMillis: epochMs,
    tzOffsetMinutes: offsetMinutes,
  };
}

const rel = (n, unit, deltaMs) => ({
  text: `${n} ${unit}${deltaMs < 0 ? '前' : '后'}`,
  past: deltaMs < 0,
  future: deltaMs > 0,
});

/**
 * 相对时间。**固定档**：月 = 30 天、年 = 365 天，不是日历月也不是日历年（口径写进
 * {@link TIME_CAVEAT}，与实现的对账由 K17 钉）。两个时刻都由入参给，绝不用 `Date.now()`。
 */
export function relativeTime(epochMs, nowMs) {
  msGate('relativeTime', 'epochMs', epochMs);
  msGate('relativeTime', 'nowMs', nowMs);
  const d = epochMs - nowMs;
  if (d === 0) return { text: '此刻', past: false, future: false };
  const abs = Math.abs(d);
  const s = Math.floor(abs / 1000);
  if (s < 60) return rel(s, '秒', d);
  const mi = Math.floor(s / 60);
  if (mi < 60) return rel(mi, '分钟', d);
  const h = Math.floor(mi / 60);
  if (h < 24) return rel(h, '小时', d);
  const day = Math.floor(h / 24);
  if (day < 30) return rel(day, '天', d);
  if (day < 365) return rel(Math.floor(day / 30), '个月', d);
  return rel(Math.floor(day / 365), '年', d);
}

const dayIndexOf = (ms) => Math.floor(ms / DAY_MS);
const ymdToDayIndex = (y, mo, da) => Math.floor(Date.UTC(y, mo - 1, da) / DAY_MS);

/** 把 lo 加 months 个月，日超出该月天数时夹到月末（月末样本靠它，K8） */
function clampAddMonths(lo, months) {
  const total = lo.y * 12 + (lo.mo - 1) + months;
  const y = Math.floor(total / 12);
  const mo = (total % 12) + 1;
  const da = Math.min(lo.da, daysInMonth(y, mo));
  return { y, mo, da };
}

/**
 * 两个时刻之差，三种口径一起给：`totalDays` 是"整多少个 24 小时"（向下取整，负差向 −∞），
 * `calendarDays` 是"跨了几个 UTC 日历日"，`ymd` 是日历分解。前两条**允许不等**，
 * 23:00 → 次日 01:00 就是 0 与 1（K9 专门钉这一对）。
 *
 * 方向由 `sign` 单独说：`ymd` 描述的是 |差| 的分解，所以永远非负（反向同解，K8 断这一条）。
 */
export function dateDiff(aEpochMs, bEpochMs) {
  msGate('dateDiff', 'aEpochMs', aEpochMs);
  msGate('dateDiff', 'bEpochMs', bEpochMs);
  const totalMs = bEpochMs - aEpochMs;
  const from = aEpochMs <= bEpochMs ? aEpochMs : bEpochMs;
  const to = aEpochMs <= bEpochMs ? bEpochMs : aEpochMs;
  const lo = utcParts(Math.floor(from / 1000) * 1000);
  const hi = utcParts(Math.floor(to / 1000) * 1000);
  const hiDay = dayIndexOf(to);

  let months = (hi.y - lo.y) * 12 + (hi.mo - lo.mo);
  let anchor = clampAddMonths(lo, months);
  if (ymdToDayIndex(anchor.y, anchor.mo, anchor.da) > hiDay) {
    months -= 1;
    anchor = clampAddMonths(lo, months);
  }
  const days = hiDay - ymdToDayIndex(anchor.y, anchor.mo, anchor.da);
  return {
    sign: Math.sign(totalMs),
    totalMs,
    totalDays: Math.floor(totalMs / DAY_MS),
    calendarDays: dayIndexOf(bEpochMs) - dayIndexOf(aEpochMs),
    ymd: { years: Math.floor(months / 12), months: months % 12, days },
    breakdown: [
      ['ms', 1], ['s', 1000], ['min', 60000], ['h', 3600000], ['d', DAY_MS], ['wk', 7 * DAY_MS],
    ].map(([unit, size]) => ({ unit, value: Math.floor(totalMs / size) })),
  };
}

const CIVIL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?(Z|[-+]\d{2}:?\d{2})?$/;
const CIVIL_SHAPE = '形状应为 YYYY-MM-DD[THH:mm[:ss[.sss]]][Z|±hh:mm]，且月、日、时、分都要两位';

/**
 * 民用日期串 → epoch 毫秒。串里带了时区标记时以串为准（`offsetMinutes` 不参与），
 * 完全没带才按调用方给的偏移解释（K5 把这条钉死：两种写法必须落到同一毫秒）。
 *
 * @returns {{ok:boolean, epochMs:number|null, reason:string|null}} 形状或取值不对时
 *   `ok:false` 并给人话原因——这一格**不抛**，因为抛穿到装配层等于把输入框变成炸弹。
 */
export function parseCivilDate(text, offsetMinutes) {
  offsetGate('parseCivilDate', offsetMinutes);
  const raw = String(text === null || text === undefined ? '' : text).trim();
  const m = raw === '' ? null : CIVIL_RE.exec(raw);
  if (!m) return { ok: false, epochMs: null, reason: raw === '' ? '输入为空' : CIVIL_SHAPE };
  const [, ys, mos, das, hs, mis, ss, frac, zone] = m;
  const y = Number(ys);
  const mo = Number(mos);
  const da = Number(das);
  const hh = hs === undefined ? 0 : Number(hs);
  const mi = mis === undefined ? 0 : Number(mis);
  const se = ss === undefined ? 0 : Number(ss);
  const ms = frac === undefined ? 0 : Number(frac) * 10 ** (3 - frac.length);
  if (mo < 1 || mo > 12) return civilBad('月份应为 01–12');
  if (da < 1 || da > daysInMonth(y, mo)) {
    return civilBad(`${pad(mo)} 月没有 ${pad(da)} 日${mo === 2 && da === 29 && !isLeap(y) ? `（${y} 年不是闰年）` : ''}`);
  }
  if (hh > 23) return civilBad('小时应为 00–23');
  if (mi > 59) return civilBad('分钟应为 00–59');
  if (se > 59) return civilBad('秒应为 00–59');
  let zoneMinutes = offsetMinutes;
  if (zone) {
    if (hs === undefined) return civilBad('带时区标记时必须写出时刻');
    zoneMinutes = zone === 'Z' ? 0
      : (zone.startsWith('-') ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(-2)));
    if (Math.abs(zoneMinutes) > 840) return civilBad('时区偏移应在 ±14 小时之内');
  }
  return { ok: true, epochMs: Date.UTC(y, mo - 1, da, hh, mi, se, ms) - zoneMinutes * 60000, reason: null };
}

const civilBad = (reason) => ({ ok: false, epochMs: null, reason });
