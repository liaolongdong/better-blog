---
layout: post
title: MXC 1.0 正式版：我这台 Intel Mac 装完跑不起来
subtitle: 微软 MXC 正式版给 agent 套沙箱，macOS 只发 Apple 芯片那份二进制
seo_short_title: MXC 1.0 与 Intel Mac
seo_description: 微软 MXC 1.0 正式版给 agent 套沙箱，但我这台 Intel Mac 装完 run 就报 mxc_ffi native library was not found：包里 bin/x64 没有 dylib，issue 571 已 not_planned。
date: 2026-10-11
categories: 开源实测
cover: /assets/img/mxc-v1-ga-intel-mac/banner.webp
tags: AI 沙箱 安全 开源
---

# MXC 1.0 正式版：我这台 Intel Mac 装完跑不起来

![微软 MXC 沙箱：Apple 芯片有二进制，Intel 芯片没有](/assets/img/mxc-v1-ga-intel-mac/banner.webp)

> 一句话结论：MXC 正式版给 agent 的出网和读写套闸门，macOS 只发 Apple 芯片那份。
> 现在该做什么：装完跑一条 ls 看 bin/x64 里有没有 dylib，没有就别排期。

## 发生了什么

10 月 7 日，微软把 MXC 标成了正式版。

它给模型输出和工具调用套一层进程沙箱，Rust、.NET、Node 三套 SDK。

[官方博客](https://blogs.windows.com/windowsdeveloper/2026-10-07/microsoft-execution-containers-policy-driven-containment-for-ai-agents/)署名的 CVP 是 Logan Iyer。博客列了一串采用者：Copilot、Codex、Replit，微软单方写的，我没核实。

仓库 10-11 读数：2633 星、MIT、Rust。

后端按平台分：Windows 是 ProcessContainer，Linux 是 Bubblewrap。macOS 只有 seatbelt 一档。

## 已确认的，和还没确认的

文档写着支持。包里没有。

[v1.0.0 的 README](https://github.com/microsoft/mxc/blob/v1.0.0/README.md) 把 macOS 的 ARM64 和 x64 并列在同一行，后端都写 seatbelt。同一个 tag 的构建命令只有 aarch64。

装到磁盘上更直接：`bin/arm64` 有 dylib 和 mxc-exec-mac，`bin/x64` 两个都没有。

[microsoft/mxc#571](https://github.com/microsoft/mxc/issues/571) 问的就是这件事，已关，理由写着 not_planned。维护者 8 月 13 日原话：

> We currently don't plan on supporting MacOS x64.

没确认的：我没有 Apple 芯片的机器，arm64 那条路只有包内产物撑着，不算实测。

## 对谁有什么影响

能不能跑，先看芯片。

- Intel Mac：文档有这一行，包里没有二进制
- Apple 芯片 Mac：装得上，出网只有开和关
- node 不到 24：安装只 warn，执行才炸
- Windows 独有：活动报告、Intune、Entra

seatbelt 只给你一根出网开关，没有按域名放行的原语。要按 host 放行，得自己挂 networkProxy——这条我只在文档里读到，Intel 机器上验不了。

活动报告也只有 Windows 有，博客写着它能列出 workload 试过哪些资源。所以同一份策略在三个平台拦得不一样，这句是我从文档表推的。

## 我实测到的

Intel Mac，node 22。

空目录里 `npm i @microsoft/mxc-sdk@1.0.0`，exit 0，只有一条 node 版本 warn。

getPlatformSupport() 说支持，run() 却炸在原生库：

```
MxcError: mxc_ffi native library was not found. Searched:
…/@microsoft/mxc-sdk/bin/x64/libmxc_ffi.dylib
```

路径我折了，原文五条。那个 true 是查表来的：注释写着 sandbox-exec 系统自带。

把 arm64 的 dylib 拷进 x64，报错变成 dlopen 的 incompatible architecture。have arm64、need x86_64。

缺口在架构，不在路径。

## 接下来盯什么，我的判断

我不觉得 1.x 会补上 x64 那份二进制。

#571 标成了 not_planned，想补包的 PR 关闭时 merged_at 是 null。如果明年这时 `bin/x64` 里出现 dylib，或者 dist-tag 多出 next、beta，我就把 MXC 接进插件的构建流程，在真机上跑一遍策略。在那之前，这台机器上它就是个装得动、跑不了的包。

项目地址：[https://github.com/microsoft/mxc](https://github.com/microsoft/mxc)
文档那一行和包里的文件对不上，这条差异我一条 ls 就能复现。
