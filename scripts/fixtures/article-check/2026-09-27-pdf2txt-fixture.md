---
layout: post
title: 一份 24 页的扫描件，它吐给我 8192 个字符
subtitle: 这类工具先把页数换算成 token，选型看这一步
seo_short_title: PDF 转文本工具实测
date: 2026-09-27
categories: AI 开源实测
cover: /assets/img/pdf2txt-fixture/cover.webp
tags: PDF 上下文 开源
---

# 一份 24 页的扫描件，它吐给我 8192 个字符

![一张纸被压进信封的线稿](/assets/img/pdf2txt-fixture/cover.webp)

> 一句话结论：这类工具的价值不在解析精度，在它先把多少页换算成了多少 token，选型该先看这一步。
> 现在该做什么：别拿官方样例试，拿你自己最脏的那份扫描件跑一次，量它吐进上下文的字符数再决定。

## 背景：它为什么出现

差别在输出对象。老牌 PDF 转文本工具给人读，排版得留；它给模型读，层级不能丢，排版可以丢。

我关注它是上周：[mmorett/pdf2txt](https://github.com/mmorett/pdf2txt) 的 star 数 18742，27 日下午抓的，比上期快照高一档。

## 它解决什么痛点

先看一页扫描件。我手上那份 24 页的，直接贴进对话要两万六千多字符，模型读到第 6 页就漏表格。

它压到 8192 个字符，漏读没了。代价是版式全丢，双栏合同的左右顺序会串行，这个洞我读第二遍才发现。

## 快速上手

```bash
pnpm add -D pdf2txt
npx pdf2txt scan.pdf --tokens 4000
```

装完就能跑。0.9 秒出结果，不用配 key。

有个坑：默认输出带页码行，一页一行，24 页多出 24 行噪声，得加 --no-pagenum 才是能直接喂的形态。

## 使用示例

真实输出，我截了开头：

```text
[heading] 三方服务协议
[table] 甲方 | 交付 | 2026-09-30
[p] 第 3 条 验收标准……
（中间 41 行同款条目已略）
```

> 我没测出来的那半：它没写多文件并发，我拿 300 页合并件试过，直接 OOM，退码 137。

同类里 prompt 最长的那家 2614 字符，它只占 412。

## 和同类比：强在哪、差在哪

| 维度 | 它 | 老牌那家 |
| --- | --- | --- |
| 一次调用占的上下文 | 412 | 2614 |
| 表格还原 | 能对上 | 拆散 |
| 多文件 | 不支持 | 支持 |

我会留它，但不进 CI。理由：还在 0.x，issue 里 --pages 那个参数 [mmorett/pdf2txt#318](https://github.com/mmorett/pdf2txt/issues/318) 挂了两个月没定稿。

## 未来展望：什么条件下我会用它

条件很具体。如果 mmorett/pdf2txt 在 v1.0 之前把 --pages 定稿，我就把它换进日报流程。README 那条多文件的 TODO 也得从注释变成真命令。到 11 月底两样都没动，我就自己写个 60 行的包装，这事到此为止。

项目地址：[https://github.com/mmorett/pdf2txt](https://github.com/mmorett/pdf2txt)
