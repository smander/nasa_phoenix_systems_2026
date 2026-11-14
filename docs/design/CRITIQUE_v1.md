## Design Critique: Polar Window mockups v1

### Overall Impression
The data is real and the hero panorama is the right idea, but the page reads as a generic dark admin dashboard: six identical bordered cards, each with an id chip, a title, audience tags and a paragraph, stacked down a long scroll. Nothing in the first two seconds says "you are standing on the Moon", and the Sun and Earth, the two things the product is about, are small marks on a grey chart.

### Usability
| Finding | Severity | Recommendation |
|---|---|---|
| Time is controlled by a plain range slider, separate from the month ribbon that shows what the time means | 🔴 Critical | Make the site's month ribbon the scrubber: drag the playhead across the Sun and Earth lanes |
| The page is a "design board" of M1–M6 sections, not a product; a judge cannot see how one screen leads to the next | 🔴 Critical | Present one app: top bar (site, mode, theme), sky hero, status, then compare, context and mission sections |
| Audience modes are only tags; the mockup never shows how Explorer, Educator and Planner differ | 🟡 Moderate | Add a working mode switch that hides or reveals explanations and the mission section |
| Readout cards are seven-row key/value lists; the one number that matters (is it up, by how much) is buried | 🟡 Moderate | Lead each block with one large numeral and a one-line consequence |
| The SPL code panel is the largest element in M5 and pushes the rule verdicts aside | 🟡 Moderate | Pair the code with a `saple analyze`-style result block; keep rules as the primary column |
| The property inventory (M6) is reference material inside the product view | 🟢 Minor | Move it to a collapsed "Design reference" section |

### Visual Hierarchy
- **What draws the eye first**: the "Polar Window" heading and the row of chips, not the sky. Incorrect: the sky panorama should dominate.
- **Reading flow**: the eye zig-zags between card headers, audience tags and right-aligned paragraphs in every section; the repeated header pattern flattens everything to equal weight.
- **Emphasis**: the Sun is a 4 px dot and Earth a small circle on a chart grid; the grey terrain gradient has no light or depth. The subject's drama (black sky in daylight, the Sun grazing a ridge, a phased Earth on the horizon) is missing.

### Consistency
| Element | Issue | Recommendation |
|---|---|---|
| Typography | Three faces at many small sizes; 10.5–11 px SVG labels scale down further inside `viewBox`; mono used for prose-like readouts | One family with a width axis for display and text, mono only for numbers; render SVG at 1:1 so labels are true 12 px |
| Color | The "Sun only" state uses a 16% tint that disappears on the dark ground; "dark" lanes use the line colour, close to the background | Use solid, distinct state fills; reserve tints for hover and selection |
| Badges | Every scorecard cell carries a pill, so nothing stands out | Colour the numbers by band; drop the pills |
| Borders | Every block is a bordered card with the same radius | Use space and hairlines; keep surfaces for the hero and the few true panels |

### Accessibility
- **Color contrast**: body and muted text pass on both themes; 10.5 px faint labels in charts fall below comfortable reading size.
- **Touch targets**: site chips and theme buttons are about 30 px tall; aim for 36–40 px.
- **Text readability**: SVG text shrinks with the figure; at phone width the panorama labels become unreadable.

### What Works Well
- Real geometry: LOLA horizons and validated Sun/Earth tracks make the visuals trustworthy.
- Consistent colour semantics for Sun, Earth and both.
- The generated SPL model is a genuinely unique feature.

### Priority Recommendations
1. **Make the sky the hero**: a full-width lunar sky rendered on canvas, with a black sky and stars, terrain that occludes the bodies, rim light on the ridge facing the Sun, a glowing Sun, and Earth drawn with its real phase.
2. **One app, not a board**: a top bar with site picker, mode switch and theme; a ribbon scrubber under the sky; a status row with big numerals; then compare, context and mission sections.
3. **Quiet the chrome**: remove id chips, audience tags and per-cell pills; one display style for numbers; hairlines instead of boxes; true-size chart text.
