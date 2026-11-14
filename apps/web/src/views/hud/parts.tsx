// Drawings and small parts of the HUD, ported from packages/design-system/components/ExampleConsole.
import artGeometry from './battery-art.json';
import dishGeometry from './dish-art.json';
import type { SkyState } from '@core/types';

export const HUD: Record<SkyState, { word: string; color: string }> = {
  both: { word: 'Power + contact', color: '#4FDDB4' },
  sun: { word: 'Power only', color: '#FFB547' },
  earth: { word: 'Contact only', color: '#4FA8FF' },
  none: { word: 'Blackout', color: '#9AA4B4' },
};

export function Spark({ values, color }: { values: number[]; color: string }) {
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  return (
    <svg viewBox="0 0 120 26" width={120} height={26} aria-hidden="true">
      {values.map((v, k) => { const h = 3 + ((v - lo) / span) * 21; return <rect key={k} x={k * 3} y={26 - h} width={1.6} height={h} fill={color} opacity={0.35 + k / 60} />; })}
    </svg>
  );
}

export function Lander({ sunUp, earthUp }: { sunUp: boolean; earthUp: boolean }) {
  const cell = sunUp ? 'url(#cellOn)' : 'url(#cellOff)';
  return (
    <svg viewBox="0 0 220 170" width={200} height={155} style={{ marginTop: 4 }} role="img" aria-label={sunUp ? 'Lander with sunlit solar wings' : 'Lander with dark solar wings'}>
      <defs>
        <linearGradient id="cellOn" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#4FDDB4" /><stop offset="1" stopColor="#1a6b58" /></linearGradient>
        <linearGradient id="cellOff" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2a313d" /><stop offset="1" stopColor="#151a22" /></linearGradient>
        <linearGradient id="hull" x1="0" x2="1"><stop offset="0" stopColor="#6b7587" /><stop offset="1" stopColor="#2a313d" /></linearGradient>
      </defs>
      <ellipse cx="110" cy="158" rx="80" ry="8" fill="#000" opacity=".5" />
      <g stroke="#9AA4B4" strokeWidth="2" fill="none"><path d="M80 112 L52 152 M140 112 L168 152 M95 116 L88 154 M125 116 L132 154" /></g>
      <g fill="#9AA4B4"><rect x="44" y="150" width="16" height="4" rx="2" /><rect x="160" y="150" width="16" height="4" rx="2" /></g>
      <rect x="72" y="70" width="76" height="48" rx="6" fill="url(#hull)" stroke="#8a94a6" strokeOpacity=".5" />
      <rect x="82" y="80" width="56" height="10" rx="2" fill="#05070B" /><rect x="84" y="82" width={sunUp ? 36 : 12} height="6" rx="1" fill={sunUp ? '#4FDDB4' : '#FF6E5E'} />
      <g><rect x="10" y="20" width="22" height="90" rx="2" fill={cell} transform="skewY(-6)" /><rect x="34" y="20" width="22" height="90" rx="2" fill={cell} transform="skewY(-6)" />
        <rect x="164" y="40" width="22" height="90" rx="2" fill={cell} transform="skewY(-6)" /><rect x="188" y="40" width="22" height="90" rx="2" fill={cell} transform="skewY(-6)" /></g>
      <g stroke="#05070B" strokeOpacity=".5">{[0, 1, 2, 3, 4, 5].map((k) => <g key={k}><line x1="10" x2="56" y1={36 + k * 15} y2={31 + k * 15} /><line x1="164" x2="210" y1={39 + k * 15} y2={34 + k * 15} /></g>)}</g>
      <path d="M56 86 H72 M148 86 H164" stroke="#9AA4B4" strokeWidth="2" />
      <path d="M120 70 L128 40" stroke="#9AA4B4" strokeWidth="2" /><circle cx="128" cy="38" r="4" fill={earthUp ? '#4FA8FF' : '#5b6474'} />
      {earthUp && <circle cx="128" cy="38" r="10" fill="none" stroke="#4FA8FF" opacity=".6"><animate attributeName="r" values="4;16" dur="2s" repeatCount="indefinite" /><animate attributeName="opacity" values=".7;0" dur="2s" repeatCount="indefinite" /></circle>}
    </svg>
  );
}

export function Dish({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 140 90" width={110} height={70} aria-hidden="true">
      <path d="M30 70 A34 34 0 0 1 80 26 Z" fill="#2a313d" stroke="#9AA4B4" /><line x1="55" y1="48" x2="78" y2="30" stroke="#9AA4B4" strokeWidth="2" /><circle cx="80" cy="28" r="3" fill={on ? '#4FA8FF' : '#5b6474'} />
      <path d="M38 70 L32 86 M48 70 L54 86" stroke="#9AA4B4" strokeWidth="2" />
      {on && [0, 1, 2].map((k) => <path key={k} d={`M${88 + k * 10} ${20 - k * 4} a${10 + k * 10} ${10 + k * 10} 0 0 1 0 ${16 + k * 8}`} fill="none" stroke="#4FA8FF" strokeWidth="2" opacity="0"><animate attributeName="opacity" values="0;.9;0" dur="1.8s" begin={k * 0.3 + 's'} repeatCount="indefinite" /></path>)}
    </svg>
  );
}

export const RULE_ICONS: Record<string, JSX.Element> = {
  SunlitStay: <><circle cx="10" cy="10" r="3" /><path d="M10 3v2M10 15v2M3 10h2M15 10h2M5 5l1.4 1.4M13.6 13.6L15 15M5 15l1.4-1.4M13.6 6.4L15 5" /></>,
  BatterySafe: <path d="M3 6h12v8H3zM15 9h2v2h-2" />,
  DteWindow: <path d="M3 14a7 7 0 0 1 14 0M10 7V3" />,
  DteCoverage: <path d="M4 10a6 6 0 0 1 12 0M7 12a3 3 0 0 1 6 0" />,
  Blackout: <path d="M4 4l12 12M16 4L4 16" />,
};
export const RULE_SHORT: Record<string, (go: number) => string> = {
  SunlitStay: () => 'Sunlight all stay', BatterySafe: () => 'Battery lasts', DteWindow: () => 'Earth comes up', DteCoverage: (go) => go + '% contact', Blackout: () => 'Never both lost',
};


// Battery artwork (tools/art/build_battery_art.py): one fixed shell and solar panel, and the cell stack in
// three colours on the same canvas. Only the lit cells change; the frame never moves or resizes.
const ART = artGeometry;
export const BATTERY_CELLS = 7;
const CELL_COLOURS = { red: '#FF4A3D', amber: '#FFA51F', green: '#3EE07A' } as const;
type CellColour = keyof typeof CELL_COLOURS;

/** Lit cells (0..7) for a charge fraction, and their colour: one cell red, two to four amber, five or more green. */
export function batteryCells(frac: number): { cells: number; colour: CellColour; hex: string } {
  const f = Math.max(0, Math.min(1, frac));
  const cells = f <= 0 ? 0 : Math.max(1, Math.min(BATTERY_CELLS, Math.round(f * BATTERY_CELLS)));
  const colour: CellColour = cells <= 1 ? 'red' : cells <= 4 ? 'amber' : 'green';
  return { cells, colour, hex: CELL_COLOURS[colour] };
}

/** Clip region below the separator arc on top of the k-th lit cell (k = 1..6). */
function cellClip(k: number): string {
  const y0 = ART.seps[BATTERY_CELLS - 1 - k], pts: string[] = [];
  for (let x = ART.left; x <= ART.right + 0.01; x += (ART.right - ART.left) / 24) {
    const dx = Math.max(-1, Math.min(1, (x - ART.cx) / ART.rx));
    pts.push(x.toFixed(1) + ' ' + (y0 - ART.sag * (1 - Math.sqrt(1 - dx * dx))).toFixed(1));
  }
  return 'M' + pts.join(' L') + ` L${ART.right} ${ART.height} L${ART.left} ${ART.height} Z`;
}

export function BatteryArt({ frac }: { frac: number }) {
  const { cells, colour, hex } = batteryCells(frac);
  const clip = cells >= BATTERY_CELLS ? `M0 0 H${ART.width} V${ART.height} H0 Z` : cells <= 0 ? 'M0 0 Z' : cellClip(cells);
  return (
    <svg className="batt-art" viewBox={`0 0 ${ART.width} ${ART.height}`} role="img" aria-label={`Battery ${Math.round(frac * 100)}%, ${cells} of ${BATTERY_CELLS} cells`}>
      <defs>
        <clipPath id="batt-cells"><path d={clip} /></clipPath>
        <radialGradient id="batt-glow"><stop offset="0" stopColor={hex} stopOpacity=".55" /><stop offset="1" stopColor={hex} stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse className="glow" cx={ART.cx} cy={ART.glowY} rx={78} ry={30} fill="url(#batt-glow)" opacity={cells ? 0.35 + (0.65 * cells) / BATTERY_CELLS : 0} />
      <image href="battery/art-base.webp" width={ART.width} height={ART.height} />
      <g clipPath="url(#batt-cells)">
        {(Object.keys(CELL_COLOURS) as CellColour[]).map((c) => <image key={c} className="cells" href={`battery/art-fill-${c}.webp`} width={ART.width} height={ART.height} opacity={c === colour ? 1 : 0} />)}
      </g>
    </svg>
  );
}

// Earth-link dish (tools/art/build_dish_art.py): the active and inactive drawings aligned on one canvas, so the
// frame never moves. Radio waves are drawn here, centred on the feed horn, only while the link is open.
const DISH = dishGeometry;
function waveArc(r: number): string {
  const p = (deg: number) => { const t = (deg * Math.PI) / 180; return (DISH.fx + r * Math.cos(t)).toFixed(1) + ' ' + (DISH.fy + r * Math.sin(t)).toFixed(1); };
  return `M${p(DISH.a0)} A${r} ${r} 0 0 1 ${p(DISH.a1)}`;
}

export function DishArt({ on }: { on: boolean }) {
  return (
    <svg className={'dish-art' + (on ? ' on' : '')} viewBox={`0 0 ${DISH.width} ${DISH.height}`} aria-hidden="true">
      <defs><filter id="dish-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4" /></filter></defs>
      <image className="off" href="dish/dish-inactive.webp" width={DISH.width} height={DISH.height} />
      <image className="act" href="dish/dish-active.webp" width={DISH.width} height={DISH.height} />
      <g className="waves">
        {DISH.radii.map((r, k) => (
          <g key={k} className="wave" style={{ animationDelay: k * 0.3 + 's' }}>
            <path d={waveArc(r)} fill="none" stroke="#4FA8FF" strokeWidth={5} strokeLinecap="round" filter="url(#dish-glow)" />
            <path d={waveArc(r)} fill="none" stroke="#E8F6FF" strokeWidth={1.8} strokeLinecap="round" />
          </g>
        ))}
      </g>
    </svg>
  );
}
