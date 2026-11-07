import type { CasePacket, Reason, TemplateId } from '../contract';
import { thresholds } from '../config/thresholds';
import { assessSeonSignals, type SignalAssessment } from './seonSignals';

export type RoutePath =
  | 'out_of_scope'
  | 'underwriting_gate'
  | 'no_review_needed'
  | 'confirmed_fraud'
  | 'vet_rental_houses'
  | 'signals_look_real';

export interface RouteDecision {
  path: RoutePath;
  /** Templates triage wants sent now, before any reply has arrived. */
  templates: TemplateId[];
  atOrOverReferralLimit: boolean;
  foreignIndicator: boolean;
  signals: SignalAssessment | null;
  reasons: Reason[];
  warnings: string[];
}

function gatesHit(packet: CasePacket): string[] {
  const g = packet.underwritingGates;
  const hit: string[] = [];
  if (g.ofac) hit.push('OFAC');
  if (g.mexico) hit.push('Mexico');
  if (g.rcvOver150k) hit.push('RCV over $150K');
  if (g.claims) hit.push('claims');
  if (g.trailers) hit.push('trailers');
  if (g.tib) hit.push('TIB');
  return hit;
}

/** SEON says the customer is in another country. */
function looksForeign(packet: CasePacket): boolean {
  const ipCountry = packet.seon.signals.ipCountry;
  if (ipCountry !== null && ipCountry !== 'US') return true;
  const addrCountry = packet.applicant.address.country;
  return addrCountry !== null && addrCountry !== 'US';
}

/**
 * M1. Pure, deterministic, no AI. Decides which path of the workflow doc this
 * case is on. It does not decide the outcome - that is `decide()`, which also
 * reads the replies.
 */
export function route(packet: CasePacket): RouteDecision {
  const reasons: Reason[] = [];
  const warnings: string[] = [];
  const templates: TemplateId[] = [];

  const atOrOverReferralLimit =
    packet.rentedEquipmentLimit >= thresholds.referralLimitUsd;
  const foreignIndicator = looksForeign(packet);

  const inScope = (thresholds.routing.productsInScope as readonly string[]).includes(
    packet.product
  );
  if (!inScope) {
    return {
      path: 'out_of_scope',
      templates,
      atOrOverReferralLimit,
      foreignIndicator,
      signals: null,
      reasons: [
        {
          code: 'PRODUCT_OUT_OF_SCOPE',
          message: `Product ${packet.product} is not in the Needs Review workflow.`,
          evidence: [{ field: 'product' }],
        },
      ],
      warnings,
    };
  }

  // Underwriting gates pass straight through. The agent never decides a gate.
  const hit = gatesHit(packet);
  if (hit.length > 0) {
    reasons.push({
      code: 'UNDERWRITING_GATE_SET',
      message: `Requires underwriting: ${hit.join(', ')}.`,
      evidence: [{ field: 'underwritingGates' }],
    });
    return {
      path: 'underwriting_gate',
      templates,
      atOrOverReferralLimit,
      foreignIndicator,
      signals: null,
      reasons,
      warnings,
    };
  }

  // SEON confirmed fraud, no doubt. Rare.
  if (packet.seon.confirmedFraud) {
    reasons.push({
      code: 'SEON_CONFIRMED_FRAUD',
      message: 'SEON reports confirmed fraud with no doubt.',
      evidence: [{ field: 'seon.confirmedFraud' }, { field: 'seon.fraudReasons' }],
    });
    return {
      path: 'confirmed_fraud',
      templates,
      atOrOverReferralLimit,
      foreignIndicator,
      signals: null,
      reasons,
      warnings,
    };
  }

  const flagged = packet.seon.state !== 'approve';

  reasons.push({
    code: atOrOverReferralLimit ? 'LIMIT_AT_OR_OVER_100K' : 'LIMIT_UNDER_100K',
    message: `Requested rented equipment limit is $${packet.rentedEquipmentLimit.toLocaleString('en-US')}.`,
    evidence: [{ field: 'rentedEquipmentLimit' }],
  });
  reasons.push({
    code: `SEON_${packet.seon.state.toUpperCase()}`,
    message: `SEON state is "${packet.seon.state}".`,
    evidence: [{ field: 'seon.state' }],
  });

  // $100K or higher is an automatic referral to review, whatever SEON said.
  if (atOrOverReferralLimit) {
    templates.push('exhibit1_rental_house_vetting');
    if (flagged && foreignIndicator) {
      templates.push('exhibit3_us_residency');
      reasons.push({
        code: 'SEON_FOREIGN_LOCATION',
        message: 'SEON places the customer outside the US; confirm US residency or entity.',
        evidence: [{ field: 'seon.signals.ipCountry' }],
      });
    }
    return {
      path: 'vet_rental_houses',
      templates,
      atOrOverReferralLimit,
      foreignIndicator,
      signals: null,
      reasons,
      warnings,
    };
  }

  // Under $100K and SEON approved: nothing for this workflow to do.
  if (!flagged) {
    reasons.push({
      code: 'NO_REVIEW_NEEDED',
      message: 'Under $100K with a SEON approval; the application continues to the end.',
      evidence: [{ field: 'rentedEquipmentLimit' }, { field: 'seon.state' }],
    });
    return {
      path: 'no_review_needed',
      templates,
      atOrOverReferralLimit,
      foreignIndicator,
      signals: null,
      reasons,
      warnings,
    };
  }

  // Under $100K and SEON flagged: read the three signals.
  const signals = assessSeonSignals(packet);
  reasons.push(...signals.reasons);
  warnings.push(...signals.warnings);

  if (foreignIndicator) {
    templates.push('exhibit1_rental_house_vetting', 'exhibit3_us_residency');
    reasons.push({
      code: 'SEON_FOREIGN_LOCATION',
      message: 'SEON places the customer outside the US; confirm US residency or entity.',
      evidence: [{ field: 'seon.signals.ipCountry' }],
    });
    return {
      path: 'vet_rental_houses',
      templates,
      atOrOverReferralLimit,
      foreignIndicator,
      signals,
      reasons,
      warnings,
    };
  }

  if (signals.overall === 'looks_real') {
    return {
      path: 'signals_look_real',
      templates,
      atOrOverReferralLimit,
      foreignIndicator,
      signals,
      reasons,
      warnings,
    };
  }

  // looks_fake, or undetermined because we have no signals at all.
  if (signals.overall === 'undetermined') {
    warnings.push(
      'No SEON signals were available; falling back to rental-house vetting.'
    );
  }
  if (thresholds.routing.underLimitLooksFakeSendsExhibit1) {
    templates.push('exhibit1_rental_house_vetting');
  }
  return {
    path: 'vet_rental_houses',
    templates,
    atOrOverReferralLimit,
    foreignIndicator,
    signals,
    reasons,
    warnings,
  };
}
