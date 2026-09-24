---
layout: post
title: 谷歌开源的 ax：三样预装两样空，这才是真正的 v1alpha1
subtitle: 文档说 runner 会在沙箱里备好 Git、MCP 和 skill 三样东西；我把 628 个提交翻了一遍，字段最远只走到 CLI 的表头，剩下两样一样没人读、一样只建了个空目录
seo_short_title: 谷歌 ax 的 Workspace：三样预装两样空
date: 2026-09-24
categories: [AI, 开源实测]
cover: /assets/img/google-ax-workspace-materialization/banner.webp
tags: AI 开源 Agent 工具
---

# 谷歌开源的 ax：三样预装两样空，这才是真正的 v1alpha1
![三份并排的预装清单，只有左边那份下面接着真的管道，中间和右边两份的管子悬在半空](/assets/img/google-ax-workspace-materialization/banner.webp)

```text
commit f009cc8
Author: Jaana Dogan <jbd@google.com>
Date:   Thu Sep 24 06:40:26 2026 -0700

    demo: simplify walk-through to highlight core stable features (#391)
```

628 个提交里，Go 代码里出现过 `Mcp` 这个字段名的，只有 1 个提交。

我不是在找茬，我是顺着这行 commit message 往里走的。它说留下的是 core stable features，那被拿掉的那一步就值得数一遍——被拿掉的是 Git，不是 MCP。而 README 的四个原语表格里，`Workspace` 那行写着：`Pre-wire Git repos, MCP servers, and skill packages so every agent starts warm`。三样并列。

> [!NOTE]
> 一句话结论：`ax.io/v1alpha1` 的 `WorkspaceSpec` 里三样都有字段、都有文档、都能在 CLI 里看见；沙箱里真装上的只有 Git。剩下两样，MCP 从头到尾没有任何装配代码读它，skill 只被用来建一个空目录。

## 5 天，4 个提交，30 条讨论

先把"发生了什么"压到最短。仓库 `google/ax` 建于 2026-03-30，语言 Go，Apache-2.0。09-20T03:33:20Z，账号 `rakyll` 发出 v0.3.0——release 正文长度 0，assets 数 0，全仓库 6 个 release 个个如此。19 小时后（09-20T22:32:43Z）HN 那条「AX – Google's Open Agentic Orchestrator」拿到 662 分、299 条评论。

按我这台机器的口径量一次热度：09-24 14:11Z 抓到 star 9,816，20 分钟后的 14:31Z 再抓一次是 9,835，中间涨 19。同一天它挂在 GitHub trending 日榜第 4，那一行写着 +1,376 stars today——那个 1,376 是 GitHub 自己算的当日增量，口径不是我测的，我只照抄。

要说清楚的一条：HN 那条比我「只看最近 3 天」的线早 15 小时 36 分，严格口径下它出界。留在窗口里的是 09-24 当天那批提交，和 `created:>2026-09-21` 的 30 条 issue/PR。而这 5 天里 `main` 上只落了 4 个提交（含 #390、#381、#391），`pushed_at` 停在我开扫前 28 分钟的 13:40:27Z。30 条讨论对 4 个提交，这个差就是我今天想拆开看的东西。

## 三样预装，只有第一样动了手

`docs/concepts.md` 只有 3,829 字节，Workspace 那节写得非常干脆（`:27`，逐字）：

> Declare it once, bind it from as many tasks as you like, and **the runner materializes it inside each sandbox before the command starts**:

冒号后面三条：`:29` Git repositories cloned into subdirectories；`:30` `**MCP servers and registries** (Model Context Protocol) that the agent can call.`；`:31` `**Skill registries** and the path where skills are materialized.`。

现在时，三条并列，主语是 the runner。我挨条去对代码。

沙箱内的初始化全部在 `internal/workspace/setup.go` 的 `SetupWorkspace` 里，函数体对 `ws.Spec` 的读取只有两处：`:112` 拿 `Spec.Git` 去 `cloneRepos`，`:113` 拿 `Spec.Skills` 去 `setupSkills`。第三样没有第三处。

第一条是真的。`fetchRepo`（`:200`-`:234`）依次跑 `git init`、`remote add origin`、`fetch`、`checkout -f FETCH_HEAD`，外面套 `gitRetries = 5`、`gitRetryDelay = 2 * time.Second`，注释还特意交代参数不经 shell。它连"部分初始化过的目录"都能重进——第 2 次重试撞见已 init 就改用 `remote set-url`。这段我不喜欢挑毛病，它是三样里唯一被当成正经功能写的。

第三条是 `setupSkills` 那 9 行（`:262`-`:270`），唯一的动作是 `os.MkdirAll(skills.Path, dirPerm)`。`SkillsConfig` 里的 `registries` 字段（README 表格里说的是 skill packages）一个字节都没被读过。所以"空"这个字在这儿是字面的：你会得到一个空的 `/.agents/skills` 目录。

第二条更干脆：`Spec.Mcp` 在非测试、非生成的 Go 代码里一共 3 个读取点，没一个在沙箱侧。我把这三行抄下来当证据：

```bash
$ grep -rn "\.Mcp\b" --include='*.go' . | grep -v '_test.go\|\.pb\.go'
./cmd/ax/main.go:489:				if ws.Spec.Mcp != nil {
./cmd/ax/main.go:490:					mcpCount = fmt.Sprintf("%d", len(ws.Spec.Mcp.Servers))
./cmd/ax/main.go:647:			if ws.Spec.Mcp != nil {
./internal/workspace/planner.go:82:		mcpConfig = ws.Spec.Mcp
```

`:489` 数个数填表格列，`:647` 是 `ax describe workspace` 的打印，`planner.go:82` 那位只取了个 `!= nil` 的布尔。三个都是读数，零个是装配。

![上方一道括号框住三条并列的声明，只有左边那条管道真的插进沙箱平台，中右两条在半空中断成锯齿空心口，断口下方各留一块空着的压痕](/assets/img/google-ax-workspace-materialization/01-flow-three-claims.webp)

## 🕳 那个字段最远走到哪一行

我想知道 MCP 声明的旅程终点，于是把 `ax.proto` 到容器里的路走了一遍。

schema 侧齐备：`ax.proto:193` 的 `WorkspaceSpec` 三个字段 `git`/`mcp`/`skills` 都在，`MCPConfig` 里 `registries` 和 `servers` 都在，`MCPServer` 连 `endpoint`/`command`/`args` 都留了位。示例侧也在：README 的 Quick start 让你 `ax apply -f examples/task.yaml`，那份文件 `:53`-`:59` 老老实实声明了一个 registry 加一个 `git-tools` server，endpoint 是 `http://git-mcp.default.svc.cluster.local:8080`。

然后它走到 `cmd/ax/main.go:483` 就停了。那一行的内容是一个表头：

```go
fmt.Fprintln(w, "NAME\tATESPACE\tGIT-REPOS\tMCP-SERVERS")
```

我把 GIT-REPOS 和 MCP-SERVERS 并排放在同一张表里看过很久，才确认这两列的语义不是一回事：左边那列数的是"沙箱里会有几个目录"，右边那列数的是"Redis 里存了几条声明"。表格不会告诉你这个差别。`ax describe workspace` 会更具体一点，它打印 `- git-tools: http://git-mcp.default.svc.cluster.local:8080`，读起来像状态列表。

唯一可能兜住它的是 `goal` 那条路。`SetupWorkspace` 在有 goal 时会调 `runBootstrap`（`:277`），它要求容器里有 `/usr/local/bin/antigravity_bootstrap.py` 且 `GEMINI_API_KEY` 非空，缺一个就静默跳过。这条路是真通的——`Dockerfile.task-runner:26` 装了 `google-antigravity`，`:29` 把脚本 COPY 进去。但那脚本全文 129 行，入参只有 `--goal`、`--workspace`、`--data-dir` 三个，它不去读 metadata 端点。

而声明原文其实就在沙箱里躺着：`internal/metadata/server.go` 一共两个数据端点，`:100` 的 `/metadata/v1alpha1/ax/workspaces` 按注释是把每个绑定的 Workspace 以 YAML 流原样吐出来。所以准确的说法不是"看不见"，是**看得见、没人装**：任何愿意自己写 5 行 curl 加装配逻辑的人都能补齐，但那就不是 `Workspace` 这个原语在替你做的事了。

同一场重构里还有个 112 行的 `planner.go`，`Planner`、`PlanEnvironment`、`EnvironmentPlan` 三个符号全包之外零调用者，只有 `planner_test.go` 陪着。我本来要在正文写"新加的没人用的死代码"，读到 5 月才改口：#370 那次提交删掉了 `internal/experimental/antigravity/` 那 231 行的 sidecar planner，PR 正文写着 `this PR removes the remaining experimental integration to avoid confusion to end user`。它不是新写的尸块，是被有意断开之后留的接口。这条我记在这儿，是因为它顺带给出了一个更好的判断基准：这个仓库自己认为"feature list 与行为不一致"值得单独开一个 PR 去修。

![一个字段从 YAML 出发，经过 Redis、表格列、describe 输出，最后停在一扇没有接管道的门前](/assets/img/google-ax-workspace-materialization/02-trace-field-journey.webp)

## 15 秒、10 分钟，和一次都不会报错的失败

如果只留一节，我留这节。它比 MCP 那件事更容易咬到人。

`cloneRepos` 全部失败时会怎样？`setup.go:120`-`:123` 的原文是：git 不 OK 就打一条 `slog.Warn`，然后 `return res, nil`。返回的 error 是 `nil`。

往下一层，`runner/runner.go:156`-`:165` 的判断是"只有 `err != nil` 才算没就绪"，于是它照样执行 `metaServer.SetWorkspaceReady(true)`。再往下，`/readyz` 就返回这个布尔。再往下，`internal/controller/reconciler.go:302`-`:306` 据此把条件写成 `WorkspaceReady=True`、reason 字符串 `SetupComplete`，紧接着把 `Ready` 也写成 True。

链子是一环扣一环的，五处我都对着读了。后果：5 次重试全失败的 clone，在 `ax describe` 里长成一个 setup 已完成的干净任务。`reconciler.go:329` 那行注释我很在意——`condWorkspaceReady reports whether the workspace inside the actor has finished setting up`。它承诺的是"结束"，不是"成功"。这个措辞挑不出毛病，但敲 `ax get tasks` 的人不会去翻注释。

![五个站台手递手传五盏一样亮的绿灯，最后一个站台把灯举过头顶、头顶一块空白的招牌，只有第一个站台脚边那只裂开的空箱没人接](/assets/img/google-ax-workspace-materialization/03-chain-five-green-lamps.webp)

三个数放在一起看更有意思：控制器等 ready 的窗口 `defaultWorkspaceReadyTimeout = 15 * time.Second`（`reconciler.go:52`），bootstrap 的默认上限是 `10 * time.Minute`（`setup.go:56`），git 重试本身要吃 `5 × 2s`。我没跑过任何一个真控制器，所以这三个数我只摆出不推——它们够不成"一定会怎样"，够构成"我想知道答案"。

这三个数互相不认识。

同形状的"文档有、schema 有、代码没人读"不是孤例，用户在 09-22 到 09-23 报了三个，我自己都能对上：

| 报料编号 | 一句话 | 我的独立核验 | 现场 |
|---|---|---|---|
| #369 | `TaskSpec.resources` 有文档，从没被应用到 ActorTemplate | 非测试非生成代码里 `.Resources` 消费点 **0** | `ax.proto:83` 有字段，`docs/manifests.md:20` 给了 requests/limits |
| #371 | 文档写 `provider: anthropic`，实际只实现了 google | `client.go:40` 只有 `ProviderGoogle`，`:486` 走 else 就 `unsupported provider %q` | `docs/manifests.md:130`、`:143` 教用户这么写 |
| #364 | `make build-task-runner` 失败，`.dockerignore` 把 `bin/` 排掉了 | `.dockerignore:7` 是 `bin/`；`Dockerfile.task-runner:28` 恰好 `COPY bin/linux_amd64/...` | 我没 Docker，这条只到文本互斥 |

三条都是 open、都还是 0 评论。我不把任何一条定性成漏洞或缺陷成立的证据——除了我能自己复算的那部分，也就是右边那列。#363 那句 `RCE: unvalidated git repo URL/branch in fetchRepo` 就挂在我上文夸过的那 35 行上，我只登记"有人这么报、还开着"，判不了。

## 🪤 照着示例敲完，你手里剩下什么

对做 AI 应用的人来说，这件事的实际形状是：你以为 `ax apply` 之后环境是热的，实际上你拿到的是一个真 clone 出来的仓库、一个空目录、和一个说"完成"的状态位。

- **在 ax 上做内部 agent 平台选型 or 评测的人**：`WorkspaceReady` 不能当环境断言用。把断言写到你自己的命令里，`ax ssh <task> -- curl -s localhost:端口/metadata/v1alpha1/ax/workspaces` 拉声明、再 `ls` 一遍你真正依赖的东西，两边对不上就别往下跑。
- **要给 agent 挂 MCP 工具的人**：现在这条路只能自己在镜像里装，或者把 endpoint 写进 `spec.env` 让任务命令自己去读。别指望 `spec.mcp` 省你一步。
- **在写自己平台 v1alpha1 的人**：这是最值钱的一条。ax 这次的做法是三样先进 schema、先进文档、先进示例，再一样一样补实现，中间靠 `Roadmap` 挂账。这条路我认可它坦诚的程度——但要承认代价：从字段进 schema 那天起到它真生效那天，CLI 输出的每一列都是暧昧的。

我下一步盯什么（三条，都可证伪）：

- [ ] roadmap §2 那句 `Splitting Task Workspace Setup into a Separate Actor` 里明写了要补 `MCP and skill materialization`。哪天真出现一个 setup actor 或者 `internal/workspace/` 里冒出读 `Spec.Mcp` 的第四处，我回来把本篇第二节那句"零装配"改成"曾有"。
- [ ] #391 把 Git 从演示里请了出去，`examples/task.yaml:49` 那份 chalk 声明还站着。哪天示例文件里的 `git:` 也被清掉，说明"稳定面"又缩了一格。
- [ ] `Spec.Mcp` 的第 4 个读取点。0 就是 0，我下次用同一条 grep 复跑。

## 那 6 笔账，今天结 3 笔

上期（09-22 那篇金融插件仓库）我挂了 6 笔，逐笔交代。

README 第 113 行那笔结清了。同一份 `financial-services/README.md`，09-24 14:33Z 第三次抓：还是 246 行、15,894 字节、sha256 前缀 `52f689c6c32bd2a5`，逐字节没动，`:113` 那条 `claude-for-financial-advisors` 还列在插件表里。上期那句"一个字没动"继续成立，不用改写成"后来也被删了"。

#367 那笔按约定撤。承诺写的是"若仍无官方回复就不再当会被回应的问题来跟"——现在 comments 是 1，`updated_at` 09-24T09:08:46Z，距建单 29 小时 11 分。唯一那条来自 `GinTama12`，正文逐字：`Nobody gives a damn about you`。所以这笔结在这儿，不跟了。

反向判断那笔也结：`.github/workflows/` 下正好 3 个文件（`plugin-validate.yml` 2,133 字节、`secret-scan.yml` 1,156 字节、`version-bump.yml` 700 字节），对 `check.py` 的引用数都是 0；全目录唯一的 `.md` 命中是 `secret-scan.yml:30` 那句 `--include='*.md'`，扫密钥用的，不解析链接。收窄条件没出现，上期第五节的范围照旧。

剩下三笔我不再挂：给自家 wxt 扩展补 `.mcp.json` 校验那笔主动撤回，动作在这仓库之外、Job B 跑不到它，继续挂着等于用正文给自己排期；pnpm 七行版本表那笔按上期自己写死的规则撤回（第 3 次没等到成员 ≥10 的样本）；fixture 扩 2 个 task 那笔再顺延一次，但按上期规则，第六节那句没复现过的执行顺序引用从今天起标为待删。

顺手把口径钉在这里，免得下次我又凭印象写：上期我说 `7 个版本挨个跑：3 个 exit=1，4 个 exit=0`，那篇文章的底气来自我能挨个跑。今天这 14,214 行 Go 我一行都跑不了，本机 `go`、`docker`、`kubectl` 三条命令一律 exit=127：

```text
$ go test ./internal/workspace/
(eval):1: command not found: go
exit=127
```

所以本篇所有"没有消费点"的断言，证据面就是 grep 加 `git log -S`，边界我写清楚：我没跑过 controller，没跑过 runner，没起过 Redis，`gcr.io` 在这台机器上连 `https://gcr.io/v2/` 都取不到（`000`），因此那个新默认镜像到底拉不拉得动，我不知道，也没写成结论。

顺手把这篇故意略过的部分列出来，免得下一个人重复扫。`Gateway` 的 egress allowlist 真拦不拦得住出网、`Model` 那一节除了 google 还认谁、`internal/controller` 是怎么等 actor 起来的，这三块我点开过又关掉了：本机起不了容器，任何一句"它会"或者"它不会"都是猜，所以这篇不讲。`planner.go` 那 112 行我逐行读了，可它原打算从哪一侧被接上、和 roadmap §2 里那个 setup actor 是不是同一件事，仓库里没留答案，我也不替作者把答案编出来。翻车点我只挑能对着行号复算的，剩下的坑留给真跑得起来的人。

那 1 行表格现在还站在 README 里，那 3 列声明现在还躺在 Redis 里。等到 `ax describe workspace` 那行 `- git-tools: http://…` 底下真的接出一个能连上的 server，`WorkspaceReady` 才第一次有两个意思——那时候该问的会不会就不是"有没有实现"，而是"你凭什么说 ready"？
