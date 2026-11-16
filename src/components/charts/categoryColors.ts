import type { Hue } from '../ui/hue';
import { SUMMARY_CATEGORY_LABELS, type PeriodKey, type PeriodSpending, type Satang, type SummaryCategory } from '../../types/finance';

// Five chromatic mark hues from tokens.css; `stone` is reserved for "อื่นๆ" (other) and "ลืมจด" (unknown).
export const CHROMATIC_HUES: readonly Hue[] = ['sky', 'teal', 'apricot', 'rose', 'lilac'];

export interface StackedSeriesItem {
  category: SummaryCategory;
  label: string;
  hue: Hue;
  /** Distinguish 'unknown' ("ลืมจด") from 'other' ("อื่นๆ") using the muted token when both share stone. */
  useMutedFill: boolean;
}

export interface StackedSegment {
  category: SummaryCategory;
  amount: Satang;
  hue: Hue;
  useMutedFill: boolean;
}

export interface StackedPeriodBar {
  periodKey: PeriodKey;
  total: Satang;
  segments: StackedSegment[];
}

export interface StackedHistoryResult {
  series: StackedSeriesItem[];
  bars: StackedPeriodBar[];
}

/**
 * Assigns consistent token hues across categories for both the horizontal breakdown and 6-period chart.
 * Sorting by 6-period total keeps top categories on the five chromatic hues without flicker on ties.
 */
export function buildCategoryColorMap(
  history: PeriodSpending[],
  current?: PeriodSpending,
): Map<SummaryCategory, Hue> {
  const totals = new Map<SummaryCategory, Satang>();
  const seenPeriods = new Set<PeriodKey>();

  const accumulate = (period: PeriodSpending) => {
    for (const c of period.categories) {
      if (c.amount <= 0) continue;
      totals.set(c.category, (totals.get(c.category) ?? 0) + c.amount);
    }
  };

  for (const period of history) {
    seenPeriods.add(period.periodKey);
    accumulate(period);
  }
  if (current && !seenPeriods.has(current.periodKey)) {
    accumulate(current);
  } else if (current) {
    // Ensure any category present in `current` (e.g., if `history` was mocked independently) gets a colour.
    for (const c of current.categories) {
      if (c.amount > 0 && !totals.has(c.category)) {
        totals.set(c.category, c.amount);
      }
    }
  }

  const map = new Map<SummaryCategory, Hue>();
  map.set('other', 'stone');
  map.set('unknown', 'stone');

  const ranked = Array.from(totals.entries())
    .filter(([cat]) => cat !== 'other' && cat !== 'unknown')
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  ranked.forEach(([cat], index) => {
    map.set(cat, index < CHROMATIC_HUES.length ? CHROMATIC_HUES[index] : 'stone');
  });

  return map;
}

/**
 * Prepares chronologically ordered 6-period bars and folds >6 categories into "อื่นๆ" (`other`, stone)
 * so the stacked chart stays readable with existing design tokens (SPEC §3).
 */
export function buildStackedHistory(
  history: PeriodSpending[],
  colorMap: Map<SummaryCategory, Hue>,
): StackedHistoryResult {
  const ordered = [...history]
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey))
    .slice(-6);

  const totals = new Map<SummaryCategory, Satang>();
  for (const period of ordered) {
    for (const c of period.categories) {
      if (c.amount <= 0) continue;
      totals.set(c.category, (totals.get(c.category) ?? 0) + c.amount);
    }
  }

  const activeCategories = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([cat]) => cat);

  let keptSet: Set<SummaryCategory>;
  if (activeCategories.length <= 6) {
    keptSet = new Set(activeCategories);
  } else {
    // Keep top 5 non-other categories so folding the rest into 'other' yields at most 6 distinct series.
    const nonOther = activeCategories.filter((cat) => cat !== 'other');
    keptSet = new Set(nonOther.slice(0, 5));
    keptSet.add('other');
  }

  // Order bottom-to-top: largest chromatic series at baseline, then unknown, then other at top.
  const orderedKept = Array.from(keptSet).sort((a, b) => {
    const rankSpecial = (cat: SummaryCategory) => (cat === 'other' ? 2 : cat === 'unknown' ? 1 : 0);
    const diff = rankSpecial(a) - rankSpecial(b);
    if (diff !== 0) return diff;
    return (totals.get(b) ?? 0) - (totals.get(a) ?? 0) || a.localeCompare(b);
  });

  const hasBothNeutral = keptSet.has('other') && keptSet.has('unknown');

  const series: StackedSeriesItem[] = orderedKept.map((cat) => ({
    category: cat,
    label: SUMMARY_CATEGORY_LABELS[cat],
    hue: cat === 'other' || cat === 'unknown' ? 'stone' : (colorMap.get(cat) ?? 'stone'),
    useMutedFill: cat === 'unknown' && hasBothNeutral,
  }));

  const bars: StackedPeriodBar[] = ordered.map((period) => {
    const byBucket = new Map<SummaryCategory, Satang>();
    for (const c of period.categories) {
      if (c.amount <= 0) continue;
      const target: SummaryCategory = keptSet.has(c.category) ? c.category : 'other';
      byBucket.set(target, (byBucket.get(target) ?? 0) + c.amount);
    }

    const segments: StackedSegment[] = [];
    for (const s of series) {
      const amount = byBucket.get(s.category) ?? 0;
      if (amount <= 0) continue;
      segments.push({
        category: s.category,
        amount,
        hue: s.hue,
        useMutedFill: s.useMutedFill,
      });
    }

    return {
      periodKey: period.periodKey,
      total: period.total,
      segments,
    };
  });

  return { series, bars };
}
