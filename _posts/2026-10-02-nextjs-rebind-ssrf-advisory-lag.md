---
layout: post
title: Next.js 堵住了能打回环的 SSRF，可七条公告两天还没进库
subtitle: 同一发请求，旧版取回内网那张图，16.3.8 只给 504
seo_short_title: Next.js 16.3.8 安全发版实测
seo_description: 同一发打回环的请求，旧版取回了内网那张图、新版只给一个错误状态：这个洞堵上的同一次发版里，安全公告却还有一批没进公告库。
date: 2026-10-02
categories: AI
cover: /assets/img/nextjs-rebind-ssrf-advisory-lag/banner.webp
tags: Next.js 安全 SSRF
tldr: '同一发打回环的请求，16.3.0 和 16.3.7 都回 200 并往靶文件写了一行，16.3.8 只给 504；堵住这个洞的那次发版列了 7 条公告，两天后逐条查全局公告库全是 404，npm audit 报 0 漏洞。'
faq:
  - q: 'Next.js 16.3.8 修镜像优化器那个 SSRF 修的是哪一步？'
    a: '把连接钉在校验过的 IP 上。新版多了 createPinnedLookup：校验用 dns/promises 解析，地址钉住再交给 socket；旧版校验完把解析还给 socket 自己做。is-private-ip.js 两版逐字节相同，改的不是判断，是第二次解析由谁回答。'
  - q: '旧版真的能从镜像优化器打到回环内网吗？'
    a: '能。用一个 --require 脚本改掉回调版 dns.lookup，对 example.com 只回答回环地址，dns/promises 不动，靶是自起的回环服务。三棵树各跑一轮：16.3.0 回 200、fixture 加 1 行 /secret.png，16.3.7 同样 200 加 1 行，16.3.8 回 504、fixture 0 行、日志写着 timed out。'
  - q: 'Dependabot 或 npm audit 会提示这 7 条公告吗？'
    a: '不会。7 条在仓库侧全是 published 且都有 CVE 编号，但逐条打 api.github.com/advisories 全 404；同一批 4 条旧公告全 200，含上一条 critical 的 GHSA-vcvr，它上次隔 8 天才进库。npm 的 bulk 接口对这三个版本返回空对象，干净树里跑 npm audit 报 0 漏洞。8.3 那条的 Patched versions 一格还写着字面的 16.3.?。'
---

# Next.js 堵住了能打回环的 SSRF，可七条公告两天还没进库

![Next.js 镜像优化器把内网请求挡在门外](/assets/img/nextjs-rebind-ssrf-advisory-lag/banner.webp)

> 一句话结论：这轮补丁把连接钉在校验过的 IP 上，新版镜像优化器打不进回环
> 现在该做什么：把 images.remotePatterns 逐条解析一次，再看 npm audit 报几条

## 发生了什么

两个版本同一分钟发出来。我 10-02 14:08 抓 releases API。v16.3.8 的 published 是 09-30 16:13:46 UTC，说明里列 7 条公告。v15.5.27 差 4 秒挂出来，只列 3 条。

最高那条是镜像优化器的服务端请求伪造，CVSS 8.3。最低那条说 dev server 的 MCP 端点会漏开发数据。这个仓库十四万多星。

## 已确认的，和还没确认的

已确认的是公告本身。7 条在仓库侧全是 published，都有 CVE 编号，发布后两天还在被编辑。

没确认的更要紧：它们没进 GitHub 的全局公告库。我逐条打 api.github.com/advisories/，7 条全 404。同一轮 4 条旧公告全 200，含上一条 critical 的 GHSA-vcvr。它上次隔 8 天才进库。

npm 侧也一样空。bulk 接口对这三个版本返回空对象，我在只装旧版的干净树里跑 npm audit，指定官方 registry，报 0 漏洞。

还有一处对不上。8.3 那条的公告页，Patched versions 一格写着字面的 16.3.?。而 15.5.27 的说明列了 GHSA-f87g，这条公告的区间却只从 16.x 起。我不解释。

低危那条我复现不出来。它说端点不校验来源，可我装的三个版本里，带别家 Origin 打过去全返回 403，响应头也没有跨源读取许可。

## 对谁有什么影响

三类人，各给一个动作。

自己托管、配了 images.remotePatterns 的人最该动。把每条 hostname 解析一次，看它落不落在私网里。落私网的话，旧版每次取图都要再问一次 DNS，那就是那条路。

![校验用的解析与连接用的解析分别落在哪里](/assets/img/nextjs-rebind-ssrf-advisory-lag/02-comparison-lookup.webp)

拿 Dependabot 或 npm audit 当门禁的人，这轮它们是瞎的。公告页是唯一告警面，得自己订阅 releases。

只跑 next dev 的人可以看低危那条。我 build 完用 next start 起生产模式，打 /_next/mcp 是 404，这端点确实只在 dev 里活着。

## 我实测到的

旧版拿到了。

新版多了 createPinnedLookup：校验用 dns/promises 解析，地址钉住再交给 socket。旧版校验完，解析还给 socket 自己做。is-private-ip.js 两版逐字节相同，改的不是判断，是第二次解析由谁回答。

我用一个 --require 脚本改了回调版 dns.lookup：对 example.com 只回答回环地址。dns/promises 不动。靶是我自己起的回环服务，命中就往文件加一行。三棵树各跑一轮：

```
16.3.0  ->  200   fixture +1 行 /secret.png
16.3.7  ->  200   fixture +1 行 /secret.png
16.3.8  ->  504   fixture 0 行，日志 timed out
```

## 接下来盯什么，我的判断

我盯那格 16.3.?。它哪天变成真版本号，机器才读得出修复线。

如果 10-07 之前这 7 条还查不到，我不再把 audit 当 next 的告警面，改成人读 releases。低危那条我不觉得会照自己的描述修，它说的校验在 16.3.0 上已经有了。我打算提个 issue。

项目地址：[https://github.com/vercel/next.js](https://github.com/vercel/next.js)
升级只把连接钉在校验过的地址上，那个域名归谁解析，还是你自己的事。
