---
layout: post
title: 用 AI 写的前端页面总是"一眼 AI 味"？Impeccable 用 46 条规则彻底终结这个问题
subtitle: 一个让 AI 编程助手学会"审美"的开源设计系统，4.5 万 Star 背后的设计哲学
date: 2026-07-12
categories: AI frontend design open-source
cover: /assets/img/impeccable/banner.webp
tags: AI 前端设计 UI 开源 Impeccable 设计系统 Vibe Coding
---

# 用 AI 写的前端页面总是"一眼 AI 味"？Impeccable 用 46 条规则彻底终结这个问题

![Impeccable Banner](/assets/img/impeccable/banner.webp)

如果你跟我一样，在过去一年里大量使用 Cursor、Claude Code、Copilot 这类 AI 编程助手来写前端页面，那你一定有过这种体验：AI 写出来的页面功能没问题、布局也合理，但就是有一种说不清道不明的"AI 味"——紫蓝色的渐变、圆角卡片套卡片、Inter 字体配灰色文字、到处是 bounce 弹性动画……

每次看到这种页面，我都有一种冲动：能不能给 AI 装一个"审美模块"？

没想到，真有人把这件事做出来了，而且做得非常彻底。这个项目的名字叫 **Impeccable**，上线不到两个月就拿到了 4.5 万 Star，堪称 2026 年设计工具领域的一匹黑马。

---

## "AI 味"的根源：模型训练的诅咒

在深入 Impeccable 之前，我们得先理解为什么 AI 写出来的前端总是长得差不多。

答案其实很简单：大语言模型的训练数据里，大量的 SaaS 产品官网、Dribbble 作品、开源组件库的 Demo 页面，都共享着一套视觉"公约数"——紫色到蓝色的渐变、Inter 或 SF Pro 字体、白底灰字的卡片布局、圆角阴影加图标瓷砖。AI 在生成 UI 代码时，会不自觉地回归到这些"安全"的视觉模式上，因为这是它在训练数据里见过的最高频组合。

结果就是，不管你是让它做一个医疗管理后台还是一个独立音乐人的官网，出来的视觉效果都像同一个模子刻出来的。这不是 AI 的"审美差"，而是统计学意义上的"回归均值"。

---

## Impeccable 的解法：给 AI 装一套"反 AI 味"的规则引擎

Impeccable 的核心思路非常直接——它不是试图"教"AI 什么是好的设计（这件事太主观了），而是**明确告诉 AI 哪些设计模式是"俗套"，并且强制禁止使用**。

具体来说，Impeccable 包含两个核心模块：

**第一个模块是 46 条确定性检测规则（Deterministic Detector Rules）**。这些规则不依赖 LLM 的判断，而是通过静态分析直接检测代码中的"AI 味"设计模式。比如：

- 禁止使用 Arial、Inter、系统默认字体等"过度使用"的字体
- 禁止在彩色背景上使用灰色文字（这是 AI 最爱犯的毛病之一）
- 禁止使用纯黑色或纯灰色（好的设计会用带色相的深色）
- 禁止"卡片套卡片"的嵌套布局
- 禁止使用 bounce 或 elastic 缓动动画（AI 特别爱用这种"假高级"的动效）
- 禁止紫蓝渐变作为主色调

这些规则可以通过 CLI 直接运行，不需要 API Key，不花钱：

```bash
# 扫描整个 src 目录
npx impeccable detect src/

# 扫描单个 HTML 文件
npx impeccable detect index.html

# 甚至直接扫描一个 URL
npx impeccable detect https://your-site.com
```

![Impeccable 检测结果](/assets/img/impeccable/detect-result.webp)

运行之后，它会输出一个报告，精确标注哪些文件、哪些行违反了哪条规则，并给出具体的修改建议。

**第二个模块是 23 个设计命令**。这些是嵌入到 AI 编程助手中的 skill 命令，让 AI 在生成或修改 UI 时，主动遵循更好的设计实践。比如你可以对 AI 说：

- `/audit` —— 对当前页面做全面的设计审计
- `/polish` —— 对页面进行最终的视觉打磨
- `/critique` —— 以设计师的视角批评当前设计
- `/animate` —— 为页面添加有品位的动效

这些命令背后都有完整的设计方法论支撑，不是简单的 prompt engineering，而是结合了确定性的规则检测和 LLM 的创意判断。

---

## 安装和实际使用

Impeccable 的安装非常灵活，支持多种方式接入你的开发工作流：

**方式一：CLI 安装（推荐）**

```bash
npx impeccable init
```

这个命令会生成产品上下文文件和配置，让后续的命令能够理解你的品牌、受众和组件体系。

**方式二：作为 AI 编程助手的 Skill**

如果你用的是 Claude Code、Cursor 或 Copilot，可以直接把 Impeccable 安装为 skill 或 plugin。安装后，一个 design hook 会在你每次编辑 UI 相关文件时自动运行检测器，把发现的问题实时反馈给 AI agent。

具体来说，这个 hook 的工作方式是：当你让 AI 修改一个 React 组件时，Impeccable 会检测修改后的代码，如果发现了"AI 味"的设计模式，会直接在 agent 的上下文中提出警告，AI 会根据警告自动修正——整个过程对你来说是无感的，你只会发现 AI 生成的 UI 质量突然变好了。

**方式三：手动集成**

你也可以把 Impeccable 的规则文件手动复制到你的 IDE 配置目录中，作为项目级别的设计约束。

```json
// .impeccable/config.json 示例
{
  "ignores": {
    "overused-font": ["Inter"],
    "reason": "品牌指定字体就是 Inter"
  },
  "rules": {
    "no-pure-black": "error",
    "no-nested-cards": "warn",
    "no-bounce-easing": "error"
  }
}
```

管理规则忽略也很简单：

```bash
npx impeccable ignores add-value overused-font Inter --reason "Brand font"
```

---

## 和同类工具的区别

市面上其实已经有了一些"辅助 AI 做设计"的工具，比如 Anthropic 官方的 frontend-design skill，或者各种 Cursor 里的 design prompt 模板。Impeccable 和它们的核心区别在于：

**它是确定性的，不是概率性的。** 其他方案依赖 prompt 来"建议"AI 做好设计，但 AI 可能听也可能不听。Impeccable 的规则是硬性检测——代码里出现了 `font-family: Inter` 就是违规，没有商量余地。这种"规则 + AI"的混合模式比纯靠 prompt 可靠得多。

**它主动对抗训练数据的偏见。** 大多数设计 skill 是"教 AI 怎么做"，Impeccable 是"禁止 AI 做那些它已经会了的事"。这个思维上的翻转非常关键——问题不在于 AI 不会设计，而在于它太擅长复制那些千篇一律的设计模式了。

**它可以脱离 AI 独立使用。** 即使你不用 AI 编程助手，Impeccable 的 CLI 检测器也能作为一个独立的设计 lint 工具使用，就像 ESLint 检查代码质量一样检查设计质量。

---

## 一个真实的改进案例

![Impeccable 前后对比](/assets/img/impeccable/before-after.webp)

我拿自己之前的一个个人项目做了一个对比测试。这是一个博客首页，让 Cursor 从零生成了一版 React + Tailwind 的代码。

第一版（没用 Impeccable）：典型的 AI 味设计——Inter 字体、紫蓝渐变 hero 区域、三个圆角卡片横排、每个卡片里有图标 + 标题 + 灰色描述文字。

然后我装了 Impeccable，运行了 `/audit` 命令，收到了 12 条违规提示。接着运行 `/polish`，AI 自动修正了所有问题。

第二版（用了 Impeccable）：字体换成了 DM Serif Display 配 JetBrains Mono、hero 区域用了大胆的非对称布局和暖色调、卡片被替换成了更有节奏感的内容区块、动效从 bounce 改成了 cubic-bezier 的微妙过渡。

同一个 AI，同一个项目，视觉质量的差距可以说是质的飞跃。

---

## 总结与展望

Impeccable 解决的是一个非常实际的问题：AI 编程助手的能力越来越强，但在设计审美上却一直原地踏步。这个项目用一种"反直觉"的方式解决了这个问题——不是教 AI 做更好的设计，而是禁止它做最差的设计。这种"做减法"的思维非常值得借鉴。

从更长远的角度看，我觉得 Impeccable 代表的是一种趋势：随着 AI 生成的代码越来越多，我们需要专门的工具来约束和提升 AI 的输出质量。代码有 ESLint、Prettier 来保证质量，设计也需要类似的"AI 输出质量保障"工具。Impeccable 可能是这个品类的开山之作。

项目地址：[https://github.com/pbakaus/impeccable](https://github.com/pbakaus/impeccable)
