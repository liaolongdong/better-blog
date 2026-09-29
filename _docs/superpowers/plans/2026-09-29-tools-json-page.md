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

// §U 续（Task 4 落地三对互转）：这一族钉的是"站在内置件上面写出去的三对转换"。
//   上面 U1–U5 钉的是"仓库里躺着的那一本上游件"，两族各有各的盯法，不重名也不重口径。
//   方向不对称，判据也得分开写：
//     · JSON → X 是**本站写出去**的东西，形状按逐字相等来断（缩进、引号、换行、结尾），
//       因为它要给人复制走、贴进别人的文件里；
//     · X → JSON 是**别人写来的**东西，只能立一个"无损子集"：子集内逐字往返，子集外点名拒绝，
//       绝不"尽力而为"地把读不懂的东西猜成某个值（设计文档 §5.4「给依据不给黑箱」）。
//   YAML 那一族读侧用的 schema 是 YAML11 而不是默认的 CORE：CORE 连 `!!binary` 都不认
//   （实测抛 unknown scalar tag），而 §0.6 承诺了"binary → base64 串、Date → ISO 串"两条，
//   只有 YAML11 给得出这两个类型。价钱是 YAML 1.1 那族历史包袱会真的生效：`yes/no/y/n/on/off`
//   是布尔、`0755` 是八进制、`2024-01-01` 是日期、连键位上单个 `y` 也是布尔。写侧全部靠引号挡住
//   （dump 自己会加，U7 逐字钉住），读侧挡不住的那几档由 U8 逐条点名、并由 YAML_NOTES 如实告诉用户。
//   深度那一格是**实测出来的数**：内置件的读侧自己带一道嵌套闸门，2026-09-29 在它上面二分得到
//   98 层（第 99 层抛 nesting exceeded maxDepth (100)；报错里那个 100 是它自己的内部计数器，
//   与"用户能嵌套几层"差 2，所以判据钉实测的 98，不钉消息里的 100）。写侧用同一个数，理由只有一条：
//   **写出去就必须读得回来**。它比 §7 的深样本（200 层）窄，所以 roundTrips().yaml 在那一档会给
//   false，面板照实显示，不假装能转。
//   XML 只支持本站自己写的那个子集：`t` 属性标类型、数组元素一律 `<item>`、空白不 trim；
//   命名空间、DOCTYPE、外部实体、非预定义实体一律拒（U12 逐条）。
//   CSV 按 RFC 4180 补三处（引号转义、内嵌换行、CRLF），读回来一律是字符串——它没有类型可保
//   （CSV_NOTES 那一格就是这句）。
const U_MOD = await import('../dev/js/tools/json-convert.js');
const { YAML_LIB, YAML_NOTES, YAML_DEPTH_LIMIT, XML_CONVENTION, CSV_NOTES,
  jsonToYaml, yamlToJson, jsonToXml, xmlToJson, jsonToCsv, csvToJson, roundTrips } = U_MOD;
// 这一族要自己算"闸门那一档该报哪一格"，所以借 core 的五件：`locate` 与 `lineRange` 用来对账
// （error 里的行列必须由 index 推得出来，两套数字不许各说各话；snippet 必须是那一行、不含 `\r`），
// `gate` 用来对消息原话。别名是必须的——
// `MAX_INPUT_BYTES` 这一格在 §L 已经被 codec.js 的 1 MiB 占了顶层名。
const { MAX_INPUT_BYTES: U_JSON_BYTES, MAX_INPUT_LINES: U_LINES, MAX_DEPTH: U_MAX_DEPTH,
  gate: uGate, locate: uLocate, lineRange: uLineRange } = await import('../dev/js/tools/json-core.js');

/** 剥注释扫源码：与 §S/§T 同形，扫的是代码不是注释里的自我声明 */
const uCode = () => read('dev/js/tools/json-convert.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** 写侧成功：失败就让测试红在"实读了什么"上，不红在一句 undefined 上 */
const uWrite = (r, what = '写侧') => {
  if (!r.ok) throw new Error(`${what}应当成功，实读 error=${JSON.stringify(r.error)}`);
  return r.text;
};
const uWriteErr = (r, what = '写侧') => {
  if (r.ok) throw new Error(`${what}应当被拒，却成功产出 ${JSON.stringify(r.text).slice(0, 70)}`);
  return r.error;
};
const uRead = (r, what = '读侧') => {
  if (!r.ok) throw new Error(`${what}应当成功，实读 error=${JSON.stringify(r.error)}`);
  return r.value;
};
const uReadErr = (r, what = '读侧') => {
  if (r.ok) throw new Error(`${what}应当被拒，却解析成 ${JSON.stringify(r.value).slice(0, 70)}`);
  return r.error;
};
/** 只挂 own 键的原型污染样本：`o.__proto__ = v` 改的是原型，必须 defineProperty 才落成真属性 */
const uWithProtoKey = (value) => {
  const o = { b: 2 };
  Object.defineProperty(o, '__proto__', { value, enumerable: true, writable: true, configurable: true });
  return o;
};
/** 造 n 层嵌套数组（U6 与 U8 的两档深度样本都用它，别再各写一遍循环） */
const uDeep = (n) => { let v = 1; for (let i = 0; i < n; i++) v = [v]; return v; };
/** U+FEFF：CSV（U15、U16）与 XML（U12、U13）两族都要它，字面量里不写转义，一律 chr 造 */
const U_BOM = String.fromCharCode(0xfeff);
/** 深相等（走 assert 的严格口径：-0 与 +0 是两格，NaN 自等）；U17 的"手工往返"用它 */
const uEq = (a, b) => {
  try { assert.deepStrictEqual(a, b); return true; } catch { return false; }
};
/** 一趟往返：写侧不抛且 ok、读侧 ok、回来与原值深相等——roundTrips 的定义就是这三件事 */
const uRound = (value, write, read) => {
  const w = write(value);
  if (w.ok !== true) return false;
  const r = read(w.text);
  return r.ok === true && uEq(r.value, value);
};

test('U6 JSON→YAML→JSON 逐值原样：本站写出去的东西一定读得回来', () => {
  const U6_SAMPLES = [
    ['空对象', {}],
    ['空数组', []],
    ['纯标量数组', [1, 'a', true, null]],
    ['两层对象', { a: 1, b: 'x' }],
    ['深嵌套', { a: { b: { c: { d: 'deep' } } } }],
    ['数组里套对象', { arr: [{ k: 1 }, { k: 2 }], n: null }],
    ['空键名', { '': 'x', b: 2 }],
    ['中文键值', { 中文: '值', 键: { 内: [1, 2] } }],
    ['引号与撇号', { s: 'a"b\'c', t: 'it\'s' }],
    ['多行串', { m: '第一行\n第二行\n' }],
    ['制表与前空格', { tab: 'a\tb', lead: ' x ' }],
    ['数字族', { n: [0, -0.5, 1e21, -1e-7, 3.14159, 9007199254740991] }],
    ['歧义串全族', {
      yes: 'yes', no: 'no', on: 'On', y: 'y', n: 'n', nul: 'null', tilde: '~',
      inf: '.inf', nan: '.nan', oct: '0755', hex: '0x10', date: '2024-01-01', exp: '1e5', bool: 'true',
    }],
    ['YAML 指示符起始', {
      bang: '!x', hash: '#c', amp: '&a', star: '*a', at: '@x', pct: '%x', pipe: '|x',
      gt: '>', dash: '-', plus: '+', qm: '?', colon: 'a: b', comma: 'a,b',
    }],
    ['长串', { long: 'x'.repeat(500) }],
    ['__proto__ 是真属性', uWithProtoKey('x')],
    ['嵌套到闸门那一层', uDeep(YAML_DEPTH_LIMIT)],
  ];
  for (const [label, v] of U6_SAMPLES) {
    const text = uWrite(jsonToYaml(v), label);
    assert.ok(text.endsWith('\n'), `${label}：YAML 文本必须以换行结尾——复制框里少这一个换行，黏上来的就是下一行`);
    assert.equal(text, uWrite(jsonToYaml(v), label), `${label}：同一份输入两次产出逐字相同（不许有随机键序或时间戳）`);
    // deepStrictEqual 而不是 deepEqual：后者把 -0 与 0、null 与 undefined 判等，正是"原样回来"不能容忍的
    assert.deepStrictEqual(uRead(yamlToJson(text), label), v, `${label}：往返改了值`);
  }
});

test('U7 歧义值写侧必须带引号——值位与键位各一档，负零单列', () => {
  const U7_VALUE = [
    [{ a: 'yes' }, 'a: \'yes\'\n'], [{ a: 'no' }, 'a: \'no\'\n'], [{ a: 'On' }, 'a: \'On\'\n'],
    [{ a: 'y' }, 'a: \'y\'\n'], [{ a: 'n' }, 'a: \'n\'\n'], [{ a: 'true' }, 'a: \'true\'\n'],
    [{ a: 'null' }, 'a: \'null\'\n'], [{ a: '~' }, 'a: \'~\'\n'], [{ a: '.inf' }, 'a: \'.inf\'\n'],
    [{ a: '0755' }, 'a: \'0755\'\n'], [{ a: '0x10' }, 'a: \'0x10\'\n'], [{ a: '1e5' }, 'a: \'1e5\'\n'],
    [{ a: '2024-01-01' }, 'a: \'2024-01-01\'\n'],
    [{ a: '2024-01-01T00:00:00.000Z' }, 'a: \'2024-01-01T00:00:00.000Z\'\n'],
  ];
  const U7_KEY = [
    [{ y: 1 }, '\'y\': 1\n'], [{ n: 1 }, '\'n\': 1\n'], [{ '0755': 5 }, '\'0755\': 5\n'],
    [{ null: 7 }, '\'null\': 7\n'], [{ '~': 8 }, '\'~\': 8\n'], [{ true: 9 }, '\'true\': 9\n'],
    [{ '1e5': 10 }, '\'1e5\': 10\n'], [{ '2024-01-01': 11 }, '\'2024-01-01\': 11\n'],
  ];
  for (const [v, want] of U7_VALUE) assert.equal(uWrite(jsonToYaml(v), JSON.stringify(v)), want);
  for (const [v, want] of U7_KEY) assert.equal(uWrite(jsonToYaml(v), JSON.stringify(v)), want);
  // 负零那一档：JSON 文本里根本没有 -0（`JSON.stringify(-0) === '0'`），面板走不到这里。
  // 钉它不是为用户体验，是为了"实现别自创第二种写法"——比如先把值过一遍 JSON 再 dump，
  // 那样 -0 会静默变成 0，而 U6 那张表里没有任何一格能抓到这一条。
  assert.equal(uWrite(jsonToYaml({ a: -0 }), '负零'), 'a: -0.0\n');
  // 2026-09-29 实测：YAML11 的 float 记号走的是 `Number('-0.0')`，回来的**还是 -0**——
  // 这一档在 YAML 与 XML 两族都保得住，只有 CSV 保不住（它连类型都没有，见 U17 那一格）。
  // 钉成"实测如此"而不是"YAML 大概不行"：换内置件版本时这一格会红，逼人来重审。
  assert.equal(Object.is(uRead(yamlToJson('a: -0.0\n')).a, -0), true,
    'dump 写 -0.0、读侧给回 -0：roundTrips({a:-0}).yaml 那个 ✓ 靠的就是这一格');
});

test('U8 写侧的归一与拒、读侧的 YAML 1.1 包袱：每一档都得点名', () => {
  // ── 写侧归一：两种"JSON 里没有、JS 里常见"的值各自变成一个字符串 ──
  // 先变成串再交给 dump，而不是让 dump 写 `!!binary` / 裸时间戳：本站交出去的 YAML 必须与
  // 交进来的 JSON 同形（别人拿别的 yaml→json 工具转一圈，还得是同一份数据）。
  assert.equal(uWrite(jsonToYaml({ a: new Date('2024-06-01T08:30:00+08:00') }), '日期'),
    'a: \'2024-06-01T00:30:00.000Z\'\n', 'Date 走 UTC 的 ISO 串，+08:00 那一档必须折进 00:30Z');
  assert.equal(uWrite(jsonToYaml([new Date('2024-01-01T00:00:00Z')]), '数组里的日期'),
    '- \'2024-01-01T00:00:00.000Z\'\n');
  assert.equal(uWrite(jsonToYaml({ a: new Uint8Array([104, 105]) }), '两字节'), 'a: aGk=\n');
  assert.equal(uWrite(jsonToYaml({ a: new Uint8Array([0, 1, 2]) }), '三字节'), 'a: AAEC\n');
  assert.equal(uWrite(jsonToYaml({ a: new Uint8Array(0) }), '零字节'), 'a: \'\'\n',
    '空字节串编码成空字符串——写成 `a:` 会被读成 null，那是第二种值');

  // ── 写侧拒：JSON 里装不下的东西，逐个点名并给出 Pointer ──
  const U8_REJECT = [
    ['undefined 在根', undefined, ''],
    ['函数在根', () => {}, ''],
    ['Symbol 在根', Symbol('s'), ''],
    ['BigInt 在根', 10n, ''],
    ['NaN 在根', NaN, ''],
    ['+Infinity 在根', Infinity, ''],
    ['-Infinity 在根', -Infinity, ''],
    ['Map 在根', new Map([['k', 1]]), ''],
    ['undefined 在键位', { a: undefined }, '/a'],
    ['函数在数组里', { a: [() => {}] }, '/a/0'],
    ['NaN 在键位', { a: NaN }, '/a'],
    ['BigInt 在数组里', [10n], '/0'],
    ['-Infinity 在第二个元素', [null, -Infinity], '/1'],
    ['Infinity 在三层里', { a: { b: { c: Infinity } } }, '/a/b/c'],
    ['Map 在键位', { a: new Map() }, '/a'],
    ['Set 在键位', { a: new Set() }, '/a'],
    ['非 Uint8Array 的 typed array', { a: new Int16Array([1]) }, '/a'],
    ['带原型的类实例', { a: new (class Thing { constructor() { this.k = 1; } })() }, '/a'],
    // 这一族站得住的理由与上面不同：面板喂给这三个写函数的值一律来自 parseJson，那里头没有 getter
    // 与 Proxy——但 json-convert.js 是**模块的公开面**，别人拿它接别的数据源（DOM 属性、类实例的
    // 快照）就会撞上"读这一格时它自己抛了"。约束是"绝不抛给调用方"，所以这一族也必须在闸门里落地。
    ['抛异常的 getter', { get a() { throw new Error('boom'); } }, '/a'],
    ['读 trap 抛的 Proxy', new Proxy({ a: 1 }, {
      get() { throw new Error('nope'); },
      ownKeys() { return ['a']; },
      getOwnPropertyDescriptor() { return { enumerable: true, configurable: true }; },
    }), '/a'],
  ];
  for (const [label, v, path] of U8_REJECT) {
    const e = uWriteErr(jsonToYaml(v), label);
    assert.equal(e.kind, 'non-json', `${label} 的 kind 应当是 non-json，实读 ${e.kind}`);
    assert.equal(e.path, path, `${label} 的 Pointer 应当是 ${JSON.stringify(path)}，实读 ${JSON.stringify(e.path)}`);
    assert.match(e.message, /JSON/, `${label} 的消息要点名"JSON 里装不下"这件事`);
  }
  // 同一个理由，三个写函数一个都不许漏：面板上 YAML/XML/CSV 三格并排站着，任何一格把异常抛到
  // 调用方外面，就是把整块面板打成一次未捕获异常（"绝不抛"这条约束见本节开头）。
  // 上面那一族只用 jsonToYaml 走过一遍——它对这三格是同一道闸门（scanJson），所以这里补另两个。
  for (const [label, v] of U8_REJECT.slice(-2)) {
    for (const [name, fn] of [['jsonToXml', jsonToXml], ['jsonToCsv', jsonToCsv]]) {
      let r;
      try { r = fn(v); } catch (err) { throw new Error(`${name} 对 ${label} 抛了：${err.message}`); }
      assert.equal(r.ok, false, `${name} 对 ${label} 必须交回 error，实读 ${JSON.stringify(r)}`);
      assert.equal(r.error.kind, 'non-json', `${name} 对 ${label} 的 kind 实读 ${r.error.kind}`);
      assert.equal(r.error.path, '/a', `${name} 对 ${label} 的 Pointer 实读 ${r.error.path}`);
    }
  }
  // dump 遇到 undefined 键是**静默丢键**（实测 `dump({v:undefined})` → `'{}\n'`），函数/BigInt/Symbol 才抛。
  // 上面那一族全在 dump 之前拦住，这一格留着只为说清"不拦会是什么样"：键无声消失，用户看不出来。
  assert.equal(uWrite(jsonToYaml({ a: 1 }), '对照'), 'a: 1\n');

  // ── 写侧拒：环。判据只用"祖先栈"，不用全局 seen ──
  // 同一个对象被两个键引用（DAG）在 JSON 里就是两份拷贝，`JSON.stringify` 也照样写两份，
  // 那是**正确行为**不是坑；只有回到祖先自己的环才必须拒。用 seen 判环会把前者一起拒掉。
  const cyc = { a: 1 }; cyc.self = cyc;
  const e1 = uWriteErr(jsonToYaml(cyc), '对象环');
  assert.equal(e1.kind, 'cycle'); assert.equal(e1.path, '/self');
  const arr = [1]; arr.push(arr);
  const e2 = uWriteErr(jsonToYaml(arr), '数组环');
  assert.equal(e2.kind, 'cycle'); assert.equal(e2.path, '/1');
  const shared = { k: 1 };
  // 实测的键位引号（`'y':`）不是多余的：本站读侧用的是 YAML11，那里 `y` 是布尔——写出去不带引号，
  // 读回来就成了 `{true: {k:1}}`。dump 自己会挡这一族（U7 键位那一表钉的就是它），这里顺手把 DAG 钉全。
  assert.equal(uWrite(jsonToYaml({ x: shared, y: shared }), '共享但不成环'), 'x:\n  k: 1\n\'y\':\n  k: 1\n',
    'DAG 写两份：与 JSON.stringify 同形，不许把它当环拒');

  // ── 写侧拒：深度。U6 那格放行 98 层，这一格拒 99 层，两个数必须一起出现在消息里 ──
  const deep = uWriteErr(jsonToYaml(uDeep(YAML_DEPTH_LIMIT + 1)), '深一层');
  assert.equal(deep.kind, 'depth');
  assert.equal(deep.path.split('/').length - 1, YAML_DEPTH_LIMIT,
    `越界那一格的 Pointer 应当正好 ${YAML_DEPTH_LIMIT} 段（它就是被拒的那个节点），实读 ${deep.path}`);
  assert.match(deep.message, new RegExp(String(YAML_DEPTH_LIMIT + 1)), '消息要点名当前深度');
  assert.match(deep.message, new RegExp(String(YAML_DEPTH_LIMIT)), '消息要点名上限');
  assert.equal(jsonToYaml({ a: uDeep(YAML_DEPTH_LIMIT - 1) }).ok, true,
    '根对象 + 97 层数组 = 98 层容器，放行');
  assert.equal(jsonToYaml({ a: uDeep(YAML_DEPTH_LIMIT) }).error.kind, 'depth',
    '层数只数容器，不数它外面那个根：99 层就得拒');

  // ── 读侧：YAML 1.1 的历史包袱会真的生效，逐条钉成"实际就是这样"，而不是"我们承诺不是这样" ──
  const U8_COERCE = [
    ['布尔词 yes', 'a: yes\n', { a: true }],
    ['布尔词 no', 'a: no\n', { a: false }],
    ['布尔词 on', 'a: on\n', { a: true }],
    ['布尔词 off', 'a: off\n', { a: false }],
    ['布尔词 y', 'a: y\n', { a: true }],
    ['布尔词 n', 'a: n\n', { a: false }],
    ['布尔词 True', 'a: True\n', { a: true }],
    ['八进制 0755', 'a: 0755\n', { a: 493 }],
    ['十六进制 0x10', 'a: 0x10\n', { a: 16 }],
    ['二进制 0b101', 'a: 0b101\n', { a: 5 }],
    ['下划线 1_000', 'a: 1_000\n', { a: 1000 }],
    ['六十进制 12:30', 'a: 12:30\n', { a: 750 }],
    ['日期当值', 'a: 2024-01-01\n', { a: '2024-01-01T00:00:00.000Z' }],
    ['日期时间不带时区', 'a: 2024-01-01 10:00:00\n', { a: '2024-01-01T10:00:00.000Z' }],
    ['日期在数组里', '- 2024-01-01\n', ['2024-01-01T00:00:00.000Z']],
    ['正无穷掉成 null', 'a: .inf\n', { a: null }],
    ['非数掉成 null', 'a: .nan\n', { a: null }],
    ['键位上的 y', 'y: 1\n', { true: 1 }],
    ['键位上的 n', 'n: 1\n', { false: 1 }],
    ['!!binary 转 base64 串', 'a: !!binary aGk=\n', { a: 'aGk=' }],
    ['!!binary 在数组里', '- !!binary AAEC\n', ['AAEC']],
    ['!!str 强制字符串', 'a: !!str 1\n', { a: '1' }],
    ['没给值的键', 'a:\n', { a: null }],
    ['根是数字', '42\n', 42],
    ['根是裸串', 'hello\n', 'hello'],
    ['根是 null', 'null\n', null],
    ['流嵌套', '[1, [2]]\n', [1, [2]]],
    ['只有文档起始符', '---\n', null],
    ['起始加结束', '---\n...\n', null],
    // 2026-09-29 实测：内置件把"文档结束符之后再来一个 `...`"当同一份文档（它只对 `---` 计份数），
    // 本站的预扫一度把它判成两份——那是**误拒合法输入**，比漏拒更伤用户。U9 里补的是反方向那一格。
    ['连续两个点线还是一份', 'a: 1\n...\n...\n', { a: 1 }],
    ['注释加文档', '# c\n---\na: 1\n', { a: 1 }],
    ['尾部空行', 'a: 1\n\n', { a: 1 }],
  ];
  for (const [label, text, want] of U8_COERCE) {
    assert.deepStrictEqual(uRead(yamlToJson(text), label), want, label);
  }
  // `.inf` 那一档要说清是谁在动手：实测内置件的 YAML11 读侧自己就把 `.inf` / `.nan` 落成交集外的
  // 空值（本站再兜一层：非有限的数一律折成 null），最终交出去的是 `null` 而不是 `Infinity`——
  // 与 `JSON.stringify({a:Infinity}) === '{"a":null}'` 同一条口径。不折的话，交出去的就不是合法 JSON，
  // 而"给 JSON 工作台喂一个 JSON 里没有的值"这一族坑，面板上一个高亮都抓不到。
  assert.equal(JSON.stringify(uRead(yamlToJson('a: .inf\n'), '.inf')), '{"a":null}', '折成 null 而不是留着 Infinity');
  // `---` 算一份文档、`...` 与注释不算——上一格里两档各给了一次，这里只留一句为什么：
  // 空文档是 YAML 的合法成员（值是 null），"没有文档"才是没有输入。

  // ── 读侧不许污染原型：这一条盯的是**依赖**，不是自己的代码 ──
  // 换掉内置件、或它哪天改了构造对象的方式，这一格就会红，逼人来重新审一遍。
  const polluted = uRead(yamlToJson('a: { __proto__: { polluted: 1 } }\n'), '__proto__');
  assert.equal({}.polluted, undefined, 'Object.prototype 被污染了——后面每一个对象都带上了 polluted');
  assert.equal(Object.prototype.hasOwnProperty.call(polluted.a, '__proto__'), true,
    '__proto__ 必须是 own 属性，与 json-core 的 setOwn 同一条口径');
  assert.equal(polluted.a.polluted, undefined, '它读的是自己那个 __proto__ 值，不是原型');
  assert.deepStrictEqual(Object.keys(polluted.a), ['__proto__']);
});

test('U9 读侧 error 的形状与位置：六格齐活、行列自洽、闸门那一档交回原话', () => {
  const flow99 = '['.repeat(YAML_DEPTH_LIMIT + 1) + '1' + ']'.repeat(YAML_DEPTH_LIMIT + 1) + '\n';
  // [档位, 样本, kind, index, line, column, snippet, 这一格的位置为什么是它]
  const U9_ROWS = [
    ['空文本', '', 'empty', 0, 1, 1, '', '没有内容可指，EOF 就是 0 那一格'],
    ['只有空白', '   \n ', 'empty', 5, 2, 2, ' ', '换行只有那一个 \\n，所以第 2 行、行内第 2 列'],
    ['只有制表', '\t\n', 'empty', 2, 2, 1, '', 'EOF 落在第 2 行的开头，那一行是空的'],
    ['只有点线', '...\n', 'empty', 4, 2, 1, '', '`...` 是文档结束符，不构成文档，所以仍算"没有输入"'],
    ['只有注释', '# only comment\n', 'empty', 15, 2, 1, '', '注释不是内容：与 `...` 同一档，指 EOF'],
    ['超字节上限', 'y: ' + 'x'.repeat(U_JSON_BYTES), 'too-long', U_JSON_BYTES + 3, 1, U_JSON_BYTES + 4, '',
      '闸门那一档不给 snippet（一行就是 5 MiB），index = text.length'],
    ['超行数上限', 'a\n'.repeat(U_LINES + 1), 'too-many-lines', 2 * (U_LINES + 1), U_LINES + 2, 1, '',
      '行口径只认 \\n：末格是那个换行之后、空掉的第 200002 行'],
    // 内置件自己给的 position 是 4（它的消息写 (1:5)，那里 column 从 0 起）——行列一律由 index 经 locate 推，
    // 不读 mark.line/mark.column，否则两套尺会在 CRLF 与 emoji 上分家。
    ['映射里套映射', 'a: b: c\n', 'parse', 4, 1, 5, 'a: b: c', '指认第二个冒号（下标 4）'],
    ['流序列没闭合', 'a: [1,\n', 'parse', 7, 2, 1, '', 'EOF 在下标 7：逗号之后该来下一个元素'],
    ['流映射没闭合', '{a: 1\n', 'parse', 6, 2, 1, '', '流集合一直读到 EOF'],
    ['双引号串没闭合', '"unterminated\n', 'parse', 14, 2, 1, '', '同上，EOF 那一格'],
    ['缩进多一格', 'a: 1\n b: 2\n', 'parse', 7, 2, 3, ' b: 2', '第二行的 b 落在下标 7，列 = 7 - 5 + 1'],
    ['重复键', 'a: 1\na: 2\n', 'parse', 5, 2, 1, 'a: 2', '内置件自己判重复键，指认后写那一行的开头'],
    ['未知标签', 'a: !!python/object:x {}\n', 'unknown-tag', 3, 1, 4, 'a: !!python/object:x {}',
      '指认标签起始的 `!`（下标 3），不是它后面的名字'],
    ['binary 内容坏了', 'a: !!binary "@@@"\n', 'parse', 3, 1, 4, 'a: !!binary "@@@"',
      '标签认得、内容解不开：这一档归 parse，不新开一档'],
    ['指令没收尾', '%TAG ! x\na: 1\n', 'parse', 9, 2, 1, 'a: 1', '它要的是 directives 结束标记，实读到第 2 行开头'],
    ['合并键没有来源', '<<: 1\n', 'parse', 0, 1, 1, '<<: 1', '合并源必须是个映射'],
    ['两行文档', 'a: 1\n---\nb: 2\n', 'multi-document', 5, 2, 1, '---', '上面已经有内容，这一行就是第二份的开头'],
    ['首行就是分隔符', '---\na: 1\n---\nb: 2\n', 'multi-document', 9, 3, 1, '---',
      '第一个 `---` 只是"显式起始"，它上面没有内容，所以不算第二份'],
    ['点线分文档', 'a: 1\n...\nb: 2\n', 'multi-document', 5, 2, 1, '...', '`...` 之后还有内容，同样算第二份'],
    // 空文档也算文档：`---` 开了它，`...` 关掉它，后面那个 `---` 就是第二份。上一格钉的是"点线后面跟内容"，
    // 这一格钉"点线后面跟起始符"——两处都指认**把文本切成两份的第一个边界**，尺子只有一把。
    ['空文档关掉后又起一份', '---\n...\n---\n...\n', 'multi-document', 4, 2, 1, '...',
      '`...`（下标 4）关掉第一份，第二个 `---` 开第二份：指认前者，与上一格同一条口径'],
    ['尾部点线', 'a: 1\n---\nb: 2\n...\n', 'multi-document', 5, 2, 1, '---', '报的是**第一个**越界处，不是最后一个'],
    ['注释后起文档', '# c\n---\na: 1\n---\nb: 2\n', 'multi-document', 13, 4, 1, '---', '注释行不算内容：下标 13 那个才是第二份'],
    ['流式两文档', '[1]\n---\n[2]\n', 'multi-document', 4, 2, 1, '---', '列 1：分隔符行永远顶格'],
    ['嵌套过深', flow99, 'depth', 99, 1, 100, flow99.slice(0, -1),
      '内置件在第 99 层就停，指认它当时站的那一格（下标 99 是第 100 个 `[`）'],
  ];
  for (const [label, text, kind, index, line, column, snippet, why] of U9_ROWS) {
    const e = uReadErr(yamlToJson(text), label);
    assert.deepEqual(Object.keys(e).sort(), ['column', 'index', 'kind', 'line', 'message', 'snippet'],
      `${label}：error 的六格必须齐活`);
    assert.equal(e.kind, kind, `${label}：kind 实读 ${e.kind}（${why}）`);
    assert.equal(e.index, index, `${label}：index 实读 ${e.index}，期望 ${index}——${why}`);
    assert.equal(e.line, line, `${label}：行号实读 ${e.line}，期望 ${line}——${why}`);
    assert.equal(e.column, column, `${label}：列号实读 ${e.column}，期望 ${column}——${why}`);
    assert.equal(e.snippet, snippet, `${label}：snippet 实读 ${JSON.stringify(e.snippet)}`);
    // 自洽：行列必须由 index 推出来，两套数字不许各说各话
    assert.deepStrictEqual(uLocate(text, e.index), { line: e.line, column: e.column },
      `${label}：locate(text, index) 与 error 的行列不一致`);
    assert.equal(e.index >= 0 && e.index <= text.length, true, `${label}：index 越界`);
  }
  // 消息口径：有位置的那几档自己带"第 N 行第 M 列"，闸门那一档交回 core 的原话（同一句只有一处口径）
  for (const label of ['未知标签', '两行文档', '嵌套过深']) {
    const row = U9_ROWS.find((r) => r[0] === label);
    const e = uReadErr(yamlToJson(row[1]), label);
    assert.equal(e.message.includes(`第 ${row[4]} 行第 ${row[5]} 列`), true, `${label}：消息要带行列`);
  }
  for (const label of ['超字节上限', '超行数上限']) {
    const row = U9_ROWS.find((r) => r[0] === label);
    assert.equal(uReadErr(yamlToJson(row[1]), label).message, uGate(row[1]).message,
      `${label}：闸门那一档的消息必须是 json-core 的原话，站内不许有第二句"超出上限"`);
  }
  // 类型闸门：非字符串入参当场 TypeError，与 parseJson 同形（坏输入是返回值，入参错是编程错）
  assert.throws(() => yamlToJson(null), TypeError);
  assert.throws(() => yamlToJson(42), TypeError);
  assert.throws(() => xmlToJson([]), TypeError);
  assert.throws(() => csvToJson(undefined), TypeError);
});

test('U10 XML 写侧的逐字形状：类型靠 t 属性、数组元素一律 item、三档缩进、结尾一个换行', () => {
  const X = (...lines) => lines.join('\n') + '\n';
  const v = { a: 1, b: 'x', c: [1, true, null], d: { e: {} }, f: [] };
  assert.equal(uWrite(jsonToXml(v)), X(
    '<json t="obj">',
    '  <a t="num">1</a>',
    '  <b t="str">x</b>',
    '  <c t="arr">',
    '    <item t="num">1</item>',
    '    <item t="bool">true</item>',
    '    <item t="null"></item>',
    '  </c>',
    '  <d t="obj">',
    '    <e t="obj"></e>',
    '  </d>',
    '  <f t="arr"></f>',
    '</json>',
  ), '行序、缩进、属性写法一格都不许改：这是要给人贴进别人文件里的东西');
  assert.equal(uWrite(jsonToXml([[1]], { indent: 'four' })), X(
    '<json t="arr">', '    <item t="arr">', '        <item t="num">1</item>', '    </item>', '</json>'),
    'four 档就是每一层四个空格：拿 two 档做字符串替换是写不出这一条的');
  assert.equal(uWrite(jsonToXml([[1]], { indent: 'tab' })), X(
    '<json t="arr">', '\t<item t="arr">', '\t\t<item t="num">1</item>', '\t</item>', '</json>'));
  assert.equal(uWrite(jsonToXml({ a: 1 }, { root: 'payload' })),
    X('<payload t="obj">', '  <a t="num">1</a>', '</payload>'));
  // 根可以不是对象：JSON 的根本来就是任意值
  assert.equal(uWrite(jsonToXml('hi')), X('<json t="str">hi</json>'));
  assert.equal(uWrite(jsonToXml(42)), X('<json t="num">42</json>'));
  assert.equal(uWrite(jsonToXml(true)), X('<json t="bool">true</json>'));
  assert.equal(uWrite(jsonToXml(null)), X('<json t="null"></json>'));
  assert.equal(uWrite(jsonToXml([1, 2])),
    X('<json t="arr">', '  <item t="num">1</item>', '  <item t="num">2</item>', '</json>'));
  assert.equal(uWrite(jsonToXml([])), X('<json t="arr"></json>'),
    '空容器写成对标签而不是自闭合：两种都读得懂，选**读侧只有一种解释**的那一个');
  // 转义只有四格：`&` `<` `>` `\r`。`\n` 与 `\t` 原样留着（它们在线文本里就是自己），
  // `"` 与 `'` 在文本节点里不需要转义（本站不把用户数据写进属性值）。
  assert.equal(uWrite(jsonToXml({ s: 'a<b>&c"d\'e' })),
    X('<json t="obj">', '  <s t="str">a&lt;b&gt;&amp;c"d\'e</s>', '</json>'));
  assert.equal(uWrite(jsonToXml({ s: 'p\rq' })), X('<json t="obj">', '  <s t="str">p&#13;q</s>', '</json>'),
    '回车必须数字化：不转义的话读侧会按平台规矩把它当行尾吃掉，那是静默改数据');
  assert.equal(uWrite(jsonToXml({ s: 'l1\nl2' })), X('<json t="obj">', '  <s t="str">l1', 'l2</s>', '</json>'),
    '换行原样写出：包一层 CDATA 也能过，但"本站写的东西"就有了两种形状');
  assert.equal(uWrite(jsonToXml({ s: ']]>' })), X('<json t="obj">', '  <s t="str">]]&gt;</s>', '</json>'));
  assert.equal(uWrite(jsonToXml({ n: [0, -0.5, 1e21, 1e-7, 3.5] })), X(
    '<json t="obj">', '  <n t="arr">', '    <item t="num">0</item>', '    <item t="num">-0.5</item>',
    '    <item t="num">1e+21</item>', '    <item t="num">1e-7</item>', '    <item t="num">3.5</item>',
    '  </n>', '</json>'), '数字用 String(n)：那本来就是 JSON 的记号，读侧按同一把尺验它');
  assert.equal(uWrite(jsonToXml({ a: -0 })), X('<json t="obj">', '  <a t="num">-0</a>', '</json>'),
    '负零是这一族唯一要偏离 String(n) 的地方：`String(-0)` 给 "0"，那一格就把 -0 弄丢了——'
    + 'U13 的往返表里有 {a:-0}，而 JSON 文本里根本没有 -0，只有本站自己写的 XML 保得住它');
  assert.equal(uWrite(jsonToXml({ 中文键: '值' })),
    X('<json t="obj">', '  <中文键 t="str">值</中文键>', '</json>'));
  assert.equal(uWrite(jsonToXml({ 'x-m': 1, 'a.b': 2, _u: 3 })), X(
    '<json t="obj">', '  <x-m t="num">1</x-m>', '  <a.b t="num">2</a.b>', '  <_u t="num">3</_u>', '</json>'));
  // 参数口径：indent 不在 INDENT_MODES 里就当场 RangeError（静默回退默认档，是把"参数写错"藏成"输出莫名其妙"）
  assert.throws(() => jsonToXml(v, { indent: '2' }), /INDENT_MODES/);
  assert.throws(() => jsonToXml(v, { indent: 2 }), /INDENT_MODES/);
});

test('U11 XML 写侧的拒绝：非法键名一次列全，非法根名单列', () => {
  // 名字的规矩只有一条：`[字母 或 _]` 起始，后面跟 `[字母 数字 . _ -]`；外加 `xml` 前缀（不分大小写）
  // 与带冒号那一档（命名空间）拒。中文与希腊字母都算 `\p{L}`，所以合法——上一格刚钉过中文键。
  const U11_LEGAL = ['end-', 'a.b', '_u', 'x-m', 'n1', '中文键', 'Ωmega', 'A_b.C-d', '__proto__'];
  assert.equal(jsonToXml(Object.fromEntries(U11_LEGAL.map((k, i) => [k, i]))).ok, true,
    '这一族名字一个都不许拒：多禁一格就是把用户的键弄丢');
  const U11_BAD = ['1a', 'a b', '#x', 'a/b', '', '<x', 'a"', 'xml', 'XMLName', 'Xml:id', 'a:b', 'a\nb', '-lead', '.dot', 'a\tb', 'a\rb'];
  const e = uWriteErr(jsonToXml(Object.fromEntries(U11_BAD.map((k, i) => [k, i]))), '一堆非法键');
  assert.equal(e.kind, 'invalid-key');
  assert.deepEqual(e.keys, U11_BAD, '非法键要**一次列全**（按出场顺序），不许只报第一个就让人改三轮');
  assert.deepEqual(Object.keys(e).sort(), ['keys', 'kind', 'message', 'path'],
    '写侧 error 就这四格：指针不是文档，没有行列可言（读侧那六格见 U9）');
  assert.equal(e.path, '/1a', 'Pointer 给第一个越界者，面板拿它做"跳到那一行"');
  assert.match(e.message, /键名/);
  assert.deepEqual(uWriteErr(jsonToXml({ a: 1, 'b c': 2, x: 3 }), '混着合法键').keys, ['b c']);
  for (const root of ['a b', '1x', '', 'xml', 'a:b']) {
    const bad = uWriteErr(jsonToXml({ a: 1 }, { root }), `非法根名 ${JSON.stringify(root)}`);
    assert.equal(bad.kind, 'invalid-root');
    assert.equal(bad.path, '', '根没有父路径可指：Pointer 就是空串');
    assert.match(bad.message, /根/);
  }
  // 字符闸门：XML 1.0 连数字引用都容不下的那几位（C0 里除 `\t` `\n` 之外的一切），加上落单代理项。
  // "静默删掉"是最省事也最坏的写法：用户看不出少了什么。码点一律用 chr() 造，字面量里不写转义。
  const chr = (c) => String.fromCharCode(c);
  const U11_CHARS = [
    ['C0 控制符', { a: 'x' + chr(1) + 'y' }, '/a', 'U+0001'],
    ['垂直制表', { a: chr(11) }, '/a', 'U+000B'],
    ['换页符', { a: chr(12) }, '/a', 'U+000C'],
    ['单元控制符', { a: 'q' + chr(31) }, '/a', 'U+001F'],
    ['落单代理项（前件）', { a: chr(0xD800) }, '/a', 'U+D800'],
    ['落单代理项（后件）', { a: 'x' + chr(0xDC00) + 'y' }, '/a', 'U+DC00'],
    ['数组里的深一层', { a: [{ b: chr(2) }] }, '/a/0/b', 'U+0002'],
  ];
  for (const [label, v, path, code] of U11_CHARS) {
    const err = uWriteErr(jsonToXml(v), label);
    assert.equal(err.kind, 'bad-char', `${label} 的 kind 应当是 bad-char，实读 ${err.kind}`);
    assert.equal(err.path, path, `${label} 的 Pointer 实读 ${err.path}`);
    assert.ok(err.message.includes(code), `${label} 的消息要点名码点 ${code}，实读 ${err.message}`);
  }
  assert.ok(jsonToXml({ a: 'x\r\ty\nz' }).text.includes('&#13;'),
    '回车走数字引用、制表与换行走原样：这一档不归字符闸门管（各自的写法见 U10）');
  assert.equal(jsonToXml({ a: chr(0x7F) + chr(0x80) + chr(0x2028) }).ok, true,
    'DEL、U+0080 与行分隔符都在 XML 1.0 的合法字符集里，闸门不许顺手多禁');
  assert.equal(uWrite(jsonToXml({ s: '🎉' })), '<json t="obj">\n  <s t="str">🎉</s>\n</json>\n',
    '成对的代理项是一个字符，不是落单：原样写出，不许转成 \\ud83c\\udf89 那种字面量');

  // 深度只许一把尺，而且**写出去的必须读得回来**。读侧那道闸门数的是**元素层数**（根算第 1 层，
  // U12 最后那一族逐个钉的就是它），而本站的 XML 编码里"一个值恰好一个元素"——最深那一格是标量时
  // 元素层数 = 容器层数 + 1。写侧原先只数容器，于是放行了自己读不回来的东西：2026-09-29 实测
  // `jsonToXml(uDeep(1000))` 交回 ok，而 `xmlToJson` 对同一份文本判 depth（"第 1001 层"），
  // 面板上就是一格亮着 ✓ 却转不回来。改口只改写侧的尺，读侧那一把一字不动（它是 U12 的既成事实）。
  assert.equal(jsonToXml(uDeep(U_MAX_DEPTH - 1)).ok, true,
    '999 层容器 + 最深那一格标量 = 1000 层元素，正好在闸门口，必须放行');
  const xd = uWriteErr(jsonToXml(uDeep(U_MAX_DEPTH)), 'XML 深一层');
  assert.equal(xd.kind, 'depth', `实读 ${xd.kind}：${xd.message}`);
  assert.equal(xd.path.split('/').length - 1, U_MAX_DEPTH,
    `越界那一格的 Pointer 应当正好 ${U_MAX_DEPTH} 段（它就是被拒的那个标量叶），实读 ${xd.path}`);
  assert.match(xd.message, new RegExp(String(U_MAX_DEPTH + 1)), '消息要点名当前层数');
  assert.match(xd.message, new RegExp(String(U_MAX_DEPTH)), '消息要点名上限');
  for (const n of [U_MAX_DEPTH - 1, U_MAX_DEPTH]) {
    const w = jsonToXml(uDeep(n));
    assert.equal(w.ok ? xmlToJson(w.text).ok : false, w.ok,
      `${n} 层容器：写侧与读侧在这一格必须同结论（写出即可读回）`);
  }
  assert.equal(roundTrips(uDeep(U_MAX_DEPTH)).xml, false,
    '转不回来的那一档，面板上那个 ✓ 必须是 ✗：roundTrips 与写侧闸门不许各说各话');
});

test('U12 XML 读侧的子集边界：坏样本逐个钉 kind 与那一处位置', () => {
  // 读侧只认写器发得出来的那一族（`XML_CONVENTION` 那句人话就是这张表的目录），越界整体拒绝并指认位置。
  // index 一律指向**越界的那一个字符**，不指向它后面也不指向它的父标签；行口径借 §S 那把尺（只认 `\n`）。
  // 六格 = 位置五件套 + message：§S 那一本多一个 `length`，是因为它自己扫记号能给；这里给不出，宁缺不假。
  const U12_ROWS = [
    ['空输入', '', 'empty', 0, 1, 1],
    ['只有空白', '  \n ', 'empty', 4, 2, 2],
    ['只有注释', '<!-- only -->\n', 'empty', 14, 2, 1],
    ['只有声明', '<?xml version="1.0"?>', 'empty', 21, 1, 22],
    // BOM 三族同一条口径（CSV 见 U15、U16，YAML 走内置件）：剥掉它再解析，但**位置一律指原文**——
    // 面板高亮吃的是用户粘进去的那份文本，BOM 占第 1 行第 1 列这一格。
    ['只有 BOM', U_BOM, 'empty', 1, 1, 2],
    ['开始标签没闭合', '<a t="num">1', 'unterminated', 12, 1, 13],
    ['闭合名不匹配', '<a t="str">x</b>\n', 'bad-name', 12, 1, 13],
    ['闭合标签带属性', '<a t="str">x</a k>', 'bad-attr', 15, 1, 16],
    // 三格都指"根元素之后的第一个越界字符"：`<a t="str">` 占 0–10、`x` 在 11、`</a>` 占 12–15，所以越界者在 16
    ['根之后有裸文本', '<a t="str">x</a>y', 'trailing', 16, 1, 17],
    ['根之后有第二个根', '<a t="str">x</a><b t="num">1</b>', 'trailing', 16, 1, 17],
    ['根之后有注释', '<a t="str">x</a><!-- tail -->', 'trailing', 16, 1, 17],
    // 同一档前面加一格 BOM：越界者在原文里是第 17 格、第 18 列（剥 BOM 只用于解析，位置指原文）
    ['BOM 之后的越界者', U_BOM + '<a t="str">x</a>y', 'trailing', 17, 1, 18],
    ['num 装非数字', '<a t="num">x</a>', 'bad-value', 11, 1, 12],
    ['num 带正号', '<a t="num">+1</a>', 'bad-value', 11, 1, 12],
    ['num 有前导零', '<a t="num">01</a>', 'bad-value', 11, 1, 12],
    ['num 装 Infinity', '<a t="num">Infinity</a>', 'bad-value', 11, 1, 12],
    // `t="bool"` 与 `t="null"` 比 `t="num"` 长一格，所以这两档的内容起始是 12 不是 11——
    // 指认的是内容里第一个非空白字符，不是标签。
    ['bool 装 TRUE', '<a t="bool">TRUE</a>', 'bad-value', 12, 1, 13],
    ['null 有内容', '<a t="null">z</a>', 'bad-value', 12, 1, 13],
    ['缺 t 属性', '<a>1</a>', 'bad-shape', 0, 1, 1],
    ['t 值不在册', '<a t="int">1</a>', 'bad-shape', 5, 1, 6],
    ['多一个属性', '<a t="str" k="v">x</a>', 'bad-attr', 11, 1, 12],
    ['属性没有等号', '<a t="str" x>', 'bad-attr', 11, 1, 12],
    ['t 写了两遍', '<a t="str" t="num">x</a>', 'bad-attr', 11, 1, 12],
    ['arr 的子元素名不是 item', '<a t="arr"><b t="num">1</b></a>', 'bad-shape', 11, 1, 12],
    ['arr 里有裸文本', '<a t="arr">txt<item t="num">1</item></a>', 'bad-shape', 11, 1, 12],
    ['str 里有子元素', '<a t="str"><b t="num">1</b></a>', 'bad-shape', 11, 1, 12],
    ['未注册的具名实体', '<a t="str">&weird;</a>', 'bad-entity', 11, 1, 12],
    ['数字引用是 0', '<a t="str">&#0;</a>', 'bad-entity', 11, 1, 12],
    ['数字引用是落单代理项', '<a t="str">&#xD800;</a>', 'bad-entity', 11, 1, 12],
    ['数字引用超出码位上限', '<a t="str">&#x110000;</a>', 'bad-entity', 11, 1, 12],
    ['裸的 &', '<a t="str">a&b</a>', 'bad-entity', 12, 1, 13],
    ['实体少分号', '<a t="str">&amp</a>', 'bad-entity', 11, 1, 12],
    ['DOCTYPE 打头', '<!DOCTYPE json SYSTEM "x.dtd">\n<a t="num">1</a>', 'doctype', 0, 1, 1],
    ['声明后跟 DOCTYPE', '<?xml version="1.0"?>\n<!DOCTYPE a>\n<a t="num">1</a>', 'doctype', 22, 2, 1],
    // 名字越界一律指认**整个名字那一段的开头**（扫到空白 / `/` / `>` 为止的那一段），不指认段内第几个字符：
    // `a!`、`1a`、`XMLa`、`a:b` 四档的病灶都是"这一段不是合法名字"，把光标放到段首最容易看懂。
    ['注释没闭合', '<a t="str"><!-- unterminated</a>', 'unterminated', 11, 1, 12],
    ['CDATA 没闭合', '<a t="str"><![CDATA[x</a>', 'unterminated', 11, 1, 12],
    ['根之前有垃圾', 'junk<a t="num">1</a>', 'bad-document', 0, 1, 1],
    ['尖括号之后不是名字', '<a! t="num">1</a>', 'bad-name', 1, 1, 2],
    ['元素名数字打头', '<1a t="num">1</a>', 'bad-name', 1, 1, 2],
    ['元素名撞 xml 前缀', '<XMLa t="str">x</XMLa>', 'bad-name', 1, 1, 2],
    ['元素名带冒号', '<a:b t="str">x</a:b>', 'bad-name', 1, 1, 2],
    ['属性名带冒号', '<a t="str" x:y="1">x</a>', 'bad-name', 11, 1, 12],
    ['只有一个尖括号', '<', 'unterminated', 0, 1, 1],
    ['先出现闭合标签', '</a>', 'bad-document', 0, 1, 1],
    ['闭合标签半截', '<a t="str">x</a', 'unterminated', 12, 1, 13],
    ['t 的引号没合上', '<a t="str>x</a>', 'unterminated', 5, 1, 6],
    ['处理指令没闭合', '<?xml version="1.0"?>\n<?pi tail\n<a t="num">1</a>', 'unterminated', 22, 2, 1],
    ['声明写两遍', '<?xml version="1.0"?><?xml version="1.0"?>\n<a t="num">1</a>', 'bad-document', 21, 1, 22],
    ['声明半截', '<?xml version="1.0"', 'unterminated', 0, 1, 1],
  ];
  const seen = new Set();
  for (const [label, text, kind, index, line, column] of U12_ROWS) {
    seen.add(kind);
    const e = uReadErr(xmlToJson(text), label);
    assert.deepEqual(Object.keys(e).sort(), ['column', 'index', 'kind', 'line', 'message', 'snippet'],
      `${label}：读侧 error 的六格必须齐活（与 U9 同一条口径）`);
    assert.equal(e.kind, kind, `${label}：kind 实读 ${e.kind}，期望 ${kind}`);
    assert.equal(e.index, index, `${label}：index 实读 ${e.index}，期望 ${index}`);
    assert.equal(e.line, line, `${label}：行号实读 ${e.line}，期望 ${line}`);
    assert.equal(e.column, column, `${label}：列号实读 ${e.column}，期望 ${column}`);
    assert.deepStrictEqual(uLocate(text, e.index), { line: e.line, column: e.column },
      `${label}：行列必须由 index 推出来，两套数字不许各说各话`);
    // snippet 就是"那一行"，切法借 §S 的 lineRange（所以 CRLF 不会多带一个 \r）
    const rng = uLineRange(text, e.line);
    assert.equal(e.snippet, text.slice(rng.start, rng.end), `${label}：snippet 实读 ${JSON.stringify(e.snippet)}`);
    assert.equal(e.message.includes(`第 ${line} 行第 ${column} 列`), true,
      `${label}：消息要带人话的行列，实读 ${e.message}`);
  }
  // 十档 kind 一档都不许缺：缺了就意味着实现里那条分支从来没被踩过
  for (const k of ['empty', 'unterminated', 'bad-name', 'bad-attr', 'bad-value', 'bad-shape',
    'bad-entity', 'doctype', 'trailing', 'bad-document']) {
    assert.ok(seen.has(k), `样本集没覆盖 ${k}：那一档的拒绝路径等于没测`);
  }

  // 深度：闸门只有一把（`MAX_DEPTH`，与 parseJson 同一档），且必须**边扫边判**——
  // 递归下降在这里会先炸调用栈，那样给出的就是"栈溢出"而不是行列号。
  const U12_DEEP = `<json t="arr">\n${'<item t="arr">\n'.repeat(U_MAX_DEPTH)}`;
  const deep = uReadErr(xmlToJson(U12_DEEP), '嵌套超过 MAX_DEPTH');
  assert.equal(deep.kind, 'depth', `实读 ${deep.kind}：${deep.message}`);
  assert.equal(deep.line, U_MAX_DEPTH + 1, '根算第 1 层，越界的是第 1001 行');
  assert.equal(deep.column, 1, '那一行顶格就是越界的 `<`');
  assert.equal(deep.index, 15 * U_MAX_DEPTH, 'index = 每行 15 格 × 1000 行');
  assert.equal(deep.snippet, '<item t="arr">', 'snippet 只给那一行，不许把 1 MB 输入整条塞进消息');
  assert.match(deep.message, new RegExp(String(U_MAX_DEPTH)));
  // 边界另一侧：刚好卡在闸门内的最深**闭合**样本必须读得回来（只测拒绝侧抓不到"多禁一层"）
  const closer = '</item>\n'.repeat(U_MAX_DEPTH - 1);
  const okInside = xmlToJson(`<json t="arr">\n${'<item t="arr">\n'.repeat(U_MAX_DEPTH - 1)}${closer}</json>\n`);
  assert.equal(okInside.ok, true, `1000 层必须放行：${JSON.stringify(okInside.error)}`);
  assert.equal(Array.isArray(okInside.value) && okInside.value.length === 1, true, '根是一元数组');
  let walk = okInside.value;
  for (let i = 0; i < U_MAX_DEPTH - 1; i++) walk = walk[0];
  assert.deepEqual(walk, [], '最里那一层是空数组：1000 层一格都没被吞');
  // 再深一层就拒，且位置随那一行走（不是固定指根，也不是 EOF）
  const oneMore = uReadErr(xmlToJson(`<json t="arr">\n${'<item t="arr">\n'.repeat(U_MAX_DEPTH)}${closer}</item>\n`),
    '1001 层');
  assert.equal(oneMore.kind, 'depth');
  assert.equal(oneMore.line, U_MAX_DEPTH + 1);
  assert.equal(oneMore.column, 1);
  assert.equal(deep.message.includes('第 1001 行第 1 列'), true, '深度那一档的行列也要进消息');
});

test('U13 XML 往返 26 例 + 读侧的接受面：本站写出去的必须原样回来，别人手写合法的也要认', () => {
  // 设计文档 §8.1 的"JSON→X→JSON 深比较"落到 XML 这一族就是这张表。
  // 表里**没有**空键名、`"引号"开头的键` 这类形状——它们归 U11 的非法键那一档，写侧就出不来东西。
  const U13_ROUND = [
    {}, [], 'hi', 42, true, null,
    { a: 1, b: 'x', c: true, d: null, e: [1, 2], f: { g: {} }, h: [] },
    [[1, 'a'], [null, true]],
    '&<>',
    ']]> 结束符',
    'CRLF\r\n换行',
    '🎉 代理对',
    '  前后空格与制表\t  ',
    { 'a.b': 1, 'x-y': 2, '_u': 3, '中文键': '值' },
    { a: -0 },
    { a: 1e21, b: 1e-7 },
    { a: 0.30000000000000004 },
    { a: 9007199254740991 },
    { a: 'x'.repeat(2000) },
    uWithProtoKey({ nested: 1 }),
    '</script>',
    { '单引号': "it's" },
    { 嵌套: [{ k: 'v' }, {}, []] },
    { a: { b: { c: { d: { e: '深一层' } } } } },
    { a: '\n\n连续空行\n' },
    [null, null],
  ];
  assert.ok(U13_ROUND.length >= 20, 'plan §Task 4 明写"写→读深相等覆盖 20 例"，这一族不许缩水');
  for (const v of U13_ROUND) {
    const label = `往返 ${JSON.stringify(v === undefined ? 'undef' : v).slice(0, 44)}`;
    const text = uWrite(jsonToXml(v), label);
    const back = xmlToJson(text);
    assert.equal(back.ok, true, `${label}：写出去的东西读不回来，实读 ${JSON.stringify(back.error)}`);
    assert.deepEqual(Object.keys(back).sort(), ['ok', 'value'],
      'XML 读侧成功只有这两格：meta 是 CSV 的事（U16），这里塞一份只会让面板多读一个空格子');
    assert.deepStrictEqual(back.value, v, `${label}：深相等没过`);
    assert.equal(roundTrips(v).xml, true, `${label}：面板那个 ✓ 读的就是这一格，必须与手工往返同结论`);
  }
  // 确定性：同一个值两次写出逐字节相同（否则"复制走的内容每次不一样"这种抱怨没法追）
  const once = uWrite(jsonToXml({ a: [1, { b: 'x' }], c: null }));
  assert.equal(uWrite(jsonToXml({ a: [1, { b: 'x' }], c: null })), once, '两次写出必须逐字节相同');
  // 原型那一格：读回来的对象原型还是 Object.prototype，污染只许停在 own 键上
  const polluted = uRead(xmlToJson(uWrite(jsonToXml(uWithProtoKey({ nested: 1 })))));
  assert.equal(Object.getPrototypeOf(polluted), Object.prototype, '读侧不许把 __proto__ 当构造器');
  assert.deepEqual(Object.keys(polluted), ['b', '__proto__'], 'own 键序与写侧一致');
  assert.equal({}.nested, undefined, 'Object.prototype 一个键都没多');

  // 接受面：写器自己不发这些形状，但手改过的合法 XML 要认——这一族是"子集"不是"自家产物"，
  // 只认自家写法等于把"编辑后再读"这条路堵死（面板上那句说明承诺的是子集）。
  const ACCEPT = [
    ['自闭合空数组', '<json t="arr"/>', []],
    ['自闭合空对象', '<json t="obj"/>', {}],
    ['自闭合 null', '<json t="null"/>', null],
    ['自闭合空串', '<json t="str"/>', ''],
    ['num 带包围空白', '<json t="num"> 42 </json>', 42],
    ['bool 带换行', '<json t="bool">\ntrue\n</json>', true],
    ['null 带空白', '<json t="null"> \n </json>', null],
    ['属性用单引号', "<json t='str'>x</json>", 'x'],
    ['属性四周留白', '<json   t = "str"  >x</json  >', 'x'],
    ['注释夹在元素间', '<json t="obj">\n<!-- c -->\n<a t="num">1</a>\n</json>\n', { a: 1 }],
    ['CDATA 里的尖括号不算标签', '<json t="str"><![CDATA[<a> & raw]]></json>', '<a> & raw'],
    ['五类预定义实体', '<json t="str">&amp;&lt;&gt;&quot;&apos;</json>', '&<>"\''],
    ['数字引用十进制与十六进制', '<json t="str">&#65;&#x42;</json>', 'AB'],
    ['同名兄弟归并成数组', '<json t="obj"><b t="num">1</b><b t="num">2</b></json>', { b: [1, 2] }],
    ['同名兄弟只有一个就还是标量', '<json t="obj"><b t="num">1</b></json>', { b: 1 }],
    ['三个同名兄弟', '<json t="obj"><b t="num">1</b><b t="num">2</b><b t="num">3</b></json>', { b: [1, 2, 3] }],
    ['CRLF 排版的文档', '<json t="obj">\r\n  <b t="str">x</b>\r\n</json>\r\n', { b: 'x' }],
    ['声明与处理指令跳过', '<?xml version="1.0" encoding="UTF-8"?>\n<?php x ?>\n<json t="num">1</json>', 1],
    ['根元素名不必叫 json', '<payload t="obj"><a t="num">1</a></payload>', { a: 1 }],
    ['str 里的换行是内容', '<json t="str">a\nb</json>', 'a\nb'],
    ['str 不 trim', '<json t="str">  空格  </json>', '  空格  '],
    ['arr 里的 item 是空容器', '<json t="arr"><item t="arr"/><item t="obj"/></json>', [[], {}]],
    ['obj 里可以有个键就叫 item', '<json t="obj"><item t="num">1</item></json>', { item: 1 }],
    ['BOM 开头的一份文档', U_BOM + '<json t="obj"><a t="str">x</a></json>', { a: 'x' }],
    ['BOM 之后还有声明', U_BOM + '<?xml version="1.0"?>\n<json t="num">1</json>', 1],
  ];
  for (const [label, text, want] of ACCEPT) {
    assert.deepStrictEqual(uRead(xmlToJson(text), label), want, `${label}：读侧的接受面实读不符`);
  }
  // root 选项写出去的东西，读侧不靠"json"这个名字认路
  assert.deepStrictEqual(uRead(xmlToJson(uWrite(jsonToXml({ a: 1 }, { root: 'payload' })))), { a: 1 },
    '根名换成 payload 也要读得回来');
});

test('U14 CSV 写侧：形状闸门、表头口径与逐字输出', () => {
  // CSV 没有类型、没有嵌套、也没有"这一格是 null 还是空串"的分别——所以写侧只有两档收：
  // **对象数组**与**单个对象**（当一行看）。其余一律拒，并说明要求（plan §Task 4 明写这一条）。
  // 嵌套容器不拒：压成一行 JSON 写进单元格，读回来是字符串——比"你的数据转不了"有用，
  // 且不撒谎（CSV_NOTES.fidelity 那句就是说这件事，见 U16）。
  const U14_OK = [
    ['一行对象数组', [{ a: 1, b: 'x' }], undefined, 'a,b\r\n1,x\r\n'],
    ['单个对象当一行', { a: 1, b: 'x' }, undefined, 'a,b\r\n1,x\r\n'],
    ['后行有新键就追加', [{ a: 1 }, { b: 2, c: 3 }], undefined, 'a,b,c\r\n1,,\r\n,2,3\r\n'],
    ['同键两行', [{ a: 1 }, { a: 2 }], undefined, 'a\r\n1\r\n2\r\n'],
    ['分号当分隔符', [{ a: 1 }], ';', 'a\r\n1\r\n'],
    ['制表符当分隔符', [{ a: 'x\ty' }], '\t', 'a\r\n"x\ty"\r\n'],
    ['键名里有空格', [{ 名字: 1, 'x y': 2 }], undefined, '名字,x y\r\n1,2\r\n'],
    ['键名里有逗号要引起来', [{ 'a,b': 1 }], undefined, '"a,b"\r\n1\r\n'],
    ['空键名给个占位名', [{ '': 1 }], undefined, 'col_1\r\n1\r\n'],
    ['null 是空格子', [{ a: null }], undefined, 'a\r\n\r\n'],
    ['空串也是空格子：与上一格逐字相同', [{ a: '' }], undefined, 'a\r\n\r\n'],
    ['布尔小写、数字走 String', [{ a: true, b: false, c: 1e21 }], undefined, 'a,b,c\r\ntrue,false,1e+21\r\n'],
    ['负零写成 0', [{ a: -0 }], undefined, 'a\r\n0\r\n'],
    ['对象压成一行 JSON 进单元格', [{ a: { b: 1 } }], undefined, 'a\r\n"{""b"":1}"\r\n'],
    ['数组同样压进单元格', [{ a: [1, 'x'] }], undefined, 'a\r\n"[1,""x""]"\r\n'],
    ['嵌套里的 null 不丢', [{ a: { b: null } }], undefined, 'a\r\n"{""b"":null}"\r\n'],
    ['含分隔符的值引起来', [{ a: 'x,y' }], undefined, 'a\r\n"x,y"\r\n'],
    ['含引号的值 doubling', [{ a: 'a"b' }], undefined, 'a\r\n"a""b"\r\n'],
    ['含换行的值引起来、换行原样', [{ a: 'l1\nl2' }], undefined, 'a\r\n"l1\nl2"\r\n'],
    ['含 CRLF 的值也原样', [{ a: 'l1\r\nl2' }], undefined, 'a\r\n"l1\r\nl2"\r\n'],
    ['制表与行首空格不需要引号', [{ a: '\ttab' }, { b: ' lead' }], undefined, 'a,b\r\n\ttab,\r\n, lead\r\n'],
    ['__proto__ 是普通键名', uWithProtoKey('v'), undefined, 'b,__proto__\r\n2,v\r\n'],
    ['日期先变 ISO 串（与 YAML 那一族同一条口径）', { at: new Date('2024-06-01T00:30:00Z') }, undefined,
      'at\r\n2024-06-01T00:30:00.000Z\r\n'],
    ['字节串先变 base64（同上）', { a: new Uint8Array([104, 105]) }, undefined, 'a\r\naGk=\r\n'],
  ];
  for (const [label, v, delimiter, want] of U14_OK) {
    const r = delimiter === undefined ? jsonToCsv(v) : jsonToCsv(v, { delimiter });
    assert.deepEqual(Object.keys(r).sort(), ['ok', 'text'], `${label}：写侧成功就这两格，实读 ${JSON.stringify(r)}`);
    assert.equal(r.text, want, `${label}：逐字实读 ${JSON.stringify(r.text)}`);
    assert.equal(r.text.endsWith('\r\n'), true, `${label}：每一行都以 CRLF 收尾，最后一行也一样`);
  }
  // 两次写出逐字节相同：表头顺序由出场顺序决定，不许有实现把键序交给哈希
  assert.equal(uWrite(jsonToCsv([{ b: 1, a: 2 }])), 'b,a\r\n1,2\r\n', '表头就是首行的键序');

  const U14_SHAPE = [
    ['空数组', [], 'empty'], ['零个键的一行', [{}], 'empty'], ['空对象', {}, 'empty'],
    ['数字', 42, 'shape'], ['字符串', 'x', 'shape'], ['null', null, 'shape'], ['纯标量数组', [1, 2], 'shape'],
    ['数组里混标量', [{ a: 1 }, 2], 'shape'], ['数组套数组', [[1]], 'shape'], ['布尔', true, 'shape'],
  ];
  for (const [label, v, kind] of U14_SHAPE) {
    const e = uWriteErr(jsonToCsv(v), label);
    assert.deepEqual(Object.keys(e).sort(), ['kind', 'message', 'path'], `${label}：写侧 error 就这三格`);
    assert.equal(e.kind, kind, `${label}：kind 实读 ${e.kind}，期望 ${kind}`);
    assert.equal(e.path, '', `${label}：整份输入的毛病，Pointer 是空串`);
    assert.match(e.message, /对象数组|对象/, `${label}：要说清楚收什么形状，实读 ${e.message}`);
  }
  // `[]` 与 `[{}]` 是"没有列可写"，与"形状不对"分开两档：面板给的下一步不一样
  for (const v of [[], [{}], {}]) {
    assert.equal(uWriteErr(jsonToCsv(v)).kind, 'empty', `${JSON.stringify(v)} 应当落在 empty`);
  }
  for (const v of [42, 'x', null, [1, 2], true]) {
    assert.equal(uWriteErr(jsonToCsv(v)).kind, 'shape', `${JSON.stringify(v)} 应当落在 shape`);
  }

  const U14_BAD = [
    ['undefined 在格子里', [{ a: undefined }], '/0/a'],
    ['函数在格子里', { a: () => {} }, '/a'],
    ['NaN 在格子里', { a: NaN }, '/a'],
    ['+Infinity 在格子里', { a: Infinity }, '/a'],
    ['BigInt 在格子里', [{ a: 10n }], '/0/a'],
    ['Map 在格子里', { a: new Map() }, '/a'],
    ['Set 在格子里', { a: new Set() }, '/a'],
    ['非 Uint8Array 的 typed array', { a: new Int16Array([1]) }, '/a'],
    ['嵌套里的 undefined', { a: { b: undefined } }, '/a/b'],
    ['嵌套里的 NaN', [{ a: [NaN] }], '/0/a/0'],
  ];
  for (const [label, v, path] of U14_BAD) {
    const e = uWriteErr(jsonToCsv(v), label);
    assert.equal(e.kind, 'non-json', `${label}：kind 实读 ${e.kind}`);
    assert.equal(e.path, path, `${label}：Pointer 实读 ${JSON.stringify(e.path)}，期望 ${path}`);
    assert.match(e.message, /JSON/, `${label}：消息要点名"JSON 里装不下"`);
  }
  const cyc = { a: 1 }; cyc.self = cyc;
  const c = uWriteErr(jsonToCsv(cyc), '环');
  assert.equal(c.kind, 'cycle');
  assert.equal(c.path, '/self');
  const shared = { k: 1 };
  assert.equal(jsonToCsv({ x: shared, y: shared }).ok, true, 'DAG 不算环，与 YAML 那一族同一条判据（见 U8）');
  // 单元格里的嵌套深度借 §S 的 MAX_DEPTH 那一把尺，不另立第二个数
  const deepCell = uWriteErr(jsonToCsv({ a: uDeep(U_MAX_DEPTH) }), '单元格套 1000 层');
  assert.equal(deepCell.kind, 'depth', `实读 ${deepCell.kind}`);
  assert.match(deepCell.message, new RegExp(String(U_MAX_DEPTH)), '消息要点名上限');

  // 分隔符是"档位"不是"字符串"：与 §S 的 modeOf 同形，非法值当场编程错，不返回 error。
  // `undefined` 不在这一族里——面板的控件会把"没选"传成 undefined，那一格走默认逗号（下一格钉它）。
  for (const bad of ['', ',,', 'ab', '"', '\n', '\r', 42, null]) {
    assert.throws(() => jsonToCsv([{ a: 1 }], { delimiter: bad }), RangeError,
      `分隔符 ${JSON.stringify(bad)} 必须 RangeError`);
  }
  assert.equal(jsonToCsv([{ a: 1 }], { delimiter: undefined }).text, 'a\r\n1\r\n',
    '不传选项走逗号；显式传 undefined 也一样（面板的控件会把"没选"传成 undefined）');
  assert.throws(() => csvToJson('a', { delimiter: ',,' }), RangeError, '读侧的分隔符必须走同一条尺');
});

test('U15 读侧的 RFC 4180 五族：引号转义、内嵌换行、CRLF、BOM、尾行无换行', () => {
  const bomChar = String.fromCharCode(0xFEFF);
  // [档位, CSV 文本, 期望值]（meta 那一格归 U16，这一族只管"读回来的东西对不对"）
  const U15_ROWS = [
    ['基本一行', 'a,b\r\n1,2\r\n', [{ a: '1', b: '2' }]],
    ['引号里的分隔符算内容', 'a\r\n"x,y"\r\n', [{ a: 'x,y' }]],
    ['两连引号解成一个', 'a\r\n"a""b"\r\n', [{ a: 'a"b' }]],
    ['引号里的 LF 是内容', 'a\r\n"l1\nl2"\r\n', [{ a: 'l1\nl2' }]],
    ['引号里的 CRLF 也原样', 'a\r\n"l1\r\nl2"\r\n', [{ a: 'l1\r\nl2' }]],
    ['引号里的裸 CR 也原样', 'a\r\n"l1\rl2"\r\n', [{ a: 'l1\rl2' }]],
    ['尾行没有换行', 'a,b\r\n1,2', [{ a: '1', b: '2' }]],
    ['只有表头', 'a,b', []],
    ['LF 排版的文件', 'a,b\n1,2\n', [{ a: '1', b: '2' }]],
    ['CR 排版的文件（老 Mac）', 'a,b\r1,2\r', [{ a: '1', b: '2' }]],
    ['BOM 吃掉但值不变', bomChar + 'a,b\r\n1,2\r\n', [{ a: '1', b: '2' }]],
    ['短行补空串', 'a,b,c\r\n1\r\n', [{ a: '1', b: '', c: '' }]],
    ['中间的空行是一行', 'a\r\n1\r\n\r\n2\r\n', [{ a: '1' }, { a: '' }, { a: '2' }]],
    ['表头自己带引号', '"a""b",c\r\n1,2\r\n', [{ 'a"b': '1', c: '2' }]],
    ['表头空位给占位名', ',x\r\n1,2\r\n', [{ col_1: '1', x: '2' }]],
    ['重复表头追加序号', 'a,a,a\r\n1,2,3\r\n', [{ a: '1', a__2: '2', a__3: '3' }]],
    ['重复表头与空位混着来', 'a,,a\r\n1,2,3\r\n', [{ a: '1', col_2: '2', a__2: '3' }]],
    ['占位名撞上真名继续加序号', 'a,a__2,a\r\n1,2,3\r\n', [{ a: '1', a__2: '2', a__3: '3' }]],
    ['字段中间的裸引号容忍', 'a\r\nb"c\r\n', [{ a: 'b"c' }]],
    ['闭合引号后面还有字就拼上', 'a\r\n"x"y\r\n', [{ a: 'xy' }]],
    ['一对引号就是空串', 'a\r\n""\r\n', [{ a: '' }]],
    ['引号里就是一个换行', 'a\r\n"\n"\r\n', [{ a: '\n' }]],
    ['分号分隔', 'a;b\r\n1;2\r\n', [{ a: '1', b: '2' }], ';'],
    ['分号分隔里的逗号不算分隔符', 'a\r\n"x,y"\r\n', [{ a: 'x,y' }], ';'],
    ['行首空格是内容', 'a\r\n lead\r\n', [{ a: ' lead' }]],
    ['行尾空格是内容', 'a\r\ntrail \r\n', [{ a: 'trail ' }]],
    ['表头两侧空格也留着', ' a , b \r\n1,2\r\n', [{ ' a ': '1', ' b ': '2' }]],
    ['引号字段跨行之后仍对齐表头', 'a,b\r\n"x\ny",2\r\n', [{ a: 'x\ny', b: '2' }]],
    ['一行三格带空尾格', 'a,b,\r\n1,2,\r\n', [{ a: '1', b: '2', col_3: '' }]],
  ];
  for (const [label, text, want, delimiter] of U15_ROWS) {
    const r = delimiter === undefined ? csvToJson(text) : csvToJson(text, { delimiter });
    assert.deepStrictEqual(uRead(r, label), want, `${label}：值实读 ${JSON.stringify(r.value)}`);
  }

  // 写→读成对：本站自己写出去的三族（引号、内嵌换行、CRLF）读回来逐格等于原值
  const PAIRS = [
    [{ a: 'x,y' }, { a: 'b\nc' }],
    [{ a: 'say "hi"' }],
    [{ a: 'r1\r\nr2' }],
    [{ a: '列,与"引号"混排', b: '换\n行' }],
    [{ 名: '值', 空: '' }],
  ];
  for (const rows of PAIRS) {
    const label = `成对 ${JSON.stringify(rows).slice(0, 40)}`;
    assert.deepStrictEqual(uRead(csvToJson(uWrite(jsonToCsv(rows)), label), label), rows, label);
  }
  // 读→写的幂等：读一份合规 CSV 再写回去，逐字不变（面板"导入后重新导出"那条路）
  const IDEMPOTENT = ['a,b\r\n1,2\r\n', 'a\r\n"x,y"\r\n', 'a,b\r\n1,\r\n', '名字,x y\r\n1,2\r\n'];
  for (const text of IDEMPOTENT) {
    const back = uRead(csvToJson(text));
    assert.equal(uWrite(jsonToCsv(back)), text, `幂等实读 ${JSON.stringify(uWrite(jsonToCsv(back)))}`);
  }
  // 非法形状只有一档：分隔符（RangeError 见 U14），非字符串入参在 U9 钉过
});

test('U16 回读一律字符串、meta 六格与拒绝位置：形状与 U9 同一条口径', () => {
  const bomChar = String.fromCharCode(0xFEFF);
  const r = csvToJson('a,b\r\n1,2\r\n');
  assert.deepEqual(Object.keys(r).sort(), ['meta', 'ok', 'value'],
    'CSV 读侧成功是这三格：比 YAML/XML 多一个 meta，因为"几行几列、什么换行"是用户要看的');
  assert.deepEqual(Object.keys(r.meta).sort(), ['allStrings', 'bom', 'columns', 'delimiter', 'lineEnding', 'rows'],
    'meta 六格一个不多一个不少：面板直接读这几格，多一格就要改面板');
  assert.deepStrictEqual(r.meta, { rows: 1, columns: 2, delimiter: ',', allStrings: true, bom: false, lineEnding: 'crlf' },
    `meta 实读 ${JSON.stringify(r.meta)}`);

  // 一律字符串：这一条是 CSV 这一族的**全部代价**，面板那句 fidelity 说的就是它
  const mixed = uRead(csvToJson('s,n,b,z,e\r\n1,2.5,true,,\r\n'));
  assert.deepStrictEqual(mixed, [{ s: '1', n: '2.5', b: 'true', z: '', e: '' }],
    '看着像数字与布尔的一律是字符串，空格子也是');
  const stringy = uRead(csvToJson(uWrite(jsonToCsv([{ a: 1, b: true, c: null, d: { e: 1 } }]))));
  for (const [k, v] of Object.entries(stringy[0])) {
    assert.equal(typeof v, 'string', `${k} 那一格写出去再读回来是 ${typeof v}`);
  }
  // allStrings 是真话：拿一份什么花样都有的输入逐格验类型
  const wild = uRead(csvToJson('a,b\r\n"x""y",\r\n,1e3\r\n"l1\nl2",true\r\n'));
  assert.equal(wild.length, 3, '三行数据');
  for (const row of wild) {
    for (const [k, v] of Object.entries(row)) {
      assert.equal(typeof v, 'string', `${k} 那一格实读 ${typeof v}`);
    }
  }
  assert.equal(wild[0].a, 'x"y');
  assert.equal(wild[2].a, 'l1\nl2');

  // lineEnding 五档：由**实际出现过的**终止符决定，出现两种以上就是 mixed
  const LE = [
    ['全 CRLF', 'a,b\r\n1,2\r\n', 'crlf'],
    ['全 LF', 'a,b\n1,2\n', 'lf'],
    ['全 CR', 'a,b\r1,2\r', 'cr'],
    ['混着排', 'a,b\r\n1,2\n', 'mixed'],
    ['整份没有终止符', 'a,b', 'none'],
    ['只有一行表头也算 none', 'a', 'none'],
    ['引号里的换行不参与统计', 'a\r\n"x\ny"\r\n', 'crlf'],
    ['引号里的裸 CR 不参与统计', 'a\r\n"x\ry"\r\n', 'crlf'],
    ['尾行没有终止符不影响判定', 'a,b\r\n1,2', 'crlf'],
    ['BOM 不影响判定', bomChar + 'a,b\n1\n', 'lf'],
  ];
  for (const [label, text, want] of LE) {
    assert.equal(csvToJson(text).meta.lineEnding, want, `${label}：实读 ${csvToJson(text).meta.lineEnding}`);
  }
  // BOM 只认开头那一个；正文里出现的 U+FEFF 是内容
  assert.equal(csvToJson(bomChar + 'a\r\n1\r\n').meta.bom, true, '开头的 BOM 要报出来');
  assert.equal(uRead(csvToJson(bomChar + 'a\r\n1\r\n'))[0].a, '1', 'BOM 不进表头');
  const zws = String.fromCharCode(0xFEFF);
  assert.equal(csvToJson('a\r\n' + zws + 'x\r\n').meta.bom, false, '正文里的 U+FEFF 不是 BOM');
  assert.equal(uRead(csvToJson('a\r\n' + zws + 'x\r\n'))[0].a, zws + 'x', '它是内容，一个字符都不许丢');
  assert.equal(csvToJson('a;b\r\n1;2\r\n', { delimiter: ';' }).meta.delimiter, ';', 'meta 回显读的时候用的分隔符');
  assert.equal(csvToJson('a,b\r\n1,2\r\n').meta.delimiter, ',', '不传选项就是逗号');
  assert.equal(csvToJson('a,b\r\n1,2\r\n3,4\r\n').meta.rows, 2, 'rows 只数数据行，不含表头');
  assert.equal(csvToJson('a,b\r\n1,2\r\n').meta.columns, 2, 'columns 数的是表头格数');

  // 拒绝那一族：三档（empty / unterminated / ragged）+ 闸门两档，六格形状与位置口径同 U9
  const U16_ERR = [
    ['空文本', '', 'empty', 0, 1, 1],
    ['只有空白', '  \n ', 'empty', 4, 2, 2],
    ['只有终止符', '\r\n', 'empty', 2, 2, 1],
    // 两处都指认**那个没合上的引号自己**（不是它后面的内容，也不是 EOF）：面板把选区放到引号上才看得懂
    ['引号没合上', 'a\r\n"b', 'unterminated', 3, 2, 1],
    ['引号没合上（到 EOF）', 'a,b\n"c', 'unterminated', 4, 2, 1],
    ['多出来的格', 'a,b\r\n1,2,3\r\n', 'ragged', 9, 2, 5],
    ['多出来的格在跨行字段之后', 'a,b\r\n"x\ny",2,3\r\n', 'ragged', 13, 3, 6],
  ];
  for (const [label, text, kind, index, line, column] of U16_ERR) {
    const e = uReadErr(csvToJson(text), label);
    assert.deepEqual(Object.keys(e).sort(), ['column', 'index', 'kind', 'line', 'message', 'snippet'],
      `${label}：六格齐活（与 U9/U12 同一条口径）`);
    assert.equal(e.kind, kind, `${label}：kind 实读 ${e.kind}`);
    assert.equal(e.index, index, `${label}：index 实读 ${e.index}，期望 ${index}`);
    assert.equal(e.line, line, `${label}：行号实读 ${e.line}，期望 ${line}`);
    assert.equal(e.column, column, `${label}：列号实读 ${e.column}，期望 ${column}`);
    assert.deepStrictEqual(uLocate(text, e.index), { line: e.line, column: e.column },
      `${label}：行列必须由 index 推出来`);
    const rng = uLineRange(text, e.line);
    assert.equal(e.snippet, text.slice(rng.start, rng.end), `${label}：snippet 实读 ${JSON.stringify(e.snippet)}`);
    assert.equal(e.message.includes(`第 ${line} 行第 ${column} 列`), true, `${label}：消息要带行列`);
  }
  // 行号是**物理行**，不是"第几条记录"：上一格第三行那一档已经钉住了这件事。
  // ragged 只指认多出来的那一格，不去数前面有几格（消息里给期望与实际）
  const rag = uReadErr(csvToJson('a,b\r\n1,2,3\r\n'), 'ragged 的消息');
  assert.match(rag.message, /2/, `消息要给表头格数，实读 ${rag.message}`);
  assert.match(rag.message, /3/, `消息要给实际格数，实读 ${rag.message}`);

  // 闸门两档与 YAML/XML 走同一把尺，消息交回 core 的原话
  const tooLong = 'a,' + 'x'.repeat(U_JSON_BYTES);
  const gl = uReadErr(csvToJson(tooLong), 'CSV 超字节上限');
  assert.equal(gl.kind, 'too-long');
  assert.equal(gl.message, uGate(tooLong).message, '闸门消息只有一处口径');
  assert.equal(gl.index, tooLong.length);
  const tooMany = 'a,b\n'.repeat(U_LINES + 1);
  const gm = uReadErr(csvToJson(tooMany), 'CSV 超行数上限');
  assert.equal(gm.kind, 'too-many-lines');
  assert.equal(gm.message, uGate(tooMany).message);
  assert.equal(gm.index, tooMany.length);
  assert.deepStrictEqual(uLocate(tooMany, gm.index), { line: gm.line, column: gm.column }, '闸门那一档的行列也自洽');
});

test('U17 roundTrips：面板那三个 ✓ 读的就是这一格，判据与手工往返同结论', () => {
  // 这一格只服务面板上那三个"是否等价"读数，所以它的定义必须与 U6/U13/U15 的**手工往返**逐字一致：
  // 写侧不抛 && 写侧 ok && 读侧 ok && 深相等。任何一个条件单列出去，面板就会显示一个假 ✓。
  assert.deepEqual(Object.keys(roundTrips({})).sort(), ['csv', 'xml', 'yaml'], '三档，一档都不许多给');
  assert.deepEqual(roundTrips([{ a: '1', b: 'x' }]), { yaml: true, xml: true, csv: true },
    '全字符串的一行：三族都等价（CSV 里 "1" 本来就是串）');
  assert.deepEqual(roundTrips([{ a: 1 }]), { yaml: true, xml: true, csv: false },
    'CSV 没有类型：数字回来是字符串，所以 csv 必须 false——这不是缺陷，是这一族的代价');
  assert.deepEqual(roundTrips([{ a: { b: 1 } }]), { yaml: true, xml: true, csv: false },
    '嵌套压进单元格，回来是串');
  assert.deepEqual(roundTrips({ a: -0 }), { yaml: true, xml: true, csv: false },
    '负零只有 CSV 保不住：YAML 写 -0.0 读回 -0（U7 那格钉的是实测），本站的 XML 显式写 -0（U10），'
    + '而 CSV 那一格连类型都没有');
  assert.deepEqual(roundTrips([]), { yaml: true, xml: true, csv: false }, '空数组没有列名，CSV 写不出去');
  assert.deepEqual(roundTrips('hi'), { yaml: true, xml: true, csv: false }, '根是标量：CSV 只收对象与对象数组');
  const deep200 = uDeep(200);
  assert.deepEqual(roundTrips(deep200), { yaml: false, xml: true, csv: false },
    '200 层那一档：YAML 读侧撑不住（98 层），XML 撑得住（1000 层）——面板照实显示，不假装');
  assert.deepEqual(roundTrips(uWithProtoKey(1)).yaml, true, '__proto__ 那一格与 U6 同结论');
  assert.deepEqual(roundTrips(uWithProtoKey(1)).xml, true, '与 U13 同结论');

  // 非 JSON 入参：三个 false，且**不抛**——面板拿它做即时读数，抛一次就是整块面板空白
  const cyc = { a: 1 }; cyc.self = cyc;
  for (const v of [undefined, () => {}, Symbol('s'), 10n, NaN, Infinity, -Infinity, new Map(), new Set(), cyc]) {
    assert.deepEqual(roundTrips(v), { yaml: false, xml: false, csv: false },
      `${String(v?.toString ? v.toString() : v)}：roundTrips 不许抛，也不许给半个 ✓`);
  }

  // 与手工往返逐格一致：这一族是"实现不许自创第二套判定"的牙齿
  const CHECK = [
    {}, [], 'hi', 42, true, null, 0, -0, 1e21, { a: 1 }, { a: 'x' }, { a: [1, 2] },
    [{ a: 'x,y' }], [{ a: '1' }, { b: '' }], { a: { b: { c: '深' } } }, uDeep(98), uDeep(99),
    uWithProtoKey({ n: 1 }), { 键: '值' }, new Date('2024-01-01T00:00:00Z'),
  ];
  for (const v of CHECK) {
    const label = `一致性 ${JSON.stringify(v instanceof Date ? 'Date' : v).slice(0, 34)}`;
    const rt = roundTrips(v);
    assert.equal(rt.yaml, uRound(v, jsonToYaml, yamlToJson), `${label}：yaml 读数与手工往返不一致`);
    assert.equal(rt.xml, uRound(v, jsonToXml, xmlToJson), `${label}：xml 读数与手工往返不一致`);
    assert.equal(rt.csv, uRound(v, jsonToCsv, csvToJson), `${label}：csv 读数与手工往返不一致`);
  }
});

test('U18 常量、纯度与依赖边：三对互转只站在内置件与 json-core 上面', () => {
  assert.deepEqual(Object.keys(U_MOD).sort(), ['CSV_NOTES', 'XML_CONVENTION', 'YAML_DEPTH_LIMIT', 'YAML_LIB',
    'YAML_NOTES', 'csvToJson', 'jsonToCsv', 'jsonToXml', 'jsonToYaml', 'roundTrips', 'xmlToJson', 'yamlToJson'],
    '导出清单逐格钉住：多一格就是面板之外还有人能拿到内部件');
  // 版本串不许靠记忆：它必须与内置件首行 banner、与判据里的路径同源（U1/U2 钉的是文件，这一格钉的是字符串）
  assert.equal(YAML_LIB, 'js-yaml 5.4.2 (MIT) · dev/libJs/js-yaml.esm.min.mjs');
  const banner = read(YAML_LIB_PATH).split('\n', 1)[0];
  assert.equal(banner.includes(YAML_LIB.split(' ')[1]), true, `YAML_LIB 的版本与内置件 banner 不一致：${banner}`);
  assert.equal(YAML_LIB.includes(YAML_LIB_PATH), true, 'YAML_LIB 里的路径就是那一本文件');
  assert.equal(YAML_DEPTH_LIMIT, 98, '98 是实测出来的（见本节开头），改它要重跑二分，不许顺着消息里的 100 填');
  assert.equal(typeof XML_CONVENTION, 'string');
  assert.ok(XML_CONVENTION.length > 30 && XML_CONVENTION.length < 200,
    `XML_CONVENTION 是面板上的一句话（${XML_CONVENTION.length} 字），长过这一档就该拆进 help 而不是堆在面板`);
  for (const word of ['item', 't=']) assert.ok(XML_CONVENTION.includes(word), `那句话要提到 ${word}，实读 ${XML_CONVENTION}`);
  assert.deepEqual(Object.keys(YAML_NOTES).sort(), ['ambiguous', 'date']);
  assert.deepEqual(Object.keys(CSV_NOTES).sort(), ['fidelity']);
  assert.match(YAML_NOTES.ambiguous, /布尔|yes/i);
  assert.match(YAML_NOTES.date, /日期|时间/);
  assert.match(CSV_NOTES.fidelity, /字符串/, 'fidelity 那句必须明说"回来一律字符串"，否则 csv 的 false 读数没人解释');

  // 纯度：浏览器里跑的纯计算，不读环境、不外包转义与解析
  const code = uCode();
  for (const banned of ['document.', 'window.', 'localStorage', 'process.', 'Buffer', 'TextEncoder',
    'fetch(', 'require(', 'atob(', 'btoa(', 'JSON.parse', 'JSON.stringify', 'DOMParser', 'XMLSerializer',
    'eval(', 'new Function']) {
    assert.equal(code.includes(banned), false, `json-convert 不许出现 ${banned}：纯计算、不读环境、转义与解析都不外包`);
  }
  // 依赖边只有两把：内置件 + json-core；面板与 DOM 那一族一概不碰（§W 才接）
  const imports = [...code.matchAll(/^import .*$/gm)].map((m) => m[0]);
  assert.equal(imports.length, 2, `只许两本依赖，实读 ${JSON.stringify(imports)}`);
  assert.equal(imports.some((s) => s.includes('libJs/js-yaml')), true, 'YAML 走内置件');
  assert.match(code, /from '.\/json-core\.js'/);
  const names = /import \{([^}]*)\} from '\.\/json-core\.js'/m.exec(code)[1]
    .split(',').map((s) => s.trim()).filter(Boolean).sort();
  assert.deepEqual(names, ['INDENT_MODES', 'MAX_DEPTH', 'escapeText', 'gate', 'lineRange', 'locate', 'pointerChild'],
    `借的那几把尺逐格钉住，实读 ${JSON.stringify(names)}——多借一格就该先加判据`);
  // 深度只有一把尺：本站的 XML 两向都吃 MAX_DEPTH，不许写一个字面量 1000
  assert.equal(code.includes('1000'), false, `出现字面量 1000 就是自创了第二把深度尺：借 MAX_DEPTH`);
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

### 落地那一格的两个 commit 号（补记 2026-09-29，写在这里免得对账时找不到）

Task 1 落 `0340cd5`、Task 2 落 `a81b025`（都在 `main` 上，尚未推送）。本格当时只把命令写进了计划，
没记 hash——而段 4 后面每一格的"HEAD 导出树"都指着某一个 hash，事后不记就等于下一格拿不到可复现的基线。
Task 3 落 `21d1c5c`，往后各格一律在这一节续一行。
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

### 契约留白处定下来的六格口径（§T 的判据逐条钉住，实现期别再自创）

1. **键名给出的那格名字用在元素上**，不是用在数组上：`users: RootUsers[]`，声明叫 `RootUsers`。
   只有数组套数组与根数组没有键名可用，才追加 `Item`（`[{a:1}]` → `RootItem`、`[[{z}]]` → `RootXsItem`）。
   追加过 `2`、`3` 的那一格，它的孩子跟着**声明出去的名字**走（`RootAB2` 里的数组元素叫 `RootAB2M`），
   父子链要能在 `text` 里连得上——T5 拿一条 `assert.match` 钉这一格。
2. **一个数组只有一个元素槽**：`[[1,'x'],[true]]` 的两层元素并成一份形状，得到
   `(boolean | number | string)[][]`，不是 `(boolean | (number | string)[] | …)`。并集按"槽"算，
   不按"某一条样本"算——这一条决定了 `names` 的条数与键序都可复算。
3. **括号只在顶层并集那一档加**（`exprOf` 交回 `{text, atomic}`）：`(number | string)[]` 自己就是原子，
   挂第二层 `[]` 不再套括号。按"串里有没有竖线"判会得到 `((number | string)[])[]`——
   同一个东西的啰嗦写法，而读它的人是把 text 复制走的那位。
4. **一格样本都没落到就交回 `unknown`**（空数组、空数组的元素槽）：拼成 `a: []` 也是合法 TS，
   但它长得像推断出来的结果，而推断这一格什么都没看到。
5. **缩进最多给到 32 层**（`INDENT_LEVEL_CAP`）：1000 层内联对象按层缩进会把输出撑到百万字节，
   而那是排版问题不是类型问题——括号还在、行还在，只是不再往右挪。
6. **不做结构相等合并、不改英文单复数、不合成索引签名**：三样都是超出样本的断言。
   索引签名那一格由 `notes` 第三句说清，不靠类型替你猜。

- [x] **Step 1：§T 十条红** —— `scripts/toolkit-tests.mjs` 末尾追加一整节
  （首行是顶格的 `// ── §T …`，`SEG_MARK` 才切得出来）。红长成文件级那一行
  `not ok 1 - scripts/toolkit-tests.mjs`，报错正文是
  `ERR_MODULE_NOT_FOUND: Cannot find module '…/dev/js/tools/json-ts.js'`，排在它之前注册的 293 条照跑照绿
  ——本文件头交代过："模块还没落地"这一档没有 `not ok T1 …` 那样的行，按用例名去锚是锚错了层。
- [x] **Step 2：绿** —— `dev/js/tools/json-ts.js` 落地，三趟各管一段：`buildShape`（显式栈、孩子**倒序入栈**，
  出栈即文档顺序，键序与 interface 出场序都从这一趟来）→ `assignNames`（先序占名，只有会出 interface 的槽参与）
  → `render`（排版）。途中改过两处实现缺陷：① 空数组也建了元素槽，那格 kindless 的槽拼出 `a: []`
  （合法但说谎），改成不建槽并在 `exprOf` 兜 `unknown`；② 括号按"串里有没有竖线"判，多套一层，
  换成 `{text, atomic}`。判据同步修了一处**样本本身写错**：原本拿 `[[1,'x'],[true]]` 断"数组里并了标量"，
  但那两个元素都是数组、标量在第二层，换成 `[[1,'x'], true]` 才是那一档；前者留着钉第 2 条那个合并口径。
- [x] **Step 3：镜像 + 门禁 + 提交** —— 两块 `js` 围栏整块镜像贴进本节（内容由磁盘生成，事后 `--fix` 复验全等）、
  `FILE_TARGETS` 登记 `dev/js/tools/json-ts.js`、门禁六道按 §0.7 的口径跑，提交
  「feat(tools): 段 4 Task 3 json-ts——六类样本的 interface 生成，并集与可选键口径钉死（§T）」。

### 落地镜像（门禁二核的就是这两块，`--fix` 会把它们整块换成磁盘内容）

两块都是**磁盘全文**，用 `js` 围栏（§0.6 的硬规矩：只有整文件与整节镜像允许 `js`，契约段一律 `text`）。
Task 3 落地时（2026-09-29）这两块是新贴的；同一格里磁盘 `toolkit-tests.mjs` 的**文件头用例分布表**也跟着
更新了（§U/§S/§T 三行与"合计 303"），那一块镜像在段 1 那份计划里，由导出树的 `--fix` 同步——
表过期这件事本身是文件头那条"改表而不是改口径"的账。

#### `dev/js/tools/json-ts.js`（整文件）

```js
/**
 * JSON 样本 → TypeScript 类型（段 4 Task 3；设计文档 §5.3 的「JSON → TypeScript interface」）。
 *
 * 这一本只管一件事：**样本给了什么就读出什么，一个字都不多猜**。三条口径先钉在这儿：
 *   · 同一个槽上的多个对象**并成一份形状**——键按首次出现的顺序排，缺席过的那些键打 `?`；
 *   · 具名 `interface` 只给**数组元素**里的对象（`users: RootUsers[]`），其余对象一律内联。
 *     键名给出的是**元素**的名字（不是数组的名字），所以数组套数组、根数组这两档没有键名可用，
 *     才追加 `Item`；
 *   · 并集成员按档排：标量 → 数组 → 具名 interface → 内联对象 → `null`，同档内按渲染串升序。
 *     排序不看样本顺序，是因为 `text` 要给人复制走——同一份数据换个键序粘进来不该得到另一个文件。
 *
 * 三处**故意不做**的事，都不是遗漏：
 *   · 不给带引号的键合成 `[key: string]: T` 索引签名。键名是数据（`{"zh": …, "en": …}`）的时候，
 *     合成一条索引签名就把"样本里出现过这两个键"说成了"任意键都行"，那是超出样本的断言；
 *     这件事由 `notes` 里那句话说清，而不是由类型替你猜。
 *   · 不按结构相等合并 interface。两个槽形状一样但名字不同，就出两份声明——"结构相等"和"同一个槽"
 *     根本不是一回事，合并要引入一个判据兜不住的推断，宁可让输出重复。
 *   · 不猜单数。`users: RootUsers[]` 的元素接口就叫 `RootUsers`，不改写成 `RootUser`；
 *     英文单复数变化不规则，规则化的那一步必然出错。
 *
 * 深度与环：形状收集走**显式栈**（`buildShape`），到 `MAX_DEPTH` 那一格就停并把该格交回 `unknown`。
 * 深度闸门只有 `json-core.js` 那一个口径，这一本不再设第二道；调用方拿到的一定是 `parseJson`
 * 肯放行的输入（≤1000 层），而手工传进来的环也只会走到同一格停。
 * `T10` 量的就是这两条：1000 层必须一层不落全渲染出来，环不许把输出撑爆。
 *
 * 渲染递归的深度等于形状的层数（同样 ≤1001），比解析器的输入规模小三个数量级，所以这一趟留成递归；
 * 缩进按层给，但最多给到 `INDENT_LEVEL_CAP` 层——一千层缩进没有可读性可言，而它会把输出撑到百万字节。
 * 停在三十层是**排版**决定，不是类型推断：括号还在、行还在，只是不再往右挪。
 *
 * 纯度：不读环境、不写状态、不改入参；转义外包给 `json-core.js` 的 `escapeText`（本站只有一套
 * 「串怎么变成字面量」），除此之外这文件只 import 那一本的三个名字。
 */
import { INDENT_MODES, MAX_DEPTH, escapeText } from './json-core.js';

/** 输出块顶部那一句：面板把它逐字写在第一行注释上，§W 不再自己编一句 */
export const TS_HEADER_NOTE = '以下类型是按你给的这一份样本推断的，不是 schema：样本里没有的键、没出现过的元素类型，它都不保证。';

/** 名字长度上限。截断只管**派生出来的那一段**，冲突追加的 2、3 在截断之后，所以最长 48+2 */
const MAX_NAME_LEN = 48;
/** 缩进最多给到这一层，见文件头「排版决定」那一句 */
const INDENT_LEVEL_CAP = 32;
const IDENT_OK = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const INDENTS = { two: '  ', four: '    ', tab: '\t' };

const NOTE_UNION = '出现过 `|` 的地方都是样本给的并集：换一份样本就可能多一个成员，用它之前先确认取值范围。';
const NOTE_OPTIONAL = '标了 `?:` 的键在样本里不是每条都有：它是“可能有”，不是“一定没有”。';
const NOTE_QUOTED = '带引号的键本站不合成 `[key: string]` 索引签名：键名本身是数据的时候，取值请自己收窄。';

/**
 * 键名 → 可当 interface 名那一段用的标识符。**只改名，不改义**：`renamed` 与 `reason` 是同一件事
 * 的两半，面板要说「这个名字是我改出来的」就得同时拿到这两格。
 *
 * 口径：非字母数字一律当分隔符切段、每段首字母大写、拼起来；结果以数字开头就补一个 `_`；
 * 切完什么都不剩（空串、纯符号、纯非 ASCII）就交回 `Unnamed`；超过 48 字符截断。
 * 两档同时成立时报「超长截断」——截断是不可逆的那一步，先说它。
 *
 * @param {string} raw 键名或调用方给的 root
 * @returns {{name: string, renamed: boolean, reason: ''|'空串'|'超长截断'|'首字母改大写'|'非法字符改写'}}
 *   `name` 永远是合法标识符；`reason` 为空当且仅当 `renamed === false`（也就是 `name === raw`）
 */
export function toInterfaceName(raw) {
  if (typeof raw !== 'string') {
    throw new TypeError(`toInterfaceName 只收字符串，收到的是 ${raw === null ? 'null' : typeof raw}`);
  }
  if (raw === '') return { name: 'Unnamed', renamed: true, reason: '空串' };
  const words = raw.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  let name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  if (name === '') return { name: 'Unnamed', renamed: true, reason: '非法字符改写' };
  if (name.charAt(0) >= '0' && name.charAt(0) <= '9') name = `_${name}`;
  if (name.length > MAX_NAME_LEN) return { name: name.slice(0, MAX_NAME_LEN), renamed: true, reason: '超长截断' };
  if (name === raw) return { name, renamed: false, reason: '' };
  const caseOnly = name.length === raw.length && name.toLowerCase() === raw.toLowerCase();
  return { name, renamed: true, reason: caseOnly ? '首字母改大写' : '非法字符改写' };
}

/** 缩进三档只有一把尺，认不认由 `INDENT_MODES` 说了算（消息点名常量名，好让人顺着找到定义处） */
const indentOf = (mode) => {
  if (!INDENT_MODES.includes(mode)) {
    throw new RangeError(`generateTs 的 indent 只认 INDENT_MODES 里的那几档：${INDENT_MODES.join(' | ')}`);
  }
  return INDENTS[mode];
};

/** 样本给的七种格。`unknown` 不是"猜不出来"，是"这东西根本不在 JSON 里"（函数、symbol、undefined、bigint） */
const kindOf = (v) => {
  if (v === null) return 'null';
  const t = typeof v;
  if (t === 'boolean' || t === 'number' || t === 'string') return t;
  if (Array.isArray(v)) return 'array';
  if (t === 'object') return 'object';
  return 'unknown';
};

const mkNode = () => ({
  kinds: new Set(),
  keys: new Map(),
  order: [],
  objects: 0,
  item: null,
  name: '',
  iface: '',
});

/**
 * 值 → 形状图：一个槽一个节点，同槽的多个对象并键、多个数组元素并元素。
 *
 * 显式栈，孩子**倒序入栈**，于是出栈顺序就是文档顺序——键序与 interface 的出场序都从这一趟来，
 * 正序入栈会得到一份"后面的样本先说话"的键序，那是遍历方式的产物，不是数据的形状。
 *
 * @param {unknown} value
 * @returns {object} 根槽节点
 */
const buildShape = (value) => {
  const root = mkNode();
  const stack = [{ v: value, n: root, d: 0 }];
  while (stack.length) {
    const { v, n, d } = stack.pop();
    if (d > MAX_DEPTH) {
      n.kinds.add('unknown');
      continue;
    }
    const kind = kindOf(v);
    n.kinds.add(kind);
    if (kind === 'object') {
      n.objects += 1;
      const keys = Object.keys(v);
      const kids = [];
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        let slot = n.keys.get(key);
        if (slot === undefined) {
          slot = { child: mkNode(), hits: 0 };
          n.keys.set(key, slot);
          n.order.push(key);
        }
        slot.hits += 1;
        kids.push(v[key]);
      }
      for (let i = kids.length - 1; i >= 0; i -= 1) stack.push({ v: kids[i], n: n.keys.get(keys[i]).child, d: d + 1 });
    } else if (kind === 'array') {
      // 空数组不建元素槽：没有元素就没有"元素的样子"，让渲染那一趟直接交回 unknown
      if (v.length > 0 && n.item === null) n.item = mkNode();
      for (let i = v.length - 1; i >= 0; i -= 1) stack.push({ v: v[i], n: n.item, d: d + 1 });
    }
  }
  return root;
};

/** 派生名一律截到 48，链条（数组套数组）不许把命名基准撑成无限长 */
const cut = (base) => (base.length > MAX_NAME_LEN ? base.slice(0, MAX_NAME_LEN) : base);

/**
 * 形状图 → 名字。先序走一遍，只有**会出 interface 的槽**（数组元素槽里带 object 的那些）参与占名，
 * 所以 `{ xs: [[{ z: 1 }]] }` 里 `RootXs` 从来没被声明过，它只是下一层 `RootXsItem` 的命名基准。
 *
 * @param {object} root 根槽
 * @param {string} rootName 已经过 `toInterfaceName` 的根名
 * @returns {Array<{name: string, n: object}>} 声明块的出场顺序，`names` 就是它的名格
 */
const assignNames = (root, rootName) => {
  const used = new Set([rootName]);
  const claim = (base) => {
    const stem = cut(base);
    let name = stem;
    for (let k = 2; used.has(name); k += 1) name = `${stem}${k}`;
    used.add(name);
    return name;
  };
  const decls = [];
  root.name = rootName;
  if (root.kinds.has('object')) {
    root.iface = rootName;
    decls.push({ name: rootName, n: root });
  }
  const stack = [{ n: root, name: rootName, origin: 'root' }];
  while (stack.length) {
    const { n, name, origin } = stack.pop();
    n.name = name;
    // 追加过 2、3 的那一格，孩子跟着**声明出去的名字**走：读 text 的人看到的父亲是 RootAB2，
    // 那么它里面的数组元素就该叫 RootAB2M，跟着命名基准走会断掉这条可见的父子链
    let basis = name;
    if (origin === 'item' && n.kinds.has('object')) {
      n.iface = claim(name);
      basis = n.iface;
      decls.push({ name: n.iface, n });
    }
    const kids = [];
    for (const key of n.order) {
      kids.push({ n: n.keys.get(key).child, name: cut(`${basis}${toInterfaceName(key).name}`), origin: 'prop' });
    }
    if (n.item !== null) {
      // 键名给出的那格名字用在**元素**上；只有数组套数组与根数组没有键名，才追加 Item
      kids.push({ n: n.item, name: origin === 'prop' ? basis : cut(`${basis}Item`), origin: 'item' });
    }
    for (let i = kids.length - 1; i >= 0; i -= 1) stack.push(kids[i]);
  }
  return decls;
};

/**
 * 值形状 → 类型文本。三趟各管一段：`buildShape` 只管"样本给了什么"，`assignNames` 只管"叫什么"，
 * 这一趟只管"怎么排版"——分开放，是因为逐字相等的判据全在排版这一层，命名口径变了不该碰它。
 *
 * @param {object} root 根槽（已由 `assignNames` 写好 `name` 与 `iface`）
 * @param {string} rootName
 * @param {string} unit 缩进单位
 * @returns {{text: string, names: string[], notes: string[]}}
 */
const render = (root, rootName, unit) => {
  const flags = { union: false, optional: false, quoted: false };
  const pad = (level) => unit.repeat(Math.min(level, INDENT_LEVEL_CAP));

  /** 键名要不要加引号：属性位置连 `class`、`if` 都能直写，剩下不行的只有非法标识符那一种 */
  const keyText = (key) => {
    if (IDENT_OK.test(key)) return key;
    flags.quoted = true;
    return `"${escapeText(key)}"`;
  };

  const memberLines = (n, level) => {
    const lines = [];
    for (const key of n.order) {
      const slot = n.keys.get(key);
      const optional = n.objects > slot.hits;
      if (optional) flags.optional = true;
      lines.push(`${pad(level)}${keyText(key)}${optional ? '?' : ''}: ${typeExpr(slot.child, level)};`);
    }
    return lines;
  };

  /** 内联对象：开括号跟着成员那一格，闭合退回成员上一层 */
  const inlineObject = (n, level) => {
    const lines = memberLines(n, level + 1);
    if (lines.length === 0) return '{}';
    return `{\n${lines.join('\n')}\n${pad(level)}}`;
  };

  /**
   * 一格的类型表达式。`atomic` 只回答一个问题：**后面要挂 `[]` 的时候要不要先括起来**——
   * 顶层是并集才要括，标量、具名、内联对象、数组（`X[]` 自己就是原子）都不要。
   * 用串里有没有 `|` 来判会多套一层括号：`(number | string)[][]` 才是 `(number|string)[]` 的数组，
   * 而 `((number | string)[])[]` 是同一个东西的啰嗦写法，读它的人是复制走的那位。
   *
   * @param {object} n
   * @param {number} level
   * @returns {{text: string, atomic: boolean}}
   */
  const exprOf = (n, level) => {
    const atoms = [];
    for (const scalar of ['boolean', 'number', 'string', 'unknown']) {
      if (n.kinds.has(scalar)) atoms.push({ rank: 0, text: scalar });
    }
    if (n.kinds.has('array')) {
      const inner = n.item === null ? { text: 'unknown', atomic: true } : exprOf(n.item, level);
      atoms.push({ rank: 1, text: inner.atomic ? `${inner.text}[]` : `(${inner.text})[]` });
    }
    if (n.kinds.has('object')) {
      atoms.push(n.iface === '' ? { rank: 3, text: inlineObject(n, level) } : { rank: 2, text: n.iface });
    }
    if (n.kinds.has('null')) atoms.push({ rank: 4, text: 'null' });
    // 一格样本都没落到过（数组是空的）就交回 unknown：返回空串会拼成 `a: [];` 那样
    // **合法但说谎**的东西，而它看起来像是从样本推断出来的
    if (atoms.length === 0) return { text: 'unknown', atomic: true };
    if (atoms.length === 1) return { text: atoms[0].text, atomic: true };
    atoms.sort((a, b) => a.rank - b.rank || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0));
    flags.union = true;
    return { text: atoms.map((a) => a.text).join(' | '), atomic: false };
  };

  const typeExpr = (n, level) => exprOf(n, level).text;

  const interfaceBlock = (name, n) => {
    const lines = memberLines(n, 1);
    return lines.length === 0 ? `interface ${name} {}` : `interface ${name} {\n${lines.join('\n')}\n}`;
  };

  const decls = assignNames(root, rootName);
  const blocks = [];
  if (root.iface === '') blocks.push(`type ${rootName} = ${typeExpr(root, 0)};`);
  for (const decl of decls) blocks.push(interfaceBlock(decl.name, decl.n));

  const notes = [];
  if (flags.union) notes.push(NOTE_UNION);
  if (flags.optional) notes.push(NOTE_OPTIONAL);
  if (flags.quoted) notes.push(NOTE_QUOTED);
  return {
    text: [`// ${TS_HEADER_NOTE}`, ...blocks].join('\n\n'),
    names: decls.map((d) => d.name),
    notes,
  };
};

/**
 * 样本值 → 一份可复制的 TypeScript 文本。
 *
 * 只读不改：入参一个属性都不动（`T10` 拿一份深拷贝对拍这一条）。坏入参只有两档会抛——
 * `undefined`（它不是 JSON 值，静默推断成 `unknown` 只会让人以为是样本给的）与认不出的模式/根名。
 *
 * @param {unknown} value 通常是 `parseJson` 交回来的 `value`，也可以是手工造的对象
 * @param {{root?: string, indent?: 'two'|'four'|'tab'}} [options] `root` 默认 `Root`，`indent` 默认 `two`
 * @returns {{text: string, names: string[], notes: string[]}}
 *   `text` 是注释头 + 声明块（块间空一行、结尾不留换行）；`names` 是 interface 的出场顺序
 *   （根那一格若是 `type` 别名就不在里面）；`notes` 是并集 / 可选键 / 索引签名三句**该说的时候**才说的话
 */
export function generateTs(value, options = {}) {
  if (value === undefined) throw new TypeError('generateTs 不收 undefined：它不是 JSON 值，交回 unknown 只会让人以为是样本给的');
  const { root = 'Root', indent = 'two' } = options === null || typeof options === 'object' ? options : {};
  if (typeof root !== 'string') throw new TypeError(`generateTs 的 root 只收字符串，收到的是 ${root === null ? 'null' : typeof root}`);
  return render(buildShape(value), toInterfaceName(root).name, indentOf(indent));
}
```

#### `scripts/toolkit-tests.mjs` §T（整节）

```js
// ── §T interface 生成（tools/json-ts.js，段 4 Task 3）─────────────────────────
// 这一节钉的是"从样本推断出来的类型长成什么样"。`text` 是要给人复制走的东西，所以它按**逐字相等**来断，
// 不按"看起来像 TS"来断——一个缩进、一对括号、一处 `?:` 换了位置，复制出去的文件就归别人 debug 了。
// 三格返回各有各的口径：
//   · `text` = 一行注释（`TS_HEADER_NOTE`）+ 空行 + 若干声明块，块之间空一行，**结尾不留换行**；
//   · `names` = 具名 interface 的出场顺序（根那一格若是 `type Root = …` 就不在里面）；
//   · `notes` = 并集 / 可选键 / 索引签名三句**该说的时候**才说的话，句子里不许带计数器
//     （带了就得再钉一遍"数的是什么"，而这里三句都只是"这类形状怎么读"，不是样本统计）。
// 命名口径只有一套，写死在这里，实现不许自创第二套：
//   · 数组元素里的对象 → 具名接口 `父名 + PascalCase(键名)`；**键名给出的是元素的名字**
//     （`users: RootUsers[]`，接口叫 `RootUsers`），只有数组套数组与根数组没有键名，才追加 `Item`；
//   · 同名冲突按出场顺序追加 2、3……一个槽一份声明，形状相同也不合并（合并要做结构相等判断，
//     而"结构相等"和"同一个槽"根本不是一回事，宁可让输出重复）；
//   · 其余对象一律内联；内联对象里出现的数组，它的元素照样按"父名 + 键名"提升成具名接口。
// 并集成员的排序按档来：标量 → 数组 → 具名 interface → 内联对象 → null，同档内按渲染串升序。
// 这条把设计文档 §5.3 的"JSON → TypeScript interface"拆成了可断的格子：嵌套、数组、联合、null、
// 可选键五样都在 T1–T8 里各有一次逐字相等；T9 管参数口径，T10 管纯度与兜底。
const { TS_HEADER_NOTE, toInterfaceName, generateTs } = await import('../dev/js/tools/json-ts.js');

/** 剥注释扫源码：这一族的禁令跟 §S 同形，扫的是代码不是注释里的自我声明 */
const tCode = () => read('dev/js/tools/json-ts.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** 只要声明部分：注释头 + 那个空行是所有形状共有的开头，剥掉它才好逐块写逐字相等 */
const tBody = (text) => {
  const head = `// ${TS_HEADER_NOTE}\n\n`;
  if (!text.startsWith(head)) throw new Error(`text 的开头不是"注释 + 空行"那一格：${JSON.stringify(text.slice(0, 40))}`);
  return text.slice(head.length);
};
const tOf = (value, options) => generateTs(value, options).text;

test('T1 三格返回的逐字形状：注释头、块序、names 出场顺序、notes 只说该说的', () => {
  const v = { users: [{ id: 1, name: 'a', nick: 'n' }, { id: 2, name: 'b' }], total: 3, tags: ['x', 'y'], ok: true };
  const out = generateTs(v);
  assert.equal(out.text, [
    `// ${TS_HEADER_NOTE}`,
    '',
    'interface Root {',
    '  users: RootUsers[];',
    '  total: number;',
    '  tags: string[];',
    '  ok: boolean;',
    '}',
    '',
    'interface RootUsers {',
    '  id: number;',
    '  name: string;',
    '  nick?: string;',
    '}',
  ].join('\n'), '行序、缩进、分号、空行一格都不许改');
  assert.ok(!out.text.endsWith('\n'), '结尾不留换行：复制框里多出来的那个空行也要算进字节');
  assert.deepEqual(out.names, ['Root', 'RootUsers'], 'names 就是声明块的出场顺序，跟 text 里的顺序一致');
  assert.equal(out.notes.length, 1, '这里只有"可选键"该说话：没并集、没引号键');
  assert.match(out.notes[0], /不是每条都有/);
  assert.match(TS_HEADER_NOTE, /样本/, '顶部那句得说清"这是按样本推断的"，不是 schema');
  assert.ok(!/[\r\n]/.test(TS_HEADER_NOTE), '那句注释必须是单行，不然 T1 的行序就不是上面这个形状了');
  assert.equal(tBody(tOf(v)).split('\n\n').length, 2, '两个声明块之间恰好一个空行');
});

test('T2 toInterfaceName 的六档：renamed 与 reason 是同一件事的两半', () => {
  assert.deepEqual(toInterfaceName('Root'), { name: 'Root', renamed: false, reason: '' });
  assert.deepEqual(toInterfaceName('users'), { name: 'Users', renamed: true, reason: '首字母改大写' });
  assert.deepEqual(toInterfaceName('orderID'), { name: 'OrderID', renamed: true, reason: '首字母改大写' });
  assert.deepEqual(toInterfaceName('a-b'), { name: 'AB', renamed: true, reason: '非法字符改写' });
  assert.deepEqual(toInterfaceName('1st'), { name: '_1st', renamed: true, reason: '非法字符改写' });
  assert.deepEqual(toInterfaceName('中文'), { name: 'Unnamed', renamed: true, reason: '非法字符改写' });
  assert.deepEqual(toInterfaceName('$ok'), { name: 'Ok', renamed: true, reason: '非法字符改写' });
  assert.deepEqual(toInterfaceName(''), { name: 'Unnamed', renamed: true, reason: '空串' });
  const long = toInterfaceName('x'.repeat(60));
  assert.deepEqual([long.name.length, long.renamed, long.reason], [48, true, '超长截断']);
  assert.equal(long.name, `X${'x'.repeat(47)}`);
  // 四格自洽：renamed 当且仅当名字与原串不等；reason 空当且仅当没改名；名字永远是合法标识符
  for (const raw of ['Root', 'users', 'a-b', '', '1st', '中文', 'z'.repeat(70), '$ok', '_A1']) {
    const r = toInterfaceName(raw);
    assert.equal(r.renamed, r.name !== raw, `${raw} 的 renamed 与 name 对不上`);
    assert.equal(r.reason === '', !r.renamed, `${raw} 的 reason 与 renamed 分叉了`);
    assert.match(r.name, /^[A-Za-z_$][A-Za-z0-9_$]*$/, `${raw} → ${r.name} 不是合法标识符`);
  }
  for (const bad of [42, null, undefined, {}, [], true]) {
    assert.throws(() => toInterfaceName(bad), TypeError, `${typeof bad} 该抛 TypeError`);
  }
});

test('T3 键名要不要加引号：合法标识符与保留字都直写，其余双引号带转义', () => {
  const v = {
    ok: 1, $a: 2, _b: 3, '1st': 4, 'a-b': 5, 'a b': 6, '': 7, 中文: 8,
    class: 9, if: 10, 'a"b': 11, 'a\\b': 12, 'a\nb': 13, 'a\u0001b': 14, '\ud800': 15,
  };
  const out = generateTs(v);
  assert.equal(tBody(out.text), [
    'interface Root {',
    '  ok: number;',
    '  $a: number;',
    '  _b: number;',
    '  "1st": number;',
    '  "a-b": number;',
    '  "a b": number;',
    '  "": number;',
    '  "中文": number;',
    '  class: number;',
    '  if: number;',
    '  "a\\"b": number;',
    '  "a\\\\b": number;',
    '  "a\\nb": number;',
    '  "a\\u0001b": number;',
    '  "\\ud800": number;',
    '}',
  ].join('\n'), '属性位置允许保留字：`class`、`if` 不加引号；数字开头与空白与引号都只能加引号');
  assert.equal(out.notes.length, 1, '只有"索引签名"那一句该说');
  assert.match(out.notes[0], /索引签名/);
  const code = tCode();
  assert.match(code, /escapeText\(/, '转义外包给 json-core 的 escapeText：本站只有一套"串怎么变成字面量"');
});

test('T4 数组的三档：同构 T[]、异构 (A | B)[] 稳定升序、空数组 unknown[]', () => {
  assert.equal(tBody(tOf({ a: [1, 2] })), 'interface Root {\n  a: number[];\n}');
  assert.equal(tBody(tOf({ a: [1, 'x'] })), 'interface Root {\n  a: (number | string)[];\n}');
  assert.equal(tOf({ a: ['x', 1] }), tOf({ a: [1, 'x'] }), '等价输入必须给同一串：并集不跟着样本顺序走');
  assert.equal(tBody(tOf({ a: [null, 1, true, 'x', null] })),
    'interface Root {\n  a: (boolean | number | string | null)[];\n}', 'null 永远排在并集最后，其余按类型名升序');
  assert.equal(tBody(tOf({ a: [null] })), 'interface Root {\n  a: null[];\n}', '只有 null 时它就是那一个成员，不写成 unknown');
  assert.equal(tBody(tOf({ a: [] })), 'interface Root {\n  a: unknown[];\n}', '空数组没有样本可推断');
  assert.equal(tBody(tOf({ a: [[]] })), 'interface Root {\n  a: unknown[][];\n}');
  assert.equal(tBody(tOf({ a: [[1, 'x'], true] })),
    'interface Root {\n  a: (boolean | (number | string)[])[];\n}', '数组里并了标量：内层括号是元素自己的，外层括号是数组要的');
  assert.equal(tBody(tOf({ a: [[1, 'x'], [true]] })),
    'interface Root {\n  a: (boolean | number | string)[][];\n}',
    '一个数组只有一个元素槽：两层元素的形状并成一份，括号只在该并集的时候才加');
  assert.match(generateTs({ a: [1, 'x'] }).notes[0], /并集/);
});

test('T5 提升只发生在数组元素：键名给元素命名，冲突追加 2，内联对象里的数组照样提升', () => {
  const v = { aB: [{ q: 1 }], 'a-b': [{ r: 2 }], xs: [[{ z: 1 }]] };
  assert.equal(tBody(tOf(v)), [
    'interface Root {',
    '  aB: RootAB[];',
    '  "a-b": RootAB2[];',
    '  xs: RootXsItem[][];',
    '}',
    '',
    'interface RootAB {',
    '  q: number;',
    '}',
    '',
    'interface RootAB2 {',
    '  r: number;',
    '}',
    '',
    'interface RootXsItem {',
    '  z: number;',
    '}',
  ].join('\n'), '`aB` 与 `a-b` 都推出 RootAB：先出场的那个拿原名，后面追加 2');
  assert.deepEqual(generateTs(v).names, ['Root', 'RootAB', 'RootAB2', 'RootXsItem']);
  assert.equal(tBody(tOf([{ a: 1 }])),
    'type Root = RootItem[];\n\ninterface RootItem {\n  a: number;\n}', '根数组没有键名，元素用 Item');
  assert.equal(tBody(tOf({ p: [{ a: 1 }], s: [{ a: 2 }] })), [
    'interface Root {',
    '  p: RootP[];',
    '  s: RootS[];',
    '}',
    '',
    'interface RootP {',
    '  a: number;',
    '}',
    '',
    'interface RootS {',
    '  a: number;',
    '}',
  ].join('\n'), '形状相同也不合并：一个槽一份声明');
  assert.equal(tBody(tOf({ meta: { list: [{ q: 1 }] } })), [
    'interface Root {',
    '  meta: {',
    '    list: RootMetaList[];',
    '  };',
    '}',
    '',
    'interface RootMetaList {',
    '  q: number;',
    '}',
  ].join('\n'), '内联对象自己是 RootMeta，它里面的数组元素照样按父名+键名提升');
  // 数组套数组时名字一路追加 Item，48 字符那一档把链条截住（截断在冲突追加之前）
  let nested = { z: 1 };
  for (let i = 0; i < 15; i++) nested = [nested];
  assert.deepEqual(generateTs(nested).names, [`Root${'Item'.repeat(15)}`.slice(0, 48)],
    '根数组套 15 层：元素接口名截到 48 字符，链条不许越截越长');
  // 追加过 2、3 的那一格，孩子跟着**声明出去的名字**走，父子链在 text 里连得上
  const collide = { aB: [{ m: [{ p: 1 }] }], 'a-b': [{ m: [{ q: 2 }] }] };
  assert.deepEqual(generateTs(collide).names, ['Root', 'RootAB', 'RootABM', 'RootAB2', 'RootAB2M'],
    '两个槽都推出 RootAB：抢不到名字的那个追加 2，它里面的元素接口跟着叫 RootAB2M');
  assert.match(tBody(tOf(collide)), /interface RootAB2 \{\n {2}m: RootAB2M\[\];/,
    '声明与引用用同一格名字：RootAB2 的成员指着 RootAB2M，不指着断掉的 RootABM');
});

test('T6 内联对象与空容器：`{}`、`unknown[]`、根空对象、根标量走 type 别名', () => {
  assert.equal(tBody(tOf({ meta: { k: 1 }, empty: {}, list: [[1]] })), [
    'interface Root {',
    '  meta: {',
    '    k: number;',
    '  };',
    '  empty: {};',
    '  list: number[][];',
    '}',
  ].join('\n'), '内联对象一行一个成员，闭合的 `}` 退回上一层缩进');
  assert.equal(tBody(tOf({})), 'interface Root {}');
  assert.deepEqual(generateTs({}).names, ['Root']);
  assert.deepEqual(generateTs({}).notes, [], '空对象三句都不该说');
  for (const [value, want] of [[42, 'number'], ['s', 'string'], [true, 'boolean'], [null, 'null'],
    [[1, 2], 'number[]'], [[1, 'x'], '(number | string)[]']]) {
    assert.equal(tBody(tOf(value)), `type Root = ${want};`, `${JSON.stringify(value)} 的根不是对象，走别名`);
    assert.deepEqual(generateTs(value).names, [], '没有 interface 时 names 是空数组，不是 undefined');
  }
  assert.equal(tBody(tOf({ v: { k: 1 } })), 'interface Root {\n  v: {\n    k: number;\n  };\n}', '属性槽的对象是内联，不提升');
});

test('T7 可选键只在合并槽出现：`?:` 是"样本里没每条都有"，与 `| null` 是两回事', () => {
  const out = generateTs({ rows: [{ id: 1, tag: 'a' }, { id: 2 }, { id: 3, tag: null }] });
  assert.equal(tBody(out.text), [
    'interface Root {',
    '  rows: RootRows[];',
    '}',
    '',
    'interface RootRows {',
    '  id: number;',
    '  tag?: string | null;',
    '}',
  ].join('\n'), 'tag 有两条样本、其中一条是 null：既 `?:` 又并 `null`，两件事都要说');
  assert.match(out.notes.join('\n'), /不是每条都有/);
  assert.match(out.notes.join('\n'), /并集/);
  assert.equal(tBody(tOf([{ a: 1 }, { b: 'x' }])),
    'type Root = RootItem[];\n\ninterface RootItem {\n  a?: number;\n  b?: string;\n}', '键序取首次出现的顺序');
  assert.equal(tBody(tOf({ rows: [{ id: 1 }, { id: 2 }] })),
    'interface Root {\n  rows: RootRows[];\n}\n\ninterface RootRows {\n  id: number;\n}',
    '每条都有 → 不加 `?`：合并槽里"缺席"才谈得上可选');
  const same = { rows: [{ id: 1, s: 'x' }, { id: 2, s: 'y' }] };
  assert.deepEqual(generateTs(same).notes, [], '没有可选键也没有并集：notes 是空数组');
});

test('T8 notes 三句的条件出场：该说才说、说完就止，句子里不带计数器', () => {
  assert.deepEqual(generateTs({ a: 1 }).notes, [], '三句都不该说的时候交回空数组，不是三个空串');
  const onlyUnion = generateTs({ a: [1, 'x'] });
  assert.deepEqual(onlyUnion.notes.length, 1);
  assert.match(onlyUnion.notes[0], /并集/);
  const onlyQuoted = generateTs({ 'a b': 1 });
  assert.deepEqual(onlyQuoted.notes.length, 1);
  assert.match(onlyQuoted.notes[0], /索引签名/);
  const all3 = generateTs({ 'a-b': [{ c: 1 }, {}], d: [1, 'x'] });
  assert.deepEqual(all3.notes.map((s) => (/并集/.test(s) ? 'u' : /不是每条都有/.test(s) ? 'o' : 'i'))
    , ['u', 'o', 'i'], '出场顺序固定：并集 → 可选键 → 索引签名');
  for (const s of all3.notes) {
    assert.ok(!/\d/.test(s), `句子里不许带计数：${s}`);
    assert.ok(!/[\r\n]/.test(s), `一句必须是一行：${s}`);
    assert.equal(s, s.trim(), `句子两头不留空格：${s}`);
  }
  assert.equal(new Set(all3.notes).size, 3, '三句互不重复');
});

test('T9 indent 三档与 root 一档：模式不认就抛，静默回退默认档是把写错藏成莫名其妙', () => {
  const v = { a: { b: 1 } };
  assert.equal(tOf(v, { indent: 'two' }), tOf(v, {}), '缺省档就是 two');
  assert.equal(tBody(tOf(v, { indent: 'four' })), 'interface Root {\n    a: {\n        b: number;\n    };\n}');
  assert.equal(tBody(tOf(v, { indent: 'tab' })), 'interface Root {\n\ta: {\n\t\tb: number;\n\t};\n}');
  assert.equal(tBody(tOf(v, { root: 'payload' })),
    'interface Payload {\n  a: {\n    b: number;\n  };\n}', 'root 也过 toInterfaceName：小写首字母照样改大写');
  assert.equal(tBody(tOf([{ q: 1 }], { root: 'row' })),
    'type Row = RowItem[];\n\ninterface RowItem {\n  q: number;\n}', '根别名与它派生的元素名共用同一格 root');
  for (const bad of ['one', '2spaces', '', 'TWO']) {
    assert.throws(() => tOf(v, { indent: bad }), (e) => e instanceof RangeError
      && /INDENT_MODES/.test(e.message) && /two \| four \| tab/.test(e.message), `${bad} 该点名 INDENT_MODES`);
  }
  assert.deepEqual(INDENT_MODES, ['two', 'four', 'tab'], '这一族的档位与 json-core 同一条清单');
  assert.throws(() => tOf(v, { root: 42 }), TypeError);
  assert.throws(() => generateTs(undefined), TypeError, 'undefined 不是 JSON 值，点名比推断成 unknown 有用');
});

test('T10 纯度、显式栈与深度兜底：不读环境、不吃 JSON、1000 层与环都出得来', () => {
  const code = tCode();
  for (const banned of ['Buffer.', 'TextEncoder', 'process.', 'localStorage', 'document.', 'window.',
    'JSON.parse', 'JSON.stringify', 'fetch(', 'require(', 'eval(', 'Math.random']) {
    assert.ok(!code.includes(banned), `json-ts 不许出现 ${banned}：纯计算、不读环境、转义与解析都不外包给原生`);
  }
  assert.equal((code.match(/^import /gm) || []).length, 1, '只有一本依赖：json-core 的那几把尺');
  const names = /import \{([^}]*)\} from '\.\/json-core\.js'/m.exec(code)[1]
    .split(',').map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(names, ['INDENT_MODES', 'MAX_DEPTH', 'escapeText'], '只借三样：缩进档位、深度闸门、转义口径');
  assert.match(code, /const buildShape[\s\S]{0,900}?while \(stack\.length\)/, '收集样本形状走显式栈，不靠调用栈');
  // 深度：闸门之外不设第二道。1000 层是 parseJson 肯放行的最深输入，这里必须渲染得出来
  let deep = 1;
  for (let i = 0; i < 1000; i++) deep = { a: deep };
  const out = tOf(deep);
  assert.equal((out.match(/\{/g) || []).length, 1000, '一层容器一对花括号，兜底不许把中间某层悄悄压成 unknown');
  assert.equal((out.match(/number;/g) || []).length, 1, '最深那一格是 1 → number，它还在');
  // 环：同一格对象被反复走到，靠 MAX_DEPTH 收口，最深那一格交回 unknown
  const cyc = {};
  cyc.self = cyc;
  const c = tOf(cyc);
  assert.match(tBody(c), /unknown;/, '环走到深度闸门就停');
  assert.ok(c.length < 200000, `环不许把输出撑爆（实际 ${c.length} 字节）`);
  const v = { a: [{ b: 1 }], 'a-b': [{ c: 2 }] };
  tOf(v);
  assert.deepEqual(v, { a: [{ b: 1 }], 'a-b': [{ c: 2 }] }, '入参一个都不许改：推断只读不写');
});
```

### 提交后复跑（2026-09-29，Task 3 落地那一格）

- 门禁一：`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs`
  → `# tests 303 / # pass 303 / # fail 0`（293 + §T 十条）。文件头的用例分布表按那条 awk 口径重算过，
  合计与 `# tests` 对齐。
- 门禁二（导出树）：新增两块整文件/整节镜像全等；`--fix` 只动了段 1 计划里的 §A 那一块（文件头表格），
  换完再跑一次全绿。共享工作树里照旧只在自己建的 HEAD 导出树上落笔。
- 门禁三：`verify-plan-blocks-teeth.mjs` 在导出树 35/35。
- 门禁四（真重建，两棵树对拍）：`git archive HEAD` 出一份纯 HEAD 树、本格导出树一份，
  各 `ln -s` 同一份 `node_modules` 后 `npx vite build`（都 exit=0），把两棵树的
  `assets/{js,css}/*.min.*` 逐件记成「路径 + raw 字节 + `cat | gzip -9 | wc -c` 字节」三列清单再 diff
  → **33 件产物逐行相同，diff 无输出**。这就是"新增的 `json-ts.js` 没进任何现有页"的证据：
  `dev/js/tools/` 那一层不是入口（`getDevJsEntries()` 只扫 `dev/js/` 一层），且此刻没有任何入口 import 它。
  共付三件在 HEAD 这一版的读数（`toolkit.min.css` 10,541B / gzip 2,306B、`toolkitCore.min.js`
  19,109B / 7,037B、`toolCodec.min.js` 59,317B / 21,830B）与 Task 1 那格记录的 9,418B / 2,135B **不同**，
  差的不是本格——是 55cf005 那批动效进了 `toolkit.scss` 之后共付件自己涨了 171B gzip。
  **这一条要在 Task 8 量 §7 那两行之前重算一遍**：证件页首屏那一格的余量已经被这笔改动继续吃掉。
- 门禁五、六：`check-tools-surface.mjs` / `-teeth.mjs` 在活树跑（它们读 `_site`），各 0 退。
- **语法自证（本仓库唯一可用的 TS 尺）**：把生成产物写进 `/tmp/jc/smoke.ts`，
  用 `node --experimental-strip-types`（Node 22.19 自带的类型剥离，仓库里没有 tsc 也没有 esbuild）读一遍——
  过；再喂一份 `interface Broken { a: ; }` 确认它会报 SyntaxError（判据有牙，不是静默放行）。
  这条不进仓库门禁（它依赖 node 的试验性 flag），只作为落地期的第三方核验记在这儿。
- 性能实测量级（`/tmp/jc/ts-perf.mjs`、`ts-wide.mjs`，本机 node 22.19）：1.12 MiB / 1 万个对象样本
  → `generateTs` 首跑 24.3 ms、连跑 100 次平均 10.7 ms，产物 378B；宽样本一个对象 3 万个键
  （一半带分隔符）→ 605 ms、产物 1.8 MB、`names` 30001 个。
  **这一档数字是给 §W 的**：TS 那一格不能挂在每次按键上跑，要跟着 §W 的防抖与"按需生成"走；
  而 1.8 MB 的输出框要先量再决定给不给全量（§7 的字节预算管的是首屏，这条是运行期）。

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

### 落地镜像（门禁二核的就是这两块，`--fix` 会把它们整块换成磁盘内容）

一块是 `dev/js/tools/json-convert.js` 的**磁盘全文**，另一块是磁盘上 §U 那一节的**整节**
（U1–U5 与 §U 续的 U6–U18 同属一节：§U 续那行是普通注释、不是 `// ── §` 标记，所以
`splitAtMarks` 不再切它——这正是本节名不另起、口径不分叉的落地形状）。§0.6 的硬规矩照旧：
只有整文件与整节镜像允许 ` ```js `，契约段一律 ` ```text `。上面那一格 ` ```js ` 是新贴的，
由磁盘内容直接生成（`--fix` 只做整块替换、从不插入），贴完在导出树里跑一次复验它已全等；
下面那一格 §U 镜像由导出树里的 `--fix` 从 Task 1 那一块整块换过来。

#### `dev/js/tools/json-convert.js`（整文件）

```js
/**
 * JSON ↔ YAML / XML / CSV 三对互转（设计文档 §5.3 的转换族，段 4 Task 4 落地）。
 * 判据是 §U 的 U6–U18（`scripts/toolkit-tests.mjs`），本文件的每一格口径都在那里钉着；
 * 注释与判据冲突时以判据为准，因为判据是要在 CI 里红给下一个改这一本的人看的。
 *
 * ── 为什么 YAML 那一族用的是一本**内置件**而不是 npm 依赖（段 4 计划 §0.4 的三条理由）──
 *
 * 1. `package.json` 与 `pnpm-lock.yaml` 是全站构建的公共件，本段落地期间它正被另一路
 *    会话占着（未提交的两条 `wechat:draft*` scripts）。加依赖要同批改这两个文件，
 *    而 CI 是 `--frozen-lockfile` —— 两处不同批就红在别人的批次上。
 * 2. 本仓库对**浏览器代码**的既有做法就是内置：`dev/libJs/` 里躺着 jquery、prism、
 *    social-share、canvas-nest、vue、vconsole、fastclick，`package.json` 的
 *    `dependencies` 一格根本没有（只有 7 项 devDependencies，全是构建工具）。
 *    `THIRD-PARTY-NOTICES.md` 第一节就是为这一族内置件设的账。
 * 3. 内置的价钱量得出来（2026-09-29 在 HEAD 导出树里真跑 `npx vite build` 的探针，
 *    exit=0，口径 `cat f | gzip -9 | wc -c`）：探针入口 `probeJson.min.js` 原文 56,955B /
 *    **gzip 16,912B**，同批对照 `toolCodec.min.js` 是 21,830B、`toolkitCore.min.js` 7,037B、
 *    `toolkit.min.css` 2,135B；24 本产物（基线 23 本 + 探针那一本，Task 1 复跑核对过清单）里
 *    `import{` 命中 0，且 `assets/js/` 没有多出
 *    一本 js-yaml —— `.mjs` 既不成 Vite 入口（`vite.config.js:110` 只收 `.js`），
 *    也不被 `copyMinifiedLibs` 复制（`:67` 只复制 `.min.js`）。
 *
 * ── 这一本是什么、能动到什么程度 ──
 *
 * `dev/libJs/js-yaml.esm.min.mjs` = npm tarball `js-yaml-5.4.2` 里那个
 * `package/dist/browser/js-yaml.esm.min.mjs` 成员，**逐字节**（78,721B /
 * sha256 `154ea2da…`，U1 钉它；整包 `js-yaml-5.4.2.tgz` 是 sha256 `0003d2f5…`，
 * 两个数一起才能从上游复算）。spec §7 指定的就是这个入口。不改名、不重排、不剥尾部那条
 * sourceMappingURL 引用（"逐字节等于上游"比"少一行指向站内不存在的 map"值钱，
 * `jquery.min.js` 同样挂着一条，线上多年无人受害）。
 *
 * **升级口径**：换版本 = 换文件 + 改 §U 那一族记下的 sha256 / 字节数 / banner 串
 * + 复跑 §U 与 §W 与门禁②③，并同步 `THIRD-PARTY-NOTICES.md` 那一行。
 * 不许 sed 内置件本身——那会让第一节那句"逐字节比对已确证"变成谎话。
 *
 * ── 三对各自的边界，都是判据而不是"尽力而为" ──
 *
 * · **YAML**：读侧用 YAML11 的 schema（不是默认的 CORE），因为只有它给得出 `!!binary`
 *   与时间戳这两类；价钱是 YAML 1.1 的历史包袱会真的生效（`yes/no/y/n/on/off` 是布尔、
 *   `0755` 是八进制、`2024-01-01` 是日期，连键位上单个 `y` 也是布尔）。写侧全靠引号挡住
 *   （U7 逐字钉住 dump 自己加的那些引号），读侧挡不住的由 U8 逐条点名、并由 `YAML_NOTES`
 *   如实告诉用户。深度闸门 `YAML_DEPTH_LIMIT` 是**在内置件上二分实测**出来的 98 层：
 *   写侧用同一个数，理由只有一条——写出去就必须读得回来。
 * · **XML**：只支持本站自己写的那个子集（`XML_CONVENTION` 那句话就是这张表的目录）：
 *   类型写在 `t` 属性上、数组元素一律 `<item>`、空白不 trim。命名空间、DOCTYPE、外部实体、
 *   非预定义实体一律拒，且指认到越界的那一个字符（U12 四十八档）。读侧比写侧宽：接受自闭合、
 *   单引号属性、注释、CDATA、数字引用与同名兄弟归并（U13），因为"编辑后再读"这条路要留着。
 * · **CSV**：按 RFC 4180 补三处（引号 doubling、内嵌换行、CRLF），读回来一律是字符串——
 *   它没有类型可保（`CSV_NOTES.fidelity` 就是说这件事）。形状只收"对象数组"与"单个对象"，
 *   嵌套容器压成一格 JSON 文本（不拒，因为拒了用户就没法把这份数据带出去）。
 *
 * ── 三条贯穿全本的口径 ──
 *
 * 1. **坏输入是返回值，入参错才是编程错**：三个写函数对"这份数据转不了"返回
 *    `{ok:false, error:{kind, message, path}}`，三个读函数对"这份文本读不懂"返回
 *    `{ok:false, error:{kind, message, line, column, index, snippet}}`；而非字符串入参、
 *    非法缩进档、非法分隔符一律当场 `TypeError` / `RangeError`（静默回退默认档，是把
 *    "参数写错"藏成"输出莫名其妙"）。
 * 2. **位置只有一把尺**：行列口径全借 `json-core` 的 `gate` / `locate` / `lineRange`，
 *    闸门那两档的消息交回 core 的原话（站内不许有第二句"超出上限"）。深度也只有一把尺：
 *    XML 两向都吃 `MAX_DEPTH`，本文件里不写字面量那一千。
 * 3. **显式栈**：`scanJson` 与两个写读器都是迭代。`MAX_DEPTH` 那一档的合法输入会先把
 *    递归下降的调用栈撑爆（`RangeError` 而不是行列号），而"报错报在第几行第几列"正是
 *    这一族存在的理由。
 *
 * ── 纯计算 ──
 *
 * 不读任何环境：没有 `window` / `document` / `localStorage` / `process` / `Buffer` /
 * `TextEncoder`，不用 `atob` / `btoa` / `DOMParser` / `XMLSerializer`，不碰网络，
 * base64 与 XML 与 CSV 的解析全部自己写（U18 钉这一族，也钉"只借 json-core 那七把尺"）。
 * 解析与序列化一律不外包给原生：`JSON.parse` / `JSON.stringify` 在本文件里一次都不出现
 * （CSV 单元格里的紧凑 JSON 用 `escapeText` 自己拼，数字用 `String(n)`）。
 *
 * `__proto__` 一律走本文件的 `setOwn()` 写：`obj['__proto__'] = v` 改的是原型而不是属性，
 * 一份恶意输入可以借此污染后续所有对象（U8 与 U13 各有一格盯着这条，它盯的是**依赖**）。
 *
 * @module dev/js/tools/json-convert.js
 */
import * as YAML from '../../libJs/js-yaml.esm.min.mjs';
import { INDENT_MODES, MAX_DEPTH, escapeText, gate, lineRange, locate, pointerChild } from './json-core.js';

/**
 * 面板与判据共读的那一句身份说明（U18 拿它与内置件首行 banner、与 §U 的路径同时逐字对账）。
 * @type {string}
 */
export const YAML_LIB = 'js-yaml 5.4.2 (MIT) · dev/libJs/js-yaml.esm.min.mjs';

/**
 * YAML 那一族的深度上限：在内置件的读侧上二分实测（2026-09-29），98 层能读回来、
 * 99 层它自己就抛。写侧用同一个数，是为了 `roundTrips().yaml` 给出的那个 ✓ 不是假话。
 * 它与 `MAX_DEPTH`（1000）是两个数：YAML 这一族窄，XML 那一族宽，面板照实显示。
 * @type {number}
 */
export const YAML_DEPTH_LIMIT = 98;

/**
 * 面板上"读 YAML 要知道的两件事"（键名由 §W 的面板按格读，加一格就要改面板）。
 * @type {{ambiguous: string, date: string}}
 */
export const YAML_NOTES = {
  ambiguous: 'YAML 1.1 把 yes/no/on/off/y/n 当布尔、0755 当八进制、2024-01-01 当日期：'
    + '本站写的时候每一格都加了引号，读你手上的 YAML 时它们会真的变成布尔与数字。',
  date: '日期与时间在 YAML 里是另一种类型：本站一律折成 UTC 的 ISO 8601 字符串'
    + '（形如 2024-01-01T00:00:00.000Z），!!binary 一律折成 base64 字符串。',
};

/**
 * XML 那一族的一句话约定说明（U18 钉它必须提到 `item` 与 `t=`，且长不过 200 字——
 * 长过这一档就该拆进 help 而不是堆在面板上）。
 * @type {string}
 */
export const XML_CONVENTION = '类型只写在 t= 属性上（obj / arr / str / num / bool / null），'
  + '数组元素一律叫 item，对象键名就是标签名；命名空间、DOCTYPE 与外部实体不读。';

/**
 * CSV 那一族的代价说明（面板那句 fidelity，也是 `roundTrips().csv === false` 的解释）。
 * @type {{fidelity: string}}
 */
export const CSV_NOTES = {
  fidelity: 'CSV 没有类型：每一格读回来都是字符串，数字、布尔与 null 都一样；'
    + '嵌套的对象与数组压成一格 JSON 文本写进去，读回来同样是字符串。',
};

/** 三档缩进的单位：与 `INDENT_MODES` 同名同序，档位合法性由那一本管（U10） */
const INDENT_UNIT = { two: '  ', four: '    ', tab: '\t' };

/** XML 的类型标签（写侧按它输出，读侧按它校验；`item` 不在这一族里，那是元素名） */
const XML_KINDS = ['obj', 'arr', 'str', 'num', 'bool', 'null'];

/** 读侧只认这五个预定义实体，其余具名实体一律点名拒（U12） */
const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** 合法名字：字母或下划线起始，后面跟字母、数字、点、下划线、连字符；`xml` 前缀与冒号拒（U11） */
const NAME_RE = /^[\p{L}_][\p{L}\p{Nd}._-]*$/u;
/** JSON 的数字记号（读侧按它校验 `t="num"` 的内容，所以 `+1`、`01`、`Infinity` 都进不来） */
const NUM_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

const LT = '<';
const GT = '>';
const AMP = '&';
const SLASH = '/';
const EQ = '=';
const QUOTE = '"';
const APOS = "'";
const SEMI = ';';
const TILDE = '~';

/** 内置件读侧遇到 JSON 装不下的类型时，`settle()` 交回的这个哨兵（只在本文件内流通） */
const NOT_JSON = Symbol('not-json');

/**
 * 把键写成 own 属性（`obj['__proto__'] = v` 改的是原型）。与 json-core 的同名内部件同形——
 * 那一本没有导出它，因为它是解析器 internals；这一本要的也只是 internals。
 * @param {Record<string, unknown>} obj
 * @param {string} key
 * @param {unknown} value
 */
const setOwn = (obj, key, value) => {
  Object.defineProperty(obj, key, { value, enumerable: true, writable: true, configurable: true });
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** 容器 = 数组或"干净的对象"（原型是 Object.prototype 或 null）；类实例、Map、Set 都不算 */
const isPlainObject = (v) => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

const isContainer = (v) => Array.isArray(v) || isPlainObject(v);

const CLASS_SCALAR = 0;
const CLASS_CONTAINER = 1;
const CLASS_BAD = 2;

/**
 * 三族共用的分类：哪些值能进 JSON、哪些是容器、哪些"JSON 里装不下"。
 * `Date` 与 `Uint8Array` 算标量，因为每一族都有明确的归一方式（ISO 串 / base64 串）；
 * 非有限的数（NaN 与两个 Infinity）算装不下——交出去就不是合法 JSON 了。
 * @param {unknown} v
 * @returns {number} `CLASS_SCALAR` | `CLASS_CONTAINER` | `CLASS_BAD`
 */
const classify = (v) => {
  const t = typeof v;
  if (v === null || t === 'string' || t === 'boolean') return CLASS_SCALAR;
  if (t === 'number') return Number.isFinite(v) ? CLASS_SCALAR : CLASS_BAD;
  if (t === 'object') {
    if (Array.isArray(v)) return CLASS_CONTAINER;
    if (v instanceof Date || v instanceof Uint8Array) return CLASS_SCALAR;
    return isPlainObject(v) ? CLASS_CONTAINER : CLASS_BAD;
  }
  return CLASS_BAD;
};

/** 容器的键序列：数组用下标，对象用 own 可枚举键（`__proto__` 在列，因为它就是 own 键） */
const keyListOf = (v) => (Array.isArray(v) ? Array.from(v, (unused, i) => i) : Object.keys(v));

const typeNameOf = (v) => {
  if (v === null) return 'null';
  if (v instanceof Date) return 'Date';
  if (v instanceof Uint8Array) return 'Uint8Array';
  const t = typeof v;
  if (t === 'object') return isPlainObject(v) ? 'object' : (v && v.constructor && v.constructor.name) || 'object';
  return t;
};

/** base64  alphabet：`atob` / `btoa` 在 U18 的禁令里（外包就等于不可审计），这一族自己写 */
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * 字节串 → base64（含 `=` 补齐）。空字节串得到空字符串，而不是"看起来像 null"的裸 `a:`。
 * @param {Uint8Array} bytes
 * @returns {string}
 */
const b64 = (bytes) => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const hasB = i + 1 < bytes.length;
    const hasC = i + 2 < bytes.length;
    const n = (a << 16) | ((hasB ? bytes[i + 1] : 0) << 8) | (hasC ? bytes[i + 2] : 0);
    out += B64_CHARS.charAt((n >> 18) & 63) + B64_CHARS.charAt((n >> 12) & 63);
    out += hasB ? B64_CHARS.charAt((n >> 6) & 63) : '=';
    out += hasC ? B64_CHARS.charAt(n & 63) : '=';
  }
  return out;
};

/**
 * 写侧共用的三道闸门：非 JSON 的值、环、深度。全部迭代，且**祖先栈只沿当前这条路径**——
 * 同一个对象被两个键引用（DAG）在 JSON 里就是两份拷贝，`seen` 判法会把它当环一起拒掉（U8）。
 * @param {unknown} value
 * @param {number} limit 层数上限（根算第 1 层）
 * @param {boolean} [countScalars] 标量叶算不算一层。XML 那一族要它（`true`）：本站的编码里
 *   **一个值恰好一个元素**，最深那一格是标量时元素层数 = 容器层数 + 1，而读侧的闸门数的就是元素层数
 *   （U12 钉死的既是它）。YAML 与 CSV 不数（`false`），它们的闸门各自窄一档/根本没有那一族。
 *   这一把尺不许有两套读法：写侧只数容器就会放出自己读不回来的东西（U11 最后那一族钉的是这个）。
 * @returns {{ok: true} | {ok: false, error: {kind: string, message: string, path: string}}}
 */
const scanJson = (value, limit, countScalars = false) => {
  const rootClass = classify(value);
  if (rootClass === CLASS_SCALAR) return { ok: true };
  if (rootClass === CLASS_BAD) {
    return { ok: false, error: { kind: 'non-json', message: nonJsonMessage(value), path: '' } };
  }
  const stack = [{ v: value, path: '', level: 1, keys: keyListOf(value), i: 0, anc: null }];
  let where = '';
  try {
    while (stack.length > 0) {
      const f = stack[stack.length - 1];
      if (f.i >= f.keys.length) { stack.pop(); continue; }
      const key = f.keys[f.i];
      f.i += 1;
      const path = pointerChild(f.path, key);
      where = path;
      const child = f.v[key];
      const cls = classify(child);
      if (cls === CLASS_BAD) return { ok: false, error: { kind: 'non-json', message: nonJsonMessage(child), path } };
      if (cls === CLASS_SCALAR) {
        const level = f.level + 1;
        if (countScalars && level > limit) {
          return { ok: false, error: { kind: 'depth', message: depthMessage(level, limit), path } };
        }
        continue;
      }
      if (child === f.v || hasAncestor(f.anc, child)) {
        return { ok: false, error: { kind: 'cycle', message: CYCLE_MESSAGE, path } };
      }
      const level = f.level + 1;
      if (level > limit) {
        return { ok: false, error: { kind: 'depth', message: depthMessage(level, limit), path } };
      }
      stack.push({ v: child, path, level, keys: keyListOf(child), i: 0, anc: { node: f.v, prev: f.anc } });
    }
  } catch {
    // 走到这里只剩一种可能：**读这一格的值时它自己抛了**（对象上的 getter 或 Proxy 的 trap）。
    // 面板喂进来的值一律出自 parseJson，那里头没有 getter，所以这一族不是"用户的数据"而是"别人
    // 直接调模块"才会撞上的形状；但出口那句"绝不抛给调用方"不许因为它破——三格并排的面板里，
    // 任何一格把异常抛出去就是整块面板一次未捕获异常。与"装不进 JSON"同一档，当场指认 Pointer。
    return { ok: false, error: { kind: 'non-json', message: THREW_MESSAGE, path: where } };
  }
  return { ok: true };
};

/** 沿祖先链表找有没有同一个对象（深度已先由闸门卡住，这一族最贵就是 limit 次比较） */
const hasAncestor = (anc, node) => {
  for (let p = anc; p !== null; p = p.prev) if (p.node === node) return true;
  return false;
};

const nonJsonMessage = (v) => `${typeNameOf(v)} 这种值装不进 JSON：本站只认对象、数组、`
  + '字符串、有限的数、布尔与 null。undefined 键与函数会被静默丢掉或改写，比报错更难查，所以当场拒。';

const CYCLE_MESSAGE = '这份数据里有自引用（对象或数组里出现了它自己）：JSON 里表达不了环，'
  + '本站不展开也不截断，请把它改成两份独立的值。';

/** `scanJson` 里那道 catch 的话：读值时对象自己抛了（getter / Proxy 的 trap） */
const THREW_MESSAGE = '取这一格的值时它自己抛了（对象上的 getter 或 Proxy 的 trap）：'
  + '那不是 JSON 里取得出的一份数据，本站当场拒，不改写成 null 也不跳过这一格。';

const depthMessage = (level, limit) => `嵌套到第 ${level} 层，超出这一族的上限 ${limit} 层：`
  + '本站不做静默压平，请减一层再转。';

/** 码点写成 `U+XXXX`（U11 钉这一族的写法：删掉它用户看不出来少了什么，必须点名） */
const hexPoint = (code) => `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;

/**
 * 读侧 error 的唯一造法：行列由 index 经 `locate` 推、snippet 由 `lineRange` 切，
 * 所以两套数字不会各说各话（U9 与 U12 各有一格自洽断言）。
 * @param {string} kind
 * @param {string} text
 * @param {number} index
 * @param {string} why
 */
const readError = (kind, text, index, why) => {
  const at = Math.max(0, Math.min(index | 0, text.length));
  const pos = locate(text, at);
  const rng = lineRange(text, pos.line);
  return {
    kind,
    message: `${why}（第 ${pos.line} 行第 ${pos.column} 列）`,
    line: pos.line,
    column: pos.column,
    index: at,
    snippet: text.slice(rng.start, rng.end),
  };
};

/** 闸门那一档：消息交回 json-core 的原话，不给 snippet（一行就是 5 MiB，指认到 EOF 那一格） */
const gateError = (g, text) => {
  const pos = locate(text, text.length);
  return {
    kind: g.kind, message: g.message, line: pos.line, column: pos.column, index: text.length, snippet: '',
  };
};

const typeGuard = (api, value) => {
  if (typeof value !== 'string') {
    throw new TypeError(`${api} 只收字符串，收到的是 ${value === null ? 'null' : typeof value}`);
  }
};

// ── YAML 那一族 ──────────────────────────────────────────────────────────────

/**
 * 值 → 交给内置件之前的归一：`Date` 变 ISO 串、`Uint8Array` 变 base64 串，其余原样。
 * 归一是为了"交出去的 YAML 与交进来的 JSON 同形"——别人拿别的 yaml→json 工具转一圈
 * 还得是同一份数据，所以不能让 dump 自己写 `!!binary` 或裸时间戳（U8）。
 * 递归在这里是安全的：`scanJson` 已经把它压到 98 层以内，栈顶还剩几十格余量。
 * @param {unknown} v
 * @returns {unknown}
 */
const normalizeForYaml = (v) => {
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array) return b64(v);
  if (Array.isArray(v)) return v.map((item) => normalizeForYaml(item));
  if (isPlainObject(v)) {
    const out = {};
    for (const key of Object.keys(v)) setOwn(out, key, normalizeForYaml(v[key]));
    return out;
  }
  return v;
};

/**
 * JSON 值 → YAML 文本。
 * @param {unknown} value
 * @returns {{ok: true, text: string} | {ok: false, error: {kind: string, message: string, path: string}}}
 */
export function jsonToYaml(value) {
  const scan = scanJson(value, YAML_DEPTH_LIMIT);
  if (!scan.ok) return { ok: false, error: scan.error };
  let text;
  try {
    // lineWidth=-1：500 字的串不许被折成多行（复制出去就不是同一份数据）
    // noRefs=true：DAG 写两份，与 JSON 同形；写成锚点引用是另一种"看起来一样"的东西
    text = YAML.dump(normalizeForYaml(value), { lineWidth: -1, noRefs: true });
  } catch (err) {
    return { ok: false, error: { kind: 'non-json', message: `内置件不肯写这一族值：${err && err.message}`, path: '' } };
  }
  return { ok: true, text: text.endsWith('\n') ? text : `${text}\n` };
}

/**
 * 在真正调用内置件之前，先把"整份输入没有文档"与"多于一个文档"这两档自己判掉：
 * 内置件给这两档的异常不带位置（mark 是 null），而 §5.3 要的是行列号。
 * 行口径借 §S 那一把尺（只认 `\n`），`---` 与 `...` 必须顶格才算标记（块标量里的缩进内容
 * 因此不会被误读成文档边界）。
 * @param {string} text
 * @returns {{kind: 'empty'|'multi-document', index: number} | null}
 */
const prescanYaml = (text) => {
  let pending = false;    // 最近一个文档标记之后有没有真正的内容
  let open = false;       // 当前这一份文档开着（`---` 起了头，或已经有内容）
  let everOpen = false;   // 整份输入里有没有开过文档——`...` 会关掉当前的，但不抹掉这一格
  let endAt = -1;         // 看到 `...` 但还没有内容跟着它——它下面一旦有内容就是第二份的边界
  let at = 0;
  for (;;) {
    const nl = text.indexOf('\n', at);
    const end = nl === -1 ? text.length : nl;
    const raw = text.slice(at, end);
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    const marker = /^---(?=[\s]|$)/.test(line) ? '---' : /^\.\.\.(?=[\s]|$)/.test(line) ? '...' : '';
    const blank = line.trim() === '';
    const comment = !blank && line.charAt(line.search(/[^\s]/)) === '#';
    if (marker === '---') {
      // 上面已经开过一份（哪怕内容是空的，`---\n---` 就是两份），这一行就是第二份的起始符
      if (endAt >= 0) return { kind: 'multi-document', index: endAt };
      if (pending || open) return { kind: 'multi-document', index: at };
      open = true;
      everOpen = true;
      pending = false;
    } else if (marker === '...') {
      // 已经关掉过就什么也不做：2026-09-29 实测内置件对"结束符之后再来一个 `...`"仍算同一份文档，
      // 这里抢先返回 multi 就是把**合法输入**误拒成两份——比漏拒更伤用户（U8 那一格钉的是它）。
      // 空文档也要记下结束位：`---` 开了它、`...` 关掉它，后面再出现 `---` 就是第二份（U9 那一格）。
      if (endAt < 0 && (pending || open)) endAt = at;
      open = false;
      pending = false;
    } else if (!blank && !comment) {
      if (endAt >= 0) return { kind: 'multi-document', index: endAt };
      open = true;
      everOpen = true;
      pending = true;
    }
    if (nl === -1) break;
    at = end + 1;
  }
  // 只有 `---` 也算一份文档（它的值是 null）；`...` 与注释不算——那才是"没有输入"
  if (!everOpen) return { kind: 'empty', index: text.length };
  return null;
};

/** 内置件的异常 → 本站的 kind：嵌套闸门、未知标签各一档，其余归 parse */
const yamlErrorKind = (message) => {
  if (/nesting exceeded|maximum nesting|maxDepth/i.test(message)) return 'depth';
  if (/unknown [\w ]*tag/i.test(message)) return 'unknown-tag';
  return 'parse';
};

/** 内置件消息的第一行（它后面还挂着源码上下文那几行，面板那一格只要这一句） */
const firstLine = (message) => String(message).split('\n', 1)[0];

/**
 * 内置件给的值 → JSON 给得起的值：Date → ISO 串、Uint8Array → base64 串、
 * 非有限的数 → null、JSON 装不下的那一族 → 交回 `NOT_JSON`。
 * 所有对象一律用 `setOwn` 重建：原型必须回到 Object.prototype，`__proto__` 落成 own 键（U8）。
 * 落到 `NOT_JSON` 的到底是哪一族，2026-09-29 实测过才这么写：`!!set` 与 `!!python/*` 那一族
 * 在内置件那关就报 unknown tag（走 `unknown-tag` 那一档，压根到不了这里）；`!!omap` 在 YAML11
 * 的 schema 里给回的就是"单键对象组成的数组"——那是 omap 在 JSON 里唯一成立的写法，原样收下，
 * 不是把类型换掉。所以这里拦到的只剩 bigint / symbol / function 与"原型不是 Object 的脏对象"
 * 这一族（站内可达的样本几乎没有，留着是因为换掉内置件的那天这一档就会不一样）。
 * @param {unknown} v
 * @returns {unknown} `NOT_JSON` 表示这份 YAML 里的东西 JSON 装不下
 */
const settleYamlValue = (v) => {
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array) return b64(v);
  if (Array.isArray(v)) {
    const out = [];
    for (const item of v) {
      const s = settleYamlValue(item);
      if (s === NOT_JSON) return NOT_JSON;
      out.push(s);
    }
    return out;
  }
  if (v !== null && typeof v === 'object') {
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return NOT_JSON;
    const out = {};
    for (const key of Object.keys(v)) {
      const s = settleYamlValue(v[key]);
      if (s === NOT_JSON) return NOT_JSON;
      setOwn(out, key, s);
    }
    return out;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === undefined || typeof v === 'bigint' || typeof v === 'symbol' || typeof v === 'function') return NOT_JSON;
  return v;
};

/**
 * YAML 文本 → JSON 值。读侧用 YAML11 的 schema（`YAML_NOTES` 那两格说的就是它的价钱）。
 * @param {string} text
 * @returns {{ok: true, value: unknown} | {ok: false, error: {kind: string, message: string, line: number, column: number, index: number, snippet: string}}}
 */
export function yamlToJson(text) {
  typeGuard('yamlToJson', text);
  const g = gate(text);
  if (!g.ok) return { ok: false, error: gateError(g, text) };
  const pre = prescanYaml(text);
  if (pre) {
    const why = pre.kind === 'empty'
      ? '没有可解析的 YAML 内容：整份输入是空的、只有空白，或者只有注释与文档结束符'
      : '这份文本里有多于一个 YAML 文档，本站一次只转一份';
    return { ok: false, error: readError(pre.kind, text, pre.index, why) };
  }
  let loaded;
  try {
    loaded = YAML.load(text, { schema: YAML.YAML11_SCHEMA });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const mark = err ? err.mark : null;
    const at = mark && typeof mark.position === 'number' ? mark.position : text.length;
    return { ok: false, error: readError(yamlErrorKind(message), text, at, `YAML 解析失败：${firstLine(message)}`) };
  }
  const value = settleYamlValue(loaded);
  if (value === NOT_JSON) {
    return {
      ok: false,
      error: readError('non-json', text, text.length,
        '这份 YAML 里有 JSON 装不下的类型（bigint、symbol、函数，或原型不是普通对象的那一族），'
        + '本站只认对象、数组、字符串、有限的数、布尔与 null'),
    };
  }
  return { ok: true, value };
}

// ── XML 那一族 ───────────────────────────────────────────────────────────────

const isWs = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r';

const skipWs = (text, at) => {
  let i = at;
  while (i < text.length && isWs(text.charAt(i))) i += 1;
  return i;
};

/** 名字合法性：字符集那一档 + `xml` 前缀那一档（U11 的合法/越界两族表就是它） */
const isLegalName = (name) => NAME_RE.test(name) && !/^xml/i.test(name);

/**
 * 这段文字里有没有写进 XML 就存不下的字符：C0 控制符（`\t` `\n` `\r` 除外）与落单代理项。
 * 命中就交回它的码点串，否则交回空串。`DEL`、U+0080、U+2028 都在 XML 1.0 的字符集里，
 * 闸门不许顺手多禁（U11 有一格专门钉这一条）。
 * @param {string} s
 * @returns {string}
 */
const badCharIn = (s) => {
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i);
    if (code < 0x20 && code !== 9 && code !== 10 && code !== 13) return hexPoint(code);
    if (code >= 0xd800 && code <= 0xdfff) {
      const next = i + 1 < s.length ? s.charCodeAt(i + 1) : -1;
      if (code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { i += 1; continue; }
      return hexPoint(code);
    }
  }
  return '';
};

/** 文本节点只转四格：`&` `<` `>` 与 `\r`（后者不数字化会被读侧按平台规矩当行尾吃掉） */
const xmlEscape = (s) => {
  let out = '';
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charAt(i);
    if (c === AMP) out += '&amp;';
    else if (c === LT) out += '&lt;';
    else if (c === GT) out += '&gt;';
    else if (c === '\r') out += '&#13;';
    else out += c;
  }
  return out;
};

/** 标量 → 写进标签中间的那段文字（负零是这一族唯一要偏离 `String(n)` 的地方，U10 钉它） */
const xmlLeafText = (v) => {
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array) return b64(v);
  if (v === null) return '';
  if (typeof v === 'number') return Object.is(v, -0) ? `-${String(0)}` : String(v);
  return String(v);
};

const xmlKindOf = (v) => {
  if (Array.isArray(v)) return 'arr';
  if (v === null) return 'null';
  if (v instanceof Date || v instanceof Uint8Array || typeof v === 'string') return 'str';
  if (typeof v === 'number') return 'num';
  if (typeof v === 'boolean') return 'bool';
  return 'obj';
};

/**
 * 写之前的一次预遍历：非法键名**一次列全**（按出场顺序），字符闸门指认第一个越界者。
 * 分两趟而不是边写边报，是因为"改三轮"与"改一轮"的差别就在这一格上。
 * @param {unknown} value
 */
const xmlWriteGate = (value) => {
  const badKeys = [];
  let firstKeyPath = '';
  let charError = null;
  const checkString = (s, path) => {
    if (charError !== null) return;
    const code = badCharIn(s);
    if (code) {
      charError = {
        kind: 'bad-char',
        message: `这个字符写进 XML 就丢了：${code}。XML 1.0 的字符集里没有它，`
          + '本站既不删也不转成数字引用，请把它换掉或删掉。',
        path,
      };
    }
  };
  if (typeof value === 'string') checkString(value, '');
  if (!isContainer(value)) {
    if (badKeys.length > 0) return { ok: false, error: invalidKeyError(badKeys, firstKeyPath) };
    return charError ? { ok: false, error: charError } : { ok: true };
  }
  const stack = [{ v: value, path: '', keys: keyListOf(value), i: 0 }];
  while (stack.length > 0) {
    const f = stack[stack.length - 1];
    if (f.i >= f.keys.length) { stack.pop(); continue; }
    const key = f.keys[f.i];
    f.i += 1;
    const child = f.v[key];
    const path = pointerChild(f.path, key);
    if (!Array.isArray(f.v) && !isLegalName(String(key))) {
      badKeys.push(String(key));
      if (firstKeyPath === '') firstKeyPath = path;
    }
    if (typeof child === 'string') checkString(child, path);
    else if (isContainer(child)) stack.push({ v: child, path, keys: keyListOf(child), i: 0 });
  }
  if (badKeys.length > 0) return { ok: false, error: invalidKeyError(badKeys, firstKeyPath) };
  if (charError !== null) return { ok: false, error: charError };
  return { ok: true };
};

const invalidKeyError = (keys, path) => ({
  kind: 'invalid-key',
  message: `这些对象键名不能当 XML 标签名：${keys.join('、')}。`
    + '标签名要字母或下划线起始，后面跟字母、数字、点、下划线或连字符，且不以 xml 起始、不带冒号。',
  path,
  keys,
});

/**
 * JSON 值 → XML 文本（本站自己那一族无损子集）。显式栈：`MAX_DEPTH` 那一档的合法输入
 * 用递归下降写会先炸调用栈，而炸栈的报错给不出用户要的那一格内容。
 * @param {unknown} value
 * @param {{root?: string, indent?: string}} [options]
 * @returns {{ok: true, text: string} | {ok: false, error: {kind: string, message: string, path: string, keys?: string[]}}}
 */
export function jsonToXml(value, options = {}) {
  const opts = options || {};
  const root = opts.root === undefined ? 'json' : String(opts.root);
  const indent = opts.indent === undefined ? 'two' : opts.indent;
  if (!INDENT_MODES.includes(indent)) {
    throw new RangeError(`jsonToXml 只认 INDENT_MODES 里的那几档：${INDENT_MODES.join(' | ')}`);
  }
  // 第三格 `true`：XML 这一族的层数要把标量叶也算上，与读侧那道闸门同一把尺（见 `scanJson` 的 JSDoc）。
  const scan = scanJson(value, MAX_DEPTH, true);
  if (!scan.ok) return { ok: false, error: scan.error };
  if (!isLegalName(root)) {
    return {
      ok: false,
      error: { kind: 'invalid-root', message: `根元素名 ${root === '' ? '（空）' : root} 不能当 XML 标签名。`, path: '' },
    };
  }
  const names = xmlWriteGate(value);
  if (!names.ok) return { ok: false, error: names.error };

  const unit = INDENT_UNIT[indent];
  const out = [];
  const stack = [{ name: root, v: value, level: 0, keys: null, i: 0 }];
  while (stack.length > 0) {
    const f = stack[stack.length - 1];
    if (f.keys === null) {
      const kind = xmlKindOf(f.v);
      const pad = unit.repeat(f.level);
      if (!isContainer(f.v)) {
        out.push(`${pad}<${f.name} t="${kind}">${xmlEscape(xmlLeafText(f.v))}</${f.name}>`);
        stack.pop();
        continue;
      }
      f.keys = keyListOf(f.v);
      f.i = 0;
      // 空容器一律写成对标签：两种写法都读得懂，选读侧只有一种解释的那一个（U10）
      if (f.keys.length === 0) {
        out.push(`${pad}<${f.name} t="${kind}"></${f.name}>`);
        stack.pop();
        continue;
      }
      out.push(`${pad}<${f.name} t="${kind}">`);
      continue;
    }
    if (f.i >= f.keys.length) {
      out.push(`${unit.repeat(f.level)}</${f.name}>`);
      stack.pop();
      continue;
    }
    const key = f.keys[f.i];
    f.i += 1;
    stack.push({
      name: Array.isArray(f.v) ? 'item' : String(key),
      v: f.v[key],
      level: f.level + 1,
      keys: null,
      i: 0,
    });
  }
  return { ok: true, text: `${out.join('\n')}\n` };
}

/** 读侧内部的中断信号：只在模块内抛与接，绝不越过导出面（越界处 + kind + 人话原因） */
class OutOfSubset {
  constructor(kind, index, why) {
    this.kind = kind;
    this.index = index;
    this.why = why;
  }
}

/** 在制品节点：`start` 是它 `<` 的位置，`contentStart` 是 `>` 之后第一格，`firstAt` 是内容里第一个非空白字符 */
const xmlFrame = (tag, start) => ({
  name: tag.name,
  kind: tag.kind,
  start,
  contentStart: tag.after,
  value: tag.kind === 'obj' ? {} : tag.kind === 'arr' ? [] : null,
  merged: null,
  buf: '',
  firstAt: -1,
});

const xmlIsContainerKind = (kind) => kind === 'obj' || kind === 'arr';

/** 一段内容写进缓冲区，并记住"第一个非空白字符"的位置（bad-value 指认它） */
const xmlAppend = (f, piece, at) => {
  if (f.firstAt < 0) {
    for (let i = 0; i < piece.length; i += 1) {
      if (!isWs(piece.charAt(i))) { f.firstAt = at + i; break; }
    }
  }
  f.buf += piece;
};

/** 读一个开始标签（根与子共用）。名字段扫到空白 / `/` / `>` 为止，整段一起校验，越界指认段首 */
const readOpenTag = (text, at, level) => {
  if (level > MAX_DEPTH) {
    throw new OutOfSubset('depth', at, `嵌套到第 ${level} 层，超出本站的 ${MAX_DEPTH} 层上限`);
  }
  const n = text.length;
  let k = at + 1;
  while (k < n && !isWs(text.charAt(k)) && text.charAt(k) !== GT && text.charAt(k) !== SLASH) k += 1;
  if (k >= n) throw new OutOfSubset('unterminated', at, '标签没有 > 收尾');
  const name = text.slice(at + 1, k);
  if (name === '') throw new OutOfSubset('bad-name', at + 1, '元素名一个字符都没有');
  if (!isLegalName(name)) throw new OutOfSubset('bad-name', at + 1, `元素名 ${name} 不合法`);
  let i = k;
  const attrs = [];
  let selfClosing = false;
  for (;;) {
    i = skipWs(text, i);
    if (i >= n) throw new OutOfSubset('unterminated', at, '标签没有 > 收尾');
    const c = text.charAt(i);
    if (c === GT) { i += 1; break; }
    if (c === SLASH) {
      if (text.charAt(i + 1) !== GT) throw new OutOfSubset('bad-attr', i, '斜杠后面不是 >');
      selfClosing = true;
      i += 2;
      break;
    }
    const s = i;
    while (i < n && !isWs(text.charAt(i)) && text.charAt(i) !== EQ && text.charAt(i) !== GT && text.charAt(i) !== SLASH) i += 1;
    const aName = text.slice(s, i);
    if (aName === '') throw new OutOfSubset('bad-attr', i, '属性名一个字符都没有');
    if (!isLegalName(aName)) throw new OutOfSubset('bad-name', s, `属性名 ${aName} 不合法`);
    i = skipWs(text, i);
    if (text.charAt(i) !== EQ) throw new OutOfSubset('bad-attr', s, `属性 ${aName} 后面没有等号`);
    i = skipWs(text, i + 1);
    const q = text.charAt(i);
    if (q !== QUOTE && q !== APOS) throw new OutOfSubset('bad-attr', s, `属性 ${aName} 的值没有引号`);
    const close = text.indexOf(q, i + 1);
    if (close === -1) throw new OutOfSubset('unterminated', i, '属性的引号没有合上');
    attrs.push({ name: aName, at: s, value: text.slice(i + 1, close), valueAt: i });
    i = close + 1;
  }
  if (attrs.length > 1) {
    throw new OutOfSubset('bad-attr', attrs[1].at, `元素 ${name} 上只许有 t 这一个属性`);
  }
  if (attrs.length === 0) {
    throw new OutOfSubset('bad-shape', at, `元素 ${name} 缺 t 属性：这一族把类型写在 t= 上`);
  }
  const t = attrs[0];
  if (t.name !== 't') throw new OutOfSubset('bad-attr', t.at, `元素 ${name} 的属性名是 ${t.name}，本站只认 t`);
  if (!XML_KINDS.includes(t.value)) {
    throw new OutOfSubset('bad-shape', t.valueAt, `t 的值 ${t.value} 不在册，只认 ${XML_KINDS.join(' / ')}`);
  }
  return { name, kind: t.value, selfClosing, after: i };
};

/** 注释：`<!--` 起始，越界指认它自己的 `<`（读不下去的时候，指认构造的开头最有用） */
const readComment = (text, at) => {
  const end = text.indexOf('-->', at + 4);
  if (end === -1) throw new OutOfSubset('unterminated', at, '注释没有 --> 收尾');
  return end + 3;
};

/** CDATA：内容原样进缓冲区，里面的尖括号与 & 都不算标签也不算实体（U13 的接受面） */
const readCdata = (text, at, f) => {
  const end = text.indexOf(']]>', at + 9);
  if (end === -1) throw new OutOfSubset('unterminated', at, 'CDATA 没有 ]]> 收尾');
  xmlAppend(f, text.slice(at + 9, end), at + 9);
  return end + 3;
};

/** 实体引用：五个预定义 + 数字引用，数字引用要过 XML 1.0 的字符集与代理项两档 */
const readEntity = (text, at, f) => {
  const semi = text.indexOf(SEMI, at + 1);
  if (semi === -1) throw new OutOfSubset('bad-entity', at, '实体引用没有分号收尾');
  const body = text.slice(at + 1, semi);
  if (body.charAt(0) === '#') {
    const hex = body.charAt(1) === 'x' || body.charAt(1) === 'X';
    const digits = hex ? body.slice(2) : body.slice(1);
    if (!digits || !/^[0-9a-fA-F]+$/.test(digits)) {
      throw new OutOfSubset('bad-entity', at, `数字引用 &#${hex ? 'x' : ''}${body.slice(1)}; 的数字不合法`);
    }
    const code = parseInt(digits, hex ? 16 : 10);
    if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) || !isXmlChar(code)) {
      throw new OutOfSubset('bad-entity', at, `数字引用指向的 ${hexPoint(code)} 不是 XML 1.0 能存的字符`);
    }
    xmlAppend(f, String.fromCodePoint(code), at);
    return semi + 1;
  }
  if (!hasOwn(XML_ENTITIES, body)) {
    throw new OutOfSubset('bad-entity', at,
      `未注册的实体 &${body};：这一族只认 ${Object.keys(XML_ENTITIES).map((k) => `&${k};`).join(' ')}，也不读外部实体`);
  }
  xmlAppend(f, XML_ENTITIES[body], at);
  return semi + 1;
};

/** XML 1.0 的字符集（数字引用那一档用它校验；C0 里只留 `\t` `\n` `\r`） */
const isXmlChar = (code) => code === 9 || code === 10 || code === 13
  || (code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd)
  || (code > 0xffff && code <= 0x10ffff);

/** 子元素完成 → 挂到父亲身上。对象键同名时归并成数组（本站的写器发不出这一族，它是为手改过的合法 XML 留的） */
const xmlAttach = (parent, name, value) => {
  if (parent.kind === 'arr') { parent.value.push(value); return; }
  if (hasOwn(parent.value, name)) {
    if (parent.merged === null) parent.merged = new Map();
    if (parent.merged.has(name)) { parent.merged.get(name).push(value); return; }
    const merged = [parent.value[name], value];
    parent.merged.set(name, merged);
    setOwn(parent.value, name, merged);
    return;
  }
  setOwn(parent.value, name, value);
};

/** 标量内容收口：`str` 不 trim，其余三档按 trim 后的内容校验，越界指认第一个非空白字符（U12） */
const xmlScalarValue = (f) => {
  if (f.kind === 'str') return f.buf;
  const trimmed = f.buf.trim();
  const at = f.firstAt < 0 ? f.contentStart : f.firstAt;
  if (f.kind === 'null') {
    if (trimmed !== '') throw new OutOfSubset('bad-value', at, `类型 null 的内容必须是空的，这里是 ${trimmed}`);
    return null;
  }
  if (f.kind === 'bool') {
    if (trimmed !== 'true' && trimmed !== 'false') {
      throw new OutOfSubset('bad-value', at, `类型 bool 的内容只能是 true 或 false，这里是 ${trimmed}`);
    }
    return trimmed === 'true';
  }
  if (!NUM_RE.test(trimmed)) {
    throw new OutOfSubset('bad-value', at, `${trimmed === '' ? '（空）' : trimmed} 不是合法的 JSON 数字`);
  }
  return Number(trimmed);
};

const xmlDone = (f) => (xmlIsContainerKind(f.kind) ? f.value : xmlScalarValue(f));

/**
 * 值树：显式栈，深度由 `readOpenTag` 那一格当场判（边扫边判，不然 1001 层的输入
 * 先炸调用栈，报出来的就不是行列号了）。
 * @returns {{value: unknown, next: number}}
 */
const readXmlTree = (text, at) => {
  const open = readOpenTag(text, at, 1);
  const rootFrame = xmlFrame(open, at);
  let i = open.after;
  if (open.selfClosing) return { value: xmlDone(rootFrame), next: i };
  const stack = [rootFrame];
  while (stack.length > 0) {
    const f = stack[stack.length - 1];
    if (xmlIsContainerKind(f.kind)) {
      i = skipWs(text, i);
      if (text.startsWith('<!--', i)) { i = readComment(text, i); continue; }
      const c = text.charAt(i);
      if (c === '') throw new OutOfSubset('unterminated', i, `元素 ${f.name} 没有闭合标签`);
      if (c === LT && text.startsWith(SLASH, i + 1)) {
        i = readCloseTag(text, i, f.name);
        const value = xmlDone(f);
        stack.pop();
        if (stack.length === 0) return { value, next: i };
        xmlAttach(stack[stack.length - 1], f.name, value);
        continue;
      }
      if (c === LT && !text.startsWith('![', i + 1)) {
        const childAt = i;
        const child = readOpenTag(text, i, stack.length + 1);
        if (f.kind === 'arr' && child.name !== 'item') {
          throw new OutOfSubset('bad-shape', childAt, `数组里的子元素必须叫 item，这里是 ${child.name}`);
        }
        i = child.after;
        const childFrame = xmlFrame(child, childAt);
        if (child.selfClosing) xmlAttach(f, child.name, xmlDone(childFrame));
        else stack.push(childFrame);
        continue;
      }
      throw new OutOfSubset('bad-shape', i,
        f.kind === 'arr' ? '数组里只能有 item 元素，这里出现了裸文本' : '对象里只能有子元素，这里出现了裸文本');
    }
    // 标量：一路读到 `</`，中间的 CDATA 与注释不算内容的一部分（注释跳过、CDATA 进文本）
    for (;;) {
      if (i >= text.length) throw new OutOfSubset('unterminated', i, `元素 ${f.name} 没有闭合标签`);
      const c = text.charAt(i);
      if (c === LT) {
        if (text.startsWith('!--', i + 1)) { i = readComment(text, i); continue; }
        if (text.startsWith('![CDATA[', i + 1)) { i = readCdata(text, i, f); continue; }
        if (text.startsWith(SLASH, i + 1)) break;
        throw new OutOfSubset('bad-shape', i, `类型 ${f.kind} 的内容里不许有子元素`);
      }
      if (c === AMP) { i = readEntity(text, i, f); continue; }
      let k = i;
      while (k < text.length && text.charAt(k) !== LT && text.charAt(k) !== AMP) k += 1;
      xmlAppend(f, text.slice(i, k), i);
      i = k;
    }
    i = readCloseTag(text, i, f.name);
    const value = xmlDone(f);
    stack.pop();
    if (stack.length === 0) return { value, next: i };
    xmlAttach(stack[stack.length - 1], f.name, value);
  }
  throw new OutOfSubset('bad-document', text.length, '没有读完一个完整的根元素');
};

/** 闭合标签：名字必须与开着的那个逐字相同，且不许带属性 */
const readCloseTag = (text, at, name) => {
  const n = text.length;
  const s = at + 2;
  let k = s;
  while (k < n && !isWs(text.charAt(k)) && text.charAt(k) !== GT) k += 1;
  if (k >= n) throw new OutOfSubset('unterminated', at, `闭合标签 </${name}> 没有 > 收尾`);
  const got = text.slice(s, k);
  if (got !== name) throw new OutOfSubset('bad-name', at, `闭合标签是 ${got}，但它要关的是 ${name}`);
  const after = skipWs(text, k);
  if (text.charAt(after) !== GT) throw new OutOfSubset('bad-attr', k, `闭合标签 </${name}> 里不许有属性`);
  return after + 1;
};

/**
 * XML 文本 → JSON 值。只读本站那一族子集，越界整体拒绝并指认位置（U12 四十八档逐个钉）。
 * BOM 与 CSV 同一条口径（U15、U16）：剥掉它才解析（它是字节序记号，不是内容，也不占"根元素之前"
 * 那一族的空白），但**位置一律指原文**——面板高亮吃的是用户粘进去的那一份，BOM 就占第 1 行第 1 列。
 * @param {string} text
 * @returns {{ok: true, value: unknown} | {ok: false, error: {kind: string, message: string, line: number, column: number, index: number, snippet: string}}}
 */
export function xmlToJson(text) {
  typeGuard('xmlToJson', text);
  const g = gate(text);
  if (!g.ok) return { ok: false, error: gateError(g, text) };
  const bom = text.charCodeAt(0) === 0xfeff;
  const body = bom ? text.slice(1) : text;
  const shift = bom ? 1 : 0;
  const at = (index) => index + shift;
  try {
    const n = body.length;
    let i = 0;
    let sawDecl = false;
    for (;;) {
      i = skipWs(body, i);
      if (i >= n) {
        return { ok: false, error: readError('empty', text, at(n), '没有找到根元素：整份输入是空的、只有空白，或只有声明与注释') };
      }
      if (body.charAt(i) !== LT) {
        return { ok: false, error: readError('bad-document', text, at(i), '根元素之前只许空白、注释、声明与处理指令') };
      }
      if (body.startsWith(SLASH, i + 1)) {
        return { ok: false, error: readError('bad-document', text, at(i), '文档以闭合标签开头，找不到要开的那个根元素') };
      }
      if (body.startsWith('!', i + 1)) {
        if (body.startsWith('--', i + 2)) { i = readComment(body, i); continue; }
        if (body.startsWith('[CDATA[', i + 2)) {
          return { ok: false, error: readError('bad-document', text, at(i), '根元素之前不许有 CDATA') };
        }
        return { ok: false, error: readError('doctype', text, at(i), '本站不读文档类型声明（DOCTYPE）与外部实体') };
      }
      if (body.startsWith('?', i + 1)) {
        const end = body.indexOf('?>', i);
        if (end === -1) throw new OutOfSubset('unterminated', i, '处理指令没有 ?> 收尾');
        let k = i + 2;
        while (k < n && !isWs(body.charAt(k)) && body.charAt(k) !== GT && body.charAt(k) !== '?') k += 1;
        if (body.slice(i + 2, k).toLowerCase() === 'xml') {
          if (sawDecl) {
            return { ok: false, error: readError('bad-document', text, at(i), 'XML 声明只能出现在文档最开头一次') };
          }
          sawDecl = true;
        }
        i = end + 2;
        continue;
      }
      break;
    }
    const tree = readXmlTree(body, i);
    const trailing = skipWs(body, tree.next);
    if (trailing < n) {
      return { ok: false, error: readError('trailing', text, at(trailing), '根元素之后还有内容：本站只读一个根元素') };
    }
    return { ok: true, value: tree.value };
  } catch (err) {
    if (err instanceof OutOfSubset) {
      return { ok: false, error: readError(err.kind, text, at(err.index), err.why) };
    }
    throw err;
  }
}

// ── CSV 那一族 ───────────────────────────────────────────────────────────────

/**
 * 分隔符是"档位"不是"字符串"：与 §S 的 modeOf 同形，非法值当场 `RangeError`。
 * `undefined` 走默认逗号（面板的控件把"没选"传成 undefined），其余一律单个字符、
 * 且不能是 `"` 或换行——那三种会让写出去的文本读不回来。
 */
const resolveDelimiter = (api, value) => {
  if (value === undefined) return ',';
  if (typeof value !== 'string' || value.length !== 1 || value === QUOTE || value === '\n' || value === '\r') {
    throw new RangeError(`${api} 的分隔符只认单个字符，且不能是引号或换行：收到的是 ${describeBad(value)}`);
  }
  return value;
};

const describeBad = (v) => (typeof v === 'string' ? JSONish(v) : String(v));

/** 把任意入参写成可看的样子，但不借 JSON.stringify（U18 那条禁令） */
const JSONish = (s) => `"${escapeText(s)}"`;

const cellText = (v) => {
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array) return b64(v);
  if (typeof v === 'string') return v;
  if (v === null) return '';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return compactJson(v);
};

/**
 * 嵌套容器 → 一格紧凑 JSON 文本。显式栈（同一族第二个理由：单元格里也可能藏着 999 层）。
 * 数字用 `String(n)`、字符串用 `escapeText`，所以这一格交出去的东西本身就是合法 JSON。
 * @param {unknown} root
 * @returns {string}
 */
const compactJson = (root) => {
  const out = [];
  const stack = [{ v: root, entered: false, keys: null, i: 0 }];
  while (stack.length > 0) {
    const f = stack[stack.length - 1];
    if (!f.entered) {
      f.entered = true;
      const isArr = Array.isArray(f.v);
      f.keys = keyListOf(f.v);
      out.push(isArr ? '[' : '{');
      if (f.keys.length === 0) {
        out.push(isArr ? ']' : '}');
        stack.pop();
      }
      continue;
    }
    if (f.i >= f.keys.length) {
      out.push(Array.isArray(f.v) ? ']' : '}');
      stack.pop();
      continue;
    }
    const key = f.keys[f.i];
    f.i += 1;
    if (f.i > 1) out.push(',');
    const child = f.v[key];
    if (!Array.isArray(f.v)) {
      out.push(`"${escapeText(String(key))}":`);
      if (child instanceof Date) out.push(`"${escapeText(child.toISOString())}"`);
      else if (child instanceof Uint8Array) out.push(`"${escapeText(b64(child))}"`);
      else if (isContainer(child)) stack.push({ v: child, entered: false, keys: null, i: 0 });
      else out.push(scalarJson(child));
      continue;
    }
    if (child instanceof Date) out.push(`"${escapeText(child.toISOString())}"`);
    else if (child instanceof Uint8Array) out.push(`"${escapeText(b64(child))}"`);
    else if (isContainer(child)) stack.push({ v: child, entered: false, keys: null, i: 0 });
    else out.push(scalarJson(child));
  }
  return out.join('');
};

const scalarJson = (v) => {
  if (typeof v === 'string') return `"${escapeText(v)}"`;
  if (v === null) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return 'null';
};

const csvQuote = (text, delimiter) => {
  let need = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charAt(i);
    if (c === delimiter || c === QUOTE || c === '\n' || c === '\r') { need = true; break; }
  }
  if (!need) return text;
  let out = QUOTE;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charAt(i);
    out += c === QUOTE ? '""' : c;
  }
  return out + QUOTE;
};

/** 表头占位与去重：空键名给 `col_<1 起的序号>`，撞名（含撞占位名）就往后加 `__2`、`__3`（U14/U15） */
const uniqueColumnName = (used, base, position) => {
  const root = base === '' ? `col_${position}` : base;
  if (!used.has(root)) {
    used.add(root);
    return root;
  }
  let k = 2;
  while (used.has(`${base}__${k}`)) k += 1;
  const name = `${base}__${k}`;
  used.add(name);
  return name;
};

const CSV_SHAPE_MESSAGE = 'CSV 只收两种形状：对象数组（每个对象一行）或单个对象（当一行看）。'
  + '标量、纯数组与数组套数组没有"列"这一层，写不成一张表。';

/**
 * JSON 值 → CSV 文本（CRLF 收尾、RFC 4180 的引号转义、嵌套容器压成一格 JSON 文本）。
 * @param {unknown} value
 * @param {{delimiter?: string}} [options]
 * @returns {{ok: true, text: string} | {ok: false, error: {kind: string, message: string, path: string}}}
 */
export function jsonToCsv(value, options = {}) {
  const opts = options || {};
  const delimiter = resolveDelimiter('jsonToCsv', opts.delimiter);
  const rows = Array.isArray(value) ? value : [value];
  const shapeError = csvShapeOf(value, rows);
  if (shapeError) return { ok: false, error: shapeError };
  const scan = scanJson(value, MAX_DEPTH);
  if (!scan.ok) return { ok: false, error: scan.error };

  // 列由**键的出场顺序**决定；`columns` 是给人看的名，`columnKey` 是取格子用的真键
  // （表头会改空键名与撞名，两者不是一回事，靠 indexOf 反查既慢又会在撞名时取错格子）
  const columns = [];
  const columnKey = [];
  const seen = new Map();
  const used = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.set(key, columns.length);
        columns.push(uniqueColumnName(used, key, columns.length + 1));
        columnKey.push(key);
      }
    }
  }
  if (columns.length === 0) {
    return {
      ok: false,
      error: { kind: 'empty', message: '这些对象一个键都没有，写不出表头：至少给一行带键的对象。', path: '' },
    };
  }
  const lines = [columns.map((name) => csvQuote(name, delimiter)).join(delimiter)];
  for (const row of rows) {
    const cells = [];
    for (let c = 0; c < columns.length; c += 1) {
      const key = columnKey[c];
      cells.push(csvQuote(cellText(hasOwn(row, key) ? row[key] : null), delimiter));
    }
    lines.push(cells.join(delimiter));
  }
  return { ok: true, text: `${lines.join('\r\n')}\r\n` };
}

/** 形状闸门：`[]` / `[{}]` / `{}` 落 empty（没有列可写），其余非"对象数组/对象"落 shape（U14） */
const csvShapeOf = (value, rows) => {
  const bad = (kind, message) => ({ kind, message, path: '' });
  if (Array.isArray(value)) {
    for (const row of rows) {
      if (!isPlainObject(row)) return bad('shape', CSV_SHAPE_MESSAGE);
    }
    return null;
  }
  if (isPlainObject(value)) return null;
  return bad('shape', CSV_SHAPE_MESSAGE);
};

/**
 * CSV 文本 → 对象数组。一律字符串（`meta.allStrings` 这一格就是说给它自己的），
 * 并交回六格 meta：面板上"几行几列、什么换行、有没有 BOM"读的就是它。
 * @param {string} text
 * @param {{delimiter?: string}} [options]
 * @returns {{ok: true, value: object[], meta: {rows: number, columns: number, delimiter: string, allStrings: boolean, bom: boolean, lineEnding: string}} | {ok: false, error: {kind: string, message: string, line: number, column: number, index: number, snippet: string}}}
 */
export function csvToJson(text, options = {}) {
  typeGuard('csvToJson', text);
  const opts = options || {};
  const delimiter = resolveDelimiter('csvToJson', opts.delimiter);
  const g = gate(text);
  if (!g.ok) return { ok: false, error: gateError(g, text) };
  const bom = text.charCodeAt(0) === 0xfeff;
  const body = bom ? text.slice(1) : text;
  // 位置一律报回**用户手里那一份文本**的坐标：BOM 是第 1 行第 1 列那一个字符，
  // 所以从 body 读回来的下标要整体加回去（面板拿它做选区，差一格就高亮错一格）。
  const shift = bom ? 1 : 0;
  const at = (index) => index + shift;
  try {
    if (onlyWhitespace(body)) {
      return {
        ok: false,
        error: readError('empty', text, text.length, '没有可解析的 CSV 内容：整份输入是空的、只有空白，或只有空行'),
      };
    }
    const { records, endings } = readRecords(body, delimiter);
    const header = records[0].cells;
    const used = new Set();
    const names = header.map((cell, index) => uniqueColumnName(used, cell, index + 1));
    const rows = [];
    for (let r = 1; r < records.length; r += 1) {
      const { cells, at: starts } = records[r];
      if (cells.length > names.length) {
        throw new OutOfCsv('ragged', starts[names.length],
          `这一行有 ${cells.length} 格，表头只有 ${names.length} 格`);
      }
      const row = {};
      for (let c = 0; c < names.length; c += 1) setOwn(row, names[c], cells[c] === undefined ? '' : cells[c]);
      rows.push(row);
    }
    const kinds = [...endings];
    return {
      ok: true,
      value: rows,
      meta: {
        rows: rows.length,
        columns: names.length,
        delimiter,
        allStrings: true,
        bom,
        lineEnding: kinds.length === 0 ? 'none' : kinds.length === 1 ? kinds[0] : 'mixed',
      },
    };
  } catch (err) {
    if (err instanceof OutOfCsv) {
      return { ok: false, error: readError(err.kind, text, at(err.index), err.why) };
    }
    throw err;
  }
}

/** 整份输入是不是只有空格、制表与换行（空行也算）——没有表头可读，就是"没有内容"那一档（U16） */
const onlyWhitespace = (text) => {
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charAt(i);
    if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') return false;
  }
  return true;
};

/** 读侧内部的 CSV 中断信号（与 XML 的 OutOfSubset 同一条理由：不外泄）。位置交给 readError 换算 */
class OutOfCsv {
  constructor(kind, index, why) {
    this.kind = kind;
    this.index = index;
    this.why = why;
  }
}

/**
 * RFC 4180 的状态机，补三处：引号 doubling、内嵌换行、CRLF（外加老 Mac 的裸 CR）。
 * 交回"记录 → 格子数组"与每格的起始下标，越界那一档才指认得出多出来的那一格。
 * @returns {{records: Array<{cells: string[], at: number[]}>, endings: Set<string>}}
 */
const readRecords = (text, delimiter) => {
  const records = [];
  const endings = new Set();
  let cells = [];
  let starts = [];
  let cell = '';
  let cellAt = 0;
  let cellStarted = false;
  let quoted = false;
  let quoteAt = -1;
  let i = 0;
  const flushCell = (at) => {
    cells.push(cell);
    starts.push(at);
    cell = '';
    cellStarted = false;
  };
  const flushRecord = () => {
    records.push({ cells, at: starts });
    cells = [];
    starts = [];
  };
  while (i < text.length) {
    const c = text.charAt(i);
    if (quoted) {
      if (c === QUOTE) {
        if (text.charAt(i + 1) === QUOTE) { cell += QUOTE; i += 2; continue; }
        quoted = false;
        i += 1;
        continue;
      }
      cell += c;
      i += 1;
      continue;
    }
    if (c === QUOTE && !cellStarted) {
      quoted = true;
      quoteAt = i;
      cellStarted = true;
      i += 1;
      continue;
    }
    if (c === delimiter) { flushCell(cellAt); cellAt = i + 1; i += 1; continue; }
    if (c === '\r' || c === '\n') {
      if (c === '\r' && text.charAt(i + 1) === '\n') { endings.add('crlf'); i += 2; } else {
        endings.add(c === '\r' ? 'cr' : 'lf');
        i += 1;
      }
      flushCell(cellAt);
      flushRecord();
      cellAt = i;
      continue;
    }
    cell += c;
    cellStarted = true;
    i += 1;
  }
  if (quoted) {
    throw new OutOfCsv('unterminated', quoteAt, '引号包住的字段没有闭合的引号');
  }
  if (cell !== '' || cellStarted || cells.length > 0) {
    flushCell(cellAt);
    flushRecord();
  }
  return { records, endings };
};

/**
 * 三个往返读数：面板上那三个"是否等价"。定义与判据里的手工往返逐字一致
 * （写侧不抛且 ok、读侧 ok、回来与原值深相等），所以它显示 ✓ 的时候一定真等价；
 * 转不了的那些族（环、非 JSON 值、超过 YAML 深度的嵌套）交回 false 而不是抛。
 * @param {unknown} value
 * @returns {{yaml: boolean, xml: boolean, csv: boolean}}
 */
export function roundTrips(value) {
  return {
    yaml: canRoundTrip(value, jsonToYaml, yamlToJson),
    xml: canRoundTrip(value, jsonToXml, xmlToJson),
    csv: canRoundTrip(value, jsonToCsv, csvToJson),
  };
}

const canRoundTrip = (value, write, read) => {
  try {
    const written = write(value);
    if (!written.ok) return false;
    const back = read(written.text);
    return back.ok === true && sameValue(back.value, value);
  } catch {
    return false;
  }
};

/**
 * 深相等，严格到把 `-0` 与 `+0` 分成两格（`uRound` 用的就是 assert.deepStrictEqual 的口径）。
 * 迭代而不是递归：这一族要处理 1000 层的合法输入。
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
const sameValue = (a, b) => {
  const stack = [[a, b]];
  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (Object.is(x, y)) continue;
    if (x === null || y === null || typeof x !== 'object' || typeof y !== 'object') return false;
    const xArr = Array.isArray(x);
    if (xArr !== Array.isArray(y)) return false;
    if (x instanceof Date || y instanceof Date || x instanceof Uint8Array || y instanceof Uint8Array) return false;
    const xa = xArr ? keyListOf(x) : Object.keys(x);
    const yb = xArr ? keyListOf(y) : Object.keys(y);
    if (xa.length !== yb.length) return false;
    for (let i = 0; i < xa.length; i += 1) {
      const key = xa[i];
      if (String(key) !== String(yb[i])) return false;
      stack.push([x[key], y[key]]);
    }
  }
  return true;
};
```

### 落地记录（2026-09-29，Task 4 那一格实跑）

- [x] **Step 1 §U 续 13 条红 → Step 2 绿 → Step 3 镜像 + 门禁 + 提交**

Step 1 的那一轮红是 `# tests 316 / # pass 303 / # fail 13`——13 条全落在 U6–U18，没有一条"顺手就绿"。
Step 2 之后：`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs`
→ `# tests 316 / # pass 316 / # fail 0`（8.7s）。文件头的用例分布表按 §0.6 那条 awk 口径重算，
不是手抄：§U 那一格现在写 `18`（前五条 U1–U5 是 Task 1 的接线自证，后十三条 U6–U18 是本格），
合计 316，与 runner 的 `# tests` 对齐。单跑 §U：`node --test --test-name-pattern '^U' scripts/toolkit-tests.mjs`
→ 18/18。

**判据被实测回改的地方（四处，改的全是期望值，实现一字未动）**：

1. **U7 负零**：先按"`-0` 这一族一定在 YAML 丢"下断言，实测 `dump({a:-0})` 给 `a: -0.0`、
   读回来的 `Object.is(..., -0)` 是 **true**（YAML11 的 float 记号走 `Number('-0.0')`）。
   U7 于是断"读回仍是 -0"，U17 的 `roundTrips({a:-0})` 跟着改口为 `{yaml:true, xml:true, csv:false}`——
   负零只有 CSV 保不住，那一档由 U13 的"负零写成 0"钉着。
2. **U12 的 `<!-- only -->\n`**：期望 13、实读 14。空文本那一档指的是**结尾**（`index = text.length`），
   注释行 13 字符之后还有那个 `\n`。
3. **U12 的 `bool 装 TRUE` / `null 有内容`**：两档都期望 11、实读 12。指认的是内容里第一个非空白字符，
   而 `<a t="bool">` 与 `<a t="null">` 都是 12 字符；隔壁 `<a t="str">` 是 11 字符，所以 str/num
   那两档仍在 11——差一个字符的标签长度，一开始看漏了。
4. **U16 的 `a\r\n"b`**：期望 2、实读 3。两处"引号没合上"都指认**那个没合上的引号自己**。

**实现里三处"两难选完并钉死"的口径**（都写进了注释，因为它们只看代码看不出来）：

1. `prescanYaml` 用三个旗标而不是一面旗：`pending`/`open` 只判"这是不是第二份文档"，
   `everOpen` 只判"到底有没有内容"，`endAt` 记住 `...` 落在哪。单旗标版本会把
   `---\n---\na: 1\n` 静默当成一份文档（那一档在 U9 里，改完当场红）。
2. 行列一律由 `index` 经 `locate` 推，**不读**内置件的 `mark.line` / `mark.column`：它的消息写
   `(1:5)`，那里的 column 从 0 起。两套尺在 CRLF 与 emoji 上必然分家，所以 U9 每一档都额外自证
   `uLocate(text, e.index)` 与 error 的行列一致。
3. CSV 读侧剥 BOM 只用于解析（`body`），所有 error 的 `index` 经 `at()` 加回 `shift`：
   面板高亮吃的是**用户粘进去的那份原文**，不是剥过 BOM 的副本。`onlyWhitespace(body)` 那一档
   交回 `empty`（空行、纯空白都不构成表头），而不是硬造一个零列的表。

**门禁二**：`FILE_TARGETS` 加进 `dev/js/tools/json-convert.js`——它是这份清单里第一本
**站在内置件上面**的模块，镜像在这一格里另有两重用处（别人干净检出时，镜像是唯一能证明
"这本网关确实 import 了那 78,721B 的 vendored 文件、而且只 import 它"的东西）。
导出树 `--fix` 一共跑了两轮（第二轮是评审回合改完实现与判据之后），脚本自己的读数：
第一轮 `--fix：[段1] … 重写 1 块，6513 → 6513 行`（§A 块里的文件头用例分布表跟着 §U 的 18/合计 316 走）
与 `--fix：[段4] … 重写 1 块，4205 → 5174 行`；第二轮
`→ 已同步 scripts/toolkit-tests.mjs §U（磁盘 9418–10523）：计划[段4] 373–1419（1047 行）← 磁盘 1105 行`
`→ 已同步 dev/js/tools/json-convert.js：计划[段4] 3564–4933（1370 行）← 磁盘 1409 行`。
复跑：`✓ 全部已落地镜像与磁盘逐字节全等（未落地 0 节）`，56 个已落地镜像合计 1,119,776B，
其中三本整文件镜像 `json-core.js` 698 行、`json-ts.js` 310 行、`json-convert.js` 1409 行逐字节全等。

**门禁三**：在同一棵导出树里 `git init` + `git add -A` + 一条提交（让它看起来干净，
`dirtyFingerprint()` 才跑得过），`node scripts/verify-plan-blocks-teeth.mjs` → `exit=0`、
`35/35 通过`、末两格"副本回到全绿且工作树未被这些实验碰过"/"脏项 0 个前后一致"。

**门禁四（真重建，两棵树对拍）**：`git archive HEAD | tar -x` 出一份纯 HEAD 基线树，本格导出树一份，
各 `ln -s` 同一份 `node_modules` 后 `npx vite build` → 两棵都 `exit=0`。
两棵树的 `assets/{js,css}/*.min.*` 三列清单（路径 + raw 字节 + `cat f | gzip -9 | wc -c`）**各 33 件**
（23 js + 10 css），`diff` 无输出。这就是"本格的内置件与 `json-convert.js` 都没进任何现有页"的证据：
产物里没有 `js-yaml` 那一本，23 本 js 里 `import(` 命中 **0** 次。
共付三件在 HEAD 这一版的读数（与 Task 3 那格记录的逐字相同，与 §0.4 探针那格差的是 55cf005 那批动效）：

```text
assets/css/toolkit.min.css      raw 10,541B   gzip  2,306B
assets/js/toolkitCore.min.js    raw 19,109B   gzip  7,037B
assets/js/toolCodec.min.js      raw 59,317B   gzip 21,830B
```

**这一格里踩到的脚手架陷阱**（记下来，因为它是"红了不等于红对了"的第 25 种形状）：门禁四为了拿干净
产物先 `rm -rf assets`，而 `assets/` 在这个仓库里**是跟踪的**（`git ls-files assets` 346 件，含
`assets/img/tools/*.svg` 那两本图标）——删完再跑门禁二，读数从 `56 个镜像 / 1,114,549B` 掉成
`54 / 1,111,542B`，并冒出 `✗ 2 个目标对不上：assets/img/tools/idcard-tool.svg / codec-tool.svg`。
那不是镜像漂了，是**被核对的文件自己没了**。处置：`git checkout -- assets`（基线树那棵没有 `.git`，
改从活树 `git archive HEAD assets | tar -x` 补回），复跑门禁二回到 56/全等。
以后两棵树对拍要么在 build 之后恢复 `assets/`，要么把 build 输出到临时目录，别在核对之后留一个空壳。

**门禁五、六**：活树跑（它们读 `_site`），`check-tools-surface.mjs` → `exit=0`
（"收录面 2 条 ready 条目 × 5 组判据全绿"，核到 95 页）；`check-tools-surface-teeth.mjs` → `exit=0`
（"牙齿台账：36/36 组变异如期变红"+"全部变异已还原，复跑基线仍绿"）。
跑之前确认过 `vite build --watch` / `jekyll serve` 都没在跑，`_site` 不是活的。

```bash
git add dev/js/tools/json-convert.js scripts/toolkit-tests.mjs scripts/verify-plan-blocks.mjs \
        _docs/superpowers/plans/2026-09-29-tools-json-page.md \
        _docs/superpowers/plans/2026-09-25-online-tools-foundation.md
git commit -m "feat(tools): 段 4 Task 4 json-convert——YAML 走内置件、XML 立无损子集、CSV 补 RFC 4180（§U）"
```

（本格**不碰** `_data/onlineTools.yml` 与 `tools.html`：收录窗口开在 Task 7，此刻线上还进不去 JSON 页——
这是有意的，纯逻辑层先落地并全绿，页面那一格再一次性放行。）

#### 评审回合（六道门禁跑完后派的那一刀，2026-09-29）

派了一路只读评审审 `json-convert.js`（全量读实现 + 对 §U 判据 + 一轮随机变异输入 fuzz），
带回 7 条。**逐条实测复核**后才落笔——结论是 5 条真缺陷（已全部改口并补判据）、2 条经实测判为
"与 `JSON.stringify` 同形"（不动，读数记在下面）。判据先行：新增的那几格第一轮就红
（U8/U9/U11/U12/U13 五条 `not ok`，U8 的报错就是 `'boom'`——getter 抛出来的），改完实现回到
§U 18/18、全量 `# tests 316 / # pass 316 / # fail 0`。**这一轮只往既有 test 里加断言，没新开格子**，
所以文件头那张用例分布表一字未动。

真缺陷与它们的改口方向：

1. **深度两把尺合不拢**：读侧数的是**元素层数**（U12 钉死的既是它），写侧只数**容器层数**，
   而本站的 XML 编码里"一个值恰好一个元素"——最深那一格是标量时元素层数 = 容器层数 + 1。
   现场读数：`jsonToXml(uDeep(1000))` 交回 `ok`（2,023,023B 文本），`xmlToJson` 对同一份文本判
   `depth`（"嵌套到第 1001 层"）→ 面板上是一格亮着 ✓ 却转不回来。改口只改写侧
   （`scanJson(value, MAX_DEPTH, true)`，第三格"标量叶算不算一层"），读侧那把尺一字不动。
   U11 补的四格：999 层容器必须放行、1000 层必须拒且 Pointer 正好 1000 段（它就是被拒的那个标量叶）、
   `{MAX_DEPTH-1, MAX_DEPTH}` 两档写读必须同结论、`roundTrips(uDeep(1000)).xml` 必须是 `false`。
2. **XML 读侧不认 BOM**：YAML 靠内置件、CSV 走 `shift`，两族都处理，只有 XML 判 `bad-document`，
   而"整份输入只有一个 BOM"也不同归 `empty`——三族三样口径。补齐成与 CSV 同一条：剥 BOM 只为解析，
   **位置一律指原文**（U12 补"只有 BOM"与"BOM 之后的越界者"两档，U13 接受面补两档）。
3. **YAML 预扫误拒合法输入**：`a: 1\n...\n...\n` 被判成两份文档，实测内置件算**同一份**
   （`{a:1}`）。误拒合法输入比漏拒更伤用户，改成"已经关掉过一次就什么也不做"。
4. **同一处判据的反向那一格也真**：`---\n...\n---\n...` 第一份是空文档——旧代码只在 `pending`
   （有内容）时记结束位，`open` 却没内容那一档漏记，于是预扫放过、内置件报
   "expected a single document in the stream"，而 `yamlErrorKind` 把这句归进 `parse`——**kind 报错档**。
   改成 `pending || open` 都记结束位（U9 补一档，指认下标 4 那个 `...`：与"点线分文档"同一把尺，
   都是"把文本切成两份的第一个边界"）。
5. **出口那句"绝不抛"被 getter / Proxy 的 trap 破**：`jsonToYaml({ get a() { throw … } })` 把异常
   直接抛给调用方，`jsonToXml` / `jsonToCsv` 同（实测三格全抛）。面板喂的值一律出自 `parseJson`，
   那里头没有 getter，所以这一族只有"别人直接调模块"才撞得上——但三格并排站着，任何一格抛出去
   就是整块面板一次未捕获异常。`scanJson` 的走查包一层 catch，交回 `non-json` + 那一格的 Pointer
   （U8 的 `U8_REJECT` 补两档，另加一条"三个写函数一个都不许抛"的循环）。

实测判为**不是缺陷**的那两条，读数留在这里，因为"看着像缺陷"与"是与 `JSON.stringify` 同形"只差一张表：

- DAG 无记忆化、按引用数指数展开：`n=16` 的双共享 DAG 实测 `JSON.stringify` 21ms / 1.38 MB，
  本站 `jsonToYaml` 1,105ms / 6.68 MB、`jsonToXml` 1,000ms / 13.8 MB——增长是同一条曲线（`2^n`），
  而"DAG 写两份"正是 U8 钉死的"与 stringify 同形"。**加记忆化会把 DAG 判成环**，那是把用户的内容弄丢。
  面板到不了这一族：`parseJson` 出来的值永远是树（JSON 文本里没有共享引用）。
- Symbol 键与非枚举键被"静默丢弃"：`JSON.stringify({[Symbol('s')]:1, a:1})` 与
  `JSON.stringify(Object.defineProperty({a:1},'b',{value:2}))` 都是 `{"a":1}`——同一口径，不是本站改写。
- （顺带）写侧没有产出上限：`gate` 那一族管的是**进来的**文本，给写侧再立一把尺就是自创第二份预算；
  要不要限留到 Task 8 量 §7 那两行时按实测判，已记进下面的账。

还有一处**注释与用户可见的消息在说谎**（不改行为，改文案）：`settleYamlValue` 的 JSDoc 与 `non-json`
那句消息都写着"`!!set` / `!!omap` 那一族"。实测：`!!set` 在内置件那关就报 unknown tag（走 `unknown-tag`，
到不了这里），`!!omap` 在 YAML11 里给回的就是"单键对象组成的数组"——那是 omap 在 JSON 里唯一成立的
写法，原样收下不是换类型。两处都改成实际拦得住的那一族（bigint / symbol / 函数 / 原型不是 Object 的脏对象）。


**留给下一格的账**：§7 证件页首屏那一格的余量已被 55cf005 的共付件涨幅继续吃掉（`toolkit.min.css`
gzip 2,135B → 2,306B），Task 8 量那两行之前必须先在 HEAD 上重算一遍，别沿用 §0.4 探针的旧读数。
第二笔：**写侧要不要产出上限**（评审回合那条"3 万节点写出十几 MB"）。本格没加——`gate` 那把尺量的是
进来的文本，给写侧另立一把就是站内第二份字节预算。但它确实是真的运行期账：Task 8 量 §7 时一并量
"最大合法输入（5 MiB）写进 YAML / XML / CSV 各自撑到多大"，越界就在 §W 的输出框那一侧处理
（分批渲染 / 提示另存），而不是回头改纯逻辑层的闸门。

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

- [x] Step 1 §V 16 条红 → Step 2 绿（假 DOM 夹具形状照 §I）→ Step 3 镜像 + 门禁 + 提交
  （`feat(tools): 段 4 Task 5 json-tree——拍平纯函数 + 只渲染可视行的控制器（§V）`）。

**落地记录（2026-09-29）**：`dev/js/tools/json-tree.js` 落盘，`scripts/toolkit-tests.mjs` 的 §V 16 条绿。
跑法两条：`node --test --test-name-pattern '^V' scripts/toolkit-tests.mjs` → 16/16，
`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs` →
`# tests 332 / # pass 332 / # fail 0`。文件头用例分布表按 §0.6 那口径重算（§V 写 16、合计 332），
段 1 计划里那份 §A 文件头镜像跟着 `--fix` 走，不手抄。

**判据被实测回改的地方（四处，其中三处是我的草稿自己错，一处是夹具撞了默认档）**：

1. V1 的禁令里那一条 `'window'` 换成 `'window.'`。草稿写的是裸词，而控制器构造函数的形参就叫
   `windowSize`——禁令要挡的是"模块自己读全局窗口"，不是"形参里带 window 这个字根"，
   带点才是那个形状（与 §R 的 `'performance.'` 同一写法）。
2. V3 的 Pointer 写成了简写：`chain = { l1: { l2: … } }` 那一条链，磁盘上的 Pointer 是
   `/l1/l2`、`/l1/l2/l3`，草稿里写成了 `/l2`、`/l3`。这不是笔误级别的错——按草稿那串断言，
   一个把 Pointer 拼成"最后一段键名"的实现会全绿。改成全路径后 V3 第二条从"一路到底 6 行"
   收成"点到哪一格就停在那一格"的 5 行，正好把默认档与显式集的边界又钉了一次。
3. V14 的行属性表原本排在滚动之后。`scrollTop = 1200` 一滚，`rowAt(0)` 就是第 40 行而不是根，
   那六条 `data-jt-*` / `aria-*` / `textContent` 断言全部落在别人身上——判据会红，但红得
   让人先去怀疑实现。挪到滚动之前，并补一条"滚到 1200 之后窗口第一行是 `/r39`"，
   把"上面留了十行缓冲"这件事也从 DOM 侧钉住（它此前只在 `visibleRange()` 里可读）。
4. V15 的 `onViewChange` 读数用了 240 / 250。两个数都落在同一个窗口，"换了区间才叫一次"
   那一条根本不可能成立；上一轮的 `-5` 夹回 0 之后窗口是 `[0, 79]`，240 也还是这个窗口。
   换成 4000 / 4010（都从第 200 行起，窗口 `[180, 259]`），那条判据量的才是它想量的东西。

夹具那一处：`vSet(n)` 造的是"一层纯标量、n 个键"的行集，V15/V16 要五千行，
而 `flatten` 的默认 `maxKeys` 是 `ROW_KEYS_LIMIT = 2000`——于是 `state().total` 实测 2002
（2000 个键 + 根 + 截断行），`scrollToPointer('/r2500')` 回 `false`。这不是实现的错，
是夹具撞了另一条口径：截断那一档由 V5、V6 单独量，窗口那三条判据要的是"五千行就是五千行"。
`vSet` 因此显式传 `maxKeys: Number.MAX_SAFE_INTEGER`，注释写清为什么。

**一处偏离计划形状的决定（登记在这里，不等收口那格补）**：`createTreeController` 的形参比计划
多一格 `indentStep`（默认 12px，写在行元素自己的 `padding-left` 上）。计划的契约段只列了
`document / container / rowHeight / windowSize / onViewChange` 五格，缩进那一格没写；
不给它的话只有两种下场——视图层每行再套一层 span（`§W` 的 `treeRow` 就要多算一层缩进），
或者把 12px 写死在模块里换不动。这一格默认值不动任何已有判据，V14 里那条
`['0px', '12px']` 是唯一现场。Task 6 若要让视图层接管行内 markup（`treeRow` 那一件），
`renderRow` 会是第二个加出来的形参——届时同样在这里登记，不留给注释。

### 落地镜像（门禁二核的就是这两块，`--fix` 会把它们整块换成磁盘内容）

一块是 `dev/js/tools/json-tree.js` 的**磁盘全文**，另一块是磁盘上 §V 那一节的**整节**
（`// ── §V …` 标记行起、到文件尾：§V 是本文件当前最后一节，`splitAtMarks` 在这一格不切第二刀）。
§0.6 的硬规矩照旧：只有整文件与整节镜像允许 ` ```js `，契约段一律 ` ```text `。
两块都由磁盘内容直接生成（`--fix` 只做整块替换、从不插入），贴完跑一次门禁二复验它已全等。

下面这两格里钉着的，是上面那段话只能说到一半的东西：**假 DOM 的三处"不像真 DOM"**
（没有 `innerHTML`、`removeChild` 找不到就抛、`dispatch` 只叫真的挂上去的监听）写在 §V 那半边，
而"控制器只走 `textContent` 与 `setAttribute`"写在模块这半边。两份镜像并排放着，
才是「只渲染可视这件事既能证、又不靠真浏览器」的现场见证。

#### `dev/js/tools/json-tree.js`（整文件）

```js
/**
 * JSON 值 → 树视图的行集 + 只渲染可视行的控制器（段 4 Task 5；设计文档 §5.3 的「树视图」那一档）。
 *
 * 这一本分成两半，中间那条线画得很硬：**前半（`flatten` / `expandOf` / `searchRows`）只在 plain array 上算，
 * 后半（`createTreeController`）只碰注入进来的 DOM**。这么切的理由不是好看，是 §V 契约那四条外部证据：
 * 前三条（三块常驻节点、垫块高度、任意滚动位置下 DOM 行数不越过 `windowSize`）必须能在一个假 DOM 上断言，
 * 而"匹配到的行在不在当前行集里"这一条要的是纯函数级的答案——它若只能靠查询 DOM 才知道，
 * 「只渲染可视」就成了判据自己看不见的那件事。
 *
 * 行对象十二格（V2 逐行钉这个键集，加一格是一次契约变更）：
 *   id · pointer · parent · depth · keyLabel · kind · childCount · expanded ·
 *   hiddenCount · truncatedFrom · display · matched
 * 三处口径是**选出来的形状**，各有一条判据钉着，实现期不许"顺手改"：
 *   · `id === pointer`，只有截断行例外（它的 id 是 `<父 Pointer>~more`、`pointer` 留空串）。V5、V7。
 *     用行当下标当 id 的话，数据一刷新折叠态就落到别的行上，而那种漂正好是"只渲染可视"抓不到的（V7 量的就是这次漂）。
 *   · `hiddenCount` 数的是**这一行下面直接少了几行**，不是整棵子树。V4、V13。
 *     这一格同时是搜索那一格 `truncated` 的唯一加数：折叠与截断都往这里加，截断行自己报 0——
 *     两处都报一遍的话 `truncated` 会加两遍（V5 的注释写的就是这件事）。
 *   · `matched` 只有一个写入点：`searchRows`。`flatten` 一律给 false，`expandOf` 一格都不改（V10、V12）。
 *
 * 深度与环：`flatten` 走**显式栈**，五千层容器不吃调用栈（V1 量这一格）。环在撞回祖先那一格当场抛
 * `TypeError` 并把 Pointer 写进消息，而不是渲染出一棵自我复制的树。同一个对象出现在兄弟两格**不算环**，
 * 照原样渲染两次——那是共享引用，不是循环，把它判成环就是替数据编一个 JSON 里不存在的约束。
 * 非 JSON 能表达的值（`undefined`、函数、symbol、`NaN`、`Infinity`、bigint）一律拒并点名 Pointer，
 * 与 §U 同一条口径：宁可不给结果，也不给一个把"没有值"渲染成 `null` 的树。
 *
 * 长串的截断（V9）：先按**码元**截到 200，再交 `json-core.js` 的 `escapeText` 转义。
 * 顺序反了就会留下半根反斜杠；末格正好落在代理对的高半边时整个不收，
 * 所以 `display` 里出现的引号、`\uXXXX` 与字面量永远是完整的一对。
 *
 * 控制器那一半只认 id：锚点是「视口首行那一格的 id」，`setData` 之后按 id 找回去，找不着也照样记着
 * （等那一行回来），焦点在重建后按 id 交还（V16）。窗口只由 `windowSize` 决定，**不读 `clientHeight`**——
 * 判据因此与视口高度无关，装配层要多密的窗口自己按 `rowHeight` 折算。
 *
 * 纯度：环境一律从构造函数注入，这一本不读全局的 `window` / `document`、不写任何存储；
 * 落 DOM 只走 `textContent` 与 `setAttribute`，所以「树里出现的字符串永远不是标记」这条与 §W 的输出区
 * 是同一条红线。依赖只有 `json-core.js` 的两把尺：串的转义口径、Pointer 的拼接口径（V1 数这个 import）。
 */
import { escapeText, pointerChild } from './json-core.js';

/** 单节点一次列出的键数上限，超出就长出一行「还有 N 个键未列出」（V5、V6） */
export const ROW_KEYS_LIMIT = 2000;
/** 一次进 DOM 的行数上限：上垫块 + 这一段 + 下垫块，滚动条总长仍按全部行算（V15 契约③） */
export const RENDER_WINDOW = 80;
/** 首屏只展开到这一层：`depth < DEFAULT_EXPAND_DEPTH` 的容器行是开的（V3） */
export const DEFAULT_EXPAND_DEPTH = 2;
/** 行的六类，顺序与页面图例一致；`kind` 只取这六个值（V2 逐行验） */
export const ROW_KINDS = ['object', 'array', 'string', 'number', 'boolean', 'null'];

/** `display` 里字符串内容保留的码元数，越一格才截（V9） */
const DISPLAY_UNITS = 200;
/** 缩进默认档：行元素自己的 `padding-left`，装配层要换密度就传 `indentStep` */
const DEFAULT_INDENT_STEP = 12;
/** 搜索的三档口径，写死在这里，`scope` 不认就当入参错抛出去（V11） */
const SCOPES = ['key', 'value', 'both'];
/** 截断行 id 的那一段后缀：`<父 Pointer>~more`（根的父 Pointer 是空串，所以根的截断行就叫 `~more`） */
const MORE_SUFFIX = '~more';
const CONTAINER_KINDS = new Set(['object', 'array']);
const KIND_SET = new Set(ROW_KINDS);

/** 一行的十二格，`setData` 的入参闸门与 V2 的键集断言共用这一张表 */
const ROW_STRINGS = ['id', 'pointer', 'keyLabel'];
const ROW_NUMBERS = ['depth', 'childCount', 'hiddenCount', 'truncatedFrom'];
const ROW_BOOLEANS = ['expanded', 'matched'];

/**
 * 截断行是 `id === pointer` 那条口径的唯一例外：它点不出 Pointer，也不许被复制成一条合法 Pointer。
 * 判据用「有 id 却没 pointer」这一格，而不是去比后缀——真键名叫 `~more` 的那一行是 `/x~more`，
 * 它的 pointer 非空，永远撞不进来。
 * @param {{id: string, pointer: string}} row
 * @returns {boolean}
 */
const isMore = (row) => row.pointer === '' && row.id !== '';

/** 根那一格在消息里要说"根"，不说 `Pointer `（空串读不出主语） */
const where = (pointer) => (pointer === '' ? '根节点' : `Pointer ${pointer} 那一格`);

/**
 * JSON 六类里的哪一类；不是 JSON 能表达的值给空串，由调用方点名拒。
 * @param {unknown} value
 * @returns {string}
 */
function kindOf(value) {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'string') return 'string';
  if (t === 'number') return Number.isFinite(value) ? 'number' : '';
  if (t === 'boolean') return 'boolean';
  if (t === 'object') return Array.isArray(value) ? 'array' : 'object';
  return '';
}

/**
 * 只枚举**自有**键：数组的下标写成 `'0'`、`'1'`（Pointer 那一层排版归视图层，V8），
 * 对象走 `Object.keys`——`for…in` 会把原型上的 `toString` 之类也枚举进来，V8 有一条判据专门拒那个。
 * @param {object|Array} node
 * @returns {string[]}
 */
const keysOf = (node) => (Array.isArray(node)
  ? Array.from({ length: node.length }, (_, i) => String(i))
  : Object.keys(node));

/**
 * 按码元截一段串。末格正好是代理对的高半边时整个不收，所以截出来的尾巴永远是完整码点（V9）。
 * @param {string} text
 * @param {number} limit
 * @returns {{text: string, cut: boolean}}
 */
function cutUnits(text, limit) {
  if (text.length <= limit) return { text, cut: false };
  let end = limit;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return { text: text.slice(0, end), cut: true };
}

/**
 * 一行的 `display`：标量给字面量，容器给概览串，**展开着的容器给空串**（子行就在下面，再写一遍 `{}` 是噪音）。
 * @param {unknown} node
 * @param {string} kind
 * @param {boolean} open
 * @param {number} childCount
 * @returns {string}
 */
function displayOf(node, kind, open, childCount) {
  if (kind === 'string') {
    const { text, cut } = cutUnits(node, DISPLAY_UNITS);
    return `"${escapeText(text)}${cut ? '…' : ''}"`;
  }
  if (kind === 'number' || kind === 'boolean' || kind === 'null') return String(node);
  if (open) return '';
  if (childCount === 0) return kind === 'array' ? '[]' : '{}';
  return kind === 'array' ? `[${childCount} 项]` : `{${childCount} 键}`;
}

/**
 * `expanded` 只收 Set 或干脆不给（`undefined` / `null` 都走默认档）。
 * 默认档与"谁都不展开"是两件事，所以空 Set 必须原样收下（V3）。
 * @param {unknown} raw
 * @returns {Set<string>|null}
 */
function readExpanded(raw) {
  if (raw === undefined || raw === null) return null;
  if (!(raw instanceof Set)) throw new TypeError(`flatten 的 expanded 只收 Set（或不给走默认档），这里是 ${describe(raw)}`);
  return raw;
}

/**
 * `maxKeys` 只收非负整数或 `null` / `undefined`；`0` 是合法档（只剩根 + 截断行，V5）。
 * @param {unknown} raw
 * @returns {number}
 */
function readMaxKeys(raw) {
  if (raw === undefined || raw === null) return ROW_KEYS_LIMIT;
  if (typeof raw !== 'number') throw new TypeError(`flatten 的 maxKeys 要是数字，这里是 ${typeof raw}`);
  if (!Number.isInteger(raw) || raw < 0) throw new RangeError(`flatten 的 maxKeys 得是 0 或正整数，这里是 ${String(raw)}`);
  return raw;
}

const describe = (value) => (Array.isArray(value) ? `长度 ${value.length} 的数组` : `${typeof value}`);

/** 行集闸门的第 1 层：是不是 flatten 交回的那种数组 */
function assertRows(list, who) {
  if (!Array.isArray(list)) throw new TypeError(`${who} 只收 flatten 交回的行集（数组），这里是 ${describe(list)}`);
}

/** 行集闸门的第 2 层：那一格是不是行对象（十二格按类型逐个验，验完才准进渲染） */
function assertRow(row, i) {
  const bad = (why) => { throw new TypeError(`行集第 ${i + 1} 格不是 flatten 交回的行对象：${why}`); };
  if (row === null || typeof row !== 'object' || Array.isArray(row)) bad('那一格不是行对象');
  for (const key of ROW_STRINGS) if (typeof row[key] !== 'string') bad(`${key} 要是字符串，这里是 ${describe(row[key])}`);
  for (const key of ROW_NUMBERS) if (typeof row[key] !== 'number') bad(`${key} 要是数字，这里是 ${describe(row[key])}`);
  for (const key of ROW_BOOLEANS) if (typeof row[key] !== 'boolean') bad(`${key} 要是布尔，这里是 ${describe(row[key])}`);
  if (row.parent !== null && typeof row.parent !== 'string') bad(`parent 是父行的 Pointer 或 null，这里是 ${describe(row.parent)}`);
  if (!KIND_SET.has(row.kind)) bad(`kind 得在 ROW_KINDS 里，这里是 ${describe(row.kind)}`);
}

/**
 * 前序深度优先拍平：父在子前，兄弟按数据里的键序（V2 那张十行表钉的就是这个顺序）。
 * 一趟走完，所以 `hiddenCount` 只能报"直接少了几格"——要数整棵子树就得再来一趟（V4 的理由）。
 *
 * @param {unknown} value `parseJson` 交出来的那个值，或任何 JSON 能表达的结构
 * @param {{expanded?: Set<string>|null, maxKeys?: number|null}} [options]
 * @returns {Array<object>} 行集，每行十二格
 * @throws {TypeError} 值里有非 JSON 能表达的格、有环，或 `expanded` / 参数形状不对
 * @throws {RangeError} `maxKeys` 是数但不是非负整数
 */
export function flatten(value, options = {}) {
  if (options === null || typeof options !== 'object') {
    throw new TypeError(`flatten 的第二格只收 { expanded, maxKeys } 这一个形状，这里是 ${describe(options)}`);
  }
  const expanded = readExpanded(options.expanded);
  const maxKeys = readMaxKeys(options.maxKeys);
  const rows = [];
  const path = new Set();
  const stack = [{ t: 'row', value, keyLabel: '', pointer: '', parent: null, depth: 0 }];

  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame.t === 'out') { path.delete(frame.value); continue; }
    if (frame.t === 'more') {
      rows.push({
        id: `${frame.parent}${MORE_SUFFIX}`, pointer: '', parent: frame.parent, depth: frame.depth + 1,
        keyLabel: '', kind: frame.kind, display: `还有 ${frame.hidden} 个${frame.kind === 'array' ? '元素' : '键'}未列出`,
        childCount: 0, expanded: false, hiddenCount: 0, truncatedFrom: frame.from, matched: false,
      });
      continue;
    }

    const { value: node, keyLabel, pointer, parent, depth } = frame;
    const kind = kindOf(node);
    if (kind === '') {
      throw new TypeError(`${where(pointer)}不是 JSON 能表达的值（${describe(node)}）：树视图不猜它该读成什么。`);
    }
    const container = CONTAINER_KINDS.has(kind);
    if (container && path.has(node)) {
      throw new TypeError(`${where(pointer)}绕回了它的父链（自引用）：JSON 里没有环，这份数据在 parseJson 之前就已经不是 JSON 了。`);
    }

    const kids = container ? keysOf(node) : [];
    const childCount = kids.length;
    const open = container && (expanded === null ? depth < DEFAULT_EXPAND_DEPTH : expanded.has(pointer));
    const listed = open ? Math.min(childCount, maxKeys) : 0;
    const hidden = childCount - listed;

    rows.push({
      id: pointer, pointer, parent, depth, keyLabel, kind,
      display: displayOf(node, kind, open, childCount),
      childCount, expanded: open, hiddenCount: hidden,
      truncatedFrom: open && hidden > 0 ? listed : -1, matched: false,
    });
    if (!open) continue;

    // 出栈顺序要的是「子行 → 截断行 → 离开父节点」，所以压栈倒过来：离框架最底、截断行居中、子行按序翻面压上。
    stack.push({ t: 'out', value: node });
    if (hidden > 0) stack.push({ t: 'more', parent: pointer, depth, kind, hidden, from: listed });
    for (let i = listed - 1; i >= 0; i--) {
      const key = kids[i];
      stack.push({
        t: 'row', value: node[key], keyLabel: key,
        pointer: pointerChild(pointer, key), parent: pointer, depth: depth + 1,
      });
    }
    path.add(node);
  }
  return rows;
}

/**
 * 交回一份**新的**展开集：把当前行集里开着的容器抄进来，再翻动 `id` 那一格。
 * 「折叠一支会把支内的展开态一起带走」是这个算法的必然结果（行集里没有的那一格，下一轮也用不上），
 * V10 把它钉成判据而不是留给注释——因为它是用户能看见的行为（收起来再打开，里面的层级塌回收默认档）。
 *
 * @param {Array<object>} rows `flatten` 交回的行集
 * @param {string} id 要翻动的那一行的 id（就是 Pointer，截断行也行但等于没动）
 * @param {boolean} on `true` 展开、`false` 收起
 * @returns {Set<string>} 新 Set；入参行集一格都不改
 */
export function expandOf(rows, id, on) {
  assertRows(rows, 'expandOf');
  if (typeof id !== 'string') throw new TypeError(`expandOf 的 id 要是 Pointer 字符串，这里是 ${describe(id)}`);
  if (typeof on !== 'boolean') throw new TypeError(`expandOf 的第三格要的是布尔：true 展开、false 收起，这里是 ${describe(on)}`);
  const next = new Set();
  for (let i = 0; i < rows.length; i++) {
    assertRow(rows[i], i);
    if (rows[i].expanded) next.add(rows[i].id);
  }
  if (on) next.add(id); else next.delete(id);
  return next;
}

/**
 * 在当前行集里搜，并把命中的那一格写在行对象自己身上（`matched` 唯一的写入点）。
 * 两档口径钉死：值是**子串**匹配（搜 `12` 命中 `123`，V11），容器行不参与值搜索
 * （否则搜一个 `2` 就命中一堆 `[2 项]` 概览串，V12）。
 *
 * @param {Array<object>} rows `flatten` 交回的行集
 * @param {string} query 搜索词；空串是"没搜"，不是"匹配一切"
 * @param {{scope?: 'key'|'value'|'both'}} [options]
 * @returns {{matchedIds: string[], total: number, truncated: number}} `truncated` 是这次没扫到的直接子项数
 */
export function searchRows(rows, query, options = {}) {
  assertRows(rows, 'searchRows');
  if (typeof query !== 'string') throw new TypeError(`searchRows 的搜索词要是字符串，这里是 ${describe(query)}`);
  if (options === null || typeof options !== 'object') {
    throw new TypeError(`searchRows 的第三格只收 { scope } 这一个形状，这里是 ${describe(options)}`);
  }
  const scope = options.scope === undefined ? 'both' : options.scope;
  if (!SCOPES.includes(scope)) throw new RangeError(`searchRows 的 scope 只认 ${SCOPES.join(' | ')}，这里是 ${describe(scope)}`);

  for (let i = 0; i < rows.length; i++) {
    assertRow(rows[i], i);
    rows[i].matched = false;                   // 每一趟都先洗色：上一轮的命中不许留在树上
  }
  if (query === '') return { matchedIds: [], total: 0, truncated: 0 };

  const needle = query.toLowerCase();
  const matchedIds = [];
  let truncated = 0;
  for (const row of rows) {
    truncated += row.hiddenCount;
    if (isMore(row)) continue;                 // 截断行那句文案是排版，不是数据（V12）
    const hitKey = scope !== 'value' && row.keyLabel.toLowerCase().includes(needle);
    const hitValue = scope !== 'key' && !CONTAINER_KINDS.has(row.kind)
      && row.display.toLowerCase().includes(needle);
    if (hitKey || hitValue) {
      row.matched = true;
      matchedIds.push(row.id);
    }
  }
  return { matchedIds, total: matchedIds.length, truncated };
}

/**
 * 只渲染可视行的树控制器。**环境全部从这一格注入**：`document`、`container`、`rowHeight`、
 * `windowSize`、`indentStep`、`onViewChange`（§V 契约①②③④ 分别由 V14、V14、V15、V16 断言）。
 *
 * 常驻节点永远只有三块：上垫块、行容器、下垫块。窗口里的行数不越过 `windowSize`，
 * 而两条垫块的高度按"窗口外还有几行"算，所以滚动条总长永远等于 `行数 × rowHeight`——
 * 这是"只渲染可视"唯一能从外面看见的证据（契约②），也是 V14 那条 `contentHeight()` 不变量量的东西。
 *
 * 锚点是「视口首行那一格的 id」：`setData` 之后按 id 找回去（前面插了一行也不会漂），
 * 找不着也照样记着，等那一行回来；焦点在节点重建后按 id 交还。闸门一律抛在挂节点之前，
 * 所以入参写错不会留下一棵半成品（V16 最后一条）。
 *
 * @param {{document: object, container: object, rowHeight: number,
 *          windowSize?: number, indentStep?: number,
 *          onViewChange?: (p: {first: number, last: number, count: number, total: number, scrollTop: number}) => void}} env
 * @returns {{setData: Function, setExpanded: Function, refresh: Function, destroy: Function,
 *            scrollToPointer: Function, state: Function, visibleRange: Function}}
 */
export function createTreeController(env = {}) {
  const doc = env.document;
  const container = env.container;
  const rowHeight = env.rowHeight;
  if (doc === undefined || doc === null) throw new TypeError('createTreeController 缺 document：这一本不读全局，环境一律注入');
  if (typeof doc !== 'object' || typeof doc.createElement !== 'function') throw new TypeError('注入的 document 得有 createElement：行节点是自己建的，不是从串里解析出来的');
  if (container === undefined || container === null) throw new TypeError('createTreeController 缺 container：三块常驻节点要有地方挂');
  if (typeof container !== 'object' || typeof container.appendChild !== 'function'
    || typeof container.removeChild !== 'function' || typeof container.getAttribute !== 'function') {
    throw new TypeError('注入的 container 得是能挂节点的容器：appendChild / removeChild / getAttribute 三样齐');
  }
  if (typeof rowHeight !== 'number' || !Number.isInteger(rowHeight) || rowHeight < 1) {
    throw new TypeError(`rowHeight 得是 ≥1 的整数像素，这里是 ${describe(rowHeight)}`);
  }
  const size = env.windowSize === undefined ? RENDER_WINDOW : env.windowSize;
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 1) {
    throw new RangeError(`windowSize 得是 ≥1 的整数行数，这里是 ${describe(size)}`);
  }
  const step = env.indentStep === undefined ? DEFAULT_INDENT_STEP : env.indentStep;
  if (typeof step !== 'number' || !Number.isInteger(step) || step < 0) {
    throw new TypeError(`indentStep 得是 ≥0 的整数像素，这里是 ${describe(step)}`);
  }
  const onViewChange = env.onViewChange;
  if (onViewChange !== undefined && typeof onViewChange !== 'function') throw new TypeError('onViewChange 要的是函数，或者干脆不给');

  const above = Math.floor(size / 4);          // 视口上面留的缓冲：够翻页手感，又不动"总数 ≤ size"那条上界
  const node = (className) => {
    const el = doc.createElement('div');
    el.setAttribute('class', className);
    return el;
  };
  const padTop = node('jt-tree__pad');
  const rowsBox = node('jt-tree__rows');
  rowsBox.setAttribute('role', 'tree');
  const padBottom = node('jt-tree__pad');
  container.appendChild(padTop);
  container.appendChild(rowsBox);
  container.appendChild(padBottom);

  /** @type {Array<object>} */
  let rows = [];
  /** @type {Map<string, number>} id → 行号；`scrollToPointer` 与锚点找回都读它，所以每轮 setData 重建一次 */
  let indexById = new Map();
  let anchorId = '';
  let expandedSet = new Set();
  let range = { first: -1, last: -1, count: 0 };
  let lastRangeKey = '';
  let destroyed = false;

  const live = (who) => { if (destroyed) throw new TypeError(`这棵${who}已经拆了，方法不许再叫`); };
  const clampTop = (raw, total) => {
    const max = total === 0 ? 0 : (total - 1) * rowHeight;
    return Math.max(0, Math.min(Number.isFinite(raw) ? raw : 0, max));
  };
  const focusId = () => {
    const el = doc.activeElement;
    if (el === undefined || el === null || typeof el.getAttribute !== 'function') return null;
    return el.getAttribute('data-jt-id');
  };
  const detach = (parent, child) => {
    const at = Array.prototype.indexOf.call(parent.childNodes, child);
    if (at >= 0) parent.removeChild(child);
  };

  const rowText = (row) => (row.keyLabel === '' ? row.display
    : (row.display === '' ? row.keyLabel : `${row.keyLabel}: ${row.display}`));

  /** 一行一个 div：语义挂 attribute，颜色挂 class，缩进挂 padding——**内容永远只进 textContent** */
  function rowNode(row) {
    const more = isMore(row);
    const containerRow = !more && CONTAINER_KINDS.has(row.kind);
    const cls = [`jt-tree__row`, `jt-tree__row--${more ? 'more' : row.kind}`];
    if (containerRow) cls.push(row.expanded ? 'is-open' : 'is-closed');
    if (row.matched) cls.push('is-matched');
    const el = node(cls.join(' '));
    el.setAttribute('role', more ? 'button' : 'treeitem');
    el.setAttribute('tabindex', '0');
    el.setAttribute('data-jt-id', row.id);
    el.setAttribute('data-jt-pointer', row.pointer);
    el.setAttribute('aria-level', String(row.depth + 1));
    if (containerRow) el.setAttribute('aria-expanded', row.expanded ? 'true' : 'false');
    el.style.paddingLeft = `${row.depth * step}px`;
    el.textContent = rowText(row);
    return el;
  }

  function render() {
    const total = rows.length;
    const top = clampTop(container.scrollTop, total);
    const start = total === 0 ? 0 : Math.floor(top / rowHeight);
    const count = Math.min(size, total);
    const first = total === 0 ? -1 : Math.min(Math.max(0, start - above), total - count);
    const last = total === 0 ? -1 : first + count - 1;
    padTop.style.height = `${first < 0 ? 0 : first * rowHeight}px`;
    padBottom.style.height = `${last < 0 ? 0 : (total - last - 1) * rowHeight}px`;

    const keepFocus = focusId();
    while (rowsBox.childNodes.length > 0) rowsBox.removeChild(rowsBox.childNodes[0]);
    const built = [];
    for (let i = 0; i < count; i++) {
      const el = rowNode(rows[first + i]);
      rowsBox.appendChild(el);
      built.push(el);
    }
    range = { first, last, count };
    if (keepFocus !== null) {
      const back = built.findIndex((el) => el.getAttribute('data-jt-id') === keepFocus);
      if (back >= 0) built[back].focus();
    }
    if (onViewChange !== undefined) {
      const key = `${first}|${last}|${total}`;
      if (key !== lastRangeKey) {
        lastRangeKey = key;
        onViewChange({ first, last, count, total, scrollTop: top });
      }
    }
  }

  const onScroll = () => {
    if (destroyed) return;                     // 拆完之后事件里不许复活任何节点（V16）
    const total = rows.length;
    const top = clampTop(container.scrollTop, total);
    if (total > 0) {
      const at = Math.floor(top / rowHeight);
      if (at < total) anchorId = rows[at].id;
    }
    render();
  };
  container.addEventListener('scroll', onScroll);

  /** 行集 → id 索引 + 当前展开态（`setExpanded` 的对照表就从这里来） */
  function adopt(next) {
    rows = next.slice();
    indexById = new Map();
    expandedSet = new Set();
    for (let i = 0; i < rows.length; i++) {
      indexById.set(rows[i].id, i);
      if (!isMore(rows[i]) && CONTAINER_KINDS.has(rows[i].kind) && rows[i].expanded) expandedSet.add(rows[i].id);
    }
  }

  return {
    /**
     * 换一份行集：锚点按 id 找回它自己的那一行（前面插了一行就跟着补一行），
     * 找不着就留着等它回来，只把 `scrollTop` 夹回新行集的范围内。
     * @param {Array<object>} next `flatten` 交回的行集
     */
    setData(next) {
      live('树');
      assertRows(next, 'setData');
      for (let i = 0; i < next.length; i++) assertRow(next[i], i);
      adopt(next);
      const at = indexById.get(anchorId);
      container.scrollTop = clampTop(at === undefined ? container.scrollTop : at * rowHeight, rows.length);
      render();
    },

    /**
     * 登记这一轮的展开集。**行集与展开集必须同轮**：只要有一格容器的 `expanded` 与这份 Set 对不上就抛，
     * 因为那种不一致只有一个来源——装配层把上一轮的 Set 喂进了这一轮的行集，而那正是用户看见的"点了没反应"。
     * @param {Set<string>} set
     */
    setExpanded(set) {
      live('树');
      if (!(set instanceof Set)) throw new TypeError(`setExpanded 只收 Set（flatten 用的那一轮），这里是 ${describe(set)}`);
      for (const row of rows) {
        if (isMore(row) || !CONTAINER_KINDS.has(row.kind)) continue;
        if (set.has(row.id) !== row.expanded) {
          throw new TypeError(`展开集与行集不是同一轮：行集里 ${where(row.id)}是${row.expanded ? '展开' : '折叠'}的，`
            + `喂进来的展开集却${set.has(row.id) ? '有' : '没有'}它。先 flatten，再 setData，然后把同一份 Set 交给 setExpanded。`);
        }
      }
      expandedSet = new Set(set);
      render();
    },

    /** 按当前行集与当前 `scrollTop` 重画窗口（搜索改了 `matched` 之后叫这一格） */
    refresh() {
      live('树');
      render();
    },

    /**
     * 滚到那一行的行首。
     * @param {string} pointer 要定位的 Pointer
     * @returns {boolean} 行集里没有这一格就回报 false，并且不动滚动
     */
    scrollToPointer(pointer) {
      if (typeof pointer !== 'string') throw new TypeError(`scrollToPointer 只收 Pointer 字符串，这里是 ${describe(pointer)}`);
      live('树');
      const at = indexById.get(pointer);
      if (at === undefined) return false;
      anchorId = pointer;
      container.scrollTop = clampTop(at * rowHeight, rows.length);
      render();
      return true;
    },

    /** 读数：装配层的"一次渲染 N 行 / 共 M 行"那一行从这里取 */
    state() {
      return {
        total: rows.length, windowSize: size, rowHeight, indentStep: step,
        anchorId, expanded: new Set(expandedSet),
      };
    },

    /** 当前窗口的行号区间（含两端）；空行集用 -1 表示"没有"，`count` 给 0 */
    visibleRange() {
      return { first: range.first, last: range.last, count: range.count };
    },

    /** 摘掉三块常驻节点与 scroll 监听；重复叫不出错，叫完再派事件也不许长节点 */
    destroy() {
      if (destroyed) return;
      destroyed = true;
      container.removeEventListener('scroll', onScroll);
      while (rowsBox.childNodes.length > 0) rowsBox.removeChild(rowsBox.childNodes[0]);
      for (const piece of [padTop, rowsBox, padBottom]) detach(container, piece);
      rows = [];
      indexById = new Map();
      expandedSet = new Set();
      range = { first: -1, last: -1, count: 0 };
    },
  };
}
```

#### `scripts/toolkit-tests.mjs` §V（整节）

```js
// ── §V 树拍平与只渲染可视行（tools/json-tree.js，段 4 Task 5）─────────────────
// 这一节钉两样东西：**树的数据形状**（V2–V13，全在 plain array 上断，不碰 DOM）与
// **「只渲染可视」那四条外部证据**（V14–V16，假 DOM 夹具形状照 §I，但本节自建，不复用 `iPage`）。
// 为什么把拍平做成纯函数：折叠态、搜索命中、可见行集这三件事必须共用同一个真值源，
// 否则"匹配到的行在不在屏幕上"这种话只能靠 DOM 猜——而 §V 契约那一句要的正是纯函数级的证据。
// 行对象十二格（V2 逐行钉这个键集；加一格是一次契约变更）：
//   id · pointer · parent · depth · keyLabel · kind · display · childCount ·
//   expanded · hiddenCount · truncatedFrom · matched
// 两处口径是本段**选的形状**，不是实现细节，所以各有一条判据钉着：
//   · `id === pointer`，只有截断行例外（它的 id 是 `<父 pointer>~more`、pointer 留空串）——V7。
//     用行当下标的话，数据一刷新折叠态就落到别的行上，而"只渲染可视"那族判据抓不到这种漂。
//   · `hiddenCount` 数的是**这一行下面直接少了几行**，不是整棵子树的行数——V4、V13 各钉一次。
//     拍平只有一趟，要数后代就得再来一趟，而这一格的用户读数是"还有几个没列出"。
// `matched` 只有一个写入点：`searchRows`（V12），`flatten` 一律给 false。
const { ROW_KEYS_LIMIT, RENDER_WINDOW, DEFAULT_EXPAND_DEPTH, ROW_KINDS,
  flatten, expandOf, searchRows, createTreeController } = await import('../dev/js/tools/json-tree.js');

/** 剥注释扫源码：这一族的禁令与 §S/§T/§U 同形，扫的是代码不是注释里的自我声明 */
const vCode = () => read('dev/js/tools/json-tree.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** 行对象的十二格，一格不多一格不少 */
const V_FIELDS = ['childCount', 'depth', 'display', 'expanded', 'hiddenCount', 'id',
  'keyLabel', 'kind', 'matched', 'parent', 'pointer', 'truncatedFrom'];
/** 行序那一族八格的投影：depth / pointer / parent / keyLabel / kind / childCount / expanded / hiddenCount */
const vPick = (r) => [r.depth, r.pointer, r.parent, r.keyLabel, r.kind, r.childCount, r.expanded, r.hiddenCount];
/** 一小棵混合树：六个直接子项，覆盖六类 kind、「数组套数组」与「折叠的嵌套空对象」 */
const vMix = () => ({ s: 'x', n: -0.5, b: false, z: null, a: [1, [2]], o: { k: {} } });
/**
 * 一层纯标量的行集：n 个键 → n+1 行；`extra` 在最前面插一格，用来造「行号漂而 id 不漂」。
 * `maxKeys` 顶到安全整数上限，因为这批夹具要的是"五千行就是五千行"——截断那一档由 V5、V6 单独量，
 * 别让默认的 2000 混进 V15、V16 的窗口判据里（那两条要数的是渲染，不是列表上限）。
 */
const vSet = (n, extra = false) => {
  const value = {};
  if (extra) value.extra = -1;
  for (let i = 0; i < n; i++) value['r' + i] = i;
  return flatten(value, { maxKeys: Number.MAX_SAFE_INTEGER });
};
/** 搜索样本：键里有 `Key`，值里有 `ITEM` 与 `123`，还有一支藏在 `/deep` 下面 */
const vHay = () => ({ Key: 'value', list: ['ITEM', 12], n: 123, deep: { k: 'key inside' } });
/** 把 vHay 那份数据「全展开」的那一行集（三个容器的 pointer 都在展开集里，故一轮就到底） */
const vAll = (value) => flatten(value, { expanded: new Set(['', '/list', '/deep']) });
/** 逐码元扫落单代理项：display 的截断点不许把一个 emoji 劈成两半 */
const vHasLoneSurrogate = (s) => {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const nx = i + 1 < s.length ? s.charCodeAt(i + 1) : -1;
      if (nx < 0xdc00 || nx > 0xdfff) return true;
      i += 1;
    } else if (c >= 0xdc00 && c <= 0xdfff) return true;
  }
  return false;
};

test('V1 三格常量的值、只借两把尺、显式栈与环：这一本不吃环境，也不吃调用栈', () => {
  assert.deepEqual([ROW_KEYS_LIMIT, RENDER_WINDOW, DEFAULT_EXPAND_DEPTH], [2000, 80, 2],
    '这三个数是 §7 那一格预算与页面文案的共同分母：改一个就得回来重开一次判据');
  assert.deepEqual(ROW_KINDS, ['object', 'array', 'string', 'number', 'boolean', 'null']);
  const code = vCode();
  for (const banned of ['window.', 'localStorage', 'sessionStorage', 'globalThis', 'process.', 'Buffer',
    'fetch(', 'require(', 'eval(', 'new Function', 'Date.now', 'navigator', 'getComputedStyle',
    'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'JSON.parse', 'JSON.stringify', 'document.cookie',
    'requestAnimationFrame']) {
    assert.ok(!code.includes(banned), `json-tree 不许出现 ${banned}：环境一律注入，落 DOM 只走 textContent`);
  }
  assert.equal((code.match(/^import /gm) || []).length, 1, '只有一本依赖：json-core 的那两把尺');
  const names = /import \{([^}]*)\} from '\.\/json-core\.js'/m.exec(code)[1]
    .split(',').map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(names, ['escapeText', 'pointerChild'], '只借两样：串的转义口径、Pointer 的拼接口径');
  // 显式栈：五千层容器 + 最里那一格标量，全展开就是五千零一行，且不许是 RangeError
  let deep = 1;
  for (let i = 0; i < 5000; i++) deep = { a: deep };
  const full = new Set();
  for (let i = 0, p = ''; i < 5000; i++, p += '/a') full.add(p);
  assert.equal(flatten(deep, { expanded: new Set() }).length, 1, '谁都不展开就只剩根那一行');
  assert.equal(flatten(deep, { expanded: full }).length, 5001, '五千层容器 + 最里那格标量，一层不落');
  // 环：默认档走不到环那里，所以不抛；显式喂一份能让它绕回来的展开集就当场点名
  const cyc = { a: { b: { c: null } } };
  cyc.a.b.c = cyc;
  assert.equal(flatten(cyc).length, 3, '默认只到第 2 层：/a/b 那一格是折叠的，压根走不到环');
  assert.throws(() => flatten(cyc, { expanded: new Set(['', '/a', '/a/b', '/a/b/c']) }),
    (e) => e instanceof TypeError && /环|自引用/.test(e.message) && /\/a\/b\/c/.test(e.message),
      '环要指认到绕回来那一格的 Pointer，而不是"栈溢出"');
  // 非 JSON 的值是入参错：与 §U 同一条口径——拒，而不是渲染成 null
  const U = undefined;
  for (const [label, bad] of [['undefined', U], ['函数', () => 1], ['symbol', Symbol('s')],
    ['NaN', NaN], ['Infinity', Infinity], ['bigint', 10n]]) {
    assert.throws(() => flatten({ k: bad }),
      (e) => e instanceof TypeError && /\/k/.test(e.message), `${label} 不是 JSON 能表达的值`);
  }
  assert.throws(() => flatten(U), TypeError, '整份输入就是 undefined 也点名');
  assert.equal(flatten(42).length, 1, '根是一格标量：一行，不是一棵');
});

test('V2 前序深度优先：一张十行的表钉住行序、parent、depth、childCount 与那十二格', () => {
  const rows = flatten(vMix());
  assert.equal(rows.length, 10, '六个直接子项里 a 与 o 各带一支，一共十行');
  assert.deepEqual(rows.map(vPick), [
    [0, '', null, '', 'object', 6, true, 0],
    [1, '/s', '', 's', 'string', 0, false, 0],
    [1, '/n', '', 'n', 'number', 0, false, 0],
    [1, '/b', '', 'b', 'boolean', 0, false, 0],
    [1, '/z', '', 'z', 'null', 0, false, 0],
    [1, '/a', '', 'a', 'array', 2, true, 0],
    [2, '/a/0', '/a', '0', 'number', 0, false, 0],
    [2, '/a/1', '/a', '1', 'array', 1, false, 1],
    [1, '/o', '', 'o', 'object', 1, true, 0],
    [2, '/o/k', '/o', 'k', 'object', 0, false, 0],
  ], '行的先后就是人眼从上往下读的先后：父在子前，兄弟按数据里的键序');
  for (const r of rows) {
    assert.deepEqual(Object.keys(r).sort(), V_FIELDS, '行对象就是那十二格，不多不少');
    assert.equal(r.matched, false, 'flatten 不上色：matched 只由 searchRows 写（V12）');
    assert.equal(r.truncatedFrom, -1, '这一趟没截断，-1 就是"没有起点"');
    assert.equal(r.id, r.pointer);
    assert.ok(ROW_KINDS.includes(r.kind), `${r.pointer} 的 kind 得在 ROW_KINDS 里`);
  }
  assert.equal(rows[0].parent, null, '根没有父：那一格是 null，不是空串');
  assert.deepEqual(rows.map((r) => r.display),
    ['', '"x"', '-0.5', 'false', 'null', '', '1', '[1 项]', '', '{}'],
    '展开的容器行不留概览串，折叠的才有（V9 逐类钉）');
});

test('V3 DEFAULT_EXPAND_DEPTH=2：默认档只展开到第 2 层，给了 Set 就完全不看默认档', () => {
  const chain = { l1: { l2: { l3: { l4: { l5: 'end' } } } } };
  const P3 = '/l1/l2/l3';
  assert.deepEqual(flatten(chain).map((r) => [r.depth, r.pointer, r.expanded]),
    [[0, '', true], [1, '/l1', true], [2, '/l1/l2', false]],
    '首屏最深的一行是 depth 2，而它是折叠的——"看到第 2 层"是"第 2 层在、第 3 层不在"');
  assert.deepEqual(flatten(chain, { expanded: new Set() }).map((r) => r.pointer), [''],
    '空 Set 是"谁都不展开"，不是"用默认档"');
  assert.deepEqual(flatten(chain, { expanded: new Set(['', '/l1', '/l1/l2', P3]) }).map((r) => r.pointer),
    ['', '/l1', '/l1/l2', P3, `${P3}/l4`], '展开集里点到的那一支一路到底，直到你没点的那一格');
  assert.equal(flatten(chain, { expanded: new Set(['', '/l1/l2']) }).length, 2,
    '展开集里的 /l1/l2 这一轮用不上（它的父 /l1 是折叠的），但不算错、也不许抛');
  assert.deepEqual(flatten(chain, { expanded: null }).map((r) => r.depth), [0, 1, 2], 'null 走默认档');
  for (const bad of [[''], ['x'], 0, true, {}, new Map()]) {
    assert.throws(() => flatten(chain, { expanded: bad }),
      (e) => e instanceof TypeError && /expanded/.test(e.message), 'expanded 只收 Set 或干脆不给');
  }
});

test('V4 折叠换的是「行集」：hiddenCount 数直接子项，不数整棵子树', () => {
  const v = { a: { b: 1, c: 1, d: { e: 1 } }, f: 2 };
  assert.deepEqual(flatten(v, { expanded: new Set(['', '/a', '/a/d']) }).map((r) => r.pointer),
    ['', '/a', '/a/b', '/a/c', '/a/d', '/a/d/e', '/f'], '全展开那一份的行序');
  const closed = flatten(v, { expanded: new Set(['']) });
  assert.deepEqual(closed.map((r) => [r.pointer, r.childCount, r.hiddenCount]),
    [['', 2, 0], ['/a', 3, 3], ['/f', 0, 0]]);
  assert.equal(closed.length, 3, '收起 /a 之后它下面四行都不在行集里');
  assert.equal(closed[1].hiddenCount, 3, '但 hiddenCount 报 3——那一格是"直接少了几行"');
  assert.equal(closed[1].display, '{3 键}', '概览串与 hiddenCount 是同一个数，两处不许分叉');
});

test('V5 ROW_KEYS_LIMIT 截断：多出来的那一行是唯一 pointer 留空的行', () => {
  const ten = {};
  for (let i = 0; i < 10; i++) ten['k' + i] = i;
  const rows = flatten(ten, { maxKeys: 3 });
  assert.deepEqual(rows.map((r) => r.id), ['', '/k0', '/k1', '/k2', '~more'],
    '根的 pointer 是空串，所以它的截断行 id 就长成 ~more');
  const root = rows[0];
  const more = rows[4];
  assert.deepEqual([root.childCount, root.hiddenCount, root.truncatedFrom], [10, 7, 3],
    '父行自己报"从第 3 格起没列、还差 7 个"');
  assert.deepEqual([more.pointer, more.parent, more.depth, more.kind, more.keyLabel],
    ['', '', 1, 'object', ''], '截断行点不出 Pointer，也不带键名');
  assert.deepEqual([more.childCount, more.expanded, more.hiddenCount, more.truncatedFrom], [0, false, 0, 3],
    '计数只归父行一处：两处都报 7 的话，搜索那一格的 truncated 会加两遍（V13）');
  assert.equal(more.display, '还有 7 个键未列出');
  assert.equal(more.matched, false);
  assert.deepEqual(Object.keys(more).sort(), V_FIELDS, '截断行也是那十二格');
  assert.equal(flatten(ten, { maxKeys: 0 }).length, 2, 'maxKeys=0 是合法档：根 + 截断行');
  assert.equal(flatten(ten, { maxKeys: 0 })[1].truncatedFrom, 0, '起点是"第一个未列出的子序号"');
  assert.equal(flatten(ten).length, 11, '不传就是默认那一档，十键一个都不截');
  assert.equal(flatten(ten, { maxKeys: 10 }).length, 11, '恰好等于子项数不算截断');
  assert.deepEqual(flatten(ten, { maxKeys: null }).map((r) => r.id).length, 11, 'null 走默认档，与 expanded 同一口径');
  for (const bad of [-1, 2.5, NaN]) {
    assert.throws(() => flatten(ten, { maxKeys: bad }),
      (e) => e instanceof RangeError && /maxKeys/.test(e.message), `${bad} 不是合法的键数档`);
  }
  assert.throws(() => flatten(ten, { maxKeys: '3' }), TypeError, '字符串档是入参错，不是"截个字符串长度"');
});

test('V6 数组那一族的文案、折叠优先于截断、截断行自己不可展开', () => {
  const arr = Array.from({ length: 10 }, (_, i) => i);
  const rows = flatten({ a: arr }, { maxKeys: 4 });
  assert.deepEqual(rows.map((r) => r.id), ['', '/a', '/a/0', '/a/1', '/a/2', '/a/3', '/a~more']);
  assert.equal(rows.length, 7);
  const more = rows[6];
  assert.deepEqual([more.display, more.kind, more.parent, more.depth],
    ['还有 6 个元素未列出', 'array', '/a', 2], '截断行替的是那些子行的位置，所以 depth 也跟着父 +1');
  assert.deepEqual([rows[1].hiddenCount, rows[1].truncatedFrom], [6, 4]);
  const closed = flatten({ a: arr }, { expanded: new Set(['']), maxKeys: 4 });
  assert.deepEqual(closed.map((r) => r.id), ['', '/a'], '折叠优先：子行本来就不出现，也就没有截断行');
  assert.deepEqual([closed[1].hiddenCount, closed[1].truncatedFrom, closed[1].display], [10, -1, '[10 项]']);
  const fed = flatten({ a: arr }, { expanded: new Set(['', '/a', '/a~more']), maxKeys: 4 });
  assert.deepEqual(fed.map((r) => r.id), rows.map((r) => r.id),
    '把截断行的 id 塞进展开集，行集一个字都不变——它不是一格容器');
  const deepCut = flatten({ a: { b: arr } }, { expanded: new Set(['', '/a', '/a/b']), maxKeys: 2 });
  assert.deepEqual(deepCut.map((r) => r.id), ['', '/a', '/a/b', '/a/b/0', '/a/b/1', '/a/b~more']);
  assert.equal(deepCut[5].depth, 3, '深层那一支的截断行也跟在它自己那一层，不许冒到第 2 层去');
});

test('V7 id 就是 Pointer：前面插一格之后折叠态跟着 Pointer 走，不跟着行号走', () => {
  const rows = flatten(vMix(), { expanded: new Set(['', '/a']) });
  for (const r of rows) assert.equal(r.id, r.pointer, `${r.pointer} 的 id 必须还是那条 Pointer`);
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, '一轮行集里 id 唯一');
  const before = flatten({ a: 1, target: { x: 1 } }, { expanded: new Set(['', '/target']) });
  const after = flatten({ z: 0, a: 1, target: { x: 1 } }, { expanded: new Set(['', '/target']) });
  const idxOf = (rs, id) => rs.findIndex((r) => r.id === id);
  assert.deepEqual([idxOf(before, '/target'), idxOf(before, '/target/x')], [2, 3]);
  assert.deepEqual([idxOf(after, '/target'), idxOf(after, '/target/x')], [3, 4], '行号整体 +1，数据却还是同一份');
  assert.equal(after[idxOf(after, '/target')].expanded, true, '展开状态认的是 id，不是"第 2 行"');
  assert.equal(after[idxOf(after, '/target')].keyLabel, 'target');
  const cut = flatten({ a: 1, b: 2, c: 3 }, { maxKeys: 1 });
  assert.equal(cut[2].id, '~more');
  assert.equal(cut[2].pointer, '', '截断行是 id 口径的唯一例外：那一格点不出、也复制不出 Pointer');
  assert.equal(new Set(cut.map((r) => r.id)).size, cut.length, '连截断行一起算，id 仍然唯一');
});

test('V8 Pointer 的转义与「自有键」口径：~0/~1、空键、原型上那几个名字', () => {
  const v = { 'a/b': 1, 'c~d': 2, '': 3, 'e~1f': 4, 'g~0h': 5 };
  const rows = flatten(v, { expanded: new Set(['']) });
  assert.deepEqual(rows.slice(1).map((r) => r.pointer), ['/a~1b', '/c~0d', '/', '/e~01f', '/g~00h']);
  assert.deepEqual(rows.slice(1).map((r) => r.keyLabel), ['a/b', 'c~d', '', 'e~1f', 'g~0h'],
    'keyLabel 是原样键名：转义只发生在 Pointer 那一格');
  for (const r of rows.slice(1)) {
    const back = fromPointer(r.pointer);
    assert.equal(back.ok, true, `${r.pointer} 解不回去：拼与解必须是同一族口径`);
    assert.equal(back.segments.length, 1);
  }
  assert.equal(fromPointer('/e~01f').segments[0], 'e~1f',
    '与 json-core 同一条回路；先 ~1 再 ~0 的两趟写法会把它读成 e/1f');
  assert.deepEqual(flatten([1, 2], { expanded: new Set(['']) }).map((r) => [r.pointer, r.keyLabel]),
    [['', ''], ['/0', '0'], ['/1', '1']], '数组下标不转义，也不写成 [0]：那一层排版归视图层');
  const polluted = parseJson('{"__proto__":{"a":1},"constructor":2}');
  assert.equal(polluted.ok, true);
  const pr = flatten(polluted.value, { expanded: new Set(['']) });
  assert.deepEqual(pr.map((r) => r.pointer), ['', '/__proto__', '/constructor']);
  assert.equal(pr[1].childCount, 1, '__proto__ 那一格是真数据：它里面还有一个键');
  assert.equal(Object.getPrototypeOf(polluted.value), Object.prototype, '拍平一趟不许把原型改掉');
  assert.ok(!pr.some((r) => r.pointer === '/toString'),
    '只枚举自有键：for...in 那种把原型上的方法也枚举进来的写法不许用');
});

test('V9 display 的六档与长串截断：截断在转义之前，代理对不被劈成半个', () => {
  const show = (value) => flatten({ k: value }, { expanded: new Set(['']) })[1].display;
  assert.equal(show('x'), '"x"');
  assert.equal(show('a"b\\c\nd'), '"a\\"b\\\\c\\nd"', '引号、反斜杠、换行各走短转义');
  assert.equal(show(String.fromCharCode(1)), '"\\u0001"', '其余控制字符走 \\uXXXX，与 json-core 同一条口径');
  assert.equal(show(String.fromCharCode(7)), '"\\u0007"');
  assert.equal(show('1e21'), '"1e21"', '那是串不是数：引号区分得开');
  assert.equal(show(1e21), '1e+21');
  assert.equal(show(-0), '0', '与 String(-0)、JSON.stringify(-0) 同形：display 管"读起来"，-0 保不保是文本视图那一格的事（§S）');
  assert.equal(show(0.1 + 0.2), '0.30000000000000004');
  assert.equal(show(true), 'true');
  assert.equal(show(false), 'false');
  assert.equal(show(null), 'null');
  assert.equal(show({}), '{}');
  assert.equal(show({ a: 1, b: 2 }), '{2 键}');
  assert.equal(show([]), '[]');
  assert.equal(show([1, 2, 3]), '[3 项]');
  assert.equal(flatten({ k: { a: 1 } }, { expanded: new Set(['', '/k']) })[1].display, '',
    '展开的容器不留概览串：子行就在下面，再来一遍 {} 是噪音');
  const at200 = 'a'.repeat(200);
  assert.equal(show(at200), `"${at200}"`, '刚到那一格不截');
  assert.equal(show(at200 + 'b'), `"${at200}…"`, '越一格才截：截的是码元数，不是"看着长了"');
  assert.equal(show('"'.repeat(300)), `"${'\\"'.repeat(200)}…"`,
    '截断发生在转义**之前**，所以留出来的是整整 200 组 \\"，不会剩半根反斜杠');
  const emoji = 'x'.repeat(199) + '👍'.repeat(4);
  assert.equal(show(emoji), `"${'x'.repeat(199)}…"`,
    '第 200 格正好落在一个 emoji 上：宁可整个不收，也不留半个代理项');
  assert.equal(vHasLoneSurrogate(show(emoji)), false, 'display 里不许有落单的代理项');
  assert.equal(vHasLoneSurrogate(show('👍'.repeat(300))), false, '整串都是 emoji 也一样');
});

test('V10 expandOf 交回的是新 Set：不改行对象，折叠一支就把支内的展开态一起带走', () => {
  const rows = flatten(vMix());
  const a = expandOf(rows, '/o', false);
  assert.ok(a instanceof Set);
  assert.deepEqual([...a].sort(), ['', '/a'], 'rows 里展开着的是 ""、/a、/o 三格，关掉 /o 就剩两格');
  const b = expandOf(rows, '/a/1', true);
  assert.deepEqual([...b].sort(), ['', '/a', '/a/1', '/o']);
  assert.notEqual(a, b, '每一次都是一份新 Set');
  assert.equal(a.has('/a/1'), false, '两份之间互不影响');
  const before = rows.map((r) => [r.id, r.expanded]);
  expandOf(rows, '/s', true);
  assert.deepEqual(rows.map((r) => [r.id, r.expanded]), before, '行对象一格都不许被 expandOf 改');
  a.delete('');
  assert.deepEqual([...expandOf(rows, '/o', false)].sort(), ['', '/a'],
    '刚才那份被调用方改了也不影响下一次：每次都从 rows 重建');
  assert.deepEqual([...expandOf(rows, '/nope', true)].sort(), ['', '/a', '/nope', '/o'],
    '行集里没有的 id 照收（与 V3 同一口径：不算错）');
  assert.equal(flatten(vMix(), { expanded: expandOf(rows, '/nope', true) }).length, rows.length,
    '多出来的那一个没用的 id 不改变行集');
  assert.deepEqual([...expandOf(rows, '/nope', false)].sort(), ['', '/a', '/o'], '关掉一格没开着的也算没发生');
  const chain = { l1: { l2: { l3: 1 } } };
  const wide = flatten(chain, { expanded: new Set(['', '/l1', '/l1/l2']) });
  assert.equal(wide.length, 4);
  const shut = expandOf(wide, '/l1', false);
  assert.deepEqual([...shut].sort(), ['', '/l1/l2'], '/l1/l2 的展开态还在这份里，但它已经是一格过期 id');
  const back = expandOf(flatten(chain, { expanded: shut }), '/l1', true);
  assert.deepEqual([...back].sort(), ['', '/l1'],
    '再展开 /l1 时 /l1/l2 已经不在这一轮行集里，于是被丢掉：折叠一支会把支内的展开态一起带走');
  assert.deepEqual(flatten(chain, { expanded: back }).map((r) => r.pointer), ['', '/l1', '/l1/l2']);
  assert.throws(() => expandOf(rows, 42, true), TypeError);
  assert.throws(() => expandOf('not rows', '', true), TypeError);
});

test('V11 搜索三档 scope：key 只认键、value 只认标量的渲染串、both 取并，档位不认就抛', () => {
  const rows = vAll(vHay());
  assert.equal(rows.length, 8, '四个直接子项 + list 的两个元素 + deep 的一个键 + 根');
  assert.deepEqual(searchRows(rows, 'key', { scope: 'key' }).matchedIds, ['/Key']);
  assert.deepEqual(searchRows(rows, 'key', { scope: 'value' }).matchedIds, ['/deep/k'],
    '/deep/k 的渲染串是 "key inside"');
  assert.deepEqual(searchRows(rows, 'key', {}).matchedIds, ['/Key', '/deep/k'], '缺省档就是 both');
  assert.deepEqual(searchRows(rows, 'both', { scope: 'both' }).matchedIds, [], '档位名不是搜索词：这一趟谁都别命中');
  assert.deepEqual(searchRows(rows, 'ITEM', { scope: 'value' }).matchedIds, ['/list/0']);
  assert.deepEqual(searchRows(rows, '12', { scope: 'value' }).matchedIds, ['/list/1', '/n'],
    '值搜的是渲染串，所以 12 也命中 123——"子串"这一档写死，不许谁来实现期改成整词匹配');
  assert.deepEqual(searchRows(rows, '"', { scope: 'value' }).matchedIds, ['/Key', '/list/0', '/deep/k'],
    '引号算进渲染串：搜一个 " 就是"所有字符串行"');
  for (const bad of ['all', 'KEY', '', 'keys', 'Both']) {
    assert.throws(() => searchRows(rows, 'key', { scope: bad }),
      (e) => e instanceof RangeError && /key \| value \| both/.test(e.message), `${bad} 不是本站的档位`);
  }
  assert.throws(() => searchRows(rows, 42), TypeError, '搜索词是字符串：数字不是"没搜到"而是写错了');
  assert.throws(() => searchRows(rows, null), TypeError);
  assert.throws(() => searchRows('not rows', 'x'), TypeError);
  const empty = searchRows(rows, '');
  assert.deepEqual([empty.total, empty.truncated], [0, 0], '空串不是"匹配一切"');
  assert.equal(rows.some((r) => r.matched), false, '空串这一趟还要把上一轮的色洗掉');
});

test('V12 matched 只有一处上色：顺序随行集走，重跑不留上一轮的色，容器概览串不算值', () => {
  const rows = vAll(vHay());
  const r1 = searchRows(rows, 'E', { scope: 'key' });
  assert.deepEqual(r1.matchedIds, ['/Key', '/deep'], '按行序给，不是按"先命中谁"给');
  assert.equal(r1.total, r1.matchedIds.length, 'total 就是 matchedIds 的长度，不是"扫描过的行数"');
  assert.deepEqual(rows.filter((r) => r.matched).map((r) => r.id), ['/Key', '/deep']);
  const r2 = searchRows(rows, 'zzz', { scope: 'both' });
  assert.equal(r2.total, 0);
  assert.equal(rows.every((r) => r.matched === false), true, '上一轮的 /Key 必须被洗掉');
  assert.deepEqual(searchRows(rows, 'KEY', { scope: 'key' }).matchedIds, ['/Key'], 'ASCII 大小写折掉');
  assert.deepEqual(searchRows(rows, 'inside', { scope: 'value' }).matchedIds, ['/deep/k']);
  assert.deepEqual(searchRows(rows, '中文', { scope: 'both' }).matchedIds, [], '没大小写可折的照原样比');
  const part = flatten(vHay(), { expanded: new Set(['']) });
  assert.deepEqual([part[2].display, part[4].display], ['[2 项]', '{1 键}'], '这一份里有两格折叠概览串');
  for (const q of ['键', '项', '[2 项]', '{1 键}']) {
    assert.deepEqual(searchRows(part, q, { scope: 'value' }).matchedIds, [],
      `${q}：容器行不参与值搜索，否则搜一个 2 就命中一堆 [2 项]`);
  }
  const cut = flatten(vHay(), { maxKeys: 3 });
  assert.equal(cut[cut.length - 1].id, '~more');
  assert.deepEqual(searchRows(cut, '列出', { scope: 'both' }).matchedIds, [],
    '截断行那句文案不是数据：搜"列出"不许把它算成一次命中');
  assert.equal(searchRows(cut, '列出', { scope: 'both' }).truncated, 1, '但它下面确实少扫了一格');
});

test('V13 truncated 是"这次没扫到的直接子项数"：全展开归 0，折叠与截断都算进去', () => {
  const rows = vAll(vHay());
  assert.equal(searchRows(rows, 'ITEM', { scope: 'value' }).truncated, 0, '全展开、无截断：这一趟吃下了整棵树');
  const part = flatten(vHay(), { expanded: new Set(['']) });
  const s = searchRows(part, 'ITEM', { scope: 'value' });
  assert.deepEqual([s.total, s.truncated], [0, 3],
    'ITEM 藏在 /list 里而 /list 折叠着：搜不到，truncated 报 3（/list 的 2 项 + /deep 的 1 键）');
  const cut = flatten(vHay(), { maxKeys: 3 });
  const s2 = searchRows(cut, 'ITEM', { scope: 'value' });
  assert.deepEqual([s2.matchedIds, s2.truncated], [['/list/0'], 1], '截断那一格同样计入：还差一个 deep 没扫');
  const nested = flatten({ a: { b: { c: 1 } } }, { expanded: new Set(['']) });
  assert.equal(searchRows(nested, 'zzz').truncated, 1,
    '只报"直接少了几格"，不是"整棵子树少了几行"——后者要第二趟扫描，而拍平只有一趟（V4 同一条口径）');
  assert.equal(typeof searchRows(rows, 'x').truncated, 'number', '那一格是数字不是布尔：装配层要把它写进提示里');
  assert.equal(searchRows(vSet(0), 'x').truncated, 0, '根是一格空对象：没有子项，也就没有"没扫到"');
});

/**
 * 假 DOM（本节自建，形状照 §I 的 `iPage` 但只开 json-tree 用到的那几张口子）。
 * 三处刻意的"不像真 DOM"，每一处都是为了少一处假绿：
 * 1. **没有 `innerHTML`**。控制器若写了它，只会长出一个普通属性、一个子节点都不多——V14 判的正是
 *    "三块与行是真的节点"。真 DOM 反而会把标签解析出来，把这条判据洗白。
 * 2. **`removeChild` 找不到节点就抛**。静默的话"撤行没撤干净"看不见。
 * 3. **`dispatch` 只调真的挂上去的监听**，`removeEventListener` 之后调不到——V16 那条
 *    "destroy 摘干净"量的就是这个。
 * `scrollTop` 是可写的普通字段：真浏览器里由滚动条决定，这里由判据决定，而控制器读它的方式一模一样。
 */
function vTree({ rowHeight = 24 } = {}) {
  const focusLog = [];
  let active = null;
  const mk = (tag) => {
    const attrs = new Map();
    const listeners = new Map();
    const el = {
      nodeType: 1, tagName: tag.toUpperCase(), attrs, childNodes: [], style: {}, textContent: '',
      setAttribute: (k, v) => { attrs.set(k, String(v)); },
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      appendChild: (n) => { el.childNodes.push(n); return n; },
      removeChild: (n) => {
        const i = el.childNodes.indexOf(n);
        if (i < 0) throw new Error('假 DOM：这个父节点下没有它');
        el.childNodes.splice(i, 1);
        return n;
      },
      addEventListener: (t, fn) => {
        if (!listeners.has(t)) listeners.set(t, new Set());
        listeners.get(t).add(fn);
      },
      removeEventListener: (t, fn) => {
        const s = listeners.get(t);
        if (s) s.delete(fn);
      },
      dispatch: (t) => { for (const fn of [...(listeners.get(t) || [])]) fn({ type: t }); },
      listenerCount: (t) => (listeners.get(t) || new Set()).size,
      focus: () => { active = el; focusLog.push(el.getAttribute('data-jt-id')); },
    };
    return el;
  };
  const doc = { createElement: (tag) => mk(tag), get activeElement() { return active; } };
  const container = mk('div');
  container.scrollTop = 0;
  container.clientHeight = 480;
  const holder = () => container.childNodes[1];
  return {
    doc, container, focusLog, holder,
    rowCount: () => (holder() ? holder().childNodes.length : 0),
    rowIds: () => holder().childNodes.map((n) => n.getAttribute('data-jt-id')),
    rowAt: (i) => holder().childNodes[i],
    rowIndexOf: (id) => holder().childNodes.map((n) => n.getAttribute('data-jt-id')).indexOf(id),
    pad: (i) => container.childNodes[i],
    /** 三块的总高：垫块读 style.height，行按 rowHeight 算——契约② 的外部证据就是这一个数 */
    contentHeight: () => {
      const px = (n) => Number.parseInt(n.style.height || '', 10) || 0;
      const pads = container.childNodes.filter((n) => n !== holder()).reduce((s, n) => s + px(n), 0);
      return pads + (holder() ? holder().childNodes.length * rowHeight : 0);
    },
    get activeId() { return active ? active.getAttribute('data-jt-id') : null; },
  };
}

test('V14 契约①② ：容器里只有三块常驻节点，垫块高度让总长 == 行数 × rowHeight', () => {
  const page = vTree({ rowHeight: 24 });
  const c = createTreeController({ document: page.doc, container: page.container, rowHeight: 24, windowSize: 40 });
  const rows = vSet(299);
  c.setData(rows);
  assert.equal(rows.length, 300);
  assert.deepEqual(page.container.childNodes.map((n) => n.tagName), ['DIV', 'DIV', 'DIV'],
    '常驻的就三块，一行动态节点都不许挂在这一层');
  assert.deepEqual(page.container.childNodes.map((n) => n.getAttribute('class')),
    ['jt-tree__pad', 'jt-tree__rows', 'jt-tree__pad']);
  assert.equal(page.holder().getAttribute('role'), 'tree');
  assert.equal(page.contentHeight(), 300 * 24, '上下垫块 + 窗口里的行 = 总高——"只渲染可视"唯一的外部证据');
  const el = page.rowAt(0);
  assert.deepEqual([el.tagName, el.getAttribute('role'), el.getAttribute('tabindex')], ['DIV', 'treeitem', '0']);
  assert.equal(el.getAttribute('aria-level'), '1', 'aria-level 从 1 起、depth 从 0 起，两把尺差一格');
  assert.equal(el.getAttribute('data-jt-id'), '');
  assert.equal(el.getAttribute('data-jt-pointer'), '');
  assert.equal(el.textContent, '', '根展开着：那一行只有折叠三角（CSS 给），不许挤出一句假文案');
  assert.equal(el.getAttribute('aria-expanded'), 'true', '容器行把折叠与否写在 aria-expanded 上');
  const second = page.rowAt(1);
  assert.deepEqual([second.getAttribute('data-jt-id'), second.getAttribute('aria-level'),
    second.getAttribute('data-jt-pointer'), second.textContent], ['/r0', '2', '/r0', 'r0: 0']);
  assert.equal(second.getAttribute('aria-expanded'), null, '标量行没有这一格');
  assert.deepEqual([el.style.paddingLeft, second.style.paddingLeft], ['0px', '12px'],
    '缩进写在行元素自己身上，默认一档 12px（装配层要换密度就传 indentStep）');
  const first0 = page.pad(0).style.height;
  page.container.scrollTop = 1200;
  page.container.dispatch('scroll');
  const range = c.visibleRange();
  assert.equal(page.pad(0).style.height, `${range.first * 24}px`);
  assert.equal(page.pad(2).style.height, `${(300 - range.last - 1) * 24}px`);
  assert.equal(page.contentHeight(), 300 * 24, '滚到哪里总高都不变，变的只是三块内部的分摊');
  assert.notEqual(page.pad(0).style.height, first0, '垫块真的跟着滚动走');
  assert.equal(page.rowAt(0).getAttribute('data-jt-id'), '/r39',
    '窗口上面还留着十行缓冲：滚到 1200 就是第 50 行开头，进 DOM 的第一行是第 40 行');
  const mixed = vTree({ rowHeight: 24 });
  const cm = createTreeController({ document: mixed.doc, container: mixed.container, rowHeight: 24 });
  cm.setData(flatten(vMix()));
  const cls = (id) => mixed.rowAt(mixed.rowIndexOf(id)).getAttribute('class');
  assert.ok(cls('/a').includes('is-open'), '/a 展开着');
  assert.ok(cls('/a/1').includes('is-closed'), '/a/1 折叠着');
  assert.ok(cls('/o/k').includes('is-closed'), '空容器也是一格折叠：它的概览串是 {}');
  assert.ok(cls('/s').includes('jt-tree__row--string'), 'kind 进 class，视图层照它上色');
  cm.setData(flatten(vMix(), { maxKeys: 1 }));
  assert.ok(cls('~more').includes('jt-tree__row--more'), '截断行有自己的 class');
  assert.equal(mixed.rowAt(mixed.rowIndexOf('~more')).getAttribute('role'), 'button', '那一行是一个动作，不是一条数据');
  assert.equal(mixed.rowAt(mixed.rowIndexOf('~more')).textContent, '还有 5 个键未列出');
  cm.setData([]);
  assert.deepEqual(cm.visibleRange(), { first: -1, last: -1, count: 0 }, '空行集：区间用 -1 表达"没有"');
  assert.deepEqual([mixed.rowCount(), mixed.contentHeight()], [0, 0], '两块垫块都得归零，不然滚动条留着骗人');
  assert.equal(mixed.container.childNodes.length, 3, '空数据也不许把三块拆了');
});

test('V15 契约③：五千行、任意 scrollTop，一次进 DOM 的行数不超过 windowSize 且窗口盖住视口首行', () => {
  const total = 5000;
  const rowHeight = 20;
  const windowSize = RENDER_WINDOW;
  const page = vTree({ rowHeight });
  const calls = [];
  const c = createTreeController({
    document: page.doc, container: page.container, rowHeight, windowSize,
    onViewChange: (p) => calls.push(p),
  });
  c.setData(vSet(total - 1));
  assert.equal(c.state().total, total);
  assert.equal(c.state().windowSize, windowSize, '窗口那一格要在 state() 里读得回来：装配层的文案要说"一次渲染 80 行"');
  let maxNodes = 0;
  for (let i = 0; i < total; i += 37) {
    page.container.scrollTop = i * rowHeight;
    page.container.dispatch('scroll');
    const n = page.rowCount();
    maxNodes = Math.max(maxNodes, n);
    const r = c.visibleRange();
    assert.ok(n <= windowSize, `第 ${i} 行处渲染了 ${n} 行，越过 windowSize=${windowSize}`);
    assert.ok(r.first <= i && i <= r.last, `视口首行 ${i} 不在窗口 [${r.first}, ${r.last}] 里`);
    assert.equal(r.last - r.first + 1, n, 'visibleRange 报的区间必须就是 DOM 里的行数，两处一把尺');
    if (i > 0) {
      assert.equal(page.rowAt(i - r.first).getAttribute('data-jt-id'), `/r${i - 1}`,
        `窗口里第 ${i} 行那一格的 id 与行序对不上`);
    }
  }
  assert.equal(maxNodes, windowSize, '窗口是用满的：判据要的是"上界卡住"，不是"少渲染"');
  page.container.scrollTop = 10 ** 9;
  page.container.dispatch('scroll');
  assert.deepEqual(c.visibleRange(), { first: total - windowSize, last: total - 1, count: windowSize }, '越界往下滚就贴底');
  page.container.scrollTop = -5;
  page.container.dispatch('scroll');
  assert.deepEqual(c.visibleRange(), { first: 0, last: windowSize - 1, count: windowSize }, '越界往上滚就贴顶');
  const before = calls.length;
  page.container.scrollTop = 4000;
  page.container.dispatch('scroll');
  assert.equal(calls.length, before + 1, '窗口区间换了才叫这一次');
  page.container.scrollTop = 4010;
  page.container.dispatch('scroll');
  assert.equal(calls.length, before + 1,
    '同一区间的两个 scrollTop（4000 与 4010 都从第 200 行起）别再刷读数：装配层每叫一次都要重算一行状态');
  assert.deepEqual(calls[calls.length - 1], { first: 180, last: 259, count: 80, total, scrollTop: 4000 });
  const small = vTree({ rowHeight });
  const cs = createTreeController({ document: small.doc, container: small.container, rowHeight, windowSize });
  cs.setData(vSet(4));
  assert.deepEqual(cs.visibleRange(), { first: 0, last: 4, count: 5 }, '数据比窗口短就全渲染');
  assert.deepEqual([small.pad(0).style.height, small.pad(2).style.height], ['0px', '0px']);
  assert.equal(small.rowCount(), 5);
  assert.equal(small.contentHeight(), 5 * rowHeight);
});

test('V16 契约④：锚点与焦点只认 id，setExpanded 抓"行集与展开集不同轮"，destroy 摘干净', () => {
  const rowHeight = 24;
  const windowSize = 40;
  const page = vTree({ rowHeight });
  const c = createTreeController({ document: page.doc, container: page.container, rowHeight, windowSize });
  c.setData(vSet(4999));
  assert.equal(c.scrollToPointer('/r2500'), true);
  assert.equal(page.container.scrollTop, 2501 * rowHeight,
    '落点精确到那一行的行首：/r2500 是第 2501 行（第 0 行是根），所以滚到 2501 × 行高');
  assert.equal(c.state().anchorId, '/r2500');
  assert.equal(c.visibleRange().first, 2491, '窗口上面留着十行缓冲，所以进 DOM 的第一行比锚点早十行');
  assert.equal(page.rowAt(10).getAttribute('data-jt-id'), '/r2500', '锚点那一行确实在窗口里，不是只改了个 scrollTop');
  assert.equal(c.scrollToPointer('/nope'), false, '行集里没有的那一格：不动滚动，回报 false');
  assert.equal(page.container.scrollTop, 2501 * rowHeight);
  assert.equal(c.scrollToPointer(''), true, '根永远在第 0 行');
  assert.equal(page.container.scrollTop, 0);
  c.scrollToPointer('/r2500');
  c.setData(vSet(4999, true));
  assert.equal(page.container.scrollTop, 2502 * rowHeight, '锚点前面插了一行，scrollTop 就跟着补一行——不然锚点落到别人那格');
  assert.equal(page.rowAt(10).getAttribute('data-jt-id'), '/r2500', '窗口里那十行缓冲之后，锚点还是这一条数据');
  assert.equal(c.state().anchorId, '/r2500');
  c.scrollToPointer('/r3000');
  c.setData(vSet(10));
  assert.equal(c.state().anchorId, '/r3000', '锚点那一行这轮没了也照样记着，等它回来');
  assert.equal(page.container.scrollTop, (11 - 1) * rowHeight, '行集缩到 11 行，滚动条贴到最底那一格，不许悬在半空');
  assert.equal(page.rowCount(), 11, '行集比窗口短就全渲染');
  c.setData(vSet(4999));
  c.scrollToPointer('/r20');
  const focused = page.rowAt(10);
  assert.equal(focused.getAttribute('data-jt-id'), '/r20');
  focused.focus();
  c.refresh();
  assert.notEqual(page.doc.activeElement, focused, 'refresh 重建了节点，被点的那个旧节点已经不在树里');
  assert.equal(page.activeId, '/r20', '焦点跟着 id 回来，而不是被丢回 body');
  assert.equal(page.focusLog.length, 2, '一次是人点的、一次是控制器交回的，不许多补');
  const rows = flatten(vMix());
  c.setData(rows);
  c.setExpanded(new Set(['', '/a', '/o']));
  assert.throws(() => c.setExpanded(new Set([''])),
    (e) => e instanceof TypeError && /展开集/.test(e.message) && /行集/.test(e.message),
      '行集里 /a 与 /o 是展开的，喂进来的展开集却没有——这是不同轮的两份东西，当场点名');
  c.setExpanded(new Set(['', '/a', '/o']));
  assert.equal(c.state().expanded.size, 3, '同一份喂两次总是合法');
  assert.throws(() => c.setData('not rows'), TypeError, 'setData 只收 flatten 交回的行集');
  assert.throws(() => c.setData([{ id: 1 }]), TypeError,
    '行集里那一格不是行对象：当场点名，别渲染出一树 undefined');
  assert.equal(c.state().total, rows.length, '闸门抛在改状态之前：行集还是上一轮那一份');
  c.destroy();
  assert.deepEqual(page.container.childNodes, [], '常驻三块都得摘干净');
  assert.equal(page.container.listenerCount('scroll'), 0, 'scroll 监听留在页上就是给下一次 mount 叠一份');
  c.destroy();
  page.container.scrollTop = 100;
  page.container.dispatch('scroll');
  assert.equal(page.container.childNodes.length, 0, '拆完之后的事件不许复活任何节点');
  const gatePage = vTree({ rowHeight });
  assert.throws(() => createTreeController({ container: gatePage.container, rowHeight: 24 }),
    (e) => e instanceof TypeError && /document/.test(e.message));
  assert.throws(() => createTreeController({ document: gatePage.doc, rowHeight: 24 }),
    (e) => e instanceof TypeError && /container/.test(e.message));
  assert.throws(() => createTreeController({ document: {}, container: gatePage.container, rowHeight: 24 }), TypeError);
  assert.throws(() => createTreeController({ document: gatePage.doc, container: {}, rowHeight: 24 }), TypeError);
  for (const bad of [0, -1, NaN, Infinity, '24', undefined, null]) {
    assert.throws(() => createTreeController({ document: gatePage.doc, container: gatePage.container, rowHeight: bad }),
      (e) => e instanceof TypeError && /rowHeight/.test(e.message), `${bad} 不是合法的 rowHeight`);
  }
  for (const bad of [0, -1, 2.5, NaN]) {
    assert.throws(() => createTreeController({ document: gatePage.doc, container: gatePage.container,
      rowHeight: 24, windowSize: bad }), (e) => e instanceof RangeError && /windowSize/.test(e.message));
  }
  assert.throws(() => createTreeController({ document: gatePage.doc, container: gatePage.container,
    rowHeight: 24, onViewChange: 42 }), TypeError);
  assert.equal(gatePage.container.childNodes.length, 0, '闸门抛在挂节点之前，别留下半棵树');
});
```

### 提交后复跑（2026-09-29，Task 5 落地那一格）

- 门禁一 `# tests 332 / # pass 332 / # fail 0`（§V 进来 16 条，316 → 332；单跑这一族用
  `--test-name-pattern '^V'` → 16/16）。
- 门禁二在 **HEAD 导出树**（`git archive HEAD` + 只叠本格那五本）`exit=0`：计划 js 块 53 个、
  其中 **58 个已落地镜像、合计 1,175,844B、未落地 0 节**，`json-tree.js` 整文件与 §V 整节
  （磁盘 11312–11929 ↔ 计划 5827–6444，618 行）逐字节全等。活树跑同一条也是 `exit=0`——
  Task 2/3 那两格一直挂着的 `_data/onlineTools.yml`（磁盘 141 ↔ 镜像 141）与
  `dev/sass/toolkit.scss`（磁盘 755 ↔ 镜像 755）两格红，如今各自对齐了：前者是 `0e5ee4b`
  把改口与计划镜像落进同一笔提交，后者是暂存区里那 75/4 行现在就是段 2 镜像的内容
  （那本计划的工作树副本与 HEAD 一字不差）。所以这格没有"不在活树 `--fix`"要交代的红；
  两块新镜像仍然由磁盘内容生成，`--fix` 复跑报的是"没有可同步的镜像块"。
- 门禁三 `exit=0`，`35/35 通过`，末尾两条自证原样：副本回到全绿、实验前后工作树脏指纹
  一模一样（脏项 32 个、diff 指纹 `021553b644a211c6`，含另一路会话那批，一律未被触碰）。
- **门禁四（本格真重建，两棵树对拍）**：`/tmp/seg4t5-base`（纯 `git archive HEAD`）与
  `/tmp/seg4t5-work`（同一份 HEAD 叠上面那五本），各自 `ln -s` 活树 `node_modules`、各自
  `npx vite build`（Node v22.19.0，两边都 `✓ built in` <7s、`exit=0`）。产物三列清单
  （路径 + 原始字节 + `cat f | gzip -9 | wc -c`）`assets/{js,css}/*.min.*` 各 **33 件**，
  两份清单**逐行全等**（md5 同为 `e9418a845f103ff076bf27903427733b`），合计
  原始 657,107B / gzip 201,702B。零增量的理由是**如实**的：`json-tree.js` 落在 `dev/js/tools/`
  而不是 `dev/js/`，不在 vite 的入口扫描面里，而此刻没有任何一本入口 import 它——
  §0.5 那句"动过 `dev/` 就必须真重建"照做，只是这格的"做"读出的是"没进产物"。
  **Task 6 之后这一格必然不再是等式**（`toolJson.js` 一挂进口，`toolIdcard`/`toolCodec` 那两支
  共付件之外的新件就要单独记账），届时的对拍基线要重新取。
- 门禁五 `exit=0`（"收录面 2 条 ready 条目 × 5 组判据全绿"，导航-全站核到 95 页；json 条目到
  Task 7 才进收录面）。跑之前确认过这个仓库没有活的 `vite build --watch` / `jekyll serve`
  （在听的 5173 属于兄弟仓库 `2026-09-28-10-07-28/vue-antdv`），`_site/` 是今天 14:44 的那一份。
- 门禁六 `exit=0`（"牙齿台账：36/36 组变异如期变红"+"全部变异已还原，复跑基线仍绿"）。
  它就地改源再还原，所以跑前跑后各取一次 `_data/onlineTools.yml` / `tools.html` /
  `_data/tools.yml` 的 md5：三份一字不差，另一路会话那批未提交的改动没被卷进任何一次变异。

```bash
git add dev/js/tools/json-tree.js scripts/toolkit-tests.mjs scripts/verify-plan-blocks.mjs \
        _docs/superpowers/plans/2026-09-29-tools-json-page.md \
        _docs/superpowers/plans/2026-09-25-online-tools-foundation.md
git commit -m "feat(tools): 段 4 Task 5 json-tree——拍平纯函数 + 只渲染可视行的控制器（§V）"
```

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
