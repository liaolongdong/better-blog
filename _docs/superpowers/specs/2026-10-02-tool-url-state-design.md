# 工具页档位进 URL（SP2 第一刀）设计

日期：2026-10-02　子项目：SP2（工具产品扩张 C1–C5）的第一刀　分支：`sp2-tool-url-state`
前置：SP1（`2026-10-02-seo-aeo-structure-design.md`）、SP3（`2026-10-02-search-deeplink-design.md`）

## 0. 这一刀切在哪

四份先例（证件页 / 编码页 / JSON 页 / 对比页）各自是一份 spec + 一份 plan，C1「再加一枚工具」
塞不进这一刀；C4「隐私条」要在四页加可见区块，就得动 `dev/sass/toolkit.scss`，而它在主工作树
至今是 `MM`（并发会话未提交，见 SP1 §2 与本仓 §8.8）——SP1 的 A2 那一节（`:271`）当初把隐私条
推给 SP2 的理由就是这一条，约束到今天没解除。

于是这一刀只留 C3 里形状最完整的那一块：**把两枚单工作台页（JSON / 对比）的档位做成可分享的
地址**，同时给四页立一条统一的不变量「用户输入不进地址栏」。JSON 页与对比页今天对地址栏
一个字节都不读也不写（`grep -n "location\|history" dev/js/toolJson.js dev/js/toolDiff.js` = 0 命中），
这是四页里唯一还完全没有分享能力的两页，也是状态面最小、最容易一次做对的两页。

## 1. 起点事实（逐条复核过，不是转述）

1. **面板两页已经有半套**。`dev/js/toolIdcard.js:99` 把 `hash: win.location.hash` 交给
   `createPanelWorkspace`，`:118-119` 注入 `location` / `history`（`toolCodec.js:120,142-143` 同形状）；
   `dev/js/tools/panel.js:214-220 parseHash()` 大小写不敏感地认面板 id，`:146-156 applyHash()` 接住，
   `:158-160 toHash()` 只在「用户真的点过面板」时才产 `#面板`。写地址的那一格在
   `dev/js/tools/panel-dom.js:161-166`：`history.replaceState(history.state ?? null, '', target)`，
   **`search` 一个字节不碰**。所以 `…/tools/codec.html#digest` 今天就能分享，`?` 那一半是空的。
2. **工作台两页是空的**。`toolJson.js:159-177` / `toolDiff.js` 注入给工厂的是一串环境量
   （`storage` `navigator` `now` `later` `rowHeight` `BlobCtor`…），里面没有 `location`，也没有 `history`。
   面板页那条「环境只在入口这一本读」的红线（`toolJson.js:147-149` 的注释）就是这一格要走的形状：
   新增的两格仍由入口读、由入口注入。
3. **档位清单**。JSON 页 `dev/js/tools/jsonWorkbench.js:86-105`：`doc`(area) / `view`(text|tree) /
   `query`(text) / `indent`(two|four|tab) / `sort`(off|shallow|deep) / `memorize`(checkbox)，
   显隐源是 `switch.by = 'view'`。对比页 `dev/js/tools/diffWorkbench.js:81 DEFAULTS`
   `{mode:'text', layout:'side', context:'3'}`，加 `:88 CONTEXT_VALUE`（`diff/3/5/all`）、
   `:92 MODE_OPTIONS`、`:95 LAYOUT_OPTIONS`，另两枚 checkbox 走 `:312 flag()`（`ws` / `case`）。
4. **程序化改档有两条路，不都经过 `change` 事件**。对比页「重置」
   （`diffWorkbench.js:635-641`）直接给五个控件写回默认值再 `readControls()`，折叠动作
   （`:645-649`）直接写 `field('context').value = fold.to` 再 `retune('context')`——两条都不派发事件。
   JSON 页的 `indent` / `sort` 压根没有监听器（`wireAll` `:885-914` 只给 `doc`/`view`/`query`/`memorize`
   接线），它们在每次动作里被 `valueOf()` 现读。这两件决定了同步点必须逐条点名，
   「挂在 change 上就全了」在这一页是假的。
5. **控件 id 的形状**：`fieldId(p, panel, id)` = `` `${p}-in-${panel}-${id}` ``
   （`diffWorkbench.js:115`、`jsonWorkbench.js:131`），产物里就是 `id="jt-in-workbench-view"` /
   `id="df-in-workbench-mode"`（`_site/tools/json.html` / `diff.html` 实读）。`prefix` 权威在
   `_data/onlineTools.yml`（`idcard` `:62` = `tk`、`codec` `:122` = `tk`、`json` `:196` = `jt`、
   `diff` `:250` = `df`），门禁⑤ DOM 组比的就是这张表。
6. **地址栏带 query 不会被搜索引擎当重复页**：`_includes/seoMeta.html:96` 的 canonical 是
   `{{ page.url | absolute_url }}`，产物实读
   `<link rel="canonical" href="https://liaolongdong.github.io/better-blog/tools/json.html">`——不带 query。
7. **反过来，query 会跟着 Referer 出去**：`_includes/cloudflareAnalytics.html:4` 那枚 defer beacon
   请求 `static.cloudflareinsights.com`，出站请求的 Referer 含完整 query。这一条是这一刀
   「只进档位、不进内容」那句设计的直接来源，不是修辞。
8. **hash 是被占用的**：目录链接 `dev/js/editorial.js:266` 与标题锚点 `:1072` 都写 `href = '#' + id`，
   而复制锚点那句 `:1076-1078` 拿的正是 `location.href.split('#')[0] + '#' + id`。工作台两页今天没用
   hash，但把状态放 hash 上会和「滚到某一节」互相踩，而放 query 上两者天然共存（`?jt-view=tree#section-3`）。
9. **存储那一格不能进 URL**：`jsonWorkbench.js:268-269` 的两枚键是 `${prefix}.memory.on` /
   `${prefix}.memory.input`，`memorize` 一开就把输入正文写进这台机器的 `localStorage`（`:651-658`），
   `restore()` 在挂载时填回来（`:660`，`wireAll:941` 调它）。分享链接不该在陌生人机器上打开这条写入。

## 2. 设计

**键名 = `{prefix}-{控件}`**（`jt-view` / `jt-indent` / `jt-sort`；`df-mode` / `df-layout` /
`df-context` / `df-ws` / `df-case`）。不取裸控件名：`mode` / `view` / `case` 是通用词，任何第三方
往链接里塞一枚同名参数就把这一页的档位改掉；不取整条 DOM id（`jt-in-workbench-view`）：分享出去的
串要人能读、要短。前缀是 yml 里已有的声明位，不新造表。

**代码落点 = `dev/js/tools/url-state.js`，经 `toolkitCore.js` 挂成 `window.Tk` 的第五只。**
段 4 与段 5 那两份计划各写过一行「本段不许往 `window.Tk` 上加第五只」（
`2026-09-29-tools-json-page.md:55`、`2026-09-30-tools-diff-page.md:57`），那两行的理由是同一条红线：
两个入口同时 `import` 同一模块 → Rollup 提共享 chunk → `iife-wrap` 之后整页 SyntaxError。
**它们的禁令是本段范围，不是这一格的永久结论**——按它们自己给的方向，跨页共用的东西正是走 `Tk`：
`url-state.js` 零 import、只有具名导出，唯一 reach 它的是 `toolkitCore.js` 一处，所以这一格扩面不踩那条红线。
配套的三处清单必须同批改，否则门立即刻红：`toolkit-tests.mjs` 的 J12、O13(c)、Q2 三处都按
`Object.keys(window.Tk)` 钉死了挂面（Q2 那一句写的就是「别在这儿偷偷加」）。

**白名单只装枚举值**。`jt-query`、`jt-doc`、`df-a-text`、`df-b-text`、`jt-memorize` 明确不在名单里——
这一句是这一刀唯一的全页不变量，四页一起判：往任何输入格里打一枚唯一 token，动完之后
`location.href` 里不许出现它（面板页同样判，尽管这一轮不给它们加新键）。

**读**（进站一次，位置见 §2.4）：`new URL(location.href).searchParams`，逐键取值，
只接受白名单内的字面量；空串、白名单外的值、键不存在，三种都当「这一格没人说话」，
让控件保持骨架给的那一档，**不抛、不抹、不写回**。这与 `selectOf`（`diffWorkbench.js:303-311`）
那句「非空而白名单外一律上抛」刻意分家：页面自己的骨架与 spec 漂了是缺陷，要抛；
陌生人手改过的地址栏不是缺陷，是流量。

**写**（只在档位真的变了之后）：以当前 `search` 为底本，`URLSearchParams` 逐键 `set` / `delete`，
`history.replaceState(history.state ?? null, '', next)`——与 `panel-dom.js:165` 同一形状：
只动自己那几个键（`utm_source`、`keep`、别人塞的一律原样带走），只用 replace（改档位不是新历史，
后退不该先退档位），`history.state` 原样带走（面板页已有的那格约定不能被我改掉）。
只有非默认值才留键，落回默认就删键（否则按了「重置」地址栏还挂着 `?df-context=all`，
刷新就复活成重置前那一档）。整段 `try` 住，与 SP3 E1 同一条理由：Safari 对 `replaceState` 有
明确限流（30 秒 100 次直接抛），而 `boot()` 平铺 20 个 init 没有逐条守护（SP3 spec §10 自查那段）。

**同步点逐条点名**（§1.4 决定的）：
- JSON：`view` 的 `change`（`wireAll:898-907` 那一段之后）、`indent` 与 `sort` 各补一枚
  **只做地址栏、不做计算**的 `change` 监听、`query` 的 `change`（不是 `input`——地址栏跟的是
  定稿那一个词，而它又不进地址栏，所以这一格实际只用于「离开输入框」的语义）。
  `memorize` 与 `doc` 不同步。
- 对比：`retune()` 末尾（一次覆盖 `mode` / `layout` / `context` 三个下拉与折叠那两条程序化写回）、
  `ws` / `case` 的 `change` 处理里、以及 `reset` 那一段（`readControls()` 之后）。

**挂载序**：URL 的值在**现有挂载三笔之前**落进 DOM 控件。JSON 页 `wireAll` 的尾部那三笔
（`:940-943`：`applySwitch()` → `restore()` → 空态 + `updateGate()`）照原序跑，于是
`?jt-view=tree` 得到的显隐结果与用户亲手切到树**完全同一条路径**，不新增第二份口径，
也不违反那格红线「挂载期一次计算都不做」（`:26`）；对比页同理，写在 `refreshGate()`（`:806`）之前，
读到的档位会进那一次闸门读数，仍然不是一次比对（`computes` 不涨，Z18 判的就是它）。

**进站即写不写一次？** 不写。地址栏里已经有的合法键不需要被原样再写一遍；非法键也不去抹它
（那不是我的参数，抹掉别人的参数是比不抹更糟的行为）。这一条要在门禁里判得住：
带 `?keep=1&utm_source=x` 进站、不做任何操作，`search` 必须逐字节不变。

## 3. 错误处理

只有一处边界：`URL` / `URLSearchParams` / `replaceState` 三个都可能抛（畸形地址、旧 WebView、
`replaceState` 限流）。读侧包在 `try` 里，失败就是「没读到」——页面按骨架默认档跑，与不带参数
进站完全一样；写侧同样，失败就是地址栏不动，档位本身早已生效（**地址栏是结果的镜像，不是来源**：
控件是权威，这一点与 SP3 的 `syncUrl` 同一条）。两处都不往页面提示里写话：地址栏坏了不影响
用户拿到他要的转换结果，为这一格弹一行红字是噪声。

## 4. 明确不做

- **C1 新工具**：产品决定（做哪一枚、正文、示例、tag），且每枚工具都有独立的 spec+plan 先例。
- **C2 工具页 `post_tag`**：改 `_data/onlineTools.yml` 的 tag 会牵动 `article-check` 与
  `verify-plan-blocks` 的镜像账（SP1 §8.5 第 13 处缺陷正是那本），单独排。
- **C4 隐私条**：见 §0，`toolkit.scss` 未落定之前不动四页可见区块。
- **C5 历史 / 批量 / 快捷键**：三件事各自都不小，各有各的门禁形状。
- **FAQPage**：Google 自 2019-08 起只对「知名、权威、政府类」站点展示 FAQ 富结果，个人博客加它
  拿不到 SERP 折叠；剩下的价值（AI 答案引擎可摘取）不靠这一种 schema，正文里的问答小节同样可摘。
  要写归内容那一格（SP4），不归结构化数据。
- **`aggregateRating`**：需要真实评价源，本站没有。编造评分是对爬虫的虚假陈述，也是
  Rich Results 的 spam 判定项。

## 5. 验收：门禁化 + A/B 实测

**门禁一（浏览器）** `scripts/verify-tool-url.mjs`，两页各跑一遍，U1–U7：进站按参数落定 /
非法值与空值一律忽略且不抹 / 除白名单外参数逐字节不变 / 只用 replace（`history.length` 增量 = 0）/
程序化路径（折叠、重置）也跟 / 「输入不进地址栏」四页全判 / 落回默认删键。
配 `scripts/verify-tool-url-teeth.mjs`：每一格至少一刀，全部打在产物 `assets/js/tool*.min.js`
的文本副本上（副本 md5 自证，空刀退 2），沿用 SP3 那本定下的三条房规：端口自己抢、
开局对账磁盘与服务器那份 md5、1 分钟负载超阈值直接拒测。

**门禁二（静态）** `scripts/check-tools-surface.mjs` 追加一组 `urlState`：白名单表与
`_data/onlineTools.yml` 的 `prefix` + `spec.ids` 逐键对账（键名必须能由「前缀 + 控件」拼出真实
DOM id），另加一条负判据——`doc` / `query` / `a-text` / `b-text` / `memorize` 五格出现在名单里
就是红。牙齿补相应刀数。

**A/B 三个数**（口径写死可复算）：① 9 枚键逐个进站，head 树（本轮改动之前那一份产物）一律落
默认档、new 树按参数落定，合法 / 非法各一遍；② 地址栏卫生：连改 20 次档位后 `history.length`
增量 = 0、最长 URL 实测值、`?keep=1&utm_source=x` 三个参数一字未动；③ 首屏代价按 Pages 口径
（fast3g + gzip，5 轮/侧取中位数，SW 接管过的轮次不计）量带参 vs 不带参的 `load` /
DOMContentLoaded / 首次动作耗时——预期 ≈0，量出来证明它不劣化，而不是假定它不劣化。
