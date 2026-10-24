#!/usr/bin/env node
/**
 * 版本台账门禁：`package.json` / `_config.yml` 的 `site.version` / `CHANGELOG.md` 顶条三处必须一致。
 *
 * 为什么这一条必须存在：2026-10-21 收口时实测，master 已经是 2.1.0 而远端 tag 只到 2.0.1——
 * USAGE.md「版本号与 tag」那一节写明「版本号只有一个真实来源：master 上的 git tag」，但没有任何
 * 机器判据守着，于是「三处都改了、tag 忘了」这件事没有症状：页脚显示 v2.1.0、更新日志页第一个
 * 卡片是 2.1.0，只有拿 tag 算增量的人对不上。这一本把三处一致钉死；tag 那一档单独放在
 * `--require-tag` 里，因为它只在发版收口那一刻该被要求（在 feature 分支上要求 tag 存在等于把
 * 尚未发生的发版当成缺陷）。
 *
 * 用法：
 *   node scripts/check-release.mjs                      # 查三处一致（CI 档）
 *   node scripts/check-release.mjs --require-tag        # 发版收口：再加一条「最新 tag == 三处版本」
 *   node scripts/check-release.mjs --list               # 只打印要核对的组
 *   牙齿用这几个覆盖口，不动跟踪文件：
 *   ... --package=<副本> --config=<副本> --changelog=<副本> --tags-file=<换行分隔的 tag 清单>
 *
 * 失败形状：每条 `[组名] 条目：说明`，末尾给总数。通过形状：`✓ 版本台账 N 组判据全绿`。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const REQUIRE_TAG = argv.includes('--require-tag');
const FILES = {
  pkg: path.resolve(ROOT, opt('package', 'package.json')),
  cfg: path.resolve(ROOT, opt('config', '_config.yml')),
  log: path.resolve(ROOT, opt('changelog', 'CHANGELOG.md')),
};
const GROUPS = ['V1 三处一致', 'V2 版本形状', 'V3 顶条即最新', ...(REQUIRE_TAG ? ['T1 tag 收口'] : ['T1 tag 收口（未启用：加 --require-tag）'])];
if (argv.includes('--list')) { console.log('将核对：\n  ' + GROUPS.join('\n  ')); process.exit(0); }

const fails = [];
const bad = (group, entry, msg) => fails.push(`[${group}] ${entry}：${msg}`);
const read = (f) => { if (!fs.existsSync(f)) throw new Error(`没有 ${path.relative(ROOT, f)}`); return fs.readFileSync(f, 'utf8'); };

let pkgV = null; let cfgV = null; let topV = null; let allV = [];
try {
  pkgV = String(JSON.parse(read(FILES.pkg)).version || '').trim() || null;
  const cfg = read(FILES.cfg);
  // site.version 写在顶层 `version:`（不是 jekyll 的其它 version），取第一条即可；引号可有可无。
  const m = /\n\s*version:\s*["']?([\d][\d.]*)["']?/.exec(cfg);
  cfgV = m ? m[1] : null;
  const log = read(FILES.log);
  allV = [...log.matchAll(/^##\s+\[?v?(\d+\.\d+\.\d+)/gm)].map((x) => x[1]);
  topV = allV[0] || null;
} catch (e) { console.log(`✗ 版本台账跑不动：${e.message}`); process.exit(2); }

// V1 三处一致
if (!pkgV) bad('V1 三处一致', 'package.json', '读不到 version');
if (!cfgV) bad('V1 三处一致', '_config.yml', '读不到 site.version（页脚那枚会整块消失）');
if (!topV) bad('V1 三处一致', 'CHANGELOG.md', '顶部没有 `## [v]X.Y.Z` 形式的版本条目');
if (pkgV && cfgV && pkgV !== cfgV) bad('V1 三处一致', 'package.json vs _config.yml', `${pkgV} ≠ ${cfgV}——页脚与包体对不上`);
if (pkgV && topV && pkgV !== topV) bad('V1 三处一致', 'package.json vs CHANGELOG 顶条', `${pkgV} ≠ ${topV}——最新一版没有更新日志，或日志领先于版本`);

// V2 形状：X.Y.Z 三段数字（本仓库不发两位或四位）
const shape = /^\d+\.\d+\.\d+$/;
for (const [label, v] of [['package.json', pkgV], ['_config.yml', cfgV], ['CHANGELOG 顶条', topV]]) {
  if (v && !shape.test(v)) bad('V2 版本形状', label, `「${v}」不是 X.Y.Z`);
}

// V3 顶条即最新：CHANGELOG 的条目顺序必须按版本递减（写在下方的必须是更早的版本）。
// 只比 [major, minor, patch] 三段数值，不做语义化判断。
const num = (v) => v.split('.').map(Number);
const older = (a, b) => { const [x, y] = [num(a), num(b)]; for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] < y[i]; } return false; };
for (let i = 1; i < allV.length; i++) {
  if (!older(allV[i], allV[i - 1])) bad('V3 顶条即最新', `第 ${i + 1} 条 ${allV[i]}`, `不比你上一条 ${allV[i - 1]} 旧——条目顺序错了，页面第一个卡片就不是最新版`);
}

// T1 tag 收口（只在 --require-tag 时判）
if (REQUIRE_TAG) {
  /**
   * 读数口径：tag 允许 `v` 前缀（`v2.0.2` 与 `2.0.2` 同义），排序只认数值段。
   * 不信 `git tag --sort=-v:refname`：它按 ASCII 排，字母 `v` 排在数字前面，于是一枚
   * `v2.0.2` 会被抬到已发布的 `2.1.0` 之上；而 `num('v2.0.2')` 的首段是 NaN，
   * 远端那条路的比较器同样会静默乱序。两种读数都在这一步归一，非版本号形状的 tag 直接丢。
   */
  const verOf = (t) => String(t).replace(/^v/i, '').trim();
  const byVersionDesc = (list) => [...new Set(list.map(verOf).filter((t) => /^\d+(\.\d+)*$/.test(t)))]
    .sort((a, b) => { const [x, y] = [num(a), num(b)]; for (let i = 0; i < 3; i += 1) { if (x[i] !== y[i]) return y[i] - x[i]; } return 0; });
  const listFile = opt('tags-file', '');
  let tags = [];
  let source = 'git tag（本地）';
  try {
    if (listFile) { tags = byVersionDesc(fs.readFileSync(path.resolve(ROOT, listFile), 'utf8').split(/\r?\n/).filter(Boolean)); source = `清单 ${listFile}`; }
    else {
      // 先看远端：这一档要防的正是「tag 只打在本地、没推」——本地有 tag 而 origin 没有，
      // 对拿 tag 算增量的人来说等于没有。取不到远端（离线、没有 origin）就退回本地，但必须说明这是弱读数。
      try {
        tags = byVersionDesc(execFileSync('git', ['ls-remote', '--tags', 'origin'], { cwd: ROOT, encoding: 'utf8', timeout: 15000 })
          .split(/\r?\n/).map((l) => (l.split('\t')[1] || '').replace(/^refs\/tags\//, '').replace(/\^\{\}$/, ''))
          .filter(Boolean));
        source = 'git ls-remote --tags origin';
      } catch (e2) {
        tags = byVersionDesc(execFileSync('git', ['tag'], { cwd: ROOT, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean));
        console.log(`· 取不到 origin 的 tag（${String(e2.message).split('\n')[0].slice(0, 60)}），退回本地读数——本地有 tag 不等于已推出去，收口时记得自己核对 ls-remote`);
      }
    }
  } catch (e) { console.log(`✗ 版本台账跑不动：读 tag 失败（${e.message}）`); process.exit(2); }
  const latest = tags[0] || '';
  if (!tags.length) bad('T1 tag 收口', source, '一个 tag 都没有——「版本号只有一个真实来源」这条此刻没有来源');
  else if (pkgV && latest !== pkgV) bad('T1 tag 收口', `最新版本 vs ${source}`, `${source.split('（')[0]} 停在 ${latest} 而包体是 ${pkgV}——这一版还没收口：打附注 tag 并推送，或说明它尚未发布`);
}

if (fails.length) {
  console.log(`✗ 版本台账 ${fails.length} 条不成立：`);
  fails.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log(`✓ 版本台账 ${REQUIRE_TAG ? 4 : 3} 组判据全绿${REQUIRE_TAG ? '（含 tag 收口）' : '（tag 档未启用）'}`);
