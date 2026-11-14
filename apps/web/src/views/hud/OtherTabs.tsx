// HUD tabs "Sky", "Sites" and "Check": the same glass panels, laid out in flow below the top bar.
import { useState } from 'react';
import { HonestyNote, MonthBar, Readout, RuleRow, Slider, Terminal } from '../../ds/components';
import { SkyHero } from '../../ds/SkyHero';
import { countdowns, laneRanges, timeAt } from '@core/analysis';
import { fmtClock, fmtCountdown, fmtDate, fmtDay, fmtHours, fmtLatLon, fmtShort, rangeTicks } from '@core/format';
import type { SiteGroup } from '@core/types';
import type { Analysis } from '../../state/useAnalysis';
import { PolarMap } from '../../ui/PolarMap';
import { NeuralPanel } from './NeuralPanel';
import { compareWithRuleCheck, sapleOutputLines, seriousWarnings } from '@core/spl';
import { useSapleLive, useSapleReport } from '../../state/useSaple';
import type { SapleLive, SapleReport } from '../../state/useSaple';
import { MoonMap } from '../../ui/MoonMap';
import { parseCoord } from '@core/coords';
import { IllumInset, RADIUS_KM, useBestNearby } from '../../ui/IllumInset';
import type { MapLayer } from '@core/illum';
import { Bars, Battery, SplCode, verdict } from '../Results';

const grid = (cols: string, gap = 18) => ({ display: 'grid', gridTemplateColumns: cols, gap } as const);

export function SkyTab({ a }: { a: Analysis }) {
  const s = a.store, site = a.site!, tr = a.tracks!, ev = a.ev!, m = a.m!, i = a.t, mission = a.mission!;
  const v = verdict(m.sunPct, m.earthPct, m.longestDarkH);
  const cd = countdowns(ev, a.grid, s.t), cdSun = fmtCountdown(cd.sun, 'Sun'), cdEarth = fmtCountdown(cd.earth, 'Earth');
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="panel">
        <div className="phead"><div><h3 className="title">Lunar sky · {site.name}</h3><div className="sub">{v.title}. {v.text}</div></div><span className="live">Drag the timeline or press play</span></div>
        <SkyHero siteName={site.name} grid={a.grid} tracks={tr} ev={ev} mask={a.mask!} t={i} onTime={(t) => { s.setPlaying(false); s.setT(t); }}
          playing={s.playing} onPlay={() => s.setPlaying(!s.playing)} window={[mission.mc.startIndex / (a.grid.n - 1), mission.mc.endIndex / (a.grid.n - 1)]}
          ticks={rangeTicks(s.fromMs, timeAt(a.grid, a.grid.n - 1))} dateLabel={fmtDate(a.nowMs)} timeLabel={fmtClock(a.nowMs)} observerM={s.settings.mastM} height={420} siteLat={site.lat} siteLon={site.lonE} />
      </div>
      <div className="panel" style={{ padding: '6px 18px' }}>
        <div className="pw-readouts tab-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))', padding: '18px 0 20px' }}>
          <Readout label="Sun height" value={+tr.sunEl[i].toFixed(1)} decimals={1} signed suffix="°" unit="above horizon" state={ev.sunUp[i] ? 'Visible' : 'Hidden'} tone={ev.sunUp[i] ? 'sun' : 'none'} caption={`${cdSun.label}${cdSun.value !== '—' ? ' ' + cdSun.value : ''}. Toward ${tr.sunAz[i].toFixed(0)}°; the skyline there is at ${ev.maskSun[i].toFixed(2)}°. Panels: ${Math.round(ev.powerW[i])} W/m².`} />
          <Readout label="Earth height" value={+tr.earthEl[i].toFixed(1)} decimals={1} signed suffix="°" unit="above horizon" state={ev.earthUp[i] ? 'Visible' : 'Hidden'} tone={ev.earthUp[i] ? 'earth' : 'none'} caption={`${cdEarth.label}${cdEarth.value !== '—' ? ' ' + cdEarth.value : ''}. ${Math.round(tr.earthLit[i] * 100)}% lit, ${Math.round(tr.earthKm[i]).toLocaleString('en-US')} km away. Line of sight, not a ground-station pass.`} />
          <Readout label="Solar power" value={Math.round(m.meanPowerW)} unit="W/m²" caption={`Average. ${Math.round(m.energyKWh)} kWh per m² over the period.`} />
          <Readout label="Camera / mast height" value={s.settings.mastM} unit="m" animate={false} caption="Raise it to see over nearby terrain.">
            <input type="range" min={0} max={50} value={s.settings.mastM} aria-label="Camera or mast height in metres" onChange={(e) => s.setSettings({ mastM: +e.target.value })} />
          </Readout>
        </div>
      </div>
      <div className="tab-grid" style={grid('1fr 1fr')}>
        <div className="panel"><div className="phead"><h3 className="title">Solar energy per day</h3><span className="live">kWh/m² · vertical array 30%</span></div>
          <Bars data={m.dailyKWh} max={Math.max(1, ...m.dailyKWh)} color="var(--sun)" label="Solar energy per day" unit="kWh/m²" from={s.fromMs} /></div>
        <div className="panel"><div className="phead"><h3 className="title">Earth contact per day</h3><span className="live">hours · line of sight</span></div>
          <Bars data={m.dailyContactH} max={24} color="var(--earth)" label="Earth-contact hours per day" unit="h" from={s.fromMs} /></div>
      </div>
    </div>
  );
}

export function SitesTab({ a }: { a: Analysis }) {
  const s = a.store, tr = a.tracks;
  const groupOf = (id: string) => s.sites.find((x) => x.id === id)?.groups[0] || 'artemis-2024';
  const [group, setGroup] = useState<SiteGroup>(groupOf(s.selectedId));
  const groups: [SiteGroup, string][] = [['artemis-2024', 'Artemis Oct 2024'], ['artemis-2022', 'Artemis Aug 2022'], ['clps', 'CLPS'], ['apollo', 'Apollo'], ['international', 'Other nations'], ['reference', 'Reference'], ['custom', 'Your points']];
  const list = s.sites.filter((x) => x.groups[0] === group);
  const [layer, setLayer] = useState<MapLayer>('relief');
  const polarGroup = (g: SiteGroup) => g === 'artemis-2024' || g === 'artemis-2022' || g === 'reference';
  const [map, setMap] = useState<'pole' | 'moon'>(a.site && a.site.lat > -78 ? 'moon' : 'pole');
  const chooseGroup = (g: SiteGroup) => { setGroup(g); if (g !== 'custom') setMap(polarGroup(g) ? 'pole' : 'moon'); };
  const [latT, setLatT] = useState(''), [lonT, setLonT] = useState(''), [nameT, setNameT] = useState(''), [formErr, setFormErr] = useState<string | null>(null);
  const analyse = (lat: number, lon: number, name?: string) => { s.addCustom(lat, lon, name).then(() => setGroup('custom')); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = parseCoord(latT, lonT);
    if ('error' in r) { setFormErr(r.error); return; }
    setFormErr(null); analyse(r.lat, r.lonE, nameT);
  };
  const near = useBestNearby(a.site);
  const LAYERS: [MapLayer, string][] = [['relief', 'Relief'], ['sun', 'Sunlight'], ['earth', 'Earth in view'], ['psr', 'Permanent shadow']];
  return (
    <div className="tab-grid" style={grid('minmax(0, 1fr) minmax(0, 1fr)')}>
      <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
      <div className="panel">
        <div className="phead"><div><h3 className="title">{map === 'pole' ? 'South pole map' : 'Whole Moon'}</h3><div className="sub">{s.customBusy ? 'Computing the terrain horizon for your point…' : 'Click a marker, or anywhere to analyse your own point.'}</div></div>
          <div className="opt" role="group" aria-label="Map" style={{ display: 'flex', gap: 6 }}><button type="button" aria-pressed={map === 'pole'} onClick={() => setMap('pole')}>South pole</button><button type="button" aria-pressed={map === 'moon'} onClick={() => setMap('moon')}>Whole Moon</button></div></div>
        {map === 'moon' ? <MoonMap sites={s.sites} highlight={new Set(list.map((x) => x.id))} selectedId={s.selectedId} onSelect={(id) => s.select(id)} onPick={(lat, lon) => analyse(lat, lon)} /> : <>
        <PolarMap sites={s.sites} highlight={new Set(list.map((x) => x.id))} selectedId={s.selectedId} onSelect={(id) => s.select(id)} layer={layer}
          mark={near.best && near.best.km > 0.1 ? { lat: near.best.lat, lonE: near.best.lonE, label: `Best spot within ${RADIUS_KM} km` } : null}
          onPick={(lat, lon) => analyse(lat, lon)} sunAz={tr ? tr.sunAz[a.t] : undefined} earthAz={tr ? tr.earthAz[a.t] : undefined} />
        <div className="opt" role="group" aria-label="Map layer" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {LAYERS.map(([l, t]) => <button key={l} type="button" aria-pressed={layer === l} onClick={() => setLayer(l)}>{t}</button>)}
        </div>
        <div className="map-legend">{layer === 'relief' ? <span>Relief shading shows the shape of the terrain, not its lighting.</span>
          : layer === 'psr' ? <span><i className="sw" style={{ background: '#7A5CFF' }} /> Never sees the Sun (NASA LOLA permanently shadowed regions)</span>
          : <><span>0%</span><i className={'ramp ' + layer} /><span>100%</span><span className="sub">{layer === 'sun' ? 'of the time the Sun is visible' : 'of the time Earth is visible'}, NASA LOLA long-term average at ground level</span></>}</div>
        </>}
        <form className="coord-form" onSubmit={submit} noValidate>
          <label><span className="lbl">Latitude</span><input value={latT} onChange={(e) => setLatT(e.target.value)} placeholder="-84.5 or 84.5 S" inputMode="decimal" aria-invalid={!!formErr} /></label>
          <label><span className="lbl">Longitude</span><input value={lonT} onChange={(e) => setLonT(e.target.value)} placeholder="29.2 or 29.2 E" inputMode="decimal" aria-invalid={!!formErr} /></label>
          <label><span className="lbl">Name (optional)</span><input value={nameT} onChange={(e) => setNameT(e.target.value)} placeholder="My site" /></label>
          <button type="submit" className="chip" disabled={s.customBusy}><b>{s.customBusy ? 'Working…' : 'Analyse'}</b></button>
          <span className="sub coord-msg" role="status" aria-live="polite" style={formErr ? { color: '#FF6E5E' } : undefined}>{formErr ?? 'Any point on the Moon. Terrain: 240–480 m near the south pole, ~1.9 km elsewhere.'}</span>
        </form>
      </div>
      <div className="panel">
        <div className="phead"><div><h3 className="title">Small moves, big changes</h3><div className="sub">{a.site?.name} · NASA long-term averages within 18 km</div></div></div>
        {a.site && <IllumInset site={a.site} layer={layer === 'earth' ? 'earth' : 'sun'} best={near.best} inset={near.inset} />}
      </div>
      </div>
      <div className="panel">
        <div className="phead"><h3 className="title">Landing points</h3><span className="live">{list.length} points</span></div>
        <div className="opt" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {groups.filter(([g]) => g !== 'custom' || s.sites.some((x) => x.groups[0] === 'custom')).map(([g, l]) => <button key={g} type="button" aria-pressed={g === group} onClick={() => chooseGroup(g)}>{l}</button>)}
        </div>
        <div style={{ maxHeight: 720, overflow: 'auto' }}>
          {list.map((x) => { const r = a.all[x.id]; const inCmp = s.compareIds.includes(x.id); return (
            <div key={x.id} className={'row' + (x.id === s.selectedId ? ' sel' : '')} style={{ gridTemplateColumns: '1fr 64px 64px auto' }}>
              <button type="button" onClick={() => s.select(x.id)} style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }}>
                <b style={{ fontWeight: 600 }}>{x.name}</b>{x.quality === 'approximate' && <span className="m"> ≈ approx.</span>}
                <span className="m" style={{ display: 'block' }}>{fmtLatLon(x.lat, x.lonE)} · {(x.elevM / 1000).toFixed(1)} km</span>
              </button>
              <span className="num" style={{ color: '#FFB547' }}>☀ {r ? Math.round(r.sun) : '…'}%</span>
              <span className="num" style={{ color: '#4FA8FF' }}>◐ {r ? Math.round(r.earth) : '…'}%</span>
              <button type="button" className="toggle" onClick={() => s.toggleCompare(x.id)} disabled={!inCmp && s.compareIds.length >= 8} title={!inCmp && s.compareIds.length >= 8 ? 'Up to 8 points can be compared' : undefined} style={{ cursor: 'pointer', padding: '4px 10px' }}>{inCmp ? 'On dashboard' : '+ Dashboard'}</button>
            </div>); })}
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="chip" onClick={() => s.setTab('mission')}><b>Open {a.site?.name} on the dashboard →</b></button>
          <span className="sub">Artemis regions: centres from the NASA GSFC archive. Landers: published landing coordinates. ≈ = approximate. Each site lists its source in the notes.</span>
        </div>
      </div>
    </div>
  );
}

/** What stands behind the verdicts in the SAPLE terminal: a real run on this machine, or the page's own check. */
function sapleNote(live: SapleLive, report: SapleReport | null, cmp: ReturnType<typeof compareWithRuleCheck> | null, rules: { id: string; title: string }[], point: string): string {
  const engine = live.version ?? 'saple';
  if (live.status === 'done' && live.reading && cmp) {
    const by = `Run by ${engine} on this machine in ${live.ms} ms, on the model for ${point}.`;
    if (!live.reading.complete) return by + ' The walk did not reach lift-off, so these verdicts cannot be trusted.';
    const off = cmp.filter((c) => !c.sameVerdict || !c.sameHour).map((c) => rules.find((r) => r.id === c.id)!.title);
    if (off.length) return by + ' SAPLE and the direct calculation differ on: ' + off.join('; ') + '. Treat this mission as unverified.';
    const serious = seriousWarnings(live.warnings ?? []);
    const warn = serious.length ? ' SAPLE warned: ' + serious.join(' ') : '';
    return by + ` It agrees with the direct calculation on all ${cmp.length} rules and on the hour of every failure.` + warn;
  }
  if (live.status === 'running') return 'Running ' + engine + ' on this machine…';
  if (live.status === 'error') return `${engine} failed on this machine (${live.error}). The verdicts shown are the page’s own.`;
  const head = 'preview: verdicts computed in this page from the same hourly data. The SAPLE engine itself runs locally (npm run saple).';
  if (!report) return head;
  const clean = report.allRulesSame === report.missions && !report.incomplete && !report.withWarnings && !report.failedRuns;
  return head + ` On ${fmtDate(Date.parse(report.date))}, ${report.saple.version} checked ${report.missions.toLocaleString('en-US')} missions at all ${report.sites} sites and `
    + (clean ? 'matched the direct calculation on every rule and every failure hour.' : `matched the direct calculation on ${report.allRulesSame.toLocaleString('en-US')} of them.`);
}

export function CheckTab({ a }: { a: Analysis }) {
  const s = a.store, ev = a.ev!, mission = a.mission!, st = s.settings, mc = mission.mc;
  const days = mission.days, selDay = Math.floor((mc.startIndex * a.grid.stepMin) / 1440);
  const failures = mc.rules.filter((r) => !r.holds && r.firstFailMs != null).map((r) => (r.firstFailMs! - mc.startMs) / (mc.endMs - mc.startMs));
  const live = useSapleLive(mission.source, mission.fileName), report = useSapleReport();
  const real = live.status === 'done' && live.reading ? live.reading : null;
  return (
    <div className="tab-grid" style={grid('minmax(0, 1.1fr) minmax(0, 1fr)')}>
      <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
        <div className="panel">
          <div className="phead"><div><h3 className="title">Mission check · {a.site?.name}</h3><div className="sub">Five rules checked for the whole stay with a SAPLE model of it.</div></div></div>
          <div className="tab-grid" style={grid('repeat(3, minmax(0, 1fr))')}>
            <div><div className="lbl" style={{ marginBottom: 8 }}>Stay length</div><div className="opt" style={{ display: 'flex', gap: 6 }}>{[6.5, 10, 14].map((d) => <button key={d} type="button" aria-pressed={st.stayDays === d} onClick={() => s.setSettings({ stayDays: d })}>{d} days</button>)}</div></div>
            <Slider label="Battery lasts (hours of darkness)" min={0} max={120} step={2} value={st.reserveH} unit="h" onChange={(n) => s.setSettings({ reserveH: n })} />
            <Slider label="Earth contact needed" min={0} max={100} step={5} value={st.goPct} unit="%" onChange={(n) => s.setSettings({ goPct: n })} />
          </div>
          <div className="lbl" style={{ margin: '16px 0 8px' }}>Landing day</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, gap: 2 }} role="group" aria-label="Landing dates">
            {days.map((d, k) => <button key={k} type="button" className="daybtn" aria-label={fmtDay(d.dayMs)} aria-pressed={k === selDay} title={fmtDay(d.dayMs) + ' — ' + (d.cls === 2 ? 'sunlight and Earth contact' : d.cls === 1 ? 'sunlight, too little contact' : 'dark spell during the stay')}
              onClick={() => { s.setLanding(d.startIndex); s.setT(d.startIndex); }}
              style={{ height: 36, border: 0, borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12, color: d.cls === 0 ? '#EEF2F7' : '#05070B', outline: k === selDay ? '2px solid #fff' : undefined, outlineOffset: 1, background: d.cls === 0 ? 'repeating-linear-gradient(45deg, rgba(255,110,94,.55) 0 3px, #2a0f0d 3px 7px)' : d.cls === 2 ? '#4FDDB4' : 'repeating-linear-gradient(45deg, #FFB547 0 3px, #3a2a10 3px 7px)' }}>{days.length <= 40 ? new Date(d.dayMs).getUTCDate() : ''}</button>)}
          </div>
        </div>
        <div className="panel">
          <div className="phead"><h3 className="title">Mission window</h3><span className="live">{fmtShort(mc.startMs)} → {fmtShort(mc.endMs)} UTC</span></div>
          <MonthBar lanes={{ sun: laneRanges(ev.sunUp, mc.startIndex, mc.endIndex), earth: laneRanges(ev.earthUp, mc.startIndex, mc.endIndex) }} violations={failures} ticks={[[0, 'Landing'], [1, 'Lift-off']]} label="Sun and Earth during the stay" />
          {mc.longestDarkH > 0 ? <Battery battery={mc.battery} cap={st.reserveH} startMs={mc.startMs} endMs={mc.endMs} />
            : <p className="sub" style={{ marginTop: 10 }}>Sunlight the whole stay; the battery is never needed. {mc.firstEarthMs != null ? `Earth ${mc.firstEarthMs === mc.startMs ? 'is in view at landing' : 'rises after ' + fmtHours((mc.firstEarthMs - mc.startMs) / 3600e3)}; contact ${Math.round(mc.coveragePct)}% of the stay.` : 'Earth never comes into view.'}</p>}
        </div>
        <NeuralPanel a={a} saple={real} />
      </div>
      <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
        <div className="panel"><div className="pw-rules">
          {mc.rules.map((r) => <RuleRow key={r.id} title={r.title} name={r.id} expr={r.expr} kind={r.kind} verdict={r.holds ? 'holds' : 'violated'} at={r.firstFailMs != null ? fmtShort(r.firstFailMs) : undefined} why={r.why} showTech />)}
        </div></div>
        <Terminal title={mission.fileName} typeOn runKey={mission.start + ':' + st.reserveH + ':' + st.goPct + ':' + st.stayDays} preview={!real} code={<SplCode tokens={mission.spl} />} output={sapleOutputLines(mission.fileName, mc, fmtShort, real)} />
        <HonestyNote>{sapleNote(live, report, real ? compareWithRuleCheck(real, mc, a.grid) : null, mc.rules, a.site ? fmtLatLon(a.site.lat, a.site.lonE) : 'this point')}</HonestyNote>
      </div>
    </div>
  );
}
