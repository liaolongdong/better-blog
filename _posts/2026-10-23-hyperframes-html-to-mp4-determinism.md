---
layout: post
title: HyperFrames 把 HTML 变成 MP4：我渲两遍逐帧对比，发现确定性有个前提
subtitle: 10 秒 300 帧，两遍 SHA-256 一样；可默认脚手架从 jsDelivr 取 GSAP。
seo_short_title: HyperFrames 确定性渲染实测
seo_description: HyperFrames 用 HTML/CSS 渲成 MP4。我在 macOS 上用系统 Chrome 渲了两次 10 秒视频，逐帧对比哈希，并核了 CDN、render/snapshot 分叉、rAF 三个缺口。
date: 2026-10-23
categories: [AI, 开源实测]
cover: /assets/img/hyperframes-html-to-mp4-determinism/banner.webp
tags: AI 前端 开源项目 评测 工具
tldr: "HyperFrames 用 HTML/CSS 渲染 MP4，我在 macOS 上用系统 Chrome 渲了两遍 10 秒 300 帧，SHA-256 一致；但默认脚手架从 jsDelivr 取 GSAP，普通 Chrome 会走截图降级路径，render 与 snapshot 还有已知分叉。把它当可 diff 的动效源码值得试，当剪辑软件会失望；issue #5959 关掉前别放进自动出片流水线。"
---

![封面：HyperFrames 把 HTML 渲染成 MP4 的确定性实测](/assets/img/hyperframes-html-to-mp4-determinism/banner.webp)

上周给一个 PR 配 8 秒演示。改了一句按钮文案，我又打开录屏软件，重录、重剪、重传，第四遍才把鼠标移出画面。

更烦的是 review。同事问「上一版和这一版差在哪」，我只能把两个 MP4 拖进播放器，来回拖进度条。

HyperFrames 说这事可以变成写 HTML：页面就是视频，渲染结果是确定的。我信了一半，花一晚上渲了两遍，想知道「确定」到底值多少钱。

这篇只回答一件事：它的「确定性渲染」在什么条件下成立，又在什么地方漏风。不是仓库导览，也不是把 README 翻译一遍。我装的版本是 0.8.188，跑的是一台 8GB 内存的 Mac。

## 录屏这条路，疼在改一个字要重来

录屏的问题不是慢，是没有源文件。

QuickTime 和 OBS 录下来的是像素。文案、配色、时间轴全锁在 MP4 里。改一个字，整段重来。想复制上一版的节奏，只能凭手感拖鼠标。

我也试过把演示写成网页，再用脚本截图拼视频。截图好办，难的是「第 3.2 秒应该长什么样」。CSS 动画是给浏览器实时播放的，不是给你任意跳转的。跳到 3.2 秒再截，动画未必在那个位置。

常见的土办法是用 Playwright 打开页面，把 `document.getAnimations()` 的 `currentTime` 统一设成 t，再截。听着可行，实际只对 Web Animations API 生效。GSAP 自己维护时间线，CSS transition 又是另一套。三套时钟得逐个对齐，漏一套就有几帧不对。

Remotion 解决过这个问题：把画面写成 React 组件，用帧号驱动。代价是团队得先接受 React 加一套打包链。为一个十秒的视频，这个前置不算轻。

HyperFrames 走的是另一条路。它不要求你写 React，也不要求你装剪辑软件。你写一个正常的 HTML 页面，它负责把页面按时间切成帧，再拼成 MP4。

我原本以为这类工具只适合做纯动效的片头。看完它的示例清单才发现，它想覆盖的是产品发布、PR 讲解、数据图表、字幕视频这些场景。目标定得越大，我越要先确认最小那条链路靠不靠得住——片头都渲不稳，别的就不用谈。

## 它是什么：把 HTML 的每一帧摊开

一句话定位：**一个用 Chrome 当摄像机、按时间 seek 的 HTML 视频渲染器。**

它的输入是一个普通页面。根节点上写清楚画布尺寸和总时长：

```html
<div id="root" data-composition-id="main"
     data-start="0" data-duration="10"
     data-width="1920" data-height="1080">
  <h1 id="title" class="clip" data-start="0" data-duration="10">Title</h1>
</div>
```

每个要出场的东西是一个 `.clip`，带自己的 `data-start` 和 `data-duration`。动画不用 CSS 的 `animation` 自己跑，而是注册成一条暂停的时间线：

```js
const tl = gsap.timeline({ paused: true });
tl.fromTo("#title", { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0);
window.__timelines["main"] = tl;
tl.seek(0);
```

渲染时，它按帧率算出每个时间点，调用 `seek(t)`，等画面稳定，截一张图，最后交给 FFmpeg 编码。你看到的 10 秒视频，本质上是 300 张 1920×1080 的截图。

![流程图：HyperFrames 从 HTML 到 MP4 的四步渲染链路](/assets/img/hyperframes-html-to-mp4-determinism/02-framework-html-to-mp4.webp)

这张图想说的是：确定性来自「seek 到同一个 t，画面必须一样」。只要有一个环节不受 t 控制，确定性就漏了。

| 项目 | 读数（2026-10-23） |
|---|---|
| 仓库 | heygen-com/hyperframes，Apache-2.0 |
| star | 70,429（GitHub API，2026-10-23 13:26 UTC） |
| npm 周下载 | 510,551（2026-10-12 至 10-18） |
| 最新版 | 0.8.188，2026-10-23 发布 |
| 运行要求 | Node.js 22+、FFmpeg |

它显然不只是个 CLI。仓库里还有一整套给编码 Agent 用的 skills，README 的第一屏就在教 Claude Code、Cursor 怎么装。这也是它这周在 Trending 上的原因之一。但我更关心本地这条渲染链路，因为那才是我能验证的部分。

「seekable animations」这几个字是重点，也是它和普通网页最容易混淆的地方。浏览器里的动画默认挂在实时时钟上：你打开页面，它从零开始跑。渲染器要的不是这个，而是「给我第 84 帧」这种可重复的取数。所以它要求你把动画注册到 `window.__timelines`，由它来 seek。

这套约定有一个直接好处：预览和渲染读的是同一条时间线。你在浏览器里拖到第 5 秒看到什么，理论上渲染出来就是什么。也埋下了后面的坑——「理论上」三个字，得靠实现来兜底。

模板里还有一个 `hyperframes.json`，声明 registry、blocks 和 assets 的路径。默认的 registry 指向 GitHub 上的 raw 文件。也就是说，除了 npm 包本身，你在用 `add` 装区块时还会访问第二个外部地址。这个我这次没用到，但看配置文件就能看出来。

`preview` 我没深入用，只确认了它存在。按 README 的说法，它会在浏览器里起一个带热更新的工作台。对写动画的人来说，这一步比渲染重要：你先得看见，才谈得上调。可它不在我今晚的验证范围里，我只看成片。

还有一条边界值得提前说：音频。`doctor` 里的 whisper、TTS、BGM 全是红的，都是可选项。这次渲染的产物是无声的，日志里 `hasAudio: false`。带配音、配乐的流程能不能稳定复现，我没验到，也不打算拿一个空白模板的结果替它背书。

## 第一次 render：我先卡在 Chrome 下载上

安装本身不慢。`npm install hyperframes` 42 秒，74 个包。npm 顺手留了一条 warning，说 esbuild 的 postinstall 没被 allowScripts 覆盖。我没去处理，渲染照样跑起来了，但这行黄字一直挂在那里，算是今晚第一处没消掉的刺。

初始化也顺利：

```bash
npx hyperframes init hf-demo --example blank --non-interactive
```

生成的项目很小：一个 `index.html`、一个 `hyperframes.json`、一个只有三条脚本的 `package.json`。空白模板就是一行居中的标题，时长 10 秒，1920×1080。

然后跑 `doctor`，第一条红字就来了：

```text
✓ Node.js   v24.22.0
✗ Memory    8.0 GB total · 1.6 GB available
            Low memory — renders may fail.
✓ FFmpeg    ffmpeg 9.0.1
✓ Chrome    system: /Applications/Google Chrome.app/...
```

这台机器只剩 1.6GB 可用内存。工具没有拦我，只是把风险写在脸上。后来渲染能跑完，但整个过程风扇没停过。

真正的坑在第一次 `render`。

命令敲下去，终端没有任何进度。我等了八分钟，只看到它在一个隐藏目录里下载 `chrome-headless-shell`，压缩包停在 12MB。不是报错，就是不动。

我一开始以为是 jsDelivr 卡了，因为脚手架从 CDN 取 GSAP。单独 `curl` 那个文件，1.7 秒就下来了。问题不在 CDN，在 Chrome 下载。

翻 `node_modules` 里的 dist 代码，找到两个环境变量：`PUPPETEER_EXECUTABLE_PATH` 不管用，真正生效的是 `HYPERFRAMES_BROWSER_PATH`。我把系统 Chrome 的路径指过去，清掉半截缓存，再跑。

```bash
HYPERFRAMES_BROWSER_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  npx hyperframes render -q draft -w 1 -o renders/first.mp4
```

这次两分钟不到就跑完了：

```text
90.5 KB · 10.0s video · rendered in 1m 35.6s
screenshot capture · hardware gpu · setup 9.5s · capture 1m 22.0s
```

10 秒视频，渲了 95.6 秒，差不多 9.5 倍实时。日志里还有一行关键的：`captureMode: "screenshot"`。

正常路径应该用 `chrome-headless-shell` 的 `HeadlessExperimental.beginFrame`，逐帧推进；用普通 Chrome 时，这条路走不通，只能退回截图模式。所以上面这个速度，是降级之后的速度。优化路径我这次没验到，因为 Chrome 就是下载不下来。

这里有个判断我一开始做反了。看到「下载 Chromium」卡住，我的第一反应是网络慢，想换镜像。实际是工具在装一个专用的 headless shell，和系统 Chrome 不是一个东西。至少从输出看，`doctor` 只报了系统 Chrome 的位置，没提这个专用包；所以它全绿，`render` 仍然会去下载。这两条检查没打通，用户很容易在第一次渲染时卡住。

我也想过干脆用 `--docker`。`doctor` 里 Docker 是红的，本机没装，这条路直接断了。所以下面所有读数，都是「系统 Chrome + 截图降级路径」下的读数，不代表它在优化路径上的表现。

![终端截图：doctor 的内存告警与首次渲染的真实耗时](/assets/img/hyperframes-html-to-mp4-determinism/01-screenshot-terminal.webp)

顺带一提，`lint` 对这个空白项目给了 0 errors、0 warnings。它没意见。`info` 报的是 1920×1080、10 秒、2 个元素、1 条轨道。项目小到没什么可挑的，这也意味着后面的确定性是最好情况，不是平均水平。

## 它说确定性，我渲了两遍逐帧比

README 的原话是「turning HTML, CSS, media, and seekable animations into deterministic MP4 videos」。

确定性这件事，光看文档不算。我把同一个项目、同一个命令、同一台机器，连着渲了第二遍。

```bash
npx hyperframes render -q draft -w 1 -o renders/second.mp4
```

第二遍 1 分 27.2 秒，文件也是 90.5KB。比第一遍快了 8 秒，这 8 秒纯粹是机器状态差异：第一遍刚装完依赖，缓存是冷的；第二遍编译只花了 1.8 秒，第一遍是 3.8 秒。耗时变了，产物没变，这恰恰是确定性该有的样子。

然后比两件事：整个文件的 SHA-256，以及逐帧的 `framemd5`。

```text
ff228253d47310a39b6033421f71396bd9728005d72590a97872a55bcdffd6c0  first.mp4
ff228253d47310a39b6033421f71396bd9728005d72590a97872a55bcdffd6c0  second.mp4
```

两个文件一模一样。不是「画面看起来一样」，是字节级相同。

这一点有点出乎我意料。FFmpeg 默认会在容器里写创建时间和编码器版本之类的元数据，两次跑的 mtime 不同，文件通常不会字节相同。HyperFrames 显然在这层做了处理，把能固定的都固定了。至于它具体改了哪些 muxer 参数，我没往下追。

再用 FFmpeg 把每一帧解出来做哈希，310 行输出（含文件头），`diff` 退出码 0。300 帧、30fps、1920×1080、h264、yuv420p，全部对得上。

逐帧哈希比文件哈希更能说明问题。文件哈希只能证明「这两个文件一样」；帧哈希能证明「第 0 帧到第 299 帧，每一帧都一样」。如果哪天容器元数据变了、文件哈希对不上，但帧哈希还对得上，那画面仍然是可复现的。反过来，文件一样但帧不一样，几乎不可能发生。

| 复测项 | 第一遍 | 第二遍 |
|---|---|---|
| 耗时 | 1m 35.6s | 1m 27.2s |
| 文件大小 | 90.5 KB | 90.5 KB |
| 帧数 | 300 | 300 |
| SHA-256 | ff2282…d6c0 | ff2282…d6c0 |
| framemd5 差异 | 0 行 | 0 行 |

**在这台机器、这个 Chrome、这份 HTML 上，它确实做到了字节级可复现。** 这个结论比我预期强。

强度也要标清楚：我只比了「同一台机器、同一个 Chrome 155、同一个 Node 24.22、没有音频、没有外部图片」。跨机器、跨浏览器版本、带音频、带视频素材的情况，一个都没测。所以这不是「HyperFrames 永远确定」，是「在这个最小条件下，它确定」。

但我没有就此收工。

## 三个缺口：CDN、render 与 snapshot 分叉、rAF

确定性不是产品性质，是输入的性质。只要有一个输入不受控，输出就不确定。

第一个缺口就在默认脚手架里。空白模板的 `<head>` 第一行是：

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
```

GSAP 从公网 CDN 取。仓库里有个还开着的 issue，编号 #6028，2026-10-21 提的，标题写得很直白：`pr-to-video: assemble-index.mjs hardcodes the jsDelivr CDN for GSAP (breaks offline / restricted-network renders)`。提的是另一个子项目，但默认模板是同一个毛病。

我把 CDN 地址换成一个不存在的域名，再跑 `snapshot`。退出码 0，没有任何报错。截出来的图还是那张，标题端端正正——只是动画没了。

这比报错更难受。**它不会失败，只会安静地少掉一层。** 如果这个项目再接进 CI，你拿到的是一份「成功」的静态视频。

想补这个洞也简单：把 GSAP 下载到 `assets/`，改成相对路径。仓库里已经有模板这么做了吗？我没逐个翻。至少我生成的空白模板没做。

第二个缺口是 render 和 snapshot 走两套逻辑。issue #5959，2026-10-20：`render` 不会给图片 clip 应用 GSAP 的 scale/position tween，而 `snapshot` 和 `keyframes` 是对的。也就是说，预览和成片可能不是一个东西。对「所见即所得」的承诺来说，这比慢更严重。

它为什么危险？因为你的验收流程通常是先看 snapshot。snapshot 对了，你以为成了，交付出去的 render 却是另一个画面。这类错误不会在日志里出现，只会在别人点开视频时出现。

第三个缺口藏在帧边界。issue #5888，2026-10-19：PNG 序列在 seek 之后，可能截到还没提交的 virtual-rAF DOM 更新。一次两次看不出来，定时跑就可能偶尔闪一帧。

| 缺口 | 触发条件 | 我验到的结果 |
|---|---|---|
| CDN 依赖 | jsDelivr 不可达 | snapshot 退出 0，动画静默消失 |
| render/snapshot 分叉 | 图片 clip + scale/position tween | 未亲测，issue #5959 仍开着 |
| rAF 提交时机 | PNG 序列 + seek 后更新 | 未亲测，issue #5888 仍开着 |

这三条不影响我上面那次复测的结论，却决定了这个结论能延伸到哪。空白模板、静态标题、同一个 Chrome，是最干净的条件。换成真实项目，先问自己：所有资源都在本地吗？预览和成片用的是同一条路径吗？

## 和 Remotion、录屏比

把同类放一起，差别就清楚了。

| 维度 | HyperFrames | Remotion | 录屏 |
|---|---|---|---|
| 写法 | HTML/CSS + seek 时间线 | React 组件 + 帧号 | 手动操作 |
| 前置 | Node 22、FFmpeg | React、打包链 | 无 |
| 可 diff | 是，MP4 可逐帧比 | 是 | 否 |
| 我这台机器上的 10 秒速度 | 95.6s（截图降级路径） | 未测 | 实时 |
| 失败模式 | 资源静默缺失 | 编译/运行时错误 | 人眼漏看 |

**这张表的结论不是谁更强，是「什么团队该走哪条路」。**

已经全员 React 的团队，Remotion 更顺：组件、props、生态都是现成的。设计稿本来就是 HTML/CSS 的团队，HyperFrames 少一层翻译，改一行文字就能重渲。

迁移成本也得算。Remotion 的学习成本不在 API，在「怎么把一个网页视觉拆成可组合的组件」；HyperFrames 的学习成本在时间线：哪些动画能 seek、哪些属性不能碰、外部资源放哪里。两边都不便宜，只是花的地方不同。

只做一次、不打算维护的 30 秒演示，录屏仍然最快。别为了「工程化」给一次性任务上构建链。

真正拉开差距的是「改第十遍」的时候。录屏的第十遍和第一遍一样贵；HyperFrames 的第十遍只改源代码，再等一分半。

速度这一栏我没法给 Remotion 一个公平数字，因为没在同一台机器上跑过它的同类项目。所以别拿 95.6 秒去和任何 Remotion 基准比。我能负责的只有 HyperFrames 这一格。

还有一个差别在「谁来写」。Remotion 的组件更像传统前端工程，人和 Agent 都能写，但 Agent 要先理解你的组件库。HyperFrames 把技能包直接发给 Agent，让它照着模板写 HTML。前者可控，后者上手快。团队里谁维护这段代码，比技术本身更影响选择。

## 谁该用，谁先别用：三步上手

适合的：

- 要反复改文案、配色、节奏的产品演示和发布视频。
- 已经有 HTML/CSS 视觉资产，不想再翻译成 React。
- 想把「生成演示视频」放进 Agent 或 CI 流水线的人。
- 数据动画、图表竞速这类画面本来就该由代码生成的题材。

先别用的：

- 需要真人出镜、多轨剪辑、复杂音频混音的。它是渲染器，不是剪辑软件。
- 内存吃紧的机器。我这台只剩 1.6GB，`doctor` 直接给了黄牌。
- 离线或受限网络环境，又没把 GSAP 之类的外部脚本搬进本地。
- 要求跨机器、跨 Chrome 版本绝对一致，又不打算用 Docker 的团队。`render --docker` 我没验到。

还有一个隐性成本：它是 0.x 版本。今天 0.8.188，一周好几个 release。对个人项目这是活力，对要长期维护的生产流水线就是升级噪声。我今晚装的版本，下周可能就不是默认版本了。

三步上手，命令都能直接粘：

```bash
# 1. 装依赖，起一个空白项目
npm install hyperframes
npx hyperframes init my-video --example blank --non-interactive

# 2. 先体检，尤其看内存和 Chrome 路径
cd my-video
npx hyperframes doctor

# 3. 渲两遍，比哈希
npx hyperframes render -q draft -w 1 -o renders/a.mp4
npx hyperframes render -q draft -w 1 -o renders/b.mp4
shasum -a 256 renders/a.mp4 renders/b.mp4
```

第三步是我建议所有人都做一次的。两行哈希一样，你才真正拿到了「确定性」；不一样，先别急着接 CI。

接下来可以盯一个信号：issue #5959 什么时候关。如果 render 和 snapshot 的分叉修掉，它才配得上「所见即所得」这四个字。

## 我的判断：当「可 diff 的动效」，别当剪辑软件

我的判断很明确：**把它当成「可 diff 的动效源码」，值得试；当成剪辑软件，会失望。**

它最值钱的地方不是渲染快——9.5 倍实时一点也不快——是改完之后，你手里有源文件，也有一条能逐帧比对的产物。上一版和这一版差在哪，`framemd5` 会告诉你，不用再拖进度条。

代价也写清楚：默认模板依赖公网 CDN；用普通 Chrome 会掉进截图降级路径；render 和 snapshot 还有已知分叉。这三条都不致命，但每一条都能让「确定性」变成一句口号。

我给自己定了个可检验的条件：如果到 11 月底，issue #5959 还开着，我不会把它放进任何自动出片的流水线，只拿它做本地手动渲染。

这条判断也可能错。如果维护者认为 render 和 snapshot 本来就该有两套语义，那 #5959 不算缺口，是我理解错了契约。真到那天，我会把这一节改掉。

回到开头那个 PR。下次再改按钮文案，我希望源文件是一个 HTML，改完重渲，比一遍哈希。鼠标不用再移出画面。

至于这台 8GB 的机器，我大概会先把内存加上去。渲染器再省，Chrome 还是要吃饭的。

项目地址：https://github.com/heygen-com/hyperframes

参考：

- README 与 Quick Start：https://github.com/heygen-com/hyperframes（抓取 2026-10-23）
- issue #6028：https://github.com/heygen-com/hyperframes/issues/6028（2026-10-21）
- issue #5959：https://github.com/heygen-com/hyperframes/issues/5959（2026-10-20）
- issue #5888：https://github.com/heygen-com/hyperframes/issues/5888（2026-10-19）
- npm 下载量：https://api.npmjs.org/downloads/point/last-week/hyperframes（抓取 2026-10-23）
