#!/usr/bin/env node
/**
 * check-seo.mjs 的牙齿台账：每组判据注入一处最小变异，确认门禁**会变红**、红在正确的那一组、
 * 并且红的是那一句。没有这份台账，全绿的门禁等于「没人验证过的报警器」。
 *
 * 与 `check-tools-surface-teeth.mjs` 的分工差别在变异落点：那一份要改源侧只能就地改真仓库
 * （内存备份 + exit 钩子还原），这一份不必——`check-seo.mjs` 从 2026-10-02 起支持
 * `--root=<源目录>`，于是**源侧变异也落在 /tmp 的副本里**，真仓库一个字节都不碰。
 * 这一条不是方便：本仓库此刻常有第二个会话在 main 上改同一批文件（`_posts/` 里正躺着一篇
 * 未提交的稿子），就地变异等于在别人正在编辑的工作树上做实验，还原时机一错就把对方的改动
 * 一起覆掉了。
 *
 * 用法（必须指着一份「源与产物成套」的快照跑）：
 *   node scripts/check-seo-teeth.mjs --root=/tmp/gate/head --site=/tmp/gate/head/_site
 *   node scripts/check-seo-teeth.mjs --only=manifest          # 只跑组名或条目名含该串的案例
 *   node scripts/check-seo-teeth.mjs --keep                  # 跑完保留 /tmp 副本，便于复查
 *
 * 快照怎么来（真仓库的 `_site/` 常落后于源，直接拿它当基线会一路假红）：
 *   git archive HEAD | tar -x -C /tmp/gate/head
 *   cd /tmp/gate/head && ln -s <真仓库>/vendor vendor && bundle exec jekyll build
 *
 * 四条口径：
 *   1. 变异没落地就抛。`String.replace` 找不到目标是原样返回的，静默 no-op 就是假牙的制造工序。
 *   2. 退出码 2 = 门禁自己崩了（`uncaughtException` 兜底会先把攒下的判定吐干净）。崩溃不算
 *      「如期变红」：判定是攒到最后才打印的，一处抛会让整轮结论消失，那种红证明不了任何事。
 *   3. `expect` 必须是门禁里那句判定的**逐字片段**，且优先挑「只有这一支判据在工作时才会出现」
 *      的字面量——同一刀常常几处齐红，只断言组名分不清到底是哪一道闸起的作用。
 *   4. 改动产物里的 JSON-LD 一律走「解析成对象 → 改字段 → 按 2 空格缩进序列化」，不拿字符串
 *      找钥匙：`"url"` 这个键在 BlogPosting 的 author 里和外层各出现一次，按「第一处」改会打在
 *      author 身上、却把功劳记给 BlogPosting.url 那条判据。
 *
 * 一处已知无牙：语料组第 1 判（`ruby 解析只回来 N 篇，目录里实有 M 个 .md`）防的是本门禁内嵌
 * 那段 ruby 自己坏掉，而不是产物坏掉。那段 ruby 对每个 `*.md` 都会回一个键——解析失败回
 * `__error__`，没有 front matter 分界也回 `__error__`——所以「磁盘上有文件而 ruby 没回来」这个
 * 形状在 `_posts/` 里造不出来，除非去改门禁自己的 glob/正则，而那已经不是这条判据的靶子。
 * 台账里如实记为空，读代码时盯住 `readSources()` 那段。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GATE = path.join(REPO, 'scripts/check-seo.mjs');
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const a = argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const SRC_IN = path.resolve(opt('root', REPO));
const SITE_IN = path.resolve(opt('site', path.join(SRC_IN, '_site')));
const ONLY = opt('only', null);
const KEEP = argv.includes('--keep');

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-teeth-'));
const SRCD = path.join(SCRATCH, 'src');
const SHADOW = path.join(SCRATCH, 'site');

/** 抄副本时跳过的目录：产物与 git 元数据由 --site 单独供，vendor 那一类是构建依赖不是判据输入 */
const SKIP = new Set(['_site', '.git', '.bundle', 'node_modules', 'vendor', '.jekyll-cache', '.sass-cache', '.DS_Store']);
const SKIP_RE = /(^|\/)(node_modules|vendor|\.git|\.bundle|_site)(\/|$)/;

function copyTrees() {
  fs.mkdirSync(SRCD, { recursive: true });
  for (const name of fs.readdirSync(SRC_IN)) {
    if (SKIP.has(name)) continue;
    const abs = path.join(SRC_IN, name);
    // 符号链接一律不抄：`vendor` 那种指回真仓库的链，抄进副本等于把真仓库暴露在变异之下
    if (fs.lstatSync(abs).isSymbolicLink()) continue;
    fs.cpSync(abs, path.join(SRCD, name), { recursive: true, dereference: false, filter: (p) => !SKIP_RE.test(p) });
  }
  fs.cpSync(SITE_IN, SHADOW, { recursive: true, dereference: false });
}

// 副本必须在任何「现读事实」之前落位：下面那些 const 是模块加载时就读文件的，不是跑案例时才读。
const COPY_START = Date.now();
copyTrees();
const COPY_NOTE = `${((Date.now() - COPY_START) / 1000).toFixed(1)}s`;

// ── 变异与还原 ────────────────────────────────────────────────────────────────

const pristine = new Map();
const save = (abs) => {
  if (!pristine.has(abs)) pristine.set(abs, fs.existsSync(abs) ? fs.readFileSync(abs) : null);
};
function restore() {
  for (const [abs, buf] of pristine) {
    if (buf === null) fs.rmSync(abs, { force: true, recursive: true });
    else fs.writeFileSync(abs, buf);
  }
  pristine.clear();
}
process.on('exit', () => {
  restore();
  if (!KEEP) fs.rmSync(SCRATCH, { recursive: true, force: true });
});
process.on('SIGINT', () => {
  restore();
  process.exit(130);
});

const srcAbs = (rel) => path.join(SRCD, rel);
const siteAbs = (rel) => path.join(SHADOW, rel);

function editText(abs, fn, label) {
  save(abs);
  const before = fs.readFileSync(abs, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error(`${label}：变异没落地`);
  fs.writeFileSync(abs, after);
}
function writeText(abs, text, label) {
  save(abs);
  if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf8') === text) throw new Error(`${label}：要写的文件本来就是这个内容`);
  fs.writeFileSync(abs, text);
}
function editBin(abs, fn, label) {
  save(abs);
  const before = fs.readFileSync(abs);
  const after = fn(before);
  if (after.equals(before)) throw new Error(`${label}：字节级变异没落地`);
  fs.writeFileSync(abs, after);
}
function drop(abs, label) {
  if (!fs.existsSync(abs)) throw new Error(`${label}：要删的文件本来就不存在`);
  save(abs);
  fs.rmSync(abs);
}

const srcEdit = (rel, fn, label = rel) => editText(srcAbs(rel), fn, `源 ${label}`);
const srcWrite = (rel, text, label = rel) => writeText(srcAbs(rel), text, `源 ${label}`);
const srcDrop = (rel, label = rel) => drop(srcAbs(rel), `源 ${label}`);
const srcBin = (rel, fn, label = rel) => editBin(srcAbs(rel), fn, `源 ${label}`);
const siteEdit = (rel, fn, label = rel) => editText(siteAbs(rel), fn, `产物 ${label}`);
const siteWrite = (rel, text, label = rel) => writeText(siteAbs(rel), text, `产物 ${label}`);
const siteDrop = (rel, label = rel) => drop(siteAbs(rel), `产物 ${label}`);
const siteBin = (rel, fn, label = rel) => editBin(siteAbs(rel), fn, `产物 ${label}`);

// ── 文本级一刀（落点必须唯一或至少存在，静默 no-op 一律抛） ────────────────────

const escRE = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const g = (re) => new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
const allOf = (s, re) => [...s.matchAll(g(re))];

/** 只改第一处且仅一处：找不到或找到两处都抛，免得一刀落在别人身上还算这一刀的功劳 */
function subOnce(s, needle, to, where) {
  if (needle instanceof RegExp) throw new Error(`${where}：subOnce 只收字符串钥匙（正则走 subFirst）`);
  const i = s.indexOf(needle);
  if (i < 0) throw new Error(`${where}：找不到「${needle}」`);
  if (s.indexOf(needle, i + 1) >= 0) throw new Error(`${where}：「${needle}」不止一处，这一刀落不准`);
  return s.slice(0, i) + to + s.slice(i + needle.length);
}
/** 取第一处匹配到的整段文本（多数用来把「整行」当钥匙交给 subOnce） */
function lineOf(s, re, where) {
  const m = re.exec(s);
  if (!m) throw new Error(`${where}：找不到形状 ${re}`);
  return m[0];
}
const subLine = (s, re, to, where) => subOnce(s, lineOf(s, re, where), to, where);
const cutLine = (s, re, where) => subOnce(s, `${lineOf(s, re, where)}\n`, '', where);
function subFirst(s, re, to, where) {
  const m = re.exec(s);
  if (!m) throw new Error(`${where}：找不到形状 ${re}`);
  return s.slice(0, m.index) + to + s.slice(m.index + m[0].length);
}
const cutFirst = (s, re, where) => subFirst(s, re, '', where);
/** 把第一处匹配交给函数改写；改写后与原串相同就抛（否则「这一刀没动任何东西」会被记成红） */
function patchFirst(s, re, fn, where) {
  const m = re.exec(s);
  if (!m) throw new Error(`${where}：找不到形状 ${re}`);
  const to = fn(m[0]);
  if (to === m[0]) throw new Error(`${where}：${re} 这一刀没有实际改动`);
  return s.slice(0, m.index) + to + s.slice(m.index + m[0].length);
}
/** 全量替换（先要求至少命中一处） */
function subAll(s, re, to, where) {
  if (!allOf(s, re).length) throw new Error(`${where}：找不到形状 ${re}，这一刀没有落点`);
  return s.replace(g(re), to);
}
const insertAfter = (s, anchor, tail, where) => subOnce(s, anchor, anchor + tail, where);
const insertBefore = (s, anchor, head, where) => subOnce(s, anchor, head + anchor, where);

const S = {
  srcSub: (rel, from, to, label = rel) => srcEdit(rel, (s) => subOnce(s, from, to, label)),
  srcSubRe: (rel, re, to, label = rel) => srcEdit(rel, (s) => subFirst(s, re, to, label)),
  srcSubLine: (rel, re, to, label = rel) => srcEdit(rel, (s) => subLine(s, re, to, label)),
  srcCutLine: (rel, re, label = rel) => srcEdit(rel, (s) => cutLine(s, re, label)),
  srcSubAll: (rel, re, to, label = rel) => srcEdit(rel, (s) => subAll(s, re, to, label)),
  siteSub: (rel, from, to, label = rel) => siteEdit(rel, (s) => subOnce(s, from, to, label)),
  siteCutRe: (rel, re, label = rel) => siteEdit(rel, (s) => cutFirst(s, re, label)),
  sitePatch: (rel, re, fn, label = rel) => siteEdit(rel, (s) => patchFirst(s, re, fn, label)),
  siteAfter: (rel, anchor, tail, label = rel) => siteEdit(rel, (s) => insertAfter(s, anchor, tail, label)),
  siteBefore: (rel, anchor, head, label = rel) => siteEdit(rel, (s) => insertBefore(s, anchor, head, label)),
};

// ── JSON-LD：按块认领，改对象而不是改字符串 ───────────────────────────────────

const LD_OPEN = '<script type="application/ld+json">';
const LD_CLOSE = '</scr' + 'ipt>';
const LD_RE = new RegExp(`${escRE(LD_OPEN)}([\\s\\S]*?)${escRE(LD_CLOSE)}`, 'g');
const ldBlocks = (s, marker) => allOf(s, LD_RE).filter((m) => m[1].includes(marker));

function editJson(rel, marker, mutate, where) {
  siteEdit(
    rel,
    (s) => {
      const hits = ldBlocks(s, marker);
      if (hits.length !== 1) throw new Error(`${where}：${rel} 里含「${marker}」的 JSON-LD 块是 ${hits.length} 块，这一刀没法只落在它身上`);
      const m = hits[0];
      const value = JSON.parse(m[1]);
      const next = mutate(value) ?? value;
      const inner = `\n${JSON.stringify(next, null, 2)}\n`;
      // 捕获组的起点是开标签之后，不是「整段长减去组长」——那个算法算出来的是 `</script>` 的位置，
      // 于是整块 JSON 会写到闭合标签外面，页面同时丢掉 BlogPosting 与 BreadcrumbList 两块。
      const at = m.index + LD_OPEN.length;
      return s.slice(0, at) + inner + s.slice(at + m[1].length);
    },
    where,
  );
}
/** 摘掉含 marker 的块；requireOne=false 时摘第一块（合集页那种一块一签的形状要显式松绑） */
function dropJson(rel, marker, where, requireOne = true) {
  siteEdit(
    rel,
    (s) => {
      const hits = ldBlocks(s, marker);
      if (requireOne && hits.length !== 1) throw new Error(`${where}：${rel} 里含「${marker}」的块是 ${hits.length} 块`);
      if (!hits.length) throw new Error(`${where}：${rel} 里没有含「${marker}」的块`);
      const m = hits[0];
      const tail = s[m.index + m[0].length] === '\n' ? m[0].length + 1 : m[0].length;
      return s.slice(0, m.index) + s.slice(m.index + tail);
    },
    where,
  );
}
/** 把含 marker 的块整块搬到 </head> 之前（位置判据的靶子） */
function moveJsonIntoHead(rel, marker, where) {
  siteEdit(
    rel,
    (s) => {
      const hits = ldBlocks(s, marker);
      if (hits.length !== 1) throw new Error(`${where}：${rel} 里含「${marker}」的块是 ${hits.length} 块`);
      const m = hits[0];
      const without = s.slice(0, m.index) + s.slice(m.index + m[0].length);
      const at = without.indexOf('</head>');
      if (at < 0) throw new Error(`${where}：${rel} 里没有 </head>`);
      return without.slice(0, at) + m[0] + without.slice(at);
    },
    where,
  );
}

// ── 从副本里现读事实（不在本文件写死 /better-blog、写死篇数、写死文件名） ──────

const y = (rel) => fs.readFileSync(srcAbs(rel), 'utf8');
const p = (rel) => fs.readFileSync(siteAbs(rel), 'utf8');
const has = (rel) => fs.existsSync(siteAbs(rel));

const CONF_TEXT = y('_config.yml');
/**
 * 五本源的解析一律走门禁那把 ruby 尺子，不在这里正则抠 YAML：`tags` 既可能是空格分隔串
 * 也可能是列表，`icon` / `path` 带不带引号两种写法都合法，而牙齿的钥匙必须是「解析出来的值」
 * 与「源里的字面量」同时对得上——自己写 YAML 子集解析器，第一次遇到引号变体就是假牙。
 * Psych 版本差异与 check-seo.mjs 同一口径：CI 的 Ruby 3.1（Psych 4）里 YAML.load 是
 * safe_load，front matter 的 Date 会被拒；仓库自有源统一 unsafe_load，Psych 3 退回 load。
 */
function readSourcesLikeGate() {
  const script = `
    require "yaml"; require "json"
    def yload_str(s)
      YAML.respond_to?(:unsafe_load) ? YAML.unsafe_load(s) : YAML.load(s)
    end
    def yload(p)
      yload_str(File.read(p, mode: "rb:UTF-8"))
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
        out["posts"][File.basename(f)] = yload_str(m[1]) || {}
      rescue StandardError
        out["posts"][File.basename(f)] = { "__error__" => "bad-yaml" }
      end
    end
    puts out.to_json
  `;
  let out;
  try {
    out = execFileSync('ruby', ['-e', script, SRCD], { encoding: 'utf8', maxBuffer: 32 << 20 });
  } catch (e) {
    throw new Error(`副本的五本源用 ruby 读不出来（牙齿与门禁同一口径，先确认 ruby + yaml 可用）：${e.message}`);
  }
  return JSON.parse(out.trim().split('\n').pop());
}
const SOURCES = readSourcesLikeGate();
for (const [key, file] of [
  ['config', '_config.yml'],
  ['onlineTools', '_data/onlineTools.yml'],
  ['manifestIcons', '_data/manifestIcons.yml'],
  ['series', '_data/series.yml'],
  ['modified', '_data/modified.yml'],
]) {
  const v = SOURCES[key];
  if (v && v.__error__) throw new Error(`副本的 ${file} 解析失败（${v.__error__}），牙齿的口径无从建立，先修这份快照`);
}
const config = SOURCES.config || {};
const CONFIG = {
  baseurl: String(config.baseurl || ''),
  siteUrl: String(config.url || '').replace(/\/$/, ''),
  keyword: String(config.keyword || ''),
  title: String(config.title || ''),
  author: String(config.author_name || ''),
  paginate: String(config.paginate_path || ''),
};
if (String(config.permalink || '') !== '/:year/:month/:day/:title.html') {
  throw new Error(`副本 _config.yml 的 permalink=${JSON.stringify(String(config.permalink))} 不是门禁认的那一条，稿子↔产物的映射失效，这一族靶子无从落刀`);
}
if (!CONFIG.baseurl) throw new Error('副本里读不到 baseurl，安装面那一族的锚就无从构造');
if (!CONFIG.siteUrl) throw new Error('副本里读不到 url，规范地址那一族的锚就无从构造');
if (!CONFIG.paginate.includes(':num')) throw new Error(`副本 paginate_path=${CONFIG.paginate} 不含 :num，翻页视图那一族无从落刀`);
const [PAGE_PRE, PAGE_POST] = CONFIG.paginate.split(':num');
const PAGE_RE = new RegExp(`^${escRE(PAGE_PRE)}\\d+${escRE(`${PAGE_POST}/index`)}\\.html$`);
/** 站内绝对地址：产物里 manifest / start_url / JSON-LD 用的都是这一形 */
const ABS = (rel) => `${CONFIG.siteUrl}${CONFIG.baseurl}/${String(rel).replace(/^\//, '')}`;
/** 产物里的地址去掉协议与 baseurl，返回不带前导斜杠的站内相对路径（hasSite 与换源台账都吃这一形） */
function localOf(src) {
  let s = String(src);
  if (s.startsWith(CONFIG.siteUrl)) s = s.slice(CONFIG.siteUrl.length);
  if (CONFIG.baseurl && s.startsWith(CONFIG.baseurl)) s = s.slice(CONFIG.baseurl.length);
  return s.replace(/^\//, '');
}

const SRC_TOP = fs.readdirSync(SRCD).filter((f) => f.endsWith('.html'));
function fmOfSrc(rel) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(y(rel));
  return m ? m[1] : '';
}
const layoutOf = (rel) =>
  /^layout:[ \t]*(\S.*)$/m
    .exec(fmOfSrc(rel))?.[1]
    ?.trim()
    .replace(/^['"]|['"]$/g, '') || '';
/** 与门禁 builtRelOfSrc 同口径：有 permalink 就按它，没有就按源文件路径 */
function builtOf(rel) {
  const m = /^permalink:[ \t]*(\S.*)$/m.exec(fmOfSrc(rel));
  if (!m) return rel;
  const pr = m[1].trim().replace(/^['"]|['"]$/g, '');
  if (/\.html$/.test(pr)) return pr.replace(/^\//, '');
  if (pr.endsWith('/')) return `${pr.replace(/^\//, '')}index.html`;
  return `${pr.replace(/^\//, '')}.html`;
}
const srcOfBuilt = (builtRel, where) =>
  first(
    SRC_TOP.filter((f) => builtOf(f) === builtRel),
    where,
  );

/** 与门禁同口径的三个归一化：tags 两种写法、date 两种形状、稿子→产物的地址 */
const asList = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : typeof v === 'string' ? v.trim().split(/\s+/).filter(Boolean) : []);
const dayOf = (v) => {
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};
function postBuiltRel(fileName, fm) {
  const m = /^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/.exec(fileName);
  if (!m) return null;
  const day = dayOf(fm.date) || `${m[1]}-${m[2]}-${m[3]}`;
  return `${day.replace(/-/g, '/')}/${m[4]}.html`;
}
const POSTS = [];
for (const [file, fm] of Object.entries(SOURCES.posts || {})) {
  if (!fm || fm.__error__) continue; // 读不出来的稿子在这一族不是靶子
  const rel = postBuiltRel(file, fm);
  if (!rel || !has(rel)) continue; // 文件名不成形、或产物压根没建出来
  POSTS.push({ file, rel, fm, tags: asList(fm.tags), cats: asList(fm.categories), day: dayOf(fm.date) || file.slice(0, 10) });
}
if (POSTS.length < 10) throw new Error(`副本里能对上的文章只有 ${POSTS.length} 篇，keywords／modified／相关工具三族的靶子不够`);

const MOD_KEYS = Object.keys(SOURCES.modified || {}).map(String);
const VARIANTS = Object.keys(JSON.parse(y('scripts/image-variants.json')).variants || {});

/**
 * tokens.scss 里 --paper 的明暗两档，口径与门禁 paperTokens() 一致：先剥注释，再按
 * 「选择器列表 → 声明块」成对扫描，选择器必须整项相等才算命中。
 * 顺带把「整行就是这一格声明」的原文一起认下来，三颗 --paper 牙的钥匙要用它，
 * 自己按十六进制拼一行出来会在缩进或大小写变了的那一刻落空。
 */
function paperFromTokens() {
  const rel = 'dev/sass/common/tokens.scss';
  const raw = y(rel);
  const text = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
  const pick = (selector) => {
    const hexes = [];
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const parts = m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' '));
      if (!parts.includes(selector)) continue;
      const d = /--paper:\s*(#[0-9A-Fa-f]{3,8})/.exec(m[2]);
      if (d) hexes.push(d[1].toUpperCase());
    }
    const uniq = [...new Set(hexes)];
    if (uniq.length !== 1) throw new Error(`副本 tokens.scss 的选择器 ${selector} 里解析出 ${uniq.length} 个不同的 --paper，明暗两档的对账口径失效，这一族没有可打的靶子`);
    const lines = raw.split(/\r?\n/).filter((l) => /^[ \t]*--paper:[ \t]*#[0-9A-Fa-f]{3,8};[ \t]*$/.test(l) && /--paper:\s*(#[0-9A-Fa-f]{3,8})/.exec(l)[1].toUpperCase() === uniq[0]);
    if (lines.length !== 1) throw new Error(`副本 tokens.scss 里整行形状且值为 ${uniq[0]} 的 --paper 有 ${lines.length} 行，这一刀落不准`);
    return { hex: uniq[0], line: lines[0] };
  };
  return { light: pick(':root'), dark: pick('body.night-mode') };
}
const PAPER = paperFromTokens();
const paperIndent = (which) => /^[ \t]*/.exec(PAPER[which].line)[0];

/** onlineTools.yml 的条目按块认领：条目字段是两格缩进，panels 里的同名键是六格缩进，不会串台 */
const toolBlocksOf = (text) => text.split(/(?=^- slug: )/m);
const toolBlockRe = (slug) => new RegExp(`^- slug:[ \\t]*${escRE(slug)}[ \\t]*(\r?\n|$)`);
const toolStr = (v) => String(v ?? '');
const TOOLS = (Array.isArray(SOURCES.onlineTools) ? SOURCES.onlineTools : []).map((t) => ({
  slug: toolStr(t.slug),
  status: toolStr(t.status),
  url: toolStr(t.url),
  name: toolStr(t.name),
  h1: toolStr(t.h1),
  tagline: toolStr(t.tagline),
  icon: toolStr(t.icon),
  tags: Array.isArray(t.match_tags) ? t.match_tags.map(toolStr) : [],
}));
const READY = TOOLS.filter((t) => t.status === 'ready');
if (READY.length < 2) throw new Error(`副本里 ready 工具只有 ${READY.length} 条，文末卡那一族的靶子不够`);
const toolByUrl = (u) => READY.find((t) => t.url === u);
/** 某个 slug 的整块（跑案例之前读，副本每轮还原后仍然有效） */
function blockOf(slug) {
  return first(
    toolBlocksOf(y('_data/onlineTools.yml')).filter((b) => toolBlockRe(slug).test(b)),
    `slug=${slug} 的工具条目块`,
  );
}
/** 只改某个 slug 那一条目的某个字段行——同名字段在别的条目、别的层级都有，必须按块认领 */
function editToolField(slug, key, to, where) {
  srcEdit(
    '_data/onlineTools.yml',
    (s) => {
      const blocks = toolBlocksOf(s);
      const idx = blocks.findIndex((b) => new RegExp(`^- slug:[ \\t]*${escRE(slug)}[ \\t]*(\r?\n|$)`).test(b));
      if (idx < 0) throw new Error(`${where}：onlineTools.yml 里没有 slug=${slug} 的条目块`);
      blocks[idx] = subLine(blocks[idx], new RegExp(`^  ${escRE(key)}:[ \\t]*\\S.*$`, 'm'), to, `${where}（${slug}.${key}）`);
      return blocks.join('');
    },
    where,
  );
}
/** 修订台账里某个 url 那条目的字段行（key 顶格、字段两格缩进） */
function editModField(rel, key, to, where) {
  srcEdit(
    '_data/modified.yml',
    (s) => {
      const keyLine = lineOf(s, new RegExp(`^"/${escRE(rel)}":[ \\t]*$`, 'm'), `${rel} 的台账 key`);
      const at = s.indexOf(keyLine);
      const rest = s.slice(at + keyLine.length);
      const stop = rest.search(/\n\S/);
      const blk = rest.slice(0, stop < 0 ? rest.length : stop);
      const next = subLine(blk, new RegExp(`^[ \\t]+${escRE(key)}:[ \\t]*\\S.*$`, 'm'), `  ${to}`, `${where}（${rel}.${key}）`);
      return s.slice(0, at + keyLine.length) + next + s.slice(at + keyLine.length + blk.length);
    },
    where,
  );
}
/** manifest 台账（_data/manifestIcons.yml 是块式 YAML，不是 JSON，所以走 ruby 那把尺子） */
const MANIFEST_ICONS = SOURCES.manifestIcons || {};
/** manifest 台账里第 i 枚 use: manifest 图标的产物相对路径（不带前导斜杠） */
function iconPath(i) {
  const manifest = MANIFEST_ICONS;
  const want = (manifest.icons || []).filter((x) => x.use === 'manifest');
  const it = want[i];
  if (!it) throw new Error(`manifestIcons.yml 里 use: manifest 的只有 ${want.length} 枚，取不到第 ${i + 1} 枚`);
  return String(it.path).replace(/^\//, '');
}

const siteHtml = [];
(function walk(dir, prefix) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) walk(abs, rel);
    else if (e.name.endsWith('.html')) siteHtml.push(rel);
  }
})(SHADOW, '');

const first = (list, why) => {
  if (!list.length) throw new Error(`${why}：一个候选都没找到，这一刀的前提没了`);
  return list[0];
};

/** 文末卡的第 i 枚（0 基）：直接从产物解析，改哪个工具就动哪个工具的台账 */
function cardOf(rel, i) {
  const text = p(rel);
  const start = text.indexOf('<section class="post-footer-item related-tools"');
  if (start < 0) throw new Error(`${rel} 里没有文末卡`);
  const sec = text.slice(start, text.indexOf('</section>', text.indexOf('</ul>', start)));
  const items = allOf(sec, /<li class="related-tools-item">([\s\S]*?)<\/li>/g);
  const it = items[i];
  if (!it) throw new Error(`${rel} 的第 ${i + 1} 枚卡不存在（整页 ${items.length} 枚）`);
  const href = /<a class="related-tools-link" href="([^"]*)"/.exec(it[1])?.[1];
  const icon = /<img class="related-tools-icon" src="([^"]*)"/.exec(it[1])?.[1];
  if (!href || !icon) throw new Error(`${rel} 的第 ${i + 1} 枚卡缺 href 或 icon，形状与门禁的解析不一致`);
  return { total: items.length, href, url: `/${localOf(href)}`, icon, tool: toolByUrl(`/${localOf(href)}`) };
}
const cardHtml = (label) => `<section class="post-footer-item related-tools" aria-label="${label}"><ul class="related-tools-list"><li class="related-tools-item">x</li></ul></section>`;

/** 与门禁 postBodyRegion 同一口径：`<article id="post-body">` 那一个元素的内部（含嵌套 article 的配对） */
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
const IMG_RE = /<img\b[^>]*?>/gi;
/** 门禁挑 LCP 候选的那一片：正文区内、没被 lazy 挡住的头一枚 img；区外（打赏二维码、作者卡、read-next 缩略图）它压根没看过 */
function bodyEagerImgs(text) {
  const body = postBodyRegion(text);
  const rn = text.indexOf('post-footer-item read-next');
  const end = body ? body.end : rn > 0 ? rn : text.length;
  return allOf(text, IMG_RE).filter((m) => m.index > (body ? body.start : -1) && m.index < end && !/loading="lazy"/.test(m[0]));
}

/** 与门禁同口径的「带 head 布局的源页」集合，用来认出范围外的那些产物页 */
const WALK_SKIP = new Set(['node_modules', 'vendor', 'assets', 'dev', 'scripts', 'fixtures', '_data', '_drafts', '_includes', '_layouts', '_plugins', '_posts', '_sass', '_site']);
function srcPagesLikeGate() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(srcAbs(dir), { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!WALK_SKIP.has(e.name)) walk(rel);
      } else if (e.name.endsWith('.html')) out.push(rel);
    }
  })('');
  return out;
}
const HEAD_LAYOUTS = fs
  .readdirSync(srcAbs('_layouts'))
  .filter((f) => f.endsWith('.html'))
  .filter((f) => /{%\s*include\s+(head|postHead)\.html/.test(y(`_layouts/${f}`)))
  .map((f) => f.replace(/\.html$/, ''));
const IN_SCOPE = new Set([
  ...srcPagesLikeGate()
    .filter((rel) => layoutOf(rel) && HEAD_LAYOUTS.includes(layoutOf(rel)))
    .map(builtOf),
  ...POSTS.map((q) => q.rel),
  ...siteHtml.filter((r) => PAGE_RE.test(r)),
]);

/** 挑靶子：全部在跑案例之前算好；副本每轮还原成基线，所以这些靶子始终有效 */
function pickTargets() {
  const withCard = POSTS.filter((q) => has(q.rel) && p(q.rel).includes('<section class="post-footer-item related-tools"'));
  const cardsOf = (n) =>
    first(
      withCard.filter((q) => allOf(p(q.rel), /<li class="related-tools-item">/g).length === n),
      `文末有 ${n} 枚卡的文章页`,
    );
  const toolSrc = first(
    SRC_TOP.filter((f) => /^tool:[ \t]*(?!false)\S/m.test(fmOfSrc(f)) && has(builtOf(f))),
    '带 tool: 的源页',
  );
  return {
    about: 'about.html',
    renamed: first(
      SRC_TOP.filter((f) => layoutOf(f) && /^permalink:/m.test(fmOfSrc(f)) && has(builtOf(f))),
      '顶层带 layout+permalink 的源页',
    ),
    plain: first(
      POSTS.filter((q) => has(q.rel) && !MOD_KEYS.includes(`/${q.rel}`)),
      '没有修订台账条目的文章页',
    ),
    mod: first(
      POSTS.filter((q) => has(q.rel) && MOD_KEYS.includes(`/${q.rel}`) && /<meta property="article:modified_time"/.test(p(q.rel))),
      '有跨日修订台账条目的文章页',
    ),
    card1: cardsOf(1),
    card2: cardsOf(2),
    noCard: first(
      POSTS.filter((q) => has(q.rel) && !READY.some((t) => t.tags.some((x) => q.tags.includes(x))) && !p(q.rel).includes('related-tools')),
      '命中 0 个工具的文章页',
    ),
    tagged: first(
      POSTS.filter((q) => q.tags.length >= 2 && has(q.rel) && /<meta name="keywords"/.test(p(q.rel))),
      '带 ≥2 个 tags 且产物发了 keywords 的文章页',
    ),
    catted: first(
      POSTS.filter((q) => q.cats.length >= 1 && has(q.rel)),
      '带 ≥1 个 categories 的文章页',
    ),
    hero: first(
      POSTS.filter((q) => has(q.rel) && p(q.rel).includes('<figure class="post-hero">') && /fetchpriority="high"/.test(p(q.rel))),
      '有头图且已提权的文章页',
    ),
    bodyLcp: first(
      POSTS.filter((q) => has(q.rel) && !p(q.rel).includes('<figure class="post-hero">') && /fetchpriority="high"/.test(p(q.rel))),
      '正文首图当 LCP 的文章页',
    ),
    noLcp: first(
      POSTS.filter((q) => has(q.rel) && !p(q.rel).includes('<figure class="post-hero">') && !bodyEagerImgs(p(q.rel)).length),
      '无头图、正文区也没有 eager img 的文章页',
    ),
    toolPage: builtOf(toolSrc),
    toolSrc,
    toolSlug: /^tool:[ \t]*(\S+)/m.exec(fmOfSrc(toolSrc))?.[1]?.trim(),
    noindexPage: first(SRC_TOP.filter((f) => /^noindex:[ \t]*(?!false)\S/m.test(fmOfSrc(f)) && has(builtOf(f))).map(builtOf), 'noindex 源页的产物'),
    webpPage: first(
      siteHtml.filter((r) =>
        allOf(p(r), /<img\b[^>]*\bsrc="([^"]*\.webp)"/g).some((m) => {
          const png = `${localOf(m[1]).replace(/\.webp$/, '')}.png`;
          return VARIANTS.includes(png) && has(png);
        }),
      ),
      '正文里有已换源图片的页面',
    ),
    outScope: first(
      siteHtml.filter((r) => /^demo\//.test(r) && !IN_SCOPE.has(r)),
      'demo 下的范围外产物页',
    ),
    page2: first(
      siteHtml.filter((r) => PAGE_RE.test(r)),
      '翻页视图',
    ),
    listSrc: ['index.html', 'series.html'].filter((f) => y(f).includes('jsonLdList.html')),
  };
}
if (!has('index.html') || !has('series.html') || !has('about.html') || !has('categories.html')) throw new Error('副本产物里缺 index/series/about/categories，快照不是成套的一份');
if (!has('sitemap.xml')) throw new Error('副本产物里缺 sitemap.xml');
const T = pickTargets();

/** 合集页里第一个「@id 锚点对得上可见 section、条目数 ≥min」的 slug */
function seriesSlug(minItems = 1) {
  const text = p('series.html');
  for (const b of ldBlocks(text, '"@type": "ItemList"')) {
    const o = JSON.parse(b[1]);
    const slug = String(o['@id'] || '')
      .split('#')
      .pop();
    if ((o.itemListElement || []).length >= minItems && new RegExp(`<section class="cat-section series-section" id="${escRE(slug)}">`).test(text)) return slug;
  }
  throw new Error(`series.html 里找不到条目数 ≥${minItems} 且 section 对得上的合集块`);
}
function seriesSlugWithLede() {
  const text = p('series.html');
  for (const b of ldBlocks(text, '"@type": "ItemList"')) {
    const o = JSON.parse(b[1]);
    const slug = String(o['@id'] || '')
      .split('#')
      .pop();
    if (typeof o.description === 'string' && o.description && /<p class="series-lede">/.test(text) && new RegExp(`<section class="cat-section series-section" id="${escRE(slug)}">`).test(text)) return slug;
  }
  throw new Error('series.html 里没有「块带 description 且页面有 .series-lede」的合集，这一刀的前提没了');
}
/** 产物里第一个指向「确实存在的 webp」的 img */
function webpLocal() {
  for (const rel of siteHtml) {
    for (const m of allOf(p(rel), /<img\b[^>]*\bsrc="([^"]*\.webp)"/g)) {
      const l = localOf(m[1]);
      if (has(l)) return l;
    }
  }
  throw new Error('产物里没有任何 img 指向存在的 .webp，换源那一族没有可打的靶子');
}

/**
 * 描述组（M1–M4、M16）的靶子：摘要存在、长度留有余量、产物页在，且整篇源文件里
 * 找不到 M4 要塞的那串数字——否则那一刀落下去门禁有理由不红，而被记成「假牙」。
 */
const DIGITS_M4 = '41793';
const descTarget = () =>
  first(
    POSTS.filter((q) => {
      const d = String(q.fm.seo_description || '').trim();
      const sub = String(q.fm.subtitle || '').trim();
      return d.length >= 60 && d.length <= 130 && sub && has(q.rel) && !y(`_posts/${q.file}`).includes(DIGITS_M4);
    }),
    '描述组的靶子（有摘要、有副标题、产物在、正文不含那串牙齿数字）',
  );

// ── 案例 ──────────────────────────────────────────────────────────────────────

/**
 * 一条 = 一个 { name, group, expect, mut }。
 * `mut` 只准动副本，动完由主循环还原；`expect` 是门禁那句判定的逐字片段。
 */
/** 把变异只打进正文区间。取 `#post-body` 开到它后面第一个 `</article>`——这一段真区间
 *  一定包含在内（正文里若嵌了 `<article>`，真区间更长），所以命中它的变异必定命中正文。 */
function subInBody(html, from, to, where) {
  const at = html.search(/<article\b[^>]*\bid="post-body"[^>]*>/i);
  const close = html.indexOf('</article>', at);
  if (at < 0 || close <= at) throw new Error(`${where}：切不到正文区间`);
  const span = html.slice(at, close);
  const n = span.split(from).length - 1;
  if (n !== 1) throw new Error(`${where}：正文里 ${from} 出现 ${n} 次，不是恰好一处`);
  return html.slice(0, at) + span.replace(from, to) + html.slice(close);
}
const bodyToolLink = (rel) => {
  const html = fs.readFileSync(siteAbs(rel), 'utf8');
  const at = html.search(/<article\b[^>]*\bid="post-body"[^>]*>/i);
  const close = html.indexOf('</article>', at);
  return at >= 0 && close > at ? /href="(\/better-blog\/tools\/[a-z0-9-]+\.html)"/.exec(html.slice(at, close)) : null;
};

/**
 * 目录组（M11/M13/M14/M17）的靶子：一篇「产物里有静态块」的页面。
 * 不写死文件名——写死一篇就可能撞上那篇没有块的（2018-12-25-qqweiboshare），
 * 那一刀落在不存在的块上会被记成「假牙」，其实是靶子选错了。
 */
const tocTarget = () =>
  first(
    POSTS.filter((q) => has(q.rel) && fs.readFileSync(siteAbs(q.rel), 'utf8').includes('class="toc-static"')),
    '目录组的靶子（产物里带静态目录块的文章页）',
  );

const cases = [
  // ── 语料 ──
  {
    name: '产物里少一篇文章页（源还在）',
    group: '语料',
    expect: '稿子存在、日期不是未来，产物里却没有',
    mut: () => siteDrop(T.plain.rel),
  },
  {
    name: '源页 permalink 改了而产物没跟着建',
    group: '语料',
    expect: '的源页没建出',
    mut: () => S.srcSubLine(T.renamed, /^permalink:[ \t]\S.*$/m, 'permalink: /teeth-nonexistent.html', '源页 permalink'),
  },
  {
    name: '稿子文件名不是日期形状',
    group: '语料',
    expect: '文件名不是 YYYY-MM-DD-slug.md 形状',
    mut: () => srcWrite('_posts/teeth-not-a-date.md', '---\ntitle: 牙齿\ntags: 牙齿\ndate: 2020-01-01\n---\n\n正文\n'),
  },
  {
    name: '稿子没有 front matter 分界',
    group: '语料',
    expect: 'front matter 读不出来',
    mut: () => srcWrite('_posts/2020-01-01-teeth-nofm.md', '这篇压根没有 --- 分界\n'),
  },
  {
    name: '稿子 front matter 不是合法 YAML',
    group: '语料',
    expect: '不是合法 YAML',
    mut: () => srcWrite('_posts/2020-01-02-teeth-badyaml.md', '---\ntitle: 牙齿\ntags: [未闭合\ndate: 2020-01-02\n---\n\n正文\n'),
  },
  {
    name: '源删了而产物页还挂着（对不上任何一篇）',
    group: '语料',
    expect: '却对不上任何一篇 _posts',
    mut: () => srcDrop(`_posts/${T.plain.file}`),
  },

  // ── keywords ──
  {
    name: '源里改了 tags，产物没跟着改',
    group: 'keywords',
    expect: '与源里的 tags=',
    mut: () => S.srcSubLine(`_posts/${T.tagged.file}`, /^tags:[ \t].*$/m, `${lineOf(y(`_posts/${T.tagged.file}`), /^tags:[ \t].*$/m, 'tags 行')} 牙齿附加词`, 'tags 行'),
  },
  {
    name: '源里删掉 tags 行，产物仍在发 keywords',
    group: 'keywords',
    expect: '这篇源里没有 tags',
    mut: () => S.srcCutLine(`_posts/${T.tagged.file}`, /^tags:[ \t].*$/m, 'tags 行'),
  },
  {
    name: 'tags 里塞一个含逗号的词',
    group: 'keywords',
    expect: '含逗号的',
    mut: () => S.srcSubLine(`_posts/${T.tagged.file}`, /^tags:[ \t].*$/m, 'tags: 牙齿,词 另一个词', 'tags 行'),
  },
  {
    name: '产物里 keywords meta 被删',
    group: 'keywords',
    expect: '产物里没有 keywords meta',
    mut: () => S.siteCutRe(T.tagged.rel, /<meta name="keywords"[^>]*>/, 'keywords meta'),
  },
  {
    name: 'article:tag 少一枚',
    group: 'keywords',
    expect: 'article:tag 序列与源里 tags 不一致',
    mut: () => S.siteCutRe(T.tagged.rel, /^[ \t]*<meta property="article:tag"[^\n]*\n/m, 'article:tag'),
  },
  {
    name: '非文章页发了 keywords',
    group: 'keywords',
    expect: '非文章页输出了 keywords',
    mut: () => S.siteAfter(T.about, '</body>', '<meta name="keywords" content="牙齿,注入">', '非文章页 keywords'),
  },
  {
    name: 'site.keyword 原串在产物里回潮',
    group: 'keywords',
    expect: 'site.keyword 原串仍出现在',
    mut: () => S.siteAfter(T.about, '</body>', `<!-- ${CONFIG.keyword} -->`, '非文章页回潮'),
  },

  // ── modified ──
  {
    name: '台账 key 的 url 多打一个字符',
    group: 'modified',
    expect: '台账里有这一条，产物里却没有对应的文章页',
    mut: () => S.srcSub('_data/modified.yml', `"/${T.mod.rel}":`, `"/${T.mod.rel}-teeth":`, '台账 key'),
  },
  {
    name: '台账里那一条整个删掉',
    group: 'modified',
    expect: '而台账里没有跨日修订的条目',
    mut: () =>
      srcEdit(
        '_data/modified.yml',
        (s) => {
          const keyLine = lineOf(s, new RegExp(`^"/${escRE(T.mod.rel)}":[ \\t]*$`, 'm'), '台账 key 行');
          const at = s.indexOf(keyLine);
          const rest = s.slice(at + keyLine.length);
          const stop = rest.search(/\n\S/);
          const len = stop < 0 ? rest.length : stop;
          return s.slice(0, at) + s.slice(at + keyLine.length + len + 1);
        },
        '台账整块',
      ),
  },
  {
    name: '产物里没有 article:modified_time',
    group: 'modified',
    expect: '产物却没有 article:modified_time',
    mut: () => S.siteCutRe(T.mod.rel, /^[ \t]*<meta property="article:modified_time"[^\n]*\n/m, 'modified_time'),
  },
  {
    name: 'article:modified_time 与台账 at 不等',
    group: 'modified',
    expect: '与台账 at=',
    mut: () => S.sitePatch(T.mod.rel, /<meta property="article:modified_time" content="[^"]*"/, (t) => t.replace(/content="[^"]*"/, 'content="1991-02-03T00:00:00+08:00"'), 'modified_time'),
  },
  {
    name: 'BlogPosting.dateModified 与 meta 不同值',
    group: 'modified',
    expect: '与 article:modified_time 不同值',
    mut: () =>
      editJson(
        T.mod.rel,
        '"@type": "BlogPosting"',
        (o) => {
          o.dateModified = '1991-02-03T00:00:00+08:00';
        },
        'BlogPosting.dateModified',
      ),
  },
  {
    name: '台账 at 改成发布日之前',
    group: 'modified',
    expect: '早于发布日',
    mut: () => editModField(T.mod.rel, 'at', 'at: "1990-01-01T00:00:00+08:00"', '台账 at'),
  },
  {
    name: '台账 published 与 front matter 的 date 不等',
    group: 'modified',
    expect: '与这篇 front matter 的 date=',
    mut: () => editModField(T.mod.rel, 'published', 'published: "1990-01-01"', '台账 published'),
  },
  {
    name: '台账 commit 不是短 sha 形状',
    group: 'modified',
    expect: '不是短 sha 形状',
    mut: () => editModField(T.mod.rel, 'commit', 'commit: zzzzzzz', '台账 commit'),
  },
  {
    name: 'sitemap 的 lastmod 与复算值不等',
    group: 'modified',
    expect: '与复算应为',
    mut: () =>
      siteEdit(
        'sitemap.xml',
        (s) => {
          const re = new RegExp(`(<loc>${escRE(ABS(T.mod.rel))}<\\/loc>\\s*<lastmod>)[^<]*(<\\/lastmod>)`);
          const m = re.exec(s);
          if (!m) throw new Error(`sitemap 里找不到 ${T.mod.rel} 那条「<loc> 紧跟 <lastmod>」的形状`);
          return s.slice(0, m.index) + `${m[1]}1991-02-03${m[2]}` + s.slice(m.index + m[0].length);
        },
        'sitemap lastmod',
      ),
  },
  {
    name: 'sitemap 里少了一篇文章的 <url>',
    group: 'modified',
    expect: '里没有这一条 <url>',
    mut: () => siteEdit('sitemap.xml', (s) => cutFirst(s, new RegExp(`<url>\\s*<loc>${escRE(ABS(T.plain.rel))}</loc>[\\s\\S]*?</url>\\n?`), `${T.plain.rel} 的 <url>`), 'sitemap 漏一篇'),
  },

  // ── JSON-LD ──
  {
    name: '一块 JSON-LD 语法坏掉',
    group: 'JSON-LD',
    expect: '有一块不是合法 JSON',
    mut: () =>
      siteEdit(
        T.plain.rel,
        (s) => {
          const hits = ldBlocks(s, '"@type": "BreadcrumbList"');
          if (hits.length !== 1) throw new Error(`面包屑语法：${T.plain.rel} 里含标记的块是 ${hits.length} 块`);
          const m = hits[0];
          const inEnd = m[1].lastIndexOf('}');
          if (inEnd < 0) throw new Error('面包屑块里没有右大括号');
          const at = m.index + LD_OPEN.length + inEnd;
          return `${s.slice(0, at)}!${s.slice(at + 1)}`;
        },
        '面包屑语法',
      ),
  },
  {
    name: 'noindex 页递了结构化数据',
    group: 'JSON-LD',
    expect: 'noindex，产物里却有',
    mut: () => S.siteAfter(T.noindexPage, '</body>', '<script type="application/ld+json">\n{"@context": "https://schema.org", "@type": "BlogPosting", "headline": "牙齿"}\n</script>', 'noindex 页尾'),
  },
  {
    name: 'BlogPosting 整块不见',
    group: 'JSON-LD',
    expect: 'BlogPosting 块数=0',
    mut: () => dropJson(T.plain.rel, '"@type": "BlogPosting"', 'BlogPosting 块'),
  },
  {
    name: 'BreadcrumbList 整块不见',
    group: 'JSON-LD',
    expect: 'BreadcrumbList 块数=0',
    mut: () => dropJson(T.plain.rel, '"@type": "BreadcrumbList"', '面包屑块'),
  },
  {
    name: '源里改 title，headline 没跟着改',
    group: 'JSON-LD',
    expect: '与源里的 title=',
    mut: () =>
      srcEdit(
        `_posts/${T.plain.file}`,
        (s) => {
          const l = lineOf(s, /^title:[ \t].*$/m, 'front title');
          const to = /["']\s*$/.test(l) ? l.replace(/(\s*)(["'])\s*$/, '牙齿$2') : `${l} 牙齿`;
          return subOnce(s, l, to, 'front title');
        },
        'front title',
      ),
  },
  {
    name: 'headline 与页面上可见的 H1 不同值',
    group: 'JSON-LD',
    expect: '与该页可见的 <h1 class="post-masthead-title">不同值',
    mut: () =>
      editJson(
        T.plain.rel,
        '"@type": "BlogPosting"',
        (o) => {
          o.headline = `${o.headline} 牙齿`;
        },
        'headline',
      ),
  },
  {
    name: 'datePublished 与源里 date 不是同一天',
    group: 'JSON-LD',
    expect: '与源里的 date=',
    mut: () =>
      editJson(
        T.plain.rel,
        '"@type": "BlogPosting"',
        (o) => {
          o.datePublished = '1991-02-03T00:00:00+08:00';
        },
        'datePublished',
      ),
  },
  {
    name: 'BlogPosting.url 与规范地址不同',
    group: 'JSON-LD',
    expect: '与这篇的规范地址不同',
    mut: () =>
      editJson(
        T.plain.rel,
        '"@type": "BlogPosting"',
        (o) => {
          o.url = ABS('teeth.html');
        },
        'BlogPosting.url',
      ),
  },
  {
    name: 'BlogPosting.keywords 与源里 tags 拼接不等',
    group: 'JSON-LD',
    expect: '与源里 tags 的 ',
    mut: () =>
      editJson(
        T.plain.rel,
        '"@type": "BlogPosting"',
        (o) => {
          o.keywords = '牙齿,注入的词';
        },
        'BlogPosting.keywords',
      ),
  },
  {
    name: 'author.@id 漂到一个没声明过的地址',
    group: 'JSON-LD',
    expect: '作者实体只有 about.html 一处声明',
    mut: () =>
      editJson(
        T.plain.rel,
        '"@type": "BlogPosting"',
        (o) => {
          o.author['@id'] = ABS('teeth.html#author');
        },
        'author.@id',
      ),
  },
  {
    name: '面包屑 position 序列不是从 1 连续',
    group: 'JSON-LD',
    expect: '不是从 1 连续',
    mut: () =>
      editJson(
        T.plain.rel,
        '"@type": "BreadcrumbList"',
        (o) => {
          o.itemListElement[1].position = 5;
        },
        '面包屑 position',
      ),
  },
  {
    name: '面包屑第 1 条不是首页',
    group: 'JSON-LD',
    expect: '面包屑第 1 条不是首页',
    mut: () =>
      editJson(
        T.plain.rel,
        '"@type": "BreadcrumbList"',
        (o) => {
          o.itemListElement[0].item = ABS('teeth.html');
        },
        '面包屑第 1 条',
      ),
  },
  {
    name: '面包屑最后一条不是本篇',
    group: 'JSON-LD',
    expect: '面包屑最后一条不是本篇',
    mut: () =>
      editJson(
        T.plain.rel,
        '"@type": "BreadcrumbList"',
        (o) => {
          o.itemListElement[o.itemListElement.length - 1].name = '牙齿不是本篇';
        },
        '面包屑末条',
      ),
  },
  {
    name: '有分类却摘掉分类那一条面包屑',
    group: 'JSON-LD',
    expect: '却给出',
    mut: () =>
      editJson(
        T.catted.rel,
        '"@type": "BreadcrumbList"',
        (o) => {
          o.itemListElement.splice(1, 1);
        },
        '面包屑条数',
      ),
  },
  {
    name: '源里改 categories，第 2 条面包屑没跟着改',
    group: 'JSON-LD',
    expect: '应为首个分类',
    mut: () => S.srcSubLine(`_posts/${T.catted.file}`, /^categories:[ \t].*$/m, 'categories: 牙齿分类', 'categories 行'),
  },
  {
    name: '工具页 WebApplication 整块不见',
    group: 'JSON-LD',
    expect: 'WebApplication 块数=0',
    mut: () => dropJson(T.toolPage, '"@type": "WebApplication"', 'WebApplication 块'),
  },
  {
    name: '工具页 CollectionPage 整块不见',
    group: 'JSON-LD',
    expect: 'CollectionPage 块数=0',
    mut: () => dropJson(T.toolPage, '"@type": "CollectionPage"', 'CollectionPage 块'),
  },
  {
    name: 'WebApplication.name 与可见 H1 不符',
    group: 'JSON-LD',
    expect: '与页面上可见的 H1=',
    mut: () =>
      editJson(
        T.toolPage,
        '"@type": "WebApplication"',
        (o) => {
          o.name = `${o.name} 牙齿`;
        },
        'WA.name',
      ),
  },
  {
    name: 'yml 的 h1 改了而产物 name 没跟着改',
    group: 'JSON-LD',
    expect: '与 _data/onlineTools.yml 的 h1=',
    mut: () => {
      const t = first(
        TOOLS.filter((x) => x.slug === T.toolSlug),
        `slug=${T.toolSlug} 的工具条目`,
      );
      editToolField(t.slug, 'h1', `  h1: ${t.h1} 牙齿`, 'yml h1');
    },
  },
  {
    name: 'WebApplication.description 与 meta description 不同口径',
    group: 'JSON-LD',
    expect: 'WebApplication.description 与 meta description 不同口径',
    mut: () =>
      editJson(
        T.toolPage,
        '"@type": "WebApplication"',
        (o) => {
          o.description = '牙齿摘要';
        },
        'WA.description',
      ),
  },
  {
    name: 'WebApplication.url 与 yml 里的 url 不同',
    group: 'JSON-LD',
    expect: '与 yml 里的 url=',
    mut: () =>
      editJson(
        T.toolPage,
        '"@type": "WebApplication"',
        (o) => {
          o.url = ABS('tools/teeth.html');
        },
        'WA.url',
      ),
  },
  {
    name: 'featureList 换了顺序',
    group: 'JSON-LD',
    expect: 'featureList 与 yml',
    mut: () =>
      editJson(
        T.toolPage,
        '"@type": "WebApplication"',
        (o) => {
          if (!Array.isArray(o.featureList) || o.featureList.length < 2) throw new Error('WebApplication 的 featureList 不足两项，换不了顺序');
          o.featureList = [...o.featureList].reverse();
        },
        'featureList',
      ),
  },
  {
    name: 'applicationCategory 被改走',
    group: 'JSON-LD',
    expect: 'applicationCategory 不是 DeveloperApplication',
    mut: () =>
      editJson(
        T.toolPage,
        '"@type": "WebApplication"',
        (o) => {
          o.applicationCategory = 'ProductivityApplication';
        },
        'applicationCategory',
      ),
  },
  {
    name: 'offers.price 不再是 0',
    group: 'JSON-LD',
    expect: 'offers.price 应为 0',
    mut: () =>
      editJson(
        T.toolPage,
        '"@type": "WebApplication"',
        (o) => {
          if (!o.offers) throw new Error('WebApplication 里没有 offers');
          o.offers.price = 9.9;
        },
        'offers.price',
      ),
  },
  {
    name: 'WebApplication.author.@id 漂走',
    group: 'JSON-LD',
    expect: 'author.@id 没指向 about.html#author',
    mut: () =>
      editJson(
        T.toolPage,
        '"@type": "WebApplication"',
        (o) => {
          if (!o.author) throw new Error('WebApplication 里没有 author');
          o.author['@id'] = ABS('teeth.html#author');
        },
        'WA.author.@id',
      ),
  },
  {
    name: '凭空注入 aggregateRating',
    group: 'JSON-LD',
    expect: '出现了 aggregateRating / review',
    mut: () =>
      editJson(
        T.toolPage,
        '"@type": "WebApplication"',
        (o) => {
          o.aggregateRating = { '@type': 'AggregateRating', ratingValue: '4.9', reviewCount: '120' };
        },
        'aggregateRating',
      ),
  },
  {
    name: 'front matter 的 tool 写错，yml 里没有 ready 条目',
    group: 'JSON-LD',
    expect: '没有 status: ready 的同名条目',
    mut: () => S.srcSubLine(T.toolSrc, /^tool:[ \t]\S.*$/m, 'tool: teeth-no-such-slug', 'tool 行'),
  },
  {
    name: 'about.html 的 Person 块不见了',
    group: 'JSON-LD',
    expect: '没有 Person 块',
    mut: () => dropJson(T.about, '"@type": "Person"', 'Person 块'),
  },
  {
    name: 'Person.@id 与文章页引用的地址不等',
    group: 'JSON-LD',
    expect: '与 post 页引用的',
    mut: () =>
      editJson(
        T.about,
        '"@type": "Person"',
        (o) => {
          o['@id'] = ABS('teeth.html#author');
        },
        'Person.@id',
      ),
  },
  {
    name: 'author_name 改了而 Person.name 没跟着改',
    group: 'JSON-LD',
    expect: 'Person.name 与 _config.yml 的 author_name 不等',
    mut: () => S.srcSubLine('_config.yml', /^author_name:[ \t].*$/m, `author_name: '${CONFIG.author} 牙齿'`, 'author_name'),
  },

  // ── 分页门 ──
  {
    name: '翻页视图声称自己是首页信息流',
    group: '分页门',
    expect: '各自声称自己是首页信息流',
    mut: () => S.siteAfter(T.page2, '</body>', `<script type="application/ld+json">\n{"@context": "https://schema.org", "@type": "WebSite", "@id": "${ABS('')}#website", "name": "牙齿"}\n</script>`, '翻页视图 WebSite'),
  },
  {
    name: 'paginate_path 改了形状，翻页视图判据空转',
    group: '分页门',
    expect: '推出来的翻页视图一个都没有',
    mut: () => S.srcSubLine('_config.yml', /^paginate_path:[ \t].*$/m, "paginate_path: 'teeth:num'", 'paginate_path'),
  },

  // ── ItemList ──
  {
    name: '首页源里 include 了而产物没有块',
    group: 'ItemList',
    expect: '产物里却没有 ItemList 块',
    mut: () => dropJson('index.html', '"@type": "ItemList"', '首页 ItemList 块'),
  },
  {
    name: '一页发出 ItemList 而源里没有 include',
    group: 'ItemList',
    expect: '但源里没有 include jsonLdList.html',
    mut: () => S.siteAfter(T.about, '</body>', '<script type="application/ld+json">\n{"@context": "https://schema.org", "@type": "ItemList", "itemListElement": []}\n</script>', '非清单页 ItemList'),
  },
  {
    name: '两处 include 一起断掉（这一族整块没了）',
    group: 'ItemList',
    expect: '没有任何源页 include jsonLdList.html',
    mut: () => {
      if (T.listSrc.length < 2) throw new Error(`只剩 ${T.listSrc.length} 本源页 include jsonLdList.html，这一刀的前提（两处）变了`);
      for (const f of T.listSrc) S.srcSubRe(f, /{\%-?\s*include\s+jsonLdList\.html[^%]*?%\}/, '{%- include jsonLdNothing.html -%}', `${f} 的 include`);
    },
  },
  {
    name: '一块 ItemList 落进 <head>',
    group: 'ItemList',
    expect: '落在 <head> 里',
    mut: () => moveJsonIntoHead('index.html', '"@type": "ItemList"', '首页 ItemList 位置'),
  },
  {
    name: 'numberOfItems 与条目枚数不等',
    group: 'ItemList',
    expect: '与 itemListElement 枚数=',
    mut: () =>
      editJson(
        'index.html',
        '"@type": "ItemList"',
        (o) => {
          o.numberOfItems = 99;
        },
        '首页 numberOfItems',
      ),
  },
  {
    name: '声明的条目比页面上可见的少',
    group: 'ItemList',
    expect: '页面上可见',
    mut: () =>
      editJson(
        'index.html',
        '"@type": "ItemList"',
        (o) => {
          o.itemListElement.pop();
          o.numberOfItems = o.itemListElement.length;
        },
        '首页条目数',
      ),
  },
  {
    name: '首页 ItemList 缺 itemListOrder',
    group: 'ItemList',
    expect: '缺 itemListOrder: Descending',
    mut: () =>
      editJson(
        'index.html',
        '"@type": "ItemList"',
        (o) => {
          delete o.itemListOrder;
        },
        '首页 itemListOrder',
      ),
  },
  {
    name: '首页 ItemList 写了 description',
    group: 'ItemList',
    expect: '首页 ItemList 写了 description',
    mut: () =>
      editJson(
        'index.html',
        '"@type": "ItemList"',
        (o) => {
          o.description = '牙齿';
        },
        '首页 description',
      ),
  },
  {
    name: '首页第 1 条 url 与可见链接不同',
    group: 'ItemList',
    expect: '与可见链接=',
    mut: () =>
      editJson(
        'index.html',
        '"@type": "ItemList"',
        (o) => {
          o.itemListElement[0].url = ABS('teeth.html');
        },
        '首页第 1 条 url',
      ),
  },
  {
    name: '首页第 1 条 name 与可见 H2 不同值',
    group: 'ItemList',
    expect: '与可见 <h2 class="post-title"> 不同值',
    mut: () =>
      editJson(
        'index.html',
        '"@type": "ItemList"',
        (o) => {
          o.itemListElement[0].name = '牙齿不是标题';
        },
        '首页第 1 条 name',
      ),
  },
  {
    name: '首页第 1 条 position 不是 1',
    group: 'ItemList',
    expect: '第 1 条 position=',
    mut: () =>
      editJson(
        'index.html',
        '"@type": "ItemList"',
        (o) => {
          o.itemListElement[0].position = 2;
        },
        '首页第 1 条 position',
      ),
  },
  {
    name: '合集块的 @id 锚点对不上可见 section',
    group: 'ItemList',
    expect: '却没有 @id 以',
    mut: () => {
      const slug = seriesSlug();
      editJson(
        'series.html',
        `#${slug}"`,
        (o) => {
          o['@id'] = `${ABS('series.html')}#teeth-changed`;
        },
        `合集 ${slug} 的 @id`,
      );
    },
  },
  {
    name: '合集少发一块 ItemList',
    group: 'ItemList',
    expect: 'ItemList 块数=',
    mut: () => dropJson('series.html', '"@type": "ItemList"', '合集第一块 ItemList', false),
  },
  {
    name: '合集块 name 与可见的 cat-name 不同值',
    group: 'ItemList',
    expect: '与可见的 <h2 class="cat-name">=',
    mut: () => {
      const slug = seriesSlug();
      editJson(
        'series.html',
        `#${slug}"`,
        (o) => {
          o.name = '牙齿合集';
        },
        `合集 ${slug} 的 name`,
      );
    },
  },
  {
    name: '合集块 description 与可见 lede 不同值',
    group: 'ItemList',
    expect: 'description 与可见的 .series-lede 不同值',
    mut: () => {
      const slug = seriesSlugWithLede();
      editJson(
        'series.html',
        `#${slug}"`,
        (o) => {
          o.description = '牙齿摘要';
        },
        `合集 ${slug} 的 description`,
      );
    },
  },
  {
    name: '合集块写了 itemListOrder',
    group: 'ItemList',
    expect: '合集块写了 itemListOrder',
    mut: () => {
      const slug = seriesSlug();
      editJson(
        'series.html',
        `#${slug}"`,
        (o) => {
          o.itemListOrder = 'https://schema.org/ItemListOrderAscending';
        },
        `合集 ${slug} 的 itemListOrder`,
      );
    },
  },
  {
    name: '合集块第 1 条 url 与可见链接不同',
    group: 'ItemList',
    expect: '与可见 href=',
    mut: () => {
      const slug = seriesSlug(2);
      editJson(
        'series.html',
        `#${slug}"`,
        (o) => {
          o.itemListElement[0].url = ABS('teeth.html');
        },
        `合集 ${slug} 的第 1 条 url`,
      );
    },
  },
  {
    name: '分类页发 ItemList（声明不出新事实）',
    group: 'ItemList',
    expect: '声明不出新事实',
    mut: () => S.siteAfter('categories.html', '</body>', '<script type="application/ld+json">\n{"@context": "https://schema.org", "@type": "ItemList", "itemListElement": []}\n</script>', '分类页 ItemList'),
  },

  // ── manifest ──
  {
    name: '产物里没有 manifest.json',
    group: 'manifest',
    expect: '没有它，sw.js 跑得再好也拿不到',
    mut: () => siteDrop('manifest.json'),
  },
  {
    name: 'manifest.json 不是合法 JSON',
    group: 'manifest',
    expect: '只是安装面静默消失',
    mut: () =>
      siteEdit(
        'manifest.json',
        (s) => {
          const at = s.lastIndexOf('}');
          return `${s.slice(0, at)}!${s.slice(at)}`;
        },
        'manifest 语法',
      ),
  },
  {
    name: '站点 title 改了而 manifest.name 没跟着改',
    group: 'manifest',
    expect: '与 _config.yml 的 title 不等',
    mut: () => S.srcSubLine('_config.yml', /^title:[ \t].*$/m, `title: '${CONFIG.title} 牙齿'`, 'title'),
  },
  {
    name: 'short_name 超过 12 个字符',
    group: 'manifest',
    expect: '主屏那行名字会被截断',
    mut: () =>
      editManifest((o) => {
        // 13 个字：门禁的口径是 `> 12`，正好 12 个字符那一刀打不动它
        o.short_name = '牙齿牙齿牙齿牙齿牙齿牙齿牙';
      }, 'short_name'),
  },
  {
    name: 'manifest 出现 orientation',
    group: 'manifest',
    expect: '出现了 orientation',
    mut: () =>
      editManifest((o) => {
        o.orientation = 'portrait';
      }, 'orientation'),
  },
  {
    name: 'start_url 丢了 baseurl',
    group: 'manifest',
    expect: '没带 baseurl 那一段',
    mut: () =>
      editManifest((o) => {
        o.start_url = `${CONFIG.siteUrl}/`;
      }, 'start_url'),
  },
  {
    name: 'display 被改成 browser',
    group: 'manifest',
    expect: '应为「standalone」',
    mut: () =>
      editManifest((o) => {
        o.display = 'browser';
      }, 'display'),
  },
  {
    name: 'manifest.json 进了站点地图',
    group: 'manifest',
    expect: '它是机器读物',
    mut: () => S.siteSub('sitemap.xml', '</urlset>', `<url><loc>${ABS('manifest.json')}</loc></url>\n</urlset>`, 'urlset 收尾'),
  },
  {
    name: 'manifest.json 的 icons 少一枚',
    group: 'manifest',
    expect: '台账里有这枚 manifest 图标',
    mut: () =>
      editManifest((o) => {
        if (!Array.isArray(o.icons) || o.icons.length < 2) throw new Error(`manifest.json 的 icons 只有 ${(o.icons || []).length} 项，摘不掉「少一枚」`);
        o.icons = o.icons.slice(1);
      }, 'icons 少一枚'),
  },
  {
    name: '台账 sizes 改了而 manifest.json 没跟着改',
    group: 'manifest',
    expect: 'sizes=「',
    mut: () => S.srcSub('_data/manifestIcons.yml', 'sizes: 192x192', 'sizes: 256x256', '192 的 sizes'),
  },
  {
    name: 'manifest 里 type 被改走',
    group: 'manifest',
    expect: '应为 image/png',
    mut: () =>
      editManifest((o) => {
        o.icons[0].type = 'image/webp';
      }, 'icons type'),
  },
  {
    name: 'manifest 指向的图标在产物里不存在',
    group: 'manifest',
    expect: 'manifest 指向的地址在产物里不存在',
    // 台账与 manifest.json 都还认这一枚，只有产物里的那个文件没了——门禁的存在性判据是拿
    // 台账的 path 去 hasSite，改 manifest.json 的 src 只会红成「台账里有而 icons 里没有」。
    mut: () => siteDrop(iconPath(0)),
  },
  {
    name: '产物图标的 IHDR 与台账声明不等',
    group: 'manifest',
    expect: 'IHDR 量出来',
    mut: () =>
      siteBin(iconPath(0), (buf) => {
        const next = Buffer.from(buf);
        if (next.length < 24) throw new Error(`${iconPath(0)} 短于 24 B，读不到 IHDR`);
        next.writeUInt32BE(256, 16);
        return next;
      }),
  },
  {
    name: '产物图标多了一个尾字节',
    group: 'manifest',
    expect: 'B，台账',
    mut: () => siteBin(iconPath(1), (buf) => Buffer.concat([buf, Buffer.from([0x0a])])),
  },
  {
    name: '产物图标不是 PNG（文件头对不上）',
    group: 'manifest',
    expect: '不是 PNG（文件头对不上）',
    mut: () => siteBin(iconPath(0), () => Buffer.from('not a png at all, but long enough to pass the size check', 'utf8')),
  },
  {
    name: '产物图标短到读不出 IHDR（门禁不许崩在这一格）',
    group: 'manifest',
    expect: '连 IHDR 都读不出来',
    mut: () => siteBin(iconPath(0), () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])),
  },
  {
    name: '仓库源图标与台账 sha256 不等',
    group: 'manifest',
    expect: '仓库源文件与台账 sha256 不等',
    mut: () =>
      srcBin(iconPath(1), (buf) => {
        const next = Buffer.from(buf);
        next[next.length - 1] ^= 0x01;
        return next;
      }),
  },
  {
    name: '台账 sha256 改了而图标没动',
    group: 'manifest',
    expect: '产物里的字节与台账 sha256 不等',
    mut: () => {
      const want = first(
        MANIFEST_ICONS.icons.filter((x) => x.use === 'manifest'),
        'use: manifest 的第一枚图标',
      );
      const flipped = `${String(want.sha256).slice(0, -4)}0000`;
      S.srcSub('_data/manifestIcons.yml', String(want.sha256), flipped, 'manifest 图标的 sha256');
    },
  },
  {
    name: '台账 sizes 出现重复',
    group: 'manifest',
    expect: '台账里 sizes 有重复',
    mut: () => S.srcSub('_data/manifestIcons.yml', 'sizes: 192x192', 'sizes: 512x512', '192 的 sizes'),
  },
  {
    name: 'apple-touch 那一枚被改成 manifest 用',
    group: 'manifest',
    expect: 'apple-touch 那一族应恰好一枚',
    mut: () => S.srcSub('_data/manifestIcons.yml', 'use: apple-touch', 'use: manifest', 'apple-touch 的 use'),
  },
  {
    name: 'favicon.svg 改了而 source_sha256 没刷新',
    group: 'manifest',
    expect: '已改动而台账的 source_sha256 没刷新',
    mut: () => srcEdit('favicon.svg', (s) => `${s}\n<!-- 牙齿 -->`, 'favicon.svg'),
  },
  {
    name: '台账缺 source_sha256 那一格',
    group: 'manifest',
    expect: '台账缺 source / source_sha256 两格之一',
    mut: () => S.srcCutLine('_data/manifestIcons.yml', /^source_sha256:[ \t]*\S.*$/m, 'source_sha256'),
  },
  {
    name: ':root 里出现第二个 --paper',
    group: 'manifest',
    expect: '个不同的 --paper',
    mut: () => S.srcSub('dev/sass/common/tokens.scss', PAPER.light.line, `${PAPER.light.line}\n${paperIndent('light')}--paper: #112233;`, ':root 的 --paper'),
  },
  {
    name: '暗档 --paper 整格没了',
    group: 'manifest',
    expect: '只解析出 --paper 明=',
    mut: () => S.srcSub('dev/sass/common/tokens.scss', `${PAPER.dark.line}\n`, '', '暗档 --paper'),
  },

  // ── 接线 ──
  {
    name: '一页少了 apple-touch 那条 link',
    group: '接线',
    expect: '安装面标记共 3 条',
    mut: () => S.siteCutRe('index.html', /^[ \t]*<link rel="apple-touch-icon"[^\n]*\n/m, 'apple-touch link'),
  },
  {
    name: '一页出现两条 rel="manifest"',
    group: '接线',
    expect: 'rel="manifest" 的 link 有 2 条',
    mut: () => S.sitePatch('index.html', /^[ \t]*<link rel="manifest"[^\n]*>$/m, (t) => `${t}\n${t.trim()}`, 'manifest link'),
  },
  {
    name: 'manifest link 丢了 baseurl',
    group: '接线',
    expect: 'manifest href=「/manifest.json」',
    mut: () => S.siteSub('index.html', `href="${CONFIG.baseurl}/manifest.json"`, 'href="/manifest.json"', 'manifest href'),
  },
  {
    name: '台账的 apple-touch path 改了而页面 link 没跟着改',
    group: '接线',
    expect: '台账里 apple-touch 那枚是',
    mut: () => {
      const apple = MANIFEST_ICONS.icons.find((x) => x.use === 'apple-touch');
      if (!apple) throw new Error('台账里没有 use: apple-touch 的那一枚');
      S.srcSub('_data/manifestIcons.yml', `path: ${apple.path}`, `path: ${String(apple.path).replace(/\.png$/, 'b.png')}`, 'apple 的 path');
    },
  },
  {
    name: '一页只剩一条 theme-color',
    group: '接线',
    expect: 'theme-color 有 1 条',
    mut: () => S.siteCutRe('index.html', /^[ \t]*<meta name="theme-color" media="\(prefers-color-scheme: dark\)"[^\n]*\n/m, '暗档 theme-color'),
  },
  {
    name: 'tokens.scss 的暗档 --paper 改了',
    group: '接线',
    expect: '暗档 theme-color=「',
    mut: () => S.srcSub('dev/sass/common/tokens.scss', PAPER.dark.line, PAPER.dark.line.replace(/#[0-9A-Fa-f]{3,8}/, '#12141B'), '暗档 --paper'),
  },
  {
    name: 'manifest link 排在第一个 stylesheet 之后',
    group: '接线',
    expect: '排在第一个 rel="stylesheet" 之后',
    mut: () => {
      const text = p('index.html');
      const link = lineOf(text, /^[ \t]*<link rel="manifest"[^\n]*>$/m, 'manifest link');
      const css = /<link[^>]*rel="stylesheet"[^>]*>/.exec(text.slice(text.indexOf(link) + link.length));
      if (!css) throw new Error('manifest link 之后找不到 stylesheet link，这一刀的落点没了');
      siteEdit(
        'index.html',
        (s) => {
          const removed = s.replace(`${link}\n`, '');
          const at = removed.indexOf(css[0]) + css[0].length;
          return `${removed.slice(0, at)}\n${link.trim()}${removed.slice(at)}`;
        },
        'manifest link 位置',
      );
    },
  },
  {
    name: '范围外的页面声明可安装',
    group: '接线',
    expect: '范围外的页面不声明可安装',
    mut: () => S.siteAfter(T.outScope, '</body>', `<link rel="manifest" href="${CONFIG.baseurl}/manifest.json">`, '范围外页声明可安装'),
  },
  {
    name: '来了一个不属于三类范围、也不带布局的产物页',
    group: '接线',
    expect: '不在「demo/** / offline.html / Google 校验文件」这三类范围内',
    mut: () => siteWrite('teeth-stray.html', '<!DOCTYPE html><html><head><title>牙齿</title></head><body>散页</body></html>\n'),
  },

  // ── head ──
  {
    name: 'seoScript.html 只剩两条 script',
    group: 'head',
    expect: '这一族本来是三条统计/推送',
    mut: () => S.srcCutLine('_includes/seoScript.html', /^<script[^>]*baiduPush[^\n]*$/m, 'baiduPush 那条'),
  },
  {
    name: 'seoScript 的 src 改成一个产物里没有的地址',
    group: 'head',
    expect: '产物 head 里找不到',
    mut: () => S.srcSub('_includes/seoScript.html', 'soPush.min.js', 'soPushRenamed.min.js', 'soPush src'),
  },
  {
    name: '产物里 soPush 丢了 defer',
    group: 'head',
    expect: '没有 defer——三个第三方域同步加载',
    mut: () => S.sitePatch('index.html', /<script[^>]*\bsrc="[^"]*soPush[^"]*"[^>]*>/, (t) => t.replace(/\sdefer\b/, ''), 'soPush defer'),
  },
  {
    name: 'head 里多出一枚同步第三方 script',
    group: 'head',
    expect: '在 <head> 里同步加载',
    mut: () => S.siteBefore('index.html', '</head>', `<script src="${ABS('assets/js/teeth-sync.js')}"></script>`, 'head 内同步 script'),
  },
  {
    name: 'headAssets 里同步加载的 src 改了名',
    group: 'head',
    expect: '里有产物没出现的',
    mut: () => S.srcSubRe('_includes/headAssets.html', /src="\{\{ site\.baseurl \}\}\/assets\/js\/jquery[^"]*"/, 'src="{{ site.baseurl }}/assets/js/jqueryRenamed.min.js"', 'jQuery src'),
  },
  {
    name: 'headAssets 给 jQuery 加了 defer（判据与实现漂开）',
    group: 'head',
    expect: '在 <head> 里同步加载',
    mut: () => S.srcSubRe('_includes/headAssets.html', /<script(?![^>]*\b(?:defer|async)\b)[^>]*\bsrc="\{\{ site\.baseurl \}\}\/assets\/js\/jquery[^"]*"/, '<script defer src="{{ site.baseurl }}/assets/js/jquery.min.js"', 'jQuery 加 defer'),
  },
  {
    name: '推送脚本源码里还有 document.write',
    group: 'head',
    expect: '源码里还有 document.write',
    mut: () => srcEdit('dev/libJs/soPush.js', (s) => `${s}\ndocument.write('teeth');\n`, 'soPush 源'),
  },

  // ── 相关工具 ──
  {
    name: 'match_tags 写成空格分隔的字符串',
    group: '相关工具',
    expect: 'match_tags 不是列表',
    mut: () => {
      const t = first(
        READY.filter((x) => /match_tags:\n(?:[ \t]*- .*\n)+/.test(blockOf(x.slug))),
        '块式 match_tags 的工具条目',
      );
      const blk = blockOf(t.slug);
      const m = /match_tags:\n(?:[ \t]*- .*\n)+/.exec(blk);
      if (!m) throw new Error(`${t.slug} 的块里找不到块式 match_tags`);
      S.srcSub('_data/onlineTools.yml', m[0], `match_tags: ${t.tags.join(' ')}\n`, `${t.slug} 的 match_tags`);
    },
  },
  {
    name: '命中 0 个工具的帖子画出了卡',
    group: '相关工具',
    expect: '命中 0 个工具，产物却画了卡',
    mut: () => S.siteAfter(T.noCard.rel, '</body>', cardHtml('牙齿'), '无命中帖子画卡'),
  },
  {
    name: '该有卡的帖子整块不见了',
    group: '相关工具',
    expect: '产物里没有 .related-tools 这一块',
    mut: () => S.siteCutRe(T.card1.rel, /<section class="post-footer-item related-tools"[\s\S]*?<\/section>\n?/, 'related-tools 整块'),
  },
  {
    name: '卡里少画一枚',
    group: '相关工具',
    expect: '枚，按 yml × tags 复算应为',
    mut: () => S.siteCutRe(T.card2.rel, /[ \t]*<li class="related-tools-item">[\s\S]*?<\/li>\n/, '一枚 related-tools-item'),
  },
  {
    name: '卡里一枚指向了别的地址',
    group: '相关工具',
    expect: '枚指向 ',
    mut: () => {
      const c = cardOf(T.card1.rel, 0);
      S.siteSub(T.card1.rel, `<a class="related-tools-link" href="${c.href}"`, `<a class="related-tools-link" href="${CONFIG.baseurl}/tools/teeth.html"`, '卡里的链接');
    },
  },
  {
    name: '卡里的链接没变但目标页不在产物里（404 卡）',
    group: '相关工具',
    expect: '产物里没有这一页（画出来的就是 404 卡）',
    mut: () => siteDrop(localOf(cardOf(T.card1.rel, 0).href)),
  },
  {
    name: '卡里的图标与 yml 的 icon 不等',
    group: '相关工具',
    expect: '与 yml 的 icon=',
    mut: () => {
      const c = cardOf(T.card1.rel, 0);
      S.siteSub(T.card1.rel, `<img class="related-tools-icon" src="${c.icon}"`, `<img class="related-tools-icon" src="${CONFIG.baseurl}/assets/img/tools/teeth-icon.svg"`, '卡里的图标');
    },
  },
  {
    name: '卡里的图标文件在产物里不存在',
    group: '相关工具',
    expect: '枚的图标文件在产物里不存在',
    mut: () => siteDrop(localOf(cardOf(T.card1.rel, 0).icon)),
  },
  {
    name: 'yml 的 name 改了而卡里的名称没跟着改',
    group: '相关工具',
    expect: '枚名称=「',
    mut: () => {
      const t = cardOf(T.card1.rel, 0).tool;
      if (!t) throw new Error('第一枚卡的 href 对不上任何 ready 条目，name 那一刀没有靶子');
      editToolField(t.slug, 'name', `  name: ${t.name} 牙齿`, '工具 name');
    },
  },
  {
    name: 'yml 的 tagline 改了而卡里的摘要没跟着改',
    group: '相关工具',
    expect: '枚摘要与 yml tagline 不等',
    mut: () => {
      const t = cardOf(T.card1.rel, 0).tool;
      if (!t) throw new Error('第一枚卡的 href 对不上任何 ready 条目，tagline 那一刀没有靶子');
      editToolField(t.slug, 'tagline', `  tagline: ${t.tagline} 牙齿`, '工具 tagline');
    },
  },
  {
    name: '卡里的箭头没标 aria-hidden',
    group: '相关工具',
    expect: '枚的箭头没标 aria-hidden',
    mut: () => S.sitePatch(T.card1.rel, /class="related-tools-go" aria-hidden="true"/, (t) => t.replace(/ aria-hidden="true"/, ''), '箭头 aria-hidden'),
  },
  {
    name: '卡里的图标没有 loading="lazy"',
    group: '相关工具',
    expect: '卡里的图标没有 loading="lazy"',
    mut: () => S.sitePatch(T.card1.rel, /<img class="related-tools-icon"[^>]*>/, (t) => t.replace(/\s+loading="lazy"/, ''), '卡图标 lazy'),
  },
  {
    name: '两枚卡的顺序换成了命中枚数序',
    group: '相关工具',
    expect: '应为 _data/onlineTools.yml 的条目顺序',
    mut: () =>
      siteEdit(
        T.card2.rel,
        (s) => {
          const items = allOf(s, /[ \t]*<li class="related-tools-item">[\s\S]*?<\/li>/g);
          if (items.length < 2) throw new Error('这一篇的卡不足两枚，交换不了顺序');
          const [a, b] = items;
          return s.slice(0, a.index) + b[0] + s.slice(a.index + a[0].length, b.index) + a[0] + s.slice(b.index + b[0].length);
        },
        '卡序',
      ),
  },
  {
    name: '所有 match_tags 一起失效（一篇都没画卡）',
    group: '相关工具',
    expect: '一篇都没画出卡',
    mut: () => S.srcSubAll('_data/onlineTools.yml', /match_tags:\n(?:[ \t]*- .*\n)+/g, 'match_tags: []\n', '全部 match_tags'),
  },
  {
    name: '非文章页画出了相关工具卡',
    group: '相关工具',
    expect: '非文章页画出了相关工具卡',
    mut: () => S.siteAfter(T.about, '</body>', cardHtml('牙齿'), '非文章页画卡'),
  },

  // ── 换源 ──
  {
    name: '产物里少了一个被引用的 webp',
    group: '换源',
    expect: '指向的 webp 在产物里不存在',
    mut: () => siteDrop(webpLocal()),
  },
  {
    name: '换源后的 img 被改回台账里的 png',
    group: '换源',
    expect: '而台账里它已转出 webp',
    mut: () => {
      const rel = T.webpPage;
      const m = first(
        allOf(p(rel), /<img\b[^>]*\bsrc="([^"]*\.webp)"/g).filter((x) => VARIANTS.includes(`${localOf(x[1]).replace(/\.webp$/, '')}.png`)),
        `${rel} 里已换源的 img`,
      );
      const png = `${localOf(m[1]).replace(/\.webp$/, '')}.png`;
      if (!has(png)) throw new Error(`产物里没有 ${png}，这一刀打不出「png 存在却没换源」的形状`);
      S.siteSub(rel, `src="${m[1]}"`, `src="/${png}"`, '换源 img');
    },
  },
  {
    name: 'img 只剩一半尺寸',
    group: '换源',
    expect: '只有 width 或只有 height',
    mut: () => S.sitePatch(T.hero.rel, /<img\b[^>]*\bwidth="\d+"[^>]*\bheight="\d+"[^>]*>/, (t) => t.replace(/\swidth="\d+"/, ''), '头图尺寸'),
  },
  {
    name: '一页有两枚 fetchpriority="high"',
    group: '换源',
    expect: '一页只该有一个 LCP 候选',
    mut: () => S.sitePatch(T.hero.rel, /<img\b(?![^>]*fetchpriority)[^>]*>/, (t) => `${t.replace(/>$/, '')} fetchpriority="high">`, '第二枚提权'),
  },
  {
    name: 'fetchpriority 与 loading="lazy" 同时出现',
    group: '换源',
    expect: '同时出现——高优先级预加载',
    mut: () => S.sitePatch(T.hero.rel, /<img\b[^>]*fetchpriority="high"[^>]*>/, (t) => t.replace(/(\/?>)$/, ' loading="lazy"$1'), '头图 lazy'),
  },
  {
    name: '有头图却没提权',
    group: '换源',
    expect: '有头图却没有 fetchpriority',
    mut: () => S.sitePatch(T.hero.rel, /<img\b[^>]*fetchpriority="high"[^>]*>/, (t) => t.replace(/\s*fetchpriority="high"/, ''), '头图提权'),
  },
  {
    name: '不该提权的页面出现了 fetchpriority',
    group: '换源',
    expect: '却出现了 fetchpriority="high"',
    mut: () => S.siteAfter(T.noLcp.rel, '</body>', `<img src="${ABS('assets/img/icons/icon-180.png')}" alt="牙齿" width="2" height="2" fetchpriority="high">`, '无 LCP 需求页提权'),
  },
  {
    name: '有头图，提权却落在正文里',
    group: '换源',
    expect: '却落在正文里',
    mut: () => {
      const rel = T.hero.rel;
      const text = p(rel);
      const hero = lineOf(text, /<img\b[^>]*fetchpriority="high"[^>]*>/, '头图 img');
      const src = /\bsrc="([^"]*)"/.exec(hero)?.[1];
      const open = lineOf(text, /<article[^>]*id="post-body"[^>]*>/, '正文容器开标签');
      if (!src) throw new Error('头图 img 里取不到 src');
      siteEdit(
        rel,
        (s) => {
          const removed = s.replace(hero, hero.replace(/\s*fetchpriority="high"/, ''));
          const at = removed.indexOf(open) + open.length;
          return `${removed.slice(0, at)}\n<img src="${src}" alt="牙齿" fetchpriority="high">${removed.slice(at)}`;
        },
        '提权挪进正文',
      );
    },
  },
  {
    name: '提权没落在正文第一张 eager 图上',
    group: '换源',
    expect: '没落在正文第一张 eager 图上',
    mut: () => {
      const rel = T.bodyLcp.rel;
      const text = p(rel);
      const open = lineOf(text, /<article[^>]*id="post-body"[^>]*>/, '正文容器开标签');
      const src = /\bsrc="([^"]*)"/.exec(lineOf(text, /<img\b[^>]*fetchpriority="high"[^>]*>/, '已提权的 img'))?.[1];
      if (!src) throw new Error('取不到已提权 img 的 src');
      S.siteAfter(rel, open, `\n<img src="${src}" alt="牙齿">`, '正文首张图之前插一枚 eager 图');
    },
  },
  // ── 描述（SP4 A4：M1–M4、M16）──
  {
    name: 'M1 摘掉某篇的 seo_description 行',
    group: '描述',
    expect: '缺 seo_description',
    mut: () => S.srcCutLine(`_posts/${descTarget().file}`, /^seo_description:[ \t].*$/m, '摘要行'),
  },
  {
    name: 'M2 把某篇摘要长度改成 45 个 code point',
    group: '描述',
    expect: '越出 [60, 140]',
    mut: () => S.srcSubLine(`_posts/${descTarget().file}`, /^seo_description:[ \t].*$/m, `seo_description: ${'牙齿'.repeat(22)}串`, '摘要行'),
  },
  {
    name: 'M3 把某篇摘要写成它的 subtitle',
    group: '描述',
    expect: '与本篇 subtitle 逐字相同',
    mut: () => {
      const q = descTarget();
      S.srcSubLine(`_posts/${q.file}`, /^seo_description:[ \t].*$/m, `seo_description: ${String(q.fm.subtitle).trim()}`, '摘要行');
    },
  },
  {
    name: 'M4 在某篇摘要里塞一个正文没有的数字',
    group: '描述',
    expect: '在本篇正文里逐字找不到',
    mut: () => {
      const rel = `_posts/${descTarget().file}`;
      const line = lineOf(y(rel), /^seo_description:[ \t].*$/m, '摘要行');
      S.srcSubLine(rel, /^seo_description:[ \t].*$/m, `${line} ${DIGITS_M4}`, '摘要行');
    },
  },
  {
    name: 'M16 产物 meta 与源侧摘要不是同一个值',
    group: '描述',
    expect: '接线被动过',
    mut: () => S.sitePatch(descTarget().rel, /<meta name="description"\s+content="[^"]*"/, (m) => m.replace(/"$/, ' 牙齿"'), 'meta description'),
  },
  {
    name: 'M5 给一篇已有 chrome 的帖子再加一枚 Chrome',
    group: '词表',
    expect: '只在大小写上不同',
    mut: () => S.srcSubLine('_posts/2024-01-05-chrome-plugin-recommend.md', /^tags: chrome 浏览器插件 谷歌浏览器插件 超好用的chrome浏览器插件$/m, 'tags: chrome Chrome 浏览器插件 谷歌浏览器插件 超好用的chrome浏览器插件', 'tags 行'),
  },
  {
    name: 'M6 在一篇的 categories 里加一个白名单外的词',
    group: '词表',
    expect: '不在白名单里',
    mut: () => {
      const rel = `_posts/${T.catted.file}`;
      const line = lineOf(y(rel), /^categories:[ \t].*$/m, 'categories 行');
      // 方括号单值（`[随笔]`）在行尾追加会变成 `[随笔] 牙齿分类`——实测 Psych::SyntaxError，
      // 那篇整个掉出语料，② 看不到这枚词；所以按形状分两路，只在裸标量上往行尾追加。
      const to = /\[[^\]]*\]/.test(line) ? line.replace(/\]/, ', 牙齿分类]') : `${line} 牙齿分类`;
      S.srcSubLine(rel, /^categories:[ \t].*$/m, to, 'categories 行');
    },
  },
  {
    name: 'M7 把 categories: [A, B] 改成空格分隔',
    group: '词表',
    expect: '空格分隔的多值',
    mut: () => {
      const rel = `_posts/${
        first(
          POSTS.filter((q) => /^categories:[ \t]*\[[^\]]*,/.test(lineOf(y(`_posts/${q.file}`), /^categories:[ \t].*$/m, 'categories 行'))),
          '带方括号多值 categories 的靶子',
        ).file
      }`;
      const line = lineOf(y(rel), /^categories:[ \t]*\[.*\]$/m, 'categories 行');
      S.srcSubLine(
        rel,
        /^categories:[ \t]*\[.*\]$/m,
        line
          .replace(/^(\s*categories:[ \t]*)\[/, '$1')
          .replace(/\]/, '')
          .replace(/,\s*/g, ' '),
        'categories 行',
      );
    },
  },
  {
    name: 'M8 给一篇副本的 tags 行补一个 \\r',
    group: '词表',
    expect: '行尾',
    mut: () => {
      const rel = `_posts/${T.tagged.file}`;
      const line = lineOf(y(rel), /^tags:[ \t].*$/m, 'tags 行');
      S.srcSubLine(rel, /^tags:[ \t].*$/m, `${line}\r`, 'tags 行');
    },
  },
  {
    name: 'M10 把一篇 tags 里已有的一枚原样重写第二遍',
    group: '词表',
    expect: '出现两遍',
    mut: () => {
      const rel = `_posts/${T.tagged.file}`;
      const line = lineOf(y(rel), /^tags:[ \t].*$/m, 'tags 行');
      const one = line.replace(/^tags:[ \t]*/, '').split(/\s+/)[0];
      S.srcSubLine(rel, /^tags:[ \t].*$/m, `${line} ${one}`, 'tags 行');
    },
  },
  {
    name: 'M9 把一篇的 date 从 2026 改成 2100（推出语料）',
    group: '描述',
    expect: '多出来的是',
    mut: () => S.srcSubLine('_posts/2026-10-02-nextjs-rebind-ssrf-advisory-lag.md', /^date:[ \t]2026-10-02$/m, 'date: 2100-01-01', 'date 行'),
  },
  {
    name: 'M15 在一篇持有 git 标签的帖子里把 git 改成 Git',
    group: '词表',
    expect: '命中集与台账不一致',
    mut: () => S.srcSubLine('_posts/2023-12-24-git-revert-reset.md', /^tags: git reset revert 代码回退 代码回撤$/m, 'tags: Git reset revert 代码回退 代码回撤', 'tags 行'),
  },
  {
    name: 'M12 正文里的工具内链指向产物中不存在的一页',
    group: '内链',
    expect: '产物里没有 tools/nope.html',
    mut: () => {
      const q = first(
        POSTS.filter((r) => has(r.rel) && bodyToolLink(r.rel)),
        '正文里有工具内链的产物',
      );
      const href = bodyToolLink(q.rel)[1];
      siteEdit(q.rel, (s) => subInBody(s, href, href.replace(/\/tools\/[a-z0-9-]+\.html$/, '/tools/nope.html'), `M12 ${q.rel}`));
    },
  },
  {
    name: 'M11 删掉某篇静态目录的第一条 <li>',
    group: '目录',
    expect: '序列不一致',
    mut: () => S.siteCutRe(tocTarget().rel, /<li class="toc-static-item toc-h[23]"><a class="toc-static-link" href="#[^"]*">[^<]*<\/a><\/li>/),
  },
  {
    name: 'M13 摘掉整块静态目录（留一个空 div）',
    group: '目录',
    expect: '却没有 <nav class="toc-static"> 块',
    mut: () => S.sitePatch(tocTarget().rel, /<nav class="toc-static"[\s\S]*?<\/nav>/, () => '<div class="toc-static"></div>', '静态目录块'),
  },
  {
    name: 'M14 删掉 CSS 里收起 .toc-static 的那条规则',
    group: '目录',
    expect: '找不到 body.has-toc .toc-static',
    mut: () => S.siteCutRe('assets/css/index.min.css', /[^{}]*\.toc-static[^{}]*\{[^{}]*display:\s*none[^{}]*\}/),
  },
  {
    name: 'M17 摘掉静态块之前那段 has-js 内联脚本',
    group: '目录',
    expect: '没有那段给 <html> 挂 has-js 的内联脚本',
    mut: () => S.siteCutRe(tocTarget().rel, /<script>document\.documentElement\.className \+= ' has-js';<\/script>/),
  },
  {
    name: 'M18 把某篇 subtitle 写成不带引号的 plain scalar，尾巴带一个「 #9」',
    group: '描述',
    expect: '被静默截断',
    mut: () => S.srcSubLine(`_posts/${descTarget().file}`, /^subtitle:[ \t]+[^\r\n]*$/m, 'subtitle: 前端工程 #9 牙齿', '副标题行'),
  },

  // ── searchAction（SP3 E2）──
  {
    name: 'potentialAction 整块删掉（SearchAction 没了，门禁不该继续点头）',
    group: 'searchAction',
    expect: 'potentialAction 出现在 0 份文档',
    mut: () =>
      editJson(
        'index.html',
        '"@type": "WebSite"',
        (o) => {
          delete o.potentialAction;
        },
        'SearchAction 整块',
      ),
  },
  {
    name: 'urlTemplate 与本页 WebSite.url 不同口径（键名换成 ?query=）',
    group: 'searchAction',
    expect: 'urlTemplate 与本页 WebSite.url 不同口径',
    mut: () => S.siteSub('index.html', '?q={search_term_string}', '?query={search_term_string}', 'urlTemplate'),
  },
  {
    name: '占位符名字与 query-input 不一致（模板留 search_term_string，声明改成 term）',
    group: 'searchAction',
    expect: 'query-input=',
    mut: () => S.siteSub('index.html', 'required name=search_term_string', 'required name=term', 'query-input'),
  },
  {
    name: '首页那份带 potentialAction 的 WebSite 被复制到翻页视图',
    group: 'searchAction',
    expect: 'potentialAction 出现在 2 份文档',
    mut: () => S.siteAfter(T.page2, '</body>', ldBlocks(p('index.html'), '"@type": "WebSite"')[0][0], '翻页视图多出 SearchAction'),
  },
];

function editManifest(mutate, where) {
  siteEdit(
    'manifest.json',
    (s) => {
      const o = JSON.parse(s);
      const next = mutate(o) ?? o;
      return `${JSON.stringify(next, null, 2)}\n`;
    },
    where,
  );
}

// ── 跑 ────────────────────────────────────────────────────────────────────────

function runGate() {
  const r = spawnSync('node', [GATE, `--root=${SRCD}`, `--site=${SHADOW}`, '--stale-ok'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

const t0 = Date.now();
console.log(`副本就绪（源 ${SRCD}、产物 ${SHADOW}，抄录用时 ${COPY_NOTE}）`);
if (KEEP) console.log(`--keep：跑完不清理，目录 ${SCRATCH}`);

const ids = new Set();
for (const c of cases) {
  if (!c.name || !c.group || !c.expect || typeof c.mut !== 'function') throw new Error(`案例形状不完整：${JSON.stringify(c.name)}`);
  const id = `${c.group} ${c.name}`;
  if (ids.has(id)) throw new Error(`案例重名：${id}`);
  ids.add(id);
}

const selected = ONLY ? cases.filter((c) => `${c.group} ${c.name}`.includes(ONLY)) : cases;
if (ONLY) console.log(`--only=${ONLY}：${selected.length}/${cases.length} 条`);
if (!selected.length) {
  console.error(`✗ 没有案例含「${ONLY}」，先确认组名与条目名（--only 是子串匹配）`);
  process.exit(1);
}

const base = runGate();
console.log(`基线（未注入任何变异）：exit=${base.code}，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (base.code !== 0) {
  console.log(`✗ 基线不绿，先修门禁或换一份「源与产物成套」的快照再说牙齿：\n${base.out.split('\n').slice(0, 12).join('\n')}`);
  process.exit(1);
}

let pass = 0;
const problems = [];
const byGroup = new Map();
for (const c of selected) {
  byGroup.set(c.group, (byGroup.get(c.group) || 0) + 1);
  try {
    c.mut();
    const got = runGate();
    if (got.code === 2)
      problems.push(
        `✗ ${c.name}：门禁崩了（退出码 2，不是判定）：\n${got.out
          .split('\n')
          .filter((l) => l.startsWith('✗'))
          .slice(-2)
          .join('\n')}`,
      );
    else if (got.code === 0) problems.push(`✗ ${c.name}：注入后门禁仍是绿的（假牙）`);
    else if (!got.out.includes(`[${c.group}]`))
      problems.push(
        `✗ ${c.name}：红了但没红在「${c.group}」组：\n${got.out
          .split('\n')
          .filter((l) => l.startsWith('✗'))
          .slice(0, 3)
          .join('\n')}`,
      );
    else if (!got.out.includes(c.expect)) {
      problems.push(
        `✗ ${c.name}：红了，但没有一句含 ${JSON.stringify(c.expect)}：\n${got.out
          .split('\n')
          .filter((l) => l.includes(`[${c.group}]`))
          .slice(0, 4)
          .join('\n')}`,
      );
    } else {
      pass += 1;
      console.log(`✓ ${c.group} · ${c.name}`);
    }
  } catch (e) {
    problems.push(`✗ ${c.name}：变异脚本自己崩了 — ${e.message}`);
  } finally {
    restore();
  }
}

console.log(`\n分账：${[...byGroup].map(([k, v]) => `${k} ${v}`).join(' / ')}`);
console.log(`牙齿台账：${pass}/${selected.length} 组变异如期变红（用时 ${((Date.now() - t0) / 1000).toFixed(1)}s）`);
if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
const after = runGate();
console.log(after.code === 0 ? '✓ 全部变异已还原，复跑基线仍绿' : `✗ 还原后基线仍红，检查还原是否漏了文件：\n${after.out.split('\n').slice(0, 8).join('\n')}`);
process.exit(after.code === 0 ? 0 : 1);
