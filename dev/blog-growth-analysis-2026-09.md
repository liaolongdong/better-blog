# Better 前端博客 · 功能 / 动效 / SEO 深度体检与机会清单

分析日期：2026-09-23　｜　范围：全站 66 篇文章 + 9 个归档页 + 33 个 demo 页
数据口径：`_site/` 构建产物 117 个 HTML + 线上 `https://liaolongdong.github.io/better-blog/` 实测（curl）。凡标 ✅ 的数字我都独立复测过；标 ◻ 的来自子智能体扫描，我抽查了其中影响结论的部分。

> 说明：本报告放在 `dev/` 下，因为 `_config.yml:213` 已把 `dev` 排除出构建，不会被发布成线上页面。

---

## 0. 先说结论

这个站**不缺功能，缺的是把已有功能接通的最后一步，以及一批正在静默漏流量的缺陷**。

`editorial.js` 2277 行已经实现了 17 项能力（下面第 1 节全列），加上 24 个 `@keyframes`、View Transitions 跨页转场、日食式主题切换、蒲公英画布、跟随夜色的星空、会动的猫。再加"第 18 个独立小功能"的边际收益已经很低。

真正的增量在三处：

1. **P0 缺陷（15 项）** —— 纯收益、不改交互、不做也每天都在亏。其中 4 项我实测确认线上正在发生：订阅源 64 张图全 404、65/66 页的 meta description 短于 SERP 可展示宽度、1170/1170 张正文图缺 `width/height`、34/66 篇文章的分享卡片用站点兜底图。
2. **P1 打通型功能（7 项）** —— 不是新造轮子，而是把已有的书架 / 停留时长 / 合集 / 金句卡 / 编辑器串成闭环。典型例子：站点有"稍后再读"书架却没有离线能力，有 ⌘K 面板却只搜标题和前 160 字。
3. **P2 动效（8 项）** —— 实测确认的空白很集中：全站 0 处 `will-change`、卡片 hover 不抬升、正文图不缩放、只有 2 个元素有按压反馈、灯箱只做 `.985` 缩放（没有从缩略图位置飞出的 FLIP）、无 LQIP 模糊占位。这些恰好都是 transform/opacity 级的低成本改动。

一句话优先级：**先修 description 与 og:image（点击率），再修 feed 与图片尺寸（抓取与 CWV），然后做全文搜索和阅读报告（停留时长），最后铺动效。**

---

## 1. 现状盘点：已经有什么（避免重复造）

| 能力 | 实现位置 | 说明 |
| --- | --- | --- |
| 日食式主题切换 + 跨页转场 | `editorial.js:125` / `tokens.scss:136` | `startViewTransition` + `clip-path` 圆形扩散，`@view-transition navigation:auto` |
| 目录（右栏 + 窄屏抽屉） | `editorial.js:180,265` | 单份 DOM 两套呈现，带 `.toc-progress` 高度进度 |
| 阅读进度条 | `editorial.js:313` | rAF + `scaleX` |
| 代码复制（带脉冲反馈） | `editorial.js:363` | `copyPulse` |
| ⌘K 命令面板搜索 | `editorial.js:427` | 语料 = `search.json` |
| 断点续读浮条 | `editorial.js:689–831` | 单条状态 + 7 天 TTL |
| 图片灯箱 | `editorial.js:833` | `<dialog>`，≥160px 且未被 `<a>` 包裹的图 |
| 滚动揭示 / 刊头数字滚动 | `editorial.js:877,913` | IO + 60ms 步进错峰 |
| 阅读偏好（字号/行宽/字体/纸色） | `editorial.js:1005` | 写 `html[data-rs-*]`，`tokens.scss` 生效 |
| 站内链接悬浮预览卡 | `editorial.js:1162` | 复用 `search.json` |
| 划词生成金句卡 | `editorial.js:1331` | canvas，DPR 上限 2 |
| 稍后再读书架 + 阅读统计 | `editorial.js:1647–2174` | 按日归档、可见时长、进度百分比 |
| 篇末阅读结算层 | `editorial.js:2176` | 实际用时 / 章节覆盖 / 约读字数 |
| 合集（系列 chip + 进度轨 + 上下篇） | `post.html:62–69,266–298` | `_data/series.yml` |
| Waline 评论 + 阅读数 + 点赞收藏 | `_includes/waline.html` | Cloudflare Workers |
| 分享（微信/微博/QQ/空间/豆瓣） | `social-share.min.js` | 25KB |
| 装饰动效 | 蒲公英画布 / 点击粒子 / 夜色星空 / 会动的猫 | 均已按 `prefers-reduced-motion` 降级（部分文件例外，见 P0-13） |

结构化数据侧已有：`BlogPosting` ×66、`BreadcrumbList` ×66、`CollectionPage` ×25、`WebSite`+`Blog`+`Person`（仅首页）；160 个 JSON-LD 块 0 解析失败。这一块底子比大多数个人博客好得多。

---

## 2. P0 · 正在漏流量的缺陷（1-5、7、9、11、13-15 已做；6/10/12/16 会动性能或视觉基线，待确认）

| # | 问题 | 实测证据 | 影响到 | 修法 |
| --- | --- | --- | --- | --- |
| 1 | **订阅源图片全断** | `_site/feed.xml` 64 处 `src=&quot;/assets/…`；线上 `…/assets/img/security-audit-two-validators/banner.webp` → **404**，同文件加 `/better-blog` → **200** ✅ | 全文 RSS 是全站最"可被 AI 直接引用"的资产，图全坏等于白送 | `feed.xml:32` 的 `post.content` 套上已有的 `add_baseurl_to_images` 滤镜（`default.html:12` 已在用） |
| 2 | **meta description 普遍过短** | 66 篇分桶：`<20` 列 12 篇、`20–49` 列 27 篇、`50–99` 列 19 篇、`100–154` 列 7 篇、`≥155` 列 **1** 篇 ✅。最短 12 列（正文标题回落到 6 字 `subtitle`，`seoMeta.html:44`） | **搜索点击率**。SERP 有约 155 列预算，剩下 140 列交给引擎自己猜，摘要经常拼成无意义片段 | 给 subtitle < 50 列的 40 篇补 `seo_description`（复核：39 是漏算了 1 篇，实补 40）；同时给兜底链加"短于 40 列则弃用 subtitle"的判断 |
| 3 | **title 超宽被截断** | 27/66 篇 > 60 列，20 篇 > 70，8 篇 > 85；最长 97 列（`gods-eye-view-keyless`）✅ | 点击率。截断后关键词落在末尾 | 标题层做"主谓宾 ≤45 列"约束，或把 `- Better 前端博客` 后缀在超预算时降为 `- Better` |
| 4 | **`dateModified` 是伪造的** | 66/66 篇 `dateModified === datePublished`（0 篇写过 `last_modified_at`，`jsonLd.html:34` 直接默认）；线上实测复现 ✅。且 `article:modified_time` 全站 0，页面无可见"更新时间" | 新鲜度信号 + 用户信任。引擎能识别"发布时间=修改时间"的空转 | 真实机制：front matter 加 `updated: []`，渲染页内修订记录，`dateModified` 取最后一条。见 P1-F4 |
| 5 | **正文图无尺寸声明 → CLS** | 复核后的准确口径：只有 **152** 个 `<img>` 在正文里（`<article id="post-body">`），它们当时全部没有 `width`/`height`；其余是版式装饰图，绝大多数落在 CSS 写死的方框里（`.nav img{22px}`、`.tool-icon img{32px}`）→ 补属性对它们是 no-op。（本行原先写的"产物 1355 个 `<img>` / 1104 缺 `loading` / 264 缺 alt"三个数**作废**：那样数是直接 `grep '<img'` 数出来的，把 `<script>` 里当字符串字面量出现的 `<img class="wl-emoji">` 也算成了元素。先把 `<script>`/`<style>` 整块挖掉再数，非 demo 页真实 `<img>` 是 1036 个、缺 `loading` 769 个、缺 `alt` **0** 个；demo 页另有 9 个，缺 `alt` 也是 0。剩下那 769 个是刻意不加懒加载的头部与侧栏小图，不是漏网。） | Core Web Vitals：正文长截图首帧按 0 高占位，图一到整页往下顶 | 已做：`_plugins/image_dims.rb` 构建期读文件头补尺寸 + 非首图补懒加载，正文 152/152、文章头图 32/32 全覆盖，每篇首图保持 eager 不动 LCP |
| 6 | **34/66 篇分享卡片是站点兜底图** | 线上 og:image 非兜底的仅 32 篇 ✅（`social-default.jpg`） | 微信/微博/X 卡片点击率 —— 这是纯社交裂变入口 | 构建期为无 cover 的文章生成品牌化 1200×630 卡片（可复用金句卡的排版规则） |
| 7 | **demo 区对爬虫不可见** | `demo.html` 的 `<ul class="demo-list">` 构建后是**空容器**、页面内 `/demo/` 链接 **0 条** ✅；`_site/demo/*` 33 页里 17 页无 `<h1>`、16 页无 canonical；33 页全不在 sitemap | 10 个 demo 目录成孤儿页，`_site` 里近 1/3 的 HTML 白建 | demo 列表改成 Liquid 服务端渲染（数据源 `demo.json` 已在仓库）；给 demo 模板补 front matter |
| 8 | ~~代码块语言信息丢失~~ **复核后判定：不是缺陷** | 复核产物：`language-plaintext` 的 2077 个 `<code>` **全部是行内代码**（在 `<pre>` 内的 0 个），围栏块的语言一直挂在 `<code>` 上（例 `<code class=" language-bash">`）；真机跑 Prism，nginx 篇 65 个语言块里 `.token` 正常产出 → Prism 拿得到真语言。且 `language-plaintext` 是 prism.css 里 `:not(pre) > code[class*="language-"]`（行内代码底色/内边距）的命中条件，摘掉它行内代码样式会掉 | 无（原判断不成立） | 不改代码。语言角标 / 按语言路由直接读 `<code>` 上已有的 `language-*` 即可 |
| 9 | **指向已停用域名的外链** | 11 个文件 26 处 `liaolongdong.com`（如 `_site/2018/11/16/alicloud-nginx.html`）✅ | 把内链权重送给站外，且是内容重复源 | 批量改写为本站 URL 或加 `rel="nofollow"` |
| 10 | **8.9MB 的 ace 为一个 341 字的页面** | `du -sh _site/ace` = 8.9M ✅；`weblab.html` 正文文本仅 341 列 | 编辑器页的 LCP / TTFB，也拖累抓取预算评估 | ace 改成点击"打开编辑器"再动态注入；或换 CodeMirror 6 按需语言包 |
| 11 | **死字体资源** | 复核：3 个本地 `@font-face`（base.scss 两个空壳 + iconFont/iconfont.css）+ 2 个 vendor 的（share.min.css、github-markdown.min.css）+ 1 个 alicdn 远端；`Merriweather-{Black,Light}.ttf` 合计 83,652B，全站 0 引用 ✅ | 字节（仓库与 `_site`）；FOIT 那半条**不成立**，见右 | 已做：删 base.scss 两个空壳（Sass 本就不输出空 `@font-face{}`，纯源码头寸）、删两个 ttf；`font-display: swap` 只加在 `socialshare` 那一份——它是全站唯一真走网络的字体（share.min.css 引 `../fonts/iconfont.woff`）。其余几份的 src 首选都是内联 data URI（本地 woff2、octicons woff、alicdn woff 均实测如此），支持 `font-display` 的浏览器根本不发请求，会发请求的（IE9 / 老安卓，只有 eot、woff 文件路径）又不支持这个描述符——加了是装饰，故不加 |
| 12 | **CSS/JS 全量下发** | `index.min.css` 100,079B 整站在一个文件里，每个文章页都背 ✅；本地 CSS 120KB + JS 92KB（未压） | LCP / 首屏解析 | 拆出 print/critical；文章页只载需要的片段（至少把 about/demo/weblab 专用样式分拆） |
| 13 | **`prefers-reduced-motion` 有漏网** | reduce 块原先只存在于 `about.scss` 与 `editorial.scss`（`tokens.scss` 那处是 `no-preference` 的 view-transition，不算兜底）；`animate.scss`、`common.scss`（`.article-item`/`.read-next-item` 错峰 6 处）、`cat.scss`、`bottomFixedBtn.scss`、`weblab.scss`、`helper.scss` 均无，`base.scss` 的 `a{transition:.2s}` 也没有 | 无障碍 + 前庭功能敏感用户 | 已做，但没有逐组件补：在 `base.scss` 末尾加一份全站兜底（`*`,`::before`,`::after` 的 `animation-duration`/`transition-duration` → `.01ms !important`、`animation-iteration-count:1`、`animation-delay:0s`、`scroll-behavior:auto`）。用 `.01ms` 而不是 `animation: none`：后者管不到 transition 那一侧（`a{transition:.2s}`、悬浮位移、抽屉 transform），逐条补又回到"每个组件再补一遍"；实测当前全站 0 个规则块同时写了 `opacity:0` 与 `animation`，所以两种写法今天都不会藏掉内容，选前者是为了覆盖过渡与未来的动效。`index.min.css` 全站下发，6 个文件一次覆盖，后来的新动效也自动在里面 |
| 14 | **死代码** | `.utdf-delay0` / `.dtuf-delay0` 只在 `animate.scss` 与产物 CSS 里出现，模板中 0 引用（`_posts` 里唯一命中这两个类名的是本报告自己） | 维护噪音 | 已删：两个类一起删，连带只有它们一处消费的 `@keyframes upToDownFade`；**`@keyframes downToUpFade` 必须留**——它的消费者在别的文件（common.scss 那 6 处直接写 `animation: downToUpFade …`），按类名 grep 会把它误判成死码 |
| 15 | **无 AI 引擎可读入口** | `robots.txt` 只有 3 行（`User-agent: *` / `Allow: /` / `Sitemap:`），AI 爬虫隐式放行但**未显式表态**；全站无 `llms.txt`；无 `<noscript>`（⌘K 结果容器静态是空 `<ul>`）；无纯 HTML 全站索引页 | 被 ChatGPT / Perplexity / Claude 引用的概率 | 已做（本批口径只到"显式表态"）：`robots.txt` 逐条写出 13 个引擎的 `Allow: /`，检索型与训练型不区分（2026-09-23 确认全部放行）；`llms.txt`（P1-S2）、纯 HTML 索引页（P1-S4）与 `<noscript>` 提示均已于 2026-09-23 落地（noscript 挂在页脚那一排，见 `_includes/footer.html`）|
| 16 | **`<head>` 里两个阻塞资源挂在同一个外部域上**（核验 P0-11 时撞出来的，不在原 15 条里） | `headAssets.html:38/40` 从 `cdn.staticfile.org` 取 normalize.min.css（阻塞渲染的样式表）与 jQuery 3.3.1（阻塞解析的 `<script>`，无 defer/async）。2026-09-23 本机实测：normalize **15s 超时、code=000**；jquery **3.88s / 86KB**；同页的 at.alicdn 图标 CSS 只要 0.07s → 慢的是这个域，不是网络总体。后果实测可复现：headless Chrome 打开任意页拿不到 `document.body`，`--dump-dom` 两分钟不退出；把该域用 `--host-resolver-rules` 指到本地后 1.2 秒就量完了 | LCP / 首屏白屏 / 抓取预算；`$` 依赖脚本（`anchor.html` 等）全在 jQuery 之后 | 把这两个文件自托管进 `assets/`（normalize 6.0.0 约 1.7KB gz、jquery 3.3.1 约 30KB gz），或至少给 jQuery 加 `defer` 并把它下游那些"必须早于 `$`"的脚本改成 `DOMContentLoaded` 触发。**属于动性能基线的改动，本批未擅自做** |

> 另有一个部署层事实：Pages 只监听 `master`，本地 `main` 上的提交在推上去之前不会上线（写这段时领先 5 个，P0 批次做完已到 11 个；以 `git rev-list --left-right --count origin/master...HEAD` 为准）。修完 P0 一起发一版更划算。

---

## 3. P1 · 打通型功能：把已有的东西接通

按"投入 / 对停留时长的影响"排。

### F1 全文搜索（当前 ⌘K 只搜标题 + 前 160 字）
`search.json` 的 `excerpt` 明确截到 160 字（模板注释解释过是为了不撑 payload），所以搜 `pnpm overrides 怎么写` 这类**正文里的问题**搜不出来。
- 做法：构建期用 `flexsearch`（或 lunr）生成压缩索引，⌘K 面板保持现有 UI，只换检索层；索引分片按需 fetch。
- 收益：技术博客里搜索是跳出率最低的路径；搜到 → 连读 → 阅读时长直接上升。同时把"搜索结果页"做成 URL 可寻址（`search.html?q=`），顺带解决长尾内链。
- 成本：中（一个构建脚本 + 面板改数据源）。

### F2 阅读报告 `/stats.html`（复用已有数据，零后端）
书架已经在记每日条目、可见时长、进度、字数（`editorial.js:1647–1749` 那套 `dayKey` / `humanizeMs` / `shelfStats`），但只在抽屉里显示汇总数字。
- 把它扩成一页"我的阅读报告"：本周/本月时长、读完篇数、最偏爱分类、连续打卡天数、最长一次专注、书架积压。
- 复用金句卡的 canvas 管线生成一张可分享的"月度报告卡"。
- 收益：回访动机（用户会为了攒数据回来），这是提升页面浏览时长最直接的一招；且全在 localStorage，无隐私与后端负担。
- 成本：中偏低。

### F3 「这段代码丢进编辑器」—— 站点已有 ace 却和文章不通
文章有代码块（大量），有 weblab 编辑器（8.9MB 的 ace），两者零连接。
- 每个代码块 hover 出现「在编辑器中打开」，携带语言与内容跳 `weblab.html?lang=&code=`（用 `sessionStorage` 传大段，避免 URL 超长）。
- 依赖 P0-8（先拿回真语言类）。
- 收益：把"读"变成"试"，是技术博客最能拉开差异的一条；同时给编辑器页导流（它现在是全站最薄的页之一，341 字）。
- 成本：低。

### F4 文章修订记录（把 P0-4 从缺陷变成优势）
front matter 支持 `updated: ['2026-03-12 补充 pnpm 9 的行为变化', ...]`，页头显示「更新于 X · 共 N 次修订」，可折叠展开明细；`dateModified` 与 JSON-LD 取真值。
- 收益：AI 引擎与 Google 都重新鲜度；对 2016–2019 那批老文章是**唯一**合规的"翻新"方式（不需要重写正文，也不会触碰"别为了 AI 拆碎内容"的红线）。
- 成本：低（一个 include + 模板改动）。

### F5 键盘流 + 快捷键总览
已有 ⌘K，但可发现性靠一个 `<kbd>`；`?` 唤出快捷键总览，补 `j/k` 跳章节、`t` 切主题、`b` 开书架、`g` 回顶。
- 成本：极低；对"开发者读者"是强好感点，且和已有 TOC/主题/书架完全复用。

### F6 订阅入口（东西都在，只是看不见）— 已做（2026-09-23）
全文 Atom 质量很高（20 条、正文中位 17,462 字），但修好图片（P0-1）之后仍要让人**能订阅**：页脚 + 文章页加 `RSS` 链接与 `rel=alternate` 可见化。
- 附带收益：订阅数是可迁移的自有受众，GitHub Pages 域名变更（这个项目历史上就发生过 `liaolongdong.com` → `liaolongdong.github.io`）时不会归零。
- 落地口径：`rel=alternate` 一直在 head（`_includes/seoMeta.html:182`），补的是**看得见**的那一份——放在 `_includes/footer.html`，因为它是全站唯一每页都渲染的位置（`_layouts/post.html` 与九个页面模板都 include 它），同排带上全站索引与 `llms.txt` 三个地址。没有在文章页另加一块，也就没有多养一套样式与新的视觉层级。

### F7 PWA / 书架离线（和"稍后再读"是天然一对）
现状：**无 service worker、无 manifest.json**（已 grep 确认）。书架的语义就是"我待会儿要读"，而"待会儿"经常是地铁里。
- 做法：SW 预缓存书架内的文章 HTML + 其图片（限额 + LRU），书架行显示"可离线"角标。
- 成本：中；收益是把一个已有功能从"标记"升级成"能兑现"。

### F8 合集读完的成就反馈
`_data/series.yml` 已有 10 个合集、进度 chip 已有。检测 5/5 读完后给一次庆祝（复用 `seriesFillIn` 的完成脉冲 + 一张可分享卡）。
- 收益：系列连读率 —— 对"提升浏览页数"是最直接的机制；成本极低。

---

## 4. P1 · SEO / AEO：曝光率与点击率

### S1 标题 + 描述重写（CTR 最高杠杆，先做这条）
就是 P0-2/P0-3。做法上给 `USAGE.md` 的写作规范加两条硬约束，并扩写"检索层自查"脚本（`USAGE.md:380` 那节已扩到 11 条，列数区间已是第 9 条：标题 ≤60 列、描述 ∈[50,158] 列，按 CJK=2 列算）。
下限取 50 是对齐 P0-2 的补写门槛（subtitle < 50 列才补 `seo_description`），不是终点：S1 把文案推到 150 列档之后，这条下限可以直接抬到 100，那时它才真正在挡"摘要拼成无意义片段"。

### S2 `llms.txt`（低成本，直接服务 AI 引用）— 已做（2026-09-23）
一份 markdown：站点是谁、写什么、10 个合集的主题、全部文章的分组索引（标题 + URL + 一句话结论）。Google 明确说 AI Overviews 不需要它，但 ChatGPT/Claude/Perplexity 侧确实会读；对 Google 无害。
- 进阶（可选）：每篇 40–60 字的"结论块"汇成 `llms-full.txt`。注意别把正文拆碎重排，那是 Google 点名的反模式。
- 落地口径：根目录 `llms.txt` 是一份**由 Jekyll 渲染**的页（`permalink: /llms.txt`，无 layout），不是手写 txt。理由只有一条：这份文件的价值全在"和站内实际内容一致"，手写版每加一篇文章就悄悄过期，而它过期比没有更糟——引擎会把拿到的那份当权威摘要。现在篇目、地址、摘要、计数全部现算，唯一的维护成本是最上面那段自述。
- 摘要取值链与 `seoMeta.html` 同序（`seo_description > description > subtitle > 站级描述`），但**不抄**它"不足 25 字符退回站级描述"那道闸：那道闸是为 SERP 那约 140 列的预算服务的，纯文本清单没有列宽约束，6 个字的 subtitle 对引擎仍比一句通用站级摘要有用。当前 67 篇实测两边逐篇一致。
- 三个入口互相指：`llms.txt` 里列 feed / 全站索引 / sitemap，页脚三个链接并列，sitemap 收录 `index-all.html` 但**不收** `llms.txt`（纯文本进 `urlset` 是噪声）。

### S3 `robots.txt` 显式表态 — 已做（2026-09-23，见 P0-15）
现在是一行 `Allow: /`。建议显式放行检索型爬虫（`GPTBot`、`OAI-SearchBot`、`ChatGPT-User`、`PerplexityBot`、`ClaudeBot`/`anthropic-ai`、`Google-Extended`、`Bingbot`），并按意愿处理只用于训练的种子（`CCBot`、`Bytespider`、`Applebot-Extended`）。
- 这是个取舍不是纯收益：挡训练爬虫 = 放弃这些引擎的引用位。默认建议**放行**，把决定权留给你。
- 结论：2026-09-23 确认全部放行，13 个引擎逐条写 `Allow: /`，检索型与训练型不区分。

### S4 纯 HTML 全站索引页 — 已做（2026-09-23）
`/index-all.html`：按年份 + 分类列出全部 66 篇（服务端渲染，非 JS）。同时解决 P0-7 的 demo 孤儿（另起一段列出 19 个 demo）。
- 收益：抓取覆盖 + 长尾内链，也把权重送进现在拿不到的 demo 页。
- 落地口径：这一页存在的理由不是"给人当目录"（分类/合集/标签/⌘K 都比它好逛），而是给两件事兜底——翻页视图只到最近 9 页、更早文章没有导航路径；以及不执行 JavaScript 的抓取。**一条新 CSS 都不写**：类名全部沿用 `editorial.scss` 已有的 `.cat-*` / `.demo-*`，产物体积不变，栅格行为与分类归档页同源。
- 站点页数的计数写 `site.nav.size | plus: 3`（nav 之外还列本页 / feed / llms.txt 三个地址），不写死 11，将来往导航加项时它自己跟上。
- 它进 sitemap 是那条 nav 白名单**唯一一次破例**：该收录，但不该上导航条（导航是给人的常显入口，一页纯目录挤进去只会把第 9 项推到移动端换行）。

### S5 结构化数据补齐（底子好，补的是最后一公里）
- `speakable`：0 篇有 → 给 `BlogPosting` 加（`cssSelector` 指向首个结论段）。
- `FAQPage`：≥2 个问句式标题的文章有 10 篇 → 命中"直接答案"格式的机会。
- `ItemList`：合集页、标签归档、归档索引都该有（现在 0）。
- `Person` 实体统一：**已做（2026-09-23）**。落地口径：
  - 节点模板抽到 `_includes/jsonLdAuthor.html` 一份，首页与 `about.html` 各引入一次——产物里两份声明逐字节相同，将来加别名不会让两处漂移。
  - `about.html` 这一处是本次真正的修复：`@id` 一直指向它，它自己却从没发出过节点，全站引用落在空地址上。
  - 67 篇的 `author`/`publisher` 由内联无名对象改为 `"@id": ".../about.html#author"` **同时带 `name`**——只留 `@id` 时 Rich Results 校验器报缺 `author.name`，所以两处字段都保留。
  - 名字口径由本人确认：站内可见署名仍是 `Better`（一个字没改），Person 的 `name` 用中文正名 `廖小新`，`alternateName` 收 `Better / 廖龙东 / 小新`。三处取值来自 `_config.yml` 的 `author_name` / `author_alt_name`，可见文案不读这两个字段。
  - 自检固化在 `USAGE.md` 第 3 条：核 Person 份数 2、去重后 1，以及 `author` 是否 `@id`+`name` 双全。
- **不要加 `SearchAction`**：Google 2024 年已停用 sitelinks search box，且本站搜索是纯客户端、没有真实可寻址的结果 URL，声明它属于虚假结构化数据。（这条是主动劝阻，别顺手加。）

### S6 每篇唯一 og:image
见 P0-6。品牌化兜底卡（标题 + 分类 + 日期 + 站点标识）比 `social-default.jpg` 的点击率差异是社交场景里最大的单点收益。

### S7 归档页去薄
`demo.html` 220 字、`weblab.html` 341 字（`_site` 实测去壳文本）→ 补"这里有什么、能干什么、怎么玩"三段实文，配 `CollectionPage` + `ItemList`。这两个页面现在既是薄内容又是全站权重的无底洞。

### S8 内容层：答案形状（这条决定 AI 会不会引你）
AI 引用份额最高的是对比文（≈33%）、权威指南（≈15%）、原创数据（≈12%）。你的实测类文章天然占优，但 `_site` 里只有 14/66 篇有 `<table>`。
- 建议在写作模板里固定三件：**开头 40–60 字直接答案块**、**一张对比表**、**文末 3 条 FAQ**。
- Princeton GEO 的排序是：引用来源 +40%、加统计 +37%、加引述 +30% —— 你已有的"可复现命令 + 数据"正好落在 +37% 那一档，缺的是把它显式结构化。
- 反面清单（会掉 10%）：堆关键词。别为了 AI 改文风。

---

## 5. P2 · 动效增强（先做完 P0-13，再动这里）

全部走 `transform` / `opacity`，全部挂到已有 reduce 分支，全部复用 `tokens.scss` 现有变量（注意：该文件**没有** easing/duration/z-index token，23 个自定义属性里只有色板、半径、`--measure`、`--rs` —— 动效值现在是硬编码贝塞尔。建议顺手补一组 `--ease-*` / `--dur-*`，否则第 25 个动效会继续散落成字面量）。

| # | 动效 | 现状（实测） | 做法 | 为什么值得 |
| --- | --- | --- | --- | --- |
| M1 | **灯箱 FLIP 飞出** | 现在只有 `opacity + scale(.985)`（`editorial.scss:2469`），没有从缩略图位置过渡 ✅ | 记录缩略图 rect，用 `transform-origin` + `translate/scale` 从原位置放大，关闭反向 | 成本最低、感知最强的一处"哇"；纯 transform，且是全站唯一"图 → 大图"的空间连续性缺口 |
| M2 | **图片 blur-up + 比例占位** | 无 LQIP、无 `aspect-ratio`（grep 0 命中）✅ | 6 字节内联 blur 占位 + `aspect-ratio` 盒 + `loading=lazy`；与 P0-5 同一次改动 | 同时解决 CLS 和"图片突然撑开页面"，动效与性能一次付清 |
| M3 | **卡片 hover 抬升 + 封面微缩放** | `.article-item`/`.cat-row`/`.series-row`/`.post-hero img` hover 只有颜色变化 ✅（grep `scale(` 只命中头像/灯箱/⌘K） | `translateY(-2px)` + `--shadow-1→2` + 封面 `scale(1.03)`（`overflow:hidden` 内），一次只动一层 | 首页信息流是浏览时长主战场，可点性感知不足 |
| M4 | **按压反馈** | 全站 `:active` 只出现在 2 处（`.cta`、`.icon-menu`）✅ | 给 `.wrap-up-btn`/`.reader-opt`/`.quote-btn`/`.shelf-tab`/`.code-copy`/`.nav-search-btn`/`.toc-fab`/`.nav-link` 统一 `scale(.97)` | 一条规则覆盖 8 类控件，交互确定性提升明显 |
| M5 | **focus-visible 过渡** | 只有静态 `outline`，无过渡 ✅ | `outline-offset` 由 3→1 的 120ms 过渡（键盘态才动） | 无障碍观感，且不影响鼠标用户 |
| M6 | **面板逐项错峰入场** | ⌘K 结果、书架行、TOC 抽屉开合都是整体淡入，关闭走 `hidden` ✅ | 复用现有错峰思路（IO reveal 用 `min(k,5)*60ms`），给结果行 `--stagger` 变量；关闭也走 VT | 让"最常被操作的两个面板"手感从"弹出"变成"涌出" |
| M7 | **进度条末端倒计时** | 进度条只有 `scaleX` ✅；但每分钟时长数据 §14/§15 已经算得出 | 条末端跟一个小气泡"还剩约 3 分钟"，随滚动倒数 | 已有数据的可视化复用；读完率会动 |
| M8 | **主题图标与日食联动** | 日食扩散已有 ✅，但图标本身换图是瞬时 | 图标 `rotate` + 形变参与同一 VT | 已有动画的收尾，一致性 |
| M9 | **合集进度轨的完成脉冲** | `seriesFillIn`（`scaleX` 0→1）已有 ✅ | 到 100% 时一次性光扫 + 轻微弹跳（配合 F8 成就） | 把已有装饰变成正反馈 |
| M10 | **滚动视差（受控）** | 无滚动视差、无 paint 动画 ✅ | 只给 `.post-hero` 与刊头装饰层做 `translate3d` 视差，`will-change` 显式声明并只在 hero 存在期间保留 | 全站 0 处 `will-change`，说明是有意为之 —— 所以这条排最后，且必须实测掉帧阈值 |

---

## 6. 明确不建议做的（免得顺手加错）

| 事项 | 为什么不做 |
| --- | --- |
| `hreflang` | 单语 zh-CN 站，`<html lang>` + `og:locale` + `inLanguage` 已经够了。硬加 hreflang 只会产生不互指的非法集群 |
| `SearchAction`（sitelinks searchbox） | Google 2024 已停用该特性；且本站无服务端搜索结果 URL，声明即虚假标记 |
| 机翻英文版刷收录 | 薄重复页会拖累全站 helpful-content 信号，比不加更糟 |
| 无限滚动替代分页 | 现有 `page2…page9` 有独立 title/canonical，是抓取友好的；换无限滚动要先丢掉这套 |
| 再加一套统计/评论 | Cloudflare 无 Cookie PV/UV + Waline 阅读数已经够；多一个第三方只会多一个 INP 抖动源 |
| 站内 AI 问答（"问这篇"） | 需要后端与密钥，与个人博客定位不匹配；若将来做，应放在 F1 全文搜索之后 |

---

## 7. 落地顺序

**第 1 步 · 缺陷批（P0）** — 原 15 项里 11 项已修（1-5、7、9、11、13-15），P0-8 复核后判定不是缺陷故不改，剩 3 项 + 新增 1 项待确认
纯修复，不改交互。发版按 `USAGE.md` 的三处版本号约定（`_config.yml:39`、`package.json`、`CHANGELOG.md`）+ 打 tag。
验收：`USAGE.md:380` 检索层自查已从 6 条扩到 11 条，另加一节《产物里的样式回归》。新增口径：
feed 图片必带 baseurl（裸路径 0 条）、正文图必带宽高且每篇首图 eager、
title ≤60 列 / description ∈[50,158] 列（按 CJK=2 列算）、demo 静态链接对齐 `demo.json`
（19 条，注意 demo 目录只有 18 个）、全站 946 处 `<img>` 引用逐个查文件是否真的落盘；
样式回归查死样式类回流、`downToUpFade` 关键帧是否被误删、reduce 全站兜底、`socialshare` 的 `font-display`。
2026-09-23 跑通：本批 P0 相关项全绿，第 11 条当场逮到一篇在写文章的配图尚未生成（引用了不存在的
`banner.webp`）——这条自检的价值正在这里：补尺寸的滤镜读不到文件头时会安静放过，线上就是一个 404 空图框。
**未做的 4 项都是会动性能或视觉基线的**，等单独点头：P0-6 og:image 品牌卡、P0-10 ace 懒注入、
P0-12 CSS 拆分、P0-16 `cdn.staticfile.org` 自托管。

**第 2 步 · CTR + AEO 批（S1/S2/S4/S6/S7）**
标题描述重写 + `llms.txt` + 全站索引 + og:image 兜底卡 + 两个薄页补实文。这批是曝光率的主战场。
进度（2026-09-23）：S2、S4 已做，外加 F6 的可见订阅入口（它记在功能批，但和这两个是同一次改动，
一起落最省）；S1 的文案重写仍是独立工作量（要逐篇判断，不适合机器代笔）；S6/S7 会动视觉或
需要新产出物，等点头。

**第 3 步 · 功能批（F1 → F3 → F4 → F2 → F5 → F6 → F8 → F7）**
按"改动小 / 复用多"的顺序排：编辑器联动和修订记录很轻，全文搜索中等，PWA 最重放最后。

**第 4 步 · 动效批（先 P0-13 补 reduce，再 M1→M9）**
M10 视差单独评估，需要真机掉帧测量再决定。

---

## 8. 怎么判断有没有效果

| 目标 | 指标 | 看哪 |
| --- | --- | --- |
| 曝光率 | 展示次数、收录页数（117 → 含 demo） | Search Console（目前无接入迹象，值得先接上） |
| 点击率 | 修 description 前后的 CTR；同 query 排名不变时 CTR | Search Console |
| AI 引用 | 抽查 10 个真实提问里是否引到本站 | 手动：ChatGPT / Perplexity / Google AI 概览 |
| 浏览时长 | 篇均停留（Waline 阅读数 × §14 时长）、⌘K 使用率、书架添加数、搜索后点击率 | Cloudflare Web Analytics + 站内 localStorage 汇总 |
| 连读 | 合集 5/5 完成率、相关阅读点击率 | Cloudflare 事件 |

> 提醒：站内这些行为指标都在用户浏览器本地，看不到聚合。如果要做"报告页给读者看"（F2）可以，但**别顺手加埋点上报** —— 那会引入新的隐私面。要聚合数据就走 Cloudflare 的自定义事件。
