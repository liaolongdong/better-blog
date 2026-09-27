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
| M16 | 剥注释扫源 **25 条违禁**（清单自带条数断言）：`import`（**这条行首锚 `^` 必须带 `m`**——不带就只锚"整份源码的第一个字符"，中段插一条 `import './codec.js'` 全绿，评审回改实测；§L 的 L16 同病同治）/`export from`/`export * from`/动态 `import()`/`require(`/`node:crypto`/`createHash`/DOM 四件/`fetch(`/`FileReader`/`Buffer`/`atob`/`btoa`/`TextEncoder`/`TextDecoder`/时钟两件（`Date.now`/`new Date(`）/`Math.random`/`Intl`/`toLocale`/`unescape`/`eval`，逐条数过来正好 25（起草那版写"23 条"而枚举出来是 24 项，本次一并核准）；**正向**断言 `0x67452301`、`0x10325476` 必须在、K 表区间正则读到的常数**恰好 64 项**、`Math.sin` 必须不在、取 `subtle` 走 `globalThis` 而 `window.crypto` 必须不在；零重叠两条 + 位置哨兵（`dev/js/digest.js` 不存在、`dev/js/tools/digest.js` 必须在，否则前一条是空转的）；`_site/assets/js` 若有产物则搜不到 `digestAll` |
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

#### `scripts/toolkit-tests.mjs` §M（整节，从 `// ── §M` 到文件末尾）

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
  const siteJs = resolve(ROOT, '_site/assets/js');
  if (existsSync(siteJs)) {
    const hits = readdirSync(siteJs).filter((f) => f.endsWith('.js')
      && readFileSync(resolve(siteJs, f), 'utf8').includes('digestAll'));
    assert.deepEqual(hits, [], '构建产物里出现了 digest.js 的导出名');
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
