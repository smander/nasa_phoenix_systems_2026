# SkyHero

The lunar sky panorama with its own time scrubber — the hero of Step 2 and the system's signature moment.

**Signature moment.** Drag the timeline (or press play): the Sun slides along its month track, its glow fades as the disc sinks behind the ridge, and the badge, headline and sub-line flip together from *Power and contact* to *Contact only* (`dur-flip`, `ease-out`).

**Consumer provides** `time` (hour index in the range), `window` ([from,to] fractions of the range for the mission outline, Plan mode), `exaggeration` (default 5), `height`, `autoplay`, `scrubber` (false to hide). The bundled model is an illustrative Malapert Massif, Jan 2027; a real view feeds computed series and sets `illustrative={false}`.

**Rules**
- The sky is `sky-bg` in every theme. Never a blue sky.
- Terrain (`terrain`) occludes the discs; month tracks are dashed where hidden.
- Keep the `elevation ×N` note visible. Compass labels along the bottom; x is centred on Earth's direction.
- Keyboard: the timeline is a slider — ←/→ one hour, Shift+←/→ one day, Space plays.
- Motion: one month plays in `dur-month`; stars twinkle at `dur-twinkle`. Reduced motion: no autoplay, no twinkle, flips are instant.
