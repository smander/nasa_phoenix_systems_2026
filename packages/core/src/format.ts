// Number and time formatting per the design system: true minus, signed angles, UTC written out.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => (n < 10 ? '0' : '') + n;

export const minus = (s: string) => s.replace(/-/g, '−');
export function signed(v: number, dp = 2): string { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(dp); }
export function fmtDate(ms: number): string { const d = new Date(ms); return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; }
export function fmtClock(ms: number): string { const d = new Date(ms); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`; }
export function fmtShort(ms: number): string { const d = new Date(ms); return `${MON[d.getUTCMonth()]} ${d.getUTCDate()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; }
export function fmtDay(ms: number): string { const d = new Date(ms); return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`; }
export function fmtHours(h: number): string { return h <= 0 ? 'none' : h >= 48 ? (h / 24).toFixed(1) + ' days' : Math.round(h) + ' h'; }
export function fmtLatLon(lat: number, lonE: number): string {
  return `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? 'S' : 'N'}, ${Math.abs(lonE).toFixed(2)}° ${lonE < 0 ? 'W' : 'E'}`;
}
export function fmtKm(m: number): string { return minus((m / 1000).toFixed(2)) + ' km'; }
export function isoDay(ms: number): string { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
export function parseIsoDay(s: string): number | null { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (!m) return null; const t = Date.UTC(+m[1], +m[2] - 1, +m[3]); return Number.isFinite(t) ? t : null; }

/** Ticks for month bars: a few readable dates across the range. */
export function rangeTicks(fromMs: number, toMs: number, count = 5): [number, string][] {
  const out: [number, string][] = [];
  for (let k = 0; k < count; k++) { const f = k / (count - 1); out.push([f, fmtDay(fromMs + f * (toMs - fromMs))]); }
  return out;
}

/** "Sunset in 5 h 20 m", "Earthrise in 3.2 d", or "No Earthrise this period" when it does not happen. */
export function fmtCountdown(c: { up: boolean; hours: number | null }, body: 'Sun' | 'Earth'): { label: string; value: string } {
  const ev = body === 'Sun' ? (c.up ? 'Sunset' : 'Sunrise') : c.up ? 'Earthset' : 'Earthrise';
  if (c.hours == null) return { label: c.up ? `${body} up all period` : `No ${ev} this period`, value: '—' };
  if (c.hours >= 48) return { label: ev + ' in', value: (c.hours / 24).toFixed(1) + ' d' };
  const total = Math.round(c.hours * 60), h = Math.floor(total / 60), m = total % 60;
  return { label: ev + ' in', value: `${h} h ${m} m` };
}
