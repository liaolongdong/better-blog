---
layout: post
title: 一条命令装进 79 个 Agent，我的空目录最后只落 3 条路径
subtitle: 屏幕说 symlinked 两个，磁盘上只有一条 symlink
seo_short_title: npx skills：79 个 Agent 落盘实测
seo_description: 我用 npx skills@1.7.2 在空目录装同一技能：79 个 Agent 里 54 个因项目目录不存在被跳过，只剩 3 条路径；单 Agent 默认复制，多 Agent 才建 .agents 目录和 symlink。
date: 2026-10-17
categories: [AI, 开源实测]
cover: /assets/img/npx-skills-agent-paths/banner.webp
tags: 开源 Agent 工具 AI
---

![封面：一份技能文件分叉成许多 Agent 目录，只有三条路径真正落地](/assets/img/npx-skills-agent-paths/banner.webp)

我在一个空目录里敲完 `npx skills add /tmp/local-skill -a '*' -y`，屏幕上跳出一行 `Installing to all 79 agents`。两秒后，`find . -name local-demo` 只回了我三条路径。

这不是 bug。它把一个很少被讲清楚的规则暴露出来了：**npx skills 的“支持 79 个 Agent”说的是名字，不是目录。** 真正落盘多少，取决于你选了谁、这些 Agent 的项目目录在不在、以及你用默认模式还是 `--copy`。

我花了半个下午，把单 Agent、双 Agent、全 Agent、删除、错误输入和路径穿越都跑了一遍。下面是我看到的。

## 空目录里的 79 个 Agent，最后只剩三条路径

先交代环境：macOS 22.2.0 / x64，Node v22.19.0，npm 10.9.3，`skills@1.7.2`（2026-10-09 发布）。仓库 HEAD 是 `13e4063a1cf913f5606d57d42ab83a86f5001e04`，MIT。

第一个让我愣住的不是 79，而是 54。

`-a '*'` 的全量安装结束后，终端先打印了：

```text
universal: Amp, Antigravity, Antigravity CLI, Cline, Codex +18 more
symlink → AiderDesk, AstrBot, Autohand Code CLI, Augment, IBM Bob +51 more
```

终端末尾又补了一行：

```text
symlinked: Claude Code, Eve
skipped: AiderDesk, AstrBot, Autohand Code CLI, Augment, IBM Bob +49 more
  (project directory not found)
```

23 个 universal、2 个 symlinked、54 个 skipped，加起来正好 79。磁盘上实际只有：

```text
.agents/skills/local-demo        # 规范副本
.claude/skills/local-demo        # 唯一一条 symlink
agent/skills/local-demo          # Eve 的副本，真目录
```

`find . -type l | wc -l` 是 1。`npx skills list` 只认两个 Agent：Claude Code、Eve。

![终端里显示安装到 79 个 Agent，紧接着的 find 只列出三条本地路径](/assets/img/npx-skills-agent-paths/02-screenshot-all-agents.webp)

**换句话说，屏幕上的“全装”是名单全选，不是目录全建。** 这个设计本身不算坏——它避免了在你的项目根目录里凭空造出 54 个空文件夹——但如果你只看第一屏的 `Installing to all 79 agents`，很容易以为所有 Agent 都已经接上了。

为了确认“跳过”的触发条件，我在第二个空目录里先 `mkdir .aider-desk`，再跑同样的命令。

结果 summary 变成了：

```text
symlinked: AiderDesk, Claude Code, Eve
skipped: AstrBot, Autohand Code CLI, Augment, IBM Bob, OpenClaw +48 more
```

磁盘上也多了一条 `.aider-desk/skills/local-demo -> ../../.agents/skills/local-demo`。

规则很直白：**目标 Agent 的项目根目录不存在，CLI 就不替你创建，只在 summary 里记一笔 skipped。** 你项目里已经有 `.cursor/`、`.claude/`、`.aider-desk/`，它才会往里面放 symlink。对多 Agent 混用的仓库，这算一种保守的礼貌；对第一次上手的人，第一屏的 79 很容易造成误判。

## 从手动拷贝到路由表：一份规范副本加一张 lockfile

在这之前，我的做法很土：`git clone` 一份 skill 仓库，再把 `SKILL.md` 拷到 `.claude/skills/`；如果同时用 Cursor，就再拷一份到它认的目录。两三个 Agent 还能忍，四个以上就开始出问题：

- 哪份是最新的？没有 lockfile，只能靠文件名和记忆。
- 改了一处，另外两份忘了同步，Agent 行为不一致。
- 想删干净，得记住每个 Agent 的路径。
- 想回滚，只能重新 clone。

`npx skills` 解决的不是“下载”这一步，`git clone` 本来就能下载。它解决的是**落盘路由**：同一份技能，按 Agent 的约定放到该放的位置，并记下来源和 hash。

双 Agent 安装时，磁盘结构终于变成了 README 里说的样子：

```text
.agents/skills/web-design-guidelines/SKILL.md   # 规范副本
.claude/skills/web-design-guidelines -> ../../.agents/skills/web-design-guidelines
```

Cursor 被归到 `universal`，直接读 `.agents/skills/`，不额外建目录。`skills-lock.json` 里记了四样东西：来源 `vercel-labs/agent-skills`、`sourceType=github`、`skillPath=skills/web-design-guidelines/SKILL.md`、`computedHash=a6a44d...`。

这份 lockfile 是它和“手动 cp”最本质的区别。你可以把它提交进仓库，让同事和 CI 知道这个技能到底从哪来、哪一版。`skills update` 会按它检查更新；我这轮跑的时候，输出是 `✓ All project skills are up to date`。有更新时它会不会覆盖你本地改过的 SKILL.md，我没造一个上游新版本去试，**这条没验到**。

还有个细节：**单 Agent 安装不会创建 `.agents` 规范目录。** 我单独装 `claude-code` 时，summary 第一行写着 `./.agents/skills/web-design-guidelines`，实际磁盘只有 `.claude/skills/web-design-guidelines/SKILL.md`，`find` 找不到 `.agents`。双 Agent 才触发 canonical + symlink。

这不是文档写错，而是它的策略：只有一个目标时，复制一份最省事；有多个目标时，才值得维护一份规范副本。README 把 symlink 标成“Recommended”，但没有说它在单 Agent 下不会发生。

## 单 Agent 是 copy，双 Agent 才 symlink

我把四种常见装法放在一起，差异比 README 的表格更直观：

| 装法 | 命令里的目标 | 磁盘结果 | 实测耗时 |
|---|---|---|---|
| 单 Agent | `-a claude-code` | `.claude/skills/...` 一份真目录 | 46.65s（含首次克隆） |
| 双 Agent | `-a claude-code -a cursor` | `.agents` 规范副本 + 1 条 symlink | 2.91s（本地源） |
| 全 Agent | `-a '*'` | 3 条路径、1 条 symlink、54 个 skipped | 2.99s（本地源） |
| 强制复制 | `--copy` + 双 Agent | 两份真目录，0 条 symlink | 2.15s（本地源） |

表后的判断：**如果你只用一个 Agent，`npx skills add` 的默认行为和手动 cp 没有本质区别，唯一多出来的是 lockfile；真正省事的是两三个 Agent 混用。** 如果你追求“一份文件、多处复用”，要确认目标数大于一，或者直接用 `--copy` 接受两份副本。

耗时也能说明一点问题：冷启动 `npx skills --help` 是 8.08s，`--list` 是 12.85s，单 Agent 首次网络安装是 46.65s；后面这 30 多秒主要花在 npx 缓存和整仓 clone 上。换成已经缓存的本地源后，双 Agent 2.91s、全 Agent 2.99s、`--copy` 2.15s。**它自己的落盘逻辑很轻，慢的是“把仓库拿下来”这一步。**

`--copy` 的代价也很直接：技能目录多大，就复制几份。这次的 `web-design-guidelines` 只有 4.0K，复制两份无所谓；如果是一个带脚本、模板和图片的大 skill，差别就会变成几十 MB。

还有一个体验上的小毛病：`--list` 和 `add` 在非 TTY 环境里仍会往输出里刷 spinner 的控制字符，重定向到日志后能看到一堆 `Fetching skills…`。如果你要在 CI 里解析结果，先做一次过滤，别直接 `grep` 原始输出。

![示意图：单 Agent 复制、双 Agent 符号链接、全 Agent 大量跳过三种落盘结果](/assets/img/npx-skills-agent-paths/04-comparison-install-modes.webp)

## 79 个名字、58 份配置：谁和谁共用一个目录

README 说支持 79 个 Agent；源码里 `AgentType` 也是 79 个值，但 `src/agents.ts` 的 `agents` 对象只有 58 个 key。原因不神秘：很多 Agent 共用同一个目录约定。

举一个具体的：`cline`、`codex`、`dexto`、`fx`、`kimi-code-cli`、`loaf`、`pi`、`sarvam-code`、`warp`、`zed` 这 10 个名字，共用 `src/agents.ts` 里的一条配置，落点都是 `.agents/skills/`。79 减掉这些合并项，才是 58。README 的 79 个 `--agent` 值我没有手点，是用脚本按表格第二列数出来的；`AgentType` 的 79 个值也单独数了一遍，两边对上了。

![示意图：79 个 Agent 名字先收敛成 58 份配置，再分成规范副本和跳过两条路](/assets/img/npx-skills-agent-paths/03-flowchart-agent-paths.webp)

| 类型 | 例子 | 实际目录 | 本次数量 |
|---|---|---|---|
| universal | Amp、Codex、Cline、Zed | `.agents/skills/` | 23 |
| symlink 到规范副本 | Claude Code | `.claude/skills/` | 1 |
| 独立 copy | Eve | `agent/skills/` | 1 |
| 跳过 | AiderDesk、AstrBot、Augment | 项目里没有对应根目录 | 54 |

表后的判断：**79 是市场名单，58 是配置表，3 才是这次空目录里的物理结果。** 三个数字都真实，但回答的是不同问题。你如果拿 79 去评估“装完占多少目录”，会高估；拿 3 去评估“支持多少 Agent”，会低估。

还有一处 summary 和磁盘对不上的地方：全量安装的 summary 把 Eve 写在 `symlinked` 里，但 `agent/skills/local-demo` 是个真目录，不是 symlink。`find . -type l` 只找到 Claude Code 那一条。Eve 可能需要独立副本，CLI 按自己的规则处理了；屏幕上的分类没跟上。

## 边界：缺 SKILL.md、路径穿越与大仓库超时

我挑了三个失败路径，看看它会不会说人话。

第一，本地目录里没有 `SKILL.md`：

```text
No skills found
No valid skills found. Skills require a SKILL.md with name and description.
```

退出码 1。没有堆栈，也没有假装成功。

第二，我在 `SKILL.md` 的 `name` 里写了 `../../evil-name`。安装完成后，磁盘上的目录是 `.claude/skills/evil-name/`，没有跳出 `.claude/skills/`。源码里的 `sanitizeName()` 会把非 `[a-z0-9._]` 的字符压成 `-`，再去掉首尾的点和横线。安全上这是对的；但 summary 仍然显示原始名 `../../evil-name`，看起来有点吓人。

第三，删除。`skills remove web-design-guidelines -y` 退出 0，规范副本和 symlink 都清掉了，`skills-lock.json` 变成 `{"version":1,"skills":{}}`，但 `.agents/skills/` 和 `.claude/skills/` 两个空目录还留着。无害，但别把它当成“没删干净”。

| 我做的操作 | 结果 | 我的判断 |
|---|---|---|
| 目录里没有 `SKILL.md` | exit 1，提示 `Skills require a SKILL.md with name and description` | 错误信息说人话 |
| `name` 写成 `../../evil-name` | 落到 `.claude/skills/evil-name/`，没有逃出去 | 路径安全，屏幕显示吓人 |
| `remove` 已装技能 | lockfile 清空，空目录留下 | 内容干净，目录不回收 |

还有一个环境层面的小插曲：`skills@1.7.2` 的 `package.json` 要求 Node `>=22.20.0`，我这台机器是 v22.19.0。`npx` 打印了 `EBADENGINE` warning，命令仍然跑通。我没有 22.20+ 的环境，无法判断这是单纯的版本声明保守，还是某个 API 真的在 22.20 才出现。**这条我没验到。**

小边界之外，还有一条大的：`npx skills add` 的底层还是 `git clone`，仓库一大，问题就来了。

`vercel-labs/skills#278`（2026-02-04 开，截至 2026-10-17 仍是 open，13 条评论）里，有人装 `vercel/turborepo` 的 skill：仓库约 770MB、6,830 个文件，而目标 `skills/turborepo/` 只有 38 个文件。CLI 用了 `--depth 1`，但那只省历史，不省 HEAD 的文件，60 秒后 clone 超时。社区给的 workaround 是：先手动 `git clone --depth=1`，再把本地路径传给 `skills add`。

这正好解释了我自己在第二次网络安装时遇到的 `Failed to clone repository`。它不一定是仓库的问题，也不一定是网络的问题，而是这条“先整仓 clone，再挑文件”的路径对大仓库天然不友好。

![GitHub issue 278 的页面，标题写着大仓库安装会触发 clone 超时](/assets/img/npx-skills-agent-paths/05-screenshot-issue-278.webp)

另外两条 open issue 也值得知道：`#840`（2026-04-01）说 Windows 上全局安装的技能 `update` 失败；`#421`（2026-02-25）说 Cursor 全局技能的默认目录不对。都不影响我这次 macOS 项目级安装，但如果你在 Windows 或全局模式下用，先看一眼。

## 谁该用，谁先别用

我会把它推荐给这三类人：

- 同时在 Claude Code、Cursor、Codex 之间切换，想让同一份 skill 只维护一次的人。
- 想把 skill 来源和版本写进仓库、让同事和 CI 对齐的人。lockfile 比“我本地有一个文件夹”可靠。
- 只想临时用一次某个 skill 的人。`npx skills use /tmp/local-skill --skill local-demo` 只往 stdout 打 271 字节的 prompt，不落盘，适合一次性任务。

我会劝这三类人先别急：

- 只用一个 Agent 的人。默认就是 copy，和你手动 cp 的区别只有 lockfile；如果你不在意版本记录，手动更直接。
- 大型 monorepo。先看 #278，能手动浅克隆再传本地路径，就别让 CLI 去啃整仓。
- 需要强审计的团队。CLI 的 summary 里确实有 Socket/Snyk 的风险标记，但它安装的是 markdown 指令，最终执行权限在 Agent 手里。安装完的提示写得很清楚：`Review skills before use; they run with full agent permissions.` 这句话比任何风险徽章都重要。

顺带说个我自己的翻车：第一次试 `use`，我写成了 `npx skills use /tmp/local-skill@local-demo`，CLI 直接回 `Local path does not exist: /tmp/local-skill@local-demo`。本地路径得配 `--skill`，写成 `npx skills use /tmp/local-skill --skill local-demo` 才通。README 的示例主要给 GitHub 源，本地路径这条语法没有现成例子。

如果你想今天就试，最小的一套命令大概是：

```bash
# 先看仓库里有哪些 skill
npx skills add vercel-labs/agent-skills --list

# 装到两个 Agent，默认走 symlink
npx skills add vercel-labs/agent-skills --skill web-design-guidelines \
  -a claude-code -a cursor -y

# 只打印 prompt，不落盘
npx skills use vercel-labs/agent-skills --skill web-design-guidelines
```

## 本周另外两个仓库

**ranxianglei/billion-context**：给 coding agent 做上下文压缩的代理。我核了 npm 上的 `billion-context@0.1.198`：license 字段写 MIT，GitHub API 却识别成 NOASSERTION，LICENSE 文件不是标准文本；`dist.unpackedSize` 是 147,805,403 字节，约 141 MB，光 `dist/agent/pi-native.js.map` 就占 14.9 MB。README 说能省 5 倍 token、撑到 100K 窗口，这轮我没接真实 agent 和上游 API，压缩率没验。它自己承认 jcode 只能 cert-MITM、Gemini CLI 只能 launcher。想接之前，先看看那 141 MB 里有多少是 sourcemap。链接：https://github.com/ranxianglei/billion-context（截至 2026-10-17）

**KittenML/KittenTTS**：能在 CPU 上跑的本地 TTS。我核了 PyPI 上的 `kittenml==0.9.4`：wheel 只有 129,810 字节，Apache-2.0，要求 Python >=3.10，包本身很薄，权重另下。GitHub releases 最新 tag 还停在 `0.8.1`（2026-02-24），但仓库到 2026-10-16 仍在 push，release 页落后于 main。README 说 1.7B 参数 1-bit 模型、默认 947 MiB、47 个音色、20 种语言、CPU 实时；我没下权重，实时性没验。想不碰 GPU 跑 TTS 的人可以盯一下，先确认要用的音色在不在那 47 个里。链接：https://github.com/KittenML/KittenTTS（截至 2026-10-17）

## 我的判断：它是技能落盘的路由表

回到那个空目录。

`Installing to all 79 agents` 这句话没有撒谎，它只是回答了“名单上有谁”。真正决定你磁盘长什么样的，是另外三个变量：目标 Agent 的项目根目录在不在、你选了一个还是多个目标、你用默认还是 `--copy`。

**npx skills 的价值不在“一条命令装 79 个”，而在把 79 个名字收敛成 58 份配置，再用 canonical + symlink + lockfile 把落盘这件事变成可重复的。** 对多 Agent 用户，这个收敛值钱；对单 Agent 用户，它更像一个带版本记录的 cp。

下次你看到那行 `Installing to all 79 agents`，别急着关终端。先跑一句 `find . -name SKILL.md`。屏幕上是名单，磁盘上才是事实。

什么证据会让我改口？如果后续版本在单 Agent 下也建 `.agents` 规范目录，或者 `-a '*'` 开始替你创建缺失的项目根目录，我上面“3 条路径”的判断就作废；如果 #278 用 partial clone 或按需下载修掉大仓库超时，那条劝退也要撤回。这两个变化都比 star 数值得盯。

项目地址：https://github.com/vercel-labs/skills

---

参考：

- 仓库：https://github.com/vercel-labs/skills（抓取 2026-10-17）
- v1.7.2 release：https://github.com/vercel-labs/skills/releases/tag/v1.7.2（2026-10-09）
- issue #278：https://github.com/vercel-labs/skills/issues/278（2026-02-04）
- issue #840：https://github.com/vercel-labs/skills/issues/840（2026-04-01）
- issue #421：https://github.com/vercel-labs/skills/issues/421（2026-02-25）
- npm 包：https://www.npmjs.com/package/skills
