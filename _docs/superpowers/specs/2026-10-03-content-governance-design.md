# 内容治理设计（子项目 4）

日期：2026-10-03
范围：四子项目分解中的最后一个 —— A4 `seo_description` 回填、A9 词表归一、刀3 正文手工工具内链、A8 构建期目录
状态：已获批（沿用四子项目立项时那条授权——「按你推荐的最优方案执行，完成后自测与代码评审，无问题即提交，无需再确认」），执行中
工作树：`.worktrees/sp4-content-governance`，分支 `sp4-content-governance`，基线 `2b9464c`（= 当时的 `main`）

## 0. 这份文档在哪个位置，以及它纠正了上游两处口径

`2026-10-02-seo-aeo-structure-design.md` 把「内容治理」分给本子项目时留了两句话，
本档按实测把它们改掉：

1. **§0:15 写「A9 categories 归一化」，§8.8:899 写「A9 合集近义项归并（约 43 组）」——两句不是一回事，
   而且都不准确。** 实测（词表一律以 **Jekyll 自己的读数**为准，见 §1 事实 12–13 那两只探针）：
   - `site.categories.size = **17**`（**键数**），近义簇只有 **1 个**（`开源` 挂 1 篇 / `开源工具` 挂 3 篇 /
     目标那枚 `开源实测` 已挂 **17 篇**——这个 17 是**桶大小**，与上面那个 17 的**键数**恰好同数，两回事，
     探针字段 `guanchan_cat`），
     外加一枚只出现一次、且不成主题的 `编程语言`；
   - 「43」这个数在仓库里唯一的出处是 `categories.html:14` 的一句**过期注释**
     （「43 个分类会乱成一团」——今天 17 个）；
   - `_data/series.yml` 是 **10 条合集**，slug 全部唯一，没有近义项（`grep -n 'slug:' _data/series.yml`）；
   - 真正到了 43 这个量级的碎片化在 **tags**：`site.tags.size = **155**`，其中 **122 枚只挂在 1 篇上**
     （同一把尺在 81 个文件上量到 157 枚 / 124 枚，差的那 2 枚正是那篇不产出的未来帖——见 §1 事实 13）。
   所以 A9 的对象改成 **tags 词表（主）+ categories 那一簇（次）**，量级与判据按实测重写（§4.2）。
2. **§0:18 说这一批「会撞上 `article-check.mjs` 的 60 条断言」——那条脚本此刻不在 `main` 里。**
   它在并发会话的**已暂存未提交**集中（主工作树 `git status --porcelain` 的
   `A  scripts/article-check.mjs`）。本子项目**不依赖它**：判据一律落在本分支已有的
   `scripts/check-seo.mjs`（SP1 那一届已有 10 组）+ 它的牙齿脚本上。等 `article-check.mjs` 进了
   `main`，A4 的「数字不许凭空」那条判据（§5.1）应该迁过去，这件事记在 §7 的移交里。
3. **本档自己先纠一处：起草时我用 shell 数出来的「158 枚标签 / 16 个分类 / 1 枚 `黑科技\r` 幽灵标签」
   有三个数都是量具造的假信号。** `grep -h '^tags:' | tr ' ' '\n'` 会把行尾的 `\r` 粘进最后一枚标签，
   于是凭空多出一枚键；而 Jekyll 走 YAML，`\r\n` 是行终止符，那一篇读出来是干净的
   （探针：`site.tags.select { |t| t =~ /[\r\n\t]/ }` → `[]`，「黑科技 family」只有一枚 `"黑科技"`）。
   分类那一格 shell 还把 CRLF 文件里的 `JavaScript]` 数成了一个词。**下面凡涉词表的数以
   `site.tags.size` / `site.categories.size` 为准**，`\r` 那条改成「只对正则读取器有害」的卫生项（§4.2 动作 1）。
   这一条不是修辞：`check-seo.mjs` 与门禁里所有 front matter 读取都是正则式的（`asList(fm.categories)`），
   所以**门禁视角与 Jekyll 视角的分歧本身就是缺陷源**，判据必须钉在「两侧读数相等」上。

四个子项目共用的两条硬口径在这一档同样有效：**目标流量是 Google 与 AI 答案引擎优先**（所以
「原始 HTML 里读不到的东西等于没有」这条线在 A8 里是主线），**验收 = 门禁化 + A/B 实测**
（§5 每组判据都配牙齿，§6 每个数都现场量）。

## 1. 起点事实（这一节全部现场复核，命令逐条附在下面）

| # | 事实 | 怎么量的 |
| --- | --- | --- |
| 1 | `_posts` 磁盘上 **81** 个文件，但 **站上只有 80 篇**：`_posts/2100-10-25-practice-demo.md`（`date: 2100-10-25`）不进 `site.posts`，`_site` 里没有 `2100/` 目录、`sitemap.xml` 对它 **0 命中**——它不产出任何页面。带 `seo_description` 的 **41** 篇、缺 **40** 篇，其中**真正需要回填的是 39 篇**（40 减去那篇不产出的教学样本） | `ls _posts/*.md \| wc -l` = 81；探针 `site.posts.size` = 80；机制可引：`_config.yml` 未设 `future`，而 Jekyll 4.3.4 的默认就是排除未来帖（`vendor/bundle/…/jekyll-4.3.4/lib/jekyll/configuration.rb:31` `"future" => false`）；产物侧同证：`_site` 无 `2100/` 目录、`_site/sitemap.xml` 对 `practice-demo` 0 命中。`grep -l/-L '^seo_description:'` = 41 / 40 |
| 2 | 摘要取值链：`page.seo_description` → `page.description` → `page.subtitle` → `site.description`，**再加一道地板：`.size < 25` 一律退回 `site.description`** | `_includes/seoMeta.html:55-76`（`{%- capture page_desc -%}` 那一段） |
| 3 | 已有 41 条摘要的**字符**长度：min 70 / max 124 / median 85 | Python `len()` 取 `seo_description: ` 之后的整行.strip()（字节数是 175 / 230 / 200，两者都记，因为门禁按字符判） |
| 4 | 写法约定：**36 篇**紧跟在 `subtitle` 之后（第 5 行）、**4 篇**在 `seo_short_title` 之后（第 6 行）、**1 篇**（`2016-06-18-hello-jekyll.md:4`）在 `title` 之后无 `subtitle`；值一律是**不带引号的 plain YAML**。另一件事别混淆：`seo_short_title` 全站也是 **41 篇**有，但与带摘要的那 41 篇**只重合 4 篇**（`seo_short_title` 独有 37 篇、`seo_description` 独有 37 篇）——两个 41 是巧合，不是同一批 | 逐文件 `sed -n '1,8p'` 对过 + node 读取器对两个键各取一次集合求交并 |
| 5 | JSON-LD 与卡片读的是同一个变量：`_includes/jsonLd.html:48,99` `"description": {{ page_desc \| jsonify }}`；工具页走 `_includes/jsonLdTool.html:70` 的 `page.seo_description \| default: page.description \| default: _tk.desc` | grep |
| 6 | 文章目录**只有客户端一份**：`dev/js/editorial.js` §1 `initToc()`（:245-358）用 `list.appendChild(li)` 追加、`headings.length < 2` 直接 return、构成才给 `document.body` 加 ` has-toc`；CSS 里 `.post-rail` / `.toc-list` / `.toc-link` 那一大族**全部挂在 `body.has-toc` 下**（`editorial.scss:1446` 起） | 读源码 + `grep -n has-toc dev/sass/common/editorial.scss` |
| 7 | 构建产物里那颗 `<ol class="toc-list" id="toc-list"></ol>` 是**空的**，`grep -c toc-link` = 0；`_layouts/post.html:276-281` 的注释把这件事写成**刻意决定**（「无 JS 环境也拿不到半截列表」） | 读产物 + 读版式注释 |
| 8 | 线上构建是 `bundle exec jekyll build --baseurl <base_path>`（`.github/workflows/jekyll.yml:65`），**不是** github-pages 白名单构建 → `_plugins/*.rb` 在生产里真的跑（SP1 的 B2 就靠 `_plugins/image_dims.rb`） | 读 workflow |
| 9 | 正文里的站内链接**没有任何 baseurl 机器**：`_plugins/add_baseurl_filter.rb` 只重写图片（`![..](..)` 与 `<img src>`），挂点是 `_layouts/post.html:225` 的 `add_baseurl_to_images`；`_posts/*.md` 里 `prepend: site.baseurl` 命中 **0** 次 | 读插件 + `grep -rn "prepend: site.baseurl" _posts/*.md` |
| 10 | 文章正文里**一条指向工具页的链接都没有**：`grep -rln "tools/json\|tools/diff\|tools/idcard\|tools/codec\|/tools\.html" _posts/*.md` → No matches；文末工具卡是 tag 自动匹配的（`_includes/relatedTools.html:36`） | 现量 |
| 11 | tags 的**写法全站一致**：81 篇全部是 `tags: A B C` 空格分隔标量，**0 篇用方括号**。空格分隔标量之所以能变成多枚标签，是 Jekyll 自己拆的：`Utils.pluralized_array_from_hash` 走到 `value_from_plural_key`，对 `String` 值执行 `val.split`（`vendor/bundle/ruby/2.6.0/gems/jekyll-4.3.4/lib/jekyll/utils.rb:85-93`，`split` 在 `:90`）。**推论：这一站的「一枚标签里含空格」是写不出也读不到的**，所以门禁的正则读取器只要按 `/\s+/` 拆，就和 Jekyll 同规则 | `grep -h '^tags:' _posts/*.md` 逐行看首字符（`[` 命中 0）+ 读上述源码 |
| 12 | tags 词表（**Jekyll 视角，唯一权威**）：`site.tags.size = **155**`，其中 **122 枚只挂 1 篇**（`site.tags.count { |_, v| v.size == 1 }`）；折大小写之后的**大小写撞键正好 5 组**，且每组都点得出持有文件（见 §4.2 动作 2 的表）：`Chrome`(1) / `chrome`(2)、`Coding`(1) / `coding`(1)、`React`(1) / `react`(1)、`Vite`(1) / `vite`(1)、`WebMCP`(1) / `webmcp`(3)；`黑科技` 是一枚**正常标签**（挂 3 篇），`_posts/2019-02-25-you-dont-kown-js-tips.md` 整文件虽是 CRLF，Jekyll 读它的 tags 仍是 `["JavaScript","前端小技巧","黑科技"]`，全站控制字符命中 `[]` | 探针（`Jekyll::Site#read` 后打印，落 `/tmp/sp4-probe2.json`）：`{posts:80, tags:155, categories:17, singleton_tags:122, ctrl_tags:[], 黑科技:3}`；CRLF 认文件用 `grep -lU $'\r' _posts/*.md`（只命中那 1 篇），行尾字节用 `od -c` |
| 13 | **正则读数与 Jekyll 读数今天就已经分叉**：同一把按空白拆分的尺，扫 **81 个文件**得 `157` 枚 / `124` 枚只挂 1 篇；扫**产出页面的 80 篇**得 `155` / `122`。差的两枚是 `前端面试` 与 `手写题`——它们**只存在于那篇不产出的未来帖**里（`2100-10-25-practice-demo.md:12` `tags: JavaScript 前端面试 手写题`）。这正是 §0 第 3 条说的缺陷源：**「文件集」与「语料集」不是同一个集合**，白名单与所有计数必须钉在语料集上 | node 读取器 `list = v.startsWith("[") ? v.slice(1,-1).split(",") : v.split(/\s+/)`，分别对 81 与 80 个文件去重计数并打印差集 → `["前端面试","手写题"]` |
| 14 | categories 形状混用：**19 篇 `[A, B]` + 54 篇 `[A]` + 4 篇空格分隔标量 + 4 篇裸标量**（合计 81）；空格分隔的 `开源 编程语言` / `开源工具 TypeScript` 会被拆成多枚（`document.rb:459-461` `merge_categories!` 里 `other["categories"].split`），于是 `site.categories`（**17 枚**）里同时有 `开源`、`编程语言`、`TypeScript`、`React`、`CSS`、`Vue` 这些由空格标量得到的键；`_posts/2100-10-25-practice-demo.md:6` 的注释自己写明「空格分隔会被拆成多个分类」，同一行还写了另一半——「tags 相反，要空格分隔」 | `grep -h '^categories:' _posts/*.md` 按四种形状分桶 + 探针读 `site.categories.keys` |
| 15 | 改标签有**第二个消费者，而且它会改交互**：`_data/onlineTools.yml` 的 `match_tags` 钉死了 9 条逐字标签串（`前端小技巧` / `JavaScript公用方法` / `JavaScript语言精粹` / `npm` / `pnpm` / `yarn` / `git` / `git常用命令` / `reset`），文末「相关工具」卡拿 `page.tags` 与它求交集（`_includes/relatedTools.html:36` `rtool.match_tags contains tag`，**大小写敏感的逐字比较**）——也就是说**改一枚标签名有可能让某篇文章的工具卡出现或消失**。这份 yml 还被 `scripts/verify-plan-blocks.mjs` 按**整文件字节镜像**看着。实测：A9 要动的 **6 枚标签 token**（`Chrome`、`React`、`Vite`、`WebMCP` 四枚大写侧 + `coding` 改名 +
`Agent` 那枚重复）**一枚都不在 9 条里**，所以命中集应当不变——但「应当」要有判据（§5.1 组 `词表` 第 ⑧ 条） | `grep -n 'match_tags' -A3 _data/onlineTools.yml` + 读 `relatedTools.html:34-40` + SP1 那届的镜像事实 |
| 16 | 改分类有**第三处后果**：`scripts/og-images.mjs:92` 取 `categories` 的**首个**进 OG 卡面文字，产物 `_data/og_images.yml` 是提交进仓库的 | 读脚本 |
| 17 | tags 里**重复的那一枚会被计入归档页读数**：`2026-07-12-alibaba-page-agent.md:11` 的 `tags` 里 `Agent` 出现两次（`AI Agent 前端 开源 阿里巴巴 page-agent GUI Agent`），而 `populate_tags`（`document.rb:449-453`）只有 `flatten!`、**没有 `uniq!`**（对比 `populate_categories` `document.rb:441-444` 有 `categories.uniq!`）；`Site#post_attr_hash`（`site.rb:255-264`）是 `p.data[post_attr]&.each { |t| hash[t] << p }`，**没有「同一篇不重复入桶」的护栏**。实测 `site.tags["Agent"].size` = **13**，去重后是 **12**——`tags.html:42` 与 `:50` 打的就是这个 13。同一串重复还会原样进 `<meta name="keywords">`（`seoMeta.html:89` `page.tags \| join: ','`，无 `uniq`） | 探针 `{agent_total:13, agent_uniq_docs:12}` + 读上述源码 |
| 18 | 摘要类判据今天只存在于工具页那一侧：`scripts/check-tools-surface.mjs:192-201`（`DESC_MIN_COLS = 50` / `DESC_MAX_COLS = 158`，`:71-72`）判的是 `_data/onlineTools.yml` 的条目，`_posts` 一条都不判 | 读脚本 |
| 19 | 标题分布决定 A8 的覆盖面：**81 个文件里 80 个 `h2`+`h3` ≥ 2**，唯一例外是 `_posts/2018-12-25-qqweiboshare.md`（0 个）；剔除不产出的教学样本后，静态目录应当出现在 **79** 篇产物上 | node 读取器：剥掉 front matter 后数 `/^##\s+\S/gm` 与 `/^###\s+\S/gm`，直方图落 `/tmp/sp4-headings.txt` |
| 20 | **主工作树里的 `_site` 是过期产物，不能当读数来源**：`_site/2026/07/12/alibaba-page-agent.html` 的 `<meta name="keywords">` 仍是 SP1 A5 之前的全站串（`廖小新,Better,…,前端开源项目实测`），而该篇 front matter 里早就有逐页 tags——那份 HTML 早于 A5 的提交。所以本档**所有产物侧的数（含 §6 的三个数）必须来自本分支现场跑的 `bundle exec jekyll build`**，取任何 `_site` 读数前先 `ls -l _site/index.html` 与 `git log -1 --format=%h -- _includes/seoMeta.html` 对时间 | `grep -o '<meta name="keywords"' _site/2026/07/12/alibaba-page-agent.html` 与 `sed -n '11p' _posts/2026-07-12-alibaba-page-agent.md` 对照 |

`_posts/2100-10-25-practice-demo.md` 与那两篇 2026-05-30 / 05-31 同 slug 的 `AI-model-rating`
都在「缺 `seo_description`」的 40 个文件里。前者不产出页面（事实 1），所以它**不在回填清单内**，
理由与门禁怎么绕开它写在 §4.1 第 4 条与 §5.1 组 `描述` 第 ① 条。

## 2. 目标 / 非目标

**目标**

- G1 每一篇**产出的**文章页的 `<meta name="description">` 都是这一篇自己的，不再是 `subtitle` 兜底。
  今天 80 篇里 **41 篇是手写的、39 篇是副标题原文**（那 39 篇的 `subtitle` 全部 ≥25 字符，
  所以一道都没落到 `site.description` 上）。验收数：**手写摘要 41 → 80**。
- G2 tags / categories 的**大小写撞键归零**（今天 5 组：4 组合并、1 组经查不是同一件事、改用分拆）、
  **同帖重复归零**（今天 1 处：`Agent` 把 `tags.html` 的那一格撑成 13，真实 12），词表钉成一份
  可枚举的白名单，且白名单建在**「产出页面的语料」而不是「磁盘文件集」** 上；并且
  **门禁的 front matter 读数必须与 Jekyll 的读数相等**——这条是 §0 第 3 条那个假信号的反向用途：
  两侧读数今天就已经分叉 2 枚（事实 13），一旦再分叉（`\r`、逗号形状、空格标量、文件集 vs 语料集），
  先红的是门禁而不是线上。
- G3 文章正文里出现**指向站内工具页的手工链接**（今天 0 条），且这些链接在 `/better-blog` 下真的 200。
- G4 目录在**不开脚本的 HTML 里也存在**（爬虫与无 JS 访客读得到那几节的标题与锚点），
  而今天开着的每一位访客的观感与动效**一个字节都不许变**。

**非目标**（每一格都写为什么不做）

- 不做「把 155 枚标签压到 N 枚」的语义大合并：`微信JSAPI支付` / `微信H5支付` / `微信公众号支付`
  是三个不同的坑，`Vue2` / `Vue3`、`代码回退` / `revert` / `reset` 是三种不同的东西，合并会**丢信息**，
  而这三族恰好都落在 `match_tags`（§1 事实 15）能看到的地方。只合「同一件事的两种写法」，见 §4.2。
- 不把 tags 里那枚 `开源`（挂 **18 篇**）跟着 categories 一起改成 `开源实测`：`开源实测` **根本不在 tags 词表里**
  （探针：`site.tags.keys` 无此键），它是分类名。tags 与 categories 是两个各判各的词表空间，
  动作 3 只动 categories 那一簇；顺手改 tags 会白移动 18 个锚点（tag `开源` 挂 18 篇，category `开源` 只挂 1 篇，
  同名但不同空间——探针 `{开源(tag):18}` 与 §4.2 动作 3 的持有表）。
- 不动 `_data/series.yml`（10 条合集、slug 唯一，没有可归并的对象）。
- 不改 `dev/js/editorial.js`。这一条是**协调约束**，不是技术判断：主工作树里那个文件此刻是
  ` M dev/js/editorial.js`（并发会话未提交），而 SP3 分支的合并已经堵在同一处。A8 的落地形状
  （§4.4）就是为了绕开它选的。
- 不改 `scripts/verify-motion-batch4.mjs`：它对目录的 6 组断言（`.toc-list` / `.toc-progress` /
  `is-live` / `--toc-p` / `--toc-h` / `--toc-y`）判的是 JS 那一套，A8 不动 JS，所以它必须原样绿。
- 不动 `_config.yml`、`package.json`、`dev/sass/toolkit.scss`、`sw.js` 那一批（并发会话在改）。
- 不新建每分类/每标签一页的归档（今天 `/categories.html` 与 `/tags.html` 是**锚点式单页**，
  改归档形状不属于内容治理）。

## 3. 方案与取舍

| 刀 | 备选 | 选定与理由 |
| --- | --- | --- |
| A4 | (a) 写进 front matter；(b) 加插件从正文首段自动摘；(c) 把 `subtitle` 拉长 | **(a)**。(b) 摘首段得到的句子在 39 篇里有相当比例是「本文介绍…」的废话，而自动摘出来的东西没人审；(c) 动的是列表卡片也在读的 `subtitle`（80 篇有），一处改两处受影响，且 `seoMeta.html:73` 那道 `.size < 25` 地板本来就会被 `subtitle` 满足——今天这 39 篇**并不是没有描述**，而是描述等于副标题，这正是 G1 要消掉的「卡片摘要与正文各说一句话」的前一半 |
| A9 | (a) 155 → 全量语义合并；(b) 归**大小写撞键 5 组** + 去**同帖重复** + 钉白名单；(c) 只做 CRLF 行尾 | **(b)**（含 (c) 作为卫生项）。(a) 见非目标；(c) 单独做的话，`Chrome\|chrome` 这 5 组仍然分裂——而且 Jekyll 本来就读得出干净的 `黑科技`，行尾本身**不改变任何计数**，把它当缺陷修是虚报（§0 第 3 条）。(b) 里有一组必须先停下来：`Coding` 与 `coding` 看着是同词双键，实际一枚指 Vibe 编码方式、一枚指 coding.net 平台，合并会丢信息，所以那一组的做法是**分拆改名**（`coding` → `coding.net`）而不是并（§4.2 动作 2 组 5）——这也是判据 ① 能保持**无条件**（不需要豁免名单）的代价与收益 |
| 刀3 | (a) 正文裸路径 `/tools/json.html`；(b) 整站绝对 URL；(c) Liquid `prepend: site.baseurl` | **(c)**。(a) 在 project site 下必然 404（§1 事实 9：插件只管图片）；(b) 把域名钉进 80 篇正文里最不耐改的一段 |
| A8 | (a) 服务端把条目填进现存的 `#toc-list`，JS 改为「有子节点就只挂行为」；(b) 服务端另出一份静态目录，JS 一上线就用 CSS 收起它；(c) 80 篇正文各插一行 kramdown `{:toc}` | **(b)**。(a) 最省字节，但要改 `dev/js/editorial.js`（禁改清单）且 `initToc()` 的错峰动效依赖它自己 `appendChild` 的那一批 `--i`；(c) 是内容改动 ×80，还要每篇接受「目录出现在正文流里而不是右栏」的形状变化。(b) 的代价是 JS 开着时同一页有两份条目 DOM（由 CSS 保证只显示一份），量化在 §6.3 |

## 4. 设计

### 4.1 A4：39 篇 `seo_description`

**位置与形状**：39 篇里有 **37 篇已经带 `seo_short_title`**（在 `subtitle` 之后一行），
摘要就跟着写在它后面一行；剩下 2 篇（`2022-08-08-webpack-move-vite.md`、
`2023-05-08-vue3-vite-study.md`）只有 `subtitle`，写在它之后。值一律是**不带引号的 plain YAML**
（与 §1 事实 4 那 41 篇同形）。写错位置不会构建失败，只会让「卡片摘要」那一格读空，
所以位置**不作为判据**，只作约定（判据只认键存在与值合规）。

**取值规则（每条摘要自己可审）**

1. 说清「这篇讲什么 + 读完能拿到什么」，一句完整话，不用「本文介绍 / 浅谈」开头。
2. 长度落在 **60–140 字符**（含两端）。地板取 `seoMeta.html:73` 那道 `.size < 25` 的 2.4 倍，
   天花板比现有 41 条的最大值（124）留 16 字符余量，给「补一句结论」留出空间。
3. **数字不许凭空**：摘要里出现的每一段阿拉伯数字（连续 digit 串），必须在**同一篇正文**里
   逐字出现；不能出现正文里没有的数字。这是本档唯一一条能自动审的事实性判据（§5.1 组 `描述` 第 4 条），
   它挡的正是 SP1 §7 那格修的同类缺陷——卡片摘要与 meta 摘要各说一句话。
4. `2100-10-25-practice-demo.md` **不写**。它不进 `site.posts`（§1 事实 1），因此没有产物页、
   没有 meta、没有 JSON-LD，写进去的唯一效果是让一条判据必须为它开后门。这一篇的 front matter
   本来就是一段带三条注释的教学样本，读者从注释里学形状，不从摘要行学。
   取而代之的是 §5.1 组 `描述` 第 ① 条把「文件数 = 页面数 + 这一篇有名有姓的豁免」钉成等式，
   将来谁再加一篇未来日期的帖子来绕门禁，红的是那一条。
5. 两篇同 slug 的 `AI-model-rating`（05-30 / 05-31）摘要必须**互相不同**（全局唯一判据自动管），
   且各自点出自己那一篇的时间口径。

**不做**：不给 `seo_short_title` 补齐（今天 81 个文件里 41 篇有，它只在标题过长时才需要，不是缺件）。

### 4.2 A9：词表归一

按四个动作走，每个动作单独可回退、单独有判据。**规模先说清**（下列每个数都是把四个动作打在
Jekyll 读出的 tags 上、重新分桶数一遍得到的（复算方式：对 `site.posts` 每篇的 `data["tags"]`
施加动作 2 那五条 `from → to`、再对动作 4 那一篇 `uniq`，然后重数键数 / 单篇数 / 撞键组数；
我这一版跑在 `/tmp/sp4-probe4.rb`，输出 `/tmp/sp4-probe4.json`），不是估的）：
改完之后 `site.tags.size` **155 → 151**（4 组合并各掉 1 枚，第 5 组分拆不增减）、
只挂 1 篇的标签 **122 → 116**（净掉 6 枚：`lost_singletons` 实际是 7 枚
（`Chrome`、`React`、`react`、`Vite`、`vite`、`WebMCP`、`coding`），`gained_singletons` 是 1 枚
（组 5 改名得到的 `coding.net`）——所以组 5 对这一格是**改名前后都单篇、净零**，
116 = 122 − 7 + 1）、**大小写撞键 5 组 → 0 组**；
`site.categories.size` **17 → 14**（消失的三枚键逐一点名：`开源`、`开源工具`、`编程语言`；
并入的目标那枚 `开源实测` 的桶 **17 → 21**，正是这四篇并进去的增量）、
只挂 1 篇的分类 **4 → 2**（改前那 4 枚逐字是 `React`、`开源`、`编程语言`、`CSS`，消失的是 `开源` 与
`编程语言` 两枚，`React` 与 `CSS` 留下；`开源工具` 本来就挂 3 篇，不是单篇。
探针 `/tmp/sp4-probe3.json` 打了 17 枚键的完整直方图：`AI 23 / 开源实测 17 / 前端工程化 15 /
JavaScript 10 / H5与微信 6 / 算法与面试 5 / 服务器与部署 4 / 工具与效率 4 / Chrome插件 4 /
TypeScript 3 / Vue 3 / 开源工具 3 / 随笔 2 / React 1 / 开源 1 / 编程语言 1 / CSS 1`——
白名单那一格（§5.1 组 `词表` 第 ② 条）的 categories 侧就照这份生成后的 14 枚钉）；
`site.tags["Agent"]` 的桶 **13 → 12**。
`tags.html:24,32` 与 `categories.html:32,41` 打的那几个数是唯一面向读者的读数，台账以它们为准。

**动作 1 · 行尾卫生（1 篇，不改任何读数）**：`_posts/2019-02-25-you-dont-kown-js-tips.md`
整文件 CRLF → LF。**这一条不是产品缺陷**：Jekyll 走 YAML，`\r\n` 是行终止符，那一篇的
`tags` 读出来是 `["JavaScript","前端小技巧","黑科技"]`（探针：全站 tags 里控制字符命中 `[]`；
`黑科技` 本身是一枚正常标签，挂 3 篇）。
它修的是**读取器**——本仓库的门禁一律用正则读 front matter（`check-seo.mjs` 的
`asList(fm.categories)` 一族），而正则读法会把 `\r` 粘进最后一枚值：我自己的 shell 管道就先中招过
（§0 第 3 条）。留着一个会让判据说谎的文件，比留着它本身贵。正文一字不动，
`git diff --ignore-all-space` 为空、`od -c` 自证行尾。

**动作 2 · 大小写撞键清零（4 组合并 + 1 组分拆，实改 4 篇）**

| 组 | 现有写法（Jekyll 篇数） | 处置 | 持有文件（→ 需要改的那一篇加粗） |
| --- | --- | --- | --- |
| 1 | `Chrome` (1) / `chrome` (2) | 合并保留 `chrome` | **`2026-09-29-webmcp-modelcontext-mount.md`**、`2024-01-05-chrome-plugin-recommend.md`、`2026-09-23-browser-skill-context-bytes.md` |
| 2 | `React` (1) / `react` (1) | 合并保留 `react` | **`2026-07-12-facebook-astryx.md`**、`2018-11-25-react-next-ssr.md` |
| 3 | `Vite` (1) / `vite` (1) | 合并保留 `vite` | **`2023-05-08-vue3-vite-study.md`**、`2022-08-08-webpack-move-vite.md` |
| 4 | `WebMCP` (1) / `webmcp` (3) | 合并保留 `webmcp` | **`2026-09-29-webmcp-modelcontext-mount.md`**、`2026-06-15-webmcp-vs-puppeteer.md`、`2026-09-10-agent-visual-toolchain.md`、`2026-09-17-gods-eye-view-keyless.md` |
| 5 | `Coding` (1) / `coding` (1) | **不分合并改名** `coding` → `coding.net` | `2026-07-12-impeccable-ai-design.md`（持 `Coding`，**不动**）、**`2018-12-05-move-githubblog-to-coding.md`**（`coding` → `coding.net`） |

保留形一律取**出现次数多的那一个**；并列时取小写（组 2、组 3 并列，按此规则落小写）。
这一条规则写在门禁里，不靠人记。
归一后各保留形的桶大小（同一只探针 `keys_after` 那次分桶）：`chrome` 2 → **3**、`react` 1 → **2**、
`vite` 1 → **2**、`webmcp` 3 → **4**、`Coding` 与 `coding.net` 各 **1**；撞键组数 5 → **0**，
且改前那 5 组逐字是 `react/React`、`coding/Coding`、`vite/Vite`、`chrome/Chrome`、`webmcp/WebMCP`。

**组 5 为什么必须停下来**：这两枚键**指的不是一件事**。`2018-12-05` 那一篇的
`tags: git github coding blog 博客` 里的 `coding` 指**托管平台**（标题与副标题写的是
「git 管理项目关联多个远程仓库（github、coding）」「把 github pages 博客迁移到 coding pages」）；
`2026-07-12-impeccable` 那一篇的 `Vibe Coding` 是**写法**——而且因为 tags 是空格分隔标量，
Jekyll 早就把它拆成 `Vibe` 与 `Coding` 两枚了（§1 事实 11），它从来不是一枚短语标签。
把它们合成一枚 `coding`，等于让「平台」与「Vibe 编码方式」共用一个归档页，
正是 §2 非目标第 1 条禁止的那种丢信息合并。所以这一组的做法是**把平台那枚改准**（`coding.net`，
与那一页正文用词一致），`Coding` 原样留着——两枚键各挂 1 篇，语义不再混。
`coding.net` 不在 `match_tags` 钉的 9 条里（§1 事实 15），也不与任何现有键撞小写。

**爆炸半径**：合并侧的组 1 与组 4 的「大写那一侧」是同一篇
（`2026-09-29-webmcp-modelcontext-mount.md` 的 tags 行是 `WebMCP Chrome Agent`），一刀同时改掉两枚，
改完是 `webmcp chrome Agent`；组 5 改的是另一篇的 `coding`。合计 **涉及 12 篇 / 实改 4 篇 /
其余 8 篇一字不动**（它们只是持有保留形，或持有组 5 那枚不改的 `Coding`）。

**动作 3 · categories 那一簇（4 篇）+ 形状归一**

- `开源工具` (3) 与 `开源` (1) → `开源实测`，逐篇：
  `2026-09-29-scriptc-native-x64-gap.md`、`2026-09-30-univer-node-two-gaps.md`、
  `2026-10-01-gitdiagram-keyless-mcp-4-bad-edges.md` 的 `开源工具 TypeScript` → `[开源实测, TypeScript]`；
  `2026-09-27-bend-laws-proof-gaps.md` 的 `开源 编程语言` → `[开源实测]`（`编程语言` 全站只出现这一次，
  且它不是一个主题而是一个词，不留）。
- **只动 categories，不动同名的那枚 tag**：`开源` 作为标签挂 **18 篇**，而 `开源实测` 根本不在 tags 词表里
  （§2 非目标第 2 条）——跟着改会白移动 18 个锚点。
- 形状：多分类一律 `[A, B]`。**裸标量 4 篇**（`categories: AI`）**不动**——单分类写 `[A]` 与写 `A`
  在 Jekyll 里等价，把它钉成判据属于制造 diff 噪声；判据钉的是**多分类不许用空格分隔**
  （那是 §1 事实 14 里那篇教学样本自己警告过的坑）。
- 连带后果（必须同一刀内处理，不许留下「图与 front matter 不一致」）：
  - `_data/og_images.yml` 里这 4 篇的 `category` 进卡面文字 → 重跑 `node scripts/og-images.mjs`，
    然后 `node scripts/og-images.mjs --check` 自证。
  - `categories.html` 的锚点少 **3 枚**（`#开源`、`#开源工具`、`#编程语言`）。分类的消费面实测是
    **6 个文件**：`_layouts/post.html:49-56`（面包屑）、`_includes/jsonLd.html:83,86-87`（第 2 条面包屑，
    带 `#分类` 的 `item` URL）、`_includes/seoMeta.html:165`（`article:section`）、
    `tags.html:58-63`（标签归档里每篇挂的分类 chip，`:61` 直接链 `categories.html#X`）、
    `index.html:132`（卡片 kicker 文字）与 `index.html:168`（`data-cat` 属性，筛选逻辑读它）、
    `404.html:65-70`（热门标签兜底链）。**全部是构建期从 front matter 现取**，不需要人跟着改，
    但正因为消费面广，门禁必须能证明它们跟着变了（§5.1 组 `词表` 第 ⑦ 条 + §6.4 台账里逐处点名）。

**动作 4 · 同帖重复标签去重（1 篇）**：`2026-07-12-alibaba-page-agent.md:11` 的
`tags: AI Agent 前端 开源 阿里巴巴 page-agent GUI Agent` 里 `Agent` 写了两次，删掉后一枚，
改成 `tags: AI Agent 前端 开源 阿里巴巴 page-agent GUI`。
**为什么这是产品缺陷而不是格式问题**（§1 事实 17 那条链）：`populate_tags` 不 `uniq!`、
`post_attr_hash` 也不去重，所以同一篇文档在 `site.tags["Agent"]` 的桶里占两格——
`tags.html:42` 的 `<em>` 与 `:50` 的「N 篇」对 `Agent` 那一格读成 **13**，真实 **12**；
同一串重复还会原样落进这一篇的 `<meta name="keywords">`（`seoMeta.html:89`，无 `uniq`）。
效果：**这一刀不增不减键数**（并掉的是 `Agent` 桶里多出来的那一格）、`Agent` 桶 13 → 12、
keywords meta 少一次重复。
对照实验也顺手做完：改完后 `Agent` 的 Jekyll 读数 == 持有 `Agent` 的文件数（12），
这一条就是 §5.1 组 `词表` 第 ⑥ 条的判据形状。

### 4.3 刀3：正文手工工具内链（5–8 条）

**形状**（唯一的落地写法，§3 表里 (c)）：

```markdown
[JSON 在线格式化]({{ '/tools/json.html' | prepend: site.baseurl }})
```

- 链接文字必须说清「点开能做什么」，不许写「点这里 / 工具」。
- 每篇最多 2 枚，且**必须落在那段真正提到对应动作的正文之后**（例如讲 YAML/JSON 互转的段落），
  不许为放而放；文末自动卡（`relatedTools.html`）照旧存在，手工链不替代它。
- 候选主题按 §1 事实 10 的空缺面选：JSON/文本对比相关的帖子（如 `2023-05-08-vue3-vite-study.md`
  那类带配置对比的、`2026-09-26-json-render-silent-strip.md`、`2022-08-08-webpack-move-vite.md`
  的两份配置对照段）、编码/序列化相关的（`2026-09-30-univer-node-two-gaps.md` 那族里读表的一段、
  `2026-09-10-nextjs-avif-trap.md` 的格式对照段）、以及那篇「Chrome 插件推荐」
  （`2024-01-05-chrome-plugin-recommend.md`，指向 `/tools/idcard.html` 的脱敏演示）。
  **具体 5–8 条由计划里那一刀逐篇列出「篇 / 锚点段落 / 工具 / 链接文字」四元组**，
  每条都要在正文里能指出它接的是哪一句话；写不出接点的就不配放。

### 4.4 A8：构建期目录

**产出**：`_plugins/toc.rb` 在渲染后的正文上取 `h2` / `h3`，把条目交给版式；`_layouts/post.html`
在正文之前多一份**静态目录**，JS 一上线就被 CSS 收起。

```
静态块（始终在 HTML 里）        JS 块（今天那一套，一字不改）
<nav class="toc-static" aria-label="文章目录（静态）">
  <p class="toc-static-title">本文目录</p>
  <ol> <li class="toc-h2"><a href="#id">文本</a></li> … </ol>
</nav>                                 ←→    <aside class="post-rail"> … #toc-list … </aside>
CSS：body.has-toc .toc-static { display: none; }
```

- **条目阈值与 JS 一致**：`h2`+`h3` 少于 2 个不出静态块（`editorial.js:250-251` 同一口径）。
  按 markdown 侧数的分布是：**81 个文件里 80 个 `h2`+`h3` ≥ 2，只有 `_posts/2018-12-25-qqweiboshare.md`
  是 0 个**（去掉不产出的教学样本后，静态块应当出现在 **79** 篇产物上、在 `qqweiboshare` 那一篇
  必须完全不出现）。没有这条阈值，那 1 篇会拿到一个空框。计数口径逐字写明：
  `body.match(/^##\s+\S/gm)` 与 `/^###\s+\S/gm` 的命中数之和，`body` = 剥掉 front matter 的部分；
  产物侧的条数必须由新鲜构建再数一次，两者不等就是 §5.1 组 `目录` 第 ②③ 条的红。
- **锚点必须逐字等于产物里 heading 的 `id`**（kramdown `auto_ids` 对中文标题不做转写，实测
  `_site/2023-06-07/common-search-algorithm.html` 是 `<h2 id="线性查找">`）。取 id 的唯一可靠方式
  是**从渲染后的 HTML 里读**，不是从 markdown 猜——这一条决定了插件必须挂在渲染之后。
  挂点二选一，由计划第一步的探针实测决定哪种可见：
  `Jekyll::Hooks.register :documents, :post_render`（写 `doc.data['toc']`，版式读 `page.toc`）
  或 `:SITE, :post_render`（直接 `doc.output = doc.output.sub(占位, 列表)`）。
  两者的判据是同一句话：**产物里有静态块，且 href 串与同页 heading 的 id 串逐个相等**。
- **不改 `dev/js/editorial.js`**（§2 非目标），JS 继续 `appendChild` 自己那一份；两份 DOM 的存在
  就是这一刀的价格，量在 §6.3。
- **减弱动效与无障碍**：静态块是无条件可见的普通 `<nav>`，无动画、无 `aria-expanded`，
  今天那三条约定（`skip-link` / `nav aria-label` / `prefers-reduced-motion` 分档）都不需要新分支。
- **`_layouts/post.html:276-281` 那段注释必须改写**：它现在承诺「无 JS 环境也拿不到半截列表」，
  A8 之后这句话不再成立；留着是缺陷（下一届会照着它做出相反判断）。

## 5. 判据与牙齿

### 5.1 新组一律落进 `scripts/check-seo.mjs`（它已有 10 组、且已被 `check-seo-teeth.mjs` 逐组配牙）

| 组 | 判据（每一条都是可执行的、非「应当」） | 红了意味着 |
| --- | --- | --- |
| `描述` | ① **产出语料的 80 篇**逐篇都有 `seo_description`，且等式钉死：`_posts/*.md` 文件数 == `site.posts.size` + 1，那 1 篇**逐字写成 `2100-10-25-practice-demo.md`**（谁再藏一篇未来帖进来，红的是这一条而不是被绕开）；② 长度 ∈ [60,140] 字符（按 code point 数，不是字节）；③ 值 ≠ 本篇 `subtitle`、≠ `site.description`；④ 摘要里每段连续数字都在本篇正文逐字出现；⑤ 全站取值互不相同（80 条去重后仍 80） | 卡片摘要退回副标题 / 凭空数字 / 两篇共用一句话 / 用未来日期绕门禁 |
| `词表` | ① **大小写撞键为零**：对产出语料的 tags 并集，任何两枚在「trim + 小写」后不得相等——**无条件判据，不设豁免名单**（组 5 那对靠改名解决，不靠豁免，见 §4.2 动作 2）；② tags ⊆ 白名单、categories ⊆ 白名单（两份常量表逐条钉进脚本，归一后规模 **151 / 14**）；③ 多分类必须写 `[A, B]`（`categories:` 里出现空格分隔的多词 = 红）；④ 行尾干净：`grep -lU $'\r' _posts/*.md` 必须为空；⑤ **两侧读数相等**：门禁正则（按 `/\s+/` 拆，与 Jekyll 同规则）在**语料集**上的 tags / categories 去重数 == 白名单长度 == 产物里 `tags.html:24` / `categories.html:32` 打的那两个数，另加一条独立等式「文件集读数 == 语料集读数 + 那 2 枚（`前端面试`、`手写题`）」；⑥ **同帖重复为零**：每篇 tags 去重后长度 == 原长度，且每枚 tag 的 `site.tags[t].size` == 持有它的文件数（现状唯一红点是 `Agent`：13 vs 12）；⑦ 归档页不悬空：`_site/tags.html` 与 `categories.html` 里每一枚 `href="#X"` 在同页都有对应落点；⑧ **命中集不变**：A9 动过的每一篇，按 `relatedTools.html:36` 那个逐字 `contains` 口径算出的 `page.tags ∩ match_tags` 集合，**改前与改后逐篇相等**（实现时用 `git show HEAD:<篇>` 的 tags 与工作树各算一次并打印对照表） | 又长出大小写双键 / 词表漂移 / 幽灵标签 / 正则与 Jekyll 分叉 / 归档页锚点跳空 / 文末工具卡被改名带跑 |
| `内链` | ① 正文里指向 `/tools/*.html` 的手工链接条数 ≥ 5；② 每条的 href 在 `_site` 里有对应文件（带 baseurl 时拼出来的那一条 200）；③ 每篇最多 2 枚；④ 链接文字不等于「点这里/工具/详情」这类空词 | 404 的正文内链 / 把自动卡当手工链交差 |
| `目录` | ① 每一篇产物：静态条目的 `href` 去掉 `#` 后与本页 `<h2 id>`/`<h3 id>` 序列**逐个相等**（顺序也相等）；② `h2+h3 < 2` 的产物里必须**没有** `.toc-static`（按 §1 事实 19，这一格只有 `2018-12-25-qqweiboshare.html` 一篇）；③ `h2+h3 ≥ 2` 的产物里条目数 == heading 数 ≥ 2，且这样的产物**恰好 79 篇**；④ JS 那一族的三个 id/class（`#toc-list` / `.toc-link` / `.toc-fab`）仍在（防 A8 把旧路径删掉）；⑤ `body.has-toc .toc-static` 那条隐藏规则在产物 CSS 里逐字可见（防「两份列表同时显示」） | 目录与正文脱节（点了跳错节）/ 双份列表其中一份坏了 / 双份同时可见 |

白名单（组 `词表` 第 ② 条）不是另起一份数据，而是**从归一后的现状生成、逐条钉进脚本**的一份常量表，
新增/改名必须显式改脚本——这是这一格的意义（词表漂移是这次要治的病，不该由「自动跟随」放过）。

### 5.2 牙齿（每组都要能红，红在登记的那一格）

沿用 SP1 那一届的形状：变异只打在 `/tmp` 的**产物或源码副本**上，工作树一字不动。
**本仓的牙齿台账有两副形状，别记错**（读脚本现证：`grep -n "name: '" scripts/check-seo-teeth.mjs`
与 `sed -n '106,110p' scripts/verify-tools-browser-teeth.mjs`）：

- `check-seo-teeth.mjs`（本批 M1–M14 落的地方）的一条是 `{name, group, expect, mut}`，**没有**
  `id / from / to / cascade` 这些字段；落点唯一性由 `mut` 里的 `subOnce` / `patchFirst` / `cutLine`
  **抛异常**保证（找不到或不止一处都抛），主循环把抛异常记成「变异脚本自己崩了」并整族退 1；
  `expect` 是门禁那行判定的**逐字片段**，且必须红在 `[group]` 这一组里，红在别组也算假牙。
  退出码在这本里各有所指：**1 = 有红（含变异没落地），2 = 门禁自己崩了**（`check-seo.mjs:66-70` 的
  `uncaughtException` 兜底），所以「锚点漂了」不会伪装成「判定红在指定组」。
- `verify-tools-browser-teeth.mjs`（浏览器那一族，本批只有 A8 的动效回归会间接碰到）的一条才是
  `{id, kind, name, expect, pages, targets, from, to, why}`，`apply` 在目标串找不到时**退 2**。

本批 M1–M14 全部进第一本（`check-seo-teeth.mjs`），M15 也是——它打的是源侧 tags 行，判据在 `词表` 组。
为了让台账可按 M 号 grep，**案例的 `name` 一律以 `M<number> ` 开头**。

| 刀 | 打在哪 | 该红的判据 |
| --- | --- | --- |
| M1 | 摘掉某篇的 `seo_description` 行 | `描述` ① |
| M2 | 把某篇摘要长度改成 45 字符 | `描述` ② |
| M3 | 把某篇摘要写成它的 `subtitle` | `描述` ③ |
| M4 | 在某篇摘要里塞一个正文没有的数字 `21` | `描述` ④ |
| M5 | 在某篇**已有 `chrome`** 的帖子 `tags:` 里再加一枚 `Chrome`（归一之后大写那侧已经不存在，变异必须造在保留形那一侧） | `词表` ① |
| M6 | 在某篇 `categories:` 里加一个白名单外的词 | `词表` ② |
| M7 | 把某篇的 `categories: [A, B]` 改成空格分隔 | `词表` ③ |
| M8 | 给某篇副本的 `tags:` 行补一个 `\r`（CRLF 化） | `词表` ④ |
| M9 | 把某篇的 `date` 从 2026 改成 `2100-01-01`（把它推出语料） | `描述` ① + `词表` ⑤（`cascade`，这条等的就是「文件集 = 语料 + 豁免」那把尺） |
| M10 | 把某篇 `tags:` 里已有的一枚原样重写第二遍（造同帖重复） | `词表` ⑥ |
| M11 | 在 `_site` 某篇产物里删一条静态目录 `<li>` / 改一个 href | `目录` ① |
| M12 | 把一条正文工具内链的 href 改成 `/tools/nope.html` | `内链` ② |
| M13 | 摘掉整块 `.toc-static`（换成 `<div class="toc-static"></div>`） | `目录` ①③ |
| M14 | 删掉 CSS 里 `body.has-toc .toc-static { display: none }` 那一条规则 | `目录` ⑤ |
| M15 | 在某篇**持有 `git` 标签**的副本里把 `git` 改成 `Git`（不在 A9 的改动面上，纯造变异） | `词表` ⑧（`cascade` ①）——这一把量的是「改名会带跑文末工具卡」 |

`内链` ①（条数 ≥ 5）不设牙齿：它是**计数**判据，计数判据的牙齿等价于「删一条就少一条」，
被 `内链` ② 的牙齿覆盖；这一格口径照 §6.4 写进台账，不假装它有牙。

### 5.3 不新增门禁脚本，改动的文件逐一点名

**门禁侧**：`check-seo.mjs`（加 4 组）、`check-seo-teeth.mjs`（加 M1–M15）。
**产品侧**：`_plugins/toc.rb`（新）、`_layouts/post.html`（静态块 + 改写 :276-281 那段注释）、
`dev/sass/common/editorial.scss`（`.toc-static` 一族 + `body.has-toc` 那条隐藏）、
`categories.html`（过期注释改口）。
**内容侧 10 个文件**：A4 的 39 篇（只加一行）、A9 的 `2019-02-25-you-dont-kown-js-tips.md`（行尾）、
`2026-09-29-webmcp-modelcontext-mount.md`、`2026-07-12-facebook-astryx.md`、
`2023-05-08-vue3-vite-study.md`、`2018-12-05-move-githubblog-to-coding.md`（tags 改名与合并）、
`2026-07-12-alibaba-page-agent.md`（同帖重复）、
`2026-09-27-bend-laws-proof-gaps.md`、`2026-09-29-scriptc-native-x64-gap.md`、
`2026-09-30-univer-node-two-gaps.md`、`2026-10-01-gitdiagram-keyless-mcp-4-bad-edges.md`（categories），
外加刀3 的那 5–8 篇正文。**刀3 与 A9 有交集**（`2026-09-29-webmcp-modelcontext-mount.md` 一类），
同一篇的两处改动可以同刀提交，但**判据各自独立**，不能因为一红就顺手把另一条也关掉。
`_data/og_images.yml` 由 `node scripts/og-images.mjs` 重新生成（只该动那 4 篇的卡面分类）。
`_data/onlineTools.yml` **只有当某枚被 `match_tags` 钉住的标签要改名时**才动。
那 9 条钉死的串是 `前端小技巧 / JavaScript公用方法 / JavaScript语言精粹 / npm / pnpm / yarn /
git / git常用命令 / reset`；动作 2 要动的 5 枚（`Chrome` / `React` / `Vite` / `WebMCP` 四枚大写侧，
加 `coding` → `coding.net` 那一枚改名侧）一枚都不在里面，动作 3 改的是 categories、`match_tags` 读的是
tags，动作 4 删的是重复的 `Agent`——所以**预期不动这份 yml**。
一旦确实需要动，`scripts/verify-plan-blocks.mjs --fix` 必须在同一刀内跑，
并让 `verify-plan-blocks-teeth.mjs` 照旧全绿。

## 6. 验收与实测口径

三个数（决策 7 要求 A/B 实测），口径与 SP1/SP2 一致：节流 `Network.emulateNetworkConditions`
RTT 150 ms / 下 1.6 Mbps / 上 750 kbps + `Network.setCacheDisabled`，`--headless`
`--remote-debugging-port=0 --user-data-dir=<mkdtemp> --proxy-server=direct://`
`--host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"`，
视口 1280×900 且 `innerWidth` 自证，5 轮/侧取中位数，1 分钟负载 > 16 直接拒测（既不算绿也不算红）。

- **6.0 前置：先重建，再读任何产物数**（§1 事实 20）。本分支跑一次
  `bundle exec jekyll build`（不带 `--baseurl ""`，与线上一致用默认 `/better-blog`），
  然后**先自证产物是新的**：`_site/2026/07/12/alibaba-page-agent.html` 的 keywords 必须是该篇自己的
  tags 串而不是全站串。做不到这一步的读数一律作废。
- **6.1 摘要覆盖率**（不是 A/B，是「前后」，全部从 `_site` 产物读）：每篇文章页恒有 1 条
  `<meta name="description">`；**取值与本篇 `subtitle` 逐字相同的篇数 39 → 0**；
  **取值与 `site.description` 相同的篇数 0 → 0**（今天就已经是 0，那 39 篇的 `subtitle` 全部 ≥25 字符，
  唯一 <25 的是那篇不产出的教学样本，它 `subtitle` 24 字符——写进台账是为了防「地板论」被误当成现状）；
  **手写的篇数 41 → 80**；产物里 meta description 的**去重条数**从 N 升到 ≥ 80（N 现场量）。
- **6.2 词表规模**（`tags.html:24,32` 与 `categories.html:32,41` 打的数是面向读者的读数）：
  `site.tags.size` **155 → 151**、只挂 1 篇的标签 **122 → 116**、大小写撞键 **5 → 0**；
  `site.categories.size` **17 → 14**、只挂 1 篇的分类 **4 → 2**、`开源实测` 的桶 **17 → 21**；
  `site.tags["Agent"]` **13 → 12**（这一格是动作 4 的唯一读数变化）；
  正则**文件集**读数 **157 → 153**，且恒等于「语料 + `前端面试` + `手写题`」——
  等式两边都写进台账，不接受只报一个数。
  **控制字符那格是 `[]` → `[]`，不是 1 → 0**：`黑科技\r` 那枚幽灵标签是我自己的 shell 管道造出来的假信号
  （§0 第 3 条），Jekyll 从来没读到过它；动作 1 的自证是 `grep -lU $'\r' _posts/*.md` 从 1 个文件到 0 个，
  外加 `od -c` 那一行的行尾字节变化，**不改任何词表读数**。
- **6.3 A8 的价格**：`head`（基线 `2b9464c`）与 `new` 两棵交替 5 轮，取**最大的一篇**与**中位一篇**
  各量 HTML 原文字节、gzip 字节（`cat f | gzip -9 | wc -c`，不走 zlib API），以及 fast3g 下的
  load / DOMContentLoaded / 可交互 / 首次动作四个数。字节口径必须能对上：
  Δ HTML ≈ 静态条目数 × 每条约 `len('<li class="toc-h2"><a href="#…">…</a></li>')`。
  同时**自证禁 JS 那一侧真的读得到目录**：读产物副本摘掉 `<script>` 之后，
  `grep -c 'class="toc-static"' == 1` 且静态条目里每一枚 `href` 都能在**同一份 HTML**里找到同名 `id`
  （`grep -o 'id="…"'` 集合包含），这才是 G4 的本体，不是「有块」。
- **6.4 台账**：全集不数「道」这一说——**列出来才算数**。本分支 `git ls-files scripts` 现证可跑的
  判据脚本是这 14 本（`node scripts/X` / `ruby scripts/X`，逐条跑）：
  `check-seo.mjs`、`check-seo-teeth.mjs`、`check-tools-surface.mjs`、`check-tools-surface-teeth.mjs`、
  `check-image-dims.rb`、`check-image-dims-teeth.mjs`、`check-image-variants-teeth.mjs`、
  `verify-plan-blocks.mjs`、`verify-plan-blocks-teeth.mjs`、`verify-tools-browser.mjs`、
  `verify-tools-browser-teeth.mjs`、`verify-codec-browser.mjs`（+ 它的 teeth）、`verify-idcard-browser.mjs`、
  `toolkit-tests.mjs`，另加三道同样要跑、但形状不同的：`node scripts/og-images.mjs --check`（台账自证）、
  `verify-motion-batch4.mjs` 与 `verify-nav-touch.mjs`（这两本受负载门管辖，1 分钟负载 > 16 时按拒测记，
  既不算绿也不算红）。**`verify-tool-url.mjs` 不在本分支**（它随 SP2 的 `sp2-tool-url-state`，
  尖 `bab6051` 未合），所以本批台账里没有它；SP2 先合的话，合并后重跑时它自动进集。
  逐道记 `命令 / 退码 / 它自己打出来的那一句`，非绿的每一处都要有归因；
  跑门的那棵树 = 提交的那棵树，用三本产物的 md5 认树。

## 7. 风险与移交

1. **A9 一共让 8 枚锚点消失，另有 1 枚新锚点长出来**，而这些旧地址在站外可能被分享过
   （例如 `tags.html#Chrome`、`categories.html#开源工具`）。
   逐枚点名：tags 侧被并掉 4 枚（`Chrome`、`React`、`Vite`、`WebMCP`，各只挂 1 篇）、
   改名 1 枚（`#coding` 消失、新增 `#coding.net`，挂 1 篇）、categories 侧消失 3 枚（`开源`、`开源工具`、`编程语言`）；
   4 + 1 + 3 = 8，动作 4 一枚都不动。站内**没有**手写的旧锚点需要跟改——所有指向 `tags.html#X` / `categories.html#X`
   的链接都是**构建期从 front matter 现拼**的（`index.html:91,156,216`、`tags.html:61`），
   会自动跟着走；真正会断的是站外旧链接，而站内没有重定向机制
   （`jekyll-redirect-from` 不在 `_config.yml:277-280` 的插件里，全站 front matter 无 `redirect_from`）。
   这一条能被自动证明的部分是「跟着改了之后不悬空」，即 §5.1 组 `词表` 第 ⑦ 条；
   不能被证明的部分是「站外有没有人链过 `#Chrome`」，本批对此**只有接受**。若日后要更大范围合并，
   需要先给 `tags.html` 配 alias 锚点（`<a id="旧名" name="旧名">`），那是下一届的事。
2. **`article-check.mjs` 不在本分支**。它进了 `main` 之后，`描述` 组的第 ④ 条（凭空数字）
   与 `词表` 组的 ①③④⑥ 更适合待在那边（它管正文与 front matter 的一致性，`check-seo.mjs` 管产物），
   届时迁移而不是两处并存。同一批里还有一份**并发会话已暂存未提交**的
   `scripts/lib/post-meta.mjs`（`git status` 里的 `A scripts/lib/post-meta.mjs`）——那是第三把 front matter
   读取尺。本批**不依赖它**（§0 第 2 条同一个理由），但它一旦进 `main`，`check-seo.mjs` 新组的读取器
   应当换成它，而不是让仓库里同时存在三把会各自说谎的尺（§1 事实 13 就是三把尺读数的现场差异）。
3. **并发会话同时持有**：`dev/js/editorial.js`（未提交）、`dev/sass/toolkit.scss`（已暂存）、
   `_config.yml` / `package.json` / `_data/og_images.yml`（已暂存）。本批对 `og_images.yml` 的改动
   是从 `main` 提交态重新生成的（只碰那 4 行），若对方那 3 处暂存改动先进 `main`，
   合并时这个生成文件按「重跑 `--check` 的那棵树」为准。
4. **SP3 分支仍未合**（`sp3-motion-search`，尖 `8122f9c`），SP2 分支仍未合（`sp2-tool-url-state`，
   尖 `bab6051`），三条分支都碰过 `check-seo.mjs` 一族与 `_data`。**任何一条先合，另外两条都要
   重跑全量七道门禁**，且 `verify-plan-blocks.mjs` 的镜像集必须重导。
5. **不 push、不部署**。本批全部提交只落在 `sp4-content-governance` 分支。

## 8. 决策记录（本档内部拍过的点，含自我纠正）

- A4 用「写进 front matter」而不是「插件自动摘」；长度带 [60,140]（按 code point）；
  数字必须逐字来自正文；回填对象是**产出语料的 39 篇**，那篇不产出的教学样本有名有姓地豁免。
- A9 从上游那句「categories 归一化 / 合集 43 组」改成实测的形状：
  **tags 大小写撞键 4 合并 + 1 分拆、同帖重复 1 处、categories 一簇 4 篇、CRLF 卫生 1 篇**；
  全部数字按 Jekyll 读数写（`155 → 151`、`122 → 116`、`17 → 14`、`4 → 2`、`Agent 13 → 12`），
  过期注释（`categories.html:14` 的「43 个分类」）顺手改口。
- **纠自己三次**：① 起草时 shell 管道数出的「158 枚 / 124 枚单篇 / 1 枚 `黑科技\r` 幽灵标签」里，
  `\r` 那枚是行尾粘连造出来的假键（§0 第 3 条），158 是「文件集」读数、不是词表读数；
  ② 摘要兜底那格从「81 − 41 = 40 篇走 `site.description`」改成实测的
  「39 篇走 `subtitle`、0 篇走 `site.description`」；③ 回填数从 40 改成 39（教学样本不产出页面）。
- **`Coding` / `coding` 不合并**是本档唯一一次「看着像重复、实测不是同一件事」的掉头：
  合并会把「coding.net 平台」和「Vibe 编码方式」塞进同一枚标签，违反 §2 非目标第 1 条，
  所以取改名（`coding` → `coding.net`）而不是并——换来判据 ① 保持无条件、不需要豁免名单。
- tags 全站是空格分隔标量（0/81 用方括号），且 `Coding` 那枚本来就是 `Vibe Coding` 被拆后的右半。
  **不引入方括号形态**：那会造出全站第一枚含空格的标签，让 §5.1 组 `词表` 第 ⑤ 条
  「正则读数 == Jekyll 读数」那把尺多一条分支，收益不抵成本。
- 刀3 的链接写法取 Liquid `prepend: site.baseurl`，因为插件只管图片不管链接。
- A8 取「静态目录 + JS 起来就收起」而不是「服务端填 `#toc-list` + JS 复用」，理由是后者必须动
  并发会话正持有的 `dev/js/editorial.js`；覆盖面按实测是 **79 篇有、1 篇（`qqweiboshare`）必须没有**；
  两份 DOM 的字节价格进 §6.3 实测量化，不估算。
- 新判据全部落在 `check-seo.mjs` 的 4 个新组（`描述` / `词表` / `内链` / `目录`），牙齿进
  `check-seo-teeth.mjs`（M1–M15）；不新建门禁脚本。
- **产物读数的来源被钉死**：主工作树那份 `_site` 早于 SP1 的 A5（§1 事实 20 有实证），
  所以 §6 的每一个数都必须在 `.worktrees/sp4-content-governance` 里现场 `bundle exec jekyll build`
  之后取，并先做一次「keywords 是逐页串」的自证。
