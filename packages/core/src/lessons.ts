// Learn mode: short lessons for educators and the public, one or more per tab, with live numbers from the current
// moment where that makes the point. Facts are physical constants or NASA figures; nothing is invented.
import { signed } from './format';

export type LessonTab = 'mission' | 'sky' | 'sites' | 'compare' | 'check';
export type LiveKey = 'sunEl' | 'earthEl' | 'earthLit' | 'earthKm' | 'sunCountdown' | 'site';
export interface Lesson { id: string; tab: LessonTab; title: string; body: string; facts: { label: string; value?: string; live?: LiveKey }[] }

export const LESSONS: Lesson[] = [
  { id: 'polar-sun', tab: 'mission', title: 'Why the Sun skims the horizon',
    body: "The Moon's spin axis is tilted only 1.54° to its path around the Sun, against Earth's 23.4°. Near the south pole the Sun never climbs more than a few degrees and circles the whole horizon once a month, so a hill a few hundred metres high can hide it for days.",
    facts: [{ label: 'Sun height now', live: 'sunEl' }, { label: "Moon's axis tilt", value: '1.54°' }, { label: "Earth's axis tilt", value: '23.44°' }] },
  { id: 'lunar-day', tab: 'mission', title: 'A day lasts a month',
    body: 'The Sun takes 29.5 Earth days to go round the lunar sky. On the equator that means about two weeks of daylight, then two weeks of night. Near the pole the terrain decides: a high rim can stay lit for most of the month while a crater floor never sees the Sun.',
    facts: [{ label: 'Lunar day', value: '29.5 Earth days' }, { label: 'Next change here', live: 'sunCountdown' }] },
  { id: 'no-air', tab: 'sky', title: 'No air, no twilight',
    body: 'The Moon has no atmosphere. The sky is black even at noon, shadows have hard edges, and nothing bends light over the horizon. Sunrise happens the moment the edge of the Sun clears the skyline, and sunset is just as abrupt.',
    facts: [{ label: 'Sky colour by day', value: 'Black' }, { label: 'Twilight', value: 'None' }] },
  { id: 'still-earth', tab: 'sky', title: 'Earth hangs in one place',
    body: 'The Moon keeps the same face toward Earth, so Earth barely moves in the lunar sky. It only wobbles by about 7 to 8 degrees over a month (libration). Near the pole that wobble is enough to drop Earth behind a ridge and cut the radio link.',
    facts: [{ label: 'Earth height now', live: 'earthEl' }, { label: 'Distance now', live: 'earthKm' }, { label: 'Libration', value: 'about ±7–8°' }] },
  { id: 'earth-phase', tab: 'sky', title: "Earth's phases run opposite to the Moon's",
    body: "When people on Earth see a new Moon, an astronaut on the Moon sees a full Earth, and the other way round. Earth also looks almost four times wider than the Moon does from Earth.",
    facts: [{ label: 'Earth lit now', live: 'earthLit' }, { label: "Earth's width in the sky", value: 'about 1.9°' }] },
  { id: 'small-moves', tab: 'sites', title: 'Small moves, big changes',
    body: "NASA's laser altimeter maps show crater floors near the poles that never see sunlight, a few kilometres from rims lit most of the time. Switch the map to Sunlight or Permanent shadow and open the close-up to see how much a short move gains.",
    facts: [{ label: 'Selected site', live: 'site' }, { label: 'Map source', value: 'NASA LRO LOLA' }] },
  { id: 'far-side', tab: 'sites', title: 'The far side never sees Earth',
    body: 'Sites on the far side, like Chang\'e 4 and 6, never have Earth in their sky, so they need a relay satellite to talk to home. Sites near the edge of the near side see Earth only part of the time, as libration tips it in and out of view.',
    facts: [{ label: 'Near side', value: 'Earth always up' }, { label: 'Far side', value: 'Earth never up' }] },
  { id: 'slips', tab: 'compare', title: 'Why a short delay matters',
    body: 'Sunlight near the pole comes in long blocks separated by dark spells that can last days. A launch slip of only two or three days can move a landing from continuous sunlight into a long night, so planners check every slip before committing.',
    facts: [{ label: 'Next change here', live: 'sunCountdown' }, { label: 'Lunar day', value: '29.5 Earth days' }] },
  { id: 'rules', tab: 'check', title: 'Rules a mission must keep',
    body: 'Mission rules come in three kinds. An invariant must hold every hour, like "the battery never runs out". A reachable rule must happen at least once, like "Earth comes up". An unreachable state must never happen, like losing both the Sun and Earth at once.',
    facts: [{ label: 'Invariant', value: 'always true' }, { label: 'Reachable', value: 'happens at least once' }, { label: 'Unreachable', value: 'never happens' }] },
  { id: 'predict-prove', tab: 'check', title: 'Predicting is not proving',
    body: 'A neural network learns patterns from examples and gives a likely answer with a confidence. It can be wrong. A direct calculation or a formal model works through every hour of the stay and cannot miss one. Here the app’s AI, an LSTM network, gives a second opinion, and the direct calculation decides.',
    facts: [{ label: 'Artificial intelligence', value: 'a prediction' }, { label: 'Direct calculation and SAPLE', value: 'a proof' }] },
];

/** Side by side, to make the difference from Earth obvious. */
export const MOON_VS_EARTH: { what: string; moon: string; earth: string }[] = [
  { what: 'Length of a day', moon: '29.5 Earth days', earth: '24 hours' },
  { what: 'Sky in daylight', moon: 'Black, stars visible', earth: 'Blue' },
  { what: 'Shadows', moon: 'Sharp, pitch black', earth: 'Softened by the air' },
  { what: 'Surface temperature', moon: 'About +120 °C by day to −130 °C at night', earth: 'About −90 °C to +60 °C at the extremes' },
  { what: 'The other world in the sky', moon: 'Earth stays almost fixed', earth: 'The Moon rises and sets' },
];

export interface LessonContext { sunEl: number; earthEl: number; earthLit: number; earthKm: number; sunCountdown: string; site: string; lat: number }

export function lessonFacts(c: LessonContext): Record<LiveKey, string> {
  const deg = (v: number) => signed(v, 1).replace('-', '−') + '°';
  return {
    sunEl: deg(c.sunEl), earthEl: deg(c.earthEl), earthLit: Math.round(c.earthLit * 100) + '%',
    earthKm: Math.round(c.earthKm).toLocaleString('en-US') + ' km', sunCountdown: c.sunCountdown, site: c.site,
  };
}
