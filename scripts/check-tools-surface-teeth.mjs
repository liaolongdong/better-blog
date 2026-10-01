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
 * 段 3 / 段 4 各追加一条 ready 条目之后，这 21 组必须原样重跑（它读的是数据源与产物，
 * 不写死"只有 idcard 这一页"），新增一层判据时照例往 `cases` 里加一条同名变异。
 * 组数以末尾台账打印的 `cases.length` 为准，这句里的数只是行文，别拿它当判据。
 *
 * 段 3 Task 7 在 `idcardCases` 之后追加了 `codecCases`：编码页每一条判据都要有自己的同名变异，
 * 因为"门禁循环里带了第二页"和"第二页真的被核到"是两件事——只有 idcard 那一组变异时，
 * 把 codec 条目的 spec 指针写错、或把它的 panels 顺序挪一位，台账仍是全绿的假牙。
 *
 * 段 4 Task 7 再加 `jsonCases`，理由同一档但更尖：JSON 页走的是**另一支布局**（`panels: []`、
 * 清单在装配层、没有索引条），分支代码最容易悄悄失效的地方正是分支自己。所以这一组除了照抄
 * 前两页的同名变异，还带三把分支专用的刀（T-a 拼错 `layout`、T-b 切断清单来源、T-c 删掉 `layout`）
 * 和一把新判据的刀（按钮文案 ↔ `JSON_ACTIONS.label`）。T-b 那一组是本份台账里唯一动**门禁自己**
 * 的变异，它必须配 `expect` 才有效：分支失效时会同时红好几处，红在"数据源自洽"那一句证不了
 * 判据还在数产物——只有红在「多出这些控件」那一句，才说明 `need` 之外的那一刀真的在工作。
 *
 * 段 5 Task 6 起 `diffCases`，并给徽章那一族换了一种数法。前四段每加一页就是"照抄一套同名变异"，
 * 这次照抄之外还多一件事：第四条条目登记进去以后，`tools.html` 上**同一个字面量出现了两次**
 * （json 与 diff 都 `14 个动作`，idcard 与 codec 都 `5 块面板`），于是原先"整页找得到就算对"的
 * 三条判据（徽章 / 面板锚点 / 纯文本要点）集体失去牙——把任何一节改坏，另一节还替它答"是"。
 * 台账里那句「注入后门禁仍是绿的（假牙）」就是这一格抓出来的。判据的作用域因此收到
 * `tools.html` 每一小节自己那一段（见 check-tools-surface.mjs 的 `toolsSectionOf`），
 * 变异刀同步改成 `badgeInSection`：按 `id="online-<slug>"` 定位，不靠出现顺序，且没命中就抛。
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
 * 改 `tools.html` 里**某一小节自己**的那枚徽章，别的小节一眼不动。
 *
 * 为什么变异刀要跟着判据一起改成"节内"（段 5 Task 6）：徽章判据原本拿整页 `test` 比，
 * 第四条条目登记后 json 与 diff 的徽章是同一个字面量（都 `14 个动作`），整页 replace
 * 只改得到排在前面的那一处，而"另一处仍在"恰好让整页判据仍是绿的——这就是台账里
 * 「注入后门禁仍是绿的（假牙）」那一句。定位用 `id="online-<slug>"` 这个节标记而不是
 * 出现次数：yml 里条目顺序一改，"第一处"是谁就变了，那一刀会静默挪到别的条目上去。
 *
 * 没命中就抛：`String.replace` 找不到目标是**原样返回**的，静默 no-op 正是假牙的制造工序，
 * 抛出来会让这一组红成"变异脚本自己崩了"，台账不会把它记成通过。
 */
function badgeInSection(s, slug, from, to) {
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const out = s.replace(new RegExp(`(id="online-${esc(slug)}"[\\s\\S]*?)<li>${esc(from)}</li>`), `$1<li>${to}</li>`);
  if (out === s) throw new Error(`tools.html 的 online-${slug} 小节里没有 <li>${from}</li>，这一刀作废`);
  return out;
}

/**
 * 把 `tools.html` 里某一小节**连头带尾**删掉，用来打"整节不在"那一判。
 * 边界算法与门禁那边的 `toolsSectionOf` 同一条（按 `<section>`/`</section>` 计数配平），
 * 这是刻意的：两把尺同源，这一刀才证得了"门禁找的那一段就是页面上那一段"——
 * 各写一套边界，早退那一格（找不到节只记一句、不再逐格比）就成了没人核过的分支。
 */
function dropSection(s, slug) {
  const marker = `<section class="tool-section tool-section--online" id="online-${slug}"`;
  const at = s.indexOf(marker);
  if (at < 0) throw new Error(`tools.html 里没有 online-${slug} 那一节，这一刀作废`);
  let depth = 0;
  const tags = /<\/?section\b[^>]*>/g;
  tags.lastIndex = at;
  for (let m = tags.exec(s); m; m = tags.exec(s)) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return s.slice(0, at) + s.slice(tags.lastIndex);
  }
  throw new Error(`online-${slug} 那一节的 <section> / </section> 不配平，这一刀作废`);
}

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

/**
 * 把编码条目里的某一面板整块挪到另一面板之前。
 * 顺序就是索引条顺序 = `data-tk-ids` = 禁用脚本时的文档顺序，动一位必须红在「DOM」组
 * （段 3 §0.3 点名的那把刀：解耦之前这条判据是拿整页 `PANEL_IDS` 比的，第二条条目一登记
 * 就红，红了也说不清是谁的顺序错了）。
 * 分块用前视断言，每块块首保留那个换行，拼回去时不必再操心空行与缩进。
 */
function moveCodecPanel(slug, before) {
  mutateSrc('_data/onlineTools.yml', (s) => {
    const head = (b) => `\n    - slug: ${b}\n`;
    const blocks = s.split(/(?=\n {4}- slug: )/);
    const from = blocks.findIndex((b) => b.startsWith(head(slug)));
    if (from < 0) throw new Error(`找不到面板块 ${slug}，这一刀作废`);
    const [moved] = blocks.splice(from, 1);
    const to = blocks.findIndex((b) => b.startsWith(head(before)));
    if (to < 0) throw new Error(`找不到面板块 ${before}，这一刀作废`);
    blocks.splice(to, 0, moved);
    return blocks.join('');
  });
}

const idcardCases = [
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
    // 2026-09-28 的真实现场：注释里写了带 var 前缀的令牌名，整份 SVG 因此不是合法 XML，
    // <img> 加载它得到的是破图，而当时五组判据全绿——这条变异钉住那层盲区。
    name: '图标注释里出现连续两个连字符',
    group: '图标',
    src: () => mutateSrc('assets/img/tools/idcard-tool.svg', (s) => s.replace('画成描边图形而不是图标字体', '画成描边图形而不是 --surface 那种图标字体')),
  },
  {
    name: '图标根节点没有 xmlns',
    group: '图标',
    src: () => mutateSrc('assets/img/tools/idcard-tool.svg', (s) => s.replace('<svg xmlns="http://www.w3.org/2000/svg"', '<svg')),
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

/**
 * 段 3 Task 7 追加：编码页的同名变异。
 *
 * 为什么不能只跑上面那一组就收工——那 21 条全部落在 idcard 那一页上，它们证明的是
 * "门禁对第一页有牙"。第二页登记进数据源之后，"循环里多跑了一次"与"多跑的那一次真在比"
 * 是两件事：spec 指针写错页、panels 顺序挪一位、骨架少一个控件 id，这三样在当时那份台账里
 * 一条都抓不到，而它们全是运行时才红的错。所以每条判据都照抄一份编码页的。
 */
const codecCases = [
  {
    name: '编码页 yml title 与 front matter 漂移',
    group: '页面源',
    src: () => mutateSrc('_data/onlineTools.yml', (s) => s.replace('title: 时间戳转换 · Base64 编解码 · MD5 摘要', 'title: 时间戳转换 · Base64 编解码')),
  },
  {
    name: '编码页 yml url 与 front matter permalink 不同源',
    group: '页面源',
    src: () => mutateSrc('_data/onlineTools.yml', (s) => s.replace('url: /tools/codec.html', 'url: /tools/codec-c.html')),
  },
  {
    name: 'sitemap 少编码页那一条',
    group: '收录',
    artifact: () => shadowEdit('sitemap.xml', (s) => s.replace(/\s*<url>\s*<loc>[^<]*tools\/codec\.html<\/loc>[\s\S]*?<\/url>/, '')),
  },
  {
    name: 'llms.txt 少编码页那一行',
    group: '收录',
    artifact: () => shadowEdit('llms.txt', (s) => s.split('\n').filter((l) => !/tools\/codec\.html/.test(l)).join('\n')),
  },
  {
    name: 'tools.html 的编码小节缺一块面板锚点',
    group: '收录',
    artifact: () => shadowEdit('tools.html', (s) => s.replace(/href="[^"]*tools\/codec\.html#digest"/, 'href="#online-codec"')),
  },
  {
    name: '编码页导航出现两个 is-current',
    group: '导航',
    artifact: () => shadowEdit('tools/codec.html', (s) => s.replace('<li class="nav-item"', '<li class="nav-item is-current"')),
  },
  {
    // 不把 baseurl 写进匹配串：同上面那条 aria 变异一条规矩，换挂载路径时这刀不能静默不命中。
    name: '编码页下拉当前项缺 aria-current="page"',
    group: '导航',
    artifact: () => shadowEdit('tools/codec.html', (s) => s.replace(/(href="[^"]*tools\/codec\.html")\s+aria-current="page"/, '$1')),
  },
  {
    name: '编码图标退回 currentColor',
    group: '图标',
    src: () => mutateSrc('assets/img/tools/codec-tool.svg', (s) => s.replace('stroke="#737B85"', 'stroke="currentColor"')),
  },
  {
    name: '编码图标描边压到 3:1 以下',
    group: '图标',
    src: () => mutateSrc('assets/img/tools/codec-tool.svg', (s) => s.replace('stroke="#737B85"', 'stroke="#C8CCD2"')),
  },
  {
    name: '编码页产物缺一个控件 id',
    group: 'DOM',
    artifact: () => shadowEdit('tools/codec.html', (s) => s.replace('id="tk-in-regex-limit"', 'id="tk-in-regex-limi"')),
  },
  {
    name: '编码页骨架多出 spec 里没有的开关目标',
    group: 'DOM',
    artifact: () => shadowEdit('tools/codec.html', (s) => s.replace('id="tk-when-digest-upload" data-tk-when="file"', 'id="tk-when-digest-upload" data-tk-when="file extra"')),
  },
  {
    // 反向那一格（产物有、spec 没有）单独一刀：编码页的下拉选项全在构建期写死，
    // CODEC_SPEC 的 `options` 是白名单数组而不是标记 token。数组一旦被当成标记收，
    // 这一刀与上面那一刀会一起红在错的地方——所以两向都要有证据。
    name: '编码页骨架误带证件页那个下拉标记',
    group: 'DOM',
    artifact: () => shadowEdit('tools/codec.html', (s) => s.replace('id="tk-in-base64-mode"', 'id="tk-in-base64-mode" data-tk-options="banks"')),
  },
  {
    name: '编码条目 panels 顺序挪一位',
    group: 'DOM',
    src: () => moveCodecPanel('digest', 'timestamp'),
  },
  {
    name: '编码条目的 spec 指针指到证件页那本模块',
    group: 'DOM',
    src: () => mutateSrc('_data/onlineTools.yml', (s) => s.replace(
      'module: dev/js/tools/codecWorkbench.js\n    table: CODEC_SPEC\n    ids: CODEC_PANEL_IDS',
      'module: dev/js/tools/workbench.js\n    table: WORKBENCH_SPEC\n    ids: PANEL_IDS',
    )),
  },
  {
    name: '编码页入口 CONTAINER_ID 与 yml prefix 脱钩',
    group: 'DOM',
    src: () => mutateSrc('dev/js/toolCodec.js', (s) => s.replace("const CONTAINER_ID = 'tk-workspace';", "const CONTAINER_ID = 'tk-box';")),
  },
  {
    // 段 5 Task 6 加：徽章判据从"整页出现过"改成"节内出现过"之后，panels 支也得有自己的
    // 那一刀——证件页与编码页的徽章同样是同一个字面量（都 `5 块面板`），"改第一处"只碰得到
    // 排在前面的证件页，编码页那一节被改坏时台账仍是绿的。
    name: '编码小节徽章被改（与证件小节同串，整页 replace 碰不到这一处）',
    group: '收录',
    artifact: () => shadowEdit('tools.html', (s) => badgeInSection(s, 'codec', '5 块面板', '4 块面板')),
  },
];

/**
 * 段 4 Task 7 追加：JSON 页的同名变异 + `layout` 分支那一族新判据。
 *
 * 前两页那 36 组证明的是"门禁对面板式页面有牙"。这一页是**另一种形状**（`panels: []`、
 * 清单在装配层、没有索引条、多一枚按钮文案表），而分支代码最容易长的地方正是分支自己：
 * `layout` 拼错一个字母就退回面板支，`panels: []` 让控件与开关那一整族**空转**，门禁全绿、
 * 页面少一排按钮。所以这一组不只照抄前两页，还专门有"把分支弄失效"和"把清单来源改掉"的刀。
 *
 * `expect` 那一格是这一组独有的：分支失效时会有好几处同时红，只判"红了"等于没判——
 * 必须红在**能证明判据还在数产物**的那一句上（「多出这些控件」），而不是红在
 * 数据源自己跟自己比的那一句（那种红，判据空转时照样会红，证不了任何东西）。
 */
const jsonCases = [
  {
    name: 'JSON 页 yml title 与 front matter 漂移',
    group: '页面源',
    src: () => mutateSrc('_data/onlineTools.yml', (s) => s.replace('title: JSON 在线格式化与校验 · 转 YAML/XML/CSV', 'title: JSON 在线格式化与校验')),
  },
  {
    name: 'JSON 页 yml url 与 front matter permalink 不同源',
    group: '页面源',
    src: () => mutateSrc('_data/onlineTools.yml', (s) => s.replace('url: /tools/json.html', 'url: /tools/json-x.html')),
  },
  {
    name: 'sitemap 少 JSON 页那一条',
    group: '收录',
    artifact: () => shadowEdit('sitemap.xml', (s) => s.replace(/\s*<url>\s*<loc>[^<]*tools\/json\.html<\/loc>[\s\S]*?<\/url>/, '')),
  },
  {
    name: 'llms.txt 少 JSON 页那一行',
    group: '收录',
    artifact: () => shadowEdit('llms.txt', (s) => s.split('\n').filter((l) => !/tools\/json\.html/.test(l)).join('\n')),
  },
  {
    name: 'JSON 条目的 features 整块删掉（panels 已是空）',
    group: '收录',
    src: () => mutateSrc('_data/onlineTools.yml', (s) => s.replace(/ {2}features:\n(?: {4}- .*\n)+/, '')),
  },
  {
    name: '证件页那条误写 features（panels 非空，模板不读这一格）',
    group: '收录',
    src: () => mutateSrc('_data/onlineTools.yml', (s) => s.replace('  url: /tools/idcard.html', '  url: /tools/idcard.html\n  features:\n    - 没人读的一条')),
  },
  {
    name: 'tools.html 的徽章数字与数据源脱钩（改模板不改 yml 的形状）',
    group: '收录',
    artifact: () => shadowEdit('tools.html', (s) => badgeInSection(s, 'json', '14 个动作', '12 个动作')),
  },
  {
    // 判据改成"段内比"之后新增的一格分支：整节不在 → 只记一句「没有这一条的小节」然后交回，
    // 不再逐格比（不然一节缺席会连带报出五条"这格里找不到"，红字淹掉真正那一句）。
    // 这一刀钉的就是那个早退**本身有牙**，而不是把整个条目静默放过。
    name: 'tools.html 少整节（JSON 那一小节连头带尾删掉）',
    group: '收录',
    expect: '没有这一条的 tool-section--online 小节',
    artifact: () => shadowEdit('tools.html', (s) => dropSection(s, 'json')),
  },
  {
    name: 'tools.html 的纯文本要点少吐一条（循环吞掉某一格）',
    group: '收录',
    artifact: () => shadowEdit('tools.html', (s) => s.replace(/<li>[^<]*树视图可折叠展开[^<]*<\/li>\n?/, '')),
  },
  {
    name: 'JSON 页导航出现两个 is-current',
    group: '导航',
    artifact: () => shadowEdit('tools/json.html', (s) => s.replace('<li class="nav-item"', '<li class="nav-item is-current"')),
  },
  {
    name: 'JSON 页下拉当前项缺 aria-current="page"',
    group: '导航',
    artifact: () => shadowEdit('tools/json.html', (s) => s.replace(/(href="[^"]*tools\/json\.html")\s+aria-current="page"/, '$1')),
  },
  {
    name: 'JSON 图标退回 currentColor',
    group: '图标',
    src: () => mutateSrc('assets/img/tools/json-tool.svg', (s) => s.replace('stroke="#737B85"', 'stroke="currentColor"')),
  },
  {
    name: 'JSON 图标描边压到 3:1 以下',
    group: '图标',
    src: () => mutateSrc('assets/img/tools/json-tool.svg', (s) => s.replace('stroke="#737B85"', 'stroke="#C8CCD2"')),
  },
  {
    name: 'T-a：layout 少写一个 c（退回面板支就是控件判据空转）',
    group: 'DOM',
    src: () => mutateSrc('_data/onlineTools.yml', (s) => s.replace('  layout: workbench', '  layout: panel')),
  },
  {
    name: 'T-c：删掉 layout 而 panels 是空的',
    group: 'DOM',
    src: () => mutateSrc('_data/onlineTools.yml', (s) => s.replace('  layout: workbench\n', '')),
  },
  {
    name: 'T-d：yml actions 写成 15（动作清单的第二个声明处漂了）',
    group: 'DOM',
    src: () => mutateSrc('_data/onlineTools.yml', (s) => s.replace('  actions: 14', '  actions: 15')),
  },
  {
    name: 'spec.actions 指到一个不存在的导出名',
    group: 'DOM',
    src: () => mutateSrc('_data/onlineTools.yml', (s) => s.replace('    actions: JSON_ACTIONS', '    actions: JSON_ACTIONSS')),
  },
  {
    name: '产物缺行号槽 id（updateGate 取到 null 就安静地什么都不画）',
    group: 'DOM',
    expect: '产物里缺少这些 id：jt-gutter-workbench-doc',
    artifact: () => shadowEdit('tools/json.html', (s) => s.replace('id="jt-gutter-workbench-doc"', 'id="jt-gutter-workbench-do"')),
  },
  {
    name: '按钮文案与 JSON_ACTIONS 的 label 不同字',
    group: 'DOM',
    expect: '#jt-btn-workbench-yamlOut 的文案是 "转 YAML 文件"',
    artifact: () => shadowEdit('tools/json.html', (s) => s.replace('id="jt-btn-workbench-yamlOut">转 YAML</button>', 'id="jt-btn-workbench-yamlOut">转 YAML 文件</button>')),
  },
  {
    name: '骨架私自多一枚按钮（装配层不会给它接线）',
    group: 'DOM',
    expect: '多出这些控件/开关/按钮/节点 id',
    artifact: () => shadowEdit('tools/json.html', (s) => s.replace(
      'id="jt-btn-workbench-ts">TypeScript</button>',
      'id="jt-btn-workbench-ts">TypeScript</button><button class="tk-btn" type="button" id="jt-btn-workbench-pretty">美化</button>',
    )),
  },
  {
    name: 'data-jt-ids 与 JSON_PANEL_IDS 不同名',
    group: 'DOM',
    artifact: () => shadowEdit('tools/json.html', (s) => s.replace('data-jt-ids="workbench"', 'data-jt-ids="wb"')),
  },
  {
    name: 'JSON 页入口 CONTAINER_ID 与 yml prefix 脱钩',
    group: 'DOM',
    src: () => mutateSrc('dev/js/toolJson.js', (s) => s.replace("const CONTAINER_ID = 'jt-workspace';", "const CONTAINER_ID = 'jt-box';")),
  },
  {
    // 这一刀动的是**门禁自己**：把 `layout` 那一支的清单来源写回 `ymlPanels`，分支等于失效。
    // 必须仍红，而且红的必须是「多出这些控件」——它证明判据在数产物上的 id；如果红的是
    // 数据源自洽那一句，就等于"分支失效也没人看见"，那一族的牙是假的。
    name: 'T-b：panelIds 退回 ymlPanels（workbench 支的清单来源被切断）',
    group: 'DOM',
    expect: '多出这些控件/开关/按钮/节点 id',
    src: () => mutateSrc('scripts/check-tools-surface.mjs', (s) => s.replace(
      'const panelIds = layout === \'workbench\' ? spec.ids : ymlPanels;',
      'const panelIds = ymlPanels;',
    )),
  },
  // ── 段 5 Task 5 的三把刀：节点族从"写死四族"改成"每栏自己声明"（`cfg.nodes`）之后，这三条
  //    各钉住新代码的一条边——少了它们，这一族的解耦就是"改了而没人核"（§0.3 那句老话的第三版）。
  {
    // 反向核**默认值**：没声明的页（这三条存量条目）仍按四族要。删掉产物那一格必须仍红——
    // 若解耦时把默认清单写成了空数组，这一发就安静地绿了，而"tree 那一格没了"在页面上是
    // "树视图永远出不来"，正是这一族地址最贵的一种病。
    name: 'JSON 页产物缺 tree 那一格（没声明 nodes 的页仍按默认四族要）',
    group: 'DOM',
    expect: '产物里缺少这些 id：jt-tree-workbench-main',
    artifact: () => shadowEdit('tools/json.html', (s) => s.replace('id="jt-tree-workbench-main"', 'id="jt-tree-workbench-mai"')),
  },
  {
    // 声明里的词汇表：一族拼错，门禁就只会去要拼错的那名，而那一格谁都不会画；页面上是
    // "少一格而什么都不报"。这一刀动的是 spec 的源，因为"声明"这件事只在源侧存在。
    name: 'JSON 页 nodes 声明了一族拼错的「trec」',
    group: 'DOM',
    expect: 'nodes 声明了「trec」',
    src: () => mutateSrc('dev/js/tools/jsonWorkbench.js', (s) => s.replace(
      "        kind: 'workbench',\n        controls: [\n          { id: 'doc', type: 'area' },",
      "        kind: 'workbench',\n        nodes: ['trec'],\n        controls: [\n          { id: 'doc', type: 'area' },",
    )),
  },
  {
    // 正向核**声明被消费**：把 main 栏收到只剩 `status`，产物上另外三族那三格就成了"骨架私自多长"。
    // 这一刀钉的是"收窄声明会红"而不是"收窄声明静默通过"——后者才是解耦真正会引进的病：
    // 装配层少要一格、骨架多长一格，两边各说各话而门禁仍绿。
    name: 'JSON 页 nodes 收窄成一族（另外三格变成私自多长）',
    group: 'DOM',
    expect: '多出这些控件/开关/按钮/节点 id',
    src: () => mutateSrc('dev/js/tools/jsonWorkbench.js', (s) => s.replace(
      "        kind: 'workbench',\n        controls: [\n          { id: 'doc', type: 'area' },",
      "        kind: 'workbench',\n        nodes: ['status'],\n        controls: [\n          { id: 'doc', type: 'area' },",
    )),
  },
];

/**
 * 段 5 Task 6 起头：对比页那一格的四把刀。
 *
 * 为什么现在就得加，而不是等 Task 8 那一整套——这一格落地本身就是**让上一组刀变成假牙的那件事**
 * （两条 workbench 条目并排，徽章同串），所以"判据收紧"与"新条目自己那一刀"必须同一次落地，
 * 否则台账里留下的是"改完判据没人复验"的形状。全套同名变异（sitemap / llms / 导航 / 图标 /
 * 控件 id / 按钮文案）按段 4 的先例在 Task 8 补齐。
 */
const diffCases = [
  {
    name: '对比页 yml title 与 front matter 漂移',
    group: '页面源',
    src: () => mutateSrc('_data/onlineTools.yml', (s) => s.replace('title: 文本对比工具 · 两份文件差异与JSON比对', 'title: 文本对比工具')),
  },
  {
    name: '对比页 yml url 与 front matter permalink 不同源',
    group: '页面源',
    src: () => mutateSrc('_data/onlineTools.yml', (s) => s.replace('url: /tools/diff.html', 'url: /tools/diff-x.html')),
  },
  {
    name: '对比小节徽章被改（与 JSON 小节同串，整页判据抓不到）',
    group: '收录',
    artifact: () => shadowEdit('tools.html', (s) => badgeInSection(s, 'diff', '14 个动作', '12 个动作')),
  },
  {
    // 与 T-d 同一格，但打在 diff 那一节：`  actions: 14` 在两节里各一次，整页 replace 只碰
    // 排前面的 json。锚点用 `slug: diff` 往后找，条目顺序变了也不会静默换靶子。
    name: '对比条目 actions 写成 13（DIFF_ACTIONS.length 还是 14）',
    group: 'DOM',
    src: () => mutateSrc('_data/onlineTools.yml', (s) => {
      const out = s.replace(/(slug: diff[\s\S]*?)\n  actions: 14/, '$1\n  actions: 13');
      if (out === s) throw new Error('yml 的 diff 条目里没找到「  actions: 14」，这一刀作废');
      return out;
    }),
  },
];

const cases = [...idcardCases, ...codecCases, ...jsonCases, ...diffCases];

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
    else if (c.expect && !got.out.includes(c.expect)) {
      // 只判"红了"不够：分支失效那一刀会同时红好几处，其中"数据源自洽"那一处判据空转时
      // 照样会红，证不了门禁还在数产物。expect 点名的就是能证明判据仍在数的那一句。
      problems.push(`✗ ${c.name}：红了，但没有一句含 ${JSON.stringify(c.expect)}：\n${got.out.split('\n').filter((l) => l.includes('：')).slice(0, 6).join('\n')}`);
    } else { pass += 1; console.log(`✓ ${c.name} → [${c.group}]`); }
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
