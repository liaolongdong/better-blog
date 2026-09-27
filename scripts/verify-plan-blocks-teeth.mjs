#!/usr/bin/env node
/**
 * 守卫自证（第二版）：给 `scripts/verify-plan-blocks.mjs` 本轮新加的三道闸各补一刀，
 * 证明它们**有牙**——不注入就不算过，注入后必须按预期变红或拒绝落笔。
 *
 * 三道闸：
 *   G1 反查漏网镜像：FILE_TARGETS 少写一项 → `✗ 漏网镜像` + 退 1
 *   G2/G3 `--fix` 的前缀包含拒绝：切分被改（标记行缩进 / 新插标记）→ 拒绝落笔，
 *      两份计划的字节一字不动（旧行为：把两节盖成一节 / 把 615 行规格截成 119 行）
 *   G4 真漂移仍可同步：整文件镜像中间改一个字符 → `--fix` 照旧落笔、复跑退 0
 *   G5 判据文件缺席：`toolkit-tests.mjs` 不见了 → 明确报错退 1，而不是 ENOENT 崩
 *   G6 块池为空：两份计划都是空文件 → 逐条 `✗` 但不 TypeError
 *   G7 分节标记行自己漂了：按节名兜底定位，`--fix` 不再空转
 *   G8 非 js 整文件镜像（`.yml`）漂移：报 ✗、`--fix` 写回 —— 这一档在语言集合放宽之前
 *      根本不进门禁（Task 9 现场靠它抓出三处静默漂移），所以放宽必须连带一刀证据
 *   G9 非 js 目标从 `FILE_TARGETS` 里被删掉 → 反查喊 `✗ 漏网镜像`
 *   G10 清单里出现没有围栏语言映射的扩展名 → 喊出来，不当作"这文件没有镜像"静默跳过
 *
 * 全部实验只在 /tmp/vpb2 这份**最小副本**上做：仓库工作树零改动（末尾用 git status 自证）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = ROOT;
const MIR = '/tmp/vpb2';
const PLAN1 = '_docs/superpowers/plans/2026-09-25-online-tools-foundation.md';
const PLAN2 = '_docs/superpowers/plans/2026-09-26-tools-idcard-page.md';
const SCRIPT = 'scripts/verify-plan-blocks.mjs';

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(MIR, p))).digest('hex').slice(0, 16);
const read = (p) => fs.readFileSync(path.join(MIR, p), 'utf8');
const put = (p, t) => fs.writeFileSync(path.join(MIR, p), t);

/**
 * 从被测脚本里读 `FILE_TARGETS`。这张清单以前在镜像器里手抄了一份，Task 3 落地 `phone.js` 时
 * 就漏抄了：副本里没有那个文件，verifier 如实报 `✗ 磁盘上没有这个文件`，整轮自证退 1。
 * **读不出来必须抛**，不许静默少拷几件——少拷的那一档会假绿（脚手架自己说谎是这里第 10 种形状）。
 *
 * 解析按**行**走，且只认「整行以引号开头」的元素行。2026-09-27 现场踩到的是反方向：
 * `FILE_TARGETS` 里那段解释非 js 镜像为什么补进来的注释，写着「`main()` 早先只收
 * `lang === 'js'` 的块」——旧实现拿 `'([^']+)'` 扫整段，把 `'js'` 当成一条镜像目标，
 * `mirror()` 当场 `ENOENT copyfile …/js`，整轮自证**崩在拷文件那一步**（连一条 ✗ 都没有）。
 * 现在三档各有人喊：注释行（以 `//` 开头）直接跳过；含引号串却不是元素行形的，抛；
 * 元素位上写了个不像路径的串（没有扩展名），也抛。见 G11。
 * @param {string} src `verify-plan-blocks.mjs` 的源码
 * @returns {string[]} 镜像目标路径清单
 */
function parseFileTargets(src) {
  const m = /const FILE_TARGETS = \[([\s\S]*?)\];/.exec(src);
  if (!m) throw new Error('读不到 FILE_TARGETS 数组：镜像器不能靠猜清单');
  const targets = [];
  const odd = [];
  for (const raw of m[1].split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    const hit = /^'([^']+)'/.exec(line);
    if (hit) { targets.push(hit[1]); continue; }
    if (/'[^']+/.test(line)) odd.push(line);
  }
  if (odd.length) {
    throw new Error(`FILE_TARGETS 里有 ${odd.length} 行含引号串却不是元素行形（旧解析会把注释里的例子当目标）：\n  ${odd.join('\n  ')}`);
  }
  const bogus = targets.filter((p) => !/\.[A-Za-z0-9]+,?$/.test(p));
  if (bogus.length) throw new Error(`FILE_TARGETS 的元素不像路径（缺扩展名）：${bogus.join(', ')}`);
  if (targets.length < 8) throw new Error(`FILE_TARGETS 只解析出 ${targets.length} 项，形状变了，先修这里`);
  return targets;
}
const fileTargets = () => parseFileTargets(fs.readFileSync(path.join(REPO, SCRIPT), 'utf8'));

/** 从仓库往副本拷一棵最小子树（只拷这轮判据用得着的东西，避开 node_modules） */
function mirror() {
  fs.rmSync(MIR, { recursive: true, force: true });
  const files = [SCRIPT, PLAN1, PLAN2, 'scripts/toolkit-tests.mjs', ...fileTargets()];
  for (const f of new Set(files)) {
    const dst = path.join(MIR, f);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(REPO, f), dst);
  }
}

/** 跑副本里的脚本；返回 {code, out}，退码看 spawn 不看管道 */
function run(args = []) {
  try {
    const out = execFileSync('node', [path.join(MIR, SCRIPT), ...args], { cwd: MIR, encoding: 'utf8' });
    return { code: 0, out, err: '' };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, out: String(e.stdout ?? ''), err: String(e.stderr ?? '') };
  }
}

const results = [];
const check = (id, pass, detail) => {
  results.push({ id, pass, detail });
  console.log(`${pass ? '✓' : '✗'} ${id} — ${detail}`);
};

/**
 * 仓库工作树的**脏指纹**，实验前拍一张、收口后再拍一张，两必须一模一样。
 * 三项输入：
 *   1. `git status --porcelain` 原文——路径 + XY 状态码，抓"多出一个脏文件 / 少了一个"；
 *   2. `git diff --no-ext-diff` 的 sha256——抓**内容**漂移：只看路径名的话，一处改在
 *      "本来就脏"的文件里、改完名字不变，集合照样相等，那记污染就静默过去了；
 *   3. `git ls-files --others --exclude-standard` 的路径表——未跟踪目录在第 1 项里只占一行
 *      `?? dir/`，里面新增一个文件看不出来，这一项补上（本机实测 4 条路径，代价可忽略）。
 * 为什么不用白名单：白名单要么每轮跟着实现改（Task 2 落地时它就把刚提交的判据文件报成意外脏），
 * 要么悄悄放过实验留下的污染。
 * 已知没盖住的一档：**已存在**的未跟踪文件被原地改内容（三项输入都不含它的字节）——
 * 本 harness 的变异只落在 `dev/js/tools/*.js`、`scripts/*.mjs` 与两份计划这些**已跟踪**文件上，
 * 真往那几处写的话第 1、3 项会先响。
 */
const dirtyFingerprint = () => {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: REPO, encoding: 'utf8' });
  const diff = execFileSync('git', ['diff', '--no-ext-diff'], { cwd: REPO, encoding: 'utf8' });
  const others = execFileSync('git', ['ls-files', '--others', '--exclude-standard'],
    { cwd: REPO, encoding: 'utf8' });
  return {
    paths: new Set(status.split('\n').filter(Boolean).map((l) => l.slice(3).trim())),
    hash: crypto.createHash('sha256').update(status).update('\0')
      .update(diff).update('\0').update(others).digest('hex').slice(0, 16),
  };
};

const dirtyBefore = dirtyFingerprint();

mirror();
const base = run();
// 基线判的是"副本活着且自洽"：退出码 0、汇总行里报的镜像数**与逐条 `OK ` 行的条数相等**。
// 这里故意不写死"16 个"那种数字——镜像数每落地一节就变一次，写死的后果是每做一次任务
// 都要来改一次断言，而改断言的人手里正拿着一个可能已经瞎掉的守卫。
const okLines = (base.out.match(/^OK /gm) || []).length;
const summaryCount = Number((/其中 (\d+) 个是已落地镜像/.exec(base.out) || [])[1] ?? -1);
check('基线（副本必须先绿，否则后面全是假证据）',
  base.code === 0 && /✓ 全部已落地镜像/.test(base.out) && okLines > 0 && okLines === summaryCount,
  `exit=${base.code}，OK 行 ${okLines} 条 ↔ 汇总 ${summaryCount} 个`);
if (base.code !== 0) {
  console.log(base.out);
  process.exit(1);
}

/* ── G1：清单少写一项 → 反查必须喊出来 ───────────────────────────── */
{
  const orig = read(SCRIPT);
  put(SCRIPT, orig.replace("  'scripts/build-prefix-data.mjs',\n", ''));
  const r = run();
  put(SCRIPT, orig);
  check('G1 漏声明 → ✗ 漏网镜像 + 退 1',
    r.code === 1 && /✗ 漏网镜像：scripts\/build-prefix-data\.mjs/.test(r.out) && /没被核过/.test(r.out),
    `exit=${r.code}，命中 ${/✗ 漏网镜像/.test(r.out)}`);
}

/* ── G2：磁盘 §E0 标记行缩进 → §D 被并节，--fix 必须拒绝落笔 ─────── */
{
  const plans = [sha(PLAN1), sha(PLAN2)];
  const t = read('scripts/toolkit-tests.mjs');
  const marked = t.replace('\n// ── §E0 ', '\n  // ── §E0 ');
  check('G2 变异本身落地了（没落地就别判"守卫有效"）', marked !== t, `替换命中 ${marked !== t}`);
  put('scripts/toolkit-tests.mjs', marked);
  const r1 = run();
  const r2 = run(['--fix']);
  const unchanged = sha(PLAN1) === plans[0] && sha(PLAN2) === plans[1];
  put('scripts/toolkit-tests.mjs', t);
  const back = run();
  check('G2 并节形状：报标记可疑 + §D 不等、--fix 整轮不落笔、两份计划一字未动、恢复后复绿',
    r1.code === 1 && /✗ 分节标记可疑/.test(r1.out) && r2.code === 1
      && /因分节可疑/.test(r2.out) && !/已同步/.test(r2.out) && unchanged && back.code === 0,
    `读跑 exit=${r1.code} 点名标记=${/✗ 分节标记可疑/.test(r1.out)}；--fix exit=${r2.code} 拒写=${/因分节可疑/.test(r2.out)}；计划哈希未变=${unchanged}；恢复后 exit=${back.code}`);
}

/* ── G3：磁盘 §C 体内插一条标记 → 截断形状，--fix 必须拒绝 ───────── */
{
  const before = { p1: read(PLAN1), p2: read(PLAN2) };
  const t = read('scripts/toolkit-tests.mjs');
  const anchor = /^\/\/ ── §C .*$/m.exec(t);
  check('G3 找到 §C 的标记行', !!anchor, anchor ? `锚点 @${anchor.index}：${anchor[0].slice(0, 24)}…` : '锚点未命中');
  const lines = t.split('\n');
  const idx = lines.findIndex((l) => /^\/\/ ── §C /.test(l));
  const ins = idx + 101;
  lines.splice(ins, 0, '// ── §C2 子项：磁盘上刚分出来的一小节');
  const marked = lines.join('\n');
  check('G3 变异落地（§C 体内第 100 行后插标记）', idx > 0 && marked !== t, `§C 标记在第 ${idx + 1} 行，插入点 ${ins + 1}`);
  put('scripts/toolkit-tests.mjs', marked);
  const r1 = run();
  const r2 = run(['--fix']);
  const untouched = read(PLAN1) === before.p1 && read(PLAN2) === before.p2;
  const lostLines = before.p1.split('\n').length - read(PLAN1).split('\n').length;
  put('scripts/toolkit-tests.mjs', t);
  check('G3 截断形状：--fix 拒绝、段1 计划一行没丢（旧行为会截掉约 515 行）',
    r1.code === 1 && r2.code === 1 && /--fix 拒绝落笔/.test(r2.out) && untouched,
    `--fix exit=${r2.code} 拒绝=${/--fix 拒绝落笔/.test(r2.out)}；段1 行数变化=${lostLines}`);
}

/* ── G4：真漂移（整文件镜像末尾加一行）→ --fix 仍要能修 ─────────── */
{
  // 这一刀会**合法地**改到副本里的段 1 计划，所以前后都要快照：
  // 只还原磁盘文件、不还原计划，会把"计划跟着实现走"这件事变成下一档的假红。
  const planSnap = { p1: read(PLAN1), p2: read(PLAN2) };
  const orig = read('dev/js/tools/uscc.js');
  put('dev/js/tools/uscc.js', `${orig}\n// 本轮真漂移：磁盘加了一行注释，计划还写着旧的\n`);
  const r1 = run();
  const r2 = run(['--fix']);
  const wroteBack = /→ 已同步 dev\/js\/tools\/uscc\.js/.test(r2.out);
  const r3 = run();
  put('dev/js/tools/uscc.js', orig);
  put(PLAN1, planSnap.p1);
  put(PLAN2, planSnap.p2);
  const r4 = run();
  check('G4 真漂移：报不等 → --fix 落笔 → 修后复跑退 0 → 双向还原后仍退 0',
    r1.code === 1 && wroteBack && r3.code === 0 && r4.code === 0,
    `漂移 exit=${r1.code}；--fix(exit=${r2.code}) 写回=${wroteBack}；修后 exit=${r3.code}；还原后 exit=${r4.code}`);
}

/* ── G7：§E0 的标记行自己漂了 → 按节名兜底定位，--fix 不再空转 ──── */
{
  const planSnap = { p1: read(PLAN1), p2: read(PLAN2) };
  const t = read('scripts/toolkit-tests.mjs');
  const lines = t.split('\n');
  const idx = lines.findIndex((l) => /^\/\/ ── §E0 /.test(l));
  const drifted = lines.map((l, i) => (i === idx ? `${l.replace(/─+$/, '')}E0 标题被人改了两个字 ──────` : l));
  check('G7 变异落地（只改 §E0 标题文字，不动结构）', idx > 0 && drifted[idx] !== lines[idx],
    `§E0 标记在第 ${idx + 1} 行；原行 ${lines[idx].slice(0, 22)}…`);
  put('scripts/toolkit-tests.mjs', drifted.join('\n'));
  const r1 = run();
  const r2 = run(['--fix']);
  const named = /按节名定位/.test(r1.out);
  const wroteBack = /→ 已同步 scripts\/toolkit-tests\.mjs §E0/.test(r2.out);
  const r3 = run();
  put('scripts/toolkit-tests.mjs', t);
  put(PLAN1, planSnap.p1);
  put(PLAN2, planSnap.p2);
  const r4 = run();
  check('G7 标记行漂移：按节名点名 → --fix 写回 §E0 → 修后退 0 → 双向还原后仍退 0',
    r1.code === 1 && named && wroteBack && r3.code === 0 && r4.code === 0,
    `漂移 exit=${r1.code} 按节名=${named}；--fix 写回=${wroteBack}；修后 exit=${r3.code}；还原后 exit=${r4.code}`);
}

/* ── G8：非 js 整文件镜像（.yml）漂移 → 必须报、且 --fix 能同步 ──── */
{
  // 这一档在 2026-09-27 之前是**静默**的：`main()` 里 `.filter((b) => b.lang === 'js')`
  // 一句过滤把四块非 js 镜像关在门外，磁盘改了计划不会红——现场就是靠它才发现
  // 两份 `title` 与整份 svg 注释早就漂了。所以这里两头都要咬：报得出、也修得回。
  const planSnap = read(PLAN2);
  const orig = read('_data/onlineTools.yml');
  put('_data/onlineTools.yml', orig.replace('title: 身份证号校验与生成', 'title: 身份证号校验与生成X'));
  const r1 = run();
  const r2 = run(['--fix']);
  const wroteBack = /→ 已同步 _data\/onlineTools\.yml/.test(r2.out);
  // 只还原磁盘、计划留着 --fix 刚写进去的那份：这一跑仍须 ✗，才证明 `--fix` 真的落笔了
  // （旧顺序把两次还原都放在 r3 之前，于是 r3 判的是"两边都改写、彼此相等"→ 恒绿，
  //  而 detail 文案写的是"磁盘已还原、计划仍是改写后的那份"——文案与代码不符，2026-09-27 现场暴露）。
  put('_data/onlineTools.yml', orig);
  const r3 = run();
  put(PLAN2, planSnap);
  const r4 = run();
  check('G8 非 js 镜像漂移：报 ✗ → --fix 写回 yml 块 → 只还原磁盘仍 ✗ → 双向还原后退 0',
    r1.code === 1 && /✗ _data\/onlineTools\.yml/.test(r1.out) && wroteBack && r3.code === 1 && r4.code === 0,
    `漂移 exit=${r1.code} 点名=${/✗ _data\/onlineTools\.yml/.test(r1.out)}；--fix(exit=${r2.code}) 写回=${wroteBack}；`
      + `只还原磁盘 exit=${r3.code}（计划里还留着改写后的那份，应 ✗）；双向还原后 exit=${r4.code}`);
}

/* ── G9：非 js 镜像漏声明 → 反查必须喊出来 ─────────────────────── */
{
  const orig = read(SCRIPT);
  put(SCRIPT, orig.replace("  '_data/onlineTools.yml',\n", ''));
  const r = run();
  put(SCRIPT, orig);
  check('G9 清单里删掉一条非 js 目标 → ✗ 漏网镜像（_data/onlineTools.yml）+ 退 1',
    r.code === 1 && /✗ 漏网镜像：_data\/onlineTools\.yml/.test(r.out),
    `exit=${r.code}，命中=${/✗ 漏网镜像：_data\/onlineTools\.yml/.test(r.out)}`);
}

/* ── G10：扩展名没有围栏映射 → 报出来，不当作"没有镜像"放过 ─────── */
{
  const orig = read(SCRIPT);
  put(SCRIPT, orig.replace("  '_data/onlineTools.yml',", "  '_data/onlineTools.yml',\n  'README.md',"));
  const r = run();
  put(SCRIPT, orig);
  check('G10 陌生扩展名（README.md）→ ✗ 没有围栏语言映射，而不是静默不核',
    r.code === 1 && /README\.md: 扩展名没有围栏语言映射/.test(r.out),
    `exit=${r.code}，命中=${/README\.md: 扩展名没有围栏语言映射/.test(r.out)}`);
}

/* ── G11：读清单的解析器自己——注释里的例子不算目标，元素位的 junk 必抛 ── */
{
  // 这一档咬的是脚手架自己的第 11 种形状，**不落盘**（只在内存里改字符串），
  // 所以不碰脏指纹那道收口自证。2026-09-27 现场：`FILE_TARGETS` 的一段注释里写着
  // 「`main()` 早先只收 `lang === 'js'` 的块」，旧实现把 `'js'` 扫成了镜像目标，
  // 整轮自证在 `mirror()` 里 ENOENT 崩掉——连一条 ✗ 都没来得及打。
  const src = fs.readFileSync(path.join(REPO, SCRIPT), 'utf8');
  const anchor = "  '_data/onlineTools.yml',\n";
  if (!src.includes(anchor)) throw new Error('G11 的锚点（_data/onlineTools.yml 元素行）不在了，先修这一格');
  const base = parseFileTargets(src);
  const withComment = src.replace(anchor, "  // 注释里举的例子写作 `'js'`、`'yaml'`，不该被当成镜像目标\n" + anchor);
  const fromComment = parseFileTargets(withComment);
  const ignored = fromComment.length === base.length && fromComment.every((p, i) => p === base[i]);
  let threwOnJunk = '';
  try {
    parseFileTargets(src.replace(anchor, "  'js',\n" + anchor));
  } catch (e) {
    threwOnJunk = e.message;
  }
  check('G11 解析器只认元素行：注释里的 \'js\' 不进清单；元素位的 \'js\' 必抛（旧实现在此 ENOENT 崩）',
    ignored && /缺扩展名/.test(threwOnJunk),
    `注释版与原版逐项相等=${ignored}（${base.length} 项）；元素位 junk 抛错=${threwOnJunk ? '是' : '否'}`);
}

/* ── G5：判据文件缺席 → 明确报错，不是 ENOENT 崩 ────────────────── */
{
  const t = read('scripts/toolkit-tests.mjs');
  fs.rmSync(path.join(MIR, 'scripts/toolkit-tests.mjs'));
  const r = run();
  put('scripts/toolkit-tests.mjs', t);
  check('G5 判据文件缺席：报"分段镜像一档整个没法核"并退 1（无堆栈）',
    r.code === 1 && /分段镜像一档整个没法核/.test(r.out) && !/ENOENT/.test(r.err),
    `exit=${r.code}，stderr 里有堆栈=${/ENOENT|Traceback/.test(r.err)}`);
}

/* ── G6：块池为空（两份计划都变空文件）→ 不 TypeError ───────────── */
{
  const p1 = read(PLAN1); const p2 = read(PLAN2);
  put(PLAN1, ''); put(PLAN2, '');
  const r = run();
  put(PLAN1, p1); put(PLAN2, p2);
  check('G6 计划全空：逐条 ✗、退 1、不崩（无 TypeError）',
    r.code === 1 && !/TypeError/.test(r.err) && /两份计划里都没有逐字节相同的块/.test(r.out),
    `exit=${r.code}，TypeError=${/TypeError/.test(r.err)}，恢复后 ${(run().code === 0) ? '副本复绿' : '副本未复绿'}`);
}

const green = run();
check('收口自证：副本回到全绿且工作树未被这些实验碰过',
  green.code === 0,
  `副本 exit=${green.code}`);

const dirtyAfter = dirtyFingerprint();
const added = [...dirtyAfter.paths].filter((f) => !dirtyBefore.paths.has(f));
const removed = [...dirtyBefore.paths].filter((f) => !dirtyAfter.paths.has(f));
const sameHash = dirtyBefore.hash === dirtyAfter.hash;
check('收口自证：实验前后工作树的脏指纹一模一样（路径、内容 diff、未跟踪清单三项全等）',
  added.length === 0 && removed.length === 0 && sameHash,
  added.length || removed.length
    ? `新增脏：${added.join(' / ') || '无'}；消失：${removed.join(' / ') || '无'}`
    : `脏项 ${dirtyAfter.paths.size} 个前后一致，diff 指纹 ${dirtyAfter.hash}`
      + `${sameHash ? '' : ` ≠ 实验前的 ${dirtyBefore.hash}（有文件被原地改了没还原）`}`
      + '（含另一路会话的那批，一律未被触碰）');

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} 通过${failed.length ? `，失败：${failed.map((f) => f.id).join(' / ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
