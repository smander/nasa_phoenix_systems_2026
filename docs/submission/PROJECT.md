# Polar Window — Space Apps 2026 project page

Text for the NASA Space Apps submission form. Challenge: **CLPS Lunar Mission Browser**. Team: **Phoenix Systems**.

## High-level summary

Polar Window is a web app that lets mission planners, teachers and the public compare lunar landing sites and dates in seconds. Pick a site anywhere on the Moon, or type its coordinates, and see the Sun and Earth against that site's real terrain horizon: how much solar power a lander gets, when it can talk directly to Earth, and how long until sunset or Earthset. When a launch slips, one tab shows what each day of delay does and which nearby sites would do better on the same dates. NASA laser-altimeter terrain and illumination maps drive every number, and the Sun and Earth positions match JPL Horizons to within 0.002°.

## Demo

- Slides (7): `/deck/` on the app. Video script (30 seconds, English subtitles): [DEMO_SCRIPT.md](DEMO_SCRIPT.md).
- Code: https://github.com/smander/nasa_phoenix_systems_2026

## Project details

### What it does

| Challenge objective | How Polar Window meets it |
|---|---|
| Interactive site selection and comparison | 54 curated sites: NASA Artemis III candidate regions, CLPS landings and targets (IM-1, IM-2, Blue Ghost 1, IM-3), all six Apollo landings, and other nations (Chang'e 3–6, Chandrayaan-3, SLIM, Luna 9). Pick on a south-pole map or a whole-Moon map, or type any latitude and longitude. Up to three site-and-date scenarios side by side. |
| Date and time flexibility | Any period up to two years, a landing-day picker, and a 12-month view of sunlight, Earth visibility and feasible landing days. |
| Sun and Earth position visualization | A 3D view of the real terrain with the Sun, Earth and their sight lines in their true directions, and a true-scale sky camera. Countdowns to the next sunset, sunrise, Earthset and Earthrise. |
| Power and communication assessment | Solar elevation, power for a vertical Sun-tracking array, energy per day, Earth contact hours, the battery through each dark spell, and five mission rules checked for the chosen stay. An artificial-intelligence model (an LSTM neural network) gives a second opinion on each rule from the Sun and Earth data. |
| Multiple visualization approaches | 3D terrain, a sky camera, polar and whole-Moon maps, NASA illumination layers, timelines and month bars. |
| Temporal dynamics | Play the period; drag the timeline; every view animates the Sun, Earth and Earth's phase. |
| Rapid re-planning when schedules change | "If the landing slips" re-checks the stay for −3 to +28 days and names the first slip that breaks a rule; "Other sites, same dates" ranks every site within 25–250 km. |
| Why small changes have big effects | NASA's long-term sunlight, Earth-visibility and permanent-shadow maps, and a close-up that finds the best spot within 5 km (4.3 km west of the Malapert Massif point lifts average sunlight from 44% to 58%). |
| Accessibility across skill levels | A Learn mode with short lessons and live numbers on every tab, and a Moon-versus-Earth table. |

### How it works

- **Sun and Earth positions:** astronomy-engine (light-time and aberration corrected), the IAU lunar rotation model and topocentric parallax. Validated against 216 JPL Horizons rows at four sites over 2026–2029: at most 0.0021° in elevation and 0.0018° in azimuth.
- **Terrain horizon:** 720 sight lines to 300 km over NASA LRO LOLA elevation models (240 m near the south pole, ~1.9 km globally), with the Moon's curvature and no atmospheric refraction, at observer heights from 0 to 50 m.
- **Visibility:** any part of the Sun's or Earth's disc above the skyline. Earth in view means line of sight, not a scheduled ground-station pass.
- **Power:** a vertical array that turns to face the Sun, 30% efficient cells, 1361 W/m² at 1 AU.
- **Mission rules:** sunlight all stay, the battery never runs out, Earth comes up, enough Earth contact, never both lost. Each stay is also written as a model for SAPLE, our formal-verification engine (process algebra with the Z3 solver): Sun, Earth and Lander agents over a shared clock, with the five rules as properties. The model reads the same hourly inputs as the neural network, the Sun's and the Earth's margin above the skyline for every hour of the stay, so the AI predicts and SAPLE verifies from the same numbers. We ran the real engine on 1,350 missions at all 54 sites; it matched the page's direct calculation on every rule and every failure hour. On a machine with the SAPLE command-line tool the Check tab runs it live; the public site shows the page's own verdicts, labelled as a preview.
- **Artificial intelligence:** an LSTM neural network with attention, run in the browser, reads the stay hour by hour and predicts whether each rule holds, with a confidence. Each hour has seven values: Sun margin above the skyline, Sun up, Earth margin, Earth up, battery reserve, Earth contact needed and stay length. Its attention shows which hours weighed most in each answer. We trained it in PyTorch on 230,850 stays at 45 catalogued sites over 2026–2028, labelled by the direct calculation. On 9 sites it never saw, all five rules are right for 99.79% of stays; on 2029, a year it never saw, 99.76%. So each mission is judged three ways: the AI predicts, the direct calculation calculates exactly, and SAPLE verifies formally. When they differ, the app says so and trusts the direct calculation.
- **Everything runs in the browser.** A Python pipeline turns the NASA files into small data files once; the site is static.

### Benefits

Teams can answer "what if we land three days later?" or "is the next ridge better?" in seconds instead of stitching together Quickmap, Moon Trek and Horizons output. Teachers and the public see why the Moon's south pole is so hard: a Sun that skims the horizon, nights that last days, and Earth hiding behind a ridge.

### Tools and languages

TypeScript, React, three.js, Vite and Vitest in the browser; Python (NumPy, SciPy, Pillow) for the data pipeline and PyTorch for training the LSTM.

## NASA data

- LRO LOLA polar elevation model `ldem_75s_240m` and global model `ldem_16` (PDS Geosciences Node).
- LRO LOLA average visibility of the Sun and of Earth, and permanently shadowed regions (`avgvisib_65s_240m_201608`, `_earth`, `lpsr_65s_240m_201608`; Mazarico et al.).
- JPL Horizons, for validation.
- Artemis III candidate landing regions (NASA, 2022 and 2024) and CLPS landing sites.
- NASA Earth Observatory Blue Marble and Black Marble, NASA Visible Earth cloud cover, and an SDO/HMI image of the Sun, for the 3D bodies.

Full list with links: [RESOURCES.md](RESOURCES.md).

## Use of artificial intelligence

The Space Apps rules allow AI tools and require teams to say how they were used. We used an AI coding assistant to help write and review code, process the NASA datasets and draft documentation. The team set the design, checked every result, and chose the data. All scientific numbers come from NASA data and the open-source astronomy-engine library, and the ephemeris is validated against JPL Horizons.

The product itself also contains artificial intelligence: the mission neural network described above (an LSTM with attention). It is our own small model, trained on data computed from NASA terrain and ephemerides. It is not a generative model and uses no external AI service.

The Phoenix Systems logo and emblem and the battery and radio-dish illustrations were generated with Google Gemini, then cut, layered and resized with our scripts (`tools/art/`). Each carries a visible "AI-generated · Gemini" watermark and a note in its file metadata; where an image is too small for a readable watermark, the app labels it on screen and every slide of the deck says so. No generated image contains NASA logos, flags or mission identifiers. All other imagery is NASA's own. No audio or video was generated.

## Team

Phoenix Systems — Oleksandr Mostovyi.
