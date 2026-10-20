---
layout: post
title: NIST 曲线的种子是 lrand48 摇出来的，我本机复算了 14 条全对
subtitle: 官方给了三行伪代码，我用 Node BigInt 独立实现，665 毫秒跑完
seo_short_title: NIST 曲线种子复现：lrand48 与 Unix 时间戳
seo_description: Anthropic 公布 NIST 曲线种子来自 srand48 与 Unix 时间戳。我用 Node BigInt 独立复算 14 条全对，665 毫秒，并与本机 LibreSSL 逐字节对账；官方写明无需行动。
date: 2026-10-17
categories: [AI, 开源实测]
cover: /assets/img/nist-curve-seed-lrand48/banner.webp
tags: Anthropic Claude 安全 加密 开源
tldr: '三行伪代码我就能在 Node 里重摇出 14 条 NIST 曲线的种子，665 毫秒，和本机 LibreSSL 3.3.6 印出的常量逐字节对上；可它只回答这些字节从哪来——同一次摇奖里 P-256 的候选 876 也是一条合格曲线，为什么停在 1842 号没人知道。'
faq:
  - q: 'NIST 曲线的种子到底是怎么生成的？'
    a: '不是任何哈希算法，是 C 标准库的 lrand48，用当时的 Unix 时间戳做种子。初值 (t << 16) | 0x330E，每步 x = (0x5DEECE66D * x + 0xB) mod 2^48，每步取 x >> 40 的 8 位。P-256 是时间戳 871696354 即 1997-08-16 01:52:34 UTC 的第 1842 个候选；二进制域那四条要先整除 2，每候选 5 个 32 位字的 x >> 17。'
  - q: '这些曲线是不是要换掉？'
    a: '官方原话是没有需要采取的行动，也写明这不是密码学破口、反而让人更相信曲线没有后门。前端不用动代码：crypto.subtle 里的 P-256 参数是编译进浏览器和 Node 的常量，seed 只在显式导出参数时才露出来。真该动手的是另一件事——lrand48 的状态只有 48 位而且能倒着走，去查自己项目里有没有拿 rand() 或 srand48(time(NULL)) 生成 token、盐和邀请码。'
  - q: '种子被算出来能当曲线清白的收据吗？'
    a: '那是两个问题。Open questions 留着：P-256 公布的是候选 1,842，可同一次摇奖里候选 876 也给出一条大小合适、参数取法与公布曲线相同的素数阶曲线；P-224 那次跳过了三条，ANSI X9.62 那两次跳过七条，原文写它们不知道用过什么判据。前者我 665 毫秒就验了，后者还是空的。'
---

![封面：左边一排十六进制字节被右边一枚时钟的指针串起来，中间一条断开的连线](/assets/img/nist-curve-seed-lrand48/banner.webp)

今晚扫 HN，一条 938 分的帖子挂在上面：Claude reveals ECDSA curve origins，340 条评论。

点进去之前我以为又是一篇模型能力宣传。读到第三屏发现不对，它把复现代码整段贴出来了，后面还跟着一张 14 行的输出表。

那种表我一般直接跳过。这次没跳，因为它给的不是结论，是配方。

配方只有三行：把状态初始化成 `(t << 16) | 0x330E`，每步 `x = (0x5DEECE66D * x + 0xB) mod 2^48`，每步取 `x >> 40` 的那 8 位。`t` 是一个 Unix 时间戳。

我照它写了一遍 Node，没复制它的 Python。665 毫秒，14 条种子全对。

这 14 串字节是 NIST P-192 到 P-521、加上 ANSI X9.62 那几条示例曲线的「seed」。它们从 1997 年起就印在标准文档里，来历一直没人说清。

现在有人说清了：一个 C 标准库的随机数生成器，用当时的时钟当种子。

## 从 1997 年的时钟到 36,864 美元的赏金

Anthropic 那篇发布在 2026-10-16 17:02 UTC。事情本身跨了二十九年。

![官方研究页顶部，标题下一行写着「It's just timestamps」，日期是 Oct 16, 2026](/assets/img/nist-curve-seed-lrand48/01-screenshot-anthropic-seed-line.webp)

| 时间 | 谁 | 发生了什么 |
|---|---|---|
| 1997-05 → 1998-04 | 未知 | 十枚素域曲线的 srand48 初值都落在这段区间的 Unix 时间戳上 |
| 2000 | NIST | ECDSA 进 FIPS 186-2，seed 作为参数一起发布 |
| 2015 | Jerry Solinas | 回忆说种子可能是「Give Bob and Jerry a raise」这类口令的哈希 |
| 2023 | — | Solinas 去世，写那段代码的 Bob Reiter 也记不清细节 |
| 2026-10 | 一名 Anthropic 员工 | 不给那条口令线索，直接问内部研究模型 |
| 2026-10-16 17:02 UTC | Anthropic | 公布结果，附完整复现代码与输出表 |

表里 2015 那行只是转述，原文自己后面补了一句 `That turned out to be wrong.`——口令哈希这条线从头就是错的。

真正花掉的时间是「不到半小时」。原文逐字：`In under half an hour, Claude discovered the origins of the NIST P-192, P-224, P-256, P-384, and P-521 seeds.`

赏金 36,864 美元，捐给 Internet Security Research Group。

![时间线示意：一枚时钟摇出的字节流，穿过 1997、2000、2015、2023 四个节点，最后落到 2026 的一台笔记本上](/assets/img/nist-curve-seed-lrand48/03-timeline-seed-hunt.webp)

二十九年里缺的不是算力。缺的是有人愿意把每个时间戳都摇一遍，还得知道该拿哪几位去比。原文说 Claude 一开始并不知道种子会露出内部状态的哪几位，于是把求解器在每个窗口上都跑了一遍，最后十条素域曲线露出的都是同一个形状：`lrand48() >> 23`。

## 为什么这串字节被怀疑了这么多年

seed 本身不是密钥。标准里它的用途是：把 seed 哈希一下，用哈希值定出曲线方程里的系数 b。

问题在来历。原文写得很直白：`they were provided by the NSA with no explanation or justification.`

于是有了 Neal Koblitz 和 Alfred Menezes 那篇《A Riddle Wrapped in an Enigma》，有了民间调查，也有了悬赏。

流传最广的版本来自 Jerry Solinas，2015 年：

> I believe there was a counter rather than multiple hashing, but I don't know details. The message was along the lines of 'Give Bob and Jerry a raise' or 'Bob and Jerry rule' or something like that. It was Bob Reiter who actually wrote the code, and he doesn't remember the details either. Nor were we able to find archives from so long ago. If they exist, they are no doubt sitting on a hard drive near the Ark of the Covenant.

「约柜旁边的一块硬盘上」。这句我读了三遍。

Solinas 2023 年去世，线索就断在那儿。Anthropic 说自己有好几个员工照着「幽默口令的哈希」这条线追过，追错了。

结果不是任何哈希算法。原文：`None of them were the results of any hash algorithm at all, but rather the output of the C library's lrand48 random-number generator, seeded with a Unix timestamp!`

页面标题下面那句话说得更干脆：`"It's just timestamps"`。

## 我自己写了一遍：伪代码、Node 版、以及 LibreSSL 的对账

它给的判据很硬：每条种子 160 位，逐字对上才算。这种判据我最喜欢，因为不用相信任何人。

```javascript
const M48 = (1n << 48n) - 1n;
const step = (x) => ((0x5DEECE66Dn * x + 0xBn) & M48);

function candidate(t, n, per, shift, width) {
  let x = ((BigInt(t) << 16n) | 0x330En) & M48;   // srand48(t) 设置的初始状态
  let out = "";
  for (let i = 0; i < per * n; i++) {
    x = step(x);
    if (i >= per * (n - 1)) out += (x >> BigInt(shift)).toString(16).toUpperCase().padStart(width, "0");
  }
  return out;
}

// P-256：时间戳 871696354（1997-08-16 01:52:34 UTC），第 1842 个候选
candidate(871696354, 1842, 20, 40, 2);
// => C49D360886E704936A6678E1139D26B7819F7E90
```

二进制域那四条口径不同：时间戳要先整除 2，每候选 5 个 32 位字（`x >> 17`）。原文在这里自己加了一句保留，`if that reading is right`——它也不确定这个读法。

跑出来之后我没直接信自己，又拿本机的密码学库对了一遍：

```bash
openssl version
openssl ecparam -name prime256v1 -param_enc explicit -text -noout
```

![终端截图：LibreSSL 3.3.6 印出 P-256 的 Seed 字节，下面 node 脚本打出 14 行 PASS 与合计 665 毫秒](/assets/img/nist-curve-seed-lrand48/02-screenshot-terminal-recompute.webp)

三方对账，挑三条列出来：

| 曲线 | 我的 Node 输出 | 本机 LibreSSL 3.3.6 印出的 Seed |
|---|---|---|
| P-256 | C49D3608…819F7E90 | c4:9d:36:08:…:7e:90 |
| P-384 | A335926A…7ACDAC73 | a3:35:92:6a:…:ac:73 |
| B-571 | 2AA058F7…7F132310 | 2a:a0:58:f7:…:23:10 |

14 条全对。官方表、我的实现、本机库里编译进去的常量，三个来源没有一个字节打架。

我本来还想再补一条佐证。原文说有一枚种子没复现出来：`The fifth binary seed, B-163, fits nothing Claude has tried and remains unexplained.`

B-163 在我这台机器上叫 sect163r2。我把它也跑了一遍 openssl，结果它连 Seed 字段都没印出来，其余 14 条都印了。

看着像佐证。其实不是。

它说的是推不出生成器，我看到的是本机参数表里没这一项，两件事不是一回事。我试图把它们对上，没对上，就不硬凑了。

另外两处我也没验：基点那段（原文说六条 1997 年 5 月的曲线基点来自 Arjen Lenstra 的 FreeLIP，配方是「丢掉前七个输出，再用 26 位输出模 p」）我没有复算，要跑得先找到 FreeLIP 那段实现；候选 876 我也没验，验它要写曲线构造和素数阶判定。今晚的时间不够。

## 谁需要动，谁不用动

原文自己先给了一句很反常的话：

> Readers should take this as a fun closing chapter and the end of years of speculation. There is no action to be taken or things to do differently. Most researchers trusted the curves already. Enjoy.

以及：`This is not a cryptographic break, new attack, or weakness in the ECDSA curves. In fact, this makes us more confident the curves were chosen without any backdoors or intentional weaknesses.`

我同意这两句。但「不用动」和「跟你没关系」不是一回事。

| 你是谁 | 会变什么 | 现在做什么 |
|---|---|---|
| 前端 | `crypto.subtle` 里的 P-256 参数是编译进浏览器和 Node 的常量，seed 只在显式导出参数时才露出来 | 代码不用动，把「种子来历不明」从选型理由里划掉 |
| AI 应用开发者 | 可迁移的是任务形状：判据明确、空间可枚举、能自己验成败 | 手上那些「没法自动判对错」的活儿，先给它造一个判据 |
| 独立开发者 | lrand48 的状态只有 48 位，而且能倒着走 | 查一遍自己项目里有没有拿 `rand()` 或 `srand48(time(NULL))` 生成 token、盐、邀请码 |
| 团队 | 合规文档里「NIST 曲线种子来历不明，故选 X」这条依据失效 | 重写依据，但别顺手换曲线，这篇不构成换曲线的理由 |

四行里只有第三行是真需要动手的，而它跟 Anthropic 一点关系都没有。

说白了，这次真正该被记住的提醒不在密码学里，在你自己项目那个 `srand48(time(NULL))` 里。原文还写了一句让人不太舒服的话：这个线性同余生成器 `runs backwards as easily as forwards`，Claude 就是把状态一步步往回退，退到低 16 位等于 `0x330E` 的那个形状。这种形状每 65,536 步就会出现一次，所以光退到它不算证据——真正的证据是十条曲线退出来的初值全都是有意义的日期。

## 我的判断：算出种子不等于曲线安全

HN 上那 938 分里，高票评论是这两条：

> @sweis: 13 years of tinfoil hats for srand48(time(NULL)

> @tptacek: This is devastating news... for an entire generation of NIST cryptography conspiracy theories.

读起来像给一件事画了句号。我不这么看。

原文自己留了一个更硬的口子，藏在 Open questions 那节：

> For P-256, the published seed is candidate 1,842, but candidate 876 of the same run also gives a prime-order curve of the right size and with parameters chosen the same way as on the published curve.

同一次摇奖里，第 876 号也是一条合格的曲线。P-224 那次跳过了三条，ANSI X9.62 那两次跳过了七条。原文接着写：`We do not know what criteria may have been used, or whether this was an unintentional artifact.`

它也给了自己的判断：跳过的数量太少，所以 `we do not believe it is plausible that weakened curves were selected`。但同一页还留着半句：`It is still conceivable that these curves were selected to have a specific property in principle by searching over timestamps to the random number generator. However, you would only need to do that if you were going to disclose the timestamp as some evidence that the seed was innocuously generated. Nothing in the numbers shows how many runs there were.`

**种子被算出来，回答的是「这些字节从哪来」；没回答的是「为什么停在这一号」。**

前者现在有了机器可验的答案，我今晚就验了。后者还是空的。拿前者当「曲线彻底清白」的收据，是把两个问题混成了一个。

还有一层跟密码学无关。HN 上 @slowin 那条只有几十分，但我觉得它比高票评论更值得留着：`Anthropic (and whoever Anthropic wants) can do this kind of work with Claude, but if you or I try to do it, we will get blocked.` 这轮我复算的是它已经公开答案的部分，所以很顺；真正那半小时的搜索，我用不上同样的模型。

什么证据会让我改口：如果有人把候选 876 和 1842 那两条曲线放一起做性质对比，发现被选中的那条并不特殊，那我这条「没回答为什么停在这一号」就只是修辞，不是缺口。

## 另外三条值得看一眼

**Home Assistant 的密码泄露检查被质疑「我没授权」。** 一手是 [home-assistant/home-assistant.io#49314](https://github.com/home-assistant/home-assistant.io/issues/49314)，`Viss` 在 2026-10-16T18:56:24Z 开的，版本 2026.10.1，指向 [pwned-passwords 说明页](https://www.home-assistant.io/more-info/pwned-passwords/)。原话是 `This is a pretty severe invasion of privacy.` 和 `I never authorized any integrations or plugins for scanning secrets and sending them up the line, even if they are hashed or not.`，问的是 `how do i turn this thing off?`。issue 已经 closed，标签是 `more-info`，最后一条评论写着 `As it turns out, this check can already be turned off after all:`。所以呢：争的是默认开还是默认关，不是能不能关；两边原话都在同一个帖子里，自己读比看转述准。

**OpenAI 10 月 15 日那次 major 事故，影响登录与注册 2 小时 27 分。** 一手是 [status.openai.com 的 incidents JSON](https://status.openai.com/api/v2/incidents.json)，条目叫 `Widespread feature degradation`，created `2026-10-15T16:29:26Z`，resolved `2026-10-15T18:56:00Z`。四条更新里唯一一句技术描述是 17:13:05 的 `We have applied the mitigation and are monitoring the recovery.`，没有根因。所以呢：那段时间 ChatGPT 移动端登录失败的人，可以先排除自己的代码；同时也别指望状态页会告诉你为什么。

**JPEG XL 全浏览器落地之后，Jake Archibald 的实测结论是「网页照片还是 AVIF 小」。** 一手是 [jakearchibald.com/2026/jpeg-xl-vs-avif](https://jakearchibald.com/2026/jpeg-xl-vs-avif/)，2026-10-16 发的。逐字：`JPEG XL has now landed in all major browsers`、`For lossy photos on the web, AVIF almost always produces smaller files than JPEG XL.`、默认 effort 下最好的 JPEG XL 通常比同画质 AVIF 大 `15–25%`，拉满 effort 差距收窄到 `6–20%`；截图和插画类差得更多，JPEG XL 大 `30–90%`。所以呢：本站 10-10 那篇写过 Chrome 155 的 JPEG XL 解码，09-10 那篇写过 Next.js 的 AVIF 坑。「浏览器支持了」和「该换了」是两件事，按这组数字，照片类还是 AVIF。

---

今晚让我记住的不是「模型半小时解决了二十九年悬案」，是那 665 毫秒：一段别人给的配方，我能在自己机器上重新摇出同样的 20 个字节。能被复算的结论才值得写进文章，剩下的都只能算听说。

参考链接：[Claude reveals ECDSA curve origins](https://www.anthropic.com/research/ecdsa-curve-origins)（2026-10-16）· [HN 讨论 50122800](https://news.ycombinator.com/item?id=50122800)（938 分 / 340 评论，读取于 2026-10-17 22:24 CST）
