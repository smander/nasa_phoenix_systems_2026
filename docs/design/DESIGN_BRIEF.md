# Polar Window: Design Brief for Concept Exploration

This document contains everything needed to design Polar Window from scratch: what the product does, who it serves, the user flow, every screen, every property and its range, every control, every state, the charts, real sample data, the copy rules, and five concept directions to explore. It is self-contained; no other file is needed.

---

## 0. How to use this brief in another chat

Paste the whole document, then ask, for example:

> Using this brief, design **Concept B (Lunar Almanac)** as a high-fidelity mockup: the Step 1 screen and the Step 2 results screen, desktop width, using the real sample data in section 9. Keep every function in section 5 and every property in section 6.

Or:

> Produce three different visual concepts for the Step 2 results screen. All must show the properties in section 6.3–6.7 and the four sky states in section 7.1.

Rules that apply to every concept are in section 10. The concept directions are in section 11.

---

## 1. The product in one paragraph

**Polar Window** lets a mission planner, a teacher or anyone curious pick a landing point near the Moon's south pole and instantly see, for any date, where the **Sun** and the **Earth** are relative to that point's real terrain horizon. From that it shows how much **solar power** the lander gets and when it has a **direct radio line to Earth**. Planners can then check whether a mission's rules hold (sunlight for the whole stay, battery never empties, Earth contact often enough) using **SAPLE**, a formal verification engine based on process algebra. That verification step is what makes this product unique.

### The challenge it answers (NASA Space Apps 2026, "CLPS Lunar Mission Browser")

> Missions to the Moon's south pole face extreme lighting and communication constraints, and planning them takes careful coordination between science and engineering teams. Tools for determining Sun and Earth positions at candidate landing sites exist, but their complicated interfaces make it difficult to evaluate critical information with efficiency. Your challenge is to create an intuitive tool or application that lets mission planners, educators, and the public compare landing sites and dates quickly, visualizing Sun and Earth positions relative to the horizon to assess power generation potential and direct-to-Earth communication windows.

Judging criteria (Space Apps): Impact, Creativity, Validity, Relevance, Presentation.

### Why the south pole is hard (the story every design must tell)

- The Moon has no air, so **the sky is black even in daylight**.
- At the pole **the Sun never rises more than about 1.5°**. It circles the horizon once every 29.5 days, so a small ridge can hide it for days.
- **Earth hangs in almost the same spot in the sky** but bobs up and down by about ±7° over 27 days (libration). At the pole that means Earth is in view roughly two weeks, then hidden roughly two weeks.
- So a site can have power without radio contact, contact without power, both, or neither. Choosing **where** and **when** to land decides the mission.

---

## 2. Audiences and what each must achieve

| Audience | Main job | Must succeed in | What they care about |
|---|---|---|---|
| Mission planner | Pick a site and landing date that keeps the lander powered and in contact; prove the mission rules hold | under 2 minutes | exact numbers, longest dark spell, longest comms gap, battery margin, rule verdicts, export, shareable link |
| Educator | Show a class why the Sun skims the horizon and why Earth disappears for two weeks | one click per idea | clear visuals, plain-language explanations, glossary |
| Public | Pick a famous site and see what it would be like to stand there | under 30 seconds | a beautiful, understandable sky; a one-line answer |

The interface has three **modes** that change how much is shown, never what is possible:

- **Explore** (public): the sky, simple readouts, ranking. The mission check is hidden.
- **Teach** (educator): Explore plus plain-language explanation panels and highlighted glossary terms.
- **Plan** (planner): everything, including the mission check, advanced settings and export.

---

## 3. Core user flow

The product is a two-step flow. This order was chosen by the product owner.

```
STEP 1  Choose where to land
        map of the south pole + list of candidate points
        → click a point on the map, or a point in the list, or type latitude/longitude
                     │
                     ▼
STEP 2  Results for that point
        a. Lunar sky right now (Sun, Earth, terrain horizon)      ← hero
        b. Time scrubber across the month (play / drag)
        c. Readouts: Sun · Earth · Energy · Observer height
        d. Day by day: energy per day, Earth-contact hours per day, Earth's wander
        e. Ranking against other points
        f. Mission check with SAPLE (Plan mode): landing date, stay length,
           battery, Earth-contact need → rule verdicts + generated model
```

Secondary flows:

1. **Change the date range** (next lunar day, next 90 days, next year, custom), and the whole of Step 2 recomputes.
2. **Compare** up to 8 points side by side (ranking table and month bars).
3. **Pick a landing date** by clicking the landing-date strip. The mission window, battery curve and verdicts update.
4. **Share**: copy a link that restores the exact view (point, dates, time, settings, mode).
5. **Export**: data as CSV (hourly series per point, ranking table) and any chart as PNG or SVG.
6. **Learn**: glossary, "How this is computed", validation results, data sources.

---

## 4. Screens and regions

| # | Screen / region | Priority | Contents |
|---|---|---|---|
| S0 | App bar (persistent) | P0 | brand, current landing point (selector), date range, mode switch (Explore / Teach / Plan), theme (Auto / Dark / Light), share |
| S1 | Step 1: Choose where to land | P0 | south pole map with candidate points, Sun direction and Earth direction markers; list of candidate points grouped by source, each with a month bar and Sun % / Earth %; custom latitude/longitude entry; "See results" call to action |
| S2a | Lunar sky hero | P0 | 360° panorama: black sky, stars, terrain horizon silhouette, Sun disc with glow, Earth disc with its real phase, faint month-long tracks of both; state headline; date and time |
| S2b | Time scrubber | P0 | play/pause; month bar with Sun lane and Earth lane; draggable playhead; mission window outline (Plan mode) |
| S2c | Readouts | P0 | Sun block, Earth block, Energy block, Observer-height block (slider) |
| S2d | Day by day | P0 | solar energy per day (bars), Earth-contact hours per day (bars), Earth's monthly wander (libration loop) |
| S2e | Ranking | P0 | table of points with month bars and Sun %, Earth %, both %, longest night; sortable; current point highlighted |
| S2f | Mission check (SAPLE) | P0 in Plan mode | stay length, battery reserve, Earth-contact need; landing-date strip; mission window lanes and battery curve; rule list with verdicts; generated model (code) and verification output |
| S3 | Advanced settings (drawer / panel) | P1 | horizon model, disc threshold, minimum Earth elevation, panel model, efficiency, time step |
| S4 | Learn / About | P1 | glossary, method, validation table, data sources, limitations |
| S5 | Share & export dialog | P1 | copy link, CSV, PNG/SVG |

Mobile: S1 stacks the map above the list; S2a stays full-width (it may scroll horizontally or show a 180° window centred on Earth); readouts stack; tables collapse to name + two key numbers.

---

## 5. Functions (complete list)

**Point selection**

- F1. Choose a landing point from presets, grouped as:
  - NASA Artemis candidate regions, Oct 2024 list (9);
  - NASA Artemis candidate regions, Aug 2022 list (13);
  - reference sites (Shackleton rim, Connecting Ridge peak, IM-2 landing, LCROSS impact, VIPER planned site, the South Pole, …).
- F2. Choose a custom point by clicking the map or typing latitude (−80 to −90) and longitude (−180 to 180 east).
- F3. Show the coordinate quality of each point: region centre, exact point, approximate (digitised from a NASA map), or custom.
- F4. Compare up to 8 points at once.

**Time**

- F5. Choose a date range with presets (next lunar day = 29.5 days, next 90 days, next year) or custom dates (UTC).
- F6. Scrub through time, play the month as an animation, or jump with the keyboard (hour, day).
- F7. The time step adapts automatically (1 hour up to 400 days, coarser beyond); the step used is always shown.

**Geometry**

- F8. Compute Sun and Earth direction (azimuth, elevation), distance and apparent size at the point for every time step.
- F9. Compute the terrain horizon in every direction (720 directions) from NASA LOLA elevation data.
- F10. Raise the observer (lander deck 2 m, solar mast up to 20–50 m) and recompute instantly.

**Visibility, energy and contact**

- F11. Decide for every hour whether the Sun is above the terrain and whether Earth is in line of sight, giving one of four states (section 7.1).
- F12. Compute solar power and energy for a vertical Sun-tracking array (default), a fixed vertical panel or a flat panel.
- F13. Compute monthly figures: Sun %, Earth %, both %, longest night, longest Earth gap, energy, cell area for 10 kW.
- F14. Show energy per day and Earth-contact hours per day.
- F15. Show Earth's phase as seen from the point, and Earth's libration path.

**Ranking and mission**

- F16. Rank points by any metric, with strong / acceptable / weak bands.
- F17. Mission check:
  - choose a stay length (6.5 / 10 / 14 days), battery reserve (hours of darkness it covers) and the Earth-contact share needed;
  - see which landing dates work;
  - pick one and see the window.
- F18. SAPLE verification: generate a formal model of the stay and verify five mission rules (section 6.8), showing the first violating hour for any rule that fails.

**Output, help and display**

- F19. Share the exact view as a link.
- F20. Export CSV and PNG/SVG.
- F21. Explain every term (glossary pop-ups) and show "How this is computed", the validation results and the data sources.
- F22. Offer three audience modes, two themes, a keyboard-accessible interface and a phone layout.

---

## 6. Data dictionary: every property that changes

Format notes: angles are in degrees with a sign (+1.90°); azimuth runs 0–360° clockwise from north; times are always UTC; percentages are whole numbers; durations of 48 hours or more are shown in days (6.2 d).

### 6.1 Landing point (site)

| Property | Example | Range / values | Shown in |
|---|---|---|---|
| Name | Malapert Massif | text | everywhere |
| Group | Artemis region (2022 & 2024) | Artemis 2024 list / Artemis 2022 list / reference / custom | list, ranking |
| Latitude, longitude | −85.980°, −0.26°E | −80…−90; −180…180 east | list, Step 2 header, map |
| Coordinate quality | region centre | region centre / exact point / approximate / custom | badge |
| Elevation | +4.82 km | −0.2 to +6.4 km for presets (relative to a 1737.4 km sphere) | header, list |
| Highest horizon | +4.2° | −5° to +14° | sky, readouts |
| Region outline | ~15–30 km box | Artemis regions only | map |

### 6.2 Time

| Property | Example | Range | Shown in |
|---|---|---|---|
| Current time | Jan 16, 2027 16:00 UTC | within the date range | sky, scrubber |
| Date range | Jan 1–31, 2027 | 2020–2050 | app bar, scrubber |
| Time step | 1 h | 10 min, 1 h, 3 h, 6 h | settings, footnote |

### 6.3 Sun (at the point, at the current time)

| Property | Example | Typical range at the south pole | Shown in |
|---|---|---|---|
| Azimuth | 72.7° | 0–360°, one full turn per 29.53 days | sky, readout |
| Elevation | +1.90° | about ±1.6° at the pole, up to ±5° at 85°S | sky, readout (big numeral) |
| Terrain height in that direction | +2.13° | −5° to +14° | readout |
| Clearance (centre above terrain) | −0.23° | ±several degrees | readout |
| Visible above terrain | yes | yes / no (any part of the disc) | sky, state, lanes |
| Apparent radius | 0.271° | 0.270–0.272° (Jan); 0.262–0.272° over a year | sky disc size |
| Sunlight intensity at the Moon | 1408 W/m² | 1316–1408 W/m² | readout |

### 6.4 Earth (at the point, at the current time)

| Property | Example | Typical range | Shown in |
|---|---|---|---|
| Azimuth | 352.7° | within ±8° of the sub-Earth direction | sky, readout |
| Elevation | +10.28° | about ±7° at the pole; −3° to +10.5° at Malapert | sky, readout (big numeral) |
| Terrain height in that direction | −1.45° | — | readout |
| In line of sight | yes | yes / no (any part of the disc) | sky, state, lanes |
| Distance | 377,117 km | 357,000–407,000 km | readout |
| Apparent radius | 0.968° | 0.90–1.02° | sky disc size |
| Phase (lit fraction) | 41% lit | 0–100%; the opposite of the Moon's phase seen from Earth | sky (Earth drawn as a crescent or gibbous), readout |
| Libration (sub-Earth point) | −7.5° E–W, −6.5° N–S | ±7.8° / ±6.9° | Earth's wander chart |

### 6.5 Combined state (each hour)

| Code | Name | Meaning | Colour role |
|---|---|---|---|
| 3 | Power and contact | Sun above terrain and Earth in view | "both" (green) |
| 1 | Power only | Sun up, Earth hidden | Sun (amber) |
| 2 | Contact only | Earth in view, Sun hidden | Earth (blue) |
| 0 | Blackout | neither | neutral dark or grey, with hatching |

### 6.6 Energy

| Property | Example (Malapert, Jan 2027) | Range | Shown in |
|---|---|---|---|
| Power now (vertical array, 30% cells) | 28 W/m² (Sun partly behind ridge) | 0–~425 W/m² | Sun readout |
| Average power over the range | 282 W/m² | 0–425 | Energy readout, ranking |
| Energy over the range | 203 kWh per m² | 0–~310 per month | Energy readout |
| Energy per day | best day 10.2 kWh/m² | 0–10.2 | day-by-day bars |
| Days with no sunlight | 7 | 0–31 | day-by-day caption |
| Cell area for 10 kW average | 35 m² | — | Energy readout |
| Longest night (storage needed) | 6.2 d | 0 h – 20 d | Energy readout, ranking |

### 6.7 Earth contact

| Property | Example | Range | Shown in |
|---|---|---|---|
| Earth in view share | 75% | 0–100% | ranking, header |
| Longest Earth gap | 4.5 d | 0 h – 12 d | header, ranking |
| Contact hours per day | 0–24 | 0–24 | day-by-day bars |

### 6.8 Mission and SAPLE rules

| Property | Example | Range / values | Control |
|---|---|---|---|
| Stay length | 6.5 days | 6.5 / 10 / 14 days | segmented control |
| Landing date | Jan 2 06:00 UTC | any hour where the stay fits in the range | click on landing-date strip |
| Landing-date quality | sunlit with contact / sunlit only / dark spell | 3 classes per start hour | strip colour |
| Battery reserve | 50 h | 0–120 h of darkness | slider |
| Earth contact needed | 25% | 0–100% (NASA screening used 25%) | slider |
| Battery level through the stay | curve, 50 h → 0 h | — | battery chart |
| Rule verdict | holds / violated at Jan 7 14:00 | per rule | rule list, timeline marker |

The five rules, each a SAPLE property:

| Rule | Kind | Formal property | Plain meaning |
|---|---|---|---|
| SunlitStay | invariant | `sun == UP` | sunlight on the arrays every hour of the stay |
| BatterySafe | invariant | `reserveH >= 0` | no dark spell longer than the battery covers |
| DteWindow | reachable | `earth == UP` | Earth comes into view at least once |
| DteCoverage | invariant | `contactPct >= 25` | Earth in view for at least the required share |
| Blackout | unreachable | `sun == DOWN && earth == DOWN` | never without both power and contact |

The generated model is a short SPL program:

- a `Sky` agent whose behaviour is the exact sequence of Sun and Earth rise/set events during the stay (`tick(77) . earthRise() . tick(79) . done`);
- a `Lander` agent that downlinks only when Earth is up;
- a `Mission` schema holding the Sun and Earth state and the battery reserve.

The design should show this model as code and its verification output in a CLI style:

```
$ saple analyze polar_window_malapert_massif.sbl --verbose
  SunlitStay    invariant   ✓ holds
  BatterySafe   invariant   ✓ holds
  DteWindow     reachable   ✓ holds
  DteCoverage   invariant   ✓ holds
  Blackout      unreachable ✓ holds
  5 of 5 rules hold
```

### 6.9 Settings (advanced)

| Setting | Default | Options |
|---|---|---|
| Observer height (mast) | 2 m | 0–50 m |
| Horizon model | terrain (LOLA 240 m) | terrain / flat (smooth Moon) / uniform angle |
| Disc threshold, Sun and Earth | any part visible | any part / half / whole disc |
| Minimum Earth elevation | 0° | 0° / 2° / 5° |
| Panel model | vertical, turns to face the Sun | vertical tracking / vertical fixed / flat |
| Cell efficiency | 30% | 20–35% |
| Time step | automatic | 10 min / 1 h / 3 h / 6 h |

---

## 7. States

### 7.1 Sky states (the headline of Step 2)

| State | Badge | Headline | Sub-line |
|---|---|---|---|
| both | POWER AND CONTACT | Sun and Earth both up | Arrays generate and the direct-to-Earth link is open. |
| Sun only | POWER ONLY | Sunlit, Earth out of sight | Arrays generate; data waits for Earth to rise. |
| Earth only | CONTACT ONLY | Earth in view, Sun hidden | Radio link open; running on stored energy. |
| neither | BLACKOUT | No sunlight, no Earth | Batteries carry the lander; no direct radio link. |

### 7.2 Other states to design

| Situation | What the user sees |
|---|---|
| First load | Step 1 with the map; a default point preselected (Malapert Massif) |
| Computing (long ranges) | the sky and bars show a skeleton; a progress line; earlier results stay visible |
| Custom point inside terrain data | computed normally; badge "custom point, terrain 480 m" |
| Custom point outside terrain data | warning: terrain unavailable, flat horizon used; offer "snap to nearest preset (X km away)" |
| Point exactly at the pole | works; note that azimuth is measured from the 0° meridian |
| Earth never visible in the range | Earth readout "Hidden all month"; DteWindow rule violated |
| Sun never sets | "Sun up all month"; longest night 0 h shown as a strength |
| Rule violated | red marker on the mission timeline at the first failing hour; rule row in red with the time |
| Approximate coordinates | an "approximate" badge with a tooltip naming the source |
| Comparison of more than 8 points | the add button is disabled with an explanation |
| Data/terrain file failed to load | error card with retry; the sky falls back to a flat horizon with a visible note |
| Wide date range | the step coarsens; footnote "3-hour steps"; CSV export capped with a notice |

---

## 8. Visualizations (what each must encode)

| Chart | Purpose | Encoding | Interaction | Must-haves |
|---|---|---|---|---|
| Lunar sky panorama (hero) | Show where the Sun and Earth are relative to the terrain | x = azimuth (360°, centred on Earth's direction), y = elevation (vertically exaggerated, about ×5; say so); terrain silhouette; Sun and Earth discs at true angular size on the vertical scale; faint month tracks, dashed where hidden | follows the scrubber; optional drag | black sky in every theme; terrain hides the bodies; Earth's phase; compass labels (N, NE, E, …); elevation scale; "elevation ×5" note |
| Month scrubber | Move through time; see the month at a glance | two lanes (Sun, Earth) coloured where up; playhead | drag, keyboard, play | date ticks; mission window outline |
| Energy per day | Power potential | bars, kWh per m² per day; zero days marked | hover for values | axis with round numbers |
| Contact hours per day | DTE windows | bars, 0–24 h | hover | shares the x-axis with energy |
| Earth's wander | Why contact comes and goes | libration loop (E–W vs N–S, ±8°), darker = later, current Earth position with phase | follows time | 4° and 8° rings |
| South pole map | Choose and orient | polar view, 0° longitude up; relief shading; candidate points; region outlines; Sun direction ray; Earth direction mark; 86°S and 88°S rings | click to choose, hover labels | label "relief shading, not lighting" |
| Ranking | Compare points | rows with a month bar (4 state colours) and numbers coloured by band | sort, click to select | current point highlighted |
| Landing-date strip | Choose a landing date | each start hour coloured: sunlit with contact / sunlit only / dark spell | click to pick | selected start outlined |
| Mission window | Inspect the stay | Sun lane, Earth lane, battery curve with "empty" line; red markers at violations | — | land and lift-off times |
| Rule list + model | Verification | rows with verdict icon, rule name, formal expression, kind, explanation; code panel; CLI output | expand code | honest "preview" label until SAPLE runs |

---

## 9. Real sample data (use these numbers in mockups)

Data window: Jan 1–31, 2027 UTC, hourly. Observer 2 m above ground. Terrain: NASA LOLA 240 m.

### 9.1 Six points

| Point | Group | Lat, Lon E | Elev. | Sun % | Earth % | Both % | Neither % | Longest night | Longest Earth gap | Avg power | Energy (month) | Highest horizon |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Malapert Massif | Artemis region (2022 & 2024) | −85.980, −0.26 | +4.82 km | 69 | 75 | 54 | 10 | 6.2 d | 4.5 d | 282 W/m² | 203 kWh/m² | +4.2° |
| Connecting Ridge C1 | reference peak | −89.440, −137.17 | +1.95 km | 100 | 50 | 50 | 0 | 0 h | 8.3 d | 422 W/m² | 304 kWh/m² | −0.5° |
| Shackleton rim | reference point | −89.785, −156.03 | +1.72 km | 100 | 48 | 48 | 0 | 0 h | 8.8 d | 419 W/m² | 302 kWh/m² | +1.1° |
| Mons Mouton | Artemis region (2024) | −85.426, +31.83 | +6.41 km | 100 | 45 | 45 | 0 | 0 h | 9.5 d | 410 W/m² | 296 kWh/m² | +4.8° |
| Haworth | Artemis region (2022 & 2024) | −86.753, −23.67 | +1.55 km | 35 | 35 | 0 | 30 | 19.5 d | 11.3 d | 145 W/m² | 105 kWh/m² | +6.8° |
| de Gerlache Rim 2 | Artemis region (2022 & 2024) | −88.223, −63.43 | −0.16 km | 46 | 47 | 14 | 21 | 15.5 d | 8.9 d | 187 W/m² | 135 kWh/m² | +13.8° |

**Story hook for the observer-height slider:** at Malapert Massif, raising the observer from 2 m to 10 m lifts Earth visibility from **75% to 100%** and Sun from 69% to 73%. A mast changes the mission.

### 9.2 One instant (default view)

Malapert Massif, Jan 16, 2027, 16:00 UTC. State: **Power and contact**.

| | Value |
|---|---|
| Sun | azimuth 72.7°, elevation +1.90°, terrain there +2.13°, disc top just clears the ridge, power 28 W/m², sunlight 1408 W/m² |
| Earth | azimuth 352.7°, elevation +10.28°, terrain there −1.45°, 377,117 km, radius 0.968°, 41% lit, libration −7.5° / −6.5° |

### 9.3 Mission example

Malapert Massif, 6.5-day stay landing Jan 2 06:00 UTC. All five rules hold; Earth rises 77 hours after landing; contact 51% of the stay. Landing on Jan 9 instead would put a dark spell inside the stay, and SunlitStay fails.

---

## 10. Rules every concept must follow

**Colour meaning is fixed**

- Sun amber/orange.
- Earth blue.
- Both up green/teal.
- Neither neutral grey/dark, with hatching.
- Good / warning / bad semantics (green / yellow / red) are separate from the brand accent.
- Every colour is paired with an icon or text so nothing depends on colour alone.

**The lunar sky is black in every theme.** No blue daytime sky, ever. Starfield allowed; it fades near the Sun.

**Honesty labels must stay visible**

- "elevation ×N" on the panorama.
- "relief shading, not lighting" on the map.
- "Earth visible = line of sight, not a ground-station pass".
- An "approximate" badge for digitised coordinates.
- "preview" on SAPLE verdicts until the engine runs.
- Accuracy: "≤ 0.01° vs JPL Horizons (0.002° typical)".

**Wording**

- Say "NASA Artemis candidate landing regions (Aug 2022 / Oct 2024 lists)", never "Artemis III landing sites". NASA moved the first crewed landing to Artemis IV in 2026.
- No NASA logos or insignia.

**Numbers and accessibility**

- Monospaced or tabular numerals for coordinates, times and tables.
- Signed angles (+1.90°). UTC everywhere.
- WCAG AA contrast.
- Keyboard: every chart is focusable, arrows move time, and every chart offers "Show as table".
- Touch targets at least 40 px. Respect reduced-motion.

**Responsive:** works at 375 px width with no sideways page scroll; only the panorama may scroll inside its frame.

**Both themes designed** (the sky stays black in both).

---

## 11. Concept directions

Each direction keeps every function and property above. They differ in metaphor, layout, type, colour and the one signature moment.

### Concept A: Mission Console (the current v2 direction)

- **Idea:** a calm operations console. The black lunar sky is a wide hero band; under it sit a scrubber, big-numeral readouts and dense but quiet panels.
- **Audience tilt:** planners first; the public still gets the hero.
- **Layout:** sticky app bar; Step 1 as map plus list; Step 2 as a hero band, then a four-column readout row, then two-up panels and full-width tables.
- **Type:** a wide grotesque with a width axis for headings and numerals (e.g. Archivo Expanded); a monospace for data.
- **Colour:** near-black blue-grey ground, hairline dividers, the Sun/Earth/both colours as the only saturated hues.
- **Signature moment:** dragging the scrubber while the Sun slides behind the ridge and its glow fades, and the state headline flips from "Power and contact" to "Contact only".
- **Risk:** can drift toward a generic dark dashboard; keep the chrome minimal.

### Concept B: Lunar Almanac

- **Idea:** a scientific almanac or observatory yearbook brought to life. Typeset tables, engraved-style diagrams, precise rules and footnotes. It feels authoritative, ideal for educators and judges who value validity.
- **Layout:** light page; a broad left column of "plates" (sky panorama, wander loop, map) with numbered figure captions; a narrow right column of tables and marginal notes; each point reads like a chapter.
- **Type:** a sharp text serif with old-style figures for prose, and a technical sans for labels. Avoid the warm-cream-with-terracotta cliché; use cool white paper with ink blue-black.
- **Colour:** paper white, ink, fine hairlines. Sun and Earth colours appear only in the plates. The sky plate is still black, printed like a photographic plate.
- **Signature moment:** a full-width "Plate 1" panorama with a caption block and a small data table beneath, like a printed figure.
- **Risk:** less interactive feel; make controls clear and tactile.

### Concept C: Standing on the Rim (immersive)

- **Idea:** first person. The whole screen is the lunar sky from the chosen point. Controls float as a minimal HUD, and data appears where your eye already is.
- **Audience tilt:** public and educators; mobile-first.
- **Layout:**
  - full-viewport sky (drag left/right to look around the horizon, pinch to change vertical exaggeration);
  - bottom sheet with the scrubber and three key numbers;
  - swipe up for day-by-day, ranking and mission check;
  - Step 1 is a globe-like polar map that zooms into the point ("descend to the surface").
- **Type:** a rounded or humanist sans, generous size, high contrast on black.
- **Colour:** black, starlight white, warm sunlight and earthlight; UI chrome nearly invisible.
- **Signature moment:** the descent from the polar map down to the horizon view, then Earth rising as a thin crescent over the ridge.
- **Risk:** planners need density; Plan mode opens a full data sheet.

### Concept D: Polar Dial (instrument)

- **Idea:** everything on one circular instrument, like an astrolabe or a sundial for the pole.
  - Centre: the landing point.
  - Rings: the terrain horizon (a radial silhouette), the Sun's month path (a ring at its elevation), Earth's small wander loop.
  - Outermost: a 30-day time ring that you rotate to scrub.
- **Layout:** the dial is the hero (desktop left, mobile top); readouts orbit or sit to the right; the ranking shows small dial thumbnails per point (small multiples).
- **Type:** a precise geometric sans with tabular numerals; tiny ring labels.
- **Colour:** dark instrument face, fine ticks, Sun and Earth as the only bright marks.
- **Signature moment:** rotating the time ring and watching the Sun travel around the horizon ring and dip behind the silhouette in exactly the direction where the map shows the ridge.
- **Risk:** elevations of 1–2° are hard to read radially; use a zoom lens or an exaggerated radial scale, labelled.

### Concept E: Flight Plan (planner-first timeline)

- **Idea:** the mission timeline is the product. A Swiss-style, grid-strict planning board where time runs left to right for every point. Sun, Earth, both and battery lanes stack like a Gantt chart, and SAPLE verdicts sit in the margin.
- **Layout:** the left column lists points (Step 1 becomes "add points to the board"); the main area has synchronized time lanes per point; the sky panorama opens as an inspector when you click any hour; the mission check is the default right panel.
- **Type:** a neo-grotesque with strong numerals; very consistent grid; minimal ornament.
- **Colour:** light by default (white board, black type), state colours in lanes, red only for violations.
- **Signature moment:** dragging a mission window across the board and watching rule verdicts flip live in the margin, with the first failing hour pinned on the lane.
- **Risk:** the public may find it dry; Explore mode leads with the sky inspector.

---

## 12. What to ask the design chat to deliver per concept

1. Step 1 (choose where to land): desktop 1440 px and phone 390 px.
2. Step 2 (results) at the default instant (section 9.2): desktop and phone.
3. Step 2 in a different state: Malapert Massif in **Blackout** or Haworth in **Contact only**, to show state changes.
4. Mission check with one rule **violated** (landing Jan 9 at Malapert) and the red timeline marker.
5. Component sheet:
   - colour tokens for both themes (sky always black);
   - type scale;
   - state badges, buttons, segmented controls and sliders;
   - chart styles;
   - glossary pop-up;
   - the "approximate" badge.
6. One paragraph on how the concept serves planners, educators and the public differently.

---

## 13. Glossary (copy for tooltips)

| Term | Short definition |
|---|---|
| Azimuth | Compass direction along the horizon, 0° north, 90° east. |
| Elevation | Angle above the flat horizon; negative means below it. |
| Terrain horizon | The skyline of hills and crater rims around the point; it can sit above or below 0°. |
| Observer height | How high the camera or solar mast is above the ground; higher sees over more terrain. |
| Libration | The Moon's slight rocking as seen from Earth, which makes Earth wander a few degrees in the lunar sky. |
| Lunar day | 29.5 Earth days, the time for the Sun to circle the sky once. |
| Direct-to-Earth (DTE) | Radio contact straight to Earth, without a relay satellite; needs Earth in line of sight. |
| Line of sight | Any part of Earth's disc above the terrain; it does not guarantee that a ground station is pointing at the Moon. |
| Earth phase | How much of Earth looks sunlit from the Moon; it is the opposite of the Moon's phase seen from Earth. |
| Vertical solar array | Panels standing upright and turning to face the low Sun; the standard design at the poles. |
| Permanently shadowed region | Crater floors near the poles that never see sunlight. |
| Feasible landing date | A start time when the Sun stays up for the whole stay. |
| Battery reserve | How many hours of darkness the stored energy can cover. |
| LOLA | NASA's Lunar Orbiter Laser Altimeter; its elevation maps give the terrain horizons. |
| JPL Horizons | NASA's ephemeris service; used to validate Sun and Earth positions. |
| SAPLE | A formal verification engine; it checks mission rules against a process-algebra model of the stay. |
| Invariant / reachable / unreachable | A rule that must hold every hour / a state that must happen at least once / a state that must never happen. |

---

## 14. Data sources (for footers and the About screen)

- **Sun and Earth positions:** astronomy-engine 2.1.19 with the IAU lunar rotation model, light-time, aberration and topocentric parallax. Validated against NASA JPL Horizons to within 0.004°.
- **Terrain:** NASA LRO LOLA polar elevation model `ldem_75s_240m` (240 m per pixel); 720 sight lines to 300 km per point.
- **Artemis candidate region centres:** NASA GSFC archive (Zenodo 10.5281/zenodo.17954508). Regions new in the Oct 2024 list are digitised from NASA's map and marked approximate.
- **Reference points:** Connecting Ridge C1 and the Shackleton rim point from Gläser et al. 2018; IM-2 landing from LROC; LCROSS impact from ESA.
- **Published comparison values:** Gläser et al. 2014/2018, Mazarico et al. 2011, Bussey et al. 2010, Speyerer & Robinson 2013.
