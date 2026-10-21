# 收录加速与更新日志页设计（四批之批 1 / B 可发现性）

日期：2026-10-20
范围：B1 IndexNow 主动推送、B1b Bing 站长验证（只等一个值）、B2 把 CHANGELOG 发布成页面
状态：**待评审**（评审通过后才进 writing-plans 与实现）
分支：`feature-dev`（就地实现，不另开工作树；本机有一个跑了数小时的 `pnpm dev` 监听全仓，见 §1 事实 9）
落地补充：构建一律 `JEKYLL_ENV=production bundle exec jekyll build --destination spark-output/site-prod`，门禁加 `--site=` 指过去；直接读仓库 `_site` 会读到 dev 配置产物（url=localhost:4000），`check-seo` 会报 715 条假红。
上游：本轮四批分解（A 内容 / B 可发现性 / C 交互断点 / D 布局），B 与 A/C/D 互不依赖，可独立收口

## 0. 这一批只解决一件事：让引擎和读者知道这个站在动

B1 对机器（必应系与 AI 答案引擎的收录通道），B2 对人（读者看得见的更新历史）。
两条互不依赖，任何一条都能单独摘掉而不留半成品——§6 写了各自的摘法。

## 1. 起点事实（全部本轮现场量，命令与口径附在行内）

| # | 事实 | 怎么量的 |
| --- | --- | --- |
| 1 | 主动推送只有两条国内通道：`_includes/seoScript.html` 里的百度统计/推送与 360 推送 | 读该文件；`grep -i indexnow` 全站 **0 命中** |
| 2 | Bing 站长验证位**空着**：`_config.yml:32` `bing_site_verification: ''`，而模板侧已经支持（`_includes/seoMeta.html:12-13` 只在非空时发 meta） | 直接读两文件 |
| 3 | Google 与百度的验证走仓库根的两个文件（`googlebed27dc19e414568.html`、`MP_verify_FRpIdlyts4tys1oC.txt`）——这是 IndexNow key 文件可以照抄的形状 | `ls *.html *.txt` |
| 4 | `CHANGELOG.md` 首行是 `# 更新日志`，**没有 YAML 头 → Jekyll 不渲染它**，产物里根本没有这个地址 | `head -1 CHANGELOG.md`；`ls _site/CHANGELOG*` → 无（`find _site -iname '*changelog*'` 的 3 个命中全是文件名带 changelog 的配图，不是页面） |
| 5 | 收录面有三处互相咬合的台账：`site.nav` **8 项**（`sitemap.xml` 页面段的单一数据源）、`sw.js:127` 的 `DOC_URLS`（`check-sw` 断言它与 sitemap 双向相等）、`check-seo.mjs` 的 head 与收录面组 | 解析 `_config.yml` 的 nav 段；读 sw.js 与两个门禁文件头 |
| 6 | 「**进 sitemap 但不进导航条**」这条破例已立过两次：`index-all.html`（`sitemap.xml:64`）与在线工具三页（`sitemap.xml:42-46`，理由原文是「导航是常显入口，多三项在窄屏上要占一行」，而工具页已经挂在「工具箱」下拉里） | 读 sitemap.xml 与 sw.js:136 |
| 7 | 首页数据条读数：**110 篇文章 / 171 个标签 / 3 款插件**，`version: 2.1.0`（`_config.yml:52`） | 冻结快照 + 浏览器实测（`_site/index.html` 的 `.masthead-stats`） |
| 8 | `sw.js` 的 `DOC_URLS` 是 Liquid 生成的：入口段手写若干条（末位 `index-all`，`ENTRY_CUT` 以它为界），随后 `{%- for post in site.posts %}` 展开文章 | 读 sw.js:127-153 |
| 9 | 本机有 `concurrently vite build --watch` + `bundle exec jekyll serve`（pid 20007/20019，起于 5 小时前），它监听**整仓**，任何新落盘文件都会触发一次重建 | `ps` 实测。后果：本轮第一次量具读到的是重建中间态（首页显示 94 篇而非 110 篇），改用 `mktemp -d` + `cp -R _site` 的冻结快照后数字才对上 |
| 10 | `deploy-github.sh:53` 的密钥扫描**按内容判、不按文件名判** | 读该行注释 |

事实 9 是本批的一条施工纪律来源：**所有核验一律读快照**，与 `verify-tools-browser.mjs` 的 `TK_SITE_DIR` 同法，不接受指向仓库 `_site`。

## 2. B1 · IndexNow

### 2.1 为什么值得做，以及它不值得的那一半

IndexNow 被 Bing、Yandex、Seznam 一族读取，而 ChatGPT 的联网检索走 Bing 索引——所以这条通道同时是 AI 曝光通道。本站已有 sitemap、全文 Atom、`llms.txt` 和 13 个 AI 引擎的显式放行，缺的正是「新页发布后多久被知道」这一段。

**不值得的那一半要说在前面**：Google 明确不读 IndexNow，它看 sitemap 与 feed。所以这一条**不改变 Google 侧的任何东西**，别把它当全站收录开关。

### 2.2 机制

- **key 本地生成**（`openssl rand -hex 16` → 32 位 hex），落仓库根 `/<key>.txt`，文件内容就是 key 本身。这与 Google/百度那两个验证文件同形状、同公开性：**IndexNow 的 key 按规范就是公开的**，它不是凭据，是「这个域名归我」的声明。
- key 值写进 `_config.yml` 的新键 `indexnow: { key: ..., enabled: true }`，脚本从配置读，**不硬编码**、不从环境变量猜。
- 新增 `scripts/push-indexnow.mjs`：
  1. 读 `_site/sitemap.xml` 的全部 `<loc>`，去重；
  2. 剔除 key 文件自身与非 HTML 地址（sitemap 本就不含，这里是防御性断言）；
  3. 一批 POST 到 `https://api.indexnow.org/indexnow`（产物实测 `sitemap.xml` 有 **123 条 `<loc>`**，远低于单次 10 000 上限，不分片）；
  4. 打印 `host / keyLocation / 条数 / HTTP 状态`，非 2xx 退 1。
  - 三个模式：`--dry-run`（只打印将要发什么，不发请求）、`--limit N`、`--check`（只断言本地一致性，见 §2.3）。
- **不进 CI**。CI 里发收录请求会把「构建是否成功」和「必应是否可达」绑成一件事，失败原因不可控且会重复推送。默认口径：部署后手动 `pnpm push:indexnow` 一次；跑通两三次再评估要不要挂到 `deploy-github.sh` 末尾。

### 2.3 门禁与自证

新增 `scripts/check-discovery.mjs`（静态，不联网，读一份隔离的生产产物）：

1. key 文件在产物里存在，且内容逐字等于 `_config.yml` 的 `indexnow.key`；
2. key 文件**不在** sitemap、**不在** `DOC_URLS`——同 `check-seo.mjs:895` 对 `manifest.json` 那条判据的理由（机器读物不是给人导航的页面）；
3. `package.json` 有 `push:indexnow` 这一条；
4. 脚本源码里不出现 `_config.yml` 之外的任何真值（防把 key 抄进脚本第二份）。

配 `scripts/check-discovery-teeth.mjs`，五处变异（key 内容脱钩 / key 进 sitemap / changelog 从 sitemap 删掉 / 解析器少吞一个版本 / 页面带进产物 CSS 里没有的类），实测 **5/5 全部逮住**，且每一刀都自带「没命中就抛」的断言——第一版 C4 那一刀因为要替换的整串在产物里根本不存在而静默空转，显示成「漏网」，就是这个断言该抓的事。

### 2.4 与部署密钥扫描的相处

事实 10：`deploy-github.sh` 按内容判密钥，一个 32 位 hex 命名的根文件有被误杀的风险。做法是**先实测一次**，真被拦才给扫描器加白名单，且白名单必须同时满足「路径 = `/<32hex>.txt`」与「内容 = 文件名去掉扩展名」两个条件——**不许放宽整类 `*.txt`**。

## 3. B1b · Bing 站长验证：只等一个值

模板已经支持（事实 2），要做的只有：你去 bing.com/webmasters 取验证码填进 `_config.yml:32`，并在 Bing 侧提交一次 `sitemap.xml`。我不猜值、不代你注册。这一条在 spec 里挂「待你提供」，不阻塞 B1 与 B2。

## 4. B2 · 更新日志页

### 4.1 为什么值得

`CHANGELOG.md` 里每条版本记录都写得很实（2.1.0 那一条连字体字节数与回落链都写了），但线上读不到（事实 4）。读者看不到「这个站在动」，回访少一个理由；引擎侧也少一个能持续变新的落点页。这与 `/stats.html` 不是一回事——那是本机数据、`noindex`，这是全站事实、该被收录。

### 4.2 形状

- 新源文件 `changelog.html`：`layout: default`、`permalink: /changelog.html`、`title`/`description` 按检索层口径写（title ≤60 列、description ∈[50,158] 列，CJK 按 2 列）。
- **数据源必须是 `CHANGELOG.md` 本身**：新增 `_plugins/changelog.rb`，在构建期按 `## <version> — <date>` 切成结构化条目挂到 `site.data.changelog`，页面只做投影。
  理由只有一条：手抄一份 YAML 就是养第二份事实源，每次发版都要两处同步，漏一次页面就开始说谎——这正是 `llms.txt` 那份文档里写过的同一类失效。
- 解析器**不许静默吞**：标题行不合 `X.Y.Z — YYYY-MM-DD` 形状时计数并让门禁红（§4.3 判据 4），而不是少渲染一个版本。
- 页面结构：刊头（复用 `.g-masthead`，`.archive-masthead` 那一族样式）→ 当前版本 + 版本目录（锚点，复用 `.toc-static` 的样式语言）→ 逐版本区块（`## 新增/变更/修复` 三档按原样投影为小标题 + 列表）。
- **一条新 CSS 都不写**：类名全部沿用 `editorial.scss` 已有的 `.cat-*` / `.toc-static-*` / `.series-*`，与 `index-all.html` 同法（它的落地口径就是「一条新 CSS 都不写，产物体积不变」）。
- **不进 `site.nav`**（保持 8 项，沿用事实 6 那两条破例），但进 sitemap 与 SW 清单（§4.3）。
- JSON-LD 不用改：`jsonLd.html` 的「非文章且有 title」分支已经给 `CollectionPage`。

### 4.3 必须同步改的三处台账

1. **`sitemap.xml`**：照 `index-all` 那条破例的写法加一段（含 `<changefreq>weekly</changefreq>`，它是全站唯一会自己变新的页面）。
2. **`sw.js` 的 `DOC_URLS`**：加在入口段、`index-all` **之后**、`site.posts` 循环之前——`ENTRY_CUT` 的语义是「入口段末尾」，加在它后面才不会把 PIN 段拉长。
3. **`check-seo.mjs` 的字节预算档**：实测**不需要动**——该门禁的 15 组判据里没有按页体积档（`grep -nE "预算|budget|BUDGET|ceil1024" scripts/check-seo.mjs` 零命中），体积上限在 `check-sw.mjs` 那一侧且只算 shell 与注册面，新页面不改它们。产物实测：`check-seo` 15 组全绿（174 页 / 110 篇文章页）、`check-sw` 7 组全绿（文档清单 124 条）。

## 5. 验收（每条都要现场读数，不接受「门禁绿了」）

1. 门禁全绿：`check-seo` / `check-sw` / `check-indexnow` + 三个 teeth / `verify-plan-blocks`；
2. 冻结快照的三态核验（有 JS / reduce / 无 JS）对 `changelog.html` 跑一轮，重点是无 JS 时版本目录与正文全可见（它是纯 SSR 页，不该有任何 JS 依赖）；
3. 快照量具：changelog 页首屏几何、锚点跳转落点、移动端命中区 ≥44px；
4. 发布后线上验：`curl -o /dev/null -w '%{http_code}' /<key>.txt` = 200、`pnpm push:indexnow` 返回 2xx 且条数与 sitemap 一致、Bing 站长页能看到已验证与 sitemap 已提交。

## 6. 风险与摘除

- **key 的公开性**：IndexNow 的 key 按设计公开，泄露无风险；但脚本与日志**不许打印** `_config.yml` 里任何真密钥字段（本站还有 Waline、Cloudflare 等配置在同一文件里）。
- **解析器写坏**：`_plugins/changelog.rb` 解析失败必须红，不能发半页；判据是「条目数 == CHANGELOG.md 里 `^## ` 的个数（减去那条 `# 更新日志` 引言段）」。
- **摘除**：B1 摘 = 删 key 文件 + `package.json` 那条 + `check-indexnow*` 两个脚本 + `_config.yml` 的 `indexnow` 段；B2 摘 = 删 `changelog.html` + `_plugins/changelog.rb` + sitemap 与 `DOC_URLS` 各一行。两边都不留悬空引用。

## 7. 明确不做

- 不做 changelog 的 RSS 版、不做每个版本的独立 URL（锚点足够，独立 URL 会造一批薄页，正是旧体检报告 S7 要治的那类）；
- 不把 IndexNow 挂进 CI（§2.2 的理由）；
- 不为 Bing 写 URL 提交 API 的自动化（那要 Bing 的 API key，属真凭据，且站长后台点一次就够）；
- 不顺手给 `speakable`——它属于 A 批，且要先有 `tldr` 覆盖率才有指向的对象（实测 2/110）。
