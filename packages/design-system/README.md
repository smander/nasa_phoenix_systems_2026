Polar Window is a calm operations console for the lunar south pole: pick a landing point, see where the Sun and Earth sit against that point's real terrain horizon, and prove the mission rules hold with SAPLE. This system is Concept A, **Mission Console** — a black lunar sky as a wide hero band, a scrubber under it, big-numeral readouts, then dense but quiet panels. Keep the chrome minimal so it never reads as a generic dark dashboard: the Sun, Earth and both-up colours are the only saturated hues on screen.

## Content fundamentals

- Write for three audiences at once. Planners get exact numbers; educators get one idea per click; the public gets a one-line answer. Modes (Explore / Teach / Plan) change how much is shown, never what is possible.
- Readable first. Sentence case everywhere (labels and badges too); only the wordmark is uppercase. Lead every screen with a plain-language answer ("Good site for a short stay") before any numbers.
- Label things the way a person would say them: "Sun height", "Longest darkness", "Battery lasts (hours of darkness)", "Sunlight for the whole stay". Formal names (SunlitStay, invariant, `sun == UP`) live inside the collapsed "Show the formal proof".
- Minimum sizes: 16px body, 14px labels and captions, 13px only for notes and chart ticks. Mono only inside the terminal and the scrubber clock.
- Plain, declarative, present tense. Address the reader as "you" only in instructions ("Pick a candidate landing point…"). No exclamation marks, no emoji.
- Use the fixed state copy verbatim — badge / headline / sub-line:
  - **Power and contact** — Sun and Earth both up — Arrays generate and the direct-to-Earth link is open.
  - **Power only** — Sunlit, Earth out of sight — Arrays generate; data waits for Earth to rise.
  - **Contact only** — Earth in view, Sun hidden — Radio link open; running on stored energy.
  - **Blackout** — No sunlight, no Earth — Batteries carry the lander; no direct radio link.
- Say "NASA Artemis candidate landing regions (Aug 2022 / Oct 2024 lists)", never "Artemis III landing sites".
- Numbers: signed angles with a true minus (+1.90°, −0.23°); azimuth 0–360° clockwise from north; whole-number percentages; durations of 48 h or more in days (6.2 d); UTC always, written out ("Jan 16, 2027 16:00 UTC"). Set them in `data` or `big-numeral` — tabular figures, never proportional.

## Honesty labels (always visible)

Use `HonestyNote` for each, next to the thing it qualifies: "elevation ×5" on the sky; "relief shading, not lighting" on the map; "Earth visible = line of sight, not a ground-station pass" near contact figures; the `QualityBadge` "approximate" on digitised coordinates; the "preview" tag on SAPLE verdicts until the engine runs; "≤ 0.01° vs JPL Horizons (0.002° typical)" in the footer.

## Colour

- Dark is the primary theme (`dark`), light the second; both are designed. The sky, the brand mark and the terminal do not change with theme: `sky-bg`, `sky-*`, `terrain`, `ridge` and `term-*` are fixed.
- Grounds: `bg` for the page, `panel` for panels and list items, `panel-2` only for a pressed segment. Divide with `line` hairlines; borders of controls use `line-2`. No shadows on resting surfaces.
- Text: `fg` for primary, `muted` for secondary (both pass AA on `bg` and `panel` in both themes). `faint` is never for readable copy — it fails 4.5:1 in both themes.
- Meaning is fixed and never reused for brand: `sun` amber = Sun, `earth` blue = Earth, `both` green = both up, `none` + `line-2` hatching = neither. Verdicts are a separate scale: `good`, `ok`, `poor`.
- Every colour is paired with a word or icon — the state badge has its label, the month bar has a key, Blackout has hatching, rule verdicts have ✓ / ✗ / dashed preview ring. `sun` and `both` differ by hue only; never rely on them alone.
- Light theme: `sun`, `both` and `ok` are below 4.5:1 on `bg` (3.3, 3.7, 3.6). Use them as fills and marks; as text only at 19px bold or larger (the v2 ranking numbers and pick-list percentages sit right at that edge — keep them bold).
- The primary button is `fg` on `bg` — the only filled control. The focus ring is a solid 2px `focus` outline, offset 2px, on every control and every chart.

## Type

- Archivo (variable: width 62–125, weight 100–900) for display and text; IBM Plex Mono 400/500 for data. Both load from Google Fonts — `components/bundle.css` imports them.
- Headings use width: `section-title` and `step-title` at 118%, `sky-headline` at 122%, `brand-name` at 125%, `eyebrow` and badges at 112%, `big-numeral` at 110%, `rank-value` at 106%. Set it with `font-stretch`.
- `body` 15/1.5 for copy, `lede` 14.5 for intros, `caption` 13.5 under readouts and in tables, `meta` 12.5 under names.
- Numbers use Archivo with tabular figures; mono is reserved for the terminal and the clock. Labels stay in Archivo.

## Layout and spacing

- Content max `wrap-max` (1280px); side gutter `space-24`, `space-16` under 600px. Sections open with `space-44`; panels pad `space-20` and sit `space-24` apart.
- Step 2 order: sky hero → scrubber → four readouts (hairline-divided, `space-22` each side) → two-up chart panels → full-width ranking → mission check (Plan).
- Under 1000px readouts go two-up and panels stack; under 600px readouts stack and tables collapse to name + two numbers. Only the sky may scroll sideways, inside its own frame.
- Radii: `radius-md` for buttons and segmented tracks, `radius-lg` for list items, `radius-xl` for panels and the terminal, `radius-pill` for badges.

## Motion

Motion explains the sky; it is never decoration for its own sake. Everything stops under `prefers-reduced-motion`.

- **The signature:** in `SkyHero`, scrubbing slides the Sun along its track, its glow fades as the disc sinks behind the ridge, and badge + headline + sub-line flip together (`dur-flip`, `ease-out`). One month plays in `dur-month`.
- State badge dots breathe (`dur-breath`); stars twinkle at staggered phases (`dur-twinkle`) and dim near the Sun.
- Readout numerals count up (`dur-slow`) when the point or time changes.
- Month-bar fills and the mission window glide (`dur-base`); violations ping in `poor` at the first failing hour.
- Rule verdict icons flip in with a small overshoot (`ease-spring`); the terminal types its output line by line with a caret.
- Section dividers are `HorizonRule` ridges whose sunlit stretch draws on.
- Console crop marks (`.pw-bracket`) grow toward the content on hover and focus — use them on the readout you want to draw the eye to, not on every block.
- Computing shows a scanning beam (`dur-scan`) and a Sun→both→Earth progress line; earlier results stay visible.
- Hover: colour/border changes in `dur-fast`; list items lift 1px; buttons press to 97%.

## Charts

- Lunar sky: x = azimuth over 360° centred on Earth, y = elevation exaggerated ×5 (say so). Terrain hides the discs; Sun and Earth at true angular size on the vertical scale; Earth drawn at its real phase; compass labels; elevation scale.
- Month bars and lanes: `MonthBar`. Energy per day: `sun` bars in kWh/m², zero days drawn as a short `muted` tick. Contact hours: `earth` bars, 0–24 h, sharing the x-axis.
- Every chart sits in a `Panel` with a *Show as table* toggle, is focusable, and moves time with the arrow keys.

## Iconography

No icon font in v2. Icons are small inline SVG drawn at 1.4–1.8px strokes in `currentColor`: play/pause, ✓ / ✗ verdicts, the quality glyphs (dashed square, target, ≈, +), the select chevron. Keep them geometric and monochrome; no emoji, no NASA logos or insignia. The app mark is `assets/Logos/polar-window-mark.svg`.
