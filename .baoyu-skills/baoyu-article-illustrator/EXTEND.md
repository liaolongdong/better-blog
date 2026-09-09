---
version: 1
watermark:
  enabled: false
  content: ""
  position: bottom-right
  opacity: 0.7
preferred_style:
  name: sketch-notes
  description: "Warm cream paper, black hand-drawn lines, soft pastel blocks — educational infographic feel"
default_output_dir: independent
language: zh
preferred_image_backend: auto
generation_batch_size: 4
custom_styles: []
---

<!--
本项目级配置的作用（优先级 1，压过 ~/.baoyu-skills/baoyu-article-illustrator/EXTEND.md）：

与用户级配置的唯一实质差异是 default_output_dir：
  用户级 imgs-subdir → 会写到 {article-dir}/imgs/，而本博客文章在 _posts/，
                       结果就是 _posts/imgs/，不符合博客的 assets/img/<slug>/ 约定。
  项目级 independent → 写到 illustrations/{topic-slug}/，再由 cron 任务搬运到
                       assets/img/<slug>/，与 assets/img/page-agent/ 等既有目录一致。

其余字段沿用用户级已配好的值：
- preferred_style: sketch-notes —— 与 assets/img/page-agent/prompts/*.md 里
  已提交的 style: sketch-notes / palette: warm 一致，保证插图风格跨篇统一。
- preferred_image_backend: auto —— 本机无 DASHSCOPE_API_KEY、无 bun，
  auto 按 skill 后端解析规则第 3 步回落到运行时原生出图工具。
- language: zh —— 插图内的标注用中文，与正文一致。

注意：该 skill 的 Step 3 是硬性确认门。cron 任务的 prompt 里已写入
「直接生成，不用确认，按默认出图」作为显式 opt-out，等价于用户当场说这句话。

搬运与转 webp 的命令见 _drafts/WRITING_PROTOCOL.md §13。
-->
