import type { Installment, InstallmentCharge } from '../types/finance';
import { addMonths, clampDay, formatISODate, parseISODate } from './date';

/** Expand an installment plan into its 1..count monthly charge schedule. */
export function installmentSchedule(inst: Installment): InstallmentCharge[] {
  if (inst.count <= 0) return [];

  const { year, month, day } = parseISODate(inst.firstChargeDate);
  const schedule: InstallmentCharge[] = [];

  for (let i = 0; i < inst.count; i++) {
    // Always add i months from the original firstChargeDate so clamping in Feb does not shift later months.
    const ym = addMonths(year, month, i);
    const chargeDate = formatISODate(ym.year, ym.month, clampDay(ym.year, ym.month, day));
    schedule.push({
      n: i + 1,
      chargeDate,
      amount: inst.perInstallment,
    });
  }

  return schedule;
}
