// Polar Window component props — window.PolarWindow.<Name>. Documentation, not type-checked.
type State = 'both' | 'sun' | 'earth' | 'none';
export interface SkyHeroProps { time?: number; window?: [number, number]; exaggeration?: number; height?: number; autoplay?: boolean; scrubber?: boolean; illustrative?: boolean; }
export interface StateBadgeProps { state: State; label?: string; animateKey?: string | number; }
export interface ReadoutProps { label: string; value: number | string; decimals?: number; signed?: boolean; suffix?: string; unit?: string; state?: string; tone?: State; caption?: string; rows?: [string, string][]; bracket?: boolean; }
export interface MonthBarProps { segments?: { from: number; to: number; state: State }[]; lanes?: { sun?: [number, number][]; earth?: [number, number][] }; playhead?: number; window?: [number, number]; violations?: number[]; ticks?: [number, string][]; label?: string; }
export interface PickItemProps { name: string; quality?: QualityBadgeProps['quality']; source?: string; meta: string; sun: number; earth: number; segments?: MonthBarProps['segments']; selected?: boolean; onClick?: () => void; }
export interface QualityBadgeProps { quality: 'region' | 'exact' | 'approximate' | 'custom'; source?: string; label?: string; }
export interface ButtonProps { variant?: 'primary' | 'quiet'; icon?: any; children?: any; disabled?: boolean; title?: string; onClick?: () => void; }
export interface PlayButtonProps { playing: boolean; onClick?: () => void; }
export interface SegmentedControlProps { label: string; options: { value: any; label: string; disabled?: boolean }[]; value?: any; onChange?: (v: any) => void; }
export interface SelectProps { label?: string; options: (string | { value: string; label: string })[]; value?: string; onChange?: (v: string) => void; }
export interface SliderProps { label: string; min: number; max: number; step?: number; value?: number; unit?: string; format?: (n: number) => string; onChange?: (n: number) => void; }
export interface PanelProps { title?: string; description?: string; note?: string; table?: any; bracket?: boolean; children?: any; }
export interface RuleRowProps { name: string; expr: string; kind: 'invariant' | 'reachable' | 'unreachable'; verdict: 'holds' | 'violated' | 'preview'; at?: string; why: string; }
export interface TerminalProps { title: string; code?: any; output?: string[]; typeOn?: boolean; runKey?: any; preview?: boolean; }
export interface GlossaryTipProps { term: string; definition: string; defaultOpen?: boolean; children?: any; }
export interface HonestyNoteProps { onSky?: boolean; children: any; }
export interface HorizonRuleProps { litFrom?: number; litTo?: number; }
export interface SkeletonProps { height?: number; progress?: number; label?: string; }
