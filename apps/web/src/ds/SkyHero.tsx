// The lunar sky panorama, driven by computed tracks and the site's real terrain mask (design system "SkyHero").
// True scale: one pixels-per-degree for both axes, bodies at their real angular size; the camera frames the Sun and
// Earth together, either one close up, or the whole horizon.
// Terrain occludes the bodies (drawn after them). The Sun is drawn like the Mission tab's (core, glow, halo) and
// Earth is the Mission tab's 3D globe rendered from the site (earthGlobe.ts): real rotation, real phase.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { HonestyNote, MonthBar, PlayButton, STATES, StateBadge } from './components';
import { maskAt } from '@core/horizon';
import { STATE_NAMES, laneRanges, timeAt } from '@core/analysis';
import type { GlobeRenderer } from './earthGlobe';
import type { Evaluation, TimeGrid, Tracks } from '@core/types';

export interface SkyHeroProps {
  siteName: string;
  grid: TimeGrid;
  tracks: Tracks;
  ev: Evaluation;
  mask: Float32Array;
  t: number;
  onTime: (t: number) => void;
  playing: boolean;
  onPlay: () => void;
  window?: [number, number];
  violations?: number[];
  ticks: [number, string][];
  dateLabel: string;
  timeLabel: string;
  height?: number;
  scrubber?: boolean;
  observerM: number;
  /** Site position, for the 3D Earth globe; without it Earth is a flat phase disc. */
  siteLat?: number;
  siteLon?: number;
  /** Embedded use (Mission scene): no headline block, and an exact drawing size instead of the responsive one. */
  hideHead?: boolean;
  frame?: { w: number; h: number };
}


function seededStars(n: number, w: number, h: number) {
  const a: { x: number; y: number; r: number; d: string }[] = [];
  let s = 7;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < n; i++) a.push({ x: rnd() * w, y: rnd() * h, r: rnd() * 1.1 + 0.3, d: (rnd() * 3.2).toFixed(2) });
  return a;
}

export type SkyView = 'both' | 'earth' | 'sun' | 'all';
const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function SkyHero(p: SkyHeroProps) {
  // Taller picture on narrow screens; the sky band starts below the measured header text.
  const rootRef = useRef<HTMLDivElement>(null), svgRef = useRef<SVGSVGElement>(null), headRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ narrow: false, headBottom: 0 });
  const W = p.frame ? p.frame.w : layout.narrow ? 480 : 960, H = p.frame ? p.frame.h : layout.narrow ? 540 : p.height || 340;
  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    const measure = () => {
      const svg = svgRef.current, head = headRef.current; if (!svg) return;
      const w = svg.getBoundingClientRect().width || 1, narrow = w < 700;
      const headBottom = head ? ((head.getBoundingClientRect().bottom - svg.getBoundingClientRect().top) * (narrow ? 480 : 960)) / w : 0;
      setLayout((l) => (l.narrow === narrow && Math.abs(l.headBottom - headBottom) < 2 ? l : { narrow, headBottom }));
    };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(root); if (headRef.current) ro.observe(headRef.current); return () => ro.disconnect();
  }, []);
  const barRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = scrollRef.current; if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2; }, []);
  const dragging = useRef(false);
  const n = p.grid.n;
  const [view, setView] = useState<SkyView>('earth');

  // Earth's mean direction over the period: the centre of the 360-degree view
  const center = useMemo(() => {
    let x = 0, y = 0;
    for (let i = 0; i < n; i++) { x += Math.sin(p.tracks.earthAz[i] * Math.PI / 180); y += Math.cos(p.tracks.earthAz[i] * Math.PI / 180); }
    return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
  }, [p.tracks, n]);
  const maskRange = useMemo(() => { let lo = Infinity, hi = -Infinity; for (let k = 0; k < 720; k++) { lo = Math.min(lo, p.mask[k]); hi = Math.max(hi, p.mask[k]); } return [lo, hi]; }, [p.mask]);
  const stars = useMemo(() => seededStars(90, W, H * 0.9), [W, H]);
  const lanes = useMemo(() => ({ sun: laneRanges(p.ev.sunUp), earth: laneRanges(p.ev.earthUp) }), [p.ev]);

  // This moment, interpolated between the hourly samples so the camera moves smoothly
  const tf = Math.max(0, Math.min(n - 1, p.t)), i0 = Math.floor(tf), i1 = Math.min(n - 1, i0 + 1), fr = tf - i0;
  const lerp = (a: ArrayLike<number>) => a[i0] * (1 - fr) + a[i1] * fr;
  const lerpAz = (a: ArrayLike<number>) => (a[i0] + wrap180(a[i1] - a[i0]) * fr + 360) % 360;
  const i = Math.round(tf);
  const state = STATE_NAMES[p.ev.state[i]];
  const S = STATES[state];
  const sAz = lerpAz(p.tracks.sunAz), sEl = lerp(p.tracks.sunEl), eAz = lerpAz(p.tracks.earthAz), eEl = lerp(p.tracks.earthEl);
  const sR = lerp(p.tracks.sunR), eR = lerp(p.tracks.earthR); // true angular radii, degrees
  const lit = lerp(p.tracks.earthLit), earthKm = lerp(p.tracks.earthKm);

  // Camera: one scale (pixels per degree) for both axes, so sizes, heights and distances are all true.
  // The sky band runs below the header text and above the bearing labels.
  const yTop = p.hideHead ? H * 0.14 : Math.max(H * 0.3, Math.min(H * 0.6, layout.headBottom ? layout.headBottom + 12 : H * 0.44)), yBot = H - 34, yc = (yTop + yBot) / 2, vAvail = yBot - yTop;
  let cAz: number, cEl: number, PX: number;
  if (view === 'earth') { cAz = eAz; cEl = eEl; PX = W / 14; }
  else if (view === 'sun') { cAz = sAz; cEl = sEl; PX = W / 7; }
  else if (view === 'all') {
    const hi = Math.max(maskRange[1], sEl + sR, eEl + eR) + 0.6, lo = Math.min(maskRange[0], sEl - sR, eEl - eR, 0) - 0.6;
    cAz = center; PX = Math.min(W / 360, vAvail / (hi - lo)); cEl = (hi + lo) / 2;
  } else {
    const sep = wrap180(sAz - eAz);
    const hi = Math.max(eEl + eR, sEl + sR) + 1, lo = Math.min(eEl - eR, sEl - sR, maskAt(p.mask, eAz), maskAt(p.mask, sAz)) - 1;
    cAz = (eAz + sep / 2 + 360) % 360;
    PX = Math.max(W / 360, Math.min(W / 6, (W * 0.72) / (Math.abs(sep) + 2 * Math.max(eR, sR) + 3), vAvail / (hi - lo)));
    cEl = (hi + lo) / 2;
  }
  const X = (az: number) => W / 2 + wrap180(az - cAz) * PX;
  const Y = (el: number) => yc - (el - cEl) * PX;
  const fov = W / PX;

  // Skyline across the field of view, from the site's real terrain mask (0.5-degree bins)
  const half = Math.min(180, fov / 2 + 1), K = 600;
  let ridge = `M0 ${H}`, litRidge = '', seg = '';
  for (let k = 0; k <= K; k++) {
    const off = -half + (2 * half * k) / K, az = cAz + off, x = W / 2 + off * PX, y = Y(maskAt(p.mask, az)); // no wrap: left to right
    ridge += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    const facing = p.ev.sunUp[i] && Math.cos(((az - sAz) * Math.PI) / 180) > 0.82;
    if (facing) seg += (seg ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); else if (seg) { if (seg.includes('L')) litRidge += seg + ' '; seg = ''; }
  }
  if (seg.includes('L')) litRidge += seg;
  ridge += ` L${W} ${H} Z`;

  // Bearing and elevation ticks at a step that suits the zoom
  const azStep = [1, 2, 5, 10, 15, 30, 45].find((st) => st * PX >= 70) ?? 45;
  const azTicks: { x: number; t: string }[] = [];
  for (let a = Math.ceil((cAz - half) / azStep) * azStep; a <= cAz + half; a += azStep) {
    const b = ((a % 360) + 360) % 360, x = X(b);
    if (x > 16 && x < W - 16) azTicks.push({ x, t: b % 45 === 0 ? COMPASS[b / 45] : b + '°' });
  }
  const elStep = [0.5, 1, 2, 5, 10].find((st) => st * PX >= 30) ?? 10;
  const elTicks: number[] = [];
  for (let e = Math.ceil((cEl - vAvail / 2 / PX) / elStep) * elStep; e <= cEl + vAvail / 2 / PX; e += elStep) if (Math.abs(e) > 1e-6) elTicks.push(+e.toFixed(1));

  // The bodies at true angular size (a minimum of a pixel or two so they never vanish)
  const sx = X(sAz), sy = Y(sEl), ex = X(eAz), ey = Y(eEl);
  const sr = Math.max(1.2, sR * PX), er = Math.max(1.5, eR * PX);
  const clear = (sEl + sR - lerp(p.ev.maskSun)) / (2 * sR);
  const glow = Math.max(0, Math.min(1, clear));
  const glowR = Math.max(sr * 3.6, 14), haloR = Math.max(sr * 7, 30); // glare, as a camera sees it
  // Direction from Earth toward the Sun on screen, for the flat-disc fallback's terminator
  const phaseAngle = Math.atan2(sy - ey, sx - ex) * 180 / Math.PI;
  let term = '';
  for (let a = -90; a <= 90; a += 10) { const r = a * Math.PI / 180; term += (term ? 'L' : 'M') + (er * Math.cos(r)).toFixed(2) + ',' + (er * Math.sin(r)).toFixed(2); }
  for (let a = 90; a >= -90; a -= 10) { const r = a * Math.PI / 180; term += 'L' + ((1 - 2 * lit) * er * Math.cos(r)).toFixed(2) + ',' + (er * Math.sin(r)).toFixed(2); }

  const seek = (e: PointerEvent<HTMLDivElement>) => {
    const r = barRef.current!.getBoundingClientRect();
    const left = r.left + (r.width > 200 ? 76 : 0); // lanes start after the Sun/Earth labels
    p.onTime(Math.max(0, Math.min(n - 1, ((e.clientX - left) / (r.right - left)) * (n - 1))));
  };
  const onKey = (e: KeyboardEvent) => {
    const step = (e.shiftKey ? 24 : 1) * (60 / p.grid.stepMin);
    if (e.key === 'ArrowRight') { p.onTime(Math.min(n - 1, i + step)); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { p.onTime(Math.max(0, i - step)); e.preventDefault(); }
    else if (e.key === 'Home') { p.onTime(0); e.preventDefault(); }
    else if (e.key === 'End') { p.onTime(n - 1); e.preventDefault(); }
    else if (e.key === ' ') { p.onPlay(); e.preventDefault(); }
  };
  // The real Earth: render the 3D globe offscreen at most every 40 ms while time moves.
  const [earthImg, setEarthImg] = useState<string | null>(null);
  const [sunPhoto, setSunPhoto] = useState(true); // NASA SDO disc; falls back to the drawn core if missing
  const globe = useRef<GlobeRenderer | null>(null);
  const want = useRef({ ms: 0, lat: 0, lon: 0, h: 0 });
  const frame = useRef({ pending: false, last: 0 });
  want.current = { ms: timeAt(p.grid, p.t), lat: p.siteLat ?? 0, lon: p.siteLon ?? 0, h: p.observerM };
  const kick = () => {
    if (frame.current.pending || !globe.current) return;
    frame.current.pending = true;
    const tick = (now: number) => {
      if (!globe.current) { frame.current.pending = false; return; }
      if (now - frame.current.last < 40) { requestAnimationFrame(tick); return; }
      frame.current.pending = false; frame.current.last = now;
      const w = want.current;
      try { setEarthImg(globe.current.render(w.ms, w.lat, w.lon, w.h)); } catch { /* keep the last frame */ }
    };
    requestAnimationFrame(tick);
  };
  useEffect(() => {
    if (p.siteLat == null || p.siteLon == null) return;
    let alive = true;
    import('./earthGlobe').then((m) => {
      if (!alive) return;
      try { globe.current = m.createGlobeRenderer(384, () => kick()); kick(); } catch { /* no WebGL: the flat phase disc stays */ }
    }).catch(() => undefined);
    return () => { alive = false; globe.current?.dispose(); globe.current = null; };
  }, [p.siteLat == null || p.siteLon == null]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(kick, [p.t, p.siteLat, p.siteLon, p.observerM]); // eslint-disable-line react-hooks/exhaustive-deps
  const globeR = er * 1.25; // the rendered square spans 1.25 Earth radii each way (GLOBE_FRAME)
  const showGlobe = !!earthImg && er >= 4;

  // Labels: above, below or beside each body, clear of the header text and of each other
  const inFrame = (x: number, half: number) => Math.max(10 + half, Math.min(W - 64 - half, x));
  const sunLbl = { x: inFrame(sx, 42), y: Math.max(yTop + 4, sy - Math.max(sr + 10, 22)) };
  const earthLbl = (() => {
    const clearOfSun = (x: number, y: number) => Math.hypot(x - sx, y - sy) > Math.max(glowR * 0.7, sr + 34);
    const lx = inFrame(ex, 66);
    const above = { x: lx, y: ey - er - 24, anchor: 'middle' as const }, below = { x: lx, y: ey + er + 20, anchor: 'middle' as const };
    if (above.y - 14 > yTop && clearOfSun(above.x, above.y)) return above;
    if (clearOfSun(below.x, below.y)) return below;
    return ex > 150 ? { x: ex - er - 10, y: ey - 4, anchor: 'end' as const } : { x: ex + er + 10, y: ey - 4, anchor: 'start' as const };
  })();
  const VIEWS: [SkyView, string][] = [['earth', 'Earth'], ['both', 'Sun + Earth'], ['sun', 'Sun'], ['all', '360°']];


  return (
    <div className="pw-sky" ref={rootRef}>
      <div className="pw-sky-scroll" ref={scrollRef}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${S.head}. Sun elevation ${sEl.toFixed(2)} degrees, Earth elevation ${eEl.toFixed(2)} degrees, at ${p.siteName}.`}>
        <defs>
          {/* the Sun: white-hot core (true size) with glare around it */}
          <radialGradient id="pw-sun-core"><stop offset="0" stopColor="#FFFFFF" /><stop offset=".6" stopColor="#FFF6E2" /><stop offset="1" stopColor="#FFE0A6" /></radialGradient>
          <radialGradient id="pw-sun-glow"><stop offset="0" stopColor="rgb(255,250,235)" /><stop offset=".18" stopColor="rgb(255,190,90)" stopOpacity=".55" /><stop offset="1" stopColor="rgb(255,190,90)" stopOpacity="0" /></radialGradient>
          <radialGradient id="pw-sun-halo"><stop offset="0" stopColor="rgb(255,200,120)" stopOpacity=".5" /><stop offset=".18" stopColor="rgb(255,160,60)" stopOpacity=".18" /><stop offset="1" stopColor="rgb(255,160,60)" stopOpacity="0" /></radialGradient>
          <linearGradient id="pw-terrain" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--terrain)" /><stop offset="1" stopColor="var(--sky-bg)" /></linearGradient>
        </defs>
        <g>{stars.map((s, k) => {
          const near = Math.hypot(s.x - sx, s.y - sy), fade = Math.min(1, near / 260) * (1 - glow * 0.5 * (near < 260 ? 1 : 0));
          return <circle key={k} className="star" cx={s.x} cy={s.y} r={s.r} fill="var(--sky-ink)" opacity={fade} style={{ animationDelay: s.d + 's' }} />;
        })}</g>
        <g style={{ mixBlendMode: 'screen' }}>
          <circle cx={sx} cy={sy} r={haloR} fill="url(#pw-sun-halo)" opacity={0.25 + 0.75 * glow} />
          <circle cx={sx} cy={sy} r={glowR} fill="url(#pw-sun-glow)" opacity={0.35 + 0.65 * glow} />
        </g>
        <circle cx={sx} cy={sy} r={sr} fill="url(#pw-sun-core)" />
        {sunPhoto && sr >= 3 && <image href="textures/sun-disc.webp" x={sx - sr * 1.03} y={sy - sr * 1.03} width={sr * 2.06} height={sr * 2.06} onError={() => setSunPhoto(false)} />}
        {showGlobe ? (
          <image className="pw-earth-globe" href={earthImg!} x={ex - globeR} y={ey - globeR} width={globeR * 2} height={globeR * 2} />
        ) : er < 4 ? (
          <circle cx={ex} cy={ey} r={er} fill="var(--sky-earth)" opacity={0.35 + 0.65 * lit} />
        ) : (
          <g transform={`translate(${ex.toFixed(1)} ${ey.toFixed(1)})`}>
            <circle r={er} fill="#0D1A33" />
            <path d={term + 'Z'} fill="var(--sky-earth)" transform={`rotate(${phaseAngle.toFixed(1)})`} />
            <circle r={er} fill="none" stroke="var(--sky-earth)" strokeOpacity={0.35} />
          </g>
        )}
        <path d={ridge} fill="url(#pw-terrain)" />
        {litRidge && <path d={litRidge} fill="none" stroke="var(--ridge)" strokeWidth={1.6} strokeOpacity={0.9} />}
        {Y(0) > yTop - 20 && Y(0) < H && <>
          <line x1={0} x2={W} y1={Y(0)} y2={Y(0)} stroke="var(--sky-ink)" strokeOpacity={0.14} strokeDasharray="2 5" />
          <line x1={W - 14} x2={W} y1={Y(0)} y2={Y(0)} stroke="var(--sky-sub)" strokeOpacity={0.6} /><text x={W - 18} y={Y(0) + 4} fill="var(--sky-sub)" fontSize={11} fontFamily="var(--font-mono)" textAnchor="end">0°</text>
        </>}
        {elTicks.map((e) => { const y = Y(e); return y > yTop && y < yBot - 8 && Math.abs(y - Y(0)) > 14 ? <g key={e}><line x1={W - 14} x2={W} y1={y} y2={y} stroke="var(--sky-sub)" strokeOpacity={0.6} /><text x={W - 18} y={y + 4} fill="var(--sky-sub)" fontSize={11} fontFamily="var(--font-mono)" textAnchor="end">{e > 0 ? '+' : ''}{e}°</text></g> : null; })}
        {azTicks.map((a) => <text key={a.t + a.x.toFixed(0)} x={a.x} y={H - 12} fill="var(--sky-sub)" fontSize={14} fontWeight={600} fontFamily="var(--font-text)" textAnchor="middle">{a.t}</text>)}
        {sy > yTop - 30 && sy < H - 30 && sx > -40 && sx < W + 40 && <text className="label" x={sunLbl.x} y={sunLbl.y} fill="var(--sky-sun)" textAnchor="middle" fontSize={14} fontWeight={650} fontFamily="var(--font-text)">Sun<tspan fill="var(--sky-sub)" fontWeight={500} fontSize={12}> · {(sR * 2).toFixed(2)}°</tspan></text>}
        {ey < H - 30 && ex > -40 && ex < W + 40 && <text className="label" x={earthLbl.x} y={earthLbl.y} fill="var(--sky-earth)" textAnchor={earthLbl.anchor} fontSize={14} fontWeight={650} fontFamily="var(--font-text)">
          Earth · {Math.round(lit * 100)}% lit
          <tspan x={earthLbl.x} dy={15} fill="var(--sky-sub)" fontWeight={500} fontSize={12}>{(eR * 2).toFixed(2)}° · {Math.round(earthKm).toLocaleString('en-US')} km</tspan>
        </text>}
      </svg>
      </div>
      {!p.hideHead && <>
        <div className="pw-sky-head" ref={headRef}>
          <StateBadge state={state} animateKey={state} />
          <h1 key={'h' + state} className="pw-flip">{S.head}</h1>
          <div key={'s' + state} className="sub pw-flip">{S.sub}</div>
        </div>
        <div className="pw-sky-time"><b>{p.dateLabel}</b>{p.timeLabel}</div>
      </>}
      <div className="pw-sky-foot"><HonestyNote onSky>true scale · {fov >= 100 ? Math.round(fov) : fov.toFixed(1)}° wide · dashed line = flat horizon · terrain LOLA · observer {p.observerM} m</HonestyNote></div>
      <div className="pw-sky-modes" role="group" aria-label="What the sky view frames">
        <span className="lbl">View</span>
        {VIEWS.map(([v, t]) => <button key={v} type="button" aria-pressed={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{t}</button>)}
        <span className="pw-sky-modes-note">Same scale up and across · Sun and Earth at true size</span>
      </div>
      {p.scrubber !== false && (
        <div className="pw-sky-ctl" style={{ background: 'var(--bg)' }}>
          <PlayButton playing={p.playing} onClick={p.onPlay} />
          <div ref={barRef} role="slider" tabIndex={0} aria-label="Time" aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={i} aria-valuetext={p.dateLabel + ' ' + p.timeLabel}
            style={{ cursor: 'ew-resize', touchAction: 'none', borderRadius: 8 }}
            onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); seek(e); }}
            onPointerMove={(e) => { if (dragging.current) seek(e); }}
            onPointerUp={() => { dragging.current = false; }}
            onKeyDown={onKey}>
            <MonthBar lanes={lanes} playhead={i / Math.max(1, n - 1)} window={p.window} violations={p.violations} ticks={p.ticks} label="Sun and Earth lanes for the date range" />
          </div>
        </div>
      )}
    </div>
  );
}
