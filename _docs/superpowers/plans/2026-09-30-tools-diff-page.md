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

```js
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

（本表是空的才算正常；每加一行就要在 §5.6 或 §8.1 里回写一次，段 4 那份计划的 §0.6 是同一族先例。）

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

```js
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

```js
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

```js
export function createDiffView(env) → { renderSide, renderInline, renderFoldBar, renderStats,
                                        renderJsonTable, renderNotice, renderVerdict }
```
所有产出必须是**已经过 `env.esc` 的 HTML 串**；本文件源码里 `innerHTML` 出现 **0** 次，
`document` / `window` 出现 **0** 次（§Z 的源码扫）。行的 class 前缀从 `env.prefix` 派生，
不许手打 `df-` 字面量（同 §W10 那条口径：数的是整格字面量，三种引号都算）。

### 1.4 `dev/js/tools/diffWorkbench.js`（装配层）与 `dev/js/toolDiff.js`（入口）

```js
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
- [ ] **Step 5：门禁二与门禁三跑一遍**（文档格不碰构建输入，①⑤⑥ 到 Task 2 起再跑）。
      `node scripts/verify-plan-blocks.mjs` → 本文件里的镜像块此时全是 `⚠ 未落地`，
      但**已落地的三页镜像必须仍全等**（`✗` 计数 0）；`node scripts/verify-plan-blocks-teeth.mjs` → 全绿。
- [ ] **Step 6：提交**（plumbing，pathspec 只有这两份文档 + 上一格说的那两处 spec 回写）：

```bash
git add _docs/superpowers/specs/2026-09-25-blog-online-tools-design.md \
        _docs/superpowers/plans/2026-09-30-tools-diff-page.md
git commit -m "docs(specs,plans): 段 5 立第五格——§5.6 文件对比页规格 + 本段计划（六段读法与两处地基拆解）"
```

---

## Task 2：`diff-core.js` 行级对齐引擎 + §X

**Files：** Create `dev/js/tools/diff-core.js`；Modify `scripts/toolkit-tests.mjs`（末尾追加 `// ── §X …` 一节）；
Modify 本计划（镜像块 + 判据表勾选）。

- [ ] **Step 1：写 §X 判据（先红）**。下表就是要写进 `toolkit-tests.mjs` 的判据，一条不许并：

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

- [ ] **Step 2：写实现到绿**，跑 `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs`。
- [ ] **Step 3：登记镜像**——`verify-plan-blocks.mjs` 的 `FILE_TARGETS` 追加 `'dev/js/tools/diff-core.js'`
      （方向照旧：**有镜像才登记，跟着磁盘走**），**同一步**把
      `{ rel: '_docs/superpowers/plans/2026-09-30-tools-diff-page.md', tag: '段5' }` 追加进 `PLANS`
      （脚本 `:56-58` 那条注释立的规矩：`PLANS` 认了却磁盘上没有对应块，门禁二红的是"新来的这份一条都没核"——
      登记方向跟着磁盘走，这条是它的另一面）。本计划 Task 2 那一节贴一块 ` ```js ` 围栏，
      头几行就是磁盘的头几行，然后 `node scripts/verify-plan-blocks.mjs --fix` 整块换进去，
      再跑一次裸命令确认全等。
- [ ] **Step 4：门禁③**（teeth 认新镜像那一格要不要补一刀，见 Task 8）+ **门禁①** 全量。
- [ ] **Step 5：提交** `feat(tools): 段 5 Task 2 行级对齐引擎——diff-core 与 §X 二十八判`。

---

## Task 3：`diff-json.js` JSON 感知比对 + §Y

**Files：** Create `dev/js/tools/diff-json.js`；Modify `scripts/toolkit-tests.mjs`（§Y 一节）。

- [ ] **Step 1：写 §Y 判据**（Y1 与 `json-core` 对拍 → Y18，逐条按 §1.2 的字段名写；
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

- [ ] **Step 2：写实现到绿**；**Step 3：登记镜像** + `--fix` 同步；**Step 4：门禁①②③**；
- [ ] **Step 5：提交** `feat(tools): 段 5 Task 3 JSON 感知比对——diff-json 与 §Y 十八判（含与 json-core 的对拍）`。

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
