# JSON 工作台页（`/tools/json.html`）实现计划

> **For agentic workers：** REQUIRED SUB-SKILL：用 superpowers:subagent-driven-development（推荐）
> 或 superpowers:executing-plans 逐格执行本计划。步骤用 `- [ ]` 复选框语法跟踪。

**Goal：** 把设计文档 §5.3 那一页做成站内第三张工具页——**单工作台、不是面板式**：左侧带行号的输入、
右侧输出、顶部一条工具栏；视图在「文本 / 树」之间切，树视图折叠展开 + key/值搜索 + 点击复制 JSON Pointer +
只渲染可视节点；工具栏给格式化（缩进三档）/ 压缩 / 校验（**精确行列号**）/ 键排序 / 转义 / 反转义 / 复制 /
下载 `.json` / →TypeScript / ⇄YAML / ⇄XML / ⇄CSV。

**Architecture：** 沿用段 2/段 3 已落地的四层——纯逻辑模块（`dev/js/tools/json-*.js`，不碰 DOM、入参形状
不对就抛）→ 纯字符串视图层（`jsonView.js`，与 `view.js`/`codecView.js` 同一条"零 import"红线）→
页面装配层（`jsonWorkbench.js`）+ 入口（`toolJson.js`）。**面板框架（`panel.js` / `panel-dom.js`）这一页
一行都不用**：它没有索引条与互锁面板，只有 `window.Tk.view` / `window.Tk.ui` 两只可复用。
页面骨架由 Jekyll 构建期渲染，禁 JS 与爬虫读得到全部正文与说明。

**Tech Stack：** Jekyll 4 + Liquid、Vite 6（`getDevJsEntries()` 只扫 `dev/js/` 一层，子目录不成入口）、
Node 22 内置 test runner（`scripts/toolkit-tests.mjs`）、SCSS、**一个新增的 vendored 上游件
`dev/libJs/js-yaml.esm.min.mjs`（js-yaml 5.4.2 / MIT，见 §0.4）**，`package.json` 与 `pnpm-lock.yaml`
**一个字节都不改**。

**写本计划时（2026-09-29）的前置事实**：段 1、段 2、段 3 全部关闭；证件页与编码页已收录可见并上线
（`8958af2..44491d2` 已推 `master`，Pages 两个 run `completed/success`）；本地 `main` == 远端
`master` == `b701cc0`。另一路会话此刻在同一个工作树上有一批**未提交**改动（`_data/onlineTools.yml`
`tools.html` `README.md` `_includes/header.html` `dev/js/editorial.js` `index-all.html` `llms.txt`
`_config.yml` `package.json` 等，其中 12 项已在索引里）——**本段每一格的暂存动作都要先重新 `git status`**，
按 §0.7 那一节处置。

---

## 0. 本段的口径与决策（执行期不再重新问）

### 0.1 详写的节奏：与段 3 同一份"契约先写、代码随后"

段 2 的实测教训（计划里写死实现 → 两轮评审改掉 → 4,000 多行镜像全靠 `--fix` 回同步、60KB 那类
口径反成过期引用）在段 3 已被验证过一次，本段照段 3 §0.1 的处置：

- **现在就定死**（写错代价最大、且两格会互相不一致）：文件清单与职责、每一层的对外签名
  （函数名、参数名、返回字段名、枚举取值）、判据编号与它咬的那一件事、门禁改哪一处、提交边界。
- **执行期写、写完 `--fix` 同步进计划**：函数体、表数据、SCSS 规则、页面 Liquid。磁盘是权威，
  `verify-plan-blocks.mjs --fix` 整块重写是唯一正当姿势。

每格 Step 顺序固定：**写判据（红）→ 写实现（绿）→ 登记镜像 → `--fix` 同步 → 六道门禁 → 提交**。
一格一次提交，计划与代码同批。

契约块里那些写成 `'…'` 的**中文口径文案**不是待办：它们是面板上那几句人话（超限怎么说明、
歧义值怎么提醒、CSV 为什么不可逆），执行期写；§W / §S / §U 各有一条判据钉"这一族常量必须非空、
且原样出现在渲染结果里"，所以空串与漏句都会红——占位只占在计划里，不占在验收面上。

### 0.2 复用面（全部带 `文件:行号` 或复算命令，本段实测）

| 现有件 | JSON 页怎么用 | 证据与理由 |
| --- | --- | --- |
| `dev/js/tools/panel.js` / `panel-dom.js` | **不用**（这一页没有 tablist / 面板互锁） | 它们要求的骨架是 `{p}-tablist` / `{p}-tab-*` / `{p}-panel-*` 那一套（`panel-dom.js:226-247` 的 `mount()` 里"没有索引条就不算一块工作区"当场抛），按 §5.3「单工作台」的形状硬套会多出一条没有意义的索引条 |
| `dev/js/toolkitCore.js` → `window.Tk` | 只取 `Tk.view`（`esc` / `checksTable` / `noteLines`）与 `Tk.ui`（`copyInto` / `flash` / `legacyCopy`） | 它挂的四只是 `createPanelWorkspace` / `createPanelDom` / `view` / `ui`（`toolkitCore.js:32`）。**本段一律不许往 `window.Tk` 上加第五只**：任何 `dev/js/` 下两个入口同时 import 的模块都会被 Rollup 提成共享 chunk，`iife-wrap` 之后产物里就是 `import{…}`，整页 SyntaxError 而构建 exit=0（`toolkitCore.js:5-9` 记的正是这个坑，判据在门禁④） |
| `dev/sass/toolkit.scss` | 白拿 `.tk-content` `.tk-compliance` `.tk-compliance--noscript` `.tk-notice` `.tk-kbd` `.tk-btn` `.tk-outwrap` `.tk-out` `.tk-mono` `.tk-table` `.tk-state*` 与 ≤900/≤640 两组退档 | 文件头 `:1` 就写着"idcard、codec、json 共用这一层"；`postcss.config.js:87-88` 的 `.tk-` / `.jt-` 两串**已经在黑名单里**（`.jt-` 那条注释原文即"JSON 工作台（前缀 jt，§6.4 两条黑名单前缀的另一条）"），本段**不改** `postcss.config.js` |
| `_data/onlineTools.yml` 的消费点五个 | 追加一条 `slug: json` 即全站跟着长一页 | `sitemap.xml:50` / `llms.txt:61` / `index-all.html:41` / `_includes/header.html:75` / `tools.html:21` 全部是 `where: 'status','ready'` 的数据驱动循环（段 3 Task 7 已把这条事实回写进 spec §4.4）。**唯一例外**：`tools.html:151` 那格徽章写死 `{{ tool.panels.size }} 块面板`——见 §0.7 第 3 条 |
| `scripts/toolkit-tests.mjs` 的假 DOM 夹具 | §I / §R 那两族手写的 `rPage/box/withCore` 形状照抄，不复用代码 | 测试文件按节追加，§V/§W 自建夹具；段 3 R16 那套"换前缀自证"（`data-tk-prefix: zx`）本段要照做一遍（`jt` ↔ 别的值），因为这一页的 id 前缀第一次与类名前缀同串 |
| 浏览器核验 `scripts/verify-codec-browser.mjs` | 通用六族提成公共表（Task 8），**这两本脚本都不改** | 见 §0.8 |

**本段不新增 npm 依赖，也不改 `vite.config.js` / `postcss.config.js` / `_config.yml` / `package.json` /
`pnpm-lock.yaml`。**

### 0.3 一处必须拆开的地基：收录面门禁的「DOM」与「收录」两组是**面板式**形状

段 3 §0.3 拆的是"spec 表按条目取"；这一页露出的是同一族假设的另一半——**`panels` 这个字段被当成了
必有**。逐处实读（行号是本段 2026-09-29 在 HEAD `b701cc0` 上复算的）：

1. `check-tools-surface.mjs:249` 收录组 `for (const p of t.panels)`——空数组就安静通过，tools.html 的
   面板锚点清单本来就该是空的，**这一处不用改**。
2. `loadSpec():127` 要求每条 ready 条目必带 `spec: {module, table, ids}` 三格（`:129-131`），`:153`
   要 `table` 是对象、`:157` 要 `ids` 是数组名并取模块里那个数组。JSON 页三格都给，**这一处也不用改**。
3. `checkDomContract():455` 是硬形状，四处无条件读面板清单：
   - `:460` `ymlPanels.join(',') !== spec.ids.join(',')` → JSON 条目 `panels: []` 对上
     `JSON_PANEL_IDS = ['workbench']`，**这一句必红**，而且红得毫无道理（这一页没有面板清单，
     只有装配层那一张表里的工作区）。这才是真正要拆的那一颗牙。
   - `:468` 无条件要 `{p}-workspace` `{p}-notice` `{p}-tablist` 三个 id——JSON 页没有索引条。
   - `:469` 的遍历体是 `for (const slug of ymlPanels)`：`panels: []` 时**控件与开关那一整族判据空转**，
     门禁对这一页只剩两条 id。所以 workbench 支必须把遍历源改成 `spec.ids`。
   - `:548` `data-${p}-ids` 与 `ymlPanels` 顺序比——同一件事的第四处，改比 `spec.ids`。

**处置（Task 7）**：yml 条目新增可选字段 `layout: panels | workbench`，门禁按它分派，改动面收成
**一个变量 + 两处取值**（`const panelIds = layout === 'workbench' ? spec.ids : ymlPanels`，
`:460` 与 `:548` 那两句在 workbench 支跳过 yml 比对、只留 `:463` 那条"模块内部自洽"）：

- `layout` 缺省时按 `panels` 那一支走，**但不许静默**：缺 `layout` 且 `panels` 为空 → 判红，
  说明"既没声明布局、又没有面板清单"。这一条是"为什么不给个 `default:'panels'`"的答案：
  默认值等于第二处口径，`workbench` 拼错一个字母就悄悄退回面板支，红在运行时而不是红在门禁。
- `layout: workbench` 那一支要求的 id 是 `{p}-workspace` / `{p}-notice` 两格（**没有 tablist**），
  控件与开关那一族照 `:469-487` 的既有形状走，只是遍历源换成 `spec.ids`；id 命名口径不变
  （`{p}-in-<id>-<control>` / `{p}-when-<id>-<key>`），因此 `markers` / `wantWhen` 两个累加器与
  那四条双向对账一行都不动。**新增且只加在这一支**：产物里凡是匹配 `^<p>-(in|when)-` 的 id
  若不在 `need` 集合里就算红（面板式那两页的产物里本来还有别的 id 家族，不给存量页加判据）。
  这一支的"控件清单"就是 `JSON_SPEC.workbench.sides.*.controls`——**不另立第二份清单**，
  门禁读的仍是 yml `spec` 那三个指针，`spec.ids` 指的是 `JSON_PANEL_IDS`。
- `validValues` 判据：`layout` 只许 `panels` / `workbench` 两个字面值之一，别的值直接红。
- `:570` 那行汇总读数打印 `panels ${t.panels.length}`：改成顺带显示 `layout`，非必改（不判红）。
- 牙齿：`check-tools-surface-teeth.mjs` 为这一族补三刀——T-a 把 json 条目的 `layout` 改成 `panel`
  （少个 c）→ 必须红在取值档；T-b 把 `panelIds` 写回 `ymlPanels`（即让分支失效）→ 必须红，
  且红的必须是"缺少 id"那一族而不是内部自洽那条；T-c 删掉 json 条目的 `layout` 且 `panels: []`
  → 必须红在"既没声明又没有清单"。

### 0.4 依赖这一格：不新增 npm 依赖，vendoring `js-yaml` 的 browser ESM 产物

设计期（段 1 计划 `:17`）写的是"不动 `package.json` → 不加 `test:tools` 脚本，脚本登记留到第 4 段
随 `js-yaml` 一起做"，spec §7 那一行写的是"js-yaml 用 `dist/browser/js-yaml.esm.min.mjs` 入口"。
**执行到本段，改道成"把它作为源文件内置一份"**，三条理由，都是本段实测：

1. **`package.json` 现在被别人占着**。`git diff --cached -- package.json` 实读到两条未提交的
   `wechat:draft*` scripts 条目。pathspec 提交整文件会连带发布对方未发表的那两行（§9 规则 2 明令禁止，
   而 hunk 切分在本仓库已被验证无效）。`pnpm add -D js-yaml` 之后 `package.json` + `pnpm-lock.yaml`
   两处都改、且必须同批提交（CI 是 `--frozen-lockfile`），这一格在对方的批次落进 HEAD 之前**做不了**。
2. **本仓库对浏览器代码的既有做法就是内置**：`dev/libJs/` 里躺着 jquery 3.7.1、prism、social-share、
   canvas-nest、vue 2.6.12、vconsole、fastclick——`package.json` 里 `"dependencies"` 一格
   **根本没有**（实读 `node -e` 只有 7 项 devDependencies，全是构建工具）。
   `THIRD-PARTY-NOTICES.md` 第一节就是为这件事设的账，口径写着"逐字节比对已确证（就是上游那一份）"。
   新增一个内置件走的是既有那条路，新增一个 npm 依赖反而要同时改五条口径。
3. **内置的价钱量得出来，而且比依赖便宜**（下面这组数是 2026-09-29 在一份 HEAD 导出树里真跑
   `npx vite build` 量出来的探针，`exit=0`，跑完即弃）：

```text
探针文件：dev/libJs/js-yaml.esm.min.mjs（78,721B，从 npm tarball js-yaml-5.4.2 逐字节复制）
          dev/js/tools/probeConvert.js（3 行，import 那本 .mjs 的相对路径）
          dev/js/probeJson.js（2 行，入口）
构建：      仓库 HEAD 的那份 vite.config.js，一字未改
产物：      assets/js/probeJson.min.js   raw 56,955B   gzip -9(stdin) 16,912B
同批对照：  assets/js/toolCodec.min.js   raw 59,317B   gzip -9(stdin) 21,830B（= spec §7 编码页那一格）
            assets/js/toolkitCore.min.js raw 19,109B   gzip -9(stdin)  7,037B
            assets/css/toolkit.min.css   raw  9,418B   gzip -9(stdin)  2,135B
import{     24 本 assets/js/*.min.js 全部 0 命中（含探针那一本）
副产物      assets/js/ 里没有多出 js-yaml 那一本（`.mjs` 既不成入口、也不被 copyMinifiedLibs 复制）
```

**结论**：YAML 那一族的字节价钱 = **16,912B gzip**（含探针自己的约 200B），远低于"降到仅序列化"
那条触发线；`toolJson.min.js` 预计 45–55KB gzip，`JSON 页 JS+CSS` 那一行 120KB 的预算余量充足，
但**照 §0.5 的规矩，数还是要先量后立**。

**落地的四条例子**：

- 内置件的路径与文件名一律照上游：`dev/libJs/js-yaml.esm.min.mjs`（**不改名、不剥尾部的
  `//# sourceMappingURL=` 那一行**）。保持逐字节等于 tarball 里那个成员，是为了让
  `THIRD-PARTY-NOTICES.md` 第一节的哈希口径可复算。站内 `jquery.min.js` 尾部同样挂着一条不存在的
  map 引用，线上多年无人受害，不是新坑。
- `dev/libJs/` 不进 Jekyll 产物（`_config.yml:228` 的 `exclude` 明列 `dev`，实读 `_site/dev` 不存在），
  它也不是 Vite 入口（`getDevLibJsEntries():110` 只收 `.js` 结尾，`.mjs` 不在内；
  `copyMinifiedLibs():67` 只复制 `.min.js`）——**它唯一的用途是被 `json-convert.js` 相对 import**。
- 唯一允许 import 它的那一本是 `dev/js/tools/json-convert.js`（相对路径 `../../libJs/js-yaml.esm.min.mjs`）。
  §U 有一条判据钉"这一族在全仓库只此一个 import 点"，§W 有一条钉"入口/装配层都不许直接 import 它"。
- 升级口径写进 `THIRD-PARTY-NOTICES.md` 本行与 `json-convert.js` 文件头：换版本 = 换文件 + 改
  §U 那条哈希判据里记录的 `sha256` 与版本串 + 复跑 §U/§W 与门禁②③；**不许**顺手 `sed` 内置件。
- 顺带把 `test:tools` 那一格也改道：**本段不加**（同一文件被占）。运行命令仍是段 1/2/3 用的那一条
  `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs`；
  spec §8.1 标题里那个 `pnpm test:tools` 在段 5 收尾（版本三处同步那一批本来就要碰 `package.json`）
  一起补，届时把这一格的红字一并撤掉。

### 0.5 §7 预算：JSON 页那一行是设计期拍的 120KB，本段按段 3 的规矩先量后立

spec §7 表里现有的 JSON 那一格只有一行：「JSON 页 JS+CSS | gzip ≤ 120KB（含 js-yaml）」——
**设计期拍的数**（表里其余四行都带着"2026-09-27/28 按实测算钉"的落款，这一行没有）。
本段照段 3 §0.4 与段 3 Task 8 的形状做两件事：

1. **量，然后立两行**（Task 8）：`JSON 页 JS+CSS`（口径 = `toolkit.min.css` + `toolkitCore.min.js` +
   `toolJson.min.js` + `toolJson.min.css` **四件各自 gzip 再相加**，共付件与两页重复计入，
   与编码页那一行同一口径）与新增的 `JSON 页自身增量的首屏成本`（`toolkit.min.css` +
   `toolJson.min.css` + `_site/tools/json.html` 三件）。数写在实测之上并留 **≥5% 余量**，
   压缩级抖动实测：编码页三件 level 6↔9 差 52B、首屏那一格差 61B（spec §7 段 3 Task 8 那一格）。
2. **不自行改设计期的 120KB 那一行**：若实测远在 120KB 之下，就在同一行后面追加实测与推导，
   把那一行改成"≤ 立出来的那个贴实测量 + 5%"，并留一句"设计期那 120KB 是拍的不是量的"。
   若实测**超过** 120KB，按 §0.4(BLOCKED) 的同一规矩**停下交回给人判**，不自行动"YAML 降到仅序列化"
   那一档——那一档是 §7 的处置，不是本段的自由裁量。

口径警告照抄一遍，因为它每年都骗一次人：gzip 一律 `cat f | gzip -9 | wc -c`（走 stdin），
**不是** `gzip -9 -c f`（FNAME 头每件 +16–19B），也不是 `zlib.gzipSync`（同一批字节差 293B 那一档）。

还有一条来自 §7 最新的现场：证件页首屏那一格 2026-09-29 复量到 **15,669B / 余 715B（4.4%）**，
"≥5% 余量"那条经验线**已经破了**——而它判的是两件共付件之一（`toolkit.min.css`）。所以：

- **本段一律不给 `toolkit.scss` 加东西**。JSON 页需要的样式全进 `dev/sass/toolJson.scss` 那一本新文件。
  这条不是洁癖：`toolkit.min.css` 每涨 1B，证件页与编码页两格同时跟着涨。
- 若 `toolkitCore.min.js` 或 `toolkit.min.css` 因为任何原因必须动（本段的计划里**没有**这一格），
  动之前必须先按 §7 口径重量那三格首屏/总量余量，并把读数写进当格记录。

### 0.6 与 §5.3 的三处按事实改道（写清楚，别让读 spec 的人以为实现漏了）

| spec §5.3 那一句 | 本段的落地形状 | 为什么 |
| --- | --- | --- |
| 「错误处标出精确**行列号**并**在输入区高亮那一处**」 | 行列号照给；"高亮"落地成**三件**：`textarea.setSelectionRange(index, index+len)` + 把那一行滚进视口 + 结果区给一段「上下文三行读条」（出错行原样 + 一个 `^` 指示列 + 前后各一行，等宽） | `<textarea>` 里画不出可靠的覆盖层高亮：镜像 `<pre>` 要与 textarea 的字体度量、换行策略、滚动位置三者任一不匹配就错位，而"错位的高亮"比"没有高亮"更误导。选中区间是浏览器原生绘制，天然对齐，且用户立刻能复制那一处。上下文三行读条是 DOM，判据咬得住（§W） |
| 「JSON ↔ XML（`DOMParser` + `XMLSerializer`）」 | **不用 DOM 那两只**；XML 那一族是本站自定义的**无损映射**：写器只发本站读的回来的一集，读器是自己写的（元素 / 文本 / CDATA / 注释跳过 / 数字与五类预定义实体），键名非法或出现 DOCTYPE 就**整体拒绝并点名** | 三条：① 判据套件跑在纯 Node 22（§8.1 开头那句"纯 Node、无新依赖"），`DOMParser` 不存在，那一族就会变成"浏览器里才测得动"的孤儿；② `XMLSerializer` 不携带类型，`1`（数字）与 `"1"`（字符串）、`null` 与 `""` 全部塌成同一个串，**JSON→XML→JSON 深相等**这条判据（§8.1 互转那一行）不可能过；③ `DOMParser` 遇到坏输入返回的 `<parsererror>` 文案是浏览器各自一套，"错误处标出精确行列号"这一族在它那儿就无从断言。落地形状：对象→每键一元素、数组→`<item>` 子元素、标量带 `t="str|num|bool|null"`，根元素 `<json t="obj|arr">`；同名兄弟元素在读侧归并成数组。支持的子集与拒绝项在面板上明写一句 |
| 「JSON ↔ YAML（js-yaml）」 | 库还是 js-yaml，但**内置**而非依赖（§0.4）；并新增一条"歧义值"口径：`yes/no/on/off/null/2024-01-01` 这类串在 YAML 1.1 默认 schema 下会被解成布尔/日期，因此**只承诺 `JSON→YAML→JSON` 往返等价**（写侧带引号），`YAML→JSON` 方向遇到 `Date` 一律转 ISO 8601 字符串、遇到 `!!binary` 转 base64 串、遇到 function/undefined **拒** | 这句必须在页面与判据里同时说话：往返等价与"读谁都能读对"是两件事，含糊过去就是给用户一个会悄悄改类型的工具 |

（CSV 那一格不改道：`§5.3` 说的"自实现 RFC 4180：引号转义、内嵌换行、CRLF、BOM、表头行"照做。
唯一要额外写明的是**类型保真**：CSV 天生无类型，回读一律是字符串，`null` 落空字段且不可逆——
所以 §8.1 那句"三对往返等价"在 CSV 这一对上，只对"值全为字符串或数字且无 null"的样本断言深相等，
其余样本断言的是"给到了不可逆那一档的说明"。）

**§5.4 那一族"校验输出口径"在这一页的对应物**（它是三页共用的，但三条话要按 JSON 的形状重写一遍，
否则实现期会以为"三态表"是证件页专有的）：① **结论可区分**——解析结果分三态：可解析 / 位置非法
（带行列与上下文）/ 超限整体拒绝，三者语气与色调（`JT_TONES`）不同档，不许都写成"JSON 格式错误"；
② **给依据不给黑箱**——顶部读数那一行（字节 / 行 / 节点 / 深度 / 键数）与 `duplicateKeys` 的提示
都是"为什么"，坏输入时也要照样给能给的读数；③ **不夸大承诺**——TS 生成顶部那句"按样本推断，
不是 schema"（`TS_HEADER_NOTE`）、YAML 歧义值那句、CSV 不可逆那句、XML"只支持本站这一族写法"那句，
四句都必须渲染进面板，§W / §S / §U 各有一条判据钉"常量非空且出现在结果里"。

### 0.7 共享文件与镜像纪律（本段最容易翻车的一格，逐条指名）

1. **`_data/onlineTools.yml`**：本段要往末尾**追加** `slug: json` 一条。这一格现在带着另一路会话
   未提交的「免安装工具」改口（段 3 Task 9 第 3 笔记录的同一格，现读仍是 `M` 态）。落地动作：
   - 工作树里**只追加我的条目**，一个字都不碰他们那两行；
   - **不暂存、不提交**这一格，直到他们的批次落进 HEAD。理由与段 3 §9 规则 2 同一条：
     pathspec 提交整文件 = 替他们发布未发表的文案。
   - 镜像：在**HEAD 导出树**里（`git archive HEAD | tar -x -C /tmp/segX/tree`）把那一份纯 HEAD 的 yml
     追加我的条目，跑 `node scripts/verify-plan-blocks.mjs --fix` 重写段 2 计划里那一块镜像
     ——这样烤进计划的是 **HEAD + 我的条目**，不含他们的改口。搬回活树前先
     `diff -q <(git show HEAD:段2计划) 段2计划` 证明没人正在改那一份计划，然后 `cp` 那一个文件。
     这套动作是段 3 Task 9 第 2 笔的原样复用。
   - 于是活树跑门禁② 会一直红在 yml 那一格（磁盘 = HEAD+他们+我 ↔ 镜像 = HEAD+我），
     **这不是缺陷，是门禁在如实报告**；台账里写清"活树红的是哪一格、导出树绿"。
2. **`package.json` / `pnpm-lock.yaml` / `_config.yml` / `README.md` / `.baoyu-skills/**` /
   `dev/js/editorial.js` / `dev/sass/common/editorial.scss` / `_includes/header.html` /
   `index-all.html` / `llms.txt` / `scripts/verify-idcard-browser.mjs`**：本段一律不碰、不暂存。
   （最后那一条是 §0.8 的理由。）
3. **`tools.html`**：`tools.html:151` 那格徽章是 `{{ tool.panels.size }} 块面板`，JSON 条目
   `panels: []` → 线上会画出「**0 块面板**」。要改的就一行（按 `layout` 分派）。这一格同样带着
   他们未提交的 kicker/统计改口，所以处置与第 1 条一样：**改在工作树、验证在 `_site`、
   提交等窗口**。Task 8 的浏览器核验里加一条判据：`/tools.html` 的 json 小节里不得出现
   `0 块面板`——它现在会红，红的就是那一格未提交的模板，正是"别悄悄发布一个自相矛盾的页面"。
   （若提交窗口一直没开，就在收口记录里把它列成"唯一未闭合的一格"，不许用"反正门禁绿"糊过去。）
   连带一条：`tools-codec.html:35` 的 masthead 统计里也有 `{{ tk.panels.size }}` 块面板——
   **JSON 页那份页面源不许照抄这一行**（本页 masthead 给"三档闸门 / 五类输出 / 0 网络请求"
   那一族读数），这一处不是门禁管的，是抄骨架时会顺手抄错的地方。
4. **`THIRD-PARTY-NOTICES.md`**：干净、且是本段内置件的唯一归属记录处 → 加一行（上游、版本、许可、
   sha256 前 8 位、判据 = 与 npm tarball 成员逐字节同哈希）。这文件是他们 09-28 新建的
   （`c20bb3a`），当前 `git status` 里不脏，可以提交；但**每次暂存前重新确认**。
5. **镜像硬规矩（段 3 §0.6 原样继承）**：契约段一律 ` ```text ` 围栏；只有"计划里那份文件全文"与
   "某一节测试全文"才允许 ` ```js `——否则 `pickMirror` 在两块 js 之间犹豫，报"候选不唯一"，
   等于把门禁二变成手工活。`PLANS` 里加本计划（`tag: '段4'`）之后，`FILE_TARGETS` 登记方向是
   **磁盘有了才登记**，早一天贴进来门禁二就早一天红。

### 0.8 段 3 交回的浏览器侧义务：提公共表 + 回补证件页那四条，但**不改那两本脚本**

spec §8.3 的对账表末写着：证件页那四条缺口（方向键 / 真 `Enter` / `Esc` / Console 监听）
"等 json 页那一格把这套形状提成参数表时一起回补"，同时"三页共用同一套核验形状才划算"。
落地形状：

- **新增** `scripts/verify-tools-browser.mjs`：通用六族 × 三页 profile。profile 从
  `_data/onlineTools.yml` 现读（`slug` / `url` / `prefix` / `layout` / `panels`），
  **不在脚本里再抄一张页表**——§4.2 那条"同一份事实不写第二遍"对核验脚本同样成立。
  六族 = ① 十档视口（`360/640/641/880/900/901/920/940/1280/1920`，段 2 那份清单原序）
  ② 昼/夜 × 三档纸色对比 ③ 键盘（`Input.dispatchKeyEvent` 真按：`Tab` 走进来、`Enter` 触发当前
  聚焦按钮、`Esc` 关公共层 ⌘K）④ 禁 JS（摘掉全部 `<script>` 的同源副本 + `<noscript>` 摊平）
  ⑤ 首屏阻塞集（`renderBlockingStatus` 现量，只判本地件）⑥ Console 三档归因
  （`Runtime.enable` + `exceptionThrown` + `consoleAPICalled` + `Log.entryAdded`；本源 error 级必 0、
  页内专有件必 0、站级 warning 只列账不判红）。
  面板式那一族（方向键切面板 / roving tabindex）按 `layout` 分派：`panels` 页核，`workbench` 页
  **换成"↑/↓ 不许劫持 textarea 的原生滚动"** ——不为没有索引条的页面造交互。
- **`verify-idcard-browser.mjs` 与 `verify-codec-browser.mjs` 都不改**，理由两条：前者正被另一路会话
  改着（` M` 态），后者有 `verify-codec-browser-teeth.mjs` 那五刀**按字符串与行号钉在它身上**，
  重排一次就要重做一次牙齿（段 3 Task 9 记的那条"别拿一次崩场当没牙"的反面教训是相反的：
  牙齿 harness 与它盯的串是一对一的耦合件）。于是**重复面写进收口记录**：通用六族今天在
  编码页那一本与公共表里各有一份，等证件页那一本的另一路会话落定后再合流、删那一份。
  证件页那四条缺口由**公共表的 `panels` 那一支**关掉（不需要动它自己的脚本）。
- **新增** `scripts/verify-tools-browser-teeth.mjs`：六族各一刀变异 + 三条假牙自检，照
  `verify-codec-browser-teeth.mjs` 的形状，包含它记下的四条口径：
  `TK_SITE_DIR` 指到仓库自己的 `_site` 时**直接退 2**；变异只打在副本上、每轮 `restore()` 用 md5 自证；
  `File.prototype` 没有自有 `arrayBuffer`（要打在 `Blob.prototype` 上并把安装形状打进读数）；
  `focus()` 落在 `display:none` 子树里静默失败（切视图的辅助函数必须在内部自证 `shown === 目标`
  并带一个 `alive`）。
- 一次跑满三条硬输入：5 MiB JSON（放行）、5 MiB + 1B（整体拒绝且不回显那一大串）、
  200 层嵌套（放行并渲染），再加一条 JSON 页特有的"粘贴 2 MB 连续 20 次 `input` 事件、
  在点按钮之前解析发生 0 次"的防卡判据（§W 的 debounce 契约）。

### 0.9 红线（继承段 1/2/3，一律不许碰）

不改 `scripts/fixtures/region-source/`、`dev/js/tools/region-data.js`、`region.js`、
`scripts/build-region-data.mjs`、`dev/js/tools/panel.js`、`panel-dom.js`（本段两本都不 import）、
`demo/idCardDemo/`（段 5 删）；不裸 `git add -A` / `git add .`，只用 pathspec 提交自己碰的文件；
不跑 `deploy-github.sh`；**push 要单独获得同意**（本轮用户在 2026-09-29 说的是"任务完成以后……
无问题以后自动提交代码，无需向我确认，直到所有任务都完成"——那是对**提交**的授权，
不含推送；§0.7 那批未提交窗口也因此保留）。测量前先清遗留 Chrome 与端口，只杀自己记下的 pid。
只做纯本地计算：解析、格式化、互转全在浏览器里算，不接任何网络服务、不上传文件、
"记住上次输入"默认关且只写本机 `localStorage`（§5.5）。

---

## 1. 文件结构（本段全部新增 / 修改）

**新增**

```
dev/libJs/js-yaml.esm.min.mjs   vendored 上游件（js-yaml 5.4.2 / MIT，78,721B，逐字节 = npm tarball 成员）
dev/js/tools/json-core.js       解析 + 精确行列定位 + 格式化/压缩 + 键排序 + Pointer + 闸门（§S）
dev/js/tools/json-ts.js         TypeScript interface 生成（§T）
dev/js/tools/json-convert.js    YAML(vendored) / XML(自实现无损子集) / CSV(RFC 4180)（§U）
dev/js/tools/json-tree.js       树拍平 / key·值搜索 / 只渲染可视行的增量控制器（§V）
dev/js/tools/jsonView.js        输出区的纯字符串视图层（§W，与 view.js 同一条零 import 红线）
dev/js/tools/jsonWorkbench.js   装配层：闸门 → 纯模块 → jsonView/json-tree → 绑定（§W）
dev/js/toolJson.js              页面入口（vite 自动收为入口 → assets/js/toolJson.min.js）
tools-json.html                 页面骨架，写死 permalink: /tools/json.html
dev/sass/toolJson.scss          工作台专有样式（.jt-*；共用的 .tk-* 一律留在 toolkit.scss 不改）
assets/img/tools/json-tool.svg  下拉与小节的图标（门禁⑤ 按图形对比度 ≥3.0 判）
scripts/verify-tools-browser.mjs        三页通用六族（§0.8）
scripts/verify-tools-browser-teeth.mjs  它的牙齿
```

**修改**

```
_data/onlineTools.yml           末尾追加 slug: json 一条（layout: workbench，panels: []）——提交窗口见 §0.7 第 1 条
tools.html                      那一格「N 块面板」徽章按 layout 分派（**只此一行**）——同一提交窗口
scripts/toolkit-tests.mjs       追加 §S §T §U §V §W；文件头「用例分布」地图在收口格整表重算
scripts/verify-plan-blocks.mjs  PLANS 加第四份（tag: '段4'）+ FILE_TARGETS 登记（跟着磁盘走）
scripts/verify-plan-blocks-teeth.mjs  副本拷第四份计划；G6 的"所有计划都空"；G12 的清单认四份
scripts/check-tools-surface.mjs         layout 分派（§0.3）
scripts/check-tools-surface-teeth.mjs   为 layout 那一族补三刀
THIRD-PARTY-NOTICES.md          第一节加 js-yaml 那一行
_docs/superpowers/specs/…design.md      §7 两行、§5.3 三处落地形状回写（§0.6）、§8.3 对账表更新
_docs/superpowers/plans/…段2 计划       只由 --fix 重写 yml 那一块镜像
USAGE.md                        检索层自查的 CollectionPage / 总数两格计数（第 6 条）
```

**刻意不做**：不删 `demo/idCardDemo/`（段 5）；不改 `toolkit.scss` / `toolkitCore.js`（§0.5）；
不加 npm 依赖 / `test:tools`（§0.4）；不给 `window.Tk` 加第五只；不改那两本既有浏览器核验脚本（§0.8）；
不给 JSON 页造"面板 / 索引条 / Esc 关面板"这类它没有的交互。

---

## 2. 判据地图（编号 ↔ 它咬的那一件事；执行期不得改名）

| 节 | 落在哪本 | 条数 | 钉住的事实族 |
| --- | --- | --- | --- |
| §S | `dev/js/tools/json-core.js` | 20 | 20 个坏样本逐个报**行列**；闸门四档（5 MiB / 20 万行 / 1000 层 / 空输入）；`locate` 的 CRLF·BOM·代理对三套口径；Pointer 的 `~0`/`~1` 双向；排序稳定性与不改入参；重复键"取后写 + 给一条提示" |
| §T | `dev/js/tools/json-ts.js` | 10 | §8.1 那六类（嵌套对象 / 数组 / 联合 / 可选键 / 数字开头键 / `null`）各一条以上；空数组 → `unknown[]`、空对象 → `{}`；同名接口冲突追加数字后缀；键名要不要引号的唯一判据 |
| §U | `dev/js/tools/json-convert.js` | 18 | vendored 件自证（sha256 + 版本串 + 全仓库唯一 import 点 + 零 Node 全局）；YAML 往返等价与歧义值那一档；XML 无损子集（写↔读等价 + 非法键/DOCTYPE 明确拒绝 + 位置可断言）；CSV 的引号 / 内嵌换行 / CRLF / BOM / 重复表头五族 |
| §V | `dev/js/tools/json-tree.js` | 16 | 拍平行序与深度；`DEFAULT_EXPAND_DEPTH=2`；单节点键数上限 `ROW_KEYS_LIMIT` 与"还有 N 个未显示"；搜索 key/值/both 三档与 `truncated`；**虚拟渲染**：5,000 行数据滚到任意位置，一次进 DOM 的行数 ≤ `RENDER_WINDOW`；折叠后展开的 scrollTop 锚点不漂 |
| §W | `jsonView.js` + `jsonWorkbench.js` + `toolJson.js` | 18 | 视图层零 import；装配层不读环境（时钟 / `localStorage` / `Blob` / `createObjectURL` / `getComputedStyle` 全注入）；按钮 → 模块 → 输出一次闭环；「粘贴不自动解析」那一条计数；**行号槽与输入同源**（最后一行的行号 == 闸门读到的行数，横竖滚动都跟得上——§5.3 那句"带行号"的唯一可断言形状）；`remember` 默认关且关着时 `setItem` 零次；控件 id 与 `JSON_SPEC` 双向对账；入口那三格常量（`CONTAINER_ID`/`NOTICE_ID`/`ATTR`）与容器四条 `data-jt-*` 齐；换前缀自证 |

新增共 82 条，套件从 **268 → 350** 一档（收口格按 `^test(` 站点数与 runner 的 `# tests` 行两个口径
复算，不一致就是那张地图过期——段 3 Task 9 第 2 笔立的规矩）。

---

## Task 1: 接线与内置件（`js-yaml` vendoring + 门禁认第四份计划）

**Files:**
- Create: `dev/libJs/js-yaml.esm.min.mjs`（从 npm tarball 逐字节取，不 `pnpm add`）
- Create: `dev/js/tools/json-convert.js`（**桩**：只有文件头注释 + 那一条 import + 一个 `throw new Error('not yet')`；
  桩不进镜像，落盘即登记会红，所以登记排在 Task 4）
- Modify: `scripts/verify-plan-blocks.mjs`（`PLANS` 加 `{ rel: '_docs/superpowers/plans/2026-09-29-tools-json-page.md', tag: '段4' }`）
- Modify: `scripts/verify-plan-blocks-teeth.mjs`（`PLAN_RELS` 不再手抄，改从被测脚本的 `PLANS` **惰性**现读
  （`parsePlanRels()`，见 Step 3 落地记录第 1 条：顶层读会让 G13f 变假牙）；G6 的"所有计划都空"与
  份数文案从 `PLAN_RELS().length` 插值；G12 改成**逐 tag 各咬一刀**，tag 集从基线 `OK` 行现读）
- Modify: `THIRD-PARTY-NOTICES.md`（第一节一行 + 第五节上游路径清单一行）
- Modify: `scripts/toolkit-tests.mjs`（追加 `// ── §U …` 那一节的**前五条**：U1–U5 内置上游件自证，见下面 Step 1）
- Modify: `_docs/superpowers/plans/2026-09-25-online-tools-foundation.md`（§A 镜像被 U4 带来的
  两行 import 带漂，由导出树里的 `--fix` 整块重写——本格唯一一处"动别人的计划"，见 Step 4）

**为什么 vendoring 排在第一格**：它是唯一一个"改了就能红"的事实——哈希判据要在任何 YAML 代码
存在之前立住，否则将来有人"顺手修一下内置件"时没有东西拦得住。

- [x] **Step 1: 写红判据（§U 的 U1–U5：内置上游件自证族）**

在 `scripts/toolkit-tests.mjs` 末尾加一节 `// ── §U YAML/XML/CSV 互转（tools/json-convert.js，段 4 Task 1 起）`，
先只写五条，全部围绕那本内置件：U1 字节数 + sha256（并把 npm tarball 整包哈希写进注释，
让"从上游复算"这条路留着）+ 尾部 sourcemap 引用不许剥；U2 首行 banner 逐字等于上游那一串
（版本、地址、许可三项一起，凭记忆写即红）；U3 四个 Node 专属词各 **0 次**（数次数不是数行，
产物是单行的）；U4 全仓库 import 它的那一本恰好只有 `json-convert.js`（先剥注释再数，
否则判据文件自己就是第一条假命中）；U5 `package.json` 与 `pnpm-lock.yaml` 里 `js-yaml` 出现 0 次
——这一条钉的就是"我们没有偷偷加依赖"，对方若日后加了，这条要显式改，不许静默变绿。

#### `scripts/toolkit-tests.mjs` §U（整节，从 `// ── §U` 那一行到本节末）

```js
// ── §U YAML/XML/CSV 互转（tools/json-convert.js，段 4 Task 1 起）────────────────
//   本段第一格只立**内置上游件**那一族（U1–U5）。YAML 的实现要到 Task 4 才落，但
//   "仓库里躺着一本别人写的浏览器端产物"这件事必须当天就有人盯着：将来谁"顺手修一下
//   这个 minified 文件"（改一个空格、剥掉尾部那条 sourcemap 引用、换个版本），
//   THIRD-PARTY-NOTICES.md 第一节里"逐字节比对已确证（就是上游那一份）"那句话就变成谎话。
//   为什么它是内置件而不是依赖：段 4 计划 §0.4 那三条理由（package.json 当时被另一路会话
//   占着 / 本仓库浏览器代码的既有做法就是 dev/libJs 内置 / 内置的价钱量得出来——探针实测
//   toolJson 那一族 16,912B gzip），口径与复算命令都写在那一格，这里不抄第二遍。
//   两条计量口径的坑提前挡掉：`grep -c` 数的是**行**而这些产物是单行的（U3 用 split 数次数）；
//   注释里出现的那个路径不是 import 边（U4 先剥注释再数，否则本文件自己就是第一条假命中）。

/** 内置件在仓库里的位置与它的上游身份，三个数一起才钉得住"这一本 = 那一份"。 */
const YAML_LIB_PATH = 'dev/libJs/js-yaml.esm.min.mjs';
const YAML_LIB_BYTES = 78721;
/** npm tarball js-yaml-5.4.2 里 `package/dist/browser/js-yaml.esm.min.mjs` 那个成员 */
const YAML_LIB_SHA256 = '154ea2da9e53404fb206f19cb9ce6c3a9880295fa34b96e40855be7cbc02f082';
/** `https://registry.npmjs.org/js-yaml/-/js-yaml-5.4.2.tgz` 整包（363,341B，2026-09-29 curl 实读） */
const YAML_TGZ_SHA256 = '0003d2f51f6717c17a708449d05f2f8d8c90a52e9ba4587ff7e8e474c9792209';
/** 唯一被允许 import 它的那一本装配层之外的纯逻辑模块（§0.4 落地规矩第三条） */
const YAML_LIB_CONSUMER = 'dev/js/tools/json-convert.js';

test('U1 内置件逐字节等于上游 tarball 的那个成员，尾部 sourcemap 引用不许剥', () => {
  const abs = resolve(ROOT, YAML_LIB_PATH);
  const bytes = readFileSync(abs);
  assert.equal(bytes.length, YAML_LIB_BYTES,
    `字节数不是 §0.4 探针那格记的 ${YAML_LIB_BYTES}——内置件被改写过，或上游换了版本而没人改判据`);
  assert.equal(sha256Of(bytes), YAML_LIB_SHA256,
    `与 js-yaml 5.4.2 那个成员的 sha256 不符：换版本要走 §0.4 的升级口径（换文件 + 改本判据 + 复跑 §U/§W），`
    + `整包哈希 ${YAML_TGZ_SHA256} 记在这里是为了能从 tarball 复算，不是让人顺手 sed 这个文件`);
  const text = bytes.toString('utf8');
  assert.match(text, /\/\/# sourceMappingURL=js-yaml\.esm\.min\.mjs\.map$/,
    '尾部那条 map 引用被剥掉了——它指向站内不存在的文件，但"逐字节等于上游"比"少一行注释"值钱（ jquery.min.js 同样挂着一条，线上多年无人受害）');
});

test('U2 banner 里的版本与许可就是判据与 THIRD-PARTY-NOTICES 写的那一串', () => {
  const first = readFileSync(resolve(ROOT, YAML_LIB_PATH), 'utf8').split('\n', 1)[0];
  assert.equal(first, '/*! js-yaml 5.4.2 https://github.com/nodeca/js-yaml @license MIT */',
    '首行 banner 变了就是身份变了：版本串、上游地址或许可任一项都不许靠记忆改');
});

test('U3 浏览器端产物：四个 Node 专属词各 0 次（数次数不是数行）', () => {
  const code = readFileSync(resolve(ROOT, YAML_LIB_PATH), 'utf8');
  for (const word of ['require(', 'process.', 'Buffer', 'module.exports']) {
    assert.equal(code.split(word).length - 1, 0,
      `内置件里出现了 ${word}——它就不再是"只给浏览器用"的那一本了（spec §7 指定的是 dist/browser 入口）`);
  }
});

test('U4 全仓库只有一本 import 它，且那一本就是 json-convert.js', () => {
  const importers = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const abs = join(dir, f);
      if (statSync(abs).isDirectory()) {
        // dev/libJs 是内置件自己的家：扫它只会把"文件名里带这个串"当成 import 边
        if (resolve(abs) !== resolve(ROOT, 'dev/libJs')) walk(abs);
        continue;
      }
      if (!/\.(js|mjs)$/.test(f) || f.endsWith('.min.js')) continue;
      const code = readFileSync(abs, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      if (code.includes('libJs/js-yaml')) importers.push(relative(ROOT, abs).split(sep).join('/'));
    }
  };
  walk(resolve(ROOT, 'dev'));
  assert.deepEqual(importers, [YAML_LIB_CONSUMER],
    `import 内置件的文件应当恰好只有 ${YAML_LIB_CONSUMER} 一本，实读 ${JSON.stringify(importers)}——`
    + `多一本就是给"两个入口同时 import 同一模块 → Rollup 提共享 chunk → iife-wrap 后产物里是 import{…}"`
    + `那一族坑递刀（toolkitCore.js:5-9 记的正是它，牙齿在门禁④）`);
});

test('U5 它不是 npm 依赖：package.json 与 pnpm-lock.yaml 里 js-yaml 出现 0 次', () => {
  for (const rel of ['package.json', 'pnpm-lock.yaml']) {
    assert.equal(read(rel).split('js-yaml').length - 1, 0,
      `${rel} 里出现了 js-yaml——§0.4 拍的是"内置不加依赖"。若这一格改成依赖，`
      + `要同时删掉 U1–U4 与内置件本体，并改 THIRD-PARTY-NOTICES.md 那一行的判据口径，不许两套并存`);
  }
});
```

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs`
Expected: **U1–U4 FAIL**（内置件与 import 点都还不存在），**U5 PASS**——它此刻就是绿的，
因为 `package.json` 里本来没有 `js-yaml`；这一条不靠"红转绿"自证，它的牙在 Task 1 Step 3
的 `--fix` 之后由门禁二核（改一个字节的内置件、或加一条依赖，都会让它立刻红）。

- [x] **Step 2: 取上游件 + 接桩，跑到绿**

```bash
curl --http1.1 -sL https://registry.npmjs.org/js-yaml/-/js-yaml-5.4.2.tgz -o /tmp/seg4/js-yaml-5.4.2.tgz
shasum -a 256 /tmp/seg4/js-yaml-5.4.2.tgz          # 记进判据注释
tar xzf /tmp/seg4/js-yaml-5.4.2.tgz -C /tmp/seg4/jsy
cp /tmp/seg4/jsy/package/dist/browser/js-yaml.esm.min.mjs dev/libJs/
shasum -a 256 dev/libJs/js-yaml.esm.min.mjs         # 填进 §U 判据
```

桩文件头注释要把"为什么不进 `package.json`"三条理由与 §0.4 那组探针数字抄足——**它是未来唯一一份
解释这块内置件为什么在这儿的东西**（`THIRD-PARTY-NOTICES.md` 那行只写许可与哈希）。
再跑一次，Expected: 五条全绿，且套件总数 = 268 + 5。

**落地记录（2026-09-29 实跑）**：红的那一轮是 `# tests 273 / # pass 269 / # fail 4`——
U1–U4 红、**U5 从一开始就是绿的**（Step 1 的 Expected 已按事实改口）。取件用的就是上面那五行，
`/tmp/seg4/` 换成一次性目录，跑完即弃。两个哈希当场复算过：整包 `0003d2f5…`、成员 `154ea2da…`，
站内那份复算同为 `154ea2da…`、78,721B。判据里那句"从 tarball 复算"不是空头支票，复算命令是
`curl --http1.1 -sSL … | tar -xzO package/dist/browser/js-yaml.esm.min.mjs | shasum -a 256`，
已逐字写进 `THIRD-PARTY-NOTICES.md` 第五节的上游路径清单。

- [x] **Step 3: 门禁一/二/三/四跑齐**

`node scripts/verify-plan-blocks.mjs` 期望 `⚠ 未落地` 仍为 0、活树红格仍只有 yml 那一格。
`node scripts/verify-plan-blocks-teeth.mjs` 必须在一棵**带 `.git`、yml 还原到 HEAD 的全量副本**里跑
（段 3 Task 9 立的落点规矩：活树自相矛盾时基线必红，牙齿无从谈起），期望 **`35/35`**——
不是 `29/29`：本格把 G12 从"只咬段 3 一刀"改成"逐 tag 各咬一刀"（每份计划两条 check：变异落地 +
名下镜像全 ✗），四份计划就是 8 条，比原来的 2 条多 6 条。

**本格动过 `dev/`（新增内置件与桩），门禁四必须真重建**（§0.5 那条硬规矩），而且要在**导出树**里
重建，不在活树里——活树的 `assets/` 是另一路会话的产物目录。两棵树各跑一次 `npx vite build`
（`ln -s` 一份 `node_modules` 进去即可，`node_modules` 不在 `git archive` 里也不参与比对）：

```text
纯 HEAD 基线树      exit=0   assets/js/*.min.js 23 本   assets/css/*.min.css 10 本
本格导出树          exit=0   产物清单与基线**逐行相同**（diff 无输出；没有 js-yaml 那一本）
import{ 命中        23 本产物合计 0
共付三件（与 §0.4 探针那格逐字节吻合）
  assets/css/toolkit.min.css      raw  9,418B   gzip  2,135B
  assets/js/toolkitCore.min.js    raw 19,109B   gzip  7,037B
  assets/js/toolCodec.min.js      raw 59,317B   gzip 21,830B
```

这三件的读数与 §0.4 探针、与 spec §7 现有那两行完全一致，就是"内置件与桩都没进任何现有页"的证据：
`.mjs` 不是入口（`vite.config.js:110` 只收 `.js`），`json-convert.js` 在 `dev/js/tools/` 那一层
（`getDevJsEntries()` 只扫 `dev/js/` 一层），且此刻没有任何入口 import 它。

**门禁三在本格咬到的两处自己的缺陷**（都记下来，因为它们都是"脚手架静默说谎"的第 23、24 种形状）：

1. **`PLAN_RELS` 改成从 `PLANS` 现读之后，不能在模块顶层读**。G13f 那一刀把整本脚本（摘掉落点守卫
   调用点的版本）装进一个**只有这一本脚本**的 victim 仓库，要它走到 `mirror()` 才能量出"rmSync 掉
   自己再 ENOENT 崩"那一档；顶层 `readFileSync(REPO/scripts/verify-plan-blocks.mjs)` 会在那之前
   ENOENT，脚本还在原地 → 那条断言的 `survived === false` 永不可能成立，G13f 变成立不起来的假牙。
   现场读数：`exit=1，有 ENOENT=true，脚本自身还在=true`（ENOENT 是有的，但**不是那一档的 ENOENT**
   ——这正是"红了不等于红对了"）。现在 `PLAN_RELS()` 惰性求值并缓存一次。
2. **`matchAll` 少了 `m` 旗标**：`G12` 的 tag 集用 `/^OK .+?：计划\[(段\d+)\]/g` 扫基线输出，
   没有 `m` 时 `^` 锚的是**整串**的开头，51 条 `OK ` 行只命中第 1 条 → tag 集只剩"段1"，
   另三份计划的镜像从此**静默不咬**。这条断言自己会红（`读到 1 个 tag`），但红的成因看起来像
   "别的计划没有镜像"，而真相是扫描没扫全。改 `gm` 之后读数 `tag 集=段1 / 段2 / 段3 / 段4`。

- [x] **Step 4: 登记镜像（本格不进任何新文件的整文件镜像——内置件按 §0.4 明确不登记，
  桩文件不进镜像），`--fix` 只在导出树里跑，然后提交**

镜像方向：`§U` 那一节在磁盘上落地了 → 整节贴进本格 Step 1 的 ` ```js ` 块（计划里此刻只有这一个
js 块）。但 U4 用了 `statSync` / `relative` / `sep`，`toolkit-tests.mjs` 顶部那两行 import 跟着动了，
而**那两行在 §A 的镜像范围内**（§A 取"第一条 §B 标记之前"）——于是段 1 那份计划的 §A 块必然漂。
处置照 §0.7 第 1 条：在导出树（`git archive HEAD` + 只叠我这一格的文件，yml 保持 HEAD 那一版）里
`node scripts/verify-plan-blocks.mjs --fix`，导出树里 `--fix` 只重写那一条 §A 块（4 行差异，
逐行核过就是那两行 import），复跑 `exit=0`；搬回活树前先 `diff -q <(git show HEAD:段1计划) 段1计划`
证明没人正在改它。**不许**在活树直接 `--fix`：那会把另一路会话未发表的 `_data/onlineTools.yml`
改口烤进段 2 计划的镜像里。

```bash
git add dev/libJs/js-yaml.esm.min.mjs dev/js/tools/json-convert.js \
        scripts/verify-plan-blocks.mjs scripts/verify-plan-blocks-teeth.mjs scripts/toolkit-tests.mjs \
        THIRD-PARTY-NOTICES.md _docs/superpowers/plans/2026-09-29-tools-json-page.md \
        _docs/superpowers/plans/2026-09-25-online-tools-foundation.md
git commit -m "feat(tools): 段 4 Task 1 接线——vendored js-yaml 的五条自证 + 门禁认第四份计划"
```

（原计划的 `git add` 漏了 `dev/js/tools/json-convert.js` 与段 1 那份计划：前者是本格创建的桩，
不提交就是"磁盘有、HEAD 没有"，别人干净检出时 U4 立刻红；后者是 §A 镜像被 import 行带漂的那一格。）

提交前 `git status --porcelain` 逐行复核：`_data/onlineTools.yml` / `tools.html` / `README.md` /
`package.json` / `_config.yml` / `dev/js/editorial.js` 等**必须仍在**且不在本次索引里。

---

## Task 2: `json-core.js` — 解析 / 精确定位 / 格式化 / 排序 / Pointer（§S）

**Files:** Create `dev/js/tools/json-core.js`；Modify `scripts/toolkit-tests.mjs`（追加 §S）、
`scripts/verify-plan-blocks.mjs`（`FILE_TARGETS` 加 `'dev/js/tools/json-core.js'`）。

### 对外契约（签名先定死，实现期不改名）

```text
export const MAX_INPUT_BYTES = 5242880;      // 5 MiB（spec §7「JSON 5MB」）
export const MAX_INPUT_LINES = 200000;       // 20 万行（同一格）
export const MAX_DEPTH = 1000;               // 本站主动闸门；§7 深样本那一档是 200 层，必须放行
export const SORT_MODES  = ['off', 'shallow', 'deep'];
export const INDENT_MODES = ['two', 'four', 'tab'];
export const CORE_NOTES = { deepSample: '…', dupKey: '…' }   // 面板原样显示的两句口径

/** 字节/行两档闸门。bytes 数的是 UTF-8 字节（与编码页同一把尺），不是 .length */
export function gate(text) → { ok, bytes, lines, kind|null, limit }
  /** kind 与 parseJson 共用那两个词：'too-long' | 'too-many-lines'；`parseJson` 的第一步就是它，
   *  所以"闸门"在全仓库只有一处口径，两本模块都不自算字节数 */

/** 行列口径（§S 判据钉死）：都从 1 起；column 数 UTF-16 码元；CRLF 只算一次换行；
 *  BOM 占第 1 行第 1 列；行号 = 第 n 次 \n 之后 */
export function locate(text, index) → { line, column }
export function lineStarts(text) → number[]                 // 长度 = 行数 + 1（末格是 length）
export function lineRange(text, line) → { start, end }      // 含行内 \r 之前，供读条与选区用

/** 唯一解析入口。不抛，坏输入返回 {ok:false,error}；入参不是字符串才抛 TypeError */
export function parseJson(text) →
  | { ok: true,  value, depth, nodeCount, duplicateKeys: [{ pointer, times }], stats }
  | { ok: false, error: { kind, message, index, length, line, column, snippet } }
  kind ∈ 'empty' | 'too-long' | 'too-many-lines' | 'unexpected-char' | 'bad-escape'
       | 'bad-number' | 'unterminated-string' | 'unterminated' | 'trailing' | 'depth'
  /** 位置口径：index 指向出错的那一个字符；`unterminated*` 两类指向 EOF 那一格 */

export function formatJson(text, { indent='two', sort='off' }) → { ok, text, bytes, error? }
export function minifyJson(text) → { ok, text, bytes, error? }
/** 值侧工具：不改入参（§S 拿 Object.is / 深比较各钉一刀） */
export function sortJson(value, mode) → value
/** Pointer（RFC 6901）：数组段用十进制下标；`~`→`~0`、`/`→`~1`，编码与解码互为逆函数 */
export function toPointer(segments) → string
export function fromPointer(pointer) → { ok: true, segments } | { ok: false, error: { message, column } }
export function pointerChild(parent, keyOrIndex) → string
/** 把一段任意文本当成 JSON 字符串字面量的**内容**转义；反向只认 JSON 那套转义序列，
 *  \xNN 与尾随逗号一律点名拒（"工具不猜用户想要哪种方言"） */
export function escapeText(text) → string
export function unescapeText(text) → { ok, text, error? }
export function statsOf(value) → { nodes, depth, keys, arrayItems, longestStringChars }
```

`stats` 那一格的形状是 **`statsOf(value)` 的返回再并上 `gate()` 的 `{ bytes, lines }`**（即
`{ nodes, depth, keys, arrayItems, longestStringChars, bytes, lines }`）；结果区顶部那一行读数全从它出，
装配层一个数都不自算（§W 有判据）。

- [x] **Step 1: 写 §S 二十条红判据**——**20 个坏样本**逐条断 `{line, column, index, kind}` 四格
  （不是断"抛错"）：空串、只有空白、`{`、`{"a"`、`{"a":`、`[1,`、`[1,,]`、`{,}`、`{"a":1}{"b":2}`、
  `'a':1`（单引号）、`{"a":1,}`、`\x41` 坏转义、`\u12g4`、`01`、`1.`、`.5`、`+1`、`NaN`、
  `0.1.2`、一个 2,000 层嵌套。每个样本旁边写一句"这一处**为什么**是这个列"，
  并注明与原生 `JSON.parse` 的 `SyntaxError` 消息**不要求**同形（我们只要求位置对）。
  其余各条：闸门四档边界（正好 5 MiB 放行 / +1B 拒且 `error.message` 里含"超出"与差额数字、
  拒的时候**不许**把那一大串回显）；`locate` 对 CRLF/BOM/emoji（代理对）三套口径；
  Pointer `~0`/`~1` 双向 100 次随机往返；`sortJson` 稳定（两个键在 Unicode 序上相邻时谁前谁后钉死）
  与不改入参；重复键取后写 + `duplicateKeys` 报出；与原生对拍（200 层、脏样本、Unicode）
  必须同结论。
- [x] **Step 2: 实现到绿**（解析器**必须迭代式**，显式栈——递归实现在 1000 层会先炸自己的调用栈；
  `formatJson` 与 `statsOf` 同理）。
- [x] **Step 3: 登记镜像 + `--fix` + 门禁①②③⑤⑥ + 提交**（一格一提交，消息
  `feat(tools): 段 4 Task 2 json-core——行列号自实现，20 个坏样本逐个钉行与列（§S）`）。



提交后复跑（2026-09-29，本格落地时的读数）：

- 门禁一 `# tests 293 / pass 293 / fail 0`（§S 进来 20 条，273 → 293）。
- 门禁二在 **HEAD 导出树**（`git archive HEAD` + 只叠本格那四个文件，yml 与 `dev/sass/toolkit.scss`
  保持 HEAD 那一版）里 `exit=0`：53 个已落地镜像、未落地 0 节；两块新镜像由磁盘内容直接生成，
  `--fix` 复跑报的是"没有可同步的镜像块"。活树跑同一条只剩 `_data/onlineTools.yml`（磁盘 141 行 ↔
  镜像 140 行）与 `dev/sass/toolkit.scss`（磁盘 755 ↔ 镜像 684）两格红——那是另一路会话未提交的
  改口与样式批次（§0.7 第 1 条说过的"门禁在如实报告"），**不在活树 `--fix`**，否则替他们发表。
- 门禁三在导出树（那份树里 `git init` + 一次提交，`_data/onlineTools.yml` 是 HEAD 那一版）
  `exit=0`，35/35 通过，末尾两条自证：副本回到全绿、实验前后工作树脏指纹一字不差。
- 门禁五 `exit=0`（2 条 ready：idcard / codec——json 条目要到 Task 7 才进收录面）。
- 门禁六 `exit=0`（全部变异已还原，复跑基线仍绿）。
- 5 MiB 那一档的实测（`/tmp` 里跑，不进仓库）：4,915 行 × 5,230,836B 的数组，
  `parseJson` 211ms（425,001 个节点）、`formatJson` 两格缩进 689ms（出去 8,120,837B，
  已被闸门如实拒收——这正好证明"格式化会把输入顶出 5 MiB"是真实形状，装配层要按**输出**再量一次）、
  1000 层嵌套 2ms 放行、1001 层 `depth` 拒。§7 的预算只量字节不量毫秒，这一串留作 Task 7/8 的
   debounce 与增量渲染那一格的起点读数。

本格与计划的两处口径分歧，都在磁盘这一边收敛，计划正文未改：

1. `modeOf` 的报错文案要点出**常量名**（`SORT_MODES` / `INDENT_MODES`），S13 的判据钉的是这一条；
   契约段那句"只认那一族里的档"没有指定串，实现选了更强的形状。
2. `escapeText` 对**落单代理项**走 `\udXXX` 转义（与原生 well-formed JSON.stringify 同形）。
   文件头那条"出去的值必须还是合法 JSON"管得住 `Infinity`，也管得住裸的半个 emoji——
   契约段没写这一档，S20 补了三条断言把它钉住（成对的代理项仍原样走）。
### 落地镜像（门禁二核的就是这两块，`--fix` 会把它们整块换成磁盘内容）

两块都是**磁盘全文**，用 ```js 围栏（§0.6 的硬规矩：只有整文件与整节镜像允许 ```js，
契约段一律 ```text）。Task 2 落地时（2026-09-29）这两块是**新贴**的——`--fix` 只做整块替换、
从不插入，所以贴的时候直接由磁盘内容生成，事后跑一次 `--fix` 复验它已经全等。

#### `dev/js/tools/json-core.js`（整文件）

```js
/**
 * JSON 核心：解析（精确行列）、格式化、压缩、排序、Pointer、转义、统计。
 * 设计文档 §5.3 的"解析 + 校验 + 精确定位 + 格式化 + 排序 + Pointer"族，段 4 Task 2 落地。
 *
 * ── 这一本为什么必须自己写一遍解析器 ──
 *
 * `JSON.parse` 给不出**位置**。V8 的 `SyntaxError` 消息是 `Unexpected token ',' in JSON at
 * position 7` 这一族（各引擎文案还不一样，Safari 与 Firefox 至今不同形），而 §5.3 要的是
 * "错误处标出精确行列号"并把那一格高亮到输入框上。位置错一格和没报错一样有害：用户照着提示
 * 去删字符，删完还是错。所以行列号只能自己算，`JSON.parse` 在本模块里一次都不出现——
 * §S 的 S16 拿它做**对拍**（同结论、同值），那是判据用的外部尺，不是运行时依赖。
 *
 * ── 位置口径（§S 钉死，实现不许自创第二套）──
 *
 * · `line` 与 `column` 都从 1 起；
 * · `column` 数 UTF-16 **码元**，一个 emoji 占两列——`setSelectionRange` 用的就是这个单位，
 *   两把尺一致高亮才不会错格；
 * · 换行只认 `\n`：CRLF 一行推进一次，`\r` 留在行内、由 `lineRange` 从行内容里切掉；
 * · BOM（U+FEFF）占第 1 行第 1 列，**不吞**它的列位；解析端只容忍头部那**一个** BOM
 *   （从 Windows 文件里粘出来的常见形状），第二个就按"不该出现的字符"点名；
 * · EOF 那一格 `index = text.length`、`length = 0`，列号 = 最后一行的长度 + 1。
 *
 * 与原生只有两处**故意**分歧，两处都由 §S 的判据钉住，不是偶然：
 *   1. `\uFEFF{}`（文件头带一个 BOM）：原生拒，本站收——就是上面那条 BOM 容忍；
 *   2. `1e999`：原生收成 `Infinity`，本站按 `bad-number` 拒——工具里出去的值必须
 *      还是合法 JSON，`Infinity` 到了下游只会变成静默的 `null`。
 *
 * ── 为什么解析、序列化、统计三族全是显式栈 ──
 *
 * 深度闸门 `MAX_DEPTH = 1000` 是本站自己定的，而 V8 的调用栈在递归下降解析器里大约撑到
 * 几百到一千多层就要抛 `RangeError: Maximum call stack size exceeded`——那意味着一份 1000 层的
 * 合法输入会先炸掉我的栈，再炸用户的页面（并且是 `undefined` 而不是任何可读错误）。
 * 所以 `parseJson` / `formatJson` / `minifyJson` / `statsOf` / `sortJson` 全部用显式栈迭代；
 * 判据里那两条 1000 层的样本就是这一族的验收（§S 的 S18）。
 *
 * ── 纯计算 ──
 *
 * 本模块不读任何环境：没有 `window` / `document` / `localStorage` / `process` / `Buffer` /
 * `TextEncoder`，不 `import` 任何东西，也不碰网络。UTF-8 字节数自己按码元算（`utf8Bytes`），
 * 因为浏览器里没有 `Buffer`；§S 的 S3/S18 拿 Node 的 `Buffer.byteLength` 当外部尺对这一族。
 *
 * ── `__proto__` ──
 *
 * 解析出来的对象一律用 `setOwn()` 写键：`obj['__proto__'] = v` 改的是原型而不是属性，
 * 一份恶意 JSON 可以借此污染后续所有对象。`Object.defineProperty` 那一支让它落成真属性，
 * 与 `JSON.parse` 的行为一致（§S 的 S16 样本集里带这一族对拍）。
 *
 * @module dev/js/tools/json-core.js
 */

/** 输入字节上限：spec §7「JSON 5MB」那一档，与编码页文本类的 1 MiB 是**两个不同的数** */
export const MAX_INPUT_BYTES = 5242880;
/** 输入行数上限：同一格里 §7 写的 20 万行 */
export const MAX_INPUT_LINES = 200000;
/** 容器嵌套上限：本站主动闸门；§7 的深样本是 200 层，必须放行 */
export const MAX_DEPTH = 1000;
/** 排序三档：不动 / 只动根 / 连数组元素一起动 */
export const SORT_MODES = ['off', 'shallow', 'deep'];
/** 缩进三档：两个空格、四个空格、制表符 */
export const INDENT_MODES = ['two', 'four', 'tab'];
/** 面板原样显示的两句话径（§W 不再自己编一句） */
export const CORE_NOTES = {
  deepSample: '深度闸门是 1000 层；§7 的深样本按 200 层量，这一档必须放行并且给得出统计。',
  dupKey: '重复键不算错：后写的值覆盖先写的，出现过的每一处按 Pointer 列出来（含次数）。',
};

const INDENTS = { two: '  ', four: '    ', tab: '\t' };
const TAB = 9, LF = 10, CR = 13, SPACE = 32, QUOTE = 34, PLUS = 43, COMMA = 44, MINUS = 45,
  DOT = 46, SLASH = 47, ZERO = 48, NINE = 57, COLON = 58, BACKSLASH = 92, LB = 91, RB = 93,
  LC = 123, RC = 125, TILDE = 126, BOM = 0xFEFF;
/** 码点区间展开成数组——`const` 有暂时性死区，这一把尺必须先于用它的那一行出现 */
const rangeOf = (from, to) => { const a = []; for (let c = from; c <= to; c++) a.push(c); return a; };
/** 数字记号的**贪婪字符集**：先读满这一串，再验语法。于是 `01`、`1.`、`0.1.2` 都指认整记号 */
const NUMBER_CHARS = new Set([PLUS, MINUS, DOT, ...rangeOf(ZERO, NINE), 0x45, 0x65]); // E e
const NUMBER_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const ESCAPE_SHORT = new Map([
  ['"', '\\"'], ['\\', '\\\\'], ['\b', '\\b'], ['\f', '\\f'], ['\n', '\\n'], ['\r', '\\r'], ['\t', '\\t'],
]);
const ESCAPE_VALUE = new Map([
  ['"', '"'], ['\\', '\\'], ['/', '/'], ['b', '\b'], ['f', '\f'], ['n', '\n'], ['r', '\r'], ['t', '\t'],
]);

const isContainer = (v) => v !== null && typeof v === 'object';
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const unitOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sortedKeys = (o) => Object.keys(o).sort(unitOrder);
const clip = (token) => (token.length <= 40 ? token : `${token.slice(0, 40)}…`);

/** 用 defineProperty 而不是赋值，`__proto__` 才会落成真属性（见文件头那一段） */
function setOwn(obj, key, value) {
  if (key === '__proto__') Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
  else obj[key] = value;
}

/**
 * UTF-8 字节数：代理对算 4，BMP 按 3/2/1。浏览器里没有 `Buffer`，这一族自己数；
 * 全模块只有这一个字节口径，`gate()` 与序列化那一族的 `bytes` 都从它出。
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
 * 每一行的起始下标，末格补 `text.length`（所以数组长度 = 行数 + 1）。
 * 换行只认 `\n`：这是 §S 的行口径，`gate()` 的行数、`locate()`、`lineRange()` 全读它。
 * @param {string} text
 * @returns {number[]}
 */
export function lineStarts(text) {
  const out = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === LF) out.push(i + 1);
  out.push(text.length);
  return out;
}

/**
 * 下标 → 行列。列数码元；`index` 越界时钳到 `[0, length]`，EOF 那一格也给得出行列。
 * **每次调用都重扫一遍换行**：一次定位（坏样本报错那一格）用它；要给 N 处位置算行列，
 * 先取一次 `lineStarts()` 自己二分，别把这一本放进循环——5 MiB 输入 × 一万次就是分钟级。
 * @param {string} text
 * @param {number} index
 * @returns {{line: number, column: number}}
 */
export function locate(text, index) {
  const starts = lineStarts(text);
  const at = Math.max(0, Math.min(index | 0, text.length));
  let lo = 0, hi = starts.length - 2, k = 0;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (starts[m] <= at) { k = m; lo = m + 1; } else hi = m - 1;
  }
  return { line: k + 1, column: at - starts[k] + 1 };
}

/**
 * 第 `line` 行的内容区间 `[start, end)`：不含 `\n`，也不含行尾那个 `\r`。
 * 读条与选区直接用这一格，所以 CRLF 的输入不会被高亮成"多一个字符"。
 * @param {string} text
 * @param {number} line 从 1 起；越界钳到第一行与最后一行
 * @returns {{start: number, end: number}}
 */
export function lineRange(text, line) {
  const starts = lineStarts(text);
  const lines = starts.length - 1;
  const k = Math.min(Math.max((line | 0) || 1, 1), Math.max(lines, 1)) - 1;
  const start = starts[k];
  let end = k + 1 < starts.length ? starts[k + 1] : text.length;
  if (end > start && text.charCodeAt(end - 1) === LF) end -= 1;
  if (end > start && text.charCodeAt(end - 1) === CR) end -= 1;
  return { start, end };
}

/**
 * 字节与行数两档闸门。`parseJson` 的第一步就是它，所以"上限"在全仓库只有一处口径。
 * @param {string} text
 * @returns {{ok: boolean, bytes: number, lines: number, kind: (string|null), limit: (number|null), message: string}}
 */
export function gate(text) {
  if (typeof text !== 'string') throw new TypeError(`gate 只收字符串，收到的是 ${text === null ? 'null' : typeof text}`);
  const bytes = utf8Bytes(text);
  const lines = lineStarts(text).length - 1;
  if (bytes > MAX_INPUT_BYTES) {
    return {
      ok: false, bytes, lines, kind: 'too-long', limit: MAX_INPUT_BYTES,
      message: `输入超出上限：最多 ${MAX_INPUT_BYTES} 字节，当前 ${bytes} 字节（超出 ${bytes - MAX_INPUT_BYTES} 字节）。请删减后再解析，本站不做截断。`,
    };
  }
  if (lines > MAX_INPUT_LINES) {
    return {
      ok: false, bytes, lines, kind: 'too-many-lines', limit: MAX_INPUT_LINES,
      message: `输入行数超出上限：最多 ${MAX_INPUT_LINES} 行，当前 ${lines} 行（超出 ${lines - MAX_INPUT_LINES} 行）。请删减后再解析，本站不做截断。`,
    };
  }
  return { ok: true, bytes, lines, kind: null, limit: null, message: '' };
}

/** 转义一段文本成 JSON 字符串字面量的**内容**（不带引号），短转义优先，其余控制字符走 \\uXXXX */
export function escapeText(text) {
  if (typeof text !== 'string') throw new TypeError(`escapeText 只收字符串，收到的是 ${typeof text}`);
  const hex = (code) => `\\u${code.toString(16).padStart(4, '0')}`;
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const short = ESCAPE_SHORT.get(c);
    if (short) { out += short; continue; }
    const code = text.charCodeAt(i);
    if (code < 0x20) { out += hex(code); continue; }
    if (code >= 0xd800 && code <= 0xdfff) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : -1;
      // 成对的代理项原样走（一个 emoji 就是两格码元，与原生同形）
      if (code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { out += c + text[i + 1]; i += 1; continue; }
      // 落单的那半个：原生从 ES2019 起转成 `\udXXX`（well-formed JSON.stringify），这里同形。
      // 吐一个裸的半个代理项出去，交出去的就**不再是合法 JSON**——与文件头拒 `Infinity` 同一条理由。
      out += hex(code);
      continue;
    }
    out += c;
  }
  return out;
}

const quoteText = (text) => `"${escapeText(text)}"`;

/**
 * `escapeText` 的反向：只认 JSON 那套转义序列，`\\xNN`、`\\'`、单独的 `\\` 一律点名拒。
 * 这一族只管转义序列，不校验串内的控制字符（那是 `parseJson` 在整文档层面管的事）。
 * @param {string} text
 * @returns {{ok: true, text: string, error?: undefined} | {ok: false, text: string, error: {kind: string, message: string, index: number, length: number}}}
 */
export function unescapeText(text) {
  if (typeof text !== 'string') throw new TypeError(`unescapeText 只收字符串，收到的是 ${typeof text}`);
  const bad = (index, length, why) => ({
    ok: false, text: '',
    error: { kind: 'bad-escape', message: `不是合法的 JSON 转义序列：${why}（第 ${index + 1} 格起）。`, index, length },
  });
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) !== BACKSLASH) { out += text[i]; continue; }
    if (i + 1 >= text.length) return bad(i, 1, '结尾的反斜杠后面没有内容');
    const nx = text[i + 1];
    if (nx === 'u') {
      const hex = text.slice(i + 2, i + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) return bad(i, 2, '\\u 后面必须是四位十六进制');
      out += String.fromCharCode(parseInt(hex, 16));
      i += 5;
      continue;
    }
    const value = ESCAPE_VALUE.get(nx);
    if (value === undefined) return bad(i, 2, `反斜杠后面的 ${nx === '\\' ? '（空）' : nx} 不是转义字符`);
    out += value;
    i += 1;
  }
  return { ok: true, text: out };
}

const escPointer = (s) => s.replace(/~/g, '~0').replace(/\//g, '~1');

/**
 * 段数组 → RFC 6901 Pointer。数组段用十进制下标；`~`→`~0`、`/`→`~1`。
 * @param {Array<string|number>} segments
 * @returns {string}
 */
export function toPointer(segments) {
  let out = '';
  for (const s of segments) out += `/${escPointer(String(s))}`;
  return out;
}

/**
 * Pointer → 段数组。解码按左到右单趟扫：`~01` 解成 `~1`（先 `~1`→`/` 再 `~0`→`~` 的两趟写法
 * 会把它读成 `/`，那是把用户的数据改坏）。拒的时候只给 `{message, column}`——
 * 指针不是文档，没有行列可言。
 * @param {string} pointer
 * @returns {{ok: true, segments: string[]} | {ok: false, error: {message: string, column: number}}}
 */
export function fromPointer(pointer) {
  if (typeof pointer !== 'string') {
    return { ok: false, error: { message: 'Pointer 必须是字符串。', column: 1 } };
  }
  if (pointer === '') return { ok: true, segments: [] };
  if (pointer.charCodeAt(0) !== SLASH) {
    return { ok: false, error: { message: `Pointer 必须以 / 起始（或以空串表示根），第 1 列这里是 ${pointer[0]}。`, column: 1 } };
  }
  const parts = pointer.slice(1).split('/');
  const segments = [];
  let offset = 1;                                  // parts[0] 在原串里的下标
  for (const part of parts) {
    let seg = '';
    for (let k = 0; k < part.length; k++) {
      if (part.charCodeAt(k) !== TILDE) { seg += part[k]; continue; }
      const nx = part[k + 1];
      if (nx !== '0' && nx !== '1') {
        return {
          ok: false,
          error: { message: `~ 后面只能是 0 或 1，第 ${offset + k + 1} 列这里是 ${nx === undefined ? '（结尾）' : nx}。`, column: offset + k + 1 },
        };
      }
      seg += nx === '0' ? '~' : '/';
      k += 1;
    }
    segments.push(seg);
    offset += part.length + 1;                     // 吃掉那一个 /
  }
  return { ok: true, segments };
}

/**
 * 父指针 + 子键 = 子指针。父串原样接上，不重解一遍再重编（那会丢已有的转义）。
 * @param {string} parent
 * @param {string|number} keyOrIndex
 * @returns {string}
 */
export function pointerChild(parent, keyOrIndex) {
  return `${parent}/${escPointer(String(keyOrIndex))}`;
}

/**
 * 统计五格：值节点总数、容器最大层数、键总数、数组元素总数、最长字符串的码元数。
 * 显式栈（见文件头那条），键与字符串值一起进"最长字符串"这一格。
 * @param {unknown} value
 * @returns {{nodes: number, depth: number, keys: number, arrayItems: number, longestStringChars: number}}
 */
export function statsOf(value) {
  const stats = { nodes: 0, depth: 0, keys: 0, arrayItems: 0, longestStringChars: 0 };
  const bumpString = (s) => { if (s.length > stats.longestStringChars) stats.longestStringChars = s.length; };
  if (typeof value === 'string') { stats.nodes = 1; bumpString(value); return stats; }
  if (!isContainer(value)) return { ...stats, nodes: 1 };
  const stack = [{ v: value, level: 1 }];
  while (stack.length) {
    const { v, level } = stack.pop();
    stats.nodes += 1;
    if (level > stats.depth) stats.depth = level;
    if (Array.isArray(v)) {
      stats.arrayItems += v.length;
      for (let i = 0; i < v.length; i++) {
        const c = v[i];
        if (isContainer(c)) stack.push({ v: c, level: level + 1 });
        else { stats.nodes += 1; if (typeof c === 'string') bumpString(c); }
      }
    } else {
      const keys = Object.keys(v);
      stats.keys += keys.length;
      for (const k of keys) {
        bumpString(k);
        const c = v[k];
        if (isContainer(c)) stack.push({ v: c, level: level + 1 });
        else { stats.nodes += 1; if (typeof c === 'string') bumpString(c); }
      }
    }
  }
  return stats;
}

/**
 * 唯一解析入口：不抛，坏输入返回 `{ok:false,error}`；入参不是字符串才抛 TypeError。
 * 错误七格 `{kind, message, index, length, line, column, snippet}` 里，`index` 指向出错那一个字符，
 * `unterminated*` 两类指向 EOF 那一格；闸门两档（`too-long` / `too-many-lines`）没有位置可指，
 * 位置给的是 EOF 那一格、`snippet` 给空串——绝不把那一大串回显出去。
 * @param {string} text
 * @returns {{ok: true, value: unknown, depth: number, nodeCount: number, duplicateKeys: Array<{pointer: string, times: number}>, stats: object}
 *   | {ok: false, error: {kind: string, message: string, index: number, length: number, line: number, column: number, snippet: string}}}
 */
export function parseJson(text) {
  if (typeof text !== 'string') throw new TypeError(`parseJson 只收字符串，收到的是 ${text === null ? 'null' : typeof text}`);
  const g = gate(text);
  if (!g.ok) {
    const pos = locate(text, text.length);
    return {
      ok: false,
      error: { kind: g.kind, message: g.message, index: text.length, length: 0, line: pos.line, column: pos.column, snippet: '' },
    };
  }

  const n = text.length;
  const fail = (kind, why, index, length) => {
    const at = Math.max(0, Math.min(index, n));
    const pos = locate(text, at);
    const range = lineRange(text, pos.line);
    return {
      ok: false,
      error: {
        kind, message: `${why}（第 ${pos.line} 行第 ${pos.column} 列）。`, index: at, length,
        line: pos.line, column: pos.column, snippet: text.slice(range.start, range.end),
      },
    };
  };
  const eof = (kind, why) => fail(kind, why, n, 0);
  const here = (index) => {
    const c = text.charCodeAt(index);
    return c >= 0x20 && c !== BOM && c !== BACKSLASH ? `「${text[index]}」` : `U+${c.toString(16).toUpperCase().padStart(4, '0')}`;
  };

  /** 只跳过头部那一个 BOM：其余非空白字符一律由调用侧点名 */
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
    if (k + 1 >= n) return { bad: '结尾的反斜杠后面没有内容', index: k, length: 1 };
    const nx = text[k + 1];
    if (nx === 'u') {
      const hex = text.slice(k + 2, k + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) return { bad: '\\u 后面必须是四位十六进制', index: k, length: 2 };
      return { ch: String.fromCharCode(parseInt(hex, 16)), next: k + 6 };
    }
    const value = ESCAPE_VALUE.get(nx);
    if (value === undefined) return { bad: `反斜杠后面的 ${nx} 不是转义字符`, index: k, length: 2 };
    return { ch: value, next: k + 2 };
  };

  /** `from` 指向开引号；返回 {ok,value,next} 或 {bad:{kind,why,index,length}} */
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
        if (e.bad) return { bad: { kind: 'bad-escape', why: `不是合法的 JSON 转义序列：${e.bad}`, index: e.index, length: e.length } };
        out += e.ch;
        k = e.next;
        cut = k;
        continue;
      }
      if (c === LF || c === CR) {
        return { bad: { kind: 'unterminated-string', why: `字符串没闭合就遇到了换行，前面还有 ${clip(text.slice(from, Math.min(k, from + 44)))}`, index: k, length: 1 } };
      }
      if (c < 32) {
        return { bad: { kind: 'unexpected-char', why: `字符串里有未转义的控制字符 U+${c.toString(16).toUpperCase().padStart(4, '0')}，要写成 \\n、\\t 或 \\uXXXX`, index: k, length: 1 } };
      }
      k += 1;
    }
    return { bad: { kind: 'unterminated-string', why: '字符串没闭合就到了输入结尾', index: n, length: 0 } };
  };

  const readNumber = (from) => {
    let k = from;
    while (k < n && NUMBER_CHARS.has(text.charCodeAt(k))) k += 1;
    const token = text.slice(from, k);
    if (!NUMBER_RE.test(token)) {
      return { bad: { kind: 'bad-number', why: `数字写法不合法：${clip(token)}（本站只认 JSON 的数字：不许前导零、不许裸小数点、不许 NaN 或 Infinity）`, index: from, length: token.length } };
    }
    const v = Number(token);
    if (!Number.isFinite(v)) {
      return { bad: { kind: 'bad-number', why: `数值超出可表示范围：${clip(token)} 会变成 Infinity，本站不产 Infinity`, index: from, length: token.length } };
    }
    return { ok: true, value: v, next: k };
  };

  const LITERALS = new Map([[0x74, 'true'], [0x66, 'false'], [0x6e, 'null']]);
  const readLiteral = (from) => {
    let k = from;
    while (k < n && /[a-z]/.test(text[k])) k += 1;
    const token = text.slice(from, k);
    const want = LITERALS.get(text.charCodeAt(from));
    if (token !== want) {
      return { bad: { kind: 'unexpected-char', why: `${clip(token)} 不是合法的 JSON 值（本站不认 NaN、Infinity、单引号与未加引号的键）`, index: from, length: 1 } };
    }
    return { ok: true, value: want === 'true' ? true : want === 'false' ? false : null, next: k };
  };

  const frames = [];
  const dupOrder = [];
  const dupTimes = new Map();
  let root = undefined, nodes = 0, maxDepth = 0;

  // 每放一个成员就把这一格的 count 加一：`[]` 与 `[1,]` 的分别、`{}` 与 `{"a":1,}` 的分别，
  // 全押在这一格上（收尾分支靠 count===0 认"空容器"，不是靠括号后面紧跟的字符）。
  const place = (v) => {
    nodes += 1;
    if (!frames.length) { root = v; return; }
    const f = frames[frames.length - 1];
    f.count += 1;
    if (f.kind === 'arr') { f.node.push(v); return; }
    if (hasOwn(f.node, f.key)) {
      const p = pointerChild(f.ptr, f.key);
      if (!dupTimes.has(p)) { dupTimes.set(p, 2); dupOrder.push(p); } else dupTimes.set(p, dupTimes.get(p) + 1);
    }
    setOwn(f.node, f.key, v);
  };

  let state = 'value';
  let i = ws(0);
  if (i >= n) return fail('empty', '输入是空的或只有空白字符，没有任何可解析的内容', n, 0);

  for (;;) {
    i = ws(i);
    const top = () => frames[frames.length - 1];

    if (state === 'value') {
      if (i >= n) return eof('unterminated', '这里在等一个值，输入却结束了');
      const c = text.charCodeAt(i);
      if (c === LC || c === LB) {
        if (frames.length + 1 > MAX_DEPTH) {
          return fail('depth', `嵌套深度超出上限：最多 ${MAX_DEPTH} 层，第 ${frames.length + 1} 层的容器出现在这里`, i, 1);
        }
        const parent = frames.length ? top() : null;
        const ptr = parent
          ? (parent.kind === 'arr' ? pointerChild(parent.ptr, parent.node.length) : pointerChild(parent.ptr, parent.key))
          : '';
        frames.push({ kind: c === LC ? 'obj' : 'arr', node: c === LC ? {} : [], key: null, ptr, count: 0 });
        if (frames.length > maxDepth) maxDepth = frames.length;
        i += 1;
        state = c === LC ? 'key' : 'value';
        continue;
      }
      if (c === RB && frames.length && top().kind === 'arr' && top().count === 0) {
        const f = frames.pop(); i += 1; place(f.node); state = 'sep'; continue;
      }
      if (c === QUOTE) {
        const s = readString(i);
        if (s.bad) return fail(s.bad.kind, s.bad.why, s.bad.index, s.bad.length);
        i = s.next; place(s.value); state = 'sep'; continue;
      }
      if (c === MINUS || (c >= ZERO && c <= NINE)) {
        const num = readNumber(i);
        if (num.bad) return fail(num.bad.kind, num.bad.why, num.bad.index, num.bad.length);
        i = num.next; place(num.value); state = 'sep'; continue;
      }
      if (LITERALS.has(c)) {
        const lit = readLiteral(i);
        if (lit.bad) return fail(lit.bad.kind, lit.bad.why, lit.bad.index, lit.bad.length);
        i = lit.next; place(lit.value); state = 'sep'; continue;
      }
      return fail('unexpected-char', `这里该放一个值，来的是 ${here(i)}（本站只认 JSON，不猜 JSON5 与注释）`, i, 1);
    }

    if (state === 'key') {
      if (i >= n) return eof('unterminated', '这里在等一个键名，输入却结束了');
      const f = top();
      if (text.charCodeAt(i) === RC && f.count === 0) { frames.pop(); i += 1; place(f.node); state = 'sep'; continue; }
      if (text.charCodeAt(i) !== QUOTE) {
        return fail('unexpected-char', `这里该放一个用双引号包起来的键名，来的是 ${here(i)}`, i, 1);
      }
      const s = readString(i);
      if (s.bad) return fail(s.bad.kind, s.bad.why, s.bad.index, s.bad.length);
      i = s.next; f.key = s.value; state = 'colon'; continue;
    }

    if (state === 'colon') {
      if (i >= n) return eof('unterminated', '键名读完在等冒号，输入却结束了');
      if (text.charCodeAt(i) !== COLON) {
        return fail('unexpected-char', `键名后面该是冒号，来的是 ${here(i)}`, i, 1);
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
    return fail('unexpected-char', `值读完以后这里该是逗号或收尾的括号，来的是 ${here(i)}`, i, 1);
  }

  const after = ws(i);
  if (after < n) {
    return fail('trailing', `根值已经读完，后面还多出 ${n - after} 个字符，第一个多余的是 ${here(after)}`, after, 1);
  }

  const stats = statsOf(root);
  return {
    ok: true,
    value: root,
    depth: maxDepth,
    nodeCount: nodes,
    duplicateKeys: dupOrder.map((pointer) => ({ pointer, times: dupTimes.get(pointer) })),
    stats: { ...stats, bytes: g.bytes, lines: g.lines },
  };
}

/**
 * 值 → 文本。显式栈迭代（同文件头那一条），`unit` 是缩进单元、空串就是紧凑。
 * 转义走 `escapeText`，数字走 `String()`，两族都与原生同形。
 */
function serialize(value, unit) {
  if (!isContainer(value)) return value === undefined ? 'null' : typeof value === 'string' ? quoteText(value) : String(value);
  // 键名表与长度只在开框时数一次，存在框上：每轮都 `Object.keys(f.v)` 会让一个 n 键的对象读 n 次，
  // 整体退化成 O(n²)（§7 的预算量的是 5 MiB 那一档，这里省的是最坏情况）。
  const fresh = (v, level) => {
    const isArr = Array.isArray(v);
    const keys = isArr ? null : Object.keys(v);
    return { isArr, v, keys, len: isArr ? v.length : keys.length, i: 0, level, first: true };
  };
  const out = [];
  const stack = [];
  const open = (v, level) => {
    stack.push(fresh(v, level));
    out.push(Array.isArray(v) ? '[' : '{');
  };
  const sizeOf = (v) => (Array.isArray(v) ? v.length : Object.keys(v).length);
  open(value, 0);
  while (stack.length) {
    const f = stack[stack.length - 1];
    if (f.i < f.len) {
      const isArr = f.isArr;
      const key = isArr ? null : f.keys[f.i];
      const child = isArr ? f.v[f.i] : f.v[key];
      f.i += 1;
      if (!f.first) out.push(',');
      if (unit) out.push(`\n${unit.repeat(f.level + 1)}`);
      f.first = false;
      if (!isArr) out.push(`${quoteText(key)}:${unit ? ' ' : ''}`);
      if (isContainer(child) && sizeOf(child) > 0) open(child, f.level + 1);
      else if (isContainer(child)) out.push(Array.isArray(child) ? '[]' : '{}');
      else out.push(child === undefined ? 'null' : typeof child === 'string' ? quoteText(child) : String(child));
      continue;
    }
    if (unit && !f.first) out.push(`\n${unit.repeat(f.level)}`);
    out.push(f.isArr ? ']' : '}');
    stack.pop();
  }
  return out.join('');
}

/**
 * 三档枚举只有一把尺。**调用方给的模式不在那一族里就当场 `RangeError`**，消息里点出常量名，
 * 好让人顺着名字找到定义处（静默回退到默认档，是把"参数写错"藏成"输出莫名其妙"）。
 * @param {string} mode
 * @param {readonly string[]} list
 * @param {string} listName 常量名，只出现在消息里
 * @param {string} api 谁在收这个参数
 * @returns {string}
 */
const modeOf = (mode, list, listName, api) => {
  if (!list.includes(mode)) throw new RangeError(`${api} 只认 ${listName} 里的那几档：${list.join(' | ')}`);
  return mode;
};

/**
 * 文本 → 文本：解析、按需排序、按档缩进。坏输入把 `parseJson` 的那一格原样交出去，不吞也不改写。
 * @param {string} text
 * @param {{indent?: 'two'|'four'|'tab', sort?: 'off'|'shallow'|'deep'}} [options]
 * @returns {{ok: true, text: string, bytes: number, error?: undefined} | {ok: false, text: string, bytes: 0, error: object}}
 */
export function formatJson(text, options = {}) {
  const { indent = 'two', sort = 'off' } = options;
  modeOf(indent, INDENT_MODES, 'INDENT_MODES', 'formatJson 的 indent');
  modeOf(sort, SORT_MODES, 'SORT_MODES', 'formatJson 的 sort');
  const parsed = parseJson(text);
  if (!parsed.ok) return { ok: false, text: '', bytes: 0, error: parsed.error };
  const out = serialize(sortJson(parsed.value, sort), INDENTS[indent]);
  return { ok: true, text: out, bytes: utf8Bytes(out) };
}

/**
 * 文本 → 紧凑文本：只删容器之间的空白，字符串内部一个空格都不动。
 * @param {string} text
 * @returns {{ok: true, text: string, bytes: number, error?: undefined} | {ok: false, text: string, bytes: 0, error: object}}
 */
export function minifyJson(text) {
  const parsed = parseJson(text);
  if (!parsed.ok) return { ok: false, text: '', bytes: 0, error: parsed.error };
  const out = serialize(parsed.value, '');
  return { ok: true, text: out, bytes: utf8Bytes(out) };
}

/**
 * 值 → 排好键序的值。**不改入参**：`off` 交回同一个引用，`shallow` 只重建根，
 * `deep` 用显式栈把每一层容器重建（数组只克隆、元素顺序一个不挪）。
 * @param {unknown} value
 * @param {'off'|'shallow'|'deep'} mode
 * @returns {unknown}
 */
export function sortJson(value, mode) {
  modeOf(mode, SORT_MODES, 'SORT_MODES', 'sortJson 的 mode');
  if (mode === 'off' || !isContainer(value)) return value;
  if (mode === 'shallow') {
    if (Array.isArray(value)) return value;
    const out = {};
    for (const k of sortedKeys(value)) setOwn(out, k, value[k]);
    return out;
  }
  const copy = (v) => (Array.isArray(v) ? [] : {});
  const root = copy(value);
  const stack = [{ src: value, dst: root }];
  while (stack.length) {
    const { src, dst } = stack.pop();
    if (Array.isArray(src)) {
      for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (isContainer(c)) { const cc = copy(c); dst[i] = cc; stack.push({ src: c, dst: cc }); } else dst[i] = c;
      }
      continue;
    }
    for (const k of sortedKeys(src)) {
      const c = src[k];
      if (isContainer(c)) { const cc = copy(c); setOwn(dst, k, cc); stack.push({ src: c, dst: cc }); }
      else setOwn(dst, k, c);
    }
  }
  return root;
}
```

#### `scripts/toolkit-tests.mjs` §S（整节，从 `// ── §S` 到文件末尾）

```js
// ── §S JSON 核心（tools/json-core.js，段 4 Task 2）───────────────────────────
// 这一节钉的只有一件事：**位置说得准**。设计文档 §5.3 要"错误处标出精确行列号"，
// 而位置错了和没报错一样有害，所以 S1 那张表逐个断 {kind,index,length,line,column,snippet}
// 六格，不断"有没有抛"（parseJson 全程不抛，坏输入是返回值——只有入参类型不对才抛 TypeError）。
// 位置口径写死在这里，实现不许自创第二套：
//   · line 与 column 都从 1 起；
//   · column 数的是 UTF-16 **码元**，所以一个 emoji 占两列（它本来就是这个长度，
//     `setSelectionRange` 用的也是这个单位，两把尺一致才对得上选区）；
//   · 换行只认 `\n`，于是 CRLF 一行只推进一次、`\r` 留在行内被 lineRange 切掉；
//   · BOM（U+FEFF）不吞，它就是第 1 行第 1 列那一个字符；
//   · EOF 那一格的 index = text.length、length = 0，列号 = 最后一行的长度 + 1。
// 与原生 `JSON.parse` 只要求**结论**同形（同一个输入两边要么都收、要么都拒），
// 不要求错误消息同形——V8 的消息没有列号，且各引擎文案不同（S16 量的是这一条）。
// MAX_INPUT_BYTES 在 §L 那一本 codec.js 里已经占了顶层名（1 MiB 那一档），这里借别名读 JSON 那一档的
// 5 MiB——两个数不同名就会互相盖掉，node --check 当场报"已声明"，不会静默读错闸门（§P 的 RE_INPUT_BYTES 同理）。
const { MAX_INPUT_BYTES: MAX_JSON_BYTES, MAX_INPUT_LINES, MAX_DEPTH, SORT_MODES, INDENT_MODES, CORE_NOTES,
  gate, locate, lineStarts, lineRange, parseJson, formatJson, minifyJson, sortJson,
  toPointer, fromPointer, pointerChild, escapeText, unescapeText, statsOf } =
  await import('../dev/js/tools/json-core.js');

/** 坏样本的返回部分：不是 {ok:true} 就叫人红，免得断言里到处 .error.xxx */
const sErr = (text) => {
  const r = parseJson(text);
  if (r.ok) throw new Error(`样本应当被拒，却解析成功：${JSON.stringify(text)}`);
  return r.error;
};
/** 剥注释扫源码：闸门只许有一处口径，扫的是代码不是文档里的自我声明（与 §K/§L 同一形状） */
const sCode = () => read('dev/js/tools/json-core.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** 确定性伪随机：S10 那一百次往返不能靠 Math.random，红第二次就得能原样重放 */
const sRng = (seed = 20260929) => {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7FFFFFFF; return s / 0x7FFFFFFF; };
};

/**
 * S1 的表：`[编号, 样本, kind, index, length, line, column, snippet, 为什么是这个位置]`。
 * 最后一列不是装饰——每一格的列号都得说得出理由，否则这张表只是在抄实现的输出。
 */
const S_BAD = [
  ['S1a', '', 'empty', 0, 0, 1, 1, '', '空文本没有内容可指，EOF 就是 0 那一格'],
  ['S1b', '   \n ', 'empty', 5, 0, 2, 2, ' ',
    '全是空白也判"没有内容"；index 落在 EOF（5），换行只有那一个 \\n，所以是第 2 行、行内第 2 列'],
  ['S1c', '{', 'unterminated', 1, 0, 1, 2, '{', '对象刚开就没了，EOF 在下标 1'],
  ['S1d', '{"a"', 'unterminated', 4, 0, 1, 5, '{"a"', '键读完等冒号，等到的是 EOF'],
  ['S1e', '{"a":', 'unterminated', 5, 0, 1, 6, '{"a":', '冒号读完等值，等到的是 EOF'],
  ['S1f', '[1,', 'unterminated', 3, 0, 1, 4, '[1,', '逗号读完等下一个元素，等到的是 EOF'],
  ['S1g', '[1,,]', 'unexpected-char', 3, 1, 1, 4, '[1,,]',
    '指认的是第二个逗号（下标 3）：第一个逗号是合法分隔符，"该放元素的位置"来的是它后面那一个'],
  ['S1h', '{,}', 'unexpected-char', 1, 1, 1, 2, '{,}', '空对象里容不下逗号，列 = 下标 + 1'],
  ['S1i', '{"a":1}{"b":2}', 'trailing', 7, 1, 1, 8, '{"a":1}{"b":2}',
    '根值已经收完，第二个 { 是"多出来的内容"，指认它的起始格'],
  ['S1j', "'a':1", 'unexpected-char', 0, 1, 1, 1, "'a':1",
    '单引号不是 JSON 的字符串定界符（本站不认 JSON5 方言，也不猜用户想要哪种）'],
  ['S1k', '{"a":1,}', 'unexpected-char', 7, 1, 1, 8, '{"a":1,}',
    '尾随逗号：逗号之后该来键，来的是 } —— 这一格就是计划里那句"尾随逗号点名拒"'],
  ['S1l', '{"a":"\\x41"}', 'bad-escape', 6, 2, 1, 7, '{"a":"\\x41"}',
    'index 指向反斜杠本身，length=2 是那两格；\\xNN 不是 JSON 的转义序列'],
  ['S1m', '{"a":"\\u12g4"}', 'bad-escape', 6, 2, 1, 7, '{"a":"\\u12g4"}',
    '同样是反斜杠那一格：\\u 后必须四位十六进制，g 把它打断，但错的是这个转义序列不是那个字母'],
  ['S1n', '01', 'bad-number', 0, 2, 1, 1, '01',
    '数字记号一次读完再验语法，所以指认的是整记号（长度 2）而不是第二个 1'],
  ['S1o', '1.', 'bad-number', 0, 2, 1, 1, '1.', '小数点后面必须有数字；记号长度就是 2'],
  ['S1p', '.5', 'unexpected-char', 0, 1, 1, 1, '.5', '. 不能起始一个值，压根进不了数字分支'],
  ['S1q', '+1', 'unexpected-char', 0, 1, 1, 1, '+1', '同理：+ 不是值的起始字符'],
  ['S1r', 'NaN', 'unexpected-char', 0, 1, 1, 1, 'NaN',
    'N 也不能起始一个值——本站不产 NaN/Infinity，parse 阶段就拒'],
  ['S1s', '0.1.2', 'bad-number', 0, 5, 1, 1, '0.1.2',
    '与 S1n 同一口径：贪婪读满 [0-9+.eE-] 那一串再验，所以是整记号而非中间那个点'],
  ['S1t', null, 'depth', MAX_DEPTH, 1, 1, MAX_DEPTH + 1, '['.repeat(MAX_DEPTH + 1),
    '第 1001 个容器（下标 1000）越闸门：列 = 下标 + 1 = 1001，正好等于 MAX_DEPTH + 1'],
];

test('S1 二十个坏样本逐个钉行与列，六格一起断（不是断"抛错"）', () => {
  for (const [id, text, kind, index, length, line, column, snippet, why] of S_BAD) {
    const src = text === null ? '['.repeat(MAX_DEPTH + 1) : text;
    const e = sErr(src);
    assert.equal(e.kind, kind, `${id} 的 kind`);
    assert.equal(e.index, index, `${id} 的 index —— ${why}`);
    assert.equal(e.length, length, `${id} 的 length —— ${why}`);
    assert.equal(e.line, line, `${id} 的 line —— ${why}`);
    assert.equal(e.column, column, `${id} 的 column —— ${why}`);
    assert.equal(e.snippet, snippet, `${id} 的 snippet（出错行原样，供读条与选区用）`);
  }
});

test('S2 坏样本还各带一句人话：message 非空、含行与列两个读数', () => {
  for (const [id, text] of S_BAD) {
    if (id === 'S1t') continue;   // 深度那一档的 message 由 S20 单独核
    const e = sErr(text === null ? '['.repeat(MAX_DEPTH + 1) : text);
    assert.ok(typeof e.message === 'string' && e.message.length > 0, `${id} 的 message 不能是空串`);
    assert.match(e.message, /第\s*\d+\s*行/, `${id} 的 message 要给出行号：${e.message}`);
    assert.match(e.message, /第\s*\d+\s*列/, `${id} 的 message 要给出列号：${e.message}`);
  }
});

test('S3 闸门按 UTF-8 字节数算，不是 .length：一个汉字三字节的那一档', () => {
  const cn = '中'.repeat(MAX_JSON_BYTES / 3 - 2);
  const src = JSON.stringify({ a: cn });
  const g = gate(src);
  assert.equal(typeof g.bytes, 'number');
  assert.ok(g.bytes > src.length, 'UTF-8 字节数必须大于码元数');
  assert.equal(g.bytes, Buffer.byteLength(src, 'utf8'),
    '字节口径必须等于 Node 的 utf8 编码长度（本站不许用 Buffer，但判据拿它当外部尺）');
});

test('S4 正好 5 MiB 放行、多一字节整体拒绝且不回显那一大串', () => {
  const atLimit = 'a'.repeat(MAX_JSON_BYTES);
  assert.equal(gate(atLimit).ok, true, '正好 5 MiB 必须放行（边界不许多算一字节）');
  assert.equal(gate(atLimit).bytes, MAX_JSON_BYTES);
  const over = `${atLimit}a`;
  const g = gate(over);
  assert.equal(g.ok, false);
  assert.equal(g.kind, 'too-long');
  assert.equal(g.limit, MAX_JSON_BYTES);
  assert.match(g.message, /超出/, '闸门的话术要出现"超出"两个字（S4 判据点名的就是它）');
  assert.match(g.message, /5242880/, `闸门要把上限说出来：${g.message}`);
  const e = sErr(over);
  assert.equal(e.kind, 'too-long', 'parseJson 的第一步就是 gate：越界时给的是闸门那一格，不是解析错误');
  assert.ok(!/aaaa/.test(e.message) && !/aaaa/.test(e.snippet),
    '拒绝时不许把那一大串回显进 message 或 snippet（§5.4 那句的反面就是黑箱刷屏）');
  assert.match(e.message, /超出\s*1\s*字节/,
    `message 要给出差额数字，口径是"超出 N 字节"：${e.message}`);
  assert.ok(e.message.includes(String(MAX_JSON_BYTES)),
    `message 要同时给出上限，用户才知道该删多少：${e.message}`);
});

test('S5 正好 20 万行放行、多一行拒；行口径与 lineStarts 同源', () => {
  const atLimit = `${'a\n'.repeat(MAX_INPUT_LINES - 1)}a`;
  assert.equal(lineStarts(atLimit).length - 1, MAX_INPUT_LINES, '行数以 lineStarts 为准：行数 + 1 格');
  assert.equal(gate(atLimit).ok, true, '正好 20 万行必须放行');
  assert.equal(gate(atLimit).lines, MAX_INPUT_LINES);
  const over = `${atLimit}\n`;
  const g = gate(over);
  assert.equal(g.ok, false);
  assert.equal(g.kind, 'too-many-lines');
  assert.equal(g.limit, MAX_INPUT_LINES);
  assert.equal(sErr(over).kind, 'too-many-lines');
});

test('S6 locate：CRLF 只算一次换行，\\r 留在行内不算第二行', () => {
  const t = '{\r\n  "a": ,\r\n}';
  assert.deepEqual(locate(t, t.indexOf(',')), { line: 2, column: 8 },
    'CRLF 是一行，不是两行；列从第 2 行的行首（下标 3）起算，逗号在那一行第 8 列');
  assert.deepEqual(locate(t, t.indexOf('}')), { line: 3, column: 1 });
  assert.deepEqual(locate(t, 0), { line: 1, column: 1 });
  assert.deepEqual(lineStarts(t), [0, 3, 13, 14],
    '\\r\\n 只在 \\n 处断行，所以第 2 行从下标 3 起、第 3 行从 13 起，末格是 length');
  assert.equal(sErr(t).line, 2, '出错的是第二行那个逗号');
  assert.equal(sErr(t).column, 8);
});

test('S7 locate：BOM 不吞，它就是第 1 行第 1 列那一个字符', () => {
  // 样本里的 BOM 一律写成 \uFEFF 转义而不是隐形字符：计划镜像、diff、grep 都看得见它
  const t = '\uFEFF{"a":';
  assert.equal(t.charCodeAt(0), 0xFEFF, '夹具自检：这一格真的带 BOM，否则下面几条断言全在骗人');
  assert.equal(t.length, 6);
  assert.deepEqual(lineStarts(t), [0, 6], 'BOM 不单独成行，也不许被当空白跳掉');
  assert.deepEqual(locate(t, 0), { line: 1, column: 1 }, 'BOM 占第 1 列，后面的列号依次右移');
  assert.deepEqual(locate(t, 1), { line: 1, column: 2 });
  const e = sErr(t);
  assert.equal(e.kind, 'unterminated');
  assert.equal(e.index, 6);
  assert.equal(e.column, 7, '带 BOM 的坏输入，列号把 BOM 也算进去（与原生"跳过 BOM"不同，但选区口径必须一致）');
  assert.equal(e.snippet, t);
  // 容忍与位置是两件事：解析器只跳过头部**那一个** BOM，列号照旧把它算进第 1 列
  const good = '\uFEFF{"a":1}';
  assert.equal(parseJson(good).ok, true, '从 Windows 文件里粘出来的带头 BOM 要收，不能让用户删了才知道能解析');
  assert.throws(() => JSON.parse(good),
    '这是本站与原生的一处**故意**分歧（原生拒 BOM），S16 把它和 1e999 一起记成两条明说的例外');
  assert.equal(parseJson(good).value.a, 1);
  assert.equal(sErr('\uFEFF\uFEFF{"a":1}').kind, 'unexpected-char', '第二个 BOM 不是空白：只容一个');
  const tail = sErr('{"a":1}\uFEFF');
  assert.equal(tail.kind, 'trailing', 'BOM 出现在值之后就不是空白，按多余内容点名');
  assert.deepEqual([tail.index, tail.column], [7, 8]);
});

test('S8 locate：emoji 是代理对，列号按 UTF-16 码元走（与选区同一把尺）', () => {
  const t = '{"a":"\uD83D\uDE00",';
  assert.equal(t.length, 10, '一个 emoji 在这里就是两个码元');
  assert.deepEqual(locate(t, 9), { line: 1, column: 10 },
    '列号必须与 setSelectionRange 的下标口径一致，否则高亮会错一格');
  assert.deepEqual(locate(t, 5), { line: 1, column: 6 }, '高代理那一个码元本身也是一列');
  assert.equal(sErr(t).kind, 'unterminated');
  assert.equal(sErr(t).index, 10);
});

test('S9 lineRange 给出「行内 \\r 之前」的区间，供读条与选区直接用', () => {
  const t = 'a\r\nbb\nccc';
  assert.deepEqual(lineRange(t, 1), { start: 0, end: 1 }, '\\r 不算进行内容');
  assert.deepEqual(lineRange(t, 2), { start: 3, end: 5 });
  assert.deepEqual(lineRange(t, 3), { start: 6, end: 9 });
  assert.deepEqual(lineRange(t, 0), { start: 0, end: 1 }, '行号从 1 起，第 0 档钳在第 1 行而不是越界');
  assert.deepEqual(lineRange(t, 99), { start: 6, end: 9 }, '越界那一档钳到最后一行');
  assert.equal(t.slice(lineRange(t, 2).start, lineRange(t, 2).end), 'bb');
});

test('S10 Pointer：~0/~1 编码与解码互为逆函数，100 次种子往返逐个键原样回来', () => {
  assert.equal(toPointer([]), '', '空段数组就是根，指针是空串而不是 /');
  assert.deepEqual(fromPointer(''), { ok: true, segments: [] }, '根反过来也解成空段，两边对称');
  assert.equal(toPointer(['a', 'b']), '/a/b');
  assert.equal(toPointer(['m~n']), '/m~0n');
  assert.equal(toPointer(['a/b']), '/a~1b');
  assert.equal(toPointer(['a~1b']), '/a~01b', '编码先做 ~→~0 再做 /→~1，反了就歧义');
  assert.deepEqual(fromPointer('/a~01b'), { ok: true, segments: ['a~1b'] },
    '解码先做 ~1→/ 再做 ~0→~：反了会把 a~1b 读成 a/b，那是把用户的数据改坏（~01b 正是这一刀的分界样本）');
  assert.deepEqual(fromPointer('/~0~1'), { ok: true, segments: ['~/'] });
  assert.deepEqual(fromPointer('/'), { ok: true, segments: [''] }, '单个 / 指向「键名是空串」那一格，不是根');
  assert.deepEqual(fromPointer('/0'), { ok: true, segments: ['0'] }, '数组段是十进制下标的**字符串**，怎么用由消费侧定');
  const rnd = sRng();
  const alphabet = ['~', '/', '0', 'a', '', '中', '\u{1F600}', ' ', ':', '"', '\\', '.'];
  for (let i = 0; i < 100; i++) {
    const segs = [];
    const n = 1 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) {
      let s = '';
      const m = 1 + Math.floor(rnd() * 3);
      for (let c = 0; c < m; c++) s += alphabet[Math.floor(rnd() * alphabet.length)];
      segs.push(s);
    }
    const p = toPointer(segs);
    assert.ok(p.startsWith('/'), `非空指针必须以 / 起始：${JSON.stringify(p)}`);
    assert.deepEqual(fromPointer(p), { ok: true, segments: segs }, `第 ${i} 次往返不回来：${JSON.stringify(segs)}`);
  }
});

test('S11 fromPointer 的两类拒：不以 / 起始、~ 后面不是 0 或 1，各自点名那一列', () => {
  for (const [p, column, why] of [
    ['a/b', 1, '整条指针没有以 / 起始，错在下标 0'],
    [' ~x', 1, '开头的空格也算一格：位置要说用户按下去的那一列'],
    ['/~x', 2, '~ 后面跟了 x，指认那个 ~ 本身（下标 1）'],
    ['/a~2', 3, '第二段里的坏转义，~ 在下标 2'],
    ['/a~', 3, '结尾孤零零一个 ~：后面没有字符，仍然指认它'],
  ]) {
    const r = fromPointer(p);
    assert.equal(r.ok, false, `这条指针应当被拒：${JSON.stringify(p)}`);
    assert.deepEqual(Object.keys(r.error).sort(), ['column', 'message'],
      '契约里这一格只有 {message, column} 两栏：指针不是文档，没有行列可言');
    assert.equal(r.error.column, column, why);
    assert.ok(r.error.message.length > 0, `拒的时候要给出人话：${JSON.stringify(p)}`);
  }
});

test('S12 pointerChild 与 toPointer 自洽：父指针 + 子键 == 段数组追加后整条重编', () => {
  assert.equal(pointerChild('', 'a'), '/a', '根的孩子就是 /键');
  assert.equal(pointerChild('/a', 'b'), '/a/b');
  assert.equal(pointerChild('/a~1b', 'c'), '/a~1b/c', '父指针原样接上，不再解一遍再编一次（会丢转义）');
  assert.equal(pointerChild('/list', 3), '/list/3', '数组下标收数字也收字符串');
  assert.equal(pointerChild('/list', '3'), '/list/3');
  assert.equal(pointerChild('/a', 'm~n'), '/a/m~0n');
  assert.equal(pointerChild('/a', ''), '/a/');
  const rnd = sRng(20260930);
  const keys = ['~', '/', '~0', '~1', '', '0', 'a b', '中文', '\u{1F600}', 'x"y'];
  for (let i = 0; i < 60; i++) {
    const segs = [];
    for (let k = 0, n = Math.floor(rnd() * 3); k < n; k++) segs.push(keys[Math.floor(rnd() * keys.length)]);
    const key = keys[Math.floor(rnd() * keys.length)];
    assert.equal(pointerChild(toPointer(segs), key), toPointer([...segs, key]),
      `第 ${i} 次：segs=${JSON.stringify(segs)} key=${JSON.stringify(key)}`);
  }
});

test('S13 sortJson 三档：off 交回同一个引用、shallow 只动根、deep 连数组元素一起动', () => {
  assert.deepEqual(SORT_MODES, ['off', 'shallow', 'deep']);
  const src = { zeta: 1, alpha: 2, mid: { z: 1, a: 2 }, arr: [{ y: 1, x: 2 }] };
  assert.equal(sortJson(src, 'off') === src, true, 'off 连克隆都不做：装配层靠这一格判断"没动过"');
  const shallow = sortJson(src, 'shallow');
  assert.deepEqual(Object.keys(shallow), ['alpha', 'arr', 'mid', 'zeta']);
  assert.deepEqual(Object.keys(shallow.mid), ['z', 'a'], 'shallow 不进第二层');
  assert.deepEqual(Object.keys(shallow.arr[0]), ['y', 'x']);
  const deep = sortJson(src, 'deep');
  assert.deepEqual(Object.keys(deep), ['alpha', 'arr', 'mid', 'zeta']);
  assert.deepEqual(Object.keys(deep.mid), ['a', 'z']);
  assert.deepEqual(Object.keys(deep.arr[0]), ['x', 'y'],
    'deep 进数组元素——§5.3 那一格「按键排序（含嵌套）」就是这一档');
  assert.deepEqual(Object.keys(src), ['zeta', 'alpha', 'mid', 'arr'], '入参的键序一位都没动');
  assert.throws(() => sortJson(src, 'deepish'), /SORT_MODES/, '不在三档里的模式要当场拒绝并点名 SORT_MODES');
});

test('S14 排序口径是 UTF-16 码元序，不是 localeCompare（相邻键谁前谁后钉死）', () => {
  const obj = {};
  for (const k of ['a', 'Z', 'ä', 'B', '_', '0', 'A', '\u{1F600}']) obj[k] = 1;
  assert.deepEqual(Object.keys(sortJson(obj, 'shallow')),
    ['0', 'A', 'B', 'Z', '_', 'a', 'ä', '\u{1F600}'],
    '码元序：数字 < 大写 < 下划线 < 小写 < 变音符 < 代理对；localeCompare 会把 ä 塞到 a 旁边，本站不用它');
  assert.deepEqual(Object.keys(sortJson({ ab: 1, a: 1, abc: 1, 'a-b': 1, 'a.b': 1 }, 'shallow')),
    ['a', 'a-b', 'a.b', 'ab', 'abc'],
    '互为前缀的两个键：短的那一个在前；连字符 45 < 句号 46 < 小写 b 98');
  assert.ok(!sCode().includes('localeCompare'),
    '实现里不许出现 localeCompare：它跟着 ICU 与 locale 走，同一份输入在两台机器上会给出两种"稳定"输出');
});

test('S15 sortJson 不改入参：深比较、逐层键序，以及一份 Object.freeze 的输入', () => {
  const sKeys = (v) => (v && typeof v === 'object'
    ? (Array.isArray(v) ? v.map(sKeys) : Object.keys(v).map((k) => [k, sKeys(v[k])]))
    : null);
  const src = { b: { d: 1, c: [3, { f: 1, e: 2 }] }, a: 1, z: [1, 2] };
  const valueSnap = structuredClone(src);
  const orderSnap = sKeys(src);
  const deep = sortJson(src, 'deep');
  assert.notEqual(deep, src, 'deep 必须交回新对象（off 才交回同一个引用，见 S13）');
  assert.deepEqual(src, valueSnap, '排完以后原对象逐格等于排之前');
  assert.deepEqual(sKeys(src), orderSnap, '原对象每一层的键序都没动');
  assert.deepEqual(sKeys(deep), [['a', null],
    ['b', [['c', [null, [['e', null], ['f', null]]]], ['d', null]]], ['z', [null, null]]],
    'deep 交回的那一份：每一层都排过，数组顺序一个元素都没挪');
  const frozen = Object.freeze({ b: 1, a: Object.freeze([Object.freeze({ d: 1, c: 2 })]) });
  assert.doesNotThrow(() => sortJson(frozen, 'deep'),
    '实现若就地写键，冻结的输入会当场 TypeError——这一条就是「不改入参」的牙');
  assert.deepEqual(Object.keys(sortJson(frozen, 'deep')), ['a', 'b']);
  assert.deepEqual(Object.keys(sortJson(frozen, 'deep').a[0]), ['c', 'd']);
});

test('S16 与原生 JSON.parse 对拍：同结论、同值；两处故意分歧明写在断言里', () => {
  const deep200 = `${'['.repeat(200)}1${']'.repeat(200)}`;
  const GOOD = ['{}', '[]', 'null', 'true', 'false', '0', '-0', '1e3', '1E+3', '0e0', '-1.5',
    '12345678901234567890', '""', '"a"', '"\\u0041"', '"\\""', '"\\\\"', '"\\/"', '"\\b\\f\\n\\r\\t"',
    '"中文"', '"\u{1F600}"', '{"a":[1,{"b":null}]}', '[1,2,3]', '  {"a" : 1 }  ', '[\n 1 ,\n 2\n]',
    '{"":""}', '[[],[[]]]', deep200];
  for (const t of GOOD) {
    const mine = parseJson(t);
    assert.equal(mine.ok, true,
      `本站应当收：${JSON.stringify(t.slice(0, 40))}｜${mine.error ? mine.error.message : ''}`);
    assert.deepStrictEqual(mine.value, JSON.parse(t),
      `值必须与原生逐格相等（含 -0 与 1e3 这类形状）：${JSON.stringify(t.slice(0, 40))}`);
  }
  const BAD = S_BAD.map(([, text]) => (text === null ? '['.repeat(MAX_DEPTH + 1) : text)).concat([
    '"abc', '{"a": }', '[1 2]', '{"a" 1}', 'nul', 'tru', '"\\u00"', '1 2', '{"a":1,,}', '[]]',
    '"a" "b"', '1e', '-', '00', '{"a"::1}', '"\\x"', '"\\u00ZZ"', '[,]', '{"a":,}', 'undefined',
  ]);
  for (const t of BAD) {
    assert.throws(() => JSON.parse(t), `夹具自检：样本在原生那边本来就该拒 ${JSON.stringify(t.slice(0, 24))}`);
    const r = parseJson(t);
    assert.equal(r.ok, false, `本站也必须拒：${JSON.stringify(t.slice(0, 24))}`);
    assert.ok(typeof r.error.kind === 'string' && r.error.kind.length > 0, '拒的时候要给出 kind');
  }
  // 两条明说的分歧，钉在这里而不是散在注释里（其余一律同结论）
  assert.equal(parseJson('\uFEFF{}').ok, true, '分歧一：原生拒 BOM，本站收（从 Windows 文件粘出来的常见形状）');
  assert.throws(() => JSON.parse('\uFEFF{}'), '分歧一的另一半：原生确实拒');
  const inf = parseJson('1e999');
  assert.equal(inf.ok, false, '分歧二：原生把 1e999 收成 Infinity，本站不产 Infinity——下游算不动的形状不给进来');
  assert.equal(inf.error.kind, 'bad-number');
  assert.match(inf.error.message, /超出/);
  assert.ok(Object.is(JSON.parse('1e999'), Infinity), '分歧二的另一半：原生给 Infinity，这条分歧是真的');
});

test('S17 重复键：后写生效，duplicateKeys 用 Pointer 把每一处报出来', () => {
  const t = '{"a":1,"a":2,"a":3,"b":{"c":1,"c":2},"arr":[{"k":1},{"k":9}],"~x":1,"~x":2}';
  const r = parseJson(t);
  assert.equal(r.ok, true, '重复键不是错误，是要报告的形状（原生也收）');
  assert.equal(r.value.a, 3, '后写覆盖：与原生同结论');
  assert.equal(r.value.b.c, 2);
  assert.deepEqual(r.value.arr, [{ k: 1 }, { k: 9 }], '两个不同对象里的同名键不算重复');
  assert.deepEqual(r.duplicateKeys, [
    { pointer: '/a', times: 3 },
    { pointer: '/b/c', times: 2 },
    { pointer: '/~0x', times: 2 },
  ], '顺序按首次出现，pointer 走 RFC 6901 转义');
  assert.deepEqual(parseJson('{"a":1}').duplicateKeys, [], '没有重复时给空数组，不给 undefined');
  assert.match(CORE_NOTES.dupKey, /重复键/, '面板那句要出现「重复键」这三个字（§5.4 给依据不给黑箱）');
});

test('S18 formatJson：三种缩进逐字钉死，与 sort 组合、控制字符再转义、bytes 与 length 分家', () => {
  assert.deepEqual(INDENT_MODES, ['two', 'four', 'tab']);
  const v = { a: [{ b: 1 }, 2], c: '中文', d: null, e: [], f: {} };
  const src = JSON.stringify(v);
  assert.equal(formatJson(src, { indent: 'two' }).text, JSON.stringify(v, null, 2), 'two 档与原生逐字同形');
  assert.equal(formatJson(src, { indent: 'four' }).text, JSON.stringify(v, null, 4), 'four 档同上');
  assert.equal(formatJson(src, { indent: 'tab' }).text, JSON.stringify(v, null, '\t'), 'tab 档同上');
  assert.equal(formatJson('{"b":1,"a":2}', { indent: 'two', sort: 'deep' }).text, '{\n  "a": 2,\n  "b": 1\n}');
  assert.equal(formatJson('{"a":[{"y":1,"x":2}]}', { indent: 'two', sort: 'deep' }).text,
    '{\n  "a": [\n    {\n      "x": 2,\n      "y": 1\n    }\n  ]\n}', 'sort 进得去数组元素里那一层');
  assert.equal(formatJson('[]').text, '[]', '空数组不换行');
  assert.equal(formatJson('{}').text, '{}');
  assert.equal(formatJson('null').text, 'null', '标量根原样');
  assert.equal(formatJson('"a"').text, '"a"');
  assert.equal(formatJson('{"a":"\\u0000"}').text, '{\n  "a": "\\u0000"\n}',
    '输入是六个字符的 \\u0000 转义，输出还得是六个字符的转义：不许把裸 U+0000 写回产物');
  const cn = formatJson('{"a":"中文"}');
  assert.equal(cn.text, '{\n  "a": "中文"\n}');
  assert.equal(cn.text.length, 15, '码元数：那一个汉字在这里是 1 个码元');
  assert.equal(cn.bytes, 19, '字节数是 19 不是 15——一个汉字三字节');
  assert.equal(cn.bytes, Buffer.byteLength(cn.text, 'utf8'),
    'bytes 那把尺就是 UTF-8（判据拿 Node 当外部尺，模块内不许用 Buffer，见 S20）');
  const bad = formatJson('{"a":');
  assert.equal(bad.ok, false);
  assert.equal(bad.error.kind, 'unterminated', 'formatJson 的坏输入要把 parseJson 那一格原样交出去，不许吞');
  assert.deepEqual([bad.error.line, bad.error.column], [1, 6]);
  const deep1000 = `${'['.repeat(MAX_DEPTH)}1${']'.repeat(MAX_DEPTH)}`;
  const f = formatJson(deep1000, { indent: 'two' });
  assert.equal(f.ok, true, '1000 层要格式化得动：递归实现在这里会先炸自己的调用栈（§S Step 2 那句硬规定）');
  assert.equal(minifyJson(f.text).text, deep1000, '格式化→压缩一圈回来必须逐字节等于最初那一串');
});

test('S19 minifyJson：只删容器之间的空白，字符串内部一个空格都不动', () => {
  const f = minifyJson('{ "a" : [ 1 , 2 ] , "b" : "  x  " }');
  assert.equal(f.ok, true);
  assert.equal(f.text, '{"a":[1,2],"b":"  x  "}', '"  x  " 里那四个空格是数据，不是缩进');
  assert.equal(f.text.length, 23);
  assert.equal(f.bytes, 23);
  assert.equal(minifyJson('["a\\nb"," a "]').text, '["a\\nb"," a "]', '转义序列与串内空格都原样');
  assert.equal(minifyJson('[\n  1,\r\n  2\n]').text, '[1,2]', 'CRLF 与行首缩进一起删掉');
  assert.equal(minifyJson('{"a": [ 1 , 2 ] }').text, '{"a":[1,2]}');
  const src = '{"b":[1,{"c":"  两格  "}],"d":{"e":[[[]]]}}';
  assert.deepStrictEqual(parseJson(minifyJson(src).text).value, parseJson(src).value,
    '压缩一圈以后值树逐格相等（deepStrictEqual：1 与 "1" 在这里不许混）');
  const bad = minifyJson('{');
  assert.equal(bad.ok, false);
  assert.equal(bad.error.kind, 'unterminated');
  const deep = `${'['.repeat(200)}1${']'.repeat(200)}`;
  assert.equal(minifyJson(deep).text, deep, '本来就紧凑的深样本，压缩以后一个字都不该变');
});

test('S20 收尾三件：转义往返与点名、八类 kind 全覆盖、纯函数红线与 stats 一致', () => {
  assert.equal(escapeText('a"b'), 'a\\"b');
  assert.equal(escapeText('\\'), '\\\\');
  assert.equal(escapeText('\n\t'), '\\n\\t', '短转义用 \\n 与 \\t，与原生一致');
  assert.equal(escapeText('\u0000'), '\\u0000', '其余控制字符走六个字符的 \\uXXXX');
  assert.equal(escapeText('\u0008'), '\\b', '退格有短转义，不许写成 \\u0008');
  assert.equal(escapeText('中文\u{1F600}'), '中文\u{1F600}', '非 ASCII 不转义：与原生一致，字节账由调用方管');
  assert.equal(escapeText('\ud800'), '\\ud800', '落单的高代理项要转义出去：裸的半个 emoji 交出去就不再是合法 JSON（与原生 well-formed JSON.stringify 同形）');
  assert.equal(escapeText('\udfff'), '\\udfff', '落单的低代理项同理，不分高低');
  assert.equal(escapeText('\ud83d\ude00'), '\ud83d\ude00', '成对的代理项原样走：那是一个 emoji，不是两个坏字符');
  assert.deepEqual([unescapeText('\\ud800').ok, unescapeText('\\ud800').text], [true, '\ud800'], '反向认 \\ud800：解回那落单的半个，往返不丢格');
  assert.equal(unescapeText('a\\u0041b').text, 'aAb', '输入是 a + 转义A + b，回来三格：aAb（转义只吃反斜杠那一段）');
  assert.equal(unescapeText('\\/').text, '/', '\\/ 是合法的，要解成 /');
  assert.equal(unescapeText('\\b\\f\\n\\r\\t').text, '\b\f\n\r\t');
  for (const [frag, index, length] of [
    ['a\\x41b', 1, 2], ['a\\\'b', 1, 2], ['a\\qb', 1, 2], ['a\\u12g4', 1, 2], ['a\\u00', 1, 2], ['a\\', 1, 1],
  ]) {
    const r = unescapeText(frag);
    assert.equal(r.ok, false, `这一串不是合法的 JSON 字符串内容：${JSON.stringify(frag)}`);
    assert.equal(r.error.kind, 'bad-escape');
    assert.deepEqual([r.error.index, r.error.length], [index, length],
      `反斜杠那一格要指准：${JSON.stringify(frag)}`);
  }
  const rnd = sRng(20261001);
  const pool = ['"', '\\', '\n', '\t', '\u0000', '\u007f', '中', '\u{1F600}', 'a', ' ', ':', '/', '~', 'é'];
  for (let i = 0; i < 100; i++) {
    let s = '';
    for (let k = 0, n = 1 + Math.floor(rnd() * 8); k < n; k++) s += pool[Math.floor(rnd() * pool.length)];
    const back = unescapeText(escapeText(s));
    assert.equal(back.ok, true, `自己编出来的转义自己必须能解回来：${JSON.stringify(escapeText(s))}`);
    assert.equal(back.text, s, `第 ${i} 次往返：${JSON.stringify(s)}`);
  }

  const r = parseJson('{"a":[1,2],"b":{"c":"中文"}}');
  assert.equal(r.depth, 2, 'depth 数容器层数：根第 1 层，里面的数组与内层对象都在第 2 层');
  assert.equal(r.nodeCount, r.stats.nodes, 'nodeCount 与 stats.nodes 必须是同一个数（装配层只读 stats 那一格）');
  assert.equal(r.stats.nodes, 6, '六个值：根对象、数组、1、2、内层对象、那串中文');
  assert.equal(r.stats.depth, 2);
  assert.equal(r.stats.keys, 3, '键总数：a、b、c');
  assert.equal(r.stats.arrayItems, 2);
  assert.equal(r.stats.longestStringChars, 2, '最长的串是那串中文（键也一起量，它们只有 1 个码元）');
  assert.equal(r.stats.bytes, Buffer.byteLength('{"a":[1,2],"b":{"c":"中文"}}', 'utf8'));
  assert.equal(r.stats.lines, 1);
  assert.deepStrictEqual(statsOf(JSON.parse('1')), { nodes: 1, depth: 0, keys: 0, arrayItems: 0, longestStringChars: 0 },
    '标量根：depth 是 0，一个容器都没有');
  assert.deepStrictEqual(statsOf(JSON.parse('{}')), { nodes: 1, depth: 1, keys: 0, arrayItems: 0, longestStringChars: 0 });
  const deep200 = parseJson(`${'['.repeat(200)}1${']'.repeat(200)}`);
  assert.equal(deep200.ok, true, '§7 那一档深样本是 200 层，必须放行');
  assert.deepEqual([deep200.depth, deep200.stats.nodes, deep200.stats.arrayItems, deep200.stats.lines],
    [200, 201, 200, 1]);
  assert.equal(parseJson(`${'['.repeat(MAX_DEPTH)}1${']'.repeat(MAX_DEPTH)}`).ok, true, '正好 1000 层放行');

  const kindOf = (t) => sErr(t).kind;
  assert.deepEqual([kindOf(''), kindOf('{,}'), kindOf('"\\x"'), kindOf('01'), kindOf('"abc'),
    kindOf('{'), kindOf('1 2'), kindOf('['.repeat(MAX_DEPTH + 1))],
    ['empty', 'unexpected-char', 'bad-escape', 'bad-number', 'unterminated-string',
      'unterminated', 'trailing', 'depth'],
    '契约列出的十类 kind 里，除闸门那两档（S4/S5 各钉一刀）以外，这里八档必须全出一次场');

  assert.deepEqual([MAX_JSON_BYTES, MAX_INPUT_LINES, MAX_DEPTH], [5242880, 200000, 1000],
    '三格常量就是 §7 预算表里的那三个数，改一个就要同时改判据');

  const code = sCode();
  for (const banned of ['Buffer.', 'TextEncoder', 'process.', 'localStorage', 'document.', 'window.',
    'JSON.parse', 'JSON.stringify', 'fetch(', 'require(']) {
    assert.ok(!code.includes(banned), `json-core 不许出现 ${banned}：纯计算、不读环境、位置与转义都不外包给原生`);
  }
  assert.ok(!/^\s*import\s/m.test(code), 'json-core 一本都不 import：它是这一族的底座，不许有依赖边');
  assert.match(code, /function parseJson\([\s\S]{0,400}?=\s*gate\(/,
    'parseJson 的第一步必须是 gate：全仓库只有一处字节与行数的口径');
});
```
---

## Task 3: `json-ts.js` — TypeScript interface 生成（§T）

**Files:** Create `dev/js/tools/json-ts.js`；Modify `scripts/toolkit-tests.mjs`（§T）、`FILE_TARGETS`。

```text
export const TS_HEADER_NOTE = '…'          // 输出块顶部那一句"这是按样本推断的，不是 schema"
export function toInterfaceName(raw) → { name, renamed, reason }   // 非标识符/空串/超长都走 renamed
export function generateTs(value, { root = 'Root', indent = 'two' }) → { text, names, notes }
```

规则表（每条都是一个 `assert.match` 或对 `text` 的逐字相等，实现期不许换写法）：对象 → `interface`；
**数组元素里的对象**提成具名接口 `父名 + PascalCase(键名)`（同名冲突追加 `2`、`3`…），其余对象内联；
同构数组 → `T[]`，异构 → `(A | B)[]` 且并集按类型名升序（稳定输出，两个等价输入必须给同一串）；
`null` 单独成 `null`、与别的并 → `A | null`；数组里既有对象又有标量 → `XItem | string`；
键名合法（`[A-Za-z_$][A-Za-z0-9_$]*` 且非 TS 关键字也不加引号——属性位置允许保留字）直写，
否则加双引号；数字开头键 → `"1st"`；空数组 → `unknown[]`；空对象 → `{}`；
缺键并集 → `k?: T`；`notes` 里给"并集/可选键/索引签名"三句该说的一句话。

- [ ] Step 1 §T 十条红 → Step 2 绿 → Step 3 镜像 + 门禁 + 提交
  （`feat(tools): 段 4 Task 3 json-ts——六类样本的 interface 生成，并集与可选键口径钉死（§T）`）。

---

## Task 4: `json-convert.js` — YAML / XML / CSV 三对互转（§U）

**Files:** 把 Task 1 的桩写成实文件；Modify `scripts/toolkit-tests.mjs`（§U 续）、`FILE_TARGETS`
（登记 `dev/js/tools/json-convert.js`）。

```text
export const YAML_LIB = 'js-yaml 5.4.2 (MIT) · dev/libJs/js-yaml.esm.min.mjs'   // 面板与判据共读这一串
export const YAML_NOTES = { ambiguous: '…', date: '…' }
export function jsonToYaml(value) → { ok, text }
export function yamlToJson(text) → { ok, value, error? }   // error = { kind, message, line, column, index }
export const XML_CONVENTION = '…'                          // §0.6 那一族规则的**一句**人话说明
export function jsonToXml(value, { root = 'json' }) → { ok, text, error? }
export function xmlToJson(text) → { ok, value, error? }
export const CSV_NOTES = { fidelity: '…' }
export function jsonToCsv(value, { delimiter = ',' }) → { ok, text, error? }
export function csvToJson(text, { delimiter = ',' }) → { ok, value, meta, error? }
export function roundTrips(value) → { yaml: bool, xml: bool, csv: bool }   // 给面板那三个"✓ 等价"读数用
```

三对各自的硬规定（都写成判据，别留在注释里）：YAML 侧 `Date` → ISO 8601 串、`!!binary` → base64 串、
function/undefined → 拒；歧义值（`yes`/`no`/`on`/`off`/`null`/`~`/`2024-01-01`/`0755`/`1e5`/`.inf`）
在 JSON→YAML→JSON 方向必须原样回来（写侧带引号）。XML 侧：非法键名 → 整体拒绝并**列出**全部非法键；
`DOCTYPE` / 外部实体 / `<!ENTITY` → 拒（一句"本站不读文档类型声明"）；
写→读深相等覆盖 20 例（含 `]]>`、CRLF 内嵌、代理对、`&`）。CSV 侧：输入形状只收"对象数组"与
"对象"两档，其余拒并说明要求；表头取首行键序 + 后续新键追加；重复表头列 → `列名__2`；
空表头列 → `col_<1 起的序号>`；引号 / 内嵌换行 / CRLF / BOM / 尾行无换行五族各有断言；
回读一律字符串（`meta.allStrings === true` 这一类可断言的形状）。

- [ ] Step 1 §U 续 13 条红 → Step 2 绿 → Step 3 镜像 + 门禁 + 提交
  （`feat(tools): 段 4 Task 4 json-convert——YAML 走内置件、XML 立无损子集、CSV 补 RFC 4180（§U）`）。

---

## Task 5: `json-tree.js` — 拍平 / 搜索 / 只渲染可视节点（§V）

**Files:** Create `dev/js/tools/json-tree.js`；Modify `scripts/toolkit-tests.mjs`（§V）、`FILE_TARGETS`。

```text
export const ROW_KEYS_LIMIT = 2000;       // 单节点一次列出的键数上限，超出显示「还有 N 个键未列出」
export const RENDER_WINDOW = 80;          // 一次进 DOM 的行数上限（可视 + 上下缓冲）
export const DEFAULT_EXPAND_DEPTH = 2;    // 首屏只展开到第 2 层
export const ROW_KINDS = ['object','array','string','number','boolean','null'];

/** row = { id, pointer, parent, depth, keyLabel, kind, display, childCount, expanded,
 *          hiddenCount, truncatedFrom, matched }
 *  id 的口径（§V 有一条判据钉，别在实现期"顺手改成下标"）：正常行 `id === pointer`；
 *  被 ROW_KEYS_LIMIT 截断而产生的"还有 N 个键未列出"那一行，id = `<父 pointer>~more`，
 *  它的 pointer 留空串（那一行点不出 Pointer，也不许被复制成一条合法 Pointer）。
 *  ——用下标当 id 的话，折叠态在数据刷新后会漂到别的行上，而这是"只渲染可视"那族判据抓不到的。 */
export function flatten(value, { expanded, maxKeys } = {}) → rows[]
export function expandOf(rows, id, on) → Set        // 返回**新** Set（不改入参）
export function searchRows(rows, query, { scope = 'both' } = {}) → { matchedIds, total, truncated }
export function createTreeController({
  document, container, rowHeight, windowSize, onViewChange,   // 全部注入，模块自身零环境读取
}) → { setData(rows), setExpanded(set), refresh(), destroy(), scrollToPointer(ptr), state(), visibleRange() }
```

虚拟渲染的**契约形状**（实现期可换 DOM 写法，但这四条必须可断言，§V 各一条）：
① 容器里只有三块常驻节点：上垫块、行容器、下垫块；② 垫块高度 = 行数 × `rowHeight`，
所以滚动条总长与真实行数成正比（这是"只渲染可视"的唯一外部证据）；③ 任意 `scrollTop` 下
`container` 里的行数 ≤ `windowSize`（5,000 行数据实测上界）；④ `setData` 之后焦点与
`scrollToPointer` 的锚点保持在同一行号，折叠→展开不漂。搜索与折叠共用 `flatten` 这一个真值源，
所以"匹配到的行一定在当前可见行集里或已被提示未显示"这一条是纯函数级的，不靠 DOM。

- [ ] Step 1 §V 16 条红 → Step 2 绿（假 DOM 夹具形状照 §I）→ Step 3 镜像 + 门禁 + 提交
  （`feat(tools): 段 4 Task 5 json-tree——拍平纯函数 + 只渲染可视行的控制器（§V）`）。

---

## Task 6: `jsonView.js` + `jsonWorkbench.js` + `toolJson.js`（§W）

**Files:** Create 三本；Modify `scripts/toolkit-tests.mjs`（§W）、`FILE_TARGETS`（三本）、
`scripts/toolkit-tests.mjs` 的 §W 里加"import 边闭合"判据。

```text
// jsonView.js —— 纯字符串，零 import（与 view.js / codecView.js 同一条红线，§W 用源码扫钉住）
export const JT_TONES = ['ok','warn','bad','idle']
export const JSON_VIEW_LABELS = { text:'文本', tree:'树' }
export const OUT_KINDS = ['json','ts','yaml','xml','csv']   // kind 白名单：写错一个词渲染时抛
export function createJsonView(view) → { esc, errBlock, statsLine, resultHead, treeRow, treePad,
                                         noteLines, emptyHint, tone }
   // 九件都是纯串生成器：errBlock 给「行列 + 上下文三行读条」，treeRow 给一行树（缩进、
   // 折叠三角、key、值、Pointer 复制按钮的 markup），treePad 给上下垫块的高度串，
   // tone 把 §W 那四档语义映射成 class。形参与 codecView.js:124 的 createCodecView(view) 同形：收 Tk.view

// jsonWorkbench.js —— 装配层：只做「读控件 → 闸门 → 调纯模块 → 拼 DOM → 写回」
export const JSON_PANEL_IDS = ['workbench']            // 与 yml 的 spec.ids 同名（门禁 :463 比 keys）
export const JSON_SPEC = {
  workbench: { sides: { main: { kind: 'workbench', controls: [
    { id: 'doc',      type: 'area' },      // → #jt-in-workbench-doc（输入 textarea）
    { id: 'view',     type: 'select' },    // → #jt-in-workbench-view（文本 / 树）
    { id: 'query',    type: 'text' },      // → #jt-in-workbench-query（树搜索）
    { id: 'indent',   type: 'select' },    // → #jt-in-workbench-indent（两 / 四 / tab）
    { id: 'sort',     type: 'select' },    // → #jt-in-workbench-sort（off / shallow / deep）
    { id: 'memorize', type: 'checkbox' },  // → #jt-in-workbench-memorize
  ], switch: { by: 'view', targets: [{ key: 'tree', when: ['tree'] }] } } } }
                                          // → 产物必须有 #jt-when-workbench-tree（搜索那一组的显隐段）
                                          // type 白名单是**本页自己的**口径（含 checkbox），门禁不读它；
                                          // 显隐段用 <p data-jt-when> 而不是藏掉一格控件——同编码页 whenId 那条理由
export function fieldId(prefix, panel, control) / whenId(prefix, panel, key)
                                          // **本模块自己的一份**，与 codecWorkbench.js:117-162 同形同语义。
                                          // 不许 import 那一本：两个入口 import 同一模块 → Rollup 提共享 chunk
                                          // → iife-wrap 后产物里是 `import{…}` → 整页 SyntaxError 而构建 exit=0
                                          // （toolkitCore.js:5-9 记的正是这个坑，牙齿在门禁④）。重复面登记进收口账。
export function createJsonWorkbench(env = {}) → { renderers, actions, state, mount }
  env = { document, Tk, runGuarded, storage, now, later,
          navigator, createObjectURL, revokeObjectURL, BlobCtor }
  // 形参形状照 createCodecWorkbench(env)（:306），构造期闸门同形：缺 document 的
  // getElementById/createElement、缺 Tk.view、缺 Tk.ui.copyInto、runGuarded 不是函数
  // → 各抛一句中文 TypeError；storage / now / 那三只下载用的件**允许缺席**，
  // 但给了就必须是能用形状（非函数的 now 会让"上次保存于"那一行静默消失）。

// toolJson.js —— 页面入口，全段唯一允许读环境的一本
const CONTAINER_ID = 'jt-workspace'; const NOTICE_ID = 'jt-notice';
const ATTR = { ids: 'data-jt-ids', prefix: 'data-jt-prefix', label: 'data-jt-label', notice: 'data-jt-notice' };
                                          // 这三格不是风格：门禁⑤ 组 5 用**正则**在入口源码里找
                                          // `const CONTAINER_ID = 'jt-workspace'` 与那四条 `ATTR.*`
                                          // （check-tools-surface.mjs:522-537），并要求容器节点上
                                          // 四条 data-jt-* 齐全（:538-545）。少一格 = 门禁红。
```

装配层红线（三条，§W 各一判）：**不读环境**（`Date.now` / `localStorage` / `navigator` / `Blob` /
`URL` 五个词在 `jsonWorkbench.js` 源码里 0 命中，全部从入口注入——与段 3 R3 同一条形状）；
`json-convert.js` 是内置件的唯一 import 点；入口 `toolJson.js` 是**工具侧三本入口**里唯一读
`localStorage` 的一本（实读：`grep -rn "localStorage" dev/js/toolIdcard.js dev/js/toolCodec.js`
= 0 命中；站内另外两本读它的是 `dev/js/cat.js` 与 `dev/js/editorial.js`，那是站级件，不算工具入口）。
控件与显隐开关只在 `JSON_SPEC` 一处声明（门禁⑤ DOM 组比的就是这张表的 `controls` 与 `switch.targets`）；
按钮与输出区的 id 由同表那个 panel id 派生（`btnId` / `copyId` / `outId` 三枚 helper 与编码页同形），
页面源与装配层都不许再各写一遍 id 串。

`remember`（记住上次输入）的落地口径，写死三句：默认 `off`；**开关状态本身**总是存
（`jt.memory.on`，否则这功能等于没有），**输入正文只在开关为 on 时存**（`jt.memory.input`），
超过 256 KiB 不存并在开关旁说明"太长没存"；页面文案明写"只存在本机这个浏览器，清站点数据即消失"。
§W 判据：假 storage 上 `setItem` 在关着的这一次恰好 **0** 次、开着时 1 次、超长时 0 次且读数里有那句说明。

"粘贴不自动解析"：`input` 事件只更新计数与闸门读数，**解析只在按动作时发生**——
判据数的是 `parseJson` 的调用次数（注入假模块或计包装），20 次 `input` → 0 次解析。

- [ ] Step 1 §W 18 条红 → Step 2 绿 → Step 3 三本镜像 + `--fix` + 门禁 + 提交
  （`feat(tools): 段 4 Task 6 JSON 工作台视图层与装配层——环境只在入口、粘贴不自动解析（§W）`）。

---

## Task 7: 页面源 + 样式 + 收录面 + 门禁 layout 分支

**Files:** Create `tools-json.html`、`dev/sass/toolJson.scss`、`assets/img/tools/json-tool.svg`；
Modify `_data/onlineTools.yml`（追加条目，`layout: workbench`、`panels: []`、`prefix: jt`、
`spec: {module: dev/js/tools/jsonWorkbench.js, table: JSON_SPEC, ids: JSON_PANEL_IDS}`）、
`tools.html`（那一格徽章）、`scripts/check-tools-surface.mjs` + 它的 teeth、
`scripts/verify-plan-blocks.mjs`（登记三本新文件）、`USAGE.md`（两个计数）。

页面源的形状照 `tools-codec.html`：front matter 写死 `permalink: /tools/json.html`、
`tool: json`，`{% include header.html %}` → `<link>` 两本 CSS（`toolkit.min.css` 与
`toolJson.min.css`，**位置照编码页 :21 那一条**——它在 header include 之后，不在 `<head>`，
§7 首屏那一格判的是"本页新加进阻塞集的东西"，搬进 `<head>` 就是当场给两页首屏各添一件阻塞件）→
`.g-masthead.jt-masthead`（统计那一族不许照抄编码页的 `{{ tk.panels.size }}`，见 §0.7 第 3 条）→
`<main class="g-container tk-content" id="main">` → `.tk-compliance` 那一句（本页口径：
输入只在本地解析，不发请求、不上传；默认不写 localStorage，开了"记住上次输入"才写本机）→
`<noscript>` 那一句 → `.tk-notice`（`id="{{ tk.prefix }}-notice"`）→ 工作台容器（照编码页 :73-78
那一格，四条属性名的 `jt` 字面量是 yml 头注释 `:19-23` 明确允许的三处出现点之一，值一律从数据源取）：

```text
<div class="jt-workspace" id="{{ tk.prefix }}-workspace"
     data-jt-ids="workbench" data-jt-prefix="{{ tk.prefix }}"
     data-jt-label="{{ tk.h1 }}" data-jt-notice="{{ tk.prefix }}-notice">
```

`data-jt-ids` 是这一页**唯一**写不死在 `tk.panels` 上的一格（面板清单按设计就是空的），所以它是
字面量 `workbench`，而门禁⑤ `:546-548` 拿它比 `JSON_PANEL_IDS.join(',')`——两处必须一样、
不一致红在门禁，这条设计没变。容器四条 `data-jt-*` 一条都不能少（`:538-545` 逐条比）→ 骨架正文：
输入侧 `<textarea id="{{ tk.prefix }}-in-workbench-doc">` + 行号槽 + 状态读数；输出侧视图切换
`-in-workbench-view`、只读 `<pre id="{{ tk.prefix }}-out-workbench-main">`、树容器、搜索组
`<p id="{{ tk.prefix }}-when-workbench-tree" data-jt-when="tree">` 包着 `-in-workbench-query`；
工具栏三段：动作按钮（`-btn-workbench-<side>` 那一族）/ 选项（`-indent` / `-sort`）/ 转换目标。
**元素 id 一律 `{{ tk.prefix }}` 拼出、不手打 `jt`**，控件名与显隐 key 全部来自 `JSON_SPEC`
（换前缀自证那条判据在 §W：把 yml 的 `prefix` 改成别的值，整页 id 与 `data-*` 跟着换，
门禁⑤ 仍绿——这一条段 3 R16 已立过形状）。末尾两条 `<script>`（`toolkitCore.min.js` 先、
`toolJson.min.js` 后，都不 defer、不加 module）→ `{%- else -%}` 兜底格。

**`toolkit.scss` 一个字节都不加**（§0.5）；`.jt-*` 全部进 `toolJson.scss`，颜色一律取 `tokens.scss`
语义变量、不写颜色字面量；`--ink-4` 不用于 <18px 正文性文字（§6.4）。行号槽与树行高用一个
`--jt-row-h` 常量供 §V 的 `rowHeight` 用，**但读它的是入口不是装配层**：`toolJson.js` 调一次
`getComputedStyle` 取 `--jt-row-h`，读不到或读出来不合法就退回 24，再作为 `env.rowHeight` 注入
`createJsonWorkbench`。理由与 §W 那条"不读环境"是同一条——装配层里出现 `getComputedStyle`，
假 DOM 夹具就要多造一件假件，而这一族判据的形状在段 3 已经定过：环境只在入口。

**必须实测中间断点**：901–1100px 那一族（§6.4 点名，段 2 已立十档清单）。
≤900 时工作台从左右分栏改成上下堆叠 + 视图切换。

- [ ] **Step 1: 门禁 layout 分支（§0.3）先写红**：`layout` 取值档 / workbench 支**不**要求
  `{p}-tablist` / 控件与开关那一族在 workbench 支按 `spec.ids` 遍历（`panels: []` 时不许空转）/
  `:460` 与 `:548` 那两句在本支跳过 yml 比对 / 产物里多出的 `{p}-in-*`、`{p}-when-*` 不在表里 → 红 /
  缺 `layout` 且 `panels` 空 → 红在"既没声明又没有清单"。
- [ ] Step 2: 三本 teeth 变异（T-a/T-b/T-c）点燃并还原。
- [ ] Step 3: yml 条目 + `tools.html` 那一行 + 图标 + 页面源 + SCSS 落地。
- [ ] **Step 4: 一次 `pnpm build:assets` + `bundle exec jekyll build --destination /tmp/segX/_site
  --baseurl ""`（记忆：不加 `--baseurl ""` 会全 404 量到裸页），跑门禁⑤ 期望 `3 条 ready × 5 组全绿`。
  门禁⑤ 不覆盖的 §8.2 那六条要在同一格逐条复算**（本段实测：`check-tools-surface.mjs` 里
  `CollectionPage` 与 `vw` 都无命中，那六条没有脚本兜着，靠命令钉）——
  三页 HTML 都在；`json.html` 的 `canonical` 指 `/tools/json.html` 且它的 `CollectionPage` JSON-LD
  用 `node -e 'JSON.parse(…)'` 解得动；`sitemap.xml` / `llms.txt` / `index-all.html` 各含三条完整地址；
  三页 `.is-current` 各恰一个且落「工具箱」（并抽查首页/分类/标签/示例/编辑器/关于/tools.html 的高亮态
  与改前逐字节一致）；`grep -c 'vw' /tmp/segX/_site/assets/css/toolkit.min.css` 与
  `…/toolJson.min.css` **都是 0**（§6.4 那条黑名单的牙）；页面引用的每个
  `assets/js|css/*.min.*` 在快照里真实存在（§6.1 大小写坑）；`docs/` 不进 `_site`、全站无 404 内链。
  最后跑 `USAGE.md`「检索层自查」那族**全量**（记忆教训：不只对本次改动跑），并把 §4.4 第 6 条
  那两个计数更新后确认仍绿。
- [ ] Step 5: 镜像登记 + **HEAD 导出树里**给 yml 条目做一次 `--fix`（§0.7 第 1 条那套动作）。
- [ ] Step 6: 提交——**只提交本段独占的那些**：`tools-json.html`、`dev/sass/toolJson.scss`、
  `assets/img/tools/json-tool.svg`、两本 `scripts/check-tools-*`、`scripts/verify-plan-blocks.mjs`、
  本计划、段 2 计划（只 `--fix` 那一块）、`USAGE.md`。
  `_data/onlineTools.yml` 与 `tools.html` **不暂存**（§0.7 第 1、3 条），并把这个未闭合状态写进
  本格记录与收口格的"待提交窗口"清单。

---

## Task 8: 浏览器核验（公共六族 + 三页 + 证件页四条回补）+ §7 两行先量后立

**Files:** Create `scripts/verify-tools-browser.mjs`、`scripts/verify-tools-browser-teeth.mjs`；
Modify spec（§7 两行、§8.3 对账表那一行的状态）。

跑法与两条硬口径：`TK_SITE_DIR=/tmp/segX/_site node scripts/verify-tools-browser.mjs`；
`TK_SITE_DIR` 指到仓库自己的 `_site` 时**直接退 2**（不许往 `pnpm dev` 与并行会话共用的构建输出里注错）。
开跑前先按 md5 证明快照与工作树的产物是同一批字节（段 3 Task 8 的规矩），并先证明
`jekyll serve` / `vite build --watch` 都没在跑。

六族逐页跑（三页 × 六族），JSON 页再加四族专有：树视图滚动上界（§V ③ 的真浏览器版）、
Pointer 点击复制的载荷 == Node 现算的那一条、5 MiB/+1B/200 层三档硬输入、
下载 `.json` 那一条（断 `createObjectURL` 收到 Blob、`revokeObjectURL` 被叫到）。

- [ ] Step 1: 六族通用表 → Step 2: JSON 专有四族 → Step 3: teeth 的九项全点燃（六族各一刀变异
  + 三条假牙自检），一项不点燃就是牙齿自己没牙（记忆规则「收紧守卫判据须自证仍有牙」）→
  Step 4: §7 那两行**按实测量出来的数**立进 spec（含 ≥5% 余量与 6↔9 抖动复算），
  并回写 §5.3 三处形状（§0.6）与 §8.3 对账表里"证件页那四条"的处置 → Step 5: 六道门禁跑齐、记录读数 →
  Step 6: 提交（`test(tools): 段 4 Task 8 JSON 页浏览器核验——六族×三页 + 证件页四条回补，§7 两行先量后立`）。

---

## Task 9: 对账收口 + 六道门禁

段 2 Task 11 / 段 3 Task 9 的同一形状：所有"当时值"逐格对到现行值、`⚠ 未落地` 回到 0、
`scripts/toolkit-tests.mjs` 文件头那张「用例分布」地图整表重算（awk 口径与两条硬事实照抄：
段序里没有 §P、§A 有两道横幅各 6 条；新增硬事实：**§S–§W 是本段落的，§X 起还没有**）、
README / USAGE 计数复算、门禁①②③④⑤⑥ 逐条读数（④ 若只动注释与文档，用"构建输入集未变 +
按 md5 证明同源"三层证据替代，但**只要本段任何一格动过 `dev/` 就必须真重建**）。

本段特有的三笔收口账：

1. **"待提交窗口"那一格结不结得掉**：`_data/onlineTools.yml` 的 json 条目与 `tools.html` 那一行，
   等另一路会话的「免安装工具」批次落进 HEAD 之后才能提交。收口时先 `git status --porcelain` 复看：
   若已落定 → 一次 `--fix` + 一格提交，门禁② 活树全绿；若仍未落定 → 本段的"完成"必须写成
   **"代码与判据全部落地，收录面两处改动在工作树而未提交"**，并把线上 `/tools/json.html`
   是否可达说清楚（**不可达**：yml 条目没进 HEAD，就没有任何入口指向它，也进不了 sitemap）。
   这一句必须显式说，不许用"门禁全绿"糊过去。
2. **§7 那条 BLOCKED 读法的先例**：若实测越 120KB，按 §0.5 停下交回，不动"YAML 降到仅序列化"那一档。
3. **重复面登记**：通用六族今天在 `verify-codec-browser.mjs` 与 `verify-tools-browser.mjs` 各有一份，
   写清"等 `verify-idcard-browser.mjs` 那格未提交改动落定后合流"，并把删除那一手的判据影响列出来。

---

## 交付顺序与提交节奏

Task 1→6 是一格一提交（纯逻辑 + 判据，风险低，先立判据）；Task 7 一格（收录面与门禁分支，
但两处 yml/tools.html 按 §0.7 排队）；Task 8 一格（含 spec 回填）；Task 9 一格。
**全程不 push**；本段收口后单独向用户请示推送（含"要不要连带那两格等窗口的改动一起发"）。
每格结束必须回到那六道门禁（记忆规则：收口后重跑全量五道门禁，只对改动文件跑 prettier/eslint 不算过）。
