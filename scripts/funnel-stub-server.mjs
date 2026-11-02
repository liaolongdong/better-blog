#!/usr/bin/env node
/**
 * 漏斗上报的本地复验量具（一次性工具，不进 CI、不进站点产物）。
 *
 * 它同时干两件事：把 `_site` 挂在 `http://127.0.0.1:<port>/better-blog/` 下伺服，
 * 并在同一个端口上开一个 `/e` 收集端 + `/__hits` 读数口。为什么收在同一台 host：
 * 埋点件用的是 `fetch(url, {mode:'no-cors'})`，跨端口本来就是跨域，
 * 但读数那一发要能在页面控制台里直接 `fetch('/__hits')` 拿到，同源最省事。
 *
 * 为什么需要它：`check-seo.mjs` 的「漏斗」那一组判的是**接线**（锚点在不在、参数名两端对不对、
 * 加载件与锚点双向一致），它判不到「点下去真有一个请求出去了没有」。后半句只有真浏览器能验，
 * 而 endpoint 指向的是本人账号里的 Worker——本地复验不该往生产面板里打脏数据。
 *
 * 用法：
 *   node scripts/funnel-stub-server.mjs                 # 默认 8792 端口、_site 目录
 *   node scripts/funnel-stub-server.mjs --site=/tmp/x --port=8793
 *   然后把 endpoint 指到本机（只改产物副本，不改仓库）：
 *     perl -0pi -e 's/data-funnel-endpoint=""/data-funnel-endpoint="http:\/\/127.0.0.1:8792\/e"/' \
 *          _site/tools.html
 *   浏览器打开 http://127.0.0.1:8792/better-blog/tools.html，滚到 CTA、点一枚按钮，
 *   再读 http://127.0.0.1:8792/__hits —— 期望看到三段：
 *     view | <kind> | page | <slug> | /better-blog/tools.html
 *     impression | store | hub | <slug> | ...
 *     click | store | hub | <slug> | ...
 *
 * 判读口径（2026-10-28 第一次跑出来的东西）：同一投放位上 store / demo / repo / guide 四类按钮
 * 的 impression 必须**各有一行且 k 值互不相同**。它们并成一行，就是 `data-funnel` 的三段
 * 只发出了两段那一类断线——静态门禁全绿时照样会发生，所以这一发不能省。
 *
 * 退出码：0 = 正常退出（Ctrl-C）；1 = 起不来（产物目录不存在或端口被占）。
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const bad = (msg) => { process.stderr.write(`✗ funnel-stub：${msg}\n`); process.exit(1); };

/**
 * 同时认 `--port=8793` 与 `--port 8793`。只认等号那一形时，写成空格会**静默退回默认端口**，
 * 而默认端口常常正被上一次没退干净的自己占着——于是报出来的是 EADDRINUSE，
 * 看不出根因是参数没吃到（2026-10-28 实测踩过一次）。认不出的参数一律拒收，
 * 不给「打了个错别字的开关然后一切照默认跑」留路。
 */
function readOpt(name, dflt) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === `--${name}`) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) bad(`--${name} 后面要跟一个值`);
      argv[i] = argv[i + 1] = '';
      return v;
    }
    if (a.startsWith(`--${name}=`)) {
      const v = a.slice(name.length + 3);
      argv[i] = '';
      return v;
    }
  }
  return dflt;
}

const SITE = path.resolve(ROOT, readOpt('site', '_site'));
const BASE = readOpt('base', '/better-blog');
const PORT_RAW = readOpt('port', '8792');
const PORT = Number(PORT_RAW);
const leftover = argv.filter((x) => x !== '');
if (leftover.length) bad(`认不出的参数：${leftover.join(' ')}（只吃 --site= --port= --base=）`);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) bad(`--port 要是一个端口号，收到 ${JSON.stringify(PORT_RAW)}`);

if (!fs.existsSync(path.join(SITE, 'index.html'))) {
  process.stderr.write(`✗ funnel-stub：${SITE} 里连 index.html 都没有——先 pnpm build:site，或 --site= 指一份真产物\n`);
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};
/** 1×1 透明 GIF：与 Worker 回的是同一枚，别让本地桩给出一种线上没有的形状 */
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const hits = [];

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (u.pathname === '/e') {
    const q = Object.fromEntries(u.searchParams.entries());
    // 与 Worker 同形：缺 `e` 的事件不收，回 204 且不带动作体。本地桩如果恒回 200+GIF，
    // 「空事件」那一支在线上怎么死掉就永远复现不出来（2026-11-02 实测：带 body 的 204 抛 TypeError）。
    if (!q.e) {
      res.writeHead(204, { 'cache-control': 'no-store' });
      res.end();
      return;
    }
    hits.push({ at: new Date().toISOString(), q });
    res.writeHead(200, { 'content-type': 'image/gif', 'cache-control': 'no-store' });
    res.end(GIF);
    return;
  }
  if (u.pathname === '/__hits') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(hits, null, 1));
    return;
  }

  let rel = u.pathname.startsWith(BASE) ? u.pathname.slice(BASE.length) : u.pathname;
  if (rel === '' || rel === '/') rel = '/index.html';
  // 畸形的百分号编码（`/%zz`）会让 decodeURIComponent 抛 URIError：不接住就是整个进程死掉，
  // 而读数的页面还在别人浏览器里开着。按 400 处理，进程继续。
  let decoded;
  try {
    decoded = decodeURIComponent(rel);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`bad percent encoding: ${rel}`);
    return;
  }
  const file = path.join(SITE, decoded);
  if (!file.startsWith(SITE + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`not found: ${rel}`);
    return;
  }
  const buf = fs.readFileSync(file);
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'content-length': buf.length });
  res.end(buf);
});

server.on('error', (e) => {
  process.stderr.write(`✗ funnel-stub 起不来（端口 ${PORT}）：${e.message}\n`);
  process.exit(1);
});
server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(
    `✓ funnel-stub 在 http://127.0.0.1:${PORT}\n` +
    `  站点：http://127.0.0.1:${PORT}${BASE}/tools.html（读 ${SITE}）\n` +
    `  收集端：/e ｜ 读数：/__hits（已收 ${hits.length} 发）\n`,
  );
});
