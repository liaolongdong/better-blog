---
layout: post
title: 别再问我 Next 该升到哪版：16.3.3 关掉 AVIF，6 天 3 小时后 16.3.4 又打开
subtitle: 我把三个版本的 image-optimizer.js 拉到本地对着看，发现决定 AVIF 到底有没有在跑的那行字，不在 Next 的版本号里
date: 2026-09-10
categories: frontend npm
cover: /assets/img/nextjs-avif-trap/banner.webp
tags: npm next JavaScript 前端小技巧 开源
---

# 别再问我 Next 该升到哪版：16.3.3 关掉 AVIF，6 天 3 小时后 16.3.4 又打开

![Next.js 镜像优化器中 AVIF 开关被关掉又打开的示意图](/assets/img/nextjs-avif-trap/banner.webp)

16.3.4 里的 `image-optimizer.js`，和 16.3.2 的那份字节级一模一样。我 `shasum -a 256` 打的，两份都是 `e9dae780db97eb11cbed0c5b1c872dc249fedfe9`，只有 16.3.3 是另一个值。

先说清前提，免得你按我的步骤跑出一堆对不上的数。我自己的项目是 Vue 3 + wxt + Vite 写的浏览器插件，手上没有跑在 Next 上的站，下面所有判断来自 `/tmp/aviftest` 下的 11 个临时空目录：6 个装 next（16.3.2 / 16.3.3 / 16.3.4 / 15.5.25 ×3），5 个只装 sharp（0.35.3 / 0.35.4 / 0.34.5 ×3），不来自线上。还有这台机器的 `/usr/local/bin/node` 是 v16.16.0，PATH 里得手动切到 nvm 的 v22.19.0，不然 `next start` 连不起来——我第一遍就没切，白折腾一趟。

## 🧾 公告正文那句“AVIF 已被禁用”，我在发行版里没找到

9 月 8 日 21:21（UTC），Vercel 公开了 [GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)，标题是 *Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used*，等级 critical，没分配 CVE 编号。正文第二段只有两句话：

> A vulnerability in the underlying `libheif` library used by `sharp` which Next.js uses for image optimization can lead to remote code execution when AVIF files are optimized.
>
> Until a fix has propagated, optimization of AVIF files is disabled.

我的翻译：底层 libheif（sharp 在用、Next 又用 sharp 做图片优化）里的一个漏洞，可以在优化 AVIF 文件时导致远程代码执行；在补丁铺开之前，AVIF 文件的优化是关着的。

问题在时态。我 9 月 9 日 16:15（UTC）抓回来的那份 JSON，`updated_at` 只比 `published_at` 晚 1 秒——这句话从公开到现在一个字没动。可我 16:29 在本地读过的 `next@16.3.4`，翻它的 `BYPASS_TYPES`，AVIF 不在里面。v16.3.4 的发布时间是 8 月 31 日 20:02，比这份公告公开**早 8 天 1 小时 19 分**。得说清楚：公告那两个 `first_patched_version`（15.5.24 和 16.3.3）到今天仍然成立，别把它当成版本号写错了，过期的只有上面那句现在时。

顺带把源头的时间钉一下。上游 libheif 的两份公告是 8 月 25 日 11:17:10Z 和 11:19:23Z 公开的，隔了两分钟；Next 这边关掉 AVIF 的那个 PR 是同一天 14:52:06Z 开的。中间三个半小时。整件事的起点不是 9 月 8 日，是 8 月 25 日的上午。9 月 8 日 20:51 还有另一份 [GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36)（CVE-2026-75604，Windows 主机上的 RCE，同样 critical，`updated_at` 晚 3 秒）。这篇不讲 Windows 那条，我没有 Windows 机器，写不出可核对的东西。

## 🔍 16.3.3 动了两处，不是一处

我一开始以为它只往 `BYPASS_TYPES` 里塞了个 `AVIF`。grep 到 209 行的时候才发现不对。16.3.2 里这段是这样的：

```javascript
// next@16.3.2  dist/server/image-optimizer.js:207-210
_sharp.unblock({
    operation: [
        'VipsForeignLoadHeif',
        'VipsForeignLoadJpeg',
```

16.3.3 的同一处，`'VipsForeignLoadHeif'` 整行没了，列表首项变成 `'VipsForeignLoadJpeg'`，而 `VipsForeignLoadHeif` 这个字符串在整个文件里出现 0 次。

所以 16.3.3 干的是两件事。请求侧，把 AVIF 划进绕过名单；解码侧，让 libvips 的 HEIF/AVIF 加载器保持在 blocked 状态——扒开看，sharp 的用法是先 `block({operation:['VipsForeignLoad']})` 全关，再逐项 unblock 白名单，白名单里没它，它就是关着的。前者是别走这条路，后者是把路挖断。挖断那条更狠，因为你就算自己配了 `image/avif` 主动要 AVIF 输出，也一起停。绕过那半边具体做了什么，看 15.5.25 的 :1046 那行更清楚，命中的是这个分支：

```javascript
if (BYPASS_TYPES.includes(upstreamType) || upstreamType === AVIF && !canDecodeAvif(...)) {
    return {
        buffer: upstreamBuffer,
        contentType: upstreamType,
        maxAge,
        etag: upstreamEtag,
        upstreamEtag
    };
}
```

返回的是 `upstreamBuffer`，也就是上游原图字节，连 `etag` 都用上游那个。图片照常 200，尺寸、格式、ETag 全对，监控上什么都看不见。唯一的区别是没人帮你压过了。

![绕过分支的流程图：能解码走压缩后返回，不能就把上游原图直出，状态码仍是 200，监控无异常](/assets/img/nextjs-avif-trap/03-flowchart-bypass-path.webp)

---

## 🧬 恢复的两处和 16.3.2 字节相同，那这六天改了什么

到 16.3.4，两处一起恢复，位置跟 16.3.2 一字不差——`VipsForeignLoadHeif` 回到 209 行。所以两个文件才会算出同一个 SHA-256。看 diff 更能感觉到分量。关掉那次是 [#97875](https://github.com/vercel/next.js/pull/97875)（*disable avif image optimization*，eps1lon 开的），+220 / −20 / 14 文件；重新打开那次是 [#97931](https://github.com/vercel/next.js/pull/97931)，+185 / −347 / 17 文件，删的比加的多近一倍。它的 body 逐字：

> Reverts #97875 and bumps `sharp` from `^0.35.3` to `^0.35.4`, re-enabling AVIF image optimization.

也就是说这次安全缓解在源码里存了 6 天 3 小时 45 分，然后被完整撤销，撤销得连一行注释都没剩下。时间线还有个细节我觉得挺真实。#97875 是 8 月 25 日 14:52 开的、16:12:52 合并，v16.3.3 在 16:17:10 发布——合并到发版之间 4 分 18 秒。而两个 backport PR（#97949 / #97954）是在 8 月 26 日下午开的，比它们要 backport 的 #97931 合并时间（当天 21:28）还早三四个小时，然后一起挂了 5 天 1 小时左右才合。看着就是有人一边把 canary 的改动往前推，一边先把两条发布分支的补丁开好放着。

![时间轴：8 月 25 日上午两条 libheif 公告，下午关掉 AVIF 并发布 v16.3.3，到 8 月 31 日 v16.3.4 恢复，中间那段是 6 天 3 小时](/assets/img/nextjs-avif-trap/02-timeline-six-days.webp)

## 📦 真补丁在 package.json 那一行

把五个已发布 tarball 的 `optionalDependencies.sharp` 挨个读出来：

- `next@16.3.2` → `^0.35.3`
- `next@16.3.3` → `^0.35.3`
- `next@16.3.4` → `^0.35.4`
- `next@15.5.24` → `^0.34.3 || ^0.35.3`
- `next@15.5.25` → `^0.34.3 || ^0.35.4`

整个事件在源码层面留下的永久改动，就是两处 `^0.35.3` 变成 `^0.35.4`。这件事不用我猜，16.3.x 那个 backport PR 的标题就写着：*Re-enable AVIF image optimization and require sharp 0.35.4*。抬版本下限被维护者自己列进了标题，跟“重新打开优化”是并列关系，不是顺手改的依赖。

而 sharp 那份公告（[GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c)）写的受影响区间是 `< 0.35.4`，first_patched `0.35.4`——照这个区间，0.34 全线都在里面。我查了 sharp 在 registry 上的版本列表，0.34 线最高还是 `0.34.5`，**没有 0.34.6**。所以 15.5.25 那行 `^0.34.3 || ^0.35.4`，左边一半确实允许装上有漏洞的版本。

看着像疏漏。但它不是。

而且这里有个更容易被忽略的机制：`optionalDependencies` 装不上是不报错的。我那次在 Node 18 下装 next@15.5.25，npm 退出码 0，树里 sharp 的位置写着 `UNMET OPTIONAL DEPENDENCY`，一个警告都不算。你 CI 绿着，图片优化默默退化成了原图直出。

---

## ⚙️ 15.5.25 换了个做法：运行时去看 libheif 的版本

15 线没照抄 16 的 revert。它的补丁是 [#97954](https://github.com/vercel/next.js/pull/97954)（base `next-15-5`，8 月 31 日 18:56 合并，+320 / −172 / 9 文件），新增一个导出函数，并把 unblock 改成条件执行。15.5.25 发行包里的实际逻辑：

```javascript
// next@15.5.25  dist/server/image-optimizer.js:214-228
_sharp.unblock({
    operation: [
        'VipsForeignLoadJpeg',
        // ...白名单里没有 Heif
    ],
});
if (isAvifDecodeSafe(_sharp.versions?.heif ?? null)) {
    _sharp.unblock({
        operation: [
            'VipsForeignLoadHeif'
        ]
    });
}
```

判据就是三段大小比较：`major > 1 || (major === 1 && minor > 23) || (major === 1 && minor === 23 && patch >= 2)`。请求侧的绕过条件也跟着改了——15.5.25 的 `BYPASS_TYPES` 里没有 AVIF，AVIF 走的是后面那半句 `upstreamType === AVIF && !canDecodeAvif(...)`。结果缓存在模块级的 `_avifDecodeSafe`（:260），一个进程只判一次。

PR 里给这段的注释，我原文贴：

> libheif before 1.23.2 has critical memory safety vulnerabilities in AVIF decoding (GHSA-g89c-p67h-r497 and GHSA-2jg2-4ch7-h545). sharp only bundles a patched libheif starting with 0.35.4, and Node 18 installs always resolve the vulnerable 0.34 line, so the decoder version is checked at runtime instead of relying on the sharp version.

我的翻译：libheif 1.23.2 之前的 AVIF 解码有 critical 级内存安全漏洞；sharp 从 0.35.4 起才打包打过补丁的 libheif；而 Node 18 的安装永远会解析到有漏洞的 0.34 线，所以改成运行时检查解码器版本，不再依赖 sharp 的版本号。（有个小地方我卡了一下：Next 想停掉 AVIF，动的开关叫 `VipsForeignLoadHeif`，不是某个 `LoadAvif`。为什么 heif 这个加载器管着 avif，我没去翻 libvips 的文档。）

## 📊 我装了三个 sharp，读出三个 heif 版本号

一行 `require('sharp').versions`，三次独立安装。脚本原始输出，没删：

```bash
$ bash meas.sh          # node v22.19.0 / npm 10.9.3，2026-09-09T16:28:28Z
requested=sharp@0.35.3 installed=0.35.3 -> heif=1.23.1 vips=8.18.3 sharp=0.35.3
requested=sharp@0.35.4 installed=0.35.4 -> heif=1.23.2 vips=8.18.6 sharp=0.35.4
requested=sharp@0.34.5 installed=0.34.5 -> heif=1.20.2 vips=8.17.3 sharp=0.34.5
```

三个 sharp，三个 heif 号，一个不差。libheif 那份公告（[GHSA-g89c-p67h-r497](https://github.com/strukturag/libheif/security/advisories/GHSA-g89c-p67h-r497)，CVE-2026-84383）写的区间是 `>=v1.22.0, <= v1.23.1`，补丁版 `v1.23.2`。0.35.3 装的正好是 1.23.1，卡在区间上沿；0.35.4 装的 1.23.2，刚好出去。差一个 patch 号，跨过一条 critical。结论就是：15 线的用户到底有没有在跑 AVIF 优化，取决于你 lockfile 里 sharp 解析成了什么，跟 `next -v` 显示 15.5.25 没关系。

![三根柱子对着 1.23.2 这条虚线：sharp 0.34.5 读出 1.20.2，0.35.3 读出 1.23.1 差一点点，0.35.4 读出 1.23.2 刚好越线](/assets/img/nextjs-avif-trap/05-infographic-heif-versions.webp)

## 🚪 扣出发行版的门控函数，我喂了六个值

不放心自己读代码读得对不对，把 15.5.25 的 `image-optimizer.js` 直接 require 进来调：

```bash
$ node -e "const g=require('./g15/node_modules/next/dist/server/image-optimizer.js').isAvifDecodeSafe; ..."
"1.20.2" -> false
"1.23.0" -> false
"1.23.1" -> false
"1.23.2" -> true
"2.0.0" -> true
null -> false
--- 该目录真实 sharp ---
heif=1.23.2 vips=8.18.6 sharp=0.35.4 => gate true
next version = 15.5.25
```

能跑。

六个输入六个输出，跟判据一致，`null` 走 false。

16.3.x 那三条里根本没有这个函数，grep `isAvifDecodeSafe` 全为 0——你会发现 16 线靠版本号硬切，15 线才看解码器，两条线的修复形状是不一样的。这个差别 release note 里没写：v16.3.3 和 v15.5.24 的 body 都只列了那两个 Critical 公告的标题，通篇没有“AVIF 优化被关掉了”这句；到 v15.5.25 才有一句 *re-enabling AVIF Image Optimization when newer versions of `sharp` are installed*。

![左右对照：16 线改的是 package.json 里 sharp 的依赖下限，15 线是运行时拿 heif 版本号开一道闸](/assets/img/nextjs-avif-trap/04-comparison-two-fixes.webp)

---

## 我没能复现官方注释里的那句话

注释里那句 *Node 18 installs always resolve the vulnerable 0.34 line*，我想验。

nvm 里最接近的是 18.17.0。装完：

```bash
$ node -v
v18.17.0
$ npm ls sharp
t@1.0.0 /private/tmp/aviftest/m-v18.17.0
`-- (empty)

# 安装元数据里留存的两行
+-- @img/sharp-libvips-darwin-x64@1.3.3 extraneous
  +-- UNMET OPTIONAL DEPENDENCY sharp@^0.34.3 || ^0.35.4
```

它什么都没装。不是装了 0.34.5。

这次测量本身也是被污染的，我先把话说在前面：npm 在安装期就抱怨

```
npm WARN EBADENGINE Unsupported engine {
npm WARN EBADENGINE   package: 'next@15.5.25',
npm WARN EBADENGINE   required: { node: '^18.18.0 || ^19.8.0 || >= 20.0.0' },
npm WARN EBADENGINE   current: { node: 'v18.17.0', npm: '9.8.1' }
npm WARN EBADENGINE }
```

18.17.0 连 next 自己声明的下限 `^18.18.0` 都没到，我手上没有 18.18+ 可切。所以这句注释我既没能证实也没能推翻。也可能是我这台机器的 x64 平台包组合问题。真起服务发请求那一头也没跑成。我本来想拿同一张 AVIF，在 16.3.3 和 16.3.4 下各请求一次 `/_next/image`，把两边字节数贴给你。用系统默认 Node 起服务就撞了：

```
$ npx next start -p 3111
Error: Cannot find module 'caniuse-lite/dist/unpacker/agents'
code: 'ERR_MODULE_NOT_FOUND'
Node.js v16.16.0
```

切到 v20.11.1 重装那一步我没做完。所以这篇里没有一对真实的响应字节数可以给你，所有判断都停在源码级和函数级。

顺带说个我觉得更有意思的东西：同一条漏洞链，三份公告给了三个等级。libheif 自己那份是 critical，描述里写 *The overflow size and written values are attacker-controlled*，还补了一句 *Any application using `heif_decode_image()` is affected. No special API options or unusual calling patterns are required.*；另一份 [GHSA-2jg2-4ch7-h545](https://github.com/strukturag/libheif/security/advisories/GHSA-2jg2-4ch7-h545) 标题直接写 *Remote Code Execution*，也是 critical，但没分配 CVE 编号，区间 `<=1.23.1`、补丁版 `1.23.2`。sharp 那份降到 high：

> The attack vector for these claims to be "network" however sharp does not provide any networking features so this vulnerability is down-rated to a "High" severity using CVSSv4 but please note its Subsequent System Impact.

我的翻译：这些说法把攻击面算作 network，但 sharp 自己不提供任何网络功能，所以按 CVSSv4 降级成 High，不过请注意它对下游系统的影响。

Next 把组合起来的向量标 critical。我倾向 critical，理由是触发条件是解码一个别人上传的文件，而 Next 的图片优化 API 就是公开收这个文件的那一层——“sharp 自己没网络功能”这句在 Next 的部署形态里不成立。这条是判断，不是实测。接下来我盯两件事。一是 sharp 的 0.34 线会不会补 `0.34.6`：如果它出来并且打包的 libheif ≥ 1.23.2，那 15 线上把依赖锁死在 0.34 的人第一次拿到一个「装得上、gate 又放行」的组合，`isAvifDecodeSafe` 会从 false 直接翻成 true。二是 canary：我抓的时候 `next` 的 canary dist-tag 是 `16.4.0-canary.23`，我会在它往前推十几个版本时回去 grep 一次 `isAvifDecodeSafe` 有没有出现在 16.x 的发行包里。16.3.x 那三条我已经 grep 过，没有。真搬过来了，就说明 Vercel 自己也不认“把 sharp 抬到 `^0.35.4`”是够的。

## 查自己项目：一条 npm ls，一条 grep

**锁在 15.5.x 的人**，别看 next 的版本号，直接看解码器：

```bash
node -p "require('sharp').versions.heif"
```

小于 `1.23.2` 就是 gate 关着的状态。我这台机器上三种 sharp 的读数是 1.20.2、1.23.1、1.23.2。如果你顺手想看 next 解析到了哪版 sharp，`npm ls sharp` 出 `(empty)` 或者 `UNMET OPTIONAL DEPENDENCY`，那 AVIF 一定没在优化——`getSharp` 抛异常会被 `canDecodeAvif` 的 catch 吞掉，按 unsafe 处理，注释里写得很明白：*Without sharp no AVIF can be decoded either, so treat it as unsafe and let the image pass through unoptimized.*

**跑 16.3.3 的人**，升到 16.3.4。理由不是有新版本，是 16.3.4 的 `optionalDependencies` 把 sharp 下限抬到了 `^0.35.4`，那才是这次真正留下来的修复；图片优化器里被改掉的那两处，六天后已经完整撤销了。不过顺手记一个不太顺耳的实测：我那三个 16.3.x 目录里，npm 解析到的其实都是 `sharp@0.35.4`——`^0.35.3` 今天在 registry 上就给得出它。所以抬下限真正影响到的是锁文件已经把它压在 0.35.3 上的项目，不是当天新装的人。**不经过 Next、自己 `require('sharp')` 解图的人**，sharp 那份公告直接给了规避代码，我原样抄回来：

```javascript
sharp.block({ operation: ["VipsForeignLoadHeif"] });
```

同一段它还提醒了一句 *be warned that the "official" Node.js binaries do not*，说的是官方预编译的 libvips 没开 PIE。这两条我一行都没实测，我没有绕过 Next 直接用 sharp 的项目，贴出来只是因为它比 next 的版本号更对症。

**没在 `image.formats` 里写过 `image/avif` 的人**，这次大概率跟你没关系。`next/dist/shared/lib/image-config.js:58` 的默认值是 `formats: ['image/webp']`，同文件 :57 的 `minimumCacheTTL` 默认 14400 秒，正好 4 小时。只有你的源图本身是 AVIF，或者你在 `<Image>` 上显式要过 avif，才会碰到这条路径。

再补一个干净安装的数据点，说明为什么这行值得你自己跑一遍。我在全新目录装 `next@15.5.25`（Node v22.19.0），`npm ls sharp` 的原始输出：

```
g@1.0.0 /private/tmp/aviftest/g15
`-- next@15.5.25
  `-- sharp@0.35.4
```

新装落在 gate 放行那一侧。老项目里那个躺了很久的 `sharp@0.34.x` 会不会被 `npm update` 抬过去，我没测——锁文件在，多半抬不动，但这是我的推测，不是我跑出来的。

还有一类人我得说一下：上游 CDN。这次没有任何一个环节会给你 5xx。AVIF 源图走的是绕过分支，返回原图字节和上游 ETag，浏览器和 CDN 都把它当成一次正常命中。真正会先发现异常的是你的图片体积报表，不是你的告警。我这边的结论就一句话：这次没有哪一行 Next 的版本号能替你回答「AVIF 有没有在跑」，得去问解码器。我自己那套 wxt + Vite 的构建里根本没有这一段，所以这篇写完，我改不了任何自己线上的东西，能改的只有下期的复现脚本。

至于下期，我把“拿 v20.11.1 把 `<Image>` 的 AVIF 请求字节数真跑出来一次”记进了账。下次要么给你两个 KB 数，要么告诉你我又没跑成。

> 如果你自己维护一个会接收用户上传图片的服务，这次真正的教训不在 Next 的版本号上，在 `heif_decode_image()` 这个入口。libheif 的公告原话是不需要任何特殊 API 选项、也不需要非常规调用方式就能走到溢出。

参考：[GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)、[#97875](https://github.com/vercel/next.js/pull/97875)、[#97954](https://github.com/vercel/next.js/pull/97954)、[v16.3.4 release](https://github.com/vercel/next.js/releases/tag/v16.3.4)、[GHSA-g89c-p67h-r497](https://github.com/strukturag/libheif/security/advisories/GHSA-g89c-p67h-r497)。数据抓于 2026-09-09 16:15–17:03 UTC。
