---
layout: post
title: 阿里开源的 Page Agent：一行代码让网页"听懂人话"，这才是真正的前端 AI 交互
subtitle: 告别截图识别和 OCR，用 DOM 脱水 + 大模型让网页操作进入自然语言时代
date: 2026-07-12
categories: AI frontend open-source
cover: /assets/img/page-agent/banner.png
tags: AI Agent 前端 开源 阿里巴巴 page-agent GUI Agent
---

# 阿里开源的 Page Agent：一行代码让网页"听懂人话"，这才是真正的前端 AI 交互

![Page Agent Banner](/assets/img/page-agent/banner.png)

做前端这么多年，我一直在思考一个问题：用户和网页的交互，为什么到今天还停留在"点按钮、填表单、拖拽组件"这种原始方式？尤其是在 AI 大行其道的 2026 年，语音助手可以帮你点外卖、AI 可以帮你写代码，但在自己开发的 Web 应用里，你却还是得一个个字段手动填写。

直到上周我在 GitHub Trending 上发现了阿里开源的 **Page Agent**，一周之内狂揽 2.6 万 Star，我才意识到——原来"用自然语言操控网页"这件事，已经有了如此优雅的解决方案。

---

## 痛点：网页自动化的"两条老路"都走不通

在聊 Page Agent 之前，我想先说说目前网页自动化领域的尴尬现状。

第一条路是传统的 E2E 自动化框架，比如 Selenium、Puppeteer、Playwright。这些工具的核心逻辑是"从外部看网页"——启动一个浏览器实例，通过 XPath 或 CSS 选择器定位元素，然后模拟点击、输入等操作。写出来的脚本大概长这样：

```javascript
// 传统 Playwright 的典型操作
await page.click('button[data-testid="submit"]');
await page.fill('input[name="username"]', 'admin');
await page.fill('input[name="password"]', '123456');
await page.click('#login-btn');
```

看起来没什么问题对吧？但实际上，这种方式有几个致命缺陷。首先，选择器极其脆弱，前端改个 class 名或调整下 DOM 结构，脚本就全挂了。其次，它需要后端服务支撑，部署成本高，不适合做"嵌入到产品内部"的智能交互。最重要的是，它是规则驱动的，完全不具备理解自然语言的能力。

第二条路是近两年兴起的"截图 + 视觉模型"方案，典型的如 browser-use。它的思路是用截图代替 DOM，让多模态大模型看图片、识别坐标，然后告诉 Playwright 去点击哪个位置。这个方案解决了"理解力"的问题，但引入了新的麻烦——延迟高、成本高（每步都要调视觉模型）、精度受分辨率影响，而且需要 Python 后端支撑，根本没法轻量级地嵌入前端应用。

说白了，前端开发者一直在等一个"够轻、够聪明、够快"的方案。Page Agent 就是这个答案。

---

## Page Agent 的核心思路：DOM 脱水术

Page Agent 的核心创新在于一个概念——**DOM 脱水（DOM Dehydration）**。

简单来说，它不是让 AI "看"网页截图，而是把网页的 DOM 树序列化成一个精简的文本结构。就像一个复杂的 JSON 对象，经过脱水后变成了一份"骨架描述"：这里有个按钮叫"提交"，那里有个输入框叫"用户名"，下面是个下拉菜单叫"选择城市"。

这个文本化的 DOM 描述被直接喂给大语言模型（LLM），LLM 就能理解页面上有哪些元素、它们的功能是什么，然后根据你的自然语言指令，输出对应的 DOM 操作指令。Page Agent 接收到指令后，直接在浏览器内执行——点击、输入、滚动、选择，一气呵成。

![Page Agent 架构图](/assets/img/page-agent/architecture.png)

整个流程完全在浏览器端完成，没有 Python 后端，没有截图传输，没有 OCR。这意味着什么？意味着你可以把 Page Agent 当作一个 npm 包直接装进你的 React 或 Vue 项目里，它就是一个前端库，跟 lodash 或 dayjs 一样轻量。

---

## 实际用起来有多简单？

说了这么多原理，来看看实际上手有多简单。

最快的体验方式是 CDN 引入，一行代码就能让任何网页具备自然语言交互能力：

```html
<!-- 快速体验（自带 Demo LLM，仅供评估使用） -->
<script src="https://cdn.jsdelivr.net/npm/page-agent@1.11.0/dist/iife/page-agent.demo.js" crossorigin="true"></script>
```

加完这行，页面上就会出现一个对话浮窗，你可以直接输入"点击登录按钮"、"把用户名改成 admin"之类的自然语言指令，它就能自动执行。

但如果你要在生产环境中使用，推荐走 npm 安装：

```bash
npm install page-agent
```

然后在你的项目里这样初始化：

```javascript
import { PageAgent } from 'page-agent'

const agent = new PageAgent({
    model: 'qwen3.5-plus',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: 'YOUR_API_KEY',
    language: 'zh-CN',
})

// 就这么简单——用自然语言描述你想做的事
await agent.execute('打开设置页面，把主题切换为深色模式')
await agent.execute('在搜索框输入"React 教程"并点击搜索')
```

API 设计非常克制，核心就一个 `execute` 方法，接收自然语言字符串。你不需要学任何新的 DSL，也不需要定义繁琐的 selector 映射。任何兼容 OpenAI 格式的 API 端点都能直接接入，包括通义千问、GPT-4o、DeepSeek 等等。

---

## 和同类方案的正面对比

为了更直观，我做一个简单的横向对比：

| 维度 | Playwright/Puppeteer | browser-use | Page Agent |
|------|---------------------|-------------|------------|
| 运行环境 | Node.js 后端 | Python 后端 | 浏览器前端 |
| 交互方式 | 代码选择器 | 截图 + 视觉模型 | DOM 文本 + LLM |
| 延迟 | 低（规则驱动） | 高（截图 + 推理） | 中低（文本推理） |
| 嵌入前端应用 | 不可以 | 不可以 | 完全可以 |
| 理解自然语言 | 不可以 | 可以 | 可以 |
| 部署成本 | 需要浏览器服务 | 需要 Python + 浏览器 | npm install |
| 跨页面能力 | 强 | 强 | 仅限当前页 |

![三种方案对比](/assets/img/page-agent/comparison.png)

Page Agent 的定位非常清晰——它不是要替代 Playwright 做自动化测试，也不是要替代 browser-use 做爬虫。它的战场是**产品内部的智能交互**：让你的 SaaS 用户可以用自然语言操作复杂的仪表盘，让 ERP 系统的表单填写不再痛苦，让无障碍体验真正落地。

---

## 实际场景思考：它能做什么？

我在自己的项目里试了几个场景，效果超出预期。

第一个是复杂表单的智能填写。我们内部有个 CRM 系统，表单字段多达 30 多个，新人上手至少要学半天。接入 Page Agent 后，用户只需要说"创建一个客户，公司名叫阿里巴巴，联系人张三，手机号 13800138000"，agent 就能自动找到对应字段并填入。

第二个是操作引导。很多 To B 产品都有"新手引导"的需求，传统做法是写一堆 tooltip 或 overlay，但维护成本极高。有了 Page Agent，你只需要告诉用户"跟着我说就行"，用户用自然语言描述想做的事，agent 直接带他走完流程。

第三个是无障碍辅助。对于视障用户或行动不便的用户，Page Agent 可以配合语音识别，让他们用说话代替点击和输入，这是非常有社会价值的应用场景。

---

## 目前的局限性

当然，Page Agent 也有它的边界。首先，它严格限制在当前页面内，不能跨页面操作（虽然有个可选的浏览器扩展支持多标签页，但跨域 iframe 仍然受限）。其次，DOM 脱水后传给 LLM 的 token 数量在复杂页面上可能偏大，需要做好性能优化。最后，对于高度动态的单页应用（SPA），DOM 变化频繁时可能会出现"指令执行时元素已不存在"的情况。

不过这些问题都在快速迭代中。项目团队在 GitHub 上非常活跃，issue 响应速度很快，社区也在积极贡献各种适配方案。

---

## 总结与展望

Page Agent 让我看到了前端 AI 交互的一个新范式：不需要截图、不需要 OCR、不需要后端服务，一个 npm 包就能让你的网页"听懂人话"。它的 DOM 脱水方案在轻量级和智能化之间找到了一个很好的平衡点。

展望未来，随着大语言模型推理能力的持续提升和 function calling 机制的成熟，我相信"自然语言操控 UI"会从尝鲜功能变成标配能力。就像十年前我们觉得触屏操作只存在于科幻电影里一样，五年后回头看，我们可能会觉得"用鼠标一个个点按钮"是一件非常原始的事情。而 Page Agent，就是推动这个转变的先行者之一。

项目地址：[https://github.com/alibaba/page-agent](https://github.com/alibaba/page-agent)
