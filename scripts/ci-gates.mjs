#!/usr/bin/env node
/**
 * 门禁运行器：把 `.github/workflows/jekyll.yml` 里那张 `gate '...' scripts/...` 清单
 * 原样解析出来、逐条执行、末尾汇总。给 PR 阶段的那条 workflow（.github/workflows/ci.yml）用。
 *
 * 为什么是「解析」而不是「在这里再写一份清单」：那 23 道门的顺序是有理由的
 * （三道 teeth 必须排在 check-seo 之后，因为 teeth 就地改源再还原会把 mtime 推到当下，
 * 而 check-seo 有一道「源比产物新就拒跑」的闸）。复制一份清单的那一刻，就有人往
 * 生产工作流里加了一道门、PR 门禁永远不跑它，而两边的输出都写着「全绿」——
 * 那种绿比没有门禁更危险，因为它是有出处的假话。
 *
 * 退出码（与 check-*.mjs 同一套口径）：
 *   0 = 选中的门全绿；
 *   1 = 有门红、清单解析不出东西、条数与文件里的 gate 行对不上、某条门禁的脚本不存在；
 *   2 = 运行器自己没跑完（某条门被信号杀死 / spawn 起不来）——「没跑完」不等于「判定为红」。
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
import { spawnSync } from 'node:child_process';
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
 * 一条 gate 调用。两种引号都认，因为「bash 合法而我漏读」的每一种写法都会变成
 * `✓ 22 道门禁全绿` 这种有出处的假话（2026-11-01 评审指出：双引号、`gate 'a' x && gate 'b' y`、
 * 名字里带转义单引号，bash 全收，而只认单引号的正则会安静地少读一条）。
 * 所以这里不靠形状去猜全不全，靠下面那道**计数对照**去兜：文件里凡是 `gate` 打头的命令行
 * （排除 `gate()` 函数定义与注释行）都必须被解析出来，少一条就红。
 */
const CALL_RE = /^\s+gate\s+(?:"([^"]+)"|'([^']+)')\s+(.+)$/;
const SHAPE_RE = /^\s+gate\s+(?:\(|["'])/;

const gates = [];
const shapeLines = [];
for (let i = 0; i < wfLines.length; i++) {
  const line = wfLines[i];
  if (/^\s*#/.test(line)) continue;
  if (/^\s+gate\s*\(/.test(line)) continue;
  if (!SHAPE_RE.test(line)) continue;
  shapeLines.push(i + 1);
  const m = CALL_RE.exec(line);
  if (!m) { die(`jekyll.yml:${i + 1} 是一条形如 gate 的调用，但这份运行器读不出名字与参数：${line.trim().slice(0, 80)}`); }
  const args = m[3].trim().split(/\s+/);
  if (args.some((a) => /[;&|]|&&|\|\|/.test(a))) {
    die(`jekyll.yml:${i + 1} 的 gate 调用里有复合命令（&& ; |）：一条里塞两个门会让第二个安静消失`);
  }
  gates.push({ name: m[1] || m[2], args, line: i + 1 });
}

/**
 * 计数对照：解析到的条数必须等于「文件里 gate 调用行的条数」。
 * 这一条防的不是今天，是明天有人加门时用了这份解析器不认的形状——那时输出会少一道门
 * 而依然全绿。口径与 USAGE.md「门禁条数按 grep 现数」同源。
 */
if (gates.length !== shapeLines.length) {
  die(`解析到 ${gates.length} 道，但文件里有 ${shapeLines.length} 行 gate 调用（行号 ${shapeLines.join(',')}）——有门被漏读，漏读的那道不会跑`);
}
if (gates.length === 0) die('解析到 0 道门禁：清单被搬走或改名了。0 道不算绿。');

const problems = [];
for (const g of gates) {
  const script = g.args.find((a) => a.startsWith('scripts/'));
  if (!script) { problems.push(`[${g.name}] 参数里没有 scripts/ 路径，无法确认它真的存在`); continue; }
  if (!fs.existsSync(path.join(ROOT, script))) problems.push(`[${g.name}] 指向 ${script}，仓库里没有这个文件`);
  if (path.resolve(ROOT, script) === SELF) problems.push(`[${g.name}] 指向本运行器自己：清单会递归拉起自己，CI 上表现为卡死到超时`);
}
/** 校验问题攒到最后一起报，而不是 exit(1) 在半路：后者会把「22 道其实全绿」这件事一起吞掉 */
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
let crashed = 0;
for (const g of selected) {
  process.stdout.write(`\n::group::${g.name}\n`);
  const r = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', ...g.args], {
    cwd: ROOT,
    stdio: 'inherit',
    encoding: 'utf8',
  });
  process.stdout.write('::endgroup::\n');
  if (r.error) { console.error(`✗ ${g.name} 起不来：${r.error.message}`); fails.push(g.name); crashed += 1; continue; }
  if (r.signal) { console.error(`✗ ${g.name} 被信号 ${r.signal} 杀死——这是没跑完，不是一次判定为红`); fails.push(g.name); crashed += 1; continue; }
  if (r.status !== 0) { console.error(`✗ ${g.name} 退出码 ${r.status}`); fails.push(g.name); }
}

const scope = ONLY ? `（--only=${ONLY} 选中的 ${selected.length}/${gates.length} 道）` : '';
if (fails.length) {
  console.error(`\n门禁红 ${fails.length} / ${selected.length} 道${scope}：${fails.join('、')}`);
  process.exit(crashed === fails.length && !ONLY ? 2 : 1);
}
console.log(`\n✓ ${selected.length} 道门禁全绿${scope}${ONLY ? '' : `（清单来自 ${WF_REL}，与生产部署跑的是同一张）`}`);
