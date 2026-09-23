---
layout: post
title: 18,757 Star 的 Cloudflare 安全审计 skill 来了——16 条探针戳它的两个校验器
subtitle: 六阶段 fleet 我在自己机器上跑不动，于是只把仓库里那两个 validator 拎出来跑：65 个测试全绿，可这两道各自绿灯的门，中间没人管
seo_short_title: Cloudflare 安全审计 skill：16 条探针实测
date: 2026-09-21
categories: [AI, 开源实测]
cover: /assets/img/security-audit-two-validators/banner.webp
tags: AI 开源 Agent 工具
---

![两只各管一头的闸门，中间一道对不齐的缝隙被顶光照亮](/assets/img/security-audit-two-validators/banner.webp)

```text
$ node validate-findings.cjs /tmp/probe/P04.json
PASS: 1 findings valid
```

这条 PASS 的输入里，`trace[1].line` 填的是 `1e21`。再跑一遍我换成 `9007199254740993`，还是 PASS。

主角是 `cloudflare/security-audit-skill`，18,757 star（抓数窗口 00:19–00:58，我这边的钟），2026-06-18 建仓，push 停在 09-14。GitHub 周榜本周增量 +14,864，总榜第 2、JS 榜头一名。它没有一条 release，也没有一个 tag。

## 192 行的 SKILL.md 后面挂着 14 个文件

它把“审一个仓库”拆成六个阶段：先派侦察 agent 只读代码不联网，把入口面、信任边界、攻击类别三个维度叉乘出一张 `coverage-ledger.json`，一个 unit 大约等于一次 hunter 派工；然后 hunter 找，verifier 反着查，最后落到 `findings.json`。跑完只能停在两种终态之一，`SKILL.md:179` 写死了：要么第六阶段产物齐、两个 validator 都过，要么 `run_status: incomplete` 加一句精确理由，没有“差不多跑完了”这一档。

![三张散页先打叉，收成一份清单，三个各顶一盏灯的 agent 依次过，右边落成一格一格的勾](/assets/img/security-audit-two-validators/02-diagram-three-axes-ledger.webp)

真正的发明是那两张 JSON 和配它们的校验器代码。我 clone 到 `/tmp` 数了一遍：22 个文件、5,403 行，光 4 个 `.cjs` 就占 3,037 行，56.2%。行数最多的单文件是 `validate-coverage-ledger.cjs`，872 行，而负责调度一切的 `SKILL.md` 只有 192 行。

攻击知识分两层。`ATTACK-CLASSES.md` 只列 9 个核心 class，剩下 153 个摊在 10 个 companion 文件里：MEMORY 20、WEB 20、DESKTOP 16、CLOUD 15、DATA-ISOLATION 15、AI 14、CLIENT-SIDE 14、PROTOCOLS 14、SUPPLY-CHAIN 12、RESOURCE 13。选中哪些块要写进派工单，没选中的还得在 `excluded_blocks` 里留下为什么不要。

还有一处我特意去对：`SKILL.md:82` 说那段 scratch 提升程序由 `HUNTING.md` 和 `VALIDATION-AND-REPORTING.md` 以同一个代码块承载。我把两块都抠出来算了 SHA-256，前 12 位都是 `a2bfd3a1b89c`，各 2,161 字符，unified diff 零行。两份副本此刻确实一模一样。而 `SKILL.md` 自己一个代码块都没有，那 11 步是有序列表。

## clone 下来不到四分钟，65 个测试就跑完了

commit 我钉在 `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8`。两份测试直接 node 跑，不用 npm install：

```bash
$ node validate-findings.test.cjs          # 34 tests, 34 pass, 0 skipped, 2274.822791 ms
$ node validate-coverage-ledger.test.cjs   # 31 tests, 31 pass, 1782.657058 ms
```

能跑。

我的 node 是 v22.19.0，仓库里没有 `.nvmrc`、没有 `.node-version`，也没声明 `engines`。它也没有 release 和 tag，所以想钉版本只能钉 commit SHA，这大概就是我把 `c1c8a8c` 写进正文的原因。建仓 2026-06-18 到抓数那天是 95 天，18,757 star 摊下来每天 197 个。

安装照 README:54 那条 `npx skills add` 走，头一回没成，原样贴出来：

```text
■ Failed to clone repository
fatal: unable to access 'https://github.com/cloudflare/security-audit-skill.git/':
HTTP/2 stream 1 was not closed cleanly before end of the underlying stream
```

17 秒后重跑同一条 `--list`，`◇ Found 1 skill`，退出码 0。真装那次磁盘上多出 20 个文件、348 KB，位置在 `./.claude/skills/security-audit`，`diff -r` 跟仓库里的源目录逐字节相同（退出码也是 0），README 和 LICENSE 不装。两个 validator 在 git 里带 100755 执行位，两份测试是 100644。装它的 CLI 是 `skills` 1.7.0，解包 577,972 字节。

我一开始怀疑它“失败也返回 0”，于是指向一个不存在的仓库再跑，`FAKE_REPO_EXIT=1`。这条怀疑被证伪。至于首跑那次到底是几号退出码，我没取到：输出走了管道，`$?` 是 `head` 的。

## 我本机 51 个 SKILL.md，没有一个干这个的

`~/.qoder-cn/skills` 下 53 个目录、51 个 `SKILL.md`、合计 16,599 行。最接近的是 `requesting-code-review`，103 行，description 写的是“完成功能或合并前派一个 reviewer subagent”，没有 attack class，也没有校验器。我那边 wxt 插件项目立的规则管的是另一头：ESLint + Prettier + Stylelint、husky 提交前门禁、功能做完必须过一遍代码审核。它们回答“符不符合风格”，不回答“这个入口有没有人看过”。

差得最远的是拆分方式。我那儿行数最大的 `architecture-documenter/SKILL.md` 一个人写到 1,456 行；Cloudflare 这个把 192 行留给调度，知识全在 companion 里按需加载。你会发现同一个 agent 跑 153 个类别和跑 9 个类别，喂进 context 的东西不是一个量级。

它多出来的另一半是可核对的产物：ledger 和 findings 都是 JSON，跑完能拿 validator 复查。我现在的 review 收在一段自然语言评论上，隔天没人查得出哪个面没看。我没换它，是因为还没到需要向别人证明“我审过哪几块”的地步。

## 153 个类别里我用得上 14 个，另外一大片我不会去撞

会用的是我那两个 wxt + Vue 3 + TypeScript 扩展仓库，和博客评论用的那个自建 Waline Worker。`CLIENT-SIDE.md:5` 直接把 browser extensions 写进适用范围，`:50` 把 extension storage 与 localStorage/IndexedDB 并列成同一类共享持久化，`:16` 规定 renderer 和 extension permission 观察不到时只能记 `needs_validation`。这三条正好压在我那条“插件里不存高敏感凭证”的空档上：我只写了不存，从来没写过怎么证明没漏存。

不会用的是要它真去执行目标代码的那些仓库。它要求 OS 级沙箱才肯跑 target-controlled 的构建和测试，README 那段列了净化后的环境变量白名单、断网、只写 scratch、CPU/内存/进程数上限，我 macOS 上这些原语一样不齐。`SKILL.md:121-123` 的预算门更硬：先扣掉 4 次基线侦察、1 到 2 次 critic、至少 1 次 verifier，扣不出来就 launch no agent，把 `run_status` 写成 `incomplete`。所以这篇不讲六阶段本身，我只跑了阶段 4 和 5 用到的那两个 validator。别等我把 fleet 那套跑完再来看后半篇，这半年内大概不会有那一天。

## 🔬 16 条探针，3 条没按文档走

13 条按预期拦下：`validation_plan: {}`、`overall_severity: critical` 压着 `impact.score: low`、`evidence[0].line = 0`、标题只剩一个 U+200B、孤立代理对、fingerprint 没按字典序排、两条共用一个 fingerprint、三行 trace 中段写成 `entrypoint`、`remediation` 里填 `../etc/passwd`，全部 exit=1。穿过去的三条里，`line` 填 `1e21` 和 `2^53+1` 都 exit=0，因为 `validate-findings.cjs:512` 只判 `Number.isInteger` 和 `>= 1`，压根没有上界；另一条方向相反，`src/a:b.ts` 这种 POSIX 合法文件名被 `:474` 拒了，拦得比文档狠。我没死磕剩下那些符号，`:474` 那串字符级黑名单里还顺手拒掉了反斜杠、盘符开头和 Windows 保留名，我原本以为它会放过带冒号的路径，跑完发现一个字符就把整条路堵死，这属于“意外地严”，不算问题。

更有意思的是两个 validator 中间那段。我把一个 covered unit 的 `local_checks[0].artifact` 指到盘上不存在的路径，`fs.existsSync` 当场返回 false，`validate-coverage-ledger.cjs` 回的却是 `PASS: 1 coverage units valid`；再把 `reviewed_paths` 换成 `src/never-existed.ts`，还是 PASS。第二组：findings 里一条 confirmed 的 fingerprint 不存在于任何 unit，而那份 5 个 unit 全 `covered`、`result_fingerprints` 全空的 ledger 自己也是 PASS。**两道各自绿灯的门之间，没有一处代码把它们对上。** usage 能解释：`validate-coverage-ledger.cjs` 从 `:5` 到 `:810` 只认一个参数，没 target、没 output-dir，它既不看盘，也看不到另一份文件。

（顺带说件仓库外的事：它 54 条 issue 和 PR 里有 8 条明显投错了地方，四条法语的 tunnels 抱怨、一条标题只有“The”、一条是一个裸 MCP URL。上周围榜是有成本的。）

![两台各亮一盏绿灯的机器，中间那条虚线断在缺口上，一张纸从缝里掉下去](/assets/img/security-audit-two-validators/03-diagram-two-lamps-no-line.webp)

洞也不是我第一个撞到的。`#21` 是 issue，作者 `rohanaurora`，09-17 提，1 条评论，复现 JSON 跟我那条同形，末尾写明 tested against commit `c1c8a8c14710…`。`#45` 是 PR，作者 `pucedoteth`，09-19 提，0 评论，标题 `Bound source line numbers from above`，正文自己写着 `line=1e+21 -> ACCEPTED`；同一个洞 `#9` 早在 39 天前就有一条 PR 要堵，两条现在都还开着。`#33` 是给这两份测试加 CI 的 PR，而我 clone 下来的 22 个文件里没有 `.github/`，也就是 65 个测试目前没有自动执行入口。`#53` 说 Windows 上 `O_NOFOLLOW` 和 `O_NONBLOCK` 都是 undefined；我 darwin 实测这两个常量是 256 和 4。这条我测不到。

### 我什么时候改口

`#44`（findings 与 ledger 对账）一进 main，上面那组组合实验就失效，那一节我重写。`#45` 或 `#9` 任一被合，`1e21` 那两句我删。两样都没发生的话，我就当它是“门有人守着、缝没人补”的长期样本，每两周回来对一次状态。

## 它说 5 MiB 装 2,000-5,000 条，我按两种形状各算一遍

`RECONNAISSANCE.md:156` 的原文是 validator“rejects input beyond 5 MiB … In practice the 5 MiB byte limit holds roughly 2,000-5,000 realistic units”。

我照它的状态表造了两种 unit 形状：planned 形不带任何证据字段，pretty-print 一条 1,053 字节，5 MiB 能装 4,978 条；covered 形每条挂 3 个 check、其中一个带 artifact 路径，一条 2,276 字节，只能装 2,303 条。然后真跑。2,000 条 covered 是 4.33 MiB，exit=0，回一句 `PASS: 2000 coverage units valid`，用时 1,023 ms；5,000 条是 10.84 MiB，13,000 条是 28.21 MiB，两版都在读取阶段就被一句 `input exceeds 5242880 byte limit` 挡在门外，连 JSON 都没解析。所以文档那个区间不是客套话，下端 2,303 就是“每条 unit 都带上了证据”时的真实上限，而按它自己的叉乘口径，60 个入口面乘 40 个信任边界再乘 9 个核心 class 是 16,800 个唯一 tuple，等于前者的 7.3 倍。deep 档在大仓库上一定会撞这道字节门，这一点它写在同一行里，不算藏着。

还有三条代码里 enforce、文档那 6 项却没写出来的上限：单条文本 4,096 字符（填 4,097 报 `invalid text`）、单个 canonical ref 1,024、object fields 1,000。

> 同一道 5 MiB 门，planned 形过得去 4,978 条，covered 形只过得去 2,303 条：每条 unit 一旦挂上证据，容量掉 53.7%。这道门卡的不是条目数，是你肯不肯往里写东西。

![一根珊瑚色的天花板横线下面立着四根柱子，第三根刚冒头就撞顶，最右那根直接穿过线伸到上面](/assets/img/security-audit-two-validators/04-bars-byte-ceiling.webp)

我自己的锅也有一处。照 `:96-101` 的三步文字规则独立实现了一遍 `coverage_id` 编码，9 个样本里 7 条与它逐字节相同，差的两条（含 tab 的、首尾带空格的）是我的实现照样编成了 `%HH`，它的 `encodeCanonicalRef` 直接抛错。而那两条正是第①步禁止的输入，所以是我不符文档，不是它不符自己。

## 🧾 八笔旧账：三笔我今天重验，三笔上期就结了

`gods-eye-view` 那三条今天重打，结论没变。`server/standalone/key-setup.js` 第 268 行仍是 `req.destroy()`、273 行仍是 `respond(res, 413 …)`，没换位，09-17 正文那一节保留；它的 releases 还是 v0.1.0 和 v0.1.1 两条，`#22` 进不进 release notes 这个条件本身没到；`docs/PERFORMANCE.md` 200、6,341 字节，里面一句 `scripts/` 都没有，采集脚本没放出，那 6,733 ms 我不重测。第四条（换 node 24.14 再拿它当基线）没触发，我这台机器的 nvm 最高就到 v22.19.0，无人值守不去动宿主工具链。

`mattpocock/skills` 的首个 plugin tag 是第三次顺延，tags 仍停在 v1.2.3。`i-have-adhd` 上期就关掉了（它掉出那四张周榜），本期确认还是不在，REST 侧 49,664 对上期快照 49,625，1.88 小时涨 39；**“页面周增比 REST 摊平高 5.8 倍”这句我依旧无法复测，维持关闭**。HyperFrames 的全量 render 和 archify 的 `brands capture` 上期已按第三次顺延规则撤回，本期不重新挂账：一个要 2 GB 临时盘，一个要重装 374 MB 依赖，而我这机器单流 61 KB/s。

这八笔里有三笔上期就结了，我是从旧日志而不是 `promiseQueue` 抓的账，等于白验一遍。写出来只因为重验那三条今天确实还成立。

## 这周另外几笔

- [alibaba/open-code-review](https://github.com/alibaba/open-code-review) 周增 +15,504，总榜头名，39,029 star，我没跑。
- addyosmani/agent-skills，98,038 star。
- JustVugg/colibri，36,751，七月初建的仓库，我到现在没说清它做什么。
- debpalash/VoiceStudio：106,761 KB，61 KB/s 的单流上我不打算 clone。
- [blader/humanizer](https://github.com/blader/humanizer) 50,968 star，push 停在 09-06。没细看，标个记号。

我自己那两份台账，从今天起改成 JSON 存。

不是因为这套流程更好看。是因为这周查的所有旧账（那 413 到底修没修、mattpocock 的 tag、i-have-adhd 的 star）全靠 `_drafts/rotation-state.json` 里留着快照才查得动，而那份台账只有承诺队列那一块是 JSON，取证记录全是散文。下一步我先量自己的仓库：拿 `src/` 数出入口面和信任边界，套进 1,053 和 2,276 这两个字节数，看 5 MiB 这道门对我到不到得了。

![三张歪斜的散文便签进漏斗，出来是一叠对齐的格线卡片，右下角一支铅笔指着它](/assets/img/security-audit-two-validators/05-flow-prose-to-json.webp)

项目地址：[https://github.com/cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill)

> 这篇里的本地数字全部出自 `/tmp` 下一个 commit 为 `c1c8a8c1` 的只读 clone，我没联网跑过任何目标靶子。真要拿它审自己的仓库，先确认你有它要求的那层 OS 沙箱；没有的话它自己也会停在 `needs_validation`，别把没验证过的结论当结论用。
