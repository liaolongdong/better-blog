# Cover candidate A — `635 claimed · 483 served`
Type: conceptual/comparison · Aspect 16:9 (1792x1024) · Text: ASCII short label only, no Chinese.
Label verbatim: 635 claimed · 483 served   (shape: 数字 · 落差, 4 words, each <= 20 chars)

## One conflict
Two tickets for the same catalog: a big red "635" printed on a promo stub, and a smaller, solid green
"483" printed on the ticket the server actually hands out. Nothing else.

## SAFE-BAND (site crops ~17% top and bottom of the hero)
- REQUIRED: every shape AND all text live only between 32% and 68% of image height.
- REQUIRED: top 30% and bottom 30% of the canvas stay completely empty background — no lines, shadows,
  signature or watermark. Keep the right 25% empty.
- REQUIRED: the label must be readable when the whole image is scaled to 320px wide.

## Palette / style
Warm off-white paper #FBF8F3; ink #1E252C outlines; one red #B42318 (the promo stub), one green
#2F855A (the served ticket). Crisp flat vector, matte, minimal shading, >= 40% negative space.
Forbidden: purple gradients, glowing spheres, isometric cubes, lens flare, glass, photorealism, people,
code editors, dashboards. Not all-dark, not washed-out pale line art.

## 选用记录（2026-10-25）
胜出。三秒测试（`sips -Z 320` 自转 webp 前的 PNG，本机 sips 读不了 webp 源）后四条判据都过：
一眼能说出「两张票、同一个目录、两个数」；落点是左边那张红票；上下空白平衡；
标签 `635 CLAIMED · 483 SERVED` 与两张票上的 635 / 483 在 320px 下都读得出。
水印「Qoder AI生成」在右下 x 1496–1760 / y 966–1006，用 `drawbox=...:color=0xfdfaf4:t=fill` 原地盖掉，
同一扫描带命中从 693 点降到 0。
