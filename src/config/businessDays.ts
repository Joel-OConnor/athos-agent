const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Q6 is counted in business days, so a case that goes out on a Friday is not
 * chased on Monday. Weekends only - Athos holidays are not modelled yet, and
 * the agent only ever proposes a follow-up time, so being a day generous is
 * the safe direction.
 */
export function addBusinessDays(iso: string, days: number): string {
  const d = new Date(iso);
  let left = days;
  while (left > 0) {
    d.setTime(d.getTime() + DAY_MS);
    if (!isWeekend(d)) left -= 1;
  }
  return d.toISOString();
}

export function businessDaysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (to <= from) return 0;
  let count = 0;
  const cursor = new Date(from.getTime());
  while (cursor < to) {
    cursor.setTime(cursor.getTime() + DAY_MS);
    if (cursor <= to && !isWeekend(cursor)) count += 1;
  }
  return count;
}

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}
