// South pole map: LOLA relief (terrain shape, not lighting), 0 deg longitude up, preset markers, the current
// Sun and Earth directions, and click-anywhere to analyse a custom point.
import { useEffect, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { latLonToXY, xyToLatLon } from '@core/horizon';
import type { SiteDef } from '@core/types';
import type { MapLayer } from '@core/illum';

interface Props {
  sites: SiteDef[];
  highlight: Set<string>;
  selectedId: string;
  onSelect: (id: string) => void;
  onPick?: (lat: number, lonE: number) => void;
  sunAz?: number;     // azimuth of the Sun from the selected point (deg)
  earthAz?: number;   // azimuth of Earth from the selected point (deg)
  size?: number;
  variant?: 'panel' | 'hud';
  layer?: MapLayer;   // NASA illumination overlay (relief alone when 'relief')
  mark?: { lat: number; lonE: number; label: string } | null; // e.g. the best spot nearby
}

let reliefMeta: Promise<{ halfWidthM: number }> | null = null;

export function PolarMap({ sites, highlight, selectedId, onSelect, onPick, sunAz, earthAz, size = 560, variant = 'panel', layer = 'relief', mark }: Props) {
  const [half, setHalf] = useState(240000);
  useEffect(() => { (reliefMeta ??= fetch('data/relief.json').then((r) => r.json())).then((m) => setHalf(m.halfWidthM)).catch(() => undefined); }, []);
  const S = size, c = S / 2, rad = S / 2 - 2;
  const P = (lat: number, lonE: number) => { const { x, y } = latLonToXY(lat, lonE); return [c + (x / half) * (S / 2), c - (y / half) * (S / 2)]; };
  const sel = sites.find((s) => s.id === selectedId);
  // A direction from the selected point: bearing on the map = local azimuth + longitude (north points away from the pole).
  const ray = (az: number) => {
    if (!sel) return null;
    const b = ((az + sel.lonE) * Math.PI) / 180;
    return [c + Math.sin(b) * (rad - 10), c - Math.cos(b) * (rad - 10)];
  };
  const sunPt = sunAz != null ? ray(sunAz) : null, earthPt = earthAz != null ? ray(earthAz) : null;
  const click = (e: MouseEvent<SVGSVGElement>) => {
    if (!onPick || (e.target as Element).closest('.site')) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * S, py = ((e.clientY - r.top) / r.height) * S;
    if (Math.hypot(px - c, py - c) > rad) return;
    const { lat, lonE } = xyToLatLon(((px - c) / (S / 2)) * half, (-(py - c) / (S / 2)) * half);
    onPick(lat, lonE);
  };
  const key = (id: string) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); } };
  const rings = [86, 88].map((lat) => ({ lat, r: (2 * 1737400 * Math.tan(((90 - lat) * Math.PI) / 360)) / half * (S / 2) }));
  const ink = '#F4F6FA';

  return (
    <svg className="map-svg" viewBox={`0 0 ${S} ${S}`} onClick={click} role="img" aria-label="South pole map. Click a marker to choose a landing point, or anywhere to analyse your own point." style={{ cursor: onPick ? 'crosshair' : undefined }}>
      <defs>
        <clipPath id="map-clip"><circle cx={c} cy={c} r={rad} /></clipPath>
        <radialGradient id="map-vign"><stop offset=".62" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity={variant === 'hud' ? 0.75 : 0.55} /></radialGradient>
        {sunPt && <linearGradient id="map-sunray" x1={c} y1={c} x2={sunPt[0]} y2={sunPt[1]} gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="var(--sky-sun)" stopOpacity="0" /><stop offset="1" stopColor="var(--sky-sun)" stopOpacity=".9" /></linearGradient>}
      </defs>
      <g clipPath="url(#map-clip)">
        <rect x={0} y={0} width={S} height={S} fill="var(--sky-bg)" />
        <image href="data/relief.png" x={0} y={0} width={S} height={S} preserveAspectRatio="none" opacity={variant === 'hud' ? 0.55 : 0.95} />
        {layer !== 'relief' && <image href={`data/illum-${layer}.png`} x={0} y={0} width={S} height={S} preserveAspectRatio="none" opacity={layer === 'psr' ? 1 : 0.92} />}
        <rect x={0} y={0} width={S} height={S} fill="url(#map-vign)" />
        {rings.map((g) => <g key={g.lat}><circle cx={c} cy={c} r={g.r} fill="none" stroke={ink} strokeOpacity={0.28} strokeDasharray="2 4" /><text x={c + 4} y={c - g.r - 4} fill={ink} fillOpacity={0.75} fontSize={11} fontFamily="var(--font-text)">{g.lat}° S</text></g>)}
        {[0, 90, 180, 270].map((lon) => { const p = P(-84.6, lon); return <text key={lon} x={p[0]} y={p[1] + 4} fill={ink} fillOpacity={0.7} fontSize={11} textAnchor="middle" fontFamily="var(--font-text)">{lon === 0 ? '0°' : lon === 90 ? '90° E' : lon === 180 ? '180°' : '90° W'}</text>; })}
      </g>
      {sunPt && <line x1={c} y1={c} x2={sunPt[0]} y2={sunPt[1]} stroke="url(#map-sunray)" strokeWidth={3} strokeLinecap="round" />}
      {sunPt && <circle cx={sunPt[0]} cy={sunPt[1]} r={7} fill="var(--sky-sun)" stroke="#05070B" strokeWidth={2}><title>Direction of the Sun from the selected point</title></circle>}
      {earthPt && <circle cx={earthPt[0]} cy={earthPt[1]} r={6} fill="var(--sky-earth)" stroke="#05070B" strokeWidth={2}><title>Direction of Earth from the selected point</title></circle>}
      <circle cx={c} cy={c} r={rad} fill="none" stroke="var(--line-2)" />
      {mark && (() => { const [x, y] = P(mark.lat, mark.lonE); return <g pointerEvents="none"><circle cx={x} cy={y} r={6} fill="#4FDDB4" stroke="#05070B" strokeWidth={2} /><title>{mark.label}</title></g>; })()}
      {sites.filter((s) => s.lat <= -60).map((s) => {
        const [x, y] = P(s.lat, s.lonE), isSel = s.id === selectedId, hl = highlight.has(s.id) || isSel;
        if (!hl && variant === 'hud') return null;
        const labelRight = x < c + S * 0.18;
        return (
          <g key={s.id} className="site" tabIndex={hl ? 0 : -1} role="button" aria-label={'Select ' + s.name} onClick={() => onSelect(s.id)} onKeyDown={key(s.id)}>
            {isSel && <circle cx={x} cy={y} r={14} fill="var(--sky-sun)" fillOpacity={0.28} />}
            <circle cx={x} cy={y} r={isSel ? 6.5 : hl ? 5 : 3} fill={isSel ? 'var(--sky-sun)' : s.quality === 'custom' ? 'var(--sky-earth)' : ink} fillOpacity={hl ? 1 : 0.55} stroke="#05070B" strokeWidth={hl ? 2 : 1} />
            {hl && <text x={x + (labelRight ? 11 : -11)} y={y + 4} textAnchor={labelRight ? 'start' : 'end'} fill={ink} fontFamily="var(--font-text)" fontWeight={600} fontSize={12.5} paintOrder="stroke" stroke="#05070B" strokeWidth={3.5} strokeLinejoin="round">{s.name.replace(' (best-lit point)', '').replace(' (peak)', '')}</text>}
            <title>{s.name}</title>
          </g>
        );
      })}
    </svg>
  );
}
