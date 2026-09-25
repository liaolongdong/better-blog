---
layout: post
title: 谁才是省上下文冠军？2026年9月4条浏览器入口实测排名出炉，结果让人意外
subtitle: 同一台 macOS 上量四条让 agent 开我浏览器的入口，最少的那一份常驻 6,804 字节，它背后 42 个方法和 56,289 字节参数表一条都不进上下文；最贵的 25,766 字节，是同一套 MCP 工具两个版本之间涨上去的
seo_short_title: 四条浏览器入口的上下文字节实测排名
date: 2026-09-23
categories: [AI, 开源实测]
cover: /assets/img/browser-skill-context-bytes/banner.webp
tags: AI 开源 Agent chrome
---

# 谁才是省上下文冠军？2026年9月4条浏览器入口实测排名出炉，结果让人意外
![四条从终端伸向浏览器的入口，一条只占薄薄一格，其余三条堆成高塔](/assets/img/browser-skill-context-bytes/banner.webp)

```text
$ /tmp/bskx/bsk doctor --no-wait
error: unexpected argument '--no-wait' found

Usage: bsk doctor [OPTIONS]

For more information, try '--help'.
exit=1  output=111 B
```

## bsk doctor 那句报错：我要的 flag 还在 PR 里

这行 flag 是我自己要的，不是抄谁的。第二天就发现别人也想要：PR #275，标题 `fix(doctor): add --no-wait flag to skip browser extension wait`，09-17T16:04:36Z 开，+27 −7、3 个文件、1 个 commit，`mergeable_state=unstable`，写这篇时还 open。它 `Fixes #265`，那条说 `bsk doctor` 没有扩展连着时会无限挂起，报的人跑两回，`4m09s` 和 `3m54s` 后把 shell 杀了。

主角是 [Tencent/BrowserSkill](https://github.com/Tencent/BrowserSkill)。它的 `created_at` 是 2026-06-22T07:24:40Z，2026-09-23T10:40:32Z 我从 REST 打到它是 6,823 star，同一分钟它躺在 typescript 周榜第 7 行，行内写着 4,553 stars this week。那一榜一共 18 行，all 榜它没进前 20。forks 496、watchers 16、开放 issue 54 条、MIT，最后一次 push 09-23T08:51:16Z；两条 v0.3.1（07:23:45Z 和 08:38:42Z）都发在我抓它之前。

## 6,804 字节：它只让这一份常驻我的上下文

口径先钉死。量的不是跑一次任务花多少 token，那是运行时的账，我没跑过真页面任务，量不了；量的是另一头：不用它的时候，它为我的上下文付多少钱。skill 类看那份 `SKILL.md` 进上下文的字节数，MCP 类看 `tools/list` 一次性回给 agent 的那坨 JSON。

`crates/bsk-cli/skill/SKILL.md`：123 行、6,804 字节。整个 skill 目录 8 个文件、30,712 字节，其中 `references/` 7 份、23,908 字节，最大一份 `debugging.md` 8,630 字节。这三个数不能混着说：6,804 是装完之后一直挂在那儿的那一份，30,712 是把 7 份 references 从头读到尾的代价，四倍半，后者按指针按需加载，不常付。

![矮柜里只有一格薄纸常驻，旁边那一摞要读到底才付](/assets/img/browser-skill-context-bytes/01-comparison-sliver-versus-stack.webp)

那份文件只有四个 H2（`:15`、`:31`、`:55`、`:84`），第 13 行钉了一句 `Never extract credentials, cookies, tokens, or other secrets.`。整份读完，没有一句关于 token、上下文、开销的比较级宣称；README 同口径查 `token|context|cost|overhead|bytes` 只命中两处，一处在 harness 列表，一处在证据页说明。说白了，这份排名不是复述它的卖点，它自己没这么卖过。

## 四条入口按字节排开，最便宜的反而最能干

四份样本全来自这台 macOS x64，同一个晚上，同一套取数动作。

最便宜的是上面那份 `SKILL.md`，6,804 字节。接着是 `edwinhu-dev-test-chrome`，14,892 字节、576 行，本机唯二跟驱动浏览器沾边的 skill 之一；另一份 `clerk-chrome-extension-patterns` 11,660 字节、374 行，写的是扩展开发套路，不是开浏览器。剩下两份是同一个东西的两个版本：chrome-devtools-mcp 1.2.0 的 `tools/list` 全量 23,261 字节，1.8.0 涨到 25,766。

排名：6,804 < 14,892 < 23,261 < 25,766。

后两份怎么量的，这一格最容易掺水。我把 MCP 当 stdio 子进程起，发 `initialize`、`notifications/initialized`、`tools/list`，响应原样落文件再量字节。两版都是 29 个工具，名字一模一样。全量涨 2,505 字节、10.8%；只算 `name` 加 `description` 反而少 63 字节；单工具中位数从 726 挪到 816，钱花在 `inputSchema` 上。

再补一句按能不能真用来重算的：`edwinhu-dev-test-chrome` 自己不持有浏览器通道，它的工作方式是叫 MCP 工具去开，可用形态是它加 1.8.0，14,892 + 25,766 = 40,658 字节，约是 bsk 那份 6,804 的六倍。

最便宜这份的反面是 42 个 RPC 方法、`--help` 3,037 字节、Commands 段 39 行、二进制 13,581,816 字节。我原本以为这条线会是反的：功能摊在 shell 里，agent 就得背更厚的说明书；或者工具摆在桌上的形态才省。

两个都不对。

常驻多少跟功能摆在哪没关系，跟 agent 开机要读哪一份有关系。

## 42 个方法、13,581,816 字节的二进制，和 3,037 字节的 --help

`crates/bsk-protocol/schema/` 里 105 份 JSON、321,724 字节，其中 42 份叫 `tool_*_params.json`，合起来 56,289 字节。42 对得上我把文件名去掉前后缀数出来的方法名，`blur click console debug download emulate evaluate fill focus get_html hover navigate network observe press reload screenshot session_start snapshot tab_create upload wait_ms wheel window_resize`，中间抽着写的。

这 56,289 字节没进排名，因为 agent 这侧走 shell：调 `bsk <子命令>`，参数错了 CLI 吐 usage，看了再调。常驻的是那个进程，不是我的上下文。

![厚的那一箱留在桌面以下，脑子里只有一张薄纸，一去一回多一轮](/assets/img/browser-skill-context-bytes/02-flow-below-the-table.webp)

省下来这笔挪成了先跑一次看它怎么说，我这次跑的就是这种挪法：`--no-wait` 不存在，exit=1、111 字节，`grep -rn -- '--no-wait'` 在我 clone 的那棵树里 0 命中（`da6bf4e`），因为那个 flag 还在 PR 里。多花的就是一轮往返。

等待这一类挪不动。

`bsk doctor` exit=1、5.000 秒、817 字节；`bsk session start` exit=1、35.0 秒、230 字节。两个数不是巧合，是源码里的常数：`browser_wait.rs:16` 的 `DEFAULT_BROWSER_CONNECT_WAIT` 5 秒、`:17` 的上限 60 秒、`daemon/browsers.rs:34` 的 35 秒。`BSK_BROWSER_WAIT_MS=0` 能让 doctor 变 0.000 秒、773 字节，少的正是 `waiting for browser extension to connect…` 那一行。同一处解析环境变量用的是 `.ok().and_then(|v| v.parse::<u64>().ok())`，我塞了个 `notanumber` 进去，它按默认值等了 6.000 秒，零告警——不报错、不提示、不解释。这种回退你不拿字符串去撞一下，永远不会知道它发生过。

至于 #265 那句无限挂起，我这台 macOS、v0.3.1 量到的两个等待都有界，60 秒上限在代码里。Windows 一簇我没手段碰：#320、#305、#218、#185 四条全 open。再往下就是编的。

## 同一条 wxt 线：它那份 extension 和我那个插件

`apps/extension/package.json` 我一开始当别人家的东西读，读到 `:7` 那行 `"dev": "wxt"` 停了一下，这几行我在自己仓库天天敲。它那份扩展：wxt `^0.20.0`、`@vitejs/plugin-react ^6.0.0`、react `^19.0.0`、tailwindcss `^4.3.0`、vitest `^4.1.6`，包名 `@browser-skill/extension` 0.3.1。我自己的 `account-password-helper` 3.9.0：wxt `^0.20.27`、vue `^3.5.41`、element-plus `^2.14.4`、playwright `^1.63.0`。同一条 wxt 线，两个前端分支，`^0.20.0` 到 `^0.20.27` 隔着二十几个 patch。

它的 `manifest.json`：MV3、0.3.1、`minimum_chrome_version` 125、11 项 permissions（`alarms activeTab debugger downloads idle notifications scripting tabs storage webNavigation windows`）、`host_permissions` 一项 `<all_urls>`。发行包 860,891 字节，解出来 2,755,639 字节 / 23 个文件，`background.js` 一个就 965,010。

为什么我还没换，得答具体的。

它解决的是 agent 开我此刻这个已登录的浏览器，我那个仓库解决的是测试开一个干净的、装了扩展的浏览器。我 `playwright.config.ts` 头几十行注释钉死三件事：只能用 `launchPersistentContext` 加 `--load-extension`，被测页是 `chrome-extension://<id>/` 所以没有 `webServer`，`fullyParallel: false` 配 `workers: 1`，并行会互相踩 profile 和 Service Worker。这三条它一条都不必满足，它也不需要我那套 e2e 台账和那份报告——我这台机器连 `~/Library/Caches/ms-playwright` 都不存在。

路线上我认它。

它用 `chrome.debugger` 加 snapshot / observe 拿可访问性树，不吃 CSS 选择器，跟我 6 月写过的那句传统选择器方案太脆是同一条路上的两个方向。但认这条路，不等于把已登录的浏览器交给一份带 `debugger` 和 `<all_urls>` 的扩展。这就是下一节。

## 32 个 a–p 字符：这道门只认形状，不认身份

`crates/bsk-cli/src/daemon/ws.rs`，函数 `origin_allowed` 在 `:45-57`，13 行，上面挂的注释从 `:36` 到 `:44`，`:38` 起那句是 `TODO(M10/M12): pair v0.1 GA with an actual extension-id allow-list`。函数体做三件事：`allow_any` 为真直接放行；否则要求 origin 以 `chrome-extension://` 开头；剩下那段长度正好 32、每个字节落在 `a` 到 `p`。Chrome 扩展 ID 就是 32 个 a–p，这条判据等价于长得像就放。它不比对名单，也没地方可比：`allowed_extension_ids` 全仓 `grep -rn` 只出现在 `:39` 那句注释里，结构体没这个字段。

![门上的模板只比对形状，墙上那个空框里才是没有的名单](/assets/img/browser-skill-context-bytes/03-framework-shape-gate-no-list.webp)

`:41-44` 那段注释自己写了后果：`acceptable defense-in-depth gap for now because pairing happens through the popup, but a side-loaded extension on the same machine currently passes the gate.` 一句里同时有暂时接受和同机侧载现在能过。拒绝路径在 `:138`，文案在 `:141`，写的是 `Origin not in chrome-extension allow-list`，配 `StatusCode::FORBIDDEN`。这句话把 allow-list 写进了拒绝理由，而代码里没有那份名单——我不觉得这是撒谎，`:36` 那行写的就是 `Result of the optional Origin allow-list check`，optional 是它给自己的定性。

`:710` 起五个测试：`"a".repeat(32)` 断言 true、拒大写、拒 `http://{id}.example`、用 `"z".repeat(32)` 拒字符、断言 `origin_allowed("http://localhost", true)` 为 true。五个都在测形状。文档三处口径不重叠，`architecture.md:160` 写 `- Extension origin allow-list at WS upgrade.`，同一文件 `:55` 只写 `- Validates Origin: chrome-extension://… on handshake.`，`remote-extension-connection.md:154` 写 `A browser-shaped Origin alone is never authorization.`。第三句是对的，前两句读起来像名单已经做了。

外报那条是 #273，标题 `Local WebSocket daemon accepts commands from any browser extension, not just BrowserSkill's own`，open、1 评论、无 label，正文点了函数名和文件路径，写作 `Affected versions: confirmed on tag ext-v0.3.0`。54 条开放 issue 里唯一挂 `bug` 标签的是 #219，4 条评论，说的也是把 profile 交给模型这件事。边界说清：`allow_any_origin` 默认 false（`daemon/start.rs:61`、`:83`、`:118`），本地模式绑 loopback。所以这是同机上任何扩展都能连上这个口，不是外面任何程序都能连，这个区分我实在不想含糊。我不复现攻击路径，只把文档里的句子和函数行摆在一起。

## 我没测的那一半：扩展没装进真浏览器

两件我不知道的，先摆出来。

一件是没把这份扩展装进我的浏览器：无人值守，加上 `debugger`、`<all_urls>` 和一份已登录的 profile，这个组合在我这儿属于会造成不可逆暴露的那类。另一件是没跑过任何一次真页面任务，所以它点击准不准、截图能不能读、snapshot 能在多大程度上替掉选择器，这篇一个字都不写，只写文件、协议、退出码层面量得到的。

安装这条线我只做到看清它要往哪写。`bsk install-skill --list` exit=0、1,249 字节：12 个 harness，4 个 detected，Codex、Claude Code、OpenClaw、Pi；未 detected 里躺着 Cursor、CodeBuddy、WorkBuddy、Hermes Agent、Kimi Code 和两个 internal。`--json` 那份变 2,059 字节，四个 detected 的 `installed` 全 false。跑前跑后我数了一遍这四个目录里的 `browser-skill*`：0 和 0，确实没写盘。

二进制我没只信 digest：归档 sha256 `da52bdaa…` 与 GitHub 公布的 `sha256:` 一致，`gzip -t` exit=0，两次解出来的二进制同一串 sha256。仓库 907 个受版本管理文件，`.ts` 408、`.rs` 148、`.tsx` 60。

往后我盯三件事，都有落点。把扩展装进一个不登录任何站点的新 profile，跑一次 `snapshot`，量它一次任务真吐给 agent 多少字节，和 6,804 的常驻比谁大；盯 `allowed_extension_ids` 哪天从 `ws.rs:39` 那句注释变成 `DaemonConfig` 上真实的字段；盯 PR #275，它一进 main，这篇开头那段报错就该压成一句。什么条件下我会换，这句在这台机器上暂时不成立，不是因为不好，是因为我要用它的那个场景恰好是我唯一不肯交给自动任务的。

## 17,076 行 skills 目录，和上期那句 16,599 行

上期那篇有个 H2 写的是：「我本机 51 个 SKILL.md，没有一个干这个的」。这句现在要改两处。`ls -d ~/.qoder-cn/skills/*/ | wc -l` 今天是 53 个目录、53 份 `SKILL.md`、合计 17,076 行、10,457,088 字节，上期量到的是 51 份、16,599 行，两天涨两份、涨 477 行。后半句也要改：在开我浏览器这一格，本周它有了头一个，就是那 6,823 star 的。

### 201.378743 秒

2026-09-24T14:14:42Z，我复查一个旧承诺，打 `curl https://raw.githubusercontent.com/pacifio/atlas/main/README.md`，没带 `--max-time`，拿回 `curl: (35) error:02FFF03C:system library:func(4095):Operation timed out`，`http=000 size=0 time=201.378743`。

同一命令 14:18:00Z 重跑：200、15,642 字节、1.667 秒。同一条通道三天三样，09-22 那期我记的是一次失败，09-23T11:12:17Z 我记的是 200、17,731 字节、0.700 秒。以后我不写这条通道不通，我写我这次没等到，然后给 curl 加超时。

### README 第 52 行还站着

那次抓取就是为复查它。atlas README 那行 `#todo homebrew tap so this becomes brew install atlas` 还在 `:52`，一字未动，触发条件没成立，这条继续挂。同一分钟 `GET api.github.com/repos/pacifio/atlas` 是 200、5,819 字节、0.664 秒。

### 第 7 行，不是第 6 行

typescript 周榜 18 行，BrowserSkill 在第 7 行。证据清单上一版记成第 6 行，正文按第 7 行写，因为这次我用 `<article class="Box-row">` 离线重解析了那份 HTML。all 榜 20 行、javascript 榜 18 行、python 榜 15 行都没有它。

### 静默的成功

#242，`bsk click silently reports success while delivering no input when the Agent Window is in the background`，open、3 评论、09-14 建、09-21 更新。报的人写它返回成功、还打印一个完全正确的点击坐标，页面却 `pointerdown / mousedown / mouseup / click` 一个都没触发，复现环境 `bsk: 0.2.1`、Windows 11。这条我没验，在我的 macOS 上也验不了。标个记号：会自己说成功的工具比会报错的贵，报错至少花我一轮 exit=1。

## 🗂 十笔旧账：五笔结、两笔改撤、一笔结一半、两笔仍挂

![一板旧绳：结实的、剪断的、打了一半的、还悬着的](/assets/img/browser-skill-context-bytes/04-metaphor-five-knot-ledger.webp)

结掉的五笔。

上期说跑前端仓库测试之前先 `which -a git`，本期起 MCP 探测前我打了一次，`/usr/local/bin/git` 还是 2.23.0 挡在 Apple Git-143 的 2.39.2 前面，顺序没变，这笔结。上期说复查 PR #45 和 #9，两条都还 open，正文那两处结论不收窄，复查动作算结。上期说复查 #44 和 #34/#26/#25，#44 open，#34 是 closed 但 `merged_at` 为空，被关没被合，我那组两道各自绿灯、中间没人对账的实验还成立。上期说复查 #33，open，那句 65 个测试没有自动执行入口保留。上期说下期刊装环节先跑 `--list`、退出码从管道外面取，本期的等价命令是 `bsk install-skill --list`，exit=0 从重定向后的文件外面取的。

改撤的两笔。

orca 那笔的条件是若把 cask 拆成能增量更新的包就给它一次真跑的机会，09-23 复查它到了 v1.4.209，mac zip 221,044,939 字节，比上期正文那个 212,624,680 又大了一圈。整包没变，我把条件撤了，换成一句结论：这么大的单包，我这台的下行速度不够给它作证。mattpocock/skills 那笔盯第一个 plugin tag，09-17、09-21、09-23 三次复查首位都是 v1.2.3，第四次挂账我撤，理由不是它不重要，是这条承诺没写终止条件，无限期挂账跟没处理是一回事。

一笔只结一半。

上期说拿 1,053 B 和 2,276 B 每 unit 回头量我自己那两份 wxt 仓库的台账形状：`account-password-helper` 量出来了，10 份 spec、2,029 行、报告 543,871 字节，第二份仓库本期没动，剩下半笔继续挂。仍挂的还有两笔，worktrunk 的 `latest` 复查还是 v0.79.0（09-21T01:01:42Z 发），触发条件没等到；atlas 那条就是 README 第 52 行，原样在。

排名给完了，口径是我自己定的，而这份口径没人公示过。留个问题在这儿更值钱：一个 skill 或者一个 MCP 服务器，如果真在 README 里写一行装完常驻多少字节，那一行该由谁量、在哪一层量，是 `SKILL.md` 本身，是它指针能指到的全部 references，还是某个具体 harness 真塞进请求里的那份渲染结果？前两个数在 bsk 上是 6,804 和 30,712，第三个我今天没量。
