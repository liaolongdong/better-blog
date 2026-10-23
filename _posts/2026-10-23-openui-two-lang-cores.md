---
layout: post
title: OpenUI 一个 core，我装出两版解析器，新版 API 只到 React
subtitle: 一棵依赖树里躺着 lang-core 0.4.1 与 1.0.1，新 API 只在 React
seo_short_title: 一棵依赖树里的两版 lang-core
seo_description: 把 OpenUI 四个第一方运行时装进同一棵依赖树：npm 落下两版 lang-core，顶层 0.4.1、react-lang 里嵌 1.0.1；新版才有的 parseMessage 在 vue-lang 的 27 个导出里不存在。
date: 2026-10-23
categories: [开源实测, TypeScript]
cover: /assets/img/openui-two-lang-cores/banner.webp
tags: AI 开源 react 前端 评测
---

# OpenUI 一个 core，我装出两版解析器，新版 API 只到 React

![封面：一棵依赖树挂着两个版本的解析器，React 那条分支单独装着新版](/assets/img/openui-two-lang-cores/banner.webp)

> 一句话结论：四个包我装进同一棵树，磁盘上落下两份解析器，React 那份是新的。
> 现在该做什么：跑 `npm ls @openuidev/lang-core --all`，数一数它列了几行版本。

## npm ls 落下两版 lang-core

`npm ls` 那 8 行，我原本预期只有一行。

`thesysdev/openui` 是 TypeScript 周榜第 13 名、截至 2026-10-23 有 13,325 颗 star 的那个生成式 UI 框架。它 README 第 24 行写着：

> OpenUI is a full-stack, framework-agnostic Generative UI framework built around a compact, streaming-first language. A framework-agnostic core powers first-party runtimes for React, Vue, Svelte, and Angular.
>
> 我的翻译：一个全栈、框架无关的生成式 UI 框架，由一个与框架无关的内核驱动 React、Vue、Svelte、Angular 四家第一方运行时。

一个内核、四家运行时，这句话可以直接动手验。我开了三棵空工程：只装 React 一条，只装另外三家，四个一起装。前两条 `added 10 packages`、`added 50 packages`，都没报错。第三条装完，`npm ls` 打出来的不是我以为的东西。

![终端实录：同一棵依赖树里 npm ls 列出 0.4.1 与 1.0.1 两份 lang-core，React 那份单独嵌套](/assets/img/openui-two-lang-cores/01-screenshot-npm-ls-two-cores.webp)

```text
+-- @openuidev/angular-lang@0.4.2
| `-- @openuidev/lang-core@0.4.1
+-- @openuidev/react-lang@1.0.1
| `-- @openuidev/lang-core@1.0.1
+-- @openuidev/svelte-lang@0.4.2
| `-- @openuidev/lang-core@0.4.1 deduped
`-- @openuidev/vue-lang@0.4.2
  `-- @openuidev/lang-core@0.4.1 deduped
```

顶层被 hoist 的是旧那份，React 单独嵌一份新的。`package-lock.json` 里同样是两条路径、两个版本。

## 四行 dependencies，两条版本线

`lang-core` 那两行是谁决定的？四个包自己的 `dependencies`。

```text
react-lang@1.0.1    "@openuidev/lang-core": "^1.0.1"
vue-lang@0.4.2      "@openuidev/lang-core": "^0.4.1"
svelte-lang@0.4.2   "@openuidev/lang-core": "^0.4.1"
angular-lang@0.4.2  "@openuidev/lang-core": "^0.4.1"
```

`^0.4.1` 按 semver 永远吃不进 1.x。所以这不是包管理器的问题，是四条声明本来就分家。

| 包             |  最新版 | 声明的 core | 上周下载 |
| -------------- | ------: | ----------- | -------: |
| `react-lang`   | `1.0.1` | `^1.0.1`    |  184,706 |
| `svelte-lang`  | `0.4.2` | `^0.4.1`    |    7,860 |
| `vue-lang`     | `0.4.2` | `^0.4.1`    |      784 |
| `angular-lang` | `0.4.2` | `^0.4.1`    |      175 |

发布时刻贴得更紧。四个 `latest` 全落在 2026-10-15 04:23Z 到 04:26Z 这三分钟里，是同一次发版。而 `lang-core` 自己的时间线是 10-10 发 `0.4.1`、10-12 直接跳 `1.0.0`、10-15 补到 `1.0.1`：大版本跳了之后，跟着改范围的只有 React 那一条。

![结构图：10-12 那次大版本跳级之后，四条适配器依赖线分成新旧两支](/assets/img/openui-two-lang-cores/03-diagram-dependency-split.webp)

下载量那一列我没敢读成用户数，它只说明上周有多少次安装。`react-lang` 与 `angular-lang` 之间差着三个数量级，这条分界和版本线的分界是同一条。

## parseMessage 只到 react-lang

版本线分家之后，新 API 只走了一条。两版 core 的顶层导出面拉出来：`1.0.1` 是 42 个，`0.4.1` 是 43 个。只在新版的是 `action`、`buildMessage`、`defineAction`、`defineFunction`、`evaluateRoot`、`parseMessage`、`steps`；只在旧版的是 `BUILTINS`、`isBuiltin`、`ACTION_NAMES` 这类内部件。

真正会写进业务代码的是适配器入口。我把四个入口挨个 `import()` 了一遍。

![终端实录：react-lang 有 parseMessage、vue-lang 没有，另两家在 Node 里直接报错](/assets/img/openui-two-lang-cores/02-screenshot-node-adapter-imports.webp)

| 入口           | 导出数 | parseMessage | Node 里 import |
| -------------- | -----: | ------------ | -------------- |
| `react-lang`   |     41 | 有           | 成功           |
| `vue-lang`     |     27 | 没有         | 成功           |
| `svelte-lang`  | 未取到 | 未取到       | 扩展名报错     |
| `angular-lang` | 未取到 | 未取到       | JIT 报错       |

前两行是同一句 import 换个包名。后两行停在加载阶段：Svelte 报 `Unknown file extension` 那一串，Angular 报 `PlatformLocation` 需要 JIT 编译器那一句。它们本来就该由各自的构建器接手，浏览器里跑不跑我没测。

我也试图证明两版解析器给出不同结果。这份样本加上我造的截断、空串、未知组件名，一共五组输入喂进两版 `parse()`，返回 JSON 的长度一组都不差：351、343、169、170、170。

不是行为分叉，是接口分叉。

## README 第 24 行还有一句 67%

parseMessage 之外，同一段 README 还有个数字。

`OpenUI Lang uses up to 67% fewer tokens than JSON`，底下是一张七行的表，用 tiktoken 的 GPT-5 编码器数三种格式各花多少 token。它把样本也提交进了仓库：`benchmarks/samples/` 一共 28 个文件。

我把这 28 个文件按 git tree 登记的字节数逐个校验抓齐，再用它脚本里同一个 `encoding_for_model("gpt-5")` 重跑。第一轮只对上 14 个文件，最大的那一档文件三次重试全断；加上 `--retry 3` 才算跑通。

两列逐格相同。OpenUI 那一列我测出 4,800 个 token，Vercel 那一列 10,180，与它合计行写的一字不差。

第三列不对。Thesys C1 JSON 那一栏，我测的每一格都比它表里少：单格少 10 到 94 个，合计我测 9,650、表里写 9,948。连带「vs C1」那栏的百分比也整体偏乐观，simple-table 一格我重算是 -54.0%，表里写 -58.5%。

差异从哪来我没能确定：样本可能被重新生成过，也可能表格数字是手改的，仓库里没留两版对照。这句标未确认。

至于 67% 本身：它是 contact-form 那一格的最大值，七个场景加总省的是 -52.8%。对照的两栏都是流式 JSON 格式，不是把 UI 直接序列化出来的裸 JSON。

## 对照栏里的 json-render

那个分母之一我本地跑过。

-52.8% 对照的是 Vercel 的 json-render，`vercel-labs/json-render` 我 9 月写过一篇。同一类模型输出 JSON、前端映射组件的做法，我那篇量到的是它把没登记的键静默剥掉。

两条路的分工不一样。json-render 让你写一份 JSON 由渲染器解释；OpenUI 让模型直接吐一种带赋值的紧凑文本，`Table(cols, rows)` 这种写法不用重复键名，省的就是这部分。

代价在另一侧。React 那条线同时有 `@openuidev/react-ui` 和 headless 原语，另外三家只有 `*-lang` 一层绑定；README 第 93 行把 `lang-core` 描述成没有 React、Angular、Vue、Svelte 依赖的那一层，这句我信：磁盘上它就有两份，各自独立。

我自己栈里 Vue 3 是主力。真要在这个栈上用它，我能拿到的就是那 27 个导出。

## 我会盯 vue-lang 的那行 ^0.4.1

那 27 个导出之外，我盯三件事，每件都带触发条件。

- `vue-lang` 的范围改成 `^1.0.1`：两版并一版，主峰失效。判据是 `npm ls` 只剩一行。
- 出第五个 `*-lang` 包：README 那句四家运行时又要重数（`#1455` 之后 RN 在 `.native` 入口里）。
- `.native` 入口被搬进独立包：那条线不再靠 `exports` 的条件字段分流。

没验到的另一半我也写下来。浏览器端我只跑到 Node 里能不能 import；Gateway、服务端渲染、真实模型生成一个都没跑。star 我在两天里抓过两把，rotation-state 里没有这仓库的上期快照，所以本文不写增速。

项目地址：[https://github.com/thesysdev/openui](https://github.com/thesysdev/openui)
