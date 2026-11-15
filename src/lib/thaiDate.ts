// Thai abbreviated month names, indexed like Date#getMonth (0 = January).
// Hand-written instead of Intl so output is identical on every engine and ICU build.
const MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'] as const;

export function thaiMonthShort(monthIndex0: number): string {
  // Fail loudly: an off-by-one month (1-12 passed instead of 0-11) would silently show the wrong month.
  if (!Number.isInteger(monthIndex0) || monthIndex0 < 0 || monthIndex0 > 11) {
    throw new RangeError(`Month index must be an integer 0-11, got ${monthIndex0}`);
  }
  return MONTHS_SHORT[monthIndex0];
}
