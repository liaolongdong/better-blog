---
layout: post
title: ascii.rest 的动画很省，打包那步不省
subtitle: 减少动效和离屏暂停它真做了，代价是引适配器的构建会多吐两百多个文件
seo_short_title: ascii.rest 引法与体积实测
seo_description: 减少动效与离屏暂停两处门控我真量到了，两档重跑读数逐项相同。代价是引 react 或 element 入口的构建静态带上 208 个 js 文件，element 版 209 个；手动挂那三行只有 1 个。
date: 2026-10-09
categories: [开源实测, 前端工程化]
cover: /assets/img/ascii-rest-208-files/banner.webp
tags: 开源 前端构建 vite npm
---

# ascii.rest 的动画很省，打包那步不省

![一台织布机把字符一格一格织成会动的画，脚边堆着两百多片没人要的小布片](/assets/img/ascii-rest-208-files/banner.webp)

> 一句话结论：减少动效和离屏暂停它真做到了，代价是构建多出 208 个文件
> 现在该做什么：只手动挂你要的那一篇，别引它的 react 和 element 入口

## 背景：它为什么出现

它是一组会动的 ASCII 字符画，开源两天。

仓库 `bas3line/ascii` 建于 10-07，npm 上 10-08 首发，三个半小时更到 0.2.1。star 613 是我今天 03:37 UTC 抓的，fork 32，贡献者 2 人，GitHub 上一个 release、一个 tag 都没有。

装过的人有多少我没材料：npm 的下载接口对这个包回 404，同一句命令换 `react` 就回 200。它是从搜索接口翻出来的，四个 Trending 榜都没它。

## 它解决什么痛点

要往页面放会动的字符画，平时得自己写三件事。

逐帧换掉 `<pre>` 里的文本；滚出视口就停；`prefers-reduced-motion` 档位下不动。第二条常被忘，第三条几乎没人做。

它把这三个条件写死在同一个渲染器里，`src/mount.ts` 里那个开关就是三者的与。一篇 piece 的契约也简单：导出 `meta` 和一个返回每帧文本的函数。

我这个博客的配图全是静态 webp，这三件事我从没为自己做过，所以想看看它替我做到哪一步。

## 快速上手

三行接完，第一次跑就撞到两条报错。

```bash
$ npm i ascii.rest@0.2.1 vite
added 16 packages in 9s
$ npx ascii.rest rsut
ascii.rest: there is no piece called "rsut". Did you mean rust?
$ npx ascii.rest donut --fps 240
--fps takes a number above 0 and up to 60, not "240"
```

后两条走 stderr，退出码 1。管道里跑 `donut` 只吐首帧：902 字节、22 行、一个转义符都没有——README 就这么写的。

## 使用示例

这三行构建出来是一个文件，不到 5 KB。

```js
import { mount } from "ascii.rest";
import { donut } from "ascii.rest/pieces";
mount(document.getElementById("x"), donut);
```

三个开关我都量过。默认档下 700 毫秒后画面还在推进。先放视口外它只画首帧，滚回来才继续，再滚出去就停住。模拟 reduce 之后，一帧没再动。两档重跑，读数逐项相同。

![三种条件下这段动画的走势：屏内一路推进、离屏停在首帧、减少动效下整条不动](/assets/img/ascii-rest-208-files/01-infographic-motion-gates.webp)

Vue 3 里我照常见建议配了 `isCustomElement`，又建一版不配的对照。都过。两版都渲染、都在推进、控制台 0 条。那条建议对它不成立。

## 和同类比：强在哪、差在哪

和我手写比，省下来就是那三个条件，这条我真量到了。差在三处，都来自实测。

引 `ascii.rest/react` 或 `ascii.rest/element`，等于静态带上那张名字到文件的表。我特意把只传对象、一个名字都不传的那版重新构建了一遍。产物还是 208 个 js 文件，element 版 209 个。手动挂那三行只有 1 个。运行时确实只取你要那一篇：免构建那条路我数过，四个请求。

仓库 216 篇，装到手的 0.2.1 里 208 篇，差 8 篇：`a0`、`keiki` 还没发出去。

CONTRIBUTING 写着每帧平均 4 ms 以内、最差 30 ms，这条由 `npm run check` 把关，`ci.yml` 三步里没有它。这台 8 核 i5 上连跑三次全量 check，红了 18 / 5 / 8 篇，三次都红只有 4 篇。31 条 FAIL 全是超预算，没有一条契约错。

没换的原因：我博客的图都是静态 webp，眼下用不上。

## 未来展望：什么条件下我会用它

锚在两条开着的 PR 上。`bas3line/ascii#23` 要把一格终端切成八份，body 写着 0.2.2；`bas3line/ascii#18` 的 /make/ 现在还是 404。

如果它带着 0.2.2 发出来，我就拿它做终端演示；那 8 篇的差距要到下个月还没抹平，我就不引它。

项目地址：[https://github.com/bas3line/ascii](https://github.com/bas3line/ascii)
要试就只挂你要的那一篇，适配器先别引。
