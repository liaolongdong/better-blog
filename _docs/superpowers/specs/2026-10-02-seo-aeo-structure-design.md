# SEO / AEO 结构层设计

日期：2026-10-02
范围：子项目 1（四子项目分解中的第一个）
状态：已获批，执行中

## 0. 这份文档在哪个位置

一次功能盘点把「动效 / UX / 浏览时长 / SEO / CTR」这个请求分解成四个能独立交付的子项目，
按 `1 → 3 → 2 → 4` 依次走，每个各出一份 spec：

1. **SEO/AEO 结构层**（本文档）
2. 工具产品扩张（C1–C5）
3. 动效与浏览时长（D2 共享元素转场 / D3 ⌘K 升级）
4. 内容治理（A4 补 seo_description / A8 TOC 服务端化 / A9 categories 归一化）

A4 / A8 / A9 归子项目 4 而不是本文档，因为它们都要批量改 `_posts` 的 front matter，
会撞上 `article-check.mjs` 的 60 条断言与 prettier 重排 ```js 围栏改 chars 计数这两件事，
风险形状与本文档里「零正文改动」的那批完全不同。

目标流量口径：**Google 与 AI 答案引擎优先，国内不掉队**。
所以百度 / 360 / so 三个推送脚本保留但去同步（B1），不为国内收录牺牲 CWV。

## 1. 起点事实（全部复核过，不是转述）

> 本表的行号是**动手之前**那份文件的行号，是「起点」快照。落地之后行号会漂，
> 漂了的地方由 §4 各件自己的小节按新行号引，不回改这张表。
> 例：表里「`seoMeta.html:77` 全站输出同一个 `site.keyword`」，A5 之后 `:77` 已经是
> 解释这件事的注释块开头，那行 meta 换成了按页取值并落到 `:89`。

| 事实 | 复核方式 |
| --- | --- |
| 博客正文 → 工具页内链 **0 条** | grep `_posts` 对 `tools/(idcard\|codec\|json\|diff)\.html\|/tools\.html` 零命中 |
| `last_modified_at` / `updated` 在 80 篇里 **0 篇声明** | grep `^(last_modified_at\|updated):` 零命中 |
| `seoMeta.html:153` 的 `page_modified` 接线**已存在且设计正确** | 读源；`:143-149` 注释明确记录了「dateModified 恒等 datePublished 是伪造更新信息」这个缺陷的来历 |
| `sitemap.xml:76` 文章 `<lastmod>` 用 `post.date` | grep |
| `keywords` meta 全站输出同一个 `site.keyword` | `seoMeta.html:77` |
| `jsonLd.html` 的 `@type` 全集不含 `WebApplication` / `FAQPage` / `ItemList` | grep `@type` |
| `<head>` 有 4 个同步阻塞 `<script src>`：jQuery + 三个统计推送 | `headAssets.html:92`、`seoScript.html:2-4`，经 `head.html` / `postHead.html` 末尾那两行 `{% include headAssets.html %}` / `{% include seoScript.html %}` 进 head |
| 全站 **0 处** `srcset` / `<picture>` / `fetchpriority` | grep `_includes` 零命中 |
| `assets/img` 共 57.9MB：png 48.1MB(125) / webp 6.3MB(87) / jpg 3.4MB(44) | `stat` 求和 |
| **23 张 >512KB 的 png 占 37.9MB = 79%** | `stat` + `sort -rn` |
| 无 `rel="manifest"`、无 `theme-color`（仅 2018 旧文正文里有一处） | 全仓 grep |
| `index-all.html` **零** `<script>` / `URLSearchParams` | grep 计数 0 |
| CI 用 `actions/checkout@v4` 且**未写 fetch-depth** → 默认浅克隆 depth=1 | `.github/workflows/jekyll.yml:22` |
| 本机有 `cwebp 1.5.0`；**无** `avifenc`、无 imagemagick，`ffmpeg` 无 AV1 编码器 | `command -v` + `ffmpeg -encoders` |
| 首屏 head 余量 **~838B** | 本目录 `2026-09-25-blog-online-tools-design.md` §7 |

两条由既有注释钉死、本轮不许动的约束：

- `headAssets.html:50`：「jQuery 仍同步加载、仍排在所有用 `$` 的脚本之前：加 defer 会改到执行次序，那是另一回事。」
- `headAssets.html:73-77`：github-markdown / prism / share **必须排在 `index.min.css` 之前**，
  因为 editorial 层靠「同特异度、后加载」覆盖旧规则；挪到后面等于把覆盖关系整个反过来。

## 2. 并发约束

设计当天工作树里有另一个会话在飞：`sw.js` / `offline.html` / `scripts/check-sw*.mjs` /
`scripts/verify-sw-offline.mjs` / 一篇新文章全是未跟踪态，`_config.yml`、`package.json`、
`dev/sass/toolkit.scss`、`dev/js/editorial.js` 有它的改动，`scripts/verify-motion-batch4.mjs`
处于「已暂存删除 + 磁盘未跟踪」。

因此本轮：

- **不碰** `_config.yml`、`package.json`、`dev/sass/toolkit.scss`、`dev/js/editorial.js`、
  `sw.js`、`scripts/check-sw*.mjs`（manifest 路径写死在模板里，不加 config flag；
  新脚本的命令写进本文档而不是加 npm script；FAQ 样式放**新** scss 文件）
- 提交一律 `git commit -- <显式路径>`，**绝不 `git add .`**（对方的暂存集会被吞）
- B3（CSS 拆包）必须碰 `dev/sass/index.scss` 与 `vite.config.js`，
  与对方的 `toolkit.scss` 同族 → **推到对方收口之后**，本轮不做

## 3. 切片

**刀 1｜纯增量，零文件冲突**：A5 / A2 / A7 / A6 / A1 / A3 / B1 / B2
碰 `_includes/*`、`_layouts/post.html`、`_data/onlineTools.yml`、`_plugins/image_dims.rb`、
新增 `scripts/build-*.mjs` 与 `scripts/check-seo*.mjs`。**不碰** `_posts`。

**刀 2｜性能结构改动**：B3 CSS 按页拆包 —— 本轮不做，见 §2。

**刀 3｜少量正文**：A1 手工文中内链 5–8 篇 —— 归子项目 4 一起做（都要过 article-check）。

## 4. 各件设计

### A5｜keywords meta 逐页差异化

现状 `seoMeta.html:77` 每页输出同一个 `site.keyword`，零差异化——不是没用，是负资产：
它向引擎声明「这 119 个页面的主题完全相同」。

改成：有 `page.tags` 就输出 tags，否则**不输出该 meta**（不回退到全站串）。
Google 忽略 keywords，但百度 / 360 仍读，差异化之后至少不再是同一句。

### A3｜真实修订时间（新鲜度信号）

**这是本轮 SEO 收益最大的一件，因为接线已经存在，缺的只是数据源。**

`seoMeta.html:153-168` 已经实现了完整的口径：取 `last_modified_at` 与 `updated` 末项的较新者，
且「与发布同日视为未修订」→ 置 nil → `article:modified_time` 与 `dateModified` 一并不输出。
缺陷只在 80 篇里 0 篇声明这两个字段，所以这条链恒空。

做法：**新增 `scripts/build-modified-data.mjs` → 产出 `_data/modified.yml` 入库**，
`seoMeta.html` 在既有链上多接一个数据源（三者取最新），其余逻辑一字不改。

不在 `_plugins` 里调 git，因为 CI 是浅克隆（§1），构建期根本没有历史。
生成物入库还有两个好处：可被门禁直接读、可 diff、可复算——符合本仓「数字要照着能复算」的口径。

**指纹口径（诚实性的核心）**：

```
读 md → 剥 front matter → 正文规范化 → sha256
规范化 = 统一换行为 \n + 去行尾空白 + 折叠 3+ 连续空行为一个 + 去首尾空行
        + 剥掉图片地址的扩展名（只认 ![…](…) 与 <img src=…> 两个位置）
```

遍历该文件的提交历史，取**最近一次规范化后指纹与前一版本不同**的提交时间。
若指纹从未变过则**不输出该条**——让 `dateModified` 缺席，而不是拿发布日期冒充。

**图片扩展名那一条是 B2 的前置，不是洁癖**：`2548ae9`（2026-08-27）实测把三篇的
`banner.png` 改成 `banner.webp`，指纹每篇 +3 字符，读者看到的却是同一幅画面；B2 要转码
23 张大 PNG，不剥扩展名就是 23 篇同时盖上新日期。剥的位置卡死在图片引用里，所以换图
（stem 变）、删图、加图、改 alt、正文出现 `app.png` 这个词、代码块写 `a.png`、
普通链接指向 .png，全都仍然算修订（六种形状逐一验过）。

**为什么必须规范化**：prettier 会重排帖子里的 ```js 围栏（补分号），一次全站 `prettier --write`
就能把 80 篇的「最后修改」全顶到同一天。那不是新鲜度，是向搜索引擎集体报假更新。
规范化后哈希相同 = 只改了空白 / 换行 / 格式 / 图片编码 → 不许进 yml。**这条要有专门的牙。**

**光靠指纹不够——批改必须单独挡。** 首轮 dry-run 报出 65/80 篇「有修订」、churn 81.3%，
其中几十篇共享同一个 `d1ecf84`（2026-09-22）、`chars_delta` 只有 +1/-15/-37。查下来那一笔
一次改了 **67 篇**，做的是「把正文里与版面重复的 `# H1` 降成 `## H2`」——完全合法的**内容**
变动，却不是作者对任何一篇的修订。按 subject 过滤这条路实测走不通：改过 `_posts` 的 336 个
提交里有 `feat`/`docs`/GitHub 网页编辑器的 `Update xxx.md`/「修改」「合并」这类自由中文，
而唯一那条 `style(post): 移除CSS样式中的!important声明` 其实是真内容改动。

所以判据是机械的：**一个提交碰了 ≥10 篇 `_posts` 就判它批改，跳过它继续往回找**
（继续往回是关键——不该让一次批改掩盖掉更早的真实修订）。阈值是量出来的不是拍的：
`488641d`（真写作提交）碰 4 篇，`d1ecf84`/`dd0822b` 碰 67/64 篇。

**熔断器**：与既有 yml 比对，一轮变动超过语料 30% 就拒绝写盘（除非 `--force`）。语义是
「一次改动波及三成文章」——真实的修订潮不会长这样，全站格式化才会。首次生成没有基线，
熔断器不触发；存量历史由上面那条批改规则覆盖，熔断器覆盖的是**将来**有人手动跑
`prettier --write`（本仓没有 prettier 配置 / husky / lint-staged，已核）。

输出形状：

```yaml
"/2026/09/17/gods-eye-view-keyless.html":
  at: "2026-09-20T14:33:07+08:00"
  commit: a94fd40
  chars_delta: +42
  published: "2026-09-17"
```

`chars_delta` 是规范化后正文的字符增减，用来在评审时一眼看出这次修订是三个字的错别字还是整段重写。

**fail loud**：拿不到 git 历史（浅克隆 / 非 git 目录）→ exit 非 0 并打印原因，
**绝不静默输出空 yml**。静默归零正是本缺陷现在的形态，不能用同一种方式修它。

**接线改成三处共用一个 include。** 原计划「`seoMeta.html` 在既有链上多接一个数据源，
其余逻辑一字不改」，落地时发现 `sitemap.xml:76` 写的是 `post.date`——等于全站每篇都申报
「最后修改日 = 发布日」，和 `seoMeta` 避免的 `dateModified == datePublished` 是同一类假新鲜度，
只是换了个载体。把链搬进 sitemap 就是第二处解析 front matter，两处迟早漂。所以抽出
`_includes/pageModified.html`（入参 `p`，出参 `page_modified`，约定照 `coverSrc.html`：
include 与调用方共享同一 Liquid 作用域），`seoMeta.html` 与 `sitemap.xml` 各调一次；
`jsonLd.html` 继续读 `seoMeta` 跨出来的那个变量，一字不动。sitemap 推不出真值时退回
`post.date`（那时两者相等是真的），保住「每条 `<url>` 都带 lastmod」的既有形状。

**落地实测**（快照 137 页 / 79 篇文章）：

| 指标 | 改前 | 改后 |
| --- | --- | --- |
| 输出 `article:modified_time` 的文章 | 0 | 45 |
| 输出 `BlogPosting.dateModified` 的文章 | 0 | 45 |
| `dateModified == datePublished` 的页面 | 79（全部伪造） | 0 |
| sitemap `<lastmod>` 取自 git 推导表 | 0 | 45 |
| sitemap `<lastmod>` 退回 `post.date` | 79 | 35 |

45 个键逐一在 `_site` 里反查存在（0 落空）；三处取值与 yml 逐字一致；`--verify` 重跑 churn = 0；
生成器 dry-run 约 11s（`postsTouchedBy` 按 sha 缓存后从 27s 降下来）。

**顺带查清的一件事**：`assets/js/*.min.js` 与 `assets/css/*.min.css` 在 `.gitignore:9-10`，
`git ls-files` 下两个目录都是 0 条——**构建产物不入库**，CI 靠 `.github/workflows/jekyll.yml:51`
的 `pnpm build`（= `vite build && vite build --config vite.demo.config.js`）现生成。
这决定了 B1 的修法只改 `dev/libJs/soPush.js` 这个**源文件**就够，也决定了 B2 的转码产物
要不要入库必须先问同一件事（见 B2 小节）。

### A2｜工具页结构化数据

四个工具页现在全落在 `jsonLd.html` 的 `CollectionPage` 分支——那是给归档页用的类型，
描述不了「一个在浏览器里跑的应用」。

新增 `_includes/jsonLdTool.html`，输出 `WebApplication`（**不是** `SoftwareApplication`：
纯浏览器端、无安装、无下载）。数据全部来自 `_data/onlineTools.yml` 现成的
`h1` / `title` / `desc` / `tagline` / `features` / `panels`，**零新文案**：

```
@type: WebApplication
name:            tk.h1            ← 与页面可见 H1 同值（Google 要求一致）
alternateName:   tk.name
description:     tk.desc
url / inLanguage / applicationCategory: DeveloperApplication
browserRequirements: "Requires JavaScript. 计算全部在本机浏览器内完成，输入不上传。"
offers:          { @type: Offer, price: 0, priceCurrency: CNY }
featureList:     tk.features 或 tk.panels[].name
isPartOf:        { @id: <site_home>#blog }
```

`CollectionPage` 保留（它描述「这一页是个页面」，与 WebApplication 不冲突），
WebApplication 作为**追加**的一个 JSON-LD 块。

**识别方式**：给四个工具页的 front matter 加 `tool_slug: idcard|codec|json|diff`，
`jsonLd.html` 在 `page.title` 分支里先查 `page.tool_slug` → 命中则 include `jsonLdTool.html`。
不复用 `permalink` 做字符串匹配：那等于在模板里立第二处 slug 口径，
而 `onlineTools.yml` 的文件头注释已经明确说过「同一份事实写第二遍，迟早只改一处」。

**落地时改掉了上面这条**：四页 front matter 里**本来就有** `tool: <slug>`，而且各页正文正是用
`assign tk = site.data.onlineTools | where: 'slug', page.tool | first` 查数据的。再加一个
`tool_slug` 就是给同一个事实立第二个键，恰好是上面那段话要避免的事。所以直接复用 `page.tool`。

**也改掉了 `alternateName`**：yml 里四个工具的 `name` 与 `h1` 逐字相同（`name` 供顶栏下拉与
`tools.html` 小节标题用，那两处渲染的就是同一串），无条件发出去等于把同一个值写两遍，
而 schema.org 的 `alternateName` 语义是「另一个叫法」。改成**只在 `_tk.name != _tk.h1` 时才发**，
第五个工具真取了不同的 name 时它自己就开始说话。

**Google 的评分要求：查过文档，本轮刻意不满足。** Software App 富媒体结果把「评分或评价」
列为**必要**属性——`aggregateRating` 与 `review` 至少要有一个（`developers.google.cn` 的
software-app 文档，已抓取核对；该页无弃用声明，`WebApplication` 也在它明确支持的
Web 应用子类型里）。本仓拿不出诚实的那一个：四个工具页都是 `layout: default`，没有评论区
（waline 只挂在 `_layouts/post.html`），也没有任何评分采集。编一个 `aggregateRating`
是 Google 明确处理的评价类作弊，代价比拿不到富媒体结果大得多。

所以这一块重新定位为：**不追 Google 的 Software App 富媒体结果，只做实体描述**——
让 AI 检索（Google 的生成式结果、其它答案引擎）与 Bing 能准确回答「有没有一个免费、
不上传输入的在线工具能做 X」。这仍然对着用户要的「Google/AI 优先」，只是收益在
AEO 一侧而不是富媒体一侧。Search Console 的 Software App 报告可能把这四页列为「缺少评价」，
那是已知且刻意的取舍。**这一段与 jsonLdTool.html 文件头都写了「不要补 aggregateRating」**，
因为后来人看见「缺必要属性」的第一反应就是去补一个。

`applicationCategory` 写死 `DeveloperApplication` 而不进 yml：四个都是面向开发者的本地计算工具
（证件页的随机测试数据那一栏自己写明「只做开发与测试用途的占位数据」），子项目 2 计划新增的
QR / 颜色 / UUID / JWT / cron / 单位换算 / markdown 也全在这一类里；在 yml 里加一格四行同值的
字段只是把同一个事实写第二遍。`browserRequirements` 只写 `"Requires JavaScript."`，
隐私口径不写进去——「不上传、不发请求」是**逐页**的事实、已各自写在 `tk.desc` 里，
在共享模板里替四页下一句总括的隐私承诺，第五个工具一旦联网就是模板在说谎。

**落地实测**（快照 137 页，196 个 ld+json 块全部 `JSON.parse` 通过，0 失败）：

| `@type` | 改前 | 改后 |
| --- | --- | --- |
| WebApplication | 0 | 4 |
| CollectionPage | 30 | 30 |
| BlogPosting / BreadcrumbList | 79 / 79 | 79 / 79 |
| Person / WebSite / Blog | 2 / 1 / 1 | 2 / 1 / 1 |

四页的 `name` 与页面可见 `<h1 class="masthead-title">` 逐字相等（Google 的硬要求），
`featureList` 四页各 5 项——两种形状都覆盖到了：`panels` 形状的 idcard / codec 取
`panels[].name`（身份证 / 统一社会信用代码 / 银行卡 / 手机号 / 随机测试数据），
`workbench` 形状的 json / diff 取 `features`。`CollectionPage` 保持不变，说明 WebApplication
是**追加**而不是替换。

**FAQPage 本轮不做。** 理由：`FAQPage` 要求结构化数据与**页面可见内容**一致，
否则是 Google 明确处理的 cloaking。要做就必须同时新增可见的 FAQ 区块（新 DOM + 新 scss + 新牙），
而工具页的 DOM 契约正被 `check-tools-surface.mjs` 的「DOM」组逐条盯着
（徽章数字必须等于 `*_ACTIONS.length`、面板 `href` ↔ 真实 `id`）。
在另一个会话正改 `toolkit.scss` 的时候往这四页加可见区块，风险收益比不划算。
→ 移到子项目 2（工具产品扩张）与 C4「隐私 banner 抽成共享 include」一起做。

### A7｜归档页 ItemList

**范围比原计划窄：四页收成两页。** 原文写的是 `categories.html` / `tags.html` /
`series.html` / `index.html` 都加 `ItemList`。落地前量了一遍，那两页是纯支出：

| 页面 | 可见详情页链接 | 若发 ItemList：raw 增量 | gz 增量 | 该页 gz 涨幅 | 说得出新事实吗 |
| --- | --- | --- | --- | --- | --- |
| index.html | 8（共 79 篇） | +1,876 B | **+341 B** | +2.2% | 是：`itemListOrder: Descending` = 「这 8 条是全站最新」 |
| series.html | 34 | +10,956 B | **+947 B** | +7.7% | 是：阅读顺序不按时间，可见 `<ol>` 只有编号 |
| categories.html | 102 | +30,205 B | +5,080 B | **+30%** | 否：分组标题与组内链接全在 HTML，组内序就是倒序时间 |
| tags.html | 270 | +117,858 B | +7,790 B | **+35%** | 否：同上，152 组 |

后两页的分组与顺序爬虫顺着 `<a>` 和 `<time>` 全能自己得出，`ItemList` 一个新事实都不加；
而 Google 对裸 `ItemList` 也没有富媒体摘要（富结果只认 `BreadcrumbList` 这个子类型，
以及 Movie / Recipe / Course 的轮播）。所以判据定为
**「这一块声明的东西，可见 HTML 是不是已经说过了」+ 一条 gz 涨幅天花板**，
两页都出局。原计划里「155 个标签 ≈ 12 KB」那句是估的，实测是 422 条 / 118 KB raw，
比估的还差一个量级——这类账必须量，不能推。

**放 `<body>` 末尾，不放 `<head>`。** 新增 `_includes/jsonLdList.html`，
由 `index.html` / `series.html` 各自在 `</main>` 之后引入。
`jsonLd.html` 那一支的块全在 head，而 ItemList 的大小与条目数成正比、不是常数；
放 head 会把 series.html 的头部从 6,283 B 顶到 17,239 B（+174%，口径见 §6），
挤占 §7 那 ~838 B 余量里 A6 还要用的 ~228 B。
JSON-LD 在 body 里对 Google 与 AI 爬虫同样有效（它读整份文档的
`script[type="application/ld+json"]`，不区分头尾）。实测六页 head 逐字节不变。

首页必须**只在 `paginator.page == 1` 时输出**——照抄 `jsonLd.html:119-125` 那道门的写法与理由：
jekyll-paginate 生成的 `/page2/ … /page10/` 复用同一份 `index.html`，不加门就会吐 10 份
互相竞争的实体声明。现有代码已经躲开这个坑，别把它重新踩进去。

合集页刻意**不写** `itemListOrder`（schema.org 只有 Ascending / Descending / Unordered，
「策展的阅读顺序」三个都不对，写哪个都是假话）和 `isPartOf`
（series.html 的 CollectionPage 没有 `@id`，写哪种形态都会新造一个匿名节点）。
两处都照本仓 `page_modified` 那条「没有真值就不说」的口径缺席。

**已验（A/B 两棵产物树，22 条产物级断言全绿）**：`@type` 普查 `ItemList` 0 → 11，
其余六类一个不动；11 块全部 `JSON.parse` 通过；首页 8 条与可见 `<article>` 同序同值，
合集 34 条与可见 `.series-link` 同序同值，`position` 全部从 1 连续，`numberOfItems` 与数组等长，
每条 `url` 绝对且在产物里存在；`/page2/…/page10/` 零块；变更面只有 index / series
（+ `feed.xml` 时间戳、`sw.js` 的 BUILD 号）。

**三颗牙（变异实测，均先自证变异命中再断言）**：

| 变异 | 产物后果 | 被哪条断言抓 |
| --- | --- | --- |
| `paginator.page == 1` → `>= 1` | 10 个翻页视图各吐 1 块首页 ItemList（原为 1） | 2.1 / 2.2 |
| `_data/series.yml` 首条插入对不上文章的 slug | 可见 `<ol>` 变 9 个 `<li>`（8 链接 + 1 缺失提示） | 变异命中的自证 |
| 同上 + 摘掉 `{%- if _sp -%}` 守卫 | 第一块变 9 条，position 1 是 `{"name":null,"url":""}` | 4.1 / 5.4 / 5.5 |

第二颗牙单独跑（只改数据、不动代码）时，8 条 positions 仍是 1..8、坏 slug 一条不进 JSON-LD——
这正是 `jsonLd.html:73-77` 记过的 BreadcrumbList `_crumb_pos` 撞位那一类坑，
跳过条目会让后续 position 留洞。

**SearchAction 本轮不做**：`index-all.html` 零 `<script>`、不支持 `?q=`（§1），
而 `SearchAction` 的 `target.urlTemplate` 指向一个不支持查询的 URL 是无效结构化数据。
→ 移到子项目 3，与 ⌘K 升级一起做（那时让 `?q=` 直接打开面板并预填）。

### A6｜manifest + theme-color

`sw.js` 已经能跑，差的就是这一个文件；补上就拿到「可安装」这个能力位。

**落地形态（与设计稿的三处偏离，都是实测逼出来的）**：

1. 文件名是 `manifest.json` 不是 `manifest.webmanifest`。理由是 MIME 确定性：
   GitHub Pages 的 MIME 表在部署前无从核实，`.webmanifest` 一旦没被认成
   `application/manifest+json`，浏览器**静默忽略整个 manifest**——没有报错、没有日志，
   表现只是「装不上」。`.json` 一定被认成 `application/json`，而 Chrome/Safari/Firefox
   对 manifest 的 MIME 判定接受 `application/json`。用确定的降级换不确定的正确。
2. **不进 sitemap**。设计稿写的「写死 permalink 才能进站点地图」这条理由不成立：
   本站 `sitemap.xml` 是白名单驱动（枚举 `site.posts` + 固定几页），不是「扫全部产物」，
   所以 manifest 天然不在里面，也不需要动它。而且**不该**在——与 `llms.txt` 同一条理由：
   sitemap 是给爬虫的 HTML 页面清单，塞非 HTML 资源进去是噪声。
3. `start_url` = `scope` = `{{ '/' | absolute_url }}`（规范首页 `…/better-blog/`），
   不是 `/index.html`。带 `index.html` 的 start_url 会让安装后的地址栏和 canonical 不一致，
   等于自己造一个重复 URL。

**图标（新增 `scripts/build-manifest-icons.mjs`，产物入库）**：

三枚 PNG——180（apple-touch）/ 192 / 512（manifest）。`apple-touch-icon` 是设计稿之外补的：
**iOS 完全不读 manifest**，主屏图标只认这一个 link，不给它的表现是「添加到主屏幕」
截一张网页图当图标。

- 出图走 headless Chrome 截图（`scripts/og-images.mjs` 已证明这条路可行）。
  本机 `sips` 不认 SVG、无 imagemagick/rsvg。
- 两个实测陷阱写进了脚本文件头：① Chrome 的 `--screenshot` 在 `--headless` 与
  `--headless=new` 两种模式下**都不自己退出**，所以「轮询到文件 + 主动 kill」是设计而不是兜底；
  ② 用 data-URI 塞 SVG 会渲染成**碎图占位符**，而尺寸、字节、sha256 全都「正常」——
  只有把 PNG 打开看才发现。改成把 SVG 标记直接内联进包装 HTML。
- 地址不写死在模板里：`_data/manifestIcons.yml` 是唯一的地址+字节+sha256 台账，
  head 用 `where: 'use', 'apple-touch'` 查表。`--check` 模式**不需要 Chrome**，
  纯读盘对账（源 SVG 的 sha256、每枚的字节/sha256/IHDR 尺寸/colorType、尺寸集合恰好三枚）。

**head 字节记账（实测，不是估算）**：

设计稿估的是 ~228B，实测**每页 head 净增 315B**——估算漏了 apple-touch-icon 那条 link（~90B）。
五页抽样全部 +315，文档 gzip 增量 +81…+147B（head 口径见 §6，gzip 走 `cat f | gzip -9` shell 口径）：

| 页面 | head（base → new） | 文档 gz（base → new） |
| --- | --- | --- |
| `index.html` | 7,659 → 7,974（+315） | 15,535 → 15,616（+81） |
| `2026/09/17/gods-eye-view-keyless.html` | 10,201 → 10,516（+315） | 31,577 → 31,664（+87） |
| `series.html` | 6,283 → 6,598（+315） | 13,299 → 13,385（+86） |
| `tools/json.html` | 7,982 → 8,297（+315） | 11,728 → 11,875（+147） |
| `404.html` | 5,386 → 5,701（+315） | 9,542 → 9,624（+82） |

§1 那 ~838B 余量因此降到 **~523B**。A7 的 ItemList 全部落在 body，head 零增量（见 A7 那张表），
所以余量只剩 A1 的 relatedTools 卡（在 body）与后续切片可能用到——head 这一层目前无人排队。

**已知不完美**：`theme-color` 的 `media="(prefers-color-scheme: …)"` 只能跟系统，
跟不了 `.night-mode` 这个手动 class（`daytimeMode` localStorage 键）。接受它，
并在模板注释里写明这是平台限制而不是遗漏。

**一个 Liquid 空白陷阱（已翻车并修掉）**：这四个控制标签必须「只带前减号、不带后减号」。
后减号会把紧随其后的换行加缩进一起吃掉，于是产物里 `<link rel="manifest">` 直接糊在
`rel="shortcut icon"` 那个 `>` 后面，四条标签挤成一行。功能上无害（浏览器不看换行），
但产物不可读，而且和 §A7 那条「A/B 差异面要干净」的口径冲突。约束写在两份 head 的注释里。

**覆盖范围（普查断言，不是抽查）**：137 个 html 产物 = 走布局的 **102** 个 + 范围外 35 个。
范围外的是 `demo/**` 33 个原样拷贝的静态演示页、另一会话的 `offline.html`、
以及 `googlebed27dc19e414568.html`（Google 站点校验文件，一个字节都不能动）——
三类都不走 `_includes/head.html`，也都不该有安装面。「不该有」写成了断言：
范围外的集合必须恰好等于 `demo/**` ∪ 那两个白名单文件，否则以后新加一个绕过布局的
顶层页面会静默漏网。判据用 `<meta name="base-url"` 这个指纹——它由 `head.html:10` 与
`postHead.html:10` **各自**输出（两份 head 是复制关系不是 include 关系，所以 A6 必须改两处）。

**不碰 `sw.js` 与 `check-sw.mjs`**（另一会话在飞，见 §2）。manifest 是个 832B 的静态文件，
不进 SW 预缓存清单也不影响功能，只是首次安装多一个网络往返。已实测：A6 之后
`node scripts/check-sw.mjs --site=/tmp/a7/_site` 仍是**恰好 1 条红**，且是他们那篇在飞文章的
封面（`gitdiagram-keyless-mcp-4-bad-edges/banner.webp`），与 A6 无关。

**已验**：44 条断言全绿（HTTP 级起真服务核 MIME/可达性/sha256、JSON 形状、head 接线、
102 页普查、A/B 差异面）。差异面断言的结论是「改动 104 个文件 = 102 页 + `feed.xml` + `sw.js`
两个构建期易漂文件，新增 2 项 = `manifest.json` + 图标目录，删除 0 个」。

两颗牙都咬住了（变异先自证落地，再断言变红）：把 `about.html` 的安装面三条整段抹掉 →
普查断言 6.2 与差异面断言 9.3 **同时**变红，且原树未被连带改到（真拷贝不是硬链影子）。
`--check` 那三颗牙见 A6 落地时记录：截断图标 1 字节 → 2 条红；篡改 `source_sha256` → 1 条红；
把声明尺寸 `512x512` 改成 `512x513` → 3 条红。

### A1｜文末「相关工具」卡（自动那一半）

现状：4 个工具页的入口只有顶栏下拉与首页侧栏两处，博客正文里 0 条内链（§1）。
文章的正文权重一条都没有分给工具页。

做法：`_data/onlineTools.yml` 每条补 `match_tags[]`（多个 tag，命中任一即算相关），
新增 `_includes/relatedTools.html`，`page.tags` 与 `match_tags` 求交集，取前 3。

**落地形态（与设计稿的四处偏离，都是实测逼出来的）**：

1. **只补 `match_tags` 一个字段，不补 `post_tag`。** 设计稿写的「顺手解掉 C2」不成立：
   `tools.html:45` 的 `post_tag` 那一支只遍历 `site.data.tools`（浏览器扩展那一族），
   在线工具走的是另一支，而 `tools.html:117-124` **刻意**不给在线工具渲染 `.tool-posts`
   页脚。所以往 `onlineTools.yml` 里加 `post_tag` 只会得到一份没人读的死配置。
   方向也是反的：`post_tag` 是「工具 → 文章」，本件要的是「文章 → 工具」。
2. 渲染位置不是「wrap-up 面板附近」，而是收束面板**之后**、内联相关阅读**之前**。
   `post.html` 那段收束注释原本写着「推荐位不放这里……再加一块只会互相稀释」，
   这次把它改口而不是悄悄推翻：注释真正拦的是「把推荐塞进收束面板**里面**」——
   面板里三颗按钮是「对这一篇做什么」，混进「去看别的」会把结算语气打断。
   本件是面板**外**的独立一块，且是站内工具页不是文章（对象类型不同），
   实测只在 27/78 篇上出现、对其余 51 篇**零字节**，不构成注释所担心的稀释。
   改口理由带日期写进了 `post.html` 那段注释本身。
3. 顺序口径是 **`_data/onlineTools.yml` 的条目顺序**，不是命中数排序，也不是 `index`
   （`onlineTools.yml` 根本没有 `index` 字段）。理由是实测最大命中数只有 2，
   上限 3 从来不会截断，此时再引入第二套排序口径只会让它无声漂移。
4. `idcard` 的 `match_tags` 是**空清单**，这是结论不是待办：79 篇里没有一篇讲身份证 /
   统一社会信用代码 / 银行卡校验或测试数据生成。拿宽 tag 去凑更糟——实测 `前端` 会命中
   5 篇 AI Agent 长文，那 5 枚内链是纯噪声。它归 刀3 的手工文中链（§4 之外那半）。

**判据在数据层，不在样式层**：`| slice: 0, 3` 是 Liquid 截断，多出来的连 DOM 都不进；
无命中时**整块不渲染**，没有兜底——兜底等于给每篇都硬塞 3 个不相关工具，
那是把内链权重稀释掉，比不加更糟。

**命中面（实测，两棵树各算一遍）**：

| 工具 | `match_tags` 枚数 | 命中文章（工作树 79 篇） | 命中文章（HEAD 导出树 78 篇） |
| --- | --- | --- | --- |
| `json` | 13 | 14 | 13 |
| `codec` | 11 | 12 | 12 |
| `diff` | 9 | 5 | 5 |
| `idcard` | 0 | 0 | 0 |
| **并集（有卡的文章）** | — | **28** | **27** |

每篇枚数分布（导出树）：`{0 枚: 51, 1 枚: 24, 2 枚: 3}`；工作树是 `{0: 51, 1: 25, 2: 3}`。
两套数都能对上账：导出树 13+12+5=30 次命中 = 24×1 + 3×2，工作树 14+12+5=31 = 25×1 + 3×2。
`match_tags` 共 33 枚，**每一枚都在语料里活着**——第一版带了一枚死 tag `正则`
（语料 0 篇用它），是靠这条判据量出来的，不是看出来的。

**字节记账（实测，不是估算）**：

| 项 | base → new | 增量 |
| --- | --- | --- |
| 1 枚卡的 24 篇（每篇文档） | — | +789 ~ +819B（gz +133 ~ +262B） |
| 2 枚卡的 3 篇（每篇文档） | — | +1390B（gz +274 ~ +298B） |
| 无卡的 51 篇（每篇文档） | — | **+0B** |
| `assets/css/index.min.css` | 135,164 → 138,179 | +3,015B（gz 19,532 → 19,747，+215B） |

有卡的 27 篇文档均值 +866B。A/B 差异面 `changed=29 added=0 removed=0`
——27 篇有卡文章 + `index.min.css` + `feed.xml`，html 之外的改动只落在 `assets/` 里。

**两个踩到并留档的 Liquid 陷阱**：

- Liquid **会解析 `{% comment %}` 体内的块标签**。include 的文件头注释里写了字面量
  `{% if %}` / `{% include relatedTools.html %}` 举例，构建期直接炸：
  `Liquid syntax error (line 23): Syntax Error in tag 'if'`。本文件是仓库里第一个
  踩到并把结论写进文件头的地方（`head.html` 没有这条记录，全仓 grep 也没有）。
- 末尾那枚控制标签的减号是量出来的，不是顺手写的。原来收在 `{% endif %}`，
  于是**文件最后那个换行无条件漏进产物**，51 篇无卡文章各多 1 字节，
  A/B 的「改动的 html 正好是有卡那些」当场变红（78 篇全红）。改成 `{%- endif -%}`
  后无命中一支输出 0 字节。牙齿 A 咬的就是这一处。

**四颗牙（`/tmp/a1/teeth.py`，32 判据全绿；每颗都先自证变异落地再看判据转红）**：

| 牙 | 变异 | 落地自证 | 转红的判据 |
| --- | --- | --- | --- |
| A | `{%- endif -%}` → `{%- endif %}`（只摘后减号） | md5 变、新旧串互换、锚点带 `</section>` 才唯一 | 51 篇无卡文章各 +1B（实差 51，增量集合 `{1}`） |
| B | `{%- if related_tools.size > 0 %}` → `{%- if true %}` | 同上 | 78 篇全有容器，其中 51 篇是 0 个 `li` 的空壳 |
| C | 给四条工具各塞同一枚 `jekyll`，再摘掉 `\| slice: 0, 3` | 字符串计数 4 处 + **yaml 视角**四条都含该 tag | C1 只出 3 条且是 yml 顺序 `[idcard, codec, json]`；C2 摘切片后 4 条全出 |
| D | `- pnpm` → `- pnpmNOTATAG` | 同上 | 死枚集合正好是 `[('json','pnpmNOTATAG')]` |

牙 C 必须先造出 4 枚命中才看得见——现语料最大命中数是 2，上限 3 在真实数据下
**永远不会被触发**，直接对它写断言等于写一颗没有咬合面的假牙。

产物判据 59 条见 `/tmp/a1/verify-a1.py`（全绿），其中阶段 5 逐文件比对 78 篇的
`.related-posts` 整块与基准**逐字节等值**——新卡是加进去的，不是把老那块挤走的。

**真浏览器核验（1440 视口，`/2026-09-21/pnpm-task-settings.html`，两枚卡那一档）**：
图标外框 36×36、`box-sizing: border-box` 实测生效（反事实：改回 content-box 立刻 48px）；
两枚卡等高 68px、列间 gap 合计 10px；`elementFromPoint` 命中测试落在 `<a>` 内（真点击可达）；
`opacity: 1` 且**没有** `.reveal` 类——印证「不进 REVEAL_SELECTOR」那条决定在产物里成立，
禁脚本 / 无 IO 的抓取器直接看得见；前后邻居是 `read-next` 与 `related-posts`。
两条反事实实验（box-sizing、min-width:0）已固化成 verify-a1 阶段 4 的结构判据，
口径与数字写在 `editorial.scss` 那两处的注释里。

### B1｜三个统计脚本去同步

`seoScript.html:2-4` 三条各加 `defer`。

`defer` **保持相对顺序**，所以 `baiduStatistics → baiduPush → soPush` 之间可能存在的
全局依赖（如 `_hmt`）仍然安全。这三个都是统计 / 推送，没有任何必须阻塞解析的理由。

**jQuery 不动**（`headAssets.html:50` 的既有决定）。

改的是性能基线，所以前后各量一次 head 阻塞脚本数与 LCP，写进 §6。

### B2｜PNG→webp 转码 + 构建期换源（as built，与原设计有一处机制替换）

**范围**：`assets/**/*.png` 里 >512KB 的 23 张候选，实际转 20 张，省下 **29.8MB**。
另外 3 张（`assets/img/ai-sdd/banner-{2,4,5}.png`，合计约 4.9MB）在 `_posts` / `_data` /
`_layouts` / `_includes` 四类源文件里零命中——是死资产，不转，也不删（删文件不在本批授权范围）。
阈值 512KB 是脚本常量 `SIZE_FLOOR`，可复算。

**四处与批准稿不一样的地方，逐条说明**：

1. **编码器不是 `cwebp`**。本机 `cwebp 1.5.0` 编译时没带 libpng（`Unsupported file type`），
   而这一批全是 png。换成 `ffmpeg -c:v libwebp -quality 82 -compression_level 6 -preset drawing`，
   参数字面写进脚本常量 `ENCODER` 与台账的 `encoder` 栏——两处不一致时台账作废重转，
   `--check` 会单独报这一条。
2. **机制从「注入 `<picture>`」换成「构建期直改 `src`」**。原稿要在 `<img>` 外面包一层
   `<picture><source type="image/webp">`，落地前发现它与一件已上线的东西硬冲突：
   `dev/js/editorial.js` 的揭示选择器是 `#post-body p:has(> img[loading="lazy"])`，
   `>` 是直接子级，img 一旦进了 `<picture>` 这条再也匹配不到，正文里几十张图的升起动效
   会**静默**消失（不报错、不变红，只是没了）。而 `editorial.js` 与 `verify-motion-batch4.mjs`
   都在本批禁改清单里。webp 的基线支持（Safari 14+，2020-09）让 `<source>` 那层回退在这里
   值约等于 0，所以选了换源：**DOM 形状不变**，motion 批 IV 与 `article-check` 的判据全部继续有效。
3. **多开了一档 `'swap'`，给「上一篇/下一篇」的封面缩略图**。那两颗 `<img>` 原本不过滤镜，
   而它们引用的恰恰是最大的那几张（`banner-3` 1580KB→50KB），运行时又真会被 `fadeIn` 显示出来。
   只肯换源、不补 `width/height`：`dev/js/index.js` 的 `postCover()` 用 `img.height()`
   与容器高 260 比大小来决定走 `width:auto` 还是 `margin-top` 那条分支，而 CSS 里它们起手是
   `display:none`，量到 0；补上尺寸属性会让它突然量到 592，分支就此翻边——那是视觉改动，不在本批。
   真浏览器两侧都量过：缩略图 `width 469.758px / marginLeft -32.379px / natural 2880×1594`，
   base 与 new 逐字相同，只有 src 的后缀不同。
4. **CI 不跑转换**：`.github/workflows/jekyll.yml` 里没有转码步骤，也不该加（CI 装 ffmpeg
   属于另一件事）。`.webp` 与那本 `scripts/image-variants.json` 台账**一起进仓库**
   （仓库本来就有 87 张已跟踪的 webp，`*.webp` 不在 ignore 里）。所以约束是「改了大图就得本地重跑一次」，
   而 `node scripts/build-image-variants.mjs --check` 就是盯着这条的门。

**核验中抓到并修掉的两个自己的缺陷**：

- 换源后的 src 丢了 `baseurl` 前缀，产物里 27 个 `<img>` 会变成 `/better-blog` 站点上的 404。
  是 `verify-b2.py` 的 A8 那条抓的（`webp_sibling` 原本返回仓库相对路径，而那个返回值要直接写回 HTML）。
  修法：返回「把 src 结尾那一处 `.png` 换掉」之后的 src 本身，前缀原样留着。
- `check()` 里那条编码器比对是**死码**：`loadManifest()` 在参数漂移时已经把台账当作废返回
  `{ variants: {} }`，于是后面读到的 `manifest.encoder` 恒等于脚本常量。症状是参数一改就冒出
  20 条「有 webp 兄弟却不在台账里」，把方向指错。修法：在 `check()` 开头单独读一次原始 JSON 比对，
  并把那条不可达的删掉。是牙齿 t12 抓的。

**字节账**（`_site` 产物里逐张按 src 解析到磁盘文件求和，base=HEAD 树 / new=工作树覆盖）：
发生换源的 11 页，本地图引用字节 **62.8MB → 14.8MB（省 48.0MB）**；最重的一页
`2026/06/28/account-password-helper-new.html` 20.25MB → 1.98MB。

**验证**：产物级 `verify-b2.py` **2397 条断言全绿**（两棵 `git archive HEAD` 快照树对建，
除 `_plugins/image_dims.rb` 与 `_layouts/post.html` 两处覆盖 + 20 张 webp 之外两树逐字节相同）；
滤镜单元级 `unit-dims.rb` **24 条**（外链 / 协议相对 / `data:` / 模板变量 / 带 query /
目录名含 `.png` / 已有尺寸 / 自闭合 / 单引号九种形状）；牙齿 `teeth-b2.py` **33 条 / 13 颗**
（8 颗滤镜变异 + 5 颗转换器变异，每颗都先自证变异落地、且要求指定那条判据变红而不是别的）。
其中一条全局判据值得单记：**全站 135 页去掉标签后的可见文本零变化**，这一批只动属性。

**明确不做**：把 png 从发布产物里排除（`_config.yml` 的 `exclude`）。那是二段式的第二刀，
要连带 `assets/img/og/` 那条独立流水线一起决定，且会动 `_config.yml`（另一会话正 staged 着它）。

### B3｜CSS 按页拆包 —— 本轮不做

理由见 §2（与另一会话的 `dev/sass/toolkit.scss` 同族冲突）。

留档待做的三个不确定性：

1. `editorial.scss` 靠「同特异性、后加载覆盖」生效，拆分后加载顺序必须显式保证
2. 工具页也用 `layout: default`，header / footer 依赖 editorial 样式——
   **工具页到底需不需要 editorial 包，要先量再定**，不能拍脑袋
3. `postcss-px-to-viewport` 的 ~40 条 `selectorBlackList` 按选择器文本匹配，
   拆包不改选择器所以仍生效；但新拆出的文件若引入新的块级选择器，
   不进黑名单会被 px→vw 缩放。且改 postcss/vite 配置后必须重启 `pnpm dev`
   （watch 里的 vite 会缓存旧配置）

## 5. 数据流

```
git 历史 ──┐
           ├─ scripts/build-modified-data.mjs ─→ _data/modified.yml ─┬→ pageModified.html ─┬→ seoMeta.html (page_modified → article:modified_time)
_posts/*.md┘                                                          │                     ├→ jsonLd.html  (dateModified)
                                                                      │                     └→ sitemap.xml  (lastmod，缺条目回落 post.date)
                                                                      └（口径只有这一处，见 pageModified.html 文件头）

paginator.posts ─→ _includes/jsonLdList.html list='home'   ─→ index.html  </main> 之后（仅 paginator.page == 1）
site.data.series ─→ _includes/jsonLdList.html list='series' ─→ series.html </main> 之后（每合集一块，@id 挂 section 锚点）

_data/onlineTools.yml ─(+post_tag / match_tags / tool_slug 由页面 front matter 提供)
        │
        ├→ _includes/jsonLdTool.html  (WebApplication)
        └→ _includes/relatedTools.html ─→ _layouts/post.html (wrap-up 附近)

assets/img/**/*.png (>512KB, 非 og/, 且被四类源文件引用)
        │
        ├─ scripts/build-image-variants.mjs ─→ 同名 *.webp（入库）
        │            └─ scripts/image-variants.json（sha256 + 双边字节 + encoder 台账；--check 是门）
        │
        └──────────→ _plugins/image_dims.rb ─→ 构建期把 src 的 .png 换成 .webp
                     （三档：缺省只补尺寸/lazy；'lcp' 给首张 eager 图补 fetchpriority=high；
                       'swap' 只换源——给 read-next 缩略图，避免 postCover 量到高度翻分支）

favicon.svg ─→ scripts/build-manifest-icons.mjs ─┬→ assets/img/icons/icon-{180,192,512}.png（入库）
   （headless Chrome 截图；--check 模式不需要 Chrome）  └→ _data/manifestIcons.yml（地址+字节+sha256 台账）
                                                            │
                       ┌────────────────────────────────────┴───────────────────┐
                       ↓                                                        ↓
             manifest.json（只取 use=manifest 的 192/512）        head.html:32-38 / postHead.html:24-30
                       ↑                                        （查 use=apple-touch 取 180，两条 theme-color）
             permalink: /manifest.json，不进 sitemap
```

## 6. 验收口径

**门禁化 + A/B 实测，两者都要。**

新增：

- `scripts/check-seo.mjs` + `scripts/check-seo-teeth.mjs`
- 图片这一路的门分两半：台账一致性直接复用 `build-image-variants.mjs --check`
  （它自己就是「不转、只核对」的模式，不再另造一个 `check-image-variants.mjs`），
  牙齿放 `scripts/check-image-variants-teeth.mjs`；滤镜那三档行为放
  `scripts/check-image-dims.mjs`（用桩站点直调滤镜，毫秒级，形状想造多少造多少）+ 同名 `-teeth`

每颗牙自证「变异就会变红」，照 `check-tools-surface-teeth.mjs` 那 74 颗的既有形态。

`check-seo.mjs` 的断言组：

| 组 | 断言 |
| --- | --- |
| keywords | 有 tags 的页面输出 tags；无 tags 的页面**不输出**该 meta；任何页面都不再输出 `site.keyword` |
| modified | `_data/modified.yml` 每个 key 都对应真实 post.url；每个 `at` ≥ 该篇 `date`；`--verify` 模式重算指纹比对，防 yml 腐烂 |
| 诚实性 | 规范化前后哈希相同的提交**不许**进 yml（「一次全站 prettier 不许把 80 篇顶到今天」那颗牙） |
| JSON-LD | 四个工具页各有 WebApplication，其 `name` == 渲染出的可见 `<h1>`；`index.html` 有 1 块 ItemList 且与可见 `<article>` 同序同值，`series.html` 的块数 == 可见 `<section>` 数、每块与对应 `<ol>` 同序同值 |
| ItemList 位置 | 11 块全部在 `</head>` 之后（body 末尾），六页 head 字节与不发 ItemList 时逐字节相同；`categories.html` / `tags.html` **零块** |
| 分页门 | `/page2/ … /page10/` **不输出** WebSite / Blog / Person / ItemList |
| head | `<head>` 里同步 `<script src>` 数 == 1（只有 jQuery）；`seoScript` 三条都带 `defer` |
| manifest | 文件存在、JSON 可解析、`start_url` == `scope` == 规范首页 `https://liaolongdong.github.io/better-blog/`（防 baseurl 漂移）、`short_name` ≤ 12 字符、`display: standalone`、两个色值 == `tokens.scss` 的 `--paper` 明暗两档、icons 恰好 192+512 两枚且 HTTP 200 / `image/png` / 字节与 sha256 都对得上 `_data/manifestIcons.yml`；**不进 sitemap** |
| 安装面接线 | 走布局的 102 页每页恰好 1 条 `rel="manifest"` + 1 条 `apple-touch-icon`（指向 180 那枚）+ 2 条 `theme-color`（明暗各一、值对），且 manifest link 排在第一个 `rel="stylesheet"` 之前；范围外的 35 个产物（`demo/**` 33 + `offline.html` + Google 校验文件）**一条都不许有**，且这个范围外集合必须恰好等于 `demo/**` ∪ 那两个白名单文件 |
| 图标台账 | `build-manifest-icons.mjs --check` 不需要 Chrome：源 SVG 的 sha256、每枚的字节/sha256/IHDR 宽高/colorType==6、尺寸集合恰好 {180,192,512} |
| 换源（B2） | 产物里**零** `<picture>`（这条是揭示动效的保险，不是风格偏好）；每个换过去的 src 都带 baseurl 且在磁盘上真实存在；除 src 与至多一枚 `fetchpriority=high` 之外标签逐字不变；`p > img[loading=lazy]` 命中数两树逐页相等；`fetchpriority` 只在文章页、每页至多一枚、有封面落在头图 / 无封面落在正文首图、且那一枚不带 `loading`；read-next 缩略图除 src 外不长出任何属性；`--check` 台账对得上（缺文件 / 字节漂 / sha 漂 / 编码器漂 / 有候选没转，五种各一颗牙） |

A/B 实测三个数：**LCP、head 字节、图片字节**。

口径写死，跨口径比对禁止：

- 字节用 `cat f | gzip -9` 的 shell 口径，**不用 zlib API**（两者数字不同，本仓已定过这条）
- **head 字节**：`<head>` 起、`</head>` 止，含这两个标签本身、不含其后的换行；
  取法是 `re.search(r'<head>.*?</head>', s, re.S).group(0)` 再按 UTF-8 求长。
  这条必须写死——同一页在三种口径下分别是 6,270 / 6,283 / 6,284（不含标签 / 含标签 /
  含标签再带 `sed` 行尾那个换行），差 14 B 就足以让两节引用的数字互相打脸。
  A7 那节早先引的 6,284 是 `sed` 口径，已按本条改成 6,283。
- LCP 用 headless Chrome trace，量之前先清遗留进程与端口（孤儿 runner 会污染测量）
- `setDeviceMetricsOverride` 并自证 `innerWidth`（headless 默认视口不是桌面尺寸，
  否则量到的 `display:none` 是假缺陷）
- Jekyll 快照用 `--baseurl ""`（否则样式全 404）；CDP 开 `setCacheDisabled`
- 起本地服务用 `port=0` 且**只认子进程自己报出来的那个端口**（固定调试端口会连上遗留 Chrome）。
  两个坑各挂死过一轮，都写在这里：① python `http.server` 把「Serving HTTP on … port N」
  用 `print` 报到 **stdout 不是 stderr**；② stdout 接管道时子进程是块缓冲的，
  那 60 个字节躺在缓冲区里永远不刷，必须给子进程加 `-u`。
  读端口的那一行之前不要有任何会永久阻塞的调用，且起服务后要挂 `atexit` 兜底 kill
  （两轮挂死共留了 5 个孤儿 server；本机是共享的，清理只能按 pid，不许宽匹配 pkill）
- 先断言 `curl` 到的产物 md5 == 磁盘 md5（旧 http.server 占端口会让 A/B 量到旧产物）
- A/B 的两棵树之间要断言**差异面**，不只断言目标指标：改动集必须 ⊆ 预期集，
  新增集必须 ⊆ 预期集，删除集必须为空。`feed.xml`（带时间戳）与 `sw.js`
  （另一会话的插件在构建期生成）是两次独立构建之间天然会漂的两个文件，进白名单。
  归一化 `diff -rq` 的 `Only in` 行时别用 `lstrip('./')`——`../_site/x` 会被啃成 `_site/x`，
  自己写的归一化会骗过自己那条断言

收口跑**全量**既有门禁，不是只对改动文件跑：
`toolkit-tests.mjs`（439）+ `check-tools-surface[-teeth]`（74）+ `verify-nav-touch` +
`verify-plan-blocks[-teeth]` + `article-check`。

## 7. 明确不做（YAGNI）

- 不做 AVIF：本机无 `avifenc`，`ffmpeg` 无 AV1 编码器；加 `sharp` 到 devDeps 是另一个决定
- 不做多尺寸 srcset：同上
- 不做 FAQPage：需要配套可见区块，与另一会话的 `toolkit.scss` 冲突 → 移子项目 2
- 不做 SearchAction：`index-all.html` 不支持 `?q=` → 移子项目 3
- 不做 critical CSS 内联：撑破 §1 的 ~838B head 红线
- 不做 B3 CSS 拆包：§2 并发冲突
- 不动 jQuery 同步加载：`headAssets.html:41,49,50` 有明确注释与 sha256 自证，是刻意决定
- 不做 i18n / hreflang：站是纯 zh-CN，无 `/en/` 树
- 不碰 A4 / A8 / A9：归子项目 4
- 不碰 `verify-motion-batch4.mjs` 的删除状态：那是另一会话的事
- 不碰 `sw.js` / `check-sw.mjs`：同上

## 8. 交付实录（SP1，2026-10-02）

### 8.1 提交段

基线 `259af88` → `ac778ed`，11 个提交，全部落在本仓 `main`，**未推送**（推送不在本轮授权范围内）。

| 提交 | 内容 |
| --- | --- |
| `6d72f96` | A5 keywords 逐页取 `tags`（`site.keyword` 那条全站同串从此不再输出）+ A3 `dateModified` 从 git 历史导入 `_data/modified.yml`，指纹门控 |
| `f802771` | B1 三条统计/站长推送脚本改 `defer`；`soPush.js` 顺带拆掉 `document.write` |
| `34ef81a` | A2 四个工具页 WebApplication JSON-LD |
| `89e87a5` | A7 首页与合集页 ItemList（落 body 末尾，head 逐字节不动） |
| `d0fa3aa` | A6 安装面：`manifest.json` + 180/192/512 三枚图标 + 明暗两档 `theme-color` |
| `6f6a005` | A1 文末「相关工具」卡（自动那一半） |
| `120e0fe` | B2 图片换源：20 枚 >512KB 的 png 转同名 webp，构建期直改 `src` |
| `a08ca6e` | `check-seo.mjs` 十组判据 + `check-seo-teeth.mjs` 137 颗牙 |
| `e359977` | 修 `_plugins/image_dims.rb` 的 viewBox 退路（写下来就没生效过） |
| `161eff2` | 滤镜单元门禁 `check-image-dims.rb`（36 断言）+ 27 刀；台账牙齿 15 刀；堵两处「静默空转」+ 一处编码器标签漂移 |
| `ac778ed` | 段2 计划镜像跟着 `_data/onlineTools.yml` 落齐——收口回归揪出的是 `6f6a005` 自己挖的坑 |

### 8.2 门禁台账（收口第二遍，逐道退出码）

第二遍相对第一遍改了两件事：`nav-touch` / `motion-batch4` 的入口换成**快照自己的** `scripts/`
（它们各自有「服务的字节 == 磁盘」的同源自证，指工作树就会被并发会话的 watcher 打假红），
`seo-teeth` 显式指到导出树（同一条理由）。台账全部引门禁自己打印的那一行：

| 道 | 命令 | 打印出来的账 | rc |
| --- | --- | --- | --- |
| toolkit | `node scripts/toolkit-tests.mjs` | `# tests 439 / # pass 439 / # fail 0` | 0 |
| seo | `node scripts/check-seo.mjs --root=$S --site=$S/_site` | 10 组全绿；135 页 / 78 篇文章页 / 101 页带安装面；ready 工具 4 条、修订台账 45 条、换源台账 20 条；JSON-LD 205 块全部可解析 | 0 |
| seo 牙 | `node scripts/check-seo-teeth.mjs --root=$S --site=$S/_site` | `137/137 组变异如期变红（748.1s）`，还原后基线仍绿 | 0 |
| 图标台账 | `node scripts/build-manifest-icons.mjs --check` | 3 枚通过（不需要 Chrome） | 0 |
| 图片台账 | `node scripts/build-image-variants.mjs --check` | `ok（20 条，省下 29.8MB）` | 0 |
| 图片台账牙 | `node scripts/check-image-variants-teeth.mjs` | `15/15 刀变异如期变红` | 0 |
| 滤镜单元 | `ruby scripts/check-image-dims.rb "$PWD"` | `ok（36/36 条断言，台账 20 对）` | 0 |
| 滤镜单元牙 | `node scripts/check-image-dims-teeth.mjs` | `27/27 刀变异如期变红` | 0 |
| 工具收录面 | `node scripts/check-tools-surface.mjs --site=$S/_site` | 4 条 ready 条目 × 5 组判据全绿 | 0 |
| 工具收录面牙 | `node scripts/check-tools-surface-teeth.mjs` | `74/74 组变异如期变红` | 0 |
| 计划镜像 | `node scripts/verify-plan-blocks.mjs` | 76 个已落地镜像（1,636,297B）逐字节全等，未落地 0 节 | 0 |
| 计划镜像牙 | `node scripts/verify-plan-blocks-teeth.mjs` | `41/41 通过` | 0 |
| 触屏下拉 | `node $S/scripts/verify-nav-touch.mjs` | 判据 77 条 红 0 · 牙齿 10/10 | 0（见 §8.7） |
| 揭示动效 | `node $S/scripts/verify-motion-batch4.mjs` | 收口这一遍被负载挡下，见 §8.7 | 2 → 前一遍 0（93 通过） |

`article-check.mjs` 这一遍不适用：它是**逐篇正文**的门（`node scripts/article-check.mjs <正文.md>`），
本期没有新增或改写任何一篇正文，A1 那张卡是布局/include 层的。

### 8.3 A/B 实测三个数

两棵树同一次构建脚本产出：`before` = `git archive 259af88`、`after` = `git archive ac778ed`，
各自软链工作树的 `node_modules` 与 `vendor`（两者都不入库，导出树里没有），
再各跑 `npx vite build` + `bundle exec jekyll build --baseurl ""`。

差异面先断言（不只断言目标指标）：`diff -rq` 得到 Only-in-before **0** 条、
Only-in-after **22** 条 = 20 枚 webp + `assets/img/icons/` + `manifest.json`，
`Files … differ` **123** 条 = 119 个 html + `index.min.css`（新增 `.related-tools` 那一族）
+ `soPush.min.js`（拆 `document.write`）+ `feed.xml` + `sitemap.xml`（后两枚是构建时间戳，白名单）。

**① 图片字节**——台账那 20 对在两棵树里的实际磁盘字节：

- `33.07 MB → 3.27 MB`，Δ **−29.80 MB（−90.1%）**
- 最大单枚 `05-framework-architecture.png`：`7.13 MB → 0.35 MB`
- 候选口径照脚本写死：扫 `assets/` 全树的 `.png`、排除 `assets/img/og/`、单枚 >512KB，共 **23** 枚；其中 **3** 枚
  （`ai-sdd/banner-{2,4,5}.png`，合计 **4.83 MB**）在 `_posts/_data/_layouts/_includes` 里没有任何引用点，
  按「死资产不转」留着——不转也不删，删除是另一个决定

**② head 字节**——口径按 §6 写死：`<head>` 起、`</head>` 止、含这两个标签本身、不含其后换行；
压缩一律 `cat f | gzip -9 | wc -c`（不是 zlib API）。两侧都有 head 的页 **134** 个（两树各 135 个 html，
唯一没有 `<head>` 的那页是 Google 校验文件 `googlebed27dc19e414568.html`）：

| 口径 | before | after | Δ | 均/页 |
| --- | --- | --- | --- | --- |
| 裸字节合计 | 1,018,026 | 1,043,940 | **+25,914** | +193.4 B |
| `gzip -9` 合计 | 399,463 | 401,618 | **+2,155** | +16.1 B |

- 变大的页 101/134；一字未增 **15** 页，另有 **18** 页裸字节反而**变小**（各 −160 B）。
  这 15 + 18 = **33** 页逐页点过名，合起来恰好就是 `demo/**` 那 33 个产物：它们在安装面范围外
  （`接线` 组判定的正是「范围外一条都不许有」），其中 18 个还因为 A5 不再输出那条全站同串的
  `site.keyword` 而净减 160 B。`/pageN` 不在「未增」里——它们照样领安装面那三行。
- 最大单页增幅 `tools/diff.html` **+1,693 B**（A2 的 WebApplication + A6 三行 + A5 keywords 叠在一页）
- **37 页压缩后反而更小**：新增的是与页面里已有串高度重复的 meta/JSON-LD，gzip 几乎不收钱——
  「+193 B/页」和「+16 B/页」是同一件事的两个口径，wire 上真正多出来的是后者
- A7 的 ItemList 按设计落 body 末尾，对 head 的贡献实测为 0（`ItemList 位置` 组 18 颗牙盯这条）

**③ LCP**——headless Chrome（`--remote-debugging-port=0` + `--proxy-server=direct://` +
`--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1`），两棵各起一个 `port=0` 的本地服务，
只认自己那次的端口；`Network.setCacheDisabled`；观察器经 `Page.addScriptToEvaluateOnNewDocument`
注入（`buffered:true`），每格取**中位数**，两棵**交替**采样；
视口 `desktop 1280×800` / `mobile 390×844`（dpr 1，`innerWidth` 逐档自证 = 1280 / 390）；
未节流每格 7 次，fast3g（RTT 150ms / 下 1.6Mbps / 上 750kbps）只在桌面、每格 3 次。
每格样本带一枚 nonce（`?probe=节流档.轮.页序.棵`），读回来的文档 `location.search` 不含这枚 nonce 就整轮退 2。

| 视口/网络 | 页面 | before 中位 | after 中位 | Δ |
| --- | --- | --- | --- | --- |
| desktop fast3g | `2026/06/05/ai-sdd.html` | 20,780 | 3,956 | **−16,824（−81.0%）** |
| desktop fast3g | `2026/06/15/webmcp-vs-puppeteer.html` | 21,976 | 3,532 | **−18,444（−83.9%）** |
| desktop fast3g | `2026/05/25/account-password-helper.html` | 9,700 | 6,148 | **−3,552（−36.6%）** |
| desktop fast3g | `tools.html`（对照，两棵同源同字节） | 3,868 | 3,676 | −192 |
| desktop fast3g | `index.html` | 2,424 | 2,476 | +52 |
| desktop 未节流 | 三篇封面页 | 1,540 / 1,288 / 1,332 | 1,132 / 960 / 1,188 | −408 / −328 / −144 |
| mobile 未节流 | 首页 / 三篇封面 / 对照 | 196 / 1,216 / 452 / 600 / 320 | 180 / 996 / 484 / 572 / 292 | −16 / −220 / +32 / −28 / −28 |

- **只有 fast3g 那一档能报**。未节流两档里本地服务不是瓶颈，每格 7 次的离散区间两侧大幅重叠
  （例：`ai-sdd` desktop before `276…6172` / after `216…2224`），而**对照页**同一档就有
  desktop +124 / mobile −28 的摆动——所以未节流那两档只能说「没变差」，不能说「快了 400ms」。
- `index.html` 的 LCP 元素是 `SPAN`（文字），换源管不到它；对照页 `tools.html` 两棵的 LCP 资源
  逐字节相同（102,261/102,056），它的 Δ 就是这套量具的噪声底。
- 自证四道全 **0/170**：`fromDiskCache`/`fromServiceWorker` 旗子亮的样本、CDP 报的字节与磁盘字节差
  >300B 的样本、没拿到 LCP 条目的样本、`readyState` 未落 `complete` 的样本；
  服务端到的 `index.html` md5 == 磁盘（before 77,078B / after 78,997B）。

### 8.4 与原设计的偏离（三处，都不是顺手）

1. **门禁文件名**：§6 的门禁清单里早先写的是 `scripts/check-image-dims.mjs`，落成 `scripts/check-image-dims.rb`
   （牙齿侧仍是 `check-image-dims-teeth.mjs`）。被测对象是 Ruby 滤镜，Node 要直调它只有两条路：
   起 bundler（把门禁绑死在 `vendor/bundle` 上），或 shell 出去跑 `ruby`（Node 只是层壳）。
   纯 Ruby、不 `require 'bundler'`，启动 ~0.2s，夹具走 `Dir.mktmpdir`，形状想造多少造多少。
2. **webp 编码器**：本机没有 `cwebp`，改用 `ffmpeg -c:v libwebp -quality 82 -compression_level 6 -preset drawing`。
   编码器串进台账顶层 `encoder` 字段，`--check` 逐条比的就是它；「编码器漂」那颗牙盯这条。
3. **B2 的机制替换**（`<picture>` → 构建期直改 `src`）已记在 §4 的 B2 标题里，这里只补一句为什么它不是风格偏好：
   产物里**零 `<picture>`** 是一条判据，因为 `dev/js/index.js` 的 `postCover()` 按量到的高度分支，
   而 `<source>` 换源会让它量到另一张图。

### 8.5 过程里揪出并修掉的缺陷（12 处）

门禁侧 8 处（都在 `a08ca6e`，写牙的过程把它们一颗颗撞出来的）：
崩溃时结果不落盘、IHDR 长度没校验就当 PNG 读、`match_tags` 当标量比、`start_url` 用 `.includes` 而非全等、
manifest `href` 拿字面串比、缺页与 sitemap 两处判据空转、`paperTokens` 同块重复失明、
`dev/js` 推送脚本的路径与注释里的假阳性。

产品与工具侧 4 处：

- `e359977`：`image_dims.rb` 的 viewBox 退路——`root[/re/]` 返回**整段命中串**而非 `MatchData`，
  `box[3]` 取到的是那串里的第 4 个字符，`to_f` 恒 0.0，这支退路从写下来就没生效过。
- `161eff2`：台账里编码器标签与实际调用串漂移（改一边不改另一边的老毛病）。
- `161eff2`：两处「静默空转」——候选清单为空、或候选无一被引用时，`--check` 会绿灯着什么都不核对。
- `ac778ed`：`6f6a005` 往被计划镜像逐字节盯住的 `_data/onlineTools.yml` 追加了 61 行，
  收口回归的 `plan-blocks` 因此红——**红的是我自己那一刀**，第一遍还差点把另外两道的 exit 2 一起算成产物问题。

### 8.6 量具自己踩的四个坑（都写进了代码注释）

1. CDP `Runtime.evaluate` 的形状是 `{result:{value:…}}`；直接解构 `{value}` 得到 `undefined`，
   于是「等 `readyState` 落 complete」那一圈每格都跑满上限——看着像页面慢，其实是量具没读到值。
2. 裸 CDP 类只把请求塞进 `pending`、没挂 `message` 监听把报文认 id 递回去：
   第一条 `Target.createTarget` 的 Promise 永不落地，整个测量**静默挂死**到闹钟响，一行输出都不出。
3. `Page.navigate` 之后第一次读 `document.readyState` 拿到的还是**上一份**文档（已 `complete`），
   循环立刻跳出，读的是上一页的观察器数组——所以每格必须有 nonce，且读回来的 `location.search` 必须含它。
4. 每一次 CDP 调用套 30s 上限 + `uncaughtException` 收尸；导出树必须软链 `node_modules` 与 `vendor`
   （`.bundle/config` 把 `BUNDLE_PATH` 指到 `vendor/bundle`，而 `vendor/` 不入库）。

### 8.7 两道 Chrome 门禁在收口这一遍的实情

这一遍的负载不是空的：`sysctl -n vm.loadavg` 读到 30–47，另有会话的 watcher，
以及两个属于兄弟仓、卡了 1 小时 40 分以上的 `--dump-dom` Chrome（pid `74201` / `75008`，
按 pid 记着没动它们——本机共享，不许宽匹配 `pkill`）。

- `nav-touch`：HEAD 快照连跑 3 次 = 绿 / 红 1 条 / 绿，全绿那两次是 `判据 77 条 红 0 · 牙齿 10/10`。
  中间那次红的是「页面零报错」，内容是 `InvalidStateError: Transition was aborted because of invalid state.
  Viewport size changed`——改视口时撞上一次在飞的 View Transition，属时序而非产物。
  另有一次牙齿（`退回旧的两段式`）探针抛 `null.tagName`。**归因不靠猜**：同一份
  `verify-nav-touch.mjs`（`git diff --name-only 259af88..HEAD -- scripts/verify-nav-touch.mjs` 为空，
  两棵树里的两份 `diff -q` 也相同）跑在 `259af88` 导出树（同样 vite + jekyll、同样 `has-sub` 那枚标记在位）上，
  连跑 4 次 = 挂 / 挂 / 全绿 / 全绿，挂的位置同样是 `probeDesktop` 那一行。所以这道门禁的桌面档探针本身 flaky，
  与本期差异无关，移交触屏档那一格的所有者；收口以全绿那一次计。
- `motion-batch4`：连试 4 次全部 exit 2，且是它自己那条设计好的拒绝——
  `采样密度不足：300ms 只读到 48 / 73 / 34 / 35 帧`，写明「机器此刻不空……不看产物，等空了重跑」。
  它拒绝假红是对的；本期这一遍**没有拿到**它的绿，前一遍空机时拿到过 `93 通过`（那份输出没落盘，
  所以这里只算「前一遍绿、这一遍被负载拒」，不合并成一句「全绿」）。

### 8.8 未做与移交

- 一处**刻意留下的没牙**：`check-image-dims.rb` 把台账对数打在那行 `ok（36/36 条断言，台账 20 对）` 里，
  但没有把它钉成 20。空台账那条有牙（`harness '台账里没有一条转出 webp 的条目，S4 无货可对'`，退 2 不是退 0）；
  「台账从 20 对缩到 5 对」这种漂不归它盯，归 `build-image-variants.mjs --check` 那 11 处判据——
  候选层与引用层都在那儿对账，这里再钉一个魔法数只会让两道门互相甩锅
- 子项目 3：D2 View Transition 形变、D3 ⌘K 升级、SearchAction（`index-all.html` 现在不支持 `?q=`）
- 子项目 2：C1 新工具、C2 工具页 `post_tag`、C3 可分享 URL 态、C4 隐私条、C5 历史/批量/快捷键、
  FAQPage、Software App 富结果需要的真实评分源
- 子项目 4：A4 `seo_description` 回填（约 39 篇）、A8 构建期 TOC、A9 合集近义项归并（约 43 组）、
  刀3 那 5–8 条正文内手工工具链
- `_config.yml:27` 的 `site.keyword` 现在是死配置（没有任何页面再输出它），删不删是另一个决定，`package.json` 本轮在禁改清单里
- 未入站的那篇 `_posts/2026-10-01-gitdiagram-keyless-mcp-4-bad-edges.md`（`??` 状态，另一会话的）
  引了两枚磁盘上不存在的 webp（`assets/img/gitdiagram-keyless-mcp-4-bad-edges/{01-comparison-edges,banner}.webp`，
  该目录此刻只有 `prompts/`），发出去就是 404——归写帖的那一格
- `<picture>` → `src` 换源、`cwebp` → `ffmpeg`、3 枚死 png 不转不删，这三条都在 §8.4 / §8.3 记过，别再当「实现走样」重提
- 已知未修的既有缺口：`editorial.scss:1643` 那条 `.related-link:hover .related-name` 除了换色还带
  `translate: .18em 0`，而 `@media (prefers-reduced-motion: reduce)`（:3854 起）是**逐条点名**的写法、
  没有兜底那句，所以这一族的横移在减弱动效档照样跑。它是本期之前就有的（`.related-posts` 那一族），
  本期没碰；要修属于动效那一格的范围，不该塞进这一串提交里

