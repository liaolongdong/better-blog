#!/usr/bin/env node
/**
 * 把两张第三方快照压成读侧用的紧凑码表。
 *
 * 与 `build-region-data.mjs` 同一套约定：脚本只读 `scripts/fixtures/` 里哈希钉死的快照、
 * 全程不联网（离线 `--check` 也必须在 CI 里跑通），输出**字节可复现**——所有键集合先排序
 * 再去重再拼，不写时间戳（快照日期记在 SOURCES.json 与产物头注释里，不是产物里的可变值）。
 *
 * 用法：
 *   node scripts/build-prefix-data.mjs            # 生成两个产物
 *   node scripts/build-prefix-data.mjs --check    # 与磁盘比对，不等则退 1 并点名差在哪
 *
 * 两个产物为什么不是一份 JSON：读侧只想做一次 `split` 和一层循环（设计文档 §7 的
 * 体积口径按实测算，编码只占两成成本），而且 JSON 里 1,709 个引号与逗号本身就白占几 KB。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN_CSV = path.join(ROOT, 'scripts/fixtures/bankbin/bin.csv');
const NAME_CSV = path.join(ROOT, 'scripts/fixtures/bankbin/name.csv');
const CARRIER_PY = path.join(ROOT, 'scripts/fixtures/carrier/impulse.py');
const OUT_BANK = path.join(ROOT, 'dev/js/tools/bank-bin-data.js');
const OUT_CARRIER = path.join(ROOT, 'dev/js/tools/carrier-data.js');
const BIN_META = { provider: 'hexindai/bcbc', ref: 'de631827ffe8db2792d140f3476b02498fc1244f', fetchedAt: '2026-09-26', license: 'MIT' };
const CARRIER_META = { provider: 'LSG-PolarBear/impulse', ref: 'dcacca9bf28132ca6938eb2c162e9b222ae02a53', fetchedAt: '2026-09-26', license: 'Apache-2.0' };

/** 去掉 BOM、拆非空行 */
function lines(text) {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
}

/** CSV 的 `a,b,c,d` 一行四列；列数不对就停，别把残缺行咽进产物 */
function parseCsv(text, label, cols) {
  const rows = [];
  for (const [i, line] of lines(text).entries()) {
    const no = i + 1;
    if (no === 1) {
      const head = line.split(',');
      if (head.length !== cols || head.some((h) => h.trim() === '')) {
        throw new Error(`${label} 表头不是 ${cols} 列：${JSON.stringify(line)}`);
      }
      continue;
    }
    const parts = line.split(',');
    if (parts.length !== cols || parts.some((p) => p.trim() === '')) {
      throw new Error(`${label} 第 ${no} 行解析不出 ${cols} 列：${JSON.stringify(line.slice(0, 40))}`);
    }
    rows.push(parts.map((p) => p.trim()));
  }
  return rows;
}

/** OPERATORS 字典：Python 源里的一段，按形状抠出来；抠不到就是快照变了形状，必须停 */
function parseOperators(text) {
  const m = /OPERATORS\s*=\s*\{([\s\S]*?)\n\}/.exec(text);
  if (!m) throw new Error('impulse.py 里找不到 OPERATORS = { ... } 这一块，快照形状与生成器假设不一致');
  const out = new Map();
  for (const line of m[1].split('\n')) {
    const e = /^\s*"([^"]+)"\s*:\s*\[([^\]]*)\]/.exec(line);
    if (!e) continue;
    const segs = [...e[2].matchAll(/"(\d{3})"/g)].map((x) => x[1]);
    if (segs.length === 0) throw new Error(`号段 ${e[1]} 一个都没抠出来，宁可不写产物`);
    out.set(e[1], segs);
  }
  if (out.size === 0) throw new Error('OPERATORS 抠出来是空的');
  return out;
}

function buildBank() {
  const names = new Map(parseCsv(fs.readFileSync(NAME_CSV, 'utf8'), 'name.csv', 2));
  const rows = parseCsv(fs.readFileSync(BIN_CSV, 'utf8'), 'bin.csv', 4);
  const banks = [...new Set(rows.map((r) => r[1]))].sort();
  const idx = new Map(banks.map((code, i) => [code, i]));
  const packed = [];
  const bins = new Map();
  for (const [bin, bank, type, length] of rows) {
    if (!/^\d{3,10}$/.test(bin)) throw new Error(`BIN ${bin} 不是 3–10 位数字`);
    if (!/^\d{2}$/.test(length)) throw new Error(`BIN ${bin} 的卡号长度 ${length} 不是两位数字`);
    if (!/^[A-Z]{2,3}$/.test(type)) throw new Error(`BIN ${bin} 的卡种类 ${type} 形状不认识`);
    if (!idx.has(bank)) throw new Error(`BIN ${bin} 的行别码 ${bank} 不在 name.csv 里`);
    packed.push(`${bin} ${idx.get(bank)} ${type} ${length}`);
    bins.set(bin, (bins.get(bin) ?? 0) + 1);
  }
  // 快照里同一个 BIN 可以有多条登记（实测 12 个 BIN 共 24 行，例如 `621260` 同时挂着
  // SPABANK 贷记 16 位与 CSRCB 借记 19 位）——上游本来就有冲突，读侧不能假装没有。
  // 排序把"取哪一条"变成字典序的确定性结果，同时**一条都不丢**，让面板把并列的候选都列出来。
  packed.sort();
  const dup = [...bins.entries()].filter(([, n]) => n > 1);
  return { banks, packed, names, distinct: bins.size, dup };
}

function renderBank(b) {
  const bankLines = b.banks.map((c) => `  ['${c}', '${b.names.get(c) ?? ''}'],`).join('\n');
  const rowsText = b.packed.join(';');
  return `/**
 * 生成物，别手改：\`node scripts/build-prefix-data.mjs\` 重跑即覆盖。
 * 来源 ${BIN_META.provider} @ ${BIN_META.ref}（快照 ${BIN_META.fetchedAt}，许可 ${BIN_META.license}）。
 * 机器可读清单见 \`scripts/fixtures/bankbin/SOURCES.json\`；许可与归属的说明文字在
 * \`assets/data/LICENSES.md\`。
 *
 * \`BIN_ROWS\` 一格一条：\`BIN 行别码下标 卡种类 该 BIN 登记的卡号长度\`，字段间空格、条目间分号，
 * 整串按条目文本排序后写入（同一个 BIN 允许有多条登记，快照实测 12 个 BIN 共 24 行，
 * 排序把"取哪一条"变成确定性的字典序结果，且一条都不丢）。
 * 不用 JSON 而用这张串，是为了读侧只做一层 \`split\` 和一层循环（设计文档 §7 的体积口径）。
 */
export const BIN_META = ${JSON.stringify({ ...BIN_META, rows: b.packed.length, distinctBins: b.distinct, ambiguousBins: b.dup.length })};

/** 行别码 → 中文名；快照 name.csv 有 275 个码，BIN 表实际只用到 260 个，这里只收用到的 */
export const BANKS = [
${bankLines}
];
export const BIN_ROWS = '${rowsText}';
`;
}

function renderCarrier(entries) {
  const segLines = [...entries].sort().map(([carrier, segs]) =>
    `  ['${carrier}', '${segs.join(' ')}'],`).join('\n');
  return `/**
 * 生成物，别手改：\`node scripts/build-prefix-data.mjs\` 重跑即覆盖。
 * 来源 ${CARRIER_META.provider} @ ${CARRIER_META.ref}（快照 ${CARRIER_META.fetchedAt}，
 * 许可 ${CARRIER_META.license}）。机器可读清单见 \`scripts/fixtures/carrier/SOURCES.json\`。
 *
 * **它是单一来源**：工信部编号计划原文与第二份可交叉核对的公开整理稿都没能取到，
 * 缺口与后果记在 \`SOURCES.json\` 的 \`knownGap\` 与 \`phone.js\` 的 \`CARRIER_NOTE\` 里；
 * 判据 §F 因此只断自洽（不重叠、形状、生成侧与校验侧同结论），不断外部正确性。
 */
export const CARRIER_META = ${JSON.stringify(CARRIER_META)};
/** 运营商 → 三位号段清单（空格分隔），按运营商名排序 */
export const CARRIER_SEGMENTS = [
${segLines}
];
`;
}

function main() {
  const check = process.argv.includes('--check');
  const b = buildBank();
  const ops = parseOperators(fs.readFileSync(CARRIER_PY, 'utf8'));
  const bankText = renderBank(b);
  const carrierText = renderCarrier(ops);
  if (check) {
    let bad = 0;
    for (const [file, text] of [[OUT_BANK, bankText], [OUT_CARRIER, carrierText]]) {
      const disk = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      if (disk === text) { console.log(`✓ ${path.relative(ROOT, file)}`); continue; }
      bad = 1;
      console.log(`✗ ${path.relative(ROOT, file)} 与生成结果不一致`
        + `（磁盘 ${disk === null ? '不存在' : `${disk.length}B`} vs 生成 ${text.length}B）`);
    }
    process.exit(bad);
  }
  fs.writeFileSync(OUT_BANK, bankText);
  fs.writeFileSync(OUT_CARRIER, carrierText);
  const segTotal = [...ops.values()].reduce((n, v) => n + v.length, 0);
  console.log(`bank-bin-data.js：${b.packed.length} 条 BIN 登记 / ${b.distinct} 个不同 BIN`
    + `（其中 ${b.dup.length} 个 BIN 有多条并列登记）/ ${b.banks.length} 个行别码`);
  console.log(`carrier-data.js：${ops.size} 家运营商 / ${segTotal} 个三位号段`);

}

main();
