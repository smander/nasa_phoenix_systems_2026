// Build the training data for the mission neural network (src/core/neuralSeq.ts).
// The exact engine evaluates every catalogued site hourly over 2026-2029; stays are sampled with random landing
// times and mission settings; each sample is the network's input for that stay and the five rule verdicts.
// Split: 0 = training (the 45 sites not held out, landings 2026-2028), 1 = the 9 held-out sites (any year),
// 2 = training sites in the held-out year 2029.
// The stays are saved hour by hour: S.i16 holds the Sun and Earth margins (degrees x 5000, clipped to ±6°,
// sign = visible or not), padded to 336 hours; len.u16 the hours in each stay; P.f32 the settings; Y.u8 the verdicts.
// Usage: npx vite-node tools/nn/nn_dataset.ts   ->  data/raw/nn/{Y.u8, split.u8, S.i16, len.u16, P.f32, meta.json}
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DEFAULT_SETTINGS, buildGrid, checkMission, ephemGrid, evaluate, siteTracks, stayLength, timeAt } from '@core/analysis';
import { flatProfile, maskForHeight } from '@core/horizon';
import { NN_RULES } from '@core/neuralSeq';
import type { HorizonProfile, Settings, SiteDef } from '@core/types';

const ROOT = new URL('../..', import.meta.url).pathname;
const OUT = ROOT + 'data/raw/nn/';
const sites: SiteDef[] = JSON.parse(readFileSync(ROOT + 'apps/web/public/data/sites.json', 'utf8')).sites;
const profile = (s: SiteDef): HorizonProfile => { try { return JSON.parse(readFileSync(ROOT + 'apps/web/public/' + s.horizonUrl, 'utf8')); } catch { return flatProfile(s.id, s.elevM); } };

function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry32(20261112);
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];

const grid = buildGrid(Date.UTC(2026, 0, 1), Date.UTC(2030, 0, 1), 60);
const HELD_YEAR_MS = Date.UTC(2029, 0, 1);
const heldSite = (k: number) => k % 6 === 5;
const PER = { train: 5400, year: 700, site: 3500 };
const MASTS = [0, 2, 10, 50], STAYS = [6.5, 10, 14];

console.log(`grid ${grid.n} hourly steps; ${sites.length} sites, ${sites.filter((_, k) => heldSite(k)).length} held out`);
let t0 = Date.now();
const eg = ephemGrid(grid);
console.log(`ephemeris ${((Date.now() - t0) / 1000).toFixed(1)} s`);

const total = sites.reduce((acc, _, k) => acc + (heldSite(k) ? PER.site : PER.train + PER.year), 0);
const Y = new Uint8Array(total * NN_RULES.length), split = new Uint8Array(total), siteOf = new Uint8Array(total);
const MAXH = 336, Q = 5000;
const SQ = new Int16Array(total * MAXH * 2), LEN = new Uint16Array(total), P = new Float32Array(total * 2);
const quant = (m: number, up: number) => (up ? 1 : -1) * Math.max(1, Math.round(Math.min(6, Math.abs(m)) * Q));
const fmt = (ms: number) => new Date(ms).toISOString();
const iHeld = Math.round((HELD_YEAR_MS - grid.t0Ms) / 3600e3);
let row = 0;
t0 = Date.now();
sites.forEach((site, k) => {
  const tr = siteTracks(eg, site), prof = profile(site);
  const evs = MASTS.map((m) => evaluate(eg, tr, maskForHeight(prof, m), { ...DEFAULT_SETTINGS, mastM: m }));
  const sample = (from: number, to: number, sp: number) => {
    const s: Settings = { ...DEFAULT_SETTINGS, stayDays: pick(STAYS), reserveH: 2 * Math.floor(rnd() * 61), goPct: 5 * Math.floor(rnd() * 21) };
    const mi = Math.floor(rnd() * MASTS.length); s.mastM = MASTS[mi];
    const len = stayLength(grid, s), hi = Math.min(to, grid.n - 2 - len);
    const start = from + Math.floor(rnd() * (hi - from));
    const mc = checkMission(evs[mi], grid, start, s, fmt);
    NN_RULES.forEach((id, r) => { Y[row * NN_RULES.length + r] = mc.rules.find((q) => q.id === id)!.holds ? 1 : 0; });
    const ev = evs[mi], so = row * MAXH * 2;
    for (let h = 0; h < len; h++) {
      const i = start + h;
      SQ[so + h * 2] = quant(tr.sunEl[i] + tr.sunR[i] - ev.maskSun[i], ev.sunUp[i]);
      SQ[so + h * 2 + 1] = quant(tr.earthEl[i] + tr.earthR[i] - ev.maskEarth[i], ev.earthUp[i]);
    }
    LEN[row] = len; P[row * 2] = Math.min(1, s.reserveH / 120); P[row * 2 + 1] = s.goPct / 100;
    split[row] = sp; siteOf[row] = k; row++;
  };
  if (heldSite(k)) for (let q = 0; q < PER.site; q++) sample(0, grid.n, 1);
  else {
    for (let q = 0; q < PER.train; q++) sample(0, iHeld - stayLength(grid, { ...DEFAULT_SETTINGS, stayDays: 14 }), 0); // stays end before 2029
    for (let q = 0; q < PER.year; q++) sample(iHeld, grid.n, 2);
  }
});
console.log(`samples ${row} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

mkdirSync(OUT, { recursive: true });
writeFileSync(OUT + 'Y.u8', Buffer.from(Y.buffer));
writeFileSync(OUT + 'split.u8', Buffer.from(split.buffer));
writeFileSync(OUT + 'site.u8', Buffer.from(siteOf.buffer));
writeFileSync(OUT + 'S.i16', Buffer.from(SQ.buffer));
writeFileSync(OUT + 'len.u16', Buffer.from(LEN.buffer));
writeFileSync(OUT + 'P.f32', Buffer.from(P.buffer));
const base = NN_RULES.map((_, r) => { let c = 0; for (let q = 0; q < row; q++) c += Y[q * NN_RULES.length + r]; return +(c / row).toFixed(3); });
writeFileSync(OUT + 'meta.json', JSON.stringify({
  rows: row, rules: NN_RULES, period: [fmt(grid.t0Ms), fmt(timeAt(grid, grid.n - 1))], heldYear: '2029', maxHours: MAXH, marginScale: Q,
  sites: sites.map((s, k) => ({ id: s.id, held: heldSite(k) })), holdsRate: base, masts: MASTS, stays: STAYS,
}, null, 1));
console.log('share of stays where each rule holds:', Object.fromEntries(NN_RULES.map((id, r) => [id, base[r]])));
