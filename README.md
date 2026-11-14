<p align="center"><img src="public/brand/phoenix-systems-logo.png" width="360" alt="Phoenix Systems"></p>

# Polar Window

A project by **Phoenix Systems**.

**Lunar landing site and date planner** for the NASA Space Apps Challenge 2026 ("CLPS Lunar Mission Browser").

Pick a landing site anywhere on the Moon, and see where the Sun and Earth sit against that site's real terrain horizon, hour by hour: how much solar power a lander gets, when it has a direct radio line to Earth, how long until sunset or Earthset, and whether a mission's rules hold. When a launch slips or a site changes, compare the alternatives in seconds. The rules are written as a process model for **SAPLE**, a formal verification engine.

The Space Apps submission text, demo script and full list of resources are in [docs/submission](docs/submission). The 7-slide pitch deck ships with the site at `/deck/` (source: `apps/web/public/deck/index.html`).

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173. Everything runs in the browser; no server or API keys are needed.

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Engine tests (incl. 216 JPL Horizons reference rows) and an app smoke test |
| `npm run build` | Regenerates design tokens and builds the static site into `dist/` (works from any subpath) |
| `npm run pipeline` | Rebuilds `apps/web/public/data/` from the NASA LOLA elevation model (needs Python 3.9+ with numpy, scipy, Pillow, requests in `.venv`) |
| `npm run fixtures` | Re-fetches the JPL Horizons validation fixtures |
| `npm run nn` | Rebuilds the neural network (the app's AI): generates the training stays with the exact engine, then trains the LSTM with attention (needs PyTorch in `.venv`; about 22 minutes on a laptop CPU) and writes `apps/web/public/data/nn/` |
| `tools/saple/build_saple.sh /path/to/SAPLE` | Builds the `saple` CLI from a SAPLE checkout into `.saple/` (needs Rust and Z3). With it, `npm run dev` runs the real engine on the Check tab's model and shows its verdicts next to the direct calculation and the AI |
| `npm run saple` | Runs SAPLE on one mission and compares it with the direct calculation and the AI. Options: `-- --site <id> --land 2027-01-09T00:00 --stay 6.5 --reserve 50 --go 25 --mast 2`. Writes `tools/saple/models/<name>.spl` and SAPLE's findings |
| `npm run saple:batch` | Runs SAPLE on 1,350 missions at every site and writes `apps/web/public/data/saple/report.json` |

## Deploy

The site is static. `npm run build` writes it to `dist/`, which works from any subpath, so any static host can serve it.

## What it does

1. **Choose where to land.** 54 sites: NASA Artemis candidate regions (Oct 2024 and Aug 2022), CLPS landings and targets (IM-1, IM-2, Blue Ghost 1, IM-3), all six Apollo landings, other nations (Chang'e 3–6, Chandrayaan-3, SLIM, Luna 9) and polar reference points. Pick on a south-pole map or a whole-Moon map, or type any latitude and longitude; the terrain horizon of a custom point is computed in the browser in about a quarter of a second.
2. **See the Sun and Earth against the real skyline.** A 3D view of the terrain with the Sun, Earth and their sight lines in their true directions, and a true-scale sky camera (Earth close-up, Sun close-up, both, or the whole horizon). Countdowns to the next sunset, sunrise, Earthset and Earthrise sit in the top bar.
3. **Judge power and communication.** Sun height, solar power, energy per day, Earth contact hours, the battery through each dark spell, and five mission rules checked for the chosen stay and exported as a SAPLE model. The app's artificial intelligence, an LSTM neural network with attention trained on the catalogued sites, reads the hourly Sun and Earth data for the stay and gives a second opinion on each rule, with its confidence, and shows which hours of the stay it attended to.
4. **Re-plan fast.** The Compare tab puts up to three site-and-date scenarios side by side, shows what happens if the landing slips by −3 to +28 days, ranks other sites within 25–250 km for the same dates, and shows the next 12 months at a glance.
5. **See why small moves matter.** NASA's long-term sunlight, Earth-visibility and permanent-shadow maps on the south-pole map, and a close-up of each site that finds the best spot within 5 km (for example, 4.3 km west of the Malapert Massif point lifts average sunlight from 44% to 58%).
6. **Learn.** A Learn mode explains, with live numbers, why the polar Sun skims the horizon, why a lunar day lasts a month, why there is no twilight, why Earth hangs still and wobbles, and why the far side never sees Earth.

Five tabs: **Mission** (3D view, live sky, power, mission check, landing window), **Sky** (true-scale sky camera and readouts), **Sites** (maps, NASA illumination layers, typed coordinates), **Compare** (scenarios, slips, alternatives, the year) and **Check** (the rules, the battery and the SAPLE model). The state lives in the URL, so **Copy share link** restores the exact view.

## How it works

| Piece | Method | Accuracy / source |
|---|---|---|
| Sun & Earth positions | astronomy-engine 2.1.19 (light-time and aberration corrected), IAU lunar rotation model, topocentric parallax | ≤ 0.0021° elevation and ≤ 0.0018° azimuth vs JPL Horizons over 216 rows (4 sites, 2026–2029); gate 0.01° |
| Terrain horizon | NASA LRO LOLA `ldem_75s_240m` near the south pole and the global `ldem_16` (~1.9 km) elsewhere; 720 sight lines to 300 km; observer heights 0, 2, 5, 10, 20, 50 m | Custom points: 480 m and 960 m polar tiles, global 15° tiles |
| Long-term illumination | NASA LOLA average visibility of the Sun and Earth and permanently shadowed regions (Mazarico et al., PDS LOLA extras), 240 m to 65° S | Ground level, long-term averages |
| Visibility | Any part of the disc above the skyline (Sun r ≈ 0.27°, Earth r ≈ 0.9–1.0°) | Earth visible = line of sight, not a ground-station pass |
| Power | Vertical Sun-tracking array, 30% cells, 1361 W/m² at 1 AU | — |
| Mission rules | SunlitStay, BatterySafe (invariants), DteWindow (reachable), DteCoverage (invariant), Blackout (unreachable) | Each stay is also generated as a SAPLE model (`.spl`, `packages/core/src/spl.ts`). It reads the same inputs as the neural network: for every hour of the stay, the Sun's and the Earth's margin above the skyline, plus battery reserve, contact needed and stay length, and it carries the landing coordinates. Sun, Earth and Lander agents run over a shared clock and the rules are properties, so the AI predicts and SAPLE verifies from the same numbers. The real engine runs locally (`npm run saple`): saple 0.2.0 checked 1,350 missions at all 54 sites and matched the page's direct calculation on every rule and every failure hour (`apps/web/public/data/saple/report.json`). The deployed site has no CLI, so there the verdicts on screen are the page's own |
| Artificial intelligence check | An LSTM neural network with attention, trained in PyTorch (`pipeline/train_lstm.py`) and run in the browser (`packages/core/src/neuralSeq.ts`). It reads the stay hour by hour, seven values per hour (Sun margin, Sun up, Earth margin, Earth up, battery reserve, contact needed, stay length), and outputs the chance each rule holds; one attention head per rule shows which hours weighed most. Trained on 230,850 stays at 45 sites, 2026–2028, labelled by the direct calculation | All five rules right on 9 sites never seen: 99.79%. On 2029, a year never seen: 99.76%. A prediction, not a proof |

Data window: hourly steps for ranges up to 400 days. The default view is January 2027.

## Project layout

```
apps/web/                 the app: React + three.js (src/) and its static files (public/, incl. data/ and the deck)
packages/core/            the engine: ephemeris, horizon masks, analysis, mission rules, SPL generation, the LSTM forward pass
packages/core/fixtures/   JPL Horizons reference values and the LSTM parity fixture
packages/design-system/   design tokens, components and examples; build_tokens.cjs writes apps/web/src/styles/tokens.css
pipeline/                 Python: LOLA download/reader, horizon masks, map relief, tiles, Horizons fixtures, LSTM training
tools/saple/              runs the SAPLE CLI on mission models; models/ holds example models and findings
tools/nn/                 builds the LSTM training set with the exact engine
tools/art/                builds the battery, dish and texture art from design/assets
design/                   brand, source artwork and early mockups
docs/                     submission text, design brief and critique
```

## Limitations

- Region coordinates are bounding-box centres (NASA GSFC archive, Zenodo 10.5281/zenodo.17954508), not the best-lit spot in each region. Regions new in the Oct 2024 list are digitised from NASA's map and marked approximate.
- Away from the south pole the global terrain has ~1.9 km pixels, so nearby hills and crater walls are smoothed; horizons there are approximate.
- 240 m terrain under-resolves narrow ridge crests. Published peak values (for example 88% at Connecting Ridge, Gläser et al. 2018) use 20 m terrain and multi-year averages.
- On the deployed site the SAPLE verdicts are the page's own direct calculation, labelled "preview"; the real engine runs only on a local server with the `saple` CLI. SAPLE's walk is bounded at 100 actions per path; the longest stay in the batch needed 13 Sun/Earth events, far inside that bound.

## Credits

NASA LRO LOLA team (elevation data, public domain), NASA Earth Observatory Blue Marble: Next Generation by Reto Stöckli and Black Marble 2016 (Earth day and night imagery, public domain), NASA Visible Earth (cloud cover, public domain), NASA SDO and the HMI science team (Sun image, public domain), NASA JPL Horizons (validation), astronomy-engine by Don Cross (MIT), NASA GSFC/PGDA Artemis region archive, Gläser et al. 2018 (reference points). No NASA logos are used. Code: MIT.

To rebuild the Earth and Sun textures in `apps/web/public/textures`, download the four NASA images listed at the top of `tools/art/build_textures.py` into `design/assets/nasa-src`, then run `.venv/bin/python -I tools/art/build_textures.py design/assets/nasa-src apps/web/public/textures`.
