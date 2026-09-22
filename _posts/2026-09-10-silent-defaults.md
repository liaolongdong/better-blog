---
layout: post
title: 谁才是 9 月最不动声色的改动？三桩实测排完，第一名是我自己
subtitle: DeepSeek 换了模型名底下的人，miniflare 的 latest 变成 alpha，Tailwind Plus 关了注册门。三件事没有一个给过 5xx，我把它们一个个跑完之后，排序和我想的不一样
date: 2026-09-10
categories: [前端工程化, 开源实测]
cover: /assets/img/silent-defaults/banner.webp
tags: npm next AI 开源 前端小技巧
---

![三处被静默改掉的默认值：DeepSeek 的模型路由、miniflare 的 npm dist-tag、Tailwind Plus 的注册入口，全程没有一条报错](/assets/img/silent-defaults/banner.webp)

## 1af9274 那条命令我跑完了：6,906 和 28,112

```bash
$ git log --format='%h %ad %s' --date=iso -2
1af9274 2026-09-10 01:32:23 +0800 feat(blog): 添加 Next.js AVIF 优化开关反复的分析文章
96f65de 2026-09-10 06:01:05 +0800 feat(blog): 添加 agent 自动出图工具链实测的文章
```

这两行的顺序和它打印出来的时间是反的：`git log` 按提交对象排，不按作者时间排。我没往下查，知道有这毛病就够了。

上期我在第 249 行留过一句话：“下次要么给你两个 KB 数，要么告诉你我又没跑成。”这次跑成了。环境先交代清楚，免得你跟着跑出一堆对不上的数：node 从系统默认的 v16.16.0 手动切到 nvm 里的 v20.11.1（next@16.3.4 声明 `engines.node: ">=20.9.0"`，够），`next dev -p 8277` 起来，日志给的是 `▲ Next.js 16.3.4 (Turbopack)` 和 `✓ Ready in 2.3s`；源图是 `ffmpeg -f lavfi -i testsrc2=size=1600x1000` 出的单帧 PNG，169,880 字节。

```
# 16.3.4 + node v20.11.1，next.config 是空对象
w=640  accept=[image/avif,image/webp,*/*] http=200 bytes=8526  ctype=image/webp
w=1080 accept=[image/avif,image/webp,*/*] http=200 bytes=19238 ctype=image/webp
w=1600 accept=[image/avif,image/webp,*/*] http=400 bytes=44
--- 400 响应体原文："w" parameter (width) of 1600 is not allowed
w=1080 accept=[image/avif]                http=200 bytes=36417 ctype=image/png

# 同一台，next.config.mjs 加上 images.formats = ['image/avif','image/webp']
w=640  accept=image/avif         200 7898  image/avif
w=1080 accept=image/avif,image/webp,*/* 200 13504 image/avif
w=1080 accept=image/webp,*/*     200 19238 image/webp
```

那张 36,417 字节的 PNG 就是默认配置的代价：你的浏览器明明只想要 AVIF，服务器发现 formats 里没有 avif，于是不协商了，直接按原格式给你缩放。`formats` 这个数组默认是 `['image/webp']`，上期写过。

这三行数字你不用信我。在自己的站上对同一张图打两次 `/_next/image?url=…&w=1080&q=75`，一次带 `Accept: image/avif,image/webp,*/*`，一次只带 `Accept: image/avif`，比较返回头的 `Content-Type` 和落盘字节数就够了。我这几行数就是这么来的，源图是合成的，样本 1，别拿我的百分比当你的。

顺带一条撞上的：`w=1600` 那两次都给了 400，响应体原文是 `"w" parameter (width) of 1600 is not allowed`。这跟 AVIF 无关。按报错的措辞看，是 `images.deviceSizes` 那串白名单在挡路，而我这张源图正好 1600 宽，默认列表里没有这个值。别把它当成图片优化挂了。

然后是意外。我把源图换成自己用 sharp@0.35.4 编出来的那张 AVIF（28,112 字节），`w=640`、`Accept: image/avif`，16.3.3 和 16.3.4 两台同时请求：

```
port=8277（16.3.4） http/bytes=200 6906  type=image/avif cache=MISS | ISO Media, AVIF Image
port=8278（16.3.3） http/bytes=200 28112 type=image/avif cache=MISS | ISO Media, AVIF Image
```

28,112 和上游那个文件的字节数完全相等。16.3.3 没重新编码，它把原图整张吐回来了，状态码还是 200。而同一时刻，喂 PNG 源图、`w=1080`，16.3.3 和 16.3.4 都返回 13,504 字节的 `image/avif`，两个数到个位都一样，重复三次都一样。

所以上期那句“16.3.3 关掉了 AVIF”说得不完整。就我这几条请求看到的：它没关编码，关的是解码——凡是得先读懂一张 AVIF 才能往下做的活儿它不接，能原样吐回浏览器的它照吐。官方从没这么写过，这是我自己的读法。你要按这个思路去动线上配置，先自己复现一遍。
![2×2 读数表：列头 16.3.3 与 16.3.4，行头 PNG 源图与 AVIF 源图，PNG 一行两格都是 13,504，AVIF 一行是 28,112 与 6,906](/assets/img/silent-defaults/02-framework-decode-not-encode.webp)


这算翻车吗？算我上期写少了。

---

## 同一份公告里，“下线”有三种写法

9 月 10 日 DeepSeek 发 V4.1 Flash。中文页（14:53Z 抓）逐字是：

> 经多方测试，V4.1 Flash 在性能、费用、速度、总用时等各项指标上已全面超越 V4 Pro，因此我们计划有序下线 V4 Pro 模型。北京时间 2026 年 9 月 14 日 12:00 之后，至未来 V4.1 Pro 上线之前，用户访问 deepseek-v4-pro 的请求将全部路由到 V4.1 Flash，并按 V4.1 Flash 单价计费。

英文页 news260910（14:57Z 抓）说同一件事：

> Tests by multiple parties put V4.1-Flash ahead of V4-Pro on performance, cost, speed & total runtime. We're phasing out V4-Pro.
> Starting at 04:00 UTC on Sept 14, 2026, all deepseek-v4-pro requests will route to V4.1-Flash at V4.1-Flash rates.

文档里另一页的脚注（14:51Z 抓）是第三种：

> After extensive testing, V4.1 Flash has comprehensively surpassed V4 Pro in performance, cost, speed, and total time, so we plan to retire V4 Pro in an orderly manner.

三种写法：有序下线、phasing out、retire in an orderly manner。时间三处对得上，北京时间 12:00 就是 04:00 UTC。

换上去的那个是什么，官方中文页给了参数：V4.1 Flash 是 552B 参数的 MoE，Causal-Encoder-Decoder 结构，输入侧激活 8B、输出侧激活 16B；KV Cache 那几句我一个都没能自己复算，全是抄它页面的，你当宣传口径看。同一份公告里还有两句容易滑过去的：旧版本模型 V4 Flash 与 V4 Flash Vision Exp 现已下线，出于兼容考虑，模型名 `deepseek-v4-flash`、`deepseek-v4-flash-vision-exp` 将被暂时路由到 V4.1 Flash；以及新价格于 2026 年 9 月 10 日 12:00 开始生效。也就是说 9 月 14 日不是唯一一次改动，价格这一头今天中午已经换过了。公告末尾点名腾讯（WorkBuddy、CodeBuddy）和 OpenCode 已全量接入。

后果分人。手里只有一个 key、手动调着玩的，什么也不会发生。把 `model: "deepseek-v4-pro"` 写进 CI 并且拿它当回归基线的，9 月 14 日 12:00 之后你会看到：请求成功、200、按 Flash 单价扣费，底下推理的模型换了人。基线不再是那条基线，而且不会有任何东西提醒你去重跑。
![竖向流程图：芯片 deepseek-v4-pro 经过挂牌 04:00 UTC 的改道闸，右支落进 V4.1 Flash，汇到 200 按 Flash 单价计费，下方虚线框写 CI 基线已换人](/assets/img/silent-defaults/03-flowchart-model-reroute.webp)


另一方的原话。HN 用户 aftbit 在 9 月 9 日 14:01:30Z 那条（[49626758](https://hn.algolia.com/api/v1/items/49626758)，抓取时间 14:53:50Z）：

> Please don't do this kind of thing. If a user has validated a workflow on V4 Pro, they might not want to suddenly start testing it in production on V4.1 Flash. Instead, keep V4 Pro around but deprecated for a defined period of time, then remove it.

同一帖下面 damsta 的 49626893（14:09:20Z）只有一句：`this auto re-routing sounds concerning`。

社区这条时间线我也拉了一遍：9 月 9 日 11:19:26Z 第一个帖（49624603，讲的是发布本身，412 分），同一天 14:01:30Z 出现上面那句 “Please don't do this kind of thing”，9 月 10 日 06:11:05Z 第二个帖（49639090，665 分 363 评论），再往后 07:22:31Z 有个只有 1 分的帖子，标题原文是 `DeepSeek v4 Pro discontinuation (email)`，API 返回里它没有 url 字段。分数从 412 掉到 1，不代表这件事不重要，只代表它已经过了首页的窗口期。那条 1 分帖的正文我没读，所以不知道他贴的邮件长什么样。

有一处矛盾我不替谁圆。aftbit 引述的那句官方原文，开头是 “In keeping with our commitment to user responsibility”，我拿 commitment、user responsibility、routed 三个关键词在上面两个英文页面里逐字搜，`find` 全部返回 -1。我没有那封邮件，不能证实也不能证伪：我抓回来的页面上没有这句话。

我测不了的部分写在这儿：这台机器 `env | grep -ci deepseek` 是 0，没有 key。我能证明的只有这个字符串会走到认证失败。

```
$ curl -X POST https://api.deepseek.com/chat/completions -H 'Authorization: Bearer sk-not-a-real-key-000' -d '{"model":"deepseek-v4-pro", ...}'
HTTP 401
{"error":{"message":"Authentication Fails, Your api key: ****-000 is invalid","type":"authentication_error","param":null,"code":"invalid_request_error"}}
```

顺手记一条文档的毛病：侧边栏“模型 & 价格”那条链接，我点的 `/zh-cn/guides/quick_start/pricing`，最终打开的那个页面 `<title>` 是 `Your First API Call | DeepSeek API Docs`；去掉 script 和 style 之后 4,041 个可见字符里，“价格”出现 0 次。这跟 9 月 14 日那次路由无关。

## ⚠️ npm i miniflare 今天装回来一个 alpha，全程零警告

```
$ npm view miniflare dist-tags --json     # 2026-09-10T14:48:53Z
{
  "beta": "0.0.0-66edd2f3b",
  "latest": "5.20260908.0-alpha",
  "latest-2": "2.14.4",
  "legacy": "3.20250718.3",
  "legacy-beta": "0.0.0-b0a40729a",
  "next": "0.0.0-f7c347a67",
  "v4-rc": "4.20250214.0-rc.0"
}
```

七个 tag，没有一个指向 4.x 的稳定版。`4.20260730.0` 发布于 7 月 30 日 16:29，`5.20260908.0-alpha` 发布于 9 月 8 日 17:03。`latest` 这个 tag 是哪一天从 4.x 挪到 alpha 的，npm 只给当前值、不给 tag 变更史，我没找到来源，所以这句写成“今天它指向 alpha”。

两次安装的原文我一起贴，别嫌长：

```
# /tmp/mfv5，node=v22.19.0 npm=10.9.3
added 29 packages in 15s
EXIT=0

# /tmp/mf20，node=v20.11.1 npm=10.2.4，--dry-run
npm WARN EBADENGINE Unsupported engine {
npm WARN EBADENGINE   package: 'miniflare@5.20260908.0-alpha',
npm WARN EBADENGINE   required: { node: '>=22.0.0' },
npm WARN EBADENGINE   current: { node: 'v20.11.1', npm: '10.2.4' }
npm WARN EBADENGINE }
npm WARN EBADENGINE Unsupported engine {
npm WARN EBADENGINE   package: 'undici@7.29.0',
npm WARN EBADENGINE   required: { node: '>=20.18.1' },
npm WARN EBADENGINE   current: { node: 'v20.11.1', npm: '10.2.4' }
npm WARN EBADENGINE }

added 56 packages in 2s
```

node 22 下面一行警告都没有。没有 alpha、没有 not compatible、没有 using --force。同一份 manifest，node 20.11.1 那次报 56 个包，node 22 这次装 29 个，原因我没查——我怀疑 dry-run 不做平台裁剪，这是猜的。那这件事跟前端有什么关系？`npm i -D wrangler` 拿到 4.130.0，它的 `dependencies.miniflare` 精确写着 `5.20260908.0-alpha`；miniflare@latest 的 `dependencies` 里钉了一行 `sharp: "0.35.2"`，是 dependencies 不是 optionalDependencies。我在这个新装出来的树里 `require('sharp').versions`，heif 是 1.23.0。

接上上期那条安全公告：GHSA-g89c-p67h-r497 的受影响区间是 `>=v1.22.0, <= v1.23.1`，sharp 侧的 first_patched 是 0.35.4，公告 published 是 2026-09-08T21:25:11Z。这三个值读的全是昨天存进 `_drafts/evidence/nextjs-avif-trap/` 的 JSON，本期一次 GitHub API 都没发。

边界说死，别替我夸大。sharp 在 miniflare 里只出现在 `imagesLocalFetcher`（源码路径注释是 `// src/plugins/images/fetcher.ts`，`await import("sharp")`，失败返回 503/9523）。走到那行得真起一个 Miniflare 实例、配 Images binding、发一次 resize 请求。我这 29 个包装上了，那条路径没跑到。所以本期结论的确切边界是“装上了，没跑到”。

谁真的会被打到，我按三种情况拆开。仓库里有 lockfile 的，这事不会自动发生，`npm ci` 装出来的还是你锁住的那版，安全到你哪天主动 bump 为止。`package.json` 里写 `^4.0.0` 的，caret 带你跨不到 5.x，也安全。跑不掉的是两类：写 `latest`、`*` 或者靠 `npx miniflare` 临时拉人的，以及所有 `npm i -D wrangler` 的——你在这件事上没有选择权，它替你钉死了。这不是我推测的风险，是 dist-tag 的机械结果。
![三栏对照：有 lockfile 那栏写装锁住的那版并打勾，写 ^4.0.0 那栏写跨不到 5.x 并打勾，latest · * · npx 那栏写它替你钉死了并打叉；右栏画 wrangler 木箱，5.x alpha 吊牌箭头指向漏斗](/assets/img/silent-defaults/04-comparison-three-declarations.webp)


你这边能立刻做的一件事：`npm ls sharp`。落在 0.35.2 或 0.35.3，抬到 0.35.4。顺手把 `npm ls miniflare` 也跑一遍，看看它是不是 5 开头。

## 注册入口没了：/plus 今天只剩一个登录框

9 月 9 日 13:15（UTC，页面上挂着 `<time dateTime="2026-09-09T13:15:00.000Z">`，作者串里能 grep 到 Adam Wathan）的公告讲 Tailwind 加入 Shopify，我摘三段逐字：

> Fast-forward to today and the framework is installed over 110 million times per week and is trusted by many of the world's biggest companies to style products like ChatGPT, X, Cloudflare, Reddit, and Shopify.
> Nothing changes with Tailwind CSS or any of our other open-source projects. Everything will always be MIT-licensed
> All existing customers will of course maintain their access to products like Tailwind Plus and ui.sh, but we're closing sign ups for new customers to focus on Tailwind CSS at Shopify.

14:49Z 我抓 `https://tailwindcss.com/plus`：302 → `/plus/login` → 200，21,256 字节。去掉 script 和 style，这个页面能看见的文字一共六个字符串：`Login - Tailwind Plus`、`Log in to your Tailwind Plus account`、`Email`、`Password`、`Forgot password?`、`Sign in to account`。没有一处写着停止注册，也没有一个价格数字。`ui.sh` 单独 200。

我 15:27Z 又把这个页面拉下来数了一遍关键字：shopify、Shopify、blog、sign up、closing、ui.sh 全是 0 次；整个页面一共 7 个 href——`/plus`、`/plus/password/reset`、三个 favicon 图标、两个 `rsms.me` 的字体样式表。也就是说，一个手里没有账号的人走到这个页面上，找不到任何一条路能把他带到那篇讲清楚发生了什么的文章。
![手绘浏览器框里只有那 6 串英文可见文字，地址栏留空；中列 7 个 href 刻度，第 4 个旁写 /plus/password/reset；右侧珊瑚色大 0，虚线框标注通向那篇公告的链接](/assets/img/silent-defaults/05-infographic-six-strings.webp)


registry 这一头我今天对过一遍（14:48Z）：`tailwindcss` 的 latest 是 4.3.3，`v3-lts` 还挂在 3.4.19，`next` 是 4.0.0，`insiders` 是 `0.0.0-insiders.41d9cae`。四个 tag 一个没动。所以关掉的确实只是付费产品的门，开源那条线的发布通道照旧——这句是我从 dist-tags 读出来的，不是公告里写的。

分对象。已经付过钱的，公告明说保留访问。没买过的新客，今天起打开 /plus 就是一个登录框，而那句“closing sign ups for new customers”写在博客里，没有指向这个 302 的说明。会撞上这个登录框的，多半是从旧书签或搜索点进来的。这句是我的判断，不是数据。

还有一个我没解决的口径差：官方说 110 million times per week，registry 的 last-week 是 69,920,618（窗口 2026-09-03 到 09-09）。我没找到官方口径说明。私有 registry 和镜像不计数是我想到的解释之一，属于推测。

排一下序。四列，最后一行我不补齐：

| 事件 | 动的是什么 | 有没有明说 | 上周 npm 下载量 |
|---|---|---|---|
| DeepSeek 路由 | 一个模型名背后的权重 | 说了，三个页面三种写法 | 它是 API，npm 上没这个包 |
| miniflare latest | 一个 dist-tag 的指向 | 没说，我看到的是一串零警告 | 13,088,992 |
| Tailwind Plus | 一个付费产品的注册开关 | 说了，但那个页面只剩登录框 | 69,920,618（框架本身） |
| 上期我自己那条命令 | 一个没验就写下来的假设 |

按最后一列排，Tailwind 是 miniflare 的 5.3 倍（69,920,618 ÷ 13,088,992 = 5.34）。可下载量最大的那件，恰恰是唯一一件你打开官网就能看见公告的。第一名我不打算让给厂商。这三桩再安静，厂商至少自己写了公告；只有我那条：欠账写在 22 小时前那篇文章的最后一行，还上是在今天夜里，中间没有任何东西提醒过我一次，除了我自己那句“要么给数要么给报错”。

接下来盯三处，每处都有可核对的观察点：

1. 9 月 14 日 12:00（北京时间）之后，`/v1/chat/completions` 响应体里 `model` 字段回什么。我抓的那三个页面都没写这个字段会不会变，9 月 14 日当天下午，有 key 的人一条请求就能验。如果它仍然回 `deepseek-v4-pro`，那这次换人在响应层面就是隐形的，我会把“只能靠自己的日志记时间戳”当成结论写进下期。
2. `npm view miniflare dependencies.sharp` 的输出。如果 9 月底它还钉在 0.35.2，我不等 wrangler 发版，直接在自己项目的 package.json 里加 `overrides` 抬到 0.35.4。
3. `npm view tailwindcss dist-tags --json` 里 `insiders` 这个键。今天它指向 `0.0.0-insiders.41d9cae`（9 月 8 日 13:59 发布），我要看它会不会变成唯一的 prerelease 通道。

说白了，这三桩没有一个会让你收到 5xx。会让你踩坑的是自己写下来却没跑过的那条命令，我上期就有一条。
