---
layout: post
title: 3 条用例跑绿之后，我看见 e2e 自己列的 55 行 missing
subtitle: 它把 agent 步骤录成可回放的缓存；我这边没有模型，能验的是另外一半。
seo_short_title: e2e 实测：55 行 missing
seo_description: tester-army/e2e 是 web 与移动端端到端测试框架。我跑绿 3 条自写用例，又让它故意挂一次；迁移表 186 行状态里 55 行 missing，回放缓存那一半没有模型，没验到。
date: 2026-10-10
categories: 开源实测
cover: /assets/img/e2e-replay-cache-55-gaps/banner.webp
tags: Playwright AI编程 开源 工具
---

# 3 条用例跑绿之后，我看见 e2e 自己列的 55 行 missing

![三条用例从安装、连上浏览器到失败落盘的管线示意](/assets/img/e2e-replay-cache-55-gaps/banner.webp)

> 一句话结论：它确定性那一半我实测能用，失败时落的那份文本值得抄。
> 现在该做什么：挑你 Playwright 套件里最脆的 5 条用例，先跟它的迁移表比一遍。

## 背景：它为什么出现

它是端到端测试框架。

`tester-army/e2e` 在 2026-07-22 开源，我 10-10 抓到八千六百多星，npm 上一周（10-02 到 10-08）下载 18 万次。

它把两半焊在一个文件里：一半是定位与断言。另一半是 `agent.act("把会员升到 Pro")` 这样的人话步骤，验过的步骤录成缓存，下次回放不再叫模型。

## 它解决什么痛点

脆的是中间那层。

“点第二个按钮，等 status 区出现，文本含 Hello, Ada”——手写选择器，前端改一次 class 我就得回来修一次。

`agent.act` 替我把这层说成一句人话，但它不兜底：act 之后必须紧跟 expect 把结果钉住，钉住的才进缓存。

说白了它给最易碎的那一段买保险，不是把测试换成聊天。

## 快速上手

先说劝退的那半。

它要 Node 22.22.3 起，我这台是 22.19.0，CLI 第一行就把我拒了。npm 那边松，`npm i -D e2e@0.19.0 @e2e-dev/web@0.14.0` 照装，45 个包，EBADENGINE 照打两条。

版本换够，它自己去下 Playwright 浏览器，我这台 macOS 13 被拒，退出码 1。

活路是挂一个在跑的浏览器：

```ts
engine: web({ connect: { cdpEndpoint: () => "http://127.0.0.1:9333" } })
```

这里我踩了一脚。照直觉把 cdpEndpoint 填成字符串，三条全挂 source.resolve is not a function，退出码 3。surface.ts 里它要的是函数，吃一个 AbortSignal。

## 使用示例

三条全绿。

我的页面 46 行：一个输入框、一个按钮，点完 200 毫秒才回话：

```ts
test("greets the name you type", async ({ app, screen }) => {
  await app.open("/");
  await screen.getByLabel("Name").fill("Ada");
  await screen.getByRole("button", "Greet").click();
  await expect(screen.getByRole("status")).toHaveText("Hello, Ada!");
});
```

再改挂一次：填 Grace，留着不动。终端并列给出 expected 和 observed，match count 1。

回放缓存这一格我空着：这台机器没有模型凭据，agent.act 一跑就 MODEL_UNAVAILABLE。没验的我不编。

## 和同类比：强在哪、差在哪

强的是失败现场。

Playwright 给我 expected 和 received。它多给 match count 和一份可访问性树差分：失败时落的 trace.md 有 55 行纯文本，不用开 DevTools 就能读。

差的是覆盖面，它自己承认。那张迁移表 186 行状态里有 55 行写着 missing，含 emulateMedia、clock、文件内并行。

10-10 有人提交 tester-army/e2e #1020：119 个用例全搬过去了。耗时大约 9 分钟，Playwright 是 10 分钟。

![录制与回放之间的那道闸](/assets/img/e2e-replay-cache-55-gaps/01-infographic-gap.webp)

同一台机器、同一个 CDP 端点各跑 4 次：Playwright 那套 13.4–15.4 秒。e2e 这版 14.4–19.6 秒。区间在边缘穿过，我不敢说它慢，只敢说启动重。

## 未来展望：什么条件下我会用它

模型身份那一半我验不了。tester-army/e2e #1000 那条如果正式版前不改，我不把它放进需要交代绿灯由哪个模型跑出来的项目。它的文档现在明写着换模型不会 miss。

下个月我先拿这个博客的上传表单写 5 条确定性用例，不碰 agent step。

项目地址：[https://github.com/tester-army/e2e](https://github.com/tester-army/e2e)
省下来的是修选择器的那几个下午，前提是不用 agent 步骤。
