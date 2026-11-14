// HUD "Mission" tab: the design's ExampleConsole layout, panel for panel, on live data.
import { useRef } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { STATE_NAMES, countdowns, stateSegments, timeAt } from '@core/analysis';
import { fmtCountdown, fmtDay, fmtHours, fmtShort, rangeTicks, signed } from '@core/format';
import type { Analysis } from '../../state/useAnalysis';
import { BatteryArt, batteryCells, DishArt, RULE_ICONS, RULE_SHORT, Spark } from './parts';

const at = (x: number, y: number, w: number, h?: number): CSSProperties => ({ ['--x' as string]: x + 'px', ['--y' as string]: y + 'px', ['--w' as string]: w + 'px', ...(h ? { ['--h' as string]: h + 'px' } : {}) });

export function MissionPanels({ a }: { a: Analysis }) {
  const s = a.store, site = a.site!, tr = a.tracks!, ev = a.ev!, m = a.m!, mission = a.mission!;
  const i = a.t, n = a.grid.n, stepH = a.grid.stepMin / 60;
  const trackRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const mc = mission.mc, pass = mc.rules.filter((r) => r.holds).length, anyFail = pass < mc.rules.length;
  const days = mission.days, selDay = Math.floor((mc.startIndex * a.grid.stepMin) / 1440);
  const badDay = days.find((d, k) => d.cls === 0 && k > selDay) ?? days.find((d) => d.cls === 0);
  const goodDay = days.find((d) => d.cls === 2) ?? days.find((d) => d.cls === 1);
  const flipTo = anyFail ? goodDay : badDay;
  const compare = (s.compareIds.map((id) => s.sites.find((x) => x.id === id)).filter(Boolean) as typeof s.sites);
  if (!compare.some((x) => x.id === site.id)) compare.unshift(site);
  const spark = (arr: ArrayLike<number>) => Array.from({ length: 40 }, (_, k) => arr[Math.max(0, Math.min(n - 1, i - 39 + k))]);
  const cd = countdowns(ev, a.grid, s.t), cdSun = fmtCountdown(cd.sun, 'Sun'), cdEarth = fmtCountdown(cd.earth, 'Earth');
  const minBattery = mc.battery.length ? Math.min(s.settings.reserveH, ...Array.from(mc.battery)) : s.settings.reserveH;
  const cellsOn = s.settings.reserveH > 0 ? Math.max(0, Math.round((10 * Math.max(0, minBattery)) / s.settings.reserveH)) : 0;
  // Charge now, with the same model as the battery rule: full while sunlit, one hour used per dark hour.
  const reserveH = s.settings.reserveH, ti = Math.round(i);
  let darkH = 0; for (let k = ti; k >= 0 && !ev.sunUp[k]; k--) darkH += stepH;
  const inStay = ti >= mc.startIndex && ti < mc.startIndex + mc.battery.length;
  const leftH = inStay ? mc.battery[ti - mc.startIndex] : reserveH - darkH;
  const chargeFrac = reserveH > 0 ? Math.max(0, Math.min(1, leftH / reserveH)) : 0;
  const chargeTxt = ev.sunUp[ti] ? 'Charging from the Sun' : leftH > 0 ? `On battery · ${fmtHours(leftH)} left` : 'Battery empty';
  // Earth link now, and when it next changes
  const linkOpen = !!ev.earthUp[ti];
  const linkWhen = cd.earth.hours == null ? 'until period end' : (linkOpen ? 'closes in ' : 'opens in ') + cdEarth.value;
  const periodLabel = s.preset === 'jan2027' ? 'Jan 2027' : fmtDay(s.fromMs) + ' – ' + fmtDay(s.toMs);
  const ticks = rangeTicks(s.fromMs, timeAt(a.grid, n - 1));

  // Sky track (design: dotted Sun-height field over the period, ridge line, live marker); drag to scrub.
  const TW = 380, TH = 150, X = (k: number) => 10 + (k / (n - 1)) * (TW - 20);
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < n; k++) { lo = Math.min(lo, tr.sunEl[k], ev.maskSun[k]); hi = Math.max(hi, tr.sunEl[k], ev.maskSun[k]); }
  lo -= 0.2; hi += 0.2;
  const Y = (v: number) => 120 - ((v - lo) / (hi - lo)) * 108;
  const cols = 120, step = (n - 1) / cols;
  const sunPts: string[] = [], ridgePts: string[] = [], dots: JSX.Element[] = [];
  for (let c = 0; c <= cols; c++) {
    const k = Math.round(c * step), x = X(k), y = Y(tr.sunEl[k]);
    sunPts.push(x.toFixed(1) + ' ' + y.toFixed(1)); ridgePts.push(x.toFixed(1) + ' ' + Y(ev.maskSun[k]).toFixed(1));
    for (let yy = y, q = 0; yy < 120; yy += 8 + (c % 3), q++) dots.push(<circle key={c + ':' + q} cx={x} cy={yy} r={0.9} fill={ev.sunUp[k] ? '#FFB547' : '#5b6474'} opacity={0.55} />);
  }
  const scrub = (e: PointerEvent<SVGSVGElement>) => {
    const r = trackRef.current!.getBoundingClientRect(), f = ((e.clientX - r.left) / r.width * TW - 10) / (TW - 20);
    s.setPlaying(false); s.setT(Math.max(0, Math.min(n - 1, f * (n - 1))));
  };

  // Landing window widget
  const LW = 390, nd = days.length, dx = (d: number) => 20 + (d / Math.max(1, nd)) * (LW - 40);
  const bx0 = dx(selDay), bw = Math.max(14, dx(selDay + s.settings.stayDays) - dx(selDay));
  const failMs = mc.rules.find((r) => !r.holds && r.firstFailMs != null)?.firstFailMs ?? null;
  const st = STATE_NAMES[ev.state[i]];

  return (
    <>
      <div className="panel" style={at(40, 130, 420)}>
        <div className="phead"><h3 className="title">Landing sites</h3><button type="button" className="live" onClick={() => s.setTab('sites')}>{periodLabel} ▾</button></div>
        <div style={{ maxHeight: 272, overflow: 'auto' }}>
          {compare.map((x) => { const r = a.all[x.id]; return (
            <button key={x.id} type="button" className={'row' + (x.id === site.id ? ' sel' : '')} style={{ gridTemplateColumns: '1fr 64px 64px 18px' }} onClick={() => s.select(x.id)} aria-pressed={x.id === site.id}>
              <span><b style={{ fontWeight: 600 }}>{x.name.replace(/ \((best-lit point|peak)\)/, '')}</b>{x.quality === 'approximate' && <span className="m"> ≈ approx.</span>}</span>
              <span className="num" style={{ color: '#FFB547' }}>☀ {r ? Math.round(r.sun) : '…'}%</span>
              <span className="num" style={{ color: '#4FA8FF' }}>◐ {r ? Math.round(r.earth) : '…'}%</span>
              <span className="dot" title={r ? `${Math.round(r.both)}% of the time both up` : ''} style={{ color: r && r.both >= 40 ? '#4FDDB4' : r && r.sun >= 80 ? '#FFB547' : r && r.earth >= 70 ? '#4FA8FF' : '#9AA4B4', animation: 'none' }} />
            </button>); })}
        </div>
      </div>

      <div className="panel" style={at(40, 478, 420)}>
        <div className="phead"><h3 className="title">Live sky</h3><span className="live"><span className="dot" />{s.playing ? 'Live' : 'Paused'}</span></div>
        {([['Sun height', signed(tr.sunEl[i]) + '°', '#FFB547', spark(tr.sunEl)], ['Earth height', signed(tr.earthEl[i]) + '°', '#4FA8FF', spark(tr.earthEl)], ['Solar power', Math.round(ev.powerW[i]) + ' W/m²', '#FFB547', spark(ev.powerW)], ['Earth distance', Math.round(tr.earthKm[i]).toLocaleString('en-US') + ' km', '#4FA8FF', spark(tr.earthKm)]] as [string, string, string, number[]][]).map(([k, v, c, d]) => (
          <div key={k} className="row" style={{ gridTemplateColumns: '1fr 110px 120px' }}><span>{k}</span><b className="num" style={{ fontWeight: 600 }}>{v}</b><Spark values={d} color={c} /></div>
        ))}
      </div>

      <div className="panel" style={at(40, 792, 420, 378)}>
        <div className="phead"><h3 className="title">Power system</h3><span className="live">Vertical array · {Math.round(s.settings.eta * 100)}%</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 170px', gap: 8, alignItems: 'start' }}>
          <div>
            <div className="lbl">Sunlit {s.preset === 'jan2027' ? 'this month' : 'this period'}</div>
            <div className="big" style={{ fontSize: 44, color: m.sunPct >= 80 ? '#4FDDB4' : m.sunPct >= 50 ? '#4FDDB4' : '#FF6E5E', lineHeight: 1.1 }}>{Math.round(m.sunPct)}%</div>
            <div className="batt">
              <BatteryArt frac={chargeFrac} />
              <div className="batt-read"><div className="lbl">Charge now</div>
                <div className="val num" style={{ color: batteryCells(chargeFrac).hex }}>{Math.round(chargeFrac * 100)}<small>%</small></div>
                <div className="sub">{chargeTxt}</div></div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 14, paddingTop: 4 }}>
            <div><div className="lbl">Energy · {s.preset === 'jan2027' ? 'month' : 'period'}</div><div className="val num">{Math.round(m.energyKWh)}<small>kWh/m²</small></div></div>
            <div style={{ borderTop: '1px solid var(--edge)', paddingTop: 12 }}><div className="lbl">Longest night</div><div className="val num">{m.longestDarkH >= 48 ? (m.longestDarkH / 24).toFixed(1) : Math.round(m.longestDarkH)}<small>{m.longestDarkH >= 48 ? 'days' : 'hours'}</small></div></div>
            <div style={{ borderTop: '1px solid var(--edge)', paddingTop: 12 }}><div className="lbl">Battery covers</div><div className="val num">{s.settings.reserveH}<small>hours</small></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10,1fr)', gap: 3, marginTop: 8 }} title="Lowest charge left during the stay">{Array.from({ length: 10 }, (_, k) => <i key={k} style={{ display: 'block', height: 14, borderRadius: 2, background: k < cellsOn ? '#4FDDB4' : 'rgba(255,255,255,.1)', boxShadow: k < cellsOn ? '0 0 6px rgba(79,221,180,.5)' : 'none' }} />)}</div>
            </div>
          </div>
        </div>
        <div className="split" style={{ gridTemplateColumns: 'repeat(3, auto)', marginTop: 4, justifyContent: 'start' }}>
          <div><div className="lbl">Power now</div><div className="val num" style={{ fontSize: 18 }}>{Math.round(ev.powerW[i])}<small>W/m²</small></div></div>
          <div><div className="lbl">Average</div><div className="val num" style={{ fontSize: 18 }}>{Math.round(m.meanPowerW)}<small>W/m²</small></div></div>
          <div><div className="lbl">For 10 kW</div><div className="val num" style={{ fontSize: 18 }}>{m.areaFor10kWm2 ? Math.round(m.areaFor10kWm2) : '—'}<small>m² cells</small></div></div>
        </div>
      </div>

      <div className="panel" style={at(484, 792, 640, 378)}>
        <div className="phead">
          <div><h3 className="title">Mission check</h3><div className="sub">Land <b style={{ color: 'var(--ink)' }}>{fmtDay(mc.startMs)} · {fmtShort(mc.startMs).slice(-5)}</b> · stay {s.settings.stayDays} days · SAPLE preview</div></div>
          <button type="button" className="toggle title" onClick={() => s.setTab('check')} style={{ cursor: 'pointer' }}>Verify<span className="sw" /></button>
        </div>
        <div className="rules">
          {mc.rules.slice(0, 3).map((r) => <div key={r.id} className={'tile ' + (r.holds ? 'ok' : 'bad')} title={r.why}><div className="ic"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">{RULE_ICONS[r.id]}</svg></div><b>{RULE_SHORT[r.id](s.settings.goPct)}</b><span style={{ color: r.holds ? '#4FDDB4' : '#FF6E5E' }}>{r.holds ? 'Pass' : 'Fail'}</span></div>)}
          <div className="tile count" style={{ gridRow: 'span 2', alignContent: 'center' }}>
            <div className="lbl">Rules passing</div>
            <div className="big" style={{ fontSize: 64, lineHeight: 0.9, color: anyFail ? '#FF6E5E' : 'var(--ink)' }}>{pass}</div>
            <div style={{ fontSize: 14 }}>of {mc.rules.length}</div>
            <div className={'link' + (linkOpen ? ' on' : '')} title="Direct-to-Earth radio link at the selected time">
              <DishArt on={linkOpen} />
              <div className="cap"><span className="dot" />Earth link · {linkOpen ? 'open' : 'closed'}</div>
              <div className="when">{linkWhen}</div>
            </div>
          </div>
          {mc.rules.slice(3).map((r) => <div key={r.id} className={'tile ' + (r.holds ? 'ok' : 'bad')} title={r.why}><div className="ic"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">{RULE_ICONS[r.id]}</svg></div><b>{RULE_SHORT[r.id](s.settings.goPct)}</b><span style={{ color: r.holds ? '#4FDDB4' : '#FF6E5E' }}>{r.holds ? 'Pass' : 'Fail'}</span></div>)}
          {flipTo ? <button type="button" className="tile" onClick={() => { s.setLanding(flipTo.startIndex); s.setT(flipTo.startIndex); }}>
            <div className="ic"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 10a6 6 0 0 1 10.5-4M16 10a6 6 0 0 1-10.5 4M14 2v4h-4M6 18v-4h4" /></svg></div>
            <b>{anyFail ? 'Back to ' + fmtDay(flipTo.dayMs) : 'Try ' + fmtDay(flipTo.dayMs)}</b>{anyFail ? 'see every rule pass' : 'see a rule fail'}
          </button> : <div className="tile" />}
        </div>
      </div>

      <div className="panel" style={at(1140, 390, 420)}>
        <div className="phead"><h3 className="title">Sky track</h3><span className="live">Sun height · {s.preset === 'jan2027' ? 'January' : 'period'}</span></div>
        <div style={{ borderRadius: 14, background: 'var(--glass-2)', padding: '12px 12px 6px' }}>
          <svg ref={trackRef} viewBox={`0 0 ${TW} ${TH}`} width="100%" style={{ display: 'block', cursor: 'ew-resize', touchAction: 'none' }} role="slider" tabIndex={0}
            aria-label="Time: drag along the Sun track" aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={i} aria-valuetext={fmtShort(a.nowMs) + ' UTC'}
            onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); scrub(e); }} onPointerMove={(e) => { if (dragging.current) scrub(e); }} onPointerUp={() => { dragging.current = false; }}
            onKeyDown={(e) => { const k = (e.shiftKey ? 24 : 1) / stepH; if (e.key === 'ArrowRight') { s.setT(Math.min(n - 1, i + k)); e.preventDefault(); } if (e.key === 'ArrowLeft') { s.setT(Math.max(0, i - k)); e.preventDefault(); } if (e.key === ' ') { s.setPlaying(!s.playing); e.preventDefault(); } }}>
            <polyline points={ridgePts.join(' ')} fill="none" stroke="#fff" strokeOpacity={0.25} strokeDasharray="3 4" />
            <text x={12} y={Math.max(10, Y(ev.maskSun[0]) - 5)} fontSize={10} fill="#9AA4B4">ridge line</text>
            <g>{dots}</g>
            <polyline points={sunPts.join(' ')} fill="none" stroke="#FFB547" strokeWidth={1.6} />
            {ticks.map(([f, t], k) => <text key={k} x={10 + f * (TW - 20)} y={142} fontSize={11} fill="#9AA4B4" textAnchor={k === 0 ? 'start' : k === ticks.length - 1 ? 'end' : 'middle'}>{t}</text>)}
            <line x1={X(i)} x2={X(i)} y1={0} y2={120} stroke="#fff" strokeOpacity={0.5} />
            <circle cx={X(i)} cy={Y(tr.sunEl[i])} r={6} fill="#FFB547" stroke="#fff" strokeWidth={2} />
          </svg>
        </div>
        <div className="split" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 14 }}>
          <div><div className="lbl">Sun bearing</div><div className="val num" style={{ fontSize: 18 }}>{tr.sunAz[i].toFixed(1)}°</div></div>
          <div><div className="lbl">Earth height</div><div className="val num" style={{ fontSize: 18 }}>{signed(tr.earthEl[i], 1)}°</div></div>
          <div><div className="lbl">{cdSun.label}</div><div className="val num" style={{ fontSize: 18, color: 'var(--h-sun)' }}>{cdSun.value}</div></div>
        </div>
        <div style={{ display: 'flex', gap: 3, marginTop: 14 }} aria-hidden="true">{stateSegments(ev).map((g, k) => <span key={k} className="seg" style={{ flex: g.to - g.from, background: g.state === 'both' ? '#4FDDB4' : g.state === 'sun' ? '#FFB547' : g.state === 'earth' ? '#4FA8FF' : '#3a414d' }} />)}</div>
      </div>

      <div className="panel" style={at(1140, 792, 420, 378)}>
        <div className="phead"><div><h3 className="title">Landing window</h3><div className="sub">Pick the start of a {s.settings.stayDays}-day stay</div></div></div>
        <svg viewBox={`0 0 ${LW} 200`} width="100%" style={{ display: 'block' }} role="group" aria-label="Landing dates">
          <defs>
            <pattern id="stripeSun" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#3a2a10" /><rect width="5" height="10" fill="#FFB547" /></pattern>
            <pattern id="stripeDark" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#2a0f0d" /><rect width="5" height="10" fill="#FF6E5E" /></pattern>
          </defs>
          <rect x={20} y={70} width={LW - 40} height={22} rx={11} fill="#1a1f28" />
          {days.map((d, k) => <rect key={k} x={dx(k)} y={70} width={dx(k + 1) - dx(k) + 0.5} height={22} fill={d.cls === 2 ? '#4FDDB4' : d.cls === 1 ? 'url(#stripeSun)' : 'url(#stripeDark)'} opacity={d.cls === 2 ? 0.85 : 1}
            style={{ cursor: 'pointer' }} onClick={() => { s.setLanding(d.startIndex); s.setT(d.startIndex); }}><title>{fmtDay(d.dayMs)}: {d.cls === 2 ? 'sunlight and Earth contact' : d.cls === 1 ? 'sunlight, too little contact' : 'dark spell during the stay'}</title></rect>)}
          {[0, Math.floor(nd / 3), Math.floor((2 * nd) / 3), nd].map((k, q, arr) => <text key={q} x={dx(k)} y={136} fontSize={11.5} fill="#9AA4B4" textAnchor={q === 0 ? 'start' : q === arr.length - 1 ? 'end' : 'middle'}>{fmtDay(s.fromMs + k * 86400e3)}</text>)}
          {[[0, 'M0 58 v-10 h12'], [bw, 'M0 58 v-10 h-12'], [0, 'M0 104 v8 h12'], [bw, 'M0 104 v8 h-12']].map(([o, d], k) => <path key={k} d={d as string} transform={`translate(${bx0 + (o as number)} 0)`} fill="none" stroke={anyFail ? '#FF6E5E' : '#fff'} strokeWidth={2.5} style={{ transition: 'transform .5s cubic-bezier(.16,1,.3,1)' }} />)}
          <text x={bx0 + bw / 2} y={166} textAnchor="middle" fontSize={13} fontWeight={600} fill={anyFail ? '#FF6E5E' : '#fff'}>{fmtDay(mc.startMs)} · {anyFail ? 'fails' : 'all pass'}</text>
          <g transform={`translate(${bx0 + bw / 2} 14)`} style={{ transition: 'transform .5s cubic-bezier(.16,1,.3,1)' }}><path d="M-10 14 l-6 8 M10 14 l6 8 M0 0 v-6" stroke="#EEF2F7" strokeWidth={1.8} fill="none" /><rect x={-10} y={0} width={20} height={14} rx={3} fill="#EEF2F7" /></g>
          {failMs != null && (() => { const fx = dx((failMs - s.fromMs) / 86400e3); return <g><circle cx={fx} cy={81} r={7} fill="#FF6E5E" /><circle cx={fx} cy={81} r={7} fill="none" stroke="#FF6E5E" strokeWidth={2} className="pulse" /></g>; })()}
          <text x={LW / 2} y={192} textAnchor="middle" fontSize={13} fill="#9AA4B4">{anyFail ? (mc.rules.find((r) => !r.holds)?.why ?? '') : `Sunlight all stay${mc.firstEarthMs != null ? ' · Earth ' + (mc.firstEarthMs === mc.startMs ? 'in view at landing' : 'rises after ' + fmtHours((mc.firstEarthMs - mc.startMs) / 3600e3)) : ''}`}</text>
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--mute)', marginTop: 6 }}>
          <span><span style={{ color: '#FFB547' }}>▮</span> Sunlit</span><span><span style={{ color: '#FF6E5E' }}>▮</span> Dark spell</span><span><span style={{ color: '#4FDDB4' }}>▮</span> Sun + Earth</span>
        </div>
      </div>


    </>
  );
}
