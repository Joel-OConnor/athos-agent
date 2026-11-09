import { route } from '../src/routing/route';
import { combineSignals, compare, type SignalVerdict } from '../src/routing/seonSignals';
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

describe('SEON signal combination (Q11, revised)', () => {
  it('resolves on one account signal when the other is unavailable', () => {
    const d = route(loadCase('011-partial-seon-signals.json'));
    expect(d.signals?.phoneAccounts).toBe('unknown');
    expect(d.signals?.overall).toBe('looks_real');
    expect(d.path).toBe('signals_look_real');
  });

  it('treats an out-of-US IP as a red flag that overrides a positive', () => {
    const packet = loadCase('011-partial-seon-signals.json');
    packet.seon.signals.ipCountry = 'PT';
    expect(route(packet).signals?.overall).toBe('looks_fake');
  });

  it('needs at least one positive, not merely the absence of a flag', () => {
    const packet = loadCase('011-partial-seon-signals.json');
    packet.seon.signals.emailAccountCount = 2;
    const d = route(packet);
    expect(d.signals?.overall).toBe('looks_fake');
    expect(d.path).toBe('vet_rental_houses');
  });

  it('says so when neither account count was available', () => {
    const packet = loadCase('011-partial-seon-signals.json');
    packet.seon.signals.emailAccountCount = null;
    const d = route(packet);
    expect(d.signals?.overall).toBe('looks_fake');
    expect(d.warnings.join(' ')).toMatch(/no positive evidence either way/);
  });
});

describe('combineSignals: every rule Athos could switch to', () => {
  const v = (e: SignalVerdict, p: SignalVerdict, ip: SignalVerdict) => ({
    emailAccounts: e,
    phoneAccounts: p,
    ipLocation: ip,
  });

  it('is undetermined with nothing known, under any rule', () => {
    for (const rule of [
      'positive_unless_flagged',
      'all_must_pass',
      'majority',
    ] as const) {
      expect(combineSignals(rule, v('unknown', 'unknown', 'unknown'))).toBe(
        'undetermined'
      );
    }
  });

  it('positive_unless_flagged: one positive and no red flag is real', () => {
    expect(combineSignals('positive_unless_flagged', v('pass', 'unknown', 'pass'))).toBe(
      'looks_real'
    );
    expect(combineSignals('positive_unless_flagged', v('pass', 'pass', 'flag'))).toBe(
      'looks_fake'
    );
    expect(combineSignals('positive_unless_flagged', v('flag', 'flag', 'pass'))).toBe(
      'looks_fake'
    );
  });

  it('all_must_pass: needs all three known and passing', () => {
    expect(combineSignals('all_must_pass', v('pass', 'pass', 'pass'))).toBe('looks_real');
    expect(combineSignals('all_must_pass', v('pass', 'unknown', 'pass'))).toBe(
      'looks_fake'
    );
    expect(combineSignals('all_must_pass', v('pass', 'pass', 'flag'))).toBe('looks_fake');
  });

  it('majority: more passes than flags among what is known', () => {
    expect(combineSignals('majority', v('pass', 'flag', 'pass'))).toBe('looks_real');
    expect(combineSignals('majority', v('pass', 'flag', 'flag'))).toBe('looks_fake');
    expect(combineSignals('majority', v('pass', 'flag', 'unknown'))).toBe('looks_fake');
  });
});

describe('compare', () => {
  it('reads "over 5" strictly and "at least 5" inclusively', () => {
    expect(compare(5, 5, 'greater_than')).toBe(false);
    expect(compare(6, 5, 'greater_than')).toBe(true);
    expect(compare(5, 5, 'at_least')).toBe(true);
  });
});

describe('route: the remaining branches', () => {
  it('falls back to vetting, with a warning, when no SEON signal is available', () => {
    const packet = loadCase('004-under-100k-flagged-looks-fake.json');
    packet.seon.signals = {
      emailAccountCount: null,
      phoneAccountCount: null,
      ipCountry: null,
      ipRegion: null,
      ipCity: null,
      ipDistanceMilesFromAddress: null,
    };
    const d = route(packet);
    expect(d.path).toBe('vet_rental_houses');
    expect(d.signals?.overall).toBe('undetermined');
    expect(d.warnings.join(' ')).toMatch(/No SEON signals/);
  });

  it('treats a foreign applicant address as a foreign indicator even with a US IP', () => {
    const packet = loadCase('004-under-100k-flagged-looks-fake.json');
    packet.applicant.address.country = 'MX';
    const d = route(packet);
    expect(d.foreignIndicator).toBe(true);
    expect(d.templates).toContain('exhibit3_us_residency');
  });

  it('refuses a product outside the workflow', () => {
    const packet = loadCase('001-clean-100k-seon-approve.json');
    const d = route({ ...packet, product: 'stp' as never });
    expect(d.path).toBe('out_of_scope');
  });
});
