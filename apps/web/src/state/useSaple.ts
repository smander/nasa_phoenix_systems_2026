// The real SAPLE engine, when this page is served by the local dev or preview server on a machine that has the
// saple CLI (see tools/saple/build_saple.sh). The server runs `saple analyze` on the model shown on the Check tab and
// returns its findings. The deployed site has no CLI; there the page shows the result of the last local batch run.
import { useEffect, useState } from 'react';
import { readSaple } from '@core/spl';
import type { SapleFinding, SapleReading } from '@core/spl';

export interface SapleLive {
  status: 'unavailable' | 'running' | 'done' | 'error';
  version?: string; commit?: string; ms?: number; reading?: SapleReading; warnings?: string[]; error?: string;
}
export interface SapleReport {
  saple: { version: string; commit: string | null }; date: string; missions: number; sites: number; period: string;
  allRulesSame: number; incomplete: number; withWarnings: number; failedRuns: number; msPerRun: number;
  rules: { id: string; holds: number; fails: number; sameVerdict: number; hoursCompared: number; sameHour: number; lstm: number }[];
}

const isLocal = () => typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

/** Run the model through the local saple CLI whenever it changes. `unavailable` anywhere but a local server with the CLI. */
export function useSapleLive(source: string | null, fileName: string): SapleLive {
  const [live, setLive] = useState<SapleLive>({ status: 'unavailable' });
  useEffect(() => {
    if (!source || !isLocal()) { setLive({ status: 'unavailable' }); return; }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('api/saple', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fileName, source }), signal: ctl.signal });
        if (!/json/.test(res.headers.get('content-type') || '')) { setLive({ status: 'unavailable' }); return; }
        const d: { available: boolean; version?: string; commit?: string; ok?: boolean; findings?: SapleFinding[]; warnings?: string[]; ms?: number; error?: string } = await res.json();
        if (!d.available) setLive({ status: 'unavailable' });
        else if (!d.ok) setLive({ status: 'error', version: d.version, commit: d.commit, error: d.error || 'saple failed' });
        else setLive({ status: 'done', version: d.version, commit: d.commit, ms: d.ms, warnings: d.warnings ?? [], reading: readSaple(d.findings ?? []) });
      } catch (e) { if (!ctl.signal.aborted) setLive({ status: 'unavailable' }); }
    }, 200);
    setLive((prev) => (prev.status === 'unavailable' ? prev : { ...prev, status: 'running' }));
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [source, fileName]);
  return live;
}

let report: Promise<SapleReport | null> | null = null;
/** The last batch comparison made with the real CLI (tools/saple/saple_check.ts --batch). */
export function loadSapleReport(): Promise<SapleReport | null> {
  return (report ??= fetch('data/saple/report.json').then((r) => (r.ok ? r.json() : null)).catch(() => null));
}
export function useSapleReport(): SapleReport | null {
  const [r, set] = useState<SapleReport | null>(null);
  useEffect(() => { let alive = true; loadSapleReport().then((x) => { if (alive) set(x); }); return () => { alive = false; }; }, []);
  return r;
}
