# Cover candidate B — `baoyu-cover-image --quick --aspect 16:9 --text title-only --lang en`

Backend: runtime native image tool. Same pipeline as candidate A; only the label and
the drawn conflict differ. Kept as the second candidate required by §8.2.1.

## Text on image (ASCII only, two groups split by ` · `, 4 words total)

    101 integers · 0 gradient

This is the other half of the same main peak: on 101 integer points the sweep
`nonzero gA=0 nonzero gT=0` — the values are exact there, and the gradient is dead
there too.

## Composition self-described in the prompt

- One image, one conflict: two stacked rows of squares, the lower row all zero.
- Subject in the vertical 40%-60% band, ≥40% empty margin above and below.
- Subject left-of-centre, right third open.
- Mid-tone warm grey base (#3a3f45), NOT near-white, NOT near-black.
- Numbers legible at 320px.
- FORBIDDEN: purple gradient, glowing sphere, isometric cubes, pale line art on
  white, all-dark with tiny subject, watermark.

## Full prompt

Minimal editorial technical illustration, 16:9, one image one conflict.

Two short stacked rows of small squares sitting in the vertical middle band of the
frame (40% to 60% of the height), positioned left of centre, right third of the
frame left empty. The upper row is a run of about ten identical solid teal squares.
The lower row is a run of about ten identical squares each containing a single
small zero, drawn in flat off-white. A thin bracket on the left ties the two rows
together. Nothing else in the picture: no grid, no axes, no machine, no person, no
logo, no chart.

Text, ASCII only, large and legible at 320 pixels wide, one line, placed above the
rows with generous space around it:

101 integers · 0 gradient

Background is a flat mid-tone warm grey (#3a3f45), matte, no gradient, no
vignette. Shapes are flat vector with a slight paper grain. Restrained palette:
warm grey base, teal, off-white.

Hard constraints: no purple gradient, no glowing sphere, no isometric cubes, no
near-white background, no near-black background, no tiny subject lost in darkness,
no watermark, no signature, no photographic elements, no extra words or letters
anywhere in the image.
