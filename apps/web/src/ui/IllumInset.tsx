// "Why small moves matter": NASA's long-term average sunlight or Earth visibility within 18 km of the selected point
// (240 m pixels), the best spot within a few kilometres, and how much it gains.
import { useEffect, useRef, useState } from 'react';
import { bestNearby, illumAt, loadIllumGrid, loadInset } from '@core/illum';
import type { IllumInset as Inset, Nearby } from '@core/illum';
import type { SiteDef } from '@core/types';

const RAMPS: Record<'sun' | 'earth', [number, [number, number, number]][]> = {
  sun: [[0, [11, 15, 26]], [0.3, [90, 58, 18]], [0.7, [255, 181, 71]], [1, [255, 242, 200]]],
  earth: [[0, [11, 15, 26]], [0.3, [18, 52, 94]], [0.7, [79, 168, 255]], [1, [221, 238, 255]]],
};
function ramp(v: number, stops: [number, [number, number, number]][]): [number, number, number] {
  for (let k = 1; k < stops.length; k++) {
    if (v <= stops[k][0]) {
      const [a, ca] = stops[k - 1], [b, cb] = stops[k], f = (v - a) / (b - a);
      return [0, 1, 2].map((i) => ca[i] + (cb[i] - ca[i]) * f) as [number, number, number];
    }
  }
  return stops[stops.length - 1][1];
}

export const RADIUS_KM = 5;

export function useBestNearby(site: SiteDef | undefined): { inset: Inset | null; best: Nearby | null; loading: boolean } {
  const [st, set] = useState<{ id: string; inset: Inset | null } | null>(null);
  useEffect(() => {
    if (!site?.illumInset) return;
    let alive = true;
    loadInset(site.illumInset, site.lat, site.lonE).then((inset) => { if (alive) set({ id: site.id, inset }); });
    return () => { alive = false; };
  }, [site?.id, site?.illumInset]); // eslint-disable-line react-hooks/exhaustive-deps
  const inset = st && site && st.id === site.id ? st.inset : null;
  return { inset, best: inset ? bestNearby(inset, RADIUS_KM) : null, loading: !!site?.illumInset && !inset };
}

export function IllumInset({ site, layer, best, inset }: { site: SiteDef; layer: 'sun' | 'earth'; best: Nearby | null; inset: Inset | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [gridVal, setGridVal] = useState<{ id: string; v: ReturnType<typeof illumAt> } | null>(null);
  useEffect(() => {
    if (site.illumInset) return;
    let alive = true;
    loadIllumGrid().then((g) => { if (alive) setGridVal({ id: site.id, v: g ? illumAt(g, site.lat, site.lonE) : null }); });
    return () => { alive = false; };
  }, [site.id, site.illumInset, site.lat, site.lonE]);
  useEffect(() => {
    const cv = canvas.current; if (!cv || !inset) return;
    const { n, data } = inset, off = layer === 'sun' ? 0 : n * n, ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(n, n);
    for (let k = 0; k < n * n; k++) { const [r, g, b] = ramp(data[off + k] / 100, RAMPS[layer]); img.data.set([r, g, b, 255], k * 4); }
    ctx.putImageData(img, 0, 0);
  }, [inset, layer]);

  if (!inset) {
    const v = gridVal && gridVal.id === site.id ? gridVal.v : null;
    if (site.lat > -65 && !v) return <p className="sub">No NASA illumination map here: the long-term maps cover 65° S to the pole.</p>;
    if (!v) return <p className="sub">Reading NASA's illumination map…</p>;
    return <p className="sub">NASA long-term average here (1 km grid, ground level): sunlight <b style={{ color: '#FFB547' }}>{v.sunPct}%</b>, Earth in view <b style={{ color: '#4FA8FF' }}>{v.earthPct}%</b>{v.psr ? ', inside a permanently shadowed region' : ''}. Close-ups at 240 m are available for the catalogued sites.</p>;
  }
  const n = inset.n, half = inset.halfWidthM, toPct = (m: number) => 50 + (m / half) * 50;
  const here = best?.here;
  const bx = best ? toPct(best.dxM) : 50, by = best ? 100 - toPct(best.dyM) : 50;
  return (
    <div className="inset">
      <div className="inset-map">
        <canvas ref={canvas} width={n} height={n} aria-label={`NASA average ${layer === 'sun' ? 'sunlight' : 'Earth visibility'} within ${half / 1000} km of ${site.name}`} role="img" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <circle cx={50} cy={50} r={(RADIUS_KM * 1000 / half) * 50} fill="none" stroke="#fff" strokeOpacity={0.6} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          <circle cx={50} cy={50} r={1.6} fill="#fff" stroke="#05070B" strokeWidth={0.6} />
          {best && best.km > 0.1 && <circle cx={bx} cy={by} r={1.8} fill="#4FDDB4" stroke="#05070B" strokeWidth={0.6} />}
        </svg>
        <span className="inset-scale">{half * 2 / 1000} km across · up = toward 0° longitude, as on the map</span>
      </div>
      {here && best && <div className="inset-read">
        <p className="slip-say">{best.km < 0.15 ? `This point is already the best spot within ${RADIUS_KM} km.` : `Moving ${best.km.toFixed(1)} km ${best.bearing} changes average sunlight from ${here.sunPct}% to ${best.sunPct}% and Earth in view from ${here.earthPct}% to ${best.earthPct}%.`}</p>
        <div className="cmp-stats">
          <div><div className="lbl">Here · sunlight</div><div className="val num" style={{ fontSize: 18, color: '#FFB547' }}>{here.sunPct}%</div></div>
          <div><div className="lbl">Here · Earth in view</div><div className="val num" style={{ fontSize: 18, color: '#4FA8FF' }}>{here.earthPct}%</div></div>
          <div><div className="lbl">Best within {RADIUS_KM} km · sunlight</div><div className="val num" style={{ fontSize: 18, color: '#FFB547' }}>{best.sunPct}%</div></div>
          <div><div className="lbl">Best within {RADIUS_KM} km · Earth</div><div className="val num" style={{ fontSize: 18, color: '#4FA8FF' }}>{best.earthPct}%</div></div>
        </div>
        <p className="sub">NASA LOLA long-term averages at ground level (Mazarico et al.), 240 m pixels. The dashed circle is {RADIUS_KM} km; the green dot is the best spot, weighing sunlight and Earth equally.</p>
      </div>}
    </div>
  );
}
