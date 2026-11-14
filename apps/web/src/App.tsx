import { useEffect } from 'react';
import { useStore, startUrlSync } from './state/store';
import { useAnalysis } from './state/useAnalysis';
import { HudApp } from './views/hud/HudApp';

export function App() {
  const a = useAnalysis();
  const s = a.store;
  useEffect(() => { s.load(); return startUrlSync(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.body.setAttribute('data-mode', s.mode); }, [s.mode]);
  // Play: one month in about 12 s (design token dur-month), scaled to the range length.
  useEffect(() => {
    if (!s.playing) return;
    let raf = 0, last = performance.now();
    // 12 simulated hours per second: a month plays in about a minute, smooth enough to watch Earth turn
    const perMs = (12 / (a.grid.stepMin / 60)) / 1000;
    const step = (now: number) => {
      const dt = now - last; last = now;
      const st = useStore.getState();
      st.setT((st.t + dt * perMs) % a.grid.n);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [s.playing, a.grid.n]);

  return <HudApp a={a} />;
}
