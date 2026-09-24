# 更新日志

站点版本号与 git tag 一一对应，tag 打在 `master` 上（Pages 的构建 Workflow 只监听 `master`，
见 [USAGE.md](./USAGE.md) 的「发布链路与分支」）。版本号规则与递增口径见 USAGE.md 的
「版本号与 tag 约定」。

## 2.1.0 — 2026-09-24

四条线一起走：西文字体换成自托管 webfont、一批补齐「手感」的动效、招财猫终于有了
收放口、以及四项按页收口的下发与分享元数据。按 USAGE 的口径，这是新增一整块能力，
进次版本。

### 新增（版式）

- **西文换成 Newsreader（标题）+ IBM Plex Mono（元信息），只下 `latin` 子集**，
  三个文件合计 78,264B（可变 Newsreader 58,152B + Plex Mono 400/500 各约 10KB），
  授权与来源记在 `assets/fonts/LICENSES.md`（三者均 SIL OFL 1.1，全部按原样分发，
  没有自行裁剪的衍生件）。
  中文一个字节都不下：补齐中文字形最小也是 MB 级（霞鹜文楷全量 woff2 约 10MB，
  分片后首片仍 1.5MB），而本站正文以中文为主，为它付一次冷启动不划算。
  收益不在「更好看」，而在把三条栈钉死——改前同一页在 macOS 是 Georgia + PingFang、
  Windows 掉成 Times New Roman + 微软雅黑、Linux 可能直接方框。
  落点是 `tokens.scss` 的 `$font-display` / `$font-meta`，editorial 层 75 处规则引用
  （23 处标题、52 处元信息），回落链保留 Georgia / SF Mono，字体取不到时版式不塌。
  `preload` 只给 Newsreader 一条（刊头 H1 压着它，不 preload 会首屏换一次字）；
  两份 Plex Mono 不 preload，它们只服务小号元信息。
  核验：文章页 `document.fonts` 里 Newsreader 为 `loaded`，同一段拉丁文本在 64px 下
  实测宽 662.55px，Georgia 725.81px、系统 serif 564.55px —— 字形确实换了，不是声明
  了个寂寞。
- **标题衬线中途从 Fraunces 换成 Newsreader**。Fraunces 被一个字母否掉：它的 f 带
  一道向左甩出的横担，混在宋体汉字里不像字母而像装饰件，而这个 f 不在任何可变轴上
  （WONK 在 Google 那份 latin 子集里已被裁掉，改 `font-variation-settings` 实测零
  反应），换不掉，只能换族。它的数字同样不合用（3 平顶、4 斜开口），当时先补过一份
  只接管 `U+0030-0039` 的 Noto Serif 裁剪子集（6,096B，按 OFL 保留字条款改名分发）。
  Newsreader 的 f 是正常衬线、y 的长尾还留着辨识度，数字本身齐线且开口清楚，于是
  汉字／英文／数字三者互相好认——换族一次解决两件事，那份裁剪子集连同它的
  `@font-face` 一并删掉，比 Fraunces 那套还省 15,332B（73,484 → 58,152）。
- **动效令牌**：`--dur-1..4`（120/200/320/560ms）与 `--ease-out` / `--ease-in-out` /
  `--ease-back`。此前 editorial 层没有任何时长与曲线变量，取值硬编码在四十多处规则里。

### 新增（动效）

- **灯箱 FLIP**（M1）：点开正文图片时从那张缩略图的实际矩形飞过去，关闭飞回来。
  JS 逐帧只写 `transform`（起点只有运行期才知道），宽高一律不碰——碰了就是逐帧重排
  一张 92vw 的图。开 300ms / 关 240ms，两个方向共用一条 `fly()`，反向那次的起止点
  必须对调（早先两行都写同一个值，`transitionend` 不来，每次关闭都白等满 400ms 超时）。
- **卡片 hover 语言**（M3）：首页卡片、分类行、系列行、书架行的标题在 hover 时位移 +
  变色，位移走 `translate` 不占 `transform`。
- **按压反馈**（M4）：11 类控件补上 `:active { scale: .97 }`。此前全站只有 `.cta`
  与 `.icon-menu` 两处有 `:active`，其余按钮按下去没有任何回信。
- **面板逐项错峰入场**（M6）：⌘K 结果、书架行、目录项按 28ms 步进依次出现，
  由 `.is-fresh` 开关类控制——不加开关就会在每次筛选重绘时重放一遍入场。
- **阅读进度条末端的剩余时长气泡**（M7）：口径与页头那行「约 N 字 · M 分钟」严格同源
  （`ceil(chars / 400)`，页头用的正是 Liquid 的 `plus: 399 | divided_by: 400`），
  起手时气泡的数字必须等于页头那个数，否则同一页两处自相矛盾。
- **合集进度轨的完成脉冲**（M9）：读完合集最后一篇时轨道弹一下并扫过一道光。
  纯 CSS，`.is-complete` 由 `_layouts/post.html` 写进 class，不依赖 JS、不随 hover 重放。
- **招财猫的三层开关**：构建期 `site.showCat`（关掉连 HTML 都不渲染）、视口宽度、
  以及用户自己收起（`.mao-toggle`，记在 `localStorage` 的 `mao_tucked`，跨页生效）。
  原来只有前两层，且宽度那道 1500px 只在加载那一刻判一次——把窗口拉宽猫不会出来，
  窄屏上想让猫消失也没有出口。宽度门槛降到 1240px 的依据：`@media (max-width: 1239px)`
  那段里左下角的「目录」浮标与猫实测叠在一起，1500 比必要的高出一大截。
  另补 resize 重算与视线跟随（归一化位移小于 0.02 不写样式，约半个视口以内不动）。
  收起态随后又收了一次：原来只沉 `- 10px`，落在屏幕上仍是 187×40 的一对完整耳朵，
  占着左下角不说，那 40px 高的实面盒子还横在正文一条带上吃点击。改成沉
  `calc(100% + 8px)`（只剩 22px 高的耳尖）并给整块 `pointer-events: none`、只让
  `.mao-toggle` 自己收回 `auto`。扣子的位置也跟着挪了一次：先按「不被底边切掉」放在
  `top: -32px`，结果它悬在屏底上方 30px 处，正压在左侧正文某一行的中间——一颗按钮
  盖住一句能点的话，比猫本身碍事。改成 `top: -2px` 贴着屏底，24px 的扣子恰好整颗
  落在屏内，挡的那 24×24 回到屏幕最边缘、不在任何一行文字当中。实测收起后那条带上
  `elementFromPoint` 命中的是页头而不是猫，扣子矩形 y 落在 637..661（视口高 661）、
  中心命中的仍是它自己。
  代价是收起态不再能拖着猫走（rtDraggable 挂在同一节点，收不到 pointerdown），
  要先点扣子放回来。
- **reduce 覆盖**：这四条新 `@keyframes`（`lightboxFade` / `itemRise` / `trackPop` /
  `fillSweep`）不单独写降级，由 `base.scss` 那份全站 `.01ms !important` 兜底压住；
  真机核验过——reduce 下 `trackPop` 与 `fillSweep` 的时长都是 `1e-05s`，光带落在
  `translate: 100%` 的终态、被 `.post-series-fill` 的 `overflow: hidden` 裁掉，
  按压过渡同样归零。FLIP 在 JS 侧直接跳过飞行。

### 修复（视觉）

- **正文标签的灰是 token 化时漏改的**：`@mixin tagStyle` 里仍写着 `#A6ABB2`，比
  `--ink-4`（`#7A8089`）还浅一档，压在 `#FAFAFA` 的药丸底上只有 2.2:1，14px 的标签
  读起来像被擦过一层。改成 `var(--ink-3)`（同底 4.8:1）、hover 落到 `--ink-2`。
  没有直接上 `--ink-2` 是留着层级：侧栏卡片标题「标签」本身才 `--ink-4`，正文标签
  比它重两级就把层级倒过来了。夜间模式另有 `.night-mode` 那条覆盖，实测仍是
  `#949AA4` 对 `#191C23`（6.0:1），不受这次改动影响。
- **阅读设置面板的「恢复默认」往下坠**：文字在按钮自己那 28px 里其实是居中的，
  偏的是按钮外面——分隔线到文字 9px、文字到面板底边 18.5px（面板 `padding-bottom:
  12px` 与按钮高度各算了一遍）。把那 12px 并进按钮（28 → 40、面板底部归零），
  两侧各 13px，面板总高不变；居中改由 `display: flex; align-items: center` 明写，
  不再依赖 `<button>` 各自的 UA 默认行为。颜色从 `--ink-4` 提到 `--ink-3`，与同一块
  面板里的 `.reader-opt` 同档。

### 优化（下发与分享）

- **normalize 与 jQuery 改自托管**，摘掉 `cdn.staticfile.org`：2026-09-23 实测那份
  normalize 15s 超时、`code=000`，而同页 at.alicdn 的图标 CSS 只要 0.07s——慢的是这个域。
  两者都挂在 `<head>` 且都阻塞（一个是渲染阻塞样式表、一个是解析阻塞脚本），
  后果可复现：headless Chrome 打开任意页都取不到 `document.body`。
  版本与字节数与原外链一致（jQuery 3.3.1 / 86,927B，normalize 6.0.0 / 2,216B），
  只换来源不换实现；jQuery 仍同步加载，加 `defer` 会改到执行次序，那是另一回事。
- **三方 CSS 按页收口**：`github-markdown` / `prism` / `share` 三份只在文章页下发。
  产物实测依据：`markdown-body` 命中 67 个文件且全是文章页、`class="language-` 命中 59 个
  同样全在文章页、`social-share` 多出的那一个是 `demo/shareDemo/index.html`
  （它走 demoHead，根本不加载这份清单）。其余 52 个非文章页面每个都在背
  16,159B（逐份 gzip 相加 5,608B）匹配不到任何节点的样式。
  收口写在 `headAssets.html` 里而不是搬去 `postHead.html`：这三份必须排在
  `index.min.css` 之前，挪到那个 include 后面就排到了之后，等于把覆盖关系整个反过来。
  `prism.min.js` 一并从 `default.html` 删掉（文章页那一处保留），省 22,482B（gzip 8,405B）。
- **WebLab 的 ace 改成按需注入**：两条阻塞式 `<script src>` 从 `weblab.html` 摘掉，
  改成第一次按下编辑区或第一次点「提交运行」才注入。A/B 实测（同一台机器、禁用 HTTP 缓存、
  两变体交替各 5 次取中位）：按下之前 ace 请求 10 → 0、ace 字节 405KB → 0，
  页面总下载 850KB → 445KB，DOMContentLoaded 2,546ms → 2,206ms，主线程 TaskDuration 2.51s → 2.36s；
  按下之后两者完全一致（10 个文件 / 550KB、编辑器 5/5 就位），也就是没有把功能改坏，
  只是把账推迟到真要用的那一下。对照的 A 变体只把两条脚本插回原位，
  三次 `ace.edit()` 仍走新的懒路径，所以这组数字是改动前收益的下界。
  空盒子在改动前后是同一块 300px 深色（高度由 `weblab.scss` 钉死），晚装不位移。
- **og:image 补一级「本篇生成卡片」**：67 篇文章里 34 篇没有 cover，它们此前全部落到
  同一张站点兜底图上——转发行里认不出是哪篇，标题信息白送不要。
  新增 `scripts/og-images.mjs`：用本机 Chrome 把 1200×630 的品牌卡（分类 · 日期 · 标题 · 站名）
  截成 JPEG 存进 `assets/img/og/`（34 张、1,876,291B），取值表写在 `_data/og_images.yml`
  （67 条，含那 33 篇有 cover 的，好让 `--check` 分清「有 cover」与「漏生成」）。
  `seoMeta.html` 于是走三级链：front matter cover > 本篇卡片 > 站点兜底图，
  `twitter:image` 与 JSON-LD 的 `image` 自动跟到同一张卡；宽高只在能确定时声明
  （卡片恒为 1200×630，而 cover 的尺寸各不统一）。产物结果：34 卡片 + 33 cover + 0 兜底。
  卡片图入库而不是 CI 生成：Pages 的构建镜像里没有 Chrome，`pnpm og:check` 只做校验
  （五条断言：表指向的文件在磁盘、卡片尺寸恰为 1200×630、应生成的篇目都在表里且签名未变、
  `assets/img/og` 无孤儿文件、每个键都能在 `_site` 找到对应页面），缺图时 exit=1。
- `_config.yml` 的 `exclude` 补 `scripts`：不带 front matter 的文件会被 Jekyll 原样复制
  进 `_site`，加之前线上因此多出 `/better-blog/scripts/`。
- **整站回归**：`pnpm build` + `bundle exec jekyll build` 通过，16 项产物级断言全绿
  （字体声明与文件、无中文 webfont、三方 CSS/JS 按页收口、weblab 无阻塞 ace、
  og 三级链与卡片可访问、`showCat` 与 `.mao_box`、站内绝对引用 0 坏链）。
  冒烟走 baseurl 口径的本地服务，每页新建 target：文章页 0 条 JS 异常。

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
