import type { CasePacket, OutboundDraft, TemplateId } from '../contract';
import { thresholds } from '../config/thresholds';
import { EXHIBIT1_SUBJECT, renderExhibit1, type Exhibit1Variant } from './exhibit1';
import { EXHIBIT2_SUBJECT, renderExhibit2 } from './exhibit2';
import { EXHIBIT3_AVAILABLE, EXHIBIT3_SUBJECT, renderExhibit3 } from './exhibit3';

/**
 * Deterministic draft id. The agent holds no state, so the same call made twice
 * produces the same ids - that is what lets the Work Queue tell a re-draft from
 * a new email and avoid sending twice.
 */
export function draftId(
  caseId: string,
  template: TemplateId,
  recipientKey: string
): string {
  return `${caseId}:${template}:${recipientKey}`;
}

function alreadySent(packet: CasePacket, id: string): boolean {
  return packet.correspondence.some(
    (c) =>
      c.direction === 'outbound' &&
      c.template !== null &&
      draftId(
        packet.caseId,
        c.template,
        c.rentalHouseId ?? c.to[0] ?? 'applicant'
      ) === id
  );
}

function exhibit1Variant(packet: CasePacket): Exhibit1Variant {
  if (!thresholds.exhibit1.higherLimitsWhenPriorPolicy) return 'first_time';
  return packet.applicant.hasPriorAthosPolicy === true
    ? 'higher_limits'
    : 'first_time';
}

export interface DraftResult {
  outbound: OutboundDraft[];
  warnings: string[];
}

/**
 * M2. Turns a list of templates into drafts. Deterministic, no AI. Skips any
 * draft whose id already appears in the packet's correspondence.
 */
export function buildDrafts(
  packet: CasePacket,
  templates: readonly TemplateId[]
): DraftResult {
  const outbound: OutboundDraft[] = [];
  const warnings: string[] = [];
  const clientName = packet.applicant.businessName ?? packet.applicant.name;

  for (const template of templates) {
    if (template === 'exhibit1_rental_house_vetting') {
      if (packet.rentalHouses.length === 0) {
        warnings.push(
          'No rental houses listed on this application, so Exhibit 1 cannot be sent. See docs/OPEN-QUESTIONS.md (Q13).'
        );
        continue;
      }
      for (const rh of packet.rentalHouses) {
        const to = rh.contacts.map((c) => c.email).filter(Boolean);
        if (to.length === 0) {
          warnings.push(`Rental house "${rh.name}" has no contact email.`);
          continue;
        }
        const id = draftId(packet.caseId, template, rh.id);
        if (alreadySent(packet, id)) continue;
        outbound.push({
          draftId: id,
          template,
          rentalHouseId: rh.id,
          to,
          subject: EXHIBIT1_SUBJECT,
          body: renderExhibit1({
            clientName,
            variant: exhibit1Variant(packet),
            rentalHouseType: rh.type,
          }),
        });
      }
      continue;
    }

    if (template === 'exhibit2_applicant_references') {
      const id = draftId(packet.caseId, template, 'applicant');
      if (alreadySent(packet, id)) continue;
      outbound.push({
        draftId: id,
        template,
        rentalHouseId: null,
        to: [packet.applicant.email],
        subject: EXHIBIT2_SUBJECT,
        body: renderExhibit2(),
      });
      continue;
    }

    if (template === 'exhibit3_us_residency') {
      if (!EXHIBIT3_AVAILABLE) {
        warnings.push(
          'US-residency email is called for but has no approved wording yet. See docs/OPEN-QUESTIONS.md (Q2).'
        );
        continue;
      }
      const id = draftId(packet.caseId, template, 'applicant');
      if (alreadySent(packet, id)) continue;
      outbound.push({
        draftId: id,
        template,
        rentalHouseId: null,
        to: [packet.applicant.email],
        subject: EXHIBIT3_SUBJECT,
        body: renderExhibit3({ clientName }),
      });
    }
  }

  return { outbound, warnings };
}
