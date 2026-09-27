---
layout: post
title: Bend 2 实测：68 行声明配 484 行证明
subtitle: 68 行 law 配 484 行证明，我改坏一行，bend PROOF.bend 退出码 1
seo_short_title: Bend 2 的 LAWS.bend 与证明门
date: 2026-09-27
categories: 开源 编程语言
cover: /assets/img/bend-laws-proof-gaps/banner.webp
tags: Bend 类型系统 开源 AI编程
---

# Bend 2 实测：68 行声明配 484 行证明

![一道石门两侧的两条路径：左边一块砖从门底缝里溜了出去，右边一块被门正面拦住](/assets/img/bend-laws-proof-gaps/banner.webp)

> 一句话结论：它把“别让 AI 改坏我的规则”从一句请求，变成编译期必须出示的证明。
> 现在该做什么：clone 仓库跑 `bend demos/proof_insertion_sort/PROOF.bend`，看它打 All terms check.

## 背景：它为什么出现

它是 bendlang/bend，一门规则要出示证明的新语言。仓库 2023 年 8 月开的，TypeScript 写的，Apache-2.0，09-27 凌晨还在推。

star 22,982，09-27 14:15 抓的；版本 2.0.31 当天发布。README 自陈编译器 99% 由 AI 写，还没审计完。

## 它解决什么痛点

它对付的事很具体：AI 改了代码，你读不过来。以前只能在 AGENTS.md 里留一句“别把这条规则改坏”，模型听不听看运气。

![左半是一页写给助手看的备忘，右半是同一页变成类型后被一道门卡住](/assets/img/bend-laws-proof-gaps/01-comparison-agents-vs-laws.webp)

Bend 多要一步：规则写进 `LAWS.bend`，用类型表达；AI 在 `PROOF.bend` 里定义同名函数把它证出来，`bend PROOF.bend` 就是那道门。我读到的第一条 law 叫 `you_cant_win`，任何一步之后，棋盘都不能是已通关状态。

## 快速上手

README 给的安装命令是一行管道。首跑失败。

```bash
$ curl -fsSL https://bend-lang.com/install.sh | sh
downloading …bend-2.0.31-darwin-x64.tar.gz
curl: (56) LibreSSL SSL_read: …: Operation timed out, errno 60
bend: the download failed: …
```

退出码 1。三处 … 是我截的，都是那串资产地址和 LibreSSL 的错误码。

脚本里那行 curl 不带 `-C -`、也不带 `--retry`，所以第二次跑到一千八百万字节就整包作废。加这两个参数循环续传才把 26,711,625 字节下齐，照脚本内嵌的 sha256 验过，手工解进 `~/.bend`。

## 使用示例

我改坏了一行代码。它在 `demos/proof_insertion_sort/main.bend`。

把 `dec` 的 Inl 分支从 `x <> h <> t` 改成 `h <> x <> t`：元素一个没少，只是不再有序。

```bash
$ bend main.bend
[2n, 1n, 3n]
$ bend PROOF.bend
Error:
- expected : main.LE(lo, h)
- observed : main.LE(lo, x)
Location: sorted_ins.fin
22>|       (lx, e, st)
```

上面八行原样抄的。解释器那侧静默返回乱序数组，退出码 0；证明这侧 exit=1，指到 `sorted_ins.fin`。没动过的对照组打 `[1n, 2n, 3n]`。

## 和同类比：强在哪、差在哪

强的一面拿 TypeScript 比最直观。`as` 断言编译完就消失，law 是要在编译期交出证明的类型。

差的一面是我跑出来的。测试里有个 `@unsafe` 的 `boom`，返回 `Empty`，函数体只写着 `boom()`。它的输出是：

> All terms check, but 3 defs rely on unsafe or foreign code:

退出码 0。项目自己在 `WONTFIX.txt` 里写着 read the note, not the exit code。GUIDE.md 还交代两个出口：foreign 函数只按它的类型建模，不验 C 或 JS 的实现；`--safe` 到内核那层翻译本身没有证明。

我为什么还没换？我这边是 wxt + Vue 3 + Element Plus。Bend 的 JS 目标 README 自己写着单核、没有图形和音频。bendlang/bend#1069 那条 C 后端的限制还 open。

## 未来展望：什么条件下我会用它

我没换，两个赌注。第一把押 `--safe`：CHANGELOG 里 2.0.30 那条内核复核若推进到让 `@unsafe` 非零退出，我就放进真项目 CI。bendlang/bend#776 关了，我跑出来仍是 0。

第二把押增量编译。README 写着“一个程序一个 C 文件”，不改这条，我只在 demo 用它。

项目地址：[https://github.com/bendlang/bend](https://github.com/bendlang/bend)

它没让我少读代码，只是改坏时会被拦。
