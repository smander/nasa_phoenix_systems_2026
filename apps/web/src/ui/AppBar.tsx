import { useState } from 'react';
import { Button, SegmentedControl, Select } from '../ds/components';
import type { Option } from '../ds/components';
import { isoDay, parseIsoDay } from '@core/format';
import type { SiteDef } from '@core/types';
import { useStore } from '../state/store';
import type { RangePreset } from '../state/store';

export const GROUP_LABEL: Record<string, string> = {
  'artemis-2024': 'NASA Artemis candidate regions (Oct 2024 list)',
  'artemis-2022': 'NASA Artemis candidate regions (Aug 2022 list)',
  reference: 'Reference points',
  custom: 'Your points',
};

export function siteGroups(sites: SiteDef[]): { label: string; options: Option<string>[] }[] {
  return ['artemis-2024', 'artemis-2022', 'reference', 'custom']
    .map((g) => ({ label: GROUP_LABEL[g], options: sites.filter((s) => s.groups[0] === g).map((s) => ({ value: s.id, label: s.name })) }))
    .filter((g) => g.options.length > 0);
}

export function AppBar() {
  const s = useStore();
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { window.prompt?.('Copy this link', location.href); }
  };
  return (
    <header className="appbar">
      <div className="wrap">
        <div className="brand">
          <img src="polar-window-mark.svg" width={34} height={34} alt="" />
          <div><div className="brand-name">POLAR WINDOW</div><div className="brand-sub">Lunar south pole Sun &amp; Earth planner</div></div>
        </div>
        {s.status === 'ready' && (
          <Select label="Landing point" value={s.selectedId} options={[]} groups={siteGroups(s.sites)} onChange={(id) => s.select(id)} />
        )}
        <div className="bar-controls">
        <SegmentedControl<RangePreset> label="Date range" value={s.preset} onChange={(p) => s.setRange(p)}
          options={[{ value: 'jan2027', label: 'Jan 2027' }, { value: 'next30', label: '30 days' }, { value: 'next90', label: '90 days' }, { value: 'year', label: 'Year' }, { value: 'custom', label: 'Custom' }]} />
        {s.preset === 'custom' && (
          <div className="custom-range">
            <label className="pw-eyebrow" htmlFor="range-from">From</label>
            <input id="range-from" type="date" value={isoDay(s.fromMs)} onChange={(e) => { const v = parseIsoDay(e.target.value); if (v != null && v < s.toMs) s.setRange('custom', v, Math.min(s.toMs, v + 731 * 86400e3)); }} />
            <label className="pw-eyebrow" htmlFor="range-to">to</label>
            <input id="range-to" type="date" value={isoDay(s.toMs)} onChange={(e) => { const v = parseIsoDay(e.target.value); if (v != null && v > s.fromMs) s.setRange('custom', s.fromMs, Math.min(v, s.fromMs + 731 * 86400e3)); }} />
            <span className="pw-note">UTC · up to 2 years</span>
          </div>
        )}
        <SegmentedControl label="View" value={s.view} onChange={(v) => s.setView(v)} options={[{ value: 'results', label: 'Results' }, { value: 'console', label: 'Console' }]} />
        <SegmentedControl label="Mode" value={s.mode} onChange={(m) => s.setMode(m)} options={[{ value: 'explore', label: 'Explore' }, { value: 'teach', label: 'Teach' }, { value: 'plan', label: 'Plan' }]} />
        <SegmentedControl label="Theme" value={s.theme} onChange={(t) => s.setTheme(t)} options={[{ value: 'system', label: 'Auto' }, { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} />
        <Button variant="quiet" onClick={share} aria-live="polite">{copied ? 'Link copied' : 'Share'}</Button>
        </div>
      </div>
    </header>
  );
}
