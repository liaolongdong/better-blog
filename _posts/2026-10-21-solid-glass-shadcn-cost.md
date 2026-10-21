---
layout: post
title: Solid Glass 实测：它说远看像实心玻璃，我量出卡片六成不透明、26px 模糊
subtitle: 在空项目里只加一个 CSS 文件，stock shadcn 变了样，也多了 33KB
seo_short_title: Solid Glass 实测：60% 不透明卡片
seo_description: 我用最小 Vite + React 19 + Tailwind 4 实测 Solid Glass：stock shadcn 组件没改一行，但卡片样式是 60% 不透明加 26px 模糊；构建 CSS 从 29.5KB 增到 62.7KB，import 顺序错了静默退回默认主题。
date: 2026-10-21
categories: [AI, 开源实测]
cover: /assets/img/solid-glass-shadcn-cost/banner.webp
tags: AI 前端 开源项目 评测 设计系统
---

![封面：Solid Glass 的卡片只有六成不透明，远看像实心，近看是磨砂玻璃](/assets/img/solid-glass-shadcn-cost/banner.webp)

上周给一个内部 Agent 控制台换皮。产品只说了一句“要像玻璃，不要那种一眼假的渐变”。

我打开 shadcn 的 Card 和 Button，准备一个个改 className。改到第三个按钮时停了：按钮有六个 variant，弹层还有四套，等 shadcn 下次升级，这些改动全是冲突。

后来刷到 [deeplethe/solid-glass](https://github.com/deeplethe/solid-glass)。README 第一句很对我胃口：一个样式表，现有的 shadcn 组件一行都不用改。仓库 10 月 12 日才建，10 月 21 日还在推，MIT，截至 2026-10-21 有 2,098 颗 star。

我没直接把它接进项目，先在 `/tmp` 里搭了个空项目，只放一个 Card、三个 Button。这篇文章只回答一件事：它说的“实心玻璃”到底有多实心，“一个样式表”又要付多少代价。

## 我在一个空项目里，只放了 Card 和 Button

测试项目是 Vite 8.3.5、React 19、Tailwind 4，shadcn CLI 4.21.4，preset 用 `base-nova`（Base UI 那一套）。组件只跑了 `shadcn add card button`，没有再动任何一行源码。

页面也很克制：三块彩色模糊背景，一个 Card，里面三个 stock Button，下面两张小 Card。没有自定义字体、没有额外的玻璃 CSS。

```bash
npm create vite@latest sg-mini -- --template react-ts
cd sg-mini
npm i tailwindcss @tailwindcss/vite
npx shadcn@latest init -b base -p nova
npx shadcn@latest add card button
npm run dev
```

![实测页面：stock shadcn 的 Card 和三个 Button，只加了一个样式表就变成半透明玻璃](/assets/img/solid-glass-shadcn-cost/01-screenshot-shadcn-glass.webp)

截图里能看到结果：Card 的面板是灰白的，右侧蓝色背景透进来一点，按钮各自有自己的玻璃边。组件文件没改，样式确实接上了。

这也是我愿意为它写一篇的原因。它不是又一个“把 shadcn 组件复制一份再改颜色”的主题包，它赌的是 CSS 变量和 `data-slot` 能把现有组件整体接走。这个思路比逐个 fork 组件干净得多。

我也想过自己写。CSS 无非是 `background: rgba(255,255,255,.6)` 加一行 `backdrop-filter: blur(24px)`，再补几条内外阴影。真写到第三个组件就会发现，难点不是 blur，是不同层级的透明度、边框、焦点态和暗色变量要一致。手写十遍，每遍都会差一点。Solid Glass 把这些收进了一个文件，这是我愿意给它一次机会的原因。

测试页也没有引入业务代码。三块背景分别是橙、蓝、品红，只为了看颜色会不会透过面板。一个 Card 里放三个 Button，下面两张小 Card 放占位块。这样量出来的样式，不会被业务组件的额外类名污染。

## 它说远看像实心，我量出 60% 不透明

README 的原话是：“feels solid from afar and reveals its subtle materiality up close.” 远看像实心，近看才看出材质。

我打开 DevTools 读了卡片的计算样式：

```text
Card
background-color: oklch(0.98 0.004 265 / 0.6)
backdrop-filter: blur(26px) saturate(1.8)
border-radius: 19.6px

Button (default)
background-color: oklch(0.2 0 0 / 0.88)
backdrop-filter: blur(14px)
border-radius: 11.2px
```

`:root` 里的三档厚度也对得上：

```text
--panel:   oklch(0.975 0.004 265 / 44%)
--card:    oklch(0.98  0.004 265 / 60%)
--popover: oklch(0.985 0.003 265 / 96%)
```

卡片是 60% 不透明。换句话说，四成背景会透过来，再被 26px 的模糊揉一遍。按钮更实一点，88%，但仍有 14px 的模糊。

这跟“实心”不冲突，但跟 README 另一句就有出入了。它写：“The face itself is neutral grey: it takes no colour from what is behind it, bends nothing and does not flow.” 面板本身是中性灰，不借背景的颜色，不弯折，不流动。

`backdrop-filter: blur(26px) saturate(1.8)` 做的正好是弯折和加饱和。截图里卡片右侧的蓝，不是画上去的，是背景透进来的。说它“不借背景颜色”，不准确。

边缘的处理倒是和 README 说的一致。卡片外面有一圈 1px 的暗边，里面有一条 1px 的亮边，顶部还有一层内阴影高光，底部压着扩散阴影。计算出来的 `box-shadow` 是好几层叠加，不是一条 `border`。这就是它看起来“厚”的原因：不是把背景调得更白，而是在边缘做出厚度。

按钮比卡片克制。14px 模糊、88% 底色，基本只在边缘露出背景。卡片是 26px 加 60%，大色块会透得更明显。这个层级安排是合理的：按钮要读字，卡片要氛围。真正该问的是你的页面里哪块负责读字，哪块负责氛围。

还有一点值得注意：模糊不是只作用在面板上。按钮、输入框、badge、甚至 popover 都各自带了一层 `backdrop-filter`。一个页面如果有二十个玻璃面叠在一起，浏览器要分别采样背景再模糊，成本不是线性的。这个我没做性能剖析，只是读选择器时的担心。

我原本以为这种主题最难的是暗色，实际最难的是默认态：卡片一透，背景里任何一条分割线都会变成视觉噪音。Solid Glass 用边缘高光把注意力拉回边框，这个处理比单纯调透明度聪明。

| README 的说法 | 我量到的 | 判断 |
|---|---|---|
| 远看像实心，近看才是玻璃 | 卡片 60% 不透明，面板 44%，弹层 96% | 更像“重磨砂玻璃”，不是实心 |
| 中性灰，不借背景颜色、不弯折 | `blur(26px) saturate(1.8)` | 会模糊，也会提高背景饱和度 |
| 面板 < 卡片 < 弹层，越厚越不透明 | 44% < 60% < 96% | 成立，三档厚度是认真设计的 |
| 一个样式表，组件不用改 | stock Card/Button 只加 CSS 就变样 | 基本成立，但有 import 顺序的前提 |

**所以呢：把它当“磨砂玻璃”买，别当“实心玻璃”买。** 想要更实，把 `--card` 从 60% 调到 85% 以上，或者直接给需要读数字的区域关掉 `backdrop-filter`。它留了变量，改起来不难。

顺便说一句，浅色模式的文字仍然清楚。截图里 14px 的说明文字没有糊，按钮标签也能读。问题不在可读性，在“实心”这个词给错了预期。

这次我只量了浅色。README 说暗色才是主设计，我没切过去看，所以别把上面的读数当成暗色结论。这是我这一轮留下的空白。

## 那次安装先给了我一个超时

README 的安装命令是这一条：

```bash
npx shadcn@latest add deeplethe/solid-glass/solid-glass
```

我在空项目里跑第一次，失败了。CLI 的原话：

```text
Failed to read GitHub source file "registry.json" from deeplethe/solid-glass#HEAD.
Request to https://raw.githubusercontent.com/deeplethe/solid-glass/6e8903e.../registry.json failed,
reason: Connect Timeout Error (attempted addresses: 185.199.109.133:443, timeout: 10000ms)
```

我第一反应是仓库没把 `r/` 目录提交上去。后来重试同一条命令，它又成功了，输出 `Skipped 1 file ... identical`。所以不是仓库缺文件，是我这边到 `raw.githubusercontent.com` 的这一次连接超时了。

这件事不影响它的功能，但对国内网络是一个真实门槛。官方站点上有现成的 registry JSON，我后来用这条命令装成功了：

```bash
npx shadcn@latest add https://deeplethe.github.io/solid-glass/r/solid-glass.json
```

它和简写命令装出来的是同一个 `src/solid-glass.css`，55,827 字节。README 没写这条回退路径，我是从官方站点的 registry 链接摸过去的。

这不是什么大缺陷。只是如果你在 CI 里跑安装，或者公司网络对 GitHub raw 不稳定，最好把这条 URL 写进内部文档，别让下一个人也以为是仓库坏了。

顺带说清 `shadcn add` 到底做了什么：它去 registry 取一个 JSON，里面带着文件路径和内容，然后写进 `components.json` 配的目录。Solid Glass 的 item 只有一个文件 `src/solid-glass.css`，没有组件、没有依赖。所以“一个样式表”不是比喻，安装产物真的只有一个 CSS 文件。

简写命令和 URL 命令的差别，不只是语法。前者先解析 GitHub ref，再读仓库根目录的 `registry.json`，再按 item 去 raw 取文件；后者直接拿官方站点构建好的 JSON。中间多两次网络请求，就多两次超时机会。这个解释是我从 CLI 报错路径推出来的，没去读 CLI 源码，可能有偏差。

我后来在干净目录又跑了一次 Pages URL，输出 `Created 1 file`，不到两秒。简写命令成功时输出的是 `Skipped 1 file ... identical`，因为文件已经在了。两条路径装出来的字节数一样，都是 55,827。

## import 顺序错了，它不报错，只是悄悄退回原样

真正让我坐直的是下一个测试。

README 要求把样式表放在末尾，并且删掉 `shadcn init` 写进 `index.css` 的 `:root` 和 `.dark` 颜色变量。我照做时一切正常。然后我故意反过来：保留 shadcn 的 `:root`，把 `@import "./solid-glass.css";` 放到 `@import "shadcn/tailwind.css";` 前面。

重新加载，卡片变成了 `oklch(1 0 0)`，纯白。可 `backdrop-filter` 还是 `blur(26px) saturate(1.8)`。

控制台没有任何报错，构建也没有 warning。页面只是看起来“没生效”。

![对比图：默认 shadcn、正确导入的 Solid Glass、import 顺序错误时退回纯白但模糊仍在](/assets/img/solid-glass-shadcn-cost/02-comparison-solid-vs-default.webp)

原因不复杂：Solid Glass 的颜色全在 `:root` 的 CSS 变量里，shadcn 的 `:root` 也是同样的选择器、同样的优先级。谁在后面，谁赢。组件本身不参与判断。

这个失败模式很坏。它不红、不响，还留着一半成本：模糊规则照样执行，GPU 照样要算，只是玻璃的视觉没了。要是你在一个已经很卡的后台里装它，顺序又放错，你会以为“变卡了但没变好看”。

**所以呢：装完先量一次计算样式。** 卡片的 `background-color` 应该是 `oklch(0.98 0.004 265 / 0.6)`，不是 `oklch(1 0 0)`。不是这个值，就是变量被后面的 `:root` 盖了。

这也是它和“完整设计系统”的差别。真正的设计系统会把这种约束收进构建或类型里；它现在只写在 README 里，靠人记住。

我把三种状态放进了对比图：左边是默认 shadcn，中间是正确顺序，右边是顺序错了。三张卡片用同一段 JSX，差别只在 CSS 的加载顺序。看图会觉得是小问题，真在项目里遇到，很容易花半小时找“为什么样式没生效”。

一个可用的自检办法：在浏览器里执行 `getComputedStyle(document.querySelector('[data-slot=card]')).backgroundColor`，正确值是 `oklch(0.98 0.004 265 / 0.6)`。如果拿到 `oklch(1 0 0)`，别怀疑组件，去看 `index.css` 的 import 顺序和 `:root`。

## 29.5KB 到 62.7KB：一个样式表的价钱

为了算清楚这笔账，我用同一个演示页做了 A/B 构建。两次都只有 stock Card 和 Button，差别只在有没有那一个样式表。

| 指标 | 默认 shadcn | 加 Solid Glass |
|---|---|---|
| 构建后 CSS | 29,527 B | 62,652 B |
| CSS gzip | 6,256 B | 11,118 B |
| Card 背景 | 不透明白 | 60% + `blur(26px)` |
| Button 背景 | 实色 | 88% + `blur(14px)` |
| 组件源码改动 | 0 | 0（但要删变量、管顺序） |

差值：原始 CSS 多了 33,125 字节，涨了 112%；gzip 多了 4,862 字节，涨了 78%。

33KB 不算离谱。一个图标库、一个图表库动辄几百 KB。它的问题不在绝对值，在位置：这是首屏 CSS，而且每个玻璃面都带 `backdrop-filter`。前者影响首次渲染，后者吃 GPU。

这 33KB 里不只有颜色。整个文件 55,827 字节，包含三档面板、按钮的各种 variant、badge、switch、checkbox、radio、slider、图表颜色、侧栏、暗色覆盖，还有焦点态和 disabled 态。它不是只给你一个 Card 的配色，而是把 shadcn 常用组件的表面都写了一遍。你只用 Card 和 Button，也会把其余选择器一起下载。

gzip 后多 4.9KB，这个数字更接近真实传输。对 HTTP/2 和缓存友好的站点，它不算重；对首屏预算只有几十 KB 的页面，它就要排队。我的建议是先量，再决定要不要全站引入，还是只在 Agent 相关路由懒加载。

我没测低端 Windows 和移动端的帧率，也没把 33KB 拆成“首屏实际传输增量”。这两个数只能说明构建产物变大了，不能直接换算成用户等待时间。**这一点我没验到，不敢替它报性能数字。**

对内部后台、Agent 控制台这类页面，33KB 和模糊成本通常可以接受。对内容站、C 端首屏、低端设备，这笔账要重新算。我的算法很简单：如果这个页面一天只开几十次，33KB 可以忽略；如果它要承接投放流量，先把这 33KB 放到路由级懒加载里再谈。

## 它替掉的旧路，和它没替你解决的问题

旧路很具体：要么把 shadcn 的 Card、Button、Dialog 各复制一份，改 `className` 和 `box-shadow`；要么在全局 CSS 里覆盖 `.rounded-xl`、`.bg-card` 这类类名。前者升级就冲突，后者容易误伤。

Solid Glass 的办法是接管 CSS 变量和 `data-slot`，让组件继续用原来的类名，只是变量的值变了。这个思路是对的，也是它最值钱的地方。你不需要在业务组件里留下任何 `solid-glass` 的痕迹。

三条路摆在一起，差别更清楚：

| 路线 | 组件改动 | 升级风险 | 一致性 | 代价 |
|---|---|---|---|---|
| 复制组件改 className | 每个组件一份 | 高，shadcn 升级要手动合并 | 靠人记 | 维护成本最高 |
| 全局 CSS 覆盖类名 | 0 | 中，容易误伤别的组件 | 中 | 选择器越写越长 |
| Solid Glass 样式表 | 0 | 低，变量和 data-slot 接管 | 高 | 33KB + import 顺序 |

我选第三条，不是因为它最省字节，是因为它把“表面”收在一个文件里。以后要调透明度、换主色、加一档面板，都只改一个地方。代价是你得接受它的变量命名和 0.1.0 的变动。

它没解决的事也得说清楚。

字体、间距、布局还是 shadcn 的。它换的是材质，不是排版。暗色要自己切 `.dark`，README 说暗色才是设计的主场，但我这次只量了浅色，没做暗色对比度测试。

`data-slot` 是 shadcn 组件自带的标记，比如 Card 的根节点是 `data-slot="card"`，Button 是 `data-slot="button"`。Solid Glass 的选择器大量写成 `[data-slot="..."]`，所以你换成别的组件库，它就不认识了。这也是它只支持 shadcn/ui 的原因：不是不想通用，是标记对不上。

它也不是完整设计系统。README badge 写 13 items，我一开始以为少了一个；拆开看是 12 个组件 + 1 个 block，样式表单列，registry 里一共 14 个条目。数量对得上，但离“整套设计系统”还远。

仓库没有 release，`package.json` 还是 0.1.0。这不是罪，9 天大的仓库本来就在长。但你把它接进生产前，得接受它明天可能改变量名。

还有一处我可能判断错：如果浏览器不支持 `backdrop-filter`，60% 的底色还在，模糊没了，文字对比可能更差。我没在旧浏览器里验，所以这只是担心，不是结论。

## 谁现在该用，谁先别用

该用的：已经在用 shadcn/ui、React 19、Tailwind 4，想给 AI 应用快速统一一套材质，能接受 33KB CSS 和模糊成本，愿意按文档管 import 顺序的团队。

先别用的：需要高对比、不透明界面的金融/数据密集后台；目标浏览器老到不支持 `backdrop-filter`；首屏 CSS 预算卡得很死；想要一套从排版到组件都齐的设计系统。

还有一个现实问题：它的组件示例是英文的，排版偏密，中文长文本下的行高和字重需要自己再调。它不是为中文内容站设计的，AI 控制台这种短标签场景更合适。

如果你只是想要一个玻璃按钮，别装整套。手写十行 CSS 更快；如果你有二十个以上的 shadcn 组件要统一，样式表的规模效应才出来。

另外，`backdrop-filter` 在 Safari 需要 `-webkit-` 前缀，Solid Glass 的样式表里两行都写了；这一点它做得对。IE 和旧版 Firefox 就别想了。

还有，别在同一个页面叠太多玻璃面。侧栏一层、内容卡一层、弹层再一层，三层叠起来，视觉和 GPU 都会累。

如果你属于前者，我建议按这个顺序动手：

1. 在分支里装，先跑一次构建，把 CSS 前后的字节数记下来。
2. 删掉 `shadcn init` 写的 `:root` 和 `.dark` 颜色变量，把 `@import "./solid-glass.css";` 放在末尾。
3. 打开 DevTools 量 Card 的背景色，确认是 60% 那一档，不是纯白。
4. 用真实内容测一遍对比度，别只看官方 demo 的漂亮背景。

完整的 CSS 顺序是这样，别省：

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "./solid-glass.css";
```

装的时候如果简写命令超时，改用 `https://deeplethe.github.io/solid-glass/r/solid-glass.json`，别在 GitHub raw 上反复撞。

## 我的判断：当磨砂玻璃用，别当实心玻璃

我给自己定的决策路径是：内部工具、路由可控、能接受 0.1.0 的变动——装；面向客户的首屏、需要高对比和稳定 API——先不装，等 release 和暗色文档；只想试一下玻璃质感——复制它的 `:root` 变量和一条 `backdrop-filter`，别引整包。

回到开头那个控制台。我收手时没把所有 Card 都换成 Solid Glass。

侧栏、对话面板、状态卡换了，表格区域保持不透明。远看是一套材质，近看数字还能读清。这大概就是它最适合的位置：**负责气氛的表面用它，负责读数的表面别用。**

产品要的其实不是“玻璃”，是“有层次但不抢内容”。Solid Glass 给的是前者，后者还得靠你自己分配哪块该透、哪块该实。它没有替我做这个决定，这反而是一件好事。

它做工是认真的。三档厚度、边缘高光、按钮的按下状态、浅色和暗色的变量，都能看出有人在调。一个样式表接管 stock shadcn 也确实做到了，省掉的是逐个 fork 组件的长期维护。

但“实心玻璃”是远看的视觉结论，不是透明度承诺。你如果冲着“不透明”去，会失望；冲着“有质感的磨砂表面”去，它够用。

我的下注是：三个月内它如果能补上暗色对比度文档、一条 import 顺序的自检、以及第一个正式 release，我会把它推荐给更多团队。如果还是 0.1.0、还是靠人记住顺序，我只会在内部工具里用。

项目地址在 [github.com/deeplethe/solid-glass](https://github.com/deeplethe/solid-glass)，在线 demo 在 [deeplethe.github.io/solid-glass](https://deeplethe.github.io/solid-glass)。我这次测的是 main 分支 commit `6e8903e494a15491ceda38fafea5056c95a74d44`，抓取日期 2026-10-21。你要装的话，先量一遍你那边的卡片背景色。
