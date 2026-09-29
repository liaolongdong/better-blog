---
layout: post
title: scriptc 把 TS 编成 72KB 原生二进制，Intel Mac 少一个包
subtitle: 二进制里真没有 Node，但 x64 的运行时包在 npm 上只发到 0.1.0
seo_short_title: scriptc 编译 TypeScript 原生二进制
date: 2026-09-29
categories: 开源工具 TypeScript
cover: /assets/img/scriptc-native-x64-gap/banner.webp
tags: scriptc TypeScript 原生编译 Vercel
---

# scriptc 把 TS 编成 72KB 原生二进制，Intel Mac 少一个包

![TypeScript 源码经过编译器变成一个不依赖运行时的原生可执行文件](/assets/img/scriptc-native-x64-gap/banner.webp)

> 一句话结论：scriptc 真能把 TypeScript 编成二进制里不带 Node 的原生程序。
> 现在该做什么：`npm i -g scriptc` 拿一个 CLI 试；Intel Mac 先查 x64 平台包的版本。

## 背景：它为什么出现

scriptc 是 Vercel Labs 出的原生编译器。仓库 2026-07-22 开的源，`0.1.7` 是当前最新版，`Apache-2.0`。star 5,668，本周新增 714，在 TypeScript 周榜排第 8，npm 上周下载 10,073 次。

README 那句主张是 “no Node, no V8, no JavaScript engine in the binary”。我按它试了一下午。

## 它解决什么痛点

痛点不在编译，在分发。

我给同事一个 CLI，今天只有两条路：让他装 Node，或者把整个运行时塞进壳——本机那个 node 二进制一亿一千多万字节。

scriptc 编出来的 `hello` 是 72,016 字节，**里面只有机器码和它自己的 C 运行时**。冷启动各跑 9 次取中位：原生 `11.6` 毫秒，`node hello.js` `141.3` 毫秒。

![编译产物与 node 二进制体积对照，右边小得多](/assets/img/scriptc-native-x64-gap/01-comparison-size-gap.webp)

## 快速上手

装的时候 npm 只是警告。我这边 Node 是 `v22.19.0`，它要 24。警告归警告，装上了。

```bash
$ npm i -g scriptc
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   required: { node: '>=24' },
npm warn EBADENGINE   current: { node: 'v22.19.0', npm: '10.9.3' } }
$ scriptc build hello.ts -o hello && file hello
hello: Mach-O 64-bit executable x86_64
```

拿本机遗留的 Node 16 去跑，编译器本身起不来。

## 使用示例

`node:http` 那个例子是我留下来的理由。README 写 8080，我换成 8791 再跑。

```bash
$ time scriptc build server.ts -o server
real 9.57
$ ./server &
$ curl -s "http://127.0.0.1:8791/a/b?c=1"
{"path":"/a/b?c=1"}
```

二十四万七千字节，`ps` 里找不到 node。另一条线索是它的边界：`import pc from "picocolors"` 不给 `--dynamic` 就两条 `SC2013`，hint 原文是 `adds ~620KB to the binary`。

## 和同类比：强在哪、差在哪

强的一点：`tsx` 要求接收方有 Node，这条不用。

差的一点在这台机器上。`@scriptc/compiler` 把 `@scriptc/runtime-darwin-x64` 钉在 `0.1.7`，可 npm 上它只发到 `0.1.0`，arm64 才有。npm 静默跳过，装到本地的只有三个目录。[README](https://github.com/vercel-labs/scriptc) 那句 `clang is only the platform linker driver` 的主语是 macOS 15 以上的 arm64。Intel Mac 上缓存目录里躺着 85 个 `scr_*.o`，是 clang 现编的。

`--emit=obj` 被拒，报 `SC3002`；装饰器不吃，报 `SC0001`，见 vercel-labs/scriptc#238，开着，零评论。我还没换：插件产物交给浏览器，wxt 那条链路没有它的位置。

## 未来展望：什么条件下我会用它

两把赌注。那个 x64 的 dist-tag 若还停在 `0.1.0`，我不在 Intel 同事的机器上推它。另一把押 vercel-labs/scriptc#522 那条 WASI 可调用导出。如果它落成一个装得上的版本，我把 CLI 的分发目标从原生换过去。

项目地址：[https://github.com/vercel-labs/scriptc](https://github.com/vercel-labs/scriptc)

Intel Mac 能用，只是别把它当成不需要编译器。
