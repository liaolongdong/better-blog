---
layout: post
title: livenerf 的 30 天基线跑到第 6 天，它的锁校验是红的
subtitle: 设计参数我能从仓库重算，声称的日更曲线一条都看不到
seo_short_title: livenerf 面板锁与面板不一致
date: 2026-09-30
categories: AI
cover: /assets/img/livenerf-panel-lock-mismatch/banner.webp
tags: livenerf Claude 评测
---

# livenerf 的 30 天基线跑到第 6 天，它的锁校验是红的

![三把挂锁钉在同一块评测面板上，只有中间那把扣住，左右两把的锁舌悬着](/assets/img/livenerf-panel-lock-mismatch/banner.webp)

> 一句话结论：它的设计数字我能从仓库重算，它声称的 6 天日更我一条都看不到。
> 现在该做什么：引用漂移数字前，先问这数字能从哪个文件算出来。

## 发生了什么

livenerf 是块仪表盘，量的是模型发布之后有没有变笨。

它让 78 道题每天各跑一遍，盯准确率和中位输出 token 两条曲线。9 月 22 日建仓，基线 9 月 24 日 22:10 UTC 起跑。[README](https://raw.githubusercontent.com/ninjahawk/livenerf/main/README.md) 里 9 月 29 日那行进度写的是 `6 of 30 days collected`。

我的翻译：30 天收了 6 天，一次没漏。

## 已确认的，和还没确认的

设计那一头对得上。

它招牌上那个探测极限——一个 10 天窗口测得出 7.51 点——我用仓库里两个文件就重算出来了。面板存着每题的确认通过率，套 `design.py` 那条公式，p 要做 `(s+1)/(n+2)` 平滑。

对不上的是冻结这一头。

[预注册](https://raw.githubusercontent.com/ninjahawk/livenerf/main/PREREGISTRATION.md)写明 `refuses to run if the panel no longer matches the lock`。我的翻译：面板和锁不再匹配，日更就拒绝执行。

可我 clone 到的 HEAD 上，锁里记的摘要与面板文件的摘要不等。在把它冻结的那次提交上就已经不等。「6 天、一次没漏」这条从 clone 核对不了：日更状态写在 `logs/daily.jsonl`，而 `logs/` 被 ignore。

## 对谁有什么影响

三类人各有一件具体的事可做。

引用这类数字的人：只看一步——这个数能不能指到仓库里的某个文件。上面那个 7.51 能，日更曲线不能。

自己搭日更评测的人：把校验写进 CI，别只写进运行器。[ci.yml](https://raw.githubusercontent.com/ninjahawk/livenerf/main/.github/workflows/ci.yml) 一共三步：装依赖、跑 pytest、比对导出的公开面板。没有一步碰锁。

测试里那条锁用例是在临时目录自建面板再锁。它证明函数可用，不证明仓库里这对文件一致。

用 `claude -p` 跑脚本的人：把 `claude --version` 钉进文件，关掉自动更新。它每天第一道门就是这个 pin，我这台机器过不了。

![左边一台机器的齿轮里卡着一把上了锁的挂锁，右边流水线的四个工位上都没有那把锁](/assets/img/livenerf-panel-lock-mismatch/02-comparison-gates.webp)

## 我实测到的

跑它自带的 preflight，零模型调用。三条全红。

```
[FAIL] CLI matches the pin  ('2.1.145' vs pinned '2.1.280')
[FAIL] usage meter readable  (None)
[FAIL] panel frozen and unchanged  (76f2bfa6… vs 487c65e1…)
NOT READY: 3 check(s) failing
```

第一行原文有 `(Claude Code)` 后缀，摘要只留前八位。

锁那条我复核了三遍。工作树摘要与 git 里 blob 的摘要相同，排除换行归一化。把面板的创建时间戳换成 9 月 24 日全天八万六千个秒值重算，零命中。

仓库那 8 个 `.eval` 我解开了。40 条样本全是 9 月 22 日的 pilot，35 条评分全为 1。没有一条是序列样本。

## 接下来盯什么，我的判断

我盯一个会自己动的信号：README 那行进度每天在改。

我不觉得这个量能回答有没有换模型。同族换一次是 −3.8 ± 6.3 点。A/A 自身抖动 +6.4 ± 3.6，跟那个探测极限同一个量级。测不出不等于没发生。

**如果 10 月 24 日第一个判决窗口之前，锁校验没进 CI、日更状态没进仓库，我就只引用它的设计口径。**

项目地址：[https://github.com/ninjahawk/livenerf](https://github.com/ninjahawk/livenerf)
