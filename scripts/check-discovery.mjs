#!/usr/bin/env node
/**
 * 批 1「可发现性」门禁：IndexNow 通道 + 更新日志页的收录面自证。
 *
 * 为什么这一族判据必须存在：这两件事做错了都没有症状。
 *   - key 文件与 _config.yml 不一致 → IndexNow 返回 403，但那是「哪天推了才知道」；
 *   - key 文件被写进 sitemap → 爬虫把一个机器地址当页面收，且 check-sw 的文档集合判据跟着抖；
 *   - changelog 进了 sitemap 却漏进 DOC_URLS → check-sw 组 3 双向相等红（这条由它兜），
 *     反过来漏进 sitemap → 页面线上可读但没人知道它存在，等于白做；
 *   - CHANGELOG.md 里多一个不合规的 H2 → 页面少一个版本，而它看起来「渲染正常」。
 * 所以四组 IndexNow + 四组 changelog 全写成判据，不靠肉眼。
 *
 * 用法：
 *   node scripts/check-discovery.mjs                # 读 _site/
 *   node scripts/check-discovery.mjs --site=_site   # 同上，显式
 *   node scripts/check-discovery.mjs --list         # 只打印将要核对的八组
 *
 * 失败形状：每条打印 `[组名] 条目：说明`，末尾给总数。通过形状：`✓ 可发现性 8 组判据全绿`。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const LIST_ONLY = argv.includes('--list');
const SITE = path.resolve(ROOT, (argv.find((a) => a.startsWith('--site=')) || '--site=_site').slice(7));

const GROUPS = [
  'I1 key 文件', 'I2 key 不入收录面', 'I3 推送入口', 'I4 key 不硬编码',
  'C1 页面与 meta', 'C2 版本条目数', 'C3 收录面两侧都有', 'C4 零新增 CSS',
];
if (LIST_ONLY) {
  console.log('将核对：\n  ' + GROUPS.join('\n  '));
  process.exit(0);
}

const fails = [];
const bad = (group, entry, msg) => fails.push(`[${group}] ${entry}：${msg}`);
const read = (p) => {
  const f = path.join(SITE, p);
  if (!fs.existsSync(f)) return null;
  return fs.readFileSync(f, 'utf8');
};

const cfgYml = fs.readFileSync(path.join(ROOT, '_config.yml'), 'utf8');
const key = (/^indexnow:[\s\S]*?^\s{2}key:\s*['"]?([0-9a-f]{32})['"]?/m.exec(cfgYml) || [])[1];
if (!key) bad('I1 key 文件', '_config.yml', '没有 indexnow.key，或它不是 32 位小写 hex');

const sitemap = read('sitemap.xml');
const sw = read('sw.js');
const page = read('changelog.html');
const css = read('assets/css/index.min.css');

if (sitemap === null) bad('I2 key 不入收录面', 'sitemap.xml', '产物里没有 sitemap.xml');
if (sw === null) bad('C3 收录面两侧都有', 'sw.js', '产物里没有 sw.js');
if (page === null) bad('C1 页面与 meta', 'changelog.html', '产物里没有 /changelog.html');
if (css === null) bad('C4 零新增 CSS', 'index.min.css', '产物里没有 index.min.css');

/* ── I1 ── */
if (key) {
  const served = read(`${key}.txt`);
  if (served === null) bad('I1 key 文件', `/${key}.txt`, 'IndexNow 要求这个地址公开可读，产物里没有它');
  else if (served.trim() !== key) bad('I1 key 文件', `/${key}.txt`, `内容不等于 _config.yml 的 key（文件里是 ${served.trim().slice(0, 12)}…）`);
}

/* ── I2 ── */
if (key && sitemap) {
  if (sitemap.includes(`${key}.txt`)) bad('I2 key 不入收录面', 'sitemap.xml', 'key 文件出现在站点地图里——它是机器读物，不是给人导航的页面');
  if (sw && sw.includes(`${key}.txt`)) bad('I2 key 不入收录面', 'sw.js', 'key 文件进了离线清单，同上一条理由');
}

/* ── I3 ── */
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
if (!pkg.scripts || !pkg.scripts['push:indexnow']) bad('I3 推送入口', 'package.json', '缺 `push:indexnow`，部署后没人知道怎么推');

/* ── I4 ── */
if (key) {
  const pushSrc = fs.readFileSync(path.join(ROOT, 'scripts/push-indexnow.mjs'), 'utf8');
  if (pushSrc.includes(key)) bad('I4 key 不硬编码', 'push-indexnow.mjs', '脚本里抄了一份真 key，_config.yml 换值时它会说谎');
}

/* ── C1 ── */
if (page) {
  if (/<meta name="robots"[^>]*noindex/.test(page)) bad('C1 页面与 meta', 'changelog.html', '更新日志带着 noindex meta，等于不做这一批');
  if (!/<link rel="canonical"/.test(page)) bad('C1 页面与 meta', 'changelog.html', '缺 canonical，?from= 一类变体会分散权重');
  if (!/<title>[^<]*更新日志/.test(page)) bad('C1 页面与 meta', 'changelog.html', '<title> 里没有「更新日志」，检索层拿不到主题');
}

/* ── C2 ── */
if (page) {
  const srcMd = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const headings = (srcMd.match(/^##\s+\d+\.\d+\.\d+/gm) || []).length;
  const anchors = (page.match(/id="v-\d+\.\d+\.\d+"/g) || []).length;
  if (anchors !== headings) bad('C2 版本条目数', 'changelog.html', `源里有 ${headings} 个版本标题，页面只渲染出 ${anchors} 个——解析器在静默吞条目`);
  if (/H2 标题不合/.test(page)) bad('C2 版本条目数', 'changelog.html', '页面上出现了不合规标题的告警文案，说明 CHANGELOG.md 的 H2 写法漂了');
}

/* ── C3 ── */
if (sitemap && !/\/changelog\.html/.test(sitemap)) bad('C3 收录面两侧都有', 'sitemap.xml', '没有 /changelog.html 这条地址');
if (sw && !/changelog\.html/.test(sw)) bad('C3 收录面两侧都有', 'sw.js', 'DOC_URLS 里没有 /changelog.html，离线时这一页读不到');

/* ── C4 ──
   查产物页，但先减掉一份「同族页共有的类」：changelog 与 index-all 用同一套
   header/footer chrome（alert-danger、nav-shelf-icon、cmdk-count 那一族），
   那些类由别的 CSS/脚本负责，直接拿整页去比 index.min.css 会全报成缺陷（第一版就是这么红的）。
   基线取 index-all 的产物——它同为 `.archive-content` 一族、且站内唯一「零新增 CSS」的样板页。
   减完还留在 CSS 里找不到的，才是这一页自己带进来的新类。 */
if (page && css) {
  const baseline = read('index-all.html');
  if (baseline === null) bad('C4 零新增 CSS', 'index-all.html', '找不到基线页，这一组判据无从下手');
  else {
    const cls = (html) => {
      const s = new Set();
      // 只在**标签内部**取 class：CHANGELOG 正文里有 `class="language-…"` 这类反引号代码片段，
      // 渲染成文本后引号不需要转义，naive 的 `class="([^"]+)"` 会把正文里的词当成类名
      // （实测报出「language-</code>、命中、59、个」这种假缺陷）。
      for (const tag of html.matchAll(/<[a-zA-Z][\w-]*([^>]*)>/g)) {
        const attr = /\sclass="([^"]*)"/.exec(tag[1]);
        if (attr) attr[1].split(/\s+/).filter(Boolean).forEach((c) => s.add(c));
      }
      return s;
    };
    const base = cls(baseline);
    const own = [...cls(page)].filter((c) => !base.has(c));
    if (!own.length) bad('C4 零新增 CSS', 'changelog.html', '页面相对基线没有带进任何类，这一组判据空转');
    const missing = own.filter((c) => !css.includes('.' + c));
    if (missing.length) bad('C4 零新增 CSS', 'changelog.html', `这些类是本页新带进来的、产物 CSS 里却没有定义：${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ' …' : ''}——这一页的口径是一条新 CSS 都不写`);
  }
}

if (fails.length) {
  fails.forEach((f) => console.log('✗ ' + f));
  console.log(`\n可发现性门禁：${fails.length} 条失败`);
  process.exit(1);
}
console.log('✓ 可发现性 8 组判据全绿');
