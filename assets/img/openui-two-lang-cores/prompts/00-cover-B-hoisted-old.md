# Cover candidate B — `1 tree · 2 parsers`

Type: conceptual/comparison. Aspect: 16:9 (1792x1024). Text: title-only, ASCII short label.
Label (verbatim, must be spelled exactly): `1 tree · 2 parsers`
Label shape: 数字 · 落差 (two groups split by ` · `, 4 words total, each word <= 20 chars).
Label must be legible at 320px width.

## The one conflict this image carries
One install tree, two copies of the same parser: the old copy hoisted to the top level,
the new copy buried one level down inside the React branch.

## Composition (hard constraints, self-declared)
- One image, one conflict. No people, no screens, no dashboards.
- Subject in the vertical 40%-60% band, offset left of center; right side open.
- >= 40% flat negative space.
- Warm off-white paper background (#FBF8F3) with subtle grain; not washed-out pale line art,
  not a dark field with a small glowing subject.
- Palette: ink #1E252C, green #2F855A, amber-red #B42318, ochre #8A6D3B.
- Forbidden: purple gradient, glowing orbs, isometric cubes.

## Scene
A flat shelf diagram: a wide top shelf holds one large amber-red tile with a parser glyph and
the stamp `0.4.1`; a narrow lower shelf tucked inside a bracket labeled `react-lang` holds a
smaller, cleaner green tile with the same parser glyph stamped `1.0.1`. A single dashed vertical
hairline from a small fork icon above ties both shelves to one root. The two identical glyphs at
different sizes are the joke: same parser, twice.
ASCII label in the upper-left quiet area, ink color, wide tracking.

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

## 落选记录（三秒测试后删掉位图，只留这份 prompt）
第二次出图（cover-B2-safe-band）仍然输掉，两条都是对画面本身的判断：
1. 括号写的是 `react-lang`，可它框住的那一格是红色的 `0.4.1`——图自己把「React 那条线拿新版」这件事讲反了。
   正文的结论恰好相反，读者从封面点进来会被误导。
2. 标签 `1 tree · 2 parsers` 落在 y≈83%，首页卡片上下各裁约 15.8% 之后标签仍在，
   但文章页 hero 裁 17.2% 后它离被切只剩一点余量；A2 的标签在带内正中，稳。
另外 B2 右侧还多出一个没有任何指向的空方框。胜出那张是 A2（一根树干分出两个版本号不同的盒子）。
