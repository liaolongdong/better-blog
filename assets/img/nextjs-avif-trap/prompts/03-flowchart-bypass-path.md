---
type: flowchart
style: sketch-notes
palette: warm
aspect: 16:9
position: "🔍 节 · upstreamBuffer 段之后"
---

# Illustration 2: 一条看不出问题的分支

## Composition
A hand-drawn top-down flowchart on cream paper: one entry box, one diamond
decision, two outgoing branches (left = optimized, right = passed through), and
a dashed observation box on the far right.

## ZONES
- TOP CENTER: a rounded rectangle (entry), an arrow down into a diamond.
- CENTER: a hand-drawn diamond (decision) with two labelled exits.
- LEFT BRANCH: arrow down-left to a tall box drawn like a machine/press with a
  small downward funnel; a normal solid arrow continues to the bottom.
- RIGHT BRANCH: arrow down-right to a box drawn as a straight open pipe — the
  bytes pass through untouched — then a solid arrow to the bottom.
- FAR RIGHT: a dashed-border rectangle containing a flat line-chart doodle with
  a small "all calm" face-less monitor shape, connected to the right branch by a
  dotted line.
- BOTTOM: two arrows converge into one short horizontal baseline.

## LABELS
Exact strings, clean Chinese rendering, nothing else written:
- Entry box: "AVIF 请求"
- Diamond: "能解码吗"
- Left exit word: "能"
- Right exit word: "不能"
- Left box: "压缩后返回"
- Right box: "原图直出"
- Under right box, small: "状态码 200"
- Dashed box caption: "监控无异常"

## COLORS
- Cream paper background (#FDF6E3), faint grain
- Black ink (#2B2B2B) for all outlines, arrows, lettering
- Mint green (#88D8B0) wash on the left box only
- Soft coral (#FF6B6B) wash on the right box only, plus a coral underline under
  "监控无异常"
- Warm yellow (#FFD93D) small highlight strokes behind "原图直出"

## STYLE
- Hand-drawn sketch-notes, arrows with slight curve and overshoot, boxes not
  perfectly rectangular
- Dashed vs dotted line styles must be visually distinct
- 40%+ empty cream, comfortable margins

## NEGATIVE
No humans, no code text, no English sentences, no percentages, no invented
numbers beyond the labels above, no 3D, no gradients, no shadows, no watermark.
