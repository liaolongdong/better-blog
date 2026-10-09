---
layout: post
title: Chrome 155 开始解 JPEG XL，我这台 154 还在白下载
subtitle: 同一批 .jxl，154 报解码错，155 出图，Accept 头部差一枚 token。
seo_short_title: Chrome 155 解 JPEG XL
seo_description: Chrome 公告 10-06 那句只划了解码，starting from Chrome 155。本机 154.0.8037.98 对同一份 .jxl 报 ERR，155.0.8059.39 出了图，picture 双源的落点跟着翻。编码侧公告正文 encode 出现 0 次。
date: 2026-10-10
categories: 开源实测
cover: /assets/img/chrome-155-jpeg-xl-decode/banner.webp
tags: chrome headless 开源
---

# Chrome 155 开始解 JPEG XL，我这台 154 还在白下载

![同一份 .jxl 在两个版本里的两种下场](/assets/img/chrome-155-jpeg-xl-decode/banner.webp)

> 一句话结论：Chrome 155 原生解 .jxl，154 把字节整个下完再报错。
> 现在该做什么：拿一张 .jxl 和一张 PNG 做双源，只看 currentSrc 落在哪边。

## 发生了什么

Chrome 能读 .jxl 了，**只读不写**。

公告发在 10-06，署 Luca Versari、Moritz Firsching、Philip Jägenstedt 三个名。原话里被划出来的只有两截：`decoding support` 和 `starting from Chrome 155`。

我 10-09 抓的版本表里，Stable 已经是 `155.0.8059.39`。

Firefox 的 intent 早两个月，8-24 写 `As of Firefox 157 I intend to turn JPEG XL decoding on by default`。Safari 的 17.0 是 2023 年。

[Chrome 公告](https://developer.chrome.com/blog/jpeg-xl-in-chrome)。

## 已确认的，和还没确认的

解码这一侧，三家用同一支 Rust 库 jxl-rs。

Nikkel 那份 Firefox intent 写 Chrome 还藏在 flag 后面、`no intent to ship yet`——这半句 10-06 被推翻（[intent](https://groups.google.com/a/mozilla.org/g/dev-platform/c/3YMV4MS34KA)）。

编码这一侧还没确认。公告正文剥标签再数，`encode` 词根 0 次；自陈比 JPEG 省 30-50%，我复核不了。

两边还在打架。Rosato 9-13 说 JXL 渐进式 `uses a polyfill`，他自己的结论是 `I decided not to work with JPEG XL`。Nikkel 写 jxl-rs `including animation and progressive display`。一个讲网页怎么拿图，一个讲解码器会什么。

## 对谁有什么影响

做图片管线的，今天就能加一档。

`<picture>` 里那枚 `<source type="image/jxl">` 从这版起不用挂 polyfill。验收只看 currentSrc，不看渲染。

靠 Accept 协商的要认版本差：155 发出的 image 请求头把 `image/jxl` 排在最前面，154 那串里没这一项。我这个站是 GitHub Pages 纯静态，没有按请求头变体的入口，只能把双源手写进模板。

![两个版本对同一份文件的四种反应](/assets/img/chrome-155-jpeg-xl-decode/01-comparison-decode-matrix.webp)

还在 154 的人，浏览器会把 .jxl 的字节下完再报解码错，流量花了图没出来。所以别把它设成唯一格式。

做上传和图床的这轮先不动。解码器和编码器不是一回事。

## 我实测到的

两个二进制，同一对探针页，结果相反。

样本取自 libjxl 官方 testdata，md5 与本机副本逐条对过。两张 .jxl 分别 81B 与 793B，另有同图 PNG 当后备。

```
154  a=ERR  b=ERR  src=/splines.png
155  a=2048x2048  b=50x80  src=/traffic.jxl
```

版本是 `154.0.8037.98` 与 Chrome for Testing `155.0.8059.39`，每条一个新 profile。那张 PNG 两版都出图；currentSrc 原文带环回加端口 56862，这里只留尾巴。

没测渐进式和动画，本机造不出那种文件：ffmpeg 报 `Unknown encoder 'jpegxl'`，libjxl 最新 release 的 16 个 asset 无 macOS。

## 接下来盯什么，我的判断

我盯 libjxl 的 release 页。如果 macOS 的 asset 到下个 release 还不出现，我的构建里就不加 .jxl 产物。

如果 Firefox 157 那个默认开关没在下个 stable 兑现，我把 jxl 放在双源的第二档，不当主力。

项目地址：[https://github.com/libjxl/libjxl](https://github.com/libjxl/libjxl)

浏览器认不认，和能不能造出这个文件，是两件事。
