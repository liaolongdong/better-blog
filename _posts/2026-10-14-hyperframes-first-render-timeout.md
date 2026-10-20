---
layout: post
title: 第一次 render 红在 41 秒，第二次什么都不改 85 秒绿
subtitle: 报错让我换一枚适配这台机器的 Chrome，可它只是第一次执行要 8.66 秒
seo_short_title: hyperframes 首跑 render 超时实测
seo_description: hyperframes 第一条 render 在我机器上 41.44 秒后退出码 1，报错说 Chrome 不适配架构。手跑探活命令 8.66 秒返回版本号，源码门限 5000 毫秒；不改再跑 85 秒就绿。
date: 2026-10-14
categories: 开源实测
cover: /assets/img/hyperframes-first-render-timeout/banner.webp
tags: 开源 仓库 工具 Puppeteer
tldr: '报错指着架构，真凶是那 5 秒：第一条 render 跑 41.44 秒退出码 1，我原样手跑它失败的那句探活命令，第一次要 8.66 秒、第二次 0.10 秒，而 preflight.ts 里 timeoutMs 写死 5000、不重试也不可配；什么都不改再跑一次 85 秒就绿，两次出的 mp4 md5 相同。'
faq:
  - q: 'hyperframes 报 Chrome 不适配这台机器的架构，要换 Chrome 吗？'
    a: '别先换，原样手跑它失败的那条命令。我这边 file 与 uname -m 同为 x86_64、xattr -l 只有一条记录，架构和隔离属性都能当场划掉。真卡住的是缓存目录里那枚 chrome-headless-shell：它的 --version 第一次执行要 8.66 秒才吐出 Google Chrome for Testing 152.0.7977.30、退出码 0，第二次只要 0.10 秒，而探活门限写死 5000 毫秒。'
  - q: '两条出路渲出来的片子是同一份吗？'
    a: '是。照报错那句设 HYPERFRAMES_BROWSER_PATH 指系统 Chrome，83 秒绿；什么都不改、再跑一次，85 秒绿。两份 mp4 的 md5 都是 c08c32e48b4d20df720df4fbfdfb0324。第一次红的时候 renders/ 是空的，失败不吐半成品；再用 npx hyperframes browser clear 清掉缓存还能让它红一次，那一趟 28 秒。'
  - q: 'doctor 里 Chrome 那行写 system 是什么意思？'
    a: '它不等于 render 用的就是系统 Chrome，我把这行读错了。真跑用的是缓存目录里的 chrome-headless-shell，报错里那条路径才对得上。安装和依赖这一层没问题：npm i hyperframes 输出 added 77 packages in 9s、退出码 0，系统 ffmpeg 我那台是 9.0.1，ffmpeg 用的就是系统的。'
---

# 第一次 render 红在 41 秒，第二次什么都不改 85 秒绿

![长条冲过虚线门限，越过去的尖端是红的](/assets/img/hyperframes-first-render-timeout/banner.webp)

> 一句话结论：报错叫我换 Chrome，可那枚 Chrome 只是第一次执行要 8.66 秒，而探活只等 5 秒。
> 现在该做什么：清掉缓存，手跑一次它的 `--version`，量你那台机器第一次要几秒。

## 背景：一条命令把 HTML 渲成 mp4

我是从 TypeScript 周榜第二那行数字过去跑它的。heygen-com/hyperframes 是 HeyGen 出的命令行，Apache-2.0。

2026-03-10 建仓，2026-10-13 22:04 抓到 star 62,689。npm 上 `0.8.154`，10-13 19:57 发布。

[上一周八十一万次下载](https://api.npmjs.org/downloads/point/last-week/hyperframes)，窗口 2026-10-06 到 10-12。我要验的是它那行描述：一条命令能不能真出一段 mp4。第一条就红，红在 41 秒，退出码 1。

## 它解决什么痛点：截三百张图再喂 ffmpeg

没有它，这条片子有两种做法。一种是把视频当成时间轴：起 headless 浏览器，推 300 步、截 300 张图、交给 ffmpeg 拼起来。hyperframes 干的就是这一步，它的 dependencies 里是 `puppeteer-core` 和 `@puppeteer/browsers`，ffmpeg 用系统的。

另一种是录屏：全屏录一遍，改一帧重录一次。这条路我这轮没量过，所以正文不比两者的耗时。

## 快速上手：第一条 render 就红

系统 ffmpeg 我那台早就有，`9.0.1`。装它只要 `npm i hyperframes`，输出 `added 77 packages in 9s`，退出码 0。

`npx hyperframes doctor` 给一排绿勾，Chrome 那行写的是 `system:`。我把这行读成它要用系统那枚 Chrome——错在这里。render 真正用的却是缓存目录里的 `chrome-headless-shell`，报错里那条路径才对得上。

![第一次 render 的终端输出，红在 Chrome cannot start](/assets/img/hyperframes-first-render-timeout/01-screenshot-first-render.webp)

第一条 `npx hyperframes render` 跑 41.44 秒，红，退出码 1。`renders/` 是空的，失败不吐半成品。

## 使用示例：清掉缓存，手跑那条探活命令

它失败的那条命令能原样手跑。先 `npx hyperframes browser clear` 清掉缓存，再 `browser ensure` 重新解压，然后单独跑它那句探活：

```
$ CH=<browser ensure 输出里 Path: 那一行的值>
$ /usr/bin/time -p perl -e 'alarm 30; exec @ARGV' "$CH" --version
Google Chrome for Testing 152.0.7977.30  real 8.66
$ /usr/bin/time -p "$CH" --version
```

第一次 8.66 秒、退出码 0，版本号照打；第二次 0.10 秒。套 `alarm 30` 只是怕它挂住终端。

出路两条我都跑了：照报错那句设 `HYPERFRAMES_BROWSER_PATH` 指系统 Chrome，83 秒绿；什么都不改、再跑一次，85 秒绿。

两份 mp4 的 md5 都是 `c08c32e48b4d20df720df4fbfdfb0324`。清掉缓存还能再红一次，那一趟 28 秒。

## 和同类比：报错怪架构，我怪时间

我的读法跟报错相反：架构没错，错的是那 5 秒。

逐字抄的：`Select a working Chrome/Chromium binary for this OS and architecture`（[preflight.ts](https://github.com/heygen-com/hyperframes/blob/401354cd8f685d9ec9011b41d2c4269289d29598/packages/cli/src/browser/preflight.ts)，10-14 抓）。

两条划掉：

- 架构装错：`file`、`uname -m` 同为 x86_64
- 隔离属性：`xattr -l` 只有一条记录

探活写死 `timeoutMs: 5000`，没有重试、也不可配。真启动给 180 秒。

要让它塌，冷缓存 CI 上那句 `--version` 得 5 秒内返回。

同类是 `@puppeteer/browsers`。我为什么还没换：博客是 Jekyll 建的，`pnpm build` 之后没一步要它。

## 未来展望：相邻那条已经改了文案

5 秒这个数会不会改，我没找到 ROADMAP。相邻那条改过文案：heygen-com/hyperframes#5394 把镜像构建超时报错说清是超时，10-13 合入。

赌注：若后面的版本既不加重试、也不给探活留可配门限，我不在冷缓存的容器里用它出片。Apple Silicon 与 Windows 上第一次执行要几秒，我一台都没量过。

项目地址：[https://github.com/heygen-com/hyperframes](https://github.com/heygen-com/hyperframes)

报错写得越肯定，越值得原样手跑它失败的那条命令。
