# 更新日志

站点版本号与 git tag 一一对应，tag 打在 `master` 上（Pages 的构建 Workflow 只监听 `master`，
见 [USAGE.md](./USAGE.md) 的「发布链路与分支」）。版本号规则与递增口径见 USAGE.md 的
「版本号与 tag 约定」。

## 2.0.1 — 2026-09-22

发布 2.0.0 之后跑了两轮独立评审加一轮自测，修掉查出来的问题。全部是「2.0.0 声称的收益
当时并不成立」或「自检脚本自己骗人」这一类，没有新特性。

- **文章页面包屑 66 页全错**：`'/categories.html#' | append: page.categories | first` 里
  `append` 先把数组转成字符串，再对字符串取 `first` 得到 nil，整条链塌成裸 baseurl
  （产物实测 66 次 `href="/better-blog"`，点上去 301 回首页）。改成 `page.categories[0]`。
  这是 `10184a5` 引入的存量缺陷，也就是说 2.0.0 条目里「分类归档拿到锚点级内链权重」
  当时并未兑现。
- **「跳到主要内容」在 68 个页面没有落点**（66 篇文章 + 关于 + WebLab）：header 里的
  `href="#main"` 指向一个不存在的 id，键盘用户按下去毫无反应。补 `id="main"`。
- **两篇文章此前根本没有 front matter**：`2022-08-08-webpack-move-vite.md` 与
  `2023-05-08-vue3-vite-study.md` 从 1.0.0 起就是裸 Markdown。Jekyll 对没有 YAML 头的
  `_posts` 文件照样排期、照样输出 HTML，只是不套任何 layout（实测产物里没有 `<html>`
  也没有 `<head>`），所以这两页一直是无样式、无导航、`<title>` 为空的裸正文，
  也因为缺 `categories` / `tags` 而不在分类归档与标签云里。补齐 front matter，
  并把首屏那行与标题同文的 `##` 删掉（否则标题下面立刻复读一遍），
  `_posts/2026-06-05-ai-sdd.md` 同一处一并删。
- **合集自检脚本永远通过**：USAGE 用的键名是 `posts`，`_data/series.yml` 实际是 `order`，
  核对数恒为 0、输出永远是「失效 无」。改成 `order`，并加一条 assert 防止自检脚本自己静默通过。
  真实核对结果：34 条连载链接 + 5 条精选，0 失效。
- **SEO 自查四条重写**：第 1 条 `grep -l '<h1' | wc -l` 数的是「有 H1 的文件数」，
  永远等于文章总数，出两个 H1 也发现不了；改成统计异常项，并补面包屑锚点、
  noindex 与 sitemap/JSON-LD 一致性两条。
- 文档口径纠正三处：`_data/series.yml` 注释里 date 与文件名不一致「两处」实为四处（逐条列出）；
  README `/demo.html` 的示例数按页面实际条目写 19（`demo/` 目录仍是 18）；
  2.0.0 条目与 sitemap 注释里「Liquid 语法错误导致条件恒假」的说法不成立——那种写法
  errors 为空、也不报 Warning，是把条件**求值反向**（只保留外链封面），且 1.0.0 没有
  `sitemap.xml` 文件，「11 条」是本次开发的中间态而非线上历史。
  2.0.0 的 tag 说明里留着旧表述，已推送的 tag 不重写。
- `noindex` 的页面不再声明 JSON-LD，与 USAGE「noindex 是整站唯一的收录开关」对齐
  （块数 161 → 160，CollectionPage 26 → 25）。
- **自检脚本自己也要跑一遍**：把 USAGE 那六条原样执行，暴露出两处脚本自身的错——
  sitemap 检查用 `u.split('/better-blog/')[-1]` 取首页地址时得到空串，把站点根目录当成
  「无落盘文件」误报（首页是 `index.html`）；JSON-LD 的预期块数写在 404 撤销结构化数据
  之前（161 → 160）。同时补一句「必须带着重建那一条一起跑」：对着上一次残留的产物目录跑，
  刚修完的问题会整片报「异常」。
- 顺带记一个坑：Liquid 4 会把 `{% comment %}` 体内的花括号标签当块解析，一路吃到
  `endcomment` 才报「不是合法分隔符」，构建直接失败——所以文档注释里举反例，
  只能写不带花括号的读法。

## 2.0.0 — 2026-09-22

从 1.0.0 起：十余次提交、两百余个文件（逐条用 `git log --oneline 1.0.0..2.0.0` 与
`git diff --shortstat 1.0.0..2.0.0` 核对；这里不写具体数字，因为记变更的这次提交自己也在区间里，
任何精确值都会在下一个 commit 之后过期）。这一版的主线是**把站点从「写着方便」
改成「读着舒服、爬着看得懂」**——一次编辑杂志风改版，加一条完整的检索层治理。

### 新增（阅读体验）

- 编辑杂志风改版：刊头、正文排版、目录、分类归档页与工具箱菜单重做。
- 合集与精选：`_data/series.yml` 提供连载条与系列内翻页，`_data/picks.yml` 提供首页编辑精选。
- 回访链路：阅读位置续读浮条（7 天有效、读完即清）、窄屏目录底部抽屉、正文图片灯箱、
  主题偏好定档与无闪烁首屏。
- 阅读偏好、文内链接预览、金句分享卡片；书架、篇末收束层与主题日蚀转场。
- 蒲公英飘籽动效回到首页刊头（改为铺在刊头内、颜色取自 `--ink-4`，滚出视口与切后台停帧）。
- 8 篇文章：pnpm 并发组、gods-eye-view 免密跑通、三家 agent 并行工作区、周榜 skill 类目、
  三处静默改动、agent 自动出图工具链、Next.js AVIF 开关、cloudflare 安全审计双校验器。

### 新增（检索层与工程）

- `_includes/jsonLd.html`：结构化数据一次给全 `BlogPosting`(66) / `BreadcrumbList`(66) /
  `CollectionPage`(26) / `WebSite` / `Blog` / `Person`（含 `sameAs`），共 161 个 JSON-LD 块。
- sitemap 补 `<image:image>`（32 条站内封面）、`<lastmod>`，并把收录范围收敛到
  「导航可达页 + 全部文章」；robots.txt 的 Sitemap 指向真正存在的地址。
- 版本号管理：`site.version`、`CHANGELOG.md`、`LICENSE`（代码 MIT）与
  `LICENSE-CONTENT.md`（文章 CC BY-NC-SA 4.0），页脚展示版本并可回溯到本文件。
- README 重写为站点首页说明（中文为主 + 英文摘要段）；USAGE.md 补
  「发布链路与分支」「写一篇新文章」「检索层自查」三节。

### 修复

- **线上主分支缺内容**：线上产物落后 `master` 十余次提交（本次一并追平），
  `sitemap.xml`、`feed.xml`、`categories.html`、
  `series.html`、`tools.html` 全部 404，而 `robots.txt` 与每页 `<link rel=alternate>` 正指向它们。
  根因是 `deploy-github.sh` 推的是当前分支（`main`），Workflow 只监听 `master`。
- 站点地图的封面图段（1.0.0 没有 `sitemap.xml` 这个文件，线上一直 404，所以这是新增而非修复）：
  写的时候踩到一个「读起来对、跑起来反」的坑——`if post.cover and post.cover contains '://' == false`
  在 Liquid 里既不报语法错也不报 Warning，却把条件求值成「只保留外链」，产物里 11 条
  `<image:loc>` 全是失效图床、站内 32 张封面一条没进。改成 `unless post.cover contains '://'`
  一层独立判断后为 32 条。这类问题构建日志看不出来，只能靠数产物，见 USAGE.md「检索层自查」。
- 44 个文章配图工作笔记（42 份 `assets/img/{slug}/prompts/*.md` + 2 份 `outline.md`，首行都带
  front matter，会被 Jekyll 当页面渲染）、与 `feed.xml` 内容等价的
  `rss.xml`、iconfont 预览页、`test.html` 被 Jekyll 当公开页渲染并挂在域名下 → 全部排除。
- 分页页（`/page2/` … `/page9/`）与首页共用 `<title>` 与 description，在 Search Console 表现为
  「重复网页」；分页页改用短标题前缀 + 页码。`demo/openMapDemo` 与文章页 `<title>` 撞车一并错开。
- 63 处正文重复 H1（47 处与标题同文删行，其中 1 处藏在 banner 图后面、渲染层的兜底够不着；
  16 处与标题不同文、降级为 `##`），每篇文章现在恰好 1 个 H1；
  删掉的那批同时让 `post.excerpt` 恢复成真正的导语——原先上一篇/下一篇预览与 feed 的
  `<summary>` 只是把标题重复一遍。
- 11 篇的外链封面逐个复测：timgsa 域名停服、zhimg 防盗链、vscode 官网 404，
  10 篇的 `cover` 注释下线（列表卡片回到纯文字版式，不再破图），
  仅存可访问的 img.alicdn.com 一张已拉取本地转 1440×480 webp。
- 三处窄屏横向溢出（分享栏居中写法、行内 code 的 40 位 commit hash、宽表格）；
  悬浮按钮在窄屏按滚动方向收放。
- `categories` 统一写成 YAML 列表：原先空格分隔的写法被 Jekyll 按空白拆碎
  （`categories: AI frontend` 会变成两个不存在的分类），分类收敛到 13 个。
- 品牌名与 SEO 标题分离：`title` 继续是刊头署名，新增 `seo_title` / `seo_home_title` /
  `seo_archive_title` 只进 `<title>` 与 `og:title`，把「前端博客」这类真正被搜的词放进标题。

### 变更

- 首页「热榜」改为手工挑选的编辑精选：Waline 服务端只暴露单路径读取，没有全站排行接口。
- 首页刊头恢复蒲公英动效，纳入 `prefers-reduced-motion` 治理（该偏好下只画一帧静止）。

## 1.0.0 — 2026-09-06

追溯打标：`master` 上第一个可用的完整状态——Jekyll 4.3 + Vite 6 构建、H2O 主题改版前的文章体系、
Waline 评论与阅读量、Cloudflare Workers 部署，以及账号密码管理助手相关文章的许可证表述修正
（GPL-3.0）。此后的内容都归在 2.0.0。
