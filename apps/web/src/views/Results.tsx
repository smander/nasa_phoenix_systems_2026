// Results view (design system "ExampleResults"): Step 1 choose where to land, Step 2 everything for that point.
import { Fragment, useMemo, useState } from 'react';
import { Button, GlossaryTip, HonestyNote, HorizonRule, MonthBar, Panel, PickItem, QualityBadge, Readout, RuleRow, SegmentedControl, Slider, Terminal } from '../ds/components';
import { SkyHero } from '../ds/SkyHero';
import { laneRanges, timeAt } from '@core/analysis';
import { fmtClock, fmtDate, fmtDay, fmtHours, fmtLatLon, fmtShort, rangeTicks, signed } from '@core/format';
import { GLOSSARY } from '@core/glossary';
import type { SiteGroup } from '@core/types';
import { useStore } from '../state/store';
import type { Analysis } from '../state/useAnalysis';
import { GROUP_LABEL } from '../ui/AppBar';
import { PolarMap } from '../ui/PolarMap';

const G = (id: keyof typeof GLOSSARY, text?: string) => <GlossaryTip term={GLOSSARY[id].term} definition={GLOSSARY[id].definition}>{text || GLOSSARY[id].term.toLowerCase()}</GlossaryTip>;
const band = (v: number, good: number, poor: number) => (v >= good ? 'good' : v <= poor ? 'poor' : '');

export function verdict(sun: number, earth: number, darkH: number): { title: string; text: string } {
  if (sun >= 80 && earth >= 70) return { title: 'Excellent site', text: 'Sunlight and Earth contact for most of the period.' };
  if (sun >= 80) return { title: 'Great for power', text: `Sunlight almost all the time; Earth is in view ${Math.round(earth)}% of the period, so plan for gaps in direct contact.` };
  if (sun >= 50 && darkH <= 7 * 24) return { title: 'Good site for a short stay', text: `Plenty of sunlight and Earth contact most of the period, but one dark spell of about ${fmtHours(darkH)}.` };
  if (sun >= 50) return { title: 'Workable with care', text: `Sunlit about half the time, with a dark spell of ${fmtHours(darkH)}; time the landing carefully.` };
  return { title: 'Difficult site', text: `Long dark spells (up to ${fmtHours(darkH)}). Fine for science in shadow, hard for a solar-powered stay.` };
}

// ---------- Step 1 ----------
function Step1({ a }: { a: Analysis }) {
  const s = a.store;
  const groupOf = (id: string) => s.sites.find((x) => x.id === id)?.groups[0] || 'artemis-2024';
  const [group, setGroup] = useState<SiteGroup>(groupOf(s.selectedId));
  const counts = (g: SiteGroup) => s.sites.filter((x) => x.groups[0] === g).length;
  const list = s.sites.filter((x) => x.groups[0] === group);
  const groups: SiteGroup[] = ['artemis-2024', 'artemis-2022', 'reference', ...(counts('custom') ? ['custom' as SiteGroup] : [])];
  const tr = a.tracks;
  return (
    <section className="step1" aria-labelledby="s1-title">
      <div className="wrap">
        <div className="step-head">
          <span className="pw-eyebrow">Step 1 of 2</span>
          <h2 id="s1-title"><span className="step-no">1</span>Choose where to land</h2>
          <p className="lede">Pick a candidate landing point on the south pole map or from the list. Polar Window then works out sunlight, solar energy and Earth contact for that exact point, from NASA terrain data.</p>
        </div>
        <div className="pick-grid">
          <Panel title="South pole, seen from above" note="relief shading, not lighting"
            description={s.customBusy ? 'Computing the terrain horizon for your point…' : 'Click a marker to choose it, or click anywhere to analyse your own point (terrain from the 480 m elevation tile).'}>
            <PolarMap sites={s.sites} highlight={new Set(list.map((x) => x.id))} selectedId={s.selectedId} onSelect={(id) => { s.select(id); setGroup(groupOf(id)); }}
              onPick={(lat, lon) => { s.addCustom(lat, lon).then(() => setGroup('custom')); }}
              sunAz={tr ? tr.sunAz[a.t] : undefined} earthAz={tr ? tr.earthAz[a.t] : undefined} />
          </Panel>
          <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
            <SegmentedControl<SiteGroup> label="Point list" value={group} onChange={setGroup}
              options={groups.map((g) => ({ value: g, label: (g === 'artemis-2024' ? 'Artemis 2024' : g === 'artemis-2022' ? 'Artemis 2022' : g === 'reference' ? 'Reference' : 'Yours') + ' (' + counts(g) + ')' }))} />
            <span className="pw-eyebrow">{GROUP_LABEL[group]}</span>
            <div className="picklist" role="group" aria-label={GROUP_LABEL[group]}>
              {list.map((x) => {
                const m = a.all[x.id];
                return (
                  <PickItem key={x.id} name={x.name} quality={x.quality} source={x.quality === 'approximate' ? 'Digitised from a NASA map or an unofficial source; see notes' : undefined}
                    meta={`${fmtLatLon(x.lat, x.lonE)} · ${(x.elevM / 1000).toFixed(1)} km`}
                    sun={m ? m.sun : null} earth={m ? m.earth : null} segments={m?.segs} selected={x.id === s.selectedId}
                    onClick={() => s.select(x.id)} />
                );
              })}
            </div>
            <div className="pick-actions">
              <Button variant="primary" onClick={() => document.getElementById('analysis')?.scrollIntoView({ behavior: 'smooth' })}>See results for {a.site?.name} →</Button>
              <HonestyNote>coordinates: region centres from the NASA GSFC archive; ≈ = approximate</HonestyNote>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Step 2 pieces ----------
export function Bars({ data, max, color, label, unit, from }: { data: number[]; max: number; color: string; label: string; unit: string; from: number }) {
  const W = 310, H = 96, n = data.length, bw = W / Math.max(1, n);
  const ticks: [number, string][] = [[0, fmtDay(from)], [Math.floor(n / 2), fmtDay(from + Math.floor(n / 2) * 86400e3)], [n - 1, fmtDay(from + (n - 1) * 86400e3)]];
  return (
    <div className="bars">
      <svg viewBox={`0 -10 ${W} ${H + 26}`} role="img" aria-label={label}>
        {[0, 0.5, 1].map((k) => <line key={k} x1={0} x2={W} y1={H - k * (H - 6)} y2={H - k * (H - 6)} stroke="var(--line)" />)}
        <text x={0} y={-2} fill="var(--muted)" fontSize={8} fontFamily="var(--font-text)">{max.toFixed(max < 10 ? 1 : 0)} {unit}</text>
        {data.map((v, i) => {
          const hh = (v / max) * (H - 6), x = i * bw + 0.5, w = Math.max(1, bw - 2);
          return v <= 0.001 ? <rect key={i} x={x} y={H - 2} width={w} height={2} fill="var(--muted)" />
            : <rect key={i} x={x} y={H - hh} width={w} height={hh} rx={1.5} fill={color} style={{ transformOrigin: `${x + w / 2}px ${H}px`, animation: 'pw-grow var(--dur-slow) var(--ease-out) both', animationDelay: i * 12 + 'ms' }} />;
        })}
        {ticks.map(([i, t], k) => <text key={k} x={k === 0 ? 0 : k === 2 ? W : i * bw + bw / 2} y={H + 13} fill="var(--muted)" fontSize={8} fontFamily="var(--font-text)" textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}>{t}</text>)}
      </svg>
    </div>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div style={{ maxHeight: 240, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
        <thead><tr>{head.map((h) => <th key={h} style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--muted)', borderBottom: '1px solid var(--line-2)' }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ padding: '4px 6px', borderBottom: '1px solid var(--line)' }}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function Battery({ battery, cap, startMs, endMs }: { battery: Float32Array; cap: number; startMs: number; endMs: number }) {
  const W = 520, H = 90, n = battery.length, lo = -Math.max(6, cap * 0.25), hi = Math.max(1, cap);
  const y = (v: number) => H - 14 - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (H - 24);
  const pts = Array.from(battery, (v, i) => ((i / Math.max(1, n - 1)) * W).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const empties = Array.from(battery).some((v) => v < 0);
  return (
    <div className="battery">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={empties ? 'Battery runs out during the stay' : 'Battery reserve stays above empty for the whole stay'}>
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--poor)" strokeDasharray="4 3" />
        <text x={W} y={y(0) - 4} fill="var(--poor)" fontSize={10} fontFamily="var(--font-mono)" textAnchor="end">empty</text>
        <polyline points={pts} fill="none" stroke={empties ? 'var(--poor)' : 'var(--earth)'} strokeWidth={2} strokeLinejoin="round" style={{ strokeDasharray: 1400, animation: 'pw-draw var(--dur-slow) var(--ease-out) both', ['--len' as string]: 1400 }} />
        <text x={0} y={H - 2} fill="var(--muted)" fontSize={10} fontFamily="var(--font-mono)">Land {fmtShort(startMs)}</text>
        <text x={W} y={H - 2} fill="var(--muted)" fontSize={10} fontFamily="var(--font-mono)" textAnchor="end">Lift-off {fmtShort(endMs)}</text>
      </svg>
    </div>
  );
}

export function SplCode({ tokens }: { tokens: { text: string; kind?: string }[] }) {
  return <>{tokens.map((t, i) => (t.kind ? <span key={i} className={t.kind}>{t.text}</span> : <Fragment key={i}>{t.text}</Fragment>))}</>;
}

// ---------- Step 2 ----------
function Step2({ a }: { a: Analysis }) {
  const s = a.store, site = a.site!, m = a.m!, tr = a.tracks!, ev = a.ev!, i = a.t, mission = a.mission!;
  const st = s.settings;
  const v = verdict(m.sunPct, m.earthPct, m.longestDarkH);
  const prof = a.profile;
  const periodLabel = s.preset === 'jan2027' ? 'January 2027' : `${fmtDate(s.fromMs)} – ${fmtDate(s.toMs)}`;
  const ticks = rangeTicks(s.fromMs, timeAt(a.grid, a.grid.n - 1));
  const winFrac: [number, number] = [mission.mc.startIndex / (a.grid.n - 1), mission.mc.endIndex / (a.grid.n - 1)];
  const failures = mission.mc.rules.filter((r) => !r.holds && r.firstFailMs != null).map((r) => (r.firstFailMs! - mission.mc.startMs) / (mission.mc.endMs - mission.mc.startMs));
  const compareSites = s.compareIds.map((id) => s.sites.find((x) => x.id === id)).filter(Boolean) as typeof s.sites;
  if (!compareSites.some((x) => x.id === site.id)) compareSites.unshift(site);
  const [sort, setSort] = useState<'sun' | 'earth' | 'both' | 'dark'>('sun');
  const ranked = useMemo(() => compareSites.slice().sort((x, y) => {
    const A = a.all[x.id], B = a.all[y.id];
    if (!A || !B) return 0;
    return sort === 'dark' ? A.dark - B.dark : B[sort] - A[sort];
  }), [compareSites, a.all, sort]);
  const mast10 = st.mastM < 10;
  const sunState = ev.sunUp[i] ? 'Visible' : 'Hidden', earthState = ev.earthUp[i] ? 'Visible' : 'Hidden';
  const sunClear = tr.sunEl[i] - ev.maskSun[i], earthClear = tr.earthEl[i] - ev.maskEarth[i];
  const dir = (az: number) => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(az / 45) % 8];
  const days = mission.days;
  const selDay = Math.floor((mission.mc.startIndex * a.grid.stepMin) / 1440);
  const anyFail = mission.mc.rules.some((r) => !r.holds);
  const badDay = days.find((d, k) => d.cls === 0 && k > selDay) ?? days.find((d) => d.cls === 0), goodDay = days.find((d) => d.cls === 2);

  return (
    <main className="wrap" id="analysis">
      <div className="step-head">
        <span className="pw-eyebrow">Step 2 of 2: Results</span>
        <h2><span className="step-no">2</span>{site.name}<QualityBadge quality={site.quality} source={site.notes} /></h2>
        <div className="sub">
          <span>{site.groups[0] === 'custom' ? 'Your point' : GROUP_LABEL[site.groups[0]]}</span>
          <span>Location <b>{fmtLatLon(site.lat, site.lonE)}</b></span>
          <span>Height <b>{signed(site.elevM / 1000, 2)} km</b></span>
          <span>{periodLabel}</span>
          {!prof && <span className="poor">Terrain unavailable: flat horizon used</span>}
          {prof && prof.coverage < 0.98 && <span>Terrain covers {Math.round(prof.coverage * 100)}% of sight lines</span>}
        </div>
      </div>

      <div className="summary">
        <div><span className="k">In short</span><span className="verdict">{v.title}</span><p>{v.text}</p></div>
        <div><span className="k">Sunlight</span><span className="v" style={{ color: 'var(--sun)' }}>{Math.round(m.sunPct)}%</span><p>of {s.preset === 'jan2027' ? 'January' : 'the period'}</p></div>
        <div><span className="k">Earth in view (radio)</span><span className="v" style={{ color: 'var(--earth)' }}>{Math.round(m.earthPct)}%</span><p>of {s.preset === 'jan2027' ? 'January' : 'the period'}</p></div>
        <div><span className="k">Longest darkness</span><span className="v">{fmtHours(m.longestDarkH)}</span><p>{m.longestDarkH > 0 ? 'battery must cover this' : 'the Sun never sets behind terrain'}</p></div>
      </div>

      <p className="teach" style={{ marginBottom: 16 }}>The Moon has no air, so its sky stays black even with the Sun up. At the south pole the Sun never climbs more than about 1.5° and circles the horizon once every 29.5 days, so a small ridge can hide it for days. Earth hangs in almost the same spot but bobs up and down with {G('libration')}; that is why {G('dte', 'direct-to-Earth radio')} comes and goes.</p>

      <SkyHero siteName={site.name} grid={a.grid} tracks={tr} ev={ev} mask={a.mask!} t={i} onTime={(t) => { s.setPlaying(false); s.setT(t); }}
        playing={s.playing} onPlay={() => s.setPlaying(!s.playing)} window={s.mode === 'plan' ? winFrac : undefined}
        ticks={ticks} dateLabel={fmtDate(a.nowMs)} timeLabel={fmtClock(a.nowMs)} observerM={st.mastM} height={340} />

      <div className="readrow">
        <div className="pw-readouts">
          <Readout label="Sun height" value={+tr.sunEl[i].toFixed(1)} decimals={1} signed suffix="°" unit="above horizon" state={sunState} tone={ev.sunUp[i] ? 'sun' : 'none'}
            caption={`${sunClear >= 0 ? `Clears the skyline to the ${dir(tr.sunAz[i])} by ${sunClear.toFixed(2)}°.` : ev.sunUp[i] ? `Peeking over the ridge to the ${dir(tr.sunAz[i])}: part of the disc is visible.` : `Behind the ridge to the ${dir(tr.sunAz[i])} by ${Math.abs(sunClear).toFixed(2)}°.`} Solar panels get ${Math.round(ev.powerW[i])} W/m² right now.`} />
          <Readout label="Earth height" value={+tr.earthEl[i].toFixed(1)} decimals={1} signed suffix="°" unit="above horizon" state={earthState} tone={ev.earthUp[i] ? 'earth' : 'none'}
            caption={`${earthClear >= 0 ? 'Clear line of sight' : ev.earthUp[i] ? 'Partly above the skyline' : 'Blocked by terrain'} to the ${dir(tr.earthAz[i])}. Earth is ${Math.round(tr.earthLit[i] * 100)}% lit and ${Math.round(tr.earthKm[i]).toLocaleString('en-US')} km away.`} />
          <Readout label="Solar power" value={Math.round(m.meanPowerW)} unit="W/m²"
            caption={`Average over the period. ${Math.round(m.energyKWh)} kWh per m²${m.areaFor10kWm2 ? `; ${Math.round(m.areaFor10kWm2)} m² of panels give 10 kW` : ''}.`} />
          <Readout label="Camera / mast height" value={st.mastM} unit="m" animate={false}
            caption={mast10 ? 'Raise the mast to see over nearby terrain; vertical solar masts reach 10–20 m.' : 'A tall mast sees over more of the nearby terrain.'}>
            <input type="range" min={0} max={50} step={1} value={st.mastM} aria-label="Camera or mast height in metres" onChange={(e) => s.setSettings({ mastM: +e.target.value })} />
          </Readout>
        </div>
      </div>

      <section className="section" aria-labelledby="day-title">
        <div className="section-head"><div><h3 id="day-title">Day by day</h3><p>Power and Earth contact for each day of {periodLabel.toLowerCase().startsWith('january') ? 'January 2027' : 'the period'}.</p></div></div>
        <div className="two">
          <Panel title="Solar energy per day" description={`Best day ${Math.max(0, ...m.dailyKWh).toFixed(1)} kWh/m². ${m.dailyKWh.filter((x) => x < 0.001).length ? m.dailyKWh.filter((x) => x < 0.001).length + ' days with no sunlight at all.' : 'Every day has some sunlight.'}`}
            note="Assumes upright panels that turn to face the Sun, 30% efficient"
            table={<DataTable head={['Day', 'kWh/m²']} rows={m.dailyKWh.map((x, d) => [fmtDay(s.fromMs + d * 86400e3), x.toFixed(2)])} />}>
            <Bars data={m.dailyKWh} max={Math.max(1, ...m.dailyKWh)} color="var(--sun)" label="Solar energy per day" unit="kWh/m²" from={s.fromMs} />
          </Panel>
          <Panel title="Earth-contact hours per day" description={`Earth in view ${Math.round(m.earthPct)}% of the time; longest gap ${fmtHours(m.longestGapH)}.`}
            note="Visible means line of sight; a ground station still has to be pointing at the Moon"
            table={<DataTable head={['Day', 'Hours']} rows={m.dailyContactH.map((x, d) => [fmtDay(s.fromMs + d * 86400e3), x.toFixed(0)])} />}>
            <Bars data={m.dailyContactH} max={24} color="var(--earth)" label="Earth-contact hours per day" unit="h" from={s.fromMs} />
          </Panel>
        </div>
      </section>

      <HorizonRule />

      <section className="section" aria-labelledby="rank-title">
        <div className="section-head">
          <div><h3 id="rank-title">Ranking</h3><p>How the points you are comparing do over the same period. Green numbers are strong, red are weak. The point you are viewing always joins the list.</p></div>
          <div className="pw-key"><span><i style={{ background: 'var(--both)' }} />Power and contact</span><span><i style={{ background: 'var(--sun)' }} />Power only</span><span><i style={{ background: 'var(--earth)' }} />Contact only</span><span><i className="none" />Blackout</span></div>
        </div>
        <div role="table" aria-label="Ranking">
          <div className="cmp-row th" role="row">
            <span className="pw-eyebrow" style={{ textAlign: 'left' }}>Landing point</span>
            <span className="pw-eyebrow hide-sm" style={{ textAlign: 'left' }}>{s.preset === 'jan2027' ? 'January at a glance' : 'Period at a glance'}</span>
            {(['sun', 'earth', 'both', 'dark'] as const).map((k) => (
              <button key={k} type="button" className={k === 'both' ? 'hide-md hide-sm' : k === 'dark' ? 'hide-md hide-sm' : ''} aria-pressed={sort === k} onClick={() => setSort(k)}>
                {{ sun: 'Sunlight', earth: 'Earth', both: 'Both', dark: 'Darkest' }[k]}{sort === k ? ' ↓' : ''}
              </button>
            ))}
            <span className="hide-sm" />
          </div>
          {ranked.map((x) => {
            const r = a.all[x.id];
            if (!r) return null;
            return (
              <div key={x.id} role="row" tabIndex={0} className={'cmp-row' + (x.id === site.id ? ' sel' : '')} onClick={() => s.select(x.id)} onKeyDown={(e) => { if (e.key === 'Enter') s.select(x.id); }}>
                <div className="cmp-name">{x.name}<small>{x.groups[0] === 'custom' ? 'Your point' : x.groups[0] === 'reference' ? 'Reference point' : x.groups.includes('artemis-2024') && x.groups.includes('artemis-2022') ? 'Artemis region (2022 & 2024)' : x.groups[0] === 'artemis-2024' ? 'Artemis region (2024)' : 'Artemis region (2022)'}</small></div>
                <MonthBar segments={r.segs} playhead={x.id === site.id ? i / (a.grid.n - 1) : undefined} label={x.name} />
                <div className={'cmp-val ' + band(r.sun, 90, 40)}>{Math.round(r.sun)}%</div>
                <div className={'cmp-val ' + band(r.earth, 70, 40)}>{Math.round(r.earth)}%</div>
                <div className={'cmp-val hide-md hide-sm ' + band(r.both, 50, 10)}>{Math.round(r.both)}%</div>
                <div className={'cmp-val hide-md hide-sm ' + (r.dark === 0 ? 'good' : r.dark > 240 ? 'poor' : '')}>{fmtHours(r.dark)}</div>
                <button type="button" className="icon-btn hide-sm" aria-label={'Remove ' + x.name + ' from the ranking'} onClick={(e) => { e.stopPropagation(); s.toggleCompare(x.id); }}>×</button>
              </div>
            );
          })}
        </div>
        {!s.compareIds.includes(site.id) && <Button variant="quiet" className="compare-toggle" onClick={() => s.toggleCompare(site.id)} disabled={s.compareIds.length >= 8} title={s.compareIds.length >= 8 ? 'Up to 8 points can be compared' : undefined}>Keep {site.name} in the ranking</Button>}
      </section>

      <HorizonRule litFrom={0.55} litTo={0.8} />

      <section className="section plan-only" aria-labelledby="mission-title">
        <div className="section-head"><div><h3 id="mission-title">Mission check</h3><p>Choose when to land. We check five mission rules for the whole stay and show which pass, using a {G('saple', 'SAPLE')} model of the stay.</p></div></div>
        <div className="controls">
          <div className="pw-field"><span className="pw-eyebrow">How long you stay</span>
            <SegmentedControl<number> label="Stay length" value={st.stayDays} onChange={(d) => s.setSettings({ stayDays: d })} options={[{ value: 6.5, label: '6.5 days' }, { value: 10, label: '10 days' }, { value: 14, label: '14 days' }]} />
          </div>
          <Slider label="Battery lasts (hours of darkness)" min={0} max={120} step={2} value={st.reserveH} unit="h" onChange={(n) => s.setSettings({ reserveH: n })} />
          <Slider label="Earth contact needed (share of stay)" min={0} max={100} step={5} value={st.goPct} unit="%" onChange={(n) => s.setSettings({ goPct: n })} />
        </div>
        <div className="pw-field">
          <span className="pw-eyebrow">Landing day (click to choose)</span>
          <div className="strip" role="group" aria-label="Landing dates" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map((d, k) => (
              <button key={k} type="button" aria-pressed={k === selDay} className={d.cls === 0 ? 'dark' : undefined}
                title={fmtDay(d.dayMs) + ' — ' + (d.cls === 2 ? 'sunlight and Earth contact' : d.cls === 1 ? 'sunlight, too little Earth contact' : 'dark spell during the stay')}
                style={{ background: d.cls === 0 ? 'repeating-linear-gradient(45deg, var(--line-2) 0 1.5px, var(--none) 1.5px 5px)' : d.cls === 2 ? 'var(--both)' : 'var(--sun)' }}
                onClick={() => { s.setLanding(d.startIndex); s.setT(d.startIndex); }}>
                {days.length <= 40 ? new Date(d.dayMs).getUTCDate() : ''}
              </button>
            ))}
          </div>
          <div className="pw-key">
            <span><i style={{ background: 'var(--both)' }} />Sunlight and Earth contact</span><span><i style={{ background: 'var(--sun)' }} />Sunlight, too little contact</span><span><i className="none" />Dark spell during the stay</span>
            <span style={{ marginLeft: 'auto', color: 'var(--fg)' }}>{anyFail ? (goodDay ? `Tip: choose ${fmtDay(goodDay.dayMs)} to see every rule pass` : '') : badDay ? `Tip: choose ${fmtDay(badDay.dayMs)} to see what a failure looks like` : ''}</span>
          </div>
        </div>
        <div className="mission">
          <div className="pw-stack">
            <Panel title={`Mission window · ${fmtShort(mission.mc.startMs)} → ${fmtShort(mission.mc.endMs)} UTC`}>
              <MonthBar lanes={{ sun: laneRanges(ev.sunUp, mission.mc.startIndex, mission.mc.endIndex), earth: laneRanges(ev.earthUp, mission.mc.startIndex, mission.mc.endIndex) }}
                violations={failures} ticks={[[0, 'Landing'], [0.5, 'Day ' + (st.stayDays / 2).toFixed(st.stayDays % 2 ? 2 : 0).replace(/\.?0+$/, '')], [1, 'Lift-off']]} label="Sun and Earth during the stay" />
              {mission.mc.longestDarkH > 0
                ? <Battery battery={mission.mc.battery} cap={st.reserveH} startMs={mission.mc.startMs} endMs={mission.mc.endMs} />
                : <p>Sunlight the whole time.{mission.mc.firstEarthMs != null ? ` Earth ${mission.mc.firstEarthMs === mission.mc.startMs ? 'is in view at landing' : 'rises ' + fmtHours((mission.mc.firstEarthMs - mission.mc.startMs) / 3600e3) + ' after landing'}, so radio contact covers ${Math.round(mission.mc.coveragePct)}% of the stay.` : ' Earth never comes into view.'} The battery is never needed.</p>}
            </Panel>
            <div className="pw-rules">
              {mission.mc.rules.map((r) => (
                <RuleRow key={r.id} title={r.title} name={r.id} expr={r.expr} kind={r.kind} verdict={r.holds ? 'holds' : 'violated'} at={r.firstFailMs != null ? fmtShort(r.firstFailMs) : undefined} why={r.why} showTech={s.mode === 'plan'} />
              ))}
            </div>
          </div>
          <Terminal collapsed summary="Show the formal proof" summaryNote=" — SAPLE model and output" title={mission.fileName} typeOn runKey={mission.start + ':' + st.reserveH + ':' + st.goPct + ':' + st.stayDays} preview
            code={<SplCode tokens={mission.spl} />} output={mission.output} />
          <HonestyNote>preview: verdicts are computed in this page from the same hourly data; SAPLE run pending</HonestyNote>
        </div>
      </section>

      <footer className="foot">
        <span>Sun &amp; Earth: astronomy-engine 2.1.19 · terrain: NASA LRO LOLA {prof?.source === 'lola480' ? '480 m tile' : '240 m'} · all times UTC · Earth visible = line of sight, not a ground-station pass</span>
        <HonestyNote>≤ 0.01° vs JPL Horizons (0.002° typical)</HonestyNote>
      </footer>
    </main>
  );
}

export function ResultsView({ a }: { a: Analysis }) {
  return (<><Step1 a={a} />{a.site && a.m && a.mission && <Step2 a={a} />}</>);
}
