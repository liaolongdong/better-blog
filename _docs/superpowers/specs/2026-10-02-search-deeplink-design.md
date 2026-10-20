# 子项目 3 设计：搜索深链、IME 组合输入、多词检索与 SearchAction

日期：2026-10-02　基线：`76df2df`（SP1 收口后的 main）　工作树：`.worktrees/sp3-motion-search`（分支同名）

## 0. 一句话

把 ⌘K 从一个「只能当场用」的浮层改成**可分享、可回退、中文输入不打架、多词能求交**的检索入口，
并在它真的成立之后，才把 `SearchAction` 这份结构化数据递出去。

## 1. 现状（逐条对过代码）

| 面 | 今天的形状 | 证据 |
| --- | --- | --- |
| 面板标记 | `{% if site.search %}` 包住的 `#cmdk` 在 `header.html` 里，于是**每一个走 default/post 布局的页面都带面板** | `_includes/header.html:195-214`、`_layouts/default.html:26` |
| 入口 | 顶栏按钮、侧栏搜索条、⌘K/Ctrl+K、单独的 `/` | `dev/js/editorial.js:759-784` |
| 查询 | 整串小写后对四个字段做 `indexOf`；**空格里夹第二个词必然零结果** | `:642-656`（权重 100/40/20/8） |
| 高亮 | 只包「整串查询的第一个命中」，命中不了就整条不标 | `:658-662` |
| URL | 输入不进地址栏，结果页不可分享；`?q=` 全站无人读取 | 全仓 grep `?q=` 只命中工具页 placeholder 与帖子正文 |
| 中文输入 | `input` 每跳一次就重绘；组合中按 Enter 会被当成「打开第一条」直接跳文 | `:789-792`、`:795` |
| 结构化数据 | 首页 WebSite 只声明 name/url/description，没有 `potentialAction` | `_includes/jsonLd.html:132-142` |
| 上一轮的账 | SP1 明确写下「SearchAction 本轮不做，因为 `?q=` 没人读」→ 移交子项目 3 | `_docs/superpowers/specs/2026-10-02-seo-aeo-structure-design.md:327-329` |

`index-all.html` 的 front matter 自称「无脚本」，但它 `{% include header.html %}` 并且 `default.html`
无条件发三份 bundle——那一页其实带着面板。这一处口径与产物不符属于上一轮遗留，本轮不改它，
只把 SearchAction 的落点选在**首页**（canonical 的那一份），避免把这条不一致烤进结构化数据。

## 2. 范围

做：E1 `?q=` 深链与地址栏同步 · D3a IME 组合输入保护 · D3b 多词 AND 与逐词高亮 · E2 SearchAction。
不做：D2 共享元素形变（理由与证据在 §7，那是这一轮唯一被证据退掉的一项）。

## 3. E1 · `?q=` 深链与地址栏同步

**读入口**：`initPalette()` 末尾（监听器全部绑完之后）取 `new URL(location.href).searchParams` 的 `q`，
`trim()` 后非空才 `open(null, preset)`。空串（`?q=`）不开面板——那不该是一整屏遮罩。
`#cmdk` 不在（`site.search` 关）时 `initPalette` 已经在 `:597-598` 早退，深链自然静默无效。

**`open` 多一个参数**：`open(trigger, preset)`，把原来的 `input.value = ''` + `render('')` 换成
`input.value = preset || ''` + `render(input.value)`。必须一次到位：先开再塞值会渲染两次，
第二次把 `.is-fresh` 的错峰入场（`editorial.scss:5164` 那套开关）摘掉，观感就是「闪一下才出结果」。

**写地址栏**：只在**面板打开期间**同步，用 `replaceState`。
- 开面板那一刻记下 `entryUrl = pathname + search + hash`；
- 每次输入以 `entryUrl` 为底本，用 `URLSearchParams` 只改 `q` 这一个键（其余参数与 hash 原样带走——
  `tags.html#vue` 这类带片段进来的地址不能在这里被吃掉）；
- 清空输入 → 删掉 `q`；
- 关面板（Esc、遮罩、关闭按钮都算）→ `syncUrl('')` 还原成 `entryUrl`，随后把 `entryUrl` 置 null，
  之后任何一次 `input` 都不再碰历史。

为什么是 replace 而不是 push：push 会让「后退」先退回上一个搜索词，而这条面板本来就是替用户
筛同一页的内容，不是一段新历史。为什么关面板要把 `q` 抹掉：留下的话，用户复制到剪贴板的是
他早已关掉的那次搜索——而「分享正在看的结果」这个需求在面板打开期间已经满足了。

**两处必须包 try，理由不是「万一浏览器不支持」。** `boot()`（`:3076-3097`）把 20 个 init 平铺直叙地排下来，
没有逐条守护：`initPalette()` 一旦抛出，后面的 lightbox、稍后再读、收个尾、目录抽屉全部不再生效。
读 `q` 与写 `replaceState` 是本功能里仅有的两个能抛的位置——
后者在 Safari 上有明确的限流（30 秒内超过 100 次直接抛），快打字 + 长粘贴撞得上。
两处各自 try 住、失败即「这次不动地址栏」，一条查询串不许带走十四项能力。
选 `URLSearchParams` 而不用正则 + `decodeURIComponent`，也是因为后者遇到 `?q=100%` 会抛 URIError，
而前者按规范宽容解码。

**落地即渲染的代价**：深链会让 `search.json` 在页面载入时就被拉一次（原本第一次敲字才拉）。
一次 gzip 后的 JSON、命中磁盘缓存，且只在带 `q` 的进入发生，可接受；A/B 里第 ③ 个数就是量它的。

## 4. D3a · 中文/日文输入法保护

`composing` 标志位由 `compositionstart` / `compositionend` 翻，`compositionend` 一到就补一次 `render(input.value)`：

- `input` 处理器：`composing` 为真时**不重绘**（拼音串每跳一次重排一次的闪烁，今天就在）；
- 面板打开时的按键块（Esc / ↑ / ↓ / Enter）：`composing || e.isComposing` 为真时整块直接 return。

第二条修的是一个真缺陷：组合中按 Enter 是「确认候选词」，而现在这条 Enter 会走 `:789-792`
打开第一条结果并跳走——在中文站上，这是搜索主路径上的误跳，不是边缘手感问题。
标志位为主、事件上的 `isComposing` 为辅：Firefox 历史上在这个位置不发 `isComposing`，
只靠事件属性会漏；`compositionend` 之后的那一次 Enter 才恢复导航语义。

## 5. D3b · 多词 AND 与逐词高亮

查询先切成词：`q.split(/\s+/).filter(Boolean)`。

**打分**：逐词累加，**任一词在四个字段里都找不到就整条出局**（AND）。单词查询走的还是原来那条
`weights[i] - Math.min(idx, weights[i] - 1)` 的字段求和，一个字节都没变——这不是巧合，是验收条件①。
`hits` 沿用「命中过哪个字段就 push 哪个下标」的口径（重复下标无害，消费点只做 `indexOf(3)` 判断）。

**高亮**：`mark(text, terms)` 用词表拼一条 `gi` 正则，按命中位置切原文、逐段 `esc()` 后再包 `<mark>`。
三条安全底线：① 词进正则前过 `escRe`（`[.*+?^${}()|[\]\\]` 全转义），用户输入里的 `(` 不能把构造打断；
② 文本任何一片都还是先 `esc()` 再拼接，与今天同一条转义链；③ 空匹配时 `lastIndex++` 防死循环。
词表按长度降序排，让「搜索引擎」在同一起点上赢过「搜索」——并列的 `|` 分支取第一个匹配到的。

已知不足（写下来，不悄悄留着）：摘要那一段的选择规则不变（`hits` 含 3 就展示 excerpt，否则展示 title），
所以多词查询里某个词只命中了标题时，它在这一行的可见片段里可能不高亮。命中集合与排序才是这一项的主语义。

## 6. E2 · SearchAction

只加在首页那一份 WebSite 节点里（`jsonLd.html:124` 那道 `page.url == '/'` 的门已经把 9 个翻页视图挡在外面）：

```json
"potentialAction": {
  "@type": "SearchAction",
  "target": { "@type": "EntryPoint", "urlTemplate": "<site_home>?q={search_term_string}" },
  "query-input": "required name=search_term_string"
}
```

`urlTemplate` 由同块里已经算好的 `site_home`（`'/' | absolute_url`，项目站带 `/better-blog/`）拼出，
不在任何地方重算一遍地址——两处口径就是两条会走散的线。

**次序是硬的**：E1 没落地就不能提交 E2。SP1 那份 spec 停掉它就是因为它当时指向一个不认 `?q=` 的地址；
如果这一轮把顺序倒过来，等于把同一份无效结构化数据换个日期又写回来。

## 7. D2 为什么这一轮退

不是没时间，是两条证据叠上来：

1. **项目已经退过一次，而且理由是硬的。** `scripts/verify-motion-batch4.mjs:1007-1023` 记着上一轮的决议：
   刊头标题不命名，`.post-masthead` 整块命名会让两篇文章的头图互相拉伸。
   同一格还有一条判据：从 `index.min.css` 抽出每条 `view-transition-name`，逐页数实例，
   **同名超过 1 个就判红**（`:1119-1126` 静态、`:1150-1152` CSSOM 精确）——因为撞名会让整场跨页转场被静默跳过。
2. **首页 8 张卡片必须 8 个不同名字，代价付不起。** 配对只能按 slug 命名（新页 h1 与旧页卡片同名才认得出对方），
   于是没被点的那 7 行也是「有名字、新页无对应」的组：它们各自按**默认** VT 动画淡出，
   而本项目的 root 用的是 `--dur-1` 退 / `--dur-3` 进（`editorial.scss:5807-5830`）。
   7 行标题以另一条时间线与周围像素脱开，读起来就是「文字先于版面被擦掉」。
   唯一干净的解法是把命名推迟到点击那一刻（只给被点的那张挂 inline style，新页 h1 烤同名）——
   但「旧文档快照到底吃不吃得下 click handler 里刚改的内联样式」这一点我**无法用现有量具证明**：
   同一格已经实测过 CDP 读不到伪树（`:1019-1023`：带 `pseudoElement` 的 `DOM.querySelector` 把
   `::view-transition` 退化成 `<html>` 本身）。把验收定义在「门禁化 + A/B 实测」上的项目，不该交付一个测不到的动效。

再加一条工程现实：并发会话此刻正持有动效那一摊（`verify-motion-batch4.mjs` 的删除已在他们的暂存里），
本轮往 `editorial.scss` / `tokens.scss` 的转场段上写东西，是在别人的战区内改地图。

**D2 的续命问题写成一个可判的小实验**（留给下一轮，别重新论证）：在真浏览器里用
`Page.addScriptToEvaluateOnNewDocument` 注入一条 `document.getAnimations({subtree:true})` 采样，
在新文档首帧记录伪元素动画名单——如果这份清单能出现 `::view-transition` 的动画对象，量具就有了，
D2 才能重新排队；否则永久退掉。

## 8. 验收

### 8.1 门禁一：`check-seo.mjs` 新组 `searchAction`（静态，跑 `_site`）

`GROUPS`（`:1145`）追加 `searchAction`，判据四步：
1. 全站 `"@type":"SearchAction"` 出现**恰好 1 次**，且落在首页产物；
2. 首页那一份 WebSite 必须 `JSON.parse` 通过，且 `potentialAction.target.urlTemplate`
   逐字等于同一块里的 `url + '?q={search_term_string}'`（两块各算一次地址的写法一律判红）；
3. `target.@type == 'EntryPoint'`、`query-input == 'required name=search_term_string'`；
4. 诚实性交叉检查：同一份首页产物里必须同时存在 `id="cmdk"` 与 `editorial.min.js`——
   面板或脚本不在，`?q=` 就是空头支票，这一格直接红（这条是 §6 那句「次序是硬的」的机器版本）。

牙齿（`check-seo-teeth.mjs` 变异集补 4 条，全部只改 tmp 副本）：删掉 `potentialAction`／
urlTemplate 少 `?q=`／占位符写成 `{q}`／把首页那份 WebSite 复制到 `/page2/`（数量 2 → 必须红）。

### 8.2 门禁二：`scripts/verify-search-deeplink.mjs`（headless CDP，真产物）

1. `/better-blog/?q=转场`：`#cmdk` 不 hidden、`body.cmdk-open` 在、`#cmdk-input.value == '转场'`、结果行 > 0 且含 `<mark>`；
2. 输入同步：改值后 `location.search` 带上新 `q`，其余参数与 hash 未被吃掉；
3. Esc 关闭：地址回到进入时那一份（`q` 被抹掉）；
4. IME：`compositionstart` + `isComposing:true` 的 Enter → 地址不变、不跳转；`compositionend` 后才出结果；
5. 多词集合：`?q=转场 搜索` 的 URL 集合 == 本脚本用 Node 独立实现的 AND 口径所算出的集合（两条实现，不是抄一遍）；
6. 单词回归：一批单词查询，结果顺序与 HEAD 产物逐条一致（同一脚本跑两棵树对账）。

配套 `verify-search-deeplink-teeth.mjs`：在 `_site` 的 tmp 副本里把同步/门控代码逐条摘掉，判据必须红
（变异只打在构建产物 `assets/js/editorial.min.js` 的文本上，绝不动工作树）。
脚本按房规自证：`port=0` 自报端口、每样本 nonce、`setCacheDisabled`、`setDeviceMetricsOverride` + 回读 `innerWidth`，
负载过高时主动 exit 2 而不是交一个假绿。

### 8.3 A/B 实测三个数

① 单词查询结果集与顺序：HEAD 产物 vs 新产物，逐条对账，必须全等（改动的安全性）；
② 多词查询：HEAD 命中 0 的组合里，新产物命中几条（改动的收益）；
③ 深链进站的首屏代价：带 `q` 与不带 `q` 两份进入各测 `search.json` 请求次数与 `load` 时间，
   fast3g 档为准（不写「不限速那一档没测所以不算」的数）。

### 8.4 房规

`npx prettier --single-quote --print-width 320` 与 eslint/stylelint 走全套；spec 与 plan 文档一律不过 prettier；
只按 pathspec 暂存自己的文件（并发会话在同一条 main 上有 16 个暂存项）；不碰 `_config.yml`、`package.json`、
`dev/sass/toolkit.scss`、`sw.js` 与那三条 SW 门禁；**不 push**。

## 9. 风险与回退

| 风险 | 处置 |
| --- | --- |
| 深链自动开面板 = 落地即 `body{overflow:hidden}`（`editorial.scss:3849`） | 语义正确（面板本来就是模态），但要在 ② 里看一眼：若 Googlebot 抽样抓 `?q=` 而 JS 关掉，看到的仍是首页正文，没有隐藏内容问题 |
| 地址栏同步与 waline / 统计脚本读 `location` 打架 | 只用 `replaceState`，不产生 popstate；GA/百度统计那三条已改 `defer`，它们读的是同步时刻的地址，深链进入时读到的带 `q`——这是**更准**的页面名，不是脏数据 |
| `URL` / `URLSearchParams` 抛出，或 Safari 对 `replaceState` 的限流抛异常 | `boot()` 没有逐条守护（`:3076-3097`），抛出会连带掐死后面 14 项 init。读 `q` 与写地址栏两处各自 try 住，失败就是「这一轮不同步 URL」，面板照常可用（§3 末） |
| 多词 AND 把「用户以为的 OR」变严 | 中文常见写法本来就是「一个词」；两个词之间打空格的人要的是交集。若实测发现零结果率明显上升，回退只动那一句门（「任一词在四个字段里都得 0 分才出局」改成「任一词拿到分就入选」），门禁 8.2 里那条 Node 独立实现跟着换口径——两边必须同日改，否则第 5 项判据自己跟产物打架 |

## 10. 交接

- D2（共享元素形变）：等 §7 那条 `getAnimations({subtree:true})` 实验给结论，且并发会话的动效门禁落定之后再排。
- 本分支回灌 main 只能等对方把 `dev/js/editorial.js`（主工作树里是 ` M`，挂着他们的 SW 段）与 `toolkit.scss` 提交之后 fast-forward。
- `index-all.html` 那句「无脚本」与产物不符（它带 `#cmdk` 和三份 bundle），本轮不动，记在这里。

## 11. 交付实录（SP3，2026-10-02）

### 11.1 落地清单

行号取本轮提交那一棵树（`dev/js/editorial.js` 3,207 行；两份新门禁分别 668 / 406 行）。

| 项 | 位置 | 这一格防的是什么 |
| --- | --- | --- |
| E1 深链 | `dev/js/editorial.js:633`（`open(trigger, preset)`）、`:663`（`syncUrl`）、`:895-901`（读 `?q=`，位置在所有监听器之后） | 分享出去的链接别人打开得是「已经搜过」那一态 |
| D3a 组合输入 | `:621`（`composing`）、`:864`（按键门）、`:875-887`（`compositionend` 补渲染 + `input` 门） | 组合中按 Enter 打开第一条结果并跳走 |
| D3b 多词 | `:676`（`toTerms`）、`:690`（`score` 收词表）、`:711-738`（`escRe` 与逐词逐处 `mark`） | 「两个词」退化成「整串找不到」，以及高亮只包第一处 |
| E2 SearchAction | `_includes/jsonLd.html:141-148` | 声明一个没人接的地址 |
| 门禁一（静态） | `scripts/check-seo.mjs:1143`（组 11）、`:1183`（`GROUPS` 由 10 个变 11 个）＋ `scripts/check-seo-teeth.mjs` 补 4 刀 | urlTemplate 与本页 `url` 走散；声明漏到翻页视图 |
| 门禁二（浏览器） | `scripts/verify-search-deeplink.mjs`（新增，J1–J7 / 25 判据）＋ `scripts/verify-search-deeplink-teeth.mjs`（新增，13 刀 + 3 自检） | 判据空转、判据写反、变异没落地 |

### 11.2 门禁台账（逐道退出码）

10 道非 Chrome 门禁全 `exit=0`（命令都在本工作树跑；除牙齿那两本对着 `/tmp/sp3-ab/*` 的快照副本，其余读的就是本树 `_site`）：

- `node scripts/toolkit-tests.mjs`：439 pass / 0 fail。
- `node scripts/check-seo.mjs --root=. --site=_site`：11 组全绿，JSON-LD 205 块全部可解析（135 页 / 78 篇文章页 / 101 页带安装面）。
- `node scripts/check-seo-teeth.mjs --root=/tmp/sp3-ab/new --site=/tmp/sp3-ab/new/_site`：`141/141`（用时 276.4s）。分账 `语料 6 / keywords 7 / modified 10 / JSON-LD 30 / 分页门 2 / ItemList 18 / manifest 24 / 接线 9 / head 7 / 相关工具 15 / 换源 9 / searchAction 4`。
- `ruby scripts/check-image-dims.rb` 36/36 断言；`check-image-dims-teeth.mjs` 27/27；`check-image-variants-teeth.mjs` 15/15。
- `check-tools-surface.mjs --site=_site` 4 条 ready × 5 组全绿；其牙齿 74/74。
- `verify-plan-blocks.mjs` 76 节已落地镜像逐字节全等（未落地 0 节）；其牙齿 41/41。

2 道 Chrome 门禁（收口这一遍，1 分钟负载 11.6 的窗口）：

- `node scripts/verify-search-deeplink.mjs --site=/tmp/sp3-ab/new/_site --head=/tmp/sp3-ab/head/_site` → `全绿（25 条）`。不带 `--head=` 时 J6 那一组（8 个单词的逐条对账）不成立，收尾行按实测打印 `跳过 1 条：J6 单词回归（需要 --head=<上一棵产物的路径>，本轮没有可比的树）`——跳的是这一组，不是 8 条读数，绿与红的计数里都不含它。
- `SDL_SITE_DIR=/tmp/sp3-teeth/_site node scripts/verify-search-deeplink-teeth.mjs` → 16 项里 15 项在一遍里点燃，M10 撞上一次负载拒绝，单刀补跑点燃 → **16/16**。

负载闸门不是装饰：这一遍 M10 那轮报的是 `✗ 环境没起来：1 分钟负载 21.2 > 16 且等了 90s 没落下来`，harness 退 2，套件把它记成「环境/空刀」而不算点燃（上一遍 M9 同一次）。那种轮子交上去就是假数。

### 11.3 A/B 实测三个数

基线树 `/tmp/sp3-ab/head/_site` 是纯 `0bc51a1` 导出树重新构建（写死提交号，不用 `HEAD~N`：落地途中提交数会变）；新树 `/tmp/sp3-ab/new/_site` 由本工作树工作区内容 rsync 出去构建，其 `assets/js/editorial.min.js` 与工作树那枚 md5 相同（`dc9e7fca407f…`，43,501B）。

**① 单词结果集与顺序**（J6，同一脚本跑两棵树，比 URL 序列与条数）：8 个词逐条等序 —— `搜索 4 / 性能 5 / 面试 5 / 浏览器 12 / 插件 6 / diff 3 / 缓存 2 / nginx 2`（条数由 Node 侧从 `search.json` 独立数出，不是抄产物）。

**② 多词**。旧实现是「整串 `indexOf`」，两个词之间一个空格就 0 命中：

| 查询 | head | new |
| --- | --- | --- |
| `浏览器 插件` | 0 | 3 |
| `插件 浏览器` | 0 | 3 |
| `性能 缓存` | 0 | 1 |
| `输入法 中文` | 0 | 1 |
| `diff 工具` | 0 | 0 |
| `zzz不存在词 搜索` | 0 | 0 |

后两行是控制组：AND 不是「多词就一定有结果」的橡皮图章。`工具` 单词在两棵树都是 21 条命中、面板都只展示 20 行——top-20 截断规则没被这次改动碰过。

**③ 深链进站的首屏代价**。口径：fast3g（Lighthouse 那档：下 1.6Mbps、上 750Kbps、RTT 150ms）；本地服务对 `text/*` 与 `application/json` 压 gzip，与 GitHub Pages 一致；5 轮/侧取中位数；Service Worker 全程未接管（接管过的轮次不计入）；时间相对 `navigationStart`。

| 读数 | 不带 `q` | 带 `q=搜索` |
| --- | --- | --- |
| `search.json` | 0 次 / 0 B | 1 次 / 18,899 B（其中正文 18,599 B） |
| `load` | 1912ms | 1915ms（+3ms） |
| DOMContentLoaded | 1894ms | 1887ms（−7ms） |
| TTFB | 19ms | 17ms |
| 第一个结果行 | 这一态不存在 | 2355ms（语料于 2350ms 落地） |

读法：`load` 基本不动（+3ms，落在 5 轮 1896–1961ms 的极差里），因为语料是 `initPalette` 里 JS 发起的 `fetch`，不阻塞 `load` 事件——这一条是实测出来的，不是从规范推的（早前一版量具把「JS 发起的 fetch 挡不住 load」当成前提用，结果读出过 `load=null`）。真实代价长成「第一行落在 2355ms」的形状，其中 2350ms 是 fast3g 下 18.9KB 的下载时刻，行的渲染跟在后一帧。所以这句要说准：深链没有把首屏拖慢，它把「结果出现」这一件事从「用户手动开面板再打字」提前到了「进站即开始」。

**字节账**：`editorial.min.js` 42,568 → 43,501B（raw +933 / gzip +354）；`index.html` 81,181 → 81,434B（raw +253 / gzip +94，只有首页，来自 E2）。口径 `wc -c` 与 `gzip -c | wc -c` 各跑两棵树的同名产物，FNAME 头两侧同长故抵消。

### 11.4 与 spec / plan 的偏离（5 处，都是量具先红出来的）

1. **测试词**。spec §8.2 与 plan 的 J1 都写 `?q=转场`，而「转场」在这份 78 条的 `search.json` 里 0 命中——用它当深链判据等于拿空态验「开面板 + 出结果」，M1 那种「进站根本不 `open`」的破法也能绿。换成 `搜索`（4 命中），并在脚本开局加一条「测试词在这份语料里有 N 条命中」的自证，数不出来就 `exit 2`。J2 仍打 `动效`（也 0 命中），因为那一格量的是地址栏跟不跟，与结果集无关——顺带证明 `syncUrl` 不挂在「渲染成功」之后。
2. **`?q=` 空串那一格 spec 有（§3 第二段）、门禁原先没有**，本轮补了 J1 的第二形态与 M13 这一刀。不是洁癖：E2 的 `urlTemplate` 就是 `?q={search_term_string}`，空值是爬虫真会请求到的形状。判据是三条一起读——面板仍 `hidden`、输入框仍空、这一趟 `search.json` 请求 0 次；反面判据的「活着」不靠宽限时间，靠 `editorial.min.js` 是普通阻塞脚本 + `goto()` 等到 `readyState=complete` 才返回。
3. **J2「只准 replace」在 plan 里是枚计划级假牙**：写的是 `performance.getEntriesByType('navigation').length !== 1`，而那个条目数每个文档恒为 1、`pushState` 根本不往里加——这一格会永远绿，且永远抓不住「后退要先退回上一个词才退得出面板」。改成开面板前后各读一次 `history.length` 比差，M5 才有地方红。
4. **J3 补了一条反恒真前置**：关闭那一刻地址栏里必须真的有 `q`。否则「`syncUrl` 完全没实现」也能让 J3 全绿——没有 q 就没什么可抹。
5. **E2 的四条牙齿与 spec §8.1 同名不同形**：第 2 条打成「键名换成 `?query=`」而不是「少 `?q=`」，第 3 条打成「`query-input` 改成 `term`」而不是「占位符写成 `{q}`」。理由是占位符改名会同时打断两条判据、红得没有指向；换 `query-input` 的键名只测「两处一致性」那一条。

另两处是 plan 自己的命令写错：`node scripts/check-image-dims.rb` 应为 `ruby scripts/check-image-dims.rb`（那是 Ruby）；plan 与 §8.4 都提到 `prettier --write dev/js/*.js`，本仓房规是 `dev/js/` 不过 prettier（只有 `check-*.mjs` 与 markdown 过），且仓里没有 prettier 配置文件——本轮实际只对 `check-seo.mjs` / `check-seo-teeth.mjs` 跑过 `--check`，两枚 exit=0。

### 11.5 量具自己踩的坑（4 个，都已落成代码里的守卫或注释）

1. **terser 每改一次源码就把局部名重排一轮**（这一版 `open→x`、`close→L`、`render→I`、`syncUrl→C`、`composing→p`、`entryUrl→v`）。变异锚点因此只能打**构建产物里的结构串**，且命中数必须恰好 1——不等于 1 就抛 `exit 2`。「空刀」不算点燃。
2. **「有行或空态」不等于「落定」**。J7 实测抓到过一次 0 行：空态先亮了一下，判据拿着还没填内容的结果去和语料对账，红得像是 AND 少切了一刀（那是量具的账，不是产物的）。改成 `settlePanel()` 两道闸：ResourceTiming 里出现 `search.json`（只在响应落地之后才进缓冲区）+ 之后行数与空态连着两次读一样（间隔 120ms）。
3. **判「结果集合」的 J5/J6/J7 不许从深链进站**。M1 那一刀原本连带红 10 格，归因就死了；这三组改走「手动开面板 + 打字」之后，深链一族只红在 J1（J4 复用深链铺前置是刻意的，牙齿里按 `cascade` 登记）。13 刀里 6 刀带登记连带（M1/M2→J4 前置、M3→J3 反恒真、M4→J3 还原、M10→J5 五格同因、M11→J7 两词都要有高亮），其余 7 刀各红一条；没写进 `cascade` 的红仍然算「红错地方」。
4. **影子副本会被上一轮的残留骗过**。牙齿这一本 bake 的是副本现有内容、不自己重拷：实测把套件杀在 M10 之后，副本比 `_site` 少 29 字节、md5 从 `dc9e7fca407f` 变成 `273c92133215`，而「基线自证」那一行仍可能照绿。现在开跑先比副本与 `ROOT/_site` 的 md5，不一致就 `exit 2` 并给出重拷命令。

### 11.6 未做与移交

- 摘要片段的选择规则没变（`hits` 含 3 就展示 excerpt，否则展示 title），所以 §5 那条「某个词只命中了标题时，它在这一行的可见片段里可能不高亮」仍然成立。
- `syncUrl` 里那句 `if (entryUrl === null) return;` 没有对应的刀：今天没有可观测路径（唯一可能在关着时被调用的 `close()` 先 `syncUrl('')` 再置 null）。给它配一刀就是造假牙。
- D2 共享元素形变仍按 §7 退出，等那条 `getAnimations({subtree:true})` 实验给结论。
- 全部提交只在 `sp3-motion-search` 这条分支上，未 push。


## 11.7 拆包之后这一族的两处失守（2026-10-21 补）

批 C 把面板从 `editorial.min.js` 挪进独立的 `palette.min.js` 之后，这一族静默坏了两处，
都是「代码移动」而非「逻辑改写」造成的，只有真跑浏览器与真跑牙齿才看得见：

1. **桌面第一次点搜索按钮没有反应**（`spark-output/verify-first-click.mjs` 实测：点击确实落在那颗
   按钮上，`window.BBPalette` 在 3s 后到场，面板全程不开；补第二下才开）。根因是 `dev/js/index.js`
   在 `.g-nav` 上无条件 `stopPropagation()`，而桩的 `click`/`pointerdown` 监听挂在 `document` 的
   **冒泡**阶段——收不到这一击，队列里没有待回放的那一次。`palette.js` 早就为同一堵墙把入口改成
   直接绑按钮，桩不能照做（它绑的时候模块还不存在），所以改成**捕获阶段**监听。
2. **`?q=` 深链进站不再开面板**。`open(null, preset)` 那一步在模块里，而模块只在有人交互时才起载，
   于是带查询串进站（SearchAction 的 urlTemplate 正是这一条形）等于「进站什么也不发生」。
   修法：桩在 `initPaletteStub()` 末尾检查 URL，`q` 有非空值就立刻 `ensurePalette(null)` 起载；
   空串 `?q=` 不起载，与「空查询不许开遮罩」那条反例同侧。红→绿对照：同一个 build 只加这一步，
   `verify-search-deeplink` 的 J1 与 J4 前置由红转绿。

牙齿那一本同时暴露出第三件事，且比前两件更贵：**13 刀里 11 刀当场空刀**。两个原因叠在一起——
`REL` 清单只列 `assets/js/editorial.min.js`（面板已经不住在这儿），而锚点里带着 terser 起的局部名
（`E&&x(null,E)`、`n.value=a||""` 这一族）。§11.5 第 1 条早就预言过这件事，这次是真发生了，
只是靠「空刀必须 `exit 2`」这条守卫才没有变成一片假绿。重钉之后 16/16 点燃（13 刀 + S1/S2/S3）。

M13 还需要一个 §11.5 没写过的口径：**同一个门挪进两颗包之后，只摘内侧那道的刀是假刀**。
「空串不开面板」现在由两处将（桩的起载判据、面板的 `preset && open`），单改面板那一处时模块根本
不加载，判据看着绿。`apply()` 因此支持 `also` 第二落点，每处各判恰好 1。
移交条件：任何再改变 vite 入口切分的改动，之后必须立刻重跑 `verify-search-deeplink-teeth`，
并按当日产物重钉锚点——这条不重跑，这一族就没有牙齿。
