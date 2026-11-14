// The app's artificial intelligence: an LSTM neural network with attention (trained by pipeline/train_lstm.py with
// PyTorch) that gives a second opinion on a mission. It reads the stay hour by hour. Every hour carries seven values:
// Sun margin, Sun up, Earth margin, Earth up, and the three mission settings. An attention head per rule weighs the
// hours, so the network can show where it looked. It predicts; the direct calculation is exact and the SAPLE model verifies.
import { stayLength } from './analysis';
import type { Evaluation, RuleResult, Settings, TimeGrid, Tracks } from './types';

export const NN_RULES: RuleResult['id'][] = ['SunlitStay', 'BatterySafe', 'DteWindow', 'DteCoverage', 'Blackout'];

/** How the trained network did on stays it never saw (written by the training script). */
export interface NeuralReport {
  trainedOn: { stays: number; sites: number; years: string };
  unseenSites: { stays: number; sites: number; ruleAccuracy: number[]; allRules: number };
  unseenYear: { stays: number; year: string; ruleAccuracy: number[]; allRules: number };
  unsureBand: [number, number];             // probabilities inside this band are shown as "unsure"
  errorsFlaggedUnsure: number;              // share of wrong verdicts that fell inside the band
}
export interface NeuralVerdict { id: RuleResult['id']; p: number; holds: boolean; unsure: boolean }

export const SEQ_CHANNELS = 7;
export const SEQ_BASE_HOURS = 156;            // the shortest stay (6.5 days); channel 7 is 156 / hours in the stay
const CLIP_DEG = 6;

export interface StaySequence { T: number; x: Float32Array }

/** The stay as an hourly sequence (T x 7). Coarser time grids are repeated so the network always reads hours. */
export function staySequence(tr: Tracks, ev: Evaluation, grid: TimeGrid, start: number, s: Settings): StaySequence | null {
  const len = stayLength(grid, s);
  if (start < 0 || start + len > grid.n - 1 || len < 1) return null;
  const rep = Math.max(1, Math.round(grid.stepMin / 60)), T = len * rep, x = new Float32Array(T * SEQ_CHANNELS);
  const scale = (v: number) => Math.max(-1, Math.min(1, v / CLIP_DEG));
  const reserve = Math.min(1, s.reserveH / 120), go = s.goPct / 100, stay = SEQ_BASE_HOURS / T;
  for (let k = 0; k < len; k++) {
    const i = start + k;
    const ms = scale(tr.sunEl[i] + tr.sunR[i] - ev.maskSun[i]), me = scale(tr.earthEl[i] + tr.earthR[i] - ev.maskEarth[i]);
    for (let q = 0; q < rep; q++) {
      const o = (k * rep + q) * SEQ_CHANNELS;
      x[o] = ms; x[o + 1] = ev.sunUp[i]; x[o + 2] = me; x[o + 3] = ev.earthUp[i]; x[o + 4] = reserve; x[o + 5] = go; x[o + 6] = stay;
    }
  }
  return { T, x };
}

/** Weights as exported by the training script; matrices are row-major [out][in], LSTM gates in PyTorch order i, f, g, o. */
export interface SeqModel {
  inputs: number; hidden: number; att: number; head: number; rules: number;
  wih: Float32Array; whh: Float32Array; b: Float32Array;                       // LSTM: (4H x inputs), (4H x H), (4H) = b_ih + b_hh
  attW1: Float32Array; attB1: Float32Array; attW2: Float32Array; attB2: Float32Array; // attention: H -> att (tanh) -> one score per rule
  headU: Float32Array; headC: Float32Array; outW: Float32Array; outB: Float32Array;   // per rule: [context ; last h] -> head (ReLU) -> logit
}

const sig = (v: number) => 1 / (1 + Math.exp(-v));

/** Run the LSTM over the sequence, then attention and the output head. Returns the chance each rule holds and, per
 *  rule, the attention weight of every hour (each sums to 1). */
export function forwardSeq(m: SeqModel, q: StaySequence): { p: number[]; attention: Float32Array[] } {
  const { inputs: I, hidden: H, att: A, head: D, rules: R } = m, T = q.T;
  const hs = new Float32Array(T * H), h = new Float32Array(H), c = new Float32Array(H), g = new Float32Array(4 * H);
  for (let t = 0; t < T; t++) {
    const xo = t * I;
    for (let r = 0; r < 4 * H; r++) {
      let v = m.b[r];
      for (let k = 0, o = r * I; k < I; k++) v += m.wih[o + k] * q.x[xo + k];
      for (let k = 0, o = r * H; k < H; k++) v += m.whh[o + k] * h[k];
      g[r] = v;
    }
    for (let k = 0; k < H; k++) {
      const ig = sig(g[k]), fg = sig(g[H + k]), gg = Math.tanh(g[2 * H + k]), og = sig(g[3 * H + k]);
      c[k] = fg * c[k] + ig * gg;
      h[k] = og * Math.tanh(c[k]);
    }
    hs.set(h, t * H);
  }
  // attention scores: one per hour and rule
  const scores = new Float32Array(T * R), u = new Float32Array(A);
  for (let t = 0; t < T; t++) {
    for (let a = 0; a < A; a++) { let v = m.attB1[a]; for (let k = 0, o = a * H; k < H; k++) v += m.attW1[o + k] * hs[t * H + k]; u[a] = Math.tanh(v); }
    for (let r = 0; r < R; r++) { let v = m.attB2[r]; for (let a = 0, o = r * A; a < A; a++) v += m.attW2[o + a] * u[a]; scores[t * R + r] = v; }
  }
  const p: number[] = [], attention: Float32Array[] = [], z = new Float32Array(2 * H);
  for (let r = 0; r < R; r++) {
    let mx = -Infinity; for (let t = 0; t < T; t++) mx = Math.max(mx, scores[t * R + r]);
    const w = new Float32Array(T); let sum = 0;
    for (let t = 0; t < T; t++) { w[t] = Math.exp(scores[t * R + r] - mx); sum += w[t]; }
    z.fill(0);
    for (let t = 0; t < T; t++) { w[t] /= sum; for (let k = 0; k < H; k++) z[k] += w[t] * hs[t * H + k]; }
    for (let k = 0; k < H; k++) z[H + k] = h[k];
    let logit = m.outB[r];
    for (let d = 0; d < D; d++) {
      let v = m.headC[d];
      for (let k = 0, o = d * 2 * H; k < 2 * H; k++) v += m.headU[o + k] * z[k];
      if (v > 0) logit += m.outW[r * D + d] * v;
    }
    p.push(sig(logit)); attention.push(w);
  }
  return { p, attention };
}

export interface SeqMeta { inputs: number; hidden: number; att: number; head: number; rules: string[]; bin: string; report: NeuralReport }

/** Split one Float32 buffer into the model's matrices, in the order the training script writes them. */
export function seqModelFromBuffer(meta: Pick<SeqMeta, 'inputs' | 'hidden' | 'att' | 'head' | 'rules'>, buf: ArrayBuffer): SeqModel {
  const { inputs: I, hidden: H, att: A, head: D } = meta, R = meta.rules.length, all = new Float32Array(buf);
  let off = 0;
  const take = (n: number) => { const v = all.subarray(off, off + n); off += n; return v; };
  const m: SeqModel = { inputs: I, hidden: H, att: A, head: D, rules: R,
    wih: take(4 * H * I), whh: take(4 * H * H), b: take(4 * H),
    attW1: take(A * H), attB1: take(A), attW2: take(R * A), attB2: take(R),
    headU: take(D * 2 * H), headC: take(D), outW: take(R * D), outB: take(R) };
  if (off !== all.length) throw new Error(`sequence model: expected ${off} weights, file has ${all.length}`);
  return m;
}

// ---- loader (browser) ----
let loaded: Promise<{ model: SeqModel; meta: SeqMeta } | null> | null = null;
export function loadNeuralSeq(): Promise<{ model: SeqModel; meta: SeqMeta } | null> {
  return (loaded ??= (async () => {
    const meta: SeqMeta = await (await fetch('data/nn/lstm.json')).json();
    const buf = await (await fetch(meta.bin)).arrayBuffer();
    return { model: seqModelFromBuffer(meta, buf), meta };
  })().catch(() => null));
}
