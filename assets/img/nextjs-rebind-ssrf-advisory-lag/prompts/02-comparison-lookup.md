# Illustration 02 · comparison-lookup

- skill: baoyu-article-illustrator | style: sketch-notes | type: comparison | lang: zh
- backend: 运行时原生出图工具（禁止 dashscope）
- 落位：`assets/img/nextjs-rebind-ssrf-advisory-lag/02-comparison-lookup.webp`
- 放在「对谁有什么影响」一节，解释「校验用的解析」与「连接用的解析」落在哪
- 约束：文字极少（只允许下列 4 个短标签），必须逐字核对，错字则重出或改无字版

## Prompt

Hand-drawn sketch-notes style comparison diagram, landscape 16:9, warm off-white paper background,
thin ink strokes, muted teal + amber + slate marker accents, plenty of margin, no watermark,
no photorealism.

Two columns side by side, separated by a soft hand-drawn vertical line. Each column shows the SAME
three stacked boxes connected by arrows top to bottom:

1. top box: a small globe/域名 cloud icon
2. middle box: a magnifying-glass icon (= 校验那次解析)
3. bottom box: a plug/socket icon (= 连接那次解析)
4. an end box on the far side: a little server-with-lamp icon (= 内网服务)

LEFT column, labelled in handwritten Chinese `校验与连接分家`: the two arrows from middle and
bottom boxes point to TWO DIFFERENT little answer cards — the magnifier connects to a card showing
a public dot, the plug connects to a card showing a house-with-lamp (internal) dot; a thin wobbly
arrow from the plug reaches the internal server. Amber warning tone, hand-drawn "!" bubble.

RIGHT column, labelled `同一个答案钉住`: the magnifier and the plug both chain to the SAME single
answer card (one public dot), drawn with a nail/pin through the card; the arrow to the internal
server is crossed out with a small hand-drawn X. Teal calm tone.

Only these Chinese labels appear (short, high legibility): `校验与连接分家`, `同一个答案钉住`,
`域名`, `内网`. Everything else is iconography, no other text. Slight hand tremor, uneven underline
strokes, notebook margin doodle arrows. Both columns must be readable at 1/3 size.
