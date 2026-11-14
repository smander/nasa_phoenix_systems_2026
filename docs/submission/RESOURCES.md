# Resources used

Space Apps asks teams to list every piece of code, data, text and image they used, including open and free material.

## NASA data

| Resource | Used for | Link |
|---|---|---|
| LRO LOLA GDR `ldem_75s_240m` (240 m, south polar stereographic) | Terrain near the south pole: horizons, 3D view, relief map | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ |
| LRO LOLA GDR `ldem_16` (16 px/deg, global) | Terrain everywhere else: horizons, 3D view, whole-Moon map | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ |
| LOLA average visibility of the Sun and Earth, permanently shadowed regions (`avgvisib_65s_240m_201608`, `avgvisib_65s_240m_201608_earth`, `lpsr_65s_240m_201608`; Mazarico et al.) | Illumination layers and the "best spot nearby" close-up | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/ |
| JPL Horizons | Validating the Sun and Earth positions (216 rows) | https://ssd.jpl.nasa.gov/horizons/ |
| Artemis III candidate landing regions (2022, 2024) | Site catalogue | https://zenodo.org/records/17954508 |
| CLPS landing sites | Site catalogue | https://www.nasa.gov/commercial-lunar-payload-services/clps-landing-sites/ |
| NASA Earth Observatory Blue Marble: Next Generation (January) and Black Marble 2016 | Earth's day side and city lights | https://visibleearth.nasa.gov/ |
| NASA Visible Earth cloud cover | Earth's clouds | https://visibleearth.nasa.gov/images/57747 |
| NASA SDO / HMI intensitygram | The Sun's disc | https://sdo.gsfc.nasa.gov/ |
| NASA LRO image of the Chang'e 6 site | Chang'e 6 coordinates | https://www.nasa.gov/centers-and-facilities/goddard/nasas-lro-spots-chinas-change-6-spacecraft-on-lunar-far-side |

## Other data and references

- Lander coordinates (Apollo, Chang'e 3–5, Chandrayaan-3, SLIM, Luna 9, Blue Ghost 1): https://en.wikipedia.org/wiki/List_of_artificial_objects_on_the_Moon, from LROC positions.
- IM-1 Odysseus coordinates: EGU 2025 abstract EGU25-20315, https://meetingorganizer.copernicus.org/EGU25/EGU25-20315.html.
- Gläser et al. (2018) and other published illumination values for reference points (listed per site in the app).
- Natural Earth land outlines via world-atlas 2.0.2 (fallback Earth map).

## Open-source code

| Library | Version | Licence |
|---|---|---|
| astronomy-engine (Don Cross) | 2.1.19 | MIT |
| three.js | 0.160 | MIT |
| React, React DOM | 18.3.1 | MIT |
| zustand | 4.5.7 | MIT |
| topojson-client, world-atlas | 3.1.0, 2.0.2 | ISC |
| Vite, Vitest, TypeScript | 5.4.21, 2.1.9, 5.5.4 | MIT, MIT, Apache-2.0 |
| NumPy, SciPy, Pillow, requests (data pipeline) | 2.0.2, 1.13.1, 11.3.0, 2.32.5 | BSD, BSD, MIT-CMU, Apache-2.0 |
| PyTorch (training the LSTM; not shipped with the app) | 2.8.0 | BSD-3-Clause |

## Images and artwork

- Phoenix Systems logo, battery and radio-dish illustrations: supplied by the team. [Team to confirm how they were made.]
- All other imagery is NASA's, listed above.

## Tools

- An AI coding assistant helped write and review code, process data and draft text (see "Use of artificial intelligence" in [PROJECT.md](PROJECT.md)).
- SAPLE 0.2.0, the team's formal-verification engine, for the mission-rule model (`tools/saple/models/`, `npm run saple`). It links the Z3 solver (Microsoft Research, MIT licence).
