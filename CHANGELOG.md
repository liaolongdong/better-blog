# 更新日志

站点版本号与 git tag 一一对应，tag 打在 `master` 上（Pages 的构建 Workflow 只监听 `master`，
见 [USAGE.md](./USAGE.md) 的「发布链路与分支」）。版本号规则与递增口径见 USAGE.md 的
「版本号与 tag 约定」。

## 2.0.0 — 2026-09-22

从 1.0.0 起：15 次提交、214 个文件、+14665/−563（`git diff --shortstat 1.0.0..2.0.0` 的口径）。
这一版的主线是**把站点从「写着方便」改成「读着舒服、爬着看得懂」**——
一次编辑杂志风改版，加一条完整的检索层治理。

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

- **线上主分支缺内容**：`master` 落后 15 次提交（含本次检索层改版），
  `sitemap.xml`、`feed.xml`、`categories.html`、
  `series.html`、`tools.html` 全部 404，而 `robots.txt` 与每页 `<link rel=alternate>` 正指向它们。
  根因是 `deploy-github.sh` 推的是当前分支（`main`），Workflow 只监听 `master`。
- sitemap.xml 一处 Liquid 语法错误（`a and b contains '://' == false`）让条件恒假：
  构建只报 Warning，39 篇站内封面实际只进了 11 条。改为 `unless` 嵌套判断。
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
