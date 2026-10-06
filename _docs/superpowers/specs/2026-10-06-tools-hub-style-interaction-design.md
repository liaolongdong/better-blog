# 工具箱页样式与交互优化 · 簇 1 设计（合集页 + 顶栏下拉 + 浮层让位）

- 日期：2026-10-06
- 状态：**待用户复核**（未开工）
- 上游：`2026-09-25-blog-online-tools-design.md`（三页 → 四页的原始设计，§7 字节预算在那本）
- 本轮被测面：`tools.html`、`_includes/header.html` 的「工具箱」下拉、`dev/sass/cat.scss` 那只浮层猫的**显示策略**
- 本轮**不碰**：`dev/sass/toolkit.scss`、`dev/sass/toolJson.scss`、`dev/sass/toolDiff.scss`、四本 `tools-*.html`

---

## 0. 为什么本轮只做簇 1

用户选的是最宽的一档（合集页 + 下拉 + 4 张在线工具页，四个目标全要）。这 6 个界面不是一轮的事，
理由不是工作量而是**成本不对称**：

| | 簇 1：合集页 + 下拉 | 簇 2：4 张在线工具页 |
| --- | --- | --- |
| 样式住在 | `editorial.scss` → `index.min.css` | `toolkit.scss` → `toolkit.min.css` |
| §7 八格字节判据 | **一格都不管它** | 八格全管它 |
| 最薄余量 | 无 | 证件页首屏 余 **368B = 2.2%** |
| 改名代价 | 门禁⑤ 认 5 处字面（见 §2.1） | id 模板 + `.tk-index__link` + 断点 900/640 全被硬编码，改断点要同改 `verify-tools-browser.mjs:263-275` 的期望表 |
| 计划镜像 | 不涉及 | `tools-*.html`、`toolkit.scss`、`toolJson.scss` 是**整文件镜像**，动一行要重跑 `verify-plan-blocks --fix` |
| 现在能否动手 | 能 | **不能**（见 §0.1） |

分轮不等于砍目标：簇 2 的四项目标（扫读效率 / 两族分层 / 移动端手感 / 视觉质感）里有三项在簇 1
先做出可对照的形状，簇 2 是把它们推进工具页，而不是另起一套。

### 0.1 并发状态（本轮排查期间实测，开工前必须重看一遍）

- HEAD 在我这轮排查中从 `6f6a005` 变成 `2b9464c`，`origin/master..main` 从 6 条涨到 **17 条**。
- `dev/sass/toolkit.scss` 有一段**只活在索引里**的删除：M29 那组「状态变了」动效（`.tk-panel` 入场、
  `.tk-state` 药丸、`.tk-panel__error` 抖动 + 两个 `@keyframes`），`+4/−75` 行。**磁盘已经回到 HEAD**——
  `grep -c M29` 三处读数：`git show :dev/sass/toolkit.scss` = **0**（索引）、工作树 = **2**、`git show HEAD:` = **2**。
  也就是说 `git diff HEAD -- dev/sass/toolkit.scss` 现在是空的，只有 `git diff --cached` 看得到那一刀。
- `scripts/verify-motion-batch4.mjs` 同样是暂存删除（`--cached` 记 `0/1394`），但走的是 `git rm --cached` 那一形：
  索引里没了，**磁盘上那 1,394 行还在**（`git status` 因此同时打 `D ` 与 `??` 两行）。
- `_docs/superpowers/specs/2026-09-25-blog-online-tools-design.md` 也是同一种「索引改、工作树回」的形状
  （`--cached` 记 `+14/−351`，`git diff HEAD` 为空）。
- `dev/js/editorial.js` 有 +33 行未暂存改动，落点在 `:3073` 的 `initOffline()`——与本轮要动的
  `initReveal()`（`:1319`）相隔 1700 行，不同函数，可并存。

**处置**：本轮不改上面那三本。那两格删除属于动效批 IV 自己的回退决定，由那一轮收口，
簇 1 不替它确认也不替它撤销。
**这条索引/工作树分裂对本轮有一条直接约束**：对方的改动此刻就挂在索引里，所以我这边
只 `git add` 自己那一本文件、只用带 pathspec 的 `git commit -- <path>`（隐式 `--only`，绕开索引里那一段），
绝不裸 `git commit`——那会把 M29 那一刀当成我的提交内容带走。开工前重跑一次
`git status --short` 与 `git rev-list --count origin/master..HEAD`，若 `editorial.scss` / `header.html` / `cat.js`
中任一变为脏，改走隔离工作树出提交（见 `d717c17`）。

---

## 1. 实测缺陷（五条，全部给可复算口径）

| 编号 | 现象 | 读数 | 复算口径 |
| --- | --- | --- | --- |
| P1 | 7 张卡铺成一条 4903px 的长队，一屏只装得下 1 张，页内没有任何跳转 | 高 4,903px / `.tool-section` 7 个 @ clientWidth 1440 | `document.documentElement.scrollHeight` 与 `querySelectorAll('.tool-section').length` |
| P2 | 两族共用同一套 `.tool-*` 双栏版式，"要不要装东西"只写在 kicker 与徽章文字里 | 分组标签 0 个（`grep -c tools-band` 现产物 = 0） | 产物里搜分组元素 |
| P3 | 右列空档：`.tool-media` 是 `position: sticky; top: 88px`（`editorial.scss:2003`），图 302×128 而正文列 500–700px 高 | 免安装族更彻底：按设计无截图，收成单栏后右半壁全白（`:1874`） | 元素盒 + `getComputedStyle` |
| P4 | 浮层猫压住工具箱页的 CTA 并吃掉点击 | `.mao_box` 200×174 @ `left:30 bottom:30`（`cat.scss:20-22`）；版心 1140 居中 → 内容左边缘 = (vw−1140)/2；猫右沿 230 → **碰撞窗口 clientWidth ∈ [1240, 1599]**（下沿是 `cat.js:19` 的 `MIN_W = 1240`，再窄它自己不出来） | 1440 实测：猫 @30,450，`.tool-copy` 左沿 150 → 压进正文 80px，正好盖住「Chrome MV3」与那颗 muted CTA |
| P5 | muted CTA 是一截没有边框的文字（`.cta-muted`，`:1986-1999` 把 height/padding/box-shadow 全撤掉），排在两颗真按钮中间读起来像排版坏了 | 3 款插件里 1 款走这一支（`transfer-any-file` 的 `links.store: ''`） | 目视 + `getComputedStyle` |

顺带清出的两处死码（都属簇 1 落点，簇 2 那两处留给第二轮）：

- `.tool-media figcaption`（`:2014-2021`）：全站**无生产者**。判据是不带 `--include` 的全树扫描，
  命中只有 `demo/**/vue.min.js`、`ace/*`、`normalize.min.css`、`index.min.css` 这些厂商件，
  `_posts/`、`_includes/`、`_layouts/`、`tools.html` 里 0 处。
- `.tk-masthead` 与 `.tk-field--wide`：四页 HTML 里出现 5/5/1/1 次，`dev/sass/` 里**零定义**。
  属簇 2 的字节补给源（删它省的是 HTML 字节），本轮不动，记在这里给第二轮。

---

## 2. 硬约束（改 `tools.html` 必须绕开的字面契约）

### 2.1 门禁⑤ 对 `_site/tools.html` 的 5 处字面判据（`scripts/check-tools-surface.mjs`）

| 行 | 判据 | 对本轮的限制 |
| --- | --- | --- |
| `:241-242` | `toolsSectionOf()` 用字面量 `<section class="tool-section tool-section--online" id="online-${slug}"` 切小节 | 免安装族那 4 个 `<section>` 的开标签**一个字节都不能改**。新钩子只能挂在内层元素或外层包裹上 |
| `:297` | 该小节必须有指向本页路径的「打开{{h1}}」主按钮 | `.tool-cta` 里那颗 `<a>` 的文案与 href 形状保持 |
| `:315` | 面板清单里必须有指向 `#${prefix}-panel-${slug}` 的锚点链接 | 那一栏改的只是排布（D2 的两列清单），锚点一枚不能少 |
| `:336`、`:345` | workbench 支（`panels` 为空）必须有 `features` 那几行**纯文本**要点 | 那一条不许被改成链接支 |
| `:356-358` | 第三格徽章必须能按 `<li>${N} 块面板</li>` / `<li>${N} 个动作</li>` 正则命中 | 徽章那 `<ul>` 里保持裸 `<li>` 文本，不许给徽章套 `<span>`/`<a>` |

### 2.2 牙齿（`check-tools-surface-teeth.mjs`，台账 74 刀）点名 `tools.html` 的 8 处字面

`href="#online-idcard"`、`href="#online-codec"`、
`href="/better-blog/tools/idcard.html#tk-panel-uscc"`、
`…>统一社会信用代码</a>`（href + 锚文本**紧邻**那一形）、
`<li class="nav-item has-sub is-current"`（下拉的当前态）、`5 块面板`、`14 个动作`、
以及"整节连头带尾删掉"那一刀的 `id="online-${slug}"` 定位。

**这一族是本轮真正的风险面**，但它的失效方式是响亮的：那些 mutation 找不到锚点就 `throw`
（例：`tools.html 的纯文本要点少吐一条`、`落地页那一枚成对的 href+锚文本没命中，错位变异作废`），
不会静默变绿。设计侧因此立一条硬规矩：**面板清单的锚文本形状不动**——
`<a href>{{p.name}}</a> — {{p.tagline}}` 里 `</a>` 紧跟 `—` 的那一形原样保留，
排布只改 `<li>` 这一层（D2 的两列清单），不把 tagline 挪进 `<a>` 内。
（挪进去更"整块可点"，但那要同改牙齿字面，属另一笔账，本轮不做。）

### 2.3 揭示动效的祖先规矩（`dev/js/editorial.js:1292-1298`）

`REVEAL_SELECTOR`（`:1319-1327`）里有 `.tool-head` / `.tool-copy` / `.tool-posts` 三条，
而 `.tool-section` / `.tool-body` 被刻意排除，注释写的原因是"不能选到 sticky 元素的祖先"。
本轮 D3 撤掉 `.tool-media` 的 sticky，这条前提对工具页作废——**名单一行不改**（改它要过
`verify-motion-batch4.mjs`，而那本脚本正被另一会话暂存删除），只在那段注释里补一句
"工具页的 sticky 已于 2026-10-06 撤掉，这条规矩的原始案例改由 …… 承担"，把事实对齐。

### 2.4 字节账：本轮哪些格子会变

- **不进 §7 任何一格**。§7 八格覆盖的是 `toolkit.min.css` + `toolkitCore.min.js` + 各页专有件 +
  各页 `_site/tools/<slug>.html`；本轮产物是 `index.min.css`（现 138,179B / gzip 19,747B）、
  `cat.min.js`（1,555B）、`editorial.min.js`（42,845B）与 `_site/tools.html`（快照读数 50,590B /
  gzip 12,993B），四件全在 §7 之外。
- **进"全站每页"那本账**：`header.html` 的下拉在全站 135 页每页都渲染（`check-seo` 台账读数），D5 那枚属性按每页 +76B 计；
  `index.min.css` 涨落按 before/after 实测报数。这两笔写进 §8 的读数表，不藏。
- **证件页首屏那 368B 与本轮无关，但别拿它当"还有余量"**：`_site` 快照停在 10-01 21:01，
  之后的 WebApplication JSON-LD（`34ef81a` + `393ba83`）没量进去，`_site/tools/idcard.html` 里
  `grep -c WebApplication` = 0 就是证据。真实余量 ≤ 368B，簇 2 开工前必须重量。

---

## 3. 设计（六项）

前五节（D1–D5）就是你在 AskUserQuestion 那一轮点头的那五项；D6 是写这份 spec 时才补的第六项，
单独标了出处，不要可以整节删掉。

### D1 页内索引条 `.tools-jump`

**现状**：P1。
**改成**：`<main>` 顶部（`tools.html:41` 之后）插一条 sticky 索引：

```
<nav class="tools-jump" aria-label="工具箱索引">
  <span class="tools-jump__group">浏览器插件</span>  <a class="tools-jump__chip" href="#account-password-helper">…</a> ×3
  <span class="tools-jump__group">免安装工具</span>  <a class="tools-jump__chip" href="#online-idcard">…</a> ×4
</nav>
```

- **不新增任何 id**：7 枚 chip 指向的是既有锚点——插件族 `#{{tool.slug}}`（`:49`）、
  免安装族 `#online-{{slug}}`（`:127`）。`#online-idcard` 那两枚正是牙齿点名的字面。
- 落点选在 `<main>` 内而不是 masthead 内：`.tool-section` 已有 `scroll-margin-top: 88px`（`:1790`），
  跳转落点不用重算；索引条自己 sticky 在 `top: 72px`，与固定顶栏错开一档。
- 当前项点亮：`editorial.js` 新增 `initToolJump()`，`IntersectionObserver` 观察 7 个 `.tool-section`，
  给命中的那枚 chip 加 `.is-on` 与 `aria-current="true"`。函数第一行按
  `document.querySelector('.tools-jump')` 短路——其余 134 页零成本、零 DOM 触碰。
  复用 `initReveal()` 已有的那套 rAF/IO 口径（`:1451` 的 `rootMargin` 形状），不另立时钟。
- 禁 JS：不点亮，7 枚链接照常可点。降级保险不撤。
- 触屏档（≤695）：索引条退成横向可滚的一行（`overflow-x: auto` + `scrollbar-width: none`），
  不 sticky（顶栏抽屉已经吃掉太多高度）。

**为什么不做成"卡片收密"就够了**：收密只解决一屏装几张，不解决"我知道第 6 张在讲什么但要在哪儿"。
索引条与收密是两个正交的收益，本轮都做（收密在 D2）。

### D2 两族真分层

**现状**：P2。
**改成**：两处。

1. **分组带** `.tools-band`：在 03 与 04 之间插一条，插件族前面也插一条对称的（只有一族有带子
   会被读成"下面那批是附录"）。带内是 `<h2 class="tools-band__title">` + 一句分界说明 + 计数。
   分界那句话沿用 `header.html:107-115` 已锁定的口径：**要不要往浏览器里装东西**，不是"要不要联网"。
   - 连带：卡片标题从 `<h2 class="tool-name">` 降为 `<h3>`，一页的标题层级变成 h1 → h2（分组）→ h3（条目）。
     门禁零风险：`grep -rn "tool-name\|tool-posts\|tool-media\|tool-body\|tool-copy" scripts/*.mjs` **0 命中**，
     没有任何脚本认这两个标签。
2. **免安装族退成双栏**：`{% for tool in ready_online %}` 那一段（`:116-206`）外面包一层
   `<div class="tools-online-grid">`，≥900 两列、列间一条竖分隔线（`border-left`，沿用编辑部的
   分隔线语言，**不加盒子、不加圆角卡**——全站是分隔线体系，套卡片会自成一派）。
   - `.tool-section` 的开标签在 `<div>` 里面，`:242` 那条字面判据读的是 `<section …` 本身，包裹层不碰它。
   - 网格上下文里关掉 `.tool-section` 的底边框与 `.tool-features li:before` 那枚圆点（`:1914-1923`），
     两列各自成段，圆点是噪声。
   - 面板清单 `.tool-features` 在这个上下文里改**两列清单**（`columns: 2` + `column-gap`），
     每条仍是「名称 — 说明」原样，锚文本形状按 §2.2 一字不改。
     **不 chip 化**：chip 要么丢掉 tagline（信息不丢这条就破了），要么把 tagline 挪进 `<a>`
     （正好撞 §2.2 那条 `…>统一社会信用代码</a>` 的邻接规矩）。两列清单既省高度又零契约风险。
     ≤900 退单列。
   - 判据边界：分组带与网格只对 `ready_online` 那一族生效，插件族三张卡的双栏一行不动。
     ≤900 网格退单列，与既有 `:3958-3967`（≤1023 撤双栏）同向，不新增换挡点。
   - 连带要改的一处注释：`tools.html:18-19` 论证过"编号连续而不是各起一轮"（两族各自 01 会被读成
     同一份列表的两个副本）。分组带落地后那段理由的语境变了（有了真分界，各起一轮不再被误读），
     但**结论不变**（连续编号 + 分组带仍然成立），所以是补一句"分组带已于 2026-10-06 落地，
     这条口径继续取连续"，不是重写那段。

### D3 右列填实

**现状**：P3。
**改成**：插件族那三张卡，`.tool-body` 的右列从"一张图"变成一栏：

```
<div class="tool-aside">
  <figure class="tool-media">…</figure>
  <footer class="tool-posts">相关记录 …</footer>
</div>
```

- `.tool-posts` 从 `.tool-section` 的直接子元素移进 `.tool-aside`（`:98-112` → 挪到 `:95` 那一栏里），
  右列于是被"截图 + 相关记录"填满，左列同时缩短。
- `.tool-media` 撤 `position: sticky; top: 88px`（`:2003-2004`）：空档就是它造的，
  图只有 302×128，正文列 500–700px 高，sticky 让图悬在半空、下面拖一条白。
- 连带删死规则 `.tool-media figcaption`（`:2014-2021`，§1 已给全站无生产者的证据）。
- `.tool-posts` 仍在 `REVEAL_SELECTOR` 里，移动位置不影响类名匹配；§2.3 那条注释按约定补一句。
- 免安装族按设计既无 `.tool-media` 也无 `.tool-posts`，不受影响。

### D4 浮层猫在 `/tools*` 默认收起

**现状**：P4，碰撞窗口 clientWidth ∈ [1240, 1599]。
**改成**：`dev/js/cat.js` 一处，**零 CSS、零 HTML**：

```js
var TUCK_BY_DEFAULT = pageRelPath.indexOf('/tools') === 0;   // /tools.html 与 /tools/*.html
var tucked = readTucked() || TUCK_BY_DEFAULT;
```

- 语义：这一页每次进来默认收起（只露 22px 耳尖，且 `.is-tucked` 自带 `pointer-events: none`，
  `cat.scss:52-60` 那一段——**避让与让点击一并解决**）。用户点扣子当场放出，本页照常可用；
  下次进来仍收起。
- 覆盖 `/tools/*` 四页而不是只 `/tools.html`：同一处缺陷没有只修一半的理由，那四页的
  `.tk-index` 左栏正落在同一片。这一条是本轮**唯一**触到簇 2 页面的改动，且只改猫的显示策略，
  不碰它们的样式与字节。
- 与用户偏好的关系：`writeTucked()` 的"放出"是**删键**（`cat.js:53`），存储里表达不出"用户主动要开"，
  所以本页无法区分"没表过态"与"表过态要开"。取"这一页恒定默认收起"而不是"猜用户意图"，
  并把这条限制写进注释——不新增第三个存储键。
- 产物 `cat.min.js` 涨约 40B（gzip 后更少），站级件、不在 §7。

### D5 下拉两族的形状差

**现状**：下拉里 7 条目分两组，但"点了会不会离开当前页"只有分组标题在说；两族条目形状全同。
**改成**：只给**免安装族那 4 条**的 `<li>` 加一枚 `data-kind="online"`，CSS 用
`.nav-sub-link` 的 `::after` 给它画一枚外链箭头；插件族保持无标记。

- 为什么只标一族：需要被提前告知的是"这会离开当前页"，只有那 4 条会离开；
  插件族那 3 条指向本页 `#锚点`，不离开。
- 为什么用属性而不是把 slug 写进 CSS 选择器：`a[data-tool="account-password-helper"]::after` 零 HTML
  增量，但等于把 7 枚 slug 抄成第二处口径——与 `_data/onlineTools.yml` 文件头那条
  "同一份事实写第二遍，迟早只改一处"直接冲突。取每页 +76B 的属性。
- 为什么用 `::after` 而不是内联 SVG：下拉在 135 页每页渲染 7 份，SVG 是每页 +数百字节的账。
- 不做：↑↓ 键盘导航、Esc 新交互。前者要给 `verify-nav-touch.mjs`（77 判据 + 10 牙）补新形状，
  后者撞段 2 Task 11 交回的口径"不给工具层新造 Esc 交互"（`editorial.js:389/757/1549/1726/2040`
  那五处是公共层回归的落点）。留簇 2。

### D6 muted CTA 那一截文字（P5）

> **这一项是写 spec 时新加的，不在你已点头的那五项里**，所以单独标出来。不要就删掉这一节，
> 其余五项不受影响。

**改成**：`.cta-muted` 不再伪装成按钮行的成员——从 `.tool-cta` 里移出，排到该卡 `.tool-badges`
上方，做成一句带图标的状态说明（"商店上架中 · 可先从仓库 Releases 下载"）。
按钮行于是只剩两颗真按钮 + 「开源仓库」，读起来不再像坏了。
零门禁风险（`links.store == ''` 那一支没有任何脚本认）。

---

## 4. 降级、可达性与动效边界

- **禁 JS**：索引条退成 7 个普通锚点；chip 高亮不存在但不影响跳转；猫不收起（`cat.js` 不跑）——
  这是 P4 的一条残余：禁 JS 且窗口在 1240–1599 时猫仍压 CTA。
  兜底交给 CSS：`.mao_box { pointer-events: none }` 只在 `.is-tucked` 下成立，
  本轮**不加**第二条无 JS 兜底，因为那会让放出态的猫收不到 `pointerenter`（视线跟随失效）。
  这一条如实记为已知残余，不掩盖。
- **`prefers-reduced-motion: reduce`**：索引条 sticky 与 chip 变色只走 `color`/`background` 过渡，
  不新增位移；`initToolJump()` 不读动画时钟，reduce 档照常点亮。
- **夜间与三档纸色**：新规则一律吃 `--surface` / `--rule` / `--ink-*` 令牌，不许写死色值；
  `--tool-accent` 那套"内联声明压过换算法"的既有结论（`editorial.scss:1889-1895`）继续成立——
  本轮新元素不使用产品色做文字色，只用于 chip 的描边与当前态下划线，且夜间退 `--signal`。
- **对比度**：chip 文字取 `--ink-2`（≥4.5 于三档亮色纸面与夜间），分组标签取 `--ink-3` 且字号
  ≥13px；落地前按 `墨阶 --ink-4 达 AA 只能迁消费者` 那条既有结论核一遍，不靠 `--ink-4` 做文字。
- **触屏**：chip 与索引条命中的是站级 `(hover:none) and (pointer:coarse)` 那一档（`editorial.scss:3742/5555`
  已有先例），点击目标 ≥34px 高（与 `toolkit.scss` 的 `.tk-btn` 38px 同一档口径）。
- **键盘**：`.tools-jump` 的 7 枚 chip 是文档流里的普通 `<a>`，Tab 序列自然；
  当前态用 `aria-current="true"`（location 语义），与下拉那侧的 `aria-current="page"` 分工不同，不冲突。

---

## 5. 验证计划

跑的是 `2026-10-02-seo-aeo-structure-design.md` §8.2 那张 14 道台账里**本轮影响得到的**那几道，
一律在**隔离快照**里跑（`git archive` 导出树 + 软链工作树的 `node_modules` 与 `vendor`），
理由与那一遍相同：`nav-touch` 一类脚本自带"服务的字节 == 磁盘"的同源自证，指工作树会被并发会话打假红。

| 道 | 命令 | 本轮为什么必须跑 |
| --- | --- | --- |
| 工具收录面 | `node scripts/check-tools-surface.mjs --site=$S/_site` | §2.1 那 5 处字面判据全在 `tools.html` 上 |
| 工具收录面牙 | `node scripts/check-tools-surface-teeth.mjs` | 74 刀里 8 刀点名 `tools.html` 的字面邻接，改动后必须自证牙还在 |
| 触屏下拉 | `node $S/scripts/verify-nav-touch.mjs` | D5 动了 `.nav-sub` 的条目形状，77 判据 + 10 牙 |
| seo | `node scripts/check-seo.mjs --root=$S --site=$S/_site` | h2 → h3 的层级改动、下拉新增属性都可能碰到结构判据 |
| 计划镜像 | `node scripts/verify-plan-blocks.mjs` | 本轮不碰那四本镜像文件，跑它是为了**证明**没碰 |
| toolkit | `node scripts/toolkit-tests.mjs` | 基线回归（H16 那族直接读 SCSS 文本，本轮不改 `toolkit.scss` 故应原样绿） |

**不跑**：`verify-motion-batch4.mjs`（那本脚本正被另一会话暂存删除，且本轮不改任何 `@keyframes`）、
`verify-tools-browser.mjs` 与 `verify-idcard/codec-browser.mjs`（被测的是簇 2 那四页，本轮一行样式不改）。
不跑的理由写进收口记录，不静默跳过。

**浏览器核验**：十档视口沿用段 2 Task 11 交回的 `360/640/641/880/900/901/920/940/1280/1920`，
**本轮另加三档**：`1240`、`1599`、`1600`——P4 那个碰撞窗口的两个内沿与一个外沿。
测量用 `--baseurl ""` 的快照（否则样式全 404），并 `setCacheDisabled`。

**before/after 读数**（写进 §8 的收口表，缺一格不算收口）：

1. `_site/tools.html` 字节（disk + gzip）
2. `index.min.css` 字节（disk + gzip）——本轮唯一会涨的站级样式件
3. `cat.min.js` 字节
4. 页面总高 @ clientWidth 1440（现值 4,903px）
5. 首屏（900 高）内可见条目数（现值 1）
6. 1440 下 `.mao_box` 与 `.tool-copy` 的交叠像素（现值 80px）

---

## 6. 明确不做

- 不改四张工具页的任何样式、结构、断点与 id（簇 2）。
- 不改 `toolkit.scss` / `toolJson.scss` / `toolDiff.scss`，不替另一会话那两格暂存删除表态。
- 不给下拉加 ↑↓ 键盘导航与新的 Esc 交互。
- 不引入卡片容器（圆角 + 阴影 + 内边距那一套）来"现代化"工具箱页——全站是分隔线体系。
- 不动 §7 任何一格的数字，不重开"30KB 那格两种读法"那笔待判账。
- 不 push。推送单独取授权（`origin/master..main` 现为 17 条，且推 `master` 等于上线）。

## 7. 簇 2 预告（另开一份 spec）

按本轮实测排出的先后：

1. **先量再改**：重建 `_site`，重量证件页首屏那一格（台账 368B 是旧读数，WebApplication 之后只会更小）。
2. **抽公共外壳** `_includes/toolShell.html`：四页各手写一份近重复外壳（只有 header/footer 共用），
   连 `{%- else -%}` 的空正文兜底分支都是四份逐字相同。抽出来是"改一次四页同得"的前提。
3. **删死钩子补字节**：`.tk-masthead`、`.tk-field--wide` 零定义却在 HTML 里占位。
4. **移动端手感**：`toolkit.scss:698-701` 自陈 901–959 中段"本格没实测"。
5. **猫**：D4 已把 `/tools/*` 的默认收起一并覆盖，簇 2 不再碰。

---

## 8. 收口记录（实施完成的那一轮填这一节，此刻留空是刻意的）

这一节不是没写完的占位，是实施后必须回填的表位。留空的这一刻，spec 里其它节的每一个数字都已经能复算；
填完之后，这一节承担的是"设计说的和量到的一致"这一层证据。要填的六项，每项连口径一起写：

1. **六道门禁的退出码**（§5.1 命名的那六道）：在隔离快照里跑，写 `exit=` 与日志路径，不写"通过"。
2. **before/after 六个数**（§1 的 P1–P5 各自那个读数）：页高、节数、CTA 命中区、面板清单行数、
   猫与正文的重叠宽度、索引条可见时的首屏节数。after 必须来自与 before 同一棵树的同一份量具。
3. **牙齿组数**：`check-tools-surface-teeth.mjs` 那 74 条变异在本轮改动后的红/绿分布，
   以及新增那几条（索引条锚点、`data-kind="online"`、bands 的 h3 层级）各自注入的坏形状。
4. **已知残余清单**：至少把 §4 那条"禁 JS 时猫仍压住 CTA"抄进来，加上实施中新发现的任何一条。
5. **未测断点**：本轮没量的宽度要显式列出，不写"其余断点正常"。
6. **提交集**：本轮落在哪几个 commit、`origin/master..main` 从几条变成几条，以及"没有 push"这一句。
