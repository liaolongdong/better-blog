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

| 事实 | 复核方式 |
| --- | --- |
| 博客正文 → 工具页内链 **0 条** | grep `_posts` 对 `tools/(idcard\|codec\|json\|diff)\.html\|/tools\.html` 零命中 |
| `last_modified_at` / `updated` 在 80 篇里 **0 篇声明** | grep `^(last_modified_at\|updated):` 零命中 |
| `seoMeta.html:153` 的 `page_modified` 接线**已存在且设计正确** | 读源；`:143-149` 注释明确记录了「dateModified 恒等 datePublished 是伪造更新信息」这个缺陷的来历 |
| `sitemap.xml:76` 文章 `<lastmod>` 用 `post.date` | grep |
| `keywords` meta 全站输出同一个 `site.keyword` | `seoMeta.html:77` |
| `jsonLd.html` 的 `@type` 全集不含 `WebApplication` / `FAQPage` / `ItemList` | grep `@type` |
| `<head>` 有 4 个同步阻塞 `<script src>`：jQuery + 三个统计推送 | `headAssets.html:92`、`seoScript.html:2-4`，经 `head.html:19` / `postHead.html:19` 进 head |
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

`categories.html` / `tags.html` / `series.html` / `index.html` 加 `ItemList`，
`itemListElement` 为 `ListItem` + `position` + `name` + `url`。

首页必须**只在 `paginator.page == 1` 时输出**——照抄 `jsonLd.html:107-114` 那道门的写法与理由：
jekyll-paginate 生成的 `/page2/ … /pageN/` 复用同一份 `index.html`，不加门就会吐 9 份
互相竞争的实体声明。现有代码已经躲开这个坑，别把它重新踩进去。

**SearchAction 本轮不做**：`index-all.html` 零 `<script>`、不支持 `?q=`（§1），
而 `SearchAction` 的 `target.urlTemplate` 指向一个不支持查询的 URL 是无效结构化数据。
→ 移到子项目 3，与 ⌘K 升级一起做（那时让 `?q=` 直接打开面板并预填）。

### A6｜manifest + theme-color

`sw.js` 已经能跑，差的就是这一个文件；补上就拿到「可安装」这个能力位。

- 新增 `manifest.webmanifest`（Jekyll 页面，permalink 写死，理由同 `sitemap.xml`：
  写死才能进站点地图、才能让路径与 baseurl 一致）
- `name` / `short_name` / `start_url: {{ '/index.html' | absolute_url }}` / `display: standalone`
  / `scope` / `background_color: #FAF9F6`（= `--paper`）/ `theme_color`
- 图标 192 / 512 PNG：本机 `sips` 不认 SVG、无 imagemagick，
  但 `scripts/og-images.mjs` 已经证明 **headless Chrome 截图**这条路可行 → 复用它的手法，
  新增 `scripts/build-manifest-icons.mjs`，产物入库
- `head.html` / `postHead.html` 各加 `<link rel="manifest">` 与 light/dark 两条 `theme-color`

**head 字节记账（§1 的 ~838B 余量）**：manifest link ≈ 70B，theme-color 两条 ≈ 140B，
合计 ≈ 210B。B1 defer 三个 `src` 属性不省字节（`defer` 是 +6B×3 = +18B），
所以这一件是**净增 ~228B**，余量降到 ~610B。这笔账必须在实测里复核，不能默认。

**已知不完美**：`theme-color` 的 `media="(prefers-color-scheme: …)"` 只能跟系统，
跟不了 `.night-mode` 这个手动 class（`daytimeMode` localStorage 键）。接受它，
并在模板注释里写明这是平台限制而不是遗漏。

**不碰 `sw.js` 与 `check-sw.mjs`**（另一会话在飞，见 §2）。manifest 是个 ~400B 的静态文件，
不进 SW 预缓存清单也不影响功能，只是首次安装多一个网络往返。

### A1｜文末「相关工具」卡（自动那一半）

现状：4 个工具页的入口只有顶栏下拉与首页侧栏两处，博客正文里 0 条内链（§1）。
80 篇文章的正文权重一条都没有分给工具页。

做法：`_data/onlineTools.yml` 每条补两个字段——

- `post_tag`：与 `_data/tools.yml` 的扩展条目对齐（**顺手解掉 C2**：
  在线工具此前没有 `post_tag`，所以 `tools.html:116-206` 那一支不渲染「相关记录」）
- `match_tags[]`：多个 tag，命中任一即算相关

新增 `_includes/relatedTools.html`，在 `_layouts/post.html` 的 wrap-up 面板附近渲染，
`post.tags` 与 `match_tags` / `post_tag` 求交集，取前 3。

**无命中时不渲染整个容器**，绝不留空壳。这条必须有牙：
否则会退化成「每篇都硬塞 3 个不相关工具」，那是把内链权重稀释掉，比不加更糟。

上限 3 条同样要有牙。

### B1｜三个统计脚本去同步

`seoScript.html:2-4` 三条各加 `defer`。

`defer` **保持相对顺序**，所以 `baiduStatistics → baiduPush → soPush` 之间可能存在的
全局依赖（如 `_hmt`）仍然安全。这三个都是统计 / 推送，没有任何必须阻塞解析的理由。

**jQuery 不动**（`headAssets.html:50` 的既有决定）。

改的是性能基线，所以前后各量一次 head 阻塞脚本数与 LCP，写进 §6。

### B2｜PNG→webp 转码 + 构建期 `<picture>` 注入

**精准打击，不做全量**：§1 的分布显示 23 张 >512KB 的 png 占 79% 字节。
只转这 23 张就拿到八成收益，blast radius 小一个数量级（23 张 vs 125 张）。
阈值 512KB 写进脚本常量，可复算。

- 新增 `scripts/build-image-variants.mjs`，用本机 `cwebp`（已在）转同名 `.webp`
  到同目录。质量档 `-q 82 -m 6` 起步，A/B 实测后定档
- **跳过** `assets/img/og/`：OG 图有独立流水线与签名（`_data/og_images.yml` 的 `sig`），
  动它会连带 `og:check`
- 增量：记每张源图的 sha256，只有源变了才重转，避免每次构建全量转 48MB
- **注入点在 `_plugins/image_dims.rb`**：它已经在构建期读图片头拿 width/height 并加
  `loading=lazy decoding=async`。在同一处把有 webp 变体的 `<img src=x.png>` 包成

```html
<picture>
  <source srcset="{baseurl}/assets/img/x.webp" type="image/webp">
  <img src="{baseurl}/assets/img/x.png" width=… height=… loading=lazy decoding=async alt=…>
</picture>
```

**正文继续写 `.png`，80 篇 md 零改动** —— 这样就绕开了 `article-check` 的 60 条断言
与 prettier 重排 ```js 围栏改 chars 计数这两个坑。

- LCP 提权：现有「一次连续图片里第一张不 lazy」的逻辑保留，并对它额外加 `fetchpriority="high"`
- **降级而非死链**：webp 不存在 → 不注入 `<source>`，只留原 `<img>`，并打印警告

**仓库体积的诚实账**：短期会涨（png 与 webp 并存）。2026 年 webp 全球支持 >97%，
png fallback 其实已无必要——但**保留一轮**，A/B 实测确认无视觉回退后，
再单独一刀把 png 从发布产物排除（`_config.yml` 的 `exclude`），那时仓库净减。
二段式，不在本轮同时做。

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
           ├─ scripts/build-modified-data.mjs ─→ _data/modified.yml ─┬→ seoMeta.html  (page_modified → article:modified_time)
_posts/*.md┘                                                          ├→ jsonLd.html   (dateModified，读 page_modified)
                                                                      └→ sitemap.xml:76 (lastmod)

_data/onlineTools.yml ─(+post_tag / match_tags / tool_slug 由页面 front matter 提供)
        │
        ├→ _includes/jsonLdTool.html  (WebApplication)
        └→ _includes/relatedTools.html ─→ _layouts/post.html (wrap-up 附近)

assets/img/**/*.png (>512KB, 非 og/)
        │
        └─ scripts/build-image-variants.mjs ─→ *.webp
                                    │
                          _plugins/image_dims.rb ─→ <picture> 注入 + fetchpriority
```

## 6. 验收口径

**门禁化 + A/B 实测，两者都要。**

新增：

- `scripts/check-seo.mjs` + `scripts/check-seo-teeth.mjs`
- `scripts/check-image-variants.mjs` + `scripts/check-image-variants-teeth.mjs`

每颗牙自证「变异就会变红」，照 `check-tools-surface-teeth.mjs` 那 74 颗的既有形态。

`check-seo.mjs` 的断言组：

| 组 | 断言 |
| --- | --- |
| keywords | 有 tags 的页面输出 tags；无 tags 的页面**不输出**该 meta；任何页面都不再输出 `site.keyword` |
| modified | `_data/modified.yml` 每个 key 都对应真实 post.url；每个 `at` ≥ 该篇 `date`；`--verify` 模式重算指纹比对，防 yml 腐烂 |
| 诚实性 | 规范化前后哈希相同的提交**不许**进 yml（「一次全站 prettier 不许把 80 篇顶到今天」那颗牙） |
| JSON-LD | 四个工具页各有 WebApplication，其 `name` == 渲染出的可见 `<h1>`；归档页有 ItemList 且 `itemListElement` 数量 == 页面可见条目数 |
| 分页门 | `/page2/ … /pageN/` **不输出** WebSite / Blog / Person / ItemList |
| head | `<head>` 里同步 `<script src>` 数 == 1（只有 jQuery）；`seoScript` 三条都带 `defer` |
| manifest | 文件存在、JSON 可解析、`start_url` 与 `site.baseurl` 一致（防 baseurl 漂移）、图标文件真实存在 |
| picture | 每个 `<picture>` 的 `<source srcset>` 文件在产物里真实存在；LCP 候选图有 `fetchpriority=high` 且**无** `loading=lazy` |

A/B 实测三个数：**LCP、head 字节、图片字节**。

口径写死，跨口径比对禁止：

- 字节用 `cat f | gzip -9` 的 shell 口径，**不用 zlib API**（两者数字不同，本仓已定过这条）
- LCP 用 headless Chrome trace，量之前先清遗留进程与端口（孤儿 runner 会污染测量）
- `setDeviceMetricsOverride` 并自证 `innerWidth`（headless 默认视口不是桌面尺寸，
  否则量到的 `display:none` 是假缺陷）
- Jekyll 快照用 `--baseurl ""`（否则样式全 404）；CDP 开 `setCacheDisabled`
- 起本地服务用 `port=0` 且只认子进程 stderr 里的端口（固定调试端口会连上遗留 Chrome）
- 先断言 `curl` 到的产物 md5 == 磁盘 md5（旧 http.server 占端口会让 A/B 量到旧产物）

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
