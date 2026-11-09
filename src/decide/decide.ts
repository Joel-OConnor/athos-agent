import type {
  AgentResult,
  CasePacket,
  ExtractedReply,
  Reason,
  TemplateId,
} from '../contract';
import { SCHEMA_VERSION } from '../contract';
import { thresholds } from '../config/thresholds';
import { addBusinessDays, businessDaysBetween } from '../config/businessDays';
import { buildDrafts } from '../templates/draft';
import type { RouteDecision } from '../routing/route';

function lastOutboundAt(packet: CasePacket, template: TemplateId): string | null {
  const sent = packet.correspondence
    .filter((c) => c.direction === 'outbound' && c.template === template)
    .map((c) => c.sentAt)
    .sort();
  return sent.length > 0 ? sent[sent.length - 1]! : null;
}

function hasSent(packet: CasePacket, template: TemplateId): boolean {
  return lastOutboundAt(packet, template) !== null;
}

/**
 * Tally from replies. Q9: we bind at the requested limit, so this number is
 * reported for the file and never blocks an approval.
 */
function tallyEquipment(extracted: readonly ExtractedReply[]): number {
  return extracted
    .filter((e) => e.strength !== 'negative')
    .reduce((sum, e) => sum + (e.replacementCostValue ?? 0), 0);
}

/** Q10. Sending is open to any staff; the outcomes are underwriters only. */
function actorFor(recommendation: AgentResult['recommendation']): AgentResult['actorRole'] {
  return recommendation === 'send_emails' || recommendation === 'wait'
    ? thresholds.authority.sendEmails
    : thresholds.authority.approveEscalateDecline;
}

export interface DecideInput {
  packet: CasePacket;
  routeDecision: RouteDecision;
  /** Facts pulled out of inbound emails. Empty on a triage-only call. */
  extracted: readonly ExtractedReply[];
}

interface Draft {
  stage: AgentResult['stage'];
  recommendation: AgentResult['recommendation'];
  reasons: Reason[];
  outbound?: AgentResult['outbound'];
  followUpAt?: string | null;
  furtherReview?: string[];
}

/**
 * Deterministic. Reads the route and the extracted facts and says what a person
 * should do. No model call happens here, which is what makes every
 * recommendation reproducible and every reason citable.
 */
export function decide(input: DecideInput): AgentResult {
  const { packet, routeDecision } = input;
  const warnings: string[] = [...routeDecision.warnings];
  const furtherReview: string[] = [];

  // An email that tries to instruct the agent is never evidence of anything.
  // The verification rules already grade it negative; this surfaces it.
  const extracted = [...input.extracted];
  for (const e of extracted) {
    if (e.containsInstructionsToAgent) {
      warnings.push(
        `Reply ${e.correspondenceId} contains text aimed at the agent; scored negative and ignored as evidence.`
      );
    }
  }

  const draft = plan({ packet, routeDecision, extracted, warnings, furtherReview });

  const recommendation = draft.recommendation;
  return {
    schemaVersion: SCHEMA_VERSION,
    caseId: packet.caseId,
    stage: draft.stage,
    recommendation,
    reasons: [...routeDecision.reasons, ...draft.reasons],
    outbound: draft.outbound ?? [],
    extracted,
    verifiedEquipmentTotal: tallyEquipment(extracted),
    researchPacket: null,
    followUpAt: draft.followUpAt ?? null,
    needsFurtherReview: furtherReview.length > 0,
    furtherReviewReasons: furtherReview,
    actorRole: actorFor(recommendation),
    warnings,
  };
}

interface PlanInput {
  packet: CasePacket;
  routeDecision: RouteDecision;
  extracted: ExtractedReply[];
  warnings: string[];
  furtherReview: string[];
}

function plan(input: PlanInput): Draft {
  const { packet, routeDecision, furtherReview } = input;

  switch (routeDecision.path) {
    case 'out_of_scope':
      return { stage: 'done', recommendation: 'continue', reasons: [] };

    case 'underwriting_gate':
      return { stage: 'done', recommendation: 'route_to_underwriting', reasons: [] };

    case 'no_review_needed':
      return { stage: 'done', recommendation: 'continue', reasons: [] };

    case 'confirmed_fraud':
      return { stage: 'done', recommendation: 'recommend_decline', reasons: [] };

    case 'signals_look_real':
      return {
        stage: 'verified',
        recommendation: 'approve',
        reasons: [
          {
            code: 'SEON_SIGNALS_LOOK_REAL',
            message:
              'Under $100K with a SEON flag, but all three signals pass: the account counts and the IP location are consistent with a real US person.',
            evidence: [{ field: 'seon.signals' }],
          },
        ],
      };

    case 'vet_rental_houses':
      if (routeDecision.signals?.overall === 'looks_fake') {
        if (thresholds.routing.underLimitLooksFakeNeedsFurtherReview) {
          furtherReview.push(
            'Under $100K, SEON flagged, and the signals do not pass. The workflow doc does not settle this branch (Q4).'
          );
        }
      }
      return vetting(input);
  }
}

function vetting(input: PlanInput): Draft {
  const { packet, routeDecision, extracted, warnings, furtherReview } = input;
  const now = packet.now;
  const reasons: Reason[] = [];

  // The applicant answered the US-residency email saying they are not US.
  const nonUs = extracted.some(
    (e) => e.rentalHouseId === null && e.history?.toLowerCase().includes('not a us')
  );
  if (nonUs && thresholds.routing.nonUsApplicantRecommendsDecline) {
    reasons.push({
      code: 'APPLICANT_NOT_US',
      message: 'Applicant confirmed they are not a US resident or entity.',
      evidence: [{ field: 'correspondence' }],
    });
    if (thresholds.routing.nonUsApplicantNeedsFurtherReview) {
      furtherReview.push(
        'Recommending decline because the applicant is not a US resident or entity. Athos has not confirmed whether international business is ever supported (Q7).'
      );
    }
    return { stage: 'done', recommendation: 'recommend_decline', reasons };
  }

  const rhReplies = extracted.filter((e) => e.rentalHouseId !== null);
  const strong = rhReplies.filter((e) => e.strength === 'strong');
  const negative = rhReplies.filter((e) => e.strength === 'negative');

  for (const n of negative) {
    warnings.push(
      `Rental house reply ${n.correspondenceId} was negative (rule: ${n.strengthRuleId}): ${n.evidenceQuote ?? 'no quote captured'}`
    );
  }

  const strongCount = thresholds.verification.negativeCancelsStrong
    ? Math.max(0, strong.length - negative.length)
    : strong.length;

  if (strongCount >= thresholds.verification.strongVerificationsNeeded) {
    reasons.push({
      code: 'STRONG_VERIFICATION_RECEIVED',
      message: `${strong.length} rental house(s) gave a strong verification; the client is real.`,
      evidence: strong.map((s) => ({
        field: `correspondence[${s.correspondenceId}]`,
        quote: s.evidenceQuote ?? undefined,
      })),
    });
    reasons.push({
      code: 'BIND_AT_REQUESTED_LIMIT',
      message: `Binding at the requested $${packet.rentedEquipmentLimit.toLocaleString('en-US')}; replies account for $${tallyEquipment(extracted).toLocaleString('en-US')} and do not hold up the account.`,
      evidence: [{ field: 'rentedEquipmentLimit' }],
    });
    return { stage: 'verified', recommendation: 'approve', reasons };
  }

  // Q14: the applicant named rental houses we have not written to yet.
  const applicantReplies = extracted.filter((e) => e.rentalHouseId === null);
  const referred = applicantReplies.flatMap((e) => e.referencesGiven);
  if (referred.length > 0 && thresholds.routing.applicantReferencesGetExhibit1) {
    const drafts = buildDrafts(packet, ['exhibit1_rental_house_vetting'], {
      referredRentalHouses: referred,
    });
    warnings.push(...drafts.warnings);
    if (drafts.outbound.length > 0) {
      reasons.push({
        code: 'VETTING_APPLICANT_REFERENCES',
        message: `Applicant supplied ${referred.length} reference(s); vetting them with Exhibit 1.`,
        evidence: [{ field: 'correspondence' }],
      });
      if (thresholds.routing.applicantReferencesNeedFurtherReview) {
        furtherReview.push(
          'Verifying the applicant\'s own references. The workflow doc only covers the questionable-references branch, so this path is our reading of it (Q14).'
        );
      }
      return {
        stage: 'awaiting_rental_houses',
        recommendation: 'send_emails',
        reasons,
        outbound: drafts.outbound,
        followUpAt: addBusinessDays(now, thresholds.timing.rentalHouseWaitBusinessDays),
      };
    }
    // References with no email to write to: a person has to look.
    reasons.push({
      code: 'APPLICANT_REFERENCES_UNREACHABLE',
      message: `Applicant supplied ${referred.length} reference(s), but none can be contacted by email.`,
      evidence: [{ field: 'correspondence' }],
    });
    furtherReview.push(
      'Applicant references could not be vetted automatically (Q14).'
    );
    return { stage: 'escalated', recommendation: 'escalate_to_service', reasons };
  }

  // Nothing sent yet: draft what triage asked for.
  const pending = buildDrafts(packet, routeDecision.templates);
  warnings.push(...pending.warnings);
  if (pending.outbound.length > 0) {
    reasons.push({
      code: 'VETTING_EMAILS_DRAFTED',
      message: `Drafted ${pending.outbound.length} verification email(s) for a person to send.`,
      evidence: [{ field: 'rentalHouses' }],
    });
    const awaitingApplicant = pending.outbound.every(
      (d) => d.template !== 'exhibit1_rental_house_vetting'
    );
    return {
      stage: 'triage',
      recommendation: 'send_emails',
      reasons,
      outbound: pending.outbound,
      followUpAt: addBusinessDays(
        now,
        awaitingApplicant
          ? thresholds.timing.applicantReferenceWaitBusinessDays
          : thresholds.timing.rentalHouseWaitBusinessDays
      ),
    };
  }

  const exhibit1SentAt = lastOutboundAt(packet, 'exhibit1_rental_house_vetting');
  const exhibit2Sent = hasSent(packet, 'exhibit2_applicant_references');
  const waitedOnRentalHouses =
    exhibit1SentAt !== null &&
    businessDaysBetween(exhibit1SentAt, now) >=
      thresholds.timing.rentalHouseWaitBusinessDays;
  const rentalHousesUnhelpful = rhReplies.length > 0 && strong.length === 0;

  // Rental houses cannot help, or have not answered in time.
  if (!exhibit2Sent && (rentalHousesUnhelpful || waitedOnRentalHouses)) {
    const drafts = buildDrafts(packet, ['exhibit2_applicant_references']);
    warnings.push(...drafts.warnings);
    reasons.push({
      code: rentalHousesUnhelpful
        ? 'RENTAL_HOUSES_COULD_NOT_VERIFY'
        : 'RENTAL_HOUSES_NO_REPLY',
      message: rentalHousesUnhelpful
        ? 'No rental house could verify this client; asking the applicant for two previous references.'
        : `No reply from the rental houses after ${thresholds.timing.rentalHouseWaitBusinessDays} business day(s); asking the applicant for two previous references.`,
      evidence: [{ field: 'correspondence' }],
    });
    return {
      stage: 'awaiting_applicant',
      recommendation: 'send_emails',
      reasons,
      outbound: drafts.outbound,
      followUpAt: addBusinessDays(
        now,
        thresholds.timing.applicantReferenceWaitBusinessDays
      ),
    };
  }

  // Applicant replied to Exhibit 2 with nothing we can use.
  if (exhibit2Sent && applicantReplies.length > 0) {
    reasons.push({
      code: 'APPLICANT_REFERENCES_UNUSABLE',
      message:
        'Applicant replied but gave no usable rental-house references, and no rental house could verify them.',
      evidence: [{ field: 'correspondence' }],
    });
    return { stage: 'escalated', recommendation: 'escalate_to_service', reasons };
  }

  const oldest = exhibit1SentAt ?? lastOutboundAt(packet, 'exhibit2_applicant_references');
  const caseAge = oldest !== null ? businessDaysBetween(oldest, now) : 0;
  if (caseAge >= thresholds.timing.maxCaseAgeBusinessDays) {
    reasons.push({
      code: 'CASE_AGED_OUT',
      message: `Nothing usable after ${caseAge} business day(s); sending to service@ to decide.`,
      evidence: [{ field: 'now' }],
    });
    return { stage: 'escalated', recommendation: 'escalate_to_service', reasons };
  }

  reasons.push({
    code: 'AWAITING_REPLIES',
    message: 'Verification emails are out; waiting on replies.',
    evidence: [{ field: 'correspondence' }],
  });
  return {
    stage: exhibit2Sent ? 'awaiting_applicant' : 'awaiting_rental_houses',
    recommendation: 'wait',
    reasons,
    followUpAt: addBusinessDays(
      oldest ?? now,
      exhibit2Sent
        ? thresholds.timing.applicantReferenceWaitBusinessDays
        : thresholds.timing.rentalHouseWaitBusinessDays
    ),
  };
}
