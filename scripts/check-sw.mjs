#!/usr/bin/env node
/**
 * 离线层自证器：`sw.js` 的三份清单、注册代码、离线兜底页与站点收录口径必须互相对得上。
 *
 * 为什么要有这一份（与 check-tools-surface.mjs 同一个理由）：离线层的事实分散在六处
 * （sw.js 的清单、sitemap.xml、_includes 与 _layouts 的资源引用、产物 CSS 的 url()、
 * editorial.js 的注册、offline.html），而它们**全部不会因为写错而报错**——
 *   - 清单里少写一个 baseurl 前缀：构建绿、页面绿，装进来的是一条 404，读者离线时才发现；
 *   - 往 headAssets.html 加一份公共 CSS 却忘了骨架清单：在线一切正常，离线时那一页排版塌掉，
 *     而且只在"这一版没进 HTTP 缓存"的那台设备上塌；
 *   - 把 sw.js 放到 assets/js/ 下：注册成功、作用域只有 /better-blog/assets/js/，
 *     "全站离线"这句话静默地不成立；
 *   - 注册代码留在 localhost 也生效：`verify-idcard-browser.mjs` 的 5a 用 transferSize 量
 *     首屏阻塞集，SW 代发的资源那一项恒为 0，红的是量具而不是实现。
 * 这四件事每一件都只能靠"有人去比对了两个地方"才发现，所以把比对写成判据。
 *
 * 七组判据（组名就是失败行里那个方括号）：
 *   1 清单地址    每条都在 baseurl 下、都能在 _site 里找到文件、清单内部不重复
 *   2 骨架完整性  每页都发的那批同源 css/js 引用 ⊆ 骨架  豁免表；豁免表不许藏死条目；
 *                 骨架条目要么被引用、要么在白名单里、要么能证明是运行时注入的公共件
 *   3 文档集合    DOC_URLS 与 sitemap.xml 里的 HTML 地址逐条相等（双向）
 *   4 透传名单    feed / sitemap / llms 那一族不在任何预缓存清单里
 *   5 桶名        BUILD 是 12 位构建时刻，三个桶名互不相同
 *   6 兜底页      offline.html 自足（无外链、无脚本、带 noindex）且不在收录面里
 *   7 注册面      注册只在 editorial.min.js 里，页面 HTML 零新增字节；体积上限按 §7 的 shell 口径
 *
 * 用法：
 *   node scripts/check-sw.mjs                 # 读 _site/
 *   node scripts/check-sw.mjs --site=_site    # 同上，显式
 *   node scripts/check-sw.mjs --list          # 只打印三份清单的条数与将要核对的组
 *
 * 一条贯穿全部判据的口径：**这里比的是集合与条数，不是字节**。`_site/sw.js` 里带着构建时刻
 * （`BUILD`），每次部署字节都变，任何拿 md5 比产物的自检都必须把它排除在外；把这一条写在这儿，
 * 是因为"产物可复现"这类判据红过一次之后，人第一反应是去改 sw.js，而该改的是比对名单。
 *
 * 失败形状（退 1，不静默）：每条失败打印 `[组名] 条目：说明`，末尾给总数与核过的条数。
 * 通过形状：`✓ 离线层 N 条清单 × 7 组判据全绿`。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const LIST_ONLY = argv.includes('--list');
const SITE_REL = path.resolve(ROOT, (argv.find((a) => a.startsWith('--site=')) || '--site=_site').slice(7));

const fails = [];
/** 记一条失败：组名 + 条目 + 人话说明，末尾统一计数打印 */
function bad(group, entry, msg) {
  fails.push(`[${group}] ${entry}：${msg}`);
}

/** 产物里的 sw.js：不存在就直接退，不给"跳过=绿"留门 */
const SW_REL = path.join(SITE_REL, 'sw.js');
if (!fs.existsSync(SW_REL)) {
  console.error('✗ 离线层门禁：产物里没有 sw.js（先跑 bundle exec jekyll build，再谈门禁）');
  process.exit(1);
}

/**
 * 取清单：不自己写第二份解析器，直接在沙箱里求值 sw.js 顶部那一段常量声明。
 * 这份门禁与 sw.js 因此共用同一份定义，解析口径不会漂。
 * @param {string} src sw.js 产物全文
 * @returns {object} BASE / BUCKET / BUILD / 四份清单 / LIMIT / 透传名单
 */
function readManifest(src) {
  const cut = src.indexOf('function isPassthrough');
  if (cut < 0) throw new Error('sw.js 里找不到 isPassthrough，常量段的位置变了，这份门禁要跟着改');
  const head = `${src.slice(0, cut)}\nmodule.exports={BASE,BUCKET,BUILD,SHELL_URLS,DEFERRED_URLS,DOC_URLS,COVER_URLS,LIMIT,OFFLINE_URL};`;
  const box = { exports: {} };
  vm.runInNewContext(head, { module: box, exports: box.exports });
  const passthrough = [...src.matchAll(/rel === '([^']+)'/g)].map((m) => m[1]);
  return { ...box.exports, passthrough };
}

const swSrc = fs.readFileSync(SW_REL, 'utf8');
let M;
try {
  M = readManifest(swSrc);
} catch (e) {
  console.error(`✗ 离线层门禁：读清单失败——${e.message}`);
  process.exit(1);
}
const { BASE, BUCKET, BUILD, SHELL_URLS, DEFERRED_URLS, DOC_URLS, COVER_URLS, OFFLINE_URL, passthrough } = M;

/** 清单里去掉 baseurl 前缀，得到 _site 内的相对路径 */
const relOf = (u) => (u.startsWith(BASE) ? u.slice(BASE.length) : u);
/** 站点根地址映射到磁盘文件：`/` 就是 index.html */
const fileOf = (u) => {
  const rel = relOf(u).replace(/^\/+/, '');
  return rel === '' ? path.join(SITE_REL, 'index.html') : path.join(SITE_REL, rel);
};
const exists = (u) => fs.existsSync(fileOf(u));

if (LIST_ONLY) {
  console.log(`baseurl=${BASE}  BUILD=${BUILD}`);
  console.log(`骨架 ${SHELL_URLS.length} 条 · 豁免 ${DEFERRED_URLS.length} 条 · 文档 ${DOC_URLS.length} 条 · 封面 ${COVER_URLS.length} 条`);
  console.log('判据：清单地址 / 骨架完整性 / 文档集合 / 透传名单 / 桶名 / 兜底页 / 注册面（共 7 组）');
  process.exit(0);
}

// ── 1 清单地址 ────────────────────────────────────────────────────────────────
for (const [name, list] of [['骨架', SHELL_URLS], ['豁免', DEFERRED_URLS], ['文档', DOC_URLS], ['封面', COVER_URLS]]) {
  if (list.length === 0) bad('清单', name, '清单是空的——这份清单一旦为空，安装期与补全都无事可做，门禁仍会绿着，所以它自己必须红');
  const seen = new Set();
  for (const u of list) {
    if (seen.has(u)) bad('清单', `${name}重复`, `${u} 在同一条清单里出现两次`);
    seen.add(u);
    if (!u.startsWith(BASE)) bad('清单', name, `${u} 不带 baseurl「${BASE}」——装进去的会是 404`);
    if (!exists(u)) bad('清单', name, `${u} 在产物里没有对应文件（${path.relative(SITE_REL, fileOf(u))}）`);
  }
}

// ── 2 骨架完整性 ──────────────────────────────────────────────────────────────
{
  /** 每页都要发的那批引用来自这四个文件；新增公共件一定落在其中之一 */
  const SRC_FILES = [
    '_includes/headAssets.html',
    '_layouts/default.html',
    '_layouts/post.html',
    '_includes/footer.html',
  ];
  const templateRefs = new Set();
  for (const rel of SRC_FILES) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) {
      bad('骨架完整性', rel, '源文件不在，这一组的引用面没法核');
      continue;
    }
    const txt = fs.readFileSync(p, 'utf8');
    // 只认写成 `{{ site.baseurl }}/assets/…(.css|.js)` 的同源件：外链（at.alicdn）不归这层管，
    // `| relative_url` 那种写法是页面地址不是资源地址，也不归这里。
    for (const m of txt.matchAll(/(?:href|src)="\{\{\s*site\.baseurl\s*\}\}(\/assets\/[^"]+\.(?:css|js))"/g)) {
      templateRefs.add(BASE + m[1]);
    }
  }
  if (templateRefs.size === 0) bad('骨架完整性', '引用面', '一个同源 css/js 引用都没抓到——模板写法变了，这组判据成了摆设');

  /**
   * 产物侧的真实引用：每个页面里指向 `assets/**` 的 href/src。demo 那一族走自己的 `demoHead`
   * 骨架（见 _includes/headAssets.html 文件头那段），离线层不负责它们，所以它们的引用既不算
   * "骨架漏了"，也不算"骨架里养了一份没人要的"。
   */
  // 捕获组必须把 `/assets/…` 前面那一段斜杠一起收进来：原先写的是 `${BASE}/(assets/…)`，
  // 拼回 `BASE + m[1]` 时就少了一根斜杠，得到 `/better-blogassets/js/…`。后果不是红的，
  // 是**页面产物这一半边永远对不上任何清单条目**——只靠模板引用的那几件还能绿，
  // 只在页面里引用的（如 statsTemplate 的 statsShare.min.js）会被误判成豁免表死条目。
  const assetRe = new RegExp(
    `(?:href|src)="${BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/assets/[^"?#]+)"`,
    'g',
  );
  const assetRefs = new Set();
  const walkHtml = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'demo') continue;
        walkHtml(p);
      } else if (ent.name.endsWith('.html')) {
        for (const m of fs.readFileSync(p, 'utf8').matchAll(assetRe)) assetRefs.add(BASE + m[1]);
      }
    }
  };
  walkHtml(SITE_REL);
  if (assetRefs.size === 0) bad('骨架完整性', '产物引用面', '页面产物里一个 assets 引用都没抓到，这半边判据空转');

  // 产物 CSS 里的 url()：豁免表里的条目可以是这一类引用带进来的（字体是 CSS 发的，不是 HTML）
  const cssRefs = new Set();
  for (const cssRel of ['assets/css/index.min.css', 'assets/iconFont/iconfont.css', 'assets/css/share.min.css']) {
    const p = path.join(SITE_REL, cssRel);
    if (!fs.existsSync(p)) continue;
    const dir = path.posix.dirname(cssRel);
    for (const m of fs.readFileSync(p, 'utf8').matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) {
      const raw = m[1].split('?')[0].split('#')[0];
      if (raw.startsWith('data:') || /^[a-z]+:\/\//i.test(raw) || raw.startsWith('/')) continue;
      cssRefs.add(`${BASE}/${path.posix.normalize(`${dir}/${raw}`)}`);
    }
  }
  if (cssRefs.size === 0) bad('骨架完整性', 'CSS 引用面', '产物 CSS 里一个 url() 都没抓到，这半边判据空转');

  const known = new Set([...templateRefs, ...assetRefs, ...cssRefs]);
  const shell = new Set(SHELL_URLS);
  const defer = new Set(DEFERRED_URLS);

  for (const u of templateRefs) {
    if (!shell.has(u) && !defer.has(u)) {
      bad('骨架完整性', path.basename(u), `${u} 被模板引用却既不在骨架也不在豁免表：离线时这一件靠按需缓存碰运气`);
    }
  }
  for (const u of defer) {
    if (!known.has(u)) {
      bad('骨架完整性', path.basename(u), `${u} 列在豁免表里，却在模板、页面产物与产物 CSS 中都找不到引用——豁免表不许藏死条目`);
    }
    if (shell.has(u)) bad('骨架完整性', path.basename(u), `${u} 同时在骨架与豁免表里，两张表必须互不相交`);
  }
  /** 兜底页与两枚 favicon 不是"被引用带进来的"：前者由 SW 自己端出来，后者由浏览器直接要 */
  const ALLOWED_ORPHANS = new Set([OFFLINE_URL, `${BASE}/favicon.svg`, `${BASE}/favicon.ico`]);
  /**
   * 第三类：运行时由脚本注入的公共件。命令面板（assets/js/palette.min.js）不在任何
   * 页面 HTML 里——它由 editorial.js 在第一次 ⌘K 时 createElement('script') 拉进来，
   * 但离线时读者照样会按 ⌘K，没缓存就是一次注定失败的注入加一个按了没反应的面板。
   *
   * 不能简单地把它加进 ALLOWED_ORPHANS 了事：那样这一格退化成「白名单里写谁就免检谁」，
   * 清单里打错一个字符也没人管。所以这一类要拿证据——地址（去掉 baseurl 的那一截）
   * 必须作为字符串字面量真实出现在某个已构建的公共脚本里。桩哪天把路径改错，
   * 这条一断，这一格立刻回到「孤儿」那一支去红。
   */
  const INJECTED = [`${BASE}/assets/js/palette.min.js`];
  const builtJs = fs.readdirSync(path.join(SITE_REL, 'assets/js'))
    .filter((f) => f.endsWith('.min.js'))
    .map((f) => fs.readFileSync(path.join(SITE_REL, 'assets/js', f), 'utf8'));
  const injectedOk = (u) => {
    const rel = u.startsWith(BASE) ? u.slice(BASE.length) : u;
    return INJECTED.includes(u) && builtJs.some((t) => t.includes(JSON.stringify(rel)));
  };
  for (const u of shell) {
    if (!known.has(u) && !ALLOWED_ORPHANS.has(u) && !injectedOk(u)) {
      bad('骨架完整性', path.basename(u), `${u} 在骨架清单里，但模板、页面产物与产物 CSS 都没引用它——预缓存一份没人要的字节`);
    }
  }
}

// ── 3 文档集合 ≡ sitemap 的 HTML 集合 ────────────────────────────────────────
{
  const sm = path.join(SITE_REL, 'sitemap.xml');
  if (!fs.existsSync(sm)) {
    bad('文档集合', 'sitemap.xml', '产物里没有 sitemap，这一组没法对账');
  } else {
    /**
     * `<loc>` 是 `absolute_url` 出来的完整地址，pathname 里**带着** baseurl
     * （首页那一条就是 `/better-blog/`）。所以先削前缀、再判"是不是可浏览页"——
     * 顺序反过来会把首页那条当成"不是 / 也不是 .html"丢掉，那正是这份门禁要抓的那类
     * 「读起来对、跑起来少一条」的错，我自己第一版就踩在这上面。
     */
    const locs = [...fs.readFileSync(sm, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1].replace(/&amp;/g, '&'))
      .map((href) => {
        try {
          return new URL(href).pathname;
        } catch {
          return null;
        }
      })
      .map((p) => (p === null ? null : relOf(p)))
      .filter((rel) => rel && (rel === '/' || rel.endsWith('.html')))
      .map((rel) => BASE + rel);
    const docSet = new Set(DOC_URLS);
    const smSet = new Set(locs);
    if (locs.length === 0) bad('文档集合', 'sitemap.xml', '一条 HTML 地址都没抓到，对账会变成"两边都空"的假绿');
    for (const u of smSet) if (!docSet.has(u)) bad('文档集合', relOf(u), `${u} 在 sitemap 里却没进文档清单：这一页离线不可读`);
    for (const u of docSet) if (!smSet.has(u)) bad('文档集合', relOf(u), `${u} 进了文档清单却不在 sitemap：两边口径已经分家`);
    if (smSet.size !== docSet.size) bad('文档集合', '条数', `sitemap ${smSet.size} 条 vs 文档清单 ${docSet.size} 条`);
  }
}

// ── 4 透传名单不被预缓存 ─────────────────────────────────────────────────────
{
  if (passthrough.length === 0) bad('透传名单', 'isPassthrough', '一条透传地址都没抓到，这组判据已经空转');
  const cached = new Set([...SHELL_URLS, ...DOC_URLS, ...COVER_URLS].map(relOf));
  for (const rel of passthrough) {
    if (rel.indexOf('/.well-known/') === 0) continue;
    if (cached.has(rel)) bad('透传名单', rel, `${rel} 既被 SW 直连网络、又被写进预缓存清单：两句话说的是相反的事`);
  }
}

// ── 5 桶名可失效 ─────────────────────────────────────────────────────────────
{
  if (!/^\d{12}$/.test(String(BUILD))) {
    bad('桶名', 'BUILD', `BUILD=「${BUILD}」不是 12 位构建时刻，缓存桶失去唯一的失效依据`);
  }
  const names = Object.values(BUCKET);
  if (new Set(names).size !== names.length) bad('桶名', 'BUCKET', '三个桶名有重复，文档与图片会写进同一个桶');
  for (const n of names) {
    if (!n.startsWith(BASE)) bad('桶名', n, `桶名「${n}」不带 baseurl，站点下不同目录的构建会共用同名的桶`);
    if (String(BUILD) !== '' && n.indexOf(String(BUILD)) === -1) bad('桶名', n, `桶名「${n}」里不含 BUILD，发版后它不会失效`);
  }
}

// ── 6 兜底页自足且不进收录面 ─────────────────────────────────────────────────
{
  const p = path.join(SITE_REL, 'offline.html');
  if (!fs.existsSync(p)) {
    bad('兜底页', 'offline.html', '产物里没有离线兜底页：SW 的兜底那条路径会落到 503 空响应');
  } else {
    const html = fs.readFileSync(p, 'utf8');
    if (/<link[^>]+rel=["']stylesheet/.test(html)) bad('兜底页', '外链样式', '兜底页引了外部样式表——它出现的场景恰恰是"骨架可能也没缓存上"');
    if (/<script[^>]+src=/.test(html)) bad('兜底页', '外链脚本', '兜底页引了外部脚本');
    if (!/name=["']robots["'][^>]*noindex/.test(html)) bad('兜底页', 'robots', '兜底页缺 noindex，等于给抓取递一篇没有正文的重复页');
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((h) => h.startsWith(BASE + '/') || h === BASE + '/')
      .map((h) => h.split('?')[0].split('#')[0]);
    if (hrefs.length === 0) bad('兜底页', '站内链接', '兜底页上一个站内地址都没有，读者只能干等');
    const docSet = new Set(DOC_URLS);
    for (const h of hrefs) {
      if (!docSet.has(h) && h !== OFFLINE_URL) {
        bad('兜底页', relOf(h), `${h} 出现在兜底页里，却不在文档清单——离线点它必然再落回兜底页`);
      }
    }
  }
  const sm = path.join(SITE_REL, 'sitemap.xml');
  if (fs.existsSync(sm)) {
    const smTxt = fs.readFileSync(sm, 'utf8');
    for (const t of ['/offline.html', '/sw.js']) {
      if (smTxt.includes(`${BASE}${t}`)) bad('兜底页', `sitemap:${t}`, `${t} 被写进了站点地图，它是给机器读的兜底件不是可浏览页`);
    }
  }
}

// ── 7 注册面与体积上限 ───────────────────────────────────────────────────────
{
  const reg = path.join(SITE_REL, 'assets/js/editorial.min.js');
  if (!fs.existsSync(reg)) {
    bad('注册面', 'editorial.min.js', '产物里没有 editorial.min.js，注册代码无从落点');
  } else {
    const js = fs.readFileSync(reg, 'utf8');
    // 判据按**压缩后产物里真会出现的形状**来写，而不是按源变量名：压缩器会改名（源里那段
    // 闸门在产物里是 `if("serviceWorker"in navigator&&window.isSecureContext){…}`），但属性名、
    // 字符串字面量与正则源文本都原样保留，所以这三样才是压得住的锚点。
    const ANCHORS = [
      { re: /serviceWorker["']?\s*(?:in|\.register)/, what: 'serviceWorker', why: '没有注册调用，这一族离线层根本不启动' },
      { re: /sw\.js/, what: 'sw.js', why: '注册地址拼不出站点根的 sw.js' },
      { re: /swdev/, what: 'swdev', why: '缺本地闸门：`jekyll serve` 下 SW 会接管页面，verify-idcard-browser.mjs 的 5a 会把 SW 代发的资源量成 0 字节' },
    ];
    for (const a of ANCHORS) {
      if (!a.re.test(js)) bad('注册面', a.what, `editorial.min.js 里找不到「${a.what}」——${a.why}`);
    }
    /**
     * 安全上下文探测要按"它和注册在同一个单元里"来认，不能只判这个令牌出现过：
     * `isSecureContext` 在这份公共件里本来就有**两处**用途（剪贴板那处与离线注册这处），
     * 只判"串在不在"的话，删掉注册闸门、剪贴板那处仍会让这一格绿——2026-09-28 的牙齿台账
     * 就是这么抓出这个盲区的（变异只删掉了一处，门禁毫无反应）。
     *
     * 窗口取 ±300 是量出来的（2026-09-28 产物 `editorial.min.js`，全长 40,883 字符）：
     *   `serviceWorker` 出现在 40,526 与 40,709 两处，`isSecureContext` 在 2,075 与 40,561 两处，
     *   `swdev` 只有 40,609 一处。注册那一段三点相距各不到 90 字符，全落在窗口里；
     *   剪贴板那处 `isSecureContext`(2,075) 到**最近**一枚 `serviceWorker` 也有 38,451 字符，
     *   窗口够不着它。这两个偏移随公共件内容漂，改 editorial.js 后按下面这条复算再决定窗口：
     *   `node -e "const j=require('fs').readFileSync('_site/assets/js/editorial.min.js','utf8');for(const t of ['serviceWorker','isSecureContext','swdev']){const a=[];let i=-1;while((i=j.indexOf(t,i+1))>=0)a.push(i);console.log(t,a.join(','))}"`
     */
    const swdevAt = js.indexOf('swdev');
    if (swdevAt >= 0) {
      const near = js.slice(Math.max(0, swdevAt - 300), swdevAt + 300);
      if (!/isSecureContext/.test(near) || !/serviceWorker/.test(near)) {
        bad('注册面', 'isSecureContext', 'editorial.min.js 里 swdev 闸门附近既没有安全上下文探测也没有 serviceWorker 调用——'
          + '这道探测没了，http 与 file:// 下每页一条 reject；isSecureContext 只出现在别处（剪贴板那族）不算过');
      }
    }
  }
  // sw.js 必须在站点根：作用域上限就是脚本自己的目录
  if (fs.existsSync(path.join(SITE_REL, 'assets/js/sw.js'))) {
    bad('注册面', '位置', 'assets/js/sw.js 存在——那份的作用域只有 /assets/js/，全站离线不成立');
  }
  // 页面 HTML 里不许出现内联注册：那是要往每一页的首屏字节里加东西
  let inlineHits = 0;
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.html') && fs.readFileSync(p, 'utf8').includes('serviceWorker')) inlineHits += 1;
    }
  };
  walk(SITE_REL);
  if (inlineHits > 0) {
    bad('注册面', '内联注册', `${inlineHits} 个产物页面里出现了 serviceWorker 字样：注册应当只在 editorial.min.js 里，页面 HTML 零新增字节`);
  }
  /** gzip 一律按 §7 钉的 shell 口径（`cat f | gzip -9 | wc -c`），zlib 的数与它不同，跨口径比较视同没量 */
  const gzOf = (abs) => Number(execFileSync('sh', ['-c', `cat '${abs}' | gzip -9 | wc -c`], { encoding: 'utf8' }).trim());
  const swGz = gzOf(SW_REL);
  /** sw.js 的上限：它带整站文档清单，会随文章数增长，留的是"清单涨到 3 倍"的余量 */
  if (swGz > 16 * 1024) bad('注册面', 'sw.js 体积', `sw.js gzip 后 ${swGz}B 超过 16KB——清单该由数据源生成，不是把内容抄进这里`);
  const edGz = fs.existsSync(reg) ? gzOf(reg) : 0;
  /**
   * editorial.min.js 的上限：全站每一页都加载它，注册代码正是搭它上的车（设计文档 §3）。
   * 2026-10-20 重立：命令面板动作、全文搜索的加载/打分 UI、快捷键 dialog、TOC 已读点
   * 加入后实测 16,136B gzip；按 ceil1024(读数/0.95) 取 17KB（17,408B）。
   * 全文语料 1.2MB 仍在用户点「搜索全文」后才拉，首屏只多这 ~1.2KB 逻辑；
   * 若再涨，先把命令面板拆成独立延迟加载件，再谈加码。
   */
  const ED_MAX = 17 * 1024;
  if (edGz > ED_MAX) bad('注册面', 'editorial.min.js 体积', `editorial.min.js gzip 后 ${edGz}B 超过 17KB——先拆命令面板，再谈往里加`);
  console.log(`  （体积：sw.js ${swGz}B gzip / editorial.min.js ${edGz}B gzip，上限 16,384 与 ${ED_MAX}）`);
}

// ── 汇总 ─────────────────────────────────────────────────────────────────────
const total = SHELL_URLS.length + DEFERRED_URLS.length + DOC_URLS.length + COVER_URLS.length;
if (fails.length) {
  for (const f of fails) console.error(f);
  console.error(`✗ 离线层门禁：${fails.length} 条红（核过 ${total} 条清单地址，7 组判据）`);
  process.exit(1);
}
console.log(`✓ 离线层 ${total} 条清单地址 × 7 组判据全绿（骨架 ${SHELL_URLS.length} · 豁免 ${DEFERRED_URLS.length} · 文档 ${DOC_URLS.length} · 封面 ${COVER_URLS.length}）`);
