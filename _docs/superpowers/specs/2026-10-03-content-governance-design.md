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
| 15 | 改标签有**第二个消费者，而且它会改交互**：`_data/onlineTools.yml` 的 `match_tags` 一共钉着 **33 枚**逐字标签串（四页 ready 各：`idcard` 0 / `codec` 11 / `json` 13 / `diff` 9——**起草时写的「9 条」只是 `diff` 那一页的块**），文末「相关工具」卡拿 `page.tags` 与它求交集（`_includes/relatedTools.html:36` `rtool.match_tags contains tag`，**大小写敏感的逐字比较**；外层遍历 ready 工具、内层遍历本篇 tags、第一个命中即 `break`，整段在 `:33-39`）——也就是说**改一枚标签名有可能让某篇文章的工具卡出现或消失**。这份 yml 还被 `scripts/verify-plan-blocks.mjs` 按**整文件字节镜像**看着。实测：A9 要动的 6 枚 token 里 **`Vite` 恰好在这 33 枚里**（`json` 那一串同时含 `vite` 与 `Vite` 两枚），而 `_posts/2023-05-08-vue3-vite-study.md` 今天命中的正是 `Vite` 那一枚；其余 5 枚（`Chrome`、`React`、`WebMCP`、`coding`、`Agent`）一枚都不在。所以「命中集必然不变」这句话不成立，准确的口径是：**命中哪一页不变（还是 `json` 那张卡），但该篇命中的逐字串从 `Vite` 变成 `vite`**——**28 篇有卡的文章里只有这一行**会变。这一条必须有判据：§5.1 组 `词表` 第 ⑧ 条钉一份「A9 落地后的 28 行 `rel <- 逐字命中串`」快照，快照本身就是「改名会不会带跑卡」的常设守卫 | 探针 `/tmp/sp4-match.cjs`（源码附在计划 Task 1 Step 8）：`unionTokens:33`、`readyTools` 逐页枚数、`postsWithHit:28`、`changedCount:1`，那唯一一行 `json:Vite` → `json:vite` |
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
  今天 80 篇里 **41 篇是手写的、39 篇不是**，而那 39 篇的分解是 **38 篇取本篇 `subtitle`（HTML 反解口径；
  只比原始字节是 35 篇）+ 1 篇取 `site.description`**（`2026-09-25-claude-agents-md-remote-gate.md`，
  `subtitle` 5 字符撞在 `.size < 25` 的地板上）。**起草时这里写的「那 39 篇全部 ≥25 字符、一道都没落到
  `site.description` 上」是错的**，§6.1 那格跟着从 `0 → 0` 改成 `1 → 0`。验收数不变：**手写摘要 41 → 80**。
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
  是三个不同的坑，`Vue2` / `Vue3`、`代码回退` / `revert` / `reset` 是三种不同的东西，合并会**丢信息**。
  **起草时接着写的「而这三族恰好都落在 `match_tags` 能看到的地方」只对了一族**（33 枚逐子摊开实测：
  `代码回退` / `revert` / `reset` 三枚都在 `diff` 那一串的 9 枚里；`Vue2`、`Vue3` 与三枚 `微信…支付`
  **一枚都不在**，`json` 那 13 枚里有 `vite` 与 `Vite` 两枚但没有 Vue 系）。
  所以「不许语义大合并」这条的理由是**信息**，不是「门禁看得见」——只合「同一件事的两种写法」，见 §4.2。
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
`coding.net` 不在 `match_tags` 钉的 **33 枚**里（§1 事实 15 全集逐枚可点），也不与任何现有键撞小写。

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
  - `_data/og_images.yml` 这一条**不触发**（起草时写着「重跑生成器」，实测不成立）：卡面文字只画在
    **没有 `cover`** 的文章上，而这 4 篇全部带 front matter `cover`（各 `grep -c '^cover:'` = 1），
    且它们一枚都不在这张表里（`grep -c 'bend\|scriptc\|univer\|gitdiagram' _data/og_images.yml` = 0；
    该表 68 条，YAML 读出的键数）。所以这一刀**不重跑生成器、不碰那份并发会话正持有的文件**；
    自证改成改前改后各跑一次只读的 `node scripts/og-images.mjs --check`，退码与摘要行必须一模一样。
    **生成模式（不带 `--check`）会重写这份产物**，一次都不许跑。
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
| `描述` | ① **产出语料的 80 篇**逐篇都有 `seo_description`，且等式钉死：`_posts/*.md` 文件数 == `site.posts.size` + 1，那 1 篇**逐字写成 `2100-10-25-practice-demo.md`**（谁再藏一篇未来帖进来，红的是这一条而不是被绕开）；② 长度 ∈ [60,140] 字符（按 code point 数，不是字节）；③ 值 ≠ 本篇 `subtitle`、≠ `site.description`；④ 摘要里每段连续数字都在本篇正文逐字出现；⑤ 全站取值互不相同（80 条去重后仍 80。这一格**今天就是绿的**，价值全在防未来，而且**它没有牙**，见 §5.2 表尾）；⑥ **产物侧接线**（本计划相对 spec 的净增项）：每一篇带 `seo_description` 的产出文章页，`_site` 里那条 `<meta name="description">` 的 `content` 经 HTML 实体反解之后必须**等于**源侧的值；⑦ **无静默截断**：五个字符串键（`title` / `subtitle` / `seo_description` / `seo_short_title` / `description`）在 front matter 里写下的值，与 Jekyll 解析后读到的值逐字相等——` #` 出现在不带引号的 plain scalar 里会被当行尾注释，写进去的半句话静默消失（牙 M18） | 卡片摘要退回副标题 / 凭空数字 / 两篇共用一句话 / 用未来日期绕门禁 / **源侧写了摘要而产物没接上（取值链断）** / 摘要与产物脱节（改了源、meta 不动）/ 标题里带「#」的篇被吃掉半句 |
| `词表` | ① **大小写撞键为零**：对产出语料的 tags 并集，任何两枚在「trim + 小写」后不得相等——**无条件判据，不设豁免名单**（组 5 那对靠改名解决，不靠豁免，见 §4.2 动作 2）；② tags ⊆ 白名单、categories ⊆ 白名单（两份常量表逐条钉进脚本，归一后规模 **151 / 14**）；③ 多分类必须写 `[A, B]`（`categories:` 里出现空格分隔的多词 = 红）；④ 行尾干净：`grep -lU $'\r' _posts/*.md` 必须为空；⑤ **两侧读数相等**：门禁正则（按 `/\s+/` 拆，与 Jekyll 同规则）在**语料集**上的 tags / categories 去重数 == 白名单长度 == 产物里 `tags.html:24` / `categories.html:32` 打的那两个数，另加一条独立等式「文件集读数 == 语料集读数 + 那 2 枚（`前端面试`、`手写题`）」；⑥ **同帖重复为零**：每篇 tags 去重后长度 == 原长度，且每枚 tag 的 `site.tags[t].size` == 持有它的文件数（现状唯一红点是 `Agent`：13 vs 12）；⑦ 归档页不悬空：`_site/tags.html` 与 `categories.html` 里每一枚 `href="#X"` 在同页都有对应落点；⑧ **命中集不变**：ready 四页的 `match_tags` 共 33 枚（§1 事实 15），按 `relatedTools.html:36` 那句逐字 `contains` 加 `:38` 的 `break` 这个口径算，今天有卡的是**恰好 28 篇**、每篇一枚「逐字命中串」。这一格钉的是 **A9 落地之后**的 28 行「`rel` 对应逐字命中串」快照，实现一律走「脚本内钉一份快照 + 与当前源读数对账」——**不许用 `git show HEAD:<篇>` 取改前值**，因为牙齿台账把源抄进 `/tmp` 副本时 `.git` 在 `SKIP` 集里，门禁在副本上读不到 git。它首跑该红的正是唯一会变的那一行：`2023-05-08-vue3-vite-study` 的命中串 `Vite` → `vite`（命中哪一页不变，仍是 `json` 那张卡；Task 5 首跑红这一条、Task 6 治完转绿） | 又长出大小写双键 / 词表漂移 / 幽灵标签 / 正则与 Jekyll 分叉 / 归档页锚点跳空 / 文末工具卡被改名带跑 |
| `内链` | ① 正文里指向 `/tools/*.html` 的手工链接条数 ≥ 5；② 每条的 href 在 `_site` 里有对应文件（带 baseurl 时拼出来的那一条 200）；③ 每篇最多 2 枚；④ 链接文字不等于「点这里/工具/详情」这类空词 | 404 的正文内链 / 把自动卡当手工链交差 |
| `目录` | ① 每一篇产物：静态条目的 `href` 去掉 `#` 后与本页 `<h2 id>`/`<h3 id>` 序列**逐个相等**（顺序也相等）；② `h2+h3 < 2` 的产物里必须**没有** `.toc-static`（按 §1 事实 19，这一格只有 `2018-12-25-qqweiboshare.html` 一篇）；③ `h2+h3 ≥ 2` 的产物里条目数 == heading 数 ≥ 2，且「达标篇数 == 带块篇数」（**期望值按产物现算、不钉常数**：起草时读数 79 是那一版语料的实测，见 §1 事实 19；钉成常数的话，每长出一篇达标新帖这一格就对一篇正确产物判一次假红——改口经过见 §9 交付实录）；④ JS 那一族的三个 id/class（`#toc-list` / `.toc-link` / `.toc-fab`）仍在（防 A8 把旧路径删掉）；⑤ `body.has-toc .toc-static` 那条隐藏规则在产物 CSS 里逐字可见（防「两份列表同时显示」）；⑤ 的另一半是逐页的：`<nav class="toc-static">` 之前必须已有那段给 `<html>` 挂 `has-js` 的内联脚本，否则静态块会先画一帧再收起，读者看到一次塌陷（牙 M17） | 目录与正文脱节（点了跳错节）/ 双份列表其中一份坏了 / 双份同时可见 / 收起之前先画一帧（CLS 冒出来） |

白名单（组 `词表` 第 ② 条）不是另起一份数据，而是**从归一后的现状生成、逐条钉进脚本**的一份常量表，
新增/改名必须显式改脚本——这是这一格的意义（词表漂移是这次要治的病，不该由「自动跟随」放过）。

### 5.2 牙齿（每组都要能红，红在登记的那一格）

沿用 SP1 那一届的形状：变异只打在 `/tmp` 的**产物或源码副本**上，工作树一字不动。
**本仓的牙齿台账有两副形状，别记错**（读脚本现证：`grep -n "name: '" scripts/check-seo-teeth.mjs`
与 `sed -n '106,110p' scripts/verify-tools-browser-teeth.mjs`）：

- `check-seo-teeth.mjs`（本批 M1–M18 落的地方）的一条是 `{name, group, expect, mut}`，**没有**
  `id / from / to / cascade` 这些字段；落点唯一性由 `mut` 里的 `subOnce` / `patchFirst` / `cutLine`
  **抛异常**保证（找不到或不止一处都抛），主循环把抛异常记成「变异脚本自己崩了」并整族退 1；
  `expect` 是门禁那行判定的**逐字片段**，且必须红在 `[group]` 这一组里，红在别组也算假牙。
  退出码在这本里各有所指：**1 = 有红（含变异没落地），2 = 门禁自己崩了**（`check-seo.mjs:66-70` 的
  `uncaughtException` 兜底），所以「锚点漂了」不会伪装成「判定红在指定组」。
- `verify-tools-browser-teeth.mjs`（浏览器那一族，本批只有 A8 的动效回归会间接碰到）的一条才是
  `{id, kind, name, expect, pages, targets, from, to, why}`，`apply` 在目标串找不到时**退 2**。

本批 M1–M18 全部进第一本（`check-seo-teeth.mjs`）：M15 打源侧 tags 行（判据在 `词表` 组），M16 打产物 meta（`描述` ⑥），M17 打 has-js 内联脚本（`目录` ⑤），M18 打源侧 subtitle（`描述` ⑦）。**一条案例只有一个 `group`**：主循环判绿的三条硬条件是
退出码不是 0/2、输出里出现 `[该 group]`、输出里出现该条的 `expect` 片段——**一把跨两组的变异只按登记的那一组计数**，
所以 M9（同时点着 `描述` ① 与 `词表` ⑤）在台账里只有一格，`分账` 那行读到的也是「案例按登记组分桶」，
不许有人把它当成「18 把 = 18 格判据」。
为了让台账可按 M 号 grep，**案例的 `name` 一律以 `M<number> ` 开头**。

| 刀 | 打在哪 | 该红的判据 |
| --- | --- | --- |
| M1 | 摘掉某篇的 `seo_description` 行 | `描述` ① |
| M2 | 把某篇摘要长度改成 45 个 code point（数的是**值**的 code point，`seo_description:` 前缀与字节都不算） | `描述` ② |
| M3 | 把某篇摘要写成它的 `subtitle` | `描述` ③ |
| M4 | 在某篇摘要里塞一个正文没有的数字 `21`（执行时取 `41793`：`21` 太容易作为 `2021` / `16.3.21` 的子串存在于正文，那一刀会落空） | `描述` ④ |
| M5 | 在某篇**已有 `chrome`** 的帖子 `tags:` 里再加一枚 `Chrome`（归一之后大写那侧已经不存在，变异必须造在保留形那一侧） | `词表` ① |
| M6 | 在某篇 `categories:` 里加一个白名单外的词 | `词表` ② |
| M7 | 把某篇的 `categories: [A, B]` 改成空格分隔 | `词表` ③ |
| M8 | 给某篇副本的 `tags:` 行补一个 `\r`（CRLF 化） | `词表` ④ |
| M9 | 把某篇的 `date` 从 2026 改成 `2100-01-01`（把它推出语料） | `描述` ① 与 `词表` ⑤ **同一把都会红**（这条等的就是「文件集 == 语料 + 豁免」那把尺）；案例只登记一条，`group` 取 `词表`、`expect` 取 ⑤ 那句——一本里一条只有一个 `group`，跨过去的另一格不进 `分账` |
| M10 | 把某篇 `tags:` 里已有的一枚原样重写第二遍（造同帖重复） | `词表` ⑥ |
| M11 | 在 `_site` 某篇产物里删一条静态目录 `<li>` / 改一个 href | `目录` ① |
| M12 | 把一条正文工具内链的 href 改成 `/tools/nope.html` | `内链` ② |
| M13 | 摘掉整块 `.toc-static`（换成 `<div class="toc-static"></div>`） | `目录` ①③ |
| M14 | 删掉 CSS 里 `body.has-toc .toc-static { display: none }` 那一条规则 | `目录` ⑤ |
| M15 | 在某篇**持有 `git` 标签**的副本里把 `git` 改成 `Git`（不在 A9 的改动面上，纯造变异） | `词表` ⑧——这一把量的是「改名会带跑文末工具卡」；同一把也会点着 ①（`git` 与 `Git` 成了一对新撞键，两格同在 `词表` 组），所以 `expect` 必须取 ⑧ 那句，才算钉住「带跑卡」而不是「长出双键」 |
| M16 | 打在**产物**某篇的 `<meta name="description">` 上（源侧一字不动，只改产物里那一个字符） | `描述` ⑥——①–⑤ 的牙全打在源侧，唯有这一把能证明「接线那一格真的在产物侧工作」 |
| M17 | 摘掉静态块之前那段给 `<html>` 挂 `has-js` 的内联脚本 | `目录` ⑤（门控半边） |
| M18 | 把某篇 `subtitle` 写成不带引号的 plain scalar、尾巴带一个 ` #9` | `描述` ⑦ |

**三格明说没有牙**（完整无牙矩阵在计划 Task 10 Step 8.6，共 7 格：`描述` ⑤、`词表` ⑦、`内链` ①③④、`目录` ②④）：
`内链` ①（条数 ≥ 5）是**计数**判据，计数判据的牙齿等价于「删一条就少一条」，已被 `内链` ② 的牙覆盖；
`描述` ⑤（全站取值互不相同）要点着它必须造一次「两篇共用同一句话」的重复，M1–M18 里没有那样一把
（M3 改成本篇 `subtitle` 不产生重复，M9 把一篇推出语料也不产生重复），而它**今天就是绿的**（`uniqDesc` 实测 80），
所以它的价值全在防未来——台账里不许挂着「有守卫」的名义过去，也不许写成「≥80」把现状说成有病。
口径照 §6.4 写进台账，不假装它有牙。

### 5.3 不新增门禁脚本，改动的文件逐一点名

**门禁侧**：`check-seo.mjs`（加 4 组）、`check-seo-teeth.mjs`（加 M1–M18）。
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
`_data/og_images.yml` **本批不重跑、不碰**（§4.2 动作 3 那条已改口：这 4 篇全部带 `cover`，一枚都不进这张表；
该表实测 68 条），自证只跑只读的 `node scripts/og-images.mjs --check`，改前改后各一次，退码与摘要行必须一模一样。
`_data/onlineTools.yml` **只有当某枚被 `match_tags` 钉住的标签要改名时**才动。
33 枚全集按页摊开（探针 `/tmp/sp4-match.cjs`，与 §1 事实 15 同源）：`codec` 11 枚 —— `前端小技巧`、
`JavaScript公用方法`、`JavaScript语言精粹`、`原型和原型链`、`函数式编程`、`ES2023`、`JS新特性`、
`浏览器缓存机制`、`网站seo`、`seo优化`、`搜索引擎网站收录`；`json` 13 枚 —— `npm`、`pnpm`、`yarn`、
`node包管理工具`、`TypeScript`、`webpack`、`vite`、`Vite`、`gulp`、`前端构建`、`工程化`、`项目搭建`、`私有仓库`；
`diff` 9 枚 —— `git`、`git常用命令`、`reset`、`revert`、`代码回退`、`代码回撤`、`版本投产`、`更新版本内容`、`github`；
`idcard` 是 `match_tags: []`。**起草时那句「9 条钉死的串」只是 `diff` 那一页的块。**
动作 2 要动的 5 枚里，`Chrome` / `React` / `WebMCP` 三枚大写侧与改名侧 `coding` 一枚都不在这 33 枚里，
**唯独 `Vite` 在**——而 `json` 那一串里 `vite` 与 `Vite` 两枚并存，所以改名不会换卡，只会换那一行的逐字命中串
（§1 事实 15）。`_data/onlineTools.yml` 因此**一个字节都不改**：改它等于改卡面配置，而这一刀要证的恰恰是
卡面配置不必跟着改（判据 `词表` ⑧ 钉的是快照，不是这份 yml）。
动作 3 改的是 categories 而 `match_tags` 只读 tags，动作 4 删的是重复的 `Agent`——这两条同样不碰这份 yml。
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
- **6.1 摘要覆盖率**（不是 A/B，是「前后」，全部从 `_site` 产物读；下面每个数都是 2026-10-06 在
  Task 1 重建之后的产物上现场量的，量具与逐字输出见计划 Task 1 Step 3 / Step 8）：每篇文章页恒有 1 条
  `<meta name="description">`（`pages 80 / missing 0`）；
  **取值与本篇 `subtitle` 相同的篇数 38 → 0**（口径 = HTML 实体反解之后；只比 `content` 的原始字节是 **35 → 0**，
  差的 3 篇是 subtitle 里带 `"`、meta 里写成 `&quot;` 的 `2026-06-05-ai-sdd`、`2026-07-12-facebook-astryx`、
  `2026-07-12-impeccable-ai-design`。两个口径都要写，因为「逐字」与「反解」在别处会指向不同的格子）；
  **取值与 `site.description` 相同的篇数 1 → 0**——**起草时这一格写的是 `0 → 0`，错。**
  现状有 1 篇落到全站描述：`2026-09-25-claude-agents-md-remote-gate.md`，它的 `subtitle: issue` 只有 5 个字符，
  被 `seoMeta.html:73` 那道 `.size < 25` 的地板拦掉了。所以「那 39 篇的 `subtitle` 全部 ≥25 字符」这句不成立：
  39 篇里没有 `seo_description` 的读数是 **38 篇取 subtitle + 1 篇取 site.description**，
  唯一 <25 的那篇不是不产出的教学样本，而是这一篇（教学样本 `2100-10-25-practice-demo` 的 `subtitle` 24 字符，
  但它压根不进 `site.posts`）。这一格因此是**现状有病、要治**的一格，不再是「防地板论被误当成现状」；
  **手写的篇数 41 → 80**；产物里 meta description 的**去重条数 80 → 80**——
  N 现场量 = 80，**今天就是绿的**，这一格的价值全在防未来，不在修现状。
  而**它没有牙**：要点着它必须造一次「两篇共用同一句话」的重复，M1–M18 里没有那样一把
  （M3 改成本篇 `subtitle`、M9 把一篇推出语料，都不产生重复），这一格进无牙矩阵与移交清单。
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
- **纠自己十一次**：① 起草时 shell 管道数出的「158 枚 / 124 枚单篇 / 1 枚 `黑科技\r` 幽灵标签」里，
  `\r` 那枚是行尾粘连造出来的假键（§0 第 3 条），158 是「文件集」读数、不是词表读数；
  ② 摘要兜底那格从「81 − 41 = 40 篇走 `site.description`」改成实测的
  「39 篇走 `subtitle`、0 篇走 `site.description`」——**这半句又被 ④ 推翻**：39 篇的分解是 38 + 1；
  ③ 回填数从 40 改成 39（教学样本不产出页面）。
  ④ **§6.1 的 `site.description` 那格从 `0 → 0` 改成 `1 → 0`**：执行 Task 1 时现场量产物，落到全站描述的
  有 1 篇——`2026-09-25-claude-agents-md-remote-gate.md`，它的 `subtitle: issue` 只有 5 字符，撞在
  `seoMeta.html:73` 的 `.size < 25` 地板上；「那 39 篇 subtitle 全部 ≥25 字符」不成立，
  而且「唯一 <25 的是那篇不产出的教学样本」也错（教学样本 24 字符，但它不进 `site.posts`）。
  同一次量产物顺带把「等于 subtitle」拆成三个口径：逐字 `35`、HTML 反解后 `38`、靠转义才相等的 `3` 篇逐一点名。
  ⑤ **§1 事实 15 的「`match_tags` 钉死 9 条」改成 33 枚**（`idcard` 0 / `codec` 11 / `json` 13 / `diff` 9，
  9 只是 `diff` 那一页的块）；连带三处跟着改：§2 非目标里「那三族恰好都落在 `match_tags`」只对一族
  （`代码回退`/`revert`/`reset` 三枚都在，`Vue2`/`Vue3` 与三枚 `微信…支付` 一枚都不在）、
  §4.2 组 5 那句「`coding.net` 不在 9 条里」改成 33 枚、§5.3 把 33 枚逐子摊开写明。
  **更要紧的后果**：A9 要动的 `Vite` 恰好在 `json` 那一串里（同串 `vite` 与 `Vite` 并存），
  所以「一枚都不在里面、命中集必然不变」是错的，准确的口径是「命中哪一页不变、命中串从 `Vite` 变 `vite`」，
  28 篇有卡的文章里恰好只有这一行会变。
  ⑥ **动作 3 的「重跑 `node scripts/og-images.mjs`」整条取消**：那 4 篇全部带 `cover`，
  而卡面文字只画在无 `cover` 的文章上（`grep -c 'bend\|scriptc\|univer\|gitdiagram' _data/og_images.yml` = 0，
  表 68 条）——不重跑、不碰那份并发会话正持有的文件，自证换成只读 `--check` 前后各一次。
  ⑦ **新增 `描述` ⑥（产物侧接线）与牙 M16**：现有 10 组里没有任何一组管文章页 meta description 的来源，
  A4 回填完之后改坏 `seoMeta.html` 的取值链不会让任何一道门红——那正是 SP1 §7 修过的同类缺陷形状；
  ①–⑤ 的牙全打源侧，只有打在产物上的 M16 能证明那一格真的在产物侧工作。
  ⑧ **`词表` ⑧ 的实现口径从 `git show HEAD:<篇>` 改成「脚本内钉 A9 落地后的 28 行快照」**：
  牙齿台账把源抄进 `/tmp` 副本时 `.git` 在 `SKIP` 集里，门禁在副本上读不到 git，那条实现根本跑不动。
  同一趟读脚本顺手钉两件事：这本牙齿的一条案例**只有一个 `group`**（判绿的三条硬条件里没有「独占」那条，
  所以跨组的一把只按登记的那一组进 `分账`），且 §5.2 表格里原先写的 `cascade` **是这个脚本没有的字段**，
  M9 / M13 / M15 三格的说法跟着改成实测形状。
  ⑨ **`§6.4` 那句「判据脚本是这 14 本」按行数是 14、按文件是 15**：
  `verify-codec-browser.mjs（+ 它的 teeth）` 在那一节被并进了同一行。台账按文件出，15 个文件、14 行，
  这一处口径差在 Step 8 的台账里点名，不假装「14 本」等于 14 个文件。
  ⑩ **`§6.1` 那两格的根因到执行天才查清**（数字本身在 Task 1 已从 `39 → 0`、`0 → 0` 改成 `38 → 0`、`1 → 0`）：
  起草时两把 Ruby 尺都用 `/\A---\n(.*?)\n---\n/` 读 front matter，**CRLF 那一篇被静默跳过**
  （`_posts/2019-02-25-you-dont-kown-js-tips.md`；它在 A9 动作 4 里已经改成 LF，所以现在按 CRLF 去找它找不到，
  要复现这一条得回 A9 之前的提交），于是「手写的篇数」少数一位；
  改成 `---\r?\n` + 去 `\r` 之后 `hand=41`，与 §1 事实 1 里那个 41 对上了。
  **教训是形状：一把尺读不到某个文件时，它报的数会安静地小一位，而「安静地小一位」看起来像口径差异，不像 bug。**
  ⑪ **`subtitle` 能被 YAML 吃掉半句，这件事起草时没人怀疑过**：
  `_posts/2026-09-25-claude-agents-md-remote-gate.md` 那篇写的是 `subtitle: issue #95690 说读 AGENTS.md…`
  （不带引号），` #` 之后整段被当行尾注释，Jekyll 读到的值就是 `issue`（5 字符，撞在
  `seoMeta.html:73` 的 `.size < 25` 地板上），产物 meta 退回全站 `site.description`、分享卡那一格跟着一起错。
  §1 事实里那句「唯一 <25 的是那篇不产出的教学样本」因此**只对了一半**——它漏了这一篇。
  补判据（`描述` ⑦）+ 补牙（M18）+ 一处一行修复（值加双引号，提交 `2674252`），现场细节见 §9.5。
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
  `check-seo-teeth.mjs`（本批全集 M1–M18：M17 打 A8 的 has-js 门控半边，M18 打 front matter 的静默截断，见 §9 交付实录）；不新建门禁脚本。
- **产物读数的来源被钉死**：主工作树那份 `_site` 早于 SP1 的 A5（§1 事实 20 有实证），
  所以 §6 的每一个数都必须在 `.worktrees/sp4-content-governance` 里现场 `bundle exec jekyll build`
  之后取，并先做一次「keywords 是逐页串」的自证。

## 9. 交付实录（SP4，2026-10-07）

### 9.1 提交段

基线 `2b9464c`（本分支与 `main` 的 merge-base）起 **19** 个提交，全部落在 `sp4-content-governance`，
**未推送**——硬证是 `git branch -r --contains HEAD` 无输出（本仓远端只有 `master`，所以**不能**用
`origin/main..HEAD` 那一套，它会把「不存在」读成「没东西可推」）。四刀的落点按刀分：

| 提交 | 内容 |
| --- | --- |
| `c917d1f` | 本设计定稿（spec：四刀、判据与 15 把牙的原始账） |
| `f629e9a` | §5.2 / §6.4 两处「没读脚本就写」的口径改成实测形状 |
| `227a676` | 实施计划（四刀十任务、判据先行、18 把牙的明账） |
| `859497e` | 未推核验改口：`origin/main` 在本仓不存在，改用 `git branch -r --contains` |
| `2f6757e` | §6.1 / 事实 15 / og 三处口径改成实测值，补 `描述` ⑥ 与 M16 |
| `64248b3` | `描述` 组六道判据落地（39 篇缺摘要，此刻**刻意红**） |
| `c471571` | A4：39 篇补 `seo_description`（那一红转绿） |
| `b113c48` | `描述` 组五把牙（M1–M4、M16） |
| `e70e0b4` | `词表` 组八条判据（先红 25） |
| `e3a8cea` | A9：词表归一四动作（25 红转绿） |
| `67fdb15` | 计划回写 Task 6 三处 |
| `d919092` | `词表` 组七把牙（M5–M10、M15） |
| `7cd6812` | 计划回写 Task 7 三处 |
| `7ac2723` | 刀3：正文六条真能点到的工具内链 + `内链` 组四条判据 |
| `df77a4c` | 计划回写 Task 8 四处 |
| `d3869d3` | A8：构建期静态目录（79 篇有）+ `目录` 组五条判据 + 四把牙 |
| `91b3d17` | 计划回写 Task 9 五处 |
| `2674252` | 那篇 `subtitle` 只加双引号（YAML 把「` #95690…`」当行尾注释吃掉了） |
| `ae55ad9` | `描述` 组补第 ⑦ 条「无静默截断」+ 牙 M18 |

（把本节落盘的提交是第 20 个。四笔「计划回写」不是顺手记录：每一笔都是执行时撞上**计划自己写错**，
按「以命令输出为准并回写本文件」的规矩改计划，逐条内容见 §9.4。）

### 9.2 门禁台账（18 道全跑在导出树，逐道引它自己打印的那一行）

**跑门的树**：`git archive ae55ad952c6f238b73af83301d6f6a62a9474a13` 的导出树，落点
`$TMPDIR/sp4t10/gate/t10`（计划写的 `/tmp/gate/t10` 这一轮不可用，见 §9.6 第 8 条），
`vendor` 与 `node_modules` 从主工作树软链；构令 `npx --no-install vite build && bundle exec jekyll build`，
**不带 `--baseurl ""`**（与线上一致用默认 `/better-blog`，牙齿台账若干锚点带的就是这一串），
`vite exit=0`、`jekyll exit=0`。跑门之前 `git status --porcelain` 在工作树只剩 `?? vendor` 一行。

**认树**：三本产物 md5 在跑门前后各取一次，**逐字相同**（`diff` 无输出 = 这一遍没有 watcher 重建过我读的这棵树）：

| 产物 | md5（跑门前 = 跑门后） |
| --- | --- |
| `_site/index.html` | `a9ca590441fc5597c7fa347afb4d5cd6` |
| `_site/2026/07/12/alibaba-page-agent.html` | `c1bcd7951e01ff74f9a2d04503ab3380` |
| `_site/tags.html` | `2a5ed39f8d4de10e9022706c0c273d26` |

页数对账：`find "$S/_site" -name '*.html' | wc -l` = **137** == 门禁抬头报的 **137 页 / 80 篇文章页 / 103 页带安装面**。
一句实话：**md5 在这里不是万能指纹**——工作树那份 `_site` 与导出树这份是同一提交、同一构令的产物，
内容逐字相同，能分开两棵树的是命令里 `--site=$S/_site` 这一格和页数，不是那三串。

表 A（15 个文件、14 行；`spec §6.4` 那句「14 本」按行数是 14、按文件是 15，见 §8 ⑨）：

| 道 | 命令（都在导出树里跑） | 它自己打印的那一行 | rc |
| --- | --- | --- | --- |
| toolkit | `node scripts/toolkit-tests.mjs` | `# tests 439 / # pass 439 / # fail 0`（本批不碰 toolkit，数不变） | 0 |
| seo | `node scripts/check-seo.mjs --root=$S --site=$S/_site` | 抬头 `SEO 门禁：产物 _site/（137 页 / 80 篇文章页 / 103 页带安装面），ready 工具 4 条，修订台账 45 条，换源台账 20 条`；末行 `✓ SEO 门禁 14 组全绿（keywords / modified / JSON-LD / 分页门 / ItemList / manifest / 接线 / head / 相关工具 / 换源 / 描述 / 词表 / 内链 / 目录）；JSON-LD 209 块全部可解析` | 0 |
| seo 牙 | `node scripts/check-seo-teeth.mjs --root=$S --site=$S/_site` | `分账：语料 6 / keywords 7 / modified 10 / JSON-LD 30 / 分页门 2 / ItemList 18 / manifest 24 / 接线 9 / head 7 / 相关工具 15 / 换源 9 / 描述 7 / 词表 6 / 内链 1 / 目录 4`、`牙齿台账：155/155 组变异如期变红（用时 166.6s）`、`✓ 全部变异已还原，复跑基线仍绿` | 0 |
| 工具收录面 | `node scripts/check-tools-surface.mjs` | `✓ 收录面 4 条 ready 条目 × 5 组判据全绿（页面源/收录/导航/图标/DOM）` | 0 |
| 收录面牙 | `node scripts/check-tools-surface-teeth.mjs` | `牙齿台账：74/74 组变异如期变红` | 0 |
| 滤镜单元 | `ruby scripts/check-image-dims.rb "$PWD"` | `--- image-dims: ok（36/36 条断言，台账 20 对，桩目录 …）` | 0 |
| 滤镜单元牙 | `node scripts/check-image-dims-teeth.mjs` | `牙齿台账：27/27 刀变异如期变红` | 0 |
| 换源台账牙 | `node scripts/check-image-variants-teeth.mjs` | `牙齿台账：15/15 刀变异如期变红` | 0 |
| 计划镜像 | `node scripts/verify-plan-blocks.mjs` | `✓ 全部已落地镜像与磁盘逐字节全等（未落地 0 节）` | 0 |
| 计划镜像牙 | `node scripts/verify-plan-blocks-teeth.mjs` | `41/41 通过` | 0 |
| 工具页浏览器 | `TK_SITE_DIR=<导出树 _site 的副本> node scripts/verify-tools-browser.mjs` | `# 合计 115 项，红 0 项` | 0 |
| 工具页浏览器牙 | `TK_SITE_DIR=<另一份副本> node scripts/verify-tools-browser-teeth.mjs` | `合计 9 项（六刀 + 三自检），点燃 9 项，未点燃 0 项` | 0 |
| 编解码浏览器 | `node scripts/verify-codec-browser.mjs` | `合计 37 项，红 0 项` | 0 |
| 编解码浏览器牙 | `TK_SITE_DIR=<第三份副本> node scripts/verify-codec-browser-teeth.mjs` | `合计 5 个注入，点燃 5 个，未点燃 0 个`（它自己的注入编号 `M1…M5` 与 `check-seo-teeth.mjs` 的 M1–M18 **不是同一套**） | 0 |
| 身份证浏览器 | `node scripts/verify-idcard-browser.mjs` | `13/13 通过` | 0 |

表 B（另三道形状不同的）：

| 道 | 命令 | 它自己打印的那一行 | rc |
| --- | --- | --- | --- |
| OG 台账自证 | `node scripts/og-images.mjs --check` | `自检通过：表 68 条，卡片 34 张全部在磁盘上、尺寸 1200x630、无孤儿文件。` | 0 |
| 揭示动效 | `node scripts/verify-motion-batch4.mjs` | `# 通过 93 项，红 0 项` | 0 |
| 触屏下拉 | `node scripts/verify-nav-touch.mjs` | `✓ 移动端下拉点按门禁：判据 77 条 红 0 条 · 牙齿 10/10 组变异如期点名` | 0 |

**两道 Chrome 门禁之前拍的负载**：1 分钟 `vm.loadavg` = **3.42**（阈值 16），没有拒测；见 §9.7。

**牙齿计数与源对账**：`grep -c "^    name: '" scripts/check-seo-teeth.mjs` = **155**，
与门禁自己打的 `155/155` **相等**——两个数各自成立不算过，要它们相等。
155 = 既有 137 + 本批 18（M1–M18）；四个新组都在分账里（`描述 7 / 词表 6 / 内链 1 / 目录 4` = 18），
其中 **`描述 7 / 词表 6` 与计划形状列写的 `描述 6 / 词表 7` 不符**：M9（把一篇推出语料）一把跨两族，
而一条案例只有一个 `group`，它登记的是 `描述`，所以计数归 `描述`（§8 ⑧ 后半段早就钉过这条规则）。

### 9.3 A/B 五个数（§6.3 口径，5 轮/侧取中位数）

**两棵树**：`head` = `git archive 2b9464c`（**整批 SP4 之前**，不是「本刀之前」）的导出树，
`new` = 工作树 `ae55ad9` 重建；两侧各自 `npx --no-install vite build && bundle exec jekyll build`（默认 baseurl）。
节流 fast3g（RTT 150 ms / 下 1.6 Mbps / 上 750 kbps）+ `Network.setCacheDisabled`，
视口 1280×900 且每轮自证 `innerWidth=1280`（20 行没有一行不符），1 分钟负载 4.81–6.75、
`respStart` 中位 ≤ 62.3 ms（< 100 ms 那道地板）。两侧交替 5 轮 × 2 模式（`cls` / `action`）× 2 篇 = 40 行。

**篇**：最大的一篇 `2019/07/26/javascript-design-pattern.html`（76 条目）与中位一篇 `2026/06/05/ai-sdd.html`（9 条目）。

| 数 | jdp head | jdp new | Δ | ai-sdd head | ai-sdd new | Δ |
| --- | --- | --- | --- | --- | --- | --- |
| load | 7625.4 | 7701.1 | **+75.7** | 7642.4 | 7652.0 | **+9.6** |
| DOMContentLoaded | 6476.0 | 6519.9 | +43.9 | 3302.5 | 3291.3 | −11.2 |
| 可交互（最后一个 longtask 结束） | 7712.8（5/5 轮有长任务） | 7787.0（5/5） | +74.2 | 3489.1（2/5） | 2926.5（1/5） | −562.6 |
| 首次动作（`mode=action`） | 6496.6（`toc-link`） | 2969.8（`toc-static-link`） | **提前 3526.8** | 3307.7（`toc-link`） | 2890.9（`toc-static-link`） | **提前 416.8** |
| CLS（只认 `mode=cls` 那一轮） | 0.04317 | 0.04317 | **Δ = 0.000000000** | 0.00052 | 0.00052 | **Δ = 0.000000000** |

`可交互` 的口径钉死在这里：本机这版 Chrome 的 `performance.interactive` 恒为 `undefined`（打出来是 `null`），
所以取「最后一个 longtask 结束的时刻」；`interN` 那一列（几轮有长任务）就是这一档的样本量，
ai-sdd 的 −562.6 是「head 有 2/5 轮跑到长任务、new 只剩 1/5」的读数差，**不是脚本变快的证明**，别当交付数用。

**字节与恒等式**（gzip 口径 `cat f | gzip -9 | wc -c`；`gzip -9 -c f` 会把文件名写进头部、多 `len+1` 字节，本机实测 12 = 11 + 1）：

| 篇 | HTML 原文 | gzip | Δ HTML | 恒等式 |
| --- | --- | --- | --- | --- |
| jdp | 472,790 → 483,043 | 62,273 → 63,621 | +10,253 | 76 条目 nav 10,188 + `has-js` 内联脚本 65 = **10,253**，残差 **0** |
| ai-sdd | 83,055 → 85,240 | 26,703 → 26,980 | +2,185 | 9 条目 nav 1,692 + 65 = 1,757；余 **428** 是 A4 描述回填改到的 4 行（`meta description` / `og:description` / `twitter:description` / JSON-LD `description`，逐行 diff 在 `t10-aisdd-residual.txt`） |
| 全站 | — | — | — | 79 篇 / 881 条目：nav 137,887 B + 脚本 5,135 B = **143,022 B**，公式值 **143,022**，**diff = 0** |

**G4 的本体（禁 JS 那一侧真读得到目录）**：在产物上摘掉全部 `<script>…</script>` 之后逐篇断言
① `class="toc-static"` 恰好 1 次、② nav 里每枚 `href="#X"` 都能在**同一份剥脚本的 HTML** 里找到 `id="X"`——
读数 `{"articlePages":80,"withBlock":79,"failures":0,"bad":[]}`。带块的 79 篇 == §4.4 说的覆盖面，
缺的那 1 篇是 `_posts/2018-12-25-qqweiboshare.md`——它的 `h2`+`h3` 是 **0 个**，没有标题可列，必须没有块。

**两句必须跟着数的实话**：
1. **CLS 两侧同值不是「A8 没代价」，是「A8 没有新增代价」**。jdp 那 0.04317 在 `head` 与 `new`、
   `cls` 与 `action` 四种组合里都是 5/5 轮出现、时刻都在 `hasTocAt` 之后（约 6.4–7.1 s），
   来源是本批没碰过的 `dev/js/editorial.js` 揭示动效；按 §6.3 的字面判据「`hasTocAt` 之后不得有非零位移」
   两棵树**同时红**，而这一批的价格是 Δ = 0.000000000。这一格按 Δ 记，把那处既有位移写成偏离（§9.4 第 6 条），
   不假装规则 1 绿了。
2. **`firstActionSel = toc-static-link` 量的是「DOM 里存在可跳的锚点」，不是真鼠标命中**。
   JS 开着时静态块是 `display:none`，探针每 50 ms 试探的是 `<a>` 元素存在 + `scrollY`/`location.hash` 真的动了；
   「首屏就有目录可点」这条读者体验要靠 `navHAt0 = 0`（静态块首帧不占位）与 G4 那两条一起背书。
   `action` 模式那一轮的 CLS（new 0.0705 / 0.0783）**不作数**——探针自己的 click 会把随后那次塌陷标成
   `hadRecentInput` 而丢掉，CLS 只认 `cls` 模式（夹具实测：同一个 `fake-new`，`cls` 0.07426 / `action` 0.00301）。

**先跑夹具反证**（六条期望值全中，否则脚手架在说谎，数就不许往下量）：
`fake-head` cls `0.00000` / `shifts 0` / `navHAt0 null`；`fake-new` cls `0.07426`、`navHAt0 82 → navHAtToc 0`
（「先画出来再收起」的现场证据）；`fake-new2` cls `0.00000`、`navHAt0 0`；
`fake-head` action `toc-link @ 441.7 > 400`；`fake-new2` action `toc-static-link @ 317.1 < 400`；每行 `innerWidth=1280`。

### 9.4 与原设计的偏离（按发现顺序，不按严重度）

| # | 偏离 | 起草时写的 | 执行后的口径 |
| --- | --- | --- | --- |
| 1 | `描述` 组判据从 6 条长到 **7 条** | 六道（①–⑥，其中 ⑥ 是 §8 ⑦ 自我纠正时补的产物侧接线） | 加 ⑦「无静默截断」（牙 M18）；**这一条不是加需求，是 §6.1 那格 `1 → 0` 的根因**：不钉住「写进 front matter 的值 == Jekyll 读到的值」，取值链上游的坑随时能让整站的 meta 退回全站描述 |
| 2 | 牙齿 15 → **18 把** | M1–M14（定稿时）→ M1–M15 → M1–M16 | M16（产物 meta 接线）、M17（`has-js` 门控半边）、M18（静默截断）三把都是执行中立的；§5.2、§5.3、§8 各处跟着推到全集 |
| 3 | `词表` ⑧ 的实现取「脚本内钉 A9 落地后的 28 行快照」 | `git show HEAD:<篇>` | 牙齿台账把源抄进副本时 `.git` 在 `SKIP` 集里，门禁在副本上读不到 git，那条实现根本跑不动（§8 ⑧） |
| 4 | 动作 3 **不重跑 og 生成器** | 「重跑 `node scripts/og-images.mjs`」 | 那 4 篇全部带 `cover`，卡面文字只画在无 `cover` 的文章上；改成只读 `--check` 前后各一次，不碰并发会话正持有的 `_data/og_images.yml`（§8 ⑥） |
| 5 | B3（每页 CSS 拆分）**deferred** | 曾列为候选 | 第 6 项决策：本批不动 CSS 分片，A8 的收起规则进现有 `editorial.scss` 的选择器集 |
| 6 | CLS 那一格按 **Δ = 0** 记，而不是按「绝对值 ≤ 0.02 / `hasTocAt` 之后无非零位移」记 | §6.3 的字面判据 | 那 0.04317 的位移来自 `dev/js/editorial.js` 的揭示动效，`head` 与 `new` 四种组合同样 5/5 轮出现（Δ = 0.000000000、`navHAtToc = 0`）。按字面记就是**两棵树同时红**，那既不是本批的价格也不是本批的责任；这一处既有位移进 §9.8 移交 |
| 7 | A/B 的 `head` 取 **`2b9464c`（整批之前）**，不是「本刀之前」 | §6.3 写的就是 `2b9464c` | 后果：Δ 里除 A8 的目录块还含 A4/刀3 对这两篇的改动。jdp 恰好只有目录块（残差 0），ai-sdd 另有 **428 B** 落在描述回填那 4 行——量具没有骗人，是基线选得宽 |
| 8 | 计划 Step 8.3 那三条浏览器命令**缺 `TK_SITE_DIR`** | `node scripts/verify-tools-browser.mjs` 直接跑 | 这三本（tools-browser / 它的 teeth / codec 的 teeth）没有环境变量就退 2，且 `0a` 那条判据要求指向**仓库 `_site` 之外**的副本——导出树里的 `$S/_site` 也算「那个根的 `_site`」，照样拒。实跑各给一份独立副本（`cp -R`，不用 `cp -al`：牙齿是原地改写，硬链会连累被测树） |
| 9 | `计划镜像牙` 在 `git archive` 树里**跑不动** | 台账 18 道全在导出树 | `verify-plan-blocks-teeth.mjs` 用 `git status --porcelain` 拍脏指纹（实验前后各一张），导出树没有 `.git` → rc=1 且 **stdout 空**（错在 stderr）。修法是在导出树里 `git init` + 一次性提交（只动这棵临时树），跑出来 `41/41 通过`、跑完 `git status --porcelain` 仍 0 行 |
| 10 | 分账那格 `描述 7 / 词表 6`，计划形状列写的是 `描述 6 / 词表 7` | 起草时把 M9 记在 `词表` | M9 一把跨 `描述` ① + `词表` ⑤，而一条案例只有一个 `group`、分账按登记的那组计数，它登记的是 `描述`（规则在 §8 ⑧ 后半段早就钉过）。**以命令输出为准**，形状列回写计划 |
| 11 | Step 7 那 20 次调用**共用一个 `--out`** | 计划里 20 条命令都写 `--out=/tmp/gate/t10-ab.jsonl` | `sp4-ab.mjs:233` 是 `fs.writeFileSync`（覆盖写不是追加），五轮里只有第 5 轮留在盘上——**看起来像「跑了 5 轮」，实际只拿到 1 轮**。改成每轮一份 `t10-<side>-<mode>-r<round>.jsonl` 才真的得到 10 行/侧/模式；残缺那份留着当证据（`*.overwrite-defect.jsonl`） |
| 12 | 落点从 `/tmp/gate` 换到 `$TMPDIR/sp4t10/gate` | 计划里所有 `/tmp/gate/…` | 这一轮 `/tmp/gate` 整目录不在了（这台机器上 `/tmp` 会被清）。换落点不改口径，但**引路的命令必须按实际输出改口**，否则下一次执行会去读一份不存在的路径并把它读成「空结果」 |
| 13 | A/B 量具用**计划镜像块**而不是 Task 9 那版重建 | 两处形状不同 | 按计划 :1923-2155 逐字镜像出来的脚本缺 Task 9 回写的那条 MIME 修复；补的是一处有据的补丁（按扩展名给 `content-type`），不是重写。补丁生效的正证：new 侧 `navHAt0 = 0`（若 CSS 全 404，读到的是裸布局高度而不是 0），且六条夹具期望值全中 |
| 14 | §6.4 那句「14 本」按文件是 **15** | 14 | `verify-codec-browser.mjs（+ 它的 teeth）` 被并进了同一行；台账按文件出 15 个文件、14 行（§8 ⑨） |
| 15 | `目录` ③ 的期望值从**钉死 79 篇**改成**按产物现算**（集成轮，提交 `ddcf682`） | 「这样的产物**恰好 79 篇**」（§5.1 那一行原文） | 长出第一篇达标新帖就把常数顶红：达标 80、带块 80，**产物没错、常数是错的**。改判 `tocBlockPages !== tocNeededPages`，红话把差值交回 ① 逐页点名；牙没动（`目录` 那 4 把的 `expect` 里没有一处 `79`，复跑仍 159/159）。§5.1 与计划 Task 9 Step 2 回写第 3 条跟着改口，§1 事实 19 那个 79 仍是起草读数、不改 |

### 9.5 揪出并修掉的缺陷（按发现顺序）

1. **front matter 被 YAML 静默截断**（Task 9）。`_posts/2026-09-25-claude-agents-md-remote-gate.md` 的
   `subtitle: issue #95690 说读 AGENTS.md…` 不带引号，` #` 之后整段成了行尾注释：Jekyll 读到的值是 `issue`
   （5 字符 < `seoMeta.html:73` 的 25 地板）→ 产物 meta 退回全站 `site.description`、分享卡「卡片摘要」那一格跟着错。
   修法是**一个字符都不动内容**、只给值加双引号（`2674252`），补判据 ⑦ + 牙 M18（`ae55ad9`）。
   这一条最贵的地方在于：它在仓库里躺了很久，而且**没有任何一道门红过**。
2. **一把尺读不到某个文件时，它报的数会安静地小一位**（Task 1 撞见数不对，根因到 Task 9/10 才查清）。
   两把 Ruby 尺用 `/\A---\n(.*?)\n---\n/` 读 front matter，CRLF 那一篇（`_posts/2019-02-25-you-dont-kown-js-tips.md`）
   被静默跳过，于是「手写摘要的篇数」少数一位；改成 `---\r?\n` + 去 `\r` 之后 `hand = 41`，与 §1 事实 1 那个 41 对上。
   那一篇的 CRLF 在 A9 动作 4 里已经归成 LF，所以现在按 CRLF 去找它是找不到的（§8 ⑩）。
3. **`match_tags` 的读数是 33 枚不是 9 条**（Task 1/5）。起草时把 `diff` 那一页的 9 枚当成了全集
   （`idcard` 0 / `codec` 11 / `json` 13 / `diff` 9），而 A9 要动的 `Vite` 恰好在 `json` 那一串里
   （同串 `vite` 与 `Vite` 并存）——「命中集必然不变」是错的，准确口径是「命中哪一页不变、命中串从 `Vite` 变 `vite`」，
   28 篇有卡的文章里恰好只有这一行会变（§8 ⑤）。
4. **`_layouts/post.html` 那段「无 JS 环境也拿不到半截列表」的注释已经过期**（Task 10 Step 7）。
   A8 落地后禁 JS 那一侧拿到的**就是**完整列表（§9.3 的 G4 断言逐篇核过 href↔id 包含），注释留着会把
   下一个读代码的人往「静态目录是半成品」的方向带；这一句改口随 A8 那笔提交走。
   `post.html` 不在可 prettier 的文件集里，改动是手写的。
5. **A/B 量具自己把实验做小了**（Task 9 发现、Task 10 复核）。那个自带静态服务器的脚手架把所有响应都打成
   `text/html`，Chrome 于是拒绝把响应用作样式表（`Refused to apply style`）——**两侧都在无 CSS 状态下量**，
   CLS 恒 0、`navH` 读的是裸布局。修法是按扩展名给 `content-type`。这条如果没被发现，
   §9.3 那三个 CLS 数会「漂亮」得没有任何一句是真的。
6. **量具的 `writeFileSync` 是覆盖写**（Task 10 发现，见 §9.4 第 11 条）。这一条不是产品缺陷，是**账**的缺陷：
   它让「5 轮中位数」在盘上只有 1 轮，而汇总脚本照算、照绿。改法与证据同在 §9.4。

### 9.6 量具踩的坑（逐条一句，给后来的人省一步）

1. 四段日期路径会被显示层折叠：真实的 `_site/2019/07/26/x.html` 打出来像 `_site/2019-07-26-x.html`，
   照折叠形状去 `md5` 只会得到 `No such file`——路径一律 `find` 现解。
2. 一篇文章页里可以有**两条** `<meta name="description">`（`post.html` 的注释里就挂着一条例子），
   按「第一条」或「最后一条」取的读数都不是产品口径，判据得钉「恰好一条」。
3. `seoMeta.html:73` 那道 `.size < 25` 的地板：短摘要不是被截断，是**整条放弃**、退回 `site.description`。
4. Ruby 里 front matter 的 `date` 解析成 `Time`/`Date` 不是 `String`，`String#match` 直接抛。
5. `/tmp` 下没有 `package.json` 的 Node 脚本要写 `.cjs`，否则 `require` 在 ESM 默认下报错。
6. 数 CRLF 只能 `grep -lU $'\r'`：`grep -l $'\r'` 在行尾会被当行终止符处理，数出来恒空。
7. **`og-images.mjs` 不带 `--check` 会改写 `_data/og_images.yml`**——那是并发会话正持有、spec §7.3 点名不许碰的文件。
   手误写成 `--help`（它不是开关）就走进生成模式，`git status` 当场出 `M`。台账这一格只允许 `--check`。
8. `/tmp` 会被清（这一轮 `/tmp/gate` 整目录消失，Task 9 的夹具与脚手架全没）。夹具要能从文档**照着重建**，
   重建后先跑六条期望值再量真页面——这一轮就是这么把脚手架重新点着的。
9. `fs.writeFileSync` 覆盖写 ≠ 追加：循环 20 次共用一个 `--out`，盘上只留最后一轮（§9.4 第 11 条）。
10. `gzip -9 -c file` 会把文件名写进 gzip 头部（多 `len+1` 字节，本机实测 12 = 11 + 1），
    与 `cat file | gzip -9 | wc -c` 差 26 B——口径写死后者。
11. 三道浏览器门禁的隔离闸门拒 `TK_SITE_DIR` 指向「那个根的 `_site`」，**导出树也算**；不给副本就退 2，
    而退 2 在门禁语义里是「环境没起来」，不是「红一条」。
12. 需要 `.git` 的门禁（`verify-plan-blocks-teeth.mjs` 的脏指纹）在 `git archive` 树里 rc=1 且 **stdout 空**——
    错在 stderr。按 `2>/dev/null` 收 stdout 的台账只会抄到一行空白，看不出它为什么没跑。
13. 浏览器门禁的 stdout **最后一行不是汇总行**（`check-tools-surface.mjs` 之流的 `ExperimentalWarning`、
    `verify-codec-browser.mjs` 末尾那句 `# Chrome pid=…` 噪声账）。台账按「`> file 2>/dev/null` + grep 汇总行」抄，
    退码仍认命令自己的 `$?`（管道会吞退出码）。
14. **`check-seo.mjs` 不带 `--verify` 时，`modified` 那组的最后一道闸根本不在场**：`build-modified-data.mjs --verify`
    接在 `--verify` 档里（`const VERIFY = argv.includes('--verify')`），而历轮收口链跑的都是不带参那一档。
    这句话不用翻日志就能复核：§9.2 台账里 seo 那一行的命令列就是 `node scripts/check-seo.mjs --root=$S --site=$S/_site`，
    而它抄下来的头行末尾没有「含 --verify 重算」。
    代价到集成那一轮才显形：SP4 刀3 `7ac2723` 改了 6 篇**正文**，`_data/modified.yml` 却停在发版前的 45 条，默认档一路绿；
    换成 `--verify` 立刻退 1 报「与 git 历史推导的结果不一致（表已腐烂）」。**本轮起收口链固定用 `--verify`**——
    认头行末尾那五个字「含 --verify 重算」：没有它，台账里那句"SEO 全绿"就不算跑过这一道。

### 9.7 两道 Chrome 门禁实情

| 道 | 跑之前的 1 分钟负载 | 退码 | 打印 |
| --- | --- | --- | --- |
| `verify-motion-batch4.mjs` | 3.42 | 0 | `# 通过 93 项，红 0 项` |
| `verify-nav-touch.mjs` | 3.42（同一遍驱动里紧随其后） | 0 | `✓ 移动端下拉点按门禁：判据 77 条 红 0 条 · 牙齿 10/10 组变异如期点名` |

两道都在负载门之内（阈值 16），**没有拒测，也没有现场归因**——这一遍一次过，没有「重跑了一次就绿了」这种事。
起草那一版实测的 `load1` 是 17.9–20.9（并行会话在跑浏览器工装），所以 §6.4 的台账本来就只能在执行阶段抄；
真正跑起来是在低负载窗口，同一窗口里 `tools-browser` 收轮时自报 7.7、牙齿那本开工时 7.73——
这两个数是它自己打印的，不是我从别处搬来的。

**集成轮（合并树 `6b9746c`、同一份 `_site`）补一条实情：`⌘K 面板·退场` 那一格的红是量具的采样窗口，不是产物。**
同一棵树上连着跑，只有密度那一列在动：

| 跑之前的 1 分钟负载 | 密度那一格 | `⌘K 面板·退场` | 合计 |
| --- | --- | --- | --- |
| 5.57 | `✓ 采样密度 — 129 帧 / 304ms，中间取值 11 个` | ✗ 全程没有「还渲染着但已离开终值」的帧（共 258 帧） | `# 通过 92 项，红 1 项` |
| 4.33 | `✓ 采样密度 — 148 帧 / 300ms，中间取值 11 个` | ✗ 同上（共 216 帧） | `# 通过 92 项，红 1 项` |
| 2.59（收口那一把） | `✓ 采样密度 — 273 帧 / 300ms，中间取值 15 个` | `✓ 中间帧 37 个 / 共 640 帧，首帧 t=107 op=0.127` | `# 通过 93 项，红 0 项` |

另有三把连密度门都没过（113 帧、88 帧、109 帧——最后那把是拿 main 工作树 2026-10-01 那份 `_site` 做的基线归因尝试，
于是没产出 A/B 判定）。那是这一本按设计的 `exit 2` 拒测，不产出判定。

可采样的窗口到底有多宽，是用只读探针量出来的形状（探针 = 把 `verify-motion-batch4.mjs` 拷到临时目录、
`tail()` 换成打印整条轨迹、`⌘K 面板` 那一格之后 `process.exit(0)`；仓库里那本一字未动）：
密度 179 帧/300ms 那一轮共 515 帧，按每 12 帧取一格的刻度读作
`t=13 … 192 每格都是 op=1 disp=flex rend=1` → `208:0.127` → `219:0.08` → `240:0.047` → `261:0.024` → `286:0.002` → `304: op=0 disp=none rend=0`。
**Escape 之后前约 190ms 一直读到 `op=1`，真正落得下样本的只有 t 约 200–300 这约 100ms，而 `--dur-2` 标称 200ms。**
密度低时这一百毫秒有概率一个样本都不落，那一格就报「全程没有中间帧」——它报的是量具，不是浮层。
同一条判据在密度 199 帧那一轮只读到 1 个中间帧（`首帧 t=246 op=0.08`，刚好踩在 `midFade` 的 0.05 下界上）就转绿，
这个「刚过」也记在这儿：它说明 120 帧/300ms 那道密度门对**这一族只有约 100ms 的窗口**还不够。
前约 190ms 为什么恒读 1、窗口为什么只有标称的一半，本轮没查清也不在本轮范围；
两条候选（合成器持有 `opacity`、主线程 computed style 只在帧提交时才更新；或 `close()` 真的过了约 190ms 才落地）都没被证伪。
**移交**：这一格要稳，得把判据从「采到的 opacity 有没有中间值」换成读 `el.getAnimations()`（那条 transition 在不在、`currentTime` 走没走），
或者按层实测窗口宽度再定密度门槛；本轮没动这条判据。

顺带记一条量具自己的坑（改探针时踩的）：给 `sampleOnce` 加上 `tp/td/an/hid` 四个字段后读数仍是 `undefined`——
因为 `traceAfter` 是按名挑字段往 `out` 里塞的（`out.push({ t: Date.now() - t0, op: s.op, disp: s.disp, rend: s.rend, tr: s.tr, top: s.top, h: s.h })`），
上游多读的那几格不经过这一行就到不了判据。**加一路读数要改两处**，而它不会红、只会静默给你 `undefined`。

### 9.8 未做与移交

1. **7 格无牙的账**（§5.2 末段那张矩阵，价钱逐格写在计划 Task 10 Step 8.6）：`描述` ⑤（要造一次重复）、
   `词表` ⑦（形状判据，A9 之后不会自然长出悬空）、`内链` ①（计数判据，由 ② 的 M12 覆盖）、
   `内链` ③/④（防的是未来堆链与「点这里」，此刻没有对应现实形状）、`目录` ②/④（靶子要么是唯一那篇
   `qqweiboshare`、要么落在本批禁改的 `dev/js/editorial.js` 上）。
   24 个新格子里 17 格有牙、7 格没牙，**这是选择不是漏项**。
2. **`dev/js/editorial.js` 那处 0.04317 的揭示位移**：两棵树同值、与本批无关，但它是 jdp 这类长文页面上
   唯一一笔非零 CLS。归动效那一届处理（要么预留高度，要么把揭示改成不改变布局位置的形态）。
3. **`firstActionSel = toc-static-link` 没有真鼠标背书**：探针量的是「DOM 里存在可跳锚点 + 视口真的动了」，
   静态块在 JS 开着时是 `display:none`。要做真命中，得先设计一个不被 `has-js` 收起的可见入口——那是新功能，不是本批的账。
4. **`article-check.mjs` 那四格的迁移**（§7.2）：它进 `main` 之后，A4「数字不许凭空」应搬到那儿，
   `check-seo.mjs` 的 `描述` ④ 同时降级为回归哨兵。它与 `scripts/lib/post-meta.mjs` 现在都在主工作树
   **已暂存未提交**（并发会话持有）。
5. **`check-seo.mjs` 自己的 front matter 读取器**应换成 `scripts/lib/post-meta.mjs`（同一处逻辑两份实现，
   M18 那一族的判据以后要跟着两份改）。
6. **`tags.html` 的 8 枚消失锚点**（§7.1）：A9 让 8 枚标签的 `id` 不再存在、新长出 1 枚。
   站外分享过的旧地址没有 301 可用（Pages 静态站），这一格只能是**已知风险**，不是待办。
7. **`index-all.html` 那句「无脚本」claim**：那页写着不依赖 JS，而它自己的 `?q=` 检索是要 JS 的。
   与 §9.5 第 4 条同类（过期注释/过期文案），但它不在本批四刀范围内。
8. **`og-images.mjs` 两个「表条数」口径差**：`--check` 打 **68**（校验看的是该有的卡片），
   生成模式打 **80**（生成看的是全部文章）。§6.1 与 §9.7 引的是 `--check` 那个 68，别混。
9. **`_config.yml:27` 的 `site.keyword`** 是死配置——但死的是「渲染」不是「读取」，**别顺手删这一行**：
   没有任何模板输出它（`grep -rn "site\.keyword" _includes _layouts` 只剩 `seoMeta.html` 里两句说明文字），
   而 `check-seo.mjs` 的 `keywords` 组拿它当**禁串 needle**（`String(config.keyword)` 扫产物，判据文本
   `site.keyword 原串仍出现在`，牙是 `check-seo-teeth.mjs` 那把 `site.keyword 原串在产物里回潮`）。
   删掉它 `config.keyword` 变 `undefined`、needle 变成字面量 `undefined`，那条扫描会去点 221 个产物文件
   （实测：照 `check-seo.mjs` 那套扫法——`_site` 下 `.html/.xml/.txt/.json/.js/.css/.md` 且 <4MB，数 `.includes('undefined')` 的命中）
   报「原串仍出现在…」——红是红了，量的却已经不是这件事。本批不碰 `_config.yml`。
10. **SP2 / SP3 两条分支的合并次序**：SP3 尖 `8122f9c`、SP2 尖 `bab6051` 都未合。
    SP2 先合的话，`verify-tool-url.mjs` 自动进本批台账（表 A 多一行、`收录面牙` 那行的数会跟着涨，
    那是 SP2 的 `urlState` 组带来的，不是 SP4 动的）；合并后必须重跑 §6.4 全量。
11. **B3 每页 CSS 拆分**（第 6 项决策 deferred）与 **A8 的 CSS 侧只写了「JS 开着就收起」**：
    静态块与 JS 目录并存的那一档（`has-js` 但 `editorial.js` 抛错）没有实测过，属于 B3 落地时才需要回答的问题。
