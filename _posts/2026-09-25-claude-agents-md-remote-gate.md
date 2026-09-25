---
layout: post
title: 🚨 别再死磕 CLAUDE.md 了！AGENTS.md 那扇门是远程装的
subtitle: issue #95690 说读 AGENTS.md 要先过一道远端 flag，官方在 HN 上回了句已修；我把 npm、GitHub release、文档三个时钟对齐一遍，v2.1.281 那 176 条发布说明里 AGENTS.md 命中 0 次。第二件：google/ax 第二天多了 1,314 颗星，读取点从 4 行变 8 行，装配那一侧还是 0
seo_short_title: Claude Code 的 AGENTS.md 门上那道远程开关
date: 2026-09-25
categories: [AI, 开源实测]
cover: /assets/img/claude-agents-md-remote-gate/banner.webp
tags: AI 开源 Agent pnpm
---

# 🚨 别再死磕 CLAUDE.md 了！AGENTS.md 那扇门是远程装的
![一扇微微开着、门缝透出暖光的门，从门缝里牵出一条电缆，接到远处云上的一台带开关的小机器](/assets/img/claude-agents-md-remote-gate/banner.webp)

```text
[MODEL] Claude Code's AGENTS.md Support: A Local Feature Locked Behind a Remote Switch
```

anthropics/claude-code #95690 的标题原文，我 14:11:41Z 从 issues API 抓回来那一刻：state 还是 open，4 条评论，正文 1,578 字节，开于 2026-09-20T15:33:09Z。标题里那个 Remote Switch，报告人点名是 Statsig 的 gate `tengu_agents_md_mod`。今天两件事，这件是主菜，第二件是 google/ax 的第二天，末尾再结一笔上上期欠的 pnpm 顺序账。

## 2.1.277 的 release note 只写了前一半

官方 v2.1.277 那条 bullet 原文，`published_at` 是 2026-09-18T18:06:32Z：

> Added AGENTS.md support: in a project with no CLAUDE.md, Claude Code reads AGENTS.md instead; change it under "Project instructions" in `/config` (not yet on Bedrock, Vertex or Foundry)

`not yet on Bedrock` 这半句它写了。没写的是报告人 `Prefee` 在正文里补的那半句：

> Starting with 2.1.277, Claude Code claims support for AGENTS.md — "in a project with no CLAUDE.md, Claude Code reads AGENTS.md instead." But the feature is implemented as a built-in plugin that is **off by default and gated behind a remote Anthropic feature flag (Statsig gate `tengu_agents_md_mod`)**.

这条 issue 写得也不正经。模板里 `What You Asked Claude to Do` 那格填的是 `Let it go!!!!!!!`，`Expected Behavior` 那格是 `Stop doing ewwww thing.`，类型却老老实实挑了 `Claude modified files I didn't ask it to modify`。

`pszypowicz` 那篇博客从他手上 2.1.280 的 bundle 里抄出这两行注册代码（不是我抄的，我没下任何一版二进制）：

```js
var W = !1;
var B = () => Oa("tengu_agents_md_mod", W);
```

`!1` 就是 false，默认 false，问一句远端才可能 true。同一件事三个口径，我不平它：报告人说 off by default 加 gate；官方 memory 文档 400 行写的是 `some sessions ... read CLAUDE.md files only`；而 @main 那份 `mods/agents-md/.claude-plugin/plugin.json`（blob `fe2c5dcc3c`，1,851 字节）里 `instructionFiles` 的 default 是 `claude-md-or-agents-md`。线上真值是三者的哪一个，我不知道——2.1.280 的 bundle 我没拆，2.1.281 之后的 gate 是删了还是只翻了默认值，我给不出源码级答案。

![三块长短和钉法各不相同的木牌悬在同一扇门上方，三条虚线从牌底接到同一个门把手](/assets/img/claude-agents-md-remote-gate/01-three-signs-one-door.webp)

## 🚭 读一个本地 markdown，为什么要先问服务器

issue 下面那 4 条评论按时间和体量排开：`bluehorizon8848-ai` 09-22T15:07:43Z、413 字节，不含技术断言；`pszypowicz` 09-23T08:38:48Z、1,134 字节，就是上面那位作者本人下来补实测；`mmailhos` 12:52:22Z、515 字节；`foma-agent` 17:09:18Z、1,053 字节，编辑过一次。真正有用的两条出自 `pszypowicz` 和 `mmailhos`：

> A session-level `claude --settings '{"env":{"DISABLE_TELEMETRY":"","CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC":""}}'` works from the second session on, because the first session only fetches the flag.

> Confirmed on 2.1.278 with fresh isolated homes: AGENTS.md is skipped in the very first session after install, and skipped every time when feature-flag fetching is disabled (`DISABLE_GROWTHBOOK=1` or nonessential traffic off), which is exactly what CI runners do. It loads fine once the flag is cached locally, so this is a rollout-gating gap rather than a parser bug.

`pszypowicz` 那段里最扎的不是 gate，是 `from the second session on`：同一份配置，新开的会话只负责把 flag 取回来，再开一个才生效。写脚本的人会把这个当成 flaky。（顺手记一条跟主线只有半根线牵着的事实：`DISABLE_GROWTHBOOK` 是另一家 flag 服务商的变量名，而 issue 说的 gate 归 Statsig，中间隔着什么我没去查。）

同一个时间窗里有反例，并排贴出来。`teekert` 在 09-23T12:55Z、官方回话前一分钟写：

> Uhm I turned off everything there is to turn off in my Pro plan, and Claude just read my agents.md with no issue? So... What telemetry am I missing? Or did they JUST update? (I updated my docker image 40 minutes ago to get Opus 5.5, am on version 2.1.280, so not the mentioned 2.1.277, so it's fixed?)

`pszypowicz` 的矩阵说关掉遥测就读不到，`teekert` 说全关了照样读。我这边一台 ≥2.1.277 的都没跑过，没资格判谁错。`mmailhos` 那句 flag 缓存到本地之后就正常，是我能想到的唯一一条能让两边同时成立的路，但它在我的材料里只能是猜想。

## 三个时钟量出来的 4 小时 04 分 47 秒

版本这事有三个互不相干的时钟：npm 的上架时刻、GitHub release 的 `published_at`、官方文档的措辞。前两个我在 14:38:50Z 拼到了同一张表里：

| 版本 | npm 上架（UTC） | GitHub release 挂出 | 晚了多少 | 正文 bullet 数 / 提到 AGENTS.md |
|---|---|---|---|---|
| 2.1.277 | 09-18 16:22:26.548 | 09-18 18:06:32 | 01:44:05 | 87 / 1 |
| 2.1.278 | 09-19 01:48:59.758 | 09-19 03:10:40 | 01:21:40 | 2 / 0 |
| 2.1.280 | 09-22 15:44:39.443 | 09-22 16:38:14 | 00:53:34 | 114 / 0 |
| 2.1.281 | 09-23 17:01:17.780 | 09-23 19:19:15 | 02:17:57 | 176 / 0 |
| 2.1.282 | 09-24 15:56:22.706 | 09-24 18:38:05 | 02:41:42 | 86 / 0 |

第五列是我把 `cc_releases.json` 里每条 body 按 `- ` 切开逐行数出来的，差值一律秒向下取整，所以 2.1.277 那格是 01:44:05 而不是四舍五入出来的 06。

HN 顶帖打在 09-23T12:15:33Z，points 480、32 条顶层回复。从 issue 开帖到有人把它推上去，2 天 20 小时 42 分 24 秒；从顶帖到官方的人在评论区外回话，41 分 30 秒。那回话全段：

> Sorry folks, this is a rollout artifact, we needed a way to turn this off remotely via feature flags if it broke something, and with telemetry off you don't get those. It's already been fixed as part of v2.1.281 releasing today.
> Apologies again folks, this was a fully human error on my part - I should've found a better way to launch with a kill-switch.

`already been fixed` 落在 12:56:30Z，v2.1.281 上 npm 是 17:01:17.780Z，中间 4 小时 04 分 47 秒。他补了 releasing today，当天也确实发了，所以这话不算错。我要挑的是另一头：那 4 小时里没有任何公开可查的东西——GitHub release 还要再晚 2 小时 17 分 57 秒才挂出来。回话的人叫 `mpoteat`，`api.github.com/users/mpoteat` 返回 404，GitHub 侧解析不到，雇主我没能独立确认。他贴的那条 `mods/` 路径是真的：`contents/mods` 6 项，README 加 agents-md、diff、sec-default、telemetry 四个目录；`mods/agents-md/` 里 4 项，README 12,274 字节。

## 176 条 bullet 里，找不到这次修复

2.1.281 的 body 28,783 字节、176 条 bullet，`AGENTS.md` 命中 0。挨着这件事的只有一句，还是从启动时序那头来的：

> Improved interactive startup time: git reads, startup telemetry and the Bedrock/Vertex model-upgrade checks no longer run before the first frame

这句是不是那道 gate 的修法，我不下结论：它没提 AGENTS.md，也没提 instruction file。2.1.282 里两条遥测改动看着像后话，一条给 `/status` 和 `claude doctor` 加了条目，列项目 settings 里被忽略或关掉遥测的变量；另一条直接忽略项目和本地 settings 里的 OpenTelemetry 变量，举例点到 `CLAUDE_CODE_ENABLE_TELEMETRY`。两条都没提 AGENTS.md。

那怎么知道自己在门的哪一边。memory 文档 574 行的动作是跑 `/memory`，在列表里找 `AGENTS.md` 的路径；576 行补了前提：2.1.280 之前 `/memory` 和 `/context` 不列直接读到的 AGENTS.md。自查本身要 ≥2.1.280，而被挡住的恰好是 2.1.281 之前那批会话。346 行留了一条绕行：从 `CLAUDE.md` 里 import。408 行那句给做审计的人看，`InstructionsLoaded` 这类 hook 对 setting 里加载进来的 AGENTS.md 是 `Don't fire.`。

三条动作，按能不能立刻做完排：

- `claude --version`。低于 2.1.281 就别猜，先升。
- `/memory` 里搜 `AGENTS.md`。这个要在 2.1.280 之后才有意义，而它看不到 hook 那一层。
- npm 的 `dist-tags` 里 `stable` 现在还是 2.1.274（我 14:38:50Z 抓的，`latest` 是 2.1.282）。谁在读这个 tag 我没查，但按 `@stable` 装会停在 2.1.274，那个版本连那句 AGENTS.md 声明都还没有。

我这边没被咬着：这台机器的 `claude --version` 是 2.1.145，那个 211,044,112 字节的二进制 mtime 停在 5 月 20 日；仓库根目录既没有 CLAUDE.md 也没有 AGENTS.md。说白了这条坑咬的是正在往 AGENTS.md 迁的人，而我还在 CLAUDE.md 这一头。

接下来我盯三件事，都可证伪。memory 文档 400 行和 571 行那两句 `Before v2.1.281` 哪天被删掉或改写，官方口径就从某些会话挪到了纯版本口径；`mods/agents-md` 那份 README 我 14:16Z grep 过，`tengu` 0 次、`flag` 0 次、`telemetry` 5 次，哪天 flag 字样回到这份源码里，就说明开关换了实现而不是被拆了；至于比 2.1.282 更新的版本，如果它的 release body 里 `AGENTS.md` 命中仍然是 0，我不再把它当修复证据，我自己的核对清单里会多一条硬规则：一次修复只要没在 release note 里留下可 grep 的字，就得当作没发生过，哪怕文档已经改了。

![一屏输出里第一行是实心暖黄、第二行是空心斜纹且右端断掉，断口牵出一条线接到屏幕外云里的开关](/assets/img/claude-agents-md-remote-gate/02-memory-two-lines.webp)

---

## google/ax 的第二天：读的人多了，装的人没多

9,835 星是上期（09-24T14:31:12Z）打的快照，11,149 是我今天 14:17:22Z 抓的，中间 85,570 秒也就是 23 小时 46 分 10 秒，摊下来 55.3 星一小时。GitHub Trending 日榜页面上写的当日增量是 +1,386、排第 13，那是页面自己算的口径，跟我这两个快照相减不是一回事，两个数我都留着。

上期我把这张 grep 抄进正文当证据，4 行、3 个读取点。今天同一条命令复跑：

```bash
$ grep -rn "\.Mcp\b" --include='*.go' . | grep -v '_test.go\|\.pb\.go'
./cmd/ax/main.go:414:				if ws.Spec.Mcp != nil {
./cmd/ax/main.go:415:					mcpCount = fmt.Sprintf("%d", len(ws.Spec.Mcp.Servers))
./cmd/ax/main.go:572:			if ws.Spec.Mcp != nil {
./cmd/ax/main.go:573:				if len(ws.Spec.Mcp.Registries) > 0 {
./cmd/ax/main.go:575:					for _, r := range ws.Spec.Mcp.Registries {
./cmd/ax/main.go:579:				if len(ws.Spec.Mcp.Servers) > 0 {
./cmd/ax/main.go:581:					for _, s := range ws.Spec.Mcp.Servers {
./internal/workspace/planner.go:82:		mcpConfig = ws.Spec.Mcp
```

8 行，读取点还是 3 个：`runList` 的表头列、`runDescribe` 的打印、`planner.go` 里那个取值。多出来的 4 行全在 `runDescribe` 里面，一行装配都没有。行号位移我归因不到具体提交——`--depth 1` clone 没有历史，这条我认。上期那篇第 86 行的原话，我抄回来对账：

> 同一场重构里还有个 112 行的 planner.go，Planner、PlanEnvironment、EnvironmentPlan 三个符号全包之外零调用者，只有 planner_test.go 陪着。

复跑仍然成立：非测试、非生成代码里 `PlanEnvironment|EnvironmentPlan` 的 5 行全在 `planner.go` 自己体内，带测试才多出 `planner_test.go:28`、`:92` 两处。承诺队列那三条今天条件全不成立，继续挂着。

## 1.1 MB、64 个文件，和一条 exec 的三个入参

今天真正新查的是 skill 那一路，它比 MCP 更短。`internal/workspace/setup.go:262-270` 的 `setupSkills` 函数体只有 `os.MkdirAll(skills.Path, dirPerm)` 加 `return skills.Path`，`skills == nil` 或路径为空就返回空串。这条路连读都谈不上，它只造了个空目录。`spec.mcp` 最远能走到的地方是 `setup.go:117`：`res.BootstrapRan = runBootstrap(ctx, goal, targetPath)`，由 `runner/runner.go:157` 那句 `workspace.SetupWorkspace(ctx, m.ws, m.path, m.ref.GetGoal())` 接住，exec 出去的是

```text
python3 /usr/local/bin/antigravity_bootstrap.py \
  --goal <goal> --workspace <targetPath> --data-dir <AXDir/antigravity>
```

那个脚本在仓库里，`git ls-files | grep '\.py$'` 命中唯一一条 `cmd/ax-task-runner/antigravity_bootstrap.py`，129 行、4,981 字节，argparse 只有上面那三个入参，全文 grep `mcp` 命中 0。你在 Workspace YAML 里写下的那串 `spec.mcp`，没有一条路能递进这条 exec。三条失败路径全是日志级别：脚本缺 `slog.Info`、key 缺 `slog.Warn`、超时或失败 `slog.Warn("... (continuing)")`，都不改退出码。仓库本身 1.1 MB（`.git` 占 532K）、tracked 64 个文件、非测试非生成 `.go` 20 个，HEAD `e70162a`。

---

## 那笔 pnpm 旧账：我原本要验顺序，结果验的是它在不在图里

09-21 那篇 pnpm 的结尾我留了一句不背书：

> 这一段我引用但不背书：顺序错乱我没复现出来，我的 fixture 只有一个任务，跑不出前后关系。

这周结它。fixture 从 1 个 task 扩到 2 个（`ci:compile` 空转 1200ms、`ci:lint` 空转 300ms，两个都往同一个 `log.txt` 追加），第一关撞在 git 上，原始报错：

```text
Already up to date
Error: ERR_PNPM_FILTER_CHANGED
  × Filtering by changed packages failed. 22:24:21.775392 git.c:440
  │ trace: built-in: git diff --name-only --end-of-options
  │ ae7f260afcd3821291d375c25d7918fa1696385f -- /private/tmp/pnpm-order/ok
  │ usage: git diff [<options>] [<commit> [<commit>]] [--] [<path>...]
```

`GIT_TRACE=1` 打出来的是被拒的那条 argv。`--end-of-options` 要 git ≥2.24，而我 PATH 上那个 `/usr/local/bin/git` 是 2.23.0，`/usr/bin/git` 才是 2.39.2 (Apple Git-143)。把 `/usr/bin` 挪到 PATH 最前，同一份 fixture 立刻 exit=0。上期那笔要先 `which -a git` 再报数的账，在这一步顺手结了。中间还有一关：task 放在根包时，改了根目录文件，pnpm 先说 diff 触到 workspace-root 要跑全部项目，紧接着又说没有项目受影响。挪进 `pkgs/app` 才真的跑起来：

```text
##### c_ok | tasks.ci:lint.dependsOn | pipeline exit=0
  | pkgs/app ci:compile$ node -e "...appendFileSync('log.txt','compile:start')...1200ms...'compile:end'..."
  | pkgs/app ci:compile: Done
  | pkgs/app ci:lint$ node -e "...'lint:start'...300ms...'lint:end'..."
  | pkgs/app ci:lint: Done
  | Pipeline "default": 2 tasks — 2 passed (0 from cache), 0 failed, 0 skipped.
  ORDER: compile:start -> compile:end -> lint:start -> lint:end
##### c_typo | tasks.ci:lint.dependson | pipeline exit=0
  | pkgs/app ci:lint$ ...
  | pkgs/app ci:lint: Done
  | Pipeline "default": 1 tasks — 1 passed (0 from cache), 0 failed, 0 skipped.
  | [WARN] The following task settings in pnpm-workspace.yaml are not recognized by this
    version of pnpm and were ignored: "tasks['ci:lint'].dependson".
  ORDER: lint:start -> lint:end
```

对照组：`pnpm run ci:lint` 两种拼法都只跑 lint，`run` 不建任务图，压根不是能验顺序的入口。12.6.0（latest，npm 上架 2026-09-22T17:08:08.061Z）上重跑一遍，两半逐行同形。我原本以为要读的是先后，跑完发现读到的是在不在图里。#15075 作者给的机制站得住：`taskGraph.ts:114-119` 在一个 task 条目已经存在的前提下返回 `tasks[name].dependsOn ?? []`，空依赖表确实成立。他给的表象我量不到——他说这条任务会抢在自己的前置之前跑，我这儿前置不是晚跑，是根本没进图：2 tasks 变 1 tasks，两种拼法 exit 都是 0，12.5.1 和 12.6.0 各一遍。

所以那半段我不删，改：上面引的那句今天换成实测，第 137 行的引用保留，我在旁边补一行本期读数——顺序错乱未复现，量到的是前置不进图。

至于我自己的仓库，决定就一条：不加校验脚本。`package.json` 的 `packageManager` 锁在 pnpm 11.25.0，而 11.25.0 对同一个拼法是 exit 1 加一句 `A task declares "concurrency", "dependsOn"`，上期量过，这道门在我这边本来就亮着，没必要再糊一层。要防的是 12.5.1 之后那种黄灯：一行 WARN，安装继续，退出码 0，CI 全绿。谁把依赖表拼错成那样，出事的时候手上什么都没有。所以哪天真要在自己的仓库里开 `pipelines:`，我给它配一条断言——把 `pnpm pipeline` stdout 里那句 `N tasks` 跟 `tasks:` 声明的边数比一次，对不上就红。这条我登记进承诺队列，下期不管做没做成，都在日志里交代一句。

![两块同样的格子平台：左边两个节点之间是接通的实线箭头，右边箭头从半路断开，本该在格子里的深色节点掉在平台外面](/assets/img/claude-agents-md-remote-gate/03-edge-in-or-out.webp)
