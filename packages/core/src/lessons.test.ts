import { describe, expect, it } from 'vitest';
import { LESSONS, MOON_VS_EARTH, lessonFacts } from './lessons';

describe('lessons', () => {
  it('every tab has at least one lesson', () => {
    for (const tab of ['mission', 'sky', 'sites', 'compare', 'check']) expect(LESSONS.some((l) => l.tab === tab)).toBe(true);
  });
  it('keeps each lesson short', () => {
    for (const l of LESSONS) expect(l.body.length).toBeLessThanOrEqual(320);
  });
  it('has unique ids and unique fact labels within a lesson', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    for (const l of LESSONS) expect(new Set(l.facts.map((f) => f.label)).size).toBe(l.facts.length);
  });
  it('fills live facts from the current moment', () => {
    const v = lessonFacts({ sunEl: 1.234, earthEl: -0.5, earthLit: 0.42, earthKm: 384400.4, sunCountdown: 'Sunset in 5 h 20 m', site: 'Malapert Massif', lat: -85.98 });
    expect(v.sunEl).toBe('+1.2°');
    expect(v.earthEl).toBe('−0.5°');
    expect(v.earthLit).toBe('42%');
    expect(v.earthKm).toBe('384,400 km');
    const live = LESSONS.flatMap((l) => l.facts).filter((f) => f.live);
    for (const f of live) expect(v[f.live!]).toBeDefined();
  });
  it('contrasts the Moon with Earth', () => {
    expect(MOON_VS_EARTH.length).toBeGreaterThanOrEqual(4);
  });
});
