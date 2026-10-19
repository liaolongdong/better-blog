---
layout: post
title: README 说把 JS 变神经网络，docs 说没有转换器
subtitle: handwired 实测：没有源码转换器，且 exact 和梯度非零活的输入域刚好互补
seo_short_title: handwired 转换器与梯度实测
seo_description: 把 chenglou/handwired 的 emitCompare 测了 301 个整数点和 4–5 的 101 个点：整数点 0 处不符、梯度非零 0 个，缝里 99 个点与 JavaScript 不等；它也没有源码转换器。
date: 2026-10-16
categories: [TypeScript, 开源实测]
cover: /assets/img/handwired-js-neural-net/banner.webp
tags: 开源项目 JavaScript 算法 性能优化 黑科技
---

# README 说把 JS 变神经网络，docs 说没有转换器

![左半：JS 文件指向电路的箭头被划掉；右半：数轴上两段不重叠的带](/assets/img/handwired-js-neural-net/banner.webp)

> 一句话结论：handwired 没有源码转换器，电路得你手写；它宣传的 exact 和可微活在两个不重叠的输入域上
> 现在该做什么：先读 docs 那份目录再决定装不装。别把 README 第一句当能力清单。

## README 第一句我读错了：它转的是 builder code

抓下来时它开仓一天多，1431 星。作者 GitHub ID 是 chenglou，bio 逐字写着 `ReactJS, ReasonML, ReScript, Messenger, Midjourney`，README 第一句是这句：`Turn your regular JavaScript code into a neural net; no training, exact, yet also fully differentiable!`

我把它读成了「我现有的 JS 丢进去就能变成神经网络」。docs 第三行逐字写着另一句：`No tool converts existing JavaScript source into a program.` 它要的是 builder code，一段只跑一次的普通 JS，把运算一条条追加进一个 `Circuit`。这枚误读在我这边。

那它到底能干什么？docs 逐字列了三个 demo。HandwiredOS 是一个小桌面，三个窗口加一条 dock，由一个程序跑。learned gallery 是照片排版，排版系数用程序自己的梯度训练。json search 每次按键搜十万篇 JSON，两个程序写成 WebGPU 着色器。

我 clone 三条通道全红（HTTP/2、Empty reply、本机代理 refused），最后从 codeload 拉 tar.gz 才拿到落盘副本，对应 commit `4ea7fcb`。上面这些逐字句都出自那份副本，不是官网截图。

## 两行代码变电路：401 个整数点我逐点对过

README 的例子只有两行。`(a > 4) ? 10 : 12` 写成 `above4 = Math.max(0, a - 4) - Math.max(0, a - 5)`，再 `result = above4 * 10 + (1 - above4) * 12`。`Math.max(0, x)` 就是 ReLU，两个 ReLU 相减替掉一次比较。

我照这两行手写在 node 里，跟原程序对 -200 到 200 共 401 个整数点，0 处不符。半整数就露馅：a 取 4.5 时它给 11，JavaScript 给 10。把 4 到 5 按 0.01 扫满，101 个点里 99 个和 JavaScript 不等，误差只活在两个 ReLU 之间那 1 个单位宽的缝里。

## 上面 401 个点是我手推的，换成它的电路呢

![终端实测：两条 lowering 路径的 op 与层数、逐点相符数、梯度非零计数](/assets/img/handwired-js-neural-net/01-screenshot-grid-vs-cascade.webp)

手推是一回事，`emitCompare` 编译出来的电路是另一回事。我声明一条 1 格的线（`assumeGrid(w, 1)`），阈值取 4，输出写成 `out = 12 - 2 * bit`，从 -100 到 200 每个整数喂一遍。

```
B grid+integers    {"tested":301,"bad":0,"firstBad":null}
B grid+halves      {"tested":101,"bad":99,"firstBad":4.01}
D integers -50..50 (n=101) nonzero gA=0 nonzero gT=0
```

301 个点，0 处不符。

同一批点再跑一次 `backpropagateReference`，输出对输入那条线的梯度、对阈值那条线的梯度，非零的个数都是 0。

**它 exact 的那个域和它梯度非零的那个域刚好互补。** 格点上值对、梯度死。把输入换成 4 到 5 之间按 0.01 取的 101 个点，梯度活了（对输入是 -2），值却开始撒谎：99 个点和 JavaScript 不等，第一个不符在 4.01。README 那句 `exact, yet also fully differentiable` 里的 yet also，我实测是二选一。

## 4.01 之后它不报错，也不拦你

![终端实测：声明格的线喂进 4.5，validateGrids 抛错而两个求值器都不抛](/assets/img/handwired-js-neural-net/02-screenshot-seam-values.webp)

缝里的读数是一条斜坡。同一张电路，输入从 4 走到 5，它交出来的是 `12 / 11.5 / 11 / 10.5 / 10.02 / 10`；JavaScript 那边一步跳完，之后全程 10。

我原本以为 `validateGrids` 挂在求值路径上。声明了 1 格的线喂进 4.5，总该被拦一下。实际是 `evaluateReference` 和 `createTensorEvaluator` 都不抛，把 11 交出来；`validateGrids` 是个得自己调的导出函数，调了才抛 `wire 0 must be a multiple of 1, got 4.5`。

所以 `emitCompare` 上面那段契约没被我推翻，它写的是对**声明范围内**的每一对值都等，4.5 不在我声明的格里。第二枚红还是在我这边：我把声明当成了强制。

## #1 报的零梯度，原因不在 emitCompare

现象我复现了。原因不是那个。

chenglou/handwired#1 的正文逐字写着 `backpropagateReference gives a threshold held in a constant cell zero gradient through an emitCompare decision, so a learned breakpoint never moves.`（[issue 原文](https://github.com/chenglou/handwired/issues/1)，10-15 开，抓于 10-16 15:34 UTC）。它把零梯度记在比较决策头上，我数出来的不是这条。

那个常量格在电路里没有任何引用者。`c.constant(4)` 走的是 `affine([], 4)`，`foldConstantTerms` 把值并进下游仿射的 bias，`leftTerms` 里已经没有这条线，反传拿不到它。旁证在我手推的那两行代数上：把阈值从常量格换成第二条 source 线，缝里 a=4.5 的 `gT` 实测就是 2，比较决策没挡住梯度。

要让这条判断塌，只要有人指出 `emitCompare` 内部给常量格留了一个可反传的项，或者我数 `leftTerms` 时走的是另一条分支。这两件我都没去查。

## emitCompare 的事说到这，该不该装我分三档

想搞清程序和神经网络是不是同一条连续体：值得读。docs 六份从 tutorial 一路排到 execution-model，每份开头都写清楚自己管哪一段，`patterns.md` 那句 `The program runs every operation on every frame and can't stop early` 是我这轮读到最实在的一句约束。

想接进构建链：现在不行。`package.json` 里 `private: true`，没发 npm 包，12 条 scripts 全要 bun，docs 那句写的是 `The repo needs Bun, and is tested with Bun 1.4.3`。

想拿它跑你现有的界面代码：先承认没有转换器。电路得你手写，循环只能摊成计数、树、表或者每项同量，一帧里所有运算都要跑完。

## docs 那句 0.14 毫秒我量到 0.55

docs 那半句我复测了两跑。第一跑一万六千篇文档，四次是 `0.5568 / 0.5538 / 1.1186 / 0.5856` 毫秒每篇，稳在它那个数的 4 倍上下。第二跑同一份脚本，跑前跑后各抓一次 `uptime`：负载从 33 抬到 142，四次变成 `6.9354 / 2.3755 / 4.3074 / 2.8922`。第一跑我没抓负载，那组 0.55 的机器状态我说不清。两跑唯一同向的结论是都够不到 0.14。它自己也写了这后端只喂几百篇，我拿一万六去量是超出建议用法；GPU 那半边我没有 WebGPU 会话，十万篇文档的毫秒数属没验到。

如果 chenglou/handwired#1 那个阈值该放常量格还是放线的话头在 0.x 阶段有人接，我就回去把格点上 `gT` 是否恒 0 写成一条测试提给它；没人接，这篇就是我一个人对着这份 tarball 说的话。

项目地址：[https://github.com/chenglou/handwired](https://github.com/chenglou/handwired)
