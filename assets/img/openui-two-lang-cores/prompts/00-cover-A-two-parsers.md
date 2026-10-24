# Cover candidate A — `4 runtimes · 2 parser versions`

Type: conceptual/comparison. Aspect: 16:9 (1792x1024). Text: title-only, ASCII short label.
Label (verbatim, must be spelled exactly): `4 runtimes · 2 parser versions`
Label shape: 数字 · 落差 (two groups split by ` · `, 5 words total, each word <= 20 chars).
Label must be large enough to read at 320px width.

## The one conflict this image carries
A single dependency tree does NOT collapse into one shared core: it forks into two separate
parser copies. Nothing else is depicted.

## Composition (hard constraints, self-declared)
- One image, one conflict. No panorama, no dashboard, no code editor, no human figures.
- Main subject sits in the vertical 40%-60% band and is centered-left; the right third is
  open breathing room for the eye to exit.
- At least 40% flat negative space overall.
- Background: warm off-white paper (#FBF8F3) with a faint grid; NOT near-white washed-out,
  NOT a dark canvas with a tiny subject.
- Palette: ink #1E252C for structure, one green #2F855A, one amber-red #B42318, one ochre #8A6D3B.
- Forbidden: purple gradients, glowing spheres, isometric tech cubes, lens flares, 3D glass.

## Scene
A thick ink trunk enters from the left edge, stamped with a small tag reading `core`.
It forks into four thin limbs on the right. One limb (green) reaches a compact box stamped
`1.0.1`; three limbs (amber-red) converge on an older, slightly scuffed box stamped `0.4.1`.
Below the two boxes, a flat ruler-like bar shows the same parser glyph drawn twice,
making "two copies on disk" the visible punchline.
The ASCII label sits in the lower-left area, ink-colored, generous letter-spacing, no box behind it.

## SAFE-BAND OVERRIDE (v4 §8.2.1 / §8.2.2 — 站点会裁掉上下各约 17%)
- REQUIRED: every shape AND every piece of text must live strictly inside the horizontal band
  between 32% and 68% of the image height. The top 30% and bottom 30% of the canvas MUST remain
  completely empty background (no lines, no shadows, no watermark, no signature).
- REQUIRED: the ASCII label is placed inside that band, not near any edge, large enough to be read
  when the whole image is scaled down to 320px wide.
- REQUIRED: keep the entire right 25% of the canvas free of anything.

## 重出记录（2026-10-23）
第一次按上面出图后被判不合格：A 的标签落在 y≈92%、B 的标签落在 y≈6%，两处都会被文章页 hero
（上下各裁约 17.2%）与首页卡片（约 15.8%）切掉；两张右下角都带出图后端的「Qoder AI生成」浅灰水印。
第二次出图加上本节 SAFE-BAND 约束，水印用 ffmpeg drawbox 以采样到的背景色原地盖掉（盖在纯背景带上，
不覆盖任何图形与文字）。
