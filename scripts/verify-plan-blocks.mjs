#!/usr/bin/env node
/**
 * 第一段的内嵌代码自证器：计划里贴的那几块整文件代码，必须与磁盘**逐字节全等**。
 *
 * 为什么要有这个脚本：`_docs/superpowers/plans/2026-09-25-online-tools-foundation.md`
 * 把 `region.js` / `idcard.js` / `uscc.js` 等模块的全文当作规格写在了任务正文里。
 * 代码落地后计划就成了"第二份代码"——只要有一次整改改了磁盘没改计划，读计划的人
 * 就会照一份不存在的实现去改。历轮复核反复在算这个账，但复算用的脚本一直躺在
 * `/tmp/verify-blocks.mjs`，那是**复现不了的实证**（换台机器、换个会话就没了），
 * 所以把它收进仓库，成为第一段收口门禁里可重跑的一条。
 *
 * 用法：
 *   node scripts/verify-plan-blocks.mjs          # 全等则逐条打印 OK，退 0
 *   node scripts/verify-plan-blocks.mjs --list   # 只打印将要核对的目标清单
 *   node scripts/verify-plan-blocks.mjs --fix    # 把不等的那些镜像块整块换成磁盘内容，
 *                                                #   只碰唯一候选块，其余一律不动；换完再跑一次
 *
 * 失败形状（都退 1，不静默）：
 *   - 某个磁盘文件在计划里找不到逐字节相同的块 → `✗` 并打印首个不同的行
 *   - 同一个目标匹配到两块 → `✗ 歧义`（宁可报错也不猜）
 *   - 磁盘 `scripts/toolkit-tests.mjs` 里某一节（§A／§B／§C…）找不到全等块 → `✗`
 *
 * 另一种**不算失败但要刺眼**的形状：计划正文里带着下一节的整块代码（规格先于实现），
 * 打印成 `⚠ 未落地`。第一段收口时这一行的条数必须是 0，收口门禁里也照着 0 来判。
 *
 * 分节为什么按标记而不是行号：测试文件是一块一块往末尾追加的，任何一次追加都会让
 * "第 2417–3237 行"这种区间作废。标记行（`// ── §B 身份证 …`）是这份文件自己的
 * 结构，按它切分才跟着文件一起长。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAN = '_docs/superpowers/plans/2026-09-25-online-tools-foundation.md';

/** 整文件镜像：计划里应当存在与这些文件逐字节相同的一个 ```js 块 */
const FILE_TARGETS = [
  'scripts/build-region-data.mjs',
  'dev/js/tools/region.js',
  'scripts/build-id-fixture.mjs',
  'dev/js/tools/random.js',
  'dev/js/tools/idcard.js',
  'dev/js/tools/uscc.js',
];

/** 分段镜像：`scripts/toolkit-tests.mjs` 按 §B/§C/… 标记切段，每段各有一个块 */
const SEGMENTED = 'scripts/toolkit-tests.mjs';

/**
 * 分节标记的正则。**段 1 里落地的判据以 `// ── §X` 起头**；§A 那一段里没有这个
 * 结构（它是测试骨架的开头 + 两条 §A 子标记），所以 §A 一律取"第一条 §B 标记之前"。
 */
const SEG_MARK = /^\/\/ ── §([B-Z]) /;

/** 去掉尾部连续空行：块与文件在"末尾留几个空行"上不该算差异，中间的差异一概不作放宽 */
const norm = (text) => text.replace(/\n+$/, '');

/**
 * 扫出计划里所有围栏代码块。
 * @returns {Array<{lang:string, startLine:number, endLine:number, text:string}>}
 *   `startLine` 是围栏后第一行的 1-based 行号，`endLine` 是闭围栏前一行的行号
 */
function fencedBlocks(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const open = /^```([a-zA-Z0-9]*)\s*$/.exec(lines[i]);
    if (!open) continue;
    const start = i + 1;
    let j = start;
    while (j < lines.length && !/^```\s*$/.test(lines[j])) j += 1;
    if (j >= lines.length) continue; // 未闭合：交给 Edit/Write 时再暴露
    out.push({ lang: open[1], startLine: start + 1, endLine: j, text: lines.slice(start, j).join('\n') });
    i = j;
  }
  return out;
}

/** 找出与 `want` 逐字节相同的块；返回全部命中，让调用方去判"零命中"还是"多命中" */
function matchBlocks(blocks, want) {
  return blocks.filter((b) => norm(b.text) === want);
}

/**
 * 磁盘内容与计划里全部 js 块的比对结果，`--fix` 和失败信息共用这一份判定
 * （分两处写"哪一块是它的镜像"，两处迟早会各认一个）。
 *
 * @returns {{wantLines:string[], hit:Array, cand:{p:number,b:object}|null, byLen:{d:number,b:object}}}
 *   `hit` 逐字节全等的块；`cand` 是**唯一**的最长公共前缀块（并列即 null，绝不猜）；
 *   `byLen` 只服务失败信息里那句"行数最接近"，不参与定位
 */
function pickMirror(blocks, want) {
  const wantLines = norm(want).split('\n');
  const hit = matchBlocks(blocks, want);
  const prefixLen = (b) => {
    const P = norm(b.text).split('\n');
    let k = 0;
    while (k < P.length && k < wantLines.length && P[k] === wantLines[k]) k += 1;
    return k;
  };
  let best = null;
  let tie = 0;
  for (const b of blocks) {
    const p = prefixLen(b);
    if (!best || p > best.p) { best = { p, b }; tie = 1; }
    else if (p === best.p) tie += 1;
  }
  let byLen = null;
  for (const b of blocks) {
    const d = Math.abs(norm(b.text).split('\n').length - wantLines.length);
    if (!byLen || d < byLen.d) byLen = { d, b };
  }
  return { wantLines, hit, cand: hit.length === 0 && tie === 1 && best.p > 0 ? best : null, byLen };
}

/** 打印两个等长文本的首个差异，供失败时直接定位 */
function firstDiff(a, b) {
  const A = a.split('\n');
  const B = b.split('\n');
  for (let k = 0; k < Math.max(A.length, B.length); k += 1) {
    if (A[k] !== B[k]) return { line: k + 1, plan: A[k], disk: B[k] };
  }
  return null;
}

function main() {
  const planText = fs.readFileSync(path.join(ROOT, PLAN), 'utf8');
  const planLines = planText.split('\n');
  const blocks = fencedBlocks(planLines).filter((b) => b.lang === 'js');
  const listOnly = process.argv.includes('--list');
  const fix = process.argv.includes('--fix');
  const fixes = [];
  const used = new Set();
  const failures = [];

  const report = (kind, target, want) => {
    if (listOnly) {
      console.log(`${kind}  ${target}`);
      return;
    }
    const m = pickMirror(blocks, want);
    if (m.hit.length === 0) {
      // "找不到全等块"必须顺带说清差在哪，否则下一次重跑的人只能自己重新发明定位。
      // 定位线索按**与磁盘的最长公共前缀**来找，不按行数最接近来找：实测磁盘 `uscc.js`
      // 365 行时，按行数最接近的块是 389 行的 `region.js` 那块（差 24 行），报出来会把人
      // 支到一个完全不同的文件上。公共前缀并列最长时退回"无法唯一定位"——宁可少说，
      // 也不给一条误导的坐标，`--fix` 同样只在候选唯一时才动手。
      if (m.cand) {
        const cand = m.cand.b;
        const diff = firstDiff(norm(cand.text), want);
        console.log(`✗ ${target}：疑为它的镜像在计划 ${cand.startLine}–${cand.endLine}`
          + `（${norm(cand.text).split('\n').length} 行）↔ 磁盘 ${m.wantLines.length} 行，`
          + `前 ${m.cand.p} 行相同，此后不再逐字节全等`);
        if (diff) {
          console.log(`   首个不同：计划第 ${cand.startLine + diff.line - 1} 行 / 磁盘第 ${diff.line} 行`
            + `\n   计划 ${JSON.stringify(diff.plan)}\n   磁盘 ${JSON.stringify(diff.disk)}`);
        }
        if (fix) fixes.push({ target, block: cand, lines: m.wantLines, same: m.cand.p });
      } else {
        console.log(`✗ ${target}：计划里没有逐字节相同的块（按行数最接近的是计划 ${m.byLen.b.startLine}–`
          + `${m.byLen.b.endLine}，差 ${m.byLen.d} 行；公共前缀候选不唯一，无法定位，`
          + `${fix ? '--fix 不会动它' : '手工同步'}）`);
      }
      failures.push(target);
      return;
    }
    if (m.hit.length > 1) {
      console.log(`✗ ${target}：匹配到 ${m.hit.length} 个块（${m.hit.map((h) => `${h.startLine}–${h.endLine}`).join(' / ')}），拒绝猜`);
      failures.push(target);
      return;
    }
    used.add(m.hit[0]);
    console.log(`OK ${target}：计划 ${m.hit[0].startLine}–${m.hit[0].endLine}（${m.wantLines.length} 行）与磁盘逐字节全等`);
  };

  for (const rel of FILE_TARGETS) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      if (listOnly) console.log(`file ${rel}`);
      else { console.log(`✗ ${rel}：磁盘上没有这个文件`); failures.push(rel); }
      continue;
    }
    report('file', rel, norm(fs.readFileSync(abs, 'utf8')));
  }

  const segText = norm(fs.readFileSync(path.join(ROOT, SEGMENTED), 'utf8'));
  const segLines = segText.split('\n');
  const marks = segLines.map((l, i) => ({ i, m: SEG_MARK.exec(l) })).filter((x) => x.m);
  // 磁盘的分节是"已落地"的那几节；计划里可能还带着**下一节**的整块代码（Task 6 的 §D
  // 在写计划时就已经贴在正文里了）。所以这里不按"两边条数相等"判失败——那会把
  // "规格先于实现"这个正常形状误判成缺陷——而是：磁盘有的每一节必须能在全等块里找到，
  // 计划里多出来的那一节单独列成 `⚠ 未落地`，收口时这一行的条数必须是 0。
  const bounds = [0, ...marks.map((x) => x.i), segLines.length];
  const onDisk = new Set();
  for (let s = 0; s < bounds.length - 1; s += 1) {
    const from = bounds[s];
    const to = bounds[s + 1];
    const segName = s === 0 ? 'A' : segLines[from].match(SEG_MARK)[1];
    onDisk.add(segName);
    // 段与段之间隔着磁盘上的那个空行：§A 这一段切出来**末尾带一个空元素**，而计划里那个
    // 块是"围栏前最后一行代码 + 结尾换行"。两边都按 `norm` 收掉尾部空行再比，
    // 否则尾部差一个空行就判不一致——那不是差异，是切分方式的产物。
    const want = norm(segLines.slice(from, to).join('\n'));
    report('seg', `${SEGMENTED} §${segName}（磁盘 ${from + 1}–${to}）`, want);
  }

  if (listOnly) return 0;
  const mirrorBytes = [...used].reduce((n, b) => n + b.text.length, 0);
  console.log(`计划共 ${blocks.length} 个 js 块，其中 ${used.size} 个是已落地镜像（合计 ${mirrorBytes}B），其余是任务正文里的片段/示例`);
  // 计划里成节的、磁盘上还没有的 §X 块：按块首条 § 标记认。
  // 只认**磁盘上还没有那一节**的：同一节的计划块与磁盘块不等时，上面已经出过 `✗`，
  // 这里再报一句"磁盘还没有这一节"就是假话——实测整改 `22d7147` 之后，§C 在磁盘有
  // 452 行、计划块只有 229 行，`used` 收不到那块，于是同一件事被报成"不等" + "未落地"
  // 两种形状，而后一种会把人支去写一份已经存在的判据。
  const pending = [];
  for (const b of blocks) {
    if (used.has(b)) continue;
    const first = b.text.split('\n').find((l) => SEG_MARK.test(l));
    if (!first) continue;
    const letter = first.match(SEG_MARK)[1];
    if (onDisk.has(letter)) continue;
    pending.push(`${letter}（计划 ${b.startLine}–${b.endLine}）`);
  }
  for (const p of pending) console.log(`⚠ 未落地：计划里有 §${p} 整块代码，磁盘 ${SEGMENTED} 还没有这一节`);
  // `--fix`：把"磁盘已经变了、计划还写着旧的一份"这几块整块换成磁盘内容。
  // 只换 `pickMirror` 唯一认出的那一块，其余（并列候选、§D 那种还没落地的整节、
  // 任务正文里的片段）**一行都不碰**——这是"计划跟着实现走"的一条口径，不是通用
  // 同步器：它绝不往计划里塞新块，也不删块。按 `startLine` 从大到小改写，
  // 这样每一刀的坐标都还是原始 `planLines` 的坐标（从小到大就会互相顶掉行号）。
  if (fix) {
    if (fixes.length === 0) {
      console.log('--fix：没有可同步的镜像块（要么已全等，要么候选不唯一、需要人工定位）');
    } else {
      let out = planLines;
      for (const f of [...fixes].sort((a, b) => b.block.startLine - a.block.startLine)) {
        out = [...out.slice(0, f.block.startLine - 1), ...f.lines, ...out.slice(f.block.endLine)];
      }
      for (const f of [...fixes].sort((a, b) => a.block.startLine - b.block.startLine)) {
        console.log(`→ 已同步 ${f.target}：计划 ${f.block.startLine}–${f.block.endLine}`
          + `（${norm(f.block.text).split('\n').length} 行）← 磁盘 ${f.lines.length} 行`);
      }
      fs.writeFileSync(path.join(ROOT, PLAN), out.join('\n'));
      console.log(`--fix：重写 ${fixes.length} 块，计划 ${planLines.length} → ${out.length} 行；`
        + '再跑一次本脚本确认（重写只按磁盘内容整块替换，正文其余部分未触碰）');
    }
  }
  if (failures.length > 0) {
    console.log(`✗ ${failures.length} 个目标对不上：${failures.join(' / ')}`);
    return 1;
  }
  console.log(`✓ 全部已落地镜像与磁盘逐字节全等（未落地 ${pending.length} 节）`);
  return 0;
}

process.exit(main());
