import type { CasePacket, Reason } from '../contract';
import { thresholds, type CombineRule, type Comparison } from '../config/thresholds';

export type SignalVerdict = 'pass' | 'flag' | 'unknown';

export type Overall = 'looks_real' | 'looks_fake' | 'undetermined';

export interface SignalVerdicts {
  emailAccounts: SignalVerdict;
  phoneAccounts: SignalVerdict;
  ipLocation: SignalVerdict;
}

export interface SignalAssessment extends SignalVerdicts {
  overall: Overall;
  reasons: Reason[];
  warnings: string[];
}

/**
 * How the three verdicts become one answer. The workflow doc treats each
 * account count on its own as positive evidence ("this appears to be a real
 * person") and the IP location only as a red flag; they are not three equal
 * votes. The other two rules are kept so Athos can switch if they disagree.
 */
export function combineSignals(rule: CombineRule, v: SignalVerdicts): Overall {
  const all = [v.emailAccounts, v.phoneAccounts, v.ipLocation];
  const knowns = all.filter((x) => x !== 'unknown').length;
  if (knowns === 0) return 'undetermined';

  const positives = [v.emailAccounts, v.phoneAccounts].filter((x) => x === 'pass').length;
  const flags = all.filter((x) => x === 'flag').length;
  const redFlag = v.ipLocation === 'flag';

  switch (rule) {
    case 'all_must_pass':
      return knowns === 3 && positives === 2 && !redFlag ? 'looks_real' : 'looks_fake';
    case 'majority':
      return knowns - flags > flags ? 'looks_real' : 'looks_fake';
    case 'positive_unless_flagged':
      return positives > 0 && !redFlag ? 'looks_real' : 'looks_fake';
  }
}

export function compare(value: number, min: number, mode: Comparison): boolean {
  return mode === 'greater_than' ? value > min : value >= min;
}

/**
 * The three checks the workflow doc reads off the SEON report for an under-$100K
 * flagged account. A null signal is 'unknown', never a failure - we simply do
 * not have the data, and the person reviewing must be told so.
 */
export function assessSeonSignals(packet: CasePacket): SignalAssessment {
  const s = packet.seon.signals;
  const reasons: Reason[] = [];
  const warnings: string[] = [];

  let emailAccounts: SignalVerdict = 'unknown';
  if (s.emailAccountCount === null) {
    warnings.push('SEON email account count not available on this case.');
  } else {
    const ok = compare(
      s.emailAccountCount,
      thresholds.seon.minEmailAccounts,
      thresholds.seon.emailAccountsComparison
    );
    emailAccounts = ok ? 'pass' : 'flag';
    reasons.push({
      code: ok ? 'SEON_EMAIL_ACCOUNTS_OK' : 'SEON_EMAIL_ACCOUNTS_LOW',
      message: `Email appears on ${s.emailAccountCount} account(s); threshold is over ${thresholds.seon.minEmailAccounts}.`,
      evidence: [{ field: 'seon.signals.emailAccountCount' }],
    });
  }

  let phoneAccounts: SignalVerdict = 'unknown';
  if (s.phoneAccountCount === null) {
    warnings.push('SEON phone account count not available on this case.');
  } else {
    const ok = compare(
      s.phoneAccountCount,
      thresholds.seon.minPhoneAccounts,
      thresholds.seon.phoneAccountsComparison
    );
    phoneAccounts = ok ? 'pass' : 'flag';
    reasons.push({
      code: ok ? 'SEON_PHONE_ACCOUNTS_OK' : 'SEON_PHONE_ACCOUNTS_LOW',
      message: `Phone appears on ${s.phoneAccountCount} account(s); threshold is over ${thresholds.seon.minPhoneAccounts}.`,
      evidence: [{ field: 'seon.signals.phoneAccountCount' }],
    });
  }

  let ipLocation: SignalVerdict = 'unknown';
  const addr = packet.applicant.address;
  if (s.ipCountry === null) {
    warnings.push('SEON IP geolocation not available on this case.');
  } else {
    // Q3: anywhere in the USA is fine. Only an IP outside the US is a flag, so
    // an applicant working away from home does not trip this.
    const differentCountry =
      thresholds.seon.ipDifferentCountryIsFlag && s.ipCountry !== 'US';
    const differentState =
      thresholds.seon.ipDifferentStateIsFlag &&
      s.ipRegion !== null &&
      addr.state !== null &&
      s.ipRegion !== addr.state;
    const farByMiles =
      thresholds.seon.ipFarAwayMiles !== null &&
      s.ipDistanceMilesFromAddress !== null &&
      s.ipDistanceMilesFromAddress > thresholds.seon.ipFarAwayMiles;

    const flagged = differentCountry || differentState || farByMiles;
    ipLocation = flagged ? 'flag' : 'pass';
    reasons.push({
      code: flagged ? 'SEON_IP_OUTSIDE_US' : 'SEON_IP_LOCATION_OK',
      message: flagged
        ? `IP geolocation (${s.ipCity ?? '?'}, ${s.ipRegion ?? '?'}, ${s.ipCountry}) places the customer outside the US.`
        : `IP geolocation is inside the US (${s.ipCity ?? '?'}, ${s.ipRegion ?? '?'}).`,
      evidence: [{ field: 'seon.signals.ipCountry' }, { field: 'applicant.address' }],
    });
  }

  const overall = combineSignals(thresholds.seon.combineRule, {
    emailAccounts,
    phoneAccounts,
    ipLocation,
  });

  if (
    overall === 'looks_fake' &&
    emailAccounts === 'unknown' &&
    phoneAccounts === 'unknown' &&
    thresholds.seon.combineRule === 'positive_unless_flagged'
  ) {
    warnings.push(
      'Neither SEON account count was available, so there is no positive evidence either way. Falling back to rental-house vetting.'
    );
  }

  return { emailAccounts, phoneAccounts, ipLocation, overall, reasons, warnings };
}
