---
layout: post
title: 官方说会加一枚脚注，我手里那两段正文一字没动
subtitle: 那篇讲 Scion 的文章 10 月 15 日改过，我抠到改前文本，逐字对了一遍
seo_short_title: 那页 10 月 15 日只改了脚注
seo_description: Anthropic 的 Scion 文章自记修改时间是 10-15 18:21:28，而我有博主截图 alt 里的改前正文。两段共 1157 个字符未动，变的是脚注、页首更新说明和一个空格。
date: 2026-10-17
categories: 开源实测
cover: /assets/img/anthropic-scion-attribution-diff/banner.webp
tags: Anthropic Claude AI编程 开源
---

# 官方说会加一枚脚注，我手里那两段正文一字没动

![左边一段文字两边各标 1157，中间等号；右边一条脚注从无到有长出来说明](/assets/img/anthropic-scion-attribution-diff/banner.webp)

> 一句话结论：那页 10 月 15 日确实改过，可我手里有改前文本的那两段正文一字未动，变的是脚注。
> 现在该做什么：先去看你那页有没有一枚可核对的修改时间，再决定要不要信「已经澄清了」这四个字。

## 那页自己记了一枚时间：10 月 15 日 18:21

我把 https://www.anthropic.com/engineering/redesigning-source-control 抓回来，HTTP 200，165292 字节。这一串读数不用我强调怎么来的：curl 存盘，我后面每一步都对着这份文件。

页面头部有两枚 meta。`published_time` 是 2026-10-13，`modified_time` 是 2026-10-15 18:21:28.000Z。同值在 JSON-LD 的 `dateModified` 里又写了一遍，所以不是某处漏改。

页首还多出一行，逐字是：

> Updated October 15 to include more detail on the projects that pioneered many of the techniques we use in Scion.

我的翻译：10 月 15 日更新，补进了「那些最先用出我们在 Scion 里这套技法的工程」。

正文第一段的自陈没变：`we built Scion, an in-house version control system`。这行现在还在，它是本节后面所有判断的地基——他们自己写的是「内部系统」。

## 我手里那两段改前文本，1157 个字符一字未动

`modified_time` 只告诉我几点改的，不告诉我改了哪个字。我手上刚好有两段改前正文，够我把这句话逼到一个字节上。

对法是把两段各自截出来喂 `difflib`。原始输出，没删：

```bash
$ python3 cmp.py before.txt live.txt
before_len 1157 after_len 1157
before_words 195 after_words 195
IDENTICAL True
ratio 1.0
$ python3 cmp2.py            # 另一段，讲 changeset 的那段
before_len 440 after_len 441
ratio 0.9989
insert '' -> ' '
```

第一段是那篇里定义 derived data 的整段：1157 个非空白字符、195 个词，改前改后逐字相等。第二段讲 changeset，440 个字符变成 441 个，opcodes 里只有一个 `insert`，插进去的那个字符是空格。

那个空格落在哪我核了：改前是 `relative to its first parent,1 along with`，改后是 `relative to its first parent, 1 along with`。那个 1 是脚注 1 的上标，逗号与上标之间多了个空格。

所以「10 月 15 日那次更新动了什么」这个问题，在我有原文的两段里答案是：正文没动，动的是脚注那一层和一个排版空格。

## 改前文本是从一张截图的 alt 里抠出来的

那两段 1157 字的改前正文，来源不是那页的旧版本，是别人贴出来的截图。

我先试的是快照。web.archive.org 的 CDX 接口与页面、archive.org 的 wayback/available、ghostarchive 那枚短链、timetravel.mementoweb.org，四个口径这一轮全部超时或解析失败——改前整页我没拿到，这条登记在账上。

能拿到的入口在 https://sunshowers.io/posts/anthropic-mononoke/ 那篇里：他把 Anthropic 的页面截成图，而每张 `<img>` 都写了完整中文式长 alt。我从 alt 属性里反转义出正文，逐字符数出 1157。这是本篇最不舒服的一步：改前文本靠的是第三方截图的替代文字，不是我自己的存档。

那位博主是 Meta 源码控制团队的前成员，他 10 月 14 日那篇里写着 `Mononoke was not mentioned at all`。这句在下面第五节会被我用一个可数的东西对上。

## 「会再加一枚脚注」写在页面时间之前 22 分钟

alt 里的改前正文只给我静态对照，时间这一头得看作者本人怎么说的。他在 Hacker News 上有一条书面回复，编号 50107559，作者是这篇文章署名那位（id `nickg-anthropic`），时间 2026-10-15 17:59，UTC。三句逐字：

> We credited Sapling because that's how Meta itself externally refers to the entire system, including the Mononoke server, and we wanted to follow that convention. We will add an additional footnote to clarify this. [edit: this is done]
> We were inspired by many things while building Scion, such as the great ideas in Mononoke's Bonsai data model, and didn't intend to obfuscate that in any way.
> We were also inspired heavily by https://martin.kleppmann.com/2015/03/04/turning-the-database-inside-out.html , for example, which also describes the "derived data" concept using the same words.

我的翻译：他们按 Meta 对外称呼整套系统的习惯只写了 Sapling；会再加一枚脚注澄清，并且这条评论已标注「做完了」；Mononoke 的 Bonsai 数据模型启发了他们；Kleppmann 那篇也「用同样的词」写了 derived data。

把三枚时间摆一排：他说「会再加一枚脚注」是 17:59:02，页面那枚 `modified_time` 是 18:21:28，中间 22 分 26 秒；提出这件事的那位博主在 19:20 回了一句接受。

> With the new footnote [1], I now believe the attribution is sufficient. I've added a link to it, as well as to your response, as an update to my blog post.
> The problem is attribution, not copying.

后一句是他 10 月 15 日那篇的口径：问题在归属，不在抄。他给那句接受的话单独配了一条链，指向 `#footnote-2`。

## Mononoke 那个词全篇只出现在脚注里

`#footnote-2` 那条我在现页逐字抄了：`Specifically, the server component of Sapling, Mononoke` 是它的前半，后半写着 `It pioneered many of the techniques we use in Scion, in particular the` Bonsai 数据模型。

去标签之后我把几个词各数了一遍：

```bash
$ python3 count.py live.txt
Mononoke 1
Bonsai 1
Sapling 2
Scion 43
derived data 5
kleppmann 0
```

`Mononoke` 全篇 1 次，`Bonsai` 1 次，两处都在脚注正文里；上标锚挂在正文那句 `Meta's Sapling,` 后面。第三节引的那句「Mononoke 一次都没出现」，现在变成「出现了 1 次，且在脚注里」。这是这轮更新带来的实际变化，我给它一个可数的口径。

脚注里那两条链接的形状不一样，值得单说。一条钉在 `https://github.com/facebook/sapling/blob/main/eden/mononoke/README.md`（main 分支，内容会随提交漂）；另一条钉在 [bonsai.thrift#L50](https://github.com/facebook/sapling/blob/79071c2a3ea20c36ed71332608535e5801101bba/eden/mononoke/mononoke_types/serialization/bonsai.thrift#L50)，我把那个 ref 拉下来数过：314 行，第 50 行逐字是 `struct BonsaiChangeset {`。同一个脚注，一条会漂一条不会。

反常识的那条在这里。他们那句逐字是「Kleppmann 那篇用同样的词写了 derived data」，我把那页抓回来数了：200，64751 字节，`derived data` 全文出现 1 次，在收尾 recap 那段（那句里它同时概括 replication、二级索引、缓存、物化视图四件事的共同点）。而 Anthropic 那页里 `kleppmann` 出现 0 次，正文与脚注都没有任何一条指向它。我这条判断是：他们引用的那处「同样的词」，在引的那一页里只出现一次，在说这话的这页里一次也没有。

什么会让我这条塌：如果我再数出那篇的第二处 `derived data`，或者页面把 Kleppmann 补成第三枚脚注，我这条就作废重写。

## 现在该做什么：先去看你那页有没有 modified_time

`Mononoke` 从 0 次变 1 次这件事，对不写技术博客的人没意义。下面三条分开说。

### 自己发出站文章的人

去看你页面头部那两枚时间。如果你的构建产物里没有 `modified_time`，读者就只能信你贴在他博客上的那句「已更新」；有了它，才至少存在一个可核对的时刻。本站的 `time` 与 `dateModified` 是 Jekyll 按 frontmatter 出的，我确认过自己那页有。

### 拿二手结论做决策的人

一句 `[edit: this is done]` 不等于内容变了多少。这次两处对得上的证据只有：页首多一行更新说明、脚注多一条、正文多一个空格。别人说「补了归属」，你可以问一句补在哪一层——正文、脚注，还是评论里。

### 引用别人文档的人

这次最实用的一条是脚注里的链接形状。要么钉到 40 位 SHA，要么准备接受它漂。我这一轮能被那段 1157 字卡住，一半原因就是旧版本快照拿不到，而别人给的引法没钉版本。

## Scion 到底有没有开源，我这轮没验到

Scion 有没有公开仓库，是这轮所有争论里最容易被顺嘴带过的一条，我去核了。

https://github.com/tinyhumansai/openscion 是真的存在：owner 是一枚 Organization，84 star、10 fork、GPL-3.0，仓库描述写着它的参照物是那篇文章。而 `anthropics` 那个组织按更新时间取回的 100 枚仓库里没有名为 scion 的一枚，最接近的那枚叫 scone-bench，不是同一个东西。

所以「Scion 开源了」这句话，公开面上我只能核到：第三方起了一个同名仓库，作者那边写的是 in-house。至于双方吵的那一层——数据模型与代码的重合度——Scion 不在我能读到的地方，Mononoke 我只能读到 thrift 定义，两边没有同一层可比对的东西。这一半我没验到，只能停在「公开面上不可证伪」。

两个锚，都是我下次会回去 grep 的。如果 `anthropics` 组织里出现一枚真叫 Scion 的仓库，上面那段「不可证伪」立刻作废，重合度就变成可比对的东西；如果那页再被改一次、多出第三枚脚注或一条指向那篇 2015 年文章的链接，我引的那句「用同样的词」就得多算一次。至于 `main` 那条 README 链接会不会漂——`https://github.com/facebook/sapling/blob/main/eden/mononoke/README.md` 今天 200，我拿不到它明天还是 200 的承诺。

我今天不动自己的东西：这轮唯一被我改到的文件是这篇稿子本身。

项目地址：[https://github.com/facebook/sapling](https://github.com/facebook/sapling)
