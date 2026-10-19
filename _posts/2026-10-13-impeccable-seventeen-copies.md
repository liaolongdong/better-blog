---
layout: post
title: 设计检测器 impeccable 扫我的博客 CSS，报了 2 条
subtitle: 它真在我自己那本 CSS 里挑出两条，装的那一步却一个文件都没写进来
seo_short_title: impeccable 设计检测规则实测
seo_description: impeccable 把 AI 写前端的通病做成 59 条规则，Rust 引擎在改动后跑。装 4.5.2 时 install 失败；detect 扫线上 CSS 报 2 条，改名复扫排除误报。skill 有 17 份副本。
date: 2026-10-13
categories: 开源实测
cover: /assets/img/impeccable-seventeen-copies/banner.webp
tags: AI编程 开源 仓库 Impeccable
---

# 设计检测器 impeccable 扫我的博客 CSS，报了 2 条

![一摞纸绳子被剪断，道闸放着没抬，空文件夹留着虚线落位框](/assets/img/impeccable-seventeen-copies/banner.webp)

> 一句话结论：它把 AI 写页面的通病写成 59 条能跑的规则，装的那一步真没写文件。
> 现在该做什么：先拿它扫你自己的 CSS，再核一遍 exit code 是不是你要的那一档。

## 背景：开源十一个月，规则写成 59 条

它是给 AI 编程助手用的设计检测器。2025-11-16 开源，Apache-2.0，10-13 14:08 抓到 star 80,596。它管的是助手写出来那一层，不是你手写的组件库。

紫渐变、发光阴影、Inter 这些通病被写成 59 条规则，交给一个 Rust 引擎在文件改动之后跑。npm 包版本号 4.5.2，引擎二进制 0.1.14，两套号不同轨。这套规则逐条列在[官网规则页](https://impeccable.style/slop)。

## 它解决什么痛点：人眼扫 CSS 没有第二种做法

Rust 引擎之前，这活只有两种做法。第一种是 review 时人眼扫，同一份 CSS 十个人读出十种毛病。

第二种我自己天天在干：把版式偏好写成提示词，模型该用 Inter 还是用 Inter，全看它那天读没读到。提示词管不住已经生成出来的代码。

impeccable 换的是执行这一步：规则落在字符串和语法树上，同一份文件扫十次结果一样。规则数组的源码是 [registry.rs](https://github.com/pbakaus/impeccable/blob/245ad82def45831dc56a21b683c7a1ff530b06cc/crates/foundation/src/registry.rs)。

## 快速上手：install 没写文件，npm 装成了

先把 impeccable 装上。

```
npm i impeccable@4.5.2
npx impeccable install -y --providers=qoder,claude --scope=project
```

第一条 added 2 packages in 1m，退出码 0。du 一量，launcher 60K、Mach-O 二进制 18M。

![install 那四行输出，末行写着没装任何东西](/assets/img/impeccable-seventeen-copies/01-screenshot-install-refused.webp)

第二条翻脸：Could not verify skill bundle。补了一句 Nothing was installed，退出码 1。

假 HOME 和项目目录都翻过，没多出 `.impeccable/`，也没有 `.qoder/`。**没写。**

## 使用示例：我自己那本 CSS 里挑出两条

没写进来不影响 detect，它直接吃文件路径。

![detect 扫我博客 CSS 的输出，含 advisory 那一段](/assets/img/impeccable-seventeen-copies/02-screenshot-detect-my-css.webp)

两条命中都在我线上那本压缩 CSS 里。side-tab 咬的是 `border-left:2px solid var(--signal)`，overused-font 咬的是 `font-family:"Helvetica Neue"`。

第二条我不服，用 sed 把 Helvetica 换成 Zephyrine 再扫，命中从 2 掉到 1。名单里真有它，不算误报。

第三条 bounce-easing 落在 advisory 段，帮助页写着它 never changing the exit code。边界我也试了：路径写错是 exit 1，扫干净页和一个 3 行的 markdown 都是 exit 0，一个字不输出。

## 和同类比：17 份副本占了仓库一半字节

exit 0 这一档要不要紧，取决于你把 detect 挂在哪一层。

字节上的大头是副本本身。17 个 harness 目录下的 `skills/impeccable/` 共 974 个文件，占全仓字节 48.2%。

35 个文件在 17 份之间两两不同，27 个完全一致。`.qoder` 是第 17 份，就是我每天写插件用的那个目录。

守一致性的是 sync-generated-output.yml。它每次 push main 重新生成，用 `git status --porcelain` 判漂移，漂了就自动提交回去，最多 5 次。注释里引 pbakaus/impeccable#388，说约 10% 的 run 会撞车。

跟我这套比，差的不是规则数，是有没有一步真的跑。这个博客的规范是 markdown，Jekyll build 里没有任何一步执行它，pnpm 那边也没有对应钩子。

我为什么还没换：install 没成功，`.qoder/` 至今是空的，那条挂在 postToolUse 上的钩子我一行也没跑到。

## 未来展望：重新生成是否一致，我停在没验到

这条报错指向 pbakaus/impeccable#479。

如果这个月我这条链路能拉下 releases 上的 `.sig.json`，我就重跑 install，把 `.qoder/` 里到底落了什么补写一期。拉不下来，README 那句重新生成与提交一致，我就一直只敢引述。

规则数从 59 往哪走，我没找到 ROADMAP。

项目地址：[https://github.com/pbakaus/impeccable](https://github.com/pbakaus/impeccable)

它挡不住助手写下的每一条通病，但会在文件落盘之后说一声。
