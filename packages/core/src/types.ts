// Shared data shapes for Polar Window. Angles in degrees, times in UTC milliseconds, lengths as named.

export type SkyState = 'both' | 'sun' | 'earth' | 'none';
export type Quality = 'region' | 'exact' | 'approximate' | 'custom';
export type SiteGroup = 'artemis-2024' | 'artemis-2022' | 'clps' | 'apollo' | 'international' | 'reference' | 'custom';
export type Mode = 'explore' | 'teach' | 'plan';
export type ViewName = 'results' | 'console';

export interface LiteratureValue { sunPct?: number; earthPct?: number; heightM?: number; ref: string; url: string }

export interface SiteDef {
  id: string;
  name: string;
  groups: SiteGroup[];
  lat: number;
  lonE: number;
  quality: Quality;
  sourceUrl: string;
  notes: string;
  elevM: number;
  horizonUrl?: string;
  maxHorizonDeg?: number;
  literature?: LiteratureValue[];
  /** NASA LOLA long-term averages at ground level (only inside the maps, 65 S to the pole). */
  avgSunPct?: number;
  avgEarthPct?: number;
  psr?: boolean;
  illumInset?: string;
}

/** Horizon masks for several observer heights; maskDeg[h][k] is the skyline elevation at azimuth k * azStepDeg. */
export interface HorizonProfile {
  siteId: string;
  elevM: number;
  heightsM: number[];
  azStepDeg: number;
  maskDeg: number[][];
  distKm: number[];
  coverage: number;
  resM: number;
  source: 'lola240' | 'lola480' | 'lola1900' | 'flat';
}

export interface TimeGrid { t0Ms: number; stepMin: number; n: number }

/** Site-independent geometry per time step: Moon-centred body-fixed vectors (km). */
export interface EphemGrid { grid: TimeGrid; sun: Float64Array; earth: Float64Array; sunDistAU: Float64Array }

/** Topocentric tracks for one site (degrees). */
export interface Tracks {
  sunAz: Float32Array; sunEl: Float32Array; sunR: Float32Array;
  earthAz: Float32Array; earthEl: Float32Array; earthR: Float32Array; earthKm: Float32Array;
  earthLit: Float32Array;
}

export interface Settings {
  mastM: number;          // observer / mast height above ground, 0-50 m
  minEarthElDeg: number;  // extra minimum Earth elevation; -90 = off (terrain only), else 2 or 5 deg
  eta: number;            // cell efficiency, default 0.30
  stayDays: number;       // 6.5 | 10 | 14
  reserveH: number;       // battery covers this many hours of darkness
  goPct: number;          // Earth contact needed during the stay, %
}

/** Per-hour evaluation of one site. */
export interface Evaluation {
  sunUp: Uint8Array; earthUp: Uint8Array; state: Uint8Array; // state: 0 none, 1 sun, 2 earth, 3 both
  maskSun: Float32Array; maskEarth: Float32Array;
  powerW: Float32Array;  // electrical W per m2 of a vertical Sun-tracking array
}

export interface Metrics {
  sunPct: number; earthPct: number; bothPct: number; nonePct: number;
  longestDarkH: number; longestGapH: number;
  meanPowerW: number; energyKWh: number; areaFor10kWm2: number | null;
  dailyKWh: number[]; dailyContactH: number[];
}

export type RuleKind = 'invariant' | 'reachable' | 'unreachable';
export interface RuleResult {
  id: 'SunlitStay' | 'BatterySafe' | 'DteWindow' | 'DteCoverage' | 'Blackout';
  title: string; kind: RuleKind; expr: string;
  holds: boolean; firstFailMs: number | null; why: string;
}

export interface MissionCheck {
  startIndex: number; endIndex: number; startMs: number; endMs: number;
  rules: RuleResult[];
  battery: Float32Array; // hours of reserve left, per hour of the stay
  coveragePct: number; longestDarkH: number; firstEarthMs: number | null;
}

export interface DemGrid { width: number; height: number; scaleM: number; x0M: number; y0M: number; data: Int16Array; heightScale: number }
