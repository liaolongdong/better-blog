---
version: 1
watermark:
  enabled: false
  content: ""
  position: bottom-right
  opacity: 0.7
preferred_style:
  name: sketch-notes
  description: "Warm cream paper, clear hand-drawn lines, restrained pastel accents"
default_output_dir: independent
language: zh
preferred_image_backend: auto
generation_batch_size: 4
custom_styles: []
---

本地博客定时任务按 `_drafts/VISUAL-GUIDE.md` 执行。插图按解释需求选择位置和数量，不要求每节一张，也不固定截图与结构图配额。

手绘仅为默认参考，具体题材可以使用更适合的简洁视觉表达。精确技术流程使用可编辑图源，真实界面使用真实截图，不用图像模型伪造实验结果。

定时任务已授权“直接生成，不用逐图确认”；普通交互任务仍遵循技能的确认流程。先保存提示词，再调用可用后端；生成后检查每个标签、数字、水印、箭头和手机端可读性。

`independent` 避免在 `_posts/` 下生成图片子目录。最终图片经持锁交付放到 `assets/img/{slug}/`，其他原件留在本轮 evidence 目录，不再引用已停用的 WRITING_PROTOCOL。
