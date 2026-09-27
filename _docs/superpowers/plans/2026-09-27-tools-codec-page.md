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

### 0.4 预算：§7 表里**没有** codec 那一行（逐字确认过）

`_docs/superpowers/specs/2026-09-25-blog-online-tools-design.md` §7 的表（246–256 行）只有八行：
区划表产物 36KB / 证件页 JS+CSS 76KB / 证件页自身增量的首屏成本 16KB / JSON 页 120KB /
输入硬上限 / 树视图 / 正则 / 深样本。codec 页一段话都没提。

处置：Task 8 落地后按实测**新增两行**（`编码页 JS+CSS` 与 `编码页自身增量的首屏成本`），
先量后立、写在实测之上并留 ≥5% 余量——段 2 那条 60KB 的教训就是拍脑袋先立数导致的。
起草时的预期值：codec 四本模块都是算法、无数据表，MD5 自实现约 1.5–2KB gzip，
**预期总量在 15–20KB gzip 一档**；若实测超过 30KB，按 BLOCKED 协议停下交回，不自行改判据。
gzip 口径钉死 `cat f | gzip -9 | wc -c`（§7 第五段的口径警告：与 `zlib.gzipSync` 差 293B）。

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
dev/js/tools/regex.js           正则测试：步数上限、捕获组、替换预览（纯函数，§N）
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

- [ ] **Step 5: 提交**

```bash
git add dev/js/tools/time.js scripts/toolkit-tests.mjs scripts/verify-plan-blocks.mjs \
  scripts/verify-plan-blocks-teeth.mjs _docs/superpowers/plans/2026-09-27-tools-codec-page.md
git diff --cached --stat      # 期望恰 5 files
git commit -m "feat(tools): 段 3 Task 1 时间戳模块 time.js——判档不猜档、零环境依赖（§K 十八判据 + 四变异台账）" -- \
  dev/js/tools/time.js scripts/toolkit-tests.mjs scripts/verify-plan-blocks.mjs \
  scripts/verify-plan-blocks-teeth.mjs _docs/superpowers/plans/2026-09-27-tools-codec-page.md
```

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

#### `scripts/toolkit-tests.mjs` §K（整节，从 `// ── §K` 到文件末尾）

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

**Files:** Create `dev/js/tools/codec.js`；Modify `scripts/toolkit-tests.mjs`、`verify-plan-blocks.mjs`、本计划。

```text
export const MAX_TEXT_LEN = 200000;         // 字符数闸门，与 §7"文本类"那一行对齐后回填
export function encodeBase64(text)   → { ok, out, bytes, reason }
export function decodeBase64(text)   → { ok, out, strict, reason, paddingDropped }
export function encodeDataUri(text, mime) → { ok, out }
export function decodeDataUri(text)  → { ok, mime, data, isBase64, charsetPercent, reason }
export function encodeUrlComponent(text) → string
export function decodeUrlComponent(text) → { ok, out, reason }
export function urlPair(text) → { encodeURI, encodeURIComponent, decodeTries: [...] }
export function splitQuery(text) → Array<{ raw, key, value, keyOk, valueOk, reason }>
```

判据要点（§L，写实现时逐条展开）：UTF-8 多字节与 emoji/代理对往返一致；
strict 与非 strict 两档解码口径分开（`atob` 对含空格/换行的 MIME 容忍，本站要在 `strict` 里点名拒绝）；
padding 缺失要报、不静默补；`encodeURI` 与 `encodeURIComponent` 的差异用一张固定样本表逐字符断言
（`:`,`/`,`?`,`#`,`[`,`]`,`@`,`!`,`$`,`&`,`'`,`(`,`)`,`*`,`+`,`,`,`;`,`=` 共 18 个保留字符）；
`decodeURIComponent('%')` 这类非法序列必须回 `ok:false` 而不是抛穿到 UI；
data URI 场景含换行（段 2 的 spec §5.2 点名要支持）。

## Task 3: `digest.js` — MD5 自实现 + `crypto.subtle` 包装（§M）

**Files:** Create `dev/js/tools/digest.js`；同上三处 Modify。

要点：仓库里**没有**任何浏览器侧 MD5/SHA 实现（`crypto.subtle` 全仓零命中于 `dev/`，只有 node 端脚本用
`crypto`），所以 MD5 自实现、SHA-1/256/384/512 走 `crypto.subtle`；`ArrayBuffer` 通道与字符串通道分开
（文件走前者，不许 `String.fromCharCode` 拼二进制）；非安全上下文（本地 `file://`、http）要有
**明确降级文案**而不是静默空白，判据仿 `editorial.js:483` 与 `workbench.js:358/821/971` 那套三级兜底；
MD5 用 RFC 1321 官方测试向量全套（`""`/`a`/`abc`/`message digest`/…），SHA 侧在 node 里用
`node:crypto` 现场对拍（测试环境有 subtle，浏览器实现走同一份 `TextEncoder`）；
输入上限与 Task 2 的闸门对齐并写明是"字节"还是"字符"。

## Task 4: `regex.js` — 正则测试（步数上限防回溯炸页）（§N）

**Files:** Create `dev/js/tools/regex.js`；同上三处 Modify。

要点：`exec` 循环带**迭代上限**（不是"步数"——JS 没有可查的回溯步数计数器，所以本段的实现口径是
"匹配次数上限 + 单次时间预算 + 输入长度上限"三档，§7 那一行"匹配步数上限 + 超时保护"要按这个事实
回写，别留一句实现里不存在的承诺）；灾难性回溯样本 `(a+)+$` 配 30 个 a 的输入必须在闸门内被拒并给
"疑似灾难性回溯"提示，**不许让页面卡住**；捕获组、命名字段（`d.groups`）、`index` 与
`lastIndex` 推进（零宽匹配必须手动 +1，否则死循环——这条要有独立判据）；flags 白名单
`g i m s u y`，出现未知 flag 直接拒；替换预览用 `String.prototype.replace` 的 `$` 转义口径，
`$&`/`$1`/`$<name>`/`$$` 四种都要断。

## Task 5: `ui.js` — 把复制三件套从 `workbench.js` 抽出来（§O）

**Files:** Create `dev/js/tools/ui.js`；Modify `dev/js/tools/workbench.js`（删三处、加一条 import）、
`scripts/toolkit-tests.mjs`（§O + 复跑 §J 全量）、`verify-plan-blocks.mjs`。

决策：站内**没有** `ui.js`（spec §6.2 列了但段 1/2 从未建），复制/Toast 的现实是
`workbench.js:815 doCopy` / `:971 legacyCopy` / `:803 flash` 三个函数加 `:713` 的 label 同步。
codec 与 json 都要同一份，所以这一段是抽离的正确时机；**只搬不改行为**，§J 现有 16 条装配判据
必须原样全绿（它们是假 DOM + `commandLog` 那套，正是这一迁移的回归网）。
搬迁前后各量一次 `toolIdcard.min.js` 的 gzip 字节（`cat f | gzip -9 | wc -c`），
差值写进计划——预期为 0 到 ±20B（模块边界变了、minify 结果可能微调），超了要归因。

## Task 6: `codecView.js` + `codecWorkbench.js` + `toolCodec.js`（§Q + §R）

**Files:** Create 三份；Modify `scripts/toolkit-tests.mjs`、`verify-plan-blocks.mjs`、本计划。

契约：`codecView.js` 与 `view.js` 同一条红线——**零 import**（它进 `toolkitCore` 之前不能被拽进任何
数据模块）；`codecWorkbench.js` 里 `CODEC_SPEC` 与 `CODEC_PANEL_IDS` 两张表是 §0.3 那处解耦要读的东西；
入口 `toolCodec.js` 的产物名必须与页面引用逐字符一致（`toolCodec.min.js`，§6.1 那条大小写教训）。

## Task 7: 收录面 + 门禁解耦（本段的地基改动）

**Files:** Modify `scripts/check-tools-surface.mjs`、`scripts/check-tools-surface-teeth.mjs`、
`_data/onlineTools.yml`、`scripts/verify-plan-blocks.mjs`；Create `tools-codec.html` 的 Liquid 部分；
Modify `README.md`、`USAGE.md`、spec §4.4/§7。

顺序很关键：**先解耦再登记条目**，反了会在门禁五上得到一条"红得看不懂"的现场。
条目字段：`slug: codec`、`url: /tools/codec.html`、`prefix: tk`、`status: ready`、
`panels: [timestamp, base64, url, digest, regex]`、图标 `/assets/img/tools/codec-tool.svg`
（新 SVG 要走段 2 那套昼夜两档判据，图标组判据在 `check-tools-surface.mjs:349-381`）。
五处消费点（header / tools / index-all / sitemap / llms）全数据驱动，零手写。

## Task 8: 浏览器核验（含 §0.5 四条欠账）

**Files:** Create `scripts/verify-codec-browser.mjs`（或把 `verify-idcard-browser.mjs` 提成参数表后共用，
二选一在格内定，默认**提公共表**以免两份脚本各自漂）；Modify `scripts/toolkit-tests.mjs` 不必；
Modify spec §7（新增 codec 两行预算）与 §8.1/§8.3（回写实际做到的档位）。

判据集合 = 段 2 那 13 项里形状通用的那些 + §0.5 四条 + codec 专有（正则不炸页、5MB 级输入不进
`digest` 的字符串通道、文件摘要走 `ArrayBuffer`）。

## Task 9: 对账收口 + 六道门禁

台账照段 2 Task 11 的形状：本轮所有"当时值"标出来、过期引用改成不带数、§7 新增行与实际口径对齐、
`⚠ 未落地` 保持 0、门禁 ①②③⑤⑥ 实跑 + ④ 用镜像构建证据替代（若同样只动注释）。

**Task 1 现场结下的一笔、留给本格收**：`scripts/toolkit-tests.mjs` 文件头那段"用例分布"
（`:19-25`）只写到 §E，段 2 落 §E0/§F0/§F–§J 时没跟着改，段 3 又叠了 §K——这张地图现在是过期的。
不能随手改的原因说清楚：那段注释**在 §A 的镜像区间之内**（§A 取"第一条 §B 标记之前"），
动它一个字符就会让段 1 计划里那块 400 行镜像漂移，`--fix` 会整块重写段 1 的计划文件。
所以这一处留到本格与 §7 回填、README/USAGE 计数复算同批做，一次 `--fix` 收干净，
而不是在某个任务中间顺手改出一片跨计划的镜像噪音。

---

## 交付顺序与提交节奏

Task 1→5 是一格一提交（纯逻辑，风险低，先立判据）；Task 6→7 各一格；Task 8 一格（可能带 spec 回填）；
Task 9 一格。**全程不 push**；段 3 收口后单独向用户请示推送。
