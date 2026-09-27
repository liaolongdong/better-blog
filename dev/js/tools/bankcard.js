/**
 * 银行卡：Luhn 校验（带逐位算式）、BIN 最长前缀查表、生成侧。
 *
 * 数据来自 `bank-bin-data.js`（第三方快照 `hexindai/bcbc` 生成，见该文件头与
 * `assets/data/LICENSES.md`）。**行别与登记位数一律标"参考"**：快照是别人整理的结果、
 * 不含新发卡与调整，所以本模块把"前缀查不到"与"登记位数不一致"都归为 `null`
 * （不下结论）而不是 `false`——§5.4 的"查不到不等于无效"在这一页的落地方式。
 *
 * 与 `idcard.js` / `uscc.js` 同一套约定：纯函数、不碰 DOM、入参形状不对就抛。
 */
import { seededRandom } from './random.js';
import { BANKS, BIN_META, BIN_ROWS } from './bank-bin-data.js';

/** 卡号合法位数区间（§5.1：13–19 位）。表内登记的位数只落在这五档里。 */
export const PAN_MIN = 13;
export const PAN_MAX = 19;
/** 单次生成的条数上限，与 `generateIdCards` 同一档 */
export const GENERATE_MAX = 50;
/**
 * 单张卡号最多重取几次随机体（模块内部口径，不导出：面板不需要知道重试存在）。
 * 存在的理由是表里**确实**有嵌套前缀，见 `generateBankCards` 里那段判据的注释。
 */
const BODY_RETRY_MAX = 24;
/** 卡种类 → 中文；快照里只出现这四种（实测 CC 633 / DC 1056 / PC 6 / SCC 14 条） */
export const CARD_TYPES = { DC: '借记卡', CC: '贷记卡', PC: '预付费卡', SCC: '准贷记卡' };
export const BIN_SOURCE = `${BIN_META.provider} @ ${BIN_META.ref.slice(0, 7)}（快照 ${BIN_META.fetchedAt}）`;
export const BANK_CAVEAT =
  '行别与登记位数取自第三方整理的 BIN 快照，仅供参考、不承诺全量：新发卡、行别调整与'
  + '未收录前缀都不在表内，查不到不等于号码无效。';

const ROWS = BIN_ROWS.split(';').map((row) => {
  const [bin, idx, type, length] = row.split(' ');
  return {
    bin, bankCode: BANKS[+idx][0], bankName: BANKS[+idx][1],
    cardType: type, cardTypeName: CARD_TYPES[type] ?? type, panLength: +length,
  };
});

/** 前缀长度桶（降序）：10 → 3，实测八档都有条目 */
const BIN_LENGTHS = [...new Set(ROWS.map((r) => r.bin.length))].sort((a, b) => b - a);
/** `bin → 行`，一个 BIN 可以挂多条并列登记（快照实测 12 个 BIN 共 24 行） */
const BY_BIN = new Map();
for (const row of ROWS) {
  if (!BY_BIN.has(row.bin)) BY_BIN.set(row.bin, []);
  BY_BIN.get(row.bin).push(row);
}
const BANK_MAP = new Map(BANKS);

/**
 * `bin → 表内比它更长、又以它为前缀的登记前缀`（"这个 BIN 会被谁盖住"）。
 * 建法是**一遍扫每条 BIN 的全部真前缀**（1,697 个 BIN 共约 1.1 万次插入）；对着 1,697 个 BIN
 * 两两比 `startsWith` 实测 38.5–40.3ms，而本模块整个 import 才 21.4–23.7ms，首屏不值这个钱。
 * 快照实测：1,697 个 BIN 里 **8 个**有更长子前缀，嵌套对 **32 组**（`603265 ⊂ 60326500`、
 * `621260 ⊂ 621260107` 那一串、`9558 ⊂ 95588` 都在里面），其中 **9 条登记**在生成时可能被自家
 * 更长的前缀盖住——读侧按最长前缀取，一旦补齐，本条的行别甚至卡种都会换一家。
 */
const CHILD_BY_PREFIX = new Map();
for (const bin of BY_BIN.keys()) {
  for (let k = 1; k < bin.length; k += 1) {
    const p = bin.slice(0, k);
    if (!CHILD_BY_PREFIX.has(p)) CHILD_BY_PREFIX.set(p, []);
    CHILD_BY_PREFIX.get(p).push(bin);
  }
}
const childrenOf = (bin) => CHILD_BY_PREFIX.get(bin) ?? [];

/** 报错文案里的"收到什么"，与 idcard / uscc / panel 同档 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}

/**
 * 去掉卡号里常见的分组分隔符（半/全角空格、连字符、破折号、不换行空格）。
 * 与身份证不同：**内部空白不算错**——卡号惯例按 4 位分组书写，粘进来就是带分隔的。
 */
function stripSeparators(text) {
  return text.replace(/[ \t\u3000\u00A0\-\u2010-\u2015]+/g, '');
}

/**
 * Luhn 逐位算式。`body` 是**不含校验位**的数字串。
 * @param {string} body 本体数字串
 * @returns {{steps:{d:number,pos:number,double:boolean,value:number}[],sum:number,mod:number,expected:string}|null}
 *   本体不合规（空串 / 含非数字）时返回 null，由调用方判三态，与 `computeCheckDigit` 同档
 */
export function luhnWork(body) {
  const s = typeof body === 'string' ? body : '';
  if (s === '' || !/^\d+$/.test(s)) return null;
  const steps = [];
  let sum = 0;
  for (let i = 0; i < s.length; i += 1) {
    const pos = s.length - i;            // 从左数第几位（1 起），供面板标注
    const d = Number(s[i]);
    // 从右往左数第 2、4、6… 位翻倍；等价于"本体长度 - 下标"为奇数时翻倍
    const double = (s.length - i) % 2 === 1;
    const value = double ? (d * 2 > 9 ? d * 2 - 9 : d * 2) : d;
    steps.push({ d, pos, double, value });
    sum += value;
  }
  const mod = sum % 10;
  return { steps, sum, mod, expected: String((10 - mod) % 10) };
}

/** 本体 → 校验位字符；本体不合规返回 null */
export function luhnCheckDigit(body) {
  const w = luhnWork(body);
  return w === null ? null : w.expected;
}

/** 整串（含末位）的 Luhn 是否成立 */
export function luhnValid(digits) {
  if (typeof digits !== 'string' || !/^\d{2,}$/.test(digits)) return false;
  return luhnCheckDigit(digits.slice(0, -1)) === digits.slice(-1);
}

/**
 * 最长前缀查表：从 `BIN_LENGTHS` 里最大的那一档往下试，且要求**至少留一位**给账号体
 * （前缀长度 < 卡号长度）。命中即停，返回该 BIN 的**全部**并列登记。
 * @param {string} digits 纯数字卡号
 * @returns {{bin:string,rows:{bin:string,bankCode:string,bankName:string,cardType:string,cardTypeName:string,panLength:number}[],tried:number[]}|null}
 */
export function lookupBin(digits) {
  if (typeof digits !== 'string' || !/^\d+$/.test(digits)) return null;
  const tried = [];
  for (const n of BIN_LENGTHS) {
    if (n >= digits.length) continue;
    tried.push(n);
    const hit = BY_BIN.get(digits.slice(0, n));
    if (hit) return { bin: digits.slice(0, n), rows: hit, tried };
  }
  return null;
}

/** 4 位一组、空格分隔的可读形态（16 位 → `xxxx xxxx xxxx xxxx`） */
export function formatCardGroup(digits) {
  const s = typeof digits === 'string' ? digits : '';
  return s.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** 三态结论里 `bin` 那一行的文案；`primary` 由调用方按位数挑过一条 */
function binDetail(primary, rest, length) {
  if (primary === null) {
    return `前缀未收录（最长试到 ${BIN_LENGTHS[0]} 位），不据此判无效`;
  }
  const head = `${primary.bankName}（${primary.bankCode}）· ${primary.cardTypeName}`;
  const tail = rest.length > 0
    ? `；另有 ${rest.length} 条并列登记（${rest.map((x) => `${x.bankCode}/${x.cardTypeName}/${x.panLength} 位`).join('、')}）`
    : '';
  if (primary.panLength === length) return `${head} · 表内登记 ${length} 位${tail}`;
  return `${head} · 表内登记 ${primary.panLength} 位，此号 ${length} 位（登记可能有缺漏，不据此判无效）${tail}`;
}

/**
 * 校验 / 解析一个银行卡号。五态：`empty` / `malformed` / `luhn` / `unlisted` / `valid`。
 *
 * 逐项表固定四行：字符 → 位数 → Luhn → 行别前缀。`ok` 三态，**只有 false 拖垮整体结论**：
 * 前缀未收录与登记位数不符都是 `null`（§5.4 的"查不到不等于无效"）。
 * Luhn 与查表**彼此独立**：校验位不对也照样报行别，因为用户要的正是"这号是谁家的、
 * 只是末位抄错了"。
 *
 * 状态优先次序：字符/位数不合法 → `malformed`（只前两行、`info` 为 null）；
 * Luhn 不过 → `luhn`；Luhn 过但前缀查不到 → `unlisted`；否则 `valid`。
 * `luhn` 与 `unlisted` 谁在前：`luhn`——硬结论（算式不成立）优先于软参考（表外）。
 *
 * @param {string|number} raw 用户输入；`null` / `undefined` 当空串。19 位号普遍超出
 *   2^53，数值进来就已经舍过末位了，口径同 `parseIdCard`：**一律传字符串**。
 * @returns {{input:string,value:string,digits:string,state:string,checks:object[],
 *   info:object|null,matches:object[],ambiguous:boolean,suggestedCard:string,
 *   caveat:string,hasCaveat:boolean}} 结果
 */
export function parseBankCard(raw) {
  const text = raw === null || raw === undefined ? '' : String(raw);
  const value = text.trim();
  const digits = stripSeparators(value);
  const out = {
    input: text, value, digits, state: 'empty', checks: [], info: null,
    matches: [], ambiguous: false, suggestedCard: '',
    caveat: BANK_CAVEAT, hasCaveat: false,
  };
  if (value === '') return out;
  const checks = out.checks;
  const push = (key, label, ok, detail) => checks.push({ key, label, ok, detail });

  const bad = /[^0-9]/.exec(digits);
  push('charset', '字符', !bad, bad
    ? `含非数字字符「${bad[0]}」（去掉分组空格与连字符后的第 ${bad.index + 1} 位）`
    : `去掉分隔符后为 ${digits.length} 位数字`);
  const lengthOk = digits.length >= PAN_MIN && digits.length <= PAN_MAX;
  push('length', '位数', lengthOk, lengthOk
    ? `${digits.length} 位（在 ${PAN_MIN}–${PAN_MAX} 位区间内）`
    : `${digits.length} 位，超出 ${PAN_MIN}–${PAN_MAX} 位`);
  if (bad || !lengthOk) {
    out.state = 'malformed';
    return out;
  }

  const work = luhnWork(digits.slice(0, -1));
  const expected = work.expected;
  const given = digits.slice(-1);
  const luhnOk = expected === given;
  push('luhn', 'Luhn 校验', luhnOk, luhnOk
    ? `逐位求和 ${work.sum}，mod 10 = ${work.mod} → 校验位 ${expected}，与末位一致`
    : `逐位求和 ${work.sum}，mod 10 = ${work.mod} → 算得 ${expected}，号码末位是 ${given}`);

  const found = lookupBin(digits);
  const rows = found === null ? [] : found.rows;
  // 并列登记里挑**与实测位数一致**的那一条作为主结论（12 个 BIN 有两条，例如 621260 同时
  // 挂着 SPABANK 贷记 16 位与 CSRCB 借记 19 位）；全都不一致时退回第一条，让文案说出
  // "表内登记 X 位、此号 Y 位"，而不是悄悄换一家。
  const primary = rows.find((m) => m.panLength === digits.length) ?? rows[0] ?? null;
  const rest = primary === null ? [] : rows.filter((m) => m !== primary);
  out.matches = rows.map((m) => ({ ...m, lengthMatches: m.panLength === digits.length }));
  out.ambiguous = rows.length > 1;
  push('bin', '行别前缀', primary === null ? null
    : (primary.panLength === digits.length ? true : null), binDetail(primary, rest, digits.length));

  out.info = {
    digits, length: digits.length,
    bin: primary === null ? '' : primary.bin,
    binLength: primary === null ? null : primary.bin.length,
    primary,
    triedLengths: found === null ? [...BIN_LENGTHS].filter((n) => n < digits.length) : found.tried,
    luhnExpected: expected, luhnGiven: given, luhnWork: work,
    source: BIN_SOURCE, datasetVersion: BIN_META.fetchedAt,
  };
  out.hasCaveat = true;
  if (!luhnOk) {
    out.state = 'luhn';
    out.suggestedCard = digits.slice(0, -1) + expected;
    return out;
  }
  out.state = primary === null ? 'unlisted' : 'valid';
  return out;
}

/**
 * 多行逐条判定（§5.1 的"一次粘多行"）。空行跳过，其余原样交给 `parseBankCard`。
 * @param {string} text 多行文本
 * @returns {{line:number,raw:string,result:object}[]} 每行一条，`line` 是 1 起的原行号
 */
export function parseBankCardList(text) {
  const src = text === null || text === undefined ? '' : String(text);
  const rows = [];
  src.split(/\r?\n/).forEach((line, i) => {
    if (line.trim() === '') return;
    rows.push({ line: i + 1, raw: line, result: parseBankCard(line) });
  });
  return rows;
}

/** 每次取值都保证落在 [0,1) 的随机源；形状与 `generateIdCards` 的同名闸门一致 */
function checkedRng(input) {
  if (input === undefined || input === null) return seededRandom(Date.now());
  if (typeof input !== 'function') {
    throw new TypeError(`generateBankCards 的 options.rng 应为 () => number，收到 ${shapeOf(input)}`);
  }
  return () => {
    const v = input();
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1) {
      throw new TypeError(`generateBankCards 的 options.rng 每次应给出 [0, 1) 内的有限数，收到 ${shapeOf(v)}`);
    }
    return v;
  };
}

/** 收窄用的字符串键：只认非空字符串，`null` / 数值一律抛（同 idcard 的 `prefixOf` 口径） */
function textOption(o, key) {
  const v = o[key];
  if (v === undefined) return '';
  if (typeof v !== 'string' || v.trim() === '') {
    throw new TypeError(`generateBankCards 的 options.${key} 应为非空字符串，收到 ${shapeOf(v)}`);
  }
  return v.trim().toUpperCase();
}

/**
 * 生成 Luhn 成立的测试卡号。**只从表内的 BIN 出**，所以每一条都能被 `parseBankCard`
 * 判成 `valid`；生成后立即自检，不成立就抛内部不变量。
 *
 * @param {{count?:number, bankCode?:string, cardType?:string, bin?:string, length?:number,
 *   rng?:() => number}} [options] 整个对象传 `null` / `undefined` 等于没传
 * @throws {TypeError} `bankCode` / `cardType` / `bin` 不是非空字符串、`length` 不是数值
 * @throws {RangeError} `count` 不在 1..50、`cardType` 不在四种里、`length` 不在 13..19、
 *   这些收窄条件在表里挑不出任何 BIN
 * @returns {{number:string,formatted:string,bin:string,bankCode:string,bankName:string,
 *   cardType:string,cardTypeName:string,panLength:number,caveat:string}[]} 号码列表
 */
export function generateBankCards(options = {}) {
  const o = options ?? {};
  const rng = checkedRng(o.rng);
  const count = o.count === undefined ? 1 : o.count;
  if (!Number.isInteger(count) || count < 1 || count > GENERATE_MAX) {
    throw new RangeError(`generateBankCards 的 options.count 应为 1..${GENERATE_MAX} 的整数，收到 ${shapeOf(o.count)}`);
  }
  const bankCode = textOption(o, 'bankCode');
  if (bankCode !== '' && !BANK_MAP.has(bankCode)) {
    throw new RangeError(
      `generateBankCards 的 options.bankCode（${bankCode}）不在表内 ${BANKS.length} 个行别码里`);
  }
  const cardType = textOption(o, 'cardType');
  if (cardType !== '' && !Object.prototype.hasOwnProperty.call(CARD_TYPES, cardType)) {
    throw new RangeError(
      `generateBankCards 的 options.cardType 只能是 ${Object.keys(CARD_TYPES).join(' / ')}，收到 ${shapeOf(o.cardType)}`);
  }
  const binPrefix = textOption(o, 'bin');
  if (binPrefix !== '' && !/^\d+$/.test(binPrefix)) {
    throw new RangeError(`generateBankCards 的 options.bin 只能含数字，收到「${binPrefix}」`);
  }
  let wantLength;
  if (o.length !== undefined && o.length !== null) {
    if (typeof o.length !== 'number' || !Number.isInteger(o.length)) {
      throw new TypeError(`generateBankCards 的 options.length 应为整数位数，收到 ${shapeOf(o.length)}`);
    }
    if (o.length < PAN_MIN || o.length > PAN_MAX) {
      throw new RangeError(
        `generateBankCards 的 options.length 应为 ${PAN_MIN}..${PAN_MAX}，收到 ${o.length}`);
    }
    wantLength = o.length;
  }

  const pool = ROWS.filter((r) => (bankCode === '' || r.bankCode === bankCode)
    && (cardType === '' || r.cardType === cardType)
    && (binPrefix === '' || r.bin.startsWith(binPrefix))
    && (wantLength === undefined || r.panLength === wantLength));
  if (pool.length === 0) {
    const given = Object.entries({
      bankCode: bankCode || null, cardType: cardType || null,
      bin: binPrefix || null, length: wantLength ?? null,
    }).filter(([, v]) => v !== null).map(([k, v]) => `${k}=${v}`).join(' ');
    throw new RangeError(`表内没有符合条件的 BIN${given ? `（${given}）` : ''}，换一个收窄条件`);
  }

  const list = [];
  for (let i = 0; i < count; i += 1) {
    const row = pool[Math.floor(rng() * pool.length)];
    // 只有能在本条卡号里补齐的子前缀才拦得住：比登记位数长的子前缀要连校验位一起撞，够不着。
    const kids = childrenOf(row.bin).filter((b) => b.length <= row.panLength);
    let number = '';
    let self = null;
    for (let attempt = 0; attempt < BODY_RETRY_MAX; attempt += 1) {
      let body = row.bin;
      while (body.length < row.panLength - 1) {
        let d = Math.floor(rng() * 10);
        // 这一位要是把某个更长的登记前缀补满（`body+d` 还是某个子前缀的前缀），就顺位往后挪。
        // 判据必须带"当前本体仍是子前缀的前缀"这一半：只看长度会把早已岔开的分支也算成挡路。
        // 实测最挤的分支是 `621260` 下 `62126010` 开头那 8 条，挡 8 个数字、留 2 个可走，
        // 十个全被占满的分支表里没有（0/11），所以这个挪位循环一定出得来。
        for (let shift = 0; shift < 10
          && kids.some((b) => b.startsWith(body + String(d))); shift += 1) {
          d = (d + 1) % 10;
        }
        body += String(d);
      }
      number = body + luhnCheckDigit(body);
      self = parseBankCard(number);
      if (self.state === 'valid' && self.info.bin === row.bin) break;
    }
    // 两条一起判：状态必须是 valid，而且读侧**最长前缀挑中的那个 BIN**必须就是本条用的前缀。
    // 上面那格避让把"本体里能补齐"的 9 条登记全挡住了，剩下的路径只有一条：某个子前缀的长度
    // **正好等于**登记位数，要连算出来的校验位一起撞。今天这种分支一条都没有（九条挨挡登记的
    // 子前缀最长只到 `位数-1`），所以这一格实测跑不到；留着是因为它判的是"生成的行别被读侧
    // 换成另一家"这件事，而避让那格是按表算的、这一格是按真实读侧算的，两边不是同一个条件。
    if (self.state !== 'valid' || self.info.bin !== row.bin) {
      const why = self.checks.filter((k) => k.ok === false).map((k) => `${k.label}：${k.detail}`).join(' / ');
      throw new Error(`内部不变量：${row.bin}（登记 ${row.panLength} 位）连试 ${BODY_RETRY_MAX} 次，`
        + `最后一条 ${number} 自检为 ${self.state}、读出行别前缀 ${self.info ? self.info.bin : '（无）'}`
        + `${why ? `（${why}）` : ''}`);
    }
    list.push({
      number, formatted: formatCardGroup(number), bin: row.bin,
      bankCode: row.bankCode, bankName: row.bankName,
      cardType: row.cardType, cardTypeName: row.cardTypeName,
      panLength: row.panLength, caveat: self.caveat,
    });
  }
  return list;
}

/** 每个行别码在 BIN 表里挂了几条（一遍数完，别按 260 个码各扫一遍 1,709 行） */
const BIN_COUNT_BY_BANK = new Map();
for (const r of ROWS) BIN_COUNT_BY_BANK.set(r.bankCode, (BIN_COUNT_BY_BANK.get(r.bankCode) ?? 0) + 1);

/** 面板"选行别"下拉的数据源：表内实际用到的行别码，**按行别码升序**（生成器已把 BANKS 排好，
 *  这里不再按中文名排序：`localeCompare(…,'zh')` 的折叠顺序依赖 ICU 数据，Node 与浏览器
 *  不保证一致，而下拉框 260 项的可达性由下面那组"主流"承担，不靠肉眼扫中文名）。 */
export const BANK_OPTIONS = BANKS
  .map(([code, name]) => ({ code, name, binCount: BIN_COUNT_BY_BANK.get(code) ?? 0 }));

/** 常用在前：表内 BIN 条数最多的 20 家，并列按行别码升序——纯数据驱动，无 locale 依赖 */
export const TOP_BANKS = [...BANK_OPTIONS]
  .sort((a, b) => b.binCount - a.binCount || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
  .slice(0, 20);
