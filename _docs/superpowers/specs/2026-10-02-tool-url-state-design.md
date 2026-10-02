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

**A/B 三个数**（口径写死可复算）：① 八枚键逐个进站（`jt-view jt-indent jt-sort` +
`df-mode df-layout df-context df-ws df-case`），head 树（本轮改动之前那一份产物）一律落
默认档、new 树按参数落定，合法 / 非法各一遍；② 地址栏卫生：连改 20 次档位后 `history.length`
增量 = 0、最长 URL 实测值、`?z=9&keep=1&utm_source=x` 三对一字未动；③ 首屏代价按 Pages 口径
（fast3g + gzip，5 轮/侧取中位数，SW 接管过的轮次不计）量带参 vs 不带参的 `load` /
DOMContentLoaded / 首次动作耗时——预期 ≈0，量出来证明它不劣化，而不是假定它不劣化。

## 6. 交付实录（2026-10-03）

A/B 的量具是一次性的（`/tmp/sp2-ab/{build.sh,hygiene.mjs,ab-load.mjs}`，**没入库**——入库的是口径，
脚本里的每一处判据下面都照原样写成了可复算的句子）。骨架照 `verify-tool-url.mjs`：一棵 `_site` 挂
`http.createServer`（`cache-control: no-store`、`/better-blog` 前缀剥掉再落盘）、端口从 `listen(0)`
抢、开局把三本 min 产物的磁盘 md5 与服务器吐的那份对账，视口 `1280×900` 且 `innerWidth` 自证。

### 6.1 两棵干净树与差异面

head 树 = `git archive d717c17` 导出到 `/tmp/sp2-ab/head`（提交号写死，不用 `HEAD~N`）；new 树 =
本工作树内容 `rsync`（排除 `_site node_modules vendor .git .jekyll-cache .sass-cache`）到
`/tmp/sp2-ab/new`。两棵各自软链主仓的 `node_modules` 与 `vendor`，各跑一遍 `npx vite build` +
`npx vite build --config vite.demo.config.js` + `bundle exec jekyll build`。差异面先断言再量数：

| 产物 | head | new | 说明 |
| --- | --- | --- | --- |
| `_site/tools/json.html` | `8e88c934…` | `8e88c934…` | 一字未动 |
| `_site/tools/diff.html` | `49717c82…` | `49717c82…` | 一字未动（这一刀全在 JS 层） |
| `assets/js/toolkitCore.min.js` | 19,200 B | 20,232 B | +1,032 B（挂上 `Tk.url`） |
| `assets/js/toolJson.min.js` | 126,716 B | 127,958 B | +1,242 B |
| `assets/js/toolDiff.min.js` | 51,541 B | 53,150 B | +1,609 B（含折叠档位键序那一修） |

工作树自己的产物在 Task 6 之后是**陈的**（`toolDiff.min.js` 三棵里唯一对不上），重建之后四格与
new 树逐字节全等——「跑门的那棵树 == 提交的那棵树」这条在本期是靠 md5 证的，不是靠推断。

### 6.2 ① 八枚键逐个进站对账

同一条命令跑两棵：`TU_SITE_DIR=<树>/_site node scripts/verify-tool-url.mjs`，读数全部从**产物骨架**
现取（日志第二行：`键表（骨架现读）：json 名单 3 枚 = jt-view jt-indent jt-sort；骨架里另有 1 枚按
spec 不进地址栏（jt-memorize）`）。

- **head 树**：`rc=1`、17 条红点。U1 那一组**八枚键全红**（`?jt-view=tree` 进站 3,044ms 后控件实读
  `text`……），而 U1 里另两条「空地址栏基线」是绿的——两棵树的默认档基准同字，所以红出来的差异面
  恰好只有「参数有没有被采纳」这一件事。
- **new 树**：`rc=0`、26 条全绿，U1 十项（八枚键逐键两读 + 两页空地址栏基线）全绿。
- **非法值那一遍**（U2 三条）两棵都绿，但两棵的绿不是同一件事：head 一次都没往地址栏写过，
  「不采纳、也不抹」自动成立；new 那一棵是实测——`?jt-view=treeish&keep=1&utm_source=x` 非法值不采纳、
  控件停回默认档 `text`，而那一串地址栏**一个字节没动**。恒真的那一侧记在这里，是为了不让它
  将来冒充「改前也过」。

### 6.3 ② 地址栏卫生

`node /tmp/sp2-ab/hygiene.mjs` 的 A 段（同一棵 new 树、同一只 headless Chrome、端口从 `listen(0)`
抢、开局三本产物磁盘↔服务器 md5 对账）：

- **连改 20 次档位**（构造口径：名单按 `i % 名单长度` 轮着点，值按 `options[(i+1) % 长度]` 轮——
  **含落回默认那一档**，删键那一路跟着一起量；勾选框按奇偶交替打）：json `history.length 2 → 2`、
  diff `5 → 5`，增量 **0**；页内 `pushState`
  计数两页都 **0**（计数器是打在 `history.pushState` 上的，不靠 `getEntriesByType('navigation')`
  ——那个条目每文档恒 1，SP3 spec §11.4 记过这枚假牙）。地址栏当时写着 `?jt-indent=tab&jt-view=tree`
  / `?df-layout=inline&df-context=5&df-ws=1`：确实写过，所以「增量 0」不是「一次都没写」的另一种说法
  （这一格由门禁 U3 的前置盯着，红过一次就是这个形状）。
- **最长地址栏**（每枚键取骨架里 `value` 串最长的非默认档）：JSON 页
  `?jt-view=tree&jt-indent=four&jt-sort=shallow` = **44 B**、对比页
  `?df-mode=json&df-layout=inline&df-context=diff&df-ws=1&df-case=1` = **64 B**（含前导 `?`；
  量的是 `location.search` 本体，与 origin 无关——整条含本机 origin 分别 94 B / 114 B）。
- **别人的参数**：带 `?z=9&keep=1&utm_source=x` 进站、拨满 3 枚 / 5 枚档位之后，把非本页前缀的
  几对还原出来仍是 `z=9&keep=1&utm_source=x`，与进站**逐字节全等**，自己那几枚排在末尾
  （门禁 U4 是同一件事的自动版，两页各一条）。

### 6.4 ③ 首屏代价

节流口径 `Network.emulateNetworkConditions`：RTT 150 ms / 下 1.6 Mbps / 上 750 kbps；
`Network.setCacheDisabled`；5 轮/侧取中位数。

**带参 vs 不带参**（同一棵 new 树——资源面逐字节相同，差的只是文档请求那一串 query）：

| 页 | 侧 | load | DOMContentLoaded | 可交互 | 首次动作 |
| --- | --- | --- | --- | --- | --- |
| json | 不带参数 | 3,461 | 3,451 | 3,306 | 22 |
| json | 带 43 B 参数 | 3,423 | 3,419 | 3,304 | 12 |
| diff | 不带参数 | 3,170 | 3,160 | 3,155 | 28 |
| diff | 带 63 B 参数 | 3,163 | 3,157 | 3,148 | 27 |

Δ 依次是 json `−38 / −32 / −2 / −10` ms、diff `−7 / −3 / −7 / −1` ms。**结论只能写到「量不出代价」
为止**：json 不带参数那一侧五轮是 `3,445…3,477`、带参数那一侧是 `3,397…3,473`，两侧区间重叠，
负的 Δ 是抖动不是收益。「首次动作」的口径 = 从派发 `change` 到地址栏 `search` 含上新值，5 ms 一轮询，
含两次 CDP 往返，所以两侧同涨同落。「带参数」那一侧每轮先逐键核对**控件确实停在参数档**才继续，
量的是同一个状态而不是两次不同的东西。

**两棵交替**（head vs new，量的是这一刀真实新增的字节）：`node /tmp/sp2-ab/ab-load.mjs`，两棵各
5 轮、交替采样。资源字节 json **+2,274 B**、diff **+2,641 B**——本地不压缩直传，逐字节等于 6.1
那张表里两本 bundle 的裸字节差（1,032 + 1,242 / 1,032 + 1,609），这一格是自证不是估算。load Δ
json **−18 ms**、diff **+8 ms**，都落在那一轮的离群值撑出的抖动带里（`head|json` 第 5 轮 6,561 ms、
`new|diff` 第 5 轮 6,277 ms，当时本机 1 分钟负载 20+，其余轮次 3,125…3,473）。

**gzip 口径**（`cat f | gzip -9 | wc -c`，不是 zlib API）：toolkitCore 7,075 → 7,444（+369）、
toolJson 43,445 → 43,801（+356）、toolDiff 19,842 → 20,337（+495）。落到线上是 JSON 页 **+725 B**、
对比页 **+864 B**，按 fast3g 1.6 Mbps 换算 **+3.6 ms / +4.3 ms**——比这套量具自己的分辨率（轮间
30–100 ms）小一个量级，所以 ③ 的三个数说的都是同一件事：**这一刀的首屏代价量不出来**。

这三笔 gzip 增量另有**一处后果不归这里判**：在线工具站点那份 spec（`2026-09-25-blog-online-tools-design.md`）的 §7 表按「最坏读数 ÷ 0.95 向上取 1024 倍」
回算台账，`11c` 因此在收口那一跑红了两行——红的是**档位对不上算式**（算式给 59,392 / 34,816，台账写
58,368 / 33,792），不是"某个百分比判据跌破"；两行的余量按最坏读数算是 2,894 ÷ 58,368 = **4.96%** 与
1,460 ÷ 33,792 = **4.31%**，`11c` 把它们打成 `5.0%` 与 `4.3%`（明细串只 round 到一位小数，所以那一格
会出现"看着像 5.0% 却判红"的形状——判据拿的是档位，不是这串打印值）。处置照的仍是那把尺自己给的数：
**JSON 那行升到 59,392B、对比那行升到 34,816B**，首屏那两行不动（件集里的 CSS 与 HTML 逐件 0 差）。
逐件账、`11c` 的红点原文与「为什么四行里只动两行」都记在 `2026-09-25-blog-online-tools-design.md` §7 那一格（2026-10-03 那一段），
这里只留指针——**这一刀的性能结论是「首屏量不出代价」，不是「字节没长」**，两件事必须分开写。

**SW 接管**：四页产物里 `serviceWorker` 出现 **0** 次（`for p in json diff idcard codec; do
grep -c serviceWorker _site/tools/$p.html; done` → 4×0），两轮共 40 次导航里
`navigator.serviceWorker.controller` 全为 `null`，剔除 **0** 轮。这一格照量照记，
是因为口径答应了它。

### 6.5 与计划的偏离（四处，每一处都写回了计划那道任务的「落地补记」）

1. **判据④换了实现形状**。计划给的是「数产物 `assets/js/tool{Json,Diff}.min.js` 里那枚名单数组的
   字面量长度」，退路是「数装配层源码里 `URL_KEYS` 的条目数」。落的是**集合对账**：名单与骨架现读的
   候选逐键比集合，红的时候两侧各多谁要点名。理由是前者在产物里根本没有那枚字面量可数（terser 把
   数组摊进了调用串），而条数口径躲不过「换掉一键、同时多塞一键」这种漂移。参数**顺序**不在静态门
   这一侧管，由浏览器门 U4 钉（新键必须排末尾）。
2. **牙齿五刀而不是四刀**。判据①（前缀 + 控件拼不出真实 DOM id）单独立了一刀，并把 `expect` 逐字
   钉死——改骨架 id 会同时红 DOM 那一组，不钉字面就归因不到这一刀。
3. **门禁第一跑就红在一处真缺陷**，照房规修代码而不是改门禁：`CONTEXT_VALUE` 是对象字面量，
   `Object.keys` 把整数样的键（`3` / `5`）提到前面，白名单读成 `3/5/diff/all`，而骨架从上到下是
   `diff/3/5/all`。改法是档位写成成对数组 `CONTEXT_TIERS`、`CONTEXT_OPTIONS` 由它派生；
   `tools-diff.html` 里那条 Liquid 注释原先断言「照键序排下来第一档是「只看差异」」也是错的，一并改口。
4. **`loadSpec` 多出第 5 个可选指针 `defaults`**（计划没这一格）。判据②要量「默认档换了而名单没换」
   那条最阴的漂，必须同时读得到装配层的 `DEFAULTS` 与骨架上带 `selected` 的那一枚 option，
   所以 `diffWorkbench.js` 把 `DEFAULTS` 导出（此前它只在页内用），`_data/onlineTools.yml` 的 diff
   条目 `spec` 多一行 `defaults: DEFAULTS`。

### 6.6 量具自己踩的坑（四条，都是下一轮会再踩的）

1. **跑门的树不等于提交的树**：A/B 第一版 new 树与工作树的 `toolDiff.min.js` 对不上——Task 6 改完
   源码没重建。三格产物里只有这一格暴露，另外两格恰好没被那一刀碰到。收口前必须逐格 md5 认树。
2. **一次性量具少了 WebSocket 的分发**：`Conn` 构造里只登记了 `pending`，没挂 `message` 监听，
   `Target.createTarget` 的回包落进虚空——进程活着、日志一行不吐，10 分钟才看出来。门禁本家那只
   `S()` 一直带 30s 计时器，临时脚本抄骨架就得把计时器一起抄，现已补 15s CDP / 5s ws 两道超时。
3. **后台完成通知会提前说谎**：牙齿台账那一道收到过一条「exit 0」通知，而 `pgrep` 还在、日志只有
   一行。认进程与日志，不认通知。
4. **同一件事的两种口径差 1 字节**：A 段报的「最长地址栏 44 B / 64 B」含前导 `?`（量的是
   `location.search`），B 段标签里的「带参数（43 B / 63 B）」不含。不是两处数，是同一串两种数法，
   所以 6.3 / 6.4 各自在原地写明了自己那一种。

### 6.7 未做与移交

1. **没 push**。分支 `sp2-tool-url-state`（base `d717c17`）上的提交都在本地，push 需要单独授权。
2. **`check-tools-surface.mjs` / `check-tools-surface-teeth.mjs` 不合 prettier**：两本在 `HEAD`
   就已经不合规，格式化会把 76 个逐字节镜像一起打断。这是**预期**的红灯，不是本期欠账；
   仓里的 lint 门不含这两本。
3. **B3（逐页 CSS 拆分）不在这一刀里**：那是 SP1 那一路的性能项，七项决策里定的是先不做，本期也没顺手动它。
4. **`verify-tool-url-teeth.mjs` 的十枚锚点取自压缩产物**：重新构建之后 terser 会换一轮局部名，
   必须先重数锚点再跑（命中数 ≠ 1 由 `apply` 拦成退 2，不会静默放行）。**本期这一条不是纸面风险，是实测踩到的**：
   收口第一遍它就在 T6 退 2（`"Ae()}finally{M()}}" 在副本里命中 0 处（判线 =1）——锚点对不上今天的产物`），
   重数之后三枚锚点改口（`Ae` → `Te`，见 6.8 最后一条），复跑 13/13 点燃。
5. `_site` 与 `assets/js/*.min.js` 都是 gitignore 的构建输出，提交面里只有源码、门禁脚本、计划与 spec。
6. **§7 那张字节表里有两行跟着这一刀升了档**（JSON 58,368 → 59,392、对比 33,792 → 34,816），
   台账与逐件账都在 `2026-09-25-blog-online-tools-design.md` §7 的 2026-10-03 那一格；**这不是"本期改了那四页工具的功能"，是本期产物变长之后
   `11c` 那条回算判据自己红的**，处置口径见 6.4 末段。

### 6.8 门禁台账（十三道，逐道退码 + 它自己打出来的那一句）

三遍跑完的，不是一遍：第一遍 06:40–06:45 过八道（`check-seo` 在负载 20.89 上等过 90 秒按房规**拒测**，
不算绿也不算红）；第二遍 06:50–06:58 补那五道，其中两道非绿；第三遍 07:05–07:12 只重跑那两道。
脚本 `/tmp/sp2-ab/{sweep.sh,sweep2.sh,sweep3.sh}`（一次性、不入库），每道各自过负载闸门，退码逐行落
`/tmp/sp2-ab/sweep*.summary`，`cmd >> log 2>&1; rc=$?` 现取——管道不吞退码。

| 道 | 命令 | 退码 | 它自己打出来的那一句（逐字） |
| --- | --- | --- | --- |
| 单测·共用层 | `node scripts/toolkit-tests.mjs` | 0 | `# tests 439 / # pass 439 / # fail 0`（`duration_ms 19167`） |
| 单测·地址栏纯函数 | `node scripts/tool-url-state-tests.mjs` | 0 | `# tests 12 / # pass 12 / # fail 0`（`U0-1`…`U0-12`） |
| 计划镜像 | `node scripts/verify-plan-blocks.mjs` | 0 | `✓ 全部已落地镜像与磁盘逐字节全等（未落地 0 节）`——76 个已落地镜像合计 1,653,388B |
| 计划镜像的牙 | `node scripts/verify-plan-blocks-teeth.mjs` | 0 | `41/41 通过`（末尾两行是「副本回到全绿」与「工作树脏指纹前后一致」） |
| 图标尺寸 | `ruby scripts/check-image-dims.rb "$PWD"` | 0 | `image-dims: ok（36/36 条断言，台账 20 对…）` |
| 图标尺寸的牙 | `node scripts/check-image-dims-teeth.mjs` | 0 | `牙齿台账：27/27 刀变异如期变红` + `每一刀都在临时副本上，工作树一字未动；复跑基线仍绿` |
| 收录面 | `node scripts/check-tools-surface.mjs --site=/tmp/sp2-ab/new/_site` | 0 | `✓ 收录面 4 条 ready 条目 × 6 组判据全绿（页面源/收录/导航/图标/DOM/地址栏名单）`，导航-全站核到 101 页 |
| 收录面的牙 | `node scripts/check-tools-surface-teeth.mjs` | 0 | `牙齿台账：79/79 组变异如期变红` + `全部变异已还原，复跑基线仍绿` |
| SEO | `node scripts/check-seo.mjs --root=… --site=…/_site` | 0 | `✓ SEO 门禁 10 组全绿…；JSON-LD 205 块全部可解析`（135 页 / 78 篇文章页 / 修订台账 45 条）·**第一遍拒测**（load 20.89） |
| SEO 的牙 | `node scripts/check-seo-teeth.mjs --root=… --site=…/_site` | 0 | `牙齿台账：137/137 组变异如期变红（用时 157.1s）`（分账：keywords 7 / modified 10 / JSON-LD 30 / ItemList 18 / manifest 24 / 接线 9 / head 7 / 相关工具 15 / 换源 9 / 分页门 2 / 语料 6） |
| 地址栏（浏览器） | `TU_SITE_DIR=…/new/_site node scripts/verify-tool-url.mjs` | 0 | `✓ 工具页地址栏验证：全绿（26 条）`——分组 U0 1 / U1 10 / U2 3 / U3 3 / U4 2 / U5 2 / U6 4 / U7 1 |
| 地址栏的牙 | `TU_SITE_DIR=/tmp/sp2-teeth/_site node scripts/verify-tool-url-teeth.mjs` | 2 → **0** | 第一遍 `✗ T6 …空刀："Ae()}finally{M()}}" 在副本里命中 0 处（判线 =1）——锚点对不上今天的产物`；重数锚点后 `✓ 地址栏牙齿：13/13 点燃`（十刀 + `S1`/`S2`/`S3` 三项自检） |
| 工具页（浏览器） | `TK_SITE_DIR=…/new/_site node scripts/verify-tools-browser.mjs` | 1 → **0** | 第一遍 `# 合计 115 项，红 1 项：11c`；两行档位升完之后 `# 合计 115 项，红 0 项（收轮时本机 1 分钟负载 8.2…）` |

**跑门的那棵树 = 提交的那棵树，这条是靠 md5 证的不是靠嘴**：读产物的四道（收录面 / SEO / 地址栏 / 工具页）
一律指 `/tmp/sp2-ab/new/_site`，那三本 min 产物与工作树逐字节同 md5（`toolkitCore.min.js=9596db40`、
`toolJson.min.js=e81d3afd`、`toolDiff.min.js=461c4609`，三枚都是 8 位前缀，与 `verify-tool-url.mjs`
自己打的「端点自证」那一行同一串），牙齿那一道的副本 `/tmp/sp2-teeth/_site` 也按同样三枚对过账。

**两道非绿的一行账**：

1. **地址栏牙齿退 2**。三枚锚点里写的是 `syncGate` 上一轮的局部名（`Ae`），Task 6 那刀（`CONTEXT_TIERS`）
   重建之后 terser 把它换成了 `Te`，`retune` 的 `finally` 那一处与 `reset` 那一段因此各差一个名字，
   第十刀与第六刀共用同一枚 `from`。改法只有「重数」这一条路：把 T6 / T7 / T10 的 `from` 换成
   `Te()}finally{M()}}`、`,Te(),M(),void T("bar","档位回到默认`，逐枚现数命中 =1 才落笔，
   并在 T6 上方留一行注释点名「`Te` = `syncGate()`、`M` = `syncUrl()`，是今天的局部名、不是稳定标识」。
   **退 2 而不是退 1 是对的**：这一格是量具哑了，不是产品坏了；`S1` 那条自检（空刀必须抛 `status=2`）
   正是为了让这种事永远出不了 ✓。
2. **工具页退 1 在 `11c`**。红的是 §7 那张表的档位对不上回算式（`11c` 判的是
   `budget ≥ ceil(最坏读数 / 0.95 / 1024) * 1024`，明细串里那句「台账写 58368B、余 2894B=5.0%」
   是打印值 round 到一位小数，实际 4.96%——判据拿的是档位，不是这串数）。处置见 6.4 末段与
   `2026-09-25-blog-online-tools-design.md` §7 那一格。**其余六行的件集一个字节都没动**：九件在 head 与 new 两棵树上 md5 一字不差
   （`assets/css/toolkit.min.css`、`assets/css/tool{Json,Diff}.min.css`、`tools/{json,diff,idcard,codec}.html`、
   `assets/js/tool{Idcard,Codec}.min.js`），本期动的只有那三本 JS bundle。那三行本来就挂着的
   「⚠低于5%」（证件 JS+CSS 4.6%、证件首屏 1.3%、编码 JS+CSS 3.6%）因此与本期无关，
   而升档之后 JSON 与对比那两行的 ⚠ 反而消掉了（6.7% / 7.3%）。

