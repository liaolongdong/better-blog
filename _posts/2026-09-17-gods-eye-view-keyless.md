---
layout: post
title: 一个 API key 都不配就能看卫星图？gods-eye-view 用 13 条免密路径彻底终结这个问题
subtitle: 我把全语言周榜第一那家 clone 到 /tmp，全程没填一个 key：21 个图层上屏、0 条 console 错误，另外顺手撞出两件它自己没兜住的事——一句 1.86 秒冷启动指的是哪一列，和一个永远收不到的 413
seo_description: 把开源榜第一的 gods-eye-view clone 到本机跑一遍：不配一个 API key，21 个图层上屏、0 条 console 错误，另外撞出两件它自己没兜住的事。
date: 2026-09-17
categories: [AI, 开源实测]
cover: /assets/img/gods-eye-view-keyless/banner.webp
tags: AI 开源 JavaScript webmcp Agent
---

![手绘封面：一颗绕着观测轨道的地球，和一个手里没接任何设备的小人](/assets/img/gods-eye-view-keyless/banner.webp)

```bash
$ npm run doctor
[ERROR] Node 22.19.0: too old; install Node 24.14 or newer
[OK] npm 10.9.3
[OK] dependencies installed
```

`gods-eye-view` 这周在 GitHub 全语言趋势榜排第一，页面给的周增是 14,777 星，REST 接口拿到的总数是 36,658（2026-09-17T14:09:26Z 抓的）。description 一句话：在浏览器里模拟一颗间谍卫星，except the data is real。

上面那三行，来自一台 node 版本不达标、一个 key 都没填的机器。

它照样把地球画出来了：`dataManager.layers.size` 读到 21，console 错误 0 条。

零。

别急着信，往下看怎么量的。

## 📡 13 条免密路径，是我一行行数出来的

README 第 274 行：

> Fifteen layers and map sources. **Thirteen have a keyless path.**

后面跟一句图例，🟢 免 key、🟡 免费 key、🔴 按量计费。我去数它那张表：15 个数据行，末列带 🟢 的 13 行；没带的是 Live Vessels 和 Active Fires，这两行只给了 🟡。

对上了。

这种对账我做多了，它这次没吹。

免密能做到不是因为有什么魔法，是数据源选型。`dependencies` 一共 6 项：@mapbox/vector-tile、cesium、egm96-universal、mgrs、pbf、satellite.js；声明的是 `cesium ^1.124.0`，装到我机器上是 1.138.0。我在整个 `src` 和 `server` 里 grep `from 'react|from 'vue|from 'svelte'`，命中 0 个文件。底图走 Esri World Imagery 的 keyless 通道，地形也是 keyless 那份；Esri 连不上就自动回落 OSM，地形拿不到就把地形摘掉继续转。DATA_SOURCES.md 那张 51 行的表里，42 行标的是运行时抓取、不入库，7 行是打包随带的快照。

说白了，它把“不配 key 也能跑”当成了一条正常的部署形态在养，而不是一个演示开关。

![13 条免密数据源与两条需 key 的路径分流示意](/assets/img/gods-eye-view-keyless/02-diagram-keyless-paths.webp)

## npm ci 跑了 17 分钟没结束，卡点在下载 Chrome

仓库全树 1,378 项、98,502 KB，其中 `docs/` 占 67.47 MB——那里面只有 17 个 .md、合计 480 KB（最大那个 CURRENT-STATE.md 371,839 B），剩下全是演示 GIF。

我这台机器 git 是 2.23.0，没有 `sparse-checkout` 子命令，`git sparse-checkout init --cone` 原样回我一句 `git: 'sparse-checkout' is not a git command.`。只能退回老办法：把 `core.sparseCheckout` 打开，往 `.git/info/sparse-checkout` 里写两行规则，一行 `/*` 一行 `!docs/`，工作树解出来 43 MB。这一步是我想要的，但它顺手排掉了 docs 里的 17 个 .md，这件事在二十分钟后以 5 个失败测试的形式回来找我——坑是我自己挖的，下一节交代。

然后 `npm ci` 跑了 17 分钟没结束，被我杀掉。整个过程只吐出 6 行：

```
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'gods-eye-view@0.1.1',
npm warn EBADENGINE   required: { node: '>=24.14.0 <25 || >=26 <27' },
npm warn EBADENGINE   current: { node: 'v22.19.0', npm: '10.9.3' }
npm warn EBADENGINE }
npm warn deprecated sourcemap-codec@1.4.8: Please use @jridgewell/sourcemap-codec
```

卡住的不是依赖，是 puppeteer 的 postinstall 在下载 Chrome for Testing。我盯着那个 zip 文件的字节数看：14:25:00Z 是 15,066,485 B，14:26:00Z 是 15,316,201 B，一分钟 25 万字节，整包约 170 MB。

`npm ci --ignore-scripts` 六秒装完，`added 126 packages`，node_modules 222 MB。再把 `PUPPETEER_EXECUTABLE_PATH` 指到本机 Chrome 152，绕开那个下载。

## 4,145 个测试，23 个红的，其中 5 个是我自己弄的

```
# tests 4145
# pass 4121
# fail 23
# duration_ms 114193.565933
```

退出码 1。

23 个失败我逐条归了类。5 条是 ENOENT，全指向 `docs/CURRENT-STATE.md` 和 `docs/KNOWN-ISSUES.md`——上一节我为了躲那 67 MB 的 GIF 把这些 .md 一起排掉了。恢复后单跑那 4 个文件：53 个测试，53 个过。

剩下 18 条全在 `src/pinokioUpdatePreview.test.mjs`，报错是同一句：

```
git init --quiet --initial-branch=main /private/var/folders/…/gev-update-RGi6BJ/origin
failed: error: unknown option `initial-branch=main'
129 !== 0
```

我脱离测试直接验：`git init --quiet --initial-branch=main /tmp/gt` 在这台机器上就是这句 unknown option。

所以是我的 git 老，这 18 个红跟仓库没关系。

但 `engines` 字段只声明了 node（`">=24.14.0 <25 || >=26 <27"`）。git 的下限我在 README、CONTRIBUTING、TESTING 和 docs/ 里 grep 过 `2.28`、`initial-branch`，命中 0 行，也没有 Requirements 小节。一个会把 git 版本变成 18 个失败的测试套件，没在任何地方说它依赖 git 的哪个能力。这仓 4,145 个测试里 325 个是测试文件、110,229 行，占全部代码的 41.0%，这个缺口挺扎眼。

它自带的 QA 面倒是真的能用。把 Chrome 路径喂给 `scripts/qa-application.mjs`，两行 PASS，退出码 0：

```
PASS: startup, data registration, annotations and visible attribution
PASS: terminal teardown releases runtime owners without late browser errors
```

README 第一句卖点就是 “Start without API keys”，而它把这句话写成了一条可断言的路径。这比多写十行文档值钱。

## README 那句 1.86 秒冷启动，指的是表里的哪一列

README 的 `<details>` 里：A point-in-time M5/Chrome capture measured a median 1.86-second cold start.

去 `docs/PERFORMANCE.md` 对表。那张 Startup 表里，1,855.836 ms 这个数在 **Initial settle** 列；App ready 的中位数是 604.849 ms（三次采样 784.980 / 604.849 / 558.527）。

也就是说“1.86 秒”说的是画面稳住，不是应用能用。这两个数在 PERFORMANCE.md 里都写得很规矩，问题出在 README 只把其中一个搬走，列名没带。再往下就查不动了：PERFORMANCE.md 自己写着 the original capture artifacts are not included here, so this page records results rather than defining a runnable benchmark. 我在 `scripts/` 和 `docs/` 里 grep `appReady`、`initialSettle`，只命中这一页，没有任何能跑出这两个数的东西。所以这条不是被我证伪，是我没法核对。

按我自己的口径重测。`npm run build` 之后拿 vite preview 起在 4174，1440×900、关缓存、无 key，就绪条件用的是它 QA 脚本里那一行 `window.__godsEyeView?.voiceCommands`（60 秒超时），不是我另定的：

```
gate  6,057 / 6,894 / 6,733 ms   → 中位 6,733
FCP   2,004 / 2,412 / 2,752 ms   → 中位 2,412
fps   2.5 / 2.6 / 2.0             （rAF 采样）
heap  43 / 43 / 42 MB
```

传输 5,144 KB、244 个请求、21 个图层。我这台是 x86_64 + SwiftShader 软渲染，它那张表是 M5 + Chrome 150 硬件渲染，不同量纲，我不拿这组数打它，而且只取了 3 次样。样本不够这件事写在这儿。

构建本身很快：`✓ built in 6.61s`，dist 30 MB。代价在产物上——`index-*.js` 2,151.19 kB（gzip 641.30 kB），`egm96-universal.esm-*.js` 2,770.50 kB（gzip 1,849.99 kB），vite 自己弹了一句 Some chunks are larger than 1500 kB。dev 模式更夸张：250 个请求、23,200 KB 传输。

![README 的 1.86 秒与我实测的 6,733 毫秒对比](/assets/img/gods-eye-view-keyless/03-bars-coldstart.webp)

## 它把动作收成 28 个名字，跟我 6 月写的那套是两条路

`src/voice/actionSchemas.js` 945 行，里面的 `name:` 我数了，正好 28 个，README 写的 28 voice tools 对得上。前 8 个：fly_to_location、select_nearest_aircraft、adjust_camera_zoom、zoom_to_globe、set_layer_visibility、show_data_layers_menu、set_panel_open、set_context_mode。

我 6 月写 WebMCP 那篇的时候，站在 puppeteer 那边骂过选择器方案脆。GEV 走的是另一个方向：不让模型去 DOM 里翻按钮，而是先把动作起好名字、写好 schema，再挂到 `window.__godsEyeView.voiceCommands` 上。这玩意儿跟 WebMCP 不是一回事，它没实现那套 model context 标准，但两者在解决同一个问题：模型面对一个页面时，能看见的应该是一张菜单，不是一堆 class 名。

语音那条我这边是空的——README 第 228 行明说 voice needs an OpenAI key，没 key 时麦克风按钮直接报不可用。我 POST 了一下 `/api/openai/hud-summary`，返回 200，body 里 `{"configured":false,"code":"OPENAI_NOT_CONFIGURED","summary":null}`，跟它写的行为一致。

我为什么还没在自己那边换这套：这 28 个名字背后是 972 个 js/mjs 文件、269,040 行。给动作起名字不难，写 28 行 JSON Schema 一个下午就够了；难的是让这 28 个名字在 21 个图层同时乱动、相机还在飞的时候依然对得上账——飞过去之后那个动作到底成功了没有，图层关掉了语音还认不认。这部分成本它是拿 110,229 行测试代码买的。我这边没有这个量级的动作面，也没有买这个保险的钱，所以起这个头不值。我会在哪儿用它：给别人演示“agent 怎么调一个页面”的时候，我打算拿它当靶子。一条 `node scripts/qa-application.mjs` 就能证明这条路在本机跑得通，而不用先申请一堆 key、再解释为什么演示要等配额。不会用在任何需要朝向可信的场合。open 的 issue #639 说的就是这件事：相机方位有一部分是哈希猜出来的，函数在 `src/layers/cctv/model.js:117` 的 `headingFromId`，`acc = (acc * 33 + text.charCodeAt(i)) >>> 0` 之后取 `(acc % 16) * 22.5`，16 个桶、每桶 22.5 度，提 issue 的人给的量是 3,997 个摄像头里 2,827 个走这条路。我 grep 了 `headingConfidence`：赋值在 catalog.js 三处，消费方 0 个。这个仓知道自己有些朝向是猜的，它把置信度算出来也存下来了，就是没人读。

![28 个动作名与 41% 测试占比的对照草图](/assets/img/gods-eye-view-keyless/04-sketch-28-actions.webp)

## 413 那一行，我拿 9,025 字节的请求体去撞，它没来

`server/standalone/key-setup.js` 收 key 的那段，262 到 273 行是这个顺序：

```js
let body = '';
// …
if (body.length > 8192) {
  req.destroy();
}
// …
return respond(res, 413, { error: 'Request too large' });
```

我把一个 9,025 字节的 body 打过去，Origin 和 Content-Type 都给对：

```
curl: (52) Empty reply from server
000
```

`req.destroy()` 先把连接掐了，413 那一行没人执行得出去。

紧接着 GET `/api/setup/status` 仍然 200，server 活得很好，所以也不是崩。麻烦的地方在于：这段代码是照着“正常返回一个错误码”写的，实际行为却是“请求凭空消失”。客户端拿到的是 `curl: (52)`，一个 HTTP 状态码都没有；换成浏览器就是一句网络层 fetch failed，控制台不会告诉你“你的 key 太长了”。对一个把安全边界写了几十行注释的项目来说，这种写了却没人验证过的分支，最容易在下一次重构里被悄悄改掉。grep 全仓，413 这个字面量只出现在 key-setup.js:273 自己、`server/providers/overpass.js:83`，剩下 4 处是 40.6413、85.41387 这种坐标数字。

没有任何测试断言过它。

![超过 8192 字节时先 destroy 连接、413 分支永远走不到](/assets/img/gods-eye-view-keyless/05-flow-413-destroy.webp)

先承认另一边：这个闸门本身写得比我见过的多数本地 dashboard 细。准入逻辑抽成了纯函数 `admitKeySetupRequest`（`src/keySetupCore.mjs:208` 起），我直接 import 过来喂了 13 例对抗输入，10 例被拒、3 例放过：

```
loopback 127.0.0.1        ok=true
ipv6 ::1                  ok=true
GET 方法                   ok=true
LAN 192.168.1.5           403 Provider Settings answers only the machine running the server
x-forwarded-for 伪造       403 Provider Settings does not answer proxied requests
origin=evil               403 Cross-origin requests are refused
Host=evil (rebinding)     403 Provider Settings answers only local hostnames
sharing 开着               403 Provider Settings is disabled while sharing is enabled
content-type text/plain   415 Content-Type must be application/json
```

`PROXY_SIGNALS` 9 项任一非空即拒；单个 key 超过 512 字符给 400，未知 key 名给 400。这套东西是真的在防 DNS rebinding 和反向代理。

但同一份安全叙事，另一处没兜住。open 的 issue #22，标签 `security-audit`，8 月 25 号开的，今天还没关，点名 OpenAI 和 Google 的代理中间件在 dev 和 preview 里各注册了一次。我在 HEAD 上 grep：`openai.js:33` configureServer、`:36` configurePreviewServer；`google.js:281`、`:284` 同样两份；全仓 `configurePreviewServer` 10 处。然后在 4174 上逐条 curl：

```
/api/setup/status                  404 {"error":"Unknown API route"}
/api/google/text-search?q=austin   200 {"configured":false,"error":null,"places":[]}
/api/openai/hud-summary            405 {"error":"Method not allowed"}
/api/terrain/heights               400 {"error":"invalid points parameter …"}
/api/firms                         503 {"error":"no_key"}
```

`/api/setup/status` 这条确实被 pin 住了：key-setup.js 第 240 行的 apply 条件写的是 `command === 'serve' && !isPreview`，上面五行注释专门解释 preview 的 command 也是 serve，所以必须把 isPreview 钉住，否则这是个意外而不是保证。另外四条 broker 路由活着。

一个仓库里同时存在“专门写注释解释自己为什么必须钉住条件”，和“issue 挂着、双注册还在、连它引的 `vite.config.js:5216-5223` 都被重构成 187 字节的 re-export”。我倾向于认为这是同一个原因：44 小时里进了 100 个提交，72 个 open issue 只有 25 个打了标签，38 个零评论，16 个贡献者里 samehkhamis 一个人占 333 / 416 次（80.0%）。这种速度下，写得细的和没人跟的是同一批人。

接下来三件事我盯具体的东西，不猜方向：

1. key-setup.js 的 266 到 273 行有没有换位。413 挪到 destroy 前面，我就回来删掉这一节。
2. issue #22 会不会进 release notes。这仓到今天只有 2 个 release，下一个还没有它的编号，我就不把 preview 当本地服务用。
3. PERFORMANCE.md 会不会放出可跑脚本。放出来我用同一台机器、同一组参数重测。

## 顺手记一笔

- archify：59,250 → 65,605，摊下来 1,274 星/天。
- i-have-adhd：一周 +4,224，847 星/天，页面上还写着周增 13,737。
- magnitude：48 星/天，这次四个榜全没有它。
- 本周新建榜上 star>500 的我只一手核实了三个，都不准备推荐：ai-sucks-butt 2,554 星配 0 fork；jev-ultrafast 建仓 17 小时攒 1,033 星，description 是空的；kruzovic7/ai-data-extractor 832 星，唯一一次 push 距建仓 8 分 58 秒，之后 6 天没动。

上期欠的六件事，账放在这儿：

- magnitude 那个 7.6 倍差：还上了，方式不是它承诺的“连抓两天”。我手里攒到 09-09（4,228）、09-12（4,372）、09-17（4,611）三个点，再拿页面周增反推窗口起点，算出来是**窗口错位**：09-12 页面显示的 2,096 盖的是 09-05 到 09-12，那 7 天里它从 2,276 涨到 4,372，接近翻倍，之后掉到 48/天。既不是页面造假，也不是我上期算错，是两个不同的东西。
- 顺手交代一个我自己的缺陷：09-10 那两份榜的快照里，6/22 行和 2/18 行的仓库名被 h2 里的赞助链接占掉了，写成 `sponsors/xxx`。09-12 和 09-17 干净。
- disable-model-invocation 有没有官方定稿：有。今天官方文档给了一张表，`true` 的准确语义是 description 不进上下文、你手动调用时才加载全文，另有反向字段和聚合开关。上期那句“发布 25 个，14 个模型不会主动加载”成立，但我当时的说法比官方口径粗。
- mattpocock/skills 的第一个 plugin tag：还没打。tags 最新仍是 v1.2.3，#1064 没落地，继续盯。
- handraw-style 跟 archify 是不是同类：不是。按上期定的办法走 contents API，MANIFEST.md 1,263 B、SKILL.md 8,268 B，它是 263 个手绘风格的提示词库，不做渲染。这条疑问关掉。
- 还剩两件没做：HyperFrames 的全量渲染、archify 的 `brands capture <url> --json`。真实原因不是腾不出 5.9 GiB 磁盘，是这期 seed 把我派到单主角那条路上，一天全花在 GEV 那个 413 上了。下期擂台一起还。

项目地址：[https://github.com/bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view)

> 别在公网机器上裸跑它的 dev server。它的准入闸门只放本机回环，但 preview 上那几条 broker 路由今天还开着（#22）。

我这周只改一个决定：下次再拿它当基线之前，先把这台机器的 node 升到 24.14、git 升到认 `--initial-branch` 的版本。否则我报出来的 23 个红里，永远有 18 个是我自己的。
