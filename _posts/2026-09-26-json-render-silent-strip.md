---
layout: post
title: 界面一校验就没了？json-render 用 19 条规则想终结它，但漏了一层
subtitle: spec 过一遍 catalog.validate()，元素上的 on 和顶层的 state 消失，success 仍是 true
seo_short_title: json-render 校验会静默删字段
date: 2026-09-26
categories: [AI, 开源实测]
cover: /assets/img/json-render-silent-strip/banner.webp
tags: AI 开源 前端 npm
---

# 界面一校验就没了？json-render 用 19 条规则想终结它，但漏了一层
![一张摊平的纸上画着几个方格，方格之间用短线连起来，一把剪刀正压在其中两格上，碎纸片落在纸角](/assets/img/json-render-silent-strip/banner.webp)

> 一句话结论：校验器删掉的正是 prompt 里教模型写的字段，还报成功
> 现在该做什么：把模型吐的 spec 和校验后那份存下来，diff 一次

342 字节进去，138 字节出来。中间只过了一行 `catalog.validate()`，返回的 `success` 是 true。

我今晚把 vercel-labs/json-render clone 下来读了一遍，HEAD 停在 `c2600d7`。这是我最近读得最顺手的一份代码，也是最拧巴的一份。

## 它把界面摊平成一张表

一屏界面在这库里就是一段扁平 JSON。`root` 存一个 id，`elements` 是一张字典。每个元素只认 `type`、`props`、`children`，模型不用写代码，填表就行。我跑实验用的那份长这样：

```json
{
  "root": "main",
  "elements": {
    "main": {
      "type": "Button",
      "props": { "label": "Click me" },
      "children": [],
      "on": { "press": { "action": "setState" } },
      "watch": { "/count": { "action": "setState" } },
      "repeat": { "statePath": "/rows", "key": "id" }
    }
  },
  "state": { "count": 0 }
}
```

`on` 和 `watch` 里的 `params` 我省略了，完整版在实验目录里。入口是 `defineCatalog()`，一次给你三份东西。`prompt()` 喂模型，`jsonSchema()` 给机器读，`validate()` 把模型吐回来的 spec 过一道。

![一沓画着方格和几个小圆点的纸进了一台小机器，出来那张方格还在、圆点只剩淡淡的圈](/assets/img/json-render-silent-strip/01-flow-paper-through-machine.webp)

README 那 839 行我通读过一遍。Quick Start 第 3 步只是把 spec 塞进 `<Renderer>`，中间没有校验那一步。这玩意儿已经不是玩具：仓库里 33 个包目录，29 个可发布，版本号全是 0.21.0。npm 上 core 上周被装一百六十多万次，react 八十七万次。

star 我这一轮抓了两次，中间涨 1 颗，现在 18,303。TypeScript 周榜排第 15，那一行写着本周涨 2,103。这篇不讲它的 SSR 渲染，也不碰 devtools 和 codegen 两个包，我用不上。

## 校验那一刀切在了哪层

zod 那一份 schema 里没有 `on`。扒开 `packages/react/src/schema.ts`，元素对象只声明六个键。前三个是 `type`、`props`、`children`，后三个 `slots`、`visible`、`repeat`。顶层只有 `root` 和 `elements`。

`on`、`watch`、`state` 一个都没声明。可 `core/src/types.ts` 里它们三个全都在：类型层说合法，zod 层不认。

同一批包里，`prompt()` 给模型的规则在 react 那份编到 19 条，vue 18 条，svelte 和 solid 各 17 条。四份里都印着 4 个 CRITICAL，其中一条的原文是：

> CRITICAL: The "on" field goes on the ELEMENT object, NOT inside "props".

它教模型把 `on` 摆到元素层，而校验器删的正是元素层。我一开始以为这是严格模式在拦错。跑完才发现 zod 的对象 schema 默认行为是 strip：没声明的键悄悄扔掉，连一条 issue 都不给。四个包跑出来一模一样。

> 💡 三份产物里只有给机器读的那一份说了实话。`jsonSchema()` 里没有 `on`、没有 `watch`、没有 `state`，还挂着 `additionalProperties: false`。zod 跟它口径一致，唯独 prompt 不一致。

| 包 | prompt 字符 | 规则编到 | validate 之后 |
|---|---|---|---|
| react | 15,389 | 19 条 | `on`、`watch` 没了 |
| vue | 14,947 | 18 条 | 同上，顶层 `state` 也删 |
| svelte | 14,644 | 17 条 | 逐字一致 |
| solid | 14,644 | 17 条 | 我没测点击 |

六个边界输入我一起喂进去。未知组件名、漏掉 `children`、少一个必填 prop，这三个它拦得住。引用不存在的子元素、往 `props` 里塞没声明过的键、把 `visible` 写成字符串，这三个它全放行。

## ✂️ 谁该拦这一下？没人

按钮还是那个按钮，点下去一次也不响。我把 Vue 挂到 happy-dom 上真点了一次。同一份 spec，喂原始对象，action 触发 1 次。换喂 `validate().data`，文案一模一样，还是 `press me`，点下去触发 0 次。这只在 Vue 上验过，Svelte 和 Solid 我没搭起来。中间撞的错长这样：

```text
TypeError: Cannot set property navigator of #<Object>
ReferenceError: SVGElement is not defined
TypeError: Cannot read properties of null (reading 'createTextNode')
```

第一行我截掉了尾巴，超了单行上限。第三行的根因是 `vue` 得等全局就位之后再动态 import。顺带一句跟主线没关系的：仓库根要求 node 24 起，发出来的包 `engines` 是空对象。

按说该有三层接住它。文档里那份配方在 `content/docs/api/core.mdx`。它写的是 `render(result.data)`，把削过的 spec 直接端出去。MCP 那个包把 `validate` 之后的 spec 原样回给 agent。

四个渲染器包里我 grep 不到一次校验调用。最怪的是同目录下的 `autoFixSpec`。它把 `on` 从 `props` 搬回元素层，也就是搬到那把 zod 会删掉的位置。

其实还有第二把尺子知道答案。`visible` 写成字符串，`validateSpec` 报 `invalid_visible`。`children` 指向不存在的 id，它报 `missing_child`。我拿 SSR 试过第二种，页面静悄悄少一块，控制台只有一条 warn。问题是这把尺子得有人主动去拿，而渲染路径上没人拿。

这不是没人看出来。#222 开在 2026-03-16，标题写的就是这几个键被静默删掉，到今天还挂着。#356 说 `jsonSchema()` 没描述 `on`。#215 在扩另一把校验器的错误码，方向都对，就是没碰到这一刀。

## 表单交给它，别的场景不交

它真正的长处不在校验，在于把一屏界面变成一段可以下发的数据。配重放在这儿，免得读成黑稿。README 说 shadcn 那套有 36 个组件，我数了 catalog 的键，正好 36。

react 和 vue 的顶层导出差 1 个，还是那个标着 deprecated 的别名。NDJSON 乱序 patch 我五行五行喂，元素照样按到达顺序长出来。该留的它都留了：`repeat`、`visible` 原样通过，`props` 里那句 `$item` 一个字没动。都站得住。

![三道拱门全都敞着，一个小圆点穿过去掉了几块碎片，墙上一把尺子从钉子上滑落，地上是只空盒子](/assets/img/json-render-silent-strip/02-framework-three-gates.webp)

我平时写浏览器插件，栈是 Vue 3 加 wxt 加 Element Plus，面板那套东西是我自己一行行贴的。配置项这种活儿我愿意交给它：模型吐 spec，我这边一张注册表接住。但只到配置项为止。权限弹窗、要出网的请求、跟登录态绑在一起的交互，我不放心交给一段下发的 JSON。这跟校不校验没关系，是信任边界。

接下来我盯四件事：

- `schema.ts` 里会不会出现 `on` 和 `state`
- #222 会不会在下个小版本之前合掉
- 新导出的 `jsonSchema()` 里 `additionalProperties` 还挂不挂
- 如果下个小版本还删 `on`，我就不在它身上投时间了

另外一件事。09-23 那篇我押 chrome-devtools-mcp 升到 1.9.0 之后重跑一遍 `tools/list`。它现在的 latest 是 1.10.1，工具从 29 个加到 30 个。押反了。我赌常驻上下文会继续缩，结果两份都在涨。同一周 Tencent/BrowserSkill 我量到 7,319，比上期快照多 496 颗。

校验这一层，究竟是该替模型把字段兜住，还是该把「我只认这六个键」说清楚就完事？
