---
layout: post
title: GitDiagram 免 key，但 17 条连线 4 条查不到
subtitle: 一次 POST 就回一张 mermaid，代价是别抄它画的线
seo_short_title: GitDiagram 免鉴权 MCP 实测
seo_description: 不带 key 的一次 POST 换回一张 mermaid 架构图，代价是它给出的连线里有几条在源码里查不到，看图可以，别抄它画的线。
date: 2026-10-01
categories: 开源工具 TypeScript
cover: /assets/img/gitdiagram-keyless-mcp-4-bad-edges/banner.webp
tags: GitDiagram MCP TypeScript Mermaid 架构图
---

# GitDiagram 免 key，但 17 条连线 4 条查不到

![仓库地址换成图地址的浏览器画面](/assets/img/gitdiagram-keyless-mcp-4-bad-edges/banner.webp)

> 一句话结论：不带 key 的一次 POST，就回了我一张 wxt 的 mermaid 架构图。
> 现在该做什么：手边有陌生仓库，把地址里的 hub 换成 diagram 先看一屏。

## 背景：它为什么出现

它是一张网页架构图加一个免鉴权的 MCP 服务。2024-12-15 开的源，MIT，TypeScript 写的 Next.js 16 应用，29 个运行时依赖。

10-01 抓到 star 17,665，本周新增 622，在 TypeScript 周榜第 14 行。开着的 issue 43 条。

10-02 再抓一次：star 17,731，issue 44 条，最后一次推送在六分钟前。

## 它解决什么痛点

读陌生仓库以前只有两条路。

一条是 clone 下来挨个翻文件，我拿自己在跟的 wxt 试过，半天。另一条是把整棵目录灌进模型上下文，一轮问答就烧完。它给的是中间那层：谁负责什么、模块之间怎么走，一张图讲完，每个方块还能点回源码。

## 快速上手

网页那条不用装东西。Agent 那条我直接打它的 MCP，没带鉴权头。

```bash
$ node mcp2.mjs   # 无 Authorization 头
tools/list → 3 个工具
$ node mcp2.mjs "get_repository_diagram|wxt-dev/wxt"
http=200 ms=12029 status=found
$ npm ci → code EUSAGE   # 仓库只有 bun.lock
```

本地把 app 跑起来，npm 这条路我断在第二步。npm ci 退出码 1，换 `npm install --dry-run` 回 EOVERRIDE。

dompurify 的直接依赖写 `^3.4.16`，overrides 又把它钉成 `3.4.16`。它 engines 只认 bun。

换 bun 才装上，1005 秒。

## 使用示例

冷启动我量了。livenerf 是我前一天写过的仓库，它库里没图。

我按网页那条流程 POST 了一次生成路由，请求体就 username 和 repo 两个字段。

- 首字节不到一秒，共 39 条状态事件，总计 23 秒
- 它读了 28 个源文件，回话里模型型号写的是 gpt-6-luna
- 再问一次 MCP：found，图上标的 star 是 966
- 图地址后面加 `.md`，回 text/markdown，12,798 字节

## 和同类比：强在哪、差在哪

强在不用铺场景。问一句 fastapi 怎么组织的，它就回图。

差在连线。它给自家画了 26 个方块、18 条线。25 个方块指向具体文件，路径在我 clone 的那个版本上全都存在。

对照 madge：我拿它跑它列的 MCP 那个目录，11 个文件、675 毫秒，一个语义分组都没有。

17 条文件之间的线我逐条查 import，4 条查不到。

![方块都在、线查不到](/assets/img/gitdiagram-keyless-mcp-4-bad-edges/01-comparison-edges.webp)

ahmedkhaleel2004/gitdiagram#215 报的就是这条：open、零评论、2026-09-08 开的。

四条是同一个形状：真实的引用住在一个图上没画的中间文件里。advertise 页面 19 行，零个 href。

我还没换：画架构我还是先跑 madge，因为那 11 个数字我复核得起。

## 未来展望：什么条件下我会用它

两把赌注。如果 ahmedkhaleel2004/gitdiagram#215 到 12 月底还挂着零评论，我只把它当读开源仓库的第一屏。如果它给连线也补一次 import 校验，我会在评审里用它。

项目地址：[https://github.com/ahmedkhaleel2004/gitdiagram](https://github.com/ahmedkhaleel2004/gitdiagram)

图是真快，线是真没人核。
