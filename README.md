<div align="center">

# Better 的前端与 AI 技术博客

**廖龙东（网名 Better，写作廖小新）的个人博客源码仓库 —— 从 2016 年写到现在的 React、Vue、npm、Chrome 插件与 AI Agent 工具链记录。**

[![在线访问](https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E8%AE%BF%E9%97%AE-liaolongdong.github.io%2Fbetter--blog-0A66C2?style=for-the-badge&logo=githubpages&logoColor=white)](https://liaolongdong.github.io/better-blog/)
[![Deploy Jekyll site to Pages](https://img.shields.io/github/actions/workflow/status/liaolongdong/better-blog/jekyll.yml?style=for-the-badge&logo=githubactions&logoColor=white&label=Pages%20build)](https://github.com/liaolongdong/better-blog/actions/workflows/jekyll.yml)
[![66 篇文章 · 2016 年更新至今](https://img.shields.io/badge/66%20%E7%AF%87%E6%96%87%E7%AB%A0%20%C2%B7%202016%20%E5%B9%B4%E8%87%B3%E4%BB%8A-updating-2ea44f?style=for-the-badge)](https://liaolongdong.github.io/better-blog/categories.html)

<br />

[![v2.0.0](https://img.shields.io/badge/version-2.0.0-57606a?style=for-the-badge)](./CHANGELOG.md)
[![代码 MIT · 文章 CC BY-NC-SA 4.0](https://img.shields.io/badge/%E4%BB%A3%E7%A0%81%20MIT%20%C2%B7%20%E6%96%87%E7%AB%A0%20CC%20BY--NC--SA%204.0-8a6d3b?style=for-the-badge)](./LICENSE)

</div>

---

这个仓库是 <https://liaolongdong.github.io/better-blog/> 的全部源码：Jekyll 模板、Vite 构建的样式与脚本、18 个可交互 demo、一个浏览器里的在线编辑器，以及 66 篇按时间沉淀下来的文章。

它不是一套主题，也不打算被复用。所有排版决策（刊头、目录抽屉、金句分享卡、阅读位置续读）都围着「中文技术长文怎么读才不累」这一件事做。如果你只是想读内容，直接去上面那个链接；如果你想改它、或者照着搭一个同类站点，下面的构建说明和 [USAGE.md](./USAGE.md) 是按真实踩坑顺序写的。

## 站点里有什么

| 栏目 | 地址 | 内容 |
| --- | --- | --- |
| 首页信息流 | [/](https://liaolongdong.github.io/better-blog/) | 横向缩略图卡片，每页 8 篇，带合集连载条与编辑精选 |
| 分类归档 | [/categories.html](https://liaolongdong.github.io/better-blog/categories.html) | 13 个分类，一篇文章可同时归属多个 |
| 合集 | [/series.html](https://liaolongdong.github.io/better-blog/series.html) | 10 组连载，文章页内自动挂上下篇导航 |
| 标签云 | [/tags.html](https://liaolongdong.github.io/better-blog/tags.html) | 全量标签检索 |
| 示例 | [/demo.html](https://liaolongdong.github.io/better-blog/demo.html) | 19 条可直接打开的示例入口（来自 `demo/` 下 18 个目录，拖拽、shake、echarts、倒计时红包等） |
| WebLab | [/weblab.html](https://liaolongdong.github.io/better-blog/weblab.html) | 浏览器里的 HTML / CSS / JS 编辑器，无需账号 |
| 工具箱 | [/tools.html](https://liaolongdong.github.io/better-blog/tools.html) | 自研 Chrome 插件产品页 |
| 关于 | [/about.html](https://liaolongdong.github.io/better-blog/about.html) | 作者信息与职业时间线 |

### 文章分类分布

13 个分类不是凑出来的标签，是按「搜这个词的人想找什么」归的类：

| 分类 | 篇数 | 分类 | 篇数 |
| --- | --- | --- | --- |
| 前端工程化 | 15 | Chrome插件 | 4 |
| AI | 13 | 工具与效率 | 4 |
| 开源实测 | 11 | 服务器与部署 | 4 |
| JavaScript | 10 | Vue | 3 |
| H5与微信 | 6 | 随笔 | 2 |
| 算法与面试 | 5 | React / CSS | 各 1 |

写作时间跨度 2016-06 至今。早期以业务踩坑和手记为主，2026 年起重心转向开源项目与 AI Agent 工具链的实测——这类文章多附可复现的命令和真实跑出来的数据。

## 技术栈

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 站点生成 | Jekyll 4.3 + Liquid + kramdown + rouge | 纯静态，无运行时服务端 |
| 资源构建 | Vite 6 + Sass + PostCSS + terser | 只编译 `dev/` 与 `demo/` 源码，**没有 dev server** |
| 前端运行时 | 原生 JS + jQuery 3.3（历史遗留）+ ACE | 动效与交互均为自研，不引框架 |
| 包管理 | pnpm 11（`packageManager` 锁定）· Node 22 | CI 按 `.node-version` 安装 |
| Ruby | Bundler + `Gemfile`（jekyll, jekyll-paginate） | CI 用 Ruby 3.1 |
| 托管 | GitHub Pages（project site，`baseurl: /better-blog`） | Actions 构建，见下 |
| 评论 / 阅读量 / 点赞 | Waline，自部署在 Cloudflare Workers | 配置在 `_config.yml` 的 `waline` |
| 统计 | Cloudflare Web Analytics + 百度统计 | 页脚 PV/UV |

## 环境要求

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | 22 | 见 `.node-version`，CI 按该文件安装 |
| pnpm | 11 | 见 `package.json` 的 `packageManager` 字段 |
| Ruby + Bundler | 3.1（CI） | Jekyll 4.3 运行所需，见 `Gemfile` |

## 本地开发

```bash
pnpm install      # 前端构建依赖
bundle install    # Jekyll 及其插件

pnpm dev          # 同时跑「Vite 监听构建」与「Jekyll 本地服务」-> http://localhost:4000
```

也可以拆成两个终端：

```bash
pnpm dev:assets   # 只监听构建 assets/ 与 demo/ 下的静态资源
pnpm dev:server   # 只启动 Jekyll 服务（端口用 -- --port 4001 覆盖）
```

> 本项目**没有 Vite dev server**，页面全部由 Jekyll 提供。Vite 只做 `build --watch`，
> 把 `dev/` 与 `demo/` 下的源码编译成 `.min.js` / `.min.css`。

## 构建与部署

```bash
pnpm build          # 构建全部静态资源（主站 + demo），CI 用的就是这条
pnpm build:assets   # 只构建主站资源
pnpm build:demo     # 只构建 demo 资源
pnpm build:site     # 构建静态资源并生成 _site（部署到自有服务器时用）

pnpm deploy         # 交互式提交并推送当前分支（提交前列出改动并拦密钥，推送前需确认）
pnpm deploy:ali     # 阿里云服务器：拉代码 -> pnpm install -> pnpm build:site
```

推送到 GitHub 后由 `.github/workflows/jekyll.yml` 完成构建发布：Node 22 + pnpm 装依赖并 `pnpm build`，再用 Ruby 3.1 跑 `bundle exec jekyll build`，最后 `actions/upload-pages-artifact` + `deploy-pages`。

> ⚠️ 该 workflow 的触发分支写死为 `master`。本地在 `main` 上提交不会触发部署，
> 需要 `git push origin main:master`。完整发布链路和这个坑记录在
> [USAGE.md 的「发布链路与分支」一节](./USAGE.md)。

## 产物约定

`assets/**` 与 `demo/**` 下的 `.min.js` / `.min.css` **不入库**（见 `.gitignore`），一律由 CI 或部署机现场构建。例外是 `dev/libJs`、`dev/libCss` 下的第三方预压缩库，以及 `demo/*/js/vue.min.js`、`demo/echartsDemo/lib/*.min.js` 这类白名单文件——它们是源文件，由构建原样复制到发布目录，不再二次加工。

## 目录结构

```
.
├── _config.yml           # 站点设置：SEO 口径、导航、Waline、构建排除项
├── _data/                # tools.yml 产品 · series.yml 合集 · picks.yml 编辑精选
├── _includes/            # Liquid 片段；seoMeta.html + jsonLd.html 是全站的 SEO 出口
├── _layouts/             # post / default / aboutTemplate / labTemplate / demoTemplate
├── _posts/               # 文章（YAML front matter + Markdown）
├── _plugins/             # Jekyll Ruby 插件
├── dev/                  # 源码：js / sass / libJs / libCss（构建输入，不发布）
├── demo/                 # 18 个交互示例，各自带 js 与 css 源码
├── assets/               # 构建产物 + 图片 + 字体（产物不入库）
├── ace/                  # 在线编辑器用的 ACE 源码
├── feed.xml              # 完整的 Atom 全文订阅源
├── sitemap.xml           # 站点地图（首页 + 导航页 + 全部文章）
├── robots.txt            # 爬虫规则，Sitemap 指向站内真实地址
├── README / USAGE / CHANGELOG / LICENSE* # 仓库级文档与许可（在 exclude 列表里，不会被渲染成站点页）
└── .github/workflows/    # Pages 部署流水线
```

## SEO 与结构化数据

站点的检索层集中在这三处，改标题或描述前先看这里的注释，那里写明了每个字段的取舍：

- `_config.yml` —— `title`（品牌名，进刊头与 `og:site_name`）与 `seo_title`（只进 `<title>` 与 `og:title`）是两个口径，不合并。
- `_includes/seoMeta.html` —— 输出 `<title>`、description、canonical、robots、Open Graph、Twitter card、`article:*`。
- `_includes/jsonLd.html` —— 文章页 `BlogPosting` + `BreadcrumbList`，栏目页 `CollectionPage`，首页 `WebSite` + `Blog` + `Person`。

- `sitemap.xml` / `robots.txt` —— 收录范围收敛到「导航可达页 + 全部文章」，站内封面带 `<image:image>`；分页与配图工作笔记一律不进。

写新文章时的 front matter 约定、封面图尺寸要求、以及 `categories` 会被 Jekyll 按空格切开这类坑，都写在 [USAGE.md 的「写一篇新文章」一节](./USAGE.md) 里。

## 许可与版本

- **代码**（`dev/`、`demo/`、`_includes/`、`_layouts/`、`_plugins/`、构建与配置文件）：[MIT](./LICENSE)。拿去用、改、再分发都不必打招呼。
- **文章与配图**（`_posts/`、`assets/img/`）：[CC BY-NC-SA 4.0](./LICENSE-CONTENT.md)。署名 + 非商业 + 相同方式共享，公众号与个人博客转载按这三条走就行；文中贴的第三方代码片段沿用其原始许可。
- **版本**：只有一个来源，就是 master 上的 git tag。`1.0.0` 是 2026-09-06 的线上状态（追溯打标），`2.0.0` 是 2026-09-22 的编辑杂志风改版 + 检索层治理，逐条变更见 [CHANGELOG.md](./CHANGELOG.md)，递增规则与发版步骤见 [USAGE.md](./USAGE.md)。

分两段授权的理由：整仓套 MIT 等于允许别人把文章收进付费内容；整仓套 CC 又会让想复用这套 Jekyll + Vite 构建配置的人背上非商业限制，等于没开放。

---

## English summary

This is the source repository for a personal frontend & AI engineering blog written in Chinese, maintained continuously since June 2016.

**Live site:** <https://liaolongdong.github.io/better-blog/> · **Author:** 廖龙东 (Liao Longdong), online as *Better* / *廖小新*

The site is a static Jekyll 4.3 build. Vite 6 compiles Sass and JavaScript into minified assets during CI; GitHub Actions publishes the result to GitHub Pages as a project site. Comments, page views and reactions run on a self-hosted Waline instance deployed to Cloudflare Workers. No third-party analytics script is required to read the content.

Content covers 66 posts across 13 categories: frontend build engineering (webpack → Vite migrations, npm/yarn/pnpm, environment switching), JavaScript internals and algorithms, Vue and React, H5 and WeChat Mini Program work, Chrome extension development, server deployment on Aliyun and Nginx, and — since 2026 — hands-on evaluations of open-source AI Agent tooling. The tooling write-ups generally ship with the exact commands and measured output behind their conclusions.

Beyond articles, the repo contains 18 runnable interaction demos, an in-browser HTML/CSS/JS editor (WebLab), and product pages for three self-built Chrome extensions.

**Run it locally:** `pnpm install && bundle install && pnpm dev` → <http://localhost:4000>. Build artifacts under `assets/` and `demo/` are gitignored and rebuilt in CI, so a fresh clone must build before the CSS and JS resolve.

**Repository layout:** `_posts/` Markdown articles · `_includes/` and `_layouts/` Liquid templates (SEO metadata lives in `_includes/seoMeta.html` and `_includes/jsonLd.html`) · `dev/` unminified sources · `demo/` standalone examples · `_data/` collections, curated picks and product listings.

**Keywords:** frontend blog, Jekyll theme source, GitHub Pages project site, Vite build pipeline, React, Vue, Node.js, npm, pnpm, Chrome extension, WeChat Mini Program, AI Agent, web performance, Chinese tech blog, 前端博客, 廖龙东

## 相关项目

作者自研的三款 Chrome 插件，源码与文档均为公开仓库：

| 项目 | 仓库 |
| --- | --- |
| 账号密码管理助手 | [liaolongdong/account-password-helper](https://github.com/liaolongdong/account-password-helper) |
| 文件转换助手 | 见 [/tools.html](https://liaolongdong.github.io/better-blog/tools.html) |
| 跨域代理助手 | [liaolongdong/cross-origin-proxy](https://github.com/liaolongdong/cross-origin-proxy) |

---

<div align="center">

如果这些记录帮到了你，点个 Star 会让它们更容易被别人搜到。

[![Star this repo](https://img.shields.io/github/stars/liaolongdong/better-blog?style=for-the-badge&logo=github&label=Star%20this%20repo&color=yellow)](https://github.com/liaolongdong/better-blog/stargazers)

Built by [廖龙东 / Better](https://github.com/liaolongdong) · [liaolongdong.github.io/better-blog](https://liaolongdong.github.io/better-blog/)

</div>
