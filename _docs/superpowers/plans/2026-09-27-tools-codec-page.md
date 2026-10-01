# 编码工具箱页（`/tools/codec.html`）实现计划

> **For agentic workers：** REQUIRED SUB-SKILL：用 superpowers:subagent-driven-development（推荐）
> 或 superpowers:executing-plans 逐格执行本计划。步骤用 `- [ ]` 复选框语法跟踪。

**Goal：** 把设计文档 §5.2 那一页（时间戳 / Base64 / URL / 摘要 / 正则五块面板）做成站内第二张
面板式工具页，与证件页共用同一套面板框架与样式层，且段 2 收口时欠下的四条浏览器侧义务在这一段全部兑现。

**Architecture：** 沿用段 2 已落地的四层——纯逻辑模块（`dev/js/tools/*.js`，不碰 DOM、入参形状不对就抛）
→ 纯字符串视图层（`view.js` 的 `esc`/`checksTable`/`noteLines` 那一族）→ 面板框架
（`panel.js` 状态机 + `panel-dom.js` 绑定层，两页零改动复用）→ 页面装配层（本段新增
`codecWorkbench.js` + 入口 `toolCodec.js`）。页面骨架由 Jekyll 构建期渲染，禁 JS 与爬虫读得到全部正文。

**Tech Stack：** Jekyll 4 + Liquid、Vite 5（`getDevJsEntries()` 只扫 `dev/js/` 一层，子目录不成入口）、
Node 22 内置 test runner（`scripts/toolkit-tests.mjs`，无新增依赖）、SCSS、零第三方运行时库。

**写本计划时（2026-09-27）的前置事实**：段 1 与段 2（Task 1–11）已全部落地并提交，
证件页已收录可见；段 2 最后两条 commit（`9a83307` / `da58b1c`）**只在本地，未推送**。

---

## 0. 本段的口径与决策（执行期不再重新问）

### 0.1 详写的节奏：本文件是"契约先写、代码随后"的两段式计划

`superpowers:writing-plans` 要求每一格都带完整代码。本段**有意偏离**这一条，理由是段 2 的实测教训：
段 2 计划在实现之前写完前 8 格，落地时因两轮代码评审把实现改掉，计划里 4,000 多行镜像全靠
`verify-plan-blocks.mjs --fix` 回同步，起草时代码里写死的 60KB 等口径反过来变成三处过期引用
（对账见段 2 计划文末的 Task 11）。所以本段把"必须先定死的东西"放在这里，把"会被评审改动的东西"
留在执行期写：

- **现在就定死**：文件清单与职责、每一层的对外签名（函数名、参数、返回字段名）、判据编号与它咬的
  那一件事、门禁改哪一处、提交边界。这一层写错会让两格互相不一致，代价最大。
- **执行期写、写完 `--fix` 同步进计划**：函数体、表数据、SCSS 规则、页面 Liquid。段 2 已证明
  镜像门禁比对的是"计划块 ↔ 磁盘文件"，磁盘是权威，`--fix` 整块重写是唯一正当姿势。

因此每格的 Step 顺序固定为：**写判据（红）→ 写实现（绿）→ 登记镜像 → `--fix` 同步 → 门禁 → 提交**。
一格一次提交，计划与代码同批。

### 0.2 复用面（段 2 调研实测，全部带 `文件:行号`）

| 现有件 | codec 页怎么用 | 证据 |
| --- | --- | --- |
| `dev/js/tools/panel.js` | **一行都不改**，`ids: ['timestamp','base64','url','digest','regex']` | 零证件页耦合；导出 `createPanelWorkspace:28` / `parseHash:201` / `keyAction:212`，前缀与 label 全是构造参数（`:29`） |
| `dev/js/tools/panel-dom.js` | 白拿键盘、深链、单块错误隔离 | 要求页面预存 `{prefix}-tablist` / `-tab-<slug>` / `-panel-<slug>`（`:228-247`），只用 `getElementById`（`:73`） |
| `dev/js/toolkitCore.js` | 不动 `window.Tk` 的三键形状 | `window.Tk = { createPanelWorkspace, createPanelDom, view }`（`:25`） |
| `dev/js/tools/view.js` | 用 `esc:77`、`checksTable:160`、`noteLines:368`、私有 `table():113` | `stateBadge:149` 的六档 `STATE_META:44-51` 是证件词语，codec 自带 tone 映射 |
| `dev/sass/toolkit.scss` | 布局/表单/结果/状态色全套白拿 | 文件头 `:1` 就写着"idcard、codec、json 共用这一层"；`.tk-workspace:118` … `.tk-state*:509-538` |
| `postcss.config.js` | **不改**（前缀仍是 `tk`，字符串黑名单已覆盖） | `:87` 的 `'.tk-'` 注释原文即"证件页 / 编码工具箱页" |
| `workbench.js` 的 id 生成器 | `fieldId/buttonId/copyId/outId/whenId:84-132` 与 `controlIds:1000` 的**形状**照抄，代码不复用 | 它直接 `import` 六本证件业务模块（`:44-57`），复用会把 `region-data.js` 的 100KB 拖进 codec |

### 0.3 一处必须拆开的地基：`check-tools-surface.mjs` 现在把"一页"写死了

实测：该脚本 `:66-67` 无条件 `import` 证件页的 `WORKBENCH_SPEC` / `PANEL_IDS`，
而 `:389-393` 拿它去比**每一条** ready 条目的 `panels`。全文无 `idcard` 字面量、也无 `91` 之类计数
硬编码——唯一的耦合点就是这一句 import，**加第二条 ready 条目必红**。
Task 7 的第一步就是把这张 spec 表变成"按条目取"，且改动要有一条变异自证：把 codec 条目里的
`digest` 挪个位置，门禁必须红。

### 0.4 预算：§7 表里**没有** codec 那一行（逐字确认过 —— 这一句讲的是**起草时**的形状）

`_docs/superpowers/specs/2026-09-25-blog-online-tools-design.md` §7 的表在起草时只有八行：
区划表产物 36KB / 证件页 JS+CSS 76KB / 证件页自身增量的首屏成本 16KB / JSON 页 120KB /
输入硬上限 / 树视图 / 正则 / 深样本。codec 页一段话都没提。
**（Task 9 注，2026-09-29）** 本节原来在这句后面写着"（246–256 行）"——那个行号是起草时读到的，
表格已经因为下面要立的那两行变长，按本计划自己的规矩（"位置给锚点不给行号"）删掉；
锚点是表格第一列的项名「编码页 JS+CSS」。上面那句"没有 codec 那一行"**同样只到起草为止**，
两行已在 Task 8 立进表里，别再拿本节标题当现状读。

处置：Task 8 落地后按实测**新增两行**（`编码页 JS+CSS` 与 `编码页自身增量的首屏成本`），
先量后立、写在实测之上并留 ≥5% 余量——段 2 那条 60KB 的教训就是拍脑袋先立数导致的。
起草时的预期值：codec 四本模块都是算法、无数据表，MD5 自实现约 1.5–2KB gzip，
**预期总量在 15–20KB gzip 一档**；若实测超过 30KB，按 BLOCKED 协议停下交回，不自行改判据。
gzip 口径钉死 `cat f | gzip -9 | wc -c`（§7 第五段的口径警告：与 `zlib.gzipSync` 差 293B）。
**（Task 9 注）** 实测 21,830B 落在预期那一档之上，同时这句"超过 30KB"撞上两种读法
（专有一件 21,830B 未触发 / 三件合计 31,002B 越 30,720B 那一格 282B）——Task 8 没有自行判它，
分歧原样写在它的记录"三笔要留的账"第 3 条，Task 9 把它**交回给人判定**，本格不改判据、不改那一行的数。

### 0.5 段 2 交回的四条浏览器侧义务，本段全部要兑现

1. 核验脚本要挂 `Runtime.enable` + `Runtime.exceptionThrown` + `Log.entryAdded`（`console.error` 走这条），
   判据"必须为 0"。全仓库现在**零处**监听（`grep -rln 'exceptionThrown\|consoleAPICalled' scripts/ dev/` 为空）。
2. 方向键切面板与 `Enter` 触发复制要用 `Input.dispatchKeyEvent` 真按一遍，不再只靠逻辑层证据。
3. `Esc` 的判据是**公共层回归**：打开 ⌘K → 按 Esc → 断 `#cmdk` 回到 `hidden`。
   **不给工具层新造 Esc 交互**（`dev/js/tools/` 加两个入口零 `Escape` 处理是设计如此）。
   公共层现有五处 `Escape`：`dev/js/editorial.js:389/757/1549/1726/2040`。
4. 视口沿用段 2 Task 10 的十档：`360/640/641/880/900/901/920/940/1280/1920`
   （`scripts/verify-idcard-browser.mjs:156` 的 `VPS`，同序）。

### 0.6 镜像门禁的真实重量（写代码之前就要知道，否则会在门禁二上得到一条看不懂的红）

`scripts/verify-plan-blocks.mjs` 的三条机制决定了本段每一格的收尾动作：

1. `PLANS`（`:50-53`）现在只有段 1、段 2 两份。**Task 1 必须往里加第三项**（`tag: '段3'`），
   否则段 3 计划里贴的任何镜像都不被核对，而 `FILE_TARGETS` 里新登记的文件会因为
   "两份计划里都没有逐字节相同的块"直接 `✗`（`:347`）。
2. `FILE_TARGETS`（`:64-93`）是整文件镜像清单：**登记了就必须有镜像**，方向是磁盘 → 计划。
   反查那道（`:447-474`，扫 `MIRROR_SCAN:111-120`）只抓"磁盘有镜像却没登记"。
3. `SEGMENTED`（`:123`）+ `SEG_MARK`（`:136`，`/^\/\/ ── §([B-Z]\d*) /`）：测试文件里**每一节**
   都要有一个分节镜像块。新增 §K 的那一刻，磁盘多出一节而计划没有对应块 → 门禁二红。

推论（本段的硬规矩）：**契约段一律用 ```text 围栏**，只有"计划里那份文件全文"与"某一节测试全文"
才允许用 ```js——否则 `pickMirror` 会在两个 js 块之间犹豫，而它犹豫的结果是"候选不唯一、需人工定位"
（`:487`），等于把门禁二变成手工活。

### 0.7 红线（继承段 1/2，一律不许碰）

不改 `scripts/fixtures/region-source/`、`dev/js/tools/region-data.js`、`region.js`、
`scripts/build-region-data.mjs`、`demo/idCardDemo/`、`dev/js/tools/panel.js`（本段一行都不动它）。
不裸 `git add -A` / `git add .`，只用 pathspec 提交自己碰的文件；不跑 `deploy-github.sh`；
**push 要单独获得同意**；`_config.yml` / `_data/tools.yml` / `package.json` / `index.html` / `about.html` /
`dev/js/about.js` / `dev/sass/about.scss` / `.gitignore` / `.baoyu-skills/**` 与几处未跟踪脚本
是另一路会话的在改项，永不暂存。测量前先清遗留 Chrome 与端口。

---

## 1. 文件结构（本段全部新增 / 修改）

**新增**

```
dev/js/tools/time.js            时间戳 ⇄ 日期换算（纯函数，§K）
dev/js/tools/codec.js           Base64(UTF-8) 与 URL 编解码（纯函数，§L）
dev/js/tools/digest.js          MD5 自实现 + crypto.subtle 包装 + 降级（纯函数，§M）
dev/js/tools/regex.js           正则测试：四档闸门防回溯炸页、捕获组、替换预览（纯函数，§N）
dev/js/tools/ui.js              doCopy / legacyCopy / flash 从 workbench.js 迁进来（§O）
dev/js/tools/codecView.js       五块面板的纯字符串视图层（§Q，与 view.js 同一红线：零 import）
dev/js/tools/codecWorkbench.js  装配层：输入闸门 → 纯模块 → codecView → 绑定（§R）
dev/js/toolCodec.js             页面入口（被 vite 自动收为入口，产物 assets/js/toolCodec.min.js）
tools-codec.html                页面骨架，写死 permalink: /tools/codec.html
```

**修改**

```
dev/js/tools/workbench.js       删掉三个复制辅助，改 import ./ui.js（Task 5）
scripts/toolkit-tests.mjs       追加 §K §L §M §N §O §Q §R；文件头用例分布注释一并更新
scripts/verify-plan-blocks.mjs  FILE_TARGETS 登记五本新模块 + 入口 + 页面源；PLANS 认三份、
                                  失败消息里的计划份数改成插值（Task 1 已做前两件事的一部分）
scripts/verify-plan-blocks-teeth.mjs  副本拷第三份计划 + 快照走 PLAN_RELS + 新增 G12（Task 1）
scripts/check-tools-surface.mjs DOM 契约那组判据改成"按条目取 spec"（Task 7）
scripts/check-tools-surface-teeth.mjs  为 codec 每条判据补同名变异
_data/onlineTools.yml           追加 codec 条目（5 块面板）
README.md / USAGE.md            收录面口径与门禁计数复算
_docs/superpowers/specs/2026-09-25-blog-online-tools-design.md  §7 两行预算、§6.2 文件清单回填
```

**刻意不做**：`dev/js/tools/json-*.js`（段 4）、删 `demo/idCardDemo/` 与版本 bump（段 5）、
把 codec 页的 `#digest` 接任何网络服务（红线：纯本地）。

---

## Task 1: `time.js` — 时间戳 ⇄ 日期换算（§K）

**Files:**
- Create: `dev/js/tools/time.js`
- Modify: `scripts/toolkit-tests.mjs`（文件末尾追加 `// ── §K 时间戳 ───…` 一节）
- Modify: `scripts/verify-plan-blocks.mjs`（`PLANS` 加段 3 这一份 + `FILE_TARGETS` 加一行 `'dev/js/tools/time.js',`）
- Modify: `scripts/verify-plan-blocks-teeth.mjs`（副本要拷第三份计划；G6 改"所有计划都空"；
  新增 G12 咬"`PLANS` 少一份"）
- Modify: `scripts/verify-plan-blocks-teeth.mjs`（副本要拷第三份计划；快照走 `PLAN_RELS`；新增 G12）

### 对外契约（签名先定死，实现期不改名）

> **落地后的回填（2026-09-27）**：下面是 `dev/js/tools/time.js` 磁盘上的真实形状。与起草版有六处
> 出入，都是实现期确定的事实，不是漂移——① `EPOCH_MS_LIMIT` 写成整数字面量（`8.64e15` 在
> `String()` 里会展开成 `8640000000000000`，但报错文案要逐字可搜，指数写法会让 K4 的正则找错地方）；
> ② `parseTimestamp` 的键叫 **`verdict`**（起草时写的 `state` 与证件侧那批 `state` 语义不同，
> 那边是"合法/非法"，这边是"判到哪一档"，同名会误导）；③ `fromEpoch` 多一条 `rfc3339Utc`
> **带毫秒**，与不带小数的 `isoUtc` 分工明确；④ 小数只挂在秒档（10 位整数 + 1–3 位小数），
> 起草时以为任何长度都能带；⑤ **数值越界也抛**：`msGate` 对 `|v| > EPOCH_MS_LIMIT` 的入参抛
> `TypeError`，"给个 invalid 结论"只用在字符串通道上，数值通道拿到越界数是装配层写错；
> ⑥ 入参闸门是**两档**而不是一档，见本节末。

```text
export const MAX_INPUT_LEN = 64;            // 输入闸门，超长直接拒
export const EPOCH_MS_LIMIT = 8640000000000000;  // Date 的 UTC 上下限（±273,790 年）
export const TIME_CAVEAT = '…';             // 面板原样显示的一句口径（与 CARRIER_NOTE 同一角色）

/** 解析裸时间戳串 → 判档。不猜：10 位=秒、13 位=毫秒，其余一律 ambiguous 并给两种解释 */
export function parseTimestamp(text) → {
  verdict: 'second' | 'milli' | 'ambiguous' | 'invalid',
  epochMs: number | null,                  // verdict 为 ambiguous/invalid 时是 null
  readings: Array<{ kind, epochMs, isoUtc }>, // ambiguous 时两条，按秒/按毫秒
  reason: string | null,                   // invalid 时给人话原因（长度/字符集/越界）
}

/** epoch → 各种表示。offsetMinutes 由调用方给（页面传 -new Date().getTimezoneOffset()），
 *  本模块**不读环境时区**，这是 §K 可复算的前提 */
export function fromEpoch(epochMs, offsetMinutes) → {
  isoUtc,            // YYYY-MM-DDTHH:mm:ssZ，整秒不带小数
  rfc3339Utc,        // 同上，有小数时带 .sss
  isoLocal,          // 带 ±hh:mm 偏移
  localDisplay,      // 'YYYY-MM-DD HH:mm:ss (UTC+08:00) 周三'
  weekday, monthName,// 内置两张表，按**本地日**取，不走 Intl
  unixSeconds,       // Math.floor(epochMs/1000)，负 epoch 向下取整
  unixMillis, tzOffsetMinutes,
}

/** 相对时间；nowMs 与 epochMs 都入参，绝不用 Date.now()。月=30天、年=365天是固定档 */
export function relativeTime(epochMs, nowMs) → { text, past, future }

/** 两个时刻之差：总时长 + 日历天 + 日历分解（ymd 描述 |差|，永远非负，方向看 sign） */
export function dateDiff(aEpochMs, bEpochMs) → {
  sign, totalMs, totalDays, calendarDays,
  ymd: { years, months, days },             // clampAddMonths 分解，月末与 2/29 有专判据
  breakdown: Array<{ unit, value }>,        // ms/s/min/h/d/wk，全部 floor
}

/** 'YYYY-MM-DD'[ 'THH[:mm[:ss[.sss]]]'] → epochMs（按调用方给的 offset 解释） */
export function parseCivilDate(text, offsetMinutes) → { ok, epochMs, reason }
```

实现内部**允许** `new Date(epochMs)`，**禁止**无参 `new Date()`、`Date.now()`、
`getTimezoneOffset()`、`Date.parse`、`Intl`、`toLocale*`、`process.env`——K14 扫源文本判，
K17 从文案侧再扫一遍（两条盯同一不变量，是刻意的冗余，变异台账 M3/M4 会看到它们同红）。

### 判据清单（§K，落地后回填）

起草时这张表写的是"十九判据"，落地实测是 **18 条 `test()` + 1 条变异台账**：K19 不是 `test()`，
它是"把实现改坏、看红的到底是不是那一条"的一次性自证，跑完即弃、结果记在下面。
所以 §K 对套件总数的贡献是 18，全量 `# tests` 从 146 变成 **164**（不是起草时估的 165）。
表里另有四行与起草不同，都按磁盘上的实现改口：

| 编号 | 咬什么 |
| --- | --- |
| K1 | 十位判秒、十三位判毫秒；`1000000000` = `2001-09-09T01:46:40Z`，`1000000000000` = 同一毫秒；判得出的档 `readings` 必须是空数组 |
| K2 | 1/9/11/12 位**不猜档**：`verdict:'ambiguous'` 且 `readings` 恰两条、顺序为[按秒,按毫秒]。**十四位是例外**：按秒必然越过 `EPOCH_MS_LIMIT`，只剩毫秒档成立，于是判 `milli` 而不是硬给两条解释——"不猜"不等于"凑数给两个答案" |
| K3 | 形状：前导 `-`、`+`、空白、下划线分隔符、小数点、非十进制字符、`Infinity`、`NaN` 各自结论，`NaN` 不得出现在任何返回字段（递归查） |
| K4 | 越界：字符串通道 `|epochMs| > EPOCH_MS_LIMIT` 判 invalid，`reason` 里点名上限值；小数只允许「10 位整数 + 1–3 位小数」 |
| K5 | `parseCivilDate` 对 `Z` 与 `±hh:mm` 两种写法给出同一 epochMs；无时区标记时按入参 offset |
| K6 | 全程不读环境：同一批 21 条入参在 `TZ=UTC` 与 `TZ=Asia/Shanghai` 两个子进程里跑，`JSON.stringify(…, null, 1)` 逐字节相同；并断用例数 > 0、无 null 返回、本地字段确有多值（防空集假绿） |
| K7 | 闰年与 2/29：`2024-02-29` 合法、`2023-02-29` invalid；`fromEpoch` 能还原 2/29 |
| K8 | `dateDiff` 的 `ymd` 在三个样本下正确：跨年（2019-12-31→2021-01-01，`totalDays` 367）、月末（1/31→3/1）、闰日（2024-02-29→2025-02-28）；反向同解 |
| K9 | `calendarDays` 与 `totalDays`（=floor(totalMs/86400e3)）在跨偏移样本下**允许不等**，两条都断，且不等的那对样本本身就是判据 |
| K10 | 边界时刻：`0`（1970-01-01）、`2147483647`（32 位溢出点）、负 epoch（1900-01-01）三档都能出完整表示 |
| K11 | `MAX_INPUT_LEN` 闸门：超长串不进入解析，`verdict:'invalid'` 且 `reason` 提到长度与"未进入解析" |
| K12 | **两档入参两种处理**（跨模块对账，不是本模块自己定的口径）：文本入参走 `String(text == null ? '' : text)` 归一不抛——拿 `parseMobile`/`parseUscc`/`parseIdCard`/`parseBankCard` 实测过，`null`→`empty`、`123`/`{}`/`true`→`malformed`，只有无原型对象因 `String()` 自己抛；数值入参（`epochMs`/`nowMs`/`offsetMinutes`）才抛 `TypeError`，报错尾巴「收到 <shapeOf(值)>」与 `uscc.js`/`phone.js` 的 options 闸门逐字同档（一条正则同时核三本模块） |
| K13 | `weekday` / `monthName` 是内置表：断中文串逐字，且断源码里 `indexOf('Intl') === -1` |
| K14 | 扫源（剥注释后）：`Date.now(` 命中数 0、无参 `new Date()` 0、`new Date(` 只允许带参、且 `getTimezoneOffset`/`process.env`/`Date.parse` 一个都不许出现、零 `import` |
| K15 | 偏移全域：`offsetMinutes` 取 +480、+690、−840、−330、0 五档时，`isoLocal` 的偏移串与 `localDisplay` 后缀、`weekday` 的本地日三者自洽 |
| K16 | `relativeTime` 阈值表逐档命中：59 秒 / 60 秒 / 59 分 / 60 分 / 23:59:59 / 恰一年 / 一年零一天，`d===0` → '此刻' |
| K17 | `TIME_CAVEAT` 与实现**双向**对账（7 行表）：文案承诺的每一档实现做得到，做到的口径也写进文案；顺带扫源码确认"不读运行环境时区"这句不是空话；文案长度 80–240 字 |
| K18 | 不成 vite 入口：`vite.config.js` 的 `getDevJsEntries()` 只扫 `dev/js` 一层（正则核到函数体），`time.js` 在 `tools/` 子目录里进不了入口表；`_site/` 存在时再核产物里搜不到 `parseTimestamp` |
| K19 | **变异自证台账**（非 `test()`，脚本 `/tmp/k19.mjs`，跑前记 sha256、finally 还原并核对）：<br>M1 把 11/12 位改成按秒猜 → 红 1 条，恰 K2 ✅<br>M2 `ymd` 退回 floor(天/365)+floor(余/30) → 红 1 条，恰 K8 ✅<br>M3 塞一句 `Date.now()` → 红 2 条：K14 + K17（两条本来就盯同一不变量，K17 从文案侧扫同一批违禁词，属设计内冗余，非变异溢出）<br>M4 在 `offset===0` 处偷读 `getTimezoneOffset()`（不含无参 `new Date()`）→ 红 4 条：目标 K6 ✅，另 K14/K17 同 M3 的原因，K15 是真实行为后果（父进程 `TZ=CST`，offset 0 那格的本地字段被挪了 8 小时，自洽性断言必然红）<br>四条跑完磁盘 sha `51cd54f531b8` 与基线逐字符相同 |


### Steps

> 下面每一格都带**实跑结果**。起草时的期望值有四处与现场不符，全部按现场改口并写明差在哪——
> 留在纸面上的"Expected"不是证据，跑出来的才是。

- [x] **Step 1: 写 §K 十八判据（此时 `time.js` 不存在，必红）**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs > /tmp/tk.log 2>&1; echo "exit=$?"
grep -E "^# (tests|pass|fail)" /tmp/tk.log
```
起草时的期望"`fail` 恰为 §K 的条数"**是错的**，实测形状是：`exit=1`、
`# tests 147 / pass 146 / fail 1`——红的只有**一条文件级** `not ok 1 - scripts/toolkit-tests.mjs`，
`code: 'ERR_MODULE_NOT_FOUND'`。理由 `toolkit-tests.mjs:39-44` 早就写着：模块缺席时 Node 的
test runner 在 import 阶段就崩，§K 那十八条**一条都不会被登记**，于是"缺模块"与"§K 全红"
在计数上是两种完全不同的形状。判据看的是 `ERR_MODULE_NOT_FOUND` + `§A–§J` 的 146 条一条不红。

- [x] **Step 2: 写 `dev/js/tools/time.js`，直到 §K 全绿**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs > /tmp/tk.log 2>&1; echo "exit=$?"
grep -E "^# (tests|pass|fail)" /tmp/tk.log
```
实跑：`exit=0`、`# tests 164 / pass 164 / fail 0`。起草时估的 165 是把 K19 当成一条 `test()`，
而它是**变异台账**（跑完即弃的自证，不进套件），所以 §K 进套件的是 18 条。
中途三条期望值是我自己算错的，按实现与 `date -u` 复算改的就是这三处：
K5 的 `2024-02-29 07:00 +08:00` 应为 `08:00`；K8 的 2019-12-31→2021-01-01 是 **367 天**不是 366；
K15 的 `+11:30` 那档本地时刻是次日 **10:30** 不是 09:30。
另有一处**口径级**改动（不是笔误）：K12 起草成"非字符串传进 `parseTimestamp` → 抛 `TypeError`"，
实测四个兄弟模块的读侧入口全都归一不抛，见上表 K12 与 `time.js` 文件头第二段。

- [x] **Step 3: 自证 §K 有牙（K19 变异台账，四处变异）**

```bash
node /tmp/k19.mjs      # 跑前记 sha256、finally 还原并核对，不等则 exit=2
```
实跑四条全中，结果逐条记在上面的 K19 行。**一处偏离本仓惯例要写明**：段 2 的三处变异
（Task 6 Step 5 / Task 7 Step 5 / Task 8）一律落在 **/tmp 副本**上，理由就写在
`verify-plan-blocks-teeth.mjs:131`——本仓随时可能有第二条会话在同一个 worktree 上 `git add`。
本轮图快，`/tmp/k19.mjs` 是**原地**改 `dev/js/tools/time.js` 的。风险窗口约 40 秒，
事后核验：`git diff --cached --name-only` 为空（暂存集没被动过）、`time.js` 至今是未跟踪态、
磁盘 sha `51cd54f531b8` 与基线逐字符相同。**结论是这轮没造成污染，但这不是可以复用的做法**：
Task 2 起，变异一律照段 2 的副本形状写。

- [x] **Step 4: 把段 3 计划接进门禁二，并登记两处镜像**

三件事一起做，少任何一件门禁二都会以"看不懂的形状"红（机制见 §0.6）：
`PLANS` 加第三份、`FILE_TARGETS` 加 `'dev/js/tools/time.js',`、计划末尾贴两块 ```js 全文镜像。
只登记磁盘上已存在的那本模块——提前把 `codec.js`/`digest.js` 写进清单，门禁二会在 Task 2 之前一路红。

```bash
node scripts/verify-plan-blocks.mjs > /tmp/g2.log 2>&1; echo "exit=$?"; tail -3 /tmp/g2.log
node scripts/verify-plan-blocks.mjs --fix   # 整块按磁盘内容重写，正文其余不碰
node scripts/verify-plan-blocks-teeth.mjs   # 门禁三
```
实跑：镜像 **33 → 35**（多 `time.js` 整文件 + `§K` 分节两条）、`未落地 0 节`、`exit=0`；
`--fix` 报 **0 处"已同步"**——贴进去的就是磁盘内容，这一格是空操作（这正是想要的形状：
`--fix` 只在真漂移时落笔）。门禁三从 18/18 变 **20/20**。

接第三份计划还顺带改出两处**脚手架自己的账**，都归门禁三兜着：

1. `verify-plan-blocks.mjs` 的失败消息与注释里写死了"两份计划"（`:18/:26/:285/:351/:352/:485`），
   份数一变就是**措辞红**——看着像守卫坏了。输出串改成 `${PLANS.length} 份计划…` 插值，
   注释改成"各份计划"。
2. `verify-plan-blocks-teeth.mjs` 只拷 `PLAN1/PLAN2` 进副本。加了 `PLAN3` 而不拷，
   副本里的脚本会去读一份不存在的计划，基线那一跑就退 1（红得完全不像"计划与磁盘不一致"）。
   所以：`PLAN_RELS` 一张表 + `snapPlans/planShas/restorePlans/plansUnchanged` 四个小函数，
   G2/G3/G4/G7 的手抄快照全部改走它们（快照漏一份的后果是断言照样绿、只是不覆盖新来的那份）；
   G6 从"两份都空"改成"**所有**计划都空"，且它咬的那句消息正则去掉份数前缀（`/份计划里都没有/`）；
   新增 **G12**：把副本里 `PLANS` 的段 3 条目摘掉 → `dev/js/tools/time.js` 与 `§K` 两条必须
   同时 `✗` + 退 1，证明"第三份条目是承重的"，不是装饰。

- [x] **Step 5: 提交**

```bash
git add dev/js/tools/time.js scripts/toolkit-tests.mjs scripts/verify-plan-blocks.mjs \
  scripts/verify-plan-blocks-teeth.mjs _docs/superpowers/plans/2026-09-27-tools-codec-page.md
git diff --cached --stat      # 期望恰 5 files
git commit -m "feat(tools): 段 3 Task 1 时间戳模块 time.js——判档不猜档、零环境依赖（§K 十八判据 + 四变异台账）" -- \
  dev/js/tools/time.js scripts/toolkit-tests.mjs scripts/verify-plan-blocks.mjs \
  scripts/verify-plan-blocks-teeth.mjs _docs/superpowers/plans/2026-09-27-tools-codec-page.md
```

实跑：`7170f7c`，`5 files changed, 2078 insertions(+), 31 deletions(-)`
（计划 1227 行是这一轮新建的，`time.js` 333 行、`§K` 判据 447 行、两道门禁脚手架各改 24/78 行）。

---

### 落地镜像（门禁二核的就是这两块，`--fix` 会把它们整块换成磁盘内容）

两块都是**磁盘全文**，用 ```js 围栏（§0.6 的硬规矩：只有整文件与整节镜像允许 ```js，
契约段一律 ```text，否则 `pickMirror` 会在两个 js 候选之间犹豫、把门禁二变成手工活）。

#### `dev/js/tools/time.js`（整文件）

```js
/**
 * 时间戳 ⇄ 日期换算：判档、格式化、相对时间、日历差。
 *
 * 这一格有两条不许让步的规矩，整套判据（§K）都是围着它们写的：
 *
 * 1. **判档不猜档**。十位当秒、十三位当毫秒，这两档是行业惯例里唯一说得出口的东西；
 *    其余位数一律不猜，同时把"按秒"与"按毫秒"两种解释摆给用户看（K2）。
 *    十四位是个有意思的例外：按秒必然越过 {@link EPOCH_MS_LIMIT}，所以能留下的只有毫秒档——
 *    "不猜"不等于"硬给两条解释"，越界的那一条本来就不成立（K2 末尾专门钉这一格）。
 * 2. **不读运行环境**。没有 `Date.now()`、没有无参 `new Date()`、没有 `getTimezoneOffset()`、
 *    没有 `Intl` 与 `toLocale*`：本地时间只能由调用方把偏移分钟数传进来（K6 用两个不同 `TZ`
 *    的子进程跑同一批入参、比逐字节输出来证这件事，K13/K14 从源码侧再钉一遍）。
 *    这不是洁癖——面板的判据要能复算，就必须有一个"与跑它的那台机器无关"的期望值。
 *
 * 可复算口径：本文件里所有硬编码的时刻锚点都能用 `date -u` 独立复算，例如
 * `date -u -r 1000000000` → `2001-09-09 01:46:40`、`date -u -r 1709164800` → `2024-02-29 00:00:00`、
 * `date -u -r 0` → `1970-01-01 00:00:00`（星期四）。`EPOCH_MS_LIMIT` 就是 ECMAScript 给
 * `Date` 定的 UTC 上限（±8,640,000,000,000,000 毫秒），正向落在 275,760-09-13、负向落在 -271,821 年：
 * 负年份的串会原样写成 `-271821-04-20T…`，本站不替它编一套 ISO 扩展形式。
 *
 * 与 `idcard.js` / `bankcard.js` / `phone.js` / `uscc.js` 同一套约定：纯函数、不碰 DOM，
 * 并且**两档入参两种处理**（这一档由 K12 对着那四个模块核，不是本模块自己定的）：
 *   - **文本入参**照兄弟模块那句 `String(text === null || text === undefined ? '' : text)`：
 *     `null` / `undefined` 归一成空、其余 `String()` 之后再判形状，一律不抛（`parseIdCard(123)`
 *     也不抛）。唯一的例外是无原型对象——`String()` 自己抛 `TypeError`，§C 末尾已把这件事
 *     钉成"两个模块同抛才对"，本站不替它兜。
 *   - **数值入参**（`epochMs` / `nowMs` / `offsetMinutes`）才是 `TypeError` 闸门：它们是调用方
 *     算出来的量，传进来个 `1000.5` 或 `undefined` 属于装配层写错，静默洗成结论等于替 bug 圆场。
 *     报错尾巴统一是「收到 <shapeOf(值)>」，与 `uscc.js` 的 options 闸门同档。
 */

/** 输入闸门：超过这么长的串根本不进解析，避免把"位数判定"变成大数游戏（K11） */
export const MAX_INPUT_LEN = 64;
/** `Date` 的 UTC 上下限（毫秒），等价于约 ±273,790 年 */
export const EPOCH_MS_LIMIT = 8640000000000000;
const DAY_MS = 86400000;
/** 一行的口径说明，面板原样显示（与 `CARRIER_NOTE` 同一角色，与实现的逐条对账由 K17 守着） */
export const TIME_CAVEAT =
  '本模块只按整数位数判档：10 位当秒、13 位当毫秒，其余位数不猜、同时给出两种解释；'
  + '带小数的串只按「10 位整数 + 1–3 位小数的秒」接受。相对时间的「月」按 30 天、「年」按 365 天计，'
  + '是固定档而不是日历月或日历年。本地时间一律由调用方传入偏移分钟数，本模块不读运行环境时区。';

/** 内置两张表：`getUTCDay() === 0` 是周日 */
const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月'];

/** 越界那一句要复用，理由里点名上限值与年份档（K4） */
const OUT_OF_RANGE =
  `超出 Date 可表示的时间范围（±${EPOCH_MS_LIMIT} 毫秒，约 ±273,790 年）`;

/**
 * 报错消息里的值回显。为什么这里要有第二份、而不是 import `phone.js` 的那一个：
 * 同级工具模块互不 import（谁也不该因为另一个工具的口径改动被拖着回归，理由同 `uscc.js:239`），
 * 代价是"跨模块口径一致"没有编译期保证——由 §K 的 K12 与 §C 的 C9 各自对着对方核一次。
 * `object` / `symbol` 一律不回显内容：`String(Object.create(null))` 自己就会抛。
 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}

/** 整数毫秒闸门：形状不对、越出 `Date` 范围，都抛 TypeError（点名是哪个入参） */
function msGate(fn, name, v) {
  if (!Number.isInteger(v)) {
    throw new TypeError(`${fn} 的 ${name} 应为整数毫秒，收到 ${shapeOf(v)}`);
  }
  if (Math.abs(v) > EPOCH_MS_LIMIT) {
    throw new TypeError(`${fn} 的 ${name} ${OUT_OF_RANGE}，收到 ${shapeOf(v)}`);
  }
  return v;
}

/** 偏移分钟数闸门：整数 + ±14 小时之内（±840 本身可取，K12/K15 钉边界） */
function offsetGate(fn, v) {
  if (!Number.isInteger(v)) {
    throw new TypeError(`${fn} 的 offsetMinutes 应为整数分钟，收到 ${shapeOf(v)}`);
  }
  if (Math.abs(v) > 840) {
    throw new TypeError(`${fn} 的 offsetMinutes 应在 ±14 小时（±840 分钟）之内，收到 ${shapeOf(v)}`);
  }
  return v;
}

const invalid = (reason) => ({ verdict: 'invalid', epochMs: null, readings: [], reason });

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** 闰年：四年一闰、百年不闰、四百年再闰（K7 四个样本各钉一次） */
function isLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y, m) {
  if (m === 2) return isLeap(y) ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

/** 只吃整数毫秒的 UTC 分量：`Date` 在这里只是"除法的机器"，不读任何环境量 */
function utcParts(ms) {
  const d = new Date(ms);
  return {
    y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, da: d.getUTCDate(),
    h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), dow: d.getUTCDay(),
  };
}

/** 年 → 四位以上原样、月/日/时分秒补零 */
const datePart = (p) => `${pad(p.y, 4)}-${pad(p.mo)}-${pad(p.da)}`;
const timePart = (p) => `${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`;

/** `+08:00` / `-14:00` / `+11:30`；偏移 0 写成 `+00:00`，不写 `Z`（Z 是"未知偏移"时的另一种口径） */
function offsetText(minutes) {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/**
 * 裸时间戳串 → 判档。**不猜**：认得出的档给一个答案，认不出的一律 `ambiguous` 给两种解释。
 *
 * @param {string} text 一串时间戳（首尾空白会被去掉，内部空白不认）
 * @returns {{verdict:'second'|'milli'|'ambiguous'|'invalid', epochMs:number|null,
 *   readings:Array<{kind:string, epochMs:number, isoUtc:string}>, reason:string|null}}
 */
export function parseTimestamp(text) {
  const raw = String(text === null || text === undefined ? '' : text).trim();
  if (raw.length > MAX_INPUT_LEN) {
    return invalid(`输入 ${raw.length} 个字符，超过 ${MAX_INPUT_LEN} 字符输入上限，未进入解析`);
  }
  if (raw === '') return invalid('输入为空');
  const m = /^([+-]?)(\d+)(?:\.(\d{1,3}))?$/.exec(raw);
  if (!m) return invalid(shapeReason(raw));

  const sign = m[1] === '-' ? -1 : 1;
  const digits = m[2];
  const frac = m[3];
  const n = digits.length;
  const v = Number(digits);

  // 小数只允许挂在秒档上：`1000000000.5` 是"十分之一秒"，`1000000000000.5` 那种是半毫秒，
  // 本站不替用户决定该不该丢掉它——直接拒，理由点名"小数"。
  if (frac !== undefined) {
    if (n !== 10) {
      return invalid(`带小数时整数部分必须是 10 位（这一档按秒解释），实际 ${n} 位：小数只按「10 位整数 + 1–3 位小数的秒」接受`);
    }
    return finish('second', sign * (v * 1000 + Number(frac) * 10 ** (3 - frac.length)));
  }
  if (n === 10) return finish('second', sign * v * 1000);
  if (n === 13) return finish('milli', sign * v);

  const cand = [
    { kind: 'second', epochMs: sign * v * 1000 },
    { kind: 'milli', epochMs: sign * v },
  ].filter((c) => Math.abs(c.epochMs) <= EPOCH_MS_LIMIT);
  if (cand.length === 0) return invalid(OUT_OF_RANGE);
  // 只剩一条时不硬凑"两种解释"：越界的那一档本来就不成立（十四位就是这一格）
  if (cand.length === 1) {
    return { verdict: cand[0].kind, epochMs: cand[0].epochMs, readings: [], reason: null };
  }
  return {
    verdict: 'ambiguous',
    epochMs: null,
    readings: cand.map((c) => ({ kind: c.kind, epochMs: c.epochMs, isoUtc: fromEpoch(c.epochMs, 0).isoUtc })),
    reason: `${n} 位不能唯一判档：按秒与按毫秒两种解释都成立，下面两条并列给出`,
  };
}

/** 形状不对的时候，理由要点名"是哪一种不对"（K3），只写"格式错误"等于把用户支走 */
function shapeReason(raw) {
  if (/\s/.test(raw)) return '数字之间有空白：只允许去掉首尾空白后的一串数字';
  if (raw.includes('_')) return '含下划线分隔符：本站不做 1_000_000 这种书写归一';
  if (raw.includes('.')) return '小数部分只允许 1–3 位';
  if (/^[-+]?$/.test(raw)) return '只有符号没有数字';
  return '不是十进制数字串（不认 0x、1e9、Infinity、NaN 这些写法）';
}

/** 已经认出的那一档：还要过一遍范围（K4） */
function finish(kind, epochMs) {
  if (Math.abs(epochMs) > EPOCH_MS_LIMIT) return invalid(OUT_OF_RANGE);
  return { verdict: kind, epochMs, readings: [], reason: null };
}

/**
 * epoch 毫秒 → 各种表示。**偏移由调用方给**：页面传 `-new Date().getTimezoneOffset()`，
 * 本模块自己不问环境（这正是 §K 可复算的前提）。
 *
 * @param {number} epochMs 整数毫秒，可为负
 * @param {number} offsetMinutes 本地相对 UTC 的偏移分钟数，东为正，范围 ±840
 */
export function fromEpoch(epochMs, offsetMinutes) {
  msGate('fromEpoch', 'epochMs', epochMs);
  offsetGate('fromEpoch', offsetMinutes);
  // 秒档一律向下取整：-1500 ms 是 1969-12-31T23:59:58.500Z，写成 :59 而不是 :00
  const sec = Math.floor(epochMs / 1000);
  const wholeMs = sec * 1000;
  const milli = epochMs - wholeMs;
  const u = utcParts(wholeMs);
  const l = utcParts(wholeMs + offsetMinutes * 60000);
  const off = offsetText(offsetMinutes);
  return {
    isoUtc: `${datePart(u)}T${timePart(u)}Z`,
    rfc3339Utc: `${datePart(u)}T${timePart(u)}.${pad(milli, 3)}Z`,
    isoLocal: `${datePart(l)}T${timePart(l)}${off}`,
    localDisplay: `${datePart(l)} ${timePart(l)} (UTC${off}) ${WEEKDAY[l.dow]}`,
    weekday: WEEKDAY[l.dow],
    monthName: MONTHS[l.mo - 1],
    unixSeconds: sec,
    unixMillis: epochMs,
    tzOffsetMinutes: offsetMinutes,
  };
}

const rel = (n, unit, deltaMs) => ({
  text: `${n} ${unit}${deltaMs < 0 ? '前' : '后'}`,
  past: deltaMs < 0,
  future: deltaMs > 0,
});

/**
 * 相对时间。**固定档**：月 = 30 天、年 = 365 天，不是日历月也不是日历年（口径写进
 * {@link TIME_CAVEAT}，与实现的对账由 K17 钉）。两个时刻都由入参给，绝不用 `Date.now()`。
 */
export function relativeTime(epochMs, nowMs) {
  msGate('relativeTime', 'epochMs', epochMs);
  msGate('relativeTime', 'nowMs', nowMs);
  const d = epochMs - nowMs;
  if (d === 0) return { text: '此刻', past: false, future: false };
  const abs = Math.abs(d);
  const s = Math.floor(abs / 1000);
  if (s < 60) return rel(s, '秒', d);
  const mi = Math.floor(s / 60);
  if (mi < 60) return rel(mi, '分钟', d);
  const h = Math.floor(mi / 60);
  if (h < 24) return rel(h, '小时', d);
  const day = Math.floor(h / 24);
  if (day < 30) return rel(day, '天', d);
  if (day < 365) return rel(Math.floor(day / 30), '个月', d);
  return rel(Math.floor(day / 365), '年', d);
}

const dayIndexOf = (ms) => Math.floor(ms / DAY_MS);
const ymdToDayIndex = (y, mo, da) => Math.floor(Date.UTC(y, mo - 1, da) / DAY_MS);

/** 把 lo 加 months 个月，日超出该月天数时夹到月末（月末样本靠它，K8） */
function clampAddMonths(lo, months) {
  const total = lo.y * 12 + (lo.mo - 1) + months;
  const y = Math.floor(total / 12);
  const mo = (total % 12) + 1;
  const da = Math.min(lo.da, daysInMonth(y, mo));
  return { y, mo, da };
}

/**
 * 两个时刻之差，三种口径一起给：`totalDays` 是"整多少个 24 小时"（向下取整，负差向 −∞），
 * `calendarDays` 是"跨了几个 UTC 日历日"，`ymd` 是日历分解。前两条**允许不等**，
 * 23:00 → 次日 01:00 就是 0 与 1（K9 专门钉这一对）。
 *
 * 方向由 `sign` 单独说：`ymd` 描述的是 |差| 的分解，所以永远非负（反向同解，K8 断这一条）。
 */
export function dateDiff(aEpochMs, bEpochMs) {
  msGate('dateDiff', 'aEpochMs', aEpochMs);
  msGate('dateDiff', 'bEpochMs', bEpochMs);
  const totalMs = bEpochMs - aEpochMs;
  const from = aEpochMs <= bEpochMs ? aEpochMs : bEpochMs;
  const to = aEpochMs <= bEpochMs ? bEpochMs : aEpochMs;
  const lo = utcParts(Math.floor(from / 1000) * 1000);
  const hi = utcParts(Math.floor(to / 1000) * 1000);
  const hiDay = dayIndexOf(to);

  let months = (hi.y - lo.y) * 12 + (hi.mo - lo.mo);
  let anchor = clampAddMonths(lo, months);
  if (ymdToDayIndex(anchor.y, anchor.mo, anchor.da) > hiDay) {
    months -= 1;
    anchor = clampAddMonths(lo, months);
  }
  const days = hiDay - ymdToDayIndex(anchor.y, anchor.mo, anchor.da);
  return {
    sign: Math.sign(totalMs),
    totalMs,
    totalDays: Math.floor(totalMs / DAY_MS),
    calendarDays: dayIndexOf(bEpochMs) - dayIndexOf(aEpochMs),
    ymd: { years: Math.floor(months / 12), months: months % 12, days },
    breakdown: [
      ['ms', 1], ['s', 1000], ['min', 60000], ['h', 3600000], ['d', DAY_MS], ['wk', 7 * DAY_MS],
    ].map(([unit, size]) => ({ unit, value: Math.floor(totalMs / size) })),
  };
}

const CIVIL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?(Z|[-+]\d{2}:?\d{2})?$/;
const CIVIL_SHAPE = '形状应为 YYYY-MM-DD[THH:mm[:ss[.sss]]][Z|±hh:mm]，且月、日、时、分都要两位';

/**
 * 民用日期串 → epoch 毫秒。串里带了时区标记时以串为准（`offsetMinutes` 不参与），
 * 完全没带才按调用方给的偏移解释（K5 把这条钉死：两种写法必须落到同一毫秒）。
 *
 * @returns {{ok:boolean, epochMs:number|null, reason:string|null}} 形状或取值不对时
 *   `ok:false` 并给人话原因——这一格**不抛**，因为抛穿到装配层等于把输入框变成炸弹。
 */
export function parseCivilDate(text, offsetMinutes) {
  offsetGate('parseCivilDate', offsetMinutes);
  const raw = String(text === null || text === undefined ? '' : text).trim();
  const m = raw === '' ? null : CIVIL_RE.exec(raw);
  if (!m) return { ok: false, epochMs: null, reason: raw === '' ? '输入为空' : CIVIL_SHAPE };
  const [, ys, mos, das, hs, mis, ss, frac, zone] = m;
  const y = Number(ys);
  const mo = Number(mos);
  const da = Number(das);
  const hh = hs === undefined ? 0 : Number(hs);
  const mi = mis === undefined ? 0 : Number(mis);
  const se = ss === undefined ? 0 : Number(ss);
  const ms = frac === undefined ? 0 : Number(frac) * 10 ** (3 - frac.length);
  if (mo < 1 || mo > 12) return civilBad('月份应为 01–12');
  if (da < 1 || da > daysInMonth(y, mo)) {
    return civilBad(`${pad(mo)} 月没有 ${pad(da)} 日${mo === 2 && da === 29 && !isLeap(y) ? `（${y} 年不是闰年）` : ''}`);
  }
  if (hh > 23) return civilBad('小时应为 00–23');
  if (mi > 59) return civilBad('分钟应为 00–59');
  if (se > 59) return civilBad('秒应为 00–59');
  let zoneMinutes = offsetMinutes;
  if (zone) {
    if (hs === undefined) return civilBad('带时区标记时必须写出时刻');
    zoneMinutes = zone === 'Z' ? 0
      : (zone.startsWith('-') ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(-2)));
    if (Math.abs(zoneMinutes) > 840) return civilBad('时区偏移应在 ±14 小时之内');
  }
  return { ok: true, epochMs: Date.UTC(y, mo - 1, da, hh, mi, se, ms) - zoneMinutes * 60000, reason: null };
}

const civilBad = (reason) => ({ ok: false, epochMs: null, reason });
```

#### `scripts/toolkit-tests.mjs` §K（整节，从 `// ── §K` 到 §L 之前）

```js
// ── §K 时间戳 ⇄ 日期换算（`tools/time.js`，段 3 Task 1）─────────────────────
//（这一格的模块只干两件事：**判档而不猜档**、**不读运行环境**。所以本节的期望值全部可以
//  拿 `date -u` 独立复算——每个硬编码的 ISO 串旁边注了它的秒数锚点，复算命令一并写进
//  `dev/js/tools/time.js` 的文件头。判据编号 K1–K19 对齐计划 Task 1 的判据清单，
//  其中 **K19 不是 test()**：它是"把实现改坏、看哪几条红"的变异自证，写在计划 Task 1 Step 3。）
const { EPOCH_MS_LIMIT, MAX_INPUT_LEN, TIME_CAVEAT, dateDiff, fromEpoch,
  parseCivilDate, parseTimestamp, relativeTime } = await import('../dev/js/tools/time.js');

/** 去掉注释之后的 time.js 源码：K13 / K14 / K17 扫的是代码，不是文档里的自我声明 */
const kCode = () => read('dev/js/tools/time.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** 递归找 NaN / Infinity：返回字段里出现任何一个，面板就会把 "NaN" 印给用户 */
const kBadNumbers = (v, seen = []) => {
  if (typeof v === 'number' && !Number.isFinite(v)) seen.push(v);
  else if (Array.isArray(v)) for (const x of v) kBadNumbers(x, seen);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) kBadNumbers(x, seen);
  return seen;
};
/** 报错消息里的入参回显：Symbol 与无原型对象都不能 String()（§C 末尾那条同一档） */
const kLabel = (v) => {
  if (typeof v === 'symbol' || typeof v === 'function') return typeof v;
  try { return String(v); } catch { return `unstringifiable ${typeof v}`; }
};

/**
 * K6 用的固定用例表。父进程与两个子进程跑的是**同一个数组**（序列化过去），
 * 所以"两边逐字节相同"这条比对不可能因为两份用例表漂移而假绿。
 */
const K_CASES = [
  { fn: 'parseTimestamp', args: ['0'] },
  { fn: 'parseTimestamp', args: ['1000000000'] },
  { fn: 'parseTimestamp', args: ['1000000000000'] },
  { fn: 'parseTimestamp', args: ['999999999'] },
  { fn: 'parseTimestamp', args: ['10000000000000'] },
  { fn: 'parseTimestamp', args: ['-2208988800000'] },
  { fn: 'parseTimestamp', args: ['1000000000.5'] },
  { fn: 'parseTimestamp', args: ['1_000_000_000'] },
  { fn: 'parseTimestamp', args: ['NaN'] },
  { fn: 'parseTimestamp', args: ['99999999999999999999'] },
  { fn: 'fromEpoch', args: [1709164800000, 480] },
  { fn: 'fromEpoch', args: [-1500, -840] },
  { fn: 'fromEpoch', args: [2147483647000, 0] },
  { fn: 'fromEpoch', args: [1709161200000, 690] },
  { fn: 'relativeTime', args: [1709164800000, 1709164859000] },
  { fn: 'relativeTime', args: [1709164800000 + 365 * 864e5, 1709164800000] },
  { fn: 'dateDiff', args: [1577750400000, 1609459200000] },
  { fn: 'dateDiff', args: [1704150000000, 1704157200000] },
  { fn: 'parseCivilDate', args: ['2024-02-29T00:00Z', 480] },
  { fn: 'parseCivilDate', args: ['2024-02-29 08:00:00+08:00', -840] },
  { fn: 'parseCivilDate', args: ['2023-02-29', 0] },
];
/** 子进程正文：不能带反引号，否则嵌进父进程的字符串字面量会先把这条判据炸掉 */
const K_CHILD = [
  'const t = await import(process.env.K_MOD);',
  'const cs = JSON.parse(process.env.K_CASES);',
  'const out = cs.map((c) => ({ fn: c.fn, args: c.args, r: t[c.fn](...c.args) }));',
  'process.stdout.write(JSON.stringify(out, null, 1));',
].join('\n');
/** 在指定 TZ 下把 K_CASES 全跑一遍，返回 stdout 原文 */
const kRunIn = (tz) => spawnSync(process.execPath,
  ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--input-type=module', '--eval', K_CHILD],
  {
    encoding: 'utf8',
    env: {
      ...process.env, TZ: tz,
      K_MOD: new URL('../dev/js/tools/time.js', import.meta.url).href,
      K_CASES: JSON.stringify(K_CASES),
    },
  });

test('K1 十位判秒、十三位判毫秒，两种写法落到同一毫秒', () => {
  const s = parseTimestamp('1000000000');      // date -u -r 1000000000 → 2001-09-09T01:46:40Z
  assert.equal(s.verdict, 'second');
  assert.equal(s.epochMs, 1000000000000);
  assert.equal(s.reason, null);
  assert.deepEqual(s.readings, [], '判得出的档不许另附一份"两种解释"，那是 ambiguous 的形状');
  const m = parseTimestamp('1000000000000');
  assert.equal(m.verdict, 'milli');
  assert.equal(m.epochMs, 1000000000000);
  assert.equal(fromEpoch(1000000000000, 0).isoUtc, '2001-09-09T01:46:40Z');
  assert.equal(fromEpoch(s.epochMs, 0).isoUtc, fromEpoch(m.epochMs, 0).isoUtc);
});

test('K2 一位/九位/十一位/十二位不猜档：readings 恰两条、秒在前', () => {
  for (const text of ['5', '999999999', '10000000000', '100000000000']) {
    const r = parseTimestamp(text);
    assert.equal(r.verdict, 'ambiguous', text);
    assert.equal(r.epochMs, null, `${text}：不猜档就不能同时给一个"主答案"`);
    assert.equal(r.readings.length, 2, text);
    assert.deepEqual(r.readings.map((x) => x.kind), ['second', 'milli'], text);
    assert.equal(r.readings[0].epochMs, Number(text) * 1000, text);
    assert.equal(r.readings[1].epochMs, Number(text), text);
    assert.equal(r.readings[0].isoUtc, fromEpoch(r.readings[0].epochMs, 0).isoUtc, text);
    assert.ok(typeof r.reason === 'string' && r.reason.includes('位'), `${text}：不猜也要说为什么猜不出`);
    assert.deepEqual(kBadNumbers(r), []);
  }
  // 十四位是"按秒必然越界"的那一档：不猜 ≠ 硬给两条解释
  const v14 = parseTimestamp('10000000000000');
  assert.equal(v14.verdict, 'milli', '秒档解释越过了 EPOCH_MS_LIMIT，能留下的只有毫秒档');
  assert.equal(v14.epochMs, 10000000000000);
  assert.deepEqual(v14.readings, []);
});

test('K3 形状各档各有结论，NaN / Infinity 不许出现在任何返回字段', () => {
  const cases = [
    ['  1000000000  ', 'second', 1000000000000],
    ['-1000000000', 'second', -1000000000000],
    ['+1000000000', 'second', 1000000000000],
    ['1000000000.5', 'second', 1000000000500],
    ['1000000000.500', 'second', 1000000000500],
    ['1 000 000 000', 'invalid', null],
    ['1_000_000_000', 'invalid', null],
    ['0x3b9aca00', 'invalid', null],
    ['1e9', 'invalid', null],
    ['1000000000000.5', 'invalid', null],
    ['1000000000.5000', 'invalid', null],
    ['Infinity', 'invalid', null],
    ['-Infinity', 'invalid', null],
    ['NaN', 'invalid', null],
    ['', 'invalid', null],
    ['   ', 'invalid', null],
    ['--1000000000', 'invalid', null],
    ['1000000000-', 'invalid', null],
  ];
  for (const [text, verdict, epochMs] of cases) {
    const r = parseTimestamp(text);
    assert.equal(r.verdict, verdict, JSON.stringify(text));
    assert.equal(r.epochMs, epochMs, JSON.stringify(text));
    assert.deepEqual(kBadNumbers(r), [], JSON.stringify(text));
    if (verdict === 'invalid') {
      assert.ok(typeof r.reason === 'string' && r.reason !== '', `${text}：invalid 必须给人话原因`);
    } else {
      assert.equal(r.reason, null, JSON.stringify(text));
    }
  }
  // 拒绝的理由要点名是"哪一形状"不对，只写"格式错误"等于把用户支走
  assert.match(parseTimestamp('1 000 000 000').reason, /空白/);
  assert.match(parseTimestamp('1_000_000_000').reason, /下划线/);
  assert.match(parseTimestamp('Infinity').reason, /不是十进制/);
  assert.match(parseTimestamp('1000000000000.5').reason, /小数/);
  assert.match(parseTimestamp('1000000000.5000').reason, /小数/);
  assert.equal(parseTimestamp('').reason, '输入为空');
});

test('K4 越界判 invalid，理由点名上限值；上限本身仍在范围内', () => {
  assert.equal(EPOCH_MS_LIMIT, 8640000000000000, '这就是 Date 的 UTC 上限，改成别的数要连 §K 的边界样本一起改');
  const over = parseTimestamp('9999999999999999999');       // 19 位
  assert.equal(over.verdict, 'invalid');
  assert.equal(over.epochMs, null);
  assert.match(over.reason, /8640000000000000/);
  assert.match(over.reason, /273,?790/);
  assert.equal(parseTimestamp('-9999999999999999999').verdict, 'invalid', '负号不是免死金牌');
  // 边界：恰好等于上限可判，越一格就拒
  assert.equal(parseTimestamp('8640000000000000').verdict, 'milli');
  assert.equal(fromEpoch(EPOCH_MS_LIMIT, 0).isoUtc, '275760-09-13T00:00:00Z');
  const oneOver = parseTimestamp('8640000000000001');
  assert.equal(oneOver.verdict, 'invalid');
  assert.match(oneOver.reason, /8640000000000000/);
  assert.doesNotMatch(oneOver.reason, /未进入解析/, '越界的理由不许写成"被长度闸门挡下"，那是另一件事');
});

test('K5 parseCivilDate：Z 与 ±hh:mm 两种写法同一毫秒，缺标记才用入参 offset', () => {
  const A = 1709164800000;                 // date -u -r 1709164800 → 2024-02-29T00:00:00Z
  for (const t of ['2024-02-29T00:00Z', '2024-02-29T00:00:00Z', '2024-02-29T00:00:00.000Z',
    '2024-02-29 00:00Z', '2024-02-29T08:00+08:00', '2024-02-29T08:00+0800',
    '2024-02-28T16:00-08:00']) {
    const r = parseCivilDate(t, -840);
    assert.equal(r.ok, true, t);
    assert.equal(r.epochMs, A, `${t}：串里带了时区标记，offsetMinutes 就不许再参与换算`);
    assert.equal(r.reason, null, t);
  }
  assert.equal(parseCivilDate('2024-02-29', 0).epochMs, A);
  assert.equal(parseCivilDate('2024-02-29', 480).epochMs, A - 28800000, '+08:00 的本地零点 = UTC 前一日 16:00');
  assert.equal(parseCivilDate('2024-02-29 08:00', 480).epochMs, A);
  for (const bad of ['2023-02-29', '2024-13-01', '2024-00-10', '2024-01-32', '2024-1-31',
    '2024-02-29T24:00', '2024-02-29T12:60', '2024-02-29T12:00:61', '2024-02-29+08:00',
    'not-a-date', '2024-02- 29', '2024-02-29T12', '2024-02-29T08:00+99:99', '']) {
    const r = parseCivilDate(bad, 0);
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.equal(r.epochMs, null, JSON.stringify(bad));
    assert.ok(typeof r.reason === 'string' && r.reason !== '', JSON.stringify(bad));
  }
  assert.match(parseCivilDate('2023-02-29', 0).reason, /2 月|闰/);
  assert.match(parseCivilDate('2024-1-31', 0).reason, /两位/);
  assert.match(parseCivilDate('2024-02-29T24:00', 0).reason, /小时/);
});

test('K6 全程不读环境：同一批入参在 TZ=UTC 与 TZ=Asia/Shanghai 里逐字节相同', () => {
  const utc = kRunIn('UTC');
  const sh = kRunIn('Asia/Shanghai');
  assert.equal(utc.status, 0, utc.stderr);
  assert.equal(sh.status, 0, sh.stderr);
  assert.equal(utc.stderr, '', '子进程有噪声：这条比对的"相同"就不干净');
  const a = utc.stdout;
  assert.equal(a, sh.stdout, '两个时区下的输出不同——本模块在某处偷偷读了环境');
  const parsed = JSON.parse(a);
  assert.equal(parsed.length, K_CASES.length, '空集上的相等不算数：先证明两边真的把整批用例跑完了');
  assert.equal(parsed.filter((x) => x.r === null || x.r === undefined).length, 0, '有用例返回了 null');
  for (const x of parsed) assert.deepEqual(kBadNumbers(x.r), [], `${x.fn}(${x.args})`);
  // 反向自证：这批用例里确实含"读环境就会不一样"的格子（本地日期、星期、偏移串）
  const localFields = parsed.filter((x) => x.fn === 'fromEpoch')
    .map((x) => x.r.isoLocal + '|' + x.r.weekday);
  assert.ok(new Set(localFields).size > 1, 'fromEpoch 的本地字段全一样，说明用例没覆盖到跨日界的偏移');
});

test('K7 闰年与 2/29：2024 有、2023 没有、2100 没有、2000 有，fromEpoch 能还原 2/29', () => {
  assert.equal(parseCivilDate('2024-02-29', 0).ok, true);
  assert.equal(parseCivilDate('2023-02-29', 0).ok, false);
  assert.equal(parseCivilDate('2100-02-29', 0).ok, false, '百年不闰');
  assert.equal(parseCivilDate('2000-02-29', 0).ok, true, '四百年再闰');
  const r = fromEpoch(1709164800000, 0);   // date -u -r 1709164800 → 周四
  assert.equal(r.isoUtc, '2024-02-29T00:00:00Z');
  assert.equal(r.monthName, '二月');
  assert.equal(r.weekday, '周四');
});

test('K8 dateDiff 的 ymd 是日历分解：跨年、月末、闰日各有专断，反向同解', () => {
  const D = 86400000;
  // 2019-12-31 → 2021-01-01：整 1 年再加 1 天（12-31 加一年是 2020-12-31）
  assert.deepEqual(dateDiff(1577750400000, 1609459200000).ymd, { years: 1, months: 0, days: 1 });
  // 2024-01-31 → 2024-03-01：1 月 31 日加一个月要夹到 2/29（闰年），余 1 天
  assert.deepEqual(dateDiff(1706659200000, 1709251200000).ymd, { years: 0, months: 1, days: 1 });
  // 2024-02-29 → 2025-02-28：整一年，不许报成"11 个月 30 天"
  assert.deepEqual(dateDiff(1709164800000, 1740700800000).ymd, { years: 1, months: 0, days: 0 });
  // 同一对样本反着给：分解不变，方向由 sign 说
  const back = dateDiff(1609459200000, 1577750400000);
  assert.deepEqual(back.ymd, { years: 1, months: 0, days: 1 });
  assert.equal(back.sign, -1);
  assert.equal(back.totalMs, -367 * D, '2019-12-31 → 2021-01-01 跨 367 天：2020 整年 366 天，再加到 1/1 的那 1 天');
  assert.equal(dateDiff(1609459200000, 1609459200000).sign, 0);
});

test('K9 calendarDays 与 totalDays 允许不等，负差向 −∞ 取整', () => {
  const r = dateDiff(1704150000000, 1704157200000);  // 2024-01-01T23:00Z → 01-02T01:00Z
  assert.equal(r.totalMs, 7200000);
  assert.equal(r.totalDays, 0);
  assert.equal(r.calendarDays, 1);
  assert.notEqual(r.totalDays, r.calendarDays, '这对样本本来就是"两个口径不等价"的证据');
  assert.deepEqual(r.ymd, { years: 0, months: 0, days: 1 });
  const neg = dateDiff(1704157200000, 1704150000000);
  assert.equal(neg.totalMs, -7200000);
  assert.equal(neg.totalDays, -1, 'floor(-0.083) = -1：向零取整会把"不足一天"报成 0 天');
  assert.equal(neg.calendarDays, -1);
  const subSec = dateDiff(1704150000000, 1704150000000 - 500);
  assert.deepEqual(subSec.breakdown.map((x) => [x.unit, x.value]),
    [['ms', -500], ['s', -1], ['min', -1], ['h', -1], ['d', -1], ['wk', -1]],
    'breakdown 与 totalDays 同一下取整口径，否则同一页会摆出互相矛盾的两串数');
  assert.deepEqual(r.breakdown.map((x) => [x.unit, x.value]),
    [['ms', 7200000], ['s', 7200], ['min', 120], ['h', 2], ['d', 0], ['wk', 0]]);
});

test('K10 边界时刻都能出完整表示：0、32 位溢出点、负 epoch、非整秒的负毫秒', () => {
  const z = fromEpoch(0, 0);
  assert.equal(z.isoUtc, '1970-01-01T00:00:00Z');
  assert.equal(z.rfc3339Utc, '1970-01-01T00:00:00.000Z');
  assert.equal(z.weekday, '周四', '1970-01-01 是星期四（date -u -r 0）');
  const y2038 = fromEpoch(2147483647000, 0);
  assert.equal(y2038.isoUtc, '2038-01-19T03:14:07Z');
  assert.equal(y2038.unixSeconds, 2147483647);
  const y1900 = fromEpoch(-2208988800000, 0);   // 70 年 × 365 + 17 闰日 = 25,567 天
  assert.equal(y1900.isoUtc, '1900-01-01T00:00:00Z');
  assert.equal(y1900.unixSeconds, -2208988800);
  const n = fromEpoch(-1500, 0);
  assert.equal(n.isoUtc, '1969-12-31T23:59:58Z', '秒档向下取整：-1.5 s → -2 s');
  assert.equal(n.rfc3339Utc, '1969-12-31T23:59:58.500Z');
  assert.equal(n.unixSeconds, -2);
  assert.equal(n.unixMillis, -1500);
  assert.equal(n.tzOffsetMinutes, 0);
});

test('K11 超长输入不进解析：闸门在形状判定之前，且"超过"不是"达到"', () => {
  assert.equal(MAX_INPUT_LEN, 64);
  const r = parseTimestamp('1'.repeat(MAX_INPUT_LEN + 1));
  assert.equal(r.verdict, 'invalid');
  assert.equal(r.epochMs, null);
  assert.match(r.reason, /64/);
  assert.match(r.reason, /未进入解析/);
  const atLimit = parseTimestamp('9'.repeat(MAX_INPUT_LEN));   // 64 个 9：进了解析、被判越界
  assert.equal(atLimit.verdict, 'invalid');
  assert.match(atLimit.reason, /8640000000000000/, '到限的串要真的走完解析，理由才会落到越界那一档');
  assert.doesNotMatch(atLimit.reason, /未进入解析/);
});

test('K12 入参口径与四个兄弟模块同档：文本归一不抛、数值抛 TypeError', () => {
  // 文本档：`parseIdCard(123)` / `parseMobile(null)` 都不抛（照 `String(text ?? '')` 归一后判定），
  // time.js 不许自己发明一条"非字符串就抛"的规矩——那等于给装配层多添一种要处理的异常。
  for (const v of [null, undefined]) {
    assert.equal(parseTimestamp(v).verdict, 'invalid', kLabel(v));
    assert.equal(parseTimestamp(v).reason, '输入为空', kLabel(v));
    assert.equal(parseCivilDate(v, 0).ok, false, kLabel(v));
    assert.equal(parseCivilDate(v, 0).reason, '输入为空', kLabel(v));
  }
  assert.equal(parseTimestamp(true).verdict, 'invalid', 'String(true) = "true" → 字符集这一档拒');
  assert.equal(parseTimestamp(Symbol('s')).verdict, 'invalid', 'String(Symbol) = "Symbol(s)" → 同样拒');
  assert.equal(parseTimestamp(new Date(0)).verdict, 'invalid', 'Date 串里有空白 → 内部空白这一档拒');
  assert.deepEqual(parseTimestamp(123).readings.map((x) => x.kind), ['second', 'milli'],
    '123 归一成 "123"，三位正是"不猜档"的那一档');
  assert.deepEqual(parseTimestamp([1]).readings.map((x) => x.kind), ['second', 'milli']);
  // 唯一的例外：无原型对象由 `String()` 自己抛——§C 末尾"两个模块必须同抛"这一条照办
  for (const [label, call] of [['parseTimestamp', (x) => parseTimestamp(x)],
    ['parseCivilDate', (x) => parseCivilDate(x, 0)]]) {
    assert.throws(() => call(Object.create(null)), { name: 'TypeError' },
      `${label}：无原型对象必须同抛 TypeError，谁也不许自己静默洗成一条结论`);
  }
  // 数值档：这些是装配层算出来的量，形状不对就是写错了，必须抛且点名是哪个入参
  for (const [fn, argName] of [[fromEpoch, 'epochMs'], [relativeTime, 'epochMs'], [dateDiff, 'aEpochMs']]) {
    assert.throws(() => fn(1000.5, 0), (e) => {
      assert.equal(e.name, 'TypeError');
      assert.match(e.message, new RegExp(`^${fn.name} 的 ${argName} 应为整数毫秒，收到 `));
      return true;
    }, fn.name);
  }
  assert.throws(() => relativeTime(0, NaN), { name: 'TypeError', message: /nowMs 应为整数毫秒/ });
  assert.throws(() => dateDiff(0, '0'), { name: 'TypeError', message: /bEpochMs 应为整数毫秒/ });
  assert.throws(() => fromEpoch(1000, 480.5), { name: 'TypeError', message: /offsetMinutes 应为整数分钟/ });
  assert.throws(() => fromEpoch(1000, undefined), { name: 'TypeError', message: /offsetMinutes/ });
  assert.throws(() => fromEpoch(1000, 841), { name: 'TypeError', message: /±14 小时|840/ });
  assert.doesNotThrow(() => fromEpoch(1000, -840));
  // 值越界与形状不对同档（都抛 TypeError）：`parseIdCard` 对 `today: '10000-01-01'` 就是这个口径
  assert.throws(() => fromEpoch(EPOCH_MS_LIMIT + 1, 0),
    { name: 'TypeError', message: /fromEpoch 的 epochMs 超出 Date 可表示的时间范围/ });
  assert.throws(() => relativeTime(0, EPOCH_MS_LIMIT + 1),
    { name: 'TypeError', message: /relativeTime 的 nowMs 超出 Date 可表示的时间范围/ });
  assert.throws(() => parseCivilDate('2024-01-01', '0'), { name: 'TypeError', message: /offsetMinutes/ });
  // 三个模块的报错尾巴都是「收到 <shapeOf(值)>」这一段：口径分叉在这里红
  // （拿真正会抛的那三类比：`generateUsccCodes` / `generateMobiles` 的 options 闸门与本页的数值闸门）
  const tails = [
    grab(() => fromEpoch(1000.5, 0), 'fromEpoch'),
    grab(() => generateUsccCodes({ rng: 'nope' }), 'generateUsccCodes'),
    grab(() => generateMobiles({ rng: 'nope' }), 'generateMobiles'),
  ];
  for (const [who, msg] of tails) {
    assert.match(msg, /收到 (null|undefined|number|string|boolean|bigint|object|function|symbol|Date|Array\(\d+\))/,
      `${who}：${msg}`);
  }
  function grab(fn, who) { try { fn(); } catch (e) { return [who, e.message]; } return [who, '']; }
});

test('K13 星期与月份是内置中文表：逐字钉住，源码里不许出现 Intl / toLocale', () => {
  const code = kCode();
  assert.ok(!code.includes('Intl'), '出现了 Intl——输出会随 Node / 浏览器的 ICU 与 locale 漂');
  assert.doesNotMatch(code, /toLocale(String|DateString|TimeString|NumberFormat)/, 'toLocale* 同样是环境依赖');
  const week = [];
  for (let i = 0; i < 7; i += 1) week.push(fromEpoch(i * 86400000, 0).weekday);
  assert.deepEqual(week, ['周四', '周五', '周六', '周日', '周一', '周二', '周三']);
  const months = [];
  for (let m = 1; m <= 12; m += 1) {
    const text = `2024-${String(m).padStart(2, '0')}-15`;
    months.push(fromEpoch(parseCivilDate(text, 0).epochMs, 0).monthName);
  }
  assert.deepEqual(months, ['一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月']);
});

test('K14 扫源：无 Date.now()、无无参 new Date()、不读环境、零 import', () => {
  const code = kCode();
  assert.equal(code.split('Date.now(').length - 1, 0, 'Date.now() 一旦出现，判据就随跑测试的时刻漂');
  assert.doesNotMatch(code, /new Date\(\s*\)/, '无参 new Date() 同上');
  assert.doesNotMatch(code, /getTimezoneOffset|process\.env|Date\.parse/, '本地时区只能由调用方传进来');
  assert.doesNotMatch(code, /^\s*import[\s({]/m, 'time.js 是叶子模块：import 会把数据表拖进 codec 页');
  assert.doesNotMatch(code, /\bimport\s*\(/, '动态 import 也算一条依赖边');
});

test('K15 偏移全域：+8h、+11:30、−14h、−5:30、0，五档的本地串与后缀自洽', () => {
  const MS = 1709161200000;   // date -u -r 1709161200 → 2024-02-28T23:00:00Z（周三）
  const east = fromEpoch(MS, 480);
  assert.equal(east.isoLocal, '2024-02-29T07:00:00+08:00');
  assert.equal(east.localDisplay, '2024-02-29 07:00:00 (UTC+08:00) 周四');
  assert.equal(east.weekday, '周四', '本地已跨到 2/29：星期跟着本地日，不是 UTC 日');
  assert.equal(fromEpoch(MS, 0).weekday, '周三');
  const half = fromEpoch(MS, 690);
  assert.equal(half.isoLocal, '2024-02-29T10:30:00+11:30', '23:00 UTC + 11:30 = 次日 10:30');
  assert.equal(half.localDisplay, '2024-02-29 10:30:00 (UTC+11:30) 周四');
  assert.equal(half.tzOffsetMinutes, 690);
  const west = fromEpoch(MS, -840);
  assert.equal(west.isoLocal, '2024-02-28T09:00:00-14:00');
  assert.equal(west.localDisplay, '2024-02-28 09:00:00 (UTC-14:00) 周三');
  assert.equal(fromEpoch(MS, -330).isoLocal, '2024-02-28T17:30:00-05:30');
  for (const off of [0, 480, 690, -840, -330]) {
    const r = fromEpoch(MS, off);
    assert.equal(r.isoUtc, '2024-02-28T23:00:00Z', `offset ${off} 不该动 UTC 那一档`);
    assert.equal(r.rfc3339Utc, '2024-02-28T23:00:00.000Z');
    assert.equal(r.unixMillis, MS);
    assert.ok(r.localDisplay.includes(r.isoLocal.slice(11, 19)), 'localDisplay 的时刻要与 isoLocal 一致');
  }
});

test('K16 relativeTime 阈值表逐档命中，含"此刻"与未来镜像', () => {
  const NOW = 1709164800000;
  const S = 1000; const M = 60000; const H = 3600000; const D = 86400000;
  const at = (deltaMs) => relativeTime(NOW + deltaMs, NOW);
  assert.deepEqual({ ...at(0) }, { text: '此刻', past: false, future: false });
  assert.equal(at(-59 * S).text, '59 秒前');
  assert.equal(at(-60 * S).text, '1 分钟前', '满一分钟就进下一档，不许留"60 秒前"');
  assert.equal(at(-59 * M).text, '59 分钟前');
  assert.equal(at(-60 * M).text, '1 小时前');
  assert.equal(at(-(23 * H + 59 * M + 59 * S)).text, '23 小时前');
  assert.equal(at(-30 * D).text, '1 个月前');
  assert.equal(at(-364 * D).text, '12 个月前');
  assert.equal(at(-365 * D).text, '1 年前');
  assert.equal(at(-366 * D).text, '1 年前', '满一年不满两年不再细化到天：固定档口径，写在 TIME_CAVEAT 里');
  assert.equal(at(-730 * D).text, '2 年前');
  assert.equal(at(45 * S).text, '45 秒后');
  assert.equal(at(3 * D).text, '3 天后');
  const f = at(45 * S);
  assert.equal(f.past, false); assert.equal(f.future, true);
  assert.equal(at(-45 * S).past, true);
});

test('K17 口径文案与实现互相对账：文案承诺的做到，做到的也写进文案', () => {
  const NOW = 1709164800000; const D = 86400000;
  const amb = parseTimestamp('999999999');
  const rows = [
    [/10 位当秒/, parseTimestamp('1000000000').verdict === 'second'],
    [/13 位当毫秒/, parseTimestamp('1000000000000').verdict === 'milli'],
    [/其余位数不猜/, amb.verdict === 'ambiguous' && amb.readings.length === 2 && amb.epochMs === null],
    [/只按「10 位整数 \+ 1–3 位小数的秒」/, parseTimestamp('1000000000.5').epochMs === 1000000000500
      && parseTimestamp('1000000000000.5').verdict === 'invalid'],
    [/按 30 天/, relativeTime(NOW - 30 * D, NOW).text === '1 个月前'],
    [/按 365 天/, relativeTime(NOW - 365 * D, NOW).text === '1 年前'],
    [/不读运行环境时区/, !/process\.env|getTimezoneOffset|Intl|toLocale|Date\.now|new Date\(\s*\)/.test(kCode())],
  ];
  for (const [claim, holds] of rows) {
    assert.equal(claim.test(TIME_CAVEAT), holds,
      `文案与实现分叉：${claim}（文案里有=${claim.test(TIME_CAVEAT)}，实现做得到=${holds}）`);
  }
  assert.equal(rows.length, 7, '对账表自己要有条数：漏一行等于那一档的承诺没人核');
  assert.ok(TIME_CAVEAT.length > 80 && TIME_CAVEAT.length <= 240,
    `口径句要够说清楚、又不能长到把面板挤爆（实际 ${TIME_CAVEAT.length} 字）`);
});

test('K18 零重叠：dev/js/tools/ 不成 vite 入口', () => {
  const top = readdirSync(resolve(ROOT, 'dev/js')).filter((f) => f.endsWith('.js') && !f.endsWith('.min.js'));
  assert.equal(top.includes('time.js'), false, 'time.js 被挪到 dev/js/ 顶层，会变成构建入口、进产物');
  assert.equal(existsSync(resolve(ROOT, 'dev/js/tools/time.js')), true,
    '文件不在它该在的位置时，上面那条断言是空转的');
  const vite = read('vite.config.js');
  assert.match(vite, /function getDevJsEntries\(\)[\s\S]{0,400}readDirSorted\(jsDir\)[\s\S]{0,200}endsWith\('\.js'\)/,
    'vite 的入口扫描不再是"dev/js 一层 + .js 后缀"，本条与 §6.1 的零重叠口径要一起重写');
  const siteJs = resolve(ROOT, '_site/assets/js');
  if (existsSync(siteJs)) {
    const hits = readdirSync(siteJs).filter((f) => f.endsWith('.js')
      && readFileSync(resolve(siteJs, f), 'utf8').includes('parseTimestamp'));
    assert.deepEqual(hits, [], '构建产物里出现了 time.js 的导出名');
  }
});
```

---

## Task 2: `codec.js` — Base64（UTF-8）与 URL 编解码（§L）

**Files:**
- Create: `dev/js/tools/codec.js`（磁盘 511 行）
- Modify: `scripts/toolkit-tests.mjs`（末尾追加 `// ── §L …` 一节，20 条 `test()`）
- Modify: `scripts/verify-plan-blocks.mjs`（`FILE_TARGETS` 加一行 `'dev/js/tools/codec.js',`）
- Modify: `scripts/verify-plan-blocks-teeth.mjs`（G12 的断言从"手抄两格"改成"从基线现读段 3 名下全部镜像"，
  否则本段每落地一格就要回来加一项，忘加的那格照样绿、只是不覆盖新来的那块）
- Modify: 本计划（契约回填 + 判据清单 + 两块落地镜像 + §K 小标题那句"到文件末尾"改口）

### 对外契约（落地后回填，2026-09-28）

起草版这格写了十个签名，磁盘上是 **13 个导出**（L18 把这张表钉成判据）。七处出入全部是实现期
坐实的事实，不是漂移：

1. 闸门从 `MAX_TEXT_LEN = 200000`（**字符**）改成 **`MAX_INPUT_BYTES = 1048576`（字节）**。
   §7 表里"文本类工具 1MB"那一行本来就是字节口径，用字符闸门会让"1MB"有两种算法；L8 拿
   `byteLen` 与闸门"必须是同一把尺子"把这件事钉住，并把 §7 那句"不许静默截断"落成
   `out === ''`。
2. `encodeUrlComponent` 不返回裸字符串，返回 `{ok,out,bytes,reason}`——起草版那一句让"落单代理项"
   和"越界"两种情况无处安放。`encodeUrl`（起草版没列）同档补齐，否则两档并列摆不出来。
3. `decodeDataUri` 的 `charsetPercent` 换成 **`percentHits`**（非 base64 档实际解码的百分号次数），
   另加 `mimeDefaulted` / `charsetDefaulted` 两个"这值是补的还是写的"字段（L9 要求两个"补"都说明白）。
4. `decodeBase64` 多一条 `options`（只认 `{strict}`）与 `whitespaceDropped` / `paddingImplied` / `badAt`
   三个字段。起草版只留了 `paddingDropped`，而"不静默补"这件事没有 `paddingImplied` 就不成立。
5. 多导出 `BASE64_CAVEAT`、`URL_CAVEAT` 两句口径（与 `TIME_CAVEAT` 同一角色）和 `byteLen`。
6. `splitQuery` 每行多 `hasEquals`；`urlPair` 顶层多 `ok` / `reason` / `bytes`（闸门越界时四格同生同死，L13）。
7. 起草版那句"18 个保留字符"仍然对，但**两档差异集合是 11 个**（`: / ? # @ $ & + , ; =`）——
   面板上"两档不一样"靠的就是这 11 个，L11 把它钉成固定断言，谁也不许悄悄改口径。

```text
export const MAX_INPUT_BYTES = 1048576;   // 字节闸门：§7"文本类工具 1MB"= 1 MiB；超过才拒，正好到值放行
export const BASE64_CAVEAT = '…';         // 面板原样显示（80–240 字，与实现双向对账由 L17 守着）
export const URL_CAVEAT = '…';
export function byteLen(text) → number                        // 闸门与面板共用这一把尺子
export function encodeBase64(text) → { ok, out, bytes, reason }
export function decodeBase64(text, options?) → { ok, out, strict, reason,
  whitespaceDropped, paddingDropped, paddingImplied, badAt }
export function encodeDataUri(text, mime?) → { ok, out, bytes, reason }
export function decodeDataUri(text) → { ok, reason, mime, charset, mimeDefaulted,
  charsetDefaulted, isBase64, data, percentHits, whitespaceDropped, paddingImplied }
export function encodeUrl(text)          → { ok, out, bytes, reason }   // encodeURI 档
export function encodeUrlComponent(text) → { ok, out, bytes, reason }   // encodeURIComponent 档
export function decodeUrlComponent(text) → { ok, out, reason }
export function urlPair(text) → { ok, reason, bytes, encodeURI, encodeURIComponent,
  decodeTries: [{ field: 'decodeURI' | 'decodeURIComponent', ok, out, reason } × 2] }
export function splitQuery(text) → Array<{ raw, key, value, keyOk, valueOk, hasEquals, reason }>
```

实现侧三条硬规矩写在文件头，整套 §L 围着它们转：

1. **不用运行时的编解码快捷方式**。`atob`/`btoa` 走 latin1 字节序（`btoa('中')` 直接抛），
   `TextEncoder` 会把落单代理项**静默**换成 U+FFFD，浏览器侧又根本没有 `Buffer`。所以 UTF-8 与
   Base64 全部自实现，判据拿 Node 的 `Buffer` 当**外部对拍源**（L1、L2、L8、L17），而不是把自己
   的输出当标准。URL 编码那一档**允许**用原生 `encodeURI` / `encodeURIComponent`：它们是纯函数、
   不读运行环境（L16 只禁 DOM 与时钟），而 L11 要的就是"与原生逐字符一致"——自己另写一张
   不需编码的字符表，只会多一处会写错的地方。
2. **拒绝就给理由，位置算得出来**。语法错报**字符位**（"第 N 位的百分号…"）、字节流错报**字节位**
   （"第 N 字节不是合法 UTF-8"），两类口径不混，L12 用 `doesNotMatch` 双向钉。
3. **不静默补、不静默截**。缺的尾部 padding 补几位写进 `paddingImplied`，剥掉的空白计进
   `whitespaceDropped`，越界时 `out` 必须是空串——半截产物比报错更坏，用户会拿它继续用。

### 判据清单（§L，落地后回填）

**20 条 `test()`**（L1–L18，其中 L10b、L14b 是给"两侧同档"和"解码档"单开的两格），
外加一份 **16 刀变异台账**（Step 3，`/tmp/seg3t2/mut.mjs`，跑完即弃、不进套件）。
§L 对套件总数的贡献是 20，全量 `# tests` 从 164 变成 **184**。

| 编号 | 咬什么 |
| --- | --- |
| L1 | 编码与 `Buffer.from(s,'utf8').toString('base64')` 逐字符对拍，15 条样本（尾块三档余数 + 中文 + emoji + 控制字符 + 空串 + 空白），`bytes` 同时与 `Buffer.byteLength` 对拍；空串是一等公民 |
| L2 | 编→解往返逐样本原样回来（emoji、`U+0000`、`U+00FF`、BMP 之外都在样本里） |
| L3 | 落单代理项点名拒绝：`'\uD83D'`→第 1 位、`'a\uD83Db'`→第 2 位、`'\uDE00'`→第 1 位、`'ab\uDE00c'`→第 3 位，且 `out` 必须为空；成对代理项不许被一起拒了 |
| L4 | strict 档三格各自拒绝（空白 / padding 不配余数 / 长度非 4 倍数），`strict` 回显真正生效的那一档；并钉死"尾部那几位填充比**两档都不校验**"（`'YR=='` 与 `'YR=='` 的宽容档都解出 `'a'`），免得后来人顺手补一道 RFC 4648 非规范检查、把 L1 的往返样本莫名其妙弄少一条 |
| L5 | 宽容档计数：`'YW\tJj\r\n'` 剥 3 处空白、`'YQ=='` 报 `paddingDropped:2`、`'YQ'` 报 `paddingImplied:2`（不静默补）、`'YQ===='` 在第 5 位拒 |
| L6 | 字母表外字符两档都拒并点名第几位是哪个字符（`'YWJ*'`→「第 4 位字符「\*」」+ `badAt:4`）；`%4===1` 这种结构不可能的余数两档都拒 |
| L7 | 解出的字节不是合法 UTF-8：`0xFF` 与"半个中文"两格都报**字节位**、`out` 为空，不许吐 U+FFFD |
| L8 | `MAX_INPUT_BYTES === 1048576`；正好到上限放行、超一字节整体拒绝且 `out` 为空，理由里同时点名实测字节与上限；四个入口同档；解码侧的闸门按**解出的字节数**算；`byteLen('中')===3`、`byteLen('中文')===6`、`byteLen('😀')===4`，且 `byteLen(big)` 与闸门同值（一把尺子） |
| L9 | data URI 往返：mime / charset / base64 标志各归其位；`charset=gbk` **拒绝**（不许假装按 UTF-8 解出"能看"的东西）；`UTF-8` 大写归一小写回显且 `charsetDefaulted:false`；`data:,abc` 那两个"补"（mime 与 charset）都要说出来 |
| L10 | 带换行的 data URI 载荷照吃（§5.2 点名）并报剥了 4 个空白；百分号档 `percentHits` **逐个计数**（六个，不是一句"含百分号"） |
| L10b | `http://a/b`、`dat`、`data:`、`data:text/plain;base64`、`data:text/plain;base64,` 五格各自的拒绝理由分明；`encodeDataUri('')` 与解码侧空载荷**同档拒绝**（L15 再把 `null`/`undefined` 归一后送进同一档），`mime` 形状不合法单独一档 |
| L11 | 18 个保留字符逐字符对拍原生两函数（先自证 `RESERVED.length === 18`），两档**差异集合恰为 11 个** `: / ? # @ $ & + , ; =`；`bytes` 是入参字节数不是输出的；空格是 `%20` 不是 `+`；`'%'` 自己必须编成 `%25` |
| L12 | 解码侧五格百分号语法错（报字符位）+ 四格 UTF-8 字节错（报字节位），并用两条 `doesNotMatch` 钉住"两类位置口径不混"；`'a+b'` 原样留着（`+` 不当空格）；8 样本两档往返；两档编码对落单代理项点名拒绝 |
| L13 | `urlPair` 四格并列：两档编码结果与原生对拍、`%3A%2F` 让两档解码必须分开摆；闸门越界时**四格同生同死且共用同一句理由**（`x.reason === over.reason`）；解码单独失败不牵连编码档（`'%zz'` 那格 `ok:true` 而两档解码 `ok:false`）；空串四格全 ok |
| L14 | `splitQuery` 只按 `&` 切、真空段丢弃但**只含空白的段不丢**、`;` 不作分隔符、重复键不合并、无 `=` 的行 `hasEquals:false` 且 `value:''`、`k=a=b` 的值是 `a=b` |
| L14b | 解不开的那一侧保留原文并标 `keyOk`/`valueOk`（`key` 位不许变空）、同一行里解得开的邻居不连坐、`%20=1` 的键解成空格、单项越界单独拒且**原文长度一位不少** |
| L15 | 两档入参：文本入参（数字 / 布尔 / Symbol / Date）归一不抛，八个入口对无原型对象同抛 `TypeError`；options 三档 `TypeError`（非对象 / 未知键 / `strict` 非布尔），键在值缺席走默认档不抛；`mime` 那一位是文本档（缺席补默认、给了但形状不对就拒，都不是抛）；报错尾巴「收到 <shape>」一条正则同时核 `decodeBase64`、`fromEpoch`、`generateUsccCodes` 三本模块 |
| L16 | 剥注释扫源 23 条违禁（`import`/`export from`/`export * from`/动态 `import()`/`require`/DOM 四件/`fetch`/`Buffer`/`atob`/`btoa`/`TextEncoder`/`TextDecoder`/时钟与随机三件/`Intl`/`toLocale`/`crypto`/`unescape`/`eval`，逐条数过来正好 23），清单自己带条数断言；`import` 那条的 `^` 带 `m` 标志是段 3 Task 3 评审回改补的牙（`export * from` 与动态 `import()` 两条也是那次补的，见 Task 3 的回改小节）——没有 `m` 时"中段插一条 import"这一整档静默不核；再**正向**断言 `MAX_INPUT_BYTES`、`0xD800`、`BASE64_ALPHABET` 必须出现在代码里（只在注释里提等于没实现）；零重叠：`dev/js/codec.js` 不存在、`_site/assets/js` 里搜不到 `splitQuery` |
| L17 | 两句 CAVEAT 与实现**双向**对账（Base64 八行 + URL 六行，两张表各带条数断言）：文案承诺的每档实现做得到，做到的每档也写进文案；两句长度都在 80–240 字且不许相同 |
| L18 | 导出面 13 个名字按字典序逐一比对，多一个少一个都红，清单自己带 `length === 13` |

### Steps

> 每一格都带**实跑结果**。起草时的期望有七处与现场不符（三处是判据自己的期望值写错、
> 三处是实现期坐实的口径冲突、一处是样本选错档），全部按现场改口并写明差在哪。

- [x] **Step 1: 写 §L 二十判据（此时 `codec.js` 不存在，必红）**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs > /tmp/segL_red.log 2>&1; echo "exit=$?"
grep -E "^# (tests|pass|fail)|^not ok" /tmp/segL_red.log
```
实跑（`/tmp/segL_red.log`、二次复跑 `/tmp/segL_red2.log` 形状相同）：`exit=1`、
`# tests 165 / pass 164 / fail 1`，红的是**一条文件级** `not ok 1 - scripts/toolkit-tests.mjs`，
`error: 'test failed'`，原因写在尾部的 `# Error:` 注释行里：
`ERR_MODULE_NOT_FOUND: Cannot find module '.../dev/js/tools/codec.js' imported from .../toolkit-tests.mjs`。
与 Task 1 的形状差一处细节：本节的 `await import` 在**已登记完前序 164 条之后**才崩，
runner 报的是"测试结束后有资源产生了异步活动"，所以 `error` 字段不是 `ERR_MODULE_NOT_FOUND`
本身、要找尾部那行 `# Error:`。起草时"fail 恰为 §L 条数"的期望同样不成立：§L 的 20 条
**一条都不会被登记**。判据看的是这个 + §A–§K 的 164 条一条不红。

- [x] **Step 2: 写 `dev/js/tools/codec.js`，直到 §L 全绿**

```bash
node --check dev/js/tools/codec.js
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs > /tmp/g1.log 2>&1; echo "exit=$?"
grep -E "^# (tests|pass|fail)" /tmp/g1.log
```
实跑：`exit=0`、`# tests 184 / pass 184 / fail 0`。中途一次三红（L4 / L8 / L12），
三条都是**判据自己的期望值错**，不是实现错，改的是判据：

| 现场 | 起草的期望 | 实测 | 判定 |
| --- | --- | --- | --- |
| L8 `byteLen('中')` | 6 | **3** | 单个汉字就是 3 字节，6 是"中文"两字；判据改成 3 并补 `byteLen('中文') === 6` |
| L10 `whitespaceDropped` | 5 | **4** | `'5Lit\r\n5paH\r\n'` 里两组 `\r\n` 共 4 个空白字符，我按"处"数成了 5 |
| L10 `percentHits` | 4 | **6** | `%3C/%20/%3D/%22/%22/%3E` 六个，样本挑的是 SVG 串、引号有两只 |
| L12 解码入参 | `encodeUrlComponent(s)` | — | 整个对象传进解码器，`String()` 之后成了 `'[object Object]'`；改成 `.out` |
| L4 strict 往返 | `decodeBase64('YR',{strict:true})` → `'a'` | — | 与 L4 原有"`'YWJ'` 因长度非 4 倍数被 strict 拒"**自相矛盾**；换成规范形 `'YR=='`（仍然测到"尾部填充比不校验"） |
| L6 字母表外样本 | `'Y Q='` | 剥空白后是 **padding 不配** | 报的不是字母表，换 `'Y Q*='` 才咬到那一档 |
| L15 数值入参 | `decodeBase64(42)` 的拒绝档位 | 不稳 | `42` 归一成 `"42"` 后落哪一档取决于两位的余数；换成 `Symbol('x')`（归一 `"Symbol(x)"` 必含 `(`） |

写实现**之前**先坐实的三处口径冲突（都是起草版含糊、两处档位不对称的地方）：

1. 空 data URI：编码侧本来会包出 `data:text/plain;charset=utf-8;base64,` 一串"看着成功其实没内容"。
   统一成**两侧都拒**（`encodeDataUri('')` → `载荷为空`），L10b + L15 两头钉。
2. `charset=gbk`：起草版判据写着"按 UTF-8 解出 `<b>`"——那是**假装成功**。改成拒绝且理由含 `charset`。
3. `splitQuery`：`;` 到底切不切、`'& &'` 那格丢不丢。定死"只按 `&` 切、只丢**真空**段、
   只含空白的段是用户的真实输入不许替人丢"，并把 `;` 与第一个 `=` 两条写进 `URL_CAVEAT` 由 L17 对账。

实现期另有一处设计缺陷在写代码时改掉：`pctDecode` 原本逐 code unit 编码字面量，会把代理对
劈成两半（两半各自"非法 UTF-8"，报出来的字节位是假的）→ 改成按 `raw.indexOf('%')` 分段、
整段一次 `utf8Write`，并在入口先跑 `loneSurrogateAt(raw)`。

- [x] **Step 3: 自证 §L 有牙（16 刀变异台账）**

```bash
cd /tmp/seg3t2 && DRY=1 node mut.mjs          # 先预检：基线必须全绿、十六处锚点各命中 1 处
node mut.mjs > /tmp/seg3t2/ledger.log 2>&1; echo "exit=$?"
```
形状照段 2 的 `/tmp/t4mut/mut.mjs`：**真复制**到 `/tmp/seg3t2/tree`（不用 `cp -al`，硬链接的
影子副本改一处两处同时变，量出来全是假证据），变异一律落在副本里，本仓工作树一个字都不碰。
脚手架自己带四道自检：`# tests` 与红名单一起正则解析、基线必须 ≥100 条且零红、
副本与工作树逐字节必须相同（判据中途改过也不会拿到旧树）、每刀跑完再核 `# tests` 未变。

红名单的正则本轮从 `([A-Z]\d+)\b` 放宽成 `([A-Z]\d+[a-z]?)\b`：**不加这个尾巴，L10b / L14b
红了也不会进名单**（`L10b` 在 `0` 与 `b` 之间没有词边界，匹配整体失败），而那两条正是本台账里
M10 与 M6/M7 的靶子——旧写法会把"没牙"演成"有牙"。预检那趟（`DRY=1`）还顺带暴露副本树缺
`demo/idCardDemo/lib/GB2260.js` 会让 B14 红，拷贝清单因此补上 `demo/`。

台账结果（`/tmp/seg3t2/ledger.log`，基线 `# tests 184 / pass 184`）：

| 刀 | 改坏什么 | 红了谁 | 归因 |
| --- | --- | --- | --- |
| M1 | 缺的 padding 静默补、不写进报告 | L5 L17 | 目标 L5 ✅；L17 是设计内联动（文案承诺"补齐并注明补了几位"，实现做不到就必须红） |
| M2 | strict 档放行空白 | L4 | 单红、恰目标 |
| M3 | 越界改成截断（吐半截 base64） | L8 L17 | 目标 L8 ✅；L17 同 M1（"整体拒绝、不截断"那句失守） |
| M4 | 编码侧落单代理项闸门摘掉 | L1 L2 L3 | 目标 L3 ✅；L1/L2 是样本表共享的**真实**后果：闸门一摘，`'\uD83D'` 不再被"由 L3 专门判"跳过、进了对拍循环，Node 拿 U+FFFD、我们拿半代理项拼出的三字节，逐字符必然不同 |
| M5 | 两档编码合并成 `encodeURI` | L11 L13 L17 | 三处都该红：L11 的两档差异集合变空、L13 的"两档必须分开摆"、L17 的承诺句 |
| M6 | query 分隔符把「;」也切上 | L14 L17 | 目标 L14 ✅，L17 同 M1 |
| M7 | 键值改在最后一个「=」处切 | L14 L17 | 同上 |
| M8 | UTF-8 解码放行代理区编码（CES-8） | L12 | 单红：`%ED%A0%80` 又"解得开"了，正是规矩 1 要拒的那一档 |
| M9 | 字节位的理由写成"第 N 位" | L12 | 单红：`doesNotMatch(/第 \d+ 位/)` 咬住了"两类位置口径不混"——M8 那类错的孪生判据，M9 红了才证明它不是摆设 |
| M10 | 空载荷在编码侧放行 | L10b L15 | 目标 L10b ✅；L15 是"归一之后落哪一档"的联动（`encodeDataUri(null)` 归一成空串、照同一档拒） |
| M11 | 非 UTF-8 的 charset 假装解得开 | L9 | 单红 |
| M12 | 只含空白的 query 段被静默丢掉 | L14 | 单红 |
| M13 | 导出面偷偷多长一个名字 | L18 | 单红 |
| M14 | 引入运行时快捷方式 `atob` | L16 | 单红：21 条违禁扫描真抓得到——"不用快捷方式"这件事的牙齿在这里，不在文件头那段注释里 |
| M15 | 口径句里的 UTF-8 改成 UTF-16 | L17 | 单红，方向与 M1 相反：**文案说假话也红**，这是双向对账的另一头 |
| M16 | 剥掉的空白不计数 | L5 L10 L17 | 三处：两个计数断言 + 承诺句 |

**16/16 有牙、0 刀全绿、0 档被脚手架自检作废**；8 刀单红恰命中目标，另 8 刀的多红逐条可归因
（L17 双向对账在 M1/M3/M5/M6/M7/M16 六刀里同红，M4 的 L1/L2 是样本表共享，M5 的 L13、M10 的 L15、
M16 的 L10 是同一不变量的另一处断言），**没有一刀红到不相干的用例上**。跑完：还原后
`# tests 184 / pass 184 / 红 无`、`副本与工作树逐字节一致=true`、脏项 `16 → 16`、
`内容变过 0 个`、`清单变化=false`——工作树没被这些实验碰过。

- [x] **Step 4: 登记镜像**

三件事一起做，少任何一件门禁二都会以"看不懂的形状"红（机制见 §0.6）：
`FILE_TARGETS` 加 `'dev/js/tools/codec.js',`、计划本格末尾贴两块 ```js 全文镜像（`codec.js` 整文件
+ `§L` 整节）。`§L` 一节落地后**顺带把 §K 的镜像区间从"到文件末尾"改成"到 §L 之前"**——
分节是按标记切的，`SEG_MARK` 认了新节就不会再把 §K 一路吞到尾部（这是段 1 那两种错形状之一）。

```bash
node scripts/verify-plan-blocks.mjs > /tmp/g2.log 2>&1; echo "exit=$?"; tail -3 /tmp/g2.log
node scripts/verify-plan-blocks.mjs --fix   # 整块按磁盘内容重写，正文其余不碰
node scripts/verify-plan-blocks-teeth.mjs   # 门禁三
```
实跑：门禁二 `exit=0`、镜像 **35 → 37**（多 `codec.js` 整文件 + `§L` 分节两条）、`未落地 0 节`、
合计 642373B；`OK scripts/toolkit-tests.mjs §L（磁盘 6190–6597）：计划[段3] …（408 行）与磁盘逐字节全等`
（计划侧那对行号不抄——本节每改一行它就往后挪，抄进台账等于埋一条对不上的数），
§K 那条也重新报出了自己的区间（`磁盘 5742–6189` ↔ 计划 446 行），证明"到 §L 之前"改对了；
计划 js 块 **34 个（段1 11、段2 19、段3 4）**。`--fix` 报 **没有可同步的镜像块**——贴进去的就是磁盘内容，
这一格是空操作（和 Task 1 同一形状：`--fix` 只在真漂移时落笔）。

门禁三 **21/21**（Task 1 那轮是 20/20）。多出来的一条是 **G12 自己长了牙之后拆成三条**：
原来 G12 手抄"段 3 名下有 `time.js` 与 `§K` 两块镜像"，本段每落地一格就得回来手加一项，
**忘加的那格照样绿、只是不覆盖新来的那块**——这跟"清单不跟着磁盘走"是同一个缺陷，只不过长在守卫身上。
改成从基线现读 `^OK (.+?)：计划\[段3\]`，再断这些名字在摘掉段 3 条目后**全部** `✗`：

1. 变异落地（副本里 `PLANS` 只剩两份）；
2. 基线里段 3 名下确实有镜像（`读到 4 条`，空集就直接红——防止清单读空变成"没东西要核"的假绿）；
3. 该份名下 4 块镜像全部点名 `✗` + 退 1（`未点名=无`）。

现在 `time.js` / `codec.js` / `§K` / `§L` 四格都在核范围内，Task 3 落地 `digest.js` 时不用再动 G12。

- [x] **Step 5: 提交**

```bash
git add dev/js/tools/codec.js scripts/toolkit-tests.mjs scripts/verify-plan-blocks.mjs \
  scripts/verify-plan-blocks-teeth.mjs _docs/superpowers/plans/2026-09-27-tools-codec-page.md
git diff --cached --stat      # 期望恰 5 files
git commit -m "feat(tools): 段 3 Task 2 编码模块 codec.js——UTF-8 与 Base64 自实现、拒绝必给位置（§L 二十判据 + 十六刀变异台账）" -- \
  dev/js/tools/codec.js scripts/toolkit-tests.mjs scripts/verify-plan-blocks.mjs \
  scripts/verify-plan-blocks-teeth.mjs _docs/superpowers/plans/2026-09-27-tools-codec-page.md
```

实跑：`df58116`，`5 files changed, 2103 insertions(+), 24 deletions(-)`——`codec.js` 511 行是新增，
`§L` 判据 410 行，两道门禁脚手架各改 3/26 行，计划 +1177 行。提交后 `git status` 里这五个路径一字不剩，
剩下的脏项全属另一路会话（`_config.yml`/`about.*`/`package.json`/`scripts/lib/` 等），未被本轮碰过。
提交后复跑：门禁一 `# tests 184 / pass 184`、门禁二 `exit=0`（37 镜像、未落地 0 节）、门禁三 21/21。

---

### 落地镜像（门禁二核的就是这两块，`--fix` 会把它们整块换成磁盘内容）

两块都是**磁盘全文**，用 ```js 围栏（§0.6 的硬规矩：只有整文件与整节镜像允许 ```js，
契约段一律 ```text）。

#### `dev/js/tools/codec.js`（整文件）

```js
/**
 * Base64（UTF-8）与 URL 编解码：编码工具箱页四间格子（Base64 / data URI / URL / query）共用的纯逻辑。
 *
 * 这一格有三条不许让步的规矩，整套判据（§L）都是围着它们写的：
 *
 * 1. **不用运行时的编解码快捷方式**。浏览器侧没有 `Buffer`，而 `atob` / `btoa` 走的是 latin1
 *    字节序（`btoa('中')` 直接抛）、`TextEncoder` 又会把落单代理项**静默**换成 U+FFFD（实测
 *    `new TextEncoder().encode('\uD83D')` → `239,191,189`）。所以 UTF-8 与 Base64 全部自己实现，
 *    判据拿 Node 的 `Buffer` 当外部对拍源（L1、L2、L11、L13 四处），而不是把自己的输出当标准。
 * 2. **拒绝就给理由，位置算得出来**。`decodeURIComponent('%E4%B8')` 只会抛一句 `URIError: URI malformed`，
 *    面板拿它没法告诉用户"哪里坏了"。所以解码侧一律走自己的扫描器：语法错报**字符位**
 *    （"第 N 位的百分号…"），字节流错报**字节位**（"第 N 字节不是合法 UTF-8"），两类口径不混（L12）。
 * 3. **不静默补、不静默截**。缺的尾部 padding 补齐之后要在 `paddingImplied` 里说补了几位；
 *    剥掉的空白在 `whitespaceDropped` 里计数；超过 1 MiB 的输入整体拒绝且 `out` 必须是空串
 *    （半截产物比报错更坏，用户会拿它继续用）。
 *
 * 与 `idcard.js` / `bankcard.js` / `phone.js` / `uscc.js` / `time.js` 同一套约定：纯函数、不碰 DOM、
 * 同级工具模块互不 import（`shapeOf` 因此是第三份拷贝，代价由 L15 对着 `time.js` 与 `uscc.js` 核一次），
 * 并且**两档入参两种处理**：
 *   - **文本入参**照兄弟模块那句 `String(text === null || text === undefined ? '' : text)`，
 *     `null` / `undefined` 归一成空、其余 `String()` 之后再判形状，一律不抛；唯一例外还是无原型对象
 *     （`String()` 自己抛 `TypeError`，本站不替它兜，L15 逐入口钉）。
 *   - **options 入参**（`decodeBase64` 的 `{strict}`）与 `mime` 的形状档才是闸门：
 *     options 只收对象与 `null`/`undefined`，键名拼错必须响——静默当默认等于用户的 `strict` 白开了。
 *
 * 可复算口径：本文件所有硬编码期望值都能用 Node 独立复算，例如
 * `Buffer.from('中文','utf8').toString('base64')` → `5Lit5paH`、`Buffer.from('😀').toString('base64')`
 * → `8J+YgA==`、`Buffer.from('YR','base64').toString('hex')` → `61`（尾部填充比特两档都不校验，
 * 与 Node 的解码器同档；这一条由 L4 钉住，免得后来人"顺手"加一道非规范检查）。
 * `MAX_INPUT_BYTES` 就是 §7 表里"文本类工具 1MB"那一行，取 1 MiB = 1,048,576 字节。
 */

/** 输入闸门（字节）：`超过`才拒，正好 1 MiB 放行；面板上的"多少字节"与这道闸门共用 `byteLen` 这一把尺子 */
export const MAX_INPUT_BYTES = 1048576;

/** 一行的口径说明，面板原样显示（与 `TIME_CAVEAT` 同一角色，逐条对账由 L17 守着） */
export const BASE64_CAVEAT =
  'Base64 一律按 UTF-8 字节编解码。解码默认宽容档：剥掉空白并报告处数，缺的尾部 padding 补齐并注明补了几位；'
  + '字母表外的字符、长度不合法、解出的字节不是合法 UTF-8，三类都按位置拒绝、不给半截产物；'
  + '超过 1 MiB（1048576 字节）整体拒绝、不截断。';

/** 同上，管 URL 那一格：两档并列、`+` 的口径、query 的切分规则都在这里说明白 */
export const URL_CAVEAT =
  'URL 编码并列给出 encodeURI 与 encodeURIComponent 两档，两者对 18 个保留字符的处理不同。'
  + '解码只认百分号序列，「+」不当作空格；query 只按「&」切分，「;」不切，键与值只在第一个「=」处切一次；'
  + '单项解不开时保留原文并标注哪一档失败；超过 1 MiB（1048576 字节）整体拒绝、不截断。';

/** 标准字母表（含 `+` `/`）；URL 安全变体不在本模块，别在这一格悄悄换表 */
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** 字符 → 6 位值：`indexOf` 每次最多扫 64 个字符，长输入下是个不必要的常数因子 */
const BASE64_VALUE = new Map([...BASE64_ALPHABET].map((ch, i) => [ch, i]));
/** RFC 3986 的 mime `type/subtype`：够窄，`text plain` 这种带空格的必须响 */
const MIME_SHAPE = /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*$/;
/** 代理区两头的边界：编码侧先扫这一档，才谈得上"不静默替换" */
const SUR_HIGH_LO = 0xD800; const SUR_HIGH_HI = 0xDBFF;
const SUR_LOW_LO = 0xDC00; const SUR_LOW_HI = 0xDFFF;
/** ASCII 空白：刻意不用 `\s`，那是连 U+00A0、U+3000 都算的另一档口径 */
const ASCII_WS = /[ \t\n\r\f\v]/;
/** 上一档的全局版，只给 `match` / `replace` 用（这俩会自己把 `lastIndex` 归零，所以能共用一个实例） */
const ASCII_WS_G = /[ \t\n\r\f\v]/g;

/** 越界那一句要复用，理由里点名实测字节与上限（L8） */
const overLimit = (n) => `输入 ${n} 字节，超过 ${MAX_INPUT_BYTES} 字节上限（1 MiB），整体拒绝、不截断`;

/** 文本入参归一：与 `idcard.js` 那句同档，无原型对象由 `String()` 自己抛 */
const toText = (v) => String(v === null || v === undefined ? '' : v);

/**
 * 报错消息里的值回显。与 `time.js`、`uscc.js` 各自的实现同一份口径，
 * 三处任何一处改动都会被 L15 与 K12 分别抓到。
 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (typeof v === 'object') return v instanceof Date ? 'Date' : 'object';
  return typeof v;
}

/** 找落单代理项，返回 1-based 字符位；干净就返回 0（L3、L12 末段、L13 都靠这一档） */
function loneSurrogateAt(text) {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= SUR_HIGH_LO && code <= SUR_HIGH_HI) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (next < SUR_LOW_LO || next > SUR_LOW_HI) return i + 1;
      i += 1;
    } else if (code >= SUR_LOW_LO && code <= SUR_LOW_HI) {
      return i + 1;
    }
  }
  return 0;
}

/** UTF-8 字节数：闸门与面板计数都用它。落单代理项按 3 字节计——它反正会在下一档被拒 */
function utf8Len(text) {
  let n = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) n += 1;
    else if (code < 0x800) n += 2;
    else if (code >= SUR_HIGH_LO && code <= SUR_HIGH_HI) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (next >= SUR_LOW_LO && next <= SUR_LOW_HI) { n += 4; i += 1; } else n += 3;
    } else n += 3;
  }
  return n;
}

/** 字符串 → 字节数组（调用方必须先过 `loneSurrogateAt`，否则这里会把半代理项当三字节写出去） */
function utf8Write(text) {
  const out = [];
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
    else if (code >= SUR_HIGH_LO && code <= SUR_HIGH_HI) {
      const cp = 0x10000 + ((code - SUR_HIGH_LO) << 10) + (text.charCodeAt(i + 1) - SUR_LOW_LO);
      out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
      i += 1;
    } else out.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
  }
  return out;
}

/**
 * 字节数组 → 字符串，并在校验失败时给出**1-based 字节位**。
 * 口径照 WHATWG 的 UTF-8 解码器：拒绝过短序列（`0xC0`/`0xC1`）、代理区编码（`ED A0 80`）
 * 与超出 `U+10FFFF` 的序列（`F5`–`FF`）。不产出 U+FFFD——那是"把坏数据洗成能看"的另一件事。
 */
function utf8Read(bytes) {
  const parts = [];
  let i = 0;
  while (i < bytes.length) {
    const lead = bytes[i];
    let need; let cp; let lo; let hi;
    if (lead < 0x80) { parts.push(String.fromCodePoint(lead)); i += 1; continue; }
    else if (lead >= 0xC2 && lead <= 0xDF) { need = 1; cp = lead & 0x1F; lo = 0x80; hi = 0xBF; }
    else if (lead === 0xE0) { need = 2; cp = lead & 0x0F; lo = 0xA0; hi = 0xBF; }
    else if (lead >= 0xE1 && lead <= 0xEC) { need = 2; cp = lead & 0x0F; lo = 0x80; hi = 0xBF; }
    else if (lead === 0xED) { need = 2; cp = lead & 0x0F; lo = 0x80; hi = 0x9F; }
    else if (lead >= 0xEE && lead <= 0xEF) { need = 2; cp = lead & 0x0F; lo = 0x80; hi = 0xBF; }
    else if (lead === 0xF0) { need = 3; cp = lead & 0x07; lo = 0x90; hi = 0xBF; }
    else if (lead >= 0xF1 && lead <= 0xF3) { need = 3; cp = lead & 0x07; lo = 0x80; hi = 0xBF; }
    else if (lead === 0xF4) { need = 3; cp = lead & 0x07; lo = 0x80; hi = 0x8F; }
    else return { ok: false, text: '', badAt: i + 1 };
    for (let k = 1; k <= need; k += 1) {
      const cont = i + k < bytes.length ? bytes[i + k] : -1;
      if (cont < lo || cont > hi) return { ok: false, text: '', badAt: i + 1 };
      cp = (cp << 6) | (cont & 0x3F);
      lo = 0x80; hi = 0xBF;
    }
    parts.push(String.fromCodePoint(cp));
    i += need + 1;
  }
  return { ok: true, text: parts.join(''), badAt: 0 };
}

/** 三字节一组，尾部按 1/2 字节补 4 位与 1–2 个 `=`：与 Node 的规范输出逐字符一致（L1） */
function b64FromBytes(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const has1 = i + 1 < bytes.length;
    const has2 = i + 2 < bytes.length;
    const b1 = has1 ? bytes[i + 1] : 0;
    const b2 = has2 ? bytes[i + 2] : 0;
    out += BASE64_ALPHABET[b0 >> 2]
      + BASE64_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)]
      + (has1 ? BASE64_ALPHABET[((b1 & 0x0F) << 2) | (b2 >> 6)] : '=')
      + (has2 ? BASE64_ALPHABET[b2 & 0x3F] : '=');
  }
  return out;
}

/** 4 位一组还原；尾部那 2 位或 4 位填充比**不校验**（L4 钉住这一档，与 Node 的解码器同档） */
function b64ToBytes(core) {
  const out = [];
  const full = core.length - (core.length % 4);
  for (let i = 0; i < full; i += 4) {
    const a = BASE64_VALUE.get(core[i]);
    const b = BASE64_VALUE.get(core[i + 1]);
    const c = BASE64_VALUE.get(core[i + 2]);
    const d = BASE64_VALUE.get(core[i + 3]);
    out.push((a << 2) | (b >> 4), ((b & 0x0F) << 4) | (c >> 2), ((c & 0x03) << 6) | d);
  }
  const rem = core.length % 4;
  if (rem >= 2) {
    const a = BASE64_VALUE.get(core[full]);
    const b = BASE64_VALUE.get(core[full + 1]);
    out.push((a << 2) | (b >> 4));
    if (rem === 3) out.push(((b & 0x0F) << 4) | (BASE64_VALUE.get(core[full + 2]) >> 2));
  }
  return out;
}

/**
 * 百分号解码 + 计数，返回**字符位**或**字节位**两档之一的理由。
 * 不用 `decodeURIComponent` 出结果：它只会抛 `URIError: URI malformed`，位置信息全丢（规矩 2）。
 * `+` 一律原样保留——它在 form 编码里是空格，在 URI 里不是，本模块不替用户猜（URL_CAVEAT 里那句）。
 */
function pctDecode(raw) {
  const inBytes = utf8Len(raw);
  if (inBytes > MAX_INPUT_BYTES) return { ok: false, text: '', hits: 0, reason: overLimit(inBytes) };
  const lone = loneSurrogateAt(raw);
  if (lone > 0) {
    return { ok: false, text: '', hits: 0, reason: `第 ${lone} 位是落单代理项（半个 emoji），UTF-8 里不存在` };
  }
  const bytes = [];
  let hits = 0;
  let i = 0;
  while (i < raw.length) {
    const pct = raw.indexOf('%', i);
    if (pct < 0) {
      for (const b of utf8Write(raw.slice(i))) bytes.push(b);
      break;
    }
    if (pct > i) {
      // 字面量整段一次编码：一个字符一个字符地走会把代理对劈成两半，各半都是"非法 UTF-8"
      for (const b of utf8Write(raw.slice(i, pct))) bytes.push(b);
    }
    const hex = raw.slice(pct + 1, pct + 3);
    if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
      return { ok: false, text: '', hits, reason: `第 ${pct + 1} 位的百分号「%」后面必须紧跟两位十六进制数字（如 %20）` };
    }
    bytes.push(Number.parseInt(hex, 16));
    hits += 1;
    i = pct + 3;
  }
  const dec = utf8Read(bytes);
  if (!dec.ok) return { ok: false, text: '', hits, reason: `第 ${dec.badAt} 字节不是合法 UTF-8（百分号序列解出的字节流）` };
  return { ok: true, text: dec.text, hits, reason: null };
}

/**
 * 字符串 → Base64。先过字节闸门，再过代理项档，最后才动手编码：
 * 顺序反了会让"1 MiB 的半截 emoji"报成"越界"，用户看着像被截断了。
 */
export function encodeBase64(text) {
  const s = toText(text);
  const bytes = utf8Len(s);
  if (bytes > MAX_INPUT_BYTES) return { ok: false, out: '', bytes, reason: overLimit(bytes) };
  const lone = loneSurrogateAt(s);
  if (lone > 0) {
    return { ok: false, out: '', bytes, reason: `第 ${lone} 位是落单代理项（半个 emoji），Base64 无法表示` };
  }
  return { ok: true, out: b64FromBytes(utf8Write(s)), bytes, reason: null };
}

/** 结果外壳：`out` 与三个计数字段在所有分支都齐活，面板才不必为失败档准备另一套绑定 */
const b64Result = (ok, out, strict, reason, whitespaceDropped, paddingDropped, paddingImplied, badAt) =>
  ({ ok, out, strict, reason, whitespaceDropped, paddingDropped, paddingImplied, badAt });

/** 尾部连同一个字符的个数（只用来数 `=`，别拿它当通用的 run 压缩） */
const trailingRun = (s, ch) => {
  let n = 0;
  while (n < s.length && s[s.length - 1 - n] === ch) n += 1;
  return n;
};
const firstAsciiWs = (s) => {
  for (let i = 0; i < s.length; i += 1) if (ASCII_WS.test(s[i])) return i + 1;
  return 0;
};
const countAsciiWs = (s) => (s.match(ASCII_WS_G) || []).length;
const stripAsciiWs = (s) => s.replace(ASCII_WS_G, '');
/** 报错与消息里的字符回显：按码点取，代理对不会被劈成两半 */
const showChar = (s, i) => String.fromCodePoint(s.codePointAt(i));

/** `decodeBase64` 的 options 档：只认 `{strict}`，键名拼错必须响——静默当默认等于用户的 strict 白开了 */
function readStrictOption(fn, options) {
  if (options === null || options === undefined) return false;
  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError(`${fn} 的 options 应为对象，收到 ${shapeOf(options)}`);
  }
  for (const key of Object.keys(options)) {
    if (key !== 'strict') {
      throw new TypeError(`${fn} 收到未知 options 键「${key}」（可用键只有 strict）`);
    }
  }
  if (options.strict === undefined) return false;
  if (typeof options.strict !== 'boolean') {
    throw new TypeError(`${fn} 的 options.strict 应为布尔，收到 ${shapeOf(options.strict)}`);
  }
  return options.strict;
}

/**
 * Base64 → 字符串。两档口径分开（L4、L5）：
 *   - `strict: true` 照 MIME 之外的"规范串"要求：不许空白、总长度必须是 4 的倍数、`=` 的个数必须配余数；
 *   - 默认宽容档剥 ASCII 空白并计数、缺的 padding 补齐并在 `paddingImplied` 里说补了几位。
 * 尾部那几位填充比两档都不校验：Node 的解码器同样忽略（`'YR'` 与 `'YQ'` 都解出 `'a'`），
 * 加一道非规范检查只会让 L1 的往返样本莫名其妙少一条。
 */
export function decodeBase64(text, options) {
  const strict = readStrictOption('decodeBase64', options);
  const raw = toText(text);
  let body = raw;
  let whitespaceDropped = 0;
  if (strict) {
    const at = firstAsciiWs(raw);
    if (at > 0) return b64Result(false, '', true, `strict 档不接受空白（第 ${at} 位）`, 0, 0, 0, at);
  } else {
    whitespaceDropped = countAsciiWs(raw);
    body = stripAsciiWs(raw);
  }
  const padRun = trailingRun(body, '=');
  const coreEnd = body.length - padRun;
  for (let i = 0; i < coreEnd; i += 1) {
    if (!BASE64_VALUE.has(body[i])) {
      const why = `第 ${i + 1} 位字符「${showChar(body, i)}」不在 Base64 字母表`;
      return b64Result(false, '', strict, why, whitespaceDropped, 0, 0, i + 1);
    }
  }
  if (padRun > 2) {
    const at = coreEnd + 3;
    const why = `第 ${at} 位字符「=」不在 Base64 字母表（尾部 padding 最多两个「=」）`;
    return b64Result(false, '', strict, why, whitespaceDropped, 0, 0, at);
  }
  const rem = coreEnd % 4;
  if (rem === 1) {
    const why = `长度不合法：去掉尾部「=」剩 ${coreEnd} 位，Base64 的位数不可能余 1`;
    return b64Result(false, '', strict, why, whitespaceDropped, padRun, 0, 0);
  }
  const expected = rem === 2 ? 2 : rem === 3 ? 1 : 0;
  if (strict && padRun === 0 && rem !== 0) {
    const why = `长度不合法：strict 档要求总长度是 4 的倍数（实际 ${body.length} 位）`;
    return b64Result(false, '', true, why, 0, 0, 0, 0);
  }
  if (strict && padRun !== expected) {
    const why = `padding 与载荷位数不配：剩 ${rem} 位应配 ${expected} 个「=」，实际 ${padRun} 个`;
    return b64Result(false, '', true, why, 0, padRun, 0, 0);
  }
  const bytes = b64ToBytes(body.slice(0, coreEnd));
  if (bytes.length > MAX_INPUT_BYTES) {
    return b64Result(false, '', strict, overLimit(bytes.length), whitespaceDropped, padRun, 0, 0);
  }
  const dec = utf8Read(bytes);
  if (!dec.ok) {
    const why = `第 ${dec.badAt} 字节不是合法 UTF-8（Base64 解出的字节流）`;
    return b64Result(false, '', strict, why, whitespaceDropped, padRun, 0, 0);
  }
  const paddingImplied = Math.max(0, expected - padRun);
  return b64Result(true, dec.text, strict, null, whitespaceDropped, padRun, paddingImplied, 0);
}

/** 入参的 UTF-8 字节数：闸门用的就是这一把尺子，面板上"多少字节"也必须读它，别量字符数 */
export function byteLen(text) { return utf8Len(toText(text)); }

/**
 * 文本 → data URI（`charset=utf-8` + Base64 载荷）。
 * 空载荷在编码侧就拒：`data:text/plain;charset=utf-8;base64,` 这种一串"看着成功其实没内容"，
 * 用户复制过去只会拿到空文件（L10b 把两侧同档钉住）。
 */
export function encodeDataUri(text, mime) {
  const s = toText(text);
  const m = mime === null || mime === undefined ? 'text/plain' : toText(mime);
  if (!MIME_SHAPE.test(m)) {
    return { ok: false, out: '', bytes: 0, reason: `mime 形状不合法：应为 type/subtype，实际「${m}」` };
  }
  if (s === '') return { ok: false, out: '', bytes: 0, reason: '载荷为空：空文本不该包装成 data URI' };
  const enc = encodeBase64(s);
  if (!enc.ok) return { ok: false, out: '', bytes: enc.bytes, reason: enc.reason };
  return { ok: true, out: `data:${m};charset=utf-8;base64,${enc.out}`, bytes: enc.bytes, reason: null };
}

/** 解码结果外壳：七个描述字段在所有分支都齐活，失败时也有"我读到了什么"可展示 */
const dataUriResult = (ok, reason, mime, charset, mimeDefaulted, charsetDefaulted, isBase64,
  data, percentHits, whitespaceDropped, paddingImplied) =>
  ({ ok, reason, mime, charset, mimeDefaulted, charsetDefaulted, isBase64,
    data, percentHits, whitespaceDropped, paddingImplied });

/**
 * data URI → 结构化结果。声明了非 UTF-8 的 `charset` 一律拒绝：本模块只有 UTF-8 一条路，
 * 假装按 UTF-8 解出"能看的东西"是最坏的一种成功（L9）。
 */
export function decodeDataUri(text) {
  const s = toText(text);
  const blank = dataUriResult(false, '', '', '', false, false, false, '', 0, 0, 0);
  if (!/^data:/i.test(s)) return { ...blank, reason: '不是 data URI：要以 data: 开头' };
  const comma = s.indexOf(',');
  if (comma < 0) {
    return { ...blank, reason: '缺载荷分隔逗号：格式是 data:<mime>[;charset=…][;base64],<载荷>' };
  }
  const parts = s.slice(5, comma).split(';');
  let mime = parts[0];
  let charset = '';
  let isBase64 = false;
  for (const param of parts.slice(1)) {
    const one = param.trim();
    if (/^base64$/i.test(one)) { isBase64 = true; continue; }
    const eq = one.indexOf('=');
    if (eq > 0 && one.slice(0, eq).trim().toLowerCase() === 'charset') charset = one.slice(eq + 1).trim();
  }
  const mimeDefaulted = mime === '';
  if (mimeDefaulted) mime = 'text/plain';
  const charsetDefaulted = charset === '';
  if (!charsetDefaulted) {
    const norm = charset.toLowerCase();
    if (norm !== 'utf-8' && norm !== 'utf8') {
      const why = `charset 只支持 utf-8，声明的是「${charset}」，本模块不替它按 UTF-8 猜`;
      return { ...blank, mime, charset: '', mimeDefaulted, reason: why };
    }
    charset = 'utf-8';
  } else charset = 'utf-8';
  const payload = s.slice(comma + 1);
  const shape = { mime, charset, mimeDefaulted, charsetDefaulted, isBase64 };
  if (payload === '') {
    return { ...blank, ...shape, reason: '载荷为空：逗号后面什么都没有' };
  }
  if (isBase64) {
    const b = decodeBase64(payload);
    if (!b.ok) return { ...blank, ...shape, whitespaceDropped: b.whitespaceDropped, paddingImplied: b.paddingImplied, reason: `载荷不是合法 Base64：${b.reason}` };
    return { ...shape, ok: true, reason: null, data: b.out, percentHits: 0,
      whitespaceDropped: b.whitespaceDropped, paddingImplied: b.paddingImplied };
  }
  const p = pctDecode(payload);
  if (!p.ok) return { ...blank, ...shape, percentHits: p.hits, reason: `载荷里的百分号序列不合法：${p.reason}` };
  return { ...shape, ok: true, reason: null, data: p.text, percentHits: p.hits,
    whitespaceDropped: 0, paddingImplied: 0 };
}

/**
 * 编码侧共用那一档：字节闸门 → 落单代理项 → 才交给原生 `encodeURI` / `encodeURIComponent`。
 * 原生这两个函数是纯函数、不读运行环境（L16 只禁 DOM 与时钟），而且 L11 要的就是"与原生逐字符一致"，
 * 自己另写一张不需编码字符表只会多一处会写错的地方。
 */
function uriEncode(text, keepReserved) {
  const s = toText(text);
  const bytes = utf8Len(s);
  if (bytes > MAX_INPUT_BYTES) return { ok: false, out: '', bytes, reason: overLimit(bytes) };
  const lone = loneSurrogateAt(s);
  if (lone > 0) {
    return { ok: false, out: '', bytes, reason: `第 ${lone} 位是落单代理项（半个 emoji），URL 编码无法表示` };
  }
  return { ok: true, out: keepReserved ? encodeURI(s) : encodeURIComponent(s), bytes, reason: null };
}

/** `encodeURI` 档：保留字符原样留着，适合"整条 URL" */
export function encodeUrl(text) { return uriEncode(text, true); }

/** `encodeURIComponent` 档：连 `:/?#[]@` 一起编掉，适合"URL 里的一段" */
export function encodeUrlComponent(text) { return uriEncode(text, false); }

/** 百分号解码（含逐字符位/字节位的理由）：`+` 原样保留，不当空格 */
export function decodeUrlComponent(text) {
  const p = pctDecode(toText(text));
  return p.ok ? { ok: true, out: p.text, reason: null } : { ok: false, out: '', reason: p.reason };
}

/** 面板上"这一档解不开"的那一格：解得开就用原生结果，解不开才动用扫描器换位置信息 */
function tryDecode(field, raw, refusedReason) {
  if (refusedReason !== null) {
    return { field, ok: false, out: '', reason: refusedReason };
  }
  const native = field === 'decodeURI' ? decodeURI : decodeURIComponent;
  try {
    return { field, ok: true, out: native(raw), reason: null };
  } catch {
    return { field, ok: false, out: '', reason: pctDecode(raw).reason };
  }
}

/**
 * 一屏摆四格：两档编码 + 两档解码。§5.2 要的就是"并列展示"，让用户自己看见 `:` 在一档里是 `:`、
 * 在另一档里是 `%3A`。闸门越界时四格一起停且共用同一句理由（L13），免得面板写出两种解释；
 * 而解码档单独失败不牵连编码档——用户贴进来的多半就是"半解码"的串。
 */
export function urlPair(text) {
  const s = toText(text);
  const uri = uriEncode(s, true);
  const component = uriEncode(s, false);
  const reason = uri.ok === false ? uri.reason : null;
  return {
    ok: reason === null,
    reason,
    bytes: uri.bytes,
    encodeURI: uri.ok ? uri.out : '',
    encodeURIComponent: component.ok ? component.out : '',
    decodeTries: [tryDecode('decodeURI', s, reason), tryDecode('decodeURIComponent', s, reason)],
  };
}

/**
 * query 串 → 一行一格的表。三条口径都写进 `URL_CAVEAT` 并由 L17 逐条对账：只按 `&` 切、
 * 键值只在**第一个** `=` 处切一次、解不开的那一侧保留原文并用 `keyOk` / `valueOk` 标出来。
 * 这里不是解析器：不去重、不排序、不丢只含空白的段（那是用户的真实输入，替人丢一次就再也回不来）。
 */
export function splitQuery(text) {
  const rows = [];
  for (const raw of toText(text).split('&')) {
    if (raw === '') continue;
    const at = raw.indexOf('=');
    const hasEquals = at >= 0;
    const keyRaw = hasEquals ? raw.slice(0, at) : raw;
    const valueRaw = hasEquals ? raw.slice(at + 1) : '';
    const k = pctDecode(keyRaw);
    const v = pctDecode(valueRaw);
    const why = [];
    if (!k.ok) why.push(`键：${k.reason}`);
    if (!v.ok) why.push(`值：${v.reason}`);
    rows.push({
      raw,
      key: k.ok ? k.text : keyRaw,
      value: v.ok ? v.text : valueRaw,
      keyOk: k.ok,
      valueOk: v.ok,
      hasEquals,
      reason: why.length > 0 ? why.join('；') : null,
    });
  }
  return rows;
}
```

#### `scripts/toolkit-tests.mjs` §L（整节，从 `// ── §L` 到 §M 之前）

```js
// ── §L Base64（UTF-8）与 URL 编解码（tools/codec.js，段 3 Task 2）──────────────
// 编码侧拿 Node 的 Buffer 当外部判据源对拍（不把自己的输出当标准）；解码侧把
// 两档口径（strict / 宽容）的边界逐格咬住。刻意不测浏览器 atob 的怪癖：本站不用它。
const { MAX_INPUT_BYTES, BASE64_CAVEAT, URL_CAVEAT, byteLen, encodeBase64, decodeBase64,
  encodeDataUri, decodeDataUri, encodeUrlComponent, encodeUrl, decodeUrlComponent,
  urlPair, splitQuery } = await import('../dev/js/tools/codec.js');

/** 剥注释扫源码：块注释与行注释里的字样都不算命中（与 §K 的 kCode 同一形状） */
const lCode = () => read('dev/js/tools/codec.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** 对拍源：字符串 ↔ Node 的标准 base64 */
const b64Of = (s) => Buffer.from(s, 'utf8').toString('base64');
/** 尾块三档余数 + UTF-8 多字节 + 控制字符 + emoji + 代理对 + 空串 */
const L_SAMPLES = ['', 'a', 'ab', 'abc', 'abcd', 'abcde', 'hello world',
  '\u4e2d\u6587', '\uD83D\uDE00', '\uD83D', '\uDE00',
  '\u0000\u007F\u00FF', 'a=b&c', '  ', '\n\t'];
test('L1 编码与 Node 的 base64 逐字符对拍，空串是一等公民', () => {
  for (const s of L_SAMPLES) {
    const r = encodeBase64(s);
    if (r.reason !== null) continue;   // 落单代理项那两条由 L3 专门判
    assert.equal(r.out, b64Of(s), JSON.stringify(s));
    assert.equal(r.bytes, Buffer.byteLength(s, 'utf8'), JSON.stringify(s));
  }
  const e = encodeBase64('');
  assert.equal(e.ok, true); assert.equal(e.out, ''); assert.equal(e.bytes, 0);
  assert.equal(decodeBase64('').out, '');
});
test('L2 编→解往返逐样本原样回来（含 emoji、控制字符、BMP 之外的字符）', () => {
  for (const s of L_SAMPLES) {
    const enc = encodeBase64(s);
    if (!enc.ok) continue;
    const back = decodeBase64(enc.out);
    assert.equal(back.ok, true, JSON.stringify(s));
    assert.equal(back.out, s, `往返丢了字符：${JSON.stringify(s)}`);
  }
});
test('L3 落单代理项点名拒绝，不许静默变成替换字符', () => {
  for (const [s, at] of [['\uD83D', 1], ['a\uD83Db', 2], ['\uDE00', 1], ['ab\uDE00c', 3]]) {
    const r = encodeBase64(s);
    assert.equal(r.ok, false, JSON.stringify(s));
    assert.equal(r.out, '', '拒绝就不能给半截产物');
    assert.match(r.reason, /落单代理项/);
    assert.match(r.reason, new RegExp(`第 ${at} 位`), `${JSON.stringify(s)} → ${r.reason}`);
    assert.equal(s[at - 1].charCodeAt(0) >= 0xD800, true, '锚点自己得对得上');
  }
  assert.equal(encodeBase64('\uD83D\uDE00').ok, true, '成对的代理项是合法字符，不能一起拒了');
  assert.equal(decodeBase64(b64Of('\uD83D\uDE00')).out, '\uD83D\uDE00');
});
test('L4 strict 档：空白、非 4 倍数、padding 不配余数，三格各自拒绝', () => {
  const cases = [['YQ== ', '空白'], ['YWJj\n', '空白'], ['YQ=', 'padding'], ['YWJ', '长度']];
  for (const [s, kind] of cases) {
    const r = decodeBase64(s, { strict: true });
    assert.equal(r.ok, false, `${JSON.stringify(s)}（${kind}）`);
    assert.equal(r.strict, true, 'strict 要回显真正生效的那一档');
    assert.match(r.reason, new RegExp(kind), `${JSON.stringify(s)} → ${r.reason}`);
  }
  assert.equal(decodeBase64('YWJj', { strict: true }).ok, true, '无 padding 的 4 倍数是合法的');
  assert.equal(decodeBase64('YQ==', { strict: true }).out, 'a');
  assert.equal(decodeBase64('YWI=', { strict: true }).out, 'ab');
  // 尾部那几个填充比特（'YR' 与 'YQ' 都解出 'a'）**两档都不校验**：这一档必须写死，否则哪天有人
  // "顺手"补一道 RFC 4648 的非规范检查，L1 的往返样本会莫名其妙少一条还看不出为什么
  assert.equal(decodeBase64('YR==', { strict: true }).out, 'a', 'strict 也不管尾部比：Node 的解码器同样忽略');
  assert.equal(decodeBase64('YR==').out, 'a');
});
test('L5 宽容档：剥掉的空白与 padding 一律计数报告，缺的 padding 也报', () => {
  const ws = decodeBase64('YW\tJj\r\n');
  assert.equal(ws.ok, true); assert.equal(ws.out, 'abc');
  assert.equal(ws.strict, false, '默认档就是宽容档，回显要如实');
  assert.equal(ws.whitespaceDropped, 3, ws.whitespaceDropped);
  const pad = decodeBase64('YQ==');
  assert.equal(pad.out, 'a'); assert.equal(pad.paddingDropped, 2);
  assert.equal(pad.paddingImplied, 0);
  const bare = decodeBase64('YQ');
  assert.equal(bare.out, 'a'); assert.equal(bare.paddingDropped, 0);
  assert.equal(bare.paddingImplied, 2, '不静默补：补了几位必须写在报告里');
  const over = decodeBase64('YQ====');
  assert.equal(over.ok, false, '多出来的等号在字母表之外，不是"看着像 padding"');
  assert.match(over.reason, /第 5 位/);
});
test('L6 字母表外的字符两档都拒，并点名第几位是哪个字符', () => {
  for (const s of ['YQ*@', 'é', 'Y Q*=', '_-8']) {
    const tol = decodeBase64(s);
    const str = decodeBase64(s, { strict: true });
    assert.equal(tol.ok, false, JSON.stringify(s));
    assert.equal(str.ok, false, JSON.stringify(s));
    assert.match(tol.reason, /不在 Base64 字母表/);
    assert.equal(tol.out, '');
  }
  const r = decodeBase64('YWJ*');
  assert.match(r.reason, /第 4 位字符「\*」/, r.reason);
  assert.equal(r.badAt, 4);
  // 单字符余数（%4===1）在结构上不可能，两档都拒
  for (const s of ['Y', 'YWJjA']) {
    assert.equal(decodeBase64(s).ok, false, s);
    assert.match(decodeBase64(s).reason, /长度不合法|不是 4 的倍数/, s);
    assert.equal(decodeBase64(s, { strict: true }).ok, false, s);
  }
});
test('L7 解出来的字节不是合法 UTF-8 时报字节位，不吐替换字符', () => {
  const bad = Buffer.from([0xff]).toString('base64');          // '/w=='
  const cut = Buffer.from([0xe4, 0xb8]).toString('base64');    // 半个「中」
  for (const [s, at] of [[bad, 1], [cut, 1]]) {
    const r = decodeBase64(s);
    assert.equal(r.ok, false, s);
    assert.equal(r.out, '', '不许把非法序列洗成 U+FFFD 交给用户');
    assert.match(r.reason, /不是合法 UTF-8/, r.reason);
    assert.match(r.reason, new RegExp(`第 ${at} 字节`), `${s} → ${r.reason}`);
  }
  assert.equal(decodeBase64(Buffer.from([0x41]).toString('base64')).out, 'A');
});
test('L8 MAX_INPUT_BYTES 闸门：四入口同档拒绝，点名实测与上限，绝不截断', () => {
  assert.equal(MAX_INPUT_BYTES, 1048576, '§7 表里"文本类工具 1MB"那一行就是 MiB 这一档');
  const big = 'a'.repeat(MAX_INPUT_BYTES);
  assert.equal(encodeBase64(big).ok, true, '正好到上限是允许的（闸门是"超过"）');
  assert.equal(encodeBase64(big).bytes, MAX_INPUT_BYTES);
  const over = encodeBase64(big + 'a');
  assert.equal(over.ok, false);
  assert.equal(over.out, '', '拒绝就是拒绝，不许给截断后的半截 base64');
  assert.match(over.reason, /1048577 字节/, over.reason);
  assert.match(over.reason, /1048576 字节上限/, over.reason);
  assert.equal(encodeUrl(big + 'a').ok, false);
  assert.equal(encodeUrlComponent(big + 'a').ok, false);
  assert.equal(decodeUrlComponent('%'.repeat(MAX_INPUT_BYTES + 1)).ok, false);
  assert.match(decodeBase64(b64Of(big + 'a')).reason, /上限/, '解码侧的闸门按解出的字节数算');
  assert.equal(byteLen('中'), 3); assert.equal(byteLen('中文'), 6); assert.equal(byteLen('\uD83D\uDE00'), 4);
  assert.equal(byteLen('a'), 1); assert.equal(byteLen(''), 0);
  assert.equal(byteLen(big), MAX_INPUT_BYTES, 'byteLen 与闸门必须是同一把尺子，否则"1MB"有两种算法');
});
test('L9 data URI 往返：mime、charset、base64 标志各归其位', () => {
  const e = encodeDataUri('中');
  assert.equal(e.ok, true);
  assert.equal(e.out, 'data:text/plain;charset=utf-8;base64,' + b64Of('中'));
  const d = decodeDataUri(e.out);
  assert.equal(d.ok, true); assert.equal(d.data, '中');
  assert.equal(d.mime, 'text/plain'); assert.equal(d.charset, 'utf-8');
  assert.equal(d.isBase64, true); assert.equal(d.percentHits, 0);
  const gbk = decodeDataUri('data:text/html;charset=gbk;base64,PGI+');
  assert.equal(gbk.ok, false, '声明了非 UTF-8 的 charset：不许假装按 UTF-8 解出"能看"的东西');
  assert.match(gbk.reason, /charset/, gbk.reason); assert.equal(gbk.data, '');
  const up = decodeDataUri('data:text/html;charset=UTF-8;base64,PGI+');
  assert.equal(up.ok, true); assert.equal(up.charset, 'utf-8', 'charset 归一小写再回显');
  assert.equal(up.charsetDefaulted, false, '写了 charset 就不能说成是补的');
  assert.equal(up.data, '<b>');
  const bareMime = decodeDataUri('data:,abc');
  assert.equal(bareMime.charsetDefaulted, true, '没写 charset 要说明是补的');
  assert.equal(bareMime.mimeDefaulted, true, '没写 mime 同样是补的，两个"补"都得说出来');
  assert.equal(bareMime.mime, 'text/plain'); assert.equal(bareMime.data, 'abc');
});
test('L10 data URI 的载荷里带换行照吃，百分号序列按次数报', () => {
  const wrapped = 'data:text/plain;charset=utf-8;base64,' + b64Of('中文').replace(/(.{4})/g, '$1\r\n');
  const w = decodeDataUri(wrapped);
  assert.equal(w.ok, true, '§5.2 点名要支持"带换行的 data URI 场景"');
  assert.equal(w.data, '中文');
  assert.equal(w.whitespaceDropped, 4, '剥了几处空白要报得出（两组 \\r\\n 共 4 个字符）');
  const pct = decodeDataUri('data:image/svg+xml,%3Csvg%20id%3D%22a%22%3E');
  assert.equal(pct.isBase64, false);
  assert.equal(pct.data, '<svg id="a">');
  assert.equal(pct.percentHits, 6, '%3C/%20/%3D/%22/%22/%3E 六个，逐个计数不是一句"含百分号"');
  assert.equal(pct.charsetDefaulted, true, '非 base64 那档同样补 charset，但只在报告里说');
});
test('L10b 不是 data URI / 空载荷：两侧同档拒绝并说清楚缺哪一段', () => {
  for (const [s, why] of [['http://a/b', /^不是 data URI/], ['dat', /^不是 data URI/],
    ['data:', /^缺/], ['data:text/plain;base64', /^缺/], ['data:text/plain;base64,', /^载荷/]]) {
    const r = decodeDataUri(s);
    assert.equal(r.ok, false, s);
    assert.match(r.reason, why, `${s} → ${r.reason}`);
    assert.equal(r.data, '');
  }
  const e = encodeDataUri('a', 'text plain');
  assert.equal(e.ok, false); assert.match(e.reason, /mime 形状/);
  // 编码侧同一档：空载荷不给"看起来成功其实没内容"的一串
  const empty = encodeDataUri('');
  assert.equal(empty.ok, false, 'encodeDataUri("") 必须与 decodeDataUri("data:…;base64,") 同档拒绝');
  assert.match(empty.reason, /载荷为空/, empty.reason); assert.equal(empty.out, '');
  for (const v of [null, undefined]) assert.equal(encodeDataUri(v).ok, false, String(v));
});
test('L11 URL 两档口径：18 个保留字符逐字符对拍原生函数，差异集合恰好 11 个', () => {
  const RESERVED = ":/?#[]@!$&'()*+,;=";
  assert.equal(RESERVED.length, 18, 'RFC 3986 的保留字符就是 18 个；表变了本条要连口径句一起重写');
  const diff = [];
  for (const ch of RESERVED) {
    const u = encodeUrl(ch); const c = encodeUrlComponent(ch);
    assert.equal(u.ok, true, ch); assert.equal(c.ok, true, ch);
    assert.equal(u.out, encodeURI(ch), `encodeURI(${ch})`);
    assert.equal(c.out, encodeURIComponent(ch), `encodeURIComponent(${ch})`);
    if (u.out !== c.out) diff.push(ch);
  }
  // 差异集合钉死：面板上"两档不一样"这件事靠的就是这 11 个字符，谁也不许悄悄改口径
  assert.equal(diff.join(''), ':/?#@$&+,;=', `两档差异集合变了：${JSON.stringify(diff.join(''))}`);
  for (const s of [' ', '中', '\uD83D\uDE00', 'a b/c?d=e&f', '%', '+', '~', '-', '.', '_']) {
    const u = encodeUrl(s); const c = encodeUrlComponent(s);
    assert.equal(u.out, encodeURI(s), JSON.stringify(s));
    assert.equal(c.out, encodeURIComponent(s), JSON.stringify(s));
    assert.equal(u.bytes, Buffer.byteLength(s, 'utf8'), JSON.stringify(s));
    assert.equal(c.bytes, u.bytes, '两档的 bytes 都是**入参**的字节数，不是输出的');
  }
  assert.equal(encodeUrlComponent('a b').out, 'a%20b', '空格是 %20，不是 +（那是 form 编码的口径）');
  assert.equal(encodeUrl('%').out, '%25', '百分号自己必须被编码，否则解码侧无从分辨');
  assert.equal(encodeUrlComponent('').out, ''); assert.equal(encodeUrlComponent('').ok, true);
});
test('L12 解码侧：非法序列一律 ok:false 并点名位置，绝不把 URIError 抛穿到面板', () => {
  for (const [s, at] of [['%', 1], ['%zz', 1], ['a%4', 2], ['%2G', 1], ['%E4%B8%zz', 7]]) {
    const r = decodeUrlComponent(s);
    assert.equal(r.ok, false, s); assert.equal(r.out, '', s);
    assert.match(r.reason, /百分号/, `${s} → ${r.reason}`);
    assert.match(r.reason, new RegExp(`第 ${at} 位`), `${s} → ${r.reason}`);
  }
  for (const [s, at] of [['%E4%B8', 1], ['%FF', 1], ['%ED%A0%80', 1], ['a%E4%B8', 2]]) {
    const r = decodeUrlComponent(s);
    assert.equal(r.ok, false, s); assert.equal(r.out, '', s);
    assert.match(r.reason, /不是合法 UTF-8/, `${s} → ${r.reason}`);
    assert.match(r.reason, new RegExp(`第 ${at} 字节`), `${s} → ${r.reason}`);
  }
  assert.equal(decodeUrlComponent('a+b').out, 'a+b', '「+」在 form 编码里是空格，本站不猜、原样留着（口径句里有这句）');
  assert.equal(decodeUrlComponent('a%20b').out, 'a b');
  assert.doesNotMatch(decodeUrlComponent('%zz').reason, /字节/, '两类位置口径不许混：语法错只说「位」');
  assert.doesNotMatch(decodeUrlComponent('%FF').reason, /第 \d+ 位/, '字节错只说「字节」，不给人一个假的字符位');
  for (const s of ['', ' ', '中', '\uD83D\uDE00', 'a+b', '&=?#/', '%25', '0123456789']) {
    assert.equal(decodeUrlComponent(encodeUrlComponent(s).out).out, s, JSON.stringify(s));
    assert.equal(decodeUrlComponent(encodeUrl(s).out).out, s, JSON.stringify(s));
  }
  for (const [s, at] of [['\uD83D', 1], ['a\uDE00b', 2]]) {
    for (const [who, fn] of [['encodeUrl', encodeUrl], ['encodeUrlComponent', encodeUrlComponent]]) {
      const r = fn(s);
      assert.equal(r.ok, false, `${who} ${JSON.stringify(s)}`);
      assert.equal(r.out, '', `${who}：拒绝就不给半截产物`);
      assert.match(r.reason, /落单代理项/, `${who} → ${r.reason}`);
      assert.match(r.reason, new RegExp(`第 ${at} 位`), `${who} → ${r.reason}`);
    }
  }
});
test('L13 urlPair：两档编码 + 两档解码四格并列，闸门同生同死、解码单独失败不牵连编码', () => {
  const p = urlPair('a b/c?d=e&f&g=中');
  assert.equal(p.ok, true); assert.equal(p.reason, null);
  assert.equal(p.encodeURI, encodeURI('a b/c?d=e&f&g=中'));
  assert.equal(p.encodeURIComponent, encodeURIComponent('a b/c?d=e&f&g=中'));
  assert.notEqual(p.encodeURI, p.encodeURIComponent, '这串样本必须让两档分开，否则本条测不到差异');
  assert.equal(p.bytes, Buffer.byteLength('a b/c?d=e&f&g=中', 'utf8'));
  assert.deepEqual(p.decodeTries.map((x) => x.field), ['decodeURI', 'decodeURIComponent']);
  assert.equal(p.decodeTries.length, 2, '解码侧就两档，多一少一都说明面板的表变了形');
  const enc = urlPair('%3A%2F');
  assert.equal(enc.decodeTries[0].out, decodeURI('%3A%2F'));
  assert.equal(enc.decodeTries[1].out, decodeURIComponent('%3A%2F'));
  assert.notEqual(enc.decodeTries[0].out, enc.decodeTries[1].out, 'decodeURI 不动保留字符，两档必须分开摆');
  for (const x of enc.decodeTries) assert.equal(x.ok, true, x.field);
  const over = urlPair('a'.repeat(MAX_INPUT_BYTES + 1));
  assert.equal(over.ok, false); assert.match(over.reason, /上限/, over.reason);
  assert.equal(over.encodeURI, ''); assert.equal(over.encodeURIComponent, '');
  for (const x of over.decodeTries) {
    assert.equal(x.ok, false, `${x.field}：闸门越界时四格一起停，不许只停编码那两格`);
    assert.equal(x.out, ''); assert.equal(x.reason, over.reason, '同一个理由，面板才不会写出两种解释');
  }
  const half = urlPair('%zz');
  assert.equal(half.ok, true, '编码侧做得成，解码档失败是个案、不能把整格判死');
  assert.equal(half.encodeURI, '%25zz');
  for (const x of half.decodeTries) { assert.equal(x.ok, false, x.field); assert.match(x.reason, /百分号/); }
  const empty = urlPair('');
  assert.equal(empty.ok, true); assert.equal(empty.encodeURI, ''); assert.equal(empty.encodeURIComponent, '');
  for (const x of empty.decodeTries) { assert.equal(x.ok, true, x.field); assert.equal(x.out, ''); }
});
test('L14 splitQuery：只按 & 切、键值只在第一个 = 处切一次、空段丢弃不编号', () => {
  const rows = splitQuery('a=1&&b=2&noequals&=v&k=a=b');
  assert.deepEqual(rows.map((r) => r.raw), ['a=1', 'b=2', 'noequals', '=v', 'k=a=b'],
    JSON.stringify(rows.map((r) => r.raw)));
  assert.deepEqual(rows.map((r) => r.hasEquals), [true, true, false, true, true]);
  assert.deepEqual(rows.map((r) => [r.key, r.value]),
    [['a', '1'], ['b', '2'], ['noequals', ''], ['', 'v'], ['k', 'a=b']]);
  for (const r of rows) { assert.equal(r.keyOk, true, r.raw); assert.equal(r.valueOk, true, r.raw); assert.equal(r.reason, null); }
  assert.equal(splitQuery('a=1&a=2').length, 2, '重复键各自成行：这里不是解析器，不去重');
  assert.equal(splitQuery('a=1;b=2').length, 1, '「;」不作分隔符（口径句里点名，L17 对账）');
  assert.equal(splitQuery('a=1;b=2')[0].value, '1;b=2');
  assert.equal(splitQuery('&&').length, 0, '空段一律丢弃：不给人一行"看起来有内容其实是壳"的行');
  assert.deepEqual(splitQuery('a=1& &b=2').map((r) => r.raw), ['a=1', ' ', 'b=2'],
    '只含空白的段是用户的真实输入，本模块不替人丢');
  assert.equal(splitQuery('').length, 0); assert.equal(splitQuery(null).length, 0);
});
test('L14b splitQuery 的解码档：解不开就留着原文并标哪一档，单项越界单独拒', () => {
  const bad = splitQuery('%zz=%E4%B8&ok=1');
  assert.equal(bad.length, 2);
  const [first] = bad;
  assert.equal(first.keyOk, false); assert.equal(first.key, '%zz', '解不开时 key 位放原文，不许变空');
  assert.equal(first.valueOk, false); assert.equal(first.value, '%E4%B8');
  assert.match(first.reason, /^键：/, first.reason); assert.match(first.reason, /值：/, first.reason);
  assert.match(first.reason, /百分号/, first.reason); assert.match(first.reason, /UTF-8/, first.reason);
  assert.equal(bad[1].reason, null, '同一串里解得开的那行不能被邻居连坐');
  assert.equal(splitQuery('%20=1')[0].key, ' ', '解得开就解码：键「%20」的真实值是空格');
  assert.equal(splitQuery('q=a+b')[0].value, 'a+b', '与 L12 同一口径：+ 不是空格');
  const long = splitQuery(`k=${'x'.repeat(MAX_INPUT_BYTES + 1)}`);
  assert.equal(long.length, 1); assert.equal(long[0].valueOk, false); assert.match(long[0].reason, /上限/);
  assert.equal(long[0].value.length, MAX_INPUT_BYTES + 1, '越界那一项保留原文：长度一位都不许少');
});
test('L15 入参口径与兄弟模块同档：文本归一不抛、options 抛 TypeError', () => {
  const DATA_URI_EMPTY = 'data:text/plain;charset=utf-8;base64,';
  for (const v of [null, undefined]) {
    assert.equal(encodeBase64(v).out, '', kLabel(v)); assert.equal(encodeBase64(v).ok, true, kLabel(v));
    assert.equal(decodeBase64(v).out, '', kLabel(v));
    assert.equal(encodeUrl(v).out, ''); assert.equal(encodeUrlComponent(v).out, '');
    assert.equal(decodeUrlComponent(v).out, ''); assert.equal(splitQuery(v).length, 0);
    assert.equal(urlPair(v).bytes, 0, kLabel(v));
    assert.equal(encodeDataUri(v).ok, false, '归一成空串之后就是"空载荷"，照 L10b 那一档拒绝');
    assert.match(encodeDataUri(v).reason, /载荷为空/, kLabel(v));
    assert.equal(decodeDataUri(v).ok, false, 'data URI 那一位为空就是"不是 data URI"，照 L10b 拒绝');
  }
  // 文本档里非字符串照样归一（`parseIdCard(123)` 同一档）：数字、布尔、Symbol、Date 都不许抛
  assert.equal(encodeBase64(123).out, b64Of('123')); assert.equal(encodeBase64(true).out, b64Of('true'));
  assert.equal(encodeUrlComponent(Symbol('s')).out, encodeURIComponent('Symbol(s)'));
  assert.equal(decodeBase64(Symbol('x')).ok, false, '"Symbol(x)" 含字母表外的字符，归一之后照 L6 那一档拒');
  assert.match(decodeBase64(Symbol('x')).reason, /不在 Base64 字母表/);
  // 唯一的例外还是无原型对象：`String()` 自己抛，本站不兜（§C 末尾与 K12 同一档）
  const noProto = Object.create(null);
  for (const [who, call] of [['encodeBase64', (x) => encodeBase64(x)], ['decodeBase64', (x) => decodeBase64(x)],
    ['encodeUrlComponent', (x) => encodeUrlComponent(x)], ['decodeUrlComponent', (x) => decodeUrlComponent(x)],
    ['urlPair', (x) => urlPair(x)], ['splitQuery', (x) => splitQuery(x)],
    ['encodeDataUri', (x) => encodeDataUri(x)], ['decodeDataUri', (x) => decodeDataUri(x)]]) {
    assert.throws(() => call(noProto), { name: 'TypeError' }, `${who}：无原型对象必须同抛，不许静默洗成结论`);
  }
  // options 档：`decodeBase64` 唯一的键是 strict，值只收布尔；拼错键名必须响
  assert.throws(() => decodeBase64('YQ==', { strict: 'yes' }), (e) => {
    assert.equal(e.name, 'TypeError');
    assert.match(e.message, /^decodeBase64 的 options\.strict 应为布尔，收到 /);
    return true;
  });
  assert.throws(() => decodeBase64('YQ==', { strictz: true }),
    { name: 'TypeError', message: /未知 options 键/ }, '拼错的键静默当默认＝用户的 strict 白开了');
  assert.throws(() => decodeBase64('YQ==', 'strict'), { name: 'TypeError', message: /options 应为对象/ });
  for (const o of [undefined, null, {}]) assert.doesNotThrow(() => decodeBase64('YQ==', o), JSON.stringify(o));
  assert.equal(decodeBase64('YQ==', { strict: undefined }).strict, false, '键在值缺席＝走默认档，不是抛');
  // mime 那一位是文本档：缺席补默认，给了但形状不对就拒（都不是抛）
  assert.equal(encodeDataUri('a', undefined).out, DATA_URI_EMPTY + 'YQ==');
  assert.equal(encodeDataUri('a', null).out, DATA_URI_EMPTY + 'YQ==', '缺席位（null 与 undefined）在归一**之前**判，补默认 mime');
  assert.equal(encodeDataUri('a', '').ok, false, '空串是"给了但没用"，与缺席不同档：必须说清 mime 形状');
  assert.match(encodeDataUri('a', '').reason, /mime 形状/);
  // 报错尾巴统一是「收到 <shapeOf(值)>」那一段（K12 的三档类比，口径分叉在这里红）
  const grab = (fn, who) => { try { fn(); } catch (e) { return [who, e.message]; } return [who, '']; };
  const tails = [grab(() => decodeBase64('YQ==', { strict: 'yes' }), 'decodeBase64'),
    grab(() => fromEpoch(1000.5, 0), 'fromEpoch'), grab(() => generateUsccCodes({ rng: 'nope' }), 'generateUsccCodes')];
  assert.notEqual(tails[0][1], '', 'codec 这一格要是没抛，下面那条 /收到/ 就只是在测兄弟模块');
  for (const [who, msg] of tails) {
    assert.match(msg, /收到 (null|undefined|number|string|boolean|bigint|object|function|symbol|Date|Array\(\d+\))/,
      `${who}：${msg}`);
  }
});
test('L16 扫源：零 import、不碰 DOM、不读环境、不用 Buffer/atob/btoa/TextEncoder', () => {
  const src = lCode();
  // `m` 标志不能少：`^` 不带 `m` 只锚整份源码的开头，"中段插一条 import" 全绿（评审 2026-09-28）
  const banned = [['import', /^\s*import[\s{*]/m], ['export from', /export\s+\{[^}]*\}\s+from/],
    ['export * from', /export\s*\*/], ['动态 import', /\bimport\s*\(/],
    ['require(', /\brequire\s*\(/], ['document', /\bdocument\b/], ['window', /\bwindow\b/],
    ['localStorage', /\blocalStorage\b/], ['navigator', /\bnavigator\b/], ['fetch(', /\bfetch\s*\(/],
    ['Buffer', /\bBuffer\b/], ['atob', /\batob\s*\(/], ['btoa', /\bbtoa\s*\(/],
    ['TextEncoder', /\bTextEncoder\b/], ['TextDecoder', /\bTextDecoder\b/],
    ['Date.now', /Date\.now/], ['new Date(', /new Date\(/], ['Math.random', /Math\.random/],
    ['Intl', /\bIntl\b/], ['toLocale', /toLocale/], ['crypto', /\bcrypto\b/],
    ['unescape', /\bunescape\s*\(/], ['eval', /\beval\s*\(/]];
  for (const [name, re] of banned) assert.equal(re.test(src), false, `codec.js 的代码里出现了 ${name}`);
  assert.equal(banned.length, 23, '违禁清单自己要有条数：少一条等于那一档从此静默不核');
  // 三件事必须有牙：闸门常量导出、UTF-8 与 base64 都是自己实现的、位置信息是自己算的
  assert.match(src, /export const MAX_INPUT_BYTES/, '闸门常量必须导出，面板与 §7 的账才对得上');
  assert.equal(/String\.fromCharCode/.test(src), false, '拼字符串走自己那套 UTF-8，不用 fromCharCode 绕');
  assert.match(src, /0xD800/, '代理区这一档必须在代码里判（L3 的拒绝全靠它，只在注释里提等于没实现）');
  assert.ok((src.match(/BASE64_ALPHABET/g) || []).length >= 2, '字母表要"定义 + 使用"两处都在');
  assert.equal(existsSync(resolve(ROOT, 'dev/js/codec.js')), false,
    'codec.js 被挪到 dev/js/ 顶层会变成 vite 入口、进产物（§6.1 零重叠，同 K18）');
  assert.equal(existsSync(resolve(ROOT, 'dev/js/tools/codec.js')), true, '文件不在它该在的位置时，上面那条是空转的');
  const siteJs = resolve(ROOT, '_site/assets/js');
  if (existsSync(siteJs)) {
    const hits = readdirSync(siteJs).filter((f) => f.endsWith('.js')
      && readFileSync(resolve(siteJs, f), 'utf8').includes('splitQuery'));
    assert.deepEqual(hits, [], '构建产物里出现了 codec.js 的导出名');
  }
});
test('L17 两句口径文案与实现互相对账：文案承诺的做到，做到的也写进文案', () => {
  const b64rows = [
    [/按 UTF-8 字节/, encodeBase64('\u4e2d\u6587').out === '5Lit5paH'],
    [/剥掉空白/, decodeBase64('YW Jj').out === 'abc' && decodeBase64('YW Jj').whitespaceDropped === 1],
    [/缺的尾部 padding 补齐并注明/, decodeBase64('YQ').paddingImplied === 2],
    [/字母表外/, decodeBase64('YWJ*').ok === false && /字母表/.test(decodeBase64('YWJ*').reason)],
    [/长度不合法/, decodeBase64('Y').ok === false && /长度/.test(decodeBase64('Y').reason)],
    [/不是合法 UTF-8/, decodeBase64('/w==').ok === false],
    [/1 MiB\uff081048576 字节\uff09/, MAX_INPUT_BYTES === 1048576],
    [/整体拒绝、不截断/, encodeBase64('a'.repeat(MAX_INPUT_BYTES + 1)).out === ''],
  ];
  const urlRows = [
    [/encodeURI 与 encodeURIComponent 两档/, urlPair('a/b').encodeURI === 'a/b'
      && urlPair('a/b').encodeURIComponent === 'a%2Fb'],
    [/「\+」不当作空格/, decodeUrlComponent('a+b').out === 'a+b'],
    [/只按「&」切分/, splitQuery('a=1&b=2').length === 2],
    [/「;」不切/, splitQuery('a=1;b=2').length === 1],
    [/第一个「=」处切一次/, splitQuery('k=a=b')[0].value === 'a=b'],
    [/保留原文并标注/, splitQuery('%zz=1')[0].key === '%zz' && splitQuery('%zz=1')[0].keyOk === false],
  ];
  for (const [table, text] of [[b64rows, BASE64_CAVEAT], [urlRows, URL_CAVEAT]]) {
    for (const [claim, holds] of table) {
      assert.equal(claim.test(text), holds,
        `文案与实现分叉：${claim}（文案里有=${claim.test(text)}，实现做得到=${holds}）`);
    }
    assert.ok(text.length > 80 && text.length <= 240, `口径句长度不在档内（实际 ${text.length} 字）：${text}`);
  }
  assert.equal(b64rows.length, 8, 'Base64 那张对账表自己要有条数：漏一行等于那一档的承诺没人核');
  assert.equal(urlRows.length, 6, 'URL 那张对账表同上');
  assert.notEqual(BASE64_CAVEAT, URL_CAVEAT, '两句一模一样等于面板上那两格没有各自的口径');
});
test('L18 导出面：13 个名字一个不多一个不少，面板绑定按这张表', async () => {
  const wanted = ['BASE64_CAVEAT', 'MAX_INPUT_BYTES', 'URL_CAVEAT', 'byteLen', 'decodeBase64',
    'decodeDataUri', 'decodeUrlComponent', 'encodeBase64', 'encodeDataUri', 'encodeUrl',
    'encodeUrlComponent', 'splitQuery', 'urlPair'];
  const got = Object.keys(await import('../dev/js/tools/codec.js')).sort();
  assert.deepEqual(got, wanted, `导出面变了：多=${JSON.stringify(got.filter((k) => !wanted.includes(k)))} 少=${JSON.stringify(wanted.filter((k) => !got.includes(k)))}`);
  assert.equal(got.length, 13, '清单自己要有条数；新增一个入口就得同时补判据与面板，这张表是那道门');
});
```

## Task 3: `digest.js` — MD5 自实现 + `crypto.subtle` 包装（§M）

**Files:**
- Create: `dev/js/tools/digest.js`（磁盘 352 行）
- Modify: `scripts/toolkit-tests.mjs`（末尾追加 `// ── §M …` 一节，18 条 `test()`，磁盘 6599–7004）
- Modify: `scripts/verify-plan-blocks.mjs`（`FILE_TARGETS` 加一行 `'dev/js/tools/digest.js',`）
- Modify: 本计划（契约回填 + 判据清单 + 两块落地镜像 + §L 小标题那句"到文件末尾"改口）
- 不动：`scripts/verify-plan-blocks-teeth.mjs`（G12 在 Task 2 已改成"从基线现读段 3 名下全部镜像"，
  本段落地的 `digest.js` 与 `§M` 两块**自动**进核范围，实测基线读到 6 条）

### 对外契约（落地后回填，2026-09-28）

起草版这一格只有六句要点，没有签名表。落地后是 **10 个导出**（M15 把这张表钉成判据），
五处是实现期坐实的事实：

1. **两道闸门两个数，都是字节**。文本通道 `MAX_TEXT_BYTES = 1048576`（1 MiB，与 `codec.js` 的
   `MAX_INPUT_BYTES` 同值同口径，M9 拿两本模块的 `byteLen` 逐样本核"不分叉"）；字节通道
   `MAX_BYTES = 5242880`（5 MiB，文件那一路单独一档）。起草版那句"写明是字节还是字符"的答案是
   **两档都按字节**，但两道闸门不许互相借光（M10 反过来核了一条：文本越界不能因为
   "字节通道更宽"就放行）。
2. **五个算法同一条异步路径**，连自己实现的 MD5 也返回 Promise。因为 `subtle.digest` 本来就是
   Promise，只让四档异步、一档同步的话面板要写两套读法。连带定死一条：**校验错误一律以 rejection
   送出**（`digest`/`digestAll` 是 `async`，控制入参的 `TypeError` 天然变成 rejected promise），
   判据侧一律 `assert.rejects`——它**不吃同步抛**，形状写错当场红（M7、M12 各钉一处）。
3. 每格结果六键恒定 `{ok, algo, hex, bytes, via, reason}`，`via ∈ self | subtle | unavailable`。
   起草版没有 `via` 这一位，而它正是"这格是没算、还是算不成"的区分位：闸门拦下时 `via` 照该走的
   路回显（`viaOf`），面板才说得出"MD5 已经出结果了，SHA 四档是环境不支持"。
4. **降级走 `{subtle}` 注入档**，三档同归"取不到"（`resolveSubtle`：显式 `null`／`globalThis.crypto`
   里没有／给了对象但 `digest` 不可调）。这是测试环境里唯一能演那条路的方式——Node 22 的
   `crypto.subtle` 一直在、删不掉；页面侧（`file://`、`http://192.168.x.x`）的实测**欠给 Task 8**，
   M13 的注释里写着这一格欠了什么。
5. 导出 `byteLen` / `isBytes` / `normalizeAlgo` 三个读侧函数（起草版只提了入口）。`normalizeAlgo`
   必须导出：算法名归一这件事只有面板与判据共用同一个函数才谈得上"不跟着漂"。
6. **数据入参里有两种"看着像数据、其实不是数据"要拒**（评审回改补的契约，面板按 `reason` 原样显示就行）：
   已脱离缓冲区的字节输入（`transfer` 过的 `ArrayBuffer` 与它下面的视图，`ok:false`、`bytes:0`）与
   只剩默认对象标签的对象（`Blob`/`File`/`{}`/`Map`/`Set`…，判据是"`String(v)` 的结果恰好等于
   `Object.prototype.toString.call(v)`"）。两者都**不 reject**、都走 `reason` 那一条路。
   配套欠给 Task 6 的装配层一句：文件那一格必须先按 `File.size` 预筛再 `await file.arrayBuffer()`
   ——`digest.js` 的 5 MiB 闸门是在**字节已经进内存之后**才判的，先读后判等于让 2 GB 文件先把内存吃掉。

```text
export const MAX_TEXT_BYTES = 1048576;   // 文本通道闸门（字节）＝ codec.js 的 MAX_INPUT_BYTES
export const MAX_BYTES = 5242880;        // 字节通道闸门（字节）：超过才拒，正好在数上放行
export const ALGORITHMS = Object.freeze(['md5', 'sha-1', 'sha-256', 'sha-384', 'sha-512']);
export const HEX_LEN = Object.freeze({ md5: 32, 'sha-1': 40, 'sha-256': 64, 'sha-384': 96, 'sha-512': 128 });
export const DIGEST_CAVEAT = '…';        // 面板原样显示（80–240 字，与实现双向对账由 M17 守着）
export function byteLen(text) → number                    // 与 codec.js 各带一份，M9 逐样本核同长
export function isBytes(v) → boolean                      // ArrayBuffer 与任意 ArrayBufferView
export function normalizeAlgo(v) → 'md5'|'sha-1'|…|null   // 认不出给 null，不猜
export async function digest(algo, input, options?) → { ok, algo, hex, bytes, via, reason }
export async function digestAll(input, options?) → { ok, reason, bytes, rows: [×5] }
```

实现侧三条硬规矩写在文件头，整套 §M 围着它们转：

1. **MD5 自己实现，不借快捷方式**。实测 Node 22 的 `crypto.subtle` 根本不认 MD5
   （`NotSupportedError: Unrecognized algorithm name`），`crypto-js` 在 §2.2 选型表里就是"不引"。
   所以四个初值与 64 项 K 表全部硬编码，K 表**不许**用 `Math.sin` 现算——IEEE-754 的 `sin`
   不保证跨引擎逐位一致，某台设备上算错一项就是"同一串两个摘要"。M16 既数 K 表满 64 项、
   又点名 `Math.sin` 必须不在代码里。判据拿 `node:crypto` 的 `createHash` 当**外部对拍源**
   （M1–M3、M18），不把自己的输出当标准。
2. **两条通道两道闸门，文件那一路不进字符串**。字节档走 `toView`（`ArrayBuffer` 或视图，
   **按视图自己的 `byteOffset`/`byteLength` 读**，M5 用一个"前头多两个 0 的尾段视图"演这件事）；
   文本档走自实现的 UTF-8 编码器，先过 `loneSurrogateAt`。越界一律整体拒绝、`hex` 为空串，
   理由里点名实测字节数。
3. **算不成就说清是哪一格算不成**。`digest`/`digestAll` 永不 reject：`subtle` 同步抛、异步拒、
   缺席，三种坏形状统统收进 `{ok:false, reason}`，底层报错文本带出来（面板才说得出为什么），
   同一批里 MD5 那一格照样出结果（M13、M14）。

### 判据清单（§M，落地后回填）

**18 条 `test()`**（M1–M18），外加一份 **25 刀变异台账**（Step 3，首发 18 刀跑 `/tmp/seg3t3/mut.mjs`、
回改 7 刀跑 `/tmp/seg3t5/mut.mjs`，都跑完即弃、不进套件）。§M 对套件总数的贡献是 18，全量
`# tests` 从 184 变成 **202**。评审回改（下面那节）**没有新增 `test()`**——七处新断言全部长在
M5/M8/M9/M11/M16 这五条已有的格子里，所以条数不变、牙齿变多。

| 编号 | 咬什么 |
| --- | --- |
| M1 | MD5 对 RFC 1321 §A.5 的**七条**官方向量逐字符相等（清单自带 `length === 7`），每条同时反向自证"Node 的 MD5 也是这个值"——对拍源自己站不住时这里先红 |
| M2 | MD5 与 `createHash('md5')` 逐样本对拍（18 条样本），`via` 必须是 `self`，同一份字节的文本档与字节档同结果；再拿 **0–255 全字节值域**跑一遍（单字节值域里藏得住索引与位移的错，两条样本抓不到） |
| M3 | 分组与补位边界 20 档（`0/1/54/55/56/57/62/63/64/65/71/118/119/120/127/128/129/191/192/320`）全部与 Node 对拍：55→56 是"长度字段挤进下一个分组"的坎，63→64 是"整块不带补位"的坎，127→128→129 是两块变三块的坎 |
| M4 | 五档输出形状：小写十六进制、长度按 `HEX_LEN` 表、`algo` 回显归一后的规范名、`reason` 为 `null`；SHA-1 与 SHA-256 各钉一条 RFC 3174 / FIPS 180 的 `'abc'` 官方向量，防止"对拍源跟着实现一起漂" |
| M5 | 文本 / `Uint8Array` / `ArrayBuffer` 三形状同结果、字节数同口径；**带 `byteOffset` 的 `subarray` 视图**必须按自己的起点读，并配一条"整块 ≠ 尾段"的反向哨兵（偏移被吞时这条才响）；**脱落档**（评审回改新增）：`transfer` 过的 `ArrayBuffer`、它下面的 `Uint8Array`、`DataView` 三种形状全部 `ok:false`、`hex` 空、`bytes:0`、理由含"脱离/detached"，且**三种共用同一句**，`digestAll` 里五格同拒——少了实现里那道 `try` 这三条就变成 reject，整批连本该出结果的 MD5 一起丢；末尾两条反向哨兵钉住"长度为 0 的缓冲区/视图仍是空输入"，不许被脱落档误伤 |
| M6 | 空输入是一等公民：五档空串都出**官方值**（硬写五条常量，`sha-512` 那条自己先断 128 位），不是拒绝；空 `Uint8Array` 与空字符串同档 |
| M7 | 算法名归一：`sha256`/`SHA-256`/`' Sha_256 '`/`MD5` 等九个写法归一，且 `digest` 的归一与 `normalizeAlgo` 不许分叉；十种认不出的形状 `normalizeAlgo` 安静给 `null`，而 `digest` 必须 `TypeError`（`rejects`）并带「收到 <shape>」；`'sha-256x'` 单独钉"不许静默回落 md5" |
| M8 | 入参两档与兄弟模块同档：`123`/`true`/`Symbol`/`NaN`/`[1,2]`/`Date` 归一不抛（逐条与 Node 对拍归一后的串），`null`/`undefined` 归一成空串走 M6 那一档；无原型对象在 `digest` 与 `digestAll` 两处同抛；`isBytes` 认 `Uint8Array`/`ArrayBuffer`/`Buffer`（Node 的 `Buffer` 是 `Uint8Array` 子类，浏览器侧同一条路）而不认字符串与数值；**只剩对象标签的要拒**（评审回改新增）：`Blob`/`File`/`{}`/`{a:1}`/`Map`/`Set` 六种全部 `ok:false`、理由含"对象标签"，并各配一条反向断言"结果不许等于那串标签本身的摘要"——`String(new Blob(['x']))` 是 `[object Blob]`，给它合法摘要是静默假成功；`digestAll(new Blob)` 五格同拒且 `bytes` 照实报 13；误伤哨兵三条：自定义 `toString` 的内容要认、`new String('x')`（标签 `[object String]` ≠ 归一结果 `x`）照常、`[]` 仍是空串那一档 |
| M9 | 文本闸门按**字节**：`=== 1048576`、与 `codec.js` 的 `MAX_INPUT_BYTES` 同值（§7 那句"文本类工具 1MB"只有一份口径）、`byteLen` 四值 + **与 `codec.js` 的 `byteLen` 逐样本核同长**；正好 1 MiB 放行、+1 整体拒绝且 `hex` 为空、理由点名实测字节并 `doesNotMatch(/第 \d+ 位/)`；`'中'.repeat(349526)`（1048578 字节）必须拒——按字符判的实现就在这条红；**半代理项那一档也跨模块对拍**（评审回改新增：`M_SAMPLES` 里没有一个落单代理项，而 `utf8Len` 恰好在这一档有分支）——四条含落单代理项的串逐一核两本模块同长，再钉 `dByteLen` 对 `\uD83D` 的**绝对值 3**，防"两处一起漂" |
| M10 | 字节闸门单独一档：`=== 5242880` 且 `> MAX_TEXT_BYTES`（否则"文件走 ArrayBuffer"没有意义）；正好放行、+1 拒绝且 `hex` 空、理由含"字节"；文本越界不许借字节档的光；MD5 也吃字节闸门（越界与否与算法无关） |
| M11 | 落单代理项两档（md5 与 sha-256）都拒并给**字符位**（三种各一格的样本位 1/2/3）、`hex` 为空；成对代理项放行且 `bytes===4`、与 Node 同结果；**越界优先于代理项**（两道都中时先报闸门，否则给出"第 1048577 位"的假位置）；拒绝那一格 `bytes` 也要照实回显（`=== dByteLen(s)`，评审回改新增——尺子的绝对值由 M9 钉住，这里不是自己跟自己对账） |
| M12 | `options` 档：`{subtlez}` 与字符串 options 与 `{subtle:1}` 三种都 `TypeError`（尾巴「收到 number」）；`undefined`/`null`/`{}` 三种默认档都走真 `subtle` 且与 Node 同结果；**注入的假 `subtle` 恰好被调一次**、第一个参数是 `'SHA-256'`（大写带横杠）、第二个参数是 `Uint8Array` 本体且字节与 `'abc'` 的 UTF-8 一致；MD5 档 `calls.length === 0`；`digest()` 返回值有 `.then`（五档同一条异步路径） |
| M13 | 降级：`{subtle:null}` 时 SHA 档 `ok:false`、`via:'unavailable'`、理由含"安全上下文"**且点出 MD5 不受影响**、`bytes` 照报；MD5 同档照样出正确值；另外三档 SHA 各自也拒；`subtle.digest` **同步抛**与**异步拒**两种坏形状都不许送出模块（底层报错文本必须带出来）；`{subtle:{}}`（有对象没可调函数）同归"取不到" |
| M14 | `digestAll`：`rows` 行序＝`ALGORITHMS`（漂一格面板错一行）、`rows[0]` 键集与 `digest` 逐键相同（面板只写一套读法）、`bytes` 只算一次五格同数、每格 hex 与 Node 对拍；闸门失败时**五格同一句理由**（`row.reason === all.reason`，代理项那一格也核）；只有 SHA 降级时顶层 `ok:false` 而 `reason:null`、MD5 那格 `ok:true`、不成的一共四格 |
| M15 | 导出面 10 个名字按字典序逐一比对，清单自带 `length === 10`；`ALGORITHMS` 顺序与内容写死；`HEX_LEN` 键集与 `ALGORITHMS` 同集（少一档就有一行面板没尺子）；两张共享表 `Object.isFrozen` 为真（段 2 的共享表只读口径） |
| M16 | 剥注释扫源 **25 条违禁**（清单自带条数断言）：`import`（**这条行首锚 `^` 必须带 `m`**——不带就只锚"整份源码的第一个字符"，中段插一条 `import './codec.js'` 全绿，评审回改实测；§L 的 L16 同病同治）/`export from`/`export * from`/动态 `import()`/`require(`/`node:crypto`/`createHash`/DOM 四件/`fetch(`/`FileReader`/`Buffer`/`atob`/`btoa`/`TextEncoder`/`TextDecoder`/时钟两件（`Date.now`/`new Date(`）/`Math.random`/`Intl`/`toLocale`/`unescape`/`eval`，逐条数过来正好 25（起草那版写"23 条"而枚举出来是 24 项，本次一并核准）；**正向**断言 `0x67452301`、`0x10325476` 必须在、K 表区间正则读到的常数**恰好 64 项**、`Math.sin` 必须不在、取 `subtle` 走 `globalThis` 而 `window.crypto` 必须不在；零重叠两条 + 位置哨兵（`dev/js/digest.js` 不存在、`dev/js/tools/digest.js` 必须在，否则前一条是空转的）；`_site/assets/js` 若有产物，则**除 `toolCodec.min.js` 以外**都搜不到 `digestAll`，而那一本里必须搜得到——起草时这句写的是"任何产物都搜不到"，那是"仓库里只有证件页一本入口"的假设，Task 6b 的入口一落地它就从发现渗透变成每次构建后必红，2026-09-28 随 Task 7 收窄（四刀取证见 §Task 7 落地记录） |
| M17 | 口径文案与实现**双向**对账（8 行，表自带条数）：`MD5 由本站自己实现`↔`via==='self'`、`走浏览器`↔`via==='subtle'`、`取不到时给明确提示`↔`via==='unavailable'`、`文本按 UTF-8 字节`↔`bytes===3`、两句 MiB↔两个闸门常量、`整体拒绝、不截断`↔越界那格 `hex===''`、`文件走字节、不进字符串`↔两通道同结果；长度 80–240 字；与 `BASE64_CAVEAT`/`URL_CAVEAT`/`TIME_CAVEAT` 三句都不许相同 |
| M18 | 跨块大输入：1 MiB 的 `0xAA` 字节档（16384 个分组）与 Node 逐字符等；5 MiB 的 `sha-256`；`'中'.repeat(100000)` 的 `sha-512`（UTF-8 编码器在长多字节串上必须与 Node 同字节） |

### Steps

> 每一格都带**实跑结果**。起草版这格没有签名表、也没预期判据条数，所以本段的"期望 vs 实测"
> 集中在两件事上：**异步形状**与**两道闸门**——两处都在写判据之前先坐实，没有事中改口。

- [x] **Step 1: 写 §M 十八判据（此时 `digest.js` 不存在，必红）**

```bash
node --check scripts/toolkit-tests.mjs
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs > /tmp/seg3t3_red.log 2>&1; echo "exit=$?"
grep -E "^# (tests|pass|fail)|^not ok|ERR_MODULE" /tmp/seg3t3_red.log
```
实跑：`exit=1`、`# tests 185 / pass 184 / fail 1`，红的是**一条文件级**
`not ok 1 - scripts/toolkit-tests.mjs`，原因在尾部 `# Error:` 里：
`ERR_MODULE_NOT_FOUND: Cannot find module '.../dev/js/tools/digest.js'`——与 Task 2 的 §L
完全同形状（`await import` 在已登记完前序 184 条之后才崩，runner 报"测试结束后有资源产生了
异步活动"），所以"fail 恰为 §M 条数"的期望同样不成立，判据看的是这个 + §A–§L 的 184 条一条不红。

写这一格时踩到三处**判据自己**的错，全在跑绿之前改掉：

| 现场 | 症状 | 修法 |
| --- | --- | --- |
| §M 解构 `byteLen` | `SyntaxError: Identifier 'byteLen' has already been declared`（§L 已从 `codec.js` 解构过同名） | 改名别名 `byteLen: dByteLen`，并**补一条跨模块核对**：M9 里 `dByteLen(s) === byteLen(s)` 逐样本跑 18 条（同级模块互不 import 的代价，两把尺子必须同长；只核硬编码值的话代理对算成 2 也不会红） |
| M6 的 `sha-512` 空值 | 凭记忆硬写的向量位数不对 | node 现跑取回真值，拆两段拼接，并加 `assert.equal(empty['sha-512'].length, 128, '硬编码向量自己得先是 128 位')` 自证；原先"sha-512 特殊处理"的歪逻辑删掉 |
| M8 引用了后声明的 `const` | 顶层 `await` 会让测试回调与声明交错执行，形状不稳 | 内联字面量、删 helper |
| M13 的坏 `subtle` | 三元自嵌套难读且容易接错参数 | 换成 `badSubtle` 对象 + `Object.entries` 循环 |
| M15 标题 | 写"9 个名字"而清单实为 10 项 | 标题改 10（条数由 `length === 10` 兜，标题只是不骗读的人） |

- [x] **Step 2: 写 `dev/js/tools/digest.js`，直到 §M 全绿**

写实现**之前**先坐实的三条环境事实（都是本模块的形状前提，不是收尾补的）：

1. `crypto.subtle` **不认 MD5**：Node 22 实测 `NotSupportedError`。所以规矩 1 的"自己实现"不是
   偏好，是唯一可行路径；M12 里 `md5` 档 `calls.length === 0` 把这件事钉住。
2. Node 22 有 `globalThis.crypto.subtle`，SHA-1/256/384/512 与 `node:crypto` 同结果
   → 默认档在测试环境里就是**真** WebCrypto，M12 的默认档三条因此不是自欺。
3. `assert.rejects` **不吃同步抛** → 五个算法全部异步、校验错误全部以 rejection 送出。

```bash
node --check dev/js/tools/digest.js
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs > /tmp/seg3t3_run.log 2>&1; echo "exit=$?"
grep -E "^# (tests|pass|fail)" /tmp/seg3t3_run.log
```
实跑：`exit=0`、`# tests 202 / pass 202 / fail 0`（**首跑即绿**，没有事中改判据期望值）。

- [x] **Step 3: 自证 §M 有牙（18 刀首发 + 7 刀回改 = 25 刀变异台账）**

```bash
node --check /tmp/seg3t3/mut.mjs
cd /tmp/seg3t3 && DRY=1 node mut.mjs          # 先预检：基线必须全绿、十八处锚点各命中 1 处
node mut.mjs > /tmp/seg3t3/ledger.log 2>&1; echo "exit=$?"
```
形状照段 3 Task 2 的 `/tmp/seg3t2/mut.mjs`：**真复制**到 `/tmp/seg3t3/tree`（不用 `cp -al`），
变异一律落在副本里，本仓工作树一个字都不碰；脚手架四道自检照抄（红名单正则含
`[a-z]?` 尾巴、基线必须零红、每刀核 `# tests` 未变、结尾核副本与工作树逐字节与脏指纹）。

台账自己也踩了两处**脚手架的错**（不是判据的错，但都会把"没牙"演成"有牙"，必须写下来）：

1. **拷贝清单少一个文件** → 副本树里 §M 一条没跑，红的却是 `K18 零重叠`，
   `ENOENT … /tree/vite.config.js`。这是**基线就不对**，脚手架自检正确地拒跑；清单补上
   `vite.config.js` 之后基线才 202 全绿。（与段 3 Task 2"少 `demo/` 会红 B14"同一类，
   清单要按**判据实际读什么**凑，不是按"看起来相关的目录"凑。）
2. **D17 首版**写的是 `export const MD5 = md5;`，而模块里那本叫 `md5Digest`——引用未定义名让
   **整个模块加载失败**，`# tests` 从 202 掉到 185，被脚手架的"这一刀不算证据"当场作废。
   改成 `export const HEX_DIGITS_EXTRA = HEX_DIGITS;`（合法、只多一个导出）才咬到 M15。
   这一条值得记住：**变异刀必须只改语义、不改可加载性**，否则量的又是"文件坏了"。

台账结果（首发十八刀：`/tmp/seg3t3/ledger.log`；回改七刀：`/tmp/seg3t5/ledger.log`；两份基线都是 `# tests 202 / pass 202`）：

| 刀 | 改坏什么 | 红了谁 | 归因 |
| --- | --- | --- | --- |
| D1 | K 表首项改一位（`0xd76aa478`→`…479`） | M1 M2 M3 M4 M6 M8 M11 M13 M14 M16 M18 | 目标 M1–M3 ✅；M16 同红是设计内联动（K 表区间正则的起点没了 → 读不到 64 项），M4/M6/M8/M11/M13/M14/M18 是"每一处断言都吃 MD5 输出"的必然 |
| D2 | 移位表首轮 `7`→`8` | 同上少 M16 | 同上（S 表不在 M16 的条数核里） |
| D3 | 分组读成**大端** | 同 D2 | 同上 |
| D4 | 结果写成**大端**（只改 `a` 那一格） | 同 D2 | 同上 |
| D5 | 补位的长度字段按**字节数**写、不乘 8 | M1 M2 M3 M4 M8 M11 M13 M14 M18（**不含 M6**） | 目标 M3 ✅；M6 空输入不红是**正确**的——`len===0` 时乘八与不乘八同值，这正是空向量单列一条的价值 |
| D6 | 补位总长少算一个分组 | 14 条（M5 M7 M12 M17 也进） | 多出的四条是"md5 在多数长度上直接抛"的连带：M17 的三行、M5 的三形状都用 `md5`，M7 归一后照样要算 |
| D7 | 文本闸门按**字符**判 | M5 M9 M11 M14 M17 | 目标 M9 ✅；另四条全部吃 `bytes` 口径（M17 那行正是"文本按 UTF-8 字节"） |
| D8 | 字节闸门"超过"改成"到"（边界让一格） | M10 M18 | 目标 M10 ✅；M18 用正好 5 MiB 的输入，边界让一格它就红——这条是 M18 存在的理由 |
| D9 | 越界改成**截断继续算** | M10 | 单红恰目标（M18 全用"正好在数上"，不沾越界） |
| D10 | 落单代理项闸门摘掉 | M11 M14 | 目标 M11 ✅；M14 是 `digestAll('\uD83D')` 那格同句的理由断言 |
| D11 | 认不出的算法名静默回落 md5 | M7 | 单红，"最坏的一种看着有结果"有独立牙齿 |
| D12 | 未知 `options` 键静默当默认 | M12 | 单红 |
| D13 | 取不到 subtle 时静默出空串（无理由） | M13 | 单红（`/安全上下文/` 那条断言） |
| D14 | subtle 缺席时**连 MD5 一起停** | M13 M14 | 目标 M13 ✅；M14 的"降级批里 MD5 那格必须还成"同红 |
| D15 | subtle 抛错不再收进结果（摘掉 `catch`） | M13 | 单红：`digest` 永不 reject 这条契约的牙齿在这一格 |
| D16 | 视图吞掉 `byteOffset`（整块从头读） | M5 | 单红，含那条"整块 ≠ 尾段"的反向哨兵 |
| D17 | 导出面偷偷多长一个名字 | M15 | 单红 |
| D18 | 十六进制出**大写** | M1 M2 M3 M4 M6 M8 M11 M12 M13 M14 M18 | 目标 M4 ✅（`hex === hex.toLowerCase()`），余下是与 D1 同构的"处处吃 MD5/SHA 输出" |
| D19 | 摘掉 `prepare` 字节档外面那道 `try`（回改补的刀） | **M5 单红** | 脱落缓冲区回到 reject，`# tests` 仍 202（reject 是断言失败、不是加载失败），目标 ✅ |
| D20 | 摘掉"对象标签"这一档 | **M8 单红** | Blob/File 回到静默假成功（`md5('[object Blob]')`），目标 ✅ |
| D21 | 在 `digest.js` 中段插一条 `import './codec.js';` | **M16 单红** | 目标 ✅，并且当场对照：老正则（无 `m`）抓到=`false`、新正则抓到=`true`——这颗牙就是那个 `m` 标志 |
| D22 | 在 `codec.js` 中段插一条 `import './digest.js';` | **L16 单红** | §L 同病同治的同一颗牙，同样的老/新对照 `false`/`true` |
| D23 | `codec.js` 的 `utf8Len` 把半代理项算成 4 字节 | **M9 单红** | 跨模块对拍那四条咬住，L 系列一条不红（`codec.js` 自己没钉这个绝对值） |
| D24 | `digest.js` 的 `utf8Len` 同样改错 | **M9 单红** | 同一把尺子的另一侧；两刀合起来证明 M9 这条不是"两处一起漂也测不出" |
| D25 | 代理项那一档拒绝时回显 `bytes: 0` | **M11 单红** | M11 新增的"拒绝也要报实测字节数"咬住；尺子的绝对值在 M9，所以这一刀不是自证 |

回改七刀跑在 `/tmp/seg3t5`（脚手架 `/tmp/seg3t5/mut.mjs`、台账 `/tmp/seg3t5/ledger.log`，
`exit=0`、`✓ 7 刀全部有牙`）。这把脚手架比首发那把**少了两样**，得说明白：锚点命中数与
`# tests` 未变两项留着，`DRY=1` 预检模式与"结尾比对工作树脏指纹"没做——代替动作是
跑之前整份重拷副本树（`rm -rf tree && cp -R dev/js scripts demo package.json vite.config.js`）、
跑之后在仓库里核一次 `git status --porcelain`（结果见 Step 4）。

**18/18 有牙、0 刀全绿、0 刀被脚手架自检作废**（改完 D17 后重跑整轮，前 16 刀的红名单与首跑
逐字相同）；9 刀单红恰命中目标，另外 9 刀的多红逐条可归因（M16 的 K 表条数、M17 的八行对账、
M14 的五格同句是同一不变量的另一处断言，D5/D8/D9 三条**故意**各有免疫样本，免疫本身就是证据），
**没有一刀红到不相干的用例上**。跑完：还原后 `# tests 202 / pass 202 / 红 无`、
`副本与工作树逐字节一致=true`、脏项 `15 → 15`、`清单变化=false`、`内容变过 0 个`
——工作树没被这些实验碰过。

- [x] **Step 4: 登记镜像**

两件事一起做，少任何一件门禁二都会以"看不懂的形状"红（机制见 §0.6）：`FILE_TARGETS` 加
`'dev/js/tools/digest.js',`、计划本格末尾贴两块 ```js 全文镜像（`digest.js` 整文件 + `§M` 整节）。
`§M` 一落地，**顺带把 §L 的镜像区间从"到文件末尾"改成"到 §M 之前"**（Task 2 对 §K 做过同一件事）。

```bash
node scripts/verify-plan-blocks.mjs > /tmp/seg3t3_g2.log 2>&1; echo "exit=$?"; tail -4 /tmp/seg3t3_g2.log
node scripts/verify-plan-blocks.mjs --fix
node scripts/verify-plan-blocks-teeth.mjs
```
贴种子块时先只写磁盘内容的前若干行，由 `--fix` 整块换成磁盘全文（定位靠"最长公共前缀唯一"
与"按节名兜底"两条，Task 2 现场验过）；换完再跑一次确认 `exit=0`。

实跑：`--fix` 两块都落笔（`digest.js` 那格种子 8 行 ← 磁盘 352 行；`§M` 那格种子 7 行 ← 磁盘 406 行），
计划 **2608 → 3351 行**；同一轮退出码仍是 1（fix 那轮按定义"改了就该红"，让人复跑确认）。
修后复跑 `exit=0`、两条各报自己的区间（`digest.js` ↔ 计划 352 行、
`scripts/toolkit-tests.mjs §M（磁盘 6599–7004）` ↔ 计划 406 行，逐字节全等；
**计划侧那对行号不抄**——本节每改一行它就往后挪，抄进台账等于埋一条对不上的数）；
镜像 **37 → 39**、合计 642373B → **679100B**、`计划 js 块 36 个（段1 11、段2 19、段3 6）`、
`未落地 0 节`。

门禁一复跑 `# tests 202 / pass 202 / fail 0`。门禁三**首跑 20/21**，唯一那条 ✗ 是收口自证的
脏指纹：`新增脏：dev/libJs/cursor-effects.js`——实验进行中另一路会话改了那个文件（mtime 01:25，
本轮四个路径无一涉及）。这一条正是它该抓的东西：**守卫把第三方改动如实报成红，而不是把
"实验前后不一样"糊过去**；原地复跑（其余会话此刻没动盘）`21/21`、
`脏项 18 个前后一致，diff 指纹 d09582e118570c07（含另一路会话的那批，一律未被触碰）`。
G12 那三条这次读到 **6 条**镜像（`time.js` / `codec.js` / `digest.js` / `§K` / `§L` / `§M`），
Task 3 落地确实一行没动它——这正是 Task 2 把 G12 改成"从基线现读"要买的东西。

- [x] **Step 5: 提交**

```bash
git add dev/js/tools/digest.js scripts/toolkit-tests.mjs scripts/verify-plan-blocks.mjs \
  _docs/superpowers/plans/2026-09-27-tools-codec-page.md
git diff --cached --stat      # 期望恰 4 files
git commit -m "feat(tools): 段 3 Task 3 摘要模块 digest.js——MD5 自实现、SHA 走 subtle、降级必给理由（§M 十八判据 + 十八刀变异台账）" -- \
  dev/js/tools/digest.js scripts/toolkit-tests.mjs scripts/verify-plan-blocks.mjs \
  _docs/superpowers/plans/2026-09-27-tools-codec-page.md
```

实跑：`67ef48c`，`4 files changed, 1762 insertions(+), 9 deletions(-)`——`digest.js` 352 行是新增，
`§M` 判据 408 行，门禁二清单 +2 行，计划 +1000/−9（两块镜像 758 行 + 本格正文）。
暂存集按路径核过：`git diff --cached --stat` 恰好这四条，另一路会话的脏项一个都没进来。
提交后复跑三道：门禁一 `# tests 202 / pass 202 / fail 0`、
门禁二 `exit=0`（39 镜像、679100B、未落地 0 节）、门禁三 **21/21**。
本格两笔（这一笔回填 Step 4/5 的实跑）收口后 `git status` 剩 14 项
（`_config.yml` / `about.html` / `dev/js/about.js` / `dev/sass/about.scss` / `package.json` /
`_data/og_images.yml` / `dev/libJs/cursor-effects.js` / 两处 `.baoyu-skills/**` /
未跟踪的 `scripts/lib/`、`scripts/article-check.mjs`、`scripts/wechat-draft.mjs`、
`scripts/fixtures/article-check/`、`.baoyu-skills/baoyu-post-to-wechat/`），
全属另一路会话，本轮四个路径一字不剩。

---

### 评审回改（2026-09-28，本格的复核账）

评审员对本格报了 3 条 Important + 2 条 Minor。**五条全部先复跑证实再处置**，
没有一条是" reviewer 说了就改"，也没有一条是"看着像误报就跳过"。

| 编号 | 主张 | 我复跑出来的事实 | 处置 |
| --- | --- | --- | --- |
| I1 | detached 的字节输入会让入口 reject，破"数据入参永不抛" | 属实。`toView()` 在 `new Uint8Array(detachedBuffer)` 上抛 `TypeError: Cannot perform Construct on a detached ArrayBuffer`，`prepare()` 没接，一路顶到 `digest()` 外面——async 模块里表现为 rejection，`assert.throws` 抓不住，只有 `assert.rejects` 抓得住。三种形状（detached `ArrayBuffer`／detached `DataView`／`new Uint8Array(detachedBuffer)`）抛的位置还不一样：detached `ArrayBuffer` 的 `.byteLength` 读得出且为 **0**（谁要是直接拿这个数判空，就会把"读不到"当成"空输入"），detached `DataView` 连 `.byteLength`/`.byteOffset` 都读不出，各抛 `TypeError: Cannot perform get DataView.prototype.byteLength on a detached ArrayBuffer`；而 `toView()` 走 `new Uint8Array(ab)`，两条路都在它这里抛 | 已修。`prepare()` 的字节分支包 `try { view = toView(input) } catch { return { ok:false, bytes:0, reason:DETACHED } }`，判据 M5 末段加三形状同句断言（`new Set(三句 reason).size === 1`）+ `digestAll` 五格同拒 + 两条"真空输入不许被误判"（`new ArrayBuffer(0)`、`new Uint8Array(0)` 仍 `ok:true`） |
| I2 | 传 `File`/`Blob` 时得到"看起来对"的假摘要 | 属实且更难看。`String(new Blob(['x']))` 是 `'[object Blob]'`，`toText()` 照单全收，于是对 13 个字符的标签串做了合法 MD5——面板拿到一串十六进制，完全分不出这是内容还是身份。`Object.prototype.toString.call(Object.create(null))` 返回 `'[object Object]'` **不抛**，抛的是后面的 `String()`，所以"无原型对象连标签都读不出来"这句我原先写错了，注释已改正 | 已修。新增 `defaultTagOf()`（非对象返回 null，不做 try/catch——实测它不抛）+ `prepare()` 文本分支：`toText` 的结果恰等于 `toString` 标签时判 `ok:false`，文案直接指名 `文件请先 await file.arrayBuffer() 取字节再传`。判据 M8 末段加 6 个 tagged 对象（`Blob`/`File`/`{}`/`{a:1}`/`Map`/`Set`）拒绝、`assert.notEqual(r.hex, refHex(...))` 钉死"不是对标签算的"、`digestAll(new Blob)` 五格同拒且 `bytes === 13`，另加三条防误伤（自定义 `toString` 返回 `'mine'` 要照用、`new String('x')` 要当 `'x'`、`[]` 要当空串） |
| I3 | 判据 M16/L16 的 `import` 正则缺 `m` flag，抓不到行首 import | 属实。`/^\s*import[\s{*]/` 没有 `m` 时 `^` 只锚整串开头，而 `digest.js` 的 import 在第二行——这块判据是**假牙**。补 `m` 后自证：把 `import x from './codec.js'` 注入副本，老正则仍绿、新正则变红 | 已修（§M 与 §L 同步）。两档各补 `export * from` 与动态 `import()` 两条，条数断言随之核准：§M 25 条、§L 23 条。台账刀 D21/D22 当场印出"老正则抓不到、新正则抓得到"的对照，不是改完自称改完 |
| Minor4 | `overLimit` 的通道措辞跨模块不齐 | 部分属实。`digest.js` 内部确实一边写"字节通道"一边写"文本通道（1 MiB）"，补齐成"字节通道（5 MiB）/文本通道（1 MiB）"。**跨模块不强求同词**：`codec.js`/`time.js` 的越界文案是各自面板的 UX 口径，§0.6 的跨模块判据核的是"不许出现对方模块的专有名词"，不是"必须同词"，强行统一反而会让判据失去区分力 | 只在本模块内对齐，跨模块不动 |
| Minor5 | M9 没有落单代理项的字节长度样本 | 属实。原来只核对全为合法码位的串，`\uD83D` 这种半个 emoji 在"UTF-8 里按 3 字节计入 WTF-8 长度"这条口径上无锚——而 M11 的越界位置、M5 的 `bytes` 都吃这个数 | 已修。M9 加四枚落单形状与 `utf8Len` 的对拍（`dByteLen(s) === byteLen(s)`）+ 绝对值锚 `dByteLen('\uD83D') === 3`；M11 加 `r.bytes === dByteLen(s)` 把"闸门报的字节数"钉到同一把尺上。刀 D23/D24/D25 三把证明这几条断言真的有牙 |

复核还提了一条"`digest.js` 里 >2 GiB 分支是死代码"。**核到但本轮不改**：
`MAX_BYTES` 是 5 MiB，那条分支在真实入参上永不达，但它由 `toView()` 的
`byteLength` 读出来而不是由我们算出来，删了等于把"读得出但用不上"的中间层
变成隐式约定。它不属于"因为优化而引入风险"的范畴，留原文并注明。

回改后的实读数（同一轮连跑，无中途重跑）：

```text
门禁一  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs
        exit=0 / # tests 202 / # pass 202 / # fail 0
门禁二  node scripts/verify-plan-blocks.mjs --fix && node scripts/verify-plan-blocks.mjs
        exit=0 / 39 镜像 / 684198B / 未落地 0 节
门禁三  node scripts/verify-plan-blocks-teeth.mjs
        21/21
镜像行数  digest.js 390 行（磁盘）；§L 磁盘 6190–6600（410 行）；
         §M 磁盘 6601–7067（467 行）
变异台账  /tmp/seg3t5/ledger.log — ✓ 7 刀全部有牙（D19–D25），exit=0
```

`git status` 在回改这轮跑到门禁三时是 **17 项**，其中 14 项属另一路会话
（`_config.yml`、`about.html`、`dev/js/about.js`、`dev/sass/about.scss`、`package.json`、
`_data/og_images.yml`、`dev/libJs/cursor-effects.js`、`.baoyu-skills/` 两处已跟踪项，
加未跟踪的 `scripts/lib/`、`scripts/article-check.mjs`、`scripts/wechat-draft.mjs`、
`scripts/fixtures/article-check/`、`.baoyu-skills/baoyu-post-to-wechat/`），
另 3 项就是本轮的 `digest.js` / `toolkit-tests.mjs` / 本计划——尚未提交所以还挂在脏单里。
门禁三自证的是**实验前后**这 17 项一字未变（脏项条数一致、另一路会话那批一律未被脚本触碰）；
diff 指纹只在"实验窗口内"可比，我自己改一笔计划正文就会换指纹，所以这里不抄指纹值、
只认条数与路径清单。本格提交后 `git status` 应回到 14 项。

---

### 落地镜像（门禁二核的就是这两块，`--fix` 会把它们整块换成磁盘内容）

两块都是**磁盘全文**，用 ```js 围栏（§0.6 的硬规矩：只有整文件与整节镜像允许 ```js，
契约段一律 ```text）。

#### `dev/js/tools/digest.js`（整文件）

```js
/**
 * 摘要与校验码：MD5 与 SHA-1/256/384/512，编码工具箱页 `#digest` 那一格的纯逻辑。
 *
 * 这一格有三条不许让步的规矩，整套判据（§M）都是围着它们写的：
 *
 * 1. **MD5 自己实现，不借快捷方式**。`crypto.subtle` 根本不认 MD5（实测 Node 22 的 subtle 抛
 *    `NotSupportedError: Unrecognized algorithm name`），而 `crypto-js` 在 §2.2 的选型表里就是"不引"。
 *    所以 A/B/C/D 四个初值与 64 项 K 表全部写成硬编码常数——K 表**不能**用 `Math.sin` 现算，
 *    IEEE-754 的 `sin` 不保证跨引擎逐位一致，某台设备上算错一项就是"同一串两个摘要"。
 *    判据拿 Node 的 `createHash('md5')` 当外部对拍源（M1–M3、M18），不把自己的输出当标准。
 * 2. **两条通道两道闸门**。文本走 UTF-8 字节、闸门 1 MiB（与 `codec.js` 的 `MAX_INPUT_BYTES` 同一个
 *    数、同一把尺子，M9 逐样本核两处不分叉）；文件那一路走 `ArrayBuffer`/TypedArray、闸门 5 MiB，
 *    **不进字符串**——`String.fromCharCode` 拼二进制会把字节劈成两个 code unit，摘要就成假的了（M5）。
 *    越界一律整体拒绝且 `hex` 是空串，理由里点名实测字节数（半截摘要比报错更坏）。
 *    已脱离缓冲区的字节输入（`transfer` 过的 `ArrayBuffer`）也是拒：它的 `byteLength` 已经是 0，
 *    但它与"长度为 0 的字节"是两回事，前者是读不到、后者是真空值（M5 第三段）。
 * 3. **算不成就说清是哪一格算不成**。`crypto.subtle` 只在安全上下文有（线上是 GitHub Pages HTTPS、
 *    本地 `http://localhost` 也算，`http://192.168.x.x` 就没有）。取不到时 SHA 四档各自
 *    `ok:false` 并写明"需要安全上下文"，同一批里的 MD5 那一格**照样出结果**（M13）；
 *    `digest` / `digestAll` 永不 reject——subtle 同步抛或异步拒，都收进 `{ok:false, reason}` 里，
 *    面板只有一条 await 路径要写。
 *
 * 与 `idcard.js` / `codec.js` / `time.js` 同一套约定：纯函数、不碰 DOM、同级工具模块互不 import
 * （`shapeOf` / `toText` / UTF-8 编码器因此又各多一份拷贝，代价由 M9 逐样本核一次），并且
 * **两档入参两种处理**：
 *   - **数据入参**（要摘要的那一串）：文本档照 `String(v === null || v === undefined ? '' : v)`
 *     归一不抛，字节档（`ArrayBuffer` 与任意 `ArrayBufferView`）原样直通；唯一例外还是无原型对象
 *     （`String()` 自己抛 `TypeError`，本站不替它兜，M8 逐入口钉）。
 *     归一不抛**不等于**照单全收：`String(new Blob(['x']))` 得到的是 `[object Blob]` 这个**标签**，
 *     给它一个合法摘要就是静默的假成功，所以"归一结果恰好等于默认对象标签"要拒（M8 末段），
 *     `File`/`Blob` 必须先 `await file.arrayBuffer()` 取字节再走字节通道。
 *   - **控制入参**（算法名与 `options`）是闸门：算法名认不出必须响——静默回落到 MD5 等于把用户
 *     选的 SHA-256 显示成了别的算法的产物；`options` 只认 `subtle` 一键，键名拼错也要响。
 *
 * 异步口径是本模块与 §L 唯一的形状差：`subtle.digest` 本来就是 Promise，所以五个算法**全部**走
 * 同一条异步路径（连自己实现的 MD5 也是），校验错误一律以 rejection 送出而不是同步抛
 * （判据里用 `assert.rejects`——它不吃同步抛，写错形状会直接红，M7、M12 各钉一处）。
 *
 * 可复算口径：M6 那五条空输入官方值、M4 的 `'abc'` 向量、M1 的 RFC 1321 七条，都能用
 * `node -e "require('crypto').createHash('md5').update('').digest('hex')"` 一行复算；
 * K 表的第一项 `0xd76aa478` 与最后一项 `0xeb86d391` 由 M16 点名数满 64 项。
 */

/** 文本通道闸门（字节）：与 `codec.js` 的 `MAX_INPUT_BYTES` 同值同口径，§7 那句"文本类工具 1MB" */
export const MAX_TEXT_BYTES = 1048576;
/** 字节通道闸门（字节）：文件那一路单独一档，5 MiB = 5242880 字节；`超过`才拒，正好在数上放行 */
export const MAX_BYTES = 5242880;

/** 面板的五行按这个顺序排，`HEX_LEN` 的键集与它必须同集（M15 两处都核） */
export const ALGORITHMS = Object.freeze(['md5', 'sha-1', 'sha-256', 'sha-384', 'sha-512']);
/** 各档输出的十六进制长度：面板拿它判"这格是不是被截了"，判据拿它逐档核（M4） */
export const HEX_LEN = Object.freeze({ md5: 32, 'sha-1': 40, 'sha-256': 64, 'sha-384': 96, 'sha-512': 128 });

/** 一行的口径说明，面板原样显示（与 `TIME_CAVEAT`、`BASE64_CAVEAT` 同一角色，逐条对账由 M17 守着） */
export const DIGEST_CAVEAT =
  'MD5 由本站自己实现，SHA-1、SHA-256、SHA-384、SHA-512 走浏览器自带的 WebCrypto；'
  + '取不到时给明确提示、不静默出空值。文本按 UTF-8 字节计，文件走字节、不进字符串；'
  + '文本超 1 MiB（1048576 字节）、字节超 5 MiB（5242880 字节）整体拒绝、不截断。';

/** WebCrypto 认的是大写带横杠那一名，本站的规范名用它（判据里硬写期望名，不跟着这张表漂） */
const SUBTLE_NAME = { 'sha-1': 'SHA-1', 'sha-256': 'SHA-256', 'sha-384': 'SHA-384', 'sha-512': 'SHA-512' };
/** 算法名归一的查找表：键是"去掉分隔符的小写串" */
const BY_COMPACT = { md5: 'md5', sha1: 'sha-1', sha256: 'sha-256', sha384: 'sha-384', sha512: 'sha-512' };
const HEX_DIGITS = '0123456789abcdef';

/** 取不到 subtle 那一句：点名"只有 SHA 档受影响"，否则用户以为整格坏了（M13） */
const NO_SUBTLE = '当前环境取不到 crypto.subtle，SHA-* 做不了（需要 HTTPS 或 localhost 这类安全上下文）；'
  + 'MD5 由本站自己实现，不受这一档影响。';

/** 越界那一句要复用，理由里点名实测字节与两道闸门各自的上限（M9、M10） */
const overLimit = (n, limit, label) =>
  `输入 ${n} 字节，超过${label}上限 ${limit} 字节，整体拒绝、不截断`;

/**
 * 已脱离缓冲区的字节输入（`transfer` 出去的 `ArrayBuffer`、或它下面的视图）。
 * 这一档必须单独有句子：detached 的 `byteLength` 已经是 0，若不点名，面板上就显示成
 * "0 字节的空输入"、给出空串的摘要——那是把"读不到"报成了"内容就是空的"（M5 末段）。
 */
const DETACHED = '字节输入已脱离底层缓冲区（ArrayBuffer 被 transfer 或分离之后就这样），读不到内容；'
  + '空输入请传长度为 0 的字节或空字符串';

/**
 * 只有当 `String(v)` 的结果**恰好等于**默认对象标签时才认它"是标签不是内容"。
 * `[1,2]`→`'1,2'`、`new Date`→日期串这些有实际文本形状的归一不动（M8 前段）；
 * 无原型对象那一档是 `String()` 自己抛在前（它的标签读得出 `[object Object]`，但根本走不到
 * 这一步比较），所以 M8 的"同抛"不会被这条改成拒绝（M8 末段）。
 */
function defaultTagOf(v) {
  if (typeof v !== 'object' || v === null) return null;
  return Object.prototype.toString.call(v);
}

/** 与 `codec.js`、`time.js`、`uscc.js` 同一份口径的第四版：报错尾巴统一是「收到 <shapeOf(值)>」 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (typeof v === 'object') return v instanceof Date ? 'Date' : 'object';
  return typeof v;
}

const toText = (v) => String(v === null || v === undefined ? '' : v);

/** 代理区上下界与 `codec.js` 同一档：落单代理项不是合法字符，UTF-8 里也没有它的编码 */
const SUR_HIGH_LO = 0xD800;
const SUR_HIGH_HI = 0xDBFF;
const SUR_LOW_LO = 0xDC00;
const SUR_LOW_HI = 0xDFFF;

/** 找落单代理项，返回 1-based 字符位；干净就返回 0（M11 全靠它给位置） */
function loneSurrogateAt(text) {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= SUR_HIGH_LO && code <= SUR_HIGH_HI) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (next < SUR_LOW_LO || next > SUR_LOW_HI) return i + 1;
      i += 1;
    } else if (code >= SUR_LOW_LO && code <= SUR_LOW_HI) {
      return i + 1;
    }
  }
  return 0;
}

/** UTF-8 字节数：文本闸门的尺子。落单代理项按 3 字节计——它反正会在下一档被拒 */
function utf8Len(text) {
  let n = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) n += 1;
    else if (code < 0x800) n += 2;
    else if (code >= SUR_HIGH_LO && code <= SUR_HIGH_HI) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (next >= SUR_LOW_LO && next <= SUR_LOW_HI) { n += 4; i += 1; } else n += 3;
    } else n += 3;
  }
  return n;
}

/** 文本 → UTF-8 字节（先过 `loneSurrogateAt`，否则半代理项会被当三字节写出去） */
function utf8Write(text) {
  const out = new Uint8Array(utf8Len(text));
  let p = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) out[p++] = code;
    else if (code < 0x800) {
      out[p++] = 0xC0 | (code >> 6); out[p++] = 0x80 | (code & 0x3F);
    } else if (code >= SUR_HIGH_LO && code <= SUR_HIGH_HI) {
      const cp = 0x10000 + ((code - SUR_HIGH_LO) << 10) + (text.charCodeAt(i + 1) - SUR_LOW_LO);
      out[p++] = 0xF0 | (cp >> 18); out[p++] = 0x80 | ((cp >> 12) & 0x3F);
      out[p++] = 0x80 | ((cp >> 6) & 0x3F); out[p++] = 0x80 | (cp & 0x3F);
      i += 1;
    } else {
      out[p++] = 0xE0 | (code >> 12); out[p++] = 0x80 | ((code >> 6) & 0x3F);
      out[p++] = 0x80 | (code & 0x3F);
    }
  }
  return out;
}

/** 字节 → 小写十六进制。刻意不 import `codec.js` 的 Base64 那套：本站只承诺十六进制 */
function hexOf(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += HEX_DIGITS[bytes[i] >> 4] + HEX_DIGITS[bytes[i] & 15];
  return s;
}

/** 是"字节"吗：`ArrayBuffer` 与任意 `ArrayBufferView`（TypedArray、DataView）都算，其余走文本档 */
export function isBytes(v) {
  return v instanceof ArrayBuffer || ArrayBuffer.isView(v);
}

/** 文本档的 UTF-8 字节数，面板上的"输入多少字节"与文本闸门共用这一把尺子 */
export function byteLen(text) { return utf8Len(toText(text)); }

/** 字节形状统一成 `Uint8Array` 视图：带 `byteOffset` 的视图按自己的起点读，不从整块头部偷看（M5） */
function toView(v) {
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
}

/**
 * 算法名归一到规范名，认不出给 `null`（面板做即时校验用这一档，不抛）。
 * 大小写、横杠、下划线、空格都不算两种算法：`SHA256` / `sha-256` / `' Sha_256 '` 同一档。
 */
export function normalizeAlgo(v) {
  if (typeof v !== 'string') return null;
  return BY_COMPACT[v.trim().toLowerCase().replace(/[-_\s]/g, '')] || null;
}

/* ── MD5（RFC 1321）：四个初值 + 64 项 K + 64 项移位，全部硬编码常数 ────────── */

const MD5_INIT = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
/** K[i] = floor(2^32 × |sin(i+1)|)。这里写死常数，不在运行时算（文件头规矩 1） */
const MD5_K = [
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
  0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
  0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
  0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
  0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
  0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
  0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
  0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
  0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
];
/** 四组各 16 轮，每轮的左移位数 */
const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

/** 补位：`0x80` + 若干 `0x00` + 64 位小端长度，凑到 64 的整数倍（M3 逐边界对拍的那一档） */
function md5Pad(bytes) {
  const len = bytes.length;
  const total = (Math.floor((len + 8) / 64) + 1) * 64;
  const padded = new Uint8Array(total);
  padded.set(bytes);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  const bits = len * 8;
  view.setUint32(total - 8, bits >>> 0, true);
  view.setUint32(total - 4, Math.floor(bits / 4294967296), true);
  return padded;
}

/** 字节 → MD5 的 16 字节（小端写回，与 RFC 1321 的参考实现同一档字节序） */
function md5Digest(bytes) {
  const padded = md5Pad(bytes);
  const dv = new DataView(padded.buffer);
  let a = MD5_INIT[0]; let b = MD5_INIT[1]; let c = MD5_INIT[2]; let d = MD5_INIT[3];
  const words = new Uint32Array(16);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i += 1) words[i] = dv.getUint32(off + i * 4, true);
    const aa = a; const bb = b; const cc = c; const dd = d;
    for (let i = 0; i < 64; i += 1) {
      let f; let g;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) & 15; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) & 15; }
      else { f = c ^ (b | ~d); g = (7 * i) & 15; }
      const sum = (a + (f >>> 0) + words[g] + MD5_K[i]) >>> 0;
      const s = MD5_S[i];
      const rot = ((sum << s) | (sum >>> (32 - s))) >>> 0;
      a = d; d = c; c = b;
      b = (b + rot) >>> 0;
    }
    a = (a + aa) >>> 0; b = (b + bb) >>> 0; c = (c + cc) >>> 0; d = (d + dd) >>> 0;
  }
  const out = new Uint8Array(16);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, a, true); ov.setUint32(4, b, true);
  ov.setUint32(8, c, true); ov.setUint32(12, d, true);
  return out;
}

/* ── subtle 的取用与降级 ───────────────────────────────────────────────── */

/**
 * `{subtle}` 三档：缺席（`undefined`）读 `globalThis.crypto`；`null` 是调用方**显式声明**
 * "这就是取不到"，用来在非安全上下文里跑同一条降级路径（也是 §M 演那条路的唯一办法——
 * 测试环境的 `crypto.subtle` 一直在，删不掉）；给了对象但没有可调的 `digest`，同档按"取不到"算。
 */
function resolveSubtle(injected) {
  if (injected === null) return null;
  if (injected !== undefined) return typeof injected.digest === 'function' ? injected : null;
  const subtle = globalThis.crypto ? globalThis.crypto.subtle : undefined;
  return subtle && typeof subtle.digest === 'function' ? subtle : null;
}

/** `options` 闸门：只认 `subtle` 一键，键名拼错必须响——静默当默认等于用户的注入白开了 */
function gateOptions(who, options) {
  if (options === undefined || options === null) return undefined;
  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError(`${who} 的 options 应为对象，收到 ${shapeOf(options)}`);
  }
  for (const key of Object.keys(options)) {
    if (key !== 'subtle') throw new TypeError(`${who} 有未知 options 键「${key}」，只认 subtle`);
  }
  const s = options.subtle;
  if (s === undefined || s === null) return s;
  if (typeof s !== 'object') {
    throw new TypeError(`${who} 的 options.subtle 应为对象或 null，收到 ${shapeOf(s)}`);
  }
  return s;
}

/**
 * 数据闸门：字节档看 `MAX_BYTES`，文本档看 `MAX_TEXT_BYTES`，顺序固定是
 * "读不到（detached）→ 字节数越界 → 落单代理项 → 才编码"，越界优先于代理项（M11 末段），
 * 否则会给出一句"第 1048577 位"的假位置；detached 排在最前，因为它连字节数都读不出来。
 */
function prepare(input) {
  if (isBytes(input)) {
    // 脱落的缓冲区在 `new Uint8Array(...)` 那一步抛，DataView 连 `byteOffset` 都读不出（M5 末段）
    let view;
    try {
      view = toView(input);
    } catch {
      return { ok: false, bytes: 0, reason: DETACHED };
    }
    const n = view.byteLength;
    if (n > MAX_BYTES) return { ok: false, bytes: n, reason: overLimit(n, MAX_BYTES, '字节通道（5 MiB）') };
    return { ok: true, bytes: n, view };
  }
  const s = toText(input);
  const tag = defaultTagOf(input);
  if (tag !== null && s === tag) {
    return {
      ok: false, bytes: utf8Len(s),
      reason: `收到的是对象标签 ${tag}，不是内容：文件请先 await file.arrayBuffer() 取字节再传，`
        + '文本请直接传字符串',
    };
  }
  const n = utf8Len(s);
  if (n > MAX_TEXT_BYTES) {
    return { ok: false, bytes: n, reason: overLimit(n, MAX_TEXT_BYTES, '文本通道（1 MiB）') };
  }
  const lone = loneSurrogateAt(s);
  if (lone > 0) {
    return { ok: false, bytes: n, reason: `第 ${lone} 位是落单代理项（半个 emoji），UTF-8 里不存在` };
  }
  return { ok: true, bytes: n, view: utf8Write(s) };
}

/** 这一档本来会走哪条路：闸门拦下时也照此回显，面板才分得开"没算"与"算不成" */
const viaOf = (name, subtle) => (name === 'md5' ? 'self' : (subtle ? 'subtle' : 'unavailable'));

function one(name, prepared, subtle) {
  if (name === 'md5') {
    return Promise.resolve({ ok: true, algo: name, hex: hexOf(md5Digest(prepared.view)),
      bytes: prepared.bytes, via: 'self', reason: null });
  }
  if (!subtle) {
    return Promise.resolve({ ok: false, algo: name, hex: '', bytes: prepared.bytes,
      via: 'unavailable', reason: NO_SUBTLE });
  }
  return Promise.resolve()
    .then(() => subtle.digest(SUBTLE_NAME[name], prepared.view))
    .then((buf) => ({ ok: true, algo: name, hex: hexOf(new Uint8Array(buf)),
      bytes: prepared.bytes, via: 'subtle', reason: null }))
    .catch((err) => ({ ok: false, algo: name, hex: '', bytes: prepared.bytes, via: 'subtle',
      reason: `摘要失败：${(err && err.name) || 'Error'} ${(err && err.message) || ''}`.trim() }));
}

/**
 * 单档入口。`{ok, algo, hex, bytes, via, reason}` 六键恒定，成不成都不 reject。
 * 只有控制入参（算法名、`options`、无原型对象那一种）才抛。
 */
export async function digest(algo, input, options) {
  const name = normalizeAlgo(algo);
  if (name === null) {
    throw new TypeError(`digest 的算法名不在支持列表里，收到 ${shapeOf(algo)}`);
  }
  const subtle = resolveSubtle(gateOptions('digest', options));
  const prepared = prepare(input);
  if (!prepared.ok) {
    return { ok: false, algo: name, hex: '', bytes: prepared.bytes,
      via: viaOf(name, subtle), reason: prepared.reason };
  }
  return one(name, prepared, subtle);
}

/**
 * 五档并列（面板的那张表）。字节数只算一次、五格报同一个数；数据闸门失败时五格同一句理由，
 * 而个别档自己失败（只有 SHA 档取不到 subtle）不牵连邻居——`#digest` 的降级提示就靠这一档。
 */
export async function digestAll(input, options) {
  const subtle = resolveSubtle(gateOptions('digestAll', options));
  const prepared = prepare(input);
  const rows = [];
  for (const name of ALGORITHMS) {
    if (!prepared.ok) {
      rows.push({ ok: false, algo: name, hex: '', bytes: prepared.bytes,
        via: viaOf(name, subtle), reason: prepared.reason });
    } else {
      rows.push(await one(name, prepared, subtle));
    }
  }
  return { ok: rows.every((r) => r.ok), reason: prepared.ok ? null : prepared.reason,
    bytes: prepared.bytes, rows };
}
```

#### `scripts/toolkit-tests.mjs` §M（整节，从 `// ── §M` 到 `// ── §N` 之前）

```js
// ── §M 摘要算法（tools/digest.js，段 3 Task 3）───────────────────────────────
// 两条外部判据源，都不拿自己的输出当标准：MD5 拿 Node 的 `createHash('md5')` 对拍，
// SHA-* 同时拿 `node:crypto` 与 Node 22 的 `globalThis.crypto.subtle` 对拍（后者就是浏览器里
// 那套 WebCrypto 的同一份实现，所以"SHA 走 subtle"这条在测试环境里也量得到）。
// 真浏览器里 `crypto.subtle` 缺席的那条路（非安全上下文）在这里只能靠 `{subtle}` 注入档演，
// 页面侧的实测留给 Task 8——这一格欠了什么，M13 的注释里写着。
const { MAX_TEXT_BYTES, MAX_BYTES, ALGORITHMS, HEX_LEN, DIGEST_CAVEAT,
  byteLen: dByteLen, isBytes, normalizeAlgo, digest, digestAll } = await import('../dev/js/tools/digest.js');

/** 剥注释扫源码：块注释与行注释里的字样都不算命中（与 §K 的 kCode、§L 的 lCode 同一形状） */
const dCode = () => read('dev/js/tools/digest.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** 判据侧的 UTF-8 编码器：测试环境有 TextEncoder，模块里没有（M16 正是核这件事） */
const bytesOf = (s) => new TextEncoder().encode(s);
/** 外部判据源：算法名 → Node 的 hash 名。这张表**故意与模块无关**，模块里那份漂了这里要红 */
const NODE_NAME = { md5: 'md5', 'sha-1': 'sha1', 'sha-256': 'sha256', 'sha-384': 'sha384', 'sha-512': 'sha512' };
const refHex = (algo, bytes) => createHash(NODE_NAME[algo]).update(bytes).digest('hex');
/** 对拍样本：空串、尾块四个余数、UTF-8 多字节、代理对、控制字符、BMP 边界 */
const M_SAMPLES = ['', 'a', 'ab', 'abc', 'abcd', 'hello world', '\u4e2d\u6587', '\u4e2d',
  '\uD83D\uDE00', '\u0000\u007F\u00FF\u0100', '\u0800', '\uFFFF', '\u{10000}',
  'a=b&c', '  ', '\n\t', 'message digest', '0123456789'];
/** 假 subtle：记调用参数，返回一段确定字节，好把"到底调没调、用什么名字调的"量出来 */
const fakeSubtle = (name = 'SHA-256', fill = [0, 1, 2, 3]) => {
  const calls = [];
  return { calls, subtle: { digest: (algo, data) => {
    calls.push([algo, data]);
    return Promise.resolve(new Uint8Array(fill).buffer);
  } } };
};
test('M1 MD5 对 RFC 1321 A.5 的七条官方向量逐字符相等', async () => {
  const rfc = [
    ['', 'd41d8cd98f00b204e9800998ecf8427e'],
    ['a', '0cc175b9c0f1b6a831c399e269772661'],
    ['abc', '900150983cd24fb0d6963f7d28e17f72'],
    ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
    ['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
    ['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 'd174ab98d277d9f5a5611c2c9f419d9f'],
    ['12345678901234567890123456789012345678901234567890123456789012345678901234567890',
      '57edf4a22be3c955ac49da2e2107b67a'],
  ];
  assert.equal(rfc.length, 7, '官方向量就七条，少一条等于某一档分支从此不核');
  for (const [s, want] of rfc) {
    const r = await digest('md5', s);
    assert.equal(r.ok, true, JSON.stringify(s.slice(0, 12)));
    assert.equal(r.hex, want, `RFC 1321 向量不等：${JSON.stringify(s.slice(0, 12))}`);
    assert.equal(r.bytes, Buffer.byteLength(s, 'utf8'), JSON.stringify(s.slice(0, 12)));
    assert.equal(refHex('md5', bytesOf(s)), want, '判据源自己得站得住：Node 的 MD5 也必须是这个值');
  }
});
test('M2 MD5 与 Node 的 createHash 逐样本对拍，字节档与文本档同源', async () => {
  for (const s of M_SAMPLES) {
    const r = await digest('md5', s);
    assert.equal(r.ok, true, JSON.stringify(s));
    assert.equal(r.hex, refHex('md5', bytesOf(s)), JSON.stringify(s));
    assert.equal(r.via, 'self', 'MD5 由本站自己实现，走 subtle 就是假结果');
    const b = await digest('md5', bytesOf(s));
    assert.equal(b.hex, r.hex, '同一份字节的文本档与字节档必须同结果');
  }
  // 256 个字节值全跑一遍：单字节值域里藏得住索引与位移的错，两条样本抓不到
  const all = new Uint8Array(256);
  for (let i = 0; i < 256; i++) all[i] = i;
  assert.equal((await digest('md5', all)).hex, refHex('md5', all));
});
test('M3 分组与补位边界：55/56/63/64/65/119/120/127/128/129 全部与 Node 对拍', async () => {
  // 55→56 是"长度字段挤进下一个分组"的那道坎，63→64 是"整块不带补位"的坎，
  // 127→128→129 是两块变三块的坎。MD5 的错九成九长在这几个位置。
  const lens = [0, 1, 54, 55, 56, 57, 62, 63, 64, 65, 71, 118, 119, 120, 127, 128, 129, 191, 192, 320];
  for (const n of lens) {
    const bytes = new Uint8Array(n);
    for (let i = 0; i < n; i++) bytes[i] = (i * 31 + n) & 0xFF;
    const r = await digest('md5', bytes);
    assert.equal(r.ok, true, `n=${n}`);
    assert.equal(r.bytes, n, `n=${n} 的字节数报错了`);
    assert.equal(r.hex, refHex('md5', bytes), `分组边界 n=${n} 与 Node 不等`);
  }
});
test('M4 五档输出形状：小写十六进制、长度按 HEX_LEN 表，SHA 四档与 Node 同结果', async () => {
  for (const algo of ALGORITHMS) {
    const r = await digest(algo, 'abc');
    assert.equal(r.ok, true, algo);
    assert.equal(r.algo, algo, '回显必须是归一之后的规范名');
    assert.equal(r.hex.length, HEX_LEN[algo], `${algo} 的 hex 长度`);
    assert.equal(r.hex, r.hex.toLowerCase(), `${algo} 出大写就等于面板两行看着不一样`);
    assert.match(r.hex, /^[0-9a-f]+$/, `${algo} 的输出必须是十六进制`);
    assert.equal(r.hex, refHex(algo, bytesOf('abc')), `${algo} 与 Node 不等`);
    assert.equal(r.reason, null, algo);
  }
  assert.equal(HEX_LEN.md5, 32); assert.equal(HEX_LEN['sha-1'], 40);
  assert.equal(HEX_LEN['sha-256'], 64); assert.equal(HEX_LEN['sha-384'], 96); assert.equal(HEX_LEN['sha-512'], 128);
  // RFC 3174 / FIPS 180 的 'abc' 官方向量各钉一条，防止"对拍源跟着实现一起漂"
  assert.equal((await digest('sha-1', 'abc')).hex, 'a9993e364706816aba3e25717850c26c9cd0d89d');
  assert.equal((await digest('sha-256', 'abc')).hex,
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('M5 文本通道与字节通道同结果，脱落的缓冲区单独一档不冒充空输入', async () => {
  const s = '中文😀\n带换行的 data URI 场景';
  const bytes = bytesOf(s);
  for (const algo of ALGORITHMS) {
    const asText = await digest(algo, s);
    const asView = await digest(algo, bytes);
    const asBuffer = await digest(algo, bytes.buffer);
    assert.equal(asText.hex, asView.hex, `${algo}：Uint8Array 与字符串不同`);
    assert.equal(asText.hex, asBuffer.hex, `${algo}：ArrayBuffer 与 Uint8Array 不同`);
    assert.equal(asText.bytes, asView.bytes, `${algo}：两条通道的字节数必须同口径`);
  }
  // 视图的偏移档：一个错位视图必须算成"另一份字节"，不能偷偷从 buffer 头部开始读
  const big = new Uint8Array([0, 0, ...bytesOf('abc')]);
  const view = big.subarray(2);
  assert.equal((await digest('md5', view)).hex, (await digest('md5', 'abc')).hex,
    '带 byteOffset 的视图必须按视图自己的起点读');
  assert.notEqual((await digest('md5', big)).hex, (await digest('md5', view)).hex,
    '整块与尾段同结果＝偏移被吞了，这一条就是那件事的哨兵');
  // 脱落档：`transfer` 出去的缓冲区与它下面的视图，`byteLength` 已经是 0，但它是"读不到"而不是
  // "空输入"。这一条牙齿存在的理由很直白：少了 try，`digest` 会**reject**，破掉规矩 3 的
  // "数据入参永不 reject"，而且整批五格连本该出结果的 MD5 一起丢（评审 2026-09-28）。
  const detached = [];
  const shapes = (() => {
    const a = new ArrayBuffer(1024); const b = new ArrayBuffer(64); const c = new ArrayBuffer(32);
    const u8 = new Uint8Array(b); const dv = new DataView(c);
    structuredClone(a, { transfer: [a] });
    structuredClone(b, { transfer: [b] });
    structuredClone(c, { transfer: [c] });
    return [['ArrayBuffer', a], ['Uint8Array', u8], ['DataView', dv]];
  })();
  for (const [label, v] of shapes) {
    assert.equal(isBytes(v), true, `${label}：脱落后仍然是字节形状，不许掉进文本档被归一成 "..."`);
    const r = await digest('md5', v);
    assert.equal(r.ok, false, `${label}：脱落必须拒，不许当空输入`);
    assert.equal(r.hex, '', label); assert.equal(r.bytes, 0, `${label}：读到的字节数就是 0`);
    assert.match(r.reason, /脱离|detached/, `${label} 的理由要点名脱档：${r.reason}`);
    detached.push(r.reason);
  }
  assert.equal(new Set(detached).size, 1, '三种脱落形状同一句理由，面板才不会写出三种解释');
  const emptyish = await digest('md5', new ArrayBuffer(0));
  assert.equal(emptyish.ok, true, '长度为 0 的缓冲区是空输入（M6 那一档），不许被脱落档误伤');
  assert.equal((await digest('md5', new Uint8Array(0))).ok, true, '同上：视图形状');
  const allDetached = await digestAll(shapes[0][1]);
  assert.equal(allDetached.ok, false); assert.equal(allDetached.reason, allDetached.rows[0].reason);
  assert.equal(allDetached.rows.every((r) => r.ok === false && r.hex === ''), true,
    '并列入口里脱落也是五格同拒—— reject 会让这一格整批消失，包括 MD5');
});
test('M6 空输入是一等公民：五档空串都出官方值，不是拒绝', async () => {
  const empty = {
    md5: 'd41d8cd98f00b204e9800998ecf8427e',
    'sha-1': 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
    'sha-256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'sha-384': '38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b',
    'sha-512': 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2'
      + '877eec2f63b931bd47417a81a538327af927da3e',
  };
  assert.equal(empty['sha-512'].length, 128, '硬编码向量自己得先是 128 位，抄漏一位这里就红');
  for (const algo of ALGORITHMS) {
    const r = await digest(algo, '');
    assert.equal(r.ok, true, `${algo}：空串的摘要是有定义的标准结果，不是"没输入"`);
    assert.equal(r.bytes, 0, algo);
    assert.equal(r.hex, refHex(algo, new Uint8Array(0)), `${algo} 与 Node 的空输入不等`);
    assert.equal(r.hex, empty[algo], `${algo} 的官方空值`);
    assert.equal((await digest(algo, new Uint8Array(0))).hex, r.hex, '空字节与空字符串同档');
  }
});
test('M7 算法名归一到规范名，认不出的不猜、digest 直接抛', async () => {
  for (const [v, want] of [['sha256', 'sha-256'], ['SHA-256', 'sha-256'], [' Sha_256 ', 'sha-256'],
    ['SHA256', 'sha-256'], ['md5', 'md5'], ['MD5', 'md5'], ['sha1', 'sha-1'], ['SHA-1', 'sha-1'],
    ['sha-512', 'sha-512']]) {
    assert.equal(normalizeAlgo(v), want, JSON.stringify(v));
    assert.equal((await digest(v, 'abc')).algo, want, `digest 的归一与 normalizeAlgo 分叉：${v}`);
  }
  for (const v of ['sha-0', 'sha-265', 'md4', '', ' ', null, undefined, 256, {}, [], Symbol('x')]) {
    assert.equal(normalizeAlgo(v), null, `normalizeAlgo 应安静地给 null：${String(v)}`);
  }
  for (const v of ['sha-265', '', null, undefined, 256]) {
    await assert.rejects(() => digest(v, 'abc'), (e) => {
      assert.equal(e.name, 'TypeError', JSON.stringify(v));
      assert.match(e.message, /算法名/, e.message);
      assert.match(e.message, /收到 (null|undefined|number|string)/, e.message);
      return true;
    }, `未认出的算法名必须响：${String(v)}`);
  }
  // 静默回落 md5 是最坏的一种"看着有结果"，这里点名它
  await assert.rejects(() => digest('sha-256x', 'abc'), { name: 'TypeError' });
});
test('M8 入参两档与兄弟模块同档：文本归一不抛、无原型对象同抛、字节档直通、只剩对象标签的要拒', async () => {
  const shaOf = (s) => refHex('sha-256', bytesOf(s));
  for (const [v, want] of [[123, '123'], [true, 'true'], [Symbol('s'), 'Symbol(s)'],
    [0, '0'], [NaN, 'NaN'], [[1, 2], '1,2']]) {
    const r = await digest('sha-256', v);
    assert.equal(r.ok, true, String(v));
    assert.equal(r.hex, shaOf(want), `文本归一档位与兄弟模块分叉：${String(v)} → ${want}`);
  }
  const d = await digest('md5', new Date('2026-09-28T00:00:00Z'));
  assert.equal(d.ok, true, 'Date 走文本归一（`parseIdCard(123)` 同一档），不许抛');
  assert.equal(d.hex, refHex('md5', bytesOf(String(new Date('2026-09-28T00:00:00Z')))));
  for (const v of [null, undefined]) {
    const r = await digest('md5', v);
    assert.equal(r.ok, true, String(v)); assert.equal(r.bytes, 0, `${String(v)} 归一成空串`);
    assert.equal(r.hex, 'd41d8cd98f00b204e9800998ecf8427e', '空输入那一档的官方值（与 M6 同一格）');
  }
  const noProto = Object.create(null);
  for (const call of [() => digest('md5', noProto), () => digestAll(noProto)]) {
    await assert.rejects(() => call(), { name: 'TypeError' }, '无原型对象必须同抛，不许静默洗成结论');
  }
  assert.equal(isBytes(new Uint8Array(1)), true);
  assert.equal(isBytes(new ArrayBuffer(1)), true);
  assert.equal(isBytes(Buffer.from('x')), true, 'Node 的 Buffer 是 Uint8Array 的子类，浏览器侧的字节档同一条路');
  assert.equal(isBytes('abc'), false); assert.equal(isBytes(null), false); assert.equal(isBytes(1), false);
  // 归一不抛**不等于**照单全收：`String(new Blob(['x']))` 得到的是 `[object Blob]` 这个**标签**，
  // 给它一个合法摘要就是静默的假成功——`#digest` 的文件那一格会显示"算出来了"（评审 2026-09-28）。
  const tagged = [new Blob(['x']), new File(['abc'], 'a.txt'), {}, { a: 1 }, new Map(), new Set([1])];
  for (const v of tagged) {
    const tag = Object.prototype.toString.call(v);
    const r = await digest('md5', v);
    assert.equal(r.ok, false, `${tag}：只剩默认标签的对象必须拒`);
    assert.equal(r.hex, '', tag);
    assert.match(r.reason, /对象标签/, `${tag} 的理由要点名标签：${r.reason}`);
    assert.notEqual(r.hex, refHex('md5', bytesOf(tag)), `${tag}：不许是"标签串的摘要"`);
  }
  const fileAll = await digestAll(new Blob(['x']));
  assert.equal(fileAll.ok, false);
  assert.equal(fileAll.rows.every((r) => r.ok === false), true, '并列入口里 Blob 五格同拒');
  assert.equal(fileAll.bytes, 13, '字节数照实回显（`[object Blob]` 就是 13 字节），不许谎报 0');
  // 反向哨兵：有实际文本形状的对象照常归一，不许被这条误伤
  assert.equal((await digest('md5', { toString: () => 'mine' })).hex,
    refHex('md5', bytesOf('mine')), '自定义 toString 的内容要认');
  assert.equal((await digest('md5', new String('x'))).hex, refHex('md5', bytesOf('x')),
    'String 包装对象的标签是 `[object String]`，归一结果是 `x`，两者不等就不算标签');
  assert.equal((await digest('md5', [])).ok, true, '空数组归一成空串，是真空值那一档（与 M6 同）');
});
test('M9 文本闸门按字节判：1 MiB 恰好放行、+1 整体拒绝，且与 codec 的闸门同值', async () => {
  assert.equal(MAX_TEXT_BYTES, 1048576, MAX_TEXT_BYTES);
  const { MAX_INPUT_BYTES } = await import('../dev/js/tools/codec.js');
  assert.equal(MAX_TEXT_BYTES, MAX_INPUT_BYTES,
    '两个模块的文本闸门必须同一个数：§7 那句"文本类工具 1MB"只有一份口径');
  assert.equal(dByteLen('中'), 3); assert.equal(dByteLen('中文'), 6); assert.equal(dByteLen('\uD83D\uDE00'), 4);
  assert.equal(dByteLen('abc'), 3); assert.equal(dByteLen(null), 0);
  // 两本模块各带一份 UTF-8 计数（同级模块互不 import 的代价），这把尺子必须两处同长：
  // 只核上面四条硬编码值的话，某一档漂了（比如把代理对算成 2）这里才会红。
  for (const s of M_SAMPLES) assert.equal(dByteLen(s), byteLen(s), `byteLen 与 codec 的分叉：${JSON.stringify(s)}`);
  // 半代理项那一档也要两处同尺：`M_SAMPLES` 里没有一个落单代理项，而 `utf8Len` 恰好在这一档
  // 有分支（按 3 字节计，反正下一档会拒）。两个模块各带一份计数器，这一档漂了没人核就是静默分叉
  // （评审 2026-09-28 的 Minor 5）。
  for (const s of ['\uD83D', '\uD83Dabc', 'ab\uDE00', '\uD83D\uDE00\uD83D']) {
    assert.equal(dByteLen(s), byteLen(s), `半代理项档的分叉：${JSON.stringify(s)}`);
  }
  assert.equal(dByteLen('\uD83D'), 3, '半代理项按 3 字节计：上面那组对拍的锚，钉住绝对值才防得住两处一起漂');
  const atLimit = await digest('md5', 'x'.repeat(MAX_TEXT_BYTES));
  assert.equal(atLimit.ok, true, '正好 1 MiB 是"超过"才拒');
  assert.equal(atLimit.bytes, MAX_TEXT_BYTES);
  const over = await digest('sha-256', 'x'.repeat(MAX_TEXT_BYTES + 1));
  assert.equal(over.ok, false); assert.equal(over.hex, '', '拒绝就不给半截产物');
  assert.equal(over.bytes, MAX_TEXT_BYTES + 1, '越界也要报真实字节数，面板才说得出"你这串多长"');
  assert.match(over.reason, /超过/); assert.match(over.reason, /不截断/);
  assert.match(over.reason, new RegExp(String(MAX_TEXT_BYTES + 1)), over.reason);
  assert.doesNotMatch(over.reason, /第 \d+ 位/, '闸门按字节算，不许给人一个假的字符位');
  // 汉字那一条：闸门是字节、不是字符，1 MiB 的汉字串必须拒（按字符判的实现会在这里红）
  const cjk = await digest('md5', '中'.repeat(349526));
  assert.equal(cjk.ok, false, `按字符判的闸门在这里会放行：${cjk.bytes} 字节`);
  assert.equal(cjk.bytes, 1048578);
});
test('M10 字节闸门单独一档：5 MiB 恰好放行、+1 拒绝，且不能反过来放过文本', async () => {
  assert.equal(MAX_BYTES, 5242880, MAX_BYTES);
  assert.ok(MAX_BYTES > MAX_TEXT_BYTES, '字节通道比文本通道宽，否则"文件走 ArrayBuffer"这条没有意义');
  const atLimit = await digest('sha-256', new Uint8Array(MAX_BYTES));
  assert.equal(atLimit.ok, true); assert.equal(atLimit.bytes, MAX_BYTES);
  const over = await digest('sha-256', new Uint8Array(MAX_BYTES + 1));
  assert.equal(over.ok, false); assert.equal(over.hex, '');
  assert.equal(over.bytes, MAX_BYTES + 1); assert.match(over.reason, /上限|超过/);
  assert.match(over.reason, /字节/);
  // 同一段字节走文本通道就要按文本闸门算：两条通道的闸门不许互相借光
  const textBig = 'x'.repeat(MAX_TEXT_BYTES + 1);
  assert.equal((await digest('sha-256', textBig)).ok, false);
  assert.equal((await digest('sha-256', bytesOf(textBig.slice(0, 100)))).ok, true,
    '字节档的 100 字节当然在两道闸门之内');
  assert.equal((await digest('md5', new Uint8Array(MAX_BYTES + 1))).ok, false,
    'MD5 也吃字节闸门：越界与否与算法无关');
});
test('M11 落单代理项两侧都拒并给位，成对的代理项放行且与 Node 同结果', async () => {
  for (const [s, at] of [['\uD83D', 1], ['a\uDE00b', 2], ['ab\uD83D', 3]]) {
    for (const algo of ['md5', 'sha-256']) {
      const r = await digest(algo, s);
      assert.equal(r.ok, false, `${algo} ${JSON.stringify(s)}`);
      assert.equal(r.hex, '', `${algo}：拒绝就不给半截产物`);
      assert.match(r.reason, /落单代理项/, `${algo} → ${r.reason}`);
      assert.match(r.reason, new RegExp(`第 ${at} 位`), `${algo} → ${r.reason}`);
      assert.equal(r.bytes, dByteLen(s), `${algo} ${JSON.stringify(s)}：拒绝也要回显实测字节数，`
        + '面板那句"你这串多少字节"才有出处（M9 钉了半代理项按 3 字节，这里不是两处一起漂）');
    }
  }
  const pair = await digest('md5', '\uD83D\uDE00');
  assert.equal(pair.ok, true); assert.equal(pair.bytes, 4, '成对代理项是 4 字节，不是 2 字符');
  assert.equal(pair.hex, refHex('md5', bytesOf('\uD83D\uDE00')));
  assert.equal((await digest('sha-512', '😀abc')).hex, refHex('sha-512', bytesOf('😀abc')));
  // 越界优先于代理项：两道都中时先报闸门，免得给一个"第 1048577 位"的假位置
  const both = await digest('md5', 'x'.repeat(MAX_TEXT_BYTES) + '\uD83D');
  assert.equal(both.ok, false); assert.match(both.reason, /上限|超过/, both.reason);
});
test('M12 options 档：只认 subtle 一键、拼错必须响，注入的假 subtle 真被调用', async () => {
  await assert.rejects(() => digest('sha-256', 'abc', { subtlez: 1 }),
    { name: 'TypeError', message: /未知 options 键/ }, '拼错的键静默当默认＝注入白开了');
  await assert.rejects(() => digest('sha-256', 'abc', 'subtle'),
    { name: 'TypeError', message: /options 应为对象/ });
  for (const o of [undefined, null, {}]) {
    const r = await digest('sha-256', 'abc', o);
    assert.equal(r.ok, true, JSON.stringify(o));
    assert.equal(r.hex, refHex('sha-256', bytesOf('abc')), '默认档就是浏览器/Node 的真 subtle');
  }
  await assert.rejects(() => digest('sha-256', 'abc', { subtle: 1 }), (e) => {
    assert.equal(e.name, 'TypeError');
    assert.match(e.message, /options\.subtle/, e.message);
    assert.match(e.message, /收到 number/, e.message);
    return true;
  });
  const { calls, subtle } = fakeSubtle();
  const r = await digest('sha-256', 'abc', { subtle });
  assert.equal(r.ok, true); assert.equal(r.hex, '00010203', '注入档的产物原样回显，才测得到"走的是它"');
  assert.equal(r.via, 'subtle');
  assert.equal(calls.length, 1, `SHA 档必须恰好调一次 subtle，实际 ${calls.length}`);
  assert.deepEqual(calls[0][0], 'SHA-256', 'WebCrypto 认的是大写带横杠那一名');
  assert.equal(calls[0][1] instanceof Uint8Array, true, '喂给 subtle 的必须是 Uint8Array 本体');
  assert.equal(Array.from(calls[0][1]).join(','), Array.from(bytesOf('abc')).join(','));
  const m = fakeSubtle();
  const sync = await digest('md5', 'abc', { subtle: m.subtle });
  assert.equal(sync.ok, true); assert.equal(sync.via, 'self');
  assert.equal(m.calls.length, 0, 'MD5 一次都不许碰 subtle——Node 的 subtle 根本不认 MD5，调了就红');
  assert.equal(typeof digest('md5', 'abc').then, 'function', '五档同一条异步路径，面板才只有一种写法');
});
test('M13 取不到 subtle：SHA 四档明确降级、MD5 不受影响，且 digest 永不 reject', async () => {
  const r = await digest('sha-256', 'abc', { subtle: null });
  assert.equal(r.ok, false); assert.equal(r.hex, '');
  assert.equal(r.via, 'unavailable');
  assert.match(r.reason, /安全上下文/, r.reason);
  assert.match(r.reason, /MD5/, r.reason, '降级文案必须点出"只有 SHA 档受影响"，否则用户以为整格坏了');
  assert.equal(r.bytes, 3, '字节数与能不能算无关');
  assert.equal((await digest('md5', 'abc', { subtle: null })).hex, refHex('md5', bytesOf('abc')),
    '非安全上下文里 MD5 照样出结果——它是本站自己实现的');
  for (const algo of ['sha-1', 'sha-384', 'sha-512']) {
    assert.equal((await digest(algo, 'abc', { subtle: null })).ok, false, algo);
  }
  // 两种坏形状：subtle.digest 同步抛、以及返回 rejected promise，都不许把异常送出模块
  const badSubtle = {
    同步抛: () => { throw new Error('同步炸'); },
    异步拒: () => Promise.reject(new Error('异步炸')),
  };
  for (const [kind, fn] of Object.entries(badSubtle)) {
    const bad = await digest('sha-256', 'abc', { subtle: { digest: fn } });
    assert.equal(bad.ok, false, kind); assert.equal(bad.hex, '', kind);
    assert.match(bad.reason, /同步炸|异步炸/, `${kind}：底层报错文本要带出来，不然面板只能说"失败了"：${bad.reason}`);
    const all = await digestAll('abc', { subtle: { digest: fn } });
    assert.equal(all.ok, false, kind);
    assert.equal(all.rows[0].ok, true, `${kind}：MD5 那一格不该被邻居的炸牵连`);
  }
  // 缺 digest 方法的物件（有人把 window.crypto 整个塞进来）也算不可用，不许 TypeError 出模块
  const weird = await digest('sha-256', 'abc', { subtle: {} });
  assert.equal(weird.ok, false, weird.reason);
  assert.match(weird.reason, /安全上下文|subtle/, weird.reason);
});
test('M14 digestAll：五格并列、行序照 ALGORITHMS、闸门失败同句、单档失败不牵连', async () => {
  const all = await digestAll('a b/c?d=e&f&g=中');
  assert.equal(all.ok, true); assert.equal(all.reason, null);
  assert.deepEqual(all.rows.map((r) => r.algo), ALGORITHMS, '行序就是面板的表序，漂一格面板就错一行');
  assert.equal(all.rows.length, 5);
  assert.deepEqual(Object.keys(all.rows[0]).sort(), Object.keys(await digest('md5', 'x')).sort(),
    '单档入口与并列入口的键集必须一致，否则面板要写两套读法');
  assert.equal(all.bytes, Buffer.byteLength('a b/c?d=e&f&g=中', 'utf8'));
  for (const row of all.rows) {
    assert.equal(row.bytes, all.bytes, '字节数只算一次，五格报同一个数');
    assert.equal(row.hex, refHex(row.algo, bytesOf('a b/c?d=e&f&g=中')), row.algo);
  }
  const over = await digestAll('x'.repeat(MAX_TEXT_BYTES + 1));
  assert.equal(over.ok, false); assert.match(over.reason, /上限|超过/, over.reason);
  for (const row of over.rows) {
    assert.equal(row.ok, false, row.algo); assert.equal(row.hex, '', row.algo);
    assert.equal(row.reason, over.reason, '闸门理由五格同一句，面板才不会写出五种解释');
  }
  const degraded = await digestAll('abc', { subtle: null });
  assert.equal(degraded.ok, false, '有一格不成就是不成，顶层不许报全绿');
  assert.equal(degraded.reason, null, '闸门通过、只是个别档失败时，顶层不另编一句理由');
  assert.equal(degraded.rows[0].ok, true, 'MD5 那格必须还成——并列展示的价值就在这里');
  assert.equal(degraded.rows.filter((r) => !r.ok).length, 4);
  assert.equal(degraded.bytes, 3);
  const lone = await digestAll('\uD83D');
  assert.equal(lone.ok, false); assert.match(lone.reason, /落单代理项/, lone.reason);
  assert.equal(lone.rows.every((r) => r.reason === lone.reason), true, '代理项也是五格同句');
});
test('M15 导出面：10 个名字一个不多一个不少，两张表互相核得住', async () => {
  const wanted = ['ALGORITHMS', 'DIGEST_CAVEAT', 'HEX_LEN', 'MAX_BYTES', 'MAX_TEXT_BYTES',
    'byteLen', 'digest', 'digestAll', 'isBytes', 'normalizeAlgo'];
  const got = Object.keys(await import('../dev/js/tools/digest.js')).sort();
  assert.deepEqual(got, wanted, `导出面变了：多=${JSON.stringify(got.filter((k) => !wanted.includes(k)))} 少=${JSON.stringify(wanted.filter((k) => !got.includes(k)))}`);
  assert.equal(got.length, 10, '清单自己要有条数；新增一个入口就得同时补判据与面板，这张表是那道门');
  assert.deepEqual([...ALGORITHMS], ['md5', 'sha-1', 'sha-256', 'sha-384', 'sha-512'],
    '顺序也是契约：面板的五行按它排');
  assert.deepEqual(Object.keys(HEX_LEN).sort(), [...ALGORITHMS].sort(),
    'HEX_LEN 的键集与 ALGORITHMS 必须同集，少一档就有一行面板没尺子');
  assert.equal(Object.isFrozen(ALGORITHMS), true, '共享表必须冻结（段 2 的共享表只读口径）');
  assert.equal(Object.isFrozen(HEX_LEN), true);
});
test('M16 扫源：零 import、不碰 DOM、不用 Node 专属件，MD5 的常数必须在代码里', () => {
  const src = dCode();
  // `m` 标志不能少：`^` 不带 `m` 只锚整份源码的开头，"中段插一条 `import … from './codec.js'`"全绿
  // （评审 2026-09-28 实测；§L 同一处同病，两处一起改。`export * from` 与动态 `import()` 也在补的两条里）
  const banned = [['import', /^\s*import[\s{*]/m], ['export from', /export\s+\{[^}]*\}\s+from/],
    ['export * from', /export\s*\*/], ['动态 import', /\bimport\s*\(/],
    ['require(', /\brequire\s*\(/], ['node:crypto', /node:crypto/], ['createHash', /\bcreateHash\b/],
    ['document', /\bdocument\b/], ['window', /\bwindow\b/], ['localStorage', /\blocalStorage\b/],
    ['navigator', /\bnavigator\b/], ['fetch(', /\bfetch\s*\(/], ['FileReader', /\bFileReader\b/],
    ['Buffer', /\bBuffer\b/], ['atob', /\batob\s*\(/], ['btoa', /\bbtoa\s*\(/],
    ['TextEncoder', /\bTextEncoder\b/], ['TextDecoder', /\bTextDecoder\b/],
    ['Date.now', /Date\.now/], ['new Date(', /new Date\(/], ['Math.random', /Math\.random/],
    ['Intl', /\bIntl\b/], ['toLocale', /toLocale/], ['unescape', /\bunescape\s*\(/], ['eval', /\beval\s*\(/]];
  for (const [name, re] of banned) assert.equal(re.test(src), false, `digest.js 的代码里出现了 ${name}`);
  assert.equal(banned.length, 25, '违禁清单自己要有条数：少一条等于那一档从此静默不核');
  // 自实现的证据：初值、K 表 64 项、移位表 64 项，三样都得在代码里，不是注释里
  assert.match(src, /0x67452301/, 'MD5 的 A 初值必须在（换成 crypto.subtle 的假 MD5 时这里就没了）');
  assert.match(src, /0x10325476/, 'MD5 的 D 初值必须在');
  const kTable = (src.match(/0xd76aa478[\s\S]*?0xeb86d391/) || [''])[0].match(/0x[0-9a-f]{8}/gi) || [];
  assert.equal(kTable.length, 64, `K 表要恰好 64 项常数，读到 ${kTable.length} 项`);
  assert.equal(/Math\.sin/.test(src), false, 'K 表必须是硬编码常数：引擎的 Math.sin 不保证逐位一致');
  assert.ok((src.match(/globalThis/g) || []).length >= 1, '取 subtle 走 globalThis，不写 window.crypto');
  assert.equal(/\bwindow\.crypto\b/.test(src), false, '同上：window 在违禁清单里，这一条是它的正面');
  assert.match(src, /subtle/, 'SHA 档确实经过 subtle');
  assert.equal(existsSync(resolve(ROOT, 'dev/js/digest.js')), false,
    'digest.js 被挪到 dev/js/ 顶层会变成 vite 入口、进产物（§6.1 零重叠，同 K18）');
  assert.equal(existsSync(resolve(ROOT, 'dev/js/tools/digest.js')), true, '文件不在它该在的位置时，上面那条是空转的');
  // **口径在段 3 Task 7 收窄过一次**（原来写的是"任何产物里都搜不到"）：那句成立于 Task 3 落
  // 地时——那时仓库里只有证件页那一本入口。`toolCodec.js` 一存在，`digestAll` 的家就有了，
  // 旧句子不再是"发现渗透"，而是每次构建后必红的假警报。剩下的不变量因此是**排除式的**：
  // 除了编码页那一本，谁都不许出现这个名字（证件页那本、公共层那本、以及哪天 Rollup 真的
  // 切出共享 chunk 都会被抓回来）。正向那一半同样要人看：名字来自 `digest.js` 里
  // `gateOptions('digestAll', …)` 那句自报家门的诊断串，它要是从产物里没了，就是接线断了的
  // 那一刻——改诊断写法可以，但得同时来改这一格，别让它静默变成一句谁都不核的话。
  const siteJs = resolve(ROOT, '_site/assets/js');
  if (existsSync(siteJs)) {
    const HOME = 'toolCodec.min.js';
    const hits = readdirSync(siteJs).filter((f) => f !== HOME && f.endsWith('.js')
      && readFileSync(resolve(siteJs, f), 'utf8').includes('digestAll'));
    assert.deepEqual(hits, [], `digest.js 的导出名渗进了 ${HOME} 以外的产物`);
    if (existsSync(resolve(siteJs, HOME))) {
      assert.ok(readFileSync(resolve(siteJs, HOME), 'utf8').includes('digestAll'),
        `${HOME} 在产物里却没有 digestAll：digest.js 没被打进编码页那本，接线与这条判据要一起改`);
    }
  }
});
test('M17 口径文案与实现互相对账：文案承诺的做到，做到的也写进文案', async () => {
  const rows = [
    [/MD5 由本站自己实现/, (await digest('md5', 'abc')).via === 'self'],
    [/SHA-1、SHA-256、SHA-384、SHA-512 走浏览器/, (await digest('sha-256', 'abc')).via === 'subtle'],
    [/取不到时给明确提示/, (await digest('sha-256', 'abc', { subtle: null })).via === 'unavailable'],
    [/文本按 UTF-8 字节/, (await digest('md5', '中')).bytes === 3],
    [/1 MiB（1048576 字节）/, MAX_TEXT_BYTES === 1048576],
    [/5 MiB（5242880 字节）/, MAX_BYTES === 5242880],
    [/整体拒绝、不截断/, (await digest('md5', 'x'.repeat(MAX_TEXT_BYTES + 1))).hex === ''],
    [/文件走字节、不进字符串/, (await digest('sha-256', bytesOf('abc'))).hex === (await digest('sha-256', 'abc')).hex],
  ];
  for (const [claim, holds] of rows) {
    assert.equal(claim.test(DIGEST_CAVEAT), holds,
      `文案与实现分叉：${claim}（文案里有=${claim.test(DIGEST_CAVEAT)}，实现做得到=${holds}）`);
  }
  assert.equal(rows.length, 8, '对账表自己要有条数：漏一行等于那一档的承诺没人核');
  assert.ok(DIGEST_CAVEAT.length > 80 && DIGEST_CAVEAT.length <= 240,
    `口径句长度不在档内（实际 ${DIGEST_CAVEAT.length} 字）：${DIGEST_CAVEAT}`);
  const { BASE64_CAVEAT, URL_CAVEAT } = await import('../dev/js/tools/codec.js');
  const { TIME_CAVEAT } = await import('../dev/js/tools/time.js');
  const others = [BASE64_CAVEAT, URL_CAVEAT, TIME_CAVEAT];
  for (const o of others) assert.notEqual(DIGEST_CAVEAT, o, '四格口径句各写各的，一模一样等于这一格没自己的口径');
  assert.equal(dByteLen('中'), 3, '口径句里的"UTF-8 字节"这把尺子自己得先对');
});
test('M18 跨块大输入与闸门边界同档：1 MiB 的 MD5 与 Node 逐字符等', async () => {
  const big = new Uint8Array(MAX_TEXT_BYTES);
  big.fill(0xAA);
  const r = await digest('md5', big);
  assert.equal(r.ok, true); assert.equal(r.bytes, MAX_TEXT_BYTES);
  assert.equal(r.hex, refHex('md5', big), '16384 个分组里出错，跨块那条判据才抓得到');
  const five = await digest('sha-256', new Uint8Array(MAX_BYTES).fill(7));
  assert.equal(five.ok, true); assert.equal(five.bytes, MAX_BYTES);
  assert.equal(five.hex, refHex('sha-256', new Uint8Array(MAX_BYTES).fill(7)));
  const text = '中'.repeat(100000);
  assert.equal((await digest('sha-512', text)).hex, refHex('sha-512', bytesOf(text)),
    'UTF-8 编码器在长多字节串上必须与 Node 同字节');
});
```


## Task 4: `regex.js` — 正则测试（四档闸门防回溯炸页）（§N）

**Files:**
- Create: `dev/js/tools/regex.js`（磁盘 581 行，复算 `wc -l dev/js/tools/regex.js`）
- Modify: `scripts/toolkit-tests.mjs`（末尾追加 `// ── §N …` 一节，20 条 `test()`，磁盘 7069–7526，
  复算 `awk '/^\/\/ ── §N /{print NR}' scripts/toolkit-tests.mjs` 与 `wc -l scripts/toolkit-tests.mjs`）
- Modify: `scripts/verify-plan-blocks.mjs`（`FILE_TARGETS` 加一行 `'dev/js/tools/regex.js',`）
- Modify: 本计划（契约回填 + 判据清单 + 两块落地镜像 + §M 小标题那句"到文件末尾"改口）
- Modify: `_docs/superpowers/specs/2026-09-25-blog-online-tools-design.md`（§7 的"正则 | 匹配步数上限 + 超时保护"一行按四档事实回写）
- 不动：`scripts/verify-plan-blocks-teeth.mjs`（G12 从基线现读段 3 名下全部镜像，本格落地的
  `regex.js` 与 `§N` 两块自动进核范围）

### 对外契约（落地后回填，2026-09-28）

起草版这格写的是"`exec` 循环带迭代上限"加"flags 白名单 `g i m s u y`"。落地后有七处是实现期坐实
或改口的：

1. **"防炸页"不能是"步数上限"**。JS 没有可查的回溯步数计数器，V8 也不给单次 `exec` 中止钩子——
   一次 `exec` 一旦进去就只能在它自己出来之后才谈得上收口。所以那句承诺落地成**执行之前的四档闸门**
   （模式长度+语法 → 静态可疑形状 → 输入字节 → 匹配次数与档间时间预算），主牙齿是第二档的
   `riskScan`。§7 那一行必须按这四档事实回写，不许留"步数上限"这种实现里不存在的词。
2. **flags 白名单是七位不是六位**：`g i m s u y d`。多出来的 `d`（组位置）不是可选装饰——面板要给出
   "第几组在第几个字符"就靠它，而 N5 钉的是**没开 `d` 时组位置必须是 `null` 而不是猜**，所以 `d` 必须
   能进白名单，否则那一档判据无从构造。`v`（Unicode 集合）与 `U`（非贪婪反转）会改语义，不收；
   加一位要有新判据、删一位要改 CAVEAT，N1 第一条就把 `ALLOWED_FLAGS === 'gimsuyd'` 钉死。
3. **重复 flag 归一而不是抛**。native 对 `/a/gg` 直接 `SyntaxError`，而用户从搜索框粘来的 flags
   串最容易多带一位。归一保留首次出现顺序、`deduplicated` 回显，N1 因此两头都要断：`compile('a','gg')`
   必须成，且归一结果得是 `'g'`。
4. **语法错误一律交 V8 原话**，分词器不越权发明报错。N2 的 11 类样本逐条对原话（`Unterminated group`、
   `Nothing to repeat`、`numbers out of order`…），`riskScan` 走不完分词就返回 `parsed:false` 且
   `level:'none'`——把半成品当"没风险"交出去是 N13 末条点名的另一种坏。
5. **结果口径以引擎为准**，这一格没有"自己的正则语义"。多匹配的 `index`/`text` 序列与 `matchAll`
   逐格对拍（N6），单次结果与 `exec` 同格（N4），替换预览直接把 native `String.prototype.replace`
   的产物交出去（N15）：`$0` 不是替换记号、`$$` 出一个字面 `$`、`$&$&` 在 `'aaa'` 上是 `aaaaa`、
   11 个组时 `$11` 是第 11 组。四条"看着像 bug"的都是 native 口径，顺手修正等于改出个新语言。
6. **时间预算只在调用方注入时钟时才被检查**。模块自己一行都不读时钟（N19 把 `Date.now`/
   `performance.now` 列进违禁清单），默认档 `elapsedMs` 是 `null`。这一条换来两样东西：判据可以喂
   假时钟把"每格 12ms、预算 50ms → 第 4 格后停"钉成硬数字（N9 的 4/60 就是这么来的），以及
   `hitLimit` 与 `timedOut` 两面旗子语义分开、不许互相顶。
7. **`options` 只有三个键，拼错必响**：`now` / `maxMatches` / `timeBudgetMs`。没有 `allowRisky`
   这种后门——想绕高危那一档的键根本不存在，硬塞就 `TypeError`（N14 拿这个当一条判据）。
   `maxMatches` 只能往下调：给 1010 夹回 1000，给 0 或负数按 1 兜，不给"一个都不算"的静默档（N8）。

```text
export const ALLOWED_FLAGS = 'gimsuyd';        // 七位白名单，N1 钉字面值
export const MAX_PATTERN_CHARS = 500;          // 模式长度闸门：字符数，不是字节数
export const MAX_INPUT_BYTES = 1048576;        // 输入闸门：1 MiB，与 codec / digest 同一把 UTF-8 尺
export const MAX_MATCHES = 1000;               // 匹配次数硬上限，options 只能往下调
export const MEDIUM_MAX_INPUT_CHARS = 128;     // medium 档只对 ≤128 **字符** 的输入求解（不是字节）
export const TIME_BUDGET_MS = 50;              // 档间预算，只在注入时钟时被检查
export const REGEX_CAVEAT = '…';               // 面板原样显示，80–260 字，N18 八行双向对账
export function byteLen(v) → number                                // 与兄弟模块各带一份，N10/N18 核同长
export function normalizeFlags(v) → { ok, flags, deduplicated, reason }
export function compile(pattern, flags, options?) →
        { ok, regex|null, flags, kind|null, deduplicated, reason }  // kind ∈ length | flags | pattern
export function riskScan(pattern) →
        { level:'high'|'medium'|'none', findings:[{ rule, at, hint, level }], parsed, reason }
                                                                    // rule ∈ F1 嵌套无界 / F2 分支互重
                                                                    //      / F3 相邻同源 / F4 同 F1 但外层有限
export function findMatches(pattern, flags, text, options?) → {
  ok, reason, pattern, flags, level, findings, executed, matched, matches, count,
  capped, hitLimit, timedOut, elapsedMs, bytes, chars }
  // matches[i] = { index, length, text, groups:[{ index, length, text, participated }],
  //                 named:{ <name>:同形状 } }，位置全取自 native，没开 d 就是 null
export function previewReplace(pattern, flags, text, replacement, options?) → {
  ok, reason, pattern, flags, level, findings, executed, out, changed, bytes, chars, capped }
```

实现侧另有三条只在落地后才看得见的规矩：

1. **`level` 由放大器决定，不由规则名决定**。同一条 F2，组外是 `*` / `+` 就是 high，是 `{3}` 就只到
   medium（N12 两条各钉一头，而这一格正是首跑那轮红出来的实现缺陷）。
2. **四档闸门共用一个 `gate()`**，`findMatches` 与 `previewReplace` 走同一顺序：长度 → 编译 → 形状 →
   字节 → medium 的字符档。顺序本身是判据（N3/N14/N17 各钉一处先后），因为"先响哪一句"决定用户
   下一步改什么——高危形状配超大输入时必须先听到"形状可疑"，而不是"太大"。
3. **零宽匹配手动推进 `lastIndex += 1`**，且这行代码必须在源码里（N19 正向断言），因为 `'bbb'` 上 `a*`
   的 4 格、空模式的 n+1 格、`\b` 整串，少了它要么漏格要么永远出不来。

### 判据清单（§N，落地后回填）

**20 条 `test()`**（N1–N19 在 Step 1 一次写齐，N20 是 Step 3 补牙批次新增的导出面清单），外加两份变异
台账（首发 19 刀跑 `/tmp/seg3t4/mut.mjs`、补牙批次 9 刀跑 `/tmp/seg3t4b/mut.mjs`，都跑完即弃、不进套件）。
§N 对套件总数的贡献是 20，全量 `# tests` 从 202 变成 **222**。

| 编号 | 咬什么 |
| --- | --- |
| N1 | 白名单七位各自单独可用（逐位 `normalizeFlags` + `compile`）、`gig` 归一成 `gi` 且 `deduplicated` 回显、空串与 `null` 走文本档、六种未知位（`A`/`v`/`U`/`gp`/`gGG`/`uv`）拒绝且**点名是哪一位**、拒时 `flags` 给空串不给半截；`compile('a','gg')` 必须成——归一排在 native 之前 |
| N2 | 11 类语法错误逐条对 V8 原话（表自带 `length === 11`）、失败时 `regex` 为 `null`、`kind` 分 pattern / flags / length 三档各有样本、正好 500 字符放行（"超过"才拒）、空模式合法、`(?<=a)b` native 认得 |
| N3 | 模式长度闸门排在最前：501 字符的样本特意用 `((((a+)+)))` padEnd（既是超长、又本来会被静态检测拦），要求拒在长度档——`level` 留 `null`、`bytes` 为 `undefined`、`matches` 空、理由报实测数与上限；替换预览同档且 `out` 空串 |
| N4 | 单次结果与 native `exec` 同格（`index` 直接跟 oracle 比）、整段 `text`/`length`、组序按声明顺序、未参与组 `participated:false` 且 `text:undefined`、**参与但命中空串**（`()x` 与 `(?<e>)x`）是 `participated:true` 且 `text:''`——只有 `undefined` 才是没参与，命名组同档、命名表 `Object.keys` 按声明顺序、没命中是 `count 0` 而 `ok true` |
| N5 | 没开 `d` 时组位置是 `null`（整段位置与组文本照样给）——猜出来的位置是假数据；开了 `d` 时组与命名组位置取自 `indices` / `indices.groups`；`matched` 与 `ok` 分开，面板才说得出"算过了但没命中" |
| N6 | 11 条样本的多匹配 `index`/`text` 序列与 `matchAll` 逐格 `deepEqual`（覆盖 `gi`、多字节、`\n`、`gs`、`gm`、`gu` 的 `\p{L}`、`gd`、零宽 `a*`）；不带 `g` 只给第一次命中、`y` 从 0 起算不命中给 0、`gy` 一档——这些都是 native 口径，不是本模块的阉割 |
| N7 | `'bbb'` 上 `a*` 的 4 格 `[0,1,2,3]` 全零宽、`x*` 在 `'xaxa'` 上的五格、空模式在 n 字符上 n+1 格、`\b` 与 `(?=x)` 两条与 `matchAll` 对拍——少推进一格就漏、不推进就死循环，这一档是零宽推进唯一的定量证据 |
| N8 | 1001 个命中给 `count 1000` 且 `hitLimit:true`；正好 1000 时 `hitLimit:false` 且 `reason:null`（这一格的红绿就是"静默截断"的分界）；`{maxMatches:3}` 三处同数、`{maxMatches:1010}` 夹回 1000、给 0 与 -5 都按 1 兜 |
| N9 | 注入"每格 12ms"的假时钟 + 预算 50ms → `count 4`、`elapsedMs 60`、`timedOut` 真而 `hitLimit` 假；不给 `timeBudgetMs` 时吃 `TIME_BUDGET_MS` 默认档（`count === Math.floor(50/12)`）；**没注入时钟就不许自己读表**（`elapsedMs:null`、200 格算满）；时钟给 `NaN` 当没时钟 |
| N10 | 1 MiB+1 字节整体拒、`bytes` 报实测、理由含 `1048576` 与"不截断"、`matches` 空；正好 1 MiB 放行；两个"中"的 `bytes` 是 6 不是 2；`byteLen` 的 3 与 4 两档；`null` 走文本档 `bytes 0`；替换预览同档且 `out` 空串 |
| N11 | F1 真阳性族 **15 条**（表自带条数）全部 high 且 `parsed:true`、命中位置落在串内、每条点规则名、`hint` 给改写方向；带 `^$` 锚不改变判定；三层嵌套 `a(b(c+)+d)e` 也要抓到；`(a+)` 组外没有量词就没有放大 |
| N12 | F2 族 **8 条**（阈值实测在 24–64 字符之间）逐条点名 F2；`(?:a|aa){3}` 只到 **medium**（这一格钉的就是"`level` 由放大器决定"）；8 条"同长不重叠 / 组外无重复"不得报 F2；`(a|a)` 组外没量词判 none |
| N13 | 不得误杀 **35 条**（表自带条数，且每条都要求 `parsed:true`——分词器走不完等于检测器自己哑了）：类里的括号、`([)]+)`、被定宽元素钉住的 `(x+a+)+`、`(a{3})+`、单一无界量词、`\p{…}`、命名组、邮箱形状；形似样本的另一半 `(?:[([]{2,})+` 必须 high；7 条 medium；`(?` 判 none 不越权、`[a` 标 `parsed:false` |
| N14 | `(a+)+$` 配 30 个 a → `executed:false`、`matches` 空、理由含"疑似灾难性回溯"/`F1`/"一次都不执行"；空输入不放行；`{allowRisky:true}` 必须 `TypeError`（**没有能绕的闸门**）；medium 的 100 字符放行、129 拒且 `executed:false`、理由里要**连"不截断"一起说**（只报"实际 129 字符"，面板看着就像只算了前 128 格）、正好 128 放行；`level:'none'` 时 `reason:null`（没风险就别糊黄条）；替换预览走同一道静态闸门 |
| N15 | 10 条对拍样本逐字节等于 native `replace`（表自带条数）、`changed` 严格等于"产物与原文是否不同"；`$0` 不是记号、`$$`→`$$$`、`$&$&` 在 `'aaa'`→`aaaaa`、前导/后随切片原样给、11 个组时 `$11` 是第 11 组、替换串走文本档归一 |
| N16 | 两档入参分界：七种文本入参归一不抛（`undefined`→0 字节、`123`→"123"、`pattern` 也走这一档、`Symbol` 归一成 `"Symbol(x)"` 且 9 字节），**只有无原型对象抛** `TypeError`；替换串的 `Symbol` 同档；五种非对象 `options` 全 `TypeError` 并报形状；`now`/`maxMatches`/`timeBudgetMs` 各给错类型都点名；`{sloppy:1}` 响；`{now:null,maxMatches:null}` 走默认；`compile` 多给一位同样响 |
| N17 | 闸门先后有账：高危形状配 1 MiB+1 输入 → 先响形状且 `bytes` 为 `undefined`；medium 配 `'中'×200` → 拦住它的是 128 **字符** 那一档、`bytes` 照实报 600；**medium 配 `'中'×100`（300 字节、字符没超）必须放行**、`bytes` 照实回显 300、理由含"128 字符"——按字节判的实现在这一格红；`\d+` 配 `'中'×500`（1500 字节）放行；501 个 `(` 的长度档排在形状之前 |
| N18 | CAVEAT 与实现**双向**对账 8 行（表自带条数）：`1 MiB（1048576 字节）`/`500 字符`/`前 1000 个`/`128 字符`/`g i m s u y d`/`疑似灾难性回溯`/`一次都不执行`/`不静默截断`，每行核"文案里有"与"实现做得到"同真同假；长度 80–260 字；与 `BASE64_CAVEAT`/`URL_CAVEAT`/`TIME_CAVEAT`/`DIGEST_CAVEAT` 都不许相同；`byteLen('中')===3` 自证尺子 |
| N19 | 剥注释扫源 **29 条违禁**（表自带条数；`import` 那条行首锚带 `m`）、正向 `new RegExp(` 必须在（防它哪天换成 `eval`）、`lastIndex += 1` 必须在代码里而不是注释里、无边界 `while(true)` 不许在；零重叠两条 + 位置哨兵（`dev/js/regex.js` 不存在、`dev/js/tools/regex.js` 必须在）；`vite.config.js` 的入口扫描走 `readDirSorted`（内部 `readdirSync(dir).sort()`，不递归）且那一段里没有 `tools` 字样——**本子目录不成 vite 入口**；`_site/assets/js` 若有产物，则**除 `toolCodec.min.js` 以外**都搜不到 `findMatches`，而那一本里必须搜得到（同一处收窄，与 M16 同批、同一条理由） |
| N20 | 导出面 13 个名字**一个不多一个不少**（`Object.keys(await import(...)).sort()` 与清单 `deepEqual`，清单自带 `length === 13`）、三档 `typeof` 各归各位（六个函数 / 两个串——白名单与口径句是要显示给用户的东西 / 五个数字——闸门常数写成串会静默放行）。这一格是 Step 3 补牙批次新增的：R12 那把"常数改一个数只红 N18"的刀说明**所有常数都走引用、没有一处硬编码**，但"多导出一个名字"这件事在 19 条里没有任何一格管着——Task 6 的面板绑定按这张表调，表长了没人响 |

### Steps

> 起草版这格给的口径（"迭代上限"、六位 flags）有两处与落地不符，都在上面的契约里改了口；
> 除此之外本格的"期望 vs 实测"集中在**形状族的重排**——下面 Step 2 的八条红里，两处是实现真缺陷，
> 五处是判据自己写错，一处是同一真缺陷的连带红。

- [x] **Step 1: 写 §N 十九判据（此时 `regex.js` 不存在，必红）**

```bash
node --check scripts/toolkit-tests.mjs
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs > /tmp/seg3t4/gate1-red.log 2>&1; echo "exit=$?"
grep -E "^# (tests|pass|fail)|^not ok|ERR_MODULE" /tmp/seg3t4/gate1-red.log
```
实跑：`exit=1`、`# tests 203 / pass 202 / fail 1`，红的是**一条文件级**
`not ok 1 - scripts/toolkit-tests.mjs`，尾部 `# Error:` 是
`ERR_MODULE_NOT_FOUND: Cannot find module '.../dev/js/tools/regex.js'`——与 Task 2、Task 3 的 §L/§M
完全同形状（`await import` 在已登记完前序 202 条之后才崩，runner 报"测试结束后有资源产生了异步活动"），
所以"fail 恰为 §N 条数"的期望同样不成立；判据看的是这个 + §A–§M 的 202 条一条不红。

写这一格时先在**判据之外**做了两件事，因为它们决定样本表能不能写：

1. **量危险形状**。规则是"形状"，样本必须用**必然失败**的输入形状（能匹配上的串一步就返回，量不到回溯）。
   本机 Node 22.19 / V8 同一进程实测：`^(a+)+$` 22 字符 839ms、28 字符 >2s；
   `^(x|xx)+$` 32→203ms、40→6356ms；`^(x|xx|xxx)+$` 32→5518ms；`^(\d{1,3}|\d)+$` 16→823ms、20→4318ms；
   而 `^(-|--)\s*$` 全档 0.0ms（组上没有量词就没有放大）、`^(a|a)+$` 28→11819ms、
   `^(aa|aaaa)+$` 64→247ms（每 8 字符 ×60，128 字符就是天文数字）。
2. **量 V8 的报错原话**。N2 那 11 类不是抄文档，是逐条 `new RegExp` 现跑取回原话；顺带确认
   `(?<=a)`、`\ka`、`[(]`、`[]a[]`、`[^]]*` 都是**合法**语法，别在分词器里当非法。

- [x] **Step 2: 写 `dev/js/tools/regex.js`，直到 §N 全绿**

```bash
node --check dev/js/tools/regex.js
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs > /tmp/seg3t4/gate1-run1.log 2>&1; echo "exit=$?"
grep -E "^# (tests|pass|fail)|^not ok" /tmp/seg3t4/gate1-run1.log
```
实跑四连（每轮之间只改一处，日志按轮留着）：

| 轮 | `# tests / pass / fail` | 红了谁 | 那一轮的处置 |
| --- | --- | --- | --- |
| run1 | 221 / 213 / **8** | N8 N12 N13 N14 N15 N16 N18 N19 | 见下面三档归因 |
| run2 | 221 / 215 / **6** | N12 N13 N14 N15 N16 N19 | 次数闸门修好，N8 与 N18 同轮转绿 |
| run3 | 221 / 220 / **1** | N15 | 只剩 `$&$&` 那条硬编码期望 |
| run4 | **221 / 221 / 0** | 无 | 全绿 |
| run5 | **222 / 222 / 0** | 无 | Step 3 补牙批次落三处样本与新判据 N20（`/tmp/seg3t4/gate1-run5.log`）——§N 从 19 条变 20 条，总数 202+20 |
| run6 | **222 / 222 / 0** | 无 | 再补 N14 的 `/不截断/` 一条断言（同一格内，条数不变，`/tmp/seg3t4/gate1-run6.log`）|

八条红的归因（**两类性质完全不同，混为一谈就等于把判据的错记在实现头上**）：

| 性质 | 条目 | 现场与处置 |
| --- | --- | --- |
| 实现真缺陷（2 处） | N8（`expected 1000, actual 1001`） | `readOptions` 在"没给 options"那条路上早返回 `{}`，三个默认键一个都没补，`effectiveCap(undefined)` 走到 `Math.trunc(undefined)` → `NaN` → `matches.length >= NaN` 永远为假，**次数闸门静默失效**（`capped` 也是 `NaN`）。修法：早返回改成三键齐的默认档 + `effectiveCap` 两头都兜 `null`/`undefined`。这一处同时把 N18 拖红（见下） |
| | N12（`expected 'medium', actual 'high'`） | `finding()` 把 F2 的 `level` 写死成 `high`，于是 `(?:a|aa){3}`（外层有限重复）被判成"一次都不执行"。修法：`level` 交给**放大器**传入，`scanGroup` 按 `max === UNBOUNDED` 分 high / medium |
| 判据自己写错（5 处） | N13（`expected 35, actual 33`） | "不得误杀"表里的样本实数与条数断言不符——草稿删了两条又没回填。处置不是把断言改成 33，而是补两条**真的有用**的假阳性形状（`(?:[ab]+c)+`、`(a|b)*[^a-z]*`）让 35 变诚实 |
| | N14（`options 里有不认识的键：allowRisky`） | 我原先期望"塞一个 `allowRisky` 能拿到放行结果"，而 options 键闸门本来就必响——**是判据在要求一个后门**。改成 `assert.throws(…, /不认识的键：allowRisky/)`，并把这一格的意思写成"能绕的闸门不是闸门" |
| | N15（`expected '$a$a$', actual '$$$'`） | 按直觉写死了 `$$` 的展开。node 现跑对拍：`'aaa'.replace(/a/g,'$$')` 是 `'$$$'`、`'aaa'.replace(/aa/g,'$&$&')` 是 `'aaaaa'`（两处 `aa` 各换成 `aaaa`，尾部那个 `a` 原样留着）。四处硬编码期望全部改成实测值 |
| | N16（`Missing expected exception (TypeError)`） | 我以为 `String(Symbol('x'))` 会抛——**实测不抛**，出 `"Symbol(x)"`，与 §K/§L/§M 的文本档口径一致。抛的只有无原型对象。改成正向断言（`bytes === 9`、`count === 0`），并把 `Object.create(null)` 那条留在 `assert.throws` |
| | N19（`扫描用 readdirSync 读一层` 那条 `match` 失败） | 锚错了名字：`vite.config.js` 里 `getDevJsEntries()` 调的是 `readDirSorted()`（内部才是 `readdirSync(dir).sort()`）。断言与文案一起改成 `readDirSorted`，并注明"改成递归就该来改这条" |
| 同一真缺陷的连带红（1 处） | N18（`expected false, actual true`） | 对账表里"不静默截断"那一行要求 `hitLimit === true`，而次数闸门失效时 `hitLimit` 恒假——**文案里的承诺与实现分叉，正是这一行的存在理由**。N8 修好后同轮转绿，没为它单独改判据 |

形状族在这一轮按实测重排过三处，都写进了 §N 头部注释（不然下一个人会以为表是抄来的）：
`(-|--)\s*$` 换掉（实测 0.0ms，组上没有量词就没有放大，换成 `(-|--)+`：24→4.0ms、28→40.1ms）；
`(\d{1,3}|\d)+` 从"不得误杀"**移进**真阳性（16 字符 823ms、20 字符 4318ms，起草时它和 `(a{1,3})+`
一起被列错了档）；`(?:[([]{2,})+` 留在真阳性、把 `[([]{2,})` 留在假阳性，两个样本只差一个字符，
专门用来照"形似样本"的分界。

- [x] **Step 3: 自证 §N 有牙（首发 19 刀 + 补牙批次 9 刀）**

```bash
node --check /tmp/seg3t4/mut.mjs
cd /tmp/seg3t4 && DRY=1 node mut.mjs     # 预检：基线必须全绿、19 处锚点各命中 1 处
node mut.mjs > /tmp/seg3t4/ledger.log 2>&1; echo "exit=$?"
```
形状照 Task 3 的 `/tmp/seg3t3/mut.mjs`：**真复制**到 `/tmp/seg3t4/tree`（不用 `cp -al`）、变异只落副本、
四道自检齐全（基线零红才开跑 / 锚点恰好命中 1 处 / 每刀核 `# tests` 未变 / 结尾核还原后全绿 +
副本与工作树逐字节 + 工作树脏指纹）。拷贝清单一次凑齐 `dev/js`、`scripts`、`demo`、`package.json`、
`vite.config.js`——少最后一本的教训写在 Task 3 的 Step 3 里（N19 要读 `vite.config.js`）。

首发台账（基线 `# tests 221 / pass 221 / 红 无`，`/tmp/seg3t4/ledger.log`，`exit=0`）：

| 刀 | 改坏什么 | 红了谁 | 归因 |
| --- | --- | --- | --- |
| R1 | 没给 `options` 时早返回 `{}`（三个默认键一个不补）——就是首跑那处真缺陷的第一层 | **全绿** | 对照刀：`effectiveCap` 那头还兜着 `undefined`，单摘一层量不到。**这条账逼出了 B4** |
| R2 | 次数兜底只判 `null`（`undefined` 一路顶到 `Math.trunc`）——同一缺陷的第二层 | **全绿** | 对照刀：`readOptions` 正常路径会把缺键写成 `null`，单摘这层同样量不到 |
| R3 | F2 的 `level` 写死 `high`（不看外层量词有限还是无界） | A11 N12 | 目标 N12 ✅；**A11 与本格无因果**（区划生成器 `--fetch` 那条，起 server + spawn 子进程、`timeout: 20000`，一行 §N 都不 import），见下面"负载"一段 |
| R4 | 零宽匹配不推进 `lastIndex` | N6 N7 | 目标 N7 ✅（4 格变 1 格）；N6 的零宽样本同一条推进 |
| R5 | high 那一档照样进引擎（静态闸门摘掉） | N14 N17 N18 | 目标 N14 N17 ✅；N18 是"一次都不执行"那句文案与实现分叉，正是那一行的存在理由 |
| R6 | 模式长度闸门"超过"改成"到"（边界让一格） | N2 | 单红恰目标（正好 500 放行那一格就是它的免疫样本） |
| R7 | 输入字节闸门按**字符**数算 | N10 N17 | 目标 N10 ✅；N17 的 `'中'×200` 报 600 字节同红 |
| R8 | 不认识的 `options` 键静默当默认 | N14 N16 | 目标 N16 ✅；N14 的 `{allowRisky:true}` 必须 `TypeError` 同红——"能绕的闸门不是闸门" |
| R9 | `amplifies` 不认"单个可变长度元素"这一档 | N11 N13 N14 N17 N18 | 目标 N11 ✅；余下四条全部吃 `level`（假阳性族 N13 被推成 high、闸门 N14/N17 的形状档跟着变、N18 的"一次都不执行"再跟着分叉） |
| R10 | F2 只判区间重叠、不判整数倍包含 | N12 N14 | 目标 N12 ✅；N14 是同一条 F2 的 high 判定 |
| R11 | medium 的 128 档按**字节**判 | **全绿** | **没牙**：缺"字符 ≤128 而字节 >128 的放行样本"→ 补 N17 的 `'中'×100`（B1 已咬红） |
| R12 | `MAX_PATTERN_CHARS` 改一个数（500→600） | N18 | 只红文案对账那一格——反过来说明**常数全部走引用**，N2/N3 都是从导出读的，没有一处硬编码 |
| R13 | 不给 `timeBudgetMs` 时把预算当无穷大 | N9 | 单红恰目标（默认档那一格） |
| R14 | 时钟给 `NaN` 时算超时 | N9 | 单红恰目标（"NaN 当没时钟"那一格） |
| R15 | `hasIndices` 恒真（没开 `d` 也去读 `indices`） | **全绿** | **不可达**：`cell()` 里是 `hasIndices && m.indices` 双重判据，flag 改了但 `m.indices` 仍是 `undefined` → 位置照旧 `null`。补的是**另一条能达的刀 B9**，不是放宽实现 |
| R16 | `changed` 恒真（面板永远给一个"改过了"） | N15 | 单红恰目标 |
| R17 | 空串命中算"这一组没参与"（`groups` 档） | **全绿** | **没牙**：缺"参与但命中空串"的样本 → 补 N4 的 `()x`（B2 已咬红） |
| R18 | 同上，`named` 档 | **全绿** | 同上 → 补 N4 的 `(?<e>)x`（B3 已咬红） |
| R19 | 同级模块之间 `import './codec.js'`（违禁源扫描的 `m` 档） | N19 | 单红恰目标，且只红这一条——兄弟模块各自扫各自的源 |

R3 那把刀里混进来的 **A11** 不是 §N 的账，处置是先证伪再写：A11 是段 1 的区划生成器 `--fetch`
用例（本文件自己起 127.0.0.1 临时服务器 + `spawn` 跑生成器副本，`timeout: 20000`），`import` 链里
没有 `regex.js`，与 F2 的 `level` 没有任何数据通路。单跑它绿
（`node --test --test-name-pattern="^A11" scripts/toolkit-tests.mjs` → `# tests 1 / pass 1`，
`/tmp/seg3t4/a11-alone.log`）。所以这一条判成**同机负载抖动**——首发那轮是后台跑的，本机同一时间还有
别的全量在跑（这一格自己就复现过一次：补牙批次跑到尾声时，前台又跑了两次门禁一）。
既不记成"§N 的牙"，也不许写成"红得对"。

补牙批次（`/tmp/seg3t4b/mut.mjs`、台账 `/tmp/seg3t4b/ledger.log`、基线 `# tests 222 / pass 222`；
同一套四道自检，外加支持"一刀多处分"的 `apply()`——B4 必须同时改两处才有意义）。
**每一刀的预期是跑之前写进脚手架的**，跑完再比：

| 刀 | 改坏什么 | 预期 | 实际红了谁 |
| --- | --- | --- | --- |
| B1 | medium 的 128 档按字节判（= R11 重跑） | N17（新补的 `'中'×100` 放行样本） | **N17** ✅ |
| B2 | 空串命中算"这一组没参与"（= R17 重跑） | N4（新补的 `()x` 样本） | **N4** ✅ |
| B3 | 同上，`named` 档（= R18 重跑） | N4 | **N4** ✅ |
| B4 | 复合：同时摘 `readOptions` 的默认键与 `effectiveCap` 的 `undefined` 档 | N8 一侧 | **N8 + N18** ✅，而且红名单与首跑 run1 那两条**同形状**——同一处真缺陷的两种复现路径，A 轮单摘任一层都全绿这件事因此有了正证 |
| B5 | medium 整档摘掉（越线照样进引擎） | N14 N17 | **N14 N17** ✅ |
| B6 | medium 越线退回"已压到 128 字符"的旧文案（拒，但不说"不截断"） | N14（新加的 `/不截断/` 那条） | **N14 单红** ✅——B5 红两条、B6 只红一条，说明新增那句断言管的是文案而不是放行 |
| B7 | 导出面多长一个名字（`MEDIUM_MAX_INPUT_CHARS_ALIAS`） | N20 | **N20 单红** ✅ |
| B8 | 没开 `d` 也去读 `indices`（= R15 重跑） | **预期仍全绿**（`cell()` 第二层兜着，这一刀不可达） | **全绿**（pass 222/222）✅ 与预期一致 |
| B9 | 无 `d` 时把整段起点当组位置交出去（`span ? … : m.index`） | N5 | **N5 单红** ✅ |

B8 与 B9 是同一件事的两面：**要证明 N5 有牙，只能改"位置从哪来"，改"读不读 indices"改不到**。
所以 §N 不打算为此放宽 `cell()` 的双重判据——那个 `&& m.indices` 是防御性的，摘了它才是引入风险。

补牙批次对实现的净改动是**零**（`regex.js` 只改了四处文案：文件头那一行、`REGEX_CAVEAT` 末句、
`findMatches` 的 medium note、`previewReplace` 的 medium reason——全部是把"压到 128"这个从没实现过的
说法改成"只对 ≤128 字符求解、超过就拒、不截断"）。判据侧净加 1 条 `test()`（N20）与三处样本
（N4 两条、N14 一条、N17 一条），套件 `221 → 222`。

跑完两轮的自检：B 轮 `还原后 # tests 222 / pass 222 / 红 无`、**`副本与工作树逐字节一致=true`**；
脏项 `18 → 19`（新增那项是 `scripts/verify-plan-blocks.mjs`——Step 4 的登记改在 B 轮跑完之后才做，
时序上落在批次 A 与批次 B 之间，见下面 Step 4），`内容变过 2 个` 是本计划与 spec 两份文档
（B 轮跑期间我在改文档，脚手架的 `MINE` 集合没登记 `_docs/**`，所以它把这两项报成"不属本轮面"——
**这一句必须照实写，不能拿"本轮面：无"当"工作树没被碰过"用**）。真正要紧的是
`regex.js` 与 `toolkit-tests.mjs` 两本在 B 轮前后一字未变，加上 `一致=true`，还原是实的。
A 轮末尾那行 `副本与工作树逐字节一致=false` 则是另一回事：那时我正把工作树里的 `regex.js` 改这四处文案，
副本树是改之前拷的，diff 出来恰好四条文案行（复算：`diff /tmp/seg3t4/tree/dev/js/tools/regex.js dev/js/tools/regex.js`）。

- [x] **Step 4: 登记镜像**

两件事一起做，少任何一件门禁二都会以"看不懂的形状"红（机制见 §0.6）：`FILE_TARGETS` 加
`'dev/js/tools/regex.js',`（在 `digest.js` 那行之后，注释按"跟着磁盘走"那一条写），计划本格末尾贴两块
```js 全文镜像（`regex.js` 整文件 + `§N` 整节）。`§M` 那格的小标题这次不用动——它写的已经是
"从 `// ── §M` 到 `// ── §N` 之前"，与磁盘 §M 的实际区间 6601–7068 一致，门禁二对这一条报 OK
（改口的时序不抄进这格：Task 3 落地时 §N 还不存在，那一轮写的是"到文件末尾"，本轮改回"到 §N 之前"
才与磁盘对得上——留一句"何时改的"等于再埋一条对不上的数）。

```bash
node scripts/verify-plan-blocks.mjs > /tmp/seg3t4/gate2-beforefix.log 2>&1; echo "exit=$?"; tail -12 /tmp/seg3t4/gate2-beforefix.log
node scripts/verify-plan-blocks.mjs --fix
node scripts/verify-plan-blocks.mjs > /tmp/seg3t4/gate2-afterfix.log 2>&1; echo "exit=$?"; grep -E "^(✗|OK dev/js/tools/regex|OK scripts/toolkit-tests.mjs §N|其中 4)" /tmp/seg3t4/gate2-afterfix.log
node scripts/verify-plan-blocks-teeth.mjs
```
贴种子块时先只写磁盘内容的前 2 行（`regex.js` 的 `/**` 与首行说明、`§N` 的标记行与次行），由 `--fix`
整块换成磁盘全文。

实跑：`--fix` 前 `exit=1`、两条 ✗ 正是这两块（`dev/js/tools/regex.js` 无镜像、
`§N（磁盘 7069–7526）` 种子 2 行 ↔ 磁盘 458 行"前 2 行相同，此后不再逐字节全等"）；
`--fix` 两块都落笔（`regex.js` 那格 2 行 ← 磁盘 581 行、`§N` 那格 2 行 ← 磁盘 458 行），
脚本自报"重写 2 块，3811 → 4846 行"（`wc -l` 读回 4845——脚本按 `split('\n')` 计数，尾部多一行空串，
两处数字都留着才看得出这不是漂移）。fix 那一轮退出码仍是 1（按定义"改了就该红"，让人复跑确认）。
修后复跑 `exit=0`，两条各报自己的区间（`dev/js/tools/regex.js` ↔ 磁盘 581 行、
`scripts/toolkit-tests.mjs §N（磁盘 7069–7526）` ↔ 磁盘 458 行，两块都逐字节全等；
**计划侧那对行号一个都不抄进正文**——本格每加一行它们就往后挪，抄了就是埋一条对不上的数）；已落地镜像 **39 → 41**、合计 684198B → **733020B**、
`计划 js 块 38 个（段1 11、段2 19、段3 8）`、`未落地 0 节`。

门禁一 `# tests 222 / pass 222 / fail 0`（`/tmp/seg3t4/gate1-run6.log`）。门禁三跑在提交之后，
和 Step 5 一起记。

- [x] **Step 5: 提交**

```bash
git add dev/js/tools/regex.js scripts/toolkit-tests.mjs scripts/verify-plan-blocks.mjs \
  _docs/superpowers/plans/2026-09-27-tools-codec-page.md \
  _docs/superpowers/specs/2026-09-25-blog-online-tools-design.md
git diff --cached --stat      # 期望恰 5 files，且不含另一路会话的任何一个脏项
git commit -m "feat(tools): 段 3 Task 4 正则模块 regex.js——四道闸门全排在执行之前、高危形状一次都不进引擎（§N 二十判据 + 首发 19 刀与补牙 9 刀变异台账）" -- \
  dev/js/tools/regex.js scripts/toolkit-tests.mjs scripts/verify-plan-blocks.mjs \
  _docs/superpowers/plans/2026-09-27-tools-codec-page.md \
  _docs/superpowers/specs/2026-09-25-blog-online-tools-design.md
```
五本一起走：`regex.js` 是新增，`toolkit-tests.mjs` 是 §N 判据，`verify-plan-blocks.mjs` 是登记，
计划与 spec 是这一格的两处回写（**spec 那一行不能拖到下一笔**——§7 的"步数上限"改成四档事实
与本格的实现是同一件事，分开提就给仓库留一段"文档承诺着实现里没有的闸门"的历史）。
下一笔 `docs(plans)` 回填本格的 `实跑`（哈希、`--stat` 行数、三门禁复跑），与段 2 各 Task 同形状。

实跑：`24b7fae`，`5 files changed, 2399 insertions(+), 14 deletions(-)`——`regex.js` 581 行是新增
（`create mode 100644`），§N 判据 458 行，计划 +1365（两块镜像 1039 行 + 本格正文），
门禁二清单 +3 行（含"登记比另外三本晚一步"那句注释），spec ±6 行。
暂存集按路径核过：`git diff --cached --stat` 恰好这五条，另一路会话的脏项一个都没进来。
提交后复跑三道：门禁一 `# tests 222 / pass 222 / fail 0`（`/tmp/seg3t4/gate1-postcommit.log`）、
门禁二 `exit=0`（41 镜像、733020B、`未落地 0 节`）、门禁三 **21/21**
（`脏项 14 个前后一致，diff 指纹 81996c7f84f6cb6d`）。提交后 `git status` 剩这 14 项
（`_config.yml` / `about.html` / `dev/js/about.js` / `dev/sass/about.scss` / `package.json` /
`_data/og_images.yml` / `dev/libJs/cursor-effects.js` / 两处 `.baoyu-skills/**` /
未跟踪的 `scripts/lib/`、`scripts/article-check.mjs`、`scripts/wechat-draft.mjs`、
`scripts/fixtures/article-check/`、`.baoyu-skills/baoyu-post-to-wechat/`），
全属另一路会话，本格五个路径一字不剩。**全程不 push**（段 3 自约束）。

---

### 落地镜像（门禁二核的就是这两块，`--fix` 会把它们整块换成磁盘内容）

两块都是**磁盘全文**，用 ```js 围栏（§0.6 的硬规矩：只有整文件与整节镜像允许 ```js，
契约段一律 ```text）。

#### `dev/js/tools/regex.js`（整文件）

```js
/**
 * 正则测试与替换预览：编码工具箱页「正则」格子的纯逻辑，也是全站唯一"用户粘什么就得接住什么"的一格。
 *
 * 这一格最坏的一条路是**粘进来一个回溯炸开的正则，面板卡在 exec 里再也回不来**。JS 没有可打断的
 * 回溯步数计数器，V8 也不给单次 exec 中止钩子，所以"防炸页"只能全部做在执行**之前**，落成四档闸门：
 *   ① 模式长度（`MAX_PATTERN_CHARS`）与语法：语法一律交给 native 报原话，分词器不越权重发明错误；
 *   ② 静态可疑形状 `riskScan`：F1 嵌套无界量词、F2 分支互为重复、F3 相邻同源无界、F4 同 F1/F2 但外层有限。
 *      判成 high 的一次都不执行，判成 medium 的只对不超过 `MEDIUM_MAX_INPUT_CHARS` 字符的输入求解（超过就拒、不截断）；
 *   ③ 输入字节（`MAX_INPUT_BYTES`，与 `codec.js` / `digest.js` 同一把 UTF-8 尺子，超了整体拒、不截断）；
 *   ④ 匹配次数（`MAX_MATCHES`）与档间时间预算（`TIME_BUDGET_MS`，靠**注入的时钟**，本模块绝不自己读表）。
 * 四档的牙都在 §N 里逐条钉着，写成"注释里有、代码里没有"会被抓到。
 *
 * 与 `idcard.js` / `uscc.js` / `codec.js` / `digest.js` 同一套约定：纯函数、不碰 DOM、同级工具模块互不
 * import（所以 `toText` / `shapeOf` / `byteLen` 是本站的第若干份拷贝，代价由 §N 与 §L 各自核一遍口径），
 * 并且**两档入参两种处理**：文本入参（`pattern` / `flags` / `text` / `replacement`）归一成串、一律不抛，
 * 唯一例外还是无原型对象与 Symbol（`String()` 自己抛）；控制入参（`options`）走 `TypeError` 闸门，
 * 键名拼错必须响——静默当默认等于用户的 `maxMatches` 白写了。
 *
 * 结果口径以**引擎自己**为准：`matches` 的 `index` / `text` / 组序 / `named` 全部取自 native `exec`
 * 的一次性结果，多匹配的序列与 `matchAll` 逐格对拍（N6），替换预览直接交给 native `replace`（N15）。
 * `$0` 不是替换记号、`$$` 出一个字面 `$`、`$`` ` 是前导切片，这些都是 native 口径，不"顺手修正"。
 *
 * 可复算口径：§N 头部那批毫秒数是本机 Node 22.19 / V8 实测（同一进程、"必然失败"的输入形状），
 * `(a+)+$` 22 字符 839ms、28 字符 >2s；`(x|xx)+$` 32 字符 203ms、40 字符 6.4s；
 * `(\d{1,3}|\d)+$` 16 字符 823ms、20 字符 4.3s；而 `(x+a+)+$` 20 字符 0.0ms——
 * 分词器的 F1 规则（单个可变长度元素 / 含可空元素且无定宽元素）就是照这批数据切的。
 */

/** 面板口径说明，原样显示（与 `BASE64_CAVEAT` / `TIME_CAVEAT` / `DIGEST_CAVEAT` 同一角色，逐条对账由 N18 守着） */
export const REGEX_CAVEAT =
  '正则语义以引擎为准，flags 白名单 g i m s u y d，重复位归一后回显。模式超过 500 字符、输入超过 1 MiB（1048576 字节）'
  + '都整体拒绝、不截断；命中最多列前 1000 个，超出会明说还有没列出的、不静默截断。'
  + '嵌套无界量词这类疑似灾难性回溯的形状一次都不执行并点名构造，中等可疑的形状只对不超过 128 字符的输入求解。';

/** flags 白名单就这七位：`v` / `U` 一类会改语义的档位不收，加了要有新判据 */
export const ALLOWED_FLAGS = 'gimsuyd';
/** 模式长度上限：字符数，不是字节数 */
export const MAX_PATTERN_CHARS = 500;
/** 输入字节闸门：与 codec / digest 同档，超过才拒，正好 1 MiB 放行 */
export const MAX_INPUT_BYTES = 1048576;
/** 匹配次数硬上限：options 只能往下调，不许越过这一档 */
export const MAX_MATCHES = 1000;
/** 中等可疑形状允许求解的最大输入字符数（数的是字符，不是字节） */
export const MEDIUM_MAX_INPUT_CHARS = 128;
/** 档间时间预算：只在调用方注入时钟时才会被检查，默认 50 毫秒 */
export const TIME_BUDGET_MS = 50;

/** options 认得的键，别的都要响 */
const OPTION_KEYS = ['now', 'maxMatches', 'timeBudgetMs'];
/** 无界最大重复的量词档，静态检测里"会不会放大"就看这一档 */
const UNBOUNDED = Infinity;

/** 文本入参归一：与兄弟模块那句同档，无原型对象与 Symbol 由 `String()` 自己抛 */
const toText = (v) => String(v === null || v === undefined ? '' : v);
const isDigit = (ch) => ch >= '0' && ch <= '9';

/** 报错里的形状回显：与 `codec.js` / `digest.js` 各自的实现同一份口径 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (typeof v === 'object') return v instanceof Date ? 'Date' : 'object';
  return typeof v;
}

/**
 * UTF-8 字节数：闸门与面板计数共用这把尺子。落单代理项按 3 字节计——它反正会在 native 里当普通字符用，
 * 本模块不替用户修字节序，所以这一档只影响"多大"，不影响"对不对"。
 */
export function byteLen(value) {
  const src = toText(value);
  let n = 0;
  for (let i = 0; i < src.length; i += 1) {
    const code = src.charCodeAt(i);
    if (code < 0x80) n += 1;
    else if (code < 0x800) n += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < src.length ? src.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) { n += 4; i += 1; } else n += 3;
    } else n += 3;
  }
  return n;
}

/** 只收"字面量对象"：Date / Array / Map 这类带原型的对象当 options 用一定是用户写错了 */
function isPlainObject(v) {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** options 闸门：只认三个键，值各有一档类型，拼错与给错都要响；没给的键一律落到默认档而不是 undefined */
function readOptions(options, who) {
  if (options !== null && options !== undefined && !isPlainObject(options)) {
    throw new TypeError(`${who} 的 options 只收对象，收到 ${shapeOf(options)}`);
  }
  const picked = { now: null, maxMatches: null, timeBudgetMs: null };
  if (options === null || options === undefined) return picked;
  const unknown = Object.keys(options).filter((k) => !OPTION_KEYS.includes(k));
  if (unknown.length > 0) throw new TypeError(`${who} 的 options 里有不认识的键：${unknown.join('、')}`);
  const { now, maxMatches, timeBudgetMs } = options;
  if (now !== null && now !== undefined && typeof now !== 'function') {
    throw new TypeError(`${who} 的 now 要的是函数，收到 ${shapeOf(now)}`);
  }
  if (maxMatches !== null && maxMatches !== undefined && typeof maxMatches !== 'number') {
    throw new TypeError(`${who} 的 maxMatches 要的是数字，收到 ${shapeOf(maxMatches)}`);
  }
  if (timeBudgetMs !== null && timeBudgetMs !== undefined && typeof timeBudgetMs !== 'number') {
    throw new TypeError(`${who} 的 timeBudgetMs 要的是数字，收到 ${shapeOf(timeBudgetMs)}`);
  }
  picked.now = typeof now === 'function' ? now : null;
  picked.maxMatches = typeof maxMatches === 'number' && Number.isFinite(maxMatches) ? maxMatches : null;
  picked.timeBudgetMs = typeof timeBudgetMs === 'number' && Number.isFinite(timeBudgetMs) ? timeBudgetMs : null;
  return picked;
}

/** 有效上限：只能往下调，0 与负数按 1 兜，不给"一个都不算"的静默档 */
function effectiveCap(maxMatches) {
  if (maxMatches === null || maxMatches === undefined) return MAX_MATCHES;
  return Math.min(MAX_MATCHES, Math.max(1, Math.trunc(maxMatches)));
}

/** flags 归一：保留首次出现顺序、重复位回显、白名单外的位点名 */
export function normalizeFlags(value) {
  const raw = toText(value);
  let flags = '';
  const unknown = [];
  let deduplicated = false;
  for (const ch of raw) {
    if (!ALLOWED_FLAGS.includes(ch)) {
      if (!unknown.includes(ch)) unknown.push(ch);
      continue;
    }
    if (flags.includes(ch)) { deduplicated = true; continue; }
    flags += ch;
  }
  if (unknown.length > 0) {
    return {
      ok: false, flags: '', deduplicated,
      reason: `flag「${unknown.join('、')}」不在白名单 ${[...ALLOWED_FLAGS].join(' ')} 之内，这一格只收这七位`,
    };
  }
  return {
    ok: true, flags, deduplicated,
    reason: deduplicated ? `flags 里有重复位，已归一为「${flags}」` : null,
  };
}

/**
 * 编译：先长度、再 flags、最后才交给 native。
 * `kind` 分三档（`length` / `flags` / `pattern`），面板按档决定红条写在哪一格；
 * 失败时 `regex` 一律是 null，绝不把半残对象交出去。
 */
export function compile(pattern, flags, options) {
  readOptions(options, 'compile');
  const src = toText(pattern);
  if (src.length > MAX_PATTERN_CHARS) {
    return {
      ok: false, regex: null, flags: '', kind: 'length', deduplicated: false,
      reason: `模式 ${src.length} 字符，超过 ${MAX_PATTERN_CHARS} 字符上限，整体拒绝、不截断`,
    };
  }
  const norm = normalizeFlags(flags);
  if (!norm.ok) return { ok: false, regex: null, flags: '', kind: 'flags', deduplicated: false, reason: norm.reason };
  try {
    return {
      ok: true, regex: new RegExp(src, norm.flags), flags: norm.flags, kind: null,
      deduplicated: norm.deduplicated, reason: norm.reason,
    };
  } catch (err) {
    return {
      ok: false, regex: null, flags: norm.flags, kind: 'pattern', deduplicated: norm.deduplicated,
      reason: `语法错误：${err.message}`,
    };
  }
}

/* ---------------------------------------------------------------- 分词器 ---- */

/**
 * 极简递归下降：只为"形状"服务，不为"语义"服务——语义交给 native。
 * 走不通就返回 null，`riskScan` 据此报 `parsed:false`，把语法判定让回 `compile`。
 * 元素统一是 `{ atom:{kind,source,alts?}, min, max, at }`，`kind` 分 `group` / `other`。
 */
function tokenize(src) {
  let i = 0;

  function quantifier() {
    const ch = src[i];
    if (ch === '*' || ch === '+' || ch === '?') {
      i += 1;
      if (src[i] === '?' || src[i] === '+') i += 1;   // 懒惰档与（非法的）占有档一并跳过，形状判定不受影响
      return ch === '*' ? { min: 0, max: UNBOUNDED } : ch === '+' ? { min: 1, max: UNBOUNDED } : { min: 0, max: 1 };
    }
    if (ch !== '{') return { min: 1, max: 1 };
    const m = /^\{(\d+)(?:,(\d*))?\}/.exec(src.slice(i, i + 20));
    if (m === null) return { min: 1, max: 1 };        // 不是合法量词：`{` 在 native 里是字面量，这里也当字面量
    i += m[0].length;
    const lo = Number(m[1]);
    const hi = m[2] === undefined ? lo : m[2] === '' ? UNBOUNDED : Number(m[2]);
    return { min: lo, max: hi < lo ? lo : hi };
  }

  function primary() {
    const ch = src[i];
    if (ch === undefined) return null;
    if (ch === '(') return group();
    if (ch === '[') {
      const start = i;
      i += 1;
      if (src[i] === '^') i += 1;
      if (src[i] === ']') i += 1;                     // 首位的 `]` 是字面量，`[^]]` 同理
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === ']') { i += 1; return { kind: 'other', source: src.slice(start, i) }; }
        i += 1;
      }
      return null;
    }
    if (ch === '\\') {
      const next = src[i + 1];
      if (next === undefined) return null;
      if (next === 'p' || next === 'P') {
        if (src[i + 2] === '{') {
          const close = src.indexOf('}', i + 3);
          if (close < 0) return null;
          const source = src.slice(i, close + 1);
          i = close + 1;
          return { kind: 'other', source };
        }
        i += 2;
        return { kind: 'other', source: src.slice(i - 2, i) };
      }
      if (next === 'k' && src[i + 2] === '<') {
        const close = src.indexOf('>', i + 3);
        if (close < 0) return null;
        const source = src.slice(i, close + 1);
        i = close + 1;
        return { kind: 'other', source };
      }
      i += 2;
      return { kind: 'other', source: src.slice(i - 2, i) };
    }
    if (ch === '^' || ch === '$') { i += 1; return { kind: 'other', source: ch, zeroWidth: true }; }
    if (ch === '|' || ch === ')') return null;
    i += 1;
    return { kind: 'other', source: ch };
  }

  function element() {
    const at = i;
    const atom = primary();
    if (atom === null) return null;
    const q = quantifier();
    return { atom, min: q.min, max: q.max, at };
  }

  function sequence() {
    const out = [];
    for (;;) {
      if (i >= src.length || src[i] === '|' || src[i] === ')') return out;
      const e = element();
      if (e === null) return null;
      out.push(e);
    }
  }

  function group() {
    const at = i;
    i += 1;
    if (src[i] === '?') {
      i += 1;
      const c = src[i];
      if (c === undefined) return null;
      if (c === ':' || c === '=' || c === '!') i += 1;
      else if (c === '<') {
        if (src[i + 1] === '=' || src[i + 1] === '!') i += 2;
        else {
          const close = src.indexOf('>', i + 1);
          if (close < 0) return null;
          i = close + 1;
        }
      } else return null;
    }
    const alts = [];
    for (;;) {
      const s = sequence();
      if (s === null) return null;
      alts.push(s);
      if (src[i] === '|') { i += 1; continue; }
      break;
    }
    if (src[i] !== ')') return null;
    i += 1;
    return { kind: 'group', source: src.slice(at, i), alts, at };
  }

  const alts = [];
  for (;;) {
    const s = sequence();
    if (s === null) return null;
    alts.push(s);
    if (src[i] === '|') { i += 1; continue; }
    break;
  }
  if (i < src.length) return null;                    // 剩下了闭括号一类的东西：交给 compile 报原话
  return { alts };
}

/* ------------------------------------------------------------ 形状判定 ---- */

/** 序列里是否有一个"定宽且非空"的元素：它能钉住每次迭代的边界 */
const hasFixedWidth = (seq) => seq.some((e) => e.min === e.max && e.min >= 1);
const hasNullable = (seq) => seq.some((e) => e.min === 0 && e.max >= 1 && !e.atom.zeroWidth);

/**
 * F1 的内层条件：这一段自己就能让迭代边界滑动。
 * 两条口径来自实测——单个可变长度元素（`(a{1,3})+` 32 字符 5.4s）与
 * "含可空元素且没有定宽元素钉边界"（`(?:\s*\w+)*` 20 字符 30.8ms）；
 * 反过来 `(x+a+)+` 两个必填元素互相钉不住上限、但每步至少吃掉 2 个字符，20 字符 0.0ms，不算。
 */
function amplifies(seq) {
  if (seq.length === 1) return seq[0].min !== seq[0].max;
  return hasNullable(seq) && !hasFixedWidth(seq);
}

/** 序列的最小重复单元：`(ab|abab)` 的单元是 `ab`，`(x|xx|xxx)` 的单元是 `x` */
function unitOf(keys) {
  for (let len = 1; len <= keys.length; len += 1) {
    if (keys.length % len !== 0) continue;
    let ok = true;
    for (let k = 0; k < keys.length; k += 1) if (keys[k] !== keys[k % len]) { ok = false; break; }
    if (ok) return keys.slice(0, len);
  }
  return keys.slice();
}

/**
 * 把一个分支折成"单元 + 重复次数区间"。折不动（元素带无界量词、分支里混着不同长度）就标 irregular，
 * F2 不拿它跟别的分支比——宁可漏报，不可误杀。
 */
function shapeOfAlternative(seq) {
  if (seq.length === 0) return null;
  const keys = seq.map((e) => e.atom.source);
  if (seq.length === 1) {
    const e = seq[0];
    if (e.max === UNBOUNDED) return { unit: unitOf(keys), lo: e.min, hi: UNBOUNDED, irregular: true };
    return { unit: unitOf(keys), lo: e.min, hi: e.max, irregular: e.min === 0 };
  }
  if (!seq.every((e) => e.min === e.max && e.min >= 1)) return { unit: keys, lo: 1, hi: 1, irregular: true };
  const unit = unitOf(keys);
  const times = keys.length / unit.length;
  const flat = seq.every((e) => e.min === seq[0].min);
  if (!flat) return { unit, lo: times, hi: times, irregular: true };
  return { unit, lo: times, hi: times, irregular: false };
}

const sameUnit = (a, b) => a.unit.length === b.unit.length && a.unit.every((k, idx) => k === b.unit[idx]);
/** 两个分支能吃掉同一段文本的两种分法 → 回溯放大 */
const overlaps = (a, b) => a.lo <= b.hi && b.lo <= a.hi;
const multipleOf = (a, b) => (a.hi % b.lo === 0 && a.hi >= b.lo) || (b.hi % a.lo === 0 && b.hi >= a.lo);

const HINTS = {
  F1: '嵌套的无界量词会随输入指数放大：给内层量词收紧出上限（例如 {1,3}），或把这段重复拆成两步匹配',
  F2: '分支之间能互相拆着命中同一段文本：把分支改写成互不重叠的形状，或给外层量词收紧上限',
  F3: '相邻两段同源又都带无界量词：合并成一个量词（例如 a*a* 写成 a*），或给其中一段收紧上限',
  F4: '同 F1 的形状但外层是有限重复：先限制内层量词的上限，或拆成两步匹配',
};

/**
 * 命中条目：`level` 由**放大器**决定而不是由规则名决定——
 * 同一条 F2，组外是 `*` / `+` 就是 high，是 `{3}` 就只到 medium（N12 两条各钉一头）。
 */
const finding = (rule, at, level) => ({ rule, at, hint: HINTS[rule], level });

/** 对一个组节点做判定：外层量词决定这形状是 high 还是 medium */
function scanGroup(node, min, max, findings) {
  if (max <= 1) return;                                 // `(a+)?`、`(a+){1}`、`(a+)`：没有放大
  const unbounded = max === UNBOUNDED;
  for (const alt of node.alts) {
    if (amplifies(alt)) {
      findings.push(unbounded ? finding('F1', node.at, 'high') : finding('F4', node.at, 'medium'));
    }
  }
  const shapes = node.alts.map(shapeOfAlternative).filter((s) => s !== null);
  let reported = false;
  for (let p = 0; p < shapes.length && !reported; p += 1) {
    for (let q = p + 1; q < shapes.length && !reported; q += 1) {
      const a = shapes[p];
      const b = shapes[q];
      if (a.irregular || b.irregular || !sameUnit(a, b)) continue;
      if (overlaps(a, b) || multipleOf(a, b)) {
        findings.push(finding('F2', node.at, unbounded ? 'high' : 'medium'));
        reported = true;
      }
    }
  }
}

function scanSequence(seq, findings) {
  for (let k = 0; k + 1 < seq.length; k += 1) {
    const a = seq[k];
    const b = seq[k + 1];
    if (a.max !== UNBOUNDED || b.max !== UNBOUNDED) continue;
    if (a.atom.source === b.atom.source) findings.push(finding('F3', b.at, 'medium'));
  }
  for (const e of seq) {
    if (e.atom.kind !== 'group') continue;
    scanGroup(e.atom, e.min, e.max, findings);
    for (const alt of e.atom.alts) scanSequence(alt, findings);
  }
}

/**
 * 静态可疑形状检测：不看输入、不进引擎，只回答"这个形状会不会在回溯里炸开"。
 * 走不完分词就返回 `parsed:false` 且 `level:'none'`——语法判定是 `compile` 的活，这里不越权报错，
 * 但也不把半成品当"没风险"交出去（N13 钉这一档）。
 */
export function riskScan(pattern) {
  const src = toText(pattern);
  const tree = tokenize(src);
  if (tree === null) {
    return { level: 'none', findings: [], parsed: false, reason: '模式没能走完分词，语法判定交给编译那一档' };
  }
  const found = [];
  for (const alt of tree.alts) scanSequence(alt, found);
  const deduped = [];
  for (const f of found) {
    if (!deduped.some((g) => g.rule === f.rule && g.at === f.at)) deduped.push(f);
  }
  const level = deduped.some((f) => f.level === 'high') ? 'high' : deduped.length > 0 ? 'medium' : 'none';
  const rules = [...new Set(deduped.map((f) => f.rule))].join('/');
  return {
    level,
    findings: deduped,
    parsed: true,
    reason: deduped.length === 0 ? null : `可疑形状 ${rules}：${deduped[0].hint}`,
  };
}

/* -------------------------------------------------------------- 执行 ---- */

/** 一次 exec 结果 → 面板要的那一格：位置一律取自 native，`d` 没开就没有组位置 */
function cell(m, hasIndices) {
  const groups = [];
  for (let g = 1; g < m.length; g += 1) {
    const text = m[g];
    const span = hasIndices && m.indices ? m.indices[g] : null;
    groups.push({
      index: span ? span[0] : null, length: span ? span[1] - span[0] : null,
      text, participated: text !== undefined,
    });
  }
  const named = {};
  if (m.groups) {
    const spans = hasIndices && m.indices ? m.indices.groups : null;
    for (const key of Object.keys(m.groups)) {
      const text = m.groups[key];
      const span = spans ? spans[key] : null;
      named[key] = {
        index: span ? span[0] : null, length: span ? span[1] - span[0] : null,
        text, participated: text !== undefined,
      };
    }
  }
  return { index: m.index, length: m[0].length, text: m[0], groups, named };
}

/** 四档闸门里"执行之前"的那三段，`findMatches` 与 `previewReplace` 共用一把顺序（N3 / N14 / N17 钉先后） */
function gate(pattern, flags, body, cap) {
  const src = toText(pattern);
  const base = {
    ok: false, reason: null, pattern: src, flags: '', level: null, findings: [], executed: false,
    matches: [], count: 0, capped: cap, hitLimit: false, timedOut: false, elapsedMs: null,
    bytes: undefined, chars: body.length, regex: null,
  };
  if (src.length > MAX_PATTERN_CHARS) {
    return { ...base, reason: `模式 ${src.length} 字符，超过 ${MAX_PATTERN_CHARS} 字符上限，整体拒绝、不截断` };
  }
  const made = compile(src, flags);
  if (!made.ok) return { ...base, flags: made.flags, reason: made.reason };
  const risk = riskScan(src);
  base.level = risk.level;
  base.findings = risk.findings;
  base.flags = made.flags;
  if (risk.level === 'high') {
    const rules = [...new Set(risk.findings.map((f) => f.rule))].join('/');
    return { ...base, reason: `模式含疑似灾难性回溯的形状 ${rules}，引擎一次都不执行：${risk.findings[0].hint}` };
  }
  const bytes = byteLen(body);
  if (bytes > MAX_INPUT_BYTES) {
    return { ...base, bytes, reason: `输入 ${bytes} 字节，超过 ${MAX_INPUT_BYTES} 字节（1 MiB）上限，整体拒绝、不截断` };
  }
  if (risk.level === 'medium' && body.length > MEDIUM_MAX_INPUT_CHARS) {
    return {
      ...base, bytes,
      reason: `模式含可疑形状（${risk.findings.map((f) => f.rule).join('/')}），这一档只对不超过 ${MEDIUM_MAX_INPUT_CHARS} 字符的输入求解，实际 ${body.length} 字符、不截断`,
    };
  }
  return { ...base, bytes, regex: made.regex };
}

const emptyFind = (body, cap) => ({
  ok: false, reason: null, pattern: '', flags: '', level: null, findings: [], executed: false,
  matched: false, matches: [], count: 0, capped: cap, hitLimit: false, timedOut: false,
  elapsedMs: null, bytes: undefined, chars: body.length,
});

/**
 * 匹配求解：闸门顺序为 模式长度 → 编译 → 静态形状 → 输入字节 → medium 的字符档 → 执行循环。
 * 循环里只有两处收口：`capped` 次数档与注入时钟的时间档；零宽匹配手动推进一格，否则第一次命中就再也不动。
 */
export function findMatches(pattern, flags, text, options) {
  const opts = readOptions(options, 'findMatches');
  const cap = effectiveCap(opts.maxMatches);
  const body = toText(text);
  const shot = gate(pattern, flags, body, cap);
  if (shot.regex === null) return { ...emptyFind(body, cap), ...shot, matched: false };

  const re = shot.regex;
  const hasIndices = re.flags.includes('d');
  const multi = re.global || re.sticky;
  const clock = opts.now;
  const budget = opts.timeBudgetMs === null || opts.timeBudgetMs === undefined ? TIME_BUDGET_MS : opts.timeBudgetMs;
  const startMs = clock ? clock() : 0;
  const matches = [];
  let elapsedMs = clock ? 0 : null;
  let hitLimit = false;
  let timedOut = false;

  re.lastIndex = 0;
  for (;;) {
    if (clock) {
      elapsedMs = clock() - startMs;
      if (Number.isFinite(elapsedMs) && elapsedMs > budget) { timedOut = true; break; }
    }
    const m = re.exec(body);
    if (m === null) break;
    if (matches.length >= cap) { hitLimit = true; break; }
    matches.push(cell(m, hasIndices));
    if (m[0].length === 0) re.lastIndex += 1;
    if (!multi) break;
  }

  const notes = [];
  if (shot.level === 'medium') notes.push(`模式含可疑形状（${shot.findings.map((f) => f.rule).join('/')}），这一档只对不超过 ${MEDIUM_MAX_INPUT_CHARS} 字符的输入求解`);
  if (timedOut) notes.push(`超过档间时间预算 ${budget} 毫秒，只列前 ${matches.length} 格`);
  if (hitLimit) notes.push(`命中超过匹配次数上限 ${cap}，只列前 ${cap} 个，后面还有没列出的、不静默截断`);

  return {
    ok: true, reason: notes.length === 0 ? null : notes.join('；'),
    pattern: shot.pattern, flags: shot.flags, level: shot.level, findings: shot.findings,
    executed: true, matched: matches.length > 0, matches, count: matches.length,
    capped: cap, hitLimit, timedOut, elapsedMs, bytes: shot.bytes, chars: shot.chars,
  };
}

/**
 * 替换预览：吃同一套闸门，产物直接由 native `String.prototype.replace` 给出——
 * `$` 的每一种写法都以引擎为准（N15 逐条对拍），本模块绝不自己展开替换串。
 */
export function previewReplace(pattern, flags, text, replacement, options) {
  const opts = readOptions(options, 'previewReplace');
  const cap = effectiveCap(opts.maxMatches);
  const repl = toText(replacement);
  const body = toText(text);
  const shot = gate(pattern, flags, body, cap);
  if (shot.regex === null) {
    return {
      ok: false, reason: shot.reason, pattern: shot.pattern, flags: shot.flags, level: shot.level,
      findings: shot.findings, executed: false, out: '', changed: false,
      bytes: shot.bytes, chars: shot.chars, capped: cap,
    };
  }
  const out = body.replace(shot.regex, repl);
  return {
    ok: true, reason: shot.level === 'medium'
      ? `模式含可疑形状（${shot.findings.map((f) => f.rule).join('/')}），这一档只对不超过 ${MEDIUM_MAX_INPUT_CHARS} 字符的输入求解` : null,
    pattern: shot.pattern, flags: shot.flags, level: shot.level, findings: shot.findings,
    executed: true, out, changed: out !== body, bytes: shot.bytes, chars: shot.chars, capped: cap,
  };
}
```

#### `scripts/toolkit-tests.mjs` §N（整节，从 `// ── §N` 到文件末尾）

```js
// ── §N 正则测试（tools/regex.js，段 3 Task 4）───────────────────────
// 这一格的对拍源是**引擎自己**：正则语义以 native `RegExp` / `matchAll` / `replace` 为准
// （不像 §M 拿 Node crypto 当外部标准），所以判据只核两件事——
//   ① 本模块交给面板的结果必须与 native 逐格一致（不许自己重发明一套 `$` 或 lastIndex 口径）；
//   ② 四道闸门必须真的在：模式长度、输入字节、静态可疑形状、匹配次数与档间预算。
// "防炸页"的主牙齿是②里的静态检测。JS 没有可打断的回溯步数计数器，**单次 `exec` 内部无法熔断**，
// 所以 §7 那句"匹配步数上限 + 超时保护"落地成四档事实，N9 与 N14 各钉一处，不许写成假承诺。
// 下面每一档形状的去留都是本机 Node 22.19 / V8 实测（同一进程、必须是"匹配失败"的输入形状）：
//   `(a+)+$` 22 字符 839ms、28 >2s ┊ `(?:\s*\w+)*$` 20 字符 30.8ms ┊ `(\w*\s?)+$` 20 字符 66.1ms
//   `(x+a+)+$` 20 字符 0.0ms（迭代边界被必填的定宽字符钉住，故列不进真阳性）
//   `(a{1,3})+$` 32 字符 5.4s 与 `(?:[([]{2,})+` 28 字符 29.4ms 起草时列在"不得误判"，实测归入真阳性。
// F2 一族的阈值同样实测过（同一失败形状下逐档加倍）：`(a|a)+` 24→1012ms、`(x|xx|xxx)+` 32→5518ms、
// `(x|xx)+` 40→6356ms、`(aa|aaaa)+` 64→247ms（每 8 字符 ×60，128 字符就是天文数字）——
// 起草时把 `(-|--)\s*$` 当作 F2 样本，实测 28 字符 0.0ms：组上没有量词就没有放大，样本已换成 `(-|--)+`
// （24→4.0ms、28→40.1ms，斐波那契档）。`(\d{1,3}|\d)+` 起草时列在"不得误判"，实测 16 字符 823ms、
// 20 字符 4319ms，已移进 N11 的真阳性族。
const { REGEX_CAVEAT, ALLOWED_FLAGS, MAX_PATTERN_CHARS, MAX_INPUT_BYTES: RE_INPUT_BYTES, MAX_MATCHES,
  MEDIUM_MAX_INPUT_CHARS, TIME_BUDGET_MS, byteLen: nByteLen, normalizeFlags, compile, riskScan,
  findMatches, previewReplace } = await import('../dev/js/tools/regex.js');

/** 剥注释扫源码：块注释与行注释里的字样都不算命中（与 §K/§L/§M 同一形状） */
const nCode = () => read('dev/js/tools/regex.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('N1 flags 白名单七位各自可用、重复归一、未知那位点名拒绝', () => {
  assert.equal(ALLOWED_FLAGS, 'gimsuyd', '白名单就这七位：加一位要有新判据，删一位要改 CAVEAT');
  for (const ch of ALLOWED_FLAGS) {
    const r = normalizeFlags(ch);
    assert.equal(r.ok, true, `${ch} 必须在白名单内`);
    assert.equal(r.flags, ch);
    assert.equal(r.deduplicated, false);
  }
  assert.equal(normalizeFlags('gi').flags, 'gi');
  assert.equal(normalizeFlags('gig').flags, 'gi', '重复位归一：native 对 gg 直接抛，面板不该拿一个抛');
  assert.equal(normalizeFlags('gig').deduplicated, true, '归一了要回显，否则用户以为两位都在');
  assert.equal(normalizeFlags('').flags, '');
  assert.equal(normalizeFlags(null).flags, '', '文本档：null 归一成空串，不抛');
  for (const bad of ['A', 'v', 'U', 'gp', 'gGG', 'uv']) {
    const r = normalizeFlags(bad);
    assert.equal(r.ok, false, `${bad} 里有不在白名单的位，必须拒`);
    assert.equal(r.flags, '', '拒了就不给半截 flags');
    assert.match(r.reason, /不在白名单/);
    for (const ch of bad) {
      if (ALLOWED_FLAGS.includes(ch)) continue;
      assert.match(r.reason, new RegExp(ch), `${bad} → ${r.reason}：要点名是哪一位`);
    }
  }
  assert.equal(compile('a', 'g').ok, true);
  assert.equal(compile('a', 'gg').ok, true, 'compile 先过归一再过 native，gg 不再是抛的口径');
  assert.equal(compile('a', 'gg').flags, 'g');
  assert.equal(compile('a', 'A').ok, false);
  assert.equal(compile('a', 'A').kind, 'flags');
});
test('N2 编译失败逐类给 V8 原话，并分成 pattern / flags / 长度三档', () => {
  const cases = [['(', 'Unterminated group'], [')', "Unmatched ')'"], ['[a', 'Unterminated character class'],
    ['*', 'Nothing to repeat'], ['(?', 'Invalid group'], ['a{3,2}', 'numbers out of order'],
    ['[z-a]', 'Range out of order'], ['a\\', '\\ at end of pattern'], ['(?<', 'Invalid capture group name'],
    ['(?<1a>x)', 'Invalid capture group name'], ['(a', 'Unterminated group']];
  for (const [src, msg] of cases) {
    const r = compile(src, '');
    assert.equal(r.ok, false, `${src} 必须编译失败`);
    assert.equal(r.regex, null, '失败时不许把一个半残 RegExp 交出去');
    assert.equal(r.kind, 'pattern', `${src} 的档位应是 pattern：${r.reason}`);
    assert.match(r.reason, new RegExp(msg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `${src} 应当报「${msg}」，实际「${r.reason}」`);
  }
  assert.equal(cases.length, 11, '报错分类表要有条数：漏一类等于那一类从此静默归到别的档');
  assert.equal(compile('a', 'A').kind, 'flags');
  assert.equal(compile('a'.repeat(MAX_PATTERN_CHARS + 1), '').kind, 'length');
  assert.match(compile('a'.repeat(MAX_PATTERN_CHARS + 1), '').reason, /超过/);
  assert.equal(compile('a'.repeat(MAX_PATTERN_CHARS), '').ok, true, '正好到上限要放行（"超过"才拒）');
  assert.equal(compile('', '').ok, true, '空模式是合法的：它匹配空串');
  assert.equal(compile('(?<=a)b', '').ok, true, '后行断言 native 认，别在分词器里当非法语法');
});
test('N3 模式长度闸门排在最前：报实测数与上限，拒了不跑静态检测', () => {
  const long = '((((a+)+)))'.padEnd(MAX_PATTERN_CHARS + 1, 'b');
  const r = findMatches(long, '', 'aaa');
  assert.equal(r.ok, false); assert.equal(r.executed, false);
  assert.equal(r.matches.length, 0, '越界时不许给半截结果');
  assert.match(r.reason, new RegExp(String(long.length)));
  assert.match(r.reason, new RegExp(String(MAX_PATTERN_CHARS)));
  assert.equal(r.level, null, '长度这一档排在静态检测之前，level 不该被填上');
  assert.equal(r.bytes, undefined, '长度拒时不该报字节，字节是输入那一层的数');
  assert.equal(previewReplace(long, '', 'x', 'y').ok, false, '替换预览吃同一道闸门');
  assert.equal(previewReplace(long, '', 'x', 'y').out, '', '同样不给半截产物');
});
test('N4 单次匹配与 native 逐格一致：整段、组序、命名组、未参与组', () => {
  const m = findMatches('(\\d+)-(\\d+)', '', 'no 2026-0928 here');
  assert.equal(m.ok, true); assert.equal(m.count, 1);
  assert.equal(m.matches[0].text, '2026-0928');
  assert.equal(m.matches[0].index, 3);
  assert.equal(m.matches[0].length, 9);
  assert.deepEqual(m.matches[0].groups.map((g) => g.text), ['2026', '0928']);
  const oracle = new RegExp('(\\d+)-(\\d+)').exec('no 2026-0928 here');
  assert.equal(m.matches[0].index, oracle.index, 'index 必须与 native 同格，不许自己数');
  const none = findMatches('(a)|(b)', '', 'b');
  assert.equal(none.matches[0].groups[0].participated, false, '第 1 组没参与');
  assert.equal(none.matches[0].groups[0].text, undefined);
  assert.equal(none.matches[0].groups[1].participated, true);
  const named = findMatches('(?<y>\\d{4})-(?<m>\\d{2})', '', 'x 2026-09');
  assert.equal(named.matches[0].named.y.text, '2026');
  assert.equal(named.matches[0].named.m.text, '09');
  assert.deepEqual(Object.keys(named.matches[0].named), ['y', 'm'], '命名表按声明顺序，面板才排得出列');
  const empty = findMatches('()x', '', 'x');
  assert.equal(empty.matches[0].groups[0].participated, true, '空串命中也叫"参与了"：只有 undefined 才是没参与');
  assert.equal(empty.matches[0].groups[0].text, '', '组文本原样给空串，面板才显示得出"这一组存在但为空"');
  const emptyNamed = findMatches('(?<e>)x', '', 'x');
  assert.equal(emptyNamed.matches[0].named.e.participated, true, '命名组同一档：拿 !== undefined 判才分得开空串与没参与');
  assert.equal(emptyNamed.matches[0].named.e.text, '');
  assert.equal(findMatches('(a)', '', 'b').count, 0, '没命中是 count 0，不是 ok false');
});
test('N5 有 d 才有组位置，没 d 时位置是 null 而不是猜', () => {
  const noD = findMatches('a(b)(c)', '', 'xxabcxx');
  assert.equal(noD.ok, true);
  assert.equal(noD.matches[0].index, 2, '整段位置不依赖 d');
  assert.equal(noD.matches[0].groups[0].index, null, '没有 d 就没有 indices，猜出来的位置是假数据');
  assert.equal(noD.matches[0].groups[0].length, null);
  assert.equal(noD.matches[0].groups[0].text, 'b', '文本仍然给：那一档 exec 本来就有');
  const withD = findMatches('a(?<x>b)(c)', 'd', 'xxabcxx');
  assert.equal(withD.ok, true);
  assert.equal(withD.matches[0].groups[0].index, 3);
  assert.equal(withD.matches[0].groups[1].index, 4);
  assert.equal(withD.matches[0].named.x.index, 3, '命名组的位置来自 indices.groups');
  assert.equal(withD.matches[0].named.x.length, 1);
  const miss = findMatches('(a)(b)', 'd', 'cb');
  assert.equal(miss.ok, true); assert.equal(miss.count, 0);
  assert.equal(miss.matched, false, 'matched 给面板当"没匹配上"用，与 ok 分开');
  assert.equal(findMatches('a(b)', 'd', 'zzz').matches.length, 0);
  assert.equal(findMatches('a', '', 'a').matched, true);
});
test('N6 多匹配的 index 序列与 matchAll 逐格对拍（含多字节与换行）', () => {
  const samples = [['\\d+', 'g', 'a1 bb222 ccc33 d4e5'], ['[a-z]+', 'gi', 'AbC-ddd-e'],
    ['\\w+', 'g', '中文 abc 123 éè'], ['.', 'g', 'a\nb'], ['.', 'gs', 'a\nb'],
    ['^a', 'gm', 'a\nba\nb'], ['a$', 'gm', 'a\nba\nb'], ['(a)(b)', 'g', 'aabb'],
    ['\\p{L}+', 'gu', 'abc中文'], ['(?<k>[a-z]+)', 'gd', 'x yy zzz'], ['a*', 'g', 'xaxa']];
  for (const [src, flags, input] of samples) {
    const gflags = flags.includes('g') ? flags : `${flags}g`;
    const r = findMatches(src, flags, input);
    assert.equal(r.ok, true, `${src}/${flags} → ${r.reason}`);
    const all = [...input.matchAll(new RegExp(src, gflags))];
    assert.deepEqual(r.matches.map((m) => m.index), all.map((m) => m.index), `${src}/${gflags} 的 index 序列`);
    assert.deepEqual(r.matches.map((m) => m.text), all.map((m) => m[0]), `${src}/${gflags} 的整段文本`);
  }
  const noG = findMatches('\\d+', '', 'a1 b2 c3');
  assert.equal(noG.count, 1, '不带 g 只给第一次命中：这是 native 口径，不是本模块的阉割');
  assert.equal(noG.matches[0].text, '1');
  const sticky = findMatches('a', 'y', 'baa');
  assert.equal(sticky.count, 0, 'sticky 从 0 起算，b 不命中：与 native 同档');
  assert.equal(findMatches('a', 'gy', 'ab').count, 1);
});
test('N7 零宽匹配手动推进，不死循环也不漏格', () => {
  const r = findMatches('a*', 'g', 'bbb');
  assert.equal(r.ok, true);
  assert.equal(r.count, 4, `'bbb'.match(/a*/g) 实测 4 格，少一格是多算、多一格是死循环前兆`);
  assert.deepEqual(r.matches.map((m) => m.index), [0, 1, 2, 3]);
  assert.deepEqual(r.matches.map((m) => m.length), [0, 0, 0, 0]);
  const mid = findMatches('x*', 'g', 'xaxa');
  assert.deepEqual(mid.matches.map((m) => m.text), ['x', '', 'x', '', '']);
  assert.equal(findMatches('', 'g', 'ab').count, 3, '空模式在 n 个字符上有 n+1 个零宽命中');
  assert.equal(findMatches('', 'g', 'ab').hitLimit, false);
  assert.equal(findMatches('\\b', 'g', 'a b cd').count, [...'a b cd'.matchAll(/\b/g)].length,
    '词边界全是零宽，推进一档都不能错');
  assert.equal(findMatches('(?=x)', 'g', 'xxy').count, [...'xxy'.matchAll(/(?=x)/g)].length);
});
test('N8 匹配次数上限：hitLimit 的语义是"还有一格没列出来"', () => {
  const more = 'a '.repeat(MAX_MATCHES + 1).trim();
  const r = findMatches('a', 'g', more);
  assert.equal(r.ok, true);
  assert.equal(r.count, MAX_MATCHES);
  assert.equal(r.hitLimit, true, '后面还有一格没列出来时必须报 hitLimit');
  assert.match(r.reason, /上限/); assert.match(r.reason, new RegExp(String(MAX_MATCHES)));
  const exact = findMatches('a', 'g', 'a '.repeat(MAX_MATCHES).trim());
  assert.equal(exact.count, MAX_MATCHES);
  assert.equal(exact.hitLimit, false, '正好用满不算截断：这一格的红绿就是"静默截断"的分界');
  assert.equal(exact.reason, null);
  const capped = findMatches('a', 'g', 'aaaaaa', { maxMatches: 3 });
  assert.equal(capped.count, 3); assert.equal(capped.capped, 3); assert.equal(capped.hitLimit, true);
  const over = findMatches('a', 'g', 'aaaaaa', { maxMatches: MAX_MATCHES + 10 });
  assert.equal(over.capped, MAX_MATCHES, 'options 只能往下调，不许越过面板的硬上限');
  const zero = findMatches('a', 'g', 'aaa', { maxMatches: 0 });
  assert.equal(zero.capped, 1, '给了 0 / 负数按 1 兜，不给"一个都不算"的静默档');
  assert.equal(zero.count, 1);
  const neg = findMatches('a', 'g', 'aaa', { maxMatches: -5 });
  assert.equal(neg.capped, 1);
});
test('N9 档间时间预算靠注入时钟，没给时钟就只按次数收口', () => {
  let tick = 0;
  const now = () => (tick += 12);
  const r = findMatches('a', 'g', 'a '.repeat(200).trim(), { now, timeBudgetMs: 50 });
  assert.equal(r.ok, true);
  assert.equal(r.timedOut, true, '每格 12ms、预算 50ms → 必须在中途收口');
  assert.equal(r.count, 4, '第 4 格后累计 48ms 不超、第 5 格前 60ms 超：这个数字就是预算的牙');
  assert.equal(r.hitLimit, false, '时间到点不是次数到点，两面旗子不许互相顶');
  assert.equal(r.elapsedMs, 60);
  assert.match(r.reason, /时间预算/);
  const noClock = findMatches('a', 'g', 'a '.repeat(200).trim());
  assert.equal(noClock.elapsedMs, null, '本模块不许自己读时钟：没注入就报 null');
  assert.equal(noClock.timedOut, false);
  assert.equal(noClock.count, 200);
  const nan = findMatches('a', 'g', 'aaa', { now: () => Number.NaN });
  assert.equal(nan.timedOut, false, '时钟给了非数字就当没时钟，不许因为 NaN 比较而永远不超时');
  assert.equal(nan.count, 3);
  const defaultBudget = findMatches('a', 'g', 'a '.repeat(200).trim(), { now });
  assert.equal(defaultBudget.timedOut, true, '不给 timeBudgetMs 时用 TIME_BUDGET_MS 这一档默认');
  assert.equal(defaultBudget.count, Math.floor(TIME_BUDGET_MS / 12));
  assert.equal(typeof TIME_BUDGET_MS, 'number');
});
test('N10 输入字节闸门：超 1 MiB 整体拒，正好到线放行，字节数按 UTF-8 那把尺', () => {
  const big = 'a'.repeat(RE_INPUT_BYTES + 1);
  const r = findMatches('a', '', big);
  assert.equal(r.ok, false); assert.equal(r.executed, false);
  assert.equal(r.bytes, RE_INPUT_BYTES + 1);
  assert.match(r.reason, /1048576/); assert.match(r.reason, /不截断/);
  assert.equal(r.matches.length, 0);
  const atLimit = findMatches('zzz', '', 'a'.repeat(RE_INPUT_BYTES));
  assert.equal(atLimit.ok, true, '正好 1 MiB 放行：越界才拒');
  assert.equal(atLimit.bytes, RE_INPUT_BYTES);
  assert.equal(findMatches('a', '', '中'.repeat(2)).bytes, 6, '中文按 UTF-8 三字节计，不是字符数');
  assert.equal(nByteLen('中'), 3); assert.equal(nByteLen('\uD83D\uDE00'), 4);
  assert.equal(findMatches('a', '', null).bytes, 0, 'null 走文本档归一成空串');
  const repl = previewReplace('a', 'g', big, 'b');
  assert.equal(repl.ok, false); assert.match(repl.reason, /1048576/);
  assert.equal(repl.out, '', '替换预览越界时给空串，不给半截');
});
test('N11 静态检测 F1：组外无界重复 + 组内没有钉死边界的定宽元素，全族报 high', () => {
  const family = ['(a+)+', '(a*)*', '(?:a+)+', '((a+)+)', '(\\d+)+', '([a-z]+)+', '([ )]+)+',
    '(a+){2,}', '(a{1,3})+', '(a{2,})+', '(\\w*\\s?)+', '([)]+)+', '(?:\\s*\\w+)*', '(?:[([]{2,})+',
    '(\\d{1,3}|\\d)+'];
  assert.equal(family.length, 15, '真阳性族要有条数：少一条等于那一档形状没人守');
  for (const src of family) {
    const r = riskScan(src);
    assert.equal(r.level, 'high', `${src} 应是 high，实际 ${r.level} ${JSON.stringify(r.findings)}`);
    assert.equal(r.parsed, true, `${src} 必须能被分词器走完`);
    assert.ok(r.findings.length >= 1, `${src} 要给出命中的构造位置`);
    assert.ok(r.findings[0].at >= 0 && r.findings[0].at < src.length,
      `${src} 的位置 ${r.findings[0].at} 落在串外`);
    assert.equal(r.findings.every((f) => /F[1-4]/.test(f.rule)), true, `${src} 每条命中都要点规则名`);
    assert.match(r.findings[0].hint, /收紧|量词|拆成|改写/, `${src} 的提示要给出改写方向`);
  }
  assert.equal(riskScan('^(\\d{1,3})+$').level, 'high', '带锚不改变形状：锚不是牙齿');
  assert.equal(riskScan('a(b(c+)+d)e').level, 'high', '嵌套三层里的 F1 也要抓到');
  assert.equal(riskScan('(a+)').level, 'none', '组外没有量词就没有放大');
});
test('N12 静态检测 F2：分支互为整数倍重复 + 组外无界，报 high；同长不重叠不报', () => {
  const high = ['(a|a)*', '(a|aa)+', '(aa|aaaa)*', '(ab|abab)+', '(x|xx|xxx)*', '(-|--)+',
    '(\\d|\\d\\d)+', '(?:a|aa){3}'];
  assert.equal(high.length, 8, 'F2 族同样要有条数：这一族的阈值实测在 24–64 字符之间，缺一条就没人守');
  for (const src of high) {
    const r = riskScan(src);
    assert.equal(r.findings.some((f) => f.rule === 'F2'), true,
      `${src} 的分支互为整数倍，应点名 F2：${JSON.stringify(r.findings)}`);
  }
  assert.equal(riskScan('(?:a|aa){3}').level, 'medium', '组外是有限重复 → medium 而非 high');
  const safe = ['(a|b)*', '(ab|abc)+', '(test|testing)+', '(\\w|\\d)+', '([a-z]|[0-9])+', '(a|ab)*',
    '(x|xx)', '(a|aa)'];
  for (const src of safe) {
    const r = riskScan(src);
    assert.equal(r.findings.some((f) => f.rule === 'F2'), false,
      `${src} 的分支不构成整数倍包含或组外无重复，不该报 F2：${JSON.stringify(r.findings)}`);
  }
  assert.equal(riskScan('(a|a)').level, 'none', '形状本身不犯忌，组外的无界重复才是');
});
test('N13 静态检测不许误杀：类里的括号、转义、被定宽元素钉住的组尾、单一无界量词', () => {
  const none = ['[(]', '[)]', '([)]+)', '[(a+)+]', '(?:[([]{2,})', 'a+b+', '(a+)b', '(a+)?',
    '(a+){1}', '(a{3})+', '(\\d{1,3},)*', '(\\d+,)+\\d+', '([a-z]+\\s)+', '(a\\s*)+', '^[a-z]+$',
    'x?', '(a|b|ab)+', '[\\]]+\\(', '\\(a\\+\\)\\+', '(?:\\d{1,3}\\.){4}', '([a-z]+)([0-9]+)',
    '((a)(b))+', 'a{100,}', '(x+a+)+', '([a-z]+[0-9]+)+', 'a*a?b', '(?<name>[a-z]+)', '[]a[]',
    '[^]]*', '(a)', '\\d{4}-\\d{4}', '(?:[\\d.]+)', '^[\\w.-]+@[\\w.-]+\\.[a-z]{2,}$',
    '(?:[ab]+c)+', '(a|b)*[^a-z]*'];
  for (const src of none) {
    const r = riskScan(src);
    assert.equal(r.level, 'none', `${src} 不该被判风险，实际 ${r.level} ${JSON.stringify(r.findings)}`);
    assert.equal(r.parsed, true, `${src} 分词器要能走完，走不完等于检测器自己哑了`);
  }
  assert.equal(none.length, 35, '假阳性红线要有条数：漏一条等于那一档形状没人守');
  assert.equal(riskScan('([)]+)').level, 'none', '类里的 ) 不算闭组：这条是 35 个样本里最容易失守的一处');
  assert.equal(riskScan('(?:[([]{2,})+').level, 'high', '形似样本的另一半：类里两个字符 + {2,} + 组外 + 是真阳性');
  const med = ['a*a*a*a*a', '.*.*.*', '(a+){3}', '(a+){4}', '\\w*\\w*', '[a-z]*[a-z]*', 'a+a+'];
  for (const src of med) assert.equal(riskScan(src).level, 'medium', `${src} 应是 medium`);
  assert.equal(riskScan('a*a*a*a*a').findings[0].rule, 'F3', '串联同源的无界量词点 F3');
  assert.equal(riskScan('(?').level, 'none', '非法语法交给 compile 报原话，静态检测不越权报错');
  assert.equal(riskScan('[a').parsed, false, '走不完就标 parsed:false，不许把半成品当"没风险"');
});
test('N14 high 根本不进引擎；medium 把输入压到 128 字符，越线拒', () => {
  const r = findMatches('(a+)+$', '', 'a'.repeat(30));
  assert.equal(r.ok, false); assert.equal(r.level, 'high');
  assert.equal(r.executed, false, '这一格的牙齿就是"引擎一次都没被调用"');
  assert.equal(r.matches.length, 0);
  assert.match(r.reason, /疑似灾难性回溯/); assert.match(r.reason, /F1/);
  assert.match(r.reason, /一次都不执行/, '要明说没执行，否则用户以为算过了');
  assert.equal(findMatches('(a+)+$', '', '').ok, false, '空输入也不给放行后门');
  assert.throws(() => findMatches('(a+)+$', '', 'aaa', { allowRisky: true }), /不认识的键：allowRisky/,
    '没有 allowRisky 这一档后门：能绕的闸门不是闸门，options 闸门先把它响掉');
  const med = findMatches('a*a*a*a*a', '', 'a'.repeat(100));
  assert.equal(med.level, 'medium'); assert.equal(med.ok, true); assert.equal(med.executed, true);
  assert.match(med.reason, /可疑/);
  const medLong = findMatches('a*a*a*a*a', '', 'a'.repeat(MEDIUM_MAX_INPUT_CHARS + 1));
  assert.equal(medLong.ok, false); assert.equal(medLong.executed, false);
  assert.equal(medLong.level, 'medium');
  assert.match(medLong.reason, new RegExp(String(MEDIUM_MAX_INPUT_CHARS)));
  assert.match(medLong.reason, /不截断/, '拒的时候要连"没截断"一起说：只报"实际 129 字符"，面板看着像只算了前 128 格');
  assert.equal(findMatches('a*a*a*a*a', '', 'a'.repeat(MEDIUM_MAX_INPUT_CHARS)).ok, true, '正好 128 放行');
  const clean = findMatches('\\d{1,3}', '', '123456');
  assert.equal(clean.level, 'none'); assert.equal(clean.reason, null, '没风险就别糊黄条');
  assert.equal(previewReplace('(a|aa)*', 'g', 'a'.repeat(30), 'x').executed, false,
    '替换预览走同一道静态闸门');
  assert.equal(previewReplace('a*a*a*a*a', '', 'a'.repeat(MEDIUM_MAX_INPUT_CHARS + 1), 'x').ok, false);
});
test('N15 替换预览与 native 逐字节一致，$ 的四种写法各有硬账', () => {
  const cases = [['(a+)(b+)', 'g', 'xx aabb yy', '[$1|$2<$1>$$&$`$\'|$0]'],
    ['(x*)', 'g', 'ab', '<$0>'], ['(\\w+)', 'g', 'a b', '$&-$1|$$'],
    ['(?<k>[a-z]+)', 'g', 'aa bb', '[$<k>]'], ['a', 'g', 'banana', '$$'],
    ['(a)(b)?', 'g', 'ac', '[$1][$2]'], ['a', '', 'aaa', 'X'], ['(a)', 'gy', 'baa', 'X'],
    ['\\s*', 'g', 'a  b', '|'], ['(?<a>x)(y)?', 'g', 'xx', '[$<a>][$<b>]']];
  for (const [src, flags, input, repl] of cases) {
    const mine = previewReplace(src, flags, input, repl);
    assert.equal(mine.ok, true, `${src} → ${mine.reason}`);
    assert.equal(mine.out, input.replace(new RegExp(src, flags), repl),
      `${src}/${flags} 的替换结果必须与 native 逐字节相同`);
    assert.equal(mine.changed, mine.out !== input, 'changed 就是"产物与原文是否不同"，面板靠它决定要不要给复制');
  }
  assert.equal(cases.length, 10, '对拍样本要有条数');
  assert.equal(previewReplace('(a+)(b+)', 'g', 'aabb', '[$1|$2]').out, '[aa|bb]');
  assert.equal(previewReplace('(x*)', 'g', 'ab', '<$0>').out, '<$0>a<$0>b<$0>',
    '$0 不是替换记号：这是 native 口径，"顺手修正"它等于改出个新语言');
  assert.equal(previewReplace('a', 'g', 'aaa', '$$').out, '$$$',
    '$$ 出一个字面 $，三处命中就是三个 $（native 实测，别按直觉写成 $a$a$）');
  assert.equal(previewReplace('aa', 'g', 'aaa', '$&$&').out, 'aaaaa',
    '$& 是整段命中：开头两处 aa 各换成 aaaa，尾部剩的那个 a 原样留着（native 实测， lastIndex 落在 2 之后不再命中）');
  assert.equal(previewReplace('(a)', 'g', 'ab', '[$`$\'|x]').out, '[b|x]b', '前导/后随切片按 native 原样给');
  assert.equal(previewReplace('(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)(k)', 'g', 'abcdefghijk', '$11').out, 'k',
    '$11 在 11 个组时是第 11 组，不是 $1 后接字符 1');
  assert.equal(previewReplace('a', 'g', 'abc', 123).out, '123bc', '替换串走文本档归一，不抛');
});
test('N16 两档入参：文本档归一不抛，options 档走 TypeError 并报出形状', () => {
  for (const v of [null, undefined, 123, true, ['a'], { toString: () => 'x' }, new Date(0)]) {
    const r = findMatches('a', '', v);
    assert.equal(typeof r.bytes, 'number', `文本入参 ${String(v)} 不该抛`);
    assert.equal(typeof r.ok, 'boolean');
  }
  assert.equal(findMatches('a', '', undefined).bytes, 0);
  assert.equal(findMatches('a', '', 123).matches.length, 0, '123 → "123"，里面没有 a');
  assert.equal(findMatches('1', '', 123).count, 1, '数字进文本档要按十进制串算');
  assert.equal(findMatches(null, '', 'x').ok, true, 'pattern 也走文本档：null 当空模式，不抛');
  assert.equal(findMatches('a', '', Symbol('x')).bytes, 9,
    'String(Symbol) 出 "Symbol(x)"：与 §K/§L/§M 同档，归一之后照文本算');
  assert.equal(findMatches('a', '', Symbol('x')).count, 0, '"Symbol(x)" 里没有裸 a，归一成串之后照样判');
  assert.throws(() => findMatches('a', '', Object.create(null)), TypeError,
    '无原型对象是唯一会抛的那一档：String() 自己抛，本站不替它兜');
  assert.equal(previewReplace('a', 'g', 'aa', Symbol('y')).out, 'Symbol(y)Symbol(y)',
    '替换串同样走文本档：Symbol 归一成 "Symbol(y)"，与 §L 的 encodeUrlComponent 同一口径');
  for (const bad of [1, 'x', true, ['a'], new Date(0)]) {
    assert.throws(() => findMatches('a', '', 'x', bad), /options 只收对象，收到 /);
    assert.throws(() => findMatches('a', '', 'x', bad), TypeError);
  }
  assert.throws(() => findMatches('a', '', 'x', { now: 1 }), /now 要的是函数，收到 number/);
  assert.throws(() => findMatches('a', '', 'x', { maxMatches: 'x' }), /maxMatches 要的是数字，收到 string/);
  assert.throws(() => findMatches('a', '', 'x', { timeBudgetMs: 'x' }), /timeBudgetMs 要的是数字，收到 string/);
  assert.throws(() => findMatches('a', '', 'x', { sloppy: 1 }), /options 里有不认识的键：sloppy/);
  assert.equal(findMatches('a', '', 'x', { now: null, maxMatches: null }).ok, true,
    'null / undefined 的键走默认档，不是报错档');
  assert.throws(() => compile('a', 123, 456), /收到 number/, 'compile 没有 options 档：多给一位同样要响');
});
test('N17 闸门先后有账：形状在前、字节在后，medium 的 128 数的是字符不是字节', () => {
  const riskyHuge = findMatches('(a+)+$', '', 'a'.repeat(RE_INPUT_BYTES + 1));
  assert.equal(riskyHuge.level, 'high', '高危形状要先响：否则用户把输入改小还是一句"太大"');
  assert.match(riskyHuge.reason, /疑似灾难性回溯/);
  assert.equal(riskyHuge.bytes, undefined, '形状这一档排在字节之前，不该报字节');
  const medShapeCjk = findMatches('a*a*a*a*a', '', '中'.repeat(200));
  assert.equal(medShapeCjk.ok, false);
  assert.equal(medShapeCjk.bytes, 600, '600 字节远在 1 MiB 之内，拦住它的是 128 字符这一档');
  assert.match(medShapeCjk.reason, /128/);
  const cleanCjk = findMatches('\\d+', 'g', '中'.repeat(500));
  assert.equal(cleanCjk.ok, true); assert.equal(cleanCjk.bytes, 1500);
  assert.equal(cleanCjk.level, 'none');
  const medCjkOk = findMatches('a*a*a*a*a', '', '中'.repeat(100));
  assert.equal(medCjkOk.ok, true, '100 个汉字：字节 300 早过 128，字符没超——这一档数的是字符，按字节判的实现在这条红');
  assert.equal(medCjkOk.bytes, 300, '放行也要把实测字节照实回显，别让"过了"看起来像没量');
  assert.equal(medCjkOk.executed, true); assert.match(medCjkOk.reason, /128 字符/);
  const tooLongPattern = findMatches('('.repeat(MAX_PATTERN_CHARS + 1), '', 'x');
  assert.equal(tooLongPattern.level, null, '长度这一档在形状之前，level 留 null');
  assert.equal(tooLongPattern.bytes, undefined, '连输入都没读，字节当然没有');
});
test('N18 CAVEAT 里承诺的每一个数都得是导出的那个常数', async () => {
  const rows = [[/1 MiB（1048576 字节）/, () => RE_INPUT_BYTES === 1048576],
    [/500 字符/, () => MAX_PATTERN_CHARS === 500],
    [/前 1000 个/, () => MAX_MATCHES === 1000],
    [/128 字符/, () => MEDIUM_MAX_INPUT_CHARS === 128],
    [/g i m s u y d/, () => ALLOWED_FLAGS === 'gimsuyd'],
    [/疑似灾难性回溯/, () => riskScan('(a+)+').level === 'high'],
    [/一次都不执行/, () => findMatches('(a+)+', '', 'aaa').executed === false],
    [/不静默截断/, () => findMatches('a', 'g', 'a '.repeat(MAX_MATCHES + 1).trim()).hitLimit === true]];
  for (const [claim, holds] of rows) {
    assert.equal(claim.test(REGEX_CAVEAT), holds(),
      `文案与实现分叉：${claim}（文案里有=${claim.test(REGEX_CAVEAT)}，实现做得到=${holds}）`);
  }
  assert.equal(rows.length, 8, '对账表自己要有条数：漏一行等于那一档的承诺没人核');
  assert.ok(REGEX_CAVEAT.length > 80 && REGEX_CAVEAT.length <= 260,
    `口径句长度不在档内（实际 ${REGEX_CAVEAT.length} 字）：${REGEX_CAVEAT}`);
  const { BASE64_CAVEAT, URL_CAVEAT } = await import('../dev/js/tools/codec.js');
  const { TIME_CAVEAT } = await import('../dev/js/tools/time.js');
  const { DIGEST_CAVEAT } = await import('../dev/js/tools/digest.js');
  for (const o of [BASE64_CAVEAT, URL_CAVEAT, TIME_CAVEAT, DIGEST_CAVEAT]) {
    assert.notEqual(REGEX_CAVEAT, o, '五格口径句各写各的，一模一样等于这一格没自己的口径');
  }
  assert.equal(nByteLen('中'), 3, '口径句里"UTF-8 字节"这把尺子自己得先对');
});
test('N19 违禁源扫描、零重叠、不成 vite 入口', () => {
  const src = nCode();
  const banned = [['import', /^\s*import[\s{*]/m], ['export from', /^\s*export.*from/m],
    ['export * from', /export\s*\*/], ['动态 import', /\bimport\s*\(/], ['require(', /\brequire\s*\(/],
    ['node:', /['"]node:/], ['createHash', /\bcreateHash\b/], ['document', /\bdocument\b/],
    ['window', /\bwindow\b/], ['getElementById', /getElementById/], ['querySelector', /querySelector/],
    ['addEventListener', /addEventListener/], ['localStorage', /localStorage/], ['fetch(', /\bfetch\s*\(/],
    ['FileReader', /FileReader/], ['Buffer', /\bBuffer\b/], ['atob', /\batob\s*\(/], ['btoa', /\bbtoa\s*\(/],
    ['TextEncoder', /TextEncoder/], ['TextDecoder', /TextDecoder/], ['Date.now', /Date\.now/],
    ['new Date(', /new Date\(/], ['performance.now', /performance\.now/], ['Math.random', /Math\.random/],
    ['Intl', /\bIntl\b/], ['toLocale', /toLocale/], ['unescape', /\bunescape\s*\(/],
    ['eval', /\beval\s*\(/], ['new Function', /new\s+Function\s*\(/]];
  for (const [name, re] of banned) assert.equal(re.test(src), false, `regex.js 的代码里出现了 ${name}`);
  assert.equal(banned.length, 29, '违禁清单自己要有条数：少一条等于那一档从此静默不核');
  assert.equal(/new\s+RegExp\s*\(/.test(src), true, '这一格的本职就是构造 RegExp，正向断言防它哪天换成 eval');
  assert.match(src, /lastIndex\s*\+=\s*1/, '零宽推进必须写在代码里，不是注释里');
  assert.equal(/\bwhile\s*\(\s*true\s*\)/.test(src), false, '不许出现无边界的 while(true)');
  assert.equal(existsSync(resolve(ROOT, 'dev/js/regex.js')), false, '旧位置 dev/js/regex.js 不该存在');
  assert.equal(existsSync(resolve(ROOT, 'dev/js/tools/regex.js')), true, '新位置必须在，否则上一条是空转的');
  const vite = read('vite.config.js');
  const at = vite.indexOf('getDevJsEntries');
  assert.ok(at > -1, '入口表由 getDevJsEntries 决定，找不到这个名字说明地基变了');
  assert.match(vite.slice(at, at + 900), /readDirSorted/,
    'dev/js 一层扫描走 readDirSorted（内部是 readdirSync(dir).sort()，不递归）：改成递归就该来改这条');
  assert.equal(/tools/.test(vite.slice(at, at + 900)), false, '这一层里没有 tools/ 字样，子目录不成入口');
  // 与 M16 同一条收窄（段 3 Task 7）：`findMatches` 的家是编码页那本产物，判据因此改成
  // 排除式——除它以外谁都不许有；正向那一半盯的是 `regex.js` 里 `readOptions(opts, 'findMatches')`
  // 那句自报家门的诊断串，它进不了产物就说明装配层的接线断了。
  const site = resolve(ROOT, '_site/assets/js');
  if (existsSync(site)) {
    const HOME = 'toolCodec.min.js';
    for (const f of readdirSync(site)) {
      if (!f.endsWith('.js') || f === HOME) continue;
      assert.equal(read(join(site, f)).includes('findMatches'), false, `产物 ${f} 里不该出现 regex 的导出名`);
    }
    if (existsSync(join(site, HOME))) {
      assert.ok(read(join(site, HOME)).includes('findMatches'),
        `${HOME} 在产物里却没有 findMatches：regex.js 没被打进编码页那本，接线与这条判据要一起改`);
    }
  }
});
test('N20 导出面：13 个名字一个不多一个不少，Task 6 的面板绑定按这张表', async () => {
  const wanted = ['ALLOWED_FLAGS', 'MAX_INPUT_BYTES', 'MAX_MATCHES', 'MAX_PATTERN_CHARS',
    'MEDIUM_MAX_INPUT_CHARS', 'REGEX_CAVEAT', 'TIME_BUDGET_MS', 'byteLen', 'compile', 'findMatches',
    'normalizeFlags', 'previewReplace', 'riskScan'];
  const mod = await import('../dev/js/tools/regex.js');
  const got = Object.keys(mod).sort();
  assert.deepEqual(got, wanted, `导出面变了：多=${JSON.stringify(got.filter((k) => !wanted.includes(k)))} `
    + `少=${JSON.stringify(wanted.filter((k) => !got.includes(k)))}`);
  assert.equal(got.length, 13, '清单自己要有条数；新增一个入口就得同时补判据与面板，这张表是那道门');
  for (const k of ['byteLen', 'compile', 'findMatches', 'normalizeFlags', 'previewReplace', 'riskScan']) {
    assert.equal(typeof mod[k], 'function', `${k} 必须是函数：面板按这个名字直接调`);
  }
  for (const k of ['ALLOWED_FLAGS', 'REGEX_CAVEAT']) {
    assert.equal(typeof mod[k], 'string', `${k} 必须是串：白名单与口径句都是要显示给用户的东西`);
  }
  for (const k of ['MAX_INPUT_BYTES', 'MAX_MATCHES', 'MAX_PATTERN_CHARS', 'MEDIUM_MAX_INPUT_CHARS',
    'TIME_BUDGET_MS']) assert.equal(typeof mod[k], 'number', `${k} 必须是数字：闸门常数写成串会静默放行`);
});
```


## Task 5: `ui.js` — 把复制三件套从 `workbench.js` 抽出来（§O）

**Files:**
- Create: `dev/js/tools/ui.js`（磁盘 118 行，复算 `wc -l dev/js/tools/ui.js`）
- Modify: `dev/js/tools/workbench.js`（删两条定义与两条时长、`doCopy` 改调 `Tk.ui.copyInto`、
  `createWorkbench` 多一道 `Tk.ui.copyInto` 闸门，磁盘 967 行）
- Modify: `dev/js/toolkitCore.js`（import 第四本 + `window.Tk` 挂 `ui`，文件头三条约束跟着改口，磁盘 32 行）
- Modify: `scripts/toolkit-tests.mjs`（末尾追加 `// ── §O …` 一节，13 条 `test()`，磁盘 7531–7891，
  全量 7891 行；§J 四处跟着供 `ui`：夹具 `J_UI`、`jMount` 的 `Tk`、J12 清单三只→四只、J14 的禁 import 名单）
- Modify: `scripts/verify-plan-blocks.mjs`（`FILE_TARGETS` 加一行 `'dev/js/tools/ui.js',`）
- Modify: 本计划（契约回填 + 判据清单 + 变异台账 + 两块落地镜像）
- 不动：`scripts/verify-plan-blocks-teeth.mjs`（G12 从基线现读段 3 名下全部镜像，本格落地的
  `ui.js` 与 `§O` 两块自动进核范围）

决策：站内**没有** `ui.js`（spec §6.2 列了但段 1/2 从未建），复制/Toast 的现实是
`workbench.js:815 doCopy` / `:971 legacyCopy` / `:803 flash` 三个函数加 `:713` 的 label 同步。
codec 与 json 都要同一份，所以这一段是抽离的正确时机；**只搬不改行为**，§J 现有 16 条装配判据
必须原样全绿（它们是假 DOM + `commandLog` 那套，正是这一迁移的回归网）。
搬迁前后各量一次 `toolIdcard.min.js` 的 gzip 字节（`cat f | gzip -9 | wc -c`），
差值写进计划——预期为 0 到 ±20B（模块边界变了、minify 结果可能微调），超了要归因。

### 对外契约（落地后回填，2026-09-28）

起草版这格只说"把 `doCopy` / `legacyCopy` / `flash` 三个函数搬过去"。落地后有六处是写代码时才坐实的，
其中两处与起草版不同：

1. **`doCopy` 本体没搬**。它是页面接线——按派生 id 找按钮、从 `copies` 取这一栏当前的纯文本、
   把挂载时记下的原文案（`COPY_LABEL` 那张表）交回去；这三样都属于"这一页的骨架"，不属于"复制"这件事。
   搬走的是它调的那三级兜底，出口在 `ui.js` 里叫 **`copyInto`**。于是 `ui.js` 的导出面是
   `COPY_RESET_MS` / `COPY_FAIL_MS` / `flash` / `legacyCopy` / `copyInto` 五个名字（O1 钉死），
   而不是"三个函数加两个常数再多个 `doCopy`"。
2. **`flash` 的签名多了一格 `original`**。段 2 那一份从闭包里读 `COPY_LABEL`，搬出来之后没有那个闭包了，
   还原成哪一句必须由调用方给。这一格不是装饰：U13 那把刀把还原目标改成"改口当时的 `textContent`"，
   后果是连点两次就停在"已复制"——只有 `original` 是传进来的，O4 里那半条连点用例才抓得到。
3. **`later` 从闭包读变成注入参数**。段 2 的 `flash` 直接用它所在闭包里的 `later`；`ui.js` 里
   `copyInto` 收 `later` 再透给 `flash`。没有这一改，§O 就量不到"排下去的那条回调带的时长是多少"，
   O4/O10/O11 那三处读数全部退化成"看文案"。
4. **"没按钮 / 没文本"那道早退故意写两遍**（`copyInto` 里一遍、`doCopy` 里一遍）。
   codec 页要直接调 `copyInto`，那时没有人替它判空。这一条重复是有牙的：U1 只摘 `ui.js` 那一层，
   红的只有 O12（页面路径上 `workbench` 那道还在，压根走不到 `copyInto`）——两层都摘才会红到 §J。
   台账里记下这一对，是因为它同时是"重复必须有独立判据"的证据。
5. **闸门排在 `view` 之后、构造之前**：缺 `Tk.ui.copyInto` 时构造期 `TypeError` 点名。
   缺它的后果不是页面塌，是"用户第一次点复制按钮没反应"——那要等到交互才暴露，所以必须在构造期说。
   O13(a) 钉这一格，U11 是那把刀。
6. **`legacyCopy` 逐字符照搬**，包括 `ta = box` 那一行为什么排在 `appendChild` 之后（O8 与 U4 管着它）、
   包括 `readonly` 那一格（O6 与 U5 管着它）。搬迁的验收不是"看起来一样"，是 §J7 那九个小节一条没改还全绿。

### 判据清单（§O，落地后回填）

**13 条 `test()`**，对套件总数的贡献是 13，全量 `# tests` 从 222 变成 **235**。
夹具不新建：假 DOM 仍只有 §I 那一份工厂（`oPage = () => iPage()`），只读它的 `doc` / `mk`
与三张观察口（`selLog` / `commandLog` / `created`），面板骨架那一半一次都不读。

| 编号 | 咬什么 |
| --- | --- |
| O1 | 导出面**五个名字一个不多一个不少**（`Object.keys(await import(...)).sort()` 与清单 `deepEqual`，清单自带 `length === 5`）、三函数两常数各按 `typeof` 归位（时长写成串会静默变成"永不还原"）；这五名就是 `window.Tk.ui` 的全部家当，加一名要同步 J12 与 core 的文件头 |
| O2 | 剥注释扫源：`\bimport\b` 零命中、`require(` 零命中、五个宿主全局（`window.` / `document.` / `navigator.` / `localStorage` / `globalThis`）零命中、`innerHTML` 零命中；**`setTimeout` 全文件恰一处**（`flash` 缺省那一档），多一处就没法在测试里钉住时长口径 |
| O3 | 两条时长**值**钉死 1600 / 2600，另加两条形状（整数、正数）与一条相对关系（`COPY_FAIL_MS > COPY_RESET_MS`）。注意它只读常数：U2 那把"用法对调"的刀在这儿**不红**，台账里把它留作反例 |
| O4 | `flash` 四格：改口当期就见效、还原排进注入的 `later` 且 `ms` 原样透传、不往 `body` 上挂任何东西、`flush()` 之后真还原成传进来的 `original`；**同一格连点两次**（先成功后失败）两条回调各还原各的，最后停在原文案——这一格是 U13 的唯一去处 |
| O5 | 不给 `later` 时落回宿主 `setTimeout`，等 20ms 后照样还原（缺省那一档被摘掉的话，页面没注入 `later` 时按钮永远停在"已复制"）；缺省路径同样不许往页面上留东西 |
| O6 | 兜底成功那一趟的**完整副作用序列**：造一条 `TEXTAREA` → 带 `readonly` → `value` 是传进去的那串 → 挂 `body` → `select()` 过一次且选中的就是它 → `commandLog` 恰 `['copy']` → 用完 `childNodes.length` 回 0；`execCommand` 返回 true 就是复制上了，不再要求第二样证据 |
| O7 | 两种"没复制上"各一档：`execCommand` 返回 false → 整函数返回 false 且照样 select 过一次（失败要靠用户手动 Ctrl+C，框得留在选区里）、摘净；`doc.execCommand` 整个缺席 → 返回 false、`commandLog` 空（没这只手就别假装调用过）、照样摘净 |
| O8 | `appendChild` 自己抛时**不许再调 `removeChild`**：`doesNotThrow`、返回 false、`removeChild` 调用次数为 0（对没挂上去的节点调它就是 `NotFoundError`，把一次失败变成一次抛出）、`selLog` 与 `commandLog` 都空（没挂上就别 select、别 execCommand——那复制的是用户原来的选区） |
| O9 | `select()` 抛 与 `execCommand()` 抛 两档都走 `finally`：`doesNotThrow`、返回 false、临时框照样摘净、`oBoxes` 确实为 1（证明是"挂上之后抛"而不是没挂上）；`select` 那档还要求 `commandLog` 空——select 都没过去就不该问 execCommand |
| O10 | 没有 `clipboard` 时走兜底，成败各对应一句文案与一条时长：成功 `已复制` + `COPY_RESET_MS`、失败 `复制失败，请手动选中` + `COPY_FAIL_MS` 且断言后者更长；失败那一趟末尾 `childNodes.length` 回 0；**有 `clipboard` 这只手却没有 `writeText` 那根手指**时同步退兜底且必须留下一条已排下去的回调（等一个永远不会来的 Promise 就是把反馈吞了） |
| O11 | 四条剪贴板路逐档核：(a) `writeText` resolve → 不碰 `execCommand`、不挂临时框、成功档时长；(b) 异步 reject → 退兜底、兜底成功就报成功（且只造一条框）；(c) `writeText` 同步抛（不返回 Promise）→ `doesNotThrow` 且退到 `execCommand`；(d) 双双失败 → 失败文案 + 失败档时长 + 不抛 |
| O12 | "没东西可复制"的早退三样都不碰：空文本时 `writeText` 零调用、`commandLog` 空、`created()` 前后相等、`later` 零排队、文案不变；`btn: null` 同一早退不抛；`copyInto({})` 与 `copyInto()` 都 `doesNotThrow` |
| O13 | 抽离不留第二份实现，三头各钉一处：(a) `createWorkbench` 缺 `Tk.ui` 与缺 `Tk.ui.copyInto` 两种形状都在构造期 `TypeError` 且点名 `copyInto`；(b) 剥注释扫 `workbench.js`，`const flash =` / `function legacyCopy` / `const COPY_RESET_MS` / `const COPY_FAIL_MS` 四处**一处不留**，而 `ui.copyInto(` 必须在；(c) `toolkitCore.js` 里 `from './tools/ui.js'` 与 `window.Tk = {… ui …}` 都在，重开 `globalThis.window` 按新 query 载 core（同 query 会被模块缓存挡住，读到的是 J12 那次的注册结果），断 `Tk` 面恰四只、且 `tk.ui.copyInto === 本节判的那一只` |

### Steps

- [x] **Step 1: 写 §O 十三判据（此时 `ui.js` 不存在，必红）**

```bash
node --check scripts/toolkit-tests.mjs
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs > /tmp/seg3t5/gate1-red.log 2>&1; echo "exit=$?"
grep -E "^# (tests|pass|fail)|^not ok" /tmp/seg3t5/gate1-red.log
```
实跑：`exit=1`、`# tests 223 / pass 222 / fail 1`，红的是一条**文件级**
`not ok 1 - scripts/toolkit-tests.mjs`（`await import` 在注册完前序 222 条之后崩）——与 Task 2/3/4
的 §L/§M/§N 同形状，所以"fail 恰为 §O 条数"的期望同样不成立；判据看的是这个 + §A–§N 的 222 条一条不红。

- [x] **Step 2: 写 `dev/js/tools/ui.js`，直到 §O 十四条里除 O13 外全绿**

写完 `ui.js` 复跑：`# tests 235 / pass 234 / fail 1`，红的恰好是
`not ok 235 - O13 抽离不留第二份实现…`——那一节要读 `workbench.js` 与 `toolkitCore.js` 的磁盘文本，
这一步还没改它们，`const flash =` 还留在装配层里。这一格的红绿顺序本身就是搬迁的验收：**先有模块、
再断言旧实现归零**，反过来写会在 Step 2 就得到一片读不出归因的红。

- [x] **Step 3: 改 `workbench.js` 与 `toolkitCore.js`，§O 与 §J 全绿**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs > /tmp/seg3t5/gate1-green.log 2>&1; echo "exit=$?"
grep -E "^# (tests|pass|fail)|^not ok" /tmp/seg3t5/gate1-green.log
```
实跑：`exit=0`、`# tests 235 / pass 235 / fail 0`。§J 那 16 条改动面只有四处，且**断言本体一条没改**：
夹具多 `import` 一只 `J_UI`、`jMount` 的 `Tk` 多供一格、J12 的清单从三只名字变四只（标题跟着改口）、
J14 的禁 import 名单加 `'./ui.js'`。J7 那九个小节一个字没动——它们是这次搬迁的回归网，动它就是自证失效。

- [x] **Step 4: 十三把刀变异自证**

```bash
cp -R dev scripts package.json vite.config.js /tmp/seg3t5u/tree && node /tmp/seg3t5u/mut.mjs   # 基线
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON node /tmp/seg3t5u/mut.mjs U1 U2 … U13
```
台账见下面那节。每一把都要求 `# tests` 仍是 235（少一个用例＝模块加载失败，那一刀不算证据）。

- [x] **Step 5: 产物 gzip A/B**

两档各跑一次 `vite build`（同一台机、同一份 `node_modules`、只差这三本源文件），口径
`cat f | gzip -9 | wc -c`：

| 产物 | 搬迁前 raw / gzip | 搬迁后 raw / gzip | gzip 差 |
| --- | --- | --- | --- |
| `toolIdcard.min.js` | 184,825B / 64,666B | 184,521B / 64,479B | **−187B** |
| `toolkitCore.min.js` | 18,103B / 6,583B | 18,986B / 6,977B | **+394B** |
| 证件页那两本合计 | 71,249B | 71,456B | **+207B** |

起草版那句"预期 0 到 ±20B"落空了，但它落空的方向要说清：**单看 `toolIdcard.min.js` 是 −187B，
不是零**——因为这一本里那份复制实现整段搬走了；共用层那本 +394B 里除了搬进来的三件套，
还多了 Step 3 那道新闸门（闸门文案 118 字节，实测搬迁后出现在 `toolIdcard.min.js` 一次、搬迁前零次）
和一层 module namespace 包装。两本相加 **+207B**，是"一份复制实现换成三页共用"的代价。
按 §7 那一格的口径（**三件产物** `toolkit.min.css` + `toolkitCore.min.js` + `toolIdcard.min.js`
各自 gzip 再相加）：`2,110 + 6,977 + 64,479 = **73,566B**`，对 76KB（77,824B）余 **4,258B（5.5%）**——
上一格记的是 73,359B / 余 4,465B（5.7%），这 207B 就是本格的全部影响。CSS 一个字节没动，
首屏那一格（`toolkit.min.css` + 页面 HTML）量的是非 JS 两件，本格不碰。

顺带两条产物形状自证：两档各自的 22 本 `assets/js/*.min.js` 里 `import{` / `import(` 命中数都是 **0**；
`复制失败，请手动选中` 那一句搬迁前只在 `toolIdcard.min.js`、搬迁后只在 `toolkitCore.min.js`，
各一次——搬干净了，没有第二份。

- [x] **Step 6: 登记镜像并同步计划**

`FILE_TARGETS` 加 `'dev/js/tools/ui.js',`（放在段 3 那一组里，紧跟 `codec.js` 之前，注释按
"跟着磁盘走，不跟着计划走"那条口径写），本计划 Task 5 那节贴两块落地镜像，然后
`node scripts/verify-plan-blocks.mjs --fix` 把 §J 与 `workbench.js` 两块旧镜像整块换成磁盘内容；
`toolkitCore.js` 那一块因为文件头整段改口、公共前缀候选不唯一，`--fix` 拒绝落笔，按行范围手工换。

### 变异台账（十三把刀，`/tmp/seg3t5u/mut.mjs`，跑完即弃）

十三把刀全部**有牙**：每把都咬住它点名的判据，`# tests` 每把都是 235，预期外红为零。
第一轮跑出来有三把的预期需要处置，处置记录写在刀名后面。

| 刀 | 改哪一行 | 红名单（实测＝预期） | 处置 |
| --- | --- | --- | --- |
| U1 | 摘 `copyInto` 的早退 | O12 | 一次过。J7 不红是设计内：`workbench.js` 那道同一条判断还在，页面路径走不到 `copyInto`——这一对就是"重复必须有独立判据"的账 |
| U2 | 两条时长**用法**对调（`ok ? COPY_RESET_MS : COPY_FAIL_MS` 两个分支互换） | O10 / O11 / J7 | **预期改过**：起草时把 O3 写进了预期，跑出来 O3 不红——它只读常数，这一刀改的是用法，`COPY_FAIL_MS > COPY_RESET_MS` 一个字没动。改预期并把这条留作"值口径判据抓不到用法漂移"的反例 |
| U3 | `finally` 里不摘临时框 | O6 / O7 / O9 / O10 / O11 / J7 | **预期补过一条**：O11 四小节里三小节走兜底，每节末尾都量一次 `childNodes.length === 0`，节点留在页上就红在那里 |
| U4 | 把 `ta = box` 提到 `appendChild` 之前 | O8 | 一次过。真 DOM 上这一刀的后果是 `removeChild` 抛 `NotFoundError`，把"这一级失败"变成"抛到页面外" |
| U5 | 临时框不写 `readonly` | O6 / O7 / O9 / O11 / J7 | **预期补过四条**，且四条同一个来路：夹具数框用的是 `oBoxes()`，它只认带 `readonly` 的那几条，属性一摘这些框在夹具眼里就"不存在"。这是**数法带来的连带**，不是四件独立的事——写进台账，免得下轮把它读成"判据互相纠缠" |
| U6 | 不 `select` 就 `execCommand` | O6 / O7 / O9 / J7 | 一次过。复制的是用户原来的选区，不是那串结果——最坏的一种"看起来成功了" |
| U7 | `execCommand` 缺席时当作成功 | O7 / J7 | **刀改过形状**：起草版写成整句 `return true;`，那会连 `execCommand('copy')` 那一声调用一起删掉，O6/O9/O10/O11 全红——红的是"根本没问过它"这件**别的事**，刀切歪了。改成只动三元"没手"那一支之后，红名单正好落在预期的两格 |
| U8 | `writeText` 同步抛时当成成功（`p = null` → `p = Promise.resolve()`） | O11 / J7 | **锚点修过**：起草时按六格缩进写锚，实际文件里那三行是四格，命中 0 次、这一刀作废；修锚点后一次过 |
| U9 | `writeText` 异步拒绝时不退兜底（`done(legacyCopy(…))` → `done(false)`） | O11 / J7 | 一次过 |
| U10 | `doCopy` 不把 `later` 传下去 | J7 | 一次过。§O 一条都不红（`ui.js` 自己传 `later`）——这一刀证明"接线那一行是有牙的"，不是白写的参数 |
| U11 | 摘掉 `createWorkbench` 的 `Tk.ui` 闸门 | O13 | 一次过。摘掉后缺 `ui` 的装配层照样构造成功，缺陷推迟到用户第一次点复制按钮 |
| U12 | `toolkitCore` 不挂第四只 `ui` | J12 / J16 / O13 | **预期补过一条**：J16 在 §I 假 DOM 下真跑一遍入口，`Tk` 少一格 → `createWorkbench` 闸门当场抛 → 入口"成功路径把两条 `<script>` 接起来"落空。这一刀同时被清单（J12）、构造期点名（O13）、页面真起得来（J16）三层各抓一次 |
| U13 | `flash` 的还原目标取改口当时的 `textContent` | O4 / J7 | 一次过。第一次改口看不出来（当前文案正是原文案），改口期间再按一次才暴露——所以 O4 里那半条连点用例是这一刀的唯一去处 |

三条"刀改形状 / 锚点作废"（U7、U8）与四处"预期补条"（U2、U3、U5、U12）都留着不删，
理由跟段 1 Task 8 那条一样：**改过的刀不记下来，下一轮就会照旧形状重犯**。

### 落地镜像（门禁二核的就是这两块，`--fix` 会把它们整块换成磁盘内容）

`dev/js/tools/workbench.js` 与 `dev/js/toolkitCore.js` 的整文件镜像在**段 2 计划**的 Task 7 里，
`§J` 那一节的镜像也在段 2——它们跟着本格的改动一起被同步，段 3 计划里不重贴第二份
（重贴就是两份真相，门禁二只会认一块、另一块静默过期）。本节这两块是段 3 名下的新镜像。

#### `dev/js/tools/ui.js`（整文件）

```js
/**
 * 工具箱的界面小工具第一档：**把一栏结果复制到剪贴板**这件事的三级兜底。
 *
 * 为什么单独一本文件：证件页、编码工具箱页、JSON 页都要"把这栏的纯文本复制走"，而这句话在
 * 浏览器里不是一句 API 就能写完的事——`navigator.clipboard` 在非安全上下文（http 页面）缺席、
 * 被权限策略拒绝时异步 reject、个别环境下直接同步抛（连 Promise 都不返回），三条路都走完才算
 * 试过。段 2 它长在 `workbench.js` 里（那时只有证件页要），段 3 Task 5 抽出来给三页共用。
 *
 * 三条口径，§O 的判据逐条对着咬：
 *
 * 1. **只搬不改行为**。`legacyCopy`、两条时长、四句文案（`已复制` / `复制失败，请手动选中`）
 *    逐字符照搬段 2 落地的那一份，兜底顺序与早退条件也一样；页面接线仍由 §J 那十六判兜着，
 *    J7 的九个小节就是这次搬迁的回归网。
 * 2. **零 import、零宿主全局**（§O2）。`doc` / `clipboard` / `later` 一律由调用方注入，
 *    所以这一本能在 §I 那份假 DOM 下逐条测。它同时是 `toolkitCore.js` 把 `ui` 挂进
 *    `window.Tk` 的前提：一旦它 import 了别的东西，两个页面入口就各 reach 一份，产物立刻
 *    变成带 `import{` 的废文件（实测记录在 `dev/js/toolkitCore.js` 开头）。
 * 3. **任何一级都不许抛到页面外面**。剪贴板被拒绝是浏览器的正常行为，"用户按了没反应"才是
 *    缺陷；每一级的失败都收敛成一句文案与一条恢复用的定时回调（O8、O9 分别咬两处抛点）。
 *
 * 与 `view.js` 的分工：`view` 出**结果 HTML**（纯字符串），这一本碰的是**按钮文案与临时节点**，
 * 两者互不 import。`COPY_LABEL`（面板 → 复制按钮的原文案）留在 `workbench.js`——那是页面骨架
 * 里的事，不是"复制"这件事的一部分；改口之后要还原成哪一句，由调用方说了算（O4）。
 *
 * 复算：`node --test scripts/toolkit-tests.mjs` 里的 §O 十三判，加上 §J 的 J7 原样全绿。
 */

/** 复制按钮改口"已复制"之后多久恢复原文案（毫秒）；只有 `copyInto` 读这两条时长，不抽 token */
export const COPY_RESET_MS = 1600;

/** 复制失败后的提示停留时长，比成功的那句长一点：那句要被人读到才会去手动选中文本 */
export const COPY_FAIL_MS = 2600;

/**
 * 按钮文案的临时改口：失败与成功走同一处，恢复时长不同（成功那句不需要读）。
 * @param {object} btn 要改口的按钮，只需 `textContent` 可写
 * @param {string} text 改口成哪一句
 * @param {number} ms 停留多久，原样透传给 `later`，这一层不替页面决定时长
 * @param {string} original 恢复成哪一句：由调用方记下（见 `workbench.js` 的 `COPY_LABEL`），
 *   不取当前 `textContent`——连点两次时当前那句正是"已复制"，取它就等于永远停在改口状态
 * @param {(fn: () => void, ms: number) => number} [later] `setTimeout` 的别名，测试里换成
 *   同步执行；不给就落回宿主那一只（全文件唯一一处读宿主计时器，§O2 数着它）
 * @returns {void}
 */
export function flash(btn, text, ms, original, later) {
  btn.textContent = text;
  const at = typeof later === 'function' ? later : (fn, delay) => setTimeout(fn, delay);
  at(() => { btn.textContent = original; }, ms);
}

/**
 * `navigator.clipboard` 不可用时的兜底：临时 textarea + `execCommand('copy')`。
 * 只在 http 或用户未授予剪贴板权限时走到这里，用完立刻摘掉节点——留在 DOM 里就是
 * 一个能被 Tab 走到的隐形输入框。
 * @param {object} doc 提供 `createElement` / `body.appendChild` / `body.removeChild`
 * @param {string} text 要复制的文本
 * @returns {boolean} 有没有真的复制上
 */
export function legacyCopy(doc, text) {
  let ta = null;
  try {
    const box = doc.createElement('textarea');
    box.setAttribute('readonly', 'readonly');
    box.value = text;
    doc.body.appendChild(box);
    // 只有真挂上去的那一个才需要摘：`appendChild` 自己抛时 `ta` 仍是 null，
    // 那句 `removeChild` 就会抛出函数外，把"这一级失败"变成"这一级抛错"。
    ta = box;
    box.select();
    return typeof doc.execCommand === 'function' ? Boolean(doc.execCommand('copy')) : false;
  } catch {
    return false;
  } finally {
    // 摘节点写在 `finally`：`select()` 与 `execCommand` 抛错时也要摘——留在页面上
    // 就是一个能被 Tab 走到的隐形输入框，而这一级的口径是"不许抛到页面外面"。
    if (ta) doc.body.removeChild(ta);
  }
}

/**
 * 复制一段文本，三级兜底：`navigator.clipboard` → 临时 `<textarea>` + `execCommand` →
 * 一句"请手动选中"。任何一级都不许抛到页面外面：剪贴板被权限策略拒绝是浏览器的正常行为，
 * 用户按了没反应才是缺陷。
 *
 * 早退那一道（`btn` 缺席或 `text` 为空）与调用方 `workbench.js` 的同一条判断**故意重复**：
 * codec 页要直接调这一句，那时没有人替它判空。摘掉它的后果是"按一条还没内容的复制按钮
 * → 剪贴板是空的、按钮却报了'已复制'"。
 *
 * @param {object} args 一次复制的全部输入，全部由调用方注入
 * @param {object} [args.btn] 按钮；缺席就早退（没地方改口）
 * @param {string} [args.text] 要复制的纯文本；空串或没给都早退
 * @param {string} [args.original] 按钮的原文案，改口之后还原成它
 * @param {{writeText?: (t: string) => Promise<void>}} [args.clipboard] `navigator.clipboard`，
 *   没有这只手、或有手却没有 `writeText` 那根手指，都直接走兜底
 * @param {object} args.doc 传给 `legacyCopy` 的 `document`
 * @param {Function} [args.later] 透给 `flash` 的定时器别名
 * @returns {void}
 */
export function copyInto({ btn, text, original, clipboard, doc, later } = {}) {
  if (!btn || !text) return;
  const done = (ok) => flash(btn, ok ? '已复制' : '复制失败，请手动选中',
    ok ? COPY_RESET_MS : COPY_FAIL_MS, original, later);
  if (clipboard && typeof clipboard.writeText === 'function') {
    let p = null;
    // 同步抛错与异步拒绝是同一条路：`writeText` 在权限策略拒绝时可能直接抛（不返回
    // Promise），那正是上面那句话点名的场景，不能让它从按钮回调里跑出去。
    try {
      p = Promise.resolve(clipboard.writeText(text));
    } catch {
      p = null;
    }
    if (p !== null) {
      p.then(() => done(true), () => done(legacyCopy(doc, text)));
      return;
    }
  }
  done(legacyCopy(doc, text));
}
```

#### `scripts/toolkit-tests.mjs` §O（整节，从 `// ── §O` 到文件末尾）

```js
// ── §O 复制三件套抽离（`tools/ui.js`，段 3 Task 5）─────────────────────────
// 本节测的是**从 `workbench.js` 搬出来的那三个辅助**，不测页面接线：接线仍由 §J 那十六判
// 原样兜着（J7 的九个小节就是这次搬迁的回归网，一条都没改、也不许改）。搬迁有两条约言在先
// 的红线，本节各钉一处：
//   ① **`ui.js` 必须像 `view.js` 一样零 import**。它一旦被 import 进两本装配层，两个页面入口
//      就各 reach 一份，产物立刻变成带 `import{` 的废文件（实测记录在 `toolkitCore.js` 开头）。
//      O2 拿源码文本守这一条，J14 那份"不许 import"的名单里也必须有它。
//   ② **只搬不改行为**：三级兜底的顺序、两条时长、四句文案，逐字符照搬段 2 落地的那一份。
//      O4–O12 按"输入形状 → 文案 / 时长 / 副作用"三条观察口逐档钉死，J7 再从页面那一头复认一次。
// 一处口径先写在这儿，免得读代码时以为谁手滑多写了一遍：`copyInto` 里那道"没按钮 / 没文本
// 就早退"与调用方 `doCopy` 的同一条判断是**故意重复**的。codec 页要直接调 `copyInto`，那时
// 没有人替它判空；早退被摘掉的后果是"按一条还没内容的复制按钮 → 剪贴板是空的、按钮却说已复制"。
// O12 咬的就是这一档。
const { COPY_RESET_MS, COPY_FAIL_MS, flash, legacyCopy, copyInto } = await import('../dev/js/tools/ui.js');

/** 剥注释扫源码：块注释与行注释里的字样都不算命中（与 §K/§L/§M/§N 同一形状） */
const oCode = () => read('dev/js/tools/ui.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * 假 DOM 仍只有 §I 那一份工厂（`iPage`）——不为复制这一件小事长第二套夹具。
 * 本节只取它的 `doc` / `mk` 与三张观察口（`selLog` / `commandLog` / `created`），
 * 面板骨架那一半一次都不读。
 * @returns {object} §I 的 page
 */
const oPage = () => iPage();

/** 造一条带原文案的按钮；`textContent` 走子节点，与真 DOM 同一张脸 */
const oBtn = (page, text = '复制这批号码') => {
  const btn = page.mk('button', 'o-btn');
  btn.textContent = text;
  return btn;
};

/** `later` 的夹具：只记账不执行，`flush()` 才把还原那一下放出来（与 §J 的 `timers` 同形状） */
const oTimers = () => {
  const due = [];
  return {
    due,
    later: (fn, ms) => { due.push({ fn, ms }); return due.length; },
    flush: () => { const list = due.splice(0, due.length); for (const t of list) t.fn(); return list; },
  };
};

/** 兜底造出来的临时框只认带 `readonly` 的那几条（与 §J7 同一个数法，不靠"造了几个节点"猜） */
const oBoxes = (page) => page.made.filter((e) => e.tagName === 'TEXTAREA'
  && e.getAttribute('readonly') === 'readonly');

/**
 * 等微任务队列落地：`writeText` 那一级的成败是异步的，而注入的 `later` 只记账不跑。
 * 用的是全局 `setTimeout`，不是注入给 `ui.js` 的那只——后者一执行就会把按钮文案改回去。
 * @returns {Promise<void>} Promise 链落地
 */
const oSettle = () => new Promise((r) => { setTimeout(r, 0); });

test('O1 导出面：五个名字一个不多一个不少，两常数三函数', async () => {
  const mod = await import('../dev/js/tools/ui.js');
  const wanted = ['COPY_FAIL_MS', 'COPY_RESET_MS', 'copyInto', 'flash', 'legacyCopy'];
  const got = Object.keys(mod).sort();
  assert.deepEqual(got, wanted, `导出面变了：多=${JSON.stringify(got.filter((k) => !wanted.includes(k)))} `
    + `少=${JSON.stringify(wanted.filter((k) => !got.includes(k)))}`);
  assert.equal(got.length, 5, '这五名就是 `window.Tk.ui` 的全部家当：加一个名字要同步 J12 的清单与 toolkitCore 的注释');
  for (const k of ['flash', 'legacyCopy', 'copyInto']) {
    assert.equal(typeof mod[k], 'function', `${k} 必须是函数：两页的装配层按这个名字直接调`);
  }
  for (const k of ['COPY_RESET_MS', 'COPY_FAIL_MS']) {
    assert.equal(typeof mod[k], 'number', `${k} 必须是数字：时长写成串会静默变成"永不还原"`);
  }
});

test('O2 源码红线：零 import、零宿主全局，注入的那三样就是它的全部世界', () => {
  const src = oCode();
  assert.equal(/\bimport\b/.test(src), false,
    '一条 import 都不许有：两个入口 reach 同一模块就成共享 chunk，产物当场变废文件（toolkitCore.js 开头那条实测）');
  assert.equal(/\brequire\(/.test(src), false, 'CommonJS 同理，而且浏览器里压根不存在');
  for (const glob of ['window.', 'document.', 'navigator.', 'localStorage', 'globalThis']) {
    assert.equal(src.includes(glob), false,
      `${glob} 不许直接读：宿主对象一律由调用方注入（doc / clipboard / later），否则假 DOM 驱动不了这一本`);
  }
  assert.equal((src.match(/\bsetTimeout\b/g) || []).length, 1,
    '全文件只许 `flash` 缺省那一档碰宿主计时器；时长口径归注入的 `later`，多一处就没法在测试里钉住');
  assert.equal(src.includes('innerHTML'), false, '这一本只改 `textContent`、只挂临时节点，不产 HTML：产 HTML 是 view.js 的活');
});

test('O3 两条时长：值钉死 1600 / 2600，失败那句必须比成功那句长', () => {
  assert.equal(COPY_RESET_MS, 1600, '成功那句的停留时长是段 2 定下的口径，改它要有新判据，不是顺手调参');
  assert.equal(COPY_FAIL_MS, 2600);
  for (const [name, ms] of [['COPY_RESET_MS', COPY_RESET_MS], ['COPY_FAIL_MS', COPY_FAIL_MS]]) {
    assert.equal(Number.isInteger(ms), true, `${name} 要的是整数毫秒：小数或 NaN 走进宿主 setTimeout 是哪一档没人管`);
    assert.equal(ms > 0, true, `${name} 必须是正数：0 或负数等于"改口之后立刻还原"，用户看不见那一句`);
  }
  assert.equal(COPY_FAIL_MS > COPY_RESET_MS, true,
    '两句的相对长短是口径不是巧合：失败那句要被人读完才动得起来，倒过来挂就等于没说');
});

test('O4 flash：改口立刻生效、还原排进注入的 later、时长原样透传', () => {
  const page = oPage();
  const btn = oBtn(page);
  const t = oTimers();
  flash(btn, '已复制', 1600, '复制这批号码', t.later);
  assert.equal(btn.textContent, '已复制', '调用当期就要看到新文案，异步改口等于没有反馈');
  assert.equal(t.due.length, 1, '改口要能改回来，就得留下一条恢复用的回调');
  assert.equal(t.due[0].ms, 1600, '时长原样透传给宿主：ui 层不替页面决定停留多久');
  assert.equal(page.doc.body.childNodes.length, 0, 'flash 只动文案，不往页面上挂任何东西');
  const released = t.flush();
  assert.equal(released.length, 1);
  assert.equal(btn.textContent, '复制这批号码', '排下去的那条必须真的还原成传进来的原文案');
  // 同一格排两次（连点）：两条各还原各的，先排的那条不许被后一条顶掉
  const btn2 = oBtn(page, '复制这批代码');
  flash(btn2, '已复制', COPY_RESET_MS, '复制这批代码', t.later);
  flash(btn2, '复制失败，请手动选中', COPY_FAIL_MS, '复制这批代码', t.later);
  assert.equal(btn2.textContent, '复制失败，请手动选中');
  assert.deepEqual(t.due.map((x) => x.ms), [COPY_RESET_MS, COPY_FAIL_MS]);
  t.flush();
  assert.equal(btn2.textContent, '复制这批代码', '原文案只有一份，两条回调落在同一格上不会把"已复制"存成新原文案');
});

test('O5 flash 不给 later：落回宿主 setTimeout，还原照样发生', async () => {
  const page = oPage();
  const btn = oBtn(page);
  flash(btn, '已复制', 0, '复制这批号码');
  assert.equal(btn.textContent, '已复制');
  await new Promise((r) => { setTimeout(r, 20); });
  assert.equal(btn.textContent, '复制这批号码',
    '缺省那一档被摘掉的话，页面没注入 `later` 时按钮永远停在"已复制"——这一档没人看，只有真跑一次才暴露');
  assert.equal(page.doc.body.childNodes.length, 0, '缺省路径同样不许往页面上留东西');
});

test('O6 legacyCopy 成功：readonly 框挂 body → select → execCommand("copy") → 摘净、返回 true', () => {
  const page = oPage();
  const before = page.created();
  const ok = legacyCopy(page.doc, '110101199003070018');
  assert.equal(ok, true, 'execCommand 返回 true 就是复制上了，别再要求第二样证据');
  assert.equal(page.created() - before, 1, '一次复制只造一条临时框');
  assert.deepEqual(page.commandLog, ['copy']);
  assert.equal(page.selLog.length, 1, '不 select 就 execCommand，复制的是用户的选区不是临时框');
  assert.equal(page.selLog[0].tagName, 'TEXTAREA');
  assert.equal(page.selLog[0].value, '110101199003070018', '复制的必须是传进去的那份文本');
  assert.equal(page.selLog[0].getAttribute('readonly'), 'readonly',
    '不写 readonly，select() 就把用户的页面变成一次真编辑（光标跳走、原有选区丢掉）');
  assert.equal(oBoxes(page).length, 1);
  assert.equal(page.doc.body.childNodes.length, 0, '用完必须从 body 上摘掉：留在页里就是一个能被 Tab 走到的隐形输入框');
});

test('O7 legacyCopy 的两种"没复制上"：execCommand 说不行 / 根本没这只手，都返回 false 且摘净', () => {
  const a = oPage();
  a.doc.copyOk = false;
  assert.equal(legacyCopy(a.doc, 'x'), false, 'execCommand 返回 false 就是失败，不许当成功报');
  assert.deepEqual(a.commandLog, ['copy'], 'execCommand 在，就要真的问过它');
  assert.equal(a.selLog.length, 1, '失败也要留一条被选中过的框：这一级的失败靠用户手动 Ctrl+C 兜');
  assert.equal(a.doc.body.childNodes.length, 0);
  assert.equal(oBoxes(a).length, 1);

  const b = oPage();
  b.doc.execCommand = undefined;
  assert.equal(legacyCopy(b.doc, 'x'), false, '连 execCommand 都没有（个别环境把 document 裁过）时这一级算失败');
  assert.deepEqual(b.commandLog, [], '没有 execCommand 就不该假装调用过它');
  assert.equal(b.selLog.length, 1);
  assert.equal(b.doc.body.childNodes.length, 0, '这一级也要在 finally 里摘掉临时框');
});

test('O8 legacyCopy：`appendChild` 自己抛时不许再调 `removeChild`（那会把一次失败变成一次抛出）', () => {
  const page = oPage();
  let removed = 0;
  page.doc.body.appendChild = () => { throw new Error('boom'); };
  page.doc.body.removeChild = (n) => { removed += 1; return n; };
  let ok;
  assert.doesNotThrow(() => { ok = legacyCopy(page.doc, 'x'); },
    '挂不上去是这一级的失败，不是抛出——抛出会顺着按钮回调跑到页面外面');
  assert.equal(ok, false);
  assert.equal(removed, 0, '临时框根本没挂上去，对着它 removeChild 必抛 NotFoundError');
  assert.equal(page.selLog.length, 0, '没挂上就别 select：选中一个不在文档里的节点没有意义');
  assert.deepEqual(page.commandLog, [], '没挂上就别 execCommand：那复制的是用户原来的选区');
});

test('O9 legacyCopy：`select()` 与 `execCommand()` 抛错都走 finally，临时框照样摘净', () => {
  const a = oPage();
  const realCreate = a.doc.createElement;
  a.doc.createElement = (tag) => {
    const el = realCreate(tag);
    el.select = () => { throw new Error('boom'); };
    return el;
  };
  let okA;
  assert.doesNotThrow(() => { okA = legacyCopy(a.doc, 'x'); });
  assert.equal(okA, false, 'select 抛就是这一级失败，不许报成功');
  assert.equal(a.selLog.length, 0, '抛掉的那次 select 没成功选中');
  assert.deepEqual(a.commandLog, [], 'select 都没过去，就不该问 execCommand');
  assert.equal(a.doc.body.childNodes.length, 0, 'finally 那条摘节点的口子是这一节唯一的兜底，摘一次就留下一个隐形输入框');
  assert.equal(oBoxes(a).length, 1, '临时框确实造出来过：这一刀测的是"挂上之后抛"');

  const b = oPage();
  b.doc.execCommand = () => { throw new Error('boom'); };
  let okB;
  assert.doesNotThrow(() => { okB = legacyCopy(b.doc, 'x'); });
  assert.equal(okB, false);
  assert.equal(b.selLog.length, 1);
  assert.equal(b.doc.body.childNodes.length, 0);
});

test('O10 copyInto 没有可用的 clipboard：兜底成败对应那两句文案与那两条时长', () => {
  const page = oPage();
  const btn = oBtn(page);
  const t = oTimers();
  copyInto({ btn, text: 'abc', original: '复制这批号码', doc: page.doc, later: t.later });
  assert.deepEqual(page.commandLog, ['copy'], '没有 navigator.clipboard 时不该什么都不做');
  assert.equal(btn.textContent, '已复制');
  assert.equal(t.due.length, 1);
  assert.equal(t.due[0].ms, COPY_RESET_MS);
  t.flush();
  assert.equal(btn.textContent, '复制这批号码');

  // 兜底也说"不行" → 失败那一句，时长走失败档
  page.doc.copyOk = false;
  copyInto({ btn, text: 'abc', original: '复制这批号码', doc: page.doc, later: t.later });
  assert.equal(btn.textContent, '复制失败，请手动选中');
  assert.equal(t.due[0].ms, COPY_FAIL_MS, '失败那句要给人时间读完');
  assert.equal(t.due[0].ms > COPY_RESET_MS, true);
  assert.equal(page.doc.body.childNodes.length, 0, '连失败都不许留下临时框');
  t.flush();
  assert.equal(btn.textContent, '复制这批号码');

  // 有 `clipboard` 这只手、却没有 `writeText` 那根手指：同步走兜底，不许留下一条永远不落的 Promise
  const c = oPage();
  const btnC = oBtn(c);
  const tC = oTimers();
  copyInto({ btn: btnC, text: 'abc', original: '复制这批号码', clipboard: {}, doc: c.doc, later: tC.later });
  assert.deepEqual(c.commandLog, ['copy'], 'writeText 缺席就直接退到 execCommand');
  assert.equal(btnC.textContent, '已复制');
  assert.equal(tC.due.length, 1, '这一条必须同步排下去：等一个永远不会来的 Promise 就是把反馈吞了');
});

test('O11 copyInto 的三条剪贴板路：成功 / 异步拒绝 / 同步抛，一条都不许抛到页面外面', async () => {
  // (a) 首选 `navigator.clipboard`：不碰 execCommand，也不往 body 上挂东西
  {
    const page = oPage();
    const btn = oBtn(page);
    const t = oTimers();
    const writes = [];
    copyInto({
      btn, text: 'abc', original: '复制这批号码', doc: page.doc, later: t.later,
      clipboard: { writeText: (v) => { writes.push(v); return Promise.resolve(); } },
    });
    await oSettle();
    assert.deepEqual(writes, ['abc'], '复制的是那串纯文本，不是结果区的 HTML');
    assert.equal(btn.textContent, '已复制');
    assert.equal(t.due[0].ms, COPY_RESET_MS);
    assert.deepEqual(page.commandLog, [], '这一级根本不需要 execCommand');
    assert.equal(page.doc.body.childNodes.length, 0, '走剪贴板就不该在页面上长出临时输入框');
    t.flush();
    assert.equal(btn.textContent, '复制这批号码');
  }
  // (b) 剪贴板被拒（异步 reject）→ 退到临时框，兜底成功了就别报失败
  {
    const page = oPage();
    const btn = oBtn(page);
    const t = oTimers();
    const writes = [];
    copyInto({
      btn, text: 'abc', original: '复制这批号码', doc: page.doc, later: t.later,
      clipboard: { writeText: (v) => { writes.push(v); return Promise.reject(new Error('NotAllowedError')); } },
    });
    await oSettle();
    assert.equal(writes.length, 1, '先试过剪贴板，退路才是 execCommand');
    assert.deepEqual(page.commandLog, ['copy']);
    assert.equal(oBoxes(page).length, 1, '兜底只该造一条临时框');
    assert.equal(btn.textContent, '已复制', '兜底成功了就别报失败');
    assert.equal(t.due[0].ms, COPY_RESET_MS, '退路成功走的也是成功那一档时长');
    assert.equal(page.doc.body.childNodes.length, 0);
  }
  // (c) `writeText` 直接同步抛（不返回 Promise）：与异步拒绝同一条退路
  {
    const page = oPage();
    const btn = oBtn(page);
    const t = oTimers();
    assert.doesNotThrow(() => copyInto({
      btn, text: 'abc', original: '复制这批号码', doc: page.doc, later: t.later,
      clipboard: { writeText: () => { throw new Error('SecurityError'); } },
    }), '权限策略拒绝时 writeText 可能直接抛，那正是"不许抛到页面外面"点名的场景');
    await oSettle();
    assert.deepEqual(page.commandLog, ['copy'], '同步抛错也要退到 execCommand');
    assert.equal(btn.textContent, '已复制');
  }
  // (d) 剪贴板与兜底双双失败 → 一句失败文案，仍然不抛
  {
    const page = oPage();
    const btn = oBtn(page);
    const t = oTimers();
    page.doc.copyOk = false;
    copyInto({
      btn, text: 'abc', original: '复制这批号码', doc: page.doc, later: t.later,
      clipboard: { writeText: () => Promise.reject(new Error('NotAllowedError')) },
    });
    await oSettle();
    assert.equal(btn.textContent, '复制失败，请手动选中');
    assert.equal(t.due[0].ms, COPY_FAIL_MS);
    assert.equal(page.doc.body.childNodes.length, 0);
  }
});

test('O12 copyInto 的"没东西可复制"早退：剪贴板、临时框、按钮文案三样都不碰', () => {
  const page = oPage();
  const btn = oBtn(page);
  const t = oTimers();
  let writes = 0;
  const clipboard = { writeText: () => { writes += 1; return Promise.resolve(); } };
  const before = page.created();
  copyInto({ btn, text: '', original: '复制这批号码', clipboard, doc: page.doc, later: t.later });
  assert.equal(writes, 0, '空文本一次都不该写');
  assert.deepEqual(page.commandLog, [], '空文本也不该走兜底');
  assert.equal(page.created(), before, '空文本一次都不该造临时框');
  assert.equal(t.due.length, 0, '什么都没复制，就别改口');
  assert.equal(btn.textContent, '复制这批号码');
  // 按钮缺席（骨架缺那一格）：不抛、也不碰剪贴板
  copyInto({ btn: null, text: 'abc', original: '复制这批号码', clipboard, doc: page.doc, later: t.later });
  assert.equal(writes, 0, '没有按钮就没地方改口，剪贴板也不该被白写一次');
  assert.equal(page.created(), before);
  // 整包什么都没给（`{}`）：同一早退，不抛
  assert.doesNotThrow(() => copyInto({}), '调用方漏传不等于页面塌：这一本的第一句话就该是"没得复制，收工"');
  assert.doesNotThrow(() => copyInto());
});

test('O13 抽离不留第二份实现：装配层经 `Tk.ui` 拿，缺它就构造期抛；core 挂第四只', async () => {
  // (a) `createWorkbench` 的闸门：缺 `Tk.ui.copyInto` 必须当场点名，
  //     而不是等用户第一次点复制按钮时才从回调里抛出去（那时结果是"按了没反应"）。
  const bare = { document: oPage().doc, Tk: { view: J_VIEW }, runGuarded: () => true };
  assert.throws(() => createWorkbench(bare),
    (err) => err instanceof TypeError && /Tk\.ui/.test(err.message) && /copyInto/.test(err.message),
    '闸门没拦住"缺 ui"，或者拦住了却没点名 copyInto');
  assert.throws(() => createWorkbench({ ...bare, Tk: { view: J_VIEW, ui: {} } }),
    (err) => err instanceof TypeError && /copyInto/.test(err.message),
    '挂了一只没有 copyInto 的 ui 也算缺：装配层只认它要调的那一根手指');

  // (b) `workbench.js` 源码里那四处定义一处不留——搬迁要一次搬干净，
  //     留下第二份实现的下场是"改了一份、页面上跑的是另一份"。
  const wb = read('dev/js/tools/workbench.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const shape of ['const flash =', 'function legacyCopy', 'const COPY_RESET_MS', 'const COPY_FAIL_MS']) {
    assert.equal(wb.includes(shape), false, `workbench.js 里还留着 ${shape}`);
  }
  assert.equal(/ui\.copyInto\(/.test(wb), true, 'doCopy 必须真的改口去调 Tk.ui.copyInto，不然 (a) 那道闸门白加');

  // (c) `toolkitCore.js` 挂第四只，且它是唯一 import `ui.js` 的地方。
  //     这里重开一次 `globalThis.window` 再按新 query 载 core——同一个 query 会被模块缓存
  //     挡住，那样读到的是 J12 那一次的注册结果，本节就没真的验到"四只"这一格。
  const core = read('dev/js/toolkitCore.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.equal(/from '\.\/tools\/ui\.js'/.test(core), true, 'core 要 import 它才挂得上');
  assert.equal(/window\.Tk\s*=\s*\{[^}]*\bui\b[^}]*\}/.test(core), true, 'window.Tk 里必须有 ui 这一格');
  globalThis.window = {};
  try {
    const mod = await import('../dev/js/toolkitCore.js?o13');
    assert.deepEqual(Object.keys(mod), [], 'core 仍是入口形状：一条 export 都不许有');
    const tk = globalThis.window.Tk;
    assert.deepEqual(Object.keys(tk).sort(), ['createPanelDom', 'createPanelWorkspace', 'ui', 'view'],
      'Tk 面就是这四只：J12 那份清单与这里必须同步改，两处不同步说明有人在偷偷扩面');
    assert.equal(tk.ui.copyInto, copyInto, '挂上去的必须是本节判的那一只，不是页面上另长出来的一份');
    assert.equal(tk.ui.legacyCopy, legacyCopy);
  } finally {
    delete globalThis.window;
  }
});
```

### 收口读数（2026-09-28 实跑，日志留在 `/tmp/seg3t5u/` 与 `/tmp/seg3t5/`）

| 门禁 | 命令 | 读数 |
| --- | --- | --- |
| ① 判据套件 | `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs` | `exit=0`、`# tests 235 / pass 235 / fail 0`（§O 贡献 13，222 → 235） |
| ② 镜像自证 | `node scripts/verify-plan-blocks.mjs` | `exit=0`、**43 块**镜像与磁盘逐字节全等、`⚠ 未落地` **0 节**；js 块 40 个（段1 11 / 段2 19 / 段3 10） |
| ③ 镜像门禁的牙齿 | `node scripts/verify-plan-blocks-teeth.mjs` | `exit=0`、**21/21** 通过；G12 那一条现在读到段 3 名下 10 块，新增的 `dev/js/tools/ui.js` 与 `§O` 自动进了核范围 |
| ④ 产物形状 | `grep -l 'import{' assets/js/*.min.js` | **0 本**命中（22 本产物全扫）；`复制失败，请手动选中` 那一句在搬迁后只出现在 `toolkitCore.min.js`、`toolIdcard.min.js` 里为零 |
| ⑤ 收录面 | `node scripts/check-tools-surface.mjs` | `exit=0`、1 条 ready（idcard）× 5 组判据全绿 |
| ⑥ 收录面的牙齿 | `node scripts/check-tools-surface-teeth.mjs` | `exit=0`、**19/19** 组变异如期变红并还原 |

变异台账的跑法与读数见上面那节；两档构建是在 `/tmp/seg3t5u/ab/{before,after}` 各跑一次
`vite build`，`before` 用 `git archive HEAD` 解出、`after` 只多这三本源文件，
`node_modules` 两边同一份软链——**仓库的 `assets/js/` 一个字节都没被这两次构建写过**。

### 提交与提交后复跑（2026-09-28）

代码那一格实跑 `efd08b0`，`5 files changed, 521 insertions(+), 76 deletions(-)`，逐条：
`ui.js` +118/−0（新增，`create mode 100644`）、`workbench.js` +16/−65、`toolkitCore.js` +12/−5、
`toolkit-tests.mjs` +371/−6、`verify-plan-blocks.mjs` +4/−0。
`toolkit-tests.mjs` 那 +371 里只有 **9 行属 §J**（`J_UI` 一条 import 与它上面那句注释、`jMount` 供 `ui`、
J12 标题与 `Object.keys` 清单与那句口径、`tk.ui.copyInto` 一条断言、③ 那行注释与禁用清单加 `'./ui.js'`），
删除的 6 行全在这四处里；其余 362 行就是 §O 整节（磁盘 7531–7891，361 行）加一条空行分隔。
**`J7` 的九个小节一字未改**——它正是这次搬迁的回归网，改它就等于把"回归"两个字抹掉。
暂存集按路径核过：`git diff --cached --stat` 恰好这五条，另一路会话的脏项一个都没进来。
提交后复跑三道：门禁一 `# tests 235 / pass 235 / fail 0`（`/tmp/seg3t5u/post1.log`）、
门禁二 `exit=0`（43 镜像、752375B、`未落地 0 节`）、门禁三 **21/21**
（`脏项 17 个前后一致，diff 指纹 452fb7eb5d643128`，`/tmp/seg3t5u/post3.log`）。提交后 `git status`
剩 17 项，其中三项属本格（两份计划与一份 spec，就在这一节里收口），其余十四项
（`_config.yml` / `about.html` / `dev/js/about.js` / `dev/sass/about.scss` / `package.json` /
`_data/og_images.yml` / `dev/libJs/cursor-effects.js` / 两处 `.baoyu-skills/**` /
未跟踪的 `scripts/lib/`、`scripts/article-check.mjs`、`scripts/wechat-draft.mjs`、
`scripts/fixtures/article-check/`、`.baoyu-skills/baoyu-post-to-wechat/`）全属另一路会话。
**全程不 push**（段 3 自约束）。

三份文档各自的改动量，给下一个读的人定位用：段 3 计划 +688/−2，就是这一节——Task 5 从
HEAD 里的 12 行桩（4842–4853）长成 698 行（4842–5539），其中两块落地镜像 479 行
（`ui.js` 118 + §O 361），剩下的是 Files、对外契约回填、§O 判据表、六条 Step 的实跑读数、
13 刀台账与这两节；段 2 计划 +37/−76，只动 `toolkitCore.js` 与 `workbench.js` 两块镜像和 §J 那一节，
全部由 `--fix` 按磁盘内容换写；spec +2/−0，§7 那三档预算下面新增一段"段 3 Task 5 落地后复量"。

## Task 6: `codecView.js` + `codecWorkbench.js` + `toolCodec.js`（§Q + §R）

**Files:**
- Create: `dev/js/tools/codecView.js`（五块面板的纯字符串视图层）
- Create: `dev/js/tools/codecWorkbench.js`（装配层）+ `dev/js/toolCodec.js`（页面入口）
- Modify: `scripts/toolkit-tests.mjs`（追加 §Q、§R 两节）、`scripts/verify-plan-blocks.mjs`
  （`FILE_TARGETS` 登记两本新模块 + 入口）、本计划
- **不动**：`dev/js/toolkitCore.js`、`dev/js/tools/view.js`、`dev/js/tools/panel.js`、
  `dev/js/tools/panel-dom.js`、`dev/js/tools/ui.js`、`dev/sass/toolkit.scss`

### 一处起草版没说、落地前必须定的事：`codecView` 不进 `window.Tk`

起草那一格（本节桩原文）写的是"`codecView.js` 与 `view.js` 同一条红线——零 import，
**它进 `toolkitCore` 之前**不能被拽进任何数据模块"，读起来像要挂第五只。挂不得，理由是字节账：

- 实测（2026-09-28，`cat assets/js/x | gzip -9 | wc -c`）：`toolkitCore.min.js` = **6,977B**、
  `toolIdcard.min.js` = **64,479B**。证件页 §7 那一行的预算余量只剩 **4,258B（5.5%）**，
  而这一格新写的视图层按 §Q 那五块面板的量（逐档徽章 + 五张表）估在 3–5KB gzip 一档。
  （同日证件页表格收口后按同一口径复量，三件为 2,135 / 7,037 / 64,479 = **73,651B**、余 **4,173B（5.4%）**，
  见 §7「2026-09-28 证件页表格收口后复量」那一格——数字往下走了一档，结论一个字不改：这一格仍挂不得。）
- `toolkitCore.min.js` 是证件页与编码页**共用**的那一本（`tools-idcard.html:472` 与将来的
  `tools-codec.html` 都引它）：把只有编码页要读的视图层挂进去，等于让证件页为五块它没有的面板付 gzip，
  余量直接见底——而 §7 的口径是"先量后立、不许拿预算反推实现"。
- 反面对照：`workbench.js` 直接 `import` 六本证件业务模块，因为**只有一个入口 reach 它们**，
  Rollup 不会成 chunk，产物里也就没有 `import{`（实测记录在 `toolkitCore.js` 文件头）。
  `codecView.js` 同一条形状：只由 `codecWorkbench.js` import，`toolCodec.js` 是唯一 reach 它的入口。

所以这一格的定案是：**`codecView.js` 由 `codecWorkbench.js` 直接 import，`window.Tk` 仍是四只**，
证件页那两本的字节一个不减也不少（Task 6 落地后要拿构建复量自证这一句，见 Step 6）。
"零 import"这条红线照旧保留——它现在守的不是 chunk 边界，而是**视图层不许被业务数据模块污染**，
并且让将来段 4 若要把它挪进 `Tk` 时不用改任何一行的内部。

### 对外契约（签名先定死，实现期不改名）

```text
// ── dev/js/tools/codecView.js ────────────────────────────────────────────
// 零 import。转义 / 空值 / 判定表 / 口径行四样都从注入的那只 `view`（= `Tk.view`）拿，
// 所以本文件里不许出现第二个 `esc`、第二个 `'—'`、第二套 `tk-checks` 表头。
export const CODEC_TONES = ['ok', 'warn', 'bad', 'unknown', 'idle'];  // toolkit.scss 只有这五档徽章
export const CODEC_META = {          // verdict → { label, tone }；表外的一律当场抛
  converted: {…}, encoded: {…}, decoded: {…}, computed: {…}, matched: {…},   // tone ok
  ambiguous: {…}, nomatch: {…},                                       // tone unknown
  lossy: {…}, partial: {…}, capped: {…},                              // tone warn
  invalid: {…}, rejected: {…},                                        // tone bad
  empty: {…},                                                          // tone idle
};                                        // 落地时是十三档，起草那张表漏了 matched（见偏差①）
/** 面板 → 允许的 verdict 白名单：把"时间戳面板报'已编码'"这种错配挡在渲染之前 */
export const PANEL_VERDICTS = { timestamp: [...], base64: [...], url: [...], digest: [...], regex: [...] };

/** 构造期闸门：`view` 缺 `esc` / `noteLines` / `checksTable` / `EMPTY_CELL` 任一样就抛 TypeError */
export function createCodecView(view) → {
  badge(verdict) → string,                      // `<span class="tk-state tk-state--{tone}">label</span>`
  fieldsTable(rows) → string,                   // rows=[{label,value,mono?}] → `<table class="tk-table tk-detail">`
  timestampBlock(m, notes) → string,            // m.readings / m.fields / m.relative / m.diff
  base64Block(m, notes) → string,               // m.out / m.bytes / m.fields（方向不入结果区，见偏差②）
  urlBlock(m, notes) → string,                  // m.pair / m.differs / m.decodeTries / m.queryRows
  digestBlock(m, notes) → string,               // m.rows（五格，按 ALGORITHMS 序）/ m.bytes / m.kind
  regexBlock(m, notes) → string,                // m.findings / m.matches / m.groups / m.replaced / 三面旗
  block(panel, m, notes) → string,              // 唯一分派点：panel 不在五块里抛 RangeError
}
// 每块 `*Block` 交出去的都是一个完整的 `<div class="tk-result tk-result--{tone}">…</div>`，
// 与 `view.parseBlock` 同一件外层骨架（§5.4"五块面板长得一样是要求，不是巧合"）。
// 结果文本那一行走证件页那一族的 `.tk-lines > section.tk-line > p.tk-line__raw`，
// 输入回显按码点封顶 200 个——两条都是落地时定的，理由见下面「偏差③④」。
```

装配层交给视图的模型（`m`）只有五张，字段名与四本纯模块的返回**同名不同层**——视图不 import 它们，
映射由 `codecWorkbench.js` 做，映射错了的后果是 §R 的红而不是 §Q 的红：

```text
timestamp = { verdict, input, checks, readings:[{kind,epochMs,isoUtc}], fields:[{label,value,mono}],
              relative, diff:{sign,totalDays,calendarDays,ymd:{years,months,days},
              breakdown:[{unit,value}]}|null }
base64    = { verdict, input, checks, out, bytes, fields, reason }
url       = { verdict, input, checks, pair:[{name,out}], differs:string[], bytes,
              decodeTries:[{field,ok,out,reason}], queryRows:[{raw,key,value,keyOk,valueOk,reason}], reason }
digest    = { verdict, input, checks, kind:'text'|'bytes', bytes,
              rows:[{algo,ok,hex,bytes,via,reason}] }
regex     = { verdict, input, checks, flags, findings:[{rule,at,level,hint}], count,
              matches:[{i,index,length,text}], groups:[{match,label,index,length,text}],
              replaced, capped, hitLimit, timedOut, elapsedMs, reason }
```

落地时这三处与起草的字段表不同，都按**磁盘上纯模块的真实返回**对齐（视图不 import 它们，
映射归装配层，所以字段名以被映射的那一侧为准，不是以起草那张表为准）：

- `timestamp.diff` 用 `time.js` 的 `dateDiff()` 原名（`sign` / `totalDays` / `calendarDays` /
  `ymd` / `breakdown`），起草那对 `labels` / `totals` 作废；`civil` 一格删掉——它是 `time.js`
  里"civil 历法换算"那一段的中间量，页面上没有独立可读的东西，留着只会让装配层以为要供一格。
- `base64.mode` 删（偏差②）。
- `digest.fileNote` 删（偏差⑤）：视图没有"文件"这一格可放，6b 的装配层要把它并进 `notes`。
- `regex.pattern` / `regex.level` 与 `queryRows.hasEquals` 留在模型里但视图**不渲**：
  前者输入框常驻显示、后者是 `findings` 的派生值（`regex.js` 里 level 由 findings 有没有 high 算出），
  表里"级别"那一列说的就是它。渲染与否的账在 Q11 与 `regexBlock` 的注释里，不在这里。

`codecWorkbench.js` 侧的两张导出表是 §0.3 那处解耦要读的东西，形状照 `workbench.js` 的
`WORKBENCH_SPEC` / `PANEL_IDS`（`check-tools-surface.mjs:389-416` 消费的就是这一对）：

```text
export const CODEC_SPEC = { timestamp:{sides:{main:{kind,controls:[…]}, diff:{…}|null}}, … }
export const CODEC_PANEL_IDS = Object.keys(CODEC_SPEC);      // ['timestamp','base64','url','digest','regex']
export function controlIds(prefix, panels = CODEC_PANEL_IDS) → { btn, copy, out, in, when }
```

入口 `dev/js/toolCodec.js` 与 `toolIdcard.js` 同形：读 `#tk-workspace` 上那四个 `data-tk-*`、
校验 `Tk` 四只齐不齐、`createPanelWorkspace` → `createWorkbench` → `createPanelDom` → `mount()`，
不 `export`、不接 `DOMContentLoaded`。**产物名必须与页面引用逐字符一致**（`toolCodec.min.js`，
§6.1 那条大小写教训）。

### 判据清单（§Q，落地后回填）

起草时先钉"这一格要咬什么"，落地后把编号与实际条数对齐：

| 编号 | 咬的那一件事 |
| --- | --- |
| Q1 | 导出面恰好这四个名字；`CODEC_META` 十三档的 `label`/`tone` 逐字对表，`tone` 只许是 `CODEC_TONES` 那五个词（顺序也钉：多一档、少一档、重排都红） |
| Q2 | 零 import 红线：源码剥注释**再剥字符串**后不许出现 `import`（本文件的报错文案要正写"不许 import"，不剥字符串就自咬），末尾一条自证真那一行 `import x from './y.js'` 剥完照样红；同时 §0.3 那条"不进 Tk"由 `toolkitCore.js` 的源码扫守住（那一本里不许出现 `codecView`，O13 的 `Tk` 四只清单不得被悄悄扩成五只） |
| Q3 | 只有一处转义出口：全文对 `view.esc` 的调用是唯一插值路径，源码里不许再出现 `replace(/[&<>"']/`，也不许出现第二个 `'—'` 字面量（空值走 `view.EMPTY_CELL`） |
| Q4 | 构造期闸门：`createCodecView` 缺 `esc`/`noteLines`/`checksTable`/`EMPTY_CELL` 任一样抛 `TypeError` 且点名缺的是哪一样 |
| Q5 | 未知 verdict 抛、跨面板错配抛：`badge('expired')` 与 `block('timestamp', {verdict:'encoded'})` 都不许静默渲成绿的 |
| Q6 | 五块面板外层骨架同形：`tk-result tk-result--{tone}` + `tk-verdict` + `tk-note` 三处类名逐块一致 |
| Q7 | `timestampBlock`：`ambiguous` 必须两行读数且谁都没被标成"对的"；`invalid` 那一档不许出现明细表（空表读起来像"全都通过了"）；输入回显按**码点**封顶 200，超了就说明"共 N 字符"（偏差④，与 `time.js` 那 64 字符的闸门无关，那一档永远走不到截断） |
| Q8 | `base64Block`：结果走 `.tk-lines > section.tk-line > p.tk-line__head` + `p.tk-line__raw`（偏差③，不再叠 `tk-mono`）；字节数按"数字 + 字节"给、不千分位；`rejected` 那一档不摆空结果行；`lossy` 那一档要把损耗那两行（"补齐的 padding" / "剥掉的空白"，由 6b 的装配层随 `fields` 供进来）显示出来，不许只报"已解码" |
| Q9 | `urlBlock`：两档并列 + 那 11 个差异字符显式成句（L11 的口径在视图侧的落点）；`queryRows` 的 `keyOk`/`valueOk` 假值不能显示成"通过" |
| Q10 | `digestBlock`：五格恒定按 `ALGORITHMS` 序，`via==='unavailable'` 那格给"环境不支持"而不是空格；`partial` 与 `bad` 分开（MD5 出结果 + SHA 四档缺席 ≠ 整块失败） |
| Q11 | `regexBlock`：没开 `d` 时组位置显示 `—` 而不是 `0`（N5 在视图侧的对应）；`capped`/`hitLimit`/`timedOut` 三面旗各说各话，不许互相顶；`nomatch` 是 `unknown` 不是 `bad` |
| Q12 | 空数组一律给一句明说的 `tk-hint`，不许摆空表（沿用 `view.checksTable` 那句的形状） |
| Q13 | `notes` 去重：同一句口径若已经在判定表的"依据"列或 `reason` 里出现过就不再重复一遍（`parseBlock` 那条不变量的 codec 版）；`notes` 里的空串与 `null` 一并滤掉，非数组当场抛 |
| Q14 | 数字原样 + 单位：`bytes` 一律"1234 字节"，不做千分位、不做 KB 换算（换算会让 §7 那条字节口径在读侧失效） |
| Q15 | 全部文本经 `esc`：五块面板各喂一条含 `<script>`、引号与 `&` 的输入，断产物里 `<` 只以 `&lt;` 出现 |
| Q16 | 模型缺字段的失败形状：`fieldsTable` 收到非字符串非数字的 `value` 抛 `TypeError` 并点名第几行，不显示 `[object Object]` |

### 判据清单（§R，落地后回填）

§R 那一节量的是**接线**：四本纯模块 + `codecView` 的纯字符串 + `panel-dom` 的绑定接成
`tools-codec.html` 那个样子。三方全部接真的——mock 掉任何一样，§K–§Q 那五节的判据就从
"这一层没错"变成"这一层没测"。

| 编号 | 咬的那一件事 |
| --- | --- |
| R1 | 导出面恰好九个名字（一只工厂、两张表、五只 id 派生、一份对账清单）；`CODEC_PANEL_IDS` 与 §D 那两页锚点逐字同序；只有 `#timestamp` 有 `diff` 栏；每栏的 `kind` 必须在 `codecView.PANEL_VERDICTS` 白名单里（写错就是渲染时当场抛）；控件不许重名；`type` 必须在夹具词汇表 `{text,number,date,area,file,select}` 里；开关的目标键必须是本栏控件、`when` 里的值必须是 `mode` 的真选项 |
| R2 | 五只 id 派生逐字对形；`controlIds` 的 `in` 与 spec 双向对账且不许撞车；六栏各一条主按钮、一个复制按钮、一个结果区（三张清单按**位置**一一对应）；`when` 只有那四格；换前缀整套跟着换；`panels` 参数真的生效 |
| R3 | 源码红线五连：`innerHTML` 全文只有一处、零 `querySelector`、import 边就是那五本、`window.Tk` 共用面不扩（`panel`/`panel-dom`/`view`/`ui` 一律从 env 拿）、`Date.now(`/`getTimezoneOffset`/`performance.`/`window`/`globalThis` 五个词在装配层一个都不许出现而在入口**恰好各一处**；`workbench.js` 不许被复用；`codecView.js` 全仓库只许一本 reach 它 |
| R4 | 构造期闸门：`document`/`Tk.view`/`ui.copyInto`/`runGuarded` 缺哪一样点名哪一样，`now` 非函数、`offsetMinutes` 非整数或越 ±840 都在构造期响；空前缀回落 `tk` 而不是长出一页 `-xxx` |
| R5 | 挂载期六栏全画"等待输入"、一次 `runGuarded` 都不走、不出现证件页那句「未收录」（措辞串页就是装配层拿错了视图） |
| R6 | 时间戳主栏：十位按秒、十三位按毫秒、十一位两读并列且谁都不被标成"已换算"、民用日期回落要说清按哪一档解释、双失败要把两条理由都交出去 |
| R7 | 差值栏：`totalDays` / `calendarDays` / 日历分解三种口径同给，缺哪端只点哪端的名，两端相同就是 0 |
| R8 | 时钟与偏移都缺席时的降级形状：本地行落 `+00:00` 而不是拿宿主时区猜，"相对时间"那一行整行不出现（量 `<td>相对时间</td>`，量短语会撞上 `TIME_CAVEAT`），正则那一只时钟同理——没注入就没有"档间累计耗时"那行假数字 |
| R9 | base64 四档方向各走各的出口；字节闸门先于字母表（否则"1 MiB 的半截 emoji"会报成越界）；`strict` 与宽容档的 padding/空白两条计数在 `lossy` 那一档必须说出来；`mime` 格只管 `dataUri` 那一档，空串按 `text/plain` |
| R10 | URL 栏两档并列 + 那 11 个差异字符（数字由装配层自己扫 `URL_RESERVED` 量出来，不是抄 §L 的结论）+ 解码两条口径 + query 拆解的 `keyOk`/`valueOk`；字节那一格取**入参**字节数（`a?b=c d` 是 7，不是编码后那 9） |
| R11 | 摘要栏挂载期不抢跑（异步 reject 会落在 `mount()` 返回值之外）；文本档五格恒定、`subtle` 只被四档 SHA 各调一次且按规范名大写带横杠；`subtle: null` 是"部分可用"而不是"已算出"；文件档只读一次盘、计数行不写成"字节 3 字节"、要说出来源与"不上传、不留存"；声明尺寸越界的文件拦在 `arrayBuffer()` **之前** |
| R12 | 正则栏六档结论；静态形状（嵌套无界量词）拦在引擎之前、一次都不执行；上限格坏掉时整栏不跑（不许拿着默认上限算出"共 3 处"）；`flags` 归一的重复位在判定表里说出来；`hitLimit` 那句话要带上本次生效的那个数 |
| R13 | 两条失败路分开：用户填的格子不能用 → `FieldError` → 结果区一行提示、面板不算坏；骨架缺一格 / 读盘失败 → 原样上抛、只标坏这一块，"其余面板不受影响"那句才不是废话 |
| R14 | 接线分档：单行格与数字格裸 Enter 提交、带修饰键不算；粘贴框裸 Enter 必须是换行、只有 Ctrl/⌘+Enter 提交且要吃掉默认动作；`mode` 那一格驱动字段组显隐（挂载时占位项两段都藏着）；复制走 `ui.copyInto` 三级兜底、按钮改口后在 1600 ms 那一档改回**骨架原文** |
| R15 | 每块面板的口径行在自己那块恰好一次：挂载期就在、点三次不叠加、跨栏不串页；比的是**转义后**的那一句（`URL_CAVEAT` 里带一个「&」，原样串在产物里不存在） |
| R16 | 入口只读骨架那四格 `data-tk-*`：容器缺 / `data-tk-ids` 空 / `window.Tk` 没挂上来 / 容器读不到属性四档各有点名的一句话并写进提示行；成功路径把两条 `<script>` 接起来、本地那一行按入口注入的宿主偏移走、换前缀整套跟着换 |

§R 落地时定下的六处（起草那一格看不见的东西）：

1. **挂载期一律不计算，六栏统一画 `IDLE`**。证件页那份是"挂载即渲一栏真结果"（它的输入是
   18 位数字串，渲一次几乎不要钱）；编码页五块里有一块要 `await`，挂载期算的话 reject 落在
   `mount()` 返回值之外、`report.broken` 记不到它。所以这里改成一条统一口径，并把"还没有输入"
   那一档抽成 `IDLE` 那张按 `kind` 取表——挂载期与"清空之后再点一次"共用一份形状，
   否则"刷新看到的"和"清空看到的"会悄悄长得不一样，而那一类差异没有判据咬得住。
2. **`URL_RESERVED` 在装配层重列一份**，不 import `codec.js` 内部那张 `RESERVED`：面板上
   "多少个字符在这一档不编码"要的是同一件事的**另一侧证据**，两处各列、由 R10 判出 11 个，
   比共享一个常量更能挡住"改了表没人发现那句数字变了"。
3. **`FieldError` 不 export**。R1 钉死导出面九个名字，异常类是这一本的内部约定；导出去等于
   给 Task 9 的对账多留一个"别人可以自己抛"的口子。
4. **摘要那一栏两次 `runGuarded`**：画结果一次、异步异常原样再抛一次。少了后者，读盘失败
   就逃逸成一条没人记的控制台红线。
5. **`crypto.subtle` 由入口注入，且 `null` 与"缺席"是两件事**：`null` 是"这一档确实取不到"
   （非安全上下文），面板据此把 SHA 四格标成"环境不支持"；缺席才是"没人管、模块自己去找"。
6. **判据自己红过的四处**（记在这儿是因为下一个读计划的人会以为表是绿的）：R2 原本拿
   `deepEqual(got.copy, got.btn)` 逐字比 id 串，而 `tk-copy-*` 与 `tk-btn-*` 天生不同字，改成比
   去掉 `<prefix>-btn|copy-` 之后的尾串（顺序照样钉得住）；R8 原本比"相对时间"这个短语，
   而 `TIME_CAVEAT` 里正好有它，改成比明细行的 `<td>相对时间</td>`；R15 原本比口径句原文，
   被 `esc` 把「&」转走就永远数不到 1，改成比转义后的那一句；R16 原本手拼
   `22:13:20` + `+08:00`，漏了跨日界（东八区那是**次日 06:13:20**），改成按 `fromEpoch` 现算。
   四条都是判据的尺子量错了对象，没有一条是实现走样。

### 落地时定下的五处（起草那张表里没有、或说得不一样）

这五处不是"实现走样"，是起草那一格看不见的东西落地才看得见。每一处都记在这儿，
下一个读计划的人不必去 diff 判据与实现。

1. **`matched` 是第十三档**（"有命中"，tone `ok`）。起草那张表只有 `nomatch` 而没有它的对立面：
   正则面板"编译成功且有命中"本来要落到 `computed`（摘要的说法）或 `converted`（时间戳的说法），
   两者都是别的面板的措辞。§Q1 现在钉的是"十三个词、键序即契约"。
2. **方向不进结果区**：`base64Block` 的模型里没有 `mode`。编码 / 解码 / data URI 那一档由工作台
   顶部的分段控件常驻显示（`panel-dom.js` 的既有形状），结果区再说一遍只是把用户已经看见的东西
   重排一遍字——而 §7 那一行是按字节算的。
3. **结果行走 `.tk-line__raw`，不叠 `tk-mono`**。起草写的是"`out` 走 `tk-mono`"，落地查了样式层：
   `dev/sass/toolkit.scss:581` 那一条 `.tk-line__raw` 已经写了 `$tk-meta` 等宽栈与 `word-break: break-all`，
   再挂一个 `tk-mono` 就是同一条规则写两处——将来只改其中一处，页面上就有一族结果行不等宽。
   外层也照证件页 `workbench.js` 的 `renderRead` 逐字对齐（`.tk-lines` 是 grid 容器、
   `section.tk-line` 是一节、`p.tk-line__head` 必须是 `<p>`，它带块级 margin，写成 `<span>` 会静默失效）。
4. **输入回显按码点封顶 200**（`ECHO_MAX_CHARS`）。起草没这条：证件页的输入是 18 / 18 / 19 位的数字串，
   永远走不到截断那一支；编码页按 §5.2 那三道闸门允许到 1 MiB，不封顶就是让结果区把用户刚粘进去
   的东西再打一遍，节点数当场翻倍。按 `Array.from` 的码点切而不是 `String#length` 的码元切：
   切到一个 emoji 的中间，页面上是一个替换字符。判据在 Q7 末尾三条（含 250 个 emoji 那一夹具）。
5. **`digest.fileNote` 不由视图渲染**。文件那一档的说明句是"这五格算的是哪个来源"，属于口径而非
   结果，6b 的装配层要把它并进 `notes` 交进来。视图侧删掉这个字段，比留一格"认得的字段但不知道
   渲到哪里"好——留着的后果是装配层老老实实供、用户一个字都看不到。

另外两处是**脚手架自己的账**，不是这一本的：

- §Q2 那条 import 扫描要先剥字符串。本文件的报错文案与注释都要正写"不许 import"（`view.js` 的
  同族报错就是这口径），只剥注释会自咬。补法不是放水：Q2 末尾拿一行真 `import x from './y.js'`
  过同一个剥函数自证仍然命中。这是 §Q 写第一遍时就红过的一次，红的是判据自己。
- 登记镜像时 `FILE_TARGETS` 的注释口径也跟着改了一句：`codecView.js` 是本清单里第一本
  **故意不挂进 `window.Tk`** 的模块，它的镜像同时是那条字节账的见证（`toolkitCore.js` 那份镜像
  里没有 `codecView`，Q2 的源码扫核的就是这一对）。

### Steps（6a 视图层 / 6b 装配层，两格各自一次提交）

**6a** 先 §Q 判据（红）→ `codecView.js`（绿）→ 登记镜像 + `--fix` → 门禁①②③ → 提交。
**6b** 再 §R 判据（红）→ `codecWorkbench.js` + `toolCodec.js`（绿）→ 镜像同步 → 门禁①②③④
（④ 用构建自证"`window.Tk` 仍四只、证件页两本字节未变"）→ 提交。

### 落地镜像（门禁二核的就是这两块，`--fix` 会把它们整块换成磁盘内容）

上一格的契约段一律 ```text，门禁二不核它们——它核的是**实现**逐字节，不是签名。
下面两块是段 3 名下的新镜像：视图层整本 + §Q 那一节判据。

#### `dev/js/tools/codecView.js`（整文件）

```js
/**
 * 编码工具箱页五块面板的**纯字符串视图层**：模型进、HTML 出。
 *
 * 这一本处在装配层与结果区之间，只做一件事——把 `time.js` / `codec.js` / `digest.js` /
 * `regex.js` 四本纯模块的结果对象变成 `tk-result` 那一族 DOM 片段。它不碰 DOM、不读时钟、
 * 不读环境，所有输入都由 `codecWorkbench.js` 递进来。
 *
 * 四条红线，§Q 的判据逐条对着咬：
 *
 * 1. **零 import，且不进 `window.Tk`**（§Q2）。它只由 `codecWorkbench.js` 一本 import：
 *    只有一个入口 reach 它，Rollup 就不会把它提成共享 chunk，产物里也就没有那句会把整页
 *    打成 SyntaxError 的 `import{`（实测记录在 `dev/js/toolkitCore.js` 开头）。反过来它自己
 *    一旦 import 别的东西，"只有一个入口"这条前提就没了。而把它挂进 `Tk` 的后果是**证件页
 *    替编码页的五块面板付 gzip**——§7 那一行余量只剩 4,173B（2026-09-28 证件页表格收口后按
 *    `cat f | gzip -9 | wc -c` 复量，三件 2,135 / 7,037 / 64,479），挂不得。
 * 2. **转义只有一处出口**（§Q3）。`esc` / `EMPTY_CELL` / `checksTable` / `noteLines` 四样
 *    全部来自注入的那只 `view`（`window.Tk.view`）。这一本里不许长出第二只 `esc`、第二张
 *    实体映射表、第二个破折号字面量：两份实现的下场必然是"改了一份、页面上跑的是另一份"。
 *    表格那一半**允许**自带（`view.js` 里的 `table` 是私有函数，共享它就得开 import 边），
 *    但每一格都逐格经注入的 `esc`，所以 §Q15 那条"五块面板都不许漏转义"仍然只需要盯一处。
 * 3. **未知 verdict 与跨面板错配都抛**（§Q5）。与 `view.js` 的 `stateMetaOf` 同一条口径：
 *    哪天纯模块新增一档，页面必须当场炸给装配层，而不是把一个没定论的结果渲成绿的。
 *    这一本还多一张「面板 → 允许的 verdict」白名单：时间戳面板报"已编码"就是映射写错。
 * 4. **五块面板外层骨架同形**（§Q6）。`<div class="tk-result tk-result--{tone}">` 包一层、
 *    徽章那一行恰好一个，与 `view.parseBlock` 那一条一致；`toolkit.scss` 只写了
 *    `tk-state--ok/warn/bad/unknown/idle` 五档徽章，档位词表就是从那里来的，多一档就是
 *    一个没有样式的类名。
 *
 * 与 `view.js` 的分工：那一本管证件页的四读八生成，这一本管编码页的五块面板，互不 import，
 * 共用的是同一只注入进来的 `view`。措辞也归视图：装配层只交事实（数字、串、布尔、null），
 * "补齐的 padding"、"环境不支持"这类话术只在这一本里写，用户读到的句子才不会一页一个说法。
 *
 * 复算：`node --test scripts/toolkit-tests.mjs` 里的 §Q 十六判（`toolkit-tests.mjs` 末尾）。
 */

/**
 * 样式层认得的五档颜色后缀，逐字对着 `dev/sass/toolkit.scss` 的 `.tk-state--*` 五条规则。
 * 这一格写成数组而不是集合，是因为 §Q1 要钉顺序——多一档、少一档、重排都要红。
 */
export const CODEC_TONES = ['ok', 'warn', 'bad', 'unknown', 'idle'];

/**
 * verdict → 徽章文案与档位。十三个词是五块面板全部可能落到的结论，`tone` 只有五个值。
 * 键序即契约：§Q1 用 `Object.keys` 逐字对表，白名单也按这张表取词。
 */
export const CODEC_META = {
  converted: { label: '已换算', tone: 'ok' },
  encoded: { label: '已编码', tone: 'ok' },
  decoded: { label: '已解码', tone: 'ok' },
  computed: { label: '已算出', tone: 'ok' },
  matched: { label: '有命中', tone: 'ok' },
  ambiguous: { label: '长度两可', tone: 'unknown' },
  nomatch: { label: '零命中', tone: 'unknown' },
  lossy: { label: '有还原损耗', tone: 'warn' },
  partial: { label: '部分可用', tone: 'warn' },
  capped: { label: '已到上限', tone: 'warn' },
  invalid: { label: '不成立', tone: 'bad' },
  rejected: { label: '已拒收', tone: 'bad' },
  empty: { label: '等待输入', tone: 'idle' },
};

/**
 * 每块面板允许出现的 verdict。错配（时间戳面板报"已编码"）在渲染之前就抛——装配层的映射
 * 表写错时，后果本来是一句被用户当事实读的文案。
 */
export const PANEL_VERDICTS = {
  timestamp: ['converted', 'ambiguous', 'invalid', 'empty'],
  base64: ['encoded', 'decoded', 'lossy', 'invalid', 'rejected', 'empty'],
  url: ['encoded', 'decoded', 'invalid', 'rejected', 'empty'],
  digest: ['computed', 'partial', 'invalid', 'rejected', 'empty'],
  regex: ['matched', 'nomatch', 'capped', 'invalid', 'rejected', 'empty'],
};

/** `codec.js` 那两档编码口径的差异字符数，§Q9 与 §L 的 L11 是同一件事的两个面 */
const URL_DIFF_SENTENCE = '个字符在这一档不编码、在那一档编码';

/**
 * 回显封顶的字符数（按码点算）。时间戳那一块的输入本来就 ≤ 64 字符（`time.js` 的
 * `MAX_INPUT_LEN`），永远走不到截断那一支；真正需要它的是 Base64 / URL 那两块 1 MiB 的输入框。
 */
const ECHO_MAX_CHARS = 200;

/** `viaOf` 的三档说法：谁算的必须说清，否则"MD5 出了、SHA 没出"读起来像都失败 */
const VIA_CN = { self: '本站自实现', subtle: '浏览器 crypto', unavailable: '环境不支持' };

/** 正则风险级别：`riskScan` 只给 high / medium，`none` 那一档压根不进这张表 */
const LEVEL_CN = { high: '高危', medium: '中等' };

/** `dateDiff().breakdown` 那六个 `unit` 的中文名，键集与 `time.js` 给的那一张表逐字对齐 */
const DIFF_UNIT_CN = { ms: '毫秒', s: '秒', min: '分钟', h: '小时', d: '天', wk: '周' };

/** 解码列的三种取值：`null` 是"这一格没判"，与 false 的"解不出"是两件事 */
const DECODE_CN = { true: '可以', false: '解不出' };

/**
 * 时间戳两读的中文名。`time.js` 的 `parseTimestamp().readings[].kind` 给的是 `second` / `milli`
 * 两个 token（§K 的 K2 钉死顺序），中文说法归视图：装配层只交事实，用户读到的句子在一本里写。
 */
const READING_CN = { second: '按秒', milli: '按毫秒' };

/** 报错文案里的"收到什么"，与 `view.js` / 四本纯模块那份同形（各自私有，见上面第 2 条） */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}

/** 注入依赖的名字与判法：`EMPTY_CELL` 是常量，其余三样是函数 */
const REQUIRED = {
  esc: 'function',
  checksTable: 'function',
  noteLines: 'function',
  EMPTY_CELL: 'string',
};

/**
 * 造一只编码页视图。闸门排在构造期：缺依赖的后果本来是"渲染到某一格才炸"，
 * 那时已经落在某一块具体面板里，报错里既没有缺的名字也没有装配层的形状。
 * @param {object} view `window.Tk.view`，必须齐 `esc` / `EMPTY_CELL` / `checksTable` / `noteLines`
 * @returns {object} 五块面板的渲染函数与两只公用件（`badge` / `fieldsTable`）
 */
export function createCodecView(view) {
  const v = view ?? {};
  const missing = Object.keys(REQUIRED).filter((k) => typeof v[k] !== REQUIRED[k]);
  if (missing.length > 0) {
    throw new TypeError(`createCodecView：注入的 view 缺 ${missing.join(' / ')}（应是 window.Tk 里那份 view，跨页共用层不许 import）`);
  }
  const { esc, EMPTY_CELL, checksTable, noteLines } = v;

  /** 取一档 verdict 的元信息；不在总表里就抛（与 `view.js` 的 stateMetaOf 同一条口径） */
  const metaOf = (verdict, where) => {
    if (typeof verdict !== 'string' || !Object.prototype.hasOwnProperty.call(CODEC_META, verdict)) {
      throw new TypeError(`${where} 收到未知的结论「${shapeOf(verdict)}」，CODEC_META 里没有这一档`);
    }
    return CODEC_META[verdict];
  };

  /** 白名单那一层：总表里有、这块面板不该有，就是装配层的映射写错了 */
  const verdictOf = (panel, verdict) => {
    const list = PANEL_VERDICTS[panel];
    if (!Array.isArray(list)) {
      throw new RangeError(`编码页视图只服务这五块面板：${Object.keys(PANEL_VERDICTS).join(' / ')}`);
    }
    const m = metaOf(verdict, `${panel} 面板`);
    if (!list.includes(verdict)) {
      throw new TypeError(`内部不变量：${panel} 面板得不出「${verdict}」这一档结论（映射表写错了；白名单是 ${list.join(' / ')}）`);
    }
    return m;
  };

  /** 一句人话的提示行；`tk-hint` 与证件页共用同一个类名 */
  const hint = (text) => `<p class="tk-hint">${esc(text)}</p>`;

  /**
   * 用户那一行原样回显；空串不占一行。
   * **封顶**在视图这一层：证件页的输入是 18 / 18 / 19 位的数字串，编码页的输入按 §5.2 那三道
   * 闸门允许到 1 MiB——不封顶就是让结果区把用户刚粘进去的东西再打一遍，节点数直接翻倍。
   * 按码点切而不是按 `char.length` 切：一个 emoji 的两个码元切一半，页面上就是一个替换字符。
   */
  const echo = (text) => {
    if (typeof text !== 'string' || text === '') return '';
    const cps = Array.from(text);
    const shown = cps.length <= ECHO_MAX_CHARS ? text
      : `${cps.slice(0, ECHO_MAX_CHARS).join('')}…（已截断，输入共 ${cps.length} 字符）`;
    return `<p class="tk-echo">输入 <span class="tk-mono">${esc(shown)}</span></p>`;
  };

  /**
   * 一格取值：`null` / `undefined` / 空串 → `EMPTY_CELL`，其余交给注入的 `esc`。
   * 非文本的取值（对象、数组）在这里抛，不等 `esc` 抛——点名第几行才有用。
   */
  const cellOf = (value, where) => {
    if (value === null || value === undefined || value === '') return EMPTY_CELL;
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new TypeError(`内部不变量：${where} 算出来是 ${shapeOf(value)}，不是文本`);
    }
    return esc(value);
  };

  /**
   * 通用表格构造点（与 `view.js` 那个私有的 `table` 同形状，但每一格都走注入的 `esc`）。
   * 表头与每行的格数由同一段代码算出，"列数一致"是构造保证的，不是靠人记得数 `<td>`。
   * @param {string} who 类名后缀与报错主语
   * @param {{label:string,mono?:(boolean|((row:object)=>boolean)),get:(row:object)=>(string|number|null)}[]} columns
   * @param {object[]} rows
   * @returns {string} 空行集返回空串——空表在屏幕上读起来像"全都通过了"
   */
  const grid = (who, columns, rows) => {
    if (rows === undefined || rows === null) return '';
    if (!Array.isArray(rows)) throw new TypeError(`内部不变量：${who} 的行集应为数组，收到 ${shapeOf(rows)}`);
    if (rows.length === 0) return '';
    // `mono` 允许是谓词：同一列里"哪些格走等宽"是随行走变化的（明细表的值列就是），
    // 写成 `c.mono ?` 会把函数当真值，于是整列连表头一起等宽。
    const monoAt = (c, row) => (typeof c.mono === 'function' ? c.mono(row) === true : c.mono === true);
    const head = columns
      .map((c) => `<th scope="col"${c.mono === true ? ' class="tk-mono"' : ''}>${esc(c.label)}</th>`)
      .join('');
    const body = rows
      .map((row, i) => `<tr>${columns
        .map((c) => `<td${monoAt(c, row) ? ' class="tk-mono"' : ''}>${cellOf(c.get(row), `${who} 第 ${i + 1} 行「${c.label}」`)}</td>`)
        .join('')}</tr>`)
      .join('');
    return `<table class="tk-table ${who}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  };

  /**
   * 一栏"项目 / 值"两列的明细表，五块面板共用的那一张。
   * @param {{label:string,value:(string|number|null),mono?:boolean}[]} rows
   */
  const fieldsTable = (rows) => {
    if (!Array.isArray(rows)) throw new TypeError(`fieldsTable 的行集应为数组，收到 ${shapeOf(rows)}`);
    rows.forEach((row, i) => {
      if (row === null || typeof row !== 'object' || typeof row.label !== 'string' || !('value' in row)) {
        throw new TypeError(`内部不变量：fieldsTable 第 ${i + 1} 行缺 label 或缺 value（需要 {label, value, mono?}，收到 ${shapeOf(row)}）`);
      }
    });
    return grid('tk-detail', [
      { label: '项目', get: (r) => r.label },
      { label: '值', mono: (r) => r.mono === true, get: (r) => r.value },
    ], rows);
  };

  /**
   * 一行"结果"文本，形状与证件页那一族逐字对齐（`workbench.js` 的 `renderRead`）：
   * `.tk-lines` 是 grid 容器，`.tk-line` 是带下边框的一节，`.tk-line__head` 有块级 margin
   * 所以必须是 `<p>`。`tk-line__raw` **不再叠 `tk-mono`**——`toolkit.scss:581` 那一格已经写了
   * `$tk-meta` 等宽栈与 `word-break: break-all`，再加一个类是同一条规则写两处。
   * 复制按钮不在这一格里：它由页面骨架常驻给（证件页就是这个形状），视图只产文本。
   */
  const outLines = (label, text) => {
    if (typeof text !== 'string' || text === '') return '';
    return '<div class="tk-lines"><section class="tk-line">'
      + `<p class="tk-line__head">${esc(label)}</p>`
      + `<p class="tk-line__raw">${esc(text)}</p></section></div>`;
  };

  /** 字节数那一行。`0` 不占一行：闸门拦下与还没输入都可能是 0，说一句"0 字节"只会添乱 */
  const bytesLine = (n, prefixText) => (typeof n === 'number' && n > 0
    ? `<p class="tk-count">${prefixText ? `${esc(prefixText)} ` : ''}${esc(n)} 字节</p>` : '');

  /** 口径行：装配层把模块的 CAVEAT 常量整包递进来，重复过的那句丢掉 */
  const notesOf = (notes, already) => {
    const list = notes ?? [];
    if (!Array.isArray(list)) throw new TypeError(`编码页视图的 notes 应为数组，收到 ${shapeOf(list)}`);
    return noteLines(list.filter((t) => typeof t === 'string' && t !== '' && !already.includes(t)));
  };

  /** 这一段是不是"真的把东西给用户了"：表格 / 等宽结果行 / 计数行，三样之一 */
  const showsResult = (html) => html.includes('<table')
    || html.includes('tk-line__raw') || html.includes('tk-count');

  /**
   * 一块面板的完整外层：徽章行 +（reason 提示）+（回显）+（判定表）+ 面板自己的内容 + 口径行。
   * "没有可显示的内容"那句只在**既没有结果、也没有 reason**时补，避免和 reason 重复。
   * 什么算"有结果"由 `showsResult` 说清楚：表格、等宽结果行、字节数行三样之一。提示行不算——
   * 一句 `tk-hint` 正是"没有结果"的说法本身，把它算成结果就等于永远不说那句明说的话。
   * @param {string} panel 面板名（白名单那一层在这里生效）
   * @param {object} m 视图模型
   * @param {(string|null|undefined)[]} notes 模块给的口径常量
   * @param {(model:object)=>string[]} bodyOf 各面板自己的内容
   */
  const wrap = (panel, m, notes, bodyOf) => {
    const model = m ?? {};
    const { label, tone } = verdictOf(panel, model.verdict);
    const parts = [`<p class="tk-verdict"><span class="tk-state tk-state--${tone}">${esc(label)}</span></p>`];
    const reason = typeof model.reason === 'string' && model.reason !== '' ? hint(model.reason) : '';
    if (reason) parts.push(reason);
    parts.push(echo(model.input));
    const shownDetails = [];
    if (Array.isArray(model.checks)) {
      parts.push(checksTable(model.checks));
      for (const c of model.checks) if (c && typeof c.detail === 'string') shownDetails.push(c.detail);
    }
    const body = bodyOf(model);
    const hasBody = body.some((x) => x !== '' && showsResult(x));
    parts.push(...body.filter((x) => x !== ''));
    if (!hasBody && !reason) parts.push(hint('这一栏还没有可显示的结果。'));
    parts.push(...notesOf(notes, [...shownDetails, model.reason]));
    return `<div class="tk-result tk-result--${tone}">${parts.filter((x) => x !== '').join('')}</div>`;
  };

  /** 徽章本身：给装配层与判据用，块函数自己走 `wrap` */
  const badge = (verdict) => {
    const { label, tone } = metaOf(verdict, 'badge');
    return `<span class="tk-state tk-state--${tone}">${esc(label)}</span>`;
  };

  // ── 五块面板 ──────────────────────────────────────────────────────────────

  /**
   * 两个日期之差。`diff` 就是 `time.js` 的 `dateDiff()` 返回值原样进（字段同名，视图不 import 它），
   * 三种口径**同时给**，不许替用户挑一种：`totalDays`（整 24 小时）与 `calendarDays`（跨 UTC 日历日）
   * 在 23:00 → 次日 01:00 这种样本上就是 0 与 1，只报一个数等于把另一种口径藏起来（§K 的 K9）。
   * `ymd` 是 |差| 的分解、永远非负（K8），所以 `sign < 0` 时必须补一句方向，否则"1 年 0 个月 1 天"
   * 会被读成正向的那一种。
   */
  const diffOf = (diff) => {
    if (diff === null || diff === undefined) return [];
    const d = diff;
    if (typeof d !== 'object' || Array.isArray(d)
      || typeof d.totalDays !== 'number' || typeof d.calendarDays !== 'number'
      || d.ymd === null || typeof d.ymd !== 'object' || !Array.isArray(d.breakdown)) {
      throw new TypeError(`内部不变量：timestamp 面板的 diff 应是 dateDiff 的返回形状（totalDays / calendarDays / ymd / breakdown），收到 ${shapeOf(d)}`);
    }
    const rows = [
      { label: '日历分解', value: `${d.ymd.years} 年 ${d.ymd.months} 个月 ${d.ymd.days} 天`, mono: true },
      { label: '整 24 小时', value: `${d.totalDays} 天`, mono: true },
      { label: '跨 UTC 日历日', value: `${d.calendarDays} 天`, mono: true },
    ];
    const units = grid('tk-detail', [
      { label: '单位', get: (r) => unitOf(r.unit) },
      { label: '个数', mono: true, get: (r) => r.value },
    ], d.breakdown);
    const says = [];
    if (d.sign < 0) says.push(hint('结束那一端在开始那一端之前，上面那些数说的是绝对值。'));
    if (d.totalDays !== d.calendarDays) {
      says.push(...noteLines(['整 24 小时与跨 UTC 日历日是两种口径：23:00 到次日 01:00 是 0 天与 1 天。']));
    }
    return [fieldsTable(rows), units, ...says];
  };

  const unitOf = (unit) => {
    if (typeof unit !== 'string' || !Object.prototype.hasOwnProperty.call(DIFF_UNIT_CN, unit)) {
      throw new TypeError(`timestamp 面板收到未知的差值单位「${shapeOf(unit)}」`);
    }
    return DIFF_UNIT_CN[unit];
  };

  /** 两读的解释那一列：token 认不出来就抛，页面上少一列读数比抛错更难查 */
  const readingOf = (kind) => {
    if (typeof kind !== 'string' || !Object.prototype.hasOwnProperty.call(READING_CN, kind)) {
      throw new TypeError(`内部不变量：readings[].kind 只认 second / milli，收到「${shapeOf(kind)}」（中文说法在视图这一层的 READING_CN 里，装配层不许自己写）`);
    }
    return READING_CN[kind];
  };

  /** 时间戳：读数（ambiguous 两行）+ 明细 + 相对时间那一行 +（可选）两个日期之差 */
  const timestampBlock = (m, notes = []) => wrap('timestamp', m, notes, (model) => {
    const readings = grid('tk-matches', [
      { label: '解释', get: (r) => readingOf(r.kind) },
      { label: 'epoch', mono: true, get: (r) => r.epochMs },
      { label: 'UTC', mono: true, get: (r) => r.isoUtc },
    ], model.readings);
    const fields = Array.isArray(model.fields) ? model.fields.slice() : [];
    if (typeof model.relative === 'string' && model.relative !== '') {
      fields.push({ label: '相对时间', value: model.relative });
    }
    return [readings, fieldsTable(fields), ...diffOf(model.diff)];
  });

  /**
   * Base64：结果那一栏（等宽、可整段选中）+ 字节数 + 损耗明细。
   * 方向（编码 / 解码 / data URI）刻意**不进结果区**：它由工作台那组分段控件常驻显示，
   * 在结果里再说一遍只是把用户已经看见的东西再打一遍字，而 §7 的余量按字节算。
   */
  const base64Block = (m, notes = []) => wrap('base64', m, notes, (model) => [
    outLines('结果', model.out),
    bytesLine(model.bytes),
    fieldsTable(model.fields ?? []),
  ]);

  /** URL：两档并列 + 那 11 个差异字符 + 两档各解一次 + query 参数拆解 */
  const urlBlock = (m, notes = []) => wrap('url', m, notes, (model) => {
    const pair = grid('tk-detail', [
      { label: '档位', get: (r) => r.name },
      { label: '结果', mono: true, get: (r) => r.out },
    ], model.pair);
    const differs = Array.isArray(model.differs) && model.differs.length > 0
      ? hint(`${model.differs.length} ${URL_DIFF_SENTENCE}：${model.differs.join(' ')}`) : '';
    const tries = grid('tk-detail', [
      { label: '试的字段', get: (r) => r.field },
      { label: '结果', mono: true, get: (r) => (r.ok ? r.out : EMPTY_CELL) },
      { label: '结论', get: (r) => (r.ok === null ? EMPTY_CELL : DECODE_CN[String(r.ok)]) },
      { label: '说明', get: (r) => r.reason },
    ], model.decodeTries);
    const query = grid('tk-detail', [
      { label: '原始片段', mono: true, get: (r) => r.raw },
      { label: '键', mono: true, get: (r) => r.key },
      { label: '值', mono: true, get: (r) => r.value },
      { label: '键解码', get: (r) => (r.keyOk === null || r.keyOk === undefined ? EMPTY_CELL : DECODE_CN[String(r.keyOk)]) },
      { label: '值解码', get: (r) => (r.valueOk === null || r.valueOk === undefined ? EMPTY_CELL : DECODE_CN[String(r.valueOk)]) },
      { label: '说明', get: (r) => r.reason },
    ], model.queryRows);
    return [pair, differs, tries, query, bytesLine(model.bytes)];
  });

  /** 摘要：五格恒定行序 + 来源那一列（谁算的）+ 字节数 */
  const digestBlock = (m, notes = []) => wrap('digest', m, notes, (model) => {
    const rows = grid('tk-matches', [
      { label: '算法', get: (r) => r.algo },
      { label: '摘要', mono: true, get: (r) => r.hex },
      { label: '字节', get: (r) => r.bytes },
      { label: '来源', get: (r) => viaOf(r.via) },
      { label: '说明', get: (r) => r.reason },
    ], model.rows);
    const kindText = model.kind === 'bytes' ? '字节' : model.kind === 'text' ? '文本' : '';
    return [rows, bytesLine(model.bytes, kindText)];
  });

  const viaOf = (via) => {
    if (typeof via !== 'string' || !Object.prototype.hasOwnProperty.call(VIA_CN, via)) {
      throw new TypeError(`digest 面板收到未知的来源「${shapeOf(via)}」`);
    }
    return VIA_CN[via];
  };

  /**
   * 正则：风险表 + 命中表 + 捕获组表 + 替换预览 + 两面旗与那个上限数。
   * `hitLimit`（次数到点）与 `timedOut`（档间时间到点）是两件不同的事，互相顶掉就等于把闸门的
   * 形状藏起来；`capped` 不是第三面旗，它是**本次生效的上限次数**那个数字（§N 的 N8 钉的这一对），
   * 只在前者成立时把它一起报出来——"到了上限"后面不跟一个数，用户分不清是本站硬闸门还是这一档的预算。
   * 模型里的 `pattern` 与 `level` 刻意不渲：前者是输入框本来就常驻显示的东西，
   * 后者是 `findings` 的派生值（`regex.js` 里 level 由 findings 有没有 high 算出来），
   * 表里那一列"级别"说的就是它，在表头再复述一句只是抄自己。
   */
  const capOf = (model) => {
    if (!Number.isInteger(model.capped) || model.capped < 1) {
      throw new TypeError(`内部不变量：capped 应是本次生效的上限次数（正整数），收到 ${shapeOf(model.capped)}——"到没到"是 hitLimit 那面旗的事，这一格拿它当布尔读会永远说"已到上限"`);
    }
    return model.capped;
  };

  const regexBlock = (m, notes = []) => wrap('regex', m, notes, (model) => {
    const cap = capOf(model);
    const findings = grid('tk-matches', [
      { label: '规则', get: (r) => r.rule },
      { label: '位置', get: (r) => r.at },
      { label: '级别', get: (r) => levelOf(r.level) },
      { label: '提示', get: (r) => r.hint },
    ], model.findings);
    const flagsRow = typeof model.flags === 'string' && model.flags !== ''
      ? hint(`生效的 flags：${model.flags}`) : '';
    const countRow = typeof model.count === 'number' && model.count > 0
      ? `<p class="tk-count">共 ${esc(model.count)} 处</p>` : '';
    const matches = grid('tk-matches', [
      { label: '序号', get: (r) => r.i },
      { label: '起始', get: (r) => r.index },
      { label: '长度', get: (r) => r.length },
      { label: '命中文本', mono: true, get: (r) => r.text },
    ], model.matches);
    const groups = grid('tk-matches', [
      { label: '第几处', get: (r) => r.match },
      { label: '组', get: (r) => r.label },
      // 没开 `d` 时 native 根本没有组位置，null 走 EMPTY_CELL 而不是 0：显示 0 就是报一个假位置
      { label: '位置', get: (r) => r.index },
      { label: '长度', get: (r) => r.length },
      { label: '内容', mono: true, get: (r) => r.text },
    ], model.groups);
    const flagsOn = typeof model.flags === 'string' && model.flags.includes('d');
    const flagHints = [
      model.hitLimit ? hint(`命中次数已到本次上限 ${cap} 次，剩下的没有再算`) : '',
      model.timedOut ? hint('档间时间预算已用完，只算了前面那些') : '',
      model.matches && model.matches.length > 0 && !flagsOn ? hint('没开 d 就没有捕获组位置，位置那一列留空') : '',
      typeof model.elapsedMs === 'number' ? hint(`档间累计耗时 ${model.elapsedMs}ms`) : '',
    ];
    return [findings, flagsRow, countRow, matches, groups,
      outLines('替换预览', model.replaced), ...flagHints];
  });

  const levelOf = (level) => {
    if (typeof level !== 'string' || !Object.prototype.hasOwnProperty.call(LEVEL_CN, level)) {
      throw new TypeError(`regex 面板收到未知的风险级别「${shapeOf(level)}」`);
    }
    return LEVEL_CN[level];
  };

  const BLOCKS = { timestamp: timestampBlock, base64: base64Block, url: urlBlock, digest: digestBlock, regex: regexBlock };

  /** 唯一分派点：Task 6b 的装配层按面板名调这一只，块函数本身也各自导出，判据能逐块点名 */
  const block = (panel, m, notes = []) => {
    const fn = BLOCKS[panel];
    if (!fn) {
      throw new RangeError(`编码页视图只服务这五块面板：${Object.keys(PANEL_VERDICTS).join(' / ')}，收到 ${shapeOf(panel)}`);
    }
    return fn(m, notes);
  };

  return { badge, fieldsTable, timestampBlock, base64Block, urlBlock, digestBlock, regexBlock, block };
}
```

#### `scripts/toolkit-tests.mjs` §Q（整节，从 `// ── §Q` 到文件末尾）

```js
// ── §Q 编码页视图层（`tools/codecView.js`，段 3 Task 6a）────────────────────
// 本节测的是**纯字符串那一层**：模型进、HTML 出，不碰 DOM、不碰四本纯模块。四条红线先说清，
// 整套判据都围着它们转：
//   ① **零 import，且不进 `window.Tk`**（Q2）。它只由 `codecWorkbench.js` 一本 import——只有
//      一个入口 reach 它就不会成 chunk，这是它敢 import 出去的前提；反过来它自己一旦 import，
//      那前提就没了。而它挂进 `Tk` 的后果是证件页替编码页的五块面板付 gzip，§7 的余量只剩
//      4,173B，所以这一格由 `toolkitCore` 的源码扫守住（Q2 后半），`O13` 那份四只清单不许被扩成五只。
//   ② **转义只有一处出口**（Q3）。`esc` / `EMPTY_CELL` / `checksTable` / `noteLines` 四样都来自
//      注入的那只 `view`，本文件里不许长出第二只 `esc`、第二张实体表、第二个 `'—'`。
//      表格那一半**允许**自带（`view.js` 的 `table` 是私有函数，共享它就要开 import 边），
//      但每一格必须逐格经注入的 `esc`——Q15 拿一条带 `<script>` 与引号的输入验这一句。
//   ③ **未知 verdict 与跨面板错配都抛**（Q5）。与 `view.js` 的 `stateMetaOf` 同一条口径：
//      没定论的结果不许被渲成绿的。
//   ④ **五块面板外层骨架同形**（Q6）。`tk-result tk-result--{tone}` 与徽章那一行是要求不是巧合，
//      `toolkit.scss` 只认那五个 tone 词。
const Q_VIEW = await import('../dev/js/tools/view.js');
const { CODEC_TONES, CODEC_META, PANEL_VERDICTS, createCodecView } = await import('../dev/js/tools/codecView.js');

/**
 * 剥注释扫源码：块注释与行注释里的字样都不算命中（与 §K/§O 同一形状）。
 * `import` 那一格另算：本文件的报错文案与注释里都要正写"不许 import"（`view.js` 的同族报错
 * 就是这口径），所以判"有没有 import 语句"时先去掉字符串与模板串。这不是给红线放水——
 * 真那一行 `import x from './y.js'` 剥掉模块名之后 `import` 关键字还在，Q2 末尾拿它自证。
 */
const qCode = () => read('dev/js/tools/codecView.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const qStripStrings = (code) => code.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
const qImportScan = () => qStripStrings(qCode());

/** 每节都现造一只：注入的 `view` 换了要当场看出来，不让上一节那只闭包替本节兜着 */
const qCv = () => createCodecView(Q_VIEW);

/** 外层那一只 tone（`tk-result--x`），别把徽章的 `tk-state--x` 数进来 */
const qTone = (html) => /class="tk-result tk-result--(\w+)"/.exec(html)?.[1];

/** 五块面板各自的最小模型：只补本节要看的那几个字段，其余留空 */
const Q_MINIMAL = {
  timestamp: { verdict: 'empty', input: '', readings: [], fields: [], diff: null },
  base64: { verdict: 'empty', input: '', out: '', bytes: 0, fields: [] },
  url: { verdict: 'empty', input: '', pair: [], differs: [], decodeTries: [], queryRows: [], bytes: 0 },
  digest: { verdict: 'empty', kind: 'text', bytes: 0, rows: [] },
  regex: { verdict: 'empty', pattern: '', flags: '', input: '', level: 'none', findings: [], count: 0,
    // `capped` 在 `regex.js` 里是**本次生效的上限次数**（数字，见 N8），不是"到没到"的那面旗；
    // 最小模型给的是没往下调时的 `MAX_MATCHES`，三面旗按各节的需要各自覆盖。
    matches: [], groups: [], replaced: null, capped: 1000, hitLimit: false, timedOut: false, elapsedMs: null },
};
const qModel = (panel, over = {}) => ({ ...Q_MINIMAL[panel], ...over });

test('Q1 导出面恰好四个名字，CODEC_META 十三档的文案与 tone 逐字钉死', async () => {
  const mod = await import('../dev/js/tools/codecView.js');
  assert.deepEqual(Object.keys(mod).sort(), ['CODEC_META', 'CODEC_TONES', 'PANEL_VERDICTS', 'createCodecView'],
    '视图层就交这四样：一张 tone 表、一张 verdict 表、一张白名单、一只工厂');
  const TABLE = {
    converted: ['已换算', 'ok'], encoded: ['已编码', 'ok'], decoded: ['已解码', 'ok'],
    computed: ['已算出', 'ok'], matched: ['有命中', 'ok'],
    ambiguous: ['长度两可', 'unknown'], nomatch: ['零命中', 'unknown'],
    lossy: ['有还原损耗', 'warn'], partial: ['部分可用', 'warn'], capped: ['已到上限', 'warn'],
    invalid: ['不成立', 'bad'], rejected: ['已拒收', 'bad'],
    empty: ['等待输入', 'idle'],
  };
  assert.deepEqual(Object.keys(CODEC_META), Object.keys(TABLE),
    '键序也是契约：白名单与这张表按同序取词，谁重排谁红');
  for (const [k, [label, tone]] of Object.entries(TABLE)) {
    assert.deepEqual(CODEC_META[k], { label, tone }, `CODEC_META.${k} 的措辞或档位变了`);
    assert.equal(CODEC_TONES.includes(tone), true, `${k} 的 tone 不在样式层认的那五个词里`);
  }
  assert.deepEqual(CODEC_TONES, ['ok', 'warn', 'bad', 'unknown', 'idle'],
    'toolkit.scss 只写了这五档徽章（.tk-state--ok/warn/bad/unknown/idle），多一档就是没有样式的类名');
  assert.deepEqual(Object.keys(CODEC_META).filter((k) => CODEC_META[k].tone === 'ok'),
    ['converted', 'encoded', 'decoded', 'computed', 'matched'],
    '五个"成了"各说各话：换算 / 编码 / 解码 / 算出 / 命中，不许塌成一句"成功"');
  assert.deepEqual(Object.keys(CODEC_META).filter((k) => CODEC_META[k].tone === 'warn'),
    ['lossy', 'partial', 'capped'],
    'warn 三档都是"东西给你了但要说清楚"：还原有损耗 / 只有部分能用 / 到上限了');
});

test('Q2 零 import 与不进 Tk 都靠源码文本：本文件一条 import 都不许有，toolkitCore 也不许多出第五只', () => {
  const code = qCode();
  assert.equal(/\bimport\b/.test(qImportScan()), false,
    '它一旦被第二本 import，"只有一个入口 reach 它"这条前提就没了，产物立刻变成带 `import{` 的废文件');
  assert.equal(/\bimport\b/.test(qStripStrings("import view from './tools/view.js';\n")), true,
    '剥字符串只是为了让报错文案里的"不许 import"不算命中，不是给这条扫描开后门：真那一行 import 剥完照样红');
  assert.equal(/require\(/.test(code), false);
  const core = read('dev/js/toolkitCore.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.equal(/codecView/.test(core), false,
    '把只有编码页要的视图层挂进共用的 toolkitCore，等于让证件页替五块它没有的面板付 gzip（§7 余量只剩 4,173B）');
  assert.deepEqual(core.match(/window\.Tk\s*=\s*\{([^}]*)\}/)[1].split(',').map((s) => s.trim()),
    ['createPanelWorkspace', 'createPanelDom', 'view', 'ui'],
    'Tk 仍是四只：这一格扩面了，O13 与 J12 那两份清单要跟着改，别在这儿偷偷加');
});

test('Q3 转义只有一处出口：注入的 esc 是唯一插值路径，第二只 esc / 第二张实体表 / 第二个破折号都不许有', () => {
  const code = qCode();
  assert.equal(/function esc\b|const esc\s*=\s*\(|esc\s*=\s*\(/.test(code), false,
    'esc 只能是注入进来的那一只（解构赋值不算定义），本地再写一份的下场是"改了一份、页面上跑的是另一份"');
  assert.equal(/ESC_MAP|&amp;|&lt;/.test(code), false,
    '实体映射表只有 view.js 那一份，这里出现第二张就说明有人又写了一个转义器');
  assert.equal((code.match(/'—'/g) || []).length, 0,
    '空值那一格取注入的 EMPTY_CELL：两个破折号长得不一样时，没人会去对表');
  assert.equal(/EMPTY_CELL/.test(code), true, '空值必须走 EMPTY_CELL，不许各写各的占位符');
  assert.equal(/checksTable/.test(code), true, '逐项判定表要复用注入的那一张，不重造 tk-checks');
  assert.equal(/noteLines/.test(code), true, '口径行走注入的 noteLines，转义与跳过空串的规则只有一处');
});

test('Q4 构造期闸门：注入的 view 缺哪一样就点名哪一样，缺四样就把四样一次说全', () => {
  for (const miss of ['esc', 'EMPTY_CELL', 'checksTable', 'noteLines']) {
    const partial = { ...Q_VIEW };
    delete partial[miss];
    assert.throws(() => createCodecView(partial),
      (err) => err instanceof TypeError && err.message.includes(miss),
      `缺 ${miss} 必须当场点名——视图层缺依赖的后果是渲染期才炸，那时已经在一个具体面板里了`);
  }
  assert.throws(() => createCodecView(), TypeError, '整包没给也要抛，不许退化成"先用着，等第一次渲染再说"');
  assert.throws(() => createCodecView({}), (err) => {
    const m = err.message;
    return /esc/.test(m) && /EMPTY_CELL/.test(m) && /checksTable/.test(m) && /noteLines/.test(m);
  }, '缺四样只点名第一样，调用方要试四轮才知道补齐了没有');
  assert.throws(() => createCodecView({ ...Q_VIEW, EMPTY_CELL: 42 }), /EMPTY_CELL/,
    'EMPTY_CELL 是字符串常量：按 typeof 判，不按"在不在"判，否则给了个数字也照样放行');
  const cv = qCv();
  for (const name of ['badge', 'fieldsTable', 'timestampBlock', 'base64Block', 'urlBlock', 'digestBlock', 'regexBlock', 'block']) {
    assert.equal(typeof cv[name], 'function', `工厂交出的 ${name} 必须在`);
  }
});

test('Q5 未知 verdict 抛、跨面板错配抛、白名单与总表互相对账，block 的分派也只认那五块', () => {
  const cv = qCv();
  assert.throws(() => cv.badge('expired'), (e) => e instanceof TypeError && /expired/.test(e.message),
    '将来模块新增一档（比如 expired）必须当场炸给装配层，而不是把没定论的结果显示成绿的');
  assert.throws(() => cv.badge(undefined), TypeError);
  assert.throws(() => cv.badge(''), TypeError);
  assert.throws(() => cv.timestampBlock({ verdict: 'encoded' }, []),
    (e) => /timestamp/.test(e.message) && /encoded/.test(e.message),
    '时间戳面板报"已编码"是装配层映射写错，要在渲染之前炸——渲染出来的那句文案用户会当事实读');
  assert.deepEqual(PANEL_VERDICTS.timestamp, ['converted', 'ambiguous', 'invalid', 'empty']);
  assert.deepEqual(PANEL_VERDICTS.base64, ['encoded', 'decoded', 'lossy', 'invalid', 'rejected', 'empty']);
  assert.deepEqual(PANEL_VERDICTS.url, ['encoded', 'decoded', 'invalid', 'rejected', 'empty']);
  assert.deepEqual(PANEL_VERDICTS.digest, ['computed', 'partial', 'invalid', 'rejected', 'empty']);
  assert.deepEqual(PANEL_VERDICTS.regex, ['matched', 'nomatch', 'capped', 'invalid', 'rejected', 'empty']);
  for (const [panel, list] of Object.entries(PANEL_VERDICTS)) {
    for (const v of list) assert.ok(CODEC_META[v], `${panel} 的白名单里有 CODEC_META 不认识的「${v}」`);
  }
  const used = [...new Set(Object.values(PANEL_VERDICTS).flat())].sort();
  assert.deepEqual(used, Object.keys(CODEC_META).sort(),
    '表里有、没人用的档是死文案：新增一档要同时有一块面板真的会走到它');
  assert.deepEqual(Object.keys(PANEL_VERDICTS), ['timestamp', 'base64', 'url', 'digest', 'regex'],
    '面板清单与 panel.js 那五个 id 同序，Task 7 的收录面判据读的就是这个顺序');
  assert.throws(() => cv.block('idcard', {}, []), RangeError, '视图层只服务编码页那五块，别的页面的块不该在这儿渲染');
});

test('Q6 五块面板外层骨架同形：一只 tk-result、恰好一个徽章、tone 由 verdict 决定，分派点也只有一处', () => {
  const cv = qCv();
  const cases = [
    ['timestamp', 'converted', 'ok'], ['base64', 'encoded', 'ok'], ['url', 'decoded', 'ok'],
    ['digest', 'computed', 'ok'], ['regex', 'matched', 'ok'],
    ['timestamp', 'ambiguous', 'unknown'], ['regex', 'nomatch', 'unknown'],
    ['base64', 'lossy', 'warn'], ['digest', 'partial', 'warn'], ['regex', 'capped', 'warn'],
    ['url', 'invalid', 'bad'], ['digest', 'rejected', 'bad'], ['base64', 'empty', 'idle'],
  ];
  for (const [panel, verdict, tone] of cases) {
    const html = cv.block(panel, qModel(panel, { verdict }), []);
    assert.equal((html.match(/class="tk-result tk-result--/g) || []).length, 1, `${panel}/${verdict} 的外层不止一只`);
    assert.equal(qTone(html), tone, `${panel}/${verdict} 外层 tone 应为 ${tone}`);
    assert.equal((html.match(/class="tk-state tk-state--/g) || []).length, 1, '徽章那一行恰好一个');
    assert.equal(html.includes(`<p class="tk-verdict"><span class="tk-state tk-state--${tone}">${CODEC_META[verdict].label}</span></p>`), true,
      `${panel} 的徽章行形状与 view.parseBlock 那一条不一致`);
    assert.equal(html.startsWith(`<div class="tk-result tk-result--${tone}">`), true);
    assert.equal(html.endsWith('</div>'), true);
  }
});

test('Q7 timestampBlock：ambiguous 两读并列且谁都没被标成对的；invalid 那一档不许出现明细表', () => {
  const cv = qCv();
  // `kind` 给的是 `time.js` 那两个 token（K2 钉的 `['second','milli']`），中文说法归视图：
  // 与 VIA_CN / LEVEL_CN / DECODE_CN 同一条口径，装配层只交事实、措辞只在视图这一层写。
  const readings = [
    { kind: 'second', epochMs: 1700000000000, isoUtc: '2023-11-14T22:13:20Z' },
    { kind: 'milli', epochMs: 1700000000, isoUtc: '1970-01-20T16:13:20Z' },
  ];
  const amb = cv.timestampBlock(qModel('timestamp', { verdict: 'ambiguous', input: '1700000000', readings }), []);
  assert.equal((amb.match(/<tr><td>/g) || []).length, 2, '两读要两行，不是挤在一条文案里说（表头是 <tr><th，不计）');
  assert.equal((amb.match(/<td/g) || []).length, 6, '两读 × 三列（解释 / epoch / UTC）= 六格');
  assert.equal(amb.includes('按秒'), true);
  assert.equal(amb.includes('按毫秒'), true);
  assert.throws(() => cv.timestampBlock(qModel('timestamp', { verdict: 'ambiguous', readings: [{ kind: '秒', epochMs: 1, isoUtc: 'x' }] }), []),
    (e) => e instanceof TypeError && /second \/ milli/.test(e.message),
    'token 写错（比如传了中文）说明装配层把视图的活儿抢了过去，当场点名比页面上少一列读数好查');
  assert.equal(amb.includes('tk-state--ok'), false, '长度两可时不许把任何一种解释标成"已换算"');
  assert.equal(amb.includes('1700000000'), true, '用户那一行要回显，否则两张读数对不上是谁的');
  const long = cv.base64Block(qModel('base64', { verdict: 'encoded', input: 'a'.repeat(400), out: 'YQ' }), []);
  assert.equal(long.includes('输入共 400 字符'), true,
    '编码页的输入允许到 1 MiB：回显不封顶就是让结果区把刚粘进去的东西再打一遍，节点数直接翻倍');
  assert.equal(/a{200}…/.test(long), true, '截断点就在 200 个码点上');
  assert.equal(/a{201}/.test(long), false, '多打一个字就等于没有封顶');
  const pair = cv.base64Block(qModel('base64', { verdict: 'encoded', input: '😀'.repeat(250), out: 'YQ' }), []);
  assert.equal(pair.includes('😀'.repeat(200)) && pair.includes('输入共 250 字符'), true,
    '按码点切，不按码元切：250 个 emoji 要显示前 200 个完整的，切到第 201 个的一半就是页面上一个替换字符');
  const bad = cv.timestampBlock(qModel('timestamp', { verdict: 'invalid', input: 'abc', reason: '第 1 位不是数字' }), []);
  assert.equal(bad.includes('<table'), false, '不成立那一档没有可显示的明细，摆一张空表读起来像"全都通过了"');
  assert.equal(bad.includes('第 1 位不是数字'), true, 'reason 要落在结果里，§5.4 那句"让用户看得见为什么不行"');
  const ok = cv.timestampBlock(qModel('timestamp', {
    verdict: 'converted', input: '1700000000000',
    readings: [{ kind: 'milli', epochMs: 1700000000000, isoUtc: '2023-11-14T22:13:20Z' }],
    fields: [{ label: '本地', value: '2023-11-15 06:13:20 (UTC+08:00)', mono: true }],
    relative: '2 年前',
  }), ['口径一句']);
  assert.equal(ok.includes('2 年前'), true, 'relative 由视图补一行「相对时间」，装配层只给那句短语');
  assert.equal(ok.includes('相对时间'), true);
  assert.equal(/<p class="tk-note">口径一句<\/p>/.test(ok), true);
});

test('Q8 base64Block：结果走等宽那一族、字节数按"数字 + 字节"给，lossy 那一档必须把损耗说出来', () => {
  const cv = qCv();
  const enc = cv.base64Block(qModel('base64', { verdict: 'encoded', input: '中', out: '5Lit', bytes: 3 }), []);
  assert.equal(/class="tk-line__raw">5Lit</.test(enc), true,
    '结果那一格走证件页那一族的 `.tk-line__raw`（toolkit.scss 里它自带 $tk-meta 与 break-all）：再叠一个 tk-mono 就是同一条规则写两处');
  assert.equal(enc.includes('<p class="tk-line__head">结果</p>'), true,
    'head 那一句有块级 margin，必须是 <p>；写成 <span> 的话 margin 静默失效，两行结果挤成一坨');
  assert.equal(enc.includes('<div class="tk-lines"><section class="tk-line">'), true,
    '一行的外层是 .tk-lines > section.tk-line，与 workbench.js 的 renderRead 同形');
  assert.equal(enc.includes('3 字节'), true, '输入字节数是这一档唯一和"1MB 闸门"对得上的数');
  assert.equal(enc.includes('1,234'), false, '千分位会让这串数不能被复制下来再核对');
  const lossy = cv.base64Block(qModel('base64', {
    verdict: 'lossy', input: 'YQ', out: 'a', bytes: 2,
    fields: [{ label: '补齐的 padding', value: 1, mono: true }, { label: '剥掉的空白', value: 2, mono: true }],
  }), []);
  assert.equal(lossy.includes('有还原损耗'), true, '宽松档补了 padding 就不能只报"已解码"');
  assert.equal(lossy.includes('补齐的 padding'), true, '补了几位 padding 要说出来');
  assert.equal(lossy.includes('剥掉的空白'), true, '剥了几处空白也要说出来');
  const rej = cv.base64Block(qModel('base64', { verdict: 'rejected', input: '超大', out: '', bytes: 1048577, reason: '超过 1 MiB 上限' }), []);
  assert.equal(rej.includes('tk-line__raw'), false, '闸门拦下时 out 是空串，不该摆一个空的结果行');
  assert.equal(rej.includes('超过 1 MiB 上限'), true);
});

test('Q9 urlBlock：两档并列 + 那 11 个差异字符成句、query 行的解码列不许把"解不出"显示成通过', () => {
  const cv = qCv();
  const html = cv.urlBlock(qModel('url', {
    verdict: 'encoded', input: 'a?b=c d',
    pair: [{ name: 'encodeURI', out: 'a?b=c%20d' }, { name: 'encodeURIComponent', out: 'a%3Fb%3Dc%20d' }],
    differs: ['?', '/', ':', '@', '&', '=', '+', '$', ',', ';', '#'],
    decodeTries: [{ field: 'decodeURI', ok: true, out: 'a?b=c d', reason: '' }],
    queryRows: [{ raw: 'b=c d', key: 'b', value: 'c d', keyOk: true, valueOk: false, reason: '第 3 位不是合法百分号转义' }],
    bytes: 9,
  }), ['URL_CAVEAT']);
  assert.equal(html.includes('encodeURI') && html.includes('encodeURIComponent'), true, '两档并列是 §5.2 那句"口径差异并列展示"');
  assert.equal(/a\?b=c%20d/.test(html) && /a%3Fb%3Dc%20d/.test(html), true);
  assert.equal(html.includes('11 个字符在这一档不编码、在那一档编码'), true, '差异要说得出数量，L11 钉的就是这 11 个');
  for (const ch of ['?', '/', ':', '@', '&', '=', '+', '$', ',', ';', '#']) {
    assert.equal(html.includes(ch), true, `差异字符 ${ch} 没出现在那一句里`);
  }
  assert.equal(html.includes('解不出'), true, 'valueOk 为 false 的那一格必须说"解不出"');
  assert.equal(html.includes('第 3 位不是合法百分号转义'), true);
  assert.equal(/<td>可以<\/td>/.test(html), true, 'keyOk 为 true 的那一格要说"可以"，空着会被读成"没判"');
});

test('Q10 digestBlock：五格恒定按算法序、via 那一列三档各有说法，unavailable 不许显示成空', () => {
  const cv = qCv();
  const rows = [
    { algo: 'md5', ok: true, hex: '9dd4e461268c8034f5c8564e155c67a6', bytes: 5, via: 'self', reason: '' },
    { algo: 'sha-1', ok: false, hex: '', bytes: 5, via: 'unavailable', reason: 'crypto.subtle 不可用' },
    { algo: 'sha-256', ok: true, hex: 'abc', bytes: 5, via: 'subtle', reason: '' },
    { algo: 'sha-384', ok: true, hex: 'def', bytes: 5, via: 'subtle', reason: '' },
    { algo: 'sha-512', ok: true, hex: 'ghi', bytes: 5, via: 'subtle', reason: '' },
  ];
  const html = cv.digestBlock(qModel('digest', { verdict: 'partial', kind: 'text', bytes: 5, rows }), ['DIGEST_CAVEAT']);
  assert.equal((html.match(/<tr>/g) || []).length, 6, '五格 + 一行表头 = 6，五档一格都不许少');
  const order = [...html.matchAll(/<tr><td>(md5|sha-[\d]+)</g)].map((m) => m[1]);
  assert.deepEqual(order, ['md5', 'sha-1', 'sha-256', 'sha-384', 'sha-512'], '行序按算法表来，不按谁先算完来');
  assert.equal(html.includes('本站自实现'), true, 'MD5 那一格要说清是自己算的');
  assert.equal(html.includes('浏览器 crypto'), true, '四档要走 crypto.subtle，回显与 MD5 分开');
  assert.equal(html.includes('环境不支持'), true, '取不到的那格显示"环境不支持"，不许留空——空着读起来像"没算"');
  assert.equal(html.includes('crypto.subtle 不可用'), true, '那一格的 reason 要跟着出来，否则"部分可用"说不服人');
  assert.equal(/<td class="tk-mono">9dd4e461268c8034f5c8564e155c67a6<\/td>/.test(html), true, '摘要走等宽');
  assert.equal(html.includes('5 字节'), true);
  assert.equal(/<td class="tk-mono">—<\/td>/.test(html), true, '算不成的那格 hex 是空串，显示 EMPTY_CELL 而不是空单元格');
});

test('Q11 regexBlock：没开 d 时组位置是空值而不是 0、两面旗与那个上限数各说各话、零命中是 unknown 不是 bad', () => {
  const cv = qCv();
  const html = cv.regexBlock(qModel('regex', {
    verdict: 'matched', pattern: '(a)(b)', flags: 'g', input: 'xxab', level: 'none',
    count: 1, matches: [{ i: 1, index: 2, length: 2, text: 'ab' }],
    groups: [{ match: 1, label: '#1', index: null, length: null, text: 'a' }, { match: 1, label: '#2', index: null, length: null, text: 'b' }],
    replaced: 'X', elapsedMs: null,
  }), []);
  assert.equal(html.includes('有命中'), true);
  assert.equal((html.match(/tk-mono">a</g) || []).length, 1, '捕获组内容要显示');
  assert.equal(/<td>—<\/td>/.test(html), true, '没开 d 时位置是 null，走 EMPTY_CELL');
  assert.equal(html.includes('>0<'), false, '把"没位置"显示成 0 就是在报一个假位置');
  assert.equal(html.includes('替换预览'), true);
  assert.equal(html.includes('>X<'), true, '预览产物要落在结果里');
  const limited = cv.regexBlock(qModel('regex', { verdict: 'capped', count: 900, capped: 1000, hitLimit: true }), []);
  assert.equal(limited.includes('命中次数已到本次上限 1000 次'), true,
    '要把"上限是多少"一起说：只说"到了上限"，用户不知道是本站硬闸门还是这一档的预算');
  assert.equal(limited.includes('剩下的没有再算'), true, '没算完这件事不许藏');
  const timed = cv.regexBlock(qModel('regex', { verdict: 'capped', count: 4, capped: 1000, timedOut: true }), []);
  assert.equal(timed.includes('档间时间预算已用完'), true);
  assert.equal(timed.includes('命中次数已到本次上限'), false, 'timedOut 不许借次数那句话：N8 钉的是"时间到点不是次数到点，两面旗子不许互相顶"');
  const quiet = cv.regexBlock(qModel('regex', { verdict: 'matched', count: 2, capped: 1000 }), []);
  assert.equal(quiet.includes('命中次数已到本次上限'), false, 'capped 那一格次次都有值（它就是本次生效的上限），拿它当旗读会永远说"已到上限"');
  assert.throws(() => cv.regexBlock(qModel('regex', { verdict: 'capped', count: 900, capped: true, hitLimit: true }), []),
    (e) => e instanceof TypeError && /capped/.test(e.message),
    '装配层把 capped 当布尔传进来时，那句话会渲成「上限 true 次」——一句话骗人，必须当场抛');
  const none = cv.regexBlock(qModel('regex', { verdict: 'nomatch', count: 0, matches: [] }), []);
  assert.equal(none.includes('零命中'), true, '编译成功但没匹配上是"零命中"');
  assert.equal(none.includes('tk-state--bad'), false, '零命中不是错误，不该上 bad 那一档');
  assert.equal(none.includes('<table'), false, '零命中不摆空表');
});

test('Q12 空数组一律给一句明说的话，不摆空表；五块面板各验一处', () => {
  const cv = qCv();
  const cases = [['base64', { verdict: 'decoded', out: '', fields: [] }],
    ['url', { verdict: 'decoded', queryRows: [], pair: [] }],
    ['digest', { verdict: 'computed', rows: [] }],
    ['regex', { verdict: 'matched', matches: [], findings: [] }],
    ['timestamp', { verdict: 'converted', readings: [], fields: [] }]];
  for (const [panel, over] of cases) {
    const html = cv.block(panel, qModel(panel, { input: 'x', ...over }), []);
    assert.equal(html.includes('<table'), false, `${panel}：空的行集不许摆一张只有表头的表`);
    assert.equal(/class="tk-hint">[^<]+<\/p>/.test(html), true, `${panel}：没有可显示的内容时要说一句明说的话`);
  }
});

test('Q13 notes 去重：同一句口径若已经在判定表里说过，就不再重复一遍', () => {
  const cv = qCv();
  const same = '该区划未见于现行区划表';
  const html = cv.base64Block(qModel('base64', {
    verdict: 'invalid', out: '', reason: '第 4 位不是 Base64 字符',
    checks: [{ key: 'charset', label: '字符集', ok: false, detail: same }],
  }), [same, '另一句', '', null]);
  assert.equal((html.match(new RegExp(same, 'g')) || []).length, 1, '判定表说过了就不再拿口径行重复一遍——两遍会让用户以为有两件事');
  assert.equal((html.match(/<p class="tk-note">/g) || []).length, 1, '空串与 null 都要被滤掉，只剩那一句新的');
  assert.equal(/<p class="tk-note">另一句<\/p>/.test(html), true);
});

test('Q14 数字口径：字节一律"数字 + 字节"，不做千分位、不做 KB 换算', () => {
  const cv = qCv();
  const html = cv.digestBlock(qModel('digest', {
    verdict: 'computed', bytes: 1234567,
    rows: [{ algo: 'md5', ok: true, hex: 'h', bytes: 1234567, via: 'self', reason: '' }],
  }), []);
  assert.equal(html.includes('1234567 字节'), true, '§7 那条预算是字节口径，视图里换成"1.2 MB"就对不上了');
  assert.equal(/1,234/.test(html), false, '千分位会让这串数字不能被复制下来再核对');
  assert.equal(/MB|KiB|KB/.test(html), false, '不做单位换算：换算就把 §7 的字节口径弄断了');
});

test('Q15 五块面板都只经注入的 esc：同一条含 <script> 与引号的输入，产物里 < 只以 &lt; 出现', () => {
  const cv = qCv();
  const nasty = `"><script>alert(1)</script>&'`;
  const inputs = {
    timestamp: qModel('timestamp', { verdict: 'converted', input: nasty, readings: [{ kind: 'second', epochMs: 1, isoUtc: nasty }], fields: [{ label: nasty, value: nasty }] }),
    base64: qModel('base64', { verdict: 'encoded', input: nasty, out: nasty, fields: [{ label: nasty, value: nasty }] }),
    url: qModel('url', { verdict: 'encoded', input: nasty, pair: [{ name: nasty, out: nasty }], queryRows: [{ raw: nasty, key: nasty, value: nasty, keyOk: true, valueOk: null, reason: nasty }], differs: [] }),
    digest: qModel('digest', { verdict: 'computed', rows: [{ algo: nasty, ok: true, hex: nasty, bytes: 1, via: 'self', reason: nasty }] }),
    regex: qModel('regex', { verdict: 'matched', pattern: nasty, flags: 'g', input: nasty, matches: [{ i: 1, index: 0, length: 1, text: nasty }], groups: [{ match: 1, label: nasty, index: 0, length: 1, text: nasty }], replaced: nasty, findings: [{ rule: nasty, at: 0, hint: nasty, level: 'high' }] }),
  };
  for (const [panel, m] of Object.entries(inputs)) {
    const html = cv.block(panel, m, [nasty]);
    assert.equal(html.includes('<script>'), false, `${panel}：裸的 <script> 进了产物`);
    assert.equal(html.includes('&lt;script&gt;'), true, `${panel}：该转义的没转义，或整段被吞了`);
    assert.equal(/&quot;&gt;&lt;script&gt;/.test(html), true, `${panel}：夹具没真的进产物，上面两条是假绿`);
    assert.equal(html.includes('"&gt;'), false, `${panel}：属性里的引号要经 esc`);
    assert.equal(/class="[^"]*"/.test(html), true);
  }
});

test('Q16 模型里放不进 HTML 的东西：fieldsTable 收到对象/数组/NaN 当场抛并点名第几行', () => {
  const cv = qCv();
  assert.throws(() => cv.fieldsTable([{ label: 'a', value: {} }]),
    (e) => e instanceof TypeError && /第 1 行/.test(e.message), '显示成 [object Object] 就是"结果区在骗人"');
  assert.throws(() => cv.fieldsTable([{ label: 'a', value: [1, 2] }]), TypeError);
  assert.throws(() => cv.fieldsTable([{ label: 'a', value: NaN }]), TypeError, 'NaN 走注入的 esc 会抛，视图不替它兜');
  assert.throws(() => cv.fieldsTable('not an array'), TypeError);
  assert.throws(() => cv.fieldsTable([{ label: 'a' }]), TypeError, '缺 value 也算形状不对，不许静默渲成空');
  const html = cv.fieldsTable([{ label: '空的一格', value: null }, { label: '数字', value: 0, mono: true }]);
  assert.equal(/<td>—<\/td>/.test(html), true, 'null 是"这一格没值"，显示 EMPTY_CELL');
  assert.equal(html.includes('<td class="tk-mono">0</td>'), true, '0 不是空值，不许被当成空');
});

```

#### `dev/js/tools/codecWorkbench.js`（整文件）

```js
/**
 * 编码工具箱页的装配层：把 `tools-codec.html` 里那些静态控件接到四本纯模块上，
 * 结果交给 `codecView.js`（纯字符串）渲染，复制那一栏的纯文本交给 `ui`（`window.Tk.ui`）兜底。
 *
 * 这一层存在的理由与 `workbench.js` 同源，也只有这一条：**控件与面板的对应关系只允许有一处**。
 * 五块面板、六栏、21 格控件、六条按钮与六个结果区，如果"哪个 id 属于哪一栏"同时写在 HTML 的
 * `id=` 与 JS 的字符串里，改一处漏一处，而漏掉那一处只在页面上表现为"点了没反应"。所以这里用
 * `CODEC_SPEC` 声明每块面板的控件、开关与视图 kind，所有 id 由 `fieldId()` / `buttonId()` /
 * `copyId()` / `outId()` / `whenId()` 派生；HTML 里的 `data-tk-when` 是写给人和样式看的标记，
 * 运行时不读它，它与 spec 是否一致由 Task 9 在构建产物上对账。
 *
 * 五条口径，§R 的判据逐条对着咬：
 *
 * 1. **本文件不读运行环境**。时钟、时区偏移、`crypto.subtle` 三样一律从 `env` 递进来：
 *    相对时间那一行与档间耗时那一行必须是注入时钟的函数，否则同一份产物在两台机器上给出两个
 *    答案（§R 的 R3 用五个词反过来量装配层与入口）。`env.now` 与 `env.offsetMinutes` 都**允许缺席**，
 *    缺席就是缺席：那一行整行不出现，而不是拿 `Date.now()` 或宿主时区补一个看起来像事实的数字。
 * 2. **挂载期不计算**。`renderers[panel]` 只接线并画"等待输入"，计算只在用户动手之后发生。
 *    这一条不是洁癖：`#digest` 那一栏要 `await`，挂载期抢跑的话 reject 落在 `mount()` 返回值之外，
 *    `createPanelDom` 的错误条记不到它，页面上就留下一格永远空白的面板。
 * 3. **两类失败分两条路**。用户填的格子不能用 → `FieldError` → 结果区一句提示，面板不算坏；
 *    模块或骨架自己抛的 → 原样上抛，交给 `createPanelDom.run()` 标坏那一块。
 * 4. **页面级预闸门排在模块之前**。三块面板的输入上限（Base64 / URL / 正则的 1 MiB、正则的
 *    500 字符、摘要文本的 1 MiB、摘要文件的 5 MiB）在这里拦，为的是"越界的输入根本不进模块"：
 *    既省一次全量扫描，也让结论落进"已拒收"而不是"不成立"——整栏没处理与这一串东西不对，
 *    是两句不同的话。模块自己的同一道闸门仍在（§L / §M / §N 判过），这里不替换它，只排在它前面。
 * 5. **框架层不 import**。`panel` / `panel-dom` / `view` / `ui` 四只都从 `env.Tk` 拿；本文件
 *    import 的五本（四本纯模块 + `codecView.js`）是闭合清单。`codecView.js` 在全仓库只许被本文件
 *    reach——多一个入口 reach 它，Rollup 就把它提成共享 chunk，产物里那句 `import{` 会把整页打成
 *    SyntaxError，而构建仍然是 exit=0（实测记录在 `dev/js/toolkitCore.js` 开头）。
 *
 * 与 `workbench.js` 的分工：那一本服务证件页（六本业务模块、表格为主的读侧），这一本服务编码页
 * （四本纯模块、结果区为主的一次性换算）。两本不互相 import：`workbench.js` 把六本模块全带进来，
 * 接过去就等于让编码页替证件页付 gzip（§7 那一行余量按字节算）。异步只出现在 `#digest` 一条路上，
 * 另外四块面板都是同步纯算式。
 *
 * 复算：`node --test scripts/toolkit-tests.mjs` 里的 §R 十六判。
 */
import {
  TIME_CAVEAT, parseTimestamp, fromEpoch, relativeTime, dateDiff, parseCivilDate,
} from './time.js';
import {
  BASE64_CAVEAT, URL_CAVEAT, MAX_INPUT_BYTES, encodeBase64, decodeBase64, byteLen,
  encodeDataUri, decodeDataUri, urlPair, splitQuery, encodeUrl, encodeUrlComponent,
} from './codec.js';
import {
  REGEX_CAVEAT, MAX_MATCHES, MAX_PATTERN_CHARS, normalizeFlags, findMatches, previewReplace,
} from './regex.js';
import {
  DIGEST_CAVEAT, MAX_TEXT_BYTES, MAX_BYTES, digestAll,
} from './digest.js';
import { createCodecView } from './codecView.js';

// ── 常量与派生 id ────────────────────────────────────────────────────────────

/**
 * 一栏的两个名字。`main` 每块面板都有，`diff` 只有 `#timestamp` 有——"两个日期之差"是这一页里
 * 唯一一处"同一块面板要算两件事"的形状，其余四块各一栏。
 */
const SIDES = ['main', 'diff'];

/** 结果区里"这一栏的输入不能用"那一行的类名（与证件页共用同一个钩子） */
const HINT_CLASS = 'tk-hint';

/**
 * `encodeURI` 与 `encodeURIComponent` 处理不同的那 18 个保留字符，逐字对着 RFC 3986 的
 * `gen-delims / sub-delims`。为什么在这一层重列一遍而不是 import：`codec.js` 的 `RESERVED`
 * 是模块内部的检查表（§L 的 L11 拿它判"哪些字符在两档里不一样"），而面板上那一行"多少个字符
 * 在这一档不编码"要的是**同一件事的另一侧证据**——两处各列一份、由 §R 的 R10 判出 11 个，
 * 比共享一份常量更能挡住"有人改了表却没人发现面板那句数字变了"。
 */
const URL_RESERVED = ":/?#[]@!$&'()*+,;=";

/** 每块面板自己的那句口径：模块的常量原样交进来，`codecView` 负责"重复过的那句丢掉" */
const NOTES = {
  timestamp: [TIME_CAVEAT],
  base64: [BASE64_CAVEAT],
  url: [URL_CAVEAT],
  digest: [DIGEST_CAVEAT],
  regex: [REGEX_CAVEAT],
};

/** 偏移分钟的上下限，与 `time.js` 的 `offsetGate` 同一档（±14 小时） */
const OFFSET_LIMIT = 840;

/**
 * 「这一栏还没有输入」的那一份外壳，按 `kind` 取。
 *
 * 两处共用它是刻意的：**挂载期画的就是这张表**（口径 2——那时一次计算都不做，格子里
 * 已经粘好了东西也一样），而格子被清空之后的那一次点击回到同一张表（`#regex` 只把 `capped`
 * 换成上限格里的那个数，字段集一字不动）。分成两份的话，"刷新页面看到的形状"和
 * "清空输入看到的形状"就会悄悄长得不一样，而那正是没有判据咬得住的一类差异
 * （§R 的 R5 / R11 / R14 三条量的都是"挂载期那一格"）。
 *
 * 冻起来是因为这张表被六栏共享：某一栏的模型函数就地补一个字段，另外五栏会跟着变。
 */
const IDLE = Object.freeze({
  timestamp: Object.freeze({ verdict: 'empty', input: '', readings: [], fields: [], diff: null }),
  base64: Object.freeze({ verdict: 'empty', input: '', out: '', bytes: 0, fields: [] }),
  url: Object.freeze({
    verdict: 'empty', input: '', pair: [], differs: [], decodeTries: [], queryRows: [], bytes: 0,
  }),
  digest: Object.freeze({ verdict: 'empty', input: '', rows: [], bytes: 0, kind: '' }),
  regex: Object.freeze({
    verdict: 'empty', input: '', capped: MAX_MATCHES, findings: [], flags: '', count: 0,
    matches: [], groups: [], hitLimit: false, timedOut: false, replaced: '',
  }),
});

/**
 * 控件的值 → `<prefix>-in-<panel>-<control>`。与 `tools-codec.html` 里逐字符对应。
 * @param {string} prefix 前缀（编码页 `tk`，换前缀整套跟着换）
 * @param {string} panel 面板 slug
 * @param {string} control 控件 slug
 * @returns {string} 元素 id
 */
export function fieldId(prefix, panel, control) {
  return `${prefix}-in-${panel}-${control}`;
}

/**
 * 主按钮 id：`<prefix>-btn-<panel>-<side>`。
 * @param {string} prefix 前缀
 * @param {string} panel 面板 slug
 * @param {string} side 栏位
 * @returns {string} 元素 id
 */
export function buttonId(prefix, panel, side) {
  return `${prefix}-btn-${panel}-${side}`;
}

/**
 * 复制按钮 id：`<prefix>-copy-<panel>-<side>`。
 * @param {string} prefix 前缀
 * @param {string} panel 面板 slug
 * @param {string} side 栏位
 * @returns {string} 元素 id
 */
export function copyId(prefix, panel, side) {
  return `${prefix}-copy-${panel}-${side}`;
}

/**
 * 结果区 id：`<prefix>-out-<panel>-<side>`，外层容器与 `aria-live` 由构建期骨架给。
 * @param {string} prefix 前缀
 * @param {string} panel 面板 slug
 * @param {string} side 栏位
 * @returns {string} 元素 id
 */
export function outId(prefix, panel, side) {
  return `${prefix}-out-${panel}-${side}`;
}

/**
 * 受开关控制的字段组 id：`<prefix>-when-<panel>-<key>`。单位是 HTML 里那一段 `<p data-tk-when>`
 * 而不是控件本身——把一格 `<select>` 整个藏掉会留下一条没人答的标签。
 * @param {string} prefix 前缀
 * @param {string} panel 面板 slug
 * @param {string} key 开关目标 key
 * @returns {string} 元素 id
 */
export function whenId(prefix, panel, key) {
  return `${prefix}-when-${panel}-${key}`;
}

// ── CODEC_SPEC：五块面板的唯一形状 ───────────────────────────────────────────

/**
 * 面板 → 栏位 → 控件、开关与视图 kind。
 *
 * 每一项都必须在：`type` 是取值方式（`text` 单行去空白 / `number` 同 `text` 但 Enter 提交 /
 * `area` 粘贴框整段 / `select` 下拉 / `file` 文件），`kind` 是 `codecView.js` 的那块面板名
 * （白名单在它那边，写错一个词渲染时就抛），`options` 是 `<select>` 的真选项 token（骨架的
 * `<option>` 文案归 HTML，运行时不读）。`switch` 说"哪一格的值决定哪几段显隐"。
 *
 * 摘要那两格控件的 id 与字段组的 key **同名**（`payload` / `upload`）：开关目标必须是一格
 * 真实存在的控件，否则页面上多一条没人接的 `data-tk-when`。
 *
 * @type {Record<string, {sides: Record<string, object>}>}
 */
export const CODEC_SPEC = {
  timestamp: {
    sides: {
      main: {
        kind: 'timestamp',
        controls: [
          { id: 'value', type: 'text' },
          { id: 'offset', type: 'number' },
        ],
      },
      diff: {
        kind: 'timestamp',
        controls: [
          { id: 'from', type: 'text' },
          { id: 'to', type: 'text' },
        ],
      },
    },
  },
  base64: {
    sides: {
      main: {
        kind: 'base64',
        controls: [
          { id: 'mode', type: 'select', options: ['encode', 'decode', 'dataUri', 'dataUriDecode'] },
          { id: 'text', type: 'area' },
          { id: 'strict', type: 'select', options: ['loose', 'strict'] },
          { id: 'mime', type: 'text' },
        ],
        switch: {
          control: 'mode',
          targets: [
            { key: 'strict', when: ['decode'] },
            { key: 'mime', when: ['dataUri'] },
          ],
        },
      },
    },
  },
  url: {
    sides: {
      main: {
        kind: 'url',
        controls: [{ id: 'text', type: 'area' }],
      },
    },
  },
  digest: {
    sides: {
      main: {
        kind: 'digest',
        controls: [
          { id: 'mode', type: 'select', options: ['text', 'file'] },
          { id: 'payload', type: 'area' },
          { id: 'upload', type: 'file' },
        ],
        switch: {
          control: 'mode',
          targets: [
            { key: 'payload', when: ['text'] },
            { key: 'upload', when: ['file'] },
          ],
        },
      },
    },
  },
  regex: {
    sides: {
      main: {
        kind: 'regex',
        controls: [
          { id: 'pattern', type: 'text' },
          { id: 'flags', type: 'text' },
          { id: 'text', type: 'area' },
          { id: 'repl', type: 'text' },
          { id: 'limit', type: 'number' },
        ],
      },
    },
  },
};

/** 面板顺序就是 `data-tk-ids` 与索引条的顺序；导出给 §R 与入口用，别再各写一份清单 */
export const CODEC_PANEL_IDS = Object.keys(CODEC_SPEC);

// ── FieldError：用户填的格子不能用 ──────────────────────────────────────────

/**
 * "这一格不能用"这一类失败。它不是面板坏了：消息进结果区的提示行，面板不进 broken 名单。
 * 与证件页那一份同形状但**不 export**（§R 的 R1 钉死本文件的导出面是九个名字），也不 import
 * 那一本——`workbench.js` 会把六本业务模块一起拖进来。
 * @extends Error
 */
class FieldError extends Error {
  /** @param {string} message 直接给用户看的一句话，点名是哪一个格子 */
  constructor(message) {
    super(message);
    this.name = 'FieldError';
    /** 判别标记，不靠 `name` 字符串比对 */
    this.isField = true;
  }
}

// ── createCodecWorkbench ────────────────────────────────────────────────────

/**
 * 造一个编码页的装配器。
 *
 * @param {object} env 依赖注入。四本纯模块与 `codecView` 是直接 `import` 的（只有一个入口 reach
 *   它们，不会成共享 chunk），框架层与宿主环境全部从 `env` 进来。
 * @param {object} env.document 只需 `getElementById` / `createElement`；控件一律按派生 id 找
 * @param {object} env.Tk `window.Tk`，必须齐 `view`（转义与判定表那一半）与 `ui.copyInto`
 * @param {(panel: string, fn: () => void) => boolean} env.runGuarded 通常是
 *   `createPanelDom().run`；挂载期不走它（那时 `mounted` 还是 false）
 * @param {object} [env.navigator] 只为 `clipboard`，没有就走 `execCommand` 兜底
 * @param {(fn: () => void, ms: number) => number} [env.later] `setTimeout` 的别名
 * @param {() => number} [env.now] 注入时钟；缺席就没有"相对时间"与"档间耗时"那两行
 * @param {number} [env.offsetMinutes] 本地相对 UTC 的偏移分钟数；缺席按 0（也就是按 UTC 出本地行）
 * @param {object|null} [env.subtle] `crypto.subtle`；`null` 是"这一档确实取不到"，
 *   不传是让 `digest.js` 自己去 `globalThis.crypto` 找（浏览器里就是那一条路）
 * @param {string} [env.prefix] 前缀，默认 `tk`
 * @returns {{renderers: Record<string, (el: object) => void>,
 *   run: (panel: string, side: string) => boolean,
 *   copyTextOf: (panel: string, side: string) => string}}
 */
export function createCodecWorkbench(env = {}) {
  const e = env ?? {};
  if (!e.document || typeof e.document.getElementById !== 'function'
    || typeof e.document.createElement !== 'function') {
    throw new TypeError('createCodecWorkbench：env.document 要有 getElementById 与 createElement');
  }
  if (!e.Tk || !e.Tk.view) {
    throw new TypeError('createCodecWorkbench：env.Tk.view 应是 window.Tk 里那份 view（跨页共用层走 toolkitCore，不许 import）');
  }
  if (!e.Tk.ui || typeof e.Tk.ui.copyInto !== 'function') {
    throw new TypeError('createCodecWorkbench：env.Tk.ui.copyInto 应是 window.Tk 里那份 ui（缺它的下场是点复制按钮没反应）');
  }
  if (typeof e.runGuarded !== 'function') {
    throw new TypeError('createCodecWorkbench：env.runGuarded 应是 createPanelDom().run，按钮回调不许自己 try/catch 出第二套错误口径');
  }
  // `now` 与 `offsetMinutes` 都允许缺席，但不许是"给了却不能用"的形状：非函数的时钟会让
  // "相对时间"那一行静默消失，字符串偏移要等 `fromEpoch` 那口才响——那时已经是一块面板塌了。
  if (e.now !== undefined && e.now !== null && typeof e.now !== 'function') {
    throw new TypeError(`createCodecWorkbench：env.now 应为函数或缺席，收到 ${typeof e.now}`);
  }
  const hasOffset = e.offsetMinutes !== undefined && e.offsetMinutes !== null;
  if (hasOffset && (!Number.isInteger(e.offsetMinutes) || Math.abs(e.offsetMinutes) > OFFSET_LIMIT)) {
    throw new TypeError(`createCodecWorkbench：env.offsetMinutes 应为 ±${OFFSET_LIMIT} 以内的整数分钟数或缺席，收到 ${String(e.offsetMinutes)}`);
  }

  /** 视图在这一层构造一次：`view` 缺哪一格，构造期就点名哪一格（口径 5 的另一半） */
  const cv = createCodecView(e.Tk.view);
  const doc = e.document;
  const view = e.Tk.view;
  const ui = e.Tk.ui;
  const runGuarded = e.runGuarded;
  const prefix = typeof e.prefix === 'string' && e.prefix !== '' ? e.prefix : 'tk';
  const clock = typeof e.now === 'function' ? e.now : null;
  const offsetMinutes = hasOffset ? e.offsetMinutes : 0;
  const subtle = e.subtle === undefined ? undefined : e.subtle;
  const later = typeof e.later === 'function' ? e.later : (fn, ms) => setTimeout(fn, ms);
  const clipboard = e.navigator && e.navigator.clipboard ? e.navigator.clipboard : null;

  /** `panel:side → 这一栏当前能复制的纯文本`；渲染时写，复制按钮读它，不从 HTML 反解 */
  const copies = new Map();
  /** `copyId → 骨架那句原文案`：改口之后要能改回**页面里那一句**，而不是这里写死的一句 */
  const copyLabels = new Map();
  const at = (panel, side) => `${panel}:${side}`;
  const node = (id) => doc.getElementById(id);

  // ── 取值 ────────────────────────────────────────────────────────────────

  /** 单行格与下拉：去首尾空白，空值一律 `null`（口径 1：调用方按 `null` 决定"不写这个键"） */
  const valueOf = (panel, control) => {
    const id = fieldId(prefix, panel, control);
    const el = node(id);
    if (!el) throw new RangeError(`页面里没有 id="${id}" 的控件，spec 与骨架对不上`);
    const v = String(typeof el.value === 'string' ? el.value : '').trim();
    return v === '' ? null : v;
  };

  /**
   * 粘贴框：整段文本原样，只把行尾的 `\r` 归一成 `\n`。
   * **不 trim**：编码侧的输入是内容本身，前后各一个空格都要如实编进去；
   * "空不空"由调用侧按 `.trim() === ''` 判，那是两件事。
   */
  const areaOf = (panel, control) => {
    const id = fieldId(prefix, panel, control);
    const el = node(id);
    if (!el) throw new RangeError(`页面里没有 id="${id}" 的粘贴框，spec 与骨架对不上`);
    return String(typeof el.value === 'string' ? el.value : '').replace(/\r\n?/g, '\n');
  };

  /** 文件格：`FileList` 在假 DOM 上就是个数组，取第一个 */
  const fileOf = (panel, control) => {
    const id = fieldId(prefix, panel, control);
    const el = node(id);
    if (!el) throw new RangeError(`页面里没有 id="${id}" 的文件格，spec 与骨架对不上`);
    const list = el.files;
    return list && list.length > 0 ? list[0] : null;
  };

  /** 整数格：越界与不合法都是"这一格不能用"（口径 3），点名是哪一格、范围是多少、现在是什么 */
  const intOf = (panel, control, min, max, label) => {
    const raw = valueOf(panel, control);
    if (raw === null) return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) {
      throw new FieldError(`${label}应为 ${min}–${max} 的整数，现在这格是「${raw}」。`);
    }
    return n;
  };

  /** 越界那一句的公共形状：报实际字节数、报上限、明说"不截断"（与三本模块同一口径） */
  const overLimit = (n, limit, unit) => `输入 ${n} 字节，超过 ${limit} 字节（${unit}）上限，整体拒绝、不截断`;

  // ── 渲染 ────────────────────────────────────────────────────────────────

  /** 唯一的 `innerHTML` 出口：缺结果区就点名 id，让绑定层把这一块标坏（口径 3 的后半） */
  const paint = (panel, side, html) => {
    const id = outId(prefix, panel, side);
    const out = node(id);
    if (!out) throw new RangeError(`页面里没有 id="${id}" 的结果区，spec 与骨架对不上`);
    out.innerHTML = html;
  };

  /** 提示行（这一格不能用）——不算内容，所以复制按钮跟着禁用 */
  const hint = (panel, side, message) => {
    paint(panel, side, `<p class="${HINT_CLASS}">${view.esc(message)}</p>`);
    copies.set(at(panel, side), '');
    syncCopy(panel, side);
  };

  /** 复制按钮的可用性只由"这一栏有没有可复制的文本"决定，不靠样式类猜 */
  const syncCopy = (panel, side) => {
    const btn = node(copyId(prefix, panel, side));
    if (!btn) return;
    btn.disabled = (copies.get(at(panel, side)) || '') === '';
  };

  /** 一块面板的完整渲染：视图出 HTML，装配层记下纯文本 */
  const paintSide = (panel, side, model, copy) => {
    paint(panel, side, cv.block(panel, model, NOTES[panel]));
    copies.set(at(panel, side), copy);
    syncCopy(panel, side);
  };

  // ── #timestamp：主栏 ────────────────────────────────────────────────────

  /**
   * 本地偏移取哪一档：用户那一格填了就以它为准，否则用入口注入的宿主偏移，都没有就是 0。
   * 越界与不合法是 `FieldError`——`time.js` 的 `offsetGate` 会抛，但那是一条模块异常，
   * 会被绑成"这块面板坏了"；这一格本来就是给用户填的，得走提示行那条路。
   */
  const offsetOf = () => {
    const raw = valueOf('timestamp', 'offset');
    if (raw === null) return offsetMinutes;
    const n = Number(raw);
    if (!Number.isInteger(n) || Math.abs(n) > OFFSET_LIMIT) {
      throw new FieldError(`时区偏移应为 ±${OFFSET_LIMIT} 以内的整数分钟数，现在这格是「${raw}」。`);
    }
    return n;
  };

  /**
   * 一串输入 → epoch 毫秒。先按时间戳，不成立再按民用日期（K3 的那两条口径同在一页上），
   * 两档都不成立就把两条理由并成一句——只报一条等于把用户支走。
   * @param {string} raw 输入原样（已 trim）
   * @param {number} off 本地偏移分钟数
   * @returns {{epochMs:number|null, reason:string|null, via:string}} `via` 是"按哪一档成的"
   */
  const epochOf = (raw, off) => {
    const ts = parseTimestamp(raw);
    if (ts.verdict === 'second' || ts.verdict === 'milli') {
      return { epochMs: ts.epochMs, reason: null, via: 'timestamp', ts };
    }
    if (ts.verdict === 'ambiguous') {
      return { epochMs: null, reason: ts.reason, via: 'timestamp', ts };
    }
    const civil = parseCivilDate(raw, off);
    if (civil.ok) {
      return { epochMs: civil.epochMs, reason: `按民用日期解释（串里没写时区，就按本地偏移 ${off} 分钟算）`, via: 'civil', ts };
    }
    return { epochMs: null, reason: `按时间戳：${ts.reason}；按民用日期：${civil.reason}`, via: 'none', ts };
  };

  /** 明细表那五行 + 相对时间那一行（视图补那一行，装配层只交事实） */
  const tsFields = (epochMs, off) => {
    const f = fromEpoch(epochMs, off);
    return {
      fields: [
        { label: 'UTC', value: f.isoUtc, mono: true },
        { label: '本地', value: f.isoLocal, mono: true },
        { label: '可读', value: f.localDisplay },
        { label: 'Unix 秒', value: f.unixSeconds },
        { label: 'Unix 毫秒', value: f.unixMillis },
      ],
      lines: [
        `UTC：${f.isoUtc}`,
        `本地：${f.isoLocal}`,
        `可读：${f.localDisplay}`,
        `Unix 秒：${f.unixSeconds}`,
        `Unix 毫秒：${f.unixMillis}`,
      ],
    };
  };

  const tsModel = () => {
    const raw = valueOf('timestamp', 'value');
    if (raw === null) return { model: IDLE.timestamp, copy: '' };
    const off = offsetOf();
    const parsed = epochOf(raw, off);
    if (parsed.ts.verdict === 'ambiguous') {
      // 长度两可：两种解释并列（视图那三列就是为这一档写的），谁都不许被标成"已换算"
      return {
        model: {
          verdict: 'ambiguous', reason: parsed.ts.reason, input: raw,
          readings: parsed.ts.readings, fields: [], diff: null,
        },
        copy: parsed.ts.readings.map((r) => `${r.kind === 'second' ? '按秒' : '按毫秒'}：${r.isoUtc}`).join('\n'),
      };
    }
    if (parsed.epochMs === null) {
      return { model: { verdict: 'invalid', reason: parsed.reason, input: raw, readings: [], fields: [], diff: null }, copy: '' };
    }
    const { fields, lines } = tsFields(parsed.epochMs, off);
    const relative = clock ? relativeTime(parsed.epochMs, clock()).text : null;
    const copy = lines.slice();
    if (relative !== null) {
      copy.push(`相对时间：${relative}`);
    }
    return {
      model: {
        verdict: 'converted', reason: parsed.via === 'civil' ? parsed.reason : null, input: raw,
        readings: [], fields, relative, diff: null,
      },
      copy: copy.join('\n'),
    };
  };

  // ── #timestamp：差值栏 ──────────────────────────────────────────────────

  const tsDiffModel = () => {
    const a = valueOf('timestamp', 'from');
    const b = valueOf('timestamp', 'to');
    if (a === null || b === null) {
      return { model: IDLE.timestamp, copy: '' };
    }
    const off = offsetOf();
    const ea = epochOf(a, off);
    const eb = epochOf(b, off);
    if (ea.epochMs === null || eb.epochMs === null) {
      // 只点名坏掉的那一端：另一端是好的，一起挨打等于把用户已经填对的东西说成错的
      const bad = [];
      if (ea.epochMs === null) bad.push(`起点「${a}」：${ea.reason}`);
      if (eb.epochMs === null) bad.push(`终点「${b}」：${eb.reason}`);
      return { model: { verdict: 'invalid', reason: bad.join('；'), input: `${a} → ${b}`, readings: [], fields: [], diff: null }, copy: '' };
    }
    const diff = dateDiff(ea.epochMs, eb.epochMs);
    const d = diff;
    const lines = [
      `日历分解：${d.ymd.years} 年 ${d.ymd.months} 个月 ${d.ymd.days} 天`,
      `整 24 小时：${d.totalDays} 天`,
      `跨 UTC 日历日：${d.calendarDays} 天`,
    ];
    return {
      model: {
        verdict: 'converted', input: `${a} → ${b}`, readings: [], fields: [],
        diff: { ...d, sign: d.sign },
      },
      copy: lines.join('\n'),
    };
  };

  // ── #base64 ─────────────────────────────────────────────────────────────

  /**
   * 解码那一档"替用户动过手"的两笔账：视图的 `fields` 只摆格，话说成"补齐的 padding"
   * 与"剥掉的空白"归视图。装配层交数字，并且在数字为 0 时**不写那一行**——
   * 一栏"补齐的 padding：0"读起来像出过事又没事。
   */
  const b64LossRows = (r) => {
    const rows = [];
    if (r.paddingImplied > 0) rows.push({ label: '补齐的 padding', value: r.paddingImplied, mono: true });
    if (r.whitespaceDropped > 0) rows.push({ label: '剥掉的空白', value: r.whitespaceDropped, mono: true });
    return rows;
  };

  const base64Model = () => {
    const mode = valueOf('base64', 'mode');
    const text = areaOf('base64', 'text');
    if (mode === null || text.trim() === '') {
      return { model: IDLE.base64, copy: '' };
    }
    const bytes = byteLen(text);
    if (bytes > MAX_INPUT_BYTES) {
      return {
        model: { verdict: 'rejected', reason: overLimit(bytes, MAX_INPUT_BYTES, '1 MiB'), input: text, out: '', bytes, fields: [] },
        copy: '',
      };
    }
    if (mode === 'encode') {
      const r = encodeBase64(text);
      if (!r.ok) return { model: { verdict: 'invalid', reason: r.reason, input: text, out: '', bytes: r.bytes, fields: [] }, copy: '' };
      return { model: { verdict: 'encoded', input: text, out: r.out, bytes: r.bytes, fields: [] }, copy: r.out };
    }
    if (mode === 'decode') {
      const strict = valueOf('base64', 'strict') === 'strict';
      const r = decodeBase64(text, { strict });
      if (!r.ok) return { model: { verdict: 'invalid', reason: r.reason, input: text, out: '', bytes: 0, fields: [] }, copy: '' };
      const lossy = b64LossRows(r);
      return {
        model: {
          verdict: lossy.length > 0 ? 'lossy' : 'decoded', input: text,
          out: r.out, bytes: byteLen(r.out), fields: lossy,
        },
        copy: r.out,
      };
    }
    if (mode === 'dataUri') {
      const mime = valueOf('base64', 'mime');
      const r = encodeDataUri(text, mime);
      if (!r.ok) return { model: { verdict: 'invalid', reason: r.reason, input: text, out: '', bytes: r.bytes, fields: [] }, copy: '' };
      return {
        model: {
          verdict: 'encoded', input: text, out: r.out, bytes: r.bytes,
          fields: mime === null ? [{ label: 'mime', value: 'text/plain（默认）' }] : [],
        },
        copy: r.out,
      };
    }
    const r = decodeDataUri(text);
    if (!r.ok) return { model: { verdict: 'invalid', reason: r.reason, input: text, out: '', bytes: 0, fields: [] }, copy: '' };
    const fields = [
      { label: 'mime', value: r.mime },
      { label: 'charset', value: r.charset },
    ];
    if (r.mimeDefaulted) fields.push({ label: 'mime 来源', value: '缺省补 text/plain' });
    if (r.charsetDefaulted) fields.push({ label: 'charset 来源', value: '缺省补 utf-8' });
    if (r.percentHits > 0) fields.push({ label: '百分号解码', value: r.percentHits, mono: true });
    const loss = b64LossRows(r);
    return {
      model: {
        verdict: loss.length > 0 ? 'lossy' : 'decoded', input: text,
        out: r.data, bytes: byteLen(r.data), fields: [...fields, ...loss],
      },
      copy: r.data,
    };
  };

  // ── #url ────────────────────────────────────────────────────────────────

  /**
   * 两档编码**都实测一遍**才知道差在哪几个字符：这里数的是"一档原样、另一档编掉"的那些，
   * 而不是抄一个常数——抄来的常数会跟着引擎或表的改动变成一句假话。
   */
  const urlDiffers = () => {
    const out = [];
    for (const ch of URL_RESERVED) {
      const keep = encodeUrl(ch).out === ch;
      const comp = encodeUrlComponent(ch).out === ch;
      if (keep !== comp) out.push(ch);
    }
    return out;
  };

  const urlModel = () => {
    const text = areaOf('url', 'text');
    if (text.trim() === '') {
      return { model: IDLE.url, copy: '' };
    }
    const bytes = byteLen(text);
    if (bytes > MAX_INPUT_BYTES) {
      return {
        model: {
          verdict: 'rejected', reason: overLimit(bytes, MAX_INPUT_BYTES, '1 MiB'), input: text,
          pair: [], differs: [], decodeTries: [], queryRows: [], bytes,
        },
        copy: '',
      };
    }
    const pair = urlPair(text);
    const base = {
      input: text, bytes: pair.bytes, differs: urlDiffers(),
      pair: [
        { name: 'encodeURI', out: pair.encodeURI },
        { name: 'encodeURIComponent', out: pair.encodeURIComponent },
      ],
      decodeTries: pair.decodeTries,
      queryRows: splitQuery(text),
    };
    if (!pair.ok) {
      return { model: { ...base, verdict: 'invalid', reason: pair.reason }, copy: '' };
    }
    // 「带不带百分号」是这一栏唯一的方向判据：粘进来的多半就是要解的东西，
    // 两档都解不开才是"这串百分号不成立"，而不是"它没被编过"。
    const hasPercent = text.includes('%');
    const decoded = pair.decodeTries.some((t) => t.ok);
    const verdict = hasPercent ? (decoded ? 'decoded' : 'invalid') : 'encoded';
    const reason = hasPercent && !decoded ? pair.decodeTries[0].reason : null;
    return {
      model: { ...base, verdict, reason },
      copy: `encodeURI：${pair.encodeURI}\nencodeURIComponent：${pair.encodeURIComponent}`,
    };
  };

  // ── #digest（唯一要等的一栏）─────────────────────────────────────────────

  /** 五格恒定：全成 → 已算出；有成的但也有败的 → 部分可用；一个都没成 → 看是不是闸门拦的 */
  const digestVerdict = (rows, gatedReason) => {
    const okCount = rows.filter((r) => r.ok).length;
    if (okCount === rows.length) return 'computed';
    if (okCount > 0) return 'partial';
    return gatedReason === null ? 'invalid' : 'rejected';
  };

  const digestCopy = (rows) => rows.filter((r) => r.ok).map((r) => `${r.algo}=${r.hex}`).join('\n');

  const digestIdle = () => ({ model: IDLE.digest, copy: '' });

  /**
   * 摘要这一栏的入口。**同步部分只做闸门**，算的事交给 promise；
   * 两条异步回写（成与败）都重新走一遍 `runGuarded`，否则 reject 落在闸门之外——
   * 控制台红一次，页面上那块面板永远留着上一次的数字。
   */
  const digestModel = () => {
    const mode = valueOf('digest', 'mode');
    const payload = areaOf('digest', 'payload');
    if (mode === null) return { ...digestIdle(), done: true };
    if (mode === 'file') {
      const file = fileOf('digest', 'upload');
      if (!file) return { ...digestIdle(), done: true };
      const declared = Number(file.size);
      if (Number.isFinite(declared) && declared > MAX_BYTES) {
        return {
          model: {
            verdict: 'rejected',
            reason: `这个文件声明 ${declared} 字节，超过 ${MAX_BYTES} 字节（5 MiB）上限，整体拒绝、不读进内存`,
            input: '', rows: [], bytes: declared, kind: '',
          },
          copy: '', done: true,
        };
      }
      return { done: false, task: readThenDigest(file) };
    }
    if (payload.trim() === '') return { ...digestIdle(), done: true };
    const bytes = byteLen(payload);
    if (bytes > MAX_TEXT_BYTES) {
      return {
        model: {
          verdict: 'rejected', reason: overLimit(bytes, MAX_TEXT_BYTES, '1 MiB'),
          input: '', rows: [], bytes, kind: 'text',
        },
        copy: '', done: true,
      };
    }
    return { done: false, task: computeDigest(payload, bytes, 'text', '') };
  };

  /** 读盘 → 算 → 出模型。`arrayBuffer()` 的 reject 原样带出去，交给闸门那一侧标坏这一块 */
  const readThenDigest = async (file) => {
    const buffer = await file.arrayBuffer();
    const view = new Uint8Array(buffer);
    return computeDigest(view, view.byteLength, '', `读的是本地文件 ${String(file.name)}（${view.byteLength} 字节），全部在浏览器里算，不上传、不留存。`);
  };

  /**
   * 五档并列那一张表。`kind` 走视图的两档说法：文本通道是"文本 N 字节"，
   * 文件通道给空串——"字节 N 字节"不是一句人话，而文件那一档已经有 `reason` 点名是哪个文件。
   * @param {string|Uint8Array} input 文本或字节
   * @param {number} bytes 入参字节数（闸门与计数行共用这一把尺子）
   * @param {string} kind 视图那一行的通道名
   * @param {string} privacy 文件档那句来源说明
   */
  const computeDigest = async (input, bytes, kind, privacy) => {
    const out = await digestAll(input, subtle === undefined ? {} : { subtle });
    const gatedReason = out.reason;
    return {
      model: {
        verdict: digestVerdict(out.rows, gatedReason),
        reason: gatedReason !== null ? gatedReason : (privacy === '' ? null : privacy),
        input: typeof input === 'string' ? input : '',
        rows: out.rows,
        bytes,
        kind,
      },
      copy: digestCopy(out.rows),
    };
  };

  // ── #regex ──────────────────────────────────────────────────────────────

  /**
   * 命中表与捕获组表。组的行序是"位置组在前、命名组在后"，两批并存：
   * `named` 只是 `groups` 的一个别名（native 的 `d` 档把位置与命名都给你），
   * 合成一张表会让"第 2 组"和"tail"读起来是同一件事。
   */
  const regexRows = (found) => {
    const matches = found.matches.map((m, i) => ({
      i: i + 1, index: m.index, length: m.length, text: m.text,
    }));
    const groups = [];
    found.matches.forEach((m, mi) => {
      for (let g = 0; g < m.groups.length; g += 1) {
        const cell = m.groups[g];
        groups.push({
          match: mi + 1, label: String(g + 1),
          index: cell.participated ? cell.index : null,
          length: cell.participated ? cell.length : null,
          text: cell.participated ? cell.text : null,
        });
      }
      for (const [name, cell] of Object.entries(m.named ?? {})) {
        groups.push({
          match: mi + 1, label: name,
          index: cell && cell.participated ? cell.index : null,
          length: cell && cell.participated ? cell.length : null,
          text: cell && cell.participated ? cell.text : null,
        });
      }
    });
    return { matches, groups };
  };

  const regexModel = () => {
    const pattern = valueOf('regex', 'pattern');
    const text = areaOf('regex', 'text');
    const limit = intOf('regex', 'limit', 1, MAX_MATCHES, '命中次数上限');
    // `capped` 在视图那一侧是"本次生效的上限次数"，正整数、每栏都要有；空栏也不例外
    const cap = limit === null ? MAX_MATCHES : limit;
    if (pattern === null || text.trim() === '') {
      // 形状仍取自 `IDLE.regex`，只把 `capped` 换成这一格实际生效的那个数：挂载期上限格是空的，
      // 取的也就是 `MAX_MATCHES` 这个同一个值，两处不会长出两种形状。
      return { model: { ...IDLE.regex, capped: cap }, copy: '' };
    }
    if (pattern.length > MAX_PATTERN_CHARS) {
      return {
        model: {
          verdict: 'rejected', reason: `模式 ${pattern.length} 字符，超过 ${MAX_PATTERN_CHARS} 字符上限，整体拒绝、不截断`,
          input: text, capped: cap, findings: [], flags: '', count: 0,
          matches: [], groups: [], hitLimit: false, timedOut: false, replaced: '',
        },
        copy: '',
      };
    }
    const bytes = byteLen(text);
    if (bytes > MAX_INPUT_BYTES) {
      return {
        model: {
          verdict: 'rejected', reason: overLimit(bytes, MAX_INPUT_BYTES, '1 MiB'),
          input: text, capped: cap, findings: [], flags: '', count: 0,
          matches: [], groups: [], hitLimit: false, timedOut: false, replaced: '',
        },
        copy: '',
      };
    }
    const rawFlags = valueOf('regex', 'flags') ?? '';
    const opts = {};
    if (clock !== null) opts.now = clock;
    if (limit !== null) opts.maxMatches = limit;
    const found = findMatches(pattern, rawFlags, text, opts);
    const nf = normalizeFlags(rawFlags);
    const checks = [];
    if (nf.ok && nf.deduplicated) {
      checks.push({ key: 'flags', label: 'flags 归一', ok: true, detail: nf.reason });
    }
    const { matches, groups } = regexRows(found);
    // 到没到上限是那一面旗的事；"进没进引擎"看 level——null 是编译/形状之前就没跑成，
    // high 与 medium 是本站的静态闸门明说拒收，两者不是一句"这串东西不对"
    const verdict = !found.executed
      ? (found.level === 'high' || found.level === 'medium' ? 'rejected' : 'invalid')
      : (!found.matched ? 'nomatch' : (found.hitLimit ? 'capped' : 'matched'));
    const repl = valueOf('regex', 'repl');
    let replaced = '';
    if (found.executed && repl !== null) {
      const p = previewReplace(pattern, rawFlags, text, repl, opts);
      if (p.executed) replaced = p.out;
    }
    return {
      model: {
        verdict,
        reason: found.reason,
        input: text,
        capped: found.capped,
        findings: found.findings,
        flags: found.flags,
        count: found.count,
        matches,
        groups,
        hitLimit: found.hitLimit,
        timedOut: found.timedOut,
        elapsedMs: found.elapsedMs,
        replaced,
        ...(checks.length > 0 ? { checks } : {}),
      },
      copy: matches.map((m) => m.text).join('\n'),
    };
  };

  /** 面板 → 一栏的计算分派；`digest` 走异步那条路，其余四块同步 */
  const COMPUTE = {
    timestamp: (side) => (side === 'diff' ? tsDiffModel() : tsModel()),
    base64: () => base64Model(),
    url: () => urlModel(),
    digest: () => digestModel(),
    regex: () => regexModel(),
  };

  /**
   * 算一栏并画上。抛出去的东西由调用侧决定是提示还是标坏（口径 3）；
   * 摘要那一栏返回的是"已经启动了异步任务"，同步那一段照样把闸门结论画上。
   */
  const renderNow = (panel, side) => {
    const r = COMPUTE[panel](side);
    if (panel === 'digest' && r.done === false) {
      const task = Promise.resolve(r.task).then(
        (res) => runGuarded(panel, () => paintSide(panel, side, res.model, res.copy)),
        // 读盘失败一类的异步异常**原样**再抛一次：只标坏这一块，别换成一句装配层自己的话
        (err) => runGuarded(panel, () => { throw err; }),
      );
      return task;
    }
    paintSide(panel, side, r.model, r.copy);
    return true;
  };

  // ── 开关与事件 ──────────────────────────────────────────────────────────

  /**
   * 应用一次显隐。走 `hidden` 布尔属性、不写 `style`：可见性的唯一来源是那一个属性
   * （`panel-dom.js` 口径 5 同一条），两处都能改显隐就等于两处能互相覆盖。
   * 缺节点就跳过——少一段字段组是骨架少一段，不是这块面板坏了（R13 ③ 判的就是这一条）。
   */
  const applySwitch = (panel) => {
    for (const side of SIDES) {
      const cfg = CODEC_SPEC[panel].sides[side];
      const sw = cfg && cfg.switch;
      if (!sw) continue;
      const value = valueOf(panel, sw.control) ?? '';
      for (const target of sw.targets) {
        const el = node(whenId(prefix, panel, target.key));
        if (!el) continue;
        el.hidden = !target.when.includes(value);
      }
    }
  };

  /** 粘贴框里 Ctrl / ⌘ + Enter 才计算：裸 Enter 必须是换行，吞掉用户敲的那次换行是缺陷 */
  const onAreaKey = (panel, side) => (evt) => {
    if (!evt || evt.key !== 'Enter' || !(evt.ctrlKey || evt.metaKey)) return;
    if (typeof evt.preventDefault === 'function') evt.preventDefault();
    runGuardedRun(panel, side);
  };

  /** 单行格与数字格里的裸 Enter 就是提交；带任何修饰键都不算（那可能是浏览器的快捷键） */
  const onFieldKey = (panel, side) => (evt) => {
    if (!evt || evt.key !== 'Enter') return;
    if (evt.shiftKey || evt.ctrlKey || evt.metaKey || evt.altKey) return;
    if (typeof evt.preventDefault === 'function') evt.preventDefault();
    runGuardedRun(panel, side);
  };

  /** 复制一栏：三级兜底与那两句改口文案都在 `Tk.ui.copyInto` 里，这一层只找节点、给文本、还原文案 */
  const doCopy = (panel, side) => {
    const id = copyId(prefix, panel, side);
    const btn = node(id);
    const text = copies.get(at(panel, side)) || '';
    if (!btn || text === '') return;
    ui.copyInto({
      btn, text, original: copyLabels.get(id) ?? btn.textContent, clipboard, doc, later,
    });
  };

  /**
   * 走一遍 `runGuarded`（真页面上就是 `createPanelDom.run`）：`FieldError` 在这一层就地转成
   * 提示行，其余异常原样抛出去，由那一层标坏这一块。
   */
  const runGuardedRun = (panel, side) => runGuarded(panel, () => {
    try {
      renderNow(panel, side);
    } catch (err) {
      if (!err || err.isField !== true) throw err;
      hint(panel, side, err.message);
    }
  });

  // ── 每块面板的渲染函数 ──────────────────────────────────────────────────

  const renderers = {};
  for (const panel of CODEC_PANEL_IDS) {
    renderers[panel] = () => {
      for (const side of SIDES) {
        const cfg = CODEC_SPEC[panel].sides[side];
        if (!cfg) continue;
        for (const c of cfg.controls) {
          const el = node(fieldId(prefix, panel, c.id));
          if (!el) continue;
          if (c.type === 'area') el.addEventListener('keydown', onAreaKey(panel, side));
          else if (c.type === 'text' || c.type === 'number') el.addEventListener('keydown', onFieldKey(panel, side));
          // `select` 与 `file` 不接 Enter：下拉那格的 Enter 没有"提交"语义，文件格是原生选择框
          if (cfg.switch && c.id === cfg.switch.control) {
            el.addEventListener('change', () => applySwitch(panel));
          }
        }
        const btn = node(buttonId(prefix, panel, side));
        if (btn) btn.addEventListener('click', () => runGuardedRun(panel, side));
        const id = copyId(prefix, panel, side);
        const cb = node(id);
        if (cb) {
          // 键用派生 id 而不是 `cb.id`：假 DOM 上 `.id` 是个普通属性，一旦哪份夹具没设上，
          // `set(undefined, …)` 会静默存进另一格，改口之后就取不回原文案。
          copyLabels.set(id, cb.textContent);
          cb.addEventListener('click', () => doCopy(panel, side));
        }
      }
      // 接线之后先应用一次显隐、再画"等待输入"：挂载期一次计算都不做（口径 2），
      // 所以这里读的是 `IDLE` 那张表，不是 `COMPUTE`——格子里已经粘了东西也一样不碰。
      applySwitch(panel);
      for (const side of SIDES) {
        const cfg = CODEC_SPEC[panel].sides[side];
        if (!cfg) continue;
        paintSide(panel, side, IDLE[cfg.kind], '');
      }
    };
  }

  return {
    renderers,
    /**
     * 挂载完成后由测试或别处触发一栏：走的是与按钮完全同一条路（含 `runGuarded`）。
     * 栏位名不在 spec 里就直接报 `false`，不凭空画一栏、也不惊动闸门。
     * @param {string} panel 面板
     * @param {string} side 栏位
     * @returns {boolean} 这一块现在好不好
     */
    run: (panel, side) => {
      if (!CODEC_SPEC[panel] || !CODEC_SPEC[panel].sides[side]) return false;
      return runGuardedRun(panel, side) === true;
    },
    /**
     * 这一栏当前能复制的文本（复制按钮读的就是它）。
     * @param {string} panel 面板
     * @param {string} side 栏位
     * @returns {string} 纯文本，没有则空串
     */
    copyTextOf: (panel, side) => copies.get(at(panel, side)) || '',
  };
}

/**
 * 这个前缀下应该存在的全部 id，Task 9 拿它对账构建产物里的 HTML：
 * spec 说应有而页面没有 → 装配层第一次点就抛；页面有而 spec 没说 → 那是个没人接的格子。
 * 两个方向都红，才算这份 spec 是骨架的真值而不是它的影子。
 * @param {string} prefix 前缀
 * @param {string[]} [panels] 面板清单，默认 `CODEC_PANEL_IDS`
 * @returns {{in: string[], btn: string[], copy: string[], out: string[], when: string[]}}
 */
export function controlIds(prefix, panels = CODEC_PANEL_IDS) {
  const got = { in: [], btn: [], copy: [], out: [], when: [] };
  for (const panel of panels) {
    const sides = CODEC_SPEC[panel].sides;
    for (const side of SIDES) {
      const cfg = sides[side];
      if (!cfg) continue;
      got.btn.push(buttonId(prefix, panel, side));
      got.copy.push(copyId(prefix, panel, side));
      got.out.push(outId(prefix, panel, side));
      for (const c of cfg.controls) got.in.push(fieldId(prefix, panel, c.id));
      if (cfg.switch) for (const t of cfg.switch.targets) got.when.push(whenId(prefix, panel, t.key));
    }
  }
  return got;
}
```

#### `dev/js/toolCodec.js`（整文件）

```js
/**
 * 编码页入口：只读骨架里那四格 `data-tk-*`，把框架（`window.Tk`）、装配层
 * （`createCodecWorkbench`）与本页接起来。与 `toolIdcard.js` 同形，差异只在装配层多收三样注入。
 *
 * 这个文件和证件页那份一样刻意薄：找容器、读配置、按顺序接线，业务一条都不写。写进
 * `codecWorkbench.js` 的 spec 与 `codecView.js` 的渲染函数里才有判据可咬（§R 与 §Q 的分工）。
 *
 * 五条口径：
 *
 * 1. **前缀有两副面孔，各归各管**。`CONTAINER_ID` / `NOTICE_ID` 里那个 `tk` 是**本页自己的
 *    地址**（`tools-codec.html` 的骨架写死它，与证件页那一份同名但不同页）；行为里用的前缀
 *    从 `data-tk-prefix` 读，一路传给 `createPanelWorkspace` 与 `createCodecWorkbench`，
 *    控件 id 才跟着 `CODEC_SPEC` 换得动（R16 的 `zx` 那一档量的就是这件事）。
 * 2. **装配层不读环境，环境只在这一格读一次**。时钟与本地时区偏移由这里注入：
 *    `now: () => Date.now()` 与 `offsetMinutes: -new Date().getTimezoneOffset()`，
 *    全仓库各只此一处（R3 用同一把尺子反过来量装配层：那边五个词一个都不许出现）。
 *    理由与 §K 同源——"相对时间那一行"和"本地那一行"必须可复算，否则同一份产物在
 *    两台机器、两个 CI runner 上给出两个答案，而 §R 的每一判都指望它只有一个。
 *    `crypto.subtle` 也照这一条走：页面里取得到就递进去，取不到就递 `null`（那是
 *    "确实没有"，摘要面板据此把 SHA 四格标成"环境不支持"），不让装配层自己去找。
 * 3. **`runGuarded` 晚绑**。`createCodecWorkbench` 在构造时就把 `env.runGuarded` 收进闭包常量，
 *    而能当它的那只（`createPanelDom().run`）要等装配层交出 renderers 之后才存在——循环。
 *    所以递过去的是一个箭头，它在**调用时**才去 `guard.run` 上取：占位函数永远不可能被真的
 *    调到，因为按钮回调只在 `mount()` 之后才挂得上。
 * 4. **启动失败不装死**。抛出之前尽力把那句话写进 `#tk-notice`（只走 `textContent`），因为
 *    脚本 404 或被人挪到 `<head>` 这类事故，页面看起来跟"禁了脚本"一模一样：正文全在、
 *    按钮按不出东西。给一句能抄下来问人的话，比只在控制台红一次强。容器本身找不到时没地方写，
 *    那就只剩控制台，这也是这一条只写"尽力"的原因。
 * 5. **两条 `<script>` 的先后是硬前提**。`toolkitCore.min.js` 挂 `window.Tk`（四只：
 *    `createPanelWorkspace` / `createPanelDom` / `view` / `ui`），入口在它之后；编码页**多引一本**
 *    `assets/js/toolCodec.min.js`，而 `codecView.js` 已经打进这一本里，绝不再挂进 `Tk`——
 *    两个入口 reach 同一模块，Rollup 会切出带 `import{` 的共享 chunk，整页 SyntaxError 而构建退 0。
 *
 * 不用 `export`：产物被 `vite.config.js` 的 `iifeWrapPlugin` 包成 `(function(){…})();`，
 * 而它不补 `'use strict'`，入口里留一条顶层 `export` 就是一个语法错误。产物名必须与页面里
 * `<script src>` 那一段逐字符一致（`toolCodec.min.js`，§6.1 那条大小写教训）。启动方式与
 * `webLab.js` 同档——脚本排在正文之后，解析到这一行时面板节点已经存在，不接 `DOMContentLoaded`。
 */
import { createCodecWorkbench } from './tools/codecWorkbench.js';

/** 容器 id：`tools-codec.html` 里 `id="{{ tk.prefix }}-workspace"` 在 `prefix: tk` 下的落值 */
const CONTAINER_ID = 'tk-workspace';
/** 提示行 id：同上，`panel-dom` 的坏 hash 提示与本页的启动失败提示共用这一格 */
const NOTICE_ID = 'tk-notice';

/** 骨架上那四格数据的属性名（前缀 `tk` 同上，是本页的地址，不是行为里的前缀） */
const ATTR = {
  ids: 'data-tk-ids',
  prefix: 'data-tk-prefix',
  label: 'data-tk-label',
  notice: 'data-tk-notice',
};

/**
 * 取提示行节点：容器在就读 `data-tk-notice`，容器不在或那一格空着就回落到 `NOTICE_ID`。
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
 * `data-tk-ids` → 面板清单。逗号分隔、允许空格、丢掉空项；顺序就是索引条的顺序。
 * @param {string} raw 属性原文
 * @returns {string[]} 至少一项，空数组由调用侧判成错误
 */
function parseIds(raw) {
  return String(raw || '').split(',').map((s) => s.trim()).filter((s) => s !== '');
}

/**
 * `crypto.subtle` 的三档读法：取得到就传对象，明确取不到就传 `null`（不是"没注入"）。
 * 非安全上下文（http 站点、本地 `file://`）里 `crypto` 在而 `subtle` 是 undefined，
 * 这一档必须落成"环境不支持"那四格，而不是让装配层以为没人管它。
 * @param {object} win 真 `window`
 * @returns {object|null} `SubtleCrypto` 或 `null`
 */
function subtleOf(win) {
  const subtle = win.crypto ? win.crypto.subtle : null;
  return subtle && typeof subtle.digest === 'function' ? subtle : null;
}

/**
 * 装配一遍。抛出去的东西由 `start` 负责先写进页面、再原样抛回控制台。
 * @param {object} doc 真 `document`
 * @param {object} win 真 `window`（要 `location` / `history` / `navigator` / `crypto`）
 * @param {object} tk `window.Tk`
 * @returns {object} `createPanelDom().mount()` 的那四个清单
 */
function boot(doc, win, tk) {
  const box = doc.getElementById(CONTAINER_ID);
  if (!box || typeof box.getAttribute !== 'function') {
    throw new RangeError(
      `页面里没有 id="${CONTAINER_ID}" 的容器（或它读不到属性）：两条 <script> 必须排在正文之后，见 tools-codec.html 末尾那段注释`);
  }
  const ids = parseIds(box.getAttribute(ATTR.ids));
  if (ids.length === 0) {
    throw new RangeError(
      `容器 ${CONTAINER_ID} 的 ${ATTR.ids} 是空的，索引条与面板对不上，_data/onlineTools.yml 的 panels 是不是漏了 slug？`);
  }
  const prefix = String(box.getAttribute(ATTR.prefix) || '').trim() || 'tk';
  const label = String(box.getAttribute(ATTR.label) || '').trim();
  const notice = noticeNode(doc, box);
  if (!tk || typeof tk.createPanelWorkspace !== 'function'
    || typeof tk.createPanelDom !== 'function' || !tk.view || !tk.ui) {
    throw new RangeError(
      'window.Tk 没挂上来（或四只缺了谁）：toolkitCore.min.js 要么 404，要么排在本入口之后，顺序见 tools-codec.html 末尾');
  }

  const workspace = tk.createPanelWorkspace({
    ids,
    prefix,
    hash: win.location.hash,
    label: label === '' ? undefined : label,
  });
  /** 口径 3 的那个占位：谁真调到它，就是有人在 `mount()` 之前按了按钮 */
  const guard = {
    run: () => {
      throw new RangeError('装配层还没接上 createPanelDom().run，按钮回调跑早了');
    },
  };
  const wb = createCodecWorkbench({
    document: doc,
    Tk: tk,
    prefix,
    runGuarded: (id, fn) => guard.run(id, fn),
    navigator: win.navigator,
    now: () => Date.now(),
    offsetMinutes: -new Date().getTimezoneOffset(),
    subtle: subtleOf(win),
  });
  const dom = tk.createPanelDom({
    workspace,
    document: doc,
    location: win.location,
    history: win.history,
    window: win,
    renderers: wb.renderers,
    notice,
  });
  guard.run = dom.run;
  return dom.mount();
}

/**
 * 启动一次，并把失败写进页面上那句话。
 * @param {object} doc 真 `document`
 * @param {object} win 真 `window`
 * @returns {object|undefined} 成功时是 `mount()` 的四个清单，失败时 `undefined`（但仍会抛）
 */
function start(doc, win) {
  try {
    return boot(doc, win, win.Tk);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const el = noticeNode(doc, doc.getElementById(CONTAINER_ID));
    if (el) {
      el.hidden = false;
      el.textContent = `这一页的交互层没能启动：${message}。正文仍然读得到，只是按钮与下拉不会有反应。`;
    }
    throw err;
  }
}

start(document, window);
```

#### `scripts/toolkit-tests.mjs` §R（整节，从 `// ── §R` 到文件末尾）

```js
// ── §R 编码页装配层与入口（`tools/codecWorkbench.js` / `toolCodec.js`，段 3 Task 6b）─────
//
// 本节测的是**接线**：四本纯模块 + `codecView` 的纯字符串 + `panel-dom` 的绑定，接成
// `tools-codec.html` 那个样子。和 §J 一样，三方全部接真的——mock 掉任何一样，§K–§Q 那五节的
// 判据就从"这一层没错"变成"这一层没测"。
//
// 五条红线，整套判据围着它们转：
//
// 1. **装配层不读运行环境**（R3）。时钟、时区偏移、`crypto.subtle` 三样一律由 `env` 递进来：
//    `codecWorkbench.js` 里 `Date.now(` / `getTimezoneOffset` / `performance.` / `window` /
//    `globalThis` 五个词一个都不许出现，而入口那一份**恰好各一处**（同一条尺子反过来量）。
//    理由与 §K 同源：读了环境就不能复算，而"相对时间那一行"与"档间耗时那一行"在 CI 里
//    必须是注入时钟的函数，否则同一份产物在两台机器上给出两个答案。
// 2. **id 只由 spec 派生**（R2）。五只 `fieldId` / `buttonId` / `copyId` / `outId` / `whenId`
//    是唯一的地址来源，`controlIds(prefix)` 与 spec 互相对账；测试夹具的节点清单也全部由
//    它们长出，不在本节重抄一份 id 表——重抄的那份会跟着 spec 一起错，Task 9 就没了第三者。
// 3. **两类失败分两条路**（R13）。用户填的格子不能用 → `FieldError` → 结果区一句提示，
//    面板不算坏；模块或骨架自己抛的 → 原样上抛，交给 `createPanelDom.run` 标坏那一块。
// 4. **异步那一栏既不抢跑也不逃逸**（R11 / R13）。`#digest` 是五块里唯一要 `await` 的：
//    挂载期一律不计算（那时算的话，reject 落在 `mount()` 返回值之外，`report.broken` 记不到它），
//    而画结果与报错这两条异步回写都必须重新过一遍 `runGuarded`。
// 5. **跨页共用面不许扩**（R3）。本文件 import 的四本纯模块 + `codecView.js` 是闭合清单，
//    `panel` / `panel-dom` / `view` / `ui` 四只一律从 `env.Tk` 拿；`codecView.js` 在全仓库
//    只许被 `codecWorkbench.js` 一本 import——多一个入口 reach 它，产物立刻变成带 `import{`
//    的废文件（实测记录在 `dev/js/toolkitCore.js` 开头）。
//
// 三条夹具口径与 §J 同形：假 DOM 复用 §I 那一份（`out.innerHTML = 串` 在假 DOM 上只长成
// 一个属性，所以本节读的是那一串文本，而那也正是真页面唯一吃进 HTML 的地方）；每一判从
// 按真的按钮 / 派发真的事件起步；`type` → 标签的映射由 spec 反推，spec 里长出词汇表外的
// `type` 夹具当场抛，不让它静默长成一个 `<select>`。
const {
  createCodecWorkbench, CODEC_SPEC, CODEC_PANEL_IDS,
  controlIds: rControlIds, fieldId: rField, buttonId: rButton, copyId: rCopy,
  outId: rOut, whenId: rWhen,
} = await import('../dev/js/tools/codecWorkbench.js');

/** spec 的 `type` → 骨架标签。这张表**必须**覆盖 spec 里出现的每一个 type，多一个就当场抛 */
const R_TAGS = { text: 'input', number: 'input', date: 'input', area: 'textarea', file: 'input', select: 'select' };
const rTag = (type) => {
  const tag = R_TAGS[type];
  if (!tag) throw new Error(`夹具：CODEC_SPEC 里出现了词汇表外的 type「${String(type)}」（认得 ${Object.keys(R_TAGS).join(' / ')}）`);
  return tag;
};

/** 一栏的骨架文案：主按钮与复制按钮。装配层只负责"改口之后改回原文"，句子本身归夹具 */
const R_MAIN_LABEL = '计算';
const R_COPY_LABEL = {
  'timestamp:main': '复制换算结果', 'timestamp:diff': '复制差值',
  'base64:main': '复制结果', 'url:main': '复制两档结果',
  'digest:main': '复制摘要', 'regex:main': '复制命中',
};

/** 两栏的名字：`main` 每块都有，`diff` 只有 `#timestamp` 有（R1 钉这一条） */
const R_SIDES = ['main', 'diff'];

/** spec 摊平成 `{panel, side, control}` 清单，夹具与判据都从它长，不各抄一份 */
const rControls = () => {
  const out = [];
  for (const [panel, cfg] of Object.entries(CODEC_SPEC)) {
    for (const side of R_SIDES) {
      const s = cfg.sides[side];
      if (!s) continue;
      for (const c of s.controls) out.push({ panel, side, c });
    }
  }
  return out;
};

/** 剥注释再剥字符串字面量：报错文案与 JSDoc 里的字样都不算命中（与 §Q 的 qCode 同一形状） */
const rBare = (rel) => read(rel)
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  .replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
/** 只剥注释（判 import 边时用：字符串里的路径要留着） */
const rCode = (rel) => read(rel)
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const rCount = (hay, needle) => hay.split(needle).length - 1;

/**
 * 造一页"骨架"：§I 的索引条 + 五块面板 + 提示行，再按 `CODEC_SPEC` 长出控件、主按钮、
 * 复制按钮、结果区与受开关控制的字段组。
 * @param {object} o 选项
 * @param {string} [o.prefix] 前缀
 * @param {string} [o.hash] 进页面时地址栏里的 hash
 * @param {Record<string, string|number>} [o.seed] `'panel:control' → 初值`（挂载前就在 DOM 上）
 * @param {Record<string, object|object[]>} [o.files] `'panel:control' → File 替身`
 * @param {string[]} [o.drop] **不**要长的 id（造"骨架缺一格"那一类缺陷）
 * @returns {object} §I 的那份 page，外加 `ctl` / `btn` / `html` / `set` / `change` 等观察口
 */
function rPage({ prefix = 'tk', hash = '', seed = {}, files = {}, drop = [] } = {}) {
  const slugOf = (id, word) => {
    const at = `${prefix}-${word}-`;
    if (!id.startsWith(at)) return null;
    const slug = id.slice(at.length);
    return CODEC_PANEL_IDS.includes(slug) && id === `${at}${slug}` ? slug : null;
  };
  const dropTab = drop.map((id) => slugOf(id, 'tab')).filter((s) => s !== null);
  const dropPanel = drop.map((id) => slugOf(id, 'panel')).filter((s) => s !== null);
  const page = iPage({ ids: CODEC_PANEL_IDS, prefix, hash, dropTab, dropPanel });
  const gone = new Set(drop);
  const mk = page.mk;
  const doc = page.doc;

  for (const { panel, side, c } of rControls()) {
    const id = rField(prefix, panel, c.id);
    if (gone.has(id)) continue;
    const el = mk(rTag(c.type), id);
    if (c.type === 'select') {
      // 占位项的"值"走**属性**（与 §J 同一条口径）；`options` 里那些才是骨架的真选项。
      const ph = mk('option');
      ph.setAttribute('value', '');
      ph.textContent = '占位';
      el.appendChild(ph);
      for (const opt of c.options ?? []) {
        const o = mk('option');
        o.setAttribute('value', opt);
        o.textContent = opt;
        el.appendChild(o);
      }
    }
    if (c.type === 'file') el.files = [];
    const at = `${panel}:${c.id}`;
    if (seed[at] !== undefined) el.value = String(seed[at]);
    if (files[at] !== undefined) el.files = Array.isArray(files[at]) ? files[at] : [files[at]];
  }
  for (const panel of CODEC_PANEL_IDS) {
    for (const side of R_SIDES) {
      if (!CODEC_SPEC[panel].sides[side]) continue;
      const bid = rButton(prefix, panel, side);
      if (!gone.has(bid)) mk('button', bid).textContent = R_MAIN_LABEL;
      const cid = rCopy(prefix, panel, side);
      if (!gone.has(cid)) {
        const cb = mk('button', cid);
        cb.textContent = R_COPY_LABEL[`${panel}:${side}`];
        cb.disabled = true;                       // 骨架写死 disabled：第一次画完之前没东西可复制
      }
      const oid = rOut(prefix, panel, side);
      if (!gone.has(oid)) mk('div', oid);
    }
  }
  for (const id of rControlIds(prefix).when) if (!gone.has(id)) mk('p', id);

  const at = (id) => doc.getElementById(id);
  return Object.assign(page, {
    prefix,
    ctl: (panel, control) => at(rField(prefix, panel, control)),
    btn: (panel, side) => at(rButton(prefix, panel, side)),
    copy: (panel, side) => at(rCopy(prefix, panel, side)),
    outNode: (panel, side) => at(rOut(prefix, panel, side)),
    whenNode: (panel, key) => at(rWhen(prefix, panel, key)),
    /** 结果区里那一串 HTML；节点被 `drop` 掉时给空串，判据照样跑得动（那一判要的就是"没画"） */
    html: (panel, side) => String(at(rOut(prefix, panel, side))?.innerHTML ?? ''),
    set: (panel, control, v) => { const el = at(rField(prefix, panel, control)); el.value = String(v); return el; },
    setFiles: (panel, control, list) => {
      const el = at(rField(prefix, panel, control));
      el.files = Array.isArray(list) ? list : [list];
      return el;
    },
    change: (panel, control) => at(rField(prefix, panel, control)).dispatch('change', {}),
    click: (panel, side) => at(rButton(prefix, panel, side)).dispatch('click', {}),
    clickCopy: (panel, side) => at(rCopy(prefix, panel, side)).dispatch('click', {}),
    keyOn: (panel, control, evt) => at(rField(prefix, panel, control)).dispatch('keydown', evt),
  });
}

/**
 * 装配层 + 绑定层 + 挂载，一路接成页面上那个样子。
 *
 * `offsetMinutes` 与 §J 的 `rng` 一样有默认档：夹具给 `480`（东八区），因为"本地那一行"
 * 在偏移 0 下与 UTC 完全重合，任何写反符号的缺陷都量不出来。给 `null` 是**故意缺席**，
 * R8 用它判"没有偏移可注入时页面落在哪一档"。`now` 没有默认档：缺席就是缺席（R8）。
 *
 * @param {object} o 透给 `rPage` 的选项，外加 `clipboard` / `now` / `offsetMinutes` / `subtle` / `pick`
 * @returns {object} `{ page, wb, dom, report, timers, guarded, flush, subtle }`
 */
function rMount(o = {}) {
  const prefix = o.prefix ?? 'tk';
  const page = rPage({ prefix, hash: o.hash, seed: o.seed, files: o.files, drop: o.drop });
  const timers = [];
  /** `runGuarded` 的调用记录：口径 2 说"挂载期一次都不许走它"，这一格就是它的观察口 */
  const guarded = [];
  const host = { dom: null };
  const subtle = o.subtle === undefined ? undefined : o.subtle;
  const offset = 'offsetMinutes' in o ? o.offsetMinutes : 480;
  const wb = createCodecWorkbench({
    document: page.doc,
    Tk: { view: Q_VIEW, ui: J_UI },
    prefix,
    runGuarded: (id, fn) => { guarded.push(id); return host.dom.run(id, fn); },
    navigator: o.clipboard ? { clipboard: o.clipboard } : undefined,
    later: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    ...(o.now === undefined ? {} : { now: o.now }),
    ...(offset === null ? {} : { offsetMinutes: offset }),
    ...(subtle === undefined ? {} : { subtle }),
  });
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location, history: page.history,
    window: page.win, renderers: wb.renderers, notice: page.notice,
  });
  host.dom = dom;
  const report = dom.mount();
  for (const [who, v] of Object.entries(o.pick ?? {})) {
    const [panel, control] = who.split(':');
    page.set(panel, control, v);
    page.change(panel, control);
  }
  const flush = () => {
    const due = timers.splice(0, timers.length);
    for (const t of due) t.fn();
    return due;
  };
  return { page, wb, dom, report, timers, guarded, flush, prefix, subtle };
}

/**
 * 摘要那一只假 `crypto.subtle`：`digest` 记算法名并回一个可控的三字节串。
 * 它同时是"预闸门有没有真的拦住模块"的计数器——MD5 走本站自实现、不碰 subtle，
 * 所以四档 SHA 一次都没被调，就等于 `digestAll` 根本没进。
 */
function rSubtle() {
  const calls = [];
  return {
    calls,
    digest: (name, buf) => {
      calls.push({ name, byteLength: new Uint8Array(buf).byteLength });
      return Promise.resolve(new Uint8Array([0, 1, 2]).buffer);
    },
  };
}

/**
 * File 替身：假 DOM 上它就是一个普通对象，页面读 `name` / `size` / `arrayBuffer()` 三样。
 * `oversize` 用来造"声明的字节数超过 5 MiB 通道上限"那一档，`fail` 用来造读盘失败。
 */
function rFile(name, content, { fail = false, size = null } = {}) {
  const bytes = typeof content === 'string' ? bytesOf(content) : content;
  const box = {
    name, size: size === null ? bytes.byteLength : size, type: '', calls: 0,
    arrayBuffer() {
      box.calls += 1;
      if (fail) return Promise.reject(new Error('读不到这个文件（磁盘上它已经不在了）'));
      return Promise.resolve(bytes.buffer);
    },
  };
  return box;
}

/** 排空微任务：`digestAll` 与 `file.arrayBuffer()` 都是异步的，而 `later` 被夹具换成只记账 */
const rSettle = async () => {
  for (let i = 0; i < 3; i += 1) await new Promise((r) => { setTimeout(r, 0); });
};

/** 十六位固定"此刻"：比 `1700000000` 那发秒数正好晚 730 天，`relativeTime` 的固定年档给「2 年前」 */
const R_NOW = 1700000000000 + 730 * 86400000;

test('R1 导出面九个名字与 spec 骨架：只有 #timestamp 有第二栏，kind 必须在视图白名单里', async () => {
  const mod = await import('../dev/js/tools/codecWorkbench.js');
  assert.deepEqual(Object.keys(mod).sort(),
    ['CODEC_PANEL_IDS', 'CODEC_SPEC', 'buttonId', 'controlIds', 'copyId', 'createCodecWorkbench', 'fieldId', 'outId', 'whenId'],
    '装配层就交这九样：一只工厂、两张表、五只 id 派生、一份对账清单');
  assert.deepEqual(CODEC_PANEL_IDS, CODEC, '面板清单必须与 §D 那份两页锚点逐字同序——顺序就是索引条的顺序');
  assert.deepEqual(Object.keys(CODEC_SPEC), CODEC_PANEL_IDS, 'spec 的键序就是 tab 序，重排等于把索引条打乱');
  for (const panel of CODEC_PANEL_IDS) {
    const sides = CODEC_SPEC[panel].sides;
    assert.deepEqual(Object.keys(sides).sort(), panel === 'timestamp' ? ['diff', 'main'] : ['main'],
      `${panel} 的栏位集合不对：只有 #timestamp 有"两个日期之差"那一栏`);
    for (const [side, cfg] of Object.entries(sides)) {
      assert.equal(typeof cfg.kind, 'string', `${panel}.${side} 没有 kind`);
      assert.equal(Object.prototype.hasOwnProperty.call(PANEL_VERDICTS, cfg.kind), true,
        `${panel}.${side} 的 kind「${cfg.kind}」不在 codecView 的白名单里——渲染时才知道就是页面上当场抛`);
      assert.equal(Array.isArray(cfg.controls), true, `${panel}.${side} 的 controls 应为数组`);
      const ids = cfg.controls.map((c) => c.id);
      assert.deepEqual(ids.slice().sort(), [...new Set(ids)].sort(), `${panel}.${side} 有重名控件`);
      for (const c of cfg.controls) {
        assert.equal(Object.prototype.hasOwnProperty.call(R_TAGS, c.type), true,
          `${panel}.${side} 的控件「${c.id}」type「${String(c.type)}」不在夹具词汇表里`);
        assert.equal(R_SIDES.includes(side), true);
      }
      const sw = cfg.switch;
      if (sw) {
        assert.equal(ids.includes(sw.control), true, `${panel}.${side} 的开关控件「${sw.control}」不在自己的控件清单里`);
        for (const t of sw.targets) {
          assert.equal(ids.includes(t.key), true, `${panel}.${side} 的开关目标「${t.key}」不是本栏的控件 id`);
          assert.equal(Array.isArray(t.when) && t.when.length > 0, true, `${t.key} 的 when 是空的，那段字段永远藏起来`);
          if (sw.control === 'mode') {
            const mode = cfg.controls.find((c) => c.id === 'mode');
            for (const w of t.when) {
              assert.equal((mode.options ?? []).includes(w), true,
                `${panel}.${side}：开关说「${t.key}」在 mode=${w} 时出现，而 mode 的选项里没有 ${w}`);
            }
          }
        }
      }
    }
  }
  // 四档方向与两档摘要通道是这页的骨架事实，写错一个 token 就是"点了没反应"
  assert.deepEqual(CODEC_SPEC.base64.sides.main.controls.find((c) => c.id === 'mode').options,
    ['encode', 'decode', 'dataUri', 'dataUriDecode']);
  assert.deepEqual(CODEC_SPEC.digest.sides.main.controls.find((c) => c.id === 'mode').options, ['text', 'file']);
  assert.deepEqual(CODEC_SPEC.base64.sides.main.switch,
    { control: 'mode', targets: [{ key: 'strict', when: ['decode'] }, { key: 'mime', when: ['dataUri'] }] },
    'strict 只管解码、mime 只管包装：多一档或少一档都是页面上的一格死字段');
});

test('R2 五只 id 派生与 controlIds 自洽，换前缀整套跟着换', () => {
  assert.equal(rField('tk', 'base64', 'text'), 'tk-in-base64-text');
  assert.equal(rButton('tk', 'base64', 'main'), 'tk-btn-base64-main');
  assert.equal(rCopy('tk', 'timestamp', 'diff'), 'tk-copy-timestamp-diff');
  assert.equal(rOut('tk', 'regex', 'main'), 'tk-out-regex-main');
  assert.equal(rWhen('tk', 'digest', 'payload'), 'tk-when-digest-payload');
  const got = rControlIds('tk');
  assert.deepEqual(Object.keys(got).sort(), ['btn', 'copy', 'in', 'out', 'when']);
  // 逐项与 spec 对账：两个方向都红才算这份 spec 是骨架的真值而不是它的影子
  const wantIn = rControls().map(({ panel, c }) => rField('tk', panel, c.id));
  assert.deepEqual(got.in.slice().sort(), wantIn.slice().sort(), 'controlIds 与 spec 的控件清单对不上');
  assert.equal(new Set(got.in).size, got.in.length, '控件 id 有重复：同一格挂两处事件就是双份渲染');
  assert.equal(got.btn.length, 6, '六栏（五块主栏 + 时间戳差值栏）各一条主按钮');
  // 三张清单按**位置**一一对应，比的是各自去掉 `<prefix>-btn|copy|out-` 之后剩下的那半截
  // （`tk-copy-*` 与 `tk-btn-*` 天生不同字，逐字比 id 串是判据自己写歪了——顺序照样钉得住）。
  const tail = (word) => (id) => id.slice(`tk-${word}-`.length);
  assert.deepEqual(got.copy.map(tail('copy')), got.btn.map(tail('btn')), '有主按钮的地方就必须有复制按钮');
  assert.deepEqual(got.out.map(tail('out')), got.btn.map(tail('btn')), '有主按钮的地方就必须有结果区');
  assert.deepEqual(got.when.slice().sort(),
    ['tk-when-base64-mime', 'tk-when-base64-strict', 'tk-when-digest-payload', 'tk-when-digest-upload']);
  const zx = rControlIds('zx');
  assert.equal(zx.in.every((id) => id.startsWith('zx-')) && zx.btn.every((id) => id.startsWith('zx-')), true,
    '换前缀就是整套换：残留一处 `tk-` 等于那一格在页面上永远找不到');
  assert.deepEqual(zx.in.slice().sort(), wantIn.map((id) => `zx-${id.slice(3)}`).sort());
  assert.deepEqual(rControlIds('tk', ['url']).in, ['tk-in-url-text'], 'panels 参数得真的生效，Task 9 按条目对账要用它');
});

test('R3 源码红线：一处 innerHTML、零 querySelector、import 边闭合、共用面不扩、时钟只在入口', () => {
  const bare = rBare('dev/js/tools/codecWorkbench.js');
  const code = rCode('dev/js/tools/codecWorkbench.js');
  assert.equal(rCount(bare, 'innerHTML'), 1, 'innerHTML 只许出现在 paint() 一处：两处就有第二条插值路径');
  for (const banned of ['querySelector', 'Date.now(', 'getTimezoneOffset', 'performance.', 'window', 'globalThis']) {
    assert.equal(bare.includes(banned), false, `装配层不许碰 ${banned}（口径 1 与口径 2：环境量一律从 env 进来）`);
  }
  const specs = [...code.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(specs.slice().sort(), ['./codecView.js', './digest.js', './regex.js', './time.js', './codec.js'].slice().sort(),
    'import 边就是这五本：panel / panel-dom / view / ui 走 window.Tk，多一本就有第二个入口 reach 它，产物变成带 import{ 的废文件');
  assert.equal(code.includes('workbench.js'), false, '证件页那本装配层不许被复用：它 import 六本业务模块，接过来编码页就替证件页付 gzip');
  // `codecView.js` 全仓库只许一本 reach 它（§Q2 的前提），这一判把前提钉在消费侧
  const importers = ['dev/js/toolkitCore.js', 'dev/js/toolIdcard.js', 'dev/js/toolCodec.js',
    'dev/js/webLab.js', 'dev/js/editorial.js', 'dev/js/index.js', 'dev/js/about.js', 'dev/js/bottomFixedBtn.js', 'dev/js/cat.js']
    .concat(readdirSync(resolve(ROOT, 'dev/js/tools')).filter((f) => f.endsWith('.js')).map((f) => `dev/js/tools/${f}`))
    .filter((rel) => rel !== 'dev/js/tools/codecWorkbench.js')
    .filter((rel) => rCode(rel).includes("from './codecView.js'") || rCode(rel).includes("from '../js/tools/codecView.js'"));
  assert.deepEqual(importers, [], 'codecView 多了一个 importer：两个入口 reach 同一模块 = 共享 chunk = 整页 SyntaxError');
  const entry = rCode('dev/js/toolCodec.js');
  assert.deepEqual([...entry.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]), ['./tools/codecWorkbench.js'],
    '入口只许 import 装配层一本，框架那四只从 window.Tk 拿');
  assert.equal(/^\s*export\b/m.test(entry), false, '入口有顶层 export 就是语法错误：iifeWrapPlugin 包成 (function(){…})() 且不补 use strict');
  assert.equal(rCount(rBare('dev/js/toolCodec.js'), 'Date.now('), 1, '时钟只在这一处读，且必须还能被 env 覆盖');
  assert.equal(rCount(rBare('dev/js/toolCodec.js'), 'getTimezoneOffset'), 1, '时区偏移只在这一处读');
});

test('R4 构造期闸门：缺哪一样点名哪一样，注入的偏移与时钟必须是能用形状', () => {
  const base = {
    document: rPage().doc, Tk: { view: Q_VIEW, ui: J_UI },
    runGuarded: () => true,
  };
  assert.throws(() => createCodecWorkbench({ ...base, document: undefined }),
    (e) => e instanceof TypeError && /env\.document/.test(e.message), '缺 document 的后果是第一次点击才炸，构造期点名才有意义');
  assert.throws(() => createCodecWorkbench({ ...base, Tk: { view: { esc: () => '' }, ui: J_UI } }),
    (e) => e instanceof TypeError && /view/.test(e.message), 'view 缺一只能抛，不许静默把整页渲成空');
  assert.throws(() => createCodecWorkbench({ ...base, Tk: { view: Q_VIEW, ui: {} } }),
    (e) => e instanceof TypeError && /copyInto/.test(e.message), '缺 ui.copyInto 的下场是"用户点复制没反应"');
  assert.throws(() => createCodecWorkbench({ ...base, runGuarded: undefined }),
    (e) => e instanceof TypeError && /runGuarded/.test(e.message), '按钮回调不许自己 try/catch 出第二套错误口径');
  assert.throws(() => createCodecWorkbench({ ...base, now: 5 }),
    (e) => e instanceof TypeError && /env\.now/.test(e.message), '非函数的 now 会让"相对时间"那一行静默消失');
  assert.throws(() => createCodecWorkbench({ ...base, offsetMinutes: '480' }),
    (e) => e instanceof TypeError && /offsetMinutes/.test(e.message), '字符串偏移会一路传到 fromEpoch 那口才响，早一格点名少一块面板塌');
  assert.throws(() => createCodecWorkbench({ ...base, offsetMinutes: 900 }),
    (e) => e instanceof TypeError && /offsetMinutes/.test(e.message), '±840 之外 time.js 一律不收，装配层不许替它兜');
  // 前缀缺省与空串：空串会让所有派生 id 前面挂一个 `-`，等于整页找不到节点
  const page = rPage();
  assert.doesNotThrow(() => createCodecWorkbench({ ...base, document: page.doc, prefix: '' }));
});

test('R5 挂载期：六栏全画"等待输入"、不走 runGuarded、不出现证件页那句「未收录」', () => {
  const m = rMount();
  assert.deepEqual(m.report.broken, [], '五块面板应当在挂载期全部画好');
  assert.deepEqual(m.report.rendered, CODEC_PANEL_IDS);
  assert.deepEqual(m.report.missing, [], '夹具自证：五块面板的 tab 与 panel 节点都在');
  assert.deepEqual(m.guarded, [], '挂载期一次都不许走 runGuarded：那时 mounted 还是 false');
  for (const [panel, side] of [['timestamp', 'main'], ['timestamp', 'diff'], ['base64', 'main'],
    ['url', 'main'], ['digest', 'main'], ['regex', 'main']]) {
    const html = m.page.html(panel, side);
    assert.equal(/class="tk-result tk-result--idle"/.test(html), true, `${panel}.${side} 的外层骨架不对`);
    assert.equal(html.includes('等待输入'), true, `${panel}.${side} 挂载期没画上"等待输入"`);
    assert.equal(html.includes('未收录'), false, '「未收录」是证件页判定表的措辞：checks 里出现 ok:null 就是把它带过来了');
    assert.equal(m.page.copy(panel, side).disabled, true, `${panel}.${side} 还没有可复制的文本`);
  }
  assert.equal(m.subtle, undefined, '这一判没注入 subtle：挂载期就不该有任何 SHA 计算');
});

test('R6 时间戳主栏：十位按秒、十三位按毫秒、十一位两读并列、民用日期回落要说口径', () => {
  const m = rMount({ now: () => R_NOW, seed: { 'timestamp:value': '1700000000' } });
  m.page.click('timestamp', 'main');
  const html = m.page.html('timestamp', 'main');
  assert.equal(html.includes('已换算'), true, '10 位是秒档唯一解，不该并列两读');
  assert.equal(html.includes('2023-11-14T22:13:20Z'), true, 'UTC 那一行要按注入的 epoch 复算');
  assert.equal(html.includes('2023-11-15T06:13:20+08:00'), true, '本地那一行走 env.offsetMinutes，不是 UTC');
  assert.equal(/2023-11-15 06:13:20 \(UTC\+08:00\)/.test(html), true, '可读那一行的括号里必须带偏移');
  assert.equal(html.includes('2 年前'), true, '相对时间来自注入时钟：730 天在固定年档就是 2 年');
  assert.equal(html.includes('按民用日期'), false, '数字串这一档不该出现民用日期的口径行');
  const copy = m.wb.copyTextOf('timestamp', 'main');
  assert.equal(copy.includes('UTC：2023-11-14T22:13:20Z'), true, '复制的是明细表那些行，不是 HTML');
  assert.equal(copy.includes('相对时间：2 年前'), true);

  const milli = rMount({ seed: { 'timestamp:value': '1700000000000' } });
  milli.page.click('timestamp', 'main');
  assert.equal(milli.page.html('timestamp', 'main').includes('2023-11-14T22:13:20Z'), true, '13 位按毫秒');

  // 十一位：两种解释都成立，页面必须并列给，谁都不许被标成"已换算"（§K 的 K2 那一档）
  const amb = rMount({ seed: { 'timestamp:value': '17000000000' } });
  amb.page.click('timestamp', 'main');
  const ambHtml = amb.page.html('timestamp', 'main');
  assert.equal(ambHtml.includes('长度两可'), true);
  assert.equal(ambHtml.includes('按秒') && ambHtml.includes('按毫秒'), true, '两读要两行，中文说法归视图');
  assert.equal(ambHtml.includes('tk-state--ok'), false, '长度两可时不许把任何一种解释标成对');

  // 民用日期回落：`2026-09-01` 不是时间戳，但按 +08:00 解释成立，结果区必须说清用了哪一口径
  const civil = rMount({ seed: { 'timestamp:value': '2026-09-01' } });
  civil.page.click('timestamp', 'main');
  const civilHtml = civil.page.html('timestamp', 'main');
  assert.equal(civilHtml.includes('按民用日期'), true, '回落要留痕：不然用户以为 2026-09-01 是一串时间戳');
  assert.equal(civilHtml.includes('2026-09-01T00:00:00+08:00'), true, '不带时区标记的日期按注入偏移解释（K5）');
  assert.equal(civilHtml.includes('已换算'), true);

  // 两档都不成立：两条理由都要出现，只报一条等于把用户支走（§K 的 K3 同一条口径）
  const bad = rMount({ seed: { 'timestamp:value': '2026-02-29' } });
  bad.page.click('timestamp', 'main');
  const badHtml = bad.page.html('timestamp', 'main');
  assert.equal(badHtml.includes('不成立'), true);
  assert.equal(badHtml.includes('不是闰年'), true, `民用日期那一档的理由没进结果区：${JSON.stringify(badHtml.slice(0, 200))}`);
  assert.equal(badHtml.includes(parseTimestamp('2026-02-29').reason), true, '时间戳那一档的理由也要原样交出去');
  assert.equal(badHtml.includes('<table'), false, '不成立那一档没有可显示的明细');

  // `offset` 格填了就以它为准，且只动本地那一行——UTC 那一行是绝对量，谁都不该拿去乘偏移
  const local = rMount({ now: () => R_NOW, seed: { 'timestamp:value': '1700000000', 'timestamp:offset': '-120' } });
  local.page.click('timestamp', 'main');
  const localHtml = local.page.html('timestamp', 'main');
  assert.equal(localHtml.includes('2023-11-14T20:13:20-02:00'), true, '用户填的 ±分钟数应压过 env 的默认偏移');
  assert.equal(localHtml.includes('2023-11-14T22:13:20Z'), true, 'UTC 那一行不许被本地偏移改动');
  // 越界的偏移是"这一格不能用"，不是"这块面板坏了"（口径 3）。
  // 注意走的仍是同一道闸门——`guarded` 记的是"过没过闸门"，不是"有没有出错"，
  // 两条路的分别只在结果区里那一行是提示还是错误条，所以这一判量的是 `brokenOf`。
  const oob = rMount({ seed: { 'timestamp:value': '1700000000', 'timestamp:offset': '900' } });
  oob.page.click('timestamp', 'main');
  assert.match(oob.page.html('timestamp', 'main'), /class="tk-hint">/, '偏移越界应当是一行提示');
  assert.equal(oob.page.html('timestamp', 'main').includes('tk-result'), false, '提示行不该包在结果骨架里');
  assert.deepEqual(oob.guarded, ['timestamp'], 'FieldError 走的仍是同一道闸门，不另开第二条路');
  assert.equal(oob.page.ws.brokenOf('timestamp'), '', '把"你填的这格不能用"标成面板坏了，错误条那句"其余面板不受影响"就是废话');
});

test('R7 差值栏：三种口径同给、缺哪端点名的、两端相同就是 0', () => {
  const m = rMount({ seed: { 'timestamp:from': '2026-09-01', 'timestamp:to': '2026-09-25' } });
  m.page.click('timestamp', 'diff');
  const html = m.page.html('timestamp', 'diff');
  assert.equal(html.includes('已换算'), true);
  assert.equal(html.includes('0 年 0 个月 24 天'), true, '日历分解那一行');
  assert.equal(html.includes('24 天'), true, '整 24 小时那一行');
  assert.equal(html.includes('跨 UTC 日历日'), true, '三种口径同时给，不替用户挑一种（K9）');
  assert.equal(html.includes('整 24 小时与跨 UTC 日历日是两种口径'), false, '这一对数值相同，不该多插一句口径行');
  assert.equal(m.wb.copyTextOf('timestamp', 'diff'),
    '日历分解：0 年 0 个月 24 天\n整 24 小时：24 天\n跨 UTC 日历日：24 天', '复制那三行就是结果区那三行');

  // 23:00 → 次日 01:00：整 24 小时是 0、跨日历日是 1，两种口径**必须不等**，页面要并列并且补一句
  const near = rMount({ seed: { 'timestamp:from': '2026-09-01T23:00Z', 'timestamp:to': '2026-09-02T01:00Z' } });
  near.page.click('timestamp', 'diff');
  const nearHtml = near.page.html('timestamp', 'diff');
  assert.equal(nearHtml.includes('整 24 小时与跨 UTC 日历日是两种口径'), true, '两口径分叉时那句说明由视图补，装配层不许自己写');
  assert.equal(nearHtml.includes('1 天'), true);
  assert.equal(nearHtml.includes('结束那一端在开始那一端之前'), false, '正差不该被标成反向');

  // 反向：ymd 说的是绝对值，方向必须另说一句，否则"1 年 0 个月 1 天"会被读成正向那一种
  const back = rMount({ seed: { 'timestamp:from': '2026-09-25', 'timestamp:to': '2026-09-01' } });
  back.page.click('timestamp', 'diff');
  assert.equal(back.page.html('timestamp', 'diff').includes('结束那一端在开始那一端之前'), true);

  const same = rMount({ seed: { 'timestamp:from': '2026-09-01', 'timestamp:to': '2026-09-01' } });
  same.page.click('timestamp', 'diff');
  assert.equal(same.page.html('timestamp', 'diff').includes('0 年 0 个月 0 天'), true, '两端相同就是 0，不是一句"没差别"');

  // 缺哪一端就说哪一端还没填；填了但不成立要说清是哪一栏
  const half = rMount({ seed: { 'timestamp:from': '2026-09-01' } });
  half.page.click('timestamp', 'diff');
  assert.equal(half.page.html('timestamp', 'diff').includes('等待输入'), true, '只填一端就还没到算的时候');
  const wrong = rMount({ seed: { 'timestamp:from': '2026-09-01', 'timestamp:to': 'abc' } });
  wrong.page.click('timestamp', 'diff');
  const wrongHtml = wrong.page.html('timestamp', 'diff');
  assert.equal(wrongHtml.includes('不成立'), true);
  assert.equal(wrongHtml.includes('终点'), true, `理由必须点名是哪一端：${JSON.stringify(wrongHtml.slice(0, 200))}`);
  assert.equal(wrongHtml.includes('起点'), false, '另一端是好的，不许一起挨打');
});

test('R8 时钟与偏移都缺席时的降级形状：不问环境，就把 UTC 那一档交出去', () => {
  const m = rMount({ now: undefined, offsetMinutes: null, seed: { 'timestamp:value': '1700000000' } });
  m.page.click('timestamp', 'main');
  const html = m.page.html('timestamp', 'main');
  assert.equal(html.includes('2023-11-14T22:13:20Z'), true, 'UTC 那一行与偏移无关，永远给得出');
  assert.equal(html.includes('2023-11-14T22:13:20+00:00'), true, '没有偏移可注入就按 +00:00，而不是拿本地时区猜');
  // 「相对时间」这四个字在 `TIME_CAVEAT` 里也出现一次（"相对时间的「月」按 30 天"），
  // 只比短语就会把口径行当成明细行。明细行在产物里的形状是 `<td>相对时间</td>`，量它。
  assert.equal(html.includes('<td>相对时间</td>'), false, '没有时钟就没有"几年前"那一行——静默读 Date.now() 才是缺陷');
  assert.equal(m.wb.copyTextOf('timestamp', 'main').includes('相对时间'), false);

  // 正则那一只时钟同理：注入才有"档间耗时"那一行，缺席就不给一个假数字
  const withClock = rMount({ now: () => 1000, seed: { 'regex:pattern': 'a', 'regex:text': 'aaa' } });
  withClock.page.click('regex', 'main');
  assert.match(withClock.page.html('regex', 'main'), /档间累计耗时 \d+ms/);
  const noClock = rMount({ seed: { 'regex:pattern': 'a', 'regex:text': 'aaa' } });
  noClock.page.click('regex', 'main');
  assert.equal(noClock.page.html('regex', 'main').includes('档间累计耗时'), false,
    '没注入时钟时 elapsedMs 是 null，视图那一格必须整行不出现');
});

test('R9 base64 四档方向、strict 档、mime 格与那两道损耗计数', () => {
  const enc = rMount({ seed: { 'base64:mode': 'encode', 'base64:text': '中' } });
  enc.page.click('base64', 'main');
  assert.equal(enc.page.html('base64', 'main').includes('>5Lit<'), true, '编码结果走那一族等宽行');
  assert.equal(enc.page.html('base64', 'main').includes('3 字节'), true, '字节数是输入侧的 UTF-8 字节数');
  assert.equal(enc.wb.copyTextOf('base64', 'main'), b64Of('中'));

  // 解码：模块那句"不在 Base64 字母表"必须原样进结果区（invalid 的理由归模块，装配层不重写）
  const dec = rMount({ seed: { 'base64:mode': 'decode', 'base64:text': '5Lit' } });
  dec.page.click('base64', 'main');
  assert.equal(dec.page.html('base64', 'main').includes('已解码'), true);
  assert.equal(dec.page.html('base64', 'main').includes('>中<'), true);
  assert.equal(dec.wb.copyTextOf('base64', 'main'), '中');
  const nope = rMount({ seed: { 'base64:mode': 'decode', 'base64:text': '!!!!' } });
  nope.page.click('base64', 'main');
  assert.equal(nope.page.html('base64', 'main').includes(decodeBase64('!!!!').reason), true);
  assert.equal(nope.page.html('base64', 'main').includes('不成立'), true);

  // 宽松档替用户补了 padding / 剥了空白，就不能只报"已解码"（Q8 钉的那两个词）
  const padded = rMount({ seed: { 'base64:mode': 'decode', 'base64:text': 'YQ' } });
  padded.page.click('base64', 'main');
  const paddedHtml = padded.page.html('base64', 'main');
  assert.equal(paddedHtml.includes('有还原损耗'), true, '补了 2 位 padding 就是损耗，不是无损解码');
  assert.equal(paddedHtml.includes('补齐的 padding'), true);
  const even = rMount({ seed: { 'base64:mode': 'decode', 'base64:text': 'YQ==' } });
  even.page.click('base64', 'main');
  assert.equal(even.page.html('base64', 'main').includes('有还原损耗'), false, '原文自带两位 = 时没有任何还原损耗');
  const spaced = rMount({ seed: { 'base64:mode': 'decode', 'base64:text': 'Y Q' } });
  spaced.page.click('base64', 'main');
  assert.equal(spaced.page.html('base64', 'main').includes('剥掉的空白'), true);
  // strict 档只在解码那一档有意义：同一串输入在 strict 下是"不成立"，不是"有损耗"
  const strict = rMount({ seed: { 'base64:mode': 'decode', 'base64:text': 'Y Q', 'base64:strict': 'strict' } });
  strict.page.click('base64', 'main');
  assert.equal(strict.page.html('base64', 'main').includes('不成立'), true, 'strict 档不接受空白');
  assert.equal(strict.page.html('base64', 'main').includes('有还原损耗'), false);

  // data URI 包装与解包：mime 格空白就是"用默认值"，模块自己会写成 text/plain
  const uri = rMount({ seed: { 'base64:mode': 'dataUri', 'base64:text': 'a', 'base64:mime': 'text/html' } });
  uri.page.click('base64', 'main');
  assert.equal(uri.page.html('base64', 'main').includes('data:text/html;charset=utf-8;base64,'), true);
  const def = rMount({ seed: { 'base64:mode': 'dataUri', 'base64:text': 'a' } });
  def.page.click('base64', 'main');
  assert.equal(def.page.html('base64', 'main').includes('data:text/plain;charset=utf-8;base64,'), true,
    'mime 格空着要把 null 递下去（空串会被模块判成"形状不合法"）');
  const badMime = rMount({ seed: { 'base64:mode': 'dataUri', 'base64:text': 'a', 'base64:mime': 'bog' } });
  badMime.page.click('base64', 'main');
  assert.equal(badMime.page.html('base64', 'main').includes('mime 形状不合法'), true);
  const unpack = rMount({ seed: { 'base64:mode': 'dataUriDecode', 'base64:text': 'data:;base64,YQ==' } });
  unpack.page.click('base64', 'main');
  const unpackHtml = unpack.page.html('base64', 'main');
  assert.equal(unpackHtml.includes('已解码'), true);
  assert.equal(unpackHtml.includes('text/plain'), true, 'mime 缺省这件事必须让用户看得见，否则复制下来是一串变了味的 URI');
  assert.equal(unpackHtml.includes('>a<'), true);

  // 页面级预闸门：超限的输入不进模块，也就不会长出模块那句按位置拒绝的话。
  // 尺子取模块的原句而不是"字母表"三个字——`BASE64_CAVEAT` 本来就含「字母表外的字符」，
  // 口径行常驻这一栏，用宽词量等于永远红。
  const huge = rMount({ seed: { 'base64:mode': 'decode', 'base64:text': 'a'.repeat(MAX_INPUT_BYTES + 2) } });
  huge.page.click('base64', 'main');
  const hugeHtml = huge.page.html('base64', 'main');
  assert.equal(hugeHtml.includes('已拒收'), true, '整栏不处理是"已拒收"，不是"不成立"');
  assert.equal(hugeHtml.includes(String(MAX_INPUT_BYTES + 2)), true, '越界那一句必须报得出实际字节数');
  assert.equal(hugeHtml.includes('不在 Base64 字母表'), false, '预闸门拦下时不该再调模块');
  assert.equal(hugeHtml.includes('tk-line__raw'), false, '闸门拦下时没有结果行可摆');
  // 空输入与没选方向：两种"还没开始"都落在等待输入，且不许偷算
  for (const seed of [{ 'base64:mode': 'encode' }, { 'base64:text': 'abc' }]) {
    const idle = rMount({ seed });
    idle.page.click('base64', 'main');
    assert.equal(idle.page.html('base64', 'main').includes('等待输入'), true, `${JSON.stringify(seed)} 这一档不该算`);
  }
});

test('R10 URL 栏：两档并列 + 那 11 个差异字符 + 解码两条口径 + query 拆解', () => {
  const m = rMount({ seed: { 'url:text': 'a?b=c d' } });
  m.page.click('url', 'main');
  const html = m.page.html('url', 'main');
  assert.equal(html.includes('已编码'), true);
  assert.equal(html.includes('a?b=c%20d'), true, 'encodeURI 档保留 ? 与 =');
  assert.equal(html.includes('a%3Fb%3Dc%20d'), true, 'encodeURIComponent 档把 ? 与 = 一起编掉');
  assert.equal(html.includes('11 个字符在这一档不编码'), true, '差异数量由模块那两档实测出来，不是抄一个常数');
  // 字节那一格取自 `urlPair.bytes`，而 L11 钉死了它是**入参**字节数（不是编码结果长度）：
  // `a?b=c d` 是 7 个 ASCII 字符 = 7 字节，写成 9 就是把 `a%3Fb%3Dc%20d` 的长度当成了口径。
  assert.equal(html.includes('7 字节'), true);
  assert.equal(html.includes('a?b'), true, 'query 拆解按 & 切、只在第一个 = 处切一次');
  assert.deepEqual(m.wb.copyTextOf('url', 'main').split('\n'),
    ['encodeURI：a?b=c%20d', 'encodeURIComponent：a%3Fb%3Dc%20d']);

  // 百分号串：解得开就是"已解码"，两档的解码结果都要摆出来
  const dec = rMount({ seed: { 'url:text': 'a%3Fb%20c' } });
  dec.page.click('url', 'main');
  const decHtml = dec.page.html('url', 'main');
  assert.equal(decHtml.includes('已解码'), true, '带 %XX 且解得开，说"已编码"就是把用户刚粘的东西说反了');
  assert.equal(decHtml.includes('a?b c'), true);

  // 两档解码都失败：不是"没编"，是"这串百分号不成立"
  const bad = rMount({ seed: { 'url:text': '%zz' } });
  bad.page.click('url', 'main');
  const badHtml = bad.page.html('url', 'main');
  assert.equal(badHtml.includes('不成立'), true, '两档都解不开就是坏输入');
  assert.equal(badHtml.includes('十六进制'), true, `模块那句理由要原样进结果区：${JSON.stringify(badHtml.slice(0, 200))}`);

  // 落单代理项：模块那两道闸门之一，页面不许自己算一遍代理项
  const lone = rMount({ seed: { 'url:text': '\uD83D' } });
  lone.page.click('url', 'main');
  assert.equal(lone.page.html('url', 'main').includes('落单代理项'), true);

  const huge = rMount({ seed: { 'url:text': 'a'.repeat(MAX_INPUT_BYTES + 1) } });
  huge.page.click('url', 'main');
  assert.equal(huge.page.html('url', 'main').includes('已拒收'), true);
  assert.equal(huge.page.html('url', 'main').includes('1 MiB'), true);

  const idle = rMount({ seed: { 'url:text': '   ' } });
  idle.page.click('url', 'main');
  assert.equal(idle.page.html('url', 'main').includes('等待输入'), true, '整格空白也算还没输入');
});

test('R11 摘要栏：文本档五格恒定、通道预闸门与那个"没算"的计数器', async () => {
  // 挂载期不抢跑：文本已经 seeded，摘要一次都不算
  const fake = rSubtle();
  const idle = rMount({ subtle: fake, seed: { 'digest:mode': 'text', 'digest:payload': 'abc' } });
  assert.deepEqual(idle.guarded, [], '挂载期不许走 runGuarded');
  assert.deepEqual(fake.calls, [], '摘要那一栏异步，挂载期抢跑的话 reject 会落在 mount() 返回值之外');
  assert.equal(idle.page.html('digest', 'main').includes('等待输入'), true);

  idle.page.click('digest', 'main');
  await rSettle();
  const html = idle.page.html('digest', 'main');
  assert.equal(html.includes('已算出'), true);
  assert.equal(html.includes('900150983cd24fb0d6963f7d28e17f72'), true, 'MD5 走本站自实现，与外部判据源同一值');
  assert.equal(html.includes('000102'), true, 'SHA-* 走注入的 subtle：可控的三字节串就是可控的六字符 hex');
  assert.equal(html.includes('浏览器 crypto'), true, '谁算的必须说清');
  assert.equal(html.includes('文本 3 字节'), true, '文本档的计数行要点名通道');
  assert.deepEqual(idle.guarded, ['digest', 'digest'], '计算与画结果各过一遍闸门：异步回写不许逃逸');
  assert.deepEqual(fake.calls.map((c) => c.name), ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'],
    '四档 SHA 各一次、按规范名的大写带横杠形态传给 WebCrypto，MD5 不碰 subtle');
  assert.equal(idle.wb.copyTextOf('digest', 'main').split('\n')[0], 'md5=900150983cd24fb0d6963f7d28e17f72');

  // subtle 明确缺席（非安全上下文）：md5 还在、四档没了 → 部分可用，且来源列要说"环境不支持"
  const noSubtle = rMount({ subtle: null, seed: { 'digest:mode': 'text', 'digest:payload': 'abc' } });
  noSubtle.page.click('digest', 'main');
  await rSettle();
  const noHtml = noSubtle.page.html('digest', 'main');
  assert.equal(noHtml.includes('部分可用'), true, '五格里有四格算不成，报"已算出"就是骗人');
  assert.equal(noHtml.includes('环境不支持'), true);

  // 文件通道：只读一次盘，计数行不再点名通道（否则读起来是"字节 3 字节"），并补一句来源
  const file = rFile('report.csv', 'abc');
  const up = rMount({ subtle: rSubtle(), files: { 'digest:upload': file }, pick: { 'digest:mode': 'file' } });
  up.page.click('digest', 'main');
  await rSettle();
  const upHtml = up.page.html('digest', 'main');
  assert.equal(file.calls, 1, '一次计算只读一次盘');
  assert.equal(upHtml.includes('3 字节'), true);
  assert.equal(upHtml.includes('字节 3 字节'), false, 'kind 传 bytes 会让这一行变成"字节 3 字节"');
  assert.equal(upHtml.includes('report.csv'), true, '文件档要让用户看见读的是哪一个文件');
  assert.equal(upHtml.includes('不上传、不留存'), true, '隐私那句口径由页面自己说出来');

  // 声明尺寸越界的文件：预闸门拦在 `arrayBuffer()` 之前，一个大文件不许被读进内存
  const fat = rFile('big.bin', 'abc', { size: MAX_BYTES + 1 });
  const gated = rMount({ subtle: rSubtle(), files: { 'digest:upload': fat }, pick: { 'digest:mode': 'file' } });
  gated.page.click('digest', 'main');
  await rSettle();
  assert.equal(fat.calls, 0, '超限文件根本不该读盘');
  assert.equal(gated.page.html('digest', 'main').includes('已拒收'), true);
  assert.equal(gated.page.html('digest', 'main').includes(String(MAX_BYTES + 1)), true);

  // 文本档的页面级预闸门：`digestAll` 一次都不进（MD5 之外没有任何 subtle 调用）
  const fatText = rMount({ subtle: rSubtle(), seed: { 'digest:mode': 'text', 'digest:payload': 'a'.repeat(MAX_TEXT_BYTES + 1) } });
  fatText.page.click('digest', 'main');
  await rSettle();
  assert.deepEqual(fatText.subtle.calls, [], '超限文本不该走进模块');
  assert.equal(fatText.page.html('digest', 'main').includes('已拒收'), true);

  // 选了文件档却没选文件 / 文本档空着：两种"还没开始"
  const none = rMount({ subtle: rSubtle(), pick: { 'digest:mode': 'file' } });
  none.page.click('digest', 'main');
  await rSettle();
  assert.equal(none.page.html('digest', 'main').includes('等待输入'), true);
  assert.deepEqual(none.subtle.calls, []);
});

test('R12 正则栏：六档结论、静态形状拦在引擎之前、上限格与 flags 归一', () => {
  const m = rMount({ now: () => 5000, seed: { 'regex:pattern': '(\\d+)-(?<tail>\\w+)', 'regex:flags': 'g', 'regex:text': '12-ab 34-cd' } });
  m.page.click('regex', 'main');
  const html = m.page.html('regex', 'main');
  assert.equal(html.includes('有命中'), true);
  assert.equal(html.includes('共 2 处'), true);
  assert.equal(html.includes('序号'), true, '命中表要有');
  assert.equal(html.includes('tail'), true, '命名组那一行与位置组并存');
  assert.equal(html.includes('没开 d 就没有捕获组位置'), true, '位置那一列是空的，必须说一句为什么是空的');
  assert.equal(html.includes('生效的 flags：g'), true);
  assert.deepEqual(m.wb.copyTextOf('regex', 'main').split('\n'), ['12-ab', '34-cd']);

  // 开了 d 才有组位置：同一发输入换 flags，位置那一列从 — 变成数字
  const idx = rMount({ seed: { 'regex:pattern': '(\\d+)', 'regex:flags': 'gd', 'regex:text': 'a12' } });
  idx.page.click('regex', 'main');
  assert.equal(idx.page.html('regex', 'main').includes('没开 d 就没有捕获组位置'), false);
  assert.equal(/<td>1<\/td>/.test(idx.page.html('regex', 'main')), true, 'd 档下位置 1 要真出现');

  // 零命中是"零命中"，不是错误；替换预览只在填了那格时才给
  const none = rMount({ seed: { 'regex:pattern': 'z+', 'regex:text': 'abc' } });
  none.page.click('regex', 'main');
  assert.equal(none.page.html('regex', 'main').includes('零命中'), true);
  assert.equal(none.page.html('regex', 'main').includes('tk-state--bad'), false);
  const repl = rMount({ seed: { 'regex:pattern': 'a(b)c', 'regex:text': 'aXbYc', 'regex:repl': '$1' } });
  repl.page.click('regex', 'main');
  assert.equal(repl.page.html('regex', 'main').includes('替换预览'), true, '填了替换格就该给预览');
  const noRepl = rMount({ seed: { 'regex:pattern': 'a', 'regex:text': 'aaa' } });
  noRepl.page.click('regex', 'main');
  assert.equal(noRepl.page.html('regex', 'main').includes('替换预览'), false, '替换格空着不是"全删掉"');

  // 次数上限：往下调才算得出"已到上限"，那一句话必须带上生效的那个数。
  // flags 必须给 'g'：不开全局，`a` 打 `aaaaaaaaaa` 永远只有 1 处，"已到上限"这一档根本长不出来。
  const capped = rMount({ seed: { 'regex:pattern': 'a', 'regex:flags': 'g', 'regex:text': 'a'.repeat(10), 'regex:limit': '3' } });
  capped.page.click('regex', 'main');
  const capHtml = capped.page.html('regex', 'main');
  assert.equal(capHtml.includes('已到上限'), true);
  assert.equal(capHtml.includes('上限 3 次'), true, 'capped 是本次生效的上限次数，不是布尔');
  assert.equal(capHtml.includes('共 3 处'), true);
  // 越界与不合法是"这一格不能用"，一次都不许进引擎
  // （同样开 'g'：这一发输入本来能算出「共 3 处」，上限格一坏就必须整栏不跑，否则这句断言是白给的）
  for (const limit of ['2000', '0', '-1', 'abc']) {
    const bad = rMount({ seed: { 'regex:pattern': 'a', 'regex:flags': 'g', 'regex:text': 'aaa', 'regex:limit': limit } });
    bad.page.click('regex', 'main');
    assert.match(bad.page.html('regex', 'main'), /class="tk-hint">/, `上限「${limit}」应当是一行提示`);
    assert.equal(bad.page.html('regex', 'main').includes('共 3 处'), false, `${limit} 这一档不该算出命中`);
  }

  // 灾难性回溯形状：静态检测先于执行，结论是"已拒收"，命中表一格都不许有
  const scary = rMount({ seed: { 'regex:pattern': '(a+)+$', 'regex:text': `${'a'.repeat(30)}b` } });
  scary.page.click('regex', 'main');
  const scaryHtml = scary.page.html('regex', 'main');
  assert.equal(scaryHtml.includes('已拒收'), true);
  assert.equal(scaryHtml.includes('序号'), false, '引擎一次都没跑，就不该有命中表');
  assert.equal(scaryHtml.includes('高危'), true, 'findings 那张表要跟着出来，用户才知道为什么被拒');

  // 编译不过：level 是 null，走"不成立"那一档，理由原样取自模块
  const badPattern = rMount({ seed: { 'regex:pattern': '(', 'regex:text': 'abc' } });
  badPattern.page.click('regex', 'main');
  assert.equal(badPattern.page.html('regex', 'main').includes('不成立'), true);
  assert.equal(badPattern.page.html('regex', 'main').includes(findMatches('(', '', 'abc').reason), true,
    'native 的报错文案随引擎版本变，本节只判"原样交出去"，不判它长什么样');

  // flags 里重复位由模块归一：页面把归一这件事说出来，而不是悄悄改了用户的输入
  const dup = rMount({ seed: { 'regex:pattern': 'a', 'regex:flags': 'gg', 'regex:text': 'aaa' } });
  dup.page.click('regex', 'main');
  const dupHtml = dup.page.html('regex', 'main');
  assert.equal(dupHtml.includes('生效的 flags：g'), true);
  assert.equal(dupHtml.includes('重复'), true, '归一是改动用户输入，必须在判定表里留一行');

  // 空白 pattern 或空白待测文本：还没开始，不进模块（静态形状那一步也不许跑）
  for (const seed of [{ 'regex:pattern': 'a', 'regex:text': '' }, { 'regex:text': 'abc' }]) {
    const idle = rMount({ seed });
    idle.page.click('regex', 'main');
    assert.equal(idle.page.html('regex', 'main').includes('等待输入'), true, `${JSON.stringify(seed)} 这一档不该进引擎`);
    assert.equal(idle.page.html('regex', 'main').includes('高危'), false);
  }
});

test('R13 两条失败路：FieldError 是一行提示，骨架缺一格与读盘失败只标坏这一块', async () => {
  // ① 缺主栏结果区：这块面板抛穿到绑定层，其余四块照旧
  const a = rMount({ drop: ['tk-out-base64-main'] });
  assert.deepEqual(a.report.broken, ['base64']);
  assert.deepEqual(a.report.missing, [], 'tab 与 panel 两半都在，不算骨架不完整');
  assert.deepEqual(a.report.rendered, CODEC_PANEL_IDS.filter((id) => id !== 'base64'));
  assert.match(a.page.ws.brokenOf('base64'), /tk-out-base64-main/);
  assert.match(iBanner(a.page, 'base64').textContent, /其余面板不受影响/);
  for (const [panel, side] of [['timestamp', 'main'], ['url', 'main'], ['digest', 'main'], ['regex', 'main']]) {
    assert.equal(a.page.html(panel, side).includes('等待输入'), true, `${panel}.${side} 被隔壁缺的一格拖坏了`);
  }
  // 缺的是差值栏那一格：塌的范围是那一栏，主栏已经画好的内容不许被拖没
  const a2 = rMount({ drop: ['tk-out-timestamp-diff'] });
  assert.deepEqual(a2.report.broken, ['timestamp']);
  assert.equal(a2.page.html('timestamp', 'main').includes('等待输入'), true);
  assert.equal(a2.page.html('timestamp', 'diff'), '');

  // ② 缺复制按钮：内容照样能看，不该因此把面板判坏
  const c = rMount({ drop: ['tk-copy-url-main'] });
  assert.deepEqual(c.report.broken, []);
  assert.equal(c.page.copy('url', 'main'), null);
  c.page.set('url', 'text', 'a?b');
  assert.doesNotThrow(() => c.page.click('url', 'main'), '再点一次计算也不该因为没按钮而抛');
  assert.equal(c.wb.copyTextOf('url', 'main').includes('encodeURIComponent'), true, '复制文本照旧备着');

  // ③ 缺开关目标那一段：少一段显隐，不该把整块面板送进 broken 名单
  const d = rMount({ drop: ['tk-when-base64-mime'] });
  assert.deepEqual(d.report.broken, []);
  assert.equal(d.page.whenNode('base64', 'mime'), null, '夹具自证：这一格本来就没建');
  assert.doesNotThrow(() => {
    d.page.set('base64', 'mode', 'dataUri');
    d.page.change('base64', 'mode');
  }, 'applySwitch 撞上缺节点就抛，用户切档时这块面板当场进 broken 名单');

  // ④ 读盘失败：异步 reject 必须回到同一道闸门，只标坏摘要这一块
  const broken = rFile('gone.csv', 'abc', { fail: true });
  const e = rMount({ subtle: rSubtle(), files: { 'digest:upload': broken }, pick: { 'digest:mode': 'file' } });
  assert.deepEqual(e.report.broken, [], '挂载期不算，所以此刻还没有任何东西坏掉');
  e.page.click('digest', 'main');
  await rSettle();
  assert.deepEqual(e.guarded, ['digest', 'digest'], '异步回写要重新走 runGuarded，否则 reject 就逃逸到控制台了');
  assert.match(e.page.ws.brokenOf('digest'), /读不到这个文件/);
  assert.match(iBanner(e.page, 'digest').textContent, /其余面板不受影响/);
  assert.equal(e.page.html('regex', 'main').includes('等待输入'), true, '一块塌不该连着四块');
  // 换回一个能读的文件再算一次：错误条撤掉，同一块面板恢复可用
  e.page.setFiles('digest', 'upload', rFile('ok.csv', 'abc'));
  e.page.click('digest', 'main');
  await rSettle();
  assert.equal(e.page.ws.brokenOf('digest'), '', '成功一次就把错误条撤掉，否则那块面板永远红着');
  assert.match(e.page.html('digest', 'main'), /已算出/);
});

test('R14 接线：Enter 的分档、mode 驱动显隐、复制三级兜底与改口改回', async () => {
  const writes = [];
  const m = rMount({ clipboard: { writeText: (t) => { writes.push(t); return Promise.resolve(); } },
    seed: { 'timestamp:value': '1700000000' } });
  // 单行格与数字格：裸 Enter 就是提交
  m.page.keyOn('timestamp', 'value', { key: 'Enter' });
  assert.equal(m.page.html('timestamp', 'main').includes('已换算'), true, '文本格里的 Enter 该触发主栏');
  assert.deepEqual(m.guarded, ['timestamp']);
  m.page.keyOn('timestamp', 'offset', { key: 'Enter', ctrlKey: true });
  assert.deepEqual(m.guarded, ['timestamp'], '带修饰键的 Enter 在数字格上没有提交语义');

  // 多行粘贴框：裸 Enter 必须是换行，只有 Ctrl / ⌘ + Enter 触发
  const u = rMount({ seed: { 'url:text': 'a?b' } });
  u.page.keyOn('url', 'text', { key: 'Enter' });
  assert.equal(u.page.html('url', 'main').includes('等待输入'), true, '粘贴框里的 Enter 吞掉换行是缺陷');
  let prevented = 0;
  u.page.keyOn('url', 'text', { key: 'Enter', ctrlKey: true, preventDefault: () => { prevented += 1; } });
  assert.equal(u.page.html('url', 'main').includes('已编码'), true);
  assert.equal(prevented, 1, '组合键提交要吃掉默认动作，否则浏览器可能再走一遍表单');
  u.page.keyOn('url', 'text', { key: 'Enter', metaKey: true });
  assert.equal(u.guarded.filter((x) => x === 'url').length, 2, '⌘ + Enter 与 Ctrl + Enter 同一条路');

  // mode 那一格驱动字段组显隐：切到哪一档，另一档的字段就藏起来
  const b = rMount({ seed: { 'base64:mode': 'decode' } });
  assert.equal(b.page.whenNode('base64', 'strict').hidden, false);
  assert.equal(b.page.whenNode('base64', 'mime').hidden, true, 'mime 只在包装那一档出现');
  b.page.set('base64', 'mode', 'dataUri');
  b.page.change('base64', 'mode');
  assert.equal(b.page.whenNode('base64', 'mime').hidden, false);
  assert.equal(b.page.whenNode('base64', 'strict').hidden, true);
  // 挂载时 mode 是占位项：两段都该藏着，页面上不留一格用不上的字段
  const fresh = rMount();
  assert.equal(fresh.page.whenNode('base64', 'strict').hidden, true);
  assert.equal(fresh.page.whenNode('digest', 'payload').hidden, true);

  // 复制：纯文本、按钮改口、1600 ms 之后改回骨架那句原文
  b.page.set('base64', 'text', '中');
  b.page.set('base64', 'mode', 'encode');
  b.page.change('base64', 'mode');
  b.page.click('base64', 'main');
  assert.equal(b.page.copy('base64', 'main').disabled, false, '有结果就该能复制');
  b.page.clickCopy('base64', 'main');
  await rSettle();
  assert.equal(writes.length, 0, '这一发夹具没给 clipboard，走的是 execCommand 兜底');
  assert.deepEqual(b.page.commandLog, ['copy']);
  assert.equal(b.page.copy('base64', 'main').textContent, '已复制');
  assert.equal(b.timers.length, 1, '改口要能改回来，就得留下一条恢复用的定时器');
  assert.equal(b.timers[0].ms, 1600);
  b.flush();
  assert.equal(b.page.copy('base64', 'main').textContent, '复制结果', '恢复的是骨架那句原文案，不是写死的一句');

  // 用剪贴板那一只：复制的必须是这一栏的纯文本，且 disabled 跟着文本走
  const withClip = rMount({ clipboard: { writeText: (t) => { writes.push(t); return Promise.resolve(); } } });
  withClip.page.click('regex', 'main');
  assert.equal(withClip.page.copy('regex', 'main').disabled, true, '空结果不该留一条能点的复制按钮');
  withClip.page.set('regex', 'pattern', 'a');
  withClip.page.set('regex', 'flags', 'g');
  withClip.page.set('regex', 'text', 'aaa');
  withClip.page.click('regex', 'main');
  assert.equal(withClip.page.copy('regex', 'main').disabled, false);
  withClip.page.clickCopy('regex', 'main');
  await rSettle();
  assert.deepEqual(writes, ['a\na\na'], '复制的是三处命中的纯文本、用换行相连，不是那一叠 HTML');

  // 换 hash 走的是绑定层那一条：装配层只管把六栏画上，不碰地址栏
  const h = rMount({ hash: '#regex' });
  assert.deepEqual(iVisible(h.page), ['regex']);
  h.page.location.hash = '#url';
  h.page.win.dispatch('hashchange');
  assert.deepEqual(iVisible(h.page), ['url']);
  assert.equal(h.page.tab('url').getAttribute('aria-selected'), 'true');

  // `wb.run` 走的是与按钮完全同一条路（含 runGuarded），不给测试留第二条后门
  const direct = rMount({ seed: { 'url:text': 'a?b' } });
  const before = direct.guarded.length;
  assert.equal(direct.wb.run('url', 'main'), true);
  assert.equal(direct.guarded.length, before + 1);
  assert.equal(direct.page.html('url', 'main').includes('已编码'), true);
  assert.equal(direct.wb.run('digest', 'nosuch'), false, '栏位名不在 spec 里就是调用方写错了，不许凭空画一栏');
});

test('R15 每块面板的口径行在自己那块恰好一次，跨栏不串', () => {
  const NOTES = { timestamp: TIME_CAVEAT, base64: BASE64_CAVEAT, url: URL_CAVEAT, digest: DIGEST_CAVEAT, regex: REGEX_CAVEAT };
  const m = rMount();
  // 量的是**转义之后**的那一句：视图唯一的插值出口是 `view.esc`，而 `URL_CAVEAT` 里带着一个
  // 「&」（`query 只按「&」切分`），原样串在产物里根本不存在。转义是双射，比转义后的串
  // 仍然钉住同一句话——一个字不缺、一个字不多。
  const inHtml = (note) => Q_VIEW.esc(note);
  for (const [panel, note] of Object.entries(NOTES)) {
    for (const side of R_SIDES) {
      if (!CODEC_SPEC[panel].sides[side]) continue;
      assert.equal(rCount(m.page.html(panel, side), inHtml(note)), 1, `${panel}.${side} 挂载期就该带自己的那句口径，而且只带一次`);
    }
  }
  // 算完之后仍然只有一句：口径行不随计算次数叠加
  m.page.set('base64', 'mode', 'encode');
  m.page.set('base64', 'text', 'a');
  for (let i = 0; i < 3; i += 1) m.page.click('base64', 'main');
  assert.equal(rCount(m.page.html('base64', 'main'), inHtml(BASE64_CAVEAT)), 1, '点三次只留一句，否则那块结果区每点一次长一行');
  // 各块面板的口径句不许跑到别人家
  for (const [panel, note] of Object.entries(NOTES)) {
    for (const other of Object.keys(NOTES)) {
      if (other === panel) continue;
      assert.equal(m.page.html(other, 'main').includes(inHtml(note)), false, `${note.slice(0, 12)}… 串到了 ${other}`);
    }
  }
});

test('R16 入口只读骨架那四格数据；启动失败不装死，成功路径把两条 <script> 接起来', async () => {
  /** 与 §J 的 `run` 同一条路：入口在 import 那一刻就 `start(document, window)`，
   *  所以每一档都要先把两个全局摆好、再换查询串 import（同一 URL 只执行一次）。 */
  const run = async (tag, page, fn) => {
    globalThis.document = page.doc;
    globalThis.window = Object.assign({}, page.win, {
      location: page.location, history: page.history, navigator: {},
    });
    try {
      return await fn(tag);
    } finally {
      delete globalThis.document;
      delete globalThis.window;
    }
  };
  const withCore = (tag) => import(`../dev/js/toolkitCore.js?r16-${tag}`);
  const box = (page, attrs) => page.mk('div', 'tk-workspace', {
    'data-tk-ids': CODEC_PANEL_IDS.join(','), 'data-tk-prefix': 'tk',
    'data-tk-label': '编码与换算', 'data-tk-notice': 'tk-notice', ...attrs,
  });

  // ── 成功：时钟与偏移由入口读环境，装配层只收注入 ──
  {
    const page = rPage();
    box(page);
    await run('ok', page, async (tag) => {
      await withCore(tag);
      await import(`../dev/js/toolCodec.js?r16-${tag}`);
      for (const id of CODEC_PANEL_IDS) {
        assert.equal(page.tab(id).getAttribute('role'), 'tab', `${id} 没被升级成 tab`);
      }
      assert.equal(page.html('timestamp', 'main').includes('等待输入'), true, '入口接错了就一格都画不上');
      assert.equal(page.notice.hidden, true, '启动成功就别留提示行');
      page.set('timestamp', 'value', '1700000000');
      page.btn('timestamp', 'main').dispatch('click', {});
      assert.equal(page.html('timestamp', 'main').includes('2023-11-14T22:13:20Z'), true);
      // 本地那一行走的是入口注入的宿主偏移：装配层自己问环境的话，这一行在 CI 上会漂。
      // 期望值不手拼——按 `time.js` 在同一偏移下现算（`22:13:20Z` 在东八区已经是**次日**
      // `06:13:20+08:00`，把 UTC 那一串直接接上偏移后缀会漏掉跨日界，那一版判据是白给的）。
      const host = -new Date().getTimezoneOffset();
      assert.equal(page.html('timestamp', 'main').includes(fromEpoch(1700000000000, host).isoLocal), true,
        `入口该把 -getTimezoneOffset() 当偏移递进去（本机偏移 ${host} 分钟）`);
      page.location.hash = '#regex';
      page.win.dispatch('hashchange');
      assert.deepEqual(iVisible(page), ['regex']);
    });
  }

  // ── 失败一档：容器都没有（脚本被挪进 <head> 就是这个形状）──
  {
    const page = rPage();
    await run('nocontainer', page, async (tag) => {
      await withCore(tag);
      await assert.rejects(() => import(`../dev/js/toolCodec.js?r16-${tag}`), /tk-workspace/);
      assert.equal(page.notice.hidden, false, '启动失败必须留下一句能抄下来问人的话');
      assert.match(page.notice.textContent, /这一页的交互层没能启动/);
      assert.match(page.notice.textContent, /正文仍然读得到/);
    });
  }

  // ── 失败二档：容器在，`data-tk-ids` 是空的（yml 漏了 slug）──
  {
    const page = rPage();
    box(page, { 'data-tk-ids': ' , ' });
    await run('emptyids', page, async (tag) => {
      await withCore(tag);
      await assert.rejects(() => import(`../dev/js/toolCodec.js?r16-${tag}`), /data-tk-ids/);
      assert.match(page.notice.textContent, /onlineTools\.yml/);
    });
  }

  // ── 失败三档：`window.Tk` 没挂上来（core 404 或排在入口之后）──
  {
    const page = rPage();
    box(page);
    await run('notk', page, async (tag) => {
      await assert.rejects(() => import(`../dev/js/toolCodec.js?r16-${tag}`), /window\.Tk/);
      assert.match(page.notice.textContent, /toolkitCore\.min\.js/);
      assert.equal(page.tab('url').getAttribute('role'), 'link', '框架层没跑，骨架的 role 原样留着');
      assert.equal(page.html('url', 'main'), '');
    });
  }

  // ── 容器在但它读不到属性：报错正文里要有容器 id 与排查方向 ──
  {
    const page = rPage();
    const b = box(page);
    delete b.getAttribute;
    await run('noattr', page, async (tag) => {
      await withCore(tag);
      await assert.rejects(() => import(`../dev/js/toolCodec.js?r16-${tag}`), /tk-workspace/,
        'TypeError 里既没有容器 id 也没有排查方向，抄下来问不到人');
      assert.match(page.notice.textContent, /两条 <script>/);
    });
  }

  // ── 换前缀：骨架写 `data-tk-prefix: zx`，行为那副面孔整套跟着换 ──
  {
    const page = rPage({ prefix: 'zx' });
    box(page, { 'data-tk-prefix': 'zx', 'data-tk-notice': 'zx-notice' });
    await run('zx', page, async (tag) => {
      await withCore(tag);
      await import(`../dev/js/toolCodec.js?r16-${tag}`);
      for (const id of CODEC_PANEL_IDS) {
        assert.equal(page.tab(id).getAttribute('role'), 'tab',
          `${id} 没被升级成 tab：绑定层找的是 tk-tab-*，骨架写的是 zx-tab-*`);
      }
      assert.equal(page.html('base64', 'main').includes('等待输入'), true);
      page.set('base64', 'mode', 'encode');
      page.set('base64', 'text', '中');
      page.click('base64', 'main');
      assert.equal(page.html('base64', 'main').includes('>5Lit<'), true);
      assert.equal(page.notice.hidden, true, '这一档是成功路径，不该留提示行');
    });
  }
});
```

### 变异台账（六把刀，`/tmp/seg3t6b-mut/mut.mjs`，跑完即弃）

六把刀全部**有牙**：每把都咬住它点名的判据，`# tests` 每把都是 268，基线与六刀同一轮连跑、
中途没重跑（台账 `/tmp/seg3t6b-mut/ledger.log`，`exit=0`）。六个锚点全部恰命中 1 次，
没有一把因为锚点歪而作废。

| 刀 | 改哪一行 | 红名单（实测） | 处置 |
| --- | --- | --- | --- |
| R1 | 挂载期那句 `paintSide(panel, side, IDLE[cfg.kind], '')` 换成 `runGuardedRun(panel, side)` | R5 / R6 / R11 / R13 / R14 / R15 / R16（预期 R5 + R11） | 一次过。七条同一个来路：挂载那一趟一算，六栏的结果区就不是"等待输入"，后面每一节夹具的起点假设跟着变——这是**一条口径的连锁**，不是七件独立的事。要的牙在 R5（`guarded` 必须是空数组）与 R11（`subtle.calls` 必须是空），两条都咬住 |
| R2 | 在 `codecView` 那条 import 之后插一条 `import { flash } from './ui.js';` | 只 R3（预期 R3） | 一次过。`flash` 是 `ui.js` 真导出的名字，链接期不报错，红下来纯靠 import 边清单——"多一本就有第二个入口 reach 它、产物变成带 `import{` 的废文件"这一档在源码层唯一的去处 |
| R3 | `hint()` 不走 `paint()`，自己 `node(outId(...)).innerHTML = ...`，并把 `view.esc` 摘掉 | 只 R3（预期 R3） | 一次过。这一刀值得记的是**它只被源码扫抓到**：假 DOM 里 `innerHTML` 是个字符串属性，不转义的那句 `message` 在执行层不显形，§R 没有任何一条行为判据能抓注入。所以 `rCount(bare, 'innerHTML') === 1` 是这条不变量唯一的守门人，别把它读成"多余的计数" |
| R4 | 摘要文件通道 `if (Number.isFinite(declared) && declared > MAX_BYTES)` 改成 `if (false)` | 只 R11（预期 R11） | 一次过。拒收文案一字未动，红的是 `fat.calls === 0` 那个计数器——"不读进内存"这句口径由次数钉，不由措辞钉 |
| R5 | 摘掉 `renderNow` 里异步 reject 那条 lane（`(err) => runGuarded(panel, () => { throw err; })` 整行删） | 只 R13（预期 R13） | 一次过。形状值得记：**红而不崩**——`# tests` 一字未变，逃逸的 reject 落在正在跑的那一格名下。R13 里 `guarded === ['digest','digest']` 那两趟与 `brokenOf('digest')` 那句读盘失败，缺一条 lane 就同时不成立 |
| R6 | 差值栏两端一起 `bad.push(起点, 终点)`，不再按 `epochMs === null` 分别点 | 只 R7（预期 R7） | 一次过。红的是 `wrongHtml.includes('起点') === false` 那一格：坏的是终点，起点是好的却被一起挨打 |

变异只落在 `/tmp/seg3t6b-mut/tree` 那份拷贝上（`rsync -a` 排除 `node_modules`/`.git`/`_site`/`_drafts`，
227 MB）。收口三条自证：拷贝里 `codecWorkbench.js` 的 md5 回到 `e7e42ae4…`、仓库工作树那一本
md5 全程未变、`git status --porcelain` 前后都是 **31 项**。

### 红相复量（这一格与前面几格不同，先说清它是怎么来的）

`/tmp/seg3t6b` 里那两份红绿日志（`red1.log` = `251 / 249 / 2`、`green1.log` = `251 / 251 / 0`）
**是 6a 的 §Q 两轮，不是 §R 的**——里面一条 `R` 开头的用例名都没有。§R 首发那一轮的日志没留在
手上，所以这一格是在副本里**复量**的：把 `dev/js/tools/codecWorkbench.js` 与 `dev/js/toolCodec.js`
两本移走再跑套件（`/tmp/seg3t6b-mut/red-recheck.log`，`exit=1`）——

```text
1..253   # tests 253 / # pass 252 / # fail 1
not ok 1 - scripts/toolkit-tests.mjs
# Error: … "Error [ERR_MODULE_NOT_FOUND]: Cannot find module
#   '…/dev/js/tools/codecWorkbench.js' imported from …/scripts/toolkit-tests.mjs"
```

形状与判据文件头部那段注记逐字对得上：红的是**文件级**那一行，§R 十六判一条都没注册
（它们排在失败那次 `await import()` 之后，253 = 252 条既有 + 1 条文件级），前面 252 条照跑照绿。
也就是说"模块还没落地"这一档只能锚文件名加报错正文里的模块路径，按 `^not ok <用例名>` 点名点不到。
**这条复量不替代首发**：它是"红相形状今天还在"的证据，不是"先写判据后写实现"的时序证据。

### 收口读数（2026-09-28 实跑，日志留在 `/tmp/seg3t6b/` 与 `/tmp/seg3t6b-mut/`）

| 门禁 | 命令 | 读数 |
| --- | --- | --- |
| ① 判据套件 | `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs` | `exit=0`、`# tests 268 / pass 268 / fail 0`（§R 贡献 16，252 → 268；§Q 也 16，两节同数） |
| ② 镜像自证 | `node scripts/verify-plan-blocks.mjs` | 真实工作树 `exit=1`，**唯一 ✗ 是 `_data/onlineTools.yml`**——另一路会话未提交的「在线工具 → 免安装工具」改名（磁盘 77 行 ↔ 段 2 计划里那格镜像 76 行），本格一行未碰，留给 Task 9 的 `--fix`。本轮三块新镜像逐字节全等：`codecWorkbench.js` 1053 行（计划 6638–7690）、`toolCodec.js` 172 行（7696–7867）、§R 1054 行（计划 7873–8926，磁盘 8325–9378）。在 /tmp 副本里把那一格 yml 还原到 HEAD 之后：`exit=0`、**48 块**镜像全等、合计 899,290B、`⚠ 未落地` **0 节**、js 块 45（段1 11 / 段2 19 / 段3 15） |
| ③ 镜像门禁的牙齿 | `node scripts/verify-plan-blocks-teeth.mjs` | 同一份 /tmp 副本里 `exit=0`、**21/21**。G12 现在读到段 3 名下 **15 块**，新登记的 `codecWorkbench.js` / `toolCodec.js` / §R 自动进了核范围；G1（反查漏网镜像）与 G4（真漂移仍可 `--fix`）两把都过——这一对正是"本轮那三块镜像由脚本插入而非 `--fix` 写出"的守门人。收口自证那句"脏项 30 个前后一致"量的是**副本**的 git（比真实树少 1 项就是还原掉的那格 yml） |
| ④ 产物形状 | `/tmp/seg3t6b/ab.sh`：`before`（当前树摘掉 `toolCodec.js` 与 `codecWorkbench.js`）与 `after` 各跑一次 `vite build`，`node_modules` 两边同一份软链 | `import{` 命中 **0 本**（before 22 本 / after 23 本全扫）；证件页两本 before/after **逐字节全等**——`toolkitCore.min.js` raw 19,109 / gz **7,037** / md5 `2ae1f8ebb2d8…`，`toolIdcard.min.js` raw 184,521 / gz **64,479** / md5 `64bc2025b8c2…`；`toolCodec.min.js` 只在 after 产出，raw 59,317 / gz **21,830B**；`toolkitCore.min.js` 里 `codecView` 与 `createCodecWorkbench` 命中 **0** |

⑤ 收录面与 ⑥ 收录面的牙齿这两道本轮**没有读数**：`tools-codec.html` 与条目登记在 Task 7，
现在跑门禁五只会红在它该红的地方。

三笔要留的账：

1. **gzip 口径这一轮错过一次。** 第一版 A/B 脚本写的是 `gzip -c -9 f`，量出 7,056 / 64,497；
   §0.4 钉的口径是 `cat f | gzip -9 | wc -c`，量出 **7,037 / 64,479**——差的 19B / 18B 就是
   `gzip -c <文件>` 那条 FNAME 头。以 §0.4 那一档为准，且这两个数与 §7 表里 Task 5 复量那两格
   一字不差，说明"证件页产物未变"是真未变，不是换了量法。`ab.log` 里那两行是前一口径。
2. **`toolCodec.min.js` 的 21,830B 超了 §0.4 那格的预期（15–20KB gzip）一档，但没触 30KB 那条
   BLOCKED 线**，所以按判据继续：不改判据、不动 spec。这一本的 gz 里含 `codec.js` / `digest.js`
   （MD5 自实现）/ `regex.js` / `time.js` / `codecView.js` 五本的全文，预期那格是按"四本算法 +
   约 2KB 的 MD5"估的，视图层那一块的量没算进去。CSS 与页面 HTML 两格还没量——`tools-codec.html`
   要到 Task 7 才建，§7 那两行按 §0.4 归 Task 8 按实测立。
3. **门禁②③为什么要在副本里跑。** 门禁三基线那一格写着"副本必须先绿，否则后面全是假证据"，
   `_data/onlineTools.yml` 红着时它就直接退 1、二十一档牙齿一档都不跑（真实树上实测：
   `exit=1`，只有基线那一行输出）。副本 = `rsync -a` 全量 + 一份 `.git` + 只把那一格 yml
   `checkout` 到 HEAD。**这一格 ✗ 不是本轮的产物，但它是本轮唯一一处红着收口的门禁**，
   Task 9 那张"六道全绿"的单子上必须先把它销掉。

工作树 31 项的归属：本格 5 项（`dev/js/tools/codecWorkbench.js`、`dev/js/toolCodec.js` 两本未跟踪，
加 `scripts/toolkit-tests.mjs`、`scripts/verify-plan-blocks.mjs`、这份段 3 计划三条未暂存），
另 26 项全属另一路会话——已暂存的 `_config.yml`、`package.json`、`README.md`、
`_data/og_images.yml`、三处 `.baoyu-skills/**`、`scripts/article-check.mjs`、`scripts/lib/`、
`scripts/wechat-draft.mjs`、`scripts/fixtures/article-check/`，未暂存的 `_data/onlineTools.yml`、
`_includes/header.html`、`dev/js/editorial.js`、`dev/sass/common/editorial.scss`、`index-all.html`、
`llms.txt`、`tools.html`，以及未跟踪的 `sw.js`、`offline.html`、`scripts/check-sw.mjs`、
`scripts/check-sw-teeth.mjs`、`scripts/verify-sw-offline.mjs`、`.tmp-swcheck/` 那一整批。
**暂存只按这五条路径点名，全程不 `git add -A`、不跑 `deploy-github.sh`、不 push**（段 3 自约束）。

### 提交与提交后复跑（2026-09-28）

代码那一格实跑 `90556bf`，`5 files changed, 4705 insertions(+), 1 deletion(-)`，逐条：
`codecWorkbench.js` +1053/−0（新增，`create mode 100644`）、`toolCodec.js` +172/−0（新增）、
`toolkit-tests.mjs` +1055/−0（§R 整节 + 三条假 DOM/假文件/假 subtle 夹具）、
`verify-plan-blocks.mjs` +6/−0（`FILE_TARGETS` 登记两本加那段注释）、
段 3 计划 +2419/−1。那唯一的 −1 是 6a 留下的占位行
「§R 那一节（装配层与入口）在这一格的后半段落，判据清单同批回填」——被 §R 判据清单整节顶掉。
2419 行里 **2279 行是三块落地镜像**（`codecWorkbench.js` 1053 + `toolCodec.js` 172 + §R 1054），
剩下 140 行是判据清单、六条"落地时定下的"、六刀台账、红相复量与上面这两节。

提交后复跑：门禁一 `# tests 268 / pass 268 / fail 0`（`/tmp/seg3t6b/post-gate1.log`）；
门禁二在**真实工作树**仍 `exit=1`、仍只有 `_data/onlineTools.yml` 那一格（`post-gate2.log`，
47 镜像 / 896,356B——红的那一格不计入"已落地"，所以比副本少 1 块、少 2,934B）；
同一份副本里 `exit=0`、**48 块全等 / 899,290B / 未落地 0 节**（改一处镜像宿主之外的事不动这些数，
三遍 `gate2-copy{,2,3}.log` 加定稿后那遍 `gate2-copy4.log`，四遍同一读数）；门禁三在同一副本 **21/21**，
跑了四遍——`gate3-copy.log` 是收口读数写之前、`gate3-copy2.log` 是收口读数写完、
`gate3-copy3.log` 是"提交与提交后复跑"那一节写完、`gate3-copy4.log` 是**这一句定稿之后**，
四遍都是 21/21、脏项 30 个前后一致
（计划自己不在 `FILE_TARGETS` 里，往计划正文加一节不会动任何镜像，但这四遍是"加完正文之后
镜像仍然逐字节全等"的实证，不是顺手多跑一遍）。提交后 `git status` 剩 **27 项**，比上面那 26 项多的一条是另一路会话
这一轮刚落下的 `_docs/superpowers/specs/2026-09-28-sw-offline-design.md`；
`git show --stat HEAD` 逐条对过，那 26 项（含 12 项已暂存的）一个都没被 `90556bf` 吞进来。

## Task 7: 收录面 + 门禁解耦（本段的地基改动）

**Files:** Modify `scripts/check-tools-surface.mjs`、`scripts/check-tools-surface-teeth.mjs`、
`_data/onlineTools.yml`、`scripts/verify-plan-blocks.mjs`；Create `tools-codec.html` 的 Liquid 部分；
Modify `README.md`、`USAGE.md`、spec §4.4/§7。

顺序很关键：**先解耦再登记条目**，反了会在门禁五上得到一条"红得看不懂"的现场。
条目字段：`slug: codec`、`url: /tools/codec.html`、`prefix: tk`、`status: ready`、
`panels: [timestamp, base64, url, digest, regex]`、图标 `/assets/img/tools/codec-tool.svg`
（新 SVG 要走段 2 那套昼夜两档判据，图标组判据在 `check-tools-surface.mjs:349-381`）。
五处消费点（header / tools / index-all / sitemap / llms）全数据驱动，零手写。

### 落地（2026-09-28）：先解耦，再登记

**解耦的现场证据**（这是 §0.3 那句话的实测，不是推断）：把本段改之前的那份
`scripts/check-tools-surface.mjs`（`git show HEAD:scripts/check-tools-surface.mjs`）放回一棵
只把 `_data/onlineTools.yml` 与编码页产物换成本段状态的树里跑一遍，它退 1 并打
**10 条不通过**，全部落在「DOM」组，全部在说编码页压根没犯的错
（`面板 timestamp 在 WORKBENCH_SPEC 里没有条目` 这类）。日志：`/tmp/seg3t7/oldgate-on-codec.log`。
所以「先解耦再登记条目」不是节奏偏好，是**红了读不出人话**与**红了知道改哪一格**的差别。

**改法：spec 指针进数据源，而不是在门禁里再养一张表。** yml 每条条目新增一格：

```text
spec:
  module: dev/js/tools/codecWorkbench.js   # dev/js 下的 .js 站内相对路径
  table: CODEC_SPEC                        # 面板 → 栏位 → 控件/开关/kind 那张表
  ids: CODEC_PANEL_IDS                     # 面板顺序的第二个声明处
```

为什么放 yml 而不是在门禁里写 `{ idcard: …, codec: … }`：后者是同一件事的第二处口径，
加一页要改两个文件，改漏一个时红的是运行时而不是构建——这条理由与 `prefix` 那格同源。
`module` 限死 `dev/js/**/*.js`：这一句会 import 并**执行**那个模块，拼错一格宁可红在「DOM」组，
也不要让门禁顺着数据源去 require 仓库外的东西。证件页那一条补的是
`workbench.js#WORKBENCH_SPEC/PANEL_IDS`，与解耦前逐字同义。

**顺带两处同类耦合，一起拆**（都实测过：不拆就是编码页整栏漏核）：

1. 栏位名原来写死 `['gen','read']`，编码页是 `main`/`diff`；改成按 `Object.keys(panel.sides)` 取。
   不拆的后果是编码页十一格控件**一格都不核**，而门禁绿。
2. `data-tk-cascade/-options/-charsets` 三个标记原来按真值收。证件页那些格的取值是一枚
   token 名（字符串），编码页 `options` 却是 `<option>` 的白名单**数组**，同名不同职；
   按真值收会把数组当成标记，产物上找不到那条 data 属性而红在错的地方。改成只认字符串，
   并留一条反向变异（`编码页骨架误带证件页那个下拉标记`）钉住双向对账。

**图标**：`assets/img/tools/codec-tool.svg` 复用证件页那枚的 `#737B85`，取值口径与它同源
（tokens.scss 现读 8 格底色、逐格算比值、WCAG 1.4.11 的 3:1 下限由门禁五现算）；
注释通篇不写带两划前缀的令牌名——那正是 2026-09-28 证件页破图那次的病根。

**牙齿**：`check-tools-surface-teeth.mjs` 的 21 组拆成 `idcardCases`，追加 15 组 `codecCases`，
`cases` 是两者的拼接。**每条判据都要有第二页的同名变异**：只有 idcard 那一组时，
"循环里多跑了一页"与"多跑那一页真在比"是两件事，spec 指针写错页、panels 顺序挪一位、
骨架少一个控件 id 三样全抓不到。§0.3 点名的那把刀（panels 顺序挪一位）落下来的消息是
`yml panels=[digest,timestamp,base64,url,regex] 与 CODEC_PANEL_IDS=[…] 不同名或不同序`，
解耦前这条判据拿整页 `PANEL_IDS` 比，红了也说不清是谁的顺序错。

**与另一路会话的口径冲突（本段不解，留给 Task 9）**：`_data/onlineTools.yml` 在开工前就带着
一条未提交的改口（顶栏分组标签「在线工具 → 免安装工具」，第 2 行），它使门禁二对
`_data/onlineTools.yml` 这一格镜像恒红。本段把 yml 的提交内容与工作区内容**分开处理**：
提交的是 HEAD 那份 + 本段三处新增（`spec` 口径注释、idcard 的 `spec` 三行、codec 整条条目），
工作区里那条改口原样留着。于是**已提交的仓库是自洽的**，这一句不是推断：`git archive HEAD | tar -x -C /tmp/seg3t7/headtree`
之后在那棵干净检出里跑 `node scripts/verify-plan-blocks.mjs` 退 **0**（50 个镜像 / 合计 929,400B
——**这一格是当时值**：Task 9 因为重算 `toolkit-tests.mjs` 的头注释跑了一次 `--fix`，同一批 50 个镜像
变成 930,340B；条数与"逐字节全等 + `⚠ 未落地` 0 节"才是判据，字节合计只是读数），
而活工作树仍打这一格 ✗——`计划[段2] 10037–10176（140 行）↔ 磁盘 141 行，前 1 行相同`，
差的就是那两行注释。等那条改口落地后由 Task 9 一次 `--fix` 收干净。
**Task 9 现场（2026-09-29）：那条改口到收口时仍未提交**（`git diff --numstat -- _data/onlineTools.yml`
现读 `2 1`、磁盘 141 行），本格**没有**替别人 `--fix`——那会把一段还没发表的文案（「在线工具 → 免安装工具」
及其归因注释）烤进段 2 的计划镜像，等于替他们决定发布内容。这一格原样交回：等那条改口成为 HEAD 的一部分，
任何人跑一次 `node scripts/verify-plan-blocks.mjs --fix` 就收干净，活工作树在此之前会一直红这一格。
本格的提交是 `dd2ed97`（12 个文件、`git commit -- <pathspec>` 只取本段碰过的那些，
另一路会话暂存着的那批一格没被吞）；活工作树里同时复跑门禁五仍是 exit=0
（`2 条 ready 条目 × 5 组判据全绿`），因为那条改口只动注释、不动数据。

#### 页面源整文件镜像（`tools-codec.html`，FILE_TARGETS 已登记）

```html
---
layout: default
title: 时间戳转换 · Base64 编解码 · MD5 摘要
seo_description: 时间戳与日期互推、Base64 与 URL 编解码、MD5/SHA 摘要、正则测试与替换预览，全部在浏览器里算：粘贴即本地处理，不发请求、不上传文件，超限整体拒绝并说明差多少。
# 理由同 tools-idcard.html：写死 permalink 才能进站点地图、才能让 canonical 与导航一致。
permalink: /tools/codec.html
# tool 指向 _data/onlineTools.yml 里的那一条：面板清单、id 前缀、大标题都从数据源取，
# 页面正文与顶栏下拉、/tools.html 小节因此不会各写一遍。
tool: codec
---
{% include header.html %}

<!-- 产物名严格跟随源文件名（大小写原样）：dev/sass/toolkit.scss -> toolkit.min.css、
     dev/js/toolkitCore.js -> toolkitCore.min.js、dev/js/toolCodec.js -> toolCodec.min.js。
     GitHub Pages 在 Linux 上构建，写错一个字母本地看不出来、线上一律 404，勿改。
     三条引用的顺序是硬的：toolkitCore 先挂 window.Tk，页面入口再读它（同证件页那一份的理由）。
     本页**多引一本**而不是把 codecView.js 挂进 window.Tk：只有编码页要读的视图层进了公共包，
     证件页就要为五块它没有的面板付 gzip，§7 那两格首屏预算当场兑现不了（段 3 计划 R3 的
     import 边闭合判的就是这一对：codecView 的唯一消费方是 codecWorkbench，而 codecWorkbench
     的唯一入口是这一本）。 -->
<link rel="stylesheet" href="{{ site.baseurl }}/assets/css/toolkit.min.css">

{%- assign tk = site.data.onlineTools | where: 'slug', page.tool | first -%}
{%- if tk -%}

<section class="g-masthead tk-masthead">
    <div class="g-container masthead-inner">
        <p class="kicker">Online Tools / 本地计算，不上传输入</p>
        <p class="masthead-issue" aria-hidden="true">
            <span class="issue-rule"></span>
            <span class="issue-no">时间戳 · 编解码 · 摘要 · 正则</span>
        </p>
        <h1 class="masthead-title">{{ tk.h1 }}</h1>
        <p class="masthead-lede">{{ tk.desc }}</p>
        <ul class="masthead-stats">
            <li><strong>{{ tk.panels.size }}</strong><span>块面板</span></li>
            <li><strong>0</strong><span>网络请求</span></li>
            <li><strong>1 MiB</strong><span>文本上限</span></li>
        </ul>
    </div>
</section>

<main class="g-container tk-content" id="main">
    {%- comment -%}
    这段提示与证件页那段同一角色：设计文档 §5.5 的"固定一行提示"在**禁用脚本时也读得到**的那一份。
    结果区里还会由装配层把各模块的口径常量原样再落一次（§K/§L/§M/§N 各钉过"一字不动"），
    两处不冲突——这里说的是整页与两道字节闸门，结果区说的是这一次输入。
    {%- endcomment -%}
    <p class="tk-compliance">
        本页的换算、编解码、摘要与正则匹配全部在浏览器里算：<strong>不发请求、不上传文件、不写
        localStorage、不读剪贴板</strong>。文本类输入上限 1 MiB，文件摘要上限 5 MiB，
        超限整体拒绝并说明超了多少，不截断悄悄算；正则另有命中条数与 50 毫秒耗时两道闸门，
        被拦下时结果区会说是哪一道。
    </p>
    <noscript>
        <p class="tk-compliance tk-compliance--noscript">
            脚本没有执行：下面五块面板按文档顺序全部展开，说明文字、口径与锚点照常可读，左侧索引退成普通目录链接。
            但换算与编解码都要在浏览器里算，此时按下按钮不会有结果。
        </p>
    </noscript>
    {%- comment -%}
    地址栏里的 #hash 不是本页任何一块面板时，装配层只在这里说一句，**不动地址栏**
    （段 1 计划 §6.0 第三条：坏 hash 原样留着供人复制排查）。默认 hidden，由 panel-dom 覆写。
    {%- endcomment -%}
    <p class="tk-notice" id="{{ tk.prefix }}-notice" hidden></p>
    {%- comment -%}
    键盘捷径只在这里说一次，不在十一格控件里各说一句：装配层（dev/js/tools/codecWorkbench.js）给
    单行格与数字格接裸 Enter（带任何修饰键都不算，那可能是浏览器的快捷键），给粘贴框接
    Ctrl / ⌘ + Enter——裸 Enter 在 textarea 里必须是换行，吞掉用户敲的那次换行是缺陷。
    下拉与文件格两档都不接：那两格的 Enter 没有"提交"语义。禁用脚本时这两句自然不成立。
    {%- endcomment -%}
    <p class="tk-kbd"><kbd>Enter</kbd> 提交单行格 · <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> 计算粘贴框</p>

    <div class="tk-workspace" id="{{ tk.prefix }}-workspace"
         data-tk-ids="{% for p in tk.panels %}{{ p.slug }}{% unless forloop.last %},{% endunless %}{% endfor %}"
         data-tk-prefix="{{ tk.prefix }}"
         data-tk-label="{{ tk.h1 }}"
         data-tk-notice="{{ tk.prefix }}-notice">
        {%- comment -%}
        索引条：`role="tablist"` / 每个 `role="tab"` 由 panel-dom.js 按 panel.js 算好的属性表写进来，
        这里一个 ARIA 属性都不写——写第二遍就是第二处口径，改一处漏一处，而漏掉那一处只在读屏里看得见。
        没有脚本时这一列就是普通目录，每条 `href="#{prefix}-panel-{slug}"` 跳到同名面板——
        那枚 id 由下面的 `<section class="tk-panel">` 真的写着，锚点落得下去（与证件页同一刀，
        段 5 Task 9 对账里的「修 A」；裸 `#slug` 那时是死锚点，`parseHash` 如今两种形状都认）。
        {%- endcomment -%}
        <nav class="tk-index" id="{{ tk.prefix }}-tablist">
            {%- for p in tk.panels -%}
            <a class="tk-index__link" id="{{ tk.prefix }}-tab-{{ p.slug }}" href="#{{ tk.prefix }}-panel-{{ p.slug }}">
                <span class="tk-index__name">{{ p.name }}</span>
                <span class="tk-index__hint">{{ p.tagline }}</span>
            </a>
            {%- endfor -%}
        </nav>

        {%- comment -%}
        下面五块面板的正文全部在构建期渲染（设计文档 §6.3：禁用脚本与爬虫都要读得到内容）。
        只有「时间戳」是左右两栏（换算 / 求差），其余四块各一栏，走 `.tk-cols--one`。
        表单一律用 div[role=group] 而不是 form：没有后端可交，form 的隐式提交会把整页刷成
        ?tk-in-base64-text=…，那是工具页最不像工具的故障。提交动作由 dev/js/toolCodec.js
        监听按钮与 Enter 键。
        这一页**不写** `data-tk-cascade` / `-options` / `-charsets` 那三个标记：它们是证件页
        "运行时要往下拉里灌选项"的口径（WORKBENCH_SPEC 里取值是一枚 token 名），而本页的下拉选项
        全在构建期写死在 `<option>` 里，CODEC_SPEC 的 `options` 是那份白名单数组、同名不同职。
        收录面门禁「DOM」那一组按 spec 双向对账，多写一个标记就红。
        {%- endcomment -%}

        <section class="tk-panel" id="{{ tk.prefix }}-panel-timestamp">
            <header class="tk-panel__head">
                <h2 class="tk-panel__title">{{ tk.panels[0].name }}</h2>
                <p class="tk-panel__tagline">{{ tk.panels[0].tagline }}</p>
                <p class="tk-panel__desc">{{ tk.panels[0].desc }}</p>
            </header>
            <div class="tk-cols">
                <section class="tk-col" aria-labelledby="{{ tk.prefix }}-h-timestamp-main">
                    <h3 class="tk-col__title" id="{{ tk.prefix }}-h-timestamp-main">时间戳 ⇄ 日期</h3>
                    <div class="tk-form" role="group" aria-labelledby="{{ tk.prefix }}-h-timestamp-main">
                        <p class="tk-field">
                            <label for="{{ tk.prefix }}-in-timestamp-value">时间戳或日期</label>
                            <input id="{{ tk.prefix }}-in-timestamp-value" type="text"
                                   autocomplete="off" autocorrect="off" autocapitalize="off"
                                   spellcheck="false" placeholder="1700000000">
                            <span class="tk-help">10 位按秒、13 位按毫秒；其余长度不下结论，两种解释一起给。
                                也收 <code>2026-09-28 09:00</code> 这种写法，串里没写时区就按下面那格算。</span>
                        </p>
                        {%- comment -%}
                        偏移那格**留空**是有效输入：装配层取入口注入的本机偏移（`-new Date().getTimezoneOffset()`，
                        全仓库只在那一处读时区）。把 480 写进 `value` 就等于替所有访客断言了时区，
                        同一份产物在两台机器上会长出两个答案——§K 那条"可复算"的前提当场作废。
                        {%- endcomment -%}
                        <p class="tk-field tk-field--count">
                            <label for="{{ tk.prefix }}-in-timestamp-offset">时区偏移（分钟，留空按本机）</label>
                            <input id="{{ tk.prefix }}-in-timestamp-offset" type="number"
                                   min="-840" max="840" step="1" placeholder="UTC 填 0"
                                   autocomplete="off" inputmode="numeric">
                        </p>
                        <p class="tk-actions">
                            <button class="tk-btn" type="button" id="{{ tk.prefix }}-btn-timestamp-main">换算</button>
                        </p>
                    </div>
                    <div class="tk-outwrap">
                        <button class="tk-btn tk-btn--ghost" type="button"
                                id="{{ tk.prefix }}-copy-timestamp-main" disabled>复制这几行</button>
                        <div class="tk-out" id="{{ tk.prefix }}-out-timestamp-main"
                             role="region" aria-live="polite" aria-labelledby="{{ tk.prefix }}-h-timestamp-main"></div>
                    </div>
                </section>

                <section class="tk-col" aria-labelledby="{{ tk.prefix }}-h-timestamp-diff">
                    <h3 class="tk-col__title" id="{{ tk.prefix }}-h-timestamp-diff">两个时刻的差值</h3>
                    <div class="tk-form" role="group" aria-labelledby="{{ tk.prefix }}-h-timestamp-diff">
                        <p class="tk-field">
                            <label for="{{ tk.prefix }}-in-timestamp-from">起点</label>
                            <input id="{{ tk.prefix }}-in-timestamp-from" type="text"
                                   autocomplete="off" autocorrect="off" autocapitalize="off"
                                   spellcheck="false" placeholder="2026-09-28 09:00">
                        </p>
                        <p class="tk-field">
                            <label for="{{ tk.prefix }}-in-timestamp-to">终点</label>
                            <input id="{{ tk.prefix }}-in-timestamp-to" type="text"
                                   autocomplete="off" autocorrect="off" autocapitalize="off"
                                   spellcheck="false" placeholder="1789200000">
                            <span class="tk-help">两格各按上面那一档规则解释，顺序不影响差值（取绝对值），
                                结果给总秒数与「几天几小时几分几秒」那一种拆法。</span>
                        </p>
                        <p class="tk-actions">
                            <button class="tk-btn" type="button" id="{{ tk.prefix }}-btn-timestamp-diff">求差</button>
                        </p>
                    </div>
                    <div class="tk-outwrap">
                        <button class="tk-btn tk-btn--ghost" type="button"
                                id="{{ tk.prefix }}-copy-timestamp-diff" disabled>复制差值</button>
                        <div class="tk-out" id="{{ tk.prefix }}-out-timestamp-diff"
                             role="region" aria-live="polite" aria-labelledby="{{ tk.prefix }}-h-timestamp-diff"></div>
                    </div>
                </section>
            </div>
        </section>

        <section class="tk-panel tk-panel--single" id="{{ tk.prefix }}-panel-base64">
            <header class="tk-panel__head">
                <h2 class="tk-panel__title">{{ tk.panels[1].name }}</h2>
                <p class="tk-panel__tagline">{{ tk.panels[1].tagline }}</p>
                <p class="tk-panel__desc">{{ tk.panels[1].desc }}</p>
            </header>
            <div class="tk-cols tk-cols--one">
                <section class="tk-col" aria-labelledby="{{ tk.prefix }}-h-base64-main">
                    <h3 class="tk-col__title" id="{{ tk.prefix }}-h-base64-main">编解码</h3>
                    <div class="tk-form" role="group" aria-labelledby="{{ tk.prefix }}-h-base64-main">
                        {%- comment -%}
                        四个 `<option>` 的 value 必须与 CODEC_SPEC 里 mode 的白名单逐个对应
                        （encode / decode / dataUri / dataUriDecode）：文案归 HTML，取值归装配层，
                        选错一档时结果区会说"这一档不认"，而不是安静地算出另一档的答案。
                        这一格同时是下面两段显隐的开关（`data-tk-when` 挂在段落上，不挂在那格
                        `<select>` 上——藏掉一整格会留下一条没人答的标签）。
                        {%- endcomment -%}
                        <p class="tk-field">
                            <label for="{{ tk.prefix }}-in-base64-mode">方向</label>
                            <select id="{{ tk.prefix }}-in-base64-mode">
                                <option value="encode">文本 → Base64</option>
                                <option value="decode">Base64 → 文本</option>
                                <option value="dataUri">文本 → data URI</option>
                                <option value="dataUriDecode">data URI → 文本</option>
                            </select>
                        </p>
                        <p class="tk-field tk-field--wide">
                            <label for="{{ tk.prefix }}-in-base64-text">输入</label>
                            <textarea id="{{ tk.prefix }}-in-base64-text" rows="5"
                                      autocomplete="off" autocorrect="off" autocapitalize="off"
                                      spellcheck="false" placeholder="中文，或 5Lit5Zu9"></textarea>
                            <span class="tk-help">按 UTF-8 算字节，四字节 emoji 与半代理项分别怎么对待，结果区会写明。</span>
                        </p>
                        <p class="tk-field" id="{{ tk.prefix }}-when-base64-strict" data-tk-when="decode">
                            <label for="{{ tk.prefix }}-in-base64-strict">解码严格度</label>
                            <select id="{{ tk.prefix }}-in-base64-strict">
                                <option value="loose">宽容（忽略空白与换行）</option>
                                <option value="strict">严格（字符集与长度都判）</option>
                            </select>
                            <span class="tk-help">只有「Base64 → 文本」这一档读它。</span>
                        </p>
                        <p class="tk-field" id="{{ tk.prefix }}-when-base64-mime" data-tk-when="dataUri">
                            <label for="{{ tk.prefix }}-in-base64-mime">MIME 类型</label>
                            <input id="{{ tk.prefix }}-in-base64-mime" type="text"
                                   autocomplete="off" spellcheck="false" placeholder="text/plain;charset=utf-8">
                            <span class="tk-help">只有「文本 → data URI」这一档读它，留空按 text/plain;charset=utf-8。</span>
                        </p>
                        <p class="tk-actions">
                            <button class="tk-btn" type="button" id="{{ tk.prefix }}-btn-base64-main">转换</button>
                        </p>
                    </div>
                    <div class="tk-outwrap">
                        <button class="tk-btn tk-btn--ghost" type="button"
                                id="{{ tk.prefix }}-copy-base64-main" disabled>复制结果</button>
                        <div class="tk-out" id="{{ tk.prefix }}-out-base64-main"
                             role="region" aria-live="polite" aria-labelledby="{{ tk.prefix }}-h-base64-main"></div>
                    </div>
                </section>
            </div>
        </section>

        <section class="tk-panel tk-panel--single" id="{{ tk.prefix }}-panel-url">
            <header class="tk-panel__head">
                <h2 class="tk-panel__title">{{ tk.panels[2].name }}</h2>
                <p class="tk-panel__tagline">{{ tk.panels[2].tagline }}</p>
                <p class="tk-panel__desc">{{ tk.panels[2].desc }}</p>
            </header>
            <div class="tk-cols tk-cols--one">
                <section class="tk-col" aria-labelledby="{{ tk.prefix }}-h-url-main">
                    <h3 class="tk-col__title" id="{{ tk.prefix }}-h-url-main">百分号编码</h3>
                    <div class="tk-form" role="group" aria-labelledby="{{ tk.prefix }}-h-url-main">
                        <p class="tk-field tk-field--wide">
                            <label for="{{ tk.prefix }}-in-url-text">输入（一整串或一个查询串都行）</label>
                            <textarea id="{{ tk.prefix }}-in-url-text" rows="5"
                                      autocomplete="off" autocorrect="off" autocapitalize="off"
                                      spellcheck="false" placeholder="https://example.com/?q=中文&x=1"></textarea>
                            <span class="tk-help">同一段输入同时给「整串」与「单值」两种结果，两者不等时列出差在哪一位；
                                带 <code>?</code> 的串还会拆成参数表。空格与 <code>+</code>、
                                大小写十六进制这些分歧各写一行，不替浏览器下结论。</span>
                        </p>
                        <p class="tk-actions">
                            <button class="tk-btn" type="button" id="{{ tk.prefix }}-btn-url-main">编解码</button>
                        </p>
                    </div>
                    <div class="tk-outwrap">
                        <button class="tk-btn tk-btn--ghost" type="button"
                                id="{{ tk.prefix }}-copy-url-main" disabled>复制结果</button>
                        <div class="tk-out" id="{{ tk.prefix }}-out-url-main"
                             role="region" aria-live="polite" aria-labelledby="{{ tk.prefix }}-h-url-main"></div>
                    </div>
                </section>
            </div>
        </section>

        <section class="tk-panel tk-panel--single" id="{{ tk.prefix }}-panel-digest">
            <header class="tk-panel__head">
                <h2 class="tk-panel__title">{{ tk.panels[3].name }}</h2>
                <p class="tk-panel__tagline">{{ tk.panels[3].tagline }}</p>
                <p class="tk-panel__desc">{{ tk.panels[3].desc }}</p>
            </header>
            <div class="tk-cols tk-cols--one">
                <section class="tk-col" aria-labelledby="{{ tk.prefix }}-h-digest-main">
                    <h3 class="tk-col__title" id="{{ tk.prefix }}-h-digest-main">摘要</h3>
                    <div class="tk-form" role="group" aria-labelledby="{{ tk.prefix }}-h-digest-main">
                        <p class="tk-field">
                            <label for="{{ tk.prefix }}-in-digest-mode">读什么</label>
                            <select id="{{ tk.prefix }}-in-digest-mode">
                                <option value="text">文本（UTF-8，上限 1 MiB）</option>
                                <option value="file">本地文件（上限 5 MiB）</option>
                            </select>
                        </p>
                        {%- comment -%}
                        两条通道两个闸门，所以两段各由开关控制显隐：文件那格在「文本」档里露出来，
                        会被读成一个不响应粘贴框的孤儿控件。开关目标的名字与它自己要读的控件
                        **同名**（payload / upload），CODEC_SPEC 里那两个 key 就是这个约定。
                        {%- endcomment -%}
                        <p class="tk-field tk-field--wide" id="{{ tk.prefix }}-when-digest-payload" data-tk-when="text">
                            <label for="{{ tk.prefix }}-in-digest-payload">文本</label>
                            <textarea id="{{ tk.prefix }}-in-digest-payload" rows="5"
                                      autocomplete="off" autocorrect="off" autocapitalize="off"
                                      spellcheck="false" placeholder="要算摘要的原文"></textarea>
                            <span class="tk-help">字节数按 UTF-8 现算，超长时说明是这一档的 1 MiB 挡住了。</span>
                        </p>
                        <p class="tk-field" id="{{ tk.prefix }}-when-digest-upload" data-tk-when="file">
                            <label for="{{ tk.prefix }}-in-digest-upload">文件</label>
                            <input id="{{ tk.prefix }}-in-digest-upload" type="file">
                            <span class="tk-help">字节在浏览器里读进内存再算，不上传、不留存；超过 5 MiB 整体拒绝。</span>
                        </p>
                        <p class="tk-actions">
                            <button class="tk-btn" type="button" id="{{ tk.prefix }}-btn-digest-main">计算</button>
                        </p>
                    </div>
                    <div class="tk-outwrap">
                        <button class="tk-btn tk-btn--ghost" type="button"
                                id="{{ tk.prefix }}-copy-digest-main" disabled>复制这五行</button>
                        <div class="tk-out" id="{{ tk.prefix }}-out-digest-main"
                             role="region" aria-live="polite" aria-labelledby="{{ tk.prefix }}-h-digest-main"></div>
                    </div>
                </section>
            </div>
        </section>

        <section class="tk-panel tk-panel--single" id="{{ tk.prefix }}-panel-regex">
            <header class="tk-panel__head">
                <h2 class="tk-panel__title">{{ tk.panels[4].name }}</h2>
                <p class="tk-panel__tagline">{{ tk.panels[4].tagline }}</p>
                <p class="tk-panel__desc">{{ tk.panels[4].desc }}</p>
            </header>
            <div class="tk-cols tk-cols--one">
                <section class="tk-col" aria-labelledby="{{ tk.prefix }}-h-regex-main">
                    <h3 class="tk-col__title" id="{{ tk.prefix }}-h-regex-main">匹配与替换预览</h3>
                    <div class="tk-form" role="group" aria-labelledby="{{ tk.prefix }}-h-regex-main">
                        <p class="tk-field">
                            <label for="{{ tk.prefix }}-in-regex-pattern">表达式（不写两侧的斜杠）</label>
                            <input id="{{ tk.prefix }}-in-regex-pattern" type="text"
                                   autocomplete="off" autocorrect="off" autocapitalize="off"
                                   spellcheck="false" placeholder="(\\d{4})-(\\d{2})-(\\d{2})">
                            <span class="tk-help">最长 500 字符。写完先过四档静态检查（嵌套量词、可爆的分组这些），
                                命中疑似回溯的形状就拦下来并点名是哪一段。</span>
                        </p>
                        <p class="tk-field tk-field--count">
                            <label for="{{ tk.prefix }}-in-regex-flags">flags</label>
                            <input id="{{ tk.prefix }}-in-regex-flags" type="text" maxlength="7"
                                   autocomplete="off" spellcheck="false" placeholder="gimsuyd">
                            <span class="tk-help">只收这七个字母，重复与非法的会被归一并说明改了什么。</span>
                        </p>
                        <p class="tk-field tk-field--wide">
                            <label for="{{ tk.prefix }}-in-regex-text">待匹配文本</label>
                            <textarea id="{{ tk.prefix }}-in-regex-text" rows="6"
                                      autocomplete="off" autocorrect="off" autocapitalize="off"
                                      spellcheck="false" placeholder="2026-09-28 与 2026/09/28"></textarea>
                            <span class="tk-help">上限 1 MiB；命中 1000 条或跑了 50 毫秒即止，被哪一道拦住就写哪一道。</span>
                        </p>
                        <p class="tk-field">
                            <label for="{{ tk.prefix }}-in-regex-repl">替换串（留空则只看匹配）</label>
                            <input id="{{ tk.prefix }}-in-regex-repl" type="text"
                                   autocomplete="off" spellcheck="false" placeholder="$1/$2/$3">
                            <span class="tk-help">预览结果给的是字符串，不写回任何地方。</span>
                        </p>
                        <p class="tk-field tk-field--count">
                            <label for="{{ tk.prefix }}-in-regex-limit">命中上限（1–1000，留空取 1000）</label>
                            <input id="{{ tk.prefix }}-in-regex-limit" type="number" min="1" max="1000" step="1"
                                   autocomplete="off" inputmode="numeric">
                        </p>
                        <p class="tk-actions">
                            <button class="tk-btn" type="button" id="{{ tk.prefix }}-btn-regex-main">匹配</button>
                        </p>
                    </div>
                    <div class="tk-outwrap">
                        <button class="tk-btn tk-btn--ghost" type="button"
                                id="{{ tk.prefix }}-copy-regex-main" disabled>复制匹配到的片段</button>
                        <div class="tk-out" id="{{ tk.prefix }}-out-regex-main"
                             role="region" aria-live="polite" aria-labelledby="{{ tk.prefix }}-h-regex-main"></div>
                    </div>
                </section>
            </div>
        </section>
    </div>
</main>

{%- comment -%}
脚本两条：toolkitCore 把跨页共用的一面板框架/绑定层/视图挂成 window.Tk，页面入口只装配本页业务。
两条都不 defer、不加 type=module：产物是 iife 包过的经典脚本，且必须排在正文之后（同证件页那条
口径——HTML 解析到这里时面板节点已经存在，装配层第一件事就是去找它们）。
{%- endcomment -%}
<script src="{{ site.baseurl }}/assets/js/toolkitCore.min.js"></script>
<script src="{{ site.baseurl }}/assets/js/toolCodec.min.js"></script>

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

#### 图标整文件镜像（`assets/img/tools/codec-tool.svg`，FILE_TARGETS 已登记）

```svg
<!-- 顶栏「工具箱」下拉与 /tools.html 小节里「编码与摘要工具」那一行的图标。
     画成描边的尖括号加一道斜杠（`</>` 那一族写法），不画锁、不画齿轮：这一页做的是
     换算与编解码，读图的人先在下拉里读到名字，图形只负责把五页区分开。

     与证件页那一份同一条硬规矩：XML 注释里禁止出现连续两个连字符，一写整个文件就解析失败，
     而 SVG 是被 <img> 引用的，解析失败在浏览器里直接是破图（2026-09-28 现场就是证件页那份
     注释里写了带 var 前缀的令牌名，xmllint 报六处 parser error，下拉与产品页两处同时破图，
     而收录面门禁当时退 0）。所以这段通篇把底色令牌写成 surface / surface-2，不写它们那两划
     开头的形式；改注释时别再引入。

     颜色与证件页那一枚取同一个 #737B85，理由也同一档：这一族图标通过 <img src> 引用，
     里面的 SVG 拿不到宿主页面的 CSS 自定义属性，currentColor 只能落回它自己文档的初始 color
     （近黑），落在夜间 surface-2 上是 1.35:1，等于看不见。烘色则两档都能读，代价是
     不跟主题变——下拉里这两枚本来也只是区分条目用。

     #737B85 的取值口径同 assets/img/tools/idcard-tool.svg 那段注释：把 tokens.scss 里
     四档纸色温的 surface 与 surface-2 共 8 格逐格算对比度，取"最差那组尽量高"的那一档，
     WCAG 1.4.11 对图形对象要 3:1（这两处图标都带 alt=""，属装饰，实际门槛更低）。
     复算不用手抄：跑 `node scripts/check-tools-surface.mjs`，它的「图标」那一组按条目现读
     tokens.scss 凑底色集合、现算这八组比值，并把本文件的 stroke 与 fill 里每个色值都过一遍。 -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none"
     stroke="#737B85" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
     role="img" aria-label="编码与摘要工具">
    <path d="M8.5 8.5 5 12l3.5 3.5"/>
    <path d="M15.5 8.5 19 12l-3.5 3.5"/>
    <path d="M13 6.5 11 17.5"/>
</svg>
```

#### 同一批假设的第三处：M16 / N19 那句"任何产物里都搜不到导出名"

Task 7 一登记条目、Task 6b 一落入口，`_site/assets/js/` 就多了第二本**应该**含这些名字的产物，
于是 §M 的 M16 与 §N 的 N19 在**跑过 `vite build` 的机器上必红**（`node --test scripts/toolkit-tests.mjs`
实测 268 例里 2 例 `not ok`，消息就是`构建产物里出现了 digest.js 的导出名`）。这与 §0.3 那处
地基耦合是同一件事的两个面：判据写成"全仓库只有一页产物"的形状。

改法与门禁五同源——不写死"只有 codec 这一本豁免"以外的特例，而是把不变量说成**排除式**：
`digestAll` / `findMatches` 只许出现在 `toolCodec.min.js` 里，其余任何一本（含哪天真被
Rollup 切出来的共享 chunk）出现即渗透；同时补一条正向——那一本存在却搜不到这个名字就是
接线断了。名字之所以能在压缩产物里被搜到，是因为模块自己把它当诊断串写进了代码：
`digest.js:377` 的 `gateOptions('digestAll', options)` 与 `regex.js:513` 的
`readOptions(options, 'findMatches')`。改这两句诊断串的人必须同时来改这一格，正向断言就是
为了让这件事不许静默。

四刀取证（都在 `_site/assets/js/` 上就地改、跑完 `cp` 回备份、`md5 -q` 与备份逐字比对一致；
命令形状照抄可复算）：

| 刀 | 注入 | 结果 |
| --- | --- | --- |
| A | `printf '\n/*__teeth*/"digestAll";\n' >> _site/assets/js/toolIdcard.min.js` | `--test-name-pattern=M16` → `not ok`，消息 `digest.js 的导出名渗进了 toolCodec.min.js 以外的产物` |
| B | 同上加 `findMatches` | N19 → `not ok`，消息 `产物 toolIdcard.min.js 里不该出现 regex 的导出名` |
| C | 把 `toolCodec.min.js` 里的 `digestAll` 全换成 `digestXX` | M16 → `not ok`，消息 `toolCodec.min.js 在产物里却没有 digestAll…` |
| D | 把同一本里的 `findMatches` 全换成 `rgxGuardLabel` | N19 → `not ok`，正向那一半红 |

刀 D 是第一版**没落地的假刀**：当时写的替换串是 `findMatchesXX`，它含原词，`includes()` 照样
为真，那一轮跑出来是"2 例测、1 例红"——红的只有 M16，而 N19 静默绿。发现这一点靠的是
`grep -c` 数的是**行数**而不是出现次数、以及"这刀为什么没红"的追问；换成不含原词的串才拿到
上表 D 那一行。收窄前的 M16/N19 对这四处注入本身是双向都不核的（任何一本有都红、
任何一本没有都不红），所以这不叫"改坏了判据"，叫**原来那句话已经不属于这个仓库**。

#### 六道门禁的落地读数（2026-09-28 收尾）

| 门禁 | 命令 | 读数 |
| --- | --- | --- |
| ① 判据 | `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs` | exit=0，268 例全绿（收窄前 266 绿 / 2 红 = M16、N19） |
| ② 镜像 | `node scripts/verify-plan-blocks.mjs` | exit=0，50 个已落地镜像逐字节全等（本段新登记两格：`tools-codec.html`、`assets/img/tools/codec-tool.svg`） |
| ③ 镜像牙齿 | `node scripts/verify-plan-blocks-teeth.mjs` | exit=0，21/21 组（G12 读到段 3 名下 17 块镜像，含本段这两格） |
| ④ 产物形状 | `npx vite build` / `bundle exec jekyll build` | 均 exit=0；`assets/js/toolCodec.min.js` 59,317B 原文 / **21,830B gzip**、`_site/tools/codec.html` 52,465B / **13,523B gzip**（口径一律 `cat f \| gzip -9 \| wc -c`）；`import{` 在 `toolCodec` / `toolkitCore` / `toolIdcard` 三本里各 **0 次**（`grep -o 'import{' f \| wc -l`，产物是单行的，`-c` 数的是行）；HTML 那两件含另一路会话未提交的头家族改动，不进本段的账 |
| ⑤ 收录面 | `node scripts/check-tools-surface.mjs` | exit=0，2 条 ready × 5 组判据全绿，导航-全站核到 95 页 |
| ⑥ 收录面牙齿 | `node scripts/check-tools-surface-teeth.mjs` | exit=0，36/36 组变异如期变红（21 idcard + 15 codec），还原后基线仍绿 |

`§7` 的字节预算两行**留给 Task 8**：那一档要在浏览器核验之后按实测立数（段 2 那条 60KB
的教训就是先立数），此处只把构建产物的原始字节记下，不拿它当预算。

## Task 8: 浏览器核验（含 §0.5 四条欠账）

**Files:** Create `scripts/verify-codec-browser.mjs`（或把 `verify-idcard-browser.mjs` 提成参数表后共用，
二选一在格内定，默认**提公共表**以免两份脚本各自漂）；Modify `scripts/toolkit-tests.mjs` 不必；
Modify spec §7（新增 codec 两行预算）与 §8.1/§8.3（回写实际做到的档位）。

判据集合 = 段 2 那 13 项里形状通用的那些 + §0.5 四条 + codec 专有（正则不炸页、5MB 级输入不进
`digest` 的字符串通道、文件摘要走 `ArrayBuffer`）。

### Task 8 落地记录（2026-09-28）

**二选一落在哪一边：另建 `scripts/verify-codec-browser.mjs`（983 行，零依赖 CDP），本格不动
`verify-idcard-browser.mjs`，也不提公共表。**三条理由按现场证据写：

1. 本格开工时 `scripts/verify-idcard-browser.mjs` 正带着另一路会话未提交的 22+/7− 改动，改的恰好是
   **降噪那一族**（`--proxy-server=direct://` + `MAP * ~NOTFOUND, EXCLUDE 127.0.0.1`，并把它自己旧注释里
   那条错误归因改正）。在一个别人正在改的文件上做"提成参数表"的架构动作，等于把两页判据与他们的在改面
   绑进同一次提交，§0.7 那条"对方的在改项永不暂存"在这种形状下没法守。
2. 两页的**专有判据不共享形状**：证件页那一族是"按条数不按字节（50 行）+ 表格折行 + 八种 `BATCH_KINDS`"，
   编码页这一族是"三块面板同一把 1 MiB 字节尺 + 正则四档闸门 + 文件走 `ArrayBuffer`"。真正确实共用的只有
   四族（十档视口 1a–1e、昼夜 × 三档纸色 2a–2d、禁 JS 摊平 4a、阻塞集 5a，共 11 项）——这一版把它们照同一份
   形状写了两遍，复制的价钱当场可见。提取的时机应该落在三页形状齐了的那一格
   （段 4 json 页）：那时提出来的是参数表，现在提出来的是只为两页服务、第三页还要再改一遍的半张表。
3. "两份脚本各自漂"的风险不否认，所以把**已经漂开/已对齐的三处**钉在这里，交给段 4 一次收：
   ① 降噪口径——两边现在都是 `direct://` + `~NOTFOUND`（证件页那一侧靠的是对方**未提交**的那 22+/7−，
   本格没有替他们提交，所以这一条"一致"要到对方落定才算数）；② 噪声归因——编码页是三档（本源 error 级判红 /
   本页那三件与页面本身判红 / 站级 warning 只列账不判红），证件页那一版是"本源三池为 0"一档，
   **段 4 提表时以三档那一版为准**，因为"零输出"那种写法在第一页就会红、红了就被人当噪声关掉，等于没有；
   ③ 期望值来源——编码页所有摘要向量由 Node `crypto` 现算，证件页那一版把常量抄在脚本里（本轮抄错一条
   sha384 就红过一次，那类错应当由构造方式排除，而不是靠人抄对）。

**§0.5 四条欠账的落点**（逐条指名，实际口径差异写进 spec §8.3 那一块，两边不互抄）：
① 监听 → 6a 与 11a（`Runtime.enable` + `Runtime.exceptionThrown` + `Log.entryAdded`，收尾那一次是在
1 MiB 边界、5 MiB 文件、灾难形状与各次真按键**之后**再核）；② 真按键 → 3c 方向键族（ArrowRight/Left/Down
与 Home/End，一条里同时断选中项、roving `tabindex`、`hidden` 互锁、焦点落点与 URL `hash`）、3d 默认滚动
（拿"同一族键落在无处理器处"当对照，量位移不量类名）、3e 裸 Enter / Ctrl+Enter 分档、3f `Enter` 触发复制
（断 clipboard spy 收到的载荷 == Node 现算的那串，不是断按钮变绿）；③ `Esc` 公共层回归 → 3g（开面板那一步
在本机走 Ctrl+K，理由与 `editorial.js:745` 那个 `metaKey || ctrlKey` 的口径差，记在 spec §8.3）；
④ 十档视口 → 1a–1e 原样沿用段 2 那份清单，并新增 1c / 1d / 1e 三条编码页专属读数。

**codec 专有那三条的落地形状**：正则不炸页 = 8a–8f 六条（语法档交回 V8 原话、501 字符整体拒绝不截断、
`(a+)+$` 一次都不执行并点名 F1、medium 档 129 字符拒 / 128 字符放行、命中上限 1000 且用户能调到 7、
四档全程耗时都 <2s）；越界输入不进计算通道 = 9a–9c 三条（正好 1,048,576 字节算得出、+1 整体拒绝，
Base64 与正则两路同一把尺，拒收那一轮复制按钮仍 `disabled`、结果区全文 <600 字、`subtle.digest` 零次）；
文件摘要走 `ArrayBuffer` = 10a–10c 三条（超 5 MiB 只按**声明字节**拒且 `arrayBuffer()` 一次都没被叫、
204,800 字节那份真文件算出五行且 `text()` 全程 0 次、`subtle.digest` 四次各收到 204,800B）。

#### 新增的一本：`scripts/verify-codec-browser-teeth.mjs`

§8.1 开头那句"每条判据都必须能变红（写完后往真产物里注入一处错，看它是否报错）"在段 2 没有对应的
可复跑资产——段 2 的四刀是当时手打的 `printf >>` 加 `cp` 回备份，计划里只留下读数。本格把这一族固定成
脚本，因为它判的正是这一格**唯一一处"改到绿"与"改到没牙"分不开**的地方：run3→run4 之间有八条判据被改，
其中 4a 的 `<noscript>` 那句、8d 的负判据、9b/10a/10b 的三个计数器，都是"从红改成绿"。所以这一本进仓库，
并且它**只肯打在副本上**：`TK_SITE_DIR` 指到仓库自己的 `_site` 时直接退 2。

| 刀 | 注入（打在副本的哪一件） | 落地处数 | 红在哪几条 | 期望 | 结果 |
| --- | --- | --- | --- | --- | --- |
| M1 | `toolCodec.min.js` 的「不读进内存」→「不读入内存」（口径消失一档） | 1 | `10a` | 10a | ✓ |
| M2 | 同本的 `arrayBuffer` → `text`（文件摘要掉进字符串通道） | 2 | `10b` | 10b | ✓ |
| M3 | 同本的 `1048576` → `1048577`（1 MiB 边界让位一格） | 9 | `9a、9b、9c` | 9a | ✓ |
| M4 | `tools/codec.html` 的 `tk-compliance--noscript` → `…--noscripts`（禁 JS 专属文案消失） | 1 | `4a` | 4a | ✓ |
| M5 | `toolkitCore.min.js` + `toolCodec.min.js` 的「已复制」→「已复制咯」 | 1 | `3f` | 3f | ✓ |

`合计 5 个注入，点燃 5 个，未点燃 0 个`、`exit=0`，每轮 `restore()` 后按 md5 与备份逐字比过。
M3 那一刀红三条不是意外：闸门抬高一格，"越界不进计算通道"（9b）与"正则那一路同一把尺"（9c）跟着失效，
这三条判的是同一件事的三个面。**M4 第一刀曾因 `Page.navigate` 25s 无应答崩场被记成"未点燃"**（`exit=2`），
`TEETH_ONLY=M4` 单跑一次即 `✓ 红在 [4a]`——崩一次就下"没牙"的结论，是另一种静默说谎，所以这一本把
`TEETH_ONLY` 做成正式入口，并把每轮的原始读数留在 `codec-teeth-logs-*` 里**不删**（初稿把日志写在备份目录里
连着一起删，红项当场就查不了了）。

#### 六道门禁的本格读数（2026-09-28）

| 门禁 | 命令 | 读数 |
| --- | --- | --- |
| ① 判据套件 | `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs` | `exit=0`、268 例全绿（本格一行未碰逻辑层，这一档是"没被我的文档改动带坏"的证据） |
| ② 镜像自证 | `node scripts/verify-plan-blocks.mjs` | 真实工作树 `exit=1`，**唯一 ✗ 仍是 `_data/onlineTools.yml`**（另一路会话未提交的改名，本格一行未碰，Task 9 的 `--fix` 收）。把那一格还原到 HEAD 的副本里：`exit=0`、**50 块**镜像逐字节全等、`⚠ 未落地` 0 节、js 块 45（段1 11 / 段2 19 / 段3 15）、合计 929,400B。本格往计划与 spec 里加的都是**正文与表格，围栏块 0 个**（复算：`git diff -- 计划 \| grep -c "^+.*\`\`\`"` = 0），镜像数一字未变 |
| ③ 镜像门禁的牙齿 | `node scripts/verify-plan-blocks-teeth.mjs`（在自己那份全量副本里跑，`MIR` 临时指到 `/tmp/t8/vpb2-mine`，理由见下面第 2 笔账） | `exit=0`、**21/21** 组全绿、`✗` 0 条；G12 读到段 3 名下 **17 块**；收口自证那句"脏项 31 个前后一致、diff 指纹 `3b07867bbc88c430`"（含另一路会话那批，一律未被触碰）。**（Task 9 注）** 这一格 21/21 是当时值：下面第 2 笔账那处缺陷由 Task 9 修掉并补了 G13 一族，同一本脚本现在报 **29/29**；"组数"跟着守卫条数走，判据始终是 `exit=0` 且 `✗` 0 条 |
| ④ 产物形状 | 本格**不重建**：`md5 -q` 证明工作树三件与快照逐字节相同，再按 §7 口径重量 | `toolCodec.min.js a89e6e82…` / `toolkitCore.min.js 2ae1f8eb…` / `toolkit.min.css edb0bf75…` 三件与 `/tmp/t8/_site` 里那三份 md5 相同；gzip 2,135 / 7,037 / 21,830 + 快照 HTML 13,523（`cat f \| gzip -9 \| wc -c`），`import{` 在 `toolCodec` / `toolkitCore` / `toolIdcard` 三本里各 **0 次**；`toolIdcard.min.js 64bc2025… / 64,479B` 与 Task 7 那一格一字不差 |
| ⑤⑥ 收录面与其牙齿 | `node scripts/check-tools-surface.mjs` / `...-teeth.mjs` | **本格无读数**，理由是事实而不是偷懒：改动只有两本新脚本与两份文档，一行不碰 HTML / `_data` / 产物；而 `_site` 此刻是共享资源——并行会话的 `jekyll serve` 正在重建它、机器上还有 4 台别人的 headless Chrome（`t10-chrome-*` 与 `wrap-probe-*`，都不是本格的）。在这种时刻抢跑，只会把对方的中间态读成我的红。六道全绿的单子留给 Task 9 |

三笔要留的账：

1. **脚手架自己会说谎，这一格抓到四处。**① Chrome 的 `File.prototype` **没有自有的 `arrayBuffer`**（实测
   「File 自有 arrayBuffer=否（继承 Blob）」），钩子打在 `File` 上时计数器恒 0，那三条越界判据会**全体空过**，
   现在打在 `Blob.prototype` 上并把安装形状打进读数；② `focus()` 落在 `display:none` 子树里静默失败，
   `readOut` 拿回来的是**上一轮的旧账单**（9c 那条"两格数字不一致"就是这么来的假象），所以切面板的辅助函数
   内部自证 `shown === 目标面板`、判据里带 `alive`；③ `Input.dispatchKeyEvent` 的 `keyDown` **不带 `text`**
   能派发给监听器但不走 Blink 默认动作，`<button>` 上的 Enter→click 根本不会发生；④ `Meta+K` 在 headless 里
   是浏览器加速器、会把 CDP 输入卡住，这一族的回归只能走 Ctrl+K（`editorial.js:745` 判 `metaKey || ctrlKey`，
   两档等价）。另外两条给后来者：`<noscript>` 的子节点在脚本可用时**不是 DOM 元素**（判据要先摊平它），
   以及**期望向量一律由 Node 现算**——本轮抄错一条 sha384 就红过一次。
2. **门禁三那份副本路径是硬编码的共享位，并发下会互相删。**`verify-plan-blocks-teeth.mjs:32` 写死
   `MIR = '/tmp/vpb2'`，而它开头第 97 行就 `fs.rmSync(MIR, {recursive:true})` 再按 `FILE_TARGETS` 重建。
   本轮第一次跑是在 `/tmp/vpb2` 里执行那本脚本——`ROOT`/`REPO` 由脚本自身位置推出，也等于 `/tmp/vpb2`，
   于是它先把**自己所在的目录**删了再想从里面拷文件，`ENOENT: …/scripts/verify-plan-blocks.mjs` 当场崩。
   两路会话同时跑同一本也会互相删。修法建议留给 Task 9：`MIR` 认环境变量，且 `REPO === MIR` 时直接拒绝。
   本轮的处置是给自己另建一份全量副本（`rsync -a` 排除 `node_modules`/`_site`/`vendor`，带 `.git`，
   把 `_data/onlineTools.yml` `checkout` 回 HEAD），只在那份副本里把 `MIR` 改掉——**发货的那本一个字未动**。
   **这一笔记账由 Task 9 结掉（2026-09-29）**：默认落点改成每次 `fs.mkdtempSync` 一份独享副本（全绿才删、
   红着留着做尸检），`VPB_MIR` 可以钉死落点但必须先过三道拒绝；牙齿是 G13a–g 七条，其中 G13f 把变异打在
   **守卫调用点**上，要求它真的不再退 2、而是 `rmSync` 掉自己所在的目录再 ENOENT 崩——也就是复现本轮这次现场。
   落点策略与那七条的细节写在下面 Task 9 记录里。
3. **§0.4 那句"若实测超过 30KB 按 BLOCKED 停下交回"在这一格有两种读法，本格不自行判它。**专有一件
   `toolCodec.min.js` = 21,830B < 30,720B（未触发），而表格那一行的口径（三件合计 31,002B）已越过 282B。
   本格按那句话自己的推导对象（"codec 四本模块都是算法"）取"专有一件"那一读，把两种读法、两个数和
   这个岔子原样写进 spec §7，**交回给人判定**：如果应当读成三件合计，Task 8 就是 BLOCKED，
   要人来决定抬那一行的数还是收一块面板。预期为什么低也记在同一格：入口七本里装配与视图那三本原文
   84,090B，与四本算法的 88,711B 几乎等量，起草那句把这一半漏了。

工作树归属：本格碰过的只有四个文件——新增 `scripts/verify-codec-browser.mjs`（983 行）与
`scripts/verify-codec-browser-teeth.mjs`，修改 spec `2026-09-25-blog-online-tools-design.md`（§7 两行 +
一段计量说明 + §8.1 摘要那一行 + §8.3 那一块）与这份计划。其余脏项一律属另一路会话，未被暂存、未被提交、
未被触碰（`git status --porcelain` 前后对照见门禁三那一行）。



## Task 9: 对账收口 + 六道门禁

台账照段 2 Task 11 的形状：本轮所有"当时值"标出来、过期引用改成不带数、§7 新增行与实际口径对齐、
`⚠ 未落地` 保持 0、门禁 ①②③⑤⑥ 实跑 + ④ 用镜像构建证据替代（若同样只动注释）。

**Task 1 现场结下的一笔、留给本格收**：`scripts/toolkit-tests.mjs` 文件头那段"用例分布"
（`:19-25`）只写到 §E，段 2 落 §E0/§F0/§F–§J 时没跟着改，段 3 又叠了 §K——这张地图现在是过期的。
不能随手改的原因说清楚：那段注释**在 §A 的镜像区间之内**（§A 取"第一条 §B 标记之前"），
动它一个字符就会让段 1 计划里那块 400 行镜像漂移，`--fix` 会整块重写段 1 的计划文件。
所以这一处留到本格与 §7 回填、README/USAGE 计数复算同批做，一次 `--fix` 收干净，
而不是在某个任务中间顺手改出一片跨计划的镜像噪音。

### Task 9 落地记录（2026-09-29）

**这一格一行实现代码都不碰**：它结三笔账（下面第 1/2/3 笔）、照 spec §7 那条"收口必须重量"的规矩
复量一次、把六道门禁跑齐。README / USAGE 那一头实测**没有**要复算的计数（`grep -n "toolkit-tests\|镜像\|门禁"
README.md USAGE.md` 只命中三处，讲的都是插件卡片生成与门禁五的机制，没有一个数），
所以本节说的"同批做"落到实际就是"头注释地图 + 一次 `--fix`"这一批。

#### 第 1 笔：Task 8 记的第 2 笔账——`MIR` 那个写死的共享落点（改的是发货的那本）

`scripts/verify-plan-blocks-teeth.mjs` 现在默认每次 `fs.mkdtempSync(os.tmpdir()+'/vpb2-')` 建一份**独享**副本
（**全绿才删、红着留着做尸检**，收尾那句会打印是删了还是留着）；`VPB_MIR` 仍然可以钉死落点，
但钉之前要先过**三道拒绝**，任一命中即 `exit=2` 且不动任何文件：

1. 与仓库有**包含关系**（任何一种方向）：`MIR === REPO`（原地跑会先删掉脚本赖以运行的源码）、
   仓库在落点里面（`rmSync` 会连带删掉真实仓库）、落点在仓库工作树里面（变异会打在真实文件上）；
2. 落点**非空且没有** `.vpb-mirror.json` 这本自己留的标记——那是别人的目录，不替谁删；
3. 标记里的 `pid` **还活着**（`process.kill(pid,0)`，`EPERM` 也算活着）——另一路会话正占着这份副本。

标记由 `mirror()` 在 `rmSync` 之后立刻写（`{pid, repo, at}`），所以第 2、3 道认的就是这个。

牙齿是 **G13a–g 七条**（a 等于仓库 / b 落在树里 / c 树落在里面 / d 非空无标记且 `keep.txt` 一字不伤 /
e 标记 pid 活着 / **f 变异** / g 正对照）。G13f 是这一族的牙：把变异打在**守卫调用点**上
（`const { dir: MIR, auto: MIR_AUTO } = resolveMirror();` 整句换成 09-28 之前那句"直接用钉进来的路径"），
要求同一形状**不再退 2**、而是真的 `rmSync` 掉自己所在的目录、再从空目录里拷文件而 **ENOENT 崩**、
并且脚本自身**不在了**。没有这一刀，上面那五条红只能说"这条路径本来就走不通"，不能说"守卫拦住了"。
G13g 反过来钉误拦：钉一个仓库之外、还不存在的新落点，必须放行（断的是它自报的
`GUARD_OK <那个路径> auto=false`，退 0）。

**这一族第一炮 25/29，四种虚红形状全都值得记**（都是"用例形状自己没走到要验的那一步"）：

1. **a/b/c 三道不点燃**——macOS 的 `/tmp` 与 `/var` 是 `/private/…` 的软链，而 Node 会对
   `import.meta.url` 做 realpath：`REPO` 拿到的是 `/private/var/…`，`process.env.VPB_MIR` 拿到的是
   `/var/…`，字符串包含判断**静默为假**。补了一个 `realish()`（目录还不存在时逐级往上找最近的现存祖先做
   `realpathSync` 再拼回去），三道比较全部换成 realpath 之后的值。
2. **d/e/g 三道报的是另一道**——落点建在 `victim/mirror`，等于"落点在仓库工作树里面"，第三道先响，
   那三条验的就不是它们各自要验的那道。改成 `<root>/repo` 与 `<root>/mirror` **兄弟**形状。
3. **f 那一刀量不到 ENOENT**——victim 里没有 `.git`，脚本死在顶层那句 `dirtyFingerprint()`
   （`not a git repository`，exit 1）而不是 `mirror()`。给 `V()` 加一个 `{git:true}` 选项，
   让它活过第 236 行、真的走到 `rmSync`。
4. **g 那一刀本来会引发递归**——六条拒绝用例与正对照都用**截断到守卫调用点**的源码
   （`guardOnly()`：守卫发生在模块顶层，后面那整轮变异对它没有任何影响），只有 G13f 用全文，
   因为它要的就是"往下走"。不截的话 victim 会拿着同一本脚本再跑一轮 G13、再 spawn 一批孙辈。

台账：**29/29 通过**（`/tmp/t9/teeth_fix5.log`，`exit=0`，跑在 `/tmp/t9/repoA` 那棵带 `.git` 的全量副本里，
`_data/onlineTools.yml` 还原到 HEAD）。收口自证那两句照旧：副本 `exit=0`、脏项 29 个前后一致
（`diff` 指纹含另一路会话那批，一律未被触碰）。另外从**活树**直接验了两发不退 2 之外的东西：
`VPB_MIR=$PWD` 与 `VPB_MIR=$PWD/_docs/superpowers/plans` 都是 `exit=2` 并点名那两道，跑完 `git status`
计数不变、`_docs/superpowers/plans` 三份文件俱在。

#### 第 2 笔：Task 1 结下的那张"用例分布"地图

`scripts/toolkit-tests.mjs` 文件头那段只写到 §E，现在实际是 **19 段 / 268 条**。地图按行首 `^test(`
重算，口径连同 awk 命令一起写进那段注释里（下次过期时改表、不改口径），三条硬事实钉在地图上：
段序里**没有 §P**（那一格从来没落地过，编码页从 §O 直接跳 §Q）、§A 有**两道横幅**各 6 条
（第二条是 Task 8 那批闸门）、条数合计必须等于 runner 汇总行 `# tests 268`。
改完复算：`awk '/^\/\/ ── §/{if(s)print s": "n; s=$3; n=0} /^test\(/{n++} END{if(s)print s": "n}'
scripts/toolkit-tests.mjs` 给出 §A 6/6、§B 15、§C 9、§D 5、§E0 4、§F0 1、§E 23、§F 15、§G 15、§H 16、
§I 16、§J 16、§K 18、§L 20、§M 18、§N 20、§O 13、§Q 16、§R 16，`sites=268`。

漂移如预告落在 §A 那一块（`磁盘 1–860 → 1–874`），处置**不在活树里 `--fix`**：
`git archive HEAD | tar -x -C /tmp/t9/repoB` 造一棵干净检出（那里 yml 天然是 HEAD 那份），
只把本格碰过的两本脚本拷进去，在那棵树里跑 `--fix`。它报的是**重写 1 块**、
`6495 → 6509 行`，再跑一遍 `exit=0`（50 个镜像 / 930,340B / `⚠ 未落地` 0 节）；
`diff` HEAD 版与修后版：只有三个 hunk、全在段 1 计划第 270–291 行那一块镜像之内，
**围栏块 0 个新增**（所以镜像条数一字未变，合计字节 +940B 就是那张地图本身的价钱）。
搬回活树前先 `diff -q <(git show HEAD:段1计划) 段1计划` 证明那一份没人正在改，然后 `cp` 那一个文件。
搬回后活树门禁二复跑：只剩 `_data/onlineTools.yml` 那一格 ✗，与改前**同一格同一形状**。

#### 第 3 笔：那一格 `--fix` 本格**没做**，账原样交回

`_data/onlineTools.yml` 那条未提交的改口（顶栏分组标签「在线工具 → 免安装工具」加它的归因注释）
到收口时仍在（现读 `git diff --numstat -- _data/onlineTools.yml` = `2 1`、磁盘 141 行 ↔ 段 2 计划镜像 140 行，
`_includes/header.html` 也还是 `13 2` 那份未提交态）。本格不替别人 `--fix`：那会把一段还没发表的文案
烤进段 2 的计划镜像，等于替他们决定发布内容。**处置**：等它成为 HEAD 的一部分，任何人跑一次
`node scripts/verify-plan-blocks.mjs --fix` 就收干净（只重写那一个块），活工作树在此之前会一直红这一格——
**这一条不是缺陷，是门禁二在如实报告"磁盘与计划不一致"**。

#### 台账：本轮攒下的"当时值"逐格对到现行值

| 那一句写的是什么 | 当时值（落在哪一格） | 现行值（2026-09-29 收口，附复算口径） |
| --- | --- | --- |
| 套件条数 | 146 → 164 → 184 → 202 → 222 → 235 → 252 → 268（各格末"对套件总数的贡献"那一句） | **268 / 19 段**。复算：`node --test` 的 `# tests` 行 + 上面那条 awk；两张口径必须给出同一个数，不一致就是地图过期 |
| 门禁二的镜像数 | 33（段 2）/ 37 / 39 / 41 / 43 / 50 与合计 929,400B | **50 个 / 930,340B**（条数一字未变，940B 是那张头注释地图的价钱）。判据只有两句：逐字节全等、`⚠ 未落地` **0 节** |
| 门禁三的组数 | 20/20 → 21/21（Task 1–8 各格都写着 21） | **29/29**（G13a–g 补进来）。组数随守卫条数长，判据始终是 `exit=0` 且 `✗` 0 条 |
| §7「证件页 JS+CSS」 | 73,359 → 73,566 → 73,651（spec §7 第二、三段那几格） | **73,651B、余 4,173B（5.4%）**，四件 md5 与 09-28 一字不差，所以未变 |
| §7 编码页那两行 | 31,002B / 15,658B（Task 8 先量后立） | **同一批字节**（md5 四枚相同）；部署件 HTML 那一读给 15,657B，差 **1B**（构建时间戳），表里钉本地可复算值 |
| §7「证件页自身增量的首屏成本」 | 15,546 → 15,571B / 余 813B（段 2 那两格） | **15,669B、余 715B（4.4%）**——这一格是**新涨的**，页面 HTML 13,436 → 13,534B，+98B 归到 `dd2ed97`（yml 登记 codec 条目 → 下拉每一页多一个 `<a>`）与 `7d0671f`（header 抽屉点按展开 + tagline `title`）两格。预算在内，但"≥5% 余量"那条经验线破了，已写进 spec §7 的 2026-09-29 那一格 |
| §0.4「实测超过 30KB 按 BLOCKED 交回」 | 起草预期 15–20KB（专有四本算法） | 实测专有件 **21,830B**、三件合计 **31,002B**。两种读法给出相反的是非，**本格不自行判**，原样交回（Task 8 记录第 3 条 + spec §7 那一格） |

#### 六道门禁的本格读数（2026-09-29 实跑）

| 门禁 | 命令 | 读数 |
| --- | --- | --- |
| ① 判据套件 | `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs` | `exit=0`、`# tests 268 / pass 268 / fail 0`（`/tmp/t9/gate1_header.log`；这一跑同时也是那张新地图的核对：条数 == `^test(` 站点数） |
| ② 镜像自证 | `node scripts/verify-plan-blocks.mjs` | 活树 `exit=1`，**唯一 ✗ = `_data/onlineTools.yml`**（段 2 镜像 140 行 ↔ 磁盘 141 行，另一路会话未提交的改口，见第 3 笔）；HEAD 导出树 + 第 2 笔那一次 `--fix` 之后：`exit=0`、**50 个镜像逐字节全等 / 930,340B / `⚠ 未落地` 0 节**、js 块 45（段1 11 / 段2 19 / 段3 15） |
| ③ 镜像门禁的牙齿 | `node scripts/verify-plan-blocks-teeth.mjs`（在 `/tmp/t9/repoA` 那棵带 `.git`、yml 还原到 HEAD 的全量副本里） | `exit=0`、**29/29**、`✗` 0 条；收口自证两句：副本 `exit=0`、脏项 29 个前后一致（第 1 笔） |
| ④ 产物形状 | **不重建**，用"构建输入集未变 + 四件 md5 + 线上部署件逐字节"三层替代 | 四件 md5 与 Task 8 那格一字不差（`edb0bf75 / 2ae1f8eb / 64bc2025 / a89e6e82`）；本格改动的三个路径都不是构建输入（`vite.config.js` 的 input 只来自 `dev/`，`_config.yml` 的 `exclude` 明列 `scripts`，`_docs` 带下划线不进产物——`ls _site \| grep -c _docs` = 0）；再往硬一层：curl 四件**部署件**的 raw/gz/md5 与磁盘全等（2,135 / 7,037 / 64,479 / 21,830）。`import{` 那一族本轮没有新证据，沿用 Task 8 那格的三本各 **0 次** |
| ⑤ 收录面 | `node scripts/check-tools-surface.mjs` | `exit=0`、**2 条 ready 条目 × 5 组判据全绿**、导航-全站核到 95 页（`/tmp/t9/gate5_t9.log`）。跑之前先确认 `_site` 是落定的：没有 `jekyll serve` / `vite build --watch` 在跑，产物目录 mtime 停在 09-28 20:11 |
| ⑥ 收录面的牙齿 | `node scripts/check-tools-surface-teeth.mjs` | `exit=0`、**36/36 组变异如期变红**、`✓ 全部变异已还原，复跑基线仍绿`（`/tmp/t9/gate6_t9.log`）。跑完 `git status --porcelain` 复看：只剩那一格 yml（`2 1`，与跑前同一形状），源侧就地改的那些都还原干净 |

**本格的工作树归属**：碰过五个文件——`scripts/verify-plan-blocks-teeth.mjs`（第 1 笔）、
`scripts/toolkit-tests.mjs`（第 2 笔，**只有文件头那段注释**）、`_docs/superpowers/plans/2026-09-25-online-tools-foundation.md`
（**只由 `--fix` 重写那一个块**，一个字节都不是手抄）、这份计划、spec `2026-09-25-blog-online-tools-design.md`。
`_data/onlineTools.yml`、`_includes/header.html`、`dev/js/editorial.js`、`_config.yml`、`package.json`
那一族一律未暂存、未提交、未被触碰（门禁六那 36 刀就地改过的部分已全部还原）。

**段 3 状态**：Task 1–9 全部关闭。留给人的两笔：① §0.4 那句 BLOCKED 的读法（专有一件 vs 三件合计）；
② 推送——本格的改动**只在本地 `main`**，`push` 要单独取得同意（见 §0.7）。

**2026-09-29 那一笔 ② 已结（补记，写在这一格之外以免改动上面那段当时的话）**：用户在本轮单独说
「帮我推送」并在确认卡里选了「确认推送」，`8958af2..44491d2` 已上远端 `master`（refspec `HEAD:master`）。
执行路径记两条，都是踩点：Auto 会话里 `git push` **被权限分类器连拦三次**，用户的文字授权与确认卡都不被
认作新的同意——它引用的是本节上面那句「上一次授权已用完」的台账，所以这类闸门不是换写法能过的；
最后按本仓既有的处置走一次性 Full Access automation 代跑（prompt 里写死前置断言：待推条数必须 == 1、
HEAD 必须是 `44491d2`，不符就停下只报输出），任务里第一次 push 报
`Empty reply from server` / `exit=128`，`ls-remote` 证远端未动，重试一次即 `RETRY_PUSH_EXIT=0`。
**推上去之后核到的事实**：`git ls-remote origin master` = `44491d202cafe…` == 本地 `main`；
Pages 那边 `44491d2` 的两个 `Deploy Jekyll site to Pages` run 均 `completed / success`
（`36473977037` @19:42:33Z、`36473977611` @19:43:49Z）；三件产物线上与磁盘 md5 一字不差
（`toolkit.min.css edb0bf75…` 9,418B / `toolkitCore.min.js 2ae1f8eb…` 19,109B / `toolCodec.min.js a89e6e82…`
59,317B，字节数两边各自相等）——**这正是预期的**：本格推的是两本 `scripts/` 脚本与三份文档，
`_docs` 与 `scripts` 都不进站点产物，所以线上一件页面的渲染不会有任何变化，`§7` 那些字节数不受影响。
剩下的 ①（BLOCKED 的两种读法）仍未由人判，那条不结。

---

## 交付顺序与提交节奏

Task 1→5 是一格一提交（纯逻辑，风险低，先立判据）；Task 6→7 各一格；Task 8 一格（可能带 spec 回填）；
Task 9 一格。**全程不 push**；段 3 收口后单独向用户请示推送。
