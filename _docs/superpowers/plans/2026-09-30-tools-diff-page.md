# 文件对比页（`/tools/diff.html`）实现计划

> **For agentic workers：** REQUIRED SUB-SKILL：用 superpowers:subagent-driven-development（推荐）
> 或 superpowers:executing-plans 逐格执行本计划。步骤用 `- [ ]` 复选框语法跟踪。

**Goal：** 把设计文档 §5.6 那一页做成站内第四张工具页——**双输入的工作台，不是面板式**：两块粘贴框
（各自可选/拖入本地文件）、一条工具栏、结果区在「并排 / 行内」两种版式之间切；行级对齐自实现并给得出
最短性依据，改动行带 token 级行内高亮，未变行默认折叠成"省略 N 行"；另有一档 **JSON 感知模式**
（键顺序无关、按 JSON Pointer 报增/删/改/类型变）。全部本地计算、零网络、输入不出本机。

**Architecture：** 沿用段 2/3/4 已落地的四层——纯逻辑模块（`dev/js/tools/diff-core.js` 与 `diff-json.js`，
不碰 DOM、入参形状不对就抛）→ 纯字符串视图层（`diffView.js`，与 `view.js`/`codecView.js`/`jsonView.js`
同一条"零 import"红线）→ 页面装配层（`diffWorkbench.js`）+ 入口（`toolDiff.js`）。
**面板框架（`panel.js` / `panel-dom.js`）这一页一行都不用**（`layout: workbench`，无索引条）；
`window.Tk` 只取 `view` 与 `ui` 两格。**本段不复用 `json-core.js`**，理由与形状见 §0.4——它是构建层的硬约束。

**Tech Stack：** Jekyll 4 + Liquid、Vite 6（`getDevJsEntries()` 只扫 `dev/js/` 一层，子目录不成入口）、
Node 22 内置 test runner（`scripts/toolkit-tests.mjs`）、SCSS。**不新增 npm 依赖、不内置任何第三方件**；
本段唯一要动的构建配置是 `postcss.config.js` 的 `blacklistedSelector` 补一串 `.df-`（§0.5）。

**写本计划时（2026-09-30）的前置事实**：段 1–4 全部关闭（证件页 / 编码页 / JSON 页三页已收录可见），
`main` = `bc537b2`，本地领先 `refs/remotes/origin/master` **二十六条**（条数按
`git rev-list --count refs/remotes/origin/master..HEAD` 现读，不许手抄）；**未推**——2026-09-30 收口那一轮
收到的判定是「先不推，继续段 5」，推送改挂在段 5 收口之后单独请示。另一路会话此刻仍在同一个工作树上
有一批未提交改动（实读 `git status --porcelain` 到本格为止是 27 项，其中 16 格已在索引里，
含 `USAGE.md` `_config.yml` `_data/og_images.yml` `package.json` `dev/js/editorial.js`
`dev/sass/toolkit.scss` `scripts/article-check.mjs` `scripts/lib/post-meta.mjs` `scripts/wechat-draft.mjs`
`scripts/fixtures/article-check/*` `.baoyu-skills/*`，未跟踪的 `sw.js` `offline.html`
`scripts/check-sw*.mjs` `scripts/verify-sw-offline.mjs` `scripts/verify-motion-batch4.mjs`
`_docs/superpowers/specs/2026-09-28-sw-offline-design.md`）——**本段每一格的暂存动作都要先重新
`git status`**，处置照 §0.7。

---

## 0. 本段的口径与决策（执行期不再重新问）

### 0.1 详写的节奏：与段 3/段 4 同一份"契约先写、代码随后"

段 2 的实测教训（计划里写死实现 → 两轮评审改掉 → 4,000 多行镜像全靠 `--fix` 回同步）在段 3、段 4 已被
验证过两次，本段照旧：

- **现在就定死**（写错代价最大、且两格会互相不一致）：文件清单与职责、每一层的对外签名
  （函数名、参数名、返回字段名、枚举取值）、判据编号与它咬的那一件事、门禁改哪一处、提交边界。
- **执行期写、写完 `--fix` 同步进计划**：函数体、表数据、SCSS 规则、页面 Liquid、以及那些写成 `'…'`
  的中文口径文案。磁盘是权威，`verify-plan-blocks.mjs --fix` 整块重写是唯一正当姿势
  （它按"与磁盘内容的最长公共前缀"定位候选块，所以本计划每块镜像的**头几行必须就是将来落盘的头几行**——
  这是形状要求，不是修辞）。

每格 Step 顺序固定：**写判据（红）→ 写实现（绿）→ 登记镜像 → `--fix` 同步 → 六道门禁 → 提交**。
一格一次提交，计划与代码同批。

### 0.2 复用面（全部带 `文件:行号` 或复算命令，写本计划时在 `bc537b2` 上实读）

| 现有件 | 对比页怎么用 | 证据与理由 |
| --- | --- | --- |
| `dev/js/tools/panel.js` / `panel-dom.js` | **不用** | 它们要求的骨架是 `{p}-tablist` / `{p}-tab-*` / `{p}-panel-*`（`panel-dom.js` 的 `mount()` 里"没有索引条就不算一块工作区"当场抛）。这一页与 JSON 页同属 `layout: workbench` |
| `dev/js/toolkitCore.js` → `window.Tk` | 只取 `Tk.view`（`esc` 等）与 `Tk.ui`（`copyInto` / `flash` / `legacyCopy`） | 它挂的四只（`toolkitCore.js:32`）。**本段不许往 `window.Tk` 上加第五只，也不许把 `json-core.js` 挂上去**——那是 §0.4 那条红线的另一种踩法 |
| `dev/sass/toolkit.scss` | 白拿 `.tk-content` `.tk-compliance` `.tk-btn` `.tk-outwrap` `.tk-out` `.tk-mono` `.tk-table` `.tk-state*` 与 ≤900/≤640 两组退档 | 文件头就写着三页共用这一层。**本段一行都不改它**（§0.5），本页独有的形状全部进 `dev/sass/toolDiff.scss` |
| `dev/js/tools/json-tree.js` 的增量渲染控制器 | **不 import**，照它的形状在 `diffView.js` / `diffWorkbench.js` 里另写一份"只画看得见的行" | 同 §0.4：`json-tree.js` 已被 `toolJson.js` 那一个入口 reach，第二本入口再 reach 它就是共享 chunk。判"能不能复用"的依据是**谁 import 它**，不是它写得好不好 |
| `_data/onlineTools.yml` 的五个消费点 | 追加一条 `slug: diff` 即全站跟着长一页 | `sitemap.xml` / `llms.txt` / `index-all.html` / `_includes/header.html` / `tools.html` 全是 `where: 'status','ready'` 的数据驱动循环（段 3 Task 7 已把这条事实回写进 spec §4.4） |
| `scripts/check-tools-surface.mjs` | **两处都要动**（§0.3） | 第四页第一次让 `layout: workbench` 那一支长出**两种不同的栏位**（A/B 两栏都有结果区，而工具栏那一格什么都不长）——这恰好拆穿了脚本里那句写死的"工作台 = out/status/tree/copy 四格" |
| `scripts/verify-tools-browser.mjs` | Task 7 加两行 `BUDGET_ROWS`（先量后立） | `:1538-1543` 现在六行三页，口径与件集逐行写死 |
| `scripts/toolkit-tests.mjs` | 末尾追加 §X / §Y / §Z 三节 | 分节标记的正则是 `SEG_MARK = /^\/\/ ── §([B-Z]\d*) /`（`verify-plan-blocks.mjs:224`）——**两位字母的节名（§AA）它认不出来**，会被吞进前一节的尾巴，所以本段只用 §X/§Y/§Z 三节，第四节不另起（§W 的先例：一个节里先放 vendored 判据、再放模块判据，"节名不另起"） |

### 0.3 两处必须拆开的地基（本段真正的技术债清算）

**(a) `check-tools-surface.mjs:610` 那串写死的四格。** 实读：

```text
if (layout === 'workbench') {
  for (const fam of ['out', 'status', 'tree', 'copy']) need.push(`${p}-${fam}-${slug}-${side}`);
```

它把"工作台式那一支的产出区地址"写成了**四格固定清单**，而那四格是 JSON 页的形状（文本结果 / 状态读数 /
树容器 / 复制按钮）。对比页有 `out`、`status`、`copy` 三格，**没有 `tree`**——按现行判据，第四页一登记就红在
"产物里缺少 `df-tree-diff-a`"，红在它压根不该有的东西上。这与段 3 §0.3 那颗牙（无条件 `import` 证件页的
`WORKBENCH_SPEC` 去比每一条 ready 条目）是**同一种病的第二个实例**：把第一页的清单当成了这一族的清单。

处置：把清单从"写死"改成"按条目声明"——栏位配置新增一格 `nodes`（数组，选读）：

- `nodes` 缺席 → 退到 `DEFAULT_NODE_FAMILIES = ['out', 'status', 'tree', 'copy']`。**这一条让已上线两页
  一行代码都不必改**（证件/编码那两页根本不走这一支；JSON 页 `sides.main` 没有 `nodes`，
  拿到的正是它今天的那四格），也让"漏写 `nodes`"的红落在**新页**而不是落在存量页。
- `nodes` 写了就按它要：对比页 `sides.a/b` 各声明 `nodes: ['out', 'status', 'copy']`，
  `sides.bar` 声明 `nodes: []`（工具栏那一栏不产这四族的地址）。取值档只许这四个词，
  拼错（`cop`、`Tee`）当场判红并点名是哪一栏——**不给静默**，理由与段 4 §0.3 那句"`workbench` 拼错一个字母
  就悄悄退回面板支"完全同一条：这一格拼错的下场是"门禁不再核那一格，而页面上它真的存在"。
- 顺带把 `:623` 那条孤儿判据（`{p}-(in|when|btn)-*` 里多出来的算红）扩到节点族：
  产物里出现 `df-{out|status|tree|copy}-<slug>-<side>` 而 `need` 里没有的，同样算私长的一格。
  **只对声明了 `nodes` 的条目生效**，不给存量两页加判据（同一句理由：红在它们压根没犯过的错上）。

牙齿（Task 5 落进 `check-tools-surface-teeth.mjs`，三刀）：T-a 把 diff 条目 `sides.a.nodes` 里的 `copy`
删掉 → 必须红在"缺少 `df-copy-diff-a`"；T-b 把它改成 `cop` → 必须红在取值档而不是安静通过；
T-c 在骨架里私自多写一枚 `id="df-tree-diff-a"` 而 `nodes` 里没有 `tree` → 必须红在孤儿那一刀。
**并且**：把 `DEFAULT_NODE_FAMILIES` 改成三格（去掉 `tree`）→ JSON 页那一格必须红，证明"缺省那一档"
不是装饰（这是"收紧守卫判据须自证仍有牙"那条纪律在本段的落点）。

**(b) 第四页会让**每一页**的 HTML 长一个 `<a>`。** 段 2 Task 9 实测登记一次 = 证件页 +111B gzip、
首页 +154B；段 3 登记 codec 那一次把证件页首屏余量压到 4.4%，M29 之后是 3.3%，JSON 页登记之后是
**463B = 2.8%**（§7 最后那一格，全表最薄）。所以本段 Task 7 那一次重量**不是只量新页两行，
而是四页首屏 + 三页总量一起重算**，量完才允许宣布收口。这一格与 2026-09-30 收到的那条判定
（索引条那 10 枚死锚点"暂不动，随段 5 或收尾一起判"）用的是同一把尺——**先重量，重量之后才有资格谈修不修**：

- 若重量之后证件页首屏余量仍 ≥ 300B，则死锚点那一格**继续挂着**，交回人判（不擅自修，因为它两个修法
  都要动交互或动 §7 最小那一格）；
- 若余量掉到 300B 以下或转负，本格按 BLOCKED 协议**停下来交回**，并附"登记第四页这一笔的 A/B 实测差额"
  与"三种处置（抬预算 / 收下拉那一族的文案 / 把 tagline 从下拉里摘掉）各自的字节账"。

### 0.4 不复用 `json-core.js`：这是构建层的硬约束，不是审美

§5.6 把这件事写在规格里，这里给可复算的版本：

1. `dev/js/tools/json-core.js` 今天的唯一 reach 者是 `dev/js/tools/jsonWorkbench.js:41-44`，
   而 `jsonWorkbench.js` 只被 `dev/js/toolJson.js` 那一个入口 reach（复算
   `grep -rln "json-core" dev/js/`）。**两个入口同时 import 同一本模块 → Rollup 切成带 `import{` 的
   共享 chunk，`iifeWrapPlugin` 包完就是整页 SyntaxError 而构建 exit=0**（`dev/js/toolkitCore.js:5-9`
   记的正是这个坑，判据在门禁④）。
2. 两条出路：把 `json-core` 挂进 `window.Tk`（= 让已上线**四页**各自的 §7 总量格一起重算，
   并且 `toolJson.js` 要改成不直接 import、走 `Tk`，那是给存量页动手术）；或者在 `diff-json.js` 里
   自带一份 JSON 读侧（只涨这一页）。**选后者**，代价与补偿同一条：§Y 第一条判据拿同一批样本
   同时喂两本解析器，要求"合法/非法、非法时的行列、解出的值"三件同结论——先例是 §B 的
   "与站内旧库对拍"，**两个独立实现同结论才算过**，不是"复制一份就完事"。
3. 两份实现必须共享的只有**口径**，不是代码：深度闸门 `MAX_DEPTH`（`json-core.js:56` = 1000）
   与 Pointer 转义（`~` → `~0`、`/` → `~1`）各由一条判据钉"两本里的数/串相同"，
   改一处不改另一处会红——这是"同一份事实不写第二遍"在无法复用时的替代做法。

### 0.5 不动的东西（列出来是为了让"顺手也改一下"这件事在门禁里可见）

`dev/sass/toolkit.scss`（另一路会话此刻正占着它，工作树 `MM`）、`dev/js/toolkitCore.js`、
`dev/js/tools/{panel,panel-dom,view,ui}.js`、`dev/js/tools/json-*.js`、三页的页面源与装配层、
`vite.config.js`、`_config.yml`、`package.json`、`pnpm-lock.yaml`。
**唯一动的构建配置**：`postcss.config.js` 的 `blacklistedSelector` 加一串 `'.df-'`（`:88-89` 那两串旁边）——
不加的话本页所有 px 会被按 750 设计稿放大成 vw，那段配置自己的注释写着后果是
"同一块版面一半按 px、一半按 750 设计稿放大"。踩过的坑记在项目记忆里：
**watch 中的 vite 会缓存 `postcss.config.js`**，改完要么重启 `pnpm dev`，要么碰一次
`dev/sass/toolDiff.scss` 触发重算；本段所有体积测量都走 `npx vite build`（非 watch），不受这条影响，
但**Task 7 之前必须确认磁盘上的 `toolDiff.min.css` 是改配置之后构建的**（判据：产物里 `df-` 那族的
长度值不得出现 `vw`，§8.2 第 5 条同一条尺）。

### 0.6 与规格文档的偏差登记（执行期若再改道，追加到这里，不许只改代码）

| 规格那句 | 落地改成 | 为什么 |
| --- | --- | --- |
| §5.6「行内细化：token 级（词 / 标点 / 空白串三类）」 | token 规则钉成四条正则序：空白串 → ASCII 词 `\h`… 见 §1.3 的 `TOKENIZE` 那一格 | "词"这个字在中文里没有对应物：按 `\w+` 切会把一整句中文切成一个 token，行内高亮退化成整行。落地口径与非 ASCII 的处理必须写死，§X 才咬得住 |
| §5.6「与 git diff 的读法一致」 | `@@` 那一行的单行区间**不省略 `,1`** | 省略是 git 的排版偏好，不是格式的必要部分；本站自证的判据是逐字符对照，写死"不省略"比"与 git 一致"更可核。页面上那句说明跟着写清 |
| §5.6「不给"仍然按文本比较"的开关」（二进制拒读） | 照做，且**不给开关** | 多一个状态就多一档没人测过的界面，而那一档的产物本来就没人能用 |
| §1.1「`MAX_COST = 20000`」 | **`2000`** | 20000 那一档按实测曲线外推是**几十秒**的一次对齐（下面第 1 条复算块），一次粘贴锁死主线程半分钟；2000 把闸门线上最坏一次压在桌面 0.7s 内。它不是"能对比多少行"——行数那一档归 `gate()` 的 `MAX_INPUT_LINES` 管 |
| §1.1 里没有"行内细化**总量**"这一格 | **新增 `MAX_INLINE_WORK = 3000000`**（单位＝对齐格子数） | 契约只给了单对形状闸门 `MAX_INLINE_TOKENS`，而那一本真正的账单是 `Σ 每对的格子数`：一万对各自很小的行对，单对闸门一格都不拦。写这一格之前页面在 10k 行全改写那种输入上走 857ms，之后 126ms（同块第 2 条复算） |
| §1.1「`MAX_INLINE_TOKENS`（越线那一对退化）」 | 同一格、同一个数，但**口径改成本**：它管的是**形状**（那一行往 DOM 里塞四千枚 `<span>` 读不出任何东西），时间归 `MAX_INLINE_WORK` | 两处文档原本都把它当时间闸门写；两档各判各的之后，`gate` 那一族才有三个互不重叠的旋钮：字节/行数（能不能比）、格子（比多久）、token 数（画不画得下） |
| §1.1 `diffSeq(a, b, equals, maxCost)` | `diffSeq(a, b, equals, maxCost = MAX_COST, keyOf = (v) => v)` | 下面那条 `matchCap` 快判要按值取键；不给 `keyOf` 就是行级假设"值即键"、token 级另发明一份——两份判等出口是口径 1 唯一真正怕的东西 |
| §1.1「`maxCost` 越线返回降级形状」 | 越线由 Myers **跑到那一圈才发现**改成：**每个盒子先算多重集下界**（`matchCap`），下界已 ≥ 上限就直接给降级块、不进算法 | 原写法在"两侧各两万行、真差异只有五十行但散布全篇"那种形状上会把 `D²` 先走完、再宣布"其实给你按块"——最贵的一种白等。快判之后那一档是 O(n)，代价是多一份键序列（两侧都长过 64 才建） |
| §1.1 `DiffResult` 字段表 | 落地多三格：`segments`、`inlineByKey`、`blocked`；且 `verdict:'blocked'` 那一档**也带** `inlineByKey: new Map()` | `segments` 是行级对齐的不可变产物（`hunksOf` 与 `unifiedText` 都从它读配对，不再各自二次配对）；`inlineByKey` 由 `diffLines` 一次算完，视图层不重算。`blocked` 那一格少一个键，视图层那句无条件的 `inlineByKey.size` 就在**最不该出错**的那条路径上炸——与 `emptyStats()` 同一个道理：形状相同、值全空 |
| §1.1 `hunksOf` 返回 `{aFrom,aTo,bFrom,bTo,skipped,rows}` | 多 `tailSkipped`，并钉死区间**左闭右开**、第一块 `skipped` 恒 0 | 尾巴那一格不写进契约，视图层就得自己判断"末块之后还有没有行"——正是证件页 §P 那族数错过一次的形状 |
| §1.1「`unifiedText(result, names)`」 | `unifiedText(result, {a, b, context} = {})` | 上下文档必须跟页面折叠档同源；只给两名会逼调用方自己再传一次 `context`，而那一格一旦各传各的，"复制出来的东西和看到的不一样"就没有判据拦得住 |
| §1.1 `tokenize`（"其余逐码点"） | 四条 **sticky 正则按序匹配 + 每侧带 limit**，越线时 `tokensForPair` 返回 `null`（不是抛、不是切完再判） | `split` / `matchAll` 都得先把整行切成数组才知道超没超线，limit 只在 sticky 那一版上是**真实上界**；`MAX_INLINE_WORK` 第一笔记的就是这个上界，按"这一行有多长"记会让预算形同虚设 |
| §X 判据表 28 行 | 落 **29** 行（多出的是 X29） | 上一行那条 first-fit（"装不下就跳过这一对、继续看下一对"）在 28 行表里**没有对应判据**：把它写成"遇到一对超预算就把后面全掐"，28 行全绿。变异试验真做了这一刀——只有 X29 红。表里已补这一行 |
| §1.2「`readJson(text)` 的失败形状 `{ok:false,kind,line,column,reason}`」 | 照做，并把与 `json-core.parseJson` 的**三处分歧**写进文件头：不回 `index`/`length`/`snippet`、不回 `duplicateKeys`、不带字节闸门 | 契约本来就没给那三格——`index`/`snippet` 是 JSON 页"把病灶高亮进输入框"那档交互专用的，对比页的坏输入是一句点名行列的话；`duplicateKeys` 那一格是 `CORE_NOTES.dupKey` 的活，两页各报一份就有机会分叉；字节闸门只在 `diff-core.js` 有一份，Y16 钉"闸门排在读之前" |
| §1.2 的 `aType` / `bType` 只写了六档类型名 | 加第七档 **`absent`**，缺席那一侧的 `aPreview`/`bPreview` 给 **`null`** | 契约写了"某一侧没有这一格时怎么记"却没写**用什么值表示**。不给显式档，视图层只能靠 `aPreview === null` 猜，而 `null` 本身是合法 JSON 值——`{"a":null}` 在场时它的紧凑串正是 `"null"`，那种猜法会把"在场且为 null"读成"缺席"（Y4/Y9 把两档分开钉住） |
| §1.2「数字按值判」 | 落地＝`===`：`1`/`1.0`/`1e0` 同值，**`-0` 与 `0` 判 `same`** | 按字面判会把"只是被格式化器换过的文件"报成满屏改动；`-0` 在 JSON 里不是一个可区分的数据值（`JSON.stringify(-0)` 给 `0`），拿它造一档"变了"是本站自己发明的差异 |
| §Y 判据表 Y1 那句"样本集 = §S 那 20 个坏样本 + 一组好样本" | 落 **34 坏 + 24 好**，且 `bad.length === 34` 钉成硬断言、末尾再加一条"八档 `kind` 必须全被踩到"的自检 | §S 那 20 格只踩到八档里的六档，缺 `unterminated-string` 与 `trailing`；少一格就是那一片分支从此**静默不核**。补的那 14 格里 `'"x"'` 最初是个假样本——**它是合法 JSON**（一个字符串就是合法文档），换成 `'{"a":1}}'` 才真走 `trailing` |
| §Y 判据表 Y18 那句"且 `renderJsonTable` 的产出里逐句出现" | 本格只落**第一半**（六句非空、各带自己那个数、不许留占位），"上页面"那一半交给 §Z（Task 4 第 9 条） | `renderJsonTable` 到 Task 4 才存在，这一格现在断它只能靠桩——判据名与这张表上都留了"由 §Z 接"的字样，不许读的人以为 Y18 已经全了 |
| 测试文件头部那张"用例分布"表（`§A` 那一段的第二现场） | 补 §X / §Y 两行、合计 `363` → **`410`** | `363` 是段 4 收口之后没人再对过的旧数，本次是第一次真去对它的账。那张表长在磁盘 §A 里，所以 `--fix` 把**段 1 那份计划**的 §A 镜像整块换成磁盘内容（`6522 → 6526 行`）——本提交因此多带一份段 1 计划的改动；按 §0.7 的暂存口径，那一格只碰 §A 那一个块，另一路会话压在索引上的 16 格与工作树文件一件未动 |
| Task 2 那节的 §X 镜像小标题"到文件末尾" | 改成"到本节末" | §Y 的 `// ── §Y` 标记把磁盘上的 §X 截短了：作废的只是"读到哪儿"那个说法，§X 那一段字节未动、门禁② 照样 `OK`。分节按标记切、不按行号切（`verify-plan-blocks.mjs:37-39`） |

（本表是空的才算正常；每加一行就要在 §5.6 或 §8.1 里回写一次，段 4 那份计划的 §0.6 是同一族先例。）

**Task 9 那一格的欠账（本格不许顺手改 spec）**：spec §7「输入硬上限」那一行写的是"另**两档**是这一页独有的
算法代价闸门（`MAX_COST` 与 `MAX_INLINE_TOKENS`）"——现在那一族是**三档**，多出来的是 `MAX_INLINE_WORK`。
本格不动 spec：它的工作树此刻与 HEAD 一字不差、而索引里压着另一路会话的 `0/17` 那一格（§0.7 第 3 条），
改在它上面等于替那一格落地。**与段 4 同一处置**：Task 9 对账收口那一次把这一行改成现行值，
连同 `grep -n "^export const MAX_" dev/js/tools/diff-core.js` 的复算一起写（段 4 Task 9 的
"spec §7 常量对现行值"就是同一件事的先例）。

**上面两格里那些数的复算**（Node 22 单线程，本机 `load average` 5.4；两份读数是同一次会话里先跑曲线、
再跑 A/B，输入构造逐字钉在下面，不复现就别引用它）：

```text
// ① MAX_COST 那一条曲线：两侧各 n=20000 行 `l0…l19999`，每 step = 2n/D 行换掉一行
//    （换一行 = 一删一增，所以 cost 正好是 D），maxCost 给 1e9 不夹（`1e9` 是整数，Infinity 会被
//    X26 那一判钉的入参闸门拒掉——这条本身也是那道闸门的副作用）。
const N = 20000;
for (const D of [1000, 2000, 2500, 4000, 5000]) {
  const step = Math.max(1, Math.round((2 * N) / D));
  const a = []; const b = [];
  for (let i = 0; i < N; i++) { a.push(`l${i}`); b.push(i % step === 0 ? `x${i}` : `l${i}`); }
  const t0 = performance.now();
  const r = diffSeq(a, b, (x, y) => x === y, 1e9);   // r.cost 必须正好等于 D，否则构造不对
  console.log(D, r.cost, `${(performance.now() - t0).toFixed(0)}ms`);
}
// 实测：D=1000 → 284ms ／ 2000 → 649ms ／ 2500 → 910ms ／ 4000 → 2100ms ／ 5000 → 3720ms
// 5 倍的 D 换 13 倍的时间（涨法介于 D^1.6 与 D² 之间）；把格子数按 4·cost² 折算，每格 30–70ns。
// 二次模型外推 D=20000 给 100×649ms ≈ 65s，按实测涨法也在 40s 开外——契约那一档就是这么降下来的。

// ② MAX_INLINE_WORK 的 A/B：真常数那份 vs 只把这一格换成 Infinity 的一份**副本**（不改磁盘原件，
//    副本用 `src.replace('export const MAX_INLINE_WORK = 3000000;', …)` 生成，替换未命中就退出）。
//    构造：两侧各 10000 行、每行 8 个 ASCII 词、两侧逐词全不同 ⇒ 每个行对都要做行内细化。
const mk = (tag) => Array.from({ length: 10000 }, (_, i) =>
  Array.from({ length: 8 }, (_, k) => `${tag}${i}_${k}`).join(' ')).join('\n') + '\n';
const r = mod.diffLines(mk('a'), mk('b'), {});       // 各跑两遍，取 JIT 落定后的第二遍
// 实测：带预算 126ms（stats.inlineSkipped=9191）／拆掉预算 857ms（跳过 0）＝ 6.8×
//       两份的 cost 都是 20000、degraded 都是 true ⇒ 差的只有行内那一步，行级对齐一字未变。
```

**这一格里还有一件"只有间接证据"的事，写下来免得下一个读者以为它被钉死了**：口径 2 的公共前后缀裁剪
（`diffLines` 与 `inlineWorkOf` 都裁）在 §X 里没有、也**没法**有直接判据——它不改变任何对外可见的形状：
`ops` 最短由 X4 的对拍钉（裁不裁都最短），行号与原文由 X6 钉，性能收益只有上面那条 ② 的 A/B 曲线量得到。
所以它是**性能路径**而不是**契约**，判据表里没有对应行；真要把"裁了"这件事钉成判据，只能钉
`inlineWorkOf` 那一格的预算记账（X29 咬的正是它的账单），而不是去断言内部循环走了哪条支路。


### 0.7 Git 与并发会话（本段每一格的暂存动作）

规则与段 4 完全一致，只列要点（全文见 spec §9）：

1. **不裸 `git add -A` / `git add .`**，只用 pathspec 提交自己碰的文件。
2. 另一路会话在同一个工作树上持续提交。**每一格用 plumbing 出提交**：临时 `GIT_INDEX_FILE` +
   `read-tree HEAD` + `hash-object -w` + `update-index --cacheinfo` + `write-tree` + `commit-tree -F` +
   `update-ref refs/heads/main <新> <旧>` 的 CAS（`<旧>` 写死完整 sha，不符就 abort），
   跑完再把真索引里我那几格对齐回去，**保证对方的 16 格暂存一格不少**。
3. 提交前逐格自证：`git diff --cached --numstat` 里对方那些格的形状**与上一格记录相同**
   （spec 那一格必须是 `0/17`——那是对方的删除暂存，本格不能替它落地）。
4. **`USAGE.md` 本段不提交**：它同时是"对方的暂存"（`1/76`）与"我 Task 7 那一次的计数改动"（工作树
   `+7/−3`），先等对方那格落进 HEAD，再由段 5 收口那一格单独处理。
5. 全程**不 push**（§0 前置事实那条判定）。

### 0.8 六道门禁（每格跑完再提交，收口那一格全量重跑）

| # | 命令 | 通过读数 |
| --- | --- | --- |
| ① | `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs` | `# pass` 从 363 涨到本段三族的条数之和、`# fail 0`、`# cancelled 0`。**`load average` 高时这条会因 20s `testTimeout` 假红**（段 4 Task 9 撞过一次：158→324→500），红了先 `uptime` 再单跑那一判自证，不许改判据也不许并进绿 |
| ② | `node scripts/verify-plan-blocks.mjs` | 全等且 `⚠ 未落地 0 节`；镜像块数随本段新增文件增长（`--fix` 之后必须再跑一次裸命令） |
| ③ | `node scripts/verify-plan-blocks-teeth.mjs` | 它在自己那份 mkdtemp 副本上跑，条数在段 4 的 35 项之上随本段新增项增长；跑完自证工作树未脏（脏项计数 + diff 指纹） |
| ④ | 两份 `git archive HEAD` 导出树 + 两次真 `npx vite build` + 三列字节表 | 构建 exit=0；`assets/js/*.min.js` 里 `import{` 命中 **0**（§0.4 那条红线的自动版）；字节表逐件列 L6/L9 |
| ⑤ | `node scripts/check-tools-surface.mjs` | 读 `ROOT/_site`；四页各一组全绿，`layout` 分派对 `nodes` 生效 |
| ⑥ | `node scripts/check-tools-surface-teeth.mjs` | §0.3 那三刀 + 缺省档那一刀全部点燃，退出码 0 |

### 0.9 提交边界（一格一提交，名字先定死）

Task 1 `docs(specs,plans)` 立规格与本计划 · Task 2 `feat(tools)` `diff-core` + §X ·
Task 3 `feat(tools)` `diff-json` + §Y · Task 4 `feat(tools)` `diffView` + §Z 前半 ·
Task 5 `feat(tools)` `diffWorkbench` + `toolDiff` + §Z 后半 + 门禁两处 · Task 6 `feat(tools)` 页面源 +
`toolDiff.scss` + 图标 + yml 登记 · Task 7 `test(tools)` 浏览器核验 + §7 两行先量后立 + 四页首屏重量 ·
Task 8 `test(tools)` teeth 补刀 + 六道门禁全量 · Task 9 `docs(tools)` 对账收口。

---

## 1. 契约（执行期照这个名字写，改了要同时改判据表与本节）

### 1.1 `dev/js/tools/diff-core.js`（纯逻辑，零 DOM，不 import 任何本仓库模块）

> **本节是写代码之前的契约**：签名与字段名以它为准（§X 的判据就是照这些名字写的），
> 但执行期在磁盘上改道的那些地方**一律登记在 §0.6**，不回头修本节——
> 现行真相看本节下面那两块"落地镜像"（门禁二逐字节核的就是它们）。

```text
// ── 闸门（§7 那一行的四个数，全部按侧判）
export const MAX_INPUT_BYTES = 5242880;   // 每侧 5 MiB，与 JSON 页同一把 UTF-8 尺
export const MAX_INPUT_LINES = 200000;    // 每侧 20 万行
export const MAX_COST = 20000;            // 行级 Myers 的编辑距离上限，越线降级
export const MAX_INLINE_TOKENS = 4000;    // 单对行的 token 上限，越线那一对退化
export const DEFAULT_CONTEXT = 3;         // 折叠时每个差异块保留的上下文行数
export const CR_GLYPH = '␍';              // CRLF 那一档在界面上的形状

/** 拆行：只认 `\n`，行尾那个 `\r` 剥出来记进 `ends`，行内容里剩下的 `\r` 不算断行 */
export function splitLines(text) → { lines: string[], crlf: boolean[], finalNewline: boolean, bytes: number, count: number }

/** 归一化后的比较键：只用于判等，展示与行号永远用原文（§X 有一条专门钉这一句） */
export function compareKey(line, opts) → string

/** 通用序列对齐引擎，行级与 token 级共用；`equals` 由调用方给，`maxCost` 越线返回降级形状 */
export function diffSeq(a, b, equals, maxCost) → { ops: Op[], cost: number, degraded: boolean }

/** 输入闸门：按侧各判一次，`which` 说清是 a / b / both，并给超出的差额 */
export function gate(textA, textB) → { ok: true } | { ok: false, which, reason, over: { bytesA, bytesB, linesA, linesB } }

/** 这一页的主入口 */
export function diffLines(textA, textB, opts) → DiffResult
//   DiffResult = {
//     a: Side, b: Side,                       // Side = { count, bytes, lines, crlf, finalNewline }
//     ops: Op[],                              // Op = { op: 'equal'|'del'|'ins', a, aLen, b, bLen }
//     stats: { added, removed, changed, unchanged, blocks, inlineSkipped, ignored },
//     cost, degraded, opts: 生效的那份（逐字段规范化后的值）,
//     verdict: 'same' | 'diff' | 'blocked',
//   }

/** 行内细化：对一对行做 token 级对齐，产出给两栏各自着色的片段串 */
export function inlineDiff(lineA, lineB, opts) → [{ t: 'equal'|'del'|'ins', text }]

/** 折叠成显示用的块；context=Infinity 就是全展开 */
export function hunksOf(result, context) → [{ aFrom, aTo, bFrom, bTo, skipped, rows: Row[] }]
//   Row = { kind: 'equal'|'del'|'ins'|'change', a: number|null, b: number|null,
//           textA, textB, inline: [{t,text}]|null, crlfA: boolean, crlfB: boolean }

/** unified 形状的差异文本（`--- ` / `+++ ` / `@@ -a,b +c,d @@`），复制与下载走同一串 */
export function unifiedText(result, names) → string

/** 面板上那六句人话：每句都有判据钉"非空且原样出现在渲染结果里" */
export const DIFF_NOTES = {
  degraded: '…',        // 降级这一档给的是更长的脚本，不是少了行
  inlineSkipped: '…',   // 哪些行对退化成整行着色
  ignored: '…',         // 勾了忽略空白/大小写之后，"相同"这个结论是被归一化过的
  gitApply: '…',        // 不承诺能被 git apply 接住
  noUpload: '…',        // 文件在浏览器里读，输入不出本机
  finalNewline: '…',    // 末行缺换行符那一档
};
```

**`Op` 的顺序与不变式**（§X 直接钉这几条，不靠注释）：`ops` 按文档顺序、无重叠、
`equal` 两侧等长；`ops` 里所有 `a + aLen` 的并覆盖 `[0, a.count)`，`b` 侧同理。

**token 规则（§0.6 第一行说的那四条，写死在这个顺序上）**：① 连续空白（含制表）② ASCII 词
`[A-Za-z0-9_]+` ③ 数字段紧跟在词之后不另切 ④ 其余**逐码点**（CJK 一个字一个 token、emoji 的代理对
按扩展图素群切到码元级即可，但**不得切出孤立代理项**——§X 有一条拿四个 emoji 样本钉这件事）。

### 1.2 `dev/js/tools/diff-json.js`（JSON 感知，零 DOM，自带读侧）

```text
export const MAX_DEPTH = 1000;          // 与 json-core.js:56 同一档，由 §Y 钉"两本里的数相同"
export const MAX_CHANGES = 5000;        // 变更格数上限，越线 truncated 并说明
export const PREVIEW_CHARS = 120;       // 前后值的紧凑串长度，切了带省略号

/** 自带的一份 JSON 读侧：返回 {ok:true,value} 或 {ok:false,kind,line,column,reason} */
export function readJson(text) → …

/** 与 json-core 的 pointer 逐字符同规则的转义（`~`→`~0`、`/`→`~1`） */
export function pointerOf(path) → string

/** 主入口：两侧都合法才比；坏的那一侧点名给行列 */
export function diffJson(textA, textB) → {
  verdict: 'same' | 'same-key-order' | 'diff' | 'invalid',
  changes: [{ pointer, kind: 'add'|'remove'|'change'|'type', owner: 'only-a'|'only-b'|'both',
              aPreview, bPreview, aType, bType, depth }],
  stats: { add, remove, change, type, compared, depth },
  truncated: boolean,
  error: null | { which: 'a'|'b'|'both', line, column, reason },
}

export const DIFF_JSON_NOTES = { keyOrder: '…', arrayMove: '…', typeChange: '…', truncated: '…',
  depth: '…', previewCut: '…' };
```

`verdict` 那一档 `same-key-order` 是 §5.6 明写的：只有键顺序不同时报"按 JSON 值判为相同"，
不许直接报"完全相同"——那是这一页最容易说谎的一处。

### 1.3 `dev/js/tools/diffView.js`（纯字符串，零 import，`esc` 由 `env` 注入）

```text
export function createDiffView(env) → { renderSide, renderInline, renderFoldBar, renderStats,
                                        renderJsonTable, renderNotice, renderVerdict }
```
所有产出必须是**已经过 `env.esc` 的 HTML 串**；本文件源码里 `innerHTML` 出现 **0** 次，
`document` / `window` 出现 **0** 次（§Z 的源码扫）。行的 class 前缀从 `env.prefix` 派生，
不许手打 `df-` 字面量（同 §W10 那条口径：数的是整格字面量，三种引号都算）。

### 1.4 `dev/js/tools/diffWorkbench.js`（装配层）与 `dev/js/toolDiff.js`（入口）

```text
export const DIFF_PANEL_IDS = ['workbench'];
export const DIFF_SPEC = {
  workbench: { sides: {
    a:   { kind: 'workbench', nodes: ['out', 'status', 'copy'],
           controls: [{ id: 'text', type: 'area' }, { id: 'file', type: 'file' }, { id: 'name', type: 'text' }] },
    b:   { kind: 'workbench', nodes: ['out', 'status', 'copy'],
           controls: [{ id: 'text', type: 'area' }, { id: 'file', type: 'file' }, { id: 'name', type: 'text' }] },
    bar: { kind: 'workbench', nodes: [],
           controls: [ { id: 'mode',  type: 'select', options: ['text', 'json'] },
                       { id: 'layout', type: 'select', options: ['side', 'inline'] },
                       { id: 'ws', type: 'checkbox' }, { id: 'case', type: 'checkbox' },
                       { id: 'context', type: 'select', options: ['3', '5', 'all'] } ],
           switch: { by: 'mode', targets: [{ key: 'text', when: ['text'] }, { key: 'json', when: ['json'] }] } },
  } },
};
export const DIFF_ACTIONS = [ /* 14 枚：compare / swap / clear / copyDiff / download / copyA / copyB /
  expand / fold / toA / toB / fileA / fileB / reset 一类的最终名单在 Task 5 定死后写进这里 */ ];
export function createDiffWorkbench(env) → { mount() }
```

三条与 §W 同源的红线，§Z 逐条咬：**视图层零 import**；**环境只在入口**（`FileReader` / `File` /
`Date.now(` / `localStorage` / `window` / `getComputedStyle` / `querySelector` / `setTimeout(` /
`URL.` / `navigator.` 在装配层源码里各 0 次——本页**不做**"记住上次输入"，所以 `localStorage`
那一只连入口都不该出现，判据数的是**全页 0 命中**）；**id 只由 spec 派生**。

---

## Task 1：立规格 + 本计划（文档格，零代码）

**Files：** Modify `_docs/superpowers/specs/2026-09-25-blog-online-tools-design.md`
（§4.1 第四行、§5.6 整节、§6.1/§6.2、§7 两行 + 输入硬上限那一格、§8.1 三族、§8.2 读法、§11 两行、§12 六段）、
Create `_docs/superpowers/plans/2026-09-30-tools-diff-page.md`（本文件）。

- [x] **Step 1：把 §5.6 那一节写进规格**——含"三处形状不同"（按侧判闸门 / 两类复制 / 不自动跑）、
      三态结论、行级口径（Myers + `MAX_COST` 降级 + 归一化只影响判等 + CRLF 与末行换行 + 行内 token +
      五个统计量 + `@@` 不省略 `,1`）、JSON 感知那六条（自带读侧的理由、与 json-core 对拍、
      键顺序无关、类型变化单列、Pointer 同规则、数组移动不识别）、文件输入那四条（两路、
      `file.size` 先判、NUL/U+FFFD 拒、不做记住输入）。
- [x] **Step 2：§4.1 加第四行 + §12 改成六段**，并把"段 4 那两份文档里所有'段 5'待办的新读法"写死
      （死锚点随段 5 或段 6 判、推送在段 5 收口后请示）。
- [x] **Step 3：§7 加两行标"待量"**——**这一格不许写数字**。§7 的规矩是先量后立（段 3/段 4 同一句话），
      现在能写的只有口径、件集与那条"第四页登记会让每一页 HTML 长一个 `<a>`"的前置风险。
- [x] **Step 4：写本计划**（§0 八格 + §1 契约 + Task 1–9 的判据表与 Steps）。
- [x] **Step 5：门禁二与门禁三跑一遍**（文档格不碰构建输入，①⑤⑥ 到 Task 2 起再跑）。
      `node scripts/verify-plan-blocks.mjs` → 本文件里的镜像块此时全是 `⚠ 未落地`，
      但**已落地的三页镜像必须仍全等**（`✗` 计数 0）；`node scripts/verify-plan-blocks-teeth.mjs` → 全绿。
- [x] **Step 6：提交**（plumbing，pathspec 只有这两份文档 + 上一格说的那两处 spec 回写）：

**Step 5 的补勾依据**（是 Task 2 那一次一并拿到的读数，**不是** 104e9c3 当时的读数）：门禁② 裸命令
exit=0、本文件全部镜像块与磁盘逐字节全等、`未落地 0 节`；门禁③ **37/37**——段 5 登记进 `PLANS`
之后长出 G12[段5] 那一对两条（35 → 37），末尾两条自证是"副本回到全绿"与"实验前后工作树脏指纹一字
不差"。本文件当时"全是 ⚠ 未落地"那一档没有留档，因为 Step 6 在 Task 2 开工之前就被并发会话带走了：

**Step 6 的实际落地形状与本页写的不同，登记成一格偏差**：这一格由并发会话以 `104e9c3`
（`docs(specs,plans): 段 5 立第五格——§5.6 文件对比页规格 + 本段计划（六段读法与两处地基拆解）`，
提交信息与下面那条 `git commit -m` 一字不差）提交，内容是 spec `+152/−6` 与本计划整份 541 行。
也就是**本格的 pathspec 已经不在我手里**：§5.6 与计划都进 HEAD 了，而另一路会话压在索引上的
`0/17` 那一格**仍然保在索引**（`git diff --cached --numstat` 现在仍读得到——§0.7 第 3 条要求的就是
"本格不能替它落地"，形状成立）。所以段 5 从这里起的边界是：**Task 1 无提交可出**，本文件后续的
镜像同步与 §0.6 回写全部并到 Task 2 那一格，"一格一提交"从 Task 2 起继续成立。

```bash
git add _docs/superpowers/specs/2026-09-25-blog-online-tools-design.md \
        _docs/superpowers/plans/2026-09-30-tools-diff-page.md
git commit -m "docs(specs,plans): 段 5 立第五格——§5.6 文件对比页规格 + 本段计划（六段读法与两处地基拆解）"
```

---

## Task 2：`diff-core.js` 行级对齐引擎 + §X

**Files：** Create `dev/js/tools/diff-core.js`；Modify `scripts/toolkit-tests.mjs`（末尾追加 `// ── §X …` 一节）；
Modify 本计划（镜像块 + 判据表勾选）。

- [x] **Step 1：写 §X 判据（先红）**。下表就是要写进 `toolkit-tests.mjs` 的判据，一条不许并：
      （落地时表里是 **29 行**：X29 是执行期补的，28 行那一版咬不住"first-fit 还是 latch"这一格——
      理由与变异证据在 §0.6 最后一行。）

| # | 咬的那一件事 |
| --- | --- |
| X1 | `splitLines` 六档形状：空串 / 只有 `\n` / LF / CRLF / 行内含裸 `\r` / 末行无换行；`crlf[]` 与 `finalNewline` 逐格对 |
| X2 | 两侧同空 → `verdict:'same'`、`ops` 一条 equal、五个统计量全 0 |
| X3 | 公共前后缀裁剪：前 50 行相同 + 后 30 行相同的样本，`ops` 首尾两条 equal 的长度 == 50 / 30 |
| X4 | **最短性对拍**：固化种子生成 200 组 ≤40 行的小样本，与测试侧自己实现的朴素 LCS DP 比"编辑脚本长度"，`cost` 不得大于 LCS |
| X5 | `ops` 三条不变式（文档顺序、无重叠、覆盖两侧全行）在 X4 那 200 组上逐组成立 |
| X6 | 归一化只影响判等：勾 `ws` 之后 `stats.ignored > 0` 的那几行，`hunksOf` 给的 `textA/textB` **仍是原文**、行号仍按原文 |
| X7 | `ws` 档：`'a b'` vs `'a  b'`、`' x'` vs `'x'` 判相同；`'ab'` vs `'a b'` **判不同**（并成空格不等于删空白） |
| X8 | `case` 档：`Foo` vs `foo` 判相同；数字串不受影响 |
| X9 | CRLF 默认算差异且 `Row.crlfA/crlfB` 说得清；勾了 `ws` 之后并入空白档不算 |
| X10 | 末行缺换行符：`finalNewline` 单独成档，`DIFF_NOTES.finalNewline` 那句被点亮且不空 |
| X11 | `gate` 按侧拒：只 A 超字节 / 只 B 超字节 / 两侧都超 / 只 A 超行数 四种形状各自的 `which` 与 `over` |
| X12 | 拒时给差额，且 `diffLines` 在闸门不过时**不做任何对齐**（`verdict:'blocked'`，`ops` 空） |
| X13 | `MAX_COST` 降级：造一个 D 越线的样本，`degraded:true`、`ops` 是"中段整块 del + 整块 ins"、两侧行数**一行不少**（这就是"降级不是截断"） |
| X14 | `DIFF_NOTES.degraded` 非空，且降级档的脚本长度 ≥ 不降级档（同一删了闸门的副本） |
| X15 | `inlineDiff` 四类 token：ASCII 词、空白串、标点、逐码点的 CJK——改一个汉字只标那一个字的 token |
| X16 | emoji：四个图素群样本切完**不得出现孤立代理项**（每段 `encodeURIComponent` 后仍是合法串） |
| X17 | `MAX_INLINE_TOKENS` 退化：越线那一对 `inline:null` 且 `stats.inlineSkipped` 计数 +1 |
| X18 | 五个统计量逐格定义 + 那条自洽关系（`added ≥ changed`、`removed ≥ changed`、`blocks` 数法） |
| X19 | `stats.ignored` 只在归一化开启时非零，关掉就是 0 |
| X20 | `hunksOf(result, 3)`：块内首尾各 3 行 equal，`skipped` 数的是被折掉的行数 |
| X21 | `hunksOf(result, Infinity)` == 全部行；`context` 传 `'all'` 那种非数值的值 → `TypeError` |
| X22 | 边界：差异就在文件第 1 行 / 就在末行时，首块与末块的 `skipped` 不得为负、不得凭空多上下文 |
| X23 | `unifiedText` 的 `@@ -a,b +c,d @@` 与手算逐字符对照，**单行区间不省略 `,1`** |
| X24 | `unifiedText` 两侧都空 → 只有头两行；只有 `--- A` / `+++ B` 那两名不同时 |
| X25 | `unifiedText` 里 `\r` 的处理与 X1/X9 同口径（不许悄悄吃掉） |
| X26 | 入参闸门：非字符串（`null` / number / object / Symbol.toString 过的东西）一律 `TypeError` 点名 |
| X27 | `opts` 取值档：`{ws:'yes'}` 这种 truthy 但非法的值 → `TypeError`，不许当 `true` 用 |
| X28 | 幂等：同一输入两次调用 `diffLines`，`ops` 与 `stats` 深相等 |
| X29 | `MAX_INLINE_WORK` 的账单形状：**装不下那一对就跳过它，后面装得下的照常细化**（first-fit，不是 latch） |

- [x] **Step 2：写实现到绿**，跑 `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs`。
      落地读数 `# tests 392 / # pass 392 / # fail 0`（§X 二十九判 + 段 1–4 存量三百六十三判）。
      **先红那一步真红过**，红的是三条**我写错的期望**、不是实现缺陷——三条一律先读实现再判谁错，
      没有一条靠放宽断言蒙过去：X1 把行内裸 `\r` 记进 `bytes` 的口径写成了"剥完之后"（实现量的是
      **输入全文**，闸门那一只尺只有一把）；X3 期望"三行换一行"给 `del(2)+ins(1)`（`mergeRuns`
      的规范化是**每条极大非等段一枚 del + 一枚 ins**，所以 `del(3)+ins(1)`、`cost` 4）；
      X6 拿全等样本验"归一化只影响判等"，而 `hunksOf` 在没有差异时按设计返回空数组，
      那一格反而没人验（改成两侧各留一格真改动）。
- [x] **Step 3：登记镜像**——`verify-plan-blocks.mjs` 的 `FILE_TARGETS` 追加 `'dev/js/tools/diff-core.js'`
      （方向照旧：**有镜像才登记，跟着磁盘走**），**同一步**把
      `{ rel: '_docs/superpowers/plans/2026-09-30-tools-diff-page.md', tag: '段5' }` 追加进 `PLANS`
      （脚本 `:56-58` 那条注释立的规矩：`PLANS` 认了却磁盘上没有对应块，门禁二红的是"新来的这份一条都没核"——
      登记方向跟着磁盘走，这条是它的另一面）。本计划 Task 2 那一节贴一块 ` ```js ` 围栏，
      头几行就是磁盘的头几行，然后 `node scripts/verify-plan-blocks.mjs --fix` 整块换进去，
      再跑一次裸命令确认全等。
      三处都动了：`FILE_TARGETS` 那一格连注释一起写（它是这一族**第一本自带算法的纯逻辑模块**，
      镜像同时是 spec §7 那三个常量的第二现场）；`PLANS` 追加段 5；文件头那句"四份计划"改成**五份**。
      裸门禁② 两行读数：`OK dev/js/tools/diff-core.js：计划[段5] …（1054 行）与磁盘逐字节全等`、
      `OK scripts/toolkit-tests.mjs §X（磁盘 13339–13974）：计划[段5] …（636 行）与磁盘逐字节全等`，
      exit=0、`未落地 0 节`。**贴种子时踩到 `--fix` 的"按节名定位"那一档**：§X 那块镜像的 banner
      起手写短了（少了尾部那一串 `─────`），门禁② 报"标记行自己漂了、公共前缀 0 行"，
      仍然按节名把整块换对了——这条路径文档里写着，本次是第一次真跑到。
      同一格还按 §0.6 那条硬规矩把**本计划起草时用错的围栏语言**改了：§0.3 的实读摘录与 §1.1–§1.4
      四段契约全是 ` ```js `，现在一律 ` ```text `，全文只剩本节这两块镜像是 js（理由与形状见下一段）。
- [x] **Step 4：门禁③**（teeth 认新镜像那一格要不要补一刀，见 Task 8）+ **门禁①** 全量。
      门禁③ **37/37**：`PLANS` 那一对长成 G12[段2]/[段3]/[段4]/[段5] 共八条，段 5 这一对读到的正是
      "少一份 → 名下 2 块镜像全部 ✗ + 退 1"；末尾两条自证 = 副本回到全绿 + 实验前后工作树脏指纹
      （28 个脏项、含另一路会话那批）一字不差。**"新镜像那一格要不要补一刀"的答案是"要、但归 Task 8"**：
      现有 37 项只咬"整份计划缺席"那种形状，"**清单里少登记一个磁盘上已存在的镜像文件**"这一刀没有牙
      （少登记 = 那本文件根本不核，静默通过）——记进 Task 8 的补刀清单，本格不动 teeth 脚本。
      门禁① 在写回前后各跑一次，两次都 392/392。牙是三刀自证的：摘掉 `blocked` 分支里的
      `inlineByKey` 只红 X12；把 first-fit 改成 latch 只红 X29；摘掉 `mergeRuns` 的规范化红 15 判。
      三刀全部按 `md5` 还原回基线（第四刀"末行标记"因分类器中途把一条 Bash 拦了下来，
      当场用 Edit 回退并 `md5 -q` 自证与基线相同，没有留在工作树里）。
- [x] **Step 5：提交** `feat(tools): 段 5 Task 2 行级对齐引擎——diff-core 与 §X 二十九判`。
      落笔 = `76cef84`（`be5246b` → `76cef84`，`git update-ref` 的 CAS 带旧 sha）。
      pathspec 四件：`dev/js/tools/diff-core.js`（新）/ `scripts/toolkit-tests.mjs` /
      `scripts/verify-plan-blocks.mjs` / 本计划，`git show --stat` 读到 `3548 insertions(+) / 15 deletions(-)`
      且**只有这四行**；另一路会话压在索引上的 **16 格一格不少**（`USAGE.md` 仍是 `1/76`、
      spec 仍是 `0/17`），它的工作树文件一件没动。
      **提交态自证**（`git archive HEAD` 整份导出 → 三道人真跑）：门禁① `392/392` 退 0、
      门禁② 退 0（`67` 块已落地镜像全等、`未落地 0 节`）、门禁③ **37/37** 退 0。
      两处形状要记：① **导出树必须先 `git init`**——门禁③ 末尾那句"实验前后工作树脏指纹一字不差"
      拿的是 `git status --porcelain`，裸导出树里它是 `fatal: not a git repository`，
      脚本连一项都没跑就崩（项目记忆里"门禁三要先在导出树 git init"那条，本次第二次撞上）；
      ② **稀疏导出会造四道假红**：只 `git archive HEAD scripts dev _docs` 时 B14 / K18 / N19 / U5
      四判 ENOENT（缺 `demo/`、`vite.config.js`、`package.json`、`pnpm-lock.yaml`），
      门禁② 也跟着报 7 个目标缺席（缺 `_data/`、`assets/`、`tools/`）——**自证要整份导出**，
      少一块就少一批被核的对象，那种红是量具的红。
      时间跨了零点是真跨了：`2026-09-30` 开工、`2026-10-01` 落笔，本文件的日期与文件名仍按开工那天。

### 落地镜像（门禁二核的就是这一块，`--fix` 会把它整块换成磁盘内容）

这一块是**磁盘全文**，用 ```js 围栏（§0.6 的硬规矩：只有整文件与整节镜像允许 ```js，
契约段一律 ```text）。Task 2 落地时（2026-09-30）这一块是**新贴**的——`--fix` 只做整块替换、
从不插入，所以贴的时候直接由磁盘内容生成，事后跑一次 `--fix` 复验它已经全等。

> 同一格里顺手把**本计划自己违反这条硬规矩的地方**改回来了：起草时 §0.3 那段 `check-tools-surface.mjs`
> 的实读摘录与 §1.1–§1.4 四段契约都写成了 ` ```js `（全文现在只剩本节这两块是 js）。
> 这不是排版洁癖：`pickMirror` 的"疑为它的镜像"按**与磁盘的最长公共前缀**找候选，候选并列时退回
> "无法唯一定位"、`--fix` 就不动手——多一块 js 围栏进池子，门禁二就多一分变成手工活的风险。
> 段 4 那份计划的 §0.7 第 5 条把这件事写得很清楚，本计划起草时抄了规矩没抄形状。

#### `dev/js/tools/diff-core.js`（整文件）

```js
/**
 * 文件对比页的行级与 token 级对齐引擎（段 5 Task 2；§X）。这一本只管"两段文本怎么对齐、对齐成什么形状"，
 * 不碰 DOM、不读环境、不 `import` 本仓库任何模块——它是纯逻辑层，`diff-json.js` 与视图层、装配层
 * 都只能往下拿，不许往上问。
 *
 * 为什么对齐要自己写（而不是配一个贪心配点就交差）：这一页的**结论行**要写"增 N 行、删 M 行、改 K 处、
 * 差异块 P 个"，而 N/M/K/P 只有在**最短编辑脚本**上才有唯一含义。同一对文件用贪心配点对出来的
 * "改 12 处"和用 LCS 对出来的"改 7 处"都算"对上了"，但用户在页面上读到的那个数是这一页最硬的一句承诺。
 * 所以 §X 的 X4 拿测试侧独立实现的朴素 LCS DP 当长度尺子对拍，X5 钉三条覆盖不变式——
 * **先证它是最短的，再谈那几个数能写进句子**。
 *
 * 五条设计口径，逐条都有判据对着咬：
 *
 * 1. **归一化只影响判等，不影响展示与行号**（X6）。`compareKey` 是唯一的归一化出口，勾了"忽略空白 /
 *    忽略大小写"之后变的是键，行内容、行号与 `unifiedText` 的内容行一律抄原文。这一条是本页最容易
 *    说谎的地方：一旦归一化后的串漏进展示，页面上就会出现"用户看不见那处差异，却告诉他完全相同"。
 * 2. **降级不是截断**（X13、X14）。编辑距离越到 `MAX_COST` 就整块按"删 + 增"给，行数一行不少，
 *    只是不再配对；`cost` 在降级档报的是这条块脚本的长度，所以它必然 ≥ 不降级档——X14 钉的就是这一句。
 *    越线是**按盒子**判的：分治每一层先拿一道 O(len) 的**多重集合下界**快判（`matchCap`），下界已经越过
 *    `cap` 就只降级这一格。写在整份文件那一层会打出一个很难看的形状——十万行的文件中间改了 2500 行，
 *    全局下界越线就等于把剩下九万七千行逐行对上的功劳也一起抹掉。进 Myers 之前不做那道快判，
 *    另一头则是两份完全不相干的长文本要把格子跑满 `MAX_COST²` 个：页面上十几秒什么都没有，
 *    而那恰好是用户最该立刻看到结论的形状。
 * 3. **CRLF 与末行换行是两种不同的事实**（X1、X9、X10、X25）。`splitLines` 把行尾那个 `\r` 剥进
 *    `crlf[]`，所以行内容里剩下的 `\r` 是正文而不是行尾；`finalNewline` 单独一格，对应的正是 git 用
 *    `\ No newline at end of file` 标记的那件事。两者都不许被"统一 trim 一下"顺手吃掉。
 * 4. **`ops` 的形状是这一本对外的唯一合同**（X5）。按文档顺序、无重叠、覆盖两侧全部行；每个极大非等段
 *    由 `mergeRuns` 规范化成"一整块 `del` + 一整块 `ins`"（`segmentsOf` 再把它折成"成对 + 余下"），
 *    统计量、`hunksOf` 的 `change` 行、`unifiedText` 的 `@@` 区间三处全从这里派生，谁也不许另算一遍。
 * 5. **token 规则写死在这个顺序上**（X15、X16）：空白串 → ASCII 词（数字段跟着词一起）→ 其余逐码点。
 *    按 `\w+` 切会把一整句中文切成一个 token，行内高亮当场退化成整行着色；逐码点切则必须
 *    **不切出孤立代理项**，emoji 那一判拿 `encodeURIComponent` 会抛 `URIError` 这件事当尺子。
 *
 * 与 `json-core.js` 的关系：只有**口径**共享，没有一行代码共享（段 5 计划 §0.4 那条构建层红线——
 * 两个入口 reach 同一模块，Rollup 会切出带 `import{` 的共享 chunk，`iifeWrapPlugin` 包完就是整页
 * SyntaxError 而构建 exit=0）。`MAX_INPUT_BYTES` / `MAX_INPUT_LINES` 两格与 spec §7 输入硬上限那一行
 * 同源；字节尺子用的是与 `json-core.js:101` 同一份按码元数的写法（浏览器里没有 `Buffer`），
 * §X1 那条判据拿 Node 的 `Buffer.byteLength` 从外面量它，与 §S 的 S3/S18 是同一种对拍。
 *
 * 复算：`node --test scripts/toolkit-tests.mjs` 里的 §X 二十九判。
 */

/** `\n` 与 `\r` 的码元值：这一本只用这两个常量判行尾，别处不许另写 13/10 */
const LF = 10;
const CR = 13;

// ── 常量 ────────────────────────────────────────────────────────────────────

/** 每侧输入的 UTF-8 字节上限（5 MiB），与 JSON 页同一把尺；`gate()` 按侧判，不按两侧合计判 */
export const MAX_INPUT_BYTES = 5242880;

/** 每侧行数上限（20 万行）：超了就拒，不给"只看前 20 万行"的静默截断 */
export const MAX_INPUT_LINES = 200000;

/**
 * 行级对齐的编辑距离上限。越线走"整块删 + 整块增"的降级档（口径 2），不是走"少给你几行"。
 *
 * 为什么是 2000 这一档：这一格的账单随编辑距离**超线性**涨（V 表只开到 `[-D, D]` 那一扇窗口，
 * 分治每层还要 `minCost` 一遍），所以它就是"最坏一次对齐点多久"的直接旋钮。段 5 实测曲线
 * （Node 22 单线程、`load average` 5.4；构造钉死在两侧各 n=20000 行 `l0…l19999`、每
 * `step = 2n/D` 行换掉一行 ⇒ 换一行 = 一删一增 = `cost` 正好 D，`maxCost` 给 `1e9` 不夹）：
 * `D=1000 → 284ms`、`D=2000 → 649ms`、`D=2500 → 910ms`、`D=4000 → 2100ms`、`D=5000 → 3720ms`
 * ——5 倍的 D 换来 13 倍的时间。按这条曲线外推，契约 §1.1 原本写的 `20000` 那一档是**几十秒**
 * （二次模型给 100×649ms ≈ 65s，按实测涨法也有 40s 开外），一次粘贴就能把主线程锁死半分钟。
 * 取 2000 = 闸门线上最坏一次对齐压在桌面 0.7s 内，手机还要再慢三到五倍。对应的用户形状是
 * "一次改动两千行以内逐行配对，再多就按块给"，而那一档的产物本来也没人能读完。
 * 它不管"能喂多少行"——那一档是 `gate()` 的 `MAX_INPUT_LINES`。复算脚本见段 5 计划 §0.6 那一行。
 */
export const MAX_COST = 2000;

/** 单对行做行内细化的 token 上限（两侧之和）：越线那一对退化成整行着色，`stats.inlineSkipped` 计数。
 *  这一档管的是**形状**而不是时间——一对行切出四千枚 token，页面就要往那一行里塞四千来个 `<span>`，
 *  读不出任何东西；时间那一份由 `MAX_INLINE_WORK` 管，两档各判各的。 */
export const MAX_INLINE_TOKENS = 4000;

/**
 * 行内细化的**总量预算**，单位是"对齐格子数"（`4 × D²` 那一本账）——尺度与 `MAX_COST` 同源：
 * 上面那条曲线上一次对齐的耗时除以格子数，本机读到的是**每格 30–70ns** 一档。这一格存在的理由是
 * 那一族脚本真正的账单形状：行内那一步按**行对**逐个跑 Myers，单个行对再便宜，
 * `Σ 每对的格子数` 也会随改动行数累加——十万行的中文文件逐行改下来，光靠单对形状闸门
 * （`MAX_INLINE_TOKENS`）拦不住，页面会在行内那一步走掉十几秒。
 *
 * 每个行对记**两笔**：① 切分那一刀按 `min(字符数, MAX_INLINE_TOKENS)` 记——`tokenize` 带 limit，
 * 一侧最多切到四千零一枚就收手，所以这一笔记的是**真实上界**，不是"这一行有多长"；
 * ② 对齐最坏要走的格子数（`inlineWorkOf`：`4 × min(裁掉公共前后缀后余下的 token 数, MAX_COST)²`
 * ——前后缀一裁，余下的就是真在变的区段，而 `D` 越线之后走的是 O(n) 的降级快判，夹在 `MAX_COST` 才对）。
 * 3,000,000 那一格不是估的：段 5 用同一份输入跑 A/B（A = 现行常数，B = 只把这一格换成 `Infinity`
 * 的一份副本，构造钉死在"两侧各 10000 行、每行 8 个 ASCII 词、两侧逐词全不同"）——
 * **A 126ms（`inlineSkipped` 9191）/ B 857ms（跳过 0）**，比值 6.8×；同一台机 `load average` 5.4。
 * 也就是"整页行内那一步压在 0.1s 量级"是买到的，不是假设的。复算脚本见段 5 计划 §0.6 那一行。
 *
 * 装不下的行对**整行着色**（`DIFF_NOTES.inlineSkipped` 那句），规则是按文档顺序第一 fits：
 * 装得下就细化、装不下就跳过这一对继续看下一对，而不是"遇到一对超预算就把后面全掐掉"——
 * 后者会让一个 4000 token 的长行把整页的行内高亮带走，而它明明只需要跳过自己。
 * 按文档顺序而不是按大小排序，是为了同一份输入两次结果逐格相同（X28）。
 */
export const MAX_INLINE_WORK = 3000000;

/** 折叠时每个差异块首尾各保留的上下文行数，也是 `unifiedText` 的默认档 */
export const DEFAULT_CONTEXT = 3;

/** CRLF 那一档在界面上的形状：视图层拿它补进行尾，`␍` 是本模块与 `diffView.js` 之间唯一的字形约定 */
export const CR_GLYPH = '␍';

// ── 内部工具 ────────────────────────────────────────────────────────────────

/**
 * 报错里要说清"这里给的是什么东西"。只用 `typeof` 与 `Array.isArray`（不引 `node:util`，
 * 这一本要能在浏览器里直接跑），`null` 单独点名。
 * @param {unknown} v
 * @returns {string}
 */
function typeName(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

/**
 * UTF-8 字节数：代理对算 4，BMP 按 3/2/1。与 `json-core.js:101` 同一份算法而不是同一份代码，
 * 理由见文件头那句"两个入口"的红线；§X1 拿 `Buffer.byteLength` 从外面量它。
 * @param {string} text
 * @returns {number}
 */
function utf8Bytes(text) {
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) total += 1;
    else if (c < 0x800) total += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length
      && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) { total += 4; i++; }
    else total += 3;
  }
  return total;
}

/**
 * 归一化开关的取值档。三个键都必须是**布尔**：`{ws:'yes'}` 这种 truthy 但非法的值一律 `TypeError`（X27），
 * 未知键同样拒。装配层从 checkbox 拿的是 `input.checked`（真布尔），所以这里严格一档不会误伤；
 * 反过来，拼错的键名（`ignoreWs`）如果被静默忽略，页面上那个勾选框就成了一件装饰品，而它看上去在工作。
 * @param {object|undefined|null} opts
 * @param {string} at 报错署名的调用点
 * @param {boolean} [withCrlf] 这一层认不认 `crlf` 那一格（只有 `compareKey` 认）
 * @returns {{ws: boolean, case: boolean, crlf: boolean}}
 */
function normOpts(opts, at, withCrlf = false) {
  if (opts === undefined || opts === null) return { ws: false, case: false, crlf: false };
  if (typeof opts !== 'object' || Array.isArray(opts)) {
    throw new TypeError(`${at}：opts 必须是对象，这里是 ${typeName(opts)}`);
  }
  const out = { ws: false, case: false, crlf: false };
  for (const k of Object.keys(opts)) {
    if (k === 'ws' || k === 'case') {
      const v = opts[k];
      if (typeof v !== 'boolean') {
        throw new TypeError(`${at}：opts.${k} 必须是布尔值，这里是 ${typeName(v)}（truthy 不等于 true）`);
      }
      out[k] = v;
    } else if (k === 'crlf') {
      if (!withCrlf) throw new TypeError(`${at}：opts.crlf 只有 compareKey(line, opts) 认这一格`);
      const v = opts[k];
      if (typeof v !== 'boolean') throw new TypeError(`${at}：opts.crlf 必须是布尔值，这里是 ${typeName(v)}`);
      out.crlf = v;
    } else {
      throw new TypeError(`${at}：opts 里没有 ${k} 这一档（可用的是 ws / case${withCrlf ? ' / crlf' : ''}）`);
    }
  }
  return out;
}

// ── 拆行与归一化 ─────────────────────────────────────────────────────────────

/**
 * 拆行：只认 `\n`。行尾那个 `\r` 剥出来记进 `crlf[]`（所以行内容里的 `\r` 是正文，不是断行），
 * 末行没有 `\n` 时 `finalNewline` 为 `false`——那一档单独成判据（X10），因为它对应的是 git 用
 * `\ No newline at end of file` 标记的那件事，不是"少一行"。
 *
 * 空串给的是**零行**（`count: 0`、`finalNewline: true`），只有一枚 `\n` 给的是**一行空行**：
 * "这个文件没有内容"与"这个文件有一行，那一行是空的"是两件事，并成一档的话
 * 空文件比空文件就会报出非零的 `added/removed`。
 * @param {string} text 整段输入
 * @returns {{lines: string[], count: number, crlf: boolean[], finalNewline: boolean, bytes: number}}
 */
export function splitLines(text) {
  if (typeof text !== 'string') {
    throw new TypeError(`splitLines(text)：text 必须是字符串，这里是 ${typeName(text)}`);
  }
  const lines = [];
  const crlf = [];
  let start = 0;
  let finalNewline = true;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) !== LF) continue;
    let end = i;
    const isCrlf = end > start && text.charCodeAt(end - 1) === CR;
    if (isCrlf) end -= 1;
    lines.push(text.slice(start, end));
    crlf.push(isCrlf);
    start = i + 1;
  }
  if (start < text.length) {
    lines.push(text.slice(start));
    crlf.push(false);
    finalNewline = false;
  }
  return { lines, count: lines.length, crlf, finalNewline, bytes: utf8Bytes(text) };
}

/**
 * 比较键：**只用于判等**（口径 1，X6 钉这一句）。三档的先后是定死的：先补行尾 `\r`（当这一行的
 * `crlf` 为真），再按 `ws` 把连续空白并成一格并去掉首尾，最后按 `case` 落小写。
 *
 * `ws` 那一档"并成空格"而不是"删掉所有空白"，所以 `'a b'` 与 `'a  b'` 相同而 `'ab'` 与 `'a b'`
 * 不同（X7）：把空白全删掉会造出一批"看上去完全不同却被判相同"的行，那种"相同"用户在页面上读不出来。
 * @param {string} line 行原文（不含 `\n`）
 * @param {{ws?: boolean, case?: boolean, crlf?: boolean}} [opts]
 * @returns {string}
 */
export function compareKey(line, opts) {
  if (typeof line !== 'string') {
    throw new TypeError(`compareKey(line, opts)：line 必须是字符串，这里是 ${typeName(line)}`);
  }
  const o = normOpts(opts, 'compareKey(line, opts)', true);
  let s = o.crlf ? `${line}\r` : line;
  if (o.ws) s = s.replace(/\s+/g, ' ').trim();
  if (o.case) s = s.toLowerCase();
  return s;
}

// ── token 化（行内细化用）───────────────────────────────────────────────────

/**
 * token 的四条序（口径 5）：① 连续空白（含制表）成一枚 ② ASCII 词 `[A-Za-z0-9_]+` 成一枚
 * （数字段跟着词，所以不另起第三条）③ 其余逐码点。
 *
 * 两面都带 `y`（sticky）：从**下标**往前推，而不是每枚都 `slice` 一次剩下的整行——闸门允许
 * 单行 5 MiB，`slice` 版本在那一行上是 O(n²)，光切 token 就能吃掉好几秒。
 */
const WS_TOKEN = /\s+/y;
const WORD_TOKEN = /[A-Za-z0-9_]+/y;

/**
 * 把一行切成 token，每枚带 `text`（上色用原文）与 `key`（判等用归一化键）。于是行内细化与行级判等
 * 共用同一把尺子：勾了忽略大小写之后，行内也不该把 `Foo` 与 `foo` 标成两处改动。
 *
 * `limit` 是**单侧**的枚数上限：越线直接返回 `null`，不继续把剩下的行切完。传它是因为
 * `MAX_INLINE_TOKENS` 那道闸门看的是两侧之和，任何一侧单独越过这条线，那一和必然也越——
 * 于是"提前收手"不影响判定的结论，只影响要不要为一行 5 MiB 的样本建一张百万项的表。
 * @param {string} line
 * @param {{ws?: boolean, case?: boolean}} opts 已经过 `normOpts` 的那一份
 * @param {number} [limit] 单侧枚数上限，越线返回 `null`
 * @returns {{text: string, key: string}[]|null}
 */
function tokenize(line, opts, limit = Infinity) {
  const out = [];
  let i = 0;
  while (i < line.length) {
    WS_TOKEN.lastIndex = i;
    WORD_TOKEN.lastIndex = i;
    let text;
    const ws = WS_TOKEN.exec(line);
    if (ws) text = ws[0];
    else {
      const w = WORD_TOKEN.exec(line);
      if (w) text = w[0];
      else {
        // 逐码点：`codePointAt` 天然把代理对当成一枚取（X16 的那把尺就是这件事）
        const cp = line.codePointAt(i);
        if (Number.isNaN(cp)) break;
        text = String.fromCodePoint(cp);
      }
    }
    if (text === '') break;
    i += text.length;
    let key = text;
    if (opts.ws) key = key.replace(/\s+/g, ' ');
    if (opts.case) key = key.toLowerCase();
    out.push({ text, key });
    if (out.length > limit) return null;
  }
  return out;
}

// ── Myers：最短编辑脚本（线性空间分治）──────────────────────────────────────

/**
 * Myers 贪心推进的核心循环——**前向表、后向表、求最短步数三件事共用这一本**（夹边与"不可达"
 * 的规则只要写两遍，就会有一遍是错的；X4 的对拍第一轮抓到的正是这种第二遍）。
 *
 * 约定：`eq(i, j)` 的下标相对**盒子起点**，`0 ≤ i < n`、`0 ≤ j < m`；`backward` 为真时坐标从盒子
 * **右下角**往回数（`k = xb - yb`，与绝对对角线的关系是 `kb = delta - k`），规则本身一模一样。
 *
 * 两条"不可达"必须分开处理，混起来就是最短性的直接漏洞：
 * - 前驱对角线在范围外（`|k±1| > d-1`）或值是 `-1`：那一格这一步到不了。两侧都到不了就 `continue`
 *   留 `-1`——旧写法在这里会算出 `xx = 0`，把一条根本走不到的对角线当成"走到了起点"，
 *   那个假接点会顺着分治漏进子问题，报出的脚本长度既可能比最短的长、也可能比最短的**短**
 *   （后者更危险：它是一条根本不成立的编辑脚本，页面上却读起来完全合理）。
 * - `x` 超出盒子：夹到 `hi = min(n, m + k)`。夹在 `n` 是不够的——`k < n - m` 那一档夹到 `n`
 *   会留下 `y > m` 的假点，蛇形延伸再从假点出发，等于凭空多走了一步。
 *
 * `delta` 给了就每步末尾查一次终点（求 D 用），到了就返回那一步；不给就是把 `dMax` 步转满（分治用）。
 * @param {number} n 盒子 a 侧长度
 * @param {number} m 盒子 b 侧长度
 * @param {number} dMax 最多转这么多步
 * @param {(i: number, j: number) => boolean} eq 相对盒子起点
 * @param {boolean} [backward] 从右下角往回数
 * @param {number|null} [delta] 终点所在对角线 `n - m`；给了就在每步末尾查一次
 * @returns {{v: Int32Array, off: number, d: number}} `d` 为 -1 表示转满仍未到终点
 */
function greedy(n, m, dMax, eq, backward = false, delta = null) {
  const off = dMax;
  const v = new Int32Array(2 * dMax + 1).fill(-1);
  const at = backward ? (i, j) => eq(n - 1 - i, m - 1 - j) : eq;
  let x = 0;
  let y = 0;
  while (x < n && y < m && at(x, y)) { x += 1; y += 1; }
  v[off] = x;
  if (delta !== null && x >= n && y >= m) return { v, off, d: 0 };
  for (let d = 1; d <= dMax; d++) {
    for (let k = -d; k <= d; k += 2) {
      if (k > n || k < -m) continue;
      const down = Math.abs(k + 1) <= d - 1 ? v[off + k + 1] : -1;
      const right = Math.abs(k - 1) <= d - 1 ? v[off + k - 1] : -1;
      let xx = -1;
      if (down >= 0 && right >= 0) xx = right < down ? down : right + 1;
      else if (down >= 0) xx = down;
      else if (right >= 0) xx = right + 1;
      if (xx < 0) continue;
      const hi = m + k < n ? m + k : n;
      if (xx > hi) xx = hi;
      let yy = xx - k;
      while (xx < n && yy < m && at(xx, yy)) { xx += 1; yy += 1; }
      v[off + k] = xx;
    }
    if (delta !== null && Math.abs(delta) <= d && (d - delta) % 2 === 0 && v[off + delta] >= n) {
      return { v, off, d };
    }
  }
  return { v, off, d: -1 };
}

/**
 * 最少编辑步数（前向贪心，一维滚动表）。`cap` 是硬上限：转满 `cap` 步还没到终点就返回 `-1`，
 * 调用方据此走降级档。`n === 0` 或 `m === 0` 时直接给另一侧的长度——那一档不需要搜索。
 * @param {number} n
 * @param {number} m
 * @param {(i: number, j: number) => boolean} eq
 * @param {number} cap
 * @returns {number} 最短步数，或 `-1`（越线）
 */
function minCost(n, m, eq, cap) {
  if (n === 0) return m <= cap ? m : -1;
  if (m === 0) return n <= cap ? n : -1;
  // 表宽夹到 `n + m`：一个盒子的最短步数不可能超过两侧长度之和，而 `greedy` 的表宽是按**上限**开的。
  // 不夹这一档，分治的每一个小节点都要按 `MAX_COST` 开一张 8001 格的表并填 `-1`——
  // 那些格永远到不了，却是这一本真实存在过的开销里最没意义的一笔（实测见段 5 计划 §0.6）。
  const dMax = cap < n + m ? cap : n + m;
  return greedy(n, m, dMax, eq, false, n - m).d;
}

/**
 * 递归吐出 `ops`（线性空间的 Myers：Myers 论文算法 3 的"中间蛇"分治）。
 *
 * 每一层的动作：先裁公共前后缀（所以 `D == 1` 那一档在进 Myers 之前就成了 `n===0 || m===0` 的基例），
 * 再用 `minCost` 拿这一层的最短步数 `D`，取 `h = D >> 1`，前向表转到第 `h` 步、后向表转到第 `D-h` 步，
 * 两条路径必然在某条对角线上接上——那个接点把问题切成两半，两半各自最优（否则拼起来比 `D` 短，
 * 与 `D` 最小矛盾）。**这就是内存只随 `n+m` 走、不随 `D²` 走的原因**：按"每一步存一张 V 表"的
 * 教科书写法回溯，`MAX_COST` 那一档要 `MAX_COST²` 个格子，手机上这一页先把自己吃掉。
 *
 * 接点找不到是不该发生的事：那说明 `minCost` 与两张表的步数划分不自洽，或下标算错。
 * 那一档**不许**悄悄降级糊过去（那会把一个算法 bug 伪装成一次正常的性能退让，页面上读起来完全合理），
 * 所以它抛 `RangeError`，让 §X 与门禁①当场点名。
 * @param {(i: number, j: number) => boolean} eq 相对本层窗口起点 (aBase, bBase) 的下标
 * @param {number} n
 * @param {number} m
 * @param {number} aBase 本层窗口在原序列里的 a 起点（**绝对**下标：写进 `ops` 与取键都用它）
 * @param {number} bBase
 * @param {number} cap
 * @param {object[]} out
 * @param {{ka: string[], kb: string[]}|null} keys 快判用的键序列；`null` = 这一档不做快判
 * @returns {boolean} 这一层连同子层里有没有发生过降级
 */
function walk(eq, n, m, aBase, bBase, cap, out, keys) {
  // 约定：`eq(i, j)` 的下标是**相对本层窗口起点 (aBase, bBase)** 的，所以裁掉前缀之后必须换一本
  // 接下去用（`win` 那一格）。少了这一步，递归层会拿上一层的绝对下标去比，读到的行整体错位——
  // 而那正是"看上去对上了、统计量却在说谎"的形状，X4/X5 的对拍就是冲着它立的。
  let alo = 0;
  let blo = 0;
  while (alo < n && blo < m && eq(alo, blo)) { alo += 1; blo += 1; }
  let ahi = n;
  let bhi = m;
  while (ahi > alo && bhi > blo && eq(ahi - 1, bhi - 1)) { ahi -= 1; bhi -= 1; }
  if (alo > 0) out.push({ op: 'equal', a: aBase, aLen: alo, b: bBase, bLen: alo });
  const ab = aBase + alo;
  const bb = bBase + blo;
  const mn = ahi - alo;
  const mm = bhi - blo;
  const win = (i, j) => eq(alo + i, blo + j);
  let degraded = false;
  if (mn > 0 && mm > 0) {
    // 快判只在两侧都还长的时候有意义（小盒子进 Myers 本就几微秒，而按盒子建一张哈希反倒更贵）
    const bail = keys !== null && mn > 64 && mm > 64
      && mn + mm - 2 * matchCap(keys.ka, ab, ab + mn, keys.kb, bb, bb + mm) > cap;
    const d = bail ? -1 : minCost(mn, mm, win, cap);
    if (d < 0) {
      degraded = true;
      out.push({ op: 'del', a: ab, aLen: mn, b: bb, bLen: 0 });
      out.push({ op: 'ins', a: ab + mn, aLen: 0, b: bb, bLen: mm });
    } else {
      const h = d >> 1;
      const d2 = d - h;
      const f = greedy(mn, mm, h, win);
      const b = greedy(mn, mm, d2, win, true);
      const delta = mn - mm;
      let sx = -1;
      let sy = -1;
      for (let k = -h; k <= h; k += 2) {
        const kb = delta - k;
        if (kb < -d2 || kb > d2) continue;
        const xf = f.v[f.off + k];
        const xb = b.v[b.off + kb];
        if (!(xf >= 0 && xb >= 0 && xf + xb >= mn)) continue;
        const px = xf;
        const py = xf - k;
        // 接点落在盒子的起点或终点时，两条子问题里有一条会跟父问题同尺寸——递归不前进。
        // 最短路径中间必然还有别的对角线能接上（ Myers 论文算法 3 的那一句），所以这一档**换下一条**，
        // 而不是就地接受；真的一条都没有才让下面那句 `RangeError` 点名。
        if ((px === 0 && py === 0) || (px === mn && py === mm)) continue;
        sx = px;
        sy = py;
        break;
      }
      if (sx < 0) {
        throw new RangeError(`diffSeq：D=${d} 的前向 ${h} 步与后向 ${d2} 步没有找到接点（内部不变式破了）`);
      }
      const left = walk(win, sx, sy, ab, bb, cap, out, keys);
      // 右半边另起一本：它的窗口起点是接点 `(ab+sx, bb+sy)`，把 `win` 原样递下去会让这一层
      // 从接点**之前**的行开始判等——`ops` 里 `a` 侧下标还是对的、`b` 侧却整体偏移，
      // 于是页面上的配对是"自洽但错行"的（对拍第一轮抓到的正是这一条：cost 等于最短值，
      // 而 `equal` 那几格把 'a' 配给了 'b'）。
      const rightWin = (i, j) => win(sx + i, sy + j);
      const right = walk(rightWin, mn - sx, mm - sy, ab + sx, bb + sy, cap, out, keys);
      degraded = left || right;
    }
  } else if (mn > 0) {
    out.push({ op: 'del', a: ab, aLen: mn, b: bb, bLen: 0 });
  } else if (mm > 0) {
    out.push({ op: 'ins', a: ab, aLen: 0, b: bb, bLen: mm });
  }
  if (bhi < m) out.push({ op: 'equal', a: aBase + ahi, aLen: n - ahi, b: bBase + bhi, bLen: m - bhi });
  return degraded;
}

/**
 * 把一个极大非等段规范化成"一整块 `del` + 一整块 `ins`"（口径 4）。
 *
 * Myers 的路径可以在一段里左右交替（`del, ins, del`），那样"改 K 处"的 K 就没有唯一定义，
 * `hunksOf` 的 `change` 行与 `unifiedText` 的区间也得各算一遍。这一段把每个非等段压成至多两格，
 * 顺带保证 a 侧下标连续、b 侧下标连续——那正是 X5 那三条不变式的形状。
 * @param {object[]} ops
 * @returns {object[]}
 */
function mergeRuns(ops) {
  const out = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i].op === 'equal') { out.push(ops[i]); i += 1; continue; }
    let startA = Infinity;
    let startB = Infinity;
    let endA = 0;
    let endB = 0;
    let del = 0;
    let ins = 0;
    while (i < ops.length && ops[i].op !== 'equal') {
      const c = ops[i];
      startA = Math.min(startA, c.a);
      startB = Math.min(startB, c.b);
      if (c.op === 'del') { del += c.aLen; endA = c.a + c.aLen; endB = Math.max(endB, c.b); }
      else { ins += c.bLen; endB = c.b + c.bLen; endA = Math.max(endA, c.a); }
      i += 1;
    }
    endA = Math.max(endA, startA);
    endB = Math.max(endB, startB);
    if (del > 0) out.push({ op: 'del', a: startA, aLen: del, b: startB, bLen: 0 });
    if (ins > 0) out.push({ op: 'ins', a: endA, aLen: 0, b: startB, bLen: ins });
  }
  return out;
}

/**
 * 一段盒子"最多能配上多少行"的上界：拿 b 侧区间的键做多重集合，a 侧区间逐行去领额度，
 * 所以是 O(lenA + lenB)。公共行数 ≤ 它，于是这一格的编辑距离**下界** = `lenA + lenB − 2 × 上界`
 * （口径 2 的那道快判）。
 *
 * 它是**按盒子**算的，不是按整份文件算的——早期那一版写在全局，实测立刻打出一个难看的改道：
 * 十万行的文件中间改了 2500 行，全局下界越线，于是整份文件按"删十万行 + 增十万行"给出，
 * 页面上本该看到的是"中间那一块降级、其余照旧逐行对上"。搬进分治的盒子之后两种形状都对了：
 * 两份真不相干的文件在顶层盒子（裁完前后缀就是整份）照样一眼看穿、立刻降级，局部越线只降级局部。
 * @param {string[]} ka a 侧键序列
 * @param {number} aLo 盒子起点（绝对下标）
 * @param {number} aHi 盒子终点（开区间）
 * @param {string[]} kb b 侧键序列
 * @param {number} bLo
 * @param {number} bHi
 * @returns {number}
 */
function matchCap(ka, aLo, aHi, kb, bLo, bHi) {
  const pool = new Map();
  for (let j = bLo; j < bHi; j++) pool.set(kb[j], (pool.get(kb[j]) || 0) + 1);
  let hit = 0;
  for (let i = aLo; i < aHi; i++) {
    const left = pool.get(ka[i]);
    if (left > 0) { pool.set(ka[i], left - 1); hit += 1; }
  }
  return hit;
}

/**
 * 通用序列对齐引擎：行级与 token 级共用这一本。
 *
 * `a`/`b` 传的是**已经键化好的序列**（行级传 `compareKey` 的结果，token 级传 token 的 `key`），
 * `equals` 是这一本唯一允许的判等出口；`keyOf` 只服务于 `matchCap` 那道快判，默认按值本身取。
 * 这样"归一化只进键、原文只出来"这件事（口径 1）在实现上就只剩一条路可走。
 * @param {string[]} a 原序列
 * @param {string[]} b
 * @param {(x: string, y: string) => boolean} equals 必须是等价关系（自反、对称、传递），`matchCap` 靠它
 * @param {number} [maxCost] 编辑距离上限，越线返回降级形状
 * @param {(v: string) => string|null} [keyOf] `matchCap` 用的键取值器；返回 `null` 表示这一档不做快判
 * @returns {{ops: Array<{op: 'equal'|'del'|'ins', a: number, aLen: number, b: number, bLen: number}>, cost: number, degraded: boolean}}
 */
export function diffSeq(a, b, equals, maxCost = MAX_COST, keyOf = (v) => v) {
  const at = 'diffSeq(a, b, equals, maxCost, keyOf)';
  if (!Array.isArray(a)) throw new TypeError(`${at}：a 必须是数组，这里是 ${typeName(a)}`);
  if (!Array.isArray(b)) throw new TypeError(`${at}：b 必须是数组，这里是 ${typeName(b)}`);
  if (typeof equals !== 'function') throw new TypeError(`${at}：equals 必须是函数，这里是 ${typeName(equals)}`);
  if (!Number.isInteger(maxCost) || maxCost < 1) {
    throw new TypeError(`${at}：maxCost 必须是 ≥1 的整数，这里是 ${String(maxCost)}`);
  }
  const n = a.length;
  const m = b.length;
  // 快判用的键序列只在两侧都还长的时候才建（短样本进 Myers 本就几微秒，按盒子建哈希反倒更贵）；
  // 任何一格取不出字符串键就整本放弃快判——**判等永远只走 `equals` 那一本**，这一格不参与其中。
  let keys = null;
  if (n > 64 && m > 64 && typeof keyOf === 'function') {
    const ka = new Array(n);
    const kb = new Array(m);
    let ok = true;
    for (let i = 0; i < n; i++) { const k = keyOf(a[i]); if (k === null || typeof k !== 'string') { ok = false; break; } ka[i] = k; }
    if (ok) {
      for (let j = 0; j < m; j++) { const k = keyOf(b[j]); if (k === null || typeof k !== 'string') { ok = false; break; } kb[j] = k; }
    }
    if (ok) keys = { ka, kb };
  }
  const raw = [];
  let degraded = false;
  if (n === 0 && m === 0) raw.push({ op: 'equal', a: 0, aLen: 0, b: 0, bLen: 0 });
  else degraded = walk((i, j) => equals(a[i], b[j]), n, m, 0, 0, maxCost, raw, keys);
  const ops = mergeRuns(raw);
  let cost = 0;
  for (const o of ops) cost += o.op === 'del' ? o.aLen : o.op === 'ins' ? o.bLen : 0;
  return { ops, cost, degraded };
}

// ── 段（segment）：ops 与页面行之间的唯一换算 ────────────────────────────────

/**
 * 把 `ops` 折成"显示段"清单：`equal` 段与 `run` 段交替，`run` 段带成对数与余下的删/增数。
 *
 * 这一格是口径 4 的实现点：**"改 K 处"、`hunksOf` 的 `change` 行、`unifiedText` 的内容行、
 * 以及折叠条的计数四件事必须来自同一次配对**。配对规则只有一句——一段里 `pairs = min(删, 增)`，
 * 先按序配对成 `change`，剩下的才单独成 `del` 或 `ins` 行。
 * @param {object[]} ops `diffSeq` 那种（已经 `mergeRuns` 过）
 * @returns {Array<{kind: 'equal', a: number, b: number, len: number}|{kind: 'run', a: number, b: number, del: number, ins: number, pairs: number}>}
 */
function segmentsOf(ops) {
  const segs = [];
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    if (o.op === 'equal') { segs.push({ kind: 'equal', a: o.a, b: o.b, len: o.aLen }); continue; }
    const del = o.op === 'del' ? o.aLen : 0;
    const next = ops[i + 1];
    const ins = o.op === 'del' && next && next.op === 'ins' ? next.bLen : 0;
    const bStart = o.op === 'del' ? (next && next.op === 'ins' ? next.b : o.b) : o.b;
    const aStart = o.a;
    if (o.op === 'ins') {
      segs.push({ kind: 'run', a: aStart, b: bStart, del: 0, ins: o.bLen, pairs: 0 });
    } else {
      segs.push({ kind: 'run', a: aStart, b: bStart, del, ins, pairs: Math.min(del, ins) });
      if (ins > 0) i += 1;
    }
  }
  return segs;
}

/**
 * 一条显示行的形状（`hunksOf` 产出的就是它，视图层只认这些字段）。
 * `a`/`b` 是**从 0 起**的行号（视图层加 1 再画），另一侧没有对应行时为 `null`。
 * @param {string} kind
 * @param {number|null} a
 * @param {number|null} b
 * @param {object} side a 侧 `splitLines` 结果
 * @param {object} bside b 侧 `splitLines` 结果
 * @param {Array<{t: string, text: string}>|null} [inline]
 * @returns {object}
 */
function rowOf(kind, a, b, side, bside, inline = null) {
  return {
    kind,
    a,
    b,
    textA: a === null ? '' : side.lines[a],
    textB: b === null ? '' : bside.lines[b],
    inline,
    crlfA: a === null ? false : !!side.crlf[a],
    crlfB: b === null ? false : !!bside.crlf[b],
  };
}

/**
 * 把一个 `run` 段摊成显示行（`hunksOf` 与统计都调它，配对规则因此只有一份）。
 * @param {object} seg `segmentsOf` 里的 run 段
 * @param {object} side
 * @param {object} bside
 * @param {(ai: number, bi: number) => Array<{t: string, text: string}>|null} inlineOf
 * @returns {object[]}
 */
function rowsOfRun(seg, side, bside, inlineOf) {
  const out = [];
  for (let p = 0; p < seg.pairs; p++) {
    out.push(rowOf('change', seg.a + p, seg.b + p, side, bside, inlineOf(seg.a + p, seg.b + p)));
  }
  for (let p = seg.pairs; p < seg.del; p++) out.push(rowOf('del', seg.a + p, null, side, bside));
  for (let p = seg.pairs; p < seg.ins; p++) out.push(rowOf('ins', null, seg.b + p, side, bside));
  return out;
}

// ── 主入口 ───────────────────────────────────────────────────────────────────

/**
 * 输入闸门：按侧各判一次（不合起来判——那会让"一侧塞满、一侧空着"整页不可用，spec §5.6 第 1 条）。
 * `which` 说清是 a / b / both，`over` 给的是**超出的差额**（没超的那一格是 0），
 * 页面上那句"超出 N 字节"直接从它出，不另数一遍。
 *
 * 两档先后是定死的：先字节、后行数。同一侧两档都超时报字节——那一档量纲更大，也更需要用户动手删。
 * @param {string} textA
 * @param {string} textB
 * @returns {{ok: boolean, which: ('a'|'b'|'both'|null), reason: ('bytes'|'lines'|null),
 *   over: {bytesA: number, bytesB: number, linesA: number, linesB: number}, a: object, b: object}}
 */
export function gate(textA, textB) {
  const at = 'gate(textA, textB)';
  if (typeof textA !== 'string') throw new TypeError(`${at}：textA 必须是字符串，这里是 ${typeName(textA)}`);
  if (typeof textB !== 'string') throw new TypeError(`${at}：textB 必须是字符串，这里是 ${typeName(textB)}`);
  const a = splitLines(textA);
  const b = splitLines(textB);
  const over = {
    bytesA: Math.max(0, a.bytes - MAX_INPUT_BYTES),
    bytesB: Math.max(0, b.bytes - MAX_INPUT_BYTES),
    linesA: Math.max(0, a.count - MAX_INPUT_LINES),
    linesB: Math.max(0, b.count - MAX_INPUT_LINES),
  };
  const bytesBad = over.bytesA > 0 || over.bytesB > 0;
  const linesBad = over.linesA > 0 || over.linesB > 0;
  if (!bytesBad && !linesBad) return { ok: true, which: null, reason: null, over, a, b };
  const reason = bytesBad ? 'bytes' : 'lines';
  const hitA = reason === 'bytes' ? over.bytesA > 0 : over.linesA > 0;
  const hitB = reason === 'bytes' ? over.bytesB > 0 : over.linesB > 0;
  const which = hitA && hitB ? 'both' : hitA ? 'a' : 'b';
  return { ok: false, which, reason, over, a, b };
}

/** 闸门不过时那一档的统计形状：七个数全 0，而不是"没有这一格"（视图层可以直接摊进读数行） */
function emptyStats() {
  return { added: 0, removed: 0, changed: 0, unchanged: 0, blocks: 0, inlineSkipped: 0, ignored: 0 };
}

/**
 * 这一页的主入口：拆行 → 闸门 → 对齐 → 配对 → 行内细化 → 统计。
 *
 * 统计量的逐格定义（X18）：`added` = 只在 b 侧出现的行数（所有 `ins` 段与 run 段余下的增），
 * `removed` = 只在 a 侧出现的行，`changed` = 成对配上的 `change` 行数，`unchanged` = 完全对上的行数，
 * `blocks` = 极大非等段个数（一段里既删又增只算**一块**）。自洽关系：`added ≥ changed`、
 * `removed ≥ changed`、`blocks ≤ 非等段总数`，且 `unchanged + removed === a.count`、
 * `unchanged + added === b.count`。
 * @param {string} textA 左侧全文
 * @param {string} textB 右侧全文
 * @param {{ws?: boolean, case?: boolean}} [opts] 归一化开关（只影响判等，见口径 1）
 * @returns {object} `{a, b, ops, segments, stats, cost, degraded, opts, verdict, blocked}`
 */
export function diffLines(textA, textB, opts) {
  const at = 'diffLines(textA, textB, opts)';
  const o = normOpts(opts, at);
  const g = gate(needText(textA, `${at}：textA`), needText(textB, `${at}：textB`));
  if (!g.ok) {
    return {
      a: g.a, b: g.b, ops: [], segments: [], stats: emptyStats(), cost: 0, degraded: false,
      opts: o, verdict: 'blocked', blocked: { which: g.which, reason: g.reason, over: g.over },
      // 空表也要给：视图层拿 `inlineByKey` 是无条件的，"闸门那一档少一个键"会让它在最不该出错的
      // 那一条路径上 `undefined.size`（与 `emptyStats()` 同一个道理——形状相同、值全空）。
      inlineByKey: new Map(),
    };
  }
  const a = g.a;
  const b = g.b;
  const keyOf = (line, crlf) => compareKey(line, { ws: o.ws, case: o.case, crlf });
  const al = a.lines.map((l, i) => keyOf(l, a.crlf[i]));
  const bl = b.lines.map((l, i) => keyOf(l, b.crlf[i]));
  const r = diffSeq(al, bl, (x, y) => x === y, MAX_COST, (v) => v);
  const segments = segmentsOf(r.ops);

  /** 行内细化：同一对行的 token 结果只算一次，`hunksOf` 之后从这张表里拿 */
  const inlineByKey = new Map();
  // `inlineDiff` 那一层的 opts **不认 `crlf`**（行内拿的是行内容，行尾形状在行级已经判过等了），
  // 所以不能把上面那份规范化结果原样递下去——`normOpts` 对未知键一律判红，这正是它该有的样子。
  const inlineOpts = { ws: o.ws, case: o.case };
  let inlineSkipped = 0;
  let inlineWork = 0;
  let changed = 0;
  for (const seg of segments) {
    if (seg.kind !== 'run') continue;
    changed += seg.pairs;
    for (let p = 0; p < seg.pairs; p++) {
      const ai = seg.a + p;
      const bi = seg.b + p;
      const la = a.lines[ai];
      const lb = b.lines[bi];
      // 三道闸门各管一件事，顺序是"越便宜的越靠前"：
      // ① 切分那一刀先拦一道，记的是 `min(字符数, MAX_INLINE_TOKENS)`：`tokenize` 带 limit，
      //    一侧最多切到四千零一枚就收手，中文那种"一行一个码点一枚"的形状下这两个数几乎相等。
      //    它记的不是**总账**——所有改动行的字符数之和本来就被字节闸门按两侧各 5 MiB 框死了，
      //    长空白串那种"一枚 token 吃掉一百万字符"的偏松在这里也翻不了船（最坏就是那一本 10 MB 的扫描）。
      //    真正没被字节闸门框住的是 ③（`Σ D²` 可以随行对数一直涨），所以这一格只是顺手把切分的钱也记上，
      //    让"十万行逐行改"那种输入不至于把预算全花在切分上、一对都对不完。
      // ② 单对形状闸门 `MAX_INLINE_TOKENS`（X17）。
      // ③ 对齐那一份按 `inlineWorkOf` 记账，装不下就跳过这一对、继续看下一对（不是"后面全掐"）。
      //    公共前后缀因此要裁两遍（一遍记账、一遍真对齐）——O(token 数) 的重复，比把偏移算错的代价小得多。
      // 三处都按文档顺序判，同一份输入两次逐格相同（X28）；② ③ 拦下的那一对，① 的账也已经付过了，
      // 照记——它确实花了钱，只是没花出结果。
      const scan = Math.min(la.length, MAX_INLINE_TOKENS) + Math.min(lb.length, MAX_INLINE_TOKENS);
      if (inlineWork + scan > MAX_INLINE_WORK) { inlineSkipped += 1; continue; }
      inlineWork += scan;
      const t = tokensForPair(la, lb, inlineOpts);
      if (t === null) { inlineSkipped += 1; continue; }
      const work = inlineWorkOf(t.a, t.b);
      if (inlineWork + work > MAX_INLINE_WORK) { inlineSkipped += 1; continue; }
      inlineWork += work;
      inlineByKey.set(`${ai}:${bi}`, inlineFromTokens(t.a, t.b));
    }
  }
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  let ignored = 0;
  let blocks = 0;
  for (const seg of segments) {
    if (seg.kind === 'equal') {
      unchanged += seg.len;
      for (let i = 0; i < seg.len; i++) {
        const ai = seg.a + i;
        const bi = seg.b + i;
        if (a.lines[ai] !== b.lines[bi] || a.crlf[ai] !== b.crlf[bi]) ignored += 1;
      }
      continue;
    }
    blocks += 1;
    added += seg.ins;
    removed += seg.del;
  }
  const stats = { added, removed, changed, unchanged, blocks, inlineSkipped, ignored };
  return {
    a, b, ops: r.ops, segments, stats, cost: r.cost, degraded: r.degraded, opts: o,
    verdict: added === 0 && removed === 0 ? 'same' : 'diff',
    blocked: null,
    inlineByKey,
  };
}

/** `gate` 之上的入参形状关：非字符串一律 `TypeError` 点名（X26） */
function needText(v, name) {
  if (typeof v !== 'string') throw new TypeError(`${name} 必须是字符串，这里是 ${typeName(v)}`);
  return v;
}

/**
 * 切好一对行的 token，并把**形状闸门**（`MAX_INLINE_TOKENS`）判掉：过线返回 `null`。
 *
 * 单侧切完就立刻判一次，是为了不为一行 5 MiB 的样本建一张百万项的表——一侧越线，两侧之和必然越线。
 * @param {string} lineA
 * @param {string} lineB
 * @param {{ws?: boolean, case?: boolean}} o 已经过 `normOpts` 的那一份
 * @returns {{a: {text: string, key: string}[], b: {text: string, key: string}[]}|null}
 */
function tokensForPair(lineA, lineB, o) {
  const a = tokenize(lineA, o, MAX_INLINE_TOKENS);
  if (a === null) return null;
  const b = tokenize(lineB, o, MAX_INLINE_TOKENS);
  if (b === null) return null;
  if (a.length + b.length > MAX_INLINE_TOKENS) return null;
  return { a, b };
}

/**
 * 一对行做行内细化，**对齐那一份**要花多少格子（字符那一份由调用方按 `lineA.length + lineB.length`
 * 加进同一本账）。口径是 `4 × min(两侧裁掉公共前后缀之后余下的 token 数之和, MAX_COST)²`：
 * 前后缀一裁，余下的就是真在变的区段，而 Myers 的格子数按 `4D²` 量级走（`MAX_COST` 那一段推导）、
 * `D` 不会超过余下的 token 数；`D` 一旦越线走的是 O(n) 的降级快判，所以夹在 `MAX_COST` 才是对的账。
 * 交错改动会把这个数估大约四倍，宁可高估——预算不是账单。
 * @param {{text: string, key: string}[]} ta
 * @param {{text: string, key: string}[]} tb
 * @returns {number}
 */
function inlineWorkOf(ta, tb) {
  let lo = 0;
  const n = ta.length;
  const m = tb.length;
  while (lo < n && lo < m && ta[lo].key === tb[lo].key) lo += 1;
  let hi = 0;
  while (hi < n - lo && hi < m - lo && ta[n - 1 - hi].key === tb[m - 1 - hi].key) hi += 1;
  let rest = n - lo - hi + (m - lo - hi);
  if (rest > MAX_COST) rest = MAX_COST;
  return 4 * rest * rest;
}

/**
 * 拿到**已经切好**的两侧 token，对齐并折成着色片段。
 *
 * 拆出来只为了一件事：`diffLines` 要先知道"这一对花多少格"才能决定要不要花，而 token 数得切完才知道。
 * 两处各写一遍对齐，就回到 X4 第一轮抓到的那种"两遍里有一遍是错的"。闸门都在调用方：
 * 形状那道在 `tokensForPair`，预算那道在 `diffLines`——这一本里不做任何判定。
 * @param {{text: string, key: string}[]} ta
 * @param {{text: string, key: string}[]} tb
 * @returns {Array<{t: 'equal'|'del'|'ins', text: string}>}
 */
function inlineFromTokens(ta, tb) {
  const r = diffSeq(ta.map((x) => x.key), tb.map((x) => x.key), (x, y) => x === y, MAX_COST, (v) => v);
  const out = [];
  const push = (t, text) => {
    if (text === '') return;
    const last = out[out.length - 1];
    if (last && last.t === t) last.text += text;
    else out.push({ t, text });
  };
  for (const op of r.ops) {
    if (op.op === 'equal') for (let i = 0; i < op.aLen; i++) push('equal', ta[op.a + i].text);
    else if (op.op === 'del') for (let i = 0; i < op.aLen; i++) push('del', ta[op.a + i].text);
    else for (let i = 0; i < op.bLen; i++) push('ins', tb[op.b + i].text);
  }
  return out;
}

/**
 * 行内细化：对一对行做 token 级对齐，产出给两栏各自着色的片段序列。
 *
 * 越线（两侧 token 数之和 > `MAX_INLINE_TOKENS`）时返回 `null`——那一对的整行着色由视图层兜，
 * `stats.inlineSkipped` 由 `diffLines` 计数（X17）。返回的片段合并过相邻同类，所以
 * `[equal, del, equal, del]` 在页面上是四段，而不是一个 token 一个 `<span>`。
 *
 * 这一本只管**单对**的形状闸门；整页的总量预算（`MAX_INLINE_WORK`）在 `diffLines` 那一层，
 * 因为"已经花掉多少"是跨行对的状态，塞进这里就成了隐式的全局可变量。
 * @param {string} lineA
 * @param {string} lineB
 * @param {{ws?: boolean, case?: boolean}} [opts]
 * @returns {Array<{t: 'equal'|'del'|'ins', text: string}>|null}
 */
export function inlineDiff(lineA, lineB, opts) {
  const at = 'inlineDiff(lineA, lineB, opts)';
  if (typeof lineA !== 'string') throw new TypeError(`${at}：lineA 必须是字符串，这里是 ${typeName(lineA)}`);
  if (typeof lineB !== 'string') throw new TypeError(`${at}：lineB 必须是字符串，这里是 ${typeName(lineB)}`);
  const t = tokensForPair(lineA, lineB, normOpts(opts, at));
  if (t === null) return null;
  return inlineFromTokens(t.a, t.b);
}

// ── 折叠 ─────────────────────────────────────────────────────────────────────

/**
 * 折叠成显示用的块。`context` 是**每个块首尾各保留多少行相同上下文**，`Infinity` 就是全展开。
 *
 * 三格的形状（X20、X22 钉的就是这几条）：
 * - `aFrom/aTo` 与 `bFrom/bTo` 是**左闭右开**的下标区间，包含本块显示出来的上下文行；
 *   一块里全是另一侧的行时（纯插入），这一侧的区间是空区间（`aFrom === aTo`，落点在插入发生处）。
 * - `skipped` 数的是"上一块之后、这一块之前被折掉多少行"，第一块恒为 0。
 * - 末块之后的尾巴记在最后一块的 `tailSkipped` 上（视图层据此决定要不要再画一条尾折叠条），
 *   它不是第二块的 `skipped`——那一格会让"两块"凭空多出来。
 *
 * 相邻两个差异段之间的相同行 ≤ `2 × context` 时**合成一块**（中间的行全展示，`skipped` 为 0）：
 * 否则页面上会出现两条折叠条之间夹三行相同内容那种没人看得懂的形状。
 * @param {object} result `diffLines` 的返回值
 * @param {number} [context]
 * @returns {{aFrom: number, aTo: number, bFrom: number, bTo: number, skipped: number, tailSkipped: number, rows: object[]}[]}
 */
export function hunksOf(result, context = DEFAULT_CONTEXT) {
  const at = 'hunksOf(result, context)';
  if (!result || typeof result !== 'object' || !Array.isArray(result.ops)) {
    throw new TypeError(`${at}：result 必须是 diffLines 的返回值，这里是 ${typeName(result)}`);
  }
  if (typeof context !== 'number' || Number.isNaN(context)) {
    throw new TypeError(`${at}：context 必须是数字（想全展开请传 Infinity），这里是 ${String(context)}`);
  }
  if (context !== Infinity && (!Number.isInteger(context) || context < 0)) {
    throw new TypeError(`${at}：context 必须是 ≥0 的整数或 Infinity，这里是 ${String(context)}`);
  }
  if (result.verdict === 'blocked') return [];
  const a = result.a;
  const b = result.b;
  const segments = Array.isArray(result.segments) && result.segments.length > 0
    ? result.segments : segmentsOf(result.ops);
  const inlineOf = (ai, bi) => {
    const m = result.inlineByKey;
    if (m && m.has(`${ai}:${bi}`)) return m.get(`${ai}:${bi}`);
    return null;
  };
  // 1) 段先摊成"显示行游程"，每段记住它在虚拟行流里的起止
  const streams = [];
  let cursor = 0;
  for (const seg of segments) {
    if (seg.kind === 'equal') {
      if (seg.len > 0) { streams.push({ seg, from: cursor, to: cursor + seg.len }); cursor += seg.len; }
    } else {
      const n = Math.max(seg.pairs, 0) + Math.max(seg.del - seg.pairs, 0) + Math.max(seg.ins - seg.pairs, 0);
      if (n > 0) { streams.push({ seg, from: cursor, to: cursor + n }); cursor += n; }
    }
  }
  const total = cursor;
  if (total === 0) return [];
  // 2) 按 context 把相邻 run 段并块，并算出每块在虚拟行流里的起止
  const runs = streams.filter((s) => s.seg.kind === 'run');
  if (runs.length === 0) return [];
  const groups = [];
  for (const s of runs) {
    const lo = context === Infinity ? 0 : s.from - context;
    const hi = context === Infinity ? total : s.to + context;
    const last = groups[groups.length - 1];
    if (last && lo <= last.hi) { last.lo = Math.min(last.lo, lo); last.hi = Math.max(last.hi, hi); last.items.push(s); }
    else groups.push({ lo, hi, items: [s] });
  }
  for (const g of groups) {
    g.lo = Math.max(0, g.lo);
    g.hi = Math.min(total, g.hi);
  }
  // 3) 每块按虚拟行流取回落在其中的段，裁头尾后摊成行
  const out = [];
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const prevHi = gi === 0 ? 0 : groups[gi - 1].hi;
    const rows = [];
    for (const s of streams) {
      if (s.to <= g.lo || s.from >= g.hi) continue;
      const cutFrom = Math.max(s.from, g.lo);
      const cutTo = Math.min(s.to, g.hi);
      const offFrom = cutFrom - s.from;
      const offTo = cutTo - s.from;
      if (s.seg.kind === 'equal') {
        for (let k = offFrom; k < offTo; k++) rows.push(rowOf('equal', s.seg.a + k, s.seg.b + k, a, b));
      } else {
        const all = rowsOfRun(s.seg, a, b, inlineOf);
        for (let k = offFrom; k < offTo; k++) rows.push(all[k]);
      }
    }
    let aFrom = Infinity;
    let aTo = -Infinity;
    let bFrom = Infinity;
    let bTo = -Infinity;
    for (const r of rows) {
      if (r.a !== null) { aFrom = Math.min(aFrom, r.a); aTo = Math.max(aTo, r.a + 1); }
      if (r.b !== null) { bFrom = Math.min(bFrom, r.b); bTo = Math.max(bTo, r.b + 1); }
    }
    if (aFrom > aTo) { const p = anchorOf(streams, g.lo, 'a', a); aFrom = p; aTo = p; }
    if (bFrom > bTo) { const p = anchorOf(streams, g.lo, 'b', b); bFrom = p; bTo = p; }
    out.push({ aFrom, aTo, bFrom, bTo, skipped: g.lo - prevHi, tailSkipped: 0, rows });
  }
  out[out.length - 1].tailSkipped = total - groups[groups.length - 1].hi;
  return out;
}

/**
 * 一块里只有另一侧的行时，本侧的区间取"这里发生了什么"的落点（空区间 `[p, p)`）。
 * 拿虚拟流上第一个 ≥ `lo` 的段来定落点：那是用户看到这一块的第一个上下文位置，
 * 比"文件末尾"这种凭空造出来的数字可读。
 * @param {object[]} streams
 * @param {number} lo
 * @param {'a'|'b'} side
 * @param {object} s 那一侧的 `splitLines` 结果
 * @returns {number}
 */
function anchorOf(streams, lo, side, s) {
  for (const st of streams) {
    if (st.to <= lo) continue;
    const k = Math.max(0, lo - st.from);
    const idx = side === 'a' ? st.seg.a + k : st.seg.b + k;
    return Math.min(idx, s.count);
  }
  return s.count;
}

// ── unified 形状 ─────────────────────────────────────────────────────────────

/**
 * unified 形状的差异文本：复制与下载走同一串，页面上那一栏也是它。
 *
 * `@@ -a,b +c,d @@` 的**单行区间不省略 `,1`**（§0.6 第二行登记的那条偏差：省略是 git 的排版偏好，
 * 不是格式的必要部分，而本站的自证判据要逐字符对照）。行尾的 `\r` 原样写出（X25）；末行缺换行符
 * 补 `\ No newline at end of file`——那一行是 git 的形状，也是这一页唯一说得清"这里少一个换行"的写法。
 * 上下文行（`kind:'equal'`）的行尾形状取 a 侧：两侧到这里已经判等，那一格差别只在勾了归一化时才可能存在。
 * @param {object} result `diffLines` 的返回值
 * @param {{a?: string, b?: string, context?: number}} [names] 两名与上下文档
 * @returns {string} 闸门不过时给空串（那一档页面上没有可复制的结果）
 */
export function unifiedText(result, names = {}) {
  const at = 'unifiedText(result, names)';
  if (!result || typeof result !== 'object' || !Array.isArray(result.ops)) {
    throw new TypeError(`${at}：result 必须是 diffLines 的返回值，这里是 ${typeName(result)}`);
  }
  if (names === null || typeof names !== 'object' || Array.isArray(names)) {
    throw new TypeError(`${at}：names 必须是对象，这里是 ${typeName(names)}`);
  }
  if (result.verdict === 'blocked') return '';
  const nameA = typeof names.a === 'string' && names.a !== '' ? names.a : 'A';
  const nameB = typeof names.b === 'string' && names.b !== '' ? names.b : 'B';
  const context = names.context === undefined ? DEFAULT_CONTEXT : names.context;
  const hunks = hunksOf(result, context);
  const out = [`--- ${nameA}\n`, `+++ ${nameB}\n`];
  const a = result.a;
  const b = result.b;
  for (const h of hunks) {
    out.push(`@@ -${h.aFrom + 1},${h.aTo - h.aFrom} +${h.bFrom + 1},${h.bTo - h.bFrom} @@\n`);
    for (const r of h.rows) {
      const emits = r.kind === 'change'
        ? [['-', r.textA, r.a, r.crlfA], ['+', r.textB, r.b, r.crlfB]]
        : r.kind === 'del' ? [['-', r.textA, r.a, r.crlfA]]
          : r.kind === 'ins' ? [['+', r.textB, r.b, r.crlfB]]
            : [[' ', r.textA, r.a, r.crlfA]];
      let marker = false;
      for (const [mark, text, idx, crlf] of emits) {
        out.push(`${mark}${text}${crlf ? '\r' : ''}\n`);
        const lastA = mark !== '+' && idx === a.count - 1 && !a.finalNewline;
        const lastB = mark !== '-' && idx === b.count - 1 && !b.finalNewline;
        if (lastA || lastB) marker = true;
      }
      if (marker) out.push('\\ No newline at end of file\n');
    }
  }
  return out.join('');
}

// ── 面板上那六句人话 ─────────────────────────────────────────────────────────

/**
 * 六句说明，每句对应一个**用户看得见却容易被当成坏了**的形状。文案写在这一本里而不是视图层，
 * 是为了让 §X 能直接判"这一句非空、且说的是那一档"，§Z 再判"它原样出现在渲染结果里"。
 * 数字一律从常量插，不在文案里手抄第二遍（`MAX_COST` 改了而句子没改，是这一族最难发现的一类漂移）。
 */
export const DIFF_NOTES = {
  degraded: `两份内容有相当一段对不上（编辑距离超过 ${MAX_COST} 的上限）：那一段按"整块删除 + 整块新增"给出，行数一行不会少，只是不再替你把最相似的行两两配对。`,
  inlineSkipped: `部分改动行只按整行着色、不做行内逐字高亮（单对行超过 ${MAX_INLINE_TOKENS} 个 token，或行内细化那份 ${MAX_INLINE_WORK} 格的预算已按顺序分完）：行数与差异本身不受影响。`,
  ignored: '勾了忽略空白或忽略大小写之后，"相同"是被归一化过的结论：这些行的原文仍然有差别，只是没有计入差异统计。',
  gitApply: '这一段是按阅读习惯排的 unified 形状文本，不承诺能被 git apply 接住——本站不校验上下文行与文件头，也不生成可打的补丁。',
  noUpload: '文件在浏览器本地读取，输入不出本机：没有上传，也没有任何网络请求。',
  finalNewline: `某一侧的末行没有换行符，这里按"缺一个换行"单独报出来（行尾的回车符显示为 ${CR_GLYPH}）。`,
};
```

#### `scripts/toolkit-tests.mjs` §X（整节，从 `// ── §X` 那一行到本节末）

判据表那 29 行写的是"咬哪一件事"，这一节是**咬下去的那颗牙**：X4 的朴素 LCS 尺子、X5 的三条不变式、
X29 的预算样本，全都在这一块里逐字钉住。它与上面那块镜像是一对——实现改了而判据没改，
红的是门禁①；判据改了而计划没改，红的是门禁②。

```js
// ── §X 行级与 token 级对齐引擎（`tools/diff-core.js`，段 5 Task 2）─────────────
// 这一族只钉一件事：**对齐的结论必须最短、而展示的必须还是原文**。
// 口径写死在这里，实现不许自创第二套：
//   · 断行只认 `\n`，行尾那个 `\r` 剥出来记进 `crlf[]`，行内的 `\r` 是正文（X1）；
//   · 空串是**零行**、一枚 `\n` 是**一行空行**，两档并成一条的话空文件比空文件会报出非零增删（X1）；
//   · 归一化（`ws` / `case`）只进**比较键**，行号、`textA/textB`、`unifiedText` 一律是原文（X6）；
//   · `ws` 是"并成空格"不是"删掉空白"，所以 `'ab'` 与 `'a b'` 必须判不同（X7）；
//   · 降级与退化都必须上页面，因为它们给出的编辑脚本比最短的**长**（X13、X14、X17、X29）；
//   · 配对规则只有一句 `pairs = min(删, 增)`，"改 K 处"、`change` 行、unified 内容行、折叠条四件事同源（X18）。
// 最短性不靠"看着对"：X4 拿测试侧自己写的朴素 LCS DP 对拍 200 组，X5 在同一批样本上逐组验 ops 三条不变式。
// `gate` 与 §S 那一本的 `gate` 同名（一个是按侧双输入、一个是单输入返回 {kind,message}），别名读；
// `MAX_INPUT_BYTES` / `MAX_INPUT_LINES` 在 §S 顶层已经占了名字，这里一律 `X_` 前缀，别互相盖掉。
const {
  MAX_INPUT_BYTES: X_BYTES, MAX_INPUT_LINES: X_LINES, MAX_COST: X_COST,
  MAX_INLINE_TOKENS: X_TOKENS, MAX_INLINE_WORK: X_WORK, DEFAULT_CONTEXT: X_CTX, CR_GLYPH: X_CR,
  splitLines: dSplit, compareKey: dKey, diffSeq: dSeq, gate: dGate, diffLines: dLines,
  inlineDiff: dInline, hunksOf: dHunks, unifiedText: dUnified, DIFF_NOTES: X_NOTES,
} = await import('../dev/js/tools/diff-core.js');

/** 固化种子（xorshift32）：X4/X5 那 200 组不能靠 `Math.random`，红第二次就得原样重放 */
const xRng = (seed = 20260930) => {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
};
/** 朴素 LCS 长度：编辑脚本长度的**对侧口径**（`cost = n + m − 2·LCS`），滚动数组够用就行 */
const xLcs = (a, b) => {
  const m = b.length;
  let prev = new Uint32Array(m + 1);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Uint32Array(m + 1);
    for (let j = 1; j <= m; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[m];
};
/**
 * ops 的三条不变式（X5）：① 文档顺序不回退 ② 段与段之间不留空洞也不重叠
 * ③ 两侧各自覆盖到末行。`equal` 两侧必须等长，否则 `rowsOfRun` 那套配对规则从源头就是假的。
 */
const xInvariants = (ops, n, m, tag) => {
  const errs = [];
  let pa = 0;
  let pb = 0;
  for (const o of ops) {
    if (o.op === 'equal' && o.aLen !== o.bLen) errs.push(`${tag}: equal 两侧不等长`);
    if (o.a < pa) errs.push(`${tag}: a 侧文档顺序倒退（${o.a} < ${pa}）`);
    if (o.b < pb) errs.push(`${tag}: b 侧文档顺序倒退（${o.b} < ${pb}）`);
    if (o.a + o.aLen > n) errs.push(`${tag}: a 侧越界 ${o.a}+${o.aLen}>${n}`);
    if (o.b + o.bLen > m) errs.push(`${tag}: b 侧越界 ${o.b}+${o.bLen}>${m}`);
    if (o.op === 'del' && o.a !== pa) errs.push(`${tag}: a 侧有空洞或重叠（del 起点 ${o.a}，期望 ${pa}）`);
    if (o.op === 'ins' && o.b !== pb) errs.push(`${tag}: b 侧有空洞或重叠（ins 起点 ${o.b}，期望 ${pb}）`);
    if (o.op === 'equal' && (o.a !== pa || o.b !== pb)) errs.push(`${tag}: equal 起点错位`);
    pa = o.a + o.aLen;
    pb = o.b + o.bLen;
  }
  if (pa !== n) errs.push(`${tag}: a 侧没覆盖到尾（${pa} != ${n}）`);
  if (pb !== m) errs.push(`${tag}: b 侧没覆盖到尾（${pb} != ${m}）`);
  return errs;
};
/** 把 ops 分别按两侧重建回原序列：这是"ops 就是这份输入的编辑脚本"最硬的一条自证 */
const xRebuild = (ops, a, b) => {
  let ra = '';
  let rb = '';
  for (const o of ops) {
    if (o.op !== 'ins') ra += a.slice(o.a, o.a + o.aLen).join('');
    if (o.op !== 'del') rb += b.slice(o.b, o.b + o.bLen).join('');
  }
  return [ra, rb];
};
/** 造 n 行样本：`tag` 里带上行号，保证"每行都独一无二"，前后缀裁剪才量得准 */
const xRows = (n, tag, from = 0) => Array.from({ length: n }, (_, i) => `${tag}${i + from}`);
const xJoin = (arr) => `${arr.join('\n')}\n`;

test('X1 splitLines 六档形状：空串 / 只有换行 / LF / CRLF / 行内裸 \\r / 末行无换行', () => {
  // 空串是零行，一枚 `\n` 是一行空行——并成一条的话"空文件 vs 空文件"会报出非零的增删
  assert.deepEqual(dSplit(''), { lines: [], count: 0, crlf: [], finalNewline: true, bytes: 0 });
  assert.deepEqual(dSplit('\n'), { lines: [''], count: 1, crlf: [false], finalNewline: true, bytes: 1 });
  assert.deepEqual(dSplit('a\nb\n'),
    { lines: ['a', 'b'], count: 2, crlf: [false, false], finalNewline: true, bytes: 4 });
  assert.deepEqual(dSplit('a\r\nb\r\n'),
    { lines: ['a', 'b'], count: 2, crlf: [true, true], finalNewline: true, bytes: 6 },
    'CRLF 只算一次断行，行内容里不留 \\r');
  assert.deepEqual(dSplit('a\rb\n'),
    { lines: ['a\rb'], count: 1, crlf: [false], finalNewline: true, bytes: 4 },
    '行内裸 \\r 是正文：只认 \\n，剥 \\r 只剥行尾那一枚。bytes 量的是**输入全文**（含行内 \\r 和行尾 \\n），闸门那一只尺');
  assert.deepEqual(dSplit('a\nb'),
    { lines: ['a', 'b'], count: 2, crlf: [false, false], finalNewline: false, bytes: 3 },
    '末行没有换行符要单独说得出，不许静默补一个');
  // 字节口径是 UTF-8：代理对算 4，与 §S 那一本同一把尺（闸门按字节判，量错一寸就放过 4 MiB）
  assert.equal(dSplit('😀\n').bytes, 5, '一枚 emoji 是 4 字节 UTF-8 + 换行 1');
  assert.equal(dSplit('中\n').bytes, 4);
  assert.equal(dSplit('\r\n').lines.length, 1, '只有 CRLF 也是一行空行');
  assert.equal(dSplit('\r\n').crlf[0], true);
  assert.equal(dSplit('a\n\nb\n').lines.join('|'), 'a||b', '中间那行空行不能丢');
});

test('X2 两侧同空：verdict same、ops 一条 equal、五个统计量全 0', () => {
  const r = dLines('', '');
  assert.equal(r.verdict, 'same');
  assert.equal(r.blocked, null);
  assert.equal(r.ops.length, 1, '两侧都空也给一条 equal，视图层不必为"零段"再开一档');
  assert.deepEqual(r.ops[0], { op: 'equal', a: 0, aLen: 0, b: 0, bLen: 0 });
  assert.deepEqual(r.stats, { added: 0, removed: 0, changed: 0, unchanged: 0, blocks: 0, inlineSkipped: 0, ignored: 0 });
  assert.equal(r.cost, 0);
  assert.equal(r.degraded, false);
  assert.equal(dHunks(r, 3).length, 0, '没有差异段就没有块');
  // 空 vs 非空那一档才是"增 N 行"，别和上面那格混成一件事
  const one = dLines('', 'a\n');
  assert.equal(one.verdict, 'diff');
  assert.deepEqual([one.stats.added, one.stats.removed, one.stats.changed], [1, 0, 0]);
  assert.deepEqual([one.a.count, one.b.count], [0, 1]);
});

test('X3 公共前后缀裁剪：50 行前缀与 30 行后缀原样成两条 equal', () => {
  const pre = xRows(50, 'p');
  const tail = xRows(30, 't');
  // 中段第一行两侧就不同（mid-1 对 mid-X），前缀才恰好裁到 50 那一格；
  // 尾行两侧唯一，后缀才恰好裁到 30——样本里留一格共同的行，这两条数字就都成了 51 / 31。
  const a = [...pre, 'mid-1', 'mid-2', 'mid-3', ...tail];
  const b = [...pre, 'mid-X', ...tail];
  const r = dSeq(a, b, (x, y) => x === y, X_COST);
  assert.equal(r.ops.length, 4, '法式：equal + 一条 del + 一条 ins + equal，中间那段不许再碎');
  assert.deepEqual(r.ops, [
    { op: 'equal', a: 0, aLen: 50, b: 0, bLen: 50 },
    { op: 'del', a: 50, aLen: 3, b: 50, bLen: 0 },
    { op: 'ins', a: 53, aLen: 0, b: 50, bLen: 1 },
    { op: 'equal', a: 53, aLen: 30, b: 51, bLen: 30 },
  ]);
  assert.equal(r.cost, 4, '删 3 行增 1 行 = 4，最短脚本就这么多');
  assert.equal(r.degraded, false);
  // 前后缀**都**没有的极端：整份重写，裁剪一步都不该生效
  const all = dSeq(xRows(40, 'a'), xRows(40, 'b'), (x, y) => x === y, X_COST);
  assert.equal(all.cost, 80);
  assert.equal(all.ops.length, 2, '整份重写就是一块 del + 一块 ins');
});

test('X4 最短性对拍：200 组小样本与朴素 LCS 逐组相等，不许多一格少一格', () => {
  const rnd = xRng();
  const alphas = [2, 3, 5, 8];
  const bad = [];
  for (let g = 0; g < 200; g++) {
    const alpha = alphas[g % alphas.length];
    const n = Math.floor(rnd() * 41);
    const m = Math.floor(rnd() * 41);
    const a = Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(rnd() * alpha)));
    const b = Array.from({ length: m }, () => String.fromCharCode(97 + Math.floor(rnd() * alpha)));
    const r = dSeq(a, b, (x, y) => x === y, 100000);
    const want = n + m - 2 * xLcs(a, b);
    // 上限给到 10 万 = 这一族根本不该降级：降了就是把最短脚本换成了"整块删 + 整块增"
    if (r.degraded) bad.push(`g${g}(n=${n},m=${m}): 不该降级`);
    if (r.cost > want) bad.push(`g${g}(n=${n},m=${n}): cost ${r.cost} > 最短 ${want}`);
    // 也不许"短于"最短：那说明 ops 少覆盖了行，对拍当场就该红
    if (r.cost < want) bad.push(`g${g}(n=${n},m=${m}): cost ${r.cost} < 最短 ${want}，等于凭空丢了行`);
  }
  assert.deepEqual(bad, [], `对拍 200 组，失败 ${bad.length} 项：\n${bad.slice(0, 8).join('\n')}`);
});

test('X5 ops 三条不变式在 X4 那 200 组上逐组成立，且两侧都能重建回原序列', () => {
  const rnd = xRng();
  const alphas = [2, 3, 5, 8];
  const bad = [];
  for (let g = 0; g < 200; g++) {
    const alpha = alphas[g % alphas.length];
    const n = Math.floor(rnd() * 41);
    const m = Math.floor(rnd() * 41);
    const a = Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(rnd() * alpha)));
    const b = Array.from({ length: m }, () => String.fromCharCode(97 + Math.floor(rnd() * alpha)));
    const r = dSeq(a, b, (x, y) => x === y, 100000);
    for (const e of xInvariants(r.ops, n, m, `g${g}(n=${n},m=${m})`)) bad.push(e);
    const [ra, rb] = xRebuild(r.ops, a, b);
    if (ra !== a.join('')) bad.push(`g${g}: a 侧重建不一致`);
    if (rb !== b.join('')) bad.push(`g${g}: b 侧重建不一致`);
    // `mergeRuns` 的法式：一段里只许"一条 del + 一条 ins"相邻，不许出现 ins 紧跟 ins
    for (let i = 1; i < r.ops.length; i++) {
      if (r.ops[i].op === 'ins' && r.ops[i - 1].op === 'ins') bad.push(`g${g}: 第 ${i} 条是连续两条 ins，没归一`);
      if (r.ops[i].op === 'del' && r.ops[i - 1].op === 'del') bad.push(`g${g}: 第 ${i} 条是连续两条 del，没归一`);
      if (r.ops[i].op === 'equal' && r.ops[i - 1].op === 'equal') bad.push(`g${g}: 第 ${i} 条是连续两条 equal，没归一`);
    }
  }
  assert.deepEqual(bad, [], `200 组的不变式检查失败 ${bad.length} 项：\n${bad.slice(0, 8).join('\n')}`);
});

test('X6 归一化只影响判等：ignored 那几行的 textA/textB 仍是原文、行号仍按原文', () => {
  // 第 2 行两侧原文不同（一个空格对两个空格），勾了 ws 才算相同；第 4 行是真改动。
  // 必须留一格真改动：全都判等就没有差异块，hunksOf 按设计返回空数组，"递原文"那一格反而没人验。
  const a = 'x\na b\ny\nZ\n';
  const b = 'x\na  b\ny\nQ\n';
  const on = dLines(a, b, { ws: true });
  assert.equal(on.verdict, 'diff');
  assert.equal(on.stats.ignored, 1, '被归一化抹平的那一行要计数，否则页面上那句"忽略过空白"没有着落');
  assert.equal(on.stats.changed, 1, '只有 Z→Q 那一格算改动');
  assert.equal(on.stats.unchanged, 3);
  assert.equal(dLines(a, b).stats.changed, 2, '不勾 ws，那两格都算改动');
  const rows = dHunks(on, X_CTX).flatMap((h) => h.rows);
  const flat = rows.find((r) => r.kind === 'equal' && r.textA !== r.textB);
  assert.ok(flat, '归一化只进比较键：hunksOf 递出来的还是原文');
  assert.equal(flat.textA, 'a b');
  assert.equal(flat.textB, 'a  b');
  assert.deepEqual([flat.a, flat.b], [1, 1], '行号按原文数，不许因为归一化就少一行');
  // 原文与行号同源第三条路：unified 文本里出现的也必须是原文那一格
  const uni = dUnified(on);
  assert.match(uni, / a b\n/, `上下文行写的是原文：${JSON.stringify(uni)}`);
  assert.equal(uni.includes('a  b'), false, '上下文行不许"顺手归一化"过再写出去');
});

test('X7 ws 档：并成空格算相同，删空白不等于把词也并掉', () => {
  assert.equal(dKey('a b', { ws: true }), dKey('a  b', { ws: true }), '连续空白并成一格');
  assert.equal(dKey(' x', { ws: true }), dKey('x', { ws: true }), '首尾空白去掉');
  assert.equal(dKey('\tx\t', { ws: true }), 'x', '制表符也是空白');
  assert.notEqual(dKey('ab', { ws: true }), dKey('a b', { ws: true }),
    "'ab' 与 'a b' 必须判不同：把空白全删掉会造出一批用户读不出来的'相同'");
  assert.equal(dKey('a b'), 'a b', '不勾就是原文');
  const r = dLines('foo 1\t2\n', 'foo 1 2\n', { ws: true });
  assert.equal(r.verdict, 'same');
  assert.equal(r.stats.ignored, 1);
  assert.equal(dLines('foo 1 2\n', 'foo1 2\n', { ws: true }).verdict, 'diff',
    '同一个口径在主入口那一层也得成立');
});

test('X8 case 档：Foo 与 foo 判相同，数字串不受影响', () => {
  assert.equal(dKey('Foo', { case: true }), 'foo');
  assert.equal(dKey('123', { case: true }), '123', 'toLowerCase 对数字是恒等，别把它写成"只改字母"的样子货');
  assert.notEqual(dKey('Foo'), dKey('foo'), '不勾就是两行');
  assert.equal(dKey('中', { case: true }), '中');
  // 两档同时勾：先后是定死的（先 ws 后 case），交错写出来就不是同一个键
  assert.equal(dKey('  Foo BAR ', { ws: true, case: true }), 'foo bar');
  const r = dLines('Foo\nbar\n', 'foo\nbar\n', { case: true });
  assert.equal(r.verdict, 'same');
  assert.equal(r.stats.ignored, 1);
  assert.equal(dLines('Foo\nbar\n', 'foo\nbar\n').verdict, 'diff');
  // 行内细化跟着同一把尺：勾了 case 就不该在行里再标一处"改动"
  assert.deepEqual(dInline('Foo bar', 'foo bar', { case: true }), [{ t: 'equal', text: 'Foo bar' }]);
  assert.deepEqual(dInline('Foo bar', 'foo bar', {}),
    [{ t: 'del', text: 'Foo' }, { t: 'ins', text: 'foo' }, { t: 'equal', text: ' bar' }]);
});

test('X9 CRLF：默认算差异且 crlfA/crlfB 说得清，勾了 ws 之后并入空白档不算', () => {
  const r = dLines('a\nb\n', 'a\r\nb\r\n');
  assert.equal(r.verdict, 'diff', '行尾形状也是内容：LF 文件对 CRLF 文件必须报差异');
  assert.deepEqual([r.stats.added, r.stats.removed], [2, 2]);
  const rows = dHunks(r, X_CTX).flatMap((h) => h.rows);
  const chg = rows.filter((x) => x.kind === 'change');
  assert.equal(chg.length, 2);
  assert.equal(chg[0].crlfA, false);
  assert.equal(chg[0].crlfB, true, '视图层拿这两格画 ␍，行号与原文都不受影响');
  assert.equal(chg[0].textB, 'a', '剥出来的 \\r 不在行内容里，只在 crlfB 那一格');
  const on = dLines('a\nb\n', 'a\r\nb\r\n', { ws: true });
  assert.equal(on.verdict, 'same', '勾了忽略空白之后行尾回车并进同一档，不再算差异');
  assert.equal(on.stats.ignored, 2, '"归一化抹平了几行"要数得出来，那句说明才有数字');
  assert.deepEqual(dKey('a', { crlf: true }), 'a\r', 'crlf 那一档是补上 \\r 再比，不是比较时特殊对待');
  assert.throws(() => dInline('a', 'b', { crlf: true }), TypeError,
    'inlineDiff 不认 crlf：行尾形状在行级已经判过等，这里递下去就是拼错的开关');
});

test('X10 末行缺换行符单独成档：finalNewline 两侧各一格，那句说明非空', () => {
  const r = dLines('a\nb', 'a\nb\n');
  assert.equal(r.a.finalNewline, false);
  assert.equal(r.b.finalNewline, true);
  assert.equal(r.verdict, 'same', '那一档不是"少一行"：行数相同、内容相同，缺的只是一个换行');
  assert.deepEqual([r.a.count, r.b.count], [2, 2]);
  assert.equal(typeof X_NOTES.finalNewline, 'string');
  assert.ok(X_NOTES.finalNewline.length > 0, '点亮时要用的那句话不许是空串');
  assert.ok(X_NOTES.finalNewline.includes(X_CR), `那句话要说清回车上屏长什么样：${X_NOTES.finalNewline}`);
  // 末行缺换行的两侧都是缺：那一档在 unified 里是 `\ No newline`，不是"两边都一样"就完事
  const both = dLines('a\nb', 'a\nb');
  assert.equal(both.verdict, 'same');
  assert.equal(both.a.finalNewline, false);
  assert.equal(both.b.finalNewline, false);
  assert.equal(both.stats.ignored, 0, '没勾归一化就没有"抹平"，这一格不许凭空非零');
});

// 闸门那一档要"真超线"才量得准：5 MiB + 7 字节，跟着常量拼，别手抄 5242880。
const X_HUGE = 'q'.repeat(X_BYTES + 7);
const X_TOO_MANY = 'a\n'.repeat(X_LINES + 3);

test('X11 gate 按侧拒：只 A 超字节 / 只 B 超字节 / 两侧都超 / 只 A 超行数，四种形状各自的 which 与 over', () => {
  const shape = (g) => ({ ok: g.ok, which: g.which, reason: g.reason, over: g.over });
  assert.deepEqual(shape(dGate('a\n', 'b\n')), {
    ok: true, which: null, reason: null, over: { bytesA: 0, bytesB: 0, linesA: 0, linesB: 0 },
  }, '没超线时四格差额都必须是 0，页面那句"超出 N"不许凭空报一个数');
  assert.deepEqual(shape(dGate(X_HUGE, 'b\n')), {
    ok: false, which: 'a', reason: 'bytes', over: { bytesA: 7, bytesB: 0, linesA: 0, linesB: 0 },
  }, '只 A 超字节：which 说的是 a，over 里也只有 bytesA 非零');
  assert.equal(shape(dGate('b\n', X_HUGE)).over.bytesB, 7, '换一侧超，报的就得换一侧');
  assert.deepEqual(shape(dGate(X_HUGE, X_HUGE)), {
    ok: false, which: 'both', reason: 'bytes', over: { bytesA: 7, bytesB: 7, linesA: 0, linesB: 0 },
  });
  const lines = shape(dGate(X_TOO_MANY, 'b\n'));
  assert.deepEqual([lines.ok, lines.which, lines.reason, lines.over.linesA], [false, 'a', 'lines', 3],
    '超行数那一档：量纲是行，不是字节');
  // 两档先后是定死的：先字节、后行数。同一侧都超时报字节，另一侧的差额仍留在表里。
  const mixed = shape(dGate(X_HUGE, X_TOO_MANY));
  assert.deepEqual([mixed.which, mixed.reason], ['a', 'bytes'], 'B 侧超行数排在字节之后，先说量纲大的那件');
  assert.deepEqual([mixed.over.bytesA, mixed.over.bytesB, mixed.over.linesA, mixed.over.linesB], [7, 0, 0, 3],
    '差额四格是同一本账：页面能一次说清"这侧超字节、那侧超行数"两处');
  // 按侧判而不是合计判：一侧塞满、一侧空着，合计口径会把整页拒掉（spec §5.6 第 1 条）
  const g = dGate(X_HUGE, 'b\n');
  assert.equal(g.a.count, 1, '闸门不过也得把两份拆行结果递出去，页面要报"你这侧多少行、多少字节"');
  assert.equal(g.b.bytes, 2);
  assert.equal(g.b.count, 1);
});

test('X12 拒时给差额，且闸门不过时 diffLines 不做任何对齐：verdict blocked、ops 空、形状照样齐', () => {
  const r = dLines(X_HUGE, 'b\n');
  assert.equal(r.verdict, 'blocked');
  assert.deepEqual(r.ops, [], '一行都不许对齐：那才是"闸门"，不是"建议"');
  assert.deepEqual(r.segments, []);
  assert.equal(r.cost, 0);
  assert.equal(r.degraded, false);
  assert.deepEqual(r.stats, { added: 0, removed: 0, changed: 0, unchanged: 0, blocks: 0, inlineSkipped: 0, ignored: 0 });
  assert.deepEqual(r.blocked, { which: 'a', reason: 'bytes', over: { bytesA: 7, bytesB: 0, linesA: 0, linesB: 0 } });
  assert.equal(r.a.bytes, X_BYTES + 7, '差额之外还要给实测值，那句"你这侧 5.0 MB"从它出');
  assert.ok(r.inlineByKey instanceof Map && r.inlineByKey.size === 0,
    '视图层拿 inlineByKey 是无条件的：闸门那一档少这一格就是 undefined.size');
  assert.deepEqual(dHunks(r, X_CTX), [], '没有对齐结果就没有块');
  assert.equal(dUnified(r), '', 'unified 那一栏在拒的那一档必须是空串，不是报错');
});

test('X13 MAX_COST 降级：中段整块 del + 整块 ins，两侧行数一行不少（降级不是截断）', () => {
  const midA = xRows(1200, 'A');
  const midB = xRows(900, 'B');
  const a = [...xRows(10, 'c'), ...midA, ...xRows(10, 't')];
  const b = [...xRows(10, 'c'), ...midB, ...xRows(10, 't')];
  const r = dSeq(a, b, (x, y) => x === y, X_COST);
  assert.equal(r.degraded, true, '中段 1200×900 全不相干，D 越了 MAX_COST 那一档');
  assert.deepEqual(r.ops.map((o) => `${o.op}:${o.a},${o.aLen},${o.b},${o.bLen}`), [
    'equal:0,10,0,10', 'del:10,1200,10,0', 'ins:1210,0,10,900', 'equal:1210,10,910,10',
  ], '降级只换掉那一段的配对方式：前后两段 equal 原样留着');
  assert.equal(r.cost, midA.length + midB.length);
  const [ra, rb] = xRebuild(r.ops, a, b);
  assert.equal(ra, a.join(''), '降级那一档也不许丢行');
  assert.equal(rb, b.join(''));
  const res = dLines(`${a.join('\n')}\n`, `${b.join('\n')}\n`);
  assert.equal(res.degraded, true);
  assert.equal(res.verdict, 'diff');
  assert.deepEqual([res.stats.removed, res.stats.added, res.stats.unchanged, res.stats.blocks], [1200, 900, 20, 1]);
  const rows = dHunks(res, Infinity).flatMap((h) => h.rows);
  assert.equal(rows.filter((x) => x.a !== null).length, res.a.count, 'a 侧 1220 行一行不少');
  assert.equal(rows.filter((x) => x.b !== null).length, res.b.count, 'b 侧 920 行同理');
});

test('X14 DIFF_NOTES.degraded 非空且带 MAX_COST 那个数，降级档的脚本不短于不降级档', () => {
  const rnd = xRng(20260931);
  const mk = (n, alpha) => Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(rnd() * alpha)));
  const a = mk(80, 4);
  const b = mk(70, 4);
  const capped = dSeq(a, b, (x, y) => x === y, 3);
  const free = dSeq(a, b, (x, y) => x === y, 1e9);
  assert.equal(capped.degraded, true);
  assert.equal(free.degraded, false);
  assert.ok(free.cost > 3, '这份样本必须真越得过那道闸门，否则两条走同一条路，这一判就成了空判');
  assert.ok(capped.cost >= free.cost, `降级给的是"整块删+整块增"，只会更长不会更短：${capped.cost} vs ${free.cost}`);
  assert.deepEqual(xInvariants(capped.ops, a.length, b.length, 'degraded'), [], '降级档的 ops 照样得守三条不变式');
  assert.ok(X_NOTES.degraded.length > 0);
  assert.ok(X_NOTES.degraded.includes(String(X_COST)), `那句话里的数字要从常量插：${X_NOTES.degraded}`);
  assert.ok(X_NOTES.degraded.includes('一行'), '那句还得说清"行数不会少"，用户才不会被"变了样"吓到');
});

test('X15 inlineDiff 四类 token：ASCII 词、空白串、标点、逐码点的 CJK——改一个汉字只标那一个字的 token', () => {
  assert.deepEqual(dInline('改成汉字好', '改成中文字好', {}), [
    { t: 'equal', text: '改成' }, { t: 'del', text: '汉' }, { t: 'ins', text: '中文' }, { t: 'equal', text: '字好' },
  ], 'CJK 逐码点成一枚：删的那一侧就是"汉"这一个字，不许把整句标红');
  assert.deepEqual(dInline('let a = 1;', 'let a = 2;', {}), [
    { t: 'equal', text: 'let a = ' }, { t: 'del', text: '1' }, { t: 'ins', text: '2' }, { t: 'equal', text: ';' },
  ], 'ASCII 词只吃 [A-Za-z0-9_]+，词间空白各成一枚，标点 ; 单独一枚');
  assert.deepEqual(dInline('a.b', 'a-c', {}), [
    { t: 'equal', text: 'a' }, { t: 'del', text: '.b' }, { t: 'ins', text: '-c' },
  ], '标点不是词的一部分：a. 与 a- 里只有 a 能对上');
  assert.deepEqual(dInline('x  y', 'x y', {}), [
    { t: 'equal', text: 'x' }, { t: 'del', text: '  ' }, { t: 'ins', text: ' ' }, { t: 'equal', text: 'y' },
  ], '连续空白并成一枚：两格对一格正好一对，不是拆成两枚各删一枚');
  assert.deepEqual(dInline('中文 abc 123', '中文 abcd 123', {}), [
    { t: 'equal', text: '中文 ' }, { t: 'del', text: 'abc' }, { t: 'ins', text: 'abcd' }, { t: 'equal', text: ' 123' },
  ], '数字跟着词（123 是一枚），不另起第三条');
  for (const [a, b] of [['改成汉字好', '改成中文字好'], ['let a = 1;', 'let a = 2;'], ['a.b', 'a-c']]) {
    const s = dInline(a, b, {});
    assert.equal(s.filter((x) => x.t !== 'ins').map((x) => x.text).join(''), a, `重建 a 侧不许吞字：${a}`);
    assert.equal(s.filter((x) => x.t !== 'del').map((x) => x.text).join(''), b, `重建 b 侧不许吞字：${b}`);
  }
  assert.deepEqual(dInline('', '', {}), [], '两行都空就是零段，不许造一条 equal:""');
  assert.deepEqual(dInline('abc', 'abc', {}), [{ t: 'equal', text: 'abc' }]);
});

test('X16 emoji：代理对 / ZWJ 序列 / 旗标 / 变体选择符，切完不得出现孤立代理项', () => {
  // 孤立代理项上屏是  或空白，而行内高亮正是"逐段塞进 <span>"——那一格坏了用户只会说"字少了"。
  const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
  const samples = [
    ['a😀b', 'a😃b'],
    ['👩‍💻 ok', '👨‍💻 ok'],
    ['🇨🇳🇺🇸', '🇨🇳🇩🇪'],
    ['❤️ red', '💗 red'],
  ];
  for (const [a, b] of samples) {
    const s = dInline(a, b, {});
    assert.ok(Array.isArray(s), `这一对不该被形状闸门拦下：${a}`);
    for (const x of s) {
      assert.equal(LONE.test(x.text), false, `段里有孤立代理项：${JSON.stringify(x.text)}`);
      assert.doesNotThrow(() => encodeURIComponent(x.text), `encodeURIComponent 都拒的段就是坏段：${JSON.stringify(x.text)}`);
    }
    assert.equal(s.filter((x) => x.t !== 'ins').map((x) => x.text).join(''), a, '重建 a 侧');
    assert.equal(s.filter((x) => x.t !== 'del').map((x) => x.text).join(''), b, '重建 b 侧');
  }
  assert.deepEqual(dInline('a😀b', 'a😃b', {}), [
    { t: 'equal', text: 'a' }, { t: 'del', text: '😀' }, { t: 'ins', text: '😃' }, { t: 'equal', text: 'b' },
  ], '一枚 emoji 是一枚 token：不许把代理对劈成两半各标一次');
});

test('X17 MAX_INLINE_TOKENS 退化：越线那一对 inline:null，且 stats.inlineSkipped 计数 +1', () => {
  const longA = '字'.repeat(X_TOKENS + 1000);
  const longB = `${longA}改`;
  assert.equal(dInline(longA, longB, {}), null, '单侧切到上限零一枚就收手，不为一行建那张百万项的表');
  const r = dLines(`${longA}\nq1\n`, `${longB}\nq2\n`);
  assert.deepEqual([r.stats.changed, r.stats.inlineSkipped], [2, 1], '只有越线那一对退化，另一对照常细化');
  assert.equal(r.inlineByKey.has('0:0'), false, '越线那一对不举行内结果');
  assert.equal(r.inlineByKey.has('1:1'), true, '同一次调用里，下一对不该被连坐');
  const rows = dHunks(r, Infinity).flatMap((h) => h.rows);
  assert.equal(rows.find((x) => x.a === 0).inline, null, '视图层拿到的那一格必须是 null，不是 undefined 也不是空表');
  assert.ok(X_NOTES.inlineSkipped.length > 0);
  assert.ok(X_NOTES.inlineSkipped.includes(String(X_TOKENS)), `那句话里的数字从常量插：${X_NOTES.inlineSkipped}`);
});

test('X18 五个统计量逐格定义 + 那条自洽关系（added ≥ changed、removed ≥ changed、blocks 数法）', () => {
  const a = 'k1\nk2\nD1\nD2\nk3\nk4\nk5\nk6\nk7\nX1\nX2\n';
  const b = 'k1\nk2\nk3\nk4\nk5\nk6\nk7\nY1\nY2\nY3\nk8\n';
  const r = dLines(a, b);
  assert.deepEqual(r.stats, { added: 4, removed: 4, changed: 2, unchanged: 7, blocks: 2, inlineSkipped: 0, ignored: 0 });
  assert.equal(r.stats.unchanged + r.stats.removed, r.a.count, 'a 侧每一行要么对上、要么只在 a 侧出现');
  assert.equal(r.stats.unchanged + r.stats.added, r.b.count, 'b 侧同理');
  assert.ok(r.stats.added >= r.stats.changed && r.stats.removed >= r.stats.changed, '改动行同时计入增与删');
  assert.ok(r.stats.blocks <= r.segments.length, 'blocks 数的是极大非等段，一段既删又增只算一块');
  const rows = dHunks(r, Infinity).flatMap((h) => h.rows);
  assert.deepEqual(rows.map((x) => x.kind), ['equal', 'equal', 'del', 'del', 'equal', 'equal', 'equal', 'equal', 'equal', 'change', 'change', 'ins', 'ins']);
  assert.equal(rows.filter((x) => x.kind === 'change').length, r.stats.changed, '"改 K 处"与 change 行同源');
  assert.equal(rows.filter((x) => x.kind === 'del').length + r.stats.changed, r.stats.removed);
  assert.equal(rows.filter((x) => x.kind === 'ins').length + r.stats.changed, r.stats.added);
  assert.equal(dHunks(r, 0).length, r.stats.blocks, 'context 0 时一块就是一段：折叠条数与"处"数是同一件事');
  assert.deepEqual([dLines('a\n', 'a\nb\n').stats.added, dLines('a\n', 'a\nb\n').stats.changed], [1, 0], '纯增：changed 必须是 0');
  assert.equal(dLines('a\nb\n', 'a\n').stats.changed, 0, '纯删同理');
  assert.deepEqual(dLines('x\ny\n', 'x\ny\n').stats, { added: 0, removed: 0, changed: 0, unchanged: 2, blocks: 0, inlineSkipped: 0, ignored: 0 });
});

test('X19 stats.ignored 只在归一化开启时非零，关掉就是 0', () => {
  const a = 'a b\nc\n';
  const b = 'a  b\nd\n';
  assert.equal(dLines(a, b).stats.ignored, 0, '没勾任何归一化就不许有"被抹平"的行');
  assert.equal(dLines(a, b, { ws: false, case: false }).stats.ignored, 0, '显式写 false 与不写同一条路');
  assert.equal(dLines(a, b, { ws: true }).stats.ignored, 1);
  const cs = dLines('Foo\nbar\n', 'foo\nbar\n', { case: true });
  assert.equal(cs.stats.ignored, 1);
  assert.equal(cs.verdict, 'same', 'ignored 那几行进的是 unchanged，不是 added/removed');
  assert.equal(dLines('a\n', 'a\r\n', { ws: true }).stats.ignored, 1, '行尾回车并进空白那一档，也算被抹平');
  assert.equal(dLines('a\n', 'a\r\n').stats.ignored, 0, '不勾 ws，行尾形状是差异而不是被忽略的行');
  for (const r of [dLines(a, b), dLines(a, b, { ws: true }), cs, dLines('a\n', 'a\r\n', { ws: true })]) {
    assert.equal(r.stats.unchanged + r.stats.removed, r.a.count,
      'ignored 不许从 unchanged 里再扣一次：它只是 unchanged 中"原文其实不同"的那几行');
    assert.equal(r.stats.unchanged + r.stats.added, r.b.count);
  }
});

test('X20 hunksOf(result, 3)：块内首尾各 3 行 equal，skipped 数的是被折掉的行数', () => {
  const a = `${[...xRows(10, 'e'), 'C1', ...xRows(20, 'm'), 'C2', ...xRows(10, 'f')].join('\n')}\n`;
  const r = dLines(a, a.replace('C1', 'Z1').replace('C2', 'Z2'));
  const hk = dHunks(r, 3);
  assert.equal(hk.length, 2);
  assert.deepEqual(hk[0].rows.map((x) => x.kind), ['equal', 'equal', 'equal', 'change', 'equal', 'equal', 'equal'], '首尾各 3 行上下文');
  assert.deepEqual([hk[0].aFrom, hk[0].aTo, hk[0].skipped, hk[0].tailSkipped], [7, 14, 7, 0], 'skipped 是折掉的行数：前 10 行只留 3 行');
  assert.deepEqual([hk[1].aFrom, hk[1].aTo, hk[1].skipped, hk[1].tailSkipped], [28, 35, 14, 7], '只有末块那一格才带尾折');
  assert.equal(hk[0].rows[0].a, 7);
  assert.equal(hk[0].rows[0].textA, 'e7');
  assert.equal(hk[1].rows[0].textA, 'm17');
  const folded = hk.reduce((s, h) => s + h.skipped + h.rows.length, 0) + hk[hk.length - 1].tailSkipped;
  assert.equal(folded, 42, '折掉的 + 露出的 + 尾折的 == 虚拟行流全长，少一行就是折叠算错了');
  const one = dHunks(r, 1);
  assert.deepEqual(one[0].rows.map((x) => x.kind), ['equal', 'change', 'equal']);
  assert.deepEqual([one[0].skipped, one[1].skipped, one[1].tailSkipped], [9, 18, 9]);
});

test('X21 context=Infinity 摊出全部行；context 传非数值 / 负数 / 小数一律 TypeError', () => {
  const a = `${[...xRows(10, 'e'), 'C1', ...xRows(20, 'm'), 'C2', ...xRows(10, 'f')].join('\n')}\n`;
  const r = dLines(a, a.replace('C1', 'Z1').replace('C2', 'Z2'));
  const inf = dHunks(r, Infinity);
  assert.equal(inf.length, 1, '全展开就是一块');
  assert.equal(inf[0].rows.length, 42, '全部行：42 格一行不少');
  assert.deepEqual([inf[0].skipped, inf[0].tailSkipped], [0, 0], '全展开没有折掉的行');
  assert.deepEqual([inf[0].aFrom, inf[0].aTo, inf[0].bFrom, inf[0].bTo], [0, 42, 0, 42]);
  assert.equal(dHunks(r, 0).length, 2, 'context 0 就是两块，各带 0 行上下文');
  for (const bad of ['all', true, null, {}, NaN, -1, 1.5]) {
    assert.throws(() => dHunks(r, bad), TypeError, `context=${String(bad)} 必须点名拒，不许当 0 用`);
  }
  assert.throws(() => dHunks({ ops: 'no' }, 3), TypeError, 'result 不是 diffLines 的返回值也要点名');
});

test('X22 边界：差异就在第 1 行 / 就在末行时，首块与末块的 skipped 不得为负、不得凭空多上下文', () => {
  const first = dHunks(dLines('C1\nb\nc\nd\ne\nf\ng\n', 'Z1\nb\nc\nd\ne\nf\ng\n'), 3);
  assert.equal(first.length, 1);
  assert.deepEqual([first[0].aFrom, first[0].aTo, first[0].skipped, first[0].tailSkipped], [0, 4, 0, 3], '前头只有 0 行可给，不许凑出 -3 行');
  assert.deepEqual(first[0].rows.map((x) => x.kind), ['change', 'equal', 'equal', 'equal']);
  assert.equal(first[0].rows[0].a, 0);
  const last = dHunks(dLines('a\nb\nc\nd\ne\nf\nC7\n', 'a\nb\nc\nd\ne\nf\nZ7\n'), 3);
  assert.deepEqual([last[0].aFrom, last[0].aTo, last[0].skipped, last[0].tailSkipped], [3, 7, 3, 0], '末行之后没有行，尾折必须是 0');
  assert.deepEqual(last[0].rows.map((x) => x.kind), ['equal', 'equal', 'equal', 'change']);
  // 只有一侧有行的块：本侧区间是空的，落点也得是个有限的数
  const del = dHunks(dLines('a\nb\nc\nd\ne\n', 'a\ne\n'), 1)[0];
  assert.deepEqual([del.aFrom, del.aTo, del.bFrom, del.bTo], [0, 5, 0, 2]);
  const ins = dHunks(dLines('a\ne\n', 'a\nb\nc\nd\ne\n'), 1)[0];
  assert.deepEqual([ins.aFrom, ins.aTo, ins.bFrom, ins.bTo], [0, 2, 0, 5]);
  const empty = dHunks(dLines('', 'a\nb\n'), 3)[0];
  assert.deepEqual([empty.aFrom, empty.aTo, empty.bFrom, empty.bTo], [0, 0, 0, 2], '整侧为空：区间退化成锚点，不许是 Infinity');
  assert.equal(dUnified(dLines('', 'a\nb\n'), { context: 3 }), '--- A\n+++ B\n@@ -1,0 +1,2 @@\n+a\n+b\n', '空侧的头写 ,0——那是"插在这里"的唯一写法');
});

test('X23 unifiedText 的 @@ -a,b +c,d @@ 与手算逐字符对照，单行区间不省略 ,1', () => {
  const r = dLines('a\nb\nc\nd\n', 'a\nX\nc\nd\n');
  assert.equal(dUnified(r, { a: 'A.txt', b: 'B.txt', context: 1 }),
    '--- A.txt\n+++ B.txt\n@@ -1,3 +1,3 @@\n a\n-b\n+X\n c\n');
  assert.equal(dUnified(r, { context: 0 }),
    '--- A\n+++ B\n@@ -2,1 +2,1 @@\n-b\n+X\n',
    '单行区间也得写 ,1：省略是 git 的排版偏好，不是格式的必要部分，而本站的对照判据逐字符');
  const a2 = `${[...xRows(10, 'e'), 'C1', ...xRows(20, 'm'), 'C2', ...xRows(10, 'f')].join('\n')}\n`;
  const two = dLines(a2, a2.replace('C1', 'Z1').replace('C2', 'Z2'));
  assert.equal(dUnified(two, { context: 3 }),
    '--- A\n+++ B\n@@ -8,7 +8,7 @@\n e7\n e8\n e9\n-C1\n+Z1\n m0\n m1\n m2\n@@ -29,7 +29,7 @@\n m17\n m18\n m19\n-C2\n+Z2\n f0\n f1\n f2\n',
    '两块的头、上下文、改动行全部逐字符钉住');
  assert.deepEqual(dUnified(two, { context: 1 }).split('\n').filter((l) => l.startsWith('@@')),
    ['@@ -10,3 +10,3 @@', '@@ -31,3 +31,3 @@'], '头里的行号从 1 起，长度是"这一块的行数"');
  assert.equal(dUnified(dLines('a\nb\nc\nd\ne\n', 'a\ne\n'), { context: 1 }),
    '--- A\n+++ B\n@@ -1,5 +1,2 @@\n a\n-b\n-c\n-d\n e\n', '纯删：+ 侧只有 2 行');
  assert.equal(dUnified(dLines('a\ne\n', 'a\nb\nc\nd\ne\n'), { context: 1 }),
    '--- A\n+++ B\n@@ -1,2 +1,5 @@\n a\n+b\n+c\n+d\n e\n', '纯增：镜像那一档');
});

test('X24 unifiedText 两侧都空只有头两行；两名默认 A/B，传入才换', () => {
  const empty = dLines('', '');
  assert.equal(dUnified(empty), '--- A\n+++ B\n', '一块都没有，就只有那两行文件头');
  assert.equal(dUnified(empty, { a: 'x.txt', b: 'y.txt' }), '--- x.txt\n+++ y.txt\n');
  assert.equal(dUnified(empty, { a: '', b: '' }), '--- A\n+++ B\n', '空串名回落成默认，不许写出 "--- " 那种半截头');
  assert.equal(dUnified(empty, { a: 42 }), '--- A\n+++ B\n', '非字符串的名同样回落，不许把 42 拼进头里');
  assert.equal(dUnified(empty, { context: 99 }), '--- A\n+++ B\n', 'context 再大也不许凭空造出一块');
  assert.equal(dUnified(dLines(X_HUGE, 'b\n')), '', 'blocked 那一档是空串，连文件头都不写');
});

test('X25 unifiedText 里 \\r 的处理与 X1/X9 同口径：行尾回车原样带出去，不许悄悄吃掉', () => {
  assert.equal(dUnified(dLines('a\r\nb\r\n', 'a\nb\n'), { context: 1 }),
    '--- A\n+++ B\n@@ -1,2 +1,2 @@\n-a\r\n+a\n-b\r\n+b\n', 'CRLF 对 LF 是差异，两个 \\r 都得在文本里看得见');
  assert.equal(dLines('a\r\nb\r\n', 'a\r\nb\r\n').verdict, 'same');
  assert.equal(dUnified(dLines('a\r\nb\r\n', 'a\r\nb\r\n')), '--- A\n+++ B\n', '判等就没有内容行');
  const ctx = dLines('q\na\r\nz\n', 'q\na\r\nZ\n', { ws: true });
  assert.equal(dUnified(ctx, { context: 1 }), '--- A\n+++ B\n@@ -2,2 +2,2 @@\n a\r\n-z\n+Z\n',
    '上下文行的行尾取 a 侧：两侧到这里已判等，那一格差别只在勾了归一化时才可能存在');
  assert.equal(dUnified(dLines('a\nb', 'a\nB'), { context: 0 }),
    '--- A\n+++ B\n@@ -2,1 +2,1 @@\n-b\n+B\n\\ No newline at end of file\n',
    '末行缺换行要写 git 那一句，不许静默补一个换行');
});

test('X26 入参闸门：非字符串一律 TypeError 点名，报错要说清是哪个调用的哪一个参数', () => {
  const bad = [null, undefined, 42, {}, ['a\n'], Symbol('x'), true];
  const callSites = [
    ['splitLines(text)', (v) => dSplit(v)],
    ['compareKey(line, opts)', (v) => dKey(v)],
    ['gate(textA, textB)', (v) => dGate(v, 'a\n')],
    ['gate(textA, textB)', (v) => dGate('a\n', v)],
    ['diffLines(textA, textB, opts)', (v) => dLines(v, 'a\n')],
    ['inlineDiff(lineA, lineB, opts)', (v) => dInline(v, 'a', {})],
  ];
  for (const [site, fn] of callSites) {
    for (const v of bad) assert.throws(() => fn(v), TypeError, `${site} 对 ${String(v)} 必须红`);
    try {
      fn(42);
      assert.fail(`${site} 放行了 number`);
    } catch (e) {
      assert.ok(e instanceof TypeError);
      assert.ok(e.message.includes(site), `${site} 的报错没点名调用处：${e.message}`);
    }
  }
  assert.throws(() => dHunks(null, 3), TypeError);
  assert.throws(() => dUnified(null), TypeError);
  assert.throws(() => dUnified(dLines('a\n', 'b\n'), []), TypeError, 'names 是数组也算非法形状');
  assert.throws(() => dSeq(null, [], (x, y) => x === y, 10), TypeError);
  assert.throws(() => dSeq(['a'], 'b', (x, y) => x === y, 10), TypeError);
  assert.throws(() => dSeq(['a'], ['b'], 'no', 10), TypeError, 'equals 不是函数同样点名，不许静默当"全不等"');
  assert.throws(() => dSeq(['a'], ['b'], (x, y) => x === y, 0), TypeError, 'maxCost=0 会让每一格都降级，是拼错的常量不是档位');
  assert.equal(dLines('a\n', 'a\n', undefined).verdict, 'same', 'opts 的 undefined 是"不传"，不是"传了个非法值"');
});

test('X27 opts 取值档：truthy 但非法的值一律 TypeError，未知键也拒', () => {
  for (const v of ['yes', 1, [], {}, 'true']) {
    assert.throws(() => dLines('a\n', 'b\n', { ws: v }), TypeError, `ws=${String(v)} 是 truthy，但不是布尔`);
    assert.throws(() => dLines('a\n', 'b\n', { case: v }), TypeError);
    assert.throws(() => dInline('a', 'b', { ws: v }), TypeError);
  }
  assert.throws(() => dLines('a\n', 'b\n', { ignoreWs: true }), TypeError, '拼错的键名不许静默忽略：那个勾选框就成了装饰品');
  assert.throws(() => dLines('a\n', 'b\n', { crlf: true }), TypeError, 'crlf 只有 compareKey 认这一格');
  assert.throws(() => dLines('a\n', 'b\n', 'ws'), TypeError);
  assert.throws(() => dLines('a\n', 'b\n', ['ws']), TypeError);
  assert.throws(() => dKey('a', { ws: null }), TypeError, 'null 也是"非法值"，不许当成 falsy 放行');
  assert.equal(dLines('a\n', 'a\n', { ws: false, case: false }).verdict, 'same', '显式 false 是合法档位');
  assert.equal(dKey('A', { ws: true, case: true, crlf: true }), 'a', '三格同开：先补 \\r、再并空白、最后落小写');
  assert.equal(dKey('a', { ws: true, case: true, crlf: true }), dKey('a', { ws: true, case: true }),
    '勾了 ws 之后行尾回车并进空白档——这正是 X9 那句"不算差异"的来处');
});

test('X28 幂等：同一输入两次调用 diffLines，ops 与 stats 与行内结果逐格深相等', () => {
  const a = 'k1\nD1\nk2\nk3\nk4\nk5\n中文 abc\n';
  const b = 'k1\nZ1\nk2\nk3\nk4\nk6\n中文 abcd\n';
  for (const o of [{}, { ws: true }, { case: true }]) {
    const r1 = dLines(a, b, o);
    const r2 = dLines(a, b, o);
    assert.deepEqual(r2.ops, r1.ops);
    assert.deepEqual(r2.stats, r1.stats);
    assert.equal(r2.cost, r1.cost);
    assert.deepEqual([...r2.inlineByKey.keys()], [...r1.inlineByKey.keys()], '行内细化按文档顺序记账，两次必须同序同集合');
    assert.deepEqual(dHunks(r2, 3), dHunks(r1, 3), '连行内分段也得同源：视图层重绘不许变色');
    assert.equal(dUnified(r2, { context: 1 }), dUnified(r1, { context: 1 }));
  }
});

test('X29 MAX_INLINE_WORK 预算：装不下那一对就跳过它，后面装得下的照常细化（跳过不是掐断）', () => {
  const big = (tag, n) => Array.from({ length: n }, (_, i) => `${tag}${i}`).join(' ');
  // 一对约 790 枚 token 的行，按 4·rest² 记的就是 249 万格：第一对装得下，第二对同一档装不下
  const a = [big('p1', 198), big('p2', 198), 'x1', 'x2', 'x3'];
  const b = [big('q1', 198), big('q2', 198), 'y1', 'y2', 'y3'];
  const r = dLines(`${a.join('\n')}\n`, `${b.join('\n')}\n`);
  assert.equal(r.stats.changed, 5, '五对都配上行了：预算掐的是行内细化，不是行级对齐');
  assert.deepEqual([...r.inlineByKey.keys()], ['0:0', '2:2', '3:3', '4:4'],
    '预算只掐掉装不下的那一格，后面的小配对照常细化——写成"后面全掐"就少了这一判');
  assert.equal(r.stats.inlineSkipped, 1);
  const rows = dHunks(r, Infinity).flatMap((h) => h.rows);
  assert.equal(rows.find((x) => x.a === 1).inline, null);
  assert.ok(rows.find((x) => x.a === 2).inline.length > 0, '排在超预算那一对后面的行必须有高亮');
  assert.ok(X_NOTES.inlineSkipped.includes(String(X_WORK)), `那句要说清预算数额：${X_NOTES.inlineSkipped}`);
  const again = dLines(`${a.join('\n')}\n`, `${b.join('\n')}\n`);
  assert.deepEqual([...again.inlineByKey.keys()], [...r.inlineByKey.keys()], '同一档必须可重放，不许"刷新一下又高亮了"');
  assert.equal(again.stats.inlineSkipped, r.stats.inlineSkipped);
});
```

---

## Task 3：`diff-json.js` JSON 感知比对 + §Y

**Files：** Create `dev/js/tools/diff-json.js`；Modify `scripts/toolkit-tests.mjs`（§Y 一节）。

- [x] **Step 1：写 §Y 判据**（Y1 与 `json-core` 对拍 → Y18，逐条按 §1.2 的字段名写；
      **Y1 是本格的承重墙**：两本解析器在合法/非法、非法行列、解出的值三件上必须同结论，
      样本集 = §S 那 20 个坏样本 + 一组好样本，固化在测试文件里而不是生成时现造）：

| # | 咬的那一件事 |
| --- | --- |
| Y1 | **对拍**：同一批样本喂 `json-core.parseJson` 与本模块 `readJson`，三件同结论（含 20 个坏样本的 line/column 逐格） |
| Y2 | `MAX_DEPTH` 两本里的数相同（`1000`），改一本不改另一本必红 |
| Y3 | 键顺序无关：只有顺序不同 → `verdict:'same-key-order'`，不是 `'same'` |
| Y4 | 类型变化单列：`1`→`"1"`、`{}`→`[]`、`null`→缺键 三档各自的 `kind` 与 `aType/bType` |
| Y5 | 数组按索引：中间插一项 → 其后全部报 change，**这是设计而非缺陷**，`DIFF_JSON_NOTES.arrayMove` 那句必须非空且上页面 |
| Y6 | Pointer 与 `json-core` 那份逐字符同规则：`~`、`/`、空串键、数字键四种 |
| Y7 | `pointerOf` 对 `~1` 与 `~0` 的先后次序（先 `~` 后 `/`，反过来会二次转义） |
| Y8 | `PREVIEW_CHARS` 截断带省略号，且切点不切断代理对 |
| Y9 | `owner` 三档：`only-a` / `only-b` / `both` 各自在深层路径下的形状 |
| Y10 | 一侧非法：`error.which` 点名，另一侧即使合法也不比 |
| Y11 | 两侧都非法：`error.which:'both'`，报 A 那一侧的行列（顺序口径写死） |
| Y12 | `MAX_CHANGES` 越线：`truncated:true` + 那句说明，且不静默丢 |
| Y13 | `stats` 四档计数与 `changes.length` 自洽 |
| Y14 | 空档：`{}` vs `{}`、`[]` vs `[]`、`{}` vs `[]`（最后一档是 type，不是 same） |
| Y15 | 深层路径（≥8 层）下的 `depth` 读数 |
| Y16 | 非字符串入参 `TypeError`；闸门不过的字节数走 `gate` 那一档（与 §X 同一把尺） |
| Y17 | 数字口径：`1` vs `1.0` vs `"1"` vs `1e0` 四档的 `kind` |
| Y18 | `DIFF_JSON_NOTES` 六句非空，且 `renderJsonTable` 的产出里逐句出现 |

      落地时的三处形状，都写进判据正文而不改上面这张表（表是起草那天的规格，记录是今天的读数）：
      ① **Y1 的样本集长成 34 坏 + 24 好**，比表里那句"§S 那 20 个 + 一组"多 14 格——因为本格要给
      八档 `kind`（`empty` / `unterminated` / `unexpected-char` / `bad-escape` / `bad-number` /
      `unterminated-string` / `depth` / `trailing`）逐档踩到，而 §S 那 20 格只覆盖其中六档；
      少一格就是少一片分支从此**静默不核**，所以 Y1 末尾另有一条自检："样本集必须踩满八档"，
      并把 `bad.length === 34` 钉成硬断言（少一格当场红，而不是等某次改 `readJson` 时才发现没人看）。
      ② **Y18 只落了第一半**（六句非空、各带自己那个数、不许留占位）；"原样出现在 `renderJsonTable`
      的产出里"要等 Task 4 的视图层存在才断得了，那一半交给 §Z（Task 4 Step 1 第 9 条"JSON 变更表
      那六列的表头与 `DIFF_JSON_NOTES` 同页"）。测试名与表格里都留了"上页面那一半由 §Z 接"的字样，
      不许读的人以为 Y18 已经全了。
      ③ **两条写测试时自己踩的坑**，形状与 §0.6 那条"文档里的数字要能照着复算"同源：
      `Y_BAD_EXTRA` 里最初放了 `'"x"'`，而**它是合法 JSON**（一个字符串就是合法文档），换成了
      `'{"a":1}}'` 走 `trailing` 那一档；Y4 最初在结果对象上读 `one.aType`，而 `aType` 长在
      `changes[0]` 上，那一格读出来永远是 `undefined`——`assert.equal(undefined, 'absent')` 会红，
      但**反过来不成立**：如果口径写成"缺席那一格给 `null`"，同样的错位就读不出错了，所以改成
      先 `const c1 = one.changes[0]` 再逐格断。

      牙是三刀自证的（每刀单行改动、跑完立刻用 Edit 回退、`md5 -q` 与基线 `f92296f…` 逐字节比对）：
      把 `ws()` 里"只容忍头部一个 BOM"放宽成"哪里的 BOM 都吞"→ **只红 Y1**（对拍真的抓得住分叉）；
      把 `escPointer` 的两趟转义倒过来 → **红 Y6 + Y7**（Y7 正是为这一种形状写的，Y6 从 json-core
      那一头同时抓到）；把 `emit` 里的 `stats[kind] += 1` 挪到 `MAX_CHANGES` 那道 return 之后 →
      **只红 Y12**（四个计数被截成 5000 以内，而 Y13 那条"自洽"用的样本离 `MAX_CHANGES` 很远，
      本来就不走截断分支，所以不跟着红——红一格而不是两格，正说明这两格的分工不重叠）。

- [x] **Step 2：写实现到绿**——`dev/js/tools/diff-json.js` 落盘 **568 行 / 29,189B**（`wc -l -c` 的读数）。
      三处与 `json-core.parseJson` 的**故意分歧**写在文件头，且每一处都只砍输出、不改结论：不回
      `index` / `length` / `snippet`（这一页没有"把病灶高亮进输入框"那一档交互，坏输入是一句点名行列的话）、
      不回 `duplicateKeys`（重复键两本都是"后写覆盖先写"，值同结论同；那一格清单是 JSON 页的活，
      报第二份只会让两页的说法有机会分叉）、不带字节闸门（同一把尺只在 `diff-core.js` 有一份，
      而 `diffJson` 的第一步就是它——Y16 钉"闸门排在读之前，不许先把 5MB 解析完再拒"）。
      解析、预览、比对三族**全部走显式栈**：深度闸门是本站自己定的 1000 层，V8 的调用栈在千层上下
      就要抛 `RangeError`，那意味着一份合法输入会先炸我的栈再炸用户的页面。Y15 里那一格
      `deep.changes.length === 1`（而不是抛）就是这一条的证据。
      变更的**文档顺序**由"一个节点的子格整批攒齐、再倒着压栈"给出，弹出次序即阅读次序（Y13 钉死
      `['type','add','remove','add']` 那一条串）；两处口径选择也在文件头写明并由判据咬住：
      `-0` 与 `0` 判 `same`（按 JSON 值判就是按 `===` 判），`null` → `1` 判 `type`
      （`null` 是一种值，不是一种"没有值"）。
      先红一步是形状的一部分：Step 1 落完跑门禁① 得 `393 tests / 392 pass / 1 fail` 退 1、
      `ERR_MODULE_NOT_FOUND … dev/js/tools/diff-json.js`，而模块级 `await import` 失败被 Node 报成
      "A resource generated asynchronous activity after the test ended"——那一行不是竞态，是"实现还没有"。
- [x] **Step 3：登记镜像**——`FILE_TARGETS` 追加 `'dev/js/tools/diff-json.js'`（方向照旧：跟着磁盘走），
      注释里写清这一本是本清单里第一本**明知故犯重复一份读侧**的模块，而镜像因此同时是 Y1 那
      34 + 24 格的第二现场。本计划 Task 3 这一节新贴两块 ` ```js ` 围栏（整文件 568 行、整节 332 行），
      种子直接由磁盘内容生成，`--fix` 一次通过；裸门禁② 两行读数：
      `OK dev/js/tools/diff-json.js：计划[段5] 2289–2856（568 行）与磁盘逐字节全等`、
      `OK scripts/toolkit-tests.mjs §Y（磁盘 13980–14311）：计划[段5] 2867–3198（332 行）与磁盘逐字节全等`。
      三处连带动作要记在这里，它们都是"贴一节新判据"这一格必然会碰到的形状：
      ① Task 2 那节的 §X 小标题从"到文件末尾"改成"到本节末"——磁盘上新出现的 `// ── §Y` 标记把 §X
      截短了，**作废的只是"读到哪儿"那个说法**，§X 那一段的字节一位没动，门禁② 照样报 `OK`；
      分节按标记切、不按行号切，正是 `verify-plan-blocks.mjs:37-39` 立的那条规矩。
      ② 测试文件头部那张"用例分布"表补 §X / §Y 两行、合计从 `363` 改 `410`（`363` 是段 4 收口后留下的
      旧数，本次是第一次真去对它的账），而那张表长在磁盘 **§A 那一段**里 → `--fix` 顺手把**段 1 那份计划**
      的 §A 镜像整块换成磁盘内容（`6522 → 6526 行`）。这一格动了本段之外的文件，形状与段 4 Task 2 那次一致：
      §A 的镜像权威在磁盘，计划只是它的第二现场，本提交里那份额外的改动就是这一条的账单。
      ③ `diff-json.js` 文件头里两处样本数（"12 个补分支的坏样本"与"那 32 格坏样本"）起草于 §Y 落判据之前，
      与实际的 `14` / `34` 不符——**顺序必须是先改磁盘、再让 `--fix` 把镜像换回来**，反过来做就是给门禁二
      造一个"计划与磁盘谁也不认谁"的形状（而那正是 `--fix` 对分段目标拒绝落笔的那一档）。
- [x] **Step 4：门禁①②③**——① 全量 `410/410` 退 0（写回前后各跑一次，另用 `--test-name-pattern="^Y[0-9]+ "`
      单跑过 18/18）；② 裸跑退 0：`69` 块已落地镜像全等、`未落地 0 节`、js 块 `61` 个（段5 从 2 块长到 4 块）；
      ③ **37/37** 退 0，末尾两条自证照旧（副本回到全绿；实验前后工作树脏指纹一字不差，`29` 个脏项里含另一路
      会话那批，一件未碰）。跑之前先 `uptime`：本机 load averages 一度到 `8.18`，那种红要先归因给量具，
      不许动判据。
- [x] **Step 5：提交** `feat(tools): 段 5 Task 3 JSON 感知比对——diff-json 与 §Y 十八判（含与 json-core 的对拍）`。
      落笔 = `4acbc9c`（`0dfe27d` → `4acbc9c`，`git update-ref` 的 CAS 带旧 sha）。
      pathspec 五件：`dev/js/tools/diff-json.js`（新）/ `scripts/toolkit-tests.mjs` /
      `scripts/verify-plan-blocks.mjs` / 本计划 / **段 1 那份计划**（只被 `--fix` 换掉 §A 那一个块，
      来龙去脉在 §0.6 倒数两行），`git show --stat` 读到 `1915 insertions(+) / 6 deletions(-)`
      且**只有这五行**；另一路会话压在索引上的 **16 格一格不少**（`USAGE.md` 仍是 `1/76`、
      spec 仍是 `0/17`），它的工作树文件一件没动——提交前后各存一份 `git status --porcelain`，
      逐行对照只差我这五格（`30 → 25` 行）。
      **提交态自证**（`git archive HEAD` 整份导出 → 导出树里 `git init` → 三道人真跑）：
      门禁① `410/410` 退 0、门禁② 退 0（`69` 块已落地镜像全等、`未落地 0 节`）、门禁③ **37/37** 退 0。
      Task 2 那两条量具的教训在这一格都照做了：**整份导出**（不做稀疏导出）、**先 `git init`**
      （否则门禁③ 末尾那句自证拿不到 `git status`）。
      这一格自己也被 §0.6 那条规矩咬过一次：回填 Step 5 的那一刀把 Step 2–4 整段替换时
      **漏带了 Step 5 那一行**（老周说过的"整块替换要数一遍被替换掉的行数"），当场按原句补回并
      在这里记档——补回来的那一行与本段上面那句提交信息一字不差。

### 落地镜像（门禁二核的就是这一块，`--fix` 会把它整块换成磁盘内容）

Task 2 那一节立的规矩在这里照用：只有**整文件**与**整节**镜像允许 ` ```js ` 围栏（§0.6 的硬规矩），
贴的时候直接由磁盘内容生成，事后跑一次 `--fix` 复验它已经全等。下面两块是一对——
`diff-json.js` 改了而 §Y 没跟着改，红的是门禁①；§Y 改了而计划没跟着改，红的是门禁②。

> 上面 Task 2 那节的 §X 小标题原本写"到文件末尾"，本节贴进去之后磁盘上的 §X 被 `// ── §Y`
> 那条标记截短了，所以同一格里把那句改成"到本节末"。**作废的只是"读到哪儿"这个说法**：§X 那一段的
> 字节一位没动，门禁② 照样报 `OK scripts/toolkit-tests.mjs §X（磁盘 …）… 与磁盘逐字节全等`；
> 分节按标记切、不按"读到哪儿"切，这正是 `verify-plan-blocks.mjs:37-39` 那段注释立的规矩
> （段 4 那份计划的 §S/§T 小标题留着同样的旧说法，形状一致）。

#### `dev/js/tools/diff-json.js`（整文件）

这一本是 §0.4 那条硬约束的产物：它**自带一份 JSON 读侧**，不 `import` `json-core.js`——
两本入口各自引一次就会让 Rollup 抽出共享 chunk，`iifeWrapPlugin` 把 `import{` 包进整页即静默 SyntaxError
（构建照样退 0）。代价由 Y1 的那一片对拍偿清：同一批 34 个坏样本 + 24 个好样本，
`json-core.parseJson` 与本模块 `readJson` 必须在"合法/非法、非法的行列、解出的值"三件上同结论。

```js
/**
 * 文件对比页的 JSON 感知比对（段 5 Task 3；§Y）。这一本只管"两份 JSON 按值比、差在哪一格"，
 * 不碰 DOM、不读环境。
 *
 * ── 为什么这里要自带一份 JSON 读侧（而不是 `import` `json-core.js`）──
 *
 * 这是构建层的硬约束，不是审美。`dev/js/tools/json-core.js` 今天的唯一 reach 者是
 * `jsonWorkbench.js`，而它只被 `toolJson.js` 那一个入口 reach；对比页的入口是 `toolDiff.js`。
 * 两个入口同时 import 同一本模块 → Rollup 把它切成带 `import{` 的共享 chunk，而本页的构建走
 * `iifeWrapPlugin` 包成 IIFE——包完就是**整页 SyntaxError 而构建 exit=0**
 * （`dev/js/toolkitCore.js:5-9` 记的正是这个坑，判据在门禁④的三列字节表里）。
 * 另一条出路是把 `json-core` 挂进 `window.Tk`：那要让已上线三页各自的 §7 总量格一起重算，
 * 还要把 `toolJson.js` 改成不直接 import、走 `Tk`——那是给存量页动手术。自带一份只涨这一页。
 *
 * 代价与补偿写在同一格里：既然自带，就必须**对拍**。§Y 的 Y1 拿同一批样本（§S 那 20 个坏样本
 * ＋ 14 个补分支的坏样本 ＋ 24 个好样本）同时喂 `json-core.parseJson` 与这里的 `readJson`，
 * 要求「合法/非法、非法时的行列、解出的值」三件同结论——**两个独立实现同结论才算过**，
 * 不是"复制一份就完事"（先例是 §B 的"与站内旧库对拍"）。
 *
 * ── 两份实现共享的是口径，不是代码 ──
 *
 *  · 深度闸门 `MAX_DEPTH = 1000`：与本文件里写死的字面量同一个数，由 Y2 钉"两本里的数相同"；
 *  · Pointer 转义：`~`→`~0`、`/`→`~1`，**先转 `~` 再转 `/`**（两趟反了会把键名 `~/` 编成 `~0~01`），
 *    由 Y6 逐字符对拍 `json-core.toPointer`、Y7 钉那一种次序唯一能分开的形状；
 *  · 行列口径：`line` 与 `column` 都从 1 起、列数 UTF-16 **码元**（一个 emoji 占两列）、
 *    换行只认 `\n`（CRLF 一行只推进一次）、只容忍头部**一个** BOM、EOF 那一格落在 `text.length`，
 *    全部由 Y1 那 34 格坏样本逐格核过；
 *  · 接受集：只认 JSON——不认 JSON5、注释、`NaN`/`Infinity`、单引号、未加引号的键、裸小数点、
 *    前导零，`1e999` 按 `bad-number` 拒（交出去的值必须还是合法 JSON）。
 *  改一处不改另一处就会红——这是"同一份事实不写第二遍"在无法复用时的替代做法。
 *
 * ── 字节与行数两档闸门不在这里 ──
 *
 * 本文件不复刻第二套 `gate`：那一族只在 `diff-core.js` 有一份，而且**按侧判**（`gate(textA, textB)`），
 * `diffJson` 的第一步就是它。所以 `readJson` 自己不带字节闸门——它被 `diffJson` 调到时那条路上
 * 闸门已经排在前面（Y16 钉的就是"闸门排在读之前，不许先把 5MB 解析完再拒"）。
 *
 * ── 比对口径（§Y 逐条咬，实现不许自创第二套）──
 *
 *  · 对象按**键名**比、键顺序无关；只有顺序不同判 `same-key-order`，不许直接判 `same`（Y3）；
 *  · 数组按**索引**比，不识别移动（Y5：把 `x[3]` 挪到 `x[1]` 会报成其后每一格都变了）；
 *  · 两侧类型档不同单列一档 `type`，并且**不再往里比**（Y4），免得把一处改动报成十几处；
 *    `null` 是一种值，不是一种"没有值"，所以 `null` → `1` 也是 `type`；
 *  · 一侧缺席是一档 `add` / `remove`，**整棵子树只报一格**（Y9）；
 *  · 数字按**值**判（`1` 与 `1.0` 与 `1e0` 同值，Y17），不按字面文本判；
 *  · 变更按**文档顺序**给（同一节点内先 A 侧键序、再 B 侧多出来的键，Y13），同一份输入两次逐格相同；
 *  · `MAX_CHANGES` 只截**列出的**格子，四个计数仍是全量（Y12）——截了列表顺手把总数也截了就是说谎。
 *
 * ── 纯计算 ──
 *
 * 不读任何环境：没有 `window` / `document` / `localStorage` / `process` / `Buffer`，不碰网络。
 * 本仓库的 import 面只有 `diff-core.js` 一本（同一个入口 reach 的两本纯逻辑模块不构成共享 chunk，
 * 门禁④ 数的是产物里的 `import{`），而 Y2 拿源码扫钉"本文件源码里 `json-core` 出现 0 次"。
 * 解析、比对、预览三族全部走**显式栈**：深度闸门是本站自己定的 1000 层，而 V8 的调用栈在千层上下
 * 就要抛 `RangeError: Maximum call stack size exceeded`——那意味着一份合法的深输入会先炸掉我的栈，
 * 再炸用户的页面（而且给不出任何可读错误）。
 *
 * @module dev/js/tools/diff-json.js
 */
import { gate, MAX_INPUT_BYTES, MAX_INPUT_LINES } from './diff-core.js';

/** 本站主动的容器嵌套上限；与 `json-core.js` 的 `MAX_DEPTH` 必须是同一个数（Y2 钉这一格） */
export const MAX_DEPTH = 1000;
/**
 * 一次比对最多**列出**多少格变更。越线只是不再往表里塞，四个计数仍然按全量累加（Y12），
 * 那句 `DIFF_JSON_NOTES.truncated` 负责把"后面还有没列出的"说在页面上——本站的规矩是
 * 真截了就必须明说，不许静默截断（spec §7 最后一列）。
 * 5000 那一档不是拍的：变更表是一行一个 DOM 节点，Task 7 的浏览器核验量的是它在真页面上的成本。
 */
export const MAX_CHANGES = 5000;
/**
 * 每格前后值的紧凑串预算，**含**末尾那一枚省略号。
 * 预览是给人对齐眼睛用的，不是给人复制全文用的——要看全文回文本模式比（那一条有 unified 导出）。
 */
export const PREVIEW_CHARS = 120;

const TAB = 9, LF = 10, CR = 13, SPACE = 32, QUOTE = 34, PLUS = 43, COMMA = 44, MINUS = 45,
  DOT = 46, ZERO = 48, NINE = 57, COLON = 58, BACKSLASH = 92, LB = 91, RB = 93,
  LC = 123, RC = 125, BOM = 0xfeff;
/** 数字记号的**贪婪字符集**：先读满这一串再验语法，于是 `01`、`1.`、`0.1.2` 都指认整记号 */
const NUMBER_CHARS = new Set([PLUS, MINUS, DOT, 0x65, 0x45,
  48, 49, 50, 51, 52, 53, 54, 55, 56, 57]);
const NUMBER_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const ESCAPE_SHORT = new Map([
  ['"', '\\"'], ['\\', '\\\\'], ['\b', '\\b'], ['\f', '\\f'], ['\n', '\\n'], ['\r', '\\r'], ['\t', '\\t'],
]);
const ESCAPE_VALUE = new Map([
  ['"', '"'], ['\\', '\\'], ['/', '/'], ['b', '\b'], ['f', '\f'], ['n', '\n'], ['r', '\r'], ['t', '\t'],
]);
const LITERALS = new Map([[0x74, 'true'], [0x66, 'false'], [0x6e, 'null']]);
const HIGH_SURROGATE = /[\ud800-\udbff]$/;

const isContainer = (v) => v !== null && typeof v === 'object';
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const clip = (token) => (token.length <= 40 ? token : `${token.slice(0, 40)}…`);
const typeName = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

/** 用 `defineProperty` 而不是赋值，`__proto__` 才会落成真属性（与 json-core 同一条：不然一份恶意 JSON 能污染后续所有对象） */
function setOwn(obj, key, value) {
  if (key === '__proto__') {
    Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
  } else obj[key] = value;
}

/**
 * 值 → 本站那六档类型名之一。`absent` 是给"这一侧压根没有这一格"用的第七档，
 * 只在 `aType` / `bType` 里出现，不会从 `typeOf` 出来。
 * @param {unknown} v
 * @returns {string}
 */
function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  const t = typeof v;
  if (t === 'object') return 'object';
  if (t === 'string' || t === 'number' || t === 'boolean') return t;
  return t;
}

const escPointer = (s) => s.replace(/~/g, '~0').replace(/\//g, '~1');

/**
 * 段数组 → RFC 6901 Pointer：`~`→`~0`、`/`→`~1`，空串段就是一格 `/`，根是空串。
 * 转义次序写死成"先 `~` 后 `/`"——反过来的两趟会把键名 `~/` 编成 `~0~01`，
 * 解回去就不是原来那个键了（Y7 拿 `~/` 那一格把两种次序分开）。
 * @param {Array<string|number>} segments
 * @returns {string}
 */
export function pointerOf(segments) {
  if (!Array.isArray(segments)) {
    throw new TypeError(`pointerOf(segments)：segments 必须是数组，这里是 ${typeName(segments)}`);
  }
  let out = '';
  for (const s of segments) out += `/${escPointer(String(s))}`;
  return out;
}

/**
 * 自带的那一份 JSON 读侧：只回"收不收、收的话值是什么、不收的话错在第几行第几列"。
 * 与 `json-core.parseJson` 的三处分歧都是**故意**的，且都不改结论：
 *   1. 不回 `index` / `length` / `snippet`——这一页没有"把病灶高亮进输入框"那一档交互，坏输入的
 *      呈现是一句点名行列的话（spec §5.6 的坏输入态）；位置仍然按同一族口径算，Y1 逐格核。
 *   2. 不回 `duplicateKeys`——重复键在两本里都是"后写的覆盖先写的"，值同结论同；
 *      那一格清单是 JSON 页的活（`CORE_NOTES.dupKey`），这里报第二份只会让两页的说法有机会分叉。
 *   3. 不做字节闸门——见文件头那一格。
 * 入参形状不对才抛 TypeError（那是调用侧的错，不许咽进返回值）。
 * @param {string} text
 * @returns {{ok: true, value: unknown} | {ok: false, kind: string, line: number, column: number, reason: string}}
 */
export function readJson(text) {
  if (typeof text !== 'string') throw new TypeError(`readJson 只收字符串，收到的是 ${typeName(text)}`);
  const n = text.length;

  /**
   * 下标 → 行列，每次调用重扫一遍换行（一次比对最多算一次，坏输入才要位置）。
   * 口径与 `json-core.locate` 同形：换行只认 `\n`，列数码元，越界钳到 `[0, n]`，
   * EOF 那一格的列号 = 最后一行的长度 + 1。
   */
  const locate = (index) => {
    const at = Math.max(0, Math.min(index | 0, n));
    let start = 0;
    let line = 1;
    for (let k = 0; k < at; k++) {
      if (text.charCodeAt(k) !== LF) continue;
      line += 1;
      start = k + 1;
    }
    return { line, column: at - start + 1 };
  };
  const fail = (kind, why, index) => {
    const pos = locate(index);
    return { ok: false, kind, line: pos.line, column: pos.column, reason: `${why}（第 ${pos.line} 行第 ${pos.column} 列）。` };
  };
  const eof = (kind, why) => fail(kind, why, n);
  const here = (index) => {
    const c = text.charCodeAt(index);
    return c >= 0x20 && c !== BOM && c !== BACKSLASH ? `「${text[index]}」` : `U+${c.toString(16).toUpperCase().padStart(4, '0')}`;
  };

  /** 只跳过头部那一个 BOM（从 Windows 文件里粘出来的常见形状）；第二个由调用侧点名 */
  const ws = (from) => {
    let k = from;
    while (k < n) {
      const c = text.charCodeAt(k);
      if (c === SPACE || c === TAB || c === LF || c === CR) { k += 1; continue; }
      if (c === BOM && k === 0) { k += 1; continue; }
      break;
    }
    return k;
  };

  const readEscape = (k) => {
    if (k + 1 >= n) return { bad: '结尾的反斜杠后面没有内容', index: k };
    const nx = text[k + 1];
    if (nx === 'u') {
      const hex = text.slice(k + 2, k + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) return { bad: '\\u 后面必须是四位十六进制', index: k };
      return { ch: String.fromCharCode(parseInt(hex, 16)), next: k + 6 };
    }
    const value = ESCAPE_VALUE.get(nx);
    if (value === undefined) return { bad: `反斜杠后面的 ${nx} 不是转义字符`, index: k };
    return { ch: value, next: k + 2 };
  };

  /** `from` 指向开引号；返回 `{ok,value,next}` 或 `{bad:{kind,why,index}}` */
  const readString = (from) => {
    let k = from + 1;
    let cut = k;
    let out = '';
    while (k < n) {
      const c = text.charCodeAt(k);
      if (c === QUOTE) return { ok: true, value: out + text.slice(cut, k), next: k + 1 };
      if (c === BACKSLASH) {
        out += text.slice(cut, k);
        const e = readEscape(k);
        if (e.bad) return { bad: { kind: 'bad-escape', why: `不是合法的 JSON 转义序列：${e.bad}`, index: e.index } };
        out += e.ch;
        k = e.next;
        cut = k;
        continue;
      }
      if (c === LF || c === CR) {
        return { bad: { kind: 'unterminated-string', why: `字符串没闭合就遇到了换行，前面还有 ${clip(text.slice(from, Math.min(k, from + 44)))}`, index: k } };
      }
      if (c < 32) {
        return { bad: { kind: 'unexpected-char', why: `字符串里有未转义的控制字符 U+${c.toString(16).toUpperCase().padStart(4, '0')}，要写成 \\n、\\t 或 \\uXXXX`, index: k } };
      }
      k += 1;
    }
    return { bad: { kind: 'unterminated-string', why: '字符串没闭合就到了输入结尾', index: n } };
  };

  const readNumber = (from) => {
    let k = from;
    while (k < n && NUMBER_CHARS.has(text.charCodeAt(k))) k += 1;
    const token = text.slice(from, k);
    if (!NUMBER_RE.test(token)) {
      return { bad: { kind: 'bad-number', why: `数字写法不合法：${clip(token)}（本站只认 JSON 的数字：不许前导零、不许裸小数点、不许 NaN 或 Infinity）`, index: from } };
    }
    const v = Number(token);
    if (!Number.isFinite(v)) {
      return { bad: { kind: 'bad-number', why: `数值超出可表示范围：${clip(token)} 会变成 Infinity，本站不产 Infinity`, index: from } };
    }
    return { ok: true, value: v, next: k };
  };

  const readLiteral = (from) => {
    let k = from;
    while (k < n && text.charCodeAt(k) >= 0x61 && text.charCodeAt(k) <= 0x7a) k += 1;
    const token = text.slice(from, k);
    const want = LITERALS.get(text.charCodeAt(from));
    if (token !== want) {
      return { bad: { kind: 'unexpected-char', why: `${clip(token)} 不是合法的 JSON 值（本站不认 NaN、Infinity、单引号与未加引号的键）`, index: from } };
    }
    return { ok: true, value: want === 'true' ? true : want === 'false' ? false : null, next: k };
  };

  const frames = [];
  let root;
  // 每放一个成员就把这一格的 count 加一：`[]` 与 `[1,]` 的分别全押在这一格上
  // （收尾分支靠 `count === 0` 认"空容器"，不是靠括号后面紧跟的字符）。
  const place = (v) => {
    if (!frames.length) { root = v; return; }
    const f = frames[frames.length - 1];
    f.count += 1;
    if (f.kind === 'arr') { f.node.push(v); return; }
    setOwn(f.node, f.key, v);
  };

  let state = 'value';
  let i = ws(0);
  if (i >= n) return fail('empty', '输入是空的或只有空白字符，没有任何可比对的内容', n);

  for (;;) {
    i = ws(i);
    const top = () => frames[frames.length - 1];

    if (state === 'value') {
      if (i >= n) return eof('unterminated', '这里在等一个值，输入却结束了');
      const c = text.charCodeAt(i);
      if (c === LC || c === LB) {
        if (frames.length + 1 > MAX_DEPTH) {
          return fail('depth', `嵌套深度超出上限：最多 ${MAX_DEPTH} 层，第 ${frames.length + 1} 层的容器出现在这里`, i);
        }
        frames.push({ kind: c === LC ? 'obj' : 'arr', node: c === LC ? {} : [], key: null, count: 0 });
        i += 1;
        state = c === LC ? 'key' : 'value';
        continue;
      }
      if (c === RB && frames.length && top().kind === 'arr' && top().count === 0) {
        const f = frames.pop(); i += 1; place(f.node); state = 'sep'; continue;
      }
      if (c === QUOTE) {
        const s = readString(i);
        if (s.bad) return fail(s.bad.kind, s.bad.why, s.bad.index);
        i = s.next; place(s.value); state = 'sep'; continue;
      }
      if (c === MINUS || (c >= ZERO && c <= NINE)) {
        const num = readNumber(i);
        if (num.bad) return fail(num.bad.kind, num.bad.why, num.bad.index);
        i = num.next; place(num.value); state = 'sep'; continue;
      }
      if (LITERALS.has(c)) {
        const lit = readLiteral(i);
        if (lit.bad) return fail(lit.bad.kind, lit.bad.why, lit.bad.index);
        i = lit.next; place(lit.value); state = 'sep'; continue;
      }
      return fail('unexpected-char', `这里该放一个值，来的是 ${here(i)}（本站只认 JSON，不猜 JSON5 与注释）`, i);
    }

    if (state === 'key') {
      if (i >= n) return eof('unterminated', '这里在等一个键名，输入却结束了');
      const f = top();
      if (text.charCodeAt(i) === RC && f.count === 0) { frames.pop(); i += 1; place(f.node); state = 'sep'; continue; }
      if (text.charCodeAt(i) !== QUOTE) {
        return fail('unexpected-char', `这里该放一个用双引号包起来的键名，来的是 ${here(i)}`, i);
      }
      const s = readString(i);
      if (s.bad) return fail(s.bad.kind, s.bad.why, s.bad.index);
      i = s.next; f.key = s.value; state = 'colon'; continue;
    }

    if (state === 'colon') {
      if (i >= n) return eof('unterminated', '键名读完在等冒号，输入却结束了');
      if (text.charCodeAt(i) !== COLON) {
        return fail('unexpected-char', `键名后面该是冒号，来的是 ${here(i)}`, i);
      }
      i += 1; state = 'value'; continue;
    }

    // state === 'sep'
    if (!frames.length) break;
    if (i >= n) return eof('unterminated', '这里在等逗号或收尾的括号，输入却结束了');
    const f = top();
    const c = text.charCodeAt(i);
    if (c === COMMA) { i += 1; state = f.kind === 'arr' ? 'value' : 'key'; continue; }
    if ((f.kind === 'arr' && c === RB) || (f.kind === 'obj' && c === RC)) {
      frames.pop(); i += 1; place(f.node); state = 'sep'; continue;
    }
    return fail('unexpected-char', `值读完以后这里该是逗号或收尾的括号，来的是 ${here(i)}`, i);
  }

  const after = ws(i);
  if (after < n) {
    return fail('trailing', `根值已经读完，后面还多出 ${n - after} 个字符，第一个多余的是 ${here(after)}`, after);
  }
  return { ok: true, value: root };
}

/**
 * 值 → 紧凑 JSON 串的前 `PREVIEW_CHARS + 1` 码元（多要那一格只为了判断"到底越没越线"）。
 * 显式栈 + 提前收手：预算只有 120 格，所以一个 5MB 的字符串读到第 120 格上下就停，
 * 而一棵 1000 层的子树也不会因为"先拼完再切"变成七万字符的临时串（Y8 钉的是这两件事）。
 * @param {unknown} value
 * @returns {string|null} 缺席那一格给 `null`，在场的这一格永远给字符串
 */
function previewOf(value) {
  if (value === undefined) return null;
  const limit = PREVIEW_CHARS;
  const hex = (code) => `\\u${code.toString(16).padStart(4, '0')}`;
  /** 转义到 `room` 格就收手；代理对是一起写的，所以这一族自己不会切出孤立代理项 */
  const escapeInto = (text, room) => {
    let out = '';
    for (let k = 0; k < text.length && out.length < room; k++) {
      const short = ESCAPE_SHORT.get(text[k]);
      if (short) { out += short; continue; }
      const code = text.charCodeAt(k);
      if (code < 0x20) { out += hex(code); continue; }
      if (code >= 0xd800 && code <= 0xdfff) {
        const next = k + 1 < text.length ? text.charCodeAt(k + 1) : -1;
        if (code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { out += text[k] + text[k + 1]; k += 1; continue; }
        out += hex(code);
        continue;
      }
      out += text[k];
    }
    return out;
  };
  const chunks = [];
  let size = 0;
  const write = (s) => { chunks.push(s); size += s.length; };
  const leaf = (v) => {
    const t = typeof v;
    if (t === 'string') { write(`"${escapeInto(v, limit + 2 - size)}"`); return; }
    write(v === null ? 'null' : String(v));
  };
  const open = (v) => {
    if (!isContainer(v)) { leaf(v); return null; }
    const isArr = Array.isArray(v);
    write(isArr ? '[' : '{');
    return { v, isArr, keys: isArr ? null : Object.keys(v), i: 0, first: true };
  };
  const rootFrame = open(value);
  const stack = rootFrame ? [rootFrame] : [];
  while (stack.length && size <= limit + 1) {
    const f = stack[stack.length - 1];
    const len = f.isArr ? f.v.length : f.keys.length;
    if (f.i >= len) { write(f.isArr ? ']' : '}'); stack.pop(); continue; }
    const key = f.isArr ? null : f.keys[f.i];
    const child = f.isArr ? f.v[f.i] : f.v[key];
    f.i += 1;
    if (!f.first) write(',');
    f.first = false;
    if (!f.isArr) write(`"${escapeInto(key, limit + 2 - size)}":`);
    const frame = open(child);
    if (frame) stack.push(frame);
  }
  const raw = chunks.join('');
  if (raw.length <= limit) return raw;
  let cut = raw.slice(0, limit - 1);
  if (HIGH_SURROGATE.test(cut)) cut = cut.slice(0, -1);   // 切点落在代理对中间：退回去，交出去的才还是合法 JSON
  return `${cut}…`;
}

/** 坏输入那一档的统计形状：六个数全 0，而不是"没有这一格"（与 §X 的 `emptyStats` 同一形状） */
function emptyStats() {
  return { add: 0, remove: 0, change: 0, type: 0, compared: 0, depth: 0 };
}

/** 闸门不过时那一句：上限与实测都给，谁超了点谁，两侧都超就说"两侧" */
function gateReason(g) {
  const sides = (hitA, hitB) => (hitA && hitB ? '两侧' : hitA ? 'A 侧' : 'B 侧');
  if (g.reason === 'bytes') {
    const bytes = (which) => (which === 'a' ? g.a.bytes : g.b.bytes);
    const over = (which) => (which === 'a' ? g.over.bytesA : g.over.bytesB);
    const side = sides(g.which === 'a' || g.which === 'both', g.which === 'b' || g.which === 'both');
    const worst = g.which === 'b' ? 'b' : 'a';
    return `${side}输入超出上限：最多 ${MAX_INPUT_BYTES} 字节，实测 ${bytes(worst)} 字节`
      + `（超出 ${over(worst)} 字节）。本站不做截断，请删减后再比，或改用文本模式看差异。`;
  }
  const side = sides(g.which === 'a' || g.which === 'both', g.which === 'b' || g.which === 'both');
  const worst = g.which === 'b' ? 'b' : 'a';
  const count = worst === 'a' ? g.a.count : g.b.count;
  const over = worst === 'a' ? g.over.linesA : g.over.linesB;
  return `${side}行数超出上限：最多 ${MAX_INPUT_LINES} 行，实测 ${count} 行（超出 ${over} 行）。`
    + '本站不做截断，请删减后再比。';
}

/**
 * 主入口：两侧都合法才比；闸门排在读之前；坏的那一侧点名给行列。
 *
 * 遍历走**显式栈的先序**：一个节点把自己的子格（在场的进比对、缺席的进 `add`/`remove`）
 * 整批压栈，于是弹出顺序就是文档顺序——变更表的顺序是用户读的那一列，
 * 不能由栈的进出次序决定（Y13 钉这一格）。`stats` 的六个数按**全量**累加，
 * 与 `changes.length` 卡在 `MAX_CHANGES` 上是两件事（Y12）。
 * @param {string} textA 左侧全文（一份 JSON）
 * @param {string} textB 右侧全文（一份 JSON）
 * @returns {{verdict: string, changes: Array<object>, stats: object, truncated: boolean, error: (null|object)}}
 */
export function diffJson(textA, textB) {
  const at = 'diffJson(textA, textB)';
  if (typeof textA !== 'string') throw new TypeError(`${at}：textA 必须是字符串，这里是 ${typeName(textA)}`);
  if (typeof textB !== 'string') throw new TypeError(`${at}：textB 必须是字符串，这里是 ${typeName(textB)}`);

  const g = gate(textA, textB);
  if (!g.ok) {
    return { verdict: 'invalid', changes: [], stats: emptyStats(), truncated: false, error: { which: g.which, line: null, column: null, reason: gateReason(g) } };
  }
  const ra = readJson(textA);
  const rb = readJson(textB);
  if (!ra.ok || !rb.ok) {
    const which = !ra.ok && !rb.ok ? 'both' : ra.ok ? 'b' : 'a';
    const first = ra.ok ? rb : ra;
    const reason = which === 'both'
      ? `A 侧：${ra.reason}｜B 侧同样不合法：${rb.reason}`
      : first.reason;
    return {
      verdict: 'invalid', changes: [], stats: emptyStats(), truncated: false,
      error: { which, line: first.line, column: first.column, reason },
    };
  }

  const changes = [];
  const stats = emptyStats();
  let keyOrderDiffers = false;
  let truncated = false;

  const emit = (kind, pointer, owner, depth, a, b) => {
    stats[kind] += 1;
    if (changes.length >= MAX_CHANGES) { truncated = true; return; }
    changes.push({
      pointer, kind, owner, depth,
      aPreview: previewOf(a), bPreview: previewOf(b),
      aType: a === undefined ? 'absent' : typeOf(a),
      bType: b === undefined ? 'absent' : typeOf(b),
    });
  };

  const stack = [{ a: ra.value, b: rb.value, pointer: '', depth: 0 }];
  while (stack.length) {
    const item = stack.pop();
    const { a, b, pointer, depth } = item;
    if (item.only) {
      if (item.only === 'a') emit('remove', pointer, 'only-a', depth, a, undefined);
      else emit('add', pointer, 'only-b', depth, undefined, b);
      continue;
    }
    stats.compared += 1;
    if (depth > stats.depth) stats.depth = depth;
    const ta = typeOf(a);
    const tb = typeOf(b);
    if (ta !== tb) { emit('type', pointer, 'both', depth, a, b); continue; }
    if (ta === 'object' || ta === 'array') {
      const isArr = ta === 'array';
      const keysA = isArr ? null : Object.keys(a);
      const keysB = isArr ? null : Object.keys(b);
      const lenA = isArr ? a.length : keysA.length;
      const lenB = isArr ? b.length : keysB.length;
      /** 子格清单先按顺序攒齐，再整批**倒着**压栈——弹出顺序就是攒的顺序 */
      const kids = [];
      if (isArr) {
        const min = Math.min(lenA, lenB);
        for (let idx = 0; idx < min; idx++) kids.push({ a: a[idx], b: b[idx], pointer: `${pointer}/${idx}`, depth: depth + 1 });
        for (let idx = min; idx < lenA; idx++) kids.push({ a: a[idx], only: 'a', pointer: `${pointer}/${idx}`, depth: depth + 1 });
        for (let idx = min; idx < lenB; idx++) kids.push({ b: b[idx], only: 'b', pointer: `${pointer}/${idx}`, depth: depth + 1 });
      } else {
        const inB = new Set(keysB);
        let sameOrder = lenA === lenB;
        if (sameOrder) {
          for (let k = 0; k < lenA; k++) if (keysA[k] !== keysB[k]) { sameOrder = false; break; }
        }
        for (const key of keysA) {
          const childPointer = `${pointer}/${escPointer(key)}`;
          if (inB.has(key)) kids.push({ a: a[key], b: b[key], pointer: childPointer, depth: depth + 1 });
          else kids.push({ a: a[key], only: 'a', pointer: childPointer, depth: depth + 1 });
        }
        for (const key of keysB) {
          if (hasOwn(a, key)) continue;
          kids.push({ b: b[key], only: 'b', pointer: `${pointer}/${escPointer(key)}`, depth: depth + 1 });
        }
        // 键集合相同而书写次序不同：这是"值相同"里唯一会说谎的那一格（Y3）
        if (!sameOrder && keysA.every((k) => inB.has(k)) && keysB.every((k) => hasOwn(a, k))) keyOrderDiffers = true;
      }
      for (let k = kids.length - 1; k >= 0; k--) stack.push(kids[k]);
      continue;
    }
    if (a !== b) emit('change', pointer, 'both', depth, a, b);
  }

  const total = stats.add + stats.remove + stats.change + stats.type;
  return {
    verdict: total === 0 ? (keyOrderDiffers ? 'same-key-order' : 'same') : 'diff',
    changes,
    stats,
    truncated,
    error: null,
  };
}

/**
 * 面板上那六句人话。每句都带自己那个数（Y18 逐句钉），因为它们写的是"这一页给的结果
 * 在哪一档上打了折"——降级、截断、不识别这三族在本页各有一档，用户有权知道。
 * `renderJsonTable` 把它们与原样拼进表尾（Task 4 接 Y18 的第二半）。
 */
export const DIFF_JSON_NOTES = {
  keyOrder: '键顺序无关：同一层里键的书写次序不同、值全都对得上，这一格不算变更，结论写「按 JSON 值判为相同」'
    + '而不是「完全相同」。要连书写次序一起比，请改用文本模式比对。',
  arrayMove: '数组按索引逐格比对，不识别移动：把某个元素挪到别的位置，报出来的是它后面每一格都变了。'
    + '识别移动要另一套对齐算法，而且"哪一格是移动来的"本身没有唯一答案，所以这一页不猜。',
  typeChange: '类型变化单独一档：同一格从数字变字符串、对象变数组都记为「类型变」，不与「值变了」混在同一个数里；'
    + '类型不同的那一格不再往里比，免得把一处改动报成十几处。',
  truncated: `变更表最多列出 ${MAX_CHANGES} 格，越线只截列表——上面那四个计数仍是全量，`
    + '没列出来的差额照样存在，本站不做静默截断。要看全量请改用文本模式比对。',
  depth: `容器嵌套上限是 ${MAX_DEPTH} 层，越线整份拒并点名出现在第几列；`
    + '比对走的是显式栈，所以 1000 层的合法输入照样比得完、比得对。',
  previewCut: `每格前后值的紧凑串最长 ${PREVIEW_CHARS} 个字符（含末尾那枚省略号），超出切一刀；`
    + '切点不会把 emoji 切成半个。要看某一格的全文请回文本模式比，那一条有可复制的统一差异。',
};
```

#### `scripts/toolkit-tests.mjs` §Y（整节，从 `// ── §Y` 那一行到本节末）

十八判逐字钉在这一块里：对拍那一片（Y1/Y2）、pointer 那两个转义次序（Y6/Y7）、
代理对不许切（Y8）、`owner` 与 `stats` 的自洽（Y9/Y13）、非法侧的点名口径（Y10/Y11）、
`MAX_CHANGES` 越线不许静默丢（Y12）、以及 Y16 那一句"同一把尺由同一个变量递过去"——
它直接复用 §X 那半边的 `X_BYTES` / `X_HUGE` / `dGate`，不在本节里再抄一份阈值。

```js
// ── §Y JSON 感知比对（`tools/diff-json.js`，段 5 Task 3）─────────────────────
// 这一族钉两件事：**两本独立实现必须同结论**，以及**这一页的比对口径只有一套**。
// §0.4 那条构建层的硬约束（`json-core.js` 已被 `toolJson.js` 那一个入口 reach，第二本入口再 reach 它
// 就被 Rollup 切成共享 chunk → 整页 SyntaxError 而构建 exit=0）换来的代价全在 Y1：
// **自带一份读侧不等于"复制一份就完事"**——同一批样本喂两本，合法/非法、非法时的行列、解出的值
// 三件必须同结论，先例是 §B 的"与站内旧库对拍"（两个独立实现同结论才算过）。
// 比对口径写死在这里，实现不许自创第二套：
//   · 对象按**键名**比、键顺序无关，只有顺序不同判 `same-key-order`，不许判 `same`（Y3）；
//   · 数组按**索引**比，"把 x[3] 挪到 x[1]"报成一串改而不是一处移动（Y5，spec §5.6 明写不做）；
//   · 两侧类型档不同单列一档 `type`，并且**不再往里比**（Y4、Y14）——`null` 是一种值，不是"没有值"；
//   · 一侧存在另一侧缺席是一档 `add` / `remove`，**整棵子树只报一格**（Y9）；
//   · Pointer 与 `json-core` 那份逐字符同规则，转义先 `~` 后 `/`（Y6、Y7）；
//   · 深度闸门 `MAX_DEPTH` 两本必须是同一个数，而 `diff-json.js` 源码里 `json-core` 出现 **0 次**（Y2）；
//   · 字节与行数两档闸门**只有 `diff-core.gate` 一处口径**、按侧判（Y16），`readJson` 自己不设闸门；
//   · `stats.compared` 数的是"两侧都有节点、因此逐格判过一次"的格数（判出不一致的也算判过）。
// §X 那两份顶层常量（`X_BYTES` / `X_HUGE` / `X_TOO_MANY` / `dGate`）在本节直接复用——
// 同一把尺要由同一个变量递过去，重新 import 一遍就成了两份。
const {
  MAX_DEPTH: Y_DEPTH, MAX_CHANGES: Y_CHANGES, PREVIEW_CHARS: Y_PREVIEW,
  readJson: yRead, pointerOf: yPointer, diffJson: yDiff, DIFF_JSON_NOTES: Y_NOTES,
} = await import('../dev/js/tools/diff-json.js');

/** 剥注释扫源码：闸门与 import 面只看代码，不看文档里的自我声明（与 §S 的 sCode 同一形状） */
const yCode = () => read('dev/js/tools/diff-json.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * 对拍用的好样本，每条各挑一件事（写死的串，不是生成时现造——红了第二次要能原样重放）：
 * 空白与 BOM、转义与 `\u`、代理对与**落单**的半个、`__proto__`、重复键、数字的各档形状、空容器、深容器。
 */
const Y_GOOD = [
  '{}', '[]', 'null', 'true', 'false', '0', '-0', '1e2', '3.5e-2',
  '{"a":1,"b":[1,2,{"c":"d"}]}',
  '{"a":{"a":{"a":[]}}}',
  '  \t\n{"k" : [ 1 , 2 ] }\r\n',
  '{"e":"\\u00e9\\n\\t\\"\\\\/"}',
  '{"emoji":"😀🦄","中":"键"}',
  '{"__proto__":{"polluted":1},"constructor":"x"}',
  '{"dup":1,"dup":2}',
  '\ufeff{"bom":true}',
  '{"neg":-1.5e-3,"max":1.7976931348623157e308}',
  '{"deep":[[[[[[1]]]]]]}',
  '{"esc":"\\ud83d\\ude00","lone":"\\ud83d"}',
  '{"s":"a\\/b\\tc \u007f"}',
  '{"n":null,"m":"","z":[]}',
  '[null,false,true,0,-0,"",[],{}]',
  '{"a":[[1],[2],{"b":null}],"c":{},"d":"x"}',
];

/** §S 那 20 格没走到的分支：`colon` 与 `sep` 两个状态、第二个 BOM、串内换行与没闭合到 EOF 的串 */
const Y_BAD_EXTRA = ['1e999', '{"a" 1}', '[1 2]', '{"a":}', '{"a":1\'}', '\ufeff\ufeff{}',
  '{"k":v}', '[,]', '{"a":1,,"b":2}', 'tru', '{"a":[1,2]', '{"a":1}}', '{"a":"x', '{"a":"b\nc"}'];

test('Y1 与 json-core 对拍：同一批样本两本读侧三件同结论（合法/非法、非法的行列、解出的值）', () => {
  const bad = S_BAD.map(([id, text]) => [id, text === null ? '['.repeat(MAX_DEPTH + 1) : text]);
  for (const [k, t] of Y_BAD_EXTRA.entries()) bad.push([`Y1x${k}`, t]);
  const good = Y_GOOD.map((t, k) => [`Y1g${k}`, t]);
  assert.equal(bad.length, 34, '样本集是本格的承重墙：§S 那 20 格一格都不许掉，少的这一格就是少的那一片分支');
  assert.ok(good.length >= 24, '好样本缩到一组以下，对拍就退化成"两边都收"');
  for (const [tag, src] of [...bad, ...good]) {
    const p = parseJson(src);
    const r = yRead(src);
    assert.equal(r.ok, p.ok, `${tag} 的合法/非法结论必须同：${JSON.stringify(src.slice(0, 24))}`);
    if (p.ok) {
      assert.deepStrictEqual(r.value, p.value, `${tag} 解出的值必须逐格同（键序与原型污染那两处最容易分叉）`);
    } else {
      assert.equal(r.kind, p.error.kind, `${tag} 的 kind —— ${JSON.stringify(src.slice(0, 24))}`);
      assert.equal(r.line, p.error.line, `${tag} 的 line —— 位置差一格和没报错一样有害`);
      assert.equal(r.column, p.error.column, `${tag} 的 column —— 数的是 UTF-16 码元，一个 emoji 占两列`);
      assert.ok(typeof r.reason === 'string' && r.reason.length > 0, `${tag} 要给得出那句人话`);
    }
  }
  // 量具自己要有牙：八类 kind 必须由这批样本**真的**踩到，否则"两边都拒"可能只是拒在同一处
  const kinds = new Set(bad.map(([, t]) => yRead(t).kind));
  for (const k of ['empty', 'unterminated', 'unexpected-char', 'bad-escape', 'bad-number',
    'unterminated-string', 'depth', 'trailing']) {
    assert.ok(kinds.has(k), `样本集没踩到 ${k} 那一类，这一族的对拍对它就没有牙`);
  }
});

test('Y2 深度闸门两本是同一个数，而 diff-json.js 的源码里 json-core 出现 0 次（§0.4 那条构建红线）', () => {
  assert.equal(Y_DEPTH, MAX_DEPTH, 'MAX_DEPTH 分叉 = 同一份输入两页一个收一个拒');
  assert.equal(Y_DEPTH, 1000, '改这一档要同时改 json-core、spec §7 与本判据，三处一起才算数');
  const src = yCode();
  assert.equal(src.includes('json-core'), false,
    '自带一份的前提是真的不 import：两本入口 reach 同一模块就是共享 chunk，包完整页 SyntaxError');
  const declared = src.match(/export const MAX_DEPTH = (\d+);/);
  assert.ok(declared, '深度那一档在源码里必须是写死的字面量，不许从别处读');
  assert.equal(declared[1], String(Y_DEPTH));
  assert.equal(yRead('['.repeat(Y_DEPTH + 1)).kind, 'depth', '第 1001 层容器照样拒，与 json-core 同档');
});

test('Y3 键顺序无关：只有顺序不同判 same-key-order 而不是 same，数组换了位置仍判 diff', () => {
  for (const [a, b] of [
    ['{"b":2,"a":1}', '{"a":1,"b":2}'],
    ['{"x":{"b":2,"a":1},"y":[1]}', '{"x":{"a":1,"b":2},"y":[1]}'],
  ]) {
    const r = yDiff(a, b);
    assert.equal(r.verdict, 'same-key-order', `${a} ↔ ${b} 只差键顺序，直接报"完全相同"是这一页最容易说谎的一处`);
    assert.equal(r.changes.length, 0, '顺序差不是变更，列出来就是把同一件事说两遍');
    assert.equal(r.truncated, false);
    assert.strictEqual(r.error, null);
    assert.ok(r.stats.compared > 0, '这一档仍然真的比过，compared 不许跟着变 0');
  }
  assert.equal(yDiff('{"a":1,"b":2}', '{"a":1,"b":2}').verdict, 'same', '逐格同序才配得上 same');
  assert.equal(yDiff('[1,2]', '[2,1]').verdict, 'diff', '数组按索引比，换了位置就是两处不同（Y5 那一句）');
  assert.equal(yDiff('{"a":[1,2]}', '{"a":[1,2]}').verdict, 'same');
});

test('Y4 类型变化单列一档 type：1→"1"、{}→[]、null→缺键 三档各自的 kind 与 aType/bType', () => {
  const one = yDiff('{"v":1}', '{"v":"1"}');
  const c1 = one.changes[0];
  assert.equal(c1.kind, 'type', '类型变了不许混进 change——那两个数读出来是两回事');
  assert.deepEqual([c1.pointer, c1.aType, c1.bType, c1.owner, c1.depth], ['/v', 'number', 'string', 'both', 1]);
  assert.deepEqual([one.stats.type, one.stats.change], [1, 0], 'change 那一档必须真的是 0');
  const two = yDiff('{}', '[]').changes[0];
  assert.deepEqual([two.kind, two.pointer, two.aType, two.bType], ['type', '', 'object', 'array']);
  const three = yDiff('{"a":null}', '{}').changes[0];
  assert.equal(three.kind, 'remove', 'null 是值、缺键是没有值，两档不许并成一档');
  assert.deepEqual([three.aType, three.bType], ['null', 'absent']);
  const four = yDiff('{"a":null}', '{"a":1}').changes[0];
  assert.equal(four.kind, 'type', 'null 与 number 也是两档——null 是一种值，不是"没有值"');
  assert.equal(yDiff('{"a":[1]}', '{"a":{"0":1}}').changes[0].kind, 'type', '数组与对象在同一路径下就是类型变');
  assert.equal(yDiff('{"a":1}', '{"a":[1]}').changes[0].kind, 'type');
  assert.equal(yDiff('{"a":1}', '{"a":[1]}').changes.length, 1, '类型变之后不再往里比，免得把一格报成两格');
});

test('Y5 数组按索引比：中间插一项会报成一串改，这是设计而不是缺陷，那句说明必须给得出', () => {
  const r = yDiff('[1,2,3,4]', '[1,9,2,3,4]');
  assert.equal(r.verdict, 'diff');
  assert.deepEqual(r.changes.map((c) => [c.pointer, c.kind, c.owner]),
    [['/1', 'change', 'both'], ['/2', 'change', 'both'], ['/3', 'change', 'both'], ['/4', 'add', 'only-b']],
    '把 9 插在中间，报的是"其后每一格都变了"——识别移动这件事本站明写不做');
  assert.deepEqual([r.stats.change, r.stats.add, r.stats.remove, r.stats.type], [3, 1, 0, 0]);
  assert.ok(Y_NOTES.arrayMove.includes('索引') && Y_NOTES.arrayMove.includes('移动'),
    `那句要说清"按索引比"与"不识别移动"：${Y_NOTES.arrayMove}`);
});

test('Y6 Pointer 的转义与 json-core 那份逐字符同规则：~、/、空串键、数字键四种', () => {
  for (const k of ['~', '/', '', '0', '10', 'a/b', 'a~b', '~/']) {
    assert.equal(yPointer([k]), toPointer([k]), `${JSON.stringify(k)} 这一段两本必须编出同一个串`);
    assert.deepEqual(fromPointer(yPointer([k])), { ok: true, segments: [k] },
      '编出去还得解得回来，且解回原样——指针是给用户粘进 RFC 6901 的实现里用的');
  }
  assert.equal(yPointer(['a', 'b/c', 3]), toPointer(['a', 'b/c', 3]), '数字段两本都按十进制字符串进指针');
  assert.equal(yPointer([]), '', '根那一格就是空串，与 json-core 的 toPointer([]) 同形');
  const r = yDiff('{"a/b":1,"c~d":2}', '{"a/b":9,"c~d":8}');
  assert.deepEqual(r.changes.map((c) => c.pointer), ['/a~1b', '/c~0d']);
  assert.deepEqual(yDiff('{"":1}', '{"":2}').changes.map((c) => c.pointer), ['/'],
    '空串键的指针是一格 /，与根那个空串不是同一格');
});

test('Y7 转义次序钉死：先 ~ 后 /，两趟反过来会把 ~1 再转义一次', () => {
  assert.equal(yPointer(['~1']), '/~01', '键名本身写着 ~1 时必须编成 ~01；先 / 后 ~ 的两趟写法会解错');
  assert.equal(yPointer(['~/']), '/~0~1', '这一格是两种次序唯一能分开的形状：反过来得到的是 ~0~01');
  assert.equal(yPointer(['~01']), '/~001');
  for (const k of ['~1', '~0', '/~', '~01', '~0~1']) {
    assert.deepEqual(fromPointer(yPointer([k])), { ok: true, segments: [k] }, `${k} 必须原样回来`);
  }
});

test('Y8 预览串：越 PREVIEW_CHARS 才带省略号，切点不许切断代理对', () => {
  const lone = 'x'.repeat(Y_PREVIEW - 2) + '😀' + 'z';
  const preview = yDiff(`{"a":"${lone}"}`, '{"a":"other"}').changes[0].aPreview;
  assert.equal(preview, `"${'x'.repeat(Y_PREVIEW - 2)}…`,
    '切点正好落在代理对中间：那一枚高位代理项必须退回，省略号还要算进预算内');
  assert.ok(preview.length <= Y_PREVIEW, `预算是含省略号的总长：${preview.length} > ${Y_PREVIEW}`);
  for (let k = 0; k < preview.length; k++) {
    const c = preview.charCodeAt(k);
    if (c >= 0xd800 && c <= 0xdbff) {
      const nx = preview.charCodeAt(k + 1);
      assert.ok(nx >= 0xdc00 && nx <= 0xdfff, `切出孤立高位代理项（第 ${k} 格），交出去的就不再是合法 JSON`);
      k += 1;
    } else assert.ok(!(c >= 0xdc00 && c <= 0xdfff), `第 ${k} 格是孤立低位代理项`);
  }
  const short = yDiff('{"a":"1"}', '{"a":"2"}').changes[0];
  assert.deepEqual([short.aPreview, short.bPreview], ['"1"', '"2"'], '没越线就一个字符都不许切');
  assert.deepEqual([yDiff('{"a":[1,2,3]}', '{"a":"x"}').changes[0].aPreview,
    yDiff('{"a":{"b":1}}', '{"a":"x"}').changes[0].aPreview], ['[1,2,3]', '{"b":1}'],
    '容器给的是紧凑形式，不是"（对象）"这种没信息量的占位');
  const wide = yDiff(`{"a":{"k":"${'y'.repeat(Y_PREVIEW + 40)}"}}`, '{"a":1}');
  assert.ok(wide.changes[0].aPreview.length <= Y_PREVIEW, '整棵子树一起压进预算，不许先拼再切出天文数字');
});

test('Y9 owner 三档在深层路径下的形状：缺席一侧给 null 预览，整棵子树只报一格', () => {
  const add = yDiff('{}', '{"a":{"b":{"c":[1,2]}}}').changes;
  assert.equal(add.length, 1, '新增一整棵子树是一格变更，摊成五格就是把同一个决定说五遍');
  assert.deepEqual([add[0].pointer, add[0].kind, add[0].owner, add[0].depth, add[0].aPreview, add[0].aType],
    ['/a', 'add', 'only-b', 1, null, 'absent']);
  assert.equal(typeof add[0].bPreview, 'string', '在场那一侧的预览照给，否则这一格读起来是空的');
  const rm = yDiff('{"a":{"b":1}}', '{}').changes;
  assert.deepEqual([rm[0].pointer, rm[0].kind, rm[0].owner, rm[0].aType, rm[0].bPreview],
    ['/a', 'remove', 'only-a', 'object', null]);
  const both = yDiff('{"a":{"b":[0,{"z":1}]}}', '{"a":{"b":[0,{"z":2}]}}');
  assert.deepEqual([both.changes.length, both.changes[0].pointer, both.changes[0].owner, both.changes[0].depth],
    [1, '/a/b/1/z', 'both', 4]);
  assert.deepEqual([both.changes[0].aPreview, both.changes[0].bPreview], ['1', '2']);
  assert.equal(yDiff('[1]', '[]').changes[0].owner, 'only-a', '数组尾部少一项是 remove，指针是那个下标');
});

test('Y10 一侧非法：error.which 点名是哪一侧，另一侧即使合法也不比', () => {
  const r = yDiff('{', '1');
  assert.equal(r.verdict, 'invalid');
  assert.deepEqual([r.error.which, r.error.line, r.error.column], ['a', 1, 2], '行列给的是坏的那一侧');
  assert.equal(r.error.reason, yRead('{').reason, '那句理由直接来自读侧，不在这里另编一套');
  assert.deepEqual([r.changes.length, r.truncated, r.stats], [0, false,
    { add: 0, remove: 0, change: 0, type: 0, compared: 0, depth: 0 }], '坏输入那一档七个数全给 0，而不是"没有这一格"');
  const b = yDiff('1', '[1,');
  assert.deepEqual([b.error.which, b.error.line, b.error.column], ['b', 1, 4]);
  assert.equal(b.changes.length, 0, '一侧坏了就不比——比出来的表会把人引向另一侧');
});

test('Y11 两侧都非法：which 是 both，行列报 A 那一侧，两句理由都给', () => {
  const r = yDiff('{', "'a':1");
  assert.equal(r.verdict, 'invalid');
  assert.equal(r.error.which, 'both');
  const ea = yRead('{').reason;
  const eb = yRead("'a':1").reason;
  assert.deepEqual([r.error.line, r.error.column], [1, 2], '顺序口径写死：两侧都坏时报 A 的行列');
  assert.ok(r.error.reason.includes(ea) && r.error.reason.includes(eb),
    `两侧都坏时不许只说一侧：${r.error.reason}`);
  assert.equal(r.error.reason.includes('B'), true, '那一句要让人知道两侧都得修');
});

test('Y12 MAX_CHANGES 越线：truncated 为真、只列前 5000 格，四个计数仍是全量', () => {
  const over = Array.from({ length: Y_CHANGES + 1000 }, (_, k) => `"k${k}":1`).join(',');
  const r = yDiff('{}', `{${over}}`);
  assert.equal(r.truncated, true);
  assert.equal(r.changes.length, Y_CHANGES, '列出的格子必须正好卡在预算上，多一格都不许');
  assert.equal(r.stats.add, Y_CHANGES + 1000, '截了列表不许顺手把总数也截了——那句"还有没列出的"靠它');
  assert.equal(r.verdict, 'diff');
  assert.ok(Y_NOTES.truncated.includes(String(Y_CHANGES)), `那句要给得出预算数额：${Y_NOTES.truncated}`);
  const under = yDiff('{}', `{${Array.from({ length: Y_CHANGES - 1 }, (_, k) => `"k${k}":1`).join(',')}}`);
  assert.equal(under.truncated, false, '卡在线上那一格以内不许报截断——报了就是又一次说谎');
  assert.equal(under.changes.length, Y_CHANGES - 1);
});

test('Y13 stats 四档与 changes 自洽：compared 与 depth 按构造算得出', () => {
  const r = yDiff('{"a":1,"b":{"c":3},"d":[1,2],"x":true}', '{"a":"1","b":{"c":3},"d":[1,2,9],"y":null}');
  assert.deepEqual(r.stats, { add: 2, remove: 1, change: 0, type: 1, compared: 7, depth: 2 },
    'compared 数的是"两侧都有节点、因此逐格判过一次"的格数（根与 /a 那格判出不一致也算判过）');
  for (const kind of ['add', 'remove', 'change', 'type']) {
    assert.equal(r.changes.filter((c) => c.kind === kind).length, r.stats[kind],
      `${kind} 的计数必须等于它自己那一档的条数`);
  }
  assert.equal(r.changes.length, r.stats.add + r.stats.remove + r.stats.change + r.stats.type,
    '不截断时四档之和就是列出的格数——这是"没有静默丢"的唯一可读证据');
  assert.deepEqual(r.changes.map((c) => c.kind), ['type', 'add', 'remove', 'add'],
    '变更按文档顺序给：先 A 侧的键、再 B 侧多出来的键，同一份输入两次同序');
});

test('Y14 空档：{} vs {}、[] vs [] 判 same，{} vs [] 是 type，空容器与缺席键不是一回事', () => {
  for (const t of ['{}', '[]', '0', '""']) {
    const r = yDiff(t, t);
    assert.equal(r.verdict, 'same', `${t} 与自己比必须判 same`);
    assert.deepEqual([r.changes.length, r.stats.compared, r.stats.depth], [0, 1, 0]);
  }
  const e = yDiff('{}', '[]');
  assert.deepEqual([e.verdict, e.changes.length, e.changes[0].kind, e.changes[0].pointer],
    ['diff', 1, 'type', ''], '空对象与空数组是类型变，不是"都空所以相同"');
  assert.equal(yDiff('{}', '{"a":{}}').changes[0].kind, 'add');
  assert.equal(yDiff('{"a":{}}', '{"a":{}}').verdict, 'same', '空容器相等，不许因为"没内容"就漏报成两侧缺席');
  assert.equal(yDiff('[]', '[1]').changes[0].kind, 'add');
  assert.deepEqual([yDiff('', '').verdict, yDiff('', '').error.which], ['invalid', 'both'],
    '两侧都空是"没内容可读"，不是"两份空文件相同"');
});

test('Y15 depth 读数：每下一段加一，根那一格是 0，1000 层的合法输入照样走得完', () => {
  const build = (leaf, levels) => {
    let v = String(leaf);
    for (let k = 0; k < levels; k++) v = `{"a":${v}}`;
    return v;
  };
  const r = yDiff(build(1, 8), build(2, 8));
  assert.equal(r.changes.length, 1);
  assert.equal(r.changes[0].pointer, '/a/a/a/a/a/a/a/a');
  assert.deepEqual([r.changes[0].depth, r.stats.depth], [8, 8]);
  assert.equal(r.changes[0].aPreview, '1', '叶子那一格的预览就是它自己');
  const deep = yDiff(build(1, Y_DEPTH), build(2, Y_DEPTH));
  assert.equal(deep.changes.length, 1, '1000 层比栈深敏感——这一族走的是显式栈，抛 RangeError 就是整页空白');
  assert.deepEqual([deep.changes[0].depth, deep.stats.depth], [Y_DEPTH, Y_DEPTH]);
  assert.equal(deep.truncated, false);
});

test('Y16 入参口径：非字符串抛 TypeError，字节与行数两档走 diff-core 那一把尺（按侧判）', () => {
  for (const [name, call] of [
    ['readJson', () => yRead(1)], ['readJson', () => yRead(null)], ['readJson', () => yRead(['{"a":1}'])],
    ['diffJson(textA, textB)', () => yDiff(1, '1')], ['diffJson(textA, textB)', () => yDiff('1', undefined)],
    ['pointerOf(segments)', () => yPointer('a')], ['pointerOf(segments)', () => yPointer(null)],
  ]) {
    assert.throws(call, (e) => e instanceof TypeError && e.message.includes(name),
      `${name} 要抛点名的 TypeError——入参形状不对是调用侧的错，不许咽进返回值`);
  }
  const bytes = yDiff(X_HUGE, '1');
  assert.equal(bytes.verdict, 'invalid', '闸门排在读之前，不许先把 5MB 解析完再拒');
  assert.deepEqual([bytes.error.which, bytes.error.line, bytes.error.column], ['a', null, null],
    '闸门这一档没有"出错的那一格"可指，行列给 null 而不是硬编一个 1');
  assert.ok(bytes.error.reason.includes(String(X_BYTES)) && bytes.error.reason.includes(String(X_BYTES + 7)),
    `那句要给得出上限与实测：${bytes.error.reason}`);
  assert.equal(dGate(X_HUGE, '1').over.bytesA, 7, '同一把尺：这一档的差额由 diff-core 的 gate 出，不是第二套');
  assert.equal(yDiff('1', X_HUGE).error.which, 'b',
    '按侧判不按两侧合计判——合起来判会让"一侧塞满、一侧空着"整页不可用');
  const lines = yDiff(X_TOO_MANY, '1');
  assert.ok(lines.error.reason.includes(String(X_LINES)), `行数那一档说的是行数：${lines.error.reason}`);
  assert.equal(lines.error.reason.includes(String(X_LINES + 3)), true, '上限之外还要给实测');
});

test('Y17 数字口径按值不按字面：1 与 1.0 与 1e0 同值，"1" 是 type，1 与 1.5 是 change', () => {
  assert.equal(yDiff('1', '1.0').verdict, 'same');
  assert.equal(yDiff('1', '1e0').verdict, 'same');
  assert.equal(yDiff('{"n":[1,1.0,1e0]}', '{"n":[1,1,1]}').verdict, 'same', '数组里的数字同口径');
  assert.equal(yDiff('-0', '0').verdict, 'same', '按 JSON 值判就是按 === 判：-0 与 0 是同一个数');
  assert.equal(yDiff('1', '0').verdict, 'diff', '别把 1 和 0 看成同值');
  assert.equal(yDiff('1', '"1"').changes[0].kind, 'type');
  assert.equal(yDiff('1', '1.5').changes[0].kind, 'change');
  assert.equal(yDiff('1e2', '100').stats.compared, 1, '同值那一档只判一根格，不许因为字面不同就多比一次');
});

test('Y18 DIFF_JSON_NOTES 六句各管一件事：非空、带自己那个数、不许留占位（上页面那一半由 §Z 接）', () => {
  const keys = ['keyOrder', 'arrayMove', 'typeChange', 'truncated', 'depth', 'previewCut'];
  assert.deepEqual(Object.keys(Y_NOTES), keys, '六句就是六句，多一句少一句都得先改 §1.2 的契约');
  for (const k of keys) {
    assert.equal(typeof Y_NOTES[k], 'string', `缺 ${k} 那一句`);
    assert.ok(Y_NOTES[k].length > 20, `${k} 那句短得不像在说一件事：${Y_NOTES[k]}`);
    assert.notEqual(Y_NOTES[k], '…', '起草时契约里写的就是这个占位串，落地时不许原样留着');
  }
  assert.ok(Y_NOTES.keyOrder.includes('键顺序'), Y_NOTES.keyOrder);
  assert.ok(Y_NOTES.typeChange.includes('类型'), Y_NOTES.typeChange);
  assert.ok(Y_NOTES.depth.includes(String(Y_DEPTH)), `深度那句要给得出闸门：${Y_NOTES.depth}`);
  assert.ok(Y_NOTES.previewCut.includes(String(Y_PREVIEW)), `预览那句要给得出长度：${Y_NOTES.previewCut}`);
  assert.ok(Y_NOTES.truncated.includes('截'), `截断那句要明说"后面还有没列出的"：${Y_NOTES.truncated}`);
});
```

---

## Task 4：`diffView.js` 纯字符串视图层 + §Z 前半

**Files：** Create `dev/js/tools/diffView.js`；Modify `scripts/toolkit-tests.mjs`（新节 `// ── §Z …`，
本格只落前半，Task 5 在同一节续写——**节名不另起**，先例是 §U）。

- [ ] **Step 1：写判据 Z1–Z12**：视图层零 import（源码扫）、`esc` 由 `env` 注入且缺失时**构造期**
      `TypeError`（那句理由与 §W 的"抛在挂载期就是整页空白"同一条）、并排两栏的行数必须相等
      （对齐是视图层的责任不是装配层的）、`change` 行在左右两栏各出现一次且各自只高亮自己那半、
      `crlf` 那一格画 `CR_GLYPH` 而不是留白、折叠条那句"省略 N 行"的 N 与 `Row.skipped` 同源、
      所有产出过 `env.esc`（拿 `<script>` 与 `"` 与换行三类样本断言）、`textContent` 型字段
      （行内容）不许出现在属性位、JSON 变更表那六列的表头与 `DIFF_JSON_NOTES` 同页、
      坏输入态的 `renderNotice` 只有一句且不吞掉别的文案、`df-` 字面量在本文件源码里 **0 次**
      （类名一律由 `env.prefix` 派生，同 §W10 的整格字面量口径）。
- [ ] **Step 2：写实现到绿**；**Step 3：登记镜像** + `--fix`；**Step 4：门禁①②③**；
- [ ] **Step 5：提交** `feat(tools): 段 5 Task 4 对比页视图层——diffView 与 §Z 前半十二判`。

---

## Task 5：`diffWorkbench.js` + `toolDiff.js` + §Z 后半 + 收录面门禁两处

**Files：** Create `dev/js/tools/diffWorkbench.js`、`dev/js/toolDiff.js`；
Modify `scripts/check-tools-surface.mjs`（§0.3(a) 那两处）、`scripts/check-tools-surface-teeth.mjs`（三刀 + 缺省档那一刀）、
`scripts/toolkit-tests.mjs`（§Z 续写）。

- [ ] **Step 1：写 §Z 后半判据（Z13–Z28）**——六条红线各自的形状：装配层零环境词（词表里
      **多两枚 `FileReader` / `File`**，全页 0 命中的那条要写成"入口恰好 1 次、装配层 0 次"）、
      id 只由 `DIFF_SPEC` / `DIFF_ACTIONS` 派生、挂载期一次计算都不做（输入 `input` 二十次之后
      注入的 `runGuarded` 计数为 0）、两类失败分两条路（用户空输入 → `FieldError` → 一句提示；
      spec 与骨架漂移 → 原样上抛且**不擦掉上一格结果**）、换前缀自证（`df` ↔ `zx` 一整页 id 跟着换、
      门禁仍绿，照 §R16 / §W18 那一形状）、`diff-json` 与 `diff-core` 各自只被本装配层 reach 一次
      （import 边闭合，防渗透的正向核 + 反向核照 M16 / N19 的排除式写法）。
- [ ] **Step 2：写实现到绿**。
- [ ] **Step 3：拆 `check-tools-surface.mjs` 那颗牙**——按 §0.3(a) 落 `cfg.nodes` 与
      `DEFAULT_NODE_FAMILIES`，扩孤儿判据到节点族（只对声明了 `nodes` 的条目生效）。
- [ ] **Step 4：补牙齿四刀**（T-a / T-b / T-c + 缺省档那一刀），逐刀点燃并记进台账。
- [ ] **Step 5：登记三本镜像**（`diffWorkbench.js` / `toolDiff.js` / 改过的 `check-tools-surface.mjs`）+ `--fix`。
- [ ] **Step 6：门禁①②③⑤⑥**（⑤⑥ 此时还没有第四页，跑的是"存量三页不回归"那一档）。
- [ ] **Step 7：提交** `feat(tools): 段 5 Task 5 对比页装配层与入口——§Z 续到二十八判，收录面 nodes 拆牙`。

---

## Task 6：页面源 + `toolDiff.scss` + 第四枚图标 + yml 登记（收录面）

**Files：** Create `tools-diff.html`、`dev/sass/toolDiff.scss`、`assets/img/tools/diff-tool.svg`；
Modify `_data/onlineTools.yml`（追加一条 `slug: diff`）、`postcss.config.js`（加 `'.df-'`）、
本计划。

- [ ] **Step 1：写 `tools-diff.html`**——`layout: default` + `title` / `seo_description` / `permalink`，
      骨架**全部构建期渲染**（禁 JS 读得到正文与六句说明），两条 `<script>` 排正文之后
      （`toolkitCore.min.js` 在前，顺序与 `tools-json.html` 同一条硬前提），四格 `data-df-*` 属性、
      六族 id、十四枚按钮的文案与 `DIFF_ACTIONS[i].label` 逐字同（门禁⑤那条按钮文案对账就是为它设的）。
- [ ] **Step 2：写 `dev/sass/toolDiff.scss`**——本页独有形状；只用 `--ink` / `--ink-2` / `--ink-3`，
      `--ink-4` 不得用于 <18px 正文；`--df-row-h` 是唯一赋值处（照 `--jt-row-h` 那一格，入口读一次）。
- [ ] **Step 3：`postcss.config.js` 加 `'.df-'`**，并按 §0.5 那条缓存坑自证产物里没有 `vw`。
- [ ] **Step 4：`_data/onlineTools.yml` 追加第四格**（`prefix: df`、`layout: workbench`、`actions: 14`、
      `spec` 四格指针、`panels: []`、`desc` + `features` 五条）。**这一格是全段唯一会让
      每一页 HTML 变长的一笔**，所以 Step 5 之后立刻做一次"改前/改后 `_site` 逐页 diff"，
      差额记进 Task 7 的账（§0.3(b)）。
- [ ] **Step 5：构建两遍**（`npx vite build` + `bundle exec jekyll build`）→ 门禁④ + 门禁⑤，
      `assets/js/*.min.js` 的 `import{` 命中必须是 0。
- [ ] **Step 6：登记四本镜像**（页面源、scss、svg、yml）+ `--fix` + 门禁①②③⑥。
- [ ] **Step 7：提交** `feat(tools): 段 5 Task 6 第四页收录面——tools-diff.html + toolDiff.scss + yml 登记`。

---

## Task 7：浏览器核验 + §7 两行先量后立 + 四页首屏一起重量

**Files：** Create `scripts/verify-diff-browser.mjs`（或按现行 harness 的既有形状扩
`scripts/verify-tools-browser.mjs` 的 `BUDGET_ROWS` 与页集，二选一由本格实读决定并在此登记）；
Modify `_docs/superpowers/specs/2026-09-25-blog-online-tools-design.md`（§7 两行把"待量"换成实数）。

- [ ] **Step 1：清场**——`ps` / `lsoff` 证明没有遗留 runner 与占用端口（项目记忆那条
      "e2e 前先清遗留进程与端口"，本轮并行会话负载到过 500）。
- [ ] **Step 2：十档视口 × 本页**（1a–1e 那五档沿用，另加对比页独有的两档：并排视图在 ≤640 必须
      退成上下堆叠而不是横向挤压；折叠条在 360 档不得把"省略 N 行"截成两个字）。
- [ ] **Step 3：本页专属的交互族**——真实鼠标点击要过命中测试（`elementFromPoint` 自证落点）、
      拖入文件与 `<input type=file>` 两路各跑一次（`DataTransfer` 造的那份不算，要真文件描述符）、
      非 UTF-8 与含 NUL 的两份样本必须被拒并给那句、超 5 MiB 的样本**先按 size 拒**（断言
      `FileReader` 一次都没被叫）、禁 JS 档读得到整页正文与六句说明、`console.error` 为 0（6a 那一族）。
- [ ] **Step 4：`§7` 两行先量后立**——口径 `cat f | gzip -9 | wc -c`，件集与档位推导照 §7 表格那两行写。
- [ ] **Step 5：四页首屏 + 三页总量一起重量**（§0.3(b) 那一格），A/B 两份可比产物（同一份工作树、
      只差 yml 那一格）量出登记第四页这一笔的**逐页差额**；证件页首屏余量若掉到 300B 以下 →
      **BLOCKED 停下交回**，附三种处置的字节账。
- [ ] **Step 6：提交** `test(tools): 段 5 Task 7 对比页浏览器核验——§7 两行先量后立，四页首屏一起重量`。

---

## Task 8：变异台账 + 六道门禁全量 + 自证

- [ ] Step 1：§X/§Y/§Z 三族逐族注入变异（每族 ≥5 刀，记"单红/恰目标"），照段 3/段 4 的台账形状；
- [ ] Step 2：`verify-plan-blocks-teeth.mjs` 为"第四份计划接手 §X–§Z"补刀（清单漏项反查、
      §X 节被截短的假"逐字节不等"那一族）；
- [ ] Step 3：六道门禁全量重跑（**只对改动文件跑 prettier/eslint 不算过**——本仓库根本没有这些配置，
      这条记在项目记忆里）；① 高负载假红按 §0.8 那句处理，不改判据、不并进绿；
- [ ] Step 4：干净检出（`git archive HEAD` 导出树）自证：门禁② 与⑤在导出树里退 0；
- [ ] Step 5：提交 + 把 commit 号续进台账那一格。

---

## Task 9：对账收口

- [ ] Step 1：spec ↔ 实现逐格对账（§5.6 那六条、§7 那两个新行、§8.1 三族、§12 六段），
      发现文档与代码不一致时**改文档**，除非是代码错了；
- [ ] Step 2：§7 全表（含 2026-09-30 之前六行）按现行产物重算一次，与 Task 7 的读数对得上才对；
- [ ] Step 3：索引条那 10 枚死锚点按 §0.3(b) 的条件交回（修 A / 修 B 两份代价 + 重量后的余量）；
- [ ] Step 4：`USAGE.md` 的检索层自查计数（等对方那格 `1/76` 先落地，§0.7 第 4 条）；
- [ ] Step 5：收口记录 + 六道门禁复跑 + 提交；
- [ ] Step 6：**单独请示推送**（含"要不要连带另一路会话那二十六条一起发"）。
