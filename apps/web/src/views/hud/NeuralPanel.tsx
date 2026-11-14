// Check tab: the app's artificial intelligence gives a second opinion on the selected point and stay, next to the
// direct calculation and the SAPLE verification. It is an LSTM neural network with attention: it reads the stay hour by
// hour and shows which hours weighed most. It predicts; the direct calculation is exact and the SAPLE model verifies.
import { useEffect, useMemo, useState } from 'react';
import { laneRanges } from '@core/analysis';
import { fmtShort } from '@core/format';
import { NN_RULES, forwardSeq, loadNeuralSeq, staySequence } from '@core/neuralSeq';
import type { NeuralVerdict, SeqMeta, SeqModel } from '@core/neuralSeq';
import type { SapleReading } from '@core/spl';
import type { RuleResult } from '@core/types';
import type { Analysis } from '../../state/useAnalysis';

type Seq = { model: SeqModel; meta: SeqMeta };

function useLoaded<T>(load: () => Promise<T | null>): T | null | 'loading' {
  const [v, set] = useState<T | null | 'loading'>('loading');
  useEffect(() => { let alive = true; load().then((m) => { if (alive) set(m); }); return () => { alive = false; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

/** The network's verdicts and attention for the current site, landing and settings. */
export function useNeural(a: Analysis) {
  const seq = useLoaded<Seq>(loadNeuralSeq);
  const s = a.store, start = a.mission?.start;
  const out = useMemo(() => {
    if (!seq || seq === 'loading' || !a.tracks || !a.ev || start == null) return null;
    const q = staySequence(a.tracks, a.ev, a.grid, start, s.settings);
    if (!q) return null;
    const r = forwardSeq(seq.model, q), band = seq.meta.report.unsureBand;
    const verdicts: NeuralVerdict[] = r.p.map((p, k) => ({ id: NN_RULES[k], p, holds: p >= 0.5, unsure: p > band[0] && p < band[1] }));
    return { verdicts, attention: r.attention, hours: q.T };
  }, [seq, a.tracks, a.ev, a.grid, start, s.settings]);
  return { loading: seq === 'loading', meta: seq && seq !== 'loading' ? seq.meta : null, ...(out ?? { verdicts: null, attention: null, hours: 0 }) };
}

const pct = (v: number, dp = 1) => { const t = (v * 100).toFixed(dp); return (t.startsWith('100') ? '100' : t) + '%'; };
const ATT = '#B58CFF';

function Cell({ v, rule }: { v: NeuralVerdict | undefined; rule: RuleResult }) {
  if (!v) return <span className="nn-cell" style={{ color: '#7E8898' }}>—</span>;
  const conf = v.holds ? v.p : 1 - v.p, col = v.unsure ? '#FFB547' : v.holds ? '#4FDDB4' : '#FF6E5E', same = v.holds === rule.holds;
  return (
    <span className={'nn-cell' + (same ? '' : ' differs')} style={{ color: col }} title={same ? 'Agrees with the direct calculation' : 'Differs from the direct calculation'}>
      <b className="num">{same ? '' : '✗ '}{v.holds ? 'Holds' : 'Fails'} · {pct(conf)}</b>{v.unsure && <small> unsure</small>}
    </span>
  );
}

/** The shortest run of hours that holds `share` of the attention. */
export function attentionSpan(w: ArrayLike<number>, share = 0.8): [number, number] {
  let best: [number, number] = [0, w.length - 1], sum = 0, lo = 0;
  for (let hi = 0; hi < w.length; hi++) {
    sum += w[hi];
    while (sum - w[lo] >= share - 1e-6) sum -= w[lo++];
    if (sum >= share - 1e-6 && hi - lo < best[1] - best[0]) best = [lo, hi];
  }
  return best;
}

/** Where the network looked for one rule: attention per hour over the stay, above the Sun and Earth lanes. */
function AttentionStrip({ a, weights, hours, rule }: { a: Analysis; weights: Float32Array; hours: number; rule: RuleResult }) {
  const mc = a.mission!.mc, ev = a.ev!, W = 1000, top = 6, hA = 54;
  let max = 0; for (let t = 0; t < weights.length; t++) max = Math.max(max, weights[t]);
  const bw = W / hours, msAt = (h: number) => mc.startMs + (h / hours) * (mc.endMs - mc.startMs);
  let d = `M0 ${top + hA}`;
  for (let t = 0; t < hours; t++) { const y = top + hA - (weights[t] / (max || 1)) * hA; d += ` L${(t * bw).toFixed(1)} ${y.toFixed(1)} L${((t + 1) * bw).toFixed(1)} ${y.toFixed(1)}`; }
  d += ` L${W} ${top + hA} Z`;
  const lane = (r: [number, number][], y: number, col: string) => r.map(([f, t], k) => <rect key={k} x={f * W} y={y} width={Math.max(1, (t - f) * W)} height={7} rx={2} fill={col} />);
  const [s0, s1] = attentionSpan(weights), failH = rule.firstFailMs != null ? ((rule.firstFailMs - mc.startMs) / (mc.endMs - mc.startMs)) * hours : null;
  return (
    <div className="nn-att">
      <div className="lbl">Where the AI looked · {rule.title}</div>
      <svg viewBox={`0 0 ${W} 92`} preserveAspectRatio="none" role="img" aria-label={`Attention over the stay for the rule ${rule.title}: 80% of it falls between ${s0} and ${s1 + 1} hours after landing`}>
        <rect x={s0 * bw} y={top - 4} width={(s1 + 1 - s0) * bw} height={hA + 4} fill={ATT} fillOpacity={0.1} />
        <path d={d} fill={ATT} fillOpacity={0.55} stroke={ATT} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {failH != null && <line x1={failH * bw} x2={failH * bw} y1={top - 4} y2={88} stroke="#FF6E5E" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
        <rect x={0} y={68} width={W} height={7} rx={2} fill="rgba(255,255,255,.08)" />{lane(laneRanges(ev.sunUp, mc.startIndex, mc.endIndex), 68, '#FFB547')}
        <rect x={0} y={80} width={W} height={7} rx={2} fill="rgba(255,255,255,.08)" />{lane(laneRanges(ev.earthUp, mc.startIndex, mc.endIndex), 80, '#4FA8FF')}
      </svg>
      <div className="nn-att-axis"><span>Landing</span><span className="nn-keys"><em><i style={{ background: ATT }} />attention</em><em><i style={{ background: '#FFB547' }} />Sun up</em><em><i style={{ background: '#4FA8FF' }} />Earth up</em>{failH != null && <em><i style={{ background: '#FF6E5E' }} />rule fails</em>}</span><span>Lift-off</span></div>
      <p className="sub">80% of the attention falls between {s0} h and {s1 + 1} h after landing ({fmtShort(msAt(s0))} to {fmtShort(msAt(s1 + 1))} UTC).
        {failH != null ? ` The direct calculation places the failure ${Math.round(failH)} h after landing (${fmtShort(rule.firstFailMs!)} UTC).` : ''} Attention shows which hours weighed most in the network’s answer. It is a hint about its reasoning, not a proof.</p>
    </div>
  );
}

export function NeuralPanel({ a, saple }: { a: Analysis; saple?: SapleReading | null }) {
  const nn = useNeural(a), rules = a.mission!.mc.rules, vs = nn.verdicts;
  const [sel, setSel] = useState<RuleResult['id'] | null>(null);
  const differs = vs ? vs.filter((v) => v.holds !== rules.find((r) => r.id === v.id)!.holds).map((v) => rules.find((r) => r.id === v.id)!.title) : [];
  const sapleSame = !!saple && saple.complete && saple.rules.every((v) => v.holds === rules.find((r) => r.id === v.id)!.holds);
  // the rule whose attention is shown: the chosen one, else the first failing rule, else the battery rule
  const shown = sel ?? rules.find((r) => !r.holds)?.id ?? 'BatterySafe', shownIdx = NN_RULES.indexOf(shown), shownRule = rules.find((r) => r.id === shown)!;
  const m = nn.meta, rep = m?.report;
  const weights = m ? 4 * m.hidden * (m.inputs + m.hidden + 1) + m.att * (m.hidden + 1) + m.rules.length * (m.att + 1) + m.head * (2 * m.hidden + 1) + m.rules.length * (m.head + 1) : 0;
  return (
    <div className="panel">
      <div className="phead"><div><h3 className="title">Artificial intelligence check</h3>
        <div className="sub">A neural network (LSTM with attention) reads the hourly Sun and Earth data for this stay at {a.site?.name.replace(/ \(.*\)$/, '')} and predicts each rule. It is a second opinion learned from data, shown next to the two exact methods.</div></div></div>
      {nn.loading && <p className="sub">Loading the network…</p>}
      {!nn.loading && !m && <p className="sub">The network file could not be loaded. The direct calculation is unaffected.</p>}
      {!nn.loading && m && !vs && <p className="sub">This stay runs past the end of the chosen period, so the network has no complete data to read.</p>}
      {vs && <>
        <p className="slip-say" role="status">{differs.length === 0 ? `The AI agrees with the direct calculation${sapleSame ? ' and with SAPLE' : ''} on all ${rules.length} rules.`
          : `The AI differs on: ${differs.join('; ')}. Trust the direct calculation.`}</p>
        <div className={'nn-rows' + (saple ? ' with-saple' : '')} role="table" aria-label="The AI prediction, the direct calculation and SAPLE for each mission rule">
          <div className="nn-row head" role="row"><span role="columnheader">Rule</span><span role="columnheader">Artificial intelligence</span><span role="columnheader">Direct calculation</span>{saple && <span role="columnheader">SAPLE</span>}</div>
          {rules.map((rule) => (
            <button key={rule.id} type="button" role="row" className="nn-row" aria-pressed={shown === rule.id} onClick={() => setSel(rule.id)} title="Show where the AI looked for this rule">
              <span role="rowheader">{rule.title}</span>
              <Cell v={vs.find((v) => v.id === rule.id)} rule={rule} />
              <span className="nn-cell" style={{ color: rule.holds ? '#4FDDB4' : '#FF6E5E' }}><b>{rule.holds ? 'Pass' : 'Fail'}</b></span>
              {saple && (() => {
                const v = saple.rules.find((x) => x.id === rule.id)!, same = v.holds === rule.holds;
                return <span className={'nn-cell' + (same ? '' : ' differs')} style={{ color: v.holds ? '#4FDDB4' : '#FF6E5E' }} title={same ? 'SAPLE agrees with the direct calculation' : 'SAPLE differs from the direct calculation'}><b>{same ? '' : '✗ '}{v.holds ? 'Pass' : 'Fail'}</b></span>;
              })()}
            </button>
          ))}
        </div>
        <dl className="nn-legend">
          <div><dt>Artificial intelligence</dt><dd>An LSTM neural network with attention. It learned the rules from {rep ? rep.trainedOn.stays.toLocaleString('en-US') : 'many'} example stays and gives a prediction with a confidence. It can be wrong.</dd></div>
          <div><dt>Direct calculation</dt><dd>The app’s own exact calculation. It goes through every hour of the stay and applies the five rules directly to the Sun and Earth data. Nothing is learned or estimated.</dd></div>
          <div><dt>SAPLE</dt><dd>Formal verification. The stay is written as a process-algebra model and the SAPLE engine explores every order of events to check the same rules independently.{saple ? '' : ' It runs on a local machine; see the note under the model.'}</dd></div>
        </dl>
        {nn.attention && shownIdx >= 0 && <AttentionStrip a={a} weights={nn.attention[shownIdx]} hours={nn.hours} rule={shownRule} />}
      </>}
      {m && rep && <>
        <div className="nn-cmp" role="table" aria-label="How the AI did on stays it never saw">
          <div className="nn-cmp-row head" role="row"><span role="columnheader">{rep.unseenSites.sites} unseen sites</span><span role="columnheader">Unseen year {rep.unseenYear.year}</span><span role="columnheader">Weakest rule</span><span role="columnheader">Weights</span></div>
          <div className="nn-cmp-row" role="row">
            <span className="num">{pct(rep.unseenSites.allRules, 2)}</span><span className="num">{pct(rep.unseenYear.allRules, 2)}</span>
            <span className="num">{pct(Math.min(...rep.unseenSites.ruleAccuracy, ...rep.unseenYear.ruleAccuracy), 2)}</span><span className="num">{weights.toLocaleString('en-US')}</span>
          </div>
        </div>
        <p className="sub nn-card">Trained on {rep.trainedOn.stays.toLocaleString('en-US')} stays at {rep.trainedOn.sites} catalogued sites, {rep.trainedOn.years}, labelled by the direct calculation.
          The first two columns give the share of stays with all five rules right on data it never saw; “weakest rule” is its lowest accuracy on any single rule.</p>
      </>}
    </div>
  );
}
