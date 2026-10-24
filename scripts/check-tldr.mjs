#!/usr/bin/env node
/**
 * 已发布文章的 tldr 覆盖门禁。
 *
 * 为什么单独一道门：`tldr` 不只是正文顶部那句话，它还决定
 * `_includes/jsonLd.html` 的 speakable、FAQ 面板的入口，以及 llms.txt 的结论速查。
 * 2026-10-21 收口时全站 110/110，随后六篇新稿绕过模板又漏了——没有任何构建报错，
 * 直到有人逐篇数才发现。这条门把「新稿必须带 tldr」变成退出码。
 *
 * 口径：
 *   · 只判 `date >= 2026-09-23` 的文章（tldr 从这一批开始进模板），更早的存量不回填；
 *   · `published: false`、`future: false`、日期在未来（如 2100 模板稿）都不判；
 *   · `tldr` 必须非空且至少 20 个字符，防止写个占位符过门；
 *   · `faq` 不判：BLOG-PLAYBOOK 明确只补正文真实回答过的问题，不为了 SEO 硬填。
 *
 * 用法：
 *   node scripts/check-tldr.mjs
 *   TLDR_POSTS_DIR=/tmp/fixture node scripts/check-tldr.mjs   # teeth 用
 *
 * 退出码：0 = 无缺失；1 = 有缺失；2 = 用法或目录错误。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = process.env.TLDR_POSTS_DIR || path.join(ROOT, '_posts');
const CUTOFF = '2026-09-23';
const MIN_CHARS = 20;

if (!fs.existsSync(POSTS_DIR) || !fs.statSync(POSTS_DIR).isDirectory()) {
  console.error(`✗ tldr 门禁：目录不存在：${POSTS_DIR}`);
  process.exit(2);
}

/** 取 front matter；没有 front matter 的文件交给 Jekyll 自己报错，这里跳过。 */
function frontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : null;
}

/** 单行 `date:` 的 YYYY-MM-DD；写别的形状时按无法判定处理，不猜。 */
function postDate(fm) {
  const m = fm.match(/^date:\s*(\d{4}-\d{2}-\d{2})/m);
  return m ? m[1] : null;
}

/**
 * `tldr:` 的取值。支持单行（引号/裸值）与块标量（| / >），
 * 块标量取到下一个顶层键或 front matter 结束。
 */
function tldrValue(fm) {
  const lines = fm.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^tldr:\s*(.*)$/);
    if (!m) continue;
    const inline = m[1].trim();
    if (inline && !/^[>|][-+]?\s*$/.test(inline)) return stripQuotes(inline);
    if (/^[>|][-+]?\s*$/.test(inline)) {
      const body = [];
      for (let j = i + 1; j < lines.length; j += 1) {
        if (/^[A-Za-z_][\w-]*:\s*/.test(lines[j])) break;
        body.push(lines[j]);
      }
      return body.join(' ').trim();
    }
    return '';
  }
  return null;
}

function stripQuotes(v) {
  return v.replace(/^(['"])([\s\S]*)\1$/, '$2').trim();
}

function isTruthyFalse(fm, key) {
  return new RegExp(`^${key}:\\s*false\\s*$`, 'm').test(fm);
}

const today = new Date().toISOString().slice(0, 10);
const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md')).sort();
const missing = [];
let checked = 0;
let skipped = 0;

for (const file of files) {
  const text = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
  const fm = frontMatter(text);
  if (!fm) {
    skipped += 1;
    continue;
  }
  if (isTruthyFalse(fm, 'published') || isTruthyFalse(fm, 'future')) {
    skipped += 1;
    continue;
  }
  const date = postDate(fm);
  if (!date || date < CUTOFF || date > today) {
    skipped += 1;
    continue;
  }

  checked += 1;
  const tldr = tldrValue(fm);
  if (tldr === null) {
    missing.push(`${file}（没有 tldr 字段）`);
  } else if (tldr.length < MIN_CHARS) {
    missing.push(`${file}（tldr 只有 ${tldr.length} 字符，至少 ${MIN_CHARS}）`);
  }
}

if (missing.length > 0) {
  console.error(`✗ tldr 覆盖：${checked} 篇应检查，${missing.length} 篇缺失或过短`);
  for (const m of missing) console.error(`  · ${m}`);
  console.error('  修法：按 BLOG-PLAYBOOK §6 在 front matter 补 tldr；不要为了过门写占位句。');
  process.exit(1);
}

console.log(`✓ tldr 覆盖：${checked} 篇（${CUTOFF} 起）全部有 tldr；跳过 ${skipped} 篇未发布/未来/存量稿`);
