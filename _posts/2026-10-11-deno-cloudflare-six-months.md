---
layout: post
title: Deno 去了 Cloudflare，Deploy 还剩六个月
subtitle: runtime 再发一年就停，Deploy 六个月后关，两套接替产物我这台都没起来
seo_short_title: Deno 加入 Cloudflare 实测
seo_description: 2026-10-09 两篇公告写着 Deno runtime 一年后停止开发、Deno Deploy 六个月后关停。我装了接替它的 workerd 和 celld：一个缺符号起不来，一个没有 Intel macOS 产物。
date: 2026-10-11
categories: 开源实测
cover: /assets/img/deno-cloudflare-six-months/banner.webp
tags: 开源 Node 前端
---

# Deno 去了 Cloudflare，Deploy 还剩六个月

![Deno 与 Cloudflare 两篇公告并排，右边是六个月和一年两条界线](/assets/img/deno-cloudflare-six-months/banner.webp)

> 一句话结论：runtime 再发一年就停，Deploy 六个月后关门，接替它的是 workerd 那条线。
> 现在该做什么：把跑在 Deno Deploy 上的服务列一张清单，今天先在本地用 deno serve 起一遍。

## 发生了什么

两篇公告同一天挂出来，2026-10-09。

Deno 那篇署名 Ryan Dahl，[原文](https://deno.com/blog/cloudflare) 里四条承诺全是相对时长。

runtime 再支持一年，月度版本只含 bug 修复和安全更新。一年之后停止开发，代码继续开源。Deploy 再运营六个月后关停，付费客户给迁到 Workers 的支持。

JSR 继续运营，基础设施搬去 Cloudflare。rusty_v8 继续支持，并进 workerd。

Cloudflare 那篇署名 Kenton Varda 和 Ryan Dahl。[它](http://blog.cloudflare.com/deno-joins-cloudflare) 讲的不是关停，是替代品：workerd 的 Durable Objects 只有单实例。

## 已确认的，和还没确认的

确认的是原话，没确认的是日期。

another year、six months 各出现一次，都是相对时长。2027、acquir 两侧各 0 次，收购那词来自 HN 标题。

两条界线我按公告日推算：Deploy 到 2027-04-09，runtime 到 2027-10-09，公告没给。

同一条公告，两种读法。[theodorejb](https://news.ycombinator.com/item?id=50020072) 那句：

> So unless someone else picks up development, Deno will no longer be supported.

[kentonv](https://news.ycombinator.com/item?id=50020200)（Cloudflare 那位作者）回：

> …it's not just fluff

一句当它是终止，一句说公告被读薄了。谁对我判断不了。

## 对谁有什么影响

分三类人，每类一件今天能做的事。

| 谁 | 今天做 | 为什么 |
| --- | --- | --- |
| Deploy 上跑着东西的人 | 列清单，标出用了哪些 API | 官方部署工具自己只用 3 个 |
| 只在本地用 runtime 的人 | 记下这个自算日期 | 一年后月度版本就停 |
| 准备迁 Workers 的人 | 先真机装一遍 workerd | 我装上了，跑不起来 |

那个部署工具是 jsr.io 上的 `@deno/deploy`，最新版 0.0.9908。入口 main.ts 九十七行，去重只用三个 `Deno.*` 成员。迁移面没想象中大。

celld 更麻烦。官网写的是「Install the 58 MB static executable」。我下 v0.6.2 的 linux-x86_64 那支，解压 66.3 MB，跟这句对不上。darwin 只有 aarch64。

它要 S3 兼容桶加 Linux，所以 RPO=0、约 90ms、多实例三项我都没复核。

## 我实测到的

Deno 没问题，接替它的两边都有问题。

`deno 2.9.7` 认 Workers 形状那个文件，`deno serve` 起监听，curl 回 workers-ok。

同一文件改 `deno run` 只得一句 warning，端口不起。

workerd 装下来了。跑不起来：

```
dyld[69335]: Symbol not found: __ZNSt3__122__libcpp_verbose_abortEPKcz
  (built for macOS 13.5 which is newer than running OS)
```

Referenced from 那行删了。二进制写着 minos 13.5，本机 13.1。celld 的安装脚本回 no prebuilt release exists，exit 1。

API 差集我没比，缺一个能跑的 workerd。

## 接下来盯什么，我的判断

我盯三件事，不赌方向。

一是 celld 出不出 x86_64-apple-darwin。

二是关停日期有没有落到文档上。如果 2027-04-09 前 deno.com/deploy 还搜不到 shut，我就直接迁走。

三是我这台机器挡住的这两套，别当成迁移难度。

项目地址：[https://github.com/denoland/celld](https://github.com/denoland/celld)

它现在 5,339 星，我先不迁过去。
