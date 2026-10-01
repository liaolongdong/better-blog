#!/usr/bin/env node
/**
 * 守卫自证（第二版）：给 `scripts/verify-plan-blocks.mjs` 本轮新加的三道闸各补一刀，
 * 证明它们**有牙**——不注入就不算过，注入后必须按预期变红或拒绝落笔。
 *
 * 三道闸：
 *   G1 反查漏网镜像：FILE_TARGETS 少写一项 → `✗ 漏网镜像` + 退 1
 *   G2/G3 `--fix` 的前缀包含拒绝：切分被改（标记行缩进 / 新插标记）→ 拒绝落笔，
 *      各份计划的字节一字不动（旧行为：把两节盖成一节 / 把 615 行规格截成 119 行）
 *   G4 真漂移仍可同步：整文件镜像中间改一个字符 → `--fix` 照旧落笔、复跑退 0
 *   G5 判据文件缺席：`toolkit-tests.mjs` 不见了 → 明确报错退 1，而不是 ENOENT 崩
 *   G6 块池为空：所有计划都是空文件 → 逐条 `✗` 但不 TypeError
 *   G12 `PLANS` 少一份（段 3 被摘）→ 该份名下**所有**镜像全部 `✗`——第三份条目是承重的
 *       （目标清单从基线输出里现读，不手抄：段 3 每落地一格都要跟着改硬编码断言的话，
 *        忘改的那一格照样绿、只是不再覆盖新来的那块）
 *   G7 分节标记行自己漂了：按节名兜底定位，`--fix` 不再空转
 *   G8 非 js 整文件镜像（`.yml`）漂移：报 ✗、`--fix` 写回 —— 这一档在语言集合放宽之前
 *      根本不进门禁（Task 9 现场靠它抓出三处静默漂移），所以放宽必须连带一刀证据
 *   G9 非 js 目标从 `FILE_TARGETS` 里被删掉 → 反查喊 `✗ 漏网镜像`
 *   G10 清单里出现没有围栏语言映射的扩展名 → 喊出来，不当作"这文件没有镜像"静默跳过
 *   G13 副本落点的三道拒绝（2026-09-29 随这处的缺陷修复进来）：`VPB_MIR` 指到仓库自己 /
 *       落在仓库里面 / 仓库包含它 / 非空且没有标记 / 标记的 pid 还活着 → 一律退 2 且一字不伤；
 *       另带一刀"把守卫摘掉"的变异，证明退 2 是守卫给的、不是那条路径自己走不通
 *   G14 清单漏项反查打在**段 5 那三本**上（2026-10-01，第四份计划接手 §X–§Z）：从
 *       `FILE_TARGETS` 里摘掉 `dev/js/tools/diff-core.js` → `✗ 漏网镜像` + 退 1。G1 摘的是
 *       段 1 的老目标，那一格只证明"反查存在"；新登记的这一本从清单里掉一行若没人喊，
 *       那块 5.8 万字的镜像就静默不核
 *   G15 §X 的标记行缩进 → 假"逐字节不等"那一族（与 G2 同形、落点换成最新那一份计划接手的
 *       那一节）：`// ── §X` 缩进两格就不算分节标记，§X 的一千多行被判给 §W 的尾巴，
 *       上一节假红、§X 假绿，`--fix` 会把污染的那一节整块写回段 5 计划。判的是
 *       "报分节可疑 + --fix 整轮不落笔 + 五份计划一字未动"
 *
 * 全部实验只在一份**最小副本**上做：仓库工作树零改动（末尾用 git status 与内容 diff 指纹自证）。
 * 副本落点原来写死 `/tmp/vpb2`，2026-09-29 改成默认每次 `mkdtemp` 一份独享的，理由与三道拒绝
 * 都写在下面 `resolveMirror()` 那段注释里。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = ROOT;
/** 副本目录里由这本脚本自己留的标记；`mirror()` 每次重写，三道拒绝拿它认门 */
const MARKER = '.vpb-mirror.json';

/**
 * 副本落点（2026-09-29 改掉的一处缺陷）。
 *
 * 原来这里写死 `const MIR = '/tmp/vpb2'`，而 `mirror()` 的第一句是
 * `fs.rmSync(MIR, { recursive: true, force: true })`，于是有两个都是**静默**的坏处：
 *   ① 原地跑（把仓库拷进 `/tmp/vpb2`、再在那里面执行这本脚本）时 `REPO === MIR`，
 *      它先把**自己所在的目录**删掉、再去那目录里拷文件，`ENOENT: …/scripts/verify-plan-blocks.mjs`
 *      当场崩（2026-09-28 段 3 Task 8 现场，那一轮被迫另建一份全量副本才跑成）；
 *   ② 两路会话同时跑同一本，各自 `rmSync` 掉对方正在注入变异的那一份副本——红照样红，
 *      但那一刀的成因已经不属于它了。
 * 现在的口径：默认每次 `mkdtempSync` 一份独享副本（全绿才删，红着留着做尸检）；`VPB_MIR`
 * 可以钉死落点，但必须先过三道拒绝——**与仓库有包含关系**（任何一种方向）、**非空且没有
 * 这本脚本的标记**（那是别人的目录，不替谁删）、**标记里的 pid 还活着**（另一路会话正占着）。
 * @returns {{dir: string, auto: boolean}} 落点与"是不是这本自己造的"
 */
function resolveMirror() {
  const die = (dir, why) => {
    console.error(`✗ 副本落点被拒绝：${why}`);
    console.error(`  MIR=${dir}\n  REPO=${REPO}`);
    console.error('  这一本会先把落点整目录 rmSync 再往里拷副本，所以落点必须是它自己那份。');
    process.exit(2);
  };
  const inside = (parent, child) => child === parent || child.startsWith(parent + path.sep);
  /**
   * 比较之前先规范化：**macOS 的 `/tmp` 与 `/var` 都是 `/private/…` 的符号链接**，
   * 而 Node 会把入口模块的 `import.meta.url` 走成 realpath——于是 `REPO` 带 `/private`、
   * 传进来的 `VPB_MIR` 不带，两条包含关系都不成立，"落点就是仓库"这一档会**静默不点燃**
   * （2026-09-29 第一次跑 G13a/G13b 就是这么红的）。目录还不存在时逐级往上找最近的
   * 存在祖先做 realpath，再把剩下的段落拼回去。
   */
  const realish = (p) => {
    let cur = path.resolve(p);
    const tail = [];
    while (!fs.existsSync(cur)) {
      const parent = path.dirname(cur);
      if (parent === cur) break;
      tail.unshift(path.basename(cur));
      cur = parent;
    }
    let base = cur;
    try { base = fs.realpathSync(cur); } catch { /* 规范化不了就用原值 */ }
    return tail.length ? path.join(base, ...tail) : base;
  };
  /** pid 是否还在（EPERM 也算在——别人的进程同样是"在用"） */
  const pidAlive = (pid) => {
    try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
  };
  if (!process.env.VPB_MIR) {
    return { dir: fs.mkdtempSync(path.join(os.tmpdir(), 'vpb2-')), auto: true };
  }
  const dir = path.resolve(process.env.VPB_MIR);
  const dirReal = realish(dir);
  const repoReal = realish(REPO);
  if (dirReal === repoReal) die(dir, '落点就是仓库自己（原地跑会先把脚本赖以运行的源码删掉）');
  if (inside(dirReal, repoReal)) die(dir, '仓库在这份副本里面（rmSync 会连带删掉真实的仓库）');
  if (inside(repoReal, dirReal)) die(dir, '落点在仓库工作树里面（变异会打在真实文件上，末尾的脏指纹自证也救不回内容）');
  if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0) {
    if (!fs.existsSync(path.join(dir, MARKER))) {
      die(dir, `落点是非空目录、且没有 ${MARKER}（那不是这本脚本留下的，不替谁删）`);
    }
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(path.join(dir, MARKER), 'utf8'));
    } catch {
      die(dir, `落点里的 ${MARKER} 读不动/不是 JSON，不能确认这份副本归谁`);
    }
    if (meta.pid && meta.pid !== process.pid && pidAlive(meta.pid)) {
      die(dir, `落点这份副本正被另一路会话占着（pid ${meta.pid}，${meta.repo ?? '来源未知'}）`);
    }
  }
  return { dir, auto: false };
}

const { dir: MIR, auto: MIR_AUTO } = resolveMirror();
const PLAN1 = '_docs/superpowers/plans/2026-09-25-online-tools-foundation.md';
const PLAN2 = '_docs/superpowers/plans/2026-09-26-tools-idcard-page.md';
const SCRIPT = 'scripts/verify-plan-blocks.mjs';
/** 分段镜像的那本判据文件（与 `verify-plan-blocks.mjs:265` 同名同值；G15 拿它落刀） */
const SEGMENTED = 'scripts/toolkit-tests.mjs';

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(MIR, p))).digest('hex').slice(0, 16);
const read = (p) => fs.readFileSync(path.join(MIR, p), 'utf8');
const put = (p, t) => fs.writeFileSync(path.join(MIR, p), t);

/**
 * 计划清单从**被测脚本的 `PLANS`** 现读，不在这里手抄第二份。
 *
 * 为什么这里也要学 `FILE_TARGETS` 那一套（见 `parseFileTargets`）：这份清单以前是手抄的，
 * 2026-09-27 接段 3 时漏抄过一次，现场是 `ENOENT copyfile` 崩在拷文件那一步，连一条 ✗ 都没有；
 * 2026-09-29 接段 4 时它是第二次同样的手工动作。手抄的失败形状有两种，都难查：
 * 少抄一份 → 副本里没那个文件，整轮自证退 1，红得完全不像"计划与磁盘不一致"；
 * 多抄一份（计划已从 `PLANS` 摘走）→ `snapPlans` 读的是副本里躺着的那份，断言照样绿，
 * 只是它不再覆盖任何被核定的东西。现在这两种形状都退成了「 derive 不出来就抛」。
 * @param {string} src `verify-plan-blocks.mjs` 的源码
 * @returns {string[]} 计划相对路径清单，顺序同 `PLANS`
 */
function parsePlanRels(src) {
  const m = /const PLANS = \[([\s\S]*?)\n\];/.exec(src);
  if (!m) throw new Error('读不到 PLANS 数组：镜像器不能靠猜计划清单');
  const rels = [];
  const odd = [];
  for (const raw of m[1].split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;
    const hit = /\{ *rel: '([^']+)', *tag: '[^']+' *\}/.exec(line);
    if (hit) { rels.push(hit[1]); continue; }
    if (line.includes("'")) odd.push(line);
  }
  if (odd.length) {
    throw new Error(`PLANS 里有 ${odd.length} 行含引号串却不是条目行形（注释里的例子会被旧解析当真）：\n  ${odd.join('\n  ')}`);
  }
  if (rels.length < 3) throw new Error(`PLANS 只解析出 ${rels.length} 份计划，形状变了，先修这里`);
  const absent = rels.filter((p) => !fs.existsSync(path.join(REPO, p)));
  if (absent.length) throw new Error(`PLANS 声明了仓库里不存在的计划：${absent.join(', ')}`);
  return rels;
}
const cache = {};
/**
 * **为什么是惰性的一次而不是顶层一句**：G13f 那一刀把整本脚本（摘掉守卫调用点的版本）
 * 装进一个只有这一本脚本的 victim 仓库，要它一路走到 `mirror()` 才能量出"rmSync 掉自己再
 * ENOENT"那一档。顶层读一次 `SCRIPT` 就在那之前 ENOENT 崩，脚本还在 → 那一刀的断言
 * `survived === false` 永不可能成立，牙齿变成假牙（2026-09-29 现场，本轮改动自己踩的）。
 * 结果只算一次并缓存，所以"清单从 `PLANS` 现读"这条口径不靠每次重读文件维持。
 */
const PLAN_RELS = () => {
  if (!cache.planRels) cache.planRels = parsePlanRels(fs.readFileSync(path.join(REPO, SCRIPT), 'utf8'));
  return cache.planRels;
};
/** 四份以上计划的统一快照/还原/哈希。为什么要一组函数而不是各处的 `p1`/`p2` 手抄：
 *  每加一份计划就要在每个"一字未动""双向还原"的断言里多写一格，漏写的那一格是**静默**的——
 *  断言照样绿，只是它不再覆盖新来的那份计划。集合从 `PLAN_RELS()` 取，加一份就全覆盖。 */
const snapPlans = () => Object.fromEntries(PLAN_RELS().map((p) => [p, read(p)]));
const planShas = () => PLAN_RELS().map((p) => sha(p));
const restorePlans = (snap) => PLAN_RELS().forEach((p) => put(p, snap[p]));
const plansUnchanged = (snap) => PLAN_RELS().every((p) => read(p) === snap[p]);

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
  const files = [SCRIPT, ...PLAN_RELS(), 'scripts/toolkit-tests.mjs', ...fileTargets()];
  for (const f of new Set(files)) {
    const dst = path.join(MIR, f);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(REPO, f), dst);
  }
  // 标记紧跟在 rmSync 之后落：下一次（含别的进程）拿它认门——三道拒绝里
  // "非空且没标记不许删"与"标记的 pid 还活着不许占"两条都读这一格。
  fs.writeFileSync(
    path.join(MIR, MARKER),
    `${JSON.stringify({ pid: process.pid, repo: REPO, at: new Date().toISOString() }, null, 2)}\n`
  );
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
 * 本 harness 的变异只落在 `dev/js/tools/*.js`、`scripts/*.mjs` 与各份计划这些**已跟踪**文件上，
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
console.log(`副本落点：${MIR}（${MIR_AUTO ? '本次 mkdtemp 独享' : 'VPB_MIR 钉的'}）`);
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
  const plans = planShas();
  const t = read('scripts/toolkit-tests.mjs');
  const marked = t.replace('\n// ── §E0 ', '\n  // ── §E0 ');
  check('G2 变异本身落地了（没落地就别判"守卫有效"）', marked !== t, `替换命中 ${marked !== t}`);
  put('scripts/toolkit-tests.mjs', marked);
  const r1 = run();
  const r2 = run(['--fix']);
  const unchanged = planShas().every((s, i) => s === plans[i]);
  put('scripts/toolkit-tests.mjs', t);
  const back = run();
  check(`G2 并节形状：报标记可疑 + §D 不等、--fix 整轮不落笔、${PLAN_RELS().length} 份计划一字未动、恢复后复绿`,
    r1.code === 1 && /✗ 分节标记可疑/.test(r1.out) && r2.code === 1
      && /因分节可疑/.test(r2.out) && !/已同步/.test(r2.out) && unchanged && back.code === 0,
    `读跑 exit=${r1.code} 点名标记=${/✗ 分节标记可疑/.test(r1.out)}；--fix exit=${r2.code} 拒写=${/因分节可疑/.test(r2.out)}；计划哈希未变=${unchanged}；恢复后 exit=${back.code}`);
}

/* ── G3：磁盘 §C 体内插一条标记 → 截断形状，--fix 必须拒绝 ───────── */
{
  const before = snapPlans();
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
  const untouched = plansUnchanged(before);
  const lostLines = before[PLAN1].split('\n').length - read(PLAN1).split('\n').length;
  put('scripts/toolkit-tests.mjs', t);
  check('G3 截断形状：--fix 拒绝、段1 计划一行没丢（旧行为会截掉约 515 行）',
    r1.code === 1 && r2.code === 1 && /--fix 拒绝落笔/.test(r2.out) && untouched,
    `--fix exit=${r2.code} 拒绝=${/--fix 拒绝落笔/.test(r2.out)}；段1 行数变化=${lostLines}`);
}

/* ── G4：真漂移（整文件镜像末尾加一行）→ --fix 仍要能修 ─────────── */
{
  // 这一刀会**合法地**改到副本里的段 1 计划，所以前后都要快照：
  // 只还原磁盘文件、不还原计划，会把"计划跟着实现走"这件事变成下一档的假红。
  const planSnap = snapPlans();
  const orig = read('dev/js/tools/uscc.js');
  put('dev/js/tools/uscc.js', `${orig}\n// 本轮真漂移：磁盘加了一行注释，计划还写着旧的\n`);
  const r1 = run();
  const r2 = run(['--fix']);
  const wroteBack = /→ 已同步 dev\/js\/tools\/uscc\.js/.test(r2.out);
  const r3 = run();
  put('dev/js/tools/uscc.js', orig);
  restorePlans(planSnap);
  const r4 = run();
  check('G4 真漂移：报不等 → --fix 落笔 → 修后复跑退 0 → 双向还原后仍退 0',
    r1.code === 1 && wroteBack && r3.code === 0 && r4.code === 0,
    `漂移 exit=${r1.code}；--fix(exit=${r2.code}) 写回=${wroteBack}；修后 exit=${r3.code}；还原后 exit=${r4.code}`);
}

/* ── G7：§E0 的标记行自己漂了 → 按节名兜底定位，--fix 不再空转 ──── */
{
  const planSnap = snapPlans();
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
  restorePlans(planSnap);
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

/* ── G6：块池为空（**所有**计划都变空文件）→ 不 TypeError ────────── */
{
  const snap = snapPlans();
  PLAN_RELS().forEach((p) => put(p, ''));
  const r = run();
  restorePlans(snap);
  // 断言里的消息不带计划份数（`份计划里都没有…`）：份数从 `PLANS.length` 插值出来，
  // 写死"两份"的话，接第三份计划时这条会红在一句**措辞**上，看着像守卫坏了。
  check(`G6 计划全空（${PLAN_RELS().length} 份）：逐条 ✗、退 1、不崩（无 TypeError）`,
    r.code === 1 && !/TypeError/.test(r.err) && /份计划里都没有逐字节相同的块/.test(r.out),
    `exit=${r.code}，TypeError=${/TypeError/.test(r.err)}，恢复后 ${(run().code === 0) ? '副本复绿' : '副本未复绿'}`);
}

/* ── G12：`PLANS` 少一份 → 那一份名下的镜像必须**全部**喊出来（基线里有镜像的每一份都试）── */
{
  const orig = read(SCRIPT);
  // 每份计划名下有哪些镜像，从**基线输出**里现读（所有 `…：计划[段N] …` 的 OK 行），不手抄清单。
  // 为什么不能写死 `time.js` + `§K`，也不能只测段 3：每落地一格（Task 2 的 `codec.js` 与 `§L`、
  // 段 4 的 `§U`…）都要回来给这条断言加一项，忘加的那一格是**静默**的——断言照样绿，
  // 只是它不再覆盖新来的那块，而"每一份条目都是承重的"这句话恰好就对新来的那份不成立。
  // 2026-09-29 接段 4 时改的这一点：循环的集合取基线里真出现过的 tag，不是取 `PLANS` 写的那几行——
  // 一份还没有任何镜像的计划（段 4 落地前的那一格）本来就没有可摘的东西，硬凑一条断言会假红。
  const base = run();
  // `gm` 的 `m` 不是装饰：少了它 `^` 锚的是**整串**的开头，51 条 OK 行只命中第 1 条，
  // tag 集就只剩"段1"——这条断言会红在"别的计划没有镜像可摘"上，而真相是它自己没扫全。
  const tags = [...new Set([...base.out.matchAll(/^OK .+?：计划\[(段\d+)\]/gm)].map((m) => m[1]))];
  check(`G12 基线里逐份计划都有镜像可摘（读到 ${tags.length} 个 tag）`,
    tags.length >= 3, `tag 集=${tags.join(' / ') || '（空——基线没跑出 OK 行，整轮都无从谈）'}`);
  for (const tag of tags) {
    const want = [...base.out.matchAll(new RegExp(`^OK (.+?)：计划\\[${tag}\\]`, 'gm'))].map((m) => m[1]);
    const shorter = orig.replace(new RegExp(` {2}\\{ rel: '.+', tag: '${tag}' \\},\n`), '');
    check(`G12[${tag}] 变异落地（副本里的 PLANS 少这一行）`, shorter !== orig,
      `替换未命中——PLANS 那一行的形状变了（缩进/引号/顺序），这条牙齿抓不到任何事`);
    put(SCRIPT, shorter);
    const r = run();
    put(SCRIPT, orig);
    // 摘掉一份，它名下每块镜像（整文件与分节都算）在"剩下的计划"里都找不到全等块。
    // ✗ 行的前缀与 OK 行一致，按「：」切下标面逐个对，不做正则拼接（路径里的 `.` 与 `/` 会咬人）。
    const flagged = new Set(r.out.split('\n').filter((l) => l.startsWith('✗ ')).map((l) => l.slice(2).split('：')[0]));
    const missing = want.filter((t) => !flagged.has(t));
    check(`G12[${tag}] PLANS 少一份 → 名下 ${want.length} 块镜像全部 ✗ + 退 1`,
      r.code === 1 && want.length >= 1 && missing.length === 0,
      `exit=${r.code}，条数=${want.length}，未点名=${missing.join(', ') || '无'}`);
  }
}

/* ── G13：副本落点的三道拒绝（2026-09-29 随 `MIR` 那处缺陷的修复进来）─────── */
{
  const SELF = 'scripts/verify-plan-blocks-teeth.mjs';
  const selfSrc = fs.readFileSync(path.join(REPO, SELF), 'utf8');
  const CALL_SITE = 'const { dir: MIR, auto: MIR_AUTO } = resolveMirror();';
  /**
   * 截到守卫调用点为止、后面只接一句自报落点的源码。
   * 为什么截：三道拒绝全部发生在**模块顶层**，守卫之后的 `dirtyFingerprint()`、`mirror()`
   * 和整轮变异对它没有任何影响。不截的话 victim 会拿着同一本脚本往下跑完整轮 G 战役，
   * 而它自己的 G13 又再生一批 victim——递归虽然收敛（孙辈都死在守卫上），代价是把一条
   * "退不退 2"的判据放大成几分钟的白工。G13f 不截：那一刀要的正是要让脚本活着走到 `mirror()`。
   * @param {string} src 这本脚本的源码
   * @returns {string} 只跑到守卫的源码
   */
  const guardOnly = (src) => {
    const i = src.indexOf(CALL_SITE);
    if (i < 0) throw new Error('读不到 resolveMirror() 调用点：G13 的截断形状变了');
    return `${src.slice(0, i + CALL_SITE.length)}\n` +
      "console.log('GUARD_OK ' + MIR + ' auto=' + MIR_AUTO);\n";
  };
  /**
   * 建一棵一次性目录树：`<root>/repo` 当作"仓库"，`<root>/mirror` 是**仓库之外**的落点。
   * 两者必须是兄弟。2026-09-29 第一轮就栽在这里：G13d/e/g 把落点建成 `victim/mirror`，
   * 于是第三道拒绝（落点在仓库工作树里面）先响，那三条验的就不再是各自要验的那道——
   * 红得像是"守卫没用"，其实是"用例的形状自己撞在另一道上"。
   * @param {string} name 目录前缀
   * @param {{git?: boolean}} [opt] 要不要 `git init`——需要脚本活过顶层的
   *   `dirtyFingerprint()`（它跑三条 git 命令）才要；G13f 是唯一的用户，因为它必须走到 `mirror()`
   * @returns {{root: string, repo: string}} 外根与当作仓库的子目录
   */
  const V = (name, opt = {}) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `vpb2-g13-${name}-`));
    const repo = path.join(root, 'repo');
    fs.mkdirSync(repo, { recursive: true });
    if (opt.git) execFileSync('git', ['init', '-q'], { cwd: repo, stdio: 'ignore' });
    return { root, repo };
  };
  /**
   * 把某一版源码放进 `<repo>/scripts/`，按给定 `VPB_MIR` 真跑一次。
   * 为什么不在真仓库上试：守卫若真的被摘掉，那条路径下一步就是 `rmSync(REPO)`——
   * 那要把工作树连另一路会话的未提交改动一起删掉才算验完。victim 里只有这一本脚本，
   * 删干净也不伤任何人，而"摘掉守卫"那一刀正需要看它真会走到删目录这一步。
   * @param {string} repo 当作 REPO 的目录
   * @param {string} src 写进 repo 的脚本源码
   * @param {string} mir 传给 `VPB_MIR` 的落点
   * @returns {{code: number, out: string, survived: boolean}} 退码、合并输出、脚本自身是否还在
   */
  const runWith = (repo, src, mir) => {
    fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(repo, SELF), src);
    let code = 0, out = '';
    try {
      out = execFileSync('node', [path.join(repo, SELF)],
        { cwd: repo, env: { ...process.env, VPB_MIR: mir }, encoding: 'utf8' });
    } catch (e) {
      code = e.status === undefined ? -1 : e.status;
      out = `${String(e.stdout ?? '')}${String(e.stderr ?? '')}`;
    }
    return { code, out, survived: fs.existsSync(path.join(repo, SELF)) };
  };
  const refused = (r, phrase) => r.code === 2 && /副本落点被拒绝/.test(r.out) && r.out.includes(phrase)
    && r.survived;
  const guard = guardOnly(selfSrc);

  const v1 = V('same');
  const r1 = runWith(v1.repo, guard, v1.repo);
  check('G13a 落点==仓库（原地跑）→ 退 2、点名"仓库自己"、脚本自身未被删',
    refused(r1, '落点就是仓库自己'), `exit=${r1.code}，自身还在=${r1.survived}`);

  const v2 = V('inside');
  const r2 = runWith(v2.repo, guard, path.join(v2.repo, 'mirror'));
  check('G13b 落点落在工作树里面 → 退 2（变异会打在真实文件上）',
    refused(r2, '工作树里面'), `exit=${r2.code}，自身还在=${r2.survived}`);

  const v3 = V('outer');
  const r3 = runWith(v3.repo, guard, v3.root);
  check('G13c 仓库在落点里面 → 退 2（rmSync 会连带删掉真实仓库）',
    refused(r3, '在这份副本里面'), `exit=${r3.code}，自身还在=${r3.survived}`);

  const v4 = V('foreign');
  const foreign = path.join(v4.root, 'mirror');
  fs.mkdirSync(foreign, { recursive: true });
  fs.writeFileSync(path.join(foreign, 'keep.txt'), '别人的东西\n');
  const r4 = runWith(v4.repo, guard, foreign);
  check('G13d 落点是非空且无标记的目录 → 退 2、里面那份东西一字不伤',
    refused(r4, '那不是这本脚本留下的') && fs.existsSync(path.join(foreign, 'keep.txt'))
    && /工作树里面/.test(r4.out) === false,
    `exit=${r4.code}，报的是"没标记"那一档=${/那不是这本脚本留下的/.test(r4.out)}，keep.txt 还在=${fs.existsSync(path.join(foreign, 'keep.txt'))}`);

  const v5 = V('busy');
  const pinned = path.join(v5.root, 'mirror');
  fs.mkdirSync(pinned, { recursive: true });
  // pid 用本进程的父进程：它一定活着，等价于"另一路会话正占着这份副本"
  fs.writeFileSync(path.join(pinned, MARKER),
    `${JSON.stringify({ pid: process.ppid, repo: '/tmp/别的一棵树', at: new Date().toISOString() }, null, 2)}\n`);
  const r5 = runWith(v5.repo, guard, pinned);
  check('G13e 标记里的 pid 还活着 → 退 2（并发互删那一档，Task 8 记的第 2 笔账）',
    refused(r5, '正被另一路会话占着'), `exit=${r5.code}，自身还在=${r5.survived}`);

  // 牙齿：把整个落点守卫换成 2026-09-28 之前那句"直接用钉进来的路径"，同一个形状必须
  // **不再**退 2，而是照旧走到 rmSync、再从已被删的目录里拷文件而 ENOENT 崩——没有这一刀，
  // 上面五条红就成了"这条路径本来就走不通"，而不是"守卫拦住了"。摘单行不行：另外三道
  // 还会接着拦（那是纵深，不是 bug），所以变异要摘在**调用点**上。
  // 这一刀必须**不截断**（要它走到 mirror()），且 victim 要 `git init`：顶层那句
  // `dirtyFingerprint()` 在没有 .git 的目录里先崩（`not a git repository`，exit 1），
  // 量不到后面的 ENOENT——2026-09-29 第一轮就是这么虚红的。
  const callSite = CALL_SITE;
  const patched = selfSrc.replace(callSite,
    "const { dir: MIR, auto: MIR_AUTO } = { dir: path.resolve(process.env.VPB_MIR ?? '.'), auto: false };");
  check('G13f 变异本身落地了（守卫调用点换成旧行为）', patched !== selfSrc, `替换命中 ${patched !== selfSrc}`);
  const v6 = V('noguard', { git: true });
  const r6 = runWith(v6.repo, patched, v6.repo);
  check('G13f 摘掉守卫后同一形状不再退 2，而是 rmSync 掉自己再 ENOENT 崩（正是 09-28 那次现场）',
    r6.code !== 2 && !/副本落点被拒绝/.test(r6.out) && /ENOENT/.test(r6.out) && r6.survived === false,
    `exit=${r6.code}，有"落点被拒绝"=${/副本落点被拒绝/.test(r6.out)}，有 ENOENT=${/ENOENT/.test(r6.out)}，脚本自身还在=${r6.survived}`);

  const v7 = V('valid');
  const fresh = path.join(v7.root, 'mirror');
  const rv = runWith(v7.repo, guard, fresh);
  check('G13g 正对照：钉一个仓库之外、还不存在的新落点 → 守卫不拦、落点按钉进来的那条走',
    rv.code === 0 && rv.out.includes(`GUARD_OK ${fresh} auto=false`) && !/副本落点被拒绝/.test(rv.out),
    `exit=${rv.code}，自报落点=${rv.out.trim().split('\n').pop()}`);

  [v1, v2, v3, v4, v5, v6, v7].forEach((v) => fs.rmSync(v.root, { recursive: true, force: true }));
}

/* ── G14：清单漏项反查打在**段 5 那三本**上（第四份计划接手 §X–§Z，2026-10-01）────
 * G1 摘的是段 1 的 `build-prefix-data.mjs`，那一格证明的是"反查这件事存在"；而 §X–§Z 是最新
 * 一份计划才带来的镜像面——反查若只认老目标，"新登记的 `diff-core.js` 从清单里掉一行"照样全绿，
 * 那块 5.8 万字的镜像就静默不核了。所以这一刀必须打在段 5 的目标上。 */
{
  const orig = read(SCRIPT);
  const cut = "  'dev/js/tools/diff-core.js',\n";
  check('G14 变异落地（副本里的 FILE_TARGETS 少这一行）', orig.includes(cut), `锚点命中=${orig.includes(cut)}`);
  put(SCRIPT, orig.replace(cut, ''));
  const r = run();
  put(SCRIPT, orig);
  const back = run();
  check('G14 漏声明 diff-core → ✗ 漏网镜像 + 退 1（反查打到段 5 的镜像面）',
    r.code === 1 && /✗ 漏网镜像：dev\/js\/tools\/diff-core\.js/.test(r.out) && /没被核过/.test(r.out)
      && back.code === 0,
    `exit=${r.code}，点名=${/✗ 漏网镜像：dev\/js\/tools\/diff-core\.js/.test(r.out)}；还原后 exit=${back.code}`);
}

/* ── G15：§X 的标记行缩进 → 假"逐字节不等"那一族（2026-10-01）──────────────────
 * G2 打的是段 2 的 §E0，形状一样但落点不同：§X 起头一行缩进两格就不再是分节标记，于是 §X 那
 * 一千多行被判给 §W 的尾巴——**上一节逐字节不等（假红）、§X 从此没人核（假绿）**，而 `--fix`
 * 会拿被污染的那一节整块写回最新那份计划（Task 2 落地时规格被截成 119 行就是这一族的前身）。
 * 段 5 之后这一族的代价最大：那份计划是五份里最新的一本，也是最容易被人手工编辑的一本。 */
{
  const before = snapPlans();
  const t = read(SEGMENTED);
  const marked = t.replace('\n// ── §X ', '\n  // ── §X ');
  check('G15 变异落地（副本里 §X 的标记行缩进两格）', marked !== t, `替换命中=${marked !== t}`);
  put(SEGMENTED, marked);
  const r1 = run();
  const r2 = run(['--fix']);
  const unchanged = plansUnchanged(before);
  put(SEGMENTED, t);
  const back = run();
  check(`G15 §X 标记漂移：报分节可疑 + §X 那一节假不等、--fix 整轮不落笔、${PLAN_RELS().length} 份计划一字未动、恢复后复绿`,
    r1.code === 1 && /✗ 分节标记可疑/.test(r1.out) && /§X/.test(r1.out) && r2.code === 1
      && /因分节可疑/.test(r2.out) && !/已同步/.test(r2.out) && unchanged && back.code === 0,
    `读跑 exit=${r1.code} 点名标记=${/✗ 分节标记可疑/.test(r1.out)}、§X 露头=${/§X/.test(r1.out)}；`
      + `--fix exit=${r2.code} 拒写=${/因分节可疑/.test(r2.out)}、写了东西=${/已同步/.test(r2.out)}；`
      + `计划哈希未变=${unchanged}；恢复后 exit=${back.code}`);
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
// 收尾对副本的处理：默认那份（mkdtemp）只有全绿才删——红着删了就等于把尸检现场一起埋了；
// `VPB_MIR` 钉过的一律留着（那是调用方指定的位置，这本脚本不替人决定保留与否）。
if (MIR_AUTO && !failed.length) fs.rmSync(MIR, { recursive: true, force: true });
console.log(`副本落点：${MIR}——${MIR_AUTO ? (failed.length ? '红着，留着' : '全绿，已删') : 'VPB_MIR 钉的，不动'}`);
console.log(`\n${results.length - failed.length}/${results.length} 通过${failed.length ? `，失败：${failed.map((f) => f.id).join(' / ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
