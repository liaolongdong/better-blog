---
layout: post
title: 别再问 Actions 的失败数怎么数了，2500 是哨兵不是答案
subtitle: 接口交回来的是个整数哨兵，也没有截断标记；把日期窗口拆开再相加，2758 才是我量到的下界
seo_short_title: GitHub Actions 计数改成 2500 封顶实测
date: 2026-09-26
categories: [AI, 开源实测]
cover: /assets/img/github-actions-2500-cap/banner.webp
tags: github AI 开源
---

# 别再问 Actions 的失败数怎么数了，2500 是哨兵不是答案

![两条并排的计数管道，左边那条通到底、脚下一块断成两截的门槛石；右边那条在半路落下卷帘，卷帘下还漏出没数完的队伍](/assets/img/github-actions-2500-cap/banner.webp)

<style>
  .cap-hl { background: #fbf3e7; border-left: 4px solid #b45309; padding: 12px 16px; margin: 18px 0; }
</style>

> 一句话结论：过滤后的 total_count 停在 2500，它不是你的真实条数。
> 现在该做什么：日期区间写成 created=A..B，分段数完相加。

## 墙没拆，只是换了个数

公告动的是带过滤那条路，没过滤的查询照旧撞四万。`microsoft/vscode` 的 runs 接口，我 09-26 14:22 UTC 什么都不带、只给 `per_page=1`。`total_count` 回 40000。

顺着往前翻，`page=40000` 还有货，`page=40001` 直接 422。原文没改字，只在 message 的逗号处折了一行：

```text
{
  "message": "In order to keep the API fast for everyone,
    pagination is limited for this resource.",
  "status": "422"
}
```

紧接着再问一次，只多挂一个 `status=failure`，计数就成了 2500。这是 changelog 那条公告改的东西，发布时间 09-25 18:17 UTC。它自己的说法是 “a less precise but more accurate count”。

有件事公告没说清。`"2,500+"` 那个带加号的写法只活在公告文本里，交付到 API 侧的是一个整数 `2500`。我在公告 HTML 里数过：`2,500` 出现 4 次，`2500` 出现 0 次。

![同一间接口的两条走廊：左边那条长到尽头、地上横着一块断开的门槛石；右边那条半途落下卷帘，帘下还漏出没数完的队伍](/assets/img/github-actions-2500-cap/01-two-ceilings.webp)

这条分岔值得单独记一句：同一条 URL，过滤条件的有无决定了撞哪一面墙。

## API 那个数没有标记位

五份响应我都只拿到两个顶层键。被截没截，程序判断不了：`total_count` 和 `workflow_runs`，没别的东西，没有 `is_capped`，也没有布尔位。而且它是 number，不是字符串。

越界那一格更别扭。`page=1001` 还是 HTTP 200，`workflow_runs` 空着，`total_count` 归 0。Content-Length 是 50，它和 `per_page=100` 下 page=11 那份完全相同，ETag 也是同一个。

说白了，翻过 1000 条和压根没命中，在协议层是同一个响应：不报错，给你个空数组。

能取到的条数确实断在 1000。`per_page=1` 时 page=1000 有货、1001 空；换 `per_page=100` 是 page=10 有货、page=11 空。算的是条数，和公告那句 `up to 1,000 items` 对得上。

<div class="cap-hl">
<p><strong>最阴的一处是分页头还按 2500 指路。</strong>rel="last" 依旧指向 page=2500，换成 per_page=100 就指到 page=25。照着它写循环的脚本会连拿 15 个空页，一声不响。</p>
</div>

我起了个临时目录装真库复现。`@octokit/rest` 22.0.1 配 paginate-rest 14.0.0。paginate 老实给了 1000 条，`total_count` 一路都是 2500。你手里那 1000 条和屏幕上那个数，谁都不是真值。三行输出逐字如下：

```text
page1: http=200 total_count=2500 items=100
paginate: length=1000 elapsed=62.9s
page11: http=200 total_count=0 items=0
```

## 拆成两段才知道差多少

同一个过滤，拆窗口加回来是 2758。条件不变，还是那个仓库的 `status=failure`，我只把日期切成两段分别问。`created=2026-09-01..2026-09-15`，报 1884。`created=2026-09-15..2026-09-26`，报 1036。

1884 + 1036 − 162 = 2758，比报出来的 2500 多出 258 条。那 162 是重叠的 09-15 单独问出来的。这只是下界，窗口往前拉只会更多。

![一条日历长条被两把尺子分段压住，每段下面各堆一摞箱子；两段中间重叠的那一天被一只手揭起来，准备从总数里扣掉](/assets/img/github-actions-2500-cap/02-split-and-add.webp)

公告给的解法是这一句，我截的是后半段：

> …narrow your filters (e.g., by adding a date range)

我实测只兑现了一种写法。`created` 有三种进 URL 的形状，第三种是把两个边界重复传：

- `created=2026-09-01..2026-09-15`：这一种有效，9 组窗口挨个试下来组组可加。
- `created=>A <B`，Actions 页面那种空格写法：上界静默丢失。
- 重复参数：下界丢。

三条路返回的都是 200，body 结构一模一样。错的写法不会说它少过滤了一段，只给你一个看起来合法的数。

### 接下来盯什么

三处基线先记下。docs 那页全文里 `2,500` 是 0 次。changelog 没有一句讲截断标记，cli/cli 近三天更新的 34 条 issue 里 7 个关键词命中 0。

- 盯 `docs.github.com` 那页 REST 文档全文，看 2500 哪天被写进去。
- 盯 changelog 有没有补一句截断标记。
- 盯 cli/cli 的第一条踩坑帖。
- 盯 archive.org 哪天补上 09-25 之前的快照。

## 「我量不到的三处」

该量的三条线，我一条都没量完。Actions 页面那一侧，`is:breaking created:>=2026-09-01` 的 HTML 我抓回来了。里面 `2,500`、`2500`、`1,000` 三个串，全是 0。headless 打开它两次都超 120 秒没渲染完，我把它 kill 了。“UI 显示成什么”我没有一手证据。

企业版：公告写着同时上 github.com 和 GitHub Enterprise Cloud，我没有 GHEC 实例，那条路径 0 次。认证态：这 31 次探测全在无 token 下跑，`X-RateLimit-Limit` 一直是 60。带认证会不会另一套计数？我没测。公告前的对照也没做成，archive.org 两次都在 45 秒处超时。

还有一处矛盾我留着。`modelcontextprotocol/registry` 的 `branch=main`，从年初问到 9 月 26 日报 2500。同一分支只问 9 月那 26 天，是 299。这一格是哨兵还是恰好 2500 条，我没能证出来，也不打算替它挑一个。

上期那笔账也顺手结了：v2.1.283 发布于 09-25 21:50 UTC，94 条 bullet，逐条 grep `AGENTS.md`，命中 0。这条规则今天立：release note 里 grep 不到的修复，按没发生处理。下期要做的也在这：拿带 token 的身份把这 31 条重跑一遍，如果认证态也报 2500，锅就不在缓存那一层。
