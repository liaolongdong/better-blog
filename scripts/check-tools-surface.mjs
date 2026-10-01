#!/usr/bin/env node
/**
 * 收录面自证器：`_data/onlineTools.yml` 里每条 `status: ready` 的工具页，必须在
 * 「页面本身 / 三处收录点 / 顶栏导航 / 图标 / DOM 契约」这五层上互相对得上。
 *
 * 为什么要有这个脚本（设计文档 §4.4 第 8 条、§8.2）：这一族事实分散在五个地方，而它们
 * 全部**不会因为写错而报错**——
 *   - yml 改了 `title`，页面 front matter 没改：构建绿、页面绿，只有 `<title>` 与下拉文案
 *     从此是两个版本（段 2 Task 9 写 §4.1 时就真的漂移过一次，靠肉眼发现的）；
 *   - `{% for x in data | where: … %}` 这种 Liquid 里非法的过滤器写法：Jekyll 只打一行
 *     warning 就**把整个循环渲染成空**，sitemap 少一条收录、下拉少一行，构建退出码仍是 0；
 *   - 页面骨架改了一个控件 id，装配层的 spec 没跟着改：构建与页面全绿，
 *     红的是运行时——而且只红那一块面板，没人点就没人知道。
 * 前三次收口都是"跑一遍看看"，所以把"看看"写成判据。
 *
 * 用法：
 *   node scripts/check-tools-surface.mjs                 # 读 _site/
 *   node scripts/check-tools-surface.mjs --site=_site    # 同上，显式
 *   node scripts/check-tools-surface.mjs --list          # 只打印将要核对的条目与检查项
 *
 * 失败形状（退 1，不静默）：每条失败打印 `[组名] 条目：说明`，末尾给总数。
 * 通过形状：`✓ 收录面 N 条 ready 条目 × 5 组判据全绿`。
 *
 * 两道防止"门禁自己变哑"的设计：
 *   1. `_site` 不存在或不新鲜时**报错而不是跳过**——跳过会让它在没构建的机器上永远绿。
 *   2. 逐条判据里凡是"源与产物各读一份再比"的，两边都取实际值，不写死字面量（写死的
 *      数字一旦过期，判据就从"能红"退化成"只能红在这一格"，见 §8.2 那条教训）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const LIST_ONLY = argv.includes('--list');
const SITE_REL = (() => {
  const hit = argv.find((a) => a.startsWith('--site='));
  return path.resolve(ROOT, hit ? hit.slice(7) : '_site');
})();

/** yml → JS：交给 ruby 的 stdlib 解析，不自己写子集解析器（手写的那份迟早和 Liquid 读到不一样的东西） */
function readYml(rel) {
  const script = 'require "yaml"; require "json"; puts YAML.load_file(ARGV[0]).to_json';
  let out;
  try {
    out = execFileSync('ruby', ['-e', script, path.join(ROOT, rel)], { encoding: 'utf8', maxBuffer: 8 << 20 });
  } catch (e) {
    throw new Error(`读取 ${rel} 失败（需要 ruby + yaml，Jekyll 构建本来就依赖它）：${e.message}`);
  }
  return JSON.parse(out);
}

const fails = [];
/** 记一条失败：组名 + 条目 + 人话说明，末尾统一计数打印 */
function bad(group, entry, msg) {
  fails.push(`[${group}] ${entry}：${msg}`);
}

// ── 输入 ──────────────────────────────────────────────────────────────────────

const toolsData = readYml('_data/onlineTools.yml');
const ready = toolsData.filter((t) => t.status === 'ready');
const config = readYml('_config.yml');
const nav = config.nav || [];

/** 非文本对比度下限（WCAG 1.4.11 graphical objects）；图标带 `alt=""`，按图形而非文字判 */
const ICON_MIN_RATIO = 3.0;
/** `<title>` 与 `seo_description` 的列宽预算，与 USAGE.md「检索层自查」第 9 条同一口径 */
const TITLE_MAX_COLS = 60;
const DESC_MIN_COLS = 50;
const DESC_MAX_COLS = 158;

if (ready.length === 0) {
  console.error('✗ 收录面门禁：_data/onlineTools.yml 里没有 status: ready 的条目——门禁无事可核，这本身就是要红的事');
  process.exit(1);
}
if (!fs.existsSync(SITE_REL)) {
  console.error(`✗ 收录面门禁：找不到产物目录 ${path.relative(ROOT, SITE_REL)}；先跑 pnpm build:site（跳过检查的"绿"不算绿）`);
  process.exit(1);
}

const site = (rel) => path.join(SITE_REL, rel);
const readSite = (rel) => {
  const p = site(rel);
  if (!fs.existsSync(p)) throw new Error(`产物缺失：${rel}`);
  return fs.readFileSync(p, 'utf8');
};
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const hasSrc = (rel) => fs.existsSync(path.join(ROOT, rel));

/** 列宽口径：CJK 与全角（码位 > 0x2E80）算 2 列，其余算 1 列 */
const cols = (s) => [...String(s)].reduce((n, c) => n + (c.codePointAt(0) > 0x2e80 ? 2 : 1), 0);
const escRE = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * front matter 取值：只按 `^key:` 的行形状取，取不到返回 null（让调用方去报"缺字段"，
 * 而不是在解析阶段就抛——一个空行/一条注释不该变成"门禁崩了"）。
 */
function frontMatter(text, key) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!fm) return null;
  const line = new RegExp(`^${escRE(key)}:[ \\t]*(.*)$`, 'm').exec(fm[1]);
  return line ? line[1].trim() : null;
}

// ── 装配层 spec：按条目取 ─────────────────────────────────────────────────────

/**
 * 每条 ready 条目自己的形状表（`dev/js/tools/workbench.js` 那一类装配层导出的常量）。
 *
 * 这一段原来是脚本顶部一条无条件 `import('dev/js/tools/workbench.js')` 加一对解构
 * （段 3 §0.3 实测：全文没有 `idcard` 字面量，唯一的证件页耦合就是那一句），而组 5 拿这张表
 * 去比**每一条** ready 条目的 `panels`——于是"加第二条 ready 条目必红"，且红的是新页压根
 * 没犯过的错。指针改放在数据源里（`spec: {module, table, ids}`）："这一页的形状表在哪本
 * 模块的哪个导出上"本来就是这一页的事实，在本脚本里再维护一张 slug→模块 的对照表，
 * 就是同一件事的第二处口径（加一页要改两个文件，改漏一个红在运行时）。
 *
 * 前三格全部必填，且 `module` 必须是站内相对路径：这条判据会 import 并**执行**那个模块，
 * 拼错一格时宁可红在「DOM」组里，也不要让脚本拿一个绝对路径去 require 仓库外的东西。
 * 第四格 `actions` 是选读（只有工作台式那一支用），它的必填由组 5 按 `layout` 分派，
 * 不在这里判——本函数不看 `t.layout`。
 * 同一个模块只 import 一次（两页共用一本装配层时不重复求值）。
 *
 * @param {object} t yml 里的一条 ready 条目
 * @returns {Promise<{table: object, ids: string[], actions: string[]|null}|null>}
 *   取不到就记一条失败并返回 null。`actions` 只有在 yml 指名了导出名时才取（工作台式那一格）
 */
const specModules = new Map();
async function loadSpec(t) {
  const s = t.spec || {};
  const missing = ['module', 'table', 'ids'].filter((k) => !s[k]);
  if (missing.length) {
    bad('DOM', t.slug, `yml 的 spec 少了 ${missing.join('/')}（DOM 契约按条目取表，缺一格就无从取）`);
    return null;
  }
  if (!/^dev\/js\/.+\.js$/.test(s.module)) {
    bad('DOM', t.slug, `spec.module="${s.module}" 不是 dev/js 下的 .js 站内相对路径，门禁不去 import 它`);
    return null;
  }
  if (!hasSrc(s.module)) {
    bad('DOM', t.slug, `spec.module=${s.module} 在仓库里不存在`);
    return null;
  }
  if (!specModules.has(s.module)) {
    try {
      specModules.set(s.module, await import(pathToFileURL(path.join(ROOT, s.module)).href));
    } catch (e) {
      bad('DOM', t.slug, `import ${s.module} 失败：${e.message}`);
      specModules.set(s.module, {});
    }
  }
  const mod = specModules.get(s.module);
  const table = mod[s.table];
  const ids = mod[s.ids];
  if (!table || typeof table !== 'object') {
    bad('DOM', t.slug, `${s.module} 没有导出对象 ${s.table}`);
    return null;
  }
  if (!Array.isArray(ids)) {
    bad('DOM', t.slug, `${s.module} 没有导出数组 ${s.ids}（面板顺序的第二个声明处）`);
    return null;
  }
  /**
   * 第四格 `actions`：**按条目选读**，不是必填。它是动作清单在那本模块里的导出名，
   * 只有 `layout: workbench` 那一条会用（tools.html 的「N 个动作」徽章，段 4 §0.7 第 3 条）。
   * 名字写了却取不到数组，就地记一条失败并交回 null——让调用方去分派"缺哪一格"，
   * 这里不猜布局（这一本函数不看 `t.layout`，它连 yml 的清单长度都不该知道）。
   */
  let actions = null;
  if (s.actions) {
    if (!Array.isArray(mod[s.actions])) {
      bad('DOM', t.slug, `${s.module} 没有导出数组 ${s.actions}（spec.actions 指名了它，取不到就核不了动作枚数）`);
    } else {
      actions = mod[s.actions];
    }
  }
  return { table, ids, actions };
}

// ── 组 1：页面源文件与 yml 的 title / permalink / 检索文案 ─────────────────────

function checkPageSource(t) {
  const rel = `tools-${t.slug}.html`;
  if (!hasSrc(rel)) {
    bad('页面源', t.slug, `找不到 ${rel}（yml 的 slug 与页面文件名按 tools-<slug>.html 对应）`);
    return null;
  }
  const src = readSrc(rel);
  const permalink = frontMatter(src, 'permalink');
  const title = frontMatter(src, 'title');
  const desc = frontMatter(src, 'seo_description');
  if (permalink !== t.url) bad('页面源', t.slug, `front matter permalink=${JSON.stringify(permalink)} 与 yml url=${JSON.stringify(t.url)} 不一致`);
  if (title !== t.title) {
    bad('页面源', t.slug, `front matter title 与 yml title 逐字节不等：页面 ${JSON.stringify(title)} / yml ${JSON.stringify(t.title)}`);
  }
  if (!desc) bad('页面源', t.slug, 'front matter 缺 seo_description（下拉与 tools.html 的小标题都靠它兜底）');
  else {
    const c = cols(desc);
    if (c < DESC_MIN_COLS || c > DESC_MAX_COLS) bad('页面源', t.slug, `seo_description ${c} 列，超出检索摘要预算 [${DESC_MIN_COLS},${DESC_MAX_COLS}]`);
  }
  if (title) {
    // <title> 还会被 default 布局后缀一段站点名，预算按拼接后的总列数判
    const suffix = ' - Better 前端博客';
    const c = cols(title + suffix);
    if (c > TITLE_MAX_COLS) bad('页面源', t.slug, `<title> 连站点名后缀 ${c} 列，超出 SERP 预算 ${TITLE_MAX_COLS} 列`);
  }
  return { src, desc };
}

// ── 组 2：产物、canonical 与三处收录点 ────────────────────────────────────────

/** 从产物页的 canonical 反推 baseurl：判据只认"这几处必须彼此一致"，不把 /better-blog 写死 */
function deriveBase(html) {
  const m = /<link rel="canonical" href="([^"]+)">/.exec(html);
  if (!m) return null;
  try {
    return { href: m[1], origin: new URL(m[1]).origin };
  } catch {
    return { href: m[1], origin: null };
  }
}

/**
 * 取 `tools.html` 里某一条 ready 条目**自己那一小节**：从 `<section … id="online-<slug>"`
 * 起，到与它配平的那个 `</section>` 止（嵌套用计数，不靠缩进也不靠"下一个 class 同名标签"——
 * 最后一节后面还跟着别的 `<section>`，按 class 找边界会一路吞到文末，等于没收窄）。
 *
 * 为什么要有"段内"这一层（段 5 Task 6 的现场）：徽章、面板锚点、纯文本要点这三条判原本都是
 * 拿**整页** `test`/`includes` 在比，也就是"这一串在页面上出现过就算对"。第四条条目登记进来后，
 * json 与 diff 两节的徽章是同一个字面量（都 `14 个动作`，各自 5 块面板那两节也同串），
 * 于是"把 json 那一节的徽章改成 12"这一刀注入后整页仍能找到 `<li>14 个动作</li>`——
 * 门禁绿，页面上印着假数字。牙齿台账（`check-tools-surface-teeth.mjs` 的
 * 「徽章数字与数据源脱钩」）在第四格落地当场抓到这个假牙。
 * 修法不是改判据比对的字符串、更不是放宽判据，而是**改判据的作用域**：数的是这一条自己那一节，
 * 别人那一节再像也不算。条目从 3 涨到 4 之后，"页面上出现过"这类判据全部不再等价于"这一条对得上"。
 *
 * 找不到节返回 `null`，调用方先记"整节缺失"再交回，不再往下逐格比——不然一节不在会连带
 * 报出五条"这格里找不到"，红字淹掉真正的那一句。
 */
function toolsSectionOf(toolsHtml, slug) {
  const marker = `<section class="tool-section tool-section--online" id="online-${slug}"`;
  const at = toolsHtml.indexOf(marker);
  if (at < 0) return null;
  let depth = 0;
  const tags = /<\/?section\b[^>]*>/g;
  tags.lastIndex = at;
  for (let m = tags.exec(toolsHtml); m; m = tags.exec(toolsHtml)) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return toolsHtml.slice(at, tags.lastIndex);
  }
  return toolsHtml.slice(at);
}

function checkInclusion(t, builtHtml, pageUrlRel) {
  const canon = deriveBase(builtHtml);
  if (!canon) {
    bad('收录', t.slug, '产物里没有 <link rel="canonical">，无从核对地址一致性');
    return;
  }
  if (!canon.href.endsWith(pageUrlRel)) {
    bad('收录', t.slug, `canonical=${canon.href} 不以页面 permalink=${pageUrlRel} 结尾（baseurl 或 url 有一处被改过）`);
    return;
  }
  const abs = canon.href;
  const localPath = new URL(abs).pathname;

  const sitemap = readSite('sitemap.xml');
  const urlBlock = new RegExp(`<url>\\s*<loc>${escRE(abs)}</loc>\\s*<changefreq>([^<]+)</changefreq>\\s*<priority>([^<]+)</priority>\\s*</url>`).exec(sitemap);
  if (!urlBlock) {
    bad('收录', t.slug, `sitemap.xml 里找不到 loc=${abs} 及其 changefreq/priority（循环被 Liquid 写法吞掉时就是这个形状）`);
  }
  if (urlBlock && (urlBlock[1] !== 'monthly' || Number(urlBlock[2]) < 0.6)) {
    bad('收录', t.slug, `sitemap 里这一条的权重是 ${urlBlock[1]}/${urlBlock[2]}，工具页应为 monthly/≥0.6`);
  }

  const llms = readSite('llms.txt');
  const llmsLine = new RegExp(`^- \\[${escRE(t.h1)}\\]\\(${escRE(abs)}\\)：(.+)$`, 'm').exec(llms);
  if (!llmsLine) bad('收录', t.slug, `llms.txt 里找不到「- [${t.h1}](${abs})：说明」这一行`);
  else if (cols(llmsLine[1]) < 20) bad('收录', t.slug, `llms.txt 里这条的说明只有 ${cols(llmsLine[1])} 列，等于没写`);

  const indexAll = readSite('index-all.html');
  if (!indexAll.includes(`href="${escRE(localPath)}"`) && !new RegExp(`href="${escRE(localPath)}"`).test(indexAll)) {
    bad('收录', t.slug, `index-all.html 里没有指向 ${localPath} 的链接`);
  }
  if (!new RegExp(`id="onetools"`).test(indexAll)) {
    bad('收录', t.slug, 'index-all.html 里没有 #onetools 那一节，页面清单没有落点');
  }

  const toolsHtml = readSite('tools.html');
  const section = toolsSectionOf(toolsHtml, t.slug);
  if (!section) {
    bad('收录', t.slug, 'tools.html 里没有这一条的 tool-section--online 小节');
    return;
  }
  if (!new RegExp(`href="${escRE(localPath)}"[^>]*>打开${escRE(t.h1)}</a>`).test(section)) {
    bad('收录', t.slug, `tools.html 的该小节缺少指向 ${localPath} 的「打开${t.h1}」主按钮`);
  }
  /**
   * 面板清单那一栏是**跨页**锚点（`href="另一页#x"`），修 B（2026-10-01）把片段从裸 `{slug}`
   * 换成目标页真存在的 `{prefix}-panel-{slug}`。两支各钉一头，缺一支都还留得住死锚点：
   * ① **按数据源逐枚对**：`href` 必须是 `{prefix}-panel-{slug}`，且锚文本必须是那一块面板的名字——
   *    只判"片段非空"或只判"那一枚落得下去"，都留得住目录与内容错位（把 `uscc` 那枚指到
   *    `random` 的面板时，两支里更弱的那一支照样绿，见门禁⑥ 那第二颗新牙）；
   * ② **读产物里真写出去的那串片段**，逐枚要求目标页的产物里有同名 id——这一支读的才是
   *    "锚点指向的那一头"：本页的 id 集合再全也救不了它，而落地页与目标页之间隔着一次构建，
   *    目标页把面板 id 改了名、yml 与模板都跟着动了 ① 也仍绿（①判的是"两边按同一份数据写"），
   *    只有 ② 会红在"跳转落空"这一件事上。
   * 与 `checkDomContract` 里那条同页判据的分工：那条读「本页 href ↔ 本页 id」，这条读
   * 「落地页 href ↔ 本页 id」，两形一起钉才不算半把尺。
   */
  for (const p of t.panels) {
    const want = `${t.prefix}-panel-${p.slug}`;
    if (!new RegExp(`href="${escRE(localPath)}#${escRE(want)}">${escRE(p.name)}</a>`).test(section)) {
      bad('收录', t.slug, `tools.html 的面板清单里没有指向 #${want}（${p.name}）的锚点链接`);
    }
  }
  for (const m of section.matchAll(new RegExp(`href="${escRE(localPath)}#([^"]+)"[^>]*>[^<]*</a>`, 'g'))) {
    if (!new RegExp(`\\sid="${escRE(m[1])}"`).test(builtHtml)) {
      bad('收录', t.slug, `跨页锚点 ${localPath}#${m[1]} 在 ${pageUrlRel} 的产物里落不下去（目标页没有这枚 id：禁 JS 时浏览器原生那一次跳转什么也跳不到，而开 JS 有 parseHash 认裸形、构建也不报错）`);
    }
  }
  /**
   * `features` 那一档只在 `panels` 为空时被消费（tools.html 的 `for`/`else`，段 4 Task 7）：
   * 工作台那一页没有页内锚点可指，清单退成纯文本要点。两向都判——
   *   · 空 `panels` 又没 `features`：那一栏画成一条空 `<ul>`，页面看着"少了一块"却不报错；
   *   · 非空 `panels` 还写 `features`：模板走锚点那一支，这一格**没有消费者**，改它页面不动。
   * 后者就是「徽章写死 0 块面板」那一族的病换个格子复发：数据源里躺着一份模板不读的清单。
   *
   * 第三条判据在产物上：要点**逐条**都要能在**这一节里**找到。数据源那一头有货而循环没吐，
   * 形状是"小节少一块"——只判数据源等于默认模板一定会画出来，而这一页的模板改动（`for`/`else`）
   * 正是本段新写的，没有既有页面替它担保。
   */
  const feats = Array.isArray(t.features) ? t.features : [];
  if (t.panels.length === 0 && feats.length === 0) {
    bad('收录', t.slug, 'panels 为空而 features 也为空——tools.html 的 .tool-features 会画成一条空白 ul，门禁绿而页面少一块');
  }
  if (t.panels.length > 0 && feats.length > 0) {
    bad('收录', t.slug, `panels 非空却写了 ${feats.length} 条 features——模板那一支读的是面板锚点，这一格没有消费者`);
  }
  for (const f of feats) {
    if (typeof f !== 'string' || f.trim() === '') {
      bad('收录', t.slug, `features 里有一格不是非空字符串（${JSON.stringify(f)}），画出来是空条目`);
    } else if (!section.includes(`<li>${f}</li>`)) {
      bad('收录', t.slug, `tools.html 的该小节没有那条纯文本要点：「${f}」（循环没吐这一条，或模板被改成只走锚点那一支）`);
    }
  }
  /**
   * 第三格徽章 ↔ 数据源（§0.7 第 3 条的另一半）。「DOM」组核的是 `actions` 与
   * `JSON_ACTIONS.length` 相等，这一条核的是**模板把那个数画出来了**：两处漏一处，页面上
   * 就是「0 块面板」那一句假话，而构建不报错。panels 支同样判，那一格读 `panels.size`。
   *
   * 比对范围是 `section` 而不是整页（段 5 Task 6 的假牙现场）：两条 workbench 条目并排之后，
   * 整页判"出现过"对其中任何一节被改坏都是绿的——见 `toolsSectionOf` 上方那段。
   */
  const badge = t.layout === 'workbench' ? `${t.actions} 个动作` : `${t.panels.length} 块面板`;
  if (!new RegExp(`<li>${escRE(badge)}</li>`).test(section)) {
    bad('收录', t.slug, `tools.html 的该小节第三格徽章里找不到「${badge}」——那一格按 layout 分派读数据源，模板分支或 yml 有一处被改过`);
  }
}

// ── 组 3：顶栏导航高亮与下拉 ───────────────────────────────────────────────────

/** 取当前页命中的那个导航项：`is_current` 的判据在 _includes/header.html，这里按同一口径复算 */
function expectedActiveNav(pageUrl) {
  for (const item of nav) {
    if (item.url === '/') { if (pageUrl === '/') return item; continue; }
    const dir = item.url.replace(/\.html$/, '');
    if (pageUrl === item.url || pageUrl === dir || pageUrl.includes(`${dir}/`)) return item;
  }
  return null;
}

/**
 * 导航高亮的**全站**审计：把产物里每一个带 canonical 的页面都复算一遍"该亮哪一项"。
 *
 * 为什么不只核工具页那三张：Task 9 改的是 `_includes/header.html` 里那条 `is_current`
 * 判据，它的作用域是全站每一页——只在新页上抽查等于把"改前那些页会不会被带下去"这件事
 * 交给运气。判据本身在模板里以 Liquid 写，这里用 JS 重写一份同口径的，两边不一致即红。
 *
 * 判三件事，全部按"数一遍全站"的写法（不是"看看有没有异常"）：
 *   1. 命中某个导航项的页：`.is-current` 恰好一个；没命中的页（文章页、demo 页）：恰好零个；
 *   2. 亮着的那一项文本等于复算出来的 label；
 *   3. `aria-current` 的取值：精确命中页 = `page`，前缀命中页 = `true`，二者不得混。
 * 没有 canonical 或不渲染这份 header 的产物跳过，但跳过与核到的份数都要打出来——
 * 哪天整个布局不再输出 canonical，"核到 0 页"这一行就是报警。
 */
function auditNavSiteWide() {
  const pages = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.html')) pages.push(p);
    }
  };
  walk(SITE_REL);
  // Liquid 里的 page.url **不含** baseurl，而 canonical 含，所以比之前先把这一段削掉
  const BASE = (new URL(config.url).pathname.replace(/\/$/, '')) + String(config.baseurl || '');
  let skipped = 0;
  let checked = 0;
  let bare = 0;
  for (const p of pages) {
    const html = fs.readFileSync(p, 'utf8');
    const canon = deriveBase(html);
    if (!canon) { skipped += 1; continue; }
    let localPath;
    try { localPath = new URL(canon.href).pathname; } catch { skipped += 1; continue; }
    const pageUrl = localPath.startsWith(`${BASE}/`) ? localPath.slice(BASE.length) : localPath;
    const rel = path.relative(SITE_REL, p);
    const active = [...html.matchAll(/<li class="nav-item([^"]*)"/g)];
    if (active.length === 0) { bare += 1; continue; }
    checked += 1;
    const current = active.filter((m) => m[1].includes('is-current'));
    const want = expectedActiveNav(pageUrl);
    if (!want) {
      if (current.length !== 0) {
        bad('导航-全站', rel, `${pageUrl} 按 header 口径不命中任何导航项，产物里却亮了 ${current.length} 个`);
      }
      continue;
    }
    if (current.length !== 1) {
      bad('导航-全站', rel, `${pageUrl} 应亮「${want.label}」，产物里 .is-current 有 ${current.length} 个`);
      continue;
    }
    const idx = active.findIndex((m) => m[1].includes('is-current'));
    const seg = html.slice(active[idx].index, active[idx].index + 900);
    const link = /<a class="nav-link"([^>]*)>([^<]*)/.exec(seg);
    if (!link || !link[2].trim().startsWith(want.label)) {
      bad('导航-全站', rel, `${pageUrl} 亮的是「${link && link[2].trim()}」，复算应为「${want.label}」`);
      continue;
    }
    const exact = pageUrl === want.url || pageUrl === want.url.replace(/\.html$/, '');
    const wantAria = exact ? 'aria-current="page"' : 'aria-current="true"';
    if (!link[1].includes(wantAria)) {
      bad('导航-全站', rel, `${pageUrl} 的父项 aria-current 不是 ${wantAria}（精确命中记 page、前缀命中记 true）`);
    }
  }
  console.log(`  导航-全站：核到 ${checked} 页（不渲染 header 的 ${bare} 份、无 canonical 的 ${skipped} 份）`);
  if (checked === 0) bad('导航-全站', '全站', '一页都没核到（canonical 解析或目录扫描失效），这条判据此刻无牙');
}

function checkNav(builtHtml, t) {
  const active = [...builtHtml.matchAll(/<li class="nav-item([^"]*)"/g)];
  const current = active.filter((m) => m[1].includes('is-current'));
  if (current.length !== 1) {
    bad('导航', t.slug, `导航里有 ${current.length} 个 .is-current，应为 1 个（多高亮/不高亮都是判据漂移）`);
    return;
  }
  const want = expectedActiveNav(t.url);
  if (!want) {
    bad('导航', t.slug, '按 header 的口径这一页不该命中任何导航项，但产物里出现了高亮——两边判据不同源');
    return;
  }
  // 高亮落在哪个 label 上：取该 <li> 之后第一个 nav-link 的文本
  const idx = active.findIndex((m) => m[1].includes('is-current'));
  const seg = builtHtml.slice(active[idx].index, active[idx].index + 900);
  const label = /<a class="nav-link"[^>]*>([^<]+)/.exec(seg);
  if (!label || !label[1].trim().startsWith(want.label)) {
    bad('导航', t.slug, `高亮项文本是 ${JSON.stringify(label && label[1].trim())}，应为「${want.label}」`);
  }
  // 前缀命中的父项只能说"你在这族里"，不能说"这一项就是当前页"
  if (!/class="nav-link"[^>]*aria-current="true"/.test(seg)) {
    bad('导航', t.slug, '前缀命中的父导航项缺少 aria-current="true"（有 .is-current 而无 aria 等于对读屏用户不高亮）');
  }
  if (/class="nav-link"[^>]*aria-current="page"/.test(seg)) {
    bad('导航', t.slug, '父导航项被标成 aria-current="page"，而它指向的不是当前页');
  }
  const sub = new RegExp(`<a class="nav-sub-link" href="[^"]*${escRE(t.url)}"[^>]*aria-current="page"`).test(builtHtml)
    || new RegExp(`<a class="nav-sub-link" href="[^"]*${escRE(t.url)}" aria-current="page"`).test(builtHtml);
  if (!sub) bad('导航', t.slug, '下拉里指向本页的那一条缺少 aria-current="page"');
  if (!new RegExp(`data-tool="${escRE(t.slug)}"`).test(builtHtml)) {
    bad('导航', t.slug, '下拉里没有这一条（data-tool 锚点缺失），status 不是 ready 或模板漏渲染');
  }
}

// ── 组 4：图标昼夜可读 ────────────────────────────────────────────────────────

const lum = (hex) => {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  const ch = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/**
 * 从 tokens.scss 现读底色集合：`:root` 与另外两档纸色温各写一遍 `--surface` / `--surface-2`，
 * 夜间那一块再重写一遍——四块 × 两档 = 现场 8 格（`#FFF` 与 `#FFFFFF` 是同一个色的两种写法，
 * 按字符串去重会留两格，多算不影响判定方向：只会让判据更严，不会更松）。
 * 返回值带变量名，是为了让调用方能判"只解析出一档"这种半失效形状。
 */
function tokenSurfaces() {
  const scss = readSrc('dev/sass/common/tokens.scss');
  const rows = [];
  const blocks = scss.match(/:root\s*\{[\s\S]*?\n\}|html\[data-rs-paper="[a-z]+"\][^{]*\{[\s\S]*?\n\}|body\.night-mode[^{]*\{[\s\S]*?\n\}/g) || [];
  for (const b of blocks) {
    for (const v of ['--surface', '--surface-2']) {
      const m = new RegExp(`^\\s*${v}:\\s*(#[0-9A-Fa-f]{3,6})\\s*;`, 'm').exec(b);
      if (m) rows.push({ var: v, hex: m[1].toUpperCase() });
    }
  }
  return rows;
}

function checkIcon(t) {
  if (!hasSrc(t.icon.replace(/^\//, ''))) {
    bad('图标', t.slug, `yml 指向的 ${t.icon} 在仓库里不存在`);
    return;
  }
  const rawSvg = readSrc(t.icon.replace(/^\//, ''));
  // 注释里出现连续两个连字符，整份 SVG 就不是合法 XML。而它是以 <img src> 引用的，
  // 解析失败在页面上直接是破图占位——构建、其余四组判据、乃至下面那段对比度计算全是绿的，
  // 因为它们都是按正则读文本，不看可解析性（2026-09-28 现场：本图标的注释里写了带 var 前缀
  // 的令牌名，xmllint 报六处 parser error，下拉与 /tools.html 两处同时渲染成破图，
  // 而门禁当时退 0）。这条判据补的是那层盲区。
  const comments = rawSvg.match(/<!--[\s\S]*?-->/g) || [];
  const badComments = comments.filter((c) => /--/.test(c.slice(4, -3)));
  if (badComments.length) {
    bad('图标', t.slug,
      `${comments.length} 段注释里有 ${badComments.length} 段含连续两个连字符——XML 注释禁止那两划，整份 SVG 解析失败，<img> 里是破图`);
  }
  // 注释之外必须还剩一个带 xmlns 的根，否则同样是解析失败
  if (!/<svg\b[^>]*\bxmlns=/s.test(rawSvg.replace(/<!--[\s\S]*?-->/g, ''))) {
    bad('图标', t.slug, '摘掉注释之后找不到带 xmlns 的 <svg> 根节点，浏览器不会把它当 SVG 解析');
  }
  // 注释里出现 currentColor 是**记录决策**（这个文件的注释正是在解释"为什么不用它"），
  // 判据只看渲染时会生效的那部分，所以先摘掉 <!-- … -->
  const svg = rawSvg.replace(/<!--[\s\S]*?-->/g, '');
  if (/currentColor/.test(svg)) {
    bad('图标', t.slug, 'SVG 里仍有 currentColor——用 <img> 加载时它不继承宿主 CSS 变量，会渲成近黑，夜间档直接看不见');
    return;
  }
  const surfaces = tokenSurfaces();
  const seenVars = new Set(surfaces.map((s) => s.var));
  if (surfaces.length < 6 || seenVars.size < 2) {
    bad('图标', t.slug, `从 tokens.scss 只解析出 ${surfaces.length} 格底色、变量名 ${[...seenVars].join('/') || '无'}（现场应为 8 格、两档都在）——解析形状变了要同步改这里`);
  }
  const inks = new Set();
  for (const m of svg.matchAll(/\b(?:stroke|fill)="(#[0-9A-Fa-f]{3,6})"/g)) inks.add(m[1]);
  if (inks.size === 0) {
    bad('图标', t.slug, 'SVG 里找不到任何着色（stroke/fill 都没有色值），这条判据对它无牙');
    return;
  }
  for (const ink of inks) {
    for (const bg of surfaces) {
      const r = ratio(ink, bg.hex);
      if (r < ICON_MIN_RATIO) {
        bad('图标', t.slug, `${ink} 落在 ${bg.var}=${bg.hex} 上只有 ${r.toFixed(2)}:1，低于图形对象下限 ${ICON_MIN_RATIO}:1`);
      }
    }
  }
}

// ── 组 5：DOM 契约（yml panels ↔ spec ↔ 产物里的 id / data 属性） ──────────────

/**
 * 工作台支的四族节点地址（段 4 §0.3 立的那四格）。
 *
 * 段 5 把"每栏都长这四族"改成"**每栏自己声明要哪几族**"（`cfg.nodes`），因为对比页的并排视图
 * 只有一个结果区：两条输入栏各有一行闸门读数与一枚栏内复制，写死四族会让它去要六个按设计
 * 就不存在的 id。没声明的页一律退回这份全量清单——**解耦只放宽新页，不放宽存量页**：
 * 存量三页的产物里那四族本来都在，把默认值改成空数组会让"产物少了 jt-tree-workbench-main"
 * 这种真缺陷安静地绿掉。牙齿台账里那条变异（JSON 页产物缺 tree 那一格）钉的就是这一条。
 */
const DEFAULT_NODE_FAMILIES = ['out', 'status', 'tree', 'copy'];

/**
 * `layout` 的取值档（段 4 §0.3）。两个分支的差别只有一件事：**面板清单住在哪儿**。
 *   · `panels`（证件页、编码页）——清单在 yml 的 `panels:` 里，索引条、`data-*-ids`、
 *     tools.html 的面板锚点全部从它长出来；
 *   · `workbench`（JSON 页）——这一页没有索引条，清单只有装配层那一张表（`spec.ids`），
 *     yml 的 `panels` 按设计就是空的。
 *
 * **故意不给默认值**：给 `layout` 缺省成 `'panels'` 等于在本脚本里再立一处口径——`workbench`
 * 拼错一个字母（少个 c）就悄悄退回面板支，而那条路上 `panels: []` 让控件与开关那一整族判据
 * **空转**，红的是运行时而不是门禁。所以缺省只在"清单非空"时放行（两条存量条目的形状本来如此），
 * 缺省 + 空清单直接红在「既没声明又没有清单」。
 *
 * @param {object} t yml 里的一条 ready 条目
 * @param {string[]} ymlPanels 这条条目的面板清单
 * @returns {'panels'|'workbench'} 已经记过失败的条目也回一支，让后面的判据照常跑完
 */
function resolveLayout(t, ymlPanels) {
  if (t.layout === 'panels' || t.layout === 'workbench') return t.layout;
  if (t.layout === undefined || t.layout === null || t.layout === '') {
    if (ymlPanels.length === 0) {
      bad('DOM', t.slug, '既没声明 layout，panels 清单又是空的——门禁无从判断这一页是面板式还是工作台式，而工作台式在这一支会让控件判据空转');
    }
    return 'panels';
  }
  bad('DOM', t.slug, `layout=${JSON.stringify(t.layout)} 不在取值档里：只许 panels / workbench 两个字面值之一（拼错一个字母会悄悄退回另一支，红在运行时）`);
  return 'panels';
}

function checkDomContract(t, builtHtml, spec) {
  resetAccumulators();
  if (!spec) return;
  const p = t.prefix;
  const ymlPanels = t.panels.map((x) => x.slug);
  const layout = resolveLayout(t, ymlPanels);
  /** 面板清单的唯一取法：`workbench` 支只认装配层那份，`panels` 支只认 yml 那份（§0.3 那一颗牙） */
  const panelIds = layout === 'workbench' ? spec.ids : ymlPanels;
  if (layout === 'panels' && ymlPanels.join(',') !== spec.ids.join(',')) {
    bad('DOM', t.slug, `yml panels=[${ymlPanels}] 与 ${t.spec.ids}=[${spec.ids}] 不同名或不同序（顺序=索引条顺序）`);
  }
  if (Object.keys(spec.table).join(',') !== spec.ids.join(',')) {
    bad('DOM', t.slug, `${t.spec.ids} 与 ${t.spec.table} 的键对不上，${t.spec.module} 内部已经不一致`);
  }
  /**
   * 动作枚数（段 4 §0.7 第 3 条）。`tools.html` 的工作台支画 `{{ tool.actions }} 个动作`，
   * 而真值只有 `${t.spec.actions}` 那一份清单知道——这一格写死在模板里就是「0 块面板」同一族：
   * 它能被一次点击证伪，却不会被构建报错。于是数字留在 yml（数据源驱动模板），
   * 口径由这里对账：漏写、写零、与清单长度不等，一律红在门禁。
   *
   * 反向也判：`layout: panels` 却写了 `actions` → 那一支的徽章数的是 `panels.size`，
   * 这一格没有消费者，改它页面不动（与 `features` 那一族的反向判据是同一条理由）。
   */
  if (layout === 'workbench') {
    if (!Number.isInteger(t.actions) || t.actions <= 0) {
      bad('DOM', t.slug, `layout=workbench 需要 actions 是一个正整数（tools.html 的「N 个动作」徽章读它），这里是 ${JSON.stringify(t.actions)}`);
    } else if (!spec.actions) {
      bad('DOM', t.slug, 'yml 声明了 layout=workbench，但 spec.actions 没写或那本模块没导出对应数组——动作枚数无从对账');
    } else if (t.actions !== spec.actions.length) {
      bad('DOM', t.slug, `yml actions=${t.actions} 与 ${t.spec.actions}.length=${spec.actions.length} 不一致（动作清单的第二个声明处，模板画的是前者）`);
    }
  } else if (t.actions !== undefined && t.actions !== null) {
    bad('DOM', t.slug, `layout=panels 却写了 actions=${t.actions}——那一支的徽章数 panels.size，这一格在模板里没有消费者`);
  }

  const ids = new Set([...builtHtml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  // workbench 支没有索引条，所以那一格 id 不在需求里——反过来要求它存在，就是拿面板式的形状
  // 判一页本来没有的东西（§0.3 :468）。
  const need = layout === 'workbench'
    ? [`${p}-workspace`, `${p}-notice`]
    : [`${p}-workspace`, `${p}-notice`, `${p}-tablist`];
  for (const slug of panelIds) {
    if (layout === 'panels') need.push(`${p}-tab-${slug}`, `${p}-panel-${slug}`);
    const panel = spec.table[slug];
    if (!panel) { bad('DOM', t.slug, `面板 ${slug} 在 ${t.spec.table} 里没有条目`); continue; }
    // 栏位名按条目取：证件页是 gen/read 两栏，编码页是 main/diff（时间戳那块）与单栏 main。
    // 写死 ['gen','read'] 等于把第二页的 spec 判成"一栏控件都没有"，与 §0.3 那句 import 是同一种病。
    for (const side of Object.keys(panel.sides || {})) {
      const cfg = panel.sides[side];
      if (!cfg) continue;
      for (const c of cfg.controls || []) {
        const id = `${p}-in-${slug}-${c.id}`;
        need.push(id);
        // 行号槽只跟着 `type: area` 要：它是 `updateGate` 唯一另一处写 `textContent` 的地址，
        // 骨架漏掉这一格时装配层的 `node(GUTTER)` 取到 null 就**安静地什么都不画**——
        // 页面上没有异常，只是行号永远不出现。面板式那两页的视图层没有这一族 id，不加。
        // `gutter: false` 是段 5 给这一判据开的退出闸：对比页的两个粘贴框按设计不带行号槽
        // （行号在结果区的行块里，输入区的行号对"两份文本"没有意义），不写这一格的页按原样要。
        if (layout === 'workbench' && c.type === 'area' && c.gutter !== false) {
          need.push(`${p}-gutter-${slug}-${c.id}`);
        }
        for (const attr of ['cascade', 'options', 'charsets']) {
          // 只有**字符串**才是标记：编码页的 spec 里 `options` 是 `<option>` 的取值白名单数组
          // （骨架的 `<option>` 文案归 HTML，运行时不读），与证件页那个 `options: 'banks'`
          // 同名不同职——按真值收就把数组当成了标记，产物上找不到那条 data 属性而红。
          if (typeof c[attr] === 'string') markers[attr].set(id, c[attr]);
        }
      }
      for (const tg of cfg.switch?.targets || []) {
        const id = `${p}-when-${slug}-${tg.key}`;
        need.push(id);
        wantWhen.set(id, tg.when.join(' '));
      }
      /**
       * 工作台支独有的四格地址（`out` / `copy` / `status` / `tree`）与十四枚按钮。
       * 栏位名从 `panel.sides` 的键来，不在这里写死 `main`——那等于在同一支里立第二处口径，
       * 而装配层加一栏时这一格会**静默少要**。面板式那两页的视图层不产这四族 id，
       * 给存量页加这条判据会红在它压根没有的东西上（§0.3 那句 import 的病，反过来的版本）。
       *
       * 四族**由每一栏自己声明**（`cfg.nodes`，段 5）：对比页的 `a` / `b` 两栏只有 `status` 与
       * `copy`，结果区只有一格住在 `bar`。没声明 = 用那份全量（存量三页按原样判），
       * 声明了却写了词汇表外的一族 = 红——拼错一族在页面上是"骨架少长一格、装配层取到 null 就安静不画"。
       */
      if (layout === 'workbench') {
        const fams = Array.isArray(cfg.nodes) ? cfg.nodes : DEFAULT_NODE_FAMILIES;
        for (const fam of fams) {
          if (!DEFAULT_NODE_FAMILIES.includes(fam)) {
            bad('DOM', t.slug, `${slug}/${side} 栏的 nodes 声明了「${fam}」，而节点族只认 ${DEFAULT_NODE_FAMILIES.join(' / ')}（拼错一族的下场是产物少一格而门禁读不到）`);
            continue;
          }
          need.push(`${p}-${fam}-${slug}-${side}`);
        }
        for (const a of spec.actions || []) need.push(`${p}-btn-${slug}-${a.key}`);
      }
    }
  }
  const missing = need.filter((id) => !ids.has(id));
  if (missing.length) bad('DOM', t.slug, `产物里缺少这些 id：${missing.join(' ')}`);

  // workbench 支**新增且只加在这一支**的那一刀（§0.3）：这一页的控件清单只有 `spec` 那一份，
  // 所以产物上凡是 `{p}-in-*` / `{p}-when-*` / `{p}-btn-*` 而不在 `need` 里的 id，都是骨架私自
  // 多长的一格——装配层永远不会去读它或给它接线，而它会在页面上以"没人答的标签"或
  // "按下去没反应的一枚按钮"的形状出现。面板式那两页的产物里本来还住着别的 id 家族
  // （-tab- / -panel- / -h- / -out- / -copy-），不给存量页加这条判据。
  if (layout === 'workbench') {
    // 四族地址只有在这一页**自己声明过** `nodes` 时才纳入"私自多长"的判据：那三页没声明的
    // 存量条目用的是这份判据建立之前的默认四族，它们的产物里 `-{fam}-` 那一格本来就被上面的
    // `need` 要过，加进来不改变结论；而对比页是"每栏各要几族"的第一页，骨架私自多长一格
    // （比如手打一枚 `df-copy-workbench-bar`）在这一页必须红——它正是这一族地址唯一的新病形状。
    const declaresNodes = Object.values(spec.table).some((panel) => Object
      .values((panel && panel.sides) || {})
      .some((cfg) => cfg && Array.isArray(cfg.nodes)));
    const roots = declaresNodes ? 'in|when|btn|out|status|tree|copy' : 'in|when|btn';
    const orphan = new RegExp(`^${escRE(p)}-(?:${roots})-`);
    const want = new Set(need);
    const extras = [...ids].filter((id) => orphan.test(id) && !want.has(id));
    if (extras.length) bad('DOM', t.slug, `产物里多出这些控件/开关/按钮/节点 id，而 ${t.spec.table} 的 controls / switch.targets / nodes 与 ${t.spec.actions} 里没有声明：${extras.join(' ')}`);
  }

  /**
   * 索引条那五枚 `href` 落不落得下去（段 5 Task 9 对账交回来的「修 A」）。
   *
   * 为什么这一刀非得由门禁自己补：上面的 `need` 只核"骨架该有的 id 都在"，而锚点是**另一头的
   * 地址**——裸 `#slug` 在产物里压根没有同名 id：构建不报错、开脚本时点 tab 走 `preventDefault()`
   * 也撞不到，只有禁 JS、中键新标签、或把链接复制给别人时才露出来。十枚死锚点在页面上蹲了一整段，
   * 六道人一道没抓到，就是因为「产物里有这个 id」与「产物里有这条 href 要的那个 id」是两件事。
   *
   * 判四件，缺一件都还留得住死锚点：枚数等于面板数（少一枚 = 索引条与面板清单脱钩）、
   * 每一枚的目标 id 真存在于本页产物（前缀写错 = 又一次静默死锚）、那一枚 id 就是这枚 tab
   * 自己的面板（指到兄弟面板 = 目录与内容错位，见下面第二层），以及 slug 里不许带 `-panel-`
   * 这个前提本身（带上了，两种形状一起解错，见下面那一格）。
   */
  if (layout === 'panels') {
    /**
     * 锚点形的前提（评审回合补的这一格）：`parseHash` 认的是"取**最后**一处 `-panel-`、拿它之后的
     * 整串去查白名单"，而它找的是标记本身、不认前缀——所以 slug 自己带这七个字符时，索引条那形
     * `#tk-panel-a-panel-b` 会剥成 `b`，裸形 `#a-panel-b` 同样剥成 `b`：两种形状一起失效，
     * 落点是另一块板，或者那条"不是本页的某一块面板"的提示。今天这十枚 slug 没有一枚带标记，
     * 所以这一格判的是"改数据的人不许悄悄作废深链"——真出现那一枚时红在门禁，
     * 不等用户的收藏来报。口径与 `parseHash` 对齐着写：它也走小写折叠。
     */
    const tainted = t.panels.map((x) => x.slug).filter((s) => String(s).toLowerCase().includes('-panel-'));
    if (tainted.length) {
      bad('DOM', t.slug, `面板 slug ${tainted.join(' ')} 含 "-panel-"，与索引条那形 {prefix}-panel-{slug} 的剥法相撞：parseHash 取最后一处标记，锚点形与裸形会一起解错`);
    }
    const links = [...builtHtml.matchAll(/<a\b[^>]*class="tk-index__link"[^>]*>/g)];
    if (links.length !== panelIds.length) {
      bad('DOM', t.slug, `索引条有 ${links.length} 枚 .tk-index__link，而面板有 ${panelIds.length} 块（一一对应才算目录）`);
    }
    for (const m of links) {
      const hm = /\shref="#([^"]*)"/.exec(m[0]);
      if (!hm) {
        bad('DOM', t.slug, `索引条那枚没有 href="#…"：${m[0]}`);
        continue;
      }
      if (!ids.has(hm[1])) {
        bad('DOM', t.slug, `索引条的 href="#${hm[1]}" 在产物里落不下去——本页没有 id="${hm[1]}" 这个节点`);
        continue;
      }
      /**
       * 第二层：**落得下去还不够，得落在自己那一块面板上**。
       * 每一枚 `<a>` 同时带 `id="{prefix}-tab-{slug}"`，所以这一枚的归宿是唯一确定的——
       * `href` 必须逐字等于 `{prefix}-panel-{那个 slug}`。指到本页**另一块**真实存在的面板时，
       * 上面那条 `ids.has` 是绿的（id 在、滚得动），但目录与内容错位：点「统一社会信用代码」
       * 滚到「校验位计算」那一格，禁 JS 与开 JS 两档都表现为"链接撒谎"，而构建与运行时都不报错。
       */
      const tm = new RegExp(`\\sid="${escRE(p)}-tab-([^"]+)"`).exec(m[0]);
      if (tm && hm[1] !== `${p}-panel-${tm[1]}`) {
        bad('DOM', t.slug, `索引条那枚 tab 的 href="#${hm[1]}" 不是它自己的面板（id="${p}-tab-${tm[1]}" 只能指 #${p}-panel-${tm[1]}）`);
      }
    }
  }

  /**
   * 按钮文案 ↔ `JSON_ACTIONS[i].label`（`tools-json.html` 工具栏那段注释承诺的就是这一条）。
   *
   * 为什么单拎出来：id 对上了只说明"这一格存在"，不说明"这一格说的是同一件事"。栏头那行标题
   * 画的是 `action.label`（`paintResult` 读它），骨架 `<button>` 里写的是文案——两处不同名时
   * 页面上会出现"按钮写着转 YAML、结果栏标题写着转 CSV"，用户读不出自己按的是哪一枚，
   * 而构建与运行时都不报错。这一族的文案本来就是本页里最多的一处（十四枚），漂移概率也最高。
   *
   * 取文案要先剥标记再压空白：骨架里那一行会换行缩进，产物里 `<option>` 之类的子节点不该
   * 混进来（这十四枚是纯文本按钮，剥完就是那一句）。
   */
  if (layout === 'workbench' && spec.actions) {
    for (const slug of panelIds) {
      for (const a of spec.actions) {
        const id = `${p}-btn-${slug}-${a.key}`;
        const tag = new RegExp(`<button\\b[^>]*\\bid="${escRE(id)}"[^>]*>([\\s\\S]*?)<\\/button>`).exec(builtHtml);
        if (!tag) {
          bad('DOM', t.slug, `产物里没有 #${id} 那枚 <button>，或它不是按钮（${a.key} 在 ${t.spec.actions} 的清单上，装配层会给它接线）`);
          continue;
        }
        const text = tag[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        if (text !== a.label) {
          bad('DOM', t.slug, `#${id} 的文案是 "${text}"，而 ${t.spec.actions} 的 label 是 "${a.label}"（结果栏标题画的是后者，两处必须同字）`);
        }
      }
    }
  }

  // 标记与开关：产物上有、spec 里没有的，同样算红（只查一个方向等于默认允许"骨架多加料"）
  for (const [attr, want] of [['cascade', markers.cascade], ['options', markers.options], ['charsets', markers.charsets]]) {
    const onDisk = new Map();
    for (const m of builtHtml.matchAll(new RegExp(`id="([^"]+)"[^>]*data-${escRE(p)}-${attr}="([^"]+)"`, 'g'))) onDisk.set(m[1], m[2]);
    for (const m of builtHtml.matchAll(new RegExp(`data-${escRE(p)}-${attr}="([^"]+)"[^>]*id="([^"]+)"`, 'g'))) onDisk.set(m[2], m[1]);
    for (const [id, val] of want) {
      if (onDisk.get(id) !== val) bad('DOM', t.slug, `data-${p}-${attr} 对不上：spec 要 ${id}=${val}，产物是 ${id}=${onDisk.get(id) ?? '（无）'}`);
    }
    for (const [id, val] of onDisk) {
      if (!want.has(id)) bad('DOM', t.slug, `产物上 ${id} 带着 data-${p}-${attr}="${val}"，而 ${t.spec.table} 里没有这个标记——两边必须同源`);
    }
  }
  const whenDisk = new Map();
  for (const m of builtHtml.matchAll(new RegExp(`id="([^"]+)"[^>]*data-${escRE(p)}-when="([^"]+)"`, 'g'))) whenDisk.set(m[1], m[2]);
  for (const [id, val] of wantWhen) {
    const got = (whenDisk.get(id) || '').split(/\s+/).filter(Boolean).sort().join(' ');
    if (got !== val.split(/\s+/).filter(Boolean).sort().join(' ')) {
      bad('DOM', t.slug, `开关目标 ${id}：spec 要 "${val}"，产物是 "${whenDisk.get(id) ?? '（无）'}"`);
    }
  }
  for (const id of whenDisk.keys()) {
    if (!wantWhen.has(id)) bad('DOM', t.slug, `产物上多出 ${id} 的 data-${p}-when，spec 里没有对应开关`);
  }

  // 骨架上那四格数据 ↔ 入口常量
  const entry = `dev/js/tool${t.slug.charAt(0).toUpperCase()}${t.slug.slice(1)}.js`;
  if (!hasSrc(entry)) bad('DOM', t.slug, `找不到入口 ${entry}（命名口径：tool + slug 首字母大写）`);
  else {
    const src = readSrc(entry);
    for (const [key, want] of [['CONTAINER_ID', `${p}-workspace`], ['NOTICE_ID', `${p}-notice`]]) {
      const m = new RegExp(`const ${key} = '([^']*)'`).exec(src);
      if (!m) bad('DOM', t.slug, `${entry} 里没有 const ${key}`);
      else if (m[1] !== want) bad('DOM', t.slug, `${entry} 的 ${key}='${m[1]}' 与 yml prefix 推出来的 "${want}" 不一致`);
    }
    for (const a of ['ids', 'prefix', 'label', 'notice']) {
      if (!new RegExp(`${escRE(a)}: 'data-${escRE(p)}-${escRE(a)}'`).test(src)) {
        bad('DOM', t.slug, `${entry} 的 ATTR.${a} 不是 'data-${p}-${a}'——属性名由 prefix 推，两处必须一样`);
      }
    }
  }
  const boxId = `${p}-workspace`;
  const boxTag = new RegExp(`<[^>]*id="${escRE(boxId)}"[^>]*>`).exec(builtHtml);
  if (boxTag) {
    for (const a of ['ids', 'prefix', 'label', 'notice']) {
      if (!new RegExp(`data-${escRE(p)}-${a}=`).test(boxTag[0])) {
        bad('DOM', t.slug, `容器 #${boxId} 上没有 data-${p}-${a}，入口读不到配置`);
      }
    }
    const idsAttr = /data-(?:[a-z]+)-ids="([^"]*)"/.exec(boxTag[0]);
    // 比的是 `panelIds` 而不是 `ymlPanels`：workbench 支的清单在装配层，`data-jt-ids` 与它
    // 必须逐字同序（这一页的骨架那一格是字面量 `workbench`，写错一位就红在这里，不红在运行时）。
    if (idsAttr && idsAttr[1] !== panelIds.join(',')) {
      bad('DOM', t.slug, `data-${p}-ids="${idsAttr[1]}" 与${layout === 'workbench' ? ` ${t.spec.ids}（工作台式的清单只有这一份）` : ' yml panels'}的顺序不一致`);
    }
  }
}

/**
 * 组 5 的两个累加器：每核一条 ready 条目就清空一次。
 * 不重置的话，第二条页面（`jt-` 前缀的 JSON 页）会因为 spec 里攒着上一条（`tk-` 前缀）的
 * 控件而报出一堆"产物里缺少这些 id"——门禁红在错的地方，比不红更糟。
 */
const markers = { cascade: new Map(), options: new Map(), charsets: new Map() };
const wantWhen = new Map();
function resetAccumulators() {
  for (const m of Object.values(markers)) m.clear();
  wantWhen.clear();
}

// ── 跑 ────────────────────────────────────────────────────────────────────────

console.log(`收录面门禁：${ready.length} 条 ready（${ready.map((t) => t.slug).join(' / ')}），产物目录 ${path.relative(ROOT, SITE_REL)}/`);
if (LIST_ONLY) {
  for (const t of ready) {
    console.log(`  · ${t.slug}：${t.url} → tools-${t.slug}.html，前缀 ${t.prefix}，layout ${t.layout ?? '（缺省=panels）'}，panels ${t.panels.length}，入口 dev/js/tool${t.slug.charAt(0).toUpperCase()}${t.slug.slice(1)}.js，spec ${t.spec?.module ?? '（缺）'}#${t.spec?.table ?? '—'}`);
  }
  console.log('  检查项：页面源 / 收录 / 导航 / 图标 / DOM');
  process.exit(0);
}

/** 按条目把装配层 spec 先取齐：取不到的条目已经在「DOM」组里记了失败，这里只负责不再往下比 */
const specs = new Map();
for (const t of ready) specs.set(t.slug, await loadSpec(t));

for (const t of ready) {
  const pageUrlRel = t.url;
  const builtRel = t.url.replace(/^\//, '');
  if (!fs.existsSync(site(builtRel))) {
    bad('收录', t.slug, `产物缺 ${builtRel}（源页有 permalink 却没建出来，通常是 permalink 与 url 不一致）`);
    checkPageSource(t);
    continue;
  }
  const built = readSite(builtRel);
  checkPageSource(t);
  checkInclusion(t, built, pageUrlRel);
  checkNav(built, t);
  checkIcon(t);
  checkDomContract(t, built, specs.get(t.slug));
}

auditNavSiteWide();

/** 反向一条：planned 条目不该出现在任何收录面上（"先进清单、后补正文"最容易漏的就是这里） */
for (const t of toolsData.filter((x) => x.status !== 'ready')) {
  const surfaces = ['sitemap.xml', 'llms.txt', 'index-all.html', 'tools.html'].filter((f) => {
    try { return readSite(f).includes(t.url); } catch { return false; }
  });
  if (surfaces.length) bad('收录-反向', t.slug, `status 不是 ready，却已出现在 ${surfaces.join(' / ')} 里`);
}

if (fails.length) {
  for (const f of fails) console.log('✗ ' + f);
  console.log(`✗ 收录面门禁：${fails.length} 条不通过`);
  process.exit(1);
}
console.log(`✓ 收录面 ${ready.length} 条 ready 条目 × 5 组判据全绿（页面源/收录/导航/图标/DOM）`);
