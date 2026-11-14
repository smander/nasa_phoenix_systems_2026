// HUD "Compare" tab: re-planning when the schedule shifts. Scenario cards (site + landing time) side by side;
// the slip table, nearby alternatives for the same dates, and the year view.
import { useEffect, useState } from 'react';
import { laneRanges, stayLength } from '@core/analysis';
import { fmtHours, fmtLatLon, fmtShort } from '@core/format';
import { firstBreak, monthlyStats, rankAlternatives, slipTable, summarize } from '@core/scenario';
import type { MonthStat } from '@core/scenario';
import type { ScenarioSummary, SlipRow } from '@core/scenario';
import type { Evaluation, SiteDef } from '@core/types';
import { MonthBar } from '../../ds/components';
import { evalFor, yearGridFor } from '../../state/compute';
import { MAX_SCENARIOS } from '../../state/store';
import type { Analysis } from '../../state/useAnalysis';

export const passColour = (p: number, n: number) => (p === n ? '#4FDDB4' : p >= n - 1 ? '#FFB547' : '#FF6E5E');
const pct = (v: number) => Math.round(v) + '%';
const hrs = (h: number | null) => (h == null ? 'not this period' : fmtHours(h));

/** Step index of a UTC time on the analysis grid (may fall outside 0..n-1). */
export function indexOf(a: Analysis, ms: number) { return Math.round((ms - a.grid.t0Ms) / (a.grid.stepMin * 60e3)); }

/** Open a site at a landing step on the Mission tab. */
export function openAt(a: Analysis, siteId: string, index: number) {
  const s = a.store;
  s.select(siteId); s.setLanding(index); s.setT(index); s.setPlaying(false); s.setTab('mission');
}

export function Stat({ label, value, colour }: { label: string; value: string; colour?: string }) {
  return <div><div className="lbl">{label}</div><div className="val num" style={{ fontSize: 18, color: colour }}>{value}</div></div>;
}

function ScenarioCard({ a, site, ev, start, sum, onRemove }: { a: Analysis; site: SiteDef; ev: Evaluation; start: number; sum: ScenarioSummary | null; onRemove: () => void }) {
  const s = a.store;
  if (!sum) {
    return (
      <div className="panel cmp-card">
        <div className="phead"><div><h3 className="title">{site.name}</h3><div className="sub">{fmtLatLon(site.lat, site.lonE)}</div></div></div>
        <p className="sub">This landing time is outside the chosen period. Change the period in Settings, or remove the scenario.</p>
        <div className="cmp-actions"><button type="button" className="chip" onClick={onRemove}><b>Remove</b></button></div>
      </div>
    );
  }
  const end = start + stayLength(a.grid, s.settings);
  return (
    <div className="panel cmp-card">
      <div className="phead"><div><h3 className="title">{site.name}</h3><div className="sub">{fmtLatLon(site.lat, site.lonE)}</div></div></div>
      <div className="sub">Lands <b style={{ color: 'var(--ink)' }}>{fmtShort(sum.startMs)} UTC</b> · stays {s.settings.stayDays} days{sum.inRange ? '' : ' · the stay runs past the end of the period'}</div>
      <div className="cmp-verdict" style={{ color: passColour(sum.verdictPass, sum.rules) }}><span className="big num">{sum.verdictPass}</span><span>of {sum.rules} rules pass</span></div>
      <div className="cmp-stats">
        <Stat label="Sunlit" value={pct(sum.sunPct)} colour="#FFB547" />
        <Stat label="Earth contact" value={pct(sum.contactPct)} colour="#4FA8FF" />
        <Stat label="Longest dark" value={fmtHours(sum.longestDarkH)} />
        <Stat label="Mean power" value={Math.round(sum.meanPowerW) + ' W/m²'} />
        <Stat label="First sunset" value={hrs(sum.firstSunsetH)} />
        <Stat label="First Earthset" value={hrs(sum.firstEarthsetH)} />
      </div>
      <MonthBar lanes={{ sun: laneRanges(ev.sunUp, start, end), earth: laneRanges(ev.earthUp, start, end) }} ticks={[[0, 'Landing'], [1, 'Lift-off']]} label={`Sun and Earth during the stay at ${site.name}`} />
      <div className="cmp-actions">
        <button type="button" className="chip" onClick={() => openAt(a, site.id, start)}><b>Open on Mission →</b></button>
        <button type="button" className="chip" onClick={onRemove}><b>Remove</b></button>
      </div>
    </div>
  );
}

const slipLabel = (d: number) => (d === 0 ? 'On time' : (d > 0 ? '+' : '−') + Math.abs(d) + ' d');

/** One sentence on what a slip does: the first later landing that loses a rule, or the wait that fixes things. */
function slipSentence(rows: SlipRow[]): string {
  const base = rows.find((r) => r.days === 0)?.summary;
  if (!base) return '';
  const later = rows.filter((r) => r.days > 0 && r.summary);
  if (base.verdictPass < base.rules) {
    const fix = later.find((r) => r.summary!.verdictPass === r.summary!.rules);
    return fix ? `The on-time landing breaks ${base.rules - base.verdictPass} rule${base.rules - base.verdictPass > 1 ? 's' : ''}. Waiting ${fix.days} day${fix.days > 1 ? 's' : ''} makes every rule pass.`
      : `The on-time landing breaks ${base.rules - base.verdictPass} rule${base.rules - base.verdictPass > 1 ? 's' : ''}, and no slip in this period fixes it. Try another site.`;
  }
  const b = firstBreak(rows);
  const reach = later.length ? later[later.length - 1].days : 0;
  return b ? `Slipping ${b.days} day${b.days > 1 ? 's' : ''} ${b.why}.` : reach ? `Every rule still holds if the landing slips by up to ${reach} days.` : '';
}

function SlipPanel({ a }: { a: Analysis }) {
  const s = a.store, site = a.site!, mission = a.mission!;
  const rows = slipTable(a.ev!, a.grid, mission.start, s.settings);
  return (
    <div className="panel">
      <div className="phead"><div><h3 className="title">If the landing slips</h3><div className="sub">{site.name} · planned landing {fmtShort(mission.mc.startMs)} UTC · {s.settings.stayDays}-day stay. Choose a row to move the landing.</div></div></div>
      <p className="slip-say">{slipSentence(rows)}</p>
      <div className="slip-table" role="table" aria-label="Mission rules if the landing slips">
        <div className="slip-row head" role="row"><span role="columnheader">Slip</span><span role="columnheader">Landing (UTC)</span><span role="columnheader">Rules</span><span role="columnheader">Sunlit</span><span role="columnheader">Contact</span><span role="columnheader">Longest dark</span></div>
        {rows.map((r) => {
          const x = r.summary;
          return x ? (
            <button key={r.days} type="button" role="row" className={'slip-row' + (r.days === 0 ? ' now' : '')} onClick={() => { s.setLanding(r.start); s.setT(r.start); s.setPlaying(false); }} aria-label={`${slipLabel(r.days)}: ${x.verdictPass} of ${x.rules} rules pass`}>
              <span>{slipLabel(r.days)}</span><span className="num">{fmtShort(x.startMs)}</span>
              <span className="num" style={{ color: passColour(x.verdictPass, x.rules), fontWeight: 700 }}>{x.verdictPass}/{x.rules}</span>
              <span className="num">{pct(x.sunPct)}</span><span className="num">{pct(x.contactPct)}</span><span className="num">{fmtHours(x.longestDarkH)}</span>
            </button>
          ) : (
            <div key={r.days} role="row" className="slip-row off"><span>{slipLabel(r.days)}</span><span style={{ gridColumn: '2 / -1' }}>beyond this period</span></div>
          );
        })}
      </div>
    </div>
  );
}

const RADII = [25, 50, 100, 250];

function AlternativesPanel({ a }: { a: Analysis }) {
  const s = a.store, site = a.site!, mission = a.mission!;
  const [radius, setRadius] = useState(100);
  const cands = s.sites.map((x) => ({ site: x, ev: evalFor(a.grid, x, s.profiles[x.id], s.settings) }));
  const ranked = rankAlternatives(site, cands, a.grid, mission.start, s.settings, radius);
  const here = summarize(a.ev!, a.grid, mission.start, s.settings);
  const better = ranked.filter((r) => r.summary.verdictPass > here.verdictPass || (r.summary.verdictPass === here.verdictPass && r.summary.contactPct > here.contactPct + 0.5));
  const shown = ranked.slice(0, 6);
  return (
    <div className="panel">
      <div className="phead">
        <div><h3 className="title">Other sites, same dates</h3><div className="sub">Landing {fmtShort(mission.mc.startMs)} UTC for {s.settings.stayDays} days. {site.name} passes {here.verdictPass} of {here.rules} rules with {pct(here.contactPct)} Earth contact.</div></div>
      </div>
      <div className="opt" role="group" aria-label="Search radius" style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}><span className="lbl" style={{ marginRight: 6 }}>Within</span>{RADII.map((r) => <button key={r} type="button" aria-pressed={radius === r} onClick={() => setRadius(r)}>{r} km</button>)}</div>
      <p className="slip-say">{shown.length === 0 ? `No other catalogued site lies within ${radius} km. Widen the radius, or analyse your own point on the Sites tab.`
        : better.length ? `${better.length} site${better.length > 1 ? 's' : ''} within ${radius} km do${better.length > 1 ? '' : 'es'} better on these dates. The best is ${better[0].site.name}, ${Math.round(better[0].km)} km ${better[0].bearing}.`
        : `No site within ${radius} km does better on these dates.`}</p>
      <div className="slip-table" role="table" aria-label="Other sites for the same landing dates">
        <div className="slip-row alt head" role="row"><span role="columnheader">Site</span><span role="columnheader">Distance</span><span role="columnheader">Rules</span><span role="columnheader">Sunlit</span><span role="columnheader">Contact</span><span role="columnheader" /></div>
        {shown.map((r) => (
          <div key={r.site.id} className="slip-row alt" role="row">
            <span><b style={{ fontWeight: 600 }}>{r.site.name.replace(/ \((best-lit point|peak)\)/, '')}</b></span>
            <span className="num">{r.km < 10 ? r.km.toFixed(1) : Math.round(r.km)} km {r.bearing}</span>
            <span className="num" style={{ color: passColour(r.summary.verdictPass, r.summary.rules), fontWeight: 700 }}>{r.summary.verdictPass}/{r.summary.rules}</span>
            <span className="num">{pct(r.summary.sunPct)}</span><span className="num">{pct(r.summary.contactPct)}</span>
            <span className="alt-actions">
              <button type="button" className="chip" onClick={() => openAt(a, r.site.id, mission.start)}><b>Open</b></button>
              <button type="button" className="chip" disabled={s.scenarios.length >= MAX_SCENARIOS} onClick={() => s.addScenario(r.site.id, mission.mc.startMs)}><b>+ Scenario</b></button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function YearPanel({ a }: { a: Analysis }) {
  const s = a.store, site = a.site!, profile = s.profiles[site.id];
  const key = [site.id, s.fromMs, s.settings.mastM, s.settings.stayDays, s.settings.goPct, s.settings.minEarthElDeg].join(':');
  const [res, setRes] = useState<{ key: string; months: MonthStat[] } | null>(null);
  useEffect(() => {
    if (res?.key === key) return;
    const t = setTimeout(() => { const g = yearGridFor(s.fromMs); setRes({ key, months: monthlyStats(evalFor(g, site, profile, s.settings), g, s.settings) }); }, 30);
    return () => clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const months = res?.key === key ? res.months : null;
  const best = months ? [...months].sort((x, y) => y.feasibleDays - x.feasibleDays || y.sunPct - x.sunPct)[0] : null;
  const worst = months ? [...months].sort((x, y) => x.feasibleDays - y.feasibleDays || x.sunPct - y.sunPct)[0] : null;
  const name = (m: MonthStat) => MON[new Date(m.monthMs).getUTCMonth()] + ' ' + new Date(m.monthMs).getUTCFullYear();
  const pick = (m: MonthStat) => { const d = new Date(m.monthMs); s.setRange('custom', m.monthMs, Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); };
  return (
    <div className="panel">
      <div className="phead"><div><h3 className="title">Across the next 12 months</h3><div className="sub">{site.name} · sunlight, Earth in view and the number of days a {s.settings.stayDays}-day stay can start in sunlight. Choose a month to plan in it.</div></div></div>
      {!months ? <p className="sub">Working out the year…</p> : <>
        <p className="slip-say">{best && worst && best.monthMs !== worst.monthMs ? `Best month: ${name(best)}, with ${best.feasibleDays} landing days in sunlight. Hardest: ${name(worst)}, with ${worst.feasibleDays}.` : 'Every month looks alike at this site.'}</p>
        <div className="year" role="list" aria-label="Month by month">
          {months.map((m) => (
            <button key={m.monthMs} type="button" role="listitem" className="year-m" onClick={() => pick(m)} aria-label={`${name(m)}: ${Math.round(m.sunPct)}% sunlit, ${Math.round(m.earthPct)}% Earth in view, ${m.feasibleDays} landing days`}>
              <div className="year-bars"><i style={{ height: m.sunPct + '%', background: '#FFB547' }} /><i style={{ height: m.earthPct + '%', background: '#4FA8FF' }} /></div>
              <b className="num" style={{ color: m.feasibleDays ? '#4FDDB4' : '#FF6E5E' }}>{m.feasibleDays}</b>
              <span>{MON[new Date(m.monthMs).getUTCMonth()]}</span>
            </button>
          ))}
        </div>
        <div className="year-key"><span><span style={{ color: '#FFB547' }}>▮</span> Sunlit %</span><span><span style={{ color: '#4FA8FF' }}>▮</span> Earth in view %</span><span><span style={{ color: '#4FDDB4' }}>12</span> landing days in sunlight</span></div>
      </>}
    </div>
  );
}

export function CompareTab({ a }: { a: Analysis }) {
  const s = a.store, site = a.site!, mission = a.mission!;
  const cards = s.scenarios.map((sc) => {
    const x = s.sites.find((y) => y.id === sc.siteId);
    if (!x) return null;
    const ev = evalFor(a.grid, x, s.profiles[x.id], s.settings);
    const start = indexOf(a, sc.startMs);
    const ok = start >= 0 && start < a.grid.n - 1;
    return { sc, site: x, ev, start, sum: ok ? summarize(ev, a.grid, start, s.settings) : null };
  }).filter(Boolean) as { sc: { id: string }; site: SiteDef; ev: Evaluation; start: number; sum: ScenarioSummary | null }[];
  const full = s.scenarios.length >= MAX_SCENARIOS;
  const already = s.scenarios.some((x) => x.siteId === site.id && x.startMs === mission.mc.startMs);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="panel">
        <div className="phead">
          <div><h3 className="title">Compare scenarios</h3><div className="sub">A scenario is a landing site and a landing time. Put up to {MAX_SCENARIOS} side by side to weigh a change of site or date.</div></div>
          <button type="button" className="chip" disabled={full || already} onClick={() => s.addScenario(site.id, mission.mc.startMs)} title={full ? `Up to ${MAX_SCENARIOS} scenarios; remove one first` : already ? 'Already added' : undefined}>
            <b>+ Add {site.name.replace(/ \((best-lit point|peak)\)/, '')} · {fmtShort(mission.mc.startMs)}</b>
          </button>
        </div>
        {cards.length === 0 && <p className="sub">No scenarios yet. Pick a site and a landing day on the Mission or Check tab, then add it here. Add a second site, or the same site on another day, to compare.</p>}
      </div>
      <div className="cmp-two"><SlipPanel a={a} /><AlternativesPanel a={a} /></div>
      <YearPanel a={a} />
      {cards.length > 0 && <div className="cmp-grid">{cards.map((c) => <ScenarioCard key={c.sc.id} a={a} site={c.site} ev={c.ev} start={c.start} sum={c.sum} onRemove={() => s.removeScenario(c.sc.id)} />)}</div>}
    </div>
  );
}
