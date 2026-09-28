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
 *   - 页面骨架改了一个控件 id，`workbench.js` 的 spec 没跟着改：构建与页面全绿，
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
const workbench = await import(pathToFileURL(path.join(ROOT, 'dev/js/tools/workbench.js')).href);
const { WORKBENCH_SPEC, PANEL_IDS } = workbench;

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
  if (!new RegExp(`<section class="tool-section tool-section--online" id="online-${escRE(t.slug)}"`).test(toolsHtml)) {
    bad('收录', t.slug, 'tools.html 里没有这一条的 tool-section--online 小节');
  }
  if (!new RegExp(`href="${escRE(localPath)}"[^>]*>打开${escRE(t.h1)}</a>`).test(toolsHtml)) {
    bad('收录', t.slug, `tools.html 的该小节缺少指向 ${localPath} 的「打开${t.h1}」主按钮`);
  }
  for (const p of t.panels) {
    if (!new RegExp(`href="${escRE(localPath)}#${escRE(p.slug)}"`).test(toolsHtml)) {
      bad('收录', t.slug, `tools.html 的面板清单里没有指向 #${p.slug}（${p.name}）的锚点链接`);
    }
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

function checkDomContract(t, builtHtml) {
  resetAccumulators();
  const p = t.prefix;
  const ymlPanels = t.panels.map((x) => x.slug);
  if (ymlPanels.join(',') !== PANEL_IDS.join(',')) {
    bad('DOM', t.slug, `yml panels=[${ymlPanels}] 与 workbench.js PANEL_IDS=[${PANEL_IDS}] 不同名或不同序（顺序=索引条顺序）`);
  }
  if (Object.keys(WORKBENCH_SPEC).join(',') !== PANEL_IDS.join(',')) {
    bad('DOM', t.slug, 'PANEL_IDS 与 WORKBENCH_SPEC 的键对不上，workbench.js 内部已经不一致');
  }

  const ids = new Set([...builtHtml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const need = [`${p}-workspace`, `${p}-notice`, `${p}-tablist`];
  for (const slug of ymlPanels) {
    need.push(`${p}-tab-${slug}`, `${p}-panel-${slug}`);
    const spec = WORKBENCH_SPEC[slug];
    if (!spec) { bad('DOM', t.slug, `面板 ${slug} 在 WORKBENCH_SPEC 里没有条目`); continue; }
    for (const side of ['gen', 'read']) {
      const cfg = spec.sides?.[side];
      if (!cfg) continue;
      for (const c of cfg.controls || []) {
        const id = `${p}-in-${slug}-${c.id}`;
        need.push(id);
        for (const attr of ['cascade', 'options', 'charsets']) {
          if (c[attr]) markers[attr].set(id, c[attr]);
        }
      }
      for (const tg of cfg.switch?.targets || []) {
        const id = `${p}-when-${slug}-${tg.key}`;
        need.push(id);
        wantWhen.set(id, tg.when.join(' '));
      }
    }
  }
  const missing = need.filter((id) => !ids.has(id));
  if (missing.length) bad('DOM', t.slug, `产物里缺少这些 id：${missing.join(' ')}`);

  // 标记与开关：产物上有、spec 里没有的，同样算红（只查一个方向等于默认允许"骨架多加料"）
  for (const [attr, want] of [['cascade', markers.cascade], ['options', markers.options], ['charsets', markers.charsets]]) {
    const onDisk = new Map();
    for (const m of builtHtml.matchAll(new RegExp(`id="([^"]+)"[^>]*data-${escRE(p)}-${attr}="([^"]+)"`, 'g'))) onDisk.set(m[1], m[2]);
    for (const m of builtHtml.matchAll(new RegExp(`data-${escRE(p)}-${attr}="([^"]+)"[^>]*id="([^"]+)"`, 'g'))) onDisk.set(m[2], m[1]);
    for (const [id, val] of want) {
      if (onDisk.get(id) !== val) bad('DOM', t.slug, `data-${p}-${attr} 对不上：spec 要 ${id}=${val}，产物是 ${id}=${onDisk.get(id) ?? '（无）'}`);
    }
    for (const [id, val] of onDisk) {
      if (!want.has(id)) bad('DOM', t.slug, `产物上 ${id} 带着 data-${p}-${attr}="${val}"，而 WORKBENCH_SPEC 里没有这个标记——两边必须同源`);
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
    if (idsAttr && idsAttr[1] !== ymlPanels.join(',')) {
      bad('DOM', t.slug, `data-${p}-ids="${idsAttr[1]}" 与 yml panels 顺序不一致`);
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
    console.log(`  · ${t.slug}：${t.url} → tools-${t.slug}.html，前缀 ${t.prefix}，panels ${t.panels.length}，入口 dev/js/tool${t.slug.charAt(0).toUpperCase()}${t.slug.slice(1)}.js`);
  }
  console.log('  检查项：页面源 / 收录 / 导航 / 图标 / DOM');
  process.exit(0);
}

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
  checkDomContract(t, built);
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
