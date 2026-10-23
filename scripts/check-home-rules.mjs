#!/usr/bin/env node
// 首页展示规则验证器：热门话题、编辑精选、预留热榜。
// 退出码：0 全绿 / 1 有规则见红 / 2 输入缺失或无法解析（拒数，不假装通过）。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DAY_MS = 86400000;
const HOT_TAG_LIMIT = 6;
const SIDEBAR_TAG_LIMIT = 12;
const HOT_TAG_MIN_POSTS = 2;
const HOT_TAG_MAX_AGE_DAYS = 540;
const PICKS_LIMIT = 5;
const PICKS_MAX_PER_CATEGORY = 2;
const PICKS_MIN_CATEGORIES = 3;
const PICKS_FRESH_DAYS = 90;
const PICKS_EVERGREEN_DAYS = 365;
const PICKS_REVIEW_DAYS = 180;
const PICKS_MAX_FEED_OVERLAP = 1;
const PICKS_WHY_MIN = 20;
const PICKS_WHY_MAX = 60;
const POPULAR_MAX_AGE_DAYS = 8;

class CannotEvaluate extends Error {}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(arg('root', repoRoot));
const siteDir = path.resolve(arg('site', path.join(root, '_site')));

function shanghaiToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function parseDay(value) {
  const m = String(value ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  const ms = Date.UTC(y, mo - 1, d);
  return { y, m: mo, d, ms };
}

const today = parseDay(arg('today', shanghaiToday()));
if (!today) throw new CannotEvaluate(`--today 不是合法日期：${arg('today', '')}`);

const daysAgo = (day) => Math.floor((today.ms - day.ms) / DAY_MS);
const pad = (n) => String(n).padStart(2, '0');

function stripQuotes(value) {
  const s = String(value ?? '').trim();
  if (s.length >= 2 && ((s[0] === "'" && s.at(-1) === "'") || (s[0] === '"' && s.at(-1) === '"'))) {
    return s.slice(1, -1);
  }
  return s;
}

function decodeEntities(value) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");
}

function postPathFromHref(href) {
  const m = String(href).match(/(\d{4}\/\d{2}\/\d{2}\/[^/]+\.html)$/);
  return m ? `/${m[1]}` : null;
}

function readFrontMatter(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  if (lines[0]?.replace(/^\uFEFF/, '').trim() !== '---') return null;
  const fm = {};
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') break;
    const m = lines[i].match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (m) fm[m[1]] = m[2];
  }
  return fm;
}

function parseCategories(raw) {
  const value = stripQuotes(raw);
  if (!value) return [];
  const inner = value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value;
  const parts = value.startsWith('[') ? inner.split(',') : inner.split(/\s+/);
  return parts.map((s) => stripQuotes(s.trim())).filter(Boolean);
}

function readPosts() {
  const dir = path.join(root, '_posts');
  if (!fs.existsSync(dir)) throw new CannotEvaluate(`缺少 _posts 目录：${dir}`);
  const posts = [];
  for (const file of fs.readdirSync(dir).filter((f) => /\.(md|markdown)$/i.test(f)).sort()) {
    const fm = readFrontMatter(path.join(dir, file));
    if (!fm) throw new CannotEvaluate(`无法读取 front matter：${file}`);
    const date = parseDay(stripQuotes(fm.date));
    if (!date) throw new CannotEvaluate(`无法解析 date：${file} → ${fm.date ?? '(空)'}`);
    if (date.ms > today.ms) continue;
    const slug = file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.(md|markdown)$/i, '');
    posts.push({
      file,
      title: stripQuotes(fm.title),
      date,
      tags: [...new Set(stripQuotes(fm.tags).split(/\s+/).filter(Boolean))],
      categories: parseCategories(fm.categories),
      url: `/${date.y}/${pad(date.m)}/${pad(date.d)}/${slug}.html`,
    });
  }
  if (!posts.length) throw new CannotEvaluate('_posts 里没有任何已发布文章');
  return posts;
}

function readHtml() {
  const file = path.join(siteDir, 'index.html');
  if (!fs.existsSync(file)) {
    throw new CannotEvaluate(`找不到首页产物：${file}（先构建，或用 --site 指向冻结快照）`);
  }
  return fs.readFileSync(file, 'utf8');
}

function compareTags(a, b) {
  if (a.all !== b.all) return b.all - a.all;
  if (a.newest.ms !== b.newest.ms) return b.newest.ms - a.newest.ms;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

function tagStats(posts) {
  const map = new Map();
  for (const post of posts) {
    for (const name of post.tags) {
      const row = map.get(name) ?? { name, all: 0, newest: post.date };
      row.all += 1;
      if (post.date.ms > row.newest.ms) row.newest = post.date;
      map.set(name, row);
    }
  }
  return [...map.values()];
}

function eligibleTopics(all) {
  const eligible = all.filter((t) => t.all >= HOT_TAG_MIN_POSTS
    && daysAgo(t.newest) <= HOT_TAG_MAX_AGE_DAYS).sort(compareTags);
  const rest = all.filter((t) => !eligible.includes(t)).sort(compareTags);
  return { eligible, filled: [...eligible, ...rest] };
}

function readFeedUrls(html, count = 3) {
  const articles = [...html.matchAll(/<article class="article-item">([\s\S]*?)<\/article>/g)];
  if (articles.length < count) throw new CannotEvaluate(`首页信息流不足 ${count} 篇，无法核对重叠`);
  return articles.slice(0, count).map((m) => {
    const href = m[1].match(/<a class="post-link" href="([^"]+)"/);
    if (!href) throw new CannotEvaluate('首页文章卡里找不到 post-link');
    return postPathFromHref(decodeEntities(href[1]));
  }).filter(Boolean);
}

function readRenderedTopics(html) {
  return [...html.matchAll(/<a class="feed-topic"[^>]*>([^<]+)<em>(\d+)<\/em><\/a>/g)]
    .map((m) => ({ name: decodeEntities(m[1].trim()), count: Number(m[2]) }));
}

function readRenderedSidebarTags(html) {
  const section = html.match(/<section class="tags-card">([\s\S]*?)<\/section>/);
  if (!section) return null;
  return [...section[1].matchAll(/<a[^>]*class="tag"[^>]*>([^<]+)<\/a>/g)]
    .map((m) => decodeEntities(m[1].trim()));
}

function parsePicks(file) {
  if (!fs.existsSync(file)) throw new CannotEvaluate(`缺少 ${file}`);
  const items = [];
  let current = null;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const start = line.match(/^\s*-\s+([A-Za-z_][\w-]*):\s*(.*)$/);
    if (start) {
      current = { [start[1]]: stripQuotes(start[2]) };
      items.push(current);
      continue;
    }
    const kv = line.match(/^\s+([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv && current) {
      current[kv[1]] = stripQuotes(kv[2]);
      continue;
    }
    throw new CannotEvaluate(`picks.yml 结构无法识别：${JSON.stringify(raw)}`);
  }
  return items;
}

function parsePopular(file) {
  if (!fs.existsSync(file)) return null;
  const doc = { items: [] };
  let current = null;
  let inItems = false;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (/^items:\s*$/.test(line)) { inItems = true; current = null; continue; }
    const itemStart = line.match(/^\s*-\s+url:\s*(.*)$/);
    if (inItems && itemStart) {
      current = { url: stripQuotes(itemStart[1]) };
      doc.items.push(current);
      continue;
    }
    const kv = line.match(/^\s*([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv && current) { current[kv[1]] = stripQuotes(kv[2]); continue; }
    if (kv && !inItems) { doc[kv[1]] = stripQuotes(kv[2]); continue; }
    throw new CannotEvaluate(`popular.yml 结构无法识别：${JSON.stringify(raw)}`);
  }
  return doc;
}

const results = [];
const record = (status, label, detail = '') => results.push({ status, label, detail });
const pass = (label, detail) => record('pass', label, detail);
const fail = (label, detail) => record('fail', label, detail);
const skip = (label, detail) => record('skip', label, detail);

function checkHotTopics(all, html) {
  const { eligible, filled } = eligibleTopics(all);
  if (eligible.length >= HOT_TAG_LIMIT) {
    pass('热门话题准入', `${eligible.length} 个标签满足 ≥${HOT_TAG_MIN_POSTS} 篇且最近发文 ≤${HOT_TAG_MAX_AGE_DAYS} 天`);
  } else {
    record('warn', '热门话题准入', `只有 ${eligible.length} 个标签满足准入，首页回填 ${HOT_TAG_LIMIT - eligible.length} 个`);
  }

  const expected = filled.slice(0, HOT_TAG_LIMIT);
  const rendered = readRenderedTopics(html);
  const same = rendered.length === expected.length
    && rendered.every((r, i) => r.name === expected[i].name && r.count === expected[i].all);
  const detail = same
    ? expected.map((t) => `${t.name}(${t.all})`).join(' · ')
    : `期望 ${expected.map((t) => `${t.name}(${t.all})`).join(' · ')}；实际 ${rendered.map((t) => `${t.name}(${t.count})`).join(' · ')}`;
  same ? pass('热门话题：首页 6 个与顺序', detail) : fail('热门话题：首页 6 个与顺序', detail);

  const sidebarExpected = filled.slice(0, SIDEBAR_TAG_LIMIT).map((t) => t.name);
  const sidebarRendered = readRenderedSidebarTags(html);
  if (!sidebarRendered) {
    skip('热门话题：右栏标签顺序', '页面没有 tags-card（recommend-tags 关闭或结构变更）');
  } else {
    const sidebarSame = sidebarRendered.length === sidebarExpected.length
      && sidebarRendered.every((name, i) => name === sidebarExpected[i]);
    sidebarSame
      ? pass('热门话题：右栏标签顺序', `${sidebarRendered.length} 个`)
      : fail('热门话题：右栏标签顺序', `期望 ${sidebarExpected.join(' · ')}；实际 ${sidebarRendered.join(' · ')}`);
  }
}

function checkPicks(posts, html) {
  const items = parsePicks(path.join(root, '_data', 'picks.yml'));
  const byUrl = new Map(posts.map((p) => [p.url, p]));
  const resolved = items.map((item) => ({ item, post: byUrl.get(item.url) }));

  if (items.length !== PICKS_LIMIT) {
    fail('编辑精选：数量', `期望 ${PICKS_LIMIT} 条，实际 ${items.length} 条`);
  } else {
    pass('编辑精选：数量', `${items.length} 条`);
  }

  const badUrls = resolved.filter((r) => !r.post).map((r) => r.item.url);
  const dupUrls = items.map((i) => i.url).filter((u, i, arr) => arr.indexOf(u) !== i);
  if (badUrls.length || dupUrls.length) {
    fail('编辑精选：URL 可解析且唯一', `对不上文章：${badUrls.join(' · ') || '无'}；重复：${dupUrls.join(' · ') || '无'}`);
  } else {
    pass('编辑精选：URL 可解析且唯一', `${items.length} 条都对得上`);
  }

  const valid = resolved.filter((r) => r.post);
  const byCategory = new Map();
  for (const { post } of valid) {
    const cat = post.categories[0] ?? '(无分类)';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
  }
  const over = [...byCategory.entries()].filter(([, n]) => n > PICKS_MAX_PER_CATEGORY);
  const categoryDetail = [...byCategory.entries()].map(([c, n]) => `${c}×${n}`).join(' · ');
  if (over.length) {
    fail('编辑精选：分类多样性', `${categoryDetail}（单类上限 ${PICKS_MAX_PER_CATEGORY}）`);
  } else if (byCategory.size < PICKS_MIN_CATEGORIES) {
    fail('编辑精选：分类多样性', `${categoryDetail}（至少 ${PICKS_MIN_CATEGORIES} 个分类）`);
  } else {
    pass('编辑精选：分类多样性', categoryDetail);
  }

  const ages = valid.map(({ post }) => daysAgo(post.date));
  const freshest = Math.min(...ages);
  const oldest = Math.max(...ages);
  const freshOk = freshest <= PICKS_FRESH_DAYS;
  const evergreenOk = oldest >= PICKS_EVERGREEN_DAYS;
  const freshDetail = `最新 ${freshest} 天前（需 ≤${PICKS_FRESH_DAYS}），最老 ${oldest} 天前（需 ≥${PICKS_EVERGREEN_DAYS}）`;
  freshOk && evergreenOk ? pass('编辑精选：新鲜度与长尾', freshDetail) : fail('编辑精选：新鲜度与长尾', freshDetail);

  const feedUrls = readFeedUrls(html);
  const overlap = valid.map((r) => r.post.url).filter((u) => feedUrls.includes(u));
  overlap.length <= PICKS_MAX_FEED_OVERLAP
    ? pass('编辑精选：与信息流前 3 不重复', `重叠 ${overlap.length} 条（上限 ${PICKS_MAX_FEED_OVERLAP}）`)
    : fail('编辑精选：与信息流前 3 不重复', `重叠 ${overlap.length} 条：${overlap.join(' · ')}`);

  const badWhy = valid.filter(({ item }) => {
    const n = [...stripQuotes(item.why ?? '')].length;
    return n < PICKS_WHY_MIN || n > PICKS_WHY_MAX;
  }).map(({ item }) => `${item.url}（${[...stripQuotes(item.why ?? '')].length} 字）`);
  badWhy.length
    ? fail('编辑精选：推荐语长度', `${badWhy.join(' · ')}（需 ${PICKS_WHY_MIN}–${PICKS_WHY_MAX} 字）`)
    : pass('编辑精选：推荐语长度', `全部在 ${PICKS_WHY_MIN}–${PICKS_WHY_MAX} 字`);

  const reviewProblems = [];
  for (const { item } of valid) {
    const reviewed = parseDay(item.reviewed);
    if (!reviewed) reviewProblems.push(`${item.url}（缺少 reviewed）`);
    else if (reviewed.ms > today.ms) reviewProblems.push(`${item.url}（reviewed 在未来）`);
    else if (daysAgo(reviewed) > PICKS_REVIEW_DAYS) reviewProblems.push(`${item.url}（${daysAgo(reviewed)} 天未复核）`);
  }
  reviewProblems.length
    ? fail('编辑精选：复核时效', `${reviewProblems.join(' · ')}（上限 ${PICKS_REVIEW_DAYS} 天）`)
    : pass('编辑精选：复核时效', `全部在 ${PICKS_REVIEW_DAYS} 天内复核`);
}

function checkPopular(posts, html) {
  const doc = parsePopular(path.join(root, '_data', 'popular.yml'));
  const rendered = html.includes('popular-card');

  if (!doc) {
    rendered
      ? fail('预留热榜：未配置时不渲染', '页面出现了 popular-card，但没有 _data/popular.yml')
      : pass('预留热榜：未配置时不渲染', '无 popular.yml，页面无热榜块');
    return;
  }

  const generated = parseDay(doc.generated_at);
  if (!generated) throw new CannotEvaluate(`popular.yml 的 generated_at 无法解析：${doc.generated_at ?? '(空)'}`);
  const age = daysAgo(generated);
  const fresh = age >= 0 && age <= POPULAR_MAX_AGE_DAYS;
  const windowDays = Number(doc.window_days);
  if (!Number.isInteger(windowDays) || windowDays <= 0) {
    fail('热榜：window_days', `需要正整数，实际 ${doc.window_days ?? '(空)'}`);
  } else {
    pass('热榜：window_days', `${windowDays} 天`);
  }

  if (doc.items.length < 1 || doc.items.length > 10) {
    fail('热榜：条目数', `需 1–10 条，实际 ${doc.items.length} 条`);
  } else {
    pass('热榜：条目数', `${doc.items.length} 条`);
  }

  const byUrl = new Map(posts.map((p) => [p.url, p]));
  const badUrls = doc.items.filter((i) => !byUrl.has(i.url)).map((i) => i.url);
  const dupUrls = doc.items.map((i) => i.url).filter((u, i, arr) => arr.indexOf(u) !== i);
  badUrls.length || dupUrls.length
    ? fail('热榜：URL 可解析且唯一', `对不上：${badUrls.join(' · ') || '无'}；重复：${dupUrls.join(' · ') || '无'}`)
    : pass('热榜：URL 可解析且唯一', `${doc.items.length} 条都对得上`);

  const views = doc.items.map((i) => Number(i.views));
  const viewsOk = views.every((v) => Number.isInteger(v) && v >= 0)
    && views.every((v, i) => i === 0 || views[i - 1] >= v);
  viewsOk
    ? pass('热榜：views 降序', views.join(' · '))
    : fail('热榜：views 降序', `实际 ${views.join(' · ')}`);

  if (fresh && !rendered) {
    fail('热榜：时效与渲染', `数据 ${age} 天新，应渲染但页面没有 popular-card`);
  } else if (!fresh && rendered) {
    fail('热榜：时效与渲染', `数据 ${age} 天旧（上限 ${POPULAR_MAX_AGE_DAYS}），应整块不渲染但页面仍有 popular-card`);
  } else {
    pass('热榜：时效与渲染', fresh ? `数据 ${age} 天新，已渲染` : `数据 ${age} 天旧，已按规则隐藏`);
  }
}

function main() {
  const posts = readPosts();
  const html = readHtml();
  const allTags = tagStats(posts);

  checkHotTopics(allTags, html);
  checkPicks(posts, html);
  checkPopular(posts, html);

  console.log(`首页展示规则验证  today=${today.y}-${pad(today.m)}-${pad(today.d)}  site=${siteDir}`);
  console.log(`已发布文章 ${posts.length} 篇，标签 ${allTags.length} 个\n`);
  for (const r of results) {
    const icon = r.status === 'fail' ? '✗' : r.status === 'pass' ? '✓' : r.status === 'warn' ? '!' : '·';
    console.log(`${icon} ${r.label}${r.detail ? `：${r.detail}` : ''}`);
  }
  const fails = results.filter((r) => r.status === 'fail').length;
  const passes = results.filter((r) => r.status === 'pass').length;
  const skips = results.filter((r) => r.status === 'skip').length;
  const warns = results.filter((r) => r.status === 'warn').length;
  console.log(`\n结果：${fails} 红 / ${passes} 绿${warns ? ` / ${warns} 警告` : ''}${skips ? ` / ${skips} 跳过` : ''}`);
  process.exitCode = fails ? 1 : 0;
}

try {
  main();
} catch (error) {
  if (error instanceof CannotEvaluate) {
    console.error(`✗ 拒数：${error.message}`);
    process.exitCode = 2;
  } else {
    throw error;
  }
}
