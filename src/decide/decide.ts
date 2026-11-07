import type {
  AgentResult,
  CasePacket,
  ExtractedReply,
  Reason,
  TemplateId,
} from '../contract';
import { SCHEMA_VERSION } from '../contract';
import { thresholds } from '../config/thresholds';
import { buildDrafts } from '../templates/draft';
import type { RouteDecision } from '../routing/route';

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

function daysSince(iso: string, now: string): number {
  return (new Date(now).getTime() - new Date(iso).getTime()) / DAY_MS;
}

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
 * Tally from replies. The workflow is explicit that this does not hold up an
 * account: once one rental house gives a strong verification we add up what we
 * have and move on.
 */
function tallyEquipment(extracted: readonly ExtractedReply[]): number {
  return extracted.reduce((sum, e) => sum + (e.replacementCostValue ?? 0), 0);
}

export interface DecideInput {
  packet: CasePacket;
  routeDecision: RouteDecision;
  /** Facts pulled out of inbound emails. Empty on a triage-only call. */
  extracted: readonly ExtractedReply[];
}

/**
 * Deterministic. Reads the route and the extracted facts and says what a person
 * should do. No model call happens here, which is what makes every
 * recommendation reproducible and every reason citable.
 */
export function decide(input: DecideInput): AgentResult {
  const { packet, routeDecision } = input;
  const reasons: Reason[] = [...routeDecision.reasons];
  const warnings: string[] = [...routeDecision.warnings];

  // An email that tries to instruct the agent is never evidence of anything.
  const extracted = input.extracted.map((e) => {
    if (!e.containsInstructionsToAgent) return e;
    warnings.push(
      `Reply ${e.correspondenceId} contains text aimed at the agent; scored negative and ignored as evidence.`
    );
    return { ...e, strength: 'negative' as const };
  });

  const base = {
    schemaVersion: SCHEMA_VERSION,
    caseId: packet.caseId,
    extracted,
    verifiedEquipmentTotal: tallyEquipment(extracted),
    researchPacket: null,
    followUpAt: null as string | null,
  };

  switch (routeDecision.path) {
    case 'out_of_scope':
      return { ...base, stage: 'done', recommendation: 'continue', reasons, outbound: [], warnings };

    case 'underwriting_gate':
      return {
        ...base,
        stage: 'done',
        recommendation: 'route_to_underwriting',
        reasons,
        outbound: [],
        warnings,
      };

    case 'no_review_needed':
      return { ...base, stage: 'done', recommendation: 'continue', reasons, outbound: [], warnings };

    case 'confirmed_fraud':
      return {
        ...base,
        stage: 'done',
        recommendation: 'recommend_decline',
        reasons,
        outbound: [],
        warnings,
      };

    case 'signals_look_real':
      reasons.push({
        code: 'SEON_SIGNALS_LOOK_REAL',
        message:
          'Under $100K with a SEON flag, but the account, phone and IP signals are consistent with a real person.',
        evidence: [{ field: 'seon.signals' }],
      });
      return {
        ...base,
        stage: 'verified',
        recommendation: 'approve',
        reasons,
        outbound: [],
        warnings,
      };

    case 'vet_rental_houses':
      return vetting({ packet, routeDecision, extracted, reasons, warnings, base });
  }
}

interface VettingArgs {
  packet: CasePacket;
  routeDecision: RouteDecision;
  extracted: ExtractedReply[];
  reasons: Reason[];
  warnings: string[];
  base: Omit<AgentResult, 'stage' | 'recommendation' | 'reasons' | 'outbound' | 'warnings'>;
}

function vetting(args: VettingArgs): AgentResult {
  const { packet, routeDecision, extracted, reasons, warnings, base } = args;
  const now = packet.now;

  // Applicant said outright they are not a US resident or entity.
  const nonUs = extracted.some(
    (e) => e.rentalHouseId === null && e.strength === 'negative' && e.history?.toLowerCase().includes('not a us')
  );
  if (nonUs && thresholds.routing.nonUsApplicantRecommendsDecline) {
    reasons.push({
      code: 'APPLICANT_NOT_US',
      message: 'Applicant confirmed they are not a US resident or entity.',
      evidence: [{ field: 'correspondence' }],
    });
    return { ...base, stage: 'done', recommendation: 'recommend_decline', reasons, outbound: [], warnings };
  }

  const rhReplies = extracted.filter((e) => e.rentalHouseId !== null);
  const strong = rhReplies.filter((e) => e.strength === 'strong');
  const negative = rhReplies.filter((e) => e.strength === 'negative');

  for (const n of negative) {
    warnings.push(
      `Rental house reply ${n.correspondenceId} was negative: ${n.evidenceQuote ?? 'no quote captured'}`
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
      code: 'EQUIPMENT_TALLIED_NOT_BLOCKING',
      message: `Equipment value from replies totals $${base.verifiedEquipmentTotal.toLocaleString('en-US')}. This does not hold up the account.`,
      evidence: [{ field: 'rentalHouses' }],
    });
    return { ...base, stage: 'verified', recommendation: 'approve', reasons, outbound: [], warnings };
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
    return {
      ...base,
      stage: 'triage',
      recommendation: 'send_emails',
      reasons,
      outbound: pending.outbound,
      followUpAt: addDays(now, thresholds.timing.rentalHouseWaitDays),
      warnings,
    };
  }

  const exhibit1SentAt = lastOutboundAt(packet, 'exhibit1_rental_house_vetting');
  const exhibit2Sent = hasSent(packet, 'exhibit2_applicant_references');
  const waitedOnRentalHouses =
    exhibit1SentAt !== null &&
    daysSince(exhibit1SentAt, now) >= thresholds.timing.rentalHouseWaitDays;

  const rentalHousesUnhelpful =
    rhReplies.length > 0 && strong.length === 0;

  // Rental houses cannot help, or have not answered in time: ask the applicant
  // for two previous rental-house references.
  if (!exhibit2Sent && (rentalHousesUnhelpful || waitedOnRentalHouses)) {
    const drafts = buildDrafts(packet, ['exhibit2_applicant_references']);
    warnings.push(...drafts.warnings);
    reasons.push({
      code: rentalHousesUnhelpful
        ? 'RENTAL_HOUSES_COULD_NOT_VERIFY'
        : 'RENTAL_HOUSES_NO_REPLY',
      message: rentalHousesUnhelpful
        ? 'No rental house could verify this client; asking the applicant for two previous references.'
        : `No reply from the rental houses after ${thresholds.timing.rentalHouseWaitDays} day(s); asking the applicant for two previous references.`,
      evidence: [{ field: 'correspondence' }],
    });
    return {
      ...base,
      stage: 'awaiting_applicant',
      recommendation: 'send_emails',
      reasons,
      outbound: drafts.outbound,
      followUpAt: addDays(now, thresholds.timing.applicantReferenceWaitDays),
      warnings,
    };
  }

  // Applicant sent references. The workflow routes questionable references to
  // service@ with everything found, to choose decline vs Stripe Selfie ID.
  const applicantReplies = extracted.filter((e) => e.rentalHouseId === null);
  const referencesGiven = applicantReplies.flatMap((e) => e.referencesGiven);
  if (exhibit2Sent && applicantReplies.length > 0) {
    reasons.push({
      code: 'APPLICANT_REFERENCES_RECEIVED',
      message: `Applicant supplied ${referencesGiven.length} reference(s); no strong rental-house verification on file.`,
      evidence: [{ field: 'correspondence' }],
    });
    // OPEN Q14: good-looking references are not covered by the workflow doc.
    // Escalating is the conservative default - the agent never approves on
    // unverified references.
    return {
      ...base,
      stage: 'escalated',
      recommendation: 'escalate_to_service',
      reasons,
      outbound: [],
      warnings,
    };
  }

  const caseAge = exhibit1SentAt !== null ? daysSince(exhibit1SentAt, now) : 0;
  if (caseAge >= thresholds.timing.maxCaseAgeDays) {
    reasons.push({
      code: 'CASE_AGED_OUT',
      message: `Nothing usable after ${Math.floor(caseAge)} day(s); sending to service@ to decide.`,
      evidence: [{ field: 'now' }],
    });
    return { ...base, stage: 'escalated', recommendation: 'escalate_to_service', reasons, outbound: [], warnings };
  }

  // Emails are out, nothing useful back yet.
  reasons.push({
    code: 'AWAITING_REPLIES',
    message: 'Verification emails are out; waiting on replies.',
    evidence: [{ field: 'correspondence' }],
  });
  return {
    ...base,
    stage: exhibit2Sent ? 'awaiting_applicant' : 'awaiting_rental_houses',
    recommendation: 'wait',
    reasons,
    outbound: [],
    followUpAt: addDays(
      exhibit1SentAt ?? now,
      thresholds.timing.rentalHouseWaitDays
    ),
    warnings,
  };
}
