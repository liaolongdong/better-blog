# 站点离线层（Service Worker）验收与落地实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已经落地的离线层（`sw.js` + `offline.html` + `editorial.js` 的注册段 + 三道门禁）在**当前内容**上重新验一遍、把漂移的数字回填进 spec，然后按「只提交自己那一段」的纪律落地，并给出发布后的线上复验动作。

**Architecture:** 离线层是站点根的一枚 Service Worker：`sw.js` 是带空 front matter 的 Jekyll 页面，四份清单（骨架 / 豁免 / 文档 / 封面）由 Liquid 从 `site.nav`、`site.data.onlineTools`、`site.posts`、`sitemap.xml` 同源生成；注册代码搭全站公共件 `editorial.min.js` 上车，页面 HTML 零新增字节。策略只有三种（文档 network-first、同源 css/js/font/worker cache-first、图片 cache-first），跨源一律不拦不缓存。

**Tech Stack:** Jekyll 4.3.4 + Vite 6（`pnpm build` → `bundle exec jekyll build`）、原生 ES5 风格 DOM API、`node:http` 静态服务 + Chrome headless + 裸 CDP（无第三方依赖，Node 22 全局 `WebSocket`）、`node --test`（`toolkit-tests` 那套）。

**规格：** `_docs/superpowers/specs/2026-09-28-sw-offline-design.md`（本文所有 §n 指向它）。

---

## 0. 这份计划与「实现已完成」的关系

实现主体与三道门禁在 2026-09-28 那轮已经完成并跑绿（spec §10）。本文存在的理由有两条，都不是重写代码：

1. **数字漂了。** spec §6 那整张表量在 `_posts` 有 75 个文件、文档清单 84 条、封面 39 张的产物上；`_posts` 现在是 **86** 个文件（`ls _posts/*.md | wc -l` 现量于本文写作时），而主工作树那棵陈旧的 `_site` 上清单已经报到**文档 98 条 / 封面 50 张**。清单条数、字节、贪心落点、`sw.js` 的 gzip 余量全部要重出，判据不认旧数。
2. **落地与发布从没做过。** 这 9 个文件（7 个新增 + 2 个改动）至今全部在未跟踪 / 未提交状态，而工作树里同时有**第二个会话**的暂存与在途改动。提交这一段必须有明确的操作顺序，否则要么吞掉别人的暂存，要么把别人的未提交改动一起提走。

所以：Task 1 是工作树对账，Task 2–6 是验收链（含补跑 spec §10 漏掉的一道），Task 7 是需要用户拍板的三件事，Task 8–9 是提交与发布（两步都需要单独授权），Task 10 是收尾账。

---

## 全局约束（每个任务都受这些限制）

- 工作目录：`/Users/liaolongdong/code/liaolongdong.github.io`，分支 `main`，上游 `origin/master`。
- **绝不 `git add .` / `git add -A` / `git commit -a`。** 尤其**不要用 `pnpm deploy`**：`USAGE.md:71` 写明 `deploy-github.sh` 内部就是 `git add -A`，它会把并发会话的在途文件一起吞掉。
- 暂存只用显式 pathspec（Task 8 逐条列出），提交信息一律 `git commit -F <文件>`，**不用 heredoc**。
- **不 push**。push、建 PR、触发 Actions 都属于对外动作，需要用户单独授权（一次授权只对那一次有效）。
- 不 `--no-verify`、不 `amend`、不 `reset --hard`、不对共享工作树用裸 `git stash`。
- 本机 git 是 **2.23.0**（`git --version` 现量）。已知两处失效写法：`git merge-tree --write-tree` 不支持；`git rev-parse --short A B` 多 rev 会假 fatal，要逐个调。
- 不碰（并发会话的领地，一律只读不提）：`_config.yml`、`package.json`、`USAGE.md`、`scripts/article-check.mjs`、`scripts/lib/post-meta.mjs`、`scripts/wechat-draft.mjs`、`scripts/check-tools-surface.mjs`、`_data/onlineTools.yml`、`_data/og_images.yml`、`_data/tools.yml`、`dev/sass/toolkit.scss`、`dev/sass/common/editorial.scss`、`dev/js/tools/*`、`sitemap.xml`、`_includes/header.html`、`tools.html`、`index-all.html`、`llms.txt`、`README.md`、`scripts/verify-motion-batch4.mjs`、`scripts/verify-nav-touch.mjs`、`search1.json`。
- 报告一律中文；**每一个数字都必须是自己跑出来的**，不许引用 spec 里的旧数充当本轮读数。退出码只认日志里 `echo` 出来的那一个，不许用 `cmd | tail` 之后的 `$?`（管道吞退出码）。
- gzip 口径只有一个：`cat f | gzip -9 | wc -c`（走 stdin；`gzip -9 -c f` 会把文件名塞进 FNAME 字段，每件多 16–19B；`zlib.gzipSync` 与它不同口径，跨口径比较视同没量）。
- `_site/sw.js` **不是逐字节可复现的产物**（桶名里带 `BUILD = site.time`）。任何「产物一致性」比对都必须把这个文件排除在外，一律比集合与条数。
- 格式化：本仓没有 prettier 依赖也没有配置文件（`require('./node_modules/prettier/package.json')` 现量 MODULE_NOT_FOUND），历史上靠 `npx prettier --single-quote --print-width 320 --write <文件>` 手工跑。**本轮不重新格式化任何文件**——在并发会话正在写的同一批文件上制造噪声 diff 是本计划要避免的事。`_docs/**` 下的 spec 与 plan 永不过 prettier。
- 跑门禁的那棵树必须**只比**要提交的那一棵多出「尚未提交的本层文件」：Task 2–6 一律打在**干净导出树 + 叠上本层文件**上（后续任务里的「重建导出树」都指下面这一段）：

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
rm -rf /tmp/swv && mkdir -p /tmp/swv
git archive main | tar -x -C /tmp/swv
ln -s "$PWD/vendor" /tmp/swv/vendor
ln -s "$PWD/node_modules" /tmp/swv/node_modules
cp sw.js offline.html /tmp/swv/
cp scripts/check-sw.mjs scripts/check-sw-teeth.mjs scripts/verify-sw-offline.mjs \
   scripts/verify-idcard-browser.mjs /tmp/swv/scripts/
cp dev/js/editorial.js /tmp/swv/dev/js/editorial.js
cd /tmp/swv && npx --no-install vite build && bundle exec jekyll build
```

> **为什么必须叠这几个文件**：`git archive main` 只出已跟踪内容，而本层那 7 个新文件至今未跟踪（另两件是已跟踪未提交）——不叠上去，`check-sw.mjs` 第一件事就是 `_site/sw.js 不存在` 直接退 1，`editorial.min.js` 里也不会有注册段，判据 7 必红。叠完之后这棵树 = `main` + 本层，它与 Task 8 Step 5 那棵 `git archive HEAD` 的树应当**只差 BUILD 时刻**；若还差别的，说明有该进提交的没进去。
> `dev/js/editorial.js` 是按工作树版本整份拷的，所以它连带带着 Task 7 决策 1 里那枚非本层的注释 hunk——**对门禁无害**（判据 7 只认 `swdev` ±300 字符窗口内的共现与体积上限，与那段 `.cta` 注释无关），但别把它当本层的产物。
> **`node_modules` 那一枚软链不能省，也不能只写 `npx vite build`。** 这一条是 SP4 那轮记下来的坑（`_docs/superpowers/plans/2026-10-03-content-governance.md:2253-2256`）：`git archive` 不带 `node_modules`，在那棵目录里跑 `npx vite build` 会去网上抓 `vite@8.3.3`（本仓锁 6.4.3）、`failed to load config`、**exit=1**，而紧跟其后的 `bundle exec jekyll build` 照样 exit=0，产出一棵**没有 CSS/JS 的 `_site`**——后面每一道门的读数都建在假产物上。认这两个开关：软链 + `--no-install`。
> 为什么是导出树而不是主工作树：主工作树里 `_site` 会被并发会话的 watcher 重建，读数和「我要提交的那一棵」不是同一棵。
>
> 自检一句（每次重建后跑，证明叠文件真的叠上了、vite 真的产出了带着注册段的资源）：
>
> ```bash
> ls -l /tmp/swv/sw.js /tmp/swv/_site/sw.js >/dev/null && echo 叠上了
> grep -o 'serviceWorker' /tmp/swv/assets/js/editorial.min.js | wc -l
> ```
>
> 第二条应恰好 **2**（`'serviceWorker' in navigator` 那道能力探测 + `navigator.serviceWorker.register`）。**别拿 `initOffline` 当锚点**——它是闭包内的函数名，vite 压缩后会被改名，在工作树现产的 `assets/js/editorial.min.js` 上现量是 **0** 次命中，而 `serviceWorker` 是 2 次。若第二条是 0，`_site` 是上一轮的旧产物或 vite 那一步没跑成，本轮读数全部作废。

---

## 文件账（本层的 9 个文件 + 各自归属）

| 路径 | `git status` 现量 | 归属 | 说明 |
|---|---|---|---|
| `sw.js` | `??` | 本层 | 仓库根，空 front matter；四份清单 + 三种策略 + 空闲补全 + `BB_PING/BB_PONG` |
| `offline.html` | `??` | 本层 | `permalink: /offline.html`，自足兜底页，无外链样式/脚本、无 JS |
| `scripts/check-sw.mjs` | `??` | 本层 | 构建期门禁，7 组判据 |
| `scripts/check-sw-teeth.mjs` | `??` | 本层 | 牙齿台账，22 条变异 |
| `scripts/verify-sw-offline.mjs` | `??` | 本层 | 真 Chrome + CDP 断网核验，10 格 |
| `dev/js/editorial.js` | ` M`，**3 个 hunk** | **混** | 我的：`initOffline()` 定义 + `boot()` 里那一条调用。不是我的：`a.cta` 那段「tools.html 8 颗 → 9 颗」注释（hunk 1，`@@ -3087,9 +3087,10 @@`） |
| `scripts/verify-idcard-browser.mjs` | ` M`，1 个 hunk | 本层 | 站外降噪两参数（spec §8.3 那张表），改前它对 `/tools/idcard.html` 真跑报 `加载超时` |
| `_docs/superpowers/specs/2026-09-28-sw-offline-design.md` | `??` | 本层 | 设计文档 |
| `_docs/superpowers/plans/2026-10-10-sw-offline.md` | 本文件 | 本层 | 实施计划 |

`search1.json`（`??`，57,122B，2026-10-01 的 GitHub API 搜索响应转写）不是本层的产物，也不是任何人的在途文件——**不提交、不删、不动**，交给它的主人。

---

## Task 1：工作树与归属对账（先证明「我动的就是我那 9 个文件」）

**Files:** 无改动，纯读。

- [ ] **Step 1：现量工作树状态**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
git status --short
git diff --stat HEAD -- dev/js/editorial.js scripts/verify-idcard-browser.mjs
git diff HEAD -- dev/js/editorial.js | grep -c '^@@'
```

Expected：`dev/js/editorial.js` 与 `scripts/verify-idcard-browser.mjs` 都是 ` M`（未暂存）；上面 `--stat` 两行的合计应约为 `editorial.js +40/-3`、`verify-idcard-browser.mjs +29/-7`；`grep -c '^@@'` 对 editorial.js 应是 **3**。

- [ ] **Step 2：钉死 editorial.js 的三个 hunk 各是谁**

```bash
git diff HEAD -- dev/js/editorial.js | grep -n '^@@\|initOffline\|a\.cta\|cta-muted'
```

Expected：hunk 1 里出现 `cta-muted` / `8 颗`（或 `9 颗`）字样 → **不是本层的**；hunk 2 出现 `function initOffline()` → 本层；hunk 3 出现 `initOffline();` → 本层。若 hunk 数不是 3，或本层那两条不在，停下来汇报实际形状再继续——说明另一会话刚动过这个文件，Task 8 的方案要重新选。

- [ ] **Step 3：现量本地与远端的距离（发布节点要用）**

```bash
git rev-parse HEAD
git rev-parse origin/master
git rev-list --count origin/master..main
git rev-list --count main..origin/master
```

Expected：四个数逐个打出来记账（本文写作时现量为 ahead=1 / behind=8，`origin/master` 提交时间 2026-10-09 19:36:59 +0800；执行时必须重量，不许抄这一行）。**behind > 0 意味着发布前必须先处理 `origin/master`**，见 Task 9。

- [ ] **Step 4：确认没有会拦提交的钩子**

```bash
git config --get core.hooksPath; ls -d .git/hooks 2>/dev/null && ls .git/hooks | grep -v '\.sample' | head
```

Expected：`core.hooksPath` 为空，且 `.git/hooks` 里没有非 `.sample` 的钩子。若存在 `pre-commit`，把它跑一次并汇报——不要为了绕过它用 `--no-verify`。

---

## Task 2：在导出树上重建产物，重出 §6 读数并回填 spec

**Files:**
- Modify: `_docs/superpowers/specs/2026-09-28-sw-offline-design.md`（§6 表、§7 那两行体积、§8.3 表头读数、§10 交付状态；**只改数字，不改策略叙述**）

- [ ] **Step 1：建导出树（含叠上本层文件与两枚软链）并构建**

跑「全局约束」里那段标着「重建导出树」的完整命令，然后紧接着跑它下面的两行自检（`叠上了` + `serviceWorker` 计数 = 2）。Expected：`npx --no-install vite build` 无错误且 exit 0；`bundle exec jekyll build` 末尾打出 `Done: ...`，且日志里有一行含 `has a future date`——`_posts/2100-10-25-practice-demo.md` 现在还在（`grep -l '^date: 2100' _posts/*.md` 现量 1 条），它就是 spec §6 那个「86 个文件 − 1 = 85 篇」算式里被减掉的那一枚；哪天真它被删了，算式要重写。

- [ ] **Step 2：确认 Liquid 渲染干净（`sw.js` 存在且无模板残留）**

```bash
cd /tmp/swv
ls -l _site/sw.js _site/offline.html
grep -c '{{\|{%' _site/sw.js
grep -c endcomment _site/sw.js
```

Expected：两个文件都在；第二条 **0**（有残留 = Jekyll 没把它当模板处理，通常是 front matter 丢了或文件被 `exclude` 命中）；第三条 **0**（源侧 6 段口径注释应被整段剥掉）。

- [ ] **Step 3：跑复算脚本**

复算脚本**只有 spec §6 那一份**（`_docs/superpowers/specs/2026-09-28-sw-offline-design.md:230-262`，即那个 `javascript` 代码块的正文），本计划刻意不复制第二份——两处抄本迟早会漂。用行区间抽出来，别手抄：

```bash
sed -n '230,262p' /Users/liaolongdong/code/liaolongdong.github.io/_docs/superpowers/specs/2026-09-28-sw-offline-design.md > /tmp/sw-readings.cjs
head -2 /tmp/sw-readings.cjs
cd /tmp/swv && node /tmp/sw-readings.cjs; echo "READ_EXIT=$?"
```

Expected：`head -2` 第一行是 `// 离线层读数复算：…`、第二行是 `const fs = require('fs'), path = require('path'), vm = require('vm');`（本文写作时这两行现量如此，`node --check /tmp/sw-readings.cjs` 也过）。扩展名用 `.cjs` 是保险：主仓 `package.json` 现在**没有** `type` 字段（现量 `type= none`），`.js` 也能当 CJS 跑，但哪天加上 `"type": "module"`，`require` 就在运行时报未定义——`.cjs` 与这件事无关。脚本只读 `_site`、不写任何东西，打在导出树上没有副作用。

> **如果它以 `ENOENT: no such file or directory, stat '.../_site/assets/img/<某篇>/<banner>.webp'` 死掉**，不是脚本坏，是**那棵 `_site` 比清单旧**：清单来自 `_posts` 与 `_data/og_images.yml`，而图片晚于那次构建才落地。2026-10-10 在主工作树的陈旧产物上现量就是这个形状（`_site` 与其 `sw.js` 都是 12:01，而 `assets/img/ascii-rest-208-files/banner.webp` 是 12:10、文章 12:12；同一棵陈旧树上清单已漂到「文档 98 条 / 封面 50 张」，对 spec 的 84 / 39）。处置只有一条：**重建导出树**（或等 watcher 落定），不许给脚本加 `existsSync` 把缺件吞成 0 字节——`check-sw.mjs` 的判据 1 盯的正是同一件事，它在这种树上会红，那是它该有的表现。

Expected 输出形状（数值由当前内容决定，**不许对齐 spec 里的旧数**）：

```
BUILD=<12 位数字>
骨架 18 条：原文 367,648B / gzip9 156,896B
豁免 4 条：原文 54,174B / gzip9 21,637B
文档 <N> 条：原文 <B>B / gzip9 <B>B
封面 <N> 条：原文 <B>B / gzip9 <B>B
封面贪心：入桶 <k> 张 / <B>B；跳超单张 <位次>；跳撞总预算 <位次>
sw.js：<B>B / gzip9 <B>B
offline.html：6,223B / gzip9 2,691B
assets/js/editorial.min.js：41,738B / gzip9 13,775B
```

骨架 18 / 豁免 4 这两格是**常量**（清单在源里写死），漂了就说明 `sw.js` 被谁改过；`offline.html` 与 `editorial.min.js` 那两格漂了分别意味着兜底页和公共件动过，要单独点名。文档条数应等于 `_site/sitemap.xml` 里的 HTML 地址条数（判据 3 的口径，可以自己数一遍对照）：

```bash
grep -o '<loc>[^<]*</loc>' /tmp/swv/_site/sitemap.xml | wc -l
grep -o '<loc>[^<]*</loc>' /tmp/swv/_site/sitemap.xml | grep -c '\.html'
```

第一条 = 文档清单条数（sitemap 里只有站内 HTML，`<image:loc>` 不会被这个模式命中——它要的是字面 `<loc>`）。本文写作时在主工作树的 `_site` 上现量是 **98 / 97**（98 条里 97 条以 `.html` 结尾，剩下那一条是首页 `/better-blog/`），执行时以导出树的重量为准。判据 3 已经把这层关系钉成双向相等，这里数一遍只是为了让「复算脚本读的清单」与「sitemap」这两个来源在同一棵树上对得上。

- [ ] **Step 4：体积预算当场判一次生死**

`sw.js` 的 gzip 上限是 **16,384B**，2026-09-28 那轮是 9,726B。清单条目文本在产物里占约 31%，而 `_posts` 从 75 涨到 86 个文件，这一格一定会涨。用 Step 3 的读数算余量并写进 spec §7 那一行：余量若小于 2,000B，在本轮汇报里**明说**「按当前增速这一格什么时候到线」，不要静默改上限。

- [ ] **Step 5：回填 spec**

只改四类数字：§6 整张表 + `BUILD` 那一行、封面贪心落点那三条列表、§8.3 表头的「本轮读数」那一格、§10 交付状态里重跑的日期与三道门禁的末行。§5.4 里「`/page2/`…`/page10/` 那 9 个翻页视图」若与 `paginate_path` 现状不符，按产物重量后改数字（`grep -o '<loc>' ` 之外再看 `_site/page*/index.html` 的个数）。

> **读数陷阱（spec §6 已记，这里是要执行的动作）**：三段日期地址在终端与渲染层里会被折叠成 `/2016-06-18-hello-jekyll.html`。任何拼路径的自证都要先 `printf '%s' "$u" | od -c` 或 `u.split('/').length` 确认段数，别拿折叠形状去 `ls` 然后判成死链。

---

## Task 3：门禁一 `check-sw.mjs`（7 组判据，改完还对不对）

**Files:** 无改动，纯读 `/tmp/swv/_site`。

- [ ] **Step 1：跑**

```bash
cd /tmp/swv && node scripts/check-sw.mjs; echo "EXIT=$?"
```

Expected 末两行（条数取 Task 2 Step 3 的同一组，**两边必须逐字相同**）：

```
（体积：sw.js <B>B gzip / editorial.min.js <B>B gzip，上限 16,384 与 15,360）
✓ 离线层 <total> 条清单地址 × 7 组判据全绿（骨架 18 · 豁免 4 · 文档 <N> · 封面 <N>）
EXIT=0
```

- [ ] **Step 2：失败形状怎么读**

红行格式是 `[组名] 条目：说明`，末尾给总数与核过的条数。四组最容易在「内容涨了」之后才红的：

| 组 | 红了先查什么 |
|---|---|
| `[清单地址]` | 新文章的封面图路径里有空格 / 中文 / `.webp` 之外的变体；或 `og_images.yml` 指向了不存在的文件（并发会话在改这一份） |
| `[文档集合]` | `DOC_URLS ≡ sitemap HTML` 是**双向相等**。新加文章没进 sitemap（front matter 缺 `seo_description` 那类会被别的门拦，但这一条只比集合）——红了先比两边差集，别改判据成 `⊇`（spec §9 明说那会废掉这条判据的价值） |
| `[骨架完整性]` | 有会话往 `headAssets.html` 加了新的同源公共件；处置只有两条路（进骨架或进 `DEFERRED_URLS` 并写明理由），**都要过判据 2**，不要静默加 |
| `[注册面]` | 体积到线，或公共件里 `swdev` ±300 字符窗口内不再同时出现 `isSecureContext` 与 `serviceWorker`。后者是 spec §8.1 那条「假牙」补的判据，红了先看是不是有人把注册段拆到别处，而不是先改窗口大小 |

- [ ] **Step 3：把末行原文落进日志**

```bash
cd /tmp/swv && node scripts/check-sw.mjs > /tmp/swv-gate1.log 2>&1; echo "EXIT=$?"; tail -3 /tmp/swv-gate1.log
```

Expected：`EXIT=0`，`tail -3` 里那行 `✓ 离线层 ...` 就是 Task 8 提交信息与 spec §10 要引用的读数。**不要用 `node scripts/check-sw.mjs | tail -3` 的 `$?`**（那是 `tail` 的退出码）。

---

## Task 4：门禁二 `check-sw-teeth.mjs`（22 条变异，判据自己有没有牙）

- [ ] **Step 1：确认这台机器没有别的 headless Chrome 在跑（先记账再清，不许宽匹配）**

```bash
pgrep -fl 'headless' | head -20
```

Expected：要么空，要么全是**别的会话的**进程。若并列着跑，牙齿台账要拷 79MB / 960 文件的影子目录，会拖慢两边。有遗留的**本会话** Chrome 才处理，处理方式是记下 pid 再 `kill <pid>`——**禁止 `pkill -f headless` 这类宽匹配**（会连带杀掉并发会话的 CDP 工装）。

- [ ] **Step 2：跑（必须在导出树，源侧变异是就地改）**

```bash
cd /tmp/swv && node scripts/check-sw-teeth.mjs > /tmp/swv-gate2.log 2>&1; echo "EXIT=$?"
tail -4 /tmp/swv-gate2.log
```

Expected 末尾两行：

```
牙齿台账：22/22 条变异如期变红且红在对的组
✓ 收尾复核：真 _site 基线仍绿，源侧变异已全部还原
EXIT=0
```

> `22` 是常量（台账条数）。若少了条，红的不是实现，是台账自己在某个变异上没落地——脚本里 `shadowEdit` / `mutateSrc` 会在写完前比对字节并抛错，所以「注入 nothing、门禁仍绿」那种假牙它自己会喊。
> 这一本**不需要** `TK_SITE_DIR` / `SDL_SITE_DIR` 那类环境变量（那是 `verify-codec-browser-teeth.mjs` / `verify-search-deeplink-teeth.mjs` 的口径），它自己拷影子目录。别照别的 teeth 脚本的习惯给它加，加了会被当成「指到仓库 _site」拒跑的那条判据挡住。

- [ ] **Step 3：红了两类形状分得很开**

| 形状 | 归因 |
|---|---|
| `✗ 基线不绿，先修门禁再说牙齿` | Task 3 那一步的真红，先回 Task 3 |
| `✗ 影子副本自己就让门禁红` | 拷贝/软链 `vendor` 没做对，或导出树里 `_site` 是别的会话建的（Task 2 的构建必须在 `/tmp/swv` 里跑） |
| 某条 `✓ ... → [错组]` | 判据重叠了，红的位置对不上台账声明的组——这是台账缺陷，按 spec §8.2 三个实现约束的口径修台账，不要修判据 |

---

## Task 5：门禁三 `verify-sw-offline.mjs`（真 Chrome + CDP，断网 10 格）

- [ ] **Step 1：确认降噪两参数还在（spec §9 那行「共用」的耦合点）**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
grep -c "'--proxy-server=direct://', '--host-resolver-rules=MAP \* ~NOTFOUND, EXCLUDE 127.0.0.1'\]" \
  scripts/verify-sw-offline.mjs scripts/verify-idcard-browser.mjs
```

Expected：**每个文件恰好 1**（这是 spawn 参数那一行；2026-10-09 现量在 `verify-sw-offline.mjs:149` 与 `verify-idcard-browser.mjs:98`，行号会随内容漂，认串不认号）。任何一边是 0，那一边就会重新撞上「加载超时」，而且红的原因与本站无关（`document.readyState === 'complete'` 要等 `s.360.cn/so/zz.gif` 那一件，2026-09-28 实测一件占 10,181ms）。

- [ ] **Step 2：跑**

```bash
cd /tmp/swv && node scripts/verify-sw-offline.mjs > /tmp/swv-gate3.log 2>&1; echo "EXIT=$?"; grep -n '^# 断网自证\|^✓ \|^✗ \|^（临时 profile' /tmp/swv-gate3.log | head
tail -2 /tmp/swv-gate3.log
```

Expected：

```
# 断网自证：<一条失败的具体形状>
...
✓ 离线层核验 10/10 格通过
EXIT=0
```

- [ ] **Step 3：S4 的落定读数必须与 Task 2 的贪心复算一致**

```bash
grep -n 'S4' /tmp/swv-gate3.log
```

Expected 里这三项要与 Task 2 Step 3 那一行逐字同值：**入桶张数**、**记账字节 ≤ 预算 2,621,440B**、**跳过张数**。这是 spec §6「算法与运行时两处一致」的那颗钉。不一致时**以真跑为准**，改 spec 与 `sw.js` 的注释，不许改 `LIMIT` 去凑数。
「图桶另有 N 件是正文图随浏览进的」那个 N 会漂（同一天量到 1 与 0 两种），**不进判据**。

- [ ] **Step 4：`EXIT=2` 是环境门拒跑，不是实现红**

`✗ 断网没生效：拔掉服务后页面仍能直连（...），这一轮的读数全部作废` 只有一种成因：那台静态服务其实还通着（端口被占 / keep-alive socket 没断）。先 `grep -n 'PORT\|listen' /tmp/swv-gate3.log` 认这一轮自己抢到的端口，再证明**那个端口**上没人听——不要拿旧 pid 猜。spec §2.6 说得很死：CDP 的 `Network.emulateNetworkConditions(offline)` 管不到 SW 自己的 `fetch`，所以断网只能靠拔服务。

- [ ] **Step 5：再遇「加载超时」用 `stallReport` 点名，不要改预算**

超时行会自带 `readyState=... · 资源 N 条（已结束 x，挂着 y）· 挂着的：<地址>`。先认那几枚地址是不是站外信标；若是，回到 Step 1 查参数；若挂着的是本站地址，才怀疑并发负载，并把点名信息原样贴进汇报。`goto` 的 24 秒预算 ≈ 实测 1,583ms 首屏的 15 倍，**抬预算不解决问题**（spec §8.3 那张四种配置的表就是为这件事留的）。

---

## Task 6：伴跑五道（证明这一层没弄坏别的层）

`check-sw` 只核离线层自己的六个地方；下面这五道是「新加一层会不会撞到量具」的交叉面。全部打在 `/tmp/swv`。

- [ ] **Step 1：`verify-idcard-browser.mjs` 13 格（这一层与它的直接耦合）**

```bash
cd /tmp/swv && node scripts/verify-idcard-browser.mjs > /tmp/swv-gate4.log 2>&1; echo "EXIT=$?"
grep -n '阻塞集本地\|通过' /tmp/swv-gate4.log | tail -3
```

Expected：末行 `13/13 通过`、`EXIT=0`。5a 那一行的口径是「阻塞集本地 <B>B（7 件，可复算）+ 外链当场 <B>B」——本地那一项非 0 才说明 SW 没在 localhost 上抢走 5a 的量具（`?swdev=1` 没给，第 3 道闸门就该挡住）。**若 5a 报 `加载超时`，先回 Task 5 Step 1**，那是降噪参数，不是证件页。

- [ ] **Step 2：`toolkit-tests`（算法与数据面）**

```bash
cd /tmp/swv && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/toolkit-tests.mjs > /tmp/swv-gate5.log 2>&1; echo "EXIT=$?"
grep -E '^# (tests|pass|fail) ' /tmp/swv-gate5.log
```

Expected：`# fail 0`，`EXIT=0`。`tests/pass` 的条数以脚本自报为准（2026-09-28 那轮是 268 全过，`_posts` 涨了之后这一格通常不变，因为它是算法用例，不读文章数）。

- [ ] **Step 3：`check-seo.mjs` —— 这一道 spec §10 没记它跑过，必须补**

新增了一整页 HTML（`offline.html`）与一枚根级 `sw.js`，SEO 门禁扫的是全站产物，这是**真实的外溢面**。

```bash
cd /tmp/swv && node scripts/check-seo.mjs > /tmp/swv-gate6.log 2>&1
echo "EXIT=$?"; tail -6 /tmp/swv-gate6.log
```

先说预期与依据：`offline.html` 的 front matter 只有 `permalink: /offline.html`、**不带 `layout`**，而 `scripts/check-seo.mjs:440` 那个 `inScope` 是「front matter 带 layout 且 layout ∈ `headLayouts`」∪「文章页」∪「翻页视图」三样并起来的——所以它大概率**不在逐页契约（head / 描述 / keywords / JSON-LD）的扫描面里**。这一句是推理不是读数，跑了才算过。Expected：`EXIT=0`。

三种红的三种处置：

| 形状 | 处置 |
|---|---|
| `✗ SEO 门禁：源比产物新（源侧最新 …，产物最新 …）；先重新构建再跑` | 那棵树陈旧，回 Task 2 Step 1 重建。**不要**用 `--stale-ok` 放行——那个开关是牙齿台账专用（它自己会带着这个开关去起门禁）。2026-10-10 在主工作树的陈旧 `_site` 上现量这一条就是拒跑的，`--list` 也要带 `--stale-ok` 才吐得出清单（当时报「144 页 / 85 篇文章页 / 109 页带安装面」——陈旧树上的数，只作形状参考） |
| 因为 `offline.html` 而红（被算进收录面、或要求逐页契约键） | **那是实现缺陷而不是文档要迁就的例外**——按仓库纪律修代码：优先在 `offline.html` 补齐那几枚契约键（它带 `noindex`，与 spec §5.2 不冲突），而不是给门禁加白名单。修完回 Task 3/4 重跑（改了兜底页 = 判据 6 的自足与 noindex 要重验） |
| 因为**别的层**红（文章 front matter 缺 `seo_description`、词表那类） | 原样记账、点名红的地址归属哪一支，不在这一轮顺手修 |

> **`echo "EXIT=$?"` 必须紧跟在门禁那一行之后、中间不许有管道**：`node scripts/check-seo.mjs | head -6; echo $?` 打出的是 `head` 的 0，那条拒跑行会被读成「绿」（上一段我自己就这么错过一次）。
> `check-seo.mjs` 认的产物目录默认是 `./_site`（`--site=` / `--root=` 可指到别处），在 `/tmp/swv` 里跑就对了。
> **若为了放行而动了 `scripts/check-seo.mjs` 本身，必须连它的牙齿一起重跑**：`node scripts/check-seo-teeth.mjs --root=/tmp/swv --site=/tmp/swv/_site`（这本不带 `--stale-ok`，它自己会带着那个开关去起门禁，多写一个无效参数只会让这一行看起来与上一行不同口径）。
再补两条自证的旁证：`grep -c 'offline' /tmp/swv/_site/sitemap.xml` 与 `_site/index-all.html` 里 `offline` 的命中都应是 **0**（判据 6 的另一半，这里用产物直接数一次）。

- [ ] **Step 4：另外两道「已知红」照跑、照记，不顺手修**

```bash
cd /tmp/swv && node scripts/check-tools-surface.mjs > /tmp/swv-gate7.log 2>&1; echo "EXIT=$?"
node scripts/verify-plan-blocks.mjs > /tmp/swv-gate8.log 2>&1; echo "EXIT=$?"
tail -4 /tmp/swv-gate7.log; tail -4 /tmp/swv-gate8.log
```

2026-09-28 那轮这两道各红 1 条 / 2 个目标，红的都在并发会话的在途文件里（`_data/onlineTools.yml`、`scripts/check-tools-surface.mjs`）。**注意它们读的是同一棵树里的 `_data` 与 `scripts`**：导出树是从 `main` 出的，只含已跟踪内容，所以如果对方那两份在途改动还没提交，这一轮跑出来的红/绿与主工作树可能不同——**以导出树为准，并在汇报里写清「另一棵树上结果不同」**。别为了凑绿去改那两个文件，也别把它们的红算成这一层的。若对方已经提交了那一版，这两道大概率自己变绿，认那个提交号写进汇报。

---

## Task 7：需要用户拍板的四件事（不得代跑，不得默认）

这四件都是「怎么做都能自圆其说、但只有站点主人能定」的口径，必须先问。

- [ ] **决策 1：`dev/js/editorial.js` 里那一枚非本层 hunk 怎么处理**

现状：同一个文件三个 hunk，其中 `@@ -3087,9` 那段「tools.html 8 颗 → 9 颗」的注释不是本层的（写于 2026-10-07 前后，属 CTA 磁吸/工具页那一支）。三个选项：

| 选项 | 做法 | 代价 |
|---|---|---|
| A（推荐） | **只提本层那两段**：Task 8 Step 2 的「摘掉外来 hunk → 提 → 原样装回」流程 | 有一个几秒的窗口该文件少了别人那段注释；靠 Step 2 前后的两次 `git diff` 自证 |
| B | 连那枚注释一起提（本层提交里带上别人的话） | 归属混进提交史；若对方随后又改那段，会多出一次无谓冲突 |
| C | 等对方先提 editorial.js，本层随后再提 | 最干净，但本层被别人的节奏挡住；`boot()` 与 `initOffline()` 要重放一次（内容不变，只是变基） |

- [ ] **决策 2：要不要给读者一个「本站可离线」的可见提示**

spec §10 第 1 条明说本层是**无声的收益**，且真加提示措辞必须走 `_docs/superpowers/specs/2026-09-25-blog-online-tools-design.md` §5.5「合规与对外文案口径」，不在本层自立一套。默认：**不加**。要加就单开一轮（涉及 HTML 新增字节，会撞 §7 那条「页面 HTML 零新增字节」的口径）。

- [ ] **决策 3：`sitemap.xml:29` 那句注释「/page2/ … /page9/ 共 8 个翻页视图」而产物是 9 个**

`sitemap.xml` 是并发会话的文件（工作树已改未提交）。spec §5.4 末尾把它记成待办。本层**不动它**；要不要修、由哪一轮修，交给用户。

- [ ] **决策 4：版本号与 CHANGELOG 随不随这一笔**

spec §10 第 3 条把这件事写死成「归发布节点，本轮不动」，而 Task 8–9 就是那个发布节点，所以此处必须有个落点。现状：`CHANGELOG.md` 存在且只有已发布版本条目（最近一条 `43ab648 feat(blog): 2.1.0 …`），没有「未发布」一节；`_config.yml:41` 写着 `version: '2.1.0'`，而**`_config.yml` 此刻在并发会话的暂存里**（`M ` 状态）。三个选项：

| 选项 | 做法 | 代价 |
|---|---|---|
| A（默认，与本层规模相称） | 本笔不动版本号与 CHANGELOG，等下一次成批发版一起收 | 读者从 CHANGELOG 看不出「站现在可离线」 |
| B | 只加 CHANGELOG 一节（不碰 `_config.yml`） | 出现「有版本条目、版本号没升」的口径分叉 |
| C | 升版本 + 写 CHANGELOG | 要动别人暂存里的 `_config.yml`，与本层的边界不符 |

---

## Task 8：提交（仅在用户授权后执行）

**Files:** Task 7 决策 1 选 A 时，`dev/js/editorial.js` 会有一次「摘—提—装回」的短窗口。

- [ ] **Step 1：写提交信息文件**

**不要在一条 Bash 里嵌套 heredoc**——本仓出过真提交，信息正文成了 `MSG cat …`（教训记在「提交信息走文件不走 heredoc」）。用 **Write 工具**落这个文件：

`/tmp/sw-commit-msg.txt`：

```text
feat(offline): 站点离线层——Service Worker 让站内文字断网可读

注册搭公共件 editorial.min.js 上车，页面 HTML 零新增字节；sw.js 是 Jekyll 渲染的仓库根
页面，骨架/豁免/文档/封面四份清单与 sitemap.xml 同源。文档 network-first、同源静态件
cache-first、跨源一律不缓存；未命中给 offline.html 并以 503 端出。三道门禁：构建期 7 组
判据、22 条变异的牙齿台账、真 Chrome 断网 10 格。
```

然后用**独立的一条 Bash** 把本轮门禁末行追在同一个文件后面（每行都要是日志里的原文，不许手写读数）：

```bash
{
  printf '\n门禁读数（本轮，导出树 /tmp/swv）：\n'
  tail -1 /tmp/swv-gate1.log
  grep -E '牙齿台账|收尾复核' /tmp/swv-gate2.log | tail -2
  tail -1 /tmp/swv-gate3.log
  tail -1 /tmp/swv-gate4.log
  grep -E '^# (pass|fail) ' /tmp/swv-gate5.log
  tail -1 /tmp/swv-gate6.log
} >> /tmp/sw-commit-msg.txt
wc -l /tmp/sw-commit-msg.txt
```

Expected：追加的六段各非空（`tail -1` 打出空行就是那本日志没跑过，回对应 Task 补跑，**不要手写一行读数充数**）；`wc -l` 给出总行数，`cat` 一眼确认信息正文没被 shell 吃掉。
这六段里若有哪一道的末行是红行（例如 `check-seo` 红在别人的文章上），**照原样带上并在下一行注明归属**——提交史里的读数必须是那一轮的真形状，粉饰过的读数后面没人能推翻。

- [ ] **Step 2：只提本层那两段（决策 1 = A 时）**

先把 editorial.js 里那枚外来 hunk 临时摘掉。**用 Edit 工具改，不要用 sed/脚本批量**；改动就是把那 4 行注释还原成 `git show HEAD:dev/js/editorial.js` 里的原文。

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
cp dev/js/editorial.js /tmp/editorial.with-foreign-hunk.js   # 先备份，装回用它
git diff HEAD -- dev/js/editorial.js | grep -c '^@@'          # 应为 3
```

然后 Edit 掉外来 hunk（还原成 HEAD 原文），再自证只剩本层两段：

```bash
git diff HEAD -- dev/js/editorial.js | grep -c '^@@'          # 期望 2
git diff HEAD -- dev/js/editorial.js | grep -c 'initOffline'  # 期望 2（定义那行 + boot 里那行调用）
```

把新文件暂存、pathspec 提交（**一条 Bash 连着做完，窗口越短越好**）：

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
git add -- sw.js offline.html scripts/check-sw.mjs scripts/check-sw-teeth.mjs \
  scripts/verify-sw-offline.mjs scripts/verify-idcard-browser.mjs \
  _docs/superpowers/specs/2026-09-28-sw-offline-design.md \
  _docs/superpowers/plans/2026-10-10-sw-offline.md
git diff --cached --name-status -- sw.js offline.html scripts/check-sw.mjs \
  scripts/check-sw-teeth.mjs scripts/verify-sw-offline.mjs scripts/verify-idcard-browser.mjs \
  _docs/superpowers/specs/2026-09-28-sw-offline-design.md \
  _docs/superpowers/plans/2026-10-10-sw-offline.md | awk '{print $1}' | sort | uniq -c
# 期望 7 个 A + 1 个 M（M 是 verify-idcard-browser.mjs，其余七件是新增）
git commit -F /tmp/sw-commit-msg.txt -- sw.js offline.html scripts/check-sw.mjs \
  scripts/check-sw-teeth.mjs scripts/verify-sw-offline.mjs scripts/verify-idcard-browser.mjs \
  dev/js/editorial.js _docs/superpowers/specs/2026-09-28-sw-offline-design.md \
  _docs/superpowers/plans/2026-10-10-sw-offline.md
```

> 为什么 untracked 文件要先 `git add`：`git commit -- <path>` 对不在 index 里的新路径会 `error: pathspec ... did not match any file(s) known to git`（git 2.23 行为）。`git add` 只列显式路径，绝不带 `.`。
> 为什么提交用 pathspec 形式：index 里有并发会话的暂存内容，裸 `git commit` 会把它们一起吞进这一笔。

- [ ] **Step 3：立刻装回外来 hunk 并自证**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
cp /tmp/editorial.with-foreign-hunk.js dev/js/editorial.js
git diff HEAD -- dev/js/editorial.js | grep -c '^@@'   # 期望 1（只剩别人那枚注释）
git diff HEAD -- dev/js/editorial.js | grep -c 'initOffline'   # 期望 0——本层那段已进 HEAD
```

Expected：三条都对。若第三条不是 0，说明本层那段没进提交（Step 2 的 pathspec 漏了 `dev/js/editorial.js`），**此时不要 amend**，停下来汇报，补一笔新提交。

- [ ] **Step 4：认提交内容与「别人的暂存仍在」**

```bash
git show --stat --format='%h %s' HEAD
git status --short | head -30
```

Expected：`git show --stat` 恰好 **9 个文件**（7 新增：`sw.js`、`offline.html`、`scripts/check-sw.mjs`、`scripts/check-sw-teeth.mjs`、`scripts/verify-sw-offline.mjs`、spec、plan；2 改动：`dev/js/editorial.js`、`scripts/verify-idcard-browser.mjs`）——**逐行核对，多一行就是吞了别人的东西**；`git status --short` 里并发会话那批 `M ` / `MM` 条目**仍在**（它们的暂存状态不该被这一笔带走）。成败只认 `git log --format='%h %s' -1` 打出的那一行，别认命令的 echo。

- [ ] **Step 5：在提交出去的那一棵树上重验一次（「跑门的树等于提交的树」）**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
rm -rf /tmp/swc && mkdir -p /tmp/swc
git archive HEAD | tar -x -C /tmp/swc
ln -s "$PWD/vendor" /tmp/swc/vendor
ln -s "$PWD/node_modules" /tmp/swc/node_modules
cd /tmp/swc && npx --no-install vite build && bundle exec jekyll build
node scripts/check-sw.mjs > /tmp/swc-gate1.log 2>&1; echo "EXIT=$?"
node scripts/check-sw-teeth.mjs > /tmp/swc-gate2.log 2>&1; echo "EXIT=$?"
```

Expected：两道 `EXIT=0`，末行与 Task 3 / Task 4 的读数逐字相同（同一份内容、`BUILD` 会漂，条数与字节不漂）。这一格顺带证明「干净检出自洽」——别人 clone 这份提交也能跑绿。

---

## Task 9：发布节点（push 与线上复验，两步都要单独授权）

- [ ] **Step 1：先报告，取得「推」的明确授权**

汇报里必须含：Task 1 Step 3 的 ahead/behind、本次要推的提交数、CI 只在 `master` 触发（`USAGE.md:63-77`）、以及「`origin/master` 比本地多 N 笔、这些是别人的提交」。

- [ ] **Step 2：处理 behind（这一步同样要先授权——它会动分支）**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
git fetch origin master
git rev-list --count main..origin/master
```

若 >0：用 `git merge origin/master`（**不要 rebase 已存在 main 上的提交**；也不要 `--no-verify`）。冲突面最大概率是 `dev/js/editorial.js`——按「保留双方」的原则解，绝不丢弃对方改动。解完回 Task 8 Step 5 重跑一次导出树自证。

- [ ] **Step 3：推（方式一，`USAGE.md:79-82`）**

```bash
cd /Users/liaolongdong/code/liaolongdong.github.io
git push origin main:master
```

Expected：`To https://github.com/...` + `master -> master`。**已知坑**（本机实测过）：HTTPS push 偶发静默卡住 → 用 `-c http.versionHTTP/1.1 -c http.postBuffer=1` 重试；推完 `ls-remote` 也可能挂，用 API `/repos/liaolongdong/better-blog/branches/master` 认 sha（该端点的 sha 在 `commit.sha`，不在顶层）。**不要用 `pnpm deploy`。**

- [ ] **Step 4：等 Actions 建完，验线上产物的四件事**

```bash
curl -s --max-time 25 -o /dev/null -w '%{http_code} %{content_type}\n' \
  https://liaolongdong.github.io/better-blog/sw.js
curl -s https://liaolongdong.github.io/better-blog/sw.js | grep -c '{{\|{%'
curl -s https://liaolongdong.github.io/better-blog/sw.js | grep -o "const BUILD = '[0-9]\{12\}'"
curl -s https://liaolongdong.github.io/better-blog/sitemap.xml | grep -o '<loc>[^<]*</loc>' | wc -l
```

Expected：第一条 **200** 且 `content_type` 含 `javascript`（MIME 不对的话注册直接失败，而页面一点错都不报——`check-sw-teeth` 抓不到这种红，只有线上量得到）。本文写作时这一条现量是 `404 text/html`，也就是**尚未发布**，它是 Task 8 那笔提交之前的基线，别当成本轮的判据。
第二条 **0**（产物里不许有 Liquid 残留）。第三条打出一枚 12 位数字——它是 runner 上的 **UTC** 时刻，与本地 `+0800` 的那一枚不同属正常（同一族已知现象：线上产物与本地只差时区后缀，比对一律认集合不认字节）。第四条应等于 Task 2 Step 3 报出的文档清单条数。

> 顺带一条口径：Pages 给静态件打的 `cache-control: max-age=600`（现量于 `/better-blog/`）不会让离线层滞后——浏览器对 **SW 脚本本身**的更新检查绕过 HTTP 缓存，老访客最迟在下一次导航就会拿到新的 `sw.js`，新 `BUILD` 一落地，activate 时旧桶被删。

- [ ] **Step 5：线上离线行为的手测由用户在真浏览器做（本计划不代跑对外动作）**

给用户这四步口令，别替他点：
1. 打开 <https://liaolongdong.github.io/better-blog/> → DevTools → Application → Service Workers，应有一条 scope 为 `/better-blog/` 且状态 activated；
2. Network 面板勾 Offline，点一篇**从没点过**的旧文章 → 应照常出正文（补全已在后台装进桶）；
3. 地址栏输 `/better-blog/page3/` → 应是那张兜底页且状态码 503（spec §5.4 的有意后果）；
4. 取消 Offline 再刷新 → 读到最新版（network-first 的证据）。

---

## Task 10：收尾账

- [ ] **Step 1：spec §10 交付状态回填**

把「已完成并验过」那段改成**本轮**的读数与 BUILD，并显式记下三件事：Task 6 Step 3 补跑了 `check-seo`（那是上一轮漏的一道）、Task 7 三个决策的落点、以及并发会话那两道红的归属。

- [ ] **Step 2：记忆只沉淀「换个项目也成立」的事实**

已在本轮之前写进记忆的（系统代理架空 `--host-resolver-rules`、CDP offline 管不到 SW、headless 阻塞外链）不要再写一遍。若执行中新撞见形状，按 `auto memory` 口径落盘，不要落进仓库文档。

- [ ] **Step 3：清理自己的临时物**

```bash
rm -rf /tmp/swv /tmp/swc
ls /tmp/editorial.with-foreign-hunk.js   # 提交后确认工作树与它一致，再删
```

`_site` 与 `assets/js/*.min.*` 是仓库构建产物（已 ignore），不动。
