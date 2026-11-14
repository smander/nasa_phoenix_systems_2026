// Whole-Moon map: NASA LOLA shaded relief (equirectangular, 180° W at the left, north up), every landing site, the
// near/far-side boundary, and click-anywhere to analyse your own point.
import type { KeyboardEvent, MouseEvent } from 'react';
import type { SiteDef } from '@core/types';

interface Props {
  sites: SiteDef[];
  highlight: Set<string>;
  selectedId: string;
  onSelect: (id: string) => void;
  onPick?: (lat: number, lonE: number) => void;
}

const W = 1024, H = 512;
const X = (lonE: number) => ((((lonE + 180) % 360) + 360) % 360) * (W / 360);
const Y = (lat: number) => (90 - lat) * (H / 180);

export function MoonMap({ sites, highlight, selectedId, onSelect, onPick }: Props) {
  const click = (e: MouseEvent<SVGSVGElement>) => {
    if (!onPick || (e.target as Element).closest('.site')) return;
    const r = e.currentTarget.getBoundingClientRect();
    const lonE = ((e.clientX - r.left) / r.width) * 360 - 180, lat = 90 - ((e.clientY - r.top) / r.height) * 180;
    onPick(Math.max(-90, Math.min(90, lat)), lonE);
  };
  const key = (id: string) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); } };
  const ink = '#F4F6FA';
  return (
    <svg className="map-svg moon-map" viewBox={`0 0 ${W} ${H}`} onClick={click} role="img" style={{ cursor: onPick ? 'crosshair' : undefined }}
      aria-label="Whole-Moon map. Click a marker to choose a landing site, or anywhere to analyse your own point.">
      <image href="data/moon-relief.jpg" x={0} y={0} width={W} height={H} preserveAspectRatio="none" />
      <rect x={0} y={0} width={X(-90)} height={H} fill="#05070B" opacity={0.38} />
      <rect x={X(90)} y={0} width={W - X(90)} height={H} fill="#05070B" opacity={0.38} />
      {[-60, -30, 0, 30, 60].map((lat) => <line key={lat} x1={0} x2={W} y1={Y(lat)} y2={Y(lat)} stroke={ink} strokeOpacity={0.14} />)}
      {[-90, 0, 90].map((lon) => <line key={lon} x1={X(lon)} x2={X(lon)} y1={0} y2={H} stroke={ink} strokeOpacity={lon === 0 ? 0.14 : 0.45} strokeDasharray={lon === 0 ? undefined : '4 4'} />)}
      <text x={X(0)} y={18} textAnchor="middle" fill={ink} fontSize={13} fontWeight={600} fontFamily="var(--font-text)" paintOrder="stroke" stroke="#05070B" strokeWidth={3}>Near side · always faces Earth</text>
      <text x={X(-135)} y={18} textAnchor="middle" fill={ink} fillOpacity={0.8} fontSize={12} fontFamily="var(--font-text)" paintOrder="stroke" stroke="#05070B" strokeWidth={3}>Far side · Earth never in view</text>
      <text x={X(135)} y={18} textAnchor="middle" fill={ink} fillOpacity={0.8} fontSize={12} fontFamily="var(--font-text)" paintOrder="stroke" stroke="#05070B" strokeWidth={3}>Far side</text>
      {[-60, -30, 0, 30, 60].map((lat) => <text key={lat} x={4} y={Y(lat) - 3} fill={ink} fillOpacity={0.6} fontSize={10} fontFamily="var(--font-text)">{lat === 0 ? '0°' : Math.abs(lat) + '°' + (lat < 0 ? ' S' : ' N')}</text>)}
      {sites.map((s) => {
        const x = X(s.lonE), y = Y(s.lat), isSel = s.id === selectedId, hl = highlight.has(s.id) || isSel;
        const right = x < W * 0.8;
        return (
          <g key={s.id} className="site" tabIndex={hl ? 0 : -1} role="button" aria-label={'Select ' + s.name} onClick={() => onSelect(s.id)} onKeyDown={key(s.id)}>
            {isSel && <circle cx={x} cy={y} r={12} fill="var(--sky-sun)" fillOpacity={0.3} />}
            <circle cx={x} cy={y} r={isSel ? 5.5 : hl ? 4.5 : 2.5} fill={isSel ? 'var(--sky-sun)' : s.quality === 'custom' ? 'var(--sky-earth)' : ink} fillOpacity={hl ? 1 : 0.5} stroke="#05070B" strokeWidth={hl ? 1.8 : 0.8} />
            {hl && s.lat > -78 && <text x={x + (right ? 9 : -9)} y={y + 4} textAnchor={right ? 'start' : 'end'} fill={ink} fontFamily="var(--font-text)" fontWeight={600} fontSize={11.5} paintOrder="stroke" stroke="#05070B" strokeWidth={3.2} strokeLinejoin="round">{s.name.replace(/ \(.*\)$/, '')}</text>}
            <title>{s.name}</title>
          </g>
        );
      })}
    </svg>
  );
}
