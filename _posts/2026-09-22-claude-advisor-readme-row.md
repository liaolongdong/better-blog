---
layout: post
title: 我把 Anthropic 的金融插件仓库读了一遍，发现回滚漏掉了 1 行
subtitle: 独立仓库下架、marketplace 条目摘掉、插件目录删干净，三刀之后 README 表格里那一行还站着；同仓库另一头，2 个字符的 JSON 语法错挂了 116 天，19 个 PR 一个没合进去
seo_short_title: Anthropic 金融插件仓库：回滚漏掉的那 1 行
date: 2026-09-22
categories: [AI, 开源实测]
cover: /assets/img/claude-advisor-readme-row/banner.webp
tags: AI 开源 Agent 插件
---

# 我把 Anthropic 的金融插件仓库读了一遍，发现回滚漏掉了 1 行
![一座被搬空的插件目录，只有 README 表格里的最后一行还立在原地](/assets/img/claude-advisor-readme-row/banner.webp)

```bash
$ claude plugin install claude-for-financial-advisors@claude-for-financial-services
Installing plugin "claude-for-financial-advisors@claude-for-financial-services"...✘ Failed to install plugin "claude-for-financial-advisors@claude-for-financial-services": Plugin "claude-for-financial-advisors" not found in marketplace "claude-for-financial-services". Your local copy may be out of date — try `claude plugin marketplace update claude-for-financial-services`.

T5 exit=1
```

这是我 09-22 22:33（UTC 14:33Z）在本机敲出来的原文，Claude Code 2.1.145。仓库是 [anthropics/financial-services](https://github.com/anthropics/financial-services)，那晚 14:13Z 抓的是 36,116 star，第二天 18:34（UTC 10:34Z）复核是 36,662。稿子日期写 09-22：选题那晚定了，复核跨到第二天。

先把标题欠的债还掉。[README](https://github.com/anthropics/financial-services/blob/main/README.md) 的安装代码块（`:59-74`）里已经没有这个名字了，摘得挺干净。但同一个文件往下翻，那张插件表格的第 113 行还列着它，一个字没动。

## 246 行里那一行为什么还站着

README.md 现在 246 行、15,894 字节，sha256 前 16 位 `52f689c6c32bd2a5`，我隔一天抓两次，字节一样。第 113 行逐字是这样：

```
| **[claude-for-financial-advisors](./claude-for-financial-advisors)** | Advisor workflows: meeting prep and follow-up, compliance pre-check, prospect intake, rebalance review, alts and estate briefs, on live data from the advisor's CRM, portfolio, planning, and estate platforms. |
```

它指的目录，`…/tree/main/claude-for-financial-advisors` 现在回 404。同仓库的 `.claude-plugin/marketplace.json` 是 5,008 字节、19 个 entry，提到这个插件的 0 个，所以 CLI 才说 not found in marketplace。一个给人看的表格和一个给机器看的清单，从今天起互相不打招呼。

那它当初怎么进去的？我把三个 PR 的文件清单做了个集合差：

```
#350 files=26 sum(changes)=2568  stats total=2568
#351 files=1  sum(changes)=6     stats total=6
#354 files=24 sum(changes)=2561  stats total=2561
#350 minus (#351 ∪ #354) = ['README.md']
survivor: README.md status=modified +1 -0 changes=1
```

2,568 = 2,561 + 6 + **1**，26 − 1 − 24 = 1。活下来的就是那个文件的那一行，`status=modified`，上架那次的 patch 里它是一整行 `+`，下架那两次谁都没碰 README。

![左侧一圈被搬空的深色文件块，中间两把钳子各夹走一块，箭头指向右侧唯一亮着的方块和它旁边空掉的虚线框](/assets/img/claude-advisor-readme-row/01-flow-three-cuts.webp)

是不是有人故意留着当入口？没有任何证据支持这个读法，集合差显示的是另一种解释：回滚是照着文件清单减的，不是照着语义减的。清单里没有的文件，没人回头问一句还有谁在提它。

## 往回倒 11 天：上架 35 分 37 秒，摘掉条目用了 7 分 2 秒

倒着排。时间全是 UTC，取自 `/commits` 和 `/pulls/{n}`。

![从最近一次合并往回倒推的时间轴，两段窗口被单独放大：35 分 37 秒与 7 分 2 秒](/assets/img/claude-advisor-readme-row/02-timeline-reverse-window.webp)

- [`2026-09-21T21:10:41Z`](https://github.com/anthropics/financial-services/commit/574ed3624aebd0418c7e96cd101262f30210ab26)，`574ed362` 合进 main，**−2,561 / +0 / 24 个文件**，24 条 `status=removed`。这是 main 上最后一次提交，复核那刻已 1 天 13 小时没动过。
- [#354](https://github.com/anthropics/financial-services/pull/354) 标题是 `Delete claude-for-financial-advisors directory`，09-16T00:20:43Z 开、09-21T21:10:42Z 合，在路上跑了 5 天 20 小时 49 分 59 秒。
- [#351](https://github.com/anthropics/financial-services/pull/351) 09-14T16:35:43Z 开、16:42:45Z 合，7 分 2 秒。正文原话：

  > Keeps the plugin directory; removes only the marketplace listing to avoid a duplicate.

  这句话在说出口那一刻是真的。两天后 #354 把目录删了，两句都是真话，中间没人改过 README。
- [`6e7f94d3`](https://github.com/anthropics/financial-services/commit/6e7f94d3fc5aed3289d63a90999252162b3cc8f8)（#350 上架那次）09-14T16:14:17Z 合进 main，+2,568 / 26 文件，从开到合 35 分 37 秒。

四个相关 PR 的讨论量：#350、#351 各 0 条评论 + 1 条 body 为空的 `APPROVED`，#354、#356 各 1 条评论 + 2 条空 body 的 `APPROVED`。这是计数，不是指控。

独立仓库 [anthropics/claude-for-financial-advisors](https://github.com/anthropics/claude-for-financial-advisors) 复核那天 54 star、34 文件、269,780 字节，`pushed_at` 停在 09-16 23:30:11Z。它 README 第 9 行：

```
**Maintenance status:** Reference implementation. Not actively maintained or
monitored, and not accepting contributions. Issues and pull requests may not
receive a response. This project is provided AS IS, without warranty.
```

同一句在被删掉的 monorepo 副本里也有，我在 `574ed362` 的 removed patch 里搜到了它的 `-` 版本。所以“它一开始就自称没人维护”是两边文件里都摆着的文本，不是我替谁找的台阶。这个独立仓库的 `created_at` 是 09-14T23:08:08Z，比引用它的那次合并晚了 6 小时 53 分 51 秒。被删的副本和它还不完全一样：24 个同名路径里 16 个 sha 相同、8 个不同，README 从 8,500 变 9,851 字节，`.mcp.json` 从 2,212 变 2,421 字节、server 数从 23 变 25。这个插件自己的 `.mcp.json` 两份都是合法 JSON，坏的是另一头的 `financial-analysis`。

---

## 那 2 个字符是谁打进去的

同一份 README 的 `:107` 写着 core 插件收 `All 11 data connectors`，而下面 `:123-134` 那张连接器表是 12 行。差的这一个不是排版问题，它的下游是一个坏掉的 JSON。

`plugins/vertical-plugins/financial-analysis/.mcp.json`，1,172 字节，尾部 10 行原样：

```
      "type": "http",
      "url": "https://mcp-server.egnyte.com/mcp"
    }
    "box": {
      "type": "http",
      "url": "https://mcp.box.com"
  }
}
```

`json.loads` 头一句给 `Expecting ',' delimiter: line 47 column 5 (char 1100)`，只补这一个逗号，下一句变成 `Expecting ',' delimiter: line 52 column 1 (char 1173)`。我拿 difflib 反算最小修法：char 1100 插逗号、char 1101 插大括号，1,172 变 1,174，12 个 server 全解析出来。说白了，这个文件从头到尾没被任何一台机器 parse 过一次。

这 2 个字符来自 [120a31dc](https://github.com/anthropics/financial-services/commit/120a31dcede4affa1d771cbf286a63ee331f92a4)，2026-05-29T16:31:43Z，标题 `Adding Box to MCP Integrations (#187)`，整个 commit +4 / −0，对 `.mcp.json` 那段 patch：

```
@@ -44,5 +44,8 @@
       "url": "https://mcp-server.egnyte.com/mcp"
     }
+    "box": {
+      "type": "http",
+      "url": "https://mcp.box.com"
     }
 }
```

到复核那刻它在 main 上待了 116 天 18 小时。为这 2 个字符死磕过的人不少：标题同时命中 mcp 和 json/syntax/connectors/malformed/invalid 任一词的条目我捞出 26 条（20 PR + 6 issue），冲它开过的 PR 有 **19 个**（18 个改文件、#312 加校验），合进去的 0 个，还 open 15 个（最老的 #259 从 06-01T10:03:31Z 挂到今天，114 天），关掉没合的 4 个，从各自创建时间算活了 2 分 43 秒、3 分 05 秒、6 分 46 秒、40 分 57 秒。我抽 5 个看 diff，5 个都是同一路径、都是 +2 / −1；#300 顺手给 `scripts/check.py` 加了 2 行，标题是 `repair invalid .mcp.json; lint MCP configs in check.py`，抽到的 5 个里只见到它一个提检查的事，另外 14 个的 diff 没逐个看。

报它的 issue 有 4 个：#264、#273、#292、#355。#264 离那个坏 commit 只有 4 天 23 小时，0 条评论。

我原本以为 `claude plugin validate --strict` 至少会报它，跑完 exit=0：

```
=== T2: financial-analysis plugin dir (broken .mcp.json inside) ===
Validating plugin manifest: /private/tmp/b0922/financial-services-main/plugins/vertical-plugins/financial-analysis/.claude-plugin/plugin.json

✔ Validation passed
T2 exit=0
=== T2b: same with --strict ===
✔ Validation passed
T2b exit=0
```

两件我不知道：那 4 个 PR 是谁关的、为什么关，`closed_at` 只有时刻，没有主体也没有原因；那 12 个 URL 是不是都还活着，我没测。

## 五道门，每一道都放了一次水

![五道门排成一条通道，每道门上方挂着一枚放行标记，漏网的那份文件从中间穿过](/assets/img/claude-advisor-readme-row/03-framework-five-gates.webp)

`scripts/check.py` 的 docstring 列了它自己干的 5 项，逐字贴第 2 项和第 4 项：

```
2. Every plugin.json / marketplace.json / steering-examples.json parses.
4. Every system.file, skills[].path, callable_agents[].manifest in agent.yaml
   and subagent yamls resolves to an existing file/dir.
```

`.mcp.json` 不在那 5 项的输入里：第 2 项只 parse `plugin.json`、`marketplace.json`、`steering-examples.json`，第 4 项读的是 `agent.yaml` 里的路径字段，markdown 链接根本不在它的射程内，README.md 本身也不算 manifest。而 README `:242` 和 `CLAUDE.md:31` 对它的说法是 `verifies all cross-file references resolve`，比 docstring 宽。

另一道在 workflow 里：`grep -rn check.py .github/`，exit=1，0 命中，三个 workflow 没有任何一个调它。`.githooks/pre-commit` 602 字节，只跑 `version_bump.py --apply`，头部注释写着 `scripts/check.py self-installs this for you on first run`，也就是你先手动跑一次它才有钩子。glob 是又一道：`plugin-validate.yml` 那句 `find plugins -path '*/.claude-plugin/plugin.json'` 在 HEAD 上命中 18 个，而 marketplace 有 19 个 entry，唯一在 `plugins/` 之外的那个永久照不到，它活着的时候也照不到。还有那句注释本身，其实说得挺准：`Catches malformed manifests (e.g. hooks.json as a bare [] instead of {"hooks": {}})`，它收的输入只有 manifest 路径。

最后一道是我自己撞上的，同一台机器同一个命令，两种翻车姿势：

```
$ python3 scripts/check.py
Traceback (most recent call last):
  File "scripts/check.py", line 23, in <module>
    errors: list[str] = []
TypeError: 'type' object is not subscriptable
T9 exit=1
```

我这台的 python3 是 3.8.0，换 3.9.6 再跑变成 `ERROR: requires pyyaml`，exit=2。

> 同一份插件，`claude plugin details` 在我装未修的那份时显示 `MCP servers (0)`；我手动补进那 2 个字符重装，同一条命令变成 `MCP servers (12)`，而 `Skills (20)`、`Agents (0)`、`~1,463 tok` 三项一个字没变。

![左右两块一样的面板：左边顶部开裂、12 个空钩子；右边完好、12 个实心点，中间隔着一枚逗号和半个大括号](/assets/img/claude-advisor-readme-row/04-comparison-two-characters.webp)

一个逗号加一个大括号，12 个连接器就这么安静地不加载。

给同样往仓库里塞配置的人，我自己做完这圈改了三处习惯：

- 装完插件跑一句 `claude plugin details <name>`，数一下 MCP server 的个数对不对，别看 README 表格数行数。表格是给人挑东西的，机器读的是 `marketplace.json`，两者可以互相不打招呼。
- 别把 `json.loads` 这件事交给 CI。我想加的那条检查先自己跑了一遍，5 行：`os.walk` 全仓 + `json.load` 每个 `.json`。在主角仓库的结果是 `json files parsed: 39 failed: 1`，唯一失败项就是上面那个 `.mcp.json`，exit=0（报错的是被扫的文件，不是脚本）。
- 我自己的插件仓库现在是 husky + lint-staged，检查卡在 commit 那一刻，没换成只在 CI 上跑；它的 lint 只覆盖 ESLint 和 Stylelint，`.mcp.json` 一样漏。上面那条 39/1 是在 anthropics 那份里跑的，我自己仓库还没加，下期正文里交代加了之后的结果。

这篇不讲部署，不讲那 20 个 skill 写得怎么样，也不猜是谁的疏忽。GitHub Actions 上真实的 run 日志我没取，上面关于 CI 的结论全部来自本地同版本 CLI 加 workflow 定义文本。

### 我下一步盯什么

盯 [`GET /commits?path=README.md`](https://github.com/anthropics/financial-services/commits/main/README.md)，那一行哪天消失，我上面“活下来 1 行”就得改写。盯 [#367](https://github.com/anthropics/financial-services/issues/367)（09-23T03:57:13Z，rohitberia 问为什么不恢复 wealth-management，或者给个理由，0 评论）：如果它到我下次跑这题之前还是一条官方回复都没有，我就不把它当会被回应的问题来跟。反向判断也下一个：我不觉得这个仓库会补 README 和 markdown 链接的校验，`check.py` 那 5 项里没有一项的输入是 markdown，要补就得新写一个解析器，而 19 个 PR 的存量摆在那儿，说明现在的优先级不在解析上。

---

## 上期那 5 笔账

上一篇 job B（`2026-09-21-pnpm-task-settings.md`）我登记了 5 条账，这次一起结。

> 把那张七行版本表拿去一个真有几十个 workspace 的 monorepo 上重跑一遍；我的样本是一份五行 fixture 加一份改过 `packages:` 的真实文件，太干净

第 2 次顺延。本机 `find` 扫 `pnpm-workspace.yaml`，两次同口径都只扫出 1 个文件，就是这个博客仓库自己那份，里面 0 个 workspace glob。手上确实没有第二个多 workspace 仓库。条件写死：哪天出现成员 ≥10 的 `packages:`，就跑；否则下期按撤回处理。

> 起一个真 Miniflare 实例 + Images binding，把 imagesLocalFetcher 那条 sharp 路径跑到，验 503/9523

第 3 次挂账，按我自己 09-21 定那条三次为限的规则撤回。这次的理由比上次硬：`df -k .` 09-22T15:16Z 还剩 5,354,332 KB，09-23T10:48Z 只剩 119,896 KB，我删掉可再生的 `_site` 和 `.jekyll-cache` 之后也只回到 143,908 KB。这 4.99 GiB 不是本 run 吃掉的，`/tmp/b0922` 现在总共 39,264 KB，是那次跨了一晚上的暂停里别的东西写的。

剩下三笔：12.5.1 那条 [WARN] 和 exit=1 的差别，我读不到实现（npm 包里的 pnpm 是 48,617,824 字节的 Mach-O 二进制，`strings` 数出 112 次 `rustc/2d8144b7880`），改成行为级回答，解释文本是报错自己给的；`latest-11` 还是 11.27.1，触发条件没到；fixture 扩两个 task 那笔做了一半，另一半栽在 `git init` exit=128，重新挂账。

那 1 行表格现在还站在 README 里，那 2 个字符还站在 `.mcp.json` 里，两处都没人拦。
