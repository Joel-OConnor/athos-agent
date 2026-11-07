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
  const haveIpGeo = s.ipCountry !== null || s.ipDistanceMilesFromAddress !== null;
  if (!haveIpGeo) {
    warnings.push('SEON IP geolocation not available on this case.');
  } else {
    const farByMiles =
      s.ipDistanceMilesFromAddress !== null &&
      s.ipDistanceMilesFromAddress > thresholds.seon.ipFarAwayMiles;
    const differentCountry =
      thresholds.seon.ipDifferentCountryIsFlag &&
      s.ipCountry !== null &&
      addr.country !== null &&
      s.ipCountry !== addr.country;
    const differentState =
      thresholds.seon.ipDifferentStateIsFlag &&
      s.ipRegion !== null &&
      addr.state !== null &&
      s.ipRegion !== addr.state;

    const flagged = farByMiles || differentCountry || differentState;
    ipLocation = flagged ? 'flag' : 'pass';
    reasons.push({
      code: flagged ? 'SEON_IP_LOCATION_MISMATCH' : 'SEON_IP_LOCATION_OK',
      message: flagged
        ? `IP geolocation (${s.ipCity ?? '?'}, ${s.ipRegion ?? '?'}, ${s.ipCountry ?? '?'}) does not match the applicant address.`
        : 'IP geolocation is consistent with the applicant address.',
      evidence: [
        { field: 'seon.signals.ipCountry' },
        { field: 'applicant.address' },
      ],
    });
  }

  const verdicts = [emailAccounts, phoneAccounts, ipLocation];
  const flags = verdicts.filter((v) => v === 'flag').length;
  const passes = verdicts.filter((v) => v === 'pass').length;
  const knowns = flags + passes;

  let overall: SignalAssessment['overall'];
  if (knowns === 0) {
    overall = 'undetermined';
  } else {
    switch (thresholds.seon.combineRule) {
      case 'all_must_pass':
        overall = flags === 0 && knowns === 3 ? 'looks_real' : 'looks_fake';
        break;
      case 'majority':
        overall = passes > flags ? 'looks_real' : 'looks_fake';
        break;
      case 'any_flag_fails':
      default:
        overall = flags > 0 ? 'looks_fake' : 'looks_real';
        break;
    }
  }

  if (knowns < 3 && overall === 'looks_real') {
    warnings.push(
      `"Looks real" rests on ${knowns} of 3 SEON signals; the rest were unavailable.`
    );
  }

  return { emailAccounts, phoneAccounts, ipLocation, overall, reasons, warnings };
}
