---
layout: post
title: 官方说 Anthropic key 默认就拦，我 48 个公开仓库里 45 个没开
subtitle: 两枚 Anthropic key 进默认名单，我 45 个仓没开那层开关
seo_short_title: Anthropic key 默认拦截的四个口径
seo_description: GitHub 把 anthropic_service_api_key 与 anthropic_user_api_key 放进 push protection 默认名单。我逐仓读了 48 个公开仓库，45 个的两枚状态都是 disabled。
date: 2026-10-14
categories: 开源实测
cover: /assets/img/anthropic-key-default-block-gap/banner.webp
tags: 安全 开源 仓库
---

# 官方说 Anthropic key 默认就拦，我 48 个公开仓库里 45 个没开

![左边那张深色文档卡不等于右边那块开关面板，面板 48 格里只亮 3 格](/assets/img/anthropic-key-default-block-gap/banner.webp)

> 一句话结论：这次进默认名单的是检测器，不是我这 48 个仓库的开关。
> 现在该做什么：跑一条 gh api 读你自己仓库那两枚 status，再决定要不要开。

## 发生了什么：10 月 13 日两枚 key 进名单

我今天要不要动我的东西，得先看这条发布落在哪一层。

它是 2026-10-13 的 Improvement，原文一句 `blocked with push protection by default`。表里两枚名字：`anthropic_service_api_key`、`anthropic_user_api_key`。

范围那半句是 `including free public repositories`，前提写在它前面。

![官方那条发布里讲默认拦的那段原文，含两枚类型名](/assets/img/anthropic-key-default-block-gap/01-screenshot-changelog-push-protection-defaults.webp)

它只说了名单，没说这层开关在我这种仓库上开没开。

## 已确认的：三句原文拼不到同一层

那枚开关的默认态，官方给了三句，不指向同一个。

[push protection 概念页](https://docs.github.com/en/code-security/concepts/secret-security/push-protection)写仓库级 `Is disabled by default`，并要求 GitHub Secret Protection 先开；同页写账号级 `Is enabled by default`。

[扫描概念页](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning)只说公开仓库 `Secret scanning runs automatically for free`。

拼起来：默认拦的是检测器，不是仓库级那枚开关。

没确认的：全页搜 Enterprise Server 命中 0，GHES 哪版带上它没写。

## 对谁有什么影响：先读 status 再决定开

GHES 那一档轮不到我，三类人的动作不一样。

### 用 Claude API 的人

先扫有没有要撤的 key。我用 `git log --all -p` 配 `sk-ant-` 这个形状，命中 0 行就说明这次名单跟你无关。

我这四个仓 2425 枚提交里命中 0 行，也没有 `.env` 被跟踪。

### 只管公开仓库的人

一条命令读那两枚 status，读出来是 disabled 就没落到你这层。

```bash
gh api /repos/liaolongdong/better-blog --jq .security_and_analysis
```

### 企业版管理员

仓库级那份要求 GitHub Secret Protection。你那边的默认态和我不是一个口径，别拿这篇当你的结论。

我落在第二种：48 个公开仓库都在免费计划那一档，45 个读成 disabled。

## 我实测到的：四个口径只活下来一个

45 个 disabled 这个读数，是四个口径里活下来的那个。

![文档表左半：Anthropic 五行 Push protection 全是勾](/assets/img/anthropic-key-default-block-gap/02-screenshot-docs-anthropic-rows.webp)

那张 supported patterns 表里，Anthropic 五行 Push protection 全是勾。它没有「默认」那一列。

`secret_type` 过滤器我拿四枚真名加一枚编的各跑一次。五次全空。

alerts 端点回 404，message 是 `Secret scanning is disabled on this repository.`

剩下逐仓 GET 才有用：56 个仓库里 48 个公开，45 个两枚 status 都 disabled，开着 3 个。

## 接下来盯什么：那 45 个仓我暂时不动

那 45 个仓我今天不动。

他们说公开仓库 [`Secret scanning runs automatically for free`](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning)。

我这条是 45 个仓读成 disabled。

这一版是 10 月 13 日抓的。如果这枚字段只反映告警、不反映拦截，我这条就塌。

GHES 落点哪天进 changelog，我补一段。
