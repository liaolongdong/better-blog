#!/usr/bin/env node
/**
 * 生成 scripts/fixtures/id-validator-checkbit-1000.json —— 身份证算法与站内旧库
 * （id-validator，MIT，作者 mc-zone）的对拍夹具。
 *
 * 为什么把旧库结论固化成文件，而不是在测试里 require 旧库：段 5 要按设计文档 §10
 * 删掉 demo/idCardDemo/，判据不能依赖一个注定消失的目录。夹具存着旧库当时的
 * isValid / getInfo 原样结果，删库之后这条对拍照样成立。
 *
 * 用法：
 *   node scripts/build-id-fixture.mjs            # 生成 / 覆盖
 *   node scripts/build-id-fixture.mjs --check    # 只比对字节，不一致退 1
 *
 * 确定性：mulberry32(20260925) + 候选码先排序后取索引 + 字段按固定顺序写入 + 不写运行时刻。
 * 同一份快照必须产出同一字节流，否则 --check 与 A4 那类幂等判据没有意义。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const require = createRequire(import.meta.url);
const OUT = 'scripts/fixtures/id-validator-checkbit-1000.json';
const USAGE = '用法：node scripts/build-id-fixture.mjs [--check]';
/** 写死而不是取墙钟：每条样本自带 today，判据永不误红于"出生日期晚于今天" */
const TODAY = '2026-09-25';

/**
 * 参数白名单（I-8）。此前全文只有一句 `process.argv.includes('--check')`，于是
 * `node scripts/build-id-fixture.mjs --nope`（或 `--chek` / `--CHECK` / `--help`）
 * 一律被当成"没写参数"，直接落进最后那行 `writeFileSync`——**手打错一个字母就把
 * 只读比对换成了覆盖提交进仓库的产物**，而且退 0。`build-region-data.mjs` 早就为
 * 同一件事加了白名单（由 A10 钉着），本生成器此前一次都没有被任何判据跑过（现由 B14 钉）。
 * @param {string[]} argv 去掉 node 与脚本名之后的参数
 * @returns {{check:boolean}}
 */
function parseArgs(argv) {
  for (const a of argv) if (a !== '--check') throw new Error(`未知参数：${a}\n${USAGE}`);
  return { check: argv.includes('--check') };
}

// 闸门在读写任何文件之前生效；用法错只打一行到 stderr、不打堆栈，且**一个字节都不写**。
let AS_CHECK;
try {
  AS_CHECK = parseArgs(process.argv.slice(2)).check;
} catch (e) {
  process.stderr.write(`${e.message}\n`);
  process.exit(1);
}


/** 分组配额，合计 1000；改配额要同步改 §B 的 B7 */
const GROUPS = {
  agree18: 670, agree15: 100, name_current_only: 100, renamed: 50,
  birth_before_1900: 30, birth_after_today: 30, feb29_nonleap: 20,
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260925);

const readJson = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const areas = readJson('scripts/fixtures/region-source/areas.json');
const cities = readJson('scripts/fixtures/region-source/cities.json');
const provinces = readJson('scripts/fixtures/region-source/provinces.json');
const legacy = readJson('scripts/fixtures/region-source/gb2260-2015.json');

const currentCounty = new Set(areas.map((a) => a.code));
const countyName = new Map(areas.map((a) => [a.code, a.name]));
const currentCity = new Set(cities.map((c) => c.code));
const provinceOf = new Map(provinces.map((p) => [p.code, p.name]));
const cityOf = new Map(cities.map((c) => [c.code, c.name]));
const legacyCounty = new Set(Object.keys(legacy).filter((k) => !k.endsWith('00')));

/** 与 dev/js/tools/region.js 的 PLACEHOLDER_CITY 同口径，独立写一份是故意的：
 *  取样池不许读被测侧，否则 B7 那条"两边地址名必须相等"就成了让读侧自己挑样本、当场自证。 */
const PLACEHOLDER_CITY = new Set(['市辖区', '县', '省直辖县级行政区划', '自治区直辖县级行政区划']);

const both = [...currentCounty].filter((c) => legacyCounty.has(c)).sort();
/**
 * 只看三份快照，把"旧表地址串 == 现行省名 + 现行市名(非占位段，且剥掉与县名重叠的前缀)"
 * 当作同名判据。
 *
 * 为什么不能只看县名（计划原先的 `legacy[c].endsWith(countyName[c])`）：2026-09-25 实读，
 * 那样筛出的 1,869 条里有 93 条两边全名必然不等——县名没变，变的是旧表里的市名或省名，
 * 那 93 条是旧表停留在 2015 年之前的口径：1406「晋城市」应为朔州市、3208 淮阴市→淮安市、
 * 4206 襄樊市→襄阳市、6203「嘉峪关市」应为金昌市、65xxxx「新疆维吾尔族自治区」多写一个"族"字。
 * 混进 agree18 只会因数据版本差异误红，而这组的断言方向是"两边一模一样"。
 *
 * `tail.startsWith(middle)` 那一刀（I-7）必须与读侧 `region.js` 的 `joinNames` 同规则：
 * 两边算的不是同一个字符串，"同名池"筛出来的样本就会在 B7 那句
 * `r.info.region.fullName === c.oracleAddr` 上按重叠前缀那一批（实读 19 条：15 条县名以市名
 * 打头的功能区 + 4 条省市县同名，如 441900 东莞市）逐条误红。本轮实测：加与不加，
 * `sameName` 都是 1,776 条、成员一模一样（那 19 条**没有一条同时在 2015 旧表里**，
 * 全是 2022 口径新增），所以这一刀不改变任何一条样本的归属——它堵的是"两份实现算的
 * 不是同一个字符串"这件事本身，而不是一批当下恰好为空的误红。别因为它今天测不出差别就删掉。
 *
 * 本判据筛出 1,776 条；与读侧 `resolveRegion().fullName` 的分叉数在两个方向上都是 0
 * （B7 逐条核过 agree18 的相等、renamed 的不等，双向都钉着）。
 */
const sameNameAsLegacy = (code) => {
  const prov = provinceOf.get(code.slice(0, 2)) || '';
  const city = cityOf.get(code.slice(0, 4)) || '';
  const middle = city === '' || PLACEHOLDER_CITY.has(city) ? '' : city;
  let tail = countyName.get(code) || '';
  if (middle && tail.startsWith(middle)) tail = tail.slice(middle.length);
  return String(legacy[code]) === `${prov}${middle}${tail}`;
};
/** 同码同名（实读 1,776 条）：只有这里的样本允许断言"两边地址名相等" */
const BOTH = both.filter(sameNameAsLegacy).sort();
/** 同码而异名（实读 156 条）：我们给现行名、旧库给 2015 年前后的旧名 */
const RENAMED = both.filter((c) => !sameNameAsLegacy(c)).sort();
/**
 * 156 条按**成因**拆三类（I-7：上一版只记了"两种成因"，实际数字是三种，且把 620201 记错档）：
 *   1. 旧串不以现行县名结尾 → 县名段自己改过（130502 桥东区→襄都区、650107 南山矿区→达坂城区…）
 *      共 63 条；
 *   2. 其中 1 条（620201）旧表在市级码下挂的是「…市辖区」占位条（甘肃省嘉峪关市市辖区），
 *      而现行 620201 的名字就叫「嘉峪关市」——差异来自旧表那条占位尾巴，不是谁改了名；
 *   3. 剩下的 62 条是真正的县名改名，另 93 条县名没变、变的是旧表里的市名 / 省名口径。
 * 拆分规则必须写成可复算的一句话，`pools` 里的三个数之和要等于 RENAMED.length，B7 钉着。
 */
const legacyEndsTail = (c) => String(legacy[c]).endsWith(countyName.get(c));
/** 旧表末段是市级占位名（市辖区 / 省直辖县级行政区划 / …）的那一类：不是"县改名" */
const PLACEHOLDER_TAIL = /(市辖区|省直辖县级行政区划|自治区直辖县级行政区划)$/;
const RENAMED_BY_PLACEHOLDER = RENAMED.filter((c) => !legacyEndsTail(c) && PLACEHOLDER_TAIL.test(String(legacy[c])));
/** 真·县名改过：旧串连现行县名都不以它结尾，且不属上面那类占位尾巴 */
const RENAMED_BY_COUNTY = RENAMED.filter((c) => !legacyEndsTail(c) && !PLACEHOLDER_TAIL.test(String(legacy[c])));
/** 仅现行有、且旧表市级可回落（实读 1,046 条市级在表的那批）：旧库必然吐「未知地区」 */
const ONLY_CURRENT = [...currentCounty]
  .filter((c) => !legacyCounty.has(c) && currentCity.has(c.slice(0, 4)))
  .sort();

if (BOTH.length < GROUPS.agree18) throw new Error(`同码同名池只有 ${BOTH.length} 条，取不够 agree18 配额`);
if (RENAMED.length < GROUPS.renamed) throw new Error(`同码改名池只有 ${RENAMED.length} 条，不足 ${GROUPS.renamed}`);
if (ONLY_CURRENT.length < GROUPS.name_current_only) throw new Error(`仅现行有的池只有 ${ONLY_CURRENT.length} 条`);

const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const pad = (n) => String(n).padStart(2, '0');
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** ISO 7064 MOD 11-2。与 dev/js/tools/idcard.js 各写一遍是故意的：
 *  共用就等于用被测实现验证被测实现，幂等判据也会跟着失去牙齿。 */
const W = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const M = '10X98765432';
const checkOf = (body17) => {
  let s = 0;
  for (let i = 0; i < 17; i += 1) s += Number(body17[i]) * W[i];
  return M[s % 11];
};
/** 顺序码 1..999：000 在真实发行里不出现，别把它当"一致"样本喂给旧库 */
const seq3 = () => String(1 + Math.floor(rng() * 999)).padStart(3, '0');
const make18 = (area, birth8, seq) => {
  const body = `${area}${birth8}${seq}`;
  return body + checkOf(body);
};
/** 1901-01-01 .. 2005-12-31 之间的合法日期：离 TODAY 足够远，年龄类判据不会随时间翻脸 */
function legalBirth() {
  const y = 1901 + Math.floor(rng() * 105);
  const m = 1 + Math.floor(rng() * 12);
  const last = [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return `${y}${pad(m)}${pad(1 + Math.floor(rng() * last))}`;
}

// 绝对路径：createRequire 的相对基准是本脚本所在的 scripts/，写 './demo/…' 会解析到 scripts/demo/…
global.GB2260 = require(resolve(ROOT, 'demo/idCardDemo/lib/GB2260.js'));
const IDValidator = require(resolve(ROOT, 'demo/idCardDemo/lib/IDValidator.js'));
const oracle = new IDValidator(global.GB2260);

/** 跑一遍旧库、原样记下它的结论；invariant 由各组自带组名地抛错 */
function record(id, invariant) {
  const valid = oracle.isValid(id);
  const info = valid ? oracle.getInfo(id) : false;
  invariant(valid, info);
  return {
    id,
    today: TODAY,
    oracleValid: valid,
    oracleAddr: info === false ? '' : info.addr,
    oracleBirth: info === false ? '' : info.birth,
    oracleSex: info === false ? '' : info.sex,
  };
}

const cases = {
  agree18: [], agree15: [], name_current_only: [], renamed: [],
  birth_before_1900: [], birth_after_today: [], feb29_nonleap: [],
};

for (let i = 0; i < GROUPS.agree18; i += 1) {
  cases.agree18.push(record(make18(pick(BOTH), legalBirth(), seq3()), (valid, info) => {
    if (valid !== true) throw new Error('agree18: 旧库判无效');
    if (/未知/.test(info.addr)) throw new Error(`agree18: 同码同名池里旧库吐了「未知」→ ${info.addr}`);
  }));
}
for (let i = 0; i < GROUPS.agree15; i += 1) {
  const area = pick(BOTH);
  cases.agree15.push(record(`${area}${legalBirth().slice(2)}${seq3()}`, (valid, info) => {
    if (valid !== true || /未知/.test(info.addr)) throw new Error('agree15: 旧库不同结论');
  }));
}
for (let i = 0; i < GROUPS.name_current_only; i += 1) {
  const area = pick(ONLY_CURRENT);
  const rec = record(make18(area, legalBirth(), seq3()), (valid, info) => {
    if (valid !== true) throw new Error('name_current_only: 旧库判无效，这组不成立');
    if (!/未知地区/.test(info.addr)) throw new Error(`name_current_only: 旧库这次没吐「未知地区」→ ${info.addr}`);
  });
  rec.areaCode = area;
  rec.currentName = countyName.get(area);
  cases.name_current_only.push(rec);
}
for (let i = 0; i < GROUPS.renamed; i += 1) {
  const area = pick(RENAMED);
  const rec = record(make18(area, legalBirth(), seq3()), (valid) => {
    if (valid !== true) throw new Error('renamed: 旧库判无效');
  });
  rec.areaCode = area;
  rec.currentName = countyName.get(area);
  rec.legacyName = String(legacy[area]);
  cases.renamed.push(rec);
}
for (let i = 0; i < GROUPS.birth_before_1900; i += 1) {
  const y = 1880 + Math.floor(rng() * 20);
  cases.birth_before_1900.push(record(make18(pick(BOTH), `${y}${pad(1 + Math.floor(rng() * 12))}${pad(1 + Math.floor(rng() * 28))}`, seq3()), (valid) => {
    if (valid !== true) throw new Error('birth_before_1900: 旧库判无效，这组的分歧方向不成立');
  }));
}
for (let i = 0; i < GROUPS.birth_after_today; i += 1) {
  const y = 2090 + Math.floor(rng() * 10);
  cases.birth_after_today.push(record(make18(pick(BOTH), `${y}0${1 + Math.floor(rng() * 8)}${pad(1 + Math.floor(rng() * 28))}`, seq3()), (valid) => {
    if (valid !== true) throw new Error('birth_after_today: 旧库判无效，这组的分歧方向不成立');
  }));
}
for (let i = 0; i < GROUPS.feb29_nonleap; i += 1) {
  // 非闰年的 2/29：摇一年，闰年就退一年。**一句就够**，别再往下加第二句——
  // 原先后面跟着一句 `if (isLeap(y)) y -= 2`，那一句永不可达：能被 `-= 1` 摸到的 y 必是
  // 闰年、必是偶数，减一之后是奇数，而闰年要求被 4 整除 ⇒ 奇数年满天下都是非闰。
  // 留着它的唯一效果是让人以为这里还需要第二道兜底（M-13：不可达分支不加判据就等于没有，
  // 而给它加判据又是造一条永绿的断言）。所以这一支删掉，闰律的正面覆盖挪到 B13——
  // 那里 1901..2100 每一年都拿 2/29 试一次，判据一侧独立写一遍闰规则。
  let y = 1901 + Math.floor(rng() * 105);
  if (isLeap(y)) y -= 1;
  cases.feb29_nonleap.push(record(make18(pick(BOTH), `${y}0229`, seq3()), (valid) => {
    if (valid !== true) throw new Error('feb29_nonleap: 旧库判无效，这组的分歧方向不成立');
  }));
}

const total = Object.values(cases).reduce((n, list) => n + list.length, 0);
if (total !== 1000) throw new Error(`夹具总数 ${total} != 1000`);

const doc = {
  schema: 1,
  generator: 'scripts/build-id-fixture.mjs',
  purpose: '身份证算法与站内旧库 id-validator 的对拍夹具；段 5 删掉 demo/idCardDemo/ 后它是唯一长期守卫',
  oracle: {
    name: 'id-validator（demo/idCardDemo/lib/IDValidator.js，文件头标 v1.2.0）',
    license: 'MIT (mc-zone)',
    knownWeaknesses: [
      'checkOrder 恒真：15 位号码末位可以是字母',
      'checkBirth 只判 month>12||month===0||day>31||day===0：非闰年 2 月 29 放过；年份上下限整段注释掉并留 TODO',
      'getAddrInfo 回落到市/省级后吐「…未知地区」，给不出可用的县级信息',
      '地址名取自 2015 年前后的 GB2260：同码异名的 156 条会给旧名（其中 62 条县名自己改过、1 条（620201）旧表挂的是「…市辖区」占位条）',
      '同一份旧表里还有 93 条县名没变、市名或省名却是 2015 年前的旧口径（3208 淮阴市、4206 襄樊市、65xxxx「新疆维吾尔族自治区」等），它们与 renamed 同组',
    ],
  },
  datasetVersion: '2022-10-31',
  seed: 20260925,
  today: TODAY,
  pools: {
    sameName: BOTH.length, renamed: RENAMED.length, onlyCurrent: ONLY_CURRENT.length,
    /** renamed 的成因三分：县名自己改过 / 只有旧表那一段名是旧口径 / 旧表挂的是市级占位条 */
    renamedByCounty: RENAMED_BY_COUNTY.length,
    renamedByLegacyPrefix: RENAMED.length - RENAMED_BY_COUNTY.length - RENAMED_BY_PLACEHOLDER.length,
    renamedByPlaceholder: RENAMED_BY_PLACEHOLDER.length,
  },
  groupCounts: { ...GROUPS },
  total,
  divergencePolicy: 'agree* 必须同结论；name_current_only 与 renamed 是我们更新；birth_* / feb29_nonleap 是我们更严且只由出生日期单独否决',
  cases,
};

const out = `${JSON.stringify(doc, null, 2)}\n`;
const target = resolve(ROOT, OUT);
if (AS_CHECK) {
  // 绿：一行 stdout，退 0。红：一行 **stderr**（内容与"一致"那条分得开，B14 双向都钉），
  // 退 1，且**绝不写文件**——CI 里 `--check` 的全部意义就是"发现落后但不掩盖它"。
  const cur = readFileSync(target, 'utf8');
  if (cur === out) {
    process.stdout.write(`${OUT} 与生成器一致\n`);
    process.exit(0);
  }
  process.stderr.write(`${OUT} 与生成器不一致：请跑 node scripts/build-id-fixture.mjs 重新生成\n`);
  process.exit(1);
}
writeFileSync(target, out);
process.stdout.write(`${OUT}: ${total} 条 · ${Object.entries(GROUPS).map(([k, v]) => `${k}=${v}`).join(' ')}
`);
