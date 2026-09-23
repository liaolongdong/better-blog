# 快速使用指南

> 命令一律使用 pnpm（`package.json` 的 `packageManager` 已锁定版本）。
> 环境要求见 [README.md](./README.md)。

## 🚀 快速开始

### 开发环境

```bash
# 推荐：一条命令同时跑 Vite 监听构建 + Jekyll 本地服务
pnpm dev
# Jekyll 服务默认地址 http://localhost:4000

# 只监听构建静态资源（自己另起 Jekyll，或只关心产物时）
pnpm dev:assets

# 只启动 Jekyll 服务（产物已是最新时）
pnpm dev:server
```

> ⚠️ 本项目**没有 Vite dev server**，`vite.config.js` 中也没有 `server` 配置块。
> Vite 以 `build --watch` 方式工作，只负责把源码编译成 `.min.js` / `.min.css`；
> 页面由 Jekyll 提供。想换端口请用 `pnpm dev:server -- --port 4001`。

### 生产构建

```bash
# 构建全部静态资源（主站 + demo），CI 用的就是这条
pnpm build

# 分开构建
pnpm build:assets   # 只构建主站资源 -> assets/js|css/*.min.js|css
pnpm build:demo     # 只构建 demo 资源 -> demo/*/js|css/*.min.js|css

# 构建静态资源 + 生成 _site（部署到自有服务器时用）
pnpm build:site
```

### 部署

```bash
pnpm deploy       # 交互式提交并推送「当前分支」
pnpm deploy:ali   # 阿里云服务器：拉代码 -> pnpm install -> pnpm build:site
```

GitHub Pages 的构建发布由 `.github/workflows/jekyll.yml` 独立完成：
Node 22 + pnpm 装依赖并 `pnpm build`，再用 Ruby 3.1 跑 `bundle exec jekyll build`。

> ⚠️ `pnpm deploy` 推的是当前分支，而 workflow 只监听 `master`——两者的口径坑见下一节。

## 🚦 发布链路与分支

这条链路有一个会让人白等几分钟的断点，先说结论：**Actions 只在 `master` 上触发。**

| 环节 | 实际行为 |
| --- | --- |
| `pnpm deploy` → `deploy-github.sh` | `git pull` 当前分支 → `git add .` → 交互式输入 commit 信息 → `git push origin <当前分支>` |
| `.github/workflows/jekyll.yml` | `on.push.branches: ["master"]`，另支持 `workflow_dispatch` 手动触发 |
| Pages 地址 | project site，`baseurl: /better-blog` → <https://liaolongdong.github.io/better-blog/> |

本地日常在 `main` 上开发，`pnpm deploy` 就只会把提交推到 `main`，**不会触发任何构建**。
两种收尾方式，任选其一：

```bash
# 方式一：把 main 的内容推成 master（常规发布）
git push origin main:master

# 方式二：已在 master 上时，去 Actions 页面点 "Run workflow" 手动触发
```

> 站点根路径 <https://liaolongdong.github.io/> 404 是正常现象：这是 project site
> 而非 user site，内容全部挂在 `/better-blog/` 下。别为了「让根路径能打开」去动
> `_config.yml` 里的 `baseurl`，那会让所有资源路径失效。

`origin` 目前仍指向重命名前的 `liaolongdong.github.io.git`，靠 GitHub 的重定向生效。
想让 `pnpm deploy`、badge、CI 链接口径一致，可以顺手纠正：

```bash
git remote set-url origin https://github.com/liaolongdong/better-blog.git
```

发布后建议按这三条自查（都是纯读操作，不改变仓库）：

```bash
curl -sI https://liaolongdong.github.io/better-blog/ | head -1      # 200
curl -s  https://liaolongdong.github.io/better-blog/sitemap.xml | grep -c '<loc>'
curl -s  https://liaolongdong.github.io/better-blog/feed.xml | head -5
```

## 🏷 版本号与 tag

版本号只有一个真实来源：**master 上的 git tag**。`_config.yml` 的 `site.version`、
`package.json` 的 `version`、`CHANGELOG.md` 顶部条目，三处必须等于最新 tag；
页脚那枚 `v2.0.0` 读的就是 `site.version`（置空则不显示）。

递增口径不按语义化版本的严格定义，按「老读者进来要不要重新找路」判断：

| 位置 | 什么时候 +1 | 例 |
| --- | --- | --- |
| 主版本 | 信息架构、视觉体系、导航结构变了 | 1.0.0 → 2.0.0（编辑杂志风改版 + 合集/工具箱/分类归档） |
| 次版本 | 新增一整块能力或一类内容，原有位置不动 | 加站内搜索、加英文版 |
| 修订号 | 修 bug、改文案、补文章，不动结构 | 2.0.1 |

发版动作（顺序不能反：tag 必须打在 master 的提交上，构建产物与 tag 才同源）：

```bash
# 1. 三处版本号与 CHANGELOG 改齐后提交（别用 git add -A，仓库里有并发会话的改动）
git add _config.yml package.json CHANGELOG.md
git commit -m "chore(release): v2.1.0"

# 2. 推到 master，等 Actions 绿
git push origin main:master

# 3. 在新 master 上打附注 tag，再单独推 tag
git tag -a 2.1.0 -m "2.1.0 一句话摘要"
git push origin 2.1.0
```

存量：`1.0.0` 打在 2026-09-06 的 master（追溯打标），`2.0.0` 是 2026-09-22 的改版 + 检索层治理。
CHANGELOG 只记已经进 master 的内容——还在 `main` 上的功能没上线，不该出现在版本记录里，
所以写它的时机是「推到 master 之后」，不是「写完代码之后」。

## ✍️ 写一篇新文章

新建 `_posts/2026-09-22-slug.md`，文件名决定了 URL。front matter 的最小完整形态：

```yaml
---
layout: post
title: 文章标题
subtitle: 一句话副标题，列表页与搜索引擎摘要都用它
date: 2026-09-22
categories: [前端工程化, 开源实测]   # 必须用中括号列表，见下方陷阱
cover: /assets/img/slug/banner.webp
tags: pnpm npm 前端小技巧            # tags 用空格分隔，与 categories 规则相反
---
```

| 字段 | 必填 | 作用 |
| --- | --- | --- |
| `title` | 是 | 文章页 H1、`<title>` 与 `og:title` 的主体 |
| `subtitle` | 是（建议） | 列表页副标题；`<meta name="description">` 的第二顺位 |
| `seo_description` | 否 | 只在「想要的搜索摘要 ≠ 副标题」时写，优先级高于 `subtitle` |
| `categories` | 是 | 分类归档页、`article:section`、面包屑中段 |
| `tags` | 是（建议） | 标签页与 `article:tag`；出现满 12 次进侧栏推荐位 |
| `cover` | 是（建议） | 首页/列表缩略图、`og:image`、sitemap 的 `<image>` 项 |
| `noindex` | 否 | 写了就不进 `<meta name=robots>` 的 index 分支，同时也从 sitemap 里剔除。|

`noindex: true` 是给「文章还在、但不想被搜到」准备的口子——写了公司内部项目、
点名了同事、或者内容马上要撤。它是整站唯一的开关：`_includes/seoMeta.html` 与
`sitemap.xml` 都读它，所以不需要两头记，但 `feed.xml` 照旧会带上最近 20 篇（订阅源不参与排名）。

正文不要再写一遍 H1。`_layouts/post.html` 已经用 `page.title` 渲染了刊头标题，
正文再来一个同名 `# ...` 就是第二个 H1。

`_plugins/add_baseurl_filter.rb` 的 `strip_leading_title` 会在渲染时兜一道，但它只在
**正文首个块级元素**就是 H1、且文本与 `title` 完全相等（忽略大小写、剥掉标签）时才删。
两个漏网口子：标题用全角括号引号而正文写成半角，就不相等；首行放了 banner 图，
H1 不再是首个块级元素，也不会被剥。这两种都会原样渲染出两个 H1，别指望这层兜底。
新文章一律从 H2（`##`）起头。

清掉正文 H1 还有一层收益：`post.excerpt` 取的是正文首个块，H1 留着时
上一篇/下一篇的预览句和 feed 的 `<summary>` 就只是把标题重复一遍，没有导语。
历史文章里 63 处正文 H1 已于 2026-09-22 清完（与标题重复的删行、不重复的降级为 `##`），
判据是构建产物里真实的 `<h1>` 个数，不是源文件里有没有这行。

### 分类怎么选

分类是主题聚合的口径，一篇可以归多个。现有 13 类，按篇数排：前端工程化(15)、
AI(13)、开源实测(11)、JavaScript(10)、H5与微信(6)、算法与面试(5)、工具与效率(4)、
服务器与部署(4)、Chrome插件(4)、Vue(3)、随笔(2)、React(1)、CSS(1)。

优先复用现有分类。确实需要新增时，同步想清楚这一类会不会只有 1～2 篇——
一个孤零零的分类页对搜索引擎和读者都是薄内容。

### 三个会静默生效的陷阱

1. **`categories: A B` 会被拆成两类。** Jekyll 对空格分隔的字符串按空白切分，
   所以 `categories: 前端工程化 开源实测` 得到的是「前端工程化」和「开源实测」两个分类，
   而 `categories: AI frontend` 会得到三个碎片。中文分类名想带空格或想一次给多个，
   一律写成 YAML 列表 `[A, B]`。`tags` 相反，它**期望**空格分隔。
2. **`date` 在未来，文章不会出现在任何地方。** Jekyll 静默跳过 `site.posts` 里的
   未来文章，不进列表、不进 sitemap、也不报错。草稿期用 `_drafts/`，
   要预发布就在 `_config.yml` 里临时开 `future: true`。
   仓库里留着一篇 `2100-10-25-practice-demo.md` 正是这种情况，它是格式示例，不参与构建。
3. **`cover` 只能是站内图。** 站内封面会走 `_includes/coverSrc.html` 拼 `baseurl`，
   外链则跳过拼接（拼了会变成 `/better-bloghttps://...`），并且 `og:image` 与 sitemap 的
   `<image>` 项都对外链关闭。历史上 11 篇贴的是外链封面（timgsa.baidu.com、pic*.zhimg.com、
   code.visualstudio.com 这类），2026-09-22 逐条 curl 复测：timgsa 域名已停服连不上、
   zhimg 防盗链 404/403、vscode 那张改版后 404，只剩 img.alicdn.com 一张可取——
   那张已下载到本地转成 1440×480 webp，其余 10 篇的 `cover` 已在 front matter 里注释下线。
   另一个写法陷阱是 `cover: ''`：Liquid 里空字符串是**真值**，`{% if post.cover %}` 照样进分支，
   于是渲染出 `<img src="/better-blog">` 的破图。没有封面就整行删掉，别留空串。
   没写封面时列表卡片走纯文字版式、`og:image` 回落到 `site.social.og_default_image`，都不会破图。

### 封面图

`assets/img/{slug}/` 下放成品图。分享卡按 1200×630 出，列表缩略图用 `.webp`。
配图的工作笔记（出图 prompt、大纲）留在同一目录的 `.md` 里即可——`_config.yml`
已排除 `"assets/**/*.md"`，它们不会被渲染成公开页面。这条排除项别删：
一旦去掉，几十份英文出图笔记会变成域名下的薄页面。

### 合集与精选

连载关系写在 `_data/series.yml`，首页手工挑选的推荐写在 `_data/picks.yml`。
每条合集的篇目放在 **`order`** 键下（不是 `posts`——写错键名不会报错，只会被静默忽略，
合集凭空变成空壳），值必须是文章的**完整 URL 路径**（含 `.html`，不含 `baseurl`）：

```yaml
- slug: my-series
  title: 合集名
  lede: 一句话简介
  order:
    - /2026/09/22/slug.html
```

写错不会构建失败，而是在文章页的连载条上直接渲染出错误文本。加完跑一次构建，
用 `_posts` 里的实际 permalink 逐条核对（这段脚本同时校验 series 与 picks）：

```bash
python3 - <<'PY'
import re, glob, yaml
urls = set()
for f in glob.glob('_posts/*.md'):
    t = open(f, encoding='utf-8').read()
    m = re.search(r'^date:\s*([\d-]+)', t, re.M)
    slug = re.sub(r'^\d{4}-\d{2}-\d{2}-', '', f.split('/')[-1])[:-3]
    if m:
        y, mo, d = m.group(1).split('-')
        urls.add(f'/{y}/{mo}/{d}/{slug}.html')
series = yaml.safe_load(open('_data/series.yml'))
bad = [(s['slug'], p) for s in series for p in s.get('order', []) if p not in urls]
checked = sum(len(s.get('order', [])) for s in series)
picks = yaml.safe_load(open('_data/picks.yml'))
bad += [('picks', p['url']) for p in picks if p.get('url') not in urls]
print(f'核对 {checked} 条连载链接 + {len(picks)} 条精选：失效 {bad or "无"}')
assert checked > 0, '一条都没核对到——键名是不是又写成 posts 了？'
PY
```

最后那行 assert 是这段脚本的关键：它自己也可能「静默通过」，键名写错时核对数是 0，
输出照样是「失效 无」。

## 📁 开发工作流程

### 1. 修改主站样式

```bash
# 编辑 dev/sass/ 下的 .scss 文件（dev/sass/common/ 是被 @import 的片段，不单独产出）
pnpm dev:assets   # 监听模式，保存即重新构建
```

### 2. 修改主站 JavaScript

```bash
# 业务代码在 dev/js/，第三方库在 dev/libJs/
pnpm dev:assets
```

- `dev/js/*.js` 与 `dev/libJs/*.js`（非 `.min.js`）会被打包，产物外层自动包一层 IIFE，
  避免多文件间的全局变量冲突。
- `dev/libJs/*.min.js` 与 `dev/libCss/*.min.css` 是**已预压缩的第三方库**，不进打包管线，
  构建时原样复制到 `assets/js|css/`。新增此类文件直接放进去即可，无需改配置。

### 3. 修改 Demo 项目

```bash
# 编辑 demo/[项目名]/js|css/ 下的文件
pnpm build:demo
```

- 入口按目录自动扫描，新增 demo 目录无需改配置。
- 同一个 demo 的 `css/` 下若同时存在 `index.css` 与 `index.scss`，**只有 `.scss` 会作为入口**
  （两者会争用同一个 `[name].min.css` 输出名）。`.css` 仍可被 HTML 直接引用。
- `demo/*/css/base.css` 属于「已预处理完成的静态样式」，构建时原样复制成 `base.min.css`，
  不走打包管线——因为多份 `base.css` 内容完全相同，Vite 会按内容对 CSS 资源去重，
  走管线会导致大部分 demo 拿不到自己的 `base.min.css`。
- `demo/` 下 33 个页面里有 15 个**没有 front matter**（各 `test.html`、`cssTipsDemo/*`、`ai/*` 等），
  Jekyll 把它们当静态文件原样拷贝、**不执行 Liquid**，所以这类页里不能写 `{{ site.baseurl }}`——
  花括号会作为字面量输出到线上。它们的图标声明因此写相对路径 `../../favicon.*`，
  而 `../../` 只对「距站点根两层」的 `demo/<目录>/<页>.html` 成立，页面挪进更深一层就静默 404、构建不报错。
  另外 18 个走 `layout: demoTemplate` → `_includes/demoHead.html`，声明由那份 include 统一给，别在这里手抄。
  新增静态 demo 页后跑一条：`grep -rL 'rel="icon"' $(find _site/demo -name '*.html')`，输出应为空。

### 4. 修改 Liquid 模板

`_includes/`、`_layouts/` 下的改动由 Jekyll 处理，`pnpm dev` 会自动重新渲染，
无需跑 Vite。

## 🔍 故障排除

### 构建失败

```bash
rm -rf node_modules/.vite   # 清理 Vite 缓存
pnpm install                # 重装依赖
pnpm build
```

若报 `SyntaxError: The requested module 'node:fs/promises' does not provide an export named 'constants'`，
说明当前 Node 版本过低（Vite 6 要求 `^18 || ^20 || >=22`），请切到 Node 22。

### 页面样式或脚本 404

1. 确认已执行过 `pnpm build`——产物不入库，克隆后必须先构建。
2. 检查引用的文件名**大小写**是否与产物一致：本地 macOS 大小写不敏感不会报错，
   但 GitHub Pages 跑在 Linux 上，`webLab.min.css` 与 `weblab.min.css` 是两个文件。
   不变式：产物名 == 源文件名 + `.min`。
3. demo 页面报 `./css/base.min.css` 404 时，检查该 demo 是否被误加进了
   `vite.demo.config.js` 的入口扫描（应命中 `STATIC_DEMO_CSS` 的复制分支）。

### 样式不更新

```bash
pnpm build:assets   # 强制重新构建
```

浏览器侧注意 `assets/**` 产物文件名不带 hash，可能是缓存，强刷一次。

## 📊 构建输出

| 来源 | 产物 |
| --- | --- |
| `dev/js/*.js`、`dev/libJs/*.js` | `assets/js/*.min.js` |
| `dev/sass/*.scss`、`dev/libCss/*.css` | `assets/css/*.min.css` |
| `dev/libJs/*.min.js`、`dev/libCss/*.min.css` | 原样复制到 `assets/js|css/` |
| `demo/*/js/*.js` | `demo/*/js/*.min.js` |
| `demo/*/css/*.css|*.scss` | `demo/*/css/*.min.css` |
| `demo/*/css/base.css` | 原样复制为 `demo/*/css/base.min.css` |

两份 Vite 配置的 `outDir` 都是仓库根目录且 `emptyOutDir: false`，因此构建**不会**清空
任何既有文件；产物路径由 `entryFileNames` / `assetFileNames` 显式指定。

## 💡 常用命令速查

```bash
pnpm dev           # 监听构建 + Jekyll 服务
pnpm dev:assets    # 只监听构建静态资源
pnpm dev:server    # 只启动 Jekyll 服务
pnpm build         # 构建全部静态资源
pnpm build:assets  # 只构建主站
pnpm build:demo    # 只构建 demo
pnpm build:site    # 构建静态资源 + 生成 _site
pnpm deploy        # 交互式提交并推送当前分支（推 main 不会触发 Pages 构建）
pnpm deploy:ali    # 阿里云服务器部署
```

## ⚠️ 已知未决：浏览器兼容基线自相矛盾

`postcss.config.js` 中 `autoprefixer.overrideBrowserslist` 声明的是 `['iOS >= 7', 'Android >= 4.1']`，
但站点实际依赖的能力早已越过这条线：

| 依赖 | 实际最低要求 |
| --- | --- |
| jQuery 3.3.1（`_includes/headAssets.html`） | iOS ≥ 9 / Android ≥ 4.4 |
| `fetch` + `NodeList.forEach`（阅读量统计） | iOS ≥ 10 |
| flex `gap`（`.post-meta` 等） | iOS ≥ 14.1 |

结论：`overrideBrowserslist` 里低于 iOS 9 的那部分前缀永远不会被真正用到，只会增大产物体积；
而 `gap` 这类高要求特性又不在 autoprefixer 的补偿范围内。**这条基线目前没有真实约束力，
但它决定 autoprefixer 该保留哪些前缀，属于需要单独决策的事项（收敛到现代基线会删掉一批前缀，
回退到标称基线则要把 `gap` 改回 margin），因此暂不改动，仅在此登记。**
动它之前先确认目标设备分布，再一次性同步 `postcss.config.js`、`_includes/headAssets.html` 的 jQuery 版本与阅读量脚本的降级策略。

## 🎯 开发建议

1. **开发时**：保持 `pnpm dev` 在后台运行，改源码与改模板都能即时看到效果。
2. **提交前**：产物不入库，只需提交源码；但要确认 `pnpm build` 能跑通，否则 CI 会失败。
3. **改构建配置后**：本地跑一次完整 `pnpm build`，核对 `assets/` 与 `demo/` 下的产物
   数量与文件名，重点检查大小写与是否有入口因同名互相覆盖而丢失。
4. **发布**：`pnpm deploy` 只推当前分支，Pages 构建只认 `master`——别忘了
   `git push origin main:master`，否则线上一直是旧版本而 CI 一片绿色。
5. **动检索层之前**：`_config.yml` 的 `title` / `seo_title` / `description` 与
   `_includes/seoMeta.html`、`_includes/jsonLd.html` 是一组联动口径，改任何一处都要
   重新构建并抽查文章页与首页的 `<title>`、`description`、`canonical`、JSON-LD。
   这四类问题（标题重复、描述缺失、canonical 与导航链接不一致、JSON-LD 语法错）
   都不会让构建失败，只会在搜索引擎里慢慢体现出来。

## 🔎 检索层自查

Jekyll 构建成功不代表 SEO 没问题。改完模板跑下面这十一条，能在本地就把结构性问题挡下来：
第一条命令负责重建，后面十条全部读它的产物——**每次都要带着第一条一起跑**。
这个目录留着上一次的构建时踩过一次：脚本对着旧产物输出一串「异常」，
看起来像刚修的问题没修好，其实是读错了目录。
第 10 条与后面的样式回归还要读 Vite 产物（`assets/**`），本地没构建过就先 `pnpm build:assets`；
第 10 条要读仓库根的 `demo.json`，所以整块命令在仓库根目录下跑。

```bash
bundle exec jekyll build --destination /tmp/seo-check   # 不污染共享的 _site/

# 这几条的通过标准一律是「没有输出」或「数字对得上预期」。写自检脚本最容易犯的错
# 是它永远通过：`grep -l '<h1' | wc -l` 数的是「有 H1 的文件数」，永远等于文章总数，
# 出两个 H1 也照样是那个数——所以这里全部改成「统计异常项」的写法。

# 1. 每篇文章应当只有一个 H1（多余的 H1 会稀释标题信号）——预期：无输出
for f in /tmp/seo-check/20*/*/*/*.html; do
    n=$(grep -o '<h1' "$f" | wc -l | tr -d ' ')
    [ "$n" -ne 1 ] && echo "H1=$n  $f"
done

# 2. 不应出现重复标题 / 空描述 —— 预期：无输出
grep -ho '<title>[^<]*</title>' /tmp/seo-check/*.html /tmp/seo-check/20*/*/*/*.html | sort | uniq -d

# 3. JSON-LD 必须是合法 JSON（模板里一个未转义引号就能让它整块失效）
#    预期：failures 为 0，且类型分布对得上口径——BlogPosting 与 BreadcrumbList 各等于
#    可索引文章数（第 11 条的命中页数），WebSite / Blog / Person 各 1（只在首页声明一次，
#    见 _includes/jsonLd.html 的 page.url == '/' 那道门），CollectionPage 等于所有带
#    page.title 的站点页与归档页（含 index-all.html）。当前站内是
#    BlogPosting 67 + BreadcrumbList 67 + CollectionPage 26 + WebSite/Blog/Person 各 1 = 163 块
#    （noindex 的 404 页不声明结构化数据）
python3 - <<'PY'
import json, pathlib, re, collections
blocks, types, failures = 0, collections.Counter(), 0
for p in pathlib.Path('/tmp/seo-check').rglob('*.html'):
    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>',
                         p.read_text(encoding='utf-8'), re.S):
        blocks += 1
        try:
            types[json.loads(m.group(1)).get('@type')] += 1
        except Exception as e:
            failures += 1
            print('解析失败:', p, e)
print('JSON-LD 块:', blocks, dict(types), '失败:', failures)
PY

# 4. sitemap 的每个地址都要有落盘文件、且那一页有自引用 canonical —— 预期：missing/canon 为空
python3 - <<'PY'
import pathlib, re
root = pathlib.Path('/tmp/seo-check')
locs = re.findall(r'<loc>(.*?)</loc>', (root / 'sitemap.xml').read_text(encoding='utf-8'))
missing, canon = [], []
for u in locs:
    rel = u.split('/better-blog/')[-1] or 'index.html'   # 首页那条 loc 以 / 结尾，切出来是空串
    f = root / rel
    if not f.is_file():
        missing.append(u); continue
    if 'rel="canonical"' not in f.read_text(encoding='utf-8'):
        canon.append(u)
print('loc 总数:', len(locs), '| 无文件:', missing, '| 缺 canonical:', canon)
PY

# 5. 文章页面包屑必须链到分类锚点。这里塌过一次：`| append: page.categories | first`
#    对字符串取 first 得 nil，66 页的栏目链接全变成裸 baseurl —— 预期：bad 为 0
python3 - <<'PY'
import pathlib, re
bad = [str(p) for p in pathlib.Path('/tmp/seo-check').rglob('*.html')
       if (m := re.search(r'class="post-crumb".*?</nav>', p.read_text(encoding='utf-8'), re.S))
       and '#' not in m.group(0)]
print('面包屑缺锚点:', len(bad), bad[:3])
PY

# 6. noindex 的页面不得出现在 sitemap 里，也不得声明 JSON-LD —— 预期：两条都是 []
python3 - <<'PY'
import pathlib, re
root = pathlib.Path('/tmp/seo-check')
ni = {str(p.relative_to(root)) for p in root.rglob('*.html')
      if 'content="noindex' in p.read_text(encoding='utf-8')}
inmap = {u.split('/better-blog/')[-1] for u in
         re.findall(r'<loc>(.*?)</loc>', (root / 'sitemap.xml').read_text(encoding='utf-8'))}
withld = {n for n in ni if 'application/ld+json' in (root / n).read_text(encoding='utf-8')}
print('noindex 却进了 sitemap:', sorted(inmap & ni), '| 还带 JSON-LD:', sorted(withld))
PY

# 7. 订阅源里的图片必须带 baseurl —— 预期：裸路径为空
#    阅读器不会替你拼 base，它只照 <content> 里的 src 去站点根取，裸 /assets/... 在
#    feed 里就是死图。feed.xml 的图片又全裹在转义过的 HTML 里（src=&quot;/…），
#    所以正则必须同时吃 `src="` 和 `src=&quot;`：只写一种会一条都匹配不到，
#    然后以「0 张图、0 异常」的结果假装通过。
python3 - <<'PY'
import pathlib, re
feed = pathlib.Path('/tmp/seo-check/feed.xml').read_text(encoding='utf-8')
srcs = re.findall(r'src=(?:"|&quot;)([^"&]+)', feed)
print('图片 src:', len(srcs), '条 | 裸路径:',
      [s for s in srcs if s.startswith('/') and not s.startswith('/better-blog/')])
PY

# 8. 正文图必须带 width+height，且每篇首图保持 eager —— 预期：两个列表都为空
#    缺宽高会在图片加载时把下方正文顶走（CLS），首图被懒加载则直接拖 LCP。
#    容器选择器照模板写全 `<article class="markdown-body" id="post-body">`：
#    只按 id 匹配、或属性顺序写反，都会一页都匹配不到，于是「0 张图全通过」。
#    所以这里连命中页数一起打出来，它必须等于可索引文章数（第 3 条的 BlogPosting 计数）。
#    报出缺宽高的文件名时，先看第 11 条：如果那页的图片本来就取不到文件，
#    那是路径写错或配图没生成，不是补尺寸的滤镜坏了。
python3 - <<'PY'
import pathlib, re
root = pathlib.Path('/tmp/seo-check')
hits = imgs = lazy = 0
nodim, firstlazy = [], []
for p in sorted(root.glob('20*/*/*/*.html')):
    m = re.search(r'<article class="markdown-body" id="post-body".*?</article>',
                  p.read_text(encoding='utf-8'), re.S)
    if not m:
        continue
    hits += 1
    tags = re.findall(r'<img\b[^>]*>', m.group(0))
    imgs += len(tags)
    lazy += sum('loading="lazy"' in t for t in tags)
    if any(not ('width=' in t and 'height=' in t) for t in tags):
        nodim.append(p.name)
    if tags and 'loading="lazy"' in tags[0]:
        firstlazy.append(p.name)
print(f'命中 {hits} 页 / {imgs} 图（懒加载 {lazy}）| 缺宽高 {nodim} | 首图被懒加载 {firstlazy}')
PY

# 9. 标题与描述的 SERP 列数区间 —— 预期：四个列表都为空
#    Google 按「列」截断，CJK 字符占 2 列，所以 len() 不合格，要按宽度算。
#    口径：标题 ≤60 列；描述 ∈[50,158] 列（低于 50 等于没写，高于 158 会被截）。
#    首页一起查：它是站内唯一不套文章模板的那页，改标题口径时最容易漏。
python3 - <<'PY'
import pathlib, re
def cols(s):
    return sum(2 if ord(c) > 0x2E80 else 1 for c in s)   # CJK 与全角标点都落在 0x2E80 之上
root = pathlib.Path('/tmp/seo-check')
long_t, short_d, long_d, none_d = [], [], [], []
for p in sorted(root.glob('20*/*/*/*.html')) + [root / 'index.html']:
    html = p.read_text(encoding='utf-8')
    t = re.search(r'<title>(.*?)</title>', html, re.S)
    d = re.search(r'<meta name="description" content="([^"]*)"', html)
    if t and cols(t.group(1)) > 60:
        long_t.append(cols(t.group(1)))
    if not d:
        none_d.append(p.name)
    elif cols(d.group(1)) < 50:
        short_d.append(cols(d.group(1)))
    elif cols(d.group(1)) > 158:
        long_d.append(cols(d.group(1)))
print('标题>60列', long_t, '| 描述<50列', short_d, '| 描述>158列', long_d, '| 无描述', none_d)
PY

# 10. demo 列表必须是渲染进 HTML 的静态链接（P0-7）—— 预期：一致 True、落盘缺失 []
#     原先这 19 个入口靠前端 fetch demo.json 生成，爬虫侧等于 0 个链接。改成 Liquid
#     循环之后要防的是回退：模板哪天改回 fetch，构建正常、页面看着也正常，收录却掉光。
#     所以不数「有几个链接」，而是拿 demo.json 当基准对三项：条数、href 集合、
#     每个 href 在产物里真有文件。注意 demo 目录是 18 个而条目是 19 条
#     （demo/ai/ 一个目录放了两页），别拿目录数当预期。
python3 - <<'PY'
import json, pathlib, re
root = pathlib.Path('/tmp/seo-check')
entries = json.loads(pathlib.Path('demo.json').read_text(encoding='utf-8'))['demoLists']
links = re.findall(r'class="demo-link"[^>]*href="([^"]+)"',
                   (root / 'demo.html').read_text(encoding='utf-8'))
got = sorted(u.split('/better-blog/')[-1] for u in links)
print('链接数', len(links), '| 与 demo.json 一致', got == sorted(e['demoUrl'] for e in entries),
      '| 落盘缺失', [g for g in got if not (root / g).is_file()])
PY

#     配套一条：JS 包里不该再出现 demo.json（前端拉取已经删掉了）。
#     命中 0 时 grep 以退出码 1 结束，这不是报错。
grep -c 'demo\.json' /tmp/seo-check/assets/js/index.min.js

# 11. 正文与列表引用的站内图片必须真的在产物里 —— 预期：取不到文件 0 条
#     路径打错一个字母，第 8 条只会报「缺宽高」，看着像滤镜没跑；实际是
#     `_plugins/image_dims.rb` 读不到文件头，只能原样放过，线上就是一个 404 的空图框。
#     所以这两条要连着看：缺宽高 + 文件存在 = 滤镜的问题；缺宽高 + 文件不存在 = 写错了路径
#     （或配图还没生成）。全站近千处站内引用一次扫完，比人肉点图快得多。
python3 - <<'PY'
import pathlib, re
root = pathlib.Path('/tmp/seo-check')
gone = []
for p in sorted(root.rglob('*.html')):
    for src in re.findall(r'<img\b[^>]*?\bsrc="(/better-blog/[^"?#]+)', p.read_text(encoding='utf-8')):
        if not (root / src.split('/better-blog/')[-1]).is_file():
            gone.append((str(p.relative_to(root)), src))
print('产物里取不到文件:', len(gone), gone[:4])
PY
```

`_site`（或上面的临时目录）里不该出现的东西：`README.html`、`USAGE.html`、
`assets/img/**` 下的 `.html` 工作笔记、`test.html`、`rss.xml`、
`assets/iconFont/demo_index.html`。它们都靠 `_config.yml` 的 `exclude` 挡着，
每一行的理由写在注释里——不要图省事改成 `include` 白名单，也不要随手删这些排除项。

### 产物里的样式回归

前面十一条查的都是 HTML 与 feed。另有四处改动同属「失效了也不报错」的那类，只能直接查 CSS：

```bash
python3 - <<'PY'
import pathlib, re
root = pathlib.Path('/tmp/seo-check')
css = (root / 'assets/css/index.min.css').read_text(encoding='utf-8')
share = (root / 'assets/css/share.min.css').read_text(encoding='utf-8')
print('死样式类回流:', bool(re.search(r'(utdf|dtuf)-delay0', css)),        # 预期 False
      '| downToUpFade 关键帧:', '@keyframes downToUpFade' in css,          # 预期 True
      '| reduce 全站兜底:', 'animation-duration:.01ms!important' in css,   # 预期 True
      '| socialshare font-display:', 'font-display:swap' in share)         # 预期 True
PY
```

- **死样式类**：`.utdf-delay0` / `.dtuf-delay0` 全站 0 引用，已连同只被这两个类用到的
  `@keyframes upToDownFade` 一起删掉（`dev/sass/common/animate.scss`）。它们回流只有一种来路：
  又有人照着旧笔记抄了一遍。
  `vite-dist/` 里那份旧 CSS 还带着这两个类（旧 `@vitejs/plugin-legacy` 的输出残留，
  已被 `_config.yml` 排除、不进产物）——在仓库里 grep 到命中不算回流，上面查的那份才是真下发的。
- **`downToUpFade` 关键帧**：在 `animate.scss` 里查不到任何 `.类名` 用它，看着就是死代码——
  但 `dev/sass/common/common.scss:229-245` 与 `:417` 是直接写 `animation: downToUpFade …` 的
  （首页文章列表、read-next 的错峰入场）。删掉它，那 6 处动画**静默消失**，
  构建不报错、HTML 也看不出端倪。这条和上一条是一对：留关键帧、删延迟类。
  跨文件查消费者再动手，别只 grep 类名。
- **reduce 全站兜底**：`dev/sass/common/base.scss` 末尾那段 `@media (prefers-reduced-motion)`。
  它在不在，决定的是「全站动效都尊重系统偏好」还是「只有当初单独补过的那几个组件生效」——
  后者正是这一批修之前的状态（`animate.scss`、`common.scss`、`cat.scss`、`bottomFixedBtn.scss`、
  `weblab.scss`、`helper.scss` 各自为政）。所以新加动效不用再补 reduce，但这段不能被动效重构顺手删掉。
- **`font-display:swap`**：全站只有 `socialshare` 一个字族会走网络，所以只有
  `dev/libCss/share.min.css` 需要它。其余字族是内联 data URI（本就不阻塞），
  原先 `base.scss` 里那两个 Merriweather `@font-face` 是空壳、字体文件已删
  （缘由记在 `dev/blog-growth-analysis-2026-09.md` 的 P0-11）。
  别为了「让这个指标通过」往 `base.scss` 里补 `font-display`——那里没有可挂的字族。
