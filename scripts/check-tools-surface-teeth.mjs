#!/usr/bin/env node
/**
 * check-tools-surface.mjs 的牙齿自证：对每组判据注入一处最小变异，确认门禁**会变红**，
 * 并且红在正确的那一组。全绿的门禁如果没有这一份台账，等于"没人验证过的报警器"。
 *
 * 变异分两类，代价不同：
 *   - 产物侧（收录 / 导航 / 部分 DOM）：把 _site 复制一份到影子目录再改，真仓库零风险；
 *   - 源侧（页面源 / 图标 / 其余 DOM）：门禁直读仓库源文件，只能就地改、跑完立即还原，
 *     所以每条变异都留内存备份，且脚本开头就注册 exit 钩子批量还原（中途 Ctrl-C 也不留脏文件）。
 *
 * 为什么这份台账进仓库而不是留在 /tmp：同 `verify-plan-blocks.mjs` 的理由——"门禁有没有牙"
 * 是一次实证，实证脚本不在仓库里就等于没做过，换台机器、换个会话就没人能重跑。
 * 段 3 / 段 4 各追加一条 ready 条目之后，这 19 组必须原样重跑（它读的是数据源与产物，
 * 不写死"只有 idcard 这一页"），新增一层判据时照例往 `cases` 里加一条同名变异。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GATE = path.join(ROOT, 'scripts/check-tools-surface.mjs');
// 每次跑各给一份 scratch：/tmp 下共用一个目录名会被并行的另一路（子智能体、或另一个会话的
// 同一条命令）rm -rf 掉，那一轮的测量整批作废，而且作废方式是"影子文件不见了"式的崩。
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-teeth-'));
const SHADOW = path.join(SCRATCH, '_site');
const backups = new Map();

/** 就地改仓库源文件：先备份，改完注册还原 */
function mutateSrc(rel, fn) {
  const p = path.join(ROOT, rel);
  if (!backups.has(rel)) backups.set(rel, fs.readFileSync(p));
  fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8')));
}
function restoreAll() {
  for (const [rel, buf] of backups) fs.writeFileSync(path.join(ROOT, rel), buf);
  backups.clear();
}
process.on('exit', () => {
  restoreAll();
  fs.rmSync(SCRATCH, { recursive: true, force: true });
});
process.on('SIGINT', () => { restoreAll(); process.exit(130); });

/** 影子产物：每轮从真 _site 重拷，变异只落在副本上（SCRATCH 每次进程一份，不与他人共用） */
function freshShadow(mutator) {
  fs.rmSync(SHADOW, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(SHADOW), { recursive: true });
  fs.cpSync(path.join(ROOT, '_site'), SHADOW, { recursive: true });
  mutator();
}
const shadowEdit = (rel, fn) => {
  const p = path.join(SHADOW, rel);
  fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8')));
};

/**
 * baseurl 从产物自己的 canonical 现推（与门禁 `deriveBase()` 同一种取法），不把 `/better-blog`
 * 写死：写死的后果是站点换挂载路径后这条变异静默不命中，而 `String.replace` 找不到目标时
 * **原样返回**，于是那一组变异变成"注入nothing、门禁仍绿"的假牙。
 */
function baseFromArtifact() {
  const h = fs.readFileSync(path.join(ROOT, '_site/tools/idcard.html'), 'utf8');
  const m = /<link rel="canonical" href="([^"]+)"/.exec(h);
  if (!m) throw new Error('产物里没有 canonical，反向变异无从构造带前缀的地址');
  return new URL(m[1]).pathname.replace(/tools\/idcard\.html$/, '');
}

function runGate(siteOverride) {
  const args = [GATE];
  if (siteOverride) args.push(`--site=${siteOverride}`);
  const r = spawnSync('node', args, { encoding: 'utf8', maxBuffer: 16 << 20 });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

const cases = [
  {
    name: 'yml title 与 front matter 漂移',
    group: '页面源',
    src: () => mutateSrc('_data/onlineTools.yml', (s) => s.replace('title: 身份证号校验与生成 · 统一社会信用代码', 'title: 身份证号校验与生成')),
  },
  {
    name: 'yml url 与 front matter permalink 不同源',
    group: '页面源',
    src: () => mutateSrc('_data/onlineTools.yml', (s) => s.replace('url: /tools/idcard.html', 'url: /tools/id-card.html')),
  },
  {
    name: 'sitemap 少一条（Liquid 循环被写法吞掉的形状）',
    group: '收录',
    artifact: () => shadowEdit('sitemap.xml', (s) => s.replace(/\s*<url>\s*<loc>[^<]*tools\/idcard\.html<\/loc>[\s\S]*?<\/url>/, '')),
  },
  {
    name: 'llms.txt 少一行',
    group: '收录',
    artifact: () => shadowEdit('llms.txt', (s) => s.split('\n').filter((l) => !/tools\/idcard\.html/.test(l)).join('\n')),
  },
  {
    name: 'tools.html 的面板锚点清单缺一块面板',
    group: '收录',
    artifact: () => shadowEdit('tools.html', (s) => s.replace(/href="[^"]*tools\/idcard\.html#uscc"/, 'href="#online-idcard"')),
  },
  {
    name: 'index-all 删掉在线工具那一节',
    group: '收录',
    artifact: () => shadowEdit('index-all.html', (s) => s.replace(/<section class="cat-section" id="onetools">[\s\S]*?<\/section>/, '')),
  },
  {
    name: '导航出现两个 is-current',
    group: '导航',
    artifact: () => shadowEdit('tools/idcard.html', (s) => s.replace('<li class="nav-item"', '<li class="nav-item is-current"')),
  },
  {
    name: '父项缺 aria-current="true"',
    group: '导航',
    artifact: () => shadowEdit('tools/idcard.html', (s) => s.replace('class="nav-link" href="/better-blog/tools.html" aria-current="true"', 'class="nav-link" href="/better-blog/tools.html"')),
  },
  {
    name: '下拉当前项缺 aria-current="page"',
    group: '导航',
    artifact: () => shadowEdit('tools/idcard.html', (s) => s.replace('href="/better-blog/tools/idcard.html" aria-current="page"', 'href="/better-blog/tools/idcard.html"')),
  },
  {
    name: '图标退回 currentColor',
    group: '图标',
    src: () => mutateSrc('assets/img/tools/idcard-tool.svg', (s) => s.replace('stroke="#737B85"', 'stroke="currentColor"')),
  },
  {
    name: '图标描边压到 3:1 以下',
    group: '图标',
    src: () => mutateSrc('assets/img/tools/idcard-tool.svg', (s) => s.replace('stroke="#737B85"', 'stroke="#C8CCD2"')),
  },
  {
    name: '产物缺一个控件 id',
    group: 'DOM',
    artifact: () => shadowEdit('tools/idcard.html', (s) => s.replace('id="tk-in-uscc-registry"', 'id="tk-in-uscc-registy"')),
  },
  {
    name: '骨架多出 spec 里没有的开关目标',
    group: 'DOM',
    artifact: () => shadowEdit('tools/idcard.html', (s) => s.replace('id="tk-when-idcard-birth" data-tk-when="custom"', 'id="tk-when-idcard-birth" data-tk-when="custom extra"')),
  },
  {
    name: 'data-tk-options 的取值与 spec 不一致',
    group: 'DOM',
    artifact: () => shadowEdit('tools/idcard.html', (s) => s.replace('id="tk-in-bankcard-bank" data-tk-options="banks"', 'id="tk-in-bankcard-bank" data-tk-options="banklist"')),
  },
  {
    name: '入口 CONTAINER_ID 与 yml prefix 脱钩',
    group: 'DOM',
    src: () => mutateSrc('dev/js/toolIdcard.js', (s) => s.replace("const CONTAINER_ID = 'tk-workspace';", "const CONTAINER_ID = 'tk-box';")),
  },
  {
    name: 'planned 条目混进收录面',
    group: '收录-反向',
    // 造一条 status: planned 的条目，url 指向**产物里已经存在**的那页：反向判据比的是
    // "planned 的 url 有没有出现在四处收录面上"，不需要真有一张 planned 的页面存在。
    src: () => {
      const ghostUrl = `${baseFromArtifact()}tools/idcard.html`;
      mutateSrc('_data/onlineTools.yml', (s) => s.replace('  url: /tools/idcard.html', `  url: /tools/idcard.html\n- slug: ghost\n  url: ${ghostUrl}\n  name: 幽灵\n  tagline: t\n  title: tt\n  h1: 幽灵\n  icon: /assets/img/tools/idcard-tool.svg\n  status: planned\n  prefix: gh\n  desc: d\n  panels: []`));
    },
  },
  {
    name: '文章页凭空多出一个 is-current',
    group: '导航-全站',
    artifact: () => shadowEdit('2016/06/18/hello-jekyll.html', (s) => s.replace('<li class="nav-item"', '<li class="nav-item is-current"')),
  },
  {
    name: '首页父项的 aria-current="page" 被摘掉',
    group: '导航-全站',
    // 不把 baseurl 写进匹配串：这条变异改的是"精确相等那一档"，与站点挂在根还是 /better-blog
    // 下无关（写死 baseurl 的后果是换 _config.yml 一改口径，这组变异静默不命中，
    // 而 `s.replace` 找不到目标时是**原样返回**的——门禁于是基线仍绿，红的是"假牙"那一档）。
    artifact: () => shadowEdit('index.html', (s) =>
      s.replace(/(<a class="nav-link" href="[^"]*")\s+aria-current="page"/, '$1')),
  },
  {
    name: '高亮从「工具箱」挪到「分类」',
    group: '导航-全站',
    artifact: () => shadowEdit('tools.html', (s) => s
      .replace('<li class="nav-item has-sub is-current"', '<li class="nav-item has-sub"')
      .replace('<li class="nav-item"', '<li class="nav-item is-current"')),
  },
];

let pass = 0;
const problems = [];

// 先自证基线：真仓库 + 真产物必须绿，否则后面的"变红"没有意义
const base = runGate(null);
console.log(`基线（真 _site）：exit=${base.code}`);
if (base.code !== 0) {
  console.log('✗ 基线不绿，先修门禁再说牙齿：\n' + base.out);
  process.exit(1);
}

for (const c of cases) {
  backups.clear();
  try {
    if (c.src) c.src();
    const got = c.artifact ? (freshShadow(c.artifact), runGate(SHADOW)) : runGate(null);
    const hitGroup = got.out.includes(`[${c.group}]`);
    if (got.code === 0) problems.push(`✗ ${c.name}：注入后门禁仍是绿的（假牙）`);
    else if (!hitGroup) problems.push(`✗ ${c.name}：红了但没红在「${c.group}」组：\n${got.out.split('\n').filter((l) => l.startsWith('✗')).slice(0, 3).join('\n')}`);
    else { pass += 1; console.log(`✓ ${c.name} → [${c.group}]`); }
  } catch (e) {
    problems.push(`✗ ${c.name}：变异脚本自己崩了 — ${e.message}`);
  } finally {
    restoreAll();
  }
}
console.log(`\n牙齿台账：${pass}/${cases.length} 组变异如期变红`);
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
if (!fs.existsSync(path.join(ROOT, '_site'))) { console.log('✗ 产物目录不见了'); process.exit(1); }
// 还原自证：变异全部撤销后基线必须重新绿
const after = runGate(null);
console.log(after.code === 0 ? '✓ 全部变异已还原，复跑基线仍绿' : '✗ 还原后基线仍红，检查 .bak 是否漏还原：\n' + after.out);
process.exit(after.code === 0 ? 0 : 1);
