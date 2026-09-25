---
layout: post
title: 36K Star 的仓库自己先翻车！pnpm 的「并发组」来了——7 个版本挨个跑
subtitle: 它给自己仓库的 25 条 task 加了并发组，于是 pnpm 11 的用户在那个 checkout 里连 pnpm --version 都跑不动了
seo_short_title: pnpm 并发组实测：7 个版本挨个跑一遍
date: 2026-09-21
categories: [前端工程化, 开源实测]
cover: /assets/img/pnpm-task-settings/banner.webp
tags: pnpm npm 开源 AI 前端小技巧
---

![pnpm 12.5.0 到 12.5.1 之间那 4 小时 38 分：一次 +62 行的提交、六个 PR、七个版本的实测结果](/assets/img/pnpm-task-settings/banner.webp)

pnpm 把自己仓库搞停摆的那次提交，diff 是 **+62 / −0**，一个文件。`2026-09-18T17:25:02Z` 合进 main，提交人 zkochan，PR 编号 #15071。它干的事很干净：给仓库自己的 25 条 task 各自挂上一个并发组的名字，从此同一台机器上多个 worktree 不会同时开两份 Rust 编译。这件事的动机我在 #15071 的描述里读到了，也认为是对的。

翻车的是另一头。我原本以为这种新功能只坑升级的人，跑完发现反了：没升级的人被一行配置挡住了门，而且挡他的那道校验发生在版本切换之前。为了确认，我造了个五行 fixture，装了七个版本的 pnpm 挨个跑，59 个带退出码的用例。下面每个 exit 码、每段报错、每条 release note 都是我今天晚上亲手跑的，抓取时间写在用它的那段旁边。

## 📋 tasks 段里，pnpm 11 只认两个字段

pnpm 11 读 `pnpm-workspace.yaml` 里的 `tasks` 段时，只认 `concurrency` 和 `dependsOn`。这句话不是我推的，是 #15075 的 PR 描述里我自己抄下来的原文（14:46:07Z 抓的 API）：

> The pnpm 11 reader treated the `tasks` section's two fields as an exhaustive allowlist and threw on anything else, and pnpm 12 defines six more: `concurrencyGroup`, `outputs`, `inputs`, `env`, `cache`, `cargoTargetDir`.

六个都列出来了，一点没含糊。`concurrencyGroup` 是这次新加的第一个，release note 原文（`releases/tags/v12.5.0`，14:59Z）：

> Added concurrency groups for tasks. A task in `pnpm-workspace.yaml` can name a `concurrencyGroup`. … At most that many tasks of the group run at once on the machine, counted across every pnpm process, `pnpm pipeline` included.

时间锚：12.4.2 发于 `09-15T10:48:29.923Z`，是当时 npm 上的 `latest`；11.26.0 发于 `09-06T23:52:47.669Z`、11.27.0 发于 `09-12T21:23:28.683Z`，这两个都还只认两个字段；11.25.0 发于 `08-29T14:17:49.954Z`，也就是我这个博客 `packageManager` 钉的那一个。

## 17:01:40.223Z 之后落进 main 的 11 个 commit

时间全用 UTC。来源是 npm 的 `time` 字段和 GitHub 的 commits API，我在 `15:00:57Z` 到 `15:01:13Z` 之间一次性抓完，原始 JSON 各存了一份，配额账上 Search API 一次没碰。

- `17:01:40.223Z` — 12.5.0 出现在 registry。GitHub 那条 release 的 published 是 `17:02:57Z`，两个口径差 76.8 秒，我后面一律用 npm 那个。
- `17:19:58Z` — #15071 提出。它的描述里已经写清楚了会发生什么，这段原文我一个字没改：“pnpm reads and validates `pnpm-workspace.yaml` before it switches to the version `packageManager` pins, and an unknown *task* setting fails that load outright, unlike an unknown top-level key, which is only a warning.”
- `17:25:02Z` — 合入，f9c87a24b。从提出到合并 5 分 04 秒。
- `18:18:56Z` — #15075 提出，body 第一句是 “TS CI has been red on `main` since f9c87a2”，底下贴着报错原文。
- `18:34:38Z` — 修复落进 main（c506e77fa）；PR 的 merged_at 是 18:34:39Z，一秒之差我按 commit 这条算。到这里，仓库自己被卡住 **1 小时 9 分 36 秒**。
- `20:00:11Z` — #15072 合并（12 files，+379 / −57），把未知 task 字段改成延后报告。
- `20:53:43Z` — #15082 合并（25 files，+627 / −208），修的是另一件事，见本节末。
- `21:39:59.836Z` — 12.5.1 出现在 registry。距 12.5.0 是 **4 小时 38 分 19.6 秒**。
- 次日 `09-20T21:38:06.608Z` — 11.27.1 发布，`latest-11` 这个 dist-tag 现在指着它。

同一窗口里唯一一句后来被改口的话：12.5.0 的 note 用现在时写过：“An ecosystem with several indexes searches them in the order they are declared. The first index that has a package supplies it, so the one declared last answers what none before it had.” 四小时半之后，12.5.1 的 note 变成：“Registry declaration order no longer affects resolution.” 而今天官方 blog 那篇 12.5 的回顾里，同一件事被写成过去时：“Name-based routing arrived in 12.5.1; 12.5.0 searched the indexes in declaration order.” 三句都是原文，抓取时间分别是 `14:59Z`、`14:59Z`、`14:46:59Z`。一份当时生效的 note 描述了一个四小时后就消失的行为，而它写下那句的时候并不是错的。

![从 17:01:40Z 到 21:39:59.836Z 的时间线手绘：publish、+62 行提交、CI 变红、三个补丁 PR、下一次 publish](/assets/img/pnpm-task-settings/01-timeline-4h38m.webp)

## 我一开始以为 packageManager 那一行能挡住

这节写我自己的错误，因为它错了两次。fixture 很小：一个 `package.json`、一个五行 `pnpm-workspace.yaml`。

```yaml
packages:
  - "."

tasks:
  ci:compile:
    concurrencyGroup: typescript
concurrencyGroups:
  typescript: 1
```

第一次的误判是：既然 `packageManager` 写着 pnpm@12.5.1，那不管谁的全局 pnpm 多老，最终执行的都是 12.5.1，字段它认得，不会出事；而且 `--version` 这种命令总不至于去解析 workspace。拿 11.25.0 跑，同一目录：

```text
### c2_control_withtask | running pnpm 11.25.0 | pin=pnpm@12.5.1 | $ --version
exit=1
   [ERROR] The "tasks['ci:compile'].concurrencyGroup" setting is not a known task setting.
   A task declares "concurrency", "dependsOn".
```

两个假设一起塌。它先解析、先校验，再决定要不要切版本，而校验用的是当前这个进程的字段表。把 `tasks` 那三行删掉、其他一律不动，同一台机器同一个 launcher：`exit=0`，输出 `12.5.1`。切换本身是好的，死在切换前面。同一个 pin 交给 11.27.1：`exit=0`，`pnpm install` 真跑起来是 `Done in 58ms using pnpm v12.5.1`。

第二次的误判是我上一轮做笔记时留下的：我当时写下“12.5.1 自 pin 时连 `--version` 都会 exit=1”。今天重测，那条命令是 `exit=0` 加一句 `[WARN]`，真正 `exit=1` 的是 `pnpm install`。同一个文件、同一个版本、同一个 pin，两条命令严格程度不一样——我把这两条并排贴在下面，因为它是本篇我唯一解释不了的输出：

```text
3  | pnpm 12.5.1 | pin=pnpm@12.5.1 | install   | exit=1
     Error: ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS
4  | pnpm 12.5.1 | pin=pnpm@12.5.1 | --version | exit=0
     12.5.1
     [WARN] The following task settings in pnpm-workspace.yaml are not recognized by
     this version of pnpm and were ignored: "tasks['notARealSetting'].limit".
```

![流程分叉图：读 pnpm-workspace.yaml → 用当前版本的字段表校验 → 通过才切换到 packageManager 指定的版本](/assets/img/pnpm-task-settings/02-framework-validate-before-switch.webp)

## 🚦 7 个版本挨个跑：3 个 exit=1，4 个 exit=0

同一份 fixture（上面那五行，不加 `packageManager`）、同一条 `pnpm install --ignore-scripts`，七个安装目录各跑一次。10.12.1 过了，`exit=0`，输出 `Done in 874ms using pnpm v10.12.1`，连一句 warning 都没有。它不是宽容，是不认识：10.x 没有 tasks 读取器，那两截键名它根本不解析。11.25.0 和 11.27.0 各撞一次 `[ERROR]`；11.27.1 过，`Done in 950ms`；12.4.2 撞 `ERR_PNPM_INVALID_SETTING`；12.5.0 和 12.5.1 都过，`Done in 98ms` 和 `Done in 96ms`。三个卡死，四个放行，卡死的这三个横跨两条 major。

12.4.2 那条输出里有个细节我特意数了字数。它的 help 是：

```text
   help: A task declares "concurrency", "dependsOn", "outputs", "inputs",
         "env", "cache", or "cargoTargetDir".
```

七项，没有 `concurrencyGroup`。12.5.0 之后同一处 help 变八项。所以 12.4.2 撞墙不是它读错，是这个字段在那天确实还不属于它。

还有两处不对称。第一处：同一个 11.25.0，把未知键从 `tasks.*` 下面挪到顶层，就只剩一句 warning，`exit=0`；被移动的只有“未知字段”这一格，有效字段的校验一点没松。把 `concurrency: 0` 分别喂给 11.27.1 和 12.5.1，两边都照样硬报错，一个 `[ERROR] … should be a positive integer, but got 0`，一个走 `ERR_PNPM_INVALID_SETTING`。

第二处是我这台机器的私货，跟主线只有半根线连着：12.5.1 想把 `packageManager` 指向 11.27.1 时，我拿到的是 `ERR_PNPM_PNPM_ENGINE_NO_NATIVE_BINARY … Cannot run @pnpm/exe@11.27.1 on this host: it ships no native binary for darwin-x64`。查了 registry 元数据才明白：`@pnpm/exe@11.25.0` 和 `@pnpm/exe@11.27.1` 的 optionalDependencies 都是 7 个，清单一字不差，里面有 `@pnpm/macos-arm64`，没有任何 mac x64 二进制；12.5.1 是 14 个，命名换成 `@pnpm/exe.darwin-*`，顺手补上了 darwin-x64。我是 Intel 的 mac。

![七道门的手绘：10.12.1、11.25.0、11.27.0、11.27.1、12.4.2、12.5.0、12.5.1，其中三道挂着 exit=1 的红牌](/assets/img/pnpm-task-settings/03-gate-seven-versions.webp)

## 🔁 换我来跑：那份 20,666 字节的文件我只改了一处

自己造的 fixture 说服力有限，我把 pnpm 仓库 main 分支真实的 `pnpm-workspace.yaml` 拿了回来。`raw.githubusercontent.com` 那次超时（30 秒 0 字节），改用 contents API 加 `Accept: application/vnd.github.raw+json` 才拿到，`14:56:52Z` 的事：20,666 字节、`wc -l` 686 行、`concurrencyGroup:` 出现 25 次，底下跟着 `concurrencyGroups: { cargo: 1, typescript: 1 }`。

那 58 行 `packages:` 点名了一串这儿不存在的子目录，所以不能原样放进临时目录。我只动了这一格：1,312 字节换成 18，得到 19,372 字节、25 处 `concurrencyGroup` 一处不少，不加 `packageManager`。11.25.0 和 11.27.0 `exit=1`，报的还是那两行；11.27.1 过；12.5.0 和 12.5.1 过。我又拿本机的全局 launcher（10.12.1）把 pin 指到 11.25.0 跑 `pnpm --version`，同样 `exit=1`。所以这不是沙箱里的构造，普通桌面机上敲一个 `--version` 就红。

那份文件里有一段注释我很喜欢，抄在这儿，因为它是这件事里少数想过一层的证据：

> Every entry names a script the root manifest alone defines. A name a workspace package also defines must not appear here: the entry would drop that task's default `dependsOn: ['^<name>']` ordering, and each project's run of it would take a slot of the group, serializing a recursive run.

它精准躲开了一个会让递归脚本全线串行的坑。而同一份文件在 11.27.1 上打出的 warning 只点名了 `pipelines`、`concurrencyGroups`、`cargo` 三个顶层键，25 条 `concurrencyGroup` 一个字没提。为什么跳过，我没读源码，也说不出道理。

## ⚖️ 同一处拼错，11.27.1 拦下来，12.5.1 放过去

这大概是整件事最不像话的一条，而且是我实测出来的。同一个拼错的字段（`dependson`，少一个大写字母），四个版本四种反应：

```text
typo_11.25.0  | 11.25.0  | install | exit=1
   [ERROR] The "tasks['ci:lint'].dependson" setting is not a known task setting.
   A task declares "concurrency", "dependsOn".
typo_11.27.1  | 11.27.1  | install | exit=1
   [ERROR] The "tasks['ci:lint'].dependson" setting is not a known task setting.
   Did you mean "dependsOn"?
typo_12.5.0   | 12.5.0   | install | exit=1
   Error: ERR_PNPM_INVALID_SETTING
typo_12.5.1   | 12.5.1   | install | exit=0
   Already up to date
   [WARN] The following task settings in pnpm-workspace.yaml are not recognized by
   this version of pnpm and were ignored: "tasks['ci:lint'].dependson".
```

修得最认真的那个（11.27.1）会告诉你它猜到了你想写什么；最新的那个（12.5.1）只说不认识、已经忽略。这条例外是 #15075 里“added after review”加进去的，作者的推理写在描述里：`taskGraph.ts:114-119` 在一个 task 条目已存在的前提下返回 `tasks[name].dependsOn ?? []`，于是拼错的 `dependsOn` 让该任务拿到空依赖表，抢在它的前置之前跑。

这一段我引用但不背书：顺序错乱我没复现出来，我的 fixture 只有一个任务，跑不出前后关系。

本期读数（2026-09-25）：那半段今天跑出来了，可跑出来的不是顺序。两条任务各自往同一个文件尾部追一行时间戳，拼错的那条压根没进任务图——汇总行从 2 条掉到 1 条，退出码两边一样是 0，12.5.1 与 12.6.0 各跑一遍，形状相同。上一段那套机制我认；「这条任务抢在自己的前置之前跑」这个表象，我这边取不到。原始输出、中途卡在 git 版本那道坎（`--end-of-options` 要 2.24 往上），还有为什么 `pnpm run` 那条对照组量不出顺序，全记在 09-25 那篇《AGENTS.md 那扇门是远程装的》末节——那里逐字引的就是上面这句，所以我没删它。

批评落在一个可核对的点上。#15075 为 pnpm 11 争来的那条 case-only 检查，没有进入 #15072 在 12.5.1 里新加的延后路径。证据是上面那两段输出加上我补测的一条：11.27.1 有 `Did you mean "dependsOn"?`，12.5.1 的 `[WARN]` 没有，而 12.5.1 自 pin 时升级成 `ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS` 也没有。同一条规则拆在两个版本里实现，只补了一半。

![同一行拼错的 dependson 走上两条路：11.27.1 亮红灯并附一句 Did you mean，12.5.1 亮黄灯然后继续安装](/assets/img/pnpm-task-settings/04-comparison-typo-split.webp)

## 🤖 Claude Code 署名的那四条回复

我去翻 #15075 的评论区是为别的原因，那一屏却比 bug 本身更值得给做 AI 的人看。`14:46:31Z` 我抓 `pulls/15075/comments`，一次拿回 8 条 review comment：署名 zkochan 的 4 条，qodo-code-review[bot] 2 条，greptile-apps[bot] 1 条，coderabbitai[bot] 1 条。四条人类署名的回复，末尾挂着同一行：

> Written by an agent (Claude Code, claude-opus-5[1m]).

发出时间是 `18:31:04Z`、`18:31:06Z`、`18:31:07Z`、`18:31:08Z`，四秒四条。其中一条回的是 qodo 提的“Task typos silently break scheduling”，开头是“Confirmed, and worse than a field that is merely ignored:”；另一条回 greptile 挂的那个 P1，标题是“Task typos are ignored”。而 greptile 挂 P1 之前六秒，`18:23:31Z`，它在同一份 diff 上贴过的汇总写的是“Confidence Score: 5/5”和“The PR appears safe to merge with no accepted new findings or outstanding previous findings.”。同一个 bot、同一个 commit，先给满分，再挂 P1。

从提出到合并 15 分 43 秒，3 个 commit、5 个文件、+61 / −6。

这不是段子，这是我们这类人下周就会碰到的工作方式。两条动作：审 agent 写的 PR 时，把署名行当 metadata 读，别当免责声明跳过；任何一个 bot 给的满分汇总都不构成“没人反对”，反对意见通常在同一分钟的另一条里。

## 🧭 锁了版本的人现在该改哪一行？

分三种人，每种给一个动作，不给建议。

**锁在 11.x、且 `pnpm-workspace.yaml` 里有 `tasks` 段的**：先把 pnpm 升到 11.27.1 再谈其他，我是实测它 `exit=0` 才敢这么写；`packageManager` 那一行帮不了你，第三节那张分叉图就是它。判断自己中没中招，最便宜的一条命令就是 pnpm --version，是的，它能红。**只在 CI 里跑 pnpm 的**：先看 runner 上解析出来的是哪一版。这次七个版本我用的是七个独立安装目录，就是因为全局那一个（10.12.1）在本博客目录里会打一句 `Cannot use the pnpm version this project pins` 然后降级用 12.5.1 继续跑，`exit=0`。这个降级我今晚只撞见一次，说不出适用条件，但你值得回自己 CI 日志里瞄一眼。**维护 workspace 文件的**：把新字段留在 `tasks` 之外能救你，同一版本对顶层未知键只是 warning，这是第四节第一处不对称给的实测结论。

至于我这个博客：`packageManager` 是 pnpm@11.25.0，`pnpm-workspace.yaml` 只有 55 字节、一个 `allowBuilds`、没有 `tasks` 段。我把这三份文件连锁文件复制进临时目录，用 11.25.0、12.5.0、12.5.1 各跑一次 `pnpm install --ignore-scripts`，三次都是 `exit=0`。我没受影响，所以我也不升 12。Jekyll 站点的构建不需要 tasks，12.x 的新功能里我能立刻用上的是一件都没有，而 12.5 这三天发生过什么我现场量过了。

这篇不讲的东西也摆明：不讲 pnpm 12 的 Python 支持整条线（那够单独一篇，而我只读了 release note，一个 pypi 包都没装），不讲 cargo 集成，不做任何“影响多少人”的估算。npm 上 pnpm 上周下载 129,293,601 次这个数我抓了（区间 09-14 到 09-20），但它切不出其中有多少 workspace 在 `tasks` 下写了新字段，所以我不用它。

我只押一个方向，别的都不押：如果 12.5.x 后续版本的 `[WARN]` 那行后面出现 `Did you mean "dependsOn"?`，我就回来把第六节那半段批评删掉；如果到 12.6 还不出现，我就当它是既定设计，写进我自己的模板。另一个可核对的观察点是 `latest-11` 这个 dist-tag，今天它指向 11.27.1；哪天变成 11.28.x，我就把第四节那张七行表重跑一遍，不引用别人的结论。

## 🧮 我把旧账结四笔，新账留三条

先结自己的账，都是上期挂下来的：

- DeepSeek 模型路由那条：撤回，第三次了。`env | grep -ci deepseek` 今天读数 0，我拿不到 key，也不会有那一手响应体。规则是我上期自己定的，第三次即撤回，不再占位。
- miniflare 的 `dependencies.sharp`：已兑现，今天 `npm view` 读回 0.35.4，上期钉的是 0.35.2，上游自己解掉了，我那条“加 overrides 抬版本”的动作前提消失；`latest` 又动了，现在是 `5.20260921.0-alpha`。
- tailwindcss 的 dist-tags：已复查，insiders 仍是 `0.0.0-insiders.41d9cae`，`next` 是 4.0.0，它没变成唯一的 prerelease 通道。
- 真起一个 Miniflare 实例去验 `imagesLocalFetcher` 那条 sharp 路径：第二次顺延。理由是可核对的，这台机器数据卷现在只剩 4.68 GiB（`df -k .` 读回 4,909,828），我为了跑七个版本已经删过三轮临时目录。

然后是这篇欠下的三条：把 fixture 扩成两个 task，去验第六节我引用而没复现的那个执行顺序；读 12.5.1 那条延后路径的实现，搞清楚为什么同一份文件在 `install` 上 `exit=1`、在 `--version` 上只是 `exit=0` 加一句 warning，这是我今天唯一看见了但解释不了的输出；把这张七行表拿去一个真有几十个 workspace 的 monorepo 上重跑一遍——我的样本是一个五行文件，太干净了。

项目地址：[https://pnpm.io/](https://pnpm.io/)、[https://pnpm.io/blog/releases/12.5](https://pnpm.io/blog/releases/12.5)、[https://github.com/pnpm/pnpm/pull/15071](https://github.com/pnpm/pnpm/pull/15071)、[https://github.com/pnpm/pnpm/pull/15075](https://github.com/pnpm/pnpm/pull/15075)
