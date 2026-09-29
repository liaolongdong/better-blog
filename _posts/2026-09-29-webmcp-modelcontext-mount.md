---
layout: post
title: WebMCP 只剩 document.modelContext 这个挂载点
subtitle: Cloudflare 在 9 月 28 日摘掉测试用的那个名字，我把五种 Chrome 配置都跑了一遍
seo_short_title: WebMCP 挂载点收敛到 document
date: 2026-09-29
categories: AI
cover: /assets/img/webmcp-modelcontext-mount/banner.webp
tags: WebMCP Chrome Agent
---

# WebMCP 只剩 document.modelContext 这个挂载点

![一面墙上并排伸出两枚挂钩，左边那枚还挂着通电的标签，右边那枚刚被取下，只剩两个螺丝孔](/assets/img/webmcp-modelcontext-mount/banner.webp)

> 一句话结论：`navigator` 上那两个名字从来不在标准里，现在连实现也撤了。
> 现在该做什么：把你页面里 `|| navigator.modelContext` 这半行删掉。

## 发生了什么

Cloudflare 在 9 月 28 日改了 WebMCP。它是让网页把功能登记成工具、给 AI 助手调用的草案。

Browser Run 那条[变更记录](https://developers.cloudflare.com/changelog/post/2026-09-28-webmcp-api/)的标题写着 `moves to document.modelContext`，正文最决定性的一句是 `Lab sessions no longer expose navigator.modelContextTesting`（我的翻译：Lab 会话不再暴露它）。

草案这一周只换了日期戳，状态仍是草案。它的 IDL 只挂一处：`partial interface Document`，带 `SecureContext`。

## 已确认的，和还没确认的

规格书里根本没有第二个名字。

我把那份草案剥掉标签做成纯文本数过：`modelContext` 出现 25 次，`navigator.modelContext` 和 `modelContextTesting` 都是 0 次。后者从来没进过标准，它只是 Chrome 实验实现里的一个测试入口，现在被实现方自己撤掉了。

对不上的一处：Cloudflare 让读者用 `--category-experimental-webmcp` 启动 Chrome DevTools MCP。这个开关在上游主分支的 README 和 `docs/cli.md` 里各出现 0 次，我只在源码里找到它。

CDP 那个 `WebMCP` domain 我一次都没调过。上游最新 1.10.1 是 9 月 23 日发的，dist-tag 只有 `latest`。

## 对谁有什么影响

三类人要动的东西不一样。

跑 Lab 会话自动化的人：脚本里取 `navigator.modelContextTesting` 的分支，9 月 28 日之后拿到的是 undefined。它不会抛错，因为名字是被「不再暴露」掉的，不是改了名。

写页面的人：官方 hotel-chain demo 打包后的 JS 我整份下下来数过，`document.modelContext` 出现 3 次，另外两个名字 0 次。它自己还要轮询，压缩代码里有一段 `setInterval` 最多重试 20 次才注册工具。一次同步判断会在慢的那几毫秒里判成不支持。

![三枚挂钩钉在同一面墙上，只有中间那枚还连着电线，左右两枚的线头断着垂在下面](/assets/img/webmcp-modelcontext-mount/02-comparison-mounts.webp)

想上线的人：Cloudflare 在功能页里写明生产负载留在标准池的稳定版 Chrome，Lab 池只是提前测新特性用的。

## 我实测到的

五种启动方式，`navigator` 那两个全空。

本机 Chrome 153.0.8010.53，headless 探针只读挂载点。不加 flag 时 `document.modelContext` 是 undefined，加上 `--enable-features=WebMCP` 之后变成 object。只开 `WebMCPTesting`、两个一起开，读数一样。

乱写的开关名那次也回落到 undefined，探针没在自欺。

`registerTool` 我调成了，返回 Promise。原型链上有 `getTools`、`executeTool`、`ontoolchange`，没有 `listTools`。MCP 那边叫 `list_webmcp_tools`，页面这边叫 `getTools`。

Lab 会话没测。没账号。

## 接下来盯什么，我的判断

我盯一个会自己长出来的信号。

我不把页面工具注册当渐进增强：挂载点要等，稳定版不开 flag 就不出现。草案末尾把 Test Suite 指向 wpt.fyi，我两次都没连上，那里有没有结果我说不上。

**如果 10 月底 `chrome-devtools-mcp` 的文档里 webmcp 还是 0 次，我就不把它写进团队上手文档。** 我要从 6 月那篇删掉的是这段：`document.modelContext || navigator.modelContext`
