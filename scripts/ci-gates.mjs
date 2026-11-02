#!/usr/bin/env node
/**
 * 门禁运行器：把 `.github/workflows/jekyll.yml` 里那张 `gate '...' scripts/...` 清单
 * 原样解析出来、逐条执行、末尾汇总。给 PR 阶段的那条 workflow（.github/workflows/ci.yml）用。
 *
 * 为什么是「解析」而不是「在这里再写一份清单」：那张清单的顺序是有理由的
 * （三道 teeth 必须排在 check-seo 之后，因为 teeth 就地改源再还原会把 mtime 推到当下，
 * 而 check-seo 有一道「源比产物新就拒跑」的闸）。复制一份清单的那一刻，就有人往
 * 生产工作流里加了一道门、PR 门禁永远不跑它，而两边的输出都写着「全绿」——
 * 那种绿比没有门禁更危险，因为它是有出处的假话。
 *
 * 退出码（与 check-*.mjs 同一套口径）：
 *   0 = 选中的门全绿；
 *   1 = 有门红、清单解析不出东西、驱动解析数与独立词元计数对不上、某条门禁的脚本不存在、
 *       某道门跑完把跟踪源改脏了没还原；
 *   2 = 运行器自己没跑完（某条门被信号杀死 / 超时 / spawn 起不来）——「没跑完」不等于「判定为红」。
 *       选了子集时也一样：唯一的失败是「没跑完」就退 2，不因为跑过别的门而降成 1。
 *
 * 用法：
 *   node scripts/ci-gates.mjs                    # 跑全部（cwd 必须是仓库根，清单里是相对路径）
 *   node scripts/ci-gates.mjs --list             # 只打印解析到的清单与道数，不执行
 *   node scripts/ci-gates.mjs --only=check-seo   # 只跑名字含该串的子串（本地复现单条红用）
 *
 * 牙齿：scripts/ci-gates-teeth.mjs（这一族是判据，判据就得能被证伪）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WF_REL = '.github/workflows/jekyll.yml';
const WF = path.join(ROOT, WF_REL);
const SELF = path.resolve(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const LIST_ONLY = argv.includes('--list');
const onlyArg = argv.find((x) => x.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice(7) : null;

const die = (msg, code = 1) => { console.error(`✗ ${msg}`); process.exit(code); };

if (!fs.existsSync(WF)) die(`读不到 ${WF_REL}——清单没有来源，这时候跑 0 道门比报错更危险`);

const wfLines = fs.readFileSync(WF, 'utf8').split('\n');

/**
 * 一条 gate 调用要么被跑到，要么把运行器自己弄红。
 *
 * 驱动条件是**词元级**的：整份文件里凡出现 `gate` 这个词元（前面不是单词字符，后面跟空白、
 * 引号或括号）的行，都必须正好解析出一道门。历史上三类漏读形状全部由这一条闭死：
 *   - `for f in a b; do gate "$f" …; done`、`if …; then gate …; fi`、`time gate …`
 *     —— 行首不是 `gate`，行锚定的驱动看不见它，于是输出「N 道门禁全绿」而那道门根本没跑；
 *   - `$'ansi'`、反引号、变量拼出来的名字 —— 认不出就不跑；
 *   - 一行里塞两个门 —— 第二个安静消失。
 * 交叉校验用的是**另一条代码路径**算出来的词元总数（不带 die、不带 continue），
 * 而不是同一个循环自己的计数：2026-11-01 的第一版修复拿自计数对照自己，那条断言永真、等于没写。
 * 它挡的是「将来有人给驱动加了一条跳过分支」，挡不住「词元模式本身认不出某种写法」——
 * 后者靠上面那条 die，两处都在，才谈得上闭死。
 */
const CALL_RE = /^\s+gate\s+(?:"([^"]+)"|'([^']+)')\s+(.+)$/;
const TOKEN_RE = /(?:^|[^\w-])gate(?=[\s('"])/g;
const DEF_RE = /^\s*gate\s*\(\s*\)\s*\{/;
const isNoiseLine = (line) => /^\s*#/.test(line) || DEF_RE.test(line);
const countTokens = (line) => (line.match(TOKEN_RE) || []).length;

const gates = [];
for (let i = 0; i < wfLines.length; i++) {
  const line = wfLines[i];
  if (isNoiseLine(line)) continue;
  const tokens = countTokens(line);
  if (tokens === 0) continue;
  if (tokens > 1) {
    die(`jekyll.yml:${i + 1} 一行里有 ${tokens} 个 gate 词元：一条里塞两个门会让第二个安静消失`);
  }
  const m = CALL_RE.exec(line);
  if (!m) {
    die(`jekyll.yml:${i + 1} 有 gate 调用但这份运行器跑不了它：不在行首，或读不出名字与参数（${line.trim().slice(0, 80)}）\n  宁可红，也不许跳过——跳过的那道门不会有人知道它没跑`);
  }
  const args = m[3].trim().split(/\s+/);
  if (args.some((a) => /[;&|]/.test(a))) {
    die(`jekyll.yml:${i + 1} 的 gate 调用里有复合命令（&& ; |）：一条里塞两个门会让第二个安静消失`);
  }
  gates.push({ name: m[1] || m[2], args, line: i + 1 });
}

/**
 * 一把独立的尺子：按**词**数，与上面那把按**行**数的不同源。
 * `GATES=$((GATES + 1))` 里的 `GATES` 是大写、不算；`gate()` 是定义、不算；注释行不算。
 * 于是「词在文件里出现过、却没被驱动解析成一道门」一定会让两处对不上。
 */
const WORD_RE = /\bgate\b/g;
const yard = wfLines.reduce((n, l) => (isNoiseLine(l) ? n : n + (l.match(WORD_RE) || []).length), 0);
if (gates.length !== yard) {
  die(`驱动解析到 ${gates.length} 道，按词数到 ${yard} 个 gate——有门被漏读，漏读的那道不会跑`);
}
if (gates.length === 0) die('解析到 0 道门禁：清单被搬走或改名了。0 道不算绿。');

const problems = [];
for (const g of gates) {
  const script = g.args.find((a) => a.startsWith('scripts/'));
  if (!script) { problems.push(`[${g.name}] 参数里没有 scripts/ 路径，无法确认它真的存在`); continue; }
  if (!fs.existsSync(path.join(ROOT, script))) problems.push(`[${g.name}] 指向 ${script}，仓库里没有这个文件`);
  if (path.resolve(ROOT, script) === SELF) problems.push(`[${g.name}] 指向本运行器自己：清单会递归拉起自己，CI 上表现为卡死到超时`);
}
/** 校验问题攒到最后一起报，而不是 exit(1) 在半路：后者会把「其余门其实全绿」这件事一起吞掉 */
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  die(`清单校验未过 ${problems.length} 条（上面逐条列出）；门禁一道都没跑`);
}

if (LIST_ONLY) {
  for (const g of gates) console.log(`  · ${g.name}  →  node ${g.args.join(' ')}`);
  console.log(`共 ${gates.length} 道，来源 ${WF_REL}`);
  process.exit(0);
}

const selected = ONLY ? gates.filter((g) => g.name.includes(ONLY) || g.args.some((a) => a.includes(ONLY))) : gates;
if (ONLY && selected.length === 0) die(`--only=${ONLY} 一条都没匹配上（--list 看清单）。匹配不到不算跑过。`);

const fails = [];
const dirtyBy = [];
let crashed = 0;
/**
 * 单道门的超时。没有它，一道挂死会吃掉 workflow 的 `timeout-minutes: 20`，
 * 而后面所有门根本没跑——输出停在半路，谁也不会把它读成「这道门红」。
 * 超时按「没跑完」算（exit 2），不按「判定为红」算。
 *
 * 默认值的两个读数，都记在这里，因为它们是同一道门在两种机器状态下的一生：
 *   · 顺序跑完整张清单时最慢的一道就是 `check-seo-teeth`：条数以台账自己打印的为准（不写在这里，
 *     写在这里就会漂——本轮实测从 188 涨到 191 只用了一天），2026-11-02 读数 275.8~297.8s
 *     （2026-11-02，全套 475s）。10 分钟 ≈ 它的 2.2 倍，又仍小于 job 的 20 分钟——挂死会被掐。
 *   · 同一道门在 600s 那一档被掐死过一次，那次是我自己把机器压住了：四个本地 node 服务
 *     加一个开着外站标签的 Chrome 在跟门禁抢 CPU。所以本地撞上这一发时用它自己的口径处理——
 *     `CI_GATES_TIMEOUT=1200000` 抬高，而不是把默认值改成陪跑的宽：默认值对的是 CI 那种
 *     「一条 job 顺序跑完 24 道」的机器，不是任何人的开发机。
 */
const GATE_TIMEOUT_MS = Number(process.env.CI_GATES_TIMEOUT || 10 * 60 * 1000);
/**
 * 牙齿会就地改跟踪源再还原。跑着的时候不能 git add，还原失败会留下脏树——
 * 而下一道门读的就是被改过的源，照样能报绿。所以每道门跑完对一次 git status：
 * 新出现的脏路径就是那道门没还原，记在一起报红。（只比基线之外的新增，
 * 本地本来就带着未提交内容跑这条时不会被误判。）
 */
const SRC_PATHS = ['_posts', '_data', '_includes', '_layouts', 'scripts', 'sw.js', 'tools.html', 'about.html'];
const srcDirty = () => {
  try {
    return new Set(execFileSync('git', ['status', '--porcelain', '--', ...SRC_PATHS], { encoding: 'utf8' })
      .split('\n').filter(Boolean));
  } catch {
    return null; // git 不可用（比如产物被单独取出来跑）：这一族自证降级为不判，不影响别的门
  }
};
const baseline = srcDirty();

for (const g of selected) {
  process.stdout.write(`\n::group::${g.name}\n`);
  const r = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', ...g.args], {
    cwd: ROOT,
    stdio: 'inherit',
    encoding: 'utf8',
    timeout: GATE_TIMEOUT_MS,
  });
  process.stdout.write('::endgroup::\n');
  if (r.error) { console.error(`✗ ${g.name} 起不来或超时（${Math.round(GATE_TIMEOUT_MS / 1000)}s）：${r.error.message}`); fails.push(g.name); crashed += 1; continue; }
  if (r.signal) { console.error(`✗ ${g.name} 被信号 ${r.signal} 杀死——这是没跑完，不是一次判定为红`); fails.push(g.name); crashed += 1; continue; }
  if (r.status !== 0) { console.error(`✗ ${g.name} 退出码 ${r.status}`); fails.push(g.name); }
  if (baseline) {
    const now = srcDirty();
    if (now) {
      const residue = [...now].filter((l) => !baseline.has(l));
      if (residue.length) {
        console.error(`✗ ${g.name} 跑完把跟踪源改脏了没还原：${residue.slice(0, 3).join(' | ')}`);
        dirtyBy.push(g.name);
      }
    }
  }
}

if (dirtyBy.length) {
  console.error(`\n有 ${dirtyBy.length} 道门跑完留下脏源（${dirtyBy.join('、')}）：牙齿该在 finally 里还原，不还原就等于后面的门读的是被改过的源`);
  process.exit(1);
}

const scope = ONLY ? `（--only=${ONLY} 选中的 ${selected.length}/${gates.length} 道）` : '';
if (fails.length) {
  console.error(`\n门禁红 ${fails.length} / ${selected.length} 道${scope}：${fails.join('、')}`);
  process.exit(crashed === fails.length ? 2 : 1);
}
console.log(`\n✓ ${selected.length} 道门禁全绿${scope}${ONLY ? '' : `（清单来自 ${WF_REL}，与生产部署跑的是同一张）`}`);
