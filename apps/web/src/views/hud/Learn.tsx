// Learn mode: a short lesson card per tab with live numbers, plus a Moon-versus-Earth table on the Mission tab.
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { countdowns } from '@core/analysis';
import { fmtCountdown } from '@core/format';
import { LESSONS, MOON_VS_EARTH, lessonFacts } from '@core/lessons';
import type { LessonTab } from '@core/lessons';
import type { Analysis } from '../../state/useAnalysis';

const closed = new Set<LessonTab>(); // per session: a tab's card stays closed once closed

export function LessonCard({ a, tab, style }: { a: Analysis; tab: LessonTab; style?: CSSProperties }) {
  const [k, setK] = useState(0);
  const [, rerender] = useState(0);
  const list = LESSONS.filter((l) => l.tab === tab);
  if (!list.length || closed.has(tab) || !a.tracks || !a.ev || !a.site) return null;
  const l = list[k % list.length], i = a.t, tr = a.tracks;
  const cd = fmtCountdown(countdowns(a.ev, a.grid, a.store.t).sun, 'Sun');
  const live = lessonFacts({ sunEl: tr.sunEl[i], earthEl: tr.earthEl[i], earthLit: tr.earthLit[i], earthKm: tr.earthKm[i], sunCountdown: cd.value === '—' ? cd.label : `${cd.label} ${cd.value}`, site: a.site.name.replace(/ \(.*\)$/, ''), lat: a.site.lat });
  return (
    <section className="panel lesson" style={style} aria-label={`Lesson: ${l.title}`}>
      <div className="phead">
        <div><span className="lesson-tag">Learn</span><h3 className="title">{l.title}</h3></div>
        <div className="lesson-actions">
          {list.length > 1 && <button type="button" className="chip" onClick={() => setK(k + 1)}><b>Next tip ({(k % list.length) + 1}/{list.length})</b></button>}
          <button type="button" className="chip" aria-label="Close this lesson" onClick={() => { closed.add(tab); rerender((x) => x + 1); }}><b>Close</b></button>
        </div>
      </div>
      <p className="lesson-body">{l.body}</p>
      <div className="lesson-facts">{l.facts.map((f) => <div key={f.label}><div className="lbl">{f.label}</div><div className="val num">{f.live ? live[f.live] : f.value}</div></div>)}</div>
      {tab === 'mission' && k % list.length === 0 && (
        <div className="mve" role="table" aria-label="The Moon compared with Earth">
          <div className="mve-row head" role="row"><span role="columnheader" /><span role="columnheader">Moon</span><span role="columnheader">Earth</span></div>
          {MOON_VS_EARTH.map((r) => <div key={r.what} className="mve-row" role="row"><span role="rowheader">{r.what}</span><span>{r.moon}</span><span>{r.earth}</span></div>)}
        </div>
      )}
    </section>
  );
}
