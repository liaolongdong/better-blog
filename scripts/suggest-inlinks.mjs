#!/usr/bin/env node
/**
 * 站内内链**建议清单**生成器：读 `_posts/`，算「哪两篇之间该有一条正文链接」，写成
 * `dev/inlink-suggestions.md` 给人逐条过目。
 *
 * 为什么需要这一份：2026-10 实测 `_posts/` 的 110 篇文章里，正文内的站内链接合计数十条、
 * 绝大多数文章是 0 条——读者从一篇正文内部没有任何路径跳到另一篇。合集导航、标签页、
 * ⌘K 搜索都是模板给的，不算正文内链；正文零内链同时压着两件事：爬虫的站内权重传递，
 * 和读者的下一步浏览时长。这件事靠写新稿解决不了（新稿照样不知道旧稿在哪），
 * 只能有一份「按相关性把候选配对」的清单，人在改稿或回看旧稿时顺手落一两条。
 *
 * 引文的可核验性（2026-10-20 记，别把它当成已验证的事）：
 *   报告里的「对方正文证据句」与「本篇插入点」是按句子清洗后截到 80 字的片段，
 *   截断处不一定带省略号。因此**不能**用「把引文原样去 _posts 里 grep」来验真伪——
 *   我这么试过，658 条里只有 62 条整段命中，而那个低命中率是清洗与截断口径不一致造成的，
 *   既不能证明引文是真的，也不能证明它是假的。
 *   要机械可验，得改成在引文旁边带上「文件名:行号」的出处锚（下一步做这个），
 *   在那之前，这份清单的用法是人读时顺手 grep 一个关键词回原文，而不是信任整句。
 *
 * 它刻意不做什么（这一节比上面那节重要）：
 *   1. **不改任何一篇文章**。脚本只读 `_posts/`，写 `dev/inlink-suggestions.md`，
 *      不产生 diff、不写回正文、不插 `<a>`。落地由人逐条决定。
 *      理由写在本仓自己的体检结论里（`dev/blog-growth-analysis-2026-09.md` 反面清单：
 *      「堆关键词会掉 10% 引用份额」）——机器按分数往正文里插链接，正是那条结论的机器版：
 *      分数只证明词面重合，证明不了那句话真的该被链过去。
 *   2. **不做闸门**。没有 `--strict`，不进 CI，不挂 `pnpm build`。它是一次性运营产出，
 *      阈值调歪了也只是清单长短，不该卡住部署。
 *   3. **不读不写 `_site/`**。本机有常驻 `jekyll serve` 在并发改它，它是移动靶；
 *      而且内链该不该加是源文件层面的编辑决策，跟产物无关。
 *   4. **不判语义**。打分只用三个可核对的信号（共享 tag / 同合集 / 标题关键词落在对方正文里），
 *      每个信号都能在被建议的那句话上验证；不做向量相似度，因为那种分数没法人工复核。
 *
 * 用法：
 *   node scripts/suggest-inlinks.mjs                # 生成/覆盖 dev/inlink-suggestions.md
 *   node scripts/suggest-inlinks.mjs --check        # 只跑通并断言产物非空，不写任何文件
 *   node scripts/suggest-inlinks.mjs --min=4.5      # 临时调阈值（默认见 MIN_SCORE）
 *   node scripts/suggest-inlinks.mjs --top=8        # 每篇最多几条（默认 MAX_PER_POST）
 *
 * 退出码：0 = 正常；1 = 跑通了但产出为空/语料读不到（不给「静默成功」）；2 = 用法或文件错误。
 *
 * @file scripts/suggest-inlinks.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFm, readBody, postPermalink, readSiteBase } from './lib/post-meta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------------ 配置 */

const OUT_REL = 'dev/inlink-suggestions.md';
const SERIES_REL = '_data/series.yml';

/** 每篇最多列几条建议——再多就是让人对着长清单挑，不如先看前 5 条。 */
const MAX_PER_POST = 5;
/** 低于这个分数不列。4.0 ≈「1 个标题关键词命中（2.0）+ 共享 tag 若干」或「同合集（3.0）+ 1 个关键词」。 */
const MIN_SCORE = 4.0;
/** 关键词在多少比例的文章正文里出现就算「太通用」，不作为锚点（实测「前端」「代码」这类词到处在）。 */
const GENERIC_DF_RATIO = 0.22;
/** 证据句最长多少字（超出截断并加省略号）。一屏要能读完，读不完的句子判不了要不要加链接。 */
const EVIDENCE_CHARS = 80;

const WEIGHTS = {
  tag: 1.5,
  tagMax: 3,
  series: 3.0,
  category: 1.0,
  titleKw: 2.0,
  titleKwMax: 3,
  extraKw: 1.0,
  bidirectional: 1.0,
};

/* ------------------------------------------------------------------ 词表 */

/** 中文虚词/功能字：关键词的任何一片里出现就整片丢掉（「我这台」「还在白」这类不是术语）。 */
const CN_STOP = new Set('的了是在我你他她它不也都很就还又已经过会能没无个只最较但并然而虽然因为所以如果则之其这那么怎呢啊吧吗被把给让对向从至等每让Making'.split(''));

/** 英文停用词与 URL 噪声（本站正文里的英文词绝大多数是专名，不需要宽的词表）。 */
const EN_STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'these', 'those', 'your', 'ours', 'their',
  'http', 'https', 'www', 'com', 'cn', 'org', 'net', 'io', 'dev', 'not', 'but', 'all', 'can',
  'will', 'was', 'were', 'are', 'have', 'has', 'had', 'into', 'onto', 'about', 'after', 'before',
  'when', 'where', 'which', 'while', 'than', 'then', 'them', 'they', 'there', 'here', 'what',
]);

/** 2–4 个汉字的窗口是本脚本对中文取词的全部办法：不做分词，因为没有可依赖的分词器，
 *  而「标题里的连续汉字串」本身就是最好的术语来源。 */
const CN_WINDOW = [2, 3, 4];

/* ------------------------------------------------------------------ 入参 */

const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const numFlag = (name, dflt) => {
  const a = argv.find((x) => x.startsWith(`--${name}=`));
  if (!a) return dflt;
  const v = Number(a.slice(name.length + 3));
  if (!Number.isFinite(v) || v <= 0) {
    process.stderr.write(`✗ suggest-inlinks：--${name}= 要的是正数，收到 ${a}\n`);
    process.exit(2);
  }
  return v;
};
const MIN_SCORE_R = numFlag('min', MIN_SCORE);
const MAX_PER_POST_R = numFlag('top', MAX_PER_POST);

const bad = (msg) => {
  process.stderr.write(`✗ suggest-inlinks：${msg}\n`);
  process.exit(1);
};

/* ------------------------------------------------------------------ 取词 */

/** 一段文本里的拉丁/技术 token（要求首字母是拉丁字母，纯数字与版本号不当关键词）。 */
function latinTokens(text) {
  const out = new Set();
  for (const m of text.matchAll(/[A-Za-z][A-Za-z0-9+_.@/-]*/g)) {
    const raw = m[0];
    if (/[./]/.test(raw) && !/^[A-Za-z]+(\.[A-Za-z]+)*$/.test(raw)) continue; // URL 片段、路径
    const t = raw.toLowerCase().replace(/^[_.-]+|[_.-]+$/g, '');
    if (t.length < 3 || t.length > 24) continue;
    if (EN_STOP.has(t) || /^\d+$/.test(t)) continue;
    if (/^(https?|www)$/.test(t)) continue;
    out.add(t);
  }
  return out;
}

/** 连续汉字串切成 2–4 字窗口，剔除含虚词的窗口。 */
function cjkWindows(text) {
  const out = new Set();
  for (const m of text.matchAll(/[\u4e00-\u9fff]{2,}/g)) {
    const run = m[0];
    for (const len of CN_WINDOW) {
      for (let i = 0; i + len <= run.length; i++) {
        const w = run.slice(i, i + len);
        if ([...w].some((ch) => CN_STOP.has(ch))) continue;
        out.add(w);
      }
    }
  }
  return out;
}

/** 一篇文章的候选关键词集：Map<词, {weight, source}>，标题 2 分、副标题/SEO 描述 1 分。 */
function keywordsOf(fm) {
  const map = new Map();
  const push = (set, weight, source) => {
    for (const w of set) {
      const cur = map.get(w);
      if (!cur || cur.weight < weight) map.set(w, { weight, source });
    }
  };
  push(new Set([...latinTokens(fm.title ?? ''), ...cjkWindows(fm.title ?? '')]), 2, 'title');
  push(new Set([...latinTokens(fm.subtitle ?? ''), ...cjkWindows(fm.subtitle ?? '')]), 1, 'subtitle');
  push(new Set([...latinTokens(fm.seo_description ?? ''), ...cjkWindows(fm.seo_description ?? '')]), 1, 'seo_description');
  return map;
}

/* ------------------------------------------------------------ 正文清洗 */

/** 去掉代码围栏：关键词证据只许来自人能读的句子，代码块里出现 `chrome` 不算话术重合。 */
const stripCode = (s) => s.replace(/^```[\s\S]*?^```/gm, (m) => '\n'.repeat(m.split('\n').length - 1));

/** 去掉图片与链接语法糖，留下链接文字；`[见这篇](/2026/…)` 的文字部分才是要展示的话。 */
const toPlainText = (s) =>
  s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^[\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/[*_`>#|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** 把正文切成「带小标题的节」，供证据句定位——标题层级原样保留，清单里要看得出是哪一节。 */
function splitSections(body) {
  const out = [];
  let cur = { level: 0, title: '（正文开头，无小标题）', lines: [] };
  for (const line of body.split('\n')) {
    const h = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (h) {
      if (cur.lines.length) out.push(cur);
      cur = { level: h[1].length, title: h[2].trim(), lines: [] };
    } else {
      cur.lines.push(line);
    }
  }
  out.push(cur);
  return out;
}

/** 切成中文句子：以 。！？；与换行为界，表格行不参与（表里的词不成句）。 */
function sentences(text) {
  return text
    .split('\n')
    .filter((l) => !/^\s*\|/.test(l))
    .join('\n')
    .split(/[。！？；;!?\n]+/)
    .map((s) => toPlainText(s))
    .filter((s) => s.length >= 6);
}

const clip = (s) => (s.length <= EVIDENCE_CHARS ? s : `${s.slice(0, EVIDENCE_CHARS - 1)}…`);

/* ------------------------------------------------------------ 语料读取 */

const postsDir = path.join(ROOT, '_posts');
if (!fs.existsSync(postsDir) || !fs.statSync(postsDir).isDirectory()) {
  process.stderr.write(`✗ suggest-inlinks：找不到 _posts 目录（${postsDir}）——语料读不到就没有清单，不是空清单。\n`);
  process.exit(1);
}
const mdFiles = fs.readdirSync(postsDir).filter((f) => f.endsWith('.md')).sort();
if (mdFiles.length === 0) bad(`_posts 里一个 .md 也没有（${postsDir}）`);

const site = readSiteBase(path.join(ROOT, '_config.yml'));

/** 合集归属：`_data/series.yml` 的 order 列表按文章 URL 反查 slug。 */
function readSeriesMembership() {
  const map = new Map();
  const file = path.join(ROOT, SERIES_REL);
  if (!fs.existsSync(file)) return map;
  let slug = null;
  let inOrder = false;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const s = /^\s*-\s*slug:\s*(.+?)\s*$/.exec(line);
    if (s) {
      slug = s[1].trim();
      inOrder = false;
      continue;
    }
    if (/^\s*order:\s*$/.test(line)) {
      inOrder = true;
      continue;
    }
    const u = /^\s*-\s*(\/\S+)\s*$/.exec(line);
    if (inOrder && u && slug) {
      if (!map.has(u[1])) map.set(u[1], new Set());
      map.get(u[1]).add(slug);
    }
  }
  return map;
}
const seriesOf = readSeriesMembership();

const asList = (v) => {
  if (!v) return [];
  const s = String(v).trim();
  if (s.startsWith('[')) return s.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  return s.split(/\s+/).filter(Boolean);
};

const posts = [];
const skipped = [];
for (const f of mdFiles) {
  const file = path.join(postsDir, f);
  const fm = parseFm(file);
  if (!fm.title) {
    skipped.push({ file: `_posts/${f}`, why: 'front matter 没有 title（不参与统计，也不接受建议）' });
    continue;
  }
  const perm = postPermalink({ file, fm, site: { origin: '', baseurl: '' } });
  if (!perm.path) {
    skipped.push({ file: `_posts/${f}`, why: `date 不是 YYYY-MM-DD（实际 ${JSON.stringify(fm.date)}），URL 拼不出来` });
    continue;
  }
  // Jekyll 的 future: false 会把 date 在未来的文章整篇丢掉，线上根本不存在这一页，
  // 给它配内链建议没有意义（仓库里那枚 2100-10-25-practice-demo.md 就是这种）。
  const iso = new Date().toISOString().slice(0, 10);
  if (perm.date > iso) {
    skipped.push({ file: `_posts/${f}`, why: `date ${perm.date} 晚于今天 ${iso}，Jekyll future:false 不发布` });
    continue;
  }
  const body = readBody(file);
  const prose = stripCode(body);
  const sections = splitSections(prose);
  const plain = sections.map((s) => ({ ...s, sentences: sentences(s.lines.join('\n')) }));
  const textForMatch = plain.map((s) => s.sentences.join(' \u0001 ')).join(' ');
  posts.push({
    file,
    relFile: `_posts/${f}`,
    fm,
    title: String(fm.title).trim(),
    urlPath: perm.path,
    date: perm.date,
    tags: new Set(asList(fm.tags).map((t) => t.toLowerCase())),
    tagList: asList(fm.tags),
    cats: new Set(asList(fm.categories).map((t) => t.toLowerCase())),
    catList: asList(fm.categories),
    series: seriesOf.get(perm.path) ?? new Set(),
    keywords: keywordsOf(fm),
    bodyNgrams: new Set([...latinTokens(textForMatch), ...cjkWindows(textForMatch)]),
    bodyRaw: textForMatch,
    sections: plain,
    inlinks: internalLinkTargets(body),
  });
}
if (posts.length === 0) bad(`_posts 里 ${mdFiles.length} 个文件全被剔除了，一条语料都没剩下`);

/* ------------------------------------------------------- 现有正文内链 */

/**
 * 正文里的站内链接：markdown 链接 / HTML a，目标解析回本站才算。
 * 口径写死在报告开头，避免和别的体检数字对不上：
 *   - 图片 `![…](/assets/…)` 不算；
 *   - GitHub 仓库、站外域名、以及 `liaolongdong.github.io/<别的项目>` 这类非本博客 baseurl 的地址不算；
 *   - `/better-blog/…`、本站 url + 任意路径、以及根相对的非资源路径都算。
 */
function internalLinkTargets(body) {
  const out = new Set();
  const origin = site.origin || 'https://example.invalid';
  const base = site.baseurl || '';
  const targets = [];
  for (const m of body.matchAll(/(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
    if (m[1] === '!') continue; // 图片
    targets.push(m[3]);
  }
  for (const m of body.matchAll(/<a\s+[^>]*href=["']([^"']+)["']/gi)) targets.push(m[1]);
  for (const raw of targets) {
    const t = raw.trim();
    if (!t || t.startsWith('#') || t.startsWith('mailto:')) continue;
    if (/^\/assets\//.test(t) || /^\/(vendor|demo|ace)\//.test(t)) continue;
    let inSite = false;
    if (t.startsWith(`${origin}${base}/`) || t === `${origin}${base}`) inSite = true;
    else if (base && t.startsWith(`${base}/`)) inSite = true;
    else if (/^https?:\/\//.test(t)) {
      // 绝对地址但没带本站 baseurl：GitHub Pages 的项目页与旧域名都不算站内
      inSite = false;
    } else if (t.startsWith('/')) inSite = true;
    if (inSite) out.add(t);
  }
  return out;
}

/** 候选文章已被本篇链接到？按 URL 尾部比对（同一篇可能写成绝对地址或根相对路径）。 */
function alreadyLinked(from, to) {
  const tail = to.urlPath; // /2026-09-10/x.html
  for (const t of from.inlinks) {
    if (t === tail || t.endsWith(tail) || t.includes(`/${to.urlPath.split('/').pop()}`)) return true;
  }
  return false;
}

/* --------------------------------------------------------- 通用词过滤 */

/** 每个候选关键词出现在多少篇正文里；比例过高的当「太通用」，不能当锚点。 */
const df = new Map();
for (const p of posts) {
  for (const kw of p.keywords.keys()) df.set(kw, (df.get(kw) ?? 0) + 1);
}
const GENERIC_DF = Math.max(2, Math.floor(posts.length * GENERIC_DF_RATIO));
const specificEnough = (kw) => (df.get(kw) ?? 0) <= GENERIC_DF;

/* ------------------------------------------------------------ 打分配对 */

/**
 * 词元命中。**拉丁词元必须按词边界匹配**，中文按子串匹配。
 * 2026-10-20 第一版这里用裸 `includes`，于是标题里的 "Star"（36K Star 的仓库）
 * 命中了对方正文里的 "next start"，两个八竿子打不着的文章拿到 16.5 分并列第一。
 * 中文不需要词边界（没有空格分词），但 2 字窗口太通用，另有一条判据挡着。
 */
function termIn(text, kw) {
  if (!text || !kw) return false;
  if (/^[a-z0-9][a-z0-9._+-]*$/i.test(kw)) {
    const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(^|[^a-z0-9])' + esc + '([^a-z0-9]|$)', 'i').test(text);
  }
  return text.includes(kw);
}

function hitsIn(kwMap, p) {
  // 该篇正文里命中的关键词（按权重降序，取前几条）
  const hit = [];
  for (const [kw, meta] of kwMap) {
    if (!meta) continue;
    // 2 字中文窗口不进「标题关键词」这一路：用户 / 版本 / 自己 / 跑一 这类噪声全靠它进来
    if (meta.weight === 2 && /^[\u4e00-\u9fa5]{2}$/.test(kw)) continue;
    if (p.bodyNgrams.has(kw) || (meta.weight === 2 && termIn(p.bodyRaw, kw))) hit.push(kw);
  }
  return hit;
}

function findSentence(p, kw) {
  for (const s of p.sections) {
    for (const sent of s.sentences) {
      if (termIn(sent, kw)) {
        return { heading: s.level > 0 ? s.title : '（无小标题，位于开头）', level: s.level, sentence: clip(sent) };
      }
    }
  }
  return null;
}

const suggestions = new Map(); // post -> [{to, score, parts, kws, candEvidence, selfAnchor}]
for (const a of posts) {
  const aKw = new Map([...a.keywords].filter(([, m]) => m.weight === 2).map(([k]) => [k, a.keywords.get(k)]));
  const aExtra = new Map([...a.keywords].filter(([, m]) => m.weight === 1));
  const cands = [];
  for (const b of posts) {
    if (a === b) continue;
    if (alreadyLinked(a, b)) continue; // 已经链上了，不必再建议

    const titleHit = hitsIn(aKw, b).filter(specificEnough);
    const extraHit = hitsIn(aExtra, b).filter(specificEnough);
    if (titleHit.length === 0) continue; // 没有关键词锚点 = 给不出可核对的证据句，不进清单

    const sharedTags = [...a.tags].filter((t) => b.tags.has(t));
    const sameSeries = [...a.series].some((s) => b.series.has(s));
    const sameCat = [...a.cats].some((c) => b.cats.has(c));
    const reverseHit = hitsIn(b.keywords, a).filter(specificEnough);

    let score = 0;
    const parts = [];
    if (sharedTags.length) {
      const n = Math.min(sharedTags.length, WEIGHTS.tagMax);
      score += WEIGHTS.tag * n;
      parts.push(`共享 tag ${n}(${sharedTags.slice(0, n).join('、')})`);
    }
    if (sameSeries) {
      score += WEIGHTS.series;
      parts.push(`同合集 ${[...a.series].filter((s) => b.series.has(s)).join('、')}`);
    }
    if (sameCat) {
      score += WEIGHTS.category;
      parts.push(`同分类 ${[...a.cats].filter((c) => b.cats.has(c)).join('、')}`);
    }
    const useTitle = titleHit.slice(0, WEIGHTS.titleKwMax);
    score += WEIGHTS.titleKw * useTitle.length;
    parts.push(`标题关键词 ${useTitle.length}(${useTitle.join('、')})`);
    if (extraHit.length) {
      score += WEIGHTS.extraKw;
      parts.push(`副标题/描述关键词 ${extraHit.slice(0, 2).join('、')}`);
    }
    if (reverseHit.length) {
      score += WEIGHTS.bidirectional;
      parts.push('反向也命中（本方正文里也出现对方标题关键词）');
    }
    if (score < MIN_SCORE_R) continue;

    // 证据句优先用最「不像巧合」的那个词（语料里出现篇数最少的）
    const anchorKw = [...useTitle].sort((x, y) => (df.get(x) ?? 0) - (df.get(y) ?? 0))[0];
    const candEvidence = findSentence(b, anchorKw) ?? findSentence(b, useTitle[0]);
    if (!candEvidence) continue;
    const selfAnchor = findSentence(a, anchorKw) ?? (reverseHit.length ? findSentence(a, reverseHit[0]) : null);

    cands.push({
      to: b,
      score: Math.round(score * 10) / 10,
      parts,
      anchorKw,
      kws: [...new Set([anchorKw, ...useTitle])],
      candEvidence,
      selfAnchor,
      reverseKw: reverseHit[0] ?? null,
    });
  }
  cands.sort((x, y) => y.score - x.score || x.to.date.localeCompare(y.to.date));
  suggestions.set(a, cands.slice(0, MAX_PER_POST_R));
}

/* ---------------------------------------------------------------- 渲染 */

const totalInlinks = posts.reduce((n, p) => n + p.inlinks.size, 0);
const zeroInlinkPosts = posts.filter((p) => p.inlinks.size === 0).length;
const withSug = posts.filter((p) => (suggestions.get(p) ?? []).length > 0);
const noSug = posts.filter((p) => (suggestions.get(p) ?? []).length === 0);
const totalSug = withSug.reduce((n, p) => n + suggestions.get(p).length, 0);

const md = [];
md.push('# 站内内链建议清单（机器生成，落地由人逐条决定）');
md.push('');
md.push(`> 由 \`scripts/suggest-inlinks.mjs\` 于 ${new Date().toISOString().slice(0, 10)} 生成。**脚本不改动任何一篇文章**，也不产生可 apply 的 diff：`);
md.push('> 本仓 2026-09 体检的反面清单写着「堆关键词会掉 10% 引用份额」，而按分数自动往正文插链正是它的机器版，所以这里只出清单。');
md.push('> 重跑覆盖本文件；`dev/` 已被 `_config.yml` 的 exclude 排除出构建，且本文件在 `.gitignore` 里（公开仓库不留机器生成的运营清单）。');
md.push('');
md.push('## 统计口径');
md.push('');
md.push(`- 语料：\`_posts/\` 共 ${mdFiles.length} 个 \`.md\`，剔除 ${skipped.length} 个后统计 **${posts.length} 篇**${skipped.length ? `（剔的哪些见文末「被剔除的文件」）` : ''}。`);
md.push(`- 现有正文内链：**${totalInlinks} 条**，分布在 ${posts.length - zeroInlinkPosts} 篇；**零内链 ${zeroInlinkPosts} 篇**（占 ${((zeroInlinkPosts / posts.length) * 100).toFixed(0)}%）。`);
md.push(`- 建议：**${totalSug} 条**，覆盖 ${withSug.length} 篇；平均每篇 **${(totalSug / posts.length).toFixed(2)} 条**（按有建议的算 ${(totalSug / Math.max(1, withSug.length)).toFixed(2)} 条）；每篇最多 ${MAX_PER_POST_R} 条。`);
md.push(`- 无任何候选的文章：**${noSug.length} 篇**，单列在文末——「哪些文章彼此完全不互联」本身就是结论。`);
md.push(`- 阈值：分数 ≥ ${MIN_SCORE_R} 才列，且**必须有至少一个标题关键词命中对方正文**（关键词给不出证据句就不进清单）。分数分布见下。`);
md.push('');
md.push('**「现有正文内链」的口径**（与别的体检数字对不上时，先对这里）：正文里的 markdown 链接与 `<a href>`，目标解析回本站（本站 `url` + `baseurl`、或根相对的非 `/assets` 路径）才算。图片、`#锚点`、`mailto:`、站外域名都不算；`liaolongdong.github.io/<别的项目>` 这类 GitHub Pages 项目页也不属于本博客，同样不算。合集导航、相关文章、页脚是模板渲染的，不在正文里，所以不计。');
md.push('');
md.push('**打分构成**（每一项都在建议行里原样列出，可逐条核对）：');
md.push('');
md.push('| 信号 | 分值 |');
md.push('| --- | --- |');
md.push(`| 共享 tag | ${WEIGHTS.tag} × 个数（最多 ${WEIGHTS.tagMax} 个） |`);
md.push(`| 同合集（\`${SERIES_REL}\`） | ${WEIGHTS.series} |`);
md.push(`| 同分类 | ${WEIGHTS.category} |`);
md.push(`| 本篇**标题**关键词出现在对方正文 | ${WEIGHTS.titleKw} × 个数（最多 ${WEIGHTS.titleKwMax} 个） |`);
md.push(`| 副标题 / seo_description 关键词出现在对方正文 | ${WEIGHTS.extraKw} |`);
md.push(`| 反向也命中（对方标题关键词出现在本篇正文） | ${WEIGHTS.bidirectional} |`);
md.push('');
md.push(`关键词取自 front matter 的 title / subtitle / seo_description，取词办法是拉丁 token 加连续汉字的 2–4 字窗口（不做分词）；在 ${GENERIC_DF} 篇以上正文里出现过的词判为太通用，不作锚点（「前端」「代码」这类）。证据句只从代码围栏之外的人话句子找，链接语法与 Markdown 标记会被剥掉。`);
md.push('');

{
  const all = [...suggestions.values()].flat();
  const buckets = new Map();
  for (const s of all) {
    const k = Math.floor(s.score);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  md.push('**分数分布**（共 ' + all.length + ' 条）：' + [...buckets.entries()].sort((x, y) => y[0] - x[0]).map(([k, n]) => `${k}+ 分 ${n} 条`).join(' ｜ ') || '（无）');
  md.push('');
}

md.push('---');
md.push('');
md.push('## 逐篇建议（按最高分排序）');
md.push('');
md.push('每条给两句原文：**对方句**证明这两篇真的在同一件事上说话（决定要不要连），**本篇插入点**是链接该落在的位置（决定改哪一句）。两句都对不上就整条作废，不必勉强。');
md.push('');

const ordered = [...withSug].sort((x, y) => {
  const a = (suggestions.get(x) ?? [])[0]?.score ?? 0;
  const b = (suggestions.get(y) ?? [])[0]?.score ?? 0;
  return b - a || y.date.localeCompare(x.date);
});

for (const p of ordered) {
  const list = suggestions.get(p) ?? [];
  md.push(`### ${p.title}`);
  md.push('');
  md.push(`\`${p.relFile}\` ｜ ${p.date} ｜ 分类 ${p.catList.join('/') || '—'} ｜ tag ${p.tagList.join(' ') || '—'}${p.series.size ? ` ｜ 合集 ${[...p.series].join('、')}` : ''} ｜ 现有内链 ${p.inlinks.size} 条`);
  md.push('');
  for (const s of list) {
    md.push(`- **→ ${s.to.title}** ｜ ${s.score} 分 ｜ \`${s.to.relFile}\``);
    md.push(`  - 依据：${s.parts.join(' ｜ ')}`);
    md.push(`  - 对方正文证据句（**${s.candEvidence.heading}** · 锚点词 \`${s.anchorKw}\`）：「${s.candEvidence.sentence}」`);
    if (s.selfAnchor) {
      md.push(`  - 本篇插入点（**${s.selfAnchor.heading}**）：「${s.selfAnchor.sentence}」`);
    } else {
      md.push('  - 本篇插入点：本篇没有含该锚点词的句子——要连就得自己找位置（这正说明这条可能不该连）。');
    }
    md.push(`  - 候选文章地址：\`${s.to.urlPath}\``);
  }
  md.push('');
}

md.push('---');
md.push('');
md.push(`## 无任何候选的文章（${noSug.length} 篇）`);
md.push('');
if (noSug.length === 0) {
  md.push('（无——每篇都至少拿到一条建议。）');
} else {
  md.push('这些文章在阈值内配不出任何一条内链。原因通常是两类，值得分开看：');
  md.push('');
  md.push('- 标题里的词在全站只它自己用（选题确实孤立）；');
  md.push('- 标题是中文而相关旧稿用英文术语写的（取词口径没跨过去，属于清单的漏，不是内容的孤立）。');
  md.push('');
  for (const p of noSug) {
    md.push(`- **${p.title}** — \`${p.relFile}\` ｜ 现有内链 ${p.inlinks.size} 条 ｜ tag ${p.tagList.join(' ') || '—'}`);
  }
}
md.push('');

if (skipped.length) {
  md.push('---');
  md.push('');
  md.push(`## 被剔除的文件（${skipped.length} 个，不参与统计）`);
  md.push('');
  for (const s of skipped) md.push(`- \`${s.file}\` — ${s.why}`);
  md.push('');
}

md.push('---');
md.push('');
md.push('## 这份清单刻意不做的三件事');
md.push('');
md.push('1. **不写正文**：脚本对 `_posts/` 只读，不改文件、不插 `<a>`、不产出可 apply 的 diff。');
md.push('2. **不判语义**：分数只证明词面重合。一句「顺带提到 chrome」被计分，与「整段在讲 chrome」在分数上没区别——所以每条都附原文，判断归人。');
md.push('3. **不进闸门**：`--check` 只断言「脚本能跑通且清单非空」，不校验内容质量，也不挂 CI。阈值调歪的后果是清单变长变短，不该卡住部署。');
md.push('');

const report = md.join('\n');

/* ------------------------------------------------------------------ 输出 */

if (CHECK) {
  const lines = report.split('\n').length;
  if (!report.includes('## 统计口径') || lines < 40) bad(`--check：产物自检没过（渲染出的清单只有 ${lines} 行 / ${report.length} 字节），不认为跑通`);
  if (totalSug === 0) bad('--check：脚本跑通了但一条建议也没配出来——阈值或取词口径坏了，空清单不算成功');
  process.stdout.write(
    `✓ suggest-inlinks --check：语料 ${posts.length} 篇（剔 ${skipped.length}）｜ 现有内链 ${totalInlinks} 条，零内链 ${zeroInlinkPosts} 篇 ｜ 建议 ${totalSug} 条覆盖 ${withSug.length} 篇（平均 ${(totalSug / posts.length).toFixed(2)} 条/篇）｜ 无候选 ${noSug.length} 篇 ｜ 渲染 ${lines} 行，未写文件（--check 不落盘）\n`,
  );
  process.exit(0);
}

const out = path.join(ROOT, OUT_REL);
try {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, report, 'utf8');
} catch (e) {
  process.stderr.write(`✗ suggest-inlinks：写 ${OUT_REL} 失败了：${e && e.message ? e.message : e}\n`);
  process.exit(1);
}
if (!fs.existsSync(out) || fs.statSync(out).size < 400) bad(`写了 ${OUT_REL} 但内容小得可疑（${fs.statSync(out).size} 字节）`);

process.stdout.write(
  `✓ suggest-inlinks：语料 ${posts.length} 篇（剔 ${skipped.length}）｜ 现有内链 ${totalInlinks} 条 / 零内链 ${zeroInlinkPosts} 篇 ｜ 建议 ${totalSug} 条覆盖 ${withSug.length} 篇（平均 ${(totalSug / posts.length).toFixed(2)} 条/篇）｜ 无候选 ${noSug.length} 篇 ｜ 阈值 ≥${MIN_SCORE_R}、每篇 ≤${MAX_PER_POST_R} 条\n` +
    `  → ${OUT_REL}（${fs.statSync(out).size} 字节）；正文一个字没改。\n`,
);
