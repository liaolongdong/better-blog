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

本地博客定时任务按 `_drafts/VISUAL-GUIDE.md` 执行。默认参考样文的简洁手绘场景与明确视觉关系，允许按题材调整构图和配色，不固定成一张换字海报。

封面可用少量准确文字，文字不稳定时重生成或改无字构图，不覆盖原图文字、不擦除水印。先保存提示词，再调用实际可用的图像后端，生成后逐张检查与裁切预览。

无人值守任务已授权按本篇主题直接出图；普通交互任务仍遵循当前用户请求与技能确认规则。成品统一转入 `assets/img/{slug}/banner.webp`，研究原件和提示词保存在本轮 evidence 目录，独立输出目录不直接当站点资源。
