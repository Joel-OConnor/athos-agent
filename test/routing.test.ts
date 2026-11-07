import { route } from '../src/routing/route';
import { thresholds } from '../src/config/thresholds';
import { loadCase } from './helpers';

describe('route', () => {
  it('sends $100K+ to rental-house vetting even when SEON approved', () => {
    const d = route(loadCase('001-clean-100k-seon-approve.json'));
    expect(d.path).toBe('vet_rental_houses');
    expect(d.atOrOverReferralLimit).toBe(true);
    expect(d.templates).toContain('exhibit1_rental_house_vetting');
  });

  it('treats exactly $100K as at the referral limit', () => {
    const packet = loadCase('001-clean-100k-seon-approve.json');
    packet.rentedEquipmentLimit = thresholds.referralLimitUsd;
    expect(route(packet).atOrOverReferralLimit).toBe(true);
  });

  it('lets an under-$100K SEON approval continue with no review', () => {
    const packet = loadCase('001-clean-100k-seon-approve.json');
    packet.rentedEquipmentLimit = 99_999;
    expect(route(packet).path).toBe('no_review_needed');
  });

  it('adds the US-residency email when SEON places the customer abroad', () => {
    const d = route(loadCase('002-seon-review-foreign.json'));
    expect(d.foreignIndicator).toBe(true);
    expect(d.templates).toContain('exhibit3_us_residency');
  });

  it('routes a gated case to underwriting and sends nothing', () => {
    const d = route(loadCase('006-underwriting-gates.json'));
    expect(d.path).toBe('underwriting_gate');
    expect(d.templates).toHaveLength(0);
  });

  it('declines only on SEON confirmed fraud, not on a decline state alone', () => {
    const packet = loadCase('005-seon-confirmed-fraud.json');
    expect(route(packet).path).toBe('confirmed_fraud');

    packet.seon.confirmedFraud = false;
    packet.rentedEquipmentLimit = 220_000;
    expect(route(packet).path).toBe('vet_rental_houses');
  });

  it('reads a flagged under-$100K case off the three SEON signals', () => {
    expect(route(loadCase('003-under-100k-flagged-looks-real.json')).path).toBe(
      'signals_look_real'
    );
    expect(route(loadCase('004-under-100k-flagged-looks-fake.json')).path).toBe(
      'vet_rental_houses'
    );
  });

  it('treats a missing SEON signal as unknown, never as a failure', () => {
    const packet = loadCase('003-under-100k-flagged-looks-real.json');
    packet.seon.signals.emailAccountCount = null;
    packet.seon.signals.phoneAccountCount = null;
    const d = route(packet);
    expect(d.signals?.emailAccounts).toBe('unknown');
    expect(d.warnings.join(' ')).toMatch(/not available/);
  });

  it('every reason cites a packet field or a URL', () => {
    for (const f of [
      '001-clean-100k-seon-approve.json',
      '004-under-100k-flagged-looks-fake.json',
      '006-underwriting-gates.json',
    ]) {
      for (const r of route(loadCase(f)).reasons) {
        expect(r.evidence.length).toBeGreaterThan(0);
        for (const e of r.evidence) {
          expect(Boolean(e.field) || Boolean(e.sourceUrl)).toBe(true);
        }
      }
    }
  });
});
