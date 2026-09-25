# 博客在线工具页设计：证件信息 / 编码换算 / JSON 格式化

日期：2026-09-25　·　站点版本目标：2.2.0　·　状态：待用户审阅

一句话：在 `better-blog` 里新增三个正式页面（证件与机构代码、编码与换算、JSON 格式化），
沿用站点既有的 Jekyll + Vite 模式与设计令牌，算法全部自实现并配 Node 侧可复现测试，
全部本地计算、零网络请求、零隐私外泄。

---

## 1. 目标与非目标

**目标**

1. 给站内补上一类现在完全没有的内容：可长期使用、可被检索到的开发工具页。
2. 三页都进搜索引擎口径（canonical、JSON-LD、sitemap、llms.txt、内链），而不只是"能打开"。
3. 与站点设计系统零冲突：明暗两主题 × 三档纸张色温全部自动跟随，不新增一个颜色字面量。
4. 每个可算错的地方都有自动化判据，判据本身要能变红。

**非目标（明确不做，避免实现时手滑扩范围）**

- 不做手机号**归属地**：需要 40 万级号段库（MB 级），且公开来源不可靠。只做格式校验 + 运营商识别，页面上写清这一条不做及为什么。
- 不做银行卡**发卡行全量**识别：公开可维护的 BIN 全量表不存在（都是商业库）。Luhn 校验是可靠结论，行别识别基于内置常见行别前缀并标注为参考。
- 不接任何真实身份/企业核验接口，不做姓名与号码一致性查询。核验类接口需企业资质，个人博客无法合规接入。
- 不给工具页做分享卡片：`scripts/og-images.mjs` 目前只覆盖 `_posts`，扩它属于另一件事。工具页的 `og:image` 走站点默认图 `social.og_default_image`，已由 `seoMeta.html` 兜底。
- 不引入前端框架，不改 `vite.config.js` 的 per-entry IIFE 产出方式。

---

## 2. 调研结论（全部实测，含可复现命令）

### 2.1 站内现状

- `/tools.html` 的语义已被占用：它是「我写的三款 Chrome 插件」产品展示页，数据源 `_data/tools.yml`，导航「工具箱」下拉同源于此。新页面不能叫"工具箱"。
- `site.nav` 是 `sitemap.xml`、`llms.txt`、`index-all.html` 三处的单一数据源；不在 nav 里的页面进不了站点地图，唯一破例是 `index-all.html` 在 `sitemap.xml` 里被点名。**顶级导航现有 7 项 + GitHub + 书架 + 搜索，已经很挤**（`index-all.html` 就是因为"第 9 项会在移动端换行"才不进导航的）。
- 构建链路：`dev/js/*.js`、`dev/sass/*.scss` 各为一个入口，Vite 打成 IIFE 落到 `assets/js|css/<name>.min.*`；两个配置文件都只扫目录一层，**子目录天然不成为入口**（`dev/sass/common/` 已按此约定用着）。CI（`.github/workflows/jekyll.yml`）只跑 `pnpm install --frozen-lockfile` + `pnpm build` + `jekyll build --baseurl`，**没有 lint/format 门禁**。
- `postcss-px-to-viewport` 全站生效，`viewportWidth: 750`，按选择器文本子串命中 `selectorBlackList` 才免换算，`mediaQuery: true`。**这是工具页最大的一个坑**：一个 13px 等宽输入框、240px 侧栏若被换成 vw，1440 屏上会整体放大近一倍，工作台直接不可用。
- `demo/idCardDemo/` 已有一版身份证查询页（详见 §11）。

### 2.2 数据源与算法：已验算，不是照抄

**身份证校验位（18 位）**　权重 `[7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2]`，`Σ mod 11` 查表 `'10X98765432'`。

- `11010119900307355` → 算得 `4`；`id-validator@1.3.0` 判 `110101199003073554` 有效、`…558` 无效 → **两个独立实现同结论**。（顺带纠正一个流传很广的"示例号"记忆：末位是 4 不是 8。）
- `44052418800101001` → 算得 `4`，`440524188001010014` 在两处都判有效。
- 本写法与 `id-validator` 的 `12 − (Σ mod 11)` 写法在 20 万条随机 body 上 **0 处分歧**。
- 15 位号码：地址码 6 + `yyMMdd` + 顺序码 3，**无校验位**，年份按 `19yy` 解释。**不提供"生成 15 位号码"**（15 位无法表达 20xx 出生，造出来是给人埋坑）；只在出生年落在 1900–1999 时，随 18 位结果附带其等价的 15 位写法并标注"由 18 位去世纪位得来"。

**统一社会信用代码（GB 32100-2015）**　字符集 31 个：`0-9A-Z` 去掉 `I O S Z V`，值按序 0..30；`Wi = 3^(i-1) mod 31` = `1,3,9,27,19,26,16,17,20,29,25,13,8,24,10,30,28`；`C18 = (31 − (Σ Vi·Wi mod 31)) mod 31`，**余数为 0 时校验码取字符 `0`**（约 1/31 的真实码落这一档；写成 `31 − Σ mod 31` 而漏掉外层 `mod 31` 会算出值 31、越界成 `undefined`，是把这段算法从别处抄来时常丢的一步。本轮对过的外部解析资料（极速数据《统一社会信用代码校验码算法》一页）把末位写作 `check_value = (31 − (total mod 31)) mod 31`，与这里同式；31 字符集剔除 `I O S Z V`、`Wi = 3^i mod 31` 两条亦逐项一致。权重表 17 项由本轮幂算式自证，见 §8.1）。

- 标准示例 `91350100M000100Y43`：前 17 位算得校验位 `3` == 样本末位 → **PASS**。
- 同一样本内层的组织机构代码 `M000100Y` + 权重 `[3,7,9,10,5,8,4,2]`，`11 − (Σ mod 11)`（11→`0`、10→`X`）算得 `4` == 样本第 17 位 → **PASS**。两条算法在同一真实样本上互相咬合，说明字符集映射与两套权重表都取对了。
- 结构：`[1 登记管理部门][1 机构类别][6 行政区划][8 主体标识 + 1 组织机构代码校验][1 USCC 校验]`。
- **内层校验值为 10 时写 `X` 还是 `A`，本轮没取到权威口径**（GB 11714 的 `10→X` 与 USCC 附录里按 31 字符集取 `A` 两种说法都流传，取值表原文拿不到）。处理办法是三档而非猜一个：解析侧两种写法都放行（值 10 时接受 `X`/`A`）、第 17 位是其他字母时**不下结论**（非企业主体的第 9–17 位本就不是组织机构代码体系），只有"是数字且与算得的值不等"才判 `false`；生成侧直接回避这一分支（前 7 位固定时，使内层值为 10 的末位在 `0..9` 中至多一个，挪一格即可）。
- 第 1、2 位（登记管理部门、机构类别）的取值含义表同样未取到可核实来源：**模块与面板一律不输出名称，只给字符与其在 31 字符集里的值**（口径见 §5.1 与实现计划 §5.1）。这比"标个『参考』继续显示凭记忆写的名称"更硬——不假装知道，用户也就不会据此填表。

**区划码表：新旧两层，缺一不可**

- 现行源：`modood/Administrative-divisions-of-China` 的 `areas.json`，实测 `HTTP 200 / 228,316B / 2,978 条县级`，结构 `{code, name, cityCode, provinceCode}`，配合 `provinces.json` + `cities.json` 可拼三级全名。
- **这份"现行"表本身有截止日期**：`dist/areas.json` 最后一次提交是 `dc3a1d7acd`（2023-09-13），提交信息写明「数据更新时间：2022-10-31，发布时间：2022-12-29」。也就是说它是 **2022-10-31 口径**，到 2026-09 已滞后约四年。因此：① 生成物与页面必须把 `datasetVersion: '2022-10-31'` 显示出来；② 2022-11 之后新设或改名的区划会落进 §5.4 的"未收录"分支而不是被误报为无效；③ 刷新数据是换 `scripts/fixtures/region-source/` 里的快照，一条命令。
- 站内现有的 `GB2260.js`（npm `id-validator@1.3.0`，MIT，作者 mc-zone）共 **3,465 条**，实测仍含 `110103 北京市崇文区`（2010 撤销）、`110104 宣武区`（2010 撤销）、`110221 昌平县`（2015 改区）、`110228 密云县`（2015 改区）、`371200 山东省莱芜市`（2019 并入济南）。
- **不写死任何"某码 = 某新设县"的断言。** 起草本节时曾凭记忆写下"源表缺 `653224` 和田地区和安县（2020 设）"，实测两处都错：现行表里 `653224` 是**洛浦县**，而「和安县」「和康县」在这 2,978 条里一条都搜不到——它们 2020 年自和田县析置，但区划代码未见权威公布。这条自身错误正是 §8.1 要求"抽查项必须逐条从源数据读出后再写进判据"的理由。
- 结论不是"换掉旧的"，而是**两层都要**：撤销建制的历史码必须能解出来（真实存在的老号码就带它们），而生成只能从现行表取。
- 反面教材实测：`id-validator` 解 `440524` 得到 `广东省汕头市未知地区` —— 回落到市级后放弃，输出一个"未知地区"。本设计不允许出现这种文案（见 §5.4）。

**三方库评估**

| 候选 | 实测 | 决定 |
|---|---|---|
| `id-validator@1.3.0` | MIT / 0 依赖 / 码表 2015 年前后 | 只当**对拍参照物**，不进包 |
| `uscc@1.2.0` | **GPL-3.0** | 禁止引入（本仓库 MIT） |
| `china-division@2.7.0` | 解包 190,712,212B | 不引 |
| `province-city-china@8.5.8` | 解包 25,091,081B | 不引 |
| `js-yaml@5.4.2` | MIT，有 `./browser` 的 UMD/ESM min 入口 | **唯一新增依赖**（`-D`，只进 JSON 页产物） |
| `fast-xml-parser@5.11.1` | MIT，6 个依赖 | 不引：`DOMParser` + `XMLSerializer` 原生够用 |
| `papaparse@5.7.0` | MIT，0 依赖，解包 270,635B | 不引：RFC 4180 的 CSV 自写约 100 行 |
| `crypto-js@4.2.0` | MIT | 不引：SHA-* 走 `crypto.subtle`，只有 MD5 需自带实现 |

净结果：**运行时新增依赖只有 js-yaml 一个 MIT 包**，其余全部自实现、全部可测。

**Web Crypto 口径**：`crypto.subtle.digest` 只在安全上下文可用。站点线上是 GitHub Pages HTTPS，本地 `http://localhost:4000` 属安全上下文 → 都可用；`crypto.subtle` 取不到时（例如有人以 `http://192.168.x.x` 打开）摘要面板显示一行明确提示，不静默出空值。MD5 不在 Web Crypto 内，自带实现（~2.5KB），对 RFC 1321 官方向量校验。

---

## 3. 决策记录

| # | 决策 | 依据 |
|---|---|---|
| D1 | 实现方案 A：Jekyll 页面 + `dev/js`/`dev/sass` 新入口，Vite IIFE，零框架 | 设计系统/主题/动效令牌/head 资产清单/SEO 自动一致；两页各加载各的产物。方案 B（`demo/` 独立页）会复制"孤儿页"问题；方案 C（框架）与 per-entry IIFE 无代码分割的构建相冲突且收益为负 |
| D2 | 拆三页：证件信息 / 编码换算 / JSON 格式化 | 每页语义单一、各吃各的检索词、首屏 JS 各自最小 |
| D3 | 能力边界：纯本地测试数据 + 校验解码 | 不做真实身份核验；本地计算 → 零隐私外泄、离线可用 |
| D4 | 入口：挂进现有「工具箱」下拉的新分组，顶级导航项数量不变 | 导航已经很挤；`sitemap.xml` 按 `index-all.html` 的先例点名收录 |
| D5 | 版本按 2.2.0 一次收完，版本三处同步放到实现最后一步 | `_config.yml` 与 `package.json` 此刻被另一个会话改着 |
| D6 | `demo/idCardDemo/` 在新页覆盖成立后删除 | 覆盖性论证见 §11 |

---

## 4. 信息架构与入口

### 4.1 三页

源文件放仓库根（与现有 `tools.html`、`weblab.html` 平级），用 `permalink` 输出到 `/tools/` 目录下：

| 源文件 | permalink | H1 | `<title>` 检索口径 |
|---|---|---|---|
| `tools-idcard.html` | `/tools/idcard.html` | 证件与机构代码工具 | 身份证号校验与测试号生成 · 统一社会信用代码在线解析 |
| `tools-codec.html` | `/tools/codec.html` | 编码与换算工具 | 时间戳转换 · Base64 · URL 编解码 · MD5/SHA 摘要 · 正则测试 |
| `tools-json.html` | `/tools/json.html` | JSON 格式化工具 | JSON 在线格式化与校验 · JSON 转 TypeScript/YAML/XML/CSV |

三页均 `layout: default`，写 `title` / `seo_description` / `permalink`，`{% include header.html %}` + `{% include footer.html %}`。`canonical`、`robots`、`og:*`、`CollectionPage` JSON-LD 由 `seoMeta.html` → `jsonLd.html` 现有的 `page.title` 分支自动发出，不需要新模板。

### 4.2 单一数据源：`_data/onlineTools.yml`

三个消费点（导航下拉分组、`tools.html` 的在线工具小节、`index-all.html` 页面清单）共用一份，不各抄一遍——`headAssets.html` 的文件头注释就是为这类漂移写的。字段：`slug` / `url` / `name` / `tagline` / `desc` / `icon` / `panels`（面板锚点清单，供下拉与页内索引复用）。

### 4.3 导航高亮判据必须改（现存缺陷）

`_includes/header.html` 现在用 `page.url contains item.url` 判 `is_current`。新页 `page.url` 是 `/tools/idcard.html`，**不包含** `/tools.html`，结果点进工具页后「工具箱」不高亮、下拉的当前项也没有态。

改法：先把 nav 项的 `.html` 剥成目录前缀（`/tools.html` → `/tools`），再用它做前缀匹配；下拉子项额外按 `page.url` 精确匹配加 `is-on`。改完必须核验：对现有 7 项 × 站内 100+ 页面，`.is-current` 的数量与位置和改前一致，只多出三个工具页应得的高亮（判据见 §8.2）。

### 4.4 收录面同步清单

新增 3 页会牵动以下每一处，一处都不能漏（漏了就是"页面在但爬虫找不到"或"自检数字对不上"）：

1. `sitemap.xml`：按 `index-all.html` 的先例点名三条地址（`changefreq: monthly`、`priority: 0.7`）。
2. `llms.txt`：站点页面段列出三条（含 `seo_description` 摘要）。
3. `index-all.html`：页面清单加一节「在线工具」。
4. `_includes/header.html`：下拉加「在线工具」分组 + §4.3 的 active 判据。
5. `tools.html`：顶部加「在线工具」小节，把插件页的老流量导到新页。
6. `USAGE.md`：`检索层自查` 第 3 条的预期计数要改——新页各带一份 `CollectionPage`，`CollectionPage 26 → 29`、总数 `164 → 167`。
7. **本设计文档自身的位置**：放在 `_docs/superpowers/specs/`，不放 `docs/`。实测证明（`bundle exec jekyll build --destination /tmp/jek-leak-test`，exit=0）：不带 front matter 的 `.md` 会被原样拷进产物，`docs/superpowers/specs/…md` 在线上是公开可读的仓库内部文档，而 `_docs/` 完全不进产物；同一次构建里被显式 exclude 的 `CHANGELOG.md` 也不在产物中，说明这个判据不是恒真。**若将来确实要用 `docs/`，必须先给 `_config.yml` 的 `exclude` 加一条 `docs`**——这条与 `OPTIMIZATION_COMPLETE.md`、`assets/**/*.md` 那两条排除条目同源。
8. `README.md`：站点结构 / 页面清单。
9. `CHANGELOG.md` + `_config.yml: version` + `package.json: version` → 2.2.0（最后一步做，见 §10）。

---

## 5. 功能规格

### 5.1 `/tools/idcard.html` —— 面板式工作区，5 个面板

| 锚点 | 面板 | 输入 → 输出 |
|---|---|---|
| `#idcard` | 身份证 | **生成**：区划（省→市→县三级级联，只出现行码）、性别、年龄段（或指定出生日期）、数量 1–50 → 号码列表，每行附「区划全名 · 生日 · 性别 · 校验位」，支持整表复制、单条复制、同时输出 15 位对应形式（仅在可无歧义表达时）。**校验/解码**：粘单个号码 → 三态结论 + 逐项判定 + 全量解析（省/市/县码与名、生日+周岁、性别、顺序码、校验位计算过程）；支持一次粘多行逐行判定。出生年落在 1900–1999 内时，随每条结果附等价的 15 位写法（口径见 §2.2） |
| `#uscc` | 统一社会信用代码 | **生成**：第 1、2 位按 31 字符集里的合法字符出下拉（**不显示名称**，取值表未核实，见 §2.2 与 §11）、行政区划（现行码，市级起）→ 合规号码，第 9–17 位用真实结构（8 位本体 + `GB/T 11714` 校验位），且生成侧不产出内层值为 10 的那一档。**校验/解析**：三态结论 + 逐段解析（登记部门码与机构类别码只给**字符 + 值**、区划名、主体标识、内层组织机构代码校验位、USCC 校验位算式）；显式提示 `I O S Z V` 不属字符集，出现即判结构非法 |
| `#bankcard` | 银行卡 | **校验**：Luhn + 长度（13–19 位）→ 结论 + 逐位算式；行别按内置前缀表给出（**标注为参考、不承诺全量**）。**生成**：选行别（默认「随机主流行别」）→ 前缀 + 随机体 + Luhn 校验位补齐 |
| `#mobile` | 手机号 | 校验：格式 + 运营商识别（3–7 位前缀表）；生成：按运营商出测试号；面板内一行写明「不做归属地，为什么」 |
| `#random` | 随机测试数据 | 姓名 / 地址 / 邮箱，单类或一次一组；地址由现行区划表 + 随机门牌拼；姓名用高频姓氏 + 常用字库，**明写"随机合成，不指向任何真实个人"** |

### 5.2 `/tools/codec.html` —— 面板式工作区，5 个面板

`#timestamp`（秒/毫秒自动识别 ↔ 本地与 UTC、ISO8601、RFC3339、相对时间、两个日期之差）、`#base64`（UTF-8 安全编解码，支持带换行的 data URI 场景）、`#url`（`encodeURIComponent`/`decodeURIComponent` 与 `encodeURI` 口径差异并列展示 + query 参数拆解）、`#digest`（MD5 自带实现，SHA-1/256/384/512 走 `crypto.subtle`；支持文本与文件，文件走 `ArrayBuffer` 不进字符串）、`#regex`（flags 可选、实时高亮匹配、捕获组与命名字段、替换预览、**步数上限防回溯炸页**）。

### 5.3 `/tools/json.html` —— 单工作台，不是面板式

布局：左侧输入（带行号），右侧输出，顶部一条工具栏；视图在「文本 / 树」之间切。树视图支持折叠展开、按 key/值搜索、点击复制 JSON Pointer 路径、**只渲染可视节点、展开时增量渲染**（预算见 §7，用例见 §8.1）。

工具栏：格式化（缩进 2/4/tab 可切）、压缩、校验（错误处标出精确**行列号**并在输入区高亮那一处——原生 `JSON.parse` 的 position 提示过于含糊，这块自实现）、键排序（可选递归/仅顶层）、转义 / 反转义、复制、下载 `.json`、JSON → TypeScript interface（嵌套对象、数组、联合、`null`、可选键都覆盖）、JSON ↔ YAML（js-yaml）、JSON ↔ XML（`DOMParser` + `XMLSerializer`）、JSON ↔ CSV（自实现 RFC 4180：引号转义、内嵌换行、CRLF、BOM、表头行）。

### 5.4 校验输出口径（三页共用，这决定工具可不可信）

- 三态：`有效` / `校验位不符` / `结构非法`。三者必须在 UI 上可区分——"校验位不符"意味着号段结构对但末位不对（最常见是手抄错），"结构非法"意味着长度/字符集/日期本身不成立。
- 逐项判定表：长度、字符集、区划、出生日期、顺序码、校验位，每行给结论 + 依据。**让用户看得见"为什么不行"，而不是只吐一个"不正确"。**
- **区划码查不到时不下"无效"结论**：输出「区划码未收录（可能是已撤销建制或特殊区域码）」，其余项照常判定。真实存在的有效号码确实会带老码和开发区码，判它无效就是工具错。
- 区划回落链（六档，优先级实测自两张表，实现见计划 Task 3 的 `resolveRegion`）：**现行县级 6 位精确命中 → 6 位形如「市级码 + 00」或「省级码 + 0000」按现行市/省级直接命中 → 历史层命中 → 4 位市级回落 → 2 位省级回落 → 落空**。每一档都要在输出里说明命中级别（`level: county|city|province|none`），绝不出现 §2.2 那种「未知地区」。第二条不是修辞：真实号码里 `110100`（市本级）这类码大量存在，若只按"6→4→2 查不到才降一级"实现，它会掉进市级回落、把"这就是市本级"这件事说成"县级查不到"。
- **历史层命中不得断言「已撤销建制」**：实读两表交集 1,934 条里有 **63 条码未变而名称已改**（`210112` 东陵区→浑南区、`210782` 北宁市→北镇市、`130502` 桥东区→襄都区 等），对这批码"已撤销"是错的，而本站也没有码→码的取代关系可给。统一措辞为「未见于现行区划表（历史口径 2015）」，市/省级历史码再补一句所属地市；真撤销的那批（`110103` 崇文区）由同一句话覆盖，不丢信息。
- 出生日期：真实日历校验（含闰年）、不晚于今天、下限 18 位取 1900-01-01、15 位按其 2 位年解释出的范围。

### 5.5 合规与对外文案口径

- 生成类面板固定一行提示：「随机合成，与真实号码重合的概率可忽略；仅供开发与测试用途，不得用于任何真实身份用途。」`#random` 姓名面板同样声明不指向真实个人。
- 三页全部本地计算：**不发任何网络请求、不写 localStorage 存用户输入**。JSON 页可选"记住上次输入"，**默认关**，开关文案要写清数据只存在本机浏览器。
- `#idcard` 输入框禁用浏览器自动填充与拼写检查（`autocomplete="off"`、`autocorrect="off"`、`spellcheck="false"`），避免测试号被回填进真实表单——这是工具页，不是表单。

---

## 6. 技术架构

### 6.1 构建接线（不需要改 `vite.config.js`）

`getDevJsEntries()` 与 `getDevSassEntries()` 都只扫目录一层、且按 `.js`/`.scss` 后缀过滤，**子目录不会成为入口**。因此共享模块放 `dev/js/tools/`，与 `dev/sass/common/` 是同一个约定，构建配置零改动。

新增入口：`dev/js/toolIdcard.js`、`dev/js/toolCodec.js`、`dev/js/toolJson.js`（产物 `assets/js/toolIdcard.min.js` 等）；样式一个共享 `dev/sass/toolkit.scss` + JSON 专有 `dev/sass/toolJson.scss`。

**产物名逐字符跟随源文件名（大小写原样保留）**：`weblab.scss` 出 `weblab.min.css`，而 `webLab.js` 出 `webLab.min.js`——同一个页面的两个资源大小写口径不同，页面里写错一个字母在 macOS 本地看不出问题，Linux 构建的线上一律 404（这条教训写在 `weblab.html` 文件头）。所以新页引用 `toolIdcard.min.js` / `toolkit.min.css` / `toolJson.min.css` 时必须与源 basename 逐字符一致，并由 §8.2 第 6 条断言"页面上引用的每个产物路径在 `_site` 里真实存在"。

### 6.2 文件清单

**新增**

```
tools-idcard.html  tools-codec.html  tools-json.html     三个页面
_data/onlineTools.yml                                      在线工具单一数据源
dev/sass/toolkit.scss  dev/sass/toolJson.scss
dev/js/toolIdcard.js   dev/js/toolCodec.js   dev/js/toolJson.js     页面装配层
dev/js/tools/panel.js          面板框架（§6.4）
dev/js/tools/ui.js             复制、Toast、字段格式化等公共 UI 件
dev/js/tools/region-data.js    生成产物：现行 + 历史两张区划表（纯数据）
dev/js/tools/region.js         手写：包住上面那份数据，提供 resolveRegion / 回落链 / 现行码集合
dev/js/tools/idcard.js         校验 / 解码 / 生成
dev/js/tools/uscc.js           同上，含 31 字符集与两套权重表
dev/js/tools/bankcard.js       Luhn + 行别前缀表 + 生成
dev/js/tools/phone.js          格式 + 运营商前缀表 + 生成
dev/js/tools/random-data.js    姓名 / 地址 / 邮箱
dev/js/tools/time.js           时间戳与日期换算
dev/js/tools/codec.js          Base64（UTF-8）/ URL
dev/js/tools/digest.js         MD5 自实现 + crypto.subtle 包装
dev/js/tools/regex.js          正则测试（带步数上限）
dev/js/tools/json-core.js      解析 + 精确错误定位 + 排序 + pointer
dev/js/tools/json-tree.js      树渲染（增量）
dev/js/tools/json-ts.js        TypeScript 类型生成
dev/js/tools/json-convert.js   YAML / XML / CSV 三对互转
scripts/build-region-data.mjs                              §6.5
scripts/toolkit-tests.mjs                                  §8.1
```

**修改**：`_includes/header.html`、`tools.html`、`sitemap.xml`、`llms.txt`、`index-all.html`、`_config.yml`、`USAGE.md`、`README.md`、`CHANGELOG.md`、`package.json`、`pnpm-lock.yaml`、`postcss.config.js`、`demo.json`、`.gitignore`（若需要）。**删除**：`demo/idCardDemo/`（§11）。

### 6.3 面板框架：渐进增强 + hash 深链 + 真 ARIA

面板全部由 Jekyll 构建期渲染进 HTML（跟 `demo.html` 那次"从 JS 回填改成构建期渲染"的判断一致：禁用 JS 与爬虫都要看得见内容）。`toolIdcard.js` 加载后把它们升级成「左侧粘性索引 + 一次只显示一个面板」的工作区：

- `role="tablist"` / `role="tab"` / `role="tabpanel"`，方向键上下切换、`Home`/`End`、roving `tabindex`（WAI-ARIA Tabs 模式），焦点环复用站点现有 `:focus-visible` 样式。
- `#hash` 与当前面板双向同步，深链进来直接展开对应面板；hash 变化不触发滚动跳动（`scroll-margin-top` 顶开固定头）。
- JS 未执行时：面板全部可见、按文档顺序排、锚点照常跳，左侧索引退化成普通目录链接。
- 面板内任何一块抛错只塌那一块（每面板独立 `try/catch` + 就地错误条），不整页崩。

### 6.4 视觉、主题与 px→vw 例外（关键约束）

- 全部取 `dev/sass/common/tokens.scss` 的语义变量（`--paper` / `--surface` / `--surface-2` / `--ink` / `--ink-2` / `--ink-3` / `--ink-4` / `--rule` / `--signal` / `--radius-*` / `--dur-*` / `--ease-*`），**不写一个颜色字面量**。暗色（`body.night-mode`）与三档纸张色温（`html[data-rs-paper]`）因此自动跟随，不需要第二份覆盖表——这正是 `tokens.scss` 文件头声明的设计意图。
- 文字对比度只允许用 `--ink` / `--ink-2` / `--ink-3`；`--ink-4` 实测在纸上只有 3.78:1，**不得用于小于 18px 的正文性文字**（`tokens.scss` 注释与项目记忆里都记着这一条，站内 86 个 10.5–13px 消费者是它的上限）。
- **必须进 `selectorBlackList`**：新页类名统一前缀 `.tk-`（toolkit）与 `.jt-`（JSON 工作台），在 `postcss.config.js` 里加这两条，理由与 `.lab-content`/`.cmdk`/`.shelf` 同族——工作台尺寸（行号栏宽、等宽字号、缩进步长、树的折叠三角）按桌面固定值设计，被换成 vw 会在大屏上整体放大、页面不可用。加完必须核验：产物 `assets/css/toolkit.min.css` 里 `.tk-`/`.jt-` 规则中不残留任何 `vw`（`mediaQuery: true` 意味着 `@media` 里的 px 也会被换算，只看一条规则不够）。
- 响应式：索引在 ≤900px 折成横向滚动 chip 条；JSON 工作台 ≤900px 从左右分栏改成上下堆叠 + 视图切换；**必须实测中间断点（901–1100px）**，不只看 375/1440 两端——项目记忆里那条"删了 `nth-child(2n)` 的 float 只有 800–1000px 塌"的教训就是没测中间档。

### 6.5 数据构建与第三方许可

`scripts/build-region-data.mjs`（Node 22，无新依赖）：抓 `provinces.json` + `cities.json` + `areas.json`，读站内旧 `GB2260.js`，产出 `dev/js/tools/region-data.js`，内含两张表 + 元信息（`source` / `datasetVersion` / `generatedAt` / 各表计数）。要求：

- 生成侧只暴露现行县级码集合；解码侧可查两层，历史层带撤销标记。
- 脚本可重复执行（同一输入 → 同一字节输出，字典序排序、无时间戳抖动），并支持"离线用本地缓存的 JSON"跑通（CI 无外网时不能挂）。
- 归属记录：新建 `assets/data/LICENSES.md`，按 `assets/fonts/LICENSES.md` 的既有做法写清两份来源的许可与用途。**许可已复核，不是"记得是 MIT"**：`modood/Administrative-divisions-of-China` 经 GitHub API（`/repos/…/license`，HTTP 200）确认为 **WTFPL v2**，`LICENSE` 文件在仓库根，仓库 2,097 star、最近推送 2025-12-27；WTFPL 无任何附加条件，与 MIT 仓库兼容，但仍要署名来源，并注明数据本体是国家统计局公布的统计用区划代码（政府公开信息），该仓库只是整理格式。`mc-zone/IDValidator` 的 MIT 从 `demo/idCardDemo/lib/IDValidator.js` 文件头原文确认（`Released under the MIT license`）。

---

## 7. 性能与健壮性预算

| 项 | 预算 / 规则 | 超了怎么办 |
|---|---|---|
| 区划表产物 | gzip ≤ **36KB**，且**只挂证件页** | 再压：区划只存 `code→[省index,市index,名]` 三级索引 |
| 证件页 JS+CSS | gzip ≤ 60KB | 拆掉非首屏面板逻辑 |
| JSON 页 JS+CSS | gzip ≤ 120KB（含 js-yaml） | js-yaml 用 `dist/browser/js-yaml.esm.min.mjs` 入口；仍超则把 YAML 降到"仅序列化" |
| 输入硬上限 | JSON 5MB / 20 万行；文本类工具 1MB | 明确拒绝并给出一行原因，**不许静默截断** |
| 树视图 | 首屏只渲染可视节点，展开增量渲染 | 已定为此实现，不是"卡了再优化" |
| 正则 | 匹配步数上限 + 超时保护 | 命中上限时提示"疑似灾难性回溯" |
| 深样本 | 200 层嵌套、含 `</script>` 的字符串值、emoji 与代理对、BOM | 全部有测试用例（§8.1），落 DOM 一律 `textContent`/显式转义 |

体积以落地实测为准（2026-09-25，输入钉在 pin `6fb5380d`）：产物 `dev/js/tools/region-data.js` 为 100,020 字节 / **34,807B gzip = 33.99KB**。写设计时的两个估计（分组编码 92.6KB/31.9KB、历史表不分组 32.5KB）都偏低约 2KB，差额未逐项归因，只把预算按实测算钉。三级索引那档压法留给真超预算时再用，现在多出来的量换来的是"生成器与解析器各只有 10 行、出错一眼看得懂"。

预算取 36KB 而不是贴着实测的 34KB：同一份字节在 `level 6/9` 之间实测相差 194B，换 `strategy` 到 `Z_FILTERED` 差 2,036B——34KB 只剩 9 字节余量，会被压缩器版本与默认参数的抖动直接抖翻，那条判据就从"防体积回退"变成了"防今天用哪个 Node"。**抬预算吸收的是抖动，不是数据增长**：四张表若退回朴素 `JSON.stringify`（键名重复）实测 62.7KB gzip，仍被 36KB 拦下；`--fetch` 刷新快照带来的条数增长同样该红，红了要人重新决定预算，这是设计意图不是误报。

---

## 8. 验证方案（做什么才算"过"）

### 8.1 算法与转换：`scripts/toolkit-tests.mjs` + `pnpm test:tools`

纯 Node 22、无新依赖、失败非零退出。**每条判据都必须能变红**（写完后往真产物里注入一处错，看它是否报错——这条自证要求来自项目记忆里"守卫判据须自证仍有牙"那次教训）。

- 身份证：§2.2 已验算的样本固化为用例；15/18 位、闰年 2 月 29、非闰 2 月 29、12 月 31、校验位 `X`、末位大小写 `x`、含空格、超长、非数字；**与 `id-validator@1.3.0` 对拍 10 万条随机号**，两个独立实现同结论才算过。
- USCC：标准示例 + 从企业公示信息里取 ≥5 条真实码；断言字符集恰为 31 个且不含 `IOSZV`；断言 `Wi === 3^(i-1) mod 31` 逐位成立；断言内层组织机构代码校验位与 USCC 校验位在同一真实码上自洽。
- 区划表：无 6 位重复、现行 ∩ 历史 = ∅、现行计数 == 源 JSON 计数。抽查项全部已于 2026-09-25 从三个源 JSON 实读确认：`110101` 东城区（现行，areas 首条）、`110103` 崇文区（现行表**无**、只出现在历史层并带撤销标记）、`3712` 莱芜（cities 现表**无** → 只进历史层）、`440524`（areas 现表**无**而 `4405` 汕头市在 cities 有 → 命中"仅市级可回落"分支，解出「广东省汕头市」且不输出"未知地区"）。
- 银行卡 / 手机号：Luhn 官方向量、13–19 位边界；运营商前缀表逐条断言不重叠冲突。
- 摘要：MD5 对 RFC 1321 全部官方向量；SHA-1/256/384/512 与 Node `crypto` 逐条对拍；文件路径与字符串路径同结果。
- JSON：20 个坏样本逐个断言报出的**行列号**（不是只断"抛错"）；键排序稳定性；pointer 转义（`~0`/`~1`）。
- 互转：YAML / XML / CSV 三对往返等价（JSON→X→JSON 深比较），脏样本集含 emoji、`</script>`、200 层嵌套、内嵌换行的 CSV 字段、`null`、空对象、数组套数组。
- TS 生成：嵌套对象 / 数组 / 联合 / 可选键 / 数字开头键 / `null` 各一用例。

### 8.2 产物与收录面

`pnpm build` + `bundle exec jekyll build`，然后跑 `USAGE.md`「检索层自查」那族**全量**自检（不只对本次改动跑——这条也是项目记忆里记着的教训），并把预期计数按 §4.4 第 6 条更新后确认仍绿。追加三条本次新增的断言：

1. `_site/tools/{idcard,codec,json}.html` 三个文件存在，各自带 `canonical`、`CollectionPage` JSON-LD 且能被 JSON 解析。
2. `sitemap.xml` 含三条带 `baseurl` 的完整地址；`llms.txt`、`index-all.html` 各含三条链接。
3. 导航高亮：三页各恰有一个 `.is-current` 且落在「工具箱」上；下拉内当前项带 `is-on`；**同时抽查现有页面（首页/分类/标签/示例/编辑器/关于/tools.html）的高亮态与改前逐字节一致**。
4. `docs/` 不出现在 `_site` 里（排除条目生效）；`demo/idCardDemo` 删除后 `_site` 里无残留、全站无 404 内链（对 `_site/*.html` 的站内 `href` 全量扫一遍）。
5. 产物 CSS 里 `.tk-`/`.jt-` 无 `vw` 残留（§6.4）。
6. 三页 HTML 里引用到的每个 `assets/js|css/*.min.*` 路径，在 `_site` 对应位置真实存在（专防 §6.1 那个大小写坑）。

### 8.3 浏览器实测（headless Chrome）

- 三页真实传输字节（Network 层，不看磁盘大小）。
- 明 / 暗两主题 × 暖/冷/绿三档纸色，逐档取面板主要文字与控件的对比度数值；换肤采样要等样式重算落定再读（项目记忆里的过渡态误判教训）。
- 375 / 768 / 900 / 1024 / 1440 五档截图目测 + 量一次横向溢出（**量显隐前必须 `setDeviceMetricsOverride` 并自证 `innerWidth`**，headless 默认视口不是桌面尺寸）。
- 键盘走完一遍：`Tab` 进索引、方向键切面板、`Esc`、焦点可见、`Enter` 触发复制。
- 禁用 JS（CDP `ScriptExecutionDisabled`）打开三页：内容与面板全部可读、锚点可跳。
- 面板切换与真实生成/校验各跑一遍，`Runtime.exceptionThrown` 与 `console.error` 必须为 0。
- 一次 5MB JSON、一次 200 层嵌套、一次灾难性正则，确认"明确拒绝/有上限"而不是页面卡死。

---

## 9. Git 与并发会话

仓库现状（开工时实测）：工作区有另一会话 9 处未提交改动（含 `_config.yml`、`README.md`、`USAGE.md`、`_layouts/post.html`、`dev/js/editorial.js`），reflog 显示同一时段它已提交 4 次；`deploy-github.sh` 会 `git add -A`。

规则：

1. 不跑 `deploy-github.sh`，不 `git add -A`/`git add .`；**只按文件名 stage 自己碰的那些**。
2. `_config.yml`、`package.json`、`pnpm-lock.yaml`、`CHANGELOG.md` 属共享文件：每次暂存前重读当前内容，确认对方改动已在 `main` 上落定或对方那部分确属本次要一起提交的，再动；hunk 切分在这个仓库被验证过无效，别试。
3. 版本三处同步（`_config.yml: version` / `package.json: version` / `CHANGELOG.md`）留到最后一步做。
4. 提交可以按本设计推进；**push 与部署单独征求同意**，且 push 前先 `git ls-remote` 核实远端状态。
5. `pnpm-lock.yaml` 必须与 `package.json` 同一次提交（CI 是 `--frozen-lockfile`，锁文件落后直接构建失败）。

---

## 10. 旧 `demo/idCardDemo/` 的覆盖性论证与处置

现功能全集（读源码 `demo/idCardDemo/js/index.js`，44 行）：输入一个号码 → `IDValidator.isValid()` → 有效则 `getInfo()` 输出三个字段：户口所在地、出生年月日、性别；无效输出一行「输入的身份证号码不正确！！！」。

新 `#idcard` 面板的输出是它的严格超集：同样给出区划全名 / 生日 / 性别，并且给出校验位判定过程与逐项结论、支持 15 位、支持多行批量、支持生成、且区划名比它准（旧表 2015 年前后，新表两层）。**覆盖成立。**

处置：删 `demo/idCardDemo/` 整个目录，并从 `demo.json` 摘掉「中国大陆身份证号码信息查询」那条。依据：站内**零文章引用**（全库 grep `idCardDemo` 只有 `demo.json` 与该目录自身，另有一处 `vite.demo.config.js` 的文件头注释拿它当 CSS 去重现象的例子），且 `/demo/` 下页面本就不进 `sitemap.xml`（`sitemap.xml` 的注释里明确写着这条排除理由），无 SEO 资产损失。

两个连带项：① `vite.demo.config.js` 文件头注释里"实测仅 catDemo、idCardDemo 幸存"那句要改写，否则注释描述的是一份已经不存在的目录；② 若担心有人存过旧地址，`_site/demo/idCardDemo/index.html` 删除后会 404——站内无入口、外链不可知，接受这个 404，不做跳转页（一个 Jekyll 跳转页的成本高于它的价值）。

---

## 11. 风险

| 风险 | 处置 |
|---|---|
| px→vw 把工作台换坏（最容易踩、且只在真机上看得见） | §6.4 把 `.tk-`/`.jt-` 进黑名单 + §8.2 第 5 条产物断言 + §8.3 五档实测 |
| `header.html` 判据改动波及全站 100+ 页的高亮 | §8.2 第 3 条做逐字节抽查，不只测新页 |
| 真实企业码样本不足导致 USCC 判据是"自证" | 实现前先把 ≥5 条可公开核实的真实码连同来源写进测试文件注释；不足就把该项标为未验证，不假装过。**已实测：2026-09-25 依次试取 4 个公开来源（政府公示页、IPO 法律文件页、维基、搜索命中页），只拿到结构说明与国标示例 `91350100M000100Y43` 这一条可核验样本；凭记忆写的 4 条候选码有 3 条校验位不通**——所以样本收集必须"先算校验位再入库"，不能凭印象。第 1、2 位的登记管理部门/机构类别取值表同样未取到权威来源，**面板与模块一律不输出这两位的名称**（只给字符与 31 字符集里的值），且不作为测试判据；内层第 17 位值为 10 时写 `X` 还是 `A` 也未核实，按 §2.2 的三档处理（解析两放、字母不下结论、生成回避）。 |
| modood 数据仓库的许可 | 已复核为 WTFPL（§6.5），不再是风险；但要留意 WTFPL 无 warranty 条款，数据准确性由我们的测试兜（§8.1 的区划表断言） |
| 与另一会话抢 `_config.yml`/`package.json` | §9 规则 2、3 |
| 三页 + 编码面板 + 互转，工作量集中在"手写 DOM" | 交付顺序按 §12 分五段，每段有独立可验产物，不攒到最后一次验 |
| 生成号码被误用 | §5.5 的面板级声明 + 页面底部一段用途说明；不提供"批量导出 1 万条"这类功能（数量上限 50） |

---

## 12. 交付顺序（五段，每段结束都有可验产物）

1. **地基**：区划数据生成脚本 + 两张表 + `toolkit-tests.mjs` 骨架 + `panel.js` 框架 + `tools-idcard.html` 的 `#idcard`/`#uscc` 两面板（含 §8.1 里这两块的全部用例）→ 此段结束就能独立核验算法与区划两层。
2. **证件页收口**：`#bankcard`/`#mobile`/`#random` + 样式与主题 + 三处入口（下拉/`tools.html` 小节/`index-all`）+ 收录面（sitemap/llms/`USAGE.md` 计数）→ 跑一遍 §8.2 全量产物自检。
3. **编码页**：5 面板 + `digest`/`regex` 用例 + 该页样式与断点。
4. **JSON 页**：`json-core`（含错误定位）→ `json-tree` → `json-ts` → `json-convert`，每块跟自己的用例；然后处理 js-yaml 依赖与锁文件；`toolJson.scss` 与工作台布局。
5. **收尾**：删 `demo/idCardDemo/`（§10 两个连带项）→ §8.3 浏览器实测 → 版本三处同步 2.2.0 + `CHANGELOG`（依 D5 放最后）→ 完整评审 + 只 stage 自己的文件。
