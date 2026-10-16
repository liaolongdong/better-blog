# Cover candidate A — `baoyu-cover-image --quick --aspect 16:9 --text title-only --lang en`

Backend: runtime native image tool (no DASHSCOPE_API_KEY on this machine).
Size: 1792x1024 (16:9), later scaled to 1600 wide and converted to WebP with ffmpeg.

## Text on image (ASCII only, two groups split by ` · `, 5 words total)

    grid 301 exact · seam 99 off

These are this article's own readings: 301 integer points, 0 mismatches against
JavaScript's `>`; 101 points between 4 and 5 at 0.01 steps, 99 mismatches.
It is a second wording of the article's main peak (the exact domain and the
non-zero-gradient domain do not overlap), not a second slogan.

## Composition self-described in the prompt

- One image, one conflict: a single horizontal number line band, nothing else.
- Subject sits in the vertical 40%-60% band; at least 40% empty margin above and below.
- Subject left-of-centre, right third left open as the eye's exit.
- Mid-tone slate background (#2b3340-ish), NOT near-white, NOT near-black.
- Labels large enough to read at a 320px thumbnail.
- FORBIDDEN: purple gradient, glowing sphere, isometric tech cubes, pale white base
  with light-blue line art, all-dark base with a tiny subject, any watermark.

## Full prompt

Minimal editorial technical illustration, 16:9, one image one conflict.

A single thin horizontal number line drawn across the vertical middle band of the
frame (roughly 40% to 60% of the height), left of centre, with the right third of
the frame left empty. On the line, evenly spaced tick marks. Every tick left of a
marked interval is drawn as a small solid teal dot; inside the one marked interval
between two labelled ticks the dots are drawn as hollow amber rings, visibly
different, crowded together. Nothing else in the picture: no chart axes, no
computer, no person, no logo.

Text, ASCII only, large and legible at 320 pixels wide, placed on two lines in the
upper-left area with generous space around it:

grid 301 exact · seam 99 off

Background is a flat mid-tone slate (#2b3340), matte, no gradient, no vignette.
Dots and line are flat vector shapes with a slight paper grain. Restrained palette:
slate base, teal, amber, off-white text.

Hard constraints: no purple gradient, no glowing sphere, no isometric cubes, no
near-white background, no near-black background, no tiny subject lost in darkness,
no watermark, no signature, no photographic elements, no extra words or letters
anywhere in the image.
