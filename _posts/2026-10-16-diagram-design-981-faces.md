---
layout: post
title: README 说载 3 个字体族，我数出 981 个 @font-face
subtitle: 模板里那条 link 声明 981 个切片、8 个族，README 只提了 3 个名字，画廊还藏着第二条
seo_short_title: 981 个字体切片里没有一个给简体
seo_description: 把 cathrynlavery/diagram-design 那条 Google Fonts link 抓回来按 gstatic 路径数一遍：981 个 @font-face，928 个给韩文与繁体，简体 0 个。仓库里还躺着第二条 link。
date: 2026-10-16
categories: [CSS, 开源实测]
cover: /assets/img/diagram-design-981-faces/banner.webp
tags: CSS headless 设计系统 github 开源 前端小技巧
---

# README 说载 3 个字体族，我数出 981 个 @font-face

![左边那只深色托盘挤满青绿细条，右边同高的简体槽里一根都没有](/assets/img/diagram-design-981-faces/banner.webp)

> 一句话结论：README 说这条 link 加载 3 个字体族，我数出 981 个切片，928 个给韩文和繁体，简体 0 个。
> 现在该做什么：别照 README 的句子推断字体行为，把那条 link 抓回来按 gstatic 的路径数一遍就知道。

## README 那句话对不上我抓回来的响应

README 说三个名字，响应里有 981 条声明。

[cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) 的 README 第 361 行写着，一张图默认从 Google Fonts 加载 Instrument Serif、Geist 和 Geist Mono，这是它 `the only network request it makes`。我照 style-guide.md 里 `Font stack` 那行原样抓了一次。

```bash
curl --http1.1 -H "User-Agent: $UA" -H 'Accept-Encoding: br, gzip' \
  -o css.gz -w '%{size_download}\n' "$URL"     # 233,142
gunzip -c css.gz | grep -c '@font-face'        # 981
```

`$UA` 是 Chrome 153 的 UA 串，`$URL` 就是那行 link。摊开是 `907,623` 字节，`unicode-range` 也正好 981 行。

三个名字对 981 条声明，中间隔着一层机制：css2 接口把每个族按码位区间切成若干片，一片一个 `@font-face`。切片的账在样式表这一层结清，字体文件那一层才按区间现取。981 按族摊开是这样：

| 族 | 切片 | 给谁 |
| --- | --- | --- |
| Noto Sans KR | 372 | 韩文 |
| Noto Sans TC | 324 | 繁体 |
| Noto Serif KR | 124 | 韩文 |
| Noto Serif TC | 108 | 繁体 |
| Geist Mono | 18 | 拉丁 |
| Noto Serif | 16 | 拉丁 |
| Geist | 15 | 拉丁 |
| Instrument Serif | 4 | 拉丁 |

KR 与 TC 那四行相加 928，四个拉丁族相加 53，928 + 53 = 981。简体那两族 `Noto Sans SC` 与 `Noto Serif SC`，切片数：

0 个。

![浏览器面板实测那条 8 族 link：fontFaceCount=981，逐族 x372、x324、x124、x108，四个拉丁族对汉字的 load 全给 0](/assets/img/diagram-design-981-faces/02-screenshot-css2-981-panel.webp)

## 同一个仓库里躺着两条 link，37 和 981

第一次量到的是 37，不是 981。

我把 `example-architecture.html` 用 headless Chrome 打开，往页面里注了个探针打印 `document.fonts.size`，它给 37，`families` 只有 Geist、Geist Mono、Instrument Serif 三项。README 那句话在这枚文件上是准的。

分歧在于仓库里有两条 link。`grep -l 'Noto+Sans+KR' skills/diagram-design/assets/*.html` 数出 11 枚，正好是 4 枚 `template*.html` 加 7 枚 `*-animated.html`；剩下 206 枚带的是 3 族那一条。`references/export.md` 里导出 SVG 时注入的 `@import` 用的是 8 族那一条。

所以路径分两岔。你让 skill 生成一张新图，它从 template 起步，拿到 981 那条；你去画廊看效果，看到 37 那条。README 描述的是后者，模板加载的是前者。

## 那条 link 断网之后，37 掉到 0

同一份文件，我把网络掐了再量一次。

```bash
"$CHROME" --headless=new --window-size=1000,620 \
  --virtual-time-budget=20000 --screenshot=netoff.png \
  --proxy-server="http://127.0.0.1:9" "file://$PWD/probe.html"
```

端口 9 有没有监听我先确认过，是空的。左右两半同一次跑出来：

![左半联网，面板 fontFaceCount=37、标题实宽 265.9；右半断网，37 变 0、字宽涨到 325.6，两格的 check 仍是 true](/assets/img/diagram-design-981-faces/01-screenshot-probe-online-offline.webp)

37 个切片掉到 0，同一句英文标题的实宽从 265.9 涨到 325.6。字体没来，行宽自己找位置。

判据这里有个坑，值得单独说：`document.fonts.check('14px "Geist"')` 在断网那一侧仍然返回 `true`，而同一页的 `document.fonts.size` 是 0。空集合上的 `check()` 是空真，它回答的是「现在要这个字体，会不会去取」，不是「取到了没有」。要判有没有，量 `size` 或者直接量宽度。

简体不在那 981 条里，这事仓库自己知道，`self_check.py` 的 `--offline` 就是为它开的。我先把它用错了地方。

## 我把 --offline 打在画廊上，217 个 FAIL 算我量错

命令是仓库自带的，指向它自己的文件。

```bash
python3 skills/diagram-design/scripts/self_check.py --offline \
  skills/diagram-design/assets/*.html
# exit 1 · FAIL 217 / OK 0
```

217 条同因，逐字是 `offline: file loads Google Fonts; remove the font <link> to use system fonts`。我盯着这个退出码看了半分钟，以为抓到了什么大东西。

重读 `--offline` 的 help 才明白：`also fail on the Google Fonts link, for system-font output that makes no network requests`。那是给你自己生成的文件准备的开关，画廊本来就按 `web` 出。门禁打在画廊上是量具用错对象，那 217 个 FAIL 算我的。

不过这条门禁指对了方向：它认的是文件里有没有那条 link。同样的判据打在 template 上，FAIL 的原因就是真的——template 才是给你生成图用的起点，它带的正是 8 族那一条。

## 补简体的那条 PR 改的正是 template

补简体的补丁只动了 8 族那一条。

[cathrynlavery/diagram-design#249](https://github.com/cathrynlavery/diagram-design/pull/249) 改 6 处 link：4 枚 `template*.html` 各一行、`export.md` 的 `@import` 一行、`style-guide.md` 两行。206 枚画廊文件那条 3 族 link，它一行没动。补丁很小，`+8 / -7`，8 个文件里还有一枚是视觉证据图片。

作者把代价写在 body 明面：样式表从 `~229 KB` 涨到 `~353 KB`，纯拉丁的图也一起涨。我实测两条 link 的 gzip 响应是 `233,142` 与 `357,011`，`@font-face` 从 981 条变 1,385 条，新增的 404 条全在 SC 两族里。跟他按 KiB 折算的读数差 1.3% 与 1.4%，逐字相等我没能复现。

先例走的是同一条路。[cathrynlavery/diagram-design#175](https://github.com/cathrynlavery/diagram-design/issues/175) 开在 9 月 3 日，[cathrynlavery/diagram-design#186](https://github.com/cathrynlavery/diagram-design/pull/186) 在 9 月 6 日合入，前后 3 天 9 小时。#249 开在 9 月 24 日，我核对的这一刻还开着，21 天，`mergeable=true` 但状态是 unstable。

维护者留了两条意见。第一条说视觉证据不成立，那张 `simplified-labels-light.png` 是一张纯拉丁的图，里面没有一个汉字。第二条说还有 3 条 Greptile 线程没关。作者 10 月 10 日回：五点加那一点可选的都改了，之前那张附件确实是一版拉丁渲染，是我贴错了；然后问能不能在新 head 上复审——PR 作者自己发不起正式 review 请求。

我的判断是该合。多出一百来 KB 的样式表，买简体标签跨机器一致，在一张图只加载一次的场景里付得起。这条是判断，不是实测。

## 你自己数一遍，别信我的截图

981 这个数你一分钟能复算出来。

两条命令就够：上面那个 curl 加 `grep -c '@font-face'`，数的是样式表这一层；浏览器控制台里读 `document.fonts.size`，数的是你这个页面真正拿到了多少条声明。两个数对不上，说明你的 link 跟仓库文档里那条不是同一条。

我没能验到的：`lint-render.py` 我没跑，它要 Playwright 那套渲染工装，本机这次没装。style-guide.md 第 123 行那句 `every shipped template and example is already checked in system-font mode` 我照原文引，没证实也没推翻。同一张面板里，4 个 40px 汉字在 TC 栈、`serif`、`PingFang SC` 三种 family 下都量出 160.0，等宽说明那次没有任何 web 字体参与排版——那张图证的是 CSS 层的命中，不是简体字长什么样。

#249 的 head 停在 `28b8a84`，仓库版本在 plugin.json 的 `2.6.103` 上。如果它到我下期抓 trending 之前还没合，我回来量的还是 981 和 0 这两个数；合了我就把两条 link 的差值重算一遍给你。

项目地址：[https://github.com/cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design)
