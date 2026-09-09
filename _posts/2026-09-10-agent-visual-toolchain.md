---
layout: post
title: 🚨 别再死磕 AI 自动出图了！我这周试了 4 个项目，2 个卡在半路
subtitle: archify 的品牌表里没有 Vite，HyperFrames 的 init 顺手 clone 了整仓，最后跑通的是 chrome-devtools-mcp
date: 2026-09-10
categories: AI frontend open-source
cover: /assets/img/agent-visual-toolchain/banner.webp
tags: AI 前端 开源 Agent webmcp
---

# 🚨 别再死磕 AI 自动出图了！我这周试了 4 个项目，2 个卡在半路

![编码 agent 试图自己产出图表却接连卡住的现场](/assets/img/agent-visual-toolchain/banner.webp)

```
feat(telemetry): persist date of the last tool call.
```

chrome-devtools-mcp 在我抓数据前 55 分钟刚合进去一条 PR，标题就这一句（#2705，UTC 9 月 9 日 15:13，2 个 commit，改了 5 个文件，标签空、评论 0）。我是凌晨 0 点 08 分从 API 抓的。它跟出图没关系，但那天夜里我在这个仓库上耗得最久，看到有人在管遥测的时间戳，心里松了一下。

松早了。往前翻两页，另一条报错在等我：

```
Brand mark validation failed:
- /components/1/brand "vite" is not a built-in brand; closest IDs: airtable, alibaba-cloud, angular, ansible, anthropic
```

## 我要的不是 agent 再给我一段 Markdown

我做这个博客的发布链路是 Markdown 进 Jekyll 出，中间 Vite 只管 assets，评论和阅读量走自建的 Waline Worker。上个月我在一篇讲 WebMCP 的文章里塞了一段 mermaid，第 57 行那个代码块。这个博客没有 mermaid 渲染器：`_config.yml`、`package.json`、`assets/js`、`_includes`、`_layouts` 我全 grep 过，一处都没有。所以那段的读者看到的是一行行源码文本。

![Jekyll 博客里一段没人渲染的 mermaid 源码，和读者实际看到的画面](/assets/img/agent-visual-toolchain/01-scene-mermaid-no-renderer.webp)

所以这周我的目标很具体：让编码 agent 把它自己干的活画成一张图，产物要能直接落进 `_posts/`，不许留一段等别人去渲染的文本。

按这个标准我从 Trending 里挑了 4 个仓库，最后 2 个卡在半路，卡的都不是算法，是网络和磁盘。

## 第一个仓库我只 clone 到一半

yang0/handraw-style，图是手绘风格的，我先看上的就是这个长相，因为博客里那些方框箭头实在不像人画的。

clone 断在 index-pack：

```
Cloning into 'handraw-style'...
fatal: early EOF
fatal: index-pack failed
```

我重试了一遍，一模一样。这个仓库到底多大我不知道，clone 没完成，仓库接口那个 size 字段也没给我拿到。它就此出局，后面三步里都没它。

## archify 出图了，但它的品牌表里没有 Vite

预期：它吃 typed JSON，吐自包含的 HTML/SVG，那我那七个节点的发布链路总能画出来。

这条 Trending 周榜 TypeScript 第 1 位，55,778 颗星（我 0 点 08 分抓的，同一时刻 Trending 页面上印的是 55,776，差 2）。

实际：前半段全中。`doctor` 15 项全 `[ok]`；官方示例渲染出来的文件 813,020 字节；我那份 IR 0.45 秒出图，803,406 字节；`check` 返回 `"issues": []`。这些是真的。

拦住我的只有 brand 那一个字段。107 个品牌 id 分成 9 类，framework 那类 13 项全是运行时：angular、django、dotnet、fastapi、flask、next-js、node-js、pytorch、react、spring、svelte、tensorflow、vue。构建工具和样式层，0 个。我拿 24 个名字挨个测，vite、webpack、esbuild、tailwind、jekyll、astro、bun、deno、nuxt、pinia、element-plus、wxt、vitest 全部不在表里。

![107 个品牌图标排成九类，构建工具那一格是空的](/assets/img/agent-visual-toolchain/02-infographic-archify-brand-missing-vite.webp)

> 那句 closest IDs 不是相似度推荐。airtable、alibaba-cloud、angular、ansible、anthropic 五个全是 a 开头，跟 vite 一点关系都没有。源码在 `renderers/shared/brand-marks.mjs:432-440`，score 只有 0 和 1 两种取值，排序是分数优先、再按 `localeCompare`，取前 5。它给的是字母表前五个。报错原文里倒确实留了出口：`run archify brands capture <url> --json for an unknown official site`，这条我没试（别问我为什么知道要写进正文，因为我差点把它当成已验证的结论）。

我的处理方式很怂：把 brand 字段整个删掉，Vite 那一格纯文本写着 Vite，图就出来了。做 AI 内容生产方案评测的人大概会关心这套 schema 校验做得多严，而我只纠结一件事，我画的是 Jekyll 加 Vite，Vite 在我这儿只编译 assets、不参与页面构建，偏偏这张图里没有 Vite。

还有一处让我停了很久。ROADMAP.md 第 216 行起有一张 "Not planned" 表，12 个被明确拒绝的方向，每条写了理由。色盲安全调色板那条给的理由是维护成本高于收益，下游 fork 自己写 30 行 CSS 变量就行；Mermaid 解析器搬的是一次验证实验的结论，日期就写在句子里，2026 年 4 月 16 日那次做完，作者认定 auto-layout 加 archify 自己的 CSS 并不比原版 Mermaid 明显更好；YAML 当 IR 被划掉是怪空白符敏感，说 LLM 生成的 YAML 容易看着对、解析错。这三条我认同，敢把不做的事写下来并给理由，比 roadmap 上排十个待办诚实。我对它的意见只有一个：一个画系统架构的图工具，图标表里一个构建工具都没有。

## 装完 374MB，它又跑去 GitHub clone 了一遍

heygen-com/hyperframes，48,295 颗星，描述是 Write HTML. Render video. Built for agents. npm 上 0.8.33，上周 247,701 次下载。

装它：138 个包，10 秒，node_modules 374M，包自己 33M。多出来的是 onnxruntime-node、sharp、puppeteer-core、fontkit 这些。换回我 shell 默认的 node 16.16.0，CLI 拒绝启动：

```
HyperFrames requires Node.js >= 22 (current: 16.16.0). Switch Node versions and retry.
```

`doctor` 列了七项 ✗：磁盘剩 0.3 GB、frames cache 同样只剩 0.3 GB、whisper-cpp、Kokoro TTS、MusicGen、Docker、Docker 没跑。它退出码是 0。

`init demo --yes` exit 1，回一句 `Non-interactive init requires --example, --video, or --audio`。我瞎猜的 flag 确实是瞎猜的，正确写法是 `--non-interactive`。98 秒后 demo/ 里有 6 个文件、32K 骨架，`lint` 报 0 errors 0 warnings，一个空骨架过 lint 说明不了任何事。

同一份日志里还有另一段：

```
Checking AI coding skills against GitHub...
Installing HyperFrames skills...
■  Failed to clone repository
│  fatal: unable to access 'https://github.com/heygen-com/hyperframes.git/': HTTP/2 stream 1 was not closed cleanly before end of the underlying stream
▲  Skill(s) still missing after install: hyperframes, hyperframes-animation, ...
```

![npm 装了 374MB 之后，init 又自己去 GitHub clone 整仓，网络在中间断掉](/assets/img/agent-visual-toolchain/03-flowchart-hyperframes-init-reclone.webp)

9 个 skill 没装上，命令 exit 0。npm 包里那份 README 178 行，skill 这个词出现 0 次，会去 GitHub clone 整仓这件事一个字没提。render 我没跑，盘只剩 88 MB，而 doctor 自己写着 renders produce large temp files。

跳过这件事其实写在帮助里，但写成了这样：`--skip-skills  [temporarily ignored] init always checks AI skills against GitHub while the skills.sh registry catches up; set HYPERFRAMES_SKIP_SKILLS=1 to opt out (CI/tests)`。前半个 flag 是装饰，真正起作用的是那个环境变量。我在 CI 里跑东西的习惯是先看 flag 再看 env，这条得反过来记；而它连 README 都不写，我第一次运行只会看见 missing 后面那九个名字。

那 374 MB 是我这周第二次被自己的机器卡住。第一次是 clone archify 那 55M 之后开始算着空间干活。

## 最后跑通的是 Google 那个

chrome-devtools-mcp 1.9.0，51,447 颗星，上周 npm 下载 1,465,302。clone 下来数了数：src 里 80 个 .ts、19,676 行，package.json 的 dependencies 是个空对象，我一个个点开看的；puppeteer 精确 pin 在 25.10.0。

我写了个本地页面，注册一个叫 `fill_comment` 的工具，喂给它。`list_webmcp_tools` 返回空。加 `--categoryExperimentalWebmcp`，还是空。再加 `--enable-features=WebMCP`，工具出来了，调通了，表单填上了。中间我在同一张页面上执行过一行表达式：`document.modelContext` 是有对象的，`navigator.modelContext` 是 undefined。页面这边一直备着挂工具的地方，拿不到列表的原因不在这段脚本里。

![同一张页面在有无 Chrome feature flag 下的两种结果，门槛藏在 --help 里](/assets/img/agent-visual-toolchain/04-comparison-webmcp-chrome-flag.webp)

我 6 月在这博客里写这玩意儿要 Chrome 149。我这台机器的 Chrome 是 152.0.7977.77，flag 还得自己加。

到这一步我本来准备开一句「文档没写这个要求」。这句是错的，我自己 grep 打脸的：

- c54a493 那份 clone，README.md 146 行，webmcp 出现 0 次；
- `docs/tool-reference.md` 807 行，WebMCP 那节第 738 行只说 `Use the '--categoryExperimentalWebmcp' flag`；
- Chrome 150+ 和那个 flag 整句话在 `src/config/category-options.ts:48`，yargs 的 describe，也就是只有 `--help` 才吐得出来。

往前翻，PR #2163 的 diff 显示这行 6 月 1 日还写在 README 的配置表里（Chrome 149+ 改成 150+），#2223 又把 `WebMCPTesting` 换成 `WebMCP`。句子被改过两次，挪走的那一次我查不了：clone 用的 `--depth 1`，本地只有 1 条提交。这个判断卡在这儿，我暂时也没法替它找解释。

遥测我是照着 README 第 45 行关的，它写明 `Data collection is enabled by default`，`--no-usage-statistics` 才关得掉，第 55 行补了一句设了 `CI` 环境变量也会关。我的 cron 里确实有 CI。但显式加 flag 这件事我做了，靠一个 env 兜底的开关，哪天换台机器就没了。

至于优势，它赢在“别的都不用装”：`dependencies: {}`，跑起来只有一个守护进程和系统 Chrome，UA 是 `HeadlessChrome/152.0.0.0`。我顺手做了件无聊的对照，同一个 1200x2029 的页面截三档质量，WebP 是 9,400 / 26,084 / 54,987 字节，JPEG 是 27,372 / 72,467 / 123,884。我没去查官方有没有做过大小宣称，这组数只是我自己的。

三个仓库的 size 字段并排放着看有点意思：chrome-devtools-mcp 10,911 KB、archify 138,615 KB、HyperFrames 416,821 KB；建库时间分别落在 2025 年 9 月 11 日、2026 年 4 月 15 日、2026 年 3 月 10 日；star 是 51,447 / 55,778 / 48,295；fork 3,614 / 3,658 / 4,425；open issues 105 / 144 / 93。最后一次 push 离我抓数据最近的那两条只差 55 分钟和 24 分钟，最旧那条也在 20 小时之内，三个都还在动。这周我没被盘和 node 版本卡住的那一次，偏偏发生在最小的那个仓库上。我不把它读成定律，三个东西分工不一样：HyperFrames 那 17 个运行时依赖里写着 onnxruntime-node、sharp、puppeteer-core、fontkit，它要把 HTML 渲成视频，字体和模型得自己背；archify 背的是 107 个品牌图标加一套 SVG 渲染器；Google 那个只带一个 CLI，真正跑页面的进程是系统里那个装好的 Chrome。这些数我也只能横着摆这一次——rotation-state 里还没有上一期的 star 快照，所以「它这周涨了多少」这句话我现在没资格说。

### 什么时候我会真用它

我在 wxt + Vue 3 那个密码管理插件里还没接这套。插件测试用的是 wxt 自己拉浏览器的路子，我没碰到选择器脆到撑不住，所以这条链我暂时用不上，这是没实测的部分，别按我的结论推。

三件事，各有验证点。盯 archify 的 ROADMAP.md，看 Not planned 那 12 行里会不会冒出 vite 或者 webpack；如果 v2.17.0-dev.1 到 10 月底还挂着 dev.1（ROADMAP.md:3 现在明写它不是稳定版），我就不把它写进自己的出图默认项。盯 chrome-devtools-mcp 的 README，看 `--enable-features=WebMCP` 什么时候回到配置表里，等下一次 Chrome 稳定版更新它还没回来我就提 issue。HyperFrames 那边盯 `--skip-skills` 的帮助文本，现在那行还写着 `[temporarily ignored]`，它哪天真能跳过，我才敢在 CI 里跑 init。

## 我打算提的 issue，和没干完的活

我搜过：标题带 webmcp 的 issue 一共 6 条，全是 closed 的 PR，没一条在说文档站丢了 Chrome 侧这条要求。所以草稿我写了，没提：

```
标题：WebMCP: the Chrome-side flag is only in --help, not in tool-reference.md
正文：--categoryExperimentalWebmcp 一节说 "Use the '--categoryExperimentalWebmcp' flag"，
但 list_webmcp_tools 在 Chrome 152 上不加 --enable-features=WebMCP 会返回空列表。
同样的句子在 src/config/category-options.ts:48（yargs describe）里有，README 146 行里 0 次。
建议把 Chrome 版本和 flag 补回 tool-reference 那一节。
复现：macOS，系统 Chrome 152.0.7977.77，chrome-devtools-mcp 1.9.0
```

没提的原因是提 issue 是对别人仓库的公开动作，我想先把 README 那段自己补一行发个 PR，比提 issue 管用。

- [ ] 给 chrome-devtools-mcp 的 `docs/tool-reference.md:738` 提 PR，把 Chrome 150+ 和 flag 补回去
- [ ] handraw-style 重新 clone，这次先 `git ls-remote` 探一下
- [ ] HyperFrames 的 render 跑一次完整的，前提是我把盘清出 2 GB
- [ ] 把博客里那段 mermaid 换成 archify 出的图，先看图挂 Pages 上糊不糊
- [ ] archify 的 `brands capture` 那条出口试一次，看它能不能自己收下 vite

跑通的那两个，一个改我现在的写作流程，一个改我插件的测试流程。跑不通的那两个，一个还没跑过一次完整渲染，一个我连它多大都还不知道。

这周能得出的结论就这么大：让 agent 自己出图现在能干活，但得接受它反过来跟你要东西，要 22 以上的 node，要 2 GB 临时盘，要你手里那条 flag。

> 这篇不讲 HyperFrames 的渲染质量，我一次 render 都没跑；也不讲 camofox-browser（10,815 颗星），它 README 第一条是绕 Cloudflare 和反爬检测，不适合被我写成推荐。

项目地址：[https://github.com/tt-a1i/archify](https://github.com/tt-a1i/archify)、[https://github.com/heygen-com/hyperframes](https://github.com/heygen-com/hyperframes)、[https://github.com/ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp)
