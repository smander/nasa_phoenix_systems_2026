// The centre of the HUD: a starfield and Earth at its real phase (stage coordinates, 1600 x 1180), and the
// real south-pole terrain in 3D (Terrain3D) in the space the design gives the scene.
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import type { Analysis } from '../../state/useAnalysis';
import { SkyHero } from '../../ds/SkyHero';
import { timeAt } from '@core/analysis';
import { fmtClock, fmtDate, rangeTicks } from '@core/format';

const Terrain3D = lazy(() => import('./Terrain3D').then((m) => ({ default: m.Terrain3D })));

function seeded(n: number, seed0: number) {
  let s = seed0; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  return Array.from({ length: n }, () => { const y = rnd() * 560; return { x: rnd() * 1600, y, r: rnd() * 1.1 + 0.3, o: 0.25 + 0.6 * (1 - y / 560), d: (rnd() * 3).toFixed(2) }; });
}

export function Scene({ a, compact }: { a: Analysis; compact?: boolean }) {
  return (
    <>
      {!compact && <SceneBackground a={a} />}
      <TerrainBox a={a} compact={compact} />
    </>
  );
}

/** Switch between the 3D overview (bodies enlarged, directions true) and the lander's true-scale view of the sky. */
function ViewSwitch({ a }: { a: Analysis }) {
  const s = a.store;
  return (
    <div className="scene-switch opt" role="group" aria-label="Scene view">
      <button type="button" aria-pressed={s.sceneView === '3d'} onClick={() => s.setSceneView('3d')} title="The terrain from above; the Sun and Earth in their real directions, drawn larger">3D overview</button>
      <button type="button" aria-pressed={s.sceneView === 'sky'} onClick={() => s.setSceneView('sky')} title="What a camera on the lander sees: the Sun and Earth at true size against the real skyline">Lander’s view</button>
    </div>
  );
}

function LanderView({ a, compact }: { a: Analysis; compact?: boolean }) {
  const s = a.store, site = a.site!, mission = a.mission!;
  return (
    <div className="lander-view">
      <SkyHero siteName={site.name} grid={a.grid} tracks={a.tracks!} ev={a.ev!} mask={a.mask!} t={a.t} onTime={(t) => { s.setPlaying(false); s.setT(t); }}
        playing={s.playing} onPlay={() => s.setPlaying(!s.playing)} window={[mission.mc.startIndex / (a.grid.n - 1), mission.mc.endIndex / (a.grid.n - 1)]}
        ticks={rangeTicks(s.fromMs, timeAt(a.grid, a.grid.n - 1))} dateLabel={fmtDate(a.nowMs)} timeLabel={fmtClock(a.nowMs)} observerM={s.settings.mastM}
        siteLat={site.lat} siteLon={site.lonE} scrubber={false} hideHead frame={compact ? undefined : { w: 600, h: 500 }} />
    </div>
  );
}

function TerrainBox({ a, compact }: { a: Analysis; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(compact ? 360 : 640);
  useEffect(() => {
    if (!compact || !ref.current) return;
    const el = ref.current, f = () => setW(el.clientWidth);
    f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect();
  }, [compact]);
  return (
    <div ref={ref} className="t3-box">
      <ViewSwitch a={a} />
      {a.store.sceneView === 'sky' ? <LanderView a={a} compact={compact} /> : <Suspense fallback={<div className="sub" style={{ height: compact ? Math.round(w * 0.9) : 560, display: 'grid', placeItems: 'center' }}>Loading the 3D terrain…</div>}>
        <Terrain3D a={a} width={w} height={compact ? Math.round(w * 1.05) : 640} />
      </Suspense>}
    </div>
  );
}

function SceneBackground(_: { a: Analysis }) {
  const stars = useMemo(() => seeded(170, 11), []);
  return (
    <svg className="scene" viewBox="0 0 1600 1180" aria-hidden="true">
      <g>{stars.map((p, k) => <circle key={k} className="star" cx={p.x} cy={p.y} r={p.r} fill="#fff" opacity={p.o} style={{ animationDelay: p.d + 's' }} />)}</g>
    </svg>
  );
}
