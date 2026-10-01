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
| §1.1「`hunksOf(result, context)` → 折叠后的块」与 §5.6「未变行折叠」——**两份完全相同那一档没写** | 完全相同时返回 `[]`，一块都不给；视图层画零行，那句"逐字符相同"的文案归装配层（Task 5） | 折叠的输入是"差异游程"，`runs.length === 0` 就没有块。硬造一块"全篇上下文"会让第一块 `skipped` 与末块 `tailSkipped` 双双为 0，页面上多出一条**谁都不想要的折叠条**，而那一档本来没有可折叠的东西。Z4 钉的是"给它零行就画零行"；那句话由 §Z 后半的装配层判据来咬 |
| §1.1 `Row.inline` 那格写的是"一份 `[{t,text}]`（或 `null`）"，没说两侧各取哪几档 | 序列里 equal/del/ins **混着放**，视图层按侧**筛**：`INLINE_BY_SIDE = {a: ['equal','del'], b: ['equal','ins']}`；tone 不在那三档才抛 | "两侧各画一半"是渲染事实，不是数据事实：存一份混合序列，X20/X21 那种"两侧逐字符能各自拼回原文"的对拍才成立，各存一半就是两份真相。按侧筛而不是按侧取，装配层从此不必知道行内是怎么存的（Z5 钉两栏各自只高亮自己那半，并把两栏的产出串逐字符钉下来） |
| §5.6「并排两栏逐行对齐」没写缺席那一侧长什么样 | 那一格画 `--fill`：**行还在**，但没有 `ln` 属性、没有行号、正文为空 | 少一行，两栏就从这一行起永久错位；画一个"看起来像 0"的行号是编造读数。`Row.a` / `Row.b` 的 `null` 是唯一真相，视图层把它翻译成"这一侧在这里什么都没有"（Z4 同时钉两栏块数相等与"不许给自己编行号"两半） |
| 测试文件头部那张"用例分布"表（`§A` 的第二现场） | 补 §Z 那一行（`12`，前半）、合计 `410` → **`422`** | §Z 前半落进磁盘，那张表就过期了；重算口径照旧是 §A 注释里那条 awk（按行首 `^test(` 数每段），逐段读数 `…§Y: 18 / §Z: 12`，合计与 runner 的 `# tests 422` 对上才算对完账。那张表长在磁盘 §A 里，所以 `--fix` **又一次**把段 1 那份计划的 §A 镜像整块换成磁盘内容（`6526 → 6530 行`）——本提交因此再带一份段 1 计划的改动，只碰 §A 那一个块 |
| §1.4 草图的 `controls: [{ id: 'text' }, { id: 'file' }, …]`（两栏同名） | 栏位**编进控件 id**：`a-text` / `b-file` / `b-name`，`fieldId(p, panel, id)` 那一格不加维 | 门禁⑤ 的控件 id 公式是全页共用的 `{p}-in-{面板}-{控件}`（`check-tools-surface.mjs` 里对 `panels` 支与 `workbench` 支是同一条），给这一页单开一维等于在门禁里立第二套地址口径——而 `panels` 支那两页会跟着一起改形。代价写进 Z17：`a` / `b` 两栏的控件必须以栏位起头，判据把这条口头约定钉成断言 |
| §1.4 草图的 `a` / `b` 栏 `nodes: ['out','status','copy']`、`bar` 栏 `nodes: []` | 落地：两栏各 `['status','copy']`，`bar` 是 `['out','status']`，`nodes` 由**每一栏自己声明** | 并排视图只有一个结果区（住在 `bar`），两条输入栏各有状态行与栏内复制。写死四族会让这一页去要六个它根本没有的 id（`df-out-workbench-a` 之类），所以门禁⑤ 那一族改成"声明了就按声明要、没声明仍按默认四族"——**只放宽新页，存量三页一字不松**，那件事由门禁⑥ 的「JSON 页产物缺 tree 那一格」那把刀自证 |
| §5.6「并排两栏逐行对齐」没写两栏是不是**各一个滚动容器** | 一栏一个 `div.{p}-col`，两块 `{p}-col` 同处**一个**结果区滚动容器里；草图里的 `toA` / `toB` 两枚因此不成立 | "同步滚动"这件事要有两个可滚元素才需要按钮去解；这里从头到尾只有一个滚动容器，加两枚按钮就是给一个不存在的问题做界面。跳转那三枚（`firstDiff` / `prevDiff` / `nextDiff`）读的是同一份 hunk 清单，`scrollTop` 由视觉行数换算（Z22） |
| §1.4 草图的 `copyA` / `copyB` 两枚动作 | 栏内复制归 `copy` **节点族**（`copyId` → `df-copy-workbench-a`），不占 `DIFF_ACTIONS` 的名额 | 动作清单那十四枚是 yml `actions: 14` 与 tools.html 徽章数的同一个数（Z17、门禁⑤ 那条按钮文案对账）；把两枚"复制这一栏的输入"塞进去，徽章口径就要替它解释为什么和 yml 差二。归节点族则和 `out` / `status` 同一条派生式，骨架上它本来就得有一格 |
| §5.6「未变行折叠」的 `context` 三档（`3` / `5` / `all`） | 落**四档**：`diff` / `3` / `5` / `all`，且 `expand` / `fold` / `diffOnly` 三枚按钮是那一枚下拉的**快捷键**（写回同一个 `select`，不另存状态） | "只看差异行"是这一页最高频的一档，没有它就得先理解"上下文"这个术语才能到达；`CONTEXT_VALUE.diff = 0`、`.all = Infinity`，两档都住在同一张解释表里。快捷键与下拉不复算第二份状态由 Z21 钉：三枚按钮各自写回下拉、并核对预期的行数与折叠条数 |
| §W10 那条"`File` 计数按裸词"的写法 | 裸词 `File` 在本页两本里都是**合法名字**（`fileName` / `readFile` / `canReadFiles` 都归它），判据改成剥掉 `win.FileReader` 之后数 `win.File` 恰好一处，装配层则钉 `instanceof` 0 命中 | 宿主类型判断只许在入口那一格（`instanceof win.File`），这一档真正的红线是"本层不许问'这是不是文件'"。Z14 的词表因此比 §W10 多两枚（`FileReader`、`instanceof`）而 Z15 数的是**次数恰好**而不是"有没有" |
| §R / §W 各自那本假 DOM 夹具 | §Z 造**第三本**（`zPage` / `zMount`，三栏 + 两栏输入的形状），不与前两本合并 | 三页的骨架形状本来就不同（证件页四面板、编码页两栏、JSON 页单工作区带树、本页两栏输入加一条控制栏），合并夹具要替不存在的格子造节点，代价是夹具里长出一堆页面根本没有的 `id`。这条欠账的性质与段 4 §0.6 记的那条同源：**同一族事实有三处夹具**，改门禁⑤ 的 id 公式时三处都要动 |
| Z26 那条"骨架与 spec 漂移"的夹具，选哪一格 | 摘掉 `df-in-workbench-b-name`——它是装配层真读、且**不在启动期**被读的那一格 | 摘 `a-text` 会在 `mount` 的 `refreshGate` 就炸（那是启动路径，测不到"先算后画"）；摘 `out` 那一格会让 `paint` 直接抛（结论连状态行都到不了）。`b-name` 只在按「重新对比」时被 `readControls` 读一次，`report.missing` 报出它而不拦启动，Z26 要的就是这一档：缺格 → 按动作时抛 → **上一格结果不擦** |
| 门禁⑥「 teeth 用例」原本计划里的四刀（含"把 `DEFAULT_NODE_FAMILIES` 去掉 `tree`"那一刀） | 只落三刀（产物缺 `tree`、`nodes: ['trec']`、`nodes: ['status']`），第四刀**不做** | 牙齿用例的结构是"注入变异 → 必须变红"，而弱化默认族只会让门禁**更绿**，那一刀注定点不红，写进去就是一把假牙。"声明被新页消费"这件事此刻没有第四页可证，交给 Task 6 的 diff 页产物那一刀（`nodes` 真被门禁⑤ 读走）。这是 §0.3(a) 那颗牙拆完之后自己露出来的空档，不是漏做 |
| 测试文件头部那张"用例分布"表（`§A` 的第三现场） | §Z 那一行改成 `28`（前后两半合起来）、合计 `422` → **`438`** | 与前两格同一条口径、同一次连带：表长在磁盘 §A 里（现在 `1–901`），`--fix` **第三次**把段 1 那计划的 §A 块换成磁盘内容（`6530 → 6536 行`）。逐段读数由 awk 现算（`§X: 29 / §Y: 18 / §Z: 28`），与 runner 的 `# tests 438` 对上才算对完账 |
| §5.6「未变行折叠成「省略 N 行」**并可点开**」——没写点开之后是什么 | 点折叠条 = 把 `context` 下拉写成 `all`，走的就是「全部展开」那枚按钮的同一条 `dispatch('expand')`；**不做逐块展开** | 折叠档只有一个真值，它住在那枚下拉里（Z21 的单一口径）。逐块展开要在装配层另存一份 per-block 状态，而那份状态与 `unifiedText` 导出的折叠档必然分家——复制出来的是"全部展开"，看到的是"上下文 3 行"，这一页最不该给出的就是两种真相。**Task 5 落地的 `mount()` 根本没给结果区挂 `click`**：画出来的 `<button class="df-fold">省略 N 行 · 展开</button>` 按下去没反应，而 §Z 那 28 判数的是**画出来**的折叠条、不数"点得动"，所以全绿。修法 `onFoldClick`（容器事件代理，只认 `data-{prefix}-skip` 那一枚；不用 `querySelector`——Z14 禁，也不用 `closest`——§Z 那本假 DOM 没有这方法），夹具补 `clickFold` / `clickRow` 两个观察口，落 **Z29**（三子判：负落点不动档 / 正点开发 `'all'` 且 `computes` 不涨 / 换前缀 `zx` 后旧的 `data-df-skip` 不认） |
| §5.6「并排两栏逐行对齐」＋本节 Task 7 Step 2 原句「并排视图在 ≤640 必须退成上下堆叠」 | ≤640 **不**堆叠：两栏继续并排，横向溢出只由 `.df-out` 那一个滚动容器承担；窄屏的真退路是「视图」下拉里的**行内单栏**那一档。Task 7 Step 2 那句已照此改口 | 堆叠把一处改动拆到上下两屏，读的人要先滚一次才能对齐同一对 del/ins——正好毁掉这一页唯一的核心价值（对齐看得见）。而样式里改 `grid-template-columns` 会造出一幅"下拉写着并排两栏、画面是两栏竖排"的假象：视图那一档的真值只住在那枚 `select` 里（Z20 两档布局共一份行流），样式不许替它说话 |
| §5.6 与 §1.4 都没写并排那两栏的**轨道宽度** | `grid-template-columns: max-content max-content`（不是 `1fr 1fr`），且每一视觉行正好一个 `--df-row-h`：`margin` / `border` 一律不给、描边全走 `box-shadow: inset`、行块与折叠条 `white-space: nowrap` | `1fr` 会把长行**在栏内折行**，折一行就多占一行高，而 `scrollTop` 是按"视觉行数 × 行高"换算的（Z22）——折行之后跳转落点与样式算的不是同一件事。`max-content` 把溢出交给那一个滚动容器，行高因此是可数的；nowrap 与"零 margin/border"是同一条账的两半 |
| §1.4 草图里「选 A 侧文件」画成一枚动作按钮 | 那枚按钮不读文件，`openPicker(side)` 只做 `field(\`${side}-file\`).click()`，把选择器转交给同栏那枚真 `<input type=file>`；`change` 与拖放两条路都汇到同一个 `takeFile` | 两只"给一个文件"的手必须走同一个入口，否则拒读那三句（非 UTF-8 / 含 NUL / 超 5 MiB 先按 size 拒）要写两遍、迟早分叉。装配层不 `querySelector`、不 `new FileReader`（Z14），`click()` 是它唯一被允许碰那枚 input 的方式 |
| 「清空」那枚按钮要不要顺手把文件选择器也清掉 | 只写 `pick.value = ''`，**不写** `pick.files = []` | `HTMLInputElement.files` 在真浏览器里是 `FileList` **只读访问器**，赋 `[]` 当场抛 `TypeError: Failed to set the 'files' property`——而假 DOM 里 `files` 是个普通属性，§Z 那本夹具量不到这件事，清空那一步会停在第一栏、第二栏没清。Task 7 Step 3 那两路真文件核验跑的就是这一段 |
| §5.6「上下文三档」那枚下拉的当前值 | 构建期就把 `3` 那一档写成 `<option value="3" selected>`，与装配层 `DEFAULTS.context` 逐字同 | 第一档是 `diff`（只看差异），不写 `selected` 时浏览器取**第一个** option，于是"禁 JS 的那份页面"默认档与"有 JS"的默认档不同，页面上那句说明跟着说假话；而禁 JS 档读得到正文正是这一族页面的硬前提（Task 7 Step 3） |
| §5.6 只写"给一句口径说明" | 页内两处分工写死：`.df-terms` 是**静态口径**（六句，构建期就在，禁 JS 也读得到），`df-notes` 是**这一次对比的代价说明**（随结果整段重写，`notesOf()` 只挑真发生了的那几句：degraded / inlineSkipped / ignored / blocked…） | 两块更新时机与作者都不同：前者住在页面源，后者由视图层按 `result` 现算（Z10 钉"代价说明与六列表同屏"）。合并成一处，"禁 JS 读得到口径"那一判就去数一块只有 JS 才存在的东西，读的人以为核过了 |
| 本节 Task 6 Step 1 起草时写的循环 `{%- for side in (array: 'a,b') -%}` | 改成 `{%- assign df_sides = 'a,b' | split: ',' -%}` + `{%- for side in df_sides -%}` | `(array:)` 是 Shopify 主题液的字面量数组语法，本仓库的 liquid 解到冒号就报 `Liquid Warning: Expected dotdot but found colon` 并把**整个 tag 渲染成空**：`jekyll build` 退 0、产物里 `df-area` 命中 **0**、A/B 两栏整块不存在，而门禁⑤ 全绿——它比的 `data-df-ids`、按钮文案、`{p}-in-…` 那几族里，凡在别处找得到的都不红，没有一条要求"必须存在两栏"。这与门禁① 文件头点名的 `{% for x in data \| where: … %}` 是同一个病的**新形状**：`bundle exec jekyll build` 输出里那行 `Liquid Warning` 是判据，退出码不是 |
| spec §6.4「`selectorBlackList` 那两条前缀」 | 落**三串**：`'.tk-'` / `'.jt-'` / `'.df-'`，并把那一格上方"在线工具三页 / 这两串"的说明同步改成"四页 / 这三串"；spec 那一格留给 Task 9 回写 | 黑名单前缀是**按页**发的，不是按"工具页"这个概念发的。`--df-row-h` 那把尺一旦被 `px→vw` 改写，入口 `getComputedStyle` 读回来的就是 vw 串，跳转换算与样式里的行块高度不再是同一个数（§0.5 那条"改 postcss 配置要重启 watcher"的坑同一条线）。产物自证：`grep -o 'vw' assets/css/toolDiff.min.css \| wc -l` = 0 |
| §0.3(b)「登记第四格会让每一页变长，先量后立」 | 量到：A/B 两棵副本共同 **837** 份产物里 **105** 份有差，正差合计 **13,145B gz、负差 0**；渲染顶栏下拉的每一页 **+704 raw / +99–121 gz**（文章页、about、首页都在这族），`tools.html` +3,342 / +639、`index-all.html` +1,048 / +160、`llms.txt` +326 / +141；`tools/diff.html` 从"查无条目"的 31,520B 变成 45,774B | 这一格是全段唯一动到**每一页**的改动（顶栏下拉多一行），证件页首屏那一格（§7 最小格 544B / 3.3%）的余量必被吃掉一截。数字来自"同一份工作树、只差 yml 那一格"的两次独立 `jekyll build`（`rsync -a` 排除 `_site/.git/vendor/node_modules/.jekyll-cache/demo`，两份 `--destination` 各指回自己那棵，跑完 `md5 -q _data/onlineTools.yml` 仍是 B 那份），Task 7 Step 5 直接续这份账 |
| 门禁⑤「收录」组那三条判据原本的写法：拿**整页** `tools.html` 比，"这一串出现过就算对" | 收到**每一小节自己那一段**——新增 `toolsSectionOf(toolsHtml, slug)`，从 `<section … id="online-<slug>">` 起按 `<section>`/`</section>` 计数配平取段；徽章、面板锚点、纯文本要点三条都改拿这一段比对，段缺失就先记一条"整节不在"再交回 | 第四格进来之后 `14 个动作` 与 `5 块面板` **各自出现两次**，"改坏任何一节、另一节还替它答是"：门禁⑥ 的「tools.html 的徽章数字与数据源脱钩」那一刀注入后门禁仍是绿的（台账 `60/61`），它把 `14 个动作` 的第一处（json 段 698 行）改成 `12`，而 diff 段 740 行仍是原串。**修的是作用域，不是判据**：没把它改成 `replaceAll`（那会误伤"两节同串"这种完全合法的形状，也仍然证不了"数的是自己那一节"）。台账同步加 `badgeInSection`（按节标记定位而不是按出现顺序，没命中就**抛**——`String.replace` 找不到目标是原样返回的，静默 no-op 正是假牙的制造工序），并补 codec 那一枚 `5 块面板` 与 diff 那一格的四把刀，台账 `60/61` → `66/66` → 再加一刀「整节缺席」（带 `expect`，钉新写的早退分支）后 `67/67` |
| 测试文件头部那张"用例分布"表（`§A` 的第四现场） | §Z 那一行 `28` → **`29`**（Z29 折叠条点开）、合计 `438` → **`439`** | 同一条口径第四次连带：表长在磁盘 §A 里，`--fix` 把段 1 那计划的 §A 块换成磁盘内容。逐段读数由那条 awk 现算（`§X: 29 / §Y: 18 / §Z: 29`），与 runner 的 `# tests 439` 对上才算对完账 |
| 本格 Files 那一格「Create `scripts/verify-diff-browser.mjs`（或按现行 harness 的既有形状扩 `scripts/verify-tools-browser.mjs`），**二选一由本格实读决定并在此登记**」 | 落地 = **扩那一本**，新脚本 **0 本**：页表加 `diff` profile（`:181-215` 那一格）、第 7–10 四族（`7) 折叠与视图` / `8) 跳转与钳位` / `9) 三档硬输入` / `10) 本机文件与下载`）、`BUDGET_ROWS` 六行 → 八行 | 通用六族（十档视口 / 六组对比度 / 真按键 / 禁 JS / 阻塞集 / Console）已经是 profile 驱动的表，profile 从 `_data/onlineTools.yml` 现读——再建一本就是给那六族刻第三份副本，而"通用六族在编码页那一本里还有一份"这件事正挂在段 4 Task 9 收口账第 3 笔上，第三份不是解法。代价一并写清：这一本单页跑 **50 项**、四页同进程串跑 **115 项**，比新建一本难切小格迭代，`TK_PAGES=diff` 那一格就是为此开的（它自己在读数里声明"不算门禁"） |
| §7 那一行原句口径 =「`toolkit.min.css` + `_site/tools/diff.html` 两件」 | 落地 = **三件**（再加 `assets/css/toolDiff.min.css`），与 JSON 页那一行同尺；预算按 §0.4 那条"最坏读数 ÷ 0.95 再向上取 1024 倍"立成 **18,432B**，实测 L9 **17,067B** / L6 **17,134B**（逐件 gz 2,306 + 2,185 + 12,576） | 证件页与编码页**根本没有本页 CSS**，两件就是它们的全集；本页有 `toolDiff.min.css`（gzip 2,185B），漏掉它那一格量的就不是"首屏"。16KB 那一档直接立不住（17,134 > 16,384，负 750B），17,408B 只剩 **274B = 1.6%**——两档都不满足"实测之上留 ≥5%"，回到 18,432B（对最坏余 1,298B = 7.0%、对 L9 余 1,365B = 7.4%）。同一口径下 `对比页 JS+CSS` 那一行立 **33,792B**（最坏 31,425 ÷ 0.95 = 33,153 → 33,792；32,768B 那一档只剩 1,343B = 4.1%，立不住） |
| 页表里 diff 那一格 `minControls: 18`（计划 Step 3 原话是"先按选择器形状估"） | 落 **23** 并判等值下限：读数 `控件 23（下限 23）｜main 内 select 3、textarea 2、checkbox 2、file 2` ＋ 14 枚按钮（`profile 声明 14` 同格对账） | 估算值太松等于没判（"收紧守卫判据须自证仍有牙"那条）：23 枚里少画任何一枚——两栏各一的那枚 `copy`、那两枚 `input[type=file]`——4a 照样绿，而这一页恰是四页里**控件最容易被静默少画一格**的一页（两栏同构）。JSON 页那一格的 18 不动：它不是本页的账，收紧别人的判据要自证别人的牙 |
| Step 3「拖入文件与 `<input type=file>` 两路各跑一次，**DataTransfer 造的那份不算，要真文件描述符**」 | 两路都以 `DOM.setFileInputFiles`（收**磁盘路径**）为底：选文件那一路由它直接填 `files`（10a 判 `files[0]` 的名字与字节数 == 磁盘那一份）；拖放那一路把**同一枚真 `File`** `add` 进一只新 `DataTransfer` 再派发 `drop`（10b）。**合成的是事件，不是被读的那一份**——这一句写在代码注释里，不假装它是 OS 级拖放 | 页内 `new File([...])` 造的字节、名称、`size` 全是量具自己塞的，等于自证；headless CDP 也没有 OS 级拖放通道。GBK / NUL / 超限那三份夹具由 0f 那一判先在磁盘上自证形状（`0x00` 在不在、比 5 MiB 多 4,096B），`File.size` 的来源才是真的。这条是**量具的上界**，不是页面的下界 |
| Step 3「超 5 MiB **先按 size 拒**（断言 `FileReader` 一次都没被叫）」与「下载成 .diff」那两格 | 前者把观察口挂在 `FileReader.prototype.readAsArrayBuffer`（10e 判 0 次叫到，五 MiB 不许先进内存再说"不行"）；后者**不数 `createObjectURL`**，改开 `Page.setDownloadBehavior{allow, downloadPath}` 让 Chrome **真落盘**，再数目录里那一枚的名字与字节（10f） | 只数 Blob 只能证"页面造了一团东西"，证不了"用户拿到了文件"。而 10f 走的是**不进文档的 `<a>` 调 `click()`** 那一形状：Chrome 成立，**Firefox 那一边不保证**——这句话必须留在注释里，别让一条绿被读成"所有浏览器都成立"（段 4 那本的同族判据就是只数了 URL） |
| 通用表 3d 在 panels 支的原句「方向族键落在 tab 上时不触发浏览器默认滚动」 | workbench 支**没有 tab 条**，那一格换成「`End` 落在粘贴框上：只把 caret 移到行尾、不许把整页甩到页底」（diff/3d 实测 `无处理器 End 走 787px（尺子下限 100px）；粘贴框上 End 走 0px、selectionEnd 3-6→11`）；对照物仍是"没有键盘处理器的同一族键" | 3c/3d/3e/3f 那四条在单工作区那一支没有对应的东西（3c 原句"方向键切面板"），照搬会红在"查不到节点"上——那是量具的假红不是页面缺陷。替换件判的是同一件事的另一半：这一页唯一接键盘的大面积控件就是那两枚粘贴框。**前提也要自证**：按下之前必须证明那枚框整块在视口内、且下面还可滚 ≥100px（`fully` / `room >= 100`），否则"位移 0px"可能只是**没地方可滚**的假绿；滚位读数走 `readYStable`（站点 `scroll-behavior:smooth` 下一次固定 sleep 会量到半路） |
| `readSettledText`（段 4 那本的"落定才读"）在 diff 第 9 族上**静默假绿**过一次 | 新增 `readMovedText(sel, from, …)`：**先离开粘贴之前现读的那份基线**、离开之后再连续三次同文才算落定；9 族与"发一次 input 再读闸门行"那几格全部改走这一只，`moved` 与 `quiet` 两件事各自进读数 | 空态那句 `0 行 · 0.0 KB` 本身就是稳的，三次同文立刻成立 ⇒ 量具在防抖那一发还没轮到跑时就返回**开页时的旧账单**。同一形状在 `9a` 是绿的（那次等了 4,365ms，5 MiB 塞进 `textarea` 把主线程占满），到 `9c` 的 1.4 MB 就红了——差别只在第一次采样之前主线程忙多久，与被测的页无关。新判据仍**不等任何期望值**：页面真把字节数算错时照样带着那个错的数变红，而 `moved:false` 与"动成了错的数"从此分得开 |
| 第 9 族那两把**量具自己的**耐心：CDP 单发死线 30s、`settledLine` 默认 12s | 5 MiB / 二十万行那几发写入单独一档 `HARD_WRITE_MS = 90s`；二十万行那两发的读数预算 30s（A 侧与越界那发 B 侧同值，原先 B 侧是 20s）；**判线一条都没动** | 四页同进程串跑到 diff 那一页时，20 万行那一发 `Runtime.evaluate` 30s 无回应、整轮在「9) diff」半途挂掉，第 10 族与 §7 那三行一个都没量到；同一发在单页跑 1.6s 就回（`TK_PAGES=diff`：50 项 / 红 0 / exit 0）。一行 `el.value = <1.5MB>` 在 Chrome 里是同步赋值加一次脏排版，代价随整机负载走（挂掉那一轮本机 1 分钟负载 51，最新一轮 237 时连 `Page.navigate` 都 30s 不回）。把"排版慢"记成"页面卡死"是量具说谎；页面真卡死仍由 `settledLine` 的 `quiet=false` 与 9d 的墙钟那一枪抓，两头的账都在读数里、不在死线里 |
| 9c 那格的诊断读数返回 `dup` / `now`，而读数串里写的是 `domCount` / `bar` | 键名对齐，并把「页内同名状态格 == 1 枚」从**读数升级成判据** | 上一版那句"页内同名状态格 undefined 枚"一路绿着过了三轮——`undefined` 不参与判据，它只是安静地出现在读数里，这是本段记忆里"核验脚手架自己会静默说谎"的**新形状**（不是"读数丑一点"）。`id` 若重复，`readText` 读的是第一枚：页面可能对、量具可能读到另一本，两种都得红 |
| `json/9d` 在四页同进程串跑里红过一次：墙钟 **13,397ms** > 判线 **12,000ms** | **判线不动**。把那一发墙钟拆三段进读数（写入 + 20 发 input / 防抖落定 / 按按钮那一段，并注明其中 1,400ms 是量具自己钉死的等待），并把 `os.loadavg()[0]` 一起打进表头、汇总行与那一格读数；串跑那一轮**不并绿**，照 §0.8 ① 那条先例处置（红了先 `uptime`、再单跑那一判自证，不许改判据也不许并进绿） | 同一判据在单页跑是 **3,046ms**（落定 964ms），在负载 51 的四页串跑是 **13,397ms**（落定 3,880ms，几乎撞 `readSettledText` 那 4s 上限）——量的是同一台机的钟，不是页面的行为。放宽到 20s 能让今天过，但那等于把这条判据的绝对刻度交给运气；要不要给绝对毫秒那一族加一档"随负载走"的因子，**交回人判**（它是 JSON 页的判据，不是本页的） |
| §0.3(b)「登记第四格会让**每一页**变长，先重量、重量之后才有资格谈修不修」 | 重量完成（同一份工作树、只差 yml 那一格的两次独立 `jekyll build`）：**838** 份产物里 **106** 份有差、正差合计 **12,925B**（gzip L9）、**负差 0**；渲染顶栏下拉的每一页 **+759 raw**，逐页 gz = 证件 **+94**、编码 **+91**、JSON **+84–85**；`tools/diff.html` 从"查无条目"的 13,868B 变成 **17,067B**；三页的 JS+CSS 那一族 **Δ=0**（新页不替老页加共付件）；`tools.html` +625、`index-all.html` +155、`llms.txt` +138、`sitemap.xml` +6、`sw.js` +6、`feed.xml` +0。105 → 106 多的那一枚是 `offline.html`（另一路会话的产物，进的是分母不是差额） | 与本表 Task 6 那一格（837 / 105 / 13,145B）**不是同一份账**：那一份量在 Task 6 提交前的工作树，这一份量在 Task 7 收口时的工作树，两份之间另一路会话往同一批产物里写过东西，所以差额只做当次判定、不逐笔归因，两份账并列摆。**判定**：证件页首屏那一格从 463B（2.8%）掉到 **369B（L9）/ 307B（两档里较大的那个）**，仍 ≥ §0.3(b) 那条 300B 的线 ⇒ **不走 BLOCKED**、四条老预算一个字不改；代价是离那条线只剩 **7B**，所以"索引条那 10 枚死锚点要不要修"这一格继续挂着交回人判（两个修法都要动交互或动 §7 最小那一格） |
| 页内文件那一路的闸门话术（`dev/js/tools/diffWorkbench.js:564`）用 `kb()` | 本格**不改文案**，登记成 Task 9 的欠账：超量小于 51 字节时那句渲染成"多了 **0.0 KB**"，而粘贴框那一路用的是 `n(delta)` ＋「字节」，同一页两句口径不一致 | 核验那侧先绕开它而不是绕过它：10e 的超限夹具把超量放到 **4,096B**，让那句说人话（"多了 4.0 KB"），判据按 `FIX_OVER_KB` 现算的串对账、夹具字节数由 `fs.statSync` 自证。为什么不当场修：改的是**用户可见的那一句话**，要连带动 §Z 里钉那句的判据与 §5.6 的示例句，属于"影响交互文案"的那一档（先给方案再动手），交回人判比在本格静默改掉便宜 |
| Step 5 那一次"四页首屏 + 三页总量一起重量"的**跑法**：计划假定四页同进程串跑一发就过 | 实跑**四轮**：`run-t7-all.log` 量到一半挂（json/9d 墙钟 **13,397ms** 红 + diff 第 9 族那发 `Runtime.evaluate` 30s 不回，`exit=2`）、`all2.log` 在**第一发** `Page.navigate` 就 30s 不回（起跑负载 237.1、挂时 278.9）、`all3.log` 同一位置（145.1 → 183.9）、**`all4.log` 过：115 项 / 红 0 / `exit=0`**（起跑 19.3、收轮 31.8）。命令就是那一条 `TK_SITE_DIR=node_modules/.seg5t7-scratch/browser/_site node scripts/verify-tools-browser.mjs`，日志按上面四个名字留在同一目录 | 挂的三发**全是量具自己的死线**（`Page.navigate` 与一行 `el.value = <1.5MB>` 的 CDP 往返），不是页面判据——所以按 §0.8 ① 那条处置：先 `uptime`、再单跑那一判自证，**判据一条不放宽、也不把挂掉的那几发并进绿**（改耐心与并判据的差别见上一格：耐心决定"这一发等不等得到"，判据决定"等到之后算不算过"）。三轮挂掉的账要留在表里，因为它就是"绝对毫秒那一族的刻度随整机负载走"的证据；要不要给这一族加一档负载因子仍是**交回人判**的那格 |
| 「四页一起重量」这件事的**形状**：读计划时以为那八行要靠访问四页才量得齐 | `11b` / `11c` 那两判**不访问任何页面**：`ROWS` 里逐件写死文件路径，`measured` 直接对快照目录里的产物做 `gzip -9` / `-6`（`scripts/verify-tools-browser.mjs:2702-2723`）。所以单页跑（`TK_PAGES=diff`，`run-t7g.log`）与四页跑打出的是**同一张八行表、逐字节相同**；页访那一侧的账在**第 5 族**（真浏览器 `renderBlockingStatus` 现量的未 gzip `transferSize`，每页各量一次），四页跑补齐的是那一族与其余五族的交互族判据 | 分不清这两把尺就会两种错：拿"字节表只在四页跑里齐"当理由去抢跑那一条十几分钟的串跑（本轮就是这么挂三次的），或者反过来以为单页跑量不出 §7——`11b` 判的是**产物字节**，与"哪一页被访问过"无关。两把尺各判各的，读数里都点名了自己的口径（`cat f \| gzip -9 \| wc -c` 与 `transferSize`），别再合并成一句话写进文档 |

（本表是空的才算正常；每加一行就要在 §5.6 或 §8.1 里回写一次，段 4 那份计划的 §0.6 是同一族先例。）

**Task 9 那一格的欠账（本格不许顺手改 spec）**：spec §7「输入硬上限」那一行写的是"另**两档**是这一页独有的
算法代价闸门（`MAX_COST` 与 `MAX_INLINE_TOKENS`）"——现在那一族是**三档**，多出来的是 `MAX_INLINE_WORK`。
本格不动 spec：它的工作树此刻与 HEAD 一字不差、而索引里压着另一路会话的 `0/17` 那一格（§0.7 第 3 条），
改在它上面等于替那一格落地。**与段 4 同一处置**：Task 9 对账收口那一次把这一行改成现行值，
连同 `grep -n "^export const MAX_" dev/js/tools/diff-core.js` 的复算一起写（段 4 Task 9 的
"spec §7 常量对现行值"就是同一件事的先例）。

Task 4 落完，这一格里再记两笔**同一族**的欠账（都是"§0.6 上面那张表新登记的行为，spec 那侧还没跟着写"）：
① §5.6 的"未变行折叠"那一句要在 Task 9 补上**两份完全相同**那一档的页面形状（零块、零行，加一句
装配层给的"逐字符相同"文案，而不是画一条 0 行的折叠条）；② §5.6 的"并排两栏逐行对齐"要在 Task 9
写明缺席那一侧的画法是**占位行 `--fill`**（行在、无行号、正文空），否则读 spec 的人会以为那一侧少一行。
两笔都只动 spec，不动实现——实现那侧 Z4 已经把两条钉死了。

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
   跑完再把真索引里我那几格对齐回去，**保证对方的 16 格暂存一格不少**。（对齐这一步不是收尾的美观：
   plumbing 不动索引，落笔后我那几格在 `git status` 里是 `MM`、新文件是 `D `，对方若从共享索引落笔
   就把我这格整体退回旧 blob——现场与逐格对照见 Task 5 Step 7。）
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
export const SIDES = ['a', 'b', 'bar'];
// 七枚 id helper：门禁⑤ 与 §Z 的三向对账只认这七个公式，装配层内不许手打 `df-` 串
export const fieldId   = (p, panel, id)   => `${p}-in-${panel}-${id}`;
export const buttonId  = (p, panel, key)  => `${p}-btn-${panel}-${key}`;
export const outId     = (p, panel, side) => `${p}-out-${panel}-${side}`;
export const statusId  = (p, panel, side) => `${p}-status-${panel}-${side}`;
export const copyId    = (p, panel, side) => `${p}-copy-${panel}-${side}`;
export const whenId    = (p, panel, key)  => `${p}-when-${panel}-${key}`;
export const nodeId    = (p, panel, fam, side);   // 只认 out / status / copy 三族，第四族当场 RangeError
export const controlIds = (p) → { fields, nodes, when, buttons };

export const DIFF_SPEC = {
  workbench: { sides: {
    a:   { kind: 'workbench', nodes: ['status', 'copy'],
           controls: [{ id: 'a-text', type: 'area', gutter: false }, { id: 'a-file', type: 'file' },
                      { id: 'a-name', type: 'text' }] },
    b:   { kind: 'workbench', nodes: ['status', 'copy'],
           controls: [{ id: 'b-text', type: 'area', gutter: false }, { id: 'b-file', type: 'file' },
                      { id: 'b-name', type: 'text' }] },
    bar: { kind: 'workbench', nodes: ['out', 'status'],
           controls: [ { id: 'mode',  type: 'select', options: ['text', 'json'] },
                       { id: 'layout', type: 'select', options: ['side', 'inline'] },
                       { id: 'context', type: 'select', options: ['diff', '3', '5', 'all'] },
                       { id: 'ws', type: 'checkbox' }, { id: 'case', type: 'checkbox' } ],
           switch: { by: 'mode', targets: [{ key: 'text', when: ['text'] }, { key: 'json', when: ['json'] }] } },
  } },
};
// 十四枚，`key` 派生按钮 id、`group` 是那一族的登记处、`to` 只有折叠那三枚有（写回同一枚 context 下拉）
export const DIFF_ACTIONS = [
  { key: 'compare',   group: 'run',   label: '重新对比' },   { key: 'swap',    group: 'run',   label: '交换两侧' },
  { key: 'clear',     group: 'run',   label: '清空输入' },   { key: 'reset',   group: 'run',   label: '恢复默认档' },
  { key: 'expand',    group: 'fold',  label: '全部展开', to: 'all' },
  { key: 'fold',      group: 'fold',  label: '上下文三行', to: '3' },
  { key: 'diffOnly',  group: 'fold',  label: '只看差异', to: 'diff' },
  { key: 'firstDiff', group: 'goto',  label: '第一处差异' }, { key: 'prevDiff', group: 'goto',  label: '上一处' },
  { key: 'nextDiff',  group: 'goto',  label: '下一处' },     { key: 'fileA',   group: 'file',  label: '选 A 侧文件' },
  { key: 'fileB',     group: 'file',  label: '选 B 侧文件' }, { key: 'copyDiff', group: 'copy', label: '复制差异' },
  { key: 'download',  group: 'copy',  label: '下载 .diff' },
];
export function createDiffWorkbench(env) → { mount(), state(), view };   // view = 视图层那七件，原样暴露
```

三条与 §W 同源的红线，§Z 逐条咬：**视图层零 import**；**环境只在入口**（`FileReader` / `instanceof` /
`Date.now(` / `localStorage` / `window` / `getComputedStyle` / `querySelector` / `setTimeout(` /
`URL.` / `navigator.` 在装配层源码里各 0 次，入口那一侧按 Z15 数"各恰好一处"——
但 `localStorage` 与 `Date.now(` 是**两本一起归零**，因为本页**不做**"记住上次输入"，
那句"输入不出本机"因此连一条退路都不必写）；**id 只由 spec 派生**。

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
  // 并块的那一档边界：间距恰好 2×context 时两块必须并成一块。Task 8 的 X-5 那一刀（`lo <= last.hi`
  // 改成 `lo < last.hi`）在上面那两份样本里量不到——它们的间距是 20 与 10，都不是 6，而分成两块时
  // 行集仍逐格相同（7+7 == 14），只是"共几处 / 第几处"的读数与折叠条的归属会变。钉住这一格，
  // `<=` 才不是写着好看的保险。
  const tA = [...xRows(4, 'a'), 'C1', ...xRows(6, 'e'), 'C2', ...xRows(4, 'b')].join('\n');
  const tH = dHunks(dLines(tA, tA.replace('C1', 'Z1').replace('C2', 'Z2')), 3);
  assert.equal(tH.length, 1, '间距 == 2×context：前后上下文正好相接，该并成一块而不是贴着的两块');
  assert.equal(tH[0].rows.length, 14, '并块那一格的行数：3+1+3 与 3+1+3 相接，中间那 6 行不重复也不缺席');
  const gA = [...xRows(4, 'a'), 'C1', ...xRows(7, 'e'), 'C2', ...xRows(4, 'b')].join('\n');
  const gH = dHunks(dLines(gA, gA.replace('C1', 'Z1').replace('C2', 'Z2')), 3);
  assert.deepEqual(gH.map((h) => h.rows.length), [7, 7], '间距 = 2×context + 1：中间多出的那一行被折掉，才分得出两块');
  assert.deepEqual(gH.map((h) => h.skipped), [1, 1], '两块各带自己的省略数：第一块的 1 是头尾钳位后的账');
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

- [x] **Step 1：写判据 Z1–Z12**：视图层零 import（源码扫）、`esc` 由 `env` 注入且缺失时**构造期**
      `TypeError`（那句理由与 §W 的"抛在挂载期就是整页空白"同一条）、并排两栏的行数必须相等
      （对齐是视图层的责任不是装配层的）、`change` 行在左右两栏各出现一次且各自只高亮自己那半、
      `crlf` 那一格画 `CR_GLYPH` 而不是留白、折叠条那句"省略 N 行"的 N 与 `Row.skipped` 同源、
      所有产出过 `env.esc`（拿 `<script>` 与 `"` 与换行三类样本断言）、`textContent` 型字段
      （行内容）不许出现在属性位、JSON 变更表那六列的表头与 `DIFF_JSON_NOTES` 同页、
      坏输入态的 `renderNotice` 只有一句且不吞掉别的文案、`df-` 字面量在本文件源码里 **0 次**
      （类名一律由 `env.prefix` 派生，同 §W10 的整格字面量口径）。
      先红一步照旧是形状的一部分：判据落完跑门禁① 得 `411 tests / 410 pass / 1 fail` 退 1，
      红的是**文件级**那一行 `not ok 1 - scripts/toolkit-tests.mjs`，正文里是
      `ERR_MODULE_NOT_FOUND … /dev/js/tools/diffView.js`——§Z 那十二判在模块缺席时**一条都没注册**，
      所以看不到 `not ok Z1 …` 那种形状（§A 注释里 2026-09-26 实测过：按 `^not ok <用例名>` 去点名
      是锚错了层，不是判据没牙）。
      起草时改掉五处，都记在这里，因为全是"判据落下去才发现前提读错"的形状：
      ① 类名 needle 一律不带前导 `-`——`-df-row--change` 在 `class="df-row df-row--change"` 里恒 0 命中，
      十一处一起改（属性 needle 保留 ` data-df-` 那个前导空格，那一格是真的）；
      ② `renderInline` 的 premise 错过一次：`Row.inline` 是 equal/del/ins **混着的一份**，不是"本侧那半"，
      于是实现改成按侧**筛**，Z5 顺势把两栏的产出串逐字符钉下来、"要抛"的边界挪到那三档之外
      （§0.6 新增的"行内按侧筛"那一行）；
      ③ Z4 原来拿 `'a\nb'` vs `'a\nb'` 断"两栏各两行"，实测 `hunksOf` 在零差异时**返回 `[]`**，
      那条软断言当场退化成空跑——改成先钉 `deepEqual(rows, [])` 把这个发现固化，再换一份真含差异的夹具
      （§0.6 新增的"`hunksOf` 零块"那一行）；
      ④ Z7 的夹具把第一处差异放在 L5，于是契约里"第一块 `skipped` 恒 0"在测试里读成 4：把差异挪到 L0，
      并补两条硬闸门 `hs.length === 2` 与 `hs[0].skipped === 0`，专防"空跑一遍还全绿"；
      ⑤ Z12 的 `t()` helper 从夹具继承了 `ignored: 7`，结论句自动选到"归一化之后相同"那一档，整段跟着改；
      那一格里原有一条"每个数字都出现在串里"的弱判据，换成**整串逐字符相等**——把七个标签全删掉，
      弱判据照样绿，而这一格的承诺正是"那七个标签一个都不能少"。
- [x] **Step 2：写实现到绿**——`dev/js/tools/diffView.js` 落盘 **312 行 / 20,996B**（`wc -l -c` 的读数）。
      导出恰好三格、`createDiffView(env)` 还回来恰好七件（Z2 两头都钉：多一件、少一件、改一名都红）。
      `env` 那三件在**构造期**各挡一档（`esc` 不是函数 / `prefix` 不匹配 `^[a-z][a-z0-9]*$`，
      含 `'df bad'` 与 `'df-row'` 两种形状 / `crGlyph` 不是非空字符串）；入参闸门在**调用期**：
      非整数或负数的 `skipped` 抛 `RangeError`、`tail` 不是布尔抛 `TypeError`、
      `renderVerdict` 拿到 `blocked` / `invalid` 抛的点名句里带 `renderNotice`，等于把"那一档该走哪条路"
      写进报错本身。
      两处刻意的排版选择写进文件头，也写进上面的镜像说明：行内容放进 `<pre class="{p}-row__txt">`
      （缩进是内容不是排版；也正因为这一格，`zTxt` 有唯一提取锚点）；`Row.a` / `Row.b` 为 `null` 的
      那一侧画 `--fill`（行在、无 `ln` 属性、无行号、正文空）而不是少一行。
      迭代三刀的读数（`--test-name-pattern="^Z[0-9]+ "` 单跑）：`4/12` → `10/12` → `12/12`。
      前两档里判据侧与实现侧都动过——判据动的是上面记的那五处（前提读错），实现动的是渲染形状，
      **没有一处是把断言改松**：唯一的方向是加硬（Z4 加 `deepEqual(rows, [])`、Z7 加两条硬闸门、
      Z12 换成整串逐字符、Z5 换成两栏产出串逐字符）。
- [x] **Step 3：登记镜像**——`FILE_TARGETS` 追加 `'dev/js/tools/diffView.js'`（方向照旧：跟着磁盘走，
      不跟着计划走），注释写清这一本**没有算法**、整本只有排版口径，而 Z1/Z3 那两判是源码扫描型的，
      所以这一格镜像留的是"行内容当时放在哪个标签里、属性位上有哪几枚名字"的现场。本计划新贴两块
      ` ```js ` 围栏（整文件 **312 行**、整节 **340 行**），种子直接由磁盘内容生成（一支 `/tmp` 里的
      拼装脚本读磁盘拼围栏，不做手抄，另加一道"围栏内容里不许出现 ` ``` ` 行"的自检），
      `--fix` 那一轮**没有改写这两块的任何一行**——它只换掉段 1 的 §A（下一段）。裸门禁② 的两行读数：
      `OK dev/js/tools/diffView.js：计划[段5] 3405–3716（312 行）与磁盘逐字节全等`、
      `OK scripts/toolkit-tests.mjs §Z（磁盘 14317–14656）：计划[段5] 3741–4080（340 行）与磁盘逐字节全等`。
      这两行的**坐标**是 Step 3 那一刻的读数，本节正文此后每往下长一行，它们就一起往下挪——写在这里的
      是"那一刻"，不是永久地址；门禁② 认的是**内容**（整文件按逐字节全等、整节按 `// ── §Z` 标记切），
      行号只出现在报告里、不参与判定，所以挪动不产生红（Task 3 那格记录的 `2289–2856` 今天读作
      `2371–2938`，就是同一件事的先例）。
      连带动作一条，与 Task 3 那次同一形状：`--fix` 把**段 1 那份计划**的 §A 镜像整块换成磁盘内容
      （`6526 → 6530 行`），因为"用例分布"表的 §Z 那一行长在磁盘 §A 里；本提交因此再带一份段 1 计划的改动，
      只碰 §A 那一个块，另一路会话压在索引上的格与工作树文件一件未动（§0.6 最后一行是这一笔的账）。
- [x] **Step 4：门禁①②③**——① 全量 `422/422` 退 0（另用 `--test-name-pattern="^Z[0-9]+ "` 单跑过 12/12）；
      ② 裸跑退 0：`71` 块已落地镜像全等、`未落地 0 节`，js 块 `63` 个（段5 从 4 块长到 6 块）；
      ③ **37/37** 退 0，末尾两条自证照旧（副本回到全绿；实验前后工作树脏指纹一字不差，`29` 个脏项里
      含另一路会话那批，一件未碰）。跑之前先 `uptime`：本机 load averages 一度 `15.00 / 16.84 / 11.50`，
      那种档位下红要先归因给量具，这里等它落到 `4.47` 才跑全量，判据一位未松。
      头部那张表的账照旧用 §A 注释里那条 awk 重算，逐段读到 `…§X: 29 / §Y: 18 / §Z: 12`、
      合计 `422`，与 runner 的 `# tests 422` 对上（对不上就是表过期，改表而不是改口径）。
- [x] **Step 5：提交** `feat(tools): 段 5 Task 4 对比页视图层——diffView 与 §Z 前半十二判`。
      落笔 = `2cc535f`（`b6c3760` → `2cc535f`，`git update-ref` 的 CAS 带旧 sha）。
      pathspec 五件：`dev/js/tools/diffView.js`（新）/ `scripts/toolkit-tests.mjs` /
      `scripts/verify-plan-blocks.mjs` / 本计划 / **段 1 那份计划**（只被 `--fix` 换掉 §A 那一个块，
      就是上面那笔用例分布表的账），`git show --stat` 读到 `1454 insertions(+) / 4 deletions(-)`
      且**只有这五行**；另一路会话压在索引上的 16 格一格不少（`USAGE.md` 仍 `1/76`、spec 仍 `0/17`），
      它的工作树文件一件没动——提交前后各存一份 `git status --porcelain`，逐行对照只差我这五格
      （`30 → 25` 行）。
      **提交态自证**（`git archive HEAD` 整份导出 → 导出树里 `git init` → 三道人真跑）：
      门禁① `422/422` 退 0、门禁② 退 0（`71` 块已落地镜像全等、`未落地 0 节`）、门禁③ **37/37** 退 0
      （末尾两条自证照旧：副本回到全绿；实验前后工作树脏指纹一字不差，导出树里 `61` 项、
      diff 指纹 `b712fa432e6a2463`）。
      这一格自己踩了一次**量具的坑**，记在这里，因为它差点造出一棵"看起来提交成功了"的空提交：
      第一次落笔把五个路径写进一个变量、用 `for f in $FILES` 循环——zsh **不做单词分割**
      （与"`printf '%s\n' $VAR` 不分割"是同一条），五个路径被当成一个不存在的文件名，
      `hash-object` 与 `update-index` 双双失败；可 `set -e` 没拦住（失败的是循环体里的命令替换，
      而循环本身退 0），于是 `write-tree` 拿到的还是**旧树**、`commit-tree` 照样造出一棵与父提交
      树完全相同的提交、`update-ref` 也把它推上去了。处置：反向 CAS 撤回
      （`git update-ref refs/heads/main b6c3760 09a0cc0`，那棵空提交从此不可达），改成把路径**逐行**
      写进文件、`while IFS= read -r f` 读，并在 `commit-tree` 之前加一道**新树 ≠ 旧树**的断言——
      那一句 `[ "$TREE" != "$(git rev-parse "$OLD^{tree}")" ]` 就是这一刀的止痛药；
      落笔之后仍然只认 `git log` / `git show --stat` 的读数来判成败。

### 落地镜像（门禁二核的就是这一块，`--fix` 会把它整块换成磁盘内容）

Task 2/3 那两节立的规矩在这里照用：只有**整文件**与**整节**镜像允许 ` ```js ` 围栏（§0.6 的硬规矩），
贴的时候直接由磁盘内容生成，事后跑一次 `--fix` 复验它已经全等。下面两块是一对——
`diffView.js` 改了而 §Z 没跟着改，红的是门禁①；§Z 改了而计划没跟着改，红的是门禁②。

登记面这一格只动了一处：`FILE_TARGETS` 里新增 `dev/js/tools/diffView.js`（方向照旧，**跟着磁盘走
不跟着计划走**——`diffWorkbench.js` / `toolDiff.js` 还没落地，Task 5 落盘那一格再登记，同 §0.7）。
`scripts/toolkit-tests.mjs` 的 §Z 是**按标记切段**登记的（`SEG_MARK`，不看行号），所以这一格镜像
现在是"那一节的头注释 + 那一次 `await import` + 前半十二判"整节；Task 5 往末尾续写 Z13–Z28 时
**不插新标记**，§Z 这一段只会变长、不会被截短，`--fix` 会把这一格整块换过去——"节名不另起"在这里
的代价就是 §Z 只有一本镜像，前后两半共用同一格。

> Task 3 那格立的"到本节末"这个说法在这一格照抄，但它指的是**当前**的切分边界：§Z 现在是磁盘上
> 最后一节，下面没有别的 `// ── §` 标记，所以"到本节末"与"到文件末尾"此刻是同一段字节；Task 5
> 续写之后两者仍指同一段，因为续写不插标记。本计划的判据到 §Z 收口（§0.1 那张表里 §Z 是最后一格），
> 若日后还有别的段往同一文件续节，那一带来的作废形状与 Task 3 那格完全一样：只作废"读到哪儿"的说法，
> 字节一位不动。

#### `dev/js/tools/diffView.js`（整文件）

这一本只有一件事：**把 `diff-core` / `diff-json` 的返回值变成 HTML 串**——不碰 DOM、不读环境、
不引本地文件。它导出的名字恰好三格（`DF_CORE_KINDS` / `DF_SIDES` / `createDiffView`），
`createDiffView(env)` 还回来的方法恰好七件（`renderSide` / `renderInline` / `renderFoldBar` /
`renderStats` / `renderJsonTable` / `renderNotice` / `renderVerdict`）。三条红线在 Z1/Z2/Z3 上钉着，
而它们全是**源码扫描**型判据，所以这一格镜像的作用比前两本更直白：它留的是"当时那一版把行内容
放在哪个标签里、属性位上到底有哪些名字"的现场。

- **零 import**（§0.4 那条构建硬约束，与 `diff-json.js` 同源）：`esc` / `prefix` / `crGlyph` 三件由
  `env` 注入，且都在**构造期**挡（缺一件抛点名的 `TypeError`，含 `prefix` 不是 `[a-z][a-z0-9]*` 那一档），
  不留到挂载期——这一页没有兜底，抛在挂载期就是整页空白（§W 立的那条）。
- **类名与属性名一律由 `env.prefix` 派生**，`df-` 字面量在本文件剥注释的源码里 **0 次**；Z3 的自证形状
  是把前缀换成 `zx` 整页重出，产出必须等于 `df` 那一版的 `replaceAll('df-','zx-')`——前缀派生不是注释里的
  承诺，是一整页字符串级别的等式。
- **用户文本永不进属性位**：属性位只有那四枚整数槽（`data-{p}-i` / `-ln` / `-skip` / `-depth`），
  Z9 把整节的属性词表钉成"恰好这四枚 + 渲染器自己的 `class` / `type`"，且每一枚的值必须是纯数字。

排版有两格是**刻意的**，动它们等于同时动 §Z 的提取锚点，所以写在这里而不是只留在测试里：
行内容放进 `<pre class="{p}-row__txt">`（缩进是内容不是排版；也正因为这一格，`zTxt` 能把整列的
行内容逐字符还原回去，Z8 的三类恶意样本才有一个"绕一圈还是原样"的往返可断）；
`Row.a` / `Row.b` 为 `null` 的那一侧画成 `--fill`（无 `ln` 属性、无行号、正文为空）而不是少一行——
**并排两栏的行数必须相等**，对齐是视图层对装配层的承诺（Z4），装配层不再补行也不删行。

```js
/**
 * 文件对比页输出区的视图层（段 5 Task 4；设计文档 §5.5 的「结果区」与 §1.3 那份契约）。
 *
 * 这一本和 `jsonView.js` 干同一件事，只是形状不同：把已经算好的行对象、片段与读数**拼成 HTML 串**。
 * 它不算任何东西，也不碰任何节点——拼出来的串由装配层那唯一的 `innerHTML` 出口写进页面。
 * 于是"什么样的文本会变成标记"这一件事在全仓库只有一个答案，而那个答案是注入进来的 `esc`。
 *
 * 三条口径：
 *
 * 1. **零 import**（Z1）。第 0.4 节那条构建红线在这一本同样成立：一旦这里 import 了什么，
 *    `toolDiff.js` 与 `toolkitCore.js` 就同时 reach 那个模块，Rollup 切出共享 chunk，
 *    `iifeWrapPlugin` 包完的产物里留下 `import{`——整页 SyntaxError 而构建 exit=0。
 *    代价是三件东西必须由 `env` 递进来：转义函数、类名前缀、行尾回车的符号（`{ esc, prefix, crGlyph }`），
 *    缺任何一件在构造期点名（Z2），不许退化成"默认前缀"那种静默兜底。
 * 2. **类名与属性名只从 `prefix` 派生**（Z3）。全文件剥注释的源码里那个页面专属的前缀串出现 **0 次**，
 *    连整格字面量也不许有（§W10 同一条口径）。这不为了好看：Task 5 的换前缀自证
 *    （`df` ↔ `zx` 一整页跟着换）只有在派生是真的时候才有牙，手打过一处就是给那道门禁装假牙。
 * 3. **用户文本只出现在 `esc` 之后，且永远不进属性位**（Z8、Z9）。属性值只有四类整数：
 *    行块下标、这一侧的行号、折叠省略的行数、变更格的深度。对齐引擎交出的 `textA/textB`、
 *    Pointer、预览串一律落在正文位置——那里 `esc` 说得上话，属性位上它说不上（引号转义后仍是文本）。
 *
 * 三件"不是 CSS 能兜的事"归这一层（Z4、Z5、Z6）：并排两栏各读同一份行流、缺席那一侧长成占位行而不是
 * 少一行；一个改动行在两栏各出现一次而高亮只有各自那一半；行尾回车画得出符号。
 * 行内容那一格用 `pre` 而不是 `span`：代码行的缩进是内容不是排版，CSS 万一漏了 `white-space` 也不会
 * 把四格缩进并成一格，同时让"行内再套 span"这一件事在判据里切得干净（§Z 的 `zTxt`）。
 *
 * JSON 档那一表（`renderJsonTable`）另扛两格：一侧缺席与"值真的是 `null`"分得开（判的是 `absent` 这一档，
 * 不是预览串空不空——`{"a":null}` 的预览正是 `"null"`，反过来推会读错），而六句代价说明与表同屏，
 * 用户读到的"这一页在哪一档上打了折"和那张变更清单一块儿长出来。
 */

/** 对齐引擎能交出的四档行（视图层自己加的那档 `fill` 不在这里，见 `rowBlock`） */
export const DF_CORE_KINDS = ['equal', 'change', 'del', 'ins'];
/** 两栏：只有 A 与 B，第三栏在这一页没有对应的事实 */
export const DF_SIDES = ['a', 'b'];

/** 行内片段的三档（对齐引擎的词汇表，样式那边也只认这三种颜色） */
const INLINE_TONES = ['equal', 'del', 'ins'];
/** 每一栏认得的行内片段档：A 栏读等价的与自己被删的那半，B 栏反之（Z5） */
const INLINE_BY_SIDE = { a: ['equal', 'del'], b: ['equal', 'ins'] };
/** 折叠条两档：块与块之间与文件末尾，样式与点击行为按这两档分 */
const FOLD_WHERE = { head: 'head', tail: 'tail' };
/** 结论两档模式，与它们各自的词表（`blocked` / `invalid` 进不来，见 `renderVerdict`） */
const MODES = ['text', 'json'];
const VERDICTS = { text: ['same', 'diff'], json: ['same', 'same-key-order', 'diff'] };
/** 变更表四档 kind 与三档归属的显示名：白名单外的词一律抛，不静默渲成一格空白 */
const KIND_LABELS = { add: '新增', remove: '删除', change: '值变', type: '类型变' };
const OWNER_LABELS = { 'only-a': '仅 A', 'only-b': '仅 B', both: '两侧' };
/** 一侧根本没有这一格时写的话（与"值真的是 null"是两件事） */
const ABSENT_TEXT = '（这一侧没有）';

/** 这一件收到的东西不像样子就说清是哪一格不像：视图层的静默空格是最难查的"页面没坏但少了东西" */
const shape = (value) => (value === null ? 'null' : Array.isArray(value) ? '数组' : typeof value);

/**
 * 造出对比页的那七件生成器。
 * @param {{esc: Function, prefix: string, crGlyph: string}} env `window.Tk.view` 里的那份 `esc`，
 *   加上装配层从 `diff-core.js` 递来的类名前缀与行尾回车符号
 * @returns {{renderSide: Function, renderInline: Function, renderFoldBar: Function, renderStats: Function,
 *   renderJsonTable: Function, renderNotice: Function, renderVerdict: Function}}
 * @throws {TypeError} 注入缺件，或某一件的入参不在白名单里
 */
export function createDiffView(env) {
  if (!env || typeof env !== 'object') {
    throw new TypeError(`createDiffView：第一格应是 { esc, prefix, crGlyph }，这里是 ${shape(env)}`);
  }
  if (typeof env.esc !== 'function') {
    throw new TypeError(`createDiffView：env.esc 应是 view.js 里那只转义函数，这里是 ${shape(env.esc)}（缺它的下场是用户文本被当标记插进结果区）`);
  }
  if (typeof env.prefix !== 'string' || !/^[a-z][a-z0-9]*$/.test(env.prefix)) {
    throw new TypeError(`createDiffView：env.prefix 应是一枚只含小写字母与数字的短串（类名与属性名都从它派生），这里是 ${shape(env.prefix)}（带空格或连字符的整套类名到页面上是碎的）`);
  }
  if (typeof env.crGlyph !== 'string' || env.crGlyph === '') {
    throw new TypeError('createDiffView：env.crGlyph 应是一个非空字符串（行尾回车那一格画它，缺它"行尾有回车"与"这一格没渲染"就混成同一档）');
  }
  const esc = env.esc;
  const p = env.prefix;
  const crGlyph = env.crGlyph;

  /** `df-row`：词根 */
  const c = (root) => `${p}-${root}`;
  /** `df-row--change`：档位 */
  const mod = (root, m) => `${p}-${root}--${m}`;
  /** `df-row__txt`：从属格 */
  const el = (root, part) => `${p}-${root}__${part}`;
  /** `data-df-ln`：属性名（名字里也带前缀，换前缀时整套跟着换） */
  const at = (name) => `data-${p}-${name}`;

  /**
   * 行内片段序列 → 某一栏的串。等价段**不套 span**：一行满屏 span 是噪声，也是第二套口径。
   * 一条片段序列里 `del` 与 `ins` 是**交替躺着**的（`inlineFromTokens` 给的就是这一串），
   * 所以这一件按栏**挑段**而不是按栏各收一份：A 栏读等价与自己被删的那半，B 栏读等价与自己新增的那半。
   * 另一侧的档跳过不是错误，是这一栏本来就没有那半；词汇表外的档要抛（Z5）——那意味着对齐引擎
   * 多了一种着色档，而样式那边没人认识它，静默忽略就成了"高亮少了一块却看不出来"。
   * @param {Array<{t: string, text: string}>} inline `inlineDiff` / `Row.inline` 交出的那一段
   * @param {'a'|'b'} side 栏
   * @returns {string}
   */
  const renderInline = (inline, side) => {
    if (!Array.isArray(inline)) {
      throw new TypeError(`renderInline：第一格应是行内细化交出的片段数组，这里是 ${shape(inline)}（缺了它那一行只按整行着色，视图层不许自己猜一段回来）`);
    }
    if (!DF_SIDES.includes(side)) {
      throw new TypeError(`renderInline：栏只认 ${DF_SIDES.join(' / ')}，这里是 ${String(side)}`);
    }
    let out = '';
    for (let k = 0; k < inline.length; k += 1) {
      const seg = inline[k];
      if (!seg || typeof seg !== 'object' || typeof seg.text !== 'string') {
        throw new TypeError(`renderInline：第 ${k} 段应是 { t, text }，这里是 ${shape(seg)}（缺 text 的片段到页面上是一串 undefined）`);
      }
      if (!INLINE_TONES.includes(seg.t)) {
        throw new TypeError(`renderInline：第 ${k} 段的档只认 ${INLINE_TONES.join(' / ')}，这里是 ${String(seg.t)}（样式那边没有第三种颜色，静默忽略就是"高亮少了一块却看不出来"）`);
      }
      if (!INLINE_BY_SIDE[side].includes(seg.t)) continue;
      out += seg.t === 'equal' ? esc(seg.text) : `<span class="${mod('inline', seg.t)}">${esc(seg.text)}</span>`;
    }
    return out;
  };

  /**
   * 一行 → 某一栏的行块。缺席那一侧长成 `fill` 而不是少一行（Z4）：两栏各读同一份行流，
   * 行数不等时滚动一错位就错到底，而对齐这件事 CSS 兜不了。
   * `fill` 那一格不给自己编行号，也不写正文——它是"这一侧没有这一行"，不是第 0 行也不是空行。
   */
  const rowBlock = (row, side, i) => {
    if (!row || typeof row !== 'object') {
      throw new TypeError(`renderSide：第 ${i} 行应是 diff-core 的那个行对象，这里是 ${shape(row)}`);
    }
    if (!DF_CORE_KINDS.includes(row.kind)) {
      throw new TypeError(`renderSide：第 ${i} 行的 kind 只认 ${DF_CORE_KINDS.join(' / ')}，这里是 ${String(row.kind)}（多一档意味着对齐引擎多了一种行，而视图层不认识它）`);
    }
    const ln = side === 'a' ? row.a : row.b;
    const kind = ln === null ? 'fill' : row.kind;
    const crlf = side === 'a' ? row.crlfA : row.crlfB;
    const inline = row.kind === 'change' && Array.isArray(row.inline) && row.inline.length > 0
      ? renderInline(row.inline, side) : '';
    const body = kind === 'fill' ? '' : (inline === '' ? esc(side === 'a' ? row.textA : row.textB) : inline);
    const cr = kind !== 'fill' && crlf === true ? `<span class="${el('row', 'cr')}">${esc(crGlyph)}</span>` : '';
    return `<div class="${c('row')} ${mod('row', kind)}" ${at('i')}="${i}"`
      + (kind === 'fill' ? '' : ` ${at('ln')}="${ln}"`) + '>'
      + `<span class="${el('row', 'no')}">${kind === 'fill' ? '' : ln + 1}</span>`
      + `<pre class="${el('row', 'txt')}">${body}</pre>${cr}</div>`;
  };

  /**
   * 一栏的整列行块。
   * @param {object[]} rows `hunksOf` 摊出来的行对象数组（两栏递的是同一份）
   * @param {'a'|'b'} side 栏
   * @returns {string}
   */
  const renderSide = (rows, side) => {
    if (!Array.isArray(rows)) throw new TypeError(`renderSide：第一格应是行对象数组，这里是 ${shape(rows)}`);
    if (!DF_SIDES.includes(side)) {
      throw new TypeError(`renderSide：栏只认 ${DF_SIDES.join(' / ')}，这里是 ${String(side)}（第三栏在这一页没有对应的事实）`);
    }
    let out = '';
    for (let i = 0; i < rows.length; i += 1) out += rowBlock(rows[i], side, i);
    return out;
  };

  /**
   * 折叠条。`skipped` 直接抄 `hunksOf` 的那一格，属性与正文两处用同一个数（Z7）——
   * 分两处算就是"折叠条说谎"的成因。0 那一档整条不长：第一块前面本来就没有东西。
   * @param {{skipped: number, tail?: boolean}} o 省略的行数与头尾档
   * @returns {string} `<button>` 或空串
   */
  const renderFoldBar = (o) => {
    if (!o || typeof o !== 'object') throw new TypeError(`renderFoldBar：只收 { skipped, tail } 这一个对象，这里是 ${shape(o)}`);
    if (!Number.isInteger(o.skipped) || o.skipped < 0) {
      throw new RangeError(`renderFoldBar：省略行数得是 ≥0 的整数（它抄的是 hunksOf 的 skipped），这里是 ${String(o.skipped)}（小数会把滚动条总长算歪）`);
    }
    if (o.skipped === 0) return '';
    const tail = o.tail === undefined ? false : o.tail;
    if (typeof tail !== 'boolean') throw new TypeError(`renderFoldBar：tail 是布尔，这里是 ${shape(tail)}（"没给"不许读成"是尾条"）`);
    return `<button class="${c('fold')} ${mod('fold', tail ? FOLD_WHERE.tail : FOLD_WHERE.head)}" type="button" ${at('skip')}="${o.skipped}">`
      + `省略 ${o.skipped} 行 · 展开</button>`;
  };

  /**
   * 那一行读数。**只**读那七个名字，其余一律不看（Z12）：模块以后往 stats 里加一格，
   * 这一行的形状不许跟着变。缺的那一格给 0，不给空格也不给 `—`——"这一份里一处新增也没有"是事实。
   * @param {object} stats `diff-core.js` 的 stats 那一份
   * @returns {string} `<p>` 块
   */
  const renderStats = (stats) => {
    if (!stats || typeof stats !== 'object') throw new TypeError(`renderStats：只收 diff-core 的 stats 那一份，这里是 ${shape(stats)}`);
    const n = (key) => (Number.isFinite(stats[key]) ? stats[key] : 0);
    return `<p class="${c('stats')}">增 ${n('added')} · 删 ${n('removed')} · 改 ${n('changed')} · `
      + `同 ${n('unchanged')} · ${n('blocks')} 处 · 未行内 ${n('inlineSkipped')} · 归一化抹平 ${n('ignored')}</p>`;
  };

  /**
   * 结论那一格。两档模式各有自己的词表与账本：text 档读 `diff-core.stats` 那七个名字，
   * json 档读 `diff-json.stats` 那六个——名字不许混用，因为两张账表数的是不同的事。
   * `blocked` 与 `invalid` 到不了这里，抛是故意的：把它们写成结论就是把"没比成"说成"一样"，
   * 那一条路径归 `renderNotice`。
   * @param {{mode: string, verdict: string, stats: object, degraded?: boolean, normalized?: boolean}} o 四格
   * @returns {string} `<p>` 块
   */
  const renderVerdict = (o) => {
    if (!o || typeof o !== 'object') {
      throw new TypeError(`renderVerdict：只收 { mode, verdict, stats, degraded } 这一个对象，这里是 ${shape(o)}`);
    }
    if (!MODES.includes(o.mode)) throw new TypeError(`renderVerdict：模式只认 ${MODES.join(' / ')}，这里是 ${String(o.mode)}（第三种模式在这一页没有对应的算法）`);
    const words = VERDICTS[o.mode];
    if (!words.includes(o.verdict)) {
      throw new TypeError(`renderVerdict：${o.mode} 档的结论只认 ${words.join(' / ')}，这里是 ${String(o.verdict)}（blocked / invalid 走 renderNotice——写成结论就是把"没比成"说成"一样"）`);
    }
    if (o.degraded !== undefined && typeof o.degraded !== 'boolean') {
      throw new TypeError(`renderVerdict：degraded 是布尔，这里是 ${shape(o.degraded)}`);
    }
    const s = o.stats && typeof o.stats === 'object' ? o.stats : {};
    const n = (key) => (Number.isFinite(s[key]) ? s[key] : 0);
    let text;
    if (o.mode === 'text') {
      text = o.verdict === 'same'
        ? (n('ignored') > 0 ? `归一化之后两份文本相同（${n('ignored')} 行的空白或大小写差别没有计入）` : '两份文本逐字符相同')
        : `两份文本有差异：增 ${n('added')} 行 · 删 ${n('removed')} 行 · 改 ${n('changed')} 行 · ${n('blocks')} 处`;
    } else {
      const total = n('add') + n('remove') + n('change') + n('type');
      text = o.verdict === 'diff'
        ? `按 JSON 值有 ${total} 处不同（增 ${n('add')} · 删 ${n('remove')} · 改 ${n('change')} · 类型变 ${n('type')}）`
        : o.verdict === 'same-key-order' ? '按 JSON 值判为相同，但键的书写次序不同' : '按 JSON 值判为相同，键的书写次序也一致';
    }
    const warn = o.degraded === true ? `<span class="${el('verdict', 'warn')}">有一段对不齐，按整块删加整块增给出</span>` : '';
    return `<p class="${c('verdict')} ${mod('verdict', o.verdict)}">${esc(text)}${warn}</p>`;
  };

  /**
   * 坏输入与闸门那一档的一句话（Z11）。只有一句：两句话该由装配层挑一句递进来，
   * 视图层静默拼成一段就是吞掉了别的文案。
   * @param {string} text 那一句（通常是 `gate().reason` 或 `diffJson().error.reason`）
   * @returns {string} `<p>` 块
   */
  const renderNotice = (text) => {
    if (typeof text !== 'string' || text === '') {
      throw new TypeError(`renderNotice：只收一句话，这里是 ${shape(text)}（那一格空着，用户读到的是"这页坏了"而不是"哪儿不对"）`);
    }
    return `<p class="${c('notice')}">${esc(text)}</p>`;
  };

  /** 一侧那一格：缺席读 `absent` 这一档，不读预览串空不空（`{"a":null}` 的预览正是 `null`） */
  const sideCell = (type, preview, pointer) => {
    if (type === 'absent') return `<span class="${el('json', 'none')}">${esc(ABSENT_TEXT)}</span>`;
    if (typeof preview !== 'string') {
      throw new TypeError(`renderJsonTable：${String(pointer)} 这一格不是缺席档（type=${String(type)}）却没有预览串，这里是 ${shape(preview)}（表里出现空格子比抛出来难查十倍）`);
    }
    return esc(preview);
  };

  /**
   * JSON 档的变更清单：六列（位置 / 变更 / 归属 / A 侧 / B 侧 / 深度）+ 表尾那六句代价说明。
   * 表头与 `DIFF_JSON_NOTES` 同屏是刻意的（Y18 的第二半）：这一页给的结果在哪一档上打了折，
   * 用户应当在读"哪几格变了"的同一次滚动里读到，而不是翻到页脚。
   * @param {{changes: object[], stats: object, notes: string[], truncated: boolean}} o 四格
   * @returns {string}
   */
  const renderJsonTable = (o) => {
    if (!o || typeof o !== 'object') {
      throw new TypeError(`renderJsonTable：只收 { changes, stats, notes, truncated } 这一个对象，这里是 ${shape(o)}`);
    }
    if (!Array.isArray(o.changes)) throw new TypeError(`renderJsonTable：changes 应是 diffJson 交出的那份清单，这里是 ${shape(o.changes)}`);
    if (!Array.isArray(o.notes)) throw new TypeError('renderJsonTable：notes 应是 DIFF_JSON_NOTES 那六句的数组（装配层递错了要在这一层点名，静默少一句就是没人读的代价说明）');
    if (o.truncated !== undefined && typeof o.truncated !== 'boolean') {
      throw new TypeError(`renderJsonTable：truncated 是布尔，这里是 ${shape(o.truncated)}`);
    }
    const s = o.stats && typeof o.stats === 'object' ? o.stats : {};
    const meta = `<p class="${el('json', 'meta')}">比对 ${Number.isFinite(s.compared) ? s.compared : 0} 格 · 最深 ${Number.isFinite(s.depth) ? s.depth : 0} 层</p>`;
    const head = '<thead><tr>'
      + `<th class="${el('json', 'ptr')}">位置</th>`
      + `<th class="${el('json', 'kind')}">变更</th>`
      + `<th class="${el('json', 'owner')}">归属</th>`
      + `<th class="${el('json', 'a')}">A 侧</th>`
      + `<th class="${el('json', 'b')}">B 侧</th>`
      + `<th class="${el('json', 'depth')}">深度</th>`
      + '</tr></thead>';
    let body = '';
    for (let k = 0; k < o.changes.length; k += 1) {
      const row = o.changes[k];
      if (!row || typeof row !== 'object') throw new TypeError(`renderJsonTable：第 ${k} 行应是 diffJson 交出的那个变更对象，这里是 ${shape(row)}`);
      if (typeof row.pointer !== 'string') throw new TypeError(`renderJsonTable：第 ${k} 行的 Pointer 应是字符串，这里是 ${shape(row.pointer)}`);
      if (!KIND_LABELS[row.kind]) {
        throw new TypeError(`renderJsonTable：变更档只认 ${Object.keys(KIND_LABELS).join(' / ')}，这里是 ${String(row.kind)}（词汇表外的一档渲出来是一格空白的"变更"列）`);
      }
      if (!OWNER_LABELS[row.owner]) {
        throw new TypeError(`renderJsonTable：归属只认 ${Object.keys(OWNER_LABELS).join(' / ')}，这里是 ${String(row.owner)}`);
      }
      if (!Number.isInteger(row.depth) || row.depth < 0) {
        throw new RangeError(`renderJsonTable：第 ${k} 行的深度得是 ≥0 的整数，这里是 ${String(row.depth)}`);
      }
      body += `<tr class="${el('json', 'row')} ${mod('json__row', row.kind)}" ${at('depth')}="${row.depth}">`
        + `<td class="${el('json', 'ptr')}">${esc(row.pointer === '' ? '（根）' : row.pointer)}</td>`
        + `<td class="${el('json', 'kind')}">${KIND_LABELS[row.kind]}</td>`
        + `<td class="${el('json', 'owner')}">${OWNER_LABELS[row.owner]}</td>`
        + `<td class="${el('json', 'a')}">${sideCell(row.aType, row.aPreview, row.pointer)}</td>`
        + `<td class="${el('json', 'b')}">${sideCell(row.bType, row.bPreview, row.pointer)}</td>`
        + `<td class="${el('json', 'depth')}">${row.depth}</td></tr>`;
    }
    let list = '';
    for (const raw of o.notes) {
      if (typeof raw !== 'string' || raw.trim() === '') throw new TypeError(`renderJsonTable：notes 里每一句应是非空字符串，这里是 ${shape(raw)}`);
      list += `<li>${esc(raw)}</li>`;
    }
    const cut = o.truncated === true
      ? `<p class="${el('json', 'cut')}">列表到这里截断了，上面那四个计数仍是全量——没列出来的差额照样存在。</p>` : '';
    return `${meta}<table class="${c('json')}">${head}<tbody>${body}</tbody></table>`
      + (list === '' ? '' : `<ul class="${c('notes')}">${list}</ul>`) + cut;
  };

  return { renderSide, renderInline, renderFoldBar, renderStats, renderJsonTable, renderNotice, renderVerdict };
}
```

#### `scripts/toolkit-tests.mjs` §Z（整节，从 `// ── §Z` 那一行到本节末）

前半十二判各自咬的那一件事：Z1 视图层零 import + 八枚环境词 0 命中（`window` / `document` /
`localStorage` / `Date.now(` / `getComputedStyle` / `querySelector` / `FileReader` / `navigator`，
外加 `innerHTML` 0 次）；Z2 导出面恰好那三格与那七件、`env` 三缺件各自的构造期 `TypeError`；
Z3 `df-` 字面量 0 次 + 换前缀整页等式；Z4 两栏行数相等与 `fill` 那一格；Z5 `change` 行在两栏各
出现一次而高亮只有各自那一半；Z6 CRLF 画注入的符号、符号换了产出跟着换；Z7 折叠条那句"省略 N 行"
的 N 与 `hunksOf` 同源（同一串里恰好出现两次：属性一次、正文一次）；Z8 三类恶意载荷过全部渲染器
且行内容能逐字符还原；Z9 属性词表恰好那四枚整数槽；Z10 JSON 表六列表头与 `DIFF_JSON_NOTES` 同页
（Y18 的第二半）；Z11 坏输入态只有一句话且不吞别的文案；Z12 统计串与结论串逐字符钉死、`blocked`
与 `invalid` 进不了 `renderVerdict`。

三把源码扫描的尺**直接复用 §W 的顶层 helper**（`wCode` / `wBare` / `modNames`），`zCount` 就是
`wCount` 换了个本节读得懂的名字——同一把尺不许有第二份实现（§Y 复用 §X 的 `X_BYTES` / `X_HUGE` /
`dGate` 是同一条纪律）。

落地时从引擎里读出来的两条，钉成判据而不是绕过去，§0.6 里各有一行登记（那一格另有两行：`--fill` 的画法、用例分布表的账）：
① 两份文本**逐字符相同**时 `hunksOf` 返回 `[]`，也就是一行都不产出（"完全相同"那一档的空页面形状是
Task 5 装配层的事，视图层只保证"给它零行就画零行"）；② `Row.inline` 是 equal/del/ins **混在一起的
一份数组**，所以 `renderInline` 按侧**筛**而不是各拿一半——传错侧的 tone 不报错，超出那三种 tone 才抛。

```js
// ── §Z 对比页视图层与装配层（`tools/diffView.js` / `tools/diffWorkbench.js` / `toolDiff.js`，段 5 Task 4/5）──
// 本格（Task 4）只立前半 **Z1–Z12**，钉的是视图层那七件；后半 Z13–Z28 由 Task 5 在**同一节**续写
// ——节名不另起，先例是 §U（§S–§W 那几族里 §U 就是两格共用一节）。
// 三条红线写死在这里，实现不许自创第二套：
//   · **零 import**（Z1）：与 `jsonView.js` 同一条构建约束（§0.4）——这一本一旦 import 什么，
//     `toolDiff.js` 与 `toolkitCore.js` 就同时 reach 那个模块，Rollup 切出共享 chunk，
//     `iifeWrapPlugin` 包完的产物里留下 `import{`，整页 SyntaxError 而构建 exit=0。
//     所以 `esc`、类名前缀与 CR 符号三件全部由 `env` 注入，缺一件在**构造期**点名（Z2），
//     不许退化成"默认前缀 df"那种静默兜底。
//   · **类名与属性名只从 `env.prefix` 派生**（Z3）：本文件剥注释的源码里 `df-` 出现 **0 次**，
//     连整格字面量（§W10 那条口径，三种引号都算）也不许有。这不是洁癖——Task 5 的换前缀自证
//     （`df` ↔ `zx`）只有在派生是真的时才绿，手打过一处字面量就等于给那道门禁装假牙。
//   · **用户文本只出现在 `esc` 之后，且永远不进属性位**（Z8、Z9）：属性值只允许整数。
//     对齐引擎交出来的是 `textA/textB` 与 Pointer 这类文本；行号、栏内下标、省略行数、深度才是这一格的属性。
// 视图层另管三件"CSS 兜不了的事"：
//   ① 并排两栏各读同一份行流，**缺席那一侧长成 fill 而不是少一行**（Z4）——两栏行数不等时滚动一错位，
//      用户读到的是"这行没变"，实情是两侧各有一行；
//   ② 一个 `change` 行在两栏各出现一次，而高亮只有各自那一半（Z5），且分段拼回去必须还是整行原文；
//   ③ CRLF 那一格画注入的符号而不是留白（Z6），折叠条那句"省略 N 行"的 N 与 `hunksOf` 同源（Z7）。
// JSON 档那一表另有两格：`absent` 与"值真的是 null"必须分得开（Z10，§0.6 记的那格偏差），
// 而 `DIFF_JSON_NOTES` 那六句代价说明与表同屏——Y18 的第二半就落在这里。
// §W 那三把剥源码的尺（`wCode` / `wBare` / `wCount`）与 `modNames` 在本节直接复用：
// 同一件事只该有一把尺，重新写一遍就成了"两遍里有一遍是错的"（X4 第一轮抓到的那种形状）。
const {
  createDiffView: zCreate, DF_SIDES: Z_SIDES, DF_CORE_KINDS: Z_CORE_KINDS,
} = await import('../dev/js/tools/diffView.js');

/** 本节一律用真前缀与真符号：视图层不许自己存一份 `␍`（Z6 断的就是这件事） */
const Z_P = 'df';
const zEnv = (over) => ({ esc: J_VIEW.esc, prefix: Z_P, crGlyph: X_CR, ...over });
/** 全展开的行流：`hunksOf(..., Infinity)` 摊平，Z4/Z5/Z6 要的是"没有折叠干扰"的那一份行档 */
const zRows = (a, b, o) => dHunks(dLines(a, b, o), Infinity).flatMap((h) => h.rows);
/** renderSide 的输出是一串并排的 `<div>`，按 `<div` 切开就能逐格读行档 */
const zBlocks = (html) => html.split(/(?=<div)/).filter((s) => s !== '');
/** 剥标签并把 esc 那五枚实体还原：断"这一格显示的正是原文"用得上（&amp; 必须最后还原） */
const zPlain = (html) => html.replace(/<[^>]*>/g, '')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');
/** 行内容那一格：`<pre class="df-row__txt">` 到它的 `</pre>`——用 pre 而不是 span，行内再套多少枚 span 都切得干净 */
const zTxt = (html) => {
  const m = /<pre class="[^"]*row__txt">([\s\S]*?)<\/pre>/.exec(html);
  return m ? zPlain(m[1]) : null;
};
/** 属性清单：`\sname="value"` 的成对，Z9 数的是"这一页到底往属性位写了什么" */
const zAttrs = (html) => [...html.matchAll(/ ([-a-z]+)="([^"]*)"/g)].map((m) => ({ name: m[1], value: m[2] }));
/** 数出现次数：§W 那把尺在本节直接复用（同一件事只该有一把尺），换个本节读得通的名字 */
const zCount = wCount;

test('Z1 视图层零 import、零环境词：它只产串，节点与浏览器一律够不着', () => {
  const rel = 'dev/js/tools/diffView.js';
  assert.equal(/\bimport\b/.test(wCode(rel)), false, 'diffView 一旦 import 什么，两个入口就 reach 同一模块 → Rollup 切共享 chunk → iife-wrap 后产物里是 import{ → 整页 SyntaxError 而构建 exit=0（§0.4 那条红线，与 §W2 同一条）');
  assert.equal(/\brequire\s*\(/.test(wCode(rel)), false, '同上：require 在这儿等于第二条跨模块的边');
  assert.equal(wCount(wCode(rel), 'innerHTML'), 0, '视图层不许写节点：整页只有装配层那唯一的 innerHTML 出口（§W 同一条口径，这里连字符串里都不许出现）');
  const bare = wBare(rel);
  for (const word of ['window', 'document', 'localStorage', 'Date.now(', 'getComputedStyle', 'querySelector', 'FileReader', 'navigator']) {
    assert.equal(bare.includes(word), false, `视图层不许碰 ${word}：纯串生成器碰一次就多一处不可复算，而 FileReader 与 File 那一格归入口`);
  }
});

test('Z2 注入缺件在构造期就点名，导出面恰好这三格与那七件', () => {
  const v = zCreate(zEnv());
  assert.deepEqual(Object.keys(v).sort(),
    ['renderFoldBar', 'renderInline', 'renderJsonTable', 'renderNotice', 'renderSide', 'renderStats', 'renderVerdict'],
    '七件里加一件或改一名，装配层就有一处叫不到它；而"多一件"通常是第二条渲染路径');
  for (const [name, fn] of Object.entries(v)) assert.equal(typeof fn, 'function', `${name} 不是函数：这一件到页面上就是"点了没反应"`);
  assert.deepEqual(modNames('dev/js/tools/diffView.js'), ['DF_CORE_KINDS', 'DF_SIDES', 'createDiffView'].sort(),
    'diffView.js 的导出面多了名字：词表之外不许再有第二格公开的东西');
  assert.deepEqual(Z_SIDES, ['a', 'b'], '第三栏在这一页没有对应的事实');
  assert.deepEqual(Z_CORE_KINDS, ['equal', 'change', 'del', 'ins'], '对齐引擎只交得出这四档，第五档（fill）是视图层自己的，不许混进这一份词表');
  const missing = [
    [{ prefix: Z_P, crGlyph: X_CR }, /esc/, '缺 esc 的下场是用户文本被当标记插进结果区'],
    [{ esc: J_VIEW.esc, crGlyph: X_CR }, /prefix/, '缺前缀则整套类名与属性名无从派生'],
    [{ esc: J_VIEW.esc, prefix: Z_P }, /crGlyph/, '缺符号则"行尾有回车"与"这一格没渲染"混成同一档'],
  ];
  for (const [env, re, why] of missing) {
    assert.throws(() => zCreate(env), (e) => e instanceof TypeError && re.test(e.message) && /createDiffView/.test(e.message),
      `构造期没点名（${why}）：抛在挂载期就是整页空白，而这里连挂载都到不了`);
  }
  assert.throws(() => zCreate(), TypeError, '整格缺件也要抛，不许退化成"默认前缀 df"');
  assert.throws(() => zCreate({ esc: 'nope', prefix: Z_P, crGlyph: X_CR }), TypeError);
  assert.throws(() => zCreate({ esc: J_VIEW.esc, prefix: 'df bad', crGlyph: X_CR }), /prefix/, '前缀里带空格：整套 class 名到页面上就是碎的');
  assert.throws(() => zCreate({ esc: J_VIEW.esc, prefix: '', crGlyph: X_CR }), /prefix/);
  assert.throws(() => zCreate({ esc: J_VIEW.esc, prefix: 'df-row', crGlyph: X_CR }), /prefix/, '前缀自己带连字符，产出的类名读不出哪一段是词根');
  assert.throws(() => zCreate({ esc: J_VIEW.esc, prefix: Z_P, crGlyph: '' }), /crGlyph/);
  assert.throws(() => zCreate({ esc: J_VIEW.esc, prefix: Z_P, crGlyph: 7 }), /crGlyph/);
});

test('Z3 类名与属性名全由 env.prefix 派生：本文件剥注释的源码里 df- 出现 0 次', () => {
  const rel = 'dev/js/tools/diffView.js';
  assert.equal(wCount(wCode(rel), 'df-'), 0, '手打 df- 字面量一处，Task 5 的换前缀自证就绿得没有牙：整页类名跟着 zx- 换才是真的派生');
  const hand = [];
  wCode(rel).replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, (s) => {
    if (/^['"`]df-/.test(s)) hand.push(s);
    return "''";
  });
  assert.deepEqual(hand, [], '整格字面量口径（§W10 同一条，三种引号都算）：以 df- 起头的串在本文件里一处都不该有');
  const rows = zRows('keep\nold tail', 'keep\nnew tail');
  const asDf = zCreate(zEnv()).renderSide(rows, 'a');
  const asZx = zCreate(zEnv({ prefix: 'zx' })).renderSide(rows, 'a');
  assert.equal(asZx, asDf.replaceAll('df-', 'zx-'), '换前缀之后产出必须逐字符跟着换：这一格没跟着换的地方就是第二套类名');
  assert.equal(asZx.includes('df-'), false, '换档之后还留着 df- = 两处字面量没派生');
});

test('Z4 并排两栏的行数相等：缺席那一侧长成 fill 而不是少一行，且不给自己编行号', () => {
  const v = zCreate(zEnv());
  const rows = zRows('a\nb\nc', 'a\nX\nc\nlast');
  const A = v.renderSide(rows, 'a');
  const B = v.renderSide(rows, 'b');
  assert.equal(zCount(A, ` data-${Z_P}-i=`), rows.length, '一栏一份行块：renderSide 不许把 fill 那一格省掉');
  assert.equal(zCount(B, ` data-${Z_P}-i=`), rows.length, '两栏行数不等 = 滚动一错位就错到底，对齐是视图层的责任不是 CSS 的');
  assert.deepEqual(zBlocks(A).map((bl) => /-row--(\w+)/.exec(bl)[1]), ['equal', 'change', 'equal', 'fill'],
    'A 栏那一列行档：新增行在 A 侧是 fill，不是凭空少一行');
  assert.deepEqual(zBlocks(B).map((bl) => /-row--(\w+)/.exec(bl)[1]), ['equal', 'change', 'equal', 'ins']);
  const fill = zBlocks(A)[3];
  assert.equal(fill.includes(` data-${Z_P}-ln=`), false, 'fill 不许有行号：那是"这一侧没有这一行"，不是第 0 行');
  assert.equal(zPlain(fill).trim(), '', 'fill 那一格除了行档什么都不写，占位交给 CSS 的行高');
  const bothRows = zBlocks(B)[3];
  assert.equal(new RegExp(` data-${Z_P}-ln="(\\d+)"`).exec(bothRows)[1], '3', '行号取的是这一侧的下标（0-based → 屏上 1-based）');
  // 上面那一句读的是**属性**里那个 0-based 下标，屏上画出来的那一格还得再钉一次：Task 8 的变异刀
  // （`ln + 1` 改成 `ln`）在这一格里量不到任何东西——整族 439 判全绿，而页面上每一行的行号都从 0 起。
  const noCell = (bl) => {
    const m = new RegExp(`<span class="${Z_P}-row__no">([^<]*)</span>`).exec(bl);
    return m ? m[1] : null;
  };
  assert.deepEqual(zBlocks(A).map(noCell), ['1', '2', '3', ''], '可见行号 = 下标 + 1：属性是 0-based 那一格已经钉过，这一句钉的是用户读到的那个数（fill 留空）');
  assert.deepEqual(zBlocks(B).map(noCell), ['1', '2', '3', '4'], '两栏各自数自己那一侧的行号：B 侧多出的第 4 行在 A 侧是 fill');
  assert.deepEqual(zRows('a\nb', 'a\nb'), [],
    '完全相同拿不出任何行：hunksOf 只切差异块。两栏各 0 行仍然等长，而"这里明明比过了"那句话归结论格（Z12）与装配层的空态（Task 5）');
  const same = v.renderSide(zRows('a\n\nb', 'a\n\nB'), 'a');
  assert.equal(zBlocks(same).length, 3, '有差异才切得出块：这一份的中间那行是空行');
  assert.equal(zCount(same, `${Z_P}-row__txt"></pre>`), 1, '空行那一格是空串，但行块照样在：视图层不许替它猜一个占位符');
  assert.throws(() => v.renderSide(rows, 'c'), /栏只认/);
  assert.throws(() => v.renderSide(null, 'a'), TypeError);
  assert.throws(() => v.renderSide(['x'], 'a'), TypeError, '行对象不是对象要说清第几行——静默渲一栏空白是这一层最难查的形状');
  assert.throws(() => v.renderSide([{ kind: 'weird', a: 0, b: 0, textA: '', textB: '', inline: null, crlfA: false, crlfB: false }], 'a'),
    /kind/, '对齐引擎多出一档而行视图不认识它，必须停在开发期，不许静默渲成一栏没有头的东西');
});

test('Z5 change 行在两栏各出现一次，而高亮只有各自那一半', () => {
  const v = zCreate(zEnv());
  const rows = zRows('foo bar baz', 'foo qux baz');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'change');
  assert.ok(Array.isArray(rows[0].inline), '这一对行该有行内细化；没有的话是夹具越了 token 档，要改样本不是改口径');
  const A = v.renderSide(rows, 'a');
  const B = v.renderSide(rows, 'b');
  assert.equal(zCount(A, `${Z_P}-row--change`), 1, '同一次改动在两栏各出现一次');
  assert.equal(zCount(B, `${Z_P}-row--change`), 1);
  assert.equal(A.includes(`${Z_P}-inline--ins`), false, 'A 栏高亮对方新增的 token，等于把 B 的内容画在 A 的行上');
  assert.equal(B.includes(`${Z_P}-inline--del`), false, '同一件事的反方向');
  assert.equal(zCount(A, `${Z_P}-inline--del`), 1);
  assert.equal(zCount(B, `${Z_P}-inline--ins`), 1);
  assert.equal(zTxt(A), 'foo bar baz', '分段拼回去必须还是整行原文：少一段就是"页面上的行"不再是那一行');
  assert.equal(zTxt(B), 'foo qux baz');
  assert.equal(v.renderInline([{ t: 'equal', text: 'a' }, { t: 'del', text: 'b' }, { t: 'ins', text: 'c' }], 'a'),
    `a<span class="${Z_P}-inline--del">b</span>`, '一条片段序列里 del 与 ins 交替躺着：A 栏只读等价与自己被删的那半，另一侧那半是 B 栏的内容');
  assert.equal(v.renderInline([{ t: 'equal', text: 'a' }, { t: 'del', text: 'b' }, { t: 'ins', text: 'c' }], 'b'),
    `a<span class="${Z_P}-inline--ins">c</span>`, '同一份片段在 B 栏读的是另一半（少挑一次就是把对方的改动画在自己行上）');
  assert.throws(() => v.renderInline('x', 'a'), TypeError);
  assert.throws(() => v.renderInline([{ t: 'weird', text: 'y' }], 'a'), /档只认/,
    '词汇表外的着色档要抛：样式那边没有第四种颜色，静默忽略就是"高亮少了一块却看不出来"');
  assert.throws(() => v.renderInline([{ t: 'equal' }], 'a'), TypeError, '缺 text 的片段到了页面上是一串 undefined');
});

test('Z6 CRLF 那一格画注入的符号而不是留白，符号换了产出跟着换', () => {
  const v = zCreate(zEnv());
  const rows = zRows('a\r\nb\r\n', 'a\r\nb\n');
  assert.deepEqual(rows.map((r) => r.kind), ['equal', 'change'], '同一行文字、行尾形状不同 → 第二行是一处改动（crlf 进比较键，X1 与 X6 的口径）');
  assert.equal(rows[1].crlfA, true);
  assert.equal(rows[1].crlfB, false);
  const A = v.renderSide(rows, 'a');
  const B = v.renderSide(rows, 'b');
  assert.equal(zCount(A, `${Z_P}-row__cr">${X_CR}<`), 2, '行尾那个回车必须画得出符号：留白与"这一格没渲染"在页面上是同一张脸');
  assert.equal(zCount(B, `${Z_P}-row__cr">${X_CR}<`), 1);
  assert.equal(zCount(B, `${Z_P}-row__cr`), 1, '不带回车的那一侧不许长出这一格（省一格是一格，别靠 CSS 藏）');
  assert.equal(zPlain(zBlocks(A)[1]).endsWith(`b${X_CR}`), true, '符号落在行内容之后，读起来就是"这一行以回车结尾"');
  const swapped = zCreate(zEnv({ crGlyph: 'CR' })).renderSide(rows, 'a');
  assert.equal(swapped, A.replaceAll(X_CR, 'CR'), '符号从注入里来：写死 ␍ 等于在视图层再存一份口径，而那一本已经在 diff-core');
  assert.equal(v.renderSide(zRows('a\nb', 'a\nb'), 'a').includes(`${Z_P}-row__cr`), false, '一格里都不该有');
});

test('Z7 折叠条那句"省略 N 行"的 N 与 hunksOf 同源，0 行那一档整条不长', () => {
  const v = zCreate(zEnv());
  const a = Array.from({ length: 40 }, (_, i) => `L${i}`).join('\n');
  const b = a.replace('L0', 'X0').replace('L30', 'Y30');
  const hs = dHunks(dLines(a, b), 1);
  assert.equal(hs.length, 2, '夹具该折叠出两块：context=1 而两段之间隔着 29 行相同');
  assert.equal(hs[0].skipped, 0, '夹具的第一块要从文件头开始，否则下面那句"第一条不许长条"是空跑');
  assert.ok(hs.slice(1).every((h) => h.skipped > 0), '省略行数不全是正数的话，这一串断言同样在空跑');
  const bars = hs.map((h) => v.renderFoldBar({ skipped: h.skipped, tail: false }));
  assert.equal(bars[0], '', '第一块前面没有东西，不许长出"省略 0 行"那种自证式空条');
  for (let k = 1; k < hs.length; k += 1) {
    const n = Number(new RegExp(` data-${Z_P}-skip="(\\d+)"`).exec(bars[k])[1]);
    assert.equal(n, hs[k].skipped, '条上的数字与 skipped 同源：两处各算一遍就是"折叠条说谎"的成因');
    assert.equal(zPlain(bars[k]).startsWith(`省略 ${n} 行`), true);
    assert.equal(zCount(bars[k], String(n)), 2, '属性一次、正文一次，别的格子不许出现这个数');
  }
  const last = hs[hs.length - 1];
  assert.ok(last.tailSkipped > 0, '夹具该在末尾留下一段折叠');
  const tail = v.renderFoldBar({ skipped: last.tailSkipped, tail: true });
  assert.equal(tail.includes(`${Z_P}-fold--tail`), true, '尾条与头条是两档：样式与点击行为都按这两档分');
  assert.equal(tail.includes(`${Z_P}-fold--head`), false);
  assert.equal(tail.includes(` data-${Z_P}-skip="${last.tailSkipped}"`), true);
  assert.equal(v.renderFoldBar({ skipped: 0, tail: true }), '');
  assert.equal(v.renderFoldBar({ skipped: last.skipped }), v.renderFoldBar({ skipped: last.skipped, tail: false }), 'tail 缺省就是 false，不许把"没给"读成"是尾条"');
  assert.throws(() => v.renderFoldBar({ skipped: 2.5 }), RangeError, '省略行数只该是整数：小数会把滚动条总长算歪（与 §V 的 treePad 同一条）');
  assert.throws(() => v.renderFoldBar({ skipped: -1 }), RangeError);
  assert.throws(() => v.renderFoldBar({ skipped: 3, tail: 'yes' }), TypeError);
  assert.throws(() => v.renderFoldBar(null), TypeError);
});

test('Z8 每一只渲染器都过 env.esc：三类载荷进去，出来的串里没有裸标记', () => {
  const v = zCreate(zEnv());
  const payloads = ['<script>alert("x")</script>', 'a"b\'c&d', '两行\n载荷'];
  for (const raw of payloads) {
    const want = J_VIEW.esc(raw);
    assert.equal(v.renderNotice(raw).includes(want), true, `renderNotice 没走注入的那只 esc：${raw}`);
    assert.equal(v.renderNotice(raw).includes('<script'), false);
    const rowHtml = v.renderSide([{ kind: 'equal', a: 4, b: 4, textA: raw, textB: raw, inline: null, crlfA: false, crlfB: false }], 'a');
    assert.equal(rowHtml.includes(want), true, `renderSide 的行内容没走 esc：${raw}`);
    assert.equal(zTxt(rowHtml), raw, '转义是可逆的这一层该做到的：屏上读到的还是那一行');
    assert.equal(v.renderSide([{ kind: 'change', a: 0, b: 0, textA: raw, textB: raw, inline: [{ t: 'del', text: raw }], crlfA: false, crlfB: false }], 'a').includes(want), true,
      '行内片段同样只出 esc 之后的串');
    const table = v.renderJsonTable({
      changes: [{ pointer: raw, kind: 'change', owner: 'both', depth: 1, aPreview: raw, bPreview: '1', aType: 'string', bType: 'number' }],
      stats: { add: 0, remove: 0, change: 1, type: 0, compared: 3, depth: 1 }, notes: [raw], truncated: false,
    });
    assert.equal(wCount(table, want) >= 3, true, 'Pointer、A 侧与表尾那一句三处都要过 esc，少一处就是有一格漏网');
    assert.equal(table.includes('<script'), false);
  }
  assert.equal(v.renderNotice('<b>粗</b>').includes('&lt;b&gt;'), true, '连强调标签都不许放过去');
});

test('Z9 行内容与 Pointer 不许落到属性位：属性名与属性值都只认那几格', () => {
  const v = zCreate(zEnv());
  const nasty = 'x" data-evil="1';
  const html = v.renderSide([{ kind: 'change', a: 2, b: 3, textA: nasty, textB: 'y', inline: [{ t: 'del', text: nasty }, { t: 'ins', text: 'y' }], crlfA: false, crlfB: false }], 'a')
    + v.renderJsonTable({
      changes: [{ pointer: nasty, kind: 'remove', owner: 'only-a', depth: 0, aPreview: nasty, bPreview: null, aType: 'string', bType: 'absent' }],
      stats: { add: 0, remove: 1, change: 0, type: 0, compared: 1, depth: 0 }, notes: [], truncated: false,
    })
    + v.renderFoldBar({ skipped: 7 });
  const attrs = zAttrs(html);
  assert.ok(attrs.length >= 6, `夹具该产出若干属性，实际 ${attrs.length} 个——空跑一遍等于没判`);
  assert.deepEqual([...new Set(attrs.map((x) => x.name))].filter((n) => n !== 'class' && n !== 'type').sort(),
    [`data-${Z_P}-depth`, `data-${Z_P}-i`, `data-${Z_P}-ln`, `data-${Z_P}-skip`],
    '属性名多一枚就是第二套口径：装配层与样式只认这几格');
  for (const { name, value } of attrs) {
    if (name === 'class' || name === 'type') continue;
    assert.match(value, /^\d+$/, `${name} 的属性位上出现了非整数值：${value}`);
  }
  assert.equal(/[A-Za-z]/.test(attrs.filter((x) => x.name !== 'class' && x.name !== 'type').map((x) => x.value).join('')), false,
    '属性值里出现字母就是文本进了属性位——那一格 esc 管不住');
  assert.equal(zPlain(html).includes(nasty), true, '载荷要作为正文原样到达，不许被"顺手剔掉"');
});

test('Z10 JSON 变更表：六列表头、absent 与真 null 分得开、代价说明同屏（Y18 的第二半）', () => {
  const v = zCreate(zEnv());
  const r = yDiff('{"a":1,"b":2}', '{"a":null}');
  assert.deepEqual([r.verdict, r.stats.type, r.stats.remove, r.stats.compared], ['diff', 1, 1, 2], '夹具形状：/a 是类型变（1 → null），/b 是删除');
  const html = v.renderJsonTable({ changes: r.changes, stats: r.stats, notes: Object.values(Y_NOTES), truncated: false });
  assert.deepEqual([...html.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]),
    ['位置', '变更', '归属', 'A 侧', 'B 侧', '深度'], '六列少一列或换了次序，表读起来就和 diff-json 交出的那六格对不上');
  const cellsOf = (tr) => [...tr.matchAll(/<td class="[^"]*">([\s\S]*?)<\/td>/g)].map((m) => zPlain(m[1]));
  const trs = html.split('<tr').slice(2);
  assert.equal(trs.length, 2);
  assert.deepEqual(cellsOf(trs[0]), ['/a', '类型变', '两侧', '1', 'null', '1'], '值真的是 null 的那一格写 null，不是"这一侧没有"（§0.6 记的偏差）');
  assert.deepEqual(cellsOf(trs[1]), ['/b', '删除', '仅 A', '2', '（这一侧没有）', '1']);
  assert.equal(zCount(html, '（这一侧没有）'), 1, '缺席档只在真缺席的那一格出现');
  assert.equal(html.includes('比对 2 格'), true, 'stats.compared 要上屏：不写这一格用户读不出"比了多久"');
  assert.equal(html.includes('最深 1 层'), true);
  assert.equal(zCount(html, '<li'), Object.keys(Y_NOTES).length, '六句代价说明与表同屏，拆到别处就没人读');
  for (const [k, sentence] of Object.entries(Y_NOTES)) assert.equal(html.includes(J_VIEW.esc(sentence)), true,
    `漏了 ${k} 那一句（或那一句没过 esc）：${sentence}`);
  assert.equal(html.includes('这里截断'), false);
  assert.equal(v.renderJsonTable({ changes: r.changes, stats: r.stats, notes: [], truncated: true }).includes('这里截断'), true,
    'truncated 那一档要说"列表截了、计数仍是全量"（Y12、Y18）');
  const empty = v.renderJsonTable({ changes: [], stats: { add: 0, remove: 0, change: 0, type: 0, compared: 3, depth: 2 }, notes: [], truncated: false });
  assert.equal(zCount(empty, '<tr class'), 0, '零变更就是一张没有体的表，不是"没有这张表"');
  assert.equal(empty.includes('比对 3 格'), true);
  const bad = (over, re, why) => assert.throws(() => v.renderJsonTable({
    changes: [{ pointer: '/a', kind: 'change', owner: 'both', depth: 0, aPreview: '1', bPreview: '2', aType: 'number', bType: 'number', ...over }],
    stats: {}, notes: [], truncated: false,
  }), re, why);
  bad({ kind: 'rename' }, /变更档/, '词汇表外的 kind 不许静默渲成一格空白的"变更"列');
  bad({ owner: 'only-c' }, /归属/, '同一件事在归属列');
  bad({ pointer: 1 }, TypeError, 'Pointer 是文本，不是编号');
  bad({ depth: 1.5 }, RangeError, '深度只该是整数');
  bad({ aPreview: undefined }, /预览/, '非缺席的一格预览缺席 = 表里出现空格子');
  assert.throws(() => v.renderJsonTable({ changes: 'x', stats: {}, notes: [] }), TypeError);
  assert.throws(() => v.renderJsonTable({ changes: [], stats: {}, notes: 'x' }), TypeError, 'notes 只收那六句的数组：装配层递错了要在这一层点名');
  assert.throws(() => v.renderJsonTable({ changes: [], stats: {}, notes: [], truncated: 'yes' }), TypeError);
  assert.throws(() => v.renderJsonTable(null), TypeError);
});

test('Z11 坏输入那一格只有一句话，且不吞掉别的文案', () => {
  const v = zCreate(zEnv());
  const reason = dGate(X_HUGE, '1').reason;
  const html = v.renderNotice(reason);
  assert.equal(zCount(html, '<p'), 1, '一句话就是一句话：拆成两段会让"闸门那一档"在页面上长得像一段说明');
  assert.equal(zCount(html, '</p>'), 1);
  assert.equal(zPlain(html), reason, '那句理由要逐字到达（上限与实测与超出都在里面）');
  assert.equal(html.includes(`${Z_P}-notice`), true);
  const page = html + v.renderStats(dLines('a', 'a').stats);
  assert.equal(zCount(page, '<p'), 2, 'notice 与读数各写各的格子，拼起来两处都还在');
  assert.throws(() => v.renderNotice(''), /一句话/);
  assert.throws(() => v.renderNotice(null), TypeError);
  assert.throws(() => v.renderNotice(['a', 'b']), TypeError, '两句话该由装配层挑一句递进来，视图层不许静默拼成一段');
});

test('Z12 读数只认那七个名字，结论按模式各有词表且 blocked / invalid 进不来', () => {
  const v = zCreate(zEnv());
  const s = { added: 1, removed: 2, changed: 3, unchanged: 4, blocks: 5, inlineSkipped: 6, ignored: 7 };
  const html = v.renderStats(s);
  assert.equal(html, `<p class="${Z_P}-stats">增 1 · 删 2 · 改 3 · 同 4 · 5 处 · 未行内 6 · 归一化抹平 7</p>`,
    '读数那一行的措辞与顺序钉死：装配层只挑递哪一份 stats，不挑这一行长什么样');
  assert.equal(html, v.renderStats({ ...s, future: 99, verdict: 'nope' }), '模块以后往 stats 里加一格，这一行的形状不许跟着变');
  assert.equal(v.renderStats({}), `<p class="${Z_P}-stats">增 0 · 删 0 · 改 0 · 同 0 · 0 处 · 未行内 0 · 归一化抹平 0</p>`,
    '缺的那一格给 0，不给空格也不给 —：那是"这一份里一处新增也没有"，不是"没测出来"');
  assert.throws(() => v.renderStats(null), TypeError);
  assert.throws(() => v.renderStats('x'), TypeError);
  const t = (over) => v.renderVerdict({ mode: 'text', verdict: 'same', stats: { ...s, ignored: 0 }, ...over });
  assert.equal(t().includes('逐字符相同'), true);
  assert.equal(t({ stats: { ...s, ignored: 9 } }).includes('归一化'), true, '勾了忽略空白之后的"相同"要说清是被归一化过的结论（X20、DIFF_NOTES.ignored）');
  const d = v.renderVerdict({ mode: 'text', verdict: 'diff', stats: s });
  for (const piece of ['增 1 行', '删 2 行', '改 3 行', '5 处']) assert.equal(d.includes(piece), true, `结论那一格少说一件事：${piece}`);
  assert.equal(v.renderVerdict({ mode: 'text', verdict: 'diff', stats: s, degraded: true }).includes('整块'), true, '降级必须在结论格里也说一句（X13、X14 上页的那一半）');
  assert.equal(d.includes('整块'), false, '没降级不许提');
  const jSame = v.renderVerdict({ mode: 'json', verdict: 'same', stats: { add: 0, remove: 0, change: 0, type: 0, compared: 3, depth: 1 } });
  assert.equal(jSame.includes('按 JSON 值判为相同'), true, 'json 档的"相同"不许写成"逐字符相同"——那是另一件事（Y3）');
  assert.equal(jSame.includes('键的书写次序也一致'), true);
  const sk = yDiff('{"a":1,"b":2}', '{"b":2,"a":1}');
  assert.equal(sk.verdict, 'same-key-order');
  assert.equal(v.renderVerdict({ mode: 'json', verdict: sk.verdict, stats: sk.stats }).includes('键的书写次序不同'), true);
  assert.equal(v.renderVerdict({ mode: 'json', verdict: 'diff', stats: { add: 1, remove: 2, change: 3, type: 4 } }).includes('10 处不同'), true,
    '四个数要在这一格里合得起来：用户读的是"几处"，表读的是"哪几处"');
  for (const word of ['blocked', 'invalid', 'same-key-order']) {
    assert.throws(() => v.renderVerdict({ mode: 'text', verdict: word, stats: s }), /renderNotice/,
      `text 档认得 ${word} 就是把"没比成"写成结论`);
  }
  for (const word of ['blocked', 'invalid']) {
    assert.throws(() => v.renderVerdict({ mode: 'json', verdict: word, stats: {} }), TypeError);
  }
  assert.throws(() => v.renderVerdict({ mode: 'yaml', verdict: 'same', stats: s }), /模式/);
  assert.throws(() => v.renderVerdict(null), TypeError);
  assert.throws(() => v.renderVerdict({ mode: 'text', verdict: 'same', stats: s, degraded: 'yes' }), TypeError);
  assert.equal(v.renderVerdict({ mode: 'text', verdict: 'diff', stats: s }).includes(`${Z_P}-verdict--diff`), true, '结论档也进 class：样式只认那三个词');
});

// 装配层与入口（Task 5）落进**同一节**，所以这里不再立 `// ── §` 标记：`§Z` 那一格数的判据要连着
// Z1–Z28 一起报，另起一节会让 §A 那张用例分布表少算一格（段 4 的 §U 是同一形状的先例）。
//
// 本节后半钉的是"这一页跑不跑得起来"，六条红线各自的形状：
//   · **环境只在入口**（Z14、Z15）：词表比 §W10 多两枚——`FileReader` 与 `File` 这两只手归入口，
//     装配层里 `FileReader` 0 次、`instanceof` 0 次（本层不判断宿主类型，收到了就当对象读形状）。
//     `localStorage` 与 `Date.now(` 这一页**两本都不许出现**（本页不做"记住上次输入"，红线里
//     那句"输入不出本机"因此不需要任何退路可写）；入口那八件各恰好一处，数的是出现次数。
//   · **id 只由 `DIFF_SPEC` / `DIFF_ACTIONS` 派生**（Z16）：装配层源码里 `df-` 0 次、整格字面量 0 格，
//     `controlIds(prefix)` 与骨架与 spec 三个方向对账；入口那三行地址（`CONTAINER_ID` / `NOTICE_ID`
//     / `ATTR`）反过来**必须**是字面量——那是本页在 HTML 里的地址，门禁⑤ 组 5 靠正则找那三行。
//   · **挂载期与输入路径一次计算都不做**（Z18）：二十次 `input` 之后注入的 `runGuarded` 计数为 0，
//     结果区里一行 `df-row` 都不许有；防抖令牌只让最后一次真的读闸门（`state().gateReads` 数这件事）。
//   · **两类失败分两条路**（Z26）：用户那一格不能用（空输入 / 坏 JSON / 超闸门）→ 一句话进状态行，
//     上一格结果原样留着；spec 与骨架漂移（档位越界、节点缺席）→ 原样上抛交给 `runGuarded`，
//     同样**不许擦掉上一格**（`compute` 一律先算后画，抛在画之前）。
//   · **换前缀自证**（Z28）：`df` ↔ `zx` 整页 id 跟着换、门禁仍绿，照 §R16 / §W18 那一形状。
//   · **import 边闭合**（Z13）：正向核装配层只 reach 那三本，反向核用排除式写法（M16 / N19）数"谁 reach"。

const {
  createDiffWorkbench: zCreateWb, DIFF_PANEL_IDS: Z_PANEL_IDS, DIFF_SPEC: Z_SPEC,
  DIFF_ACTIONS: Z_ACTIONS, SIDES: Z_SIDE_NAMES, controlIds: zControlIds,
  fieldId: zField, buttonId: zButton, copyId: zCopy, outId: zOut, whenId: zWhen, statusId: zStatus,
} = await import('../dev/js/tools/diffWorkbench.js');

const Z_PANEL = 'workbench';
const Z_BAR = 'bar';
const Z_ASSEMBLY = 'dev/js/tools/diffWorkbench.js';
const Z_ENTRY = 'dev/js/toolDiff.js';
const Z_CORE_REL = 'dev/js/tools/diff-core.js';
const Z_JSON_REL = 'dev/js/tools/diff-json.js';

/** spec 的 `type` → 骨架标签：比 §W 多一枚 `file`（选本地文件那一格），词汇表外当场抛 */
const Z_TAGS = { text: 'input', area: 'textarea', select: 'select', checkbox: 'input', file: 'input' };
const zTag = (type) => {
  const tag = Z_TAGS[type];
  if (!tag) throw new Error(`夹具：DIFF_SPEC 里出现了词汇表外的 type「${String(type)}」（认得 ${Object.keys(Z_TAGS).join(' / ')}）`);
  return tag;
};
/** 节点族 → id：本层只认这三族，第四族（`tree`）在这一页没有对应的事实 */
const zFamId = (prefix, fam, side) => {
  if (fam === 'out') return zOut(prefix, Z_PANEL, side);
  if (fam === 'status') return zStatus(prefix, Z_PANEL, side);
  if (fam === 'copy') return zCopy(prefix, Z_PANEL, side);
  throw new Error(`夹具：${side} 栏声明了节点族「${String(fam)}」，而这一页只有 out / status / copy 三族`);
};
/** 整格字面量那把尺与 §W 共用一本（`mark` 换成本页前缀） */
const zHandIds = (rel, mark = `${Z_P}-`) => wHandTypedIds(rel, mark);

/**
 * 造一页对比骨架：提示行 + 容器 + 按 `DIFF_SPEC` 三栏长出的控件、显隐段、节点族，
 * 再按 `DIFF_ACTIONS` 长出十四枚按钮。
 *
 * 为什么是**第三本**假 DOM（§I 的证件页那份、§W 的 JSON 那份之外）：`wPage` 吃的是 `JSON_SPEC` /
 * `JSON_PANEL_IDS` 这两个全局名，它按 `sides.main` 一栏长；这一页的 spec 是三栏（a / b / bar）、
 * 控件 id 里编了栏位、节点族由每栏自己声明，还要多两样本节独有的观察口（`files` 与 `el.click()` 的
 * 落点日志）。把 `wPage` 改成能服务两页等于给 §W 那二十七判换地基——既有先例是 §R 与 §W 各留一份。
 * @param {object} o 选项
 * @param {string} [o.prefix] 前缀（Z28 的 `zx` 那一档量的就是它）
 * @param {Record<string, string|boolean>} [o.seed] `'控件 id → 初值'`
 * @param {string[]} [o.drop] **不**要长的 id，造"骨架与 spec 漂移"那一类缺陷
 * @returns {object} 节点表 + 观察口
 */
function zPage({ prefix = Z_P, seed = {}, drop = [] } = {}) {
  const nodes = new Map();
  const created = { list: [] };
  const clicked = [];
  const mk = (tag, id = '', attrs = {}) => {
    const el = {
      nodeType: 1, tagName: String(tag).toUpperCase(), id, hidden: false, disabled: false,
      value: '', checked: false, innerHTML: '', files: undefined, scrollTop: 0, style: {},
      attrs: new Map(), childNodes: [], listeners: new Map(), parentNode: null,
      get textContent() { return this.childNodes.map((c) => c.textContent).join(''); },
      set textContent(v) { this.childNodes = v === '' ? [] : [{ nodeType: 3, tagName: '#text', textContent: String(v) }]; },
      getAttribute(n) { return this.attrs.has(n) ? this.attrs.get(n) : null; },
      setAttribute(n, v) { this.attrs.set(n, String(v)); },
      removeAttribute(n) { this.attrs.delete(n); },
      appendChild(c) { this.childNodes.push(c); c.parentNode = this; return c; },
      removeChild(c) {
        const at = this.childNodes.indexOf(c);
        if (at < 0) throw new Error('removeChild：这个节点不在里面');
        this.childNodes.splice(at, 1);
        c.parentNode = null;
        return c;
      },
      addEventListener(t, fn) {
        if (!this.listeners.has(t)) this.listeners.set(t, []);
        this.listeners.get(t).push(fn);
      },
      dispatch(t, evt = {}) {
        for (const fn of this.listeners.get(t) || []) fn(evt);
        return evt;
      },
      // 真 DOM 的 `el.click()` 会派发一次真的 click：`fileA` / `fileB` 两枚按钮靠它打开选择器，
      // 而**这一发要留痕**——判据问的是"装配层自己按了哪一枚"，派发过程本身不算答案。
      click() { clicked.push(this.id); return this.dispatch('click', {}); },
    };
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'hidden') el.hidden = v; else el.setAttribute(k, v);
    }
    if (id !== '') nodes.set(id, el);
    return el;
  };
  const doc = {
    getElementById: (id) => (nodes.has(id) ? nodes.get(id) : null),
    createElement: (tag) => { const el = mk(tag); created.list.push(el); return el; },
    body: mk('body'),
  };
  const gone = new Set(drop);
  const want = (id) => (gone.has(id) ? null : mk('div', id));

  want(`${prefix}-notice`);
  const box = want(`${prefix}-workspace`);
  if (box) {
    box.setAttribute(`data-${prefix}-ids`, Z_PANEL_IDS.join(','));
    box.setAttribute(`data-${prefix}-prefix`, prefix);
    box.setAttribute(`data-${prefix}-label`, '文件对比');
    box.setAttribute(`data-${prefix}-notice`, `${prefix}-notice`);
  }
  for (const [side, cfg] of Object.entries(Z_SPEC[Z_PANEL].sides)) {
    for (const c of cfg.controls) {
      const id = zField(prefix, Z_PANEL, c.id);
      if (gone.has(id)) continue;
      const el = mk(zTag(c.type), id);
      if (c.type === 'select') {
        for (const opt of c.options ?? []) {
          const o = mk('option');
          o.setAttribute('value', opt);
          o.textContent = opt;
          el.appendChild(o);
        }
      }
      if (seed[c.id] !== undefined) {
        if (c.type === 'checkbox' || c.type === 'file') el.checked = seed[c.id] === true;
        else el.value = String(seed[c.id]);
      }
      if (c.type === 'file') el.setAttribute('accept', '.txt,.md,.json');
    }
    for (const tg of cfg.switch?.targets ?? []) {
      const id = zWhen(prefix, Z_PANEL, tg.key);
      if (gone.has(id)) continue;
      const p = mk('p', id);
      p.setAttribute(`data-${prefix}-when`, tg.when.join(' '));
    }
    for (const fam of cfg.nodes ?? []) {
      const id = zFamId(prefix, fam, side);
      if (gone.has(id)) continue;
      if (fam === 'copy') {
        const b = mk('button', id);
        b.textContent = `复制 ${side} 侧`;
      } else if (fam === 'out') mk('div', id);
      else mk('p', id);
    }
  }
  for (const a of Z_ACTIONS) {
    const id = zButton(prefix, Z_PANEL, a.key);
    if (gone.has(id)) continue;
    mk('button', id).textContent = a.label;
  }

  const ctl = (id) => doc.getElementById(zField(prefix, Z_PANEL, id));
  const at = (id) => doc.getElementById(id);
  return {
    doc, nodes, mk, box, created, clicked,
    ctl,
    set: (id, v) => { ctl(id).value = String(v); },
    check: (id, v) => { ctl(id).checked = !!v; },
    val: (id) => (ctl(id) ? ctl(id).value : null),
    input: (id) => ctl(id).dispatch('input', {}),
    change: (id) => ctl(id).dispatch('change', {}),
    click: (key) => { const el = at(zButton(prefix, Z_PANEL, key)); return el.dispatch('click', {}); },
    clickCopy: (side) => at(zCopy(prefix, Z_PANEL, side)).dispatch('click', {}),
    area: (side) => ctl(`${side}-text`).value,
    name: (side) => ctl(`${side}-name`).value,
    out: () => { const el = at(zOut(prefix, Z_PANEL, Z_BAR)); return el ? String(el.innerHTML) : ''; },
    /** 结果区那一格到底有没有被写过（空串与"没这一格"是两件事，Z26 判的就是这个区别） */
    outWritten: () => (at(zOut(prefix, Z_PANEL, Z_BAR)) ? at(zOut(prefix, Z_PANEL, Z_BAR)).innerHTML !== '' : null),
    scrollTop: () => { const el = at(zOut(prefix, Z_PANEL, Z_BAR)); return el ? el.scrollTop : null; },
    line: () => { const el = at(zStatus(prefix, Z_PANEL, Z_BAR)); return el ? el.textContent : null; },
    read: (side) => { const el = at(zStatus(prefix, Z_PANEL, side)); return el ? el.textContent : null; },
    hidden: (key) => { const el = at(zWhen(prefix, Z_PANEL, key)); return el ? el.hidden === true : null; },
    disabled: (id) => (at(id) ? at(id).disabled === true : null),
    btnDisabled: (key) => at(zButton(prefix, Z_PANEL, key)).disabled === true,
    label: (id) => (at(id) ? at(id).textContent : null),
    /** 选文件：先给假 `files`，再派发 `change`（§W 那份夹具的 `files` 永远是 undefined，量不到这一路） */
    pickFile: (side, file) => { const el = ctl(`${side}-file`); el.files = file ? [file] : []; return el.dispatch('change', {}); },
    /** 拖放落点：每一侧的粘贴框自己 */
    drop: (side, files) => ctl(`${side}-text`).dispatch('drop', { dataTransfer: { files }, preventDefault: () => {} }),
    /**
     * 点结果区里的一条折叠条。真浏览器里 `evt.target` 就是那枚 `<button class="df-fold">`，
     * 而假 DOM 的 `innerHTML` 只是个串、里面根本不长节点，所以这一发自己造一枚带那格属性的按钮再派发
     * ——它量的仍是"装配层在那一发里做了什么"。`attr` 允许外部指定属性名（Z29 用它试"换了前缀
     * 还认不认得旧地址"那一刀）。
     */
    clickFold: (skip = 7, attr) => {
      const box = at(zOut(prefix, Z_PANEL, Z_BAR));
      if (!box) return null;
      return box.dispatch('click', { target: mk('button', '', { [attr || `data-${prefix}-skip`]: String(skip) }) });
    },
    /** 点结果区里一处**不是**折叠条的落点：行块只带 `data-{prefix}-ln`，点它不许动档 */
    clickRow: (ln = 3) => {
      const box = at(zOut(prefix, Z_PANEL, Z_BAR));
      if (!box) return null;
      return box.dispatch('click', { target: mk('div', '', { [`${`data-${prefix}-ln`}`]: String(ln) }) });
    },
    madeOf: (tag) => created.list.filter((el) => el.tagName === String(tag).toUpperCase()),
  };
}

/**
 * 接一页：`zPage` 长骨架，`createDiffWorkbench` 接装配层，注入的 `runGuarded` 既数调用也记"这一格抛了"。
 *
 * 与 `wMount` 的差别只有两处，且都是本页的形状：**不注入 `storage` 也不注入 `now`**（红线里那句
 * "这一页不做记住上次输入"，夹具给了就是替实现撒谎），**多两只文件读手**（`readFile` / `decode`）。
 * @param {object} o 选项
 * @param {string} [o.prefix] 前缀
 * @param {Record<string, string|boolean>} [o.seed] 控件初值
 * @param {string[]} [o.drop] 骨架要缺的 id
 * @param {number} [o.rowHeight] 注入行高，缺席就是实现自己的退路值
 * @param {object|null} [o.dl] 下载三件的替身，`null` 代表不注入（下载按钮该置灰）
 * @param {object|null} [o.clipboard] 假剪贴板，`null` 代表没有这只手
 * @param {Function|null} [o.readFile] 读文件替身，`null` 代表不注入（选文件该置灰）
 * @param {Function|null} [o.decode] 解码替身，`null` 代表不注入
 * @returns {object} `{ page, wb, report, guarded, threw, timers, reads, copied, flush }`
 */
function zMount(o = {}) {
  const prefix = o.prefix || Z_P;
  const page = zPage({ prefix, seed: o.seed || {}, drop: o.drop || [] });
  const guarded = [];
  const threw = [];
  const timers = [];
  const reads = [];
  const copied = [];
  const dl = o.dl === undefined ? wDownload() : o.dl;
  const wb = zCreateWb({
    document: page.doc,
    Tk: { view: W_VIEW, ui: J_UI },
    prefix,
    runGuarded: (id, fn) => {
      guarded.push(id);
      try { fn(page.doc.getElementById(id)); return true; } catch (err) {
        threw.push([id, err && err.message]); return false;
      }
    },
    later: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    navigator: { clipboard: o.clipboard === null ? undefined : (o.clipboard || { writeText: (t) => { copied.push(String(t)); return Promise.resolve(); } }) },
    ...(o.rowHeight === undefined ? {} : { rowHeight: o.rowHeight }),
    ...(dl === null ? {} : { BlobCtor: dl.BlobCtor, createObjectURL: dl.createObjectURL, revokeObjectURL: dl.revokeObjectURL }),
    ...(o.readFile === null ? {} : { readFile: o.readFile || ((f) => { reads.push(f.name); return Promise.resolve(f.__bytes); }) }),
    ...(o.decode === null ? {} : { decode: o.decode || ((b) => ({ ok: true, text: new TextDecoder('utf-8').decode(b) })) }),
  });
  const report = wb.mount();
  return {
    page, wb, report, guarded, threw, timers, reads, copied, dl,
    flush: () => { const list = timers.splice(0); for (const t of list) t.fn(); },
  };
}

/** 一个本地文件替身：`size` 给闸门看（拒收在**读之前**），`__bytes` 给注入的 `readFile` 交回 */
const zFile = (name, text, over) => {
  const bytes = new TextEncoder().encode(text);
  return { name, size: over === undefined ? bytes.length : over, __bytes: bytes };
};
/** 排空微任务：文件那一路是 Promise，而 `later` 被夹具换成"只记账不执行"（同 §J 的 `jSettle`） */
const zSettle = () => new Promise((r) => { setTimeout(r, 0); });

/** 一份能折叠出两块的输入：40 行，头行与第 31 行各改一处 */
const Z_A40 = Array.from({ length: 40 }, (_, i) => `L${i}`).join('\n');
const Z_B40 = Z_A40.replace('L0', 'X0').replace('L30', 'Y30');

test('Z13 import 边闭合：装配层只 reach 那三本，反向核数"谁 reach 这一本"', () => {
  assert.deepEqual(wImports(Z_ASSEMBLY).slice().sort(), ['./diff-core.js', './diff-json.js', './diffView.js'].sort(),
    '三本之外多一本 = 第二条跨模块的边；少一本 = 有一件事在本层自己重算了一遍（§0.4 那条构建红线的第二十八种写法）');
  assert.deepEqual(wImports(Z_ENTRY), ['./tools/diffWorkbench.js'],
    '入口只许 reach 装配层一本：视图层与两本算法由它带进来，入口再指一次就是两个入口 reach 同一模块 → 共享 chunk → 产物里 `import{` → 整页 SyntaxError 而构建退 0');
  assert.deepEqual(wImports(Z_CORE_REL), [], `${Z_CORE_REL} 是纯算法，import 边一多 §X 的夹具就要替它造环境`);
  assert.deepEqual(wImports(Z_JSON_REL), ['./diff-core.js'],
    '那一本只借闸门与两个上限；把 json-core.js 接过来就是 §0.4 那条买断没谈妥（重复的是读侧，不是闸门）');
  const reachersOf = (name) => wAllSources().filter((rel) => wImports(rel).some((p) => p.endsWith(`/${name}`)));
  assert.deepEqual(reachersOf('diffView.js'), [Z_ASSEMBLY], '视图层被第二个入口 reach = 共享 chunk');
  assert.deepEqual(reachersOf('diff-json.js'), [Z_ASSEMBLY], 'JSON 档的算法多了一个消费者：装配层就不再是唯一口径');
  assert.deepEqual(reachersOf('diff-core.js').slice().sort(), [Z_ASSEMBLY, Z_JSON_REL].sort(),
    '行级引擎的两本消费者就是这一对；第三本进来时 §X 的那二十九判要重算，而门禁不会替你说这句话');
  assert.deepEqual(reachersOf('diffWorkbench.js'), [Z_ENTRY], '装配层只有本入口一个消费者');
});

test('Z14 装配层零环境词：词表比 §W10 多两枚，而 innerHTML 那一处出口仍然只有一处', () => {
  const bare = wBare(Z_ASSEMBLY);
  for (const word of ['window', 'globalThis', 'Date.now(', 'localStorage', 'navigator.', 'new Blob',
    'URL.', 'getComputedStyle', 'querySelector', 'setTimeout(', 'FileReader', 'IntersectionObserver',
    'requestAnimationFrame', 'fetch(', 'alert(', 'instanceof']) {
    assert.equal(bare.includes(word), false,
      `装配层不许碰 ${word}：那一样由入口递进来，本层碰一次就多一处"两台机器给两个答案"（红线 2）。`);
  }
  // `instanceof` 是 `File` 那一枚的替身：裸词 `File` 在本层是合法名字（`fileName` / `readFile` 都归它），
  // 而这一格真正要钉的是"宿主类型判断不在本层"——那一档判断在入口的 `win.File` 上，Z15 数它恰好一处。
  assert.equal(wCount(bare, 'innerHTML'), 1, '整页只许一处 innerHTML（与 §W10 同一条口径）：第二处就是第二个"把串当标记"的出口');
  assert.equal(wCount(bare, 'createElement'), 1, '只有下载那一枚 `<a>` 需要造节点；再多一处就是第二条往 DOM 里塞东西的路');
  assert.equal(bare.includes('diff-core.js'), false, 'import 路径在 wBare 之后应当消失；还在说明有第二处动态取模块的写法');
});

test('Z15 入口那八件各恰好一处，而 localStorage 与 Date.now( 两本一起归零', () => {
  const src = wCode(Z_ENTRY);
  const counts = [
    ['win.FileReader(', 1, '选文件那一路的唯一一只读手'],
    ['win.TextDecoder', 1, 'UTF-8 那一档的唯一一处判编码（fatal 在入口，装配层只收 {ok,text}）'],
    ['win.Blob', 1, '下载三件的第一格：本层按工厂调用，不带 new'],
    ['URL.createObjectURL', 1, '第二格'],
    ['URL.revokeObjectURL', 1, '第三格（落在 finally，被拦下载也不泄）'],
    ['win.navigator', 1, '只取 clipboard'],
    ['setTimeout(', 1, '闸门读数的防抖'],
    ['getComputedStyle', 1, '行高：样式给的环境量，读一次就注入一次'],
  ];
  for (const [word, want, why] of counts) {
    assert.equal(wCount(src, word), want, `${word} 在入口里该恰好 ${want} 次（${why}），实测 ${wCount(src, word)} 次`);
  }
  // 计数口径：`win.FileReader` 里含着整格 `win.File`，不先剥掉它就会把同一只手数成两枚——
  // 而判据说的是"类型判断恰好一处"，那才是 `instanceof win.File` 那一格。
  const noReader = src.replace(/win\.FileReader/g, '');
  assert.equal(wCount(noReader, 'win.File'), 1, 'File 的类型判断该恰好一处（剥掉 FileReader 那一只之后数）');
  for (const rel of [Z_ENTRY, Z_ASSEMBLY]) {
    assert.equal(wBare(rel).includes('localStorage'), false, `${rel}：这一页不做"记住上次输入"，那句"输入不出本机"不需要任何退路可写`);
    assert.equal(wBare(rel).includes('Date.now('), false, `${rel}：没有要记的时间戳，时钟因此连入口都不该出现`);
  }
  assert.deepEqual(modNames(Z_ENTRY), [], '入口不许有顶层 export：iifeWrapPlugin 不补 use strict，留一条 export 就是整页语法错误');
  assert.equal(/\bDOMContentLoaded\b/.test(src), false, '脚本排在正文之后，接 DOMContentLoaded 就是第二个启动时机');
});

test('Z16 id 与类名只由 spec、actions 与 prefix 派生：装配层 0 处手打，入口那三行地址反过来必须是字面量', () => {
  assert.equal(wCount(wCode(Z_ASSEMBLY), `${Z_P}-`), 0,
    '装配层里一处手打前缀，Z28 的换前缀自证就绿得没有牙（§W10 同一条口径）');
  assert.deepEqual(zHandIds(Z_ASSEMBLY), [], '整格字面量口径：以 df- 起头的串在本文件一处都不该有');
  assert.deepEqual(zHandIds(Z_ASSEMBLY, 'zx-'), [], '换档之后也不该有——手打的地方只会跟着"当前那一页"漂');
  const ids = zControlIds(Z_P);
  const flat = Object.values(ids).reduce((acc, list) => acc.concat(list), []);
  assert.equal(new Set(flat).size, flat.length, `controlIds 里有重复 id：${flat.filter((x, i) => flat.indexOf(x) !== i).join(' ')}`);
  for (const [side, cfg] of Object.entries(Z_SPEC[Z_PANEL].sides)) {
    for (const c of cfg.controls) assert.equal(flat.includes(zField(Z_P, Z_PANEL, c.id)), true, `${side} 栏的控件 ${c.id} 没进清单`);
    for (const fam of cfg.nodes ?? []) assert.equal(flat.includes(zFamId(Z_P, fam, side)), true, `${side} 栏的节点族 ${fam} 没进清单`);
    for (const tg of cfg.switch?.targets ?? []) assert.equal(flat.includes(zWhen(Z_P, Z_PANEL, tg.key)), true, `显隐段 ${tg.key} 没进清单`);
  }
  assert.equal(flat.length, new Set(flat).size, '清单总长要等于去重后的总长（上面那两条一起说同一件事的两面）');
  const page = zPage();
  const report = zMount().report;
  assert.deepEqual(report.missing, [], '骨架齐的时候不该报缺；报了就是 spec 与夹具两本漂了');
  for (const id of flat) assert.equal(page.nodes.has(id), true, `${id} 在 controlIds 里，骨架却没长：门禁⑤ 会在产物上红，这里先红`);
  const stray = [...page.nodes.keys()].filter((id) => new RegExp(`^${Z_P}-(?:in|when|btn|out|status|copy)-`).test(id) && !flat.includes(id));
  assert.deepEqual(stray, [], `骨架私自多长了这些格（装配层永远不会去读它）：${stray.join(' ')}`);
  // 入口那三行是**这一页在 HTML 里的地址**：门禁⑤ 组 5 用正则找它们，所以它们必须是字面量，
  // 而且必须写成能被那串正则找到的形状（照 toolJson.js 的同源格式）。
  const src = wCode(Z_ENTRY);
  assert.equal(/^const CONTAINER_ID = 'df-workspace';$/m.test(src), true, '容器 id 那一行是页面骨架的地址，跟着前缀派生就找不到容器了');
  assert.equal(/^const NOTICE_ID = 'df-notice';$/m.test(src), true);
  assert.equal(/^const ATTR = \{ ids: 'data-df-ids', prefix: 'data-df-prefix', label: 'data-df-label', notice: 'data-df-notice' \};$/m.test(src), true,
    '那四格属性名要与门禁⑤ 的 ATTR 正则逐字符一致');
});

test('Z17 对外面十一格、三栏的 nodes 声明与十四枚动作的三份名单', () => {
  assert.deepEqual(Z_PANEL_IDS, ['workbench'], '这一页没有面板清单：门禁⑤ 拿它比 DIFF_SPEC 的键');
  assert.deepEqual(Object.keys(Z_SPEC), Z_PANEL_IDS);
  assert.deepEqual(Z_SIDE_NAMES, ['a', 'b', Z_BAR], '两栏输入 + 一条控制栏；第三栏（对齐视图）在这一页没有对应的事实');
  assert.deepEqual(Object.keys(Z_SPEC[Z_PANEL].sides), Z_SIDE_NAMES);
  for (const [side, cfg] of Object.entries(Z_SPEC[Z_PANEL].sides)) {
    assert.deepEqual(cfg.nodes ?? ['没有声明'], ['out', 'status', 'tree', 'copy'].filter((f) => (cfg.nodes || ['out', 'status', 'tree', 'copy']).includes(f)),
      `${side} 栏的节点族必须自己声明（收录面那颗牙按这一格拆）`);
    assert.deepEqual(cfg.nodes, [...new Set(cfg.nodes)], `${side} 栏的节点族里有重复`);
    for (const c of cfg.controls) {
      assert.equal(Object.keys(Z_TAGS).includes(c.type), true, `${side}/${c.id} 的 type ${c.type} 在词汇表外`);
      if (side === 'a' || side === 'b') {
        assert.equal(c.id.startsWith(`${side}-`), true,
          `${c.id} 没把栏位编进 id：门禁⑤ 的控件 id 公式是 {p}-in-{面板}-{控件}，没有栏位这一维（§0.6 记的偏差）`);
      }
      if (c.type === 'select') assert.ok(Array.isArray(c.options) && c.options.length > 0, `${c.id} 是下拉却没有取值白名单`);
      if (c.gutter !== undefined) assert.equal(c.gutter, false, 'gutter 只有"关掉"这一档：这一页的 area 不带行号槽');
    }
  }
  assert.deepEqual(Z_SPEC[Z_PANEL].sides[Z_BAR].switch.by, 'mode');
  assert.deepEqual(Z_SPEC[Z_PANEL].sides[Z_BAR].switch.targets.map((t) => t.key), ['text', 'json']);
  for (const tg of Z_SPEC[Z_PANEL].sides[Z_BAR].switch.targets) {
    assert.deepEqual(tg.when, [...new Set(tg.when)].filter((w) => Z_SPEC[Z_PANEL].sides[Z_BAR].controls.find((c) => c.id === 'mode').options.includes(w)),
      `显隐段 ${tg.key} 的档位里有 mode 认不得的词（静默永远隐藏）`);
  }
  assert.equal(Z_ACTIONS.length, 14, 'yml 的 actions 与 tools.html 的徽章数的是这一个数');
  assert.deepEqual([...new Set(Z_ACTIONS.map((a) => a.key))].length, 14, '动作 key 重复 = 同一枚按钮接两根线');
  for (const a of Z_ACTIONS) {
    assert.equal(typeof a.label, 'string');
    assert.ok(a.label.trim().length > 0, `${a.key} 的 label 是空的：门禁⑤ 比的是按钮文案与这一格同字`);
    assert.ok(['run', 'fold', 'goto', 'file', 'copy'].includes(a.group), `${a.key} 的 group ${a.group} 不在那五族里`);
  }
  assert.deepEqual(Z_ACTIONS.filter((a) => a.group === 'fold').map((a) => a.key), ['expand', 'fold', 'diffOnly'],
    '三枚快捷键都写回同一枚 context 下拉（单一口径），族名就是这件事的登记处');
  assert.deepEqual(Z_ACTIONS.filter((a) => a.group === 'goto').map((a) => a.key), ['firstDiff', 'prevDiff', 'nextDiff']);
  assert.deepEqual(Z_ACTIONS.filter((a) => a.group === 'file').map((a) => a.key), ['fileA', 'fileB']);
  const v = zCreateWb({ Tk: { view: W_VIEW }, prefix: Z_P });
  assert.deepEqual(Object.keys(v.view).sort(), ['renderFoldBar', 'renderInline', 'renderJsonTable', 'renderNotice', 'renderSide', 'renderStats', 'renderVerdict'],
    '装配层用的还是 Z2 那七件：多一件就是第二条渲染路径，少一件是有一格没人画');
  assert.deepEqual(Object.keys(v).sort(), ['mount', 'state', 'view'],
    '对外只这三格：`mount` 接线、`state` 是给本节的观察口、`view` 是那七件生成器——多一格就是第二条能从页面上叫到的路');
  assert.equal(typeof v.state().computes, 'number', '没有这两个计数器，"挂载期不计算"这件事在页面上根本读不出来');
});

// 装配层那六条红线各自的落点：Z18 挂载与输入、Z19 一次画全与导出同字、Z20 布局两档共一行流、
// Z21 折叠四档与三枚快捷键、Z22 跳转的块换算、Z23 整理三枚、Z24 归一化的同现同灭、Z25 JSON 档那一表、
// Z26 两类失败分两条路、Z27 文件三件、Z28 换前缀自证。
test('Z18 挂载与输入两条路都不算一次比对：读数只随防抖落地那一次', () => {
  const m = zMount();
  assert.equal(m.page.out().includes(`${Z_P}-row`), false, '挂载就把结果区画成行块 = 挂载期算了一遍（红线 4）');
  assert.deepEqual(m.guarded, [], '挂载期一次 runGuarded 都不该有：接线不是操作');
  assert.equal(m.wb.state().computes, 0, 'computes 是「挂载期不计算」唯一的量具：页面读不出这件事，判据读得出');
  assert.equal(m.wb.state().gateReads, 1, '挂载刷一次闸门读数：那一行「N 行 · KB」是这一页第一眼要给的东西');
  assert.match(String(m.page.read('a')), /0 行/);
  assert.match(String(m.page.read('b')), /0 行/);
  assert.equal(m.timers.length, 0, '挂载不排防抖：那一发延时是留给输入的');
  for (let k = 0; k < 20; k += 1) {
    m.page.set('a-text', `line-${k}`);
    m.page.input('a-text');
  }
  assert.equal(m.guarded.length, 0, 'input 那一发只排防抖、不进边界：进了就是二十次操作，而页面上什么也没算');
  assert.equal(m.wb.state().computes, 0, '二十次输入一次比对都不该有：比对只在按那一枚按钮时发生');
  assert.equal(m.page.out().includes(`${Z_P}-row`), false);
  m.flush();
  assert.equal(m.wb.state().gateReads, 2, '二十发延时只有最后那一发真的读数（防抖的牙就长在这两格里）');
});

test('Z19 一次对比画全：结论、读数、两栏行块、代价说明，而复制与下载读的是同一份 out', async () => {
  const m = zMount({ seed: { 'a-text': 'alpha\nbeta\ngamma', 'b-text': 'alpha\nBETA\ngamma', 'a-name': 'left.txt', 'b-name': 'right.txt' } });
  assert.equal(m.page.btnDisabled('copyDiff'), true, '还没有结果时那两枚该是灰的：按下去说一句「还没有」，不如让它按不动');
  assert.equal(m.page.btnDisabled('download'), true);
  m.page.click('compare');
  const out = m.page.out();
  assert.equal(m.wb.state().computes, 1);
  for (const cls of [`${Z_P}-verdict`, `${Z_P}-stats`, `${Z_P}-row `, `${Z_P}-col--a`, `${Z_P}-col--b`, `${Z_P}-notes`]) {
    assert.ok(out.includes(cls), `结果区少了 ${cls.trim()}：${out.slice(0, 120)}…`);
  }
  assert.equal(m.page.btnDisabled('copyDiff'), false, '比完了还灰着，就是「这一页没有导出」');
  const st = m.wb.state();
  assert.match(st.out, /^--- left\.txt\n\+\+\+ right\.txt\n@@ -1,3 \+1,3 @@\n/);
  m.page.click('copyDiff');
  await zSettle();
  assert.deepEqual(m.copied, [st.out], '复制的是那一份 unified 文本，不是第二次拼串：两处口径迟早会漂');
  m.page.click('download');
  assert.equal(m.dl.blobs.length, 1);
  assert.equal(m.dl.blobs[0].parts[0], st.out, '下载那一份与复制那一份必须逐字符同字');
  assert.equal(m.dl.blobs[0].options.type, 'text/plain;charset=utf-8');
  assert.equal(m.page.madeOf('a').length, 1, '整页只造那一枚 <a>：多一枚就是第二条往 DOM 里塞东西的路');
  assert.equal(m.page.madeOf('a')[0].download, 'changes.diff');
  assert.equal(m.dl.urls.made.length, 1);
  assert.equal(m.dl.urls.revoked.length, 1, '对象 URL 要在 finally 里收回：被拦住的下载不该往内存里挂一条永久 URL');
  m.page.clickCopy('a');
  await zSettle();
  assert.equal(m.copied[1], 'alpha\nbeta\ngamma', '栏内复制读的是那一侧的输入，不是结果区那一份');
  assert.equal(m.wb.state().computes, 1, '复制与下载都不重算：它们只读已经算完的那一格');
});

test('Z20 布局两档读同一份行流：并排两栏各一份，行内把 change 摊成两行', () => {
  const m = zMount({ seed: { 'a-text': Z_A40, 'b-text': Z_B40 } });
  const hunks = dHunks(dLines(Z_A40, Z_B40, {}), 3);
  const rowsTotal = hunks.reduce((acc, h) => acc + h.rows.length, 0);
  const changes = hunks.reduce((acc, h) => acc + h.rows.filter((r) => r.kind === 'change').length, 0);
  assert.ok(hunks.length >= 1 && changes >= 1, '夹具自己先要成立：这份输入得有可拆的 change 行');
  m.page.click('compare');
  const side = m.page.out();
  assert.equal(wCount(side, `${Z_P}-row `), rowsTotal * 2, '并排档两栏各读同一份行流：行数必须正好翻倍');
  assert.equal(wCount(side, `${Z_P}-col--a`), hunks.length);
  assert.equal(wCount(side, `${Z_P}-col--b`), hunks.length);
  assert.equal(wCount(side, `${Z_P}-lines`), 0);
  m.page.set('layout', 'inline');
  m.page.change('layout');
  const inline = m.page.out();
  assert.equal(m.wb.state().computes, 1, '切布局不重算：它换的是看法，不是算法');
  assert.equal(wCount(inline, `${Z_P}-cols`), 0, '行内档不许还留着两栏那个壳');
  assert.equal(wCount(inline, `${Z_P}-lines`), hunks.length);
  assert.equal(wCount(inline, `${Z_P}-row `), rowsTotal + changes, '行内档把每个 change 摊成两行：A 那半读被删的高亮，B 那半读新增的高亮');
  assert.equal(wCount(inline, `${Z_P}-row--change`), changes * 2, '摊出来的两行都还是 change 档：着色由半边的片段决定，不由行档决定');
  m.page.set('layout', 'side');
  m.page.change('layout');
  assert.equal(m.page.out(), side, '切回来要逐字符同一份：两档共用行流，不是各拼一遍');
});

test('Z21 折叠四档真的改行集，三枚快捷键写回同一枚下拉', () => {
  const CTX = { diff: 0, 3: 3, 5: 5, all: Infinity };
  const m = zMount({ seed: { 'a-text': Z_A40, 'b-text': Z_B40 } });
  m.page.click('compare');
  const expect = (sel) => {
    const list = dHunks(dLines(Z_A40, Z_B40, {}), CTX[sel]);
    const last = list[list.length - 1] || { tailSkipped: 0 };
    return {
      rows: list.reduce((acc, h) => acc + h.rows.length, 0),
      bars: list.filter((h) => h.skipped > 0).length + (last.tailSkipped > 0 ? 1 : 0),
    };
  };
  const check = (key, sel) => {
    m.page.click(key);
    assert.equal(m.page.val('context'), sel, `${key} 没写回那枚下拉：状态就有两份口径了（红线 6）`);
    const want = expect(sel);
    const out = m.page.out();
    assert.equal(wCount(out, `${Z_P}-row `), want.rows * 2, `${sel} 档的行集不对`);
    assert.equal(wCount(out, `${Z_P}-fold--`), want.bars, `${sel} 档的折叠条数不对（期望 ${want.bars}）`);
    assert.equal(m.wb.state().computes, 1, '换折叠档只换视图：行级那份 result 与折叠无关');
  };
  check('fold', '3');
  assert.ok(expect('3').rows < 40, '夹具先要成立：默认档必须真的把中间那段收起来');
  check('diffOnly', 'diff');
  assert.ok(expect('diff').rows < expect('3').rows, '只看差异要比上下文三行更窄，否则这一档没有意义');
  assert.ok(expect('diff').bars > 0, '只看差异那一档总要留下折叠条：两份四十行中间隔着三十来行呢');
  check('expand', 'all');
  assert.equal(expect('all').bars, 0, '全部展开之后不该有一条折叠条');
  assert.equal(expect('all').rows, 40, '展开之后那四十行要一行不少');
  const before = m.page.out();
  m.page.set('context', '9');
  m.page.change('context');
  assert.equal(m.threw.length, 1, 'spec 之外的档位是漂移，不是用户写坏的格子：要原样上抛给边界');
  assert.match(String(m.threw[0][1]), /只认/);
  assert.equal(m.page.out(), before, '抛出去之前不许画：上一格的结果不能因为档位漂了就整块不见');
});

test('Z22 跳转三枚：scrollTop 按块换算、两端钳住、状态行报第几处', () => {
  const m = zMount({ rowHeight: 40, seed: { 'a-text': Z_A40, 'b-text': Z_B40 } });
  const list = dHunks(dLines(Z_A40, Z_B40, {}), 3);
  assert.equal(list.length, 2, `夹具先要成立：这份输入要折叠出两块，实测 ${list.length}`);
  m.page.click('compare');
  assert.equal(m.page.scrollTop(), 0);
  const u1 = list[0].skipped > 0 ? 1 : 0;
  m.page.click('nextDiff');
  assert.equal(m.page.scrollTop(), u1 * 40);
  assert.equal(m.page.line(), `第 1 / ${list.length} 处差异`);
  const u2 = list[0].rows.length + (list[0].skipped > 0 ? 1 : 0) + (list[1].skipped > 0 ? 1 : 0);
  assert.ok(u2 > u1, '第二块要在第一块之下，否则这一判量不到「换算」这件事');
  m.page.click('nextDiff');
  assert.equal(m.page.scrollTop(), u2 * 40, '那一块的顶上：前面所有块占的视觉行，加上它自己那条折叠条');
  assert.equal(m.page.line(), `第 2 / ${list.length} 处差异`);
  m.page.click('nextDiff');
  assert.equal(m.page.scrollTop(), u2 * 40, '最后一块之后再按不许滚出页尾：钳位就是这一格的意思');
  m.page.click('prevDiff');
  assert.equal(m.page.scrollTop(), u1 * 40);
  m.page.click('prevDiff');
  m.page.click('prevDiff');
  assert.equal(m.page.line(), '第 1 / 2 处差异', '第一块之前同样钳住');
  m.page.click('firstDiff');
  assert.equal(m.page.line(), '第 1 / 2 处差异');
  const same = zMount({ seed: { 'a-text': 'one\ntwo', 'b-text': 'one\ntwo' } });
  same.page.click('compare');
  same.page.click('nextDiff');
  assert.equal(same.threw.length, 0, '没有差异块是用户那一档事实，不是骨架漂移');
  assert.equal(same.guarded.length, 2, '一次比对 + 一次跳转：都过了边界，都没有抛');
  assert.match(String(same.page.line()), /没有差异块/);
});

test('Z23 整理三枚：交换连文件名一起换、恢复默认档不碰输入、清空回空态并置灰', () => {
  const m = zMount({ seed: { 'a-text': 'one\ntwo', 'b-text': 'one\nTWO', 'a-name': 'left.txt', 'b-name': 'right.txt' } });
  m.page.click('swap');
  assert.equal(m.page.area('a'), 'one\nTWO', '交换只换正文不换文件名，导出的那一份头就指错了边');
  assert.equal(m.page.area('b'), 'one\ntwo');
  assert.equal(m.page.name('a'), 'right.txt');
  assert.equal(m.page.name('b'), 'left.txt');
  assert.match(m.wb.state().out, /^--- right\.txt\n\+\+\+ left\.txt/);
  assert.equal(m.wb.state().computes, 1, '交换自带一次对比：用户按的是「换个方向看」，不是「换个方向空着」');
  m.page.set('context', '5');
  m.page.change('context');
  m.page.check('ws', true);
  m.page.change('ws');
  m.page.click('reset');
  assert.equal(m.page.val('context'), '3', '恢复默认档管的是三枚下拉与两枚勾选');
  assert.equal(m.page.ctl('ws').checked, false);
  assert.equal(m.page.area('a'), 'one\nTWO', '这一枚不该把输入也清了：那是「清空输入」的活儿');
  assert.equal(m.wb.state().mode, 'text');
  m.page.click('clear');
  assert.equal(m.page.area('a'), '');
  assert.equal(m.page.name('a'), '');
  assert.equal(m.page.ctl('a-file').value, '', '清空要连文件那一格一起清：留着上一次的选择，下一次「读入」读的是旧文件');
  // 真浏览器里 `input.files` 是 FileList 的**只读访问器**，给它赋 `[]` 当场
  // `TypeError: Failed to set the 'files' property`——而假 DOM 量不到这件事（那里的 `files`
  // 是个普通属性，赋什么都行）。清空那一步会停在第一栏、第二栏没清，页面上是一句坏消息。
  // 这一格钉的是源码里不许再出现那一形写法：清文件只有 `value = ''` 那一条正路。
  assert.equal(/\.files\s*=[^=]/.test(wCode(Z_ASSEMBLY)), false,
    '装配层里出现了 `.files = …` 的赋值：那一格在真页面上读不回来');
  assert.equal(m.page.disabled(`${Z_P}-in-workbench-a-file`), false, '清空输入不许顺手把文件那一格也禁用——那是「这台浏览器不给读」那一档');
  assert.equal(m.page.btnDisabled('copyDiff'), true, '清空之后导出要重新灰回去');
  assert.equal(m.page.out().includes(`${Z_P}-row`), false, '清空要回到空态那一句话，而不是留着上一份结果');
});

test('Z24 归一化两枚：stats.ignored 与那句说明同现同灭', () => {
  const m = zMount({ seed: { 'a-text': 'hello world\nkeep', 'b-text': 'HELLO   WORLD\nkeep' } });
  m.page.click('compare');
  assert.equal(m.wb.state().produced.stats.ignored, 0, '没勾之前那一处是实打实的差异');
  assert.equal(m.page.out().includes(J_VIEW.esc(X_NOTES.ignored)), false, '没发生的事不许写在页面上');
  m.page.check('ws', true);
  m.page.check('case', true);
  m.page.change('ws');
  assert.equal(m.wb.state().computes, 2, '勾一档必须重算一遍：拿旧结论配新档位，页面上那一句结论就是假的');
  assert.ok(m.wb.state().produced.stats.ignored > 0, '归一化抹平的那几行要进 stats.ignored');
  assert.match(m.page.out(), /归一化之后两份文本相同/);
  assert.ok(m.page.out().includes(J_VIEW.esc(X_NOTES.ignored)), '结论被归一化过就必须明说：这一条是「同现」');
  m.page.check('ws', false);
  m.page.change('ws');
  assert.equal(m.wb.state().produced.stats.ignored > 0, false, '取消之后没抹平任何东西，那一格要回到 0');
  assert.equal(m.page.out().includes(J_VIEW.esc(X_NOTES.ignored)), false, '这一条是「同灭」：说明不许留在页上');
});

test('Z25 JSON 档：三档结论、六列变更表与那六句代价说明同屏', () => {
  const m = zMount({ seed: { 'a-text': '{"a":1,"b":[1,2]}', 'b-text': '{"b":[1,3],"a":1,"c":true}' } });
  m.page.click('compare');
  assert.equal(m.page.out().includes(`${Z_P}-json`), false, '文本档不该有那张表');
  m.page.set('mode', 'json');
  m.page.change('mode');
  assert.equal(m.wb.state().computes, 2, '换口径要重算：两张账表数的是不同的事');
  const out = m.page.out();
  assert.ok(out.includes(`${Z_P}-verdict--diff`), `结论档不对：${out.slice(0, 160)}`);
  assert.ok(out.includes(`${Z_P}-json__meta`));
  assert.ok(out.includes(`${Z_P}-json__row--add`), '新增那一格 c 要在表里');
  assert.equal(wCount(out, `${Z_P}-notes`), 1);
  for (const note of Object.values(Y_NOTES)) {
    assert.ok(out.includes(J_VIEW.esc(note)), `那六句少了一句「${note.slice(0, 12)}…」：表与代价说明同屏是 Y18 第二半的承诺`);
  }
  for (const k of ['expand', 'fold', 'diffOnly', 'firstDiff', 'prevDiff', 'nextDiff']) {
    assert.equal(m.page.btnDisabled(k), true, `JSON 档按格比对，${k} 没有意义，该置灰而不是按了报错`);
  }
  assert.equal(m.page.hidden('text'), true, '换到 JSON 档，文本档那一段说明要藏起来');
  assert.equal(m.page.hidden('json'), false, '而 JSON 档那一段要露出来：显隐段与 mode 是同一件事的两面');
  const order = zMount({ seed: { 'a-text': '{"a":1,"b":2}', 'b-text': '{"b":2,"a":1}', mode: 'json' } });
  order.page.click('compare');
  assert.match(order.page.out(), /按 JSON 值判为相同，但键的书写次序不同/);
  assert.equal(order.page.out().includes('逐字符相同'), false, '键序不同那一档写成「逐字符相同」，就是把两件不同的事说成一件');
  const identical = zMount({ seed: { 'a-text': '{"a":1}', 'b-text': '{"a":1}', mode: 'json' } });
  identical.page.click('compare');
  assert.match(identical.page.out(), /键的书写次序也一致/);
});

test('Z26 两类失败分两条路：用户的空格子进状态行，骨架的漂移原样上抛，上一格都不擦', () => {
  const m = zMount();
  const before = m.page.out();
  m.page.click('compare');
  assert.equal(m.guarded.length, 1, '一次按钮一次边界：那份计数是页面上那行红字的账本');
  assert.equal(m.threw.length, 0, '两边都空是用户那一格的事实，不该记成「这一页坏了」');
  assert.match(String(m.page.line()), /两边都还空着/);
  assert.equal(m.page.out(), before, '坏消息走状态行那一格，结果区那一份原样留着');
  m.page.set('b-text', 'x');
  m.page.click('compare');
  assert.match(String(m.page.line()), /A 侧还是空的/);
  assert.equal(m.wb.state().computes, 0, '前两发都没算成：computes 只记真的算完的那一次');
  m.page.set('a-text', 'y');
  m.page.click('compare');
  assert.equal(m.wb.state().computes, 1);
  const painted = m.page.out();
  assert.notEqual(painted, before);
  m.page.set('a-text', Array.from({ length: X_LINES + 1 }, () => 'x').join('\n'));
  m.page.click('compare');
  assert.equal(m.threw.length, 0, '超闸门也是用户那一档，不是漂移');
  assert.match(String(m.page.line()), /超出闸门/);
  assert.match(String(m.page.line()), /上限 200,000 行/, '要把上限说在句子里：只说「超了」，用户读不出超到哪儿');
  assert.equal(m.page.out(), painted, '超闸门那一份不能把上一格的结果擦掉');
  const bad = zMount({ seed: { 'a-text': '{"a":}', 'b-text': '{"a":1}', mode: 'json' } });
  const badBefore = bad.page.out();
  bad.page.click('compare');
  assert.equal(bad.threw.length, 0);
  assert.match(String(bad.page.line()), /比不了/);
  assert.match(String(bad.page.line()), /第 1 行/);
  assert.equal(bad.page.out(), badBefore, '坏 JSON 那一发同样是擦不得的那一条');
  const drift = zMount({ seed: { 'a-text': 'p\nq', 'b-text': 'p\nr' }, drop: [`${Z_P}-in-workbench-b-name`] });
  assert.deepEqual(drift.report.missing, [`${Z_P}-in-workbench-b-name`], '缺格要在 mount 的清单里报出来，但不许拦启动');
  const kept = drift.page.out();
  drift.page.click('compare');
  assert.equal(drift.threw.length, 1, 'spec 与骨架漂了要原样上抛：这一类是坏消息，不是用户的空格子');
  assert.match(String(drift.threw[0][1]), /骨架/);
  assert.equal(drift.page.out(), kept, '抛在画之前：这一条与上面那三条说的是同一句红线的第四种写法');
});

test('Z27 文件三件：拒在 read 之前、非 UTF-8 明说、拖放同一条路、缺手就置灰', async () => {
  const m = zMount({ seed: { 'b-text': 'beta' } });
  m.page.pickFile('a', zFile('old.txt', 'alpha\nbeta'));
  await zSettle();
  assert.deepEqual(m.reads, ['old.txt']);
  assert.equal(m.page.area('a'), 'alpha\nbeta');
  assert.equal(m.page.name('a'), 'old.txt', '文件名不跟着上屏，导出的那一份头就永远是个占位符');
  assert.match(String(m.page.read('a')), /已读入/);
  m.page.click('compare');
  assert.match(m.wb.state().out, /^--- old\.txt/);
  m.page.pickFile('a', zFile('huge.txt', 'x', X_BYTES + 4096));
  await zSettle();
  assert.equal(m.reads.length, 1, '超限那一份必须在读之前就拒掉：五 MiB 不该先整份进内存再说「不行」');
  assert.match(String(m.page.read('a')), /超出闸门/);
  const nope = zMount({ seed: { 'b-text': 'beta' }, decode: () => ({ ok: false, text: '' }) });
  nope.page.pickFile('a', zFile('gbk.txt', '中文'));
  await zSettle();
  assert.match(String(nope.page.read('a')), /不是 UTF-8/);
  assert.equal(nope.page.area('a'), '', '读不成就不许把半份内容留在框里');
  // 两枚"读得成但根本不是文本"的样本：NUL 与替换字符。写成 fromCharCode 而不是字面转义，
  // 是因为测试文件里躺一枚真的 NUL 字节会让不少工具（与本节那三把剥源码的尺）先把它吃掉。
  const NUL = String.fromCharCode(0);
  const FFFD = String.fromCharCode(0xFFFD);
  const binaries = [['nul.txt', `a${NUL}b`], ['bad.txt', `a${FFFD}b`]];
  for (const pair of binaries) {
    const bin = zMount({ seed: { 'b-text': 'beta' } });
    bin.page.pickFile('a', zFile(pair[0], pair[1]));
    await zSettle();
    assert.match(String(bin.page.read('a')), /不是 UTF-8/, `${pair[0]}：{ok:true} 而内容是二进制，那一档也要说出来`);
  }
  const d = zMount({ seed: { 'b-text': 'beta' } });
  d.page.drop('a', [zFile('dropped.txt', 'q\nr')]);
  await zSettle();
  assert.deepEqual(d.reads, ['dropped.txt'], '拖放与选文件必须是同一条路：两条路迟早只修好一条');
  assert.equal(d.page.name('a'), 'dropped.txt');
  // 「选 A / B 侧文件」那两枚只**转发**、不自己读：真页面上打开选择器的那只手是旁边那枚原生
  // input，读的那一发归 `change`。假 DOM 的 `el.click()` 会往 `clicked` 里留痕，所以这一判
  // 量得到"按了哪一枚"；而 `reads` 那一本账钉的是"转发不等于读"。
  const fwd = zMount({ seed: { 'b-text': 'beta' } });
  fwd.page.click('fileB');
  assert.deepEqual(fwd.page.clicked, [`${Z_P}-in-workbench-b-file`],
    '那一枚按钮的文案是「选 B 侧文件」，它必须去开那台选择器，而不是复读自己那一格');
  assert.equal(fwd.reads.length, 0, '打开选择器不算读文件：readFile 一次都不许发生');
  assert.equal(String(fwd.page.read('b')).includes('没有读到文件'), false,
    '第一次按就当街报错，等于把每一次首发都变成一次坏消息');
  const none = zMount({ readFile: null });
  assert.equal(none.page.btnDisabled('fileA'), true, '这台浏览器没有那两只读手，按钮就该灰着');
  assert.equal(none.page.btnDisabled('fileB'), true);
  assert.equal(none.page.disabled(`${Z_P}-in-workbench-a-file`), true, '输入框也要灰：拖放那条路同样读不了');
  none.page.click('fileA');
  assert.equal(none.reads.length, 0);
});

test('Z28 换前缀自证：整页地址跟着 prefix 走，而产物里一处 df- 都不剩', () => {
  const Q = 'zx';
  const m = zMount({ prefix: Q, seed: { 'a-text': 'p\nq\nr', 'b-text': 'p\nx\nr' } });
  assert.deepEqual(m.report.missing, [], '前缀换了骨架就得整套跟着换：还按 df 找就一格也找不到');
  m.page.click('compare');
  const out = m.page.out();
  assert.equal(out.includes('df-'), false, '结果区里剩一处 df-，换前缀这件事就只做了一半');
  for (const cls of [`${Q}-verdict`, `${Q}-stats`, `${Q}-row `, `${Q}-col--a`, `${Q}-notes`]) {
    assert.ok(out.includes(cls), `换档之后少了 ${cls}`);
  }
  assert.ok(out.includes(`data-${Q}-i=`) && out.includes(`data-${Q}-ln=`), '属性名也带前缀：只换类名不换属性，样式与脚本就分家了');
  assert.notEqual(m.page.doc.getElementById(`${Q}-status-workbench-bar`), null);
  assert.equal(m.page.doc.getElementById('df-status-workbench-bar'), null);
  assert.match(String(m.page.line()), /比完了/);
  assert.equal(wCount(out, `${Q}-row `), 6, '两栏各三份行块：这一格数的就是「整页跟着前缀走」');
  assert.equal(wCount(out, `${Q}-fold--`), 0, '三行两份、上下文三行：一块到底，不该有折叠条');
});

test('Z29 折叠条真的能点开：那一发就是「全部展开」，不重算，而且只认带 skip 的那一枚', () => {
  const m = zMount({ seed: { 'a-text': Z_A40, 'b-text': Z_B40 } });
  m.page.click('compare');
  m.page.click('diffOnly');
  const s0 = m.wb.state();
  const g0 = m.guarded.length;
  assert.ok(s0.hunks.length > 1, '前提：只看差异那一档确实折出了不止一块');
  assert.ok(wCount(m.page.out(), `${Z_P}-fold--`) > 0, '前提：页面上确实画出了折叠条');
  // 先试一处"不是折叠条"的落点：行块只带 `data-df-ln`，结果区里除了那枚按钮什么都不该动档。
  // 这一判是防"把容器上的 click 当成整块的重画信号"——那一形写法在这一格里同样能过"能展开"。
  m.page.clickRow();
  assert.equal(m.page.val('context'), 'diff', '点行块不许动上下文那一档：结果区里只有折叠条是按钮');
  assert.equal(m.guarded.length, g0, '不该发生的一发不许记进 guarded 的账：那一本数的是真做过的动作');
  m.page.clickFold(24);
  assert.equal(m.page.val('context'), 'all', '点开折叠条要写回那枚下拉：状态有第二份口径就是红线 6 破');
  assert.equal(wCount(m.page.out(), `${Z_P}-fold--`), 0, '展开之后一条折叠条都不该留');
  const all = dHunks(dLines(Z_A40, Z_B40, {}), Infinity);
  assert.equal(wCount(m.page.out(), `${Z_P}-row `), all.reduce((acc, h) => acc + h.rows.length, 0) * 2,
    '两栏各四十行：折叠只是阅读形状，展开之后行数一行不会少');
  assert.equal(m.wb.state().computes, s0.computes, '点开折叠条不是重算：行级那份 result 与折叠档无关');
  assert.match(String(m.page.line()), /已展开全部/, '状态行要说清"展开的是整页"，不是让读者猜那一发做了什么');
  assert.deepEqual(m.threw, [], '这一发要是抛了，用户得到的是一句坏消息而不是一份展开的结果');
  assert.equal(m.guarded[m.guarded.length - 1], `${Z_P}-out-workbench-bar`,
    '这一发发生在结果区，记的账就得是那只容器的地址，不能冒充成按钮按过');
  // 换前缀那一刀：装配层读的属性名从 `env.prefix` 派生，所以 `zx` 页面上的旧地址 `data-df-skip`
  // 必须**不**触发（触发了就说明有一处把这一页的地址写死在行为里）。
  const q = zMount({ prefix: 'zx', seed: { 'a-text': Z_A40, 'b-text': Z_B40 } });
  q.page.click('compare');
  const qBars = wCount(q.page.out(), 'zx-fold--');
  assert.ok(qBars > 0, '前提：换前缀那一页同样折出了折叠条（不然下面两条判的是空集）');
  q.page.clickFold(6, 'data-df-skip');
  assert.equal(q.page.val('context'), '', '旧前缀的地址不该被认：认了就是本层手打过那一串（与 Z16 同一件事）');
  assert.equal(wCount(q.page.out(), 'zx-fold--'), qBars, '不认的那一发不许留下任何痕迹：折叠条要一条不少地留着');
  q.page.clickFold(6);
  assert.equal(q.page.val('context'), 'all', '而本页自己的属性名要认得：整页跟着前缀走');
  assert.equal(wCount(q.page.out(), 'zx-fold--'), 0, '认到之后那一发要真的展开，不是只写下拉不重画');
});
```

---

## Task 5：`diffWorkbench.js` + `toolDiff.js` + §Z 后半 + 收录面门禁两处

**Files：** Create `dev/js/tools/diffWorkbench.js`、`dev/js/toolDiff.js`；
Modify `scripts/check-tools-surface.mjs`（§0.3(a) 那两处）、`scripts/check-tools-surface-teeth.mjs`（三刀 + 缺省档那一刀）、
`scripts/toolkit-tests.mjs`（§Z 续写）。

- [x] **Step 1：写 §Z 后半判据（Z13–Z28）**——六条红线各自的形状：装配层零环境词（词表里
      **多两枚 `FileReader` / `File`**，全页 0 命中的那条要写成"入口恰好 1 次、装配层 0 次"）、
      id 只由 `DIFF_SPEC` / `DIFF_ACTIONS` 派生、挂载期一次计算都不做（输入 `input` 二十次之后
      注入的 `runGuarded` 计数为 0）、两类失败分两条路（用户空输入 → `FieldError` → 一句提示；
      spec 与骨架漂移 → 原样上抛且**不擦掉上一格结果**）、换前缀自证（`df` ↔ `zx` 一整页 id 跟着换、
      门禁仍绿，照 §R16 / §W18 那一形状）、`diff-json` 与 `diff-core` 各自只被本装配层 reach 一次
      （import 边闭合，防渗透的正向核 + 反向核照 M16 / N19 的排除式写法）。
      落笔分四块（Z13–Z17 已在 Task 4 那格落好，本格续 Z18–Z28 共十一判加 import 面那一条）。
      **这一格踩的坑值得单独记**（写的是观察到的事实，最后一句是推断，别再往下当结论传）：
      前两回合各有一次"长内容工具调用中途断掉"——`cat >> <<'ZZEOF'` 两次、`Write` 一次，
      报错形状是 `params must have required property 'file_path'`，看着像漏填参数。
      三次的内容里都恰好含那份二进制样本的 NUL unicode 字面转义；把样本改成
      `String.fromCharCode(0)` / `String.fromCharCode(0xFFFD)` 构造、并把 319 行拆成四块追加之后，
      一次通过。**推断**是那一格在参数的序列化层被解成真 NUL 字节、把调用截断，
      而长度只是让它在别的地方也偶发——这一条没有单独复现过，别再拿它当已证事实。
      落完自证两味：`node -e` 数整个文件的 NUL 字节（得 0）、`node --check` 语法过。
      顺带一条**假证据**要挡在下一个读者前面：`grep -c $'\x00' file` 里 shell 会吞掉那个字节，
      模式变空 → **匹配全文件**，数出来的那个大数不是"有很多 NUL"。
- [x] **Step 2：写实现到绿**。`diffWorkbench.js` 落 **761 行**、`toolDiff.js` 落 **237 行**。
      评审时删掉一处死参数：`bodyOf` 给 `renderVerdict` 传了 `normalized: stats.ignored > 0`，
      而视图层那本按 `stats.ignored` 自己判（Z12 的词表口径），多传的这一格永远没人读——
      留着等于在装配层立第二个"归一化过"的口径来源，与红线 6 同一条理由，所以删的不是注释是那一格。
- [x] **Step 3：拆 `check-tools-surface.mjs` 那颗牙**——按 §0.3(a) 落 `cfg.nodes` 与
      `DEFAULT_NODE_FAMILIES`，扩孤儿判据到节点族（只对声明了 `nodes` 的条目生效）。
      磁盘 `773 → 807` 行，动的正是那三处：① 模块级新增 `DEFAULT_NODE_FAMILIES = ['out','status','tree','copy']`
      （**默认值不变**，所以存量三页一字不松）；② 节点族那一族判据改成"这一栏自己声明了就按声明要"，
      并给拼错的那一族（`nodes: ['trec']`）单独报一句，因为拼错一族的下场是产物少一格而门禁读不到；
      ③ 行号槽加退出闸 `c.gutter !== false`（对比页两个粘贴框按设计不带行号）；④ 孤儿正则按
      `declaresNodes` 决定根集是 `in|when|btn` 还是扩到四族，报错文案跟着改成"控件/开关/按钮/节点 id"。
      跑存量三条 ready 条目：exit=0。
- [x] **Step 4：补牙齿四刀**（T-a / T-b / T-c + 缺省档那一刀），逐刀点燃并记进台账。
      计划原文要的那第四刀（"把 `DEFAULT_NODE_FAMILIES` 去掉 `tree`"）**做不了**：牙齿用例的结构是
      注入变异 → 必须变红，而弱化默认族只会让门禁更绿，注进去就是一把假牙——落的是另外三刀
      （产物缺 `tree` 那一格、`nodes: ['trec']`、`nodes: ['status']` 收窄），
      差额与"声明被新页消费那一刀推到 Task 6"都记进 §0.6。
      台账 `58 → 61`（`git show HEAD:` 里数 `name: '` 得 58，磁盘现在 61，差的正是本格那三刀），全跑：
      **61/61 如期变红**，末尾两条自证照旧
      （变异全部还原、复跑基线仍绿）。两处 `expect` 文案跟着 Step 3 改的新串同步
      （`骨架私自多一枚按钮`、`T-b` 那两条现在等的是"多出这些控件/开关/按钮/**节点** id"）。
- [x] **Step 5：登记镜像** + `--fix`。`FILE_TARGETS` 只新增两本（`diffWorkbench.js` / `toolDiff.js`）。
      Step 5 原文里那第三本 `check-tools-surface.mjs` **不需要新登记**：它在段 2 就已在清单里，
      本格的三处拆牙由 `--fix` 把段 2 计划那一块整块换过去（`12800–13572` ← 磁盘 807 行，
      那份计划 `14194 → 14228` 行）。牙齿本 `check-tools-surface-teeth.mjs` 从来不在清单上（三页的三份都不在）。
      同一格还连带改了**文件头那张用例分布表**（§Z 那行 `12` → `28`、合计 `422` → `438`），
      它长在磁盘 §A 里，所以 `--fix` 第三次换段 1 那份计划的 §A 块（`6530 → 6536` 行）。
      两块镜像由磁盘内容直接生成，`--fix` 之后裸跑：两本一次命中、逐字节全等。
- [x] **Step 6：门禁①②③⑤⑥**（⑤⑥ 此时还没有第四页，跑的是"存量三页不回归"那一档）。
      ① 全量 `# tests 438 / pass 438 / fail 0` 退 0（快循环用 `--test-name-pattern="^Z[12][0-9] "` 单跑 §Z）；
      ② 裸跑退 0：`73` 块已落地镜像全等、`未落地 0 节`，js 块 `63 → 65`（段5 从 6 块长到 8 块）；
      ③ **37/37** 退 0，末尾两条自证照旧（副本回到全绿；实验前后脏指纹一字不差，`34` 个脏项含另一路会话那批）；
      ⑤ 退 0（存量三条 ready 条目、含 §0.3(a) 那颗牙拆完之后）；⑥ **61/61** 退 0 + 基线复绿。
      门禁④ 本格不跑：`vite.config.js` 的 `input` 里还没有 `toolDiff`（Task 6 才接），
      本格没有产物侧改动，硬跑只会量到段 4 那一份。
      跑之前 `uptime`：本机 load `2.6`，没有那种"红要先归因给量具"的档位。
- [x] **Step 7：提交** `feat(tools): 段 5 Task 5 对比页装配层与入口——§Z 续到二十八判，收录面 nodes 拆牙`。
      落笔 = `ff9a878`（`709c1ad` → `ff9a878`，`git update-ref` 的 CAS 带旧 sha）。
      pathspec 十件：`dev/js/tools/diffWorkbench.js`（新）/ `dev/js/toolDiff.js`（新）/
      `scripts/toolkit-tests.mjs` / `scripts/check-tools-surface.mjs` / `scripts/check-tools-surface-teeth.mjs` /
      `scripts/verify-plan-blocks.mjs` / 本计划 / **另外三份计划**（各只被 `--fix` 换掉一个镜像块：
      段 1 的 §A 用例分布表、段 2 的 `check-tools-surface.mjs`、段 4 的 §W）。
      `git show --stat` 读到 `3694 insertions(+) / 49 deletions(-)` 且**只有这十行**；
      另一路会话压在索引上的格一格不少（`USAGE.md` 仍 `1/76`、spec 仍 `0/17`），工作树文件一件未动
      （`git status --porcelain -unormal` 落笔前 `35` 行、之后 `26` 行，逐行 diff 只少我这十格，
      多出来的那一格是本格回填又把它弄脏的这份计划）。
      **提交态自证**（`git archive HEAD` 整份导出 → 导出树里 `git init`（脏项 0）→ 三道人真跑）：
      门禁① `438/438` 退 0、门禁② 退 0（`73` 块已落地镜像全等、`未落地 0 节`、js 块 `65`）、
      门禁③ **37/37** 退 0（副本回到全绿、实验前后脏指纹一字不差）。
      **§0.7 第 2 条那句"跑完再把真索引里我那几格对齐回去"，这一格第一次看清它防的是什么**，
      把现场形状记在这儿：plumbing 只写树、**不动工作索引**，所以落笔之后 `git status` 里我那八格
      变成 `MM`（索引里还压着**旧 blob**，与新 HEAD 比就是"暂存了一处回退"），两本新文件更显示成
      `D `（索引压根没有那一格 = "已暂存的删除"）。不清醒的下一步是另一路会话从共享索引落笔，
      把我这十格整体退回旧 blob，而它的提交看起来只是"少了它自己那一格"。
      处置：提交之后立刻把**只属于我的那十格**
      `git update-index --add --cacheinfo 100644,$(git rev-parse "HEAD:$f"),$f` 对齐到新 HEAD，
      并用 `git ls-files -s` 前后各存一份对照——差异必须**只有那十行**，别人压在索引上的条目
      （`USAGE.md` / `_config.yml` / `package.json` / `scripts/article-check.mjs` 那十六格）逐字节不动。
      对齐完 `git status` 里我这十格全部消失，剩下的脏项全是另一路会话的。


### 落地镜像（门禁二核的就是这一块，`--fix` 会把它整块换成磁盘内容）

Task 2/3/4 那三节立的规矩在这里照用：只有**整文件**与**整节**镜像允许 ` ```js ` 围栏（§0.6 的硬规矩），
贴的时候直接由磁盘内容生成，事后跑一次 `--fix` 复验它已经全等。

登记面这一格动了两处，也**只**动两处：`FILE_TARGETS` 新增 `dev/js/tools/diffWorkbench.js` 与
`dev/js/toolDiff.js`（方向照旧，跟着磁盘走不跟着计划走）。Step 5 原文里那句"登记三本镜像"的第三本
——改过的 `scripts/check-tools-surface.mjs`——**不需要新登记**：它在段 2 就已经在清单里，这一格那三处
拆牙由 `--fix` 把段 2 计划里那一块整块换过去（磁盘 `773 → 807` 行）。而 `check-tools-surface-teeth.mjs`
从来不在镜像清单上（三页的三份牙齿本都不在），它的现场是 Step 4 那三刀的红名与门禁⑥ 的 `61/61`
两行读数，记在本节 Step 4 里。

#### `dev/js/tools/diffWorkbench.js`（整文件，811 行）

这一本是"控件与动作的对应关系只允许有一处"这句话唯一的落地现场：七枚 id helper、三栏的
`DIFF_SPEC`（含每栏**自己声明**的 `nodes`）、十四枚 `DIFF_ACTIONS`、`controlIds(prefix)` 四个方向的对账，
全部只有这一份写法。它镜像的理由与 `diffView.js` 同一类——钉它的判据**全是源码扫描型**：Z14 数环境词
（词表比 §W10 多 `FileReader` 与 `instanceof` 两枚）与那一处 `innerHTML`、Z16 数以 `df-` 起头的
**整格字面量** 0 命中、Z17 数三栏 `nodes` 与十四枚动作的族名。源码一漂，红的只是字符串比对，
看不出"当时那一版把行高的退路写成 24 还是 30、把行内档的 `change` 拆成两发还是一发"，
所以这一格镜像留的就是那一版的现场。

```js
/**
 * 文件对比页的装配层（段 5 Task 5；§Z 后半）。把 `tools-diff.html` 里那一整块静态骨架接到两本纯模块
 * （§X 的行级引擎、§Y 的 JSON 感知比对）与本页视图层（`diffView.js`）上，算完的结果一律交给视图层的
 * 生成器拼串，再由**唯一的一处** `innerHTML` 出口写进结果区。
 *
 * 这一层存在的理由与 `jsonWorkbench.js` 同源，也只有一条：**控件与动作的对应关系只允许有一处**。
 * 三栏控件、十四枚按钮、两行状态读数、两枚栏内复制、显隐段，如果"哪个 id 属于哪一格"同时写在 HTML 的
 * `id=` 与 JS 的字符串里，改一处漏一处，而漏掉那一处只在页面上表现为"点了没反应"。所以这里用
 * `DIFF_SPEC` / `DIFF_ACTIONS` 声明控件、开关与动作，所有 id 由那七枚 helper 派生；HTML 里的
 * `data-df-when` 是写给人和样式看的标记，运行时不读它，它与 spec 是否一致由门禁⑤在构建产物上对账。
 *
 * 六条红线，§Z 后半的判据逐条对着咬：
 *
 * 1. **视图层零 import**：`diffView.js` 那条红线写在它自己文件头；本层只在构造期 `createDiffView` 一次，
 *    并把那七件生成器原样暴露在 `view` 这一格上（Z17 数的就是它——多一件是第二条渲染路径，少一件是有
 *    一格没人画）。
 * 2. **环境只在入口**（Z14、Z15）：`window` / `globalThis` / `Date.now(` / `localStorage` / `navigator.`
 *    / `new Blob` / `URL.` / `getComputedStyle` / `querySelector` / `setTimeout(` / `FileReader` /
 *    `instanceof` 在本文件源码里一个都不许出现。时钟与存储这一页**根本不要**（不做"记住上次输入"，
 *    于是那句"输入不出本机"连一条退路都不必写）；`FileReader`、`TextDecoder`、`Blob` 三件、`setTimeout`
 *    与行高全从 `env` 递进来。
 *    两只读手是本页独有的：`readFile(file) → Promise<Uint8Array>` 与 `decode(bytes) → {ok, text}`。
 *    为什么"是不是文件""是不是 UTF-8"归入口而不是本层：`instanceof` 与 `TextDecoder` 都是宿主能力，
 *    本层碰一次，§Z 的假 DOM 夹具就要多造一件假件，而那条"零环境词"的判据当场从判据退化成注释。
 *    本层只认 `{name, size}` 这个形状，并在**读之前**用 `size` 拒掉超限那份——五 MiB 的文件不该
 *    先整份进内存再说"不行"（Z27 数的就是 `readFile` 那一次有没有发生）。
 * 3. **id 只由 spec 派生**（Z16）：那七枚 helper 是唯一的地址来源，`controlIds(prefix)` 与 `DIFF_SPEC`
 *    与 `DIFF_ACTIONS` 三个方向对账；本文件不许手打以 `df-` 起头的地址串（数的是**整格字面量**，
 *    单引号、双引号、模板串三种引号都算，注释里的不算）。
 * 4. **挂载期一次计算都不做**（Z18）：`mount()` 只接线、画空态、按 `gate` 刷新一次闸门读数；比对只在
 *    按动作时发生，所以二十次 `input` 之后注入的 `runGuarded` 计数必须是 0（`input` 那一发只排一次
 *    防抖读数，不进边界），结果区里一行 `df-row` 都不许有。防抖靠**令牌**而不是 `clearTimeout`：
 *    时钟由入口注入，本层不该再多要一只取消延时的手。
 * 5. **两类失败分两条路**（Z26）：用户那一格不能用（两边都空 / 一侧空 / 坏 JSON / 超闸门 / 没选文件）
 *    → `FieldError` → 一句话进控制栏的状态行，别的什么都不塌；模块或骨架自己抛的（spec 与骨架漂移出的
 *    档位、缺席的节点）→ 原样上抛，交给注入的 `runGuarded` 记"这一块坏了"。两条路都**不许把上一格的
 *    结果擦掉**——先算后画，抛一定发生在画之前。
 * 6. **档位只有一个口径**（Z20、Z21）：折叠的四个档住在 `context` 那一枚下拉里，`expand` / `fold` /
 *    `diffOnly` 三枚按钮是它的**快捷键**（写回同一枚 `select`，不复算第二份状态）；跳转的三枚读的是
 *    同一份 hunk 清单；并排与行内两档视图读的是同一份行流，切布局本身不重算。
 *
 * 与 `jsonWorkbench.js` 的分工：那一本服务 JSON 页（单个工作区、粘贴框为主、外加只渲染可视行的树），
 * 这一本服务对比页（两栏输入、一条控制栏、行级与 JSON 两种口径）。两本互不 import；`diffView.js`
 * 在全仓库只许被本文件 reach（`jsonView.js` 与 `codecView.js` 同理各自只被自己的装配层 reach）——
 * 两个入口 reach 同一模块，Rollup 会切出带 `import{` 的共享 chunk，`iifeWrapPlugin` 包完就是整页
 * SyntaxError 而构建 exit=0（§0.4 那条构建红线，Z13 正反两头核它）。
 *
 * 复算：`node --test scripts/toolkit-tests.mjs` 里的 §Z 二十九判
 * （原写二十八，`Z29`「折叠条真的能点开」是 Task 6 落第四页骨架时补的那一发——2026-10-01 段 5 Task 9 对账改口）。
 */
import {
  gate as coreGate, diffLines, hunksOf, unifiedText, DIFF_NOTES, CR_GLYPH,
  MAX_INPUT_BYTES, MAX_INPUT_LINES,
} from './diff-core.js';
import { diffJson, DIFF_JSON_NOTES } from './diff-json.js';
import { createDiffView } from './diffView.js';

// ── 常量与派生 id ────────────────────────────────────────────────────────────

/** 这一页只有一个工作区，没有面板清单：`spec.ids` 与 `DIFF_SPEC` 的键必须逐字相同（门禁⑤ :545） */
export const DIFF_PANEL_IDS = ['workbench'];

/**
 * 栏位名。与编码页的 `main` / `diff`、JSON 页的 `main` 不同，这一页是**两栏输入 + 一条控制栏**：
 * `a` 与 `b` 各带粘贴框、文件选择、文件名、状态读数与栏内复制；`bar` 带全部下拉与勾选、结果区
 * 和那一行进度读数。第三栏（"对齐视图"）在这一页没有对应的事实，Z17 钉它不许出现。
 */
export const SIDES = ['a', 'b', 'bar'];

/**
 * 行高的**退路值**：权威在 `dev/sass/toolDiff.scss` 的 `--df-row-h` 那一格，由入口读一次再注入
 * （`env.rowHeight`，红线 2）。跳转那一枚把"第几块"换算成 `scrollTop` 只认这一个整数——样式那本改
 * 行高时不必改这里（入口读得到新值）；这里改而不改样式，只在"样式读不到"那一条路上生效。
 */
const ROW_HEIGHT = 24;

/** 闸门读数（行 / 字节）随 `input` 刷新的防抖时长；真页面上由入口注入的那只延时承载 */
const DEBOUNCE_MS = 200;

/** 三枚档位下拉的默认值：骨架那格给空串时落在这里；非空而不在白名单里一律上抛（Z21 的 `'9'`） */
const DEFAULTS = { mode: 'text', layout: 'side', context: '3' };

/**
 * 折叠档位的唯一解释表（红线 6）。`diff` 是"只看差异行"= 上下文 0 行；`all` 是"全部展开"= 上下文
 * `Infinity`——`hunksOf` 在 `Infinity` 那一档把相邻差异块合成一块，折叠条因此自然归零，这正是"展开"
 * 要的形状，本层不必再判一次"要不要收拢"。
 */
const CONTEXT_VALUE = { diff: 0, 3: 3, 5: 5, all: Infinity };

/** `bar` 那一枚 `mode` 下拉的取值档：`switch.targets` 的 `when` 只能是它的子集（Z17） */
const MODE_OPTIONS = ['text', 'json'];

/** 布局两档：并排两栏读同一份行流；行内摊成一栏，`change` 那一行拆成两行各取一半高亮 */
const LAYOUT_OPTIONS = ['side', 'inline'];

/** 侧栏的显示名：状态行与报错文案里用它，`'a'` / `'b'` 这种内部名字不上屏 */
const SIDE_NAME = { a: 'A 侧', b: 'B 侧', bar: '这一页' };

/** 一 MiB 的字节数：超限文案里"上限"那一格要说的是这个数，不是 `MAX_INPUT_BYTES` 那串裸整数 */
const MIB = 1048576;

/** 用户那一格不能用的那类失败：走状态行那一句话，不进 `runGuarded` 的账（红线 5 的第一条路） */
class FieldError extends Error {
  /**
   * @param {string} message 直接上屏的那一句话
   */
  constructor(message) {
    super(message);
    this.name = 'FieldError';
  }
}

/** 控件 id：`{p}-in-{面板}-{控件}`。栏位编在**控件 id** 里（`a-text` / `b-file`），因为门禁⑤ 的这条
 * 公式没有栏位那一维（§0.6 记的偏差） */
export const fieldId = (p, panel, id) => `${p}-in-${panel}-${id}`;
/** 动作按钮 id：`{p}-btn-{面板}-{key}` */
export const buttonId = (p, panel, key) => `${p}-btn-${panel}-${key}`;
/** 结果区 id：`{p}-out-{面板}-{栏}` */
export const outId = (p, panel, side) => `${p}-out-${panel}-${side}`;
/** 状态读数 id：`{p}-status-{面板}-{栏}` */
export const statusId = (p, panel, side) => `${p}-status-${panel}-${side}`;
/** 栏内复制按钮 id：`{p}-copy-{面板}-{栏}` */
export const copyId = (p, panel, side) => `${p}-copy-${panel}-${side}`;
/** 显隐段 id：`{p}-when-{面板}-{key}` */
export const whenId = (p, panel, key) => `${p}-when-${panel}-${key}`;
/**
 * 节点族 → id。这一页只有 `out` / `status` / `copy` 三族，第四族 `tree` 在这里没有对应的事实
 * （JSON 页那一族由 `jsonWorkbench.js` 自己解释）；`DIFF_SPEC` 里多写一族就是骨架私自长一格。
 * @param {string} p 前缀
 * @param {string} panel 面板
 * @param {string} fam 族名
 * @param {string} side 栏位
 * @returns {string}
 */
export const nodeId = (p, panel, fam, side) => {
  if (fam === 'out') return outId(p, panel, side);
  if (fam === 'status') return statusId(p, panel, side);
  if (fam === 'copy') return copyId(p, panel, side);
  throw new RangeError(`DIFF_SPEC 的 ${side} 栏声明了节点族「${String(fam)}」：这一页只有 out / status / copy 三族`);
};

/**
 * 控件与显隐开关的唯一声明处（门禁⑤ DOM 组比的就是这张表的 `controls` 与 `switch.targets`）。
 * `nodes` 由每一栏**自己声明**：并排视图只有一个结果区（住在 `bar`），两条输入栏各有一行读数和一枚
 * 栏内复制——写死四族会让这一页去要六个它根本没有的 id（收录面那颗牙因此按这一格拆）。
 * `gutter: false` 是给门禁⑤ 的退出闸：那一格只对 `type: 'area'` 存在"行号槽"这一说，而对比页的
 * 两个粘贴框按设计不带行号——行号在结果区的行块里，输入区的行号对"两份文本"没有意义。
 */
export const DIFF_SPEC = {
  workbench: {
    sides: {
      a: {
        kind: 'workbench',
        nodes: ['status', 'copy'],
        controls: [
          { id: 'a-text', type: 'area', gutter: false },
          { id: 'a-file', type: 'file' },
          { id: 'a-name', type: 'text' },
        ],
      },
      b: {
        kind: 'workbench',
        nodes: ['status', 'copy'],
        controls: [
          { id: 'b-text', type: 'area', gutter: false },
          { id: 'b-file', type: 'file' },
          { id: 'b-name', type: 'text' },
        ],
      },
      bar: {
        kind: 'workbench',
        nodes: ['out', 'status'],
        controls: [
          { id: 'mode', type: 'select', options: MODE_OPTIONS },
          { id: 'layout', type: 'select', options: LAYOUT_OPTIONS },
          { id: 'context', type: 'select', options: Object.keys(CONTEXT_VALUE) },
          { id: 'ws', type: 'checkbox' },
          { id: 'case', type: 'checkbox' },
        ],
        switch: {
          by: 'mode',
          targets: [
            { key: 'text', when: ['text'] },
            { key: 'json', when: ['json'] },
          ],
        },
      },
    },
  },
};

/**
 * 工具栏那五段的动作清单：`key` 派生按钮 id，`group` 是这一枚归哪一族（Z17 按族名单核对），
 * `to` 只有折叠那三枚有——它们是 `context` 下拉的**快捷键**，写回那一枚 `select` 而不另存一份状态。
 * `label` 与骨架里 `<button>` 的文案逐字相同（门禁⑤ 比的就是这两处同字）。
 */
export const DIFF_ACTIONS = [
  { key: 'compare', group: 'run', label: '重新对比' },
  { key: 'swap', group: 'run', label: '交换两侧' },
  { key: 'clear', group: 'run', label: '清空输入' },
  { key: 'reset', group: 'run', label: '恢复默认档' },
  { key: 'expand', group: 'fold', label: '全部展开', to: 'all' },
  { key: 'fold', group: 'fold', label: '上下文三行', to: '3' },
  { key: 'diffOnly', group: 'fold', label: '只看差异', to: 'diff' },
  { key: 'firstDiff', group: 'goto', label: '第一处差异' },
  { key: 'prevDiff', group: 'goto', label: '上一处' },
  { key: 'nextDiff', group: 'goto', label: '下一处' },
  { key: 'fileA', group: 'file', label: '选 A 侧文件' },
  { key: 'fileB', group: 'file', label: '选 B 侧文件' },
  { key: 'copyDiff', group: 'copy', label: '复制差异' },
  { key: 'download', group: 'copy', label: '下载 .diff' },
];

/** 这一页只有一个面板，那七枚 helper 的中间那一格全是它 */
const PANEL = DIFF_PANEL_IDS[0];

/**
 * 整页地址清单：门禁⑤ 与 §Z 的三个方向对账都读这一份。
 * @param {string} p 前缀
 * @returns {{fields: string[], nodes: string[], when: string[], buttons: string[]}}
 */
export const controlIds = (p) => {
  const fields = [];
  const nodes = [];
  const when = [];
  const buttons = [];
  for (const slug of DIFF_PANEL_IDS) {
    for (const side of Object.keys(DIFF_SPEC[slug].sides)) {
      const cfg = DIFF_SPEC[slug].sides[side];
      for (const c of cfg.controls || []) fields.push(fieldId(p, slug, c.id));
      for (const fam of cfg.nodes || []) nodes.push(nodeId(p, slug, fam, side));
      for (const tg of (cfg.switch || {}).targets || []) when.push(whenId(p, slug, tg.key));
    }
    for (const a of DIFF_ACTIONS) buttons.push(buttonId(p, slug, a.key));
  }
  return { fields, nodes, when, buttons };
};

// ── 装配 ─────────────────────────────────────────────────────────────────────

/**
 * 接一页。
 * @param {object} env 由 `toolDiff.js` 递进来的环境
 * @param {object} env.document 真 `document`
 * @param {object} env.Tk `window.Tk`（这一页只吃 `view.esc` 那一格）
 * @param {string} env.prefix 前缀
 * @param {Function} [env.runGuarded] `(id, fn) => boolean`：坏消息的边界，本层只管抛
 * @param {Function} env.later `(fn, ms) => number`：防抖那一只延时
 * @param {object} [env.navigator] 只借 `clipboard` 那一格
 * @param {number} [env.rowHeight] 行高（样式给的环境量），非 `≥1` 的整数当场 `RangeError`
 * @param {Function} [env.BlobCtor] 下载三件之一，按工厂调用（本层不写 `new Blob`）
 * @param {Function} [env.createObjectURL] 下载三件之二
 * @param {Function} [env.revokeObjectURL] 下载之三，一律落在 `finally`
 * @param {Function} [env.readFile] `(file) => Promise<Uint8Array>`：缺席就是"这台浏览器不给读文件"
 * @param {Function} [env.decode] `(bytes) => {ok: boolean, text: string}`：UTF-8 的判断在入口
 * @returns {{mount: Function, state: Function, view: object}} `view` 是视图层那七件，原样暴露
 */
export function createDiffWorkbench(env) {
  const tk = env.Tk || {};
  /** 视图层只借转义那一只；`prefix` 与 `crGlyph` 由本层给（前者是页面地址、后者是 §X 的字形约定） */
  const view = createDiffView({ esc: tk.view && tk.view.esc, prefix: env.prefix, crGlyph: CR_GLYPH });
  const esc = tk.view && tk.view.esc;
  if (env.rowHeight !== undefined && (!Number.isInteger(env.rowHeight) || env.rowHeight < 1)) {
    throw new RangeError(`env.rowHeight 得是 ≥1 的整数像素（权威在样式那一格），这里是 ${String(env.rowHeight)}`);
  }
  /** 有读文件这两只手才谈得上"选本地文件"；缺了就把两枚按钮与两个 `input` 一起置灰（Z27 最后一档） */
  const canReadFiles = typeof env.readFile === 'function' && typeof env.decode === 'function';
  const canDownload = typeof env.BlobCtor === 'function'
    && typeof env.createObjectURL === 'function' && typeof env.revokeObjectURL === 'function';
  const nav = env.navigator;
  const clip = nav ? nav.clipboard : undefined;
  const rowHeight = env.rowHeight === undefined ? ROW_HEIGHT : env.rowHeight;

  /**
   * 这一页的全部状态。`out` 是"最近一次可比复制的文本"，复制与下载读的就是这一格（Z19 判两边同字）；
   * `computes` 与 `gateReads` 是给 §Z 看的两个计数器，也是红线 4 唯一的量具——没有它们，
   * "挂载期不计算"这件事在页面上根本读不出来。
   */
  const s = {
    computes: 0, gateReads: 0, out: '', produced: null, result: null,
    hunks: [], rows: [], at: 0,
    textA: '', textB: '', nameA: '', nameB: '',
    mode: DEFAULTS.mode, layout: DEFAULTS.layout, context: DEFAULTS.context,
  };
  const nodes = new Map();
  let gateToken = 0;

  /** 取节点：`mount` 建好索引之后一律读索引，缺席那一格要指名道姓地抛（Z26 的第二类失败） */
  const node = (id) => {
    if (!nodes.has(id)) {
      throw new RangeError(`骨架里没有 id="${id}" 这一格：DIFF_SPEC 与 tools-diff.html 漂了，装配层要读它而页面没有`);
    }
    return nodes.get(id);
  };
  const field = (id) => node(fieldId(env.prefix, PANEL, id));
  const btn = (key) => node(buttonId(env.prefix, PANEL, key));
  const resultBox = () => node(outId(env.prefix, PANEL, 'bar'));
  /** 状态行只走 `textContent`：那一格是句子，不是标记 */
  const say = (side, text) => { node(statusId(env.prefix, PANEL, side)).textContent = text; };
  /** 结果区唯一的写入口——红线里"整页只有一处 innerHTML"的那一处 */
  const paint = (html) => { resultBox().innerHTML = html; };

  /** 读一枚下拉：空串落默认档，非空而白名单外一律上抛（骨架或用户改出个 spec 不认的档位就是漂移） */
  const selectOf = (id, options, fallback) => {
    const raw = String(field(id).value || '');
    if (raw === '') return fallback;
    if (!options.includes(raw)) {
      throw new RangeError(`${id} 的档位是「${raw}」，而 DIFF_SPEC 只认 ${options.join(' / ')}：骨架的 <option> 与 spec 漂了`);
    }
    return raw;
  };
  const flag = (id) => field(id).checked === true;

  /** 把控件的当前状态读进 `s`：一次计算的第一步，也是"只读一次"的那一步 */
  const readControls = () => {
    s.textA = String(field('a-text').value || '');
    s.textB = String(field('b-text').value || '');
    s.nameA = String(field('a-name').value || '');
    s.nameB = String(field('b-name').value || '');
    s.mode = selectOf('mode', MODE_OPTIONS, DEFAULTS.mode);
    s.layout = selectOf('layout', LAYOUT_OPTIONS, DEFAULTS.layout);
    s.context = selectOf('context', Object.keys(CONTEXT_VALUE), DEFAULTS.context);
    return { ws: flag('ws'), case: flag('case') };
  };

  /** 千分位只给"行数"这种大数用；`toLocaleString` 的 locale 写死，两台机器要给出同一个字符串 */
  const n = (v) => Number(v).toLocaleString('en-US');
  /** 字节读数：不到 1 MiB 说 KB（保留一位），到了就说 MB——五 MiB 的闸门用"5242880 字节"没人读得懂 */
  const kb = (bytes) => (bytes >= MIB ? `${(bytes / MIB).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`);

  /**
   * 闸门读数：两栏各一行「N 行 · 大小」，超限那一档点名多了多少。
   * 这一件事在挂载时跑一次、之后随 `input` 的防抖跑，**不算一次比对**（`computes` 不涨，Z18 判的就是
   * 它）：`gate` 只数行与字节，两份 5 MiB 的文本贴进去也绝不该在这里跑一遍 Myers。
   */
  const refreshGate = () => {
    const a = String(field('a-text').value || '');
    const b = String(field('b-text').value || '');
    const g = coreGate(a, b);
    s.gateReads += 1;
    for (const side of ['a', 'b']) {
      const part = side === 'a' ? g.a : g.b;
      const head = `${n(part.count)} 行 · ${kb(part.bytes)}`;
      const blocked = !g.ok && (g.which === side || g.which === 'both');
      if (!blocked) { say(side, head); continue; }
      const overKey = g.reason === 'bytes' ? `bytes${side.toUpperCase()}` : `lines${side.toUpperCase()}`;
      const over = g.over[overKey];
      const limit = g.reason === 'bytes' ? `${MAX_INPUT_BYTES / MIB} MiB` : `${n(MAX_INPUT_LINES)} 行`;
      say(side, `${head}｜这一侧超了闸门约 ${n(over)} ${g.reason === 'bytes' ? '字节' : '行'}（上限 ${limit}）`);
    }
  };
  /** 防抖那枚令牌：只有最后排上的那一发真的读数（本层没有第二只取消延时的手） */
  const scheduleGate = () => {
    const token = ++gateToken;
    env.later(() => { if (token === gateToken) refreshGate(); }, DEBOUNCE_MS);
  };

  /** JSON 档的可复制文本：一行一处变更，与表里那六列同序（复制与下载读的就是这一串） */
  const jsonToText = (j) => j.changes
    .map((c) => `${c.kind}\t${c.pointer === '' ? '/' : c.pointer}\t${c.owner}\t${c.aPreview ?? ''}\t${c.bPreview ?? ''}`)
    .join('\n');

  /** 换一次算一次：`compute` 只算不画，抛出去的一切都在画之前（红线 5） */
  const compute = (opts) => {
    if (s.mode === 'json') {
      const j = diffJson(s.textA, s.textB);
      if (j.verdict === 'invalid') {
        const e = j.error || {};
        throw new FieldError(`比不了：${SIDE_NAME[e.which] || '其中一侧'}第 ${e.line ?? '?'} 行第 ${e.column ?? '?'} 列${e.reason ? `——${e.reason}` : ''}。要按文本逐行比，切回「文本」档。`);
      }
      s.result = null;
      s.hunks = [];
      s.rows = [];
      s.at = 0;
      s.out = j.changes.length === 0 ? '' : jsonToText(j);
      s.produced = j;
      s.computes += 1;
      return j;
    }
    if (s.textA === '' && s.textB === '') {
      throw new FieldError('两边都还空着：贴进两份文本，或各选一个本地文件，再按「重新对比」。');
    }
    if (s.textA === '' || s.textB === '') {
      throw new FieldError(`${SIDE_NAME[s.textA === '' ? 'a' : 'b']}还是空的，另一半没有可以跟它比的东西。`);
    }
    const result = diffLines(s.textA, s.textB, opts);
    if (result.verdict === 'blocked') {
      const which = result.blocked.which === 'both' ? '两边' : SIDE_NAME[result.blocked.which];
      const over = result.blocked.over || {};
      const delta = Math.max(over.bytesA ?? 0, over.bytesB ?? 0, over.linesA ?? 0, over.linesB ?? 0);
      const limit = result.blocked.reason === 'bytes' ? `${MAX_INPUT_BYTES / MIB} MiB` : `${n(MAX_INPUT_LINES)} 行`;
      throw new FieldError(`超出闸门：${which}多了约 ${n(delta)} ${result.blocked.reason === 'bytes' ? '字节' : '行'}（上限 ${limit}）。这一页不做"截断悄悄算"，把大的一份拆开再比。`);
    }
    s.result = result;
    s.produced = result;
    s.hunks = hunksOf(result, CONTEXT_VALUE[s.context]);
    s.rows = s.hunks.reduce((acc, h) => acc.concat(h.rows), []);
    s.at = 0;
    s.out = unifiedText(result, { a: s.nameA, b: s.nameB, context: CONTEXT_VALUE[s.context] });
    s.computes += 1;
    return result;
  };

  /**
   * 一份行流在这一档里占几个**视觉行**：并排两栏各一份，`rows.length` 就是一块的高度；行内把
   * `change` 摊成两行。跳转那一枚算 `scrollTop` 用的是这个数，不是 `rows.length`——两档共用同一份
   * 行流但不同高，这是切布局之后唯一会变的量。
   * @param {object[]} rows 一块 hunk 的行
   * @returns {number}
   */
  const linesOf = (rows) => (s.layout === 'inline'
    ? rows.reduce((acc, r) => acc + (r.kind === 'change' ? 2 : 1), 0)
    : rows.length);

  /**
   * 一块差异的正文。并排档两栏各读同一份行流（`renderSide(rows, 'a')` / `(rows, 'b')`，缺席那一侧
   * 由视图层长成 `--fill`，不是少一行）；行内档把那份行流摊成一栏，`change` 那一行**拆成两行**、
   * 各取一半高亮。两档共用同一份 `hunksOf` 产出，所以切布局不重算（Z20 判的就是这件事）。
   *
   * 行内那一档逐行调 `renderSide([row], side)`：视图层没有"整栏一次给两栏"的第二件，而本层也不许
   * 自己拼行块（红线 1）。代价是 `data-df-i` 在行内档是每发各从 0 数——那一格是给视图层自己看
   * 的形状标记，页面上定位读的是 `data-df-ln`（真行号）与折叠条前的兄弟计数。
   * @param {object[]} rows 一块 hunk 的行
   * @returns {string}
   */
  const block = (rows) => {
    const p = env.prefix;
    if (s.layout === 'inline') {
      let body = '';
      for (const r of rows) {
        if (r.kind === 'change') body += view.renderSide([r], 'a') + view.renderSide([r], 'b');
        else body += view.renderSide([r], r.kind === 'ins' ? 'b' : 'a');
      }
      return `<div class="${p}-lines">${body}</div>`;
    }
    const col = (side) => `<div class="${p}-col ${p}-col--${side}">${view.renderSide(rows, side)}</div>`;
    return `<div class="${p}-cols">${col('a')}${col('b')}</div>`;
  };

  /** 代价说明那一列：只说真的发生了的那几句，最后一句是本页的口径承诺 */
  const notesOf = (produced) => {
    const list = [];
    if (produced.degraded) list.push(DIFF_NOTES.degraded);
    if (produced.stats.inlineSkipped > 0) list.push(DIFF_NOTES.inlineSkipped);
    if (produced.stats.ignored > 0) list.push(DIFF_NOTES.ignored);
    if (produced.a.finalNewline !== true || produced.b.finalNewline !== true) list.push(DIFF_NOTES.finalNewline);
    list.push(DIFF_NOTES.gitApply);
    list.push(DIFF_NOTES.noUpload);
    return list;
  };

  /** 结果区正文：结论 → 读数 → 逐块（前折叠条 + 块）→ 尾折叠条 → 代价说明 */
  const bodyOf = (produced) => {
    const p = env.prefix;
    if (s.mode === 'json') {
      return view.renderVerdict({ mode: 'json', verdict: produced.verdict, stats: produced.stats })
        + view.renderJsonTable({
          changes: produced.changes, stats: produced.stats, notes: Object.values(DIFF_JSON_NOTES),
          truncated: produced.truncated,
        });
    }
    let html = view.renderVerdict({
      mode: 'text', verdict: produced.verdict, stats: produced.stats, degraded: produced.degraded,
    }) + view.renderStats(produced.stats);
    s.hunks.forEach((h, k) => {
      html += view.renderFoldBar({ skipped: h.skipped });
      html += block(h.rows);
      if (k === s.hunks.length - 1) html += view.renderFoldBar({ skipped: h.tailSkipped, tail: true });
    });
    const notes = notesOf(produced);
    return html + `<ul class="${p}-notes">${notes.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  };

  /**
   * 档位、置灰与显隐的收尾——一切"状态变了而内容不必重算"的那一路共用这一发。
   * 折叠与跳转那六枚在 JSON 档没有意义（那一档按格比对，没有"第几块"与"上下文"这一说），整排置灰
   * 而不是"按了报错"；复制与下载在没有结果时同样置灰，比"按下去说一句空的"更省事。
   */
  const syncGate = () => {
    const p = env.prefix;
    const targets = DIFF_SPEC[PANEL].sides.bar.switch.targets;
    for (const tg of targets) {
      node(whenId(p, PANEL, tg.key)).hidden = !tg.when.includes(s.mode);
    }
    for (const a of DIFF_ACTIONS) {
      if (a.group === 'fold' || a.group === 'goto') btn(a.key).disabled = s.mode === 'json';
    }
    const hasOut = s.out !== '';
    for (const a of DIFF_ACTIONS) {
      if (a.group === 'copy') btn(a.key).disabled = !hasOut;
    }
  };

  /** 算 + 画 + 收尾；抛出去的东西由调用侧（`act`）决定走哪条路 */
  const run = () => {
    const opts = readControls();
    const produced = compute(opts);
    paint(bodyOf(produced));
    resultBox().scrollTop = 0;
    syncGate();
    return produced;
  };

  /** 跳到第 `index` 块（0 起）：两端钳住，状态行报「第 i / n 处差异」 */
  const goTo = (index) => {
    if (s.mode === 'json') throw new FieldError('JSON 档按格比对，没有"第几处差异"这一说：切回「文本」档再跳。');
    if (s.hunks.length === 0) throw new FieldError('两份内容没有差异块，跳转这一档用不上。');
    const at = Math.min(Math.max(index, 0), s.hunks.length - 1);
    let units = 0;
    for (let k = 0; k < at; k += 1) units += linesOf(s.hunks[k].rows) + (s.hunks[k].skipped > 0 ? 1 : 0);
    units += s.hunks[at].skipped > 0 ? 1 : 0;
    resultBox().scrollTop = units * rowHeight;
    s.at = at + 1;
    say('bar', `第 ${s.at} / ${s.hunks.length} 处差异`);
  };

  /**
   * 写剪贴板。这一页只有 `navigator.clipboard` 这一只手，缺了或浏览器拒了都明说，不退到
   * `execCommand`（那一档在隐私模式下同样不保，而多一条路就多一处"两台机器给两个答案"）。
   * @param {string} text 要写的正文
   * @param {string} where 那一句里说"复制的是什么"
   * @returns {Promise<void>}
   */
  const copy = (text, where) => {
    if (text === '') throw new FieldError(`还没有${where}：先按「重新对比」，或把要复制的那一栏填上内容。`);
    if (!clip || typeof clip.writeText !== 'function') {
      throw new FieldError('这台浏览器不给网页写剪贴板：选中结果区那一段，用系统自己的复制。');
    }
    return Promise.resolve(clip.writeText(text)).then(
      () => say('bar', `已复制${where}`),
      () => say('bar', `复制${where}没被浏览器允许：选中结果区那一段，用系统自己的复制。`),
    );
  };

  /** 下载那一份可复制文本：三件全从入口来，对象 URL 一律在 `finally` 里收回（被拦的下载不泄） */
  const download = () => {
    if (!canDownload) throw new FieldError('这台浏览器缺少下载所需的能力（Blob 或对象 URL）：改用「复制差异」。');
    if (s.out === '') throw new FieldError('还没有可比对的结果：先按「重新对比」。');
    const url = env.createObjectURL(env.BlobCtor([s.out], { type: 'text/plain;charset=utf-8' }));
    try {
      const a = env.document.createElement('a');
      a.href = url;
      a.download = s.mode === 'json' ? 'changes.json-diff.txt' : 'changes.diff';
      a.click();
    } finally {
      env.revokeObjectURL(url);
    }
    say('bar', '已导出那一份差异');
  };

  /**
   * 选本地文件那一路：**先按 `size` 拒，再读**（红线 2 里那一句"五 MiB 不该先整份进内存"）。
   * 编码判断也不在本层：`decode` 交回 `{ok, text}`，本层只在文本里认 NUL 与替换字符那一档——
   * `fatal` 已经拒掉了读不成的那些，这两枚补的是"读得成但根本不是文本"的那一类（把图片拖进来）。
   * @param {'a'|'b'} side 栏
   * @param {object} file `{name, size}` 形状的那个东西
   * @returns {Promise<void>}
   */
  const loadFile = async (side, file) => {
    if (!canReadFiles) throw new FieldError('这台浏览器不能在本机读文件：把文本贴进粘贴框也能比。');
    if (!file || typeof file.name !== 'string' || typeof file.size !== 'number') {
      throw new FieldError(`${SIDE_NAME[side]}没有读到文件：再从本机选一个，或把文本贴进粘贴框。`);
    }
    if (file.size > MAX_INPUT_BYTES) {
      throw new FieldError(`${file.name} 超出闸门：比 ${MAX_INPUT_BYTES / MIB} MiB 多了 ${kb(file.size - MAX_INPUT_BYTES)}。这一页不做截断悄悄算，换个小的或拆开再比。`);
    }
    const bytes = await env.readFile(file);
    const d = env.decode(bytes);
    if (!d || d.ok !== true) throw new FieldError(`${file.name} 看起来不是 UTF-8 文本：存成 UTF-8 再选一次。`);
    if (/[\u0000\uFFFD]/.test(d.text)) {
      throw new FieldError(`${file.name} 看起来不是 UTF-8 文本（读到了 NUL 或替换字符）：先确认它的编码。`);
    }
    field(`${side}-text`).value = d.text;
    field(`${side}-name`).value = file.name;
    refreshGate();
    say(side, `已读入 ${file.name}`);
  };
  /** 文件那一路的两条入口：`change` 与 `drop` 汇到同一发，两条路必须同一条（Z27 判的就是它） */
  const takeFile = (side, source) => {
    loadFile(side, source && source.length > 0 ? source[0] : null).catch((err) => {
      if (err && err.name === 'FieldError') say(side, err.message);
      else throw err;
    });
  };
  /**
   * 「选 A / B 侧文件」那两枚按钮：把这一发**转发**给旁边那枚原生 `input[type=file]`，
   * 由它打开选择器；读仍然只在 `change` 与 `drop` 那两条路上发生。
   *
   * 为什么不是"本层再复读一次 `.files`"：按钮的文案说的是"选文件"，而打开选择器的那只手只有
   * 原生 input 有。按钮自己去读那一格，第一次按（那一格还是空的）就得到一句"没有读到文件：
   * 再从本机选一个"——等于把每一次首发都变成一次报错，而它旁边就是那个能打开选择器的控件。
   * 转发之后这一枚与直接点 input 是同一件事，`loadFile` 那一条路一份都不多（Z27 判的正是
   * "按按钮只留一次 click 痕迹、`readFile` 零次"）。input 不能读时按钮同批置灰
   * （`mount` 里那两行），所以这一发不会打开一台读不了的选择器。
   * @param {'a'|'b'} side 栏
   */
  const openPicker = (side) => { field(`${side}-file`).click(); };

  /**
   * 十四枚按钮的共同落点。里面**不套第二层 try**：坏消息要么变成状态行那一句话（`FieldError`），
   * 要么原样上抛给注入的 `runGuarded`——本层自己吞掉一次抛出，那份计数就成了假账（Z26 数的正是
   * `guarded` 与 `threw` 的差）。
   * @param {string} key 动作 key
   */
  const dispatch = (key) => {
    if (key === 'compare') { run(); say('bar', '比完了'); return; }
    if (key === 'swap') {
      const a = field('a-text'); const b = field('b-text');
      const na = field('a-name'); const nb = field('b-name');
      const t = a.value; a.value = b.value; b.value = t;
      const nm = na.value; na.value = nb.value; nb.value = nm;
      refreshGate();
      run();
      say('bar', '两侧换了个位置');
      return;
    }
    if (key === 'clear') {
      for (const side of ['a', 'b']) {
        field(`${side}-text`).value = '';
        field(`${side}-name`).value = '';
        const pick = field(`${side}-file`);
        /** 只写 `value`：`input.files` 那一格在真浏览器里是 `FileList` 只读访问器，
         *  给它赋 `[]` 会当场 `TypeError: Failed to set the 'files' property`（假 DOM 量不到，
         *  那里的 `files` 是个普通属性），而清空那一步会停在第一栏、第二栏没清。
         *  清文件的选择框只有这一条正路。 */
        pick.value = '';
      }
      s.out = ''; s.produced = null; s.result = null; s.hunks = []; s.rows = []; s.at = 0;
      paint(view.renderNotice('把要比较的两份内容分别贴进来，或各选一个本地文件。'));
      refreshGate();
      syncGate();
      say('bar', '输入已清空');
      return;
    }
    if (key === 'reset') {
      field('mode').value = DEFAULTS.mode;
      field('layout').value = DEFAULTS.layout;
      field('context').value = DEFAULTS.context;
      field('ws').checked = false;
      field('case').checked = false;
      readControls();
      syncGate();
      say('bar', '档位回到默认（输入没动）');
      return;
    }
    const fold = DIFF_ACTIONS.find((x) => x.key === key);
    if (fold && fold.to !== undefined) {
      field('context').value = fold.to;
      retune('context');
      return;
    }
    if (key === 'firstDiff') { goTo(0); return; }
    if (key === 'prevDiff') { goTo(s.at - 2); return; }
    if (key === 'nextDiff') { goTo(s.at); return; }
    if (key === 'copyDiff') { copy(s.out, '那一份差异'); return; }
    if (key === 'download') { download(); return; }
    if (key === 'fileA') { openPicker('a'); return; }
    if (key === 'fileB') { openPicker('b'); return; }
    throw new RangeError(`「${key}」在 DIFF_ACTIONS 的清单上，本层却没有对应的行为：按钮长出来了而没人接`);
  };
  /** 一次按钮动作：先过 `FieldError` 那一层，其余交给注入的边界 */
  const act = (key) => {
    const id = buttonId(env.prefix, PANEL, key);
    const inner = () => {
      try {
        dispatch(key);
      } catch (err) {
        if (err && err.name === 'FieldError') say('bar', err.message);
        else throw err;
      }
    };
    if (typeof env.runGuarded === 'function') env.runGuarded(id, inner);
    else inner();
  };

  /**
   * 档位变了而内容不必重算：`mode` / `layout` / `context` 三枚下拉与折叠那三枚快捷键共用这一发。
   * `mode` 换的是**口径**（文本 / JSON），必须重算——两张账表数的是不同的事；`layout` 与 `context`
   * 只换视图，读的还是那份 `result`（Z20 与 Z21 各自钉住这一条）。
   * @param {string} id 变了的那一枚
   */
  const retune = (id) => {
    const opts = readControls();
    if (id === 'mode') {
      const produced = compute(opts);
      paint(bodyOf(produced));
      resultBox().scrollTop = 0;
    } else if (id === 'context' && s.result) {
      s.hunks = hunksOf(s.result, CONTEXT_VALUE[s.context]);
      s.rows = s.hunks.reduce((acc, h) => acc.concat(h.rows), []);
      s.at = 0;
      paint(bodyOf(s.result));
    } else if (s.produced) {
      paint(bodyOf(s.produced));
    }
    syncGate();
  };

  /**
   * 结果区上的一次点击，只认折叠条那一枚。
   *
   * 规格 §5.6 那句是「折叠条上写"省略 N 行"**并可点开**」，而这一页的折叠档只有**一个口径**
   * （`context` 那一枚下拉；Z21 钉的正是「三枚快捷键写回同一枚 select、不另存状态」）。所以点开
   * 一条折叠条 = 把那一档调成 `all`，页面上所有折叠条一起归零。它**不是**"只展开这一块"：那一档
   * 要另存一份"哪几块已经展开"的 per-block 状态，同一次比较就此有了两个口径，而复制与下载读的那一份
   * （`unifiedText` 按 `CONTEXT_VALUE[s.context]` 出）会跟着分家——屏幕上展开三块、导出的还是折叠的。
   *
   * 认折叠条只认 `data-{prefix}-skip`：那一格是 `renderFoldBar` 唯一的产出标记，行块挂的是
   * `data-{prefix}-ln` / `data-{prefix}-i`，所以点结论、点行块、点代价说明都不动档。属性名从
   * `env.prefix` 派生（Z16：本层一处 `df-` 字面量都不许有），查找只走 `getAttribute`——
   * `querySelector` 在 Z14 的词表里是禁的，而 `closest` 在 §Z 的假 DOM 里根本不存在，写了就是
   * 给这一判添一处量不到的分支（§W 的树用 `closest` 是因为它的行有嵌套，这里没有那个形状）。
   * @param {object} evt 派发到手上的那一次点击
   */
  const onFoldClick = (evt) => {
    const target = evt && evt.target;
    if (!target || typeof target.getAttribute !== 'function') return;
    if (target.getAttribute(`data-${env.prefix}-skip`) === null) return;
    const inner = () => {
      // 展开那一发不在这儿重写第二遍：走 `dispatch('expand')`，也就是「全部展开」那枚按钮的同一条路
      // （写回 `context` 再 `retune`）。这一格里出现第二次"怎么展开"的口径，Z21 就只咬得住一半。
      dispatch('expand');
      say('bar', '已展开全部：与「全部展开」那枚按钮是同一档');
    };
    if (typeof env.runGuarded === 'function') env.runGuarded(outId(env.prefix, PANEL, 'bar'), inner);
    else inner();
  };

  return {
    view,
    /** 只读的最近状态：§Z 的判据用它数"算了几次 / 读了几次闸门"，页面不读它 */
    state: () => ({ ...s }),
    /**
     * 接线。先建节点索引（缺席的那几格进 `missing` 报告，但**不拦启动**——缺哪一格是到按那一枚
     * 按钮时才真的坏，让整页停在启动那一下等于把"还能用一半"也一起废掉），再画空态、刷一次读数。
     * @returns {{missing: string[], panels: string[]}} 缺的地址与这一页的面板清单
     */
    mount: () => {
      const list = controlIds(env.prefix);
      const all = [...list.fields, ...list.nodes, ...list.when, ...list.buttons];
      for (const id of all) {
        const el = env.document.getElementById(id);
        if (el) nodes.set(id, el);
      }
      const missing = all.filter((id) => !nodes.has(id));
      /** 没有那两只读手：两枚 `file` 输入框与那两枚按钮一起置灰，而不是"按了才发现不能用" */
      for (const side of SIDES) {
        for (const c of DIFF_SPEC[PANEL].sides[side].controls) {
          if (c.type === 'file' && nodes.has(fieldId(env.prefix, PANEL, c.id))) field(c.id).disabled = !canReadFiles;
        }
      }
      for (const a of DIFF_ACTIONS) {
        const el = nodes.get(buttonId(env.prefix, PANEL, a.key));
        if (!el) continue;
        if (a.group === 'file') el.disabled = !canReadFiles;
        el.addEventListener('click', () => act(a.key));
      }
      for (const side of ['a', 'b']) {
        const areaId = fieldId(env.prefix, PANEL, `${side}-text`);
        if (nodes.has(areaId)) {
          const area = nodes.get(areaId);
          area.addEventListener('input', scheduleGate);
          area.addEventListener('drop', (evt) => {
            if (evt && typeof evt.preventDefault === 'function') evt.preventDefault();
            takeFile(side, evt && evt.dataTransfer ? evt.dataTransfer.files : null);
          });
        }
        const pick = fieldId(env.prefix, PANEL, `${side}-file`);
        if (nodes.has(pick)) nodes.get(pick).addEventListener('change', () => takeFile(side, nodes.get(pick).files));
        const cp = copyId(env.prefix, PANEL, side);
        if (nodes.has(cp)) {
          nodes.get(cp).addEventListener('click', () => {
            const inner = () => copy(String(field(`${side}-text`).value || ''), `${SIDE_NAME[side]}的正文`);
            const wrapped = () => { try { inner(); } catch (err) { if (err && err.name === 'FieldError') say(side, err.message); else throw err; } };
            if (typeof env.runGuarded === 'function') env.runGuarded(cp, wrapped);
            else wrapped();
          });
        }
      }
      for (const id of ['mode', 'layout', 'context']) {
        const fid = fieldId(env.prefix, PANEL, id);
        if (nodes.has(fid)) {
          nodes.get(fid).addEventListener('change', () => {
            const inner = () => retune(id);
            const wrapped = () => { try { inner(); } catch (err) { if (err && err.name === 'FieldError') say('bar', err.message); else throw err; } };
            if (typeof env.runGuarded === 'function') env.runGuarded(fid, wrapped);
            else wrapped();
          });
        }
      }
      /** 折叠条的「点开」：结果区每次比较都整块重画，监听只能挂在容器上（§W 的树容器同一条理由） */
      const ob = nodes.get(outId(env.prefix, PANEL, 'bar'));
      if (ob && typeof ob.addEventListener === 'function') ob.addEventListener('click', onFoldClick);
      for (const id of ['ws', 'case']) {
        const fid = fieldId(env.prefix, PANEL, id);
        if (nodes.has(fid)) {
          nodes.get(fid).addEventListener('change', () => {
            const inner = () => { run(); say('bar', '归一化档变了，重比了一遍'); };
            if (typeof env.runGuarded === 'function') env.runGuarded(fid, inner);
            else inner();
          });
        }
      }
      paint(view.renderNotice('把要比较的两份内容分别贴进来，或各选一个本地文件；文件在这台机器上读取，不上传。'));
      say('bar', '还没有比较');
      refreshGate();
      syncGate();
      return { missing, panels: DIFF_PANEL_IDS.slice() };
    },
  };
}
```

#### `dev/js/toolDiff.js`（整文件，237 行）

入口这一本的镜像是**两处只活在这里的事实**：① Z15 那八件各恰好一处的计数对象
（`win.FileReader(` / `win.TextDecoder` / `win.Blob` / `URL.createObjectURL` / `URL.revokeObjectURL` /
`win.navigator` / `setTimeout(` / `getComputedStyle`），装配层对同一批词是 0 命中——两头合起来
才叫"环境只在入口"；② 门禁⑤ 组 5 用正则从产物里找的 `CONTAINER_ID` / `NOTICE_ID` / `ATTR`
那三行**字面量**，它们不许跟着前缀派生（Z16 钉的就是这三行的原文）。同一格里还钉着三条"没有"：
无顶层 `export`、无 `DOMContentLoaded`、`localStorage` 与 `Date.now(` 两本一起归零——最后这一条
就是那句"输入不出本机"连一条退路都不必写的现场。

```js
/**
 * 文件对比页入口（段 5 Task 5；§Z 后半）：只读骨架里那四格 `data-df-*`，把框架（`window.Tk`）、
 * 装配层（`createDiffWorkbench`）与本页接起来。与 `toolJson.js` 同形，差异有四处——这一页只有
 * 一块工作区（不经过 `createPanelDom`）、这一页**没有存储**（不做"记住上次输入"）、这一页多
 * 两只读文件的手，以及 `runGuarded` 由这一本自己给。
 *
 * 六条口径：
 *
 * 1. **前缀有两副面孔，各归各管**。`CONTAINER_ID` / `NOTICE_ID` 里那个 `df` 是**本页自己的地址**
 *    （`tools-diff.html` 的骨架写死它）；行为里用的前缀从 `data-df-prefix` 读，一路传给装配层，
 *    控件 id 与显隐段才跟着换得动（Z28 的 `zx` 那一档量的就是这件事）。
 * 2. **环境只在这一本读，每样恰好一次**（Z15 数的是出现次数）。`setTimeout`、剪贴板、下载那三件、
 *    行高，加上本页独有的 `FileReader` 与 `TextDecoder`，全从这里注入；装配层那十六个词一个都不许
 *    出现（Z14）。理由是同一份产物在两台机器、两个 CI runner 上只能给一个答案，而 §Z 的每一判
 *    都指望它只有一个。
 *    行高（`--df-row-h`）也在这一本读：它是**样式**给的环境量，读一次就注入一次（`env.rowHeight`），
 *    装配层里因此不许出现 `getComputedStyle`——那一只假件一旦要进 §Z 的夹具，"不读环境"这条红线
 *    就从判据退化成了注释。
 * 3. **文件那两件事拆成两只手，而不是一只**。`readFile` 只管把字节搬进内存，`decode` 只管判编码：
 *    装配层要在**读之前**按 `file.size` 拒掉超限那一份（五 MiB 不该先进内存再说"不行"），所以
 *    `{name, size}` 这个形状必须能被它单独看到；把两件事并成一只 `readAsText`，那一档拒绝就
 *    只能发生在读完之后。`decode` 用 `fatal: true`——非 UTF-8 要当场失败，不能让 `TextDecoder`
 *    悄悄把坏字节换成 `U+FFFD` 再交上去（那样"读得成但不是文本"与"读不成"在页面上就成了同一档）。
 *    `instanceof` 那一句留在这一本：那是**宿主类型判断**，装配层里出现一次就违反红线（Z14 词表里
 *    那两枚 `FileReader` 与 `instanceof` 说的是同一件事）。
 * 4. **`runGuarded` 由入口给**。装配层只负责"抛出来"，记不记、记在哪儿是页面这一侧的事：这一页没有
 *    面板错误条（那块区域就是整页），所以坏消息写进 `#df-notice` 那一句，下一次跑成功就撤掉。
 *    只有本层写过的句子本层才撤——那格提示行也用于启动失败，别把别人的话清成空白。
 * 5. **启动失败不装死**。抛出之前尽力把那句话写进 `#df-notice`（只走 `textContent`），因为脚本 404
 *    或被人挪到 `<head>` 这类事故，页面看起来跟"禁了脚本"一模一样：正文全在、按钮按不出东西。
 * 6. **两条 `<script>` 的先后是硬前提**。`toolkitCore.min.js` 挂 `window.Tk`（这一页只吃 `view` 那一格），
 *    入口在它之后；`assets/js/toolDiff.min.js` 里已经打进 `diffView.js` 与两本算法，绝不再挂进 `Tk`——
 *    两个入口 reach 同一模块，Rollup 会切出带 `import{` 的共享 chunk，整页 SyntaxError 而构建退 0。
 *
 * 不用 `export`：产物被 `vite.config.js` 的 `iifeWrapPlugin` 包成 `(function(){…})();`，而它不补
 * `'use strict'`，入口里留一条顶层 `export` 就是一个语法错误。产物名必须与页面里 `<script src>`
 * 那一段逐字符一致（`toolDiff.min.js`）。启动方式与 `webLab.js` 同档——脚本排在正文之后，解析
 * 到这一行时骨架节点已经存在，不接 `DOMContentLoaded`。
 */
import { createDiffWorkbench, DIFF_PANEL_IDS } from './tools/diffWorkbench.js';

/** 容器 id：`tools-diff.html` 里 `id="{{ df.prefix }}-workspace"` 在 `prefix: df` 下的落值 */
const CONTAINER_ID = 'df-workspace';
/** 提示行 id：坏消息与启动失败共用这一格 */
const NOTICE_ID = 'df-notice';

/** 骨架上那四格数据的属性名（前缀 `df` 同上，是本页的地址，不是行为里的前缀） */
const ATTR = { ids: 'data-df-ids', prefix: 'data-df-prefix', label: 'data-df-label', notice: 'data-df-notice' };

/**
 * 取提示行节点：容器在就读 `data-df-notice`，容器不在或那一格空着就回落到 `NOTICE_ID`。
 * 两条路径都要过"它得像个节点"这一关，因为写它的是失败兜底，不能自己再抛一次。
 * @param {object} doc 只提供 `getElementById`
 * @param {object|null} box 容器节点，可能不存在
 * @returns {object|null} 节点或 `null`
 */
function noticeNode(doc, box) {
  const fromAttr = box && typeof box.getAttribute === 'function'
    ? String(box.getAttribute(ATTR.notice) || '').trim() : '';
  const id = fromAttr !== '' ? fromAttr : NOTICE_ID;
  const el = id ? doc.getElementById(id) : null;
  return el && typeof el.setAttribute === 'function' ? el : null;
}

/**
 * `data-df-ids` → 面板清单。逗号分隔、允许空格、丢掉空项。
 * @param {string} raw 属性原文
 * @returns {string[]} 至少一项，空数组由调用侧判成错误
 */
function parseIds(raw) {
  return String(raw || '').split(',').map((s) => s.trim()).filter((s) => s !== '');
}

/**
 * 抛出来的东西形状千奇百怪（`throw 'x'`、`throw {message: 42}`），页面上只能有一行可读的句子：
 * 优先取 `message`，取不到就 `String()` 一次；空 `message` 退回名字。
 * @param {unknown} err 捕获到的东西
 * @returns {string}
 */
function messageOf(err) {
  const m = err && typeof err.message === 'string' ? err.message : '';
  if (m !== '') return m;
  const name = err && typeof err.name === 'string' ? err.name : '';
  if (name !== '') return name;
  return String(err);
}

/**
 * 把本地文件读成字节。**只做搬运**：编码一句不判（那是 `decode` 的事），大小一句不提（那是装配层
 * 在调用之前就办完的事）。`instanceof` 这一格是本页唯一的宿主类型判断——`DataTransfer.files` 与
 * `input.files` 给的都是真 `File`，而有人从别处塞进来一个 `{name, size}` 的假对象时，宁可在这一本
 * 当场说清"这不是一个文件"，也不要让 `FileReader` 在下一行抛一句读不出主语的 `TypeError`。
 * @param {object} win 真 `window`
 * @param {unknown} file 那一个候选
 * @returns {Promise<Uint8Array>}
 */
function fileReaderOf(win) {
  return (file) => new Promise((resolve, reject) => {
    if (!(file instanceof win.File)) {
      reject(new TypeError('这不是本机的一份文件（拖放被浏览器的隐私设置拦住，或那一格给的不是文件）'));
      return;
    }
    const fr = new win.FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result));
    fr.onerror = () => reject(new Error(`读不了「${file.name}」：这一页不上传，坏的是本地那一次的读取`));
    fr.readAsArrayBuffer(file);
  });
}

/**
 * UTF-8 那一道闸。`fatal: true` 是这一格的全部意义：非 UTF-8 当场抛，而不是悄悄换成 `U+FFFD` 交上去
 * ——那样"这份文件读不成"与"这份文件是文本但编码不对"在页面上就成了同一档，而装配层给用户的
 * 那句"存成 UTF-8 再选一次"正是靠这两档的分别才说得出口。
 * @param {object} win 真 `window`
 * @param {Uint8Array} bytes 读回来的字节
 * @returns {{ok: boolean, text: string}}
 */
function decodeOf(win) {
  return (bytes) => {
    try {
      return { ok: true, text: new win.TextDecoder('utf-8', { fatal: true }).decode(bytes) };
    } catch {
      return { ok: false, text: '' };
    }
  };
}

/**
 * 装配一遍。抛出去的东西由 `start` 负责先写进页面、再原样抛回控制台。
 * @param {object} doc 真 `document`
 * @param {object} win 真 `window`（要 `FileReader` / `TextDecoder` / `Blob` / `navigator`）
 * @param {object} tk `window.Tk`（这一页只吃 `view` 那一格）
 * @returns {object} `createDiffWorkbench().mount()` 的那两份清单
 */
function boot(doc, win, tk) {
  const box = doc.getElementById(CONTAINER_ID);
  if (!box || typeof box.getAttribute !== 'function') {
    throw new RangeError(
      `页面里没有 id="${CONTAINER_ID}" 的容器（或它读不到属性）：两条 <script> 必须排在正文之后，见 tools-diff.html 末尾那段注释`);
  }
  const ids = parseIds(box.getAttribute(ATTR.ids));
  if (ids.length === 0) {
    throw new RangeError(
      `容器 ${CONTAINER_ID} 的 ${ATTR.ids} 是空的：这一页的面板清单只有 ${DIFF_PANEL_IDS.join(' / ')}，_data/onlineTools.yml 的 panels 是不是漏了 slug？`);
  }
  const unknown = ids.filter((id) => DIFF_PANEL_IDS.indexOf(id) < 0);
  if (unknown.length > 0) {
    throw new RangeError(
      `容器 ${CONTAINER_ID} 的 ${ATTR.ids} 里有装配层不认识的面板：${unknown.join(' / ')}；这一页只有 ${DIFF_PANEL_IDS.join(' / ')}。`);
  }
  const prefix = String(box.getAttribute(ATTR.prefix) || '').trim() || 'df';
  const label = String(box.getAttribute(ATTR.label) || '').trim();
  const notice = noticeNode(doc, box);
  if (!tk || !tk.view || typeof tk.view.esc !== 'function') {
    throw new RangeError(
      'window.Tk 没挂上来（或 view.esc 缺了）：toolkitCore.min.js 要么 404，要么排在本入口之后，顺序见 tools-diff.html 末尾');
  }

  /** 提示行：`null` 撤回到"没话要说"。只走 `textContent`——入口这一层不拼任何标记 */
  const setNotice = (text) => {
    if (!notice) return;
    if (text === null) { notice.hidden = true; notice.textContent = ''; return; }
    notice.hidden = false;
    notice.textContent = text;
  };
  /** 口径 4：只有本层写坏过的那一句才由本层撤，别把启动失败那句话清成空白 */
  let broken = false;
  const blockName = label === '' ? CONTAINER_ID : label;
  const runGuarded = (id, fn) => {
    try {
      fn(doc.getElementById(id));
      if (broken) { broken = false; setNotice(null); }
      return true;
    } catch (err) {
      broken = true;
      setNotice(`${blockName}里的一次操作没能跑完：${messageOf(err)}。其余部分照常可用。`);
      return false;
    }
  };

  /**
   * 行号那一格的行高（`--df-row-h`）：**权威在样式里，这一本只读一次**（段 5 计划 Task 5 的口径 2）。
   * `dev/sass/toolDiff.scss` 在容器上写 `--df-row-h`，跳转那一枚换算 `scrollTop` 与样式那边的行块
   * 高度要的是同一个整数；读不到、或读出来不是「≥1 的整数像素」就退回 24——那个 24 就是装配层
   * `ROW_HEIGHT` 的值，两边同源靠的是 `env.rowHeight` 那一道闸门（给了非法值当场 `RangeError`），
   * 不是靠注释约定。
   * @returns {number} 整数像素
   */
  const rowHeightPx = () => {
    let raw = '';
    try { raw = String(win.getComputedStyle(box).getPropertyValue('--df-row-h') || '').trim(); } catch { raw = ''; }
    const m = /^(\d+)px$/.exec(raw);
    const v = m ? Number(m[1]) : NaN;
    return Number.isInteger(v) && v >= 1 ? v : 24;
  };

  const wb = createDiffWorkbench({
    document: doc,
    Tk: tk,
    prefix,
    runGuarded,
    navigator: win.navigator,
    later: (fn, ms) => setTimeout(fn, ms),
    rowHeight: rowHeightPx(),
    readFile: fileReaderOf(win),
    decode: decodeOf(win),
    // 这三件必须给**工厂**，不能给裸构造器：装配层按 `env.BlobCtor(parts, options)` 的写法调用它
    //（Z14 的红线之一「本层不写 `new Blob`」），而 `Blob` 是 WebIDL 接口，不带 `new` 直接调在浏览器里
    // 必抛 `TypeError: Failed to construct 'Blob'`。§Z 的假 DOM 给的是箭头函数，所以那二十七判一条
    // 都抓不到这件事——真浏览器里点「下载 .diff」就是那一行红字，而页面上没有任何一次下载发生过。
    BlobCtor: (parts, options) => new win.Blob(parts, options),
    createObjectURL: (b) => URL.createObjectURL(b),
    revokeObjectURL: (u) => URL.revokeObjectURL(u),
  });
  return wb.mount();
}

/**
 * 启动一次，并把失败写进页面上那句话。
 * @param {object} doc 真 `document`
 * @param {object} win 真 `window`
 * @returns {object|undefined} 成功时是 `mount()` 的两份清单，失败时 `undefined`（但仍会抛）
 */
function start(doc, win) {
  try {
    return boot(doc, win, win.Tk);
  } catch (err) {
    const el = noticeNode(doc, doc.getElementById(CONTAINER_ID));
    if (el) {
      el.hidden = false;
      el.textContent = `这一页的交互层没能启动：${messageOf(err)}。正文仍然读得到，只是按钮与下拉不会有反应。`;
    }
    throw err;
  }
}

start(document, window);
```
---

## Task 6：页面源 + `toolDiff.scss` + 第四枚图标 + yml 登记（收录面）

**Files：** Create `tools-diff.html`、`dev/sass/toolDiff.scss`、`assets/img/tools/diff-tool.svg`；
Modify `_data/onlineTools.yml`（追加一条 `slug: diff`）、`postcss.config.js`（加 `'.df-'`）、
本计划。

- [x] **Step 1：写 `tools-diff.html`**——`layout: default` + `title` / `seo_description` / `permalink`，
      骨架**全部构建期渲染**（禁 JS 读得到正文与六句说明），两条 `<script>` 排正文之后
      （`toolkitCore.min.js` 在前，顺序与 `tools-json.html` 同一条硬前提），四格 `data-df-*` 属性、
      六族 id、十四枚按钮的文案与 `DIFF_ACTIONS[i].label` 逐字同（门禁⑤那条按钮文案对账就是为它设的）。
      落 **345 行 / 25,541B**。id 合计 **33 格** = 11 控件 + 6 节点 + 2 枚 `data-df-when` + 14 枚按钮，
      全部从 `{%- assign wbp = 'workbench' -%}` 与 `{{ tk.prefix }}` 拼出，正文里零处 `df-` 字面量 id。
      **本格踩到的一处真缺陷（构建退 0 而整块版面不见）**：第一版那一轮两栏循环写成
      `{%- for side in (array: 'a,b') -%}`——那是 Shopify 主题液的写法，本仓库的 liquid 解析到冒号就报
      `Liquid Warning: Expected dotdot but found colon`，而**报错的 tag 渲染成空**：第一次 `jekyll build`
      退 0，产物里 `grep -c df-area _site/tools/diff.html` 读到 **0**，A/B 两栏整块不存在，
      门禁⑤ 的「DOM」组却一路绿（它比的 `data-df-ids`、按钮文案、`{p}-in-…` 那些判据里，
      凡是能在**别处**找到的都不红，找不到 `df-area` 这一族它反倒没有一条要求"必须存在两栏"）。
      处置见 §0.6 新登记的那一行；改成 `'a,b' | split: ','` 之后同一道警告消失、产物 `df-area` 命中 2、
      `id="df-in-workbench-a-text"` 与 `-b-text"` 各 1。**教训写死**：`bundle exec jekyll build` 的
      输出里那行 `Liquid Warning` 是判据，不是噪声——只看退出码就会把"少了一整块版面"当成构建成功。
- [x] **Step 2：写 `dev/sass/toolDiff.scss`**——本页独有形状；只用 `--ink` / `--ink-2` / `--ink-3`，
      `--ink-4` 不得用于 <18px 正文；`--df-row-h` 是唯一赋值处（照 `--jt-row-h` 那一格，入口读一次）。
      落 **692 行 / 22,944B**。文件头五条口径记着本页独有的两件事：① 行号跳转按 `--df-row-h` 换算，
      所以**每一视觉行必须正好一个 row-h**——`margin` / `border` 一律不给，描边全走 `box-shadow: inset`，
      折叠条与行块一律 `white-space: nowrap`（折一行就多算一行，跳转会偏）；② 配色只用 tokens 语义色
      与 `--tk-ok` / `--tk-warn` / `--tk-bad`，每一处 `color-mix()` 前各写一条纯色退路。
      ≤900 竖排的是**那两条输入栏**，≤640 **不**把并排两栏改成堆叠——这一格与 Step 2（Task 7）
      原句冲突，改道与理由记进 §0.6，Task 7 Step 2 那句跟着改了口。
- [x] **Step 3：`postcss.config.js` 加 `'.df-'`**，并按 §0.5 那条缓存坑自证产物里没有 `vw`。
      黑名单从两串变三串（那一格上方"在线工具三页 / 这两串"的说法同步改成"四页 / 这三串"）；
      自证读数：`grep -o 'vw' assets/css/toolDiff.min.css | wc -l` = **0**，
      `grep -o -- '--df-row-h:[^;]*'` 读到 `--df-row-h: 24px`（原样是 px，没被换成 `0.24rem` 一类）。
      §0.5 那条缓存坑（watch 里的 vite 缓存旧 postcss 配置）本格不构成风险：跑前 `ps` 过，
      本机没有本仓库的 vite/jekyll watcher（只有另一路会话在兄弟仓库跑 vitest）。
- [x] **Step 4：`_data/onlineTools.yml` 追加第四格**（`prefix: df`、`layout: workbench`、`actions: 14`、
      `spec` 四格指针、`panels: []`、`desc` + `features` 五条）。**这一格是全段唯一会让
      每一页 HTML 变长的一笔**，所以 Step 5 之后立刻做一次"改前/改后 `_site` 逐页 diff"，
      差额记进 Task 7 的账（§0.3(b)）。
      yml 从 192 行长到 **229 行 / 16,682B**。逐页差额按"同一份工作树、只差 yml 那一格"量：
      两棵独立副本（`/tmp/diffAB/A` = HEAD 那份 yml 三页、`B` = 工作树那份四页）各跑一次
      `jekyll build`（两边 exit 0、零 Liquid 警告），量具是 `zlib.gzipSync(buf,{level:9}).length`
      与 `stat.size`，口径与 §7 那两行同一把尺。**共同 837 份产物里字节有差的 105 份，正差合计 13,145B gz、
      负差 0B**：逐页看，渲染了顶栏下拉的每一页 **+704 raw / +99~121 gz**（文章页、about、首页都在这族里），
      `tools.html` **+3,342 / +639**、`index-all.html` **+1,048 / +160**、`llms.txt` **+326 / +141**；
      `tools/diff.html` 本身在 A 里是"查无条目"的空正文分支（31,520B），B 里 45,774B。
      **这笔账交 Task 7 Step 5 直接续**：证件页首屏那一格（§7 最小格 544B / 3.3%）的余量必被这 +704 raw
      那一族吃掉一截，重量时以 B 这一侧为准，掉到 300B 以下就按原计划 BLOCKED 交回。
      副本与活树隔离：`rsync -a` 排除 `_site/.git/vendor/node_modules/.jekyll-cache/demo`，
      两份 `--destination` 各指回自己那棵，跑完 `md5 -q _data/onlineTools.yml` 仍等于 B 那份
      （`8787d62…`），活树 `_site/` 一个字节没被这两次构建碰过。
- [x] **Step 5：构建两遍**（`npx vite build` + `bundle exec jekyll build`）→ 门禁④ + 门禁⑤，
      `assets/js/*.min.js` 的 `import{` 命中必须是 0。
      vite：`✓ built in 1m 41s`，新产物两格 `assets/js/toolDiff.min.js` **51,541B / gz 19,842B**、
      `assets/css/toolDiff.min.css` **9,644B / gz 2,185B**（vite 自己那行报的是 `51.54 kB │ gzip: 20.22 kB`
      与 `9.64 kB │ gzip: 2.19 kB`——它按 kB 与 gzip 默认档算，本格 §7 用的是 `gzip -9` 口径，
      两个读数都记下来，别把它们当同一个数）。`import{` 在 `assets/js/*.min.js` 里逐文件
      `grep -c` 全部 0 命中（§0.4 那条共享 chunk 的红线）。
      jekyll 第二遍 35.6s 退 0、零警告。门禁⑤ 退 0：`收录面门禁：4 条 ready（idcard / codec / json / diff）`、
      `导航-全站：核到 101 页`、`✓ 5 组判据全绿`——第四枚图标的八组对比度、33 格 id 对账、
      十四枚按钮文案、features 五条逐条在 `tools.html` 命中，都在这一发里过。
      **门禁④ 本格只跑到"真构建 + `import{` = 0"这一半**：`git archive HEAD` 那份导出树里
      还没有 `tools-diff.html` 与 `toolDiff.scss`（Task 6 的代码格尚未落笔），三列字节表要等
      提交态自证那一格量，记在本节末。
- [x] **Step 6：登记镜像** + `--fix` + 门禁①②③⑥。`FILE_TARGETS` 新增三格
      （`tools-diff.html` / `dev/sass/toolDiff.scss` / `assets/img/tools/diff-tool.svg`，方向照旧：
      跟着磁盘走不跟着计划走）；第四本"yml"不需要新登记——`_data/onlineTools.yml` 从段 2 就在清单里，
      这一格那 37 行由 `--fix` 把段 2 计划里那块整块换过去。同一发里 `--fix` 还换了
      `diffWorkbench.js`（折叠条点开那一处，见下）与磁盘 §Z 两格。
      **本格补的一处真缺陷（折叠条是死按钮）**：spec §5.6 写的是"未变行折叠…**并可点开**"，
      而 Task 5 落地的 `mount()` 只给那三枚快捷键按钮接了线，结果区一次 `click` 监听都没挂——
      画出来的 `<button class="df-fold">省略 N 行 · 展开</button>` 按下去没有反应，
      §Z 那 28 判一条都抓不到（它数的是**画出来的**折叠条，不数"点得动"）。
      修法与判据：`diffWorkbench.js` 加 `onFoldClick`（容器事件代理，只认 `data-{prefix}-skip` 那一枚，
      不用 `querySelector` 也不用 `closest`——Z14 禁前者、§Z 那本假 DOM 没有后者），一发就
      `dispatch('expand')`，与「全部展开」那枚按钮同一条路；测试侧夹具加 `clickFold` / `clickRow`
      两个观察口，落 **Z29**（三子判：负落点不动档、正点开发 'all' 且 `computes` 不涨、
      换前缀 `zx` 之后旧的 `data-df-skip` 不认）。这一档"点开 = 全部展开"不是省事，是**口径只有一个**：
      折叠档住在那枚 `context` 下拉里（Z21），逐块展开要另存一份 per-block 状态，
      而那份状态与 `unifiedText` 的导出会分家。记进 §0.6。
      门禁读数（跑之前 `uptime`：load `16.73 45.62 62.61`，是那种"红要先归因给量具"的档位）：
      ① 全量 `# tests 439 / pass 439 / fail 0` 退 0；② 裸跑退 0（`--fix` 之后第二次跑，见 Step 6 末）；
      ③ `37/37 通过` 退 0，且末尾那句"实验前后工作树的脏指纹一模一样（37 个脏项、diff 指纹 `c566c334a354bfeb`）"
      同时自证了它没碰另一路会话压在那儿的任何一格。
      **⑥ 第一发是红的，而且红得对**：`牙齿台账：60/61`，那一句是
      `✗ tools.html 的徽章数字与数据源脱钩（改模板不改 yml 的形状）：注入后门禁仍是绿的（假牙）`。
      这不是量具的钟——第四格落地之后 `14 个动作` 在 `tools.html` 里出现了**两次**
      （`_site/tools.html` 实测 json 段 698 行、diff 段 740 行；`5 块面板` 同病，616 与 656 行），
      而那三条判据拿的是整页"出现过"，所以只改第一处的变异被第二处替它答了"是"。
      修法与自证：判据的作用域收到每一小节那一段（`toolsSectionOf`，按 `<section>`/`</section>` 计数配平），
      变异刀同步改成 `badgeInSection`（按 `id="online-<slug>"` 定位、没命中就抛），
      并补 codec 那枚 `5 块面板` 与 diff 那一格的四把刀（title / url / 徽章 / `actions`）。
      改完重跑：⑤ 退 0（`4 条 ready` × 5 组全绿、导航核到 101 页），⑥ 台账
      `60/61` → **`66/66`**（`badgeInSection` + codec 那枚 `5 块面板` + diff 那一格四把刀），
      再补一刀「tools.html 少整节」之后 **`67/67`** 退 0，末尾"全部变异已还原，复跑基线那发仍绿"。
      那把多出来的刀钉的是新写的**早退分支**本身有牙：整节缺席时只记一句
      「没有这一条的 tool-section--online 小节」然后交回，不再逐格比（否则一节不在会连带报五条
      "这格里找不到"）——`expect` 就点这一句，而 `dropSection` 的边界算法与门禁的 `toolsSectionOf`
      逐字同源，两把尺同一口径，这一刀才证得了"门禁找的那一段就是页面上那一段"。
      判据一条没放宽、也没有改成 `replaceAll`——理由与那一行偏差记在 §0.6 倒数第三行。
      `--fix` 那一发另外连带重写了**段 2** 那份计划里 `check-tools-surface.mjs` 的整文件镜像
      （`14265 → 14301 行`，8 处替换全在那一块里）：那本脚本从段 2 起就是镜像目标，
      方向照旧跟着磁盘走。
- [x] **Step 7：提交** `feat(tools): 段 5 Task 6 第四页收录面——tools-diff.html + toolDiff.scss + yml 登记`。
      pathspec 十三格：新增三格 `tools-diff.html` / `dev/sass/toolDiff.scss` /
      `assets/img/tools/diff-tool.svg`，改动十格 `_data/onlineTools.yml` / `postcss.config.js` /
      `dev/js/tools/diffWorkbench.js`（折叠条点开那一处）/ `scripts/toolkit-tests.mjs`（§Z 到 29 判）/
      `scripts/verify-plan-blocks.mjs`（`FILE_TARGETS` 新增那三格）/ `scripts/check-tools-surface.mjs`
      与 `scripts/check-tools-surface-teeth.mjs`（徽章判据收段内 + 五把新刀，见 Step 6 末）/
      本计划 / **另外两份计划**（各只被 `--fix` 换掉镜像块：段 1 的 §A 用例分布表、段 2 的
      `check-tools-surface.mjs` 整文件；段 2 那发同时把 `_data/onlineTools.yml` 那块换成四格内容）。
      提交态自证（含门禁④ 那三列字节表）记在本节末的下一格。

### 落地镜像（门禁二核的就是这一块，`--fix` 会把它整块换成磁盘内容）

Task 2/3/4/5 那四节立的规矩在这里照用：只有**整文件**镜像允许用与扩展名对应的围栏
（`html` / `scss` / `svg` / `yaml`，`LANG_BY_EXT` 那张表两头各一次映射），贴的时候直接由磁盘内容生成，
事后跑一次 `--fix` 复验它已经全等。

本段登记的第四格镜像（`_data/onlineTools.yml`）不在这里，它在段 2 那份计划里——同一份磁盘内容
在两棵计划树里各有一块镜像时，`--fix` 会把**两处**都换成磁盘内容，所以那一格的字节账跟着
本提交走，本计划里不重贴第二遍（重贴就是第三个现场）。

#### `tools-diff.html`（整文件，345 行）

它是 33 格 id 与十四枚按钮文案的**第二现场**：门禁⑤ 读的是 `_site` 产物，改一句按钮文案构建不会红
（它比的就是源与产物的对应），而这一格镜像让"改了页面没改 spec"这一步留下字节证据。
本页独有的三处也只活在这里：A/B 两栏由一轮 `for` 生成（Step 1 记录里那个 `(array: …)` 的坑
就写在这段注释里，作为它自己的现场见证）、`context` 那枚下拉第一档**显式 `selected`**
（禁 JS 读到的默认档必须与 `DEFAULTS.context` 同档，否则页面与运行时各说一遍默认值）、
`.df-out` 那一格是**唯一**滚动容器（跳转换算的前提，样式若把滚动分给两栏，Z22 量的算术就假了）。

```html
---
layout: default
title: 文本对比工具 · 两份文件差异与JSON比对
seo_description: 两份文本并排逐行对齐，改动行再做行内逐字高亮，未变行折叠成「省略 N 行」；另有行内视图与按 JSON 值比对的档。粘贴或选本地文件都在浏览器里读，不上传、不发请求。
# 理由同 tools-idcard.html：写死 permalink 才能进站点地图、才能让 canonical 与导航一致。
permalink: /tools/diff.html
# tool 指向 _data/onlineTools.yml 里的那一条：大标题、id 前缀、动作枚数都从数据源取，
# 页面正文与顶栏下拉、/tools.html 小节因此不会各写一遍。
tool: diff
---
{% include header.html %}

<!-- 产物名严格跟随源文件名（大小写原样）：dev/sass/toolkit.scss -> toolkit.min.css、
     dev/sass/toolDiff.scss -> toolDiff.min.css、dev/js/toolkitCore.js -> toolkitCore.min.js、
     dev/js/toolDiff.js -> toolDiff.min.js。GitHub Pages 在 Linux 上构建，写错一个字母
     本地看不出来、线上一律 404，勿改。

     两本 CSS 的先后与编码页、JSON 页同一条口径：公共层在前、本页独有层在后。
     `toolkit.min.css` 供的是 .tk-content / .tk-btn / .tk-field / .tk-out / .tk-help 这一族，
     `toolDiff.min.css` 只补 .df-* 那一族本页独有的形状（两栏行流、折叠条、行内高亮、变更表），
     同名规则一条都不许有——公共层是段 1 立好的，本段一个字节都不动它（§0.5：证件页首屏
     余量只剩几个百分点，往共用层加一条就是把两页的预算一起改坏）。

     它们排在 header include **之后**而不是 <head> 里（同 JSON 页 :21 那条口径）：§7 首屏那一格
     判的是"本页新加进阻塞集的东西"，搬进 <head> 就是当场给这一页添一件阻塞件。

     两条 <script> 的先后是硬前提：toolkitCore 先挂 window.Tk，入口再读它。 -->
<link rel="stylesheet" href="{{ site.baseurl }}/assets/css/toolkit.min.css">
<link rel="stylesheet" href="{{ site.baseurl }}/assets/css/toolDiff.min.css">

{%- assign tk = site.data.onlineTools | where: 'slug', page.tool | first -%}
{%- if tk -%}
{%- comment -%}
这一页只有一个工作区（`layout: workbench`：没有索引条，控件清单只活在装配层那张 `DIFF_SPEC` 里），
所以那一块的短名在这里手打一次。它是 `DIFF_PANEL_IDS` 的第二处声明处——下面 33 格 id 全部从这一枚
变量拼出，改这一行整页跟着换；而 `data-df-ids` 那一格与它必须同值，门禁⑤「DOM」组拿
`data-df-ids` 比 `DIFF_PANEL_IDS.join(',')`，不一致红在门禁而不是红在页面上。
{%- endcomment -%}
{%- assign wbp = 'workbench' -%}

<section class="g-masthead">
    <div class="g-container masthead-inner">
        <p class="kicker">Online Tools / 本地计算，不上传输入</p>
        <p class="masthead-issue" aria-hidden="true">
            <span class="issue-rule"></span>
            <span class="issue-no">并排 · 行内 · 折叠 · JSON 按值</span>
        </p>
        <h1 class="masthead-title">{{ tk.h1 }}</h1>
        <p class="masthead-lede">{{ tk.desc }}</p>
        {%- comment -%}
        这三格读数**不许**照抄 JSON 页那一族（那一页第三格是「1000 层深度闸门」，是它自己的
        `MAX_DEPTH`；这一页没有深度闸门这一说，只有行级与行内两级预算）。三个数各有出处，
        抄错就不是一句难堪的话而是一句假话：
          · `tk.actions` 由门禁⑤ 比 `DIFF_ACTIONS.length`（本段实测 14）；
          · 5 MiB 与 20 万行是 `dev/js/tools/diff-core.js` 的 `MAX_INPUT_BYTES`(5242880) /
            `MAX_INPUT_LINES`(200000)，**每一侧各一份**，所以第二格写的是「单侧上限」。
            重算口径：`node -e 'const M=await import("./dev/js/tools/diff-core.js");console.log(M.MAX_INPUT_BYTES/1048576, M.MAX_INPUT_LINES)'`
        这里也不写「0 网络请求」：那一格在 09-29 已被改口成「输入不出本机」，理由写在 tools.html
        的徽章注释里（每一页的 head 都还带着图标字体与统计两条外链）。
        {%- endcomment -%}
        <ul class="masthead-stats">
            <li><strong>{{ tk.actions }}</strong><span>个动作</span></li>
            <li><strong>5 MiB</strong><span>单侧输入上限</span></li>
            <li><strong>20 万</strong><span>单侧行闸门</span></li>
        </ul>
    </div>
</section>

<main class="g-container tk-content" id="main">
    {%- comment -%}
    这一段与证件页、编码页、JSON 页那几处的角色相同：§5.5 的"固定一行提示"在**禁用脚本时也读得到**
    的那一份。这一句比 JSON 页那一句还好写：这一页**根本没有存储**——不做「记住上次输入」，
    `toolDiff.js` 与 `diffWorkbench.js` 两本里 `localStorage` 与 `Date.now(` 各出现 0 次
    （§Z 的 Z15 钉的就是这一格，它是数出来的、不是承诺出来的）。所以这里可以整句写"不读写"，
    而不必像 JSON 页那样补一句"勾了才写本机"。
    剪贴板那一格也要说准：这一页只**写**（复制差异、栏内复制），从不**读**剪贴板。
    {%- endcomment -%}
    <p class="tk-compliance">
        本页的对齐、行内高亮与 JSON 比对全部在浏览器里算：<strong>不发请求、不上传、不读剪贴板</strong>。
        粘贴、拖放、选本地文件三条路都在这一台机器上完成；单侧输入上限 5 MiB、20 万行，
        超限整体拒绝并说明超了多少，不截断悄悄算。<strong>不读写 localStorage</strong>：
        这一页没有"记住"这一档，关掉标签就什么都不剩。
    </p>
    <noscript>
        <p class="tk-compliance tk-compliance--noscript">
            脚本没有执行：两个粘贴框、十四枚按钮与那三枚下拉都在，但对比要在浏览器里算，
            按下不会出结果；右侧那一栏空着是预期，不是坏了。正文这几段与下面那六句口径说明照常读得到。
        </p>
    </noscript>
    {%- comment -%}
    坏消息那一格：入口的 `runGuarded` 与启动失败共用它（`toolDiff.js` 口径 3 与 4），默认 hidden，
    由脚本覆写。这一页没有面板错误条——那一块区域就是整页，所以坏消息只写这一句，
    其余部分照常可用。
    {%- endcomment -%}
    <p class="tk-notice" id="{{ tk.prefix }}-notice" hidden></p>

    <div class="df-workspace" id="{{ tk.prefix }}-workspace"
         data-df-ids="workbench" data-df-prefix="{{ tk.prefix }}"
         data-df-label="{{ tk.h1 }}" data-df-notice="{{ tk.prefix }}-notice">
        {%- comment -%}
        三栏：A 与 B 各是一栏输入，第三条 `.df-side--bar` 装控制栏与结果区。
        ≤900px 收成上下堆叠（`toolDiff.scss` 文末那一组）。

        表单一律用 div[role=group] 而不是 form：没有后端可交，form 的隐式提交会把整页刷成
        ?df-in-workbench-a-text=…，而那一串里装的正是用户粘进来的两份内容——这一页最不该发生的事。
        动作只由按钮的 click 承担（`diffWorkbench.js` 的 `mount`），所以这一页**不写** .tk-kbd
        那一句：装配层没接 Enter 也没接 ⌘+Enter（裸 Enter 在 textarea 里必须是换行），
        写一句不存在的捷径比不写更坏。

        两栏的 id 短名里编了栏位（`a-text` / `b-file`），而不是把栏位做成 id 的一维：
        门禁⑤ 的控件公式 `{p}-in-{面板}-{控件}` 没有栏位那一格，多塞一维就红（§0.6 记的偏差）。

        那一轮 `for` 的清单走 `'a,b' | split: ','`，不走 `(array: 'a,b')`：后一种是 Shopify 主题液的
        写法，本仓库的 liquid（Jekyll 4 那份）解析到冒号就报 `Expected dotdot but found colon`，
        而**报错的 tag 渲染成空**——2026-10-01 现场：产物里 `df-area` 零命中，A/B 两栏整块不见，
        构建退 0、页面看着只是一段空正文。（同一段警告在 `bundle exec jekyll build` 的输出里，
        别只盯退出码。）
        {%- endcomment -%}
        {%- assign df_sides = 'a,b' | split: ',' -%}
        {%- for side in df_sides -%}
        {%- assign S = side | upcase -%}
        <section class="df-side df-side--{{ side }}" aria-labelledby="{{ tk.prefix }}-h-{{ side }}">
            <h2 class="df-side__title" id="{{ tk.prefix }}-h-{{ side }}">{{ S }} 侧输入</h2>
            <div class="tk-form df-doc" role="group" aria-labelledby="{{ tk.prefix }}-h-{{ side }}">
                <div class="tk-field tk-field--wide">
                    <label for="{{ tk.prefix }}-in-{{ wbp }}-{{ side }}-text">{{ S }} 侧文本</label>
                    {%- comment -%}
                    这一族粘贴框**不带行号槽**（`DIFF_SPEC` 里那两格写的 `gutter: false`）：
                    行号在这一页住在结果区的行块里，输入区的行号对"两份待比文本"没有意义——
                    而且两侧行数不等时，两套行号会各自数一遍，读的人先要分辨哪一套是哪一侧的。
                    门禁⑤ 那一格退出闸就是为这一档开的（段 5 §0.3）。
                    {%- endcomment -%}
                    <textarea class="df-area" id="{{ tk.prefix }}-in-{{ wbp }}-{{ side }}-text" rows="14"
                              autocomplete="off" autocorrect="off" autocapitalize="off"
                              spellcheck="false" placeholder="把第 {{ S }} 份内容贴在这里，或从文件管理器拖一个进来"></textarea>
                    {%- comment -%}
                    读数那一格由 `refreshGate` 整段重写成「N 行 · 大小」，静态值只是禁用脚本时的
                    那一份真相（空输入：0 行 · 0.0 KB，与挂载后第一次读数逐字同形）。
                    同侧那枚栏内复制按钮走的是 `copy` 节点族（`df-copy-…-a`），灰不灰由浏览器
                    有没有 `navigator.clipboard` 决定，不靠这行字承诺。
                    {%- endcomment -%}
                    <p class="df-status" id="{{ tk.prefix }}-status-{{ wbp }}-{{ side }}"
                       aria-live="polite">0 行 · 0.0 KB</p>
                    <span class="tk-help">这一格只数行与字节，不对齐。按「重新对比」才算一次。</span>
                    <div class="df-namerow">
                        <label class="df-namerow__label" for="{{ tk.prefix }}-in-{{ wbp }}-{{ side }}-name">文件名</label>
                        {%- comment -%}
                        那一格是**可编辑**的：它写进复制与下载得到的那一份 unified 文本的
                        `--- a/xxx` 行，也显示在状态读数里。选文件时装配层会把真名填进来，
                        但用户改它不会有任何一处报错——它只是那一份导出的署名。
                        {%- endcomment -%}
                        <input class="df-name" id="{{ tk.prefix }}-in-{{ wbp }}-{{ side }}-name" type="text"
                               autocomplete="off" spellcheck="false" placeholder="例如 left.txt">
                    </div>
                    <div class="df-filerow">
                        <label class="df-filerow__label" for="{{ tk.prefix }}-in-{{ wbp }}-{{ side }}-file">本机文件</label>
                        {%- comment -%}
                        故意不写 `accept`：这一页读的是字节再判编码（UTF-8 与 NUL 两道），
                        扩展名过滤会把 `.log`、无扩展名的文件、以及用户自己知道的文本挡在门外，
                        而"是不是文本"这件事本机那一次读取才答得上来。
                        {%- endcomment -%}
                        <input class="df-file" id="{{ tk.prefix }}-in-{{ wbp }}-{{ side }}-file" type="file">
                        <button class="tk-btn tk-btn--ghost" type="button"
                                id="{{ tk.prefix }}-btn-{{ wbp }}-file{{ side | upcase }}">选 {{ S }} 侧文件</button>
                        <button class="tk-btn tk-btn--ghost" type="button"
                                id="{{ tk.prefix }}-copy-{{ wbp }}-{{ side }}">复制这一栏</button>
                    </div>
                    <span class="tk-help">那一枚按钮打开的是旁边这台选择器；文件只在这一台机器上读，读完把正文填进上面的框。</span>
                </div>
            </div>
        </section>
        {%- endfor -%}

        <section class="df-side df-side--bar" aria-labelledby="{{ tk.prefix }}-h-bar">
            <h2 class="df-side__title" id="{{ tk.prefix }}-h-bar">对比与控制</h2>

            {%- comment -%}
            按钮文案与 `DIFF_ACTIONS[i].label` 逐字相同（门禁⑤「DOM」组那一族对账量的就是这两处
            同字）。分组按 `group` 那五族走：run / fold / goto / file / copy，其中 file 那两枚
            画在上面两栏里（id 不含栏位，位置跟着语义走更省事），copy 那两枚分在这里与上面。
            折叠那三枚是 `context` 下拉的**快捷键**：写回同一枚 select、不另存一份状态（红线 6），
            所以它们的文案与下拉那三档用同一批词，用户读到的是同一件事的两种按法。
            {%- endcomment -%}
            <div class="df-bar">
                <div class="df-bar__group df-bar__group--mode" role="group" aria-label="口径与视图">
                    <span class="df-opt">
                        <label for="{{ tk.prefix }}-in-{{ wbp }}-mode">口径</label>
                        {%- comment -%}
                        `<option>` 的 value 必须与 `DIFF_SPEC` 里那三格的 `options` 逐个对应
                        （mode: text/json；layout: side/inline；context: diff/3/5/all）：
                        文案归 HTML、取值归装配层。选错一档时 `selectOf` 那一句当场抛上去
                        （红线 5 的第二条路），而不是安静地按另一档算。
                        第一枚 `<option>` 就是**默认档**：`DEFAULTS` 是 mode=text、layout=side、
                        context=3，而 `CONTEXT_VALUE` 的键序是 diff/3/5/all——照键序排下来的话
                        第一档成了「只看差异」，禁 JS 读到的默认档与启 JS 算出来的默认档就此分家。
                        所以那一格必须显式 `selected`。
                        {%- endcomment -%}
                        <select id="{{ tk.prefix }}-in-{{ wbp }}-mode">
                            <option value="text">按文本逐行</option>
                            <option value="json">按 JSON 值</option>
                        </select>
                    </span>
                    <span class="df-opt">
                        <label for="{{ tk.prefix }}-in-{{ wbp }}-layout">视图</label>
                        <select id="{{ tk.prefix }}-in-{{ wbp }}-layout">
                            <option value="side">并排两栏</option>
                            <option value="inline">行内单栏</option>
                        </select>
                    </span>
                    <span class="df-opt">
                        <label for="{{ tk.prefix }}-in-{{ wbp }}-context">上下文</label>
                        <select id="{{ tk.prefix }}-in-{{ wbp }}-context">
                            <option value="diff">只看差异</option>
                            <option value="3" selected>上下文 3 行</option>
                            <option value="5">上下文 5 行</option>
                            <option value="all">全部展开</option>
                        </select>
                    </span>
                </div>

                {%- comment -%}
                两枚模式说明挂在 `data-df-when` 上：装配层的 `syncGate` 只按
                `DIFF_SPEC…switch.targets` 那一族翻 `hidden`，所以它在另一档里是整段消失，
                不是留下一句没人答的话。`[hidden]` 那一行样式在 toolDiff.scss 里显式补过——
                `.tk-help` 本身没有 display 声明，UA 默认顶得住，但那一条依赖的是"没人给它写
                display"，写死更省事（JSON 页 `.jt-query[hidden]` 同一条口径）。
                {%- endcomment -%}
                <p class="tk-help df-mode" id="{{ tk.prefix }}-when-{{ wbp }}-text" data-df-when="text">
                    文本档：两侧按行对齐，改动行再做行内逐字高亮，未变行按上面那一档折叠。
                    粘贴框里贴什么读什么，不挑语言、不解析语法。
                </p>
                <p class="tk-help df-mode" id="{{ tk.prefix }}-when-{{ wbp }}-json" data-df-when="json">
                    JSON 档：两侧各读一份，再按<strong>值</strong>逐格比，所以格式化、键顺序、缩进这些
                    写法差异都不算改动；坏 JSON 会点名是第几行第几列，并让你切回文本档。
                    这一档没有"第几处差异"与"上下文"，那六枚按钮跟着灰着。
                </p>

                <div class="df-bar__group" role="group" aria-label="对比动作">
                    <button class="tk-btn" type="button"
                            id="{{ tk.prefix }}-btn-{{ wbp }}-compare">重新对比</button>
                    <button class="tk-btn tk-btn--ghost" type="button"
                            id="{{ tk.prefix }}-btn-{{ wbp }}-swap">交换两侧</button>
                    <button class="tk-btn tk-btn--ghost" type="button"
                            id="{{ tk.prefix }}-btn-{{ wbp }}-clear">清空输入</button>
                    <button class="tk-btn tk-btn--ghost" type="button"
                            id="{{ tk.prefix }}-btn-{{ wbp }}-reset">恢复默认档</button>
                </div>

                <div class="df-bar__group" role="group" aria-label="折叠与跳转">
                    <button class="tk-btn tk-btn--ghost" type="button"
                            id="{{ tk.prefix }}-btn-{{ wbp }}-expand">全部展开</button>
                    <button class="tk-btn tk-btn--ghost" type="button"
                            id="{{ tk.prefix }}-btn-{{ wbp }}-fold">上下文三行</button>
                    <button class="tk-btn tk-btn--ghost" type="button"
                            id="{{ tk.prefix }}-btn-{{ wbp }}-diffOnly">只看差异</button>
                    <span class="df-bar__sep" aria-hidden="true"></span>
                    <button class="tk-btn tk-btn--ghost" type="button"
                            id="{{ tk.prefix }}-btn-{{ wbp }}-firstDiff">第一处差异</button>
                    <button class="tk-btn tk-btn--ghost" type="button"
                            id="{{ tk.prefix }}-btn-{{ wbp }}-prevDiff">上一处</button>
                    <button class="tk-btn tk-btn--ghost" type="button"
                            id="{{ tk.prefix }}-btn-{{ wbp }}-nextDiff">下一处</button>
                </div>

                <div class="df-bar__group df-bar__group--opt" role="group" aria-label="归一化与导出">
                    <span class="df-opt df-opt--check">
                        <label for="{{ tk.prefix }}-in-{{ wbp }}-ws">
                            <input id="{{ tk.prefix }}-in-{{ wbp }}-ws" type="checkbox"> 忽略空白
                        </label>
                    </span>
                    <span class="df-opt df-opt--check">
                        <label for="{{ tk.prefix }}-in-{{ wbp }}-case">
                            <input id="{{ tk.prefix }}-in-{{ wbp }}-case" type="checkbox"> 忽略大小写
                        </label>
                    </span>
                    <span class="df-bar__sep" aria-hidden="true"></span>
                    <button class="tk-btn tk-btn--ghost" type="button"
                            id="{{ tk.prefix }}-btn-{{ wbp }}-copyDiff">复制差异</button>
                    <button class="tk-btn tk-btn--ghost" type="button"
                            id="{{ tk.prefix }}-btn-{{ wbp }}-download">下载 .diff</button>
                </div>
            </div>

            <div class="tk-outwrap">
                {%- comment -%}
                这一栏的正文全部由装配层写进来（`paint` 是整页**唯一**一处 `innerHTML` 出口，
                结论、读数、两块行流、折叠条与代价说明都从它走），骨架给的是**空的**那一格。
                它同时是本页唯一的滚动容器：跳转那三枚算的是 `scrollTop = 视觉行数 × 行高`，
                行高的权威在 `toolDiff.scss` 的 `--df-row-h`，由入口读一次注入（Z15 数那一格）。
                所以这一格的高度必须写死在样式里而不是随内容长——没有滚动就没有上界，
                那三枚按钮就永远跳不动（同 JSON 页 `.jt-tree` 那一段的理由）。
                `aria-live="polite"` 与另三页同档：一次动作换一栏，不该打断用户正在读的东西。
                {%- endcomment -%}
                <p class="df-status df-status--bar" id="{{ tk.prefix }}-status-{{ wbp }}-bar"
                   aria-live="polite">还没有比较</p>
                <div class="tk-out df-out" id="{{ tk.prefix }}-out-{{ wbp }}-bar"
                     role="region" aria-live="polite" aria-labelledby="{{ tk.prefix }}-h-out"></div>
            </div>
            <h2 class="df-side__title df-side__title--sr" id="{{ tk.prefix }}-h-out">差异结果</h2>
        </section>
    </div>

    {%- comment -%}
    下面那六句是**页内静态口径**：与结果区里那一列 `df-notes` 不重复，两处的职责不同——
    这一列说的是"这一页在哪一档上打了折"（永远全量、禁脚本也读得到），结果区那一列由
    `notesOf()` 只挑**这一次真的发生了**的那几句（degraded、inlineSkipped、ignored、
    finalNewline 各按条件出现，末尾两句恒定）。把两处并成一处只有两种坏结果：
    静态那一列被运行时覆盖，或运行时那一列变成永远全量。措辞同源但不是一个句子，
    改这一列不必改 `DIFF_NOTES`，反之也一样。
    {%- endcomment -%}
    <section class="df-terms" aria-labelledby="{{ tk.prefix }}-h-terms">
        <h2 class="tk-panel__title" id="{{ tk.prefix }}-h-terms">这一页在哪一档上打了折</h2>
        <ol class="df-terms__list">
            <li>行对齐用的是本站自实现的 Myers 最短编辑脚本，代价上限 2000：越线那一段按「整块删 + 整块增」给出，行数一行不会少，只是不再替你把最相似的行两两配起来。</li>
            <li>行内逐字高亮另有一道预算（单对 4000 个 token、整篇三百万格）：越线的那些行只按整行着色，读数里写「未行内 N」告诉你少了多少。</li>
            <li>折叠只是阅读形状：只看差异 / 上下文 3 行 / 5 行 / 全部展开四档改变"看到多少行"，不改变差异本身；复制与下载走的是你当前这一档。</li>
            <li>勾了「忽略空白」或「忽略大小写」之后，"相同"是一个被归一化过的结论：那些行的原文仍有差别，只是没有计入差异统计，被抹平的行数单列在读数里。</li>
            <li>「复制差异」与「下载 .diff」得到的是一份按阅读习惯排的 unified 形状文本，不承诺能被 <code>git apply</code> 接住——本站不校验上下文行，也不生成可打的补丁。</li>
            <li>两份内容都只在这一台机器上读：粘贴、拖放、选本地文件三条路都不发请求、不上传；这一页也不读写 localStorage，关掉标签什么都不留下。</li>
        </ol>
    </section>
</main>

{%- comment -%}
脚本两条：toolkitCore 把跨页共用的视图层与交互层挂成 window.Tk（这一页只吃 `view.esc` 那一格），
入口只装配本页业务。两条都不 defer、不加 type=module：产物是 iife 包过的经典脚本，
且必须排在正文之后——HTML 解析到这里时骨架节点已经存在，装配层第一件事就是去找那 33 格 id。
`diffView.js` / `diffWorkbench.js` 已经打进 `toolDiff.min.js` 这一本里，**绝不再挂进 window.Tk**：
两个入口 reach 同一模块，Rollup 切出带 `import{` 的共享 chunk，整页 SyntaxError 而构建退 0。
{%- endcomment -%}
<script src="{{ site.baseurl }}/assets/js/toolkitCore.min.js"></script>
<script src="{{ site.baseurl }}/assets/js/toolDiff.min.js"></script>

{% include footer.html %}

{%- else -%}
{%- comment -%}
_data/onlineTools.yml 里查不到本页那一条时，宁可产出一个空正文的页面，也不要让 jekyll build 红在
一个 Liquid 空值上：空正文会立刻被收录面门禁的「页面源」与「DOM」两组判据抓住。
{%- endcomment -%}
<main class="g-container tk-content" id="main">
    <p class="tk-compliance">_data/onlineTools.yml 里缺少 slug 为 <code>{{ page.tool }}</code> 的条目。</p>
</main>
{% include footer.html %}
{%- endif -%}
```

#### `dev/sass/toolDiff.scss`（整文件，692 行）

全仓库 `--df-row-h` 的**唯一赋值处**，与 `toolJson.scss` 的 `--jt-row-h` 同一族：入口 `rowHeightPx()`
读它一次注进 `env.rowHeight`，§Z 的 `scrollTop` 换算与样式画的行高共用那一个整数。
这一格镜像独扛两条只有字节才看得见的口径：① 那一把尺如果被 px→vw 改写（postcss 黑名单少一串），
入口读到的整数与浏览器画出的高度分两半，而 §Z 一条都不会红；② ≤640 那一档"不堆叠"的决定
只有写在样式里才是决定——注释与 §0.6 那行都会过期，这一格是它能被复核的那一份。

```scss
/*** 文件对比页（/tools/diff.html）那一层的形状***/
//
// 一、这一本只管 `.df-*` 那一族，公共层 `.tk-*` 一律不在这里重写（§0.5：`toolkit.scss`
// 本段一个字节都不加——它此刻被另一路会话改着，而且证件页首屏的余量只剩几个百分点，
// 往共用层加一条就是把两页的预算一起改坏）。需要公共形状的地方直接用那些类名：
// `.tk-content` `.tk-compliance` `.tk-notice` `.tk-btn` `.tk-btn--ghost` `.tk-field`
// `.tk-help` `.tk-outwrap` `.tk-out`，本页新增的是骨架、两栏行流、行内高亮、折叠条、
// 结论与读数、JSON 变更表这六族形状。
//
// 二、px 与视口：`postcss.config.js` 的黑名单里本段加了 `'.df-'` 那一串（Task 6 Step 3），
// 本文件不改别的。这条黑名单对这一页不是风格问题而是**正确性**问题：
// `--df-row-h` 是行块、折叠条与跳转换算唯一的那把尺，入口 `toolDiff.js` 读它一次、注入
// `env.rowHeight`，装配层 `goTo()` 拿那个整数算 `scrollTop = 视觉行数 × 行高`。一旦这一格被
// 换算成 vw，读回来的串就不是 `^\d+px$` 的形状，入口退回 24 而样式画的是另一个数——
// 每按一次「下一处」差半行到一行，而构建、门禁①②③⑤⑥ 全都不会红。
// 推论一：任何写了 px 的新规则，选择器文本里必须带 `.df-` 子串（黑名单按子串命中）。
// 推论二：`@keyframes` 是唯一罩不住的地方（关键帧的"选择器"是 0%/to），所以**本层不写动画**。
// 推论三是这一层真正的算术前提：`.df-row` / `.df-fold` 的每一"视觉行"必须**正好**占
// `--df-row-h`，`margin`、`border` 与行盒之外的任何东西都会把那份换算读歪。所以那两族一律
// `box-sizing: border-box` + `height` + 零 margin，需要描边处一律 `box-shadow: inset`（不占位）。
// 唯一没被换算算进去的是结论与读数那两行（它们在行流之前，`goTo()` 不知道它们多高）：
// 误差方向只会让目标块落在视口**更下面**，永远不是被顶出去，所以这一格取"保守可见"；
// 把这两行压到各一行（`white-space` 默认允许折，折了也只是误差变大一点，不改变方向）。
//
// 三、配色只走 tokens.scss 的语义变量与 toolkit.scss 已经立好的三档状态色（`--tk-ok/warn/bad`
// 在 `:root` 与 `body.night-mode` 各写一遍，夜间值由那一层给全），本层不写颜色字面量、
// 也不写 `.night-mode` 分支。墨阶只用 `--ink` / `--ink-2` / `--ink-3`：§6.4 那条
// "10.5–13px 的正文性文字不许取 `--ink-4`"在本层同样成立（那一档实测 3.78:1，够不到 AA）。
// 删 / 增 / 改三档的**底色**用 `color-mix()` 从既有语义色里推（不新造色名，因此夜间自动跟着转），
// 每条都先写一条纯色退路：不支持 `color-mix()` 的浏览器留住 `--surface-2` 那一档，
// 底色仍在，只是分不出色相——而色相从来不是唯一那把尺，行左侧那道 3px 的 inset 竖条
// 与 `+` / `-` 前缀（`.df-row__no` 之后由底色与竖条一起承担）在任何一档都画得出。
//
// 四、样式不认识 JS 的运行状态，只认识 ARIA、`hidden` 与节点在不在。本页的显隐只有一族：
// `data-df-when` 那两段模式说明，由 `diffWorkbench.js` 的 `syncGate()` 翻 `hidden` 布尔属性。
// `.df-mode[hidden]` 那一格**必须**显式写：作者样式恒胜 UA 的 `[hidden]{display:none}`，
// 而 `.df-mode` 后面要挂 `margin` 与 `max-width`——不补这一条，切到 JSON 档时文本档那句
// 说明会留在屏幕上，读起来像"两档同时成立"。
// `.df-out` 的高度写死在这一格是第四格那条前提的另一半：装配层只往这一格里写 `innerHTML`，
// 跳转靠的是这只容器自己的 `scrollTop`；不给高度就没有滚动条，`scrollTop` 恒 0，
// 那三枚按钮按下去什么也不发生，而 §Z 的每一判一条都不红（假 DOM 里 `scrollTop` 是个普通属性）。
//
// 五、独立入口拿不到 `$font-display` / `$font-meta`（vite 按 dev/sass/*.scss 逐个打包，
// @import tokens 会把整层令牌复制进本产物）。下面重复的是**字族名**，不是字体文件——
// `@font-face` 归 index.min.css，缺字退 Georgia / SF Mono，中文由栈尾接手。同 toolkit.scss 第四条。

$df-meta: 'IBM Plex Mono', 'SF Mono', 'JetBrains Mono', Menlo, Consolas, 'Courier New', monospace;

// ── 骨架：三栏工作台 ──────────────────────────────────────────────────────

.df-workspace {
    // 唯一那把尺。写在 `.df-workspace` 而不是 `:root`：`:root` 那条选择器文本里没有 `.df-`，
    // px→vw 的黑名单够不到它（见文件头第二条）。行高**不随断点变**——入口只在启动时读一次，
    // 中途换尺就是跳转换算与行块分家。
    --df-row-h: 24px;

    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 20px 24px;
    align-items: start;
    margin-top: 22px;
}

// 控制与结果那一栏横跨两列：输入要成对才比得起来，而结果区要的是整幅宽度。
.df-side--bar {
    grid-column: 1 / -1;
}

.df-side__title {
    margin: 0 0 10px;
    font-family: $df-meta;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: .8px;
    text-transform: uppercase;
    color: var(--ink-3);
}

// 结果区那个 `<h2>` 是 `aria-labelledby` 的落点，不是版面：它排在 `.tk-outwrap` 之后，
// 读屏要的是"这一块叫什么"，眼睛要的已经由上面那行读数给全了。
.df-side__title--sr {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
}

// ── 输入侧：粘贴框、文件名、本机文件 ──────────────────────────────────────

.df-doc {
    margin-bottom: 0;
}

// 压过 `.tk-field textarea`（0,1,1）要靠 `.tk-field` 这一层前缀：作者样式之间比的还是特异性。
.tk-field .df-area {
    box-sizing: border-box;
    min-height: 268px;
    font-size: 12.5px;
    line-height: 1.55;
    tab-size: 4;
}

// 读数那一格由 `refreshGate` 整段重写成「N 行 · 大小」，所以这一格不许有 ::before 之类
// 的装饰文本——那半句会留在改写之后。
.df-status {
    margin: 0;
    font-family: $df-meta;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: var(--ink-3);
}

// 那一行只有两格：一个短标签、一个可编辑的名字。名字格不许被 `.tk-field input` 撑成整幅宽度
// （它写的是导出那一份的署名，不是路径），所以定宽到半栏。
.df-namerow {
    display: grid;
    grid-template-columns: 5em minmax(0, 1fr);
    gap: 8px;
    align-items: center;
}

.df-namerow__label,
.df-filerow__label {
    font-size: 12.5px;
    color: var(--ink-3);
}

.tk-field .df-name {
    box-sizing: border-box;
    padding: 5px 8px;
    font-family: $df-meta;
    font-size: 12.5px;
}

.df-filerow {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
}

// 原生选择框那一格：`.tk-field input` 给的是 `width:100%` + 表单字的那份内边距，
// 套在 `type=file` 上会把两枚按钮挤出这一行。这里收回到"一行里的一格"。
.tk-field .df-file {
    box-sizing: border-box;
    max-width: min(100%, 30em);
    padding: 4px 6px;
    font-family: $df-meta;
    font-size: 12px;
    background-color: var(--surface-2);
    border-style: dashed;
    border-color: var(--rule-2);
    cursor: pointer;
}

// ── 控制栏四段 ────────────────────────────────────────────────────────────

.df-bar {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 16px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--rule);
}

.df-bar__group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
}

.df-bar__group--opt {
    gap: 14px;
}

// 段与段之间那道竖线：`aria-hidden` 的那枚 `<span>`，只占位、不参与任何换算。
.df-bar__sep {
    flex: none;
    width: 1px;
    height: 18px;
    background-color: var(--rule-2);
}

.df-opt {
    display: flex;
    gap: 6px;
    align-items: center;
    min-width: 0;
}

.df-opt label {
    font-size: 12.5px;
    color: var(--ink-2);
}

// 这三枚 select 不在 `.tk-field` 里（那是"一栏一控件"那一族的位置），所以公共层罩不到它们，
// 形状要在这一格给全。
.df-opt select {
    box-sizing: border-box;
    padding: 5px 8px;
    font-family: inherit;
    font-size: 12.5px;
    color: var(--ink);
    background-color: var(--surface);
    border: 1px solid var(--rule-2);
    border-radius: var(--radius-m);
}

.df-opt--check {
    position: relative;
}

.df-opt--check > label {
    display: flex;
    gap: 5px;
    align-items: center;
    cursor: pointer;
}

.df-opt--check input {
    width: 14px;
    height: 14px;
    margin: 0;
    accent-color: var(--signal);
}

.df-opt--check .tk-help {
    font-size: 11.5px;
}

// ── 两档模式说明（唯一由 `hidden` 收放的一族） ────────────────────────────

.df-mode {
    margin: 0;
    max-width: 68ch;
}

.df-mode[hidden] {
    display: none;
}

// ── 结果区 ────────────────────────────────────────────────────────────────

.df-status--bar {
    font-size: 11.5px;
    letter-spacing: .4px;
}

// 本页唯一的滚动容器，也是 §Z 那句"整页只有一处 innerHTML"的那个落点。
// 高度写死、两个方向都给滚动条：文件头第四条那两格前提都在这里。
.df-out {
    box-sizing: border-box;
    width: 100%;
    height: min(620px, 68vh);
    padding: 0;
    overflow: auto;
    overscroll-behavior: contain;
    font-family: $df-meta;
    background-color: var(--surface);
    border-radius: var(--radius-m);
    box-shadow: inset 0 0 0 1px var(--rule);
}

.df-notice {
    margin: 0;
    padding: 10px 12px;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--ink-2);
    background-color: var(--surface-2);
}

// 结论与读数：各占一行、贴在行流左边缘。它们的**高度不进跳转那份换算**（文件头第二条末段），
// 所以这一格的目标是让它们稳定地各只有一行：不留 margin、字号给到 13px。
.df-verdict {
    margin: 0;
    padding: 0 10px;
    font-size: 13px;
    line-height: var(--df-row-h);
    color: var(--ink);
    font-weight: 600;
}

.df-verdict--same {
    color: var(--tk-ok);
}

.df-verdict--same-key-order {
    color: var(--tk-warn);
}

// 「有一段对不齐」那一格是结论句的**限定语**，不是第二句结论：跟在后面、换一个更轻的字重，
// 让它读起来像括号里的那半句。
.df-verdict__warn {
    margin-left: 8px;
    font-size: 12px;
    font-weight: 400;
    color: var(--tk-warn);
}

.df-stats {
    margin: 0;
    padding: 0 10px;
    font-size: 12px;
    line-height: var(--df-row-h);
    color: var(--ink-3);
}

// ── 行流：并排两栏 / 行内一栏 ─────────────────────────────────────────────

// 两个轨道各给一条 `minmax()` 下界、上界交给内容：`max-content` 让整块行流按最长那一行铺开，
// 横滚因此归 `.df-out` 那一格（A 与 B 同一条滚动条、同一档横移位置）。这一格不许写成
// `repeat(2, minmax(0, 1fr))` + `.df-col{overflow-x:auto}`：两栏各有各的滚动条时，
// 用户要比对同一行两侧的写法就得两次双手操作；而 `1fr` 那一档下长行会**溢出到邻栏**
// （轨道宽 = 客户宽的一半，溢出只画不裁），读起来是"B 栏压在了 A 栏的尾巴上"。
// 撑破轨道的代价是横滚，被挤成竖排的代价是这一页根本读不了——取前者。
.df-cols {
    display: grid;
    grid-template-columns: repeat(2, minmax(220px, max-content));
    gap: 0 12px;
    width: max-content;
    min-width: 100%;
    padding: 0 12px;
}

// 行内档没有第二栏，那一格独占整幅。
.df-lines {
    width: max-content;
    min-width: 100%;
    padding: 0 12px;
}

.df-col {
    min-width: 0;
    box-shadow: inset 0 0 0 1px var(--rule);
}

.df-row {
    box-sizing: border-box;
    display: flex;
    align-items: flex-start;
    width: max-content;
    min-width: 100%;
    height: var(--df-row-h);
    padding-right: 8px;
    font-size: 12.5px;
    line-height: var(--df-row-h);
    color: var(--ink-2);
}

.df-row__no {
    flex: none;
    width: 3.6em;
    padding-right: .7em;
    font-size: 11.5px;
    text-align: right;
    white-space: pre;
    color: var(--ink-3);
    font-variant-numeric: tabular-nums;
    user-select: none;
}

// 正文那一格是 `<pre>`：代码行的缩进是内容不是排版，CSS 万一漏了 `white-space`，
// 四格缩进就被并成一格了。行高锁在 `--df-row-h`、超出只裁不折，长行走 `.df-col` 的横滚。
.df-row__txt {
    flex: 1 1 auto;
    box-sizing: border-box;
    min-width: 0;
    margin: 0;
    padding: 0 4px 0 0;
    font: inherit;
    line-height: var(--df-row-h);
    white-space: pre;
    overflow: hidden;
}

.df-row__cr {
    flex: none;
    padding-left: 4px;
    font-size: 11px;
    color: var(--tk-warn);
}

.df-row--equal {
    background-color: transparent;
}

.df-row--change {
    background-color: var(--surface-2);
    background-color: color-mix(in srgb, var(--signal) 8%, transparent);
    box-shadow: inset 3px 0 0 var(--signal);
}

.df-row--del {
    background-color: var(--surface-2);
    background-color: color-mix(in srgb, var(--tk-bad) 9%, transparent);
    box-shadow: inset 3px 0 0 var(--tk-bad);
}

.df-row--ins {
    background-color: var(--surface-2);
    background-color: color-mix(in srgb, var(--tk-ok) 9%, transparent);
    box-shadow: inset 3px 0 0 var(--tk-ok);
}

// 缺席那一侧：它是"这一侧没有这一行"，不是第 0 行、也不是空行——所以给斜纹而不是空白。
// 两栏各读同一份行流靠的就是这一格看得见，否则并排视图会读成"两边都有这行、只是没内容"。
.df-row--fill {
    background-color: var(--surface-2);
    background-image: linear-gradient(
        45deg,
        transparent 5px,
        var(--rule) 5px,
        var(--rule) 6px,
        transparent 6px,
        transparent 11px
    );
    background-size: 11px 11px;
}

// 行内高亮：`renderInline` 只给 del / ins 两档套 span，等价段是裸文本。用 `box-shadow`
// 而不是 `background`，那一格底色与行自己的档位底色能同屏。
.df-inline--del,
.df-inline--ins {
    box-shadow: inset 0 -9px 0 var(--rule-2);
    border-radius: var(--radius-s);
}

.df-inline--del {
    color: var(--tk-bad);
}

.df-inline--ins {
    color: var(--tk-ok);
}

// ── 折叠条：整条正好一个 `--df-row-h`，因为 `goTo()` 把它算作一个视觉行 ─────
// `white-space: nowrap` 与 `overflow: hidden` 是给那份换算上的保险：这句话一旦折行，
// 这一条就占两行高，而 `goTo()` 只把它算作一行——此后每一处跳转都少滚一行，且越往后差得越多。
// 360 档实测那一句「省略 24 行 · 展开」在 11.5px 下约 96px，离这一格的宽度下界很远，
// 所以"截成两个字"在这里不是风险，折行才是。
.df-fold {
    box-sizing: border-box;
    display: block;
    width: 100%;
    height: var(--df-row-h);
    margin: 0;
    padding: 0 12px;
    font-family: $df-meta;
    font-size: 11.5px;
    line-height: var(--df-row-h);
    white-space: nowrap;
    text-align: left;
    overflow: hidden;
    color: var(--signal-ink);
    background-color: var(--surface-2);
    border: 0;
    border-radius: 0;
    box-shadow: inset 0 1px 0 var(--rule), inset 0 -1px 0 var(--rule);
    cursor: pointer;
    // 粘住横滚的左沿：行流可以比这一格宽（那是这一页的常态），而"省略 24 行"那一句话
    // 是**读屏的地图**，它跟着内容滚出视野之后，用户只剩一片空白可以滚。
    position: sticky;
    left: 0;
}

.df-fold:hover {
    color: var(--signal);
    box-shadow: inset 0 1px 0 var(--rule-2), inset 0 -1px 0 var(--rule-2), inset 0 0 0 1px var(--rule-2);
}

.df-fold:focus-visible {
    outline: 2px solid var(--signal);
    outline-offset: -2px;
}

// 尾条与头条是两档（Z7 量的就是这件事）：样式上的分别是"下面那道线不要"。
.df-fold--tail {
    box-shadow: inset 0 1px 0 var(--rule);
}

// ── 代价说明与 JSON 变更表 ────────────────────────────────────────────────

.df-notes {
    margin: 10px 0 0;
    padding: 10px 12px 10px 30px;
    font-family: inherit;
    font-size: 12px;
    line-height: 1.65;
    color: var(--ink-3);
    background-color: var(--surface-2);
    box-shadow: inset 0 1px 0 var(--rule);
}

.df-json__meta {
    margin: 0;
    padding: 0 10px;
    font-size: 12px;
    line-height: var(--df-row-h);
    color: var(--ink-3);
}

// 六列那张表：这一页的 JSON 档没有行流，读的是"哪一格变了"，所以列宽交给内容，
// 横滚归 `.df-out`（`min-width:100%` 让它至少铺满那一栏）。
.df-json {
    box-sizing: border-box;
    min-width: 100%;
    margin: 8px 0 0;
    font-family: $df-meta;
    font-size: 12.5px;
    border-collapse: collapse;
}

.df-json th,
.df-json td {
    padding: 5px 10px;
    text-align: left;
    vertical-align: top;
    white-space: pre-wrap;
    border-bottom: 1px solid var(--rule);
}

.df-json thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: .4px;
    color: var(--ink-3);
    background-color: var(--surface);
    box-shadow: inset 0 -1px 0 var(--rule-2);
}

.df-json__ptr {
    color: var(--ink);
}

.df-json__kind,
.df-json__owner {
    white-space: nowrap;
    color: var(--ink-3);
}

.df-json__depth {
    width: 4em;
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: var(--ink-3);
}

.df-json__a,
.df-json__b {
    max-width: 42ch;
    overflow-wrap: anywhere;
    color: var(--ink-2);
}

// 四档变更各给一道左侧竖条：颜色之外还有位置这一格可读（表里那一列同时写着中文档名）。
.df-json__row--add {
    box-shadow: inset 3px 0 0 var(--tk-ok);
}

.df-json__row--remove {
    box-shadow: inset 3px 0 0 var(--tk-bad);
}

.df-json__row--change {
    box-shadow: inset 3px 0 0 var(--tk-warn);
}

.df-json__row--type {
    box-shadow: inset 3px 0 0 var(--signal);
}

// 「这一侧没有」与"值真的是 null"是两件事，视图层用 `absent` 那一格分开它们（Z18）。
.df-json__none {
    font-style: italic;
    color: var(--ink-3);
}

.df-json__cut {
    margin: 8px 0 0;
    padding: 0 10px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--tk-warn);
}

// ── 页脚那六句静态口径 ────────────────────────────────────────────────────

.df-terms {
    margin-top: 30px;
}

.df-terms__list {
    margin: 10px 0 0;
    padding-left: 22px;
    font-size: 12.5px;
    line-height: 1.75;
    color: var(--ink-3);
}

.df-terms__list li + li {
    margin-top: 6px;
}

.df-terms__list code {
    padding: 1px 4px;
    font-family: $df-meta;
    font-size: 12px;
    background-color: var(--surface-2);
    border-radius: var(--radius-s);
}

// ── 断点 ──────────────────────────────────────────────────────────────────
// 900 / 640 两档与 toolkit.scss 同一口径（那一层的索引条在本页没有，退档退的是左右分栏）。
// 901–1100 那一段**不在这里改**：两栏靠 `minmax(0, 1fr)` 自己收缩，十四枚按钮靠 `flex-wrap` 换行。
// 但这一段必须实测（段 2 立的十档清单里的 901/920/940）：`min-width:0` 一漏，
// 一行 5 MiB 的结果串会把整栏撑破，而 §7 那两格预算量的都是首屏字节、看不见它。
// ≤900 竖排的是**那两条输入栏**（A 排在 B 之前，两份输入前后读本来就没有配对问题）；
// `.df-side--bar` 一直占满 `1 / -1`，所以结果区在那一档之后仍是 §Z 的那一栏，视图层不受影响。

@media (max-width: 900px) {
    .df-workspace {
        grid-template-columns: minmax(0, 1fr);
        gap: 18px;
    }

    .tk-field .df-area {
        min-height: 200px;
    }

    .df-out {
        height: min(500px, 60vh);
    }
}

// ≤640 那一档**不退成上下堆叠**（与段 5 计划 Task 7 Step 2 的原句不同，偏差记在计划 §0.6）。
// 理由是那一格要的"堆叠"在视图层只有一种等价形状：把 `.df-cols` 的两条轨道改成一行——而 `side` 档的
// 行流是「同一行在两栏各出现一次」（Z20 钉住：行块数 = 行数 × 2），竖排之后 A 的整份行流排在 B 之前，
// 读的人要先自己上下配对，那一块就从"对比"退成了"两份文本"。窄屏的真退路是那一枚「视图」下拉里
// 的**行内单栏**：`inline` 档由装配层把 change 摊成两行、只出一栏（Z20 同一判的第二半），
// 它是行流层面的堆叠，不是样式层面的——所以样式这一层只把两栏压窄、把横滚留给 `.df-out`，
// 让用户自己选档。样式里改 `grid-template-columns` 会造出一幅"下拉写着并排、画面是两栏竖排"的假象。
@media (max-width: 640px) {
    .df-cols {
        gap: 0 8px;
        padding: 0 8px;
    }

    .df-bar__group {
        gap: 6px;
    }

    .df-bar__group .tk-btn {
        flex: 1 1 auto;
    }

    .df-bar__group--opt {
        flex-direction: column;
        gap: 8px;
        align-items: stretch;
    }

    .df-opt {
        justify-content: space-between;
    }

    .df-opt select {
        flex: 1;
        min-width: 0;
    }

    .df-row {
        font-size: 12px;
    }

    .df-row__no {
        width: 3em;
    }

    .df-out {
        height: min(420px, 54vh);
    }
}
```

#### `assets/img/tools/diff-tool.svg`（整文件，33 行）

第四枚图标。门禁⑥「图标」那一组把 `stroke` / `fill` 里每个色值拿去比 `tokens.scss` 现读的八格底色，
读的是**磁盘**那份；镜像在这里多扛一条：XML 注释禁连续两划那条硬规矩的第四个现场
（2026-09-28 证件页那枚破图，判据补的就是这一档）。取色与前四枚同为 `#737B85`，理由同一档。

```svg
<!-- 顶栏「工具箱」下拉与 /tools.html 小节里「文件与文本对比工具」那一行的图标。
     画成一条中缝分隔的左右两栏短行，两栏的行长短不一：这一页做的是「两份东西摆一起看哪几行不一样」，
     图形要说的就是那几处不一样，所以不画放大镜、不画文件夹、不画箭头（那些读出来的是「搜索」或「同步」）。
     三枚同族图标各占一种形状——卡片、尖括号加斜杠、花括号——这一枚是第四种，读图的人在下拉里
     先读到名字，图形只负责把这一族页面互相区分开。

     与另三枚同一条硬规矩：XML 注释里禁止出现连续两个连字符，一写整个文件就解析失败，
     而 SVG 是被 <img> 引用的，解析失败在浏览器里直接是破图（2026-09-28 现场就是证件页那份
     注释里写了带 var 前缀的令牌名，xmllint 报六处 parser error，下拉与产品页两处同时破图，
     而收录面门禁当时退 0）。所以这段通篇把底色令牌写成 surface / surface-2，不写它们那两划
     开头的形式；连中缝那一格的自定义属性也写成 df row h，不在这里写它的原名。

     颜色与另三枚取同一个 #737B85，理由也同一档：这一族图标通过 <img src> 引用，
     里面的 SVG 拿不到宿主页面的 CSS 自定义属性，currentColor 只能落回它自己文档的初始 color
     （近黑），落在夜间 surface-2 上是 1.35:1，等于看不见。烘色则两档都能读，代价是
     不跟主题变——下拉里这几枚本来也只是区分条目用。

     #737B85 的取值口径同 assets/img/tools/idcard-tool.svg 那段注释：把 tokens.scss 里
     四档纸色温的 surface 与 surface-2 共 8 格逐格算对比度，取"最差那组尽量高"的那一档，
     WCAG 1.4.11 对图形对象要 3:1（这几处图标都带 alt=""，属装饰，实际门槛更低）。
     复算不用手抄：跑 `node scripts/check-tools-surface.mjs`，它的「图标」那一组按条目现读
     tokens.scss 凑底色集合、现算这八组比值，并把本文件的 stroke 与 fill 里每个色值都过一遍。 -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none"
     stroke="#737B85" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
     role="img" aria-label="文件与文本对比工具">
    <path d="M12 4.5v15" stroke-width="1"/>
    <path d="M3.5 8h5"/>
    <path d="M3.5 12.5h5"/>
    <path d="M3.5 17h2.6"/>
    <path d="M15.5 8h5"/>
    <path d="M15.5 12.5h2.6"/>
    <path d="M15.5 17h5"/>
</svg>
```

---

### 提交态自证（`93d6e12` 落笔之后，在导出树里跑的那一发）

**落笔 = `93d6e12`**（`65819d0` → `93d6e12`，`git update-ref` 的 CAS 带旧 sha；
临时索引 `mktemp /tmp/qoder-task6-index-*`、`read-tree HEAD`、逐格 `hash-object -w` +
`update-index --add --cacheinfo`，新树 `0514598` 先与 `HEAD^{tree}` 比过"必不相等"再
`commit-tree -F` 那份信息文件）。`git show --stat` 读到 **`2,806 insertions(+) / 41 deletions(-)`
且正好十三行**，Step 7 列的那十三格一格不多一格不少。

**索引对齐那一格**（Task 5 的 §0.7 记过它的形状，这一发按同一条走）：plumbing 只写树、
不动工作索引，所以落笔之后我那十三格在 `git status` 里全是"暂存改动"（索引还挂着旧 blob），
逐格用 `git update-index --add --cacheinfo 100644,$(git rev-parse HEAD:<path>),<path>` 对齐回新 HEAD；
对齐那一刻 `--porcelain` 剩 **25** 行、逐条都是另一路会话那批（`USAGE.md` 仍 `1/76`、
spec 仍 `0/17`，两格的暂存字节账与本发之前一字不差），工作树文件一件未动。
新增那三格在对齐之前根本不在索引里，`--add` 是唯一能把它们从"未跟踪"变成"与 HEAD 齐平"的写法。

**门禁④（两棵导出树真重建 + 三列字节表）**：`/tmp/seg5t6-base` = `git archive 65819d0`、
`/tmp/seg5t6-work` = `git archive HEAD`（提交之后），各 `ln -s` 活树 `node_modules`、各跑一次
真 `npx vite build`（Node v22.19.0；base `✓ built in 5.25s`、work `✓ built in 4.69s`，两边 `exit=0`）。
字节表逐件列 **原始 / L6 / L9**（`stat -f%z` 与 `gzip -6|-9 -c f | wc -c`），
`assets/{js,css}/*.min.*` 合计 **base 36 件 = 843,534 / 268,225 / 267,455**，
**work 37 件 = 853,571 / 270,556 / 269,770**，两份清单 md5
`ec8749e4…` / `bdfbf511…` **不再等式**——段 4 Task 5 那一格预告的"Task 6 之后这一格必然不再是等式"
就是这一刻，差额全部落在本页两件上，逐行 diff 只有两条：

| 件 | base（raw / L6 / L9） | work（raw / L6 / L9） | 差 |
| --- | --- | --- | --- |
| `assets/css/toolDiff.min.css` | 查无此件（`dev/sass/toolDiff.scss` 这一格才进 `vite` 的入口扫描面） | 9,644 / 2,218 / 2,202 | 新件 |
| `assets/js/toolDiff.min.js` | 51,148 / 19,764 / 19,745 | 51,541 / 19,877 / 19,858 | +393 / +113 / +113 |

合计那一笔 **+10,037 / +2,331 / +2,315** 里，`toolDiff.min.js` 那 +393 raw 是本格补的 `onFoldClick`
（折叠条点开），其余全是新那张样式表。**`import{` 在 work 那 25 本 `assets/js/*.min.js` 里逐文件
`grep -c` 求和 = 0**（§0.4 那条"别让两入口 reach 同一模块切出共享 chunk"的自动版）。
Step 5 欠的那一半在这里补完：导出树里 `tools-diff.html` 与 `toolDiff.scss` 都在，
所以这一发的 `jekyll` 侧不需要重跑——构建产物面的红线（`import{`）与字节账都在 `vite` 这一侧。

**干净检出那三道人**（都在 `/tmp/seg5t6-work` 里跑，跑之前先在那棵树 `git init` 让门禁③
的"实验前后脏指纹"自证有基线可取）：
① `# tests 439 / # pass 439 / # fail 0 / # cancelled 0` 退 0；
② 退 0（`76` 块已落地镜像全等、`未落地 0 节`、js 块 `65`）——这一发同时自证了"提交进去的那份计划
镜像与提交进去的那份磁盘内容互为逐字节"，活树里我后来改的格不参与；
③ **`37/37`** 退 0，末尾"副本回到全绿、实验前后脏指纹一字不差"。
⑤⑥ 只在活树跑（⑤ 读 `ROOT/_site`，导出树里没有 `_site`）：⑤ 退 0（4 条 ready × 5 组、导航核到 101 页），
⑥ `67/67` 退 0 + "全部变异已还原，复跑基线仍绿"（它就地改源再还原，所以那一刀跑完后
`scripts/check-tools-surface-teeth.mjs` 自己那次 `+29` 行改动仍在工作树里，随下一格提交）。

**台账随本发放回原处**：门禁⑥ 补的那一刀「tools.html 少整节（JSON 那一小节连头带尾删掉）」
在 `scripts/check-tools-surface-teeth.mjs`（`dropSection` + `expect`），单独一发
`test(tools)` 提交 = **`2a3f16e`**（`93d6e12` → `2a3f16e`，同一套 plumbing + CAS，只那一格），
与这段自证分开——它动的是判具不是文档，混进 `docs(plans)` 就会让
"这一格只改了计划"那句话变成假的。

---


---

## Task 7：浏览器核验 + §7 两行先量后立 + 四页首屏一起重量

**Files：** Create `scripts/verify-diff-browser.mjs`（或按现行 harness 的既有形状扩
`scripts/verify-tools-browser.mjs` 的 `BUDGET_ROWS` 与页集，二选一由本格实读决定并在此登记）；
Modify `_docs/superpowers/specs/2026-09-25-blog-online-tools-design.md`（§7 两行把"待量"换成实数）。

- [x] **Step 1：清场**——`ps` / `lsoff` 证明没有遗留 runner 与占用端口（项目记忆那条
      "e2e 前先清遗留进程与端口"，本轮并行会话负载到过 500）。
- [x] **Step 2：十档视口 × 本页**（1a–1e 那五档沿用，另加对比页独有的两档：并排两栏在 ≤640 **保持并排**、
      横向溢出只由 `.df-out` 那一个滚动容器承担，**不退成上下堆叠**（Task 6 Step 2 改道，理由记 §0.6，
      原句"必须退成上下堆叠"已按此改口）——要各测一次：并排档在 360 档不出现"两栏被挤到读不出"，
      「视图」下拉切到**行内单栏**那一档在 360 档能单栏读完，那才是窄屏的真退路；
      折叠条在 360 档不得把"省略 N 行"截成两个字）。
- [x] **Step 3：本页专属的交互族**——真实鼠标点击要过命中测试（`elementFromPoint` 自证落点）、
      拖入文件与 `<input type=file>` 两路各跑一次（`DataTransfer` 造的那份不算，要真文件描述符）、
      非 UTF-8 与含 NUL 的两份样本必须被拒并给那句、超 5 MiB 的样本**先按 size 拒**（断言
      `FileReader` 一次都没被叫）、禁 JS 档读得到整页正文与六句说明、`console.error` 为 0（6a 那一族）。
- [x] **Step 4：`§7` 两行先量后立**——口径 `cat f | gzip -9 | wc -c`，件集与档位推导照 §7 表格那两行写。
- [x] **Step 5：四页首屏 + 三页总量一起重量**（§0.3(b) 那一格），A/B 两份可比产物（同一份工作树、
      只差 yml 那一格）量出登记第四页这一笔的**逐页差额**；证件页首屏余量若掉到 300B 以下 →
      **BLOCKED 停下交回**，附三种处置的字节账。
- [x] **Step 6：提交** `test(tools): 段 5 Task 7 对比页浏览器核验——§7 两行先量后立，四页首屏一起重量`。

---

## Task 8：变异台账 + 六道门禁全量 + 自证

- [x] Step 1：§X/§Y/§Z 三族逐族注入变异（每族 ≥5 刀，记"单红/恰目标"），照段 3/段 4 的台账形状；
- [x] Step 2：`verify-plan-blocks-teeth.mjs` 为"第四份计划接手 §X–§Z"补刀（清单漏项反查、
      §X 节被截短的假"逐字节不等"那一族）；
- [x] Step 3：六道门禁全量重跑（**只对改动文件跑 prettier/eslint 不算过**——本仓库根本没有这些配置，
      这条记在项目记忆里）；① 高负载假红按 §0.8 那句处理，不改判据、不并进绿；
- [x] Step 4：干净检出（`git archive HEAD` 导出树）自证：门禁② 与⑤在导出树里退 0；
- [x] Step 5：提交 + 把 commit 号续进台账那一格。

前置与跑法：变异**全部打在 gitignored 镜像** `node_modules/.seg5t8-scratch/mirror/`（`rsync` 全量 +
补拷 `demo/`——基线首跑 `# fail 1` 那条 `not ok 26 - B14` 就是镜像缺 `demo/idCardDemo/lib/GB2260.js`，
补拷之后 439/439），活树那五本算法／视图／入口一件未动（`git status` 逐格自证为空）。
每刀一发命令、一次只落一把：开跑前先从 `pristine/` 复位 → 整串字面匹配 + 唯一性检查（命中数不是 1
就直接退 9，刀不落）→ 跑**全量 439**（不用 `--test-name-pattern`，红名单要跨族才量得到"这一刀有没有把
别页带下水"）→ 立刻复位并 md5 自证。落刀前基线 `# tests 439 / # pass 439 / # fail 0 / # cancelled 0`
退 0、14.6s；收刀时五本 md5 与基线一字不差：`diff-core.js 13e69986…`、`diff-json.js f92296fe…`、
`diffView.js 534b70cf…`、`diffWorkbench.js 3fa5ce13…`、`toolDiff.js 79b7f3a1…`。
23 刀的红名单**全部落在 §X/§Y/§Z 之内，族外 0 条**；跑动期间本机 1 分钟负载 5.2–45.3（并行会话在动），
没有一刀出现超时假红——高负载只会多红不会少红，所以下面那两格"0 红"的结论不受负载影响。

§X（`dev/js/tools/diff-core.js`，8 刀）：

| 刀 | 改哪一行 | 红名单（实测） | 处置 |
| --- | --- | --- | --- |
| X-1 | `:226` compareKey 的 ws 档去掉 `.trim()` | X7 X8 X9 X19 X27 | 有牙。预期 X7/X9/X19 全中，另抓 X8/X27——那两判也读同一只 compareKey，归一化那一格是四判共用的出口 |
| X-2 | `:663` `bytesBad` 的 `\|\|` 改成 `&&` | X11 X12 X24 Y16 Z11 | 有牙，且**跨族**：§Y 的"两档走 diff-core 那一把尺"与 §Z 的坏输入文案都被这一格牵着 |
| X-3 | `:633` del 行起点 `seg.pairs` 改成 `0` | X18 | 有牙但只一格。Z4/Z5 不红的道理：两栏读**同一份**行流，多出来的 del 行是对称的，"两栏行数相等"抓不到行流被污染——这一格的账归 X18 一处守（登记为 §Z 那两判的已知边界，不补刀） |
| X-4 | `:589` `pairs: Math.min(del, ins)` → `Math.max` | X13 X18 X22 X23 | 有牙 |
| X-5 | `:935` 并块门 `lo <= last.hi` → `lo < last.hi` | 首跑 0 红 → 补判据后 X20 | **判据缺口，当场补掉**。X20 两份样本的间距是 20 与 10，都不是 2×context，所以那一档边界全族无人读。取证用一份临时探针（跑完即删）：gap=6 基线是一块 14 行、落刀变两块 7+7；gap=7 两种写法都是两块——行集逐格相同、只有 `skipped` 与"共几处"的读数变，故不是等价写法而是没测到。补的是 X20 末尾四句（2×context 并块、+1 分块、行数与 skipped 各一格） |
| X-6 | `:1027` unified 头 A 侧行号少 1 | X22 X23 X25 Z19 | 有牙。预期里的 X24 不红——那份样本两侧都空，头里没有行号可错 |
| X-7 | `:762` `ignored` 少看 `crlf` 半边 | X9 X19 | 有牙。预期里的 X6/Z24 不红：X6 的样本不含"仅行尾回车不同"的 equal 行，Z24 读的是文案同现而非计数来源 |
| X-8 | `:971` `skipped: g.lo - prevHi` 多算 1 | X20 X21 X22 Z7 Z21 Z28 Z29 | 有牙，本族最狠的一刀：折叠条、快捷键、换前缀三判一起红，正是"属性与正文用同一个数"那条线 |

§Y（`dev/js/tools/diff-json.js`，6 刀）：

| 刀 | 改哪一行 | 红名单（实测） | 处置 |
| --- | --- | --- | --- |
| Y-1 | `:120` Pointer 转义次序颠倒（先 `/` 后 `~`） | Y6 Y7 | **恰目标** |
| Y-2 | `:63` `MAX_DEPTH` 1000 → 64 | Y1 Y2 | 有牙。Y15/Y18 不红的道理：那两判的层数取自 `import` 的 `MAX_DEPTH`（`toolkit-tests.mjs:14012` 那格 `MAX_DEPTH: Y_DEPTH`），跟着常量走就永远自洽；死数只有 Y2 里 `assert.equal(Y_DEPTH, 1000)` 那一句——改数值这一档只有对拍那头抓得到，登记为这一族的量测边界 |
| Y-3 | `:479-480` `stats[kind] += 1` 挪到截断 return 之后 | Y12 | **恰目标**（单红） |
| Y-4 | `:502` `type` 档并入 `change` | Y4 Y13 Y14 Y17 Z10 | 有牙；预期里的 Z25 不红——那一判数的是变更表的行档名与六列形状，`type` 换成 `change` 两者都不变 |
| Y-5 | `:518` `let sameOrder = lenA === lenB` 强制 `true` | 0 红 | **可证无牙，不动它**：`keyOrderDiffers` 那一格（`:532`）要求两侧键互为对方子集，键集相等 ⇒ `lenA === lenB`，所以那半句在任何输入下都不改变输出——是实现里的一处冗余保险，不是判据缺口 |
| Y-6 | `:83` 数字读侧放行前导零 | Y1 | **恰目标**（单红）：坏数写法只在 Y1 与 `json-core` 对拍那一格露头，本族没有第二判走 `readNumber` 的那条分支 |

§Z（`diffView.js` 5 刀 + `diffWorkbench.js` 3 刀 + 入口 1 刀，共 9）：

| 刀 | 改哪一行 | 红名单（实测） | 处置 |
| --- | --- | --- | --- |
| Z-1 | `:116` 行内高亮那半段不转义 | Z8 Z9 | 有牙；预期里的 Z5 不红——样本是纯字母，转与不转同一串 |
| Z-2 | `:134` fill 判据 `ln === null` → `undefined` | Z4 | **恰目标**（单红） |
| Z-3 | `:142` 可见行号 `ln + 1` → `ln` | 首跑 0 红 → 补判据后 Z4 | **判据缺口，当场补掉**：Z4 钉的是属性 `data-df-ln`（0-based 那一格），屏上那一格 `df-row__no` 的内容全族无人读——行号从 0 起、整页照绿。补的是 Z4 里两句 `noCell`（A 栏 `1/2/3/空`、B 栏 `1/2/3/4`），注释写明这一刀是唯一来源 |
| Z-4 | `:173` 去掉 `skipped === 0` 那一档 | Z7 Z21 Z28 Z29 | 有牙 |
| Z-5 | `:176` 折叠条属性比正文多 1 | Z7 | **恰目标**（单红）：Z7 那句"属性与正文两处用同一个数"抓得准 |
| Z-6 | workbench `:717` `data-${env.prefix}-skip` 打成 `data-df-skip` | Z16 Z29 | 有牙；预期里的 Z28 不红——换前缀那一判量的是节点地址与产物串，不点折叠条 |
| Z-7 | workbench `:563` 文件闸门 5 MiB → 10 MiB | Z27 | **恰目标**（单红）：抓它的正是 `reads.length` 那一格（"超限必须在读之前拒掉"） |
| Z-8 | workbench `:792` 折叠条的点击线摘掉 | Z29 | **恰目标**（单红） |
| Z-9 | 入口 `toolDiff.js` 顶层插一枚 `Date.now()` | Z15 | **恰目标**（单红）：时钟归零那一半有牙 |

小结：23 刀里 **8 刀恰目标**、**12 刀多判共抓**（跨族牵引记三处：X-2 → Y16/Z11、X-8 → Z7/Z21/Z28/Z29、
X-6 → Z19）、**2 刀首跑 0 红**（X-5 的 2×context 边界档、Z-3 的可见行号）→ 两处判据缺口当场补掉，
都只加断言不加用例（`# tests` 仍是 439；补完基线复跑 `# pass 439 / # fail 0` 退 0，重跑那两刀各红恰一条），
**1 刀可证无牙**（Y-5，是实现里的冗余保险而非测试缺口，不动它）。

**Step 2 台账（2026-10-01，`scripts/verify-plan-blocks-teeth.mjs` 37 → 41 项）**

补的两刀都打在"第四份计划接手 §X–§Z"这一格，跑法照 G13 那一族：改动只落进临时副本（`verify-plan-blocks.mjs`
与 `scripts/toolkit-tests.mjs` 的副本），落点守卫仍拦仓库之外的落点，实验前后各拍一张工作树脏指纹。

| 新项 | 反查的那一族 | 实测读数 |
| --- | --- | --- |
| G14 清单漏项 | 副本里 `FILE_TARGETS` 删掉 `'dev/js/tools/diff-core.js',` 一行 | 退 1 且点名 `✗ 漏网镜像：dev/js/tools/diff-core.js`（"没被核过"那句话到得了页面），还原后退 0。这一刀的靶子是"磁盘上有这份文件、门禁却宣称全部已落地镜像逐字节全等"——清单少一行时那句仍然退 0，所以反查必须由牙齿来钉 |
| G15 标记漂移 | 副本里把 `// ── §X` 那行缩进两格 | 读跑退 1 并报 `✗ 分节标记可疑`、§X 那一节露出假"逐字节不等"；`--fix` 同一轮退 1、拒写（无 `已同步`）、**5 份计划文件哈希一字未变**；恢复后退 0 |

G12 那一族是遍历 `PLAN_RELS()` 的，第四份计划一进清单就自动进了它的覆盖面，本轮没有为它补刀。

**Step 3 六道读数（活树，2026-10-01 15:10，本机 1 分钟负载 4.5）**

① `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs`：
`# tests 439 / pass 439 / fail 0 / cancelled 0`，退 0，18.1s。补的那两处判据只加断言不加用例，
所以 `# tests` 与 Step 1 的基线同一个数——这也是那两刀重跑各红恰一条的前提。
② `verify-plan-blocks.mjs`：退 0，76 个已落地镜像 / 合计 1,626,755B / 未落地 0 节，
计划 js 块 65 个（段1 11、段2 19、段3 15、段4 12、段5 8）。
③ `verify-plan-blocks-teeth.mjs`：41/41 通过、退 0；脏指纹 `a2259c5be45f434a` 前后一模一样（27 个脏项，
含另一路会话那批，一律未被触碰）。
④ 归 Step 4：这道门禁读的是 `git archive HEAD` 导出的**提交态**，在活树跑等于拿工作树自证工作树。
⑤ `check-tools-surface.mjs`：退 0，4 条 ready（idcard / codec / json / diff）× 5 组判据全绿，
导航核到 101 页（不渲染 header 的 18 份、无 canonical 的 17 份）。
⑥ `check-tools-surface-teeth.mjs`：67/67 组变异如期变红 + "全部变异已还原，复跑基线仍绿"。

六道里没有一道出现高负载假红：① 是唯一的 20s 超时来源，18.1s 是在负载 4.5 下过的；Step 1 那 23 刀
跑在负载 5.2–45.3 之间，没有一刀超时，§0.8 那句"红了先 `uptime` 再单跑那一判自证"本轮没有触发过。

**Steps 1–3 落到工作树的只有三格**：`scripts/toolkit-tests.mjs`（Z4 两句 `noCell` + X20 末尾四句，
`md5 -q` = `e70eacbc646ee4ce81468130c8d3ef1d`，改前那一份是 `884c7d19…`，记在镜像基线里）、
`scripts/verify-plan-blocks-teeth.mjs`（G14/G15）、
本计划（台账 + `--fix` 同步的 §X/§Z 两块，7504 → 7524 行）。被测的五个模块 md5 与基线一字不差。

**Step 4 与门禁④（`ff21e4a` 落笔之后，在导出树里跑的那一发）**

**落笔 = `ff21e4a`**（`454befa` → `ff21e4a`，`git update-ref` 的 CAS 带旧 sha；临时索引
`mktemp /tmp/qoder-seg5t8-index-XXXX`、`read-tree <旧 sha>`、逐格 `hash-object -w` +
`update-index --add --cacheinfo`，新树 `78aa605` 先与 `HEAD^{tree}`（`532cd91`）比过"必不相等"
再 `commit-tree -F` 那份信息文件）。`git show --stat` 读到 **`189 insertions(+) / 9 deletions(-)`
且正好三行**，与上面"落到工作树的只有三格"同一句话。
**索引对齐**：plumbing 只写树、不动工作索引，落笔之后那三格在 `git status` 里全是 `MM`（索引还挂着旧 blob），
逐格 `git update-index --add --cacheinfo 100644,$(git rev-parse HEAD:<path>),<path>` 对齐回新 HEAD；
对齐那一刻 `--porcelain` 剩 **25** 行、逐条都是另一路会话那批，工作树文件一件未动。
另一路会话在 spec 那一格的暂存 blob 仍是 `7c009a3c…`，与它们的备份一字不差——本发没碰它，
但它还在索引里，它们下一次裸 `git commit` 仍然会把那一格写进去（§0.7 第 4 条那笔账照旧挂着）。

**落点偏差（要登记）**：两棵导出树放 gitignored 的 `node_modules/.seg5t8-scratch/export-{base,work}`，
不放 `/tmp/seg5t6-*` 那种写法——`/tmp` 会被清，项目记忆里那条，这一发改成落在仓库内的忽略目录。

**门禁④（两棵导出树真重建 + 三列字节表）**：`export-base` = `git archive 454befa`、
`export-work` = `git archive ff21e4a`，各 `ln -s` 活树 `node_modules`、各跑一次真 `npx vite build`
（Node v22.19.0；base `✓ built in 8.34s`、work `✓ built in 10.64s`，两边 `exit=0`）。
口径 `stat -f%z` 与 `gzip -6|-9 -c f | wc -c`，件集 `assets/js/*.min.js` + `assets/css/*.min.css`：

| 树 | 件 | 原始 | L6 | L9 | 清单 md5 | 逐件内容 md5 的合集 |
| --- | --- | --- | --- | --- | --- | --- |
| `export-base`（454befa） | 37 | 853,571 | 270,556 | 269,770 | `27b3d6cb…` | `84c56e7f…` |
| `export-work`（ff21e4a） | 37 | 853,571 | 270,556 | 269,770 | `27b3d6cb…` | `84c56e7f…` |

**这一发的读数是"等式"，而 Task 6 那一发是"不等式"**——这正是本格该有的形状：三格改动（判据、牙齿、计划）
都不在 vite 的入口扫描面上，产物必须逐件相同；两份逐件清单 `diff` 无输出、内容 md5 合集同一个数，
就是"这一轮没有因为改判据把产物带下水"的证据。合计与段 5 Task 6 那一步的 work 读数一字不差
（37 件 / 853,571 / 270,556 / 269,770），§7 那两行不需要重立。**`import{` 在 work 那 25 本
`assets/js/*.min.js` 里逐文件 `grep -c` 求和 = 0**（§0.4 那条红线的自动版）。

**干净检出那四道人**（都在 `export-work` 里跑；跑之前先在那棵树 `git init`，否则门禁③ 末尾那句
"实验前后工作树脏指纹一字不差"拿到的是 `fatal: not a git repository`——项目记忆里那条，本轮第三次用）：

- ① `# tests 439 / pass 439 / fail 0 / cancelled 0` 退 0——跑的是提交进去的那份 `toolkit-tests.mjs`，
  所以 Step 1 补的那两处判据在"工作树里我后来的改动"不参与的前提下仍然全绿。
- ② 退 0（76 块已落地镜像全等、`未落地 0 节`、js 块 65）。这一发同时自证"提交进去的那份计划镜像
  与提交进去的那份磁盘内容互为逐字节"。
- ③ **`41/41`** 退 0，末尾"副本回到全绿、实验前后脏指纹一字不差"（导出树里 62 项前后一致，
  指纹 `ecc2eb005f5ff60c`——那 62 项里含上面 vite 刚重建的 `assets/`）。
- ⑤ 退 0（4 条 ready × 5 组、导航核到 101 页）。**这一格把 Task 6 那句"⑤⑥ 只在活树跑"补完**：
  `check-tools-surface.mjs` 的 `ROOT` 由 `import.meta.url` 推（`:34`），所以在导出树里跑时页面源、
  `_data/onlineTools.yml`、DOM 判据要 `import` 的 `dev/js/*` 全部读提交态；导出树里没有自己的 `_site`，
  这一发 `ln -s` 活树那一份（同 Task 6 对 `node_modules` 的做法）。也就是说**源侧是提交态、产物侧是活构建**，
  这一发的绿只到"提交进去的源与活构建产物对得上"这一档，不覆盖"干净机器上重建 `_site` 也能过"——
  那一档要 `jekyll build`，归 Task 9 Step 5 的收口复跑。
- ④ 就是上面那一格（两棵树真重建），⑥ 照旧只在活树跑：它就地改源再还原，导出树里那些格只是快照。

---

## Task 9：对账收口

- [x] Step 1：spec ↔ 实现逐格对账（§5.6 那六条、§7 那两个新行、§8.1 三族、§12 六段），
      发现文档与代码不一致时**改文档**，除非是代码错了；
- [x] Step 2：§7 全表（含 2026-09-30 之前六行）按现行产物重算一次，与 Task 7 的读数对得上才对；
- [x] Step 3：索引条那 10 枚死锚点按 §0.3(b) 的条件交回（修 A / 修 B 两份代价 + 重量后的余量）；
- [x] Step 4：`USAGE.md` 的检索层自查计数（等对方那格 `1/76` 先落地，§0.7 第 4 条）；
- [x] Step 5：收口记录 + 六道门禁复跑 + 提交；
- [x] Step 6：**单独请示推送**（含"要不要连带另一路会话那二十六条一起发"）——2026-10-01 已请示、获批「现在就推，
      45 条一起上」，`origin/master` 现为 `c542febd18491112ce85cfc349d0c4c2441470e8`；同一轮另两问的答复见下面那格。

**Step 1 对账台账（2026-10-01，十格落 spec、一格落本计划标题，代码侧只动了一行注释）**

逐格对着实现读下来，设计期那几节写得比实现粗，粗的地方一律**改文档**、不反过来把实现拽回设计期的说法；
只有一处是文档写了一个**不存在**的捷径，处理方式也是改文档（把"没做、且不该做"写清楚），不是补功能。

| 偏差 | 落到 spec 哪一格 | 证据（磁盘现行） |
| --- | --- | --- |
| §5.6 布局那一格没写四档折叠、占位行、两份全同的零块形状 | §5.6 布局追加三块 | `CONTEXT_VALUE = { diff: 0, 3: 3, 5: 5, all: Infinity }`（`diffWorkbench.js:87`）与 `DEFAULTS.context='3'`（`:80`）、三枚快捷键 `to:'all'/'3'/'diff'`；**"点开 = 把档调成 `all`、所有折叠条一起归零"**不是逐块展开，理由写在 `unifiedText(result,{a,b,context})` 那一层；占位行 `--fill`（行在、不写 `data-*-ln`、行号格与正文留空，`diffView.js:134`） |
| §5.6 行内细化写的是"按**码元**"、且只有"三分类"一句话 | §5.6 那一枚 bullet 重写 | 三条有序规则 `/\s+/y` → `/[A-Za-z0-9_]+/y` → 逐码点 `codePointAt`（`diff-core.js:230-275`），粘滞正则的理由是 5 MiB 单行上 `slice` 会退化成 O(n²)；`text`/`key` 二元；**两道各判各的闸**：形状 `MAX_INLINE_TOKENS=4000`（两侧之和、单侧 limit 切到 4,001 收手，`:74`）与总量 `MAX_INLINE_WORK=3,000,000`（对齐格子数、first-fit，`:97`），`DIFF_NOTES.inlineSkipped` 点名两档 |
| §5.6 第 3 条"不自动跑"暗示有一条 `Ctrl/Cmd + Enter` 快捷触发 | §5.6 那条写回"从未落地、也不该落地" | `grep Enter dev/js/tools/diffWorkbench.js dev/js/toolDiff.js` **零命中**；页面源 `tools-diff.html:106-108` 那段块注释本来就写着"装配层没接 Enter 也没接 ⌘+Enter（裸 Enter 在 textarea 里必须是换行）… 写一句不存在的捷径比不写更坏"；按钮文案是「重新对比」（`:240`）；判据钉在 `diff/9d` |
| §7「输入硬上限」那一行写"四个数 / 另两档" | 该行改口为**五个数 / 另三档** | `MAX_COST=2000`（`diff-core.js:69`）之外还有 `MAX_INLINE_TOKENS` 与 `MAX_INLINE_WORK`，逐个带行号；曲线读数（D=1000 → 284ms、D=5000 → 3720ms）与 A/B（126ms vs 857ms，6.8 倍）记在同一段 |
| 同一行「超了怎么办」写"三页各自的闸门形状见 §8.3" | 改口**四页**并注明改口日期 | 本行原写"三页"，2026-10-01 段 5 Task 9 随第四页落地改口 |
| §6.1 那条 postcss 黑名单待办 | 记成已落 | `.df-` 已补进黑名单、注释改成"在线工具四页…这三串"（`postcss.config.js:82`、`:87-89`）；复算 `grep -n "'.tk-'\|'.jt-'\|'.df-'" postcss.config.js` = 3 行 |
| §8.1 §X 那一族的描述停在"行内 token 三分类" | 换成三条有序规则 + 两道闸的口径 | 点名 X16 / X17（形状档）与 X29 / X28（总量档）、X20（2×上下文合并边界） |
| §8.1 末句"照上面那条 awk 现算"指向一条**不存在**的 awk | 换成可跑的那条 | `awk '/^test\(.(X\|Y\|Z)[0-9]/{c[substr($0,7,1)]++} END{for(k in c) printf "§%s=%d ",k,c[k]; print ""}' scripts/toolkit-tests.mjs` → §X=29 / §Y=18 / §Z=29，全文件 `grep -c "^test("` = 439 |
| §8.3 对账表「三页真实传输字节」「禁用 JS 打开三页」两行没有第四页 | 两行各 += 一项 | `diff/5a`（阻塞集本地 231,630B / 7 件，本页专属四件全 non-blocking：`toolkit.min.css` 10,841 / `toolDiff.min.css` 9,944 / `toolkitCore.min.js` 19,409 / `toolDiff.min.js` 51,841，HTML 46,074B，非阻塞 28 件 / 资源表 37 件）与 `diff/4a`（按钮 14 = profile 声明 14；`main` 内 select 3 / textarea 2 / checkbox 2 / file 2，控件总数 23 正踩下限；结果区 innerHTML 0；正文 禁JS 1,133 字 / 开JS 992 字 = 114.2%） |
| §8.3 缺一整段"第四页进同一张表"的账 | 新增一段 | 115 项 / 红 0 / `exit=0`（`run-t7-all4.log`，收轮负载 31.8），按页 18 / 18 / 29 / **41** + `0a`–`0f` 6 + `11a`–`11c` 3；`TK_PAGES=diff` = 50 项红 0；diff 专有那 7–10 族共 22 项、通用 1–6 族 19 项；**并如实写下没关的账**：`scripts/verify-tools-browser-teeth.mjs` 仍是段 4 那九项、文件头"在线工具三页"未改口、段 5 没为 diff 那 22 项补浏览器侧的刀 |
| 本计划 Task 5 那格标题写"（整文件，**761 行**）"，磁盘读到 **811 行** | 标题改口为 811 并给复算（唯一落在本计划正文的对账改动） | 复算 `wc -l < dev/js/tools/diffWorkbench.js` = 811；`git log --reverse -- 那件文件` 逐格数到行：`ff9a878`（Task 5）761 → `93d6e12`（Task 6 落第四页骨架）810 → 本格 `:48` 注释换行 811。**门禁② 一直抓不到它**：它核的是围栏内容与磁盘逐字节全等，标题里那个数不在核对范围（Task 5 Step 2 那句"落 761 行"是当时的历史读数，不改） |

**代码侧只动了一格**：`dev/js/tools/diffWorkbench.js:48` 文件头注释写"§Z 二十八判"，而 §Z 现在是二十九判
（Z29 是 Task 6 那一步加的，`93d6e12`）。这是注释与实现不一致、且注释错了，所以改注释。
纯注释不参与产物：terser 剥注释，改完之后磁盘上 `assets/js/toolDiff.min.js` 的 md5 仍是
`2b5cefa39b29e02cbbcd0b1a171cf2cd`，与 §7 记的 Task 7 那一份**一字不差**（`grep -c "档位只有一个口径" assets/js/toolDiff.min.js` = 0，
源码里是 1）。代价是门禁② 的镜像要跟着走一次 `verify-plan-blocks.mjs --fix`（见 Step 5）。

**Step 2 全表复量**：读数、十二枚 md5 自证、"一件都没有重建"的论证与两处历史行内读数的归因，
整段落进 spec §7 那一格末段（标题「2026-10-01 段 5 Task 9 收口复量」），本计划不重抄第二遍。
一句话结论：**八行逐行与 Task 7 对上、0 行漂移**，两把尺下"低于 5%"的仍是同两格。
口径滑过一次，滑在量具上：第一次同源比对用了 `gzip -9 -c f`，`diff.html` 量出 12,586B 而 §7 记 12,576B，
差的正是 FNAME 头那 10B；换成钉死的 `cat f | gzip -9 | wc -c` 之后八行全部对上。

**Step 3 死锚点交回**：两份代价的完整逐笔读数（三棵隔离 jekyll 树 + 两发 vite build + headless 实测滚动落点）
落在 spec §7 末段那一格，§8.3 那一格补了一句指针。三句话结论：
**修 A** = HTML +45B 原文 / gzip L9 +1B（证件）、+4B（编码），另要 `parseHash` 双认，那笔共用件 JS 实测
**gzip L9 +32B / L6 +31B**，只落在四行「JS+CSS」那一族（首屏四行不含 `toolkitCore.min.js`）；
证件页首屏重量后余 **368B（2.2%）/ 305B（1.9%）**，较大那把尺离 §0.3(b) 的 300B 线只剩 5B。
**修 B** = HTML 原文 +220B / gzip L9 +30B（证件）、+219B / +34B（编码），JS 零改动，
但重量后证件页首屏余 **339B / 277B——较大那把尺掉到 300B 线以下 23B**，
且实测那 10 枚空 `<span>` 是 `.tk-workspace`（`dev/sass/toolkit.scss:122-127` 是两列 grid）的第 11–20 个网格子项，
同页 `scrollHeight` 从 3,862px 涨到 6,993px，而 `.tk-panel` 的 `scroll-margin-top: 88px` 只对被滚进视野的元素生效，
**"跳过去不被顶栏盖住标题"这一条恰恰失效**。两条都没在本格擅自落地，判定交回人。
量具自己滑的那一发也记进本格：第一发 C 树多带了 `--baseurl ""`，连没动过的 json/diff 两页都差出 –792B 原文 / –21B gzip，
判据当场失真；改回与 A/B 同口径重跑，未动的两页回落 +0B，那个 +0 才是"差值来自这一刀"的对照件。

**Step 4 落点：不改，登记成欠账**。计划里那句前置（"等对方那格 `1/76` 先落地"）**没满足**：
`USAGE.md` 在索引里那枚 staged blob 是 998 行（`@@ -775,11 +775,7 @@`、`@@ -1000,74 +996,3 @@` 两块，合计 1 插入 / 76 删除），
它连段 4 那次重量后的 29/185 都还没带上——**索引里那一格仍写 `CollectionPage 27 … = 175 块`**，
而工作树那两行是段 4 留下的 `29 / 185`、未提交。照 §0.7 第 4 条与"共享工作树里只暂存自己那段"，本轮一个字不碰 `USAGE.md`。
现算的数记在这里，谁落地那一格谁用：拿 USAGE.md 第 3 条那段 python 探针（`<script type="application/ld+json">` 逐块 `json.loads`、
按 `@type` 计数）指着一份完整 `_site` 跑，本轮快照 = Step 3 那棵 A 树，读数是 **JSON-LD 块 186、`CollectionPage` 30、解析失败 0**。
措辞要跟着改的两处：`29 … = 185` → `30 … = 186`；`CollectionPage 那 29 块分三段` 里 `/tools/ 下的 idcard、codec、json 三页` →
**四页（含 diff）**，三段拆法随之是 4 + 18 + 8。复算口径与段 4 那句"别拿导航项数目去推"同源。
顺带登记一笔危险：对方下一次裸 `git commit`（从共享索引出发）会把那枚 998 行的 `USAGE.md` blob 与那枚 spec blob 一起写进去，
**USAGE.md 的计数格会退回 27/175、而本轮 spec §7/§8.1/§8.3 的写回会被整块抹掉**。

**Steps 1–4 落到工作树的只有三格**（口径 = `git diff HEAD --numstat -- <那一格>`，HEAD 指 `c99dda9`）：
spec（§5.6 三处、§6.1 一处、§7 两格、§8.1 两处、§8.3 三处）读到 **+159 / −11**、
`dev/js/tools/diffWorkbench.js`（`:48` 那一行注释，`2/1`，md5 `374e3910079a2017aed41a2756d246e9`）、
本计划（本格 + Step 5 那一段 + Task 5 标题那一格的改口；**这一格不自数**——这段记录自己就在被数的那几行里，
钉死必自指，落笔后的真值以那一发提交的 `git show --stat` 为准）。
`verify-plan-blocks.mjs --fix` 顺带把 §Z 那一块镜像整块换成改注释后的磁盘内容（磁盘 810 → 811 行，块随之 +1 行，
计划总行数此刻 7,689 行、`c99dda9` 那份是 7,604 行）。
判据那本 `scripts/toolkit-tests.mjs` md5 仍是 `e70eacbc646ee4ce81468130c8d3ef1d`，与 Task 8 记的基线一字不差——
本轮没加判据、没改判据。

**Step 5 六道读数（活树，2026-10-01 16:57–17:20；本格文本最终落定后 ②③ 各复跑一次，见那两行末尾的"复跑"）**

① `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs`：
`# tests 439 / pass 439 / fail 0 / cancelled 0`，退 0；开跑前负载 46.7（1 分钟档），没有触发 §0.8 那句高负载假红。
② 第一跑退 1 并点名 `✗ 1 个目标对不上：dev/js/tools/diffWorkbench.js`——正是 Step 1 那一行注释造成的镜像漂移；
`--fix` 重写那一块（计划[段5] 5076–5885 ← 磁盘 811 行），**`--fix` 自己退 1 是设计**（末尾那句"再跑一次本脚本确认"），
复跑退 0：76 个已落地镜像 / 合计 1,626,831B / 未落地 0 节，计划 js 块 65 个（段1 11、段2 19、段3 15、段4 12、段5 8）。
**复跑（17:29，Step 5 那一段记录写完之后）**：仍退 0，`--fix` 不再需要动笔，76 镜像 / 1,626,831B 两个数一字未变——
本格的正文不是镜像，改它不会让这道门禁红，这一行记的就是"记录本身落定后仍是绿的"。
③ `verify-plan-blocks-teeth.mjs`：**41/41** 退 0，末尾"副本回到全绿且工作树未被这些实验碰过"，脏指纹
`f5180a2d4928b8d4` 前后一模一样（26 个脏项，含另一路会话那批，一律未被触碰）。
**复跑（17:31）仍 41/41 退 0**，脏指纹换成一枚新的 `b5113dff1d2462ff`（26 项不变）——指纹里的内容跟着本格正文变是应该的，
它自证的只有"跑之前和跑之后是同一份工作树"，不要求跨轮相同。
④ 归 Step 5 后半：这道门禁读 `git archive HEAD` 导出的**提交态**，在活树跑等于拿工作树自证工作树。
⑤ `check-tools-surface.mjs`：退 0，4 条 ready × 5 组判据全绿，导航核到 101 页。
⑥ `check-tools-surface-teeth.mjs`：**67/67** 组变异如期变红 + "全部变异已还原，复跑基线仍绿"，退 0。
这一道滑过一跤、红在量具自己手上：第一发被超时打断（外壳收到 SIGTERM，`node` 那一发其实仍在跑），
我随即起了第二发——两发同时改同一批源文件，第二发的基线复跑读到 `CONTAINER_ID='jt-box'`（那是第一发正在还原的中间态），
于是报了 `✗ [DOM] json：… 与 yml prefix 推出来的 "jt-workspace" 不一致`。**那一条红不是产物问题，是并发踩源**；
第一发随后自然收口，67/67 全绿、`dev/js/toolJson.js:38` 回到 `'jt-workspace'`、`git status` 逐格自证与开跑前一致。
教训与项目记忆里"e2e 前先清遗留进程"同一条：这一类的红要先 `pgrep -f check-tools-surface` 数一遍进程再判。

**Step 5 后半：门禁④ 与提交态自证（`5919c69` 落笔之后，在导出树里跑的那一发）**

**落笔 = `5919c69`**（`c99dda9` → `5919c69`，§0.7 那套 CAS：临时索引 `node_modules/.seg5t9-scratch/seg5t9-index`
上 `read-tree <旧 sha>`、三格各自 `hash-object -w` + `update-index --add --cacheinfo`、新树 `87fff43` 先与旧树
`50149ac` 比过"必不相等"再 `commit-tree -F` 那份信息文件、`update-ref refs/heads/main <新> <旧>`）。
`git show --stat` 读到正好三行、**256 insertions(+) / 18 deletions(-)**，三格 blob `c58f1046 / 27ff2e4c / f83c7993`。
**索引对齐只对我那两格做**（本计划、`diffWorkbench.js`）；spec 那一格**故意不对齐**——共享索引里挂着另一路会话那枚
`7c009a3c…`，对齐它等于替他们把那一格重写。跑完 `git ls-files -s` 复读到它仍是 `7c009a3c…`，而 spec 在我这一发之后是
`MM`：`HEAD` 有本轮 §5.6/§6.1/§7/§8.1/§8.3 的写回，索引那枚却**比 HEAD 旧**（它把 §7 对比页两行退回"待量"、
把 09-29 批 IV 与 10-01 Task 7 那两段整体删掉，`git diff --cached` 读到 +3 / −66）。
**他们下一次裸 `git commit` 会把这枚旧 blob 写进 master**，与 Step 4 记的 `USAGE.md` 那笔是同一条危险的两个头。

**量具自己那一刀（先记账再读数）**：第一发整轮红、外壳退出码却是 0。红因在脚本第 9 行
`REPO="$(cd ../../.. && pwd)"`——从 `node_modules/.seg5t9-scratch` 往上数三层落到仓库的**父目录**，
于是 `git -C "$REPO" archive` 立刻 `fatal: not a git repository`，两棵导出树各 0 件，
连带 vite `exit=1`、jekyll `exit=1`、①②③⑤ 全 `exit=1`。修法 `../..` 再加一句
`[ -d "$REPO/.git" ] || exit 1` 的前置断言；那一发 fatal 已按原表达式复现一次（同一条文案），
开跑前 `pgrep -fl "vite|jekyll|verify-plan|check-tools"` 空。**这一格与 §0.8 那句"红了先查量具"是同一件事，
只不过这次量具没挂在判据上、挂在路径解析上。**

**门禁④（两棵导出树真重建 + 三列字节表）**：`export-base` = `git archive c99dda9`、`export-work` = `git archive 5919c69`，
两棵各 **1,151** 件（落在 gitignored 的 `node_modules/.seg5t9-scratch/export-*`，不放 `/tmp`），各 `ln -s` 活树 `node_modules`，
各跑一发真 `npx vite build`（Node v22.19.0；`✓ built in 17.72s` / `8.46s`，两边 `exit=0`）。件集 37 件
（`assets/js/*.min.js` 25 + `assets/css/*.min.css` 12），口径 `stat -f%z` 与**逐件** `cat f | gzip -N | wc -c`：

| 树 | 件 | 原始 | L6 逐件之和 | L9 逐件之和 | 清单 md5 | 逐件内容 md5 的合集 |
| --- | --- | --- | --- | --- | --- | --- |
| `export-base`（c99dda9） | 37 | 853,571 | 269,928 | 269,142 | `27b3d6cb…` | `cda922ef…` |
| `export-work`（5919c69） | 37 | 853,571 | 269,928 | 269,142 | `27b3d6cb…` | `cda922ef…` |

`import{` 在那 25 本 js 里逐本 `grep -c` 求和 = **0**。**这一发的读数是等式**——本格代码侧只有
`diffWorkbench.js:48` 一行注释，terser 剥注释，提交态产物必须逐件相同；等式本身就是"注释刀没把产物带下水"的证据，
§7 那八行不需要重立（三枚关键 md5 另在 Step 1 那一段：`toolDiff.min.js 2b5cefa3…` / `toolkit.min.css 8d355faa…` /
`toolkitCore.min.js 2ae1f8eb…`，导出树与活树磁盘一字不差）。

**与 Task 8 那一格的 aggregate 对不上，差在口径不在产物**（不许把这 628B 读成"产物变小了"）：那一格记
L6 270,556 / L9 269,770，正文钉的是 `gzip -6|-9 -c f`（带 FNAME 头）。同一棵 `export-work` 今天按那把尺逐件之和是
**270,286**、按 §7 开头钉死的 stdin 口径是 **269,142**，两个都不等于 269,770（差 516 与 628），
而 raw **853,571** 与逐件清单 md5 **`27b3d6cb…`** 两处与那一格一字不差——件集相同、原始字节相同，只有 gzip 那一列复算不出来。
处置：**跨格只比同一口径**，本格的 aggregate 以 stdin 口径为准（`cda922ef…` 这一枚也是同一把尺下的），
逐件数另有 §7 那张表；Task 8 那一格的数保留原样、不改写，因为改写它要连带重量它那一轮的三列，不属于本格。

**work 树里真 `bundle exec jekyll build --trace`**：`exit=0`、`Liquid Warning` **0** 条、`_site` **938** 件。

**提交态四道人**（都在 `export-work` 里跑；跑前 `git init -q .` + `git add -A .`，否则门禁③ 末尾那句
"实验前后工作树脏指纹一字不差"会拿 `fatal: not a git repository` 连一项都不跑）：
① `# tests 439 / pass 439 / fail 0 / cancelled 0` 退 0；② 退 0，"全部已落地镜像与磁盘逐字节全等（未落地 0 节）"；
③ **41/41** 退 0；⑤ 退 0，"收录面 4 条 ready 条目 × 5 组判据全绿"、导航核到 **101** 页。
**Task 8 那一格欠的那一档在本格关上**：那一次 ⑤ 靠 `ln -s` 活树 `_site` 才跑通，只到"提交态的源对得上活构建的产物"；
这一发导出树里有自己重建的 938 件 `_site`，所以"干净机器上重建 `_site` 也能过"这一档现在有据。
两处仍带快照性质、不算零依赖自证：`node_modules` 与 `vendor` 是 `ln -s` 活树的。
**门禁⑥ 不在导出树跑**：它按 §0.8 要在源文件上原地打 67 发变异，在提交态树上跑等于改提交态的工作树，
Task 8 已处置过一次，本格沿用（⑥ 的活树读数 67/67 见上面那段）。

于是 Step 5 的六道：①②③④⑤ 各有**活树 + 提交态**两份读数、全部退 0，⑥ 只有活树一份（67/67），形状与 Task 8 那格一致。


**Step 3 的处置：判定=修 A，落地记录（2026-10-01 同一轮，代码与文档各一次提交）**

三问三答都来自 2026-10-01 那一轮 AskUserQuestion，逐条照答执行：
**推送**=「现在就推，45 条一起上」（已执行，见上面 Step 6 那格）；**索引条那 10 枚死锚点**=**修 A**（索引条标题挂真锚点）；
**`kb()` 那句「多了 0.0 KB」**=**保留现状**——本段 §0.6 第三行那笔欠账**仍在账上不动**，10e 的超限夹具仍按 4,096B 绕开它。

**代码侧六件**（`git diff --numstat` 逐件，行数为磁盘现读）：

| 件 | 行数变化 | 改了哪一件事 |
| --- | --- | --- |
| `dev/js/tools/panel.js` | 228 → **242**（+16 / −2） | 新增 `stripPanelPrefix(s)`（`s.toLowerCase().lastIndexOf('-panel-')`，`at < 0 ? s : s.slice(at + 7)`），`parseHash` 改成**先剥尾段再查白名单**；docstring 从一行扩成一段，写死"两种形状各有各的写入者"与"剥头不等于放宽" |
| `scripts/toolkit-tests.mjs` | 15,462 → **15,495**（+35 / −2） | D4 补判据（见下）＋ `iPage` 夹具的 tab seed 改挂真锚点。**全文件判数仍是 439**，只加断言不加 `test()`，别的格子不必改号 |
| `tools-idcard.html` | 486 → **490**（+6 / −2） | 索引条 `href="#{{ tk.prefix }}-panel-{{ p.slug }}"` ＋ 那一格注释重写（点名"段 5 Task 9 之前这里挂的是裸 `#slug`，五块面板 × 两页 = 10 枚死锚点"） |
| `tools-codec.html` | 396 → **398**（+4 / −2） | 同一刀，注释短写并指回证件页那一格 |
| `scripts/check-tools-surface.mjs` | 843 → **871**（+28） | 门禁⑤ `checkDomContract` 的 `panels` 分支新增一段：`.tk-index__link` 枚数 == 面板数、每枚必须有 `href="#…"`、**那串指向的 id 必须在本页产物里真实存在** |
| `scripts/check-tools-surface-teeth.mjs` | 635 → **680**（+45） | 三刀牙（见下），台账 67 → **70** |

**D4 新增的判据（一条 `test()` 里，认与不认各四串）**：认 `#idcard-panel-uscc`、`idcard-panel-uscc`（无 `#`）、
`#IDCARD-PANEL-USCC`（全大写）、`#bankcard-panel-bankcard`（"前缀与 slug 同名"那一形）；
仍判未知 `#idcard-panel-nope`、`#idcard-panel-`（标记后是空串）、`#idcard-panel-uscc-z`（尾段多一截）、
`#panel-uscc`（**只有标记、没有前缀**——这条第一版写成了"应该认"，是错的：标记的定义是"前面还得有东西"，
而这两种形状都由本页自己写入，没有第三种形状值得再补一条规则）。另有 workspace 级三发：
以 `hash: '#idcard-panel-random'` 开局要 `active() === 'random'`、`unknownHash() === false`，
`select('mobile')` 之后 `toHash()` 写回的**仍是裸 `#mobile`**——地址栏那一形不许分叉。
夹具那一改的理由记在测试注释里：`iPage` 的 tab seed 原本挂裸 `#${id}`，与产物不同形，
"href 是禁 JS 时的深链保险"这句话在测试里量的是一枚产物上根本不存在的 href。

**TDD 两发**：先只有 D4 那几条新断言 → `node --test --test-name-pattern` 单跑那一判，
红在 `#tk-panel-uscc` 那串被 `parseHash` 判成 `unknown`（`node_modules/.seg5t9-scratch/fixA/d4-red.log`）；
落 `stripPanelPrefix` 之后同一发绿（`d4-green.log`），再跑全量 ①（439 / 439 / fail 0 / cancelled 0，`gate1.log`）。

**落地读数比预测贵 6B，理由要说清**：Step 3 那一只打在 D 树副本上的补丁是**大小写敏感**的
`s.lastIndexOf('-panel-')`，量出 `toolkitCore.min.js` gzip L9 +32B / L6 +31B；落地这一只多了一次 `.toLowerCase()`，
实读 **+38B / +37B**（`7,037 → 7,075` / `7,049 → 7,086`，md5 `2ae1f8eb…` → `0d693c1b…`）。
多的那一次不贵，但没有它 `#IDCARD-PANEL-USCC` 就会从"认得"掉回"未知"，而 `parseHash` 查白名单那句本来就是
大小写不敏感的——两处口径必须同形，否则判据红在第一发、静默绿在第二发。四行「JS+CSS」因此各 +38 / +37，
首屏那四行只涨 HTML 那一头（证件 +1B / 编码 +4B gzip L9，与 Step 3 的预测**逐字相同**）；
八行的现行读数、余量与逐件之和的复算口径写在 spec §7「2026-10-01 判定已收到并落地：修 A」那一格，本计划不重抄第二遍。
最要紧的那一格在这里点名：**证件页首屏余 368B（L9）/ 305B（较大者），§0.3(b) 的 300B 线仍守着，
较大那把尺从 7B 只剩 5B**——这一格现在是全表最薄的一格，下一格往 `<head>`、头家族或共用的 `toolkit.min.css`
里加任何东西，先重量它。

**三刀牙（门禁⑥，67 → 70/70）**：① 证件页索引条 href 退回裸 `#slug` → 红在「`href="#uscc"` 在产物里落不下去」；
② 那一枚整段没有 `href` → 红在「索引条那枚没有 `href="#…"`」；③ 只改编码页那一枚 → 红在编码页那一格
（这一刀证明它不是"两页合并数一遍"，而是逐页各核）。三刀各带一句 `if (next === s) throw`——
变异锚点没命中就当场抛，不给"静默不红"留位置。跑完还原，复跑基线仍绿（`gate6.log`：70/70 组变异如期变红、
"✓ 全部变异已还原，复跑基线仍绿"）。

**浏览器侧：一次性量具，不加常驻判据**。为什么不加：常驻判据只能挂进 `scripts/verify-tools-browser.mjs`，
而它配套的 `scripts/verify-tools-browser-teeth.mjs` 那六刀是**直接改共享真产物**（仓库 `_site` 与 `assets/**`）的，
本轮并行会话仍在那棵工作树上写 `_config.yml` / `dev/js/editorial.js` / `USAGE.md`——跑一次等于掀他们的现场。
所以锚点指向这条红线落在静态那一头（门禁⑤ + ⑥），浏览器这一档留成可复跑的量具，读数：
把 `_site/tools/idcard.html` 摘掉全部 `<script>`（脚本 0 枚、`innerWidth` 自证 500）后开 `file://`——
**修之前**点裸 `#uscc`：`scrollY = 0`、`document.getElementById('uscc') === null`；
**修之后**十枚逐个走（证件 5 + 编码 5）全部落得下去，`.tk-panel` 顶边逐枚 **88px**
（`scroll-margin-top: 88px` 顶开 65px 粘性头），证件页 `#tk-panel-random` 那发 `scrollY` 0 → **4,514**，
编码页五枚落点 `yReal` 依次 515 / 1,413 / 2,211 / 2,778 / 3,496。开 JS 那一档同页自证向后兼容：
以 `idcard.html#tk-panel-uscc` 开局 → `tk-panel-uscc` 显示、`tk-tab-uscc` 带 `aria-selected`、提示条 `hidden`、
`scrollMargin` 读到 `88px`，`select('mobile')` 之后地址栏写回 `#uscc`。
四页同表的浏览器全量在本轮重跑过：**115 项 / 红 0 / `exit=0`**（起跑 1 分钟负载 5.7、收轮 36.5，
`node_modules/.seg5t9-scratch/fixA/browser-full.log`），项数与 Task 7 那一轮一字不差。

**站内同页那一形 `href="#…"` 落空复算**（`_site/**/*.html` 的 `href="#x"` 与同页 `id="x"` 求差集，Node 现读）：
**14 枚 → 4 枚**，工具页那 10 枚**归零**，剩 `_site/2023-06-07/common-search-algorithm.html` 的 2 枚中文 TOC
（「二叉搜索树查找」「AVL树、红黑树、B树/B+树查找」）与 `demo/vueRouterDemo/hashRouter.html` 故意写的
`/home`、`/about`——两枚都不在本节的账上。**spec §8.3 那句"那一行仍然只记半笔账"到此结清**，
§6.3 加了"两种 hash 形状都认"那一格，§8.2 加了第 7 条（索引条锚点指向的产物侧判据）。

**这把尺只量同页那一形，跨页那一形另有 10 枚没动**（评审回合指出、我按两把尺各自复算坐实）：
落地页 `tools.html:152` 那句 `href="{{ tool.url | prepend: site.baseurl }}#{{ p.slug }}"` 写的是
`/better-blog/tools/idcard.html#uscc` 这一形——片段不在本页求，所以我上面那句"全站"必须收口成"站内同页那一形"。
把跨页那一形也按目标页的 `id` 求差（遍历两棵 `_site`，跳过 15 枚站外绝对 URL）：
带片段的 href 共 **2,344** 枚，`export-base` 站内同页落空 **14** ＋ 站内跨页落空 **10**，
`export-work` 站内同页落空 **4** ＋ 站内跨页落空 **10**——**那 10 枚在修 A 这一刀之前与之后一字未动**，
全部来自落地页那两张工具卡的速览清单（证件 5 + 编码 5）。
它们的失效形状与被修掉的那 10 枚**同源但更轻**：开 JS 时目标页 `parseHash` 认裸形，面板照样选中（这 10 枚是活的）；
禁 JS 时面板全部静态可见、只是滚不过去。修法同修 A 那一刀（`#{{ tool.prefix }}-panel-{{ p.slug }}`），
代价实测在 D 树副本上量过一次：**10 枚、raw +90B、L9 +8B、L6 +9B**，而 `tools.html` 不在 `ROWS`
（`scripts/verify-tools-browser.mjs:2702` 那八行只覆盖四页工具页），**没有预算格会因此挪动**。
为什么本格不顺手做：它改的是**落地页那十枚链接的落点**（交互面），而 2026-10-01 那一轮批准的措辞是
"索引条那 10 枚死锚点"，把落地页算进去属于扩范围——按"影响交互先给方案"那条交回人判，
本格的账到这里钉死成"**同页那一形已归零、跨页那一形 10 枚待判**"。

**镜像与门禁的本轮状态**：门禁② 在源码落地后报 6 处失配（预期，动的是三格镜像的宿主），
按批准过的 `--fix` 同步后复跑退 0——**76 个已落地镜像合计 1,630,637B、未落地 0 节**；被 `--fix` 重写的三格：
段 1 计划 +46 / −2（`panel.js` 那一块与它的镜像登记）、段 2 计划 +39 / −4（三块）、段 3 计划 +4 / −2（一块）。
⑤ 退 0（4 条 ready × 5 组判据全绿）。重建两件都 `exit=0`（`vite.log` / `jekyll.log`），
产物 HTML 上 `href="#tk-panel-…"` 十枚逐枚可数。① 与 ③ 与提交态那四道人
（`export-base` = 本轮之前的 `c542feb`、`export-work` = 修 A 落笔之后的 `59dee1e`）**已在本节末那一格自证完毕**。

**一笔危险复记**（Step 4 那条的本轮版本，读数会变、结论不变）：本轮往 spec 又写了四格（§6.3 / §7 / §8.2 / §8.3），
而共享索引里那枚 `7c009a3c…` 仍**比 HEAD 旧**、`USAGE.md` 那枚 998 行 blob 也还挂着。
另一路会话下一次裸 `git commit` 会把这两枚旧 blob 写进 master，**本轮的四格写回会整块退回**——
产物与判据不受影响（那 10 枚锚点已经真修好、门禁⑤ 的判据在磁盘上），坏的只有文档那一头。
索引对齐照旧只对我自己的路径做，`7c009a3c…` 与 `USAGE.md` 那格一件不动。
**这一句在写它的那一刻是假的**——`801635b` 落笔时 pathspec 里带了 spec，那一格已经被刷成我的 blob，
"不动"是事后用 `git update-index --cacheinfo` 恢复出来的。恢复过程与这条学费写在本节末那一格。

---

**Step 3 的收尾：修 A 的提交态自证（两发落笔之后，在导出树里跑的那一发）**

**落笔 = 两发**。`801635b`（代码六件 + spec 四格 + 段 1/2/3 计划镜像与写回，`git show --stat` 复读 11 格、
+377 / −19）与 **`59dee1e`**（续笔三格，`git show --stat` 复读正好 3 行、+31 / −1：`scripts/toolkit-tests.mjs` +11、
段 1 计划 +11、段 4 计划 +10 / −1）。两发的信息都走 `-F` 那份文件（`fixA/msg-feat.txt` / `msg-followup.txt`），不走 heredoc。

**续笔那一格补的是什么**：D4 里加一族 `for (const id of TOOLKIT)` 循环，逐个把裸 slug 喂给 `parseHash`，
把"剥尾段那一刀对任何裸 slug 必须是恒等"这条**前提**钉住——`stripPanelPrefix` 唯一的失效形状是"面板 slug 自己含
`-panel-`"，而 slug 全来自 `_data/onlineTools.yml`，多出那样一枚属于数据改动，不该让用户的深链先撞上。
**为什么不改成产物侧的宽容**：加一条"先整串查、查不到再剥尾段"的 fallback 会在产物里养一条永不生效的分支
（约 25B），而证件页首屏那一格较大那把尺只剩 5B。判数不变，仍是 **439**。
`--fix` 把段 1 计划那一块整块换成磁盘内容：磁盘 §D 那一块 **19,335B → 20,190B（+855B）**，
计划那一块 **19,334 → 20,189**（少的那 1B 是围栏收尾换行的口径，两块按门禁② 是逐字节全等）。
**顺带量到门禁② 自己那一列的口径**：跑完两发的合计是 76 块 **1,631,116B**，比上一轮的 1,630,637B 只多 **479**，
而 §D 实打实长了 855B——差的 376 全部是多字节字符。`scripts/verify-plan-blocks.mjs:565` 那句是
`b.text.length` 累加，**那一列的单位是 UTF-16 码元不是字节**，打印却写作 `B`。本格不动它（只影响一行汇总文案、
不影响任何判据），但**跨格比那一列之前先想清楚这条**，否则会把中文字符数当成字节数追一场 phantom 差额。

**本轮新学费：部分提交的 pathspec 会刷掉别人挂着的暂存格**。`801635b` 用的是
`git commit -F <信息文件> -- <11 条路径>`，其中列了 spec 那一格——porcelain 的部分提交会把**列进去的那些路径**
在真索引里刷成提交态，于是另一路会话挂在那格的那枚 `7c009a3c…` 变成了我的 `4fc7e5ac…`。
发现靠的是落笔后照例复读 `git ls-files -s`（这条动作从段 4 起就是硬规矩，本轮第一次抓到它救回来东西）。
恢复三步：① `git cat-file -e 7c009a3c…` 证那枚对象还在（对象库不动，被改的只是索引）；
② `git cat-file blob 7c009a3c…` 整份落 `fixA/their-staged-spec-7c009a3c.md`（**127,088B**）留底，
万一后续再丢还能原样放回；③ 改前先复读那一格现挂什么，再 `git update-index --cacheinfo 100644,7c009a3cb…,<spec>`
换回去。自证：`git ls-files -s` 那格回到 `7c009a3cb462d0445c001de944a1a4a012e8e216`、`git status` 里 spec 又呈 `MM`，
他们另四格（`USAGE.md e8f821ff8…`、`dev/sass/toolkit.scss 330fb304b…`、`_config.yml 3f0b74e0b…`、
`package.json d4e40c1d8…`）一字未动。**规矩就此收紧一档**：部分提交的 pathspec 里**绝不出现别人挂着暂存格的路径**，
续笔那一发只列我自己那三格，落笔后五枚逐枚复读全在原位。

**活树三道**（`59dee1e` 之前）：① 退 0、`# tests 439 / pass 439 / fail 0 / cancelled 0`（`gate1-followup.log`；
起跑 1 分钟负载 **16.89**，按 §0.8 先 `uptime` 再看红没红——这一发没红，所以不必单跑自证）；
② `--fix` 后裸跑退 0，"全部已落地镜像与磁盘逐字节全等（未落地 0 节）"；③ **41/41** 退 0。

**门禁④（两棵导出树真重建 + 三列字节表）**：`export-base` = `git archive c542feb`、`export-work` = `git archive 59dee1e`，
两棵各 **1,151** 件、各 `ln -s` 活树 `node_modules`、各一发真 `npx vite build`（`✓ built in 16.54s` / `16.58s`，两边 `exit=0`）。
件集 37 件（`assets/js/*.min.js` 25 + `assets/css/*.min.css` 12），逐件口径仍是 `stat -f%z` 与 `cat f | gzip -N | wc -c`：

| 树 | 件 | 原始 | L6 逐件之和 | L9 逐件之和 | 清单 md5 | 逐件内容 md5 的合集 |
| --- | --- | --- | --- | --- | --- | --- |
| `export-base`（c542feb） | 37 | 853,571 | 269,928 | 269,142 | `27b3d6cb…` | `cda922ef…` |
| `export-work`（59dee1e） | 37 | 853,662 | 269,965 | 269,180 | `27b3d6cb…` | `8ea256e4…` |

`import{` 在两棵树的 25 本 js 里逐本 `grep -c` 求和都是 **0**。清单 md5 相等 ⇒ 件集没变，
差的 **+91 raw / +37 L6 / +38 L9** 全部落在 `toolkitCore.min.js` 一件上（逐件 diff 只这一行，其余 36 件一字不差）。

**四页 HTML 也出自提交态这一把尺**（两棵树各一发真 `bundle exec jekyll build --trace`，都 `exit=0`、
`Liquid Warning` **0** 条、`_site` **938** 件）：

| 页 | 原始 | L9 | L6 | md5 |
| --- | --- | --- | --- | --- |
| `tools/idcard.html` | 59,938 → 59,983（+45） | 13,709 → 13,710（+1） | 13,763 → 13,765（+2） | `8d74d6ae…` → `18e596d5…` |
| `tools/codec.html` | 53,954 → 53,999（+45） | 13,691 → 13,695（+4） | 13,747 → 13,749（+2） | `2056e6dc…` → `1501a4cf…` |
| `tools/json.html` | 40,476 → 40,476（0） | 11,483 → 11,483（0） | 11,520 → 11,520（0） | `d1065a3f…` 不变 |
| `tools/diff.html` | 45,774 → 45,774（0） | 12,576 → 12,576（0） | 12,619 → 12,619（0） | `c9e1e854…` 不变 |

同表里再补一枚**静态的修复证据**（把两棵 `_site` 的 `.tk-index__link` 逐枚拿同页 `id` 集合对，Node 现读）：
`base` 十枚**全落空**（`idcard` `uscc` `bankcard` `mobile` `random` / `timestamp` `base64` `url` `digest` `regex`，逐枚 ✗），
`work` 十枚**全落得下去**（`tk-panel-*` 逐枚 ✓）。这一条与上面那格浏览器实测同一件事，只是这一把尺跑在提交态、
不需要开 Chrome，也不碰并行会话那棵工作树。

**续笔没有把产物带下水，这里拿到等式**：work 那一发的四页 HTML 与 `toolkitCore.min.js` 的读数、
以及逐件内容 md5 合集 `8ea256e4…`，与上一发 `work=801635b` **一字不差**——`scripts/` 与 `_docs/` 都不进站点构建，
所以 +11 行测试与两格计划写回在提交态产物上必须是零差。

**提交态四道人**（都在 `export-work` 里跑，跑前 `git init -q .` + `git add -A .`）：
① 退 0、`# tests 439 / pass 439 / fail 0 / cancelled 0`；② 退 0、"全部已落地镜像与磁盘逐字节全等（未落地 0 节）"——
这一发同时自证"提交进去的那份计划镜像与提交进去的那份磁盘内容互为逐字节"，活树里我后来改的格不参与；
③ **41/41** 退 0；⑤ 退 0、"收录面 4 条 ready 条目 × 5 组判据全绿（页面源/收录/导航/图标/DOM）"、导航核到 **101** 页
（不渲染 header 的 18 份、无 canonical 的 16 份）。**门禁⑥ 仍不在导出树跑**：它要在源文件上原地打 70 发变异，
沿用上两格的处置，活树读数 70/70 记在上面那一格。`node_modules` 与 `vendor` 两处仍是 `ln -s` 活树，不算零依赖。

**记录本身也在提交态过一遍**（`a94fd40` = 本格那一发落笔之后，`export-docs` 一棵）：导出 **1,151** 件、
真 `npx vite build` `✓ built in 25.60s` 退 0、`bundle exec jekyll build --trace` 退 0（`Liquid Warning` **0** 条、
`_site` **938** 件），四道人 ①②③⑤ 各退 **0**（`439 / 439 / fail 0 / cancelled 0`、"全部已落地镜像与磁盘逐字节全等"、
**41/41**、"收录面 4 条 ready × 5 组判据全绿" + 导航 **101** 页）。
**这一发不该动产物，实测也没动**：`toolkitCore.min.js` 的 md5 与上面 `export-work` 那一棵同为 `0d693c1b…`，
件集 L9 逐件之和同为 **269,180**——`scripts/` 与 `_docs/` 不进站点构建这条口径在这里第三次拿到等式。

**量具自己这两刀（先记账再读数）**：① 外壳 `seg5t9-gate4-ab.sh` 最后一行指的是 `node ab-html.mjs`，
而读数器上一轮改名成了 `ab4.mjs`——`seg5t9-gate4.sh` 那一把明明 `exit=0`、四道人全绿，整条背景任务却退 1。
我第一反应去查 base 树的 jekyll 与 `ab4.mjs` 的缺文件路径，真因在最便宜的那一行上：**改完外壳的名字之后，
成功的那一段仍然全绿，只是它后面那一行死了**。② `ab4.mjs` 的表头把两枚 sha 写死在文案里（`base=c542feb / work=801635b`），
换 work 重跑时读数对、标签错——日志自己会说谎。改成从 `argv` 取、缺参数直接 `exit 2`，
重跑一次七行读数一字未变。两条都属于 §0.8 那句"红了先查量具"，只不过这回一个挂在文件名、一个挂在文案。

**于是修 A 这一刀的六道**：①②③④⑤ 各有**活树 + 提交态**两份读数、全部退 0，⑥ 只有活树一份（70/70），
形状与 Task 8、Task 9 那两格一致。三问三答至此全部落地：推送已执行（`origin/master` = `c542feb`，
线上 `/tools/{idcard,codec,json,diff}.html` 现在逐条 `curl` 读回 **200**，那两页 404 的老账结了）、
死锚点按**修 A** 修好并自证、`kb()` 那句按判定**保留现状**（§0.6 第三行那笔欠账不动，10e 夹具仍按 4,096B 绕开它）。
`main` 领先 `origin/master` 的条数按 `git rev-list --count origin/master..HEAD` 现读 = **2**（`801635b` + `59dee1e`，都未推），
推送这一格照旧要单独请示。本段剩下的只有段 6 那一格（删 `demo/idCardDemo/`、三处版本 2.2.0、CHANGELOG、全量评审）。

### 评审回合（修 A 落笔之后）：四问四答、两颗新牙、三处口径收口

修 A 那一刀写完派了一轮只读评审（"文档写完派只读 agent 逐条对实现查"那条规矩），交回四问。
**四问全部我自己复算坐实**，没有一条是"评审说的但量不到"——处置按"缺陷修代码、口径修文档、
交互与字节先给方案"那三条分头走。

**问 1「那 10 枚落地页锚点算不算被修掉了」——不算，我此前那句"全站"用错了尺。**
我复算落地页那一形用的是 `href="#x"` 与**同页** `id="x"` 求差集这把尺：它在语法上就接不到
`tools.html:152` 那句 `href="{{ tool.url | prepend: site.baseurl }}#{{ p.slug }}"`——片段挂在**另一页**上。
两把尺各跑一遍（遍历两棵导出树的 `_site`，各 **938** 件；口径钉死成"**片段非空**那一档"——
`href="#"` 这类占位不是锚点、不计，把 `[^"]*` 改成 `[^"]+` 就差这 2 枚与 1 枚站外，第一版我就是这样差出来的），
带片段 href 共 **2,344** 枚（其中站外绝对 URL **15** 枚只求数不求差），
`export-base`（`c542feb`）同页落空 **14** ＋ 跨页落空 **10**，`export-work`（`59dee1e`）同页落空 **4** ＋
跨页落空 **10**——那 10 枚**修 A 前后一字未动**，全部来自落地页两张工具卡的速览清单（证件 5 + 编码 5），
逐枚清单是 `idcard` `uscc` `bankcard` `mobile` `random` / `timestamp` `base64` `url` `digest` `regex`。
它们的形状与被修掉那 10 枚同源但更轻：开 JS 时目标页 `parseHash` 认裸形、面板照样选中（这 10 枚是活的），
禁 JS 时面板全部静态可见、只是滚不过去。
**代价先在补丁上量掉**（不量不给判）：把 10 枚片段补成 `tk-panel-` 前缀，`_site/tools.html`
从 **50,500 / L9 12,985 / L6 13,027** 变成 **50,590 / 12,993 / 13,036**（**+90 / +8 / +9**），
口径两遍各量一次——python `gzip.compress` 与 §7 钉死的 `stat -f%z` + `cat f | gzip -N | wc -c`——读数一字不差，
补丁副本落 `node_modules/.seg5t9-scratch/landing-patched.html` 可复算。
`tools.html` 不在 `ROWS`（`scripts/verify-tools-browser.mjs:2702` 起那八行只覆盖四页工具页，逐行读 `files:` 可验），
**所以这一刀不挪任何预算格**。为什么不顺手做：2026-10-01 那一轮批准的措辞是"索引条那 10 枚死锚点"，
把落地页的落点算进去属于扩范围，且它改的是可见链接的落点（交互面）——按"影响交互先给方案"交回人判。
**三处口径同步收口**（段 4 计划那条第 8 格、spec §7 那一段、本节上面那一格）：
"全站 `href=\"#…\"` 落空"改成"**站内同页那一形**"，本格因此钉死成
"**同页那一形已归零、跨页那一形 10 枚待判**"。

**问 2「门禁⑤ 判的是落得下去，指到兄弟面板仍绿」——对，补第二层判据。**
原判据到 `ids.has(hm[1])` 就收工：`tk-tab-idcard` 的 href 改成 `#tk-panel-random`（真实存在的面板）
在六道人面前全绿，而页面上"点第一块面板滚到最后一块"两种档位都不报错——开 JS 后 tab 的选中态跟的是
`data-tk-id`、与 `href` 无关，禁 JS 时浏览器只负责滚到那个 id。新判据把每一枚 `<a>` 自己的
`id="{prefix}-tab-{slug}"` 读出来，要求 `href` 逐字等于 `{prefix}-panel-{那个 slug}`；
`scripts/check-tools-surface.mjs` 871 → **897 行**（+26，含那段"判四件"的说明）。

**问 3「`stripPanelPrefix` 用 `lastIndexOf` 是不是错，该改成 `indexOf`」——两者都救不了那一族，改判据不改正则。**
把三种形状摆开看（`{prefix}-panel-{slug}` 与裸 `{slug}` 两种形状必须解得同一枚）：
slug 不含标记时两种取法给出的都是 slug；slug 含标记（记作 `a-panel-b`）时锚点形
`tk-panel-a-panel-b` 按 `lastIndexOf` 剥成 `b`、按 `indexOf` 剥成 `a-panel-b`，
而裸形 `a-panel-b` 按 `indexOf` 剥成 `b`、按 `lastIndexOf` 也剥成 `b`——**取首还是取尾，
最多只保得住一种形状**，因为裸形的整串就是 slug，任何一刀剥都是错的。真要两全只能加"先整串查白名单、
查不到再剥标记"那条 fallback，而那正是 §D 早先明写不要的"产物里养一条永不生效的分支"。
所以这一格改成**在数据层钉死前提**：门禁⑤ 判 `t.panels` 里不许有含 `-panel-` 的 slug（口径跟着 `parseHash`
走小写折叠），今天这十枚没有一枚撞上，代价是 `scripts/` 里的 12 行，**不碰产物字节**。

**问 4「注释写'前缀不留空'，实现接不接 `#-panel-uscc`」——实现是接的，那句话写的是更严的口径。**
`stripPanelPrefix` 的判据是 `at < 0`（找不找得到标记），不是"标记前面有没有东西"：标记落在 index 0 时
`at` 是 0、条件不成立，照样剥，剩下 `uscc` 查白名单查得到。**实测接受**，于是 §D 那一格的话改成
"这一形实测接受，不是设计意图"，并补一条断言把真实边界钉住；同时把 D4 那条循环从"只走裸形"扩成
**裸形 + 生产里那枚真前缀的锚点形**（`#tk-panel-<slug>`，prefix 取自 `_data/onlineTools.yml` 的 `tk`），
原来那些 `idcard-panel-*` 是合成形状——只测合成的，真 prefix 写错一格就测不到。
不顺手把 `at < 0` 改成 `at <= 0`：那要动 `dev/js/tools/panel.js` 一个字符、进 `toolkitCore.min.js`，
换来的只是拒绝一枚页面自己写不出、也没人写得出的 URL，代价却是 §7 整表重量 + 六道门禁全量。

**牙齿台账 70 → 72**（`scripts/check-tools-surface-teeth.mjs` 680 → 721 行）。索引条那一族现在五颗牙：
证件页四颗（裸 `#slug` / 无 `href` / 落到兄弟面板 / slug 带 `-panel-`）+ 编码页一颗。
两颗新牙的取证各说一句：`落到兄弟面板` 用 `expect: '不是它自己的面板'` 点的是新判据独有的一句，
`slug 带 -panel-` 那颗改的是**数据源**（`_data/onlineTools.yml` 的 `slug: uscc` → `uscc-panel-x`）、
不动产物，所以它会连带把"yml panels 与 spec.ids 脱钩""控件 id 缺一整块"那些判据一起吵红——
这不影响取证，`expect` 出现即证明那一格真的在数 yml；而现实中错的恰好就是这一形（改数据的人动 yml、
忘了动装配层那张表）。两颗都保留"没命中就抛"。

**活树六道（本轮）**：① 退 0、`# tests 439 / pass 439 / fail 0 / cancelled 0`（`gate1-review.log`；
采到的 1 分钟负载 **179.63** 是 Qoder 自己 + 我这串门禁叠上去的，439 判据仍全绿，没触发 §0.8 那一档单跑自证）；
② 源码落地后报 **2** 处失配（正是 `check-tools-surface.mjs` 整文件镜像与 `toolkit-tests.mjs §D`，预期），
`--fix` 后裸跑退 0、"**全部已落地镜像与磁盘逐字节全等（未落地 0 节）**"、js 块 **65**、已落地镜像 **76** 个
合计 **1,633,498B**（`gate2-fix2.log`）；③ **41/41** 退 0、"副本回到全绿且工作树未被这些实验碰过"；
⑤ 退 0、"收录面 4 条 ready 条目 × 5 组判据全绿"、导航核到 **101** 页；⑥ **72/72** 退 0 + "全部变异已还原，复跑基线仍绿"。
⑥ 在两颗牙落地、且文件头那段"补四颗"改口成"五颗"之后**又复跑一遍**，读数一字不差（`gate6-final.log`）——
注释级改动本就不该动结果，但这句不留成推测。④ 不在活树跑，留到提交态那一格。
**被 `--fix` 重写的两格**：段 1 计划 §D 镜像 298 → **317 行**（文件 6,591 → **6,610 行**，`wc -l` 口径），
段 2 计划 `check-tools-surface.mjs` 整文件镜像 871 → **897 行**（文件 14,335 → **14,361 行**）。

**量具自己那一刀（本轮踩的，记账）**：第一次量落地页那 10 枚的代价，`pat.sub` 的替换串写成了
`'%s#tk-panel-%s'`，而捕获组里含 `href="` 与收尾那个 `"`——补丁因此**把属性名整个吞掉**，
量出来是 `raw +20B` 的假代价（一枚 −7 +9 = +2）。真因还是那条老规矩：**替换串必须覆盖整条命中的原文**，
`sub` 命中数要用 `subn` 断言。改回 `'%s#tk-panel-%s"'`（带上收尾引号）并断言 `n == 10` 之后是 +90B，
再用两套 gzip 口径各量一遍对上数。这一条与 §0.8"红了先查量具"同一族，只不过这回是**绿着也错**——
读数不动声色，错在形状上。

**本轮不动的账**（列出来是为了让"顺手也改一下"在门禁里可见）：`kb()` 那句"多了 0.0 KB"按 2026-10-01
的判定**保留现状**（§0.6 那笔欠账不动，10e 夹具仍按 4,096B 绕开它）；`dev/js/tools/panel.js` 与
`dev/**` 一字未动 ⇒ 产物必须零差，这条等式去提交态那一格拿；`USAGE.md` 的检索层计数欠账在另一路会话手里，
不碰；并行会话挂在 spec 那格的暂存 blob `7c009a3cb…`（相对 HEAD 少 294 行、多 14 行，是一份旧快照）
**不参与本格的暂存与对齐**，落笔后逐枚复读见下一格。

**提交态自证（`15ca9ed` 落笔之后，`export-review` 一棵）**

**落笔 = `15ca9ed`**（`fc37f1e` → `15ca9ed`，§0.7 那套 CAS：`mktemp` 出来的临时索引 +
`read-tree fc37f1e5…` + 八格各自 `hash-object -w` 与 `update-index --cacheinfo` + `write-tree` +
`commit-tree -F fixA/msg-review.txt` + `update-ref refs/heads/main <新> <旧>` 的 CAS；索引路径与两枚 sha
逐字留在 `node_modules/.seg5t9-scratch/fixA/review-{idx-path,old-sha,new-sha}.txt`，可复算"旧 sha 就是当时写的 `<旧>`"）。
`git show --numstat` 读到正好八行、**+280 / −35**，八枚 blob 是 `47a93bb6`（`check-tools-surface.mjs`）/
`372bf66e`（teeth）/ `40e64d1b`（`toolkit-tests.mjs`）/ `52a4e9f4`（段 1 计划）/ `80882995`（段 2 计划）/
`cc9ae60c`（段 4 计划）/ `72328199`（本计划）/ `781db3ab`（spec）。
**索引对齐只对我那七格做**，spec 那一格**故意不对齐**——共享索引里挂着另一路会话那枚 `7c009a3cb…`，对齐它
等于替他们重写那一格。落笔后逐枚复读（`git ls-files -s`）：spec 仍是
`7c009a3cb462d0445c001de944a1a4a012e8e216`，`USAGE.md e8f821ff8…`、`_config.yml 3f0b74e0b…`、
`dev/sass/toolkit.scss 330fb304b…`、`package.json d4e40c1d8…` 一字未动，`git diff --cached --numstat` 的行数仍是 **16**。

**门禁④**：`export-review` = `git archive 15ca9ed`，**1,151** 件（放 gitignored 的 `node_modules/.seg5t9-scratch/`），
`node_modules` 与 `vendor` 两处 `ln -s` 活树；真 `npx vite build` `✓ built in 8.69s`、`exit=0`；
真 `bundle exec jekyll build --trace`、`exit=0`、`Liquid Warning` **0** 条、`_site` **938** 件（`gate4-review.log`）。

**三列字节表（上一格欠的那一发）**：

| 树（sha） | 件 | 原始 | L6 逐件之和 | L9 逐件之和 | 清单 md5 | 逐件内容 md5 的合集 | `import{` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `export-base`（c542feb） | 37 | 853,571 | 269,928 | 269,142 | `27b3d6cb…` | `cda922ef…` | 0 |
| `export-work`（59dee1e） | 37 | 853,662 | 269,965 | 269,180 | `27b3d6cb…` | `8ea256e4…` | 0 |
| `export-docs`（a94fd40） | 37 | 853,662 | 269,965 | 269,180 | `27b3d6cb…` | `8ea256e4…` | 0 |
| `export-review`（15ca9ed） | 37 | 853,662 | 269,965 | 269,180 | `27b3d6cb…` | `8ea256e4…` | 0 |

口径与 Task 9 那一格逐字相同（件集 = `find assets/js assets/css -name '*.min.*'`，25 本 js + 12 本 css；
raw 走 `stat -f%z`；L6/L9 走**逐件** stdin 口径；清单 md5 是那串路径排序后的 md5；合集 md5 是逐件内容 md5
按同序拼接再取 md5），**四行今天在同一把新尺上一次跑完**（`node_modules/.seg5t9-scratch/seg5t9-bytetable.sh`，
读数留 `bytetable.log`）。前两行不是新数：它们与上一格记账的 `853,571 / 269,928 / 269,142 / cda922ef…` 和
`853,662 / 269,965 / 269,180 / 8ea256e4…` **一字不差**——新尺先在旧账上自证，才拿它读那一格欠的 `export-review`。

**等式**：`15ca9ed` 与 `a94fd40` 两棵的 `assets/` 逐字节 `diff -r` **无输出**，六页 HTML 的 md5 逐枚相同
（`tools/idcard.html 18e596d5` / `tools/codec.html 1501a4cf` / `tools/json.html d1065a3f` /
`tools/diff.html c9e1e854` / `tools.html ca57384c` / `index.html d3b50f13`），`_site` 全树差异只有 **1** 件、
是 `feed.xml`（带构建时间戳）。"`scripts/` 与 `_docs/` 不进站点构建"这条口径**第四次**拿到等式，
上面那句"`dev/**` 一字未动 ⇒ 产物必须零差，这条等式去提交态那一格拿"就此关上。

**提交态四道人**（都在 `export-review` 里跑，跑前 `git init -q .` + `git add -A .`；导出树自己读到脏项 **1,150**，
与活树无关）：① 退 0、`# tests 439 / pass 439 / fail 0 / cancelled 0`；② 退 0、
"全部已落地镜像与磁盘逐字节全等（未落地 0 节）"；③ **41/41** 退 0；⑤ 退 0、
"收录面 4 条 ready 条目 × 5 组判据全绿（页面源/收录/导航/图标/DOM）"、导航核到 **101** 页。
**⑥ 不在导出树跑**（它要在源文件上原地打 72 发变异，等于改提交态工作树，沿用 Task 8 的处置），活树读数 72/72
记在上面那一格。本轮六道的形状因此是：**①②③⑤ 各有活树 + 提交态两份、④ 只有提交态一份（含上面那张字节表）、
⑥ 只有活树一份**，与 Task 8、Task 9 那两格一致。

**量具自己那一刀（本格的两次假读数，先记账再读数）**：字节表第一次跑出来是
`件 37 ｜ raw 0 ｜ L6 0 ｜ L9 0 ｜ 清单 md5 27b3d6cb… ｜ 合集 md5 d41d8cd9…`——**同一行里既有真又有假**：
清单那一枚真（它读的是先落盘的路径清单），三个求和与合集全假，因为逐件循环写的是 `for f in ${=FILES}`，
那是 **zsh 的强制分词**、脚本壳却是 `#!/bin/bash`，`bad substitution` 让循环体一次都没跑，
而 `d41d8cd98f00b204e9800998ecf8427e` 正是"**空串的 md5**"——认得出这一枚，读数才没被糊过去。
第二次直接在交互 shell（zsh）里重试同一串，`for f in $FILES` 在 zsh 下**不分词**，`stat`/`cat`/`md5` 收到整串清单，
于是 `No such file or directory` 当场炸；这一发是显式红，比上一发的静默 0 便宜得多。
修法：新脚本**不依赖 shell 的分词行为**——`find` 先落清单文件、再 `while IFS= read -r f` 逐行读，并加四条前置断言
（树里必须有 `assets/{js,css}`、件数必须 > 0、每件 `stat`/`gzip` 失败即 `exit 1`、`import{` 仍按逐本 `grep -c` 求和）。
**落进账本的是这一句**：一把尺里只要有一段"循环没跑、但 sum 照样打印得出来"，它就能在 `exit=0` 的壳里给出全 0；
所以要在求和**之前**断言件数，而不是读完之后再判断数对不对。

**文档侧的尾巴**：spec 那三处口径（§7 里"代价在 D 树副本上实测"改成补丁副本 + 两套 gzip 口径 + 副本路径，
同段下面那句"三刀牙 / 70/70"改成四件事 / 五刀 / **72/72**；§8.2 那条判据同样从三刀扩到五刀）与段 4 计划第 11139 行
那句"牙在门禁⑥，70/70"改成 72/72 并指向本节——这三处没挤进 `15ca9ed`（那一发的边界是代码 + 本格自证），
它们与本格一起走下一次 `docs(plans)`。spec 那一格照上面那条：只提交工作树内容，索引里的 `7c009a3cb…` 不参与、不对齐。

**写回之后的那一道回身**（本格落笔、`15ca9ed` 之后的活树复跑，读数留 `docpost.log` 与 `docpost2.log`）：
① 退 0、`439 / 439 / fail 0 / cancelled 0`；② 退 0、"全部已落地镜像与磁盘逐字节全等（未落地 0 节）"、
已落地镜像仍是 **76** 个、合计仍是 **1,633,498B**（本格只动 `_docs/`，镜像内容一字未变——这两个数不变就是那条口径的又一次自证）；
③ **41/41** 退 0、"副本回到全绿且工作树未被这些实验碰过"、"实验前后工作树的脏指纹一模一样"（脏项 **26** 个前后一致、
diff 指纹 `3c39a750f0cf88ef`，含另一路会话那批，一件未碰）；⑤ 退 0、"收录面 4 条 ready 条目 × 5 组判据全绿"、导航核到 **101** 页。
**⑤ 那一行有一个数变了，说清免得跨格读成矛盾**："不渲染 header 的 18 份"仍是 18，"无 canonical 的"从 **16 变成 17**——
多出来那一枚是另一路会话挂在活树上的 `_site/offline.html`（源 `offline.html` 未跟踪，他们那一轮 `_site` 重建把它带了进去；
逐枚 `grep -c 'rel="canonical"'` 现读为 0）。导出树里没有 `offline.html`，所以提交态那一发的 **16** 与活树这一发的 **17**
都不是错——差的不是产物，是树。



---

## 修 B（2026-10-01）：落地页那 10 枚**跨页**锚点挂真 id

**这一格从哪来**：修 A 只清了**同页**那一形（两页索引条的 10 枚），修 A 那一格的最后一句把另一形登记成了待判——
落地页 `tools.html` 的面板清单那 10 枚 `href="另一页#裸 slug"`，产物里压根没有同名 id。
开 JS 时目标页的 `parseHash` 认裸形（所以这十枚一直是"活的"），禁 JS / 中键新标签 / 把链接复制给别人这三条路上
浏览器原生那一次跳转落在空气上。判定收到：落。修法就是待判那一格写好的那一形 `#{{ tool.prefix }}-panel-{{ p.slug }}`。

**代码侧三件**（`git diff HEAD --numstat` 口径）：

| 件 | 差 | 内容 |
| --- | --- | --- |
| `tools.html` | +12 / −6 | `:158` 那一行 `href` 换成 `{prefix}-panel-{slug}`（改前它在 `:152`，那 6 行注释把它顶下去 6 格）；上面那段注释补"跨页那一形为什么不能用裸形" |
| `scripts/check-tools-surface.mjs` | +21 / −2 | 门禁⑤ `checkInclusion` 里那条"面板清单里有没有这一枚"从裸形改成 `{prefix}-panel-{slug}` **且要求锚文本成对**，另加一支读产物里真写出去的片段、逐枚要求**目标页**产物有同名 id |
| `scripts/check-tools-surface-teeth.mjs` | +42 / −2 | 两颗旧牙的变异串跟着改形状（`#uscc` → `#tk-panel-uscc`、`#digest` → `#tk-panel-digest`），补两颗新牙（退回裸形 / 落到兄弟面板），台账 **72 → 74** |

**两支判据为什么要一起写**（这是本格唯一有设计含量的那一格）：①按数据源逐枚对 `href` ＋锚文本，钉的是"目录与内容错位"；
②读产物里真写出去的那串片段拿去查**目标页**的 id，钉的是"跳转落空"。只留 ①：yml 与模板按同一份错数据一起改就绿；
只留 ②：指到目标页**另一块**真有 id 的面板就绿。修 A 那一族五颗牙全在量同页那一形，
**本页的 id 集合再全也救不了落在别处的那一枚**——那十枚就是这么从段 1 蹲到今天的。两形各两颗，缺哪一支都是半把尺。

**活树六道**（`node_modules/.fixB-scratch/`，逐道留 log）：① 退 0、`# tests 439 / pass 439 / fail 0 / cancelled 0`
（`dev/**` 一字未动，判数不动是预期）；② 第一跑退 1 并点名 `✗ 1 个目标对不上：scripts/check-tools-surface.mjs`——正是门禁⑤ 那 +21 行
造成的镜像漂移，`--fix` 重写 1 块（`[段2] 2026-09-26-tools-idcard-page.md` 14,362 → 14,381 行，`wc -l` 口径 14,361 → **14,380**），
复跑退 0：**76** 个已落地镜像 / 合计 **1,634,497B** / 未落地 0 节、js 块仍是 **65**（上一格是 76 / 1,633,498B，差的 999B 就是那一块镜像）；
③ **41/41** 退 0、"副本回到全绿且工作树未被这些实验碰过"、脏指纹 `1739652118a2633a` 前后一致（脏项 **28** 个，含另一路会话那批）；
⑤ 退 0、"收录面 4 条 ready × 5 组全绿"、导航核到 **101** 页；⑥ **74/74** 退 0 +"全部变异已还原，复跑基线仍绿"。
④ 不在活树跑，留到下面那一格。

**A/B 字节（提交态两棵导出树各自真构建，不是补丁副本）**：`base` = `git archive ab64361`、`work` = `git archive cbcae59`，
各 `ln -s` 活树 `vendor`、各跑一次真 `npx vite build`（6.25s / 5.32s，两边 `exit=0`）与一次真 `bundle exec jekyll build --trace`
（`exit=0`、`Liquid Warning` 0 条、`_site` **938** 件、`assets` **37** 件——两个数与修 A 那一格一字不差）。
活树那一发先跑（`work` = 活树重建，重建前 `cp` 出六份 HTML 快照，之后 ⑥ 那 74 发变异改的是影子副本、动不到这份读数），
**两发的读数同一枚**：`_site/tools.html` 原文 50,500 → **50,590（+90）**、L9 **12,985 → 12,993（+8）**、
L6 **13,027 → 13,036（+9）**、md5 `ca57384c…` → **`2d6e9bf8…`**（口径逐字照 §7 钉死的 `cat f | gzip -9 | wc -c`，raw 走 `stat -f%z`）。
上一格在副本上量的正是 +90 / +8 / +9——**这条链路上第一次"预测 == 落地"**，
而它成立的前提是 `base` 那一枚 md5 与修 A 那一格记的 `ca57384c` 一字不差（两发之间没有第三刀）。
**对照件**：`_site/tools/{idcard,codec,json,diff}.html` 四枚逐枚 `cmp` 读**相同**（`18e596d5` / `1501a4cf` / `d1065a3f` / `c9e1e854`）、
`index.html` `d3b50f13` 相同、**`_site` 全树差异只有两件**（`tools.html` 与带时间戳的 `feed.xml`）、`assets/` 37 件 `diff -rq` **无输出**；
json/diff 两页连模板都没走那一支（`panels: []`）——有差的只有落地页一件，`dev/**` 一字未动那条等式在这里关上。

**三列字节表（两棵树现跑，`node_modules/.seg5t9-scratch/seg5t9-bytetable.sh` 那一把新尺，逐件 stdin 口径）**：

| 树（sha） | 件 | raw | L6 | L9 | 清单 md5 | 逐件内容 md5 的合集 | `import{` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `export-base`（ab64361） | 37 | 853,662 | 269,965 | 269,180 | `27b3d6cb…` | `8ea256e4…` | 0 |
| `export-work`（cbcae59） | 37 | 853,662 | 269,965 | 269,180 | `27b3d6cb…` | `8ea256e4…` | 0 |

两行**同一枚**：这一格动的是 `tools.html` 的 Liquid 模板与两本 `scripts/`，都不在 vite 的入口扫描面上
（`rollupOptions.input` 只从 `getDevJsEntries()` / `getDevSassEntries()` 取），产物必须逐件相同；而这四个数与修 A 那一格记的
`853,662 / 269,965 / 269,180 / 8ea256e4…` 也**一字不差**——"提交态产物等式"这条口径第三次拿到同一个读数。

**提交态四道人**（都在 `export-work` 里跑，跑前先在那棵树 `git init -q .` + `git add -A .`，它自己读到脏项 **1,150**）：
① 退 0、`# tests 439 / pass 439 / fail 0 / cancelled 0`；② 退 0、"全部已落地镜像与磁盘逐字节全等（未落地 0 节）"、
**76** 个镜像 / **1,634,497B**（与活树那一发同一枚，证明提交进去的那份镜像与提交进去的那份磁盘内容互为逐字节）；
③ **41/41** 退 0、"副本回到全绿且工作树未被这些实验碰过"、脏指纹 `fa765e9e55608cfd` 前后一致（1,150 项，含另一路会话那批）；
⑤ 退 0、"收录面 4 条 ready × 5 组全绿"、导航核到 **101** 页、"无 canonical 的 **16** 份"——活树那一发读 **17**，
多的那枚是并行会话挂在活树上的 `_site/offline.html`（源文件未跟踪，导出树里没有它），差的不是产物、是树。
⑥ 照旧只在活树跑（74 发变异要就地改源，等于改提交态工作树，沿用 Task 8 的处置），活树读数 **74/74** 记在上面那一格。
**六道形状仍是：①②③⑤ 各有活树 + 提交态两份、④ 只有提交态一份、⑥ 只有活树一份。**

**落笔与索引那一格**：`ab64361` → **`cbcae59`**（§0.7 那套 CAS：`node_modules/.fixB-scratch/commit-index` 临时索引 +
`read-tree ab64361…` + 六格各自 `hash-object -w` 与 `update-index --cacheinfo` + `write-tree` 得 `cf10b827…`（先与旧树
`c8193f26…` 断言"必不相等"）+ `commit-tree -F msg.txt` + `update-ref refs/heads/main <新> <旧>` 的 CAS；
两枚 sha 与两枚树 sha 逐字留在 `node_modules/.fixB-scratch/{old-sha,new-sha,new-tree,old-tree}.txt`，可复算）。
`git show --numstat` 读到正好六行、**+180 / −12**，六枚 blob 是 `bd893d0d`（`tools.html`）/ `92d15917`（`check-tools-surface.mjs`）/
`42e83a10`（teeth）/ `9d12f20d`（段 2 计划镜像那一块）/ `951f6c2b`（本计划）/ `13162ce3`（spec）。
**索引对齐只对我那五格做**，spec 那一格**故意不对齐**——共享索引里挂着另一路会话那枚 `7c009a3cb…`（一份旧快照），
对齐它等于替他们重写那一格；落笔后逐枚复读：`git ls-files -s` 里五格等于 HEAD 的 blob、spec 仍是 `7c009a3cb…`，
`git diff --cached --numstat` 的行数仍是 **16**（那一批发出的裸 `git commit` 仍会把 spec 那格写回旧快照，这笔危险照旧挂着）。

**落空枚数**（一次性量具 `node_modules/.fixB-scratch/anchor-scan.mjs`，口径写进 spec §7 那一格）：
提交态两棵树各扫 **135** 份、带片段的 href 同为 **2,329** 枚（分母相同，所以差值只可能来自这一刀），
`base` 落空 **12** 枚、`work` 落空 **2** 枚。那 10 枚逐枚点名都在落地页，2 枚是
`demo/vueRouterDemo/hashRouter.html` 故意写的假路由。**工具页同页 10 枚（修 A）+ 落地页跨页 10 枚（本格）= 20 枚全部归零。**

**量具自己那一刀（本格踩的，记账）**：① 第一发想在真浏览器里量那 2 枚中文 TOC 到底落不落得下去，
`--dump-dom` 两发都卡在页面 head 的阻塞外链上（项目记忆里"headless 前先绕开 head 的阻塞外链"那条，
剥掉外链之后仍没在预算时间内出数），**于是那一句只落到"静态差集"这一档、没写成行为实测**，登记为欠账。
② 为了定位那两枚，先用一条 `node -e` 现拼正则去查 `id="…"`，读出 `false` 当成"落空"——那把尺自己有洞：
`AVL树、红黑树、B树/B+树查找` 里那个 `+` 没转义，量具静默漏判。改成字面串 `includes` 与"先建 id∪name 集合再查成员"
两把之后读数才互相咬合：那两枚的落点是 `<a name="…">`、`id=` 里确实没有。
**这条与"红了先查量具"同一族，只不过这回是量具把自己的读数改红了**——凡"某串在文件里不存在"的断言，
先问一句我拿什么匹配的：正则里的元字符、还是字面串。

**写回之后的那一道回身**（上面那三格文档落笔之后的活树复跑，读数留 `node_modules/.fixB-scratch/docpost.log`）：
① 退 0、`439 / 439 / fail 0 / cancelled 0`；② 退 0、"全部已落地镜像与磁盘逐字节全等（未落地 0 节）"、
已落地镜像仍是 **76** 个、合计仍是 **1,634,497B**——本格这三段只动 `_docs/`，镜像内容一字未变，
**这两个数不变就是"改文档不动门禁"那条口径的又一次自证**；③ **41/41** 退 0、脏指纹 `31395c1c2d604125` 前后一致、
脏项 **25** 个（上一发记 28，少的三格正是 `cbcae59` 吃掉的那三个工作树改动，方向对得上）；
⑤ 退 0、导航核到 **101** 页、"无 canonical 的 **17** 份"（活树含 `offline.html`，与提交态那一发的 16 同前解释）；
⑥ **74/74** 复跑退 0 +"全部变异已还原，复跑基线仍绿"，跑完 `git status` 逐枚读回：`tools.html`、
`scripts/check-tools-surface.mjs`、`scripts/check-tools-surface-teeth.mjs` **三格对 HEAD 一字不差**——
那 74 发变异真的全部还原了，这一行是它的凭据。开跑负载 5.61、收轮 7.23（1 分钟档），没触发 §0.8 那一档单跑自证。
**本格的自证文本随下一次 `docs(plans)` 落笔**：那一发只带两格文档（本计划与 spec §7 的提交态读数），零代码改动。

### 评审回合（2026-10-01 晚）——两轴各一只只读子智能体，抓三处，全补
派法：`git diff ab64361...HEAD` 钉死对象，Standards 与 Spec 两轴各一只子智能体**并行**跑（分轴是为了不让规范瑕疵被"实现是对的"冲掉）。

**Standards 抓到两处，一处补、一处登记不动**：
① 补——修 B 换形状的那两颗旧牙（`tools.html` 里 idcard 的 `#tk-panel-uscc`、codec 的 `#tk-panel-digest`）
仍是裸 `s.replace()`。本文件 JSDoc（补完这两刀之后它自己挪到 `:268`）早就立过规矩："每一刀都先断言变异真的命中——`s.replace` 没命中时
原样返回，那一档会退化成'注入 nothing 而门禁仍绿'的假牙"，而本格新加的两颗都带了 `throw`，同族两形不一。
两处各补一句 `throw`（`+10 / −2`，台账仍 **74**，不发数）。说清严重度免得读成事故：这两刀即使静默不命中，
harness 也会报成"该红没红"而不是偷偷绿，真正的代价是**误诊方向**——会把"量具没咬到"读成"门禁是假牙"。
② 登记不动——这两颗没有 `expect`，而本格新加的两颗有。一个文件里 `expect` 的疏密是全族既有形状（收录/导航/图标那
十几颗一律没有），补齐它等于替另一路的形状做主，超出本格范围；`①②两支各自能被哪颗牙钉住`这件事已由
`:336`（退回裸形 → 红 ②）与 `:351`（落到兄弟面板 → 红 ①）两串的 `expect` 分别钉死，没有半把尺。

**Spec 那一只没信文档自述，自己复算过**（三发变异实跑在 `/tmp/specrev-fixb-*`，没借本会话的 scratch）：
退回裸 `#uscc` → 退 1、①②同红；落到兄弟 `#tk-panel-digest`→ 退 1、**只红 ①**；只改目标页产物 id、yml 与落地页不动
→ 退 1、**只红 ②**。这就是"两支必须一起写"那一格的**存在性证明**，之前只有推导没有反例。它另外复算的三项与本格
记录一字不差：`stat -f%z` 50,590 / `gzip -9` 12,993 / `gzip -6` 13,036、落地页 14 枚片段按 id∪name 求差落空 **0**、
全站 136 份落空 **2**（那两枚假路由）；`--name-only` 恰 6 文件、`dev/**` 与 `_data/*.yml` 与四页模板零命中。

**三处里的第三处（本格的两个自证洞，都关在文档里）**：
① 「代码侧三件」表把 `tools.html` 那一行写成 `:152`——那是**改前**的行号（`git show cbcae59^:tools.html | grep -n` 读到 152），
换形加上面那 6 行注释后它落在 **`:158`**（`grep -n "tool.prefix }}-panel-"` 现读）。已改。
② spec §7 那格登记为"本轮未归因"的 **15 枚之差**归掉了：同一份 `_site`、同一批 136 份，三档口径各数一遍——
带 `#` 全量 **2,346**（含 2 枚空片段 `href="#"`）、片段非空**含**站外 **2,344**、片段非空**排**站外 **2,329**，
其中站外绝对 URL 恰 **15** 枚。所以两格之差是分母口径（上一格"只求数不求差"把站外算进分母），不是产物变了、也不是漏数。
量具 `node_modules/.fixB-scratch/frag-census.mjs`（一次性、不入仓库，口径已逐字写进 spec §7 那一格）。

**本回合六道读数**：①③ 是补之前跑的（退 0、439/439 与 41/41），那之后只动了 teeth 的两处 `throw` 与两格文档，
两道都不读这两样；②⑤⑥ 是补之后重跑：② 退 0、仍是 **76** 镜像 / **1,634,497B**（teeth 那本**没有**内联镜像，所以改它
不惊动②——这一句就是"76 不变"的因果）；⑤ 退 0、4 条 ready × 5 组；⑥ **74/74** 退 0 + "全部变异已还原，复跑基线仍绿"，
`git status --porcelain` 对三格只读回 `M scripts/check-tools-surface-teeth.mjs` 一行（那正是本回合这一发要落的东西）。
**④ 用证据替代、没有再烧一次双树**：本回合动的三件都不是构建输入——`_config.yml:233` 把 `scripts` 排进 exclude、
`_site/scripts` 与 `_site/_docs` 都不存在、`grep -rl "check-tools-surface-teeth" _site` 零命中、vite 的 `input` 只从
`getDevJsEntries()` 等四族取（`vite.config.js:177-182`），而 `dev/**` 一字未动 ⇒ 产物等式沿用上一格那三列字节表。
负载：开跑 8.37（1 分钟档），未触发 §0.8 那一档单跑自证。

**仍照旧挂着的那笔危险**：共享索引里 spec 那格仍是另一路会话的 `7c009a3cb…`（一份旧快照，既不含修 B 那一格、
也不含本回合的归因），对方一发裸 `git commit` 会把 §7 写回去。本回合落笔仍只对我这三格做临时索引 CAS，
`_docs/.../specs/…design.md` 那一格**继续故意不对齐**。

**提交态那一道回身**（`git archive 04da5d1` 导出到 `node_modules/.fixB-scratch/export-review`，`ln -s` 活树 `vendor`，
树内 `git init` + `git add -A` 让门禁③ 拿得到指纹——项目记忆里"导出树要先 git init"那条）：
① 退 0、`439 / 439 / fail 0 / cancelled 0`；② 退 0、"全部已落地镜像与磁盘逐字节全等（未落地 0 节）"；
③ 退 0、**41/41**、"实验前后工作树的脏指纹一模一样"、脏项 **1150** 前后一致、diff 指纹 `fa765e9e55608cfd`
（这一串 1150 是那棵新树 `git add -A` 之后的**全部跟踪项**，不是"另一路会话的未提交改动"——导出树里根本没有未提交改动，
它只可能等于 `git ls-tree -r HEAD | wc -l` 那一族，写清免得跨格读成上一格那个 25）。
**⑤ 与 ⑥ 在这一格取替代证据**：两道都读 `_site`，而 `git archive` 不带 gitignored 产物，导出树里没有 `_site`；
本回合改的三件经上面四条已证**都不是构建输入**（`scripts` 在 `_config.yml:233` 的 exclude 里、`_docs` 被 Jekyll 默认忽略、
`vite.config.js:177-182` 的 input 只从 `dev/` 取、产物里搜不到 teeth 文件名），所以重建一次双树只会重产同一批字节。
于是提交态的 ⑤⑥ 读数**沿用同一工作树那两发的** ⑤ 退 0、⑥ **74/74** 退 0 + 变异全还原，
这一句是"哪一格是现产、哪一格是替代"的对账，不是把退 0 抄成两处。
