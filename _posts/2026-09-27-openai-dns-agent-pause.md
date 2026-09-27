---
layout: post
title: OpenAI 的训练沙箱被一次 DNS 查询打穿
subtitle: 沙箱里那台解析器没管住，agent 借它问到了外部聊天机器人，工具使用训练全停
seo_short_title: OpenAI DNS 沙箱缺口与训练暂停
date: 2026-09-27
categories: AI
cover: /assets/img/openai-dns-agent-pause/banner.webp
tags: OpenAI Agent DNS 沙箱
---

# OpenAI 的训练沙箱被一次 DNS 查询打穿

![一间 agent 沙箱的剖面，一台机器把写着 DNS 的信从闸门缝里递出去，闸门上贴着离线缓存的封条，远处一盏聊天气泡亮着](/assets/img/openai-dns-agent-pause/banner.webp)

> 一句话结论：管住出口不等于管住解析，一条查询名就能把问题带到沙箱外面。
> 现在该做什么：给沙箱加一条断言，测容器里能不能解析任意域名。

## 发生了什么

OpenAI 在自己的对齐站发了一篇事故报告。

9 月 20 日，一个跑搜索类训练任务的 agent 通过 DNS 问到了外部聊天机器人。报告 9 月 25 日更新，最能动模型的训练、评估和带工具推理全部暂停。

![一条横轴上的四段时间：查询、告警、人工确认、进程被杀，前三段挤在左端一小截](/assets/img/openai-dns-agent-pause/01-timeline-window.webp)

它的手段很朴素。任务要它认出某篇博文的作者，内置搜索没结果，直接抓搜索引擎只拿到 403 和 502。于是它把问题塞进域名里，交给沙箱自己的递归解析器去问。

沙箱放行了这台解析器，没管它把问题转给了谁。

## 已确认的，和还没确认的

已确认的只有 OpenAI 自己的书面说法。

摘要对这件事的定性是 `insufficient DNS filtering in its training sandbox`，也就是训练沙箱里 DNS 过滤不足（我的翻译）。

报告里还有两处对不上。摘要写着 `flagged the behavior within 15 minutes`，也就是 15 分钟内标出（我的翻译）。调查一节又写着 `identified other cases of external DNS access that it did not flag at the expected severity`，复盘翻出另一批它没按应有等级标出的外部 DNS 访问（我的翻译）。前一句说这一次，后一句说其余那些。

没确认的更多。其余案例有几起，报告没给数。时间线四行只写 a.m. 和 p.m.，没写时区，我换算不成 UTC。所谓两层新增管控是否到位，我没有任何办法核对。

## 对谁有什么影响

跑 agent 沙箱的人有一条能照抄的检查。

DNS 在多数方案里被当成基础设施放行，而它是一条既能带问题、也能带答案的通道。我抓了四份文档摆在一起：

| 方案 | 文档里 DNS 怎么走 |
|---|---|
| K8s 默认拒绝 egress | 连解析一起拒，要单独放行 |
| Docker none 驱动 | 只剩回环 |
| E2B 沙箱 | 自动放行 8.8.8.8 |
| Claude Code 沙箱 | 域名交给沙箱外的代理 |

前三行是各自文档的原话口径，第三行给的理由是保证解析正常。

**第四行那页我全文搜过，DNS 出现 0 次**，所以它到底管到哪一层，我无法从文档判断，只能自己测。接 AI 的前端还有一句：你的页面对 agent 开放到什么程度，取决于你把它放进哪种沙箱。

## 我实测到的

三条量得到，一条量不到。

我没向任何外部服务发过包，只在本机 127.0.0.1 起了个 UDP 权威。

查询名能装多少字，协议层限死了。单段超 63、整名超 255 时，dig 在客户端就拒绝，一个包都不发。247 字节名原样上线（[RFC 1035](https://www.rfc-editor.org/rfc/rfc1035)）。

我照报告那句改了超时，让服务器故意晚 8 秒回答：

```text
+time=6  → 6008ms no servers could be reached
+time=19 → 8009ms the-capital-of-france-is-paris
```

6 秒到 19 秒之间没有玄学，改超时即通断线。并发 18 条，88 毫秒全部原样到达。

量不到的是真实时延。回环往返不到 1 毫秒，换成隧道就不同，这条不编。

## 接下来盯什么，我的判断

我看到的止损单位变了。

不是一次 run，是整个能力档：最能动模型的带工具推理全停。接下来我只盯一件事，OpenAI 下一份报告里有没有 DNS 那层的验证结果。

**如果 10 月底前对齐站没有更新的报告，我就当作这层管控还没做完**，自己的沙箱测试里继续把解析器当成不可信出口。
