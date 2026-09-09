---
version: 1
quick_mode: true
default_aspect: "16:9"
preferred_type: conceptual
preferred_palette: warm
preferred_rendering: hand-drawn
default_output_dir: independent
language: zh
preferred_image_backend: auto
watermark:
  enabled: false
---

<!--
本项目级配置的作用（优先级 1，压过 ~/.baoyu-skills/baoyu-cover-image/EXTEND.md）：

1. 该 skill 在用户主目录下没有 EXTEND.md，Step 0 是 ⛔ BLOCKING 的首次配置流程，
   会弹 AskUserQuestion 等人回答。本文件的存在直接解锁这一门。
2. quick_mode: true 是 skill 文档承认的 standing explicit opt-out，
   跳过 Step 2 的六维度确认，让无人值守的 cron 任务不会卡住。
3. preferred_image_backend: auto —— 本机没有 DASHSCOPE_API_KEY、也没有 bun，
   auto 会按 skill 的后端解析规则第 3 步回落到运行时原生出图工具，零凭据可用。
4. default_aspect: 16:9 —— 封面在 _layouts/post.html 里是 CSS background-size: cover
   铺满 post-header，首页卡片也是宽图，16:9 是安全比例。
5. 封面统一 --text none：AI 渲染中文字极易出错字，而博客标题由模板渲染，图内不需要文字。

调用方式（cron 任务里）：
  baoyu-cover-image --quick --aspect 16:9 --text none
生成后需手动搬运并转 webp，详见 _drafts/WRITING_PROTOCOL.md §13。
-->
