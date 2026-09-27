# 证件页收口（段 2）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把段 1 落地的算法模块装进站内第一张工具页 `/tools/idcard.html`（五块面板：身份证 / 统一社会信用代码 / 银行卡 / 手机号 / 随机测试数据），并把三处入口与四条收录面一次接全。

**Architecture:** 页面骨架由 Jekyll 构建期渲染（禁 JS 与爬虫都读得到面板），`dev/js/toolkitCore.js` 把跨页共享的面板状态机 / DOM 绑定 / 视图渲染挂成 `window.Tk`，页面入口 `dev/js/toolIdcard.js` 只做「读表单 → 调模块 → 把 `view.js` 产出的 HTML 串写进结果区」。所有可测的东西都尽量做成**纯函数的字符串输出或状态返回值**，判据跑在 Node 里；真 DOM 与真浏览器只在两处实测：手写假 DOM（§I）与 headless Chrome（Task 10）。

**Tech Stack:** Jekyll 4 + Liquid、Vite 5（`dev/js`/`dev/sass` 单层扫描）、Sass、postcss-px-to-viewport、Node 22 内置 test runner、原生 JS（无框架、无新增依赖）、raw CDP over Node 全局 `WebSocket`。

---

## 0. 开工前必读：本轮（2026-09-26）逐条亲自实测的事实

这一节的每一条都有命令可复算。写计划时我踩到过两处"看起来显然但实测相反"的地方（0.2 与 0.3），都已经把实测数字留在下面，别再按直觉改回去。

### 0.1 段 1 留下的接口与红线

**测试入口**（段 1 口径，本段继续用，**不要**为此改 `package.json`——它是并发会话正在改的文件，见 0.6）：

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs; echo "exit=$?"
```

当前基线：**41 条用例全绿、`exit=0`**（§A 12 / §B 15 / §C 9 / §D 5）。本段往同一个文件里追加 §E–§I，**不另起测试入口**。判成败只看 `echo` 出来的 `exit=`，不要看管道后的 `$?`。

**段 1 模块的真实 API 形状**（下面这些不是照抄注释，是 2026-09-26 用 node 现跑出来的键名，视图层照它写）：

```
parseIdCard('110101199003070015')
  → { input, value, state, lengthType, checks, info, id18, id15, id15Note,
      expectedCheckBit, suggestedId18, caveat, hasCaveat, repairedHint }
    state ∈ 'empty' | 'malformed' | 'checkdigit' | 'valid'   ← 这个样本实测是 'checkdigit'
    checks[i] = { key, label, ok, detail }                   ← ok 允许是 null（§5.4 的"未收录"档）
    info = { lengthType, areaCode, region, birth, birthRaw, ageYears, sex, seq,
             body17, checkBit, expectedCheckBit, checkWork, datasetVersion }

generateIdCards({ count, sex, areaCode, rng, today })
  → [ { id18, id15, areaCode, region, birth, age, sex, seq, checkBit, caveat } ]

parseUscc('91350100M000100Y43')
  → { input, value, code, normalized, state, checks, info, caveat, hasCaveat, repairedHint }
    info = { regionCode, region, registry, category, subject, body8, orgChar,
             orgChecksum, checksum, checkBit, expectedCheckBit }

generateUsccCodes({ count, regionCode, registryChar, categoryChar, rng })
  → [ { code, regionCode, regionName, registryChar, categoryChar, subject,
        orgCheckBit, checkBit, caveat } ]

resolveRegion('110101')
  → { code, status:'current', level:'county', provinceCode, cityCode, countyCode,
      province, city, county, fullName:'北京市东城区', note:'' }
resolveRegion('371299') → status:'abolished', level:'city', fullName:'山东省莱芜市'
resolveRegion('999999') → status:'unknown',  level:'none',  note:'省级代码不存在'
```

`createPanelWorkspace` 的契约（`dev/js/tools/panel.js`）：它**不碰 DOM**，只给四张东西——`tablistAttr()` / `tabAttr(id)` / `panelAttr(id)` 返回属性表（值全是字符串，只有 `panelAttr` 的 `hidden` 是布尔），`select(id)` / `move(action)` / `applyHash(raw)` / `toHash()` 管状态，`markBroken(id, message)` / `brokenOf(id)` / `brokenIds()` / `clearBroken(id)` 管单块塌了。段 1 在文件头写死了分工：**装配层只把属性表原样写进节点，不自己手抄 `role`**。Task 6 的 `panel-dom.js` 就是那份"原样写"的实现，它上面不允许有第二条 ARIA 口径。

**四条不可越过的红线**（都有原文与实测依据，段 1 计划 §8.1 那轮收口已把它们钉过）：

1. `scripts/fixtures/region-source/` 与 `dev/js/tools/region-data.js` 是哈希钉死的只读输入，任何实验只在 `/tmp` 副本上做。
2. **绝不在 `dev/js/` 下放一个叫 `tools.js` 的入口**——`assets/js/tools.min.js` 已被 `dev/libJs/tools.js` 占着，两个 builder 都往同名产物写且都 `exit=0`，后写覆盖前写。
3. 产物名逐字符跟随源文件名（大小写原样）：`toolIdcard.js` → `toolIdcard.min.js`，`toolkit.scss` → `toolkit.min.css`。macOS 本地看不出写错的一个字母，Linux 上的 Pages 一律 404。
4. 改 `dev/js/tools/{panel,idcard,uscc,region,random}.js` 或 `scripts/toolkit-tests.mjs` 的分节，会让 `node scripts/verify-plan-blocks.mjs` 退 1。它把这些文件的全文镜像在**两份计划**里（2026-09-27 改的：`PLANS` 从一份变两份，分节标记正则从 `§([B-Z]) ` 放宽成 `§([B-Z]\d*) `，这样本计划的 §E0/§F0 与 §E–§J 才分得开；同一块内容在两份计划里都能全等命中时照旧按 `✗ 歧义` 拒绝猜）。同一轮还给这个脚本加了三道闸，后面向 `--fix` 求助的人要知道它们的存在：
   - **反查漏声明**：计划里若有一块 js 与磁盘某个整文件逐字节全等、但它不在 `FILE_TARGETS` 里 → `✗ 漏网镜像` 退 1。`build-prefix-data.mjs` 那 164 行就是这么被发现的（它贴在计划里却没人核过），清单从此不会静默烂掉。
   - **`--fix` 不再能删规格**：磁盘那一段整段是计划块的前缀（= 这一节被新标记截短了）→ 分段目标一律拒绝落笔；磁盘出现**带缩进**的 `// ── §X` 标记行 → 整轮 `--fix` 不落笔并点名那一行。旧行为在副本上实测会抹掉一截镜像（§E0 缩两格）或把 615 行的规格截成 101 行（§C 体内插标记）。
   - **标记行自己漂了也认得回来**：按节名兜底定位（`byName`），失败信息会写明"按节名定位：标记行自己漂了，公共前缀 0 行"，`--fix` 照旧能同步那一节。

   这三条各有注入实验，跑 `node scripts/verify-plan-blocks-teeth.mjs`（它把仓库拷一份到 `/tmp/vpb2` 上动手，工作树一个字都不碰，末尾自证这一点）——14 项全过。本段**只在 §H/§I 需要时改 `panel.js` 以外的东西**；真需要动镜像文件时，改完立刻 `--fix` 同步并在提交信息里写明。

### 0.2 实测：跨入口共享模块会产出**语法错误**的产物，而且构建照样 `exit=0`

这条是本段架构决定的根据，段 1 没碰过（那时 `dev/js/*.js` 六个入口彼此零 `import`，从没产出过共享 chunk）。2026-09-26 在 `/tmp` 镜像里实测：

镜像里放 `dev/js/probeA.js` 与 `dev/js/probeB.js`，两边都 `import { createPanelWorkspace } from './tools/panel.js'`，`npx vite build` **exit=0**，产物：

```
assets/js/panel.min.js    3.00 kB │ gzip: 1.35 kB     ← Rollup 把共享模块提成了 chunk
assets/js/probeA.min.js   0.07 kB
```

`probeA.min.js` 全文只有这两行：

```js
(function(){import{c as o}from"./panel.min.js";window.__probeA=o;
})();
```

`iife-wrap` 把 ESM 的 `import` 声明包进了函数体——**经典 `<script>` 里这就是 SyntaxError**，整个文件一行都不执行，页面上什么都没有，而构建绿的。再补两格实测：

- 只留 `probeA.js` 一个入口引 `panel.js` → **不产出 chunk**，`panel.js` 的代码原样内联进 `probeA.min.js`（实测产物开头是 `createPanelWorkspace` 里那个 `shapeOf`）。所以**单入口页不受影响，段 2 只有一个页面入口，本来不会踩**；踩中的是段 3（第二张页共用 `panel.js`）。
- `emptyOutDir: false`，删掉入口之后上一轮的 `panel.min.js` **留在原地**——所以"产物里有没有多出来的文件"不能当判据，得看**内容**。

**因此本段就把跨页共享层定下来**（`dev/js/toolkitCore.js`，见 Task 7），而不是留到段 3 再返工：段 2 就把 `panel.js` / `panel-dom.js` / `view.js` 三个跨页模块挂到 `window.Tk`，页面入口一律不 `import` 它们。这不是我发明的模式，站内已有两份同族先例：`dev/libJs/tools.js` 出 `window.tools.formatDate`（`_layouts/default.html:24` 全站都在引），`editorial.min.js` 是主题的唯一真值源 `window.EditorialTheme`（`_layouts/aboutTemplate.html:4` 附近那条注释写明"不能省"）。

配套的判据在 Task 9：**构建后 `assets/js/*.min.js` 里 `import{` 的命中数必须是 0**。今天实测基线就是 0（`grep -o 'import{' assets/js/*.min.js | wc -l` → 0），所以这条判据现在就有牙，段 3 谁再走回头路会当场红。

### 0.3 实测：px→vw 的确切边界（设计文档 §6.4 那句推断要按实测改口径）

`postcss.config.js` 的 `mediaQuery: true` 让人以为 `@media` 的断点也会被换掉。2026-09-26 在镜像里用一个探针文件实测三档：

```scss
/* dev/sass/tkprobe.scss */
.tk-box { width: 200px; }
@media screen and (max-width: 900px) { .tk-box { width: 100px; } }
.zz-box { height: 50px; }
:root { --gap: 12px; }
@keyframes tk-slide { from { transform: translateX(8px); } to { transform: translateX(0); } }
```

| 输入 | `.tk-` **不在**黑名单（实测） | `.tk-` **在**黑名单（实测） |
| --- | --- | --- |
| `.tk-box{width:200px}` | `width:26.66667vw` | `width:200px` |
| `@media(…900px){.tk-box{width:100px}}` | 断点留 px、声明 `13.33333vw` | 断点留 px、声明留 `100px` |
| `.zz-box{height:50px}` | `height:6.66667vw` | `height:6.66667vw` |
| `:root{--gap:12px}` | `12px`（`':root'` 早已在黑名单） | `12px` |
| `@keyframes tk-slide` 里的 `8px` | `translate(1.06667vw)` | **`translate(1.06667vw)`** |

四条结论，本段照着写样式：

1. **`.tk-` 必须自己加进黑名单**：黑名单里已有的 `'.tool'` 是子串匹配，能白送 `.toolkit-*`，但**盖不住 `.tk-` / `.jt-`**（`.tk-box` 里没有 `.tool` 这五个字符）。设计文档 §6.4 要求加这两条，加对了。
2. **断点安全**：`mediaQuery: true` 只换算 `@media` **块内声明**的 px，**不碰 `@media` 参数**。站内产物反证同一件事：`assets/css/about.min.css` 里是 `@media screen and (max-width:695px)`、`index.min.css` 里是 `max-width:1023px`，全是 px。所以 §6.4 里"只看一条规则不够"这句的理由要换成：**声明会按各自的规则单独换算，必须逐条看，而 `@media` 参数不在换算范围内**。
3. **`@keyframes` 是唯一黑名单够不到的一档**（它的父选择器是 `0%` / `to`），`tk-` 命名也救不了——实测加与不加黑名单它都变 vw。关键帧里的位移**一律走 `:root` 上的 `--travel-s/m/l/xl`**，不写字面 px。（`dev/sass/about.scss:13-16` 与 `dev/sass/common/tokens.scss:74-78` 早就各写过一句，本段是第三次撞上。）
4. 加完黑名单必须**对着产物复跑**：`grep -c 'vw' assets/css/toolkit.min.css` 里 `.tk-` 规则的命中数必须为 0，Task 9 的 `check-tools-surface.mjs` 有这一条。

### 0.4 数据源取证：两张表拿到了，权威口径没拿到，按"记录缺口"处理

设计文档 §5.1 要银行卡"行别按内置前缀表给出（标注为参考、不承诺全量）"、手机号"格式 + 运营商识别"。本段开工前逐个试取，结果如下——**这决定 Task 1 的数据形状，也决定 §E/§F 的判据能声称什么**。

| 想要的东西 | 试过的来源 | 结果 |
| --- | --- | --- |
| 银行卡 BIN → 发卡行 | [hexindai/bcbc](https://github.com/hexindai/bcbc) `data/bin.csv` + `data/name.csv`，pin commit `de631827ffe8db2792d140f3476b02498fc1244f`（2025-02-05） | ✅ **可用**。MIT（`LICENSE` 原文 `Copyright (c) 2018 - 2020 Runswen`，本地核对）。1,709 条 BIN、260 个行别码、275 条带中文名；BIN 长度 3–10（其中 6 位 1,594 条），`type` 只有 `DC/CC/PC/SCC` 四种，`length` 只有 15–19 五种。哈希见 Task 1 |
| 手机号段 → 运营商 | [LSG-PolarBear/impulse](https://github.com/LSG-PolarBear/impulse) `impulse.py` 的 `OPERATORS`，pin commit `dcacca9bf28132ca6938eb2c162e9b222ae02a53`（2026-08-28） | ⚠️ **勉强可用**。Apache-2.0；56 个三位段、五家互不重叠。但 0 star 单人脚本，且里面 `141 归电信`、`195/197 归移动` 这类格与常见公开整理稿不一致——**它是唯一一个能干净拿到许可的源** |
| 号段的权威口径（工信部编号计划原文） | `baike.baidu.com/item/公众移动通信网网号`（curl 只拿到 2,583 字节的反爬壳）；`en/zh.wikipedia.org`（本机 curl 恒超时 / `000`）；`libphonenumber` 的 `86_zh`（482 字节且是 waterline 二进制，粒度远粗于三位段）；npm `search?text=手机号段` 全是无关包 | ❌ **没拿到** |
| 号段的第二方交叉核对 | `ls0f/phone`（1,084★）、`dannyhu926/phone_location`（417★）、`funNLP`（83,430★） | ❌ **不可用**：**无 license**，等于保留所有权利，不能把数据抄进公开仓库 |
| 高频姓氏表（带统计口径） | GitHub `姓氏 频率` 搜索、CNC `Chinese_Family_Name（1k）.xlsx`（Apache-2.0 但 28KB xlsx，读它要引 zip 解析——段 1 立的"无新依赖"会破） | ❌ **不引外部表**。Task 4 的姓氏/用字是**编者自选清单**，面板文案不声称频率，只说"随机合成" |

**处置口径（照 §11 里 USCC 样本缺口那一行的先例办，不假装过）**：

- 银行卡：行别与卡号长度**照 bcbc 快照给出**，面板与模块各写一行"参考、不承诺全量、新发卡与调整不在表内"，来源与快照日写进模块头与 `assets/data/LICENSES.md`。**不做卡组织猜测**——`bank/name.csv` 里没有 VISA/MASTERCARD 这类行（实测 grep 只命中 `NJCB,南京银行`），bcbc 给的就是"发卡行"这一层，不必也不该再包一层没有据的东西。
- 手机号：**格式判定是硬结论**（`^1[3-9]\d{9}$`），**运营商是软参考**（模块头点名"单一来源、发号口径、携号转网后不代表当前运营商、不做归属地"）。§F 因此只断**自洽**（56 段互不重叠、全为三位、全在 `1[3-9]` 内、生成侧产出的号必被自己的校验判有效、每段至少生成过一次），**不断外部正确性**；这个缺口在测试文件注释与 §F1 的用例名里各写一次。
- 两条都**不许**在页面文案里写成"查询/识别结果"式的权威口吻；面板的措辞在 Task 8 的骨架与 `_data/onlineTools.yml` 里逐句钉。

### 0.5 站点接入点（2026-09-26 逐个 `sed`/`grep` 实读，行号会漂所以同时给锚点）

- `_layouts/` 只有 5 份：`default` / `post` / `aboutTemplate` / `demoTemplate` / `labTemplate`。内容页一律 `layout: default`。**本段不新增布局文件**，页面级 CSS/JS 由页面自己 `<link>`/`<script>` 带（先例：`weblab.html:13` 的 `weblab.min.css`、`about.html:259-260` 的两条 `<script>`）。
- `_includes/headAssets.html` 92 行：preload 字体 → `normalize.min.css` → iconfont CSS → `{%- if page.layout == 'post' %}` 三条文章专用 CSS → `index.min.css` → `iconFont/iconfont.css` → `jquery.min.js`（**必须最后**）。文件头注释写明"清单只能留在 headAssets 里按 layout 收口"的理由。**本段一行都不改它**：新页的 CSS 走页面自带 `<link>`，与 `weblab.html` 同法，改动面最小。
- `_includes/header.html`（161 行）下拉块在 `19-53`，`{% for item in site.nav %}` + `{% if page.url == item.url or (item.url != '/' and page.url contains item.url) %}` 判 `is_current`，`{% if item.dropdown == 'tools' %}` 里 `{% for tool in site.data.tools %}` 拼 `/tools.html#<slug>`，末尾一条 `.nav-sub-more`。**这就是 §4.3 那个缺陷的位置**：`/tools/idcard.html` 里 `page.url contains '/tools.html'` 为假。
- `_config.yml`：`nav:` 现在 **8 项**（实测数 `- key:`），`version: '2.1.0'`，`exclude` 里已有 `dev` / `scripts` / `"assets/**/*.md"`。
- `tools.html`（102 行）整页是 `_data/tools.yml` 的一个循环，`{% endfor %}` 在 99、`</main>` 在 100 →「在线工具」小节插在两者之间；`tools.html:19` 用 `site.data.tools.size` 说"几款产品"，加了小节**不动**它（那句话说的是插件产品，Task 9 里给它补一行限定语）。
- `index-all.html`：`{%- assign page_count = site.nav.size | plus: 3 -%}`（那 3 是 index-all/feed/llms），新加一节就把 `plus: 3` → `plus: 6`。
- `sitemap.xml`：`{% for item in site.nav %}{% if item.url != '/' %}` 那段之后、`site.posts` 循环之前是指名地址的位置（现有唯一破例是 `/index-all.html`，weekly/0.6）。设计文档 §4.4 要新页 `monthly` / `0.7`。
- `llms.txt`：`## 站点页面` 段 `site.nav` 循环之后是那三条点名 bullet；`base` 已在 25 行 `assign`。**18-23 行有硬排版坑**：Liquid 开标签带 `-` 会吃掉后面的换行，新加的三条 bullet 只能单侧带减号。
- `USAGE.md:459` 的检索层自查计数：`BlogPosting 67 + BreadcrumbList 67 + CollectionPage 26 + WebSite/Blog 各 1 + Person 2 = 164 块`。
- 令牌实测存在的名字就这些：`--paper --surface --surface-2 --ink --ink-2 --ink-3 --ink-4 --rule --rule-2 --signal --signal-ink --signal-soft --scrim --shadow-1..3 --radius-s|m|l --gutter --dur-1..5 --dur-eclipse --ease-out|in-out|back|emph --stagger --travel-s|m|l|xl --rs`。**`--radius-md` / `--dur-fast` 不存在**，写样式别用。
- `package.json` 的 `dependencies` 是 `{}`，devDeps 只有 autoprefixer/concurrently/postcss/postcss-px-to-viewport/sass/terser/vite——**没有 jsdom / linkedom / cheerio**。所以 §I 的 DOM 测试用手写假 DOM，不为此加依赖（加了就要动 `package.json` + 锁文件，正撞 0.6 的并发面）。

### 0.6 与另一会话的并发面（开工时实测）

`git status --porcelain` 现在挂着 7 项改动 + 3 项未跟踪：`.gitignore`、`_config.yml`、`_data/og_images.yml`、`_drafts/WRITING_PROTOCOL.md`、`_drafts/persona.md`、`package.json`、`dev/sass/common/tokens.scss`（写这份计划的过程中它又变红了一次），未跟踪的是 `scripts/lib/`、`scripts/wechat-draft.mjs`、`.baoyu-skills/`。

**本段的刻意收敛**：一个共享文件都不碰。`_config.yml` 不需要改（入口数据走 `_data/onlineTools.yml`），`package.json` 不需要改（测试继续用 §0.1 那条 node 命令，不加 `test:tools`），版本三处同步留给段 5。需要动既有文件的地方只有 `_includes/header.html`、`tools.html`、`index-all.html`、`sitemap.xml`、`llms.txt`、`USAGE.md`、`README.md`、`CHANGELOG.md`、`postcss.config.js`、`assets/data/LICENSES.md`、`_data/tools.yml`（**不改**）——它们此刻都不在对方的清单里，但**每次暂存前重新 `git status` 确认**，并按文件名 stage，绝不 `git add -A`。

---

## 1. 文件结构

**新增**

```
tools-idcard.html                    页面：五块面板的构建期骨架 + 自带 CSS/JS 引用
_data/onlineTools.yml                在线工具单一数据源（下拉分组 / tools.html 小节 / index-all 三处共用）
dev/js/tools/bank-bin-data.js        生成物：bcbc 两张 CSV 压成一张紧凑表（纯数据）
dev/js/tools/carrier-data.js         生成物：56 个三位号段 → 运营商（纯数据）
dev/js/tools/bankcard.js             Luhn + 最长前缀查表 + 生成
dev/js/tools/phone.js                格式 + 号段查表 + 生成
dev/js/tools/random-data.js          姓名 / 地址 / 邮箱合成（地址吃 region.js 的现行县码）
dev/js/tools/view.js                 纯函数：结论 → HTML 字符串（转义只在这一处）
dev/js/tools/panel-dom.js            createPanelWorkspace 的 DOM 绑定层（属性表原样写进节点）
dev/js/toolkitCore.js                跨页共享层入口 → window.Tk（0.2 那条实测的产物）
dev/js/toolIdcard.js                 本页装配层：读表单 → 调模块 → 写结果区
dev/sass/toolkit.scss                .tk-* 一套样式，只用语义令牌
scripts/build-prefix-data.mjs        两张快照 → 两个生成物（可离线重跑、幂等）
scripts/fixtures/bankbin/{bin,name}.csv  第三方快照（git 跟踪、哈希钉死）
scripts/fixtures/carrier/impulse.py       同上
scripts/fixtures/{bankbin,carrier}/SOURCES.json
scripts/check-tools-surface.mjs      §8.2 的产物与收录面判据（本段新增的六族断言）
```

**修改**：`scripts/toolkit-tests.mjs`（追加 §E–§I）、`scripts/verify-plan-blocks.mjs`（认第二份计划）、`postcss.config.js`、`_includes/header.html`、`tools.html`、`index-all.html`、`sitemap.xml`、`llms.txt`、`USAGE.md`、`README.md`、`CHANGELOG.md`、`assets/data/LICENSES.md`、本计划自身（Task 10/11 回填实测）。

> **执行期已落地的四处**（2026-09-27，随 Task 1）：`scripts/verify-plan-blocks.mjs` 现在认两份计划、分节标记放宽到 `§([B-Z]\d*) `，并补了三道守卫（反查 `FILE_TARGETS` 漏项、`--fix` 在"切分变了"的形状下拒绝落笔、标记行自己漂了按节名兜底定位——见 §0.1 红线 4）；新增 `scripts/verify-plan-blocks-teeth.mjs`，那三道守卫每道都有注入实验，14 项自证；`scripts/toolkit-tests.mjs` 追加了 §E0 与 §F0 两节数据形状判据；`assets/data/LICENSES.md` 新增了 §二（并把 §三–§五 顺延成 §四–§六，§六 的"往第一节加行"改成"为新来源新起一节"，因为插入 §二 之后那句话已经不指向对的东西）。其余文件仍按各任务的时点改。

> **基线从 65 涨到 68（2026-09-27，Task 2 复核整改）**：Task 2 的规格复核查出"表里唯一一组嵌套前缀"那句是错的，
> 于是补了三条判据把这件事钉住——§E0 的 `E0-4`（数据形状：8 个父 BIN / 32 组 / 9 条挨挡登记）与 §E 的
> `E21`（收窄条件逐个扫种子不抛）、`E22`（避让是构造期发生的、定值 rng 下逐字符可复现）。
> **Task 1–2 之外的所有 `# tests` / `# pass` 预期数已按 +3 同步**（Task 3 起步 83、Task 4 98、Task 5 113、
> Task 6 129、Task 7 145），照着判就行。但**写明"2026-09-26 / 09-27 在镜像上实跑"的那几张变异台账**
> （Task 5 的二十九刀、Task 6 的三十一刀、Task 7 的六十六刀）是在 +3 之前的基线上量的，正文里那句
> "基线 `# tests 142` 全绿"记的就是当时的数——**各任务真正落地时按当时的全量数复跑一遍台账**，
> 别拿旧数当阈值，也别因为"刀数对不上"就判那一轮作废。

> **基线再涨到 69（2026-09-27，Task 2 代码质量复核整改）**：上一轮 +3 之后又对 `bankcard.js` 做了一次
> 质量复核，落地四处改动，其中只有一处新增用例——`E23`（三张派生表只读：`lookupBin` 交出去的是表内
> 那份数组，`info.primary` 是表内的行对象本身，不冻结就会静默串到之后所有查询和整个生成池）。
> 其余三处不改变用例数：`E21` 把"手挑七组收窄"扩成"九条挨挡登记 × 池内每一档 = 32 档"的覆盖面判据，
> 并加上取值次数判据；`E18` 拿 `BIN_META` 的三个计数做三方对账（`BIN_META` 此前没有任何消费者）；
> `E14`/`E16` 把两处"或"式与"> 1"式弱断言逐值收紧。
> **Task 3 之后的预期数因此再按 +1 同步**（Task 3 起步 84、Task 4 99、Task 5 114、Task 6 130、Task 7 146），
> 各任务"跑第一个红"那一格的数也一并 +1；上面那三张旧台账仍然按"落地时复跑"处理。
>
> 同一轮里的三处非判据改动，写在这里是为了下一个人不必重新发现：`CHILD_BY_PREFIX` 从"给每条 BIN 的
> 全部真前缀建键"（852 键 / 8,653 次插入）收窄成"只给本身也是登记 BIN 的前缀建键"（8 键 / 32 次插入），
> 对 1,697 个登记 BIN 的 `childrenOf` 结果逐条相同；"至少留一位给账号体"这条口径原来在读侧写了两遍
> （`lookupBin` 的 `n >= digits.length` 与 `triedLengths` 的 `n < digits.length`），现在合成一个
> `tryableLengths`；模块头那句"入参形状不对就抛"只对生成侧成立，已限定。


**删除**：无（`demo/idCardDemo/` 按设计文档 §10 留到段 5）。

---

## 2. 任务与顺序

| # | 任务 | 可独立核验的产物 |
| --- | --- | --- |
| 1 | 两份快照入库 + 生成两张紧凑码表 + 许可归属 | `pnpm build` 绿、两个生成物与 SOURCES 哈希自洽、`§E0/§F0` 数据判据 |
| 2 | `bankcard.js` | §E 全绿（Luhn 官方向量、最长前缀、生成侧自洽） |
| 3 | `phone.js` | §F 全绿（格式、号段自洽、缺口显式记录） |
| 4 | `random-data.js` | §G 全绿（姓名/地址/邮箱形状、example 保留域） |
| 5 | `view.js` | §H 全绿（转义、三态类名、表格列数一致） |
| 6 | `panel-dom.js` + 手写假 DOM | §I 全绿（一次只一块、roving tabindex、hash、单块错误隔离） |
| 7 | 页面 + 样式 + 装配层 + `toolkitCore` | `pnpm build` 与 `jekyll build` 绿、产物存在性、`.tk-` 无 vw |
| 8 | 三处入口（下拉分组 + `is_current` 修法 + tools.html 小节 + index-all 节） | 高亮逐字节抽查与改前一致 |
| 9 | 收录面 + `check-tools-surface.mjs` | 六族断言全绿 |
| 10 | headless Chrome 实测（§8.3 本页那一档） | 真实传输字节、五档宽度、禁 JS、键盘、零异常 |
| 11 | 收口：全量门禁 + 变异自证 + 回填 + 按路径提交 | 计划与磁盘一致、判据仍有牙 |

顺序不可乱的是：1 → 2/3/4（数据先于算法）→ 5/6（视图与绑定先于页面）→ 7 → 8 → 9 → 10 → 11。2/3/4 之间、5/6 之间互不依赖，可以并行，但**同一个文件 `scripts/toolkit-tests.mjs` 只有一个写入者**——并行时后跑的必须重跑一次全量。

---

## Task 1: 两份第三方快照入库 + 两张紧凑码表 + 许可归属

**Files:**
- Create: `scripts/fixtures/bankbin/bin.csv`、`scripts/fixtures/bankbin/name.csv`、`scripts/fixtures/bankbin/SOURCES.json`
- Create: `scripts/fixtures/carrier/impulse.py`、`scripts/fixtures/carrier/SOURCES.json`
- Create: `scripts/build-prefix-data.mjs`
- Create: `dev/js/tools/bank-bin-data.js`、`dev/js/tools/carrier-data.js`（生成物）
- Modify: `assets/data/LICENSES.md`
- Test: `scripts/toolkit-tests.mjs`（新增 `// ── §E 银行卡` 的 E1–E3 数据段前置断言之外，本任务只加 **§E0/§F0** 两条数据形状判据到 §A 之后，见 Step 6）

- [ ] **Step 1: 抓快照（按 commit 钉死，不跟分支）**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
mkdir -p scripts/fixtures/bankbin scripts/fixtures/carrier
BC=de631827ffe8db2792d140f3476b02498fc1244f   # hexindai/bcbc master @ 2025-02-05
IC=dcacca9bf28132ca6938eb2c162e9b222ae02a53   # LSG-PolarBear/impulse master @ 2026-08-28
for f in bin name; do
  curl -fsS --http1.1 -m 40 -o "scripts/fixtures/bankbin/$f.csv" \
    "https://cdn.jsdelivr.net/gh/hexindai/bcbc@$BC/data/$f.csv" \
    || curl -fsS --http1.1 -m 40 -o "scripts/fixtures/bankbin/$f.csv" \
    "https://raw.githubusercontent.com/hexindai/bcbc/$BC/data/$f.csv"
done
curl -fsS --http1.1 -m 40 -o scripts/fixtures/carrier/impulse.py \
  "https://cdn.jsdelivr.net/gh/LSG-PolarBear/impulse@$IC/impulse.py" \
  || curl -fsS --http1.1 -m 40 -o scripts/fixtures/carrier/impulse.py \
  "https://raw.githubusercontent.com/LSG-PolarBear/impulse/$IC/impulse.py"
shasum -a 256 scripts/fixtures/bankbin/*.csv scripts/fixtures/carrier/impulse.py
```

Expected 三个哈希（与 2026-09-26 取证时逐字相同；对不上就说明 pin 记错了或上游被改写，**停下来核对，别改哈希**）：

```
9ebabf828af89e50c6fbfdcaac3cf6f46757d36003007a9458b5c04fc1140de6  scripts/fixtures/bankbin/bin.csv
1a77cec8dacac144179173917512500b63a7814005ad15d04cd722d11558b20f  scripts/fixtures/bankbin/name.csv
176254550e0aca653e86cde1f21409c7d76b41867fbf7d66df85054683ce1fe2  scripts/fixtures/carrier/impulse.py
```

`raw.githubusercontent.com` 本机抖动明显（取证时同一个文件先超时后成功），所以两条 URL 用 `||` 串起来；`-f` 让 404 直接非零，不会把错误页当数据写进快照。

- [ ] **Step 2: 落两份 SOURCES.json（机器可读的那一份，字段照 region-source 的形状长）**

`scripts/fixtures/bankbin/SOURCES.json`：

```json
{
  "schema": 1,
  "fetchedAt": "2026-09-26",
  "dataset": {
    "provider": "hexindai/bcbc",
    "ref": "de631827ffe8db2792d140f3476b02498fc1244f",
    "refNote": "钉死在不可变的 commit 上（master @ 2025-02-05T07:44:34Z）。抓两条 URL：jsdelivr 的 @<sha> 与 raw 的 /<sha>/，两边都写 commit 而不是 master，分支前进不影响复现。",
    "license": "MIT",
    "licenseEvidence": "仓库根 LICENSE 原文首段 MIT License、版权行 Copyright (c) 2018 - 2020 Runswen；GitHub API /repos/hexindai/bcbc 返回 license.spdx_id=MIT。",
    "natureOfData": "第三方整理的银联卡 BIN 对照表（发卡行码、卡种类、该 BIN 登记的卡号长度），不是银联官方发布。"
  },
  "files": [
    {
      "file": "bin.csv",
      "url": "https://cdn.jsdelivr.net/gh/hexindai/bcbc@de631827ffe8db2792d140f3476b02498fc1244f/data/bin.csv",
      "kind": "bin",
      "bytes": 31515,
      "sha256": "9ebabf828af89e50c6fbfdcaac3cf6f46757d36003007a9458b5c04fc1140de6",
      "count": 1709,
      "countNote": "count 一律 = 去掉表头后的**非空**数据行数。bin.csv 无空行（`wc -l` 与 `awk 'END{print NR}'` 都是 1710，减表头 1 行 = 1709），两种口径同值；1709 行覆盖 1697 个不同 BIN，其中 12 个 BIN 各占 2 行（同一 BIN 登记了两种卡种，见产物 `BIN_META.ambiguousBins`）。",
      "header": "bin,bank,type,length"
    },
    {
      "file": "name.csv",
      "url": "https://cdn.jsdelivr.net/gh/hexindai/bcbc@de631827ffe8db2792d140f3476b02498fc1244f/data/name.csv",
      "kind": "name",
      "bytes": 6849,
      "sha256": "1a77cec8dacac144179173917512500b63a7814005ad15d04cd722d11558b20f",
      "count": 275,
      "countNote": "count = 去掉表头后的**非空**行数。name.csv 共 300 行（awk NR 口径；末行无换行符，`wc -l` 读作 299），表头 1 行 + 上游留下的空行 24 行，非空数据行 275 个，即 275 个行别码带中文名。本仓 BIN 表只引用其中 260 个（产物 `BANKS` 键数实测 260），另 15 个码有名无人用；§E0 判据与生成器都按这 260 个收。",
      "header": "bank,name"
    }
  ]
}
```

`scripts/fixtures/carrier/SOURCES.json`：

```json
{
  "schema": 1,
  "fetchedAt": "2026-09-26",
  "dataset": {
    "provider": "LSG-PolarBear/impulse",
    "ref": "dcacca9bf28132ca6938eb2c162e9b222ae02a53",
    "refNote": "master @ 2026-08-28T03:08:54Z。仓库只有一个 impulse.py + README + LICENSE，号段数据在 OPERATORS 字典里。",
    "license": "Apache-2.0",
    "licenseEvidence": "GitHub API /repos/LSG-PolarBear/impulse 返回 license.spdx_id=Apache-2.0，仓库根 LICENSE 为 Apache 2.0 正文。",
    "natureOfData": "第三方整理的三位号段 → 运营商归属，用途是渗透测试字典生成。",
    "knownGap": "工信部《电信网编号计划》原文与两份可交叉核对的公开整理稿都没能在这台机器上取到（wikipedia 恒超时、baike 返回反爬壳、libphonenumber 的 86_zh 是 482 字节二进制且粒度粗于三位段；归属地类仓库 ls0f/phone、dannyhu926/phone_location、funNLP 均无 license，等于保留所有权利，不可抄）。因此本表是唯一来源，读侧一律标『仅供参考』，判据 §F 只断自洽不断外部正确性。"
  },
  "files": [
    {
      "file": "impulse.py",
      "url": "https://cdn.jsdelivr.net/gh/LSG-PolarBear/impulse@dcacca9bf28132ca6938eb2c162e9b222ae02a53/impulse.py",
      "kind": "operators",
      "bytes": 23548,
      "sha256": "176254550e0aca653e86cde1f21409c7d76b41867fbf7d66df85054683ce1fe2",
      "count": 56,
      "countNote": "count = 展开后的三位号段个数（5 家运营商、56 段、彼此不重叠），不是 `OPERATORS` 字典的键数。产物与 §F0 判据同径。"
    }
  ]
}
```

- [ ] **Step 3: 写生成器 `scripts/build-prefix-data.mjs`**

要求：只读仓库里的快照、**全程不联网**、同一输入 → 同一字节（所有清单先 `sort` 再去重）、`--check` 只比对不写盘。

```js
#!/usr/bin/env node
/**
 * 把两张第三方快照压成读侧用的紧凑码表。
 *
 * 与 `build-region-data.mjs` 同一套约定：脚本只读 `scripts/fixtures/` 里哈希钉死的快照、
 * 全程不联网（离线 `--check` 也必须在 CI 里跑通），输出**字节可复现**——所有键集合先排序
 * 再去重再拼，不写时间戳（快照日期记在 SOURCES.json 与产物头注释里，不是产物里的可变值）。
 *
 * 用法：
 *   node scripts/build-prefix-data.mjs            # 生成两个产物
 *   node scripts/build-prefix-data.mjs --check    # 与磁盘比对，不等则退 1 并点名差在哪
 *
 * 两个产物为什么不是一份 JSON：读侧只想做一次 `split` 和一层循环（设计文档 §7 的
 * 体积口径按实测算，编码只占两成成本），而且 JSON 里 1,709 个引号与逗号本身就白占几 KB。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN_CSV = path.join(ROOT, 'scripts/fixtures/bankbin/bin.csv');
const NAME_CSV = path.join(ROOT, 'scripts/fixtures/bankbin/name.csv');
const CARRIER_PY = path.join(ROOT, 'scripts/fixtures/carrier/impulse.py');
const OUT_BANK = path.join(ROOT, 'dev/js/tools/bank-bin-data.js');
const OUT_CARRIER = path.join(ROOT, 'dev/js/tools/carrier-data.js');
const BIN_META = { provider: 'hexindai/bcbc', ref: 'de631827ffe8db2792d140f3476b02498fc1244f', fetchedAt: '2026-09-26', license: 'MIT' };
const CARRIER_META = { provider: 'LSG-PolarBear/impulse', ref: 'dcacca9bf28132ca6938eb2c162e9b222ae02a53', fetchedAt: '2026-09-26', license: 'Apache-2.0' };

/** 去掉 BOM、拆非空行 */
function lines(text) {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
}

/** CSV 的 `a,b,c,d` 一行四列；列数不对就停，别把残缺行咽进产物 */
function parseCsv(text, label, cols) {
  const rows = [];
  for (const [i, line] of lines(text).entries()) {
    const no = i + 1;
    if (no === 1) {
      const head = line.split(',');
      if (head.length !== cols || head.some((h) => h.trim() === '')) {
        throw new Error(`${label} 表头不是 ${cols} 列：${JSON.stringify(line)}`);
      }
      continue;
    }
    const parts = line.split(',');
    if (parts.length !== cols || parts.some((p) => p.trim() === '')) {
      throw new Error(`${label} 第 ${no} 行解析不出 ${cols} 列：${JSON.stringify(line.slice(0, 40))}`);
    }
    rows.push(parts.map((p) => p.trim()));
  }
  return rows;
}

/** OPERATORS 字典：Python 源里的一段，按形状抠出来；抠不到就是快照变了形状，必须停 */
function parseOperators(text) {
  const m = /OPERATORS\s*=\s*\{([\s\S]*?)\n\}/.exec(text);
  if (!m) throw new Error('impulse.py 里找不到 OPERATORS = { ... } 这一块，快照形状与生成器假设不一致');
  const out = new Map();
  for (const line of m[1].split('\n')) {
    const e = /^\s*"([^"]+)"\s*:\s*\[([^\]]*)\]/.exec(line);
    if (!e) continue;
    const segs = [...e[2].matchAll(/"(\d{3})"/g)].map((x) => x[1]);
    if (segs.length === 0) throw new Error(`号段 ${e[1]} 一个都没抠出来，宁可不写产物`);
    out.set(e[1], segs);
  }
  if (out.size === 0) throw new Error('OPERATORS 抠出来是空的');
  return out;
}

function buildBank() {
  const names = new Map(parseCsv(fs.readFileSync(NAME_CSV, 'utf8'), 'name.csv', 2));
  const rows = parseCsv(fs.readFileSync(BIN_CSV, 'utf8'), 'bin.csv', 4);
  const banks = [...new Set(rows.map((r) => r[1]))].sort();
  const idx = new Map(banks.map((code, i) => [code, i]));
  const packed = [];
  const bins = new Map();
  for (const [bin, bank, type, length] of rows) {
    if (!/^\d{3,10}$/.test(bin)) throw new Error(`BIN ${bin} 不是 3–10 位数字`);
    if (!/^\d{2}$/.test(length)) throw new Error(`BIN ${bin} 的卡号长度 ${length} 不是两位数字`);
    if (!/^[A-Z]{2,3}$/.test(type)) throw new Error(`BIN ${bin} 的卡种类 ${type} 形状不认识`);
    if (!idx.has(bank)) throw new Error(`BIN ${bin} 的行别码 ${bank} 不在 name.csv 里`);
    packed.push(`${bin} ${idx.get(bank)} ${type} ${length}`);
    bins.set(bin, (bins.get(bin) ?? 0) + 1);
  }
  // 快照里同一个 BIN 可以有多条登记（实测 12 个 BIN 共 24 行，例如 `621260` 同时挂着
  // SPABANK 贷记 16 位与 CSRCB 借记 19 位）——上游本来就有冲突，读侧不能假装没有。
  // 排序把"取哪一条"变成字典序的确定性结果，同时**一条都不丢**，让面板把并列的候选都列出来。
  packed.sort();
  const dup = [...bins.entries()].filter(([, n]) => n > 1);
  return { banks, packed, names, distinct: bins.size, dup };
}

function renderBank(b) {
  const bankLines = b.banks.map((c) => `  ['${c}', '${b.names.get(c) ?? ''}'],`).join('\n');
  const rowsText = b.packed.join(';');
  return `/**
 * 生成物，别手改：\`node scripts/build-prefix-data.mjs\` 重跑即覆盖。
 * 来源 ${BIN_META.provider} @ ${BIN_META.ref}（快照 ${BIN_META.fetchedAt}，许可 ${BIN_META.license}）。
 * 机器可读清单见 \`scripts/fixtures/bankbin/SOURCES.json\`；许可与归属的说明文字在
 * \`assets/data/LICENSES.md\`。
 *
 * \`BIN_ROWS\` 一格一条：\`BIN 行别码下标 卡种类 该 BIN 登记的卡号长度\`，字段间空格、条目间分号，
 * 整串按条目文本排序后写入（同一个 BIN 允许有多条登记，快照实测 12 个 BIN 共 24 行，
 * 排序把"取哪一条"变成确定性的字典序结果，且一条都不丢）。
 * 不用 JSON 而用这张串，是为了读侧只做一层 \`split\` 和一层循环（设计文档 §7 的体积口径）。
 */
export const BIN_META = ${JSON.stringify({ ...BIN_META, rows: b.packed.length, distinctBins: b.distinct, ambiguousBins: b.dup.length })};

/** 行别码 → 中文名；快照 name.csv 有 275 个码，BIN 表实际只用到 260 个，这里只收用到的 */
export const BANKS = [
${bankLines}
];
export const BIN_ROWS = '${rowsText}';
`;
}

function renderCarrier(entries) {
  const segLines = [...entries].sort().map(([carrier, segs]) =>
    `  ['${carrier}', '${segs.join(' ')}'],`).join('\n');
  return `/**
 * 生成物，别手改：\`node scripts/build-prefix-data.mjs\` 重跑即覆盖。
 * 来源 ${CARRIER_META.provider} @ ${CARRIER_META.ref}（快照 ${CARRIER_META.fetchedAt}，
 * 许可 ${CARRIER_META.license}）。机器可读清单见 \`scripts/fixtures/carrier/SOURCES.json\`。
 *
 * **它是单一来源**：工信部编号计划原文与第二份可交叉核对的公开整理稿都没能取到，
 * 缺口与后果记在 \`SOURCES.json\` 的 \`knownGap\` 与 \`phone.js\` 的 \`CARRIER_NOTE\` 里；
 * 判据 §F 因此只断自洽（不重叠、形状、生成侧与校验侧同结论），不断外部正确性。
 */
export const CARRIER_META = ${JSON.stringify(CARRIER_META)};
/** 运营商 → 三位号段清单（空格分隔），按运营商名排序 */
export const CARRIER_SEGMENTS = [
${segLines}
];
`;
}

function main() {
  const check = process.argv.includes('--check');
  const b = buildBank();
  const ops = parseOperators(fs.readFileSync(CARRIER_PY, 'utf8'));
  const bankText = renderBank(b);
  const carrierText = renderCarrier(ops);
  if (check) {
    let bad = 0;
    for (const [file, text] of [[OUT_BANK, bankText], [OUT_CARRIER, carrierText]]) {
      const disk = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      if (disk === text) { console.log(`✓ ${path.relative(ROOT, file)}`); continue; }
      bad = 1;
      console.log(`✗ ${path.relative(ROOT, file)} 与生成结果不一致`
        + `（磁盘 ${disk === null ? '不存在' : `${disk.length}B`} vs 生成 ${text.length}B）`);
    }
    process.exit(bad);
  }
  fs.writeFileSync(OUT_BANK, bankText);
  fs.writeFileSync(OUT_CARRIER, carrierText);
  const segTotal = [...ops.values()].reduce((n, v) => n + v.length, 0);
  console.log(`bank-bin-data.js：${b.packed.length} 条 BIN 登记 / ${b.distinct} 个不同 BIN`
    + `（其中 ${b.dup.length} 个 BIN 有多条并列登记）/ ${b.banks.length} 个行别码`);
  console.log(`carrier-data.js：${ops.size} 家运营商 / ${segTotal} 个三位号段`);

}

main();
```

- [ ] **Step 4: 跑生成器，核验条数与幂等**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
node scripts/build-prefix-data.mjs
node scripts/build-prefix-data.mjs --check; echo "check exit=$?"
gzip -c dev/js/tools/bank-bin-data.js | wc -c
node -e "const fs=require('fs'),z=require('zlib');const b=fs.readFileSync('dev/js/tools/bank-bin-data.js');
console.log(b.length+'B / gz9 '+z.gzipSync(b,{level:9}).length+'B');"
```

Expected（2026-09-26 在 `/tmp/pfx` 镜像里跑同一份生成器与同一对快照实测得到的输出，逐字符照抄）：

```
bank-bin-data.js：1709 条 BIN 登记 / 1697 个不同 BIN（其中 12 个 BIN 有多条并列登记）/ 260 个行别码
carrier-data.js：5 家运营商 / 56 个三位号段
✓ dev/js/tools/bank-bin-data.js
✓ dev/js/tools/carrier-data.js
check exit=0
```

体积（2026-09-27 按仓库现状重测，口径一律 `cat <文件> | gzip -N -c | wc -c`，不带 FNAME；
`gzip -9 -c <文件>` 那种写法把**文件名的 basename** 写进头部，同一份文件多出「basename 长度 + 1」
字节——实测 `bank-bin-data.js` 10,616 → 10,633（+17）、`carrier-data.js` 887 → 903（+16）。
另一把常见的错尺子是 `node:zlib.gzipSync(…, level 9)`：它对同一份 carrier 给 936B，比 CLI
还大 49B。别拿这两种数去和 spec §7 的预算对账）：`bank-bin-data.js` **38,475B**
（gzip -6 = 10,617B、-9 = 10,616B）；`carrier-data.js` **1,239B**（gz9 **887B**）。
用仓库里的 terser 过一遍（`node_modules/.bin/terser … --compress --mangle --module`）是
**36,494B / gz9 9,828B**——比源小 1,981B（gz 少 788B），省的是文件头注释与缩进，
`BIN_ROWS` 那 28,266 字符的分号串一个字节都动不了；这 1,981B 也正是 Task 7 那支入口
`toolIdcard.min.js` 里看不到的部分，terser 剥注释，所以产物 gzip 与源文件注释长短无关。

**这个体积压在预算上是有张力的，必须写明白**：设计文档 §7 给证件页 JS+CSS 的预算是 gzip ≤ 60KB，
而本页要同时挂 `region-data.js`（实测 34.8KB gz）+ 这张（9.9KB）+ `carrier-data.js`（0.9KB）
= **45.6KB 数据**，留给页面 JS 与 CSS 只剩 ~14KB。所以 Task 7 的 Step 6 必须真量一次页面产物的
gzip 总数（`assets/js/toolIdcard.min.js` + `assets/js/toolkitCore.min.js`，`toolkit.min.css` 那一件到
Task 8 才存在、在那一格补量），三种结果分别处理：
① 在 60KB 内 → 把实测数按 §7 的写法回填设计文档；② 超了 → **停下来报 BLOCKED**，
把分解表（region / bank / carrier / 其余 JS / CSS）交回来由人重新决定预算或砍覆盖，
**不许静默放宽 §7 的数，也不许悄悄删 BIN 表条目凑数**；③ 逼近（55–60KB）→ 允许把
`BANKS` 的中文名拆成按需第二张表（`bin → bankCode` 留在紧凑串里），但那要改读侧的
一次查表，必须在计划外的改动单里列出来再做。

> **2026-09-27 回填：这一格立的那条分叉走到了 ②。** Task 7 Step 6 量出 73,101 B gzip（超当时
> 的 61,440 B 共 11,661 B），按 BLOCKED 协议交回，用户拍板取处置 (a)——§7 那一行已改写为
> **gzip ≤ 76KB（77,824 B，实测之上余 4,723 B）**，并新立 **首屏关键路径 ≤16KB** 一条；三个处置的
> 取舍与否决理由在 Task 7 Step 6 末的拍板记录。③ 那档（拆 `BANKS` 中文名）**没触发**，
> 两张更紧的 BIN 编码仍然不采用。这一段留在原地的理由是它记的是"当初怎么决定判据的"，
> 不是当前预算值——当前值只认 spec §7。
事先测过更紧的两种编码再决定不采用，理由要留在注释里：把 `类型 长度` 换成二元组的下标
（快照里共 10 种：`CC 15`、`CC 16`、`DC 15`、`DC 16`…`SCC 16`）省 6,850B 原文 / 256B gzip；
把 `行别 类型 长度` 整体换成三元组的下标（450 种）省 11,163B 原文 / 687B gzip。省的都是 gz 的百分之几，代价是产物读不懂、
读侧多一层查表——所以沿用可读形状，等②真发生再动它。

- [ ] **Step 5: `assets/data/LICENSES.md` 补两行归属**

在文件的"一、两张区划表"之后新增一节（表格列名与上面那张保持一致，不新造口径）：

```markdown
## 二、行别与号段两张表（`/tools/idcard.html` 的银行卡与手机号面板）

| 用途 | 来源 | 许可 | 取到的东西 |
| --- | --- | --- | --- |
| 银行卡 BIN → 发卡行 / 卡种类 / 卡号长度（`bank-bin-data.js`） | [hexindai/bcbc](https://github.com/hexindai/bcbc) 的 `data/bin.csv` + `data/name.csv`，pin 在 commit `de631827ffe8db2792d140f3476b02498fc1244f`（2025-02-05） | MIT | 1,709 条 BIN、260 个行别码；BIN 长 3–10 位，卡号长度只有 15–19 五种 |
| 三位号段 → 运营商（`carrier-data.js`） | [LSG-PolarBear/impulse](https://github.com/LSG-PolarBear/impulse) 的 `impulse.py` 里 `OPERATORS` 字典，pin 在 commit `dcacca9bf28132ca6938eb2c162e9b222ae02a53`（2026-08-28） | Apache-2.0 | 5 家运营商 / 56 个三位号段 |

两张都是**第三方整理的结果**，不是银联也不是工信部的发布物，所以面板上各带一行"仅供参考、
不承诺全量"。号段这张只有**一个来源**：编号计划原文取不到（wikipedia 在本机恒超时、baike
只返回反爬壳），可交叉核对的归属地仓库 `ls0f/phone`、`dannyhu926/phone_location`、`funNLP`
**全部无 license**（等于保留所有权利），所以一张都不抄。这个缺口同时决定了
`scripts/toolkit-tests.mjs` 的 §F 只断自洽性、不断外部正确性——细节在
`scripts/fixtures/carrier/SOURCES.json` 的 `knownGap`。
```

- [ ] **Step 6: 数据形状判据 §E0 / §F0（先写判据，跑红，再看它凭什么该绿）**

追加到 `scripts/toolkit-tests.mjs` 末尾。分节标记必须长成 `// ── §E0 银行卡 …` 这个形状
（`verify-plan-blocks.mjs` 的 `SEG_MARK` 按它切分；2026-09-27 把那条正则从 `§([B-Z]) `
放宽成 `§([B-Z]\d*) `，否则 §E0/§F0 不被认成节，会被整段吞进 §D 的尾巴——§D 假红、
§E0/§F0 假绿，两种错形状一起发生）。下面这块是**磁盘最终形状**，含每节自己的那行
`await import`，所以它与 `toolkit-tests.mjs` 的对应那一节逐字节全等；"先红后绿"由 Step 7
那一记临时摘掉 import 的探针来示范，不靠把载荷写成半成品。

```js
// ── §E0 银行卡码表数据形状（快照 → 生成物） ──────────────────────────────
const { BANKS, BIN_META, BIN_ROWS } = await import('../dev/js/tools/bank-bin-data.js');
test('E0-1 生成物与快照同步：--check 必须退 0', () => {
  // 这条判据不看内容只看退出码：它防的是"改了快照忘了重跑生成器"这一整类漂移。
  const r = spawnSync(process.execPath, ['scripts/build-prefix-data.mjs', '--check'],
    { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, `生成物落后于快照：\n${r.stdout}${r.stderr}`);
});
test('E0-2 BIN 表：形状、行别下标、并列登记按字典序且一条不丢', () => {
  assert.equal(BANKS.length, 260, '行别码条数与快照实测不一致');
  const rows = BIN_ROWS.split(';');
  assert.equal(rows.length, 1709, '条目数少于快照行数——并列登记被去掉了');
  assert.deepEqual([...rows].sort(), rows, '条目没有按文本排序，取哪一条不确定');
  const counts = new Map();
  for (const row of rows) {
    const [bin, idx, type, len] = row.split(' ');
    assert.match(bin, /^\d{3,10}$/);
    counts.set(bin, (counts.get(bin) ?? 0) + 1);
    assert.ok(Number.isInteger(+idx) && +idx >= 0 && +idx < BANKS.length, `${bin} 的行别下标越界`);
    assert.ok(['DC', 'CC', 'PC', 'SCC'].includes(type), `${bin} 的卡种类 ${type} 不在已知的四种里`);
    // 快照实测只有 15–19 五档（15:5、16:1005、17:52、18:89、19:558）。出现 14 或 20
    // 就是上游加了新卡种，读侧的"长度不符"文案要人重看，所以这里钉死而不是给区间。
    assert.ok([15, 16, 17, 18, 19].includes(+len), `${bin} 的卡号长度 ${len} 不在五档里`);
  }
  // 上游本来就有 12 个 BIN 挂着两条登记（快照实测 1,709 行 / 1,697 个不同 BIN）。
  // 这一格把"读到几条并列"钉住，读侧据此决定要不要把候选都列出来（Task 2 的 E6）。
  const dup = [...counts.entries()].filter(([, n]) => n > 1);
  assert.equal(counts.size, 1697);
  assert.equal(dup.length, 12, `并列登记的 BIN 个数变了：${dup.map(([b]) => b).join(' ')}`);
  assert.ok(dup.every(([, n]) => n === 2), '出现了三条以上的并列登记，读侧的展示口径要重定');
});

test('E0-3 每一位数档都有代表，最长前缀不是只对着 6 位一种写', () => {
  const byLen = new Map();
  for (const row of BIN_ROWS.split(';')) {
    const n = row.split(' ')[0].length;
    byLen.set(n, (byLen.get(n) ?? 0) + 1);
  }
  // 快照实测：3 位 2 条、4 位 3 条、5 位 30 条、6 位 1,594 条、7 位 2 条、8 位 28 条、
  // 9 位 48 条、10 位 2 条。少任何一档，说明读侧的分桶在生成器里就没被写全。
  for (const [n, want] of [[3, 2], [4, 3], [5, 30], [6, 1594], [7, 2], [8, 28], [9, 48], [10, 2]]) {
    assert.equal(byLen.get(n) ?? 0, want, `${n} 位 BIN 条数变了`);
  }
});

test('E0-4 表里确实有嵌套前缀：8 个父 BIN、32 组、9 条登记生成时会挨挡', () => {
  // 这一段钉的是**生成侧避让**赖以成立的数据形状。旧口径说"表里唯一一组嵌套是 9558 ⊂ 95588"，
  // 实测是 32 组、8 个父 BIN，其中 9 条登记的本体位数够补齐自家子前缀——那 9 条正是
  // `603265 / 621059 / 621241 / 621260×2 / 622421 / 622498 / 940046 / 9558`。
  const rows = BIN_ROWS.split(';').map((r) => r.trim().split(' '));
  const bins = [...new Set(rows.map((r) => r[0]))];
  const kids = (b) => bins.filter((x) => x.length > b.length && x.startsWith(b));
  const parents = bins.filter((b) => kids(b).length > 0);
  assert.equal(parents.length, 8, '有更长子前缀的 BIN 个数变了，生成侧的避让口径要重看');
  assert.equal(parents.reduce((n, b) => n + kids(b).length, 0), 32, '嵌套前缀对数变了，同上');
  assert.deepEqual(parents.sort(), ['603265', '621059', '621241', '621260', '622421', '622498', '940046', '9558']);
  const risky = rows.filter(([b, , , len]) => kids(b).some((c) => c.length <= +len - 1));
  assert.equal(risky.length, 9, '生成时会被自家更长前缀盖住的登记条数变了');
  // 最挤的一支（621260 下 62126010 开头）挡 8 个数字、仍留 2 个可走；十个全被占满的分支必须有界
  const branch = new Map();
  for (const b of parents) for (const c of kids(b)) {
    const pre = c.slice(0, c.length - 1);
    if (!branch.has(pre)) branch.set(pre, new Set());
    branch.get(pre).add(c[c.length - 1]);
  }
  assert.equal([...branch.values()].reduce((n, s) => Math.max(n, s.size), 0), 8, '单支挡路数字上限变了');
  assert.ok([...branch.values()].every((s) => s.size < 10), '有分支把 0-9 全占满，避让会退化成重取');
  // 子前缀长度**正好等于**登记位数的那一支今天要不存在，生成侧自检那格才够得着
  assert.equal(rows.filter(([b, , , len]) => kids(b).some((c) => c.length === +len)).length, 0,
    '出现了与登记位数等长的子前缀，生成侧要连校验位一起撞，自检那格从不可达变可达');
});
// ── §F0 号段数据形状 ─────────────────────────────────────────────────────
const { CARRIER_SEGMENTS } = await import('../dev/js/tools/carrier-data.js');
test('F0-1 五家运营商、56 个三位段、彼此不重叠', () => {
  assert.equal(CARRIER_SEGMENTS.length, 5);
  const owner = new Map();
  let total = 0;
  for (const [carrier, segsText] of CARRIER_SEGMENTS) {
    const segs = segsText.split(' ');
    assert.ok(segs.length > 0, `${carrier} 一个号段都没有`);
    total += segs.length;
    for (const s of segs) {
      assert.match(s, /^1[3-9]\d$/, `${carrier} 的号段 ${s} 不是合法的三位移动段`);
      assert.ok(!owner.has(s), `号段 ${s} 同时属于 ${owner.get(s)} 与 ${carrier}`);
      owner.set(s, carrier);
    }
  }
  assert.equal(total, 56);
});
```

跑完 Step 6 直接就是绿的——Step 4 已经把两张产物生成在磁盘上了，"模块还不存在"那一档
文件级红在本任务**不可达**（它是段 1 的形状，也是本计划 Task 2/3/4/5 的形状：那四个模块
此刻真的还没有）。本任务的"先红"换成一记探针：把两行 `await import` 临时摘掉再跑，
红必须落在**新写的这四条**上。2026-09-27 实测（在 `/tmp` 全量副本上做，仓库工作树一行不动）：

```bash
# 副本里先把 §E 那一段剪掉——本探针量的是 Task 1 落地时刻的文件形状，那会儿 §E 还不存在。
# 不剪的话 §E 的 E18/E19 也吃 `BANKS`/`BIN_ROWS`，红名单会多出两条、变成六条（2026-09-27 复现过）。
n=$(grep -n '^// ── §E 银行卡' scripts/toolkit-tests.mjs | cut -d: -f1)
[ -n "$n" ] || { echo '没找到 §E 标记，探针形状不对'; exit 1; }
sed -n "1,$((n - 1))p" scripts/toolkit-tests.mjs > /tmp/t1cut && mv /tmp/t1cut scripts/toolkit-tests.mjs
# 副本里删掉 §E0/§F0 那两行 import（行号会随追加浮动，按内容删）
sed -i '' "/await import('..\/dev\/js\/tools\/bank-bin-data.js')/d;/await import('..\/dev\/js\/tools\/carrier-data.js')/d" scripts/toolkit-tests.mjs
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs > /tmp/t1red.log 2>&1; echo "exit=$?"
grep -E "^not ok|^# (tests|pass|fail)" /tmp/t1red.log
grep -E "^  error: " /tmp/t1red.log | sort | uniq -c
```

Expected：`exit=1`、`# tests 46 / # pass 42 / # fail 4`，四条 `not ok` 点名
**E0-2 / E0-3 / E0-4 / F0-1**，报错正文按定义点计数是 `BANKS is not defined` ×1（E0-2 先撞上它）、
`BIN_ROWS is not defined` ×2（E0-3、E0-4）、`CARRIER_SEGMENTS is not defined` ×1。
E0-1 不红是**对的**：它只看生成器 `--check` 的退出码，一行都不碰那两个符号。
跑前先证明副本没坏（未删 import 时 46/46 全绿），否则这条探针
量的是一份跑不起来的文件。**别把这四红当成"判据有效"的证据**——判据有没有牙是 Step 8 的事。

- [ ] **Step 7: 跑绿并交代那两行 `await import` 的口径**

**不要**往文件头那批 `import` 里加东西——段 1 的口径是**每节自己 `await import`**：§B 那一节
在标记紧下方引 `idcard.js` / `random.js`（磁盘 §B = 861–1681 一节内），§C 引 `uscc.js`
（§C = 1682–2297 内），§D 引 `panel.js`（`:2300`）。文件头注释里写明了理由："模块还没落地"
这一档的红长成**文件级** `not ok 1 - scripts/toolkit-tests.mjs`（`ERR_MODULE_NOT_FOUND`），
按 `await import` 才留得住这个形状。Step 6 那块载荷里那两行就是照这个口径写的，位置在
每节标记的**紧下方**——所以那块也就是磁盘的最终形状（`verify-plan-blocks.mjs` 逐字节核它）。

`spawnSync` 与 `ROOT` 都已在文件里（`spawnSync` 由 §A 从 `node:child_process` 引过，
`ROOT` 是第 60 行那个常量），**不要再引一遍**。摘掉 import 的探针跑完要把副本丢掉、
**别拿副本回写仓库**，然后按仓库现状跑全量：

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^# (tests|pass|fail)|^exit='; echo "exit=${PIPESTATUS[0]}"
```

Expected：`# pass 46`、`# fail 0`（41 + 5）。

- [ ] **Step 8: 自证这两条判据有牙（不注入就不算过）**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
mkdir -p /tmp/t1mut && cp dev/js/tools/carrier-data.js /tmp/t1mut/carrier.orig.js
shasum -a 256 dev/js/tools/carrier-data.js | tee /tmp/t1mut/hash.before
cat > /tmp/t1mut/mutate.mjs <<'EOF'
// 变异：把 192（广电）也塞给联通——F0-1 的"不重叠"那一档必须当场红
import fs from 'node:fs';
const p = 'dev/js/tools/carrier-data.js';
const t = fs.readFileSync(p, 'utf8');
const patched = t.replace("['中国联通', '130 131", "['中国联通', '192 130 131");
if (patched === t) throw new Error('变异没落地：没匹配到联通那一行的开头，别判"判据有效"');
fs.writeFileSync(p, patched);
EOF
node /tmp/t1mut/mutate.mjs
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^not ok' | head
cp /tmp/t1mut/carrier.orig.js dev/js/tools/carrier-data.js
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^# (pass|fail)'
shasum -a 256 dev/js/tools/carrier-data.js   # 必须与 /tmp/t1mut/hash.before 逐字相同
```

Expected：`mutate.mjs` 静默通过（没落地就自己抛）；变异时 `not ok` 里点到 `F0-1`，
失败信息是 `号段 192 同时属于 中国广电 与 中国联通`；恢复后 `# fail 0`、`# pass 46`，
最后两个哈希逐字相同。若变异没让 `F0-1` 红，先确认文件真的被改了（`git diff --stat
dev/js/tools/carrier-data.js`），别急着判"判据有效"。
**为什么用 heredoc 写脚本而不是 `node -e '…'`**：这一行的替换串里同时有单引号和中文，
嵌在 shell 单引号里要写 `'\''`，本机 zsh 曾因一个未配对的双引号**静默不执行**整条复合命令
（2026-09-26 实测，探针文件根本没建出来）——判据自证的脚本不能被引号咬。

- [ ] **Step 9: 提交前先过两道门禁，再提交**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
# 门禁一：判据全绿（46 条 = §A–§D 的 41 条 + §E0/§F0 的 5 条）
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs > /tmp/t1.final.log 2>&1
echo "test exit=$?"; grep -E '^# (tests|pass|fail)' /tmp/t1.final.log
# 门禁二：计划镜像与磁盘逐字节全等（本任务改了 verify-plan-blocks.mjs 与两份载荷，必须现证）
node scripts/verify-plan-blocks.mjs; echo "blocks exit=$?"
git status --porcelain   # 先确认对方那 7 项没被顺手带上
git add scripts/fixtures/bankbin scripts/fixtures/carrier scripts/build-prefix-data.mjs \
        dev/js/tools/bank-bin-data.js dev/js/tools/carrier-data.js \
        assets/data/LICENSES.md scripts/toolkit-tests.mjs
git commit -m "$(cat <<'EOF'
feat(tools): 段 2 起步——BIN 与号段两张快照入库并生成紧凑码表

两张表都是第三方整理结果、按 commit 钉死，行别标 MIT、号段标 Apache-2.0；
号段只有单一来源（编号计划原文与可交叉核对的无 license 仓库都不可用），
缺口记在 SOURCES.json 的 knownGap，§F 因此只断自洽不断外部正确性。
EOF
)"
git status --porcelain | head
```

Expected：`test exit=0` 且 `# fail 0`；`blocks exit=0`（若这里退 1，先按红线 4 跑 `--fix`
再回来，不许带着红提交）。提交只含这 7 条路径——判据用 `git show --stat HEAD` 现证，
**不要照抄任何一份"对方那批"的文件名单**：另一路会话每轮都在改不同的文件（`.gitignore`、
`_config.yml`、`_data/og_images.yml`、`_drafts/*`、`package.json` 是常驻的，其余会变），
名单一抄就过期。规则只有一条：`git add` 按文件名点名，末尾 `git status` 剩下的必须是
**这一提交里没有的别人的活儿**。

> **执行期修正（2026-09-27，Task 1 复核后补）**：实际落地比上面这条多两个文件——
> `scripts/verify-plan-blocks.mjs`（认第二份计划 + `§([B-Z]\d*) `）和本计划自身，
> 它们跟着复核整改单独成一提交，`47dace6` 仍只含那 7 条路径。复核还改掉三处
> 计划里的数字：§E0/§F0 的"变红形状"换成现场摘掉两行 `await import` 实测出的
> `E0-2 / E0-3 / F0-1` 三条（原先写的是猜的；E0-4 是 Task 2 复核时补进来的，Step 6 那一档
> 已在同一副本上复测成四条、`# fail 4`）；两张数据表的体积改成现场重测值——
> `bank-bin-data.js` 38,475 B（`cat f | gzip -N -c` 10,617 B、`-9` 10,616 B）、
> `carrier-data.js` 1,239 B（`-6`/`-9` 两档都 887 B），旧稿那两个数各有各的错尺子——
> 38,459 是 `/tmp` 镜像里那版少一行注释的产物（镜像文件现在还在，`wc -c` 可查），
> 936 是 `node:zlib.gzipSync(..., level 9)` 对同一份 1,239 B 文件给出的数（现测可复现），
> CLI stdin 口径是 887 B；
> `count` 的口径按输入形状分家（JSON 数组算长度、CSV 算去表头后的非空行，`name.csv`
> 的 275 由此而来，`awk NR=300` 里含 24 个上游空行与 1 行表头）。

---

## Task 2: `bankcard.js` — Luhn、最长前缀查表、生成侧

**Files:**
- Create: `dev/js/tools/bankcard.js`
- Test: `scripts/toolkit-tests.mjs`（§E）

判据里每一个数字都是在 `/tmp/pfx` 镜像上跑出来的，不是推的：`6212601500012345` 的校验位确实是 `5`、
并列登记的 12 个 BIN 里第一个是 `621260`（SPABANK 贷记 16 位 / CSRCB 借记 19 位）。照抄即可，别改成"看起来更像"的号码。

> **执行期修正（2026-09-27 复核）**：这一节原来还写着"表内唯一一组跨长度嵌套前缀是 `9558 ⊂ 95588`"，
> 实测是**两组都不止**——1,697 个 BIN 里 **8 个**有更长子前缀、嵌套对 **32 组**（`603265 ⊂ 60326500`、
> `621260 ⊂ 621260107` 那一串都在里面），其中 **9 条登记**的本体位数够补齐自家子前缀。那句话不只是
> 描述不准：生成侧的自检当时正是按它写的，于是 `{ bin: '9558', length: 19 }` 实测 **3,000 轮里抛 148 轮
> （4.93%）**、默认 `{ count: 50 }` **3,000 轮里抛 26 轮（0.87%）**，用户点一次"生成"就能看到
> 「内部不变量」。Step 3 的生成循环与 §E0/§E 的三条判据（E0-4、E21、E22）已经按这个事实改掉，
> 下面的镜像块就是改后的磁盘内容。

- [ ] **Step 1: 先写 §E 的 23 条判据（此时 `bankcard.js` 还不存在，必红）**

追加到 `scripts/toolkit-tests.mjs` 末尾（§E0 / §F0 之后）。**别名那两格不能省**：
`GENERATE_MAX` 已被 §B 从 `idcard.js` 占着（§C 当年就为同一件事写成 `USCC_GENERATE_MAX`），
两个都是 50，不改名就会拿身份证那个常量替银行卡作证。

```js
// ── §E 银行卡 ──────────────────────────────────────────────────────────────
const { BANK_CAVEAT, BANK_OPTIONS, BIN_SOURCE, CARD_TYPES,
  GENERATE_MAX: BANK_GENERATE_MAX, PAN_MAX, PAN_MIN, TOP_BANKS,
  formatCardGroup, generateBankCards, lookupBin, luhnCheckDigit, luhnValid, luhnWork,
  parseBankCard, parseBankCardList } = await import('../dev/js/tools/bankcard.js');

const ck = (r) => Object.fromEntries(r.checks.map((c) => [c.key, c.ok]));
/** 本体 → 补好校验位的整串 */
const pan = (body) => body + luhnCheckDigit(body);

test('E1 Luhn 官方向量与逐位算式', () => {
  assert.equal(luhnValid('4242424242424242'), true);
  assert.equal(luhnValid('4242424242424241'), false);
  const w = luhnWork('7992739871');
  assert.equal(w.sum, 67);
  assert.equal(w.mod, 7);
  assert.equal(w.expected, '3');
  assert.equal(luhnCheckDigit('7992739871'), '3');
  assert.equal(luhnValid('79927398713'), true, '11 位：Luhn 成立但位数不在 13–19，由 E6 单独管');
});

test('E2 逐位算式的每一步都能手算对上', () => {
  const w = luhnWork('424242424242424');
  assert.equal(w.steps.length, 15);
  assert.deepEqual(w.steps.slice(0, 3), [
    { d: 4, pos: 15, double: true, value: 8 },
    { d: 2, pos: 14, double: false, value: 2 },
    { d: 4, pos: 13, double: true, value: 8 },
  ]);
  assert.deepEqual(w.steps.at(-1), { d: 4, pos: 1, double: true, value: 8 }, '本体最右位必须翻倍');
  for (const s of w.steps) {
    const doubled = s.d * 2;
    assert.equal(s.value, s.double ? (doubled > 9 ? doubled - 9 : doubled) : s.d, `第 ${s.pos} 位`);
  }
  assert.equal(w.sum % 10, w.mod);
  assert.equal(w.expected, String((10 - w.mod) % 10));
  assert.equal(w.sum, w.steps.reduce((n, s) => n + s.value, 0));
});

test('E3 本体不合规时算式返回 null，不抛', () => {
  for (const bad of ['', '12a45', null, undefined, 4242, ['4242']]) {
    assert.equal(luhnWork(bad), null, `收到 ${JSON.stringify(bad)}`);
  }
  assert.equal(luhnCheckDigit('12a45'), null);
  assert.equal(luhnValid('7'), false, '单字符没有"本体"可言，一律算不成立而不是抛');
});

test('E4 五态各命中一次，且硬结论优先于软参考', () => {
  assert.equal(parseBankCard('').state, 'empty');
  assert.equal(parseBankCard('622588013763447x').state, 'malformed');
  assert.equal(parseBankCard('9999999999999999').state, 'luhn');
  assert.equal(parseBankCard('4242424242424242').state, 'unlisted');
  assert.equal(parseBankCard('6212601500012345').state, 'valid');
  // 999999 恰好是华夏银行在表内的 BIN，所以它落 luhn 而不是 unlisted：
  // Luhn 不过这条**硬**结论必须排在"表外"这条**软**参考之前。
  assert.equal(ck(parseBankCard('9999999999999999')).bin, true, '校验位不对也照样报行别');
  assert.equal(parseBankCard('9999999999999995').state, 'valid');
});

test('E5 各状态转换处 checks 的行数与三态分布', () => {
  assert.deepEqual(parseBankCard('').checks, [], '空输入不摆四行表，面板按 state 显示引导文案');
  const short = parseBankCard('111111111113');
  assert.deepEqual(ck(short), { charset: true, length: false });
  assert.equal(short.info, null, '位数这一关就出局的，不给 info');
  assert.equal(ck(parseBankCard('622588013763447x')).charset, false);
  assert.deepEqual(ck(parseBankCard('622588013763447x')), { charset: false, length: true },
    '字符不过时只走两行，不给后面的 Luhn 与行别');
  assert.deepEqual(ck(parseBankCard('6212601500012345')),
    { charset: true, length: true, luhn: true, bin: true });
});

test('E6 位数闸门按 13–19 两侧各切一刀', () => {
  assert.equal(PAN_MIN, 13);
  assert.equal(PAN_MAX, 19);
  assert.equal(parseBankCard(pan('1'.repeat(11))).digits.length, 12);
  assert.equal(parseBankCard(pan('1'.repeat(11))).state, 'malformed', '12 位在门外');
  assert.equal(parseBankCard(pan('1'.repeat(12))).state, 'unlisted', '13 位进门');
  assert.equal(parseBankCard(pan('1'.repeat(18))).state, 'unlisted', '19 位仍在门内');
  assert.equal(parseBankCard(pan('1'.repeat(19))).digits.length, 20);
  assert.equal(parseBankCard(pan('1'.repeat(19))).state, 'malformed', '20 位出界');
});

test('E7 分组分隔符不算错，六种写法同一结论', () => {
  const want = parseBankCard('6212601500012345');
  for (const form of ['6212 6015 0001 2345', '6212-6015-0001-2345',
    '6212\u30006015\u30000001\u30002345', '6212\u00A06015\u00A00001\u00A02345',
    '6212\t6015\t0001\t2345', '  6212601500012345  ']) {
    const r = parseBankCard(form);
    assert.equal(r.state, want.state, form);
    assert.equal(r.digits, '6212601500012345', form);
    assert.equal(r.checks[0].ok, true, form);
  }
  assert.equal(parseBankCard('-').state, 'malformed', '整串只有分隔符：去掉之后 0 位，位数那一行红');
  assert.equal(parseBankCard('-').digits, '');
  const bad = parseBankCard('6212 6015 0001 234a');
  assert.equal(bad.state, 'malformed');
  assert.match(bad.checks[0].detail, /「a」（去掉分组空格与连字符后的第 16 位）/);
});

test('E8 最长前缀：95588 赢过 9558，试过的档位按降序留痕', () => {
  const r = parseBankCard('9558891712345678908');
  assert.equal(r.state, 'valid');
  assert.equal(r.info.bin, '95588');
  assert.equal(r.info.binLength, 5);
  assert.deepEqual(r.info.triedLengths, [10, 9, 8, 7, 6, 5]);
  assert.equal(lookupBin('9558891712345678908').bin, '95588', '表里 9558 与 95588 同属 ICBC，取最长');
  assert.equal(lookupBin('9896123456789012').bin, '9896', '四位 BIN 要在试完 10–5 之后仍被命中');
  assert.deepEqual(lookupBin('9896123456789012').tried, [10, 9, 8, 7, 6, 5, 4]);
  assert.equal(lookupBin('4242424242424242'), null);
});

test('E9 前缀不得吃掉整串：至少留一位给账号体', () => {
  assert.equal(lookupBin('103'), null, '三位串不许拿三位 BIN 命中（103 确实在表里，是 ABC）');
  assert.equal(lookupBin('1034').bin, '103', '四位串就可以；3 是表内最短的一档');
  assert.equal(lookupBin('95588').bin, '9558', '五位串拿不到 95588（它自己就等于串长），退到 9558');
  assert.equal(lookupBin('1'.repeat(13)), null, '谁的延伸都没命中，就是 null');
  assert.deepEqual(parseBankCard(pan('1'.repeat(12))).info.triedLengths,
    [10, 9, 8, 7, 6, 5, 4, 3], '13 位串从 10 试到 3；13 本身不落进候选（前缀必须给账号体留一位）');
});

test('E10 并列登记：主结论按位数挑，文案点名另一条', () => {
  const as16 = parseBankCard('6212601500012345');
  assert.equal(as16.ambiguous, true);
  assert.equal(as16.matches.length, 2);
  assert.equal(as16.info.primary.bankCode, 'SPABANK');
  assert.equal(as16.info.primary.cardType, 'CC');
  assert.equal(as16.checks[3].ok, true);
  assert.match(as16.checks[3].detail, /^平安银行（SPABANK）· 贷记卡 · 表内登记 16 位/);
  assert.match(as16.checks[3].detail, /另有 1 条并列登记（CSRCB\/借记卡\/19 位）/);
  const as19 = parseBankCard(pan('621260150001234567'.padEnd(18, '8')));
  assert.equal(as19.digits.length, 19);
  assert.equal(as19.state, 'valid');
  assert.equal(as19.info.primary.bankCode, 'CSRCB', '19 位串必须挑中登记 19 位的那条，而不是字典序第一条');
  assert.match(as19.checks[3].detail, /^常熟农商银行（CSRCB）· 借记卡 · 表内登记 19 位/);
  assert.deepEqual(as19.matches.map((m) => m.lengthMatches), [false, true]);
});

test('E11 登记位数不一致只记 null，不拖垮结论', () => {
  const off = parseBankCard('621260150001234567');
  assert.equal(off.digits.length, 18);
  assert.equal(off.state, 'valid', 'Luhn 过、前缀在表内但两条登记都对不上 18 位——只降 bin 行');
  assert.equal(off.checks[3].ok, null);
  assert.match(off.checks[3].detail, /此号 18 位（登记可能有缺漏，不据此判无效）/);
  assert.equal(parseBankCard('621260150001234').state, 'luhn', '15 位那条同时栽在 Luhn，硬的排在前面');
  assert.equal(ck(parseBankCard('621260150001234')).bin, null);
});

test('E12 未收录前缀：null 而不是 false，caveat 每条都在', () => {
  const r = parseBankCard('4242424242424242');
  assert.equal(ck(r).bin, null);
  assert.deepEqual(r.matches, []);
  assert.equal(r.ambiguous, false);
  assert.equal(r.info.bin, '');
  assert.equal(r.info.binLength, null);
  assert.deepEqual(r.info.triedLengths, [10, 9, 8, 7, 6, 5, 4, 3]);
  assert.match(r.checks[3].detail, /^前缀未收录（最长试到 10 位），不据此判无效$/);
  assert.equal(r.hasCaveat, true);
  assert.match(r.caveat, /不承诺全量/);
  assert.match(r.caveat, /查不到不等于号码无效/);
  assert.equal(r.info.source, BIN_SOURCE);
  assert.match(BIN_SOURCE, /^hexindai\/bcbc @ de63182（快照 2026-09-26）$/);
});

test('E13 建议形态只在 Luhn 那一档给', () => {
  const bad = parseBankCard('6212601500012340');
  assert.equal(bad.state, 'luhn');
  assert.equal(bad.info.luhnGiven, '0');
  assert.equal(bad.suggestedCard, '6212601500012345');
  assert.equal(parseBankCard(bad.suggestedCard).state, 'valid');
  assert.equal(parseBankCard('622588013763447x').suggestedCard, '', '结构非法不给建议号');
  assert.equal(parseBankCard('4242424242424242').suggestedCard, '', '本来就成立的更不给');
});

test('E14 入参形状：null / undefined / 数值都按字符串走，不抛', () => {
  for (const [v, want] of [[null, 'empty'], [undefined, 'empty'], [0, 'malformed'],
    [false, 'malformed'], [{}, 'malformed']]) {
    assert.equal(parseBankCard(v).state, want, `${JSON.stringify(v)} 必须安静地给出结论而不是抛`);
  }
  assert.equal(parseBankCard(null).state, 'empty');
  assert.equal(parseBankCard(undefined).state, 'empty');
  assert.equal(parseBankCard(621260150001234).state, 'luhn', '15 位数值：位数在区间内，只剩 Luhn');
  const r = parseBankCard(1234567890123456789);
  assert.equal(r.digits, '1234567890123456800', '19 位数值超出 2^53，进函数前末位就已经被舍掉');
  assert.equal(r.state, 'luhn', '舍出来的串仍按 19 位判：报的是"末位与算式不符"，不是"位数非法"');
  assert.equal(r.info.luhnGiven, '0');
});

test('E15 生成侧：任意收窄都自洽，产出的号必被自己判 valid', () => {
  // 钉种子：这一段本来用默认 rng（`seededRandom(Date.now())`），一旦红了就没法复现当时那组号。
  // 默认 rng 那条路径由 E16 的 `rng: null` 覆盖，不靠这里。
  for (const opts of [{}, { count: 5 }, { bankCode: 'ICBC' }, { cardType: 'CC' },
    { bin: '95588', length: 19 }, { length: 15 }, { bankCode: 'CMB', cardType: 'DC' }]) {
    const list = generateBankCards({ ...opts, rng: seededRandom(20260927) });
    assert.equal(list.length, opts.count ?? 1, JSON.stringify(opts));
    for (const item of list) {
      assert.equal(item.number.length, item.panLength);
      assert.equal(item.number.startsWith(item.bin), true);
      assert.equal(item.formatted, formatCardGroup(item.number));
      assert.equal(item.caveat, BANK_CAVEAT);
      const back = parseBankCard(item.number);
      assert.equal(back.state, 'valid', `${item.number} 自检为 ${back.state}`);
      assert.equal(back.info.primary.bankCode, item.bankCode);
      assert.equal(back.info.primary.cardType, item.cardType);
      assert.equal(back.info.bin, item.bin);
    }
  }
  assert.equal(BANK_GENERATE_MAX, 50);
});

test('E16 固定 rng 可复现，取值口径与身份证侧同档', () => {
  const rngSeed = () => { let s = 7; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; };
  const a = generateBankCards({ count: 8, rng: rngSeed() }).map((x) => x.number);
  const b = generateBankCards({ count: 8, rng: rngSeed() }).map((x) => x.number);
  assert.deepEqual(a, b);
  // 定值 LCG 下这 8 条是确定的 8 个不同 BIN（实测 8/8）；`> 1` 那种写法漏掉"退化成两三条轮转"
  assert.equal(new Set(a).size, 8, '同一个种子连出 8 条不是 8 个不同号，说明随机体没充分参与');
  assert.equal(new Set(generateBankCards({ count: 8, rng: rngSeed() }).map((x) => x.bin)).size, 8);
  assert.throws(() => generateBankCards({ rng: () => 2 }), /options\.rng 每次应给出 \[0, 1\)/);
  assert.throws(() => generateBankCards({ rng: 'x' }), TypeError);
  assert.equal(generateBankCards({ count: 1, rng: null }).length, 1, 'null = 没传，与 generateIdCards 同档');
});

test('E17 生成侧闸门点名到具体键', () => {
  assert.throws(() => generateBankCards({ count: 0 }), RangeError);
  assert.throws(() => generateBankCards({ count: BANK_GENERATE_MAX + 1 }), /options\.count 应为 1\.\.50/);
  assert.throws(() => generateBankCards({ count: '5' }), RangeError);
  assert.throws(() => generateBankCards({ bankCode: 'NOPE' }), /不在表内 260 个行别码里/);
  assert.throws(() => generateBankCards({ bankCode: 622588 }), TypeError);
  assert.throws(() => generateBankCards({ bankCode: '   ' }), TypeError);
  assert.throws(() => generateBankCards({ cardType: 'X' }), /只能是 DC \/ CC \/ PC \/ SCC/);
  assert.throws(() => generateBankCards({ bin: '62a' }), /options\.bin 只能含数字/);
  assert.throws(() => generateBankCards({ length: 12 }), /options\.length 应为 13\.\.19/);
  assert.throws(() => generateBankCards({ length: 20 }), RangeError);
  assert.throws(() => generateBankCards({ length: 16.5 }), TypeError);
  assert.throws(() => generateBankCards({ bankCode: 'ICBC', cardType: 'PC' }),
    /表内没有符合条件的 BIN（bankCode=ICBC cardType=PC）/);
  assert.equal(generateBankCards(null).length, 1, '整个 options 传 null 等于没传');
});

test('E18 行别下拉与表自洽，且与生成物头部计数三方对账', () => {
  assert.equal(BANK_OPTIONS.length, BANKS.length);
  assert.equal(BANK_OPTIONS.length, 260);
  // `binCount` 之和 = 表体条目数，这句话单独看是恒等式（两边同源），所以拿生成器写在文件头的
  // 三个计数当第三方来对：`BIN_META` 目前没有任何消费者，不对账就等于白生成。
  const entries = BIN_ROWS.split(';');
  assert.equal(BIN_META.rows, entries.length, '生成物头部的 rows 与表体条目数脱节——生成器计数口径漂了');
  assert.equal(BANK_OPTIONS.reduce((n, b) => n + b.binCount, 0), BIN_META.rows);
  const byBin = new Map();
  for (const row of entries) {
    const [bin, , , len] = row.split(' ');
    if (!byBin.has(bin)) byBin.set(bin, []);
    byBin.get(bin).push(+len);
  }
  assert.equal(byBin.size, BIN_META.distinctBins, '头部 distinctBins 与实际不同 BIN 个数脱节');
  const dup = [...byBin.values()].filter((v) => v.length > 1);
  assert.equal(dup.length, BIN_META.ambiguousBins, '头部 ambiguousBins 与并列登记个数脱节');
  // 读侧 `primary` 从并列里挑"位数与实测一致"的那一条，靠的就是同一 BIN 的两条登记位数不同。
  assert.ok([...byBin.values()].every((v) => new Set(v).size === v.length),
    '出现了同 BIN 同位数的两条登记，primary 的挑法不再唯一');
  const codes = BANK_OPTIONS.map((b) => b.code);
  assert.deepEqual(codes, [...codes].sort(), '下拉顺序按行别码升序，不依赖 locale 折叠');
  assert.ok(BANK_OPTIONS.every((b) => b.binCount > 0 && b.name !== ''));
  assert.equal(TOP_BANKS.length, 20);
  assert.equal(TOP_BANKS[0].code, 'ICBC', '表内 BIN 最多的 90 条必须排在第一位');
  assert.ok(TOP_BANKS[0].binCount >= TOP_BANKS.at(-1).binCount);
  const tie = TOP_BANKS.filter((b) => b.binCount === TOP_BANKS.at(-1).binCount).map((b) => b.code);
  assert.deepEqual(tie, [...tie].sort(), '并列必须按行别码升序收口，否则顺序随引擎');
});

test('E19 文案边界：只说"参考"，不冒充权威也不越界', () => {
  assert.equal(Object.keys(CARD_TYPES).join(','), 'DC,CC,PC,SCC');
  const types = new Set(BIN_ROWS.split(';').map((r) => r.split(' ')[2]));
  assert.deepEqual([...types].sort(), Object.keys(CARD_TYPES).sort(),
    '快照里出现了 CARD_TYPES 之外的卡种类，码表与文案要一起补');
  assert.doesNotMatch(BANK_CAVEAT, /VISA|MASTERCARD|银联|JCB|卡组织/);
  assert.doesNotMatch(BIN_SOURCE, /银联|官方/);
  for (const n of ['6212601500012345', '4242424242424242', '9999999999999999']) {
    assert.equal(parseBankCard(n).caveat, BANK_CAVEAT, `${n}：每条结果自带同一句 caveat，面板不必再拼`);
  }
});

test('E20 批量入口：跳空行、行号是原行号', () => {
  const rows = parseBankCardList('6212601500012345\n\n4242424242424242\n乱码\n');
  assert.deepEqual(rows.map((r) => r.line), [1, 3, 4]);
  assert.deepEqual(rows.map((r) => r.result.state), ['valid', 'unlisted', 'malformed']);
  assert.equal(rows[0].raw, '6212601500012345');
  assert.deepEqual(parseBankCardList(''), []);
  assert.deepEqual(parseBankCardList(null), []);
});

/** 把表体解成行对象，顺序与 `ROWS` 一致——E21 要用它自己算一遍生成池，不能只信生成器 */
const BIN_TABLE = BIN_ROWS.split(';').map((row) => {
  const [bin, idx, cardType, len] = row.split(' ');
  return { bin, bankCode: BANKS[+idx][0], cardType, panLength: +len };
});
/** 表内比 `bin` 更长、又以它为前缀的登记行 */
const longerKids = (bin) => BIN_TABLE.filter((r) => r.bin.length > bin.length && r.bin.startsWith(bin));

test('E21 挨过挡的收窄条件逐个扫种子：不抛，且读回来的前缀就是声明的那个', () => {
  // 2026-09-27 复核发现：表里 9 条登记的号码会被**自家更长的登记前缀**盖住（E0-4 钉着这个形状），
  // 旧实现在那些分支上直接抛「内部不变量」。实测旧的构造方式：
  //   `generateBankCards({ bin: '9558', length: 19, rng: seededRandom(s) })`，s=1..3000 → 抛 148 轮（4.93%）
  //   `generateBankCards({ count: 50, rng: seededRandom(s) })`，s=1..3000 → 抛 26 轮（0.87%）
  // 这一格把"面板点一次生成不该看到内部错误"钉成判据，并且要求读侧结论与声明一致。
  for (const opts of [{ bin: '9558', length: 19 }, { bin: '622421', length: 19 },
    { bin: '621260' }, { bin: '621059', length: 16 }, { bankCode: 'ICBC', length: 19 },
    { bankCode: 'BHB', length: 19 }, { bankCode: 'JSBANK', length: 16 },
    { bankCode: 'BOSZ', length: 19 }, { count: 20 }]) {
    for (let s = 1; s <= 120; s += 1) {
      const list = generateBankCards({ ...opts, rng: seededRandom(s) });
      for (const item of list) {
        const back = parseBankCard(item.number);
        assert.equal(back.state, 'valid', `${JSON.stringify(opts)} seed=${s} → ${item.number} 自检 ${back.state}`);
        assert.equal(back.info.bin, item.bin, `${JSON.stringify(opts)} seed=${s} 读回 ${back.info.bin} ≠ 声明 ${item.bin}`);
        assert.equal(back.info.primary.bankCode, item.bankCode, `${JSON.stringify(opts)} seed=${s} 行别被换掉了`);
      }
    }
  }
  // 上面那串收窄是**手挑的**，扫 120 个种子也只保证"挑中的那几行没问题"。这一格把覆盖面换成
  // 从表里现算：9 条挨挡登记（E0-4 同一判据）各自把四条收窄凑齐，池子里每一档都要能被点中、
  // 生成出来、并且读回自己。实测 9 个键共 32 档（`621260/CSRCB/19` 一支就占 18 档）。
  const riskyKeys = [...new Set(BIN_TABLE.filter((r) => longerKids(r.bin).some((c) => c.bin.length <= r.panLength - 1))
    .map((r) => `${r.bankCode} ${r.cardType} ${r.bin} ${r.panLength}`))].sort();
  assert.equal(riskyKeys.length, 9, '挨挡登记的个数变了，下面的覆盖面判据要跟着重看');
  let slots = 0;
  for (const key of riskyKeys) {
    const [bankCode, cardType, bin, panLength] = key.split(' ');
    const pool = BIN_TABLE.filter((r) => r.bankCode === bankCode && r.cardType === cardType
      && r.bin.startsWith(bin) && r.panLength === +panLength);
    assert.ok(pool.some((r) => r.bin === bin), `${key}：自己都不在自己的池里，收窄口径不一致`);
    for (let i = 0; i < pool.length; i += 1) {
      const row = pool[i];
      // 恒定取值 `roll` 只负责点中池内第 i 档（`Math.floor(roll * pool.length) === i` 恒成立）。
      // 本体的取值是**敌意**的：按这条登记最长的那个子前缀的尾巴轮转，专门去补自家前缀。
      // 为什么必须敌意：2026-09-27 十六刀台账实测，取值恒定时 M8（摘掉避让）在这 32 档里
      // 一档都碰不出来——`9558` 那档恒定取 0.25 → 本体全 2，压根不撞 `95588`，E21 于是全绿，
      // 避让只剩 E22 一条在守。换成敌意取值后 M8 在 `622498` 这一档直接抛内部不变量。
      const roll = (i + 0.5) / pool.length;
      const kids = longerKids(row.bin).map((r) => r.bin)
        .filter((c) => c.length <= row.panLength).sort((a, b) => b.length - a.length);
      const tail = kids.length > 0
        ? [...kids[0].slice(row.bin.length)].map((d) => (Number(d) + 0.5) / 10) : [0.5];
      let n = 0;
      let draws = 0;
      const [card] = generateBankCards({ bankCode, cardType, bin, length: +panLength,
        rng: () => { const v = n === 0 ? roll : tail[(n - 1) % tail.length]; n += 1; draws += 1; return v; } });
      slots += 1;
      const back = parseBankCard(card.number);
      assert.equal(card.bin, row.bin, `${key} 池内第 ${i} 档选错行了`);
      assert.equal(back.state, 'valid', `${key} 第 ${i} 档 → ${card.number} 自检 ${back.state}`);
      assert.equal(back.info.bin, row.bin, `${key} 第 ${i} 档被读侧换成了 ${back.info.bin}`);
      // 取值次数 = 选池 1 次 + 本体每位 1 次；避让挪位不吃随机数，重取才会。
      // 敌意取值下"不避让"必然撞子前缀，所以这一格同时盯着避让与自检两条链。
      assert.equal(draws, card.panLength - card.bin.length,
        `${key} 第 ${i} 档取了 ${draws} 次，期望 ${card.panLength - card.bin.length} 次：多出来的次数只能来自重取`);
    }
  }
  assert.equal(slots, 32, '九个键的池子总档数变了（实测 18+5+2+2+1×5 = 32），上面那段覆盖面的形状要重看');
});

test('E22 避让是构造期发生的：定值 rng 下逐字符可复现', () => {
  // 前提先钉住：`{bin:'9558', length:19}` 的池子按表内顺序是 `9558`、`95588` 两档，
  // 第一位取 0 才落到 `9558`。这句从表里现算，不靠"我记得它是 pool[0]"——表序一变，
  // 这个前提比号本身先红，红的理由才说得清。
  const pool = BIN_TABLE.filter((r) => r.bin.startsWith('9558') && r.panLength === 19);
  assert.deepEqual(pool.map((r) => `${r.bin} ${r.bankCode} ${r.cardType} ${r.panLength}`),
    ['9558 ICBC DC 19', '95588 ICBC DC 19']);
  // 紧接一位 0.8 → 算得 8，正好把子前缀 `95588` 补满，于是顺位挪到 9。剩下的 13 位取 0，
  // 校验位由 Luhn 算出。摘掉避让这一格（M8）后第一次取号会撞 95588、被自检拦下重取，
  // 产出的号就不是这一条，这条断言随即红——红的理由是"号变了"而不是"抛了"，这比 E21 更尖。
  const script = (vals) => { let i = 0; const f = () => vals[i++ % vals.length]; f.calls = () => i; return f; };
  const vals = [0, 0.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const drawn = script(vals);
  const [card] = generateBankCards({ bin: '9558', length: 19, rng: drawn });
  const body = '955890000000000000';
  assert.equal(card.bin, '9558');
  assert.equal(card.bankCode, 'ICBC');
  assert.equal(card.number, body + luhnCheckDigit(body), '第五位没被挪开，或挪开之后又走了别的分支');
  assert.equal(card.number.slice(4, 5), '9', '本体第五位本该由 0.8 算成 8（撞上 95588），避让要把它挪成 9');
  assert.equal(parseBankCard(card.number).info.bin, '9558');
  assert.equal(drawn.calls(), vals.length, '取值次数超过序列长度，说明中途重取过（避让没生效）');
  // 同一串取值再来一次，必须一字不差（避让不吃额外随机数，所以序列长度是确定的 15 次）
  const again = script(vals.slice());
  assert.deepEqual(generateBankCards({ bin: '9558', length: 19, rng: again })[0], card);
});

test('E23 三张派生表是只读的：谁都改不动共享行，第二次查询不受第一次影响', () => {
  // `lookupBin` 把 `BY_BIN` 里那个数组原样交出去（每查一次号都要省这一份拷贝），
  // `info.primary` 也是表内的行对象本身。不冻结的话，面板或调用方改一次就把生成池和之后
  // 所有查询一起改脏，且**不会有任何报错**。解冻其中任一处，这一格立刻红。
  const hit = lookupBin('6212601500012345');
  assert.equal(hit.rows.length, 2);
  assert.throws(() => { hit.rows.push({ bin: 'INJECT' }); }, TypeError);
  assert.equal(lookupBin('6212601500012345').rows.length, 2, '上一次的 push 渗到了这一次');
  const first = parseBankCard('6212601500012345');
  assert.throws(() => { first.info.primary.panLength = 999; }, TypeError);
  assert.equal(parseBankCard('6212601500012345').matches.map((m) => m.panLength).join(','), '16,19');
  assert.throws(() => { first.info.primary.bankCode = 'HACK'; }, TypeError);
  // `matches` 与 `triedLengths` 是**每次调用现生成**的，正相反：改它们只影响调用方自己那一份，
  // 所以不许抛，但必须证明改动漏不出去。两条路径各拿一份：命中时 `triedLengths` 来自
  // `lookupBin` 内部攒的 `tried`，未收录时来自 `tryableLengths` 现算，两边都得是新鲜的。
  const copy = parseBankCard('6212601500012345');
  copy.matches[0].panLength = 999;
  copy.info.triedLengths.push(99);
  const after = parseBankCard('6212601500012345');
  assert.equal(after.matches[0].panLength, 16, 'matches 原来是共享行，改一份就串了');
  assert.deepEqual(after.info.triedLengths, [10, 9, 8, 7, 6]);
  const miss = parseBankCard('4242424242424242');
  miss.info.triedLengths.push(99);
  assert.deepEqual(parseBankCard('4242424242424242').info.triedLengths, [10, 9, 8, 7, 6, 5, 4, 3]);
  // 生成侧同样读的是这些行：把整张表换掉要还能生成并自检通过
  assert.equal(generateBankCards({ bin: '9558', length: 19, rng: seededRandom(7) })[0].bankCode, 'ICBC');
});
```

- [ ] **Step 2: 跑红，确认红的形状**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^not ok|Cannot find module|^# (tests|pass|fail)'; echo "exit=${PIPESTATUS[0]}"
```

Expected：文件级那一行 `not ok 1 - scripts/toolkit-tests.mjs`，正文里
`ERR_MODULE_NOT_FOUND: Cannot find module '…/dev/js/tools/bankcard.js'`，`# tests 47`、`# pass 46`
（Task 1 那批照绿）、`# fail 1`、`exit=` 非 0。**红阶段看不到 `not ok E1 …`**——这是段 1
文件头注释里写死过的形状，别以为判据没生效。

- [ ] **Step 3: 写 `dev/js/tools/bankcard.js`**

```js
/**
 * 银行卡：Luhn 校验（带逐位算式）、BIN 最长前缀查表、生成侧。
 *
 * 数据来自 `bank-bin-data.js`（第三方快照 `hexindai/bcbc` 生成，见该文件头与
 * `assets/data/LICENSES.md`）。**行别与登记位数一律标"参考"**：快照是别人整理的结果、
 * 不含新发卡与调整，所以本模块把"前缀查不到"与"登记位数不一致"都归为 `null`
 * （不下结论）而不是 `false`——§5.4 的"查不到不等于无效"在这一页的落地方式。
 *
 * 与 `idcard.js` / `uscc.js` 同一套约定：纯函数、不碰 DOM。抛不抛分两侧——
 * **生成侧**（`generateBankCards`）入参形状不对就抛，读侧（`parseBankCard`）对任何输入
 * 都只给结论不抛，口径见 E14 与 E17。
 */
import { seededRandom } from './random.js';
import { BANKS, BIN_META, BIN_ROWS } from './bank-bin-data.js';

/** 卡号合法位数区间（§5.1：13–19 位）。表内登记的位数只落在这五档里。 */
export const PAN_MIN = 13;
export const PAN_MAX = 19;
/** 单次生成的条数上限，与 `generateIdCards` 同一档 */
export const GENERATE_MAX = 50;
/**
 * 单张卡号最多重取几次随机体（模块内部口径，不导出：面板不需要知道重试存在）。
 * 存在的理由是表里**确实**有嵌套前缀，见 `generateBankCards` 里那段判据的注释。
 */
const BODY_RETRY_MAX = 24;
/** 卡种类 → 中文；快照里只出现这四种（实测 CC 633 / DC 1056 / PC 6 / SCC 14 条） */
export const CARD_TYPES = { DC: '借记卡', CC: '贷记卡', PC: '预付费卡', SCC: '准贷记卡' };
export const BIN_SOURCE = `${BIN_META.provider} @ ${BIN_META.ref.slice(0, 7)}（快照 ${BIN_META.fetchedAt}）`;
export const BANK_CAVEAT =
  '行别与登记位数取自第三方整理的 BIN 快照，仅供参考、不承诺全量：新发卡、行别调整与'
  + '未收录前缀都不在表内，查不到不等于号码无效。';

const ROWS = BIN_ROWS.split(';').map((row) => {
  const [bin, idx, type, length] = row.split(' ');
  return {
    bin, bankCode: BANKS[+idx][0], bankName: BANKS[+idx][1],
    cardType: type, cardTypeName: CARD_TYPES[type] ?? type, panLength: +length,
  };
});

/** 前缀长度桶（降序）：10 → 3，实测八档都有条目 */
const BIN_LENGTHS = [...new Set(ROWS.map((r) => r.bin.length))].sort((a, b) => b - a);
/** `bin → 行`，一个 BIN 可以挂多条并列登记（快照实测 12 个 BIN 共 24 行） */
const BY_BIN = new Map();
for (const row of ROWS) {
  if (!BY_BIN.has(row.bin)) BY_BIN.set(row.bin, []);
  BY_BIN.get(row.bin).push(row);
}
const BANK_MAP = new Map(BANKS);

/**
 * 三张派生结构一律冻结。`lookupBin` 把 `BY_BIN` 里的那个数组**原样**交出去（省一次拷贝，
 * 每查一次号都要走它），`info.primary` 也是表内的行对象本身：任何一方改了它，错的不是这一条
 * 结果，而是之后所有查询和整个生成池。E23 钉住这一点——解冻其中任一处都会红。
 * 冻结后 `Object.freeze` 的写入在模块作用域（严格模式）下直接抛，不静默生效。
 */
for (const group of BY_BIN.values()) {
  for (const row of group) Object.freeze(row);
  Object.freeze(group);
}
Object.freeze(ROWS);

/** 前缀候选档：从最长往下试，且**必须给账号体留一位**（前缀长度 < 卡号长度）。
 *  读侧的分桶和"未收录时试到哪几档"的文案共用这一条口径，两边不是各写一遍比较式。 */
const tryableLengths = (len) => BIN_LENGTHS.filter((n) => n < len);

/**
 * `登记 BIN → 表内比它更长、又以它为前缀的登记前缀`（"这个 BIN 会被谁盖住"）。
 * 只对**本身也是登记 BIN** 的前缀建键（`childrenOf` 的入参永远是表内的 `row.bin`，别的键
 * 一辈子查不到）：快照实测这样只剩 **8 个键 / 32 次插入**，而给每条 BIN 的全部真前缀建键是
 * 852 个键 / 8,653 次插入——多出来的 844 个键没人查，1,697 个登记 BIN 的读回结果逐条相同（E0-4
 * 把"8 个父 BIN / 32 组"钉在数据侧，两头对得上）。
 * 为什么不退回两两比 `startsWith`：冷进程实测那一遍要 62.6–75.9ms（同进程里重复跑到第五遍仍要
 * 51.9–60.0ms），而本模块整个 import 才 9.7–12.7ms，首屏不值这个钱；建索引（窄法）实测
 * 1.28–1.53ms，宽法是 1.80–1.98ms——**这几毫秒摊不进 import 的抖动，所以删掉它量不出差别**，
 * 省下的是那 844 个没人查的键，不是时间。
 * 快照实测：1,697 个 BIN 里 **8 个**有更长子前缀，嵌套对 **32 组**（`603265 ⊂ 60326500`、
 * `621260 ⊂ 621260107` 那一串、`9558 ⊂ 95588` 都在里面），其中 **9 条登记**在生成时可能被自家
 * 更长的前缀盖住——读侧按最长前缀取，一旦补齐，本条的行别甚至卡种都会换一家。
 */
const CHILD_BY_PREFIX = new Map();
for (const bin of BY_BIN.keys()) {
  for (let k = 1; k < bin.length; k += 1) {
    const p = bin.slice(0, k);
    if (!BY_BIN.has(p)) continue;
    if (!CHILD_BY_PREFIX.has(p)) CHILD_BY_PREFIX.set(p, []);
    CHILD_BY_PREFIX.get(p).push(bin);
  }
}
const childrenOf = (bin) => CHILD_BY_PREFIX.get(bin) ?? [];

/** 报错文案里的"收到什么"，与 idcard / uscc / panel 同档 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}

/**
 * 去掉卡号里常见的分组分隔符（半/全角空格、连字符、破折号、不换行空格）。
 * 与身份证不同：**内部空白不算错**——卡号惯例按 4 位分组书写，粘进来就是带分隔的。
 */
function stripSeparators(text) {
  return text.replace(/[ \t\u3000\u00A0\-\u2010-\u2015]+/g, '');
}

/**
 * Luhn 逐位算式。`body` 是**不含校验位**的数字串。
 * @param {string} body 本体数字串
 * @returns {{steps:{d:number,pos:number,double:boolean,value:number}[],sum:number,mod:number,expected:string}|null}
 *   本体不合规（空串 / 含非数字）时返回 null，由调用方判三态，与 `computeCheckDigit` 同档
 */
export function luhnWork(body) {
  const s = typeof body === 'string' ? body : '';
  if (s === '' || !/^\d+$/.test(s)) return null;
  const steps = [];
  let sum = 0;
  for (let i = 0; i < s.length; i += 1) {
    const pos = s.length - i;            // 从左数第几位（1 起），供面板标注
    const d = Number(s[i]);
    // 从右往左数第 2、4、6… 位翻倍；等价于"本体长度 - 下标"为奇数时翻倍
    const double = (s.length - i) % 2 === 1;
    const value = double ? (d * 2 > 9 ? d * 2 - 9 : d * 2) : d;
    steps.push({ d, pos, double, value });
    sum += value;
  }
  const mod = sum % 10;
  return { steps, sum, mod, expected: String((10 - mod) % 10) };
}

/** 本体 → 校验位字符；本体不合规返回 null */
export function luhnCheckDigit(body) {
  const w = luhnWork(body);
  return w === null ? null : w.expected;
}

/** 整串（含末位）的 Luhn 是否成立 */
export function luhnValid(digits) {
  if (typeof digits !== 'string' || !/^\d{2,}$/.test(digits)) return false;
  return luhnCheckDigit(digits.slice(0, -1)) === digits.slice(-1);
}

/**
 * 最长前缀查表：从 `BIN_LENGTHS` 里最大的那一档往下试，且要求**至少留一位**给账号体
 * （口径统一在 `tryableLengths`）。命中即停，返回该 BIN 的**全部**并列登记。
 * @param {string} digits 纯数字卡号
 * @returns {{bin:string,rows:{bin:string,bankCode:string,bankName:string,cardType:string,cardTypeName:string,panLength:number}[],tried:number[]}|null}
 *   `rows` 是表内那份只读数组（冻结过），要改请先自己拷贝
 */
export function lookupBin(digits) {
  if (typeof digits !== 'string' || !/^\d+$/.test(digits)) return null;
  const tried = [];
  for (const n of tryableLengths(digits.length)) {
    tried.push(n);
    const hit = BY_BIN.get(digits.slice(0, n));
    if (hit) return { bin: digits.slice(0, n), rows: hit, tried };
  }
  return null;
}

/** 4 位一组、空格分隔的可读形态（16 位 → `xxxx xxxx xxxx xxxx`） */
export function formatCardGroup(digits) {
  const s = typeof digits === 'string' ? digits : '';
  return s.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** 三态结论里 `bin` 那一行的文案；`primary` 由调用方按位数挑过一条 */
function binDetail(primary, rest, length) {
  if (primary === null) {
    return `前缀未收录（最长试到 ${BIN_LENGTHS[0]} 位），不据此判无效`;
  }
  const head = `${primary.bankName}（${primary.bankCode}）· ${primary.cardTypeName}`;
  const tail = rest.length > 0
    ? `；另有 ${rest.length} 条并列登记（${rest.map((x) => `${x.bankCode}/${x.cardTypeName}/${x.panLength} 位`).join('、')}）`
    : '';
  if (primary.panLength === length) return `${head} · 表内登记 ${length} 位${tail}`;
  return `${head} · 表内登记 ${primary.panLength} 位，此号 ${length} 位（登记可能有缺漏，不据此判无效）${tail}`;
}

/**
 * 校验 / 解析一个银行卡号。五态：`empty` / `malformed` / `luhn` / `unlisted` / `valid`。
 *
 * 逐项表固定四行：字符 → 位数 → Luhn → 行别前缀。`ok` 三态，**只有 false 拖垮整体结论**：
 * 前缀未收录与登记位数不符都是 `null`（§5.4 的"查不到不等于无效"）。
 * Luhn 与查表**彼此独立**：校验位不对也照样报行别，因为用户要的正是"这号是谁家的、
 * 只是末位抄错了"。
 *
 * 状态优先次序：字符/位数不合法 → `malformed`（只前两行、`info` 为 null）；
 * Luhn 不过 → `luhn`；Luhn 过但前缀查不到 → `unlisted`；否则 `valid`。
 * `luhn` 与 `unlisted` 谁在前：`luhn`——硬结论（算式不成立）优先于软参考（表外）。
 *
 * @param {string|number} raw 用户输入；`null` / `undefined` 当空串。19 位号普遍超出
 *   2^53，数值进来就已经舍过末位了，口径同 `parseIdCard`：**一律传字符串**。
 * @returns {{input:string,value:string,digits:string,state:string,checks:object[],
 *   info:object|null,matches:object[],ambiguous:boolean,suggestedCard:string,
 *   caveat:string,hasCaveat:boolean}} 结果
 */
export function parseBankCard(raw) {
  const text = raw === null || raw === undefined ? '' : String(raw);
  const value = text.trim();
  const digits = stripSeparators(value);
  const out = {
    input: text, value, digits, state: 'empty', checks: [], info: null,
    matches: [], ambiguous: false, suggestedCard: '',
    caveat: BANK_CAVEAT, hasCaveat: false,
  };
  if (value === '') return out;
  const checks = out.checks;
  const push = (key, label, ok, detail) => checks.push({ key, label, ok, detail });

  const bad = /[^0-9]/.exec(digits);
  push('charset', '字符', !bad, bad
    ? `含非数字字符「${bad[0]}」（去掉分组空格与连字符后的第 ${bad.index + 1} 位）`
    : `去掉分隔符后为 ${digits.length} 位数字`);
  const lengthOk = digits.length >= PAN_MIN && digits.length <= PAN_MAX;
  push('length', '位数', lengthOk, lengthOk
    ? `${digits.length} 位（在 ${PAN_MIN}–${PAN_MAX} 位区间内）`
    : `${digits.length} 位，超出 ${PAN_MIN}–${PAN_MAX} 位`);
  if (bad || !lengthOk) {
    out.state = 'malformed';
    return out;
  }

  const work = luhnWork(digits.slice(0, -1));
  const expected = work.expected;
  const given = digits.slice(-1);
  const luhnOk = expected === given;
  push('luhn', 'Luhn 校验', luhnOk, luhnOk
    ? `逐位求和 ${work.sum}，mod 10 = ${work.mod} → 校验位 ${expected}，与末位一致`
    : `逐位求和 ${work.sum}，mod 10 = ${work.mod} → 算得 ${expected}，号码末位是 ${given}`);

  const found = lookupBin(digits);
  const rows = found === null ? [] : found.rows;
  // 并列登记里挑**与实测位数一致**的那一条作为主结论（12 个 BIN 有两条，例如 621260 同时
  // 挂着 SPABANK 贷记 16 位与 CSRCB 借记 19 位）；全都不一致时退回第一条，让文案说出
  // "表内登记 X 位、此号 Y 位"，而不是悄悄换一家。
  const primary = rows.find((m) => m.panLength === digits.length) ?? rows[0] ?? null;
  const rest = primary === null ? [] : rows.filter((m) => m !== primary);
  out.matches = rows.map((m) => ({ ...m, lengthMatches: m.panLength === digits.length }));
  out.ambiguous = rows.length > 1;
  push('bin', '行别前缀', primary === null ? null
    : (primary.panLength === digits.length ? true : null), binDetail(primary, rest, digits.length));

  out.info = {
    digits, length: digits.length,
    bin: primary === null ? '' : primary.bin,
    binLength: primary === null ? null : primary.bin.length,
    primary,
    triedLengths: found === null ? tryableLengths(digits.length) : found.tried,
    luhnExpected: expected, luhnGiven: given, luhnWork: work,
    source: BIN_SOURCE, datasetVersion: BIN_META.fetchedAt,
  };
  out.hasCaveat = true;
  if (!luhnOk) {
    out.state = 'luhn';
    out.suggestedCard = digits.slice(0, -1) + expected;
    return out;
  }
  out.state = primary === null ? 'unlisted' : 'valid';
  return out;
}

/**
 * 多行逐条判定（§5.1 的"一次粘多行"）。空行跳过，其余原样交给 `parseBankCard`。
 * @param {string} text 多行文本
 * @returns {{line:number,raw:string,result:object}[]} 每行一条，`line` 是 1 起的原行号
 */
export function parseBankCardList(text) {
  const src = text === null || text === undefined ? '' : String(text);
  const rows = [];
  src.split(/\r?\n/).forEach((line, i) => {
    if (line.trim() === '') return;
    rows.push({ line: i + 1, raw: line, result: parseBankCard(line) });
  });
  return rows;
}

/** 每次取值都保证落在 [0,1) 的随机源；形状与 `generateIdCards` 的同名闸门一致 */
function checkedRng(input) {
  if (input === undefined || input === null) return seededRandom(Date.now());
  if (typeof input !== 'function') {
    throw new TypeError(`generateBankCards 的 options.rng 应为 () => number，收到 ${shapeOf(input)}`);
  }
  return () => {
    const v = input();
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1) {
      throw new TypeError(`generateBankCards 的 options.rng 每次应给出 [0, 1) 内的有限数，收到 ${shapeOf(v)}`);
    }
    return v;
  };
}

/** 收窄用的字符串键：只认非空字符串，`null` / 数值一律抛（同 idcard 的 `prefixOf` 口径） */
function textOption(o, key) {
  const v = o[key];
  if (v === undefined) return '';
  if (typeof v !== 'string' || v.trim() === '') {
    throw new TypeError(`generateBankCards 的 options.${key} 应为非空字符串，收到 ${shapeOf(v)}`);
  }
  return v.trim().toUpperCase();
}

/**
 * 生成 Luhn 成立的测试卡号。**只从表内的 BIN 出**，所以每一条都能被 `parseBankCard`
 * 判成 `valid`；生成后立即自检，不成立就抛内部不变量。
 *
 * @param {{count?:number, bankCode?:string, cardType?:string, bin?:string, length?:number,
 *   rng?:() => number}} [options] 整个对象传 `null` / `undefined` 等于没传
 * @throws {TypeError} `bankCode` / `cardType` / `bin` 不是非空字符串、`length` 不是数值
 * @throws {RangeError} `count` 不在 1..50、`cardType` 不在四种里、`length` 不在 13..19、
 *   这些收窄条件在表里挑不出任何 BIN
 * @returns {{number:string,formatted:string,bin:string,bankCode:string,bankName:string,
 *   cardType:string,cardTypeName:string,panLength:number,caveat:string}[]} 号码列表
 */
export function generateBankCards(options = {}) {
  const o = options ?? {};
  const rng = checkedRng(o.rng);
  const count = o.count === undefined ? 1 : o.count;
  if (!Number.isInteger(count) || count < 1 || count > GENERATE_MAX) {
    throw new RangeError(`generateBankCards 的 options.count 应为 1..${GENERATE_MAX} 的整数，收到 ${shapeOf(o.count)}`);
  }
  const bankCode = textOption(o, 'bankCode');
  if (bankCode !== '' && !BANK_MAP.has(bankCode)) {
    throw new RangeError(
      `generateBankCards 的 options.bankCode（${bankCode}）不在表内 ${BANKS.length} 个行别码里`);
  }
  const cardType = textOption(o, 'cardType');
  if (cardType !== '' && !Object.prototype.hasOwnProperty.call(CARD_TYPES, cardType)) {
    throw new RangeError(
      `generateBankCards 的 options.cardType 只能是 ${Object.keys(CARD_TYPES).join(' / ')}，收到 ${shapeOf(o.cardType)}`);
  }
  const binPrefix = textOption(o, 'bin');
  if (binPrefix !== '' && !/^\d+$/.test(binPrefix)) {
    throw new RangeError(`generateBankCards 的 options.bin 只能含数字，收到「${binPrefix}」`);
  }
  let wantLength;
  if (o.length !== undefined && o.length !== null) {
    if (typeof o.length !== 'number' || !Number.isInteger(o.length)) {
      throw new TypeError(`generateBankCards 的 options.length 应为整数位数，收到 ${shapeOf(o.length)}`);
    }
    if (o.length < PAN_MIN || o.length > PAN_MAX) {
      throw new RangeError(
        `generateBankCards 的 options.length 应为 ${PAN_MIN}..${PAN_MAX}，收到 ${o.length}`);
    }
    wantLength = o.length;
  }

  const pool = ROWS.filter((r) => (bankCode === '' || r.bankCode === bankCode)
    && (cardType === '' || r.cardType === cardType)
    && (binPrefix === '' || r.bin.startsWith(binPrefix))
    && (wantLength === undefined || r.panLength === wantLength));
  if (pool.length === 0) {
    const given = Object.entries({
      bankCode: bankCode || null, cardType: cardType || null,
      bin: binPrefix || null, length: wantLength ?? null,
    }).filter(([, v]) => v !== null).map(([k, v]) => `${k}=${v}`).join(' ');
    throw new RangeError(`表内没有符合条件的 BIN${given ? `（${given}）` : ''}，换一个收窄条件`);
  }

  const list = [];
  for (let i = 0; i < count; i += 1) {
    const row = pool[Math.floor(rng() * pool.length)];
    // 只有能在本条卡号里补齐的子前缀才拦得住：比登记位数长的子前缀要连校验位一起撞，够不着。
    const kids = childrenOf(row.bin).filter((b) => b.length <= row.panLength);
    let number = '';
    let self = null;
    for (let attempt = 0; attempt < BODY_RETRY_MAX; attempt += 1) {
      let body = row.bin;
      while (body.length < row.panLength - 1) {
        let d = Math.floor(rng() * 10);
        // 这一位要是把某个更长的登记前缀补满（`body+d` 还是某个子前缀的前缀），就顺位往后挪。
        // 判据必须带"当前本体仍是子前缀的前缀"这一半：只看长度会把早已岔开的分支也算成挡路。
        // 实测最挤的分支是 `621260` 下 `62126010` 开头那 8 条，挡 8 个数字、留 2 个可走，
        // 十个全被占满的分支表里没有（0/11），所以这个挪位循环一定出得来。
        for (let shift = 0; shift < 10
          && kids.some((b) => b.startsWith(body + String(d))); shift += 1) {
          d = (d + 1) % 10;
        }
        body += String(d);
      }
      number = body + luhnCheckDigit(body);
      self = parseBankCard(number);
      if (self.state === 'valid' && self.info.bin === row.bin) break;
    }
    // 两条一起判：状态必须是 valid，而且读侧**最长前缀挑中的那个 BIN**必须就是本条用的前缀。
    // 上面那格避让把"本体里能补齐"的 9 条登记全挡住了，剩下的路径只有一条：某个子前缀的长度
    // **正好等于**登记位数，要连算出来的校验位一起撞。今天这种分支一条都没有（九条挨挡登记的
    // 子前缀最长只到 `位数-1`），所以这一格实测跑不到；留着是因为它判的是"生成的行别被读侧
    // 换成另一家"这件事，而避让那格是按表算的、这一格是按真实读侧算的，两边不是同一个条件。
    if (self.state !== 'valid' || self.info.bin !== row.bin) {
      const why = self.checks.filter((k) => k.ok === false).map((k) => `${k.label}：${k.detail}`).join(' / ');
      throw new Error(`内部不变量：${row.bin}（登记 ${row.panLength} 位）连试 ${BODY_RETRY_MAX} 次，`
        + `最后一条 ${number} 自检为 ${self.state}、读出行别前缀 ${self.info ? self.info.bin : '（无）'}`
        + `${why ? `（${why}）` : ''}`);
    }
    list.push({
      number, formatted: formatCardGroup(number), bin: row.bin,
      bankCode: row.bankCode, bankName: row.bankName,
      cardType: row.cardType, cardTypeName: row.cardTypeName,
      panLength: row.panLength, caveat: self.caveat,
    });
  }
  return list;
}

/** 每个行别码在 BIN 表里挂了几条（一遍数完，别按 260 个码各扫一遍 1,709 行） */
const BIN_COUNT_BY_BANK = new Map();
for (const r of ROWS) BIN_COUNT_BY_BANK.set(r.bankCode, (BIN_COUNT_BY_BANK.get(r.bankCode) ?? 0) + 1);

/** 面板"选行别"下拉的数据源：表内实际用到的行别码，**按行别码升序**（生成器已把 BANKS 排好，
 *  这里不再按中文名排序：`localeCompare(…,'zh')` 的折叠顺序依赖 ICU 数据，Node 与浏览器
 *  不保证一致，而下拉框 260 项的可达性由下面那组"主流"承担，不靠肉眼扫中文名）。 */
export const BANK_OPTIONS = BANKS
  .map(([code, name]) => ({ code, name, binCount: BIN_COUNT_BY_BANK.get(code) ?? 0 }));

/** 常用在前：表内 BIN 条数最多的 20 家，并列按行别码升序——纯数据驱动，无 locale 依赖 */
export const TOP_BANKS = [...BANK_OPTIONS]
  .sort((a, b) => b.binCount - a.binCount || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
  .slice(0, 20);
```

三处口径值得单独钉住，因为它们是"看着像 bug 其实是决定"：

1. **内部空白不算错**（`stripSeparators`）。身份证那侧把 `110101 19900307…` 判 malformed，
   因为 18 位数字之间本来不该有分隔；卡号的惯例写法就是 4 位一组，粘进来带空格与连字符是
   **正常输入**，判错等于逼用户先删空格。所以两模块这一格相反，不是分叉。
2. **"未收录"与"登记位数对不上"都是 `null`，不是 `false`**（§5.4 的"查不到不等于无效"）。
   `state` 因此有第五态 `unlisted`，而 `luhn` 排在它前面：算式不成立是硬结论，表外是软参考。
3. **主结论按位数挑，不按字典序挑**（`primary`）。12 个并列 BIN 里，`621260` 挂平安 16 位与
   常熟农商 19 位——19 位串必须报 CSRCB。生成侧因此不能只管"算得出校验位"：表里今天有 8 个 BIN
   挂着更长的子前缀（32 组嵌套对），9 条登记的号码会被自家更长的前缀**读成另一家**，所以生成侧
   在填本体时就绕开那些会被补满的位（`childrenOf` + 挪一位），外加"读回来的前缀必须就是本条的
   BIN"这条自检兜底。复核前的写法没有这层避让，`{ bin: '9558', length: 19 }` 实测 4.93% 直接抛
   「内部不变量」给用户看——那条判据本身没错，错的是把它当"不可能发生"。

- [ ] **Step 4: 跑绿**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^# (tests|pass|fail)'; echo "exit=${PIPESTATUS[0]}"
wc -l dev/js/tools/bankcard.js
```

Expected：`# tests 69`、`# pass 69`、`# fail 0`、`exit=0`（46 + 23，46 = §A–§D 的 41 条 + §E0/§F0 的 5 条），`wc -l` 实测 421 行。

- [ ] **Step 5: 自证这 23 条有牙（十九处变异，逐处记下红了谁）**

变异一律在 **/tmp 副本**上做：本仓随时可能有第二条会话在同一个 worktree 上 `git add`，
把 `dev/js/tools/bankcard.js` 就地改十几遍的风险不是"脏一下"，是可能被别人连脏的一起提交。

```bash
mkdir -p /tmp/t2mut
cat > /tmp/t2mut/mut.mjs <<'EOF'
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const REPO = '/Users/liaolongdong/code/liaolongdong.github.io';
const TREE = '/tmp/t2mut/tree';
const P = path.join(TREE, 'dev/js/tools/bankcard.js');
const CMD = `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test ${path.join(TREE, 'scripts/toolkit-tests.mjs')}`;
fs.rmSync(TREE, { recursive: true, force: true });
// 真复制，不用 `cp -al`：硬链接的"影子副本"改一处两处同时变，量出来的全是假证据
for (const d of ['dev/js', 'scripts', 'demo']) fs.cpSync(path.join(REPO, d), path.join(TREE, d), { recursive: true });
fs.copyFileSync(path.join(REPO, 'package.json'), path.join(TREE, 'package.json'));
const orig = fs.readFileSync(P, 'utf8');
/** 未变异先跑一次：拿它的 `# tests` 总数当尺子，好把"脚手架其实没跑到测试"和"这处不可达"分开 */
function run() {
  let out = '';
  try { out = execSync(`${CMD} 2>&1`, { encoding: 'utf8', cwd: TREE }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  return {
    out,
    total: Number((out.match(/^# tests (\d+)/m) || [])[1] ?? -1),
    pass: Number((out.match(/^# pass (\d+)/m) || [])[1] ?? -1),
    reds: [...out.matchAll(/^not ok \d+ - ([A-Z]\d+)/gm)].map((m) => m[1]),
  };
}
const base = run();
if (base.total < 0 || base.reds.length > 0) {
  console.log(base.out.split('\n').slice(-40).join('\n'));
  throw new Error(`基线就不对（# tests ${base.total}、红 ${base.reds.length} 条），先让全量跑绿再谈牙齿`);
}
console.log(`基线 # tests ${base.total} 全绿（副本 ${TREE}）`);
const MUTS = [
  { name: 'M1 翻倍方向反过来', edits: [['const double = (s.length - i) % 2 === 1;', 'const double = (s.length - i) % 2 === 0;']] },
  { name: 'M2 前缀允许吃掉整串', edits: [['const tryableLengths = (len) => BIN_LENGTHS.filter((n) => n < len);', 'const tryableLengths = (len) => BIN_LENGTHS.filter((n) => n <= len);']] },
  { name: 'M3 主结论退回字典序第一条', edits: [['const primary = rows.find((m) => m.panLength === digits.length) ?? rows[0] ?? null;', 'const primary = rows[0] ?? null;']] },
  { name: 'M4 表外也报 valid', edits: [["out.state = primary === null ? 'unlisted' : 'valid';", "out.state = 'valid';"]] },
  { name: 'M5 表外判成 false', edits: [["push('bin', '行别前缀', primary === null ? null", "push('bin', '行别前缀', primary === null ? false"]] },
  { name: 'M6 位数下限放宽到 12', edits: [['export const PAN_MIN = 13;', 'export const PAN_MIN = 12;']] },
  { name: 'M7 生成侧自检整个摘掉', edits: [["if (self.state !== 'valid' || self.info.bin !== row.bin) {", 'if (false) {']] },
  { name: 'M7b 自检只丢后半截', edits: [["if (self.state !== 'valid' || self.info.bin !== row.bin) {", "if (self.state !== 'valid') {"]] },
  { name: 'M8 摘掉避让的挡路判据', edits: [['&& kids.some((b) => b.startsWith(body + String(d))); shift += 1) {', '&& false; shift += 1) {']] },
  { name: 'M8b 避让放松成只看长度与末位', edits: [['&& kids.some((b) => b.startsWith(body + String(d))); shift += 1) {',
    '&& kids.some((b) => b.length === body.length + 1 && b[body.length] === String(d)); shift += 1) {']] },
  { name: 'M9 摘掉重试（单次取号 + 自检照抛）', edits: [['for (let attempt = 0; attempt < BODY_RETRY_MAX; attempt += 1) {', 'for (let attempt = 0; attempt < 1; attempt += 1) {']] },
  { name: 'M10 重试的接受条件只看状态', edits: [["if (self.state === 'valid' && self.info.bin === row.bin) break;", "if (self.state === 'valid') break;"]] },
  { name: 'M11 子前缀索引整个不建', edits: [['const childrenOf = (bin) => CHILD_BY_PREFIX.get(bin) ?? [];', 'const childrenOf = () => [];']] },
  { name: 'M12 退回复核前的写法（避让与重试一起摘）', edits: [
    ['    const kids = childrenOf(row.bin).filter((b) => b.length <= row.panLength);\n', ''],
    ['    for (let attempt = 0; attempt < BODY_RETRY_MAX; attempt += 1) {', '    {'],
    ['        for (let shift = 0; shift < 10\n          && kids.some((b) => b.startsWith(body + String(d))); shift += 1) {\n          d = (d + 1) % 10;\n        }\n', ''],
  ] },
  { name: 'M13 只冻并列数组不冻行对象', edits: [['  for (const row of group) Object.freeze(row);\n', '']] },
  { name: 'M14 只冻行对象不冻并列数组', edits: [['  Object.freeze(group);\n', '']] },
  { name: 'M15 三处冻结一起不冻', edits: [['for (const group of BY_BIN.values()) {', 'for (const group of BY_BIN.values()) if (false) {'], ['Object.freeze(ROWS);\n', '']] },
  { name: 'M16 索引退回宽法（给全部真前缀建键）', edits: [['    if (!BY_BIN.has(p)) continue;\n', '']] },
  { name: 'M17 matches 直接交出共享行', edits: [['  out.matches = rows.map((m) => ({ ...m, lengthMatches: m.panLength === digits.length }));',
    '  out.matches = rows;']] },
];
for (const { name, edits } of MUTS) {
  let text = orig;
  let bad = '';
  for (const [a, b] of edits) {
    const hits = text.split(a).length - 1;
    if (hits !== 1) { bad = `锚点命中 ${hits} 处`; break; }
    text = text.replace(a, b);
  }
  if (bad) { console.log(`!! ${name} ${bad}（要恰好 1 处），这一档不算证据`); continue; }
  if (text === orig) { console.log(`!! ${name} 替换后一字未变，脚手架在骗人`); continue; }
  fs.writeFileSync(P, text);
  if (fs.readFileSync(P, 'utf8') !== text) { console.log(`!! ${name} 写完读回来不一样，文件系统在骗人`); continue; }
  const r = run();
  if (r.total !== base.total) {
    console.log(`!! ${name} 只跑到 ${r.total} 条（基线 ${base.total}），这一档不算证据`);
    continue;
  }
  console.log(`${name} → ${r.reds.length ? [...new Set(r.reds)].join(' ') : '全绿'}（pass ${r.pass}/${r.total}）`);
}
fs.writeFileSync(P, orig);
const after = run();
console.log(`还原后：# tests ${after.total}、pass ${after.pass}、红 ${after.reds.length ? after.reds.join(' ') : '无'}`);
console.log(`副本与工作树逐字节一致=${fs.readFileSync(P, 'utf8') === fs.readFileSync(path.join(REPO, 'dev/js/tools/bankcard.js'), 'utf8')}`);
EOF
node /tmp/t2mut/mut.mjs
git status --porcelain -- dev/js/tools/bankcard.js scripts/toolkit-tests.mjs   # 仍是 Step 4 那两行 M，没有被实验改动
```

**这一档的脚手架在段 1 栽过两次，所以三处闸门都得留下**：命令必须指向副本里真实存在的
`scripts/toolkit-tests.mjs`（早先草稿写的是镜像文件名 `e-tests.mjs`，跑起来退非零、`out` 只剩一句
"找不到文件"，变异于是齐刷刷报"全绿"——那是脚手架坏了，不是判据没牙）；`run()` 里那个 `# tests`
总数与基线比对，两边对不上就报 `!!`，不许读成结论；每处变异落盘后要读回来比对，`sed`/`replace`
退 0 而文件一字未变是第三次栽过的坑。最后一行 `git status` 是对"实验有没有溢出到工作树"的自证。

红名单（2026-09-27 在副本上实测，基线 `# tests 69` 全绿；十九刀跑完还原后再跑一次仍是 69/69，
`副本与工作树逐字节一致=true`）：

| 变异 | 红了谁 | 说明 |
| --- | --- | --- |
| M1 翻倍方向反过来 | E1 E2 E4 E5 E8 E11 E13 E20 | 八条一起红，Luhn 是全模块的地基 |
| M2 前缀允许吃掉整串 | **只 E9 红** | 最尖的一档：口径抽成 `tryableLengths` 之后，锚点从 `if (n >= digits.length)` 变成那一行的 `n < len` → `n <= len`，牙齿没变 |
| M3 主结论退回字典序第一条 | E10 **E21** | 并列登记那条口径由 E10 独占；E21 现在也咬——读回来的前缀换了人 |
| M4 表外也报 valid | E4 E6 E20 | `unlisted` 三处消费点全红 |
| M5 表外判成 false | **只 E12 红** | 三态里 `null` 与 `false` 的分界 |
| M6 位数下限放宽到 12 | E5 E6 E17 | 边界两侧各咬一口 |
| M7 生成侧自检整个摘掉 | **全绿** | 见下 |
| M7b 自检只丢 `self.info.bin` 那一半 | **全绿** | 同 M7 |
| M8 摘掉避让的挡路判据 | **E21 E22** | 上一版是"只 E22 红"。E21 现在把 32 个池子档各配一串**敌意 rng**（本体数字按子前缀的尾巴轮转，专挑会撞的那条路走），避让一摘就撞上：`622498` 那一档连试 24 次全被自家 `62249802` 盖住，抛"内部不变量：…最后一条 6224980202020202020 自检为 valid、读出行别前缀 62249802" |
| M8b 避让放松成只看长度与末位 | **只 E21 红** | 红在同一处抛：`621260` 那条 19 位档，子前缀是 `621260001`（比本体起点长三位），放松后的判据只看"下一位是否正好补齐"，于是三位一路放行——"内部不变量：…6212600010010010013 …读出行别前缀 621260001"；E22 不红（它那两档的挡路判据仍生效） |
| M9 摘掉重试（只取一次号） | **全绿** | 避让已足够，重试今天是保险 |
| M10 重试的接受条件只看状态 | **全绿** | 同 M9：有避让在前，状态 valid 时前缀必然相符 |
| M11 子前缀索引整个不建 | **E21 E22** | 索引与判据是同一条链：`childrenOf` 恒空等于把避让的输入抽掉，红在同两格 |
| M12 避让与重试一起摘（= 复核前的写法） | E15 E16 E17 E21 E22 **E23** | 六条一起红，这就是这次复核发现的那个真实缺陷；E23 也红是因为它最后一行要用 `9558` 真生成一张卡 |
| M13 只冻并列数组不冻行对象 | **只 E23 红** | E23 那两条 `assert.throws(..., TypeError)` 里的"改 `info.primary`"半截不抛了 |
| M14 只冻行对象不冻并列数组 | **只 E23 红** | 另半截：`hit.rows.push()` 不抛，渗到下一次查询 |
| M15 三处冻结一起不冻 | **只 E23 红** | 整段冻结摘掉，两条注入都不抛——这一格由 E23 独占，正是要它独占 |
| M16 索引退回宽法（给全部真前缀建键） | **全绿** | 见下"这一格该全绿" |
| M17 `matches` 直接交出共享行 | E10 **E23** | E10 少 `lengthMatches` 字段（`[false, true]` 变 `[undefined, undefined]`）；E23 反过来红在"不许抛"那半截——交出的是冻结行，改自己的副本都抛 |

**M7/M7b/M9/M10 四格全绿的解释，别再照旧话抄**：旧话是"构造与读取同套 Luhn、同一张表，所以
不可能自己算出一个不通的末位，而嵌套前缀今天不存在"——前半句仍然成立（Luhn 那一半确实造不出
触发条件），后半句是错的（表里今天有 32 组嵌套前缀），错到让 `{ bin: '9558' }` 真的抛了 4.93%。
现在的因果链是**避让（M8/M11 → E21 E22 红）先把"读回来换了人"这条路堵死，自检（M7）才有资格
全绿**：M12 把两层一起摘就红六条，说明这两格不是重复而是叠起来的。剩下那格"重试"（M9/M10 全绿）
同样是保险：等长的子前缀今天一条都没有（§E0 的 E0-4 钉着这个形状，一旦上游长出这种条目，E0-4
会先红，并直接把话指到生成侧自检那格）。

**M8b 上一版记成"全绿"是判错的**：当时以为放松避让只是"某些分支多挪几位"，属于分布口味，
不该有判据为它红。E21 补上敌意 rng 之后它红了——红得对：放松后的判据只看"这一位是否补齐某条
子前缀"，不再检查"当前本体是否还在那条支上"，于是有些档位会**沿着子前缀走下去**，产出的号读回来
前缀换了人。这不是均匀性问题，是**声明与读回不一致**，正落在 E21 的口径上。留个对照：**M16
（索引退回宽法）该全绿**——844 个多出来的键没人查，读回结果逐条相同，所以没有任何一条判据
*应该*为它红；这一格全绿是"收窄是行为等价的"这条断言的证据，不是漏判。**判据盯的是自洽与等价，
不是均匀，也不是省内存。**

脚本第一行 `!! 锚点没命中` 是这套自证的闸门：**锚点失配一律先修脚本再谈牙齿**。

- [ ] **Step 6: 记一次耗时（Task 10 的性能口径要用）**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
for m in "./dev/js/tools/bank-bin-data.js" "./dev/js/tools/bankcard.js"; do node --input-type=module -e "
const t0 = performance.now(); await import('$m');
console.log('$m', (performance.now() - t0).toFixed(1) + 'ms');"; done
```

Expected（2026-09-27 在同一台机器上把上面那条命令连跑两组，各 5 次，冷进程：`bank-bin-data.js`
为 3.7 / 3.9 / 4.2 / 4.2 / 6.2ms，`bankcard.js` 为 11.7 / 13.4 / 13.6 / 14.2 / 14.9ms；
另一组把两个模块串在同一进程里量，`bankcard.js` 净增 9.7–12.7ms）：`bank-bin-data.js`
**几毫秒**（大头是那条 28,266 字符的 `BIN_ROWS` 巨串本身），`bankcard.js` **十几毫秒**
（含把 1,709 行拆成对象、按 BIN 分桶、冻结三张派生表、再建 `CHILD_BY_PREFIX` 前缀索引）。
建索引那一步在 import 这一档**量不出可见增量**：窄法单独量 1.28–1.53ms（8 个键 / 32 次插入），
宽法 1.80–1.98ms（852 键 / 8,653 次插入），都摊不进 import 这几毫秒的抖动——**所以索引这一格
省的是那 844 个没人查的键，不是时间**；但**别退回 O(n²) 的 `startsWith` 现算**，那条路冷进程
单独量 62.6–75.9ms（同进程重复跑到第五遍仍要 51.9–60.0ms），是整个 import 的五倍。**上午那两组
（5.6–9.9ms / 21.5–26.2ms）与下午这组差到 2 倍是正常的**：同一台机器、同一个命令、冷/热页缓存
不同而已，所以这一格记的是**量级**不是基线——Task 10 判的是"有没有冒出百毫秒级或秒级"，
别拿这几个数当阈值。
这是**首屏一次性**成本：页面入口 `import` 它，就付这一次。查表本身很快（200 次 `parseBankCard`
首轮 10.6ms、预热后 1.9–3.0ms，偶发跳回 10ms 一档；`generateBankCards` 的 `count` 上限是 50，
要凑 200 条得生成四次）。Task 10 若量到 `toolIdcard.min.js` 的 parse+run 明显超出这个量级，
先查是不是共享 chunk 把两份数据都塞进来了，再考虑把建表挪到首次用到时（那要连带
`BANK_OPTIONS` 的下拉填充一起改，属于计划外改动，先报再做）。

- [ ] **Step 7: 提交**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
git status --porcelain
git add dev/js/tools/bankcard.js scripts/toolkit-tests.mjs
git commit -m "$(cat <<'EOF'
feat(tools): 银行卡模块——Luhn 逐位算式、最长前缀查表与生成侧

未收录前缀与登记位数不一致一律记 null（第五态 unlisted），只有 Luhn 与
位数那种硬结论才拖垮整体；并列登记按实测位数挑主结论，12 个 BIN 的展示
口径由 E10 独占。行别照第三方快照给，caveat 每条结果自带，不写卡组织。
EOF
)"
git status --porcelain | head
```

Expected：**这条落地提交的真实路径数是四条，不是这里写的两条**（`46b0042`：`bankcard.js`、
`toolkit-tests.mjs`、`verify-plan-blocks.mjs` 的 `FILE_TARGETS` 一行、`verify-plan-blocks-teeth.mjs`
的副本清单一行）。后两条是落地时才暴露的连带项：整文件镜像不登记进 `FILE_TARGETS`，门禁二的
反查那一档直接退 1；而 `verify-plan-blocks-teeth.mjs` 当时还手抄了一份镜像清单，少抄一项会让副本
树里"磁盘上没有这个文件"、整轮自证退 1（这一处到 Task 3 才根治，见下一格）。
`git status` 剩下仍是对方那批未提交项。**不要**碰
`dev/js/tools/region*.js`、`idcard.js`、`uscc.js`、`panel.js`（红线 1 与 4）。

## Task 3: `phone.js` — 手机号格式、三位号段判运营商、生成侧

**Files:**
- Create: `dev/js/tools/phone.js`
- Modify: `scripts/toolkit-tests.mjs`（追加 §F，15 条）

这一格的**口径比代码长**，四处都得先立住再写：

1. **设计文档 §5.1 写的是"3–7 位前缀表"，本站只做三位，并且不做归属地。** 理由在 §0.4 的取数
   记录里：能干净拿到许可的来源（impulse 的 `OPERATORS`，Apache-2.0）只给到三位号段，而七位段
   才谈得上归属地；工信部编号计划原文取不到，剩下几份可交叉核对的归属地仓库**全部没有
   license**（等于保留所有权利）。所以这不是"先不做"，是**这一层判不到**——面板必须把
   `CARRIER_NOTE` 那句原样显示，Task 11 收口时把这条偏差回写进 spec §5.1。实现里不许偷偷
   找一个无许可的源把归属地补上（红线 3）。
2. **书写变体一律归一**（与银行卡同族、与身份证相反）：分组空格、全角空格、连字符、括号、
   `+86` / `0086` / 裸 `86` 都吃掉，且逐项表第一行要**点名吃了什么**（`normalized` 字段）。
   裸 `86` 那一档有牙：只有"整串 13 位且 `86` 后接 `1[3-9]`"才剥，否则 `86038001380` 这种
   十一位串会被剪成合法号。`+8623800138000` 里 `+86` 后头不是 `1[3-9]`，就**不剥**，于是
   `+` 留在数字里被字符行点名——不替用户猜他想输入什么。
3. **`malformed` 分两级**，照 `parseIdCard` 那条契约：字符 / 位数那一关就出局的只给前两行、
   `info` 为 `null`（那时连十一位结构都没有，号段无从谈起）；位数过了但开头不是 `1[3-9]`
   （`12800138000`）的，四行照给、`info` 照给，只把 `carrier` 收空。第三行给 `false`、第四行给
   `null` + "号段不成立，不判运营商"。
4. **判据只断自洽**：§F0 已把数据钉成"5 家 / 56 段 / 不重叠 / 形状合法"，§F 因此一律从
   `CARRIER_SEGMENTS` 派生（辅助块那个 `LISTED`），**不写死任何号段字符串**，也**不引
   `phone.js` 自己导出的 `SEGMENTS`**——否则"读侧数出来的段"和"表里的段"是同一个东西，
   什么也证不了。唯一写死的三段是 F1/F11 里的示例（`138` / `190` / `140`），它们只负责让返回
   形状一眼可读。这一格不断外部正确性，这是单一来源下唯一说得出口的判法。

- [ ] **Step 1: 先写 §F 的 15 条判据（此时 `phone.js` 还不存在，必红）**

追加到 `scripts/toolkit-tests.mjs` 末尾（§E 之后）。`CARRIER_SEGMENTS` **不在这里解构**：它已经
由 Task 1 的 §F0 那节声明过了，同一个模块里同名 `const` 声明两次是 SyntaxError；`CARRIER_META`
是这一节新引的。`GENERATE_MAX` 必须别名成 `MOBILE_GENERATE_MAX`（§B 占的是身份证那个）。

```js
// ── §F 手机号 ──────────────────────────────────────────────────────────────
//（CARRIER_SEGMENTS 由 Task 1 的 §F0 那行声明，这里只补 CARRIER_META——同一个模块里同名
//  const 声明两次是 SyntaxError，而 §F 的 LISTED 与 F1/F8 都靠那一份表作证。）
const { CARRIER_META } = await import('../dev/js/tools/carrier-data.js');
const { CARRIERS, CARRIER_NOTE, CARRIER_SOURCE, GENERATE_MAX: MOBILE_GENERATE_MAX,
  MOBILE_CAVEAT, MOBILE_LENGTH, MOBILE_RE, formatMobile, generateMobiles,
  lookupCarrier, parseMobile } = await import('../dev/js/tools/phone.js');

// §F0 已把号段表钉成"5 家 / 56 段 / 不重叠 / 形状合法"，§F 因此只断 phone.js 这一层的
// 行为与派生：不重复判数据，也不断任何外部正确性（单一来源，见 CARRIER_NOTE 与计划 §0.4）。
const mck = (r) => Object.fromEntries(r.checks.map((c) => [c.key, c.ok]));
const mrow = (r, key) => r.checks.find((c) => c.key === key);
/** 三位段 + 补零到十一位（尾数随便填，§F 只关心前缀那一档） */
const pad11 = (s) => (s + '0000000000').slice(0, 11);
/** `1[3-9]\d` 的全部 70 个三位组合——表内 56 段与表外补集都由它派生，不写死号段 */
/** 表内号段清单：唯一权威是 §F0 那张 CARRIER_SEGMENTS，这里从它派生，
 *  不引 phone.js 的同名派生值——判据要能看出"读侧自己数出来的段"和"表里的段"不一致。 */
const LISTED = [];
for (const [, segsText] of CARRIER_SEGMENTS) LISTED.push(...segsText.split(' '));
const ALL70 = [];
for (let a = 3; a <= 9; a += 1) for (let b = 0; b <= 9; b += 1) ALL70.push(`1${a}${b}`);

test('F1 合法手机号判 valid，运营商按表内口径给出', () => {
  const r = parseMobile('13800138000');
  assert.equal(r.state, 'valid');
  assert.equal(r.carrier, '中国移动');
  assert.equal(r.segment, '138');
  assert.deepEqual(Object.values(mck(r)), [true, true, true, true]);
  assert.equal(r.checks.length, 4);
  assert.equal(r.info.formatted, '138 0013 8000');
  assert.equal(r.hasCaveat, true);
  // 每家都取一条：五家在表里各挂 ≥1 段，取各自第一个号段
  for (const [carrier, segsText] of CARRIER_SEGMENTS) {
    const first = segsText.split(' ')[0];
    const one = parseMobile(pad11(first));
    assert.equal(one.state, 'valid', `${carrier} 的 ${first}`);
    assert.equal(one.carrier, carrier, `${carrier} 的 ${first} 读成了 ${one.carrier}`);
  }
});

test('F2 书写变体归一到同一结论，并在逐项表点名', () => {
  const forms = ['138 0013 8000', '138-0013-8000', '138　0013　8000',
    '(138)0013 8000', '+86 13800138000', '008613800138000', '8613800138000',
    '  13800138000  ', '138-0013-8000'.replace(/-/g, '\u00A0')];
  for (const form of forms) {
    const r = parseMobile(form);
    assert.equal(r.digits, '13800138000', form);
    assert.equal(r.state, 'valid', form);
    assert.equal(r.value, form.trim(), 'value 必须是 trim 后的原样回显');
  }
  assert.equal(parseMobile('+86 13800138000').normalized, '去掉了国际前缀 +86');
  assert.match(mrow(parseMobile('+86 13800138000'), 'charset').detail, /去掉了国际前缀 \+86/);
  assert.equal(parseMobile('13800138000').normalized, '', '没剥东西就不许凭空点名');
});

test('F3 国际前缀只在该剥的时候剥', () => {
  // `+86` 后头不是 `1[3-9]`：不剥，于是 `+` 留在数字里被字符行点名——不猜用户想输入什么
  const odd = parseMobile('+8623800138000');
  assert.equal(odd.digits, '+8623800138000');
  assert.equal(odd.state, 'malformed');
  assert.equal(mck(odd).charset, false);
  assert.match(mrow(odd, 'charset').detail, /含非数字字符「\+」/);
  // 裸 `86` 只在"整串 13 位"时才当国家码；14 位那种一律不剥，免得把真号剪成合法号
  assert.equal(parseMobile('86138001380000').state, 'malformed');
  assert.equal(parseMobile('86138001380000').normalized, '');
  assert.equal(parseMobile('86038001380').normalized, '');
  assert.equal(parseMobile('86038001380').state, 'malformed');
});

test('F4 位数不合规只给前两行、info 为 null', () => {
  for (const short of ['1380013800', '1', '', '138 0013 800']) {
    const r = parseMobile(short);
    if (short === '') continue;
    assert.equal(r.state, 'malformed', short);
    assert.equal(r.checks.length, 2, short);
    assert.equal(r.info, null, short);
    assert.equal(r.checks[1].ok, false, short);
    assert.match(r.checks[1].detail, /应为 11 位/, short);
  }
  const long = parseMobile('138001380000');
  assert.equal(long.state, 'malformed');
  assert.equal(long.checks.length, 2);
  assert.equal(long.info, null);
  assert.equal(MOBILE_LENGTH, 11);
});

test('F5 含非数字字符时点名第几位', () => {
  const r = parseMobile('13800138o00');
  assert.equal(r.state, 'malformed');
  assert.equal(mck(r).charset, false);
  assert.match(mrow(r, 'charset').detail, /第 9 位/);
  assert.equal(r.checks.length, 2);
  assert.equal(r.info, null);
});

test('F6 开头不是 1[3-9]：malformed，但四行照给、运营商收空', () => {
  const r = parseMobile('12800138000');
  assert.equal(r.state, 'malformed');
  assert.equal(r.checks.length, 4, '位数过了就是解出了十一位结构，四行都要在');
  assert.equal(mck(r).segment, false);
  assert.equal(mck(r).carrier, null, '在假号段旁边挂一个"未收录"等于凭空造结论');
  assert.equal(r.carrier, '');
  assert.equal(r.segment, '128');
  assert.ok(r.info !== null);
  assert.equal(r.info.carrier, '');
  assert.equal(r.hasCaveat, true);
  assert.match(mrow(r, 'segment').detail, /不是移动号段开头/);
  assert.equal(mrow(r, 'carrier').detail, '号段不成立，不判运营商');
});

test('F7 号段合法但表里没这一格 → unlisted，不据此判无效', () => {
  const inTable = new Set(LISTED);
  const missing = ALL70.filter((s) => !inTable.has(s));
  assert.equal(missing.length, ALL70.length - inTable.size, '表内段与补集必须互补');
  assert.ok(missing.length > 0, '号段表若一次覆盖 70 档，这一格就该改成"无未收录样本"');
  for (const s of missing) {
    const r = parseMobile(pad11(s));
    assert.equal(r.state, 'unlisted', s);
    assert.equal(mck(r).segment, true, s);
    assert.equal(mck(r).carrier, null, s);
    assert.match(mrow(r, 'carrier').detail, /不据此判无效/, s);
    assert.equal(r.carrier, '', s);
    assert.equal(r.checks.filter((c) => c.ok === false).length, 0, `${s} 不许出现硬红`);
  }
});
test('F8 表内 56 段逐段覆盖：都能判 valid 且运营商与表一致', () => {
  const listed = LISTED;
  assert.equal(listed.length, CARRIERS.reduce((n, c) => n + c.count, 0));
  for (const s of listed) {
    const r = parseMobile(pad11(s));
    assert.equal(r.state, 'valid', s);
    assert.equal(r.segment, s);
    const owner = CARRIER_SEGMENTS.find(([, t]) => t.split(' ').includes(s))[0];
    assert.equal(r.carrier, owner, s);
  }
  assert.equal(CARRIERS.length, 5);
});

test('F9 MOBILE_RE 与 parseMobile 的硬结论同口径', () => {
  for (const s of ALL70) {
    assert.equal(MOBILE_RE.test(pad11(s)), parseMobile(pad11(s)).state !== 'malformed', s,
      '正则说合法而 parseMobile 判 malformed（或反之）就是两套格式口径');
  }
  assert.equal(MOBILE_RE.test('1380013800'), false, '少一位');
  assert.equal(MOBILE_RE.test('12800138000'), false, '开头 12');
  assert.equal(MOBILE_RE.test('13800138000X'), false);
  assert.equal(parseMobile(13800138000).state, 'valid', '11 位在 2^53 内，数值入参不掉末位');
  assert.equal(parseMobile(13800138000).digits, '13800138000');
});

test('F10 formatMobile 只认十一位纯数字', () => {
  assert.equal(formatMobile('13800138000'), '138 0013 8000');
  assert.equal(formatMobile('1380013800'), '1380013800', '形状不对就原样返回，不猜');
  assert.equal(formatMobile('1380013800a'), '1380013800a');
  assert.equal(formatMobile(null), '');
  assert.equal(formatMobile(13800138000), '', '数值不进格式化：String() 的口径归 parseMobile，这里不各做一遍');
});

test('F11 lookupCarrier 的形状闸门与返回形状', () => {
  assert.deepEqual(lookupCarrier('13800138000'), { segment: '138', carrier: '中国移动' });
  assert.deepEqual(lookupCarrier('19000138000'), { segment: '190', carrier: '中国电信' });
  assert.deepEqual(lookupCarrier('14000138000'), { segment: '140', carrier: null });
  assert.deepEqual(lookupCarrier('13'), { segment: '13', carrier: null }, '不足三位也有 segment，供面板说"坏在哪一段"');
  assert.equal(lookupCarrier('1380013800a'), null, '含非数字一律 null');
  assert.equal(lookupCarrier(null), null);
  assert.equal(lookupCarrier(13800138000), null, '不替调用方做 String()');
});

test('F12 生成侧自洽：50 条全判 valid 且号段就是表内段', () => {
  const list = generateMobiles({ count: MOBILE_GENERATE_MAX });
  assert.equal(list.length, MOBILE_GENERATE_MAX);
  assert.equal(MOBILE_GENERATE_MAX, 50);
  for (const item of list) {
    const back = parseMobile(item.number);
    assert.equal(back.state, 'valid', item.number);
    assert.equal(back.segment, item.segment);
    assert.equal(back.carrier, item.carrier);
    assert.equal(item.formatted, formatMobile(item.number));
    assert.ok(LISTED.includes(item.segment), `${item.segment} 不在表内`);
    assert.equal(item.note, CARRIER_NOTE);
    assert.equal(item.caveat, MOBILE_CAVEAT);
  }
  const seeded = () => {
    const s = generateMobiles({ count: 5, rng: () => 0.42 });
    return s.map((x) => x.number).join(',');
  };
  assert.equal(seeded(), seeded(), '同一个 rng 必须给同一批号');
  assert.equal(generateMobiles().length, 1, '不传参就是 1 条');
});

test('F13 生成侧收窄：carrier 与 segment，两者冲突时报归属', () => {
  const telecom = generateMobiles({ count: 20, carrier: '中国电信' });
  assert.equal(telecom.length, 20);
  for (const item of telecom) assert.equal(item.carrier, '中国电信', item.number);
  const guangdian = generateMobiles({ count: 4, segment: '192' });
  for (const item of guangdian) {
    assert.equal(item.segment, '192');
    assert.equal(item.carrier, '中国广电');
  }
  assert.throws(() => generateMobiles({ carrier: '中国移动', segment: '192' }),
    (e) => e instanceof RangeError && /号段 192 不属于 中国移动（表内它归 中国广电）/.test(e.message));
});

test('F14 生成侧入参闸门', () => {
  const bad = (options, Kind, re) => assert.throws(() => generateMobiles(options),
    (e) => e instanceof Kind && re.test(e.message), JSON.stringify(options));
  bad({ count: 0 }, RangeError, /count 应为 1\.\.50/);
  bad({ count: MOBILE_GENERATE_MAX + 1 }, RangeError, /count 应为 1\.\.50/);
  bad({ count: 2.5 }, RangeError, /count/);
  bad({ count: '5' }, RangeError, /count 应为 1\.\.50 的整数，收到 string 5/);
  bad({ carrier: '中国移动通讯' }, RangeError, /carrier（中国移动通讯）不在表内 5 家/);
  bad({ carrier: 123 }, TypeError, /carrier 应为非空字符串，收到 number 123/);
  bad({ carrier: '  ' }, TypeError, /carrier 应为非空字符串/);
  bad({ segment: '128' }, RangeError, /segment（128）不在表内 56 个号段里/);
  bad({ segment: '13' }, TypeError, /segment 应为匹配 \/\^\\d\{3\}\$/);
  bad({ segment: 'abc' }, TypeError, /segment/);
  bad({ rng: 1 }, TypeError, /rng 应为 \(\) => number，收到 number 1/);
  bad({ rng: () => 1 }, TypeError, /rng 每次应给出 \[0, 1\) 内的有限数，收到 number 1/);
  bad({ rng: () => Number.NaN }, TypeError, /收到 number NaN/);
  assert.equal(generateMobiles({ carrier: null, segment: undefined }).length, 1,
    'null / undefined 等于没给收窄条件，不抛');
});

test('F15 文案边界：单一来源、三位号段、不做归属地三句都在', () => {
  assert.match(CARRIER_SOURCE, new RegExp(CARRIER_META.provider.replace('/', '\\/')));
  assert.match(CARRIER_SOURCE, new RegExp(CARRIER_META.ref.slice(0, 7)));
  assert.match(CARRIER_SOURCE, new RegExp(CARRIER_META.fetchedAt));
  assert.match(MOBILE_CAVEAT, /格式判定.*硬结论/);
  assert.match(MOBILE_CAVEAT, /运营商按三位号段判定/);
  assert.match(CARRIER_NOTE, /单一来源/);
  assert.match(CARRIER_NOTE, /携号转网/);
  assert.match(CARRIER_NOTE, /不做号码归属地/);
  assert.match(CARRIER_NOTE, /三位号段/);
  assert.ok(CARRIER_NOTE.includes(CARRIER_SOURCE), '面板里那句必须带上来源与快照日期');
  for (const r of [parseMobile('13800138000'), parseMobile('14000138000'),
    parseMobile('12800138000'), parseMobile('1380013800')]) {
    assert.equal(r.note, CARRIER_NOTE);
    assert.equal(r.caveat, MOBILE_CAVEAT);
  }
  assert.equal(parseMobile('13800138000').hasCaveat, true);
  assert.equal(parseMobile('1380013800').hasCaveat, false, '位数没过就没有"参考"可提示');
  assert.equal(parseMobile('').state, 'empty');
  assert.deepEqual(parseMobile('').checks, []);
  assert.equal(parseMobile(null).state, 'empty');
  assert.equal(parseMobile(undefined).state, 'empty');
});
```

- [ ] **Step 2: 跑红，确认红的形状**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^not ok|Cannot find module|^# (tests|pass|fail)'; echo "exit=${PIPESTATUS[0]}"
```

Expected：`not ok 1 - scripts/toolkit-tests.mjs` 加一句
`ERR_MODULE_NOT_FOUND: Cannot find module '…/dev/js/tools/phone.js'`，`# tests 70`、`# pass 69`（Task 1、2 那批
照绿）、`# fail 1`、`exit=` 非 0。

- [ ] **Step 3: 写 `dev/js/tools/phone.js`**

```js
/**
 * 手机号：格式判定 + 三位号段判运营商 + 生成侧。
 *
 * 数据来自 `carrier-data.js`（第三方快照 `LSG-PolarBear/impulse` 的 `OPERATORS`，
 * 见该文件头与 `assets/data/LICENSES.md`）。**这一格的诚实边界必须写清楚**：
 *
 * - 设计文档 §5.1 原本写的是"3–7 位前缀表"，实际只做到**三位**一档。原因记在计划的 §0.4：
 *   工信部编号计划原文取不到，可交叉核对的归属地仓库全部无 license（等于保留所有权利），
 *   唯一能干净拿到许可的源只给到三位号段。七位段才能谈归属地，所以**本站不做归属地**，
 *   {@link CARRIER_NOTE} 里那一句就是面板要原样显示的解释。
 * - 号段是**发号**口径：携号转网之后不代表用户当前实际运营商。
 * - 因此 §F 只断自洽（56 段互不重叠、形状合法、生成侧与校验侧同结论），
 *   **不断外部正确性**——这不是判据偷懒，是这一格唯一说得出口的判法。
 *
 * 与 `idcard.js` / `bankcard.js` 同一套约定：纯函数、不碰 DOM、入参形状不对就抛。
 */
import { seededRandom } from './random.js';
import { CARRIER_META, CARRIER_SEGMENTS } from './carrier-data.js';

/**
 * 手机号格式：十一位、`1[3-9]` 开头。这一档是**硬结论**（格式），与号段那张软参考表无关。
 * 导出是为了让生成侧的自检与 §F 的判据都能对着同一个口径判，而不是各写各的正则。
 */
export const MOBILE_RE = /^1[3-9]\d{9}$/;
export const MOBILE_LENGTH = 11;
/** 单次生成的条数上限，与 `generateIdCards` / `generateBankCards` 同一档 */
export const GENERATE_MAX = 50;
export const CARRIER_SOURCE = `${CARRIER_META.provider} @ ${CARRIER_META.ref.slice(0, 7)}（快照 ${CARRIER_META.fetchedAt}）`;
export const MOBILE_CAVEAT =
  '格式判定（11 位、1[3-9] 开头）是硬结论；运营商按三位号段判定，是发号口径的参考。';
export const CARRIER_NOTE =
  `运营商来自第三方整理的三位号段表（${CARRIER_SOURCE}），单一来源、不承诺全量；`
  + '携号转网后不代表当前实际运营商。本站不做号码归属地：三位号段这一层判不到城市，'
  + '而能干净取到许可的来源只有这一层。';

/** 号段 → 运营商；`segment` 三位一组 */
const BY_SEGMENT = new Map();
for (const [carrier, segsText] of CARRIER_SEGMENTS) {
  for (const seg of segsText.split(' ')) BY_SEGMENT.set(seg, carrier);
}
/** 运营商 → 号段数组（顺序就是数据文件里的顺序，不做 locale 排序） */
const SEGMENTS_BY_CARRIER = new Map(
  CARRIER_SEGMENTS.map(([carrier, segsText]) => [carrier, segsText.split(' ')]));
/** 面板"选运营商"下拉的数据源：`count` 是这家在表内挂了几个号段 */
export const CARRIERS = CARRIER_SEGMENTS.map(([carrier, segsText]) => ({
  carrier, count: segsText.split(' ').length,
}));
/** 表内全部号段，按运营商分组顺序、组内保持数据文件顺序 */
export const SEGMENTS = [...BY_SEGMENT.keys()];

/** 报错文案里的"收到什么"，与 idcard / uscc / panel / bankcard 同档 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}

/**
 * 归一：去掉分隔符，再剥掉可识别的国家码前缀。
 * 与银行卡同族（卡号按 4 位分组、号码按 3-4-4 分组书写，粘进来带空格是正常输入），
 * 与身份证那一侧"内部空白判 malformed"相反，不是分叉。
 * @param {string} text 已 trim 的输入
 * @returns {{digits:string, stripped:string}} 纯数字与"被去掉了什么"的说明（供逐项表点名）
 */
function normalize(text) {
  const noSep = text.replace(/[ \t\u3000\u00A0\-\u2010-\u2015().（）]+/g, '');
  if (/^\+86(?=1[3-9])/.test(noSep)) {
    return { digits: noSep.slice(3), stripped: '去掉了国际前缀 +86' };
  }
  if (/^0086(?=1[3-9])/.test(noSep)) {
    return { digits: noSep.slice(4), stripped: '去掉了国际前缀 0086' };
  }
  // `86` 开头不能无条件剥：13 位串里 `86` 后接 `1[3-9]` 才是国家码写法；
  // 而十一位号本身以 `1` 开头，永远轮不到这一格——所以条件写成"长度 13 且 86 开头"。
  if (noSep.length === MOBILE_LENGTH + 2 && /^86(?=1[3-9])/.test(noSep)) {
    return { digits: noSep.slice(2), stripped: '去掉了国际前缀 86' };
  }
  return { digits: noSep, stripped: '' };
}

/** 3-4-4 分组的可读形态（`138 0013 8000`）；形状不对就原样返回，不猜 */
export function formatMobile(digits) {
  const s = typeof digits === 'string' ? digits : '';
  const m = /^(\d{3})(\d{4})(\d{4})$/.exec(s);
  return m === null ? s : `${m[1]} ${m[2]} ${m[3]}`;
}

/**
 * 三位号段判运营商。只认三位这一档（见文件头为什么不做到七位）。
 * @param {string} digits 纯数字；长度不足十一位时返回 null（无号段可谈）
 * @returns {{segment:string,carrier:string|null}|null} 非纯数字或不足十一位返回 null
 */
export function lookupCarrier(digits) {
  if (typeof digits !== 'string' || !/^\d+$/.test(digits)) return null;
  const segment = digits.slice(0, 3);
  if (segment.length < 3) return { segment, carrier: null };
  return { segment, carrier: BY_SEGMENT.get(segment) ?? null };
}

/**
 * 校验 / 解析一个手机号。四态：`empty` / `malformed` / `unlisted` / `valid`。
 *
 * 逐项表按"解到哪一步才崩"分两级（与 `parseIdCard` 的同一条契约）：
 * 字符 / 位数那一关就出局的只给前两行、`info` 为 null（那时连十一位结构都没有，
 * 号段无从谈起）；位数过了但开头不是 `1[3-9]` 的，四行照给、`info` 照给，
 * 只把 `carrier` 收空——在 `12800138000` 旁边挂一个"运营商：未收录"等于凭空造结论。
 * `ok` 三态，**只有 false 拖垮整体结论**：号段合法但表里没这一格是 `null` + `unlisted`，
 * 不是无效号（§5.4"查不到不等于无效"在这一页的落地）。
 *
 * @param {string|number} raw 用户输入；`null` / `undefined` 当空串。十一位在 2^53 之内，
 *   数值入参在这一格不会掉末位（与银行卡 19 位那一档不同），但口径仍建议传字符串。
 * @returns {{input:string,value:string,digits:string,normalized:string,state:string,
 *   checks:object[],info:object|null,segment:string,carrier:string,
 *   caveat:string,note:string,hasCaveat:boolean}} 结果
 */
export function parseMobile(raw) {
  const text = raw === null || raw === undefined ? '' : String(raw);
  const value = text.trim();
  const { digits, stripped } = normalize(value);
  const out = {
    input: text, value, digits, normalized: stripped, state: 'empty', checks: [],
    info: null, segment: '', carrier: '',
    caveat: MOBILE_CAVEAT, note: CARRIER_NOTE, hasCaveat: false,
  };
  if (value === '') return out;
  const checks = out.checks;
  const push = (key, label, ok, detail) => checks.push({ key, label, ok, detail });

  const bad = /[^0-9]/.exec(digits);
  push('charset', '字符', !bad, bad
    ? `含非数字字符「${bad[0]}」（去掉分隔符与国际前缀后的第 ${bad.index + 1} 位）`
    : `纯数字 ${digits.length} 位${stripped ? `（${stripped}）` : ''}`);
  const lengthOk = digits.length === MOBILE_LENGTH;
  push('length', '位数', lengthOk, lengthOk
    ? `${MOBILE_LENGTH} 位`
    : `${digits.length} 位，应为 ${MOBILE_LENGTH} 位${stripped ? `（${stripped}）` : ''}`);
  if (bad || !lengthOk) {
    out.state = 'malformed';
    return out;
  }

  const seg = lookupCarrier(digits);
  const segmentOk = /^1[3-9]\d$/.test(seg.segment);
  out.segment = seg.segment;
  push('segment', '号段', segmentOk, segmentOk
    ? `${seg.segment} 落在 1[3-9] 开头这一档（三位号段）`
    : `${seg.segment} 不是移动号段开头（应以 13–19 开头）`);
  const carrierName = segmentOk ? seg.carrier : null;
  out.carrier = carrierName ?? '';
  push('carrier', '运营商', segmentOk ? (carrierName === null ? null : true) : null,
    segmentOk
      ? (carrierName === null
        ? `${seg.segment} 未收录在号段表里，不据此判无效`
        : `${carrierName}（发号口径，携号转网后不代表当前运营商）`)
      : '号段不成立，不判运营商');

  out.info = {
    digits, length: digits.length, segment: out.segment, carrier: out.carrier,
    formatted: formatMobile(digits),
    source: CARRIER_SOURCE, datasetVersion: CARRIER_META.fetchedAt,
  };
  out.hasCaveat = true;
  if (!segmentOk) {
    out.state = 'malformed';
    return out;
  }
  out.state = carrierName === null ? 'unlisted' : 'valid';
  return out;
}

/** 每次取值都保证落在 [0,1) 的随机源；口径与 `generateIdCards` / `generateBankCards` 同档 */
function checkedRng(input) {
  if (input === undefined || input === null) return seededRandom(Date.now());
  if (typeof input !== 'function') {
    throw new TypeError(`generateMobiles 的 options.rng 应为 () => number，收到 ${shapeOf(input)}`);
  }
  return () => {
    const v = input();
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1) {
      throw new TypeError(`generateMobiles 的 options.rng 每次应给出 [0, 1) 内的有限数，收到 ${shapeOf(v)}`);
    }
    return v;
  };
}

/** 收窄用的字符串选项：只认非空字符串，`null` / 数值一律抛（同 idcard 的 `prefixOf` 口径） */
function textOption(o, key, pattern, label) {
  const v = o[key];
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string' || (pattern !== null && !pattern.test(v.trim()))
    || (pattern === null && v.trim() === '')) {
    throw new TypeError(`generateMobiles 的 options.${label} 应为${pattern ? `匹配 ${pattern}` : '非空字符串'}，收到 ${shapeOf(v)}`);
  }
  return v.trim();
}

/**
 * 生成合法测试手机号。**只从表内的号段出**，所以每一条都能被 `parseMobile` 判 `valid`；
 * 不做归属地，所以没有"城市"这一格可挑。生成后立即自检，不成立就抛内部不变量。
 *
 * @param {{count?:number, carrier?:string, segment?:string, rng?:() => number}} [options]
 *   整个对象传 `null` / `undefined` 等于没传
 * @throws {TypeError} `carrier` 不是非空字符串、`segment` 不是三位数字字符串、`rng` 形状不对
 * @throws {RangeError} `count` 不在 1..50、`carrier` 不在表内五家里、`segment` 不在表内号段里、
 *   两者同时给了但号段不属于这家
 * @returns {{number:string,formatted:string,segment:string,carrier:string,caveat:string,
 *   note:string}[]} 号码列表
 */
export function generateMobiles(options = {}) {
  const o = options ?? {};
  const rng = checkedRng(o.rng);
  const count = o.count === undefined ? 1 : o.count;
  if (!Number.isInteger(count) || count < 1 || count > GENERATE_MAX) {
    throw new RangeError(`generateMobiles 的 options.count 应为 1..${GENERATE_MAX} 的整数，收到 ${shapeOf(o.count)}`);
  }
  const carrier = textOption(o, 'carrier', null, 'carrier');
  if (carrier !== '' && !SEGMENTS_BY_CARRIER.has(carrier)) {
    throw new RangeError(
      `generateMobiles 的 options.carrier（${carrier}）不在表内 ${CARRIERS.length} 家运营商里`);
  }
  const segment = textOption(o, 'segment', /^\d{3}$/, 'segment');
  if (segment !== '' && !BY_SEGMENT.has(segment)) {
    throw new RangeError(
      `generateMobiles 的 options.segment（${segment}）不在表内 ${SEGMENTS.length} 个号段里`);
  }
  let pool = segment === '' ? SEGMENTS : [segment];
  if (carrier !== '') {
    const owned = SEGMENTS_BY_CARRIER.get(carrier);
    pool = pool.filter((s) => owned.includes(s));
    if (pool.length === 0) {
      throw new RangeError(`号段 ${segment} 不属于 ${carrier}（表内它归 ${BY_SEGMENT.get(segment)}）`);
    }
  }

  const list = [];
  for (let i = 0; i < count; i += 1) {
    const seg = pool[Math.floor(rng() * pool.length)];
    let tail = '';
    while (tail.length < MOBILE_LENGTH - 3) tail += String(Math.floor(rng() * 10));
    const number = seg + tail;
    const self = parseMobile(number);
    // 三条一起判：格式正则、状态、以及"读回来的号段就是本条用的号段"。
    // 后两条今天就能红（号段表若长出重叠段，§F0 从数据侧盯着，这一格从行为侧盯）；
    // 第一条是给 `MOBILE_RE` 本身留的牙——它一旦被改动，生成侧当场就报，而不是让
    // 页面上一堆"合法号码"和这条正则各说各话。
    if (!MOBILE_RE.test(number) || self.state !== 'valid' || self.segment !== seg) {
      const why = self.checks.filter((k) => k.ok === false).map((k) => `${k.label}：${k.detail}`).join(' / ');
      throw new Error(`内部不变量：生成的 ${number} 自检为 ${self.state}（${why}）`);
    }
    list.push({
      number, formatted: self.info.formatted, segment: seg,
      carrier: self.carrier, caveat: self.caveat, note: self.note,
    });
  }
  return list;
}
```

- [ ] **Step 4: 跑绿**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^# (tests|pass|fail)'; echo "exit=${PIPESTATUS[0]}"
node --check dev/js/tools/phone.js
wc -l dev/js/tools/phone.js
```

Expected：`# tests 84`、`# pass 84`、`# fail 0`、`exit=0`（41 + 5 + 23 + 15），`wc -l` 258 行左右。

**同一批还要动一处门禁清单**：把 `dev/js/tools/phone.js` 加进 `scripts/verify-plan-blocks.mjs` 的
`FILE_TARGETS`。漏了它，§0.1 红线 4 的反查守卫会当场报 `✗ 漏网镜像：…在计划里有逐字节全等的整块，
但它不在 FILE_TARGETS 里，从没被核过` 并退 1——那不是在拦你，是在提醒"这块镜像从此没人核对"。
**Task 4–7 同理**：每个整文件镜像落地的那一步就顺手加一行，别留到收口再补（段 1 的
`build-prefix-data.mjs` 就是这么变成漏网鱼的）。

- [ ] **Step 5: 自证这 15 条有牙（十五处变异，逐处记下红了谁）**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
mkdir -p /tmp/t3mut
cat > /tmp/t3mut/mut.mjs <<'EOF'
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const REPO = '/Users/liaolongdong/code/liaolongdong.github.io';
const TREE = '/tmp/t3mut/tree';
const P = path.join(TREE, 'dev/js/tools/phone.js');
const CMD = 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs';
fs.rmSync(TREE, { recursive: true, force: true });
// 真复制，不用 `cp -al`：硬链接的"影子副本"改一处两处同时变，量出来的全是假证据。
// 变异一律落在副本里：本仓随时可能有第二条会话在同一个 worktree 上 `git add`，
// 把 `dev/js/tools/phone.js` 就地改十五遍的风险不是"脏一下"，是可能被别人连脏的一起提交。
for (const d of ['dev/js', 'scripts', 'demo']) fs.cpSync(path.join(REPO, d), path.join(TREE, d), { recursive: true });
fs.copyFileSync(path.join(REPO, 'package.json'), path.join(TREE, 'package.json'));
const orig = fs.readFileSync(P, 'utf8');
/** 未变异先跑一次：拿它的 `# tests` 总数当尺子，好把"脚手架其实没跑到测试"和"这处不可达"分开 */
function run() {
  let out = '';
  try { out = execSync(`${CMD} 2>&1`, { encoding: 'utf8', cwd: TREE }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  return {
    out,
    total: Number((out.match(/^# tests (\d+)/m) || [])[1] ?? -1),
    pass: Number((out.match(/^# pass (\d+)/m) || [])[1] ?? -1),
    reds: [...out.matchAll(/^not ok \d+ - (F\d+)/gm)].map((m) => m[1]),
  };
}
const base = run();
if (base.total < 0 || base.reds.length > 0) {
  console.log(base.out.split('\n').slice(-40).join('\n'));
  throw new Error(`基线就不对（# tests ${base.total}、红 ${base.reds.length} 条），先让全量跑绿再谈牙齿`);
}
console.log(`基线 # tests ${base.total} 全绿（副本 ${TREE}）`);
const MUTS = [
  ['M1 位数下限改成 10', "export const MOBILE_LENGTH = 11;", "export const MOBILE_LENGTH = 10;"],
  ['M2 格式正则放宽成 1x 开头', "export const MOBILE_RE = /^1[3-9]\\d{9}$/;", "export const MOBILE_RE = /^1\\d{10}$/;"],
  ['M3 号段行无条件放行', "push('segment', '号段', segmentOk,", "push('segment', '号段', true,"],
  ['M4 表外判成 malformed', "out.state = carrierName === null ? 'unlisted' : 'valid';", "out.state = carrierName === null ? 'malformed' : 'valid';"],
  ['M5 表外那格 ok 给硬红', "push('carrier', '运营商', segmentOk ? (carrierName === null ? null : true) : null,", "push('carrier', '运营商', segmentOk ? (carrierName === null ? false : true) : null,"],
  ['M6 结论不带参考提示', "  out.hasCaveat = true;\n  if (!segmentOk) {", "  if (!segmentOk) {"],
  ['M7 +86 不剥', "if (/^\\+86(?=1[3-9])/.test(noSep)) {", "if (false) {"],
  ['M8 裸 86 无条件剥', "if (noSep.length === MOBILE_LENGTH + 2 && /^86(?=1[3-9])/.test(noSep)) {", "if (/^86/.test(noSep)) {"],
  ['M9 分组写成 3-3-5', "const m = /^(\\d{3})(\\d{4})(\\d{4})$/.exec(s);", "const m = /^(\\d{3})(\\d{3})(\\d{5})$/.exec(s);"],
  ['M10 lookupCarrier 不判字符', "if (typeof digits !== 'string' || !/^\\d+$/.test(digits)) return null;", "if (typeof digits !== 'string') return null;"],
  ['M11 生成侧不自检', "if (!MOBILE_RE.test(number) || self.state !== 'valid' || self.segment !== seg) {", "if (false) {"],
  ['M12 rng 返回值不设闸门', "if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1) {", "if (false) {"],
  ['M13 segment 入参不验形状', "if (typeof v !== 'string' || (pattern !== null && !pattern.test(v.trim()))", "if (typeof v !== 'string' || (pattern !== null && true)"],
  ['M14 文案删掉"不做归属地"', "'携号转网后不代表当前实际运营商。本站不做号码归属地：三位号段这一层判不到城市，'", "'携号转网后不代表当前实际运营商。'"],
  ['M15 表外段兜底成中国移动', "return { segment, carrier: BY_SEGMENT.get(segment) ?? null };", "return { segment, carrier: BY_SEGMENT.get(segment) ?? '中国移动' };"],
];
for (const [name, a, b] of MUTS) {
  const hits = orig.split(a).length - 1;
  if (hits !== 1) { console.log(`!! ${name} 锚点命中 ${hits} 处（要恰好 1 处），这一档不算证据`); continue; }
  const text = orig.replace(a, b);
  if (text === orig) { console.log(`!! ${name} 替换后一字未变，脚手架在骗人`); continue; }
  fs.writeFileSync(P, text);
  if (fs.readFileSync(P, 'utf8') !== text) { console.log(`!! ${name} 写完读回来不一样，文件系统在骗人`); continue; }
  const r = run();
  if (r.total !== base.total) { console.log(`!! ${name} 只跑到 ${r.total} 条（基线 ${base.total}），这一档不算证据`); continue; }
  console.log(`${name} → ${r.reds.length ? [...new Set(r.reds)].join(' ') : '全绿（不可达，见计划说明）'}（pass ${r.pass}/${r.total}）`);
}
fs.writeFileSync(P, orig);
const after = run();
console.log(`还原后：# tests ${after.total}、pass ${after.pass}、红 ${after.reds.length ? after.reds.join(' ') : '无'}`);
console.log(`副本与工作树逐字节一致=${fs.readFileSync(P, 'utf8') === fs.readFileSync(path.join(REPO, 'dev/js/tools/phone.js'), 'utf8')}`);
EOF
node /tmp/t3mut/mut.mjs
git status --porcelain -- dev/js/tools/phone.js scripts/toolkit-tests.mjs   # 实验不该溢出到工作树
```

红名单（2026-09-27 在副本上按**全量 84 条**实跑，基线全绿；十五刀跑完还原后再跑一次仍是
84/84，`副本与工作树逐字节一致=true`。这张表与 2026-09-26 在镜像上单跑 §F 预记的那张**逐行相同**，
连带 `pass` 数一并记下来——§A–§E 没有一处 `import` `phone.js`，所以全量与单跑的红名单本该一致，
真不一致就是"哪儿变了"，先按 `!!` 那两档排查脚手架）：

| 变异 | 红了谁 | 说明 |
| --- | --- | --- |
| M1 位数下限改成 10 | F1 F2 F4 F6 F7 F8 F9 F12 F13 F14 F15 | 十一位是所有人的前提，红一片是应该的 |
| M2 格式正则放宽成 `1\d{10}` | **只 F9 红** | F9 就是那条"正则与 `parseMobile` 同口径"，别的都从行为判 |
| M3 号段行无条件放行 | **只 F6 红** | `128…` 那一档独占 |
| M4 表外判成 `malformed` | F7 F9 | F9 那侧靠 `state !== 'malformed'` 与正则对上，一并被抓 |
| M5 表外那格 `ok` 给硬红 | **只 F7 红** | `null` 与 `false` 的分界，F7 独占 |
| M6 结论不带参考提示 | F1 F6 F15 | `hasCaveat` 三条各盯一级 |
| M7 `+86` 不剥 | **只 F2 红** | 书写变体那一节独占 |
| M8 裸 `86` 无条件剥 | **只 F3 红** | "只在该剥的时候剥"独占 |
| M9 分组写成 3-3-5 | F1 F10 | F10 是格式化专项 |
| M10 `lookupCarrier` 不判字符 | **只 F11 红** | 返回形状闸门独占 |
| M11 生成侧不自检 | **全绿** | 见下 |
| M12 rng 返回值不设闸门 | **只 F14 红** | 抛的是内部不变量而不是 `TypeError`，F14 的 `instanceof` 抓住 |
| M13 `segment` 入参不验形状 | F13 F14 | 类型错退化成范围错，两侧都红 |
| M14 文案删掉"不做归属地" | **只 F15 红** | 那句偏差只能靠文案判据守着——代码里没有归属地这件事，删不掉一个不存在的功能 |
| M15 表外段兜底成中国移动 | F7 F11 | 表外必须有 `null`，兜底成任何一家都红 |

**M11 全绿不是判据没牙，是那一格在今天的数据下不可达**：`pool` 整份来自表内号段，尾数是纯数字，
所以每条生成出来必然 `valid`，把 `if (!MOBILE_RE.test(number) || self.state !== 'valid' ||
self.segment !== seg)` 整条摘掉也造不出触发条件（与 Task 2 的 M7 同一件事，两处都要按"不可达"
读，不许读成"覆盖了"）。从**测试侧**独立盯这件事的是 F12 里那三句 `back.state === 'valid'` /
`back.segment === item.segment` / `LISTED.includes(item.segment)`——它们与模块内那半句不是同一个
条件，所以不循环。留着内部不变量的理由与 Task 2 相同：号段表一旦长出重叠段（§F0 从数据侧盯着），
"生成广电却读成移动"只有这一格能当场报。

- [ ] **Step 6: 记一次耗时（Task 10 的性能口径要用）**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
node --input-type=module -e "
const t0 = performance.now(); const m = await import('./dev/js/tools/phone.js');
console.log('import phone.js（含 carrier-data）=', (performance.now() - t0).toFixed(1) + 'ms');
const bench = (label, fn, n) => {
  for (let i = 0; i < 2000; i += 1) fn(i);            // 预热，不然量到的是 JIT 爬坡
  const s = performance.now();
  for (let i = 0; i < n; i += 1) fn(i);
  console.log(label, ((performance.now() - s) / n * 1000).toFixed(1) + 'µs/次');
};
bench('parseMobile（带分组空格）', (i) => m.parseMobile('138 0013 800' + (i % 10)), 5000);
bench('parseMobile（纯 11 位）', (i) => m.parseMobile('1380013800' + (i % 10)), 5000);
for (let i = 0; i < 20; i += 1) m.generateMobiles({ count: 50 });
const g0 = performance.now();
for (let i = 0; i < 20; i += 1) m.generateMobiles({ count: 50 });
console.log('预热后 generateMobiles 满批 =', ((performance.now() - g0) / 20).toFixed(2) + 'ms/批');
"
```

2026-09-26 本机 Node 22 的实测**区间**（同一台机器连跑七次的摆动，不是跑三次就够的数）：
`import` **7–27ms**、`parseMobile` 预热后 **1.6–3.7µs/次**、`generateMobiles` 预热后
**0.33–0.51ms/批（50 条）**。落地当天（2026-09-27）在工作树上又连跑三组，同一条命令量到
`import` **5.1–5.5ms**、`parseMobile` **2.0–2.5µs/次**（带分组）与 **1.0–1.2µs/次**（纯 11 位）、
`generateMobiles` 满批 **0.09–0.14ms/批**。两次的 `parseMobile` 区间重叠（1.6–3.7 与 2.0–2.5），
`generateMobiles` 却差着 3 倍且不重叠——**这一档的差别我没有归因**（09-26 那组跑在镜像上、
这一组跑在工作树上，期间另一路会话还在改 sass 与 html，谁在抢 CPU 说不清）。所以这一格能立住的
只有**量级**：满批在 **0.1–0.5ms** 之间，Task 10 要判的是"有没有冒出 10ms 以上"，别拿其中任何
一个点当阈值。两个坑都写在这一段里：

- **没预热会高一个数量级**：同一段代码冷启动第一跑量到 **56µs/次**，比稳态的 3.7µs 多 15 倍。
  Task 10 若拿这里做性能断言，必须带着那 2,000 次预热跑，否则阈值一填就是个假红。
- **`import` 的摆动是环境噪声**：7ms 与 27ms 之间没有可解释的差别（`carrier-data.js` 才
  1,239B、`phone.js` 13,185B，两侧都不建大表）。这一格对首屏的实际贡献相对 `bank-bin-data.js`
  那 38KB 可以忽略；页面预算按 Task 1 的账走，别拿这里的数字当依据。

```bash
wc -c dev/js/tools/phone.js dev/js/tools/carrier-data.js
gzip -6 -c dev/js/tools/phone.js | wc -c        # 5,733 —— 带 FNAME 头
cat dev/js/tools/phone.js | gzip -6 | wc -c     # 5,724 —— 管道形态没有 FNAME 头，少 9B
```

Expected：13,185 / 1,239 字节、`gzip -6` **5,733**（`gzip -c 文件` 那种写法会把文件名打进
`FNAME` 头，比管道形态多 9B——2026-09-27 两种都量过，别再拿这两个数互相判红）。**这是源码原文与
gzip，不是产物**——产物口径（terser 之后）到 Task 9 的收录面一起量，那里才有 `toolIdcard.min.js`
的真数。

- [ ] **Step 7: 提交**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
git status --porcelain
git add dev/js/tools/phone.js scripts/toolkit-tests.mjs
git commit -m "$(cat <<'EOF'
feat(tools): 手机号模块——格式判定、三位号段判运营商与生成侧

号段是发号口径的参考：表外段判 unlisted 且 ok 给 null，只有格式那一档
是硬结论；开头不是 1[3-9] 时四行照给、运营商收空，照 parseIdCard 的两级
契约。分组、全角、括号与 +86/0086/86 一律归一并在逐项表点名，裸 86 只在
整串 13 位时才剥。不做归属地（三位号段判不到城市，可干净取许可的源只有
这一层），CARRIER_NOTE 那句由面板原样显示。
EOF
)"
git status --porcelain | head
```

Expected：**真实落地是四条路径**（`c79373e`：`phone.js`、`toolkit-tests.mjs`、
`verify-plan-blocks.mjs` 的 `FILE_TARGETS` 一行、`verify-plan-blocks-teeth.mjs` 24 行）。第四条不是
顺手改的：上一格暴露的"自证器手抄了一份镜像清单"在这一格根治——改成从校验器源码里解析
`FILE_TARGETS`，读不出来就抛（少拷一项会假绿），此后落地整文件模块只改校验器那一处。
剩下仍是对方那批未提交项。`_docs/superpowers/plans/` 里这份计划
按 Task 11 的收口节奏单独提，别混进这一条。

## Task 4: `random-data.js` — 随机姓名 / 地址 / 邮箱与"一次一组"

**Files:**
- Create: `dev/js/tools/random-data.js`
- Modify: `scripts/toolkit-tests.mjs`（追加 §G，15 条）

这一格的代码不难，难的是**六条口径先立住**，否则实现里到处是"看起来合理但说出口会心虚"的句子：

1. **五张字表、三个自造词族，全部本站自造，判据因此只断形状与自洽。** 姓氏 98 字、名字用字 123 字、
   街道词 24 条 + 后缀 4 条、邮箱词根 24 条——都是手挑的高频子集，不引第三方姓名库（引了就要谈许可，而姓名库最大的
   问题是它**真能撞出某个真实的人**）。所以 §G 断得到"表内不重复、每条姓名都落在姓氏×字表的
   乘积里、每条邮箱都过 `EMAIL_RE`"，断不到"覆盖了全国多少比例的姓氏"——这句必须写在文件头，
   面板也别把它说成"高频姓名库"。表规模另有下限（G1 的 90 / 110 / 20 / 20）：谁把表删短一截，
   "高频"那句就该当场红，而不是安静地少一批候选。
2. **地址只出现行县级码，收窄口径逐字照 `idcard.js` 的 `prefixOf`。** `areaCode > cityCode >
   provinceCode` 只认传了的那一个；非字符串、`null`、空串、全空白一律 `TypeError`。这一族闸门在
   §B 的 B10 刚为身份证那一侧收过口，这里是第二处落地，G10 三个键各钉七种坏值。前缀在现行表里
   挑不出县码时抛 `RangeError` 而不是回落整张表——`provinceCode: '3712'`（莱芜，历史市码）就是
   这一档，它必须报错，不能变成"从 2,978 条现行县码里随便出货"。
3. **`null` 在这一页有两种身份，分界是有没有后果。** 区划三键的 `null` 抛：把它当成"没传"等于
   静默放开整张现行表（与 §B 的 B10 同一条理由）。而 `domain` / `givenLength` / `rng` 的 `null`
   等于没传：它们各自的默认值本身就是安全的（三个保留域里挑、1–2 字里挑、时间种子），与
   `idcard.js` 的 `minAge` / `sex` 同一族。`count: null` 走整数闸门，抛 `RangeError`。
   三档各有一处判据钉着：`givenLength` 在 G4、`domain` 与 `rng` 在 G11 / G7（2026-09-27 复核整改
   给 G7 补上 `rng: null` 这一档，此前只断了"非函数抛"，`null` 走哪一支没人管），区划三键的
   反例在 G10。谁改口径就红在对应的键上。
4. **"批内不重复"只有把空间压小才看得见，所以判据自己造一个退化随机源。** 30 条姓名的组合空间是
   98×(123+123²) = 1,494,696 格，但**格数多不等于不撞**：撞重概率要看 `q = Σpₖ²`，而这三个生成器
   都是分层加权抽样，不是均匀撒点。姓名 35% 的概率走单字（12,054 格）、65% 走双字（1,482,642 格），
   每个单字名的概率是双字名的 66 倍 → `q·N = 15.62` 倍均匀；邮箱 50% 走单词根（24 格）、尾巴
   2 / 3 / 4 位各 1/3（100 / 1,000 / 10,000 格）→ `q·N = 89.13` 倍均匀；只有地址是三层独立均匀，
   `q·N = 1.00`。于是"至少撞一次"的真实概率（`P ≈ C(n,2)·q`，2026-09-27 用 `/tmp/t4/collide2.mjs`
   走真实代码路径、10 万次蒙特卡洛复算，与解析值列在一起）：

   | 一批 | 姓名 | 邮箱 | 地址 |
   | --- | --- | --- | --- |
   | 30 条 | **0.454%**（MC 0.436） | **0.194%**（MC 0.177） | 7.6×10⁻⁶ |
   | 50 条 | **1.280%**（MC 1.269） | **0.546%**（MC 0.577） | 2.1×10⁻⁵ |

   原写法按 `C(n,2) / 组合空间` 算，姓名 30 条记成 2.9×10⁻⁴、邮箱记成 2.4×10⁻⁵，都低估了一个半到
   两个数量级——**"千分之一都不到"这种说法站不住，正常随机源下满批撞重是百分之一这个档**。
   （这不影响下面的结论，反而更支持它。）
   **所以只断"这批不重复"等于没断**——把 `uniqueBatch` 的判重整条摘掉，15 条判据照样全绿，
   本轮在镜像上实测过：M1 只红 G5，是因为 G5 里那三句压空间的探针在叫。所以 G5 用恒定源
   `rng: () => 0.5` 把组合空间塌成一格，逼出两条相反的行为：判重还在→抛 `RangeError`
   （文案带"只凑到 1 条"），判重被摘→安静返回 `count` 条一模一样的结果。同族的另一条退化
   （`pick(pool, rng)` 被写成 `pool[0]`）由 G8 那句"30 条不许全落在同一个县"兜住——它不是随机性
   断言，2,978 抽 30 全等的概率是 **10⁻¹⁰⁰·⁷**，红了就一定是代码坏了。
   另一处同源的空口：报错文案里的"组合空间约 N"必须是**精确格数**而不是拍脑袋的上界，
   邮箱那格的尾巴空间实测是 10²+10³+10⁴ = 11,100（前导零合法，如 `harvest0054`），
   不是按整数区间数出来的 9,990——2026-09-27 复核整改改的就是这一笔，G11 现在直接断
   `EMAIL_RE` 收得下前导零尾巴、且 240 条抽样里真出现过。
5. **`generateProfiles` 刻意不挂身份证号码。** §5.1 的 `#random` 只点姓名 / 地址 / 邮箱三类；
   号码那一格有自己的区划、性别、年龄段收窄，把两边耦合成"一个完整假人"要多出一套交叉口径
   （地址县码必须能生成号码、生日必须与年龄段一致），而这几类的免责口径本来就各说各话（§5.5）。
   要一组带号码的，在页面上两个面板各点一次，比在数据层造一个"看起来像真人"的对象更诚实。
   G12 用 `Object.keys(三元组)` 钉住"只有 name / address / email 三格"，多挂一格就红。
6. **`RANDOM_CAVEAT` 与 `idcard.js` 的 `USE_NOTE` 各存一份副本，由 G13 判逐字相等。** §5.5 的
   生成类提示全站只有一句，两个模块为了一个字串建立 import 边不值得（`random-data.js` 不该依赖
   身份证模块），但副本会漂移，所以拿判据钉住：改任一侧、只要不同步，红的是 G13。

- [ ] **Step 1: 先写 §G 的 15 条判据（此时 `random-data.js` 还不存在，必红）**

追加到 `scripts/toolkit-tests.mjs` 末尾（§F 之后）。**这一节只新引一个模块**：`seededRandom`、
`currentCountyCodes`、`resolveRegion`、`USE_NOTE` 与身份证那个 `GENERATE_MAX` 都已经在 §B / §C 的
顶层解构过了，同一个模块里同名 `const` 再声明一次是 SyntaxError；本节的别名只有
`RAND_GENERATE_MAX` 一个新名字（G6 拿它与身份证那个比上限同档）。`dupes` / `CJK1` / `gNames` /
`gAddr` / `gMails` 是这一节自己的辅助，与 §E 的 `ck` / `pan`、§F 的 `mck` / `mrow` / `pad11` /
`LISTED` / `ALL70` 不重名。

```js
// ── §G 随机合成数据 ────────────────────────────────────────────────────────
//（`seededRandom` / `currentCountyCodes` / `resolveRegion` / `USE_NOTE` 与身份证那个 `GENERATE_MAX`
//  都已在 §B、§C 顶层解构过，同名 const 再声明一次是 SyntaxError；本节只新引 random-data.js，
//  上限那个键别名成 RAND_GENERATE_MAX，好与身份证那一档比"上限同档"。）
const {  ADDRESS_NOTE, EMAIL_DOMAINS, EMAIL_NOTE, EMAIL_RE, EMAIL_WORDS, GIVEN_CHARS, NAME_NOTE,
  RANDOM_CAVEAT, STREET_SUFFIXES, STREET_WORDS, SURNAMES,
  GENERATE_MAX: RAND_GENERATE_MAX,
  generateAddresses, generateEmails, generateNames, generateProfiles,
} = await import('../dev/js/tools/random-data.js');

const dupes = (arr) => arr.filter((v, i) => arr.indexOf(v) !== i);
const CJK1 = /^[㐀-鿿]$/;
const gNames = (seed) => generateNames({ count: 30, rng: seededRandom(seed) });
const gAddr = seed => generateAddresses({ count: 30, rng: seededRandom(seed) });
const gMails = seed => generateEmails({ count: 30, rng: seededRandom(seed) });

test('G1 词表自洽：五张字表各自无重复、形状合法、规模不缩水', () => {
  for (const [who, arr] of [['SURNAMES', SURNAMES], ['GIVEN_CHARS', GIVEN_CHARS],
    ['STREET_WORDS', STREET_WORDS], ['STREET_SUFFIXES', STREET_SUFFIXES], ['EMAIL_WORDS', EMAIL_WORDS]]) {
    assert.deepEqual(dupes(arr), [], `${who} 表内有重复`);
    assert.ok(Array.isArray(arr) && arr.length > 0, `${who} 是空表`);
  }
  assert.ok(SURNAMES.every((s) => CJK1.test(s)), '姓氏表混进了非单字汉字');
  assert.ok(GIVEN_CHARS.every((c) => CJK1.test(c)), '字表混进了非单字汉字');
  assert.ok(STREET_WORDS.every((w) => /^[㐀-鿿]{2}$/.test(w)), '街道词不是两个汉字');
  assert.ok(STREET_SUFFIXES.every((s) => /^[㐀-鿿]{1,2}$/.test(s)), '街道后缀不是一到两个汉字');
  assert.ok(EMAIL_WORDS.every((w) => /^[a-z]{2,14}$/.test(w)), '邮箱词根不是纯小写字母');
  // 规模下限：表被误删一截时"高频"这句就该红，而不是安静地少一批候选
  assert.ok(SURNAMES.length >= 90, `姓氏表只剩 ${SURNAMES.length} 字`);
  assert.ok(GIVEN_CHARS.length >= 110, `字表只剩 ${GIVEN_CHARS.length} 字`);
  assert.ok(STREET_WORDS.length >= 20, `街道词只剩 ${STREET_WORDS.length} 条`);
  assert.ok(EMAIL_WORDS.length >= 20, `邮箱词根只剩 ${EMAIL_WORDS.length} 条`);
});

test('G2 EMAIL_RE 是从 EMAIL_DOMAINS 拼出来的，且点号是真点号', () => {
  assert.deepEqual(EMAIL_DOMAINS, ['example.com', 'example.net', 'example.org']);
  for (const d of EMAIL_DOMAINS) assert.ok(EMAIL_RE.test(`pear21@${d}`), `${d} 过不了自家正则`);
  assert.equal(EMAIL_RE.test('pear21@example.info'), false, '非保留域不得通过');
  assert.equal(EMAIL_RE.test('pear21@example!com'), false, '点号没转义：example!com 蒙混过关');
  assert.equal(EMAIL_RE.test('pear21@examplecom'), false, '点号没转义：少了点也过关');
  assert.equal(EMAIL_RE.test('Pear21@example.com'), false, '大写不得通过');
  assert.equal(EMAIL_RE.test('pear2@example.com'), false, '1 位数字不得通过');
  assert.equal(EMAIL_RE.test('pear2111@example.com'), true, '4 位数字该过');
  assert.equal(EMAIL_RE.test('pear21111@example.com'), false, '5 位数字不得通过');
  assert.equal(EMAIL_RE.test('.pear21@example.com'), false, 'local 以点开头不得通过');
  assert.equal(EMAIL_RE.test('pe.rr21@example.com'), true, '两段式词根该过');
  assert.equal(EMAIL_RE.test('p.ar21@example.com'), false, '词根短于 2 个字母不得通过');
  assert.equal(EMAIL_RE.test('pear.21@example.com'), false, '点号后面接数字不得通过');
});

test('G3 generateNames 每条都是「表内姓 + 表内字」，字段齐', () => {
  const list = gNames(7);
  assert.equal(list.length, 30);
  for (const it of list) {
    assert.deepEqual(Object.keys(it).sort(), ['given', 'givenLength', 'name', 'surname']);
    assert.ok(SURNAMES.includes(it.surname), `${it.name} 的姓不在表内`);
    assert.ok([1, 2].includes(it.givenLength), `${it.name} 的名不是 1–2 字`);
    assert.equal(it.name, it.surname + it.given);
    assert.equal(it.given.length, it.givenLength);
    assert.ok(it.given.split('').every((c) => GIVEN_CHARS.includes(c)), `${it.name} 的字不在表内`);
  }
});

test('G4 givenLength：1 / 2 各钉死一档，不传则两档都有，null 等于没传', () => {
  assert.ok(generateNames({ count: 10, givenLength: 1, rng: seededRandom(3) })
    .every((i) => i.givenLength === 1 && i.given.length === 1));
  assert.ok(generateNames({ count: 10, givenLength: 2, rng: seededRandom(3) })
    .every((i) => i.givenLength === 2 && i.given.length === 2 && i.name.length === 3));
  const dflt = generateNames({ count: 40, rng: seededRandom(11) });
  assert.deepEqual([...new Set(dflt.map((i) => i.givenLength))].sort(), [1, 2],
    '默认档位只出一头，"1–2 字"那句是假的');
  assert.deepEqual(generateNames({ count: 40, givenLength: null, rng: seededRandom(11) }), dflt,
    'givenLength: null 应当等于没传（含取值次数一致）');
  for (const bad of [3, 0, '1', 1.5, true]) {
    assert.throws(() => generateNames({ givenLength: bad }), TypeError, `givenLength ${String(bad)} 该抛`);
  }
});

test('G5 批内不重复：正常随机源不撞重，恒定源必须当场抛而不是凑重复条', () => {
  for (const [who, list] of [['姓名', gNames(5)], ['邮箱', gMails(5)], ['地址', gAddr(5)]]) {
    const key = who === '姓名' ? 'name' : who === '邮箱' ? 'email' : 'text';
    const keys = list.map((i) => i[key]);
    assert.equal(new Set(keys).size, 30, `${who}批内出现了重复`);
  }
  // 这一档才是判重真正的牙：恒定 rng 把组合空间压成 1 格，
  // 摘掉 uniqueBatch 的判重就会安静返回 30 条一模一样的结果、一条都不红。
  for (const [who, fn] of [['generateNames', generateNames], ['generateEmails', generateEmails],
    ['generateAddresses', generateAddresses]]) {
    assert.throws(() => fn({ count: 5, rng: () => 0.5 }),
      (e) => e instanceof RangeError && /只凑到 1 条/.test(e.message) && /不重复/.test(e.message),
      `${who} 的批内判重没有牙`);
  }
});

test('G6 count 闸门：1..50 之外一律 RangeError，上限与身份证 / 银行卡 / 手机号同一档', () => {
  assert.equal(RAND_GENERATE_MAX, 50);
  assert.equal(RAND_GENERATE_MAX, GENERATE_MAX, '随机数据与身份证的条数上限不同档');
  // 四个生成器共用 1..50 这一档，是靠**这四个常量相等**钉住的，不是靠注释里那句"同一档"。
  // 只比身份证一格的话，银行卡或手机号哪天改成 20，这边的主张就只剩字面好看了。
  assert.equal(RAND_GENERATE_MAX, BANK_GENERATE_MAX, '随机数据与银行卡的条数上限不同档');
  assert.equal(RAND_GENERATE_MAX, MOBILE_GENERATE_MAX, '随机数据与手机号的条数上限不同档');
  for (const bad of [0, -1, 51, 100, '5', 1.5, NaN, null, true]) {
    for (const [who, fn] of [['generateNames', generateNames], ['generateEmails', generateEmails],
      ['generateAddresses', generateAddresses], ['generateProfiles', generateProfiles]]) {
      assert.throws(() => fn({ count: bad }),
        (e) => e instanceof RangeError && e.message.includes(who) && /1\.\.50 的整数/.test(e.message),
        `${who} 的 count ${String(bad)} 没按口径抛`);
    }
  }
  assert.equal(generateNames().length, 1, '不传 count 应给 1 条');
  assert.equal(generateNames(null).length, 1, '整个 options 传 null 应等于没传');
  assert.equal(generateNames(undefined).length, 1);
});

test('G7 rng 闸门：非函数抛、越界的取值抛、null 当没传，两句话各点一次名', () => {
  for (const bad of ['nope', 1, {}, []]) {
    assert.throws(() => generateNames({ rng: bad }),
      (e) => e instanceof TypeError && /options\.rng 应为 \(\) => number/.test(e.message));
  }
  for (const bad of [1, -0.1, NaN, Infinity, '0.5']) {
    assert.throws(() => generateNames({ rng: () => bad }),
      (e) => e instanceof TypeError && /每次应给出 \[0, 1\) 内的有限数/.test(e.message),
      `rng 返回 ${String(bad)} 没被拦`);
  }
  // `rng: null` 走的是"没传"那一支（时间播种），不在这两道闸里：把它当坏值抛，就和
  // `generateIdCards` / `generateBankCards` 的 null 语义不一致；把它当函数，就是漏了守卫。
  for (const [who, fn] of [['generateNames', generateNames], ['generateEmails', generateEmails],
    ['generateAddresses', generateAddresses], ['generateProfiles', generateProfiles]]) {
    assert.equal(fn({ count: 3, rng: null }).length, 3, `${who} 的 rng:null 没按"没传"处理`);
  }
});

test('G8 地址只出现行县级码，整串以区划全名开头', () => {
  const current = new Set(currentCountyCodes());
  const list = gAddr(9);
  assert.equal(list.length, 30);
  // 不收窄时一批 2,978 个县码里抽 30 条，全落在同一个县的概率是 10^-88 量级——
  // 这一句是给"`pick` 被换成 `pool[0]`"这一类静默退化留的牙，不是给随机性留的。
  assert.ok(new Set(list.map((i) => i.areaCode)).size > 1, '不收窄的 30 条地址全落在同一个县');
  for (const it of list) {
    assert.deepEqual(Object.keys(it).sort(),
      ['areaCode', 'city', 'county', 'fullName', 'house', 'province', 'street', 'text']);
    assert.ok(current.has(it.areaCode), `${it.areaCode} 不在现行县码表里`);
    const r = resolveRegion(it.areaCode);
    assert.equal(r.status, 'current');
    assert.equal(r.level, 'county');
    assert.equal(it.fullName, r.fullName);
    assert.ok(it.text.startsWith(it.fullName), `${it.text} 不是以全名开头`);
    assert.ok(it.text.includes(it.county), `${it.text} 里没有县名`);
    assert.ok(it.text.includes(it.province), `${it.text} 里没有省名`);
    assert.match(it.street, new RegExp(`^(${STREET_WORDS.join('|')})(${STREET_SUFFIXES.join('|')})$`));
    assert.match(it.house, /^([1-9]|[1-9][0-9]|1[0-9]{2}|200)号$/);
    assert.equal(it.text, `${it.fullName}${it.street}${it.house}`);
  }
});

test('G9 区划收窄三键各按自己的长度生效，优先级 areaCode > cityCode > provinceCode', () => {
  for (const it of generateAddresses({ count: 20, provinceCode: '11', rng: seededRandom(1) })) {
    assert.ok(it.areaCode.startsWith('11'), `省码收窄漏了 ${it.areaCode}`);
    assert.equal(it.province, '北京市');
  }
  for (const it of generateAddresses({ count: 20, cityCode: '1101', rng: seededRandom(1) })) {
    assert.ok(it.areaCode.startsWith('1101'), `市码收窄漏了 ${it.areaCode}`);
  }
  const one = generateAddresses({ count: 5, areaCode: '110101', rng: seededRandom(1) });
  assert.equal(one.length, 5);
  assert.ok(one.every((i) => i.areaCode === '110101'), '县码收窄后还出了别的县');
  // 三键同时给：只认优先级最高的那一个，不取交集也不报错
  const mixed = generateAddresses({ count: 5, areaCode: '110101', cityCode: '3301',
    provinceCode: '44', rng: seededRandom(1) });
  assert.ok(mixed.every((i) => i.areaCode === '110101'), '三键优先级没按 areaCode 生效');
  // 前后空白裁掉再收窄
  assert.ok(generateAddresses({ count: 3, provinceCode: ' 32 ', rng: seededRandom(1) })
    .every((i) => i.areaCode.startsWith('32')));
});

test('G10 区划键的形状闸门：数值与 null 与空串都抛，挑不出县码的前缀 RangeError', () => {
  for (const key of ['areaCode', 'cityCode', 'provinceCode']) {
    for (const bad of [110101, 11, null, '', '   ', true, {}]) {
      assert.throws(() => generateAddresses({ [key]: bad }),
        (e) => e instanceof TypeError && e.message.includes(`options.${key}`)
          && /非空字符串/.test(e.message),
        `${key}: ${JSON.stringify(bad)} 没被拦`);
    }
  }
  for (const bad of ['999999', '99', '1101010', 'abc']) {
    assert.throws(() => generateAddresses({ areaCode: bad }),
      (e) => e instanceof RangeError && /没有前缀/.test(e.message) && e.message.includes(bad),
      `前缀 ${bad} 该报挑不出县码`);
  }
  assert.throws(() => generateAddresses({ areaCode: '3712' }), RangeError, '莱芜（历史市码）不得当候选前缀用');
});

test('G11 邮箱形状与保留域：每条过自家正则，domain 只认那三个', () => {
  const list = gMails(13);
  assert.equal(list.length, 30);
  for (const it of list) {
    assert.deepEqual(Object.keys(it).sort(), ['domain', 'email', 'local']);
    assert.ok(EMAIL_RE.test(it.email), `${it.email} 过不了自家正则`);
    assert.equal(it.email, `${it.local}@${it.domain}`);
    assert.ok(EMAIL_DOMAINS.includes(it.domain), `${it.domain} 不是保留域`);
    assert.match(it.local, /^[a-z.]+\d{2,4}$/);
    assert.ok(it.local.length <= 32);
    const [stem] = it.local.split(/\d/);
    assert.ok(stem.split('.').every((w) => EMAIL_WORDS.includes(w)), `${it.local} 的词根不在表内`);
  }
  const net = generateEmails({ count: 10, domain: ' EXAMPLE.NET ', rng: seededRandom(2) });
  assert.ok(net.every((i) => i.domain === 'example.net'), 'domain 没 trim + 小写');
  assert.ok(net.every((i) => i.email.endsWith('@example.net')));
  assert.throws(() => generateEmails({ domain: 'gmail.com' }),
    (e) => e instanceof RangeError && /不在保留域/.test(e.message) && e.message.includes('gmail.com'));
  // `null` 与 `undefined` 一样算"没传"（与 `idcard.js` 的 minAge / sex 同一族口径）：
  // 这一键的默认值本身就是安全的（三个保留域里挑），不像区划键那样"没传＝放开整张表"。
  assert.deepEqual(generateEmails({ count: 10, domain: null, rng: seededRandom(2) }),
    generateEmails({ count: 10, rng: seededRandom(2) }), 'domain:null 应当等于没传');
  for (const bad of [1, '', '   ', true, {}]) {
    assert.throws(() => generateEmails({ domain: bad }),
      (e) => e instanceof TypeError && /options\.domain 应为非空字符串/.test(e.message),
      `domain ${JSON.stringify(bad)} 没被拦`);
  }
  assert.ok(gMails(17).some((i) => i.local.includes('.')), '两段式词根一次都没出现过');
  // 前导零这一条直接断两次：一次断自家正则收得下，一次断生成器真会给出来。
  // 报错文案里那笔"数字尾巴 10²+10³+10⁴ = 11100 格"的账全靠第一句成立——哪天尾巴改成
  // `[1-9]\d{1,3}`，空间就缩回 9990，而组合空间的口径只在"凑不满"那句报错里露面，没人会发现。
  assert.ok(EMAIL_RE.test('harvest0054@example.com'),
    '前导零尾巴被自家正则判死，11100 的空间算式随之作废');
  const tails = [7, 11, 13, 17, 19, 23, 29, 31].flatMap((s) => gMails(s).map((i) => i.local));
  assert.equal(tails.length, 240);
  assert.ok(tails.some((t) => t.match(/\d+$/)[0].startsWith('0')),
    '240 条尾巴里没有一条前导零：逐位取 0..9 不该这么偏（实测占一成）');
});

test('G12 generateProfiles：三类同批、形状与单类逐字段一致、且不挂身份证号', () => {
  const list = generateProfiles({ count: 10, provinceCode: '32', domain: 'example.org',
    givenLength: 2, rng: seededRandom(21) });
  assert.equal(list.length, 10);
  for (const it of list) {
    assert.deepEqual(Object.keys(it).sort(), ['address', 'email', 'name'],
      '三元组多出了别的格——§5.1 只点三类，身份证号是刻意不挂的');
    assert.deepEqual(Object.keys(it.name).sort(), ['given', 'givenLength', 'name', 'surname']);
    assert.deepEqual(Object.keys(it.address).sort(),
      ['areaCode', 'city', 'county', 'fullName', 'house', 'province', 'street', 'text']);
    assert.deepEqual(Object.keys(it.email).sort(), ['domain', 'email', 'local']);
    assert.equal(it.name.givenLength, 2);
    assert.ok(it.address.areaCode.startsWith('32'));
    assert.equal(it.email.domain, 'example.org');
    assert.ok(EMAIL_RE.test(it.email.email));
  }
  assert.equal(new Set(list.map((i) => i.name.name)).size, 10, '三元组里的姓名撞了');
  assert.equal(new Set(list.map((i) => i.address.text)).size, 10, '三元组里的地址撞了');
  assert.equal(new Set(list.map((i) => i.email.email)).size, 10, '三元组里的邮箱撞了');
  assert.throws(() => generateProfiles({ count: 5, areaCode: 110101 }), TypeError,
    'generateProfiles 没把区划键的闸门透给内层');
});

test('G13 四条对外口径：§5.5 原文逐字一致，各自的边界句都在', () => {
  assert.equal(RANDOM_CAVEAT,
    '随机合成，与真实号码重合的概率可忽略；仅供开发与测试用途，不得用于任何真实身份用途。');
  assert.equal(RANDOM_CAVEAT, USE_NOTE, '随机数据的生成提示与身份证面板那句漂移了（§5.5 只有一句）');
  assert.ok(NAME_NOTE.includes('不指向任何真实个人'), '§5.1 那句"明写"没落地');
  assert.ok(NAME_NOTE.includes('自造'), '姓名口径没说明词表来源');
  assert.ok(ADDRESS_NOTE.includes('现行') && ADDRESS_NOTE.includes('不指向真实门牌'));
  assert.ok(EMAIL_NOTE.includes('example.com') && EMAIL_NOTE.includes('RFC 2606'));
  assert.ok(!EMAIL_NOTE.includes('@'), '邮箱口径里不得出现可直接投递的地址');
  for (const [who, s] of [['RANDOM_CAVEAT', RANDOM_CAVEAT], ['NAME_NOTE', NAME_NOTE],
    ['ADDRESS_NOTE', ADDRESS_NOTE], ['EMAIL_NOTE', EMAIL_NOTE]]) {
    assert.ok(typeof s === 'string' && s.length > 10 && !s.includes('<') && !s.includes('&lt;'),
      `${who} 形状不对`);
  }
});

test('G14 同种子必同输出，换种子就该换输出', () => {
  assert.deepEqual(gNames(31), gNames(31));
  assert.deepEqual(gAddr(31), gAddr(31));
  assert.deepEqual(gMails(31), gMails(31));
  assert.notDeepEqual(gNames(31).map((i) => i.name), gNames(32).map((i) => i.name));
  assert.notDeepEqual(gMails(31).map((i) => i.email), gMails(32).map((i) => i.email));
  assert.notDeepEqual(gAddr(31).map((i) => i.text), gAddr(32).map((i) => i.text));
  assert.deepEqual(generateProfiles({ count: 3, rng: seededRandom(41) }),
    generateProfiles({ count: 3, rng: seededRandom(41) }));
});

test('G15 单类与三元组共用同一套闸门：错误文案点的是出事那一格', () => {
  assert.throws(() => generateProfiles({ count: 51 }),
    (e) => e instanceof RangeError && e.message.startsWith('generateProfiles'));
  assert.throws(() => generateProfiles({ count: 5, rng: 'nope' }),
    (e) => e instanceof TypeError && e.message.startsWith('generateNames'),
    '内层出错时点名被外层吞了');
  assert.throws(() => generateProfiles({ count: 5, areaCode: '999999' }),
    (e) => e instanceof RangeError && /没有前缀「999999」/.test(e.message));
  assert.throws(() => generateProfiles({ count: 5, givenLength: 9 }),
    (e) => e instanceof TypeError && e.message.startsWith('generateNames'),
    '内层的 givenLength 闸门被外层吞了');
  assert.throws(() => generateProfiles({ count: 5, provinceCode: '3712' }),
    RangeError, '莱芜（历史市码）当收窄前缀该抛，而不是安静地放开整张表');
  assert.throws(() => generateProfiles({ count: 5, domain: 'qq.com' }),
    (e) => e instanceof RangeError && e.message.startsWith('generateEmails'));
});
```

- [ ] **Step 2: 跑红，确认红的形状**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^not ok|Cannot find module|^# (tests|pass|fail)'; echo "exit=${PIPESTATUS[0]}"
```

Expected：`not ok 1 - scripts/toolkit-tests.mjs` 加一句
`ERR_MODULE_NOT_FOUND: Cannot find module '…/dev/js/tools/random-data.js'`，`# tests 85`、`# pass 84`
（Task 1–3 那批照绿）、`# fail 1`、`exit=` 非 0。红的形状与 §E / §F 当时一致：**整文件挂**，
不是 15 条各挂一次——顶层 `await import` 抛在文件级，这一族口径是既定的。

- [ ] **Step 3: 写 `dev/js/tools/random-data.js`**

```js
/**
 * 随机合成数据：姓名 / 地址 / 邮箱，外加"一次一组"的三元组（设计文档 §5.1 的 `#random`）。
 *
 * **五张字表、三个词族，全部是本站自造的**（姓氏 98 / 名字用字 123 / 街道 24 + 后缀 4 /
 * 邮箱词根 24）：姓氏与名字用字取常见榜的高频子集，街道与邮箱词根是通用词，
 * 都不引第三方姓名库——所以这一格没有新的许可负担（对比 `bank-bin-data.js` / `carrier-data.js`
 * 那两张快照表）。代价是"高频"这个词只能由判据 §G 断到**形状与自洽**（表内不重复、拼出来的
 * 串可解析、每条都在字表乘积里），断不到"覆盖了多少个真实姓氏"。
 *
 * 四条对外口径都固定成导出常量，面板原样显示，别在视图里另写一句：
 * `RANDOM_CAVEAT` 是 §5.5 那句生成类提示的原文（与 `idcard.js` 的 `USE_NOTE` 逐字相同，
 * §G 判这一条相等——两个模块各存一份副本、由判据钉住不漂移，是为了不为了一个字串
 * 给 random-data 加一条指向 idcard 的 import 边），`NAME_NOTE` 明写不指向真实个人，
 * `EMAIL_NOTE` 说明为什么只用 `example.*`（RFC 2606 保留域，投不出去）。
 *
 * 地址的区划一律出自**现行**区划表（§5.4：历史码只许解、不许生成），收窄口径照
 * `idcard.js` 的 `prefixOf`：`areaCode > cityCode > provinceCode`，非字符串与空串一律抛。
 * 与 `idcard.js` / `bankcard.js` / `phone.js` 同一套约定：纯函数、不碰 DOM、入参形状不对就抛。
 */
import { seededRandom } from './random.js';
import { currentCountyCodes, resolveRegion } from './region.js';

/** 单次生成的条数上限，与 `generateIdCards` / `generateBankCards` / `generateMobiles` 同一档 */
export const GENERATE_MAX = 50;
/** §5.5 原文，一字不改；`idcard.js` 的 `USE_NOTE` 是同一句，§G 判两者相等 */
export const RANDOM_CAVEAT =
  '随机合成，与真实号码重合的概率可忽略；仅供开发与测试用途，不得用于任何真实身份用途。';
export const NAME_NOTE =
  '姓氏表与名字用字表是本站自造的高频子集，不引第三方姓名库；随机组合出来的姓名不指向任何真实个人。';
export const ADDRESS_NOTE =
  '地址的行政区划出自现行区划表（历史码只许解、不许生成），街道与门牌是通用词随机拼的，不指向真实门牌。';
export const EMAIL_NOTE =
  '邮箱一律落在 example.com / example.net / example.org——RFC 2606 保留的教学与测试域，'
  + '发给这些地址不会投递到任何真实邮箱。';
/** RFC 2606 保留域，`generateEmails` 的 `domain` 只认这三个 */
export const EMAIL_DOMAINS = ['example.com', 'example.net', 'example.org'];

/**
 * 生成侧的形状契约：`词根[.词根] + 2–4 位数字 + @ + 保留域`。
 * 域名那一半是**从 `EMAIL_DOMAINS` 拼出来的**，不是手抄——手抄的一份会在有人加第四个域时
 * 悄悄跟表脱钩，那时"只落保留域"这条主张就只剩注释在承诺了。
 */
export const EMAIL_RE = new RegExp(
  `^[a-z]{2,16}(?:\\.[a-z]{2,16})?\\d{2,4}@(?:${
    EMAIL_DOMAINS.map((d) => d.replace(/\./g, '\\.')).join('|')})$`);

/** 高频单字姓，98 字（§G-1 判它自身无重复） */
export const SURNAMES = '王李张刘陈杨黄赵吴周徐孙马朱胡郭何林高罗郑梁谢宋唐许韩冯邓曹彭曾肖田董潘袁蔡蒋余杜叶程魏苏吕丁任卢姚沈钟姜崔谭陆范汪廖石金韦贾夏傅方邹熊白孟秦邱侯江尹薛闫雷龙黎史陶贺顾毛郝龚邵万钱严覃武戴莫孔向汤'.split('');
/** 常用名字汉字，123 字（§G-1 同上）。男女混用：分性别建两张表会翻倍体积，而"某字属于哪个性别"本就断不准 */
export const GIVEN_CHARS = '伟芳娜敏静丽强磊洋勇艳杰娟涛明超霞平刚辉力华健俊帅清晨阳旭东西南北秋春夏雨雪云松柏楠梓轩宇涵欣怡悦心宜嘉艺萌蕊彤菲璐瑶琳珊琴书文智仁义礼信忠和善勤俭诚敬新昌盛兴荣富贵康安宁顺吉祥瑞霖泽润源海河湖山野川原森苗荷莲菊兰竹桃梅桂桔柳枫榕苇亮宏博思远达鹏'.split('');
/** 街道通用词 + 后缀，拼成「梧桐大道」这一类不指向真实道路的名 */
export const STREET_WORDS = ['文昌', '滨河', '东湖', '望山', '金桥', '栖霞', '南苑', '北辰',
  '启明', '惠民', '学士', '桃坞', '杏花', '枫林', '青云', '白沙', '朝阳', '永丰', '同心',
  '建新', '曙光', '甘泉', '梧桐', '永安'];
export const STREET_SUFFIXES = ['路', '街', '巷', '大道'];
/** 门牌号上界（1..200），同时是地址组合空间算式里的一格 */
const HOUSE_MAX = 200;
/** 邮箱词根：只用 ASCII 小写字母，避免中文姓名转写（那需要一张拼音表，且转写本身会造出近似真名的串） */
export const EMAIL_WORDS = ['pear', 'harbor', 'meadow', 'cedar', 'cinder', 'willow', 'quill',
  'lantern', 'thicket', 'ripple', 'summit', 'hollow', 'ember', 'frost', 'timber', 'valley',
  'harvest', 'orchard', 'pasture', 'sparrow', 'marlin', 'pilot', 'canyon', 'beacon'];

/** 报错文案里的"收到什么"，与 idcard / bankcard / phone 同档 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}

/** 每次取值都保证落在 [0,1) 的随机源；口径与另三个生成器逐字相同 */
function checkedRng(input, who) {
  if (input === undefined || input === null) return seededRandom(Date.now());
  if (typeof input !== 'function') {
    throw new TypeError(`${who} 的 options.rng 应为 () => number，收到 ${shapeOf(input)}`);
  }
  return () => {
    const v = input();
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1) {
      throw new TypeError(`${who} 的 options.rng 每次应给出 [0, 1) 内的有限数，收到 ${shapeOf(v)}`);
    }
    return v;
  };
}

/** 四个入口共用一条 count 闸门 */
function checkedCount(o, who) {
  const count = o.count === undefined ? 1 : o.count;
  if (!Number.isInteger(count) || count < 1 || count > GENERATE_MAX) {
    throw new RangeError(`${who} 的 options.count 应为 1..${GENERATE_MAX} 的整数，收到 ${shapeOf(o.count)}`);
  }
  return count;
}

/** 取地址收窄前缀：口径逐字照 `idcard.js` 的 `prefixOf`（`null` 不等于"没传"，空串也不等于） */
function prefixOf(o, who) {
  for (const key of ['areaCode', 'cityCode', 'provinceCode']) {
    const v = o[key];
    if (v === undefined) continue;
    if (typeof v !== 'string' || v.trim() === '') {
      throw new TypeError(`${who} 的 options.${key} 应为非空字符串（区划前缀），收到 ${shapeOf(v)}`);
    }
    return v.trim();
  }
  return '';
}

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const digit = (rng) => String(Math.floor(rng() * 10));

/**
 * 一批里不重复地取样。`make()` 返回 `[判重键, 结果]`——**键必须是字符串**：
 * 把对象本身塞进 Map 的话，每一格的引用都不同，"判重"会静默失效，而批内重复只有在
 * 组合空间被压到很小时才看得出来——这一句不能想当然。姓名那族乘积有 1,494,696 格
 * （98 姓 ×（123 单字 + 123² 双字）），看着够稀疏，但单字名只占 35% 权重、摊到 12,054 格上，
 * 每个单字名的概率是双字名的 66 倍，于是 `q = Σpₖ²` 达到均匀值的 15.6 倍，
 * 一批 50 条撞上重复的概率：解析 1.280%、10 万次蒙特卡洛 1.269%，30 条 0.454%（蒙特卡洛 0.436%）。
 * 既然正常随机源下重复不是可忽略的小概率，"判重到底在不在工作"就必须另找杠杆：
 * §G 用一条恒定 rng（`() => 0.5`）把组合空间压成 1 格来验这一族——
 * 判重还在就抛 `RangeError`，判重被摘掉就安静地返回 `count` 条一模一样的结果。
 *
 * 凑不满时**不静默放宽**：「要 50 个不同姓名，实际给了 43 条、7 条是重复的」必须当场报，
 * 而不是让页面数一下才发现。
 * @param {() => [string, object]} make 造一个候选，返回 `[去重键, 结果]`
 * @param {number} want 条数
 * @param {number} capacity 组合空间的格数（三个入口算的都是精确值不是上界，只进报错文案、不参与取样）
 * @param {string} who 报错前缀，点名是哪个入口
 * @returns {object[]} `want` 条互不重复的结果，按首次抽中顺序
 */
function uniqueBatch(make, want, capacity, who) {
  const out = new Map();
  let tries = 0;
  while (out.size < want) {
    if (tries > want * 60 + 600) {
      throw new RangeError(`${who} 要 ${want} 条不重复的结果，只凑到 ${out.size} 条`
        + `（组合空间约 ${capacity}），减一点数量或放宽收窄条件`);
    }
    const [key, item] = make();
    tries += 1;
    if (!out.has(key)) out.set(key, item);
  }
  return [...out.values()];
}

/**
 * 生成随机姓名：`姓 + 1–2 个字`，批内不重复。
 * @param {{count?:number, givenLength?:1|2, rng?:() => number}} [options] `null` / `undefined` 等于没传
 * @throws {TypeError} `givenLength` 不是 1 或 2、`rng` 形状不对
 * @throws {RangeError} `count` 不在 1..50、组合空间凑不满 `count` 条不重复
 * @returns {{name:string,surname:string,given:string,givenLength:number}[]} 一批
 */
export function generateNames(options = {}) {
  const o = options ?? {};
  const rng = checkedRng(o.rng, 'generateNames');
  const count = checkedCount(o, 'generateNames');
  let givenLength = null;
  if (o.givenLength !== undefined && o.givenLength !== null) {
    if (o.givenLength !== 1 && o.givenLength !== 2) {
      throw new TypeError(`generateNames 的 options.givenLength 只能是 1 或 2，收到 ${shapeOf(o.givenLength)}`);
    }
    givenLength = o.givenLength;
  }
  const cap = SURNAMES.length * (GIVEN_CHARS.length + GIVEN_CHARS.length ** 2);
  return uniqueBatch(() => {
    const surname = pick(SURNAMES, rng);
    const n = givenLength ?? (rng() < 0.35 ? 1 : 2);
    let given = '';
    for (let i = 0; i < n; i += 1) given += pick(GIVEN_CHARS, rng);
    const item = { name: surname + given, surname, given, givenLength: given.length };
    // 自检：姓名串必须正好是"表内姓 + givenLength 个表内字"，否则就是词表或拼接坏了
    if (!SURNAMES.includes(item.surname) || item.name !== item.surname + item.given
      || item.given.split('').some((c) => !GIVEN_CHARS.includes(c))
      || item.givenLength !== n) {
      throw new Error(`内部不变量：造出的「${item.name}」不在姓氏表 × 字表的乘积里`);
    }
    return [item.name, item];
  }, count, cap, 'generateNames');
}

/**
 * 生成随机地址：现行区划全名 + 随机街道 + 随机门牌号，批内不重复（判重键是整串 `text`）。
 *
 * 每条生成后立刻 `resolveRegion(areaCode)` 复检：必须是 `current` 且 `level === 'county'`。
 * 这一格不是走过场——`currentCountyCodes(prefix)` 一旦把市级 / 省级码混进候选，
 * 拼出来的地址就没有县名，而面板上那句"××省××市××区"会静默少一段。
 *
 * @param {{count?:number, areaCode?:string, cityCode?:string, provinceCode?:string,
 *   rng?:() => number}} [options] 三个区划键只认传了的那一个，优先级 `areaCode > cityCode > provinceCode`
 * @throws {TypeError} 区划键不是非空字符串、`rng` 形状不对
 * @throws {RangeError} `count` 不在 1..50、前缀在现行表里挑不出任何县码、凑不满不重复的一批
 * @returns {{text:string,areaCode:string,province:string,city:string,county:string,
 *   fullName:string,street:string,house:string}[]} 一批
 */
export function generateAddresses(options = {}) {
  const o = options ?? {};
  const rng = checkedRng(o.rng, 'generateAddresses');
  const count = checkedCount(o, 'generateAddresses');
  const prefix = prefixOf(o, 'generateAddresses');
  const pool = currentCountyCodes(prefix);
  if (pool.length === 0) {
    throw new RangeError(`现行区划表里没有前缀「${prefix}」下的县码，换一个省 / 市 / 县码`);
  }
  const cap = pool.length * STREET_WORDS.length * STREET_SUFFIXES.length * HOUSE_MAX;
  return uniqueBatch(() => {
    const areaCode = pick(pool, rng);
    const region = resolveRegion(areaCode);
    if (region.status !== 'current' || region.level !== 'county') {
      throw new Error(`内部不变量：${areaCode} 不是现行县级码（status=${region.status} level=${region.level}）`);
    }
    const street = `${pick(STREET_WORDS, rng)}${pick(STREET_SUFFIXES, rng)}`;
    const house = `${1 + Math.floor(rng() * HOUSE_MAX)}号`;
    const item = {
      text: `${region.fullName}${street}${house}`,
      areaCode, province: region.province, city: region.city, county: region.county,
      fullName: region.fullName, street, house,
    };
    if (!item.text.startsWith(item.fullName)) {
      throw new Error(`内部不变量：「${item.text}」不是以区划全名开头的`);
    }
    return [item.text, item];
  }, count, cap, 'generateAddresses');
}

/**
 * 生成随机邮箱：`词根[.词根]数字@example.{com,net,org}`，批内不重复。
 * 不做中文姓名转写（那需要一张拼音表，而转写出来的串更容易撞真名），local 只用 ASCII 小写。
 *
 * @param {{count?:number, domain?:string, rng?:() => number}} [options]
 * @throws {TypeError} `domain` 不是非空字符串、`rng` 形状不对
 * @throws {RangeError} `count` 不在 1..50、`domain` 不在那三个保留域里、凑不满不重复的一批
 * @returns {{email:string,local:string,domain:string}[]} 一批
 */
export function generateEmails(options = {}) {
  const o = options ?? {};
  const rng = checkedRng(o.rng, 'generateEmails');
  const count = checkedCount(o, 'generateEmails');
  let domain = null;
  if (o.domain !== undefined && o.domain !== null) {
    if (typeof o.domain !== 'string' || o.domain.trim() === '') {
      throw new TypeError(`generateEmails 的 options.domain 应为非空字符串，收到 ${shapeOf(o.domain)}`);
    }
    domain = o.domain.trim().toLowerCase();
    if (!EMAIL_DOMAINS.includes(domain)) {
      throw new RangeError(
        `generateEmails 的 options.domain（${domain}）不在保留域 ${EMAIL_DOMAINS.join(' / ')} 里`);
    }
  }
  const n = EMAIL_WORDS.length;
  // 数字尾巴是 2 / 3 / 4 位、每位 0..9，**前导零合法**（`pear007` 过 `EMAIL_RE`，实测这类串
  // 占 60000 次抽样的 10.1%），所以空间是 10²+10³+10⁴ = 11100 而不是"10..9999 共 9990 个整数"。
  // 域名那一格跟着 `domain` 走：钉死一个域时可选格数只有三之一，报错文案不该报三倍的数。
  const tailSpace = 10 ** 2 + 10 ** 3 + 10 ** 4;
  const cap = (domain ? 1 : EMAIL_DOMAINS.length) * (n + n * n) * tailSpace;
  return uniqueBatch(() => {
    const a = pick(EMAIL_WORDS, rng);
    const stem = rng() < 0.5 ? a : `${a}.${pick(EMAIL_WORDS, rng)}`;
    let tail = '';
    const digits = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < digits; i += 1) tail += digit(rng);
    const local = `${stem}${tail}`;
    const host = domain ?? pick(EMAIL_DOMAINS, rng);
    const email = `${local}@${host}`;
    // 两道闸：形状必须过 EMAIL_RE（这一条判据也独立断），长度必须留在 32 之内
    // （表内最长词 7，实际最长按 7+1+7+4 = 19 算，32 是给"以后有人往词表里加长词"留的边界）
    if (!EMAIL_RE.test(email) || local.length > 32) {
      throw new Error(`内部不变量：拼出的 ${email} 不合邮箱语法（local 长度 ${local.length}）`);
    }
    return [email, { email, local, domain: host }];
  }, count, cap, 'generateEmails');
}

/**
 * 一次一组（§5.1 的"单类或一次一组"）：姓名 + 地址 + 邮箱各一条，条与条之间对齐。
 *
 * **刻意不把身份证号码挂进来**：`#idcard` 那一格有自己的区划、性别、年龄段收窄，
 * 把两边耦合成"一个完整假人"要多出一套交叉口径（地址县码必须能生成号码、生日必须与
 * 年龄段一致），而这几类的免责口径本来就是各说各话的（§5.5）。要一组带号码的，
 * 在页面上两个面板各点一次，比在数据层造一个"看起来像真人"的对象更诚实。
 *
 * 三个单类生成器各自 `checkedRng`，所以出错时点名的是**它自己**（`generateAddresses 的 …`），
 * 不是 `generateProfiles`——这一族嵌套是有意的：报的是哪一格坏，而不是从哪一格进来的。
 *
 * @param {{count?:number, areaCode?:string, cityCode?:string, provinceCode?:string,
 *   domain?:string, givenLength?:1|2, rng?:() => number}} [options]
 * @returns {{name:object,address:object,email:object}[]} 一批，`name` / `address` / `email`
 *   的形状与上面三个单类生成器逐字段一致
 */
export function generateProfiles(options = {}) {
  const o = options ?? {};
  const count = checkedCount(o, 'generateProfiles');
  const names = generateNames(o);
  const addresses = generateAddresses(o);
  const emails = generateEmails(o);
  if (names.length !== count || addresses.length !== count || emails.length !== count) {
    throw new Error(`内部不变量：三类条数没对齐（${names.length}/${addresses.length}/${emails.length} ≠ ${count}）`);
  }
  return names.map((name, i) => ({ name, address: addresses[i], email: emails[i] }));
}
```

- [ ] **Step 4: 跑绿**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^# (tests|pass|fail)'; echo "exit=${PIPESTATUS[0]}"
node --check dev/js/tools/random-data.js
wc -l dev/js/tools/random-data.js
```

Expected：`# tests 99`、`# pass 99`、`# fail 0`、`exit=0`（41 + 5 + 23 + 15 + 15），`wc -l` 290 行左右。

- [ ] **Step 5: 自证这 15 条有牙（二十处变异，逐处记下红了谁）**

```bash
mkdir -p /tmp/t4mut && cd /Users/liaolongdong/code/liaolongdong.github.io
cat > /tmp/t4mut/mut.mjs <<'EOF'
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
const REPO = '/Users/liaolongdong/code/liaolongdong.github.io';
const TREE = '/tmp/t4mut/tree';
const P = path.join(TREE, 'dev/js/tools/random-data.js');
const CMD = 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs';
/** 本轮落地面。只有这些路径被实验改动才算"台账作废"；别的一律归因给并行会话并如实列出，
 *  不静默放过，也不因为别人在写自己的文件就把自己的证据判死。 */
const MINE = new Set(['dev/js/tools/random-data.js', 'scripts/toolkit-tests.mjs',
  'scripts/verify-plan-blocks.mjs', 'scripts/verify-plan-blocks-teeth.mjs']);
const digest = (rel) => {
  const abs = path.join(REPO, rel);
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return 'skip';   // 未跟踪目录整条记账不哈希
  return crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex').slice(0, 16);
};
const fingerprint = () => {
  const lines = execSync('git status --porcelain', { cwd: REPO, encoding: 'utf8' })
    .split('\n').filter(Boolean).sort();
  return { lines, map: new Map(lines.map((l) => [l.slice(3).trim(), digest(l.slice(3).trim())])) };
};
const before = fingerprint();
fs.rmSync(TREE, { recursive: true, force: true });
// 真复制，不用 `cp -al`：硬链接的"影子副本"改一处两处同时变，量出来的全是假证据。
// 变异一律落在副本里——本仓随时可能有第二条会话在同一个 worktree 上 `git add`。
for (const d of ['dev/js', 'scripts', 'demo']) fs.cpSync(path.join(REPO, d), path.join(TREE, d), { recursive: true });
fs.copyFileSync(path.join(REPO, 'package.json'), path.join(TREE, 'package.json'));
const orig = fs.readFileSync(P, 'utf8');
/** 未变异先跑一次：拿它的 `# tests` 总数当尺子，好把"脚手架其实没跑到测试"和"这处不可达"分开 */
function run() {
  let out = '';
  try { out = execSync(`${CMD} 2>&1`, { encoding: 'utf8', cwd: TREE }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  return {
    out,
    total: Number((out.match(/^# tests (\d+)/m) || [])[1] ?? -1),
    pass: Number((out.match(/^# pass (\d+)/m) || [])[1] ?? -1),
    reds: [...out.matchAll(/^not ok \d+ - ([A-Z]\d+)\b/gm)].map((m) => m[1]),
  };
}
// 红名单从落地那轮的 `(G\d+)` 放宽成 `([A-Z]\d+)`：09-27 复跑时 §G 的两把大刀跨节红到 H4 / H15，
// 只数 G 的话"红名单长度 = 总数 − pass"这条自检就对不上，而那条自检正是用来分辨"真不可达"与
// "脚手架没跑到"的那把尺子。放宽之后二十二行全部对上，见下表下面那三条。
const base = run();
if (base.total < 0 || base.reds.length > 0) {
  console.log(base.out.split('\n').slice(-40).join('\n'));
  throw new Error(`基线就不对（# tests ${base.total}、红 ${base.reds.length} 条），先让全量跑绿再谈牙齿`);
}
console.log(`基线 # tests ${base.total} 全绿（副本 ${TREE}）`);
const MUTS = [
  ['M1 批内判重失效（键换成 tries）', 'if (!out.has(key)) out.set(key, item);', 'out.set(tries, item);'],
  ['M2 姓氏表末位换成表内已有的字', "孔向汤'", "孔向王'"],
  ['M3 凑不满时报错类型从 RangeError 换成 TypeError', 'throw new RangeError(`${who} 要 ${want} 条不重复的结果', 'throw new TypeError(`${who} 要 ${want} 条不重复的结果'],
  ['M4 prefixOf 放行数值前缀', "if (typeof v !== 'string' || v.trim() === '') {", "if (String(v).trim() === '') {"],
  ['M5 prefixOf 把空串当成没传', "typeof v !== 'string' || v.trim() === ''", "typeof v !== 'string'"],
  ['M6 三键优先级反过来', "['areaCode', 'cityCode', 'provinceCode']", "['provinceCode', 'cityCode', 'areaCode']"],
  ['M7 地址的现行县码自检摘掉', "if (region.status !== 'current' || region.level !== 'county') {", 'if (false) {'],
  ['M8 县码恒取 pool[0]', 'const areaCode = pick(pool, rng);', 'const areaCode = pool[0];'],
  ['M9 EMAIL_RE 的域名不转义点号', "d.replace(/\\./g, '\\\\.')", 'd'],
  ['M10 保留域表长出第四个域', "export const EMAIL_DOMAINS = ['example.com', 'example.net', 'example.org'];", "export const EMAIL_DOMAINS = ['example.com', 'example.net', 'example.org', 'qq.com'];"],
  ['M11 domain 的保留域闸门摘掉', 'if (!EMAIL_DOMAINS.includes(domain)) {', 'if (false) {'],
  ['M12 尾数放宽成 1–4 位', 'const digits = 2 + Math.floor(rng() * 3);', 'const digits = 1 + Math.floor(rng() * 4);'],
  ['M13 givenLength 用松比较放行字符串', "if (o.givenLength !== 1 && o.givenLength !== 2) {", 'if (o.givenLength != 1 && o.givenLength != 2) {'],
  ['M14 默认档位恒取 2', 'const n = givenLength ?? (rng() < 0.35 ? 1 : 2);', 'const n = givenLength ?? 2;'],
  ['M15 §5.5 那句生成提示改一个标点', "不得用于任何真实身份用途。';", "不得用于任何真实身份用途！';"],
  ['M16 count 上限放宽到 500', 'count < 1 || count > GENERATE_MAX', 'count < 1 || count > 500'],
  ['M17 rng 取值范围闸门摘掉', "if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1) {", "if (typeof v !== 'number') {"],
  ['M18 门牌号上界 200 改成 999', 'const HOUSE_MAX = 200;', 'const HOUSE_MAX = 999;'],
  ['M19 整串地址把街道拼在全名之前', 'text: `${region.fullName}${street}${house}`', 'text: `${street}${region.fullName}${house}`'],
  ['M20 RANDOM_CAVEAT 与 §5.5 脱钩', "export const RANDOM_CAVEAT =\n  '随机合成，与真实号码重合的概率可忽略；仅供开发与测试用途，不得用于任何真实身份用途。';", "export const RANDOM_CAVEAT = '姓氏表与名字用字表是本站自造的高频子集。';"],
  // ↓ 2026-09-27 复核整改加的两刀：一把记"判据够不着哪儿"，一把给新档位自证有牙
  ['M21 邮箱尾巴空间写回 9990（只进报错文案）', 'const tailSpace = 10 ** 2 + 10 ** 3 + 10 ** 4;', 'const tailSpace = 9990;'],
  ['M22 checkedRng 把 null 当坏值', 'if (input === undefined || input === null) return seededRandom(Date.now());', 'if (input === undefined) return seededRandom(Date.now());'],
  ['M23 EMAIL_RE 把前导零判死', '(?:\\\\.[a-z]{2,16})?\\\\d{2,4}@', '(?:\\\\.[a-z]{2,16})?[1-9]\\\\d{1,3}@'],
];

for (const [name, a, b] of MUTS) {
  const hits = orig.split(a).length - 1;
  if (hits !== 1) { console.log(`!! ${name} 锚点命中 ${hits} 处（要恰好 1 处），这一档不算证据`); continue; }
  const text = orig.replace(a, b);
  if (text === orig) { console.log(`!! ${name} 替换后一字未变，脚手架在骗人`); continue; }
  fs.writeFileSync(P, text);
  if (fs.readFileSync(P, 'utf8') !== text) { console.log(`!! ${name} 写完读回来不一样，文件系统在骗人`); continue; }
  const r = run();
  if (r.total !== base.total) { console.log(`!! ${name} 只跑到 ${r.total} 条（基线 ${base.total}），这一档不算证据`); continue; }
  console.log(`${name} → ${r.reds.length ? [...new Set(r.reds)].join(' ') : '全绿（不可达，见计划说明）'}（pass ${r.pass}/${r.total}）`);
}
fs.writeFileSync(P, orig);
const after = run();
console.log(`还原后：# tests ${after.total}、pass ${after.pass}、红 ${after.reds.length ? after.reds.join(' ') : '无'}`);
console.log(`副本与工作树逐字节一致=${fs.readFileSync(P, 'utf8') === fs.readFileSync(path.join(REPO, 'dev/js/tools/random-data.js'), 'utf8')}`);
const after2 = fingerprint();
const diffs = [...before.map.entries()].filter(([k, v]) => after2.map.get(k) !== v);
const mine = diffs.filter(([k]) => MINE.has(k));
console.log(`脏项 ${before.map.size} → ${after2.map.size}；清单变化=${before.lines.join('\n') !== after2.lines.join('\n')}；内容变过 ${diffs.length} 个`);
for (const [k] of diffs) console.log(`  · ${MINE.has(k) ? '★我的' : '  别人的'} ${k}: ${before.map.get(k)} → ${after2.map.get(k) ?? '(消失)'}`);
if (before.lines.join('\n') !== after2.lines.join('\n') || mine.length) throw new Error('工作树被这些实验碰过，台账作废');
console.log('✓ 落地面（那四个路径）在实验前后一字未动；变化的都是并行会话的文件，未被本实验读写');
EOF
node /tmp/t4mut/mut.mjs
git status --porcelain -- dev/js/tools/random-data.js scripts/toolkit-tests.mjs   # 实验不该溢出到工作树
```

脚本里那些锚点与替换串**全部是模块落地的原文**（`from` 命中数不是恰好 1 就打印 `!!` 并跳过，
跳过的那些不算证据）。这张表跑过三趟，前两趟的**尺子不一样长**，所以红名单也不一样，逐趟写清：

- **落地那趟（2026-09-27，`/tmp/t4mut/tree`，全量 99 条，二十刀）**：单红 98/99、双红 97/99、
  M12 掉线 4、M19 掉线 6，红名单逐行即下表落地时的样子。那一版的 `reds` 只抓 `G\d+`。
- **复核整改这趟（同日，`/tmp/t4fix/tree`，全量 114 条，二十三刀）**：`reds` 放宽成抓任意节
  （上面脚本里那句注释写的就是这件事），权威日志 `/tmp/t4fix/ledger3.log`（`ledger.log` /
  `ledger2.log` 是同一格的两次前置跑，只到二十二刀）。单红 113/114、双红 112/114、M12 与 M23
  各掉线 7、M19 掉线 9。**二十三行全部满足"红名单长度 = 114 − pass"**——这一格现在由脚本自己比对、
  不匹配就打 `!!`，那一趟一行 `!!` 都没冒。
- **纯注释改动的复跑（同日深夜，同一副本树，`/tmp/t4fix/ledger4.log`）**：把 `uniqueBatch` 那句
  概率主张改成可复算的三位小数（**只动注释，一行代码没动**）之后，二十三刀全量重跑一遍：
  **二十三条红名单与 `ledger3.log` 逐字相同**，一行 `!!` 都没有，还原后 114 全绿、副本与工作树
  逐字节一致、脏指纹前后一致。也就是说这一轮改的是"说法"，没有碰任何一根牙齿。
- 与落地那趟对得上，只有三处多出名字来，其中两处是结构性的、一处是随机性的：
  §G 的两把大刀现在跨节红到 **H4 / H15**（落地那轮 §H 还不存在，99 条；§H 的深样本那格
  `await import('./dev/js/tools/random-data.js')` 真跑生成器）；**G7 在 M12 / M23 下时红时不红**，
  因为它这一轮新加的 `rng: null` 四句走 `seededRandom(Date.now())`，一批里抽没抽到那位数字说了算
  ——磁盘上四份全量日志（`/tmp/t4fix/ledger.log`…`ledger4.log`）里，M12 的 G7 是"第一份不红、
  后三份红"，M23 只在后两份里出现过、两份都红；两种情况下"长度 = 掉线"都成立。
  （第一份那趟的掉线数与红名单长度对不上，正是它漏抓了 H4 / H15——`reds` 放宽之后才自愈。）
  M19 下的 G7 是稳红的（`text` 一拼坏就撞内部不变量，与随机源无关）。

复跑还抓出一处**只属于脚手架的假红**：探针副本 `cpSync` 时漏了 `demo/`，B14（跑
`build-id-fixture.mjs`，它 `require` 的是 `demo/idCardDemo/lib/GB2260.js`）就在每一刀都红一次；
补上 `demo` 之后连跑两次基线全绿、红名单才可信。**红名单里冒出与本轮改动无关的节，先怀疑副本树形状，
再怀疑代码**。（§A–§F 没有一处 `import` `random-data.js`，所以全量与单跑本该一致，真不一致就按 `!!` 那两档先查脚手架）：

| 变异 | 红了谁 | 说明 |
| --- | --- | --- |
| M1 批内判重失效（键换成 `tries`） | **只 G5 红** | 压空间那三句独占；正常随机源下这一档量不出来（口径 4） |
| M2 姓氏表末位换成表内已有的字 | **只 G1 红** | "表内不重复"只能由词表判据守 |
| M3 凑不满时报错类型从 RangeError 换成 TypeError | **只 G5 红** | 报错形状只有这一格在判 |
| M4 `prefixOf` 放行数值前缀 | **只 G10 红** | 与 §B 的 B10 同一族，两处各钉一次 |
| M5 `prefixOf` 把空串当成没传 | **只 G10 红** | "收窄到空"与"没收窄"混起来就是放开整张表 |
| M6 三键优先级反过来 | **只 G9 红** | 三键同时给那一条独占 |
| M7 地址的现行县码自检摘掉 | **全绿** | 见下 |
| M8 县码恒取 `pool[0]` | **只 G8 红** | 口径 4 末尾那句"多样性"就是为它写的 |
| M9 `EMAIL_RE` 的域名不转义点号 | **只 G2 红** | `example!com` 蒙混过关，G2 那两个负例抓住 |
| M10 保留域表长出第四个域 | G2 G15 | 域表形状 + profiles 的 domain 透传 |
| M11 `domain` 的保留域闸门摘掉 | G11 G15 | 传 `gmail.com` 不再 RangeError |
| M12 尾数放宽成 1–4 位 | G5 G11 G12 G14 + H4 H15（**G7 抖动**） | 一位尾数被 `EMAIL_RE` 的内部自检拦住，四个调用点一起红——这一档顺便证明那句自检有牙；H4 / H15 是 §H 那两格真跑了 `generateProfiles`，跨节连带（09-27 复跑才看得见，落地那轮全量只有 99 条、§H 还不存在）。**G7 是本轮新引进的不确定源**：它新增的 `rng: null` 那四句走 `seededRandom(Date.now())`，一批里抽没抽到一位尾数决定它红不红，连跑五次三次红（掉线 7）、两次不红（掉线 6）——红名单长度仍等于掉线数 |
| M13 `givenLength` 用松比较放行 `'1'` | **只 G4 红** | 类型错退化成"看着能用" |
| M14 默认档位恒取 2 | **只 G4 红** | "1–2 字"那句只有 G4 判 |
| M15 §5.5 那句改一个标点 | **只 G13 红** | 逐字相等 |
| M16 `count` 上限放宽到 500 | G6 G15 | 上限同档那句 + 边界向量 |
| M17 rng 取值范围闸门摘掉 | **只 G7 红** | 独占 |
| M18 门牌号上界 200 → 999 | **只 G8 红** | `house` 正则独占 |
| M19 整串把街道拼在全名之前 | G5 G7 G8 G9 G12 G14 G15 + H4 H15 | `text` 是判重键，动它就全线红；G7 是 09-27 整改后新加进红名单的（那一档新增的 `rng: null` 循环会真跑一遍 `generateAddresses`，内部不变量当场抛）；H4 / H15 同 M12 |
| M20 `RANDOM_CAVEAT` 与 §5.5 脱钩 | **只 G13 红** | 副本漂移只有文案判据守得住 |
| M21 邮箱尾巴空间写回 9990 | **全绿** | 本轮新增，专门把"判据够不着哪儿"记下来：`cap` 只进"凑不满"那句报错文案，正常随机源下邮箱空间一辈子撞不到底，所以没有任何判据能断出这个数**算得对不对**。G11 退一步钉的是它的前提——`EMAIL_RE` 收得下前导零尾巴（`harvest0054@example.com` 那一断）、且 240 条抽样里真出现过。前提在，11100 才立得住 |
| M22 `checkedRng` 把 `null` 当坏值 | **只 G7 红** | 本轮新增，给新加的那一档自证有牙：只判 `undefined` 之后，四个入口的 `rng: null` 全抛 `TypeError`，红集中在 G7——`domain: null`（G11）与 `givenLength: null`（G4）走的是各自的键，不共用这条闸门 |
| M23 `EMAIL_RE` 把前导零判死（`\d{2,4}` → `[1-9]\d{1,3}`） | G5 G11 G12 G14 + H4 H15（**G7 抖动**，同 M12） | 本轮新增，把 M21 那句"退一步钉前提"验到底：前提一改，红的**不止** G11——模块自己的内部不变量 `!EMAIL_RE.test(email)` 一抽到前导零就抛，于是五个调用点连带跨节的 H4 / H15 一起塌。G11 是这里头唯一**不依赖抽样运气**的一条（那句直接断言必红），所以它才是这一格真正的锚；剩下的红是副产品，别拿"红了一片"当强度。G7 同 M12 走时间种子，实跑里这一次红了（掉线 7）、上一次没红（掉线 6） |

**M7 全绿不是判据没牙，是那一格在今天的数据下不可达**：`pool` 整份来自
`currentCountyCodes(prefix)`，它按 §C 那批判据只给现行县级码，所以生成侧那句
`region.status !== 'current' || region.level !== 'county'` 在今天造不出触发条件（与 Task 2 的 M7、
Task 3 的 M11 同一件事，三处都按"不可达"读，不许读成"覆盖了"）。同一件事从**测试侧**是判到的：
G8 对每条结果独立跑一遍 `resolveRegion(areaCode)` 并断 `status === 'current' && level === 'county'`
——那是与模块内那半句不同的条件，所以不循环。留着内部不变量的理由也和前两处相同：
`currentCountyCodes` 一旦放宽（比如未来给历史码开一条候选边），只有那一格能当场报。

- [ ] **Step 6: 记一次耗时（Task 10 的性能口径要用）**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
for i in 1 2 3 4 5 6 7; do node --input-type=module -e "
const t0 = performance.now(); const m = await import('./dev/js/tools/random-data.js');
console.log('import random-data.js', (performance.now() - t0).toFixed(1) + 'ms');
"; done
node --input-type=module -e "
await import('./dev/js/tools/region.js');                 // 先把依赖跑热
const t0 = performance.now(); await import('./dev/js/tools/random-data.js');
console.log('依赖已热时 random-data.js 自身求值 =', (performance.now() - t0).toFixed(2) + 'ms');
const m = await import('./dev/js/tools/random-data.js');
const { seededRandom } = await import('./dev/js/tools/random.js');
const bench = (fn, n) => {
  for (let k = 0; k < 500; k += 1) fn(k);                  // 预热，不然量到的是 JIT 爬坡
  const s = performance.now();
  for (let k = 0; k < n; k += 1) fn(k);
  return ((performance.now() - s) / n * 1000).toFixed(1) + 'µs/批(20 条)';
};
console.log('generateNames   ', bench((k) => m.generateNames({ count: 20, rng: seededRandom(k) }), 2000));
console.log('generateAddresses', bench((k) => m.generateAddresses({ count: 20, rng: seededRandom(k) }), 2000));
console.log('generateEmails  ', bench((k) => m.generateEmails({ count: 20, rng: seededRandom(k) }), 2000));
console.log('generateProfiles', bench((k) => m.generateProfiles({ count: 20, rng: seededRandom(k) }), 1000));
let g0 = performance.now(); for (let i = 0; i < 50; i += 1) m.generateAddresses({ count: 50 });
console.log('不收窄满批 generateAddresses(50) =', ((performance.now() - g0) / 50).toFixed(2) + 'ms/批');
"
wc -c dev/js/tools/random-data.js
gzip -6 -c dev/js/tools/random-data.js | wc -c
```

2026-09-26 在镜像上量过一轮，**2026-09-27 文件落地后在工作树重测**（七个冷进程各一次 +
三轮基准，每轮 500 次预热）。两边都记下来，因为**同一格两次差到一倍以上**：

| 量 | 09-26 镜像 | 09-27 落地后 |
| --- | --- | --- |
| `import random-data.js`（冷进程） | 38–49ms | **14.3–27.1ms** |
| 依赖已热时本模块自身求值 | 2.6–4.2ms | **1.82–2.00ms** |
| `generateNames`(20) | 26–30µs | **17.0–18.8µs** |
| `generateAddresses`(20) | 40–56µs | **25.2–42.0µs** |
| `generateEmails`(20) | 21–25µs | **13.0–14.7µs** |
| `generateProfiles`(20) | 97–133µs | **71.9–89.6µs** |
| 不收窄满批 `generateAddresses(50)` | 0.19ms | **0.06–0.14ms** |
| §G 十五条逐条 `duration_ms` 求和 | 41–52ms | **30.4–37.4ms**（其中 G5 **10.7–12.9ms**） |

**这一整片的下移我没有归因**，两个候选证据都不足：镜像那一轮跑在 `/tmp/t7`、这一轮跑在工作树，
期间另一路会话一直在改 sass/html 与自己的 `scripts/article-check.mjs`（谁在抢 CPU 说不清）；
而两次都是本机同一份 Node 22（`node -v` 未变）。所以能立住的只有**结构与量级**，不是任何点值：

- 冷 `import` 那个数**不能当这一格的开销用**：`random-data.js` 把 `region.js` 拽了进来，
  而 `region-data.js` 单文件 100,020 字节。依赖先跑热之后本模块自身只求值 **约 2ms**，
  证件页上 `idcard.js` 本来就要 `region.js`，所以它对首屏的边际成本是"那 2–3ms 上下"，
  不是二三十毫秒——**两次测量在这条结论上一致，这条才是 Task 10 要用的**。
- 生成侧全部在**几十微秒 / 20 条**这一档，满批（50 条）不到 0.2ms：面板点一次"生成"
  离 perceptible 还差两个数量级。Task 10 要判的是"有没有冒出 10ms 以上"，别拿上面任何一个点当阈值。
- 没预热那 500 次就量到的是 JIT 爬坡（Task 3 实测过高一个数量级）；进程总时里大头是 node 启动与
  `region-data.js` 的解析，同样别拿它做阈值。

Expected（**2026-09-27 复核整改后重测**，`/tmp/t4/measure.sh`；同一晚把 `uniqueBatch` 那句概率主张
改成可复算的三位小数后又量了一遍，下面这组数是改完之后）：`wc -c` **17,638 字节 / 299 行**，
`cat 文件 | gzip -9 -c | wc -c` **7,821**，`gzip -9 -c 文件 | wc -c` **7,836**，
`gzip -6 -c 文件 | wc -c` **7,837**（后两种带 FNAME 头、各多 15/16 字节，且 -6 与 -9 这一档差 1 字节，
别拿一个的数去对另一个）。落地时刻（`bbb78ad`，290 行）的数是 16,581 / 7,226 / 7,242，
本轮的 +1,057 字节原文、+595 字节 gzip 全部花在"把两句说歪的主张改对"上——**模块里一条判据没加、
没删**（§G 仍是 15 条测试、全量基线仍是 114；这一轮新增的三处判据都在 `toolkit-tests.mjs` 那边，
见 Step 5 的 G6 / G7 / G11）。
产物口径（terser 之后）到 Task 9 的收录面一起量，那里才有 `toolIdcard.min.js` 的真数。
**下面这两格 09-27 重测后改写了口径**，因为原写法复算不出来：

```bash
node -e "const fs=require('fs');const L=fs.readFileSync('dev/js/tools/random-data.js','utf8').split('\n');
const B=(s)=>Buffer.byteLength(s,'utf8');let cl=0,cb=0;
for(const l of L){const s=l.trim();if(s.startsWith('//')||s.startsWith('/*')||s.startsWith('*')){cl++;cb+=B(l)+1;}}
console.log('整行注释',cl,'行 /',cb,'字节 / 占',(cb*100/B(L.join('\n'))).toFixed(1)+'%');
let dr=0,db=0,cr=0,cb2=0;
for(const n of ['SURNAMES','GIVEN_CHARS','STREET_WORDS','STREET_SUFFIXES','EMAIL_WORDS']){
  const d=L.findIndex((l)=>l.startsWith('export const '+n));let e=d;
  while(e<L.length-1&&!L[e].trim().endsWith(';')&&!L[e].trim().endsWith('];'))e++;
  const span=L.slice(d,e+1);dr+=span.length;db+=B(span.join('\n'));
  let c=d-1;const hdr=[];while(c>=0&&/^(\s*\/\*\*|\s*\*|\s*\/\$)/.test(L[c])){hdr.unshift(L[c]);c--;}
  cr+=hdr.length+span.length;cb2+=B([...hdr,...span].join('\n'));}
console.log('五张词表声明',dr,'行 /',db+'B','｜含随行注释',cr,'行 /',cb2+'B');"
```

- 词表：五张表（`SURNAMES` / `GIVEN_CHARS` / `STREET_WORDS` / `STREET_SUFFIXES` / `EMAIL_WORDS`）
  的**声明本身 9 行 / 1,347 字节**，各带一行随行注释后是 **13 行 / 1,812 字节**。
  （原写法"四张词表那 10 行连随行注释 1,435 字节"在两种数法下都落不到，按上面这个口径判。）
- 整行注释：**107 行 / 8,527 字节 / 占 48.3%**（含每行换行；`bbb78ad` 落地时是 99 行 / 7,539 字节 /
  45.5%，而更早一版记的 7,538 是不含末行换行的数，差的就是那 1 字节）。这一格的账与 `bankcard.js`
  相反——大头不是数据，是"为什么这么判"；本轮 +8 行注释正是这一格在长。

- [ ] **Step 7: 提交**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
git status --porcelain
git add dev/js/tools/random-data.js scripts/toolkit-tests.mjs
git commit -m "$(cat <<'EOF'
feat(tools): 随机合成数据——姓名 / 地址 / 邮箱与一次一组

五张字表、三个自造词族（姓氏 98 / 用字 123 / 街道 24 + 后缀 4 / 邮箱词根 24），
判据只断形状与自洽、不声称覆盖率；地址只出现行县级码，收窄三键照
idcard.js 的 prefixOf 同族闸门（null 与空串都抛，不静默放开整张表）。
批内不重复靠恒定随机源压出探针，"30 条不撞重"本身不算证据。
generateProfiles 刻意不挂身份证号：§5.1 只点三类，免责口径各说各话。
邮箱一律落 RFC 2606 保留域，EMAIL_RE 的域名一半从 EMAIL_DOMAINS 拼出来。
EOF
)"
git status --porcelain | head
```

Expected：**真实落地是三条路径**（`bbb78ad`：`random-data.js`、`toolkit-tests.mjs`、
`verify-plan-blocks.mjs` 的 `FILE_TARGETS` 一行）。第三条是门禁自己的规则而不是可选动作——
整文件镜像不登记，反查那一档报 `✗ 漏网镜像` 并退 1。剩下仍是对方那批未提交项。
`_docs/superpowers/plans/` 里这份计划按 Task 11 的收口节奏单独提。

> **`bbb78ad` 的提交说明里有两处主张已被 2026-09-27 复核整改改掉，别照抄**：它写「三张词表」
> （实为五张字表 / 三个词族，`STREET_SUFFIXES` 那 4 个后缀漏了计数），又写「姓名组合空间
> 1,494,696 格、撞重概率 2.9e-4」（均匀口径，按 `q = Σpₖ²` 重算 30 条是 0.454%、50 条 1.280%，
> 见上面第 4 条那张表）。历史提交不动，以这一格与磁盘上的 JSDoc 为准。

## Task 5: `view.js` — 结果对象 → HTML（视图层，零 import）

**Files:**
- Create: `dev/js/tools/view.js`
- Modify: `scripts/toolkit-tests.mjs`（追加 §H，15 条）
- Modify: `scripts/verify-plan-blocks.mjs`（`FILE_TARGETS` 加一行；不登记会被反查那一档退 1）

这一格是设计文档 §6.2 里唯一"只吃结果对象、不碰数据模块"的一层。六条口径先立住，否则实现里
每一处"顺手 import 一下"都会变成 Task 9 收录面上的红字：

1. **零 import 是体积红线，不是风格偏好。** `view.js` 会被 `toolkitCore.js` 挂成 `window.Tk`
   给三页共用（§0.2 那条实测：两个页面入口各自 `import` 同一模块时，vite 把 `import{` 原样留在
   IIFE 包裹的产物里，`vite build` 退出 0 而页面白屏——所以跨页只能走 `window.Tk`）。这里只要写
   一行 `import { resolveRegion } from './region.js'`，`region-data.js`（单文件 **100,020 字节**）
   或某张码表就跟着进了跨页共享层，而 `toolkitCore.min.js` 是 JSON 页也要加载的，§7 那条
   "证件页 JS + CSS gzip ≤ 60KB"当场顶破。**所以结果对象由装配层递进来、口径文案由参数传进来**，
   视图一侧不持有任何数据模块。H7 直接读源文本扫 `import`（静态、动态、`export … from` 三种写法）
   必须为零，V28 往文件头补一条 `import` 就红。
2. **转义只有 `esc` 一个出口。** 装配层拿到的是 HTML 串、走 `innerHTML`，视图少转一次就是页面被
   截断——用户粘贴的内容完全可能是 `</script><script>…`（§7 那条深样本对五格都成立，因为五格都把
   原样输入放进 `input` / `value`）。`esc` 收 `& < > " '` 五个字符、必须带 `/g`、只收字符串与有限数；
   `null` / `undefined` 不在这里兜——"这一格可以是空"由列定义显式声明（`cell`），否则真缺字段也
   看不出来。H1 用一条多字符样本同时判五档，H8 判口径行也走这里，H15 拿标签白名单审计整个结果区。
3. **三态是 UI 的三态，不是模块的 `state`。** §5.4 要"有效 / 校验位不符 / 结构非法"三者可区分，
   而五个模块的 `state` 加起来是**六档**：`empty` `malformed` `checkdigit` `luhn` `unlisted` `valid`。
   `checkdigit`（身份证与信用代码，模 11 / 模 31）与 `luhn`（银行卡，模 10）算法不同、对用户的结论
   是同一句，映射成同一档；`unlisted`（行别前缀、号段查不到）既不是有效也不是无效，它就是 §5.4
   那句"查不到不下无效结论"在 UI 上的形状，所以自成一档而不是塞进 `malformed`。映射只写在
   `STATE_META` 一处，徽章与外层 `tk-result--{tone}` 共用它；**未知的 `state` 一律抛**——哪天银行卡
   要出 `expired`，页面必须当场炸给装配层，而不是把没定论的号显示成绿的。
4. **列数一致是构造保证的，不是靠人记得数 `<td>`。** 表头与表体在同一段代码里由同一份列定义算出
   （`table()` 是十二张表的唯一构造点：读侧四张明细 + 生成侧八张）。`pickPath` 取不到中间任何一段
   就抛"内部不变量"，`fmt` 返回 `null` 才渲染成 `—`——"这一格是空"与"这格没定义"是两件事。
   `checks[i].ok === null` 是"不判定"，不是"不通过"（§5.4），所以判定表那一列有三档措辞，`CHECK_UNKNOWN`
   单独一格。
5. **口径文案归数据模块，视图不改写。** `caveat` / `note` / `id15Note` / 手机号那句 `normalized`
   全部原样透传（只转义），视图自己只造结构性句子（表头、"共 N 条"、"未收录"这一类）。H8 拿模块
   常量逐字比对钉住这条分界。同一句话如果在逐项判定表里已经出现过（身份证区划未收录时
   `checks.region.detail` 与 `caveat` 是同一句），就不再重复一遍——那是去重，不是改写（H9）。
   `notes` 由装配层作为参数递进来（H8 最后一条：没传就不出，视图不许自己去 import）。
6. **不碰 DOM、不写样式。** H7 除了 `import` 还扫 `document` / `window` / `innerHTML` /
   `querySelector` / `createElement` / `Node` 六个词；H15 的白名单只放 `div p span table thead tbody
   tr th td` 九种标签，禁 `on*=`、`style=`、`src|href|action=`。颜色与尺寸是 `toolkit.scss`
   （Task 8）的活，§6.4 只允许语义令牌；结果区的外层容器与 `aria-live` 由构建期骨架给，视图只交内容。

- [ ] **Step 1: 先写 §H 的 15 条判据（此时 `view.js` 还不存在，必红）**

追加到 `scripts/toolkit-tests.mjs` 末尾（§G 之后）。**这一节只新引 `view.js` 一个模块**：其余要用的
读侧 / 生成侧函数与口径常量都在 §B、§C、§E、§F、§G 顶层解构过了，同名 `const` 再声明一次是
SyntaxError（`node --check` 在拼装阶段就会红，跑不到测试）。14 个名字全是新面孔，六个辅助带 `h`
前缀（`hHead` / `hBody` / `hLabels` / `hTagAudit` / `hText` / `hBanks`），与 §G 的 `dupes` / `gNames`
一族不重名。`readFileSync` 文件头就有，本节只有 H7 用它读源文本。

```js
// ── §H 视图层 ──────────────────────────────────────────────────────────────
//（本节只新引 `view.js` 一个模块：`parseIdCard` / `parseUscc` / `parseBankCard` / `parseMobile`、
//  八个 `generate*`、以及 `USE_NOTE` / `REFERENCE_NOTE` / `BANK_CAVEAT` / `MOBILE_CAVEAT` / `NAME_NOTE`
//  已在 §B、§C、§E、§F、§G 的顶层解构过，同名 `const` 再声明一次是 SyntaxError；`readFileSync`
//  文件头就有（只有 H7 读源文本用它）。view.js 这 14 个名字全是新面孔，六个 `h*` 前缀的辅助
//  （`hHead` / `hBody` / `hLabels` / `hTagAudit` / `hText` / `hBanks`）与 §G 的 `dupes` / `gNames` 不重名。）
const { BATCH_KINDS, EMPTY_CELL, READ_KINDS, STATE_META, batchBlock, checksTable, detailTable, echoLines, esc, listTable, noteLines, parseBlock, stateBadge, suggestLine
} = await import('../dev/js/tools/view.js');



/** 表头的列数（只认 `<thead>` 里那一行，别把表体的 `<tr>` 数进来） */
function hHead(html) {
  const m = html.match(/<thead><tr>([\s\S]*?)<\/tr><\/thead>/);
  return m ? (m[1].match(/<th\b/g) || []).length : 0;
}
/** 表体每一行的格数 */
function hBody(html) {
  const m = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!m) return [];
  return (m[1].match(/<tr>[\s\S]*?<\/tr>/g) || []).map((row) => (row.match(/<td\b/g) || []).length);
}
/**
 * 只审计"真的标签"：转义过的内容里 `&lt;img …&gt;` 是文本，不会在这里露面；
 * 一旦视图少转一次，这里就会长出一个带 `on*=` 的标签或一个白名单外的标签。
 */
function hTagAudit(html) {
  const bad = [];
  for (const tag of html.match(/<\/?[a-zA-Z][^>]*>/g) || []) {
    const name = (tag.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)/) || [])[1];
    if (!['div', 'p', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td'].includes((name || '').toLowerCase())) {
      bad.push(`标签 ${name}`);
    }
    if (/\son[a-z]+\s*=/i.test(tag) || /\sstyle\s*=/i.test(tag) || /\s(src|href|action)\s*=/i.test(tag)) {
      bad.push(`属性 ${tag.slice(0, 20)}`);
    }
  }
  return bad;
}
/** 表头文字（判"这一列在不在、叫什么名"用它，改类名不会误红） */
function hLabels(html) {
  const m = html.match(/<thead><tr>([\s\S]*?)<\/tr><\/thead>/);
  return m ? [...m[1].matchAll(/<th\b[^>]*>([^<]*)<\/th>/g)].map((x) => x[1]) : [];
}
/** 剥掉标签只看文字（判"这一句在不在"时不必连类名一起抄，改样式不会误红） */
const hText = (html) => html.replace(/<[^>]*>/g, '');
const hBanks = (seed) => generateBankCards({ count: 20, rng: seededRandom(seed) });

test('H1 esc 是本文件唯一的转义出口：五个字符各转一次，非文本一律抛', () => {
  assert.equal(esc('&'), '&amp;');
  assert.equal(esc('<'), '&lt;');
  assert.equal(esc('>'), '&gt;');
  assert.equal(esc('"'), '&quot;');
  assert.equal(esc("'"), '&#39;');
  assert.equal(esc('a&amp;b'), 'a&amp;amp;b', '已转义过的串再走一次也必须被继续转义（不做二次识别）');
  assert.equal(esc(0), '0', '数字要能直接出货，否则"0 岁""0 位"会变成空');
  assert.equal(esc(19), '19');
  assert.equal(esc('北京市东城区'), '北京市东城区');
  assert.equal(esc('<a href="x">A&B\'</a>'),
    '&lt;a href=&quot;x&quot;&gt;A&amp;B&#39;&lt;/a&gt;',
    '五个特殊字符同时出现时必须每个都转——把 /g 去掉就只有第一个被换掉');
  for (const bad of [null, undefined, {}, [], true, NaN, Infinity]) {
    assert.throws(() => esc(bad), TypeError, `esc(${JSON.stringify(bad)}) 竟然没抛`);
  }
});

test('H2 六档 state → 三态 + 两档中性：类名与文案逐格钉住，未知状态抛', () => {
  assert.deepEqual(Object.keys(STATE_META).sort(),
    ['checkdigit', 'empty', 'luhn', 'malformed', 'unlisted', 'valid'].sort());
  const want = {
    valid: ['有效', 'ok'], checkdigit: ['校验位不符', 'warn'], luhn: ['校验位不符', 'warn'],
    unlisted: ['表内未收录', 'unknown'], malformed: ['结构非法', 'bad'], empty: ['等待输入', 'idle'],
  };
  for (const [state, [label, tone]] of Object.entries(want)) {
    const html = stateBadge(state);
    assert.equal(html, `<span class="tk-state tk-state--${tone}">${label}</span>`, `${state} 的徽章形状不对`);
  }
  assert.equal(stateBadge('checkdigit'), stateBadge('luhn'), '模 11 与 Luhn 对用户是同一句结论，必须同字同档');
  assert.ok(!stateBadge('unlisted').includes('bad'), '查不到不得渲染成"不通过"（§5.4 那句不下无效结论）');
  assert.ok(!stateBadge('unlisted').includes('ok'), '查不到也不许渲染成绿的');
  for (const bad of ['expired', '', 'OK', 'VALID', null, 0, {}]) {
    assert.throws(() => stateBadge(bad), TypeError, `未知状态 ${JSON.stringify(bad)} 竟然没抛`);
  }
});

test('H3 五个读侧真实向量：外层类名跟着 state 走，未知状态从 parseBlock 也炸', () => {
  const cases = [
    ['idcard', parseIdCard('110101199003070011'), 'ok'],
    ['idcard', parseIdCard('110101199003070015'), 'warn'],
    ['idcard', parseIdCard('123'), 'bad'],
    ['uscc', parseUscc('91350100M000100Y43'), 'ok'],
    ['uscc', parseUscc('91350100M000100Y42'), 'warn'],
    ['bank', parseBankCard('6222-0219-9003-0700-15'), 'ok'],
    ['bank', parseBankCard('4900000000000003'), 'unknown'],
    ['mobile', parseMobile('13800138000'), 'ok'],
    ['mobile', parseMobile('14000000000'), 'unknown'],
    ['mobile', parseMobile('12800138000'), 'bad'],
  ];
  for (const [kind, result, tone] of cases) {
    const html = parseBlock(kind, result);
    assert.ok(html.startsWith(`<div class="tk-result tk-result--${tone}">`),
      `${kind}/${result.state} 的外层类名不是 ${tone}：${html.slice(0, 60)}`);
    assert.doesNotMatch(html, /undefined|null(?![a-z])/g, '渲染结果里漏出了内部值');
  }
  const stray = parseIdCard('110101199003070011');
  stray.state = 'expired';
  assert.throws(() => parseBlock('idcard', stray), TypeError, '未知状态从 parseBlock 走竟然不抛');
});

test('H4 列数一致：十二张表里每一行的格数都等于表头格数', () => {
  /** 列名是 UI 契约：静默少一列＝少一项信息，用户看不出来，只能由判据看住 */
  const WANT_LABELS = {
    idcard: ['号码', '区划', '出生日期', '年龄', '性别'],
    uscc: ['代码', '区划', '主体标识', '校验位'],
    bank: ['卡号', '发卡行', '卡种', '登记位数'],
    mobile: ['号码', '号段', '运营商'],
    name: ['姓名', '姓', '名', '名字数'],
    address: ['地址', '区划码'],
    email: ['邮箱', '域'],
    profile: ['姓名', '地址', '邮箱'],
  };
  const WANT_DETAIL = {
    idcard: ['区划', '出生日期', '年龄', '性别', '顺序码', '校验位', '校验算式', '18 位写法', '15 位写法', '区划数据截止'],
    uscc: ['区划', '登记管理部门码', '机构类别码', '主体标识', '组织机构代码', '组织机构代码校验位', '校验位', '校验算式'],
    bank: ['位数', '命中前缀', '发卡行', '卡种', '表内登记位数', 'Luhn', 'Luhn 算式', '行别来源'],
    mobile: ['位数', '号段', '运营商', '展示格式', '号段来源'],
  };
  assert.deepEqual(Object.keys(WANT_LABELS), BATCH_KINDS.slice(), '列契约的 kind 集合没跟 BATCH_KINDS 同步');
  assert.deepEqual(Object.keys(WANT_DETAIL), READ_KINDS.slice(), '明细契约的 kind 集合没跟 READ_KINDS 同步');
  const rng = seededRandom(11);
  const batches = {
    idcard: generateIdCards({ count: 12, rng }),
    uscc: generateUsccCodes({ count: 12, rng }),
    bank: hBanks(12),
    mobile: generateMobiles({ count: 12, rng }),
    name: generateNames({ count: 12, rng }),
    address: generateAddresses({ count: 12, rng }),
    email: generateEmails({ count: 12, rng }),
    profile: generateProfiles({ count: 12, rng }),
  };
  for (const [kind, rows] of Object.entries(batches)) {
    const html = listTable(kind, rows);
    const cols = hHead(html);
    const body = hBody(html);
    assert.ok(cols >= 2, `${kind} 的列数少到不能承载信息`);
    assert.deepEqual(hLabels(html), WANT_LABELS[kind], `${kind} 的生成表列名与契约不一致`);
    assert.equal(body.length, rows.length, `${kind} 的表格行数与结果条数不一致`);
    assert.deepEqual(body, new Array(rows.length).fill(cols), `${kind} 出现了 ${[...new Set(body)].join('/')} 格混排`);
    assert.ok(batchBlock(kind, rows, []).startsWith(`<div class="tk-batch tk-batch--${kind}">`),
      `${kind} 的生成块没带 kind 类名，样式没法按档区分`);
  }
  const reads = {
    idcard: parseIdCard('110101199003070011'),
    uscc: parseUscc('91350100M000100Y43'),
    bank: parseBankCard('6222-0219-9003-0700-15'),
    mobile: parseMobile('13800138000'),
  };
  for (const [kind, result] of Object.entries(reads)) {
    const html = detailTable(kind, result);
    assert.ok(hHead(html) >= 5, `${kind} 的明细表列太少，摊不开解码量`);
    assert.deepEqual(hLabels(html), WANT_DETAIL[kind], `${kind} 的明细表列名与契约不一致`);
    assert.deepEqual(hBody(html), [hHead(html)], `${kind} 的明细表行列不匹配`);
    const c = checksTable(result.checks);
    assert.equal(hHead(c), 3, `${kind} 的判定表不是三列`);
    assert.deepEqual(hLabels(c), ['判定项', '结论', '依据'], `${kind} 的判定表三列名字变了`);
    assert.deepEqual(hBody(c), new Array(result.checks.length).fill(3), `${kind} 的判定表行列不匹配`);
  }
  const zero = listTable('idcard', [{ id18: '110101202601010011', region: '北京市市辖区', birth: '2026-01-01', age: 0, sex: '男' }]);
  assert.ok(zero.includes('>0<'), '0 岁被显示成了空（cell 一旦用 falsy 判断就会这样）');
  assert.ok(!zero.includes(EMPTY_CELL), '这一条五格都有值，不该出现空值形状');
});

test('H5 不判定那一档只有三种真实形状，一律不给"不通过"', () => {
  const uncoded = parseIdCard('610199199003070011');
  assert.equal(uncoded.checks.find((c) => c.key === 'region').ok, null, '前提变了：区划这行不再是 null 档');
  assert.ok(checksTable(uncoded.checks).includes('>未收录<'), '区划未收录没走"未收录"这一格');
  const fifteen = parseIdCard('110101900307001');
  assert.equal(fifteen.state, 'valid');
  assert.equal(fifteen.checks.find((c) => c.key === 'checkBit').ok, null);
  assert.equal(STATE_META[fifteen.state].tone, 'ok', '15 位无校验位却把整块降了档');
  const short = parseBankCard('6222 0219 9003 0700 11');
  assert.equal(short.checks.find((c) => c.key === 'bin').ok, null, '前提变了：登记位数不吻合那格不再是 null');
  const badSegment = parseMobile('12800138000');
  assert.equal(badSegment.checks.find((c) => c.key === 'carrier').ok, null);
  const html = checksTable(badSegment.checks);
  assert.deepEqual(hBody(html), new Array(badSegment.checks.length).fill(3));
  assert.ok(!html.includes('不通过</td><td>号段不成立'), '运营商"不判定"被渲染成了"不通过"');
  const allOk = checksTable(parseIdCard('110101199003070011').checks);
  assert.ok(hText(allOk).includes('通过'), '全判据通过时一行"通过"都没有');
  assert.ok(!hText(allOk).includes('不通过'), '全通过的向量里冒出了"不通过"（三态映射的 true/false 被换了）');
  for (const checks of [[{ key: 'x', label: 'a', ok: 'yes', detail: 'b' }], [{ key: 'x', label: 'a', ok: true }], 'nope', null]) {
    assert.throws(() => checksTable(checks), TypeError, `判据表居然收下了 ${JSON.stringify(checks)}`);
  }
});

test('H6 kind 与列定义一一对应：读侧与生成侧不能互相串门，未知 kind 抛', () => {
  assert.deepEqual(READ_KINDS, ['idcard', 'uscc', 'bank', 'mobile']);
  assert.deepEqual(BATCH_KINDS, ['idcard', 'uscc', 'bank', 'mobile', 'name', 'address', 'email', 'profile']);
  for (const kind of READ_KINDS) {
    const r = kind === 'idcard' ? parseIdCard('110101199003070011')
      : kind === 'uscc' ? parseUscc('91350100M000100Y43')
        : kind === 'bank' ? parseBankCard('6222-0219-9003-0700-15')
          : parseMobile('13800138000');
    assert.ok(detailTable(kind, r).includes('<table'), `${kind} 的明细表没出货`);
  }
  for (const kind of ['name', 'address', 'email', 'profile']) {
    assert.throws(() => detailTable(kind, { info: {} }), TypeError, `生成侧的 ${kind} 居然能走读侧明细表`);
  }
  for (const bad of ['json', '', 'IdCard', null, 0]) {
    assert.throws(() => listTable(bad, []), TypeError, `listTable 居然收下了 kind=${JSON.stringify(bad)}`);
    assert.throws(() => detailTable(bad, { info: {} }), TypeError, `detailTable 居然收下了 kind=${JSON.stringify(bad)}`);
  }
});

test('H7 view.js 零 import、不碰 DOM：跨页共享层的体积红线由判据守着', () => {
  const src = readFileSync(new URL('../dev/js/tools/view.js', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /^\s*import[\s({]/m, 'view.js 里出现了 import——它会被 toolkitCore 拖进三页共用层');
  assert.doesNotMatch(code, /\bimport\s*\(/, 'view.js 里出现了动态 import');
  assert.doesNotMatch(code, /\bexport\s.*\bfrom\b/, 'view.js 里出现了 re-export（同样是一条 import 边）');
  for (const domWord of ['document', 'window', 'innerHTML', 'querySelector', 'createElement', 'Node']) {
    assert.ok(!code.includes(domWord), `view.js 里出现了 ${domWord}`);
  }
  assert.doesNotMatch(code, /style\s*=\s*"/, 'view.js 里写了内联样式（颜色与尺寸归 toolkit.scss）');
  assert.doesNotMatch(code, /#[0-9a-fA-F]{3,6}\b/, 'view.js 里写了颜色字面量（§6.4 只允许语义令牌）');
});

test('H8 口径行原样透传：模块给的句子一字不动，视图不自己另写一套', () => {
  const bank = batchBlock('bank', hBanks(21), [USE_NOTE, BANK_CAVEAT]);
  for (const note of [USE_NOTE, BANK_CAVEAT]) {
    assert.ok(bank.includes(`<p class="tk-note">${note}</p>`), `口径句被改写了：${note.slice(0, 20)}`);
  }
  assert.ok(bank.indexOf(USE_NOTE) < bank.indexOf(BANK_CAVEAT), 'notes 的顺序要照调用方给的顺序出');
  const mobileHtml = parseBlock('mobile', parseMobile('13800138000'));
  assert.ok(mobileHtml.includes(esc(MOBILE_CAVEAT)), '手机号的硬/软结论那句话没落地');
  assert.ok(mobileHtml.includes('运营商按三位号段判定'), '携号转网与发号口径的限定语没落地');
  assert.deepEqual(noteLines(['', null, undefined, '有一句']), ['<p class="tk-note">有一句</p>']);
  assert.deepEqual(noteLines(['含 <b>标签</b> 与 & 的口径句']),
    ['<p class="tk-note">含 &lt;b&gt;标签&lt;/b&gt; 与 &amp; 的口径句</p>'],
    '口径句也得走同一个转义出口：notes 由装配层递进来，对视图就不是可信输入');
  assert.throws(() => noteLines('不是数组'), TypeError);
  const usccHtml = parseBlock('uscc', parseUscc('91350100M000100Y43'), [REFERENCE_NOTE]);
  assert.ok(usccHtml.includes(esc(REFERENCE_NOTE)), '信用代码"第 1、2 位不给名称"的缺口说明没落地');
  assert.throws(() => parseBlock('uscc', parseUscc('91350100M000100Y43'), '不是数组'), TypeError);
  assert.ok(!parseBlock('uscc', parseUscc('91350100M000100Y43')).includes(REFERENCE_NOTE),
    '没传 notes 时视图不许自己去 import 那句——那是装配层的活');
});

test('H9 判定表已经说过的话不再重复一遍：同一句只落地一次', () => {
  const html = parseBlock('idcard', parseIdCard('610199199003070011'));
  const sentence = '区划码未收录（可能是已撤销建制、经济功能区，或晚于区划数据截止日的调整）';
  assert.equal(html.includes(sentence), true, '这句话根本没落地');
  assert.equal(html.split(sentence).length - 1, 1, `「${sentence.slice(0, 12)}…」重复出现了 ${html.split(sentence).length - 1} 次`);
  const withNote = parseBlock('idcard', parseIdCard('110101900307001'));
  assert.ok(withNote.includes('15 位为第一代号码，无校验位'), 'id15Note 那句没落地（它不在判定表里，不该被去重掉）');
  const bank = parseBlock('bank', parseBankCard('4900000000000003'));
  assert.equal(bank.split('前缀未收录').length - 1, 1, '银行卡未收录那句在表外又说了一遍');
  assert.ok(bank.includes(BANK_CAVEAT), '未收录时那句参考口径也得在');
});

test('H10 明细表把解码量摊开：区划带命中级别，算式带 Σ 与模数；结构不成立时不摆空表', () => {
  const idHtml = detailTable('idcard', parseIdCard('110101199003070011'));
  assert.ok(idHtml.includes('110101 · 北京市东城区（县级 · 现行）'), idHtml.match(/<tr>.*?区划.*?<\/tr>/)?.[0]);
  assert.ok(idHtml.includes('36 岁'));
  assert.ok(idHtml.includes('Σ 154 · mod 11 = 0 · 对照表 10X98765432'));
  assert.ok(idHtml.includes('号码末位 1，算得 1'));
  assert.ok(idHtml.includes('2022-10-31'), '区划数据截止日没落地');
  const city = detailTable('uscc', parseUscc('91350100M000100Y43'));
  assert.ok(city.includes('350100 · 福建省福州市（市级 · 现行）'), '市级命中被写成了县级');
  const history = detailTable('idcard', parseIdCard('371299199003070011'));
  assert.ok(history.includes('（市级 · 历史）'), '历史码的命中级别没落地');
  for (const bad of ['123', '']) {
    const r = parseIdCard(bad);
    assert.equal(r.info, null, '前提变了：这一档 info 不再是 null');
    assert.equal(detailTable('idcard', r), '', '结构不成立还要摆明细表，等于把一排破折号说成"解出来了"');
  }
});

test('H11 回显分清"原样输入"与"参与判定的是哪一串"，四种归一各有说法', () => {
  const bank = echoLines(parseBankCard('6222-0219-9003-0700-15')).join('');
  assert.ok(bank.includes('6222-0219-9003-0700-15') && bank.includes('622202199003070015'), '分隔符归一没显示');
  assert.ok(bank.startsWith('<p class="tk-echo">原样输入'), bank);
  const plain = echoLines(parseIdCard('110101199003070011')).join('');
  assert.ok(plain.includes('判定对象'), '输入与判定串相同时还写"原样输入 …，参与判定的是…"');
  const inner = parseIdCard('110101 19900307001 1');
  assert.equal(inner.state, 'malformed', '前提变了：身份证内部空格不再是原样判');
  assert.ok(echoLines(inner).join('').includes('去掉中间的分隔符后是 <span class="tk-mono">110101199003070011</span>'));
  const lowered = echoLines(parseUscc('91350100m000100y43')).join('');
  assert.ok(lowered.includes('字母按大写解释'));
  const plus = echoLines(parseMobile('+86 13800138000')).join('');
  assert.ok(plus.includes('去掉了国际前缀 +86'), '手机号自己给的那句归一说明没落地');
});

test('H12 同前缀多行命中时另起一张前缀表，五列且标出位数是否吻合', () => {
  const amb = parseBankCard('622307920707762365');
  assert.equal(amb.ambiguous, true, '前提变了：这个号不再多义');
  assert.equal(amb.matches.length, 2);
  const html = parseBlock('bank', amb);
  const tableHtml = (html.match(/<table class="tk-table tk-matches">[\s\S]*?<\/table>/) || [])[0];
  assert.ok(tableHtml, '多义时没出前缀表');
  assert.equal(hHead(tableHtml), 5, '前缀表表头不是 5 列');
  assert.deepEqual(hBody(tableHtml), [5, 5], '前缀表行格数与表头不一致');
  assert.ok(tableHtml.includes('中国工商银行') && tableHtml.includes('九江银行'));
  assert.equal((tableHtml.match(/>是</g) || []).length, 1, '位数吻合应当只有一条"是"');
  assert.equal((tableHtml.match(/>否</g) || []).length, 1);
  const single = parseBlock('bank', parseBankCard('6222-0219-9003-0700-15'));
  assert.ok(!single.includes('tk-matches'), '单义号码不该摆前缀表');
});

test('H13 建议行只在真有建议时出现，且点名"只改校验位"', () => {
  const wrong = parseIdCard('110101199003070015');
  assert.equal(wrong.suggestedId18, '110101199003070011');
  const html = parseBlock('idcard', wrong);
  assert.ok(html.includes('只改校验位就能自洽：<span class="tk-mono">110101199003070011</span>'), html.slice(-260));
  assert.equal(suggestLine('idcard', parseIdCard('110101199003070011')), '', '校验位本来就对还给建议');
  assert.equal(suggestLine('uscc', parseUscc('91350100M000100Y42')), '', '信用代码没有 suggested 键，视图不许自己拼一个');
  assert.ok(!parseBlock('mobile', parseMobile('12800138000')).includes('只改校验位'), '手机号没有校验位，不该出现建议');
  assert.equal(suggestLine('bank', parseBankCard('9000000000000001')), '', '位数不吻合那档不该给"只改校验位"的号');
});

test('H14 空输入与零结果各有明确说法，不摆空表', () => {
  const idle = parseBlock('idcard', parseIdCard(''));
  assert.ok(idle.startsWith('<div class="tk-result tk-result--idle">'), idle.slice(0, 60));
  assert.ok(idle.includes('还没有可判定的内容。'));
  assert.ok(!idle.includes('<table'), '空输入摆了表格，读屏会念出一串空的判定项');
  const emptyBatch = batchBlock('name', [], [NAME_NOTE]);
  assert.ok(emptyBatch.includes('<p class="tk-count">共 0 条</p>'));
  assert.ok(emptyBatch.includes('这次没有产出任何结果。'));
  assert.ok(!emptyBatch.includes('<table'));
  assert.ok(emptyBatch.includes(NAME_NOTE), '零结果时口径行也得照给');
  const full = batchBlock('name', generateNames({ count: 7, rng: seededRandom(31) }), [NAME_NOTE]);
  assert.ok(full.includes('<p class="tk-count">共 7 条</p>'));
  assert.equal(full.split('<tr>').length - 1, 8, '七条结果应当是表头 + 7 行');
  assert.throws(() => listTable('name', '不是数组'), TypeError);
  assert.throws(() => batchBlock('name', [], '不是数组'), TypeError);
});

test('H15 深样本：把 HTML 与脚本片段塞进输入、行别名与地址，落地只剩文本', () => {
  const evil = '</script><img src=x onerror=alert(1)>';
  const html = parseBlock('idcard', parseIdCard(evil));
  assert.deepEqual(hTagAudit(html), [], '产物里长出了白名单外的标签或危险属性');
  assert.equal((html.match(/<script/g) || []).length, 0, '产物里出现了 <script');
  assert.ok(html.includes('&lt;/script&gt;'), '该转义的串反而没转义');
  assert.ok(html.includes('alert(1)'), '转义之后文本内容还得在（只转义不吞字）');
  const rows = [{
    formatted: evil, bankName: 'A&B「」', cardTypeName: '<b>借记卡</b>', panLength: 19,
  }];
  const listHtml = listTable('bank', rows);
  assert.ok(listHtml.includes('A&amp;B'), '发卡行里的 & 没转义');
  assert.ok(!listHtml.includes('<b>借记卡</b>'), '卡种被当成了标签');
  const deep = generateProfiles({ count: 3, rng: seededRandom(41) });
  deep[0].address.text = evil;
  const profileHtml = batchBlock('profile', deep, []);
  assert.equal((profileHtml.match(/<script|<img/g) || []).length, 0, '嵌套路径上的值没走同一条转义');
  assert.ok(profileHtml.includes('&lt;/script&gt;'));
  assert.throws(() => listTable('profile', [{ name: { name: '甲' }, address: {}, email: { email: 'a@b' } }]),
    /缺「text」/, '嵌套字段少了却静默显示成空');
  assert.equal(listTable('mobile', [{ formatted: '138 0013 8000', segment: '138', carrier: null }])
    .includes(EMPTY_CELL), true, '运营商为空时应出空值形状');
});
```

- [ ] **Step 2: 跑红，确认红的形状**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^not ok|Cannot find module|^# (tests|pass|fail)'; echo "exit=${PIPESTATUS[0]}"
```

Expected：`not ok 1 - scripts/toolkit-tests.mjs` 加一句
`ERR_MODULE_NOT_FOUND: Cannot find module '…/dev/js/tools/view.js'`，`# tests 100`、`# pass 99`
（§A–§G 那批照绿）、`# fail 1`、`exit=` 非 0。红的形状与 §E / §F / §G 当时一致：**整文件挂**，
不是 15 条各挂一次——顶层 `await import` 抛在文件级。

- [ ] **Step 3: 写 `dev/js/tools/view.js`**

```js
/**
 * 视图层（设计文档 §6.2）：把五格数据模块的**结果对象**渲染成 HTML 字符串。
 *
 * **纯函数、不碰 DOM、零 import**。三条都不是风格偏好：
 * - 不碰 DOM 才跑得进 Node 判据（§8.1），真 DOM 只在 §I 的手写假 DOM 与 Task 10 的 headless Chrome 各测一次；
 * - 零 import 是段 2 计划 0.2 那条实测的直接后果：这一格会被 `toolkitCore.js` 挂成 `window.Tk`
 *   供三页共用，多一条 `import` 就把 `region-data.js`（单文件 100,020 字节）或某张码表拽进
 *   跨页共享层，§7 那条"证件页 JS+CSS gzip ≤ 60KB"立刻顶破，而 `toolkitCore.min.js` 是 JSON 页
 *   也要加载的。所以**结果对象由装配层递进来**，视图一侧不持有任何数据模块。§H 有一条判据
 *   专门扫源文本数 `import` 的条数（必须为 0），往这里加一行 import 就会红。
 * - 转义只在这一处（`esc`）：装配层拿到的是串，走 `innerHTML`，视图少转一次就是页面被截断。
 *   设计文档 §7 那条深样本"含 `</script>` 的字符串值"在这里同样成立——五格都把原样输入放进
 *   `input` / `value`，用户粘贴的内容完全可能是 `</script><script>…`。
 *
 * **三态是 UI 的三态，不是模块的 `state`。** §5.4 要"有效 / 校验位不符 / 结构非法"三者可区分，
 * 而五个模块的 `state` 加起来是六档：`empty` `malformed` `checkdigit` `luhn` `unlisted` `valid`。
 * `checkdigit`（身份证、信用代码，模 11 / 模 31）与 `luhn`（银行卡）同为"校验位不符"——
 * 算法不同、对用户而言的结论是同一句；`unlisted`（行别前缀、号段查不到）既不是有效也不是无效，
 * 它就是 §5.4 那句"查不到不下无效结论"在 UI 上的形状，所以自成一档而不是塞进 `malformed`。
 * 映射只写在 `STATE_META` 一处，**未知的 `state` 一律抛**：新增一档必须同时在这里补一档，
 * 不能让"视图没见过"静默退化成"按有效渲染"。
 *
 * **口径文案归数据模块，视图不改写。** `caveat` / `note` / `id15Note` / 手机号那句 `normalized`
 * 全部原样透传（只转义），视图自己只造结构性句子（表头、"共 N 条"、"未收录"这一类）。
 * H8 拿模块常量逐字比对钉住这条分界。同一句话如果在逐项判定表里已经出现过，就不再重复一遍
 * （身份证未收录区划时 `checks.region.detail` 与 `caveat` 是同一句），这是去重不是改写。
 *
 * 与 `idcard.js` / `uscc.js` / `bankcard.js` / `phone.js` / `random-data.js` 同一套约定：
 * 入参形状不对就 `TypeError`，内部不变量被破坏就 `Error`，文案里的"收到什么"走本文件自己的
 * `shapeOf`（与各模块那份逐字同形但各自私有——跨文件共享它就要开 import 边，见上）。
 */

/** 读侧四种、生成侧八种；列定义与明细定义都按这套键取，多一格少一格都会在 §H 红 */
export const READ_KINDS = ['idcard', 'uscc', 'bank', 'mobile'];
export const BATCH_KINDS = ['idcard', 'uscc', 'bank', 'mobile', 'name', 'address', 'email', 'profile'];

/** 空值的显示形状。`null` 与"这一格没定义"是两件事，后者在 `table()` 里直接抛 */
export const EMPTY_CELL = '—';

/**
 * 六档 `state` → UI 三态 + 两档中性。`tone` 决定类名后缀（`tk-state--ok`）与外层
 * `tk-result--{tone}`，所以样式只需要认这五个词，不需要认六个模块状态。
 */
export const STATE_META = {
  valid: { label: '有效', tone: 'ok' },
  checkdigit: { label: '校验位不符', tone: 'warn' },
  luhn: { label: '校验位不符', tone: 'warn' },
  unlisted: { label: '表内未收录', tone: 'unknown' },
  malformed: { label: '结构非法', tone: 'bad' },
  empty: { label: '等待输入', tone: 'idle' },
};

/** `resolveRegion` 能给出的四种状态与四种级别，视图负责翻成 §5.4 那套措辞 */
const REGION_STATUS_CN = { current: '现行', abolished: '历史', uncoded: '未收录', unknown: '未收录' };
const REGION_LEVEL_CN = { county: '县级', city: '市级', province: '省级', none: '未命中' };

/** 逐项判定表里 `ok` 的三种取值——`null` 是"不判定"，不是"不通过" */
const CHECK_VERDICT = { true: '通过', false: '不通过' };
const CHECK_UNKNOWN = '未收录';

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** 报错文案里的"收到什么"，与各模块那份同形（各自私有，见文件头） */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}

/**
 * 唯一的转义出口。只收字符串与数字——`null` / `undefined` 在这里抛，
 * "这一格可以是空"必须由列定义显式声明，不能靠 `esc` 兜住，否则真缺字段也看不出来。
 * @param {string|number} value
 */
export function esc(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`view 的 esc 只收有限数，收到 ${shapeOf(value)}`);
    return String(value);
  }
  if (typeof value !== 'string') {
    throw new TypeError(`view 的 esc 只收字符串或数字，收到 ${shapeOf(value)}`);
  }
  return value.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}

/** 单元格：`null` / `undefined` / 空串 → `EMPTY_CELL`，其余交给 `esc` */
function cell(value) {
  if (value === null || value === undefined || value === '') return EMPTY_CELL;
  return esc(value);
}

/** 取点号路径（`name.given`）；中间任何一段不存在就是数据形状变了，抛而不是显示 `—` */
function pickPath(row, path, who) {
  let cur = row;
  for (const seg of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || !(seg in cur)) {
      throw new Error(`内部不变量：${who} 的列「${path}」在数据里取不到（缺「${seg}」这一格）`);
    }
    cur = cur[seg];
  }
  return cur;
}

/**
 * 一张表的唯一构造点：表头与每一行的格数由同一段代码算出，"列数一致"是构造保证的，
 * 不是靠人记得数 `<td>`。`fmt` 用来拼跨字段的可读串，`path` 是纯取字段。
 * @param {string} who 报错与类名里用的名字
 * @param {{label:string,path?:string,fmt?:(row:object)=>(string|number|null),mono?:boolean}[]} columns
 * @param {object[]} rows
 */
function table(who, columns, rows) {
  const head = columns.map((c) => `<th scope="col"${c.mono ? ' class="tk-mono"' : ''}>${esc(c.label)}</th>`);
  const body = rows.map((row, i) => {
    const tds = columns.map((c) => {
      let v;
      if (c.fmt) v = c.fmt(row);
      else v = pickPath(row, c.path, `${who} 第 ${i + 1} 行`);
      if (v !== null && v !== undefined && typeof v !== 'string' && typeof v !== 'number') {
        throw new TypeError(`内部不变量：${who} 第 ${i + 1} 行的「${c.path || c.label}」算出来是 ${shapeOf(v)}，不是文本`);
      }
      return `<td${c.mono ? ' class="tk-mono"' : ''}>${cell(v)}</td>`;
    });
    return `<tr>${tds.join('')}</tr>`;
  });
  return `<table class="tk-table ${who}"><thead><tr>${head.join('')}</tr></thead>`
    + `<tbody>${body.join('')}</tbody></table>`;
}

/**
 * `state` → `STATE_META` 那一格，取不到就抛。徽章与外层 `tk-result--{tone}` 共用它，
 * 所以"未知状态"在两块地方只会有一处判定，不会一处抛、一处按 `undefined` 渲染。
 * @param {string} state
 */
function stateMetaOf(state) {
  if (typeof state !== 'string' || !Object.prototype.hasOwnProperty.call(STATE_META, state)) {
    throw new TypeError(`view 收到未知的状态「${shapeOf(state)}」，STATE_META 里没有这一档`);
  }
  return STATE_META[state];
}

/**
 * 三态徽章。`state` 不在 `STATE_META` 里就抛——这条判据的全部意义在于：
 * 哪天模块新增一档（比如银行卡将来要出 `expired`），页面必须当场炸给装配层，而不是把
 * 一个没定论的号显示成绿的。
 * @param {string} state
 */
export function stateBadge(state) {
  const { label, tone } = stateMetaOf(state);
  return `<span class="tk-state tk-state--${tone}">${esc(label)}</span>`;
}

/**
 * 逐项判定表（§5.4 的"让用户看得见为什么不行"）。三列固定：判定项 / 结论 / 依据。
 * `checks` 为空数组是合法输入（`state === 'empty'`、或结构在头两行就崩了），给一句明说没有的话，
 * 而不是摆一张空表——空表在屏幕读起来像"全都通过了"。
 * @param {{key:string,label:string,ok:boolean|null,detail:string}[]} checks
 */
export function checksTable(checks) {
  if (!Array.isArray(checks)) {
    throw new TypeError(`view 的 checksTable 应为判据数组，收到 ${shapeOf(checks)}`);
  }
  if (checks.length === 0) return '<p class="tk-hint">还没有可判定的内容。</p>';
  return table('tk-checks', [
    { label: '判定项', path: 'label' },
    { label: '结论', fmt: (c) => (c.ok === null ? CHECK_UNKNOWN : CHECK_VERDICT[String(c.ok)]) },
    { label: '依据', path: 'detail' },
  ], checks.map((c, i) => {
    if (c === null || typeof c !== 'object' || typeof c.label !== 'string'
      || typeof c.detail !== 'string'
      || (c.ok !== true && c.ok !== false && c.ok !== null)) {
      throw new TypeError(`内部不变量：第 ${i + 1} 条判据形状不对（需要 label/detail 字符串与 true|false|null 的 ok），收到 ${shapeOf(c)}`);
    }
    return c;
  }));
}

/**
 * 输入回显：把"用户粘贴的"与"模块拿去判的"分开显示。
 * 五格对分隔符的口径不一样（银行卡 / 手机号内部的分隔符会被吃掉后继续判，身份证与信用代码
 * 不会——它把原样串留着判、另给一句 `repairedHint`），装配层不需要记这些差别，视图照字段出货。
 * @param {object} result 任一读侧结果对象
 * @returns {string[]} 零到三条 `<p>`，没有可说时就给空数组
 */
export function echoLines(result) {
  const r = result ?? {};
  const out = [];
  const judged = typeof r.digits === 'string' ? r.digits : r.value;
  if (typeof r.input === 'string' && r.input !== '') {
    if (typeof judged === 'string' && judged !== r.input) {
      out.push(`<p class="tk-echo">原样输入 <span class="tk-mono">${esc(r.input)}</span>，参与判定的是 <span class="tk-mono">${esc(judged)}</span>。</p>`);
    } else if (typeof judged === 'string') {
      out.push(`<p class="tk-echo">判定对象 <span class="tk-mono">${esc(judged)}</span>。</p>`);
    } else {
      out.push(`<p class="tk-echo">原样输入 <span class="tk-mono">${esc(r.input)}</span>。</p>`);
    }
  }
  if (typeof r.repairedHint === 'string' && r.repairedHint !== '') {
    out.push(`<p class="tk-hint">去掉中间的分隔符后是 <span class="tk-mono">${esc(r.repairedHint)}</span>，那一串才是合法长度。</p>`);
  }
  if (r.normalized === true) {
    out.push('<p class="tk-hint">字母按大写解释。</p>');
  } else if (typeof r.normalized === 'string' && r.normalized !== '') {
    out.push(`<p class="tk-hint">${esc(r.normalized)}。</p>`);
  }
  return out;
}

/** 区划那两格的可读写法：全称 + §5.4 要求的命中级别 */
function regionRow(region, who) {
  if (region === null || typeof region !== 'object') return null;
  const level = REGION_LEVEL_CN[region.level];
  const status = REGION_STATUS_CN[region.status];
  if (!level || !status) {
    throw new Error(`内部不变量：${who} 拿到未知的区划命中口径（level=${shapeOf(region.level)} status=${shapeOf(region.status)}）`);
  }
  return `${region.fullName}（${level} · ${status}）`;
}

/**
 * 读侧明细表的列定义。每格都是"从结果对象里取哪两样拼成一句人话"，
 * 取不到就返回 `null`（渲染成 `—`），但**字段本身缺失**会抛——见 `pickPath` 与 `fmt` 的分工。
 * 键与 `READ_KINDS` 一一对应，多一个少一个 H6 就红。
 */
const DETAIL_SPEC = {
  idcard: [
    { label: '区划', fmt: (r) => (r.info.areaCode ? `${r.info.areaCode} · ${regionRow(r.info.region, '身份证')}` : null) },
    { label: '出生日期', fmt: (r) => r.info.birth },
    { label: '年龄', fmt: (r) => (r.info.ageYears === null ? null : `${r.info.ageYears} 岁`) },
    { label: '性别', fmt: (r) => r.info.sex },
    { label: '顺序码', fmt: (r) => r.info.seq },
    { label: '校验位', fmt: (r) => (r.info.checkBit ? `号码末位 ${r.info.checkBit}，算得 ${r.info.expectedCheckBit}` : null) },
    { label: '校验算式', fmt: (r) => (r.info.checkWork ? `Σ ${r.info.checkWork.sum} · mod 11 = ${r.info.checkWork.mod} · 对照表 ${r.info.checkWork.table}` : null) },
    { label: '18 位写法', fmt: (r) => r.id18, mono: true },
    { label: '15 位写法', fmt: (r) => r.id15, mono: true },
    { label: '区划数据截止', fmt: (r) => r.info.datasetVersion },
  ],
  uscc: [
    { label: '区划', fmt: (r) => (r.info.regionCode ? `${r.info.regionCode} · ${regionRow(r.info.region, '统一社会信用代码')}` : null) },
    { label: '登记管理部门码', fmt: (r) => r.info.registry.char, mono: true },
    { label: '机构类别码', fmt: (r) => r.info.category.char, mono: true },
    { label: '主体标识', fmt: (r) => r.info.subject, mono: true },
    { label: '组织机构代码', fmt: (r) => r.info.body8, mono: true },
    { label: '组织机构代码校验位', fmt: (r) => `号码第 9 位 ${r.info.orgChar}，算得 ${r.info.orgChecksum.value}（Σ ${r.info.orgChecksum.sum} · mod 11 = ${r.info.orgChecksum.remainder}）` },
    { label: '校验位', fmt: (r) => `号码末位 ${r.info.checkBit}，算得 ${r.info.expectedCheckBit}` },
    { label: '校验算式', fmt: (r) => `Σ ${r.info.checksum.sum} · mod 31 = ${r.info.checksum.remainder}` },
  ],
  bank: [
    { label: '位数', fmt: (r) => r.info.length },
    { label: '命中前缀', fmt: (r) => (r.info.bin ? `${r.info.bin}（${r.info.binLength} 位）` : null), mono: true },
    { label: '发卡行', fmt: (r) => (r.info.primary ? `${r.info.primary.bankName}（${r.info.primary.bankCode}）` : null) },
    { label: '卡种', fmt: (r) => (r.info.primary ? r.info.primary.cardTypeName : null) },
    { label: '表内登记位数', fmt: (r) => (r.info.primary ? r.info.primary.panLength : null) },
    { label: 'Luhn', fmt: (r) => (r.info.luhnGiven ? `号码末位 ${r.info.luhnGiven}，算得 ${r.info.luhnExpected}` : null) },
    { label: 'Luhn 算式', fmt: (r) => (r.info.luhnWork ? `Σ ${r.info.luhnWork.sum} · mod 10 = ${r.info.luhnWork.mod} → 校验位应为 ${r.info.luhnWork.expected}` : null) },
    { label: '行别来源', fmt: (r) => r.info.source },
  ],
  mobile: [
    { label: '位数', fmt: (r) => r.info.length },
    { label: '号段', fmt: (r) => r.info.segment, mono: true },
    { label: '运营商', fmt: (r) => r.info.carrier },
    { label: '展示格式', fmt: (r) => r.info.formatted, mono: true },
    { label: '号段来源', fmt: (r) => r.info.source },
  ],
};

/** 同前缀多行命中时另起的那张表（`matches.length > 1`） */
const MATCH_COLUMNS = [
  { label: '前缀', path: 'bin', mono: true },
  { label: '发卡行', path: 'bankName' },
  { label: '卡种', path: 'cardTypeName' },
  { label: '登记位数', path: 'panLength' },
  { label: '与本号位数吻合', fmt: (m) => (m.lengthMatches ? '是' : '否') },
];

/**
 * 解码明细表。`info` 为 `null`（结构在头几行就不成立）时不出表——
 * 那时没有任何算术量可信，出表就等于把一堆 `—` 摆成"解出来了但都是空"。
 * @param {string} kind `READ_KINDS` 之一
 * @param {object} result 该格的读侧结果
 */
export function detailTable(kind, result) {
  const columns = DETAIL_SPEC[kind];
  if (!columns) throw new TypeError(`view 的 detailTable 收到未知的 kind「${shapeOf(kind)}」，可读的值只有 ${READ_KINDS.join(' / ')}`);
  const r = result ?? {};
  if (r.info === null || r.info === undefined) return '';
  return table('tk-detail', columns, [r]);
}

/** 结构不成立 / 未收录时的"还能怎么办"那一行：`suggested*` 与 `expectedCheckBit` 走同一出口 */
const SUGGEST_KEY = { idcard: 'suggestedId18', bank: 'suggestedCard' };

export function suggestLine(kind, result) {
  const key = SUGGEST_KEY[kind];
  const v = key && result ? result[key] : '';
  if (!v) return '';
  return `<p class="tk-hint">只改校验位就能自洽：<span class="tk-mono">${esc(v)}</span>（随机合成，别当真实号码用）。</p>`;
}

/** 生成结果表的列定义，键与 `BATCH_KINDS` 一一对应 */
const COLUMNS = {
  idcard: [
    { label: '号码', path: 'id18', mono: true },
    { label: '区划', path: 'region' },
    { label: '出生日期', path: 'birth' },
    { label: '年龄', path: 'age' },
    { label: '性别', path: 'sex' },
  ],
  uscc: [
    { label: '代码', path: 'code', mono: true },
    { label: '区划', path: 'regionName' },
    { label: '主体标识', path: 'subject', mono: true },
    { label: '校验位', path: 'checkBit', mono: true },
  ],
  bank: [
    { label: '卡号', path: 'formatted', mono: true },
    { label: '发卡行', path: 'bankName' },
    { label: '卡种', path: 'cardTypeName' },
    { label: '登记位数', path: 'panLength' },
  ],
  mobile: [
    { label: '号码', path: 'formatted', mono: true },
    { label: '号段', path: 'segment', mono: true },
    { label: '运营商', path: 'carrier' },
  ],
  name: [
    { label: '姓名', path: 'name' },
    { label: '姓', path: 'surname' },
    { label: '名', path: 'given' },
    { label: '名字数', path: 'givenLength' },
  ],
  address: [
    { label: '地址', path: 'text' },
    { label: '区划码', path: 'areaCode', mono: true },
  ],
  email: [
    { label: '邮箱', path: 'email', mono: true },
    { label: '域', path: 'domain', mono: true },
  ],
  profile: [
    { label: '姓名', path: 'name.name' },
    { label: '地址', path: 'address.text' },
    { label: '邮箱', path: 'email.email', mono: true },
  ],
};

/**
 * 一批生成结果的表格。
 * @param {string} kind `BATCH_KINDS` 之一
 * @param {object[]} rows
 */
export function listTable(kind, rows) {
  const columns = COLUMNS[kind];
  if (!columns) {
    throw new TypeError(`view 的 listTable 收到未知的 kind「${shapeOf(kind)}」，可渲染的值只有 ${BATCH_KINDS.join(' / ')}`);
  }
  if (!Array.isArray(rows)) throw new TypeError(`view 的 listTable 应为结果数组，收到 ${shapeOf(rows)}`);
  if (rows.length === 0) return '<p class="tk-hint">这次没有产出任何结果。</p>';
  return table(`tk-list tk-list--${kind}`, columns, rows);
}

/**
 * 口径行：模块给的句子原样落地（转义后），一条一个 `<p>`。
 * 空串与 `null` 跳过，所以装配层可以直接把 `result.caveat` / `NOTE` 常量整包丢进来。
 * @param {(string|null|undefined)[]} texts
 */
export function noteLines(texts) {
  if (!Array.isArray(texts)) throw new TypeError(`view 的 noteLines 应为字符串数组，收到 ${shapeOf(texts)}`);
  return texts
    .filter((t) => typeof t === 'string' && t !== '')
    .map((t) => `<p class="tk-note">${esc(t)}</p>`);
}

/**
 * 一块读侧结果：徽章 + 回显 + 逐项判定表 + 明细表 +（银行卡多行命中时）前缀表 + 建议 + 口径行。
 * 顺序在这里定死，装配层不再挑——五块面板长得一样是要求，不是巧合。
 * 结果区的外层容器与 `aria-live` 由构建期骨架给（Task 8），视图只交内容，不碰属性。
 * @param {string} kind `READ_KINDS` 之一
 * @param {object} result
 * @param {(string|null|undefined)[]} notes 装配层递进来的模块常量（如信用代码那句"第 1、2 位不给名称"）——
 *   视图不 import 它们，但结果区的话术完整性由这一格补齐
 */
export function parseBlock(kind, result, notes = []) {
  if (!Array.isArray(notes)) throw new TypeError(`view 的 parseBlock 的 notes 应为数组，收到 ${shapeOf(notes)}`);
  const r = result ?? {};
  const parts = [`<p class="tk-verdict">${stateBadge(r.state)}</p>`];
  parts.push(...echoLines(r));
  parts.push(checksTable(r.checks === undefined ? [] : r.checks));
  parts.push(detailTable(kind, r));
  if (kind === 'bank' && Array.isArray(r.matches) && r.matches.length > 1) {
    parts.push(table('tk-matches', MATCH_COLUMNS, r.matches));
  }
  parts.push(suggestLine(kind, r));
  const own = [r.id15Note, r.caveat, r.note].filter((t) => typeof t === 'string' && t !== '');
  const texts = [...own, ...notes.filter((t) => typeof t === 'string' && t !== '')];
  // 身份证未收录区划时 `caveat` 与 `checks.region.detail` 是同一句，判定表已经说过就不再重复
  const shown = (r.checks || []).map((c) => c.detail);
  parts.push(...noteLines(texts.filter((t) => !shown.includes(t))));
  return `<div class="tk-result tk-result--${stateMetaOf(r.state).tone}">${parts.filter((x) => x !== '').join('')}</div>`;
}

/**
 * 一块生成结果：条数 + 表格 + 口径行。
 * @param {string} kind `BATCH_KINDS` 之一
 * @param {object[]} rows
 * @param {(string|null|undefined)[]} notes 模块给的口径常量，由装配层传进来（视图不 import 它们）
 */
export function batchBlock(kind, rows, notes = []) {
  if (!Array.isArray(notes)) throw new TypeError(`view 的 batchBlock 的 notes 应为数组，收到 ${shapeOf(notes)}`);
  const n = Array.isArray(rows) ? rows.length : 0;
  const parts = [`<p class="tk-count">共 ${n} 条</p>`, listTable(kind, rows), ...noteLines(notes)];
  return `<div class="tk-batch tk-batch--${kind}">${parts.join('')}</div>`;
}
```

- [ ] **Step 4: 跑绿**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^# (tests|pass|fail)'; echo "exit=${PIPESTATUS[0]}"
node --check dev/js/tools/view.js
wc -l dev/js/tools/view.js
```

Expected：`# tests 114`、`# pass 114`、`# fail 0`、`exit=0`（41 + 5 + 23 + 15 + 15 + 15），`wc -l` 414 行左右。

- [ ] **Step 5: 自证这 15 条有牙（二十九处变异，逐处记下红了谁）**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
mkdir -p /tmp/t5mut && cp dev/js/tools/view.js /tmp/t5mut/view.orig.js
cat > /tmp/t5mut/mut.mjs <<'EOF'
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const P = 'dev/js/tools/view.js';
const CMD = 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs';
const orig = fs.readFileSync(P, 'utf8');
/** 未变异先跑一次：拿它的 `# tests` 总数当尺子，好把"脚手架其实没跑到测试"和"这处不可达"分开 */
function run() {
  let out = '';
  try { out = execSync(`${CMD} 2>&1`, { encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  return {
    total: Number((out.match(/^# tests (\d+)/m) || [])[1] ?? -1),
    reds: [...out.matchAll(/^not ok \d+ - (H\d+)/gm)].map((x) => x[1]),
  };
}
const base = run();
if (base.total < 0 || base.reds.length > 0) {
  throw new Error(`基线就不对（# tests ${base.total}、红 ${base.reds.join(' ')}），先让全量跑绿再谈牙齿`);
}
console.log(`基线 # tests ${base.total} 全绿`);
const MUTS = [
  ['V1 ESC_MAP 里 & 那一档没了',
    "const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' };",
    "const ESC_MAP = { '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' };"],
  ['V2 转义字符类里漏掉单引号',
    '  return value.replace(/[&<>"\']/g, (c) => ESC_MAP[c]);',
    '  return value.replace(/[&<>"]/g, (c) => ESC_MAP[c]);'],
  ['V3 去掉 /g，一串里只转第一个',
    '  return value.replace(/[&<>"\']/g, (c) => ESC_MAP[c]);',
    '  return value.replace(/[&<>"\']/, (c) => ESC_MAP[c]);'],
  ['V4 转义总开关关掉（原样返回）',
    '  return value.replace(/[&<>"\']/g, (c) => ESC_MAP[c]);',
    '  return value;'],
  ['V5 把 luhn 当成有效档',
    "  luhn: { label: '校验位不符', tone: 'warn' },",
    "  luhn: { label: '有效', tone: 'ok' },"],
  ['V6 把"查不到"渲染成不通过',
    "  unlisted: { label: '表内未收录', tone: 'unknown' },",
    "  unlisted: { label: '表内未收录', tone: 'bad' },"],
  ['V7 未知状态回退成"等待输入"而不是抛',
    '    throw new TypeError(`view 收到未知的状态「${shapeOf(state)}」，STATE_META 里没有这一档`);',
    '    return STATE_META.empty;'],
  ['V8 判据的 null 档并进"不通过"',
    "    { label: '结论', fmt: (c) => (c.ok === null ? CHECK_UNKNOWN : CHECK_VERDICT[String(c.ok)]) },",
    "    { label: '结论', fmt: (c) => CHECK_VERDICT[String(c.ok)] },"],
  ['V9 判据的通过与不通过互换',
    "const CHECK_VERDICT = { true: '通过', false: '不通过' };",
    "const CHECK_VERDICT = { true: '不通过', false: '通过' };"],
  ['V10 没有判据时出空串而不是明说一句',
    `  if (checks.length === 0) return '<p class="tk-hint">还没有可判定的内容。</p>';`,
    "  if (checks.length === 0) return '';"],
  ['V11 零结果时出空串而不是明说一句',
    `  if (rows.length === 0) return '<p class="tk-hint">这次没有产出任何结果。</p>';`,
    "  if (rows.length === 0) return '';"],
  ['V12 生成表悄悄少一列（年龄）',
    "    { label: '年龄', path: 'age' },",
    ''],
  ['V13 明细表把"号段来源"改名"来源"',
    "    { label: '号段来源', fmt: (r) => r.info.source },",
    "    { label: '来源', fmt: (r) => r.info.source },"],
  ['V14 生成表取一个不存在的字段',
    "    { label: '卡号', path: 'formatted', mono: true },",
    "    { label: '卡号', path: 'pan', mono: true },"],
  ['V15 空值判定改成 falsy（0 也没了）',
    "  if (value === null || value === undefined || value === '') return EMPTY_CELL;",
    '  if (!value) return EMPTY_CELL;'],
  ['V16 区划不标命中级别与现行/历史',
    '  return `${region.fullName}（${level} · ${status}）`;',
    '  return region.fullName;'],
  ['V17 历史码当成现行码显示',
    "const REGION_STATUS_CN = { current: '现行', abolished: '历史', uncoded: '未收录', unknown: '未收录' };",
    "const REGION_STATUS_CN = { current: '现行', abolished: '现行', uncoded: '未收录', unknown: '未收录' };"],
  ['V18 结构不成立时也摆明细表',
    '  if (r.info === null || r.info === undefined) return \'\';',
    '  if (r.info === undefined) return \'\';'],
  ['V19 输入与判定串相同时也要写"原样输入"',
    "    } else if (typeof judged === 'string') {",
    '    } else if (false) {'],
  ['V20 视图自己给信用代码拼一条建议',
    "  const v = key && result ? result[key] : '';",
    "  const v = result ? (result[key] || result.expectedCheckBit || '') : '';"],
  ['V21 结果区外层类名写死成 ok',
    '<div class="tk-result tk-result--${stateMetaOf(r.state).tone}">',
    '<div class="tk-result tk-result--ok">'],
  ['V22 判定表说过的话在口径区再说一遍',
    '  parts.push(...noteLines(texts.filter((t) => !shown.includes(t))));',
    '  parts.push(...noteLines(texts));'],
  ['V23 口径行不走转义出口',
    '    .map((t) => `<p class="tk-note">${esc(t)}</p>`);',
    '    .map((t) => `<p class="tk-note">${t}</p>`);'],
  ['V24 口径行不再筛掉空值（null 直接进 esc）',
    "    .filter((t) => typeof t === 'string' && t !== '')",
    '    .filter((t) => t !== undefined)'],
  ['V25 两行命中的前缀不出多义表',
    '  if (kind === \'bank\' && Array.isArray(r.matches) && r.matches.length > 1) {',
    '  if (kind === \'bank\' && Array.isArray(r.matches) && r.matches.length > 9) {'],
  ['V26 listTable 遇到未知 kind 退化成身份证表',
    '  const columns = COLUMNS[kind];',
    '  const columns = COLUMNS[kind] || COLUMNS.idcard;'],
  ['V27 detailTable 遇到未知 kind 退化成身份证表',
    '  const columns = DETAIL_SPEC[kind];',
    '  const columns = DETAIL_SPEC[kind] || DETAIL_SPEC.idcard;'],
  ['V28 文件头多出一条 import（跨页共享层红线）',
    "export const READ_KINDS = ['idcard', 'uscc', 'bank', 'mobile'];",
    "import { seededRandom } from './random.js';\n\nexport const READ_KINDS = ['idcard', 'uscc', 'bank', 'mobile'];"],
  ['V29 等宽列改用内联样式',
    "      return `<td${c.mono ? ' class=\"tk-mono\"' : ''}>${cell(v)}</td>`;",
    "      return `<td${c.mono ? ' style=\"font-family:monospace\"' : ''}>${cell(v)}</td>`;"],
];

for (const [name, a, b] of MUTS) {
  if (!orig.includes(a)) { console.log(`!! ${name} 锚点没命中，先修脚本再说牙齿`); continue; }
  fs.writeFileSync(P, orig.replace(a, b));
  const r = run();
  if (r.total !== base.total) { console.log(`!! ${name} 只跑到 ${r.total} 条（基线 ${base.total}），这一档不算证据`); continue; }
  console.log(`${name} → ${r.reds.length ? r.reds.join(' ') : '全绿（不可达，见计划说明）'}`);
}
fs.writeFileSync(P, orig);
if (fs.readFileSync(P, 'utf8') !== orig) throw new Error('还原失败');
console.log('已还原');
EOF
cd /Users/liaolongdong/code/liaolongdong.github.io && node /tmp/t5mut/mut.mjs
```

**落地实跑（2026-09-27，`# tests 114` 全绿起步，二十九刀逐刀记录）**：29/29 全部有红、
无一处"全绿即不可达"、无一处 `!!`（锚点没命中）、无一处"只跑到 N 条"（脚手架不算数）；
每刀的红名单与下表**逐格相同**，H1–H15 每条至少被点名一次。另有一条自校验成立：
**每刀"红名单长度 = 114 − `# pass`"逐格为真**（二十九格零不一致），也就是没有出现
"红了两条但其实挂了三条"那类计数错位。起草阶段在镜像上预跑的那一份与这一轮一致，
所以下表不必改。

台账跑法在落地时改了三处，都是脚手架自己会说谎的地方，记下来给后面的格子用：

1. **不在工作树上动刀**。上一格（§G）那二十刀是在 `cpSync` 出来的副本树里跑的，这一格照做：
   变异脚本里的 `P` 指向 `/tmp/t5mut2/tree/dev/js/tools/view.js`，仓库那份一个字都不写。
   实验后除了比对还原，还要用 `git status --porcelain` 的脏指纹（路径 + 内容 diff + 未跟踪清单）
   自证工作树没被碰过——这一轮脏项 20 个前后一致。
2. **两趟台账不能共用一个 scratch 目录与一份日志**。第一趟（`/tmp/t5mut`，11:53）就是这个坑：
   两趟同时在写同一份副本树，刀名是这一趟的、跑测时文件里却是那一趟的变异，结果**逐格错位**——
   那份日志里 V7 记成"→ H1"、V23 记成"→ H3 H10 H14 H15"（本表要的是 H2 H3 与 H8），单看每一行都像
   证据，横着一比全不可信；末尾两行 `还原后 pass 113、红 H12` 与 `副本与工作树逐字节一致=false`
   更是直接说明还原时被另一趟写坏了。这一趟的归因整批作废。处置：杀掉遗留进程、确认工作树逐字节未变、换 `/tmp/t5mut2` 独占重跑
   （12:06 那份才是本表用的台账，29 刀红名单与下表逐格相同）。
   同一条日志里还有另一件事要分清：那次"工作树指纹前后差 6 行"是**另一路会话在改 `about.html` /
   `about.js` / `about.scss`**，与本任务的落地面零交集，不是实验溢出——脏指纹这一档报差异时，
   必须先按路径判"是不是自己那三条"，否则会把邻居的改动误读成自己的事故。
3. **二十九刀之前先跑两刀冒烟**。第一版台账有两处自身缺陷，`node --check` 一个都抓不到：
   把 `rows.push([` 全局改成 `pushRow([` 时把辅助函数自己的函数体也改了（无限递归、测试整段挂死），
   这一处是台账里"写完读回来比对"那一档报出来的；改完签名之后 `pushRow = (n, v)` 对不上单数组调用点
   （每行输出 `→ undefined`），这一处是**两刀冒烟**（`MUTS.length = 2`，即 V1 与 V2）打出来的——
   红名单一个三条、一个一条，两档都正常报红才算脚手架可用。修完这两处才放二十九刀。

| 变异 | 红了谁 | 说明 |
| --- | --- | --- |
| `V1 ESC_MAP 里 & 那一档没了` | **H1 H8 H15 红** | `&` 不转，`a&b` 与实体引用混在一起；H15 的标签审计也看见 |
| `V2 转义字符类里漏掉单引号` | **只 H1 红** | 只漏单引号，H1 那串多字符样本独占 |
| `V3 去掉 /g，一串里只转第一个` | **H1 H8 H15 红** | `/g` 摘掉只转第一个，单字符样本量不出来——H1 那句"五个字符同时出现"就是为它写的 |
| `V4 转义总开关关掉（原样返回）` | **H1 H8 H15 红** | 转义总开关：三处红是三条独立路径（徽章外、口径行、整区审计） |
| `V5 把 luhn 当成有效档` | **只 H2 红** | `luhn` 显示成"有效"：把没定论的卡号说成绿的，§5.4 最坏的一种 |
| `V6 把"查不到"渲染成不通过` | **H2 H3 红** | `unlisted` 的 `tone`：H2 点类名、H3 点外层容器 |
| `V7 未知状态回退成"等待输入"而不是抛` | **H2 H3 红** | 未知状态回退 = 静默按"等待输入"渲染；H2 的 `throws` 与 H3 的真向量各钉一次 |
| `V8 判据的 null 档并进"不通过"` | **只 H5 红** | `ok === null` 并进"不通过"：把"不判定"说成"判不过"，正是 §5.4 禁止的那种越界 |
| `V9 判据的通过与不通过互换` | **只 H5 红** | 通过 / 不通过互换：满对的样本与含 `null` 档的样本各判一次才稳 |
| `V10 没有判据时出空串而不是明说一句` | **只 H14 红** | 没有判据时出空串：空表读起来像"全都通过了" |
| `V11 零结果时出空串而不是明说一句` | **只 H14 红** | 零结果时出空串：同上，生成侧那一格 |
| `V12 生成表悄悄少一列（年龄）` | **只 H4 红** | 生成表少一列：H4 拿 `hHead`/`hBody` 比格数，不看内容 |
| `V13 明细表把"号段来源"改名"来源"` | **只 H4 红** | 表头改名："号段来源"是本页与 §6.4 的措辞约定，H4 的 `WANT_LABELS` 逐字比对 |
| `V14 生成表取一个不存在的字段` | **H4 H8 H15 红** | 取一个不存在的字段：`pickPath` 抛，H4 与 H8 各红一处，H15 看到整块塌掉 |
| `V15 空值判定改成 falsy（0 也没了）` | **只 H4 红** | 空值判定写成 falsy：`age: 0` 变 `—`，H4 那条零值样本专抓它 |
| `V16 区划不标命中级别与现行/历史` | **只 H10 红** | 区划不标级别与现行/历史：§5.4 要"命中到哪一层"可见 |
| `V17 历史码当成现行码显示` | **只 H10 红** | 历史码写成现行：莱芜那类撤销建制的码，只有 H10 的真向量能抓 |
| `V18 结构不成立时也摆明细表` | **H3 H10 H14 H15 红** | `info === null` 也摆明细表：把一排破折号说成"解出来了" |
| `V19 输入与判定串相同时也要写"原样输入"` | **只 H11 红** | 输入与判定串相同时仍写"原样输入 …，参与判定的是…"：H11 三种归一各有说法 |
| `V20 视图自己给信用代码拼一条建议` | **只 H13 红** | 视图自己给信用代码拼建议：`SUGGEST_KEY` 里没有 `uscc`，H13 那句"没有建议时整行不出"红 |
| `V21 结果区外层类名写死成 ok` | **H3 H14 红** | 外层类名写死 `ok`：徽章对了容器错了，读屏与样式两套口径分叉 |
| `V22 判定表说过的话在口径区再说一遍` | **只 H9 红** | 判定表说过的话在口径区再说一遍：H9 数的是同一句落地次数 |
| `V23 口径行不走转义出口` | **只 H8 红** | 口径行不走 `esc`：转义只有一个出口这条约束的真实含义 |
| `V24 口径行不再筛掉空值（null 直接进 esc）` | **只 H8 红** | 口径行不筛空：`null` 直接进 `esc` 就抛，装配层没法整包丢进来 |
| `V25 两行命中的前缀不出多义表` | **只 H12 红** | 两行命中不出多义表：H12 用真向量（`6222` 与 `4900` 两类命中）盯住这一格 |
| `V26 listTable 遇到未知 kind 退化成身份证表` | **只 H6 红** | 未知 `kind` 退化成身份证表：生成侧串门到读侧的列定义 |
| `V27 detailTable 遇到未知 kind 退化成身份证表` | **只 H6 红** | 同 V26 的另一半：读侧 `detailTable` |
| `V28 文件头多出一条 import（跨页共享层红线）` | **只 H7 红** | 文件头多一条 import：H7 扫源文本，跨页共享层体积红线 |
| `V29 等宽列改用内联样式` | **只 H7 红** | 内联样式：颜色与尺寸归 `toolkit.scss`（Task 8），§6.4 只允许语义令牌 |

三条从这轮才看出来的口径：**转义那一族必须用多字符样本才量得准**（V1 / V2 / V3 分别只红在
`&`、单引号、"只转第一个"上，单字符样本三档全绿）；**"未知状态要抛"这一条同时被 H2 的
`throws` 与 H3 的真向量钉住**（V7 两处都红，只写 `throws` 那一半的话，容器类名会悄悄变成 `idle`）；
**V18 一处红四条**（H3 H10 H14 H15）——"结构不成立时不摆空表"横跨三态、明细表、空输入说法和
标签审计四个口径，这条约束真有人在守。

- [ ] **Step 6: 记一次耗时与体积（Task 10 的性能口径要用）**

整段脚本原样进 `bash`，只改第一行的 `cd`：

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
echo "loadavg $(sysctl -n vm.loadavg)"     # ← 落地时补的一行：负载不留读数，下面的数就没法解释
for i in 1 2 3 4 5 6 7; do node --input-type=module -e "
const t0 = performance.now(); await import('./dev/js/tools/view.js');
console.log('import view.js', (performance.now() - t0).toFixed(2) + 'ms');
"; done
node --input-type=module -e "
const v = await import('./dev/js/tools/view.js');
const { parseIdCard, generateIdCards } = await import('./dev/js/tools/idcard.js');
const { parseUscc } = await import('./dev/js/tools/uscc.js');
const { parseBankCard } = await import('./dev/js/tools/bankcard.js');
const { parseMobile } = await import('./dev/js/tools/phone.js');
const { generateNames, generateProfiles } = await import('./dev/js/tools/random-data.js');
const bench = (fn, n) => {
  for (let k = 0; k < 500; k += 1) fn(k);                  // 预热 500 次，不然量到的是 JIT 爬坡
  const s = performance.now();
  for (let k = 0; k < n; k += 1) fn(k);
  return ((performance.now() - s) / n * 1000).toFixed(2) + 'µs/次';
};
const okId = parseIdCard('110101199003070011');            // 现行县码、校验位相符：满表，建议行不出
const unlistedId = parseIdCard('610199199003070011');      // 区划未收录 + 校验位不符：走「判定表说过的不重复」那条去重路径
const bank = parseBankCard('622307920707762365');          // 同前缀两行命中（工行 / 九江银行）：多出一张前缀表
const uscc = parseUscc('91350100M000100Y43');
const mobile = parseMobile('13800138000');
const ids20 = generateIdCards({ count: 20 });
const prof20 = generateProfiles({ count: 20 });
const names50 = generateNames({ count: 50 });
const escSample = ('<span class=x>北京市东城区测试&专用号码</span>').repeat(2) + '0123456789'.repeat(5);
console.log('esc 样本', escSample.length, '字符 /', (escSample.match(/[<>&]/g) || []).length, '个特殊字符');
console.log('parseBlock 身份证（有效，10 列明细）    ', bench(() => v.parseBlock('idcard', okId, []), 4000));
console.log('parseBlock 身份证（区划未收录，走去重）  ', bench(() => v.parseBlock('idcard', unlistedId, []), 4000));
console.log('parseBlock 银行卡（两行命中，多一张表）  ', bench(() => v.parseBlock('bank', bank, []), 4000));
console.log('parseBlock 信用代码（8 列明细）          ', bench(() => v.parseBlock('uscc', uscc, []), 4000));
console.log('parseBlock 手机号（5 列明细）            ', bench(() => v.parseBlock('mobile', mobile, []), 4000));
console.log('batchBlock 身份证 20 条                  ', bench(() => v.batchBlock('idcard', ids20, []), 3000));
console.log('batchBlock 三元组 20 组（跨三层取值）    ', bench(() => v.batchBlock('profile', prof20, []), 2000));
console.log('listTable 姓名 50 条                     ', bench(() => v.listTable('name', names50), 2000));
console.log('esc ' + escSample.length + ' 字符                        ', bench(() => v.esc(escSample), 20000));
let g0 = performance.now();
for (let i = 0; i < 50; i += 1) v.batchBlock('idcard', generateIdCards({ count: 50 }), []);
console.log('满批一轮：生成 50 条 + 渲染 =', ((performance.now() - g0) / 50).toFixed(2) + 'ms/批');
"
echo "loadavg2 $(sysctl -n vm.loadavg)"
wc -c dev/js/tools/view.js
cat dev/js/tools/view.js | gzip -9 -c | wc -c     # 口径一：全站统一的判据口径（无文件头里的原名）
cat dev/js/tools/view.js | gzip -6 -c | wc -c     # 口径二：只换压缩级别，比口径一多 11 字节
gzip -6 -c dev/js/tools/view.js | wc -c           # 口径三：起草时用的那条，同级别下再多 8 字节
```

落地实跑 **2026-09-27**，本机 Node v22.19.0。同一份脚本连跑两拨、每拨六轮（冷启动 42 次 +
每档六个稳态读数），两拨之间隔了十几分钟：

- **A 拨**跑的时候没留负载读数——脚本里那两行 `sysctl -n vm.loadavg` 是 B 拨才补上的。
- **B 拨**的一分钟 load average 全程 **10.00–10.79**（同时刻采的五分钟 **14.04–14.65**、
  十五分钟 **28.42–29.32**），机器一直在忙。

稳态口径：每档先跑 500 次预热再取均值。下表给两拨各自的中位、以及两拨合在一起（n=12）的
中位与全距：

| 档位 | A 中位 | B 中位 | 合并中位 | 合并全距 |
| --- | --- | --- | --- | --- |
| `parseBlock` 身份证（有效，10 列明细） | 62.8µs | 106.9µs | 78.0µs | 59.9–205.2 |
| `parseBlock` 身份证（区划未收录，走去重路径） | 55.9µs | 92.8µs | 69.3µs | 51.3–100.5 |
| `parseBlock` 银行卡（同前缀两行命中，多一张前缀表） | 64.0µs | 107.8µs | 75.6µs | 56.4–122.1 |
| `parseBlock` 信用代码（8 列明细） | 51.2µs | 84.1µs | 60.3µs | 48.0–92.6 |
| `parseBlock` 手机号（5 列明细） | 41.4µs | 73.9µs | 54.2µs | 37.3–89.2 |
| `batchBlock` 身份证 20 条 | 121.9µs | 208.8µs | 147.6µs | 109.2–305.1 |
| `batchBlock` 三元组 20 组（跨三层取值） | 90.7µs | 162.1µs | 142.1µs | 83.2–283.1 |
| `listTable` 姓名 50 条 | 255.6µs | 478.9µs | 290.2µs | 206.5–657.8 |
| `esc` 118 字符含 10 个特殊字符 | 3.2µs | 5.0µs | 4.1µs | 2.7–6.9 |
| 满批一轮：生成 50 条 + 渲染 | 2.02ms | 3.46ms | 2.48ms | 1.84–4.33 |

**同一份脚本、同一个文件，两拨的中位差到 1.7 倍**（`parseBlock` 身份证 62.8 → 106.9，冷启动
9.20 → 15.09ms）——这批数只能判量级，不能拿来设阈值，这就是把它写成"两拨 + 合并"而不是一批
数的原因。冷启动：七个进程各一次 × 六轮 × 两拨 = **84 次**，合并中位 **11.86ms**、全距
**6.77–39.47ms**。这个数与 §G 那 38–49ms 的**性质不同**：`view.js` 零 import（H7 判的就是这一条），
进程时里没有跟着它解析任何数据模块，`region-data.js` 那 100,020 字节一分钱不收——这一格对跨页
共享层的**体积**贡献只有下面那 8,178 字节 gzip（口径一）。

三批数放在一起看：起草阶段（2026-09-26）在镜像上跑等价脚本、同样预热 500 次，记的是冷启动中位
8.35ms（6.31–52.54）、`parseBlock` 46.2–66.9µs、满批一轮 2.67ms（1.73–4.33），当时桌面负载 9–27。
三批落在同一个量级上，批次之间最大差 1.7 倍。**能站住的结论只有两条**：单块面板的渲染在
**0.04–0.15ms** 档（`parseBlock` 五档合并中位 54–78µs、`batchBlock` 两档 142–148µs），比"一次输入
到重绘"的 16ms 帧预算小两个数量级；"生成 50 条 + 渲染"整轮三批最坏 **4.33ms**，页面侧不需要为视图
渲染做防抖或分片。Task 10 的 headless Chrome 量的是首屏与交互的端到端时间，这些 µs 不进那条账——
性能预算真正看的是 gzip 字节。另：Step 4 那条全量命令的 `# duration_ms` 起草时测得 **3.8–11.2s**、
落地这轮 **14.2s**，同样随桌面负载漂一个量级，**不要**用它当门禁，门禁只看 `exit=0` 与 `# fail 0`。

Expected：`wc -c` **21,837 字节**；gzip 按上面三条口径分别是 **8,178 / 8,189 / 8,197**
（差值是压缩级别与 gzip 头里的原名，与内容无关）。起草时那条 `gzip -6 -c 文件` 写的 **8,198**
比今天同口径实测的 8,197 多 1 字节，**未归因**（同机同 gzip 单次重跑没法把这 1 字节拆开），
判据只认口径一那一个数。文件 **414 行**（`wc -l`），其中注释 **119 行 / 8,307 字节**（行占 29%、
字节占 38%——比 `random-data.js` 的 48.3% 低一档（同一轮 Task 4 复核整改把它从 45.5% 抬上去的），
这一格的大头是列定义而不是"为什么这么判"）；
导出 **14 个**（`READ_KINDS`、`BATCH_KINDS`、`EMPTY_CELL`、`STATE_META`、`esc`、`stateBadge`、
`checksTable`、`echoLines`、`detailTable`、`suggestLine`、`listTable`、`noteLines`、`parseBlock`、
`batchBlock`）；顶层私有名 **15 个**——函数 **6 个**（`shapeOf`、`cell`、`pickPath`、`table`、
`stateMetaOf`、`regionRow`，其中 `table` 是十二张表的唯一构造点）加大写数据常量 **9 个**
（`REGION_STATUS_CN`、`REGION_LEVEL_CN`、`CHECK_VERDICT`、`CHECK_UNKNOWN`、`ESC_MAP`、`DETAIL_SPEC`、
`MATCH_COLUMNS`、`SUGGEST_KEY`、`COLUMNS`）。起草时那句"私有函数 16 个（`shapeOf`、`cell`、
`pickPath`、`table`、`stateMetaOf`、`regionRow`、`suggestLine` 之类）"两处不对：把函数与数据常量
混在一起数，且 `suggestLine` 是导出项而不是私有名——按上面的 census 重立，别拿 16 当基线。
产物口径（terser 之后）同样到 Task 9 的收录面一起量。

- [ ] **Step 7: 提交**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
git status --porcelain
git add dev/js/tools/view.js scripts/toolkit-tests.mjs scripts/verify-plan-blocks.mjs
git commit -m "$(cat <<'EOF'
feat(tools): 视图层 view.js——六档状态到三态徽章的一次映射

零 import 是体积红线：这一格挂进 window.Tk 给三页共用，多一条 import 就把
region-data.js（100,020 字节）拽进跨页共享层，§7 的 60KB 页面预算当场破。
H7 扫源文本数 import 必须为 0，V28 补一条就红。
转义只有 esc 一个出口，深样本 </script> 由 H15 的标签白名单审计整个结果区；
null 不在 esc 里兜，"这一格可以是空"由列定义显式声明。
checkdigit 与 luhn 同为"校验位不符"，unlisted 自成一档——查不到不下无效结论；
未知 state 一律抛，不让"视图没见过"静默退化成"按有效渲染"。
十二张表共用同一个 table() 构造点，列数一致是构造保证；口径文案原样透传、
判定表已经说过的不再重复一遍。
EOF
)"
git status --porcelain | head
```

Expected：**真实落地 `528ccdf` 是三条路径**（`view.js` 414 行新增、`toolkit-tests.mjs` +361 行、
`verify-plan-blocks.mjs` 的 `FILE_TARGETS` 一行）；上面那段 `git add` 起草时只有前两条，落地时补成
三条——第三条同上两格
的理由：不登记就被门禁二的反查退 1。另外上面那份预备好的提交信息里有一句"§7 的 60KB 页面预算当场破"
——**落地时不能照抄**，§7 的预算 2026-09-27 已改判为 gzip ≤ 76KB（回填见 Task 2 Step 6 末那段
blockquote，拍板理由在 Task 7 Step 6 末），提交信息按新口径写、并点明源文件 JSDoc 里那句
"≤ 60KB"是旧口径、留给 Task 11。
剩下仍是对方那批未提交项。`_docs/superpowers/plans/` 里这份计划按 Task 11 的收口节奏单独提。

## Task 6: `panel-dom.js` — 面板 DOM 绑定层（§6.3 的落地，全站唯一一处 ARIA 口径）

**Files:**
- Create: `dev/js/tools/panel-dom.js`
- Modify: `scripts/verify-plan-blocks.mjs`（`FILE_TARGETS` 加一行，同 Task 5）
- Modify: `scripts/toolkit-tests.mjs`（追加 §I，16 条 → 全量 130 条；§H 落地后基线是 114，
  这一格起草时写的 126 是旧基线，见上面"基线再涨到 69"那段）

这一格把段 1 那台纯状态机接到真节点上：`panel.js` 算属性表、`panel-dom.js` 写属性表，
`toolIdcard.js`（Task 7）只管业务与渲染函数。设计文档 §6.3 那四条要求——真 ARIA、`#hash`
双向同步与深链、面板内一块抛错只塌那一块、以及"JS 未执行时面板全部可见"——前四条里除了
最后一条（那是构建期骨架 + CSS 的活，Task 8 / Task 9 判）都落在这里。七条口径先立住：

1. **属性表只写不判，全站只允许一处 ARIA 口径。** `tabAttr(id)` / `panelAttr(id)` /
   `tablistAttr()` 给什么就写什么：**不判断、不改名、不补默认值、不因为"骨架里好像已经有了"
   就跳过**（W3 就是把"已存在就不覆写"塞回去，一处红四条）。要改 `role` / `aria-selected` /
   `aria-controls` / `tabindex` / `hidden` 的形状，改 `panel.js` 与 §D，不许在这层加 `if`——
   否则"改一处属性"变成"改两处、漏一处"，而漏掉那一处只在读屏里看得见。唯一的按值型例外是
   `hidden`：真 DOM 上 `el.hidden = true` 与 `setAttribute('hidden','true')` 不等价（后者恒为真），
   所以它按 `typeof value === 'boolean'` 分派，而不是按键名硬编码（W1 红十三条，是这层最狠的一刀）。
2. **一次只显示一块，且缺节点那一块也算在内。** `panelAttr(id).hidden` 是可见性的唯一来源，
   整页在任意一次 `sync()` 之后恰好一块可见。写这条判据（I2 / I15）时真挖出一个缺陷：如果
   "缺 tab 的那一块"连面板节点都不记，就没有人再去覆写它的 `hidden`，于是**留下两块同时可见**
   ——W23 专抓这一格。所以 tab 与 panel 两半各记各的，属性表照写，只是缺的那半没法操作。
3. **焦点只跟键盘走。** `move()` 真的换了面板才 `focus()`，且 `focus()` 排在 `sync()` 之后
   （tabindex 要先落到新那块，否则读屏报的是旧那一项）。点 tab 不抢（焦点本来就在被点的块上）、
   `hashchange` 不抢（用户可能正在读页面别处，焦点被跳走是可访问性事故，W14 红一处）、带修饰键
   的点击与中键**整个不接**（`<a href="#id">` 的开新标签语义就是深链的价值，W9 / W10 各红一处）。
   按键路径上 `preventDefault()` 无条件先做（W11）——方向键与 `Home`/`End` 在浏览器里的默认动作
   就是滚动，索引条拿到焦点时按上下会滚整页，这是这个组件最容易漏的一条键盘缺陷。
4. **地址栏只在用户动手之后写，且三种情况各不写。** `toHash()` 返回空串（用户还没碰过）不写；
   `location.hash` 已经是目标值不写（W16）；`unknownHash()` 为真不写（W15）——坏 hash 原样留在
   地址栏上供人复制排查，只在页面里给一条提示，**绝不"帮你"退回第一块**（W30 红两处，那是把
   用户给的地址悄悄改掉）。只用 `history.replaceState`，不 `push`，不留返回栈。另一条藏在
   这里的键盘缺陷：只有一块面板的工作区里按方向键、或在第一块上按 `Home`，状态机已经把
   `touched` 置真了，跟着 sync 就会把 `#第一块` 写进地址栏——用户什么也没换来却凭空多了一条
   历史记录。所以 `moved.changed` 为假时整段不做第二件事（W12 红单块页面那条 I7）。
5. **单块错误隔离，且错误文案只走 `textContent`。** 每块面板的渲染函数共用 `run()` 那一道
   `try/catch`：抛错只 `markBroken` 那一块并把错误条插到那块面板顶部（W18 把它改成"一块抛错
   就把每块都标坏"，四处红），修好了撤条归零（W19 / W20 / W21 分别红在"不清状态"、"条还挂着"、
   "每次 sync 长一张新条"）。`message` 里可能带着用户粘贴的 `</script>` 或 `<img onerror=…>`，
   这里**没有第二次转义的机会**，走 `innerHTML` 就等于把"渲染失败提示"变成第二个 XSS 出口——
   W6 / W7 两刀由 I12 那条"恶意 message + 全节 `innerHTML` 审计"接住（I12 还断言建出来的节点
   只有一个、`childNodes` 里只有文本）。
6. **缺节点分两种，骨架缺陷不许被 `run()` 洗白。** 整页没有 tablist 容器＝没有索引，那不是
   "一块塌"，`mount()` 当场抛 `RangeError` 点名是哪个 id（W28 把档位写成 `TypeError` 就红——
   形状对而页面上找不到，与 `markBroken` 同档，不是调用方接错线）；只缺某一块的 tab 或 panel＝
   那一块标坏（W22）、不跑它的渲染函数（W25），但 `run()` 对这块**永久报 `false`**（W24）：
   骨架缺陷不可能靠再跑一次渲染函数修好，跑成功了反而会把"缺节点"这条真话从错误条上洗掉。
   这种缺陷的真判据在构建期：Task 9 的收录面断言 `ids` 与页面里的 panel 节点一一对应。
7. **前缀只从状态机取、本节不新增依赖。** 所有 id 都从 `tabAttr(id).id` / `panelAttr(id).id` /
   `tablistAttr().id` 拿，W27 把 `tabAttr(id).id` 换成写死的 `tk-tab-${id}` 就会红在 I16——
   §6.4 那两条黑名单前缀（`.tk-` / `.jt-`）对应的两套工作台换的只是构造参数，不换代码。
   站内 devDeps 没有 jsdom / linkedom / cheerio（§0.5 实测），§I 用手写假 DOM，**不新增依赖**；
   这层用到的 API 一共十四个（见 §I 文件头清单），假 DOM 只需要实现这十四个，
   多出来的形状一律不在判据里出现——真 DOM 行为留给 Task 10 的 headless Chrome 实测。

源码里 `import { keyAction } from './panel.js'` 是本节唯一一条 import。这与 §0.2 那条白屏实测
不冲突：`panel.js` 与 `panel-dom.js` 都由 `toolkitCore.js`（Task 8）挂成 `window.Tk`，编到同一个
入口产物里，页面入口 `toolIdcard.js` 仍然什么都不 import；Task 9 的 `import{` 计数判的是产物。

- [x] **Step 1: 先写 §I 的 16 条判据（此时 `panel-dom.js` 还不存在，必红）**

追加到 `scripts/toolkit-tests.mjs` 末尾（§H 之后）。本节只新引 `panel-dom.js` 一个模块：
`createPanelWorkspace`、`TOOLKIT`（§A 顶部那份 `[...new Set(ids)]` 清单）、`CODEC` 在 §D 顶层已经
解构过了，**同名 `const` 再声明一次是 SyntaxError**——这是本节最容易踩的接线坑，所以解构那一句
单独成行，并在注释里写明原因。假 DOM 与六个辅助（`iPage` / `iAttr` / `iOf` /
`iVisible` / `iBanner` / `iEvts`）全部带 `i` 前缀，与 §B–§H 的顶层名字不重名。

> **2026-09-27 落地时改了这一格块的行序**：草稿把 `//（本节只新引…）` 那四行与
> `const { createPanelDom } = await import(…)` 写在 `// ── §I` 标记**之前**，而
> `verify-plan-blocks.mjs` 的 `splitAtMarks()` 明确"标记之前的那些行不属于任何一节，丢掉"。
> 照原样落盘会有两种错形状同时发生：那五行不进镜像（从此静默不核），而磁盘上它们被算进
> §H 那一节的尾巴（§H 到文件末尾为止），于是 §H 立刻 `✗ 逐字节不等`。现在按 §G / §H 的既有
> 形状写成"标记行打头、紧随其后才是说明注释与解构"，落盘内容与镜像块一字不差。

```js
// ── §I 面板 DOM 绑定（手写假 DOM） ─────────────────────────────────────────
//（本节只新引 `panel-dom.js` 一个模块：`createPanelWorkspace` 与两份 id 清单
//  `TOOLKIT` / `CODEC` 在 §D 顶层已经解构过了，同名 `const` 再声明一次是 SyntaxError；
//  假 DOM 与六个 `i*` 前缀的辅助（`iPage` / `iAttr` / `iOf` / `iVisible` / `iBanner` / `iEvts`）
//  全是本节新名字，与 §B–§H 的顶层名字不重名。）
const { createPanelDom } = await import('../dev/js/tools/panel-dom.js');

/**
 * 手写假 DOM。绑定层用到的读写口子一共十四个：document 两个（`getElementById` /
 * `createElement`）、节点八个（`setAttribute` / `removeChild` / `insertBefore` / `firstChild` /
 * `textContent` 写 / `hidden` / `focus` / `addEventListener`）、外面四个（`location.hash`、
 * `history.state`、`history.replaceState`、`window.addEventListener('hashchange')`）。
 * 判据自己还要读 `getAttribute` 与 `childNodes`，那是测试侧的观察口，绑定层一个都不碰。
 * 站内没有 jsdom（§0.5 实测：devDeps 只有 autoprefixer / concurrently / postcss /
 * postcss-px-to-viewport / sass / terser / vite），为一个绑定层加依赖要动 `package.json`
 * 与锁文件，正撞 0.6 那条并发面。
 *
 * 三处刻意的"不像真 DOM"，每一处都是为了少一处假绿：
 * 1. **没有 `innerHTML`**。绑定层若写了它，只会长出一个普通属性、一个子节点都不多——
 *    I12 判的就是"错误条里没有长出元素"。真 DOM 反而会把标签解析出来，把这条判据洗白。
 * 2. **`removeChild` 找不到节点就抛**。真 DOM 抛 `NotFoundError`；这里静默的话"撤条没撤干净"看不见。
 * 3. **`replaceState` 会同步改 `location.hash`**，跟浏览器一致。不改的话 I4 那条
 *    "重复点同一块不重复写地址栏"永远测不到（比对 `location.hash` 那一步恒假）。
 *
 * **§J 借的是这一个工厂**，所以它多开五张读写口子（`value` / `disabled` / `select()` /
 * `document.body` / `document.execCommand`）与三个观察口（`mk` / `selLog` / `commandLog`）。
 * 上面三条"不像真 DOM"一条没撤，本节十六判也没有一条读这些新口子——`value` 与 `disabled`
 * 是表单控件的事，绑定层只碰属性表与 `hidden`；两节共用一份工厂，是为了不让假 DOM 长第二套。
 */
function iPage({
  ids = TOOLKIT, prefix = 'tk', hash = '', dropTab = [], dropPanel = [], withTablist = true,
} = {}) {
  const nodes = new Map();
  const focusLog = [];
  const historyCalls = [];
  let created = 0;

  const mkText = (text) => ({ nodeType: 3, tagName: '#text', textContent: String(text) });
  /** §J 的复制兜底与下拉填充要这三张口子；§I 的十六判一条都不读它们（见 §J 开头第 0 条） */
  const selLog = [];
  const commandLog = [];
  const made = [];

  const mkEl = (tag, id = '', seed = {}) => {
    const attrs = new Map();
    const listeners = new Map();
    const el = {
      nodeType: 1, tagName: tag.toUpperCase(), id, attrs, childNodes: [], hidden: false,
      value: '', disabled: false,
      get firstChild() { return el.childNodes.length ? el.childNodes[0] : null; },
      get textContent() { return el.childNodes.map((n) => n.textContent).join(''); },
      set textContent(v) { el.childNodes = v === '' ? [] : [mkText(v)]; },
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      setAttribute: (k, v) => { attrs.set(k, String(v)); },
      removeAttribute: (k) => { attrs.delete(k); },
      appendChild: (n) => { el.childNodes.push(n); return n; },
      insertBefore: (n, ref) => {
        const i = ref ? el.childNodes.indexOf(ref) : -1;
        if (i < 0) el.childNodes.push(n);
        else el.childNodes.splice(i, 0, n);
        return n;
      },
      removeChild: (n) => {
        const i = el.childNodes.indexOf(n);
        if (i < 0) throw new Error('removeChild：假 DOM 的这个父节点下没有它');
        el.childNodes.splice(i, 1);
        return n;
      },
      addEventListener: (type, fn) => {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      dispatch: (type, evt = {}) => {
        for (const fn of listeners.get(type) || []) fn(evt);
        return evt;
      },
      focus: () => { focusLog.push(el.id); },
      /** 临时 `<textarea>` 那条兜底路径要 `select()`；记下来供 §J 判"用完有没有摘掉" */
      select: () => { selLog.push(el); },
    };
    for (const [k, v] of Object.entries(seed)) {
      if (k === 'hidden') el.hidden = Boolean(v);
      else attrs.set(k, String(v));
    }
    if (id !== '') nodes.set(id, el);
    made.push(el);
    return el;
  };

  const doc = {
    getElementById: (id) => (nodes.has(id) ? nodes.get(id) : null),
    createElement: (tag) => { created += 1; return mkEl(tag); },
    createTextNode: mkText,
    /** §J 的 `legacyCopy` 要往 `body` 上挂临时节点，`execCommand` 的返回值由夹具说了算 */
    body: mkEl('body'),
    copyOk: true,
    execCommand: (name) => { commandLog.push(name); return doc.copyOk === true; },
  };
  const location = { hash };
  const history = {
    state: null,
    replaceState(state, title, url) {
      historyCalls.push({ state, title, url });
      location.hash = url;
    },
  };
  const winListeners = new Map();
  const win = {
    addEventListener: (type, fn) => {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    dispatch: (type) => { for (const fn of winListeners.get(type) || []) fn({}); },
  };

  const ws = createPanelWorkspace({ ids, prefix, hash });
  if (withTablist) mkEl('nav', `${prefix}-tablist`, { class: 'tk-index' });
  for (const id of ids) {
    // 骨架里预置**错的** role / aria-selected：绑定层要是手抄而不是覆写，I1 当场红。
    // `class` / `href` / `aria-live` 是骨架自己的东西，属性表里没有，必须原样留着（I1 一并判）。
    if (!dropTab.includes(id)) {
      mkEl('a', `${prefix}-tab-${id}`, {
        class: 'tk-index__link', href: `#${id}`, role: 'link', 'aria-selected': 'maybe',
      });
    }
    if (!dropPanel.includes(id)) {
      mkEl('section', `${prefix}-panel-${id}`, { class: 'tk-panel', 'aria-live': 'polite' })
        .appendChild(mkText(`body:${id}`));
    }
  }
  const notice = mkEl('p', `${prefix}-notice`, { class: 'tk-notice', hidden: true });

  return {
    doc, ws, location, history, win, notice, focusLog, historyCalls, nodes,
    mk: mkEl, selLog, commandLog, made,
    tab: (id) => nodes.get(`${prefix}-tab-${id}`) ?? null,
    panel: (id) => nodes.get(`${prefix}-panel-${id}`) ?? null,
    created: () => created,
  };
}

/** 节点上现在带着哪些键（用来判"绑定层没发明表外的键、也没删骨架的键"） */
function iAttr(el) {
  return Object.fromEntries([...el.attrs.entries()]);
}
/** 只读属性表里那几键的落值：`hidden` 走属性，其余走 `getAttribute` */
function iOf(el, table) {
  return Object.fromEntries(Object.keys(table).map((k) => [k, k === 'hidden' ? el.hidden : el.getAttribute(k)]));
}
/** 当前可见的面板 id（`hidden === false`；缺节点的那块算不可见） */
function iVisible(page) {
  return page.ws.ids().filter((id) => {
    const el = page.panel(id);
    return Boolean(el) && el.hidden === false;
  });
}
/** 面板里的错误条（按类名认，不按位置认） */
function iBanner(page, id) {
  const el = page.panel(id);
  if (!el) return null;
  return el.childNodes.find((n) => n.nodeType === 1 && n.getAttribute('class') === 'tk-panel__error') ?? null;
}
const iEvts = {
  click: (over = {}) => ({
    button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...over,
  }),
  key: (key, over = {}) => ({
    key, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...over,
  }),
};

test('I1 属性表原样落地：骨架的错值被覆写，多余的键一个不动', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win, notice: page.notice,
  });
  dom.mount();
  const list = page.doc.getElementById('tk-tablist');
  assert.deepEqual(iOf(list, page.ws.tablistAttr()), {
    id: 'tk-tablist', role: 'tablist', 'aria-label': '工具面板', 'aria-orientation': 'vertical',
  }, 'tablist 容器那一格也得由属性表给');
  assert.equal(list.getAttribute('class'), 'tk-index', '骨架自己的 class 不许被抹掉');
  for (const id of TOOLKIT) {
    const table = page.ws.tabAttr(id);
    assert.deepEqual(iOf(page.tab(id), table), table, `tab ${id} 的落值与属性表不一致`);
    assert.equal(page.tab(id).getAttribute('role'), 'tab', '骨架里预置的 role="link" 必须被覆写');
    assert.equal(page.tab(id).getAttribute('href'), `#${id}`, 'href 不在属性表里，它是禁 JS 时的深链保险');
    const pTable = page.ws.panelAttr(id);
    assert.deepEqual(iOf(page.panel(id), pTable), pTable, `panel ${id} 的落值`);
    assert.equal(page.panel(id).getAttribute('aria-live'), 'polite', '骨架上的多余键不许被 removeAttribute');
  }
  assert.deepEqual(Object.keys(iAttr(page.tab('idcard'))).sort(),
    ['aria-controls', 'aria-selected', 'class', 'href', 'id', 'role', 'tabindex'],
    '节点上只有"表里那几键 + 骨架自带那几键"，绑定层不发明键');
});

test('I2 一次只显示一块：任意时刻恰好一个面板 hidden 为假', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
  });
  dom.mount();
  assert.deepEqual(iVisible(page), ['idcard']);
  assert.equal(page.panel('idcard').getAttribute('role'), 'tabpanel', '隐藏的是可见性，不是把面板降级');
  page.tab('mobile').dispatch('click', iEvts.click());
  assert.deepEqual(iVisible(page), ['mobile']);
  assert.deepEqual(
    TOOLKIT.map((id) => page.tab(id).getAttribute('aria-selected')).join(','),
    'false,false,false,true,false');
  assert.deepEqual(
    TOOLKIT.map((id) => page.tab(id).getAttribute('tabindex')).join(','),
    '-1,-1,-1,0,-1', 'roving tabindex 跟着可见那块走（§D 的互锁在 DOM 上成立）');
});

test('I3 深链进入即展开对应面板，一个 replaceState 都不发', () => {
  const page = iPage({ hash: '#bankcard' });
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
  });
  dom.mount();
  assert.deepEqual(iVisible(page), ['bankcard']);
  assert.deepEqual(page.historyCalls, [], '地址栏本来就对，不许再写一次');
  assert.equal(page.ws.unknownHash(), false);
  const plain = iPage();
  createPanelDom({
    workspace: plain.ws, document: plain.doc, location: plain.location,
    history: plain.history, window: plain.win,
  }).mount();
  assert.deepEqual(plain.historyCalls, [], '无 hash 进入时不写 hash（§6.0 第三条的 DOM 侧）');
  assert.deepEqual(iVisible(plain), ['idcard']);
  // 地址栏以裸一个 `#` 结尾时（人从别处复制网址常带上），`location.hash` 是 '#' 而不是 ''：
  // 这时状态机既没 touched 也没 unknown，只有"target 是空串就别写"这一格挡得住回写。
  const bare = iPage({ hash: '#' });
  createPanelDom({
    workspace: bare.ws, document: bare.doc, location: bare.location,
    history: bare.history, window: bare.win,
  }).mount();
  assert.deepEqual(bare.historyCalls, [], '一个裸 # 不去动它：把它"修"成没有 hash 属于多事');
  assert.deepEqual(iVisible(bare), ['idcard']);
  assert.equal(bare.ws.unknownHash(), false, '`#` 不算坏 hash，不该唠叨');
});

test('I4 点 tab：拦住锚点跳转、只换那一块、地址栏写一次', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win, notice: page.notice,
  });
  dom.mount();
  const evt = page.tab('uscc').dispatch('click', iEvts.click());
  assert.equal(evt.defaultPrevented, true, '不 preventDefault 就会跳锚点（§6.3 那句"不触发滚动跳动"）');
  assert.deepEqual(iVisible(page), ['uscc']);
  assert.equal(page.location.hash, '#uscc');
  assert.deepEqual(page.historyCalls, [{ state: null, title: '', url: '#uscc' }]);
  page.tab('uscc').dispatch('click', iEvts.click());
  assert.equal(page.historyCalls.length, 1, '点已经亮着的那块不该再写一遍地址栏');
  assert.deepEqual(iVisible(page), ['uscc']);
  assert.equal(page.notice.hidden, true);
});

test('I5 修饰键与中键的点击整个不接：深链的开新标签语义留着', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
  });
  dom.mount();
  for (const [why, over] of [
    ['ctrlKey', { ctrlKey: true }], ['metaKey', { metaKey: true }],
    ['shiftKey', { shiftKey: true }], ['altKey', { altKey: true }], ['中键', { button: 1 }],
  ]) {
    const evt = page.tab('random').dispatch('click', iEvts.click(over));
    assert.equal(evt.defaultPrevented, false, `${why}：不许拦浏览器的默认动作`);
    assert.deepEqual(iVisible(page), ['idcard'], `${why}：不许换面板`);
  }
  assert.deepEqual(page.historyCalls, [], '带修饰键与中键的点击都不写地址栏');
});

test('I6 方向键自动激活：首尾回绕、焦点跟随、滚动被拦住', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
  });
  dom.mount();
  const evts = [];
  for (let i = 0; i < TOOLKIT.length; i += 1) {
    evts.push(page.tab(page.ws.active()).dispatch('keydown', iEvts.key('ArrowDown')));
  }
  assert.deepEqual(
    page.focusLog,
    [...TOOLKIT.slice(1), 'idcard'].map((id) => `tk-tab-${id}`),
    '每次换面板焦点都跟到新那块的 tab 上（自动激活）');
  assert.equal(page.ws.active(), 'idcard', '五块面板按五次回到第一块');
  assert.deepEqual(iVisible(page), ['idcard']);
  for (const evt of evts) assert.equal(evt.defaultPrevented, true, '方向键的默认动作是滚整页');
  assert.deepEqual(page.historyCalls.map((c) => c.url),
    ['#uscc', '#bankcard', '#mobile', '#random', '#idcard'], '无 hash 进入后，第一次按键就开始写');
});

test('I7 Home/End 到位；只有一块面板时按方向键既不动作也不炸', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
  });
  dom.mount();
  page.tab('idcard').dispatch('keydown', iEvts.key('End'));
  assert.equal(page.ws.active(), 'random');
  assert.deepEqual(page.focusLog, ['tk-tab-random']);
  page.tab('random').dispatch('keydown', iEvts.key('Home'));
  assert.equal(page.ws.active(), 'idcard');
  assert.deepEqual(iVisible(page), ['idcard']);
  const solo = iPage({ ids: ['only'] });
  const soloDom = createPanelDom({
    workspace: solo.ws, document: solo.doc, location: solo.location,
    history: solo.history, window: solo.win,
  });
  soloDom.mount();
  solo.tab('only').dispatch('keydown', iEvts.key('ArrowRight'));
  assert.deepEqual(iVisible(solo), ['only']);
  assert.deepEqual(solo.focusLog, [], '没换面板就不抢焦点');
  assert.deepEqual(solo.historyCalls, [], '只有一块：无 hash 进入仍然不写地址栏');
});

test('I8 无关按键与带修饰键的按键不动状态，也不顺手 preventDefault', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
  });
  dom.mount();
  for (const [why, over] of [
    ['Shift+ArrowUp', { key: 'ArrowUp', shiftKey: true }],
    ['Ctrl+Home', { key: 'Home', ctrlKey: true }],
    ['Enter', { key: 'Enter' }], ['字母 a', { key: 'a' }], ['PageDown', { key: 'PageDown' }],
  ]) {
    const evt = page.tab('idcard').dispatch('keydown', iEvts.key(over.key, over));
    assert.equal(evt.defaultPrevented, false, `${why}：不抢浏览器的默认动作`);
    assert.equal(page.ws.active(), 'idcard', `${why}：不该换面板`);
  }
  assert.deepEqual(page.focusLog, []);
  assert.deepEqual(page.historyCalls, []);
});

test('I9 外部改地址栏：面板跟着换，但焦点不跳、地址栏不回写', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
  });
  dom.mount();
  page.location.hash = '#mobile';
  page.win.dispatch('hashchange');
  assert.deepEqual(iVisible(page), ['mobile']);
  assert.deepEqual(page.focusLog, [], 'hashchange 抢焦点＝把用户正在读的位置跳走');
  assert.deepEqual(page.historyCalls, [], '地址栏已经是它了，回写一次就是自己再触发一轮');
  assert.equal(page.tab('mobile').getAttribute('aria-selected'), 'true');
  assert.equal(page.tab('mobile').getAttribute('tabindex'), '0');
});

test('I10 坏 hash：不切成空白、不改地址栏，只给一条提示，随后自己收回去', () => {
  const page = iPage({ hash: '#mobile' });
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win, notice: page.notice,
  });
  dom.mount();
  assert.deepEqual(iVisible(page), ['mobile']);
  page.location.hash = '#nope';
  page.win.dispatch('hashchange');
  assert.deepEqual(iVisible(page), ['mobile'], '全部 hidden 与"退回第一块"都是把深链用户扔下不管');
  assert.equal(page.notice.hidden, false, '坏 hash 要给一条看得见的说法');
  assert.match(page.notice.textContent, /#nope/);
  assert.deepEqual(page.historyCalls, [], '地址栏保持原样，坏 hash 留着给人复制排查');
  page.tab('random').dispatch('click', iEvts.click());
  assert.equal(page.notice.hidden, true, '用户自己动手之后不再唠叨那条坏 hash');
  assert.deepEqual(page.historyCalls.map((c) => c.url), ['#random'], '动手之后地址栏归位');
  assert.deepEqual(iVisible(page), ['random']);
});

test('I11 渲染抛错只塌那一块：其余四块可点可键盘，塌那块的面板还在', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
    renderers: {
      idcard: (el) => el.appendChild(page.doc.createTextNode('ok:idcard')),
      uscc: () => { throw new Error('号段表读不出来'); },
      bankcard: (el) => el.appendChild(page.doc.createTextNode('ok:bankcard')),
      mobile: (el) => el.appendChild(page.doc.createTextNode('ok:mobile')),
      random: (el) => el.appendChild(page.doc.createTextNode('ok:random')),
    },
  });
  const report = dom.mount();
  assert.deepEqual(report.mounted, TOOLKIT, '五块都升级了，uscc 塌的是内容不是面板');
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.rendered, ['idcard', 'bankcard', 'mobile', 'random']);
  assert.deepEqual(report.broken, ['uscc'], '错误记在 uscc 那一格上');
  const banner = iBanner(page, 'uscc');
  assert.ok(banner, '塌了的面板顶部要有就地错误条');
  assert.match(banner.textContent, /号段表读不出来/);
  assert.match(banner.textContent, /其余面板不受影响/);
  assert.equal(banner.tagName, 'P');
  assert.equal(banner.getAttribute('role'), 'alert');
  assert.equal(page.panel('uscc').firstChild, banner, '错误条排在原有内容前面');
  assert.match(page.panel('uscc').textContent, /body:uscc/, '骨架内容不许被连带清掉');
  assert.match(page.panel('idcard').textContent, /ok:idcard/);
  assert.equal(iBanner(page, 'idcard'), null);
  page.tab('bankcard').dispatch('click', iEvts.click());
  assert.deepEqual(iVisible(page), ['bankcard'], '塌一块不影响换面板');
  page.tab('bankcard').dispatch('keydown', iEvts.key('ArrowDown'));
  assert.equal(page.ws.active(), 'mobile', '键盘也照旧：bankcard 的下一块是 mobile');
  assert.deepEqual(iVisible(page), ['mobile']);
});

test('I12 错误条与提示行只写文本：message 里的标签不会长成元素', () => {
  const hostile = '<img src=x onerror=alert(1)>';
  const page = iPage({ hash: `#${hostile}` });
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win, notice: page.notice,
    renderers: { idcard: () => { throw new Error(`坏输入：${hostile}`); } },
  });
  dom.mount();
  assert.equal(page.created(), 1, '整页只允许多出一个错误条节点：message 与 hash 都不许被解析成标签');
  const banner = iBanner(page, 'idcard');
  assert.deepEqual(banner.childNodes.map((n) => n.nodeType), [3], '错误条里只有一个文本子节点');
  assert.equal(banner.innerHTML, undefined, '绑定层不许走 innerHTML');
  assert.match(banner.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(page.notice.childNodes.length, 1);
  assert.match(page.notice.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(page.notice.hidden, false);
  assert.deepEqual(iVisible(page), ['idcard'], '坏 hash 依旧不切空白');
});

test('I13 run() 二次修好：撤掉错误条、状态归零、不留残节点；不认识的 id 抛', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
    renderers: { uscc: () => { throw new Error('第一次炸'); } },
  });
  dom.mount();
  const before = page.panel('uscc').childNodes.length;
  assert.ok(iBanner(page, 'uscc'));
  assert.equal(dom.run('uscc', (el) => el.appendChild(page.doc.createTextNode('补好了'))), true);
  assert.equal(iBanner(page, 'uscc'), null, '修好了还挂着错误条，等于骗人');
  assert.deepEqual(page.ws.brokenIds(), []);
  assert.equal(page.panel('uscc').childNodes.length, before, '撤一条、追加一条，总数不变＝没有残节点');
  assert.match(page.panel('uscc').textContent, /补好了/);
  assert.equal(dom.run('uscc', () => { throw new Error('又炸'); }), false);
  assert.deepEqual(page.ws.brokenIds(), ['uscc']);
  assert.match(iBanner(page, 'uscc').textContent, /又炸/, '二次失败要覆写文案，不能留着上一句');
  assert.equal(page.panel('uscc').childNodes.filter((n) => n.nodeType === 1).length, 1, '错误条还是那一张，没长第二张');
  assert.throws(() => dom.run('nope', () => {}), RangeError, '装配层写错面板名要当场炸');
  assert.throws(() => dom.run('uscc', '不是函数'), TypeError);
});

test('I14 幂等：sync 连跑三次属性表与错误条都不变，mount 只许跑一次', () => {
  const page = iPage();
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win, notice: page.notice,
    renderers: { mobile: () => { throw new Error('幂等样本'); } },
  });
  dom.mount();
  const snap = () => JSON.stringify({
    attrs: TOOLKIT.map((id) => [iAttr(page.tab(id)), iAttr(page.panel(id))]),
    kids: TOOLKIT.map((id) => page.panel(id).childNodes.map((n) => n.nodeType)),
    hidden: TOOLKIT.map((id) => [page.tab(id).hidden, page.panel(id).hidden]),
    notice: [page.notice.hidden, page.notice.textContent],
    created: page.created(),
    writes: page.historyCalls.length,
  });
  const first = snap();
  dom.sync();
  dom.sync();
  dom.sync();
  assert.equal(snap(), first, 'sync 幂等：多跑一次既不长节点、不改属性、也不写地址栏');
  assert.equal(page.panel('mobile').childNodes.filter((n) => n.nodeType === 1).length, 1, '错误条一张，不是三张');
  assert.throws(() => dom.mount(), RangeError, '重复 mount 会把渲染函数再跑一遍，那种双份内容比当场炸难查');
  assert.deepEqual(page.ws.brokenIds(), ['mobile']);
});

test('I15 缺节点分两种：没有索引条当场抛，缺一块只标坏那一块', () => {
  const noList = iPage({ withTablist: false });
  assert.equal(noList.doc.getElementById('tk-tablist'), null, '假 DOM 自证：这一页就是没有索引条');
  assert.equal(noList.panel('idcard') !== null, true, '五块面板都在，缺的只有容器');
  const noListDom = createPanelDom({
    workspace: noList.ws, document: noList.doc, location: noList.location,
    history: noList.history, window: noList.win,
  });
  assert.throws(() => noListDom.mount(), (err) => {
    assert.equal(err.constructor.name, 'RangeError', '形状对而页面上没有那个节点，是 RangeError 那一档');
    assert.match(err.message, /tk-tablist/, '要点名是哪个节点找不到');
    return true;
  });
  const page = iPage({ dropTab: ['uscc'], dropPanel: ['bankcard'] });
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
    renderers: { uscc: () => { throw new Error('不该被调用'); }, idcard: () => {} },
  });
  const report = dom.mount();
  assert.deepEqual(report.missing, ['uscc', 'bankcard']);
  assert.deepEqual(report.mounted, ['idcard', 'mobile', 'random']);
  assert.deepEqual(report.rendered, ['idcard']);
  assert.deepEqual(page.ws.brokenIds(), ['uscc', 'bankcard']);
  assert.match(page.ws.brokenOf('uscc'), /tk-tab-uscc.*tab 节点/);
  assert.match(page.ws.brokenOf('bankcard'), /tk-panel-bankcard.*panel 节点/);
  assert.deepEqual(iVisible(page), ['idcard'], '缺 tab 的那块面板仍然参与互锁：一次还是只显示一块');
  const degraded = iBanner(page, 'uscc');
  assert.ok(degraded, '骨架缺陷也要在那块面板上说出来，不是只记在状态里');
  assert.match(degraded.textContent, /tk-tab-uscc/);
  assert.equal(iBanner(page, 'bankcard'), null, '连面板节点都没有，错误条无处可插（也不许凭空造一块）');
  assert.equal(page.created(), 1, '整页只长出那一张错误条');
  assert.equal(dom.run('uscc', () => { throw new Error('骨架没修好之前不该被调用'); }), false);
  assert.equal(dom.run('bankcard', () => { throw new Error('同上'); }), false);
  assert.match(page.ws.brokenOf('uscc'), /tab 节点/, 'run() 报 false 时不许把"缺节点"这条真话洗成"好了"');
  page.tab('idcard').dispatch('keydown', iEvts.key('ArrowDown'));
  assert.equal(page.ws.active(), 'uscc', '状态机只管 ids，不认"缺不缺节点"');
  assert.deepEqual(iVisible(page), ['uscc'], 'uscc 只是没有 tab，面板还在，切过去看得见那句降级提示');
  assert.deepEqual(page.focusLog, [], '那块没有 tab 节点，焦点无处可去（不抛）');
  page.tab('mobile').dispatch('click', iEvts.click());
  assert.deepEqual(iVisible(page), ['mobile'], '缺 panel 的那块点过去看不到东西，但整页不崩');
});

test('I16 换的是构造参数不是代码：.jt- 那套工作台共用同一份绑定', () => {
  const page = iPage({ ids: CODEC, prefix: 'jt', hash: '#digest' });
  const dom = createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win,
  });
  dom.mount();
  assert.deepEqual(iVisible(page), ['digest']);
  assert.equal(page.doc.getElementById('jt-tablist').getAttribute('role'), 'tablist');
  assert.equal(page.nodes.has('tk-tablist'), false, '换了前缀就不该再长出 tk- 的节点');
  assert.deepEqual(iOf(page.tab('digest'), page.ws.tabAttr('digest')), page.ws.tabAttr('digest'));
  assert.equal(page.tab('digest').getAttribute('id'), 'jt-tab-digest');
  assert.equal(page.tab('base64').getAttribute('aria-controls'), 'jt-panel-base64');
  page.tab('url').dispatch('click', iEvts.click());
  assert.deepEqual(page.historyCalls.map((c) => c.url), ['#url'], 'hash 也走同一套，只是 id 换了名字');
});
```

- [x] **Step 2: 跑红，确认红的形状**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^not ok|Cannot find module|^# (tests|pass|fail)'; echo "exit=${PIPESTATUS[0]}"
```

Expected：`not ok 1 - scripts/toolkit-tests.mjs` 加一句
`ERR_MODULE_NOT_FOUND: Cannot find module '…/dev/js/tools/panel-dom.js'`，`# tests 115`、`# pass 114`
（§A–§H 那批照绿）、`# fail 1`、`exit=` 非 0。红的形状与 §E / §F / §G / §H 当时一致：**整文件挂**，
不是 16 条各挂一次——§I 的 `const { createPanelDom } = await import(…)` 在文件顶层，抛在解析期，
测试计数只多出一个"文件级子测试"。这一档要认下来：往顶层加 `await import` 的那一类判据，
**红的形状天生就是"一条红的 + N 条没跑"**，所以 Step 2 只核对 `# tests` 与 `# fail` 两个数，
不许把"16 条一条都没红"读成"判据没写进去"。

落地这一格的形状是**事后复现**的（`panel-dom.js` 已经写进工作树，原始那次红只在终端里过了一遍、
没留日志），复现办法是把整份树 `cp -R` 到 `/tmp/t6red/tree` 再删掉副本里的 `panel-dom.js`：
`# tests 115`、`# pass 114`、`# fail 1`、`not ok 1 - scripts/toolkit-tests.mjs`，报错原文里的路径是
`/private/tmp/t6red/tree/dev/js/tools/panel-dom.js`，`imported from …/scripts/toolkit-tests.mjs`；
不带管道重跑一遍取到**真退出码 = 1**（`/tmp/t6red/step2.log`、`/tmp/t6red/step2b.out`，
后者里 `# duration_ms 8891`，是 loadavg 9.43 那一档的读数——Step 4 那三轮 34–40s 的对照点）。
另外那一条 `A resource generated asynchronous activity after the test ended` 也照实记下来：
顶层 `await import` 挂掉时，runner 是在异常已经被捕获之后才把它算成文件级失败的——这正是
"整文件挂"而不是"16 条各挂"的机器证据。

- [x] **Step 3: 写 `dev/js/tools/panel-dom.js`**

```js
/**
 * `createPanelWorkspace` 的 DOM 绑定层：把状态机算好的四张属性表原样写进节点，把点击 / 按键 /
 * hashchange 三类事件原样喂回去，另外负责"一块塌了不塌整页"。
 *
 * 这一层存在的唯一理由就是段 1 计划 §6.0 写下的那句分工：**页面里只允许有一处 ARIA 口径**。
 * `panel.js` 已经把 `role` / `aria-selected` / `aria-controls` / `tabindex` / `hidden` 算成属性表，
 * 装配层若再手抄一遍，"改一处属性"就变成"改两处、漏一处"，而漏掉的那一处只在读屏里看得见。
 * 所以这里对属性表只做两件事：按表里的 `id` 找节点、逐键写值——**不判断、不改名、不补默认值、
 * 不因为"页面里好像已经有了"就跳过**。要改 ARIA 形状，改 `panel.js` 与 §D，别在这里加 `if`。
 *
 * 五条口径先立住，§I 的判据逐条对着它们咬：
 *
 * 1. **一次只显示一块**：`panelAttr(id).hidden` 是可见性的唯一来源，这层不加"滚动到了就展开"
 *    那类旁路，也不管 CSS 怎么写。整页在任意一次 `sync()` 之后恰好一块可见。
 * 2. **焦点只跟键盘走**：`move()` 真的换了面板才 `focus()`。点 tab 不抢（焦点本来就在被点的
 *    那块上），`hashchange` 不抢（用户可能正在读页面上别的位置，被焦点跳走是可访问性事故），
 *    带修饰键的点击与中键**整个不接**（`<a href="#id">` 的开新标签语义就是深链的价值）。
 * 3. **地址栏只在用户动手之后写**：`toHash()` 返回空串时一个 `replaceState` 都不发；
 *    `unknownHash()` 为真时也不写——状态机宁可让地址栏与页面短暂不一致（段 1 §6.0 第三条），
 *    这层跟着它一起不写，只在页面里给一条提示，坏 hash 原样留在地址栏上供人复制排查。
 * 4. **单块错误隔离**：每块面板的渲染函数走同一道 `run()`，抛错只标坏那一块（`markBroken`）
 *    并把错误条插到那块面板的顶部，其余四块照常可点可用。错误条与提示行一律写 `textContent`：
 *    `message` 里可能带着用户粘贴的 `</script>` 或 `<img onerror=…>`，这里**没有第二次转义的
 *    机会**，走 `innerHTML` 就等于把"渲染失败提示"变成第二个 XSS 出口。
 * 5. **缺节点分两种**：整页没有 tablist 容器＝没有索引，那不是"一块塌"，`mount()` 当场抛
 *    `RangeError`（形状对而页面上找不到，与 `markBroken` 同档）；只缺某一块的 tab 或 panel＝
 *    那一块标坏、不跑它的渲染函数，但**属性表照写**（缺 tab 的那块面板仍参与可见性互锁，
 *    缺 panel 的那块 tab 仍能被点与被键盘走到，只是切过去看不到东西）。索引与键盘照旧能用。
 *    这种骨架缺陷的真判据在构建期：Task 9 的收录面断言 `ids` 与页面里的 panel 节点一一对应。
 *
 * 前缀不在这里出现第二次：所有 `id` 都从 `tabAttr(id).id` / `panelAttr(id).id` /
 * `tablistAttr().id` 取，所以 `.jt-` 那套工作台（§6.4 两条黑名单前缀）换的只是构造参数。
 *
 * @param {object} options 构造参数，缺哪一个都会当场抛（装配层写错不该降成一条看起来像用户
 *   行为的结论，与 `panel.js` / `idcard.js` / `uscc.js` 同档：形状不对是 `TypeError`，
 *   形状对而值不能用是 `RangeError`，两句都点名是哪一个键）
 * @param {object} options.workspace `createPanelWorkspace()` 的返回值，必须齐那十四个方法
 * @param {object} options.document 提供 `getElementById` / `createElement`，浏览器里就是 `document`
 * @param {object} options.location 提供字符串 `hash`
 * @param {object} options.history 提供 `replaceState`
 * @param {object} options.window 只在它上面听 `hashchange`
 * @param {object} [options.renderers] `id → (panelElement) => void`，构建期骨架之外要补的内容；
 *   键必须落在 `workspace.ids()` 里，多余的键是装配层写错了面板名，抛 `RangeError`
 * @param {object} [options.notice] 坏 hash 提示行的节点，不传就只记状态、页面上不多说话
 * @returns {{mount: () => {mounted: string[], missing: string[], rendered: string[], broken: string[]},
 *   sync: () => void, run: (id: string, fn: (el: object) => void) => boolean}}
 */
import { keyAction } from './panel.js';

/** 错误条的类名是 `toolkit.scss`（Task 8）的钩子；这里只给形状，颜色与字号一律不在 JS 里 */
const ERROR_CLASS = 'tk-panel__error';
const BANNER_BEFORE = '这一块面板没能渲染出来：';
const BANNER_AFTER = '。其余面板不受影响。';

/** `workspace` 必须齐的方法。少一个就不是"这一版还没做"，而是装配层接错了线，直接抛。 */
const WORKSPACE_API = [
  'ids', 'active', 'unknownHash', 'tablistAttr', 'tabAttr', 'panelAttr',
  'select', 'move', 'applyHash', 'toHash', 'markBroken', 'brokenOf', 'brokenIds', 'clearBroken',
];

export function createPanelDom({
  workspace, document, location, history, window: win, renderers = {}, notice = null,
} = {}) {
  if (!workspace || typeof workspace !== 'object') {
    throw new TypeError(`createPanelDom：options.workspace 应为 createPanelWorkspace() 的返回值，收到 ${shapeOf(workspace)}`);
  }
  for (const name of WORKSPACE_API) {
    if (typeof workspace[name] !== 'function') {
      throw new TypeError(`createPanelDom：options.workspace 缺方法 ${name}()，绑定层不接受自己算 ARIA`);
    }
  }
  if (!document || typeof document.getElementById !== 'function' || typeof document.createElement !== 'function') {
    throw new TypeError('createPanelDom：options.document 要有 getElementById 与 createElement，绑定层不用 querySelector');
  }
  if (!location || typeof location.hash !== 'string') {
    throw new TypeError(`createPanelDom：options.location.hash 应为字符串，收到 ${shapeOf(location && location.hash)}`);
  }
  if (!history || typeof history.replaceState !== 'function') {
    throw new TypeError('createPanelDom：options.history 要有 replaceState，写地址栏只用它（不 push，不留返回栈）');
  }
  if (!win || typeof win.addEventListener !== 'function') {
    throw new TypeError('createPanelDom：options.window 要能 addEventListener(\'hashchange\')');
  }
  if (typeof renderers !== 'object' || renderers === null || Array.isArray(renderers)) {
    throw new TypeError(`createPanelDom：options.renderers 应为 { 面板 id: 渲染函数 }，收到 ${shapeOf(renderers)}`);
  }
  const ids = workspace.ids();
  for (const [key, fn] of Object.entries(renderers)) {
    if (!ids.includes(key)) {
      throw new RangeError(`createPanelDom：renderers.${key} 不在 ids 里（${ids.join(', ')}），这块面板的渲染函数没人调用`);
    }
    if (typeof fn !== 'function') {
      throw new TypeError(`createPanelDom：renderers.${key} 应为函数，收到 ${shapeOf(fn)}`);
    }
  }
  if (notice !== null && (typeof notice !== 'object' || typeof notice.setAttribute !== 'function')) {
    throw new TypeError(`createPanelDom：options.notice 应为节点或 null，收到 ${shapeOf(notice)}`);
  }

  const tabNode = new Map();
  const panelNode = new Map();
  const bannerNode = new Map();
  /** 骨架不完整（缺 tab 或缺 panel）的那几块：不跑渲染函数，也不许被 `run()` 洗成"好了" */
  const incomplete = new Set();
  let mounted = false;

  /**
   * 逐键原样写。只有 `hidden` 走属性而不是 `setAttribute`——它是 `panelAttr` 里唯一的布尔值，
   * 真 DOM 上 `el.hidden = true` 与 `setAttribute('hidden','true')` 并不等价（后者恒为真），
   * 所以这一格必须按值型分派，而不是按键名硬编码。节点为 `null` 时直接返回：缺哪一块由
   * `mount()` 记进状态，不该在这里变成一句 `Cannot read properties of null`。
   */
  const writeAttrs = (el, attrs) => {
    if (!el) return;
    for (const [key, value] of Object.entries(attrs)) {
      if (typeof value === 'boolean') el.hidden = value;
      else el.setAttribute(key, String(value));
    }
  };

  const bannerText = (message) => `${BANNER_BEFORE}${message}${BANNER_AFTER}`;

  /** 错误条只在"坏 ↔ 好"翻转时增删，文案每次都覆写（`run()` 二次失败可能换了原因） */
  const paintBanner = (id) => {
    const message = workspace.brokenOf(id);
    const panel = panelNode.get(id);
    const existing = bannerNode.get(id);
    if (message === '') {
      if (existing) {
        if (panel) panel.removeChild(existing);
        bannerNode.delete(id);
      }
      return;
    }
    if (!panel) return;
    if (existing) {
      existing.textContent = bannerText(message);
      return;
    }
    const node = document.createElement('p');
    node.setAttribute('class', ERROR_CLASS);
    node.setAttribute('role', 'alert');
    node.textContent = bannerText(message);
    panel.insertBefore(node, panel.firstChild);
    bannerNode.set(id, node);
  };

  /** 坏 hash 的提示：地址栏里是什么就说什么，不解释、不百分号解码（那是浏览器显示的那一串） */
  const paintNotice = () => {
    if (!notice) return;
    if (!workspace.unknownHash()) {
      notice.hidden = true;
      return;
    }
    notice.hidden = false;
    notice.textContent = `地址栏里的 ${location.hash} 不是本页的某一块面板，已保持当前面板。`;
  };

  /** 口径 3：两种"不写"各自独立成立，写的时候保留既有 state，别让页面丢掉 scrollRestoration 之类 */
  const paintHash = () => {
    if (workspace.unknownHash()) return;
    const target = workspace.toHash();
    if (target === '' || location.hash === target) return;
    history.replaceState(history.state ?? null, '', target);
  };

  const sync = () => {
    for (const id of ids) {
      writeAttrs(tabNode.get(id), workspace.tabAttr(id));
      writeAttrs(panelNode.get(id), workspace.panelAttr(id));
      paintBanner(id);
    }
    paintNotice();
    paintHash();
  };

  const onClick = (id) => (evt) => {
    if (evt && (evt.ctrlKey || evt.metaKey || evt.altKey || evt.shiftKey)) return;
    if (evt && typeof evt.button === 'number' && evt.button !== 0) return;
    if (evt && typeof evt.preventDefault === 'function') evt.preventDefault();
    if (!workspace.select(id)) return;
    sync();
  };

  /**
   * 自动激活（段 1 §6.0 第一条）：移动焦点即换面板，`keyAction` 已经把所有带修饰键的组合
   * 挡在门外。`preventDefault()` 无条件先做——方向键与 `Home`/`End` 在浏览器里的默认动作就是
   * 滚动，索引条拿到焦点时按上下会滚整页，那是这个组件最容易漏的一条键盘缺陷。
   * `changed` 为假时**整段不做第二件事**：只有一块面板的工作区里按方向键、或者在第一块上按
   * `Home`，状态机已经把 `touched` 置真了，跟着 sync 就会把 `#第一块` 写进地址栏——用户什么
   * 都没换来，却凭空多了一条历史记录。焦点同理：没换面板就不抢焦点。
   * `focus()` 排在 `sync()` 之后：tabindex 要先落到新那块上，否则读屏报出的还是旧的那一项。
   */
  const onKey = (id) => (evt) => {
    const action = keyAction(evt);
    if (action === '') return;
    if (typeof evt.preventDefault === 'function') evt.preventDefault();
    const moved = workspace.move(action);
    if (!moved.changed) return;
    sync();
    const next = tabNode.get(moved.active);
    if (next && typeof next.focus === 'function') next.focus();
  };

  /** 跑一块面板的渲染函数，不改状态；`run()` 与 `mount()` 共用这一处 try/catch */
  const apply = (id, fn) => {
    const panel = panelNode.get(id); // 两处调用点都被 `incomplete` 那道闸门挡过，这一格必在
    try {
      fn(panel);
      workspace.clearBroken(id);
      return true;
    } catch (err) {
      workspace.markBroken(id, messageOf(err));
      return false;
    }
  };

  return {
    /**
     * 挂载一次。返回四个 id 清单：`mounted` 是两块节点齐、已升级成 tab 的那几块；
     * `missing` 是骨架缺节点的；`rendered` 是渲染函数跑成功的；`broken` 就是
     * `workspace.brokenIds()`，把"缺节点"与"渲染抛错"合在一起说。
     * 重复调用抛 `RangeError`：`run()` 会把每块面板的内容再追加一遍，那种"看着像双份内容"的
     * 缺陷比当场炸难查得多。
     */
    mount() {
      if (mounted) throw new RangeError('createPanelDom：mount() 已经跑过，重复挂载会把每块面板的渲染函数再跑一遍');
      const listAttrs = workspace.tablistAttr();
      const list = document.getElementById(listAttrs.id);
      if (!list) {
        throw new RangeError(`createPanelDom：页面里没有 id="${listAttrs.id}" 的节点，没有索引条就不算一块工作区`);
      }
      writeAttrs(list, listAttrs);
      const missing = [];
      for (const id of ids) {
        const tabId = workspace.tabAttr(id).id;
        const panelId = workspace.panelAttr(id).id;
        const tab = document.getElementById(tabId);
        const panel = document.getElementById(panelId);
        if (!tab || !panel) {
          const absent = [];
          if (!tab) absent.push(`id="${tabId}" 的 tab 节点`);
          if (!panel) absent.push(`id="${panelId}" 的 panel 节点`);
          missing.push(id);
          incomplete.add(id);
          workspace.markBroken(id, `页面骨架里缺 ${absent.join(' 与 ')}，这块面板不完整`);
        }
        // 两半各记各的：缺 tab 的那一块，面板仍然参与"一次只显示一块"的互锁（口径 5），
        // 不记进去就会留下一块永远没人覆写 `hidden` 的面板——那是这层能造出的第二种双显故障。
        if (tab) {
          tabNode.set(id, tab);
          tab.addEventListener('click', onClick(id));
          tab.addEventListener('keydown', onKey(id));
        }
        if (panel) panelNode.set(id, panel);
      }
      win.addEventListener('hashchange', () => {
        workspace.applyHash(location.hash);
        sync();
      });
      workspace.applyHash(location.hash);
      const rendered = [];
      for (const id of ids) {
        const fn = renderers[id];
        if (typeof fn !== 'function') continue;
        // 骨架不完整的面板不跑渲染函数：没有 tab 就切不到它，凭空渲染一份内容只是把缺陷藏起来。
        if (incomplete.has(id)) continue;
        if (apply(id, fn)) rendered.push(id);
      }
      sync();
      mounted = true;
      return {
        mounted: ids.filter((id) => !incomplete.has(id)),
        missing,
        rendered,
        broken: workspace.brokenIds(),
      };
    },
    sync,
    /**
     * 装配层在表单回调里复用同一道闸门：成功就把那块面板的错误条撤掉，抛错就只塌这一块。
     * 返回值是"这一块现在好不好"，不是"函数有没有抛"。两种情况不跑函数、直接报 `false`：
     * 面板节点缺失（跑也没地方放内容），以及 `mount()` 记下的骨架不完整那块（那是构建期缺陷，
     * 不可能靠再跑一次渲染函数修好，跑成功了反而会把"缺节点"这条真话从错误条上洗掉）。
     */
    run(id, fn) {
      if (!mounted) throw new RangeError('createPanelDom.run：先 mount() 再 run()，节点还没找过');
      if (!ids.includes(id)) {
        throw new RangeError(`createPanelDom.run：面板 id ${shapeOf(id)} 不在 ids 里`);
      }
      if (typeof fn !== 'function') {
        throw new TypeError(`createPanelDom.run(${id})：fn 应为函数，收到 ${shapeOf(fn)}`);
      }
      if (incomplete.has(id)) return false;
      const ok = apply(id, fn);
      sync();
      return ok && workspace.brokenOf(id) === '';
    },
  };
}

/**
 * 抛出来的东西形状千奇百怪（`throw 'x'`、`throw {message: 42}`），但页面上只能有一行可读的
 * 句子：优先取 `message`，取不到就 `String()` 一次；空 `message` 退回名字，因为
 * `new Error()` 的 `message` 是空串，什么都不显示比显示一句没头没尾的话更糟。
 */
function messageOf(err) {
  if (err && typeof err.message === 'string' && err.message !== '') return err.message;
  return String(err);
}

/**
 * 报错文案里的"收到什么"——与 `idcard.js` / `uscc.js` / `panel.js` 那三份同一口径的第四份，
 * 同样不跨模块 import：这一层不许因为另一个工具的报错文案改动被拖着回归。
 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  const t = typeof v;
  if (t === 'object' || t === 'symbol') return t;
  return `${t} ${String(v)}`;
}
```

- [x] **Step 4: 跑绿**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^# (tests|pass|fail)'; echo "exit=${PIPESTATUS[0]}"
node --check dev/js/tools/panel-dom.js
wc -l dev/js/tools/panel-dom.js
```

Expected：`# tests 130`、`# pass 130`、`# fail 0`、`exit=0`（41 + 5 + 23 + 15 + 15 + 15 + 16），
`node --check` 退出 0，`wc -l` 见 Step 6 的 322 行。落地实跑 **2026-09-27** 三轮，三轮的这三行
一字不差（`# tests 130`、`# pass 130`、`# fail 0`、`exit=0`），`# duration_ms` 依次是
**34.95 / 34.23 / 40.38s**——起草那格记的是 4.14–5.31s，同一台机器同一份文件差到 8 倍，
中间只多了桌面负载（Step 6 那一段有 loadavg 读数），所以这一格再次确认：**`duration_ms` 不进门禁**，
门禁只看 `exit=0` 与 `# fail 0`。

- [x] **Step 5: 自证这 16 条有牙（三十一处变异，逐处记下红了谁）**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
mkdir -p /tmp/t6mut && cp dev/js/tools/panel-dom.js /tmp/t6mut/panel-dom.orig.js
cat > /tmp/t6mut/mut.mjs <<'EOF'
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const P = 'dev/js/tools/panel-dom.js';
const CMD = 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs';
const orig = fs.readFileSync(P, 'utf8');
/** 未变异先跑一次：拿它的 `# tests` 总数当尺子，好把"脚手架其实没跑到测试"和"这处不可达"分开 */
function run() {
  let out = '';
  try { out = execSync(`${CMD} 2>&1`, { encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  return {
    total: Number((out.match(/^# tests (\d+)/m) || [])[1] ?? -1),
    reds: [...out.matchAll(/^not ok \d+ - (I\d+)/gm)].map((x) => x[1]),
  };
}
const base = run();
if (base.total < 0 || base.reds.length > 0) {
  throw new Error(`基线就不对（# tests ${base.total}、红 ${base.reds.join(' ')}），先让全量跑绿再谈牙齿`);
}
console.log(`基线 # tests ${base.total} 全绿`);

const MUTS = [
  ["W1 hidden 走 setAttribute（真 DOM 上恒为真）",
    "      if (typeof value === 'boolean') el.hidden = value;\n      else el.setAttribute(key, String(value));",
    "      el.setAttribute(key, String(value));"],
  ["W2 节点为空就抛，不静默跳过",
    "  const writeAttrs = (el, attrs) => {\n    if (!el) return;",
    "  const writeAttrs = (el, attrs) => {\n    if (!el) throw new Error('没有这个节点');"],
  ["W3 骨架已有同名属性就不覆写（＝手抄口径回来了）",
    "      else el.setAttribute(key, String(value));",
    "      else if (!el.attrs || !el.attrs.has(key)) el.setAttribute(key, String(value));"],
  ["W4 aria-controls 那一格当作冗余省掉",
    "      else el.setAttribute(key, String(value));",
    "      else if (key !== 'aria-controls') el.setAttribute(key, String(value));"],
  ["W5 错误条不标 role=\"alert\"",
    "    node.setAttribute('role', 'alert');\n",
    ""],
  ["W6 错误条走 innerHTML 拼消息",
    "    node.textContent = bannerText(message);",
    "    node.innerHTML = bannerText(message);"],
  ["W7 提示行走 innerHTML",
    "    notice.textContent = `地址栏里的 ${location.hash} 不是本页的某一块面板，已保持当前面板。`;",
    "    notice.innerHTML = `地址栏里的 ${location.hash} 不是本页的某一块面板，已保持当前面板。`;"],
  ["W8 点击不拦锚点默认动作",
    "    if (evt && typeof evt.preventDefault === 'function') evt.preventDefault();\n    if (!workspace.select(id)) return;",
    "    if (!workspace.select(id)) return;"],
  ["W9 带修饰键的点击也接（深链开新标签没了）",
    "    if (evt && (evt.ctrlKey || evt.metaKey || evt.altKey || evt.shiftKey)) return;\n",
    ""],
  ["W10 中键点击也接",
    "    if (evt && typeof evt.button === 'number' && evt.button !== 0) return;\n",
    ""],
  ["W11 按键不拦滚动默认动作",
    "    if (typeof evt.preventDefault === 'function') evt.preventDefault();\n",
    ""],
  ["W12 没换面板也照样 sync（单块页面凭空写 hash）",
    "    if (!moved.changed) return;\n",
    ""],
  ["W13 换面板后不跟焦点",
    "    if (next && typeof next.focus === 'function') next.focus();",
    "    void next;"],
  ["W14 hashchange 也抢焦点",
    "        workspace.applyHash(location.hash);\n        sync();",
    "        workspace.applyHash(location.hash);\n        sync();\n        const cur = tabNode.get(workspace.active());\n        if (cur) cur.focus();"],
  ["W15 坏 hash 也回写地址栏",
    "    if (workspace.unknownHash()) return;\n    const target",
    "    const target"],
  ["W16 地址栏已正确时仍然回写",
    "    if (target === '' || location.hash === target) return;",
    "    if (target === '') return;"],
  ["W17 无 hash 进入也写第一块",
    "    if (target === '' || location.hash === target) return;",
    "    if (location.hash === target) return;"],
  ["W18 一块抛错就把每块都标坏",
    "      workspace.markBroken(id, messageOf(err));",
    "      for (const other of ids) workspace.markBroken(other, messageOf(err));"],
  ["W19 修好了也不清状态",
    "      workspace.clearBroken(id);\n",
    ""],
  ["W20 修好了错误条还挂着",
    "        if (panel) panel.removeChild(existing);\n",
    ""],
  ["W21 每次 sync 都长一张错误条",
    "      existing.textContent = bannerText(message);\n      return;",
    "      existing.textContent = bannerText(message);"],
  ["W22 缺节点不标坏，静默继续",
    "          workspace.markBroken(id, `页面骨架里缺 ${absent.join(' 与 ')}，这块面板不完整`);\n",
    ""],
  ["W23 缺 tab 的那块连面板都不记（双显故障）",
    "        if (panel) panelNode.set(id, panel);",
    "        if (panel && tab) panelNode.set(id, panel);"],
  ["W24 run() 允许把骨架缺陷洗成\"好了\"",
    "      if (incomplete.has(id)) return false;\n",
    ""],
  ["W25 mount 照跑骨架不完整的渲染函数",
    "        if (incomplete.has(id)) continue;\n",
    ""],
  ["W26 mount 可以重复跑",
    "      if (mounted) throw new RangeError('createPanelDom：mount() 已经跑过，重复挂载会把每块面板的渲染函数再跑一遍');\n",
    ""],
  ["W27 找节点时把前缀写死成 tk-",
    "        const tabId = workspace.tabAttr(id).id;",
    "        const tabId = `tk-tab-${id}`;"],
  ["W28 缺 tablist 的异常档位写错",
    "        throw new RangeError(`createPanelDom：页面里没有 id=\"${listAttrs.id}\" 的节点",
    "        throw new TypeError(`createPanelDom：页面里没有 id=\"${listAttrs.id}\" 的节点"],
  ["W29 好 hash 回来时提示行不收",
    "    if (!workspace.unknownHash()) {\n      notice.hidden = true;\n      return;\n    }",
    "    if (!workspace.unknownHash()) return;"],
  ["W30 坏 hash 时退回第一块",
    "        workspace.applyHash(location.hash);\n        sync();",
    "        if (!workspace.applyHash(location.hash)) workspace.select(ids[0]);\n        sync();"],
  ["W31 无关按键也拦默认动作（吞掉 PageDown / Enter）",
    "    if (action === '') return;\n",
    "    if (action === '') { if (typeof evt.preventDefault === 'function') evt.preventDefault(); return; }\n"],
];

for (const [name, a, b] of MUTS) {
  if (!orig.includes(a)) { console.log(`!! ${name} 锚点没命中，先修脚本再说牙齿`); continue; }
  fs.writeFileSync(P, orig.replace(a, b));
  const r = run();
  if (r.total !== base.total) { console.log(`!! ${name} 只跑到 ${r.total} 条（基线 ${base.total}），这一档不算证据`); continue; }
  console.log(`${name} → ${r.reds.length ? r.reds.join(' ') : '全绿（不可达，见计划说明）'}`);
}
fs.writeFileSync(P, orig);
if (fs.readFileSync(P, 'utf8') !== orig) throw new Error('还原失败');
console.log('已还原');
EOF
cd /Users/liaolongdong/code/liaolongdong.github.io && node /tmp/t6mut/mut.mjs
```

落地实跑 **2026-09-27**：这三十一步不在工作树上跑，改在 `cpSync` 出来的副本树 `/tmp/t6fix/tree`
（整份 `dev/js`、`scripts`、`demo` 加 `package.json`，`P` 指向副本里的 `panel-dom.js`），沿用
Task 4 加固后的那套脚手架——工作树只记脏指纹（`git status --porcelain` + 逐文件 sha16）、实验
前后比对，全程不参与改写。基线 `# tests 130` 全绿起步（起草时是 126，§G / §H 落地后涨到 130），
三十一刀逐刀记录：**三十一处全部有红的判据**、无一处"全绿即不可达"、无一处"锚点没命中"、
日志里没有一行 `!!`；跑完打印 `还原后：# tests 130、pass 130、红 无`、
`副本与工作树逐字节一致=true`、`工作树脏指纹前后一致=true（脏项 21 个）`。
日志落在 `/tmp/t6fix/ledger.log`（37 行）。表里"红了谁"那一列是日志原文，而且这一回连"对得上"
这件事都不是眼看的：`/tmp/t6fix/cmp.mjs` 把日志行与表格行按变异名逐条对齐，同时校验三件事——
红名单与表格逐项相等、`红名单长度 = 130 − pass`、每一档基线恒为 130，31/31 通过；脚本末行打印
被点名的档位集合，正好是 I1–I16 十六个，没有一个 I 档没被点过。

| 变异 | 红了谁 | 说明 |
| --- | --- | --- |
| `W1 hidden 走 setAttribute（真 DOM 上恒为真）` | **I1 I2 I3 I4 I5 I6 I7 I9 I10 I11 I12 I15 I16 红** | `hidden` 用 `setAttribute` 写下去，真 DOM 上恒为真、假 DOM 上也只多一个字符串属性、`el.hidden` 永远停在 `false`，于是"一次只显示一块"整条口径没了。除三格外全红：I8 只断言按键不吞默认动作、I13 只断言错误条与 `run()` 的返回值、I14 只断言"多跑一次前后是否相同"（`hidden` 没人写就恒为 `false`，照样相同）——这一刀红得最宽，正是"按值型分派"那条口径的代价清单 |
| `W2 节点为空就抛，不静默跳过` | **I15 红** | 节点为 `null` 就抛：缺件那一块本来就没有节点，抛出来把"骨架缺件"变成运行时崩溃，而口径 5 要的是记进状态、属性表照写、整页继续能用 |
| `W3 骨架已有同名属性就不覆写（＝手抄口径回来了）` | **I1 I2 I9 I16 红** | "骨架里已经有同名属性就不覆写"＝手抄 ARIA 口径回来了：I1 的骨架故意把 `role` 写错，不覆写就留着一个错的；I2 / I9 / I16 从可见性、外部改地址栏、换前缀三个方向各撞一次 |
| `W4 aria-controls 那一格当作冗余省掉` | **I1 I16 红** | 省掉 `aria-controls`：tab 与 panel 的配对关系没了，读屏报得出"选中的标签"但说不出它控制哪块面板；I1 的键集合精确断言与 I16 的换前缀各钉一处 |
| `W5 错误条不标 role="alert"` | **I11 红** | 错误条不标 `role="alert"`：读屏里它退化成一块面板的普通段落，用户根本听不到"这块塌了" |
| `W6 错误条走 innerHTML 拼消息` | **I11 I12 I13 I15 红** | 错误条走 `innerHTML`：假 DOM 不解析标签，赋值只长出一个普通属性、一个子节点都不多，于是"错误条文案"在假 DOM 里读不出来——四处红全落在读文案的格子上。I12 是全节 `innerHTML` 审计加一条恶意 `message`，真 DOM 反而会解析标签把这条判据洗白，所以宁可让它红在"节点没长出来" |
| `W7 提示行走 innerHTML` | **I10 I12 红** | 提示行走 `innerHTML`：坏 hash 提示里拼的是 `location.hash`，那是用户在地址栏里敲进去的一串，这里就是第二个 XSS 出口 |
| `W8 点击不拦锚点默认动作` | **I4 红** | 点击不拦锚点默认动作：`<a href="#id">` 自己会跳锚点并写一条历史记录，和 `replaceState` 打架——深链进来滚到索引条、点一下多两条历史，两个都是 §6.3 明令要避免的 |
| `W9 带修饰键的点击也接（深链开新标签没了）` | **I5 红** | 带修饰键的点击也接：Ctrl / Cmd 点击的开新标签语义就是深链的价值，接了就等于把 §6.3 那条"深链能分享"废掉一半 |
| `W10 中键点击也接` | **I5 红** | 中键也接：`button !== 0` 是中键（新开标签），必须整个不接，`preventDefault()` 也不能做 |
| `W11 按键不拦滚动默认动作` | **I6 红** | 按键不拦默认动作：方向键与 `Home`/`End` 在浏览器里的默认动作就是滚动，索引条拿到焦点时按上下会滚整页——这个组件最容易漏的一条键盘缺陷 |
| `W12 没换面板也照样 sync（单块页面凭空写 hash）` | **I7 红** | `changed` 为假也照样 sync：只有一块面板的页面按方向键、或在第一块上按 `Home`，状态机把 `touched` 置真了，跟着就把 `#第一块` 写进地址栏——用户什么也没换来，凭空多一条历史 |
| `W13 换面板后不跟焦点` | **I6 I7 红** | 换面板后不跟焦点：键盘用户按完方向键焦点还留在旧那项上，接下来一下"下"又回到旧位置，整条索引条不能用；I6 与 I7（`Home`/`End`）各断一次 `focusLog` |
| `W14 hashchange 也抢焦点` | **I9 红** | `hashchange` 也抢焦点：外部改地址栏时用户可能正在读页面别处，焦点被跳走是可访问性事故 |
| `W15 坏 hash 也回写地址栏` | **I10 红** | 坏 hash 也回写地址栏：把用户粘进来的那串抹掉，就再也没法复制出来排查；口径 3 要的是"原样留着 + 页面里说一句" |
| `W16 地址栏已正确时仍然回写` | **I3 I4 I9 I10 I16 红** | 地址栏已经正确还回写：`historyCalls` 那几条精确次数断言全红（I3 I4 I9 I10 I16），真实浏览器里表现为每次 `sync()` 都刷一条历史 |
| `W17 无 hash 进入也写第一块` | **I3 红** | 无 hash 进入也写第一块：口径 3 的"用户没动手之前一个字都不写"。裸 `#` 那一档（`toHash()` 返回空串）就是专为这刀补的——第一版这里是个等效变异，I3 全绿 |
| `W18 一块抛错就把每块都标坏` | **I11 I12 I13 I14 红** | 一块抛错就把每块都标坏：§6.3 那句"一块塌不整页崩"整条没了，隔离性、错误条、`run()` 归零、幂等四处同时红 |
| `W19 修好了也不清状态` | **I13 红** | 修好了不清状态：`run()` 的返回值是"这一块现在好不好"，不是"函数有没有抛"，`brokenOf` 没归零就永远报坏 |
| `W20 修好了错误条还挂着` | **I13 红** | 修好了错误条还挂着：面板里留着一句"这块没能渲染出来"，而它已经渲染出来了——页面对用户说谎 |
| `W21 每次 sync 都长一张错误条` | **I14 红** | 每次 sync 都长一张新错误条：`existing` 分支忘了 `return`，同一句话叠 N 条，读屏连播 N 遍 |
| `W22 缺节点不标坏，静默继续` | **I15 红** | 缺节点不标坏：骨架缺件静默继续，`broken` 清单里看不见，装配层拿不到"这块不完整"这条真话 |
| `W23 缺 tab 的那块连面板都不记（双显故障）` | **I15 红** | 缺 tab 的那块连面板都不记：没有人再覆写它的 `hidden`，于是留下**两块同时可见**——写 I15 时真挖出来的缺陷，这层能造出的第二种双显故障 |
| `W24 run() 允许把骨架缺陷洗成"好了"` | **I15 红** | `run()` 允许把骨架缺陷洗成"好了"：不可能靠再跑一次渲染函数修好构建期缺件，跑成功了反而把"缺节点"从错误条上抹掉 |
| `W25 mount 照跑骨架不完整的渲染函数` | **I15 红** | `mount()` 照跑骨架不完整的渲染函数：没有 tab 就切不到它，凭空渲染一份内容只是把缺陷藏进 `rendered` 清单 |
| `W26 mount 可以重复跑` | **I14 红** | `mount()` 可以重复跑：每块面板的渲染函数再跑一遍，页面出现双份结果表——那种"看着像内容重复"的缺陷比当场炸难查得多 |
| `W27 找节点时把前缀写死成 tk-` | **I16 红** | 找节点时把前缀写死成 `tk-`：§6.4 那两条黑名单前缀（`.tk-` / `.jt-`）对应的两套工作台就变成两套代码，I16 专门用 `.jt-` 跑一整轮 |
| `W28 缺 tablist 的异常档位写错` | **I15 红** | 缺 tablist 抛 `TypeError`：档位写错＝装配层读不懂。形状不对才是 `TypeError`；形状对而页面上找不到是 `RangeError`，与 `markBroken` 同档 |
| `W29 好 hash 回来时提示行不收` | **I10 红** | 好 hash 回来时提示行不收：坏 hash 修好之后页面还挂着"这不是本页的某一块面板"，提示行自己成了第二个缺陷 |
| `W30 坏 hash 时退回第一块` | **I10 红** | 坏 hash 时退回第一块：状态机宁可让地址栏与页面短暂不一致，这层跟着它一起不写，更不能把用户给的地址悄悄改掉 |
| `W31 无关按键也拦默认动作（吞掉 PageDown / Enter）` | **I8 红** | 无关按键也拦默认动作：`PageDown` / `Enter` / 字母键被吞，索引条拿到焦点时页面滚不动、回车进不了表单——I8 防的就是"顺手加一条 catch-all `preventDefault`"，第一版 30 刀里没有一刀能从现有源码变出这个方向，所以补了它 |

三处从这轮才定下来的口径，都值得单独记一句：

**"按值型分派"不是洁癖。** W1 是这轮红得最宽的一刀（十三条）。`hidden` 是四张属性表里唯一的布尔值，
把它跟别的键一起 `setAttribute(key, String(value))`，真 DOM 上 `hidden="false"` 依旧等于隐藏——
页面会**同时显示两块面板**，而任何只比对属性表内容的判据都看不出来。所以 `writeAttrs` 里那一格
按 `typeof value === 'boolean'` 分派，I2 与 I15 判的是"任意一次 `sync()` 之后恰好一块可见"这个
不变量，而不是某个属性值写对了没有。

**等效变异真的会出现，而且是靠补样本消掉的。** W17（"无 hash 进入也写第一块"）第一版跑完全绿：
假页面的 `location.hash` 初始是空串，`toHash()` 在用户没动手时也返回空串，于是
`location.hash === target` 先成立，`target === ''` 那半句根本没被执行到。补了一档**裸 `#`**
（`location.hash === '#'` → `parseHash` 给 `{id: null, unknown: false}` → `toHash()` 仍返回空串，
但此时 `location.hash !== target`）之后，W17 才红在 I3。这一条写在这儿，是为了让下一轮读到
"三十一处全部有红"时知道它不是天生如此。

**没被任何一刀点名的判据要当场处理，不能拖到收口。** 第一轮 30 刀跑完，I8（无关按键不吞默认动作）
一条都没红过——它防的方向（在 `onKey` 里加一条 catch-all `preventDefault`）在现有源码里没有可以
反过去的语句。补了 W31（`if (action === '') return;` → 先 `preventDefault()` 再 return）之后 I8
才归到"有人守"那一档。凡是"某条判据没被任何一刀点过"，要么补一刀，要么在计划里明说为什么不补——
把"没人红过"读成"这条多余"是这类自证最容易犯的错。

另外两处是**写判据时真挖出来的缺陷**，不是给已经写好的代码配说明书：I2 与 I15 都断言"恰好一块可见"
这个不变量，而 I15 逼出了"缺 tab 的那块连面板节点都不记 → 留下一块没人覆写 `hidden` 的面板 →
双显"这条真实故障（W23 红在 I15，因为假页面里只有"缺一块"的骨架才会走到那格）；I7 逼出了
"单块页面按方向键、`move()` 的 `changed` 为假却照样 sync → 地址栏凭空多出 `#第一块`"（W12 只红 I7，
因为单块页面是这一格唯一的真向量）。这两条都在实现里改成了"整段不做第二件事"，理由写进了
`onKey` 的文档注释。

- [x] **Step 6: 记一次耗时与体积（Task 10 的性能口径要用）**

整段脚本原样进 `bash`：冷启动七次，然后 `cat > /tmp/t6bench.mjs` 落一份"§I 那套假 DOM 的裁剪版"
再连跑三轮。裁剪版必须落盘而不是塞进 `node -e`，因为它要同时供 `mount` / `sync` / `run` 三条路径
与三档自检用；脚本里的 `ROOT` 是绝对路径，所以它在哪个目录下跑都行。

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
for i in 1 2 3 4 5 6 7; do node --input-type=module -e "
const R = '/Users/liaolongdong/code/liaolongdong.github.io';
const t0 = performance.now(); await import(\`\${R}/dev/js/tools/panel-dom.js\`);
console.log('import panel-dom.js', (performance.now() - t0).toFixed(2) + 'ms');
"; done
cat > /tmp/t6bench.mjs <<'BENCH'
/* Task 6 Step 6 的耗时口径：绑定层自己那一档。这里的假 DOM 是 §I 那套的裁剪版（只留
   mount / sync / run 会走到的格子），报的数都是"同一批循环里只 Map.get 的基线"减掉之后的
   净值——因为这一段量的不是假 DOM 有多快，而是绑定层每次交互多花多少。
   事件用 `fire(type, evt)` 派发：这份裁剪版把监听存进 `Map`，未注册的类型一 `fire` 就抛，
   所以"跑完了"就等于 click / keydown 两类监听真的注册着，而不是绕过了绑定层直接调闭包。 */
const ROOT = '/Users/liaolongdong/code/liaolongdong.github.io';
const { createPanelWorkspace } = await import(`${ROOT}/dev/js/tools/panel.js`);
const { createPanelDom } = await import(`${ROOT}/dev/js/tools/panel-dom.js`);

const IDS = ['idcard', 'uscc', 'bankcard', 'mobile', 'random'];
const ROUNDS = 7;

function makePage({ withNotice = true } = {}) {
  const nodes = new Map();
  const mkText = (t) => ({ nodeType: 3, textContent: String(t) });
  const mkEl = (tag, id = '', seed = {}) => {
    const attrs = new Map();
    const listeners = new Map();
    const el = {
      nodeType: 1, tagName: tag, id, attrs, childNodes: [], hidden: false,
      get firstChild() { return el.childNodes.length ? el.childNodes[0] : null; },
      get textContent() { return el.childNodes.map((n) => n.textContent).join(''); },
      set textContent(v) { el.childNodes = v === '' ? [] : [mkText(v)]; },
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      setAttribute: (k, v) => { attrs.set(k, String(v)); },
      removeAttribute: (k) => { attrs.delete(k); },
      appendChild: (n) => { el.childNodes.push(n); return n; },
      insertBefore: (n, ref) => {
        const i = ref ? el.childNodes.indexOf(ref) : -1;
        if (i < 0) el.childNodes.push(n);
        else el.childNodes.splice(i, 0, n);
        return n;
      },
      removeChild: (n) => { const i = el.childNodes.indexOf(n); if (i >= 0) el.childNodes.splice(i, 1); return n; },
      addEventListener: (type, fn) => { listeners.set(`${type}`, fn); },
      fire: (type, evt) => listeners.get(type)(evt),
      focus: () => {},
    };
    for (const [k, v] of Object.entries(seed)) {
      if (k === 'hidden') el.hidden = v;
      else attrs.set(k, String(v));
    }
    if (id) nodes.set(id, el);
    return el;
  };
  const doc = {
    getElementById: (id) => (nodes.has(id) ? nodes.get(id) : null),
    createElement: (tag) => mkEl(tag),
    createTextNode: mkText,
  };
  const location = { hash: '' };
  const hashWrites = { n: 0 };
  const history = { state: null, replaceState(s, t, url) { hashWrites.n += 1; location.hash = url; } };
  const win = { addEventListener: () => {} };
  const ws = createPanelWorkspace({ ids: IDS });
  mkEl('nav', 'tk-tablist', { class: 'tk-index' });
  for (const id of IDS) {
    mkEl('a', `tk-tab-${id}`, { class: 'tk-index__link', href: `#${id}` });
    mkEl('section', `tk-panel-${id}`, { class: 'tk-panel' }).appendChild(mkText(`body:${id}`));
  }
  const notice = withNotice ? mkEl('p', 'tk-notice', { hidden: true }) : null;
  return { doc, ws, location, history, win, notice, nodes, hashWrites };
}

const clickEvt = () => ({
  button: 0, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault() {},
});
const keyEvt = (key) => ({
  key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault() {},
});
const modKeyEvt = () => ({
  key: 'ArrowUp', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, preventDefault() {},
});

/** 基线：同样次数、同样遍历五块 + Map.get 的空调用，用来从每一档里减掉循环与查表本身的开销。
    `hrtime.bigint()` 差值是纳秒，除以 1e3 才是微秒——单位写错过一次，整张表就全小一千倍。 */
function baseline(iters) {
  const map = new Map(IDS.map((id) => [id, {}]));
  const times = [];
  for (let r = 0; r < ROUNDS; r += 1) {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < iters; i += 1) for (const id of IDS) map.get(id);
    times.push(Number(process.hrtime.bigint() - t0) / 1e3 / iters);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

function bench(name, iters, body) {
  const base = baseline(iters);
  const times = [];
  for (let r = 0; r < ROUNDS; r += 1) {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < iters; i += 1) body(i);
    times.push(Number(process.hrtime.bigint() - t0) / 1e3 / iters);
  }
  times.sort((a, b) => a - b);
  const med = times[Math.floor(times.length / 2)];
  console.log(`${name.padEnd(30, ' ')} 中位 ${(med - base).toFixed(2)} µs 原始 ${med.toFixed(2)} 基线 ${base.toFixed(2)} 区间 ${Math.min(...times).toFixed(2)}–${Math.max(...times).toFixed(2)}（七轮）`);
}

/* 1) mount：每档都重建一份页面，含节点查表、监听注册、属性表首轮落地。
   先丢掉 100 轮预热——mount 每轮都要新建整棵假 DOM，头几轮全是解释执行与内联缓存冷启动，
   直接混进样本会把"最慢一次"撑到毫秒级，那测量的是 JIT 而不是绑定层。 */
for (let r = 0; r < 100; r += 1) {
  const warm = makePage();
  createPanelDom({
    workspace: warm.ws, document: warm.doc, location: warm.location,
    history: warm.history, window: warm.win, notice: warm.notice,
    renderers: { idcard: (el) => el.appendChild(warm.doc.createTextNode('结果')) },
  }).mount();
}
const mountTimes = [];
for (let r = 0; r < 200; r += 1) {
  const page = makePage();
  const t0 = process.hrtime.bigint();
  createPanelDom({
    workspace: page.ws, document: page.doc, location: page.location,
    history: page.history, window: page.win, notice: page.notice,
    renderers: { idcard: (el) => el.appendChild(page.doc.createTextNode('结果')) },
  }).mount();
  mountTimes.push(Number(process.hrtime.bigint() - t0) / 1e3);
}
mountTimes.sort((a, b) => a - b);
const pct = (p) => mountTimes[Math.min(mountTimes.length - 1, Math.floor(mountTimes.length * p))];
console.log(`mount(5 块 + 1 个渲染函数)：中位 ${pct(0.5).toFixed(1)} µs，p10 ${pct(0.1).toFixed(1)} µs，p90 ${pct(0.9).toFixed(1)} µs，最慢 ${mountTimes[mountTimes.length - 1].toFixed(1)} µs（200 轮、预热 100 轮后；含 createPanelDom 的构造校验）`);

/* 稳态样本：mount 一次后各档共用 */
const P = makePage();
const dom = createPanelDom({
  workspace: P.ws, document: P.doc, location: P.location,
  history: P.history, window: P.win, notice: P.notice,
  renderers: { idcard: (el) => el.appendChild(P.doc.createTextNode('结果')) },
});
dom.mount();
const tabOf = (id) => P.nodes.get(`tk-tab-${id}`);

bench('sync()（五块，稳态）', 20000, () => dom.sync());
bench('点一次 tab（click → sync → 写地址栏）', 10000, (i) => {
  tabOf(IDS[i % IDS.length]).fire('click', clickEvt());
});
bench('一次按键（keydown → move → sync → focus）', 10000, (i) => {
  tabOf(IDS[i % IDS.length]).fire('keydown', keyEvt(i % 2 ? 'ArrowDown' : 'ArrowUp'));
});
bench('一次被忽略的按键（Ctrl+ArrowUp）', 20000, () => {
  tabOf('idcard').fire('keydown', modKeyEvt());
});
bench('run() 成功一次', 10000, () => dom.run('uscc', (el) => el.getAttribute('class')));
dom.run('uscc', () => { throw new Error('基准里的抛错样本'); });
bench('run() 抛错一次', 10000, () => dom.run('uscc', () => { throw new Error('基准里的抛错样本'); }));
dom.run('uscc', () => {});
const writesBeforeBad = P.hashWrites.n;
bench('坏 hash 一次（applyHash + notice + sync）', 10000, () => {
  P.location.hash = '#nope';
  P.ws.applyHash(P.location.hash);
  dom.sync();
});
const badHashWrites = P.hashWrites.n - writesBeforeBad;
P.location.hash = '';
P.ws.applyHash('');
dom.sync();

/* 200 轮「坏 ↔ 好」：错误条增删的摊销（每轮两次 run，各含一次 sync） */
const tBad = process.hrtime.bigint();
for (let i = 0; i < 200; i += 1) {
  dom.run('mobile', () => { throw new Error('增删样本'); });
  dom.run('mobile', () => {});
}
console.log(`错误条建+撤 200 对：平均 ${(Number(process.hrtime.bigint() - tBad) / 1e3 / 400).toFixed(2)} µs/次（含整轮 sync）`);
/* 三档自检：证明上面那些数不是空转出来的。裁剪版假 DOM 里"未注册的事件类型"一调就抛，
   所以 `fire` 能跑完就等于 click / keydown 两类监听真的注册上了。 */
let wired = 'OK：三类监听都注册着（未注册的事件类型一 fire 就抛）';
try {
  tabOf('idcard').fire('nope', {});
  wired = '自检无效：未注册的事件类型没有抛，上面的 click/keydown 档可能全是空转';
} catch { /* 预期：没有这个类型的监听 */ }
const visibleAfter = IDS.filter((id) => P.nodes.get(`tk-panel-${id}`).hidden === false);
console.log('自检：', wired);
console.log('自检：跑完所有档位之后，可见面板仍是恰好一块 →', JSON.stringify(visibleAfter));
console.log('自检：坏 hash 那 10000 轮里地址栏被写的次数 →', badHashWrites,
  badHashWrites === 0 ? '（口径 3 成立：unknownHash 时一格都不写）' : '（口径 3 破了，坏 hash 正在回写地址栏）');
console.log('自检：全场 replaceState 总次数 →', P.hashWrites.n, '，最后一次落在 →', JSON.stringify(P.location.hash));
BENCH
for r in 1 2 3; do node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON /tmp/t6bench.mjs; done
uptime
wc -l dev/js/tools/panel-dom.js
wc -c dev/js/tools/panel-dom.js
gzip -6 -c dev/js/tools/panel-dom.js | wc -c
awk '/^[[:space:]]*(\*|\/\/|\/\*)/{c++; b+=length($0)+1} END{print "注释行 " c " / 注释字节 " b}' dev/js/tools/panel-dom.js
grep -cE '^[[:space:]]*export' dev/js/tools/panel-dom.js
```

落地实跑 **2026-09-27**，本机 Node v22.19.0，跑的就是上面那份原样脚本（`ROOT` 指向工作树）。
一共跑了**三拨**，每拨都是七次冷启动 import + 三遍稳态，日志分别落在 `/tmp/t6/waveC.log`、
`/tmp/t6/step6.log`、`/tmp/t6/pair.log`，每拨的 `sysctl -n vm.loadavg` 与 `top` 的 CPU idle
都写在日志首行。三拨的负载差得很开，所以**跨列互比绝对值没有意义**；每格给的是这一拨三遍
稳态读数的区间（逐遍原值在日志里，可对 `grep '中位' /tmp/t6/waveC.log` 这类命令复核）：

| 档位 | 起草（镜像，loadavg 6.09–9.88） | C 拨（安静，loadavg 5.17–5.50，idle 54%） | A 拨（loadavg 8.51→14.28） | B 拨（loadavg 24.30→39.33） |
| --- | --- | --- | --- | --- |
| `mount()`（五块 + 1 个渲染函数，整页重建） | 28.0µs | 54.2–58.7（p10 38.9–42.1，p90 61.7–92.7） | 69.9–83.1（p10 49.1–58.1，p90 108.2–157.8） | 75.1–112.2（p10 52.1–79.8，p90 125.0–170.8） |
| `sync()`（五块全量，稳态） | 5.98µs | 12.37–14.05 | 20.27–28.35 | 20.51–31.08 |
| 点一次 tab（click → sync → 写地址栏） | 6.33µs | 13.47–15.58 | 18.22–25.63 | 20.93–30.92 |
| 一次按键（keydown → move → sync → focus） | 6.34µs | 13.70–15.59 | 21.31–26.52 | 20.43–30.61 |
| 一次被忽略的按键（Ctrl+ArrowUp） | 0.03µs | 0.02–0.06 | 0.07–0.09 | 0.03–0.13 |
| `run()` 成功一次（含整轮 sync） | 6.08µs | 11.63–13.30 | 20.56–26.66 | 18.78–28.76 |
| `run()` 抛错一次（含标坏 + 错误条） | 16.17µs | 33.50–40.60 | 64.37–67.50 | 49.39–78.37 |
| 坏 hash 一次（applyHash + notice + sync） | 6.71µs | 13.86–17.72 | 22.99–24.60 | 20.28–31.09 |
| 错误条建 + 撤摊销（200 对 = 400 次，各含整轮 sync） | 14.89µs/次 | 28.59–32.81 | 38.56–54.03 | 35.16–72.36 |
| 冷启动 `import panel-dom.js`（七进程各一次） | 4.01（3.90–4.41） | 中位 8.76（7.77–20.43） | 中位 14.50（9.57–74.82） | 中位 23.92（18.29–58.53） |

三拨的绝对值彼此差到 2.5 倍（`sync` 12.4 → 31.1），跟 Task 5 那一批的规律一样：**只能判量级，
不能拿来设阈值**。但三拨都同方向地比起草镜像贵 **2–5 倍**（`sync`：5.98 → C 12.4 / A 20.3–28.4 / B 20.5–31.1），而冷启动那一格从 4.01ms 涨到 8.76ms
也说明起草那批跑在一个更空的窗口里——所以这一格不打算给"落地值 = 起草值"的交代，只把三拨
连同负载一起摆出来。

这一格的 import 时里必然带着 `panel.js`（它是这层唯一一条 import），真页面上这两个文件编在同一
个 `toolkitCore.min.js` 里，所以这些数都只是 Node 侧参考，不进浏览器那条账。

**C 拨与 B 拨都是背靠背跑的**：每拨跑完绑定层三遍，紧接着跑 Task 5 那份 view 基准
（`/tmp/t6/viewbench.sh`，就是从计划里原样切出来的 4726–4761 那三十五行），两拨各自的
绑定层与视图基准共用同一个负载窗口（C：loadavg 5.17–5.50；B：loadavg 24.30–26.19）。
这么跑就是为了把起草那句"比视图渲染小一个数量级"换成**同条件下量出来的比值**：

| 同一窗口 | 绑定层一次按键 | `parseBlock` 身份证（有效，10 列明细） | 比值 |
| --- | --- | --- | --- |
| C 拨（loadavg 5.17–5.50） | 13.70–15.59µs | 25.52µs（信用代码 15.95、手机号 13.03、银行卡 23.73） | 0.54–1.2× |
| B 拨（loadavg 24.30–26.19） | 20.43–30.61µs | 97.44µs（信用代码 51.20、手机号 75.89、银行卡 122.90） | 0.21–0.60× |

**"小一个数量级"不成立**：安静窗口里绑定层一次交互是视图渲染一次的**五六成**，忙的时候才降到
**两成上下**。起草那格之所以写成"一个数量级"，是拿镜像上的 6µs 去比视图层另一批 66.7µs，
两批数各自的负载不是一回事。方向上也得改口：绑定层不是"可以忽略的一项"，而是与视图渲染同量级
的一笔——一次按键的真实总账是 `keydown` 那一档 **加** 装配层随后那次 `parseBlock`，
安静时约 14 + 26 ≈ **40µs**，很忙时约 31 + 123 ≈ **154µs**。结论没翻：这两档都远在 16ms
一帧之下，"每次输入都把五块面板重刷一轮"**不需要防抖或分片**；但 Task 10 若要给交互设预算，
**按"绑定层 ≈ 视图渲染的 0.2–1.2 倍"设，不要按"可忽略"设**。
（C 拨同窗口还读到：`batchBlock` 身份证 20 条 **41.72µs**、三元组 20 组 **30.32µs**、
`listTable` 姓名 50 条 **91.13µs**、`esc` 118 字符 **1.74µs**、满批一轮 **1.21ms/批**。）

`run()` 抛错那一档贵在哪儿，也在落地这一轮单独量了四档（`/tmp/t6/errbench.log`，起跑时
loadavg **52.03**，比三拨都忙，所以只用同一窗口内的相对差）：只 `try/catch` 不抛
**0.04µs/次**（测量下限）、`new Error('基准里的抛错样本')` + 抛 + 接 **20.71µs**、抛完再
`String(err)` 一次 **42.84µs**、改成读 `e.message` **21.92µs**。也就是说 `try/catch` 这一格
本身不要钱，成本在**构造 `Error` 与抓栈**上；拿三拨自己的数对一下：抛错档减成功档的溢价，
C 拨是 **20.5–27.3µs**、A 拨 **40.0–43.8µs**、B 拨 **30.6–49.6µs**（逐遍相减），与 `new Error`
那一档同量级、且随负载同步放大，起草那批的 ≈10µs 溢价对的是它自己的 3.62µs。
另一半结论同样要紧：`messageOf` 走的是"读 `message`"那条便宜分支（比只抛只接多 **1.2µs**），
不是 `String(err)` 那条（多 **22µs**）——这层"文案优先取 `message`"的策略于此有了性能理由。

**这批数只能判量级、不能拿来设阈值**，落地这一轮比起草那轮演示得更彻底：本机 load average 从
C 拨的 **5.17** 一路涨到 B 拨之后的 **90.25**（桌面一直有别的活），`mount` 那一档九遍读数的
"最慢一次"从 **267µs** 一直到 **43.2ms**（尾部全是 GC 与抢核，所以那一行报 p10 / 中位 / p90
而不是区间），Step 4 那条全量命令的 `# duration_ms` 四跑读到的依次是
**34.95 / 34.23 / 40.38s**（loadavg 26–52）与 **9.75s**（loadavg 5.88）——起草那格是
4.14–5.31s，同一条命令同的一份文件最大差到 **9.8 倍**。**越发不要拿 duration_ms 当门禁**，
门禁只看 `exit=0` 与 `# fail 0`（落地这三轮：`# tests 130`、`# pass 130`、`# fail 0`、
`exit=0`，一字不差）。能站住的只有三条：一次交互落在绑定层上的常数是**十µs 档**，与视图渲染
同量级（0.2–1.2 倍），两者相加远在 16ms 一帧之下，因此"每次输入都把五块面板重刷一轮"不需要
防抖或分片；被忽略的修饰键组合是 **0.02–0.13µs**，说明它压根没进 DOM 那一圈；`mount()` 是 `sync()` 的 **2.5–5 倍**（三拨各自的中位相除），但它多的是找节点与挂监听，
是一次性成本、不在交互路径上。
真页面上的首屏与交互端到端时间由 Task 10 的 headless Chrome 量，性能预算真正看的是 gzip 字节。

Expected（**落地这一格是这一整段里唯一一处起草数字全部照复的**：除下面点名两处以外，逐条实测相等）：
`node --check` 退出 0；`wc -c` **16,955 字节**、`gzip -6` **7,007 字节**、`gzip -9` **7,005**
（两档只差 2 字节，这层没什么可再压的；全站统一的判据口径 `cat f | gzip -9 -c` 是 **6,992 字节**，
那 13 字节是 gzip 头里的原名）；文件 **322 行**（`wc -l`），其中整行注释 **94 行 / 8,573 字节**
（行占 29%、字节占 51%——比 `view.js` 的 38% 高一档，这层的大头不是"怎么干"而是"为什么不那么干"，
五条口径各占一段）；导出 **1 个**（`createPanelDom`），模块顶层私有 **6 个**（`ERROR_CLASS`、
`BANNER_BEFORE`、`BANNER_AFTER`、`WORKSPACE_API`、`messageOf`、`shapeOf`），文件级 import
**1 条**（`keyAction`）。产物口径（terser 之后）到 Task 9 的收录面一起量。
两处对不上、按落地实测改：**§I 判据块是 529 行 / 27,295 字节 / 16 条**（起草的 530 / 27,296 差
一行一字节——镜像块头那一处修正：`// ── §I` 标记必须排在 `import` 之前，否则 `splitAtMarks()`
会把标记以上那几行算进 §H，改完少掉一个空行；`verify-plan-blocks.mjs` 报的"磁盘 3968–4496 /
计划 4933–5461（529 行）逐字节全等"与这格互相印证），**追加后 `scripts/toolkit-tests.mjs`
共 4,496 行 / 295,260 字节**（起草那格是照 §G / §H 尚未落地时的形状写的，段 1 收口时那份是
2,554 行 / 179,197 字节）。**这两个数只到 Task 6 落地那一刻为止**：Task 7 Step 1a 往 §I 那台假
DOM 工厂上插了 18 行五张口子，于是 §I 块变成 **547 行 / 磁盘 3968–4514**，镜像已同步到计划
4933–5479，`scripts/toolkit-tests.mjs` 变成 4,514 行（Task 7 Step 1a 那一格记了实测）。

- [x] **Step 7: 提交**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
git status --porcelain
git add dev/js/tools/panel-dom.js scripts/toolkit-tests.mjs
git commit -m "$(cat <<'EOF'
feat(tools): 面板 DOM 绑定层 panel-dom.js——属性表只写不判 + 单块错误隔离

全站只允许一处 ARIA 口径：tabAttr / panelAttr / tablistAttr 给什么就写什么，不判断、
不改名、不补默认值。唯一的按值型分派是 hidden——setAttribute('hidden','false') 在真 DOM
上照样是隐藏，W1 一刀红十三条，那才是"一次只显示一块"的真实含义。

焦点只跟键盘走：点击与 hashchange 都不抢焦点，带修饰键与中键整个不接——深链开新标签就是
深链的价值。地址栏只在用户动手之后写，坏 hash 原样留着、只在页面里说一句，绝不"帮你"退回
第一块（W15 / W30）；changed 为假时整段不做第二件事，免得凭空多一条历史记录。

一块塌不整页崩：错误条与提示行只写 textContent，message 里那句 </script> 没有第二次转义
的机会，W6 / W7 由 I12 的全节 innerHTML 审计接住。骨架缺件分两档，缺 tab 的那块面板仍参与
可见性互锁，run() 不许把"缺节点"洗成"好了"。

§I 的 16 条用手写假 DOM：站内没有 jsdom，不为一个绑定层加依赖、动 package.json 与锁文件。
三十一刀全部有红——W17 与 I8 第一版都是等效的，补了裸 # 样本与 W31 才有牙。
EOF
)"
git status --porcelain | head
```

Expected：**这一格同样不止两条路径**——`panel-dom.js` 是整文件镜像，落地时必须同批把它登记进
`verify-plan-blocks.mjs` 的 `FILE_TARGETS`（前三格各踩过一次：Task 2 与 Task 3 是四条，Task 4 起
自证器已改成从校验器源码解析清单，只改一处就够，所以这一格预期是三条）。
剩下仍是对方那批未提交项。`_docs/superpowers/plans/` 里这份计划
按 Task 11 的收口节奏单独提。

## Task 7: 证件页装配层与两个入口（`workbench.js` + `toolkitCore.js` + `toolIdcard.js`，§J 十六条）

**Files:**
- Create: `dev/js/toolkitCore.js`（跨页共用层入口 → `window.Tk`）
- Create: `dev/js/tools/workbench.js`（本页装配层：spec → 模块入参 → 结果 HTML）
- Create: `dev/js/toolIdcard.js`（页面入口：读骨架那四格数据，接线）
- Modify: `scripts/toolkit-tests.mjs`（追加 §J 十六条 → 全量 146 条）
- 本格**不**创建 `tools-idcard.html` / `dev/sass/toolkit.scss` / `_data/onlineTools.yml` /
  `assets/img/tools/idcard-tool.svg`，也不碰 `postcss.config.js`——那五件是 Task 8 的活（骨架那一格
  从四件变五件：yml 的 `icon` 字段指向那个 svg，虽然第一个消费者要到 Task 9 的下拉才出现，但文件
  必须和 yml 同批落地，否则 Step 1 那条 `icon在盘上=true` 当场红）。分界线的根据是"谁判它"：
  这一格的三件全部由 §J 在 Node 里判（假 DOM 就够），骨架与样式只能由构建产物判（`import{` 计数的
  那一条之外，还有要读到磁盘上的 HTML 与 CSS 的那几条）。两格各自一次提交，红的时候能一眼说出是
  哪一格红的。

这一格落的还是"看不见"的一层：三条 `<script>` 里前两条已经能构建出产物，但站里还没有任何页面
引用它们，用户看见的还是段 1 那张空档。从这里起才有"这一页怎么跑起来"的代码；`toolkitCore.js`
与 `toolkit.scss` 在段 3 / 段 4 直接复用，`workbench.js` 的 `WORKBENCH_SPEC` 换成编码工具箱那一套
就是 codec 页的装配层。所以这一格的口径，一半是"这一页怎么做"，另一半是"三页共用的东西长什么样"。

**九条口径，先立住再动手**（每条后面括号里是咬它的判据与变异）：

1. **跨页共用的只有 `window.Tk` 那三只，业务模块不下沉。**（J12 / Y1 Y2 Y3）
   段 1 在镜像里实测过：`dev/js/` 下两个入口同时 `import` 同一模块，Rollup 把它提成共享 chunk，
   而 `vite.config.js` 的 `iife-wrap` 把 ESM 的 `import` 声明包进函数体，产物里留下
   `import{c as o}from"./panel.min.js"`——经典 `<script>` 当场 SyntaxError，**整页白屏而构建 exit=0**。
   所以共用的东西必须经一道"挂全局"的中转：`toolkitCore.js` 只挂 `createPanelWorkspace` /
   `createPanelDom` / `view` 三个名字，不加版本号、不加解析函数、不"顺手暴露"。页面入口拿不到的
   能力就是不存在，将来要扩面是显式改动。六本业务模块只有证件页要，走 `workbench.js` 直接
   `import` 内联进 `toolIdcard.min.js`，不下到这一层。
2. **入口不许有顶层 `export`。**（J14 源码红线 / Y3）
   同一条坑的另一种写法：`iifeWrapPlugin` 把 chunk 包成 `(function(){…})();` 且不补 `'use strict'`，
   顶层 `export` 在函数体里是语法错误。`toolkitCore.js` 与 `toolIdcard.js` 各判一条"不许匹配
   `/^export /m`"，而 `workbench.js` 反过来判"必须还能被 import"——两档一起写，才不是一句空话。
3. **空值不写键。**（J1 J2 / X1 X2 X3）
   `valueOf` 把空串统一折成 `null`，`buildOptions` 按 `null` 决定"这一格不写进模块入参"。
   写进去反而糟：`idcard.js` 对 `sex: null` 与"没有 `sex` 这个键"的处理是同一条回落链，
   但 `uscc.js` 的 `registry: ''` 会被字符集闸门拒掉——装配层替用户把空串递进模块，等于把
   "我没填"翻译成"我填了个空"。
4. **两类失败分档，一档都不许静默。**（J3 J8 / X7 X8 X45）
   `FieldError` 是"这一栏的输入不能用"：消息进结果区的提示行，复制按钮禁用，面板不进 broken 名单，
   错误条也不出现。其余异常（模块的范围错、spec 与骨架对不上的 `RangeError`）原样抛给
   `runGuarded`，由绑定层标坏**这一块**——一块塌不整页崩，另外四块照旧能生成。两档的边界靠
   `err.isField === true` 判，不靠 `instanceof`：入口与装配层在产物里是两个闭包作用域，
   `instanceof` 跨不过去（段 1 计划的 §0 已经钉过这条）。
5. **骨架是 spec 的影子，不是反过来。**（J9 J10 / X33 X34 X35 X36 X37）
   控件 id 全部走 `fieldId` / `buttonId` / `copyId` / `outId` / `whenId` 五个派生函数，
   找节点只许 `getElementById`，不许 `querySelector`、不许读 `data-tk-*`。`controlIds(prefix)`
   把"这个前缀下应该存在的全部控件 id"导出成一份清单，Task 9 拿它对账磁盘上的 HTML：
   spec 说应有而页面没有 → 装配层第一次点就抛；页面有而 spec 没说 → 那是个没人接的格子。
   换前缀（`.tk-` → `.jt-`）必须是整套换，行为一位都不改——J10 用 `jt` 前缀把整轮判据重跑一遍。
6. **HTML 出口只有一处，动态文本一律过 `esc`。**（J14 / X28 X29 X30 X31 X32）
   `paint()` 是全层唯一的 `innerHTML` 赋值。提示行也过 `esc`，因为 `countOf` 那句消息会把用户
   填的那一格原样带进句子里——粘贴框回显与数量格那两格是这一层仅有的两个 XSS 出口。
   `view.esc` 来自 `window.Tk`，不在这里重抄一份。
7. **显隐只走 `hidden` 布尔属性。**（J4 / X43 X57）
   段 1 在 `panel-dom.js` 立的口径（可见性的唯一来源是那一个属性）在这里同样成立：两处都能改
   显隐就等于两处能互相覆盖。受开关控制的是 HTML 里那一段 `<p data-tk-when>`，不是三个
   `<select>`——隐藏那一段才叫"这一类用不上"，逐个隐藏会留下一个空标签。
8. **整栏通用的那几句口径，栏尾说一次；逐行的结论留在行里。**（J15 / X23 X24 X25 X26 X27）
   `bankcard.js` 的 `caveat` 恒为 `BANK_CAVEAT`、`phone.js` 同档带 `note`，`view.parseBlock`
   会照字段收走——粘 50 行就是 50 段同一句话。这里按**常量全等**把它们摘出来、排在逐行结果之后
   说一次。全等而不是"看着像"：身份证与信用代码的 `caveat` 随号码而变（撤销区划、小写转大写），
   那两句必须留在各自那一行里，摘错了就是把结论从号码旁边搬走。
9. **复制三级兜底，任何一级都不许抛到页面外面。**（J7 / X48–X55）
   `navigator.clipboard` → 临时 `<textarea>` + `execCommand('copy')` → 一句"请手动选中"。
   同步抛错与异步拒绝走同一条路（`writeText` 在权限策略拒绝时可能直接抛、不返回 Promise），
   临时框在 `finally` 里摘——`select()` 或 `execCommand` 抛错时也要摘，留在页面上就是一个能被
   Tab 走到的隐形输入框。这两格是 Task 7 写判据时才从代码里挖出来的真缺陷：口径先写在了
   `workbench.js` 的文件头注释里，实现漏了，判据一补就红。

- [x] **Step 1a: 先给 §I 那台假 DOM 补上 §J 要用的五张口子（纯插入，18 行）**

§J 接的是真装配层，于是它要比 §I 多读五样东西：控件的 `value` 与 `disabled`、临时
`<textarea>` 的 `select()`、`document.body`（挂临时节点用）与 `document.execCommand`（第二级兜底
的返回值），外加三个观察口 `mk` / `selLog` / `commandLog` 与一份 `made` 清单。这五张口子开在
§I 那台 `iPage` 工厂上，**不再长第二套假 DOM**——两套并排的话，"两节看到的是同一种 DOM"这句
话就没人判了。§I 那 16 判一条都不读这些新口子（`value` / `disabled` 是表单控件的事，绑定层只碰
属性表与 `hidden`），所以这一步的形状是**改了文件、用例数一个没动**。

写成脚本而不是照行号手改，原因和 Step 5 的变异脚本一样：§I 落地以后行号会跟着每次追加漂，
锚点却在全文件里唯一。七处锚点、只插不改，命中 0 次或 2 次以上当场抛，"已经补过了"也当场抛
（重跑这一步不该把文件插成两份）。

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
mkdir -p /tmp/pfx/t7
cat > /tmp/pfx/t7/patch-ipage.mjs <<'EOF'
/* 给 §I 的假 DOM 补上 §J 要用的那几张口子：七处**纯插入**，一行都不改写、一行都不删。
   为什么写成脚本而不是让人照着行号手改：§I 那 sixteen 判的正文在计划里就有一整块，
   执行时磁盘上的行号会跟着 Task 2–6 的追加一路漂；锚点在全文件里唯一（本脚本逐条断言），
   所以这一步要么精确落地、要么当场抛，不存在"改到隔壁那一节去"的中间态。
   插入的每张口子都不在 §I 的读取面上（见第 2 条注释），所以补完 §I 必须照绿——
   这一步红了只有一种解释：插入没落地或插错了位置，先修脚本再说往下走。 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const F = 'scripts/toolkit-tests.mjs';
/** 内容取 md5：绝不走 shell——这段文本里满是反引号与 `$`，一旦拼进命令行就是命令替换 */
const md5 = (t) => createHash('md5').update(t).digest('hex').slice(0, 12);

/** [锚点行（原文，全文件必须唯一）, 紧接其后要插入的行] */
const INS = [
  [' *    "重复点同一块不重复写地址栏"永远测不到（比对 `location.hash` 那一步恒假）。', [
    ' *',
    ' * **§J 借的是这一个工厂**，所以它多开五张读写口子（`value` / `disabled` / `select()` /',
    ' * `document.body` / `document.execCommand`）与三个观察口（`mk` / `selLog` / `commandLog`）。',
    ' * 上面三条"不像真 DOM"一条没撤，本节十六判也没有一条读这些新口子——`value` 与 `disabled`',
    ' * 是表单控件的事，绑定层只碰属性表与 `hidden`；两节共用一份工厂，是为了不让假 DOM 长第二套。',
  ]],
  ['  const mkText = (text) => ({ nodeType: 3, tagName: \'#text\', textContent: String(text) });', [
    '  /** §J 的复制兜底与下拉填充要这三张口子；§I 的十六判一条都不读它们（见 §J 开头第 0 条） */',
    '  const selLog = [];',
    '  const commandLog = [];',
    '  const made = [];',
  ]],
  ['      nodeType: 1, tagName: tag.toUpperCase(), id, attrs, childNodes: [], hidden: false,', [
    "      value: '', disabled: false,",
  ]],
  ['      focus: () => { focusLog.push(el.id); },', [
    '      /** 临时 `<textarea>` 那条兜底路径要 `select()`；记下来供 §J 判"用完有没有摘掉" */',
    '      select: () => { selLog.push(el); },',
  ]],
  ["    if (id !== '') nodes.set(id, el);", [
    '    made.push(el);',
  ]],
  ['    createTextNode: mkText,', [
    '    /** §J 的 `legacyCopy` 要往 `body` 上挂临时节点，`execCommand` 的返回值由夹具说了算 */',
    "    body: mkEl('body'),",
    '    copyOk: true,',
    '    execCommand: (name) => { commandLog.push(name); return doc.copyOk === true; },',
  ]],
  ['    doc, ws, location, history, win, notice, focusLog, historyCalls, nodes,', [
    '    mk: mkEl, selLog, commandLog, made,',
  ]],
];

const before = fs.readFileSync(F, 'utf8');
let text = before;
for (const [anchor, lines] of INS) {
  const hits = text.split(anchor).length - 1;
  if (hits !== 1) throw new Error(`锚点命中 ${hits} 次（要正好 1）：${anchor.slice(0, 48)}…`);
  const add = anchor + '\n' + lines.join('\n');
  if (text.includes(add)) throw new Error(`已经补过了，不重复插：${anchor.slice(0, 48)}…`);
  text = text.replace(anchor, add);
}
fs.writeFileSync(F, text);
const added = text.split('\n').length - before.split('\n').length;
console.log(`插入 ${added} 行（要 18）｜md5 ${md5(before)} → ${md5(text)}`);
if (added !== 18) throw new Error('插入行数和预期不符，先核对锚点清单');
EOF
node /tmp/pfx/t7/patch-ipage.mjs
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs > /tmp/j1a.log 2>&1; echo "exit=$?"
grep -E '^# (tests|pass|fail)|^not ok' /tmp/j1a.log
```

Expected：`插入 18 行（要 18）｜md5 …→…`（两个 md5 必然不同，行数是脚本自己断言的）、`exit=0`、
`# tests 130`、`# pass 130`、`# fail 0`。**用例数一条都不许多**——这一步只加夹具的读写口子，
不加判据；红了或者数字变了，唯一可能就是插入落错了位置，先修锚点再往下走。
`md5` 在 Node 里用 `createHash` 算，不是 `execSync('md5 -s ' + 文件内容)`：那段文本里满是反引号与
`$`，拼进命令行会被 shell 当命令替换执行（2026-09-27 写这一步时真踩过，屏幕刷出五十多行
`command not found` 而脚本照样退 0——这是"脚手架静默说谎"的第 10 种形状）。

**落地实跑 2026-09-27**：`插入 18 行（要 18）｜md5 0835acca2267 → 7f62ca69b8ed`、`exit=0`、
`# tests 130`、`# pass 130`、`# fail 0`。七处锚点各命中一次，用例数一条没多；
`scripts/toolkit-tests.mjs` 4,496 → **4,514 行**，`git diff --numstat` 回 `18 0`（纯插入、零删除）。

插完立刻有一件账要还：§I 的镜像比磁盘少那 18 行，`verify-plan-blocks.mjs` 当场喊出来
（"磁盘 3968–4515 ↔ 计划 4933–5461（529 行），前 23 行相同，此后不再逐字节全等；首个不同在
报告的第 24 行——计划 ` */` vs 磁盘 ` *`"，正是那五行节头注释插进去的位置）。已把 Task 6 那格
镜像整块换成磁盘上的 §I：**547 行 / 磁盘 3968–4514 / 计划 4933–5479**，换完该节复绿。这条链是
刻意留的——§I 与 §J 共用一台假 DOM 工厂，口子开在 §I 身上，镜像就必须跟着 §I 走，不留"磁盘变了、
计划还写着旧的一份"那种静默差异（上一轮 `build-prefix-data.mjs` 就是这么躲过去的）。

草稿阶段那句"§I 那一块（524 行）……出来的 542 行"是照起草时的形状估的，两个数都不对：
§I 落地实测 **529 行**，补完五张口子 **547 行**。以这两行为准，Task 6 Step 6 末尾也已注明那两数
只到 Task 6 落地那一刻。

- [x] **Step 1b: 追加 §J 的 16 条判据（此时 `workbench.js` 还不存在，必红）**

追加到 `scripts/toolkit-tests.mjs` 末尾。四条夹具口径写在节头注释里，其中第三条与第四条是这一节
与前面各节最不一样的地方：**节点清单来自 `controlIds(prefix)` 与 `WORKBENCH_SPEC` 本身**，测试里
不重抄一份 id 清单（重抄的那份会跟着 spec 一起错，Task 9 拿 spec 对账骨架也就失去了第三者）；
代价是 spec 与骨架同时漏一格时本节不红——那是 Task 9 的活，它比的是磁盘上的 HTML。

假 DOM 复用 §I 那一份（`iPage`，Step 1a 刚给它补了五张口子），本节只加 `jPage` / `jMount` 两个
包装：结果区走的是 `out.innerHTML = 字符串`，假 DOM 上它只长成一个普通属性、不解析标签，所以判据
读的是**那一串文本**——这正好也是真页面唯一吃进 HTML 的地方。`drop` 那一档要翻译成 `iPage` 认得的
`dropTab` / `dropPanel`（`jPage` 负责这层翻译，第一版直接把 `tk-out-*-gen` 这类派生 id 原样递给
`iPage`，`missing` 数出来是空数组，判据当场假绿）。

用例名是这一节唯一的锚，**位置不按编号排**：`J7`（复制三级兜底）排在整节最后，因为它是 Step 5
补牙时才补上的那一档 `(i)`——Step 5 的六十六刀用 `^not ok \d+ - J\d+` 认"红了谁"，靠的就是用例名
而不是行序，挪位置不改变任何一刀的读法。

```js
// ── §J 证件页装配层与入口（`tools/workbench.js` / `toolkitCore.js` / `toolIdcard.js`） ──
//
// 本节把 `workbench.js` 开头那五条口径逐条咬一遍，并且是**接真的三方**咬：绑定层用
// `panel-dom.js` 本尊、结果 HTML 用 `view.js` 本尊、六本业务模块与 `region.js` 也都是本尊。
// mock 掉任何一样，§B–§H 那十九节判据就从"这一层没错"变成"这一层没测"。
//
// 四条夹具口径：
//
// 0. **假 DOM 复用 §I 那一份**（多开的五张读写口子见 `iPage` 的注释头）。结果区走的是
//    `out.innerHTML = 字符串`——假 DOM 上它只长成一个普通属性、不解析标签，所以本节读的是
//    **那一串文本**。这正好也是真页面唯一吃进 HTML 的地方，J13 就数它的赋值次数。
// 1. **每一判都从"按真的按钮 / 派发真的事件"起步**，只有要问 `runGuarded` 走没走时才看返回值。
//    装配层的价值全在接线上，绕开接线等于没测。
// 2. **随机源钉住**（`seededRandom`），于是"共 5 条""前缀 110101"不是运气。
// 3. **夹具的节点清单来自 `controlIds(prefix)` 与 `WORKBENCH_SPEC` 本身**，不在测试里重抄
//    一份 id 清单——重抄的那份会跟着 spec 一起错，Task 9 拿 spec 对账骨架也就失去了第三者。
//    代价是：spec 与骨架同时漏一格时本节不红，那是 Task 9 的活（它比的是磁盘上的 HTML）。
const J_VIEW = await import('../dev/js/tools/view.js');
const {
  createWorkbench, WORKBENCH_SPEC, PANEL_IDS, MAX_READ_LINES, controlIds,
  fieldId, buttonId, copyId, outId, whenId,
} = await import('../dev/js/tools/workbench.js');

/** §J 的默认随机种子：钉住"这一页第一次画什么"，让条数与前缀这类断言可复算 */
const J_SEED = 20260927;
/** 骨架里主按钮与复制按钮的文案。装配层只负责"改口之后改回原文"，句子本身是夹具替身 */
const J_MAIN_LABEL = { gen: '生成', read: '判定' };
const J_COPY_LABEL = {
  'idcard:gen': '复制这批号码', 'idcard:read': '复制判定有效的号码',
  'uscc:gen': '复制这批代码', 'uscc:read': '复制判定有效的代码',
  'bankcard:gen': '复制这批卡号', 'bankcard:read': '复制判定有效的卡号',
  'mobile:gen': '复制这批号码', 'mobile:read': '复制判定有效的号码',
  'random:gen': '复制这批结果',
};

/** spec 的 `type` → 骨架用的标签；缺省那一档全是 `<select>`（静态的也好、待填充的也好） */
const jTag = (type) => (type === 'area' ? 'textarea' : type === 'number' || type === 'date' ? 'input' : 'select');

/** 字符串在另一串里出现几次（`split` 计数，不用正则：句子里满是正则元字符） */
const jCount = (hay, needle) => hay.split(needle).length - 1;

/**
 * 造一页"骨架"：§I 的索引条 + 五块面板 + 提示行，再按 spec 长出 30 个控件、9 条主按钮、
 * 9 条复制按钮、9 个结果区与 4 个受开关控制的字段组。
 * @param {object} o 选项
 * @param {string} [o.prefix] 前缀
 * @param {string} [o.hash] 进页面时地址栏里的 hash
 * @param {Record<string, string|number>} [o.seed] `'panel:control' → 初值`；`count` 缺省 `'5'`
 * @param {string[]} [o.drop] **不**要长的 id（造"骨架缺一格"那一类缺陷）
 * @returns {object} §I 的那份 page，外加 `ctl` / `btn` / `html` / `set` / `change` 等观察口
 */
function jPage({ prefix = 'tk', hash = '', seed = {}, drop = [] } = {}) {
  // `tk-tab-*` / `tk-panel-*` 这两类骨架节点由 §I 的 `iPage` 长出，摘掉它们的活也在那儿；
  // 本节只把 id 翻译成它的两张清单，其余 id 才归下面的 spec 循环管。
  const slugOf = (id, word) => {
    const at = `${prefix}-${word}-`;
    if (!id.startsWith(at)) return null;
    const slug = id.slice(at.length);
    return PANEL_IDS.includes(slug) && id === `${at}${slug}` ? slug : null;
  };
  const dropTab = drop.map((id) => slugOf(id, 'tab')).filter((s) => s !== null);
  const dropPanel = drop.map((id) => slugOf(id, 'panel')).filter((s) => s !== null);
  const page = iPage({ ids: PANEL_IDS, prefix, hash, dropTab, dropPanel });
  const gone = new Set(drop);
  const mk = page.mk;
  const doc = page.doc;

  for (const [panel, cfg] of Object.entries(WORKBENCH_SPEC)) {
    for (const side of ['gen', 'read']) {
      const cfgSide = cfg.sides[side];
      if (!cfgSide) continue;
      for (const c of cfgSide.controls) {
        const id = fieldId(prefix, panel, c.id);
        if (gone.has(id)) continue;
        const el = mk(jTag(c.type), id);
        // 骨架里每条 select 都自带一句占位项（"不限省份"之类）；`#random-kind` 是唯一
        // 没有空占位的那一条，它的第一项 `name` 就是浏览器的默认选中值。
        // 占位项的"值"走**属性**——`firstValueOf()` 与 `fill()` 读的都是属性，真 DOM 同一条路。
        if (jTag(c.type) === 'select') {
          const ph = mk('option');
          ph.setAttribute('value', c.id === 'kind' ? 'name' : '');
          ph.textContent = '占位';
          el.appendChild(ph);
        }
        const key = `${panel}:${c.id}`;
        if (seed[key] !== undefined) el.value = String(seed[key]);
        else if (c.id === 'count') el.value = '5';
      }
      const bid = buttonId(prefix, panel, side);
      if (!gone.has(bid)) mk('button', bid).textContent = J_MAIN_LABEL[side];
      const cid = copyId(prefix, panel, side);
      if (!gone.has(cid)) {
        const cb = mk('button', cid);
        cb.textContent = J_COPY_LABEL[`${panel}:${side}`];
        cb.disabled = true;                      // 骨架写死 disabled：第一次画完之前没东西可复制
      }
      const oid = outId(prefix, panel, side);
      if (!gone.has(oid)) mk('div', oid);
    }
  }
  for (const id of controlIds(prefix).when) if (!gone.has(id)) mk('p', id);

  const at = (id) => doc.getElementById(id);
  return Object.assign(page, {
    prefix,
    ctl: (panel, control) => at(fieldId(prefix, panel, control)),
    btn: (panel, side) => at(buttonId(prefix, panel, side)),
    copy: (panel, side) => at(copyId(prefix, panel, side)),
    outNode: (panel, side) => at(outId(prefix, panel, side)),
    whenNode: (panel, key) => at(whenId(prefix, panel, key)),
    /** 结果区里那一串 HTML；节点被 `drop` 掉时给空串，判据照样跑得动（那一判要的就是"没画"） */
    html: (panel, side) => String(at(outId(prefix, panel, side))?.innerHTML ?? ''),
    set: (panel, control, v) => { const el = at(fieldId(prefix, panel, control)); el.value = String(v); return el; },
    change: (panel, control) => at(fieldId(prefix, panel, control)).dispatch('change', {}),
    click: (panel, side) => at(buttonId(prefix, panel, side)).dispatch('click', {}),
    clickCopy: (panel, side) => at(copyId(prefix, panel, side)).dispatch('click', {}),
    keyOn: (panel, control, evt) => at(fieldId(prefix, panel, control)).dispatch('keydown', evt),
  });
}

/**
 * 装配层 + 绑定层 + 挂载，一路接成页面上那个样子。
 *
 * 两种"填格子"要分开，因为它们在页面上根本不是同一时刻的事：
 * - `seed`：**骨架自带的初值**（只有 `count` 那条 `value="5"` 属于这里）。它在挂载之前就在
 *   DOM 上，会参与挂载期的第一次生成。
 * - `pick`：**用户改的选择**。挂载时每条 select 都被 `refill()` 重建过一遍并 reset 成
 *   `''`（真页面也是这样：省格刚填上 31 条选项，默认落在占位那条），所以任何"我选了北京"
 *   的事实只能在挂载之后写下，并且要跟着派发 `change`——级联与开关全挂在 `change` 上，
 *   不派发就等于用户在 DOM 里偷偷改了值。
 *
 * @param {object} o 透给 `jPage` 的选项，外加 `clipboard` / `rng` / `pick`
 * @returns {object} `{ page, wb, dom, report, timers, guarded, flush }`
 */
function jMount(o = {}) {
  const prefix = o.prefix ?? 'tk';
  const page = jPage({ prefix, hash: o.hash, seed: o.seed, drop: o.drop });
  const timers = [];
  /** `runGuarded` 的调用记录：口径 2 说"挂载期一次都不许走它"，这一格就是它的观察口 */
  const guarded = [];
  const host = { dom: null };
  const wb = createWorkbench({
    document: page.doc,
    Tk: { view: J_VIEW },
    prefix,
    today: TODAY,
    ...(o.rng === null ? {} : { rng: o.rng ?? seededRandom(J_SEED) }),
    navigator: o.clipboard ? { clipboard: o.clipboard } : undefined,
    later: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    runGuarded: (id, fn) => { guarded.push(id); return host.dom.run(id, fn); },
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
  return { page, wb, dom, report, timers, guarded, flush, prefix };
}

/** 一条有效号码：把 17 位本体交给 §B 的 `mk()` 补校验位，本节不另算一遍模 11 */
const jIds = (bodies) => bodies.map((b) => mk(b));
/** 复制按钮当前那句文案（`textContent` 走的是子节点，与真 DOM 同一张脸） */
const jLabel = (page, panel, side) => page.copy(panel, side).textContent;
/**
 * 排空微任务：`navigator.clipboard.writeText` 那一级的成败是异步的，而 `later` 被夹具
 * 换成了"只记账不执行"，所以 `await` 这一发只等 Promise 链落地，不等那 1600 ms。
 * 用的是全局 `setTimeout`，不是注入给装配层的那只——后者一执行就会把按钮文案改回去。
 * @returns {Promise<void>} 微任务队列清空
 */
const jSettle = () => new Promise((r) => { setTimeout(r, 0); });

test('J1 口径 1：没选的格子整键不传；选了的格子必须真的落到号码上', () => {
  // 左半边：一格不填（只有骨架自带的 count=5）在挂载期跑完五块面板。
  // 这一格是**行为**证据不是读数证据：六本模块收到空串各抛各的（`sex:''` 抛 RangeError、
  // `areaCode:''`/`domain:''`/`givenLength:''` 抛 TypeError），空串只要递下去一块就进 broken 名单。
  const bare = jMount();
  assert.deepEqual(bare.report.broken, [], '有一格把空串递下去了：五块面板应当在挂载期全部画好');
  assert.deepEqual(bare.report.rendered, PANEL_IDS);
  assert.deepEqual(bare.report.missing, [], '夹具自证：五块面板的 tab 与 panel 节点都在');
  for (const panel of PANEL_IDS) {
    assert.match(bare.page.html(panel, 'gen'), /<p class="tk-count">共 5 条<\/p>/, `${panel}：挂载期没画出 5 条`);
  }
  // 空着的 registry / category 让模块走它自己的默认**字符**（不是随机）：这是"不写键"唯一
  // 能被看出来的方式——写成 `''` 早就抛了，写成随机又和默认字符对不上。
  const codes = bare.wb.copyTextOf('uscc', 'gen').split('\n');
  assert.equal(codes.length, 5);
  for (const c of codes) {
    assert.equal(c.length, 18, `${c}：不是 18 位`);
    assert.equal(c[0], '9', '登记管理部门代码没选，模块的默认字符应当是 9');
    assert.equal(c[1], '1', '机构类别代码没选，模块的默认字符应当是 1');
  }
  // 空着的位数 → 行别登记位数，卡号长度落在 13–19 且每一条都过 Luhn
  for (const n of bare.wb.copyTextOf('bankcard', 'gen').split('\n')) {
    assert.equal(n.length >= PAN_MIN && n.length <= PAN_MAX, true, `${n}：位数越界`);
    assert.equal(parseBankCard(n).state, 'valid', `${n}：空位数生成的卡号不自洽`);
  }
  // 空着的号段 / 运营商 → 11 位且首位形状合法；空着的字数 → 名字 2 或 3 字
  for (const n of bare.wb.copyTextOf('mobile', 'gen').split('\n')) {
    assert.match(n, /^1[3-9]\d{9}$/, `${n}：号段形状不对`);
  }
  for (const nm of bare.wb.copyTextOf('random', 'gen').split('\n')) {
    assert.match(nm, /^[一-鿿]{2,3}$/, `${nm}：不限字数时名字长度不对`);
  }
  // 右半边：同样的格子填上值，值必须真的改号码——不然"不写键"和"写了键"就分不出来。
  // 走 `pick`（挂载后改 + 派发 change）而不是 `seed`：省格与字符集格在挂载期被 `refill()`
  // 重建过，构造时写下的值会被 reset 成空，页面上"用户选的"从来都发生在挂载之后。
  const set = jMount({
    pick: {
      'idcard:sex': 'male', 'idcard:province': '11', 'uscc:registry': 'A', 'uscc:category': '2',
      'bankcard:length': 16, 'mobile:segment': '138', 'random:givelen': '2',
    },
  });
  assert.deepEqual(set.report.broken, []);
  for (const panel of PANEL_IDS) set.page.click(panel, 'gen');
  for (const id of set.wb.copyTextOf('idcard', 'gen').split('\n')) {
    assert.equal(Number(id.slice(16, 17)) % 2, 1, `${id}：选了男却出了女`);
    assert.equal(id.slice(0, 2), '11', `${id}：选了北京市却没落在 11`);
  }
  for (const c of set.wb.copyTextOf('uscc', 'gen').split('\n')) {
    assert.equal(c[0], 'A', `${c}：第 1 位不是选中的 A`);
    assert.equal(c[1], '2', `${c}：第 2 位不是选中的 2`);
  }
  for (const n of set.wb.copyTextOf('bankcard', 'gen').split('\n')) {
    assert.equal(n.length, 16, `${n}：指定了 16 位却画成 ${n.length} 位`);
  }
  for (const n of set.wb.copyTextOf('mobile', 'gen').split('\n')) {
    assert.equal(n.slice(0, 3), '138', `${n}：指定了 138 段`);
  }
  for (const nm of set.wb.copyTextOf('random', 'gen').split('\n')) {
    assert.equal(nm.length, 3, `${nm}：名字字数选了 2 个字`);
  }
});

test('J2 区划级联：占位项留住、禁用跟着上游走、优先级是县 > 市 > 省', () => {
  const m = jMount();
  const prov = m.page.ctl('idcard', 'province');
  const city = m.page.ctl('idcard', 'city');
  const county = m.page.ctl('idcard', 'county');
  assert.equal(prov.childNodes.length, 1 + provinceCodes().length, '省格：占位项 + 31 条');
  assert.equal(prov.childNodes[0].getAttribute('value'), '', '骨架那条占位项必须还在第一位');
  assert.equal(city.disabled, true, '省没选，市格要禁用，不是留一格空白让人猜');
  assert.equal(county.disabled, true);
  assert.equal(city.childNodes.length, 1, '禁用状态下市格里只该有占位那一条');
  const cityPh = city.firstChild;
  const countyPh = county.firstChild;

  m.page.set('idcard', 'province', '11');
  m.page.change('idcard', 'province');
  assert.equal(currentCityCodes('11').length, 1, '夹具自证：北京市下面只有"市辖区"一个市');
  assert.equal(city.disabled, false);
  assert.equal(city.childNodes.length, 2);
  assert.equal(city.childNodes[1].getAttribute('value'), '1101');
  assert.equal(city.childNodes[1].textContent, cityName('1101'));
  assert.equal(city.firstChild, cityPh, 'fill 要把骨架那条占位项留住，不是重新造一条');
  // 省下恰好一个市 → 县格不等用户选市就先行放开（4 个直辖市都是这个形状）
  assert.equal(county.disabled, false);
  assert.equal(county.childNodes.length, 1 + currentCountyCodes('1101').length);
  assert.equal(county.firstChild, countyPh);

  // 优先级：三级都选上，号码只认县
  m.page.set('idcard', 'city', '1101');
  m.page.change('idcard', 'city');
  m.page.set('idcard', 'county', '110101');
  m.page.click('idcard', 'gen');
  for (const id of m.wb.copyTextOf('idcard', 'gen').split('\n')) {
    assert.equal(id.slice(0, 6), '110101', `${id}：县都选了，前六位却不是它`);
  }
  // 清掉县 → 只认市；再清掉市 → 只认省。三级各留一条口径，谁在上面听谁的
  m.page.set('idcard', 'county', '');
  m.page.click('idcard', 'gen');
  for (const id of m.wb.copyTextOf('idcard', 'gen').split('\n')) {
    assert.equal(id.slice(0, 4), '1101', `${id}：没有县时应退到市`);
  }
  m.page.set('idcard', 'city', '');
  m.page.change('idcard', 'city');
  m.page.click('idcard', 'gen');
  for (const id of m.wb.copyTextOf('idcard', 'gen').split('\n')) {
    assert.equal(id.slice(0, 2), '11', `${id}：市也空了，应退到省`);
    assert.equal(resolveRegion(id.slice(0, 6)).provinceCode, '11', `${id}：退到省之后跑出省去了`);
  }
  // 省改选到"下面不止一个市"的省，县格必须重新禁用（它无从选起）
  m.page.set('idcard', 'province', '32');
  m.page.change('idcard', 'province');
  assert.equal(city.disabled, false);
  assert.equal(city.childNodes.length, 1 + currentCityCodes('32').length);
  assert.equal(county.disabled, true, '江苏省 13 个市，没选市之前县格不该亮着');
  assert.equal(county.childNodes.length, 1, '上游断了，县格要退回只剩占位项');
  assert.equal(county.firstChild, countyPh, '退回时占位项还是原来那一条');
});

test('J3 口径 3 的两条路：缺日期是提示行不是坏面板，超范围的日期才交给模块标坏', () => {
  const m = jMount();
  const when = m.page.whenNode('idcard', 'birth');
  assert.equal(when.hidden, true, '年龄段停在占位那一条时，出生日期那一格不该先露出来');
  assert.equal(m.guarded.length, 0, '口径 2：挂载期一次都不许走 runGuarded');

  // 开关：选到 custom 才现身，退回去又藏起来（藏走的是 `hidden` 属性，不是 class / style）
  m.page.set('idcard', 'ageband', 'custom');
  m.page.change('idcard', 'ageband');
  assert.equal(when.hidden, false);
  assert.equal(when.getAttribute('class'), null, '显隐不许写进 class，也不许留 style 痕迹');
  assert.equal(when.attrs.has('style'), false);

  // 第一条路：选了 custom 却没填日期 → FieldError → 结果区一句提示，面板不进 broken
  m.page.click('idcard', 'gen');
  const hinted = m.page.html('idcard', 'gen');
  assert.match(hinted, /^<p class="tk-hint">/, '提示行要单独占结果区，不该还挂着半张表');
  assert.match(hinted, /指定出生日期/);
  assert.equal(hinted.includes('tk-count'), false, '一行都没生成就别报"共 N 条"');
  assert.deepEqual(m.page.ws.brokenIds(), [], '把"你少填了个日期"说成"这块面板坏了"是口径 3 禁止的');
  assert.equal(iBanner(m.page, 'idcard'), null);
  assert.equal(m.wb.copyTextOf('idcard', 'gen'), '', '提示行没有可复制的东西');
  assert.equal(m.page.copy('idcard', 'gen').disabled, true);
  assert.deepEqual(m.guarded, ['idcard'], '这一按走的是 createPanelDom().run 那一道闸门');

  // 修好：填上日期再按一次，提示行整段换掉、复制按钮活过来
  m.page.set('idcard', 'birth', '1990-05-06');
  m.page.click('idcard', 'gen');
  const ok = m.page.html('idcard', 'gen');
  assert.equal(ok.includes('tk-hint'), false, '提示行留在原地，人会以为还是没填');
  assert.match(ok, /共 5 条/);
  assert.equal(m.page.copy('idcard', 'gen').disabled, false);
  for (const id of m.wb.copyTextOf('idcard', 'gen').split('\n')) {
    assert.equal(id.slice(6, 14), '19900506', `${id}：指定的出生日期没落到号码上`);
  }

  // 年龄段那一档：换了档，日期格要重新藏回去，号码的年龄跟着落进区间
  m.page.set('idcard', 'ageband', '18-30');
  m.page.change('idcard', 'ageband');
  assert.equal(when.hidden, true, '从 custom 换回年龄段，日期格必须再藏起来');
  m.page.click('idcard', 'gen');
  for (const id of m.wb.copyTextOf('idcard', 'gen').split('\n')) {
    const age = parseIdCard(id, { today: TODAY }).info.ageYears;
    assert.equal(age >= 18 && age <= 30, true, `${id}：${age} 岁不在 18–30 里`);
  }

  // 第二条路：日期形状合法但超出模块的范围——那是模块的话，由它说，并且只塌这一块
  m.page.set('idcard', 'ageband', 'custom');
  m.page.change('idcard', 'ageband');
  m.page.set('idcard', 'birth', '2099-01-01');
  m.page.click('idcard', 'gen');
  assert.deepEqual(m.page.ws.brokenIds(), ['idcard'], '模块抛出来的一律原样交出去，且只塌这一块');
  assert.match(m.page.ws.brokenOf('idcard'), /2099-01-01/);
  assert.match(m.page.ws.brokenOf('idcard'), /不得晚于今天/);
  const banner = iBanner(m.page, 'idcard');
  assert.ok(banner);
  assert.match(banner.textContent, /其余面板不受影响/);
  assert.match(m.page.html('idcard', 'gen'), /共 5 条/, '标坏之前画好的那一张表不许被拖没');
  // 自我修复：改回合法日期再按一次，错误条撤掉、状态归零
  m.page.set('idcard', 'birth', '1990-05-06');
  m.page.click('idcard', 'gen');
  assert.deepEqual(m.page.ws.brokenIds(), []);
  assert.equal(iBanner(m.page, 'idcard'), null);
});

test('J4 #random 四档 kind：该现身的现身、该带上的键带上，非法值只塌这一块', () => {
  const m = jMount();
  const shown = () => ['givelen', 'addr', 'domain']
    .map((k) => `${k}=${m.page.whenNode('random', k).hidden ? 'hidden' : 'shown'}`).join(' ');
  // kind 一格在骨架里没有空占位项，浏览器默认选中 `name` → 假 DOM 里读作 ''，
  // 装配层退到 `firstValueOf()`：这一格正是那个退路存在的理由。
  assert.equal(m.page.ctl('random', 'kind').value, '');
  assert.equal(shown(), 'givelen=shown addr=hidden domain=hidden', '默认档是「姓名」');
  assert.match(m.page.html('random', 'gen'), /tk-batch--name/);

  for (const [kind, want, marker] of [
    ['address', 'givelen=hidden addr=shown domain=hidden', /tk-batch--address/],
    ['email', 'givelen=hidden addr=hidden domain=shown', /tk-batch--email/],
    ['profile', 'givelen=shown addr=shown domain=shown', /tk-batch--profile/],
    ['name', 'givelen=shown addr=hidden domain=hidden', /tk-batch--name/],
  ]) {
    m.page.set('random', 'kind', kind);
    m.page.change('random', 'kind');
    assert.equal(shown(), want, `kind=${kind} 那一档的显隐不对`);
    m.page.click('random', 'gen');
    assert.match(m.page.html('random', 'gen'), marker, `kind=${kind} 画出来的不是这一档`);
    assert.equal(m.page.ws.brokenOf('random'), '');
  }

  // 用不上的格子不许偷偷带上：地址档选的区划，切到邮箱档之后不能跟着走
  m.page.set('random', 'kind', 'address');
  m.page.change('random', 'kind');
  m.page.set('random', 'province', '32');
  m.page.change('random', 'province');
  m.page.click('random', 'gen');
  for (const line of m.wb.copyTextOf('random', 'gen').split('\n')) {
    assert.equal(line.slice(0, 2), '江苏', `${line}：江苏省的地址前缀不对`);
  }
  m.page.set('random', 'kind', 'email');
  m.page.change('random', 'kind');
  m.page.click('random', 'gen');
  const mails = m.wb.copyTextOf('random', 'gen').split('\n');
  assert.equal(mails.length, 5);
  for (const e of mails) {
    assert.match(e, /^[A-Za-z0-9._-]+@example\.(com|net|org)$/, `${e}：邮箱形状不对`);
  }
  // 三格同时生效：profile 那一档要把字数、区划、域名三个键一起带上，少一个都是"看着对、其实漏"
  m.page.set('random', 'kind', 'profile');
  m.page.change('random', 'kind');
  m.page.set('random', 'givelen', '2');
  m.page.set('random', 'domain', 'example.org');
  m.page.click('random', 'gen');
  const rows = m.wb.copyTextOf('random', 'gen').split('\n');
  assert.equal(rows.length, 5);
  for (const line of rows) {
    const [nm, addr, mail] = line.split('\t');
    assert.equal(line.split('\t').length, 3, `${line}：一组资料不是一条姓名/地址/邮箱`);
    assert.equal(nm.length, 3, `${nm}：名字字数 2 没进 profile`);
    assert.equal(addr.slice(0, 2), '江苏', `${addr}：区划没进 profile`);
    assert.equal(mail.endsWith('@example.org'), true, `${mail}：域名没进 profile`);
  }

  // 非法 kind：RangeError 原样交出去，只塌这一块，其余四块的内容一张都没掉
  m.page.set('random', 'kind', 'nope');
  m.page.change('random', 'kind');
  m.page.click('random', 'gen');
  assert.deepEqual(m.page.ws.brokenIds(), ['random']);
  assert.match(m.page.ws.brokenOf('random'), /kind 格取到「nope」/);
  assert.match(m.page.ws.brokenOf('random'), /只认 name \/ address \/ email \/ profile/);
  for (const panel of PANEL_IDS.filter((p) => p !== 'random')) {
    assert.match(m.page.html(panel, 'gen'), /共 5 条/, `${panel} 不该被 #random 拖下水`);
  }
  m.page.set('random', 'kind', 'name');
  m.page.click('random', 'gen');
  assert.deepEqual(m.page.ws.brokenIds(), [], '改回合法值就该自愈');
  assert.equal(iBanner(m.page, 'random'), null);
});

test('J5 读侧：原始行号、空行只占号不占位、50 行上限、空框给提示', () => {
  const good = mk('11010119900307001');
  const hist = mk('11010319900307001');                 // 崇文区：有效，但带一句动态 caveat
  const bad = good[17] === '9' ? `${good.slice(0, 17)}8` : `${good.slice(0, 17)}9`;
  assert.notEqual(bad, good, '夹具自证：这一条只改了校验位');
  const m = jMount();
  // 挂载期那一格是提示，不是空着
  assert.match(m.page.html('idcard', 'read'), /<p class="tk-hint">把号码粘进来/);
  assert.equal(m.page.copy('idcard', 'read').disabled, true);
  m.page.click('idcard', 'read');
  assert.match(m.page.html('idcard', 'read'), /粘贴框里还没有号码/);

  m.page.set('idcard', 'read', ['', good, '   ', hist, bad].join('\n'));
  m.page.click('idcard', 'read');
  const h = m.page.html('idcard', 'read');
  assert.equal(jCount(h, '<section class="tk-line">'), 3, '三条不空的行 = 三个结果块');
  assert.match(h, /第 2 行/, '行号要用原始行号：第 2 行就是第 2 行');
  assert.match(h, /第 4 行/);
  assert.match(h, /第 5 行/);
  assert.equal(h.includes('第 1 行'), false, '全空行不进表格');
  assert.equal(h.includes('第 3 行'), false, '只有一串空格的行也不进表格，但号还是要占');
  assert.equal(h.includes('第 6 行'), false, '粘贴框只有 5 行，别凭空多出一块');
  // 复制只交判定有效的那几条，顺序跟粘贴一致
  assert.equal(m.wb.copyTextOf('idcard', 'read'), [good, hist].join('\n'));
  assert.equal(m.page.copy('idcard', 'read').disabled, false);
  // 原样回显：连号都别给我改
  assert.match(h, new RegExp(`<span class="tk-line__raw">${hist}</span>`));
  // 1900–1999 出生的那一行同时给 15 位写法（骨架那句 help 文案说的就是这一格）
  assert.match(h, /15 位写法/);
  assert.equal(h.includes(`${hist.slice(0, 6)}${hist.slice(8, 14)}${hist.slice(14, 17)}`), true,
    '15 位写法 = 6 位区划 + 6 位年月日（去年世纪）+ 3 位顺序码');

  // Windows 粘贴带来的 \\r\\n 要归一，不许留下半个 \\r 把回显撑坏
  m.page.set('idcard', 'read', `${good}\r\n${bad}\r`);
  m.page.click('idcard', 'read');
  const cr = m.page.html('idcard', 'read');
  assert.equal(jCount(cr, '<section class="tk-line">'), 2);
  assert.equal(cr.includes('\r'), false, '行尾的回车没被吃掉');
  assert.match(cr, /第 2 行/);

  // 上限：粘 60 行只判前 50 行，多出来的行数在提示里报数，不进表格
  const pool = generateIdCards({ count: 50, today: TODAY, rng: seededRandom(J_SEED + 1) })
    .map((r) => r.id18);
  m.page.set('idcard', 'read', Array.from({ length: 60 }, (_, i) => pool[i % pool.length]).join('\n'));
  m.page.click('idcard', 'read');
  const big = m.page.html('idcard', 'read');
  assert.equal(jCount(big, '<section class="tk-line">'), MAX_READ_LINES, `只该判前 ${MAX_READ_LINES} 行`);
  assert.match(big, new RegExp(`这次粘进来 60 行，只判定前 ${MAX_READ_LINES} 行`));
  assert.equal(m.wb.copyTextOf('idcard', 'read').split('\n').length, MAX_READ_LINES);
  // 恰好 50 行时那句上限提示不许出现
  m.page.set('idcard', 'read', pool.join('\n'));
  m.page.click('idcard', 'read');
  assert.equal(m.page.html('idcard', 'read').includes('这次粘进来'), false, '没超上限就别报数');
  assert.equal(jCount(m.page.html('idcard', 'read'), '<section class="tk-line">'), 50);
});

test('J6 下拉按 spec 填充：常用行不包组、号段按运营商分五组、字符集只标默认那一个', () => {
  const m = jMount();
  const { page } = m;
  /**
   * 一条 `<select>` 填完之后的形状。分组与裸选项分开数：`fillGrouped` 里
   * `label === ''` 那一组必须直接长出 `<option>`，所以它会算进 `bare` 而不是 `groups`。
   * @param {string} panel 面板
   * @param {string} control 控件
   * @returns {object} `{ el, head, bare, groups, sizes, values, labels }`
   */
  const shape = (panel, control) => {
    const el = page.ctl(panel, control);
    const boxes = el.childNodes.filter((n) => n.tagName === 'OPTGROUP');
    const flat = [
      ...el.childNodes.filter((n) => n.tagName === 'OPTION'),
      ...boxes.flatMap((b) => b.childNodes),
    ];
    return {
      el,
      head: el.firstChild,
      bare: el.childNodes.length - boxes.length,
      groups: boxes.map((b) => b.getAttribute('label')),
      sizes: boxes.map((b) => b.childNodes.length),
      values: flat.map((o) => o.getAttribute('value')),
      labels: flat.map((o) => o.textContent),
    };
  };

  // ① 发卡行：常用那 20 行是裸选项（包进组会让读屏先念一句"选项 空"），其余 240 行才分组
  const bank = shape('bankcard', 'bank');
  assert.equal(bank.head.tagName, 'OPTION', '骨架那条占位项必须是第一个子节点');
  assert.equal(bank.head.getAttribute('value'), '', '占位项没有值，选中它等于没选');
  assert.equal(bank.bare, 1 + TOP_BANKS.length, '占位项 + 常用行那 20 条都不该被包进 <optgroup>');
  assert.deepEqual(bank.groups, ['其余行别（按行别码）']);
  assert.deepEqual(bank.sizes, [BANK_OPTIONS.length - TOP_BANKS.length]);
  assert.deepEqual(bank.labels.slice(1, 1 + TOP_BANKS.length),
    TOP_BANKS.map((b) => `${b.name}（${b.binCount} 条 BIN）`), '常用行要把 BIN 条数写在脸上');
  assert.equal(new Set(bank.values.slice(1)).size, BANK_OPTIONS.length, '260 个行别码不该有重复或遗漏');

  // ② 卡种四条、邮箱域三条、运营商五条：顺序跟着模块那张表走，测试不替它重排
  const ctype = shape('bankcard', 'type');
  assert.deepEqual(ctype.values, ['', ...Object.keys(CARD_TYPES)]);
  assert.deepEqual(ctype.labels.slice(1), Object.values(CARD_TYPES));
  const domain = shape('random', 'domain');
  assert.deepEqual(domain.values, ['', ...EMAIL_DOMAINS], '邮箱域这一格没有第二条路');
  const carrier = shape('mobile', 'carrier');
  assert.deepEqual(carrier.groups, [], '运营商这一格不该有 <optgroup>：五条并列');
  assert.deepEqual(carrier.labels.slice(1), CARRIERS.map((c) => `${c.carrier}（${c.count} 个号段）`),
    '括号里那个数就是 §F0 钉住的号段数，让用户先看见池子有多大');

  // ③ 号段按运营商分五组：成员数与 `CARRIERS` 的 count 逐格对上；平铺那份比对 §F 从号段表独立数出的 `LISTED`——与被测取数链不同源，才看得出装配层掉段
  const seg = shape('mobile', 'segment');
  assert.deepEqual(seg.groups, CARRIERS.map((c) => c.carrier));
  assert.deepEqual(seg.sizes, CARRIERS.map((c) => c.count));
  assert.deepEqual([...seg.values.slice(1)].sort(), [...LISTED].sort(), '56 段一段都不能少');
  assert.equal(seg.bare, 1, '号段格除了占位项，其余必须都在组里');

  // ④ 统一社会信用代码那两格：31 个字符挨条填上，「（默认）」只许出现在默认那个字符上
  for (const [control, dflt] of [['registry', '9'], ['category', '1']]) {
    const cs = shape('uscc', control);
    assert.deepEqual(cs.values, ['', ...USCC_CHARSET], '字符集表里没有的第二条路');
    const marked = cs.labels.filter((l) => l.includes('（默认）'));
    assert.deepEqual(marked, [`${dflt}（默认）`],
      `${control}：默认那一格要标出来，别的格子不能跟着标`);
  }

  // ⑤ spec 里没打标记的格子，装配层一条都不动：省份之外的文案是骨架自己的
  assert.equal(page.ctl('idcard', 'sex').childNodes.length, 1, 'sex 没有 options / cascade 标记，不该被重建');
  assert.equal(page.ctl('idcard', 'ageband').childNodes.length, 1);

  // ⑥ 同一格反复填充不叠加：清不干净旧选项就会越点越长，最后一份列表没人认识
  const city = page.ctl('idcard', 'city');
  const cityPh = city.firstChild;
  page.set('idcard', 'province', '32');
  page.change('idcard', 'province');
  const once = city.childNodes.length;
  page.change('idcard', 'province');
  page.change('idcard', 'province');
  assert.equal(city.childNodes.length, once, '换省三次之后市格还是那 13 条');
  assert.equal(city.firstChild, cityPh, '三次重建之后留在第一位的仍是骨架那条占位项');
});

test('J8 一块塌下去别块照旧：跨面板隔离，与数量格那两句话', () => {
  const m = jMount();
  const { page } = m;
  // 登记管理部门码填成字符集外的 `!`：模块抛 RangeError，闸门只塌这一块
  page.set('uscc', 'registry', '!');
  page.change('uscc', 'registry');
  page.click('uscc', 'gen');
  assert.deepEqual(page.ws.brokenIds(), ['uscc'], '只该有 uscc 这一块进 broken 名单');
  assert.match(page.ws.brokenOf('uscc'), /登记管理部门代码/);
  assert.match(page.ws.brokenOf('uscc'), /31 字符集内的单个字符/);
  assert.match(iBanner(page, 'uscc').textContent, /其余面板不受影响/);
  for (const id of PANEL_IDS) {
    if (id === 'uscc') continue;
    assert.equal(iBanner(page, id), null, `${id} 跟着隔壁一起塌了`);
  }
  // 别块该照旧生成：四块各点一次，一张表都不许少
  for (const id of ['idcard', 'bankcard', 'mobile', 'random']) {
    assert.equal(m.wb.run(id, 'gen'), true, `${id} 被隔壁的失败拖坏了`);
    assert.match(page.html(id, 'gen'), /共 5 条/);
  }
  // 塌掉那一块也不是绝症：改回合法字符再按一次，错误条自己撤
  page.set('uscc', 'registry', 'A');
  page.change('uscc', 'registry');
  page.click('uscc', 'gen');
  assert.deepEqual(page.ws.brokenIds(), []);
  assert.equal(iBanner(page, 'uscc'), null);
  for (const c of m.wb.copyTextOf('uscc', 'gen').split('\n')) {
    assert.equal(c[0], 'A', `${c}：改回去的登记管理部门码没落到代码上`);
  }

  // 数量格的两句话：空、和不是 1–50 的整数。都是提示行，一块面板都不许因此标坏
  for (const [raw, line] of [
    ['', `^<p class="tk-hint">数量这一格是空的，填 1–${GENERATE_MAX} 之间的整数`],
    ['999', `^<p class="tk-hint">数量应为 1–${GENERATE_MAX} 的整数，现在这格是「999」`],
    ['0', `^<p class="tk-hint">数量应为 1–${GENERATE_MAX} 的整数，现在这格是「0」`],
    ['2.5', `^<p class="tk-hint">数量应为 1–${GENERATE_MAX} 的整数，现在这格是「2.5」`],
  ]) {
    page.set('idcard', 'count', raw);
    page.click('idcard', 'gen');
    const h = page.html('idcard', 'gen');
    assert.match(h, new RegExp(line), `「${raw}」这一档的文案对不上`);
    assert.equal(h.includes('tk-count'), false, `「${raw}」一条都没生成，别报"共 N 条"`);
    assert.deepEqual(page.ws.brokenIds(), [], `「${raw}」是用户填错了，不是这块面板坏了`);
    assert.equal(page.copy('idcard', 'gen').disabled, true);
  }
  page.set('idcard', 'count', '3');
  page.click('idcard', 'gen');
  assert.match(page.html('idcard', 'gen'), /共 3 条/);

  // 位数那一格同一档：越界要说清是哪一格、范围是多少，不许静默当成"没填"（那一档等于
  // 把用户明确填的 20 变成"按行别登记位数随机"，屏幕上还一切正常）。走的是 `intOf` 同一条路。
  for (const [raw, line] of [
    ['20', `位数应为 ${PAN_MIN}–${PAN_MAX} 的整数，现在这格是「20」`],
    ['12', `位数应为 ${PAN_MIN}–${PAN_MAX} 的整数，现在这格是「12」`],
    ['13.5', `位数应为 ${PAN_MIN}–${PAN_MAX} 的整数，现在这格是「13.5」`],
  ]) {
    page.set('bankcard', 'length', raw);
    page.click('bankcard', 'gen');
    const h = page.html('bankcard', 'gen');
    assert.match(h, new RegExp(`^<p class="tk-hint">${line}。`), `位数「${raw}」这一档的文案对不上`);
    assert.equal(h.includes('tk-count'), false, `位数「${raw}」一条都没生成，别报"共 N 条"`);
    assert.deepEqual(page.ws.brokenIds(), [], `位数「${raw}」是用户填错了，不是这块面板坏了`);
    assert.equal(page.copy('bankcard', 'gen').disabled, true);
  }
  // 清空即回到"按行别登记位数"：这句话管的是越界，不是"填了就不许改回去"
  page.set('bankcard', 'length', '');
  page.click('bankcard', 'gen');
  assert.match(page.html('bankcard', 'gen'), /共 5 条/, '清掉位数之后这块面板该照常出表');
});

test('J9 派生 id 的五种形状与那份清单的自洽（骨架与 Task 9 的账都靠它）', () => {
  // 形状逐条钉死：`tools-idcard.html`（仓库根，permalink 才是 `/tools/idcard.html`）里的
  // id 必须长成这五个样子之一
  assert.equal(fieldId('tk', 'idcard', 'birth'), 'tk-in-idcard-birth');
  assert.equal(buttonId('tk', 'idcard', 'gen'), 'tk-btn-idcard-gen');
  assert.equal(copyId('tk', 'uscc', 'read'), 'tk-copy-uscc-read');
  assert.equal(outId('tk', 'mobile', 'gen'), 'tk-out-mobile-gen');
  assert.equal(whenId('tk', 'random', 'addr'), 'tk-when-random-addr');

  const c = controlIds('tk');
  assert.deepEqual(PANEL_IDS, Object.keys(WORKBENCH_SPEC), '面板清单与 spec 的键不是同一份');
  assert.deepEqual(PANEL_IDS, ['idcard', 'uscc', 'bankcard', 'mobile', 'random'],
    '面板顺序就是索引条顺序，改了要连带改骨架与 yml');

  // 五份清单合起来不许有重复 id：真 DOM 里同名两个节点，`getElementById` 只认第一个
  const all = [...c.in, ...c.btn, ...c.copy, ...c.out, ...c.when];
  assert.equal(new Set(all).size, all.length, '派生 id 撞车了');
  assert.equal(all.every((id) => id.startsWith('tk-')), true, '每条 id 都得带前缀');
  // 按钮 / 复制 / 结果区三张一一对应：`random` 没有判定侧，所以是 5 + 4 = 9 而不是 10
  assert.deepEqual([c.btn.length, c.copy.length, c.out.length], [9, 9, 9]);
  const withRead = PANEL_IDS.filter((id) => WORKBENCH_SPEC[id].sides.read !== null);
  assert.equal(c.btn.length, PANEL_IDS.length + withRead.length);
  assert.deepEqual(c.when, [
    'tk-when-idcard-birth', 'tk-when-random-givelen', 'tk-when-random-addr', 'tk-when-random-domain',
  ], '受开关控制的字段组只有这四格');
  // 读侧上限与生成侧上限同档（口径 4 的那句话），且四块面板各有且只有一条粘贴框
  assert.equal(MAX_READ_LINES, GENERATE_MAX, '读侧与生成侧不该各长一个上限');
  assert.equal(withRead.length, 4);
  assert.equal(c.in.filter((id) => /-read$/.test(id)).length, 4);

  // 夹具自证（口径 3 的代价清单）：清单里每一条 id 在骨架上都得有节点
  const page = jPage();
  for (const id of all) assert.ok(page.doc.getElementById(id), `清单说有 ${id}，骨架上却没有`);
});

test('J10 换前缀是整套换：行为一位不改，旧前缀一个节点都不留', () => {
  const jt = jMount({ prefix: 'jt' });
  assert.deepEqual(jt.report.broken, [], '换了前缀就不该有面板挂不上');
  assert.deepEqual(jt.report.missing, []);
  // 清单跟着换：`controlIds('jt')` 的每一条都在骨架上，且逐条等于 tk 那套换个前缀
  const a = controlIds('jt');
  const b = controlIds('tk');
  for (const group of Object.keys(a)) {
    assert.deepEqual(a[group], b[group].map((id) => `jt-${id.slice(3)}`), `${group} 这一份没跟着换`);
    for (const id of a[group]) assert.ok(jt.page.doc.getElementById(id), `缺 ${id}`);
  }
  // 旧前缀不残留：节点表里一条 `tk-` 开头的 id 都不许有（面板框架与装配层共用同一只前缀）
  assert.deepEqual([...jt.page.nodes.keys()].filter((id) => id.startsWith('tk-')), []);
  // 前缀只是地址，不是行为输入：同一颗随机源下两套前缀生出的号码必须一模一样
  const tk = jMount({ prefix: 'tk' });
  for (const id of PANEL_IDS) {
    assert.equal(jt.wb.copyTextOf(id, 'gen'), tk.wb.copyTextOf(id, 'gen'), `${id} 换了前缀就换了内容`);
  }
  jt.page.click('bankcard', 'read');
  assert.match(jt.page.html('bankcard', 'read'), /<p class="tk-hint">粘贴框里还没有号码/,
    '提示行的类名是样式钩子，不跟着前缀换（`toolkit.scss` 只有一份）');
});

test('J11 事件接线：Enter 接在数字与日期上，判定走组合键，裸 Enter 还是换行', () => {
  const m = jMount();
  const { page } = m;
  let pd = 0;
  const ev = (key, extra = {}) => ({ key, preventDefault: () => { pd += 1; }, ...extra });

  // ① 数量格里的裸 Enter = 按一次生成按钮：走的是同一条闸门、同一个回调
  page.set('idcard', 'count', '2');
  const before = m.guarded.length;
  page.keyOn('idcard', 'count', ev('Enter'));
  assert.equal(m.guarded.length, before + 1, '一次按键只该走一次闸门，监听器不许叠加');
  assert.equal(m.guarded[m.guarded.length - 1], 'idcard');
  assert.match(page.html('idcard', 'gen'), /共 2 条/, 'Enter 之后画的就是刚改的那个数量');
  assert.equal(pd, 1, '默认行为（提交表单 / 换行）要被挡住');

  // ② 带任何修饰键的 Enter 都不算"我要生成"
  for (const mod of ['shiftKey', 'ctrlKey', 'altKey', 'metaKey']) {
    const n = m.guarded.length;
    page.keyOn('idcard', 'count', ev('Enter', { [mod]: true }));
    assert.equal(m.guarded.length, n, `${mod} + Enter 不该触发生成`);
  }
  assert.equal(pd, 1, '不触发就不该顺手 preventDefault');
  // 别的键也不算
  const n1 = m.guarded.length;
  page.keyOn('idcard', 'count', ev('a'));
  assert.equal(m.guarded.length, n1);

  // ③ 日期格同档：填完日期直接回车就该出结果
  page.set('idcard', 'ageband', 'custom');
  page.change('idcard', 'ageband');
  page.set('idcard', 'birth', '1990-05-06');
  page.keyOn('idcard', 'birth', ev('Enter'));
  assert.match(page.html('idcard', 'gen'), /共 2 条/);
  for (const id of m.wb.copyTextOf('idcard', 'gen').split('\n')) {
    assert.equal(id.slice(6, 14), '19900506', '日期格里按回车，日期得真的落进号码');
  }
  // ④ 下拉里的 Enter 没有"提交"语义：焦点停在省格回车，不许变成"点了一次生成"
  const n2 = m.guarded.length;
  const pdBefore = pd;
  page.keyOn('idcard', 'province', ev('Enter'));
  page.keyOn('random', 'kind', ev('Enter'));
  assert.equal(m.guarded.length, n2, '级联下拉里回车就是回车');
  assert.equal(pd, pdBefore, '不触发的按键不该顺手把默认行为挡掉');

  // ⑤ 粘贴框：Ctrl / ⌘ + Enter 判定，裸 Enter 留给换行
  page.set('idcard', 'read', mk('11010119900307001'));
  const n3 = m.guarded.length;
  page.keyOn('idcard', 'read', ev('Enter'));
  assert.equal(m.guarded.length, n3, '裸 Enter 在多行框里必须是换行');
  assert.equal(pd, pdBefore, '多行框里的裸回车要留给换行，挡它就是缺陷');
  page.keyOn('idcard', 'read', ev('Enter', { ctrlKey: true }));
  assert.equal(m.guarded.length, n3 + 1);
  assert.equal(m.guarded[m.guarded.length - 1], 'idcard');
  // 挡住了默认动作才算这一次按键"是命令不是换行"：不 preventDefault，多行框里会同时
  // 插入一个换行符（用户每按一次判定，输入内容就多一行空白）
  assert.equal(pd, pdBefore + 1, 'Ctrl + Enter 触发了判定，就得把默认动作（换行）挡掉');
  assert.match(page.html('idcard', 'read'), /第 1 行/);
  page.keyOn('idcard', 'read', ev('Enter', { metaKey: true }));
  assert.equal(m.guarded.length, n3 + 2, 'macOS 的 ⌘ + Enter 同档');
  assert.equal(pd, pdBefore + 2, '⌘ + Enter 同一条路，也别漏 preventDefault');

  // ⑥ `change` 上挂的是级联 + 开关那两件事；uscc 没有县格，重建下游时对不存在的格子静默
  assert.doesNotThrow(() => { page.set('uscc', 'province', '32'); page.change('uscc', 'province'); });
  assert.equal(page.ctl('uscc', 'city').childNodes.length, 1 + currentCityCodes('32').length);
  assert.equal(page.ctl('uscc', 'county'), null, '夹具自证：uscc 的 spec 里本来就没有县格');
  // ⑦ 主按钮与复制按钮各就各位：点判定按钮走的是与 Enter 同一条路
  const n4 = m.guarded.length;
  page.click('uscc', 'gen');
  assert.equal(m.guarded.length, n4 + 1);
  assert.equal(m.guarded[m.guarded.length - 1], 'uscc');
  assert.equal(page.ctl('random', 'domain').disabled, false, '没打标记的格子不该被级联禁用');
});

test('J12 toolkitCore 只把框架层那三只挂成 `window.Tk`，业务模块不下沉', async () => {
  const mod = { ns: null };
  globalThis.window = {};
  try {
    mod.ns = await import('../dev/js/toolkitCore.js?j12');
    const tk = globalThis.window.Tk;
    assert.deepEqual(Object.keys(tk).sort(), ['createPanelDom', 'createPanelWorkspace', 'view'],
      '口径 1：只挂这三个名字，不顺手暴露别的');
    assert.equal(tk.createPanelWorkspace, createPanelWorkspace, '挂的必须是 §D 判过的那一只');
    assert.equal(tk.createPanelDom, createPanelDom, '挂的必须是 §I 判过的那一只');
    assert.equal(tk.view.batchBlock, J_VIEW.batchBlock, 'view 必须是 §H 判过的那一份');
    assert.equal(typeof tk.view.parseBlock, 'function');
    assert.equal('parseIdCard' in tk, false, '口径 3：业务模块走 workbench 内联，不下到共用层');
    assert.equal('generateUsccCodes' in tk, false);
    assert.equal(tk.version, undefined, '不加版本号：将来扩面是显式改动');
    // 顶层不 export：产物被 `(function(){…})();` 包住，函数体里的 export 是语法错误
    assert.deepEqual(Object.keys(mod.ns), [], 'toolkitCore 一条 export 都不许有');
  } finally {
    delete globalThis.window;
  }
});

test('J13 骨架缺一格：缺结果区与缺 tab 标坏这一块，缺复制按钮不该牵连内容', () => {
  // ① 缺结果区：这块面板没法交付内容，标坏，且只标坏这一块
  const a = jMount({ drop: ['tk-out-uscc-gen'] });
  assert.deepEqual(a.report.broken, ['uscc']);
  assert.deepEqual(a.report.missing, [], 'tab 与 panel 两半都在，不算骨架不完整');
  assert.deepEqual(a.report.rendered, PANEL_IDS.filter((id) => id !== 'uscc'));
  assert.equal(a.page.html('uscc', 'gen'), '', '没有地方放内容，就不该凭空生成一份');
  assert.match(a.page.ws.brokenOf('uscc'), /tk-out-uscc-gen/);
  assert.match(iBanner(a.page, 'uscc').textContent, /其余面板不受影响/);
  for (const id of PANEL_IDS) {
    if (id === 'uscc') continue;
    assert.match(a.page.html(id, 'gen'), /共 5 条/, `${id} 被隔壁缺的一格拖坏了`);
  }
  // 一崩崩的是**一块面板**而不是一栏：一块面板只有一个渲染函数，先画生成侧，
  // 所以生成侧画不出来时判定侧那句提示也跟着没画。反过来缺判定侧的结果区，
  // 生成侧那张表已经画上——塌的范围就是渲染函数的执行顺序，本节把它如实钉下来。
  assert.equal(a.page.html('uscc', 'read'), '', '渲染函数在生成侧就抛了，判定侧没轮到画');
  const a2 = jMount({ drop: ['tk-out-uscc-read'] });
  assert.deepEqual(a2.report.broken, ['uscc']);
  assert.match(a2.page.html('uscc', 'gen'), /共 5 条/, '抛错之前画好的生成侧不许被拖没');
  assert.equal(a2.page.html('uscc', 'read'), '');
  assert.match(a2.page.ws.brokenOf('uscc'), /tk-out-uscc-read/);

  // ② 缺 tab：这一块切不到，渲染函数干脆不跑（凭空画一份只是把缺陷藏起来）
  const b = jMount({ drop: ['tk-tab-idcard'] });
  assert.deepEqual(b.report.missing, ['idcard']);
  assert.deepEqual(b.report.broken, ['idcard']);
  assert.deepEqual(b.report.rendered, PANEL_IDS.filter((id) => id !== 'idcard'));
  assert.equal(b.page.html('idcard', 'gen'), '');
  assert.equal(b.page.copy('idcard', 'gen').disabled, true, '没渲染过，复制按钮该停在骨架的禁用态');
  // 它仍然是"当前那一块"（hash 空 → 第一块），只是没有内容可看——错误条就是用户唯一看得见的说明。
  assert.deepEqual(iVisible(b.page), ['idcard']);
  assert.match(iBanner(b.page, 'idcard').textContent, /tk-tab-idcard/);
  // 互锁对它照样生效：切走之后它的 `hidden` 被人覆写了，不会留下一块永远显示的面板
  b.page.tab('mobile').dispatch('click', {});
  assert.deepEqual(iVisible(b.page), ['mobile'], '缺 tab 那块还赖在可见位上');
  for (const id of ['uscc', 'bankcard', 'random']) {
    assert.match(b.page.html(id, 'gen'), /共 5 条/);
  }

  // ③ 缺复制按钮：内容照样能看，不该因此把面板判坏（`syncCopy` 找不到按钮就静默返回）
  const c = jMount({ drop: ['tk-copy-idcard-gen'] });
  assert.deepEqual(c.report.broken, [], '复制按钮缺失不影响这一块的交付');
  assert.equal(c.page.copy('idcard', 'gen'), null);
  assert.match(c.page.html('idcard', 'gen'), /共 5 条/);
  assert.doesNotThrow(() => c.page.click('idcard', 'gen'), '再点一次生成也不该因为没按钮而抛');
  assert.equal(c.wb.copyTextOf('idcard', 'gen').split('\n').length, 5, '复制文本照旧备着，别人接上去就能用');

  // ④ 开关的目标段没了（骨架漏写一格 `tk-when-*`）：少一段显隐，不该把整块面板送进 broken
  const d = jMount({ drop: ['tk-when-idcard-birth'] });
  assert.deepEqual(d.report.broken, [], '缺的是包着日期格的那段 <p>，不是交付内容的地方');
  assert.equal(d.page.whenNode('idcard', 'birth'), null, '夹具自证：这一格本来就没建');
  assert.doesNotThrow(() => {
    d.page.set('idcard', 'ageband', 'custom');
    d.page.change('idcard', 'ageband');
  }, 'applySwitch 撞上缺节点就抛，用户切档时这块面板当场进 broken 名单');
  // 日期格还在，值照样进号码：显隐少一段 ≠ 这一格不能填
  d.page.set('idcard', 'birth', '1990-05-06');
  d.page.click('idcard', 'gen');
  assert.match(d.page.html('idcard', 'gen'), /共 5 条/);
  for (const id of d.wb.copyTextOf('idcard', 'gen').split('\n')) {
    assert.equal(id.slice(6, 14), '19900506', '缺一段显隐容器，不该牵连生成');
  }
  assert.deepEqual(d.page.ws.brokenIds(), [], '按过一次生成也不该因此标坏');
  // 别块的开关照旧生效：`#random-kind` 换档，三段该现的现、该藏的藏
  d.page.set('random', 'kind', 'address');
  d.page.change('random', 'kind');
  assert.equal(d.page.whenNode('random', 'addr').hidden, false);
  assert.equal(d.page.whenNode('random', 'givelen').hidden, true);
  assert.equal(d.page.whenNode('random', 'domain').hidden, true);
});

test('J14 动态文本一律过 `esc`，源码里那三条红线一条都不许断', () => {
  const m = jMount();
  const { page } = m;
  // ① 粘贴框把原样字符回显出来：那里头可能是任何文本，不许被当成 HTML 解析
  const evil = '<img src=x onerror=alert(1)>';
  page.set('idcard', 'read', [evil, mk('11010119900307001')].join('\n'));
  page.click('idcard', 'read');
  const h = page.html('idcard', 'read');
  assert.equal(h.includes('<img'), false, '原样回显漏了转义，粘进来的一行就能挂脚本');
  assert.equal(h.includes('&lt;img src=x onerror=alert(1)&gt;'), true, '要转义，但也要看得见原样');
  assert.match(h, /第 1 行/);

  // ② 提示行会把用户填的那一格原样带进句子里，那一句同样只许是文本
  page.set('idcard', 'count', '<script>alert(1)</script>');
  page.click('idcard', 'gen');
  const hint = page.html('idcard', 'gen');
  assert.equal(hint.includes('<script'), false, 'FieldError 的 message 拼进结果区前必须过 esc');
  assert.match(hint, /^<p class="tk-hint">数量应为 1–\d+ 的整数，现在这格是「&lt;script&gt;alert\(1\)&lt;\/script&gt;」。/);

  // ③ 三条源码红线：这一层的 HTML 出口只有一处，找节点只按派生 id，跨页共用的三本不许 import
  const src = read('dev/js/tools/workbench.js');
  assert.equal(jCount(src, '.innerHTML ='), 1, 'innerHTML 只许出现在 paint() 一处');
  assert.equal(src.includes('querySelector('), false, '控件一律按派生 id 找：querySelector 会绕过前缀与 spec 这套账');
  for (const shared of ['./panel.js', './panel-dom.js', './view.js']) {
    assert.equal(src.includes(`from '${shared}'`), false,
      `workbench.js 不许 import ${shared}：两个入口 reach 同一模块就成共享 chunk，产物当场变废文件`);
  }
  // 两个入口文件都不许有顶层 export：它们各自是独立产物，却被同一个 IIFE 包法包住
  for (const f of ['dev/js/toolkitCore.js', 'dev/js/toolIdcard.js']) {
    assert.equal(/^export /m.test(read(f)), false, `${f} 是入口，顶层 export 在产物里是语法错误`);
  }
  // 产物里真不许有 `import{`：判据在 Task 9 对账构建产物，这里先钉住"入口只有这两个"
  assert.equal(/^export /m.test(src), true, 'workbench.js 不是入口：它必须还能被入口 import');
});

test('J15 整栏通用的那几句口径：栏尾说一次，逐行的结论留在行里', () => {
  const m = jMount();
  const { page } = m;
  const last = (h) => h.lastIndexOf('</section>');

  // ① 银行卡：常量 caveat 摘到栏尾一次，五十行也不该五十遍
  const cards = generateBankCards({ count: 3, rng: seededRandom(J_SEED + 2) }).map((r) => r.number);
  page.set('bankcard', 'read', [...cards, '1234'].join('\n'));
  page.click('bankcard', 'read');
  let h = page.html('bankcard', 'read');
  assert.equal(jCount(h, BANK_CAVEAT), 1, '同一句话每行说一遍，等于没说');
  assert.ok(last(h) < h.indexOf(BANK_CAVEAT), '整栏口径要排在逐行结果之后');
  assert.equal(jCount(h, '<section class="tk-line">'), 4);

  // ② 手机号：caveat 与 note 两条各一次，且都在最后一行之后
  const nums = generateMobiles({ count: 2, rng: seededRandom(J_SEED + 3) }).map((r) => r.number);
  page.set('mobile', 'read', [...nums, '10000000000'].join('\n'));
  page.click('mobile', 'read');
  h = page.html('mobile', 'read');
  assert.equal(jCount(h, MOBILE_CAVEAT), 1);
  assert.equal(jCount(h, CARRIER_NOTE), 1);
  assert.ok(last(h) < h.indexOf(MOBILE_CAVEAT));
  assert.ok(last(h) < h.indexOf(CARRIER_NOTE));

  // ③ 身份证的 caveat 随号码而变，摘错了就是把结论从号码旁边搬走：它必须留在自己那一行里
  const good = mk('11010119900307001');
  const hist = mk('11010319900307001');
  page.set('idcard', 'read', [good, hist].join('\n'));
  page.click('idcard', 'read');
  h = page.html('idcard', 'read');
  const dyn = '该区划未见于现行区划表';
  assert.equal(jCount(h, dyn), 1, '动态 caveat 只该出现在它那一行');
  assert.ok(h.indexOf(dyn) < last(h), '动态 caveat 留在行内，不许被提到栏尾');
  assert.ok(h.indexOf(dyn) > h.indexOf('第 2 行'), '而且要贴着它所属的那一行，不是贴到第 1 行去');
  assert.equal(h.includes(USE_NOTE), false, '身份证读侧不补整栏句：它的 caveat 随号码而变，没有可上墙的那一句');

  // ④ 信用代码：转大写那句是动态的留在行内，`REFERENCE_NOTE` 是整栏的排在栏尾
  const code = generateUsccCodes({ count: 1, rng: seededRandom(J_SEED + 4) })[0].code;
  page.set('uscc', 'read', [code.toLowerCase(), 'x'].join('\n'));
  page.click('uscc', 'read');
  h = page.html('uscc', 'read');
  assert.equal(jCount(h, '已按 31 字符集转大写后判定'), 1);
  assert.ok(h.indexOf('已按 31 字符集转大写后判定') < last(h), '这句是关于第 1 行的，不能上墙');
  assert.equal(jCount(h, REFERENCE_NOTE), 1);
  assert.ok(last(h) < h.indexOf(REFERENCE_NOTE));

  // ⑤ 生成侧：每栏的口径行各一次，不因为表里有五行就重复五遍
  const gen = {
    idcard: [USE_NOTE], uscc: [USCC_USE_NOTE], bankcard: [BANK_CAVEAT],
    mobile: [MOBILE_CAVEAT, CARRIER_NOTE], random: [RANDOM_CAVEAT, NAME_NOTE],
  };
  for (const [panel, notes] of Object.entries(gen)) {
    const g = page.html(panel, 'gen');
    for (const note of notes) assert.equal(jCount(g, note), 1, `${panel} 生成侧的口径句重复了`);
  }
});

test('J16 入口只读骨架那四格数据；启动失败不装死，成功路径把两条 <script> 接起来', async () => {
  /**
   * 入口文件在 import 的那一刻就 `start(document, window)`，所以每一档都得：
   * 先把 `globalThis.document` / `globalThis.window` 摆好，再换一个 **查询串** 去 import
   * （同一 URL 只执行一次），最后把两个全局摘干净。`toolkitCore.js` 与入口用同一个查询串，
   * 于是真核心把 `Tk` 挂到我给的 window 上，入口再从我给的 document 里找节点。
   */
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
  const withCore = (tag) => import(`../dev/js/toolkitCore.js?j16-${tag}`);

  // ── 成功：两条 script 的先后接对了，页面就是它该有的样子 ──
  {
    const page = jPage();
    page.mk('div', 'tk-workspace', {
      'data-tk-ids': PANEL_IDS.join(', '), 'data-tk-prefix': 'tk',
      'data-tk-label': '证件与常用信息', 'data-tk-notice': 'tk-notice',
    });
    await run('ok', page, async (tag) => {
      await withCore(tag);
      await import(`../dev/js/toolIdcard.js?j16-${tag}`);
      for (const id of PANEL_IDS) {
        assert.equal(page.tab(id).getAttribute('role'), 'tab', `${id} 没被升级成 tab`);
      }
      assert.match(page.html('idcard', 'gen'), /共 5 条/, '骨架的 count=5 该在挂载期就画上');
      assert.equal(page.copy('idcard', 'gen').disabled, false);
      assert.equal(page.notice.hidden, true, '启动成功就别留提示行');
      // 口径 2 的晚绑：按钮回调拿到的是 `createPanelDom().run` 而不是那只占位函数
      page.set('idcard', 'count', '2');
      page.btn('idcard', 'gen').dispatch('click', {});
      assert.match(page.html('idcard', 'gen'), /共 2 条/, '按了没反应＝占位函数还在位上');
      // hashchange 接在 window 上：地址栏换面板，入口这一层负责把两边接起来
      page.location.hash = '#mobile';
      page.win.dispatch('hashchange', {});
      assert.deepEqual(iVisible(page), ['mobile']);
      assert.equal(page.tab('mobile').getAttribute('aria-selected'), 'true');
    });
  }

  // ── 失败一档：容器都没有（脚本被挪进 <head> 就是这个形状）──
  {
    const page = jPage();
    await run('nocontainer', page, async (tag) => {
      await withCore(tag);
      await assert.rejects(() => import(`../dev/js/toolIdcard.js?j16-${tag}`), /tk-workspace/);
      assert.equal(page.notice.hidden, false, '启动失败必须留下一句能抄下来问人的话');
      assert.match(page.notice.textContent, /这一页的交互层没能启动/);
      assert.match(page.notice.textContent, /tk-workspace/);
      assert.match(page.notice.textContent, /正文仍然读得到/);
    });
  }

  // ── 失败二档：容器在，`data-tk-ids` 是空的（yml 漏了 slug）──
  {
    const page = jPage();
    page.mk('div', 'tk-workspace', { 'data-tk-ids': ' , ', 'data-tk-prefix': 'tk' });
    await run('emptyids', page, async (tag) => {
      await withCore(tag);
      await assert.rejects(() => import(`../dev/js/toolIdcard.js?j16-${tag}`), /data-tk-ids/);
      assert.match(page.notice.textContent, /onlineTools\.yml/);
    });
  }

  // ── 失败三档：`window.Tk` 没挂上来（core 404 或排在入口之后）──
  {
    const page = jPage();
    page.mk('div', 'tk-workspace', { 'data-tk-ids': PANEL_IDS.join(','), 'data-tk-prefix': 'tk' });
    await run('notk', page, async (tag) => {
      await assert.rejects(() => import(`../dev/js/toolIdcard.js?j16-${tag}`), /window\.Tk/);
      assert.match(page.notice.textContent, /toolkitCore\.min\.js/);
      // 这一档最像"禁了脚本"：正文与骨架节点一个不少，只是没人接线
      assert.equal(page.tab('idcard').getAttribute('role'), 'link', '框架层没跑，骨架的 role 原样留着');
      assert.equal(page.html('idcard', 'gen'), '');
    });
  }

  // ── 换前缀：骨架写 `data-tk-prefix: zx`，行为那副面孔就得整套跟着换（容器 id 仍归本页自己）──
  //     这一档盯的是"页面地址"与"行为前缀"分家这件事（口径 1）：写死 `tk` 的入口在证件页
  //     看起来一切正常，拿到 JSON 页（`jt`）就是一整页找不到节点。
  {
    const page = jPage({ prefix: 'zx' });
    page.mk('div', 'tk-workspace', {
      'data-tk-ids': PANEL_IDS.join(','), 'data-tk-prefix': 'zx', 'data-tk-notice': 'zx-notice',
    });
    await run('zx', page, async (tag) => {
      await withCore(tag);
      await import(`../dev/js/toolIdcard.js?j16-${tag}`);
      for (const id of PANEL_IDS) {
        assert.equal(page.tab(id).getAttribute('role'), 'tab',
          `${id} 没被升级成 tab：绑定层找的是 tk-tab-*，骨架写的是 zx-tab-*`);
      }
      assert.match(page.html('idcard', 'gen'), /共 5 条/, 'zx 前缀下找不到结果区，等于什么都没画');
      assert.equal(page.copy('idcard', 'gen').disabled, false);
      page.set('idcard', 'count', '2');
      page.btn('idcard', 'gen').dispatch('click', {});
      assert.match(page.html('idcard', 'gen'), /共 2 条/);
      assert.equal(page.notice.hidden, true, '这一档是成功路径，不该留提示行');
    });
  }

  // ── 容器在，但它读不到属性：要报"哪一格、往哪儿查"，不能把裸 TypeError 丢出去 ──
  //     `start()` 的兜底写的就是这一格，所以这一档同时判"失败的那句话仍然落在页面上"。
  {
    const page = jPage();
    const box = page.mk('div', 'tk-workspace', { 'data-tk-ids': PANEL_IDS.join(',') });
    delete box.getAttribute;
    await run('noattr', page, async (tag) => {
      await withCore(tag);
      await assert.rejects(() => import(`../dev/js/toolIdcard.js?j16-${tag}`), /tk-workspace/,
        'TypeError 里既没有容器 id 也没有排查方向，抄下来问不到人');
      assert.match(page.notice.textContent, /两条 <script>/,
        '这一档最像"脚本顺序错了"，那句话就得指向脚本顺序');
    });
  }
});

test('J7 复制三级兜底：clipboard → 临时 textarea + execCommand → 一句"请手动选中"', async () => {
  /**
   * 兜底造出来的那些临时框：骨架里 4 条粘贴框是 `<textarea>` 但没有 `readonly`，
   * `legacyCopy` 那一条有——用属性把它们分开数，不靠"造了几个节点"猜。
   * @param {object} page 夹具
   * @returns {object[]} 临时框清单
   */
  const boxes = (page) => page.made.filter((e) => e.tagName === 'TEXTAREA'
    && e.getAttribute('readonly') === 'readonly');

  // ── (a) 首选 `navigator.clipboard`：不碰 execCommand，也不往 body 上挂东西 ──
  {
    const writes = [];
    const m = jMount({ clipboard: { writeText: (t) => { writes.push(t); return Promise.resolve(); } } });
    m.page.clickCopy('idcard', 'gen');
    await jSettle();
    assert.deepEqual(writes, [m.wb.copyTextOf('idcard', 'gen')], '复制的内容是这一栏那份纯文本，不是 HTML');
    assert.equal(jLabel(m.page, 'idcard', 'gen'), '已复制');
    assert.equal(m.timers.length, 1, '改口要能改回来，就得留下一条恢复用的定时器');
    assert.equal(m.timers[0].ms, 1600);
    assert.deepEqual(m.page.commandLog, [], '这一级根本不需要 execCommand');
    assert.equal(m.page.doc.body.childNodes.length, 0, '走剪贴板就不该在页面上长出临时输入框');
    m.flush();
    assert.equal(jLabel(m.page, 'idcard', 'gen'), '复制这批号码', '改回的是骨架里那句原文案');
  }

  // ── (b) 剪贴板被拒 → 退到临时 textarea + execCommand，用完立刻摘掉 ──
  {
    const writes = [];
    const m = jMount({ clipboard: { writeText: (t) => { writes.push(t); return Promise.reject(new Error('NotAllowedError')); } } });
    m.page.clickCopy('uscc', 'gen');
    await jSettle();
    assert.equal(writes.length, 1, '先试过剪贴板，退路才是 execCommand');
    assert.deepEqual(m.page.commandLog, ['copy']);
    assert.equal(m.page.selLog.length, 1, '复制之前要把临时框选中');
    assert.equal(m.page.selLog[0].value, m.wb.copyTextOf('uscc', 'gen'));
    assert.equal(m.page.selLog[0].tagName, 'TEXTAREA');
    assert.equal(boxes(m.page).length, 1, '兜底只该造一条临时框');
    assert.equal(boxes(m.page)[0], m.page.selLog[0], '选中、复制、摘掉的是同一条临时框');
    assert.equal(m.page.doc.body.childNodes.length, 0, '用完必须从 body 上摘掉：留在页里就是一个能被 Tab 走到的隐形输入框');
    assert.equal(jLabel(m.page, 'uscc', 'gen'), '已复制', '兜底成功了就别报失败');
  }

  // ── (c) 没有 clipboard（http 页面）→ 直接走兜底 ──
  {
    const m = jMount();
    m.page.clickCopy('bankcard', 'gen');
    assert.deepEqual(m.page.commandLog, ['copy'], '没有 navigator.clipboard 时不该什么都不做');
    assert.equal(jLabel(m.page, 'bankcard', 'gen'), '已复制');
  }

  // ── (d) 兜底也说"不行"：一句失败文案，恢复时长比成功那句长 ──
  {
    const m = jMount();
    m.page.doc.copyOk = false;
    m.page.clickCopy('mobile', 'gen');
    assert.equal(jLabel(m.page, 'mobile', 'gen'), '复制失败，请手动选中');
    assert.equal(m.timers[0].ms, 2600, '失败那句要给人时间读完');
    assert.equal(m.timers[0].ms > 1600, true);
    m.flush();
    assert.equal(jLabel(m.page, 'mobile', 'gen'), '复制这批号码');
    assert.equal(m.page.doc.body.childNodes.length, 0, '连失败都不许留下临时框');
  }

  // ── (e) 兜底自己抛错（`execCommand` 在个别浏览器里会抛）：不塌页面，也不留节点 ──
  {
    const m = jMount();
    m.page.doc.execCommand = () => { throw new Error('boom'); };
    assert.doesNotThrow(() => m.page.clickCopy('idcard', 'gen'),
      '任何一级抛到页面外面，用户看到的就是"按了没反应"');
    assert.equal(jLabel(m.page, 'idcard', 'gen'), '复制失败，请手动选中');
    assert.equal(m.page.doc.body.childNodes.length, 0, '抛错那条路也要摘掉临时框');
    assert.equal(boxes(m.page).length, 1);
  }

  // ── (f) `writeText` 同步抛错与异步拒绝同一条路 ──
  {
    const m = jMount({ clipboard: { writeText: () => { throw new Error('SecurityError'); } } });
    assert.doesNotThrow(() => m.page.clickCopy('random', 'gen'));
    await jSettle();
    assert.deepEqual(m.page.commandLog, ['copy'], '同步抛错也要退到 execCommand');
    assert.equal(jLabel(m.page, 'random', 'gen'), '已复制');
  }

  // ── (g) 没内容就别动剪贴板：可用与否由那份纯文本说话，不由 disabled 猜 ──
  {
    const writes = [];
    const m = jMount({ clipboard: { writeText: (t) => { writes.push(t); return Promise.resolve(); } } });
    assert.equal(m.page.copy('idcard', 'read').disabled, true, '判定栏还没内容，按钮是禁用的');
    m.page.clickCopy('idcard', 'read');
    await jSettle();
    assert.deepEqual(writes, [], '空文本一次都不该写');
    assert.deepEqual(m.page.commandLog, []);
    assert.equal(m.timers.length, 0, '什么都没复制，就别改口');
    assert.equal(jLabel(m.page, 'idcard', 'read'), '复制判定有效的号码');
    // 粘进去判一次，这一栏的复制件只装判定有效的那几条
    const good = mk('11010119900307001');
    const bad = good[17] === '9' ? `${good.slice(0, 17)}8` : `${good.slice(0, 17)}9`;
    m.page.set('idcard', 'read', [good, bad].join('\n'));
    m.page.click('idcard', 'read');
    assert.equal(m.page.copy('idcard', 'read').disabled, false);
    m.page.clickCopy('idcard', 'read');
    await jSettle();
    assert.deepEqual(writes, [good], '判定无效的那一条不该跟着被复制走');
  }

  // ── (h) 改口期间再按一次：原文案取自挂载时记下的那份，不是当前那句"已复制" ──
  {
    const m = jMount();
    m.page.clickCopy('idcard', 'gen');
    assert.equal(jLabel(m.page, 'idcard', 'gen'), '已复制');
    m.page.clickCopy('idcard', 'gen');
    assert.equal(jLabel(m.page, 'idcard', 'gen'), '已复制');
    assert.equal(m.timers.length, 2, '两次点击各留一条恢复用的定时器');
    m.flush();
    assert.equal(jLabel(m.page, 'idcard', 'gen'), '复制这批号码',
      '把"已复制"当成原文案存下来，按钮就会永远停在改口状态');
  }

  // ── (i) 连 `execCommand` 都没有（个别环境把 document 裁过）：这一级算失败，不许当成功 ──
  {
    const m = jMount();
    m.page.doc.execCommand = undefined;
    m.page.clickCopy('uscc', 'gen');
    assert.deepEqual(m.page.commandLog, [], '没有 `execCommand` 就不该假装调用过它');
    assert.equal(m.page.selLog.length, 1, '临时框照样选中：这一级的失败要留一条能被手动 Ctrl+C 的框');
    assert.equal(boxes(m.page).length, 1);
    assert.equal(m.page.doc.body.childNodes.length, 0, '这一级也要在 finally 里摘掉临时框');
    assert.equal(jLabel(m.page, 'uscc', 'gen'), '复制失败，请手动选中',
      '没复制上却说"已复制"，用户粘出来才发现是空的——这是这一节最不该有的结果');
    assert.equal(m.timers[0].ms, 2600, '走的是失败那一句的恢复时长');
    m.flush();
    assert.equal(jLabel(m.page, 'uscc', 'gen'), '复制这批代码');
  }
});
```

- [x] **Step 2: 跑红，确认红的形状**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^not ok|Cannot find module|^# (tests|pass|fail)'; echo "exit=${PIPESTATUS[0]}"
```

Expected：`not ok 1 - scripts/toolkit-tests.mjs` 加一句
`ERR_MODULE_NOT_FOUND: Cannot find module '…/dev/js/tools/workbench.js'`，`# tests 131`、`# pass 130`
（§A–§I 那批照绿）、`# fail 1`、`exit=` 非 0。形状与 §I 当时相同：**整文件挂**，不是 16 条各挂一次
——§J 的 `await import('../dev/js/tools/workbench.js')` 在文件顶层，抛在解析期。Step 2 只核对
`# tests` 与 `# fail` 两个数。

**落地实跑 2026-09-27（Step 1b + Step 2）**

Step 1b 用 `/tmp/t7/append1b.mjs` 把镜像**原样**追加（三条切片自检：首行是 `// ── §J ` 标记、
尾行是 `});`、切片内不混围栏；另加两道"不重复追加"与"磁盘末行形状"的护栏）：§J 块 **1,225 行**，
`scripts/toolkit-tests.mjs` 4,514 → **5,740 行 / 366,980 字节**。落完 `verify-plan-blocks.mjs`
立刻报"§J（磁盘 4516–5740）：计划[段2] 6584–7808（1225 行）与磁盘逐字节全等"——这一格磁盘与
计划一字不差，Step 1a 那 18 行的账也就此对上（两节看到的是同一台假 DOM）。

Step 2 红的形状与 Expected 逐字对上：`not ok 1 - scripts/toolkit-tests.mjs`、
`ERR_MODULE_NOT_FOUND: Cannot find module '…/dev/js/tools/workbench.js'`、`# tests 131`、
`# pass 130`、`# fail 1`。**跑法改了**：不用上面那条 `| grep …; echo "exit=${PIPESTATUS[0]}"`，
改成 `> /tmp/t7/step2.log 2>&1; echo "exit=$?"`（真退 1）。原因现场验过——本机默认 shell 是 zsh，
`${PIPESTATUS[0]}` 在 zsh 下展开成**空**（zsh 的那本账叫 `pipestatus`，下标从 1 起：
`false | true` 之后 `${pipestatus[1]}` 回 `1`、`${PIPESTATUS[0]}` 回空）。这不是洁癖：退码读成空，
"红没红"就只剩 grep 的文本一项证据了，而这正是"管道吞退出码"那一族的老形状。

- [x] **Step 3: 写这一格的三个文件**

顺序是"共用层 → 装配层 → 入口"：前一个的导出名就是后一个的入参名，倒过来写会先把 `window.Tk`
的挂面写成猜的。骨架 HTML、`dev/sass/toolkit.scss`、`_data/onlineTools.yml` 与 `postcss.config.js`
那两条黑名单都在 Task 8——顺序也是照着这个排的：骨架要写的 `data-tk-*` 四格，取值口径全在
这三个文件里。

**3a `dev/js/toolkitCore.js`** —— 全站唯一一处把跨页共用的东西挂成全局。三条约束写在文件头：
只挂那三个名字、本文件不 `export`、只挂跨页共用的（业务模块不下这一层）。

```js
/**
 * 工具箱三页共用的框架层：把「面板互锁状态机 + 它的 DOM 绑定层 + 结果视图」挂成 `window.Tk`。
 *
 * 为什么要有这么一层，而不是让页面入口各自 `import`：2026-09-26 在镜像里实测过，`dev/js/` 下
 * 两个入口同时 `import` 同一个模块时，Rollup 会把它提成共享 chunk，而 `vite.config.js` 的
 * `iife-wrap` 又把 ESM 的 `import` 声明包进函数体——产物里留下 `import{c as o}from"./panel.min.js"`
 * 这种句子，经典 `<script>` 里当场 SyntaxError，**整页白屏而构建 exit=0**。三页都用到
 * `panel.js` / `panel-dom.js` / `view.js`，所以这一层从段 2 就立起来，不留到段 3 返工。
 * 站内同族先例：`dev/libJs/tools.js` 出 `window.tools.formatDate`（`_layouts/default.html` 全站引），
 * `editorial.min.js` 是主题的唯一真值源 `window.EditorialTheme`。
 *
 * 三条约束：
 * 1. **只挂这三个名字**，不加版本号、不加解析函数、不加"顺手暴露"的东西。页面入口拿不到的能力
 *    就是不存在，将来要扩面是显式改动。
 * 2. **本文件不 `export`**：产物是被 `(function(){…})();` 包起来的经典脚本，顶层 `export`
 *    在函数体里是语法错误（同上一条那个坑的另一种写法）。
 * 3. **只挂跨页共用的**：`idcard.js` / `uscc.js` 那六本业务模块只有证件页要，走
 *    `tools/workbench.js` 直接 `import` 内联进 `toolIdcard.min.js`，不下到这一层。
 *    判据在 Task 9：构建后 `assets/js/*.min.js` 里 `import{` 的命中数必须为 0。
 */
import { createPanelWorkspace } from './tools/panel.js';
import { createPanelDom } from './tools/panel-dom.js';
import * as view from './tools/view.js';

window.Tk = { createPanelWorkspace, createPanelDom, view };
```

**3b `dev/js/tools/workbench.js`** —— 本页（以及段 3 / 段 4 那两页的同类）装配层。文件头那五条
口径与上面九条同源，这里补三条只有看代码才分得清的：

- `env` 三样必填（`document` / `Tk.view` / `runGuarded`），缺一样在构造期就 `TypeError`，
  不留到第一次点击。`runGuarded` 必须是 `createPanelDom().run` 那只：按钮回调不许自己
  `try/catch` 出第二套错误口径。
- `later(fn, ms)` 可由 `env` 注入，默认 `setTimeout`。§J 用它数定时器、验恢复时长，
  真页面上就是 `setTimeout`——这一格不为测试引入任何"只有测试看得见"的分支。
- `rng` / `today` 用 `!== undefined` 判存在，不判真假：`rng = 0` 与 `today = ''` 都是调用方
  明确给出的值，装配层无权替模块把它折回默认。

```js
/**
 * 证件页的装配层：把 `tools-idcard.html` 里那些静态表单接到六本业务模块上，结果交给
 * `view`（`window.Tk.view`）渲染。
 *
 * 这一层存在的理由是段 1 计划 §6.0 那句分工的自然延伸：**表单与控件的对应关系只允许有一处**。
 * 页面里有 9 个栏位、35 个控件、18 个按钮与结果区，如果"哪个 id 属于哪一栏"同时写在 HTML 的
 * `id=` 与 JS 的字符串里，那就是两处口径——改一处漏一处，而漏掉那一处只在页面上"点了没反应"。
 * 所以这里用 `WORKBENCH_SPEC` 把五块面板的控件、级联、下拉数据源、开关目标全部声明出来，
 * 所有 id 由 `fieldId()` / `buttonId()` / `copyId()` / `outId()` 派生；HTML 里的
 * `data-tk-cascade` / `data-tk-options` / `data-tk-switch` / `data-tk-when` 是**写给人和
 * 样式看的标记**，运行时不读它们，它们与 spec 是否一致由 Task 9 在构建产物上对账。
 *
 * 五条口径，§J 的判据逐条对着咬：
 *
 * 1. **空选项整键缺席**。这是实测出来的，不是猜的：六本模块对"用户没选"的写法各不相同——
 *    `generateIdCards` 收到 `sex: ''` 抛 `RangeError`、收到 `areaCode: ''` 抛 `TypeError`；
 *    `generateEmails` 收到 `domain: ''` 抛 `TypeError`；`generateNames` 收到 `givenLength: ''`
 *    抛 `TypeError`；`generateBankCards` 收到 `length: ''` 抛 `TypeError`（2026-09-26 逐键实测，
 *    命令在段 2 计划 Task 7 §0）。所以装配层**不许把空串当"不限"传下去**，一律不写那个键，
 *    让模块按自己的默认值走。`generateUsccCodes` 的 `registry` / `category` 更特殊：不传是
 *    `'9'` / `'1'` 这两个**固定字符**而不是随机，页面上那格文案照这个事实写。
 * 2 **两栏对称但 kind 不同名**。面板名 `bankcard` / `mobile` 与 `view` 的 `kind`
 *   （`bank` / `mobile`）不是一回事，映射写在 spec 里而不是靠字符串猜。
 * 3. **两类失败分两条路**。用户填的东西不能用 → `FieldError` → 结果区里一句提示，
 *    面板不算坏；模块自己抛的（收窄到零候选、内部不变量） → 原样往上抛，交给
 *    `createPanelDom.run()` 标坏那一块。把第一条也标坏，等于把"你少填了个日期"说成
 *    "这块面板坏了"，而错误条那句"其余面板不受影响"在这种情况下是废话。
 * 4. **行号由装配层给**。`parseIdCardList` / `parseUsccList` 保留空行并把它算进 `no`，
 *    `parseBankCardList` 跳过空行、`line` 是原样行号，`parseMobile` 干脆没有 List 版
 *    （段 2 计划 Task 3 记的缺口）。四本各说各话，页面不能跟着各长四个样：装配层自己按
 *    "丢掉全空行、保留原始行号、上限 `MAX_READ_LINES` 行"切一遍，四块面板共用同一段渲染。
 *    四个 List 函数仍在 §B/§C/§E 的判据里，这一层不用它们不等于它们没被测过。
 * 5. **动态文本只走 `view`**。`view` 里每个函数都过 `esc()`；这一层自己产出的文本（行号、
 *    回显、提示句）同样只经 `view.esc`，不拼裸 HTML。`innerHTML` 只出现在 `paint()` 一处。
 *
 * 与 `panel.js` / `panel-dom.js` / `view.js` 的分工：那三个是跨页共用的，走 `window.Tk` 进来
 * （见 `dev/js/toolkitCore.js` 开头那段实测），**本文件不许 `import` 它们**——一旦 import，
 * 证件页与后面的编码工具箱页就有两个入口 reach 同一模块，产物立刻变成带 `import{` 的废文件。
 * 这条红线由 §J14 用源码文本守住。
 *
 * 本文件也不是入口：`dev/js/toolIdcard.js` 才在 `dev/js/` 第一层，它 `import` 本文件，
 * 于是业务模块全部内联进 `toolIdcard.min.js`（只有一个入口 reach 它们，不会成 chunk）。
 */
import { parseIdCard, generateIdCards, USE_NOTE as ID_CARD_NOTE, GENERATE_MAX } from './idcard.js';
import { parseUscc, generateUsccCodes, USE_NOTE as USCC_NOTE, REFERENCE_NOTE, USCC_CHARSET } from './uscc.js';
import {
  parseBankCard, generateBankCards, BANK_CAVEAT, CARD_TYPES, TOP_BANKS, BANK_OPTIONS,
  PAN_MIN, PAN_MAX,
} from './bankcard.js';
import { parseMobile, generateMobiles, MOBILE_CAVEAT, CARRIER_NOTE, CARRIERS, SEGMENTS } from './phone.js';
import {
  generateNames, generateAddresses, generateEmails, generateProfiles,
  RANDOM_CAVEAT, NAME_NOTE, ADDRESS_NOTE, EMAIL_NOTE, EMAIL_DOMAINS,
} from './random-data.js';
import {
  provinceCodes, provinceName, currentCityCodes, cityName, currentCountyCodes, resolveRegion,
} from './region.js';

// ── 常量与派生 id ────────────────────────────────────────────────────────────

/**
 * 一次判定最多读多少行。生成侧的上限是各模块的 `GENERATE_MAX`（50），读侧给同一档，
 * 理由是"一张 50 行的表已经是这块屏幕的极限"，而不是"再多就慢"——四本解析函数都是纯算式，
 * 60 行也照样算得完，但结果区会长成没人能读的一堵墙。超出的行数不进表格，只在提示里报数。
 */
export const MAX_READ_LINES = 50;

/** 复制按钮改口"已复制"之后多久恢复原文案（毫秒）；只这一处用到时长，不抽 token */
const COPY_RESET_MS = 1600;
/** 复制失败后的提示停留时长，比成功的那句长一点：那句要被人读到才会去手动选中文本 */
const COPY_FAIL_MS = 2600;

/** 结果区里"这一栏还没有内容 / 这一栏的输入不能用"那一行的类名（`toolkit.scss` 的钩子） */
const HINT_CLASS = 'tk-hint';

/**
 * 控件的值 → 面板的 `<control>` 段 id：`<prefix>-in-<panel>-<control>`。
 * 与 `tools-idcard.html` 里逐字符对应，§J10 断言换前缀时整套跟着换、不残留旧前缀。
 * @param {string} prefix 前缀（证件页 `tk`，JSON 页 `jt`）
 * @param {string} panel 面板 slug
 * @param {string} control 控件 slug
 * @returns {string} 元素 id
 */
export function fieldId(prefix, panel, control) {
  return `${prefix}-in-${panel}-${control}`;
}

/**
 * 主按钮 id：`<prefix>-btn-<panel>-<side>`，`side` 是 `gen` / `read`。
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
 * 受开关控制的字段组 id：`<prefix>-when-<panel>-<key>`。
 * 注意单位不是控件而是 HTML 里那一段 `<p data-tk-when>`——区划三级包在同一个 `<p>` 里，
 * 隐藏那一段才叫"这一类用不上"，逐个隐藏三个 `<select>` 会留下一个空标签。
 * @param {string} prefix 前缀
 * @param {string} panel 面板 slug
 * @param {string} key 开关目标 key
 * @returns {string} 元素 id
 */
export function whenId(prefix, panel, key) {
  return `${prefix}-when-${panel}-${key}`;
}

// ── WORKBENCH_SPEC：五块面板的唯一形状 ───────────────────────────────────────

/**
 * 面板 → 两栏的控件、级联、开关与 kind 映射。
 *
 * `controls[]` 的每一项：
 *   - `id` 控件 slug，逐字符对应 HTML 里的 `<control>`；
 *   - `type` `'text'`（默认，取 `value` 去空白）/ `'number'` / `'area'`（粘贴框，整段文本）；
 *   - `options` / `cascade` / `charsets` / `switch` 是给 Task 9 对账用的标记，
 *     运行时由下面那几个 `fill*` 函数按 spec 里同名的键执行，**不去读 DOM 上的 `data-tk-*`**。
 *
 * `sides.gen` / `sides.read` 里：`kind` 是 `view` 的那套 kind；`read` 为 `null` 表示这一栏
 * 不存在（`#random` 没有可校验的输入）。`switch` 描述"哪个控件的值决定哪些字段组显隐"。
 *
 * @type {Record<string, object>}
 */
export const WORKBENCH_SPEC = {
  idcard: {
    sides: {
      gen: {
        kind: 'idcard',
        controls: [
          { id: 'province', cascade: 'province' },
          { id: 'city', cascade: 'city' },
          { id: 'county', cascade: 'county' },
          { id: 'sex' },
          { id: 'ageband', switch: 'ageband' },
          { id: 'birth', type: 'date' },
          { id: 'count', type: 'number' },
        ],
        switch: { control: 'ageband', targets: [{ key: 'birth', when: ['custom'] }] },
      },
      read: { kind: 'idcard', controls: [{ id: 'read', type: 'area' }] },
    },
  },
  uscc: {
    sides: {
      gen: {
        kind: 'uscc',
        controls: [
          { id: 'registry', charsets: 'uscc' },
          { id: 'category', charsets: 'uscc' },
          { id: 'province', cascade: 'province' },
          { id: 'city', cascade: 'city' },
          { id: 'count', type: 'number' },
        ],
      },
      read: { kind: 'uscc', controls: [{ id: 'read', type: 'area' }] },
    },
  },
  bankcard: {
    sides: {
      gen: {
        kind: 'bank',
        controls: [
          { id: 'bank', options: 'banks' },
          { id: 'type', options: 'cardtypes' },
          { id: 'length', type: 'number' },
          { id: 'count', type: 'number' },
        ],
      },
      read: { kind: 'bank', controls: [{ id: 'read', type: 'area' }] },
    },
  },
  mobile: {
    sides: {
      gen: {
        kind: 'mobile',
        controls: [
          { id: 'carrier', options: 'carriers' },
          { id: 'segment', options: 'segments' },
          { id: 'count', type: 'number' },
        ],
      },
      read: { kind: 'mobile', controls: [{ id: 'read', type: 'area' }] },
    },
  },
  random: {
    sides: {
      gen: {
        kind: 'name',
        kindFrom: 'kind',
        kindMap: { name: 'name', address: 'address', email: 'email', profile: 'profile' },
        controls: [
          { id: 'kind', switch: 'kind' },
          { id: 'count', type: 'number' },
          { id: 'givelen' },
          { id: 'province', cascade: 'province' },
          { id: 'city', cascade: 'city' },
          { id: 'county', cascade: 'county' },
          { id: 'domain', options: 'domains' },
        ],
        switch: {
          control: 'kind',
          targets: [
            { key: 'givelen', when: ['name', 'profile'] },
            { key: 'addr', when: ['address', 'profile'] },
            { key: 'domain', when: ['email', 'profile'] },
          ],
        },
      },
      read: null,
    },
  },
};

/** 面板顺序就是 `data-tk-ids` 与索引条的顺序；导出给 §J 与入口用，别再各写一份清单 */
export const PANEL_IDS = Object.keys(WORKBENCH_SPEC);

/**
 * 一栏里每行"复制出来长什么样"。生成侧交主字段，一行一条；`profile` 三条用制表符连着，
 * 粘进表格软件正好是三列。读侧只交判定为有效的 `value`（见 `READ_COPY`）。
 */
const GEN_COPY = {
  idcard: (r) => r.id18,
  uscc: (r) => r.code,
  bank: (r) => r.number,
  mobile: (r) => r.number,
  name: (r) => r.name,
  address: (r) => r.text,
  email: (r) => r.email,
  profile: (r) => `${r.name.name}\t${r.address.text}\t${r.email.email}`,
};

/**
 * 口径行：模块常量原样交给 `view.batchBlock` / `view.parseBlock` 落地（§H 的 H8 判"一字不动"）。
 *
 * 读侧刻意只给 `uscc` 补一句：另外三本的 `caveat` / `note` 本来就挂在结果对象上，
 * `parseBlock` 会自己收走（`bank` 的 `caveat` 恒为 `BANK_CAVEAT`、`mobile` 的两条恒在），
 * 装配层再塞一遍就是同一句话在同一栏里出现两次。
 */
const GEN_NOTES = {
  idcard: [ID_CARD_NOTE],
  uscc: [USCC_NOTE],
  bank: [BANK_CAVEAT],
  mobile: [MOBILE_CAVEAT, CARRIER_NOTE],
  name: [RANDOM_CAVEAT, NAME_NOTE],
  address: [RANDOM_CAVEAT, ADDRESS_NOTE],
  email: [RANDOM_CAVEAT, EMAIL_NOTE],
  profile: [RANDOM_CAVEAT, NAME_NOTE, ADDRESS_NOTE, EMAIL_NOTE],
};
const READ_NOTES = { idcard: [], uscc: [REFERENCE_NOTE], bank: [], mobile: [] };

/**
 * 整栏通用的那几句口径：`bankcard.js:159` 的 `caveat: BANK_CAVEAT` 恒有值，`phone.js:125`
 * 同档带 `note: CARRIER_NOTE`（两本的 `base()` 都把常量写进每一次解析结果），
 * `view.parseBlock` 又会照字段收走——于是粘 50 行就是 50 段同一句话。
 * 这里按**常量全等**把它们从逐行结果里摘掉、在栏尾说一次：全等而不是"看着像"，
 * 因为身份证与信用代码的 `caveat` 是随号码变的（撤销区划、第 17 位是字母、小写转大写），
 * 那两句必须留在各自那一行里，摘错了就是把结论从号码旁边搬走。
 */
const BATCH_NOTES = {
  bank: [{ field: 'caveat', text: BANK_CAVEAT }],
  mobile: [{ field: 'caveat', text: MOBILE_CAVEAT }, { field: 'note', text: CARRIER_NOTE }],
};

/** 读侧每本用哪个解析函数——四本里只有 `phone.js` 没有 List 版，所以这里全用单个版（口径 4） */
const READ_PARSE = {
  idcard: parseIdCard,
  uscc: parseUscc,
  bank: parseBankCard,
  mobile: parseMobile,
};

// ── FieldError：用户填的东西不能用 ──────────────────────────────────────────

/**
 * "这一栏的输入不能用"这一类失败。它不是面板坏了：消息进结果区的提示行，面板不进 broken 名单，
 * `createPanelDom` 的错误条也就不会出现（口径 3）。
 * @extends Error
 */
export class FieldError extends Error {
  /**
   * @param {string} message 直接给用户看的一句话，点名是哪个格子
   */
  constructor(message) {
    super(message);
    this.name = 'FieldError';
    /** 判别用的标记，不靠 `name` 字符串比对（压缩器不会动这里，但标记比名字结实） */
    this.isField = true;
  }
}

// ── createWorkbench ─────────────────────────────────────────────────────────

/**
 * 造一个证件页的装配器。
 *
 * @param {object} env 依赖注入。全给出去是为了 §J 能在 Node 里跑真接线：
 *   六本业务模块与 `region` 是直接 `import` 的（只有一个入口 reach 它们，不会成共享 chunk），
 *   框架层与宿主环境从 `env` 进来。
 * @param {object} env.document 只需 `getElementById` / `createElement`（与 `panel-dom` 同一档，
 *   这一层也不碰 `querySelector`：控件一律按派生 id 找，找不到就是骨架构造错了）
 * @param {object} env.Tk `window.Tk`，必须齐 `view`
 * @param {(panel: string, fn: () => void) => boolean} env.runGuarded 通常是
 *   `createPanelDom().run`；挂载期不走它（那时 `mounted` 还是 false），只挂在按钮上
 * @param {object} [env.navigator] 只为 `clipboard`，没有就走 `execCommand` 兜底
 * @param {(fn: () => void, ms: number) => number} [env.later] `setTimeout` 的别名，测试里换成同步执行
 * @param {string} [env.prefix] 前缀，默认 `tk`
 * @param {() => number} [env.rng] 传给各生成器的随机源；不传就用模块自己的 `Date.now()` 种子
 * @param {string} [env.today] `YYYY-MM-DD`，透传给 `generateIdCards`；不传按本地今天
 * @returns {{renderers: Record<string, (el: object) => void>,
 *   run: (panel: string, side: string) => boolean,
 *   copyTextOf: (panel: string, side: string) => string}}
 */
export function createWorkbench(env = {}) {
  const e = env ?? {};
  if (!e.document || typeof e.document.getElementById !== 'function'
    || typeof e.document.createElement !== 'function') {
    throw new TypeError('createWorkbench：env.document 要有 getElementById 与 createElement');
  }
  if (!e.Tk || !e.Tk.view || typeof e.Tk.view.batchBlock !== 'function') {
    throw new TypeError('createWorkbench：env.Tk.view 应是 window.Tk 里那份 view（跨页共用层走 toolkitCore，不许 import）');
  }
  if (typeof e.runGuarded !== 'function') {
    throw new TypeError('createWorkbench：env.runGuarded 应是 createPanelDom().run，按钮回调不许自己 try/catch 出第二套错误口径');
  }
  const doc = e.document;
  const view = e.Tk.view;
  const runGuarded = e.runGuarded;
  const prefix = typeof e.prefix === 'string' && e.prefix !== '' ? e.prefix : 'tk';
  const rng = e.rng === undefined ? undefined : e.rng;
  const today = e.today;
  const later = typeof e.later === 'function' ? e.later : (fn, ms) => setTimeout(fn, ms);
  const clipboard = e.navigator && e.navigator.clipboard ? e.navigator.clipboard : null;

  /** `panel:side → 这一栏当前能复制的纯文本`；渲染时写，复制按钮读它，不从 HTML 反解 */
  const copies = new Map();
  const key = (panel, side) => `${panel}:${side}`;
  const node = (id) => doc.getElementById(id);

  /** 取控件值：去首尾空白，空值一律 `null`（口径 1：调用方按 `null` 决定"不写这个键"） */
  const valueOf = (panel, control) => {
    const el = node(fieldId(prefix, panel, control));
    if (!el) throw new RangeError(`页面里没有 id="${fieldId(prefix, panel, control)}" 的控件，spec 与骨架对不上`);
    const raw = typeof el.value === 'string' ? el.value : '';
    const v = raw.trim();
    return v === '' ? null : v;
  };

  /** 粘贴框：整段文本，只去行尾 `\r`（Windows 粘进来的），不 trim——空行由调用侧统一处理 */
  const areaOf = (panel, control) => {
    const el = node(fieldId(prefix, panel, control));
    if (!el) throw new RangeError(`页面里没有 id="${fieldId(prefix, panel, control)}" 的粘贴框`);
    return String(typeof el.value === 'string' ? el.value : '').replace(/\r\n?/g, '\n');
  };

  /** 数量格：1..GENERATE_MAX 的整数；空与非整数都算"这一栏的输入不能用"（口径 3） */
  const countOf = (panel) => {
    const raw = valueOf(panel, 'count');
    if (raw === null) {
      throw new FieldError('数量这一格是空的，填 1–' + GENERATE_MAX + ' 之间的整数。');
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > GENERATE_MAX) {
      throw new FieldError(`数量应为 1–${GENERATE_MAX} 的整数，现在这格是「${raw}」。`);
    }
    return n;
  };

  /** 整数格（位数）：范围由调用方给，越界说清是哪一格 */
  const intOf = (panel, control, min, max, label) => {
    const raw = valueOf(panel, control);
    if (raw === null) return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) {
      throw new FieldError(`${label}应为 ${min}–${max} 的整数，现在这格是「${raw}」。`);
    }
    return n;
  };

  /** 必填格（选了这个才必须有那个）：空就是 FieldError */
  const required = (raw, message) => {
    if (raw === null || raw === '') throw new FieldError(message);
    return raw;
  };

  /** 区划三级 → 模块的那三个键，优先级与 `idcard.js` 的 `prefixOf` 一致：县 > 市 > 省 */
  const regionKeys = (panel) => {
    const o = {};
    const county = valueOf(panel, 'county');
    const city = valueOf(panel, 'city');
    const prov = valueOf(panel, 'province');
    if (county) o.areaCode = county;
    else if (city) o.cityCode = city;
    else if (prov) o.provinceCode = prov;
    return o;
  };

  // ── 下拉填充 ────────────────────────────────────────────────────────────

  /** 造一个 `<option>`：`value` 走属性、文字走 `textContent`，没有第三条路 */
  const makeOption = (it) => {
    const opt = doc.createElement('option');
    opt.setAttribute('value', String(it.value));
    opt.textContent = String(it.label);
    return opt;
  };

  /**
   * 换掉一个 `<select>` 的选项，**保留 HTML 里那一条占位 `<option>`**。
   * 占位句（"不限省份""不填（取默认字符 9）"）是页面文案，spec 里不重抄一份；
   * 所以这里把第一个子节点摘出来存着、清空、再放回去。`removeChild` 的返回值真 DOM 与
   * §J 的假 DOM 都得给，这是它对绑定层提出的唯一额外要求。
   * @param {object} el select 节点
   * @param {object[]} items `[{ value, label }]`
   * @param {boolean} [disabled] 上一级没选时整格禁用
   */
  const fill = (el, items, disabled = false) => {
    if (!el) return;
    const held = el.firstChild && String(el.firstChild.tagName || '') === 'OPTION'
      ? el.removeChild(el.firstChild) : null;
    while (el.firstChild) el.removeChild(el.firstChild);
    if (held) el.appendChild(held);
    for (const it of items) el.appendChild(makeOption(it));
    el.value = '';
    el.disabled = disabled;
  };

  /**
   * 分组填充（行别与号段那两格）：`groups` 是 `[{ label, items }]`，`label` 空串表示这一组
   * 不包 `<optgroup>`（混着放会让占位项后面先出现一坨没标题的裸 `<option>`，读屏会念成
   * "选项 空"）。清空只做一次，所以先算完整清单再动节点。
   * @param {object} el select 节点
   * @param {{label: string, items: {value: string, label: string}[]}[]} groups 分组清单
   */
  const fillGrouped = (el, groups) => {
    if (!el) return;
    const held = el.firstChild && String(el.firstChild.tagName || '') === 'OPTION'
      ? el.removeChild(el.firstChild) : null;
    while (el.firstChild) el.removeChild(el.firstChild);
    if (held) el.appendChild(held);
    for (const g of groups) {
      if (g.label === '') {
        for (const it of g.items) el.appendChild(makeOption(it));
        continue;
      }
      const box = doc.createElement('optgroup');
      box.setAttribute('label', g.label);
      for (const it of g.items) box.appendChild(makeOption(it));
      el.appendChild(box);
    }
    el.value = '';
    el.disabled = false;
  };

  /** 区划三级的取数：省 31 条；市按省取；县按市取，但直辖市那 4 个只有一个"市辖区"，允许省下直接选县 */
  const cityOptions = (prov) => currentCityCodes(prov).map((c) => ({ value: c, label: cityName(c) }));
  const countyOptions = (city4) => currentCountyCodes(city4)
    .map((c) => ({ value: c, label: resolveRegion(c).county || resolveRegion(c).fullName }));

  /**
   * 按 spec 重建一格的选项，并把级联的下游一起接上。
   * @param {string} panel 面板
   * @param {string} control 控件
   */
  const refill = (panel, control) => {
    const el = node(fieldId(prefix, panel, control));
    if (!el) return;
    const level = cascadeLevelOf(panel, control);
    if (level === 'province') {
      fill(el, provinceCodes().map((c) => ({ value: c, label: provinceName(c) })));
      return;
    }
    if (level === 'city') {
      const prov = valueOf(panel, 'province');
      fill(el, prov ? cityOptions(prov) : [], !prov);
      return;
    }
    if (level === 'county') {
      const city = valueOf(panel, 'city');
      const prov = valueOf(panel, 'province');
      // 只选到省时：仅当该省下恰好一个市（4 个直辖市的"市辖区"）才放开县格，否则它无从选起
      const single = prov && cityOptions(prov).length === 1 ? cityOptions(prov)[0].value : null;
      const base = city || single;
      fill(el, base ? countyOptions(base) : [], !base);
      return;
    }
    const source = optionsSourceOf(panel, control);
    if (source === 'banks') {
      const top = new Set(TOP_BANKS.map((b) => b.code));
      fillGrouped(el, [
        { label: '', items: TOP_BANKS.map((b) => ({ value: b.code, label: `${b.name}（${b.binCount} 条 BIN）` })) },
        {
          label: '其余行别（按行别码）',
          items: BANK_OPTIONS.filter((b) => !top.has(b.code)).map((b) => ({ value: b.code, label: b.name })),
        },
      ]);
      return;
    }
    if (source === 'cardtypes') {
      fill(el, Object.entries(CARD_TYPES).map(([code, name]) => ({ value: code, label: name })));
      return;
    }
    if (source === 'carriers') {
      fill(el, CARRIERS.map((c) => ({ value: c.carrier, label: `${c.carrier}（${c.count} 个号段）` })));
      return;
    }
    if (source === 'segments') {
      // 号段按运营商分组，但 `phone.js` 没有导出"运营商 → 号段"这张派生表（它只出
      // `CARRIERS`（含 count）与平铺的 `SEGMENTS`）。这里不为了一个下拉框去加一条导出：
      // 直接拿读侧的 `parseMobile` 把 56 个段各问一次归属，分组的口径就等于判定行的口径。
      // §F8 已经把"逐段都能判 valid、且运营商与表一致"钉住了，所以这一格不是没据的取巧。
      fillGrouped(el, CARRIERS.map((c) => ({
        label: c.carrier,
        items: SEGMENTS.filter((s) => carrierOfSegment(s) === c.carrier).map((s) => ({ value: s, label: s })),
      })));
      return;
    }
    if (source === 'domains') {
      fill(el, EMAIL_DOMAINS.map((d) => ({ value: d, label: d })));
      return;
    }
    if (charsetOf(panel, control) === 'uscc') {
      const dflt = control === 'registry' ? '9' : '1';
      fill(el, [...USCC_CHARSET].map((ch) => ({
        value: ch,
        label: ch === dflt ? `${ch}（默认）` : ch,
      })));
    }
  };

  // spec 侧的三张查询表：一格是级联第几级 / 静态下拉数据源 / 字符集，全从 spec 读

  const markerOf = (panel, side, control, field) => {
    const cfg = WORKBENCH_SPEC[panel].sides[side];
    const c = cfg && cfg.controls.find((x) => x.id === control);
    return c ? c[field] : undefined;
  };
  const cascadeLevelOf = (panel, control) => markerOf(panel, 'gen', control, 'cascade')
    || markerOf(panel, 'read', control, 'cascade');
  const optionsSourceOf = (panel, control) => markerOf(panel, 'gen', control, 'options')
    || markerOf(panel, 'read', control, 'options');
  const charsetOf = (panel, control) => markerOf(panel, 'gen', control, 'charsets')
    || markerOf(panel, 'read', control, 'charsets');

  // ── 开关：哪个控件决定哪几段显隐 ─────────────────────────────────────────

  /**
   * 应用一次显隐。隐藏走 `hidden` 布尔属性，不写 `style`：段 1 在 `panel-dom` 立的口径
   * （可见性的唯一来源是那一个属性）在这里同样成立，两处都能改显隐就等于两处能互相覆盖。
   * @param {string} panel 面板
   */
  const applySwitch = (panel) => {
    const cfg = WORKBENCH_SPEC[panel].sides.gen;
    if (!cfg.switch) return;
    const value = valueOf(panel, cfg.switch.control) ?? firstValueOf(panel, cfg.switch.control);
    for (const target of cfg.switch.targets) {
      const el = node(whenId(prefix, panel, target.key));
      if (!el) continue;
      el.hidden = !target.when.includes(value ?? '');
    }
  };

  /** 有些 `<select>` 的默认项本来就带值（`#random-kind` 的第一条是 `name`），空值时要用它 */
  const firstValueOf = (panel, control) => {
    const el = node(fieldId(prefix, panel, control));
    const first = el && el.firstChild;
    return first && typeof first.getAttribute === 'function' ? first.getAttribute('value') : null;
  };

  // ── 生成侧：spec → 模块入参 ──────────────────────────────────────────────

  /**
   * 一格的值 → 该面板生成函数的 options。**空值一律不写键**（口径 1）。
   * @param {string} panel 面板
   * @param {string} kind 这一栏用的 `view` kind
   * @returns {object} 直接喂给模块的入参
   */
  const buildOptions = (panel, kind) => {
    const o = { count: countOf(panel) };
    if (rng !== undefined) o.rng = rng;
    if (today !== undefined) o.today = today;
    if (panel === 'idcard') {
      Object.assign(o, regionKeys(panel));
      const sex = valueOf(panel, 'sex');
      if (sex) o.sex = sex;
      const band = valueOf(panel, 'ageband');
      if (band === 'custom') {
        o.birthDate = required(valueOf(panel, 'birth'),
          '选了「指定出生日期」，就得把出生日期那一格填上。');
      } else if (band) {
        const [min, max] = band.split('-');
        o.minAge = Number(min);
        o.maxAge = Number(max);
      }
      return o;
    }
    if (panel === 'uscc') {
      // `provinceCode` 实为"任意 ≤4 位前缀"（uscc.js 的 regionPool 注释），所以市码可以直接用
      const city = valueOf(panel, 'city');
      const prov = valueOf(panel, 'province');
      if (city) o.provinceCode = city;
      else if (prov) o.provinceCode = prov;
      const registry = valueOf(panel, 'registry');
      if (registry) o.registry = registry;
      const category = valueOf(panel, 'category');
      if (category) o.category = category;
      return o;
    }
    if (panel === 'bankcard') {
      const bank = valueOf(panel, 'bank');
      if (bank) o.bankCode = bank;
      const type = valueOf(panel, 'type');
      if (type) o.cardType = type;
      const len = intOf(panel, 'length', PAN_MIN, PAN_MAX, '位数');
      if (len !== null) o.length = len;
      return o;
    }
    if (panel === 'mobile') {
      const carrier = valueOf(panel, 'carrier');
      if (carrier) o.carrier = carrier;
      const segment = valueOf(panel, 'segment');
      if (segment) o.segment = segment;
      return o;
    }
    // #random：四级 kind 共用同一批格子，用不上的格子由开关藏掉，但值还留在 DOM 里，
    // 所以这里必须按 kind 取该取的键——把 address 的区划带进 email 那一档，
    // 模块不会报（它只看 domain），页面上却会出现"选了南京、邮箱域随机"的莫名结果。
    Object.assign(o, { name: nameOptions, address: addressOptions, email: emailOptions, profile: profileOptions }[kind](panel));
    return o;
  };
  const nameOptions = (panel) => {
    const o = {};
    const gl = valueOf(panel, 'givelen');
    if (gl) o.givenLength = Number(gl);
    return o;
  };
  const addressOptions = (panel) => regionKeys(panel);
  const emailOptions = (panel) => {
    const o = {};
    const domain = valueOf(panel, 'domain');
    if (domain) o.domain = domain;
    return o;
  };
  const profileOptions = (panel) => ({ ...nameOptions(panel), ...addressOptions(panel), ...emailOptions(panel) });

  /** kind → 生成函数 */
  const GENERATORS = {
    idcard: generateIdCards,
    uscc: generateUsccCodes,
    bank: generateBankCards,
    mobile: generateMobiles,
    name: generateNames,
    address: generateAddresses,
    email: generateEmails,
    profile: generateProfiles,
  };

  /** 这一栏这一次用哪个 kind：`#random` 由 `kind` 格决定，其余面板 spec 里写死 */
  const kindOf = (panel) => {
    const cfg = WORKBENCH_SPEC[panel].sides.gen;
    if (!cfg.kindFrom) return cfg.kind;
    const raw = valueOf(panel, cfg.kindFrom) ?? firstValueOf(panel, cfg.kindFrom);
    const kind = cfg.kindMap[raw];
    if (!kind) {
      throw new RangeError(`#random 的 kind 格取到「${String(raw)}」，spec 里只认 ${Object.keys(cfg.kindMap).join(' / ')}`);
    }
    return kind;
  };

  // ── 渲染 ────────────────────────────────────────────────────────────────

  /** 唯一的 `innerHTML` 出口：提示行也过 `esc`，因为消息里会带上用户填的那一格原样 */
  const paint = (panel, side, html) => {
    const out = node(outId(prefix, panel, side));
    if (!out) throw new RangeError(`页面里没有 id="${outId(prefix, panel, side)}" 的结果区`);
    out.innerHTML = html;
    return out;
  };

  /** 提示行（空栏、输入不能用、超出上限）——不算内容，所以复制按钮跟着禁用 */
  const hint = (panel, side, message) => {
    paint(panel, side, `<p class="${HINT_CLASS}">${view.esc(message)}</p>`);
    copies.set(key(panel, side), '');
    syncCopy(panel, side);
  };

  /** 复制按钮的可用性只由"这一栏有没有可复制的文本"决定，不靠样式类猜 */
  const syncCopy = (panel, side) => {
    const btn = node(copyId(prefix, panel, side));
    if (!btn) return;
    btn.disabled = (copies.get(key(panel, side)) || '') === '';
  };

  /**
   * 生成一栏：表格 + 条数 + 口径行，全部由 `view.batchBlock` 出。
   * @param {string} panel 面板
   * @returns {boolean} 有没有真的画上（缺结果区时 `paint` 已抛，这里只反映成功）
   */
  const renderGen = (panel) => {
    const kind = kindOf(panel);
    const rows = GENERATORS[kind](buildOptions(panel, kind));
    paint(panel, 'gen', view.batchBlock(kind, rows, GEN_NOTES[kind]));
    copies.set(key(panel, 'gen'), rows.map(GEN_COPY[kind]).join('\n'));
    syncCopy(panel, 'gen');
    return true;
  };

  /**
   * 判定一栏：逐行一个结果块。行号用**原始行号**（口径 4），超出 `MAX_READ_LINES` 的行不进
   * 表格、只在提示里报数，免得一块 500 行的表把结果区撑成读不完的墙。
   * @param {string} panel 面板
   * @returns {boolean} 同上
   */
  const renderRead = (panel) => {
    const cfg = WORKBENCH_SPEC[panel].sides.read;
    const kind = cfg.kind;
    const lines = areaOf(panel, cfg.controls[0].id).split('\n');
    const kept = [];
    lines.forEach((raw, i) => {
      if (raw.trim() !== '') kept.push({ no: i + 1, raw });
    });
    if (kept.length === 0) {
      hint(panel, 'read', '粘贴框里还没有号码：一条一行粘进来就行。');
      return true;
    }
    const shown = kept.slice(0, MAX_READ_LINES);
    const parts = [];
    const valid = [];
    /** 摘出来的整栏通用句，栏尾一次说完 */
    const hoisted = [];
    const specs = BATCH_NOTES[kind];
    for (const row of shown) {
      let result = READ_PARSE[kind](row.raw);
      if (specs) {
        const hits = specs.filter((s) => result[s.field] === s.text);
        if (hits.length > 0) {
          const clean = { ...result };
          for (const s of hits) {
            if (!hoisted.includes(s.text)) hoisted.push(s.text);
            clean[s.field] = '';
          }
          result = clean;
        }
      }
      if (result.state === 'valid' && typeof result.value === 'string' && result.value !== '') {
        valid.push(result.value);
      }
      parts.push('<section class="tk-line">'
        + `<p class="tk-line__head">第 ${view.esc(String(row.no))} 行 · `
        + `<span class="tk-line__raw">${view.esc(row.raw)}</span></p>`
        + view.parseBlock(kind, result, []) + '</section>');
    }
    if (kept.length > shown.length) {
      parts.push(`<p class="${HINT_CLASS}">`
        + `这次粘进来 ${view.esc(String(kept.length))} 行，只判定前 ${MAX_READ_LINES} 行——`
        + `剩下的请分几次判。</p>`);
    }
    // 整栏通用的口径排在逐行结果之后：粘进来的人第一眼要看到的是自己那几行的结论
    paint(panel, 'read', `<div class="tk-lines">${parts.join('')}</div>`
      + view.noteLines([...hoisted, ...READ_NOTES[kind]]).join(''));
    copies.set(key(panel, 'read'), valid.join('\n'));
    syncCopy(panel, 'read');
    return true;
  };

  /** 一栏的渲染分派；`renderNow` 抛出去的东西由调用侧决定是提示还是标坏（口径 3） */
  const renderNow = (panel, side) => {
    if (side === 'gen') return renderGen(panel);
    if (WORKBENCH_SPEC[panel].sides.read === null) {
      throw new RangeError(`${panel} 这一栏没有判定侧，spec 里是 null`);
    }
    return renderRead(panel);
  };

  // ── 复制 ────────────────────────────────────────────────────────────────

  /** 按钮文案的临时改口：失败与成功走同一处，恢复时长不同（成功那句不需要读） */
  const flash = (btn, text, ms, original) => {
    btn.textContent = text;
    later(() => { btn.textContent = original; }, ms);
  };

  /**
   * 复制一栏。三级兜底：`navigator.clipboard` → 临时 `<textarea>` + `execCommand` →
   * 一句"请手动选中"。任何一级都不许抛到页面外面：剪贴板被权限策略拒绝是浏览器的正常行为，
   * 用户按了没反应才是缺陷。
   * @param {string} panel 面板
   * @param {string} side 栏位
   */
  const doCopy = (panel, side) => {
    const btn = node(copyId(prefix, panel, side));
    const text = copies.get(key(panel, side)) || '';
    if (!btn || text === '') return;
    const original = COPY_LABEL.get(copyId(prefix, panel, side)) || btn.textContent;
    const done = (ok) => flash(btn, ok ? '已复制' : '复制失败，请手动选中', ok ? COPY_RESET_MS : COPY_FAIL_MS, original);
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
  };

  // ── 事件接线 ─────────────────────────────────────────────────────────────

  /** 记下每条复制按钮的原文案，改口之后要能改回去（HTML 里那句是唯一的原文来源） */
  const COPY_LABEL = new Map();

  /** 每块面板的渲染函数：填下拉、接开关与级联、接按钮，然后先画一次生成侧 */
  const renderers = {};
  for (const panel of PANEL_IDS) {
    renderers[panel] = () => {
      const cfg = WORKBENCH_SPEC[panel].sides.gen;
      for (const c of cfg.controls) {
        const el = node(fieldId(prefix, panel, c.id));
        if (!el) continue;
        // Enter 只接在数字与日期格上：级联下拉里 Enter 没有"提交"语义，硬接会把用户的键盘
        // 焦点变成生成器触发器；多行粘贴框里的 Enter 必须是换行，它走 `onAreaKey` 那条组合键。
        if (c.type === 'number' || c.type === 'date') {
          el.addEventListener('keydown', onFieldKey(panel));
        }
        if (c.cascade || c.options || c.charsets) {
          refill(panel, c.id);
          el.addEventListener('change', () => {
            refreshCascade(panel, c.id);
            applySwitch(panel);
          });
        } else if (c.switch) {
          el.addEventListener('change', () => applySwitch(panel));
        }
      }
      applySwitch(panel);
      const genBtn = node(buttonId(prefix, panel, 'gen'));
      if (genBtn) genBtn.addEventListener('click', () => runGuardedRun(panel, 'gen'));
      const readCfg = WORKBENCH_SPEC[panel].sides.read;
      if (readCfg) {
        readCfg.controls.forEach((c) => {
          const el = node(fieldId(prefix, panel, c.id));
          if (el) el.addEventListener('keydown', onAreaKey(panel));
        });
        const readBtn = node(buttonId(prefix, panel, 'read'));
        if (readBtn) readBtn.addEventListener('click', () => runGuardedRun(panel, 'read'));
      }
      ['gen', 'read'].forEach((side) => {
        const id = copyId(prefix, panel, side);
        const btn = node(id);
        if (!btn) return;
        // 键用派生 id 而不是 `btn.id`：真 DOM 上两者相等，假 DOM 里 `.id` 是个普通属性，
        // 一旦哪份夹具没把它设上，`set(undefined, …)` 会静默存进另一格，`flash` 就取不回原文案。
        COPY_LABEL.set(id, btn.textContent);
        btn.addEventListener('click', () => doCopy(panel, side));
      });
      renderGen(panel);
      if (readCfg) hint(panel, 'read', '把号码粘进来，一条一行；判定全在浏览器里算，不发请求。');
    };
  }

  /** 级联：动了哪一格，就把它的下游重建一次（上游为空时下游退成禁用 + 只剩占位项） */
  const refreshCascade = (panel, control) => {
    const level = cascadeLevelOf(panel, control);
    if (level === 'province') {
      refill(panel, 'city');
      refill(panel, 'county');
    } else if (level === 'city') {
      refill(panel, 'county');
    }
  };

  /** 粘贴框里 Ctrl / ⌘ + Enter 判定；裸 Enter 仍然是换行（口径：多行框吞掉换行是缺陷） */
  const onAreaKey = (panel) => (evt) => {
    if (!evt || evt.key !== 'Enter' || !(evt.ctrlKey || evt.metaKey)) return;
    if (typeof evt.preventDefault === 'function') evt.preventDefault();
    runGuardedRun(panel, 'read');
  };

  /** 数字与日期格里的 Enter → 生成这一栏 */
  const onFieldKey = (panel) => (evt) => {
    if (!evt || evt.key !== 'Enter' || evt.shiftKey || evt.ctrlKey || evt.metaKey || evt.altKey) return;
    if (typeof evt.preventDefault === 'function') evt.preventDefault();
    runGuardedRun(panel, 'gen');
  };

  /**
   * 走一遍 `runGuarded`（真页面上就是 `createPanelDom.run`）：`FieldError` 在这一层就地转成
   * 提示行，其余异常原样抛出去，由那一层标坏这一块。
   * @param {string} panel 面板
   * @param {string} side 栏位
   */
  const runGuardedRun = (panel, side) => runGuarded(panel, () => {
    try {
      renderNow(panel, side);
    } catch (err) {
      if (!err || err.isField !== true) throw err;
      hint(panel, side, err.message);
    }
  });

  return {
    renderers,
    /**
     * 挂载完成后由测试或别处触发一栏：走的是与按钮完全同一条路（含 `runGuarded`）。
     * @param {string} panel 面板
     * @param {string} side 栏位
     * @returns {boolean} 这一块现在好不好——`runGuarded` 的返回值原样交出去，不替它乐观
     */
    run: (panel, side) => runGuardedRun(panel, side),
    /**
     * 这一栏当前能复制的文本（复制按钮读的就是它）。
     * @param {string} panel 面板
     * @param {string} side 栏位
     * @returns {string} 纯文本，没有则空串
     */
    copyTextOf: (panel, side) => copies.get(key(panel, side)) || '',
  };
}

/**
 * 三位号段归谁：把段补成 11 位交给读侧的 `parseMobile` 问一遍。
 * 不在 `phone.js` 里另开一张"运营商 → 号段"导出，是为了让下拉分组与判定行用同一张嘴说话
 * （§F8 已经把"逐段 valid 且运营商与表一致"钉住了，这里等于复用那条已被判过的路径）。
 * @param {string} segment 三位号段
 * @returns {string} 运营商名，判不到时是空串
 */
function carrierOfSegment(segment) {
  const padded = `${segment}00000000`.slice(0, 11);
  return parseMobile(padded).carrier;
}

/**
 * `navigator.clipboard` 不可用时的兜底：临时 textarea + `execCommand('copy')`。
 * 只在 http 或用户未授予剪贴板权限时走到这里，用完立刻摘掉节点——留在 DOM 里就是
 * 一个能被 Tab 走到的隐形输入框。
 * @param {object} doc 提供 `createElement` / `body.appendChild` / `body.removeChild`
 * @param {string} text 要复制的文本
 * @returns {boolean} 有没有真的复制上
 */
function legacyCopy(doc, text) {
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
 * 这个前缀下应该存在的全部控件 id，Task 9 拿它对账构建产物里的 HTML：
 * spec 说应有而页面没有 → 装配层第一次点就抛；页面有而 spec 没说 → 那是个没人接的格子。
 * 两个方向都红，才算这份 spec 是骨架的真值而不是它的影子。
 * @param {string} prefix 前缀
 * @param {string[]} [panels] 面板清单，默认 `PANEL_IDS`
 * @returns {{in: string[], btn: string[], copy: string[], out: string[], when: string[]}}
 */
export function controlIds(prefix, panels = PANEL_IDS) {
  const got = { in: [], btn: [], copy: [], out: [], when: [] };
  for (const panel of panels) {
    const sides = WORKBENCH_SPEC[panel].sides;
    for (const side of ['gen', 'read']) {
      const cfg = sides[side];
      if (!cfg) continue;
      got.btn.push(buttonId(prefix, panel, side));
      got.copy.push(copyId(prefix, panel, side));
      got.out.push(outId(prefix, panel, side));
      for (const c of cfg.controls) got.in.push(fieldId(prefix, panel, c.id));
    }
    const sw = sides.gen.switch;
    if (sw) for (const t of sw.targets) got.when.push(whenId(prefix, panel, t.key));
  }
  return got;
}
```

**3c `dev/js/toolIdcard.js`** —— 页面入口。四条口径写在文件头，其中最容易被误改的是第一条：
**前缀有两副面孔**。`CONTAINER_ID` / `NOTICE_ID` 里那个 `tk` 是本页自己的地址（JSON 页那份用 `jt`），
而行为里用的前缀从骨架的 `data-tk-prefix` 读，一路传给 `createPanelWorkspace` 与 `createWorkbench`。
第二条"`runGuarded` 晚绑"是这格唯一一处循环依赖的解法：`createWorkbench` 构造时就要收
`runGuarded`，而能当它的那只（`createPanelDom().run`）要等 workbench 交出 renderers 之后才存在，
所以递过去的是一个箭头，它在**调用时**才去 `guard.run` 上取。

```js
/**
 * 证件页入口：只读骨架里那四格 `data-tk-*`，把框架（`window.Tk`）与本页装配层接起来。
 *
 * 这个文件刻意薄到只剩三件事——找容器、读配置、按顺序接线——业务一条都不写，写进
 * `workbench.js` 的 spec 与 `view.js` 的渲染函数里才有判据可咬。理由与 §6.0 那条分工同源：
 * 入口是唯一知道"这一页有哪些面板、前缀是什么"的地方，而这些事实已经由
 * `_data/onlineTools.yml` 在构建期写进 HTML 了，这里再抄一遍就多一处口径。
 *
 * 四条口径：
 *
 * 1. **前缀有两副面孔，各归各管**。`CONTAINER_ID` / `NOTICE_ID` 里那个 `tk` 是**本页自己的
 *    地址**（这一份入口只服务证件页，JSON 页那份用 `jt`，Task 9 用 yml 的 `prefix` 跟它们对账）；
 *    而行为里用的前缀从 `data-tk-prefix` 读，一路传给 `createPanelWorkspace` 与
 *    `createWorkbench`，控件 id 才跟着 §J 的 spec 换得动。
 * 2. **`runGuarded` 晚绑**。`createWorkbench` 在构造时就把 `env.runGuarded` 收进闭包常量，
 *    而能当它的那只 (`createPanelDom().run`) 要等 workbench 交出 renderers 之后才存在——
 *    循环。所以递过去的是一个箭头，它在**调用时**才去 `guard.run` 上取：占位函数永远不可能
 *    被真的调到，因为按钮回调只在 `mount()` 之后才挂得上。
 * 3. **启动失败不装死**。抛出之前尽力把那句话写进 `#tk-notice`（只走 `textContent`），
 *    因为脚本 404 或被人挪到 `<head>` 这类事故，页面看起来跟"禁了脚本"一模一样——正文全在、
 *    按钮按不出东西。给一句能抄下来问人的话，比只在控制台红一次强。容器本身找不到时没地方写，
 *    那就只剩控制台，这也是这一条只写"尽力"的原因。
 * 4. **两条 `<script>` 的先后是硬前提**。`toolkitCore.min.js` 挂 `window.Tk`，入口在它之后；
 *    顺序反了 `Tk` 就是 undefined，所以那一步单独判、单独报（见 `boot` 里那句 `window.Tk`）。
 *
 * 不用 `export`：产物被 `vite.config.js` 的 `iifeWrapPlugin` 包成 `(function(){…})();`，
 * 而它不补 `'use strict'`，入口里留一条顶层 `export` 就是一个语法错误。启动方式与
 * `webLab.js` 同档——脚本排在正文之后，解析到这一行时面板节点已经存在，不接 `DOMContentLoaded`。
 */
import { createWorkbench } from './tools/workbench.js';

/** 容器 id：`tools-idcard.html` 里 `id="{{ tk.prefix }}-workspace"` 在 `prefix: tk` 下的落值 */
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
 * 装配一遍。抛出去的东西由 `start` 负责先写进页面、再原样抛回控制台。
 * @param {object} doc 真 `document`
 * @param {object} win 真 `window`（要 `location` / `history` / `navigator`）
 * @param {object} tk `window.Tk`
 * @returns {object} `createPanelDom().mount()` 的那四个清单
 */
function boot(doc, win, tk) {
  const box = doc.getElementById(CONTAINER_ID);
  if (!box || typeof box.getAttribute !== 'function') {
    throw new RangeError(
      `页面里没有 id="${CONTAINER_ID}" 的容器（或它读不到属性）：两条 <script> 必须排在正文之后，见 tools-idcard.html 末尾那段注释`);
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
    || typeof tk.createPanelDom !== 'function' || !tk.view) {
    throw new RangeError(
      'window.Tk 没挂上来：toolkitCore.min.js 要么 404，要么排在本入口之后，顺序见 tools-idcard.html 末尾');
  }

  const workspace = tk.createPanelWorkspace({
    ids,
    prefix,
    hash: win.location.hash,
    label: label === '' ? undefined : label,
  });
  /** 口径 2 的那个占位：谁真调到它，就是有人在 `mount()` 之前按了按钮 */
  const guard = {
    run: () => {
      throw new RangeError('装配层还没接上 createPanelDom().run，按钮回调跑早了');
    },
  };
  const wb = createWorkbench({
    document: doc,
    Tk: tk,
    prefix,
    runGuarded: (id, fn) => guard.run(id, fn),
    navigator: win.navigator,
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

- [x] **Step 4: 跑绿**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs > /tmp/j4.log 2>&1; echo "exit=$?"
grep -E '^# (tests|pass|fail|duration_ms)|^not ok' /tmp/j4.log
```

Expected：`exit=0`、`# tests 146`、`# pass 146`、`# fail 0`。用例数从 130 到 146 只多 §J 那 16 条，
**一条都不许多**：Step 5 的六十六刀靠 `^not ok \d+ - J\d+` 锚定红的是哪一节，用例名重复或凭空多一条
都会让某一刀的"红了谁"读成假象。同一批新判据是**补在已有用例里**的（J7 加 (i) 档、J8 加位数那一格、
J11 加 `preventDefault` 的两个增量、J13 加④、J16 加换前缀与"容器读不到属性"两档），所以 146 这个数
从头到尾没动过——这是刻意的，见 Step 5 台账末尾那七条"补牙"记录（X10 / X40 / X50 / X55 / X57 / Z5 / Z6，
对应上面那五处判据增量）。`# duration_ms` 本机 12–15s，
随桌面负载漂，**不要**拿它当门禁，门禁只看 `exit=0` 与 `# fail 0`。

**落地实跑 2026-09-27（Step 3 + Step 4）**

Step 3 三块镜像由 `/tmp/t7/extract3.mjs` 按 `scan.mjs` 现扫的围栏行号切片落盘（首行 `/**`、尾行非
围栏、切片内不混围栏、磁盘上已存在就拒写），出来的形状是：`dev/js/toolkitCore.js` **25 行 / 1,837 B**
（md5 `b596d1f66069`）、`dev/js/tools/workbench.js` **1,016 行 / 46,241 B**（`b06466bfc92b`）、
`dev/js/toolIdcard.js` **148 行 / 6,987 B**（`984544971ff6`）。三块都逐字节等于计划里的镜像——
`verify-plan-blocks.mjs` 从此**逐文件**核它们，前提是它们得进 `FILE_TARGETS`：这一格落盘后那道反查
自己喊了三声"漏网镜像"（处置正是"把路径加进清单，不是删那块镜像"），于是清单从 13 条长成 16 条。
这一步是清单反查第一次真正发挥作用：没有它，这三份镜像会像段 2 的 `build-prefix-data.mjs` 那样
静默不核。

Step 4 第一次跑**不绿**：`not ok 136 - J6 下拉按 spec 填充…`，原文 `ReferenceError: SEGMENTS is not
defined`，`# tests 146`、`# pass 145`、`# fail 1`。根因在计划那格 §J 镜像自己身上，不在实现：
J6 第 ③ 档拿 `[...SEGMENTS].sort()` 当"56 段"的对照面，而 §J 的 import 清单里没有 `phone.js` 的
`SEGMENTS`，文件作用域也没有别的同名声明——§F 那一节是**刻意**不引它的（磁盘 3076–3077 行那两行
注释写着"不引 phone.js 的同名派生值"，那里比对的是 §F0 从号段表独立数出来的 `LISTED`）。
所以起草时贴进计划的那一块与产生 §J 证据的那一块不是同一份，这一条判据从没真跑过。

改法取 §F 的口径而不是补一个 import：`LISTED` 就在文件作用域（磁盘 3078 行），它由 §F0 那张表独立
派生，与被测的取数链（`workbench.js` → `phone.js` 的 `SEGMENTS`）**不同源**——同源相比对，装配层
自己拼一份清单也能绿。落地是两处同改、行数不变（③ 那一档的注释一行改写说清为什么用 `LISTED`，
断言里的 `SEGMENTS` 换成 `LISTED`），磁盘与计划镜像各改一次，改完 `verify-plan-blocks.mjs` 仍报
§J"与磁盘逐字节全等"。牙齿没被这次改动削弱：X15（号段分组不查归属）照红 J6，见 Step 5 台账。

改后 `exit=0`、`# tests 146`、`# pass 146`、`# fail 0`——146 这个数与 Expected 一字不差，
一条不多。`# duration_ms` 那"12–15s"是负载重的窗口里量的：同一份判据文件，Task 6 收口那一跑
9,749 ms，本轮两次 4,191 ms / 4,300 ms（当时 `vm.loadavg` 5.29）。这更说明它不能当门禁。

- [x] **Step 5: 自证这 16 条有牙（六十六处变异，逐处记下红了谁）**

三个文件一起改（`workbench.js` / `toolkitCore.js` / `toolIdcard.js`），每刀跑全量、
只认 `^not ok \d+ - J\d+` 那一种红；`# tests` 与基线不等就判"这一档不算证据"——
这个护栏不是形式主义：Task 6 就因为变异脚手架静默不干活（`sed` 退 0 而变异根本没落地）
差点把"判据有效"读成假结论。所以这里不用 `sed`，用 `String.replace` 前后各断言一次：
锚点不在就当场报"锚点没命中，先修脚本再说牙齿"，不给你一次"全绿"的机会。

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
mkdir -p /tmp/t7mut
cat > /tmp/t7mut/mut-j.mjs <<'EOF'
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const CMD = 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs';
const FILES = ['dev/js/tools/workbench.js', 'dev/js/toolkitCore.js', 'dev/js/toolIdcard.js'];
const orig = {};
for (const f of FILES) orig[f] = fs.readFileSync(f, 'utf8');
const md5 = () => FILES.map((f) => {
  try { return execSync(`md5 -q ${f}`, { encoding: 'utf8' }).trim(); } catch { return '?'; }
}).join(' ');
console.log('跑前三文件 md5:', md5());

function run() {
  let out = '';
  try { out = execSync(`${CMD} 2>&1`, { encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  const total = Number((out.match(/^# tests (\d+)/m) || [])[1] ?? -1);
  const reds = [...out.matchAll(/^not ok \d+ - ([A-Z]+\d+)/gm)].map((x) => x[1]);
  return { total, js: reds.filter((r) => r.startsWith('J')), other: reds.filter((r) => !r.startsWith('J')) };
}

const base = run();
if (base.total < 0 || base.js.length || base.other.length) {
  throw new Error(`基线就不对（# tests ${base.total}、红 ${[...base.js, ...base.other].join(' ')}）`);
}
console.log(`基线 # tests ${base.total} 全绿`);

const W = 'dev/js/tools/workbench.js';
const C = 'dev/js/toolkitCore.js';
const E = 'dev/js/toolIdcard.js';

const MUTS = [
  // ── J1 口径 1：空值不写键 ──
  ["X1 valueOf 空串也照样交出去（口径 1 的\"不写键\"没了）", W,
    "    const v = raw.trim();\n    return v === '' ? null : v;",
    "    return raw.trim();"],
  ["X2 sex 无条件写键", W,
    "      const sex = valueOf(panel, 'sex');\n      if (sex) o.sex = sex;",
    "      o.sex = valueOf(panel, 'sex');"],
  ["X3 区划优先级里把县那一档挤掉", W,
    "    if (county) o.areaCode = county;\n    else if (city) o.cityCode = city;",
    "    if (city) o.cityCode = city;"],
  // ── J2 级联 ──
  ["X4 fill 不保留 HTML 里的占位项", W,
    "    const held = el.firstChild && String(el.firstChild.tagName || '') === 'OPTION'\n      ? el.removeChild(el.firstChild) : null;\n    while (el.firstChild) el.removeChild(el.firstChild);\n    if (held) el.appendChild(held);\n    for (const it of items) el.appendChild(makeOption(it));",
    "    while (el.firstChild) el.removeChild(el.firstChild);\n    for (const it of items) el.appendChild(makeOption(it));"],
  ["X5 上游为空时市格照填、永不禁用", W,
    "      fill(el, prov ? cityOptions(prov) : [], !prov);",
    "      fill(el, cityOptions('11'), false);"],
  ["X6 直辖市\"省下直接选县\"那条例外取消", W,
    "      const single = prov && cityOptions(prov).length === 1 ? cityOptions(prov)[0].value : null;",
    "      const single = null;"],
  // ── J3 口径 3 的两条路 ──
  ["X7 缺日期从提示行升级成标坏", W,
    "    if (raw === null || raw === '') throw new FieldError(message);",
    "    if (raw === null || raw === '') throw new RangeError(message);"],
  ["X8 数量越界从提示行升级成标坏", W,
    "      throw new FieldError(`数量应为 1–${GENERATE_MAX} 的整数，现在这格是「${raw}」。`);",
    "      throw new RangeError(`数量应为 1–${GENERATE_MAX} 的整数，现在这格是「${raw}」。`);"],
  ["X9 数量为空时提示行不再报范围", W,
    "      throw new FieldError('数量这一格是空的，填 1–' + GENERATE_MAX + ' 之间的整数。');",
    "      throw new FieldError('数量这一格是空的。');"],
  ["X10 位数越界静默当没填", W,
    "    if (!Number.isInteger(n) || n < min || n > max) {\n      throw new FieldError(`${label}应为 ${min}–${max} 的整数，现在这格是「${raw}」。`);\n    }\n    return n;",
    "    return Number.isInteger(n) && n >= min && n <= max ? n : null;"],
  // ── J6 下拉按 spec 填充 ──
  ["X11 常用行别那一组也包进 optgroup", W,
    "        { label: '', items: TOP_BANKS.map((b) => ({ value: b.code, label: `${b.name}（${b.binCount} 条 BIN）` })) },",
    "        { label: '常用行别', items: TOP_BANKS.map((b) => ({ value: b.code, label: `${b.name}（${b.binCount} 条 BIN）` })) },"],
  ["X12 行别标签丢掉 BIN 条数", W,
    "        { label: '', items: TOP_BANKS.map((b) => ({ value: b.code, label: `${b.name}（${b.binCount} 条 BIN）` })) },",
    "        { label: '', items: TOP_BANKS.map((b) => ({ value: b.code, label: b.name })) },"],
  ["X13 字符集每一格都标\"默认\"", W,
    "        label: ch === dflt ? `${ch}（默认）` : ch,",
    "        label: `${ch}（默认）`,"],
  ["X14 运营商标签丢掉号段数", W,
    "      fill(el, CARRIERS.map((c) => ({ value: c.carrier, label: `${c.carrier}（${c.count} 个号段）` })));",
    "      fill(el, CARRIERS.map((c) => ({ value: c.carrier, label: c.carrier })));"],
  ["X15 号段分组不查归属（每组都塞同一批）", W,
    "        items: SEGMENTS.filter((s) => carrierOfSegment(s) === c.carrier).map((s) => ({ value: s, label: s })),",
    "        items: SEGMENTS.slice(0, 5).map((s) => ({ value: s, label: s })),"],
  // ── J4 #random 四档 kind ──
  ["X16 kind 格空值不再回落第一项", W,
    "    const raw = valueOf(panel, cfg.kindFrom) ?? firstValueOf(panel, cfg.kindFrom);",
    "    const raw = valueOf(panel, cfg.kindFrom);"],
  ["X17 非法 kind 塌成提示行而不是标坏", W,
    "      throw new RangeError(`#random 的 kind 格取到「${String(raw)}」，spec 里只认 ${Object.keys(cfg.kindMap).join(' / ')}`);",
    "      throw new FieldError(`#random 的 kind 格取到「${String(raw)}」，spec 里只认 ${Object.keys(cfg.kindMap).join(' / ')}`);"],
  ["X18 四档 kind 共用 name 那一套键", W,
    "    Object.assign(o, { name: nameOptions, address: addressOptions, email: emailOptions, profile: profileOptions }[kind](panel));",
    "    Object.assign(o, nameOptions(panel));"],
  // ── J5 读侧 ──
  ["X19 行号改成顺序号（空行不再占号）", W,
    "      if (raw.trim() !== '') kept.push({ no: i + 1, raw });",
    "      if (raw.trim() !== '') kept.push({ no: kept.length + 1, raw });"],
  ["X20 空行既占号又占位", W,
    "      if (raw.trim() !== '') kept.push({ no: i + 1, raw });",
    "      kept.push({ no: i + 1, raw });"],
  ["X21 超出上限照样全画", W,
    "    const shown = kept.slice(0, MAX_READ_LINES);",
    "    const shown = kept;"],
  ["X22 粘贴框不再吞 \\r", W,
    "    return String(typeof el.value === 'string' ? el.value : '').replace(/\\r\\n?/g, '\\n');",
    "    return String(typeof el.value === 'string' ? el.value : '');"],
  // ── J15 整栏口径 ──
  ["X23 整栏口径排到逐行结果之前", W,
    "    paint(panel, 'read', `<div class=\"tk-lines\">${parts.join('')}</div>`\n      + view.noteLines([...hoisted, ...READ_NOTES[kind]]).join(''));",
    "    paint(panel, 'read', view.noteLines([...hoisted, ...READ_NOTES[kind]]).join('')\n      + `<div class=\"tk-lines\">${parts.join('')}</div>`);"],
  ["X24 整栏通用句压根不摘（每行一遍）", W,
    "    const specs = BATCH_NOTES[kind];",
    "    const specs = undefined;"],
  ["X25 摘了但不去重", W,
    "            if (!hoisted.includes(s.text)) hoisted.push(s.text);",
    "            hoisted.push(s.text);"],
  ["X26 生成侧口径行清空", W,
    "    paint(panel, 'gen', view.batchBlock(kind, rows, GEN_NOTES[kind]));",
    "    paint(panel, 'gen', view.batchBlock(kind, rows, []));"],
  ["X27 读侧那条常量口径（REFERENCE_NOTE）不再补", W,
    "      + view.noteLines([...hoisted, ...READ_NOTES[kind]]).join(''));",
    "      + view.noteLines([...hoisted]).join(''));"],
  // ── J14 转义与源码红线 ──
  ["X28 提示行不过 esc", W,
    "    paint(panel, side, `<p class=\"${HINT_CLASS}\">${view.esc(message)}</p>`);",
    "    paint(panel, side, `<p class=\"${HINT_CLASS}\">${message}</p>`);"],
  ["X29 原样回显不过 esc", W,
    "        + `<span class=\"tk-line__raw\">${view.esc(row.raw)}</span></p>`",
    "        + `<span class=\"tk-line__raw\">${row.raw}</span></p>`"],
  ["X30 按钮改口走 innerHTML（第二处 HTML 出口）", W,
    "    btn.textContent = text;\n    later(() => { btn.textContent = original; }, ms);",
    "    btn.innerHTML = text;\n    later(() => { btn.innerHTML = original; }, ms);"],
  ["X31 找节点改走 querySelector", W,
    "  const node = (id) => doc.getElementById(id);",
    "  const node = (id) => (doc.querySelector ? doc.querySelector('#' + id) : doc.getElementById(id));"],
  ["X32 workbench 里 import 共享模块（共享 chunk 那条坑回来了）", W,
    "export const MAX_READ_LINES = 50;",
    "import { createPanelWorkspace } from './panel.js';\n\nexport const MAX_READ_LINES = 50;"],
  // ── J9 派生 id 与清单 ──
  ["X33 控件 id 形状换序", W,
    "  return `${prefix}-in-${panel}-${control}`;",
    "  return `${prefix}-${panel}-in-${control}`;"],
  ["X34 结果区 id 形状换序", W,
    "  return `${prefix}-out-${panel}-${side}`;",
    "  return `${prefix}-${panel}-out-${side}`;"],
  ["X35 controlIds 不再导出 when 那一组", W,
    "    if (sw) for (const t of sw.targets) got.when.push(whenId(prefix, panel, t.key));",
    "    if (sw) for (const t of sw.targets) void t;"],
  ["X36 MAX_READ_LINES 与 GENERATE_MAX 脱钩", W,
    "export const MAX_READ_LINES = 50;",
    "export const MAX_READ_LINES = 40;"],
  // ── J10 换前缀 ──
  ["X37 fieldId 把前缀写死成 tk", W,
    "  return `${prefix}-in-${panel}-${control}`;",
    "  return `tk-in-${panel}-${control}`;"],
  // ── J11 事件接线 ──
  ["X38 Enter 不接日期格", W,
    "        if (c.type === 'number' || c.type === 'date') {",
    "        if (c.type === 'number') {"],
  ["X39 裸 Enter 也触发判定（吞掉换行）", W,
    "    if (!evt || evt.key !== 'Enter' || !(evt.ctrlKey || evt.metaKey)) return;",
    "    if (!evt || evt.key !== 'Enter') return;"],
  ["X40 组合键 Enter 不拦默认动作", W,
    "    if (typeof evt.preventDefault === 'function') evt.preventDefault();\n    runGuardedRun(panel, 'read');",
    "    runGuardedRun(panel, 'read');"],
  ["X41 数字格 Enter 带修饰键也接", W,
    "    if (!evt || evt.key !== 'Enter' || evt.shiftKey || evt.ctrlKey || evt.metaKey || evt.altKey) return;",
    "    if (!evt || evt.key !== 'Enter') return;"],
  ["X42 级联控件不接 change（下游不再重建）", W,
    "        if (c.cascade || c.options || c.charsets) {",
    "        if (c.options || c.charsets) {"],
  ["X43 开关控件不接 change", W,
    "        } else if (c.switch) {\n          el.addEventListener('change', () => applySwitch(panel));\n        }",
    "        }"],
  // ── J8 隔离与 runGuarded ──
  ["X44 按钮绕开 runGuarded", W,
    "      if (genBtn) genBtn.addEventListener('click', () => runGuardedRun(panel, 'gen'));",
    "      if (genBtn) genBtn.addEventListener('click', () => renderNow(panel, 'gen'));"  ],
  ["X45 非 FieldError 也咽进提示行（一块塌了没人知道）", W,
    "      if (!err || err.isField !== true) throw err;",
    "      if (!err) throw err;"],
  ["X46 提示行不清空可复制文本", W,
    "    copies.set(key(panel, side), '');\n    syncCopy(panel, side);",
    "    syncCopy(panel, side);"],
  ["X47 没有可复制文本时按钮照样可用", W,
    "    btn.disabled = (copies.get(key(panel, side)) || '') === '';",
    "    btn.disabled = false;"],
  // ── J7 复制三级兜底 ──
  ["X48 空文本也走一遍复制", W,
    "    if (!btn || text === '') return;",
    "    if (!btn) return;"],
  ["X49 原文案写死成\"复制\"", W,
    "    const original = COPY_LABEL.get(copyId(prefix, panel, side)) || btn.textContent;",
    "    const original = '复制';"],
  ["X50 失败与成功用同一个恢复时长", W,
    "    const done = (ok) => flash(btn, ok ? '已复制' : '复制失败，请手动选中', ok ? COPY_RESET_MS : COPY_FAIL_MS, original);",
    "    const done = (ok) => flash(btn, ok ? '已复制' : '复制失败，请手动选中', COPY_RESET_MS, original);"],
  ["X51 clipboard 拒绝时不回退第二级", W,
    "        p.then(() => done(true), () => done(legacyCopy(doc, text)));",
    "        p.then(() => done(true), () => done(false));"],
  ["X52 writeText 同步抛错不再兜底", W,
    "      try {\n        p = Promise.resolve(clipboard.writeText(text));\n      } catch {\n        p = null;\n      }",
    "      p = Promise.resolve(clipboard.writeText(text));"],
  ["X53 临时框用完不摘", W,
    "    if (ta) doc.body.removeChild(ta);\n",
    ""],
  ["X54 临时框不标 readonly", W,
    "    box.setAttribute('readonly', 'readonly');\n",
    ""],
  ["X55 execCommand 不存在时当成功", W,
    "    return typeof doc.execCommand === 'function' ? Boolean(doc.execCommand('copy')) : false;",
    "    return typeof doc.execCommand === 'function' ? Boolean(doc.execCommand('copy')) : true;"],
  // ── J13 骨架缺一格 ──
  ["X56 缺结果区不再抛（悄悄什么都不画）", W,
    "    const out = node(outId(prefix, panel, side));\n    if (!out) throw new RangeError(`页面里没有 id=\"${outId(prefix, panel, side)}\" 的结果区`);",
    "    const out = node(outId(prefix, panel, side));\n    if (!out) return out;"],
  ["X57 开关目标缺节点就抛（一块缺件牵连整栏）", W,
    "      const el = node(whenId(prefix, panel, target.key));\n      if (!el) continue;",
    "      const el = node(whenId(prefix, panel, target.key));"],
  // ── J12 toolkitCore 的挂面 ──
  ["Y1 toolkitCore 少挂 view", C,
    "window.Tk = { createPanelWorkspace, createPanelDom, view };",
    "window.Tk = { createPanelWorkspace, createPanelDom };"  ],
  ["Y2 toolkitCore 顺手多挂一只", C,
    "window.Tk = { createPanelWorkspace, createPanelDom, view };",
    "window.Tk = { createPanelWorkspace, createPanelDom, view, createWorkbench: null };"  ],
  ["Y3 toolkitCore 里出现顶层 export", C,
    "window.Tk = { createPanelWorkspace, createPanelDom, view };",
    "export const TK_VERSION = 'tk1';\nwindow.Tk = { createPanelWorkspace, createPanelDom, view };"  ],
  // ── J16 入口 ──
  ["Z1 晚绑的 guard.run 不接上（按钮回调跑进占位函数）", E,
    "  guard.run = dom.run;\n",
    ""],
  ["Z2 启动失败不写提示行（装死）", E,
    "      el.hidden = false;\n",
    ""],
  ["Z3 启动失败只往页面写一句，不再抛回控制台", E,
    "    throw err;\n  }\n}\n\nstart(document, window);",
    "  }\n}\n\nstart(document, window);"],
  ["Z4 data-tk-ids 里的空项不丢", E,
    "  return String(raw || '').split(',').map((s) => s.trim()).filter((s) => s !== '');",
    "  return String(raw || '').split(',').map((s) => s.trim());"],
  ["Z5 行为前缀不读骨架，写死 tk", E,
    "  const prefix = String(box.getAttribute(ATTR.prefix) || '').trim() || 'tk';",
    "  const prefix = 'tk';"],
  ["Z6 容器读不到属性时不判（TypeError 从入口跑出去）", E,
    "  if (!box || typeof box.getAttribute !== 'function') {",
    "  if (!box) {"],
];

for (const [name, file, a, b] of MUTS) {
  if (!orig[file].includes(a)) { console.log(`!! ${name} 锚点没命中，先修脚本再说牙齿`); continue; }
  fs.writeFileSync(file, orig[file].replace(a, b));
  const r = run();
  fs.writeFileSync(file, orig[file]);
  if (r.total !== base.total) { console.log(`!! ${name} 只跑到 ${r.total} 条（基线 ${base.total}），这一档不算证据`); continue; }
  const other = r.other.length ? `｜非 J 红：${r.other.join(' ')}` : '';
  console.log(`${name}\n    → ${r.js.length ? r.js.join(' ') : '全绿（不可达）'}${other}`);
}
for (const f of FILES) {
  if (fs.readFileSync(f, 'utf8') !== orig[f]) throw new Error(`还原失败：${f}`);
}
console.log('三文件已还原，跑后 md5:', md5());

EOF
node --check /tmp/t7mut/mut-j.mjs && echo "harness 语法 ok"
cd /Users/liaolongdong/code/liaolongdong.github.io
node /tmp/t7mut/mut-j.mjs > /tmp/t7mut/journal.log 2>&1; echo "exit=$?"
head -2 /tmp/t7mut/journal.log
grep -c -E '^[XYZ][0-9]+ ' /tmp/t7mut/journal.log
grep '^!!' /tmp/t7mut/journal.log
grep '全绿' /tmp/t7mut/journal.log
tail -1 /tmp/t7mut/journal.log
```

五条命令各管一件事，顺序不能并：`node --check` 只保证脚本本身能跑（Task 6 那回 `sed` 静默不干活，
脚本"跑成功"了而变异一次都没落地）；`exit=` 是这一轮的全局判定；`head -2` 读的是"跑前三文件 md5"
与"基线 `# tests 146` 全绿"——基线不绿就没有"牙齿"这回事，harness 会在那一行之前抛出去；
`grep -c -E '^[XYZ][0-9]+ '` 要等于 **66**（少一刀就是有一档被 `continue` 掉了）。
**这一条是落地时改的**：原来写的是不带 `-E` 的 `'^[XYZ][0-9] '`，BRE 里 `[0-9] ` 要求"一位数字
紧跟一个空格"，于是 X10 以后全数不上，本机实跑回的是 **18**（X1–X9 / Y1–Y9 / Z1–Z9）——
一个"少了一大半年轮次还退 0"的计数器，比没有更坏，这是"脚手架静默说谎"的第 11 种形状。
`grep '^!!'` 要 **无输出**（有输出＝锚点没命中或那一档只跑到别的用例数）；`grep '全绿'` 只许两行：
基线那一句，加 X2 的结果行（别的刀出现全绿＝那一档没牙）；
`tail -1` 要逐字回显"三文件已还原，跑后 md5:" 加那三个基线 md5。

台账表**不由手抄**，由日志生成：

```bash
cat > /tmp/pfx/t7/make-ledger.mjs <<'EOF'
import fs from 'node:fs';

const J = fs.readFileSync('/tmp/t7mut/journal.log', 'utf8').split('\n');
const rows = [];
let cur = null;
for (const line of J) {
  if (/^[XYZ]\d+ /.test(line)) {
    cur = { name: line.trim(), reds: null };
    rows.push(cur);
  } else if (/^    → /.test(line) && cur) {
    cur.reds = line.slice(6).trim();
  }
}
if (rows.some((r) => r.reds === null)) throw new Error('有档位没有结果行');

// 与 harness 里声明的 MUTS 条数对账：缺一刀就不出表，免得把"没跑"读成"没红"
const src = fs.readFileSync('/tmp/t7mut/mut-j.mjs', 'utf8');
const declared = [...src.matchAll(/^\s*\["([XYZ]\d+) /gm)].map((m) => m[1]);
const ran = rows.map((r) => r.name.split(' ')[0]);
const missing = declared.filter((d) => !ran.includes(d));
const extra = ran.filter((r) => !declared.includes(r));
if (missing.length || extra.length) {
  throw new Error(`台账与脚本对不上：声明 ${declared.length}、实跑 ${ran.length}；缺 ${missing} 多 ${extra}`);
}

const out = [`<!-- 由 make-ledger.mjs 从 journal.log 生成；实跑 ${rows.length} 刀，前两列是日志原文 -->`];
for (const r of rows) {
  const id = r.name.split(' ')[0];
  const desc = r.name.slice(id.length + 1);
  const reds = r.reds.startsWith('全绿') ? '**全绿（等效，见下）**' : `**${r.reds} 红**`;
  out.push(`| \`${id} ${desc}\` | ${reds} |  |`);
}
const counts = {};
for (const r of rows) for (const j of r.reds.match(/J\d+/g) || []) counts[j] = (counts[j] || 0) + 1;
const byNum = Object.entries(counts).sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)));
out.push(`<!-- 点名次数 ${byNum.map(([k, v]) => `${k}:${v}`).join(' ')}；最少的一条被点名 ${Math.min(...byNum.map((x) => x[1]))} 次；全绿 ${rows.filter((r) => r.reds.startsWith('全绿')).length} 刀 -->`);
fs.writeFileSync('/tmp/pfx/t7/ledger-rows.md', out.join('\n') + '\n');
console.log(`写出 ${rows.length} 行 → /tmp/pfx/t7/ledger-rows.md（声明 ${declared.length} 条）`);
EOF
node /tmp/pfx/t7/make-ledger.mjs
```

`make-ledger.mjs` 只填前两列，第三列"说明"是这一格唯一要人写的东西。**它不许凭记忆写**：
每一行照着 `workbench.js` 里那一处被反改的语句，说清"这样改会把什么变成什么样"，以及
为什么红的是那几条而不是别的。下面这张表最初是 2026-09-27 在 `/tmp/t7` 沙箱里跑出来的（那时磁盘
只有 §A–§I，基线 `# tests 142`）；**落地这一格按磁盘现状把六十六刀整轮重跑了一遍**：基线
`# tests 146` 全绿、66 刀逐刀记录、无一处"锚点没命中"、无一处"只跑到别的用例数"、跑完三文件 md5
与跑前逐字相同。前两列与重跑结果**一字不差**——不是目测：`/tmp/t7/cmp7.mjs` 三方对账（日志 /
`ledger-rows.md` / 这张表），66 行逐行比、红名单连点名顺序一起比，输出 `✓ 66 刀三方一字不差`。
重跑这一轮的点名次数：J1:2 J2:5 J3:9 J4:8 J5:6 J6:6 J7:12 J8:9 J9:4 J10:4 J11:8 J12:3 J13:7
J14:8 J15:7 J16:7——§J 那 16 条判据一条都没被漏掉，最少的是 J1 的 2 次、其次 J12 的 3 次，
草稿那句"每条至少被点名 2 次"与实跑一致；全绿仍只有 X2 那一刀。

| 变异 | 红了谁 | 说明 |
| --- | --- | --- |
| `X1 valueOf 空串也照样交出去（口径 1 的"不写键"没了）` | **J1 J3 J4 J8 J10 J13 J15 J7 红** | `valueOf` 不把空串折成 `null`，空串一路递到六本模块手里各抛各的（`length:''` 与 `givenLength:''` 当场 `TypeError`），挂载期 `bankcard` 与 `random` 双双进 broken；红到 J15 是因为那块塌了以后生成侧一句口径都没落地（日志里 `0 !== 1`），J7 红在按钮被禁用以后三级兜底根本没跑 |
| `X2 sex 无条件写键` | **全绿（等效，见下）** | **等效**：`idcard.js:524` 收到的第一行就是 `const sex = o.sex ?? null`，"键缺失"与"键为 `null`"在消费侧是同一个值，页面上造不出可观测差别。这一族唯一可观测的是"把空串递下去"，那一档由 X1 负责、红八条 |
| `X3 区划优先级里把县那一档挤掉` | **J2 红** | 只红 J2：三级取码的优先序（县 > 市 > 省）是级联那一格的落点，选了县却只传市码，别处不读这个键 |
| `X4 fill 不保留 HTML 里的占位项` | **J2 J6 J11 红** | `fill` 把骨架里的占位项一起冲掉：J2 数省格条数（`31 !== 32`）、J6 比 registry 的取值清单（少了空串那格）、J11 数一次 change 之后的重建条数（`13 !== 14`），三处各读一样东西 |
| `X5 上游为空时市格照填、永不禁用` | **J2 J11 红** | 上游为空照样填下游、且永不禁用："没选省就锁市"那一条整个没了 |
| `X6 直辖市"省下直接选县"那条例外取消` | **J2 红** | 只红 J2：直辖市下辖"市辖区"唯一一条时自动跳过市格那一档——取消它，县格就在等一个永远不会发生的 change |
| `X7 缺日期从提示行升级成标坏` | **J3 红** | 缺日期从 `FieldError` 升级成 `RangeError`：J3 的断言原文就是"把'你少填了个日期'说成'这块面板坏了'是口径 3 禁止的" |
| `X8 数量越界从提示行升级成标坏` | **J8 J14 红** | 同一族的另一格（数量越界）：J8 那句是"「999」这一档的文案对不上"——标坏以后没有 `tk-hint` 那一行；J14 的正则读的是提示行整段 HTML 形状，升级成标坏以后它匹配不上 |
| `X9 数量为空时提示行不再报范围` | **J8 红** | 空数量的提示行不再报范围：只有 J8 读那一句文案 |
| `X10 位数越界静默当没填` | **J8 红** | `intOf` 越界改回 `null`（静默当没填）：提示行那一格整个没了，`tk-count` 反倒画出来——20 位被当成"没填"，用户拿到一批 13–19 位的卡号却不知道自己要过什么。补牙那档，红在 J8 |
| `X11 常用行别那一组也包进 optgroup` | **J6 红** | 常用行别那一组也包进 `optgroup`：第一组按 spec 不该有 label，J6 比的是 option 结构不是文案 |
| `X12 行别标签丢掉 BIN 条数` | **J6 红** | 行别标签丢掉 BIN 条数：下拉里那句"（N 条 BIN）"是 §5.4 要求"查得到多少条"可见的东西 |
| `X13 字符集每一格都标"默认"` | **J6 红** | 字符集每一格都标"（默认）"：只有真默认那一格配得上这个词，标完之后整条下拉没有信息 |
| `X14 运营商标签丢掉号段数` | **J6 红** | 运营商标签丢号段数：X12 的另一本表，同一族口径 |
| `X15 号段分组不查归属（每组都塞同一批）` | **J6 红** | 号段分组不查归属：每个运营商下面都塞同一批五个号段，"按运营商筛号段"这一格变成装饰 |
| `X16 kind 格空值不再回落第一项` | **J1 J3 J4 J8 J10 J13 J15 J7 红** | 与 X1 红得一模一样，因为 `kind()` 那一格上空串与 `null` 落进同一个查表失败：X1 让 `??` 不触发、这一刀让兜底整个不在，剩下的路是同一条（`random` 进 broken） |
| `X17 非法 kind 塌成提示行而不是标坏` | **J4 红** | 非法 kind 改抛 `FieldError`：从"只塌这一块"变成"这一块假装没事、只说一句"，spec 里的取值域不再有人守 |
| `X18 四档 kind 共用 name 那一套键` | **J4 红** | 四档 kind 共用 `nameOptions`：切到地址档，出来的还是姓名 |
| `X19 行号改成顺序号（空行不再占号）` | **J5 红** | 行号改成顺序号：空行不再占号，"第 3 行"对不上用户眼前的第三行 |
| `X20 空行既占号又占位` | **J5 J10 红** | 空行既占号又占位：J5 红在"粘贴框里还没有号码"那一句再也出不来（空行现在占了一格）；J10 红在同一句上——它断言"提示行的类名是样式钩子，不跟着前缀换"，而提示行整段没画 |
| `X21 超出上限照样全画` | **J5 红** | 超出上限照样全画：`slice(0, MAX_READ_LINES)` 摘掉，粘贴 200 行就画 200 行 |
| `X22 粘贴框不再吞 \r` | **J5 红** | 粘贴框不再吞 `\r`：Windows 粘贴每行尾巴挂一个 `\r`，结构合法的号被判成不成立 |
| `X23 整栏口径排到逐行结果之前` | **J15 红** | 整栏口径排到逐行结果之前：§5.4 的顺序是"先答案后解释"，翻过来第一屏全是口径 |
| `X24 整栏通用句压根不摘（每行一遍）` | **J15 红** | 整栏通用句压根不摘（每行一遍）：五行的"前六位是区划"被念五遍 |
| `X25 摘了但不去重` | **J15 红** | 摘了但不去重：同一句话从五块面板各摘一次，栏尾还是五遍 |
| `X26 生成侧口径行清空` | **J15 红** | 生成侧口径行清空：`batchBlock` 第三参给 `[]`，整栏一句口径不剩 |
| `X27 读侧那条常量口径（REFERENCE_NOTE）不再补` | **J15 红** | 读侧那条常量口径不再补：`REFERENCE_NOTE` 那一句（本页所有判定引用的规范口径）没了 |
| `X28 提示行不过 esc` | **J14 红** | 提示行不过 `esc`：那一句会把用户填的那一格原样拼进 HTML |
| `X29 原样回显不过 esc` | **J14 红** | 原样回显不过 `esc`：粘贴框里的任何一行都能变成标签 |
| `X30 按钮改口走 innerHTML（第二处 HTML 出口）` | **J14 J7 红** | 按钮改口走 `innerHTML`：J14 的全节审计数到 3 处 `.innerHTML =`（红线是 1 处）；J7 红在假 DOM 不解析标签、文案读不回"已复制" |
| `X31 找节点改走 querySelector` | **J14 红** | 找节点改走 `querySelector`：派生 id 那套账被绕过，前缀与 spec 两本账从此各说各话 |
| `X32 workbench 里 import 共享模块（共享 chunk 那条坑回来了）` | **J14 红** | `workbench.js` 里 import `./panel.js`：两个入口 reach 同一模块就成共享 chunk，IIFE 产物里留 `import{`、线上白屏——J14 扫的是源文本 |
| `X33 控件 id 形状换序` | **J9 红** | 控件 id 形状换序（`tk-panel-in-ctl`）：骨架、绑定层、装配层三处对不上，只有 J9 逐字比对 id 形状 |
| `X34 结果区 id 形状换序` | **J9 J13 红** | 结果区 id 形状换序：J9 读到 `tk-mobile-out-gen`；J13 那一档专测"缺结果区要标坏"，换序以后它按新形状找到了节点，`broken` 从 `['uscc']` 变成 `[]` |
| `X35 controlIds 不再导出 when 那一组` | **J3 J4 J9 J13 红** | `controlIds` 不再导出 `when` 那一组：J9 的清单断言直接空掉（`[]` vs 那四格）；J3 / J4 / J13 三处的红形状不一样，是 `TypeError: Cannot read properties of null (reading 'hidden')`——判据拿 `ids.when` 里的 id 去找显隐格，清单空了就取到 `null`。这种红是"取不到清单"而不是断言失败，读日志时要认得 |
| `X36 MAX_READ_LINES 与 GENERATE_MAX 脱钩` | **J5 J9 红** | `MAX_READ_LINES` 与 `GENERATE_MAX` 脱钩（50→40）：J5 的"没超上限就别报数"在 41–50 行那一档变红，J9 那句"读侧与生成侧不该各长一个上限"数到 `40 !== 50` |
| `X37 fieldId 把前缀写死成 tk` | **J10 红** | `fieldId` 把前缀写死成 `tk`：换前缀那一轮一个控件都找不到 |
| `X38 Enter 不接日期格` | **J11 红** | Enter 不接日期格：日期格与数字格同权，回车就该触发判定 |
| `X39 裸 Enter 也触发判定（吞掉换行）` | **J11 红** | 裸 Enter 也触发判定：粘贴框里回车换行没了——那是这一格最主要的输入动作 |
| `X40 组合键 Enter 不拦默认动作` | **J11 红** | 组合键 Enter 不拦默认动作：Ctrl / ⌘ + Enter 在 textarea 里既触发判定又插一个换行——补牙那档，红在 J11 的 `preventDefault` 增量计数 |
| `X41 数字格 Enter 带修饰键也接` | **J11 红** | 数字格 Enter 带修饰键也接：X39 的反方向，`Shift+Enter` 在数字格里不该被当提交 |
| `X42 级联控件不接 change（下游不再重建）` | **J2 J11 红** | 级联控件不接 `change`：省格变了市格不重建（J2 数条数 `1 !== 32`，J11 数重建次数 `1 !== 14`） |
| `X43 开关控件不接 change` | **J3 J4 J13 红** | 开关控件不接 `change`：显隐只在挂载期算一次。J3（年龄区间→生日格）、J4（四档 kind 互切）、J13（缺 when 节点那一档）各撞一次 |
| `X44 按钮绕开 runGuarded` | **J3 J4 J8 J11 J14 红** | 按钮绕开 `runGuarded`：抛错直接冲出点击回调。五条红的原文各不相同，正好是这条路径的五个下游——J3「选了「指定出生日期」，就得把出生日期那一格填上。」、J4「kind 格取到「nope」」、J8 模块原文 `RangeError`、J11 计数 `4 !== 5`、J14 那句未经 `esc` 的 `<script>alert(1)</script>` 出现在提示行里（`runGuarded` 才是转义那道闸，绕开它 XSS 出口就回来了） |
| `X45 非 FieldError 也咽进提示行（一块塌了没人知道）` | **J3 J4 J8 红** | 非 `FieldError` 也咽进提示行：`broken` 从 `['idcard']` / `['random']` / `['uscc']` 变成 `[]`——真缺陷被说成"你少填了一格"，隔离那一条口径同时失去名单 |
| `X46 提示行不清空可复制文本` | **J3 J8 红** | 提示行不清空可复制文本：J3 的原文是复制文本仍留着上一批那五条号码（`'430473197905253013\n' + …`），J8 红在按钮 `disabled` 仍为 `false`——页面上说的是"这格填错了"，剪贴板里给的是旧数据 |
| `X47 没有可复制文本时按钮照样可用` | **J3 J5 J8 J7 红** | 没有可复制文本时按钮照样可用：J3 / J5 / J8 三处同形状（`false !== true`，读的就是 `disabled`），J7 那句原文是"判定栏还没内容，按钮是禁用的" |
| `X48 空文本也走一遍复制` | **J7 红** | 空文本也走一遍复制：J7 的原文是 `writeText` 的调用记录多了 `''` 一项——"空文本一次都不该写"，写了就是把用户的剪贴板清一次，而按钮还会闪一句"已复制" |
| `X49 原文案写死成"复制"` | **J7 红** | 原文案写死成"复制"：骨架上那三个字是"复制这批号码"，恢复时把按钮改短了 |
| `X50 失败与成功用同一个恢复时长` | **J7 红** | 失败与成功用同一个恢复时长：失败句要停得更久（2600 vs 1600 ms），补牙那档读的是注入计时器的 `ms` |
| `X51 clipboard 拒绝时不回退第二级` | **J7 红** | clipboard 被拒不回退第二级：权限被拒时用户点了没有任何反应 |
| `X52 writeText 同步抛错不再兜底` | **J7 红** | `writeText` 同步抛错不再兜底：非安全上下文里 `clipboard` 存在而 `writeText` 当场抛，这一档兜的是那句抛 |
| `X53 临时框用完不摘` | **J7 红** | 临时框用完不摘：每复制一次 `body` 里长一个 `textarea` |
| `X54 临时框不标 readonly` | **J7 红** | 临时框不标 `readonly`：选中即触发输入法候选框，焦点从按钮上走掉 |
| `X55 execCommand 不存在时当成功` | **J7 红** | `execCommand` 不存在时当成功：老浏览器里没有 `execCommand` 却报"已复制"，号码哪儿也没去——补牙那档，红在 J7 |
| `X56 缺结果区不再抛（悄悄什么都不画）` | **J13 红** | 缺结果区不再抛：`paint` 静默返回，那一栏什么都画不出来也没人标坏 |
| `X57 开关目标缺节点就抛（一块缺件牵连整栏）` | **J13 红** | 开关目标缺节点就抛：一块 `when` 缺件牵连整栏（`if (!el) continue;` 那一格）——补牙那档，红在 J13 |
| `Y1 toolkitCore 少挂 view` | **J12 J16 红** | `window.Tk` 少挂 `view`：J12 数挂面清单（少一项）；J16 红的是入口自己那句自检——"window.Tk 没挂上来：toolkitCore.min.js 要么 404，要么排在本入口之后" |
| `Y2 toolkitCore 顺手多挂一只` | **J12 红** | 顺手多挂一只：挂面就那三个名字，多一个是下一格再也改不动的债 |
| `Y3 toolkitCore 里出现顶层 export` | **J12 J14 红** | `toolkitCore.js` 里出现顶层 `export`：`iifeWrapPlugin` 不补 `'use strict'` 也不做 code-splitting，入口里的顶层 `export` 在产物里是语法错误——J14 那条源码红线专抓它 |
| `Z1 晚绑的 guard.run 不接上（按钮回调跑进占位函数）` | **J16 红** | 晚绑的 `guard.run` 不接上：按钮回调一直跑在挂载前的占位函数上，点什么都没反应 |
| `Z2 启动失败不写提示行（装死）` | **J16 红** | 启动失败不写提示行：整页白屏装死，`hidden` 那一句没跑 |
| `Z3 启动失败只往页面写一句，不再抛回控制台` | **J16 红** | 启动失败只往页面写一句、不抛回控制台：排查的人只剩一句"出错了"，栈没了 |
| `Z4 data-tk-ids 里的空项不丢` | **J16 红** | `data-tk-ids` 里的空项不丢：`idcard,,uscc` 会造出一块 `tk-panel-` 假面板 |
| `Z5 行为前缀不读骨架，写死 tk` | **J16 红** | 行为前缀不读骨架、写死 `tk`：骨架写 `zx` 而行为仍按 `tk`，控件全找不到——补牙那档，红在 J16 的换前缀两档 |
| `Z6 容器读不到属性时不判（TypeError 从入口跑出去）` | **J16 红** | 容器读不到属性时不判：`getAttribute` 不是函数时 `TypeError` 从入口跑出去，连"页面骨架不对"那句都写不出来——补牙那档，红在 J16 |

**跑法改动：这一格跑在副本树 `/tmp/t7mut/tree` 里，不跑在真仓库。** 计划原来写的是"cd 到仓库、
直接改那三个文件六十六次"，形状上没问题，但此刻真仓库有另一路会话的 `pnpm dev`（`vite build --watch`
+ `jekyll serve`，12:31 起）在跑，而这一格要**连续六分钟真改工作区的三个文件**——对方 deploy 脚本
里那句 `git add .` 只要落在任意一刀上，就能把改到一半的 `workbench.js` 吞进一次提交。所以：
`dev` / `scripts` / `demo` / `assets` / `_data` / `package.json` 整份 `cpSync` 出来，先在副本里跑
基线（146 全绿才开刀，副本不绿这一轮全是假证据），再把脚本里第二条 `cd` 换成副本路径，其余一字未动。
代价是零：harness 自己那两道护栏（跑前 md5、跑后逐文件比对还原）在副本里照样成立，而副本落定后
三个文件与真仓库 md5 逐字相同（`b06466bfc92b…` / `b596d1f66069…` / `984544971ff6…`），"这一格没在真仓库留痕"
就是这么证的。日志留在 `/tmp/t7mut/journal.log`（135 行 = 2 行抬头 + 66×2 行逐刀 + 1 行还原）。

还有一处只在这一步露出来的：**Step 4 那次 `SEGMENTS` → `LISTED` 没削弱任何一刀**。X15（号段分组
不查归属）照红 J6，而点 J6 的六刀（X4 / X11 / X12 / X13 / X14 / X15）与草稿表逐字相同——换的是
对照面的来源，不是判据的形状。第三列"说明"这一格逐行复核过（照着磁盘上被反改的那一处读），
未改一字。

- [x] **Step 6: 记一次产物体积（§7 的预算要在这一格判，不许拖到收口）**

这一格是段 2 里第一个"产物已经存在"的时刻，所以三条产物口径在这儿一次立起来：`import{` 必须为 0
（共享 chunk 那条事故的红线）、预算按 **gzip** 算（不是 brotli）、四本数据的边际成本要能被复算。

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
npx vite build > /tmp/t7build.log 2>&1; echo "build exit=$?"
grep -o 'import{' assets/js/*.min.js | wc -l
ls -l assets/js/toolIdcard.min.js assets/js/toolkitCore.min.js
for f in assets/js/toolIdcard.min.js assets/js/toolkitCore.min.js; do
  printf '%-34s raw=%-8s gz=%s\n' "$f" "$(wc -c < $f | tr -d ' ')" "$(gzip -9 -c $f | wc -c | tr -d ' ')"
done
```

Expected：`build exit=0`；`import{` 命中数 **0**（这一条挂了就是白屏，构建 exit=0 也救不了）；
两件产物 **raw 202,324 / gz 70,991**（`toolIdcard.min.js` 184,221 / 64,408，
`toolkitCore.min.js` 18,103 / 6,583）。`toolkit.min.css` 这一件在 Task 8 才存在，本格不计。

**为什么预算按 gzip 算**：2026-09-26 实测线上 `/better-blog/` 的响应头是
`Content-Encoding: gzip` + `Vary: Accept-Encoding`，同一份 2,216 B 的产物线上回 942 B——
GitHub Pages 不发 brotli。同机同产物按 brotli-11 量是 56,610 B，看着"达标"，线上不走这一档。

四本数据的边际成本用**清空数据 → 重建 → 量**来测，不靠读源文件字节猜（源文件 100 KB 的区划表
进了产物只剩 34 KB gzip，差 3 倍，猜不得）。脚本在下面，跑在 `/tmp/t7` 镜像上——
`dev/js/tools/region-data.js`、`dev/js/tools/bank-bin-data.js`、`dev/js/tools/carrier-data.js`
在真仓库的禁改清单里，只有镜像可以动，且每档量完立刻还原、跑完与真仓库比 md5。

```bash
mkdir -p /tmp/pfx/t7 && cat > /tmp/pfx/t7/measure-gzip.py <<'PYEOF'
#!/usr/bin/env python3
"""量证件页三件产物里"四本数据"各自的 gzip 边际成本——只在 /tmp/t7 镜像里改数据文件。

口径写在三处，改了要一起改：
  · gzip 一律 `gzip -9 -c`（GitHub Pages 只发 gzip、不发 brotli，09-26 实测过线上
    `Content-Encoding: gzip`，所以 brotli 那本账不参与判定，这里干脆不量）。
  · 每一档跑完 `npx vite build` 立刻断言 exit=0：09-26 栽过一次——脚本中途死掉，
    磁盘上留着上一轮的产物，读到的尺寸是假的。
  · 三个数据文件（region-data.js / bank-bin-data.js / carrier-data.js）在真仓库里是
    禁改清单，这里全部按"读原文 → 改镜像 → 还原 → 与真仓库比 md5"走，最后一档必须
    重建满数据并断言它的 gzip 与第一档逐字节相同，否则这份表连"现场已复原"都没证据。
"""
import re, subprocess, hashlib, json, os, sys

M = '/tmp/t7'
REAL = '/Users/liaolongdong/code/liaolongdong.github.io'
ART = ['assets/js/toolIdcard.min.js', 'assets/js/toolkitCore.min.js', 'assets/css/toolkit.min.css']
DATA = ['dev/js/tools/region-data.js', 'dev/js/tools/bank-bin-data.js', 'dev/js/tools/carrier-data.js']


def md5(root, p):
    return hashlib.md5(open(os.path.join(root, p), 'rb').read()).hexdigest()


def sizes():
    per, tot = {}, 0
    for a in ART:
        b = open(os.path.join(M, a), 'rb').read()
        gz = len(subprocess.run(['gzip', '-9', '-c'], input=b, capture_output=True).stdout)
        per[a] = (len(b), gz)
        tot += gz
    return per, tot


def build(tag):
    p = subprocess.run(['npx', 'vite', 'build'], cwd=M, capture_output=True, text=True)
    if p.returncode != 0:
        print(f'!! {tag} build exit={p.returncode}\n{p.stdout[-1200:]}\n{p.stderr[-600:]}')
        sys.exit(1)
    per, tot = sizes()
    raw = sum(per[a][0] for a in ART)
    print(f'{tag:20s} gz={tot:>7,} raw={raw:>8,}  ' + '  '.join(f'{os.path.basename(a)}={per[a][0]:,}/{per[a][1]:,}' for a in ART))
    return per, tot


orig = {d: open(os.path.join(M, d), encoding='utf8').read() for d in DATA}
# region-data.js 在真仓库里（段 1 交付、禁改清单上）→ 与真仓库比 md5；
# 另两张码表是段 2 才产生的文件，真仓库里还没有 → 只与本轮读到的原文比
real = {d: (md5(REAL, d) if os.path.exists(os.path.join(REAL, d)) else md5(M, d)) for d in DATA}


def put(d, text):
    open(os.path.join(M, d), 'w', encoding='utf8').write(text)


def restore(d):
    put(d, orig[d])
    assert md5(M, d) == real[d], f'{d} 还原后与真仓库不一致'


R = ['RAW_PROVINCES', 'RAW_CITIES', 'RAW_COUNTIES', 'RAW_HISTORICAL']


def blank_region(src, names):
    out, n = src, 0
    for nm in names:
        out, k = re.subn(rf"(export const {nm} = )'(.*?)(';)", r'\1\3', out, flags=re.S)
        n += k
    assert n == len(names), f'区划字段锚点命中 {n}/{len(names)}'
    return out


def blank_region(src, names):
    """把指定的 RAW_* 换成**空串字面量**。注意：`\\1\\3` 这种回写会把开引号一起丢掉，
    产物变成 `= ';` 的语法错误——构建当场 exit 1，读到的是上一轮的旧产物（09-26 栽过一次）。"""
    out, n = src, 0
    for nm in names:
        out, k = re.subn(rf"(export const {nm} = )'(.*?)(';)", r"\1'';", out, flags=re.S)
        n += k
    assert n == len(names), f'区划字段锚点命中 {n}/{len(names)}'
    return out


try:
    full_per, full = build('full')

    # 1) 四本区划原始串全空 → 区划这一本的边际
    put('dev/js/tools/region-data.js', blank_region(orig['dev/js/tools/region-data.js'], R))
    _, no_region = build('no-region')
    restore('dev/js/tools/region-data.js')

    # 2) 只空历史层 → 历史那一段的边际（撤销建制的旧码，覆盖 1980s–2000s 的老证号）
    put('dev/js/tools/region-data.js', blank_region(orig['dev/js/tools/region-data.js'], ['RAW_HISTORICAL']))
    _, no_hist = build('no-historical')
    restore('dev/js/tools/region-data.js')

    # 3) BIN 表清空（BANKS 是行名册、BIN_ROWS 是区间表，两串同源，一起去掉才是"这张表的成本"）
    sB, k1 = re.subn(r"export const BANKS = \[.*?\n\];", "export const BANKS = [];",
                     orig['dev/js/tools/bank-bin-data.js'], flags=re.S)
    sB, k2 = re.subn(r"(export const BIN_ROWS = )'(.*?)(';)", r"\1'';", sB, flags=re.S)
    assert k1 == 1 and k2 == 1, (k1, k2)
    put('dev/js/tools/bank-bin-data.js', sB)
    _, no_bank = build('no-bankbin')
    restore('dev/js/tools/bank-bin-data.js')

    # 4) 运营商号段表清空
    sC, k3 = re.subn(r"export const CARRIER_SEGMENTS = \[.*?\n\];", "export const CARRIER_SEGMENTS = [];",
                     orig['dev/js/tools/carrier-data.js'], flags=re.S)
    assert k3 == 1, k3
    put('dev/js/tools/carrier-data.js', sC)
    _, no_car = build('no-carrier')
    restore('dev/js/tools/carrier-data.js')

    # 5) 三本数据一起清空 → "四本之外"直接量，不靠可加性折算
    put('dev/js/tools/region-data.js', blank_region(orig['dev/js/tools/region-data.js'], R))
    put('dev/js/tools/bank-bin-data.js', sB)
    put('dev/js/tools/carrier-data.js', sC)
    _, no_data = build('no-data')
finally:
    for d in DATA:
        restore(d)

# 6) 现场复原，重建满数据那一版并逐字节比
_, after = build('full-after-restore')
assert after == full, f'最终产物与首轮满数据不一致：{after} != {full}'

print(json.dumps({
    '满数据_gz': full,
    '区划边际': full - no_region,
    '其中历史层': full - no_hist,
    '去历史层后': no_hist,
    'BIN表边际': full - no_bank,
    '号段表边际': full - no_car,
    '三本合计': full - no_data,
    '四本之外_直接量': no_data,
    '边际相加': (full - no_region) + (full - no_bank) + (full - no_car),
    'per件': {os.path.basename(a): full_per[a] for a in ART},
    '预算_60KiB': 61440,
    '超': full - 61440,
    '去历史层余量': 61440 - no_hist,
}, ensure_ascii=False, indent=1))
PYEOF
cp /tmp/pfx/t7/measure-gzip.py /tmp/pfx/t7/measure-gzip.run.py
cd /tmp/t7 && python3 /tmp/pfx/t7/measure-gzip.run.py
```

2026-09-27 镜像实跑（七次 `npx vite build` 全部 exit=0，跑完三件数据文件 md5 与真仓库逐字相同，
末档 `full-after-restore` 与首档 `full` 的 gzip **逐字节相同**才敢出表）。表里那一列是脚本打的
**三件合计**（镜像里 `dev/sass/toolkit.scss` 已经存在，所以 CSS 那一件 2,110 B 在数里；真仓库的
Task 7 只有两件，所以第一段命令量到的是 70,991 = 73,101 − 2,110）：

| 档 | 三件合计的 gz | 相对满数据 |
| --- | --- | --- |
| 满数据 | 73,101 | — |
| 四本区划串全空 | 38,788 | **区划 −34,313** |
| 只空历史层 | 60,881 | **历史层 −12,220** |
| 清空 BIN 表 | 61,871 | **BIN −11,230** |
| 清空号段表 | 72,914 | **号段 −187** |
| 三本一起空 | 27,230 | **数据合计 −45,871** |

三个数论值得留在这儿：

1. **边际近似可加**：34,313 + 11,230 + 187 = 45,730，与"三本一起空"直接量的 45,871 差 **141 B**
   （0.3%）。差得这么小是因为这四本表是各自独立的高熵串；如果哪一天这个差变成几千字节，
   说明有代码被连带摇掉了，这张表就要重读一遍。
2. **号段表 1,239 字节源文件只值 187 B gzip**，区划表 100,020 字节源文件值 34,313 B——
   预算的敌人只有区划那一本，别在码表上抠字节。
3. **历史层那一档值 12,220 B**：去掉它，三件合计是 **60,881 B** gzip（两件 JS 是 58,771 B，
   加 CSS 2,110 B），距 §7 那条 61,440 B（60 KiB）只剩 **559 B** 余量。

**判据落在预算上就是超了，本格不许自行改预算。** §7 写的是证件页 JS + CSS ≤ 60KB：
本格两件 JS 已经 70,991 B，加 CSS 2,110 B 是 **73,101 B，超 11,661 B（19%）**。
按 Task 1 立的 BLOCKED 协议停下来交回去，三个处置：

- **(a) 把 §7 这一条按实测改写成 ≤ 76KB**（推荐）。559 B 余量的判据会被压缩器抖动抖翻——
  换 Node 小版本、terser 升一行都会红，那正是 §7 自己写过的失效模式。改口径保住的是
  "0 网络请求"与区划全周期覆盖两件实打实的价值。
- **(b) 把历史层拆成第二支延迟注入的 script**：60,881 B 卡进预算，代价是"本页 0 网络请求"那句
  文案要改、撤销区划的首判要等一支脚本，且多一次请求。
- **(c) 砍掉历史区划解析**：产品损失——1980s–2000s 的老证号解不出出生地，那是本页相对同类
  工具的主要差异点。

选 (a) 的话，落点是 `_docs/superpowers/specs/2026-09-25-blog-online-tools-design.md` §7 那一行
与它下面新写的实测段，改完把本格的数字回写进 spec；选 (b) 则 Task 8 的骨架多一条 script 标签、
`toolIdcard.js` 的入口自检要改成"两支都在或都不在"，本格与 Task 8 都得返工。

> **2026-09-27 拍板：处置 (a) 已执行，功能一项不减。** spec §7 那一行现在是
> `证件页 JS+CSS | gzip ≤ 76KB（2026-09-27 按实测算钉）`，并且**多立了一条**
> `证件页首屏关键路径 | gzip ≤ 16KB`（实测 15,442B = CSS 2,110 + 页面 HTML 13,332，
> 禁 JS 也读得到五块面板的整页正文）；两条的实测段与非加和性、抖动余量论证写在 §7 表格下面。
> 76KB = 77,824B，在 73,101B 之上余 **4,723B（6.5%）**——不是贴着实测写的：同一批三件产物
> gzip level 6↔9 实测差 248B（73,349B ↔ 73,101B），(c) 那档 559B 余量会被这一条抖吃掉 44%。
> 顺带修一处本格原先写错的落点：**段 1 计划里没有引用"证件页 ≤ 60KB"的地方**（它只引用区划表
> 那条 36KB），`grep -n '60KB' _docs/superpowers/plans/2026-09-25-online-tools-foundation.md` 为空。
>
> 这条决定**不改动上面任何一格的实测数**，只改"跟哪个数比"。Task 10 量首屏时按新增的 16KB 那条判，
> 收口（Task 11）时 §7 与 §11 的回填照这一段的数写，别再回到 60KB 口径。
>
> 另有两处仍引着**当时值** "≤ 60KB"，都在 Task 5 那一格里：一处是本格正文的"跨页共享层"论证，
> 一处是随载荷写进 `view.js` 文件头的 JSDoc。两句讲的都不是预算本身，而是"多一条 `import`
> 就顶破"这条红线，在 76KB 下同样成立（那条 `import` 会把区划那本 34,313 B 复制进
> `toolkitCore.min.js`，两件 JS 合计上到十万 B 量级）。**实现期不要动 JSDoc 那一处**：
> 改了要连 `/tmp/t7` 镜像里的 `dev/js/tools/view.js` 一起改，否则"计划载荷 == 镜像落盘"
> 这条一致性断在 Task 5 与 Task 8 之间。两处一起改写成不带数的说法，留给 Task 11 收口那一格。

**2026-09-27 落地实跑（跑在自建镜像 `/tmp/t7mk`，没在真仓库 build）**：上面那两条命令写的是
"cd 到仓库跑 `npx vite build`"，形状没错，但此刻对方会话的 `pnpm dev`（`vite build --watch`，12:31 起）
正盯着 `assets/`，而 `vite.config.js` 的 `outDir` 是 `resolve(__dirname, 'assets')` 加一段
`writeBundle` 里往 `assets/js`、`assets/css` 照抄 `dev/libJs`、`dev/libCss` 的钩子——在这里跑一次
全量构建就是把对方的输出目录清掉重写一次，量到的数还会被对方下一次增量构建覆盖。所以另起一份
`dev` + `package.json` + `vite.config.js` + `postcss.config.js` 的拷贝树（`node_modules` 走软链，
`vite.config.js` 里全是 `__dirname`，不带出仓库路径），开跑前断言 `diff -r dev <镜像>/dev` 为空。
新入口必须靠这种一次性构建才见得到：watch 的 entry 列表是配置加载时定死的，`toolkitCore.js` /
`toolIdcard.js` 是它启动之后才出生的，所以真仓库的 `assets/js/` 里现在没有这两件，**那不是构建坏了**。

```
build exit=0（4.22s，40 modules transformed）
grep -o 'import{' assets/js/*.min.js | wc -l  →  0     # 全量，含照抄进来的 libJs
```

| 件 | raw | gzip -9（stdin 口径） | md5 |
| --- | --- | --- | --- |
| `toolIdcard.min.js` | 184,825 | 64,666 | `c0da44ee0e754a55f19a08b8aca357a6` |
| `toolkitCore.min.js` | 18,103 | 6,583 | `c7da771083fa7073410bf865db46dc03` |
| 合计 | **202,928** | **71,249** | — |

下面那张七档边际表把这两件重建了七次，末档的 md5 与首建逐字相同——产物是确定性的，
所以将来这一格再红，红的是代码，不是压缩器。

**Expected 那三个数（184,221 / 64,408 / 70,991）不是作废，它量的是 04:58 那份草稿。** 差
**+604 raw / +258 gz** 不靠"大概是复核改的吧"交代过去：把 `bankcard.js`、`random-data.js` 回退到
各自的首个提交（`46b0042` 17,159 → 现 21,774；`bbb78ad` 16,581 → 现 17,638，其余三个模块
`git show` 出来逐字节相同）另建 `/tmp/t7old` 重跑，`toolIdcard.min.js` 落在 **184,221 / 64,408**、
`toolkitCore.min.js` 仍是 **18,103 / 6,583**，与 Expected 逐字节相同。这 258 B 全部来自那两次复核
整改（生成侧避开嵌套 BIN 前缀、随机数据的容量口径与 §G 三处补牙），一条不多、一条不少。

顺带把本格自身命令里的一处口径隐患记下来：上面第一段命令写的是 `gzip -9 -c $f`，那是**带 FNAME**
的形态（今天实测 64,684 / 6,602，各比 stdin 口径多 18 B / 19 B）。表里与预算判定用的全部是
`cat $f | gzip -9 -c` 那一份，Task 8 Step 6 的口径段讲的是同一件事。

四本数据的边际成本今天重测（脚本 `/tmp/t7mk-measure.py`，与计划那份 `measure-gzip.py` 只差两处、
都不碰口径：镜像路径换成 `/tmp/t7mk`，`ART` 只列两件 JS——`toolkit.min.css` 还没出生）。七次构建
全部 exit=0，每一档量完立刻还原并与真仓库比 md5，末档 `full-after-restore` 与首档 `full` 逐字节相同：

| 档 | 两件合计的 gz | 相对满数据 |
| --- | --- | --- |
| 满数据 | 71,249 | — |
| 四本区划串全空 | 36,938 | **区划 −34,311** |
| 只空历史层 | 59,028 | **历史层 −12,221** |
| 清空 BIN 表 | 60,024 | **BIN −11,225** |
| 清空号段表 | 71,063 | **号段 −186** |
| 三本一起空 | 25,381 | **数据合计 −45,868** |

与 04:58 那张表逐档比是 −2 / +1 / −5 / −1 / −3（号段那本 1,239 B 的源文件两版之间没动），
可加性交叉检验从差 141 B 变成差 **146 B**（34,311 + 11,225 + 186 = 45,722 对 45,868），
三条结论一项不变：**预算的敌人只有区划那一本，别在码表上抠字节**。

**这张表的第一次跑法作废了，"三本一起空"当时量到 36,748，是个假数。** 原因是脚本跑到 `no-bankbin`
那一档时，我为了让镜像里那三个禁改数据文件"看着跟真仓库一样"而 `cp` 了一次 `bank-bin-data.js`，
正好落在脚本下一次 `put()` 之后、`vite build` 读文件之前——那一档的输入被换回了满数据。
末档那句"与首档逐字节相同"**抓不到它**（现场确实复原了，坏的是中间某一档的输入），抓到它的是同一份
输出里的可加性：边际相加 45,722 对三本合计 34,501 差 **11,221 B**，正好是 BIN 那一本没被扣掉的边际。
留这条是因为它是"脚手架静默说谎"的一个新形状：**自证只覆盖"现场已复原"，不覆盖"每一档的输入没被
旁路"，能覆盖后者的是档与档之间的交叉检验**——所以那张表里的可加性一栏不是装饰，是护栏。

**§7 那条 76KB 在这一格怎么判**：本格只有两件 JS，合计 **71,249 B**；等 Task 8 的
`toolkit.min.css` 出生（04:58 量的是 2,110 B）三件合计约 **73,359 B**，对 77,824 B 余
**4,465 B（5.7%）**——比 04:58 拍板时写下的 4,723 B 少 258 B，仍是 gzip level 6↔9 那 248 B
抖动的 18 倍，判定不变、不重开 BLOCKED。Task 8 落 CSS 之后这一格要照真数重算一次，别拿 4,723 当结论。

- [x] **Step 7: 提交**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
git status --porcelain
git log --oneline -3
git add dev/js/toolkitCore.js dev/js/tools/workbench.js dev/js/toolIdcard.js scripts/toolkit-tests.mjs
git diff --cached --stat
git commit -m "$(cat <<'EOF'
feat(tools): 证件页装配层 workbench.js + 两个入口——§J 十六条与七道补牙

装配层只干四件事：把 spec 里的字段表变成派生 id、把控件按 spec 填上、把一次点击
包进 runGuarded、把 view 产出的 HTML 写进那一格结果区。ARIA 一律不判（Task 6 的
panel-dom 是唯一一处口径），转义一律不走第二次（innerHTML 全文件只出现在 paint()），
跨页共用的东西一律不 import——两个入口 reach 同一模块就会成共享 chunk，IIFE 产物里
留下 import{ 就是白屏，J14 那条源码红线与 Step 6 的 grep 各钉一头。

空值不写键：六本模块收到空串各抛各的，"没选"必须真的是没选（X1 一刀红八条，
X16 从 kind 那一格再撞一次）。FieldError 走提示行、别的一律标坏：越界与没填是两件事，
把前者说成后者是本页最像故障的那种错。复制走三级兜底，最后一级是一句"请手动选中"——
execCommand 不存在时不许当成功（X55），失败提示要比成功停得更久（X50）。

§J 十六条全部补在已有用例里，用例数从 130 到 146 只多这 16 条、一条不许多：六十六刀
靠 `^not ok \d+ - J\d+` 锚定红了谁，多一条重名的用例就会把某一刀的证据读成假象。
65 刀有红、X2 是构造上的等效（消费侧 `o.sex ?? null` 让"缺键"与"键为 null"是同一个值），
曾不可达的七刀（X10 / X40 / X50 / X55 / X57 / Z5 / Z6）各补了一档真实形状，补成的判据增量是五处。

产物口径（stdin `gzip -9`，两件 JS）：71,249 B，四本数据的边际合计 45,868 B（区划 34,311、BIN 11,225、
号段 186），可加性交叉检验差 146 B；`import{` 全量命中 0。算上 Task 8 的 CSS 2,110 B 约 73,359 B，
§7 那条 76KB 余 4,465 B（5.7%）。04:58 拿草稿判出的"超当时 60KB 预算 11,661 B"已按 BLOCKED 协议交回
三个处置——2026-09-27 拍板取 (a)，§7 改写为 ≤76KB 并新立首屏 ≤16KB 一条；今天真产物比草稿多 258 B
（`bankcard.js` 与 `random-data.js` 的两次复核整改，回退重跑逐字节复现过草稿那一版），判定不变。
EOF
)"
git status --porcelain | head
```

Expected：暂存区只有这四条路径（`git diff --cached --stat` 四行），提交完 `git status` 里剩下的
仍是对方会话那批未提交项（`.gitignore` 此刻正 STAGED 在共享索引里——**别裸 `git commit`**，
会把别人暂存的东西吞进这一发；要提就照上面先 `git diff --cached --stat` 看清是谁的）。
`_docs/superpowers/plans/` 里这份计划按 Task 11 的收口节奏单独提。

**2026-09-27 落地实跑（`1f337e5`，五条路径 2,436 行）**：上面那条命令列的是四条，**少了一条**——
`scripts/verify-plan-blocks.mjs` 在本格 Step 3 从 13 条目标改成 16 条（把 `toolkitCore.js` /
`workbench.js` / `toolIdcard.js` 登记进 `FILE_TARGETS`），不提它，干净检出上反查扫描就把这三个
新文件报成漏网镜像、门禁 exit=1（这一形状在 Step 1a 之后红过一次，当时是靠现场改脚本绕过去的，
计划却没跟着把那条路径补进提交清单）。暂存五条、`git diff --cached --stat` 五行、
`git commit -q -m … -- <同一批五条>` 收口：这一发跑之前共享索引是空的（`--cached --stat` 无输出），
但 pathspec 形式照旧写死，因为对方的 `deploy-github.sh` 里那句 `git add .` 随时会落进来。
提交后 `git status --porcelain` 20 项全是对方那批（`.gitignore`、`_config.yml`、
`_data/og_images.yml`、`_data/tools.yml`（品牌改名「文件格式任意转换助手」）、`about.*`、
`package.json`、`scripts/lib/` 与 `spark-output/` 那一圈未跟踪），一项未被本次触碰。
两处新认知的钩子噪音：本仓库装了 `pre-commit` / `prepare-commit-msg` / `commit-msg` 三个钩子，
它们往 stdout 打四行调试信息（"pre-commit hooks can use --no-verify bypass"、`process.cwd()` 之类），
**看着像出错、其实不是**——凭据是 `commit exit=0` 加 `git log --oneline -1` 里那个真 SHA。
提交信息比计划载荷多末段一句（讲的就是第五条路径），其余逐字照计划。
计划文件本身按 Task 11 的节奏另发一发。

## Task 8: 证件页骨架与样式（构建期渲染，禁 JS 也读得到正文）

**Files:**
- Create: `_data/onlineTools.yml`（在线工具清单的单一数据源：slug / 标题 / 前缀 / 面板清单 / 收录状态）
- Create: `assets/img/tools/idcard-tool.svg`（那份 yml 的 `icon:` 指向的图标，Task 9 的下拉是它第一个消费者）
- Create: `tools-idcard.html`（仓库根的骨架，`permalink: /tools/idcard.html`）
- Create: `dev/sass/toolkit.scss`（`.tk-` / `.jt-` 一套样式，只用语义令牌）
- Modify: `postcss.config.js`（`selectorBlackList` 加 `.tk-`、`.jt-` 两条**字符串**）
- 本格**不**新增测试判据：骨架与样式只能由构建产物判，那几条（面板齐不齐 / `.tk-` 有没有被换算成
  vw / `import{` / 两条 script 的先后）全写在 Step 5 的脚本里，Task 9 把它们收进
  `scripts/check-tools-surface.mjs` 变成可重跑的门禁。§J 那十六条判的是 JS 层，产物口径判的是
  磁盘上的字节——两头的判据不许互相顶替，也不许有一头空着。

这一格起，`/tools/idcard.html` 才真的存在于站上。三件事在这一格定死，每件都有"做反了会怎样"：

1. **面板正文由 Liquid 在构建期渲染，不由 JS 造。**（§6.3）禁用脚本与爬虫读到的必须是同一份
   正文，所以五块面板的 `<section id="tk-panel-*">`、每栏的 `<h3>`、说明文字全在 HTML 里；
   JS 只做"把结果写进 `#tk-out-*`"与"把 `role` 覆写成 ARIA 该有的样子"。反过来做（JS 造骨架）
   的后果是：`hidden` 属性还没人写，五块面板在禁 JS 时**同时可见**，那是一张谁也没测过的页面。
   本页不靠 `js` 类名门控正文：显隐只由 `panel-dom.js` 运行期写的 `hidden` 决定，脚本不在时
   `<main>` 区间里只有 `#tk-notice` 那一格带 `hidden`（Step 5 第 3 组判据现算）。
2. **索引条与面板的 ARIA 一个都不写，结果区与表单分组的写死在骨架里。** `role="tablist"` /
   每条 tab 的 `role` / `aria-selected` / `tabindex`、每块 panel 的 `role` / `aria-labelledby` /
   `hidden` 这三张属性表全由 `panel-dom.js` 按 `panel.js` 算好的值覆写（Task 6 立的口径：全站
   唯一一处 ARIA 口径），骨架里连"占位的错值"都不写。写第二遍就是第二处口径，改一处漏一处，
   而漏掉的那一处只在读屏里看得见。§I / §J 的假 DOM 里反倒**必须**预置 `role="link"` /
   `aria-selected="maybe"` 这种错值——那是抓"合并而不是覆写"的样本，判据读的是覆写之后的落值，
   与真骨架什么都不写这两件事不冲突。
   判据必须 **scoped**：整页 `grep role="tab"` 会命中 3 次，但那三次在 288–290 行、属于站点公共件
   `_includes/header.html` 里书架对话框的三个分区按钮，与本页无关。所以 Step 5 数的是
   `<nav class="tk-index">…</nav>` 那一段（必须 0）与五块 `<section class="tk-panel" …>` 的
   起始标签（必须 0）。骨架自己写的只有两类运行时不改的东西：九处 `role="group"`（表单分组，
   配 `aria-labelledby`）与九处 `role="region" aria-live="polite"`（结果区），九个 `#tk-out-*`
   与九个复制按钮一一对应。
   `href="#idcard"` 必须留在每条索引链接上，它是禁 JS 时唯一能跳到某一块面板的保险。
3. **表单不用 `<form>`。** 没有后端可交，`form` 的隐式提交会把整页刷成
   `?tk-in-idcard-count=5`，那是工具页最不像工具的故障。提交动作由 `toolIdcard.js` 监听按钮与
   `Enter` 键（Task 7 口径 4），表格一律用 `div[role=group] + aria-labelledby`。

再加四条这一格特有的：

4. **前缀有两副面孔，yml 只说其中一副。** `_data/onlineTools.yml` 的 `prefix: tk` 是**行为前缀**
   （控件 id 与 `.tk-` 类名的那副）；`toolIdcard.js` 里 `CONTAINER_ID` / `NOTICE_ID` 写死的
   `tk-workspace` / `tk-notice` 是**本页自己的地址**，两副面孔在骨架的 `data-tk-prefix` 那格汇合，
   由入口一次读走（J16 用 `zx` 前缀验的是"行为那副必须整套跟着骨架走"）。所以"前缀只许出现在
   yml"那句是错的，仓库里字面量 `tk` 合法的出现点有三处：yml 的 `prefix` 字段、`toolIdcard.js`
   那两个常量、骨架那四条 `data-tk-*` 属性名——`_data/onlineTools.yml` 的文件头按这个写。
5. **`postcss.config.js` 的黑名单要写字符串，不是正则。** 语义差别是读插件源码定的、也用产物验过
   （Step 4 两头都跑）：`postcss-px-to-viewport@1.1.1` 的 `blacklistedSelector`
   （`node_modules/postcss-px-to-viewport/index.js:130`）对字符串走 `selector.indexOf(s)`
   （子串命中任意位置），对正则走 `selector.match(re)`。本层大量规则的最左选择器是
   `.tk-workspace .tk-col` 这种后代形式，`/^\.tk-/` 一条都盖不住；漏掉的后果与 `about.scss`
   记过的同一种——同一块版面一半按 px 画、一半按 750 设计稿等比放大。
6. **产物名逐字符跟随源文件名。** `dev/sass/toolkit.scss` → `assets/css/toolkit.min.css`，
   `dev/js/toolkitCore.js` → `assets/js/toolkitCore.min.js`。Pages 在 Linux 上构建，写错一个
   字母本地看不出来、线上一律 404，所以骨架里那三条引用原样抄着这条提醒。
7. **量产物只有一条路径：先认清 vite 的 outDir 是仓库根的 `assets/`，不是 `_site/assets/`。**
   `_site/` 那份是 `bundle exec jekyll build` 从 `assets/` 复制过去的副本。Step 5 的脚本第 0 组
   判据就是断言两处 `toolkit.min.css` 同 md5——09-27 写这份计划时我先踩了这条：拿旧 `_site` 做
   "去掉黑名单后 `.tk-` 仍是 0 条 vw"的"反证"，差点把一条有效的判据当成无效的写进计划。

`demo/idCardDemo/` 还在（段 5 删），`_includes/header.html` 的「工具箱」下拉与 `/tools.html`
小节、`sitemap.xml`、`llms.txt` 都在 Task 9——这一格交付的是一张**能直接输入 URL 打开**的页，
收录面下一格接。

- [x] **Step 1: 建数据源与图标 —— `_data/onlineTools.yml` + `assets/img/tools/idcard-tool.svg`**

先建数据源，因为骨架里那些 `{{ tk.h1 }}` / `{{ tk.panels[0].desc }}` 全从它取；反过来说，这份 yml
是**这一页有哪些面板、叫什么、说明写什么**的唯一出处：骨架不写第二份，Task 9 的下拉与 `/tools.html`
小节也不写第三份（文件头那句"同一份事实写第二遍，迟早只改一处"就是这条分工的理由）。

两条口径容易写歪，逐字照抄时留意：

- `prefix` 那一栏讲的是**前缀字面量在仓库里的三个合法出现点**（yml 的 `prefix` 字段 /
  `toolIdcard.js` 的 `CONTAINER_ID`、`NOTICE_ID` / 骨架的 `data-tk-*` 属性名）。写"只许出现在 yml
  与那条 data 属性上"是错的——那两处常量是这一页自己的地址，删不掉也不该删（`toolIdcard.js`
  文件头条 1 讲的"两副面孔"就是这件事）。
- `status` 那一栏讲的是**段 3 / 段 4 各自追加自己那一条**，不是"把剩下两条翻成 ready"——
  现在这张表里只有 idcard 一条，另两条还没进表。

**1a `_data/onlineTools.yml`**（76 行）：

```yaml
# 在线工具（站内计算的工具页）单一数据源 —— 设计文档 §4.2。
# 三个消费点共用这一份，不各抄一遍：顶栏「工具箱」下拉里的「在线工具」分组、
# /tools.html 的同名小节、index-all.html 的页面清单。理由与 _includes/headAssets.html
# 文件头那条注释同源：同一份事实写第二遍，迟早只改一处。
#
# 为什么不并进 _data/tools.yml：那一张表里每条都带 store / screenshot / badges / post_tag
# 这些只有浏览器插件才有的字段，在线工具一个都用不上；混表的结果是那一族字段在
# 在线工具行上恒空，而消费点（下拉与产品页）已经按"必有 icon / screenshot"写了模板。
#
# 字段口径：
#   slug     permalink 的名段（/tools/<slug>.html），同时是下拉与 tools.html 小节的锚点
#   url      站内完整路径，**不带** site.baseurl，由消费点自己 prepend（同 tools.yml 的 icon 口径）
#   h1       页面正文的大标题。`title` 是给检索用的口径（见下），两者不是一件事
#   title    `<title>` / og:title / CollectionPage 的 name，按设计文档 §4.1 那三条检索口径写
#   prefix   面板 DOM 的 id 前缀。页面骨架里的 <prefix>-tablist / -tab-<slug> / -panel-<slug>
#            从这里取，`dev/js/toolIdcard.js` 交给 createPanelWorkspace 的也是那一个。
#            字面量前缀在仓库里合法的出现点只有三处：这里的 `prefix` 字段、`toolIdcard.js`
#            顶上的 CONTAINER_ID / NOTICE_ID 两个常量（那是本页自己的地址，与行为前缀是两副
#            面孔，见该文件头条 1）、骨架那四条 `data-tk-*` 属性名。除此之外一律从 data 属性
#            读——多写一处就是第二处口径，而两处不一致时红的是运行时，不是构建
#   panels   面板清单，顺序 = 索引条顺序 = 禁用脚本时的文档顺序；`slug` 就是页内 #hash 锚点
#     desc   面板正文说明（页内静态文案，禁用脚本也读得到）
#   status   该页的实现状态：只有 ready 的那几条会被消费点画成链接。段 2 的清单里只有 idcard
#            这一条，段 3 / 段 4 交付时各自**追加**自己那一条（不是来改这一条的 status）；
#            planned 这一档现在没有条目在用，留着是因为"先进清单、后补正文"正是这条流水线
#            最容易卡住人的地方——挡在数据层，不靠改模板
- slug: idcard
  url: /tools/idcard.html
  name: 证件与机构代码工具
  tagline: 身份证 / 统一社会信用代码 / 银行卡 / 手机号 / 随机测试数据
  title: 身份证号校验与测试号生成 · 统一社会信用代码在线解析
  h1: 证件与机构代码工具
  icon: /assets/img/tools/idcard-tool.svg
  status: ready
  prefix: tk
  desc: >-
    五块面板都在浏览器本地算：粘贴号码做校验与逐段解析，或按区划、性别、年龄段随机合成测试数据。
    行别与号段按内置的第三方快照给出，只作参考、不承诺全量。
  panels:
    - slug: idcard
      name: 身份证
      tagline: 18 位校验与解析、15 位第一代写法、按区划合成
      desc: >-
        粘一行或一个文件的多行号码，逐行给三态结论（有效 / 校验位不符 / 结构非法）、逐项判定表和全量解析：
        省市区三级码与全名、出生日期与周岁、性别、顺序码、校验位的算式。
        出生年在 1900–1999 内的 18 位号会同时给出等价的 15 位写法。
        区划码查不到时不下"无效"结论，只说明它未见于现行区划表。
    - slug: uscc
      name: 统一社会信用代码
      tagline: 18 位解析、字符集与两层校验位、按区划合成
      desc: >-
        校验第 1–17 位的字符集与两套权重算式，并把 18 位拆开：登记管理部门与机构类别（只给字符，
        取值含义表没取到可核实来源，本站不猜名称）、行政区划、主体标识、内层组织机构代码校验位、
        本层校验位。生成侧第 9–17 位用真实结构（8 位本体加 GB/T 11714 校验位）。
        字符 I、O、S、Z、V 不属 31 字符集，出现即判结构非法。
    - slug: bankcard
      name: 银行卡
      tagline: Luhn 校验与逐位算式、行别前缀参考、按行别合成
      desc: >-
        校验按 Luhn 与 13–19 位长度给结论，并列出逐位相加的算式；行别与登记位数查内置前缀表，
        查不到只说"表内未收录"，不下"无效"结论。生成侧从表内的 BIN 出发，补随机体与 Luhn 校验位，
        所以每一条都能被本页的校验判成有效。
    - slug: mobile
      name: 手机号
      tagline: 11 位格式判定、三位号段判运营商、按运营商合成
      desc: >-
        格式（11 位、1[3-9] 开头）是硬结论；运营商按三位号段判定，是发号口径的参考，
        携号转网后不代表当前实际运营商。本站不做号码归属地：三位号段这一层判不到城市，
        而能干净取到许可的公开来源也只有这一层。
    - slug: random
      name: 随机测试数据
      tagline: 姓名 / 地址 / 邮箱，单类或一次一组
      desc: >-
        姓名由本站自造的常用姓氏与名字用字随机组合，地址由现行区划全名加通用街道词与门牌拼出，
        邮箱一律落在 RFC 2606 的 example 保留域。三类都不指向任何真实个人或真实信箱，
        只做开发与测试用途的占位数据。
```

**1b `assets/img/tools/idcard-tool.svg`**（11 行 / 762 字节）——`icon:` 字段指向它。走内联描边图形
而不是图标字体，与 `_includes/header.html` 里下拉箭头同一条理由（断网时只剩方框）；全部
`currentColor`，所以夜间与三档纸色温不需要第二份。Task 9 的下拉是它的第一个消费者，本格先落地，
免得下一格顺手用 emoji 顶掉。

```svg
<!-- 顶栏「工具箱」下拉与 /tools.html 小节里「证件与机构代码工具」那一行的图标。
     画成内联描边图形而不是图标字体：断网时只剩方框（同 _includes/header.html 里下拉箭头那条理由）。
     全部走 currentColor，所以暗色与三档纸色温自动跟随，不需要第二份。 -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none"
     stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
     role="img" aria-label="证件与机构代码工具">
    <rect x="2.5" y="5.5" width="19" height="13" rx="2"/>
    <path d="M2.5 9.5h19"/>
    <path d="M6 13.5h5M6 16h8"/>
    <circle cx="16.5" cy="14.5" r="2"/>
</svg>
```

跑一遍数据源自检（字段齐备、面板 slug 唯一、`url` 不带 baseurl、`icon` 指向的文件真在盘上）：

```bash
cat > /tmp/check-onlineTools.rb <<'RUBY'
# 校验 _data/onlineTools.yml：字段齐备、slug 唯一、url 不带 baseurl、icon 文件真的在盘上。
# 判据只读数据、不读产物——产物那一头是 Step 5 的活。
require 'yaml'
path = ARGV[0] || '_data/onlineTools.yml'
d = YAML.load_file(path)
need = %w[slug url name tagline title h1 icon desc prefix panels status]
puts "entries=#{d.size}"
d.each do |e|
  miss = need.reject { |k| e.key?(k) }
  slugs = e['panels'].map { |p| p['slug'] }
  bad_panel = e['panels'].reject { |p| %w[slug name tagline desc].all? { |k| p[k] } }
  puts "#{e['slug']}: status=#{e['status']} prefix=#{e['prefix']} panels=#{slugs.size} " \
       "missing=#{miss.join(',').empty? ? 'none' : miss.join(',')} dup=#{slugs.size != slugs.uniq.size} " \
       "坏面板=#{bad_panel.size} url=#{e['url']} 带baseurl=#{e['url'].start_with?('/better-blog')} " \
       "icon在盘上=#{File.exist?(e['icon'].sub(%r{^/}, ''))}"
end
RUBY
bundle exec ruby /tmp/check-onlineTools.rb
```

Expected（2026-09-27 镜像实跑，`exit=0`；那行 `RubyGems version` 警告是本站环境的固定噪音，
与判据无关）：

```
entries=1
idcard: status=ready prefix=tk panels=5 missing=none dup=false 坏面板=0 url=/tools/idcard.html 带baseurl=false icon在盘上=true
```

**这段必须写成 heredoc 落一个 `.rb` 文件，不能写成 `ruby -e '...'`**：`-e` 的脚本源码按 US-ASCII
解，脚本里一旦有中文（上面那些 `坏面板=` / `带baseurl=` 的键名就是中文）会刷出几十行
`invalid multibyte char (US-ASCII)`，看着像判据红了、其实是解析器根本没读到判据那一步。写进文件
就没这问题（文件源码默认 UTF-8）。

**2026-09-27 落地实跑（Step 1）**：两条文件按载荷写出——`_data/onlineTools.yml` 76 行 / 5,683 B、
`assets/img/tools/idcard-tool.svg` 11 行 / 762 B，与计划块逐字节全等（全等证据在 Step 7 记录里，
那里连 html / scss 两块一起核）。上面那条自检在真实现场重跑，输出与 Expected 那两行逐个字符相同
（`entries=1` 与 `idcard: … icon在盘上=true`）。`/tmp` 这一轮被外部清过一次，所以那份 `.rb`
是从计划载荷 10089–10104 重抽出来的 16 行，不是照着回忆手抄——**抽完先断言行数，再跑**。
一处口径顺便钉住：`icon在盘上` 判的是 `File.exist?(icon.sub(%r{^/}, ''))`，也就是**去掉前导斜杠
之后的仓库相对路径**（`assets/img/tools/idcard-tool.svg` 在根上），而消费点拿到的是带前导斜杠的
站内路径、要自己 prepend `site.baseurl`——与 `url` 那一栏讲的是同一件事的两副面孔。

- [x] **Step 2: 写页面骨架 `tools-idcard.html`（构建期渲染，四件事都在这张表里）**

骨架是这一格唯一"用户看得见"的东西，四件事都在这里定：① 五块面板的正文由 Liquid 在构建期渲染
出来（§6.3，禁用脚本与爬虫都读得到）；② 索引条与面板的 ARIA 一个都不写，`role` / `aria-selected`
/ `tabindex` / `hidden` 全由 `panel-dom.js` 按属性表覆写；③ 面板清单、前缀、大标题从
`_data/onlineTools.yml` 取（`where: 'slug', page.tool`），页内不写第二份；④ 三条引用（css 一条、
js 两条）的先后与"产物名逐字符跟随源文件名"的提醒写在引用处。

三处"看起来多余但删不得"的东西，注释里都写了理由，这里只挑明：

- `<noscript>` 那一段与 `{%- if tk -%}…{%- else -%}` 的 else 分支：前者是禁 JS 时唯一告诉用户
  "按钮不会有结果"的地方，后者是数据源缺条目时**宁可产出一张空正文页**也不让 `jekyll build` 红在
  一个 Liquid 空值上——空正文会在 Step 5 的第 1 组判据里当场红（面板数不等于 5），而构建红在
  CI 里只会留下一串没人看得懂的 Liquid 报错。
- `#tk-notice` 那格的 `hidden`：整张骨架里**只有这一处**写 `hidden`。默认藏起来、由 `panel-dom`
  在坏 hash 时覆写出来（段 1 §6.0 第三条：坏 hash 原样留在地址栏供人复制排查）。Step 5 拿这一条
  当"禁 JS 时五块全展开"的硬证据：`<main>` 区间里 `hidden` 命中数必须是 1，且落点就是这一格。
- 容器上那四条 `data-tk-*`，与散在控件上的 `data-tk-cascade` / `-options` / `-charsets` /
  `-switch` / `-when`：入口只读容器那四格（Step 5 第 5 组判据把它们的值原样打出来），其余是给
  装配层接线与 Task 9 对账用的标记。`id="tk-when-*"` 那四段是**装配层找它们唯一的路径**
  （`workbench.js` 与 `panel-dom.js` 同档，只走 `getElementById`，不碰 `querySelector`），少了
  `id` 是最难查的一种漏：显隐静默不生效，页面看起来只是"多了一格一直显示"。

`tools-idcard.html`（486 行 / 32,566 字节）：

```html
---
layout: default
title: 身份证号校验与测试号生成 · 统一社会信用代码在线解析
seo_description: 粘贴身份证号、统一社会信用代码、银行卡号或手机号，本地逐位算给你看结论从哪来；也能按区划、性别、年龄段随机合成测试数据。全部在浏览器里算，不发任何请求。
# 理由同 categories.html：写死 permalink 才能进站点地图、才能让 canonical 与导航一致。
permalink: /tools/idcard.html
# tool 指向 _data/onlineTools.yml 里的那一条：面板清单、id 前缀、大标题都从数据源取，
# 页面正文与顶栏下拉、/tools.html 小节因此不会各写一遍。
tool: idcard
---
{% include header.html %}

<!-- 产物名严格跟随源文件名（大小写原样）：dev/sass/toolkit.scss -> toolkit.min.css、
     dev/js/toolkitCore.js -> toolkitCore.min.js、dev/js/toolIdcard.js -> toolIdcard.min.js。
     GitHub Pages 在 Linux 上构建，写错一个字母本地看不出来、线上一律 404，勿改。
     三条引用的顺序是硬的：toolkitCore 先挂 window.Tk，页面入口再读它（同 _layouts/aboutTemplate.html
     里 jquery 必须最后那条的反向情形——这里前一条是后一条的依赖）。 -->
<link rel="stylesheet" href="{{ site.baseurl }}/assets/css/toolkit.min.css">

{%- assign tk = site.data.onlineTools | where: 'slug', page.tool | first -%}
{%- if tk -%}

<section class="g-masthead tk-masthead">
    <div class="g-container masthead-inner">
        <p class="kicker">Online Tools / 本地计算，不上传输入</p>
        <p class="masthead-issue" aria-hidden="true">
            <span class="issue-rule"></span>
            <span class="issue-no">证件 · 机构代码 · 测试数据</span>
        </p>
        <h1 class="masthead-title">{{ tk.h1 }}</h1>
        <p class="masthead-lede">{{ tk.desc }}</p>
        <ul class="masthead-stats">
            <li><strong>{{ tk.panels.size }}</strong><span>块面板</span></li>
            <li><strong>0</strong><span>网络请求</span></li>
            <li><strong>本机</strong><span>随机合成</span></li>
        </ul>
    </div>
</section>

<main class="g-container tk-content" id="main">
    {%- comment -%}
    这一段是设计文档 §5.5 那句"生成类面板固定一行提示"在**禁用脚本时也读得到**的那一份：
    结果区里还会由装配层把各模块的口径常量原样再落一次（§H 的 H8 钉的是"一字不动"），
    两处不冲突——这里说的是整页，结果区说的是这一批数据。
    {%- endcomment -%}
    <p class="tk-compliance">
        本页所有号码、姓名、地址、邮箱都由浏览器随机合成，与真实个人或真实登记主体重合的概率可忽略；
        仅供开发与测试用途，<strong>不得用于任何真实身份用途</strong>。
        校验与解析只读你粘进来的内容，全部在本地算：不发请求、不写 localStorage、不上传剪贴板。
    </p>
    <noscript>
        <p class="tk-compliance tk-compliance--noscript">
            脚本没有执行：下面五块面板按文档顺序全部展开，说明文字、口径与锚点照常可读，左侧索引退成普通目录链接。
            但"生成"与"判定"这两类动作都要在浏览器里算，此时按下按钮不会有结果。
        </p>
    </noscript>
    {%- comment -%}
    地址栏里的 #hash 不是本页任何一块面板时，装配层只在这里说一句，**不动地址栏**
    （段 1 计划 §6.0 第三条：坏 hash 原样留着供人复制排查）。默认 hidden，由 panel-dom 覆写。
    {%- endcomment -%}
    <p class="tk-notice" id="{{ tk.prefix }}-notice" hidden></p>
    {%- comment -%}
    键盘捷径只在这里说一次，不在 9 个栏位里各说一句：装配层（dev/js/tools/workbench.js）给
    「生成」接 Enter（焦点在数量或日期格时），给「判定」接 Ctrl / ⌘ + Enter（焦点在粘贴框里）。
    禁用脚本时这两句自然不成立——上面 `<noscript>` 那段已经说过"按钮不会有结果"，这里不再各挂一份。
    {%- endcomment -%}
    <p class="tk-kbd"><kbd>Enter</kbd> 生成 · <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> 判定</p>

    <div class="tk-workspace" id="{{ tk.prefix }}-workspace"
         data-tk-ids="{% for p in tk.panels %}{{ p.slug }}{% unless forloop.last %},{% endunless %}{% endfor %}"
         data-tk-prefix="{{ tk.prefix }}"
         data-tk-label="{{ tk.h1 }}"
         data-tk-notice="{{ tk.prefix }}-notice">
        {%- comment -%}
        索引条：`role="tablist"` / 每个 `role="tab"` 由 panel-dom.js 按 panel.js 算好的属性表写进来，
        这里一个 ARIA 属性都不写——写第二遍就是第二处口径，改一处漏一处，而漏掉那一处只在读屏里看得见。
        没有脚本时这一列就是普通目录，每条 `href="#slug"` 跳到同名面板。
        {%- endcomment -%}
        <nav class="tk-index" id="{{ tk.prefix }}-tablist">
            {%- for p in tk.panels -%}
            <a class="tk-index__link" id="{{ tk.prefix }}-tab-{{ p.slug }}" href="#{{ p.slug }}">
                <span class="tk-index__name">{{ p.name }}</span>
                <span class="tk-index__hint">{{ p.tagline }}</span>
            </a>
            {%- endfor -%}
        </nav>

        {%- comment -%}
        下面五块面板的正文全部在构建期渲染（设计文档 §6.3：禁用脚本与爬虫都要读得到内容）。
        每块都是「左：生成 / 右：校验解析」两栏，`#random` 没有可校验的输入，只有一栏。
        表单一律用 div[role=group] 而不是 form：没有后端可交，form 的隐式提交会把整页刷成
        ?tk-in-idcard-count=5，那是工具页最不像工具的故障。提交动作由 dev/js/toolIdcard.js
        监听按钮与 Enter 键。
        {%- endcomment -%}

        <section class="tk-panel" id="{{ tk.prefix }}-panel-idcard">
            <header class="tk-panel__head">
                <h2 class="tk-panel__title">{{ tk.panels[0].name }}</h2>
                <p class="tk-panel__tagline">{{ tk.panels[0].tagline }}</p>
                <p class="tk-panel__desc">{{ tk.panels[0].desc }}</p>
            </header>
            <div class="tk-cols">
                <section class="tk-col" aria-labelledby="{{ tk.prefix }}-h-idcard-gen">
                    <h3 class="tk-col__title" id="{{ tk.prefix }}-h-idcard-gen">生成测试号码</h3>
                    <div class="tk-form" role="group" aria-labelledby="{{ tk.prefix }}-h-idcard-gen">
                        <p class="tk-field tk-field--static">
                            <label for="{{ tk.prefix }}-in-idcard-province">区划（只出现行码）</label>
                            <span class="tk-cascade">
                                <select id="{{ tk.prefix }}-in-idcard-province" data-tk-cascade="province">
                                    <option value="">不限省份</option>
                                </select>
                                <select id="{{ tk.prefix }}-in-idcard-city" data-tk-cascade="city">
                                    <option value="">不限地市</option>
                                </select>
                                <select id="{{ tk.prefix }}-in-idcard-county" data-tk-cascade="county">
                                    <option value="">不限区县</option>
                                </select>
                            </span>
                            <span class="tk-help">三级都是收窄，不是必填：只选到省就在省内随机挑县。</span>
                        </p>
                        <p class="tk-field">
                            <label for="{{ tk.prefix }}-in-idcard-sex">性别</label>
                            <select id="{{ tk.prefix }}-in-idcard-sex">
                                <option value="">不限</option>
                                <option value="male">男</option>
                                <option value="female">女</option>
                            </select>
                        </p>
                        <p class="tk-field">
                            <label for="{{ tk.prefix }}-in-idcard-ageband">年龄段</label>
                            <select id="{{ tk.prefix }}-in-idcard-ageband" data-tk-switch>
                                <option value="">18–60 岁</option>
                                <option value="18-30">18–30 岁</option>
                                <option value="31-45">31–45 岁</option>
                                <option value="46-60">46–60 岁</option>
                                <option value="custom">指定出生日期</option>
                            </select>
                        </p>
                        {%- comment -%}
                        受开关控制的段落：`id` 是装配层找它的唯一路径（`workbench.js` 与 `panel-dom.js`
                        同档，只走 `getElementById`，不碰 `querySelector`），`data-tk-when` 记的是
                        "哪几个开关值会让它现身"，由 Task 9 拿 `WORKBENCH_SPEC` 的 switch targets 双向对账。
                        少了 `id` 是最难查的一种漏：显隐静默不生效，页面看起来只是"多了一格一直显示"。
                        {%- endcomment -%}
                        <p class="tk-field" id="{{ tk.prefix }}-when-idcard-birth" data-tk-when="custom">
                            <label for="{{ tk.prefix }}-in-idcard-birth">出生日期</label>
                            <input id="{{ tk.prefix }}-in-idcard-birth" type="date" min="1900-01-01"
                                   autocomplete="off" spellcheck="false">
                            <span class="tk-help">下限 1900-01-01，上限是今天；出生年在 1900–1999 内会同时给出 15 位写法。</span>
                        </p>
                        <p class="tk-field tk-field--count">
                            <label for="{{ tk.prefix }}-in-idcard-count">数量（1–50）</label>
                            <input id="{{ tk.prefix }}-in-idcard-count" type="number" min="1" max="50" step="1" value="5"
                                   autocomplete="off" inputmode="numeric">
                        </p>
                        <p class="tk-actions">
                            <button class="tk-btn" type="button" id="{{ tk.prefix }}-btn-idcard-gen">生成</button>
                        </p>
                    </div>
                    <div class="tk-outwrap">
                        <button class="tk-btn tk-btn--ghost" type="button"
                                id="{{ tk.prefix }}-copy-idcard-gen" disabled>复制这批号码</button>
                        <div class="tk-out" id="{{ tk.prefix }}-out-idcard-gen"
                             role="region" aria-live="polite" aria-labelledby="{{ tk.prefix }}-h-idcard-gen"></div>
                    </div>
                </section>

                <section class="tk-col" aria-labelledby="{{ tk.prefix }}-h-idcard-read">
                    <h3 class="tk-col__title" id="{{ tk.prefix }}-h-idcard-read">校验与解析</h3>
                    <div class="tk-form" role="group" aria-labelledby="{{ tk.prefix }}-h-idcard-read">
                        <p class="tk-field tk-field--wide">
                            <label for="{{ tk.prefix }}-in-idcard-read">号码（可一次粘多行，每行一条）</label>
                            <textarea id="{{ tk.prefix }}-in-idcard-read" rows="5"
                                      autocomplete="off" autocorrect="off" autocapitalize="off"
                                      spellcheck="false" placeholder="110101199003070015"></textarea>
                            <span class="tk-help">15 位与 18 位都收；含空格或分隔符的原样保留，判定对象单独回显给你看。</span>
                        </p>
                        <p class="tk-actions">
                            <button class="tk-btn" type="button" id="{{ tk.prefix }}-btn-idcard-read">判定</button>
                        </p>
                    </div>
                    <div class="tk-outwrap">
                        <button class="tk-btn tk-btn--ghost" type="button"
                                id="{{ tk.prefix }}-copy-idcard-read" disabled>复制判定有效的号码</button>
                        <div class="tk-out" id="{{ tk.prefix }}-out-idcard-read"
                             role="region" aria-live="polite" aria-labelledby="{{ tk.prefix }}-h-idcard-read"></div>
                    </div>
                </section>
            </div>
        </section>

        <section class="tk-panel" id="{{ tk.prefix }}-panel-uscc">
            <header class="tk-panel__head">
                <h2 class="tk-panel__title">{{ tk.panels[1].name }}</h2>
                <p class="tk-panel__tagline">{{ tk.panels[1].tagline }}</p>
                <p class="tk-panel__desc">{{ tk.panels[1].desc }}</p>
            </header>
            <div class="tk-cols">
                <section class="tk-col" aria-labelledby="{{ tk.prefix }}-h-uscc-gen">
                    <h3 class="tk-col__title" id="{{ tk.prefix }}-h-uscc-gen">生成合规代码</h3>
                    <div class="tk-form" role="group" aria-labelledby="{{ tk.prefix }}-h-uscc-gen">
                        <p class="tk-field">
                            <label for="{{ tk.prefix }}-in-uscc-registry">登记管理部门码（第 1 位）</label>
                            <select id="{{ tk.prefix }}-in-uscc-registry" data-tk-charsets="uscc">
                                <option value="">不填（取默认字符 9）</option>
                            </select>
                        </p>
                        <p class="tk-field">
                            <label for="{{ tk.prefix }}-in-uscc-category">机构类别码（第 2 位）</label>
                            <select id="{{ tk.prefix }}-in-uscc-category" data-tk-charsets="uscc">
                                <option value="">不填（取默认字符 1）</option>
                            </select>
                        </p>
                        <p class="tk-field tk-field--static">
                            <label for="{{ tk.prefix }}-in-uscc-province">行政区划（现行码，市级起）</label>
                            <span class="tk-cascade">
                                <select id="{{ tk.prefix }}-in-uscc-province" data-tk-cascade="province">
                                    <option value="">不限省份</option>
                                </select>
                                <select id="{{ tk.prefix }}-in-uscc-city" data-tk-cascade="city">
                                    <option value="">不限地市</option>
                                </select>
                            </span>
                            <span class="tk-help">代码第 3–8 位是 6 位区划段，市本级取「市码 + 00」。</span>
                        </p>
                        <p class="tk-field tk-field--count">
                            <label for="{{ tk.prefix }}-in-uscc-count">数量（1–50）</label>
                            <input id="{{ tk.prefix }}-in-uscc-count" type="number" min="1" max="50" step="1" value="5"
                                   autocomplete="off" inputmode="numeric">
                        </p>
                        <p class="tk-actions">
                            <button class="tk-btn" type="button" id="{{ tk.prefix }}-btn-uscc-gen">生成</button>
                        </p>
                    </div>
                    <div class="tk-outwrap">
                        <button class="tk-btn tk-btn--ghost" type="button"
                                id="{{ tk.prefix }}-copy-uscc-gen" disabled>复制这批代码</button>
                        <div class="tk-out" id="{{ tk.prefix }}-out-uscc-gen"
                             role="region" aria-live="polite" aria-labelledby="{{ tk.prefix }}-h-uscc-gen"></div>
                    </div>
                </section>

                <section class="tk-col" aria-labelledby="{{ tk.prefix }}-h-uscc-read">
                    <h3 class="tk-col__title" id="{{ tk.prefix }}-h-uscc-read">校验与逐段解析</h3>
                    <div class="tk-form" role="group" aria-labelledby="{{ tk.prefix }}-h-uscc-read">
                        <p class="tk-field tk-field--wide">
                            <label for="{{ tk.prefix }}-in-uscc-read">代码（可一次粘多行）</label>
                            <textarea id="{{ tk.prefix }}-in-uscc-read" rows="5"
                                      autocomplete="off" autocorrect="off" autocapitalize="off"
                                      spellcheck="false" placeholder="91350100M000100Y43"></textarea>
                            <span class="tk-help">小写字母会先归一成大写，原样输入与判定对象各回显一次。</span>
                        </p>
                        <p class="tk-actions">
                            <button class="tk-btn" type="button" id="{{ tk.prefix }}-btn-uscc-read">判定</button>
                        </p>
                    </div>
                    <div class="tk-outwrap">
                        <button class="tk-btn tk-btn--ghost" type="button"
                                id="{{ tk.prefix }}-copy-uscc-read" disabled>复制判定有效的代码</button>
                        <div class="tk-out" id="{{ tk.prefix }}-out-uscc-read"
                             role="region" aria-live="polite" aria-labelledby="{{ tk.prefix }}-h-uscc-read"></div>
                    </div>
                </section>
            </div>
        </section>

        <section class="tk-panel" id="{{ tk.prefix }}-panel-bankcard">
            <header class="tk-panel__head">
                <h2 class="tk-panel__title">{{ tk.panels[2].name }}</h2>
                <p class="tk-panel__tagline">{{ tk.panels[2].tagline }}</p>
                <p class="tk-panel__desc">{{ tk.panels[2].desc }}</p>
            </header>
            <div class="tk-cols">
                <section class="tk-col" aria-labelledby="{{ tk.prefix }}-h-bankcard-gen">
                    <h3 class="tk-col__title" id="{{ tk.prefix }}-h-bankcard-gen">生成测试卡号</h3>
                    <div class="tk-form" role="group" aria-labelledby="{{ tk.prefix }}-h-bankcard-gen">
                        <p class="tk-field">
                            <label for="{{ tk.prefix }}-in-bankcard-bank">发卡行</label>
                            <select id="{{ tk.prefix }}-in-bankcard-bank" data-tk-options="banks">
                                <option value="">不限行别（表内全部 BIN 里随机）</option>
                            </select>
                        </p>
                        <p class="tk-field">
                            <label for="{{ tk.prefix }}-in-bankcard-type">卡种</label>
                            <select id="{{ tk.prefix }}-in-bankcard-type" data-tk-options="cardtypes">
                                <option value="">不限</option>
                            </select>
                        </p>
                        <p class="tk-field">
                            <label for="{{ tk.prefix }}-in-bankcard-length">位数（13–19）</label>
                            <input id="{{ tk.prefix }}-in-bankcard-length" type="number" min="13" max="19" step="1"
                                   autocomplete="off" inputmode="numeric" placeholder="按行别登记位数">
                        </p>
                        <p class="tk-field tk-field--count">
                            <label for="{{ tk.prefix }}-in-bankcard-count">数量（1–50）</label>
                            <input id="{{ tk.prefix }}-in-bankcard-count" type="number" min="1" max="50" step="1" value="5"
                                   autocomplete="off" inputmode="numeric">
                        </p>
                        <p class="tk-actions">
                            <button class="tk-btn" type="button" id="{{ tk.prefix }}-btn-bankcard-gen">生成</button>
                        </p>
                    </div>
                    <div class="tk-outwrap">
                        <button class="tk-btn tk-btn--ghost" type="button"
                                id="{{ tk.prefix }}-copy-bankcard-gen" disabled>复制这批卡号</button>
                        <div class="tk-out" id="{{ tk.prefix }}-out-bankcard-gen"
                             role="region" aria-live="polite" aria-labelledby="{{ tk.prefix }}-h-bankcard-gen"></div>
                    </div>
                </section>

                <section class="tk-col" aria-labelledby="{{ tk.prefix }}-h-bankcard-read">
                    <h3 class="tk-col__title" id="{{ tk.prefix }}-h-bankcard-read">校验（Luhn）</h3>
                    <div class="tk-form" role="group" aria-labelledby="{{ tk.prefix }}-h-bankcard-read">
                        <p class="tk-field tk-field--wide">
                            <label for="{{ tk.prefix }}-in-bankcard-read">卡号（可一次粘多行，空格与连字符会被去掉）</label>
                            <textarea id="{{ tk.prefix }}-in-bankcard-read" rows="5"
                                      autocomplete="off" autocorrect="off" autocapitalize="off"
                                      spellcheck="false" placeholder="6222 0219 9003 0700 15"></textarea>
                            <span class="tk-help">行别与登记位数查的是内置前缀表，查不到只说"表内未收录"，不下"无效"结论。</span>
                        </p>
                        <p class="tk-actions">
                            <button class="tk-btn" type="button" id="{{ tk.prefix }}-btn-bankcard-read">判定</button>
                        </p>
                    </div>
                    <div class="tk-outwrap">
                        <button class="tk-btn tk-btn--ghost" type="button"
                                id="{{ tk.prefix }}-copy-bankcard-read" disabled>复制判定有效的卡号</button>
                        <div class="tk-out" id="{{ tk.prefix }}-out-bankcard-read"
                             role="region" aria-live="polite" aria-labelledby="{{ tk.prefix }}-h-bankcard-read"></div>
                    </div>
                </section>
            </div>
        </section>

        <section class="tk-panel" id="{{ tk.prefix }}-panel-mobile">
            <header class="tk-panel__head">
                <h2 class="tk-panel__title">{{ tk.panels[3].name }}</h2>
                <p class="tk-panel__tagline">{{ tk.panels[3].tagline }}</p>
                <p class="tk-panel__desc">{{ tk.panels[3].desc }}</p>
            </header>
            <div class="tk-cols">
                <section class="tk-col" aria-labelledby="{{ tk.prefix }}-h-mobile-gen">
                    <h3 class="tk-col__title" id="{{ tk.prefix }}-h-mobile-gen">生成测试号码</h3>
                    <div class="tk-form" role="group" aria-labelledby="{{ tk.prefix }}-h-mobile-gen">
                        <p class="tk-field">
                            <label for="{{ tk.prefix }}-in-mobile-carrier">运营商</label>
                            <select id="{{ tk.prefix }}-in-mobile-carrier" data-tk-options="carriers">
                                <option value="">随机</option>
                            </select>
                        </p>
                        <p class="tk-field">
                            <label for="{{ tk.prefix }}-in-mobile-segment">号段（三位）</label>
                            <select id="{{ tk.prefix }}-in-mobile-segment" data-tk-options="segments">
                                <option value="">不限号段</option>
                            </select>
                        </p>
                        <p class="tk-field tk-field--count">
                            <label for="{{ tk.prefix }}-in-mobile-count">数量（1–50）</label>
                            <input id="{{ tk.prefix }}-in-mobile-count" type="number" min="1" max="50" step="1" value="5"
                                   autocomplete="off" inputmode="numeric">
                        </p>
                        <p class="tk-actions">
                            <button class="tk-btn" type="button" id="{{ tk.prefix }}-btn-mobile-gen">生成</button>
                        </p>
                    </div>
                    <div class="tk-outwrap">
                        <button class="tk-btn tk-btn--ghost" type="button"
                                id="{{ tk.prefix }}-copy-mobile-gen" disabled>复制这批号码</button>
                        <div class="tk-out" id="{{ tk.prefix }}-out-mobile-gen"
                             role="region" aria-live="polite" aria-labelledby="{{ tk.prefix }}-h-mobile-gen"></div>
                    </div>
                </section>

                <section class="tk-col" aria-labelledby="{{ tk.prefix }}-h-mobile-read">
                    <h3 class="tk-col__title" id="{{ tk.prefix }}-h-mobile-read">校验与号段识别</h3>
                    <div class="tk-form" role="group" aria-labelledby="{{ tk.prefix }}-h-mobile-read">
                        <p class="tk-field tk-field--wide">
                            <label for="{{ tk.prefix }}-in-mobile-read">号码（可一次粘多行）</label>
                            <textarea id="{{ tk.prefix }}-in-mobile-read" rows="5"
                                      autocomplete="off" autocorrect="off" autocapitalize="off"
                                      spellcheck="false" placeholder="13800138000"></textarea>
                            <span class="tk-help">本站不做号码归属地：三位号段这一层判不到城市，而能干净取到许可的来源也只有这一层。</span>
                        </p>
                        <p class="tk-actions">
                            <button class="tk-btn" type="button" id="{{ tk.prefix }}-btn-mobile-read">判定</button>
                        </p>
                    </div>
                    <div class="tk-outwrap">
                        <button class="tk-btn tk-btn--ghost" type="button"
                                id="{{ tk.prefix }}-copy-mobile-read" disabled>复制判定有效的号码</button>
                        <div class="tk-out" id="{{ tk.prefix }}-out-mobile-read"
                             role="region" aria-live="polite" aria-labelledby="{{ tk.prefix }}-h-mobile-read"></div>
                    </div>
                </section>
            </div>
        </section>

        <section class="tk-panel tk-panel--single" id="{{ tk.prefix }}-panel-random">
            <header class="tk-panel__head">
                <h2 class="tk-panel__title">{{ tk.panels[4].name }}</h2>
                <p class="tk-panel__tagline">{{ tk.panels[4].tagline }}</p>
                <p class="tk-panel__desc">{{ tk.panels[4].desc }}</p>
            </header>
            <div class="tk-cols tk-cols--one">
                <section class="tk-col" aria-labelledby="{{ tk.prefix }}-h-random-gen">
                    <h3 class="tk-col__title" id="{{ tk.prefix }}-h-random-gen">随机合成</h3>
                    <div class="tk-form" role="group" aria-labelledby="{{ tk.prefix }}-h-random-gen">
                        <p class="tk-field">
                            <label for="{{ tk.prefix }}-in-random-kind">来什么</label>
                            <select id="{{ tk.prefix }}-in-random-kind" data-tk-switch>
                                <option value="name">姓名</option>
                                <option value="address">地址</option>
                                <option value="email">邮箱</option>
                                <option value="profile">一次一组（姓名 + 地址 + 邮箱）</option>
                            </select>
                        </p>
                        <p class="tk-field">
                            <label for="{{ tk.prefix }}-in-random-count">数量（1–50）</label>
                            <input id="{{ tk.prefix }}-in-random-count" type="number" min="1" max="50" step="1" value="5"
                                   autocomplete="off" inputmode="numeric">
                        </p>
                        <p class="tk-field" id="{{ tk.prefix }}-when-random-givelen" data-tk-when="name profile">
                            <label for="{{ tk.prefix }}-in-random-givelen">名字字数</label>
                            <select id="{{ tk.prefix }}-in-random-givelen">
                                <option value="">不限（1 或 2 个字）</option>
                                <option value="1">1 个字</option>
                                <option value="2">2 个字</option>
                            </select>
                        </p>
                        <p class="tk-field tk-field--static" id="{{ tk.prefix }}-when-random-addr" data-tk-when="address profile">
                            <label for="{{ tk.prefix }}-in-random-province">地址区划（只出现行码）</label>
                            <span class="tk-cascade">
                                <select id="{{ tk.prefix }}-in-random-province" data-tk-cascade="province">
                                    <option value="">不限省份</option>
                                </select>
                                <select id="{{ tk.prefix }}-in-random-city" data-tk-cascade="city">
                                    <option value="">不限地市</option>
                                </select>
                                <select id="{{ tk.prefix }}-in-random-county" data-tk-cascade="county">
                                    <option value="">不限区县</option>
                                </select>
                            </span>
                            <span class="tk-help">街道与门牌是通用词随机拼的，不指向真实门牌。</span>
                        </p>
                        <p class="tk-field" id="{{ tk.prefix }}-when-random-domain" data-tk-when="email profile">
                            <label for="{{ tk.prefix }}-in-random-domain">邮箱域</label>
                            <select id="{{ tk.prefix }}-in-random-domain" data-tk-options="domains">
                                <option value="">三个保留域随机</option>
                            </select>
                        </p>
                        <p class="tk-actions">
                            <button class="tk-btn" type="button" id="{{ tk.prefix }}-btn-random-gen">生成</button>
                        </p>
                    </div>
                    <div class="tk-outwrap">
                        <button class="tk-btn tk-btn--ghost" type="button"
                                id="{{ tk.prefix }}-copy-random-gen" disabled>复制这批结果</button>
                        <div class="tk-out" id="{{ tk.prefix }}-out-random-gen"
                             role="region" aria-live="polite" aria-labelledby="{{ tk.prefix }}-h-random-gen"></div>
                    </div>
                </section>
            </div>
        </section>
    </div>
</main>

{%- comment -%}
脚本两条：toolkitCore 把跨页共用的一面板框架/绑定层/视图挂成 window.Tk，页面入口只装配本页业务。
两条都不 defer、不加 type=module：产物是 iife 包过的经典脚本，且必须排在正文之后（同 weblab.html 那条
口径——HTML 解析到这里时面板节点已经存在，装配层第一件事就是去找它们）。
{%- endcomment -%}
<script src="{{ site.baseurl }}/assets/js/toolkitCore.min.js"></script>
<script src="{{ site.baseurl }}/assets/js/toolIdcard.min.js"></script>

{% include footer.html %}

{%- else -%}
{%- comment -%}
_data/onlineTools.yml 里查不到本页那一条时，宁可产出一个空正文的页面，也不要让 jekyll build 红在
一个 Liquid 空值上：空正文会在 Task 9 的收录面判据（三页正文非空、五块面板齐）里当场红。
{%- endcomment -%}
<main class="g-container tk-content" id="main">
    <p class="tk-compliance">_data/onlineTools.yml 里缺少 slug 为 <code>{{ page.tool }}</code> 的条目。</p>
</main>
{% include footer.html %}
{%- endif -%}
```

**2026-09-27 落地实跑（Step 2）**：`tools-idcard.html` 写出 486 行 / 32,566 B，与计划块逐字节全等。
四件事在产物上的落点全部由 Step 5 判到，不在这儿自证：构建期渲染=第 2 组（五条 `desc` 的开头字样
原样在 HTML 里）与第 6 组 `6-未展开的Liquid: 0`；ARIA 一个不写=第 3 组前两项 0；无 `<form>`=第 4 组
`4-form标签: 0`；引用与顺序=第 6 组那五条。两处形状记在这里就够：`#tk-notice` 是 `<main>` 区间里
**唯一**一处 `hidden`（第 3 组 `3-main区间hidden数: 1`，禁 JS 时五块全展开的硬证据），而 `{%- else -%}`
那一支（yml 查不到条目时产出空正文）在本格**不该被走到**——走到了第 1 组就是 `1-面板数: 0`，
所以它是"红得起来"的兜底、不是哑弹。第 6 组那条 `indexOf` 陷阱（骨架注释里把三个产物名念了一遍）
这次没有再犯：脚本认的是 `src="/better-blog/assets/js/<名字>` 这一头，现场一次就得 `YY`。

- [x] **Step 3: 写 `dev/sass/toolkit.scss`（三页共用的一层样式，五条口径写在文件头）**

这一层是 `.tk-` / `.jt-` 两族类名的公共件：段 3 / 段 4 直接复用，所以文件头那五条口径是给三页
看的，不是给这一页看的。挑三条要在这里判的：

- **像素转视口的黑名单必须是字符串。** 文件头第一条把 `postcss-px-to-viewport/index.js:130` 那个
  分支抄了出来（字符串走 `selector.indexOf`、正则走不锚定的 `match`），Step 4 正反两跑就是在
  验这一条。**为什么"不排就是错的"要说清楚**：这一层是桌面密度的排版，`13px` 表单项被等比放大
  到 1560 屏上是 27px，五块面板拉成三屏。代价是黑名单变宽——任何别的文件将来写了带 `.tk-` 子串
  的选择器也会被一并放过，所以 Task 9 盯着产物里的 `.tk-` 规则数。
- **样式不认识 JS 的运行状态，只认识 ARIA 与 `hidden`。** 选中态写成
  `[aria-selected='true']`、"这一块塌了"写成 `.tk-panel__error`（那个类名由 `panel-dom` 给，是它
  唯一的类名钩子）。这条与 Task 6 的"全站唯一一处 ARIA 口径"是一对：状态形状归 `panel.js`，
  观感归这里，两边不串。
- **三档状态色是本层新造的角色色**，白昼落 `:root`、夜间在 `body.night-mode` 重赋值，上收进
  `tokens.scss` 是段 5 的事（那文件此刻有另一个会话在改，现在去碰它是抢同一支笔）。这两组
  对比度是**判据不是装饰**，写进注释的数字必须能照着复算，所以这里就把复算命令给出来：

```bash
node -e '
const hex = (h) => (h.length === 4 ? "#" + [...h.slice(1)].map((c) => c + c).join("") : h);
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = (h) => 0.2126 * lin(parseInt(h.slice(1, 3), 16)) + 0.7152 * lin(parseInt(h.slice(3, 5), 16))
  + 0.0722 * lin(parseInt(h.slice(5, 7), 16));
const ratio = (a, b) => (Math.max(L(hex(a)), L(hex(b))) + 0.05) / (Math.min(L(hex(a)), L(hex(b))) + 0.05);
const day = ["#136b3a", "#8a5a00", "#a31910"], night = ["#5bd08b", "#e3b341", "#ff7b6b"];
console.log("白昼 vs #FFF :", day.map((h) => `${h} ${ratio(h, "#FFF").toFixed(2)}`).join("  "));
console.log("夜间 vs #191C23:", night.map((h) => `${h} ${ratio(h, "#191C23").toFixed(2)}`).join("  "));
console.log("AA(4.5) 通过：白昼", day.every((h) => ratio(h, "#FFF") >= 4.5), "夜间",
  night.every((h) => ratio(h, "#191C23") >= 4.5));
'
```

Expected（2026-09-27 现算，底色取自 `dev/sass/common/tokens.scss`：白昼 `--surface` `#FFF`、
夜间 `--surface` `#191C23`）：

```
白昼 vs #FFF : #136b3a 6.58  #8a5a00 5.93  #a31910 7.77
夜间 vs #191C23: #5bd08b 8.80  #e3b341 8.76  #ff7b6b 6.74
AA(4.5) 通过：白昼 true 夜间 true
```

`hex()` 那一行不是防御性代码，是**这条命令的最小正确性前提**：`tokens.scss` 里白昼那格写的就是
三个 `#FFF`，不展开成六位的话 `slice(5,7)` 取到空串、`parseInt` 给 `NaN`，六个比值全变 `NaN`，
而 `NaN >= 4.5` 是 `false`——脚本会安静地报出"白昼 false"，看着像色值不达标，其实是解析器没读进
底色。09-27 第一次跑就是这么红了一把，加 `hex()` 才拿到上面那三行。

（那六个数就是文件头与 `:root` / `body.night-mode` 那两行注释里写的数。**先跑命令再抄进注释**——
这一层最初抄的是 6.3 / 5.2 / 6.0 与 9.4 / 10.5 / 7.4，六个数没一个复算得出来，09-27 按现算值
改掉了。）

一处**本格没有实测**的东西，别当已验：`@media` 那两个断点（900 / 640）里的中间段 901–959，
注释里明写了要 Task 10 专门量 920 / 940 两档才敢定。这一段是"只测两端、中间塌"那类漏法的典型
落点，计划里不替它背书。

`dev/sass/toolkit.scss`（648 行 / 19,240 字节）：

```scss
/*** 在线工具页（/tools/idcard.html 起，`/tools/codec.html`、`/tools/json.html` 共用这一层）***/
//
// 一、像素转视口：postcss.config.js 的黑名单里有 `.tk-` 与 `.jt-` 两条**字符串**。
// 这里必须是字符串而不是 `/^\.tk-/` 那种正则——postcss-px-to-viewport 1.1.1 的
// `blacklistedSelector`（node_modules/postcss-px-to-viewport/index.js:130）对字符串走
// `selector.indexOf(regex) !== -1`（子串命中任意位置），对正则走 `selector.match(regex)`。
// 本层大量规则的最左选择器是 `.tk-workspace .tk-col` 这类后代形式， anchored 正则一条都盖不住；
// 漏掉一条的后果与 about.scss 记的同一种：同一块版面一半按 px 画、一半按 750 设计稿等比放大。
// 代价是黑名单变宽：任何别的文件将来写了带 `.tk-` 子串的选择器也会被一并放过——这两串是本页
// 专用的类名前缀，Task 9 的收录面判据盯着构建产物，不会让它悄悄长到别处。
// `@keyframes` 依然是唯一罩不住的地方（关键帧块的「选择器」是 0%/100%），所以本层不写动画，
// 真要位移就用 tokens.scss 的 `--travel-*`。
//
// 为什么非排除不可：这一层是**桌面密度**的工具排版——13px 表单字、12.5px 表格字、40px 结果行高，
// 全按视口等比放大到 1560px 屏上会变成 27px 的表单项，五块面板拉成三屏。与 `.tool` / `.cmdk` /
// `.reader-` 那几条同一个理由。
//
// 二、样式不认识 JS 的运行状态，只认识 ARIA 与 `hidden`。`panel-dom.js` 的契约是「只写
// `panel.js` 算好的那张属性表，不加 class、不改名、不补默认值」（段 1 计划 §6.0），装配层
// （`workbench.js`）的显隐也只落在 `hidden` 布尔属性上。所以选中态一律写成
// `[aria-selected='true']`，「这一块塌了」写成 `.tk-panel__error`（那个类名由 panel-dom 给，
// 是它唯一的类名钩子）。哪天要改观感，改这里；哪天要改状态形状，改 panel.js 与 §D，两边不串。
//
// 三、配色只走 tokens.scss 的语义变量，本层不写 `.night-mode` 分支——除了三档状态色。
// tokens.scss 的墨阶/纸阶/signal 都是「角色」色，没有「这个校验没过」这一档，而有效 / 校验位不符 /
// 结构非法必须一眼分得开（§5.4：让用户看得见为什么不行）。这三档按 tokens.scss 自己的办法落在
// `:root` 并在 `body.night-mode` 重赋值（见 tokens.scss 文件头第 3 行那句「新组件不必再写第二份
// 覆盖表」——它说的是墨阶纸阶这类已有角色，状态色是本页新造的角色，得自己把夜间值给全）。
// 上收进 tokens.scss 是段 5 的事：那文件此刻有另一个会话在改（09-26 23:01 刚动过），
// 现在去碰它是抢同一支笔。
//
// 四、独立入口拿不到 `$font-display` / `$font-meta`（vite 按 dev/sass/*.scss 逐个打包，
// @import tokens 会把整层令牌复制进本产物）。下面重复的是**字族名**，不是字体文件——
// `@font-face` 归 index.min.css，缺字退 Georgia / SF Mono，中文由栈尾接手。同 about.scss 那条口径。
//
// 五、不写动画，因此本层没有自己的 `prefers-reduced-motion` 块：base.scss:147 那条全局兜底
// 已经把所有 `transition-duration` 压成 .01ms，本层只有颜色过渡与 `:active` 那 1px 按压位移
// （位移由用户按住触发、松手即回，不是装饰性入场）。about.scss / cat.scss 那种 reduce 块是为了
// 撤掉滚动驱动的位移与装饰层，本层没有那种东西可撤。

// 字族：数字与号码一律走 meta（等宽 + 表内对齐），标题走 display，正文交给继承。
$tk-display: 'Newsreader', Georgia, 'Iowan Old Style', 'Times New Roman', 'Songti SC', 'STSong', 'SimSun', serif;
$tk-meta: 'IBM Plex Mono', 'SF Mono', 'JetBrains Mono', Menlo, Consolas, 'Courier New', monospace;

// 三档状态色的白昼值（对 `--surface` `#FFF` 按 WCAG 2.1 相对亮度比现算：绿 6.58、琥珀 5.93、
// 红 7.77，13px 也过 AA 的 4.5；复算命令见段 2 计划 Task 8 Step 3 那段 node 片段）。
:root {
    --tk-ok: #136b3a;
    --tk-warn: #8a5a00;
    --tk-bad: #a31910;
}

body.night-mode {
    // 夜间底是 `--surface` `#191C23`，同一批色名要提亮才够（对同一底现算：绿 8.80、琥珀 8.76、
    // 红 6.74，三档都过 AA）。
    --tk-ok: #5bd08b;
    --tk-warn: #e3b341;
    --tk-bad: #ff7b6b;
}

// ── 版心与整页提示 ────────────────────────────────────────────────────────

.tk-content {
    padding-bottom: 48px;
}

// 合规条与「脚本没执行」那一段：正文级字号，让它读起来像说明而不是装饰。
.tk-compliance {
    margin: 0 0 16px;
    padding: 12px 14px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--ink-2);
    background-color: var(--surface-2);
    border-radius: var(--radius-m);
    box-shadow: inset 2px 0 0 var(--rule-2);
}

.tk-compliance--noscript {
    color: var(--ink);
    box-shadow: inset 2px 0 0 var(--tk-warn);
}

// 坏 hash 提示（默认 `hidden`，由 panel-dom 覆写；启动失败也写这一格，见 toolIdcard.js 口径 3）。
.tk-notice {
    margin: 0 0 12px;
    padding: 10px 12px;
    font-size: 13px;
    color: var(--ink);
    background-color: var(--signal-soft);
    border-radius: var(--radius-m);
    box-shadow: inset 0 0 0 1px var(--rule-2);
}

// 键盘捷径那一行。`<kbd>` 自己占一个视觉重量，别让它跟正文抢。
.tk-kbd {
    margin: 0 0 22px;
    font-size: 12.5px;
    color: var(--ink-3);
}

.tk-kbd kbd {
    padding: 1px 5px;
    font-family: $tk-meta;
    font-size: 11.5px;
    color: var(--ink-2);
    background-color: var(--surface);
    border-radius: var(--radius-s);
    box-shadow: inset 0 0 0 1px var(--rule-2);
}

// ── 工作区：索引条 + 面板 ─────────────────────────────────────────────────

// 176px 是按最长那条面板名定的：`__name` 落的是 yml 的 `name`，最长那条「统一社会信用代码」
// 是八个全角字，14px 下正好 112px，加左右各 10px padding = 132px；剩下的余量给下面那行 12px 的
// `__hint`（tagline）当折行宽度——156px 内容宽，够它每条断成两到三行而不是四行。再宽就把面板
// 挤窄，再窄名字就断。
.tk-workspace {
    display: grid;
    grid-template-columns: 176px minmax(0, 1fr);
    gap: 24px 28px;
    align-items: start;
}

.tk-index {
    position: sticky;
    top: 88px;
    display: grid;
    gap: 2px;
    // 粘性条自己不能被面板压住
    align-self: start;
}

.tk-index__link {
    display: grid;
    gap: 2px;
    padding: 8px 10px;
    font-size: 14px;
    line-height: 1.35;
    color: var(--ink-2);
    text-decoration: none;
    border-radius: var(--radius-m);
    transition: color var(--dur-2) var(--ease-out),
        background-color var(--dur-2) var(--ease-out),
        box-shadow var(--dur-2) var(--ease-out);
}

.tk-index__link:hover {
    color: var(--ink);
    background-color: var(--surface-2);
}

.tk-index__name {
    color: inherit;
}

.tk-index__hint {
    font-size: 12px;
    color: var(--ink-3);
}

// 选中态来自 `panel.js` 写的 `aria-selected`，不是来自某个类名（文件头第二条）。
.tk-index__link[aria-selected='true'] {
    color: var(--signal-ink);
    background-color: var(--signal-soft);
    box-shadow: inset 2px 0 0 var(--tool-accent, var(--signal));
}

.tk-index__link[aria-selected='true'] .tk-index__hint {
    color: inherit;
}

// ── 面板卡片 ──────────────────────────────────────────────────────────────

// `scroll-margin-top: 88px` 是全站同一个数（editorial.scss 那三条），禁 JS 时索引条退成
// 普通锚点链接，跳过去不能被顶栏盖住标题。
.tk-panel {
    box-sizing: border-box;
    padding: 20px 22px 24px;
    background-color: var(--surface);
    border: 1px solid var(--rule);
    border-radius: var(--radius-l);
    box-shadow: var(--shadow-1);
    scroll-margin-top: 88px;
}

.tk-panel__head {
    margin-bottom: 16px;
}

.tk-panel__title {
    margin: 0;
    font-family: $tk-display;
    font-size: 21px;
    font-weight: 600;
    line-height: 1.25;
    color: var(--ink);
}

.tk-panel__tagline {
    margin: 6px 0 0;
    font-family: $tk-meta;
    font-size: 11.5px;
    letter-spacing: .6px;
    color: var(--ink-3);
}

.tk-panel__desc {
    margin: 8px 0 0;
    font-size: 13.5px;
    line-height: 1.7;
    color: var(--ink-2);
}

// `panel-dom` 插在面板最前面的一条 `role="alert"`，文案里带着抛错原话（可能是用户粘进去的串），
// 所以它写 `textContent`、这里也只认这一条类名。
.tk-panel__error {
    margin: 0 0 14px;
    padding: 10px 12px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--ink);
    background-color: var(--surface-2);
    border-radius: var(--radius-m);
    box-shadow: inset 0 0 0 1px var(--tk-bad);
}

// ── 一屏两栏：左生成、右判定 ──────────────────────────────────────────────

.tk-cols {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px 24px;
    align-items: start;
}

.tk-cols--one {
    grid-template-columns: minmax(0, 1fr);
}

.tk-col__title {
    margin: 0 0 10px;
    font-family: $tk-meta;
    font-size: 11.5px;
    letter-spacing: 1.2px;
    color: var(--ink-3);
}

// ── 表单 ──────────────────────────────────────────────────────────────────

// `div[role=group]` 而不是 `<form>`：没有后端可交，form 的隐式提交会把整页刷成
// `?tk-in-idcard-count=5`（骨架里那段注释记的是同一件事）。
.tk-form {
    margin-bottom: 14px;
}

.tk-field {
    display: grid;
    gap: 6px;
    margin: 0 0 14px;
}

.tk-field > label {
    font-size: 13px;
    line-height: 1.4;
    color: var(--ink-2);
}

.tk-field input,
.tk-field select,
.tk-field textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 7px 9px;
    font-family: inherit;
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--ink);
    background-color: var(--surface);
    border: 1px solid var(--rule-2);
    border-radius: var(--radius-m);
    transition: border-color var(--dur-1) var(--ease-out),
        box-shadow var(--dur-1) var(--ease-out);
}

.tk-field textarea {
    font-family: $tk-meta;
    font-size: 13px;
    resize: vertical;
}

// 数字、日期与号码框里的内容是要对着看的，等宽更稳。
.tk-field input[type='number'],
.tk-field input[type='date'] {
    font-family: $tk-meta;
    font-variant-numeric: tabular-nums;
}

.tk-field input:hover,
.tk-field select:hover,
.tk-field textarea:hover {
    border-color: var(--ink-4);
}

.tk-field select,
.tk-field input,
.tk-field textarea {
    cursor: text;
}

.tk-field select {
    cursor: default;
}

// 级联格子被 `workbench.js` 置 `disabled` 时的样子：不能只靠 opacity（灰字压到灰底上会掉对比）。
.tk-field :is(input, select, textarea):disabled {
    color: var(--ink-3);
    cursor: not-allowed;
    background-color: var(--surface-2);
    border-color: var(--rule);
}

.tk-field--static > label {
    color: var(--ink-3);
}

.tk-field--count input {
    max-width: 120px;
}

// 三级区划并排：窄一格就换行，不横向滚（手机上拖三条 select 比折成两行难受得多）。
.tk-cascade {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.tk-cascade select {
    flex: 1 1 120px;
    min-width: 0;
}

.tk-help {
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--ink-3);
}

.tk-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
}

.tk-btn {
    display: inline-flex;
    align-items: center;
    height: 34px;
    padding: 0 16px;
    font-family: inherit;
    font-size: 13.5px;
    color: var(--paper);
    cursor: pointer;
    background-color: var(--ink);
    border: 0;
    border-radius: var(--radius-m);
    transition: color var(--dur-2) var(--ease-out),
        background-color var(--dur-2) var(--ease-out),
        box-shadow var(--dur-2) var(--ease-out);
}

.tk-btn:hover {
    color: var(--paper);
    background-color: var(--ink-2);
}

.tk-btn:active {
    transform: translateY(1px);
}

// `--paper` / `--ink` 是一对会随夜间整体翻转的角色色，所以主按钮在两套主题下都是「深底浅字」或
// 「浅底深字」，对比度恒等；换成 `--signal` 打底就要在夜间反过来管文字色，那是第二份口径。
.tk-btn--ghost {
    color: var(--ink-2);
    background-color: transparent;
    box-shadow: inset 0 0 0 1px var(--rule-2);
}

.tk-btn--ghost:hover {
    color: var(--ink);
    background-color: var(--surface-2);
    box-shadow: inset 0 0 0 1px var(--ink-4);
}

.tk-btn:disabled {
    color: var(--ink-3);
    cursor: not-allowed;
    background-color: var(--surface-2);
    box-shadow: inset 0 0 0 1px var(--rule);
}

.tk-btn--ghost:disabled:hover {
    color: var(--ink-3);
    background-color: var(--surface-2);
    box-shadow: inset 0 0 0 1px var(--rule);
}

// ── 结果区 ────────────────────────────────────────────────────────────────

.tk-outwrap {
    display: grid;
    gap: 10px;
    justify-items: start;
}

// 结果区自己横向滚动：号码、算式与 9 列明细不能被挤成竖排（那是这类表格最坏的读法）。
.tk-out {
    width: 100%;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.6;
    color: var(--ink-2);
}

.tk-count {
    margin: 0 0 8px;
    font-family: $tk-meta;
    font-size: 11.5px;
    letter-spacing: .6px;
    color: var(--ink-3);
}

.tk-hint {
    margin: 8px 0 0;
    padding: 8px 10px;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--ink-2);
    background-color: var(--surface-2);
    border-radius: var(--radius-m);
}

.tk-note {
    margin: 8px 0 0;
    font-size: 12.5px;
    line-height: 1.65;
    color: var(--ink-3);
}

.tk-echo {
    margin: 6px 0 0;
    font-size: 12.5px;
    color: var(--ink-2);
}

.tk-mono {
    font-family: $tk-meta;
    font-variant-numeric: tabular-nums;
}

.tk-table {
    width: 100%;
    margin: 4px 0 10px;
    font-size: 12.5px;
    border-collapse: collapse;
}

.tk-table th,
.tk-table td {
    padding: 5px 8px;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid var(--rule);
}

.tk-table thead th {
    font-family: $tk-meta;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--ink-3);
    background-color: var(--surface-2);
}

.tk-table tbody tr:last-child > * {
    border-bottom: 0;
}

// 明细表与前缀表是「宁可横向滚也不折行」的那两张（九列一行的明细，压窄只会读成竖排）；
// 判定表与生成表相反——`tk-list--address` 那一列是整条地址，`min-width: max-content` 会把它
// 顶成 400px 宽的一行，反而要滚。号码不换行靠的是下面那条 `white-space: nowrap`，只保号码本身。
.tk-detail,
.tk-matches {
    min-width: max-content;
}

.tk-table .tk-mono {
    white-space: nowrap;
}

.tk-checks td {
    color: var(--ink-2);
}

.tk-verdict {
    margin: 0 0 8px;
}

.tk-state {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 8px;
    font-family: $tk-meta;
    font-size: 11.5px;
    border-radius: 999px;
    box-shadow: inset 0 0 0 1px currentColor;
}

.tk-state--ok {
    color: var(--tk-ok);
}

.tk-state--warn {
    color: var(--tk-warn);
}

.tk-state--bad {
    color: var(--tk-bad);
}

// 未收录与等待输入都不是「结论」，用墨阶而不是状态色，避免读者把它们读成通过/失败。
.tk-state--unknown {
    color: var(--ink-2);
}

.tk-state--idle {
    color: var(--ink-3);
}

.tk-result {
    padding: 2px 0 2px 12px;
    border-inline-start: 2px solid var(--rule-2);
}

.tk-result--ok {
    border-inline-start-color: var(--tk-ok);
}

.tk-result--warn {
    border-inline-start-color: var(--tk-warn);
}

.tk-result--bad {
    border-inline-start-color: var(--tk-bad);
}

.tk-lines {
    display: grid;
    gap: 16px;
}

.tk-line {
    padding-bottom: 14px;
    border-bottom: 1px solid var(--rule);
}

.tk-line:last-child {
    padding-bottom: 0;
    border-bottom: 0;
}

.tk-line__head {
    margin: 0 0 6px;
    font-size: 12px;
    color: var(--ink-3);
}

.tk-line__raw {
    font-family: $tk-meta;
    font-size: 12.5px;
    color: var(--ink);
    word-break: break-all;
}

.tk-batch {
    display: block;
}

// ── 断点 ──────────────────────────────────────────────────────────────────
// 900 / 640 两个数是本层自己的口径，与 `$g-container-w`（960）不是一回事：960 是版心从固定宽
// 转为 auto，900 是「176px 索引条 + 两栏面板」还挤得下的下沿。中间那段（901–959）版心已经收窄
// 而索引条还在——**这一段本格没有实测**：Task 10 的断点清单要专门量 920 / 940 两档（"只测两端、
// 中间塌"就是这一类漏法），量出来挤就把 900 这个数往上调，别照着注释以为已经量过。

@media screen and (max-width: 900px) {
    .tk-workspace {
        grid-template-columns: minmax(0, 1fr);
        gap: 18px;
    }

    // 索引条退成横向 chip：粘着顶栏没有意义（一屏放不下面板又得躲开 chip 条），改成随页滚走。
    .tk-index {
        position: static;
        grid-auto-flow: column;
        gap: 8px;
        padding-bottom: 4px;
        overflow-x: auto;
    }

    .tk-index__link {
        flex: none;
        gap: 0;
        padding: 6px 10px;
        font-size: 13px;
        white-space: nowrap;
    }

    // 提示语在 chip 里就是噪音，且它撑宽了每一颗 chip（五条不等宽很难看）。
    .tk-index__hint {
        display: none;
    }

    .tk-index__link[aria-selected='true'] {
        box-shadow: inset 0 0 0 1px var(--tool-accent, var(--signal));
    }
}

@media screen and (max-width: 640px) {
    .tk-panel {
        padding: 16px 14px 18px;
    }

    // 生成与判定在窄屏上下排：判定栏的粘贴框需要整幅宽度，两栏并排时它只有 280px，粘一行号码
    // 都看不见尾段。
    .tk-cols {
        grid-template-columns: minmax(0, 1fr);
        gap: 22px;
    }

    .tk-outwrap {
        justify-items: stretch;
    }

    .tk-btn {
        height: 38px;
    }
}
```

**2026-09-27 落地实跑（Step 3）**：`dev/sass/toolkit.scss` 写出 648 行 / 19,240 B，与计划块逐字节全等。
上面那条复算命令**照抄时要连围栏一起数**：载荷块是 10655–10666，可第 10655 行是 `node -e '`、
第 10666 行是收尾的那枚 `'`，把整块当 JS 抽出来落 `.cjs` 会 `SyntaxError: Invalid or unexpected token`
（第一次就红在这儿，不是判据红）。按 10656–10665 抽那 10 行才是 JS 本体，跑出来三行与 Expected
逐个字符相同。六个色值另有一道对账：`grep -n "136b3a\|8a5a00\|a31910\|5bd08b\|e3b341\|ff7b6b"
dev/sass/toolkit.scss` 命中第 48–50 与 56–58 行，即 `:root` 与 `body.night-mode` 两半各三条——
**注释里写的数与文件里赋的色是同一批字面量**，这条不是恒真（改色不改注释就会红）。

**把 AA 那句话算全**：Expected 那两行只对着"默认纸 + `--surface: #FFF`"这一格，而三档纸色温会重赋
`--surface`（cool `#FFFFFF`、sage `#FAFCF8`），`.tk-state` 是 11.5px 小字、也可能落在 `--surface-2`
（暖 `#F4F2ED` / 冷 `#EFF1F5` / sage `#E6EDE3`）上，夜间还有 `#20242C` 与 `#12141A`。九组逐档复算
（同一套 WCAG 相对亮度，`#FFF` 那档走 `hex()` 展开 3 位写法）：白昼三档纸 × 两层底最低 **4.96**
（sage 的 `--surface-2` 上的 `--tk-warn`），夜间三底最低 **6.15**（`#20242C` 上的 `--tk-bad`）——
**全部 ≥ AA 4.5，判据在纸色温三档与两层底色上同时成立**，比注释里那一行更强。这九组数不进产物，
所以留在记录里；Task 10 的 headless 量色按同一张底去采样，别只量默认纸。

- [x] **Step 4: `postcss.config.js` 加两条字符串——正反各跑一次构建，跑完还原并证明回到基线**

改法是一处两件事：第 81 行 `':focus-visible'` 是当时数组的**最后一项**、原本不带逗号，追加元素之前
得先把那枚逗号补上；然后在它之后追加 7 行（5 行理由注释 + 2 条字符串）。文件 87 行 → 94 行。
漏掉逗号那一头不是风格问题——`['a' 'b']` 在 JS 里是语法错误，`vite build` 当场红，而且红在构建日志
里、不红在任何判据上。为了这段改动可逐字节复现，下面给的是**整段替换第 81 行**的结果：第一行就是
补了逗号的原行（`//` 仍停在第 28 列，所以逗号后面少一个空格），后 7 行是新增。

```javascript
        ':focus-visible',     // 裸伪类选择器同上，2px 描边不能被放大成 vw
        // 在线工具三页（/tools/idcard.html 起）。这两串必须是**字符串**而不是 /^\.tk-/ 这种正则：
        // postcss-px-to-viewport@1.1.1 的 blacklistedSelector 对字符串走 `selector.indexOf(s)`
        // （任意位置子串命中），对正则走 `selector.match(re)`，而本层大量规则的最左选择器是
        // `.tk-workspace .tk-col` 这类后代形式，anchored 正则一条都盖不住。
        // 漏一条的后果与 /^\.mao_box/ 那条注释记的同一种：同一块版面一半按 px、一半按 750 设计稿放大。
        '.tk-',               // 证件页 / 编码工具箱页（前缀 tk）
        '.jt-'                // JSON 工作台（前缀 jt，§6.4 两条黑名单前缀的另一条）
```

**这一步的判据是"少写一条会怎样"，那只有把两条拿掉、重建一次才看得见。** 正反两跑，跑完必须
还原并证明产物字节回到原样——不许只留一头的数（09-26 那回变体测量没逐档还原，读到的全是上一轮
旧产物）。开工前先确认这支笔没人在用：

```bash
cd "$(git rev-parse --show-toplevel)"
test -z "$(git status --porcelain postcss.config.js)" \
  || { echo 'postcss.config.js 已有未提交改动，先停下来分清是谁的（还原要用 git checkout）'; exit 1; }
npx vite build >/tmp/t8-on.log 2>&1; echo "带两条 build exit=$?"
md5 -q postcss.config.js assets/css/toolkit.min.css | tee /tmp/t8-baseline.md5
node -e '
const fs = require("fs");
const css = fs.readFileSync("assets/css/toolkit.min.css", "utf8");
const rules = css.split("}").map((s) => s.trim()).filter(Boolean);
const tk = rules.filter((r) => r.includes(".tk-"));
const bad = tk.filter((r) => /[-:][0-9.]+vw/.test(r));
console.log(`[带两条] 规则 ${rules.length}｜.tk- ${tk.length}｜被换算 ${bad.length}｜产物 ${fs.statSync("assets/css/toolkit.min.css").size} B`);
'
```

Expected（2026-09-27 镜像实跑）：`build exit=0`，
`[带两条] 规则 88｜.tk- 86｜被换算 0｜产物 9321 B`。那 2 条不带 `.tk-` 的规则是 `:root` 与
`body.night-mode`，也就是三档状态色的两半——**它们必须在**，少了任何一半就是夜间色失联。

再把两条临时拿掉，跑同一份量程（锚点必须命中、必须两条都没剩下，否则这一档的数字不作数）：

```bash
node -e '
const fs = require("fs"), p = "postcss.config.js";
const t = fs.readFileSync(p, "utf8");
const out = t.replace(/^[ \t]*\x27\.tk-\x27,.*\n/m, "").replace(/^[ \t]*\x27\.jt-\x27.*\n/m, "");
if (out === t) { console.error("锚点未命中：两条字符串一条都没删掉"); process.exit(1); }
if (/[\x27\x22]\.t[kj]-[\x27\x22]/.test(out)) { console.error("还留着一条，删干净再比"); process.exit(1); }
fs.writeFileSync(p, out);
console.log("已去掉两条，剩余行数", out.split("\n").length - 1);
'
npx vite build >/tmp/t8-off.log 2>&1; echo "去掉两条 build exit=$?"
node -e '
const fs = require("fs");
const css = fs.readFileSync("assets/css/toolkit.min.css", "utf8");
const rules = css.split("}").map((s) => s.trim()).filter(Boolean);
const tk = rules.filter((r) => r.includes(".tk-"));
const bad = tk.filter((r) => /[-:][0-9.]+vw/.test(r));
console.log(`[去掉两条] 规则 ${rules.length}｜.tk- ${tk.length}｜被换算 ${bad.length}｜产物 ${fs.statSync("assets/css/toolkit.min.css").size} B｜整份 vw 出现 ${(css.match(/[0-9.]vw/g) || []).length} 次`);
bad.slice(0, 3).forEach((r) => console.log("   ", r.slice(0, 86)));
'
```

Expected（镜像实跑，两组之间只改了 postcss 配置这一件事）：

```
[去掉两条] 规则 88｜.tk- 86｜被换算 48｜产物 9716 B｜整份 vw 出现 106 次
    .tk-content{padding-bottom:6.4vw
    .tk-compliance{margin:0 0 2.13333vw;padding:1.6vw 1.86667vw;font-size:1.73333vw;line-height:1.7;c
    .tk-notice{margin:0 0 1.6vw;padding:1.33333vw 1.6vw;font-size:1.73333vw;color:var(--ink);background
```

86 条 `.tk-` 规则里 48 条被换成 vw——这就是"漏一条黑名单"的具体形状：`13px` 的表单字变成
`3.46667vw`，1560 屏上 27px。剩下 38 条没被换，是因为它们本来就没写 px（无单位行高、`50%`、
`var(--…)`）。这条也是 Step 5 那条"整份 vw 次数 = 0"的判据为什么值得留着：**它不是恒真**，
配置一退化就立刻有数。

跑完还原，并证明回到基线字节：

```bash
git checkout -- postcss.config.js && git status --porcelain postcss.config.js && echo "已还原（上面无输出=干净）"
npx vite build >/tmp/t8-restore.log 2>&1; echo "还原后 build exit=$?"
md5 -q postcss.config.js assets/css/toolkit.min.css > /tmp/t8-after.md5
diff /tmp/t8-baseline.md5 /tmp/t8-after.md5 && echo "✓ 配置与产物都回到基线字节"
```

Expected：`✓ 配置与产物都回到基线字节`。镜像里还原后的产物 md5 是 `5c6b51cfc738…`，与
`bundle exec jekyll build` 复制进 `_site/assets/css/` 的那份逐字节相同——Step 5 的第 0 组判据
就把这件事写成断言，防的是"读了旧副本还以为量的是本轮"。

**2026-09-27 落地实跑（Step 4，真仓库、非镜像）**：正反两跑的数与镜像档逐个相同——
带两条 `规则 88｜.tk- 86｜被换算 0｜产物 9,321 B`，去掉两条 `被换算 48｜产物 9,716 B｜整份 vw 出现
106 次`，`build exit=0` 三档全同；产物 md5 两档分别是 `5c6b51cfc738…`（基线）与 `455efbe4ecde…`
（去掉两条），第 0 组那条同源断言在后者那一档会直接红。改法照载荷：第 81 行整行换成 8 行，
文件 87 → 94 行，`git diff --numstat` 记 `8 1`。**这一格有三处计划缺陷，都是"照抄会红"的形状**：

1. **开头那道守卫的顺序是错的**。`test -z "$(git status --porcelain postcss.config.js)" || exit 1`
   写在本格第一条命令位，可它的用意是"开工前确认这支笔没人在用"——只有在工作树**还没被本格改过**
   时才有意义。落地时载荷已经贴上去了，这道守卫必然红。现场改用两件等价的证据替它：
   `git diff --numstat -- postcss.config.js` 恰为 `8 1`（除本格那处没人碰过），
   与 `git log -1 --format=%h -- postcss.config.js` = `cd249d1`（2026-09-25，早于本格）。
   **改法**：把守卫挪到贴载荷之前，或者按现在这样把它读成"证明本轮改动只有这一处"。
2. **`git checkout -- postcss.config.js` 在提交前回不到基线**。"跑完还原并证明回到基线字节"用的
   是 HEAD 那份，而 `'.tk-'` / `'.jt-'` 这两条字符串此刻还只在工作树里（本格 Step 7 才提交），
   checkout 于是把基线打回 9,716 B / `455efbe4…` 那一档——**恰好是被换算那一档**。现场按 Step 4
   的载荷重贴 8 行、重建一次才回到 `5c6b51cfc738…`。**改法**：这一档的还原要写成"重贴载荷"而不是
   `git checkout`，或者把 Step 7 的提交挪到 Step 4 之前（后者会破坏"未验证先入库"的纪律，不采纳）。
   提交之后（`8fc3078`）checkout 这条路才真正成立。
3. **样例切片宽度会读成缺陷**。`bad.slice(0, 3).forEach(… r.slice(0, 86))` 打出来的第三条停在
   `…line-height:1.7;c` 那个 `c` 上——那是 86 字符硬切，不是 CSS 里有个坏字符。照抄 Expected 的
   人若在找"`;c` 是什么鬼"，找的是打印格式。

还记一件现场形状：`/tmp/t8*` 这批脚手架在 Step 4 与 Step 5 之间被外部清掉过一次（镜像 `/tmp/t7`、
`/tmp/t8` 与日志一并没了）。这不影响任何已转写进本格的数，但**它影响"能不能复跑"**：Step 5 那份
核验脚本与 Step 1 那份 `.rb` 都是从计划载荷重抽重建的（先断言行数再跑），不是回忆手抄。

- [x] **Step 5: 全量构建 + 产物核验（十组共五十四项，现算现打）**

骨架与样式没有测试判据可跑（§J 判的是 JS 层，Node 里的假 DOM 读不到磁盘上的字节），这一格的
"绿"就是这张产物核验表。先建一次完整站点，再跑核验脚本：

```bash
cd "$(git rev-parse --show-toplevel)"
npx vite build >/tmp/t8-vite.log 2>&1; echo "vite exit=$?"
bundle exec jekyll build --quiet >/tmp/t8-jekyll.log 2>&1; echo "jekyll exit=$?"
```

Expected：两条 `exit=0`。jekyll 那行之前会刷一条 `Your RubyGems version (3.0.3.1) has a bug…`，
是本机环境的固定噪音，不参与判定。

```bash
cat > /tmp/t8-verify-render.mjs <<'VERIFY_EOF'
/**
 * 证件页构建产物核验（Task 8 Step 5 的正文）。
 *
 * 判的全是"磁盘上的字节"，与 §J 那十六条（判 JS 层）互不顶替。三条纪律：
 *  1. **一律 scoped**：整页 grep 会被站点公共件（书架 dialog 的 3 个 role="tab"、cmdk 的
 *     role="listbox"）污染，所以每条判据先切出自己要看的区间再数。
 *  2. **先自证读的是本轮产物**：vite 的 outDir 是仓库根的 `assets/`，`_site/assets/` 那份是
 *     jekyll 复制出来的；只读 _site 会在 vite 没重跑时量到上一轮旧产物（09-27 栽过一次）。
 *     故第一组判据断言两处同 md5。
 *  3. 数值全部现算现打，不在脚本里写死——写死的数字下一轮就不成立了。
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const md5 = (buf) => createHash('md5').update(buf).digest('hex');

const read = (p) => { const b = readFileSync(p); return { text: b.toString('utf8'), bytes: b.length }; };
const [HTMLF, CSSF, COREF, ENTRYF, SMTF] = [
  process.argv[2] || '_site/tools/idcard.html', process.argv[3] || 'assets/css/toolkit.min.css',
  process.argv[4] || 'assets/js/toolkitCore.min.js', process.argv[5] || 'assets/js/toolIdcard.min.js',
  process.argv[6] || '_site/sitemap.xml',
].map(read);
const [HTML, CSS, CORE, ENTRY, SITEMAP] = [HTMLF, CSSF, COREF, ENTRYF, SMTF].map((f) => f.text);

/** 切出 [从, 到) 之间的那一段；`to` 缺省到文件尾。找不到就抛——静默返回空串会判成"0 命中=过"。 */
function slice(str, fromNeedle, toNeedle) {
  const a = str.indexOf(fromNeedle);
  if (a < 0) throw new Error(`找不到起点 ${fromNeedle}`);
  if (!toNeedle) return str.slice(a);
  const b = str.indexOf(toNeedle, a);
  if (b < 0) throw new Error(`找不到终点 ${toNeedle}`);
  return str.slice(a, b);
}
const hits = (s, re) => (s.match(re) || []).length;

const out = {};

/* ── 0. 读的是本轮产物：jekyll 那份 _site 与 vite 那份 assets 必须同 md5 ───── */
out['0-产物同源'] = (() => {
  try {
    const a = md5(readFileSync('assets/css/toolkit.min.css'));
    const b = md5(readFileSync('_site/assets/css/toolkit.min.css'));
    return a === b ? `✓ toolkit.min.css 两处同 md5 ${a.slice(0, 12)}` : `✗ 不同 md5：vite ${a.slice(0, 12)} vs _site ${b.slice(0, 12)}（vite 没重跑或 _site 是旧的）`;
  } catch (e) {
    return `✗ 读不到 ${e.message.split(' ')[1] || '产物'}`;
  }
})();

/* ── 1. 骨架结构：五块面板 / 索引条 / 正文齐 ─────────────────────────────── */
out['1-面板齐'] = [...HTML.matchAll(/id="tk-panel-([a-z]+)"/g)].map((m) => m[1]).join(',');
out['1-面板数'] = hits(HTML, /id="tk-panel-[a-z]+"/g);
out['1-索引链接'] = hits(HTML, /class="tk-index__link"/g);
out['1-锚点'] = [...HTML.matchAll(/class="tk-index__link"[^>]*href="#([a-z]+)"/g)].map((m) => m[1]).join(',');
out['1-栏标题h3'] = hits(HTML, /<h3 class="tk-col__title"/g);
out['1-面板标题h2'] = hits(HTML, /<h2 class="tk-panel__title"/g);
out['1-面板说明p'] = hits(HTML, /<p class="tk-panel__desc"/g);
out['1-结果区'] = hits(HTML, /id="tk-out-[a-z]+-(gen|read)"/g);
out['1-HTML字节'] = HTMLF.bytes;

/* ── 2. 构建期正文：yml 里那五条 desc 的开头字样必须真在 HTML 里 ──────────── */
const descHeads = ['粘一行或一个文件的多行号码', '校验第 1–17 位的字符集', '校验按 Luhn 与 13–19 位',
  '格式（11 位、1[3-9] 开头）', '姓名由本站自造的常用姓氏'];
out['2-五条说明落进HTML'] = descHeads.map((s) => (HTML.includes(s) ? 'Y' : 'N')).join('');

/* ── 3. ARIA（scoped）：骨架不写索引条/面板的 ARIA，运行时才覆写 ─────────── */
const navSeg = slice(HTML, '<nav class="tk-index"', '</nav>');
out['3-索引条里的ARIA'] = hits(navSeg, /\b(role|aria-[a-z]+|tabindex|hidden)[= ]/g);
const panelTags = [...HTML.matchAll(/<section class="tk-panel[^"]*" id="tk-panel-[a-z]+"[^>]*>/g)]
  .map((m) => m[0]).join('\n');
out['3-面板起始标签里的role或hidden'] = hits(panelTags, /\b(role=|hidden=)/g);
/* 骨架自己写的两类：表单分组与结果区，各 9 */
out['3-role=group'] = hits(HTML, /role="group"/g);
out['3-role=region'] = hits(HTML, /role="region"/g);
out['3-region带aria-live'] = hits(HTML, /role="region" aria-live="polite"/g);
out['3-整页role=tab'] = hits(HTML, /role="tab"/g);
out['3-整页role=tablist'] = hits(HTML, /role="tablist"/g);
out['3-tab命中所在行'] = [...HTML.split('\n').keys()].filter((i) => /role="tab"/.test(HTML.split('\n')[i])).map((i) => i + 1).join(',');
/* 禁 JS 时五块全展开 = `<main>` 区间里除 `#tk-notice` 那格外没有任何 `hidden`：显隐只由
   panel-dom 运行期写，脚本不在就没人写。这一条是 `<noscript>` 那段文案的唯一硬证据。 */
const mainSeg = slice(HTML, '<main', '</main>');
out['3-main区间hidden数'] = hits(mainSeg, /\bhidden\b/g);
out['3-hidden落点'] = mainSeg.split('\n').filter((l) => /\bhidden\b/.test(l))
  .map((s) => s.trim().slice(0, 60)).join(' | ') || '（无）';

/* ── 4. 表单与按钮 ─────────────────────────────────────────────────────── */
out['4-form标签'] = hits(HTML, /<form\b/g);
out['4-提交按钮'] = hits(HTML, /id="tk-btn-[a-z]+-(gen|read)"/g);
out['4-复制按钮'] = hits(HTML, /id="tk-copy-[a-z]+-(gen|read)"/g);
out['4-复制按钮初始disabled'] = [...HTML.matchAll(/<button[^>]*id="tk-copy-[a-z]+-(gen|read)"[^>]*>/g)]
  .filter((m) => /\bdisabled\b/.test(m[0])).length;

/* ── 5. 前缀四格与 data-tk-*（行为靠它们接线） ───────────────────────────── */
const box = slice(HTML, '<div class="tk-workspace"', '>');
out['5-容器四格'] = ['ids', 'prefix', 'label', 'notice'].map((k) => {
  const m = new RegExp(`data-tk-${k}="([^"]*)"`).exec(box);
  return m ? `${k}=${m[1]}` : `${k}=✗`;
}).join(' | ');
out['5-cascade'] = hits(HTML, /data-tk-cascade="([a-z]+)"/g);
out['5-cascade值'] = [...new Set([...HTML.matchAll(/data-tk-cascade="([a-z]+)"/g)].map((m) => m[1]))].join(',');
out['5-options'] = hits(HTML, /data-tk-options="([a-z]+)"/g);
out['5-options值'] = [...HTML.matchAll(/data-tk-options="([a-z]+)"/g)].map((m) => m[1]).join(',');
out['5-charsets'] = hits(HTML, /data-tk-charsets="([a-z]+)"/g);
out['5-switch'] = hits(HTML, /data-tk-switch\b/g);
out['5-when段'] = [...HTML.matchAll(/id="tk-when-([a-z-]+)" data-tk-when="([^"]*)"/g)]
  .map((m) => `${m[1]}⇒${m[2]}`).join(' , ');

/* ── 6. 引用与顺序：css 一条、js 两条按序、canonical、无 defer/module ─────── */
/* 只认 src/href 里的那一处：骨架第 306 行的注释把三个产物名都念了一遍，按 `indexOf(名字)`
   定位会命中注释、把"排在正文之后"判成假红（09-27 实跑抓到）。 */
const srcIdx = (name) => HTML.indexOf(`src="/better-blog/assets/js/${name}`);
out['6-canonical'] = (/<link rel="canonical" href="([^"]+)">/g.exec(HTML) || ['✗ 缺 canonical'])[1];
out['6-三处引用'] = HTML.split('\n').map((l, i) => [i + 1, l.trim()])
  .filter(([, l]) => /["']\/better-blog\/assets\/(css|js)\/(toolkit|toolkitCore|toolIdcard|toolJson)[^"']*\.min\.(css|js)["']/.test(l))
  .map(([n, l]) => `${n}:${l.slice(0, 78)}`).join('\n   ');
out['6-core排在entry之前'] = srcIdx('toolkitCore') < srcIdx('toolIdcard') ? 'Y' : 'N';
out['6-两条排在正文之后'] = [
  srcIdx('toolIdcard') > HTML.lastIndexOf('</main>') ? 'Y' : 'N',
  srcIdx('toolkitCore') > HTML.indexOf('id="tk-panel-random"') ? 'Y' : 'N',
].join('');
out['6-两条上无defer或module'] = [...HTML.matchAll(/<script[^>]*toolkit(?:Core|Idcard)\.min\.js[^>]*>/g)]
  .filter((m) => /defer|async|type="module"/.test(m[0])).length;
out['6-整页defer或module'] = hits(HTML, /<script[^>]*(defer|type="module")/g);
out['6-baseurl展开'] = hits(HTML, /["'](\/better-blog\/assets\/)[^"']*toolkit[^"']*["']/g)
  + hits(HTML, /["'](\/better-blog\/assets\/)[^"']*toolIdcard[^"']*["']/g);
out['6-未展开的Liquid'] = hits(HTML, /\{\{|\{%/g);

/* ── 7. 收录面：本格不该进 sitemap（Task 9 才接） ────────────────────────── */
out['7-sitemap命中'] = hits(SITEMAP, /tools\/idcard/g);

/* ── 8. CSS 产物：.tk- 规则不许被 px→vw 换算 ────────────────────────────── */
const cssRules = CSS.split('}').map((s) => s.trim()).filter(Boolean);
out['8-CSS字节'] = CSSF.bytes;
out['8-.tk-规则'] = cssRules.filter((r) => r.includes('.tk-')).length;
out['8-.tk-规则含vw'] = cssRules.filter((r) => r.includes('.tk-') && /[-:][0-9.]+vw/.test(r)).length;
out['8-整份vw次数'] = hits(CSS, /[0-9.]vw/g);

/* ── 9. JS 产物：共享 chunk 红线 + window.Tk 交接 + 顶层 export ───────────── */
out['9-core字节'] = COREF.bytes;
out['9-entry字节'] = ENTRYF.bytes;
out['9-页面字节'] = HTMLF.bytes;
out['9-import残留'] = hits(CORE, /\bimport[{( ]/g) + hits(ENTRY, /\bimport[{( ]/g);
out['9-顶层export'] = hits(CORE, /^export /gm) + hits(ENTRY, /^export /gm);
out['9-window.Tk'] = hits(CORE, /window\.Tk/g);
out['9-entry读Tk'] = hits(ENTRY, /window\.Tk|globalThis\.Tk/g);
out['9-IIFE包裹'] = [CORE, ENTRY].map((s) => (s.trimStart().startsWith('(function(') ? 'Y' : 'N')).join('');

console.log(JSON.stringify(out, null, 1));
VERIFY_EOF
node /tmp/t8-verify-render.mjs
```

脚本干三条纪律性的事，读代码前先看完这三条：

1. **判据一律 scoped。** 整页 `grep role="tab"` 命中 3 次，但那是 288–290 行、`_includes/header.html`
   里书架对话框的三个分区按钮；本页的索引条与面板起始标签里必须一个 `role` 都没有。所以下面
   第 3 组数的是 `<nav class="tk-index">…</nav>` 那一段与五块 `<section class="tk-panel" …>` 的
   起始标签，整页那一列只作对照打出来。
2. **先自证读的是本轮产物。** vite 的 `outDir` 是仓库根的 `assets/`，`_site/assets/` 是 jekyll
   复制过去的副本。第 0 组判据断言两处 `toolkit.min.css` 同 md5——写这份计划时我先踩了这条，
   拿旧 `_site` 做"去掉黑名单也不会换算"的"反证"，差点把一条有效判据写成无效的（Step 4 那组
   48 条就是重跑之后才拿到的）。
3. **`slice()` 找不到锚点直接抛，不返回空串。** 判据里"0 命中"是过，可如果那段根本没切出来，
   "0 命中"就是一次假过。

Expected（2026-09-27 镜像实跑，逐行照抄；`3-hidden落点` 那一行里的 `\"` 是 JSON 自己的转义）：

```json
{
 "0-产物同源": "✓ toolkit.min.css 两处同 md5 5c6b51cfc738",
 "1-面板齐": "idcard,uscc,bankcard,mobile,random",
 "1-面板数": 5,
 "1-索引链接": 5,
 "1-锚点": "idcard,uscc,bankcard,mobile,random",
 "1-栏标题h3": 9,
 "1-面板标题h2": 5,
 "1-面板说明p": 5,
 "1-结果区": 9,
 "1-HTML字节": 56542,
 "2-五条说明落进HTML": "YYYYY",
 "3-索引条里的ARIA": 0,
 "3-面板起始标签里的role或hidden": 0,
 "3-role=group": 9,
 "3-role=region": 9,
 "3-region带aria-live": 9,
 "3-整页role=tab": 3,
 "3-整页role=tablist": 1,
 "3-tab命中所在行": "288,289,290",
 "3-main区间hidden数": 1,
 "3-hidden落点": "</noscript><p class=\"tk-notice\" id=\"tk-notice\" hidden></p><p",
 "4-form标签": 0,
 "4-提交按钮": 9,
 "4-复制按钮": 9,
 "4-复制按钮初始disabled": 9,
 "5-容器四格": "ids=idcard,uscc,bankcard,mobile,random | prefix=tk | label=证件与机构代码工具 | notice=tk-notice",
 "5-cascade": 8,
 "5-cascade值": "province,city,county",
 "5-options": 5,
 "5-options值": "banks,cardtypes,carriers,segments,domains",
 "5-charsets": 2,
 "5-switch": 2,
 "5-when段": "idcard-birth⇒custom , random-givelen⇒name profile , random-addr⇒address profile , random-domain⇒email profile",
 "6-canonical": "https://liaolongdong.github.io/better-blog/tools/idcard.html",
 "6-三处引用": "310:<link rel=\"stylesheet\" href=\"/better-blog/assets/css/toolkit.min.css\"><section\n   720:</main><script src=\"/better-blog/assets/js/toolkitCore.min.js\"></script>\n   721:<script src=\"/better-blog/assets/js/toolIdcard.min.js\"></script>",
 "6-core排在entry之前": "Y",
 "6-两条排在正文之后": "YY",
 "6-两条上无defer或module": 0,
 "6-整页defer或module": 1,
 "6-baseurl展开": 3,
 "6-未展开的Liquid": 0,
 "7-sitemap命中": 0,
 "8-CSS字节": 9321,
 "8-.tk-规则": 86,
 "8-.tk-规则含vw": 0,
 "8-整份vw次数": 0,
 "9-core字节": 18103,
 "9-entry字节": 184825,
 "9-页面字节": 56542,
 "9-import残留": 0,
 "9-顶层export": 0,
 "9-window.Tk": 1,
 "9-entry读Tk": 2,
 "9-IIFE包裹": "YY"
}
```

对着这张表要能一眼回答四个问题：**面板齐不齐**（第 1 组，五块、九栏、九个结果区、九个复制按钮
且全部初始 `disabled`）、**禁 JS 读不读得到正文**（第 2 组那五条 `desc` 的开头字样原样在 HTML 里
+ 第 3 组 `hidden` 只有 `#tk-notice` 那一处）、**ARIA 是不是只有一处口径**（第 3 组前两项必须 0）、
**接线读的锚点在不在**（第 5 组：容器四格、八处 `cascade`、五处 `options`、两处 `charsets`、
两处 `switch`、四段 `when` 及其开关值）。第 6 组钉引用与顺序，第 7 组钉"本格还没进 sitemap"，
第 8 / 9 组钉两份产物各自的形状。

其中三处红过、留在这儿防复发：

- `6-两条排在正文之后` 第一次跑出来是 `NN`。原因是骨架第 306 行的注释把三个产物名都念了一遍，
  脚本用 `indexOf('toolkitCore.min.js')` 定位，命中的是注释而不是 `<script src>`。改成正文里
  只认 `src="/better-blog/assets/js/<名字>` 之后才真判到位置。**任何按字符串定位的产物判据都要
  先问一句：这串字在别处出现过没有。**
- `9-core字节` 第一次量到 16,101（真值 18,103）。`readFileSync(p,'utf8')` 之后取 `.length` 是
  **字符数**，这批产物里有中文串，一个汉字三个字节。所以脚本一开头就把 `bytes` 与 `text` 分开存。
- `8-整份vw次数` 在 Step 4 的"去掉两条"那一档是 106、在基线是 0——这条判据有牙，但只在两个方向
  都跑过之后才看得出它有牙。

Step 4 与 Step 5 合起来是这一格的验证面。**Step 6 量体积，Step 7 才提交**——中间任何一步红，
都不许"先提了再说"。

**2026-09-27 落地实跑（Step 5，真实现场）**：`npx vite build` 与 `bundle exec jekyll build --quiet`
两条 `exit=0`，核验脚本从载荷 11454–11600 重抽 147 行落 `/tmp/t8-verify-render.mjs`（先断言行数、
首尾不许命中围栏）。**54 项拿机器比，不比眼**：把 Expected 那张表（载荷 11621–11676，56 行）抽成
JSON、与现场输出逐键 `JSON.stringify` 比对，结果是 `键数 54/54`、`缺键 无`、`多键 无`、
`不一致项 2`——且那两项是同一个量的两次出现：

| 键 | 镜像档 | 现场 |
| --- | --- | --- |
| `1-HTML字节` | 56,542 | **56,554** |
| `9-页面字节` | 56,542 | **56,554** |

差的 12 B 归因到底，靠的不是"大概是别人改的"：**同一棵树只换一份输入、重建一次**。把
`_data/tools.yml` 换成 `e1eacf6^` 那一份 blob（`git show` 直取，不碰工作树）后重跑 jekyll，
`_site/tools/idcard.html` 回到 **56,542 B**，与镜像档逐字节相同；再把两份产物逐行 diff，
**971 行里只有第 159 行一处不同**：`<strong>文件转换助手</strong>` →
`<strong>文件格式任意转换助手</strong>`。10−6=4 个汉字 × 3 B = **+12 B**，数字对得上、落点唯一。
那一发改名是另一路会话 18:37 提的 `e1eacf6`（顶栏下拉、产品页、首页侧栏三处共用一份数据源），
晚于 04:58 镜像、早于本格现场重跑。**所以这张表要继续留在计划里当"镜像档"，而今天重跑的人在
`1-HTML字节` / `9-页面字节` 两格读到 56,554 不是红**——站点公共件的字变了，本格的一条判据都没退。

其余 52 项逐个相同，包括三处最容易被"差不多"糊过去的：`0-产物同源` 那句带 `5c6b51cfc738` 的
（Step 4 基线那一档的 md5，证明 `_site` 里那份是本轮 jekyll 从本轮 vite 产物复制的）、
`3-hidden落点` 那一串带 `\"` 转义的（`<main>` 里只有 `#tk-notice` 一处 `hidden`）、
`6-三处引用` 那三段带行号的（310 / 720 / 721，行号在两份产物里都没挪）。
第 7 组 `sitemap命中: 0` 与第 8 组 `8-.tk-规则含vw: 0`、`8-整份vw次数: 0` 同时为 0——
后者是 Step 4 那道"去掉两条就换算 48 条"的反面对照在这一格的正面读数。

- [x] **Step 6: 记一次首屏体积（口径钉死：`gzip -9` 走 stdin，不走文件名参数）**

```bash
cd "$(git rev-parse --show-toplevel)"
for f in assets/css/toolkit.min.css assets/js/toolkitCore.min.js assets/js/toolIdcard.min.js _site/tools/idcard.html; do
  raw=$(wc -c < "$f" | tr -d ' '); gz=$(cat "$f" | gzip -9 | wc -c | tr -d ' ')
  printf '%-34s raw=%-8s gz=%s\n' "$f" "$raw" "$gz"
done
```

Expected（两件 JS 是 Task 7 Step 6 真产物落地实跑那一档，CSS 与 HTML 仍是 04:58 镜像值、本格现场重测）：

```
assets/css/toolkit.min.css         raw=9321     gz=2110
assets/js/toolkitCore.min.js       raw=18103    gz=6583
assets/js/toolIdcard.min.js        raw=184825   gz=64666
_site/tools/idcard.html            raw=56542    gz=13332
```

**口径必须写成 `cat f | gzip -9`，不能写 `gzip -9 -c f`。** 后者会把文件名塞进 gzip header 的
FNAME 字段，每件多 16–19 字节：同一批文件用 `-c f` 量出来是 2,126 / 6,602 / 64,684（CSS 那件是
04:58 镜像的量，两件 JS 是 Task 7 Step 6 现场复量），
差值正好是 `toolkit.min.css\0`(16) / `toolkitCore.min.js\0`(19) / `toolIdcard.min.js\0`(18)。
看着像压缩器抖了，其实是计量方法换了。Task 7 Step 6 那张七档表用的是 stdin 口径（它的脚本
`measure-gzip.py` 里就是 `subprocess.run(['gzip','-9','-c'], input=b)`），本格照同一口径，
两边数字才许放在一起比。

四条读数：

1. **两件 JS 的合计没被本格撑大**：2,110 + 6,583 + 64,666 = **73,359 B**，其中两件 JS 那 71,249 B
   与 Task 7 Step 6 满数据那一档逐字节相同。本格没动 JS，这条就是"没动"的证据——下一次谁往骨架里加了一条
   `<script>`，这一行会第一个对不上。
2. **对照 §7 那条"证件页 JS + CSS"**：73,359 B 比**当时**的 61,440 B 多 **11,919 B（19%）**，
   本格不改预算、也不自己找补，处置已在 Task 7 Step 6 按 BLOCKED 协议交回。**2026-09-27 拍板取 (a)**：
   §7 那一行现为 **≤76KB（77,824 B）**，本格实测在预算内、余 4,465 B（5.7%）；三个处置的取舍与被否
   理由写在 Task 7 Step 6 末的拍板记录里。这一格补的那句实测事实仍然成立：**超出的量几乎全在一支
   脚本里**，`toolIdcard.min.js` 一件就占 64,666 B，其中区划那本 34,311 B（Task 7 Step 6 的边际表）
   ——所以将来体积再红，先看这一支，别去抠码表。
3. **首屏关键路径是 15,442 B gzip**（`toolkit.min.css` 2,110 + 页面 HTML 13,332）——这是**禁 JS
   也读得到整页正文**的成本，五块面板的说明文字全在那 13,332 B 里。剩下的 71,249 B（两件 JS）
   才买"按得动按钮"。这个分层是 §6.3 那条"构建期渲染"的直接结果；拍板 (a) 时它已从"处置 (b) 的
   量化起点"升成 §7 表里独立的一条闸门（**≤16KB = 16,384 B**，余 942 B），Task 10 按这条判，
   谁往 `<head>` 塞公共件或把 `<script>` 挪到正文之前，红的是这一条而不是总量那一条。
4. **`_site/tools/idcard.html` 的 56,542 B 是骨架 32,566 B 加站点公共件（`header.html` /
   `footer.html` / `head.html` 那一圈）之后的字节数**，比骨架多出的 23,976 B 不是这一格引入的。
   体积按 Pages 实际传输算：线上只发 gzip、不发 brotli（09-26 实测过 `Content-Encoding: gzip`），
   所以本格与 §7 全部按 gzip 计，brotli 那本账不参与判定。

**2026-09-27 落地实跑（Step 6，同一口径 `cat f | gzip -9`）**：

```
assets/css/toolkit.min.css         raw=9321     gz=2110
assets/js/toolkitCore.min.js       raw=18103    gz=6583
assets/js/toolIdcard.min.js        raw=184825   gz=64666
_site/tools/idcard.html            raw=56554    gz=13337
```

四条读数里只有第三、第四条的数跟着现场挪：**两件 JS 逐字节没动**（6,583 / 64,666，与 Task 7 Step 6
满数据那一档相同，合计 71,249 B），三件产物 **73,359 B** 对 §7 的 77,824 B **余 4,465 B（5.7%）**；
首屏 2,110 + 13,337 = **15,447 B** 对 16,384 B **余 937 B（5.7%）**，比镜像那档多 **5 B**——
来源就是 Step 5 归因到底的那 12 B 原文（`_data/tools.yml` 的顶栏品牌名，`gzip -9` 后 13,332 → 13,337），
不是压缩器抖：同一份页面用同一口径重量一次仍是 13,337。第 4 条那句"比骨架多出 23,976 B"现场是
**23,988 B**，同样那 12 B。读数 1、2 的算术与预算判定不受影响：**两条闸门都在预算内，且这一格
没有把任何量搬进首屏关键路径**。spec §7 那三处 04:58 镜像数（73,101 / 13,332 / 15,442）后面
补了一段落地复量，预算本身一个字没改。

- [x] **Step 7: 全量门禁 + 按路径提交**

提交前把这一格的四道门禁连着跑一遍，**不许只对改动文件跑**（Task 8 改的是页面与样式，但它住在
一个有 JS 测试套件与两条构建链的仓库里）：

```bash
cd "$(git rev-parse --show-toplevel)"
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs > /tmp/t8-tests.log 2>&1
echo "测试 exit=$?"; grep -E '^# (tests|pass|fail)' /tmp/t8-tests.log
pnpm build:site > /tmp/t8-build.log 2>&1; echo "build:site exit=$?"
node /tmp/t8-verify-render.mjs > /tmp/t8-render.log 2>&1; echo "产物核验 exit=$?"
grep -c '"3-索引条里的ARIA": 0\|"3-面板起始标签里的role或hidden": 0\|"4-form标签": 0' /tmp/t8-render.log
```

Expected（2026-09-27 镜像实跑那次记的基线是 `# tests 142`，见 §1 的两段"基线从 65 涨到 68"与
"基线再涨到 69"；E0-4/E21/E22 与 E23 落地后按 146 判）：`# tests 146 / # pass 146 / # fail 0`、`build:site exit=0`
（约 31 秒；`pnpm build:site` = `vite build` + `vite build --config vite.demo.config.js` +
`bundle exec jekyll build`，正是 CI 那一条链）、`产物核验 exit=0`、最后一条 `3`。
镜像里那一趟全链之后，`_site/tools/idcard.html` 的 md5 仍是 `c7b6dfc8a354…`、
`assets/css/toolkit.min.css` 仍是 `5c6b51cfc738…`，与 Step 4/5 的基线逐个相同——**注释级改动
不进产物**这件事，到这儿才算证完。

提交。这一格的产物（`assets/js/*.min.js`、`assets/css/*.min.css`、`_site/`）**全部在
`.gitignore` 里**（`.gitignore:9-10`），Pages 由 CI 构建，所以暂存区只有源文件五条路径：

```bash
cd "$(git rev-parse --show-toplevel)"
git add _data/onlineTools.yml assets/img/tools/idcard-tool.svg tools-idcard.html \
        dev/sass/toolkit.scss postcss.config.js
git diff --cached --stat
git commit -m "$(cat <<'EOF'
feat(tools): 证件页骨架与样式落地（/tools/idcard.html 首版，构建期渲染）

- _data/onlineTools.yml：面板清单/前缀/收录状态的单一数据源，Task 9 的下拉与
  /tools.html 小节共用；assets/img/tools/idcard-tool.svg 是它 icon 指向的图标
- tools-idcard.html：五块面板的正文由 Liquid 在构建期渲染，禁用脚本与爬虫读到的
  是同一份正文（§6.3）；索引条与面板的 ARIA 一个不写，全由 panel-dom.js 覆写
- dev/sass/toolkit.scss：.tk-/.jt- 一套样式，状态色三档在白昼与夜间的对比度
  现算为 6.58/5.93/7.77 与 8.80/8.76/6.74（AA 4.5 全过）
- postcss.config.js：黑名单加 .tk- 与 .jt- 两条字符串（不是正则，最左选择器是
  后代形式时 anchored 正则一条都盖不住）；去掉两条实测 86 条规则里 48 条被换成 vw
EOF
)"
git log --oneline -1
```

**别裸 `git commit`**：索引是共享的，另一个会话可能正把 `.gitignore` 之类暂存着（Task 7 收口时
就是这情况）。先 `git diff --cached --stat` 看清那五行是谁的，多出来的行先跟用户确认，不要顺手
吞进这一发。

本格交付清单：

| 路径 | 行 / 字节 | 谁来判它 |
| --- | --- | --- |
| `_data/onlineTools.yml` | 76 / 5,683 | Step 1 的 `check-onlineTools.rb`；Step 5 第 1 组（五块面板、九栏） |
| `assets/img/tools/idcard-tool.svg` | 11 / 762 | Step 1 那条 `icon在盘上=true`；Task 9 的下拉是第一个消费者 |
| `tools-idcard.html` | 486 / 32,566 | Step 5 十组（0–9）全过；Step 6 的 56,554 B / 13,337 B gzip |
| `dev/sass/toolkit.scss` | 648 / 19,240 | Step 3 的对比度复算；Step 4 正反两跑；Step 5 第 8 组 |
| `postcss.config.js` | 94 / 4,537 | Step 4（48 条 ↔ 0 条那组对照） |

下一格（Task 9，收录面与门禁脚本）拿这一格的这些东西去用，接口就三条：

1. 三个消费点（`_includes/header.html` 的「工具箱」下拉新分组、`/tools.html` 小节、
   `index-all.html`）读同一份 `site.data.onlineTools`，按 `status == 'ready'` 决定出不出链接；
   `icon` 字段第一次被消费。
2. `scripts/check-tools-surface.mjs` 把 Step 5 那十组现算现打的东西收成可重跑的门禁，另加三条
   对账：`_data/onlineTools.yml` 的 `prefix` ↔ `toolIdcard.js` 的 `CONTAINER_ID`/`NOTICE_ID`；
   `WORKBENCH_SPEC` 里 switch 的 targets ↔ 页面上四段 `data-tk-when`；三页的 `url` ↔
   `permalink`（含 sitemap 收没收到）。
3. Step 6 那笔预算账**已经拍完**（2026-09-27，处置 (a)）：spec §7 那一行现为证件页 JS+CSS
   **gzip ≤ 76KB**，两件 JS 实测 71,249 B（Task 7 Step 6 落地实跑，比 04:58 拍板时的草稿多 258 B，
   那两次复核整改所致），加 Task 8 的 CSS 约 2,110 B 是约 73,359 B、余 4,465 B；同时新立
   **首屏关键路径 ≤16KB**
   （实测 15,447 B），Task 10 量首屏时按这一条判。骨架**不用返工**——(b) 被否，那一支延迟
   `<script>` 不加。理由与否决项写在 Task 7 Step 6 末的拍板记录，本格的读数四条不受影响。
   收口（Task 11）时记得把 §5.1 与 §11 里跟体积有关的句子对到 §7 的新口径上。

**2026-09-27 落地实跑（Step 7：`8fc3078`，五条路径 1,229 行）**：五道门禁连着跑，全部现跑现打——

| 门禁 | 现场 | 计划 Expected |
| --- | --- | --- |
| `--test scripts/toolkit-tests.mjs` | `exit=0`，`# tests 146 / # pass 146 / # fail 0` | 146 / 146 / 0 ✓ |
| `pnpm build:site` | `exit=0`（vite 主链 + demo 链 + jekyll 4.931 s，`Skipping: …future date` 一条） | `exit=0` ✓ |
| 产物核验 + 那三条 `grep -c` | `exit=0`、`3` | `exit=0`、`3` ✓ |
| `scripts/verify-plan-blocks.mjs` | `exit=0`，js 块 28 个全是已落地镜像、`未落地 0 节` | — |
| `scripts/verify-plan-blocks-teeth.mjs` | `exit=0`，`14/14`，实验前后脏指纹逐项一致（23 项，含另一路会话那批） | — |

镜像档那句"`_site/tools/idcard.html` 的 md5 仍是 `c7b6dfc8a354…`"现场对不上，是 **`0746e419f713…`**，
差的仍是 Step 5 那 12 B；`assets/css/toolkit.min.css` 两边都是 `5c6b51cfc738…`，"注释级改动不进产物"
这件事由后一条 md5 证完。

**本格新认的一条门禁缺口（记给 Task 9）**：`verify-plan-blocks.mjs` 的 `rawBlocks` 只收 ` ```js `
块（`scripts/verify-plan-blocks.mjs:251`），末尾那道反查也只看 `.js` / `.mjs` 文件——所以本格那四块
**整文件镜像**（`_data/onlineTools.yml` yaml / `assets/img/tools/idcard-tool.svg` svg /
`tools-idcard.html` html / `dev/sass/toolkit.scss` scss）此刻落在门禁之外：磁盘改了计划不会红。
现场用一次性脚本按同样的规则核了一遍（同语言块里**唯一**全等命中才算过，多命中报歧义）：

```
OK _data/onlineTools.yml：计划[段2] 9988–10063（76 行）与磁盘逐字节全等　（同语言块 1 个）
OK assets/img/tools/idcard-tool.svg：计划[段2] 10072–10082（11 行）与磁盘逐字节全等　（同语言块 1 个）
OK tools-idcard.html：计划[段2] 10148–10633（486 行）与磁盘逐字节全等　（同语言块 1 个）
OK dev/sass/toolkit.scss：计划[段2] 10694–11341（648 行）与磁盘逐字节全等　（同语言块 2 个）
```

那四个"同语言块"计数就是放宽语言集合时的坑：`scss` 有两块、只有一块全等，另一块是任务正文里的
片段，反查若照搬 js 那套"整文件全等即声明"会把片段误判。Task 9 写 `check-tools-surface.mjs` 时
一并把语言集合与反查白名单放宽，四块镜像进 FILE_TARGETS 的等价物，并补一条牙齿自证（改一个字节
必须让门禁红）。**没在 Step 7 之前顺手改这个脚本**，是因为它属于门禁本体、改它要自证牙齿，塞进
本格会把"提交前四道门禁连着跑"这一格拖成两格。

提交照计划载荷逐字（只多打了 hash 与行数的现场值在本记录里，不改 commit message），pathspec
形式收口：`git add` 五条 → `git diff --cached --stat` 恰为 5 files（`76 / 11 / 648 / 8+1− / 486`）→
`git commit -m "$(cat <<'EOF' … EOF)" -- <同一批五条>` → `commit exit=0`、`8fc3078`。
提交后 `git status --porcelain -- <五条>` 无输出。钩子噪音照旧（三个钩子往 stdout 打四行调试信息，
认 `commit exit=0` 与 `git log -1` 里的真 SHA，不认 stdout）。**共享索引这一发是空的**
（`git diff --cached --stat` 无输出），但 pathspec 照旧写死——对方的 `deploy-github.sh` 里那句
`git add .` 随时会落进来。计划文件按 Task 11 的节奏另发一发。

<!-- APPEND-9 -->

