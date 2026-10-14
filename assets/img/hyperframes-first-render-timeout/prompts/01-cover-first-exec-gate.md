# Cover prompt | hyperframes-first-render-timeout | candidate 01

Backend: runtime native image tool (ImageGen). Aspect 16:9, output 1792x1024.
Type: conceptual. Palette: warm. Rendering: flat-vector. Text: title-only. Font: clean. Mood: balanced.

## Task

Generate a 16:9 (1792x1024) flat vector illustration cover for a technical blog post. ONE conflict only:
a first program launch takes longer than a hard-coded 5-second gate allows.

## Composition parameters (hard requirements, self-declared)

- Canvas 1792x1024, 16:9, no borders, no frame, no watermark, no logo.
- Background: warm paper tone, uniform `#F4EDE1`, covering 100% of the canvas. NOT near-white, NOT pale blue, NOT dark.
- Ink linework colour: deep slate `#1E2A38`. Single accent colour: vermillion `#D8452A`. One secondary calm teal `#2E7D6B` only for the "pass" tick area. No gradients anywhere.
- Whitespace: at least 45% of the canvas is empty background. No element touches the outer 8% margin.
- Main subject sits in the horizontal band between 40% and 60% of the canvas height (vertical centre band), so it survives aggressive cropping (the site crops ~17% top and bottom).
- Main subject is centred-left, occupying x from 8% to 62%; the right third of the canvas is left as breathing room with only the text label.
- Element count: one horizontal timing bar, one vertical gate, one overshoot segment, one small clock mark. Nothing else. No humans, no faces, no code screenshots, no keyboard, no isometric cubes, no glowing spheres, no purple.

## The drawing

A single thick horizontal timeline bar, drawn as a rounded rectangle, starts at the left and runs right.
Along it, at 62% of the bar's length, a tall thin vertical dashed gate line cuts across the bar, standing
slightly above and below it — this is the timeout gate. The bar segment between the gate and the bar's right
end is filled vermillion, clearly showing the launch overshooting the gate. A small solid circle marker sits at
the very end of the bar (the actual finish), also vermillion, with a short straight leader line going up to
where the label text begins. A tiny clock outline (circle with two hands, ink colour, no glow) floats just
left of the gate at bar height, small, drawn in one stroke weight.

## Text on image (ASCII ONLY — Chinese characters are forbidden; verify each string is ASCII)

Large clean sans-serif label placed to the right of the bar end, vertically centred in the 40-60% band,
ink colour except the two numbers which are vermillion. Exactly this text, on two lines:

```
8.66s first exec ·
5s gate
```

That is two lines: line 1 ends with the `·` separator, line 2 is the second group.

Word count rule: two groups separated by ` · ` — group 1 = `8.66s first exec` (3 words), group 2 = `5s gate`
(2 words), total 5 words, each word under 20 characters. The digits must be large: the `8.66s` glyph height
should be at least 6% of canvas height (about 60px at 1024) so it stays readable when the image is shrunk
to 320px wide.

Spelling of the label must be exactly: `8.66s first exec · 5s gate`.

## Negative constraints

No purple gradient, no glowing sphere, no isometric technology cubes, no full-dark scene, no full-pale scene,
no Chinese characters, no extra text, no captions other than the label above, no drop shadows heavier than 4px,
no photorealism, no watermark.
