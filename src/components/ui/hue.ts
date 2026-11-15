// The six tile hues from tokens.css (four core, two spare).
export type Hue = 'sky' | 'apricot' | 'teal' | 'stone' | 'lilac' | 'rose';

// Static maps, never `bg-${hue}-bg`: Tailwind scans source for whole class names and
// would purge any class it only ever sees assembled at runtime.
export const HUE_TILE: Record<Hue, string> = {
  sky: 'bg-sky-bg text-sky-ink',
  apricot: 'bg-apricot-bg text-apricot-ink',
  teal: 'bg-teal-bg text-teal-ink',
  stone: 'bg-stone-bg text-stone-ink',
  lilac: 'bg-lilac-bg text-lilac-ink',
  rose: 'bg-rose-bg text-rose-ink',
};

// Solid fill for chart marks (AllocationBar segments, dots).
export const HUE_MARK: Record<Hue, string> = {
  sky: 'bg-sky-mark',
  apricot: 'bg-apricot-mark',
  teal: 'bg-teal-mark',
  stone: 'bg-stone-mark',
  lilac: 'bg-lilac-mark',
  rose: 'bg-rose-mark',
};
