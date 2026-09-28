# 第三方内置件许可清单（THIRD-PARTY-NOTICES）

这份清单只回答一个问题：仓库里那些**不是本站创作、却跟着仓库一起分发**的文件，各自欠上游什么。

授权总纲不在这里——代码看 `LICENSE`（MIT），文章与配图看 `LICENSE-CONTENT.md`（CC BY-NC-SA 4.0）。
本文件不新设条款、也不放宽那两条，只把「MIT 与 CC 都不主张」的那一部分点名列清楚，
并写明每一条的**判据**：是逐字节比对出来的、还是文件自带声明、还是根本确证不了。

## 口径：什么进这张表，什么不进

- **进表**：git 跟踪的、内容非本站原创的文件（代码、字体、图标、数据快照）。
- **不进表**：运行时从 CDN 拉的脚本（那是引用而非再分发，例如 `demo/shareDemo/index.html` 走 cdnjs 的
  social-share.js）；node 的 devDependencies（构建期依赖，`package.json` 已声明，不随站点分发）；
  构建产物（`assets/**` 与 `demo/**` 下的 `.min.js` / `.min.css` 已 gitignore，其上游与对应源码同一行）。
- **不重复搬运**：目录级的既有清单继续留在那儿——字体三条见 `assets/fonts/LICENSES.md`（SIL OFL 1.1），
  区划 / GB2260 历史码 / 银行卡 BIN / 号段四张数据表见 `assets/data/LICENSES.md`（含 pin 的 commit 与哈希）。
  本文件只指路，不抄它们的哈希，避免两份记录各说一套。

## 一、逐字节比对已确证（就是上游那一份）

比对口径：取上游 npm tarball 或 GitHub tag 的 codeload tarball 里的原文件算 SHA-256，与站内文件比。命中即「同一份」。
sha 一律只写前 8 位（前缀足够定位，重算方式见第五节）。

| 站内文件 | 上游 | 版本 | 许可 | 版权行与判据 |
| --- | --- | --- | --- | --- |
| `ace/`（402 个 JS） | ajaxorg/ace-builds | 1.4.6 | BSD-3-Clause | Copyright (c) 2010, Ajax.org B.V.。许可原文已放进 `ace/LICENSE`（1490 字节，sha 850f545c…，与 tarball 内 `package/LICENSE` 逐字节相同）；402/402 与 tarball 的 `src-min/` 逐文件同哈希 |
| `dev/libJs/jquery.min.js` | jquery/jquery（npm `jquery`） | 3.7.1 | MIT | (c) OpenJS Foundation and other contributors，banner 在文件第 1 行；与 `dist/jquery.min.js` 同哈希（fc9a93dd…） |
| `dev/libJs/social-share.min.js` | overtrue/share.js（npm `social-share.js`） | 1.0.16 | MIT | Copyright (c) 2014 Carlos - 安正超。与 `dist/js/social-share.min.js` 同哈希（7c63eefa…）；min 产物里没有版权头，**本行即那条保留声明** |
| `assets/fonts/iconfont.{eot,svg,ttf,woff}` | 同上，`dist/fonts/` | 1.0.16 | MIT | 4/4 同哈希。它是 social-share.js 的 `socialshare` 图标字体，被 `dev/libCss/share.min.css` 以 `../fonts/iconfont.*` 引用。**与 `assets/iconFont/`（iconfont.cn）同名不同物，不是重复件，别按重名删** |
| `demo/echartsDemo/lib/vconsole.min.js` | Tencent/vConsole（npm `vconsole`） | 3.1.0 | MIT（腾讯前言版） | Copyright (C) 2017 THL A29 Limited, a Tencent company。文件头 banner 自带声明与仓库链接；与 `dist/vconsole.min.js` 同哈希（95e1f07e…）。上游那份 LICENSE 是 792 字节的「4 段腾讯前言 + MIT 正文」，不是纯 MIT 模板，机器按模板识别容易判成未识别 |
| `demo/echartsDemo/lib/fastclick.js` | ftlabs/fastclick（npm `fastclick`） | 1.0.6 | MIT | `@copyright The Financial Times Limited` + `@license MIT License (see LICENSE.txt)` 在文件顶部 `@preserve` 块里，随文件一起分发；与 `lib/fastclick.js` 同哈希（1aa08cb3…） |
| `demo/likeWxFloatDragBtnDemo/js/vue.min.js`<br>`demo/openMapDemo/js/vue.min.js` | vuejs/vue（npm `vue`） | 2.6.12 | MIT | (c) 2014-2020 Evan You，banner 在文件头。两份站内同哈希（29296cca…），且都等于 `dist/vue.min.js`——同名两份是历史遗留，不是两个版本 |
| `demo/idCardDemo/lib/GB2260.js` | mc-zone/IDValidator tag `v1.2` 的 `src/GB2260.js` | v1.2 | MIT | 147465 字节，与上游逐字节相同（7ddc4d7a…）。上游许可原文在 tag tarball 里叫 `MIT-LICENSE`（1100 字节，sha 26efe3b3…，正文首行 `Copyright (c) 2014 mc-zone`），README 的 `## License` 一节也写着 MIT；文件名不合 GitHub 的识别惯例，所以它大概率把这个仓库显示成未识别——那是命名问题，不是没有授权 |
| `dev/libJs/js-yaml.esm.min.mjs` | nodeca/js-yaml（npm `js-yaml`） | 5.4.2 | MIT | 78721 字节，与 tarball 的 `package/dist/browser/js-yaml.esm.min.mjs` 逐字节相同（154ea2da…；整包 tarball 0003d2f5…，两个哈希都记进了判据注释，为的是「从上游复算」这条路一直留着）。版权串就是文件第 1 行那条 banner：`/*! js-yaml 5.4.2 https://github.com/nodeca/js-yaml @license MIT */`。它是**唯一**有机器判据的内置件——`scripts/toolkit-tests.mjs` 的 U1–U5 钉了字节数、两个哈希、banner 逐字、四个 Node 专属词各 0 次、全仓库唯一 import 点（`dev/js/tools/json-convert.js`）、以及「`package.json` 与 `pnpm-lock.yaml` 里 `js-yaml` 出现 0 次」。换版本 = 换文件 + 改那五条里的两个哈希与版本串 + 复跑 §U 与 §W；**不许顺手 `sed` 它**，那是压缩产物不是源码（尾部那条指向站内不存在的 `.map` 的引用也照原样留着，理由见 U1） |

## 二、改过的（derivative，底本可指认）

MIT / BSD 都允许改写，但改了什么得写清楚，否则下次没人敢动它（怕动坏上游的行为）。

| 站内文件 | 底本 | 许可 | 本地改动 |
| --- | --- | --- | --- |
| `dev/libJs/canvas-nest.js` | hustcc/canvas-nest.js（npm `canvas-nest.js`）**1.0.0 的 `canvas-nest.min.js`**（1700 字节；那份 tarball 里两个文件都在包根，不在 `dist/`） | MIT © 2015 Hust.cc（上游 `LICENSE` 1097 字节，首行 `Copyright (c) 2015 Hust.cc`） | 底本判据：单字母函数名 `o(w,v,i)` / `j` / `l` / `k` / `b` 与上游 min 一致，站内这份是把它展开成缩进可读形态（106 行）。两组改动：① 生命周期——`cnLife.running` 暂停闸门 + `window.CanvasNest.stop()` + 覆盖 `window.on*` 前存旧值以便还原（`cnLife` 站内 4 处命中，上游 min 里 0 处）；② 四个兜底默认值被调过：zIndex -1→999、opacity 0.5→0.9、color "0,0,0"→"255,255,255"、count 99→199——站内注入脚本时只给 `src` 不给属性（`dev/js/about.js` 的 `STAR_SRC`），所以这四个就是线上生效值。文件头那句「相对上游原版唯一的改动是补一套生命周期」漏了第 ②组。文件内没有版权头，**本行即那条保留声明** |
| `demo/idCardDemo/lib/IDValidator.js` | mc-zone/IDValidator tag `v1.2` 的 `src/IDValidator.js`（那份文件头自署 v1.1.0） | MIT | 23 行差异：`checkArg` / `isValid` / `getInfo` 新增 `forceType` 长度参数；`info.sex` 由 0/1 改为 '女'/'男'；头部版本号改写成 v1.2.0。站内 sha 8b191910…，上游 sha d37e4fb1… |
| `dev/libCss/share.min.css` | social-share.js 1.0.16 的 `dist/css/share.min.css` | MIT © 2014 Carlos - 安正超 | 一处：`@font-face` 末尾加 `font-display:swap`，并在文件头一行注明 vendored（P0-11）。4190 字节 vs 上游 4047 字节，其余逐字节相同 |

## 三、确证不了版本，或权利归属待办

这一节是全仓许可证合规真正的风险面。列出来说明「查过、查不到」，比留白或写一个想当然的版本号诚实。

| 站内文件 | 上游 | 判据与缺口 | 处置 |
| --- | --- | --- | --- |
| `demo/echartsDemo/lib/echarts.min.js` | apache/echarts | 文件内自署 `u_="4.2.0",h_={zrender:"4.0.5"}`（压缩后的版本常量与 zrender 版本对，`grep -o '.\{20\}4\.2\.0.\{40\}'` 可见）；npm 从未发布 4.2.0 稳定版（4.2 系只有 4.2.0-rc.1、4.2.0-rc.2、4.2.1-rc.1/-rc.2/-rc.3、4.2.1），且与这三者的 `dist/echarts.min.js` 字节数全不同：站内 362298、4.2.0-rc.1 744675、4.2.0-rc.2 744702、4.2.1 747390；也不是任何一个官方裁剪产物（rc.2 的 `echarts.simple.min.js` 305436、`echarts.common.min.js` 470049）→ 这是一份在线定制构建：`grep -oE '\{type:"[a-z]+",render:'` 在站内那份只命中 bar / grid / title 三个视图注册，rc.2 那份命中 13 个（另 10 个是 boxplot、candlestick、funnel、gauge、heatmap、map、parallel、radar、scatter、toolbox），**基线无法确证** | 许可原文与 NOTICE 已放进同目录：`LICENSE` 12036 字节（f324bfd5…）、`NOTICE` 181 字节（64d90f53…），取自 tag 4.2.0-rc.2。NOTICE 与 4.2.1 那份逐字节相同；LICENSE 与 4.2.1 差 19 字节，差在末尾的 d3 子组件附录（rc.2 列 6 个文件且写作 `src/...` 无首斜杠、含 `src/util/array/nest.js`；4.2.1 列 5 个、写作 `/src/...`）。Apache-2.0 的 4(d) 要求「随附许可副本 + 保留 NOTICE」，这两条现在都落地了。附录点名的那批 d3 派生文件（BSD-3-Clause）对应的类型——treemap / tree / graph / Time 刻度——在这份定制构建里已经被裁掉了（`seriesType:"treemap"` 在站内 0 命中、rc.2 那份有），所以严格说 d3 那一层多半不随这份产物生效；原文照附不减合规，多附不扣分 |
| `dev/libCss/github-markdown.css` | sindresorhus/github-markdown-css | 站内 12391 字节（162897df…）；与各版本 npm tarball 里的 `package/github-markdown.css` 都不逐字节相同：2.8.0 13520（e787b6d5…）、2.9.0 13659（cb483a1d…）、3.0.0 17645（146af97c…）、3.0.1 17660（8f2586b6…）、4.0.0 16608（71fd2eb4…）→ 是裁剪改写，但**砍在哪几行没有记录**。文件里还内嵌 `@font-face{font-family:octicons-link; src:url(data:font/woff;base64,…)}`，那份 woff 是 GitHub Octicons，随本站一起分发 | MIT © Sindre Sorhus，按许可保留署名即可；版本缺口留档，下次要动它先重建基线 |
| `dev/libJs/prism.min.js`、`dev/libCss/prism.css` | PrismJS/prism | 两个文件第 1 行是同一条 prismjs.com 定制下载 URL：`themes=prism-okaidia&languages=markup+css+clike+javascript+bash+coffeescript+go+java+php+python+sass+scss+swift`（13 种语言，`head -1 … \| sed 's/.*languages=//' \| tr '+' '\n' \| wc -l` 可数；js 22482 字节、css 1924 字节），包内不含版本号；定制包与上游任何单个 `components/*.js` 不同形，**无法逐字节比对** | MIT © **Lea Verou**（npm `prismjs` 的 author 字段，latest 1.30.0，`license: MIT`）；站内这两份里没有版权串，署名以本清单为准 |
| `dev/libCss/normalize.min.css` | necolas/normalize.css（npm `normalize.css`）6.0.0 | 站内 2216 字节。npm 那份 6.0.0 的 tarball 里只有未压缩的 `normalize.css`（7381 字节），没有对应的 min 产物 → 压缩后形态无法逐字节比对；能比的是 banner：站内首行 `/*! normalize.css v6.0.0 \| MIT License \| github.com/necolas/normalize.css */` 与上游未压缩版首行逐字节相同，所以版本按 banner 记 | MIT © Nicolas Gallagher，无改动；上游那份许可原文在 tarball 里叫 `LICENSE.md` |
| `dev/libJs/cursor-effects.js` | tholman/cursor-effects（npm `cursor-effects`，latest 1.0.18） | 类名 `Circle` / `Boom` / `CursorSpecialEffects` 与上游一致，本地三处改动写在文件头（色相随机、半径景深、resize 跟随视口），另外自己加了 `nightMode` / `hslToRgb` / WCAG 亮度反解。改动幅度大 → 无法逐字节比对。权利这一头：上游 master 的 tarball 里**根本没有 `LICENSE` 文件**（`tar -tzf` 数 `licen` 命中 0 次），授权只写在 `readme.md` 第 219 行的 `# License` 一节——"MIT af, but if you're using the scripts a GitHub sponsorship … would always be appreciated"；npm 元数据的 `license` 字段是 MIT | 授权意图是明确的（作者亲自署了 MIT），只是没有机器可读的原文可随附。要么向作者取一份 LICENSE 原文放进目录，要么按 readme 那句 sponsorship 的意愿付一次赞助并把凭据记在这里 |
| `dev/libJs/weixinJsSdk.js` | 微信 JS-SDK（jweixin，Tencent） | 21458 字节 / 741 行。没有 banner 式的版本声明，也没有许可或版权文本（文件里的 `version: 1` 是上报字段，不是发版号）。**不是开源件**：它是《微信 JS-SDK 使用协议》下的官方脚本；另外这份副本会向 `https://open.weixin.qq.com/sdk/report` 发携带站点 appId 与页面地址的上报请求（第 125 行），这条副作用是"随仓库分发的一份官方脚本"才会有的，写在这里是为了下次有人想知道它联网做什么 | 待办：改成运行时从官方 CDN 加载（仓库里就不留副本），或在本清单固化权利归属与协议链接 |
| `dev/libJs/baiduPush.js`、`dev/libJs/baiduStatistics.js`、`dev/libJs/soPush.js` | 百度统计 / 百度搜索资源平台 / 360 搜索的站点嵌入代码 | 各平台服务协议下的插桩代码，不是开源软件；文件里带着本站的站点标识（`hm.js?a071a73d…`、`11.0.1.js?268d5071…`） | 列这一行只为一件事：这三份不是本站写的，别按 MIT 放开 |
| `assets/iconFont/`（9 个文件：`iconfont.{css,js,eot,woff,woff2,ttf,svg}` + `demo.css` + `demo_index.html`） | iconfont.cn 项目 `font_985780`（编号全目录只在 `demo.css` 的 `at.alicdn.com/t/font_985780_km7mi63cihi.*` 里出现，`iconfont.css` 与 `demo_index.html` 都没写） | css 里有 8 个 `.icon-*:before` 类名、7 个语义词（白天模式／夜间模式／三角形／联系我们／二维码／返回顶部，"公众号"占两个：`gongzhonghao` 与 `gongzhonghao1`）。两次下载：首次入库 6716b07（2019-01-17 19:59 +0800），包内时间戳 `t=1545807318834`＝2018-12-26；现用这份是 dc71769（2019-01-18 18:08 +0800）换上的第二次下载，`t=1547794084188`＝2019-01-18 14:48 CST，四个二进制同步变大（eot 3812→3884、ttf 3644→3716、woff 2500→2544、woff2 2004→2044 字节）。iconfont.cn 授权的是"项目内引用"，**单个字形的著作权仍属于上传它的那个用户**，本站未逐字形溯源 | 待确权。`_config.yml` 只排掉了脚手架 `demo_index.html`；`demo.css`（539 行演示样式）实测仍在 `_site/assets/iconFont/` 里，是否连它一起退役见下一步方案 |

## 四、许可原文的落位

- BSD-3-Clause（ace）：`ace/LICENSE`。
- Apache-2.0（echarts）：`demo/echartsDemo/lib/LICENSE` 与同目录 `NOTICE`。
- MIT：正文只有一段，抄在这里，第二节与第三节里那些「本行即保留声明」的文件都以它为准——

> 版权所有（按各条目所列版权人）
>
> 特此免费授予任何获得本软件及相关文档文件（以下简称「软件」）副本的人不受限制地处理本软件的
> 权利，包括但不限于使用、复制、修改、合并、发布、分发、再许可及/或出售软件副本的权利，并允许
> 向其提供软件的人这么做，但须符合以下条件：
>
> 上述版权声明和本许可声明应包含在软件的所有副本或主要部分中。
>
> 本软件按「原样」提供，不含任何形式的明示或默示的保证，包括但不限于对适销性、特定用途的适用性、
> 非侵权的保证。在任何情况下，作者或版权持有人均不对因软件或软件的使用或其他交易而产生或与之
> 相关的任何索赔、损害或其他责任负责……

英文原文以各上游仓库里的 `LICENSE` 为准（jQuery / Vue / social-share.js / FastClick / Prism /
normalize.css / canvas-nest.js / IDValidator / vConsole 均为 MIT，vConsole 那份带腾讯前言）。

- SIL OFL 1.1（三份自托管字体）：见 `assets/fonts/LICENSES.md`，条款原文指向 openfontlicense.org。
- 数据快照（WTFPL / MIT / Apache-2.0 四张表）：见 `assets/data/LICENSES.md`，含 pin 的 commit 与 `SOURCES.json`。

## 五、怎么重跑这套比对

文档里的数字必须照着能复算，所以口径写在这里。别把「HTTP 200」当证据。
下面四段**每段都从仓库根目录起跑**（第 1 段自带 `cd ace`，连着跑第 2 段时记得先 `cd ..`）。

```bash
# 1) ace 整套：抓 1.4.6 的 tarball，与站内 ace/ 的 402 个 JS 逐文件比 sha256（期望：零输出）
mkdir -p /tmp/ab && curl -sSL https://registry.npmjs.org/ace-builds/-/ace-builds-1.4.6.tgz | tar -xz -C /tmp/ab
cd ace
find . -type f -name '*.js' | while read -r f; do
  t="/tmp/ab/package/src-min/${f#./}"
  [ -f "$t" ] || { echo "缺 $f"; continue; }
  [ "$(shasum -a 256 "$f" | cut -d' ' -f1)" = "$(shasum -a 256 "$t" | cut -d' ' -f1)" ] || echo "不同 $f"
done
# 许可原文单独比 tarball 里的 package/LICENSE（两处应当同哈希）
shasum -a 256 LICENSE /tmp/ab/package/LICENSE

# 2) 单文件类：把上游产物直接管道成哈希，与站内文件比（以 jQuery 为例）
curl -sSL https://registry.npmjs.org/jquery/-/jquery-3.7.1.tgz | tar -xzO package/dist/jquery.min.js | shasum -a 256
shasum -a 256 dev/libJs/jquery.min.js

# 3) 一批版本号逐个量字节（第三节里 github-markdown.css 那行数字的来源）
for v in 2.8.0 2.9.0 3.0.0 3.0.1 4.0.0; do
  curl -sS --retry 3 --max-time 90 -o "/tmp/gmc-$v.tgz" \
    "https://registry.npmjs.org/github-markdown-css/-/github-markdown-css-$v.tgz"
  printf '%-7s bytes=%-7s sha=%s\n' "$v" \
    "$(tar -xzO package/github-markdown.css < /tmp/gmc-$v.tgz | wc -c | tr -d ' ')" \
    "$(tar -xzO package/github-markdown.css < /tmp/gmc-$v.tgz | shasum -a 256 | cut -c1-8)"
done

# 4) GitHub tag 上的文件（以 IDValidator v1.2 的 src/GB2260.js 为例）
#    raw.githubusercontent 在本机常超时，api.github.com 又按 IP 限流（出口 IP 是共享的，
#    很容易撞 "API rate limit exceeded"）；codeload 抓整个 tag 的 tarball 既不要 token 也不占配额。
curl -sS "https://codeload.github.com/mc-zone/IDValidator/tar.gz/refs/tags/v1.2" -o /tmp/idv.tgz
tar -xzO IDValidator-1.2/src/GB2260.js < /tmp/idv.tgz | shasum -a 256   # 期望 7ddc4d7a…
shasum -a 256 demo/idCardDemo/lib/GB2260.js
# 同一份 tarball 里还能直接看上游的许可原文：
tar -xzO IDValidator-1.2/MIT-LICENSE < /tmp/idv.tgz | head -6
```

上面四段都在本机跑过；第 3、4 段这类网络取数在本机会随机超时（`curl: (28)`），
所以要带 `--retry`，并且**只认落盘后算出来的哈希，不认「请求成功」**。

各条目的上游路径：`ace-builds@1.4.6 :: src-min/`、`jquery@3.7.1 :: dist/jquery.min.js`、
`social-share.js@1.0.16 :: dist/js|css|fonts/`、`vconsole@3.1.0 :: dist/vconsole.min.js`、
`fastclick@1.0.6 :: lib/fastclick.js`、`vue@2.6.12 :: dist/vue.min.js`、
`normalize.css@6.0.0 :: normalize.css`（tarball 里没有 min 产物，许可原文叫 `LICENSE.md`）、
`github-markdown-css@{2.8.0,2.9.0,3.0.0,3.0.1,4.0.0} :: github-markdown.css`、
`canvas-nest.js@1.0.0 :: canvas-nest.min.js|LICENSE`（两个都在包根，不在 `dist/`）、
`echarts@{4.2.0-rc.1,4.2.0-rc.2,4.2.1} :: dist/echarts.min.js`、
`echarts@4.2.0-rc.2 :: LICENSE|NOTICE`、
`mc-zone/IDValidator@v1.2 :: src/GB2260.js|src/IDValidator.js|MIT-LICENSE`（走 codeload 的 tag tarball）、
`tholman/cursor-effects@master :: readme.md`（同处无 `LICENSE` 文件，同样走 codeload）、
`js-yaml@5.4.2 :: dist/browser/js-yaml.esm.min.mjs`（§2 那段管道命令直接可用：
`curl --http1.1 -sSL https://registry.npmjs.org/js-yaml/-/js-yaml-5.4.2.tgz | tar -xzO package/dist/browser/js-yaml.esm.min.mjs | shasum -a 256`）。
