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
4. 改 `dev/js/tools/{panel,idcard,uscc,region,random}.js` 或 `scripts/toolkit-tests.mjs` 的分节，会让 `node scripts/verify-plan-blocks.mjs` 退 1（它把这些文件的全文镜像在段 1 计划里）。本段**只在 §H/§I 需要时改 `panel.js` 以外的东西**；真需要动镜像文件时，改完立刻 `--fix` 同步并在提交信息里写明。

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
- 两条都**不许**在页面文案里写成"查询/识别结果"式的权威口吻；面板的措辞在 Task 7 里逐句钉。

### 0.5 站点接入点（2026-09-26 逐个 `sed`/`grep` 实读，行号会漂所以同时给锚点）

- `_layouts/` 只有 5 份：`default` / `post` / `aboutTemplate` / `demoTemplate` / `labTemplate`。内容页一律 `layout: default`。**本段不新增布局文件**，页面级 CSS/JS 由页面自己 `<link>`/`<script>` 带（先例：`weblab.html:13` 的 `weblab.min.css`、`about.html:259-260` 的两条 `<script>`）。
- `_includes/headAssets.html` 92 行：preload 字体 → `normalize.min.css` → iconfont CSS → `{%- if page.layout == 'post' %}` 三条文章专用 CSS → `index.min.css` → `iconFont/iconfont.css` → `jquery.min.js`（**必须最后**）。文件头注释写明"清单只能留在 headAssets 里按 layout 收口"的理由。**本段一行都不改它**：新页的 CSS 走页面自带 `<link>`，与 `weblab.html` 同法，改动面最小。
- `_includes/header.html`（161 行）下拉块在 `19-53`，`{% for item in site.nav %}` + `{% if page.url == item.url or (item.url != '/' and page.url contains item.url) %}` 判 `is_current`，`{% if item.dropdown == 'tools' %}` 里 `{% for tool in site.data.tools %}` 拼 `/tools.html#<slug>`，末尾一条 `.nav-sub-more`。**这就是 §4.3 那个缺陷的位置**：`/tools/idcard.html` 里 `page.url contains '/tools.html'` 为假。
- `_config.yml`：`nav:` 现在 **8 项**（实测数 `- key:`），`version: '2.1.0'`，`exclude` 里已有 `dev` / `scripts` / `"assets/**/*.md"`。
- `tools.html`（102 行）整页是 `_data/tools.yml` 的一个循环，`{% endfor %}` 在 99、`</main>` 在 100 →「在线工具」小节插在两者之间；`tools.html:19` 用 `site.data.tools.size` 说"几款产品"，加了小节**不动**它（那句话说的是插件产品，Task 8 里给它补一行限定语）。
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
      "header": "bin,bank,type,length"
    },
    {
      "file": "name.csv",
      "url": "https://cdn.jsdelivr.net/gh/hexindai/bcbc@de631827ffe8db2792d140f3476b02498fc1244f/data/name.csv",
      "kind": "name",
      "bytes": 6849,
      "sha256": "1a77cec8dacac144179173917512500b63a7814005ad15d04cd722d11558b20f",
      "count": 298,
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
      "count": 56
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

体积：`bank-bin-data.js` 38,459B（gzip -6 = 10,697B、-9 = 10,693B）；`carrier-data.js` 1,239B（gz9 936B）。
用仓库里的 terser 过一遍（`node_modules/.bin/terser … --compress --mangle --module`）是
36,494B / gz9 **9,865B**——注释剥掉只省 1.2KB，因为大头是 `BIN_ROWS` 那 28,266 字符的分号串。

**这个体积压在预算上是有张力的，必须写明白**：设计文档 §7 给证件页 JS+CSS 的预算是 gzip ≤ 60KB，
而本页要同时挂 `region-data.js`（实测 34.8KB gz）+ 这张（9.9KB）+ `carrier-data.js`（0.9KB）
= **45.6KB 数据**，留给页面 JS 与 CSS 只剩 ~14KB。所以 Task 10 必须真量一次页面产物的
gzip 总数（`dist/assets/js/toolIdcard.min.js` + 页面 CSS），三种结果分别处理：
① 在 60KB 内 → 把实测数按 §7 的写法回填设计文档；② 超了 → **停下来报 BLOCKED**，
把分解表（region / bank / carrier / 其余 JS / CSS）交回来由人重新决定预算或砍覆盖，
**不许静默放宽 §7 的数，也不许悄悄删 BIN 表条目凑数**；③ 逼近（55–60KB）→ 允许把
`BANKS` 的中文名拆成按需第二张表（`bin → bankCode` 留在紧凑串里），但那要改读侧的
一次查表，必须在计划外的改动单里列出来再做。
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

追加到 `scripts/toolkit-tests.mjs` 末尾。分节标记必须长成 `// ── §E 银行卡 …` 这个形状（`verify-plan-blocks.mjs` 的 `SEG_MARK` 按它切分）。

```js
// ── §E0 银行卡码表数据形状（快照 → 生成物） ──────────────────────────────
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

// ── §F0 号段数据形状 ─────────────────────────────────────────────────────
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

跑红（模块还不存在，`import` 直接失败是预期的红）：

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^not ok|^# (pass|fail)' | head; echo "exit=${PIPESTATUS[0]}"
```

Expected：`Cannot find module .../dev/js/tools/bank-bin-data.js` 一类的文件级红行，`exit=` 非 0。**注意 `# pass` 掉到 0 也算这条判据在红**，别只看有没有 `not ok`。

- [ ] **Step 7: 补两行 `await import`，跑绿**

**不要**往文件头那批 `import` 里加东西——段 1 的口径是**每节自己 `await import`**（§B 在
`toolkit-tests.mjs:864`、§C 在 `:1684`、§D 在 `:2300` 各一句），文件头注释里写明了理由：
"模块还没落地"这一档的红长成**文件级** `not ok 1 - scripts/toolkit-tests.mjs`
（`ERR_MODULE_NOT_FOUND`），按 `await import` 才留得住这个形状。在 Step 6 那两节标记
**紧下方**各补一句：

```js
const { BANKS, BIN_ROWS } = await import('../dev/js/tools/bank-bin-data.js');
```
```js
const { CARRIER_SEGMENTS } = await import('../dev/js/tools/carrier-data.js');
```

`spawnSync` 与 `ROOT` 都已在文件里（`spawnSync` 由 §A 从 `node:child_process` 引过，
`ROOT` 是第 60 行那个常量），**不要再引一遍**。三个 §E0 与一个 §F0 现在应全绿，全量：

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^# (tests|pass|fail)|^exit='; echo "exit=${PIPESTATUS[0]}"
```

Expected：`# pass 45`、`# fail 0`（41 + 4）。

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
失败信息是 `号段 192 同时属于 中国广电 与 中国联通`；恢复后 `# fail 0`、`# pass 45`，
最后两个哈希逐字相同。若变异没让 `F0-1` 红，先确认文件真的被改了（`git diff --stat
dev/js/tools/carrier-data.js`），别急着判"判据有效"。
**为什么用 heredoc 写脚本而不是 `node -e '…'`**：这一行的替换串里同时有单引号和中文，
嵌在 shell 单引号里要写 `'\''`，本机 zsh 曾因一个未配对的双引号**静默不执行**整条复合命令
（2026-09-26 实测，探针文件根本没建出来）——判据自证的脚本不能被引号咬。

- [ ] **Step 9: 提交**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
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

Expected：提交只含这 7 条路径；末尾 `git status` 剩下的行仍是对方那批（`.gitignore`、`_config.yml`、`_data/og_images.yml`、`_drafts/*`、`package.json`、`dev/sass/common/tokens.scss` 与三个未跟踪项）。

---

## Task 2: `bankcard.js` — Luhn、最长前缀查表、生成侧

**Files:**
- Create: `dev/js/tools/bankcard.js`
- Test: `scripts/toolkit-tests.mjs`（§E）

判据里每一个数字都是在 `/tmp/pfx` 镜像上跑出来的，不是推的：`6212601500012345` 的校验位确实是 `5`、
表内唯一一组跨长度嵌套前缀是 `9558 ⊂ 95588`（同属 ICBC）、并列登记的 12 个 BIN 里第一个是
`621260`（SPABANK 贷记 16 位 / CSRCB 借记 19 位）。照抄即可，别改成"看起来更像"的号码。

- [ ] **Step 1: 先写 §E 的 20 条判据（此时 `bankcard.js` 还不存在，必红）**

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
  for (const v of [null, undefined, 0, false, {}]) {
    assert.equal(parseBankCard(v).state === 'empty' || parseBankCard(v).state === 'malformed', true,
      `${JSON.stringify(v)} 必须安静地走两行表而不是抛`);
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
  for (const opts of [{}, { count: 5 }, { bankCode: 'ICBC' }, { cardType: 'CC' },
    { bin: '95588', length: 19 }, { length: 15 }, { bankCode: 'CMB', cardType: 'DC' }]) {
    const list = generateBankCards(opts);
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
  assert.ok(new Set(a).size > 1, '同一个种子连出 8 条全等，说明随机体没参与');
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

test('E18 行别下拉与表自洽', () => {
  assert.equal(BANK_OPTIONS.length, BANKS.length);
  assert.equal(BANK_OPTIONS.length, 260);
  assert.equal(BANK_OPTIONS.reduce((n, b) => n + b.binCount, 0), BIN_ROWS.split(';').length);
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
```

- [ ] **Step 2: 跑红，确认红的形状**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^not ok|Cannot find module|^# (tests|pass|fail)'; echo "exit=${PIPESTATUS[0]}"
```

Expected：文件级那一行 `not ok 1 - scripts/toolkit-tests.mjs`，正文里
`ERR_MODULE_NOT_FOUND: Cannot find module '…/dev/js/tools/bankcard.js'`，`# pass 45`
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
 * 与 `idcard.js` / `uscc.js` 同一套约定：纯函数、不碰 DOM、入参形状不对就抛。
 */
import { seededRandom } from './random.js';
import { BANKS, BIN_META, BIN_ROWS } from './bank-bin-data.js';

/** 卡号合法位数区间（§5.1：13–19 位）。表内登记的位数只落在这五档里。 */
export const PAN_MIN = 13;
export const PAN_MAX = 19;
/** 单次生成的条数上限，与 `generateIdCards` 同一档 */
export const GENERATE_MAX = 50;
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
 * （前缀长度 < 卡号长度）。命中即停，返回该 BIN 的**全部**并列登记。
 * @param {string} digits 纯数字卡号
 * @returns {{bin:string,rows:{bin:string,bankCode:string,bankName:string,cardType:string,cardTypeName:string,panLength:number}[],tried:number[]}|null}
 */
export function lookupBin(digits) {
  if (typeof digits !== 'string' || !/^\d+$/.test(digits)) return null;
  const tried = [];
  for (const n of BIN_LENGTHS) {
    if (n >= digits.length) continue;
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
    triedLengths: found === null ? [...BIN_LENGTHS].filter((n) => n < digits.length) : found.tried,
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
    let body = row.bin;
    while (body.length < row.panLength - 1) body += String(Math.floor(rng() * 10));
    const check = luhnCheckDigit(body);
    const number = body + check;
    const self = parseBankCard(number);
    // 两条一起判：状态必须是 valid，而且读侧**最长前缀挑中的那个 BIN**必须就是本条用的前缀。
    // 今天表里没有嵌套前缀（唯一一组 9558/95588 同属 ICBC），后半个条件不可达；留着是因为
    // 快照一旦长出嵌套前缀，"生成平安银行、读出来是另一家"只有这一格能当场报。
    if (self.state !== 'valid' || self.info.bin !== row.bin) {
      const why = self.checks.filter((k) => k.ok === false).map((k) => `${k.label}：${k.detail}`).join(' / ');
      throw new Error(`内部不变量：生成的 ${number} 自检为 ${self.state}（${why}）`);
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
   常熟农商 19 位——19 位串必须报 CSRCB。生成侧那句自检（`self.info.bin !== row.bin`）
   就是为"哪天表里长出嵌套前缀，生成的行别与读出的行别不是一家"留的。

- [ ] **Step 4: 跑绿**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^# (tests|pass|fail)'; echo "exit=${PIPESTATUS[0]}"
wc -l dev/js/tools/bankcard.js
```

Expected：`# tests 65`、`# pass 65`、`# fail 0`、`exit=0`（41 + 4 + 20），`wc -l` 353 行左右。

- [ ] **Step 5: 自证这 20 条有牙（七处变异，逐处记下红了谁）**

```bash
mkdir -p /tmp/t2mut && cp dev/js/tools/bankcard.js /tmp/t2mut/bankcard.orig.js
cat > /tmp/t2mut/mut.mjs <<'EOF'
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const P = 'dev/js/tools/bankcard.js';
const CMD = 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs';
const orig = fs.readFileSync(P, 'utf8');
/** 未变异先跑一次：拿它的 `# tests` 总数当尺子，好把"脚手架其实没跑到测试"和"这处不可达"分开 */
function run() {
  let out = '';
  try { out = execSync(`${CMD} 2>&1`, { encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  return {
    total: Number((out.match(/^# tests (\d+)/m) || [])[1] ?? -1),
    reds: [...out.matchAll(/^not ok \d+ - (E\d+)/gm)].map((m) => m[1]),
  };
}
const base = run();
if (base.total < 0 || base.reds.length > 0) {
  throw new Error(`基线就不对（# tests ${base.total}、红 ${base.reds.length} 条），先让全量跑绿再谈牙齿`);
}
console.log(`基线 # tests ${base.total} 全绿`);
const MUTS = [
  ['M1 翻倍方向反过来', "const double = (s.length - i) % 2 === 1;", "const double = (s.length - i) % 2 === 0;"],
  ['M2 前缀允许吃掉整串', "if (n >= digits.length) continue;", "if (n > digits.length) continue;"],
  ['M3 主结论退回字典序第一条', "const primary = rows.find((m) => m.panLength === digits.length) ?? rows[0] ?? null;", "const primary = rows[0] ?? null;"],
  ['M4 表外也报 valid', "out.state = primary === null ? 'unlisted' : 'valid';", "out.state = 'valid';"],
  ['M5 表外判成 false', "push('bin', '行别前缀', primary === null ? null", "push('bin', '行别前缀', primary === null ? false"],
  ['M6 位数下限放宽到 12', "export const PAN_MIN = 13;", "export const PAN_MIN = 12;"],
  ['M7 生成侧自检整个摘掉', "if (self.state !== 'valid' || self.info.bin !== row.bin) {", "if (false) {"],
];
for (const [name, a, b] of MUTS) {
  if (!orig.includes(a)) { console.log(`!! ${name} 锚点没命中，先修脚本再说牙齿`); continue; }
  fs.writeFileSync(P, orig.replace(a, b));
  const r = run();
  if (r.total !== base.total) { console.log(`!! ${name} 只跑到 ${r.total} 条（基线 ${base.total}），这一档不算证据`); continue; }
  console.log(`${name} → ${r.reds.length ? r.reds.join(' ') : '全绿（这一处不可达，见计划 Step 5 的说明）'}`);
}
fs.writeFileSync(P, orig);
EOF
node /tmp/t2mut/mut.mjs
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^# (pass|fail)'
shasum -a 256 dev/js/tools/bankcard.js   # 与 /tmp/t2mut/bankcard.orig.js 的哈希逐字相同
```

**这一档的脚手架在段 1 栽过两次，所以两处闸门都得留下**：命令必须指向仓库里的
`scripts/toolkit-tests.mjs`（早先草稿写的是镜像文件名 `e-tests.mjs`，在仓库里跑会退非零、
`out` 只剩一句"找不到文件"，七处变异于是齐刷刷报"全绿"——那是脚手架坏了，不是判据没牙）；
`run()` 里那个 `# tests` 总数与基线比对就是这一档的兜底，两边对不上就报 `!!`，不许读成结论。
下面的红名单是 2026-09-26 在镜像上单跑 §E 那 20 条实测的；在仓库里跑全量时红名单应当一模一样，
因为 §A–§D 没有一处 `import` `bankcard.js`（Task 3 之后的 §F 也没有）。

红名单：

| 变异 | 红了谁 | 说明 |
| --- | --- | --- |
| M1 翻倍方向反过来 | E1 E2 E4 E5 E8 E11 E13 E20 | 八条一起红，Luhn 是全模块的地基 |
| M2 前缀允许吃掉整串 | **只 E9 红** | 最尖的一档：`n >= len` 改成 `n > len` |
| M3 主结论退回字典序第一条 | **只 E10 红** | 并列登记那条口径由 E10 独占 |
| M4 表外也报 valid | E4 E6 E20 | `unlisted` 三处消费点全红 |
| M5 表外判成 false | **只 E12 红** | 三态里 `null` 与 `false` 的分界 |
| M6 位数下限放宽到 12 | E5 E6 E17 | 边界两侧各咬一口 |
| M7 生成侧自检整个摘掉 | **全绿** | 见下 |

**M7 全绿不是判据没牙，是那一格在今天的数据下不可达**：构造与读取用的是同一套 Luhn 与同一张表，
生成侧不可能自己算出一个不通的末位；把 `if (self.state !== 'valid' …)` 摘掉、以及只留状态判据
丢掉 `self.info.bin !== row.bin` 那一半（实测同样全绿），都造不出触发条件。留着它的理由是
"表里一旦长出嵌套前缀"（今天唯一一组 `9558 ⊂ 95588` 同属一家，所以不红），那一刻它是唯一的
当场报警；而从**测试侧**独立盯这件事的是 E15 里那句 `back.info.bin === item.bin`——两边不是同一个
条件，所以不是一句自我循环。这一段说明必须留在计划里，别改成"M7 已被某条判据覆盖"。

脚本第一行 `!! 锚点没命中` 是这套自证的闸门：**锚点失配一律先修脚本再谈牙齿**（段 1 栽过一次
`sed` 退 0 而变异根本没落地，量出来的是"判据有效"的假结论）。

- [ ] **Step 6: 记一次耗时（Task 10 的性能口径要用）**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
for m in "./dev/js/tools/bank-bin-data.js" "./dev/js/tools/bankcard.js"; do node --input-type=module -e "
const t0 = performance.now(); await import('$m');
console.log('$m', (performance.now() - t0).toFixed(1) + 'ms');"; done
```

Expected（2026-09-26 本机 Node 22 三次复跑的区间）：`bank-bin-data.js` **约 15ms**（大头是那条
28,266 字符的 `BIN_ROWS` 巨串本身），`bankcard.js` **约 50ms**（含把 1,709 行拆成对象 ≈4ms、
按 BIN 分桶 ≈16ms）。这是**首屏一次性**成本：页面入口 `import` 它，就付这一次。查表本身很快
（200 次 `parseBankCard` ≈7ms）。Task 10 若量到 `toolIdcard.min.js` 的 parse+run 明显超出这个量级，
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

Expected：提交只含这两条路径；`git status` 剩下仍是对方那批未提交项。**不要**碰
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
`ERR_MODULE_NOT_FOUND: Cannot find module '…/dev/js/tools/phone.js'`，`# pass 65`（Task 1、2 那批
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

Expected：`# tests 80`、`# pass 80`、`# fail 0`、`exit=0`（41 + 4 + 20 + 15），`wc -l` 258 行左右。

- [ ] **Step 5: 自证这 15 条有牙（十五处变异，逐处记下红了谁）**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
mkdir -p /tmp/t3mut && cp dev/js/tools/phone.js /tmp/t3mut/phone.orig.js
cat > /tmp/t3mut/mut.mjs <<'EOF'
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const P = 'dev/js/tools/phone.js';
const CMD = 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs';
const orig = fs.readFileSync(P, 'utf8');
/** 未变异先跑一次：拿它的 `# tests` 总数当尺子，好把"脚手架其实没跑到测试"和"这处不可达"分开 */
function run() {
  let out = '';
  try { out = execSync(`${CMD} 2>&1`, { encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  return {
    total: Number((out.match(/^# tests (\d+)/m) || [])[1] ?? -1),
    reds: [...out.matchAll(/^not ok \d+ - (F\d+)/gm)].map((m) => m[1]),
  };
}
const base = run();
if (base.total < 0 || base.reds.length > 0) {
  throw new Error(`基线就不对（# tests ${base.total}、红 ${base.reds.length} 条），先让全量跑绿再谈牙齿`);
}
console.log(`基线 # tests ${base.total} 全绿`);
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
  if (!orig.includes(a)) { console.log(`!! ${name} 锚点没命中，先修脚本再说牙齿`); continue; }
  fs.writeFileSync(P, orig.replace(a, b));
  const r = run();
  if (r.total !== base.total) { console.log(`!! ${name} 只跑到 ${r.total} 条（基线 ${base.total}），这一档不算证据`); continue; }
  console.log(`${name} → ${r.reds.length ? r.reds.join(' ') : '全绿（不可达，见计划说明）'}`);
}
fs.writeFileSync(P, orig);
EOF
node /tmp/t3mut/mut.mjs
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^# (pass|fail)'
shasum -a 256 dev/js/tools/phone.js   # 必须与 /tmp/t3mut/phone.orig.js 逐字相同
```

2026-09-26 在镜像上单跑 §F 实测的红名单（**照这个对**；仓库里跑全量时应当一模一样，因为
§A–§E 没有一处 `import` `phone.js`，红得多了或少了都是"哪儿变了"，先按 `!!` 那两档排查脚手架）：

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
**0.33–0.51ms/批（50 条）**。两个坑都写在这一段里：

- **没预热会高一个数量级**：同一段代码冷启动第一跑量到 **56µs/次**，比稳态的 3.7µs 多 15 倍。
  Task 10 若拿这里做性能断言，必须带着那 2,000 次预热跑，否则阈值一填就是个假红。
- **`import` 的摆动是环境噪声**：7ms 与 27ms 之间没有可解释的差别（`carrier-data.js` 才
  1,239B、`phone.js` 13,185B，两侧都不建大表）。这一格对首屏的实际贡献相对 `bank-bin-data.js`
  那 38KB 可以忽略；页面预算按 Task 1 的账走，别拿这里的数字当依据。

```bash
wc -c dev/js/tools/phone.js dev/js/tools/carrier-data.js
gzip -6 -c dev/js/tools/phone.js | wc -c
```

Expected：13,185 / 1,239 字节、`gzip -6` 5,733 字节。**这是源码原文与 gzip，不是产物**——产物口径
（terser 之后）到 Task 9 的收录面一起量，那里才有 `toolIdcard.min.js` 的真数。

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

Expected：提交只含这两条路径；剩下仍是对方那批未提交项。`_docs/superpowers/plans/` 里这份计划
按 Task 11 的收口节奏单独提，别混进这一条。

## Task 4: `random-data.js` — 随机姓名 / 地址 / 邮箱与"一次一组"

**Files:**
- Create: `dev/js/tools/random-data.js`
- Modify: `scripts/toolkit-tests.mjs`（追加 §G，15 条）

这一格的代码不难，难的是**六条口径先立住**，否则实现里到处是"看起来合理但说出口会心虚"的句子：

1. **三张词表全部本站自造，判据因此只断形状与自洽。** 姓氏 98 字、名字用字 123 字、街道词 24
   条、邮箱词根 24 条——都是手挑的高频子集，不引第三方姓名库（引了就要谈许可，而姓名库最大的
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
   G4 / G10 / G11 把这三档各钉一次，谁改口径就红在对应的键上。
4. **"批内不重复"只有把空间压小才看得见，所以判据自己造一个退化随机源。** 30 条姓名的组合空间是
   98×(123+123²) = 1,494,696 格，至少撞一次的概率 **2.9×10⁻⁴**；地址按整串 `text` 判重，空间
   2,978×24×4×200 = 57,177,600 格，撞重概率 **7.6×10⁻⁶**；邮箱 17,982,000 格、**2.4×10⁻⁵**
   （三个数是 2026-09-26 在镜像上按 `C(30,2) / 组合空间` 现算的，词表一改就得重算）。
   **所以只断"这批不重复"等于没断**——把 `uniqueBatch` 的判重整条摘掉，15 条判据照样全绿，
   本轮在镜像上实测过：M1 只红 G5，是因为 G5 里那三句压空间的探针在叫。所以 G5 用恒定源
   `rng: () => 0.5` 把组合空间塌成一格，逼出两条相反的行为：判重还在→抛 `RangeError`
   （文案带"只凑到 1 条"），判重被摘→安静返回 `count` 条一模一样的结果。同族的另一条退化
   （`pick(pool, rng)` 被写成 `pool[0]`）由 G8 那句"30 条不许全落在同一个县"兜住——它不是随机性
   断言，2,978 抽 30 全等的概率是 **10⁻¹⁰⁰·⁷**，红了就一定是代码坏了。
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

test('G1 词表自洽：三张表各自无重复、形状合法、规模不缩水', () => {
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

test('G6 count 闸门：1..50 之外一律 RangeError，上限与身份证同一档', () => {
  assert.equal(RAND_GENERATE_MAX, 50);
  assert.equal(RAND_GENERATE_MAX, GENERATE_MAX, '随机数据与身份证的条数上限不同档');
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

test('G7 rng 闸门：非函数抛、越界的取值抛，两句话各点一次名', () => {
  for (const bad of ['nope', 1, {}, []]) {
    assert.throws(() => generateNames({ rng: bad }),
      (e) => e instanceof TypeError && /options\.rng 应为 \(\) => number/.test(e.message));
  }
  for (const bad of [1, -0.1, NaN, Infinity, '0.5']) {
    assert.throws(() => generateNames({ rng: () => bad }),
      (e) => e instanceof TypeError && /每次应给出 \[0, 1\) 内的有限数/.test(e.message),
      `rng 返回 ${String(bad)} 没被拦`);
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
`ERR_MODULE_NOT_FOUND: Cannot find module '…/dev/js/tools/random-data.js'`，`# pass 80`
（Task 1–3 那批照绿）、`# fail 1`、`exit=` 非 0。红的形状与 §E / §F 当时一致：**整文件挂**，
不是 15 条各挂一次——顶层 `await import` 抛在文件级，这一族口径是既定的。

- [ ] **Step 3: 写 `dev/js/tools/random-data.js`**

```js
/**
 * 随机合成数据：姓名 / 地址 / 邮箱，外加"一次一组"的三元组（设计文档 §5.1 的 `#random`）。
 *
 * **三张词表全部是本站自造的**：姓氏与名字用字取常见榜的高频子集，街道与邮箱词根是通用词，
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
 * 组合空间被压到很小时才看得出来，正常随机源下 50 条抽重的概率不到千分之一。
 * 所以 §G 用一条恒定 rng（`() => 0.5`）把组合空间压成 1 格来验这一族：
 * 判重还在就抛 `RangeError`，判重被摘掉就安静地返回 `count` 条一模一样的结果。
 *
 * 凑不满时**不静默放宽**：「要 50 个不同姓名，实际给了 43 条、7 条是重复的」必须当场报，
 * 而不是让页面数一下才发现。
 * @param {() => [string, object]} make 造一个候选，返回 `[去重键, 结果]`
 * @param {number} want 条数
 * @param {number} capacity 组合空间上界（只进报错文案，不参与取样）
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
  const cap = EMAIL_DOMAINS.length * (n + n * n) * 9990;
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

Expected：`# tests 95`、`# pass 95`、`# fail 0`、`exit=0`（41 + 4 + 20 + 15 + 15），`wc -l` 290 行左右。

- [ ] **Step 5: 自证这 15 条有牙（二十处变异，逐处记下红了谁）**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
mkdir -p /tmp/t4mut && cp dev/js/tools/random-data.js /tmp/t4mut/random-data.orig.js
cat > /tmp/t4mut/mut.mjs <<'EOF'
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const P = 'dev/js/tools/random-data.js';
const CMD = 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs';
const orig = fs.readFileSync(P, 'utf8');
/** 未变异先跑一次：拿它的 `# tests` 总数当尺子，好把"脚手架其实没跑到测试"和"这处不可达"分开 */
function run() {
  let out = '';
  try { out = execSync(`${CMD} 2>&1`, { encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  return {
    total: Number((out.match(/^# tests (\d+)/m) || [])[1] ?? -1),
    reds: [...out.matchAll(/^not ok \d+ - (G\d+)/gm)].map((x) => x[1]),
  };
}
const base = run();
if (base.total < 0 || base.reds.length > 0) {
  throw new Error(`基线就不对（# tests ${base.total}、红 ${base.reds.join(' ')}），先让全量跑绿再谈牙齿`);
}
console.log(`基线 # tests ${base.total} 全绿`);
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
node /tmp/t4mut/mut.mjs
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs 2>&1 | grep -E '^# (pass|fail)'
shasum -a 256 dev/js/tools/random-data.js   # 必须与 /tmp/t4mut/random-data.orig.js 逐字相同
```

脚本里那二十条锚点与替换串**全部是从镜像上跑过的原文**（`from` 不命中就打印 `!!` 并跳过，
跳过的那些不算证据）。2026-09-26 在镜像上单跑 §G 实测的红名单（照这个对；仓库里跑全量应当
一模一样，因为 §A–§F 没有一处 `import` `random-data.js`）：

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
| M12 尾数放宽成 1–4 位 | G5 G11 G12 G14 | 一位尾数被 `EMAIL_RE` 的内部自检拦住，四个调用点一起红——这一档顺便证明那句自检有牙 |
| M13 `givenLength` 用松比较放行 `'1'` | **只 G4 红** | 类型错退化成"看着能用" |
| M14 默认档位恒取 2 | **只 G4 红** | "1–2 字"那句只有 G4 判 |
| M15 §5.5 那句改一个标点 | **只 G13 红** | 逐字相等 |
| M16 `count` 上限放宽到 500 | G6 G15 | 上限同档那句 + 边界向量 |
| M17 rng 取值范围闸门摘掉 | **只 G7 红** | 独占 |
| M18 门牌号上界 200 → 999 | **只 G8 红** | `house` 正则独占 |
| M19 整串把街道拼在全名之前 | G5 G8 G9 G12 G14 G15 | `text` 是判重键，动它就全线红 |
| M20 `RANDOM_CAVEAT` 与 §5.5 脱钩 | **只 G13 红** | 副本漂移只有文案判据守得住 |

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

2026-09-26 本机 Node 22 的实测**区间**（七个进程各一次、七轮基准）：
`import random-data.js` **38–49ms**，但**这个数不能当这一格的开销用**——`random-data.js` 把
`region.js` 拽了进来，而 `region-data.js` 单文件就有 100,020 字节；把依赖先跑热之后，
`random-data.js` 自己求值只花 **2.6–4.2ms**。证件页上 `idcard.js` 本来就要 `region.js`，
所以这一格对首屏的边际成本是那 3ms 上下，不是 40ms。生成侧稳态：
`generateNames` **26–30µs / 20 条**、`generateAddresses` **40–56µs**（每多一条多一次
`resolveRegion`）、`generateEmails` **21–25µs**、`generateProfiles(20 组)` **97–133µs**、
不收窄的满批 `generateAddresses(50)` **0.19ms**。同样两个坑：没预热那 500 次就量到的是 JIT
爬坡；`# tests 95` 的整套 §G 用时 **41–52ms**（其中 G5 的恒定源探针占 12–16ms——那是
2,700 次有界重试的代价，不是随机性代价），进程总时 291–400ms 里大头是 node 启动与
`region-data.js` 的解析，别拿它做阈值。

Expected：`wc -c` **16,581 字节**、`gzip -6` **7,242 字节**；文件 **290 行**（`wc -l`），
其中四张词表那 10 行连随行注释 **1,435 字节**，注释 99 行 **7,538 字节**（占 45%——这一格的账
与 `bankcard.js` 相反，大头不是数据而是"为什么这么判"）。产物口径（terser 之后）到 Task 9
的收录面一起量，那里才有 `toolIdcard.min.js` 的真数。

- [ ] **Step 7: 提交**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
git status --porcelain
git add dev/js/tools/random-data.js scripts/toolkit-tests.mjs
git commit -m "$(cat <<'EOF'
feat(tools): 随机合成数据——姓名 / 地址 / 邮箱与一次一组

三张词表本站自造，判据只断形状与自洽；地址只出现行县级码，收窄三键照
idcard.js 的 prefixOf 同族闸门（null 与空串都抛，不静默放开整张表）。
批内不重复靠恒定随机源压出探针，"30 条不撞重"本身不算证据。
generateProfiles 刻意不挂身份证号：§5.1 只点三类，免责口径各说各话。
邮箱一律落 RFC 2606 保留域，EMAIL_RE 的域名一半从 EMAIL_DOMAINS 拼出来。
EOF
)"
git status --porcelain | head
```

Expected：提交只含这两条路径；剩下仍是对方那批未提交项。`_docs/superpowers/plans/` 里这份计划
按 Task 11 的收口节奏单独提。

<!-- APPEND-5 -->
