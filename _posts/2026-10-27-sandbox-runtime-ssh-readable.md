---
layout: post
title: README 四条示例我逐字跑了：两条成立，两条不成立
subtitle: srt 默认读全放、写全拦，~/.ssh/id_rsa 在沙箱里 open() 得动
seo_short_title: srt 默认配置下 ~/.ssh 可读
seo_description: 逐字复现 anthropics/sandbox-runtime 的 README 示例：curl anthropic.com 在沙箱内被自家代理拦成 403、沙箱外是 301，cat ~/.ssh/id_rsa 真实读取成功；写侧三条路径全被拒。
date: 2026-10-27
categories: [AI, 开源实测]
tags: AI 开源 Node 前端 安全
tldr: "逐字复现 anthropics/sandbox-runtime 的 README 四条示例（v0.0.81，本机没有 ~/.srt-settings.json，走内置默认）：`curl example.com` 确实被拦、`cat README.md` 确实能读，这两条成立；不成立的两条是沙箱内 `curl anthropic.com` 实际拿到 403 而 README 写的是请求成功，`cat ~/.ssh/id_rsa` 实际 READ-OK 而 README 那一条写的是 Operation not permitted。11 项探针的分布很干净：读全放行、写全拒，域名解析直接被切成 gaierror，IP 字面量走同一条判决。所以把它当成默认只锁写的沙箱，凭据目录自己写进 denyRead 再验一次——`test -r` 量的是权限位，判可读性得用真正的 open()。"
---

# README 四条示例我逐字跑了：两条成立，两条不成立

> 一句话结论：`srt` 装完直接跑，README 顶部四条示例有两条不成立，读侧默认比示例宽得多。
> 现在该做什么：把它当成默认只锁写的沙箱，凭据目录自己写进 `denyRead` 再验一次。

## curl anthropic.com 在沙箱里拿到 403

`npm i @anthropic-ai/sandbox-runtime` 十六秒装完。

`npx srt --version` 给 `0.0.81`，本机没有 `~/.srt-settings.json`，走内置默认。然后照 README 第 19 行那个代码块逐字跑。

成立的两条：`curl example.com` 确实被拦，`cat README.md` 确实能读当前目录。

不成立的两条：

```text
沙箱内 curl anthropic.com (GET) → 403 Connection blocked by…
沙箱外 同一条命令(对照)         → 301
沙箱内 cat ~/.ssh/id_rsa        → READ-OK
沙箱外 同一路径(对照)           → READ-OK
```

README 写的是 `<html>...</html> # Request succeeds`，另一条写 `Operation not permitted`。前者默认配置下拿不到，后者要你自己写 `denyRead: ["~/.ssh"]` 才会出现。

## 11 项探针的分布：读放行、写全拒

403 只是网络侧。文件侧我做了 11 项探针，分布很干净。

| 动作 | 默认结果 |
| --- | --- |
| 读 cwd 文件 | 放行 |
| 读 `$HOME` 自建文件 | 放行 |
| 读 `~/.ssh/id_rsa` | 放行 |
| 读 `/etc/hosts` | 放行 |
| 写 cwd 文件 | 被拒 |
| 写 `/tmp` | 被拒 |
| cwd 建子目录 | 被拒 |

这不是我推出来的规律，是它自己写的。README 第 41 行同一屏里，先说 `processes start with minimal access`，紧接着的能力清单又说读是 deny-then-allow、默认到处可读，写是 allow-only、默认处处拒绝。

两句话不矛盾。但印象是相反的。默认锁的是外联和落盘，不是你能看见什么。

## 域名解析被切，IP 字面量也走同一条判决

上一节的 403 是代理回的。网络这块才是我认为它做得硬的地方。

```text
沙箱内 gethostbyname('anthropic.com') → socket.gaierror [Errno 8]
沙箱外 同一条                          → 160.79.104.10
沙箱内 curl https://1.1.1.1/           → 403 host is not on the allow list
```

解析直接被切，进程只能把连接交给它那两个代理，代理再按 `allowedDomains` 判。IP 字面量走同一条判决，没因为不是域名就绕过去。

沙箱内 `env` 能看到 `http_proxy`、`NO_PROXY`、`GIT_CONFIG_PARAMETERS` 这些注入项（我只打变量名）。这解释了为什么 `git` 和 `curl` 在沙箱里被自然接管，不需要包装命令。

## 我的 test -r 和 curl -sI 都判错过东西

11 项探针里有两项是我自己测错的。

第一项：为了省时间，我把 README 的 `curl anthropic.com` 写成 `curl -sI`。HEAD 与 GET 响应不同，我差点把 `403 Forbidden` 当成代理的判决。逐字改回 GET、再在沙箱外跑同一条，才看清沙箱外是 `301`、沙箱内那个 403 的正文写着 `Connection blocked by network allowlist`。

第二项更要紧。我用 `test -r ~/.ssh/id_rsa` 判可读性，它返回可读——可 Seatbelt 是在真正 `open()` 时才拒绝，`test -r` 查的是权限位，量的是另一件事。换成 `cat` 到 `/dev/null`（内容丢弃）之后结论才站住：默认配置下这文件就是读得到。

两处都不是被测仓库的问题，是我的判据不对。测沙箱，量具错了会得出方向相反的结论。

## 1,288 行 README 与第 85 行的 denyRead

这个包的 README 有 156,873 字节。

1,288 行，第 9 行挂着 `research preview` 横幅。`denyRead` 第一次出现在第 85 行，`~/.srt-settings.json` 在第 80 行，`## Configuration` 一节要到第 407 行。

顶部那段 Basic Usage 是「配好之后长这样」，但它没在那一段说这件事。一个从上往下敲的人会以为 `~/.ssh` 默认就被保护了。我第一轮就是这么以为的。

公平地说它没说谎。能力清单那两句把默认模型写得很准。问题只有顺序：示例在前，口径在后。

## real-path 尾斜杠那条 PR 我下次先看

三件事会让我回头重测。

- 如果 `denyRead` 的默认在 `v0.0.81` 之后收进 `~/.ssh`，我就重跑这 11 项探针。
- 如果 Basic Usage 补一句「示例假设已有配置」，文档顺序这条就消失。
- 如果 `anthropics/sandbox-runtime#775` 合了，我重测路径规范化的边界。

符号链接那条路我没验到：测它的时候连 `ln -sf` 都被写策略拒了。

没跑到的写清楚。只测 macOS 默认配置，Linux 与 Windows 没测——包里注释自己承认 Linux 不能像 macOS 那样在内核按域名强制。配好 `denyRead` 与 `allowedDomains` 之后的矩阵没做，那测的是我的配置、不是它的默认。LD_PRELOAD、ptrace 这类逃逸我没试。

它是给 agent 用的研究预览。不是通用 OS 沙箱的替代品。

项目地址：[https://github.com/anthropics/sandbox-runtime](https://github.com/anthropics/sandbox-runtime)
