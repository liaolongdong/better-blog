---
layout: post
title: Univer 在 Node 里算公式，但默认表只有 1000 行
subtitle: 没有 document 的进程里，SUM 和 SUMIFS 真的回了数值
seo_short_title: Univer 无头跑 Node 公式实测
date: 2026-09-30
categories: 开源工具 TypeScript
cover: /assets/img/univer-node-two-gaps/banner.webp
tags: Univer TypeScript Node 公式引擎 headless
---

# Univer 在 Node 里算公式，但默认表只有 1000 行

![浏览器与 Node 共用一套表格内核](/assets/img/univer-node-two-gaps/banner.webp)

> 一句话结论：Univer 的无头运行时在这台 Intel Mac 上确实能算公式。
> 现在该做什么：建工作表时显式写 `rowCount`，别拿默认值当上限。

## 背景：它为什么出现

Univer 是个 Office 内核。它 2022-09-29 开源，npm 上 latest 是 `1.0.3`，`LICENSE` 文件写的 `Apache-2.0`。

README 那句自述是 "The Office Harness for AI Agents"。star 22,124，本周新增 6,666，在 TypeScript 周榜第 4 行。

`@univerjs/core` 那周下载八十六万次，窗口 09-22 到 09-28，2026-09-30 抓的。

## 它解决什么痛点

以前让程序算一张表只有两条路。喂一个 headless Chrome 里的表格页面，或者自己写聚合函数。前者要养一个浏览器进程，后者每个函数都得重来。

![进程内算表与起浏览器进程对照](/assets/img/univer-node-two-gaps/01-comparison-runtimes.webp)

Univer 是第三条：跑在进程里，不要浏览器。这条我验了，`typeof document` 是 `undefined`，`SUM(A1:A2)` 回的是 `7`。

## 快速上手

能装上，也能起来。文档的 Node 那页给的命令是 `pnpm add @univerjs/preset-sheets-node-core`，我在 `/tmp` 临时目录里用 npm 装的。

```bash
$ npm i @univerjs/preset-sheets-node-core @univerjs/presets
added 78 packages in 6s
$ node probe1.mjs
createUniver OK
startup ms = 41.2
typeof document = undefined
```

扎心的是不警告。README 要求 Node `>=18.17.0`，可装进来的 24 个 `@univerjs` 包没一个声明 `engines`。上周那个 scriptc 至少还吐了 `EBADENGINE`。

## 使用示例

公式引擎是真起作用的。`CONCAT("a","b")` 回 `ab`，`NOSUCHFUNC(1)` 回 `#NAME?`。但这四条字面量翻了车。

- `=12.5` → 数字 `12.5`
- `=12.50` → 文本 `"12.50"`
- `=007` → 文本 `"007"`
- `=1E3` → 文本 `"1E3"`

```js
// 同一条字面量，套上运算就正常结算
f("007"); // v="007"   t=1
f("007+0"); // v=7       t=2
f("12.50*2"); // v=25      t=2
```

我跑出来的这四条，和 dream-num/univer#7793 报的是同一组。那条 2026-09-29 开的，零评论。

## 和同类比：强在哪、差在哪

强的一处是坐标口径。`getRange(row, col, numRows, numCols)` 吃的是数字，浏览器里写的取值代码搬进 Node 不用改。我那套 wxt + Vue 3 要出导入模板，现在还是手工拼 CSV，这块它替得掉。

差的一处炸了。不给 `rowCount` 时默认表是 `1000` 行 20 列，出处在 `sheet-snapshot-utils.ts` 那两个常量。`FRange` 在构造时就按 `endRow >= maxRows` 校验，直接抛 `Range is out of bounds`。不是它只能处理一千行，显式建 `rowCount: 20005` 的表，两万行写入和三条整列公式都结算对了。

另一条是 dream-num/univer#7115，说 `SUMIFS` 那族按条件分配全长掩码。开着，唯一评论是维护者在要样本文件。这个量级我没测到。

我还没换：这轮只在 `/tmp` 里试，没进任何一条出货链路。

## 未来展望：什么条件下我会用它

两把赌注。如果 dream-num/univer#7793 到 `1.1` 还挂着零评论，我就不把金额列写成裸字面量，上游先套 `NUMBER()`。如果 `server-side calculation` 还在 README 的不提供栏里，我只把它当进程内内核，不做服务端算表。

项目地址：[https://github.com/dream-num/univer](https://github.com/dream-num/univer)

能跑是真能跑，默认值没人写进文档。
