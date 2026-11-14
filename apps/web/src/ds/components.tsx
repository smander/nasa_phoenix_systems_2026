// Polar Window design-system components, ported from packages/design-system/components/bundle.js (window.PolarWindow)
// to typed React modules. Class names and markup are unchanged so packages/design-system/components/bundle.css applies.
import { Fragment, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { Quality, SkyState } from '@core/types';

export function reducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

export const STATES: Record<SkyState, { badge: string; head: string; sub: string }> = {
  both: { badge: 'Power and contact', head: 'Sun and Earth both up', sub: 'Arrays generate and the direct-to-Earth link is open.' },
  sun: { badge: 'Power only', head: 'Sunlit, Earth out of sight', sub: 'Arrays generate; data waits for Earth to rise.' },
  earth: { badge: 'Contact only', head: 'Earth in view, Sun hidden', sub: 'Radio link open; running on stored energy.' },
  none: { badge: 'Blackout', head: 'No sunlight, no Earth', sub: 'Batteries carry the lander; no direct radio link.' },
};
export const LANE: Record<SkyState, string> = { both: 'var(--both)', sun: 'var(--sun)', earth: 'var(--earth)', none: 'var(--none)' };

export function StateBadge({ state, label, animateKey }: { state: SkyState; label?: string; animateKey?: string | number }) {
  return (
    <span className={cx('pw-pill', animateKey != null && 'pw-flip')} key={animateKey} data-state={state} role="status">
      <i aria-hidden="true" />
      <span>{label || STATES[state].badge}</span>
    </span>
  );
}

const QICON: Record<Quality, ReactNode> = {
  region: <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><rect x="1" y="1" width="9" height="9" rx="2" fill="none" stroke="currentColor" strokeDasharray="2 1.5" /></svg>,
  exact: <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><circle cx="5.5" cy="5.5" r="2.5" fill="currentColor" /><circle cx="5.5" cy="5.5" r="4.5" fill="none" stroke="currentColor" /></svg>,
  approximate: <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><text x="5.5" y="9" textAnchor="middle" fontSize="10" fill="currentColor" fontFamily="var(--font-mono)">≈</text></svg>,
  custom: <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.4" /></svg>,
};
const QLABEL: Record<Quality, string> = { region: 'region centre', exact: 'exact point', approximate: 'approximate', custom: 'custom point' };

export function QualityBadge({ quality, source, label }: { quality: Quality; source?: string; label?: string }) {
  return <span className="pw-qbadge" data-q={quality} title={source}>{QICON[quality]}{label || QLABEL[quality]}</span>;
}

export function HonestyNote({ onSky, children }: { onSky?: boolean; children: ReactNode }) {
  return <span className="pw-note" data-on={onSky ? 'sky' : undefined}>{children}</span>;
}

export function Button({ variant = 'primary', icon, children, className, ...rest }: { variant?: 'primary' | 'quiet'; icon?: ReactNode; children?: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...rest} className={cx('pw-btn', 'pw-btn-' + variant, className)}>{icon}{children}</button>;
}

export function PlayButton({ playing, onClick }: { playing: boolean; onClick?: () => void }) {
  return (
    <button type="button" className="pw-play" aria-label={playing ? 'Pause' : 'Play the month'} aria-pressed={playing} onClick={onClick}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        {playing ? <g fill="currentColor"><rect x="2.5" y="2" width="3" height="10" rx="1" /><rect x="8.5" y="2" width="3" height="10" rx="1" /></g> : <path d="M3.5 1.8v10.4L12 7z" fill="currentColor" />}
      </svg>
    </button>
  );
}

export interface Option<T> { value: T; label: string; disabled?: boolean }
export function SegmentedControl<T extends string | number>({ label, options, value, onChange }: { label: string; options: Option<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="pw-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} disabled={o.disabled} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Select({ label, options, value, onChange, groups }: { label?: string; options: Option<string>[]; value: string; onChange: (v: string) => void; groups?: { label: string; options: Option<string>[] }[] }) {
  const id = useId();
  return (
    <label className="pw-field-inline" htmlFor={id}>
      {label && <span className="pw-eyebrow">{label}</span>}
      <select id={id} className="pw-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {groups
          ? groups.map((g) => <optgroup key={g.label} label={g.label}>{g.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>)
          : options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Slider({ label, min, max, step = 1, value, unit, format, onChange }: { label: string; min: number; max: number; step?: number; value: number; unit?: string; format?: (n: number) => string; onChange: (n: number) => void }) {
  const id = useId();
  return (
    <div className="pw-field">
      <label className="pw-eyebrow" htmlFor={id}>{label}</label>
      <div className="pw-slider">
        <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
        <output htmlFor={id}>{format ? format(value) : value + (unit ? ' ' + unit : '')}</output>
      </div>
    </div>
  );
}

function useCountUp(target: number | string, decimals = 0): string {
  const [v, setV] = useState<number>(typeof target === 'number' ? target : 0);
  const ref = useRef(v);
  useEffect(() => {
    if (typeof target !== 'number') return;
    if (reducedMotion()) { ref.current = target; setV(target); return; }
    const from = ref.current, t0 = performance.now(), D = 900;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 4), x = from + (target - from) * e;
      ref.current = x; setV(x); if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return typeof target === 'number' ? v.toFixed(decimals) : target;
}
export function fmtSigned(s: string | number, signed?: boolean): string {
  const str = String(s);
  return signed && +str > 0 ? '+' + str : str.replace('-', '−');
}

export function Readout(p: { label: string; value: number | string; decimals?: number; signed?: boolean; suffix?: string; unit?: string; state?: string; tone?: SkyState; caption?: ReactNode; rows?: [string, string][]; bracket?: boolean; children?: ReactNode; animate?: boolean }) {
  const counted = useCountUp(p.animate === false ? (typeof p.value === 'number' ? p.value.toFixed(p.decimals || 0) : p.value) : p.value, p.decimals);
  return (
    <div className={cx('pw-stat', p.bracket && 'pw-bracket')}>
      <div className="pw-head">
        <span className="pw-eyebrow">{p.label}</span>
        {p.state && <span className="pw-state" data-tone={p.tone || 'none'}>{p.state}</span>}
      </div>
      <div className="pw-big"><span data-count="">{fmtSigned(counted, p.signed) + (p.suffix || '')}</span>{p.unit && <small>{p.unit}</small>}</div>
      {p.caption && <p>{p.caption}</p>}
      {p.children}
      {p.rows && <dl className="pw-dl">{p.rows.map((r, i) => <Fragment key={i}><dt>{r[0]}</dt><dd>{r[1]}</dd></Fragment>)}</dl>}
    </div>
  );
}

export interface Segment { from: number; to: number; state: SkyState }
const pct = (x: number) => (x * 100).toFixed(3) + '%';

export function MonthBar(p: { segments?: Segment[]; lanes?: { sun?: [number, number][]; earth?: [number, number][] }; playhead?: number; window?: [number, number]; violations?: number[]; ticks?: [number, string][]; label?: string }) {
  const label = p.label || 'Availability over the month';
  const fill = (k: number, from: number, to: number, col: string, extra?: React.CSSProperties) => <i key={k} className="pw-mb-fill" style={{ left: pct(from), width: pct(to - from), background: col, ...extra }} />;
  const head = p.playhead != null && <span className="pw-mb-head" style={{ left: pct(p.playhead) }} />;
  if (p.lanes) {
    return (
      <div className="pw-monthbar" role="img" aria-label={label}>
        <div className="pw-mb-lanes labelled">
          <div className="pw-mb-row"><span className="pw-mb-name" style={{ ['--c' as string]: 'var(--sun)' }}>Sun</span>
            <div className="pw-mb-track pw-mb-lane">{(p.lanes.sun || []).map((s, i) => fill(i, s[0], s[1], 'var(--sun)'))}</div></div>
          <div className="pw-mb-row"><span className="pw-mb-name" style={{ ['--c' as string]: 'var(--earth)' }}>Earth</span>
            <div className="pw-mb-track pw-mb-lane">{(p.lanes.earth || []).map((s, i) => fill(i, s[0], s[1], 'var(--earth)'))}</div></div>
          <div className="pw-mb-overlay">
            {p.window && <span className="pw-mb-window" style={{ left: pct(p.window[0]), width: pct(p.window[1] - p.window[0]) }} />}
            {(p.violations || []).map((v, i) => <span key={'v' + i} className="pw-mb-violation" style={{ left: pct(v) }} />)}
            {head}
          </div>
        </div>
        {p.ticks && <div className="pw-mb-ticks labelled">{p.ticks.map((t, i) => <span key={i} style={{ left: pct(t[0]), transform: t[0] === 0 ? 'none' : t[0] === 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{t[1]}</span>)}</div>}
      </div>
    );
  }
  return (
    <div className="pw-monthbar" role="img" aria-label={label}>
      <div className="pw-mb-track pw-mb-state">{(p.segments || []).filter((s) => s.state !== 'none').map((s, i) => fill(i, s.from, s.to, LANE[s.state], { borderRadius: 0 }))}</div>
      {head}
    </div>
  );
}

export function PickItem(p: { name: string; quality?: Quality; source?: string; meta: string; sun: number | null; earth: number | null; segments?: Segment[]; selected?: boolean; onClick?: () => void; extra?: ReactNode }) {
  return (
    <button type="button" className="pw-pick" aria-pressed={!!p.selected} onClick={p.onClick}>
      <span><span className="nm">{p.name}{p.quality && <QualityBadge quality={p.quality} source={p.source} />}</span><span className="meta">{p.meta}</span></span>
      <span className="nums">
        <span style={{ color: 'var(--sun)' }}>{p.sun == null ? '…' : Math.round(p.sun) + '% Sun'}</span>
        <span style={{ color: 'var(--earth)' }}>{p.earth == null ? '…' : Math.round(p.earth) + '% Earth'}</span>
      </span>
      {p.segments && <span className="bar"><MonthBar segments={p.segments} label={p.name + ' month availability'} /></span>}
      {p.extra}
    </button>
  );
}

export function Panel(p: { title?: string; description?: ReactNode; note?: ReactNode; table?: ReactNode; bracket?: boolean; children?: ReactNode; className?: string }) {
  const [table, setTable] = useState(false);
  return (
    <section className={cx('pw-panel', p.bracket && 'pw-bracket', p.className)}>
      {p.title && <h3>{p.title}</h3>}
      {p.description && <p>{p.description}</p>}
      {table && p.table ? p.table : p.children}
      {(p.note || p.table) && (
        <div className="pw-panel-foot">
          {p.note ? <HonestyNote>{p.note}</HonestyNote> : <span />}
          {p.table && <button type="button" className="pw-linkbtn" onClick={() => setTable(!table)}>{table ? 'Show as chart' : 'Show as table'}</button>}
        </div>
      )}
    </section>
  );
}

export function RuleRow(p: { title?: string; name: string; expr: string; kind: string; verdict: 'holds' | 'violated' | 'preview'; at?: string; why: string; showTech?: boolean }) {
  const v = p.verdict, cls = v === 'holds' ? 'ok' : v === 'violated' ? 'bad' : 'prev';
  const word = v === 'holds' ? 'Pass' : v === 'violated' ? 'Fail' : 'Not checked yet';
  const icon = v === 'holds' ? <path d="M3 7.5l2.6 2.6L11 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    : v === 'violated' ? <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      : <circle cx="7" cy="7" r="1.6" fill="currentColor" />;
  return (
    <div className={cx('pw-rule', v === 'violated' && 'violated')}>
      <span key={v} className={cx('ic', cls, 'flip')} aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14">{icon}</svg></span>
      <span className="nm">{p.title || p.name}</span>
      <span className={cx('verdict', cls)}>{word}</span>
      <span className="why">{v === 'violated' && p.at ? <span className="at">Fails on {p.at} UTC. </span> : null}{p.why}</span>
      {p.showTech && <span className="tech">{p.name} · {p.kind} · <code>{p.expr}</code></span>}
    </div>
  );
}

export function Terminal(p: { title: string; code?: ReactNode; output?: string[]; typeOn?: boolean; runKey?: unknown; preview?: boolean; collapsed?: boolean; summary?: string; summaryNote?: string; defaultOpen?: boolean }) {
  const lines = p.output || [];
  const [shown, setShown] = useState(reducedMotion() || !p.typeOn ? lines.length : 0);
  const key = JSON.stringify(lines) + String(p.runKey);
  useEffect(() => {
    if (reducedMotion() || !p.typeOn) { setShown(lines.length); return; }
    setShown(0);
    let i = 0;
    const t = setInterval(() => { i++; setShown(i); if (i >= lines.length) clearInterval(t); }, 260);
    return () => clearInterval(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const paint = (ln: string) => (/✓/.test(ln) ? <span className="g">{ln}</span> : /✗/.test(ln) ? <span className="r">{ln}</span> : /^\$/.test(ln) ? <span className="k">{ln}</span> : ln);
  const term = (
    <div className="pw-term">
      <div className="pw-term-bar"><span className="dots" aria-hidden="true"><i /><i /><i /></span>{p.title}{p.preview && <span className="pw-preview-tag" style={{ marginLeft: 'auto' }}>preview</span>}</div>
      {p.code && <pre tabIndex={0}>{p.code}</pre>}
      {lines.length > 0 && <pre className="out" aria-live="polite">{lines.slice(0, shown).map((ln, i) => <div key={i}>{paint(ln)}</div>)}{shown < lines.length && <span className="pw-caret" aria-hidden="true" />}</pre>}
    </div>
  );
  return p.collapsed ? <details className="pw-details" open={p.defaultOpen}><summary>{p.summary || 'Technical details'}{p.summaryNote && <small>{p.summaryNote}</small>}</summary>{term}</details> : term;
}

export function GlossaryTip({ term, definition, defaultOpen, children }: { term: string; definition: string; defaultOpen?: boolean; children?: ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const id = useId();
  return (
    <span className="pw-tip-wrap" onMouseEnter={() => setOpen(true)} onMouseLeave={() => { if (!defaultOpen) setOpen(false); }}>
      <button type="button" className="pw-term-word" aria-describedby={open ? id : undefined} aria-expanded={open} onClick={() => setOpen(!open)} onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); }}>{children || term}</button>
      {open && <span id={id} role="tooltip" className="pw-tip"><b>{term}</b><span>{definition}</span></span>}
    </span>
  );
}

export function HorizonRule({ litFrom = 0.18, litTo = 0.42 }: { litFrom?: number; litTo?: number }) {
  const pts: string[] = [], W = 600;
  for (let i = 0; i <= 60; i++) { const y = 11 - 4 * Math.sin(i * 0.37) - 2.5 * Math.sin(i * 1.13 + 1) - 1.5 * Math.sin(i * 2.7); pts.push((i * W / 60).toFixed(1) + ' ' + y.toFixed(1)); }
  const a = Math.round(litFrom * 60), b = Math.round(litTo * 60);
  return (
    <svg className="pw-horizon" viewBox={'0 0 ' + W + ' 18'} preserveAspectRatio="none" aria-hidden="true">
      <path className="ridge" d={'M' + pts.join(' L')} vectorEffect="non-scaling-stroke" />
      <path className="lit" d={'M' + pts.slice(a, b + 1).join(' L')} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Skeleton({ height = 140, progress, label }: { height?: number; progress?: number; label?: string }) {
  return (
    <div className="pw-stack" style={{ padding: 0 }}>
      <div className="pw-skel" style={{ height }} aria-hidden="true" />
      {progress != null && <div className="pw-progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label || 'Computing'}><i style={{ width: progress * 100 + '%' }} /></div>}
      {label && <span className="pw-note">{label}</span>}
    </div>
  );
}
