---
layout: post
title: 我把 37 个 SKILL.md 挨个数了一遍，发现 14 个不会被自动加载
subtitle: i-have-adhd 一周涨 13,164 星，而我唯一逐文件数完的那个排在第三
seo_short_title: 37 个 SKILL.md 逐个统计：14 个不自动加载
date: 2026-09-12
categories: [AI, 开源实测]
cover: /assets/img/trending-skill-sweep/banner.webp
tags: AI 前端 开源 Agent 工具
---

![一周 GitHub 趋势榜上成排的 agent skill 仓库，只有中间一座被人逐块数过](/assets/img/trending-skill-sweep/banner.webp)

<style>
  .note-key { background: #f2f7f4; border-left: 4px solid #4a7c59; padding: 14px 18px; margin: 18px 0; border-radius: 0 8px 8px 0; }
</style>

```
14 of 25 skills in this plugin are unreachable in Claude Code
```

mattpocock/skills 的 issue #1055，state 是 open，评论 0 条，2026-09-08T03:38:12Z 开的。这仓库 491 个 open issue（14:39Z 抓的），我单挑这条，理由很实在：周榜上只有它我能不装东西、不问模型地数完。

## 排名：21 条里 10 条名字或描述带 skill

抓的是全语言周榜 `github.com/trending?since=weekly`，21 行，服务器时间 2026-09-12T14:34:50Z。判定规则定得很笨：名字或描述含 `skill` 子串，大小写不敏感。命中 10/21。

四个榜全从 HTML 抓，不花配额。先用 Python 的 urllib 试过，它直接拒：

```
ssl.SSLCertVerificationError: [SSL: CERTIFICATE_VERIFY_FAILED] unable to get local issuer certificate
```

换 curl 后中途报过一次错：

```
curl: (92) HTTP/2 stream 1 was not closed cleanly: INTERNAL_ERROR (err 2)
```

加 `--http1.1` 就 200，14:56Z 复跑也 200，偶发。

这 10 条的页面周增量合计 58,938，全 21 条合计 106,839，占 55.2%。按页面数字排：i-have-adhd 13,164、archify 11,006、mattpocock/skills 10,571、ECC 8,714、humanizer 4,649、superpowers 3,829、marketingskills 2,765、humanlayer/skills 1,637、openai/skills 1,532、text-to-cad 1,071。

分语言的榜反而薄：TypeScript 18 行只命中 2 条，JavaScript 19 行 5 条，Python 20 行 6 条。说白了热度不在语言里，在 agent 那一侧。

这排名值多少钱？一般。排的是页面新增数，不是可用性，十条里我逐文件核过的只有第三名。

## 37 个 SKILL.md，发布 25 个，其中 14 个够不着

tarball 235,854 字节，commit `3cca18b368ae95cdbdebbff572ccafa662551015`（committer date 2026-09-04T08:43:27Z），我解到 `/tmp` 里数：94 个 `.md`，其中 `SKILL.md` 37 个，engineering 18、productivity 7、in-progress 8、misc 4。`.claude-plugin/plugin.json`（version 1.2.3）的 `skills` 数组长度是 25，前两类在里面，后两类不在。

37 个里有 22 个写了 `disable-model-invocation: true`，0 个写 false，剩下 15 个不带这个键。22 减掉没发布的那 8 个 in-progress，等于 14。

<div class="note-key">
  <p><strong>25 个已发布的 skill 里，14 个标了 <code>disable-model-invocation: true</code>，agent 不会自动加载它们，你得自己点名。</strong>你装完插件看到 25 个，实际能被模型主动看见的是 11 个。</p>
</div>

剩下的都能数：`name` 37/37 等于目录名且都在 64 字符内，`description` 最长 417 字节（上限 1024），0 条违反规范。最小的 `grill-me/SKILL.md` 157 字节，最大的 `wayfinder` 11,908 字节，37 个合计 158,138 字节。

我还跑了 `scripts/list-skills.sh`，168 字节的 find 加 sort：bash、sh、绝对路径三种调用 exit 全是 0，各输出 37 行。本想抓它一个路径坑，没抓到，只能记成预期翻车结果没翻。

![37 份 SKILL.md 经发布清单筛成 25，再被 14 个禁用标记挡在模型视野外](/assets/img/trending-skill-sweep/01-compare-shipped-25-vs-flagged-14.webp)

## 它说全仓不许用破折号，我数出 104 个

`CLAUDE.md` 第 25 行写着这条规则，覆盖 `SKILL.md`、docs、`README.md`、`CHANGELOG.md`、ADRs、changesets、代码注释，还交代不许机械替换。

我把仓库所有 `.md` 和 `.json` 扫了一遍：U+2014 共 104 处，全部在 `CHANGELOG.md` 里，SKILL.md、docs、README、`.changeset/` 是 0 个。按版本切：1.1.0 段 47 个，1.2.0 段 46 个，1.0.0 段 8 个，剩下三个版本各 1 个。

漏掉它的原因在仓库里躺着。那次清理的 changeset 自己写了范围：docs、`SKILL.md` files、ADRs、`README.md`、scripts、JSON/YAML metadata。里面没有 CHANGELOG.md。而 `.changeset/config.json` 配的生成器是 `@changesets/changelog-github`，这文件是发版时机器拼的。永久规则和一次性范围差了正好一个文件，而它没人手写。

![一整列发布说明里挤满破折号，旁边每一页手写的文档都是空白](/assets/img/trending-skill-sweep/02-scene-emdash-only-changelog.webp)

另一个字符：U+2013 短横杠 15 处、11 个文件，规则没提它。

照一下自己：我的流水线给破折号设的是配额（段落数乘 0.3），不是禁令。这一篇 26 段，预算 7 个，我用了 0 个。

## 这周另外几笔

- **archify**：页面写本周 +11,006。拿 09-09T16:08Z 和 09-12T14:39Z 两次 REST 快照算，55,778 → 59,250，70.52 小时涨 3,472，折周 8,267，比页面低 25%。增量是真的，页面口径比我的宽。
- **magnitude**：上期日志记它“只抓数未进正文”，4,228。这期两次快照折周 343，而 09-10 抓 TypeScript 榜时页面写 2,616 stars this week，差 7.6 倍。这数我解释不了，下次连抓两天。
- **i-have-adhd**：43,037 星，2026-05-13 建仓，2,449 fork。周增量第一名，卖点是别让编码 agent 把答案埋了。这类东西我不看星数，看它插不插得进我的 review 流程。
- hyperframes 上期卡在 2 GB 临时盘，这期依旧没跑。
- **ponytail**：周增 11,054、136,338 星，全榜第二。不命中 skill，我一次没打开过，标个记号。
- 那个叫 `skills` 的 npm 包，2026-09-05 到 09-11 下载 4,621,540 次。它是通用安装器，不是这个仓库的分发量，`npx skills@latest add mattpocock/skills` 那行用的就是它。
- Search API 只用 1 次（剩 8）：新建 repo 那查返回 4 条，最高 556 星，没一手来源，不写推荐。camofox-browser 跟上期一样不推荐。

## 为什么我还拿单文件协议干活？

![左边一整卷单文件协议，右边 37 张可单独装载的卡片，中间那个人站在两者之间](/assets/img/trending-skill-sweep/03-scene-single-doc-vs-skill-cards.webp)

我博客的写作流水线是 `_drafts/WRITING_PROTOCOL.md` 一个文件，1,077 行、73,122 字节，另挂一份 204 行的 persona.md。他这 37 个 SKILL.md 字节数是它的两倍，但每块能单独装载。

这点我承认好用。我的协议有个麻烦：§12 那套 rotation 派生要读完整份文档才定得下这周用哪种骨架，C01 到 C32 挂在哪个小节下我也拿不到，只能全文进上下文。frontmatter 加 description 的装载粒度正好治这个。

没换，两个原因。14/25 那个数摆在那，我得先读 `plugin.json` 才知道 25 个里有几个是哑的，跟装完就能用的预期相反。最新 release 停在 v1.2.3（2026-08-06 发布），pushed_at 却是 2026-09-04，中间 29 天提交没发版，而 #1064 正在请求按 plugin 版本打 tag，说明按版本拉没有稳定入口。真到拆的那天，我盯两个信号：`disable-model-invocation` 在 Claude Code 里的语义定下来，那时上面那句 14/25 就作废；或者它真按 #1064 打出第一个 tag。这两条跟这周排名无关，也不赌它下个月还有热度。

结论就这么大：周榜 55.2% 的增量落在 skill 类目，我唯一逐文件数完的那个仓库名叫 skills，发布 25 个，14 个模型不会主动加载。

> 榜上另外九条我没跑过一行代码，这个仓库的 skill 内容我也没执行过，实际效果我没测，数的是文件、frontmatter 和字符。

项目地址：[https://github.com/mattpocock/skills](https://github.com/mattpocock/skills)
