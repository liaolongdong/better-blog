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
 * 用法：
 *   node scripts/build-region-data.mjs            # 生成 / 覆盖
 *   node scripts/build-region-data.mjs --check    # 只比对，不一致退出码 1（测试用例 A4 用这条）
 *   node scripts/build-region-data.mjs --fetch    # 先刷新三份 modood 快照（需联网），再生成
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
const ARGV = process.argv.slice(2);
const AS_CHECK = ARGV.includes('--check');
const AS_FETCH = ARGV.includes('--fetch');

const REMOTE = [
  ['provinces', 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/6fb5380de7e6c961869dcd1629df4adc088fa9bb/dist/provinces.json'],
  ['cities', 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/6fb5380de7e6c961869dcd1629df4adc088fa9bb/dist/cities.json'],
  ['areas', 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/6fb5380de7e6c961869dcd1629df4adc088fa9bb/dist/areas.json'],
];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const readRaw = (file) => readFileSync(resolve(FIXDIR, file));
const readJson = (file) => JSON.parse(readRaw(file.endsWith('.json') ? file : `${file}.json`).toString('utf8'));

/** 快照与 SOURCES.json 不符就拒绝出货 */
function verifyManifest(manifest) {
  const list = manifest.files.map((f) => [f.file, f.sha256])
    .concat([[manifest.historical.file, manifest.historical.sha256]]);
  for (const [file, want] of list) {
    const got = sha256(readRaw(file));
    if (got !== want) {
      throw new Error(`快照哈希不符：${file}\n  期望 ${want}\n  实际 ${got}\n`
        + '若确需换数据：node scripts/build-region-data.mjs --fetch，并同步 SOURCES.json 与设计文档 §2.2 的条数');
    }
  }
}

/** 名称里出现分隔符会让整张表错位解析，必须在生成时挡住 */
function assertNoDelimiters(pairs) {
  const bad = pairs.filter(([, name]) => /[|,\s，、；：]/.test(String(name)));
  if (bad.length) {
    throw new Error(`名称含分隔符，编码格式会崩：${bad.slice(0, 5).map(([c, n]) => `${c}:${n}`).join('  ')}`);
  }
}

function assertShape(rows, len, label, parentField) {
  for (const row of rows) {
    const code = String(row.code);
    if (!new RegExp(`^\\d{${len}}$`).test(code)) throw new Error(`${label} 码形不对：${code}`);
    if (parentField && !code.startsWith(String(row[parentField]))) {
      throw new Error(`${label} ${code} 不以父级码 ${row[parentField]} 开头，分组编码会解错`);
    }
  }
  const codes = rows.map((r) => r.code);
  if (new Set(codes).size !== codes.length) throw new Error(`${label} 存在重复码`);
}

function build(manifest) {
  const provinces = readJson('provinces');
  const cities = readJson('cities');
  const areas = readJson('areas');
  const legacy = readJson('gb2260-2015.json');

  assertNoDelimiters(
    [...provinces, ...cities, ...areas].map((x) => [x.code, x.name])
      .concat(Object.entries(legacy)),
  );
  assertShape(provinces, 2, '省级');
  assertShape(cities, 4, '市级', 'provinceCode');
  assertShape(areas, 6, '县级', 'cityCode');

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
    sha256: Object.fromEntries(
      manifest.files.map((f) => [f.file, f.sha256]).concat([[manifest.historical.file, manifest.historical.sha256]]),
    ),
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

if (AS_FETCH) {
  for (const [name, url] of REMOTE) {
    const file = resolve(FIXDIR, `${name}.json`);
    const before = readFileSync(file);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`抓取失败 ${name}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    process.stdout.write(`${name}: ${before.length}B → ${buf.length}B ${sha256(buf).slice(0, 12)}\n`);
    if (!buf.equals(before)) {
      writeFileSync(file, buf);
      process.stdout.write('  已更新，记得同步 SOURCES.json 与设计文档 §2.2 的条数\n');
    }
  }
}

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
