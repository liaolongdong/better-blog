---
layout: post
title: 五种伪造 proof 的写法，它自己只拦两种
subtitle: 三条已公开的缺口我都复现了，授权钉在类型上没那么牢
seo_short_title: gdp-ts 伪造 proof 实测
date: 2026-10-07
categories: 开源工具 TypeScript
cover: /assets/img/gdp-ts-proof-forgery-3-gaps/banner.webp
tags: gdp-ts TypeScript 权限校验 Vercel
---

# 五种伪造 proof 的写法，它自己只拦两种

![柜台上五枚动了手脚的凭证，盖章的手只够到两枚](/assets/img/gdp-ts-proof-forgery-3-gaps/banner.webp)

> 一句话结论：proof 这条路确实能把越权写挡在编译期，但五种伪造写法它只拦两种
> 现在该做什么：拿它自带的 strict 档跑一遍你的 proofs 目录，数一下报几条

## 背景：它为什么出现

它把授权做成类型。

`rauchg/gdp-ts` 10 月 4 日建仓，5 日发第一版，我 7 日抓到 730 星。

它说自己是 Ghosts of Departed Proofs 在 TypeScript 上的实现。交付一个库、一个 lint 预设、一条给 agent 读的 skill。要挡的是这两行之间没有连线：上一行 `assertProjectAdmin` 抛了 403，下一行照样收下项目 id。

## 它解决什么痛点

机制是三个符号。

`name()` 给 id 打标签，`defineProof()` 声明一条 proof，函数签名要求 proof 的第二个槽等于那个标签。我在自己的小项目里照它的写法试了 5 个错法，`tsc` 报出 7 条：换项目、传裸 id、少传 proof、没处理 `null`、标签逃逸。

这一层挡住了。

![五道错法全被类型检查报出，五道伪造只被 lint 报出两道](/assets/img/gdp-ts-proof-forgery-3-gaps/01-comparison-five-ways-two-caught.webp)

## 快速上手

两条命令。

`npx skills add rauchg/gdp-ts` 装 skill，`pnpm add @gdp-ts/core` 装库，它要 TypeScript 5.4 以上。

两个坑。第一条不带 `-y` 会挂在选哪个 agent 的提示上，我那次退出码 1。仓库 `packageManager` 要求 pnpm 12.1.0，本机那个 11.x 读它的 lockfile 直接报 BROKEN_LOCKFILE。换版本后 12.7 秒装完。

## 使用示例

真跑起来是对的。

`src/ok.ts` 打印 `u1/p1 -> 204 writes [ 'p1' ]`，`u1/p2 -> 403 writes [ 'p1' ]`。

然后我写 5 种伪造 proof 的写法，全过编译。

```ts
return {} as A<U, P>; // 1 类型断言
return null!; // 2 非空断言
let forged!: UserIsProjectAdmin<never, never>; // 3 定赋值
const Loose = defineProof("Loose"); // 4 在 proofs/ 外造
return { ...a, value: b.value }; // 5 展开换 id
```

它自带的 strict 档只报 2 条：断言那条，和 `defineProof` 越界那条。非空断言、定赋值、展开换 id，一条没提。rauchg/gdp-ts#11 和 rauchg/gdp-ts#13 两条 issue 各自点名。我复现到了同一种。

## 和同类比：强在哪、差在哪

比的是拦在哪一层。

运行时校验（zod、`can()`、自己写的 branded type）在 prod 里挡，编译期没痕迹。

它把同一件事挪进 `tsc`，代价是编译时间。README 说一次授权调用点约 0.3 毫秒，我在这台 Intel 8 核上测出 2.9 毫秒。我读到的类型数和它的表格逐字相同，差的只有 CPU。

![两道闸门各管一种人：类型检查拦下五道错法，lint 只拦下五道伪造里的两道](/assets/img/gdp-ts-proof-forgery-3-gaps/02-flow-two-layers.webp)

强的一头：`ebd0af9` 上 91 个测试全绿，CI 在 5 个 TypeScript 版本上跑兼容检查。差的一头：它自己的 `limits.md` 就写着断言能过，伪造靠 lint 兜，而这一层有三种漏网。

## 未来展望：什么条件下我会用它

我只在它补齐伪造面之后用。

如果 rauchg/gdp-ts#19 和 rauchg/gdp-ts#20 在 10 月底前合进去，我在侧项目里当真用它。不合，我只把这三种写法写进 review 清单，不引库。第二件事是 0.1.0 之后有没有第二版。

项目地址：[https://github.com/rauchg/gdp-ts](https://github.com/rauchg/gdp-ts)
它 10 月 5 日发版，同一天就有人提这三条缺口。
