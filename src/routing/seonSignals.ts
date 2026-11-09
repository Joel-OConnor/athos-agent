import type { CasePacket, Reason } from '../contract';
import { thresholds } from '../config/thresholds';

export type SignalVerdict = 'pass' | 'flag' | 'unknown';

export interface SignalAssessment {
  emailAccounts: SignalVerdict;
  phoneAccounts: SignalVerdict;
  ipLocation: SignalVerdict;
  /** 'looks_real' | 'looks_fake' | 'undetermined' */
  overall: 'looks_real' | 'looks_fake' | 'undetermined';
  reasons: Reason[];
  warnings: string[];
}

function compare(
  value: number,
  min: number,
  mode: 'greater_than' | 'at_least'
): boolean {
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

  // The doc treats the account counts as positive evidence ("this appears to
  // be a real person") and the IP location as a red flag. They are not three
  // equal votes.
  const positives = [emailAccounts, phoneAccounts].filter((v) => v === 'pass').length;
  const redFlag = ipLocation === 'flag';
  const accountSignalsKnown = [emailAccounts, phoneAccounts].filter(
    (v) => v !== 'unknown'
  ).length;
  const knowns = [emailAccounts, phoneAccounts, ipLocation].filter(
    (v) => v !== 'unknown'
  ).length;

  let overall: SignalAssessment['overall'];
  if (knowns === 0) {
    overall = 'undetermined';
  } else {
    switch (thresholds.seon.combineRule) {
      case 'all_must_pass':
        overall =
          knowns === 3 && positives === 2 && !redFlag ? 'looks_real' : 'looks_fake';
        break;
      case 'majority': {
        const flags = [emailAccounts, phoneAccounts, ipLocation].filter(
          (v) => v === 'flag'
        ).length;
        overall = knowns - flags > flags ? 'looks_real' : 'looks_fake';
        break;
      }
      case 'positive_unless_flagged':
      default:
        overall = positives > 0 && !redFlag ? 'looks_real' : 'looks_fake';
        break;
    }
  }

  if (
    overall === 'looks_fake' &&
    accountSignalsKnown === 0 &&
    thresholds.seon.combineRule === 'positive_unless_flagged'
  ) {
    warnings.push(
      'Neither SEON account count was available, so there is no positive evidence either way. Falling back to rental-house vetting.'
    );
  }

  return { emailAccounts, phoneAccounts, ipLocation, overall, reasons, warnings };
}
