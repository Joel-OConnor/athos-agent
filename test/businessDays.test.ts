import { addBusinessDays, businessDaysBetween } from '../src/config/businessDays';

// 2026-11-04 is a Wednesday, 2026-11-06 a Friday.
describe('business days (Q6)', () => {
  it('skips the weekend when adding', () => {
    expect(addBusinessDays('2026-11-04T17:00:00Z', 3)).toBe('2026-11-09T17:00:00.000Z');
  });

  it('does not chase a Friday email on Monday', () => {
    expect(businessDaysBetween('2026-11-06T17:00:00Z', '2026-11-09T17:00:00Z')).toBe(1);
  });

  it('counts three business days across a weekend', () => {
    expect(businessDaysBetween('2026-11-05T17:00:00Z', '2026-11-10T17:00:00Z')).toBe(3);
  });

  it('is zero for a time in the past', () => {
    expect(businessDaysBetween('2026-11-10T17:00:00Z', '2026-11-05T17:00:00Z')).toBe(0);
  });
});
