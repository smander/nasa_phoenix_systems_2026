# Design Task D1 — Mockups for Earth, Moon, Mission and every changing property

**Status:** in progress (mockups v2 in `design/mockups/`; v1 critique in `docs/design/CRITIQUE_v1.md`)
**Owner:** design
**Depends on:** design spec `docs/superpowers/specs/2026-10-11-polar-window-design.md` (§3, §6, §9)
**Feeds:** implementation plan Lanes D and E (UI shell and charts), and the SAPLE model task D2

## 1. Why this task comes first

The challenge is judged on how quickly a planner, a teacher or a member of the public can see where the Sun and the Earth sit relative to a site's horizon, and what that means for power and direct-to-Earth (DTE) radio contact. Before any UI code is written, we fix how the three subjects look, which properties change over time, and which control changes each one. The mockups use real data, not placeholder curves, so the design is tested against the geometry it must show.

## 2. The three subjects

| Subject | What the user must see | Hero view |
|---|---|---|
| **Earth** | Where Earth is in the lunar sky, how it bobs up and down the horizon with libration over a ~27-day cycle, whether it clears the terrain, how big it looks | Mission Sky panorama, Earth-in-the-sky libration plot |
| **Moon** (the site) | The site's terrain horizon in every direction, its elevation, where it is on the south pole, how its horizon compares with other sites | Mission Sky panorama, South Pole map |
| **Mission** | For a chosen landing date and stay length: is there sunlight for the whole stay, how much Earth contact, the longest blackout, and whether the mission rules hold | Mission planner with the SAPLE property panel |

The Sun is the fourth actor that ties them together: it circles the horizon once per lunar day (29.5 Earth days) and never climbs more than about 1.5° above the horizon at the pole.

## 3. Every property that changes

| Property | Units / typical range at the south pole | Changes with | Shown in | Control |
|---|---|---|---|---|
| Time | UTC, hourly | user | all views | time scrubber, play, date range |
| Sun azimuth | 0–360°, one full turn per 29.53 d | time, site | panorama, readout | — |
| Sun elevation | about −1.6 to +1.6° at the pole; up to ~5° at 85°S | time, site, season (346.6 d) | panorama, timeline, readout | — |
| Sun angular radius | 0.262–0.271° | Earth–Sun distance (season) | panorama disc | — |
| Earth azimuth | wanders ±8° about the sub-Earth meridian | time (libration in longitude, 27.55 d), site | panorama, readout | — |
| Earth elevation | about −7 to +7° at the pole | time (libration in latitude, 27.21 d), site | panorama, Earth chart, readout | — |
| Earth angular radius | 0.90–0.99° | Earth–Moon distance | panorama disc, readout | — |
| Earth distance | 356,000–406,000 km | time | readout | — |
| Optical libration | longitude ±8.2°, latitude ±6.9° | time | Earth-in-the-sky plot | — |
| Terrain horizon | −5 to +14° depending on direction | site, mast height | panorama silhouette | site picker, map click, mast slider |
| Site elevation | −0.2 to +6.4 km above the 1737.4 km sphere | site | site card, map | site picker |
| Sun visible above terrain | yes / no (any part of disc) | time, site, mast, threshold | ribbon, readout, state badge | disc threshold (advanced) |
| Earth visible above terrain | yes / no (any part of disc, above minimum elevation) | time, site, mast, threshold, min elevation | ribbon, readout | min Earth elevation (advanced) |
| Combined state | none / Sun only / Earth only / both | the two above | ribbon colour, badge | — |
| Solar power density | 0–~420 W/m² electrical (vertical tracking array, 30% cells) | Sun elevation, visibility, distance, panel model | readout, scorecard | panel model, efficiency (advanced) |
| Sun %, Earth %, both % | 0–100% over the range | site, range, mast, thresholds | scorecard | — |
| Longest darkness, longest Earth gap | hours to days | site, range, mast | scorecard, mission panel | — |
| Mission window | start + 6.5 / 10 / 14 days | user | mission planner, ribbon overlay | mission start, length chips |
| Battery reserve | hours of darkness the stored energy covers | user, darkness in the window | mission planner, property panel | reserve slider |
| Earth coverage during stay | % of the stay with line of sight to Earth | window, site | mission planner | "go" threshold (default 25%) |
| Property verdicts | holds / violated (with first violating time) | everything above | SAPLE panel | — |

## 4. Controls the challenge requires

| Challenge clause | Control | Default |
|---|---|---|
| "compare landing sites" | site picker with grouped presets (Artemis candidate regions 2024 / 2022, reference sites), custom lat/lon, click on map; up to 8 at once | Malapert Massif, Mons Mouton, Connecting Ridge C1 |
| "and dates" | date range presets (next lunar day, 90 days, year, custom); time scrubber with play | next lunar day |
| "quickly" | everything recomputes in the browser in under a second; shareable link | — |
| "visualizing Sun and Earth positions relative to the horizon" | panorama with terrain silhouette, Sun and Earth discs to scale, month-long tracks | — |
| "assess power generation potential" | panel model, efficiency, mast height | vertical tracking array, 30%, 2 m |
| "direct-to-Earth communication windows" | minimum Earth elevation, disc threshold, go threshold | 0°, any part, 25% |
| "mission planners" | Planner mode: advanced settings open, mission planner, start-date strip, CSV export | — |
| "educators" | Educator mode: glossary popovers, Earth-in-the-sky explainer | — |
| "the public" | Explorer mode: plain-language captions, famous sites first | default mode |

## 5. User flow (v2, agreed 2026-10-12)

The product is a two-step flow, not a set of separate screens:

1. **Choose where to land.** South pole map plus a list of candidate points, each with its month bar and Sun/Earth percentages. Click a point on the map or in the list. (Product: any clicked point is analysed from the terrain data; the mockup snaps to the nearest of the six analysed sites.)
2. **Results for that point.** Everything the challenge asks for, computed for the chosen point:
   - the lunar sky hero (terrain horizon, Sun and Earth with Earth's real phase) with a month scrubber;
   - Sun, Earth, energy and observer-height readouts;
   - energy per day (kWh/m², vertical array) and Earth-contact hours per day;
   - Earth's monthly wander (libration);
   - how the point ranks against other sites;
   - mission check: landing-date strip, stay window, battery, rule verdicts and the generated SAPLE model (Plan mode).

Audience modes change disclosure: Explore hides the mission check, Teach adds plain-language explanations, Plan shows everything.

## 6. Screens to mock (v1 list, superseded by section 5)

| Id | Screen | Must show | Acceptance |
|---|---|---|---|
| M1 | Mission Sky | panorama for one site at one instant: terrain silhouette at mast height, Sun and Earth discs, month-long tracks with visible/hidden styling; readout cards for Sun, Earth, Site & mission | a viewer can say in 5 seconds whether Sun and Earth are up and why not |
| M2 | Earth in the lunar sky | libration path over the month, Earth elevation vs. time with the terrain line at Earth's azimuth | a teacher can explain why Earth sets for about two weeks |
| M3 | South Pole map | relief map, site markers, graticule, click to pick a site | sites are findable; relief is labelled as shading, not lighting |
| M4 | Compare sites | availability ribbon (Sun lane, Earth lane, both band) for 6 sites, scorecard with bands, sortable | the best site for the month is obvious at a glance |
| M5 | Mission planner + SAPLE | start-date strip, mission window lanes, battery reserve curve, property verdicts, generated SPL model | a planner sees which mission rules hold for a start date, and the model that encodes them |
| M6 | Property and control inventory | sections 3 and 4 of this document as reference tables | every changing property maps to a view and a control |

## 7. Visual direction

- Dark-first "lunar night console" palette with a light theme of equal care. Neutrals lean slightly blue, like regolith under earthshine.
- Colour encodes the actors consistently everywhere: **Sun amber**, **Earth blue**, **both teal-green**, **neither grey with hatching**. Each colour is paired with an icon or text label, so nothing depends on colour alone.
- Type (v2): Archivo with its width axis (expanded for headings and big numerals, normal for text) and IBM Plex Mono for timestamps, coordinates and code. This replaces the Inter / JetBrains Mono pairing in spec §9.3; the spec will be updated when the mockups are approved.
- The lunar sky is always black in both themes, because that is what the sky looks like from the Moon. The rest of the page follows the light or dark theme.
- Charts are drawn to scale: panorama axes in degrees, discs at true angular size on the vertical scale, ribbons on a true time axis.

## 8. SAPLE layer (what makes this project unique)

Every other tool answers "where is the Sun?". Polar Window also answers "**do my mission rules hold?**" with a formal model.

- The ephemeris and LOLA horizon produce, for a site and mission window, an exact sequence of events: Sun rise/set, Earth rise/set, and the hours between them.
- That sequence is compiled into an SPL process: a `Sky` agent whose behaviour is the event trace (`sunSet() . tick(38) . earthRise() . …`), running in parallel with a `Lander` agent (downlink only when Earth is up) over a shared `Mission` schema (Sun/Earth state, battery reserve in hours).
- Mission rules become SAPLE properties: `invariant` sunlit stay, `invariant` battery reserve ≥ 0, `reachable` DTE window, `unreachable` blackout (Sun and Earth both down).
- SAPLE (`saple parse`, `saple analyze`) verifies them and returns counterexample traces, which the UI shows as the first violating time on the ribbon.

The M5 mockup shows this panel with verdicts computed in the page from the same data, labelled as a preview. Running real SAPLE needs the CLI, which is not installed on this machine yet.

**Follow-up task D2:** write `model/polar_window.sbl` (template + generator), install the `saple` CLI, confirm `saple parse` and `saple analyze --verbose` on generated models for the six mockup sites, and record which properties SAPLE proves or refutes against the in-page preview.

## 9. Data used in the mockups

- Sun and Earth positions: astronomy-engine 2.1.19 with the IAU lunar rotation model and topocentric parallax; validated against JPL Horizons to ≤ 0.004°.
- Terrain horizons: NASA LRO LOLA `ldem_75s_240m` (240 m/pixel), 720 azimuths, rays to 300 km, observer at ground + mast height.
- Window: 2027-01-01 00:00 to 2027-01-31 00:00 UTC, hourly.
- Six sites: Malapert Massif, Connecting Ridge C1, Shackleton rim, Mons Mouton, Haworth, de Gerlache Rim 2. Region sites use bounding-box midpoints, not the best-lit point within the region.
- Scripts: `design/mockups/scripts/terrain.py` and `design/mockups/scripts/tracks.cjs`; build with `node design/mockups/build.cjs`.

## 10. Open questions for review

1. Which mission rules should SAPLE verify beyond the five in M5? Thermal limits, rover traverse windows and relay coverage would each add a property.
2. Should the battery reserve be in hours of darkness (as mocked) or in watt-hours with a load profile?
3. Is the dark-first console direction right for a public audience, or should Explorer mode default to the light theme?
