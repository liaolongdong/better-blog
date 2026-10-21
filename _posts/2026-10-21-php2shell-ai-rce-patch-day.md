---
layout: post
title: PHP2Shell 补丁日：AI 挖出的十年老洞，攻击流量比补丁先到
subtitle: 8.2.35 是官方最低补丁版本，8.1 及更早没有官方更新
seo_short_title: PHP2Shell 补丁日：AI 挖洞与提前泄露
seo_description: PHP 两个未授权 RCE 在 2026-10-21 发布补丁，最低 8.2.35，8.1 及更早无官方更新。我核了官方公告、Wiz/Calif/OpenAI 复盘和源码差异：AI 是加速器，不是自动挖洞机；漏洞提前泄露，Cloudflare 补丁前已见攻击流量。
date: 2026-10-21
categories: [AI, 服务器与部署]
cover: /assets/img/php2shell-ai-rce-patch-day/banner.webp
tags: AI 安全 OpenAI 开源 前端
---

![封面：深色编辑风格的 PHP2Shell 补丁日，标题写着 AI 挖出的十年老洞与攻击先到](/assets/img/php2shell-ai-rce-patch-day/banner.webp)

## 10 月 21 日晚上，我先看到的是 HN 上那条 35 分的帖子

2026-10-21 22:06（UTC+8），我在 Hacker News 的新帖列表里看到一行标题：`PHP2Shell: AI uncovers critical RCE in PHP`。35 分，7 条评论。分数不高，但 AI、critical、PHP 这三个词已经够让我点进去。

[Wiz 的博客](https://www.wiz.io/blog/php2shell-php-rce)第一段没有铺垫：PHP 跑在 70% 的网站上，这两个洞能让人远程读 PHP 进程的内存，甚至在 WordPress、Drupal、Joomla 上执行代码，不需要登录。补丁在当天 14:00 UTC 已经发了。再往下翻，[Cloudflare](https://blog.cloudflare.com/php-vulnerabilities-waf-protection/) 写得更直接：漏洞在正式发布前就泄露了，他们已经看到攻击流量。

所以这篇不打算再复述一遍“AI 又立功了”。我想弄清楚两件事：AI 到底在其中做了什么；以及为什么补丁日当天，攻击会比补丁先到。

## 时间线：从 2004 年的老洞，到 2026 年 10 月 21 日的补丁日

把各家的一手复盘摊开，会发现这不是“某天突然冒出一个洞”，而是一条拖了二十二年的线。

| 时间（UTC+8 除注明外） | 主体 | 做了什么 | 来源 |
|---|---|---|---|
| 2004 / 2020 / 2024 | Stefan Esser、PHP bug #78876、OSTIF + Quarkslab | 2004 年出现首个 PHP memory-limit RCE；2020 年报告 OOM 与临时文件清理 bug；2024 年审计发现相关 OOM 问题，但没证明能利用 | Calif 复盘 |
| 2026-07-30 → 2026-08-21 | OpenAI Patch the Planet、Calif（Ryan Austin） | 7 月 30 日受邀；8 月 1 日发现多条路径；8 月 11 日报告第一枚；8 月 14 日交 PoC；8 月 15 日 PHP 确认；8 月 21 日报告第二枚 | Calif 复盘、OpenAI 公告 |
| 2026-08-19 → 2026-09-21 | Wiz Research | 8 月 19 日发现第一枚；8 月 20、21 日确认 Drupal 与 WordPress 的未授权 RCE；8 月 24 日报告；9 月 21 日 PHP 确认并开始修复 | Wiz 复盘 |
| 2026-10-20 | PHP Foundation、CERT-EU、watchTowr | PHP 预告安全版本；CERT-EU 在 20:33 发预警，写明消息来自“other leaks”；watchTowr 的 FAQ 记录社媒泄露称公告原定 10 月 22 日 18:00 CEST | CERT-EU、watchTowr |
| 2026-10-21 | Cloudflare、PHP、Wiz、Sansec | 03:02 UTC WAF 默认保护；07:43 UTC Cloudflare 报告补丁前攻击；14:00 UTC PHP 发布 8.5.12 / 8.4.27 / 8.3.36 / 8.2.35；当天公开披露与利用工具 | Cloudflare、PHP 官方、Sansec |

这张表里最值得注意的不是 8 月 1 日或 8 月 19 日，而是 10 月 20 日到 21 日那二十多个小时：补丁还没发，泄露和攻击先到了。

还有一点容易被忽略：[Calif](https://calif.io/php2shell/) 和 Wiz 是两条独立的发现路径。Calif 在 8 月 1 日发现，8 月 11 日就报告了第一枚；Wiz 在 8 月 19 日才发现第一枚，8 月 24 日报告。两家撞到的是同一个根因——PHP 处理 OOM 致命错误时，请求级状态没有被清干净。[OpenAI 的公告](https://openai.com/index/coordinated-disclosure-of-critical-vulnerabilities/)也确认了这一点：“Calif identified a critical flaw... with Wiz also independently discovering and reporting both vulnerabilities.”

**我的判断：这不是“新漏洞”，是旧 bug 类在新工具下第一次变得可规模化利用。** 2004 年、2020 年、2024 年都有人碰到它，但都停在“知道有问题”或“没证明能利用”。2026 年变的是把“能利用”证明出来的那一步。

![时间线：从 2004 年 memory-limit RCE 到 2026 年 PHP2Shell 补丁日](/assets/img/php2shell-ai-rce-patch-day/02-timeline-php2shell.webp)

这张图只保留四个转折；精确到小时的版本在正文表格里。

## 为什么这不是一次普通的安全更新

先看影响面。[PHP 官方公告](https://www.php.net/archive/2026.php#2026-10-21-5)的“Who is at risk”写得很宽：所有处理 web 请求的 PHP 安装，包括 PHP-FPM、Apache 的 mod_php、php-cgi、FrankenPHP、LiteSpeed。官方说 mod_php 风险最高，因为有演示能在任何应用代码运行之前触发攻击。

受影响版本下界，Wiz 和 Calif 都写到 5.4.0。Wiz 的原话是，过去十年发布的每个 PHP 版本，至少中其中一个。Calif 写得更具体：最早的受影响路径追溯到 5.4.0，具体利用方式取决于版本和 SAPI，但在默认配置下都可利用。

严重度方面，Wiz 和 CERT-EU 都写 CVSS 9.2，Sansec 写的是 CVSS v4.0 9.2。这不是“某个插件没过滤参数”，是 PHP 引擎在处理 fatal OOM 时的状态清理问题。你换主题、关插件、加 .htaccess，都碰不到根因。

补丁版本只有四个：PHP 8.5.12、8.4.27、8.3.36、8.2.35。PHP 8.1 及更早不再从 PHP 项目拿更新；官方给了 7.4、8.0、8.1 的最小源码 backport，但那是给能自己编译的人。如果你依赖 Remi 仓库，PHP 官方明确说当天不会有更新。

![PHP 官方安全公告截图：四个补丁版本、两个 CVE 与受影响范围](/assets/img/php2shell-ai-rce-patch-day/01-screenshot-php-advisory.webp)

截图抓取于 2026-10-21 22:27（UTC+8），页面是 PHP 官方 2026 年新闻存档。

然后是补丁日的节奏。[Sansec 记录](https://sansec.io/research/php2shell)补丁在 2026-10-21 14:00 UTC 发布；Cloudflare 从 03:02 UTC 起默认给免费和付费 WAF 开保护；Sansec 又引用 Cloudflare 的记录说，07:43 UTC 已经出现补丁前的攻击；公开披露当天，技术写法和利用工具都放了出来。Sansec 的原话是 “mass exploitation is expected”。

这几件事叠在一起，才是“不是普通更新”的原因：洞在引擎里、利用门槛低、补丁覆盖不到老版本、信息提前泄露、工具公开。任何一条单独看都不算罕见。五条同时出现，防守方的时间就被压没了。

泄露这条线，公开信息只到“有泄露”为止。[CERT-EU 在 2026-10-20 20:33 的预警](https://cert.europa.eu/publications/security-advisories/2026-018)里写 “according to other leaks”；[watchTowr 在补丁前的 FAQ](https://watchtowr.com/intelligence/php-cve-2026-109618-faq/)里说，社媒上流传的公告时间是 2026-10-22 18:00 CEST；Cloudflare 则直接说漏洞在正式发布前泄露，并观测到攻击流量。三个来源都没有说泄露的是公告标题、版本号，还是可用的 PoC。我在公开渠道没找到原始帖子，所以只能确认“泄露发生了”，不能确认“利用细节提前公开了”。这个区别很重要：如果只是版本号泄露，攻击者还得自己写利用；如果 PoC 泄露，补丁前的攻击就更容易。

70% 这个数字是 Wiz 和 Cloudflare 引用的估算，我没有独立复核统计口径。但你只要维护过一个 PHP 站，这个数字其实不重要。重要的是你的版本在不在那四个补丁版本里。

## 我核了补丁源码：改的是 PHP 的 OOM 处理，不是应用代码

我这台机器没装 PHP，也没有 Docker。跑不了 `php -v`，更没法在本地起一个 WordPress 打 payload。能做的只剩一件笨办法：把 8.4.26 和 8.4.27 的源码包都下下来，diff。

两个包分别是 22,536,897 字节和 22,708,176 字节。`diff -rq` 出来 185 个 .c/.h 文件不同——别被这个数字吓到，8.4.27 不是只修这两个 CVE，NEWS 里还有一长串别的修复。真正的入口在 NEWS 第一条 Core：

```text
- Core:
  . Fixed GHSA-w8hw-w9fx-j79w, GHSA-6wmf-4rv5-p3rp (Avoid state corruption via
    bailout). (CVE-2026-109618, CVE-2026-109619) (Arnaud, ilutov, Jakub Zelenka,
    ndossche, Nicolas Grekas)
```

再看具体 diff，能看出补丁的思路不是“堵某个参数”，而是把 OOM 的处理时机往后挪：

```c
+ if (ZEND_HAS_OOM()) {
+     zend_handle_delayed_oom();
+ }
```

`Zend/zend.c` 里新增了 `EG(delayed_oom)`，请求结束后再处理 OOM；`Zend/zend_execute.c` 里新增 `free_unfinished_calls()`，只释放调用帧；`ext/session/session.c` 里新增 `PS(in_rfc1867_update)`，在上传进度反序列化时只允许 incomplete classes，避免在 RINIT 之前跑用户代码；`main/main.c` 里还多了一个 `memory_hard_limit_percent`。

这些改动对应 Wiz 和 Calif 描述的根因：OOM 致命错误打断 native 代码，请求堆被销毁，但某些全局状态还指着已释放的内存；下一个请求复用 worker 时，就把脏状态当成活的。补丁把“延迟处理”和“提前清理”补上，同时给 session 上传进度加了一道不跑用户代码的闸。

这也解释了我为什么不同意把它写成“插件漏洞”。插件可以关，PHP 引擎不能关。你只能升级，或者用 WAF 和配置挡板拖时间。

这个 diff 能证明补丁改了哪些地方，但不能证明每个版本的利用都一样。Calif 说利用路径取决于版本和 SAPI；Wiz 的演示覆盖 WordPress、Drupal、Joomla 的容器镜像；Sansec 说 Magento 也中了。我没法在本机把这些链跑一遍，所以“补丁是否彻底”这个问题，我只能引用 Wiz 对补丁的评价：the patch provided by the PHP team fixes the issue at its core and eliminates all variants in the patched release。这是 Wiz 的说法，不是我的复现。

## AI 到底做了什么：三份一手复盘，三种说法

把三家的说法并排放在一起，会发现“AI 挖出 PHP RCE”这句话省掉了太多限定词。

| 来源 | 对 AI 角色的原话 | 我读到的意思 |
|---|---|---|
| OpenAI（2026-10-21） | “Calif identified a critical flaw using GPT‑5.6 Sol... with Wiz also independently discovering and reporting both vulnerabilities.” | 把 GPT‑5.6 Sol 写成发现路径的一部分，并强调“frontier AI found these vulnerabilities before attackers did” |
| Wiz（2026-10-21） | “We used Wiz Atlas, Gemini 4 Argon and GPT-5.6 Sol throughout this research. Notably, Gemini 4 Argon made an invaluable contribution to finding the vulnerability, exploit development, attack detection, and validation of the patch.” | AI 参与了发现、利用开发、攻击检测、补丁验证四个环节；Wiz 还引了 Google DeepMind 的话 |
| Calif（2026-10-21） | “No special harness, or access to models that weren't generally available to everyone were used in the initial bug discovery. I focused on something I had a background in, knew its vulnerability history well...” | 初始发现靠人的目标知识；没有特殊模型权限；AI 不是“一句话找全洞” |

**我的判断：这三段话不矛盾，但它们的重心完全不同。** OpenAI 和 Wiz 在讲“AI 让这件事变得可行”；Calif 在讲“可行不等于自动”。把三句合起来，最稳妥的读法是：人先知道该往哪看，AI 把变体搜索和跨版本利用适配的成本打下来。

Calif 那句补充很关键：“No model is simply capable of unearthing ‘all bugs’ with simple prompts. At least for now.” 这句话像是给所有“AI 自动审计”产品泼的一盆冷水。模型可以帮你读代码、生成假设、跑测试、分析崩溃，但它不会自己产生“2004 年 Stefan Esser 那个 memory-limit RCE 可能还有兄弟”的念头。那是人的记忆和判断。

Wiz 的结论则更乐观：“With frontier AI models and the right tools, a single researcher completed in a week what previously would have taken a world-class team months of work.” 这句话的重点不是“一周”，是“一个人”。以前要一支世界级团队做几个月的事，现在一个研究员加模型就能推进。对防守方是好事，对攻击方也是。

OpenAI 把两面都写了：“It highlights how AI can uncover security flaws with internet-scale impact, but the same capabilities can also help attackers rapidly develop offensive tools and exploits.” 这句是我整篇里最愿意原样引用的一句。它没有把 AI 说成只帮好人。

我一开始不是这么写的。HN 标题和 Wiz 的第一段太顺了，我的标题草稿直接写成“AI 一周挖穿 PHP 十年老洞”。读到 Calif 那句 “No model is simply capable...” 时，我把整段删了。不是说 AI 没参与，而是“挖穿”这个词把人的二十年积累、PHP 维护者两个月的修复、Cloudflare 提前部署的 WAF 全都抹掉了。

这也影响你怎么读 OpenAI 的“Defender's Window”。OpenAI 说，据他们所知，前沿 AI 在攻击者之前找到了漏洞，给防守方开了一个窗口。这是官方声称，不是独立事实。Cloudflare 的观测至少说明窗口不是关着的：他们在补丁前看到了攻击流量，也看到攻击者在改 payload 绕 WAF。窗口有，但很窄。

还有一件我没验到的事：这三家里，Calif 和 Wiz 的发现到底独立到什么程度。OpenAI 用了“independently”这个词，Wiz 和 Calif 的复盘也各自给了不同的发现日期和路径。我倾向于相信这是两条独立的线，但我没有看到两家原始报告的逐条对比。泄露的原始帖子是谁发的、Cloudflare 看到的攻击流量有多大、有没有成功，我也都没验到。这些只能等后续披露。

## 对前端、AI 应用开发者和独立开发者，分别意味着什么

我自己的博客是 Jekyll，生成出来是一堆静态 HTML，这次不在射程内。但只要你维护过一个 WordPress、WooCommerce、phpMyAdmin、Nextcloud，或者用 Laravel、Symfony 写过 API，这件事就跟你有关系。

Calif 确认的未授权 RCE 目标里，有 WordPress 7.1.2、Drupal 11.4.3、Joomla 6.1.4、Magento 2.4.9、Laravel 13.11、Symfony 8.1、Nextcloud 35.0.1、phpMyAdmin 5.2.3、MediaWiki 1.46.2、Roundcube 1.7.4、WHMCS。这些只是演示目标，不代表只有它们会中；洞在 PHP 引擎里，一个 Hello World 也可能中。

| 人群 | 今天的具体麻烦 | 现在能做什么 | 代价与边界 |
|---|---|---|---|
| 前端 / 全栈 | WordPress、WooCommerce、phpMyAdmin、MediaWiki 的 PHP 版本由主机或镜像决定，自己不一定有 root | 先查版本；能升就升到四个补丁版本；不能升就找主机商要 backport；WAF 先开 | 共享主机可能不让你选版本；WAF 只挡已知 payload，Cloudflare 也看到了绕过尝试 |
| AI 应用开发者 | Laravel、Symfony、Nextcloud 常被拿来搭内部工具和 API；phpMyAdmin 还挂在后台 | 把 PHP 运行时纳入依赖清单；升级到 8.2.35、8.3.36、8.4.27、8.5.12 里对应的小版本；检查 session.upload_progress 和 memory_limit；看 multipart 与 OOM 日志 | 升级可能撞框架版本；关 session.upload_progress 会影响上传进度条；memory_limit=-1 会让单请求吃满内存 |
| 独立开发者 / 小团队 | 一个人管站，主机面板只给“PHP 8.1”这种模糊选项；没时间读二十页公告 | 先跑 `php -v`；8.1 及更早没有官方补丁，问主机能不能 backport；不能就迁到 8.2 以上；临时限 post_max_size | 迁移要测插件；backport 不是每家都有；换主机有停机成本 |
| 团队 / 运维 | 资产清单里只有域名，没有 PHP 版本；WAF 和补丁分属两个人 | 今天就把 PHP 版本加进资产表；补丁优先级按“暴露面 × 版本”排；WAF 规则和日志告警同时开 | 老系统可能锁死 PHP 版本；WAF 规则要调，容易误杀上传；补丁要重启 FPM |

**这张表里最该先动的是“查版本”，不是“买 WAF”。** WAF 是挡板，补丁是关门。你连自己跑的是 8.1 还是 8.3 都不知道，买什么都是盲盒。

如果你只写前端，站点是 Vercel、Netlify 上的静态产物，这次确实不直接中。但你的 CMS、后台、客户站点、公司市场页可能在。别因为“我写 React”就划走。

对 AI 应用开发者还有一层：你让模型帮你写 Laravel 控制器、生成 Dockerfile、配 Nginx，速度和以前不是一个量级。但运行时版本、上传大小、会话配置这些“基础设施默认值”，模型不会替你负责。这次出问题的地方，恰好就在这些默认值里。

## 现在能做什么：先查版本，再决定补丁还是挡板

先说你今天就能做的，按顺序。

第一步，查版本。SSH 上去跑 `php -v`；如果是 FPM，再跑 `php-fpm -v`；如果站点在 Docker 里，跑 `docker exec <容器> php -v`。WordPress 后台的“站点健康”也能看到 PHP 版本，但那是应用层读数，不如命令行准。

```bash
php -v
php-fpm -v
php -i | grep -E 'memory_limit|session.upload_progress.enabled|post_max_size'
```

第二步，对号入座。8.5.x 升到 8.5.12；8.4.x 升到 8.4.27；8.3.x 升到 8.3.36；8.2.x 升到 8.2.35。8.1 及更早没有官方补丁；要么让主机或发行版 backport，要么迁到 8.2 以上。PHP 官方给了 7.4、8.0、8.1 的最小源码 backport，但那只适合能自己编译的人。

如果你在共享主机上，别只问“你们修了吗”。问三个具体问题：我的站现在跑的是哪个 PHP 小版本；你们能不能升到 8.2.35、8.3.36、8.4.27、8.5.12；如果暂时不能，能不能在 FPM pool 里关掉 session.upload_progress、把 memory_limit 设为 -1。把回答留成工单记录，别只听客服口头说“已处理”。

第三步，升不了再上挡板。官方给的临时措施里，最有用的是两个：把 `memory_limit` 设成 `-1`，最好写在 FPM pool 或 Apache 配置里，让应用改不回去；把 `session.upload_progress.enabled` 设成 `0`，然后重启所有 worker。8.5 上再加 `fatal_error_backtraces=0`。还可以把 `post_max_size` 收到 8M（不需要上传的站）或 32M（需要上传的站）。

这些都不是修复。PHP 官方写得很清楚：only an update is a complete solution。`memory_limit=-1` 会让单个请求有机会吃满内存，所以要用容器或 cgroup 兜底。官方还特意提醒，别用 RLIMIT_AS 或 RLIMIT_DATA 当边界，因为这两个限制会反过来触发漏洞路径。

WAF 也别忘了。Cloudflare 的规则对免费版也开了，但 Sansec 引 Cloudflare CTO 的话说这是 stopgap；Sansec 还提醒，如果你的源站 IP 能绕过 Cloudflare 直连，WAF 等于没开。

第四步，看日志。Wiz 给的信号是：异常的 multipart 请求后面跟着 memory-limit 错误、连续 500、异常大或畸形的 PHPSESSID 响应 cookie、PHP worker 异常重启。这些不是确认攻击的证据，但值得查。

### 接下来盯什么

截至 2026-10-21 22:20（UTC+8），[CISA KEV 目录](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)还是 2026.10.20 版，1754 条，没有这两个编号。如果到 2026-10-24 14:00 UTC 之前加进去，说明美国政府确认了在野利用；如果一周内还没加，我会把“大规模利用”降一级。

还要盯三件事。Remi 仓库当天没更新，看它什么时候补；共享主机面板（cPanel、宝塔、DirectAdmin）什么时候给 8.2、8.3、8.4 的补丁包；Cloudflare 说攻击者在改 payload 绕 WAF，看有没有新的绕过报告。WordPress、Magento 的批量沦陷报告也要看，但目前只有攻击流量，没有成功案例的公开统计，这部分我没验到。

一个可检验的下注：如果 2026-10-24 14:00 UTC 之前 KEV 还没有这两个编号，且没有主流托管商或安全厂商公开批量沦陷，我就把这次定性为“攻击流量已出现，规模化利用未证实”，而不是“大规模沦陷”。

## 我的判断：AI 不是自动挖洞机，补丁窗口才是被压缩的东西

回到 10 月 21 日晚上那条 35 分的 HN 帖子。标题是 `AI uncovers critical RCE in PHP`。这个标题不算错，但它把三件事压成了一件：人知道去哪找、AI 把利用适配的成本打下来、PHP 维护者用两个月把补丁准备好，Cloudflare 在最后几周把挡板打开。

我对这次事件有三句判断。

第一，AI 不是自动挖洞机。Calif 的复盘已经把话说得很白：没有特殊 harness，没有非公开模型，初始发现靠的是人对 PHP 漏洞史的了解。Wiz 的“一个人一周”成立，但那一周前面有二十年的积累，后面有两个月的修复。

第二，真正变了的是补丁窗口。以前一个引擎级 RCE 从发现到公开利用，可能要几个月；这次补丁日当天，技术写法和利用工具一起公开，Cloudflare 在补丁前就看到了攻击流量。对防守方来说，“等下周再打补丁”这个选项正在消失。

第三，PHP 8.1 及更早的站，是这次最难受的一群。官方不给补丁，backport 要靠发行版或主机商，Remi 当天不更新。你可以关插件、换主题、上 WAF，但根因在引擎里。要么迁，要么找供应商，要么承认自己在裸奔。

如果你问我最实际的一句话：先去跑 `php -v`，别先看新闻。版本号出来，你才知道自己是在补丁列表里，还是在“找主机商”那一栏。

至于 AI，我会继续用它读代码、生成测试、查变体。但我不会再把“AI 找到了”当成一句完整的话。它省略了谁教它往哪看、谁验证了利用、谁在补丁日之前把 WAF 打开。那些才是这次事件里真正救了时间的东西。

如果三个月后有人回头看，我希望这条新闻留下的不是“AI 又赢了”，而是一个更朴素的问题：你的运行时版本，今天是谁在管？
