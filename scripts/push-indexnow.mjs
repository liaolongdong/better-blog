#!/usr/bin/env node
/**
 * IndexNow 主动推送：把 `_site/sitemap.xml` 里的地址一次性报给 api.indexnow.org。
 *
 * 为什么需要它：站内已有的主动推送只有百度与 360 两条国内通道（`_includes/seoScript.html`），
 * 必应系完全没有通道——而 ChatGPT 的联网检索读的就是 Bing 索引。sitemap 与 feed 是「等它来抓」，
 * IndexNow 是「发布当天就让它知道」，两者不互相替代。
 *
 * 它不改变 Google 侧的任何东西：Google 明确不读 IndexNow。别把它当全站收录开关。
 *
 * key 按 IndexNow 规范是公开的：根目录 `/<key>.txt` 的内容就是 key 本身，作用是证明
 * 「这个域名归推送者」，与 googlebed27….html / MP_verify_….txt 同性质，不是凭据。
 * 值只在 `_config.yml` 的 `indexnow.key` 里存一份，本脚本不硬编码（`check-discovery.mjs` 判据 I4 盯着）。
 *
 * 用法：
 *   node scripts/push-indexnow.mjs              # 真发一次（部署完成后跑）
 *   node scripts/push-indexnow.mjs --dry-run    # 只打印将要发什么，不发请求
 *   node scripts/push-indexnow.mjs --limit 5    # 只发前 5 条（试通道用）
 *   node scripts/push-indexnow.mjs --check      # 只做本地一致性断言，不联网
 *
 * 为什么不挂进 CI：把构建成败和「必应此刻可达不可达」绑成一件事，失败原因不可控，
 * 而且每次提交都会重复推送同一批地址。默认口径是部署后手动跑一次。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const CHECK_ONLY = argv.includes('--check');
const SITE = path.resolve(ROOT, (argv.find((a) => a.startsWith('--site=')) || '--site=_site').slice(7));
/**
 * `--limit` 要认两种写法。上一版只认 `--limit=5`：`argv.find(a => a.startsWith('--limit'))`
 * 拿到的是裸的 `--limit`，再 split 出来是 undefined → Number('') = 0 → 判成「不限」，
 * 于是文档里写的「试通道：--limit 5」实际把整站申报出去。现在分开解析，非法值直接退。
 */
const limitTok = argv.includes('--limit') ? argv[argv.indexOf('--limit') + 1]
  : (argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1];
const LIMIT = limitTok === undefined ? 0 : Number(limitTok);
if (!Number.isInteger(LIMIT) || LIMIT < 0) {
  console.log(`✗ --limit 要的是非负整数，收到 ${JSON.stringify(limitTok)}（0 或省略 = 不限）`);
  process.exit(2);
}

const ENDPOINT = 'https://api.indexnow.org/indexnow';
const fails = [];
const bad = (m) => fails.push(m);

/** 从 _config.yml 取 indexnow 那一段：只做行级读取，不引 YAML 依赖。 */
function readConfig() {
  const yml = fs.readFileSync(path.join(ROOT, '_config.yml'), 'utf8');
  const key = /^indexnow:[\s\S]*?^\s{2}key:\s*['"]?([0-9a-f]{32})['"]?/m.exec(yml);
  const enabled = /^indexnow:[\s\S]*?^\s{2}enabled:\s*(\S+)/m.exec(yml);
  // `_config.yml` 里这行带着行内注释（`url: 'https://…' # your host`），
  // 上一版的正则要求值到行尾结束，于是 cfg.url 静默读成空串——
  // 后果直接落在真请求上：keyLocation 被拼成 `https://…/better-blog/<key>.txt` 的期望值
  // 变成了相对路径 `/better-blog/<key>.txt`（实测 --dry-run 打出来的就是它），
  // IndexNow 只会把它当成一个不合法的键位地址。所以这里允许尾注释，读不到时下面直接判失败。
  const url = /^url:[ \t]*['"]?([^'"\s#]+)['"]?[ \t]*(?:#.*)?$/m.exec(yml);
  const baseurl = /^baseurl:\s*['"]?(\S*?)['"]?\s*$/m.exec(yml);
  return {
    key: key ? key[1] : null,
    enabled: !enabled || enabled[1] !== 'false',
    url: url ? url[1] : '',
    baseurl: baseurl ? baseurl[1] : '',
  };
}

const cfg = readConfig();
if (!cfg.key) bad('_config.yml 里没有 indexnow.key（或不是 32 位 hex）');
else if (!fs.existsSync(path.join(SITE, `${cfg.key}.txt`))) bad(`产物里没有 ${cfg.key}.txt（先跑 jekyll build）`);
else {
  const served = fs.readFileSync(path.join(SITE, `${cfg.key}.txt`), 'utf8').trim();
  if (served !== cfg.key) bad(`key 文件内容与 _config.yml 不一致（文件 ${served.length} 字符）`);
}

const sitemapPath = path.join(SITE, 'sitemap.xml');
if (!fs.existsSync(sitemapPath)) bad('产物里没有 sitemap.xml');

let urls = [];
if (fs.existsSync(sitemapPath)) {
  // CDATA 包裹的 <loc> 也要收：上一版 `([^<]+)` 会把它整条静默跳过，少申报还不报错。
  urls = [...fs.readFileSync(sitemapPath, 'utf8').matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/g)].map((m) => m[1].trim());
  urls = [...new Set(urls)];
  if (cfg.key) {
    const leaked = urls.filter((u) => u.includes(`/${cfg.key}.txt`));
    if (leaked.length) bad(`sitemap 里出现了 key 文件自己（${leaked.length} 条）`);
  }
}
if (!urls.length) bad('sitemap 里一条 <loc> 都没有');

let host = '';
try {
  host = new URL(urls[0]).host;
} catch {
  bad(`第一条地址不是绝对 URL：${urls[0] || '(空)'}`);
}
/**
 * 整份清单必须都落在 `_config.yml` 那个 url 的 host 上，且 url 本身要能读出来——
 * 读不出来就判失败，不许静默跳过这条检查（跳过就等于没这道闸）。
 * 为什么单独立一条：本机常驻的 `jekyll serve` 会用 dev 配置（url=http://localhost:4000）
 * 覆盖仓库 `_site`，那种 sitemap 一旦被 POST 出去，等于把 localhost 申报给自己的爬虫。
 */
if (!cfg.url) {
  bad('_config.yml 的 url 读不出来——没有它既拼不出绝对 keyLocation，也判不了清单 host');
} else if (host) {
  if (!new URL(cfg.url).host) bad(`_config.yml 的 url 没有 host：${cfg.url}`);
  const want = new URL(cfg.url).host;
  const off = urls.filter((u) => { try { return new URL(u).host !== want; } catch { return true; } });
  if (off.length) bad(`${off.length} 条地址的 host 不是 _config.yml 的 ${want}（前 3 条：${off.slice(0, 3).join(' ')}）——多半拿了一份 dev 构建的 _site 来推`);
}

if (fails.length) {
  fails.forEach((f) => console.log(`✗ ${f}`));
  process.exit(1);
}

const payload = {
  host,
  key: cfg.key,
  keyLocation: `${cfg.url}${cfg.baseurl}/${cfg.key}.txt`,
  urlList: LIMIT > 0 ? urls.slice(0, LIMIT) : urls,
};

console.log(`host=${host} keyLocation=${payload.keyLocation} 条数=${payload.urlList.length}（sitemap 共 ${urls.length}）`);

if (CHECK_ONLY) {
  console.log('✓ 本地一致性通过（--check 不发请求）');
  process.exit(0);
}
if (DRY || !cfg.enabled) {
  console.log(DRY ? '· --dry-run：不发请求' : '· indexnow.enabled: false：不发请求');
  console.log(JSON.stringify({ ...payload, urlList: payload.urlList.slice(0, 5) }, null, 1) + (payload.urlList.length > 5 ? '\n  …（只展示前 5 条）' : ''));
  process.exit(0);
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});
console.log(`HTTP ${res.status} ${res.statusText}`);
if (res.status === 200 || res.status === 202) {
  console.log(`✓ 已推送 ${payload.urlList.length} 条到 IndexNow`);
} else {
  console.log(`✗ 推送失败：${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
