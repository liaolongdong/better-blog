#!/usr/bin/env node
/**
 * 把 scripts/fixtures/region-source/ 里的四份快照编译成 dev/js/tools/region-data.js。
 *
 * 三条硬要求（设计文档 §6.5）：
 *   1. 不联网。默认只读仓库内快照，因此 CI 与段 5（旧 GB2260.js 已删）之后照样能跑。
 *   2. 确定性。键按码升序、不写入运行时刻；snapshotFetchedAt 取快照的 fetchedAt，
 *      所以"同一输入 → 同一字节"成立，--check 才有意义。
 *   3. 快照哈希与 SOURCES.json 不符就拒绝生成。数据被悄悄换过比数据旧更危险。
 *
 * 用法（只接受下面两个开关，拼错的参数一律报错退出，见 parseArgs）：
 *   node scripts/build-region-data.mjs            # 生成 / 覆盖
 *   node scripts/build-region-data.mjs --check    # 只比对，不一致退出码 1（测试用例 A4 用这条）
 *   node scripts/build-region-data.mjs --fetch    # 联网刷新三份 modood 快照：抓 → 校验 → 只写快照。
 *                                                 # 与本地逐字节一致时接着生成产物；一旦改写过就不生成、
 *                                                 # 退出码 1（此刻 SOURCES.json 哈希已落后，见上面第 3 条）
 *
 * 三条输入闸门口径（第 1 条由判据 A7 自证，第 2 条由 A10 自证，第 3 条由 A8 自证）：
 *   1. 四份快照逐条过形状与引用两道校验，历史层与现行三层同一套规则：码与名称都必须是"非空
 *      字符串"，父级码必须与该行码的前缀**逐字相等**且**真的在那张表里**。少了名称那道闸，
 *      缺字段的行会被 String() 成 `undefined` 编进产物，读侧解出「北京市undefined」；少了码的
 *      类型闸，数值 1101 同样被 String() 洗成合法码，而 §build 里"按层级查现行"的三个集合存的
 *      是原始值，旧表的 110100 因此凭空多成一条历史码；少了父码存在性那道，孤儿县编进产物之后
 *      只有条数判据会红，且 A9 那句指向"产物被截断"，指错了方向。三样各有独立注入：摘名称闸
 *      红 A7 + A11（`# pass 10 / # fail 2`），摘码类型闸只红 A7 的第 8 条，摘父码存在性闸只红
 *      A7 的第 9、10 条——最后那道的两个分支各钉一条，因为只钉县级那条时删掉市级分支没人红。
 *   2. --fetch 先把三份抓进内存并全部过第 1 条那道闸，才一次性落盘；任何一步失败都不改任何文件。
 *   3. 换数据是两步动作，不是一步：--fetch 写快照 → 人工把新的 sha256/bytes/count 同步进
 *      SOURCES.json → 再跑一次生成器。产物与清单必须同时换版，所以清单哈希不符时拒绝生成。
 *      生成器只认 sha256，bytes / count / schema 三样在门里是惰性的；§B 要求人照着它们核对，
 *      所以 A8 按真实字节复算一遍，注解腐烂即红。
 *
 * 编码格式（与 dev/js/tools/region.js 的解析器一一对应，改一边必须改另一边）：
 *   RAW_PROVINCES    `码2,名`                     组间 | 分隔
 *   RAW_CITIES       `码4,码2,名`                  组间 | 分隔
 *   RAW_COUNTIES     `码4,NN名 NN名 …`              NN 是 6 位码的后 2 位；组内空格、组间 |
 *   RAW_HISTORICAL   `码6,旧表全名`                 组间 | 分隔；层级由码自身的 00 结尾形态决定
 *   名称里不得出现 , | 空白 与全角标点，assertNoDelimiters() 负责在生成时就挡住。
 *
 * 数据来源与许可：assets/data/LICENSES.md
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXDIR = resolve(ROOT, 'scripts/fixtures/region-source');
const OUT = resolve(ROOT, 'dev/js/tools/region-data.js');
const USAGE = '用法：node scripts/build-region-data.mjs [--check | --fetch]';

/**
 * 参数白名单。此前用 `ARGV.includes(...)` 判定，任何未识别的参数（`--chek`、`--CHECK`、`--help`、
 * `--dry-run`）都会静默落到"生成并可能覆盖"那一支且退出 0 —— CI 里一个手打的 `--chek`
 * 就把确定性闸门换成了"重新生成然后宣布全绿"。
 * @param {string[]} argv 去掉 node 与脚本名之后的参数
 * @returns {{check:boolean, fetch:boolean}}
 */
function parseArgs(argv) {
  for (const a of argv) {
    if (a !== '--check' && a !== '--fetch') throw new Error(`未知参数：${a}\n${USAGE}`);
  }
  if (argv.includes('--check') && argv.includes('--fetch')) {
    throw new Error(`--check 与 --fetch 互斥：前者承诺不动任何文件，后者要覆盖快照\n${USAGE}`);
  }
  return { check: argv.includes('--check'), fetch: argv.includes('--fetch') };
}

// 参数闸门在读写任何文件之前生效；用法错只打一行、不打堆栈——手打错一个字母的人
// 要看的是用法行，不是 `parseArgs` 那一段抛栈。
let flags;
try {
  flags = parseArgs(process.argv.slice(2));
} catch (e) {
  process.stderr.write(`${e.message}\n`);
  process.exit(1);
}
const { check: AS_CHECK, fetch: AS_FETCH } = flags;

const REMOTE = [
  ['provinces', 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/6fb5380de7e6c961869dcd1629df4adc088fa9bb/dist/provinces.json'],
  ['cities', 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/6fb5380de7e6c961869dcd1629df4adc088fa9bb/dist/cities.json'],
  ['areas', 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/6fb5380de7e6c961869dcd1629df4adc088fa9bb/dist/areas.json'],
];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const readRaw = (file) => readFileSync(resolve(FIXDIR, file));
const readJson = (file) => JSON.parse(readRaw(file.endsWith('.json') ? file : `${file}.json`).toString('utf8'));

/**
 * 清单里「文件名 → 声明哈希」的四条。verifyManifest 与写进产物的 REGION_META.sha256 必须
 * 出自同一份推导：这两处此前各写了一遍 `.concat([[历史层那一条]])`，任何一边被"简化"成
 * `.concat([a, b])` 都会让历史层快照脱离哈希闸门，而产物里的 sha256 表也会少一项。
 * @param {object} manifest SOURCES.json 解析结果
 * @returns {Array<[string, string]>}
 */
const manifestPairs = (manifest) => manifest.files.map((f) => [f.file, f.sha256])
  .concat([[manifest.historical.file, manifest.historical.sha256]]);

/** 快照与 SOURCES.json 不符就拒绝出货 */
function verifyManifest(manifest) {
  for (const [file, want] of manifestPairs(manifest)) {
    const got = sha256(readRaw(file));
    if (got !== want) {
      throw new Error(`快照哈希不符：${file}\n  期望 ${want}\n  实际 ${got}\n`
        + '若确需换数据：node scripts/build-region-data.mjs --fetch，并同步 SOURCES.json 与设计文档 §2.2 的条数');
    }
  }
}

/**
 * 名称必须是"真正的非空字符串"。全生成器只有这一道名称类型闸门，挂在 assertShape 上：
 * 少了它，`String(undefined)` 会得到 `'undefined'`，一路编进产物变成 `02undefined`，
 * 读侧解出「北京市undefined」这种看着像地名的事实上不是的东西，
 * 而 §A 原有六条判据一条都不会红（实测：删掉 areas.json 里 110102 的 name 并重算清单哈希）。
 * @param {string} code 该行的区划码，只用于把报错指到具体行
 * @param {unknown} name 待校验的名称
 * @param {string} scope 层级名（省级 / 市级 / 县级 / 历史层），出现在报错里
 */
function assertNameString(code, name, scope) {
  if (typeof name === 'string' && name !== '') return;
  const got = name === '' ? '空字符串'
    : name === undefined ? '字段缺失'
      : name === null ? 'null'
        : `类型 ${typeof name}`;
  throw new Error(`${scope} ${code} 的名称不是非空字符串（${got}），拒绝生成`);
}

/**
 * 名称里出现分隔符会让整张表错位解析，必须在生成时挡住。
 * 这里**不再**重复做一遍类型检查：唯一调用方在 assertShape 之后，四张表的 name 已逐行过了
 * assertNameString，所以那一道内层闸门永远不会单独被触发——实测删掉它，12 条判据一条都不红。
 * 一道红不起来的闸门等于没有闸门，还可能反过来误导（让人以为这里另有独立的类型规则）。
 * 类型闸门只有一个家，就是 assertShape；assertNoDelimiters 那道调用本身有牙，
 * 删掉它 A7 的第 7 条（名字里带全角逗号、形状全对）会红。
 */
function assertNoDelimiters(pairs) {
  const bad = pairs.filter(([, name]) => /[|,\s，、；：]/.test(name));
  if (bad.length) {
    throw new Error(`名称含分隔符，编码格式会崩：${bad.slice(0, 5).map(([c, n]) => `${c}:${n}`).join('  ')}`);
  }
}

/**
 * 逐行形状校验。五道：行是对象、码是非空数字字符串、name 是非空字符串、父码逐字前缀，外加码唯一。
 * name 这一道是后补的——此前只查 code，名称的类型问题一路漏到产物里。code 那一道同理由：
 * `String(row.code)` 会先把数值 1101 洗成合法码串，见下面的注释。
 * 父码那一道原本只查 startsWith，位数不足的父码漏过去了，见函数体注释。
 * @param {Array<{code:string, name:unknown}>} rows 待校验行
 * @param {number} len 码的位数
 * @param {string} label 层级名，出现在报错里
 * @param {string} [parentField] 父级码字段名；给了就必须与 code 的前 len-2 位逐字相等
 */
function assertShape(rows, len, label, parentField) {
  for (const row of rows) {
    if (!row || typeof row !== 'object') throw new Error(`${label} 存在非对象行：${JSON.stringify(row)}`);
    // 码的类型闸门必须在 String() 之前，理由与 name 那道一模一样，但后果不一样：
    // 数值 1101 过了 `String()` 之后码形正则、父子码等式、重复码检查全部放行，而 build()
    // 里"按其层级查现行"的三个 Set 存的是原始值（`new Set(cities.map(c => c.code))` 里是
    // 数字 1101，不是字符串 '1101'），旧表里的 110100 因此在市级查不到、凭空多出一条历史码。
    // 实测注入之后生成器 exit 0，产物把 110100 照样解成「北京市」（读侧毫无异常），
    // 判据红的是 A1（historical 1230 期望 1229）与 A2（110100 同时出现在两层）两道条数/层级
    // 检查（`# pass 9 / # fail 3`）；多出来那条红是 A7 自己的 findRow 助手找不到 1101 那行
    // （码成了数值就按字符串匹配不上），不是闸门在说话。三道没有一道的报错说得出
    // "1101 这一行的 code 类型不对"。
    if (typeof row.code !== 'string') {
      throw new Error(`${label} 的码不是字符串：${JSON.stringify(row.code)}`);
    }
    const code = row.code;
    if (!new RegExp(`^\\d{${len}}$`).test(code)) throw new Error(`${label} 码形不对：${code}`);
    assertNameString(code, row.name, label);
    // 父码必须与 code 的前 len-2 位**逐字相等**。这里原本写的是 startsWith，而它挡不住
    // 位数不足的父码：provinceCode 为 '1' 时 '1101'.startsWith('1') 成立，闸门放行，
    // 可读侧是按前 2 位分组的——同一行在生成侧的父亲是 '1'、在读侧是 '11'。
    // 实测注入 provinceCode:'1' 之后生成器 exit 0、12 条判据全绿，产物里
    // currentCityCodes('11') 变成空数组（1101 被挂到了 '1' 名下）。
    // 等式不需要额外的"父码是 len-2 位数字"正则：code 自己已过数字码形，
    // 任何与 code.slice(0, len-2) 相等的值自动就是 len-2 位数字。
    // 父码的类型同样不用单独查：与已过类型闸门的 code 逐字相等的值必然是字符串。
    if (parentField && code.slice(0, len - 2) !== row[parentField]) {
      throw new Error(
        `${label} ${code} 的父级码应逐字等于 ${code.slice(0, len - 2)}，实际是 ${JSON.stringify(row[parentField])}`,
      );
    }
  }
  const codes = rows.map((r) => r.code);
  if (new Set(codes).size !== codes.length) throw new Error(`${label} 存在重复码`);
}

/**
 * 引用完整性：父码"形状对"不等于"父码存在"。这是 assertShape 管不到的一层——它只把
 * parentField 与 code 的前缀比对，两边都是这一行自己的字段，整张表里有没有那个父亲它不知道。
 * 实测注入一条 `{code:'119901', cityCode:'1199'}`（1199 不是任何现行市）之后生成器 exit 0，
 * 产物里 119901 自成一组编进 counties 段，读侧对 119901 给出 uncoded/province「北京市」；
 * 红下来的三道判据报的都是条数，其中 A9 那句是「产物被截断，或编码格式与解析器已经不同步」，
 * 指错了方向。而 §B 的 --fetch 流程本来就要求人在新数据进来时上调 REGION_META.counts，
 * 拿条数当唯一防线等于把这道闸门写在会被顺手改掉的注释里。
 * @param {Array<{code:string}>} provinces 已过形状闸门的省级行
 * @param {Array<{code:string, provinceCode:string}>} cities 已过形状闸门的市级行
 * @param {Array<{code:string, cityCode:string}>} areas 已过形状闸门的县级行
 */
function assertParentsExist(provinces, cities, areas) {
  const provCodes = new Set(provinces.map((p) => p.code));
  const cityCodes = new Set(cities.map((c) => c.code));
  // 先市后县：县码的父码是市码，市码的父码是省码，报错时不必让人自己去查是哪一层悬空
  for (const c of cities) {
    if (!provCodes.has(c.provinceCode)) {
      throw new Error(`市级 ${c.code} 的父级码 ${c.provinceCode} 不在省级表里，拒绝生成`);
    }
  }
  for (const a of areas) {
    if (!cityCodes.has(a.cityCode)) {
      throw new Error(`县级 ${a.code} 的父级码 ${a.cityCode} 不在市级表里，拒绝生成`);
    }
  }
}

/**
 * 四份快照的输入闸门，现行三层与历史层同一套规则。
 * --fetch 拿到的候选内容也过这同一个函数，"能过校验"与"能进产物"因而不是两套判定。
 * @param {{provinces:unknown, cities:unknown, areas:unknown, legacy:unknown}} data 四份数据：
 *   三份 modood 表必须是数组，历史表必须是对象。缺这一道，限流页返回的 `{message:"..."}`
 *   会让 assertShape 的 `for (const row of rows)` 抛一句和输入毫无关系的迭代器 TypeError。
 */
function assertInputShape({ provinces, cities, areas, legacy }) {
  for (const [label, table] of [['省级', provinces], ['市级', cities], ['县级', areas]]) {
    if (!Array.isArray(table)) throw new Error(`${label} 快照不是数组，拒绝生成`);
  }
  if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) {
    throw new Error('历史层快照不是对象，拒绝生成');
  }
  // 历史层此前是 Object.entries() 裸消费的：`legacy['110224'] = null` 条数不变，
  // 任何按条数的判据都看不见它，产物里却编进 `110224,null`，读侧解出 fullName「null」；
  // 5 位键同样能过，然后由 region.js 按 00/0000 后缀猜层级。所以形状规则与现行三层同一条。
  const legacyRows = Object.entries(legacy).map(([code, name]) => ({ code, name }));
  // 顺序是"先形状、再引用、后分隔符"：assertShape 带层级名（县级 110102 …），报错能指到是
  // 哪张表的哪一行；引用完整性那道要等三张表都过了形状才查得到"父亲在不在"；
  // assertNoDelimiters 只拿到 (码, 名) 对，说不了层级，所以排最后。
  // 三道各有独立的注入：去掉 assertNoDelimiters 那次调用，A7 只有第 7 条（名字里带全角逗号、
  // 形状全对）会红；去掉 assertShape 里的父码逐字等式，红的是第 5、6 条；去掉
  // assertParentsExist，红的是第 9、10 条；去掉 code 的类型闸门，红的是第 8 条。
  assertShape(provinces, 2, '省级');
  assertShape(cities, 4, '市级', 'provinceCode');
  assertShape(areas, 6, '县级', 'cityCode');
  assertShape(legacyRows, 6, '历史层');
  assertParentsExist(provinces, cities, areas);
  assertNoDelimiters(
    [...provinces, ...cities, ...areas].map((x) => [x.code, x.name])
      .concat(legacyRows.map((x) => [x.code, x.name])),
  );
}

function build(manifest) {
  const provinces = readJson('provinces');
  const cities = readJson('cities');
  const areas = readJson('areas');
  const legacy = readJson('gb2260-2015.json');

  assertInputShape({ provinces, cities, areas, legacy });

  const curCounty = new Set(areas.map((a) => a.code));
  const curCity = new Set(cities.map((c) => c.code));
  const curProv = new Set(provinces.map((p) => p.code));

  // 历史层 = 旧表里"按其层级查现行表查不到"的码。旧表用 6 位表达三级：
  // XX0000 省级、XXXX00 市级、其余县级，所以判据必须分层级做，不能一律查县级集合。
  const historical = [];
  for (const [code, name] of Object.entries(legacy).sort(([x], [y]) => (x < y ? -1 : 1))) {
    const level = code.endsWith('0000') ? 'province' : code.endsWith('00') ? 'city' : 'county';
    const hit = level === 'province' ? curProv.has(code.slice(0, 2))
      : level === 'city' ? curCity.has(code.slice(0, 4))
        : curCounty.has(code);
    if (!hit) historical.push([code, name, level]);
  }
  const hitLegacy = Object.keys(legacy).length - historical.length;

  const sortCode = (arr) => arr.slice().sort((x, y) => (x.code < y.code ? -1 : 1));
  const rawProvinces = sortCode(provinces).map((p) => `${p.code},${p.name}`).join('|');
  const rawCities = sortCode(cities).map((c) => `${c.code},${c.provinceCode},${c.name}`).join('|');

  const byCity = new Map();
  for (const a of sortCode(areas)) {
    if (!byCity.has(a.cityCode)) byCity.set(a.cityCode, []);
    byCity.get(a.cityCode).push(`${a.code.slice(4)}${a.name}`);
  }
  const rawCounties = [...byCity.keys()].sort().map((k) => `${k},${byCity.get(k).join(' ')}`).join('|');
  const rawHistorical = historical.map(([c, n]) => `${c},${n}`).join('|');

  const meta = {
    schema: 1,
    generator: 'scripts/build-region-data.mjs',
    datasetVersion: manifest.dataset.dataAsOf,
    datasetReleaseNote: manifest.dataset.releaseNote,
    snapshotFetchedAt: manifest.fetchedAt,
    licenses: { current: manifest.dataset.license, historical: manifest.historical.license },
    counts: {
      provinces: provinces.length,
      cities: cities.length,
      counties: areas.length,
      historical: historical.length,
      legacyTotal: Object.keys(legacy).length,
    },
    historicalLevels: historical.reduce((acc, [, , lv]) => { acc[lv] = (acc[lv] || 0) + 1; return acc; }, {}),
    legacyHitCurrent: hitLegacy,
    sha256: Object.fromEntries(manifestPairs(manifest)),
  };

  const q = (s) => {
    if (/[\\'`\r\n]/.test(s)) throw new Error('数据里出现会破坏 JS 字符串的字符');
    return `'${s}'`;
  };

  return `/**
 * 行政区划码表 —— 自动生成，请勿手改。
 *
 * 生成器  ：scripts/build-region-data.mjs（重跑：node scripts/build-region-data.mjs）
 * 输入快照：scripts/fixtures/region-source/（哈希见 REGION_META.sha256）
 * 归属许可：assets/data/LICENSES.md
 * 读侧解析：dev/js/tools/region.js —— 编码格式改动必须两边同步，见生成器文件头
 *
 * 现行层口径：${manifest.dataset.releaseNote}
 * 历史层：旧表里现行层查不到的码，用来解开真实存在的老号码带的撤销区划。
 */

export const REGION_META = ${JSON.stringify(meta, null, 2)};

/** 省级：\`码2,名\`，\`|\` 分隔 */
export const RAW_PROVINCES = ${q(rawProvinces)};

/** 市级：\`码4,省码2,名\`，\`|\` 分隔 */
export const RAW_CITIES = ${q(rawCities)};

/** 县级（按市分组）：\`市码4,后2位+名 …\`，组内空格分隔、组间 \`|\` 分隔 */
export const RAW_COUNTIES = ${q(rawCounties)};

/** 历史层：\`码6,旧表全名\`，\`|\` 分隔 */
export const RAW_HISTORICAL = ${q(rawHistorical)};
`;
}

const manifest = readJson('SOURCES.json');

/**
 * --fetch 的抓取段：三份全部进内存 → JSON.parse → 过与离线生成同一套输入闸门，
 * 只有全通过才一次性落盘。
 *
 * 旧实现是循环里边抓边 writeFileSync、verifyManifest 在循环之后才跑，于是「200 + HTML 的
 * 限流页」会直接覆盖 git 跟踪的可复现输入，中途一次网络错误还会留下半新一半旧的一组输入。
 * @returns {Promise<number>} 实际改写的快照份数（0 表示上游与快照逐字节一致）
 */
async function fetchSnapshots() {
  const legacy = readJson(manifest.historical.file);
  const staged = new Map();
  for (const [name, url] of REMOTE) {
    let buf;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      buf = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      throw new Error(`抓取失败 ${name}：${e.message}\n  ${url}\n未修改任何文件。`);
    }
    let data;
    try {
      data = JSON.parse(buf.toString('utf8'));
    } catch (e) {
      // 限流页 / HTML 会以 200 回来，这一道就是把它挡在磁盘之外
      throw new Error(`${name} 的响应不是合法 JSON（多半是限流页）：${e.message}\n`
        + `  响应前 120 字节：${JSON.stringify(buf.subarray(0, 120).toString('utf8'))}\n未修改任何文件。`);
    }
    staged.set(name, { buf, data });
  }
  try {
    assertInputShape({
      provinces: staged.get('provinces').data,
      cities: staged.get('cities').data,
      areas: staged.get('areas').data,
      legacy,
    });
  } catch (e) {
    // 闸门与离线生成共用，所以这里只补一句"落盘还没发生"，不复述规则
    throw new Error(`${e.message}\n  校验的是抓回来的新内容，磁盘上的快照一个字节都没改。`);
  }
  for (const [name] of REMOTE) {
    const { buf } = staged.get(name);
    const before = readRaw(`${name}.json`);
    process.stdout.write(`${name}: ${before.length}B → ${buf.length}B ${sha256(buf).slice(0, 12)}`
      + `${buf.equals(before) ? '（一致）' : '（有变化）'}\n`);
  }
  let changed = 0;
  for (const [name, { buf }] of staged) {
    if (!buf.equals(readRaw(`${name}.json`))) {
      writeFileSync(resolve(FIXDIR, `${name}.json`), buf);
      changed += 1;
    }
  }
  return changed;
}

// --fetch 只要改写过快照，SOURCES.json 的哈希就落后了；此时生成产物等于拿旧清单给新数据背书。
// 所以停在两步流程的第一步：先由人同步 SOURCES.json 与设计文档 §2.2 的条数，再重跑生成。
const changedSnapshots = AS_FETCH ? await fetchSnapshots() : 0;

if (AS_FETCH && changedSnapshots > 0) {
  process.stdout.write(`\n已改写 ${changedSnapshots} 份快照，region-data.js 未生成。\n`
    + '下一步（这一步不能省，产物与清单必须同时换版）：\n'
    + '  1. 把新的 sha256 / bytes / count 同步进 scripts/fixtures/region-source/SOURCES.json\n'
    + '  2. 重跑 node scripts/build-region-data.mjs\n');
  process.exitCode = 1;
} else {
  verifyManifest(manifest);
  const output = build(manifest);
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;

  if (AS_CHECK) {
    if (current === output) {
      process.stdout.write(`region-data.js 与快照一致（${(Buffer.byteLength(output) / 1024).toFixed(1)}KB）\n`);
    } else {
      process.stderr.write('region-data.js 与快照不一致（产物落后于 scripts/fixtures/region-source/）\n'
        + `  产物 ${current === null ? '不存在' : `${Buffer.byteLength(current)}B`} / 期望 ${Buffer.byteLength(output)}B\n`);
      process.exitCode = 1;
    }
  } else if (current === output) {
    process.stdout.write('region-data.js 已是最新，未改写\n');
  } else {
    writeFileSync(OUT, output);
    const { gzipSync } = await import('node:zlib');
    const gz = gzipSync(Buffer.from(output)).length;
    process.stdout.write(`已生成 dev/js/tools/region-data.js：${(Buffer.byteLength(output) / 1024).toFixed(1)}KB 原始 / ${(gz / 1024).toFixed(1)}KB gzip\n`);
  }
}
