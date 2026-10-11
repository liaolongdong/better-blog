---
layout: post
title: 100 份 manifest 的仓库，CI 只看这 100 份
subtitle: 三种坏载荷塞进 cursor/plugins 后校验全绿，加个未知键才红
seo_short_title: cursor/plugins 校验覆盖面实测
seo_description: 在 cursor/plugins 的克隆里塞进没有 description 的 SKILL.md、不可解析的 mcp.json、删掉必填键的中立 manifest，仓库那本校验脚本三次都报绿。
date: 2026-10-11
categories: 开源实测
cover: /assets/img/plugin-manifest-only-gate/banner.webp
tags: 开源 插件 Agent MCP
---

# 100 份 manifest 的仓库，CI 只看这 100 份

![闸门只拦清单那一层，载荷从旁边走过去](/assets/img/plugin-manifest-only-gate/banner.webp)

> 一句话结论：CI 只校 manifest 的 schema，载荷层的三种坏文件我塞进去它都报绿。
> 现在该做什么：clone 后补上 ajv，跑一遍那本校验脚本，再往里注入一次看看。

## 背景：它为什么出现

它是 Cursor 官方的插件集市仓库。

一百个插件目录，每个自带一份 `.cursor-plugin/plugin.json`，根目录那本清单把它们列全。star 10,844，抓于 10-11 14:15 UTC；开放 issue 203 个。

配套的 `@cursor/sdk` 最新 1.0.37，一周 893,901 次下载。

一处对不上：API 的 `license` 字段是 `null`，仓库根没有 LICENSE 文件，README 却写着 MIT。

## 它解决什么痛点

没有它之前，装一个 agent 插件靠手抄目录。

这仓库认 `.cursor-plugin/`，Claude 认 `.claude-plugin/`；中立那本 schema 要 `$schema` 键、名字最长六十四字符、连 `skills` 这一项都没有。同一份对象我拿同一套 ajv 对跑过：在这本下能过的身，在另一本下会红。

它的解法是把选择压成一行清单：根目录 `marketplace.json` 一万九千字节、一百条。真正的痛点不是格式，是「改一行就得有人判」。

## 快速上手

先补依赖，再跑校验。

仓库根没有 `package.json`，也没有 lockfile，clone 下来直接跑必炸。原文（挪走 node_modules 重跑）：

```
$ node scripts/validate-plugins.mjs
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'ajv'
$ npm install --no-save ajv ajv-formats
added 6 packages in 845ms
$ node scripts/validate-plugins.mjs
All plugins validated successfully.
```

那两行 `--no-save` 是它的 workflow 自己写的，无 lockfile。

## 使用示例

三种坏载荷塞进去，它照样报绿。

```
teaching/skills/zz-bogus/SKILL.md   无 description      exit 0
third_party/gmail/mcp.json          非法 JSON           exit 0
origin-apps/plugin.json             删掉 $schema        exit 0
teaching/.cursor-plugin/plugin.json 加未知键 colour     exit 1
```

最后一行是正向对照：schema 关了未知键，清单层它有牙。脚本读的只有根清单和每份 `plugin.json`。

全绿。清单底下另有一本口径：[Skills 文档](https://cursor.com/docs/context/skills)要求 `name` 只用小写字母、数字、连字符，且等于目录名。仓库 108 份里 4 份两头都不合（cursor/plugins#237）。

## 和同类比：强在哪、差在哪

另一家的校验器会走下 SKILL.md。

![覆盖面不相交](/assets/img/plugin-manifest-only-gate/01-comparison-validation-scope.webp)

Claude Code 2.1.145 的 `plugin validate` 认出那份缺 description 的 skill，加 `--strict` 就失败。而它不看 skill。

可它读不了这仓库的方言：指 `teaching` 报 `No manifest found in directory`，一百条集市只认出 1 个插件。

我的栈没有这一格：wxt + Vue 3 走 pnpm，上架走 Chrome Web Store 审核。分发对象不吃这个格式。

差在哪看 cursor/plugins#531：里面三条主张我逐条复现了。这台没装 Cursor 编辑器，客户端那条路没验，不写结论。

## 未来展望：什么条件下我会用它

校验面不扩到载荷层，我就不把它当分发格式。

锚点是 cursor/plugins#530，只改一份 description 的长度。它合了而 #531 还开着，说明它不打算往下看。

中立方言我不看好：一百个目录里带那份 manifest 的只有 1 个，schema 里没有 `skills`，写了也白写。

项目地址：[https://github.com/cursor/plugins](https://github.com/cursor/plugins)
清单之外它不看，#531 里自己写了。
