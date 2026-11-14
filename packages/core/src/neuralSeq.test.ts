import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './analysis';
import { SEQ_CHANNELS, forwardSeq, staySequence } from './neuralSeq';
import type { SeqModel } from './neuralSeq';
import type { Evaluation, TimeGrid, Tracks } from './types';

function world(n: number, sunMargin: (i: number) => number, earthMargin: (i: number) => number): { tr: Tracks; ev: Evaluation } {
  const f = (g: (i: number) => number) => Float32Array.from({ length: n }, (_, i) => g(i));
  const tr = { sunAz: f(() => 0), sunEl: f(sunMargin), sunR: f(() => 0), earthAz: f(() => 0), earthEl: f(earthMargin), earthR: f(() => 0), earthKm: f(() => 384400), earthLit: f(() => 0.5) };
  const ev = { sunUp: Uint8Array.from({ length: n }, (_, i) => (sunMargin(i) > 0 ? 1 : 0)), earthUp: Uint8Array.from({ length: n }, (_, i) => (earthMargin(i) > 0 ? 1 : 0)),
    state: new Uint8Array(n), maskSun: new Float32Array(n), maskEarth: new Float32Array(n), powerW: new Float32Array(n) };
  return { tr, ev };
}
const S = { ...DEFAULT_SETTINGS, stayDays: 6.5, reserveH: 60, goPct: 25 };

describe('staySequence', () => {
  it('gives seven values for every hour of the stay', () => {
    const grid: TimeGrid = { t0Ms: 0, stepMin: 60, n: 400 };
    const { tr, ev } = world(400, (i) => (i === 12 ? -3 : 1.5), () => -20);
    const q = staySequence(tr, ev, grid, 10, S)!;
    expect(q.T).toBe(156);
    expect(q.x.length).toBe(156 * SEQ_CHANNELS);
    expect(Array.from(q.x.slice(0, 7))).toEqual([0.25, 1, -1, 0, 0.5, 0.25, 1].map(Math.fround));
    expect(Array.from(q.x.slice(2 * 7, 2 * 7 + 2))).toEqual([-0.5, 0]); // hour 12: the Sun is 3 deg below the skyline
  });
  it('repeats coarse steps so the network always reads hours', () => {
    const grid: TimeGrid = { t0Ms: 0, stepMin: 180, n: 200 }; // 3-hour steps: 52 steps = 156 hours
    const { tr, ev } = world(200, (i) => (i === 1 ? -1 : 1), () => 1);
    const q = staySequence(tr, ev, grid, 0, S)!;
    expect(q.T).toBe(156);
    expect([q.x[1], q.x[3 * 7 + 1], q.x[5 * 7 + 1], q.x[6 * 7 + 1]]).toEqual([1, 0, 0, 1]); // hours 3-5 come from step 1
  });
  it('marks the stay scale and is null when the stay does not fit', () => {
    const grid: TimeGrid = { t0Ms: 0, stepMin: 60, n: 400 };
    const { tr, ev } = world(400, () => 1, () => 1);
    expect(staySequence(tr, ev, grid, 10, { ...S, stayDays: 14 })!.x[6]).toBeCloseTo(156 / 336, 6);
    expect(staySequence(tr, ev, grid, 300, S)).toBeNull();
  });
});

describe('forwardSeq', () => {
  // A hand-made 1-unit LSTM: the cell adds 1 for every hour the Sun is down (input channel 1 = Sun up) and never forgets.
  const big = 20;
  const model: SeqModel = {
    inputs: 7, hidden: 1, att: 1, head: 1, rules: 1,
    // gate order i, f, g, o; rows of W_ih are [in0..in6]
    wih: Float32Array.from([0, -2 * big, 0, 0, 0, 0, 0, /* i */ 0, 0, 0, 0, 0, 0, 0, /* f */ 0, 0, 0, 0, 0, 0, 0, /* g */ 0, 0, 0, 0, 0, 0, 0 /* o */]),
    whh: Float32Array.from([0, 0, 0, 0]),
    b: Float32Array.from([big, big, big, big]),   // i = sigmoid(20 - 40 sunUp): 1 when dark, 0 when lit; f = 1; g = tanh(20) = 1; o = 1
    attW1: Float32Array.from([1]), attB1: Float32Array.from([0]), attW2: Float32Array.from([4]), attB2: Float32Array.from([0]),
    headU: Float32Array.from([0, 1]), headC: Float32Array.from([0]), outW: Float32Array.from([1]), outB: Float32Array.from([-0.5]),
  };
  const seq = (sunUp: number[]) => ({ T: sunUp.length, x: Float32Array.from(sunUp.flatMap((u) => [0, u, 0, 0, 0, 0, 1])) });
  it('carries the cell state through time', () => {
    // 3 dark hours -> cell 3 -> h = tanh(3); the head reads the last hidden state: sigmoid(tanh(3) - 0.5)
    const r = forwardSeq(model, seq([1, 0, 0, 0]));
    expect(r.p[0]).toBeCloseTo(1 / (1 + Math.exp(-(Math.tanh(3) - 0.5))), 4);
    const lit = forwardSeq(model, seq([1, 1, 1, 1]));
    expect(lit.p[0]).toBeCloseTo(1 / (1 + Math.exp(0.5)), 4);
  });
  it('returns attention weights that sum to one and favour the hours with more signal', () => {
    const r = forwardSeq(model, seq([1, 0, 0, 0]));
    const a = r.attention[0];
    expect(a.length).toBe(4);
    expect(Array.from(a).reduce((u, v) => u + v, 0)).toBeCloseTo(1, 5);
    expect(a[3]).toBeGreaterThan(a[0]); // the hidden state grows through the dark spell
  });
});

// ---- the trained LSTM (public/data/nn), against the PyTorch training code and the direct calculation ----
import { readFileSync } from 'node:fs';
import { buildGrid, checkMission, ephemGrid, evaluate, firstFeasibleStart, siteTracks, stayLength } from './analysis';
import { maskForHeight } from './horizon';
import { NN_RULES, SEQ_BASE_HOURS, seqModelFromBuffer } from './neuralSeq';
import type { SeqMeta } from './neuralSeq';
import type { HorizonProfile, SiteDef } from './types';

const pub = (p: string) => new URL('../../../apps/web/public/data/' + p, import.meta.url);
const meta: SeqMeta = JSON.parse(readFileSync(pub('nn/lstm.json'), 'utf8'));
const raw = readFileSync(pub('nn/lstm.bin'));
const lstm = seqModelFromBuffer(meta, raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));

describe('trained LSTM with attention', () => {
  it('has the documented shape', () => {
    expect([meta.inputs, meta.hidden, meta.att, meta.head]).toEqual([SEQ_CHANNELS, 64, 32, 48]);
    expect(meta.rules).toEqual(NN_RULES);
  });
  it('gives the same outputs and attention in TypeScript as in PyTorch', () => {
    const fix: { q: number[]; reserve: number; go: number; p: number[]; peak: number[]; peakWeight: number[] }[] =
      JSON.parse(readFileSync(new URL('../fixtures/lstm_fixture.json', import.meta.url), 'utf8'));
    expect(new Set(fix.map((f) => f.q.length / 2))).toEqual(new Set([156, 240, 336])); // every stay length
    for (const f of fix) {
      const T = f.q.length / 2, x = new Float32Array(T * SEQ_CHANNELS);
      for (let t = 0; t < T; t++) {
        const s = f.q[t * 2], e = f.q[t * 2 + 1], c = (v: number) => Math.max(-1, Math.min(1, v / 5000 / 6));
        x.set([c(s), s > 0 ? 1 : 0, c(e), e > 0 ? 1 : 0, f.reserve, f.go, SEQ_BASE_HOURS / T], t * SEQ_CHANNELS);
      }
      const out = forwardSeq(lstm, { T, x });
      out.p.forEach((p, k) => expect(p).toBeCloseTo(f.p[k], 3));
      out.attention.forEach((w, k) => expect(w[f.peak[k]]).toBeCloseTo(f.peakWeight[k], 3));
    }
  });
  it('reports held-out accuracy above 98% on every rule', () => {
    [...meta.report.unseenSites.ruleAccuracy, ...meta.report.unseenYear.ruleAccuracy].forEach((acc) => expect(acc).toBeGreaterThan(0.98));
    expect(meta.report.unseenSites.allRules).toBeGreaterThan(0.97);
  });
  it('agrees with the direct calculation at Malapert Massif in January 2027', () => {
    const sites: SiteDef[] = JSON.parse(readFileSync(pub('sites.json'), 'utf8')).sites;
    const site = sites.find((s) => s.id === 'malapert-massif')!;
    const profile: HorizonProfile = JSON.parse(readFileSync(pub('horizons/malapert-massif.json'), 'utf8'));
    const g = buildGrid(Date.UTC(2027, 0, 1), Date.UTC(2027, 0, 31)), eg = ephemGrid(g), tr = siteTracks(eg, site);
    const ev = evaluate(eg, tr, maskForHeight(profile, 2), DEFAULT_SETTINGS);
    const fmt = (ms: number) => new Date(ms).toISOString();
    const start = firstFeasibleStart(ev, g, DEFAULT_SETTINGS);
    const exact = checkMission(ev, g, start, DEFAULT_SETTINGS, fmt).rules;
    forwardSeq(lstm, staySequence(tr, ev, g, start, DEFAULT_SETTINGS)!).p.forEach((p, k) => expect(p >= 0.5).toBe(exact.find((r) => r.id === NN_RULES[k])!.holds));
    let same = 0, all = 0;
    for (let s0 = 0; s0 + stayLength(g, DEFAULT_SETTINGS) <= g.n - 1; s0 += 24) {
      const ex = checkMission(ev, g, s0, DEFAULT_SETTINGS, fmt).rules;
      forwardSeq(lstm, staySequence(tr, ev, g, s0, DEFAULT_SETTINGS)!).p.forEach((p, k) => { all++; if ((p >= 0.5) === ex.find((r) => r.id === NN_RULES[k])!.holds) same++; });
    }
    expect(same / all).toBeGreaterThan(0.95);
  });
});
