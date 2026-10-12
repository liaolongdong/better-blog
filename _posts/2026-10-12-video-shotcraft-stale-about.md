---
layout: post
title: 仓库里 124 张镜头卡，GitHub 简介写 152：那行字不在 git 里
subtitle: 磁盘、README、线上 json 三处都是 124，网页右侧那行停在 152
seo_short_title: GitHub 仓库简介与 git 内容对不上
seo_description: video-shotcraft 的 GitHub 简介写着 152 张镜头卡，README、SKILL.md、磁盘文件和线上 library.json 全是 124。那行简介存在仓库外，四条 CI job 谁也够不着它。
date: 2026-10-12
categories: 开源实测
cover: /assets/img/video-shotcraft-stale-about/banner.webp
tags: 开源 Agent 仓库 评测
---

# 仓库里 124 张镜头卡，GitHub 简介写 152：那行字不在 git 里

![两张账本，一本改过、一本没动，中间的连接线断了](/assets/img/video-shotcraft-stale-about/banner.webp)

> 一句话结论：改的是仓库里的文件，没改的是仓库外那一行，两者不同步没人拦。
> 现在该做什么：把自己仓库那行 About 和 README 第一段比一次数。

## 背景：它为什么出现

它是一个给 AI 用的视频镜头库。

它 7 月 19 日开的源，star 11437，抓于 10-12 14:37 UTC。`template/package.json` 写 version 1.0.0、remotion 4.0.484。安装不靠它自己发 npm 包，靠 `skills` 那个 CLI，1.7.2。

我 clone 下来数卡片，磁盘上是 124 张；GitHub 页面右侧那行简介写着 152。

## 它解决什么痛点

一张镜头卡就是一份 markdown。

它写清这个镜头什么时候用、多少帧、什么缓动、哪里会翻车。以前让 AI 出一支产品宣传片，你得自己把「标题逐字进场」翻成 Remotion 的插值和 `spring` 参数。现在这层翻译有 124 张现成的卡可抄，另带一份验证过的 template 和音画素材。

痛点不在格式，在对外那几个数由谁守着。

## 快速上手

装这些卡只要一行命令，首跑就红了。

```
$ npx skills add Vincentwei1021/video-shotcraft
■ Failed to clone repository
$ export https_proxy=http://127.0.0.1:65532
$ npx skills add Vincentwei1021/video-shotcraft
```

git 报的是 HTTP/2 流被掐断：本机直连 github.com 不通，不是这个 skill 的缺陷。挂了代理那一次跑了五分十六秒，卡片落进 `.agents/skills/`。

![73 个 agent 分成通用目录与软链两类](/assets/img/video-shotcraft-stale-about/02-screenshot-install-output.webp)

`template/` 里再 `npm install`，185 个包 32 秒。

## 使用示例

装完那份副本里，卡片还是 124 张，四处都对得上。

```
$ grep -n "124 shot recipe cards" README.md
38:- **124 shot recipe cards, 150 tuned shots.**
$ grep -rn "152 shot" --include="*.md" .
$ echo $?
1
```

查不到。

磁盘 `find` 出来 124，线上 `library.json` 里 cardCount 124、styleCount 150。README_CN.md:59 也写 124 张卡。

![四行读数：网页 152，磁盘 124，grep 无命中](/assets/img/video-shotcraft-stale-about/01-screenshot-count-check.webp)

只有 GitHub 那行简介停在 152/209。它是 `repo.description`，存在 GitHub 侧，git 里没有任何文件装着它。

## 和同类比：强在哪、差在哪

仓库自己的 CI 有四个 job，白名单不收这一行。

`pr-checks.yml` 的 `on.pull_request.paths` 收了 `references/shots/**`、`demos/**`、`template/src/**`，没收 `README.md`、`README_CN.md`、`SKILL.md`。verify 那个 job 的注释里就写着它防的是哪种错：加了卡，忘了提交副本。

所以这不是闸门漏放，是它够不着。要校那行简介，得有人在仓库设置里挂一个跑 API 的定时任务。

我的栈里没有这一格：wxt + Vue 3 走 pnpm，上架交给 Chrome Web Store 审核。那份 `manifest.json` 在 git 里，所以 CI 校得到它。

差在哪看 Vincentwei1021/video-shotcraft#49。一支 2424 帧的宣传片，只有约 69 到 100 帧有局部问题。改一处，整条还得重渲一遍。

维护者 8 月说后续出一个编辑器，9 月回了 yes。那张 PR，在我拉到的 20 条里没有。

## 未来展望：什么条件下我会用它

PR 没有，tag 也没有。

`git tag` 数出来是 0，装的就是最新那个 commit。如果 #49 那条整帧重渲在编辑器做出来之前没解决，我就不拿它做一分钟以上的片子。

计数这一半我没验到：简介什么时候改的，GitHub 不暴露，我只能从 9 月 1 日那两个 PR 反推。

项目地址：[https://github.com/Vincentwei1021/video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft)
那行字改起来只有三次点击，所以它最容易忘。
