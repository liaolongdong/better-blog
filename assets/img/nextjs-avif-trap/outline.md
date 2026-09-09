---
skill: baoyu-article-illustrator
article: _posts/2026-09-10-nextjs-avif-trap.md
type: mixed
density: balanced
style: sketch-notes
palette: warm
language: zh
image_count: 4
backend: runtime-native ImageGen
confirmed_via: "cron prompt 显式 opt-out（直接生成，不用确认，按默认出图）+ --quick"
---

# Illustration Outline

正文已有 1 张 banner（`01-cover-nextjs-avif-trap.md`，--text none）。以下 4 张为
文内插图，全部走 sketch-notes / warm / zh 标注，密度 balanced。

## Illustration 1
**Position**: 🧬 一节，紧跟「时间线还有个细节我觉得挺真实」那段之后
**Purpose**: 把「6 天 3 小时 45 分」和「合并到发版 4 分 18 秒」两个跨度画成可核对的尺子
**Visual Content**: 横向 5 节点时间轴，节点下挂日期时间，两段跨度用花括号标出
**Filename**: 02-timeline-six-days.png

## Illustration 2
**Position**: 🔍 一节，紧跟「返回的是 `upstreamBuffer`……唯一的区别是没人帮你压过了」段之后
**Purpose**: 说明绕过分支为什么在监控上完全隐形——状态码、格式、ETag 都对，只是没压缩
**Visual Content**: 竖向流程图，一个菱形判断分两条路，右路接一个「200」和「监控无异常」的虚线框
**Filename**: 03-flowchart-bypass-path.png

## Illustration 3
**Position**: 🚪 一节，紧跟「……两条线的修复形状是不一样的」段之后
**Purpose**: 16 线与 15 线的修复形状对照：一个改依赖版本下限，一个运行时查解码器
**Visual Content**: 左右两栏对照，左栏一张纸片（package.json 那一行），右栏放大镜对着旋钮
**Filename**: 04-comparison-two-fixes.png

## Illustration 4
**Position**: 📊 一节，紧跟「三个 sharp，三个 heif 号，一个不差」整段之后
**Purpose**: 把三次实测读数放到同一条 1.23.2 安全线两侧，让「差一个 patch 号跨过一条 critical」可见
**Visual Content**: 一条水平阈值线，线上/线下三组柱状读数，两组标叉一组标勾
**Filename**: 05-infographic-heif-versions.png
