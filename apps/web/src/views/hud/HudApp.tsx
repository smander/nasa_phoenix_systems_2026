// Polar Window as the HUD from the design system (ExampleConsole): a 1600 x 1210 stage scaled to the window,
// top bar with tabs and status chips, the tilted south-pole scene, and glass panels. Narrow screens stack.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import '../../styles/hud.css';
import { STATE_NAMES, countdowns } from '@core/analysis';
import { fmtCountdown, fmtDay, isoDay, parseIsoDay } from '@core/format';
import type { RangePreset } from '../../state/store';
import type { Analysis } from '../../state/useAnalysis';
import { MissionPanels } from './MissionTab';
import { CheckTab, SitesTab, SkyTab } from './OtherTabs';
import { CompareTab } from './CompareTab';
import { LessonCard } from './Learn';
import { HUD } from './parts';
import { Scene } from './Scene';

const TABS = [['mission', 'Mission'], ['sky', 'Sky'], ['sites', 'Sites'], ['compare', 'Compare'], ['check', 'Check']] as const;

function useStageScale() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return { compact: w < 1100, scale: Math.min(1.35, w / 1600) };
}

export function HudApp({ a }: { a: Analysis }) {
  const s = a.store;
  const { compact, scale } = useStageScale();
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageH, setStageH] = useState(1210);
  const [settings, setSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  useLayoutEffect(() => {
    const el = stageRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setStageH(el.offsetHeight)); ro.observe(el); setStageH(el.offsetHeight);
    return () => ro.disconnect();
  }, [s.tab, compact]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', 'dark'); }, []);
  // Start the clock once the data is in, unless the viewer prefers reduced motion.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || s.status !== 'ready') return;
    started.current = true;
    let reduce = false; try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* no matchMedia */ }
    if (!reduce) s.setPlaying(true);
  }, [s.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = s.status === 'ready' && a.site && a.ev && a.tracks && a.m && a.mission;
  const i = a.t;
  const st = ready ? STATE_NAMES[a.ev!.state[i]] : 'none';
  const cd = ready ? countdowns(a.ev!, a.grid, s.t) : null;
  const cdSun = cd ? fmtCountdown(cd.sun, 'Sun') : null, cdEarth = cd ? fmtCountdown(cd.earth, 'Earth') : null;
  const share = async () => { try { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ } };
  const tall = s.tab !== 'mission';
  const learn = s.mode === 'teach';

  const bar = (
    <div className="bar">
      <div className="logo"><img className="brand-emblem" src="brand/phoenix-emblem-96.png" width={48} height={48} alt="Phoenix Systems" /><div className="brand-text"><span className="title">Polar Window</span><small>by <b>PHOENIX</b> SYSTEMS</small></div></div>
      <nav className="tabs" aria-label="Sections" style={{ display: 'flex', gap: 10 }}>
        {TABS.map(([id, label]) => <button key={id} type="button" className="tab title" aria-current={s.tab === id ? 'page' : undefined} onClick={() => s.setTab(id)}>{label}</button>)}
      </nav>
      <span className="grow" />
      {ready && <>
        <button type="button" className="chip" onClick={() => s.setPlaying(!s.playing)} aria-label={s.playing ? 'Pause time' : 'Play time'} title={s.playing ? 'Pause' : 'Play the period'}>
          {s.playing
            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            : <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15L19.5 12z" /></svg>}
          <div><small>Time · UTC</small><b className="num">{fmtDay(a.nowMs)} · {new Date(a.nowMs).toISOString().slice(11, 16)}</b></div>
        </button>
        <div className="chip" style={{ color: HUD[st].color }} role="status"><span className="dot" /><div><small>Now</small><b>{HUD[st].word}</b></div></div>
        {cd && <div className="chip cd-chip" role="status" aria-label={`${cdSun!.label} ${cdSun!.value}; ${cdEarth!.label} ${cdEarth!.value}`} title="Next sunset or sunrise, and next Earthset or Earthrise (the direct-to-Earth window)">
          <div className="cd-row" style={{ color: '#FFB547' }}><span aria-hidden="true">☀</span><small>{cdSun!.label}</small><b className="num">{cdSun!.value}</b></div>
          <div className="cd-row" style={{ color: '#4FA8FF' }}><span aria-hidden="true">◐</span><small>{cdEarth!.label}</small><b className="num">{cdEarth!.value}</b></div>
        </div>}
      </>}
      <button type="button" className="iconbtn" aria-label="Learn mode: short lessons on every tab" aria-pressed={learn} title="Learn: why the Moon is different" onClick={() => s.setMode(learn ? 'plan' : 'teach')}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2 8.5 12 4l10 4.5-10 4.5z" /><path d="M6 10.4V15c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.6" /><path d="M22 8.5V14" /></svg>
      </button>
      <button type="button" className="iconbtn" aria-label="Settings" aria-expanded={settings} aria-pressed={settings} onClick={() => setSettings(!settings)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>
      </button>
    </div>
  );

  const pop = settings && (
    <div className="panel pop" role="dialog" aria-label="Settings">
      <div className="phead" style={{ margin: 0 }}><h3 className="title">Settings</h3><button type="button" className="live" onClick={() => setSettings(false)}>Close ✕</button></div>
      <div><div className="lbl" style={{ marginBottom: 8 }}>Period</div>
        <div className="opt">{([['jan2027', 'Jan 2027'], ['next30', '30 days'], ['next90', '90 days'], ['year', 'Year'], ['custom', 'Custom']] as [RangePreset, string][]).map(([p, l]) => <button key={p} type="button" aria-pressed={s.preset === p} onClick={() => s.setRange(p)}>{l}</button>)}</div>
        {s.preset === 'custom' && <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" aria-label="From (UTC)" value={isoDay(s.fromMs)} onChange={(e) => { const v = parseIsoDay(e.target.value); if (v != null && v < s.toMs) s.setRange('custom', v, Math.min(s.toMs, v + 731 * 86400e3)); }} />
          <span className="sub">to</span>
          <input type="date" aria-label="To (UTC)" value={isoDay(s.toMs)} onChange={(e) => { const v = parseIsoDay(e.target.value); if (v != null && v > s.fromMs) s.setRange('custom', s.fromMs, Math.min(v, s.fromMs + 731 * 86400e3)); }} />
        </div>}
      </div>
      <div><div className="lbl" style={{ marginBottom: 8 }}>Camera / mast height · {s.settings.mastM} m</div><input type="range" min={0} max={50} value={s.settings.mastM} aria-label="Camera or mast height in metres" onChange={(e) => s.setSettings({ mastM: +e.target.value })} /></div>
      <div><div className="lbl" style={{ marginBottom: 8 }}>Earth minimum elevation</div>
        <div className="opt">{[[-90, 'Terrain only'], [2, '2°'], [5, '5°']].map(([v, l]) => <button key={v} type="button" aria-pressed={s.settings.minEarthElDeg === v} onClick={() => s.setSettings({ minEarthElDeg: v as number })}>{l}</button>)}</div></div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="chip" onClick={share}><b>{copied ? 'Link copied' : 'Copy share link'}</b></button>
        <span className="sub">≤ 0.01° vs JPL Horizons · terrain NASA LOLA</span>
      </div>
    </div>
  );

  return (
    <div className={'hud' + (compact ? ' compact' : '')} style={{ height: compact ? undefined : stageH * scale }}>
      <div className="hud-scale" style={{ transform: compact ? undefined : `scale(${scale})` }}>
        <div ref={stageRef} className={'hud-stage' + (tall ? ' tall' : '') + (learn && !tall ? ' learn' : '')}>
          {bar}
          {pop}
          {s.status === 'loading' && <div className="panel" style={{ ['--x' as string]: '40px', ['--y' as string]: '130px', ['--w' as string]: '420px' }}><h3 className="title">Loading</h3><div className="sub">Terrain horizons for the landing points…</div></div>}
          {s.status === 'error' && <div className="panel" role="alert" style={{ ['--x' as string]: '40px', ['--y' as string]: '130px', ['--w' as string]: '520px' }}><h3 className="title">Data unavailable</h3><div className="sub">{s.error}</div></div>}
          {ready && s.tab === 'mission' && <>
            <div className="scene-wrap"><Scene a={a} compact={compact} /></div>
            {s.sceneView === '3d' && <div className="side">
              <button type="button" className="iconbtn" aria-label="Zoom in" onClick={() => s.setZoom(s.zoom * 1.5)}><svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.8"><path d="M10 3v14M3 10h14" /></svg></button>
              <button type="button" className="iconbtn" aria-label="Zoom out" onClick={() => s.setZoom(s.zoom / 1.5)}><svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.8"><path d="M3 10h14" /></svg></button>
              <button type="button" className="iconbtn" aria-label="Centre on the selected point" aria-pressed={s.centred} onClick={() => s.setCentred(!s.centred)}><svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="6" /><circle cx="11" cy="11" r="1.6" fill="currentColor" /><path d="M11 1v4M11 17v4M1 11h4M17 11h4" /></svg></button>
            </div>}
            <MissionPanels a={a} />
            {learn && <LessonCard a={a} tab="mission" style={compact ? undefined : { position: 'relative', left: 'auto', top: 'auto', width: 'auto', height: 'auto', margin: '1190px 40px 0' }} />}
          </>}
          {ready && learn && s.tab !== 'mission' && <LessonCard key={s.tab} a={a} tab={s.tab} style={{ marginBottom: 18 }} />}
          {ready && s.tab === 'sky' && <SkyTab a={a} />}
          {ready && s.tab === 'sites' && <SitesTab a={a} />}
          {ready && s.tab === 'compare' && <CompareTab a={a} />}
          {ready && s.tab === 'check' && <CheckTab a={a} />}
          {ready && s.error && <div className="note" style={{ left: 40, top: 100, color: '#FF6E5E' }} role="alert">{s.error}</div>}
        </div>
      </div>
    </div>
  );
}
