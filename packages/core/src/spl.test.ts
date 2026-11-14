import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, buildGrid, checkMission, ephemGrid, evaluate, siteTracks } from './analysis';
import { maskForHeight } from './horizon';
import { staySequence } from './neuralSeq';
import { compareWithRuleCheck, hourlyMargins, readSaple, sapleOutputLines, seriousWarnings, splModel, splSource, splText, stayEvents } from './spl';
import type { SapleFinding } from './spl';
import type { Evaluation, HorizonProfile, Settings, SiteDef, Tracks } from './types';
import { findSaple, runSaple } from '../../../tools/saple/saple_run';

const ROOT = new URL('../../../', import.meta.url).pathname;
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
const load = (p: string) => JSON.parse(readFileSync(ROOT + 'apps/web/public/data/' + p, 'utf8'));
const sites: SiteDef[] = load('sites.json').sites;
const malapert = sites.find((s) => s.id === 'malapert-massif')!;
const profile: HorizonProfile = { ...load('horizons/malapert-massif.json'), source: 'lola240' };

/** The mission tools/saple/saple_check.ts runs by default: Malapert Massif, landing 9 Jan 2027 00:00 UTC, default settings. */
function jan9(s: Settings = DEFAULT_SETTINGS) {
  const landMs = Date.UTC(2027, 0, 9), grid = buildGrid(landMs, landMs + (s.stayDays + 2) * 86400e3, 60);
  const eg = ephemGrid(grid), tr = siteTracks(eg, malapert), ev = evaluate(eg, tr, maskForHeight(profile, s.mastM), s);
  return { grid, tr, ev, mc: checkMission(ev, grid, 0, s, fmt) };
}

function fakeEval(sun: number[], earth: number[]): Evaluation {
  const n = sun.length;
  return { sunUp: Uint8Array.from(sun), earthUp: Uint8Array.from(earth), state: new Uint8Array(n), maskSun: new Float32Array(n), maskEarth: new Float32Array(n), powerW: new Float32Array(n) };
}

/** Tracks to go with fakeEval: every margin is 0, so the model's values are +1 (visible) or -1 (hidden). */
function fakeTracks(n: number): Tracks {
  const z = () => new Float32Array(n);
  return { sunAz: z(), sunEl: z(), sunR: z(), earthAz: z(), earthEl: z(), earthR: z(), earthKm: z() } as Tracks;
}

describe('SPL mission model', () => {
  it('lists the rise and set events of the stay in hours after landing', () => {
    const ev = fakeEval([1, 1, 0, 0, 1, 1], [0, 1, 1, 1, 0, 0]), grid = buildGrid(0, 5 * 3600e3, 60);
    expect(stayEvents(ev, grid, 0, 6)).toEqual([
      { atH: 1, body: 'earth', up: true }, { atH: 2, body: 'sun', up: false }, { atH: 4, body: 'sun', up: true }, { atH: 4, body: 'earth', up: false },
    ]);
    expect(stayEvents(ev, grid, 2, 4)).toEqual([]); // events at the first hour belong to the start state
  });

  it('holds the networks\u2019 inputs: hourly Sun and Earth margins, battery, contact needed, stay length', () => {
    const { grid, tr, ev, mc } = jan9(), src = splSource(malapert, tr, ev, grid, mc, DEFAULT_SETTINGS, fmt);
    expect(src).toContain('sunMargin : Array(Int, 156) = [');
    expect(src).toContain('earthMargin : Array(Int, 156) = [');
    expect(src).toMatch(/stayH : Int = 156 ;/);
    expect(src).toMatch(/capacityH : Int = 50 ;/);
    expect(src).toMatch(/needPct : Int = 25 ;/);
    expect(src).toContain('property unreachable Blackout     { blackoutH > 0 }');
    // the landing point itself; SAPLE reads a negative single value as 0, so it is a size and a side
    expect(src).toContain('latDeg : Real = ' + Math.abs(malapert.lat).toFixed(4) + ' ;');
    expect(src).toContain('latSide : NorthSouth = SOUTH ;');
    expect(src).toContain('lonSide : EastWest = ' + (malapert.lonE < 0 ? 'WEST' : 'EAST') + ' ;');
    expect(src).not.toMatch(/: (Int|Real) = -/);
    expect(splText(splModel(malapert, tr, ev, grid, mc, DEFAULT_SETTINGS, fmt))).toBe(src); // colouring keeps the text intact
  });

  it('the hourly values are the ones the LSTM reads', () => {
    const { grid, tr, ev, mc } = jan9(), m = hourlyMargins(tr, ev, grid, mc.startIndex, mc.endIndex);
    const q = staySequence(tr, ev, grid, 0, DEFAULT_SETTINGS)!;
    expect(m.hours).toBe(q.T);
    for (let h = 0; h < q.T; h++) {
      // LSTM channels: 0 Sun margin (deg / 6, clipped), 1 Sun up, 2 Earth margin, 3 Earth up
      expect(m.sun[h] > 0).toBe(q.x[h * 7 + 1] === 1);
      expect(m.earth[h] > 0).toBe(q.x[h * 7 + 3] === 1);
      expect(Math.abs(Math.abs(m.sun[h]) - Math.abs(q.x[h * 7]) * 6000)).toBeLessThanOrEqual(1);
      expect(Math.abs(Math.abs(m.earth[h]) - Math.abs(q.x[h * 7 + 2]) * 6000)).toBeLessThanOrEqual(1);
    }
    expect(m.sun[35]).toBeGreaterThan(0); // the Sun is last seen in hour 35 and hidden from hour 36
    expect(m.sun[36]).toBeLessThan(0);
  });

  it('repeats a coarse time grid so there is one value per hour, and never writes 0', () => {
    const ev = fakeEval([1, 0, 1], [0, 0, 1]), grid = buildGrid(0, 3 * 3 * 3600e3, 180), m = hourlyMargins(fakeTracks(3), ev, grid, 0, 3);
    expect(Array.from(m.sun)).toEqual([1, 1, 1, -1, -1, -1, 1, 1, 1]);
    expect(Array.from(m.earth)).toEqual([-1, -1, -1, -1, -1, -1, 1, 1, 1]);
  });

  it('treats a missing rise or set as an expected warning, and everything else as serious', () => {
    expect(seriousWarnings(['warning: these transitions were reached but their guard never held: earthSet, sunRise'])).toEqual([]);
    expect(seriousWarnings(['warning: these transitions were reached but their guard never held: earthSet, liftOff'])).toHaveLength(1);
    expect(seriousWarnings(['warning: the walk reached 1 stuck state(s)'])).toHaveLength(1);
  });

  it('the committed model file is what the generator writes today', () => {
    const { grid, tr, ev, mc } = jan9();
    expect(readFileSync(ROOT + 'tools/saple/models/polar_window_malapert_massif.spl', 'utf8')).toBe(splSource(malapert, tr, ev, grid, mc, DEFAULT_SETTINGS, fmt));
  });
});

describe('reading SAPLE findings', () => {
  const saved: { findings: SapleFinding[] } = JSON.parse(readFileSync(ROOT + 'tools/saple/models/polar_window_malapert_massif.saple.json', 'utf8'));

  it('the saved real run agrees with the direct calculation, to the hour', () => {
    const { grid, mc } = jan9(), reading = readSaple(saved.findings);
    expect(reading.complete).toBe(true);
    expect(reading.unexpected).toEqual([]);
    expect(reading.point!.lat).toBeCloseTo(malapert.lat, 4); // SAPLE's own state names the point
    expect(reading.point!.lonE).toBeCloseTo(malapert.lonE, 4);
    expect(reading.rules.map((v) => [v.id, v.holds, v.failH])).toEqual([
      ['SunlitStay', false, 36], ['BatterySafe', false, 86], ['DteWindow', true, null], ['DteCoverage', true, null], ['Blackout', true, null],
    ]);
    expect(compareWithRuleCheck(reading, mc, grid).every((c) => c.sameVerdict && c.sameHour)).toBe(true);
    expect(sapleOutputLines('x.spl', mc, fmt, reading)).toEqual(sapleOutputLines('x.spl', mc, fmt));
  });

  it('no findings means every rule holds; a missing lift-off means nothing can be trusted', () => {
    expect(readSaple([]).rules.every((v) => v.holds)).toBe(true);
    expect(readSaple([]).point).toBeNull();
    const stuck = readSaple([{ source: 'Property', property: 'StayComplete', description: "Property 'StayComplete' violated", trace: [], witness: null }]);
    expect(stuck.complete).toBe(false);
    expect(readSaple([{ source: 'Structural', property: null, description: 'something else', trace: [], witness: null }]).unexpected).toEqual(['something else']);
  });

  it('flags a verdict or a failure hour that differs from the direct calculation', () => {
    const { grid, mc } = jan9();
    const late = saved.findings.map((f) => (f.property === 'SunlitStay' ? { ...f, witness: { ...f.witness!, clockH: 'Int(90)' } } : f));
    expect(compareWithRuleCheck(readSaple(late), mc, grid).find((c) => c.id === 'SunlitStay')).toMatchObject({ sameVerdict: true, sameHour: false, ruleH: 36, sapleH: 90 });
    const cmp = compareWithRuleCheck(readSaple(saved.findings.filter((f) => f.property !== 'BatterySafe')), mc, grid);
    expect(cmp.find((c) => c.id === 'BatterySafe')!.sameVerdict).toBe(false);
  });
});

// Runs only on a machine with the saple CLI (tools/saple/build_saple.sh); skipped elsewhere, for example in CI.
const saple = existsSync(ROOT + '.saple/env.json') || process.env.SAPLE_BIN ? findSaple(ROOT) : null;
describe.skipIf(!saple)('the real saple CLI', () => {
  it.each([
    ['default settings', DEFAULT_SETTINGS],
    ['a 14-day stay with a small battery and high contact need', { ...DEFAULT_SETTINGS, stayDays: 14, reserveH: 10, goPct: 90 }],
    ['a ground-level observer with no battery', { ...DEFAULT_SETTINGS, mastM: 0, reserveH: 0, goPct: 100 }],
  ])('agrees with the direct calculation: %s', (_name, s) => {
    const { grid, tr, ev, mc } = jan9(s as Settings);
    const run = runSaple(saple!, splSource(malapert, tr, ev, grid, mc, s as Settings, fmt));
    expect(run.error).toBeUndefined();
    expect(seriousWarnings(run.warnings)).toEqual([]);
    const reading = readSaple(run.findings);
    expect(reading.complete).toBe(true);
    expect(compareWithRuleCheck(reading, mc, grid).filter((c) => !c.sameVerdict || !c.sameHour)).toEqual([]);
  });

  it('covers both orders when the Sun sets in the hour the Earth rises, without a false blackout', () => {
    const ev = fakeEval([1, 1, 1, 0, 0, 0, 0], [0, 0, 0, 1, 1, 1, 1]), grid = buildGrid(0, 6 * 3600e3, 60);
    const s: Settings = { ...DEFAULT_SETTINGS, stayDays: 0.25, reserveH: 2, goPct: 50 };
    const mc = checkMission(ev, grid, 0, s, fmt);
    const run = runSaple(saple!, splSource(malapert, fakeTracks(ev.sunUp.length), ev, grid, mc, s, fmt));
    const reading = readSaple(run.findings);
    expect(reading.rules.find((v) => v.id === 'Blackout')!.holds).toBe(true);
    expect(compareWithRuleCheck(reading, mc, grid).every((c) => c.sameVerdict && c.sameHour)).toBe(true);
    expect(run.findings.some((f) => f.trace.join('>').includes('sunSet>earthRise'))).toBe(true);
    expect(run.findings.some((f) => f.trace.join('>').includes('earthRise>sunSet'))).toBe(true);
  });

  it('keeps the coordinates in its state for a northern, eastern point too', () => {
    const apollo = sites.find((x) => x.id === 'apollo-15')!;
    expect(apollo.lat).toBeGreaterThan(0);
    const ev = fakeEval([0, 0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1, 1]), grid = buildGrid(0, 6 * 3600e3, 60);
    const s: Settings = { ...DEFAULT_SETTINGS, stayDays: 0.25 }, mc = checkMission(ev, grid, 0, s, fmt);
    const reading = readSaple(runSaple(saple!, splSource(apollo, fakeTracks(ev.sunUp.length), ev, grid, mc, s, fmt)).findings);
    expect(reading.point!.lat).toBeCloseTo(apollo.lat, 4);
    expect(reading.point!.lonE).toBeCloseTo(apollo.lonE, 4);
    expect(compareWithRuleCheck(reading, mc, grid).every((c) => c.sameVerdict && c.sameHour)).toBe(true);
  });

  it('reports a model that cannot reach lift-off', () => {
    const { grid, tr, ev, mc } = jan9();
    const broken = splSource(malapert, tr, ev, grid, mc, DEFAULT_SETTINGS, fmt).replace('guard:  clockH < stayH && sun == UP && sunMargin[clockH] <= 0 ;', 'guard:  false ;');
    const run = runSaple(saple!, broken);
    expect(readSaple(run.findings).complete).toBe(false);
    expect(seriousWarnings(run.warnings).join(' ')).toMatch(/stuck/);
  });

  it('reports a model that does not parse', () => {
    const run = runSaple(saple!, 'schema {');
    expect(run.ok).toBe(false);
    expect(run.error).toBeTruthy();
  });
});
