---
layout: post
title: 官方说每枚提交记了 pusher，我的 API 里没这个键
subtitle: 10 月 12 日灰度的 push attribution，我四个口径都没取到那枚身份
seo_short_title: push attribution 的四个口径实测
seo_description: GitHub 把 push attribution 放进 limited public preview，只对 Enterprise 客户开放。官方说每枚提交另记一枚已鉴权的 pusher，我在 REST、GraphQL、事件流和提交页面里都没取到。哪些仓库进了灰度，官方没写。
date: 2026-10-13
categories: 开源实测
cover: /assets/img/github-pusher-attribution/banner.webp
tags: 安全 开源 仓库
---

# 官方说每枚提交记了 pusher，我的 API 里没这个键

![左边深色卡里两条一样的锈色名字条，右边青绿槽里开关拨在关、下面那格是空的虚线](/assets/img/github-pusher-attribution/banner.webp)

> 一句话结论：GitHub 开始另记一枚已鉴权的 pusher，我四个口径都没取到。
> 现在该做什么：先答我今天要不要动我的东西，再去换你 CI 里认人的那行。

## 发生了什么：10 月 12 日进灰度，只给企业版

这条发布是 2026-10-12 来的，类型是 Release。它新增的是一枚 pusher 归属记录。

官方那页第一句说，每枚提交现在会持久记录真正推上去的那个已鉴权用户。这枚身份和 author、committer 并列出现在 UI 和 API 里。

同一页往下给了生效范围：limited public preview，只对 GitHub Enterprise 客户开放。

![官方页面顶部那两句，durable 记录与 Enterprise 灰度](/assets/img/github-pusher-attribution/01-screenshot-changelog-push-attribution.webp)

这次带来的不止一枚身份。还有一条新规则条件，名字逐字是 `Committer must match pusher`。

## 已确认的：那三句原文我逐字抄了

这条条件的理由，官方写得直白。

> Commit author and committer fields are just strings that the pushing client supplies, so anyone with write access to a repository can set them to any name and email they choose.

这句是原话，出处就是上面那条 [changelog](https://github.blog/changelog/2026-10-12-push-attribution-public-preview/)。

已确认的有三件：日期与类型，列表页那一行是 `Oct. 12` 加 `Release`；持久、逐枚记录这个说法本身；还有那条新条件的名字。

没确认的也钉在这里：哪些仓库进了灰度，官方没写；GHES 的支持时间，这条 changelog 没提。

## 对谁有什么影响：免费计划没有可开的开关

灰度只开给企业版，免费计划没有开关。

[那页 rulesets 文档](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)写明 push rulesets 归 GitHub Team 计划的 internal、private 仓库。

![文档页 Who can use this feature 那一格](/assets/img/github-pusher-attribution/02-screenshot-rulesets-team-plan.webp)

三类人动作不同：

- 用 author 字段认人的脚本：今天就能改，改法见下面命令。
- 做安全响应和取证的：这枚身份取不到，别写进清单。
- 企业版管理员：找你的 account team，那盏灯才可能亮。

我落在第一种：博客仓库是免费计划，没有开关可拨。

## 我实测到的：四个口径都没取到

那行按 author 认人的命令我本地跑了。

```bash
GIT_AUTHOR_NAME="Fake Maintainer" GIT_AUTHOR_EMAIL="fake@octocat.dev" \
GIT_COMMITTER_NAME="Fake Maintainer" git commit -q -m x
```

两个字段照样能写成 `Fake Maintainer <fake@octocat.dev>`。git 2.23.0 没拦。

另外四个都取不到。REST 未鉴权和带 token 各跑一次，commit 对象里没有 `pusher` 键。

GraphQL 问 `Commit` 要这枚字段。报错原文是 `Field 'pusher' doesn't exist on type 'Commit'`。

事件流 `PushEvent` 只剩五个键。提交页面 HTML 里 `pusher` 是 null。

## 接下来盯什么：哪些仓库亮灯我没来源

提交页面里那枚开关，在哪些仓库是 true，我没来源。

它叫 `showPusherAttribution`，我这枚提交里是 false。GitHub 自己仓库的那枚也是 false。

我今天不动我的东西：博客仓库在免费计划，没有开关可拨；CI 里那行按 author 认人的脚本是我写的，我也不拿它当证据。

两个锚。如果 REST 的 commit 返回键里出现 `pusher`，这篇的四个读数全废，我重写。

那条新条件要是进了文档的规则清单，我就不用猜计划档。
