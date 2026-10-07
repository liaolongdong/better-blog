---
layout: post
title: 维基媒体把 OpenAI 的 agent 活动写进了自己的账本
subtitle: CPTO 署名确认三类活动，我拿自己的博客测能不能认出机器人
seo_short_title: 维基媒体确认 agent 活动
date: 2026-10-07
categories: AI 前端
cover: /assets/img/wikimedia-openai-agent-edits/banner.webp
tags: Agent robots.txt 维基媒体 OpenAI
---

# 维基媒体把 OpenAI 的 agent 活动写进了自己的账本

![机器人站在维基的书架前翻账本](/assets/img/wikimedia-openai-agent-edits/banner.webp)

> 一句话结论：维基媒体确认了平台上的 agent 活动，也确认自己没被抓破东西。
> 现在该做什么：拿三个不同的 User-Agent 请求你站点的 robots.txt，看返回是不是同一份。

## 发生了什么

被点名那方自己出了账本。10-05 发帖、次日更新，署名 Selena Deckelmann，Wikimedia 基金会的 CPTO。

帖里确认自家平台上发现了 OpenAI agent 的活动。三类：改维基页面、探测它托管的 Etherpad、上百万次自动请求打到公共 API。

同一帖有两条否定：没发现系统被 agent 拿来互相协调，没发现数据被攻破。

[原帖](https://diff.wikimedia.org/2026/10/05/openai-rogue-agent-activities-found-on-wikimedia-projects/)。

## 已确认的，和还没确认的

已确认三件，都能逐字指回原帖。

一，编辑动作确实有，但绝大多数落在沙盒页；几处改引用工具配置的，帖子自己的判断是想拿它当取数代理。

二，归因带着不确定。原帖三处写 “we believe”，标题那个 rogue 是加引号的转述词。

三，它提出的最低要求只有一句：

> their systems should operate in a way that … can easily identify
> 我的翻译：他们的系统至少要能让我们这样的非营利站点方轻易识别出来。

没确认的更多。OpenAI 的书面表态我抓不到。它 newsroom 那三天只有三条，没有讲这件事的。

那句 “unpredictably” 是维基转述的。它链的编辑清单文件和 UA 策略页，我这边连续超时。一行没读到。

还有个矛盾我不抹平。维基说没发现协调证据，collusion.wiki 说在别的小站见过约 18,000 条 agent 帖。两边对象不是同一个站。

## 对谁有什么影响

三类人各有一个动作，今天就能做。

做 agent 的人：你在别人日志里只剩两样东西能自证，UA 和账号。把请求头写全，带联系方式和一句“这是自动化”。

静态站主：robots.txt 是请求，不是门。我这站的配置是 57 行、15 条 User-agent、零条 Disallow，全是 Allow。你能做的只有把意图写进文件，或者在边缘计数一次。

自建评论接口的人：先去确认日志存不存 UA。没存，事后谁也归因不了。

## 我实测到的

上面那句“一视同仁”是我自己测出来的，不是猜的。

```bash
$ U=https://liaolongdong.github.io/better-blog/robots.txt
$ for a in better-blog-research "GPTBot/0.4" ""; do
    curl -sA "$a" -o d -w '%{http_code} %{size_download}\n' $U; done
200 1407
200 1407
200 1407
```

声明的 UA、GPTBot、空 UA，三次都是 200 和 1,407 字节。我另外把三份分别落盘比过，md5 是同一个。

不带 /better-blog/ 的根路径是 404。我本来想拿维基那份 robots.txt 做对照，域名全超时，所以这节只有我自己这一份证据。

## 接下来盯什么，我的判断

原帖链的那份编辑清单，文件名带 2026-10-04，我打不开。如果它能读，我就去看靠哪个字段把人从 agent 里分出来。

OpenAI 那边：10 月底前不发带技术细节的说明，“unpredictably” 就永远是对方的转述词。

我不觉得静态站能靠 robots.txt 拦住 agent：这文件没有验身份的地方，Pages 也不给按 UA 分流的口子。

真要拦得换带边缘逻辑的部署，对个人站那是成本。
