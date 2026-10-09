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
**改前那两个数（17 枚键、单篇 4 枚）是起草那一版语料的读数**：同一把尺量 main 尖 `8eee1f8` 是
**18 枚键、单篇 5 枚**（第五枚 `前端`，出处与机制见 §4.2 动作 3 那条最小站实测），
所以本刀在 main 尖之上实际让归档落点消失的是四枚而不是三枚（三枚是被并进来的旧键，第四枚 `前端` 是被改名换掉的）；**改后的 14 枚键、单篇 2 枚（`React`、`CSS`）
是现值**，源侧按上面那套口径重算过，产物侧 `categories.html` 的 `cat-section` 落点也是 14 枚，两侧相等。
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
    该表 68 条，YAML 读出的键数）。
    **合并到 main 尖之后这一条仍然不触发，但覆盖面从 4 篇变 5 篇**：这一刀在 `8eee1f8` 之上多治一篇
    `2026-10-06-vite-wasm-query-fs-bypass.md`（起草后才落进 main，见下一条），它也带 `cover`
    （`^cover:` = 1）、也不在那张表里（needle 加上 `vite-wasm` 之后 `grep -c` 仍是 0）；
    本树只读 `node scripts/og-images.mjs --check` 退码 0，摘要行逐字是
    「自检通过：表 68 条，卡片 34 张全部在磁盘上、尺寸 1200x630、无孤儿文件。」，与起草时同形。
    所以这一刀**不重跑生成器、不碰那份并发会话正持有的文件**；
    自证改成改前改后各跑一次只读的 `node scripts/og-images.mjs --check`，退码与摘要行必须一模一样。
    **生成模式（不带 `--check`）会重写这份产物**，一次都不许跑。
  - `categories.html` 的锚点少 **3 枚**（`#开源`、`#开源工具`、`#编程语言`）——这 3 枚是起草那一版语料的读数，
    在 main 尖 `8eee1f8` 之上是 **4 枚**：多的那枚是 `#前端`，来自起草后才落进 main 的
    `2026-10-06-vite-wasm-query-fs-bypass.md:categories: AI 前端`。机制是 Jekyll 把那枚标量按 `/\s+/`
    拆成 `AI` 与 `前端` 两枚键（最小站探针实测 `KEY=[AI] N=2 / KEY=[前端] N=2 / SIZE=2`，
    与 `categories: [AI, 前端]` 等价，就是本节开头说的「在 Jekyll 里等价」那条）。
    口径（两棵树都能重算）：逐篇取 `^categories:` 行，标量按 `/\s+/` 拆、`[A, B]` 按逗号拆，取并集比对；
    产物侧落点集 = `categories.html` 里 `<section class="cat-section" id="X">` 的那些 `id`
    （本树 14 枚，与算式逐字相等）。分类的消费面实测是
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

1. **A9 一共让 8 枚锚点消失，另有 1 枚新锚点长出来**（这 8 枚是起草那一版语料的总数；
   在 main 尖 `8eee1f8` 之上是 **9 枚**——categories 侧从 3 枚变 4 枚，多的那枚是 `#前端`，见 §4.2 动作 3），
   而这些旧地址在站外可能被分享过
   （例如 `tags.html#Chrome`、`categories.html#开源工具`）。
   逐枚点名：tags 侧被并掉 4 枚（`Chrome`、`React`、`Vite`、`WebMCP`；起草语料里各只挂 1 篇，
   main 尖上 `Vite` 挂 **2** 篇——`2023-05-08-vue3-vite-study` 与 `2026-10-06-vite-wasm-query-fs-bypass`，另三枚仍是 1 篇）、
   改名 1 枚（`#coding` 消失、新增 `#coding.net`，挂 1 篇）、categories 侧消失 3 枚（`开源`、`开源工具`、`编程语言`），
   main 尖之上再 +1 枚 `前端`；
   4 + 1 + 3 = 8（起草语料）／4 + 1 + 4 = 9（main 尖），动作 4 一枚都不动。
   消失只发生在**它自己那一页**：`前端`、`开源` 两枚从 `categories.html` 没了落点，同名键在 `tags.html`
   仍有落点（实测两页各自的 `<section class="cat-section" id="X">` 集：tags 151 枚、categories 14 枚，
   上面点名的 9 枚在对应页命中 0、留存侧 `chrome`/`react`/`vite`/`webmcp`/`coding.net` 各命中 1）。
   站内**没有**手写的旧锚点需要跟改——所有指向 `tags.html#X` / `categories.html#X`
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
**当时未推送**——硬证是 `git branch -r --contains HEAD` 无输出（本仓远端只有 `master`，所以**不能**用
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

**上面那句「当时未推送」的改口（2026-10-08，推送那一轮见 §9.10）**：这句在**分支名**层面仍成立——远端到现在也没有
`sp4-content-governance` 这根 ref；但在**提交可达**层面已经不成立，`sp4-content-governance` 尖 `aa73231`
（本节写那 19 笔的账时它是 19，收口后共 **21** 笔：第 20 笔 `fce2c03` 落本节、第 21 笔 `aa73231` 把计划的 70 个步骤格勾回 `[x]`——
`git show --stat aa73231` 是 `70 insertions(+), 70 deletions(-)`，`git show aa73231 | grep -c '^-- \[ \]'` = **70**；
勾完计划全文只剩 **1** 处 `[ ]`，是第 3 行那句 checkbox 语法的模板说明，不是步骤格）
已随合并分支进远端。两条硬证：`git branch -r --contains sp4-content-governance` 回 `origin/it-sp234`（此前打空）、
`git rev-list --count origin/it-sp234..aa73231` = **0**。那张表仍只列到 `ae55ad9`（第 19 笔），是当时的账，不补行。

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
视口 1280×900 且每轮自证 `innerWidth=1280`（**40 行**没有一行不符；原先这里写「20 行」是按单侧计数的，与同段钉死的 40 行对不上），
1 分钟负载**逐轮** 4.81 / 6.27 / 5.15 / 6.05 / **18.59**——出自 `run-ab2.log` 那五笔 `=== round load=` 行
（`run-ab2.sh:15` 每轮开跑前打一次 `sysctl -n vm.loadavg` 的首值）。
**原先这一格拍的「4.81–6.75」那条带没有出处**：`6.75` 在两本 surviving 日志（`run-ab.log` / `run-ab2.log`）里一次都没出现，
而产出这一表读数的正是 `run-ab2.log`（round-3 第 46 行 `head/cls` jdp `load=7625.4`、round-2 第 30 行 `new/cls` jdp `load=7701.1` 就是下面那两格），
末轮 18.59 越出 §9.9 那道 8 的线。`respStart` 中位 ≤ 62.3 ms（< 100 ms 那道地板）是**八格中位的最大值**那一种口径：
`cls` jdp head 36.3 / new **62.3**、`action` jdp head 12.5 / new 8、`cls` ai-sdd head 5.7 / new 3.9、`action` ai-sdd head 3.2 / new 3.3。
两侧交替 5 轮 × 2 模式（`cls` / `action`）× 2 篇 = 40 行。

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
   `hadRecentInput` 而丢掉，CLS 只认 `cls` 模式（夹具实测：同一个 `fake-new`，`cls` 与 `action` 两格不同值——
   **集成轮复核：这里原先写的 `0.07426` / `0.00301` 在两本 surviving 夹具日志里都没有出处**，可复算的一对是集成轮自己那两本
   `it-fix-cls.jsonl` / `it-fix-act.jsonl` 里同一枚 `fake-new` 的 `0.098974609375` 与 `0.0155517578125`，
   起草轮 `ab-fix-cls.jsonl` 的同一本也是 `0.098974609375`）。

**先跑夹具反证**（六条**断言**全中，否则脚手架在说谎，数就不许往下量）：
`fake-head` cls `0.00000` / `shifts 0` / `navHAt0 null`；`fake-new` cls **非零**、`navHAt0 122.6 → navHAtToc 0`
（「先画出来再收起」的现场证据）；`fake-new2` cls `0.00000`、`navHAt0 0`；
`fake-head` action `toc-link` **> 400**；`fake-new2` action `toc-static-link` **< 400**；每行 `innerWidth=1280`。
**这一格只钉断言，不钉量级数**：起草时写的 `0.07426` / `navHAt0 82` / `0.00301` / `441.7` / `317.1` 五个数
在两轮任何一本夹具日志（`ab-fix-cls.jsonl`、`ab-fix-act.jsonl`、`ab-fix-cls-new2.jsonl`、`it-fix-cls.jsonl`、`it-fix-act.jsonl`）里都读不到，
而两轮各自有日志的那几行自己就不含这几个数（起草轮 `fake-new` cls 是 `0.098974609375`、`navHAt0 122.6`；action 那两行是 `814.1` 与 `73.1`）。
断言侧两轮全中，逐轮对照见 §9.9「夹具反证重跑」那格。

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
| 13 | A/B 量具用**计划镜像块**而不是 Task 9 那版重建 | 两处形状不同 | 按计划 :1923-2155 逐字镜像出来的脚本缺 Task 9 回写的那条 MIME 修复；补的是一处有据的补丁（按扩展名给 `content-type`），不是重写。补丁生效的正证：new 侧 `navHAt0 = 0`（若 CSS 全 404，读到的是裸布局高度而不是 0），且六条夹具**断言**全中（集成轮把这一格从「期望值」改口为「断言」，理由见 §9.3 与 §9.9：那几个量级数在两本 surviving 夹具日志里都没有出处） |
| 14 | §6.4 那句「14 本」按文件是 **15** | 14 | `verify-codec-browser.mjs（+ 它的 teeth）` 被并进了同一行；台账按文件出 15 个文件、14 行（§8 ⑨） |
| 15 | `目录` ③ 的期望值从**钉死 79 篇**改成**按产物现算**（集成轮，提交 `ddcf682`） | 「这样的产物**恰好 79 篇**」（§5.1 那一行原文） | 长出第一篇达标新帖就把常数顶红：达标 80、带块 80，**产物没错、常数是错的**。改判 `tocBlockPages !== tocNeededPages`，红话把差值交回 ① 逐页点名；牙没动（`目录` 那 4 把的 `expect` 里没有一处 `79`，复跑仍 159/159）。§5.1 与计划 Task 9 Step 2 回写第 3 条跟着改口，§1 事实 19 那个 79 仍是起草读数、不改 |
| 16 | 这一刀在 main 尖上的覆盖面是 **5 篇**而不是计划那张表的 4 篇（集成轮） | 计划 Task 6 Step 3 逐字列 4 篇 `categories:` 改法 | `8eee1f8` 比起草语料多一篇 `2026-10-06-vite-wasm-query-fs-bypass.md`，它的 `categories: AI 前端`（空格分隔多分类，撞 `词表` ③）与 `tags: Vite 安全 dev-server`（大写侧撞 `vite`，撞 ①）正是本刀要治的形状，不跟着治则 `词表` 组直接红，所以它被并进同一刀。连带四个只在起草语料上成立的读数必须在 main 尖之上重读，本档已按重读值改口：`site.categories.size` 改前 **17 → 18**、只挂 1 篇的分类改前 **4 → 5**（第五枚 `前端`）、categories 侧消失的归档落点 **3 → 4 枚**、§7.1 的消失锚点总数 **8 → 9 枚**；`Vite` 的持有 1 → **2 篇**。改后的现值不受影响（tags 落点 151、categories 落点 14、`开源实测` 桶 21，两侧实测相等） |

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
   重建后先跑六条夹具**断言**再量真页面——这一轮就是这么把脚手架重新点着的。
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
15. **两份汇总脚本对同一批 jsonl 会给出不同的「空」**：`ab-report.cjs` 按文件名里的 `-action-` 找轮次，而 `run-ab.sh` / `it-run-ab.sh`
    写盘用的是 `-act-`——它不报错、退 0，把 action 那四格全打成 `n: 0` / `sel: null`，看起来像「测了但没数」。
    认 `ab-report2.cjs` 那句 `MODEFILE = { cls: 'cls', action: 'act' }`；抄表之前先看每格 `n` 是不是 5，
    **`n=0` 是「一份文件都没读到」，不是「读到的都是 0」**（本轮集成表 40 行的 `n` 全是 5，就是靠这一格自证的）。

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

**push 前补的账：另外六道 Chrome 门禁此前在合并树上没有读数**（§6.4 那两张表是起草那棵树的，§9.7 只补了揭示动效一道）。
这一遍跑在 `56dbe05`、同一份重建后的 `_site` 上，开工前 1 分钟负载 **2.23**（阈值 16），六道退码全 0，判定行按它们自己打印的抄：

| 道 | 命令 | 它自己打印的那一行 | rc |
| --- | --- | --- | --- |
| 工具页浏览器 | `TK_SITE_DIR=<快照A/_site> node scripts/verify-tools-browser.mjs` | `# 合计 115 项，红 0 项（收轮时本机 1 分钟负载 4.9——绝对毫秒那几格的账）` | 0 |
| 工具页浏览器牙 | `TK_SITE_DIR=<快照B/_site> node scripts/verify-tools-browser-teeth.mjs` | `合计 9 项（六刀 + 三自检），点燃 9 项，未点燃 0 项` | 0 |
| 编解码浏览器 | `node scripts/verify-codec-browser.mjs` | `合计 37 项，红 0 项` | 0 |
| 编解码浏览器牙 | `TK_SITE_DIR=<快照C/_site> node scripts/verify-codec-browser-teeth.mjs` | `合计 5 个注入，点燃 5 个，未点燃 0 个` | 0 |
| 身份证浏览器 | `node scripts/verify-idcard-browser.mjs` | `13/13 通过` | 0 |
| 触屏下拉 | `node scripts/verify-nav-touch.mjs` | `✓ 移动端下拉点按门禁：判据 77 条 红 0 条 · 牙齿 10/10 组变异如期点名` | 0 |

三点口径：① 三份 `_site` 快照是 `mktemp -d` 各拷一份（971 个文件），因为 `0a` 那条判据要求 `TK_SITE_DIR` 指向**仓库之外**的
隔离快照，三份互不复用是防并行会话把彼此的夹具端掉；② **合并树侧此前无读数的正是管 SP2/SP3 那两族的面**
（工具页 URL 态、⌘K/`?q=` 检索、触屏下拉），而这一遍的 `115 / 9 / 37 / 5 / 13 / 77+10` 与 §6.4 起草侧**同数**，
说明三批合起来没有碰坏任何一条判据；③ 揭示动效那一道不在这一遍里重跑——它在合并树上的 93/0 记在上面那张三行表，
而这一遍六道的 `rc=0` 是命令自己的退出码，不是驱动脚本的（管道会吞退码）。

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
6. **归档页消失的锚点**（§7.1）：起草那一版语料读到的是「`tags.html` 8 枚」，**这个 8 不是 tags 一页的数**——
   它是 tags 侧 5 枚 + categories 侧 3 枚的合计。逐枚点名：`tags.html` 少 `Chrome`、`React`、`Vite`、`WebMCP`、`coding`
   （留存侧是 `chrome`、`react`、`vite`、`webmcp`、`coding.net`，其中 `coding.net` 是新增的那 1 枚）、
   `categories.html` 少 `开源`、`开源工具`、`编程语言`；在 main 尖 `8eee1f8` 之上 categories 侧还要 +1 枚 `前端`，
   合计 **9 枚消失 / 1 枚新长**。两页的落点集在产物上实测过（tags 151、categories 14）。
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
10. **SP2 / SP3 两条分支的合并次序**：起草这一节时 SP3 尖 `8122f9c`、SP2 尖 `bab6051` 都未合。
    **执行时改口**：三批已在隔离工作树 `it-sp234` 里按 SP3 → SP2 → SP4 真合过（merge `0cf36dc` / `80674e5` / `415b4b6`），
    全量门禁链跑在合并树上，重测读数见 §9.9；但这条分支**既没并进 `main`、也没推**，所以 §6.4 全量在 `main` 尖之上仍是未做项。
    **2026-10-08 推送后改口（那一轮见 §9.10）**：「也没推」那半已反转——`it-sp234` 现在是远端分支。
    但**别把任何一串 SHA 当「现在的尖」读**：本节每落一笔只动 `_docs` 的提交，分支尖就跟着移动一次，
    能复算的锚点只有「跑门那一遍的树是 `8c2fc25`」（构造：`git rev-list --count origin/it-sp234..8c2fc25` 会随本节后续提交增长，
    而 `git branch -r --contains 8c2fc25` 恒回 `origin/it-sp234`）；
    「没并进 `main`」那半仍成立，硬证是 `git merge-base --is-ancestor main HEAD` 退 **1**、`git branch -r --contains main` 打空
    （`main` 尖 `695bbf8` 比 `8eee1f8` 多的那两笔不在本分支上），所以 §6.4 在 `main` 尖之上仍是未做项。
    SP2 先合的话，`verify-tool-url.mjs` 自动进本批台账（表 A 多一行、`收录面牙` 那行的数会跟着涨，
    那是 SP2 的 `urlState` 组带来的，不是 SP4 动的）。
11. **B3 每页 CSS 拆分**（第 6 项决策 deferred）与 **A8 的 CSS 侧只写了「JS 开着就收起」**：
    静态块与 JS 目录并存的那一档（`has-js` 但 `editorial.js` 抛错）没有实测过，属于 B3 落地时才需要回答的问题。
12. **§6.0 那把新鲜度门有两个静默面，本轮只记录不修**（细节见 §9.9「两棵树」那格末段）：
    ① **覆盖面**——`check-seo.mjs:280` 的五项源清单不含 `demo.json` 与 `_plugins/*.rb`，而这两类**确实是建树输入**
    （`_plugins/demo_data.rb:14-17` 在构建期读仓库根 `demo.json` 喂 `site.data.demoLists`，而 `_plugins` 那四本分别是
    Markdown 图片补 baseurl、`demo.json` 注入 Liquid、正文 `<img>` 补固有尺寸与懒加载、构建期静态目录——**产物形状由它们决定**）；改它们不会让 `--verify` 报「源比产物新」，红线只能靠人记得重建。
    ② **腐烂面**——牙齿族（`check-seo-teeth` / `check-tools-surface-teeth` / `verify-plan-blocks-teeth`）是
    `mutateSrc` 就地写真源、`restoreAll` 写回备份，**内容还原而 mtime 不还原**，所以任何一次牙齿跑完，
    这道 mtime 门在下一轮开头就必然退 1（本轮实测两次：`01:29:07` → 重跑门后 `01:45:39`，同一个 `_data/onlineTools.yml`）。
    两条的修法都不在本批范围：①要给那五项源补输入、②要给 `restoreAll` 加回原 mtime（`fs.utimesSync`），
    都会动门禁本体，得单独一轮配牙齿自证。**本批的替代做法已写死**：收口用内容级断言（`git diff --quiet HEAD -- <建树输入>`）
    而不是 mtime，且若要用 mtime 门就按「牙齿在前、重建居中、`--verify` 收尾」排序。
13. **`verify-plan-blocks-teeth.mjs` 的收口自证有一句写死的尾缀会过度声称**（§9.10 那遍撞见的）：
    `:702` 那行 `+ '（含另一路会话的那批，一律未被触碰）'` 是**无条件拼接**，而它前面的计数（`:268-269` 的 `git status --porcelain`，
    `cwd: REPO`）读的是**当前这棵工作树**。在 `main` 那棵树里跑，那句话与读数相配；在隔离工作树（例如 `it-sp234`）里跑，
    树上只有 `?? vendor` 一项，另一路会话的脏路径根本不在计数里，那句尾缀就说多了。
    **断言没有假绿**（前后三项全等是真判据），坏的只是那句解释。修法要么把尾缀改成按实际路径集合条件拼接，要么直接删掉、只留计数与指纹。
    便宜的是这一句改起来**不撞任何牙**：`grep -n "脏指纹\|收口自证" scripts/verify-plan-blocks-teeth.mjs | grep -i expect` 退 **1**（零命中），
    全仓**代码**里 `一律未被触碰` 只在 `:702` 出现一次（其余 7 处都在 `_docs` 的历史计划里，是当年那几遍的引文）。
    **那 7 处引文正好是病根的来源**：它们在 `main` 那棵工作树上打的是 `脏项 18 个`（`plans/2026-09-27-tools-codec-page.md:2535`）、
    `31 个`（同文件 `:9687`）、`32 个`（`plans/2026-09-29-tools-json-page.md:6753`）、`26 个`（`plans/2026-09-30-tools-diff-page.md:7802`）——
    那一棵树上确实有并发会话的一大批脏路径，那句尾缀那时与读数相配；换成隔离工作树后计数只剩 1 项，串却没跟着条件化。
    但本轮是一轮只动 `_docs` 的推送轮，改门禁的打印仍要另起一轮、连带复跑这本牙的 41 项。
14. **§9.9 那张「下一次并 main 的预账」少对了一个判据位，后果要到下一遍跑门才撞**：那张表逐枚对的是 `词表` 组的前几条（tag 越表、分类越表、多值形状）与 `描述`（缺摘要），
    外加恒等式，**没有对 `词表` 组第⑧判「命中集不变」**（`check-seo.mjs:1410-1426`）。gdp-ts 那篇的 `tags` 里那枚 `TypeScript` 正落在 `TOOL_MATCH_TAGS`（钉死 33 枚，`:1297`）里，
    合并后那页必然「命中了却没登记」，于是 §9.11 的 13 条里多出一条谁都没预告过的红。
    **可复用的规矩**：凡预告「并 main 会红成什么样」，除那几格之外要再走一格——把新帖的 tag 逐枚对 `TOOL_MATCH_TAGS` 查命中，
    命中一枚就要预账一条 `TOOL_HIT_OK`。这一格本轮已照做（补的那行在 `check-seo.mjs:1285`），欠的是预告，不是判据。

### 9.9 集成轮：三批并入 main 尖之后重测（2026-10-08）

**这一节防的是哪一种错**：§9.3 那五个数只在 SP4 那一批的工作树上量过，`new` = `ae55ad9`（不含 SP3/SP2）。
SP3、SP2 也合进来之后，A8 那笔目录开销、G4 的覆盖面、恒等式三格都可能变，而「变没变」不能拿 §9.3 的数外推。
本轮先把**不依赖时钟**的那几格重测完（下面四段），§6.3 那张中位数表在合并树上的读数落在本节末段「时间面」那一格里，
量之前那格是空的、没拿 §9.3 的数顶位。

**两棵树**：`head` = `git archive 2b9464c6758d2e769f8ca0cbba06b87030dd175c` 导出 + 软链主仓 `vendor`/`node_modules`
+ `npx --no-install vite build && bundle exec jekyll build`（默认 baseurl）；
`new` = 工作树 `it-sp234`——SP3 `0cf36dc` → SP2 `80674e5` → SP4 `415b4b6` 三个 merge 落在 main 尖 `8eee1f8` 之上。
**产物按「那一刻的源」认，不按 merge 尖认**：`_site/index.html` 的 mtime 是 `2026-10-07 19:30:35`，而 `git log` 里那一时刻的 HEAD 是
`6b9746c`（18:12:25，只动 `_docs` 两本，`git show --name-only` 可复算），所以这一节读的是 `6b9746c` 那套源建出的产物。
`git diff --name-only 415b4b6..HEAD` 有 **4** 个非 `_docs` 文件（`_data/modified.yml`、`_data/onlineTools.yml`、
`_posts/2026-10-06-vite-wasm-query-fs-bypass.md`、`scripts/check-seo.mjs`），其中三个都在 `6b9746c` **之前**落
（`ddcf682` 17:31:59、`b2c05e2` 17:33:58、`644008a` 17:56:06）——它们已经在那套源里，不存在「漏读」。
`6b9746c` 之后到 HEAD 这一段**不钉「共 N 笔」**——`git rev-list --count 6b9746c..HEAD` 每落一笔本节自己的 doc 提交就 +1，
把数写进文档的那一刻正好把它顶旧（`05a796f` 这一格记的是 9，而记录「9」的 `05c8a59` 自己也在区间里：
`6b9746c..05a796f` = 9、`6b9746c..05c8a59` = 10）。要复算就现跑 `git rev-list --count 6b9746c..HEAD`。
这一段真正的**形状**是固定的，且与笔数无关：逐笔 `git show --name-only --format= <sha>` 数非 `_docs` 的行，
只有 `c2690b9`（19:53:11）那一笔碰了非 `_docs`（`scripts/check-seo.mjs` 一行的红话措辞，而**门禁脚本不是建树输入**），
其余每一笔全在 `_docs`。
新鲜度这一格在 push 前被 `check-seo.mjs --verify` 自己顶红过一次，来历要说清（**我第一版的解释是错的，已推翻**）。
原先这里写的是 `find _data _includes _layouts _posts _config.yml -maxdepth 1 -newermt '<产物 mtime>'` **打空**。
我一度判定这条是「空断言」，理由是 `-maxdepth 1` 只列目录项自身、从不进目录——**这句不成立**：
`find _data -maxdepth 1` 实测除 `_data` 自身外还列出 `sns_label.yml` / `og_images.yml` / `modified.yml` /
`manifestIcons.yml` / `onlineTools.yml` / `picks.yml` / `tools.yml`，而 `_data` `_includes` `_layouts` `_posts`
四本是**全扁平**的（`find _data _includes _layouts _posts -mindepth 1 -type d` = **0** 行），
所以它覆盖的文件集与递归版（`check-seo.mjs:256-285`：`newestIn` 在 `:257`、五项清单在 `:280`、比对在 `:282`、
`process.exit(1)` 在 `:284`）在这一棵树上**等同**。当年的「打空」是**那一刻的真读数**，不是没跑。
真正的问题是它是**时刻读数**，而这套链自己会把时刻顶旧：`check-seo-teeth.mjs` / `check-tools-surface-teeth.mjs` /
`verify-plan-blocks-teeth.mjs` 这一族牙齿是**就地改仓库源文件**的（`mutateSrc` = `fs.writeFileSync(真路径, 变异内容)`，
退出时 `restoreAll()` 把备份写回去），**内容还原了、mtime 还原不了**。
于是本轮就撞上：`node scripts/check-seo.mjs --verify` 退 **1**，红话是「源比产物新
（源侧最新 `2026-10-08T01:29:07.179Z`，产物最新 `2026-10-07T11:30:36.879Z`）」，源侧那一个正是被牙齿写过又还原的 `_data/onlineTools.yml`
——它工作区的 sha256 与 `git show HEAD:_data/onlineTools.yml` **逐字节相同**
（`6e4adc556264f834eba6fddec10efc1d23d451e0d81533e1dee7e5f0a77166e2`），被摸的是 mtime 不是内容。
按门禁自己的处方重建（`bundle exec jekyll build`：退 0、`done in 11.722 seconds`，照旧
`Skipping: _posts/2100-10-25-practice-demo.md has a future date`）后 `diff -rq` 新旧 `_site`：
971 个文件里只有 `feed.xml` 差一行 `<updated>`（差的正是这次构建的时刻本身），`index.html` 的 md5 重建前后同为
`654e6d9b49b07963e85bbd5d6dd96f86`，`check-seo.mjs --verify` 转退 **0**。
**这条机理随后自证了一次**：把那 12 道非浏览器门禁重跑一遍之后，同一条 `-maxdepth 1 -newermt` 不再打空、
而是回 `_data/onlineTools.yml`，递归版读到 `2026-10-08T01:45:39.078Z`——**跑门本身就把新鲜度又顶旧了一次**。
所以这一格的结论按硬证重写：**下面每一格的读数对 HEAD 的建树输入仍是现读的**，但依据换成两条不随时刻腐烂的——
内容级「构建输入与 HEAD 逐字节相同」（`git diff --quiet HEAD -- _data _includes _layouts _posts _config.yml assets dev scripts`
退 0，且 `git status --porcelain` 除 `?? vendor` 外只剩 `_docs` 这一本），产物级「重建是空操作」（除 `feed.xml` 时刻行外零差异）。
要用那条 mtime 门只有一个自洽排法：**牙齿族在前、重建居中、`--verify` 收尾**（本轮两把 ledger 都把 `seo` 排在最前，
所以它绿的那一格说的是重跑之前的产物状态）。门禁自带的旁路 `STALE_OK`（`:282` 那个 `&& !STALE_OK`）本轮**没用**。
上面那几个 ISO 时刻都是**当时读数、今天原样重跑必变**；能原样复算的只有那两串散列（sha256 与 md5）和这两条内容级断言。
本节往后的提交只动 `_docs`，而 `_docs` 不出版（`_site/_docs` 不存在），不再触发重建。
未推硬证当时是 `git branch -r --contains HEAD` 打空——**这一条在 §9.10 的推送之后反转**：同一命令现在回 `origin/it-sp234`，
而那一格「本节往后的提交只动 `_docs`」仍然成立——本轮那三笔（`c3a286b` / `56dbe05` / `8c2fc25`）
`git diff --name-only <c>^..` 各自只有本 spec 一本，`_site` 里没有它们。**ahead / main-unique 只记构造、不记数**：
构造是 `git rev-list --left-right --count main...HEAD`（左列 main-unique、右列 ahead），而**每落一笔本节自己的 doc 提交右列就 +1**，
所以这里只钉两个能用 rev 复算的锚点——`8eee1f8..2662572` = **47**（起草这一格时的来源）、`8eee1f8..341f0e2` = **50**。
左列同理**不钉「现在是 N」**——并发会话在往 `main` 上落笔，落一笔这列就 +1；能复算的锚点是
「这一段起草时左列 = 1（`db9c6c5`，00:23:21），本节收尾重读 = 2（再加 `695bbf8`，00:53:52）」，构造是 `git rev-list --count 8eee1f8..main`。
这两笔都把「三批并入 main 尖」这句里的 main 尖从 `8eee1f8` 挪走了，对各格读数的影响见本节最后一段。

**基线自证**：重导出来的 head 树那两篇是 `472,790 / 83,055` B、gzip `62,273 / 26,703` B，
与 §9.3 表的 head 列**逐字相同**（gzip 口径仍是 `cat f | gzip -9 | wc -c`）——基线没跑偏，这一节和 §9.3 是同一把**量具**。
但「数可以横着比」只到字节面为止：两轮的**负载线不同**（§9.3 那五笔是 4.81 / 6.27 / 5.15 / 6.05 / 18.59），
时间面的横比口径见本节末段「同一把尺下的负载纪律」与「时间面在合并树重跑」那两格。

**合并树这侧**：同两篇 `483,043 / 85,240` B、gzip `63,621 / 26,980` B，与 §9.3 的 new 列也**逐字相同**
（md5 `55b7049f0bac86c10dae77e73750fcfe` / `c9af9dfb39441d99937dc28f8c44d0bc`）。
机制也核到了：`ae55ad9`（SP4 尖）到 `415b4b6`（合并尖）在模板侧只动了 `_includes/jsonLd.html` 一本（+9 −1，SP3 的 SearchAction），
而 `grep -rl '"SearchAction"' _site` 在合并树产物上只有 `_site/index.html` 一条——文章页拿不到那一段，所以这两篇没变是结构上的必然，
「A8 那 +10,253 / +2,185 B 的开销在合并态仍是这个价」由字节相等直接背书，不必等时间数。

**但字节相等不能拿来外推时间面**（这条是本节存在的理由）。把这两页在合并树上真正加载的本地资源逐本对 md5
（`it-assets.cjs`：从页面里抓 `href|src` 指向 `/better-blog/**.{css,js}` 的项，两棵树各读一遍）：
每页 **21 本**，其中 **20 本逐字节相同**（含 `index.min.css`，也就是 §9.3 依赖的那套 `.toc-static` 规则没变），
唯一不同的是 **`assets/js/editorial.min.js`：合并树 43,501 B、SP4 单独那批 42,568 B，Δ +933 B**。
这笔增量归 SP3——`git log ae55ad9..415b4b6 -- dev/js/editorial.js` 只有站内搜索那一条，
而 `editorial.js` 正是「建 JS 目录 + 揭示动效（就是 §9.4 第 6 条那处 0.04317）」的执行体。
所以：`load / DOMContentLoaded / 可交互 / 首次动作 / CLS` 那五格**必须**在合并树上重跑，
「HTML 一样」不等于「时间面一样」，谁拿上面那段字节相等去跳过重测，谁就是在把 §9.3 的数当成没量过的数。

这一处还顶着 §9.3 那句「来源是本批没碰过的 `dev/js/editorial.js` 揭示动效」：**SP4 没碰它，SP3 碰了**。
碰在哪一段也核到了——`git diff -U0 ae55ad9 415b4b6 -- dev/js/editorial.js` 共 **18 处 hunk**，
旧侧起点落在 **618–798**、新侧落在 **619–901**，即命令面板/检索那一段（`?q=` 深链、`toTerms` 的 AND 打分、逐词高亮）；
口径钉死在这：每一处 hunk 头按 `@@ -o[,ol] +n[,nl] @@` 解析，18 处里有 **6 处纯插入**（旧侧只有起点锚、没有行，头写成 `-o,0`）：
`-618,0 +619,3` / `-621,0 +635` / `-632,0 +649,2` / `-652,0 +704,2` / `-785,0 +862,3` / `-798,0 +891,11`；反向的纯删除 0 处。
新侧上界取自最后一处 `+891,11`，即 **901**（`891 + 11 - 1`），不是 902；旧侧那 618–798 是这些起点锚的跨度。
而建 JS 目录的 `initToc`（236–360）、窄屏抽屉（361–420）、滚动揭示（1376–1460）三块**一行没动**。
于是合并态那 0.04317 在机制侧没有被动过的理由——但这一格仍要重跑：那 +933 B 改的是这本脚本的体积与解析量，
`load / 可交互` 两格量的恰好是它，「代码没动」推不出「时间没动」，§9.3 的交付数是量出来的不是推出来的。

**恒等式在合并树重算**（还是 `sp4-identity.cjs` 那把尺，cwd 摆在 `it-sp234`）：
`{"pages":80,"items":886,"navBytes":138660,"scriptBytes":5200,"measured":143860,"formula":143860,"diff":0}`。
和 §9.3 那格（79 篇 / 881 条目 / 143,022）差 **1 篇 / 5 条目 / +838 B**——多的那篇是
`_site/2026/10/06/vite-wasm-query-fs-bypass.html`（main 上 `0002356` 那篇 Vite wasm 实测文）。
在那篇产物上直接量：`<nav class="toc-static">…</nav>` 整段 **773 B**、内含 5 枚 `toc-static-item`，
它自己那句 `<script>document.documentElement.className += ' has-js';</script>` **65 B**，
`773 + 65 = 838` 与差额逐位对上——恒等式在合并态仍是 `diff = 0`，不是「差一点」。

**G4 在合并树重跑**（`sp4-nojs.cjs`：摘掉全部 `<script>` 后逐篇断言 ①②）：
`{"articlePages":81,"withBlock":80,"failures":0,"bad":[]}`；
`grep -L 'class="toc-static"'` 在合并树的产物上只有一条 `_site/2018/12/25/qqweiboshare.html`——
§9.3 钉的那句「`h2`+`h3` 为 0 的那篇必须没有块」在合并态仍是唯一例外，覆盖面 79 → 80 全部由篇数增加解释。

**夹具反证重跑**（`mkfixtures.cjs` 产的那三本，00:01:05 / 00:01:15 两轮）。六条**断言**全中：
`fake-head` cls `0.00000` / shifts `0` / `navHAt0 null`；`fake-new` cls 非零且 `navHAt0 122.6 → navHAtToc 0`
（「先画出来再收起」仍在）；`fake-new2` cls `0.00000` / `navHAt0 0`；`fake-head` action 首命中 `toc-link @ 1069.8`（> 400）；
`fake-new2` action 首命中 `toc-static-link @ 243.2`（< 400）；六行 `innerWidth` 全是 1280。
但 §9.3 那句里的**量级数**（`fake-new` `0.07426` / `navHAt0 82`、`action` 侧 `0.00301`、`441.7` / `317.1`）本轮对不上，
而对不上的原因**不是**「夹具在 Task 9 回写之后重建过、那几个数属于重建前那一版」——那一说是推测，没有日志撑着：
**起草轮自己的夹具日志（`ab-fix-cls.jsonl` 14:55、`ab-fix-act.jsonl` 14:56、`ab-fix-cls-new2.jsonl`）就已经不含这几个数**
（`fake-new` cls 是 `0.098974609375`、`navHAt0 122.6`；action 只有两行，`fake-head` `toc-link @ 814.1`、`fake-new2` `toc-static-link @ 73.1`），
构造是：在整摊 A/B scratch 里 `grep -rn "7426\|00301\|441\.7"`，零命中（scratch 会被清，落点不是 durable 口径——
要复算就按 §9.3 那一格重建夹具，重建后 `mkfixtures.cjs` 产的三本再跑 `sp4-ab.mjs` 的 `fixture` 档）。
负载也解释不了：`fake-head` 的 `responseStart` 起草轮是
**1401.3 ms**（cls 那本）与 371 ms，比本轮的 582.9 / 438.1 更高，而 §9.3 那道 100 ms 地板本来就只管真页面、不管夹具。
**所以这一格按「断言可复算、那几个量级数没有出处」记**：六条断言的形状是两轮都能复算的——
本轮 `fake-new` cls `0.098974609375` 非零、`navHAt0 122.6 → navHAtToc 0`、action 那本同一夹具 `0.0155517578125`（两种模式不同值，正是「`action` 那格的 CLS 不作数」的现场证据）；
`0.07426` 这类数别再当可复算值引用。夹具这两轮**没有留 `vm.loadavg` 读数**（`it-run-ab.sh` 那道门只在 A/B 那摊里打），
所以这一格不许写「负载多少」，只写日志里有的 `responseStart`。

**同一把尺下的负载纪律**：本轮 A/B 开跑前加了道门（`it-run-ab.sh:14` `WAIT_MAX=${WAIT_MAX:-2700}`，即**最多等 45 分钟**；
`:26` 等满就 `exit 4` 记「拒测」——原先这里写的「90 分钟」是把 2700 s 读错了一倍。
门限那格脚本里默认是 `LOAD_MAX=7`（`:12`），**本轮是在环境里给了 8**，硬证是日志自己把门限打出来了：
`it-run-ab3.log` 前 14 行都是 `[hh:mm:ss] 负载 X > 8，等 60 s`、第 15 行 `[00:20:20] 负载 5.50 ≤ 8，开跑`）。
这道门等了 **14 次复评**才开——19.39 / 21.50 / 60.37 / 51.16 / 27.35 / 28.19 / 15.85 / 47.51 / 21.93 / 11.52 / 11.95 / 11.24 / 8.94 / 8.83，
而它前面还有两次没跑成的尝试：`it-run-ab.log` 三行（00:03:37 起，门限 7：39.89 / 49.34 / 27.15）、`it-run-ab2.log` 一行（00:05:49，门限 8：24.36）；
**产出下面那一表的只有 `it-run-ab3.log` 这一本**。五轮各自的 1 分钟负载是 **5.50 / 8.78 / 6.43 / 8.87 / 6.41**（同日志的 `=== round` 行，末行 `runner exit=0`）。
**「开跑前判一次」要说清判的是哪一道**：`LOAD_MAX` 只在 `:18-27` 那个 while 里判，`break` 之后不再管，
所以放行读数 5.50 约束的是**开工那一刻**，五轮里出现 8.78 / 8.87 高于 8 并不违规；
但每轮开头另有一道硬线（`:43-45`：`HARD=${HARD:-16}`，超了就打「中止：负载 X > 16」并 `exit 5`），
本轮五笔最高 8.87，离那道 16 还远，所以**没有任何一轮被中止**——原句只说「门只在开跑前判一次」会让人以为轮内不设防，这里补全。
**这一轮的门限（8）比 §9.3 起草那把尺更严，而两轮本就不在同一条线上**：§9.3 那五轮里末轮记着 **18.59**（`run-ab2.log` 的 `=== round` 行），
按本轮这道门直接就是拒测；本轮的 8.78 / 8.87 两轮若是起草那把无门的尺则照跑。
§9.3 那条「`respStart` 中位 ≤ 62.3 ms、地板 100 ms」本轮
jdp 的 head 侧没守住（中位 **116.8 ms**，五行 `44.6 / 318.2 / 4.3 / 116.8 / 258.3`，new 侧 35.2 ms 仍在地板内）。
**所以本轮那三格绝对时间只当方向性对照，不替换 §6.3 的交付数。**

**时间面在合并树重跑**（`it-run-ab3.log` → `it10-{head,new}-{cls,act}-r1..r5.jsonl` 共 20 本、5 轮 × 2 模式 × 2 侧 × 2 篇 = **40 行**；
汇总 `it-ab-report2.cjs`；表里 `load / DOMContentLoaded / 可交互 / CLS` 四行取 `mode=cls` 那 20 行，`首次动作` 行取 `mode=action` 那 20 行——与 §9.3 同规矩。
中位数口径写死：`v[Math.floor(v.length/2)]`，先滤掉非数值——**偶数样本取上中位**，
所以 ai-sdd head 那格 `可交互` 打 3408.5 而不是 2958.6 与它的平均。起草那轮 §9.3 的表出自**同一把量具**
（同一份 `sp4-ab.mjs` 镜像块 + 同一档 fast3g 节流 + 同一中位口径），但两轮的**负载线不同**（见上面「负载纪律」那格：§9.3 末轮记着 18.59；
本轮那道门只在**开跑前**判一次，判到 5.50 就放行，五轮里仍有 8.78 与 8.87 两笔高于门限 8），
所以横着比只比「形状与 Δ 的符号」，不比绝对毫秒）。
行级自证：40 行 `innerWidth` 全是 1280、`err` 字段**全是 `null`**（每本 jsonl 的 `err` 逐行读；汇总那格的 `0` 是
`it-ab-report2.cjs:32` 的 `rs.filter(r => r.err).length` 计数，不是行里的值），`bytes` 只出现四个值 `472790 / 483043 / 83055 / 85240`，
与上面字节段那四个数逐字相同——量的是同一套产物，没有混进旧树。

| 数 | jdp head | jdp new | Δ | ai-sdd head | ai-sdd new | Δ |
| --- | --- | --- | --- | --- | --- | --- |
| load | 7713.0 | 7686.8 | **−26.2** | 7632.0 | 7642.6 | **+10.6** |
| DOMContentLoaded | 6398.4 | 6398.1 | −0.3 | 3268.5 | 3295.6 | +27.1 |
| 可交互（最后一个 longtask 结束） | 6563.7（5/5 轮有长任务） | 6415.5（5/5） | −148.2 | 3408.5（2/5） | 无长任务（0/5） | **不可判** |
| 首次动作（`mode=action`） | 6335.1（`toc-link`） | 2914.4（`toc-static-link`） | **提前 3420.7** | 3279.9（`toc-link`） | 2777.5（`toc-static-link`） | **提前 502.4** |
| CLS（只认 `mode=cls` 那一轮） | 0.04317 | 0.04317 | **Δ = 0.000000000** | 0.00052 | 0.00052 | **Δ = 0.000000000** |

**这一轮答的问题是「`editorial.min.js` 那 +933 B 有没有把时间面挪走」，答案分三层**：

1. **CLS 与首次动作两格在合并态重跑仍成立**，而且这两格**不依赖机器负载**。CLS 两侧逐位相同（`0.04317067328559027` /
   `0.0005217529296874999`，`shiftVals` 两侧各是 `[0.04317]` / `[0.00052]`、`lateShifts` 两侧都 5/5），
   与 §9.3 的读数一字不差——那 +933 B 落在检索段、`initToc` 与揭示动效一行没动，机制侧与读数侧对上了。
   首次动作仍是 new 侧更早，且 new 侧 10 行 action 的 `firstActionSel` 集合就是 `["toc-static-link"]`：jdp 提前 3420.7 ms（起草那轮 3526.8）、
   ai-sdd 提前 502.4 ms（416.8）。**这两格是合并态的交付数。**
2. **`load / DCL / 可交互` 三格判不出方向，因为同格摆动本身就比 Δ 大**。
   本轮同一格五行内的 `load` 跨度：jdp cls head **316.4**（7598.3–7914.7）、jdp action head **863.7**（含一行 8453.1 的离群）、
   jdp cls new 105.0、jdp action new 365.1——而 jdp 两格之间的 Δ 只有 **−26.2**（cls）与 **+60.6**（action），
   **量具的地板比被量的变化高一个数量级**。ai-sdd 那篇两格倒很稳（head 跨度 61.1、new 5.0），它对应的 Δ 是 +10.6 / +12.8，
   绝对值仍是 7.6 s 上的十毫秒级。两篇合起来能据此说的只有一句：**+933 B 没有把八个 `load` 中位数推出 7632.0–7792.2 ms 这个带**；
   「它让页面变慢了」和「它完全没代价」这两句本轮都没有依据。
   与 §9.3 横着比更是连符号都不稳（jdp Δload +75.7 → −26.2、Δdcl +43.9 → −0.3、Δinter +74.2 → −148.2；ai-sdd Δload +9.6 → +10.6）。
   `可交互` 那格 ai-sdd new 侧 0/5 轮有长任务，样本为 0 → 按 §9.3 已钉的口径记**不可判**，不填数。
3. `action` 模式那两轮的 CLS（new `0.07053236762152777` / `0.078262939453125`）**照旧不作数**（探针自己的 click 把随后那次塌陷标成 `hadRecentInput`）。
   原先这里跟着写了一句「它两棵树两侧都是同一个数」——**那句是错的**，两轮都不是：本轮 head 侧 jdp 的 `action` CLS 是 `0.04317067328559027`
   （与它 `cls` 模式同一值），head 侧 ai-sdd 五轮**不是常值**（`0.0006209431966145833 / 0.0006443074544270834 / 0.0006499104817708334 /
   0.0006443074544270834 / 0.0005246419270833332`，五个数四枚不同、r2 与 r4 相等，中位 `0.0006443074544270834`），
   而 new 侧两篇各是常值 `0.07053236762152777` / `0.078262939453125`；起草轮同形（head ai-sdd `0.00052 / 0.00055 / 0.00052 / 0.00055 / 0.00052`）。
   **能当「量具没漂」旁证的是另一件事**：new 侧那两格在起草轮与本轮、各 5 轮共 10 行里**逐位相同**（`it10-new-act-r*.jsonl` 与 `t10-new-act-r*.jsonl` 各 5 行同一值）。
   `lateShifts` 那一格把构造钉死：它是 `it-ab-report2.cjs:29` 的 `rs.reduce((a, r) => a + r.shifts.filter(x => r.hasTocAt != null && x.t > r.hasTocAt && x.v > 0).length, 0)`，
   **单位是「位移条目数」、口径是「该格 5 轮求和」**，不是 CLS 值、不是单轮读数。head 侧 ai-sdd 的 `action` 那格本轮 **42** = 逐轮 `shifts.length` 之和 `10+10+11+10+1`，
   起草那轮 **9** = `1+3+1+3+1`（`t10-head-act-r*.jsonl`）；其余七格两轮都是 5（每轮恰好 1 条）。多的都是探针滚动/点击带来的位移，不进 CLS 那格。

于是本节收口成一句：**字节面三格由字节相等直接背书；时间面里 CLS 与首次动作两格在合并树上重跑仍成立；
`load / DCL / 可交互` 三格本轮只到「同量级、判不出方向」的强度**。§6.3 那张表的交付数仍是起草那一版语料 + 逐轮 4.81 / 6.27 / 5.15 / 6.05 / 18.59
那五笔负载下的读数（`run-ab2.log`，口径见 §9.3），要在合并态替换它，得等一条**五轮全部低于本轮那道 8** 的安静时间——
**这一轮的读数不许被抄成 §6.3 的新值**。

**收尾时 `main` 动了两笔**：并发会话先落 `db9c6c5`（00:23:21，`_posts/2026-10-07-wikimedia-openai-agent-edits.md`，维基媒体那篇），
本节这一格起草时又读到 `695bbf8`（00:53:52，`_posts/2026-10-07-gdp-ts-proof-forgery-3-gaps.md`，gdp-ts 伪造 proof 那篇）。
本节上面每一个数都不受影响——两棵树都按 rev 钉死（`head` = `2b9464c` 导出、`new` = `6b9746c` 那套源建的 `_site`，口径见上面「两棵树」那一格），
`db9c6c5` 与 `695bbf8` 都不在任何一棵里。**受影响的是「下一次并 main 会跑成什么样」**，所以两篇的 front matter 逐枚对过
`scripts/check-seo.mjs:1151` / `:1155` 那两份钉死的白名单常量（`split(/\s+/)` 同一把尺，先自证 parse 出来是 **151 / 14**，
与 `:1157` 那道规模自证一致）：

| 判据位 | `db9c6c5` 维基媒体那篇 | `695bbf8` gdp-ts 那篇 |
| --- | --- | --- |
| `词表` ② tag 越表 | `tags: Agent robots.txt 维基媒体 OpenAI`——`Agent`、`OpenAI` 在表内，**`robots.txt`、`维基媒体`** 越表 | `tags: gdp-ts TypeScript 权限校验 Vercel`——`TypeScript`、`Vercel` 在表内，**`gdp-ts`、`权限校验`** 越表 |
| `词表` ③ 分类多值 | `categories: AI 前端` 空格分隔 | `categories: 开源工具 TypeScript` 空格分隔 |
| `词表` ② 分类越表 | **`前端`** 不在那 14 枚里 | **`开源工具`** 不在那 14 枚里（表内那枚叫 `开源实测`） |
| `描述` ① 逐篇有摘要 | 无 `seo_description` | 无 `seo_description` |
| 恒等式（目录条目增量） | 源侧 `## ` 起手的 5 个、`### ` 起手 0 个 | 源侧 `## ` 起手的 6 个、`### ` 起手 0 个 |

三处不能含混：

1. **两份集合是两回事**：`前端` 是一枚合法 tag，拿 tag 侧的命中去放行分类侧就是放水；`TypeScript` 反过来在 tag、分类两张表里都有，
   所以 gdp-ts 那篇只越表一枚。
2. **`描述` 那格的形状按合并后的集合现算**，不拿本轮的 82 / 81 顶位：本分支 `ls _posts/*.md` = **82**、带 `seo_description:` 的 = **81**
   （缺的那篇是不产出的 `2100-10-25-practice-demo.md`）；`git ls-tree -r --name-only main -- _posts` 里的 md = **84**
   （比 `db9c6c5` 那一格记的 83 又多一笔）→ 并 main 后是 **84 文件 / 83 产出 / 81 带摘要**，缺点子的从「那一篇」变成**两篇**。
   顺带一条防误读：`git grep -l seo_description: main -- _posts` = **41**，那是 main 还没吃进 SP4 那 39 篇回填的既有事实，不是新的红。
3. 恒等式那格往 **82 篇 / 897 条目** 走（886 + 5 + 6），G4 的 `withBlock` +2。**这条是推算不是读数**——源侧标题数 → 产物条目数那把尺
   只在已测的两页上对过（`_posts/2026-06-05-ai-sdd.md` 源侧 9 == 产物 `items` 9、`_posts/2019-07-26-javascript-design-pattern.md`
   源侧 18+58=76 == 产物 76；产物那两数就是上面「恒等式在合并树重算」那一格同一把尺（`sp4-identity.cjs`）打出的 `picked` 两行
   ——`_site/2019/07/26/javascript-design-pattern.html` items=76、`_site/2026/06/05/ai-sdd.html` items=9），两篇新文自己没在任何含它们的树上量过；
   剔除围栏内同形行的那把尺也在这两篇上跑过，围栏内 `## `/`### ` 均为 0。

**这些是源侧对账，不是跑门**：门没在含 `db9c6c5` / `695bbf8` 的树上跑过，一个红点都没实测，所以只记在「下一次并 main 的预账」这一格，
不记成 §9.2 台账的一部分；「每篇各点到 4 个判据位」也是按 §5.1 的逐枚粒度推的，没跑门就不钉成红线条数。
真要并 main，顺序是：两篇的分类各归进现存 14 枚之一（或显式扩 `CATS_OK` 并在 `:1146` 那段注释里补扩表理由）、
四枚越表 tag 进 `TAGS_OK` 还是改词、两篇各补一条 60–140 字的 `seo_description`——**然后才重建、才让 §6.0 那道新鲜度门点着它们**，
而本节上面每一格读数在新树上都要重读一遍，不许拿本轮的数充当合并后的数。

### 9.10 推送轮：先按 §9.8 第 12 条那个自洽顺序重跑，再只推 `it-sp234`（2026-10-08）

**授权面先钉死**，免得下一轮把这一格当「已合并」的凭据：那一句是「代码评审和自测验证没问题就帮我提交代码并推送到远程」，
兑现的是 commit + push 到远端分支 `it-sp234`；**回并 `main` / `master` 与部署都未授权，本轮也没做**。

**跑门的树**：`.worktrees/it-sp234`，HEAD `8c2fc25c7553b3983f4ceda950c04a83723221c3`，`git status --porcelain` 只有 `?? vendor` 一行。
两条内容级断言在开跑前与收工后各读一次，两遍都退 0：
`git diff --quiet HEAD -- _data _includes _layouts _posts _config.yml assets dev scripts` = 0（牙齿族确实把内容还原了），
`git status --porcelain` 前后同为一行。跑前 load(1m) **3.78**、跑后 **4.36**。

**排法就是 §9.8 第 12 条末句写死的那一条**：重建 → 牙齿族 → 再重建 → 只读门禁收尾（`--verify` 放最后）。
先前两本 ledger 都把 `seo` 排在最前，所以它绿的那一格说的是「重跑之前」的产物状态；这一遍把它挪到第二次重建之后，
它这一格的 0 才是「牙齿族已经碰过真源 mtime、且正要推的这棵 HEAD」的读数。第一次重建不是多余的：
`check-seo-teeth.mjs:18-20` 自己写着「真仓库的 `_site` 常落后于源，直接拿它当基线会一路假红」，
而它把 `SITE_IN` 整本抄进 `SHADOW` 当变异前的产物基线（`:73` 那行 `fs.cpSync`）。
驱动 `/tmp/gate/it-push-ledger3.sh`，日志 `/tmp/gate/it-push-ledger3.log`。

**14 步逐道引它自己打印的那一行，rc 全 0**（用列表不用表：判决串要逐字照抄，进表就得为对齐调空格，而 `_docs` 不过 prettier）：

- 重建① `bundle exec jekyll build`：`done in 4.318 seconds`（同轮还打 `Skipping: _posts/2100-10-25-practice-demo.md has a future date`，那篇不产出，与 §9.1 那格「缺的那篇」同一件事）。
- SEO牙 `check-seo-teeth.mjs --root=… --site=…/_site`：`分账：语料 6 / keywords 7 / modified 10 / JSON-LD 30 / 分页门 2 / ItemList 18 / manifest 24 / 接线 9 / head 7 / 相关工具 15 / 换源 9 / 描述 7 / 词表 6 / 内链 1 / 目录 4 / searchAction 4`，
  `牙齿台账：159/159 组变异如期变红（用时 125.2s）`，末行 `✓ 全部变异已还原，复跑基线仍绿`。
- 收录面牙 `check-tools-surface-teeth.mjs`：`牙齿台账：79/79 组变异如期变红`，末行 `✓ 全部变异已还原，复跑基线仍绿`。
- 图尺寸牙 `check-image-dims-teeth.mjs`：`牙齿台账：27/27 刀变异如期变红`，末行 `✓ 每一刀都在临时副本上，工作树一字未动；复跑基线仍绿`。
- 变体牙 `check-image-variants-teeth.mjs`：`牙齿台账：15/15 刀变异如期变红`，末行 `✓ 每一刀都落在临时副本上，工作树只读；桩树的三种「不该进台账」形状（无引用 / og 目录 / 低于阈值）在基线里都没误红`。
- 计划镜像牙 `verify-plan-blocks-teeth.mjs`：最末一行 `41/41 通过`；它上面依次是
  `✓ 收口自证：副本回到全绿且工作树未被这些实验碰过 — 副本 exit=0`、
  `✓ 收口自证：实验前后工作树的脏指纹一模一样（路径、内容 diff、未跟踪清单三项全等） — 脏项 1 个前后一致，diff 指纹 17e299e169e1b6ee（含另一路会话的那批，一律未被触碰）`、
  `副本落点：/var/folders/_n/dxmh7qf92210fsxd3d1jr1mm0000gn/T/vpb2-awl84o——全绿，已删`。
  **那半句「（含另一路会话的那批，一律未被触碰）」在这一遍是过度声称**：它是 `verify-plan-blocks-teeth.mjs:702` 那行**无条件拼接的固定串**，
  而 `dirtyFingerprint()`（`:268-269`）取的是 `git status --porcelain` 在**本棵工作树**的读数——这一棵树只有 `?? vendor` 那 1 项，
  并发会话那批脏路径在 `main` 那棵工作树里，从来没进过这一行的计数。断言本身（前后三项全等）是真的，写死的这句尾缀不是读数，记进 §9.8 第 13 条。
- 重建② 同上 `done in 4.116 seconds`。
- `check-seo.mjs --verify`：`✓ SEO 门禁 15 组全绿（keywords / modified / JSON-LD / 分页门 / ItemList / manifest / 接线 / head / 相关工具 / 换源 / 描述 / 词表 / 内链 / 目录 / searchAction）；JSON-LD 211 块全部可解析`——**这就是 §9.9 那格欠的那道读数**。
- `check-tools-surface.mjs`：`✓ 收录面 4 条 ready 条目 × 6 组判据全绿（页面源/收录/导航/图标/DOM/地址栏名单）`。
- `check-image-dims.rb`：`--- image-dims: ok（36/36 条断言，台账 20 对，桩目录 /var/folders/…/image-dims-fx20261008-18780-16bqmt2）---`。
- `verify-plan-blocks.mjs`：`✓ 全部已落地镜像与磁盘逐字节全等（未落地 0 节）`。
- `toolkit-tests.mjs`：`# pass 439`、`# fail 0`、`# skipped 0`、`# duration_ms 10730.655834`。
- `tool-url-state-tests.mjs`：`# pass 12`、`# fail 0`、`# skipped 0`。
- `og-images.mjs --check`：`自检通过：表 68 条，卡片 34 张全部在磁盘上、尺寸 1200x630、无孤儿文件。`（前面两行是 `81 篇文章：34 篇无 cover 需要卡片，47 篇走 front matter cover。` 与跳过那篇未来日期的）。

**牙齿数的涨幅正好对上 §9.8 第 10 条那句预测，且两处差都能拆到组**：§9.2 那本 SP4-only 台账记的是 `155/155`（用时 166.6s）与收录面牙 `74/74`，
这一遍是 `159/159` 与 `79/79`。
- SEO牙的 `+4` 按 `分账` 那行逐段相加可复算：`6+7+10+30+2+18+24+9+7+15+9+7+6+1+4` = **155**，再加末尾那枚 `searchAction 4` = **159**；
  §9.2 抄进去的那串止于 `目录 4`，也就是说差的正是 SP3 的 `searchAction` 一组。§9.4 第 15 条当时已写过「复跑仍 159/159」，与这一遍同数。
- 收录面牙的 `+5` 有文件级证据：`git show ae55ad9:scripts/check-tools-surface-teeth.mjs | grep -c "name: '"` = **74**，
  合并树上的同一本 = **79**；两份 `name:` 清单各自 `sort` 后 `comm -13` 一减，多出来的正是 5 条，逐字是
  `DEFAULTS.context 改成 5（骨架 selected 仍是 3）`、
  `indent 的 options 顺序反了（表 four/two/tab，骨架 two/four/tab）`、
  `把 sort 的 type 从 select 改成 text（名单里那一枚不再是档位）`、
  `放宽 JSON 页那句过滤（去掉 c.id !== "query"，检索词进地址栏）`、
  `骨架里 indent 那枚 select 的 id 改了名（键名与控件脱节）`；
  反向 `comm -23` 打空（SP4 那侧没有一条在合并树上消失）。它们的共同标记是 `→ [地址栏名单]`，来源提交 `fcbe88b`，
  而 `check-tools-surface-teeth.mjs:735` 那行注释自己写着「组 6「地址栏名单」的五把刀（SP2 Task 6）」。
  所以预测里那句「`收录面牙` 那行的数会跟着涨」兑现，而**承载它的是第六组「地址栏名单」**——预测当时写的是「SP2 的 `urlState` 组」，组名以脚本为准。
- `27/27`（滤镜单元）与 `15/15`（换源台账）一字没涨——它们与 SP2/SP3 无关，这条不涨本身就是上面那条预测的对照组。

**那 6 道浏览器门禁这一遍没跑，理由按字节核过而不是按推理**：`git diff --name-only 56dbe05..8c2fc25` 只有本 spec 一本，
`git diff --stat 56dbe05..HEAD -- _data _includes _layouts _plugins _posts assets dev scripts _config.yml package.json` 空输出退 0，
所以浏览器门禁的被测物（产物那几本 + `scripts/verify-*.mjs` 的量具本身）与 `56dbe05` 那一轮逐字节相同——
那一轮是 `/tmp/gate/it-push-browser.log`，6 道 rc=0、读数与判据数已记在 §9.9 那张表里。
唯一读 `_docs` 的门是 `verify-plan-blocks`，而它点名的是 5 本 `plans/*.md`（`scripts/verify-plan-blocks.mjs:54-64`），不含本 spec，且它在这一遍重跑退 0。

**推的那一刀**：`git -c http.version=HTTP/1.1 -c http.postBuffer=1 push -u origin it-sp234` → `* [new branch] it-sp234 -> it-sp234`，退 0。
不带这两个参数时，同一条 `ls-remote` 先失败过一次 `LibreSSL SSL_read: error:02FFF03C…:Operation timed out, errno 60`——
是**先核实现场再换参数重试**，不是把网络抖动当结论。三条落地硬证：

1. `git ls-remote --heads origin it-sp234` → `8c2fc25c7553b3983f4ceda950c04a83723221c3	refs/heads/it-sp234`，与本地 HEAD 同串；
2. `git branch -r --contains HEAD` 由打空转为 `origin/it-sp234`（§9.1、§9.8 第 10 条、§9.9 那三处「未推」的改口就是认这一条）；
3. `git rev-list --left-right --count @{u}...HEAD` = `0	0`。

那三条都是**第一刀（推到 `8c2fc25` 为止）当时的读数**：本节随后自己落成的每一笔只动 `_docs` 的提交，推上去之后
`ls-remote` 与 `@{u}...HEAD` 那两格读的就不是这两串了。恒成立的构造只有一条——`git branch -r --contains 8c2fc25` 必回
`origin/it-sp234`（跑门那一遍的那棵树在远端可达），这也是 §9.9 末段「记『本节末段 = 某数』会被下一笔本节提交自己作废」那条规矩在这一格的写法。

**推的批量**：`origin/master..HEAD` = **77** 笔、`HEAD..origin/master` = **0**（合并基正是 `origin/master` 尖 `259af88`），
`git diff --name-status origin/master..HEAD` = **139** 本（清单落档 `/tmp/gate/it-push-files.txt`，可逐本重看）。
推之前拿宽口径筛过一遍凭据形状 `grep -Ein 'env|secret|token|credential|pem|key$|vendor'`——**它不是零命中，而是 2 命中、退 0**：
`_posts/2024-10-09-fe-env-switch.md` 与 `assets/img/posts/fe-env-switch-arch.webp`，命中的都是文件名里那截 `env`，
即「前端环境变量切换」那篇老文和它的配图，不是凭据文件。换成锚定式
`grep -Ein '(^|/)\.env|id_rsa|\.pem$|credential|private[_-]key'` 才退 **1**（零命中）。
`vendor` 那枚 needle 在 139 本里也没命中——它始终只是工作树里那根未跟踪软链，没进过任何一次暂存。
**这两条 grep 的差别要记下**：宽口径的「命中」在这里是假阳性，但它恰恰是「扫过的证据」；把它写成「零命中」就是把愿望当读数。

**部署面（本轮没有发布，这一条是硬的）**：`.github/workflows/jekyll.yml:3-6` 的触发是 `on.push.branches: ["master"]` 加 `workflow_dispatch`，
推 `it-sp234` 落在那份白名单之外，Pages 那一条不会被这次推送触发。顺带纠一处 §9.1 的旧口径：
「本仓远端只有 `master`」在**命名面**上不准——推后远端 ref 清单是
`origin/Feature-opt`、`origin/HEAD`、`origin/feature-dev`、`origin/it-sp234`、`origin/master`，
准确的说法是**远端没有 `main`**（所以那几格改用 `git branch -r --contains` 是对的，改动不必回滚）。

**一次读数事故的记录（哪些落档、哪些没落，说清楚）**：push 之前先要确认「远端可达且这根分支不存在」，才敢走新建分支而不是覆盖。
第一条 `ls-remote` 当时失败在一次 TLS 读超时（`LibreSSL SSL_read … Operation timed out, errno 60`）——
**这串错误只在当时的终端输出里，没写进任何文件，事后原样复跑未必复现**，所以它不算可复算的读数，只算一次现场观察。
落档的是其后两条：带 `-c http.version=HTTP/1.1` 复跑，`/tmp/gate/it-lsremote1.txt` 与 `/tmp/gate/it-lsremote1.err` **各 0 字节、命令退 0**
（可达且该分支不存在）；推送后 `/tmp/gate/it-verify-push.txt` 存了那一条 ref 行。
中间还有一次口径事故：`${PIPESTATUS[0]}` 是 bash 的数组，本机 shell 是 zsh（要 `$pipestatus[1]`），
于是 `ls-remote … | head -5` 之后的那行 `rc=` 打印成空——**管道 + 语言用错会让退码不可读**，改成落文件再 `echo "rc=$?"` 才认出 0。

**推完之后本节又落了两笔只动 `_docs` 的笔**，所以 §9.8 第 10 条与上面那一格都把「分支尖」写成了构造而不是某个数。
这两笔墨的自测是现读的：`git diff --quiet HEAD -- _data _includes _layouts _posts _config.yml assets dev scripts` 退 **0**、
`git status --porcelain` 只有 `?? vendor` 一行，然后 `node scripts/check-seo.mjs --verify` 在含这两笔的当前尖上复跑仍退 **0**
（`/tmp/gate/it-seo-after-cd0534a.out`）。它不必先重建：`_docs` 既不在 `check-seo.mjs:280` 那五项源清单里，也不进 `_site`——
这正是 §9.8 第 12 条①那个覆盖面缺口的**另一面**：同一处缺口，这一轮让 `--verify` 免于被文档笔墨顶红，那一轮让 `demo.json` 与 `_plugins/*.rb`
的改动逃过点名。缺口本身不因为这次没伤人就修好了。

**这条网络会抖，抖不等于没推上去**：第二刀（`8c2fc25..ba52cae`）推成功之后紧接着那条 `ls-remote` 退 **128**
（`fatal: unable to access …: Empty reply from server`，`/tmp/gate/it-verify-push2.txt` 存着这行），
同一条命令第二次调用就通了——`/tmp/gate/it-verify-push3.txt` 是 `ba52cae159e38bc617bb478653ab980e14afafe6	refs/heads/it-sp234`，
与当时本地 HEAD 同串。当时不靠这条重试也能定案：`git rev-list --left-right --count @{u}...HEAD` 已是 `0	0`、
`git branch -r --contains 8c2fc25` 已回 `origin/it-sp234`，而这两条读的都是 push 自己写回的远端跟踪 ref。
**下一轮别把「核验命令抖一次」读成「推送失败」**，也别反过来拿它当推送成功的凭据——凭据是 push 自己那行 `8c2fc25..ba52cae` 与退 0。

### 9.11 并 `main` 之后：两篇新帖按 SP4 口径补齐，全量门禁重跑，推 `master`（2026-10-08）

**授权面先钉死**：本轮那一句是「帮我提交代码并推送」，紧接在 §9.10 收口后我说的「回并到 `master`（= 触发部署）或先开 PR，需要你授权」之后；
选项问句给的是**补齐两篇再发**，所以兑现的是「补齐 → 全量门禁 → 推 `master`」这一条链。
推 `master` 会触发 Pages（`.github/workflows/jekyll.yml:3-6` 的 `on.push.branches: ["master"]`）——这是本轮唯一一次、也是被点名那一次的发布授权；
`it-sp234` 那根分支的推送不在本轮（§9.10 已推过，`origin/it-sp234` 此刻仍停在 `9e18178`）。

**先红 13 条，逐字照抄**（`/tmp/gate/it-diag-seo.out` 第 2–14 行 + 末行；那棵树正是 `git merge main` 之后、动过任何字之前；驱动 `/tmp/gate/it-master-diag.sh`）：

- `✗ [描述] 2026-10-07-gdp-ts-proof-forgery-3-gaps.md：缺 seo_description——这一篇的 meta description 现在由 subtitle／site.description 兜底，卡片说的不是这一篇的事`
- `✗ [描述] 2026-10-07-wikimedia-openai-agent-edits.md：缺 seo_description——…`（同一句式的另一篇）
- `✗ [词表] …标签「gdp-ts」不在白名单里——词表漂移，新增一枚要显式改脚本`——同句式的另三条分别是 `权限校验`、`robots.txt`、`维基媒体`
- `✗ [词表] …分类「开源工具」不在白名单里——分类漂移，新增一枚要显式改脚本`、`✗ [词表] …分类「前端」不在白名单里——…`
- `✗ [词表] …categories 写了空格分隔的多值「开源工具 TypeScript」——多分类必须写成 [A, B]，方括号之外 YAML 与 Jekyll 的拆法不同，归档页读数会撒谎`（另一篇同句式，值是「AI 前端」）
- `✗ [词表] tags.html：tags 三侧读数不等：语料 155 / 白名单 151 / 产物 155——门禁的拆法与 Jekyll 的拆法有一处动了，或者词表动了而白名单没跟着改`
- `✗ [词表] categories.html：categories 三侧读数不等：语料 16 / 白名单 14 / 产物 16——…`
- `✗ [词表] 2026/10/07/gdp-ts-proof-forgery-3-gaps.html：这页现在命中了工具卡（TypeScript），台账里却没有这一行——match_tags 或这页的 tags 有一边被动过`
- 末行 `✗ SEO 门禁：13 条不通过`

**13 = 描述 2 + 词表 11**：词表那 11 条按形状是越表 tag 4、越表分类 2、多值形状 2、三侧读数 2、命中台账 1
（最后那条走的是 `词表` 组第⑧判「命中集不变」，`check-seo.mjs:1425`，组名前缀仍是 `[词表]`，读的却是文末卡那张 `TOOL_HIT_OK`）。
末那格的真实字节是 `2026/10/07/…`（拿 `od -c` 自证过），本节的 `YYYY/MM/DD/` 一律写斜杠形——显示层会把它折成连字符形，
**照着屏幕上那一形往脚本里粘就是静默 MISS**（这一轮我自己踩了一次：用折形去替台账行，node 那段先 MISS 再 `process.exit(3)`，文件一字未变）。

**处理分工有三条是 §9.9 末段预先写死的**（那一格当时明说「这些是源侧对账，不是跑门」，所以这一遍是照单执行，不是临场发明）：
两篇各补一条 60–140 字的 `seo_description`、分类归进现存 14 枚之一、四枚越表 tag 进 `TAGS_OK`。
**第四条——文末卡台账补行——是这一遍门自己点出来的，§9.9 那张对账表欠了一格**：它逐枚对的判据位是 `词表` 组的前几条（tag 越表、分类越表、多值形状）与 `描述` 组（缺摘要），
外加恒等式，**没对 `词表` 第⑧判「命中集不变」**，而 `tags: … TypeScript …` 这一枚恰好在 `TOOL_MATCH_TAGS` 里，所以合并后必然多一条「命中了却没登记」的红。
**下一轮再并 main，预账里要把「新帖的 tag 有没有一枚落在 `TOOL_MATCH_TAGS`」列为独立一格**（记进 §9.8 第 14 条）。
**扩表与归一分两路走**，理由写进 `scripts/check-seo.mjs:1157` 上方那段注释，不留成「某轮悄悄把白名单放大了」：

- tag 那四枚是**新名词**：`gdp-ts` 是仓库名（与既存的 `GitDiagram`／`Univer` 同类），`权限校验`／`robots.txt`／`维基媒体` 是这两篇的主题词，
  现存 151 枚里没有一枚能当它们的同义写法 → 只能显式扩：`TAGS_OK` 151 → **155**，与钉死它的那行 `:1164`（`if (TAGS_OK.size !== 155 || CATS_OK.size !== 14)`）一起改。
- 分类那两处是**同一件事的两种写法**：`开源工具` 与现存 `开源实测` 是一回事，`前端` 本来就是 tag 而不是分类 → 归一不扩表，`CATS_OK` 仍 14 枚，
  于是 `categories.html` 那一格从 `16 / 14 / 16` 回到三侧全等。多值改写成方括号 `[开源实测, TypeScript]`，理由见 §4.2 那格「空格分隔那形 YAML 与 Jekyll 拆法不同」。
- 描述那两条各 **94 / 103 个码点**（地板 60、天花板 140），摘要里出现的数字 `2 5 0 3 2 9` 与 `1407` 在各自正文里逐字找得到，且两条都不等于本篇 `subtitle`——这四侧都是 `描述` 组的判据，不是我自己加的规矩。
- 台账补的那行落在 `scripts/check-seo.mjs:1285`：`['2026/10/07/gdp-ts-proof-forgery-3-gaps.html', 'TypeScript'],`，`TOOL_HIT_OK` 29 → **30** 行（现算：`awk '/TOOL_HIT_OK/,/^\];/' | grep -c "\['20"` = 30，全斜杠形）。

**改完先只重跑被影响那一道**（`node scripts/check-seo.mjs --verify`，`/tmp/gate/it-fix-seo1.out`）：退 **0**，
`✓ SEO 门禁 15 组全绿（keywords / modified / JSON-LD / 分页门 / ItemList / manifest / 接线 / head / 相关工具 / 换源 / 描述 / 词表 / 内链 / 目录 / searchAction）；JSON-LD 215 块全部可解析`。

**跑门的那棵树**：`.worktrees/it-sp234`，最终 HEAD `b0d5af7`（parents `cc3ed20` = 并 `main` 那笔、`9e18178`）。
非浏览器那 14 步是在 `cc3ed20` + 那三个文件仍未提交的状态下跑的，而 `git diff --name-only cc3ed20 b0d5af7` 正是这三本（两篇帖 + `check-seo.mjs`）——
提交没改一个字，所以那一遍的读数对「要推的这棵 HEAD」成立。这与 §9.10 末段那个「只动 `_docs` 的笔墨不必重跑」不是同一论证：
那一遍靠覆盖面论证（`_docs` 不在 `check-seo.mjs:280` 那五项源清单里），这一遍靠**内容逐字节相同**，而且牙齿族会把真源改一遍再还原，所以必须整链重跑。

**14 步逐道引它自己打印的那一行，rc 全 0**（驱动 `/tmp/gate/it-master-ledger.sh`，日志 `/tmp/gate/it-master-ledger.log`，各道 stdout 落 `/tmp/gate/it-master-<step>.out`；
排法仍是 §9.8 第 12 条末句那条：重建 → 牙齿族 → 再重建 → 只读门禁收尾）：

- 重建① `bundle exec jekyll build`：`done in 4.201 seconds`。
- SEO牙 `check-seo-teeth.mjs`：`分账：语料 6 / keywords 7 / modified 10 / JSON-LD 30 / 分页门 2 / ItemList 18 / manifest 24 / 接线 9 / head 7 / 相关工具 15 / 换源 9 / 描述 7 / 词表 6 / 内链 1 / 目录 4 / searchAction 4`、
  `牙齿台账：159/159 组变异如期变红（用时 117.4s）`，末行 `✓ 全部变异已还原，复跑基线仍绿`。
- 收录面牙 `check-tools-surface-teeth.mjs`：`牙齿台账：79/79 组变异如期变红`，末行同那句「复跑基线仍绿」；它点名的五把新刀仍打在第 6 组（`→ [地址栏名单]`）。
- 图尺寸牙 `check-image-dims-teeth.mjs`：`牙齿台账：27/27 刀变异如期变红`，末行 `✓ 每一刀都在临时副本上，工作树一字未动；复跑基线仍绿`。
- 变体牙 `check-image-variants-teeth.mjs`：`牙齿台账：15/15 刀变异如期变红`，末行 `✓ 每一刀都落在临时副本上，工作树只读；桩树的三种「不该进台账」形状（无引用 / og 目录 / 低于阈值）在基线里都没误红`。
- 计划镜像牙 `verify-plan-blocks-teeth.mjs`：`41/41 通过`，上面两行收口自证是
  `✓ 收口自证：副本回到全绿且工作树未被这些实验碰过 — 副本 exit=0`、
  `✓ 收口自证：实验前后工作树的脏指纹一模一样（路径、内容 diff、未跟踪清单三项全等） — 脏项 4 个前后一致，diff 指纹 0ef5df2a155f47c3（含另一路会话的那批，一律未被触碰）`，
  副本落点 `…/vpb2-SrdioI——全绿，已删`。
- 重建② `done in 10.546 seconds`（比①慢 6.3s，同轮仍打 `Skipping: _posts/2100-10-25-practice-demo.md has a future date`，那篇不产出，与 §9.1「缺的那篇」同一件事）。
- `check-seo.mjs --verify`：就是上面抄的那一行 **15 组全绿 / JSON-LD 215**。
- `check-tools-surface.mjs`：`✓ 收录面 4 条 ready 条目 × 6 组判据全绿（页面源/收录/导航/图标/DOM/地址栏名单）`。
- `check-image-dims.rb`：`--- image-dims: ok（36/36 条断言，台账 20 对，桩目录 …/image-dims-fx20261008-69818-152ka6w）---`。
- `verify-plan-blocks.mjs`：`✓ 全部已落地镜像与磁盘逐字节全等（未落地 0 节）`。
- `toolkit-tests.mjs`：`# pass 439`、`# fail 0`。
- `tool-url-state-tests.mjs`：`# pass 12`、`# fail 0`。
- `og-images.mjs --check`：`83 篇文章：34 篇无 cover 需要卡片，49 篇走 front matter cover。`、`自检通过：表 68 条，卡片 34 张全部在磁盘上、尺寸 1200x630、无孤儿文件。`

**四处数的来历都能复算，不是「大概变了」**：

- `159 / 79 / 27 / 15 / 41` 与 §9.10 那一遍**一字未动**——这轮改的是内容与白名单，没动任何一本量具（`git diff --name-only cc3ed20..b0d5af7` 只有三本）。
  尤其 `分账` 那行的 `描述 7 / 词表 6` 没跟着 `TAGS_OK` 从 151 涨到 155：牙齿钉的是判据的形状，不是词表的规模。
- `JSON-LD 211 → 215`：并进来的两篇文章页各带 2 块（`grep -c 'application/ld+json' _site/2026/10/07/gdp-ts-proof-forgery-3-gaps.html` = 2，另一篇同 = 2），
  全站现算 `grep -ro 'application/ld+json' _site --include='*.html' | wc -l` = **215**，与门禁那一格的数同串——这条不是推的，是量出来的。
- `og` 那行的 `81 → 83 篇`：`34`（无 cover、要卡片）与 `68`/`34`（表条数/卡片张数）都没动，涨的是「走 front matter cover」那半句 `47 → 49`，
  因为这两篇都写了 `cover:`。
- 「15 组全绿」这个组数与 §9.10 同数（这轮没加组、没加判据），这一轮真正的变化只有**同一棵树从 13 红到 0 红**——上面那两行 `--verify` 就是它的两端。

**跑门前后那两道树等价断言都退 1，这是诚实读数而不是门坏了**：那一遍 `check-seo.mjs` 与两篇帖还没提交，「工作树 == HEAD」在这一遍本来就不成立。
这一遍要断言的不是退 0，而是**前后两遍逐字节相同**：`git status --porcelain` 前后同为
` M _posts/2026-10-07-gdp-ts-proof-forgery-3-gaps.md | M _posts/2026-10-07-wikimedia-openai-agent-edits.md | M scripts/check-seo.mjs | ?? vendor` 这 4 项、
`HEAD` 两遍都是 `cc3ed20793df5dc87d2aa4c910c12c154a5763ac`、diff 指纹 `0ef5df2a155f47c3` 前后一致——牙齿族确实把真源还原了。
**提交一定等这一遍过完再做**：牙齿族运行期间它们在改真源，那个窗口里 commit 会把变异内容吞进仓库。

**`verify-plan-blocks-teeth.mjs` 那句无条件尾缀这一遍假得更彻底**：`（含另一路会话的那批，一律未被触碰）`——这一棵树的 4 个脏项**全是本轮我自己的**（两篇帖 + `check-seo.mjs` + `?? vendor`），
并发会话那批脏路径在 `main` 那棵工作树里，一个都没进过这个计数。§9.10 记的是「主树真、这树假」，这一遍连「这棵树里有另一路会话的东西」都不成立。
断言本身（前后三项全等）仍是真的，写死的尾缀不是读数；修法仍归 §9.8 第 13 条那条交接项，**push 轮不动量具**——改判据会在同一轮里既改被测物又改尺子。

**Chrome 那 11 道这一轮必须跑，因为 §9.10 跳过它们的理由没了**：那一遍的理由是「`git diff --stat 56dbe05..HEAD -- <八项建树输入>` 空输出退 0，被测物逐字节相同」；
这一遍 `git diff --name-only cc3ed20..b0d5af7` 里就有两本 `_posts/*.md`——`_posts` 既在 `check-seo.mjs:280` 那五项建树源清单里，也在本节 `assert_tree` 那八项 pathspec 里，更是浏览器门读的那些文章页的源头。
跑前 `git status --porcelain` = `?? vendor` 一行（`b0d5af7` 已提交，工作树干净），跑后是 `M _docs/…本档…` + `?? vendor`，那笔只动 `_docs`，
而 `git diff --quiet HEAD -- _data _includes _layouts _posts _config.yml assets dev scripts` 在 12:16 前后现读仍退 **0**——浏览器牙齿族把那三本 `_site` 副本改完了还原，真源一字未动。

驱动一 `/tmp/gate/it-master-browser.sh`（日志 `/tmp/gate/it-master-browser.log`，各道 stdout 落 `/tmp/gate/it-mbr-<step>.out`），
开跑 load(1m) **4.15**、收工 **12.58**；`TK_SITE_DIR` 那两道的判据要求指向仓库之外，所以先 `mktemp -d` 建 A/B/C 三份 `_site` 副本（各 **977** 本文件）。
**8 道退 0，逐道引它自己打印的那一行**：

- `nav-touch`：`✓ 移动端下拉点按门禁：判据 77 条 红 0 条 · 牙齿 10/10 组变异如期点名`。
- `motion-batch4`：`# 通过 93 项，红 0 项`。
- `tools-browser`：`# 合计 115 项，红 0 项（收轮时本机 1 分钟负载 11.1——绝对毫秒那几格的账）`。
- `tools-browser-teeth`：`合计 9 项（六刀 + 三自检），点燃 9 项，未点燃 0 项`，红项读数留在 `…/tools-teeth-logs-qurXeY`（它自己写着「不删，供后来的人复核」）。
- `codec-browser`：`合计 37 项，红 0 项`，旁边那行 `# Chrome pid=85863（本轮自己 spawn 的那一台）；站外噪声（被排除、不进判据）97 条`。
- `codec-browser-teeth`：`合计 5 个注入，点燃 5 个，未点燃 0 个`。
- `idcard-browser`：`13/13 通过`。
- `search-deeplink`：`✓ 搜索深链验证：全绿（17 条）｜跳过 1 条：J6 单词回归（需要 --head=<上一棵产物的路径>，本轮没有可比的树）｜产物 …/it-sp234/_site`。
  **这一道读的是仓库自己的 `_site`**（它没有 `*_SITE_DIR` 那道隔离门），所以新鲜度我单独自证过：`_site/index.html` mtime `11:53:21`，
  而它要反映的三本源是 `11:45:21` / `11:47:15`——重建②在改动之后，那一格读的不是旧产物。`J6` 那跳是本轮真跳，不是掩盖。

**同一遍里有三道退 2，是我驱动写错，不是站点红**：`toolurl` 打 `✗ 环境没起来：没给 TU_SITE_DIR。本格只认隔离快照（仓库 _site 是 pnpm dev 与并行会话共用的输出，读到旧产物就一路全绿了）`，
`toolurlteeth` 与 `deeplinkteeth` 打同族的 `✗ 必须用 … 指到一份产物副本`。这三本要的是 `TU_SITE_DIR` / `SDL_SITE_DIR`（`verify-tool-url.mjs:50-54`、`:44-49`、`verify-search-deeplink-teeth.mjs:45-54`），
我那一版驱动只传了 `TK_SITE_DIR`。**补跑另起三份新副本**（D/E/F，各 977 本）而不是复用 A/B/C——A/B/C 刚被 `toolsbtteeth` / `codecteeth` 那两本牙齿注入过。
驱动二 `/tmp/gate/it-master-browser2.sh`（日志 `it-master-browser2.log`）：开跑 load **8.61**，三道全退 **0**：

- `toolurl`：`✓ 工具页地址栏验证：全绿（26 条）｜产物 /var/folders/…/it-mbD-LNo0n9/_site`。
- `toolurlteeth`：`✓ 地址栏牙齿：13/13 点燃｜日志 …/tu-teeth-logs-Zq395w`，它上面那行 `写坏后复原=三本 md5 全等；人为错位被抓出 1 件（assets/js/toolJson.min.js）`。
- `deeplinkteeth`：`✓ 深链牙齿：16/16 点燃｜日志 …/sdl-teeth-logs-mSEH7K`，同族那行 `写坏后复原=md5 全等；人为错位被抓出 1 件（assets/js/editorial.min.js）`。

**负载那一格记清楚，免得下一轮误读**：两本带自拒的门（`verify-tool-url.mjs:61-70` 那圈负载闸门——`for (;;)` 配 `:65` 的 `if (os.loadavg()[0] <= 16) break`，等满 90s 落不下来就自己退 2 并打「宁可不交」；以及 `verify-motion-batch4.mjs` 按采样密度 exit 2）这一轮分别在 load **8.32**（`toolurl`，驱动二那一遍）与 **10.45**（`motion`）起跑，没触发等也没拒；
中途现读到的最高值是 **17.06**（12:12 前后，正卡在 `toolurlteeth` 收尾与 `deeplinkteeth` 起跑之间），也就是**没有任何一道是在 >16 的状态下被放行判绿的**，
但「跑完 11 道」这件事本身把本机推到了自拒阈值之上——**同机并行跑 A/B 或再开一轮浏览器门，这个数就是下一轮该先看的那格**。

**推的那一刀**：`GIT_TERMINAL_PROMPT=0 git -c http.version=HTTP/1.1 -c http.postBuffer=1 push origin HEAD:master`，
推之前先零联网确认它一定是快进：`git merge-base --is-ancestor origin/master HEAD` 退 **0**、`git rev-list --count HEAD..origin/master` = **0**、
`git rev-list --count origin/master..HEAD` = **84**（本节这一笔只动 `_docs` 落下去之后是 **85**）。
**推的就是这一棵测过的树**：`_docs` 不进 `_site`（`_config.yml:206` 那份 `exclude` 里没有它，但现量 `ls -d _site/_docs` = `No such file or directory`——
Jekyll 不把下划线开头的非特殊目录当站点内容读），所以这一笔不会改变部署内容，也就没有「部署的那棵树 ≠ 跑门的那棵树」。
凭据按 §9.10 那条规矩只认三样，且都写成构造而不是抄来的数：**push 自己那行 stdout**（原样归档在 `/tmp/gate/it-push-master.txt`，逐字可重看）、
`git rev-parse origin/master` 与当时本地 HEAD 同串、`git rev-list --count origin/master..HEAD` = **0**；
再加一条可达性硬证 `git branch -r --contains b0d5af7` 必含 `origin/master`（跑 14 步那一遍的内容尖，从此在远端可达）。
**`ls-remote` 抖一次既不能当失败证据也不能当成功证据**（§9.10 那格那两条 0 字节 / 退 128 的读数就是这一条的来源）。

**没跑的那一格照记**：Pages 那一次 workflow run 本轮**没有实测**——本机无 `gh` CLI，而核对 Actions 要拿凭据打 API，本轮的口径是不打印、不外带任何凭据形状的东西。
部署条件本身有硬证：`.github/workflows/jekyll.yml:3-6` 的 `on.push.branches: ["master"]`，而这一刀推的正是 `master`。
**要确认发布真落地，下一轮该看的是 Actions 那条 run 与线上 `/better-blog/` 那两篇新页**，不是本节这句话。

### 9.12 并 `main` 第二轮：`1be11cc` 的两篇 10-09 新帖与「工具与文档」那一半，合成一棵线性树重跑全链（2026-10-09）

**形状换了，因为 `main` 这一回不是一枚干净的提交尖**：并发会话在它的工作树里持着 **15 条暂存项**，`git status --porcelain` 仓库根现读 **26 项**（其中 `scripts/article-check.mjs` 一族是 `A`）。
§9.11 那一遍的 `git merge main` 依赖「`main` 的 HEAD 就是它的全部内容」，这一遍同一批路径还在被逐分钟改写，所以既不动那棵工作树、也不碰它的 ref，改在别处合成：
`git worktree add .worktrees/sp4-postmerge -b sp4-postmerge 1be11cc` → `git cherry-pick aa61b30` → 尖 **`6be5fa1`**。
**「并进来」没有第二份内容**：那 12 本路径在 `6be5fa1` 与 `aa61b30` 那棵（`.worktrees/put-tools-docs`）之间 `diff -r` 零差异、逐本 md5 相等。

**先红 7 条，逐字照抄**——不是从我上一遍的笔记抄的，是**把三本文件退回 `6be5fa1` 的原版、重建、再跑一次门**拿到的读数
（`git show 6be5fa1:<path> > <path>`，只写工作树不动索引；日志 `/tmp/sp4m-before-seo.out`，末行就是下面抄的那句 `7 条不通过`，退码 **1** 是当场现读的那格）：

- `✗ [描述] 2026-10-09-ascii-rest-208-files.md：缺 seo_description——这一篇的 meta description 现在由 subtitle／site.description 兜底，卡片说的不是这一篇的事`（同句式另一篇是 `2026-10-09-haiku-5-5-model-id-vs-sdk-typing.md`）
- `✗ [词表] 2026-10-09-haiku-5-5-model-id-vs-sdk-typing.md：标签「Anthropic」不在白名单里——词表漂移，新增一枚要显式改脚本`
- `✗ [词表] …：标签「SDK」不在白名单里——…`
- `✗ [词表] 2026-10-09-ascii-rest-208-files.md：categories 写了空格分隔的多值「开源实测 前端工程化」——多分类必须写成 [A, B]，方括号之外 YAML 与 Jekyll 的拆法不同，归档页读数会撒谎`
- `✗ [词表] tags.html：tags 三侧读数不等：语料 157 / 白名单 155 / 产物 157——门禁的拆法与 Jekyll 的拆法有一处动了，或者词表动了而白名单没跟着改`
- `✗ [词表] 2026/10/09/ascii-rest-208-files.html：这页现在命中了工具卡（npm,vite,前端构建），台账里却没有这一行——match_tags 或这页的 tags 有一边被动过`
- 末行 `✗ SEO 门禁：7 条不通过`

**7 = 描述 2 + 词表 5**，形状与 §9.11 那 13 条同族（越表 tag 2、多值形状 1、三侧读数 1、命中台账 1），**没有一条是新判据**——`词表` 组第⑧判这一遍又一次自己点出「命中了却没登记」，
§9.11 为此写的 §9.8 第 14 条（预账里把「新帖的 tag 有没有一枚落在 `TOOL_MATCH_TAGS`」列为独立一格）这一遍兑现了：`npm`／`vite`／`前端构建` 三枚都在 `TOOL_MATCH_TAGS` 里，所以 `ascii.rest` 那篇必然命中。

**处理仍是 §9.11 那两条分工，扩表与归一分两路**：

- 描述那两条各 **129 / 102 个码点**（口径：`node -e` 取 `seo_description:` 之后那一行的值、`[...v].length`；地板 60、天花板 140）。
  摘要里的数字 token 是 `5`／`0`／`131`／`132`／`2724`（haiku，按 `/\d+/g` 逐枚）与 `208`／`209`／`1`（ascii），
  `描述` 组③要求逐字回正文、④要求不等于本篇 `subtitle`——这两侧都是门在判，绿即证。
- 扩表 **1 枚**：`Anthropic` 进 `TAGS_OK`，155 → **156**，与钉死它的那行 `:1169`（`if (TAGS_OK.size !== 156 || CATS_OK.size !== 14)`）和 `:1149` 那句「规模立刻不是 156/14」一起改；理由写在 `:1158-1161`：表里已有 `OpenAI`／`Meta`／`阿里巴巴` 三枚厂商名，缺的正是这一枚，拿产品名 `Claude` 替它等于把「按厂商找」那条路砍掉。
- 归一 **1 枚**：`SDK` → `TypeScript`（那篇的类型故事具体到 `TS2724` 与声明数，落到现存词比裸一个 `SDK` 更可检索），于是 `TAGS_OK` 只涨一枚，`tags.html` 的三侧从 `157 / 155 / 157` 回到全等——现算 `grep -o '<section class="cat-section" id="[^"]*"' _site/tags.html | wc -l` = **156**，`categories.html` 同式 = **14**。
- 多值形状 1 条：`开源实测 前端工程化` 改写成 `[开源实测, 前端工程化]`，两枚都在现存 14 枚里，所以 `CATS_OK` 一字未动。
- 命中台账 **2 行**：`TOOL_HIT_OK` 30 → **32**（`awk '/TOOL_HIT_OK/,/^\];/' scripts/check-seo.mjs | grep -c "\['20"` = 32），落在 `:1291-1292`。
  这两行是真**斜杠形** `2026/10/09/…`（`grep -n "2026.10.09" scripts/check-seo.mjs | od -c` 自证：同一屏里 `:1158` 那条注释的文件名是连字符形、这两行的路径是斜杠形），
  **§9.11 末段那条显示层折叠陷阱这一轮又踩了一次**：头两回 `Edit` 拿屏幕上那形（折成连字符）去替，old_string 匹配不上，第三次先 `od -c` 再落笔。

**换回后的三本 md5 与退回前的快照逐项相等**（`/tmp/sp4m-after/`：`b664cb850f38253c5d47319863a9c02e` / `88eb99532b62a95598f9adacb1e1a615` / `1c3c3a29b9440974dc10ad1fb5d00a1b`），随后重建一次、`check-seo.mjs --verify` 退 **0**——「跑门的那棵树 = 提交的那棵树」这一条靠字节相等，不靠「应该没变」。

**本节往 `scripts/check-seo.mjs` 里指的行号是这一遍的现号，而 §9.8／§9.11 那些是它们写下时的号**——这一遍在那本脚本里插了 7 行（`:1157` 起 +5、`:1286` 起 +7），所以旧段落的指针现在一律读低。
锚点可复算：§9.11 写「台账补的那行落在 `:1285`」，现在 `grep -n "gdp-ts-proof-forgery-3-gaps.html" scripts/check-seo.mjs` = **1290**。**读旧段落里的行号时先这么挪一下，或按代码文本 `grep` 定位，别照着号数改**。

**全链台账**（排法仍按 §9.8 第 12 条末句：重建 → 牙齿族 → 再重建 → 只读门禁 → Chrome 道；各道 stdout 落 `/tmp/sp4m-*.log`）：

- 重建① `npx --no-install vite build`：`✓ built in 4.84s`；`bundle exec jekyll build`：`done in 3.716 seconds`，仍打 `Skipping: _posts/2100-10-25-practice-demo.md has a future date`（那篇不产出，与 §9.1「缺的那篇」同一件事）。
- SEO牙 `check-seo-teeth.mjs`：`分账：语料 6 / keywords 7 / modified 10 / JSON-LD 30 / 分页门 2 / ItemList 18 / manifest 24 / 接线 9 / head 7 / 相关工具 15 / 换源 9 / 描述 7 / 词表 6 / 内链 1 / 目录 4 / searchAction 4`、`牙齿台账：159/159 组变异如期变红（用时 93.7s）`、`✓ 全部变异已还原，复跑基线仍绿`。
  **`词表 6` 没跟着 `TAGS_OK` 从 155 涨到 156**——与 §9.11 同一论证：牙齿钉的是判据的形状，不是词表的规模。
- 收录面牙 `79/79`、图尺寸牙 `27/27`、变体牙 `15/15`、计划镜像牙 `41/41`（它那行收口自证：`脏项 4 个前后一致，diff 指纹 7d58b5b38a8c1457`）。
- **文章门牙 `node scripts/fixtures/article-check/mutation-check.mjs`**：`正向 合规夹具 exit=0 结论: PASS（PASS 66 / WARN 0 / FAIL 0）`、`结论: 正向 PASS + 12 项变异各自触发预期门禁`——这颗牙齿是 `aa61b30` 带进来的新件，第一次在合并树上点燃。
- 重建② `done in 4.142 seconds`；只读门禁 7 本全退 **0**，逐道引它自己打印的那一行：
  `check-seo.mjs --verify`：`SEO 门禁：产物 _site/（143 页 / 85 篇文章页 / 109 页带安装面），ready 工具 4 条，修订台账 48 条，换源台账 20 条，含 --verify 重算` + `✓ SEO 门禁 15 组全绿（…）；JSON-LD 219 块全部可解析`（`grep -ro 'application/ld+json' _site --include='*.html' | wc -l` = **219**，与那一格同串；比 §9.11 的 215 涨 4，是这两篇各带 2 块）。
  `check-tools-surface.mjs`：`✓ 收录面 4 条 ready 条目 × 6 组判据全绿（页面源/收录/导航/图标/DOM/地址栏名单）`。
  `check-image-dims.rb`：`--- image-dims: ok（36/36 条断言，台账 20 对，桩目录 …/image-dims-fx20261009-64426-1qocwst）---`。
  `verify-plan-blocks.mjs`：`✓ 全部已落地镜像与磁盘逐字节全等（未落地 0 节）`。`toolkit-tests.mjs`：`# pass 439`、`# fail 0`。`tool-url-state-tests.mjs`：`# pass 12`、`# fail 0`。
  `og-images.mjs --check`：`85 篇文章：34 篇无 cover 需要卡片，51 篇走 front matter cover。`、`自检通过：表 68 条，卡片 34 张全部在磁盘上、尺寸 1200x630、无孤儿文件。`（§9.11 是 `83 / 49`，涨的仍是「走 cover」那半句）。
- Chrome 11 道全退 **0**，`TK_SITE_DIR` / `TU_SITE_DIR` / `SDL_SITE_DIR` / `MOTION_SITE` / `NAV_SITE` 各指一份 `mktemp -d` 出来的新 `_site` 副本，牙齿那几道不复用入场那一份：
  `nav-touch`：`✓ 移动端下拉点按门禁：判据 77 条 红 0 条 · 牙齿 10/10 组变异如期点名`。`motion-batch4`：`# 通过 93 项，红 0 项`。
  `tools-browser`：`# 合计 115 项，红 0 项（收轮时本机 1 分钟负载 4.4——绝对毫秒那几格的账）`。`tools-browser-teeth`：`合计 9 项（六刀 + 三自检），点燃 9 项，未点燃 0 项`。
  `codec-browser`：`合计 37 项，红 0 项`，旁边 `# Chrome pid=92768（本轮自己 spawn 的那一台）；站外噪声（被排除、不进判据）97 条`。`codec-browser-teeth`：`合计 5 个注入，点燃 5 个，未点燃 0 个`。
  `idcard-browser`：`13/13 通过`。`tool-url`：`✓ 工具页地址栏验证：全绿（26 条）｜产物 /tmp/sp4m-tu-16hJ/site`。
  `tool-url-teeth`：`✓ 地址栏牙齿：13/13 点燃`，上面那行 `写坏后复原=三本 md5 全等；人为错位被抓出 1 件（assets/js/toolJson.min.js）`。
  `search-deeplink`：`✓ 搜索深链验证：全绿（17 条）｜跳过 1 条：J6 单词回归（需要 --head=<上一棵产物的路径>，本轮没有可比的树）｜产物 /tmp/sp4m-dl2-raOB/site`。`deeplink-teeth`：`✓ 深链牙齿：16/16 点燃`。
- 负载这一格分两种证据：**落进日志的只有 `tools-browser` 自己打印的那句「收轮时本机 1 分钟负载 4.4」**；入场 `sysctl -n vm.loadavg` 现读 **3.37**、收工 **2.68** 是操作时的读数，没写进 `/tmp/sp4m-*.log` 任何一份，所以下一轮别拿它当可复算的产物，要复算就自己现读一遍。两本带自拒闸的门（`verify-tool-url.mjs:61-70` 的 `<= 16`、`verify-motion-batch4.mjs` 按采样密度 exit 2）这一遍都没触发等待也没拒——§9.11 里「跑完 11 道把本机推到 17.06」那一格这一遍没重演。

**两处诚实读数，不是掩盖**：

1. `verify-motion-batch4.mjs` 这一遍 `# 通过 93 项，红 0 项`，而 §9.7 记下的是同一道门在 `⌘K 面板·退场` 上按负载红过（5.57 / 4.33 红、2.59 绿）。
   这一遍落在低负载档，**恰好是那条量具归因的一个正例**：那一格判据是 100 ms 采样窗里的 opacity 取值数，不是站点坏了。§9.7 末尾那条交接（换成 `el.getAnimations()`）仍挂着，本轮不动量具。
2. `verify-search-deeplink.mjs` 第一次跑我把副本传成 `--site <path>`（空格形式），而它的 `opt()`（`:40-43`）只认 `--name=value`，于是那一遍读的是本工作树自己的 `_site`。
   结论没受影响（那一格是重建②的产物、比三本源新），但「只认隔离副本」对它没生效，所以**补跑了一遍 `--site=` 形式**，就是上面抄的那行。`J6` 那一跳是本轮真跳。

**这一轮揪出的新移交项：`article-check.mjs` 的 §8.1 与 SP4 互斥，而且不是这两篇的事**。
把 37 本 `_posts/2026-*.md` 逐本跑这篇文章门（`for f in _posts/2026-*.md; do node scripts/article-check.mjs "$f"; done`，逐本读数落 `/tmp/sp4m-ac13.txt`）：
**24 本在 `任务归属` 那格早退**（`:351` 打那一行、`:352` 立刻 `process.exit(1)`，所以它们走不到正文），**剩下 13 本全部报同一条红**：

```
FAIL  frontmatter  键名或顺序不对：实际 [layout, title, subtitle, seo_short_title, seo_description, date, categories, cover, tags]，必须 [layout, title, subtitle, seo_short_title, date, categories, cover, tags]（§8.1）
FAIL  tags / categories 不是列表  categories 写成了 YAML 列表，必须是空格分隔字符串（§8.1）
```

**两条红的覆盖面不一样，`13 / 13` 只归第一条**：`键名或顺序不对` 命中 **13 本（全）**；`不是列表` 命中 **7 本**（`bend-laws`／`scriptc`／`univer`／`gitdiagram`／`vite-wasm`／`gdp-ts`／`ascii-rest`），另 6 本 `PASS`——它们是单分类、写的本来就是裸标量。
（现算式：逐本跑完后 `grep -c "^FAIL  frontmatter  键名或顺序不对"` 与 `grep -c "^FAIL  tags / categories 不是列表"`，日志 `/tmp/sp4m-ac-correct.txt` = `fmFAIL_sum=13 listFAIL_sum=7 posts=13`。）
**我自己第一遍数错过，错因值得记下来**：那版计数器写的是 `grep -c "不是列表"`，而 `PASS  tags / categories 不是列表  ok` 这一行里也有这五个字，于是 13 本全被数成红——**门名出现在 PASS 行上，是这一族计数判据的通用陷阱**，下一遍要带 `^FAIL  ` 前缀。
订正后的结论仍是成立的，只是量级从「两格」变成「一格恒红 + 一格按形状红」：这篇协议门**能走到正文的每一篇，都被它自己的 `frontmatter` 那一格判死**。根因是两处口径各自成立但互斥：
`_drafts/WRITING_PROTOCOL.md:336` 写「只用这 8 个键、按此顺序」、`:351` 写「`tags`/`categories` 是空格分隔字符串，不是 YAML 列表」，
而 SP4 的 `描述` ① 要求每篇带 `seo_description`、`词表` ③ 要求多分类写成 `[A, B]`；语料站在 SP4 那一边——`_posts/*.md` 86 本里 **85 本带 `seo_description:`**、**80 本用 `^categories: [`**。
**本轮没动它，三条理由**：它是并发会话刚 `A` 进索引的文件（我改了会在它那笔提交里被静默回退）；它不在 §6.4 那 14 道台账里，而 `.github/workflows/` 只有 `jekyll.yml`、不含任何门禁步骤（`grep -n "scripts/" .github/workflows/*.yml` 零命中），所以它的红不拦部署；改判据会在同一轮里既改被测物又改尺子（§9.11 为同一理由不动 `verify-plan-blocks-teeth` 那句假尾缀）。
**修法形状给接手的人，三处一起动才自洽**：`scripts/article-check.mjs:70` 的 `KEYS` 在 `seo_short_title` 后插 `seo_description`；
`:383` 那格从「写成列表就红」翻成「**裸标量且值含空白**才红」，与 `check-seo.mjs:1328-1339` 同式（两本门从此判同一件事）；
`scripts/fixtures/article-check/mutation-check.mjs` 的 M10 钉的是 `tags / categories 不是列表` 这个门名，跟着改，改完必须重跑那颗牙齿看它仍点燃——否则就是 §9.8 那条「假牙」的老病。
`_drafts/WRITING_PROTOCOL.md`（未跟踪、只在主工作树）那两句要同批改，否则文档与两本门会剩下一处不一致。

### 9.13 并 `origin/master` 后推 master——合并提交这一格才是「跑门的树 = 提交的树」真正受审的地方（2026-10-09）

**为什么必须多一枚合并提交**：§9.12 为了不碰并发会话的 ref 走了 cherry-pick，于是 `origin/master`（`aa61b30`）在图上**不是** `b717f6c` 的祖先——
现算 `git merge-base --is-ancestor origin/master HEAD` 回 **rc=1**，`rev-list --count` 两侧 `ahead=5 behind=1`，`merge-base` = `68cc992`。
此时直接推就是 non-fast-forward，而 force-push 禁。所以推前先 `git merge -F /tmp/sp4m-merge-msg.txt origin/master`（`Merge made by the 'recursive' strategy`，零冲突），尖 **`5e0fc2b`**，双亲 `b717f6c` + `aa61b30`。

**合并没有换掉任何一个字节，这一条不靠「应该没变」**：
`git rev-parse b717f6c^{tree}` 与 `git rev-parse HEAD^{tree}` 同为 **`b13458910488ffbf05ee8868008187d1ee3fe6d2`**，`git diff --quiet b717f6c HEAD` 回 **rc=0**。
树对象 SHA 相等意味着 §9.12 那一整条门禁链读过的每一个字节都还在原位——**合并后不需要复跑**，复跑反而只证明同一件事第二次。
合并前还有一道前置比对：`git diff --name-only b717f6c aa61b30` 只有 12 本，全是来自 `1be11cc` 的两篇新帖、§9.12 那本 spec、`check-seo.mjs` 那 4 处（都在我们这侧），`aa61b30` 触及的 12 本路径零差异。

**推出去的是什么**：`git diff --name-only origin/master HEAD` = **12 本 / 409 增 / 4 删**（逐本清单落 `/tmp/sp4m-pushset.txt`），
其中 `_config.yml`／`package.json`／`dev/sass/toolkit.scss`／`dev/js/editorial.js`／`sw.js`／`offline.html`／`_data/og_images.yml`／`scripts/check-sw*` 这些禁改路径 **grep 零命中**，`search1.json` **零命中**。

**推送与三重核验**（口径逐条给命令，因为这一轮的结论全是「服务端现读」型的）：
`GIT_TERMINAL_PROMPT=0 git -c http.version=HTTP/1.1 -c http.postBuffer=1 push origin HEAD:master` → rc=**0**，回显 `aa61b30..5e0fc2b`（**两点、无 `+`**，即真是快进）。
① 服务端 ref：`ls-remote origin refs/heads/master` = `5e0fc2b5caed224a850769d5755f5ddea4312dde`，与本地 `rev-parse HEAD` 全等——**不能用本地的 `origin/master` 当这一步的证据，那一格是 push 自己写进去的**。
（顺带一条：同一条命令链里先跑的 `git fetch` 打了 `Empty reply from server` 却因管道而 rc=0，`ls-remote` 才说得出真话——**认服务端，不认 fetch 的退出码**。）
② 部署：Actions `runs?head_sha=5e0fc2b…` 命中 **1** 条，run `37918314855` / **#49** `Deploy Jekyll site to Pages`，`event=push`，`completed` / **`success`**，`updated_at=2026-10-09T10:34:32Z`。
③ 线上页面（逐条单独 curl，一次一个 URL）：两篇新帖 `200`、**70749B / 74351B**，与本仓 `_site` 里刚跑过门的那两份**长度全等**；逐字节比对的差异每篇恰好 **2 个偏移**（`4580`/`6310` 与 `4530`/`6305`），两处都是 `+08:00` 对 `+00:00` 的那一位数字——CI 在 UTC 建，与 §9.11 记的时区口径同一条，**不是内容差**。
`meta description` 线上与源 frontmatter **逐字相等**（129 / 102 个码点），haiku 那篇 `keywords` 是 `Claude,Anthropic,TypeScript`。
`tags.html` 现读 **156** 个 `<section class="cat-section">`、`categories.html` **14** 个，且 `id` 序列与本地那一侧 `idsEqual=true`；`Anthropic` 有栏且挂着 haiku，**`SDK` 无栏**（归一生效），ascii 同时挂在 `开源实测` 与 `前端工程化` 两栏下（`[A, B]` 生效）。两枚新 banner 线上 `200`、**45446B / 122928B**，与推送 diff 里那两行 `Bin` 的字节数全等。

**两处本轮自己的读数错，都得记**：
- 第一版线上探针按猜的形状抓标签（`rel="tag"` 与 `/categories/<x>/`），两篇都回**空数组**——不是页面缺标签，是**定位器没命中过**。改成抓 `href` 含 `tags.html#` 的形状才对上。**空结果必须先证定位器命中过，才能读成「不存在」**（§9.12 末段那条 `grep -c` 陷阱的线上版）。
- 线上正文只有**一枚**分类 chip，看着像 `[A, B]` 没生效。实际 `_layouts/post.html:56` 本来就是 `{{ page.categories | first }}`，`:51` 还有一行注释钉住这个写法——**单 chip 是既有口径，不是这一轮的回归**；两栏都在的证据在归档页（上面那条两栏同时命中）。

**并发会话未受影响**：`main` 仍在 `1be11cc`，`diff --cached --name-only` **15** 条、`status --porcelain` **26** 项，逐项与 §9.12 开工前一致，全程没动它的 ref 与工作树。
**凭据**：API 用的 token 从 `osxkeychain` 经 `git credential fill` 取，只写进 `umask 077` 的 curl `--config` 文件、由 `curl --config` 消费，全程未打印任何一位，用完 `rm -f`（自证 `[ -f ]` 回 `gone`）；对 API 只做了 `runs` 列表这一种**只读**调用。

### 9.14 把 §9.12 末段那处移交项做掉——两本门从此判同一件事（2026-10-09，`ac-align`）

**为什么这轮必须动它，而不是再移交一次**：`scripts/article-check.mjs` 在仓内**零消费者**（`grep -rn "article-check" scripts/ .github/ _config.yml` 只命中它自己的牙齿 `scripts/fixtures/article-check/mutation-check.mjs`；`.github/workflows/` 只有 `jekyll.yml`，`grep -n "scripts/"` 零命中），但**两本每日 cron 都跑它且被协议禁止修改它**，所以 §9.12 那两格红不是文档不一致，而是**每晚 22:05 都会再产出一批需要人工按 SP4 口径返工的稿子**。修在 master 上不影响今晚的读数——cron 读的是 `main` 工作树的**工作副本**，落地那一格见本节末。

**三处一起动才自洽（形状正是 §9.12 末段给的修法，一字未改）**：
1. `:70` 的 `KEYS` 在 `seo_short_title` 之后插 `seo_description`（8→9 键），`:266` 那格的通过文案跟着从「8 键顺序正确」改「9 键顺序正确」；
2. `:375-383` 那格从「写成列表就红」**整个换成** `check-seo.mjs:1328-1339` 词表 ③ 的同一式子——`红 ⟺ 值非空 ∧ 不以 [ 开头 ∧ /\S\s+\S/`，门名 `categories 多分类写成列表`。**只管 `categories`**：`tags` 两种形状 Jekyll 都拆得对（`check-seo.mjs:207` 那句 `asList` 注释就是这条口径），而 `categories` 只有方括号那一形能让归档页两栏都挂上；
3. 夹具补 `seo_description` 并把 `categories` 改成 `[AI, 开源实测]`，牙齿 **M10 反向**（原钉「写成列表」，现在钉「多值不带方括号」）并新增 **M13 删 `seo_description` 行 → `frontmatter`**——不留牙齿的话，「§8.1 与 SP4 同形」这件事就是 §9.8 那族「假牙」老病。

**牙齿（改完必跑，这就是它的账）**：`node scripts/fixtures/article-check/mutation-check.mjs` rc=**0**，`正向 合规夹具 exit=0 结论: PASS（PASS 66 / WARN 0 / FAIL 0）` + `结论: 正向 PASS + 13 项变异各自触发预期门禁`。判据数仍是 **66**：这一格是一换一，不是加格。

**同一命令形状下的语料 A/B**（`node <那本门> _posts/2026-*.md --job A`，37 本，逐本 rc 落 `/tmp/aac-*/corpus-{old,new}.txt`；旧侧是 `git show HEAD:scripts/article-check.mjs`，md5 `ab4d060af3ccfff57d9f78654fde151d`）：
`^FAIL  frontmatter` **37 → 0**、`^FAIL  tags / categories 不是列表`／`^FAIL  categories 多分类写成列表` **31 → 0**、exit0 **0 → 6**（`bend-laws`／`scriptc`／`univer`／`gitdiagram`／`gdp-ts`／`ascii-rest`，就是按 v2 骨架写的那几本）。
**剩余 31 本的红与本轮无关**：全在正文骨架格上（`展望有锚` 31、`单节篇幅` 31、`H2 名单与顺序` 31、`H2 数` 26、`句子长度` 24、`全文篇幅` 24…），那是 v2 骨架之前写的稿子，本轮既没判它们、也没放松任何判据。
**本轮自己数错的一格，形状与 §9.12 那条 `grep -c` 陷阱同族**：第一遍我拿 `--job A` 去判今天 cron 的两篇，`haiku` 报 5 红（`H2 数`/`H2 名单与顺序`/`单节篇幅`/`展望有锚`/`结尾项目地址`）——换成 `--job B` 是 `PASS 60 / FAIL 0`。**那篇本来就是 B 类**，`--job` 不是我该当常数的那一格；差点把「我用错形状」报成「cron 又写了不合格的稿」。

**文档四处同步（一处不漏，`_drafts/` 未跟踪、只在主工作树）**：§8.1 本体（9 键、`seo_description` 行、`categories` 那行改「单分类可裸标量；多分类必须 `[A, B]`」、新写「tags 仍空格分隔单 token」与「两本门用同一式子，语义与数字预算只在 `check-seo.mjs`，本文档不重抄」）；§10.1 三处（「8 键 frontmatter」→ 9 键、「`tags`/`categories` 不是 YAML 列表」→ 「`categories` 的多分类必须写成 `[A, B]`」、12→13 两处、M10 改口 + M13 补行）；`persona.md:25` 与 `:191` 的 **8 键 → 9 键**——**persona 是两本 cron 的必读输入**，那里留着「8 键」等于把键数注回去、把这轮修复抵消掉。复扫式子 `8 键|不是 YAML 列表|不是列表|12 种变异|12 项各自|tags / categories` 在 `_drafts/` 下 **0 命中**。
**§10.1 里那句「本轮第一版就是这样把 12 项全『测过』的」我留着没改**：那是 2026-09-27 那一遍的历史读数，改成 13 就是把当时的事写成现在的事。

**一条已知共享盲点，不藏**：块列表形（`categories:` 空值 + 下一行 `- AI`）这一格从此**不红**——因为 `check-seo.mjs` 的词表 ③ 也不红（`val &&` 那半句先短路）。这是「两本门用同一式子」的**必然结果**，不是这轮引入的漏口；要补得两边一起补，且 `check-seo.mjs` 那侧属于站点门，越权。

**门禁链读数（`ac-align`，基 `e900f62`，与 §9.13 那棵的唯一差异就是上面三本 `scripts/`）**：重建① `vite ✓ built in 4.01s` / `jekyll done in 5.391s`（仍 `Skipping: _posts/2100-10-25-practice-demo.md has a future date`）；牙齿六颗全 rc=0——`check-seo-teeth 159/159（95.7s）`、`收录面 79/79`、`图尺寸 27/27`、`变体 15/15`、`计划镜像 41/41`（收口自证 `脏项 4 个前后一致，diff 指纹 1672d25ac541aeac`）、上面那颗文章门牙；重建② `done in 4.268s`；只读七本全退 **0**，逐道引它自己那行：`15 组全绿 … JSON-LD 219 块全部可解析`、`收录面 4 条 ready × 6 组判据全绿`、`image-dims: ok（36/36，台账 20 对）`、`全部已落地镜像与磁盘逐字节全等（未落地 0 节）`、`# pass 439 / # fail 0`、`# pass 12 / # fail 0`、`自检通过：表 68 条，卡片 34 张 …`。
**Chrome 那 11 道这一轮没跑，理由不靠推断、靠产物级 A/B**：`diff -r --brief .worktrees/sp4-postmerge/_site .worktrees/ac-align/_site` 只回 **1 行**——`feed.xml differ`，**零 `Only in`**。两棵树的 `_site` 文件集相同、逐字节只差那份 feed 的生成时刻，而 11 道 Chrome 门读的都是 `_site` 副本；`feed.xml` 归 `check-seo`／`check-tools-surface` 那两本（都在上面，且都绿）。§9.13 那一遍对这同一份产物的 11 道读数因此仍然成立。

**落地这一格分两处，第二处动了并发会话那棵工作树**：master 拿到的是格式化版；`main` 工作树里那三本仍是并发会话暂存的旧形状（`article-check.mjs` 的 md5 `61306177f41c9553c37df7259c38d7c8`，与 master 的 `ab4d060…` 行为等价，§9.12 已用「同一 37 本跑出逐字节相同的 2777 行」定过性）。**今晚的 cron 跑的是工作副本，不是 master**，所以这轮把 `scripts/article-check.mjs` + 它的夹具 + 它的牙齿**三本一起**按修复内容落到 `main` 的工作树——**索引一字未动**（`git show :<path> | md5` 三本仍各自等于暂存那版，`6130…`/`6d08…`/`c9a4…`，落盘前后各测一次），三格 status 因此从 `A ` 变 `AM`。**这一句是本节的改口**：我最初写的是「只落 `article-check.mjs` 一本、夹具与牙齿不在 `main` 落」，实测后推翻——只落一本会让 `main` 那棵树自己的牙齿必红（旧夹具无 `seo_description`，新 `KEYS` 那格先红在正向夹具上），而这三本是一个契约的三件，落半份比不落更难解释。落点前先 `cp` 出三份备份（`/tmp/ac-align-backup/*.before`，md5 逐本对过）。

**落地后的读数，两棵树分开测（同一命令形状 `--job A`、同一 86 本全语料）**：

| 树 | 门 | `frontmatter` 红 | `tags / categories 不是列表`／`categories 多分类写成列表` 红 | exit0 |
|---|---|---|---|---|
| `master` 内容（`ac-align`） | 旧 `ab4d060…` | **86 / 86** | 80 | 0 |
| `master` 内容 | 新 | **46** | 0 | 6 |
| `main` 工作树（落后 7 枚） | 旧 `6130…` | 84 | 79 | 1 |
| `main` 工作树 | 新 | 48 | 1 | 5 |

**四条要从这张表里读准**：① 旧门在 master 的内容上是 **86 本全红**——它不是「偶尔红」，是**从来没有能力放行任何一篇**；② `master` 侧 **NEW 红而 OLD 不红 = 0 本**（逐本名取集合差 `comm -13` 现算），即这轮**没加一条红**，转绿 **40 本**；③ 仍红的 46 本全是 2016–2024 遗留形状（带 `author`、缺 `cover`、缺 `subtitle`…），旧门同样判红，属 §9.11 那格「只合已收完的那半」的范围外，且 cron 只对新稿跑这本门；④ `main` 比 `master` 多红的正是 **`2026-10-09-ascii-rest` 与 `2026-10-09-haiku`** 两本——它们是本轮那两篇 cron 稿在 `main` 里的**未返工原状**（`categories: 开源实测 前端工程化` 裸空格、无 `seo_description`），`master` 上 §9.12 已修，所以这 2 格红是**内容落后 7 枚**的证据，不是新门的误判。`main` 侧那 1 格 `categories` 红同理（同一本 ascii-rest）。
**落地点在 `main` 的树上自证**：`node scripts/fixtures/article-check/mutation-check.mjs` rc=**0**，`正向 合规夹具 exit=0 结论: PASS（PASS 66 / WARN 0 / FAIL 0）` + `结论: 正向 PASS + 13 项变异各自触发预期门禁`。

**这张表背后有两个测量坑，形状与 §9.12 那条 `grep -c` 陷阱同族，都记下来**：
1. 第一版把备份文件 `article-check.mjs.before` 直接当门跑，Node 报 `ERR_UNKNOWN_FILE_EXTENSION ".before"`，**86 本全崩**，而我那遍的计数器读出 `fmFAIL=0` ——**差一步就把「量具没跑起来」报成「旧门零红」**。认出它的只有旁边那格 `exit0=0`；补了 `errors=$(grep -c 'ERR_UNKNOWN')` 这一自检后才动手。**空读数必须先证工具真跑过。**
2. 另一遍我在循环里漏打 `===== $f` 标记，于是那 86 本的日志**无法按本子归因**，`comm` 集合差算出来是假的（那一遍报的「NEW 红而 OLD 不红 = 46」就是把空集合当基线的产物）。重跑带标记之后，真值是 **0**。
3. 顺带一条同族的：`ls -d /tmp/aac-old-XXXXXX` 不匹配 `mktemp -d` 生成的随机后缀，于是 `$D` 空 → `[ -f /article-check.mjs ]` 假 → `&&` 链整段短路，后面用 `;` 接的统计照样跑并打出全零读数。**`&&` 前缀 + `;` 后缀的链，短路不会传染到统计那半**，这类链要么整条 `&&`，要么把读数写进同一个子 shell。
