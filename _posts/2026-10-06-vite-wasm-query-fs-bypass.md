---
layout: post
title: 一个查询串让 Vite 漏出工作区外文件的头四个字节
subtitle: 五条维护线不到两小时各发一版，三条公告同日挂出
seo_short_title: Vite wasm 查询泄露实测
seo_description: 带 ?vite-wasm-instance 的查询会跳过 server.fs 边界检查，错误页吐回工作区外文件开头的 4 个字节；五条维护线两小时内各发一版，三条公告同日挂出，均无 CVE 编号
date: 2026-10-06
categories: [AI, 前端工程化]
cover: /assets/img/vite-wasm-query-fs-bypass/banner.webp
tags: vite 安全 dev-server
---

# 一个查询串让 Vite 漏出工作区外文件的头四个字节

![一条带查询串的请求绕过文件边界检查，从服务端的错误回显里漏出目标文件开头的四个字节](/assets/img/vite-wasm-query-fs-bypass/banner.webp)

> 一句话结论：地址尾部拼上那条 wasm 查询，server.fs 的判断整个跳过，错误页吐回文件头四字节
> 现在该做什么：给自己 dev server 的一个 /@fs/ 地址加上这条查询，看回 403 还是 500

## 发生了什么

五条线在不到两小时里各发一版。

```
8.3.3  10-06 04:10 UTC   dist-tag latest
8.2.4  10-06 04:48
8.1.6  10-06 04:51
7.3.7  10-06 05:11
6.4.4  10-06 05:49   dist-tag previous
```

上面是从 registry 的 `time` 字段抄的五行。最新那版说明列 4 个 fix，两条在 server 侧。给这条 wasm 查询补上边界检查的那条是 vitejs/vite#23655。

同日 14:15 UTC，仓库侧挂出三条公告，两条 medium、一条 low，都没有 CVE 编号。这个仓库 83,229 星。

## 已确认的，和还没确认的

已确认的是公告本身。

> First 4 bytes of files outside of `server.fs` setting is exposed by `?vite-wasm-instance`

头一条的标题就这样写的，vite 的区间盖 8.2、8.3 两条线。第二条说项目路径撞上系统路径时，`allow` 外面的文件能被 serve，它把六线整条收到 6.4.3 为止。低危那条要求未改动的浏览器 URL 原样进 `transformIndexHtml`，公告自己写明标准起法不在条件里。

没确认的是这三条进不进全局公告库。我 14:32、14:42、14:58 各打一次 `api.github.com/advisories/`，三条全 404。同一时刻仓库侧的列表接口是 200。main 的 CHANGELOG 只有八线一节，六线这版没有小节。

## 对谁有什么影响

三类人，各一个动作。

跑 dev server 且监听非回环的人，先自查泄露那条。给任意一个 `/@fs/` 地址拼上这条查询，看状态码。回 403 说明这轮的检查进去了。回 500、响应体里带 `found` 和一串十六进制，就是还没修的那版。补丁版本号在上面那五行里。

停在六线的人看第二条公告。泄露那条在六线不成立，这个查询 grep 五个 chunk 零命中，所以六线要动的是另外两条，升 `previous` 指的那版就行。

拿 `npm audit` 或 Dependabot 当门禁的人，这轮它们是瞎的，公告页是唯一告警面。这个博客的 lockfile 锁在 6.4.3，正好落在第二条区间里。

## 我实测到的

旧版吐字节了。

四棵树，八线和六线各一旧一新。真起服务、端口给 0，靶文件叫 `.env`，首行是我自己写的哨兵串。

```
带查询    8.3.2 500（found 53 45 4e 54）   8.3.3 403
不带查询  8.3.2 403                        8.3.3 403
```

机理在 dist 里。修复前那个 gate 只判 raw、url、inline、svg 四条正则，这条查询一条不命中就跳过它。被交给 `WebAssembly.compile` 的是个文本文件，Node 的报错自带头四个字节。

第二条我只做到集合归属：一个解析不成功的 SSR import，旧版记进 `safeModulePaths`，新版不记。公告写的拿到主机 `/etc/hosts` 我没做出来，那条地址在任何 import 之前就是 200，删掉集合里那项还是 200。低危那条没做形状。

## 接下来盯什么，我的判断

我盯两件事。

如果这三条到 10-13 还进不了全局公告库，我不再把 `npm audit` 当 vite 的告警面。改成人读 releases，dist-tag 那两行进我自己的检查脚本。

另一件是 CHANGELOG 里六线那版的小节。补上，说明这次五条线一起进了日志。一直不补，我当作只有八线被认真写进去，升六线的人只读公告页那一格。

项目地址：[https://github.com/vitejs/vite](https://github.com/vitejs/vite)
那 4 个 fix 里两条是 fs 边界，另两条一条在 html、一条是 launch-editor。
