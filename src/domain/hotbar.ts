import type { FinanceData, HotbarItem, ISODate } from '../types/finance';

export type { HotbarItem };

/** Returns up to `limit` frequent expense items from the last 60 days (SPEC §4 B3 & §6). */
export function hotbarItems(data: FinanceData, today: ISODate, limit = 8): HotbarItem[] {
  void data;
  void today;
  void limit;
  throw new Error('not implemented: hotbarItems');
}
