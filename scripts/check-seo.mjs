#!/usr/bin/env node
/**
 * SEO / AEO / 安装面 / 性能接线的一站式自证器（设计文档 §6「门禁化」那一节）。
 *
 * 为什么合成一本而不是九本：这九族事实有一条共同的失效形状——**写错不报错**。
 *   - `_data/modified.yml` 的 key 打错一个字符：Jekyll 绿、页面绿，只是那一篇的
 *     `dateModified` 从此不再输出（缺席比伪造好，但这里的原因是拼写而不是事实）；
 *   - `_data/manifestIcons.yml` 与磁盘上的 png 漂开：manifest 照常渲染，Chrome 装不上，
 *     控制台只在用户点「安装」那一下才给一行字；
 *   - `head.html` 与 `postHead.html` 是复制关系，任何一边漏一条 link 都不报错，
 *     而两页坏的样子完全不同（文章页缺 manifest = 从文章页加主屏拿不到图标）。
 * 一本脚本、一组一组的判据（组数由文件末尾的 `GROUPS` 决定，`node scripts/check-seo.mjs --list`
 * 打印当前口径），跑一次就把「这条链今天到底还连着吗」问完；分九本只会让
 * 「今天没空跑第九本」变成常态。
 *
 * 判据口径两条硬规矩（沿用 check-tools-surface.mjs）：
 *   1. 凡是「源与产物各读一份再比」的，两边都取实际值，不写死字面量——写死的数字一过期，
 *      判据就从「能红」退化成「只能红在这一格」。语料条数因此一律不钉：另一个会话正在
 *      往 `_posts/` 里加稿，本仓 `_site` 的 html 页数两周内从 135 涨到 137。
 *   2. `_site` 缺失或比源旧时报错而不是跳过——跳过会让它在没重新构建的机器上永远绿。
 *
 * 用法：
 *   node scripts/check-seo.mjs                        # 读 _site/
 *   node scripts/check-seo.mjs --site=/tmp/x/site     # 指定产物目录（隔离快照、影子目录）
 *   node scripts/check-seo.mjs --root=/tmp/x/repo     # 指定源目录（牙齿台账与干净检出树）
 *   node scripts/check-seo.mjs --verify               # 追加重算 _data/modified.yml 指纹
 *   node scripts/check-seo.mjs --list                 # 只打印各组判据（组数随 GROUPS）与当前口径
 *   node scripts/check-seo.mjs --stale-ok             # 跳过新鲜度门（牙齿台账专用，见下）
 *
 * 失败形状：每条 `[组名] 条目：说明`，末尾给总数，退出码 1。
 *
 * 每一组都有自己的牙齿台账：`scripts/check-seo-teeth.mjs`。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
/**
 * 源侧根目录：默认就是本仓库。`--root=` 是给两件事用的——
 * 牙齿台账要把「判据读到的源」换一份（影子 `_data`、影子 `_includes`），
 * 而干净检出树（`git archive HEAD` 导出）可以用它自证「仓库里现在这些东西是绿的」。
 */
const rootArg = argv.find((a) => a.startsWith('--root='));
const ROOT = rootArg ? path.resolve(rootArg.slice(7)) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIST_ONLY = argv.includes('--list');
const VERIFY = argv.includes('--verify');
const STALE_OK = argv.includes('--stale-ok');
const SITE = path.resolve(ROOT, (argv.find((a) => a.startsWith('--site=')) || '--site=_site').slice(7));

const fails = [];
/** 记一条失败：组名 + 条目 + 人话说明，末尾统一计数打印 */
function bad(group, entry, msg) {
  fails.push(`[${group}] ${entry}：${msg}`);
}

/**
 * 崩了也要把已经记下的判定吐干净。
 *
 * 判定是攒在 `fails` 里、跑到最后才打印的，所以任何一处未捕获的异常会把前面所有红一并吞掉：
 * 退出码仍是非 0，看着像"门禁红了"，实际上一条判定都没报——牙齿台账里那种"红了但没红在
 * 指定组"的形状，绝大多数就是这么来的。这里补一道兜底：把攒着的判定先打出来，再以 2 退出，
 * 让"崩溃"和"判定"在退出码上就是两件事（1 = 有红，2 = 门禁自己没跑完）。
 */
process.on('uncaughtException', (e) => {
  for (const f of fails) console.log('✗ ' + f);
  console.error(`✗ SEO 门禁：跑到一半崩了（已记 ${fails.length} 条判定，末尾的组一条没跑）：${e && e.stack ? e.stack : e}`);
  process.exit(2);
});

/** 把要进正则的字面量转义掉；声明在这里是因为组 0 的 paginate 正则就要用它 */
const escRE = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 找出 `<article id="post-body">` 这个元素的区间，返回 `{start, end}`（正文标签内、
 * 不含首尾标签本身）；找不到就返回 null。
 *
 * 为什么要按元素配对扫而不是一路找到第一个 `</article>`：正文里合法地嵌得到别的
 * `<article>`（手写的示例片段），第一个闭合标签关掉的可能是里面那一层。
 * 代码围栏里的 `<article>` 以 `&lt;` 的形式存在，不会被这趟扫描认成标签。
 */
function postBodyRegion(text) {
  let depth = 0;
  let openAt = null;
  let start = -1;
  for (const m of text.matchAll(/<(\/)?article\b[^>]*>/gi)) {
    if (m[1]) {
      if (openAt !== null && depth === openAt) return { start, end: m.index };
      depth -= 1;
      if (depth < 0) depth = 0;
    } else {
      depth += 1;
      if (openAt === null && /\bid="post-body"/.test(m[0])) {
        openAt = depth;
        start = m.index + m[0].length;
      }
    }
  }
  return null;
}

// ── 读入 ──────────────────────────────────────────────────────────────────────

/**
 * 源侧的结构化读入一次做完：五本 yml 加 `_posts/*.md` 的 front matter。
 *
 * 为什么合成一趟 ruby：分开读是六次进程冷启动，而这道门禁要跟着牙齿台账跑三十多轮，
 * 光冷启动就占掉一半时间。
 * 为什么交给 ruby 而不是自己写 YAML 子集解析器：`tags` 要同时认 `a b c`（空格分隔串，
 * Jekyll 自己拆成数组）与 `[a, b]`（列表），`categories` 只用列表，`date` 可能是 Date
 * 也可能是带时区的串——这些正是 YAML 的边界，手写的子集解析器迟早和 Liquid 读到不一样的东西。
 * 脚本体保持纯 ASCII：`ruby -e` 的输入按 locale 解码，字面量里放中文会整段崩成
 * "invalid multibyte char"，而崩掉的形状是"读不到任何一篇稿子"。
 */
function readSources() {
  const script = `
    require "yaml"; require "json"
    def yload(p)
      YAML.load_file(p)
    rescue StandardError => e
      { "__error__" => e.class.to_s }
    end
    root = ARGV[0]
    out = {
      "config" => yload(File.join(root, "_config.yml")),
      "onlineTools" => yload(File.join(root, "_data/onlineTools.yml")),
      "manifestIcons" => yload(File.join(root, "_data/manifestIcons.yml")),
      "series" => yload(File.join(root, "_data/series.yml")),
      "modified" => {},
      "posts" => {}
    }
    modp = File.join(root, "_data/modified.yml")
    out["modified"] = File.file?(modp) ? yload(modp) : {}
    Dir.glob(File.join(root, "_posts", "*.md")).sort.each do |f|
      t = File.read(f, mode: "rb:UTF-8")
      m = /\\A---\\r?\\n(.*?)\\r?\\n---/m.match(t)
      if !m
        out["posts"][File.basename(f)] = { "__error__" => "no-front-matter" }
        next
      end
      begin
        out["posts"][File.basename(f)] = YAML.load(m[1]) || {}
      rescue StandardError
        out["posts"][File.basename(f)] = { "__error__" => "bad-yaml" }
      end
    end
    puts out.to_json
  `;
  let out;
  try {
    out = execFileSync('ruby', ['-e', script, ROOT], {
      encoding: 'utf8',
      maxBuffer: 32 << 20,
    });
  } catch (e) {
    throw new Error(`ruby 读源失败（需要 ruby + yaml，Jekyll 构建本来就依赖它）：${e.message}`);
  }
  // ruby -e 会往 stdout 打 RubyGems 的警告行，JSON 只认最后一行
  return JSON.parse(out.trim().split('\n').pop());
}

const SOURCES = readSources();
/** 五本 yml 里任何一本读不出来都没法继续：后面各组判据全部以它们为口径 */
for (const [key, file] of [
  ['config', '_config.yml'],
  ['onlineTools', '_data/onlineTools.yml'],
  ['manifestIcons', '_data/manifestIcons.yml'],
  ['series', '_data/series.yml'],
  ['modified', '_data/modified.yml'],
]) {
  const v = SOURCES[key];
  if (v && v.__error__) {
    console.error(`✗ SEO 门禁：${file} 解析失败（${v.__error__}），各组判据的口径全部失效，先修这一本再跑`);
    process.exit(1);
  }
}
const config = SOURCES.config || {};
const toolsData = SOURCES.onlineTools;
const manifestData = SOURCES.manifestIcons;
const modifiedData = SOURCES.modified || {};
const seriesData = SOURCES.series || [];

const BASEURL = String(config.baseurl || '');
const SITE_URL = String(config.url || '').replace(/\/$/, '');
/** 规范首页地址：manifest 的 start_url / scope / ItemList 的第 1 条面包屑都以它为锚 */
const HOME_ABS = `${SITE_URL}${BASEURL}/`;
const paginatePath = String(config.paginate_path || 'page:num');
/**
 * 翻页视图的地址形状由 paginate_path 决定（`page:num` → /page2/ … /pageN/）。
 * 占位符是带冒号的 `:num`，不是 `num`——只换 `num` 会剩下 `page:\d+`，一条都匹配不上，
 * 而这条正则同时喂给安装面范围和站点级实体两道判据，所以它必须在这儿就把自己验一遍。
 * 安装面的范围判据和站点级实体的反向判据都要认这批页，页数跟着语料涨落，不在任何一处写死。
 */
function buildPageRe(pp) {
  const parts = String(pp).split(':num');
  if (parts.length !== 2) {
    console.error(`✗ SEO 门禁：_config.yml 的 paginate_path=${JSON.stringify(String(pp))} 里没有且只有一个 :num 占位符，翻页视图判据失去形状，须同步改这里`);
    process.exit(1);
  }
  return new RegExp(`^${escRE(parts[0])}\\d+${escRE(`${parts[1]}/index`)}\\.html$`);
}
const PAGE_RE = buildPageRe(paginatePath);

/** Jekyll 把空格分隔的 tags 串拆成数组；categories 只有列表写法。两边都归一到这里 */
function asList(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.trim().split(/\s+/).filter(Boolean);
  return [];
}
/** front matter 的 date 归一到 'YYYY-MM-DD'（Ruby 的 Date 序列化成串，带时间的取前 10 位） */
function dayOf(v) {
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

// ── 产物 ──────────────────────────────────────────────────────────────────────

if (!fs.existsSync(SITE)) {
  console.error(`✗ SEO 门禁：找不到产物目录 ${path.relative(ROOT, SITE)}；先构建（跳过检查的"绿"不算绿）`);
  process.exit(1);
}

const htmlFiles = [];
(function walk(dir, prefix) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) walk(abs, rel);
    else if (e.name.endsWith('.html')) htmlFiles.push(rel);
  }
})(SITE, '');
if (htmlFiles.length === 0) {
  console.error(`✗ SEO 门禁：${path.relative(ROOT, SITE)}/ 里一个 .html 都没有——这不是产物目录`);
  process.exit(1);
}

const textCache = new Map();
/** 读产物文本；缺文件直接抛（静默返回空串会让整组判据假绿） */
function readSite(rel) {
  if (!textCache.has(rel)) {
    const p = path.join(SITE, rel);
    if (!fs.existsSync(p)) throw new Error(`产物缺失：${rel}`);
    textCache.set(rel, fs.readFileSync(p, 'utf8'));
  }
  return textCache.get(rel);
}
const hasSite = (rel) => fs.existsSync(path.join(SITE, rel));
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * 新鲜度门：源侧任何一本比产物里最新那份还新，就是在拿旧产物核新规则。
 * --stale-ok 给牙齿台账用：影子目录里源与产物都是刚复制出来的，这条判据在那儿没有意义。
 */
{
  const newestIn = (dir, exts) => {
    let max = 0;
    const stack = [path.join(ROOT, dir)];
    while (stack.length) {
      const d = stack.pop();
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const abs = path.join(d, e.name);
        if (e.isDirectory()) stack.push(abs);
        else if (exts.some((x) => e.name.endsWith(x))) max = Math.max(max, fs.statSync(abs).mtimeMs);
      }
    }
    return max;
  };
  let siteNewest = 0;
  const stack = [SITE];
  while (stack.length) {
    const d = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) stack.push(abs);
      else siteNewest = Math.max(siteNewest, fs.statSync(abs).mtimeMs);
    }
  }
  const sources = [newestIn('_data', ['.yml']), newestIn('_includes', ['.html']), newestIn('_layouts', ['.html']), newestIn('_posts', ['.md']), fs.statSync(path.join(ROOT, '_config.yml')).mtimeMs];
  const newest = Math.max(...sources);
  if (newest > siteNewest && !STALE_OK) {
    console.error(`✗ SEO 门禁：源比产物新（源侧最新 ${new Date(newest).toISOString()}，产物最新 ${new Date(siteNewest).toISOString()}）；` + '先重新构建再跑（拿旧 _site 核新规则，红的和绿的都不是真的）');
    process.exit(1);
  }
}

// ── 小工具 ────────────────────────────────────────────────────────────────────

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};
/** 只解 Liquid xml_escape 会写出的那几个 + 数字实体；可见文案与 JSON 字符串比对前先归一 */
function decode(s) {
  return String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (all, body) => {
    if (body[0] === '#') {
      const cp = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : all;
    }
    return ENTITIES[body.toLowerCase()] ?? all;
  });
}
const grabAll = (text, re) => {
  const out = [];
  let m;
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  while ((m = r.exec(text))) out.push(m);
  return out;
};
/** 取 <head> 区间（含两个标签本身），口径与设计文档 §6 的 head 字节测量一致 */
const headOf = (text) => {
  const a = text.indexOf('<head>');
  const b = text.indexOf('</head>');
  return a >= 0 && b > a ? text.slice(a, b + '</head>'.length) : '';
};
/** JSON-LD 块：返回值带字节偏移，ItemList 那一族要用位置判据 */
function jsonLdBlocks(text) {
  const out = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(text))) {
    let value = null;
    let error = null;
    try {
      value = JSON.parse(m[1]);
    } catch (e) {
      error = e.message;
    }
    out.push({ start: m.index, raw: m[1], value, error });
  }
  return out;
}
const typesOf = (block) => {
  if (!block.value) return [];
  const t = block.value['@type'];
  return Array.isArray(t) ? t : [t].filter(Boolean);
};
/** 相对地址 ↔ 绝对地址互转（产物里两种都有，比对前先落到同一边） */
const toAbs = (relish) => (relish.startsWith('http') ? relish : `${SITE_URL}${BASEURL}${relish.replace(/^\//, '')}`);
const toLocal = (absOrRel) => {
  let p = String(absOrRel);
  if (p.startsWith(SITE_URL)) p = p.slice(SITE_URL.length);
  if (BASEURL && p.startsWith(BASEURL)) p = p.slice(BASEURL.length);
  return p.startsWith('/') ? p : `/${p}`;
};
const sha256 = (abs) => crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');

/**
 * 页面的「源」侧信息：layout、permalink、noindex、tool 这些标量按行取。
 * 这里只需要标量，所以不必再开一次 ruby（数组字段只在 _posts 那条链上用到）。
 */
function srcFrontMatter(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(abs, 'utf8'));
  if (!m) return null;
  const scalar = (k) => {
    const line = new RegExp(`^${escRE(k)}:[ \\t]*(.*)$`, 'm').exec(m[1]);
    if (!line) return null;
    return line[1].trim().replace(/^["']|["']$/g, '');
  };
  return {
    raw: m[1],
    layout: scalar('layout'),
    permalink: scalar('permalink'),
    noindex: scalar('noindex'),
    tool: scalar('tool'),
  };
}

// ── 页面分类：谁走布局、谁不走 ───────────────────────────────────────────────

/** 布局里引了 head.html 或 postHead.html 的，就是「带安装面的那批」；判据从布局本身取 */
const headLayouts = fs
  .readdirSync(path.join(ROOT, '_layouts'))
  .filter((f) => f.endsWith('.html'))
  .filter((f) => {
    const t = readSrc(`_layouts/${f}`);
    return /{%\s*include\s+(head|postHead)\.html/.test(t);
  })
  .map((f) => f.replace(/\.html$/, ''));
if (headLayouts.length === 0) {
  console.error('✗ SEO 门禁：没有任何 _layouts 引 head.html / postHead.html——安装面判据的范围塌成空集，这本身就是要红的事');
  process.exit(1);
}

/**
 * 源页 → 产物路径。Jekyll 的 permalink 有两种落法：以 `.html` 结尾就是它自己，
 * 以 `/` 结尾是 `<dir>/index.html`，其余补 `.html`。站内现在只用第一种（外加没有
 * permalink 的 index.html / demo/**），三种都写出来是因为这条映射一变，
 * 「谁该有安装面」的范围就跟着漂，而漂的方式是静默少核几页。
 */
function builtRelOfSrc(rel, fm) {
  const p = fm?.permalink;
  if (!p) return rel;
  if (/\.html$/.test(p)) return p.replace(/^\//, '');
  if (p.endsWith('/')) return `${p.replace(/^\//, '')}index.html`;
  return `${p.replace(/^\//, '')}.html`;
}

/** 会被 Jekyll 当页面渲染的源目录：`_` 开头的那些、构件与本地工务目录都不算 */
const SRC_SKIP_DIRS = new Set(['_data', '_drafts', '_includes', '_layouts', '_plugins', '_posts', '_sass', '_site']);
function listSourcePages(dir = '', out = []) {
  const abs = path.join(ROOT, dir);
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (!e.isDirectory() && !e.name.endsWith('.html')) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (e.name.startsWith('.') || ['node_modules', 'vendor', 'assets', 'dev', 'scripts', 'fixtures'].includes(e.name)) continue;
      if (SRC_SKIP_DIRS.has(e.name)) continue;
      listSourcePages(rel, out);
    } else out.push(rel);
  }
  return out;
}

/** 每个源页算一次它的产物落点；落点上没有文件，就是这一页压根没建出来 */
const srcPages = listSourcePages().map((rel) => {
  const fm = srcFrontMatter(rel);
  return {
    srcRel: rel,
    fm,
    builtRel: builtRelOfSrc(rel, fm),
    source: readSrc(rel),
  };
});
for (const p of srcPages) {
  if (p.fm?.layout && !hasSite(p.builtRel)) bad('语料', p.srcRel, `带 layout: ${p.fm.layout} 的源页没建出 ${p.builtRel}（permalink 与产物对不上）`);
}

const postRelSet = new Set();
for (const rel of htmlFiles) if (/^\d{4}\//.test(rel)) postRelSet.add(rel);

/** 带安装面的产物页 = 用了引 head.html / postHead.html 那本布局的源页 + 文章页 + 翻页视图 */
const inScope = new Set([...srcPages.filter((p) => p.fm?.layout && headLayouts.includes(p.fm.layout)).map((p) => p.builtRel), ...postRelSet, ...htmlFiles.filter((r) => PAGE_RE.test(r))]);

// ── 文章页：源 ↔ 产物配对 ─────────────────────────────────────────────────────

/**
 * 一篇稿子 → 产物相对路径。
 * `:year/:month/:day` 取的是 **front matter date**（实测 2019-01-25-build-private-package.md
 * 的 date 写 2019-01-24，产物就落在 2019-01-24/ 下——文件名那一串只是 Jekyll 的默认值），
 * slug 取文件名里日期段之后那截。`_config.yml` 的 permalink 必须是 `/:year/:month/:day/:title.html`，
 * 否则这套映射整个失效，所以先在下面判它。
 */
function postBuiltRel(fileName, fm) {
  const m = /^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/.exec(fileName);
  if (!m) return null;
  const day = dayOf(fm.date) || `${m[1]}-${m[2]}-${m[3]}`;
  return `${day.replace(/-/g, '/')}/${m[4]}.html`;
}
if (String(config.permalink || '') !== '/:year/:month/:day/:title.html') {
  console.error(`✗ SEO 门禁：_config.yml 的 permalink 不是 /:year/:month/:day/:title.html（实际 ${JSON.stringify(config.permalink)}），本门禁的「稿子 ↔ 产物」映射失效，须同步改这里`);
  process.exit(1);
}

const postsRaw = SOURCES.posts || {};
/**
 * 解析条数必须等于 `_posts/*.md` 的文件数。少一条就是 ruby 那一段自己坏了（正则漏了 `m`
 * 标志、编码变了、glob 改写没落全等），坏法会让下面所有以「源在前」为口径的判据集体哑火——
 * 与其让 79 篇各红一次，不如先在这里红一次并把名字报出来。
 */
{
  const mdFiles = fs.readdirSync(path.join(ROOT, '_posts')).filter((f) => f.endsWith('.md'));
  const missing = mdFiles.filter((f) => !(f in postsRaw));
  if (missing.length) bad('语料', '_posts', `ruby 解析只回来 ${Object.keys(postsRaw).length} 篇，目录里实有 ${mdFiles.length} 个 .md；没回来的：${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ' …' : ''}`);
}
/** @type {Array<{file:string,rel:string,fm:object,tags:string[],cats:string[],day:string}>} */
const posts = [];
const today = new Date().toISOString().slice(0, 10);
for (const [file, fm] of Object.entries(postsRaw)) {
  if (fm.__error__) {
    bad('语料', file, `front matter 读不出来（${fm.__error__ === 'bad-yaml' ? '不是合法 YAML' : '没有 --- 分界'}），这个文件的 tags／日期一律无法对账`);
    continue;
  }
  const rel = postBuiltRel(file, fm);
  if (!rel) {
    bad('语料', file, '文件名不是 YYYY-MM-DD-slug.md 形状，门禁无法推出它的产物地址');
    continue;
  }
  if (!hasSite(rel)) {
    const day = dayOf(fm.date) || file.slice(0, 10);
    if (day > today) continue; // 未来稿：Jekyll 默认不渲染，不是缺件
    bad('语料', file, `稿子存在、日期不是未来，产物里却没有 ${rel}（permalink 或 front matter 有一处被改过）`);
    continue;
  }
  posts.push({
    file,
    rel,
    fm,
    tags: asList(fm.tags),
    cats: asList(fm.categories),
    day: dayOf(fm.date) || file.slice(0, 10),
  });
}
const postByUrl = new Map();
for (const p of posts) postByUrl.set(`/${p.rel}`, p);

const postPages = htmlFiles.filter((r) => postRelSet.has(r)).map((r) => ({ rel: r, text: readSite(r) }));
for (const p of postPages) {
  if (!postByUrl.has(`/${p.rel}`)) bad('语料', p.rel, '产物里这是一篇文章页（带 article:published_time），却对不上任何一篇 _posts——本门禁的判据全都以「源在前、产物在后」为口径');
}

// ── 组 1：keywords ────────────────────────────────────────────────────────────

const KW_RE = /<meta name="keywords"\s+content="([^"]*)"/;
const TAG_RE = /<meta property="article:tag" content="([^"]*)"/;

for (const { rel, text } of postPages) {
  const src = postByUrl.get(`/${rel}`);
  if (!src) continue;
  const m = KW_RE.exec(text);
  const tagsMeta = grabAll(text, TAG_RE).map((x) => decode(x[1]));
  if (src.tags.length === 0) {
    if (m) bad('keywords', rel, `这篇源里没有 tags，产物却输出了 keywords=「${m[1]}」（无 tags 的页面必须一条都不发）`);
    if (tagsMeta.length) bad('keywords', rel, '没有 tags 的稿子渲染出了 article:tag');
    continue;
  }
  if (!m) {
    bad('keywords', rel, `源里 tags 有 ${src.tags.length} 个，产物里没有 keywords meta`);
  } else {
    const got = decode(m[1]).split(',');
    if (got.join(', ') !== src.tags.join(', ')) bad('keywords', rel, `keywords=「${got.join(',')}」与源里的 tags=「${src.tags.join(',')}」不同序或不同值`);
    const commaTag = src.tags.find((t) => t.includes(','));
    if (commaTag) bad('keywords', rel, `tags 里有含逗号的「${commaTag}」，join(',') 出来的那串会被爬虫切坏，请换词`);
  }
  if (tagsMeta.join(', ') !== src.tags.join(', ')) bad('keywords', rel, `article:tag 序列与源里 tags 不一致（产物 ${tagsMeta.join(', ')}）`);
}
for (const { rel, text } of htmlFiles.filter((r) => !postRelSet.has(r)).map((r) => ({ rel: r, text: readSite(r) }))) {
  const m = KW_RE.exec(text);
  if (m) bad('keywords', rel, `非文章页输出了 keywords=「${m[1]}」——这一族页面没有 page.tags，值只能来自兜底，而兜底正是本轮拆掉的东西`);
}
if (config.keyword) {
  const hits = [];
  (function scan(dir, prefix) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) scan(abs, rel);
      else if (/\.(html|xml|txt|json|js|css|md)$/.test(e.name) && fs.statSync(abs).size < 4 << 20) {
        if (fs.readFileSync(abs, 'utf8').includes(String(config.keyword))) hits.push(rel);
      }
    }
  })(SITE, '');
  if (hits.length) bad('keywords', '全站', `_config.yml 的 site.keyword 原串仍出现在 ${hits.slice(0, 5).join(' / ')}${hits.length > 5 ? ` 等 ${hits.length} 个文件` : ''}——全站同值的 keywords 已判为负资产，不许有任何一处回潮`);
}

// ── 组 2：modified（真实修订时间） ────────────────────────────────────────────

const MOD_META_RE = /<meta property="article:modified_time" content="([^"]*)"/;
for (const key of Object.keys(modifiedData)) {
  if (!postByUrl.has(key)) bad('modified', key, '台账里有这一条，产物里却没有对应的文章页（url 打错，或那篇已删而台账没跟着删）');
}
for (const p of posts) {
  const entry = modifiedData[`/${p.rel}`];
  const text = readSite(p.rel);
  const at = entry?.at ?? null;
  const want = at && dayOf(at) !== p.day ? String(at) : null;
  const m = MOD_META_RE.exec(text);
  const hasMeta = Boolean(m);
  if (!!want !== hasMeta) {
    bad('modified', p.rel, want ? '台账里有跨日的修订，产物却没有 article:modified_time（pageModified.html 那条链断在 seoMeta 之前）' : `产物输出了 article:modified_time=${m?.[1]}，而台账里没有跨日修订的条目（同日守卫或「缺席比伪造好」被绕过）`);
  }
  if (want && m && m[1] !== want) bad('modified', p.rel, `article:modified_time=${m[1]} 与台账 at=${want} 不等`);
  const ld = jsonLdBlocks(text).find((b) => typesOf(b).includes('BlogPosting'));
  const ldMod = ld?.value?.dateModified;
  if ((ldMod ?? null) !== (want ?? null) && !(want === null && ldMod === undefined)) bad('modified', p.rel, `BlogPosting.dateModified=${JSON.stringify(ldMod)} 与 article:modified_time 不同值——同一篇的修订时间有两个口径`);

  if (entry) {
    if (dayOf(entry.at) < p.day) bad('modified', p.rel, `修订日 ${dayOf(entry.at)} 早于发布日 ${p.day}（git 推导不会给出这种值，台账被手改过）`);
    if (entry.published && dayOf(entry.published) !== p.day) bad('modified', p.rel, `台账 published=${entry.published} 与这篇 front matter 的 date=${p.day} 不等`);
    if (entry.commit && !/^[0-9a-f]{7,40}$/.test(String(entry.commit))) bad('modified', p.rel, `commit=「${entry.commit}」不是短 sha 形状，无法 git show 复核`);
  }
}
if (VERIFY) {
  const r = spawnSync('node', [path.join(ROOT, 'scripts/build-modified-data.mjs'), '--verify'], { encoding: 'utf8' });
  if (r.status !== 0) bad('modified', '台账', `build-modified-data.mjs --verify 退出码 ${r.status}：${(r.stdout || r.stderr || '').trim().split('\n').slice(-3).join(' / ')}`);
}

/** sitemap 的 <lastmod> 与 meta 同口径：两处不同值时，引擎拿到的是哪一份取决于它先读哪一个 */
const HAS_SITEMAP = hasSite('sitemap.xml');
if (!HAS_SITEMAP) bad('modified', 'sitemap.xml', '产物里没有 sitemap.xml——收录清单整块不在，逐篇的 <url>／<lastmod> 这一轮不数（免得 78 条「漏一篇」盖住这一条）');
const sitemap = HAS_SITEMAP ? readSite('sitemap.xml') : '';
const urlBlocks = grabAll(sitemap, /<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]*)<\/lastmod>)?/);
const lastmodByUrl = new Map(urlBlocks.map((m) => [toLocal(m[1]), m[2] ?? null]));
for (const p of HAS_SITEMAP ? posts : []) {
  const lm = lastmodByUrl.get(`/${p.rel}`);
  if (lm === undefined) {
    bad('modified', p.rel, 'sitemap.xml 里没有这一条 <url>（收录清单漏一篇；Liquid 循环被非法写法吞掉时就是这个形状）');
    continue;
  }
  const entry = modifiedData[`/${p.rel}`];
  const wantDay = entry && dayOf(entry.at) !== p.day ? dayOf(entry.at) : p.day;
  if (lm !== wantDay) bad('modified', p.rel, `sitemap <lastmod>=${lm} 与复算应为 ${wantDay}（台账与 meta 是同一口径，sitemap 不许另写一份 post.date）`);
}

// ── 组 3：JSON-LD ─────────────────────────────────────────────────────────────

const personId = `${SITE_URL}${BASEURL}/about.html#author`;
let blockTotal = 0;
for (const rel of htmlFiles) {
  const blocks = jsonLdBlocks(readSite(rel));
  for (const b of blocks) {
    blockTotal += 1;
    if (b.error) bad('JSON-LD', rel, `有一块不是合法 JSON：${b.error}（整块对爬虫等于不存在，且校验器只会说「无结构化数据」）`);
  }
}

const noindexSrc = srcPages.filter((p) => p.fm?.noindex && p.fm.noindex !== 'false').map((p) => p.builtRel);
for (const rel of noindexSrc) {
  if (!hasSite(rel)) continue; // 缺件已在「语料」组记过红，这里 readSite 会直接抛
  const n = jsonLdBlocks(readSite(rel)).length;
  if (n) bad('JSON-LD', rel, `这一页 front matter 写了 noindex，产物里却有 ${n} 块结构化数据——noindex 是整站唯一的收录开关，一边说别收一边递 BlogPosting 等于两个开关`);
}

for (const p of posts) {
  const text = readSite(p.rel);
  const blocks = jsonLdBlocks(text).filter((b) => !b.error);
  const blog = blocks.filter((b) => typesOf(b).includes('BlogPosting'));
  const crumb = blocks.filter((b) => typesOf(b).includes('BreadcrumbList'));
  if (blog.length !== 1) bad('JSON-LD', p.rel, `BlogPosting 块数=${blog.length}，文章页应为恰好 1`);
  if (crumb.length !== 1) bad('JSON-LD', p.rel, `BreadcrumbList 块数=${crumb.length}，文章页应为恰好 1`);
  const v = blog[0]?.value;
  if (!v) continue;
  if (v.headline !== p.fm.title) bad('JSON-LD', p.rel, `headline=${JSON.stringify(v.headline)} 与源里的 title=${JSON.stringify(p.fm.title)} 不等（headline 必须等于看见的 H1，不能走 seo_short_title）`);
  const h1 = /<h1 class="post-masthead-title">([^<]*)<\/h1>/.exec(text);
  if (h1 && decode(h1[1]) !== v.headline) bad('JSON-LD', p.rel, `headline 与该页可见的 <h1 class="post-masthead-title">不同值`);
  if (dayOf(v.datePublished) !== p.day) bad('JSON-LD', p.rel, `datePublished=${v.datePublished} 与源里的 date=${p.day} 不是同一天`);
  if (toLocal(v.url) !== `/${p.rel}`) bad('JSON-LD', p.rel, `url=${v.url} 与这篇的规范地址不同`);
  if (v.keywords !== (p.tags.length ? p.tags.join(', ') : '')) bad('JSON-LD', p.rel, `keywords=「${v.keywords}」与源里 tags 的 ', ' 拼接不等`);
  for (const who of ['author', 'publisher']) {
    if (v[who]?.['@id'] !== personId) bad('JSON-LD', p.rel, `${who}.@id=${v[who]?.['@id']} 不指向 ${personId}（作者实体只有 about.html 一处声明，@id 漂了就落在一个从未声明过的地址上）`);
  }
  const c = crumb[0]?.value;
  if (c) {
    const els = c.itemListElement || [];
    const pos = els.map((e) => e.position);
    if (pos.some((x, i) => x !== i + 1)) bad('JSON-LD', p.rel, `面包屑 position 序列=${pos.join(',')} 不是从 1 连续（早期写法 categories.size+1 在有 1 个分类时与分类自己撞位）`);
    if (els[0]?.name !== '首页' || els[0]?.item !== HOME_ABS) bad('JSON-LD', p.rel, `面包屑第 1 条不是首页 ${HOME_ABS}`);
    const last = els[els.length - 1];
    if (last?.name !== p.fm.title || toLocal(last?.item) !== `/${p.rel}`) bad('JSON-LD', p.rel, '面包屑最后一条不是本篇（标题或地址与 BlogPosting 不同口径）');
    const catCrumb = p.cats.length ? els[1] : null;
    if (p.cats.length) {
      if (els.length !== 3) bad('JSON-LD', p.rel, `有 ${p.cats.length} 个分类却给出 ${els.length} 条面包屑`);
      if (catCrumb?.name !== p.cats[0]) bad('JSON-LD', p.rel, `第 2 条面包屑=${JSON.stringify(catCrumb?.name)} 应为首个分类「${p.cats[0]}」`);
      if (!String(catCrumb?.item || '').includes('/categories.html#')) bad('JSON-LD', p.rel, '分类面包屑没指向 categories.html 的锚点');
    } else if (els.length !== 2) {
      bad('JSON-LD', p.rel, `这篇没有 categories，面包屑应为 2 条，实际 ${els.length} 条`);
    }
  }
}

/** 工具页：front matter 的 `tool:` 是识别键，不是拿 url 做字符串匹配 */
const toolPages = srcPages.filter((p) => p.fm?.tool).map((p) => ({ rel: p.builtRel, srcRel: p.srcRel, tool: p.fm.tool }));
const readyBySlug = new Map(toolsData.filter((t) => t.status === 'ready').map((t) => [t.slug, t]));
for (const { rel, srcRel, tool } of toolPages) {
  // 缺件那一头「语料」组已经记过红，这里再 readSite 只会把整轮判定崩掉
  if (!hasSite(rel)) continue;
  const text = readSite(rel);
  const t = readyBySlug.get(tool);
  if (!t) {
    bad('JSON-LD', srcRel, `front matter 写了 tool: ${tool}，_data/onlineTools.yml 里没有 status: ready 的同名条目（WebApplication 拿不到数据就是整块不发，页面看不出来）`);
    continue;
  }
  const blocks = jsonLdBlocks(text).filter((b) => !b.error);
  const wa = blocks.filter((b) => typesOf(b).includes('WebApplication'));
  if (wa.length !== 1) bad('JSON-LD', rel, `WebApplication 块数=${wa.length}，工具页应为恰好 1`);
  const cp = blocks.filter((b) => typesOf(b).includes('CollectionPage'));
  if (cp.length !== 1) bad('JSON-LD', rel, `CollectionPage 块数=${cp.length}，工具页应与 WebApplication 并存、各 1 块`);
  const v = wa[0]?.value;
  if (!v) continue;
  const h1 = /<h1 class="masthead-title">([\s\S]*?)<\/h1>/.exec(text);
  if (!h1) bad('JSON-LD', rel, '产物里找不到 <h1 class="masthead-title">，name 与可见标题的一致性无从核对');
  else if (decode(h1[1].replace(/<[^>]+>/g, '')).trim() !== v.name) bad('JSON-LD', rel, `name=「${v.name}」与页面上可见的 H1=「${decode(h1[1].replace(/<[^>]+>/g, '')).trim()}」不符（Google 要求两者一致）`);
  if (v.name !== t.h1) bad('JSON-LD', rel, `name 与 _data/onlineTools.yml 的 h1=「${t.h1}」不同值`);
  const desc = /<meta name="description" content="([^"]*)"/.exec(text);
  if (desc && decode(desc[1]) !== v.description) bad('JSON-LD', rel, 'WebApplication.description 与 meta description 不同口径（摘要与卡片不符是低质量信号）');
  if (toLocal(v.url) !== (t.url || `/${rel}`)) bad('JSON-LD', rel, `url=${v.url} 与 yml 里的 url=${t.url} 不同`);
  const wantFeat = t.features?.length ? t.features.map(String) : (t.panels || []).map((x) => String(x.name));
  if (JSON.stringify(v.featureList) !== JSON.stringify(wantFeat)) bad('JSON-LD', rel, `featureList 与 yml（features 优先，缺则 panels[].name）不同值或不同序`);
  if (v.applicationCategory !== 'DeveloperApplication') bad('JSON-LD', rel, 'applicationCategory 不是 DeveloperApplication');
  if (v.offers?.price !== 0) bad('JSON-LD', rel, 'offers.price 应为 0（这四个工具全部免费，声明出去就是假话）');
  if (v.author?.['@id'] !== personId) bad('JSON-LD', rel, 'author.@id 没指向 about.html#author');
  if (v.aggregateRating || v.review) bad('JSON-LD', rel, '出现了 aggregateRating / review——站内没有真实评分来源，这是 Google 明确处理的评价类作弊');
}
{
  const withWa = htmlFiles.filter((r) => /"@type": "WebApplication"/.test(readSite(r)));
  if (withWa.length !== toolPages.length) bad('JSON-LD', '全站', `带 WebApplication 的产物有 ${withWa.length} 页，源里带 tool: 的页面有 ${toolPages.length} 页——两处必须同集合`);
}

// about.html 是 Person.@id 指向的那一页
{
  const rel = builtRelOfSrc('about.html', srcFrontMatter('about.html'));
  if (!hasSite(rel)) bad('JSON-LD', rel, 'about.html 没建出来，全站 Person.@id 指向一个 404');
  else {
    const blocks = jsonLdBlocks(readSite(rel)).filter((b) => !b.error);
    const person = blocks.find((b) => typesOf(b).includes('Person'));
    if (!person) bad('JSON-LD', rel, '没有 Person 块——所有页面的 author.@id 都落在这个地址上，缺它等于引用一个从未声明的节点');
    else if (person.value['@id'] !== personId) bad('JSON-LD', rel, `Person.@id=${person.value['@id']} 与 post 页引用的 ${personId} 不等`);
    else if (person.value.name !== config.author_name) bad('JSON-LD', rel, `Person.name 与 _config.yml 的 author_name 不等`);
  }
}

// ── 组 4：分页视图 ────────────────────────────────────────────────────────────

{
  const pages = htmlFiles.filter((r) => PAGE_RE.test(r));
  const badTypes = [];
  for (const r of pages) {
    const types = jsonLdBlocks(readSite(r)).flatMap(typesOf);
    const hit = types.filter((t) => ['WebSite', 'Blog', 'Person', 'ItemList'].includes(t));
    if (hit.length) badTypes.push(`${r} → ${hit.join('/')}`);
  }
  if (badTypes.length) bad('分页门', '翻页视图', `${badTypes.slice(0, 3).join(' ; ')}——jekyll-paginate 复用同一份 index.html，不加 paginator.page == 1 那道门就会让 N 个 URL 各自声称自己是首页信息流`);
  if (pages.length === 0) bad('分页门', '全站', `按 paginate_path=${paginatePath} 推出来的翻页视图一个都没有，这条判据此刻无牙（配置被改过，或首页压根不分页了）`);
}

// ── 组 5：ItemList 与其位置 ───────────────────────────────────────────────────

{
  const listPages = srcPages.filter((p) => p.source.includes('jsonLdList.html'));
  const expectedHome = listPages.filter((p) => /list\s*=\s*['"]home['"]/.test(p.source)).map((p) => p.builtRel);
  const expectedSeries = listPages.filter((p) => /list\s*=\s*['"]series['"]/.test(p.source)).map((p) => p.builtRel);
  if (!expectedHome.length && !expectedSeries.length) bad('ItemList', '全站', '没有任何源页 include jsonLdList.html——这一族整块没了');
  const actual = htmlFiles.filter((r) => readSite(r).includes('"@type": "ItemList"'));
  const want = new Set([...expectedHome, ...expectedSeries]);
  for (const r of actual) if (!want.has(r)) bad('ItemList', r, '这一页发出 ItemList，但源里没有 include jsonLdList.html——判据范围与实现漂开');
  for (const r of want) if (!actual.includes(r)) bad('ItemList', r, '源里 include 了 jsonLdList.html，产物里却没有 ItemList 块（循环被 Liquid 写法吞掉时就是这个形状）');

  // 位置：ItemList 的大小与条目数成正比，落进 head 会把那一页头部顶高，所以整族必须在 </head> 之后
  for (const r of actual) {
    const text = readSite(r);
    const endHead = text.indexOf('</head>');
    for (const b of jsonLdBlocks(text).filter((x) => typesOf(x).includes('ItemList'))) {
      if (b.start < endHead) bad('ItemList', r, '有一块 ItemList 落在 <head> 里——这一族的记账口径是「head 一个字节都不占」');
    }
  }
}

/** 首页：块数、条数、顺序、值全部对着可见 <article> 复算 */
{
  const rel = 'index.html';
  const text = readSite(rel);
  const blocks = jsonLdBlocks(text).filter((b) => !b.error && typesOf(b).includes('ItemList'));
  if (blocks.length !== 1) bad('ItemList', rel, `首页 ItemList 块数=${blocks.length}，应为 1（第 1 页那一份）`);
  const mainStart = text.indexOf('<main');
  const mainEnd = text.indexOf('</main>');
  const mainRegion = mainStart >= 0 && mainEnd > mainStart ? text.slice(mainStart, mainEnd) : text;
  const articles = grabAll(mainRegion, /<article class="article-item">([\s\S]*?)<\/article>/);
  const visible = articles.map((a) => {
    const href = /<a class="post-link" href="([^"]+)"/.exec(a[1]);
    const title = /<h2 class="post-title">([\s\S]*?)<\/h2>/.exec(a[1]);
    return {
      href: href?.[1] ?? null,
      name: title ? decode(title[1].replace(/<[^>]+>/g, '')).trim() : null,
    };
  });
  const b = blocks[0];
  if (b) {
    const els = b.value.itemListElement || [];
    if (b.value.numberOfItems !== els.length) bad('ItemList', rel, `numberOfItems=${b.value.numberOfItems} 与 itemListElement 枚数=${els.length} 不等`);
    if (els.length !== visible.length) bad('ItemList', rel, `声明 ${els.length} 条、页面上可见 ${visible.length} 篇——声明页面上没有的内容是 Google 明确处理的 cloaking`);
    if (b.value.itemListOrder !== 'https://schema.org/ItemListOrderDescending') bad('ItemList', rel, '首页 ItemList 缺 itemListOrder: Descending（这一块的唯一新事实就是「这 8 条是全站最新」）');
    if (b.value.description !== undefined) bad('ItemList', rel, '首页 ItemList 写了 description——那个值只在 head 渲染期存在，正文里另算一遍就是第二处口径');
    for (let i = 0; i < Math.min(els.length, visible.length); i += 1) {
      if (els[i].position !== i + 1) bad('ItemList', rel, `第 ${i + 1} 条 position=${els[i].position}`);
      if (els[i].name !== visible[i].name) bad('ItemList', rel, `第 ${i + 1} 条 name 与可见 <h2 class="post-title"> 不同值`);
      if (toLocal(els[i].url) !== toLocal(visible[i].href)) bad('ItemList', rel, `第 ${i + 1} 条 url=${els[i].url} 与可见链接=${visible[i].href} 不同（顺序就是信息流顺序）`);
    }
  }
}

/** 合集页：一个合集一块，逐块对着自己的 section 复算 */
{
  const rel = 'series.html';
  const text = readSite(rel);
  const marks = grabAll(text, /<section class="cat-section series-section" id="([^"]+)">/);
  const blocks = jsonLdBlocks(text).filter((b) => !b.error && typesOf(b).includes('ItemList'));
  const sections = marks.map((mk, i) => ({
    slug: mk[1],
    body: text.slice(mk.index, i + 1 < marks.length ? marks[i + 1].index : text.indexOf('</main>', mk.index) > 0 ? text.indexOf('</main>', mk.index) : text.length),
  }));
  const withRows = sections.filter((s) => /<a class="series-link"/.test(s.body));
  if (blocks.length !== withRows.length) bad('ItemList', rel, `ItemList 块数=${blocks.length}，可见且有行的合集 section 数=${withRows.length}（跳过对不上文章的 slug 那条分支失效，或某一块整块没发）`);
  for (const s of withRows) {
    const b = blocks.find((x) => String(x.value['@id'] || '').endsWith(`#${s.slug}`));
    if (!b) {
      bad('ItemList', rel, `合集「${s.slug}」有可见文章，却没有 @id 以 #${s.slug} 结尾的那一块`);
      continue;
    }
    const visName = decode((/<h2 class="cat-name">([\s\S]*?)<\/h2>/.exec(s.body)?.[1] || '').replace(/<[^>]+>/g, '')).trim();
    if (b.value.name !== visName) bad('ItemList', `${rel}#${s.slug}`, `name=「${b.value.name}」与可见的 <h2 class="cat-name">=「${visName}」不同值`);
    const visLede = decode((/<p class="series-lede">([\s\S]*?)<\/p>/.exec(s.body)?.[1] || '').replace(/<[^>]+>/g, '')).trim();
    if (visLede && b.value.description !== visLede) bad('ItemList', `${rel}#${s.slug}`, 'description 与可见的 .series-lede 不同值');
    const rows = grabAll(s.body, /<a class="series-link" href="([^"]*)">([\s\S]*?)<\/a>/).map((x) => ({
      href: x[1],
      name: decode(x[2].replace(/<[^>]+>/g, '')).trim(),
    }));
    const els = b.value.itemListElement || [];
    if (b.value.numberOfItems !== rows.length || els.length !== rows.length) bad('ItemList', `${rel}#${s.slug}`, `声明 ${els.length} 条 / numberOfItems=${b.value.numberOfItems}，可见 <ol> 里 ${rows.length} 条`);
    if (b.value.itemListOrder !== undefined) bad('ItemList', `${rel}#${s.slug}`, '合集块写了 itemListOrder——合集的顺序是策展的阅读顺序，三个取值都不是它，顺序全由 position 承载');
    for (let i = 0; i < Math.min(els.length, rows.length); i += 1) {
      if (els[i].position !== i + 1) bad('ItemList', `${rel}#${s.slug}`, `第 ${i + 1} 条 position=${els[i].position}`);
      if (els[i].name !== rows[i].name) bad('ItemList', `${rel}#${s.slug}`, `第 ${i + 1} 条 name 与可见 .series-link 文案不同值`);
      if (toLocal(els[i].url) !== toLocal(rows[i].href)) bad('ItemList', `${rel}#${s.slug}`, `第 ${i + 1} 条 url=${els[i].url} 与可见 href=${rows[i].href} 不同`);
    }
  }
  for (const b of blocks) {
    const slug = String(b.value['@id'] || '')
      .split('#')
      .pop();
    if (!withRows.some((s) => s.slug === slug)) bad('ItemList', rel, `有一块 ItemList 的 @id 锚点 #${slug} 对不上可见的合集 section`);
  }
}
for (const rel of ['categories.html', 'tags.html']) {
  const n = grabAll(readSite(rel), /"@type": "ItemList"/).length;
  if (n) bad('ItemList', rel, `发了 ${n} 块 ItemList——那两页的分组标题、组内链接与时间顺序全在可见 HTML 里，这一族声明不出新事实，却换来全站最大的两笔 gz 支出`);
}

// ── 组 6：manifest ────────────────────────────────────────────────────────────

/** 从 tokens.scss 取 --paper 的明暗两档（head.html 里那两个 hex 的对账基准） */
function paperTokens() {
  // 注释里也写得到 `:root` 与 `body.night-mode`（tokens.scss 自己就在注释里写），
  // 按「选择器字符串第一次出现的位置」找块会先撞上注释，取到的却是别的规则的 --paper。
  // 所以先剥掉注释，再按「选择器列表 → 声明块」成对扫描，选择器必须整项相等才算命中。
  const scss = readSrc('dev/sass/common/tokens.scss')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');
  const pick = (selector) => {
    const found = [];
    for (const m of scss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const parts = m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' '));
      if (!parts.includes(selector)) continue;
      // 同一个块里可能出现两格 --paper（后写的静默覆盖前写的，CSS 自己不会响），
      // 所以这里必须逐格收，不能用 exec 取第一格——取第一格的那一版对这种重复是瞎的。
      for (const d of m[2].matchAll(/--paper:\s*(#[0-9A-Fa-f]{3,8})/g)) found.push(d[1].toUpperCase());
    }
    const uniq = [...new Set(found)];
    if (uniq.length !== 1) {
      bad('manifest', 'tokens.scss', `选择器 ${selector} 里解析出 ${uniq.length} 个不同的 --paper（${uniq.join(' / ') || '零个'}），明暗两档的对账口径失效`);
      return null;
    }
    return uniq[0];
  };
  const light = pick(':root');
  const dark = pick('body.night-mode');
  if (!light || !dark) bad('manifest', 'tokens.scss', `只解析出 --paper 明=${light} 暗=${dark}，形状变了要同步改这里（head.html 的两个 hex 靠它对账）`);
  return { light, dark };
}
const PAPER = paperTokens();

let manifest = null;
{
  if (!hasSite('manifest.json')) bad('manifest', 'manifest.json', '产物里没有这个文件——没有它，sw.js 跑得再好也拿不到「可安装」这个能力位');
  else {
    const raw = readSite('manifest.json');
    try {
      manifest = JSON.parse(raw);
    } catch (e) {
      bad('manifest', 'manifest.json', `不是合法 JSON：${e.message}（浏览器读不到 manifest 时不报错，只是安装面静默消失）`);
    }
  }
}
if (manifest) {
  const eq = (key, want) => {
    if (manifest[key] !== want) bad('manifest', key, `=「${manifest[key]}」，应为「${want}」`);
  };
  eq('start_url', HOME_ABS);
  eq('scope', HOME_ABS);
  eq('display', 'standalone');
  eq('background_color', PAPER.light);
  eq('theme_color', PAPER.light);
  eq('lang', 'zh-CN');
  if (manifest.name !== config.title) bad('manifest', 'name', `=「${manifest.name}」与 _config.yml 的 title 不等`);
  if (String(manifest.short_name || '').length > 12) bad('manifest', 'short_name', `「${manifest.short_name}」${[...String(manifest.short_name)].length} 个字符——主屏那行名字会被截断，超过 12 就是白给`);
  if (manifest.orientation !== undefined) bad('manifest', 'orientation', '出现了 orientation：锁竖屏对要读长文与表格的站是减分项，横屏看代码块是正当用法');
  // baseurl 那一段从 _config.yml 现读，不写死 /better-blog：换站点（根域名发布、项目页改名）
  // 时写死的锚会两头骗——真该红的漏掉，不该红的反咬一口。start_url 是绝对地址，所以判「含」
  if (BASEURL && !String(manifest.start_url || '').includes(BASEURL)) {
    bad('manifest', 'start_url', `没带 baseurl 那一段（实际「${manifest.start_url}」，应含 ${BASEURL}）——GitHub Pages 项目页的规范地址含这一截，置空或漏掉都会让安装后的首页 404`);
  }
  if (sitemap.includes(`${BASEURL}/manifest.json`)) bad('manifest', 'sitemap.xml', 'manifest.json 出现在站点地图里——它是机器读物，不是给人导航的页面');

  const wantIcons = manifestData.icons.filter((i) => i.use === 'manifest');
  const icons = manifest.icons || [];
  if (icons.length !== wantIcons.length) bad('manifest', 'icons', `块数=${icons.length}，_data/manifestIcons.yml 里 use: manifest 的有 ${wantIcons.length} 枚`);
  for (const want of wantIcons) {
    const got = icons.find((i) => toLocal(i.src) === want.path);
    if (!got) {
      bad('manifest', want.path, '台账里有这枚 manifest 图标，manifest.json 的 icons 里却没有');
      continue;
    }
    if (got.sizes !== want.sizes) bad('manifest', want.path, `sizes=「${got.sizes}」与台账「${want.sizes}」不等`);
    if (got.type !== 'image/png') bad('manifest', want.path, `type=「${got.type}」，应为 image/png`);
    if (!hasSite(want.path.replace(/^\//, ''))) {
      bad('manifest', want.path, 'manifest 指向的地址在产物里不存在');
      continue;
    }
    const abs = path.join(SITE, want.path.replace(/^\//, ''));
    const buf = fs.readFileSync(abs);
    if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') bad('manifest', want.path, '不是 PNG（文件头对不上）');
    // IHDR 的宽高在第 16-23 字节，文件短到这里就读不出尺寸；让它抛出去等于把整轮的判定吞了
    else if (buf.length < 24) bad('manifest', want.path, `产物里只有 ${buf.length} B，连 IHDR 都读不出来`);
    else {
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      if (`${w}x${h}` !== want.sizes) bad('manifest', want.path, `IHDR 量出来 ${w}x${h}，台账声明 ${want.sizes}`);
    }
    if (buf.length !== want.bytes) bad('manifest', want.path, `产物里 ${buf.length} B，台账 ${want.bytes} B（改过图标却没重跑 build-manifest-icons.mjs）`);
    if (sha256(abs) !== want.sha256) bad('manifest', want.path, '产物里的字节与台账 sha256 不等');
    const srcAbs = path.join(ROOT, want.path.replace(/^\//, ''));
    if (fs.existsSync(srcAbs) && sha256(srcAbs) !== want.sha256) bad('manifest', want.path, '仓库源文件与台账 sha256 不等（Jekyll 原样复制，两处不等就是台账过期）');
  }
  const sizes = new Set(manifestData.icons.map((i) => i.sizes));
  if (sizes.size !== manifestData.icons.length) bad('manifest', 'icons', `台账里 sizes 有重复：${manifestData.icons.map((i) => i.sizes).join(', ')}`);
  if (manifestData.icons.filter((i) => i.use === 'apple-touch').length !== 1) bad('manifest', 'icons', 'apple-touch 那一族应恰好一枚（iOS 主屏只认它）');
  if (manifestData.source && manifestData.source_sha256) {
    const src = path.join(ROOT, manifestData.source);
    if (!fs.existsSync(src)) bad('manifest', 'source', `${manifestData.source} 不存在`);
    else if (sha256(src) !== manifestData.source_sha256) bad('manifest', 'source', `${manifestData.source} 已改动而台账的 source_sha256 没刷新：跑 node scripts/build-manifest-icons.mjs 重画`);
  } else bad('manifest', 'source', '台账缺 source / source_sha256 两格之一');
}

// ── 组 7：安装面接线 ──────────────────────────────────────────────────────────

const APPLE = manifestData.icons.find((i) => i.use === 'apple-touch');
{
  const surfaceRe = /rel="manifest"|rel="apple-touch-icon"|name="theme-color"/g;
  for (const rel of inScope) {
    if (!hasSite(rel)) continue; // 缺件已经在「语料」组里记过红，这里不再让脚本崩在 readSite 上
    const text = readSite(rel);
    const n = grabAll(text, surfaceRe).length;
    if (n !== 4) bad('接线', rel, `安装面标记共 ${n} 条，应为 4 条（manifest 1 + apple-touch-icon 1 + theme-color 2）——少哪一条坏的样子都不一样`);
    const mf = grabAll(text, /<link rel="manifest" href="([^"]*)"/);
    if (mf.length !== 1) bad('接线', rel, `rel="manifest" 的 link 有 ${mf.length} 条`);
    // 逐字比 href，不走 toLocal：toLocal 会把「漏了 baseurl」的 /manifest.json 洗成对的那串，
    // 而漏 baseurl 正是项目页安装后 404 的那一种坏法
    else if (mf[0][1] !== `${BASEURL}/manifest.json`) bad('接线', rel, `manifest href=「${mf[0][1]}」不指向 ${BASEURL}/manifest.json`);
    const at = grabAll(text, /<link rel="apple-touch-icon" href="([^"]*)"/);
    if (at.length !== 1) bad('接线', rel, `apple-touch-icon 有 ${at.length} 条（iOS 只认这一条 link，两条是让它挑，零条是给它截网页图当图标）`);
    else if (APPLE && toLocal(at[0][1]) !== APPLE.path) bad('接线', rel, `apple-touch-icon 指向 ${at[0][1]}，台账里 apple-touch 那枚是 ${APPLE.path}`);
    const tc = grabAll(text, /<meta name="theme-color" media="([^"]*)" content="([^"]*)"/);
    if (tc.length !== 2) bad('接线', rel, `theme-color 有 ${tc.length} 条，应为明暗各 1`);
    const byMedia = new Map(tc.map((x) => [x[1], x[2].toUpperCase()]));
    if (byMedia.get('(prefers-color-scheme: light)') !== PAPER.light) bad('接线', rel, `明档 theme-color=「${byMedia.get('(prefers-color-scheme: light)')}」与 tokens.scss 的 --paper 明档 ${PAPER.light} 不等`);
    if (byMedia.get('(prefers-color-scheme: dark)') !== PAPER.dark) bad('接线', rel, `暗档 theme-color=「${byMedia.get('(prefers-color-scheme: dark)')}」与 tokens.scss 的 --paper 暗档 ${PAPER.dark} 不等`);
    const mfAt = text.indexOf('rel="manifest"');
    const cssAt = text.indexOf('rel="stylesheet"');
    if (mfAt < 0) bad('接线', rel, '找不到 rel="manifest"');
    else if (cssAt >= 0 && mfAt > cssAt) bad('接线', rel, 'manifest 排在第一个 rel="stylesheet" 之后');
  }
  const outScope = htmlFiles.filter((r) => !inScope.has(r));
  for (const rel of outScope) {
    const n = grabAll(readSite(rel), surfaceRe).length;
    if (n) bad('接线', rel, `这一页不带布局（或带的是 demoTemplate），产物里却出现 ${n} 条安装面标记——范围外的页面不声明可安装`);
  }
  /**
   * 范围外那一族必须还是「demo/** ∪ offline.html ∪ Google 校验文件」这三类。
   * 新来一个不带布局的产物页而没进这三类，就红在这里：那不是它一定写错了，
   * 而是「谁该有安装面」这件事多了一个没人认领的成员，判据的范围得重新表态。
   */
  for (const rel of outScope) {
    if (/^demo\//.test(rel)) continue;
    const fm = srcFrontMatter(rel);
    if (fm?.permalink === '/offline.html' && rel === 'offline.html') continue;
    if (/^googlebed[0-9a-f]+\.html$/.test(rel) && readSrc(rel).includes('google-site-verification')) continue;
    bad('接线', rel, '不在「demo/** / offline.html / Google 校验文件」这三类范围内，却也不带布局——请确认它该不该有安装面，并把这一类写进门禁');
  }
}

// ── 组 8：head 里的脚本 ───────────────────────────────────────────────────────

{
  /** 允许同步的 src：从 _includes/headAssets.html 现场取，不在这里写死「只有 jQuery」 */
  const headAssets = readSrc('_includes/headAssets.html');
  const allowedSync = new Set(
    grabAll(headAssets, /<script (?![^>]*\b(?:defer|async)\b)[^>]*\bsrc="([^"]*)"/)
      .map((m) => m[1].replace('{{ site.baseurl }}', BASEURL))
      .filter((s) => !s.includes('{{')),
  );
  const seoScriptSrcs = grabAll(readSrc('_includes/seoScript.html'), /<script([^>]*)\bsrc="([^"]*)"/)
    .map((m) => ({
      attrs: m[1],
      src: m[2].replace('{{ site.baseurl }}', BASEURL),
    }))
    .filter((x) => !x.src.includes('{{'));
  if (seoScriptSrcs.length !== 3) bad('head', 'seoScript.html', `解析到 ${seoScriptSrcs.length} 条 <script src>，这一族本来是三条统计/推送`);
  const syncSeen = new Set();
  for (const rel of inScope) {
    if (!hasSite(rel)) continue;
    const head = headOf(readSite(rel));
    for (const m of grabAll(head, /<script[^>]*\bsrc="[^"]*"[^>]*>/)) {
      const tag = m[0];
      if (/\bdefer\b|\basync\b/.test(tag)) continue;
      const src = /\bsrc="([^"]*)"/.exec(tag)[1];
      syncSeen.add(src);
      if (!allowedSync.has(src)) bad('head', rel, `<script src="${src}"> 在 <head> 里同步加载——它会占住解析器，而这三条统计/推送没有任何必须阻塞的理由（B1）`);
    }
    for (const x of seoScriptSrcs) {
      const re = new RegExp(`<script[^>]*\\bsrc="${escRE(x.src)}"[^>]*>`);
      const hit = re.exec(head);
      if (!hit) bad('head', rel, `产物 head 里找不到 ${x.src}（seoScript.html 没被 include，或那条 link 被改坏）`);
      else if (!/\bdefer\b/.test(hit[0])) bad('head', rel, `${x.src} 没有 defer——三个第三方域同步加载时各占一次解析器；用 defer 而不是 async 是为了保住 _hmt 与两个 push 的相对顺序`);
    }
  }
  if (allowedSync.size && ![...allowedSync].every((s) => syncSeen.has(s))) bad('head', '全站', `headAssets.html 声明同步加载的 ${[...allowedSync].join(', ')} 里有产物没出现的——判据与实现有一处漂了`);
  // 这两本源在 dev/libJs/ 下，早先写的是 dev/js/——路径错了这道判据就静默空转（existsSync 滤掉即可），
  // 所以认不到的时候必须红出来，而不是让 document.write 那一判悄悄变成零条。
  const pushSrc = ['dev/libJs/baiduPush.js', 'dev/libJs/soPush.js'];
  const seen = pushSrc.filter((f) => fs.existsSync(path.join(ROOT, f)));
  if (seen.length !== pushSrc.length) {
    bad('head', 'dev/libJs', `推送脚本源码只认到 ${seen.length} 本（应认到 ${pushSrc.join(' / ')}），document.write 那一判此刻无牙——搬了目录要同步改这里`);
  }
  for (const f of seen) {
    // 注释里写得到「原片段用 document.write 注入」——soPush.js 的头两行正是这么解释这次拆除的。
    // 判据要在剥掉注释的正文上跑，否则这道门从一开始就是红的。
    const code = readSrc(f)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '');
    if (/document\.write/.test(code)) bad('head', f, '源码里还有 document.write——defer 脚本在解析完成后执行，此时 document.write 触发隐式 document.open() 会清空整页');
  }
}

// ── 组 9：文末相关工具卡 ──────────────────────────────────────────────────────

{
  const ready = toolsData.filter((t) => t.status === 'ready');
  for (const t of ready) {
    if (!Array.isArray(t.match_tags)) bad('相关工具', t.slug, 'match_tags 不是列表（写成空格分隔字符串时 contains 判据会整条失效，卡永远不画）');
  }
  let withCard = 0;
  for (const p of posts) {
    const text = readSite(p.rel);
    const want = ready.filter((t) => (Array.isArray(t.match_tags) ? t.match_tags : []).some((tag) => p.tags.includes(String(tag)))).slice(0, 3);
    const secStart = text.indexOf('<section class="post-footer-item related-tools"');
    if (want.length === 0) {
      if (secStart >= 0) bad('相关工具', p.rel, `这篇的 tags=「${p.tags.join(', ')}」命中 0 个工具，产物却画了卡——无命中就不渲染是这一块的口径，兜底推荐会把内链权重稀释掉`);
      continue;
    }
    if (secStart < 0) {
      bad('相关工具', p.rel, `应命中 ${want.length} 枚（${want.map((t) => t.slug).join('/')}），产物里没有 .related-tools 这一块`);
      continue;
    }
    withCard += 1;
    const secEnd = text.indexOf('</section>', text.indexOf('</ul>', secStart));
    const sec = text.slice(secStart, secEnd > 0 ? secEnd + 10 : text.length);
    const items = grabAll(sec, /<li class="related-tools-item">([\s\S]*?)<\/li>/);
    if (items.length !== want.length) bad('相关工具', p.rel, `画了 ${items.length} 枚，按 yml × tags 复算应为 ${want.length} 枚（上限 3）`);
    for (let i = 0; i < Math.min(items.length, want.length); i += 1) {
      const t = want[i];
      const body = items[i][1];
      const href = /<a class="related-tools-link" href="([^"]*)"/.exec(body)?.[1];
      const icon = /<img class="related-tools-icon" src="([^"]*)"/.exec(body)?.[1];
      const name = decode(/<span class="related-tools-name">([^<]*)<\/span>/.exec(body)?.[1] || '').trim();
      const tagline = decode(/<span class="related-tools-tagline">([^<]*)<\/span>/.exec(body)?.[1] || '').trim();
      if (toLocal(href || '') !== t.url) bad('相关工具', p.rel, `第 ${i + 1} 枚指向 ${href}，应为 ${t.url}`);
      else if (!hasSite(t.url.replace(/^\//, ''))) bad('相关工具', p.rel, `第 ${i + 1} 枚指向 ${t.url}，产物里没有这一页（画出来的就是 404 卡）`);
      if (icon && toLocal(icon) !== t.icon) bad('相关工具', p.rel, `第 ${i + 1} 枚图标 ${icon} 与 yml 的 icon=${t.icon} 不等`);
      if (icon && !hasSite(toLocal(icon).replace(/^\//, ''))) bad('相关工具', p.rel, `第 ${i + 1} 枚的图标文件在产物里不存在：${toLocal(icon)}`);
      if (name !== t.name) bad('相关工具', p.rel, `第 ${i + 1} 枚名称=「${name}」与 yml=「${t.name}」不等`);
      if (tagline !== (t.tagline || '')) bad('相关工具', p.rel, `第 ${i + 1} 枚摘要与 yml tagline 不等`);
      if (!/class="related-tools-go" aria-hidden="true"/.test(body)) bad('相关工具', p.rel, `第 ${i + 1} 枚的箭头没标 aria-hidden（可及名已由左边名称与摘要给出，读屏器会多念一个「向右箭头」）`);
      const imgTag = /<img class="related-tools-icon"[^>]*>/.exec(body)?.[0] || '';
      if (!/loading="lazy"/.test(imgTag)) bad('相关工具', p.rel, '卡里的图标没有 loading="lazy"（它在折叠区之下，首屏不该排它的队）');
    }
    const order = items.map((x) => toLocal(/href="([^"]*)"/.exec(x[1])?.[1] || ''));
    const wantOrder = want.map((t) => t.url);
    if (order.join(' ') !== wantOrder.join(' ')) bad('相关工具', p.rel, `卡序=「${order.join(' ')}」，应为 _data/onlineTools.yml 的条目顺序「${wantOrder.join(' ')}」（不按命中枚数排：那是第二处排序口径）`);
  }
  if (withCard === 0) bad('相关工具', '全站', '一篇都没画出卡——这条判据此刻无牙（match_tags 全空，或模板的 include 断掉）');
  for (const rel of htmlFiles.filter((r) => !postRelSet.has(r))) {
    if (readSite(rel).includes('class="post-footer-item related-tools"')) bad('相关工具', rel, '非文章页画出了相关工具卡（这块属于 post.html 的文末区）');
  }
}

// ── 组 10：图片换源与尺寸 ─────────────────────────────────────────────────────

{
  const ledger = readSrc('scripts/image-variants.json');
  const variants = Object.keys(JSON.parse(ledger).variants || {});
  const imgRe = /<img\b[^>]*?>/gi;
  for (const rel of htmlFiles) {
    const text = readSite(rel);
    const tags = grabAll(text, imgRe);
    let priority = 0;
    for (const m of tags) {
      const tag = m[0];
      const src = /\bsrc="([^"]*)"/.exec(tag)?.[1];
      if (!src) continue;
      const local = toLocal(src);
      if (/\bfetchpriority="high"/.test(tag)) priority += 1;
      if (local.endsWith('.webp')) {
        if (!hasSite(local.replace(/^\//, ''))) bad('换源', rel, `<img src="${src}"> 指向的 webp 在产物里不存在`);
      }
      if (local.endsWith('.png') && variants.includes(local.replace(/^\//, ''))) {
        // 只判 <img>：og:image / twitter:image / BlogPosting.image 那几处刻意留 png——
        // 社交侧的爬虫取图对 webp 的支持不齐，而这一族字节不进首屏关键路径。
        bad('换源', rel, `<img> 仍指向 ${local}，而台账里它已转出 webp——构建期换源那一支断了（这条链只在 add_image_dims 滤镜里做）`);
      }
      const w = /\bwidth="(\d+)"/.test(tag);
      const h = /\bheight="(\d+)"/.test(tag);
      if (w !== h) bad('换源', rel, `<img src="${src}"> 只有 width 或只有 height，补一半等于给浏览器一个错的宽高比`);
    }
    if (priority > 1) bad('换源', rel, `有 ${priority} 张 img 带 fetchpriority="high"，一页只该有一个 LCP 候选`);
    if (priority === 1) {
      const tag = grabAll(text, imgRe).find((m) => /fetchpriority="high"/.test(m[0]))[0];
      if (/loading="lazy"/.test(tag)) bad('换源', rel, 'fetchpriority="high" 与 loading="lazy" 同时出现——高优先级预加载一张被懒加载挡住的图是自相矛盾的声明');
    }
  }
  /** 每篇文章页至多一枚 fetchpriority，且必须落在头图或正文第一张 eager 图上 */
  for (const p of posts) {
    const text = readSite(p.rel);
    const tags = grabAll(text, imgRe);
    const hit = tags.find((m) => /fetchpriority="high"/.test(m[0]));
    const body = postBodyRegion(text);
    const rn = text.indexOf('post-footer-item read-next');
    const bodyEnd = body ? body.end : rn > 0 ? rn : text.length;
    // LCP 候选只从 `<article id="post-body">` 这一个元素里选：滤镜拿到的就是 post_body，
    // 元素之外（篇末打赏的二维码、作者卡、read-next 缩略图）的图它压根没看过。
    // 拿「正文起点到 read-next 之间」当正文，会把打赏那两枚 eager 的图当成正文首图，
    // 于是 26 篇没封面的老文章集体红成「该提权却没提」——红的是判据的边界，不是产物的缺陷。
    const firstBody = tags.find((m) => m.index > (body ? body.start : -1) && m.index < bodyEnd && !/loading="lazy"/.test(m[0]));
    const hasHero = text.includes('<figure class="post-hero">');
    if (!hit) {
      if (hasHero) bad('换源', p.rel, '有头图却没有 fetchpriority="high"（post.html 的 hero 那一支必须传 mode=lcp）');
      else if (firstBody) bad('换源', p.rel, '没有头图、正文里有 eager 的 img，却没有 fetchpriority——正文首图就是这一页的 LCP 候选，不给它高优先级等于把 LCP 往后推');
      continue;
    }
    if (!hasHero && !firstBody) bad('换源', p.rel, '这一页没有该被高优先级的图，却出现了 fetchpriority="high"');
    if (hasHero) {
      if (body && hit.index > body.start) bad('换源', p.rel, '有头图，fetchpriority 却落在正文里（头图那一次调用才是 LCP 候选）');
    } else if (firstBody && hit.index !== firstBody.index) {
      bad('换源', p.rel, 'fetchpriority 没落在正文第一张 eager 图上');
    }
  }
}

// ── 组 12：词表（SP4 A9）· 词表白名单两份（钉死在这里，不跟随现状）────────────────
//
// 这两行不是「从现状自动生成」的数据，而是从**归一后**的现状生成、逐条钉进脚本的常量表：
// 新增/改名必须显式改脚本——词表漂移正是这一组要治的病，不该由「自动跟随」放过。
// 用 `split(' ')` 的前提是「本站 front matter 表达不了一枚含空格的标签」；谁真塞进去，
// 这两行的规模立刻不是 151/14，紧跟其后的那条自证先红，轮不到八条判据去猜。
const TAGS_OK = new Set(
  'AI AI大模型2026年综合实力排行榜单 AI大模型排行榜单 AI大模型测评 AI编程 AOP Agent Astryx Bend CSS Claude Coding Cypress DNS Development ES2023 GUI GitDiagram H5分享 H5实现摇一摇 H5打开地图导航app Impeccable JS新特性 JavaScript JavaScript公用方法 JavaScript语言精粹 MCP Mermaid Meta Mongodb Next.js Node OpenAI Playwright Puppeteer SDD SSRF Spec-Driven StyleX TypeScript UI Univer Vercel Vibe Vue2 Vue3 blog chrome chrome浏览器插件 coding.net dev-server echarts git github git常用命令 gulp headless jekyll linux linux命令 livenerf next nginx nodeJS node包管理工具 npm page-agent pnpm proxy react reset revert scriptc seo优化 ssr vite vscode常用插件 vue vue-router webmcp webpack yarn 一键填充 云服务器ECS 仓库 代理 代码回撤 代码回退 公式引擎 函数式编程 前端 前端学习资料 前端小技巧 前端工作总结 前端构建 前端框架 前端环境切换工具 前端组件库 前端设计 前端面试常见编程题汇总 博客 原型和原型链 原生编译 域名解析 学习笔记 安全 实现可拖拽悬浮按钮 工具 工程化 常见的排序算法 常见的算法 开源 微信H5支付 微信JSAPI支付 微信公众号 微信公众号支付 微信分享 微信支付 技巧 插件 搜索引擎网站收录 更新版本内容 服务端渲染 架构图 查找算法 沙箱 浏览器插件 浏览器缓存机制 版本投产 生活 私有仓库 移动端的那些坑 移动端调试技巧 算法 类型系统 组件库 网站seo 自动登录 规范驱动开发 设计模式 设计系统 评测 谷歌浏览器插件 账号密码管理助手 超好用的chrome浏览器插件 配置https 阿里云服务器部署 阿里巴巴 面向切面编码 项目搭建 黑科技'.split(
    ' ',
  ),
);
const CATS_OK = new Set('AI CSS Chrome插件 H5与微信 JavaScript React TypeScript Vue 前端工程化 工具与效率 开源实测 服务器与部署 算法与面试 随笔'.split(' '));

if (TAGS_OK.size !== 151 || CATS_OK.size !== 14) {
  bad('词表', 'scripts/check-seo.mjs', `白名单常量自身规模 ${TAGS_OK.size} / ${CATS_OK.size}，与钉死的 151 / 14 不符——词表被改动时这条先红，别轮到八条判据去猜是谁动的手`);
}

// ── 组 11：描述（SP4 A4）─────────────────────────────────────────────────────
//
// 这一组判的是「这一篇有没有自己那句话」。取值链在 `_includes/seoMeta.html:55-76`：
// `page.seo_description` → `page.description` → `page.subtitle` → `site.description`，
// 再加一道 `.size < 25` 的地板。起草时（SP4 动手之前）80 篇里 41 篇是手写的、38 篇的 meta 就是副标题原文、
// 1 篇（`subtitle` 被 YAML 吃掉半句、只剩 5 个字符的那篇）落到了全站那句话上——三个数在 §6.1 台账里逐笔对账。
//
// 为什么源侧六格加产物侧一格：源侧管「这篇有没有自己的话」，产物侧管「那句话真的进了 meta」；
// 第六格（⑦）管「写了 A 读到 B」这一类静默截断——取值链读到的从来不是你以为的那句话。
// 缺后者，改坏取值链不会有任何一道门红（现有 10 组里 `JSON-LD` 那条 `decode(...) !== v.description`
// 判的是工具页 WebApplication，不覆盖文章页）。

/** 一篇稿子的正文（front matter 之后）。摘要里出现的每一段数字都要在这段里逐字找得到。 */
function srcBodyOf(file) {
  return readSrc(`_posts/${file}`).replace(/^---\r?\n[\s\S]*?\r?\n---/, '');
}

{
  const FUTURE = '2100-10-25-practice-demo.md';
  const MIN = 60;
  const MAX = 140;
  const SITE_DESC = String(config.description ?? '').trim();
  const mdFiles = fs
    .readdirSync(path.join(ROOT, '_posts'))
    .filter((f) => f.endsWith('.md'))
    .sort();
  const inCorpus = new Set(posts.map((p) => p.file));
  const notProduced = mdFiles.filter((f) => !inCorpus.has(f));
  // ① 的后半：文件数 = 语料数 + 1，且多出来的那一篇有名有姓。谁再拿未来日期把稿子推出语料，红的是这一条。
  if (notProduced.length !== 1 || notProduced[0] !== FUTURE) {
    bad('描述', '_posts', `「_posts 文件数 ${mdFiles.length} = 产出语料 ${inCorpus.size} + 豁免」不成立：多出来的是 ${JSON.stringify(notProduced)}，而豁免只认 ${FUTURE}（不产出的稿子没有 meta 可回填，但也不能靠改日期绕开这一组）`);
  }
  const seenDesc = new Map();
  for (const p of posts) {
    const d = String(p.fm.seo_description ?? '').trim();
    const sub = String(p.fm.subtitle ?? '').trim();
    if (!d) {
      bad('描述', p.file, '缺 seo_description——这一篇的 meta description 现在由 subtitle／site.description 兜底，卡片说的不是这一篇的事');
      continue;
    }
    const len = [...d].length;
    if (len < MIN || len > MAX) bad('描述', p.file, `摘要长度 ${len} 个 code point，越出 [${MIN}, ${MAX}]（地板是 seoMeta 那道 .size < 25 的 2.4 倍）`);
    if (d === sub) bad('描述', p.file, '摘要与本篇 subtitle 逐字相同——回填等于没做，meta 与卡片还在读同一句副标题');
    if (d === SITE_DESC) bad('描述', p.file, '摘要与 site.description 相同——那是关于全站的一句话，不是关于这一篇的');
    const body = srcBodyOf(p.file);
    for (const num of d.match(/\d+/g) || []) {
      if (!body.includes(num)) bad('描述', p.file, `摘要里的数字「${num}」在本篇正文里逐字找不到——摘要不许带正文没有的数字`);
    }
    if (seenDesc.has(d)) bad('描述', p.file, `摘要与 ${seenDesc.get(d)} 逐字相同——两篇共用一句话，搜索引擎分不出这两页`);
    else seenDesc.set(d, p.file);
    const meta = /<meta name="description"\s+content="([^"]*)"/.exec(readSite(p.rel));
    if (!meta) bad('描述', p.rel, '产物里这一页没有 meta description——取值链在这一页上断了');
    else if (decode(meta[1]) !== d) bad('描述', p.rel, `产物 meta 与源侧 seo_description 不同值（meta=「${decode(meta[1]).slice(0, 48)}」），接线被动过`);
  }
  // ⑦ front matter 写了 A、Jekyll 读到 B 的静默截断（YAML 把「 #」当行尾注释吃掉）
  {
    const KEYS7 = ['title', 'subtitle', 'seo_description', 'seo_short_title', 'description'];
    for (const p of posts) {
      const src = readSrc(`_posts/${p.file}`);
      const fmText = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmText) continue;
      for (const line of fmText[1].split(/\r?\n/)) {
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):[ \t]+(.*)$/);
        if (!m) continue;
        const [, k, written] = m;
        if (!KEYS7.includes(k)) continue;
        if (/^["'|>[&*]/.test(written)) continue; // 显式引号/块标量/锚点不是这一格管的形式
        const w = written.replace(/[ \t]+$/, '');
        const got = p.fm[k];
        if (got == null || typeof got !== 'string') {
          bad('描述', p.file, `${k} 写了「${w.slice(0, 40)}」但 Jekyll 没读到这个键——plain scalar 里的「 #」会被当行尾注释`);
          continue;
        }
        if (got !== w) bad('描述', p.file, `${k} 被静默截断：写了「${w.slice(0, 40)}」，Jekyll 读到「${got.slice(0, 40)}」——plain scalar 里的「 #…」会被当行尾注释，加引号即可`);
      }
    }
  }
}

// ── 组 12：词表（SP4 A9）· 八条判据（⑧ 的命中集台账与 match_tags 读取在正上方）───
//
// 五条量源侧 front matter（①②③④⑥）、两条拿产物对账（⑤ 三侧读数、⑦ 锚点不悬空）、
// 一条量文末工具卡的命中集（⑧）。白名单与命中集都是钉死的常量，改动必须显式动手。

// ⑧ 文末工具卡的命中集台账。口径与 _includes/relatedTools.html:36 的逐字 contains 一致：
// 「这篇的 tags 里出现过 match_tags 里的那枚串」——大小写敏感，所以改名会带跑卡。
// 这份快照不跟随现状：改名把卡带跑了，红的是这一条（spec §5.1 词表 ⑧）。
const TOOL_HIT_OK = [
  ['2016/08/28/JS-good-parts.html', 'JavaScript语言精粹'],
  ['2017/06/06/git-common-command.html', 'git,git常用命令'],
  ['2017/08/25/common-tools.html', 'JavaScript公用方法'],
  ['2018/12/05/move-githubblog-to-coding.html', 'git,github'],
  ['2019/01/17/website-seo.html', 'seo优化,搜索引擎网站收录,网站seo'],
  ['2019/01/24/build-private-package.html', 'npm,私有仓库'],
  ['2019/01/24/publish-public-npm.html', 'npm'],
  ['2019/01/28/use-gulp-build-project.html', 'gulp,项目搭建'],
  ['2019/02/25/you-dont-kown-js-tips.html', '前端小技巧'],
  ['2019/02/26/you-dont-kown-css-tips.html', '前端小技巧'],
  ['2020/04/08/browser-cache.html', '浏览器缓存机制'],
  ['2020/08/03/inaword-understand-prototype.html', '原型和原型链'],
  ['2022/08/08/webpack-move-vite.html', 'vite,webpack,前端构建,工程化'],
  ['2023/04/30/functional-programming.html', '函数式编程'],
  ['2023/05/08/vue3-vite-study.html', 'vite,webpack'],
  ['2023/06/11/auto-update-release.html', '更新版本内容,版本投产'],
  ['2023/06/14/npm-yarn-pnpm.html', 'node包管理工具,npm,pnpm,yarn'],
  ['2023/12/24/git-revert-reset.html', 'git,reset,revert,代码回撤,代码回退'],
  ['2023/12/29/2023-js-new-features.html', 'ES2023,JS新特性'],
  ['2026/09/10/nextjs-avif-trap.html', 'npm,前端小技巧'],
  ['2026/09/10/silent-defaults.html', 'npm,前端小技巧'],
  ['2026/09/21/pnpm-task-settings.html', 'npm,pnpm,前端小技巧'],
  ['2026/09/25/claude-agents-md-remote-gate.html', 'pnpm'],
  ['2026/09/26/github-actions-2500-cap.html', 'github'],
  ['2026/09/26/json-render-silent-strip.html', 'npm'],
  ['2026/09/29/scriptc-native-x64-gap.html', 'TypeScript'],
  ['2026/09/30/univer-node-two-gaps.html', 'TypeScript'],
  ['2026/10/01/gitdiagram-keyless-mcp-4-bad-edges.html', 'TypeScript'],
  ['2026/10/06/vite-wasm-query-fs-bypass.html', 'vite'],
];

const TOOL_MATCH_TAGS = new Set();
for (const block of readSrc('_data/onlineTools.yml').split(/(?=^- slug: )/m)) {
  const m = /^ {2}match_tags:[ \t]*\n((?: {4}- [^\n]*\n?)*)/m.exec(block);
  if (!m) continue;
  for (const line of m[1].split('\n')) {
    const one = /^ {4}- (.+)$/.exec(line);
    if (one) TOOL_MATCH_TAGS.add(one[1].trim().replace(/^['"]|['"]$/g, ''));
  }
}
if (TOOL_MATCH_TAGS.size !== 33) {
  bad('词表', '_data/onlineTools.yml', `match_tags 读出 ${TOOL_MATCH_TAGS.size} 枚，与钉死的 33 不符——这份 yml 的形状动了，⑧ 的口径随之失效（33 枚跨 codec / json / diff 三页，idcard 那页是空数组）`);
}

{
  // ① 大小写撞键为零：无条件判据，不设豁免名单（那对靠改名解决，spec §4.2 动作 2）
  const fold = new Map();
  for (const p of posts) {
    for (const t of p.tags) {
      const k = t.trim().toLowerCase();
      if (!fold.has(k)) fold.set(k, new Set());
      fold.get(k).add(t);
    }
  }
  for (const [k, variants] of [...fold].sort()) {
    if (variants.size > 1) bad('词表', 'tags', `${k} 有 ${variants.size} 枚只在大小写上不同的标签：${[...variants].sort().join(' / ')}——归档页会长出两个锚点，读者以为它们是两件事`);
  }

  // ② tags ⊆ 白名单、categories ⊆ 白名单（逐枚，所以一篇两个错就是两条）
  for (const p of posts) {
    for (const t of p.tags) if (!TAGS_OK.has(t)) bad('词表', p.file, `标签「${t}」不在白名单里——词表漂移，新增一枚要显式改脚本`);
    for (const c of p.cats) if (!CATS_OK.has(c)) bad('词表', p.file, `分类「${c}」不在白名单里——分类漂移，新增一枚要显式改脚本`);
  }

  // ③ 多分类必须写 [A, B]：front matter 里的 categories 行是裸标量且值中含空白 = 红
  for (const p of posts) {
    const raw = readSrc(`_posts/${p.file}`).replace(/^﻿/, '');
    const blk = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
    if (!blk) continue; // 形状不对由 语料 组负责，这一组不重复判
    const line = /^categories:[ \t]*(.*)$/m.exec(blk[1]);
    if (!line) continue;
    const val = line[1].trim();
    if (val && !val.startsWith('[') && /\S\s+\S/.test(val)) {
      bad('词表', p.file, `categories 写了空格分隔的多值「${val}」——多分类必须写成 [A, B]，方括号之外 YAML 与 Jekyll 的拆法不同，归档页读数会撒谎`);
    }
  }

  // ④ 行尾干净：_posts 下任何 .md 含 \r 即红（整站口径，不止产出语料）
  for (const f of fs
    .readdirSync(path.join(ROOT, '_posts'))
    .filter((x) => x.endsWith('.md'))
    .sort()) {
    if (fs.readFileSync(path.join(ROOT, '_posts', f)).includes(0x0d)) {
      bad('词表', `_posts/${f}`, '文件里有 \\r 行尾——按字节读的行尾粘连会在不按 /\\s+/ 拆的读取器里造出幽灵标签，门禁这一把尺认得它，grep 与浏览器不认');
    }
  }

  // ⑤ 三侧读数相等：语料并集 == 白名单 == 产物计数器；另加「文件集 == 语料 + 那 2 枚」
  const corpusTags = new Set();
  const corpusCats = new Set();
  for (const p of posts) {
    for (const t of p.tags) corpusTags.add(t);
    for (const c of p.cats) corpusCats.add(c);
  }
  const counterOf = (rel, re) => {
    const m = re.exec(readSite(rel));
    return m ? Number(m[1]) : null;
  };
  const prodTags = counterOf('tags.html', /<li><strong>(\d+)<\/strong><span>个标签/);
  const prodCats = counterOf('categories.html', /<li><strong>(\d+)<\/strong><span>个分类/);
  if (corpusTags.size !== TAGS_OK.size || prodTags !== TAGS_OK.size) {
    bad('词表', 'tags.html', `tags 三侧读数不等：语料 ${corpusTags.size} / 白名单 ${TAGS_OK.size} / 产物 ${prodTags}——门禁的拆法与 Jekyll 的拆法有一处动了，或者词表动了而白名单没跟着改`);
  }
  if (corpusCats.size !== CATS_OK.size || prodCats !== CATS_OK.size) {
    bad('词表', 'categories.html', `categories 三侧读数不等：语料 ${corpusCats.size} / 白名单 ${CATS_OK.size} / 产物 ${prodCats}——门禁的拆法与 Jekyll 的拆法有一处动了，或者词表动了而白名单没跟着改`);
  }
  const fileTags = new Set();
  for (const f of fs.readdirSync(path.join(ROOT, '_posts')).filter((x) => x.endsWith('.md'))) {
    const blk = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readSrc(`_posts/${f}`).replace(/^﻿/, ''));
    if (!blk) continue;
    const tm = /^tags:[ \t]*(.*)$/m.exec(blk[1]);
    if (!tm) continue;
    for (const tok of tm[1]
      .replace(/^\[|\]$/g, '')
      .split(/[,\s]+/)
      .filter(Boolean))
      fileTags.add(tok);
  }
  const extra = [...fileTags].filter((t) => !corpusTags.has(t)).sort();
  if (fileTags.size !== corpusTags.size + 2 || extra.join(',') !== '前端面试,手写题') {
    bad('词表', '_posts', `文件集 tags 读数 ${fileTags.size} ≠ 语料 ${corpusTags.size} + 那 2 枚；语料外多出的是 ${extra.join(',')}（那 2 枚逐字写成 前端面试 / 手写题，属于不产出的教学样本 2100-10-25-practice-demo.md）`);
  }

  // ⑥ 同帖重复为零 + 每枚标签的桶大小 == 持有它的文件数
  for (const p of posts) {
    if (new Set(p.tags).size !== p.tags.length) {
      const dup = [...new Set(p.tags.filter((t, i) => p.tags.indexOf(t) !== i))];
      bad('词表', p.file, `标签在同一篇里出现两遍：${dup.join(' / ')}——site.tags 的那一桶会多占一格，归档页的「N 篇」就开始撒谎`);
    }
  }
  const bucket = new Map();
  const holders = new Map();
  for (const p of posts) {
    for (const t of p.tags) bucket.set(t, (bucket.get(t) || 0) + 1);
    for (const t of new Set(p.tags)) holders.set(t, (holders.get(t) || 0) + 1);
  }
  for (const [t, n] of [...bucket].sort()) {
    if (n !== holders.get(t)) bad('词表', 'tags', `标签「${t}」的桶是 ${n} 篇，实际持有它的文件只有 ${holders.get(t)} 篇——同一篇重复挂了这枚标签`);
  }

  // ⑦ 归档页不悬空：每一枚 chip 的 href="#X" 在同页有 cat-section id="X"
  for (const [rel, why] of [
    ['tags.html', '标签'],
    ['categories.html', '分类'],
  ]) {
    const html = readSite(rel);
    const ids = new Set([...html.matchAll(/<section class="cat-section" id="([^"]*)"/g)].map((m) => decode(m[1])));
    for (const m of html.matchAll(/<a class="cat-chip" href="#([^"]*)"/g)) {
      const target = decode(m[1]);
      if (!ids.has(target)) bad('词表', rel, `${why}「${target}」的锚点跳空：chip 写了 href="#${target}"，同页却没有 id="${target}" 的那一节`);
    }
  }

  // ⑧ 命中集不变：台账逐行对得上，且不长出台账之外的命中行
  const hitOf = (p) =>
    [...new Set(p.tags)]
      .filter((t) => TOOL_MATCH_TAGS.has(t))
      .sort()
      .join(',');
  const ledger = new Map(TOOL_HIT_OK);
  for (const [rel, want] of TOOL_HIT_OK) {
    const p = posts.find((q) => q.rel === rel);
    if (!p) continue; // 这一篇不在语料里，由 描述 ① / 语料 组负责，这里不重复判
    const got = hitOf(p);
    if (got !== want) bad('词表', rel, `文末工具卡的命中集与台账不一致：台账「${want}」，现在「${got}」——改名把这页的卡带跑了，match_tags 是逐字 contains，大小写敏感`);
  }
  for (const p of posts) {
    const got = hitOf(p);
    if (got && !ledger.has(p.rel)) bad('词表', p.rel, `这页现在命中了工具卡（${got}），台账里却没有这一行——match_tags 或这页的 tags 有一边被动过`);
  }
}

// ── 组 13：内链（SP4 刀3）─────────────────────────────────────────────────────
//
// 判的是「正文里那几枚指向站内工具页的手工链」。四条全部落在产物侧：源侧写的是
// `{{ '/tools/json.html' | prepend: site.baseurl }}`，只有产物里那一枚 href 才知道
// baseurl 有没有拼上、那一页还在不在。项目站的 baseurl 是 /better-blog，
// 漏拼的相对写法在本地 `_site` 里看起来是好的、上线就是 404，所以这一格按整串相等判。
//
// 为什么只数 `#post-body` 以内：文末「相关工具」卡（`_includes/relatedTools.html`）每一篇
// 自动带 2–4 枚 /tools/ 链接，把它算进来这一组永远是绿的——spec §5.1 那句
// 「把自动卡当手工链交差」防的正是这个。`postBodyRegion`（83 行）取的是元素**内**区间，
// 卡片排在 `</article>` 之后，天然被排除（实测：加链之前全语料正文里的 /tools/ 链 = 0 枚）。
{
  const INLINK_RE = /<a\b[^>]*href="([^"]*?\/tools\/([a-z0-9-]+)\.html)"[^>]*>([\s\S]*?)<\/a>/gi;
  const EMPTY_TEXT = new Set(['点这里', '点此', '工具', '详情', '查看详情', '了解更多', '链接', 'here', 'link', 'click here']);
  let inBodyLinks = 0;
  for (const p of posts) {
    const html = readSite(p.rel);
    const reg = postBodyRegion(html);
    if (!reg) continue; // 「稿子在、产物里没有」在 语料 组已经红过，这里不重复报，也不假绿
    const found = [...html.slice(reg.start, reg.end).matchAll(INLINK_RE)];
    if (!found.length) continue;
    inBodyLinks += found.length;
    if (found.length > 2) bad('内链', p.rel, `正文里有 ${found.length} 枚工具内链，超过每篇 2 枚的地板——文末自动卡本来就有，正文再堆只是噪声（spec §4.3）`);
    for (const m of found) {
      const href = m[1];
      const slug = m[2];
      const text = decode(m[3].replace(/<[^>]+>/g, ''))
        .replace(/\s+/g, ' ')
        .trim();
      const want = `${BASEURL}/tools/${slug}.html`;
      if (EMPTY_TEXT.has(text)) bad('内链', p.rel, `指向 ${href} 的内链文字是「${text}」——链接文字必须说清点开了能做什么（spec §4.3 第一条）`);
      if (href !== want) bad('内链', p.rel, `正文内链的 href 是「${href}」，不等于 baseurl 拼出来的「${want}」——相对写法或漏 baseurl 在项目站上是 404`);
      else if (!hasSite(`tools/${slug}.html`)) bad('内链', p.rel, `正文内链指向 ${href}，产物里没有 tools/${slug}.html——这一条是 404`);
    }
  }
  if (inBodyLinks < 5) bad('内链', '_posts', `正文里的工具内链一共 ${inBodyLinks} 枚，少于地板 5 枚（spec §4.3 要 5–8 条，每条都要能指出它接的是正文里的哪一句话）`);
}

// ── 组 14：目录（A8 构建期静态目录，spec §4.4 / §5.1 组 目录）─────────────────────

const TOC_NAV = /<nav class="toc-static" aria-label="文章目录（静态）">([\s\S]*?)<\/nav>/;
const TOC_HEAD = /<(h[23])\b([^>]*)>([\s\S]*?)<\/\1>/gi;
const TOC_ATTR_ID = /\bid=["']([^"']*)["']/i;
const TOC_LI = /<li class="toc-static-item toc-(h[23])"><a class="toc-static-link" href="#([^"]*)">/g;
const TOC_MIN = 2; // 与 editorial.js:250-251 同一口径
const TOC_JS_MARKERS = [
  ['dev/js/editorial.js 里的 "toc-link"', "'toc-link'"],
  ['dev/js/editorial.js 里的 "toc-list"', "'toc-list'"],
  ['dev/js/editorial.js 里的 ".toc-fab"', "'.toc-fab'"],
];

let tocBlockPages = 0;
let tocNeededPages = 0;
for (const { rel, text } of postPages) {
  const region = postBodyRegion(text);
  if (!region) continue; // 「这一页没有 #post-body」由语料组报，这里不重复占一格
  const body = text.slice(region.start, region.end);
  const heads = [];
  let k = -1;
  for (const m of body.matchAll(TOC_HEAD)) {
    k += 1;
    const idm = TOC_ATTR_ID.exec(m[2]);
    heads.push({ level: m[1].toLowerCase(), id: idm ? idm[1] : `section-${k + 1}` });
  }
  const navAt = text.search(TOC_NAV);
  if (heads.length < TOC_MIN) {
    if (navAt >= 0) bad('目录', rel, `② 正文只有 ${heads.length} 个 h2/h3（< ${TOC_MIN}），产物里却有静态目录块——阈值与 JS 分叉了，读者会看到一个空框`);
    continue;
  }
  tocNeededPages += 1;
  if (navAt < 0) {
    bad('目录', rel, `① 正文有 ${heads.length} 个 h2/h3，产物里却没有 <nav class="toc-static"> 块`);
    continue;
  }
  // 两个计数器分开数：`tocNeededPages` 数「正文达标、该有块」，`tocBlockPages` 只数「产物里真的有块」。
  // 若把达标与否和有无块合成一个数，③ 就自反了（自己等于自己），A8 一行没落地也不会红——那是一把假牙。
  tocBlockPages += 1;
  const items = [...TOC_NAV.exec(text)[1].matchAll(TOC_LI)].map((m) => ({ level: m[1], id: m[2] }));
  if (items.length !== heads.length) bad('目录', rel, `③ 静态条目 ${items.length} 条 vs 正文标题 ${heads.length} 个`);
  for (let i = 0; i < Math.max(items.length, heads.length); i++) {
    const a = items[i];
    const b = heads[i];
    if (!a || !b || a.id !== b.id || a.level !== b.level) {
      bad('目录', rel, `① 序列不一致：第 ${i + 1} 条静态条目是 ${a ? `${a.level}#${a.id}` : '（缺）'}，正文第 ${i + 1} 个标题是 ${b ? `${b.level}#${b.id}` : '（缺）'}`);
      break;
    }
  }
  const hasJsAt = text.indexOf('has-js');
  if (hasJsAt < 0 || hasJsAt > navAt) bad('目录', rel, '⑤ 的门控半边：.toc-static 之前没有那段给 <html> 挂 has-js 的内联脚本——静态块会先画一帧再收起，读者看到一次塌陷');
}
if (tocBlockPages !== tocNeededPages)
  bad('目录', '_site', `③ 带静态目录块的产物是 ${tocBlockPages} 篇，正文 h2/h3 ≥ ${TOC_MIN} 个的有 ${tocNeededPages} 篇——差的 ${tocNeededPages - tocBlockPages} 篇由 ① 逐页点名（期望值按产物现算，不钉常数：起草那一版语料的达标读数是 79，新增一篇达标稿它就该跟着长，钉住它等于给每篇新文章判一次假红）`);

for (const [what, needle] of TOC_JS_MARKERS) {
  if (!readSrc('dev/js/editorial.js').includes(needle)) bad('目录', 'dev/js/editorial.js', `④ 找不到 ${what}——A8 不许把 JS 那一族删掉`);
}
if (postPages.length) {
  for (const needle of ['id="toc-list"', 'class="toc-list"', 'class="toc-fab"']) {
    if (!postPages[0].text.includes(needle)) bad('目录', postPages[0].rel, `④ 文章页产物里没有 ${needle}：JS 目录的三个落点少了一个`);
  }
}

{
  const css = readSite('assets/css/index.min.css');
  let hit = null;
  for (const m of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const sels = m[1].split(',').map((s) => s.trim());
    if (!sels.some((s) => /(^|\s)body\.has-toc \.toc-static$/.test(s))) continue;
    if (!/display:\s*none/.test(m[2])) {
      bad('目录', 'assets/css/index.min.css', `⑤ body.has-toc .toc-static 那条规则里没有 display:none（实际声明块 ${m[2].slice(0, 60)}）`);
      hit = null;
      break;
    }
    const depth = (css.slice(0, m.index).match(/\{/g) || []).length - (css.slice(0, m.index).match(/\}/g) || []).length;
    if (depth !== 0) bad('目录', 'assets/css/index.min.css', `⑤ 隐藏规则落在了 @media 里（深度 ${depth}）——只在某个断点生效，别的断点仍是两份同显`);
    if (!sels.some((s) => /(^|\s)html\.has-js \.toc-static$/.test(s))) bad('目录', 'assets/css/index.min.css', '⑤ 隐藏规则的选择器集里没有 html.has-js .toc-static——JS 起来那一帧之前没人收起静态块');
    hit = sels;
    break;
  }
  if (!hit) bad('目录', 'assets/css/index.min.css', '⑤ 找不到 body.has-toc .toc-static 这条规则——静态块与 JS 抽屉会同时显示');
}

// ── 组 15：searchAction（站内搜索的机器可读声明，SP3 E2）───────────────────────
{
  const g = 'searchAction';
  const HOME = 'index.html';
  if (!hasSite(HOME)) {
    bad(g, '首页产物', '_site 里没有 index.html，这一组无从判起');
  } else {
    // 全站恰好一份，且落在首页。WebSite 只在 page.url == '/' 那一支发出去（jsonLd.html:124），
    // 翻页视图跟着各声明一遍等于给爬虫 N 个互相竞争的规范声明。
    const holders = [];
    for (const rel of htmlFiles) {
      for (const b of jsonLdBlocks(readSite(rel))) {
        if (b.error || !b.value || !b.value.potentialAction) continue; // 解析失败由组 3 判红，不重复报
        holders.push({ rel, v: b.value });
      }
    }
    if (holders.length !== 1) {
      bad(g, '全站份数', `potentialAction 出现在 ${holders.length} 份文档（要恰好 1 份，且是首页）`);
    } else {
      const { rel, v } = holders[0];
      if (rel !== HOME) bad(g, rel, `potentialAction 落在这一页，首页才是 WebSite 的落点`);
      const pa = v.potentialAction;
      const t = Array.isArray(pa['@type']) ? pa['@type'] : [pa['@type']];
      if (!t.includes('SearchAction')) bad(g, rel, `potentialAction.@type 是 ${JSON.stringify(pa['@type'])}，不是 SearchAction`);
      if (!pa.target || pa.target['@type'] !== 'EntryPoint') bad(g, rel, 'target 不是 EntryPoint');
      else if (pa.target.urlTemplate !== `${v.url}?q={search_term_string}`) {
        bad(g, rel, `urlTemplate 与本页 WebSite.url 不同口径：${JSON.stringify(pa.target.urlTemplate)} ≠ ${JSON.stringify(v.url)}?q={search_term_string}`);
      }
      if (pa['query-input'] !== 'required name=search_term_string') bad(g, rel, `query-input=${JSON.stringify(pa['query-input'])}`);
      // 诚实性交叉检查：这一页必须真的能接住 ?q=。面板或脚本不在，SearchAction 就是空头支票——
      // SP1 停掉它正是因为这个地址当时没人读。
      const homeText = readSite(HOME);
      if (!/id="cmdk"/.test(homeText)) bad(g, HOME, '声明了 SearchAction 却没有 #cmdk，?q= 无人接收');
      if (!/editorial\.min\.js/.test(homeText)) bad(g, HOME, '声明了 SearchAction 但这一页不加载 editorial.min.js，面板打不开');
    }
  }
}

// ── 跑 ────────────────────────────────────────────────────────────────────────

const GROUPS = ['keywords', 'modified', 'JSON-LD', '分页门', 'ItemList', 'manifest', '接线', 'head', '相关工具', '换源', '描述', '词表', '内链', '目录', 'searchAction'];
console.log(
  `SEO 门禁：产物 ${path.relative(ROOT, SITE)}/（${htmlFiles.length} 页 / ${postRelSet.size} 篇文章页 / ${inScope.size} 页带安装面），` +
    `ready 工具 ${readyBySlug.size} 条，修订台账 ${Object.keys(modifiedData).length} 条，换源台账 ${Object.keys(JSON.parse(readSrc('scripts/image-variants.json')).variants || {}).length} 条` +
    (VERIFY ? '，含 --verify 重算' : ''),
);
if (LIST_ONLY) {
  for (const g of GROUPS) console.log(`  · ${g}`);
  console.log(`  head 布局：${headLayouts.join(' / ')}；规范首页 ${HOME_ABS}`);
  process.exit(0);
}

if (fails.length) {
  for (const f of fails) console.log('✗ ' + f);
  console.log(`✗ SEO 门禁：${fails.length} 条不通过`);
  process.exit(1);
}
console.log(`✓ SEO 门禁 ${GROUPS.length} 组全绿（${GROUPS.join(' / ')}）；JSON-LD ${blockTotal} 块全部可解析`);
