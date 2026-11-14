// The stay as a SAPLE model (SPL, .spl), and how to read SAPLE's answer.
// The model reads the same inputs as the neural networks (neuralSeq.ts): for every hour of the stay, how far the
// Sun and the Earth stand above the terrain skyline, plus the battery reserve, the Earth contact needed and the
// stay length. The networks predict the five rules from those numbers; SAPLE checks them exhaustively.
// Three agents run side by side over one shared clock: the Sun and the Earth rise and set when their margin changes
// sign, and the Lander lets time pass, draining the battery in the dark and counting Earth contact.
// `saple analyze` walks every interleaving, so when the Sun and Earth change in the same hour both orders are
// covered; the rules are written so the order cannot matter.
// SAPLE does not compute where the Sun and Earth are. The app does that for the chosen coordinates and time; the
// model carries the result hour by hour together with the coordinates, so every finding names its exact point.
import type { Evaluation, MissionCheck, Settings, SiteDef, TimeGrid, Tracks } from './types';

export interface SplToken { text: string; kind?: 'k' | 'c' | 't' }
export interface SkyEvent { atH: number; body: 'sun' | 'earth'; up: boolean }

/** Rise and set events inside the stay, in hours after landing (whole hours on every grid the app uses). */
export function stayEvents(ev: Evaluation, grid: TimeGrid, start: number, end: number): SkyEvent[] {
  const stepH = grid.stepMin / 60, out: SkyEvent[] = [];
  for (let i = start + 1; i < end; i++) {
    if (ev.sunUp[i] !== ev.sunUp[i - 1]) out.push({ atH: Math.round((i - start) * stepH), body: 'sun', up: !!ev.sunUp[i] });
    if (ev.earthUp[i] !== ev.earthUp[i - 1]) out.push({ atH: Math.round((i - start) * stepH), body: 'earth', up: !!ev.earthUp[i] });
  }
  return out;
}

export const MARGIN_PER_DEG = 1000; // the model holds margins in thousandths of a degree
const CLIP_DEG = 6;                 // the networks clip the margin at ±6°, and so does the model

/** The hourly inputs of the stay: the margin of the Sun and of the Earth above the skyline (top of the disc minus
 *  the terrain), in thousandths of a degree, clipped to ±6°. The sign says visible (positive) or hidden (negative)
 *  and is never 0. These are the numbers the LSTM reads as "Sun margin, Sun up, Earth margin, Earth up".
 *  Coarser time grids are repeated so there is always one value per hour. */
export function hourlyMargins(tr: Tracks, ev: Evaluation, grid: TimeGrid, start: number, end: number): { hours: number; sun: Int32Array; earth: Int32Array } {
  const rep = Math.max(1, Math.round(grid.stepMin / 60)), hours = Math.max(0, end - start) * rep;
  const sun = new Int32Array(hours), earth = new Int32Array(hours);
  const q = (deg: number, up: number) => (up ? 1 : -1) * Math.max(1, Math.round(Math.min(CLIP_DEG, Math.abs(deg)) * MARGIN_PER_DEG));
  for (let i = start; i < end; i++) {
    const ms = q(tr.sunEl[i] + tr.sunR[i] - ev.maskSun[i], ev.sunUp[i]), me = q(tr.earthEl[i] + tr.earthR[i] - ev.maskEarth[i], ev.earthUp[i]);
    for (let k = 0; k < rep; k++) { sun[(i - start) * rep + k] = ms; earth[(i - start) * rep + k] = me; }
  }
  return { hours, sun, earth };
}

const KEYWORDS = /^(type|schema|attributes|transition|guard|effect|agent|process|system|agents|init|property|invariant|reachable|unreachable|for|in|if|then|else|skip|done)$/;

/** Colour the keywords, the comments and the hidden hours (negative margins) of SPL source for the code view. */
function tokenize(src: string): SplToken[] {
  const out: SplToken[] = [];
  const push = (text: string, kind?: SplToken['kind']) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text; else out.push(kind ? { text, kind } : { text });
  };
  src.split('\n').forEach((line, n, all) => {
    const cut = line.indexOf('//'), code = cut < 0 ? line : line.slice(0, cut);
    for (const part of code.split(/(-\d+|[A-Za-z_]\w*)/)) {
      if (!part) continue;
      push(part, /^-\d/.test(part) ? 't' : KEYWORDS.test(part) ? 'k' : undefined);
    }
    if (cut >= 0) push(line.slice(cut), 'c');
    if (n + 1 < all.length) push('\n');
  });
  return out;
}

/** SPL source for one stay. It parses and analyzes with saple 0.2.0 as written. */
export function splSource(site: SiteDef, tr: Tracks, ev: Evaluation, grid: TimeGrid, mc: MissionCheck, s: Settings, fmt: (ms: number) => string): string {
  const m = hourlyMargins(tr, ev, grid, mc.startIndex, mc.endIndex), stayH = m.hours;
  const pad = (x: string, n: number) => (x + ' '.repeat(n)).slice(0, Math.max(n, x.length));
  const attr = (name: string, type: string, value: string | number, note: string) => (note ? `        ${pad(`${name} : ${type} = ${value} ;`, 28)}// ${note}` : `        ${name} : ${type} = ${value} ;`);
  const rows = (a: Int32Array) => {
    const out: string[] = [];
    for (let h = 0; h < a.length; h += 12) out.push('      ' + Array.from(a.subarray(h, h + 12), (v) => String(v).padStart(6)).join(',') + (h + 12 < a.length ? ',' : ''));
    return out;
  };
  // SAPLE reads a negative initial value of a single attribute as 0, so the point is written as a size and a side.
  const lat = Math.abs(site.lat).toFixed(4), lon = Math.abs(site.lonE).toFixed(4);
  const inStep = (body: string, arr: string, at: string) => `((${body} == UP) <=> (${arr}[${at}] > 0))`;
  return [
    `// Polar Window mission model for ${site.name}`,
    `// Point ${lat}° ${site.lat < 0 ? 'S' : 'N'}, ${lon}° ${site.lonE < 0 ? 'W' : 'E'}, observer ${s.mastM} m above the ground.`,
    `// Landing ${fmt(mc.startMs)} UTC, stay ${stayH} h.`,
    `// Inputs: the same numbers the neural networks read. For every hour of the stay, how far`,
    `// the Sun and the Earth stand above the terrain skyline at this point (NASA LOLA horizon`,
    `// and ephemeris), then the battery reserve, the Earth contact needed and the stay length.`,
    `// Check it with: saple analyze <this file> --no-auto-load`,
    `type Vis = { DOWN, UP } ;`,
    `type NorthSouth = { SOUTH, NORTH } ;`,
    `type EastWest = { WEST, EAST } ;`,
    ``,
    `schema Mission {`,
    `    attributes {`,
    attr('latDeg', 'Real', lat, 'the landing point'),
    attr('latSide', 'NorthSouth', site.lat < 0 ? 'SOUTH' : 'NORTH', ''),
    attr('lonDeg', 'Real', lon, ''),
    attr('lonSide', 'EastWest', site.lonE < 0 ? 'WEST' : 'EAST', ''),
    attr('observerM', 'Real', s.mastM.toFixed(1), 'height above the ground'),
    attr('stayH', 'Int', stayH, 'length of the stay, hours'),
    attr('capacityH', 'Int', s.reserveH, 'hours of darkness the battery covers'),
    attr('needPct', 'Int', s.goPct, 'Earth contact needed, % of the stay'),
    `        // Margin above the skyline in thousandths of a degree, one value per hour.`,
    `        // Positive: visible. Negative: hidden behind the terrain. Clipped to 6 degrees.`,
    `        sunMargin : Array(Int, ${stayH}) = [`,
    ...rows(m.sun),
    `        ] ;`,
    `        earthMargin : Array(Int, ${stayH}) = [`,
    ...rows(m.earth),
    `        ] ;`,
    attr('sun', 'Vis', m.sun[0] > 0 ? 'UP' : 'DOWN', 'at landing'),
    attr('earth', 'Vis', m.earth[0] > 0 ? 'UP' : 'DOWN', 'at landing'),
    attr('clockH', 'Int', 0, 'hours since landing'),
    attr('reserveH', 'Int', s.reserveH, 'hours of battery left'),
    attr('contactH', 'Int', 0, 'hours with Earth in view so far'),
    attr('blackoutH', 'Int', 0, 'hours with neither Sun nor Earth so far'),
    attr('going', 'Int', 0, 'used inside wait()'),
    attr('ended', 'Int', 0, '1 after lift-off'),
    `    }`,
    `}`,
    ``,
    `// The Sun and the Earth rise and set in the hour their margin changes sign.`,
    ...[['sunSet', 'sun == UP && sunMargin[clockH] <= 0', 'sun := DOWN ;'], ['sunRise', 'sun == DOWN && sunMargin[clockH] > 0', 'sun := UP ; reserveH := capacityH ;   // sunlight recharges'],
      ['earthSet', 'earth == UP && earthMargin[clockH] <= 0', 'earth := DOWN ;'], ['earthRise', 'earth == DOWN && earthMargin[clockH] > 0', 'earth := UP ;']]
      .flatMap(([name, guard, effect]) => [`transition ${name}() {`, `    guard:  clockH < stayH && ${guard} ;`, `    effect: ${effect}`, `}`]),
    ``,
    `// Time passes hour by hour until the Sun or the Earth changes, or the stay ends.`,
    `// A rise or set that is due now goes first.`,
    `transition wait() {`,
    `    guard: clockH < stayH && ${inStep('sun', 'sunMargin', 'clockH')}`,
    `                          && ${inStep('earth', 'earthMargin', 'clockH')} ;`,
    `    effect:`,
    `        going := 1 ;`,
    `        for (h : Int) in [clockH..stayH) {`,
    `            if (going == 1 && ${inStep('sun', 'sunMargin', 'h')}`,
    `                           && ${inStep('earth', 'earthMargin', 'h')}) then {`,
    `                if (sun == DOWN) then { reserveH -= 1 } else { skip } ;`,
    `                if (earth == UP) then { contactH += 1 } else { skip } ;`,
    `                if (sun == DOWN && earth == DOWN) then { blackoutH += 1 } else { skip } ;`,
    `                clockH += 1`,
    `            } else { going := 0 }`,
    `        } ;`,
    `}`,
    `transition liftOff() { guard: clockH == stayH && ended == 0 ; effect: ended := 1 ; }`,
    ``,
    `agent Sun() {`,
    `    attributes { }`,
    `    process { S = sunSet() . S + sunRise() . S + [clockH == stayH] done ; }`,
    `}`,
    `agent Earth() {`,
    `    attributes { }`,
    `    process { E = earthSet() . E + earthRise() . E + [clockH == stayH] done ; }`,
    `}`,
    `agent Lander() {`,
    `    attributes { }`,
    `    process { Stay = wait() . Stay + liftOff() . done ; }`,
    `}`,
    ``,
    `system LunarStay {`,
    `    schema: Mission ;`,
    `    agents { Sun() * 1 ; Earth() * 1 ; Lander() * 1 ; }`,
    `    init { clockH == 0 && ended == 0 ; }`,
    `}`,
    ``,
    `property invariant   SunlitStay   { sun == UP }`,
    `property invariant   BatterySafe  { reserveH >= 0 }`,
    `property reachable   DteWindow    { earth == UP }`,
    `property invariant   DteCoverage  { ended == 0 || contactH * 100 >= needPct * stayH }`,
    `property unreachable Blackout     { blackoutH > 0 }`,
    `property reachable   StayComplete { ended == 1 }   // the walk must reach lift-off`,
    ``,
  ].join('\n');
}

export function splModel(site: SiteDef, tr: Tracks, ev: Evaluation, grid: TimeGrid, mc: MissionCheck, s: Settings, fmt: (ms: number) => string): SplToken[] {
  return tokenize(splSource(site, tr, ev, grid, mc, s, fmt));
}

export function splText(tokens: SplToken[]): string { return tokens.map((x) => x.text).join(''); }

/** SAPLE warns when a transition's guard never held. For the four rise and set transitions that is expected in any
 *  stay where that event does not happen; every other warning (a stuck walk, a path cut at its bound, lift-off or
 *  wait never enabled) means the result covers less than it appears to. */
export function seriousWarnings(warnings: string[]): string[] {
  return warnings.filter((w) => {
    const m = /guard never held: (.+)$/.exec(w);
    return !m || !m[1].split(',').every((name) => /^(sunSet|sunRise|earthSet|earthRise)$/.test(name.trim()));
  });
}

// ---- reading SAPLE's answer ----

/** One entry of `saple --format json analyze`. */
export interface SapleFinding { source: string; property: string | null; description: string; trace: string[]; witness: Record<string, string> | null }
export interface SapleVerdict { id: string; holds: boolean; failH: number | null; findings: number }
export interface SapleReading { rules: SapleVerdict[]; complete: boolean; unexpected: string[]; point: { lat: number; lonE: number } | null }

export const SAPLE_RULES = ['SunlitStay', 'BatterySafe', 'DteWindow', 'DteCoverage', 'Blackout'] as const;

const int = (w: Record<string, string> | null, key: string): number | null => {
  const m = w && w[key] ? /^Int\((-?\d+)\)$/.exec(w[key]) : null;
  return m ? Number(m[1]) : null;
};

/** The landing point as SAPLE holds it in its state, read back from the first witness (null when no finding has one). */
function pointOf(findings: SapleFinding[]): { lat: number; lonE: number } | null {
  const w = findings.find((f) => f.witness && f.witness.latDeg)?.witness;
  const real = (k: string) => { const m = w ? /^Real\((-?[\d.eE+-]+)\)$/.exec(w[k] ?? '') : null; return m ? Number(m[1]) : null; };
  const lat = real('latDeg'), lon = real('lonDeg'), ns = int(w ?? null, 'latSide'), ew = int(w ?? null, 'lonSide');
  return lat == null || lon == null || ns == null || ew == null ? null : { lat: ns === 0 ? -lat : lat, lonE: ew === 0 ? -lon : lon };
}

/** Turn SAPLE's findings into one verdict per mission rule. A rule holds when SAPLE reports no finding for it.
 *  `failH` is the first failing hour after landing, read from the witness states:
 *  SunlitStay: the clock when the Sun is first down. BatterySafe: clock + reserve (the reserve is negative by the
 *  hours overdrawn). Blackout: clock minus the blackout hours counted so far.
 *  `complete` is false when the walk never reached lift-off; then no verdict can be trusted. */
export function readSaple(findings: SapleFinding[]): SapleReading {
  const by = new Map<string, SapleFinding[]>(), unexpected: string[] = [];
  for (const f of findings) {
    const id = f.property ?? '';
    if (f.source === 'Property' && ((SAPLE_RULES as readonly string[]).includes(id) || id === 'StayComplete')) by.set(id, [...(by.get(id) ?? []), f]);
    else unexpected.push(f.description);
  }
  const first = (fs: SapleFinding[], hour: (w: Record<string, string> | null) => number | null) => {
    let best: number | null = null;
    for (const f of fs) { const h = hour(f.witness); if (h != null && (best == null || h < best)) best = h; }
    return best;
  };
  const rules = SAPLE_RULES.map((id): SapleVerdict => {
    const fs = by.get(id) ?? [];
    const failH = !fs.length ? null
      : id === 'SunlitStay' ? first(fs, (w) => int(w, 'clockH'))
      : id === 'BatterySafe' ? first(fs, (w) => { const c = int(w, 'clockH'), r = int(w, 'reserveH'); return c == null || r == null ? null : c + r; })
      : id === 'Blackout' ? first(fs, (w) => { const c = int(w, 'clockH'), k = int(w, 'blackoutH'); return c == null || k == null ? null : c - k; })
      : null;
    return { id, holds: fs.length === 0, failH, findings: fs.length };
  });
  return { rules, complete: !by.has('StayComplete'), unexpected, point: pointOf(findings) };
}

/** Compare SAPLE with the page's own direct calculation: same verdict on every rule, and the same first failing hour
 *  (within one time step) where both give one. */
export function compareWithRuleCheck(reading: SapleReading, mc: MissionCheck, grid: TimeGrid): { id: string; sameVerdict: boolean; sameHour: boolean; ruleH: number | null; sapleH: number | null }[] {
  const stepH = grid.stepMin / 60;
  return reading.rules.map((v) => {
    const r = mc.rules.find((x) => x.id === v.id)!;
    const ruleH = r.firstFailMs == null ? null : Math.round((r.firstFailMs - mc.startMs) / 3600e3);
    const sameHour = ruleH == null || v.failH == null ? true : Math.abs(ruleH - v.failH) < stepH;
    return { id: v.id, sameVerdict: v.holds === r.holds, sameHour, ruleH, sapleH: v.failH };
  });
}

/** Terminal lines for the Check tab. With a real run it shows SAPLE's verdicts; without one, the page's own. */
export function sapleOutputLines(fileName: string, mc: MissionCheck, fmt: (ms: number) => string, real?: SapleReading | null): string[] {
  const lines = ['$ saple analyze ' + fileName + ' --no-auto-load'];
  const holds = (r: MissionCheck['rules'][number]) => (real ? real.rules.find((x) => x.id === r.id)!.holds : r.holds);
  for (const r of mc.rules) {
    const v = real ? real.rules.find((x) => x.id === r.id)! : null;
    const failMs = v ? (v.failH == null ? null : mc.startMs + v.failH * 3600e3) : r.firstFailMs;
    const text = holds(r) ? '✓ holds' : '✗ violated' + (failMs != null ? ' at ' + fmt(failMs) : '');
    lines.push('  ' + (r.id + '              ').slice(0, 14) + (r.kind + '            ').slice(0, 12) + text);
  }
  lines.push('  ' + mc.rules.filter(holds).length + ' of ' + mc.rules.length + ' rules hold');
  return lines;
}
