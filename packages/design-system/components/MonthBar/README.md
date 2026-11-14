# MonthBar

A month-at-a-glance bar: either the combined four-state bar (ranking, pick list) or two Sun/Earth lanes (scrubber, mission window).

Provide `segments` [{from,to,state}] (fractions 0–1) **or** `lanes` {sun:[[a,b]], earth:[[a,b]]}; optional `playhead`, `window` (dashed mission outline), `violations` (fractions; red pinging markers at the first failing hour), `ticks` [[fraction, label]], `label` (accessible name).

- Lanes are labelled Sun and Earth on the left; ticks use readable dates.
- Unfilled track = Blackout: `none` with `line-2` hatching, so the bar reads without colour.
- Fills and the window glide on change (`dur-base`). Always offer *Show as table* nearby.
