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
const LIMIT = Number((argv.find((a) => a.startsWith('--limit')) || '').split(/\s+|=/)[1] || 0);
const SITE = path.resolve(ROOT, (argv.find((a) => a.startsWith('--site=')) || '--site=_site').slice(7));

const ENDPOINT = 'https://api.indexnow.org/indexnow';
const fails = [];
const bad = (m) => fails.push(m);

/** 从 _config.yml 取 indexnow 那一段：只做行级读取，不引 YAML 依赖。 */
function readConfig() {
  const yml = fs.readFileSync(path.join(ROOT, '_config.yml'), 'utf8');
  const key = /^indexnow:[\s\S]*?^\s{2}key:\s*['"]?([0-9a-f]{32})['"]?/m.exec(yml);
  const enabled = /^indexnow:[\s\S]*?^\s{2}enabled:\s*(\S+)/m.exec(yml);
  const url = /^url:\s*['"]?(\S+?)['"]?\s*$/m.exec(yml);
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
  urls = [...fs.readFileSync(sitemapPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
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
