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
- Modify: `scripts/verify-plan-blocks-teeth.mjs`（副本要拷第四份计划、快照走 `PLAN_RELS`、G6 改"所有计划都空"、
  G12 的清单认四份）
- Modify: `THIRD-PARTY-NOTICES.md`（第一节一行）
- Modify: `scripts/toolkit-tests.mjs`（追加 `// ── §U …` 那一节的**前五条**：U1–U5 内置上游件自证，见下面 Step 1）

**为什么 vendoring 排在第一格**：它是唯一一个"改了就能红"的事实——哈希判据要在任何 YAML 代码
存在之前立住，否则将来有人"顺手修一下内置件"时没有东西拦得住。

- [ ] **Step 1: 写红判据（§U 的 U1–U5：内置上游件自证族）**

在 `scripts/toolkit-tests.mjs` 末尾加一节 `// ── §U YAML/XML/CSV 互转（tools/json-convert.js，段 4 Task 1 起）`，
先只写五条，全部围绕那本内置件：读 `dev/libJs/js-yaml.esm.min.mjs` 的字节 → 断 sha256 等于写死的
一串（执行时由 `shasum -a 256` 现算填入，并把 npm tarball 的 `js-yaml-5.4.2.tgz` 哈希一起写进注释）；
断文件里出现版本串 `js-yaml`、`5.4.2` 与 MIT 的 banner（取上游文件实读形式，不许凭记忆写）；
断它**不含** `require(` / `process.` / `Buffer` / `module.exports` 四个词各 0 次；
断全仓库 import 这个路径的文件**恰好只有一个**（`grep -rln "libJs/js-yaml" dev/`）；
断 `package.json` 与 `pnpm-lock.yaml` 里 `js-yaml` 出现 0 次（这一条钉的就是"我们没有偷偷加依赖"，
对方若日后加了，这条要显式改，不许静默变绿）。

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs`
Expected: 前四条 FAIL（文件还不存在），第五条 FAIL（还没 import 点）。

- [ ] **Step 2: 取上游件 + 接桩，跑到绿**

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

- [ ] **Step 3: 门禁一/二/三跑齐**

`node scripts/verify-plan-blocks.mjs` 期望 `⚠ 未落地` 仍为 0、活树红格仍只有 yml 那一格。
`node scripts/verify-plan-blocks-teeth.mjs` 必须在一棵**带 `.git`、yml 还原到 HEAD 的全量副本**里跑
（段 3 Task 9 立的落点规矩：活树自相矛盾时基线必红，牙齿无从谈起），期望 `29/29`。

- [ ] **Step 4: 登记镜像（本格不进任何新文件的整文件镜像——内置件按 §0.4 明确不登记，
  桩文件不进镜像），`--fix` 只在导出树里跑，然后提交**

```bash
git add dev/libJs/js-yaml.esm.min.mjs scripts/verify-plan-blocks.mjs \
        scripts/verify-plan-blocks-teeth.mjs scripts/toolkit-tests.mjs THIRD-PARTY-NOTICES.md \
        _docs/superpowers/plans/2026-09-29-tools-json-page.md
git commit -m "feat(tools): 段 4 Task 1 接线——vendored js-yaml 的三条哈希自证 + 门禁认第四份计划"
```

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

- [ ] **Step 1: 写 §S 二十条红判据**——**20 个坏样本**逐条断 `{line, column, index, kind}` 四格
  （不是断"抛错"）：空串、只有空白、`{`、`{"a"`、`{"a":`、`[1,`、`[1,,]`、`{,}`、`{"a":1}{"b":2}`、
  `'a':1`（单引号）、`{"a":1,}`、`\x41` 坏转义、`\u12g4`、`01`、`1.`、`.5`、`+1`、`NaN`、
  `0.1.2`、一个 2,000 层嵌套。每个样本旁边写一句"这一处**为什么**是这个列"，
  并注明与原生 `JSON.parse` 的 `SyntaxError` 消息**不要求**同形（我们只要求位置对）。
  其余各条：闸门四档边界（正好 5 MiB 放行 / +1B 拒且 `error.message` 里含"超出"与差额数字、
  拒的时候**不许**把那一大串回显）；`locate` 对 CRLF/BOM/emoji（代理对）三套口径；
  Pointer `~0`/`~1` 双向 100 次随机往返；`sortJson` 稳定（两个键在 Unicode 序上相邻时谁前谁后钉死）
  与不改入参；重复键取后写 + `duplicateKeys` 报出；与原生对拍（200 层、脏样本、Unicode）
  必须同结论。
- [ ] **Step 2: 实现到绿**（解析器**必须迭代式**，显式栈——递归实现在 1000 层会先炸自己的调用栈；
  `formatJson` 与 `statsOf` 同理）。
- [ ] **Step 3: 登记镜像 + `--fix` + 门禁①②③⑤⑥ + 提交**（一格一提交，消息
  `feat(tools): 段 4 Task 2 json-core——行列号自实现，20 个坏样本逐个钉行与列（§S）`）。

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
