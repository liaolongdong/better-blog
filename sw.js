---
---
{%- comment -%}
站点离线层（Service Worker）。这份文件带一对空的 front matter，只为让 Jekyll 把它当页面
渲染一遍 Liquid——产物里那三行横线会被剥掉，`_site/sw.js` 是纯 JS。

它必须落在仓库根并输出到 `{{ site.baseurl }}/sw.js`：SW 能控制的作用域上限由**脚本自己的
URL 目录**决定，放在 `assets/js/` 下就只能控制 `/better-blog/assets/js/`，全站离线无从谈起。

三条承重设计，改动前先读：

1. **HTML 一律 network-first。** 在线时永远走网络，离线时才回落到缓存。这一条同时保住两件事：
   读者不会在改版后读到上一版；`scripts/verify-idcard-browser.mjs` 5a 量到的阻塞集字节
   （§7 第三段那 233,544B / 4 件的基线）不会因为"页面被 SW 代发"而变成 0。要是哪天把它改成
   stale-while-revalidate，5a 那格会当场红成"本地字节合计不达标"——那是**真**的红，
   因为口径已经不成立了，届时 §7 那一格要一起重写。
2. **只缓存同源，跨源一律透传。** `at.alicdn` 的图标 CSS、`busuanzi`、百度统计、
   奇虎的推送脚本、Waline 的接口都是跨源 GET，缓存它们拿到的是 opaque 响应：
   既算不出真实体积（LRU 会被打穿），也无法随发版失效。所以 `fetch` 里第一道判据就是
   origin 不等则**不调 respondWith**，交回浏览器默认行为。
3. **缓存桶按 BUILD 命名。** 站内 css/js 都是同名不带指纹的文件（`index.min.css` 改了还叫
   `index.min.css`），没有版本号就没法让旧缓存失效。`BUILD` 取构建时刻，于是每次部署
   sw.js 的字节都变 → 浏览器按字节比对判定"有新版本"→ 新桶建立、旧桶在 activate 里删干净。
   代价要说清楚：`_site/sw.js` 因此**不是**逐字节可复现的产物，任何拿 md5 比对产物的
   自检都必须把这一个文件排除在外（见 scripts/check-sw.mjs 的判据 6）。
{%- endcomment -%}
'use strict';

/** 站点版本，与 `_config.yml: version` 同源；只进日志与自检输出，不参与缓存命名。 */
const SITE_VERSION = '{{ site.version }}';
/** 构建时刻：每次部署都变，是缓存桶唯一的失效依据（见文件头第 3 条）。 */
const BUILD = '{{ site.time | date: "%Y%m%d%H%M" }}';
/** 站点在域名下的目录前缀，产物里所有地址都带它。 */
const BASE = '{{ site.baseurl }}';

/** 三个缓存桶：骨架（不随内容变）、文档（HTML 与 JSON）、图片（正文图与封面）。 */
const BUCKET = {
  shell: BASE + '-shell-' + BUILD,
  doc: BASE + '-doc-' + BUILD,
  img: BASE + '-img-' + BUILD,
};

/**
 * 离线兜底页。它自带内联样式、不引任何外部 css/js，因此在"骨架都没缓存上"的极端情况下
 * 仍然能读出字来。它不进 sitemap（noindex），也不进导航，所以不影响收录面那几道判据。
 */
const OFFLINE_URL = BASE + '/offline.html';

{%- comment -%}
骨架清单：安装期一次性预缓存，18 件、382,584B 原文（逐件 gzip -9 加总 158,820B；2026-10-10
实测 `_site`，复算命令见 _docs/superpowers/specs/2026-09-28-sw-offline-design.md 的 §6）。
这份清单的**完整性**由 `scripts/check-sw.mjs` 的判据 2 盯住：它去读
`_includes/headAssets.html` 与两个布局（`_layouts/default.html`、`_layouts/post.html`）
里所有同源 css/js 引用，要求每一件都出现在下面——往公共件里加东西却忘了这里，红的是门禁，
不是等读者在地铁上发现排版塌了。

`assets/iconFont/iconfont.woff` **不在**这份清单里，是刻意的：它在 CSS 里的地址带查询串
（`iconfont.woff?t=1547794084188`），把带串的写法抄进这里等于把 CSS 里那个时间戳抄第二遍，
抄本一定漂；而这条 CSS 全站每页都加载，按需缓存那一层第一次访问就会把它装进同一个桶。
它只有 8 个字形、2,544B，赌不起的是"整站图标全空"，不是这 2.5KB。
{%- endcomment -%}
const SHELL_URLS = [
  OFFLINE_URL,
  BASE + '/assets/css/normalize.min.css',
  BASE + '/assets/css/index.min.css',
  BASE + '/assets/css/github-markdown.min.css',
  BASE + '/assets/css/prism.min.css',
  BASE + '/assets/css/share.min.css',
  BASE + '/assets/iconFont/iconfont.css',
  BASE + '/assets/js/jquery.min.js',
  BASE + '/assets/js/index.min.js',
  BASE + '/assets/js/tools.min.js',
  BASE + '/assets/js/editorial.min.js',
  BASE + '/assets/fonts/newsreader-latin-var.woff2',
  BASE + '/assets/fonts/ibm-plex-mono-latin-400.woff2',
  BASE + '/assets/fonts/ibm-plex-mono-latin-500.woff2',
  BASE + '/favicon.svg',
  BASE + '/favicon.ico',
  BASE + '/assets/icons/link_hover_line.svg',
  BASE + '/assets/icons/link_hover_line_night.svg',
];

{%- comment -%}
骨架之外的同源公共件：它们**只在一类页面上**加载，或根本由配置开关决定发不发，装进骨架就是
给每一位读者多塞一份他这次访问用不到的字节。列在这里不是"以后再说"，而是给
`scripts/check-sw.mjs` 的判据 2 一张显式豁免表——它把 `_includes` 与 `_layouts` 里每一条同源
css/js 引用、以及产物 CSS 里每一条 `url()` 都拿来对账，命中下面这三条就算通过，命中不到、
又不在骨架里的就红。新增公共件时要么进骨架、要么进这张表并写明理由，两条路都要过一次判据，
不许静默。

· social-share / prism：只在文章页（_layouts/post.html:428 与 :549）。文章页本身就是走
  network-first 的文档，离线时读的是缓存里那份完整 HTML，正文与代码块都渲染得出来；
  这两件缺席只影响"分享按钮"和"二次高亮"，是离线阅读里最不要紧的两件事。
· cursor-effects：`site.footer.showCursorEffects` 为真时才发（_includes/footer.html:127），
  而且它是装饰——线上关了它就不存在，为它预留骨架字节是给一个可能不存在的功能买单。
· assets/iconFont/iconfont.woff：地址带 CSS 里那个时间戳查询串，见上面骨架清单末尾那条。
{%- endcomment -%}
const DEFERRED_URLS = [
  BASE + '/assets/js/social-share.min.js',
  BASE + '/assets/js/prism.min.js',
  BASE + '/assets/js/cursor-effects.min.js',
  BASE + '/assets/iconFont/iconfont.woff',
];

{%- comment -%}
文档清单 = sitemap.xml 那一族，一处不多一处不少（判据 3 会把两边的集合逐条对账）：
首页 + `site.nav` 白名单 + 「免安装工具」里 status: ready 的那几条 + 全站索引 + 全部文章。
两边都用同一套判据，所以将来往导航或数据源里加页，这里自己跟上。

地址一律要 `| prepend: site.baseurl`：`site.nav` 里的 url、`post.url`、`tool.url` 都是
**不带** baseurl 的站内相对地址，下拉、index-all、sitemap 那三个消费点也各自 prepend 一次
（口径见 _data/onlineTools.yml 文件头的字段说明）。在这里漏掉这一步，清单会写成 /2016/…
而站点实际在 /better-blog/2016/… 下，装进来的是 404 页。

**不含** /demo/ 下那 18 个经 Jekyll 渲染的实验页与 /page2/ … /page11/ 那 10 个翻页视图，理由与
sitemap.xml 文件头那两条一模一样：前者是独立骨架的实验页、各自带一套自己的资源（`sitemap.xml` 那段的
口径是"带站点 chrome 的那些"；2026-09-28 数法：`_site/demo` 里共 33 个 HTML，其中 18 个的源文件带
front matter、经 Jekyll 渲染，另 15 个是纯静态页不经它），后者与首页同源属于重复语料。
捞进来的价钱是量出来的而不是猜的：`_site/demo` 那 33 个 HTML 逐件相加 231,336B，整个 demo
目录（146 个文件，含它们各自那套资源）`du -sk` 报 1,956KB。两把尺子别混用：同样这 146 个文件按
字节相加只有 1,618KB，差出来的 338KB 是磁盘块对齐的开销，不是内容。而真正的代价不是字节，是**对账失去意义**——这两批地址都不在
`sitemap.xml` 里，判据 3 那条"文档清单 ≡ sitemap 的 HTML 集合"一旦要维持相等就得跟着改口径。

noindex 的文章不收，也与 sitemap 同判据。
{%- endcomment -%}
const DOC_URLS = [
  BASE + '/',
{%- for item in site.nav %}{% unless item.url == '/' %}
  '{{ item.url | prepend: site.baseurl }}',
{%- endunless %}{% endfor %}
{%- assign ready_online = site.data.onlineTools | where: 'status', 'ready' %}
{%- for tool in ready_online %}
  '{{ tool.url | prepend: site.baseurl }}',
{%- endfor %}
  BASE + '/index-all.html',
{%- for post in site.posts %}{% unless post.noindex %}
  '{{ post.url | prepend: site.baseurl }}',
{%- endunless %}{% endfor %}
];

{%- comment -%}
封面清单：只收「文章 front matter 里点名的那张本地封面」，顺序跟 `site.posts` 一致
（新帖在前），空闲补全按这个顺序拉，拉满字节上限就停。

判断"是不是外链"必须写成 `if … cover` 套一层 `unless … contains '://'`，不能写成
`contains '://' == false`——后者 Liquid 不报语法错也不报 warning，却把条件求值成
「只保留外链」，sitemap.xml 文件头那条就是踩过这坑写下的。

外链封面（早期百度/知乎图床那批）不进清单：它们随时 404，缓存它们只会把配额喂给失败请求。

同一个目录下的两张文章封面会指向同一张图（`ai-sdd` 与 `ai-sdd-github` 共用
`assets/img/ai-sdd/banner-3.png`，2026-09-28 被 check-sw.mjs 的重复判据抓到——它不是猜的，
是那条清单里真出现了两次），所以清单末尾用 Set 去一次重：不去的话，补全队列里同一张图排两次，
第一次装进桶、第二次白跑一趟匹配，还把封面预算的记账口径搅浑。
{%- endcomment -%}
const COVER_RAW = [
{%- for post in site.posts %}{%- if post.cover %}{% unless post.cover contains '://' %}
  '{{ post.cover | prepend: site.baseurl }}',
{%- endunless %}{%- endif %}{% endfor %}
];
/** 按清单原序去重（Array.from 保序），于是"新帖在前"这个补全顺序不变。 */
const COVER_URLS = Array.from(new Set(COVER_RAW));

/** 补全与容量的口径：全部以**解码后的字节**计，因为 Cache Storage 存的就是解码后的体。 */
const LIMIT = {
  /**
   * 文档桶：上面 DOC_URLS 那 99 条地址在 `_site` 里合计 9,526,945B 原文（逐件 gzip -9 加总
   * 2,495,929B；2026-10-10 量法见设计文档 §6，那篇的复算命令能原地重出这两个数）。
   * 16MB 留的是整站文字再涨七成的余量，entries 140 > 99 是因为正文内联图之外 search.json
   * 那一族 JSON 也进这个桶。
   */
  doc: { entries: 140, bytes: 16 * 1024 * 1024 },
  /** 图片桶：正文内联图不预缓存，只随浏览进桶；24MB 到顶后按写入序淘汰。 */
  img: { entries: 320, bytes: 24 * 1024 * 1024 },
  /**
   * 空闲补全里封面那一族的总预算。COVER_URLS 去重后 51 张本地封面合计 7,836,541B，全量装下去
   * 要 7.5MB，而离线页面上真正会露出来的封面远没有这么多，所以这一族按"新帖优先、逐条试到装不下"来：
   * 照清单顺序，超单张上限的跳、塞不进剩余预算的也跳，但**不停**——后面更小的还有机会进桶。落到
   * 2.5MB 这一线是 **33 张 / 2,618,873B**（入桶位次是 1–32 再加 43，**不是连续一段**：前 32 张吃掉
   * 2,607,014B、剩 14,426B，35–42 都塞不进这个缺口，43 那张 11,859B 塞得进，于是只剩 2,567B）——
   * 这既是规则的算值，也是 2026-10-10 `scripts/verify-sw-offline.mjs` 真跑落定后的读数（跳过 18 张：
   * 位次 33/34/37 超单张上限，35/36/38/39/40/41/42/44/45/46/47/48/49/50/51 塞不进剩余预算），
   * 算法与运行时两处一致，复算命令见设计文档 §6。
   * 补全每批 4 条并发，但记账排在"各自读到真实体积之后、写桶之前"，超线那张是**跳过**而不是装进去，
   * 所以入桶体积恒等于或小于这条线，不会因并发而多带一张过去。
   */
  coverBytes: 2.5 * 1024 * 1024,
  /**
   * 单张封面的上限：51 张里有 3 张超过它，在清单里的位次是 33、34、37（1,580KB / 1,346KB /
   * 585KB，均 2026-10-10 实测）。那几篇早期用的是整页大图，为它们把预算的六成喂给一张封面不值；
   * 它们仍会随正常浏览按需进桶。
   */
  coverEach: 400 * 1024,
  /** 每批并发请求数与批间隔：避免补全把用户的带宽和 Pages 的连接数一起吃干。 */
  fillBatch: 4,
  fillGapMs: 300,
};

/**
 * 这些地址永远直连网络，不进任何桶。
 *
 * 订阅源与机器读者要的是实时，缓存一份旧 feed 比不缓存更糟——feed.xml 的 atom:link self
 * 与 canonical 都声明自己是最新版，喂给阅读器一份缓存版等于对外发一份过期语料。
 * 判据只认 pathname 去掉 baseurl 之后的那一段，所以本地空 baseurl 构建（`--baseurl ""`）
 * 与线上 /better-blog/ 前缀下的结果一致。
 * @param {URL} url 已解析的请求地址
 * @returns {boolean} true 表示这个请求不由 SW 代管
 */
function isPassthrough(url) {
  const rel = url.pathname.slice(BASE.length);
  return (
    rel === '/feed.xml' ||
    rel === '/rss.xml' ||
    rel === '/sitemap.xml' ||
    rel === '/llms.txt' ||
    rel === '/robots.txt' ||
    rel === '/sw.js' ||
    rel.indexOf('/.well-known/') === 0
  );
}

/**
 * 去掉查询串与片段，得到文档桶里用的规范地址。
 *
 * 站内规范地址都不带查询串，但分享链接会带（`?from=wechat`、`?spm=`、统计加的 utm）。
 * 如果按原始地址入桶，同一条文章会存成三四份，把 140 条的上限白白吃掉。
 * 命中侧配 `ignoreSearch`，于是带参数的访问读到的正是规范地址那一份。
 * 查询串不做判据、只入规范地址——这与 isPassthrough 那一族不冲突：那几条本来就没参数。
 * @param {string} href 原始请求地址
 * @returns {string} 规范地址
 */
function canonicalOf(href) {
  const u = new URL(href);
  u.search = '';
  u.hash = '';
  return u.href;
}

/**
 * 按请求的 destination 选桶。
 * @param {Request} req 请求
 * @returns {string|null} 桶名；null 表示不缓存，交回默认行为
 */
function bucketFor(req) {
  switch (req.destination) {
    case 'style':
    case 'script':
    case 'font':
    case 'worker':
      return BUCKET.shell;
    case 'image':
      return BUCKET.img;
    case 'document':
      return BUCKET.doc;
    default:
      // 站内唯一的运行期 fetch 是 editorial.js 取的 search.json（⌘K 的语料），
      // 它是文档类数据：在线要新，离线要能用，所以走文档桶。
      return /\.json$/.test(req.url) ? BUCKET.doc : null;
  }
}

/** 字节账的复查间隔（毫秒）：口径见 `trim()` 的注释——一趟全桶读不为 60 秒内的第二次调用重跑。 */
const TRIM_RECHECK_MS = 60 * 1000;
/** 各桶上一次做完字节账的时刻。只活在 SW 这次存活期里，重启后第一趟照旧量一次。 */
const lastByteCheck = Object.create(null);

/**
 * 取桶并按上限淘汰。
 *
 * Cache.keys() 的返回顺序规范没有保证，Chrome 与 Firefox 实测是写入序，所以这里的淘汰是
 * **尽力而为的 FIFO**，不是严格 LRU：它的职责是"别让桶无限长"，不是"精确留住最近最常用的
 * 那几条"。判据里也只按这个口径断言上限，不承诺命中次序。
 *
 * 两道上限的代价不一样，所以节奏也不一样。条数闸只看 `keys()`（不取响应体），每次都跑；
 * 字节闸要为**每一条**跑一次 `cache.match` 再把体读成 blob，图片桶满员时是 320 条 /
 * 25,165,824B 整桶过一遍内存，而它在每次写桶之后都被调——一篇带 10 张内联图的文章就是
 * 10 趟全桶读。所以字节账按 `TRIM_RECHECK_MS` 收窄：被放慢的只有"越线后多久淘汰"这一件事
 * （最晚晚 60 秒），"桶不会无限长"那条下限仍然每次成立。
 * @param {string} name 桶名
 * @param {object} cap 上限（entries / bytes 两个数）
 * @returns {Promise<void>}
 */
async function trim(name, cap) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > cap.entries) {
    for (let i = 0; i < keys.length - cap.entries; i += 1) {
      await cache.delete(keys[i]);
    }
    return;
  }
  const now = Date.now();
  if (now - (lastByteCheck[name] || 0) < TRIM_RECHECK_MS) return;
  lastByteCheck[name] = now;
  let over = 0;
  const sizes = [];
  for (const req of keys) {
    const res = await cache.match(req);
    const bytes = res ? (await res.blob()).size : 0;
    sizes.push(bytes);
    over += bytes;
  }
  if (over <= cap.bytes) return;
  for (let i = 0; i < keys.length && over > cap.bytes; i += 1) {
    await cache.delete(keys[i]);
    over -= sizes[i];
  }
}

/**
 * 写桶与淘汰排在 `event.waitUntil()` 上，而不是飘在后台。
 *
 * 两条都是这一版改掉的真实形状：
 *   1. 飘着的 `cache.put()` 没人接 —— `respondWith` 的那条 promise 一落定，浏览器就允许终止
 *      SW，没写完的条目静默丢掉（下一次照样未命中，白跑一趟网络）；写满配额时 put 抛的
 *      QuotaExceededError 则变成 unhandled rejection，在 SW 控制台里躺一条没人看的错。
 *      改成 waitUntil + catch 之后，失败至少留下计数（`__bbPutErr` / `__bbPutWhy`，经 BB_PONG
 *      回传），"离线层偷偷写不进桶"从看不见的事变成可读数的事。
 *   2. 骨架桶不跑 trim —— 它的全部条目来自构建期清单，桶名又随 BUILD 走（activate 删旧桶），
 *      运行期只会补上同一批 css/js/font，本来就没有可淘汰的东西；而兜底页 `offline.html`
 *      正住在这个桶里，一旦 trim 按某个 entries 上限从头部删起，删掉的可能是读者的兜底页本身。
 *      早先这里传的是 `LIMIT.doc`（文档桶的 140 条 / 16MB），那是"恰好够不着"而不是"设计如此"。
 * @param {Cache} cache 目标桶
 * @param {string|Request} key 入桶地址
 * @param {Response} body 待写入的响应（调用方交出的那一份）
 * @param {string} name 桶名，用于选淘汰上限与认骨架桶
 * @param {object|null} cap 该桶上限；null 表示这个桶不参与淘汰
 * @param {ExtendableEvent} event 承载这次写入的事件
 * @returns {void}
 */
function storeInto(cache, key, body, name, cap, event) {
  /** 写桶这一族的失败只记账、不往上抛：它不该决定一次导航能不能成。 */
  const note = (err) => {
    self.__bbPutErr = (self.__bbPutErr || 0) + 1;
    if (!self.__bbPutWhy) self.__bbPutWhy = String(err && err.message ? err.message : err);
  };
  const job = cap
    ? cache.put(key, body).then(() => trim(name, cap))
    : cache.put(key, body);
  const tracked = job.catch(note);
  // try/catch 是给 `waitUntil` 自己兜的，不是给 `put` 兜的（那条 catch 就是上面 `tracked`）：这一族
  // 历史实现里有过"事件派发完再调就抛"的形状，而这里**每个被拦的请求**都走一遍——一次抛错就把
  // `respondWith` 的 promise 一起拒了，那一页直接打不开。写不进缓存只是慢一点，页面打不开是这一层
  // 最不该犯的错，两条路必须隔开。
  try {
    event.waitUntil(tracked);
  } catch (err) {
    note(err);
  }
}

/**
 * 缓存优先：命中直接回，未命中回源并写桶。
 * @param {Request} req 请求
 * @param {string} name 桶名
 * @param {FetchEvent} event 当前 fetch 事件，写桶排在它的 waitUntil 上
 * @returns {Promise<Response>} 响应
 */
async function cacheFirst(req, name, event) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok && res.type === 'basic') {
    // 骨架桶传 null：它不参与淘汰（理由见 storeInto 的第 2 条）。
    const cap = name === BUCKET.shell ? null : (name === BUCKET.img ? LIMIT.img : LIMIT.doc);
    storeInto(cache, req, res.clone(), name, cap, event);
  }
  return res;
}

/**
 * 网络优先：成功就顺带刷新缓存，失败（离线、断网、DNS 挂掉）才回落到缓存，
 * 缓存也没有时给离线兜底页。
 *
 * 兜底页用 503 而不是 200 返回：这条响应如果被抓取器当成真内容收下，就是一篇
 * 没有正文的重复页；503 在它眼里是"暂时不可用"，索引与排名都不受影响。
 * @param {Request} req 请求
 * @param {object} cap 该桶上限（entries / bytes 两个数）
 * @param {FetchEvent} event 当前 fetch 事件，刷新缓存排在它的 waitUntil 上
 * @returns {Promise<Response>} 响应
 */
async function networkFirst(req, cap, event) {
  const cache = await caches.open(BUCKET.doc);
  const key = canonicalOf(req.url);
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') {
      storeInto(cache, key, res.clone(), BUCKET.doc, cap, event);
    }
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    // 兜底页在骨架桶里，所以这里用全局查找而不是上面那个文档桶。
    const fallback = await caches.match(OFFLINE_URL);
    if (fallback) {
      return new Response(fallback.body, {
        status: 503,
        statusText: 'Offline',
        headers: { 'Content-Type': fallback.headers.get('Content-Type') || 'text/html; charset=utf-8' },
      });
    }
    throw err;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(BUCKET.shell);
      // cache: 'reload' —— 预缓存不许从 HTTP 缓存拿旧副本，否则发版后骨架还是上一版。
      const settled = await Promise.allSettled(
        SHELL_URLS.map((u) => cache.add(new Request(u, { cache: 'reload' }))),
      );
      const failed = settled.filter((r) => r.status === 'rejected');
      if (failed.length) {
        // 装不上就少装几件，绝不让 install 整个失败——install 被拒等于这次发版没有离线层。
        // 清单里某条地址不存在是构建期就该抓住的事，判据 1 归 scripts/check-sw.mjs 管。
        self.__bbFailed = failed.length;
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const live = Object.values(BUCKET);
      const stale = (await caches.keys()).filter((k) => live.indexOf(k) === -1);
      await Promise.all(stale.map((k) => caches.delete(k)));
      await self.clients.claim();
      fillIdle();
    })(),
  );
});

/**
 * 该不该做后台补全：省流量模式与慢链路一律跳过。
 *
 * 补全的量级是整站文字（99 条 HTML，9,526,945B 原文 / 逐件 gzip -9 后 2,495,929B 实传）加最近
 * 若干张封面（预算 2.5MB），明确打了 saveData 标记的用户不该被这一下打断。
 * @returns {boolean} true 表示可以进行补全
 */
function mayFill() {
  const conn = self.navigator.connection;
  if (!conn) return true;
  if (conn.saveData) return false;
  return !/(^|\b)2g/.test(conn.effectiveType || '');
}

/**
 * 空闲补全：activate 之后分批把文档与封面拉进桶里，让"整站文字离线可读"在首访后几分钟内
 * 真的成立，而不是等读者一本一本点开。
 *
 * 三个约束都是刻意的：只用 requestIdleCallback（没有就退回 setTimeout，绝不与首屏抢带宽）、
 * 每批 4 条并隔 300ms（Pages 侧连接数与移动网络的拥塞窗口）、已在桶里的跳过（同一个 BUILD
 * 桶内第二次跑这份补全应当是零请求，这让"回访不重复下载"变成可判据的事而不是口头保证）。
 * @returns {void}
 */
function fillIdle() {
  if (!mayFill()) return;
  const queue = DOC_URLS.concat(COVER_URLS);
  let cursor = 0;
  let coverBytes = 0;
  const idle =
    typeof self.requestIdleCallback === 'function'
      ? (cb) => self.requestIdleCallback(cb, { timeout: 5000 })
      : (cb) => self.setTimeout(cb, LIMIT.fillGapMs);

  /** 跑一批：取未缓存的地址并发请求，装完再排下一批。 */
  const step = async () => {
    const batch = [];
    while (batch.length < LIMIT.fillBatch && cursor < queue.length) {
      const url = queue[cursor];
      cursor += 1;
      const isCover = coverIndex(url) !== -1;
      if (isCover && coverBytes >= LIMIT.coverBytes) continue;
      const cache = await caches.open(isCover ? BUCKET.img : BUCKET.doc);
      if (await cache.match(url)) continue;
      batch.push({ url, isCover });
    }
    if (!batch.length) {
      if (cursor < queue.length) { idle(step); return; }
      // 队列走到底（包括"封面预算到线后一路跳过"那种走完）：这一条是给核验用的落定信号。
      // 没有它，核验脚本只能"看到文档桶满了就抄一份读数"，而封面排在队列后半段——
      // 2026-09-28 两次真跑分别抄到 12 张与 5 张，差的全是采样时刻，不是补全结果。
      self.__bbFillDone = true;
      return;
    }
    const settled = await Promise.allSettled(
      batch.map(async ({ url, isCover }) => {
        const res = await fetch(url, { cache: 'reload' });
        if (!res || !res.ok) throw new Error('not ok');
        {%- comment -%}
        先看声明体积再决定要不要读体：封面是已经压过的位图，传输不额外压缩，所以 content-length
        约等于解码后的大小，可以直接跟 coverEach 比。超大封面在这一步就断掉，不把整张拉完再扔
        ——最初这一版只有读后判，那三张超单张上限的封面（清单第 33、34、37 位，最大 1,580KB）
        都要先整张下一遍才被丢弃；补全是后台行为，但带宽不是我的。
        content-length 取不到（chunked 或某些代理）时 parseInt 得 NaN，Number.isFinite 挡掉这一步，
        下面那句读后判照样兜住——两道判据不是重复，是「快路 + 保底」。

        两条预算闸走的是"跳过"而不是"抛错"：预算到线之后，队列里剩下的每一张都会撞上这条，
        把它们记成失败会把 `fillErr` 这个**故障**计数器刷成几十条正常行为，核验里"补全失败 0 次"
        这条判据当场就废了（写这一版时正是靠真跑一遍才发现口径串了）。跳过另立一个计数器。
        {%- endcomment -%}
        const declared = parseInt(res.headers.get('content-length') || '', 10);
        if (isCover && Number.isFinite(declared) && declared > LIMIT.coverEach) {
          if (res.body) await res.body.cancel();
          self.__bbSkipped = (self.__bbSkipped || 0) + 1;
          return;
        }
        const bytes = (await res.clone().blob()).size;
        if (isCover) {
          // 总预算这道闸排在"读到真实体积之后、写桶之前"。判据与 `coverBytes +=` 之间没有 await，
          // 于是同一批 4 条并发读到的记账值是串行走的——超线那张直接被跳过而不是挤进去，
          // 入桶体积恒 ≤ 这条线（早先这里写的是"最坏多带一张过线"，是拿"先装后判"的旧形状写的，
          // 改 skips 之后那句话已经不成立，2026-09-28 核对时一并改掉）。
          if (bytes > LIMIT.coverEach || coverBytes + bytes > LIMIT.coverBytes) {
            if (res.body) await res.body.cancel();
            self.__bbSkipped = (self.__bbSkipped || 0) + 1;
            return;
          }
          coverBytes += bytes;
          // 记账体积一并露出去：设计文档 §6 要的是"这一版预算下真装进去多少字节"，
          // 只报桶里的条数不够——预算这条闸本身就是按字节关的，读数也得按字节给。
          self.__bbCoverBytes = coverBytes;
        }
        // 先拿到桶再 put：`await caches.open(x).put(...)` 里的 `.put` 落在**那个 Promise** 上，
        // 拿到的是 TypeError——2026-09-28 真机跑出来的第一个红就是这个形状（补全静默停在第 0 条，
        // 页面上什么痕迹都没有）。上面两处回源写桶都是 `const cache = await caches.open(...)` 之后再调，
        // 这里原本多写了一行链式，是这一族唯一的例外。
        const bucket = await caches.open(isCover ? BUCKET.img : BUCKET.doc);
        await bucket.put(url, res);
        // 计数挂在 self 上、经 BB_PONG 回给页面：回访那一轮 activate 之后这个数应当仍是 0，
        // 因为清单里的每一条都已经在桶里——"补全只在第一次跑"从口头保证变成可读数的事。
        self.__bbFilled = (self.__bbFilled || 0) + 1;
      }),
    );
    const rejected = settled.filter((r) => r.status === 'rejected');
    // 失败必须留下名字：这一族先前只数条数，于是"桶 API 写错"和"真的离线了"在读数上长得一样，
    // 前者会把整轮补全在第 0 条就停掉，而后者的停掉是对的。第一条 reason 原样存下并经 PONG 回传。
    if (rejected.length) {
      self.__bbFillErr = (self.__bbFillErr || 0) + rejected.length;
      if (!self.__bbFillWhy) self.__bbFillWhy = String(rejected[0].reason && rejected[0].reason.message ? rejected[0].reason.message : rejected[0].reason);
    }
    if (rejected.length === batch.length && batch.every((b) => !b.isCover)) {
      // 整批文档全失败通常意味着已经离线了，继续排下去只是空转。
      self.__bbFillStop = `${batch.length} 条文档整批失败：${String(rejected[0].reason && rejected[0].reason.message ? rejected[0].reason.message : rejected[0].reason)}`;
      return;
    }
    idle(step);
  };

  /**
   * 地址属于封面清单还是文档清单。
   * @param {string} url 待判地址
   * @returns {number} 在 COVER_URLS 里的下标，不属于则 -1
   */
  function coverIndex(url) {
    return COVER_URLS.indexOf(url);
  }

  idle(step);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try {
    url = new URL(req.url);
  } catch (err) {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (isPassthrough(url)) return;

  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(networkFirst(req, LIMIT.doc, event));
    return;
  }
  const name = bucketFor(req);
  if (!name) return;
  event.respondWith(cacheFirst(req, name, event));
});

self.addEventListener('message', (event) => {
  // 自检脚本用这条问"当前是哪一次构建的 SW、装砸了几件、清单各有多少条"，避免把断言写在
  // 页面上靠肉眼读。四个条数是给离线验证那一步现用的：回填的桶数与清单条数对不上，
  // 就说明补全中途停了（配额、离线、或整批失败），那一轮"整站离线"的结论不成立。
  //
  // 两道探测排在回包之前，都是给这一条回包自己的：作用域保证了同源页面才够得着这个 SW，
  // 但 `event.source` 可以是空（非窗口上下文发来的消息），少了那句判据就是
  // `null.postMessage` 的一条 TypeError；`event.origin` 那道则把"这条回包只交给同源"
  // 写成代码里的事实，而不是靠作用域模型的推论——回包内容（构建号、整站清单条数、
  // 补全读数）本来就是站点的发布元数据。
  if (!event.data || event.data.type !== 'BB_PING') return;
  if (event.origin !== self.location.origin) return;
  if (!event.source) return;
  event.source.postMessage({
    type: 'BB_PONG',
    build: BUILD,
    version: SITE_VERSION,
    failed: self.__bbFailed || 0,
    filled: self.__bbFilled || 0,
    fillErr: self.__bbFillErr || 0,
    fillWhy: self.__bbFillWhy || '',
    // 写桶这一族的失败计数：与 fillErr 分开记，因为那一条只覆盖空闲补全，而运行期写桶
    // （浏览文章、抓资源）撞配额时以前是**什么读数都没有**的——unhandled rejection 不进任何桶。
    putErr: self.__bbPutErr || 0,
    putWhy: self.__bbPutWhy || '',
    // done / stop / skipped 这三个是补全的"落定信号"：核验脚本要等 done 或 stop 才抄读数，
    // 否则抄到的是队列走到一半的瞬时值（封面排在文档后面，一半状态最容易被误当成结果）。
    done: !!self.__bbFillDone,
    stop: self.__bbFillStop || '',
    skipped: self.__bbSkipped || 0,
    coverBytes: self.__bbCoverBytes || 0,
    buckets: Object.values(BUCKET),
    counts: {
      shell: SHELL_URLS.length,
      doc: DOC_URLS.length,
      cover: COVER_URLS.length,
      deferred: DEFERRED_URLS.length,
    },
  });
});
