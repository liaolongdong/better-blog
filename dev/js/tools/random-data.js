/**
 * 随机合成数据：姓名 / 地址 / 邮箱，外加"一次一组"的三元组（设计文档 §5.1 的 `#random`）。
 *
 * **三张词表全部是本站自造的**：姓氏与名字用字取常见榜的高频子集，街道与邮箱词根是通用词，
 * 都不引第三方姓名库——所以这一格没有新的许可负担（对比 `bank-bin-data.js` / `carrier-data.js`
 * 那两张快照表）。代价是"高频"这个词只能由判据 §G 断到**形状与自洽**（表内不重复、拼出来的
 * 串可解析、每条都在字表乘积里），断不到"覆盖了多少个真实姓氏"。
 *
 * 四条对外口径都固定成导出常量，面板原样显示，别在视图里另写一句：
 * `RANDOM_CAVEAT` 是 §5.5 那句生成类提示的原文（与 `idcard.js` 的 `USE_NOTE` 逐字相同，
 * §G 判这一条相等——两个模块各存一份副本、由判据钉住不漂移，是为了不为了一个字串
 * 给 random-data 加一条指向 idcard 的 import 边），`NAME_NOTE` 明写不指向真实个人，
 * `EMAIL_NOTE` 说明为什么只用 `example.*`（RFC 2606 保留域，投不出去）。
 *
 * 地址的区划一律出自**现行**区划表（§5.4：历史码只许解、不许生成），收窄口径照
 * `idcard.js` 的 `prefixOf`：`areaCode > cityCode > provinceCode`，非字符串与空串一律抛。
 * 与 `idcard.js` / `bankcard.js` / `phone.js` 同一套约定：纯函数、不碰 DOM、入参形状不对就抛。
 */
import { seededRandom } from './random.js';
import { currentCountyCodes, resolveRegion } from './region.js';

/** 单次生成的条数上限，与 `generateIdCards` / `generateBankCards` / `generateMobiles` 同一档 */
export const GENERATE_MAX = 50;
/** §5.5 原文，一字不改；`idcard.js` 的 `USE_NOTE` 是同一句，§G 判两者相等 */
export const RANDOM_CAVEAT =
  '随机合成，与真实号码重合的概率可忽略；仅供开发与测试用途，不得用于任何真实身份用途。';
export const NAME_NOTE =
  '姓氏表与名字用字表是本站自造的高频子集，不引第三方姓名库；随机组合出来的姓名不指向任何真实个人。';
export const ADDRESS_NOTE =
  '地址的行政区划出自现行区划表（历史码只许解、不许生成），街道与门牌是通用词随机拼的，不指向真实门牌。';
export const EMAIL_NOTE =
  '邮箱一律落在 example.com / example.net / example.org——RFC 2606 保留的教学与测试域，'
  + '发给这些地址不会投递到任何真实邮箱。';
/** RFC 2606 保留域，`generateEmails` 的 `domain` 只认这三个 */
export const EMAIL_DOMAINS = ['example.com', 'example.net', 'example.org'];

/**
 * 生成侧的形状契约：`词根[.词根] + 2–4 位数字 + @ + 保留域`。
 * 域名那一半是**从 `EMAIL_DOMAINS` 拼出来的**，不是手抄——手抄的一份会在有人加第四个域时
 * 悄悄跟表脱钩，那时"只落保留域"这条主张就只剩注释在承诺了。
 */
export const EMAIL_RE = new RegExp(
  `^[a-z]{2,16}(?:\\.[a-z]{2,16})?\\d{2,4}@(?:${
    EMAIL_DOMAINS.map((d) => d.replace(/\./g, '\\.')).join('|')})$`);

/** 高频单字姓，98 字（§G-1 判它自身无重复） */
export const SURNAMES = '王李张刘陈杨黄赵吴周徐孙马朱胡郭何林高罗郑梁谢宋唐许韩冯邓曹彭曾肖田董潘袁蔡蒋余杜叶程魏苏吕丁任卢姚沈钟姜崔谭陆范汪廖石金韦贾夏傅方邹熊白孟秦邱侯江尹薛闫雷龙黎史陶贺顾毛郝龚邵万钱严覃武戴莫孔向汤'.split('');
/** 常用名字汉字，123 字（§G-1 同上）。男女混用：分性别建两张表会翻倍体积，而"某字属于哪个性别"本就断不准 */
export const GIVEN_CHARS = '伟芳娜敏静丽强磊洋勇艳杰娟涛明超霞平刚辉力华健俊帅清晨阳旭东西南北秋春夏雨雪云松柏楠梓轩宇涵欣怡悦心宜嘉艺萌蕊彤菲璐瑶琳珊琴书文智仁义礼信忠和善勤俭诚敬新昌盛兴荣富贵康安宁顺吉祥瑞霖泽润源海河湖山野川原森苗荷莲菊兰竹桃梅桂桔柳枫榕苇亮宏博思远达鹏'.split('');
/** 街道通用词 + 后缀，拼成「梧桐大道」这一类不指向真实道路的名 */
export const STREET_WORDS = ['文昌', '滨河', '东湖', '望山', '金桥', '栖霞', '南苑', '北辰',
  '启明', '惠民', '学士', '桃坞', '杏花', '枫林', '青云', '白沙', '朝阳', '永丰', '同心',
  '建新', '曙光', '甘泉', '梧桐', '永安'];
export const STREET_SUFFIXES = ['路', '街', '巷', '大道'];
/** 门牌号上界（1..200），同时是地址组合空间算式里的一格 */
const HOUSE_MAX = 200;
/** 邮箱词根：只用 ASCII 小写字母，避免中文姓名转写（那需要一张拼音表，且转写本身会造出近似真名的串） */
export const EMAIL_WORDS = ['pear', 'harbor', 'meadow', 'cedar', 'cinder', 'willow', 'quill',
  'lantern', 'thicket', 'ripple', 'summit', 'hollow', 'ember', 'frost', 'timber', 'valley',
  'harvest', 'orchard', 'pasture', 'sparrow', 'marlin', 'pilot', 'canyon', 'beacon'];

/** 报错文案里的"收到什么"，与 idcard / bankcard / phone 同档 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}

/** 每次取值都保证落在 [0,1) 的随机源；口径与另三个生成器逐字相同 */
function checkedRng(input, who) {
  if (input === undefined || input === null) return seededRandom(Date.now());
  if (typeof input !== 'function') {
    throw new TypeError(`${who} 的 options.rng 应为 () => number，收到 ${shapeOf(input)}`);
  }
  return () => {
    const v = input();
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1) {
      throw new TypeError(`${who} 的 options.rng 每次应给出 [0, 1) 内的有限数，收到 ${shapeOf(v)}`);
    }
    return v;
  };
}

/** 四个入口共用一条 count 闸门 */
function checkedCount(o, who) {
  const count = o.count === undefined ? 1 : o.count;
  if (!Number.isInteger(count) || count < 1 || count > GENERATE_MAX) {
    throw new RangeError(`${who} 的 options.count 应为 1..${GENERATE_MAX} 的整数，收到 ${shapeOf(o.count)}`);
  }
  return count;
}

/** 取地址收窄前缀：口径逐字照 `idcard.js` 的 `prefixOf`（`null` 不等于"没传"，空串也不等于） */
function prefixOf(o, who) {
  for (const key of ['areaCode', 'cityCode', 'provinceCode']) {
    const v = o[key];
    if (v === undefined) continue;
    if (typeof v !== 'string' || v.trim() === '') {
      throw new TypeError(`${who} 的 options.${key} 应为非空字符串（区划前缀），收到 ${shapeOf(v)}`);
    }
    return v.trim();
  }
  return '';
}

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const digit = (rng) => String(Math.floor(rng() * 10));

/**
 * 一批里不重复地取样。`make()` 返回 `[判重键, 结果]`——**键必须是字符串**：
 * 把对象本身塞进 Map 的话，每一格的引用都不同，"判重"会静默失效，而批内重复只有在
 * 组合空间被压到很小时才看得出来，正常随机源下 50 条抽重的概率不到千分之一。
 * 所以 §G 用一条恒定 rng（`() => 0.5`）把组合空间压成 1 格来验这一族：
 * 判重还在就抛 `RangeError`，判重被摘掉就安静地返回 `count` 条一模一样的结果。
 *
 * 凑不满时**不静默放宽**：「要 50 个不同姓名，实际给了 43 条、7 条是重复的」必须当场报，
 * 而不是让页面数一下才发现。
 * @param {() => [string, object]} make 造一个候选，返回 `[去重键, 结果]`
 * @param {number} want 条数
 * @param {number} capacity 组合空间上界（只进报错文案，不参与取样）
 * @param {string} who 报错前缀，点名是哪个入口
 * @returns {object[]} `want` 条互不重复的结果，按首次抽中顺序
 */
function uniqueBatch(make, want, capacity, who) {
  const out = new Map();
  let tries = 0;
  while (out.size < want) {
    if (tries > want * 60 + 600) {
      throw new RangeError(`${who} 要 ${want} 条不重复的结果，只凑到 ${out.size} 条`
        + `（组合空间约 ${capacity}），减一点数量或放宽收窄条件`);
    }
    const [key, item] = make();
    tries += 1;
    if (!out.has(key)) out.set(key, item);
  }
  return [...out.values()];
}

/**
 * 生成随机姓名：`姓 + 1–2 个字`，批内不重复。
 * @param {{count?:number, givenLength?:1|2, rng?:() => number}} [options] `null` / `undefined` 等于没传
 * @throws {TypeError} `givenLength` 不是 1 或 2、`rng` 形状不对
 * @throws {RangeError} `count` 不在 1..50、组合空间凑不满 `count` 条不重复
 * @returns {{name:string,surname:string,given:string,givenLength:number}[]} 一批
 */
export function generateNames(options = {}) {
  const o = options ?? {};
  const rng = checkedRng(o.rng, 'generateNames');
  const count = checkedCount(o, 'generateNames');
  let givenLength = null;
  if (o.givenLength !== undefined && o.givenLength !== null) {
    if (o.givenLength !== 1 && o.givenLength !== 2) {
      throw new TypeError(`generateNames 的 options.givenLength 只能是 1 或 2，收到 ${shapeOf(o.givenLength)}`);
    }
    givenLength = o.givenLength;
  }
  const cap = SURNAMES.length * (GIVEN_CHARS.length + GIVEN_CHARS.length ** 2);
  return uniqueBatch(() => {
    const surname = pick(SURNAMES, rng);
    const n = givenLength ?? (rng() < 0.35 ? 1 : 2);
    let given = '';
    for (let i = 0; i < n; i += 1) given += pick(GIVEN_CHARS, rng);
    const item = { name: surname + given, surname, given, givenLength: given.length };
    // 自检：姓名串必须正好是"表内姓 + givenLength 个表内字"，否则就是词表或拼接坏了
    if (!SURNAMES.includes(item.surname) || item.name !== item.surname + item.given
      || item.given.split('').some((c) => !GIVEN_CHARS.includes(c))
      || item.givenLength !== n) {
      throw new Error(`内部不变量：造出的「${item.name}」不在姓氏表 × 字表的乘积里`);
    }
    return [item.name, item];
  }, count, cap, 'generateNames');
}

/**
 * 生成随机地址：现行区划全名 + 随机街道 + 随机门牌号，批内不重复（判重键是整串 `text`）。
 *
 * 每条生成后立刻 `resolveRegion(areaCode)` 复检：必须是 `current` 且 `level === 'county'`。
 * 这一格不是走过场——`currentCountyCodes(prefix)` 一旦把市级 / 省级码混进候选，
 * 拼出来的地址就没有县名，而面板上那句"××省××市××区"会静默少一段。
 *
 * @param {{count?:number, areaCode?:string, cityCode?:string, provinceCode?:string,
 *   rng?:() => number}} [options] 三个区划键只认传了的那一个，优先级 `areaCode > cityCode > provinceCode`
 * @throws {TypeError} 区划键不是非空字符串、`rng` 形状不对
 * @throws {RangeError} `count` 不在 1..50、前缀在现行表里挑不出任何县码、凑不满不重复的一批
 * @returns {{text:string,areaCode:string,province:string,city:string,county:string,
 *   fullName:string,street:string,house:string}[]} 一批
 */
export function generateAddresses(options = {}) {
  const o = options ?? {};
  const rng = checkedRng(o.rng, 'generateAddresses');
  const count = checkedCount(o, 'generateAddresses');
  const prefix = prefixOf(o, 'generateAddresses');
  const pool = currentCountyCodes(prefix);
  if (pool.length === 0) {
    throw new RangeError(`现行区划表里没有前缀「${prefix}」下的县码，换一个省 / 市 / 县码`);
  }
  const cap = pool.length * STREET_WORDS.length * STREET_SUFFIXES.length * HOUSE_MAX;
  return uniqueBatch(() => {
    const areaCode = pick(pool, rng);
    const region = resolveRegion(areaCode);
    if (region.status !== 'current' || region.level !== 'county') {
      throw new Error(`内部不变量：${areaCode} 不是现行县级码（status=${region.status} level=${region.level}）`);
    }
    const street = `${pick(STREET_WORDS, rng)}${pick(STREET_SUFFIXES, rng)}`;
    const house = `${1 + Math.floor(rng() * HOUSE_MAX)}号`;
    const item = {
      text: `${region.fullName}${street}${house}`,
      areaCode, province: region.province, city: region.city, county: region.county,
      fullName: region.fullName, street, house,
    };
    if (!item.text.startsWith(item.fullName)) {
      throw new Error(`内部不变量：「${item.text}」不是以区划全名开头的`);
    }
    return [item.text, item];
  }, count, cap, 'generateAddresses');
}

/**
 * 生成随机邮箱：`词根[.词根]数字@example.{com,net,org}`，批内不重复。
 * 不做中文姓名转写（那需要一张拼音表，而转写出来的串更容易撞真名），local 只用 ASCII 小写。
 *
 * @param {{count?:number, domain?:string, rng?:() => number}} [options]
 * @throws {TypeError} `domain` 不是非空字符串、`rng` 形状不对
 * @throws {RangeError} `count` 不在 1..50、`domain` 不在那三个保留域里、凑不满不重复的一批
 * @returns {{email:string,local:string,domain:string}[]} 一批
 */
export function generateEmails(options = {}) {
  const o = options ?? {};
  const rng = checkedRng(o.rng, 'generateEmails');
  const count = checkedCount(o, 'generateEmails');
  let domain = null;
  if (o.domain !== undefined && o.domain !== null) {
    if (typeof o.domain !== 'string' || o.domain.trim() === '') {
      throw new TypeError(`generateEmails 的 options.domain 应为非空字符串，收到 ${shapeOf(o.domain)}`);
    }
    domain = o.domain.trim().toLowerCase();
    if (!EMAIL_DOMAINS.includes(domain)) {
      throw new RangeError(
        `generateEmails 的 options.domain（${domain}）不在保留域 ${EMAIL_DOMAINS.join(' / ')} 里`);
    }
  }
  const n = EMAIL_WORDS.length;
  const cap = EMAIL_DOMAINS.length * (n + n * n) * 9990;
  return uniqueBatch(() => {
    const a = pick(EMAIL_WORDS, rng);
    const stem = rng() < 0.5 ? a : `${a}.${pick(EMAIL_WORDS, rng)}`;
    let tail = '';
    const digits = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < digits; i += 1) tail += digit(rng);
    const local = `${stem}${tail}`;
    const host = domain ?? pick(EMAIL_DOMAINS, rng);
    const email = `${local}@${host}`;
    // 两道闸：形状必须过 EMAIL_RE（这一条判据也独立断），长度必须留在 32 之内
    // （表内最长词 7，实际最长按 7+1+7+4 = 19 算，32 是给"以后有人往词表里加长词"留的边界）
    if (!EMAIL_RE.test(email) || local.length > 32) {
      throw new Error(`内部不变量：拼出的 ${email} 不合邮箱语法（local 长度 ${local.length}）`);
    }
    return [email, { email, local, domain: host }];
  }, count, cap, 'generateEmails');
}

/**
 * 一次一组（§5.1 的"单类或一次一组"）：姓名 + 地址 + 邮箱各一条，条与条之间对齐。
 *
 * **刻意不把身份证号码挂进来**：`#idcard` 那一格有自己的区划、性别、年龄段收窄，
 * 把两边耦合成"一个完整假人"要多出一套交叉口径（地址县码必须能生成号码、生日必须与
 * 年龄段一致），而这几类的免责口径本来就是各说各话的（§5.5）。要一组带号码的，
 * 在页面上两个面板各点一次，比在数据层造一个"看起来像真人"的对象更诚实。
 *
 * 三个单类生成器各自 `checkedRng`，所以出错时点名的是**它自己**（`generateAddresses 的 …`），
 * 不是 `generateProfiles`——这一族嵌套是有意的：报的是哪一格坏，而不是从哪一格进来的。
 *
 * @param {{count?:number, areaCode?:string, cityCode?:string, provinceCode?:string,
 *   domain?:string, givenLength?:1|2, rng?:() => number}} [options]
 * @returns {{name:object,address:object,email:object}[]} 一批，`name` / `address` / `email`
 *   的形状与上面三个单类生成器逐字段一致
 */
export function generateProfiles(options = {}) {
  const o = options ?? {};
  const count = checkedCount(o, 'generateProfiles');
  const names = generateNames(o);
  const addresses = generateAddresses(o);
  const emails = generateEmails(o);
  if (names.length !== count || addresses.length !== count || emails.length !== count) {
    throw new Error(`内部不变量：三类条数没对齐（${names.length}/${addresses.length}/${emails.length} ≠ ${count}）`);
  }
  return names.map((name, i) => ({ name, address: addresses[i], email: emails[i] }));
}
