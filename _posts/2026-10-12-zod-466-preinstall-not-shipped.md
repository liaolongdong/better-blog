---
layout: post
title: 我拆了被传投毒的 zod 4.6.6，包里没找到载荷
subtitle: 10 月 12 日的传闻，指向 9 月 21 日的一枚提交；npm 那份是干净的
seo_short_title: zod 4.6.6 投毒传闻的解包实测
seo_description: HN 上把 zod 4.6.6 传成已投毒版本。preinstall 提交进过 main，但 npm 发布的那份没有载荷：解包、真装、三方校验对齐，那天的发布尝试全没成功。三个点至今没确认。
date: 2026-10-12
categories: 开源实测
cover: /assets/img/zod-466-preinstall-not-shipped/banner.webp
tags: 安全 开源 仓库
tldr: '投毒提交真进过 main，但 npm 上那枚 4.6.6 是干净的：那天五次带发布意图的运行没有一次成功，真装之后 meta* 零命中。换版本解决不了这件事，该看的是 npm 默认跑 preinstall、pnpm 默认拦住并打出包名。'
faq:
  - q: 'zod 4.6.6 的 preinstall 载荷发布到 npm 了吗？'
    a: '没有。提交确实存在、作者字段是 colinhacks，给 package.json 加了 preinstall 指向 node meta.test.mjs，那个文件从以太坊合约读一段 base64、执行完用 rmSync 删掉自己；但 registry 那份解包加真装之后 meta* 零命中，那天五次带发布意图的运行没有一次成功。'
  - q: '用 npm 和用 pnpm 的人分别要做什么？'
    a: 'preinstall 默认会跑，工作目录就在那个依赖里面。用 npm 的人可做的动作是给安装命令加 --ignore-scripts，再单独放行真需要构建脚本的那几个包。pnpm 默认不跑，还会把拦住的包名打出来，我那个只往 /tmp 追加一行的良性夹具实测输出 Ignored build scripts: probe-dep.；这条不用改配置，但要确认 onlyBuiltDependencies 没被人顺手加宽。'
  - q: '那枚带 preinstall 的提交现在还在 main 上吗？'
    a: '不在了，这一条我第一轮读反过。compare/main...d821685e 返回 diverged，我当成提交还在 main 上；换三种取法重跑，结论反过来：那条链被摘掉了，现在 main 上对应的十一枚提交 sha 全不同。清理它的 PR 是 colinhacks/zod#6620，标题 Cleanup bad commits，合并于 2026-09-21 晚。'
---

# 我拆了被传投毒的 zod 4.6.6，包里没找到载荷

![左边深色提交卡有一条实心高亮，右边包盒同一位置是空的](/assets/img/zod-466-preinstall-not-shipped/banner.webp)

> 一句话结论：投毒提交真进过 main，npm 上那份 `4.6.6` 里没有载荷。
> 现在该做什么：先答我今天要不要动我的东西——npm 和 pnpm 的默认值不一样。

## 发生了什么：传闻从 HN 起

传闻 10 月 12 日早上从 HN 起。

[那条帖子](https://news.ycombinator.com/item?id=50052814)标题原文写着 `Zod 4.6.6 compromised by malware?`，164 分、15 条顶层评论。

它指向一枚 2026-09-21 的 commit，作者字段 `colinhacks`，给 `package.json` 加了 `"preinstall": "node meta.test.mjs"`。同提交新增的 `meta.test.mjs` 从以太坊一个合约读出一段 base64，执行完 `rmSync` 删掉自己。

![按 ref 取回的载荷文件全文](/assets/img/zod-466-preinstall-not-shipped/02-screenshot-payload-file.webp)

## 已确认的：registry 那份是干净的

审批门那行被删之后能不能真发出去，是我核的第一件事。

- 提交真存在，作者字段是 `colinhacks`。
- 它当时在 main 上：清理 PR 的 `base.sha` 就是那条链的尾巴。
- 那天五次带发布意图的运行，没有一次成功。
- registry 那份是干净的：真装之后 `meta*` 零命中。

清理那条链的 PR 是 [colinhacks/zod#6620](https://github.com/colinhacks/zod/pull/6620)，标题原文 `Cleanup bad commits`，合并于 2026-09-21 晚。

没确认的第一条最要紧。`4.6.7` 和 `4.6.8` 现在都是 404。但 npm 撤下版本会连 `versions` 与 `time` 一起抹掉，所以查不到证明不了没上线过几分钟。

第二，那五次为什么失败我拿不到日志，未鉴权返回 403，我只读得到 step 级的结论。第三，官方有没有承认账户被妥协：这个仓库的 security advisories 列表是空数组。

## 对谁有什么影响：三类人各有动作

空数组不是给读者的动作，动作在下面三类人身上。

### preinstall 的接收方

`preinstall` 默认会跑。工作目录就在那个依赖里面，用 npm 的人今天可做的动作是把安装命令加上 `--ignore-scripts`，再单独放行真需要构建脚本的那几个包。

### 用 pnpm 的人

pnpm 默认不跑，还会把拦住的包名打出来。这条不用改配置，但要确认 `onlyBuiltDependencies` 没被人顺手加宽。

### 已经在用 zod 的人

换版本解决不了这件事，干净的那份就是被点名的那份。可核对指标是 `gitHead` 和 `_npmUser`，它们告诉你这份字节从哪枚提交、由谁发出。

还有一层影响面我核不动。维护者写在 CI 注释里的说法是 `18 packages published unattended`，我只核到自己能核的那一个包，其余十七个我没有一手来源。

## 我实测到的：先说我读反的那条

`gitHead` 那条我第一轮读反了。

`compare/main...d821685e` 返回 diverged，我当成提交还在 main 上。换三种取法重跑，结论反过来：那条链被摘掉了，现在 main 上对应的十一枚提交 sha 全不同。

然后是量 preinstall 会不会自动跑。我写了个良性夹具，`scripts.preinstall` 只往 `/tmp` 追加一行，不联网。

![npm 跑了脚本、pnpm 拦住并打警告](/assets/img/zod-466-preinstall-not-shipped/01-screenshot-npm-pnpm-preinstall.webp)

```text
Ignored build scripts: probe-dep.
```

我的 npm 走镜像源，所以三份 shasum 对齐这一步不能省。

## 接下来盯什么：我盯两个锚

没跑这两个字，就是我今天不动东西的理由。

`zod` 没进我任何线上项目，锁文件里没有它。我盯两个锚。`colinhacks/zod#6622` 把发布改成 staged：版本号先落到 CI 产物，维护者在 `release-approval` 环境点通过才进 npm。如果哪天它被改回 push 触发，我这篇的前提就没了。

第二个锚是 `4.6.7`。如果 registry 的 `time` 里将来冒出它，撤版那一半就有了答案，而那正是我没验到的部分。

项目地址：[https://github.com/colinhacks/zod](https://github.com/colinhacks/zod)
