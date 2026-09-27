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
 * 镜像现在分布在**两份计划**里（段 1 那份 + 段 2 `2026-09-26-tools-idcard-page.md`）：
 * 磁盘上 `toolkit-tests.mjs` 的 §E0/§F0 两块代码是段 2 计划贴的，段 1 计划里根本没有。
 * 只认一份计划的旧实现在这儿会产出**两种**错形状——§D 那一节因为下一节没被认成分节而被
 * 一路吞到文件尾（假"逐字节不等"），§E0/§F0 则压根没人核（假"全等"）。所以块按
 * `{plan, tag, startLine, endLine}` 带着出处走，报错与 `--fix` 都点名是哪份计划，
 * 跨计划命中同一块仍按"歧义"拒绝猜。
 *
 * 失败形状（都退 1，不静默）：
 *   - 某个磁盘文件在两份计划里都找不到逐字节相同的块 → `✗` 并打印首个不同的行
 *   - 同一个目标匹配到两块 → `✗ 歧义`（宁可报错也不猜）
 *   - 磁盘 `scripts/toolkit-tests.mjs` 里某一节（§A／§B／…／§E0）找不到全等块 → `✗`
 *
 * 另一种**不算失败但要刺眼**的形状：计划正文里带着下一节的整块代码（规格先于实现），
 * 打印成 `⚠ 未落地`。段 1 收口时这一行的条数必须是 0；段 2 在写计划时就把 §E–§J 整块
 * 贴好了，所以本轮**开工时它是 6（E/F/G/H/I/J），每落地一节少一条**，Task 11 收口必须
 * 回到 0。数字本身不是判据，"跟着已落地节数走"才是。
 *
 * 分节为什么按标记而不是行号：测试文件是一块一块往末尾追加的，任何一次追加都会让
 * "第 2417–3237 行"这种区间作废。标记行（`// ── §B 身份证 …`）是这份文件自己的
 * 结构，按它切分才跟着文件一起长。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 两份计划：段 1 那份是 §A–§D 与七个整文件的镜像所在地，段 2 那份从 §E0 起接手。
 * 顺序即查找顺序，但**判定是全局的**——同一块内容若在两份计划里都能全等命中，照旧按
 * `✗ 歧义` 拒绝猜，不因为"先命中的那份赢了"而静默挑一个。
 */
const PLANS = [
  { rel: '_docs/superpowers/plans/2026-09-25-online-tools-foundation.md', tag: '段1' },
  { rel: '_docs/superpowers/plans/2026-09-26-tools-idcard-page.md', tag: '段2' },
];

/**
 * 整文件镜像：计划里应当存在与这些文件逐字节相同的一个 ```js 块。
 *
 * 这份清单**自己会烂**：段 2 的 `build-prefix-data.mjs` 全文就贴在计划里，可它一直没被
 * 声明，于是"计划与磁盘是否一致"这件事对它是静默不核的（2026-09-27 复核发现）。所以
 * `main()` 末尾加了一道反查：任何计划 js 块若与磁盘上某个 `.js`/`.mjs` **整文件**逐字节
 * 全等、却不在本清单里，就判 `✗ 漏网镜像` 并退 1。清单漏一项从此会自己喊出来。
 */
const FILE_TARGETS = [
  'scripts/build-region-data.mjs',
  'scripts/build-prefix-data.mjs',
  'dev/js/tools/region.js',
  'scripts/build-id-fixture.mjs',
  'dev/js/tools/random.js',
  'dev/js/tools/idcard.js',
  'dev/js/tools/uscc.js',
  'dev/js/tools/panel.js',
  'dev/js/tools/bankcard.js',
  'dev/js/tools/phone.js',
  'dev/js/tools/random-data.js',
  'dev/js/tools/view.js',
  'dev/js/tools/panel-dom.js',
  'dev/js/toolkitCore.js',
  'dev/js/tools/workbench.js',
  'dev/js/toolIdcard.js',
];

/** 反查要扫的目录：镜像只可能出现在这些地方 */
const MIRROR_SCAN_DIRS = ['dev/js/tools', 'dev/js', 'scripts'];

/** 分段镜像：`scripts/toolkit-tests.mjs` 按 §B/§C/… 标记切段，每段各有一个块 */
const SEGMENTED = 'scripts/toolkit-tests.mjs';

/**
 * 分节标记的正则。**段 1 里落地的判据以 `// ── §X` 起头**；§A 那一段里没有这个
 * 结构（它是测试骨架的开头 + 两条 §A 子标记），所以 §A 一律取"第一条 §B 标记之前"。
 *
 * `[B-Z]\d*` 那个 `\d*` 是段 2 加上的（2026-09-27）：段 2 的判据文件里 §E0/§F0 是
 * "数据形状"那两节，§E/§F 留给 Task 2/3 的模块判据，两者必须能分开认。旧的
 * `§([B-Z]) ` 不认 §E0，于是 §E0 整节被吞进 §D 的尾巴（假"逐字节不等"），而 §E0/§F0
 * 自己压根没人核（假"全等"）——两种错形状同时发生，且都朝"看起来没事"的方向偏。
 */
const SEG_MARK = /^\/\/ ── §([B-Z]\d*) /;

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
 * 把 js 块按分节标记再切一刀，给"分段镜像"用。
 *
 * 段 2 的计划把 §E0 与 §F0 两节贴在**同一个** ```js 块里（写的时候它们是一次追加），
 * 而磁盘上它们是两节。整块比对永远全等不了，切一刀才对得上。标记之前的那些行
 * （比如 Step 7 那种只贴一句 `await import` 的小块）不属于任何一节，丢掉。
 *
 * **一条标记都没有的块整块留着**：磁盘上的 §A 那一节（第 1–860 行）在计划里就是这样一个
 * 块——它只有 `§A` 这种被正则排除的子标记，没有 §B+。把它丢了的话 §A 直接查无镜像，
 * 而 §A 恰恰是这文件里最长的一节骨架。
 *
 * @param {Array<{tag:string, rel:string, startLine:number, endLine:number, text:string}>} blocks
 *   带出处的 js 块（`fencedBlocks` 的输出再过一道 `plan`/`rel` 标注）
 * @returns {Array<{tag:string, rel:string, startLine:number, endLine:number, text:string}>}
 */
function splitAtMarks(blocks) {
  const out = [];
  for (const b of blocks) {
    const lines = b.text.split('\n');
    const starts = [];
    for (let k = 0; k < lines.length; k += 1) if (SEG_MARK.test(lines[k])) starts.push(k);
    if (starts.length === 0) {
      out.push(b);
      continue;
    }
    for (let s = 0; s < starts.length; s += 1) {
      const from = starts[s];
      const to = s + 1 < starts.length ? starts[s + 1] : lines.length;
      out.push({
        tag: b.tag,
        rel: b.rel,
        startLine: b.startLine + from,
        endLine: b.startLine + to - 1,
        text: lines.slice(from, to).join('\n'),
      });
    }
  }
  return out;
}

/**
 * 磁盘内容与计划里全部 js 块的比对结果，`--fix` 和失败信息共用这一份判定
 * （分两处写"哪一块是它的镜像"，两处迟早会各认一个）。
 *
 * @returns {{wantLines:string[], hit:Array, cand:{p:number,b:object,planLines:number,boundary:boolean}|null, byLen:{d:number,b:object}|null}}
 *   `hit` 逐字节全等的块；`cand` 是**唯一**的最长公共前缀块（并列即 null，绝不猜）；
 *   `byLen` 只服务失败信息里那句"行数最接近"，不参与定位，块池为空时为 null
 */
function pickMirror(blocks, want, letter) {
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
  if (best) {
    // `prefixHitsDiskEnd` = 公共前缀一直走到**磁盘内容**的末尾，也就是磁盘这一段是计划块的
    // 真前缀。对**分段**目标来说这绝不是"内容漂了"，而是"切分变了"：磁盘那一节被新插入的
    // 标记截短了（2026-09-27 复核在副本上实测：§C 体内插一条 `// ── §C2` 就成立这个形状），
    // 这时候 `--fix` 拿截短后的磁盘内容去整块替换计划里那 615 行规格，等于把还没写的那
    // 500 多行判据从计划里删掉——**规格先于实现**是这份计划的正常形状，删的是对的那一边。
    // 整文件目标不受这条约束：文件就是文件，磁盘比计划短是"真删了代码"，计划该跟着走。
    const planLines = norm(best.b.text).split('\n').length;
    best.planLines = planLines;
    best.prefixHitsDiskEnd = best.p >= wantLines.length;
  }
  let byLen = null;
  for (const b of blocks) {
    const d = Math.abs(norm(b.text).split('\n').length - wantLines.length);
    if (!byLen || d < byLen.d) byLen = { d, b };
  }
  let cand = hit.length === 0 && tie === 1 && best && best.p > 0 ? best : null;
  // 按节名兜底定位：最常见的一类漂移恰恰是**标记行自己漂了**（改标题文字、补空格），
  // 于是公共前缀 = 0 行，`pickMirror` 按前缀定位时这一节与其余 27 块并列 → `cand=null`，
  // 失败信息只剩"差 0 行"，`--fix` 对着一个它认得出的节空转（2026-09-27 复核实测）。
  // 分段目标自带节名，而计划里切出来的每一块都以自己的 `// ── §X` 开头，所以"谁的镜像"
  // 这件事其实一点不含糊——按节名再认一次：命中唯一就用它（仍标 `byName`，让失败信息
  // 说清是按名字定位的）；同名多块照旧不猜。
  if (!cand && hit.length === 0 && letter) {
    const named = blocks.filter((b) => { const mm = SEG_MARK.exec(b.text); return mm && mm[1] === letter; });
    if (named.length === 1) {
      const p = prefixLen(named[0]);
      cand = {
        p,
        b: named[0],
        planLines: norm(named[0].text).split('\n').length,
        prefixHitsDiskEnd: p >= wantLines.length,
        byName: true,
      };
    }
  }
  return { wantLines, hit, cand, byLen };
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
  // 两份计划各自扫一遍块，块上带 `{tag, rel}`——失败信息、`--fix` 的落笔处都要点名是哪份计划，
  // 否则"计划第 5636 行"这种坐标在两份文档面前毫无意义。
  const planData = PLANS.map((p) => {
    const abs = path.join(ROOT, p.rel);
    if (!fs.existsSync(abs)) {
      console.log(`✗ 计划缺席：${p.rel}（[${p.tag}]）读不到，镜像无从核对`);
      return null;
    }
    const lines = fs.readFileSync(abs, 'utf8').split('\n');
    const blocks = fencedBlocks(lines)
      .filter((b) => b.lang === 'js')
      .map((b) => ({ ...b, tag: p.tag, rel: p.rel }));
    return { ...p, lines, blocks };
  }).filter(Boolean);
  if (planData.length !== PLANS.length) return 1;

  const rawBlocks = planData.flatMap((p) => p.blocks);
  const segBlocks = splitAtMarks(rawBlocks);
  const listOnly = process.argv.includes('--list');
  const fix = process.argv.includes('--fix');
  const fixes = [];
  const used = new Set();
  const failures = [];

  const report = (kind, target, want, pool, letter) => {
    if (listOnly) {
      console.log(`${kind}  ${target}`);
      return;
    }
    const m = pickMirror(pool, want, letter);
    if (m.hit.length === 0) {
      // "找不到全等块"必须顺带说清差在哪，否则下一次重跑的人只能自己重新发明定位。
      // 定位线索按**与磁盘的最长公共前缀**来找，不按行数最接近来找：实测磁盘 `uscc.js`
      // 365 行时，按行数最接近的块是 389 行的 `region.js` 那块（差 24 行），报出来会把人
      // 支到一个完全不同的文件上。公共前缀并列最长时退回"无法唯一定位"——宁可少说，
      // 也不给一条误导的坐标，`--fix` 同样只在候选唯一时才动手。
      if (m.cand) {
        const cand = m.cand.b;
        const diff = firstDiff(norm(cand.text), want);
        console.log(`✗ ${target}：疑为它的镜像在计划[${cand.tag}] ${cand.startLine}–${cand.endLine}`
          + `（${norm(cand.text).split('\n').length} 行）↔ 磁盘 ${m.wantLines.length} 行，`
          + `前 ${m.cand.p} 行相同，此后不再逐字节全等`
          + `${m.cand.byName ? '（按节名定位：标记行自己漂了，公共前缀 0 行）' : ''}`);
        if (diff) {
          console.log(`   首个不同：计划[${cand.tag}] 第 ${cand.startLine + diff.line - 1} 行 / 磁盘第 ${diff.line} 行`
            + `\n   计划 ${JSON.stringify(diff.plan)}\n   磁盘 ${JSON.stringify(diff.disk)}`);
        }
        if (fix) {
          // 只有**分段**目标才拒绝这种形状：磁盘那一段是计划块的真前缀 = 那一节被新标记
          // 截短了，替换等于删规格。整文件目标没有"节"可截，磁盘短了就是真删了代码。
          if (kind === 'seg' && m.cand.prefixHitsDiskEnd) {
            console.log(`   --fix 拒绝落笔：磁盘这一段（${m.wantLines.length} 行）整段是计划块`
              + `（${m.cand.planLines} 行）的前缀，公共前缀 ${m.cand.p} 行走到了磁盘内容的末尾。`
              + `\n   这不是内容漂了，是**切分变了**（多半是磁盘新插了一条 "// ── §X" 标记把这节截短了）；`
              + '拿它替换计划会删掉计划里还没落地的那部分规格。先人工确认分节，再决定同步哪一边。');
          } else {
            fixes.push({ target, plan: cand.rel, block: cand, lines: m.wantLines, commonPrefix: m.cand.p });
          }
        }
      } else {
        const near = m.byLen
          ? `按行数最接近的是计划[${m.byLen.b.tag}] ${m.byLen.b.startLine}–${m.byLen.b.endLine}，差 ${m.byLen.d} 行；`
          : '两份计划里一个 js 块都没有，无从定位；';
        console.log(`✗ ${target}：两份计划里都没有逐字节相同的块（${near}公共前缀候选不唯一，无法定位，`
          + `${fix ? '--fix 不会动它' : '手工同步'}）`);
      }
      failures.push(target);
      return;
    }
    if (m.hit.length > 1) {
      console.log(`✗ ${target}：匹配到 ${m.hit.length} 个块（`
        + `${m.hit.map((h) => `[${h.tag}]${h.startLine}–${h.endLine}`).join(' / ')}），拒绝猜`);
      failures.push(target);
      return;
    }
    used.add(m.hit[0]);
    console.log(`OK ${target}：计划[${m.hit[0].tag}] ${m.hit[0].startLine}–${m.hit[0].endLine}`
      + `（${m.wantLines.length} 行）与磁盘逐字节全等`);
  };

  for (const rel of FILE_TARGETS) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      if (listOnly) console.log(`file ${rel}`);
      else { console.log(`✗ ${rel}：磁盘上没有这个文件`); failures.push(rel); }
      continue;
    }
    report('file', rel, norm(fs.readFileSync(abs, 'utf8')), rawBlocks, null);
  }

  const segAbs = path.join(ROOT, SEGMENTED);
  if (!fs.existsSync(segAbs)) {
    // 判据文件本身缺席时不能"跳过分段这一档、剩下照样打 ✓"——那等于把一半门禁悄悄关掉。
    // 报出来并退 1，让下一次重跑的人看见是哪一档没跑。
    console.log(`✗ ${SEGMENTED}：磁盘上没有这个文件，分段镜像一档整个没法核`);
    return 1;
  }
  const segText = norm(fs.readFileSync(segAbs, 'utf8'));
  const segLines = segText.split('\n');
  const marks = segLines.map((l, i) => ({ i, m: SEG_MARK.exec(l) })).filter((x) => x.m);
  // 切分自检：形如 "// ── §B …" 却**带缩进**的行，SEG_MARK 认不出来（它锚在行首）。
  // 这种行不会被当成分节标记，于是它下面那一整节被并进上一节的尾巴——上一节从此"逐字节
  // 不等"（假红），那一节则压根没人核（假绿），而 `--fix` 会把被污染的那一节当"真相"写回
  // 计划，把两节内容盖成一节（2026-09-27 复核在副本上实测：§E0 的标记行缩两格就成立）。
  // §A 那种顶格的子标记不在这里报——它们本来就被 `[B-Z]` 有意排除，是设计内的形状。
  const strayMarks = segLines
    .map((l, i) => ({ n: i + 1, l }))
    .filter((x) => /^\s+\/\/ ── §[B-Z]\d*\s/.test(x.l));
  let segmentationBroken = strayMarks.length > 0;
  for (const s of strayMarks) {
    console.log(`✗ 分节标记可疑：${SEGMENTED}:${s.n} 是 "    ${s.l.trim()}" —— `
      + `SEG_MARK 只认顶格的标记行，这一行不参与切分，它下面那一节会被并进上一节的尾巴`);
    failures.push(`${SEGMENTED}:${s.n} 标记缩进`);
  }
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
    report('seg', `${SEGMENTED} §${segName}（磁盘 ${from + 1}–${to}）`, want, segBlocks, segName);
  }

  if (listOnly) return 0;
  const mirrorBytes = [...used].reduce((n, b) => n + b.text.length, 0);
  console.log(`计划 js 块 ${rawBlocks.length} 个（${planData.map((p) => `${p.tag} ${p.blocks.length}`).join('、')}），`
    + `其中 ${used.size} 个是已落地镜像（合计 ${mirrorBytes}B），其余是任务正文里的片段/示例`);
  // 计划里成节的、磁盘上还没有的 §X 节：按切出来的那一节的首行标记认。
  // 只认**磁盘上还没有那一节**的：同一节的计划块与磁盘块不等时，上面已经出过 `✗`，
  // 这里再报一句"磁盘还没有这一节"就是假话——实测整改 `22d7147` 之后，§C 在磁盘有
  // 452 行、计划块只有 229 行，`used` 收不到那块，于是同一件事被报成"不等" + "未落地"
  // 两种形状，而后一种会把人支去写一份已经存在的判据。
  const pending = [];
  for (const b of segBlocks) {
    if (used.has(b)) continue;
    const mm = SEG_MARK.exec(b.text.split('\n')[0]);
    if (!mm) continue; // §A 那种无标记的整块：它要么已全等命中，要么不是"某一节"
    const letter = mm[1];
    if (onDisk.has(letter)) continue;
    pending.push(`${letter}（计划[${b.tag}] ${b.startLine}–${b.endLine}）`);
  }
  for (const p of pending) console.log(`⚠ 未落地：计划里有 §${p} 整块代码，磁盘 ${SEGMENTED} 还没有这一节`);
  // 反查"清单漏项"：`FILE_TARGETS` 是人手写的，写漏一项 = 那份镜像从此静默不核。
  // 段 2 的 `build-prefix-data.mjs`（164 行全文贴在计划[段2] 329–492）就是这么躲过去的
  // ——2026-09-27 复核才发现，而它躲过的正是"生成器改了没同步计划"这一整类差异。
  // 这里反过来问一句：计划里有没有哪块 js 与磁盘上某个**整文件**逐字节全等，却没人声明它。
  // 判失败而不是只打印，是因为"刺眼但退 0"的提示在门禁里等于没有。
  const declared = new Set([...FILE_TARGETS, SEGMENTED]);
  for (const dir of MIRROR_SCAN_DIRS) {
    const absDir = path.join(ROOT, dir);
    if (!fs.existsSync(absDir)) continue;
    for (const name of fs.readdirSync(absDir)) {
      const rel = path.posix.join(dir, name);
      if (declared.has(rel)) continue;
      const abs = path.join(ROOT, rel);
      if (!/\.(js|mjs)$/.test(name) || !fs.statSync(abs).isFile()) continue;
      const whole = norm(fs.readFileSync(abs, 'utf8'));
      const hits = rawBlocks.filter((b) => b.text === whole && !used.has(b));
      if (hits.length > 0) {
        console.log(`✗ 漏网镜像：${rel}（${whole.split('\n').length} 行）在计划里有逐字节全等的整块 —— `
          + `${hits.map((h) => `[${h.tag}]${h.startLine}–${h.endLine}`).join(' / ')}，但它不在 FILE_TARGETS 里，从没被核过`
          + `\n   处置：把 \`${rel}\` 加进 FILE_TARGETS（不是删那块镜像），再跑一次`);
        failures.push(rel);
      }
    }
  }
  // `--fix`：把"磁盘已经变了、计划还写着旧的一份"这几块整块换成磁盘内容。
  // 只换 `pickMirror` 唯一认出的那一块，其余（并列候选、§D 那种还没落地的整节、
  // 任务正文里的片段）**一行都不碰**——这是"计划跟着实现走"的一条口径，不是通用
  // 同步器：它绝不往计划里塞新块，也不删块。按 `startLine` 从大到小改写，
  // 这样每一刀的坐标都还是原始 `planLines` 的坐标（从小到大就会互相顶掉行号）。
  // 两份计划各写各的：按 `plan` 分组后逐份落盘，绝不把段 2 的镜像写进段 1 的文件。
  if (fix) {
    if (segmentationBroken) {
      // 切分本身可疑时**一刀都不落**：这时候每一段的边界都不可信，逐条落笔会把错边界
      // 写进计划。先人工把标记行修回去，再跑 `--fix`。
      console.log(`--fix：因分节可疑（${strayMarks.length} 处缩进标记）整轮不落笔，先修标记行的形状`);
    } else if (fixes.length === 0) {
      console.log('--fix：没有可同步的镜像块（要么已全等，要么候选不唯一、需要人工定位）');
    } else {
      for (const p of planData) {
        const mine = fixes.filter((f) => f.plan === p.rel);
        if (mine.length === 0) continue;
        let out = p.lines;
        for (const f of [...mine].sort((a, b) => b.block.startLine - a.block.startLine)) {
          out = [...out.slice(0, f.block.startLine - 1), ...f.lines, ...out.slice(f.block.endLine)];
        }
        for (const f of [...mine].sort((a, b) => a.block.startLine - b.block.startLine)) {
          console.log(`→ 已同步 ${f.target}：计划[${p.tag}] ${f.block.startLine}–${f.block.endLine}`
            + `（${norm(f.block.text).split('\n').length} 行）← 磁盘 ${f.lines.length} 行`);
        }
        fs.writeFileSync(path.join(ROOT, p.rel), out.join('\n'));
        console.log(`--fix：[${p.tag}] ${p.rel} 重写 ${mine.length} 块，`
          + `${p.lines.length} → ${out.length} 行；再跑一次本脚本确认（只按磁盘内容整块替换，正文其余部分未触碰）`);
      }
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
