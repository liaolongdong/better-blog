---
skill: baoyu-article-illustrator
article: _drafts/silent-defaults.md
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

正文已有 1 张 banner（`prompts/01-cover-silent-defaults.md`，--text none）。以下 4 张为
文内插图，全部走 sketch-notes / warm / zh 标注，密度 balanced，四个 type 不重复。

## Illustration 1
**Position**: 「1af9274 那条命令我跑完了」一节，紧跟「所以上期那句“16.3.3 关掉了 AVIF”说得不完整」段之后
**Purpose**: 把「编码没关、关的是解码」这个读法摊成一张 2×2 读数表，让四格数字各自可核对
**Visual Content**: 2×2 手绘矩阵，列头两个 next 版本号，行头两种源图格式，四格填真实字节数，右下角一格被珊瑚色圈出
**Filename**: 02-framework-decode-not-encode.png

## Illustration 2
**Position**: 「同一份公告里，“下线”有三种写法」一节，紧跟「后果分人。手里只有一个 key」整段之后
**Purpose**: 画出 9 月 14 日 12:00 之后那行 model 字符串的真实走向——成功、200、计费换档、无告警
**Visual Content**: 竖向流程图，一个代码芯片 → 一个改道闸 → 右支进另一个模型 → 汇到「200 / 按 Flash 计费」，下方虚线框挂 CI 基线
**Filename**: 03-flowchart-model-reroute.png

## Illustration 3
**Position**: 「⚠️ npm i miniflare 今天装回来一个 alpha」一节，紧跟「谁真的会被打到，我按三种情况拆开」整段之后
**Purpose**: 三种依赖声明方式的暴露度对照，前两种安全、第三种没有选择权
**Visual Content**: 三栏对照，左栏挂锁压住一张锁文件，中栏一个 caret 区间，右栏 wrangler 盒子把 alpha 直接灌进安装树；两勾一叉
**Filename**: 04-comparison-three-declarations.png

## Illustration 4
**Position**: 「注册入口没了：/plus 今天只剩一个登录框」一节，紧跟「我 15:27Z 又把这个页面拉下来数了一遍关键字」整段之后
**Purpose**: 让「这个页面上没有任何一条路通向那篇公告」变成一个可数的东西
**Visual Content**: 一个手绘浏览器框，框内只有那 6 串可见文字；右侧一列 7 个 href 刻度；一个珊瑚色大 0 指向虚线框「通向公告的链接」
**Filename**: 05-infographic-six-strings.png
