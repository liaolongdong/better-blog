---
layout: post
title: Haiku 5.5 降价 75% 之外，换模型 ID 不用升 SDK
subtitle: 模型 ID 在旧 SDK 就能原样发出，带类型的工具块要等新版。
seo_short_title: Claude Haiku 5.5 实测
seo_description: Anthropic 只把 model 字符串换成 claude-haiku-5-5，0.131.0 在 stub 上原样发出、回包照常解析。带类型的浏览器工具块才需升 0.132.0，旧版 import 报 TS2724。
date: 2026-10-09
categories: AI
cover: /assets/img/haiku-5-5-model-id-vs-sdk-typing/banner.webp
tags: Claude Anthropic TypeScript
---

# Haiku 5.5 降价 75% 之外，换模型 ID 不用升 SDK

![便宜模型换代与 SDK 类型的分工](/assets/img/haiku-5-5-model-id-vs-sdk-typing/banner.webp)

> 一句话结论：新版 SDK 补的是响应块的类型，模型 ID 在旧版就能原样发出。
> 现在该做什么：先只改 model 字符串跑一次，要带类型的浏览器工具块再升 SDK。

## 发生了什么

Anthropic 换代了它的便宜小模型。发布是 2026-10-07，公告一次改三件事。

新 Haiku 的定价、Sonnet 的 cache reads 减半、给 Max 和 Team 加的每月 API credits。

公告给开发者的那句写着 “computer use and browser use in beta”。npm 上 0.132.0 的发布时间比 HN 那条帖开帖晚十分钟。

[公告](https://www.anthropic.com/claude-haiku-5-5)。

## 已确认的，和还没确认的

单价降幅是写死的，省多少不是。

十万 token 以内的请求，输入输出都是上一代的十分之一。超过那档，公告的表里是输入 $0.50、输出 $2.50。

公告标题那句是 “On average, it now costs around 75% less to run.”。脚注 2 把它拆成 90% 和 50%，还算进了 tokenizer 换版——新版每件事用的 token 略多。

还没确认的是我自己的账。本机没有可用的 API key，同一段任务在新旧 tokenizer 下各花多少 token，我没测。

## 对谁有什么影响

只调 messages 的，今天就能改。

改法是把 model 字符串换掉，SDK 不动。可核对指标是你自己请求的长度分布：十万 token 以内那档占旧 Haiku 请求的九成左右，落不进这档的只省一半。

![请求侧不用升 SDK、响应侧要等新版](/assets/img/haiku-5-5-model-id-vs-sdk-typing/01-comparison-sdk-typing.webp)

做 browser 或 computer use 的要等 SDK。请求侧那个工具配置名两版都有，缺的是响应侧的类型。

做整页 UI 生成的别把它当主力。jjcm 跑了 image 转 html 的对照，原话是 “It was not.”，他说它转头把活儿交给了更大的模型。

[他的评论](https://news.ycombinator.com/item?id=49996898)。

## 我实测到的

旧 SDK 把新 ID 原样发出去，也照样解析了回包。

我装的是 2026-09-30 发的那个旧版，baseURL 指到本机一个 stub。

```
request path: /v1/messages
user-agent: Anthropic/JS 0.131.0
model on the wire: claude-haiku-5-5
```

类型层同样放行：两个版本都接受乱写的 ID，因为 Model 的 union 尾巴接了 `(string & {})`。

三个对照都照报：数字、删必填、拼错字段名。

另一半才要等。同一个 import 在旧版报 TS2724。原文尾巴是 has no exported member named 'BetaBrowserToolUseBlock'。换新版是 0 error，旧版里它只是 `input: unknown`。

## 接下来盯什么，我的判断

我盯两处。

latest 那条 CHANGELOG 隔天就补了空 path 抛错。如果下个 patch 又动 tool_use 的判别方式，我就把插件里的 SDK 锁版本。

beta 标签如果在下个 minor 前摘不掉，我不把浏览器子任务放进主链路。

我不觉得它接得住整页 UI：复杂 UI 那条对照它自己就把活儿转走了。
