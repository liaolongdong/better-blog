# Cover prompt | hyperframes-first-render-timeout | candidate 02

Backend: runtime native image tool (ImageGen). Aspect 16:9, output 1792x1024.
Type: conceptual. Palette: warm. Rendering: flat-vector. Text: title-only. Font: clean. Mood: balanced.

## Task

Generate a 16:9 (1792x1024) flat vector illustration cover for a technical blog post. ONE conflict only:
the same command fails the first time and succeeds the second time, and the durations are inverted
(the failing run is the fast one).

## Composition parameters (hard requirements, self-declared)

- Canvas 1792x1024, 16:9, no border, no frame, no watermark, no logo.
- Background: uniform warm paper `#F4EDE1` across 100% of the canvas. NOT near-white, NOT pale blue, NOT dark.
- Ink linework `#1E2A38`; one failure accent vermillion `#D8452A`; one success accent calm teal `#2E7D6B`. No gradients.
- Whitespace: at least 45% empty background; nothing inside the outer 8% margin.
- Both bars live inside the vertical 40%-60% band (the site crops ~17% top and bottom, so the content must be
  in the centre band). Upper bar at about 43% height, lower bar at about 57% height.
- Bars start at x = 10% and are drawn centred-left; the right third of the canvas holds only the text label.
- Element count: two horizontal bars, one dashed vertical gate, one cross mark, one tick mark. Nothing else.
  No humans, no faces, no terminals, no keyboards, no isometric cubes, no glowing spheres, no purple.

## The drawing

Two identical-thickness horizontal rounded bars, stacked, same starting x, both ending at the same right x.
A single tall thin vertical dashed gate line crosses both bars at x = 52% of canvas width.
The UPPER bar is filled vermillion only up to where it meets the gate, and stops dead AT the gate with a
small clean cross mark (two strokes) just left of the gate line; the segment after the gate is empty background.
The LOWER bar passes straight through the same gate, is filled ink slate for the whole length with a teal cap
at its right end, and carries a small clean tick mark just after the gate.
Upper bar is visibly shorter (it stops at the gate); lower bar is visibly longer (it goes through).

## Text on image (ASCII ONLY — Chinese characters are forbidden; verify each string is ASCII)

Large clean sans-serif label in the right third, vertically centred in the 40-60% band, ink colour,
with the two numbers coloured (41s vermillion, 84s teal). Exactly this text, on two lines:

```
41s red ·
84s green
```

Two groups separated by ` · `: group 1 = `41s red` (2 words), group 2 = `84s green` (2 words), total 4 words,
each under 20 characters. The digit glyph height must be at least 7% of canvas height (about 70px at 1024) so
the numbers stay readable at 320px width.

Logical label string: `41s red · 84s green`.

## Negative constraints

No purple gradient, no glowing sphere, no isometric cubes, no full-dark scene, no full-pale scene, no Chinese
characters, no extra words beyond the label, no photorealism, no watermark, no drop shadow heavier than 4px.
