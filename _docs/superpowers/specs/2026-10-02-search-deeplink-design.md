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
