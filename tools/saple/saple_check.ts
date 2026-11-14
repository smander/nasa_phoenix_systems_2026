// Check missions with the real SAPLE engine on this machine and compare it with the page's direct calculation and with
// the neural network (the app's AI). Needs the saple CLI: tools/saple/build_saple.sh /path/to/SAPLE   (or SAPLE_BIN=/path/to/saple)
//
//   npx vite-node tools/saple/saple_check.ts                       one mission (Malapert Massif, landing 2027-01-09 00:00 UTC)
//   npx vite-node tools/saple/saple_check.ts --site shackleton-rim --land 2027-03-04T06:00 --stay 10 --reserve 40 --go 50 --mast 2
//   npx vite-node tools/saple/saple_check.ts --batch 20            20 hourly + 5 three-hourly missions at every site
//
// One mission: writes tools/saple/models/<file>.spl and tools/saple/models/<file>.saple.json (SAPLE's findings), prints the comparison.
// Batch: writes apps/web/public/data/saple/report.json, shown on the Check tab. Exit status 1 if SAPLE and the direct calculation differ.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DEFAULT_SETTINGS, buildGrid, checkMission, ephemGrid, evaluate, siteTracks, stayLength, timeAt } from '@core/analysis';
import { flatProfile, maskForHeight } from '@core/horizon';
import { forwardSeq, seqModelFromBuffer, staySequence } from '@core/neuralSeq';
import { SAPLE_RULES, compareWithRuleCheck, readSaple, seriousWarnings, splSource, stayEvents } from '@core/spl';
import type { HorizonProfile, Settings, SiteDef } from '@core/types';
import { findSaple, runSaple } from './saple_run';

const ROOT = new URL('../..', import.meta.url).pathname;
const args = process.argv.slice(2);
const opt = (name: string) => { const i = args.indexOf('--' + name); return i < 0 ? undefined : args[i + 1] ?? ''; };
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

const saple = findSaple(ROOT);
if (!saple) { console.error('No saple CLI found. Build it with: tools/saple/build_saple.sh /path/to/SAPLE   (or set SAPLE_BIN)'); process.exit(2); }

const sites: SiteDef[] = JSON.parse(readFileSync(ROOT + 'apps/web/public/data/sites.json', 'utf8')).sites;
const profile = (s: SiteDef): HorizonProfile => { try { return JSON.parse(readFileSync(ROOT + 'apps/web/public/' + s.horizonUrl, 'utf8')); } catch { return flatProfile(s.id, s.elevM); } };
const buf = (p: string) => { const b = readFileSync(ROOT + 'apps/web/public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const seqMeta = JSON.parse(readFileSync(ROOT + 'apps/web/public/data/nn/lstm.json', 'utf8'));
const lstm = seqModelFromBuffer(seqMeta, buf(seqMeta.bin));

if (opt('batch') === undefined) single(); else batch(Math.max(1, Number(opt('batch')) || 20));

function single() {
  const site = sites.find((s) => s.id === (opt('site') || 'malapert-massif'));
  if (!site) { console.error('Unknown site. Known ids: ' + sites.map((s) => s.id).join(', ')); process.exit(2); }
  const landMs = Date.parse((opt('land') || '2027-01-09T00:00') + ':00Z');
  if (!Number.isFinite(landMs)) { console.error('--land must look like 2027-01-09T00:00 (UTC)'); process.exit(2); }
  const s: Settings = { ...DEFAULT_SETTINGS, stayDays: Number(opt('stay') ?? DEFAULT_SETTINGS.stayDays), reserveH: Number(opt('reserve') ?? DEFAULT_SETTINGS.reserveH),
    goPct: Number(opt('go') ?? DEFAULT_SETTINGS.goPct), mastM: Number(opt('mast') ?? DEFAULT_SETTINGS.mastM) };
  const grid = buildGrid(landMs, landMs + (s.stayDays + 2) * 86400e3, 60);
  const eg = ephemGrid(grid), tr = siteTracks(eg, site), ev = evaluate(eg, tr, maskForHeight(profile(site), s.mastM), s);
  const mc = checkMission(ev, grid, 0, s, fmt);
  const name = 'polar_window_' + site.id.replace(/-/g, '_'), source = splSource(site, tr, ev, grid, mc, s, fmt);
  mkdirSync(ROOT + 'tools/saple/models', { recursive: true });
  writeFileSync(ROOT + 'tools/saple/models/' + name + '.spl', source);
  const run = runSaple(saple!, source, name + '.spl');
  if (!run.ok) { console.error('saple failed: ' + run.error); process.exit(1); }
  // the two hourly arrays repeat in every witness; keep them once, in the model file
  const slim = run.findings.map((f) => ({ ...f, witness: f.witness && Object.fromEntries(Object.entries(f.witness).filter(([k]) => k !== 'sunMargin' && k !== 'earthMargin')) }));
  writeFileSync(ROOT + 'tools/saple/models/' + name + '.saple.json', JSON.stringify({ saple: saple!.version, commit: saple!.commit, command: `saple --format json analyze ${name}.spl --no-auto-load`, exit: run.exit, warnings: run.warnings, findings: slim }, null, 1));
  const reading = readSaple(run.findings), cmp = compareWithRuleCheck(reading, mc, grid);
  const pl = forwardSeq(lstm, staySequence(tr, ev, grid, 0, s)!).p;
  const at = (h: number | null) => (h == null ? '' : ' at ' + fmt(mc.startMs + h * 3600e3) + ` (+${h} h)`);
  const col = (x: string, n: number) => (x + ' '.repeat(n)).slice(0, n);
  console.log(`\n${site.name} · landing ${fmt(mc.startMs)} UTC · stay ${s.stayDays} d · battery ${s.reserveH} h · contact ${s.goPct}% · mast ${s.mastM} m`);
  console.log(`${saple!.version}${saple!.commit ? ' (commit ' + saple!.commit + ')' : ''} · tools/saple/models/${name}.spl · ${stayEvents(ev, grid, mc.startIndex, mc.endIndex).length} Sun/Earth events · ${run.ms} ms\n`);
  console.log(col('Rule', 13) + col('SAPLE', 40) + col('Direct calculation', 40) + 'AI (LSTM + attention)');
  reading.rules.forEach((v, r) => {
    const rule = mc.rules.find((x) => x.id === v.id)!, c = cmp[r];
    const net = (p: number) => col((p >= 0.5 ? 'holds ' : 'fails ') + Math.round(100 * Math.max(p, 1 - p)) + '%', 14);
    console.log(col(v.id, 13) + col((v.holds ? 'holds' : 'violated' + at(v.failH)), 40) + col((rule.holds ? 'holds' : 'violated' + at(c.ruleH)), 40) + net(pl[r]).trim()
      + (c.sameVerdict && c.sameHour ? '' : '   <-- differs'));
  });
  console.log(`\nPoint in the model: ${Math.abs(site.lat).toFixed(4)}° ${site.lat < 0 ? 'S' : 'N'}, ${Math.abs(site.lonE).toFixed(4)}° ${site.lonE < 0 ? 'W' : 'E'}`
    + (reading.point ? `; read back from SAPLE's state: ${Math.abs(reading.point.lat).toFixed(4)}° ${reading.point.lat < 0 ? 'S' : 'N'}, ${Math.abs(reading.point.lonE).toFixed(4)}° ${reading.point.lonE < 0 ? 'W' : 'E'}` : ' (no finding to read it back from)'));
  const warnings = seriousWarnings(run.warnings);
  for (const w of warnings) console.log('\n' + w);
  if (reading.unexpected.length) console.log('\nOther findings: ' + reading.unexpected.join('; '));
  const same = cmp.every((c) => c.sameVerdict && c.sameHour) && reading.complete && !warnings.length && !reading.unexpected.length;
  console.log('\n' + (!reading.complete ? 'SAPLE did not reach lift-off: the model is stuck, so no verdict can be trusted.'
    : same ? 'SAPLE and the direct calculation agree on all 5 rules, and on the hour of every failure.' : 'SAPLE and the direct calculation DIFFER. See the rows marked above.'));
  process.exit(same ? 0 : 1);
}

function batch(perSite: number) {
  function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rnd = mulberry32(20261113), pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const MASTS = [0, 2, 10, 50], STAYS = [6.5, 10, 14];
  const tally = SAPLE_RULES.map((id) => ({ id, holds: 0, fails: 0, sameVerdict: 0, hoursCompared: 0, sameHour: 0, lstm: 0 }));
  let missions = 0, allSame = 0, incomplete = 0, warned = 0, failedRuns = 0, maxEvents = 0, msTotal = 0;
  const differ: string[] = [];
  const t0 = Date.now();
  for (const [stepMin, n] of [[60, perSite], [180, Math.ceil(perSite / 4)]] as const) {
    const grid = buildGrid(Date.UTC(2026, 0, 1), Date.UTC(2030, 0, 1), stepMin), eg = ephemGrid(grid);
    console.log(`${stepMin}-minute grid: ${n} missions at each of ${sites.length} sites`);
    for (const site of sites) {
      const tr = siteTracks(eg, site), prof = profile(site);
      const evs = MASTS.map((m) => evaluate(eg, tr, maskForHeight(prof, m), { ...DEFAULT_SETTINGS, mastM: m }));
      for (let q = 0; q < n; q++) {
        const mi = Math.floor(rnd() * MASTS.length);
        const s: Settings = { ...DEFAULT_SETTINGS, mastM: MASTS[mi], stayDays: pick(STAYS), reserveH: 2 * Math.floor(rnd() * 61), goPct: 5 * Math.floor(rnd() * 21) };
        const start = Math.floor(rnd() * (grid.n - 2 - stayLength(grid, s))), ev = evs[mi];
        const mc = checkMission(ev, grid, start, s, fmt);
        const run = runSaple(saple!, splSource(site, tr, ev, grid, mc, s, fmt));
        missions++; msTotal += run.ms;
        const label = `${site.id} ${fmt(timeAt(grid, start))} stay ${s.stayDays} d, battery ${s.reserveH} h, contact ${s.goPct}%, mast ${s.mastM} m, step ${stepMin} min`;
        if (!run.ok) { failedRuns++; differ.push(label + ': ' + run.error); continue; }
        const reading = readSaple(run.findings), cmp = compareWithRuleCheck(reading, mc, grid);
        maxEvents = Math.max(maxEvents, stayEvents(ev, grid, mc.startIndex, mc.endIndex).length);
        if (!reading.complete) incomplete++;
        if (seriousWarnings(run.warnings).length || reading.unexpected.length) warned++;
        const pl = forwardSeq(lstm, staySequence(tr, ev, grid, start, s)!).p;
        reading.rules.forEach((v, r) => {
          const t = tally[r], c = cmp[r];
          if (v.holds) t.holds++; else t.fails++;
          if (c.sameVerdict) t.sameVerdict++;
          if (c.ruleH != null && c.sapleH != null) { t.hoursCompared++; if (c.sameHour) t.sameHour++; }
          if ((pl[r] >= 0.5) === v.holds) t.lstm++;
        });
        const ok = reading.complete && cmp.every((c) => c.sameVerdict && c.sameHour);
        if (ok) allSame++; else differ.push(label + ': ' + cmp.filter((c) => !c.sameVerdict || !c.sameHour).map((c) => `${c.id} direct calculation ${c.ruleH}, SAPLE ${c.sapleH}`).join('; '));
      }
    }
  }
  const report = {
    saple: { version: saple!.version, commit: saple!.commit ?? null }, date: new Date().toISOString().slice(0, 10),
    missions, sites: sites.length, period: '2026–2029', grids: 'hourly and three-hourly',
    allRulesSame: allSame, incomplete, withWarnings: warned, failedRuns, maxEventsInAStay: maxEvents, msPerRun: +(msTotal / missions).toFixed(1), rules: tally,
  };
  mkdirSync(ROOT + 'apps/web/public/data/saple', { recursive: true });
  writeFileSync(ROOT + 'apps/web/public/data/saple/report.json', JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
  console.log(`${missions} missions in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  for (const d of differ.slice(0, 20)) console.log('DIFFERS  ' + d);
  process.exit(differ.length || incomplete || warned ? 1 : 0);
}
