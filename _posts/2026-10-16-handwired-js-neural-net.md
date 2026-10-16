---
layout: post
title: 别照 README 那两行抄：声明了整数格，它在缝里就给你插值
subtitle: handwired 把比较压成两个 ReLU，它 exact 的域和梯度非零的域刚好互补
seo_short_title: handwired 整数格与梯度实测
seo_description: 把 chenglou/handwired 的 emitCompare 摆到 301 个整数点和 4 到 5 之间 101 个点上逐一对账：整数点 0 处不符但梯度非零数为 0，缝里 99 个点和 JavaScript 不等，首个不符在 4.01。
date: 2026-10-16
categories: [TypeScript, 开源实测]
cover: /assets/img/handwired-js-neural-net/banner.webp
tags: 开源项目 JavaScript 算法 性能优化 黑科技
---

# 别照 README 那两行抄：声明了整数格，它在缝里就给你插值

![数轴上一段被放大的空心圈：格点上全对，缝里 99 个点不符](/assets/img/handwired-js-neural-net/banner.webp)

> 一句话结论：handwired 保证 exact 的那个域和它梯度非零的那个域刚好互补，缝里给的是插值
> 现在该做什么：给线声明格之后单独调一次 validateGrids，别只跑求值

## 三条通道全红，tarball 解出 4,966,704 字节

抓下来时它开仓一天多，1431 星。README 写着这是个把神经网络前向跑成 ReLU 加仿射矩阵的 TypeScript 库，连一次比较都要塞进电路里，入口叫 `emitCompare`。

它给的安装指令只有一行 `git clone && bun install`。我走三条通道全红：直连报 `HTTP/2 stream 1 was not closed cleanly`，退到 HTTP/1.1 报 `Empty reply from server`，挂上本机代理端口报 `Connection refused`。

最后从 codeload 拉 tar.gz，解出 4,966,704 字节，对应 commit `4ea7fcb`。本机没有 bun，`npm i bun@latest` 装到 `1.4.3` 才跑得动它 12 条 scripts。

## 301 个整数点 0 处不符，梯度非零的也是 0 个

先拿 `emitCompare` 编译出来的电路和 JavaScript 的 `>` 逐点对。我建一条声明了 1 格的线（`assumeGrid(w, 1)`），阈值取常量 4，输出写成 `out = 12 - 2 * bit`，然后从 -100 到 200 每个整数喂一遍。

![终端实测：两条路径的 op 与层数、逐点相符数、梯度非零计数](/assets/img/handwired-js-neural-net/01-screenshot-grid-vs-cascade.webp)

```
B grid+integers    {"tested":301,"bad":0,"firstBad":null}
B grid+halves      {"tested":101,"bad":99,"firstBad":4.01}
D integers -50..50 (n=101) nonzero gA=0 nonzero gT=0
```

301 个点，0 处不符。

同一批点再跑一次 `backpropagateReference`，输出对输入那条线的梯度、对阈值那条线的梯度，非零的个数都是 0。

缝在别处。把输入从整数换成 4 到 5 之间按 0.01 步长取的 101 个点，第一个不符落在 `4.01`，一共 99 个点和 JavaScript 不等。**它 exact 的那个域和它梯度非零的那个域刚好互补**：格点上值对、梯度死；缝里梯度活了，值开始撒谎。

## 4.5 那一步它给 11，也不报错

缝里 4.01 往后的读数是一条斜坡。同一张电路，输入从 4 走到 5，它交出来的是 `12 / 11.5 / 11 / 10.5 / 10.02 / 10`，JavaScript 那边一步跳完，之后全程 10。它没在缝里报错，也没把值吸回格点，它插值。

![终端实测：声明格的线喂进 4.5，validateGrids 抛错而求值不抛](/assets/img/handwired-js-neural-net/02-screenshot-seam-values.webp)

我原本以为 `validateGrids` 挂在求值路径上。声明了 1 格的线喂进 4.5，总该被拦一下。实际是 `evaluateReference` 和 `createTensorEvaluator` 都不抛，把 11 交出来；`validateGrids` 是个得自己调的导出函数，调了才抛 `wire 0 must be a multiple of 1, got 4.5`。

所以 `emitCompare` 上面那段契约没被我推翻，它写的是对**声明范围内**的每一对值都等，4.5 不在我声明的格里。这枚红在我这边：我把声明当成了强制。

## #1 报的零梯度，原因不在 emitCompare

现象我复现了。原因不是那个。

chenglou/handwired#1 的正文逐字写着 `backpropagateReference gives a threshold held in a constant cell zero gradient through an emitCompare decision, so a learned breakpoint never moves.`（[issue 原文](https://github.com/chenglou/handwired/issues/1)，10-15 开，抓于 10-16 15:34 UTC）。它把零梯度记在比较决策头上，我数出来的不是这条。

那个常量格在电路里没有任何引用者。`c.constant(4)` 走的是 `affine([], 4)`，`foldConstantTerms` 把值并进下游仿射的 bias，`leftTerms` 里已经没有这条线，反传拿不到它，跟比较决策无关。旁证在我手推的那两行代数上：对阈值做中心差分，a=4.5 拿到 +2，a=8 拿到 -2，不是 0；把阈值从常量格换成第二条 source 线，缝里 a=4.5 的 `gT` 实测就是 2。

要让这条判断塌，只要有人指出 `emitCompare` 内部给常量格留了一个可反传的项，或者我数 `leftTerms` 时走的是另一条分支。这两件我都没去查。

## 没验到的两半：GPU 与那 0.14 毫秒

`foldConstantTerms` 我只在比较电路里验过。同一份落盘副本，我还跑了它检索那一半。README 写着 CPU 后端 `0.14 ms per document of 300 code points at 8 states`，我用 `createCpuSearcher` 对同一模式连搜 4 次，一万六千篇文档时四次是 `0.5568 / 0.5538 / 1.1186 / 0.5856` 毫秒每篇，稳在它那个数的 4 倍上下。它自己也写了这后端只喂几百篇，我拿一万六去量是超出它建议的用法；这台机器当时 load average 11，这组数只会偏慢不会偏快。

那枚 5000 毫秒的超时我没能复现，四次里三次全绿。GPU 那半边我没有 WebGPU 会话，十万篇文档的毫秒数属没验到。

如果 chenglou/handwired#1 在 0.x 阶段有人接阈值该放常量格还是放线这个话头，我就回去把格点上 `gT` 是否恒 0 写成一条测试提给它；没人接，这篇就是我一个人对着这份 tarball 说的话。

项目地址：[https://github.com/chenglou/handwired](https://github.com/chenglou/handwired)
