---
layout: post
title: 三家并行工作区翻车了：唯一装上的那家，0.213 秒就把我拒了
subtitle: 为了这期横评，我在 /tmp 造了个 400 文件的假仓库，手动开 5 个工作树吃掉 40,020 KB，又拿 APFS 裸测复算了 worktrunk FAQ 里那句 2.6TB by du and 0.7TB on disk
seo_short_title: 三家并行工作区实测：0.213 秒被拒
date: 2026-09-21
categories: [AI, 开源实测]
cover: /assets/img/one-worktree-per-agent/banner.webp
tags: AI 前端 开源 Agent 工具
---

![三间并排的工作树小屋，门上贴着版本不够的条子](/assets/img/one-worktree-per-agent/banner.webp)

0.213 秒。这是 `wt switch b2` 在这台机器上花掉的全部时间，也是这期横评里我真的执行成功的一次外部 CLI。它回我的那一行是：

```text
✗ Git 2.23.0 is unsupported; Worktrunk requires Git 2.43.0 or newer
```

现场一点没动。`git worktree list` 里只有我前面手动开的那几个。

榜上有三家在卖同一件事：一个 agent 一个工作区。stablyai/orca 74,323 星、max-sixty/worktrunk 8,261、pacifio/atlas 5,135，三个数都是 2026-09-21T14:05:07Z 从 REST 同一分钟抓的。并行我一次都没测成。但为了搞清三家脚下那块地，这两个原语我自己量了一遍。

## 一个人、一台 13.1、三家没一家跑成并行

先把场景说死。我一个人，一台 x86_64 的 macOS 13.1，手上是 wxt + Vue 3 + TypeScript 的插件项目和这个 Jekyll 博客。我要回答的是：同时开三个 agent 改同一个仓库，磁盘受不受得住，谁替我管这些目录。

跑到一半的：那个 darwin-x86_64 预编译二进制，7,106,016 字节，只走到版本检查那一步。读完源码的：worktrunk main 分支 tarball（19 MB / 1,715 个文件）和 atlas v0.3.3 tarball（78 MB / 6,568 个文件）。装不上的：atlas 要 bun@1.4.0，我机器上没有 bun；orca 那个 cask 要拉 212,624,680 字节的 zip，按实测 61,122 B/s 的单流是 58 分钟，而 cargo、rustc、bun、go 四个 `which` 全部 not found。

没测的：真并行、多机、SSH worktree、Windows、stacked branches，一家都没有。

抓取窗口 2026-09-21T13:58:50Z 到 15:00:02Z。

四个周榜 HTML 不花配额，全拿了；core REST 用到 20/60；Search 只打 1 次，因为无 token 时它是每小时 10 次而不是 60 次，这条我上期踩过，条件全合并进一条查询里发。

这两个原语我自己跑了（`git worktree add`、`cp -Rc`），靶子是 /tmp 里造的假仓库：400 个 .ts 文件、tracked 内容 8,013,490 字节、`.git` 1,732 KB。它不是真实项目，所以下面每一个 KB 都只能当量级读，别当 benchmark 引。

## Worktrunk：0.213 秒就把我拒了，现场一点没动

那道口是一条常量，`src/git/version.rs:31`：

```rust
const MINIMUM_GIT_VERSION: GitVersion = GitVersion::new(2, 43, 0);
```

`docs/src/content/docs/faq.md:289` 那句 Worktrunk requires Git 2.43 or newer 和它对得上。检查在 `src/main.rs:1207` 用 `scope.spawn(require_minimum_git)` 并发起来，所以拒得快。

我这台机器的 git 到 2.39.2 就到顶了。`/usr/bin/git` 是 Apple Git-143 的 2.39.2，PATH 上排在它前面的 `/usr/local/bin/git` 是 2.23.0。换 2.39.2 再问一次：

```text
✗ Git 2.39.2 is unsupported; Worktrunk requires Git 2.43.0 or newer
```

差 3 个 minor。我查了 brew 的 git formula，stable 2.55.0，bottle 的 tag 只有 arm64_golden_gate / arm64_tahoe / arm64_sequoia / arm64_sonoma / sonoma / x86_64_linux，没有 ventura。13.1 x86_64 拿不到预编译包，剩下的只有源码编译，而改这台机器的工具链我不在无人值守里做。

它 README:33-38 的卖点是 manage 5-10+ in parallel，同一段连打字成本都替你算了：分支名要打三遍，`git worktree add -b feat ../repo.feat`，再 `cd ../repo.feat`。这条我认，手动开第五个的时候我确实在反复敲同一句。`wt --version` 出 wt v0.79.0；`wt --help` 七个子命令都列得出来。


这仓库的测试口径有点吓人：1,715 个文件里 1,199 个是 `.snap` 快照，220 个路径里带 switch；`src` 下 207 个 .rs 合计 163,296 行，光 `src/commands/worktree/switch.rs` 一个文件 2,336 行。`src/copy.rs` 645 行，首行注释写着 Directory copying with reflink (COW) and rayon parallelism，末尾 `:592-614` 专门处理 node_modules 嵌套深度撞路径长度上限那一类破事。FAQ 明说不做的只有一件：stacked branches 要拿社区工具 `worktrunk-sync`（跑起来叫 `wt sync`）。73 个贡献者，max-sixty 一个人 4,009 次提交。还有一件我差点写错的：REST 的 license 字段是 NOASSERTION，可根目录摆着 11,813 字节的 LICENSE，头两行是 This project is dual-licensed under MIT and Apache-2.0，`Cargo.toml:66` 写着 `license = "MIT OR Apache-2.0"`。API 那个字段不能当许可证读。评论最多的两条 issue 是 #3093（27 条）和 #1982（20 条），一条要 hook 审批、一条要自定义工作树目录名；全仓 open 39 条，这两条 labels 都是空数组。

## 它 FAQ 第 59 行写着的事，我拿 400 个文件验了一遍

`faq.md:59`：Worktrees share one `.git`. Each adds a checkout of the tracked files, plus whatever gitignored build output you copy in.

那个倍数我去量了。

| 我做的 | 用时 | 新目录 du |
|---|---|---|
| 第 1 个 | 0.675 秒 | 8,004 KB |
| 第 2、3、4、5 个 | 0.609 / 0.404 / 0.366 / 0.365 秒 | 每个都是 8,004 KB |

tracked 内容 8,013,490 字节，一个工作树 8,004 KB，倍数 1.00；五个吃掉 40,020 KB，共享的只有 `.git` 那 1,732 KB。

![五个工作树并排，每个底下都压着一整份代码](/assets/img/one-worktree-per-agent/01-concept-worktree-cost.webp)

> 每多开一路 agent，磁盘上就多一整份代码。

这不是我替谁挖出来的，worktrunk 自己写在 FAQ 第 59 行。让我意外的是倍数恰好 1.00，不多不少，git 对 checkout 一个字节都不共享。

## 📎 cp -Rc 省的是块，不省 inode：我测到 2.1 倍

step.md:513-518 有张表：14 GB 的 `target/`，`cp -R` 要 2 分钟、占 14 GB；`cp -Rc`（`wt step copy-ignored` 干的就是这件事）要 20 秒、占 ~0。6 倍。

14 GB 我拿不动，这块盘剩 7 GB 出头。换 6,003 文件 / 116,160 KB 的靶子做同一件事：

```text
cp -R   : 2.53 s
cp -Rc  : 1.30 / 1.27 / 1.04 / 1.04 s
```

均值 1.16 秒，比值 2.1 倍。它那个 6 倍我没摸到，可能是我环境不同——我这靶子是小文件堆，而 14 GB 的 target/ 里躺着大个的 .rlib。

du 和 df 对不上才是我要的那个数。4 个 reflink 副本，du 每个都照报 116,160 KB，df 上卷 used 一共只涨 123,408 KB：头一份是完整拷贝，剩下 4 次合计 7,248 KB，平均 1,812 KB，约表观体积的 1.6%。

du 报 5 份，df 认 1.06 份，4.7 倍差。

![du 报五份，df 底下的真实水位只有一点零六份](/assets/img/one-worktree-per-agent/02-infographic-du-df.webp)

到这儿 faq.md:62 那句 On one machine, 56 worktrees of a Rust repository with a 40GB `target/` came to 2.6TB by `du` and 0.7TB on disk 我就信了。2.6 TB 除以 56 是 46.4 GB，跟它自己说的 40 GB target/ 对得上。

它 step.md:522 还有半句：reflink 是按文件的，所以拷贝时间跟文件数走。我去撞这句，等字节、两种形状：

```text
12,000 个 1 KB 文件（du 48,000 KB）  → cp -Rc 3.06 s
12 个 1 MiB 文件（du 12,288 KB）     → cp -Rc 0.07 s
```

43.7 倍。省块，不省 inode，也不省逐文件的 syscall。node_modules 恰好是前者那种形状。顺手一笔 APFS：12,000 个 1 KB 文件实占 48,000 KB（每文件 4 KB 块起跳），表观 12,288 KB 只是它的 26%。

## atlas：78 MB、23 crate，没写一句 git 版本要求

atlas 不卖并行工作区。它 README 给自己的定位是 Source control for coding agents：每次 agent run 出 checkpoint，commit 关联回那次 session 的 prompt、tool call 和推理；Claude Code、Codex、它自己的 agent、ACP registry 上的东西可以并排跑在同一个 codebase 上，带 shared memory；Local by default。

grep 全仓，worktree 命中 124 处，集中在 `crates/atlas-checkpoint/src` 的 checkpoint / git / schema / sketch 四个 .rs 和 `atlas-git/src/status.rs`。atlas 里 git 最低版本声明我找不到，全仓 grep 三种写法各 0 命中：`git 2.`、`MIN_GIT`、`minimum_git`。三家把它做成硬门的只有一家。解包 78 MB / 6,568 个文件：.rs 2,718、.svg 1,277、.ts 1,105、.tsx 318、.toml 158、.bazel 112；src 下 716 个 ts/tsx 合计 159,351 行；crates 23 个。packageManager 是 bun@1.4.0，没有 engines 字段。贡献者 38 个，pacifio 一个人占 464 次。它是三家唯一写了支持平台的：README 说 macOS 13+ 和 Windows 10+ (x64)，Linux 从同一套 Tauri 代码出但 untested。PR #278 的标题就是 feat(linux): port Atlas to Linux with packaging pipeline…，跟那句 untested 互相印证。我在支持范围内，装不上。README 里还留着一行字面量注释 `<!-- #todo homebrew tap so this becomes brew install atlas -->`。埋点有：package.json:13/14/18 的脚本套 `node scripts/with-posthog-env.mjs`，posthog-js 写在第 100 行，TELEMETRY.md:12-13 说它只报 renderer 失败。它的 27 条 open 里我拉到的第一条是 #261，标题 Add font size options，标签 bug，2026-09-15 开的。

## 那台 212 MB 的 orca，我连清单都没拿全

`git clone --depth 1` 两次都断，一次 HTTP/2 framing，一次 LibreSSL 超时。改打 `GET /git/trees/main?recursive=1`，630 秒时 curl 报 28，回来 5,634,829 字节的截断响应，我从里面正则救出 17,268 个 blob 条目、合计 174.1 MB。REST 报的仓库 size 是 840,683 KB。

所以这一段每一个数都是下界。

下界里：.ts 13,612 个 / 85.8 MB，路径含 worktree 的 795 个，顶层 src 12,039、mobile 3,219、config 694、docs 523、cloud 514。README:49-51 正好对上这期主题：Fan one prompt across five agents, each in its own isolated git worktree — compare the results and merge the winner. 五路 agent 各开一棵树。我拿 1.00 这个倍数去照它那句 isolated，隔离是真的，省不是。

单说三处：CLAUDE.md 全文 11 个字节，内容是 `@AGENTS.md`；config/scripts 下 111 个 `*-benchmark.mjs`，而 docs/audits/ 里把 before/fixed × electron/node 四份 results.json 提交进了仓库。`docs/reference/worktree-scan-fingerprint.md` 14,858 字节的正文我拿到了，同目录另有一篇 malformed-worktree-registration-removal.md 我只确认了文件名，raw 两次超时没读到内容。这个审计习惯比我手上见过的大多数项目重。发布节奏 v1.4.203、204、205、206 落在 09-15、16、17、20 四天四个版本，mac zip 从 207,141,030 涨到 212,624,680 字节；最后一版 push 是 09-21T13:52:55Z，比我抓榜只早 12 分钟。仓库 2026-03-17 建，4,864 个 fork，381 个贡献者里排第一的 nwparker 一个人有 4,196 次。6,368 个 open 含 PR，按评论数排第一条是 #9793（205 条），编号已经排到 #21,527。pnpm-lock.yaml 533,549 字节、package.json 26,726 字节。

## 三桩旧账：gods-eye-view 那三条、掉榜那两条、09-10 那两条

- **key-setup.js 的 266–273 换位没有**：没有。@main 那份 15,245 字节 / 344 行，跟我 09-16 的 clone `diff -u` 无输出、exit 0、两边都 344 行，`req.destroy()` 还排在 respond 前面。顺手查有没有测试开始断言 413：当前 HEAD 的 keySetup.test.mjs 65 行加 keySetupHardening.test.mjs 401 行，grep `413|too large|8192|overflow` 命中 0。我另外拿 20 行 stdlib 把这段 handler 顺序抄成两个变体跑了一遍：原顺序那版只拿到 `ERR ECONNRESET`（15 ms），413 挪到 destroy 前面那版才拿到 `HTTP 413 {"error":"Request too large"}`（5 ms）。第一版脚本我自己写挂了：

  ```text
  Error [ERR_HTTP_HEADERS_SENT]: Cannot write headers after they are sent to the client
  ```

  加了一个 `sent` 闸门才有上面那两个结果。上期那个 clone 还在 /tmp，HEAD 0d41b6b，但 node_modules 已经不在了，222 MB 依赖按 61,122 B/s 重装要一小时。所以这次只有最小复现，没有原机复现，这是本篇一手程度上的一处真实退步。
- 第二条，#22 进没进 release notes。没有新 release，还是那两个（v0.1.0、v0.1.1）；#22 开到现在 27 天 0 条评论。上期那个条件成立，我继续不拿 4174 的 preview 当本地服务用。
- 第三条，PERFORMANCE.md 放没放出可跑脚本。还是没放。scripts/ 现在 93 个文件，唯一带 perf 的是 qa-perf.mjs（21,316 字节 / 413 行），头注释自己写着用相对帧数断言、no wall-clock GPU numbers，产不出 initialSettle。上期那个 6,733 ms 维持原口径不更新。
- mattpocock/skills 的第一个 plugin tag：第二次复查，tags 最新还是 v1.2.3。继续挂着。
- **i-have-adhd 那个 5.8 倍差**：成立，而且继续衰减。47,261（09-17）到 49,625（本期 14:50:31Z），+2,364 摊 4.026 天 = 587 星/天，比上期摊平的 847 掉 30.7%；而 09-17 页面显示的周增 13,737 折 1,962/天，是我实测日速的 3.3 倍，跟 magnitude 那次同一个成因，而它本期已掉出四个榜，页面值拿不到新的了。

同一把尺子上两个数：jev-ultrafast 上期建仓 17 小时攒 1,033 星，本期 14,539，摊 3,387 星/天、14.08 倍；gods-eye-view 36,658 到 40,272，摊 905 星/天，而页面周增 8,111 折 1,159/天，是我实测的 1.28 倍，方向和上面两个反着来。

撤回两条，不再挂账。09-10 那两条第三次顺延到期：HyperFrames 的全量 render 要 2 GB 临时盘，我这期是三家横评、卷剩 7 GB 出头，真腾不出来；archify 的 `brands capture <url> --json`，它这周掉出四个榜（archify、i-have-adhd、mattpocock/skills、magnitude 四个全名在那 76 行里 grep，命中 0），为一个掉榜工具单独装一遍不值。规则我上期自己定的，第三次就是撤回。

job B 那 4 条这期轮到 A，不结算，但其中两条零成本 `npm view` 顺手读了：miniflare 的 `dependencies.sharp` 已到 0.35.4（上期钉 0.35.2），上游自己解掉了，我那个“加 overrides 抬版本”的动作前提消失；tailwindcss 的 insiders 仍是 0.0.0-insiders.41d9cae，latest 4.3.3、next 4.0.0、v3-lts 3.4.19，它没变成唯一的 prerelease 通道。

同一次抓取我还对了页面值和 REST 值：6 分钟后再打，orca 74,320→74,323、atlas 5,123→5,135、worktrunk 8,261 一动不动。三个数不同向，页面上那列 stars this week 我没拿它摊过增速。

## 上期那 18 个红测试，需要的东西一直在这台机器上

上期结尾我写的是先把这台机器的 node 升到 24.14、git 升到认 `--initial-branch` 的版本。这周我做了个便宜得多的实验：

```bash
$ /usr/bin/git init --quiet --initial-branch=main /tmp/gt24   # exit 0，分支名 main
$ git init --quiet --initial-branch=main /tmp/gt25           # PATH 上那个 2.23.0
error: unknown option 'initial-branch=main'
```

2.39.2 认这个选项。上期那 18 个红，需要的东西一直在这台机器上，只是被 PATH 顺序挡住了。node 24 这台确实没有，nvm 目录里最高 v22.19.0，`/usr/local/bin/node` 是 v16.16.0，这一半我撤回，换成一条便宜的：下次跑任何前端仓库，先 `which -a git`，把 PATH 换一遍再报数。

---

## ≥2.43、78 MB、212 MB：三家的门槛、体积和成本

这张表怎么读，口径先说清。前两行（星数、形态）是 REST 和 README 给的，谁都能复核。第三行那道版本门，源码级证据我仅在 Worktrunk 找到；另外两格一家是我 grep 不到、一家是我压根没拿到源码，两种「没有」不是一回事，格子里我分开写了。到手体积那行是我真的拉过的字节数，不照官方那句“轻量”。工作树磁盘那行是全文唯一一格我自己的数据，靶子只有 400 个文件、8 MB 出头，跟 orca 那种 src 下 12,039 个文件的仓库不是一个量级，只能读成量级，读不成结论。遥测那行 atlas 我数出 4 处位置，另两家我连查的手段都没有。

| 维度 | worktrunk | atlas | orca | 我这一手实测 | 我没碰 |
|---|---|---|---|---|---|
| 星数 @14:05:07Z | 8,261 | 5,135 | 74,323 | — | 页面周增那列，我没拿它算增速 |
| 形态 | Rust CLI | Tauri，Rust + React | Electron | 只有 wt 这个二进制跑过 | 两家的 GUI |
| git 版本门 | 2.43 硬门，version.rs:31 | 源码里没声明 | 我没读到源码 | 换 2.39.2 照样被拒 | orca 那 795 个含 worktree 的路径 |
| 到手体积 | 7,106,016 B 的包 | 78 MB 解包 | 212,624,680 B 的 zip | 3,478 秒，我没下 | 断点续传、增量更新 |
| 工作树磁盘 | faq:59 写明各一份 | 124 处提及 | README:49-51 五个各一个 | 8,004 KB 一个，1.00× tracked | 真实仓库，我的是 400 文件假仓库 |
| 遥测 | N/A | posthog（`package.json:100`） | 没查到 | — | 两家的默认上报开关 |

![三道门槛，各挂一把不同的锁](/assets/img/one-worktree-per-agent/03-comparison-three-gates.webp)

## 我会留 Worktrunk，但不上并行

理由不在功能表上，在那 0.213 秒。

**三家都能开工作树。** 区别在我这台不该跑的机器上，Worktrunk 用一句人话把我挡在外面，`git worktree list` 一个字节没多写，而且把“每棵树各一份 checkout”写在 FAQ 第 59 行，没藏进 release note。它这次拒绝我的样子，比另外两家我根本没见到的启动画面可信。

为什么另两个这期不选：

- atlas 的 checkpoint 那套我认，可它是 GUI，我要的是能在脚本里调的东西，何况 Linux untested；
- orca 一个 zip 212 MB、五天涨 5,483,650 字节，我读的是 README 加一份 17,268 条的截断清单，靠这个推荐它等于没读；
- 真并行三家我都没测，这一条最重。

那为什么我还没把它放进日常工作流：我一个人干活，串行，一个仓库一个目录，那行 `git worktree add` 我背得下来。它替我省的是打字，而我这周量到的那个 1.00 说明它省不掉的那块恰好是我唯一在乎的，磁盘。

## 2.43 我装不上，那就换个条件

三个可核对的信号。worktrunk 若在下一个 release 把 `require_minimum_git` 从拒绝启动改成列出哪些子命令在 2.39 上还能用（v0.77.0/0.78.0/0.79.0 发于 09-08、09-16、09-21，两跳隔 8 天和 5 天），我就在插件项目上拿 `wt step copy-ignored` 真做一次 node_modules 的 reflink，回来更新上面那句 2.1 倍；orca 若把 cask 拆成能增量更新的包，我这一个钟头的下法不该只对我一个人成立，我给它一次真跑的机会；atlas 那条最省眼，README 里那行 `#todo homebrew tap` 变成真的 `brew install atlas`，我就拿它和 worktrunk 在同一个假仓库上对一次 checkpoint 与工作树成本。

![三个信号挂在三根钉子上](/assets/img/one-worktree-per-agent/04-timeline-switch-signals.webp)

---

项目地址：[https://github.com/max-sixty/worktrunk](https://github.com/max-sixty/worktrunk)、[https://github.com/pacifio/atlas](https://github.com/pacifio/atlas)、[https://github.com/stablyai/orca](https://github.com/stablyai/orca)

另外两家什么时候写这行，我不知道。判决：这期我不装并行 agent，真到要装那天名单上只有 worktrunk，因为三家只有它提前把那份 1.00 倍写给我看了。
