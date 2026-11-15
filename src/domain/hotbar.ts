import type { Category, FinanceData, HotbarItem, ISODate, Satang } from '../types/finance';
import { addDays } from './date';

export type { HotbarItem };

interface HotbarGroup {
  note: string;
  amount: Satang;
  category: Category;
  sourceId: string;
  potId: string | null;
  count: number;
  lastDate: ISODate;
  lastCreatedAt: string;
}

function normalizeNoteKey(note: string): string {
  return note.trim().replace(/\s+/g, ' ').toLowerCase();
}

function cleanDisplayNote(note: string): string {
  return note.trim().replace(/\s+/g, ' ');
}

/**
 * Returns up to `limit` frequent expense items from the last 60 days (SPEC §4 B3 & §6).
 * Groups by normalized note, amount, category, sourceId, and potId so one-tap quick add
 * can record a new transaction without ambiguity.
 */
export function hotbarItems(data: FinanceData, today: ISODate, limit = 8): HotbarItem[] {
  if (limit <= 0) return [];

  const windowStart = addDays(today, -60);
  const groups = new Map<string, HotbarGroup>();

  for (const tx of data.transactions) {
    if (tx.direction !== 'out' || tx.amount <= 0) continue;
    if (tx.date < windowStart || tx.date > today) continue;

    const normNote = normalizeNoteKey(tx.note);
    const key = `${normNote}\0${tx.amount}\0${tx.category}\0${tx.sourceId}\0${tx.potId ?? ''}`;
    const displayNote = cleanDisplayNote(tx.note);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        note: displayNote,
        amount: tx.amount,
        category: tx.category,
        sourceId: tx.sourceId,
        potId: tx.potId,
        count: 1,
        lastDate: tx.date,
        lastCreatedAt: tx.createdAt,
      });
    } else {
      existing.count += 1;
      const isNewer =
        tx.date > existing.lastDate ||
        (tx.date === existing.lastDate && tx.createdAt > existing.lastCreatedAt);
      if (isNewer) {
        existing.lastDate = tx.date;
        existing.lastCreatedAt = tx.createdAt;
        if (displayNote) {
          existing.note = displayNote;
        }
      }
    }
  }

  return Array.from(groups.values())
    .filter((g) => g.count >= 2)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (b.lastDate !== a.lastDate) return b.lastDate.localeCompare(a.lastDate);
      if (b.lastCreatedAt !== a.lastCreatedAt) return b.lastCreatedAt.localeCompare(a.lastCreatedAt);
      return a.note.localeCompare(b.note);
    })
    .slice(0, limit)
    .map(({ note, amount, category, sourceId, potId, count, lastDate }) => ({
      note,
      amount,
      category,
      sourceId,
      potId,
      count,
      lastDate,
    }));
}
