import type {
  CasePacket,
  Correspondence,
  ExtractedReply,
  OutboundDraft,
  TemplateId,
} from '../contract';
import { thresholds } from '../config/thresholds';
import { EXHIBIT1_SUBJECT, renderExhibit1, type Exhibit1Variant } from './exhibit1';
import { EXHIBIT2_SUBJECT, renderExhibit2 } from './exhibit2';
import {
  EXHIBIT3_APPROVED,
  EXHIBIT3_SUBJECT,
  EXHIBIT3_UNAPPROVED_WARNING,
  renderExhibit3,
} from './exhibit3';

/**
 * Deterministic draft id. The agent holds no state, so the same call made twice
 * produces the same ids - that is what lets the Work Queue tell a re-draft from
 * a new email and avoid sending twice (Q15).
 */
export function draftId(
  caseId: string,
  template: TemplateId,
  recipientKey: string
): string {
  return `${caseId}:${template}:${recipientKey}`;
}

/**
 * The recipient half of a draft id, recovered from a sent email. Must agree
 * with how buildDrafts keys each kind of recipient, or the agent re-drafts an
 * email that already went out.
 */
export function recipientKeyOf(
  c: Pick<Correspondence, 'rentalHouseId' | 'template' | 'to'>
): string {
  if (c.rentalHouseId !== null) return c.rentalHouseId;
  if (c.template === 'exhibit1_rental_house_vetting') {
    return referredKey(c.to[0] ?? '');
  }
  return 'applicant';
}

/** Q14: a rental house the applicant named, which has no id on the packet. */
function referredKey(email: string): string {
  return `ref:${email.toLowerCase()}`;
}

function alreadySent(packet: CasePacket, id: string): boolean {
  return packet.correspondence.some(
    (c) =>
      c.direction === 'outbound' &&
      c.template !== null &&
      draftId(packet.caseId, c.template, recipientKeyOf(c)) === id
  );
}

function exhibit1Variant(packet: CasePacket): Exhibit1Variant {
  // Q5: higher-limits wording when they already hold an Athos policy.
  if (!thresholds.exhibit1.higherLimitsWhenPriorPolicy) return 'first_time';
  return packet.applicant.hasPriorAthosPolicy === true ? 'higher_limits' : 'first_time';
}

export interface DraftResult {
  outbound: OutboundDraft[];
  warnings: string[];
}

export interface DraftOptions {
  /**
   * Q14: rental houses the applicant named in a reply. They are vetted with
   * Exhibit 1 the same way the ones on the application are.
   */
  referredRentalHouses?: readonly ExtractedReply['referencesGiven'][number][];
}

/**
 * M2. Turns a list of templates into drafts. Deterministic, no AI. Skips any
 * draft whose id already appears in the packet's correspondence.
 */
export function buildDrafts(
  packet: CasePacket,
  templates: readonly TemplateId[],
  options: DraftOptions = {}
): DraftResult {
  const outbound: OutboundDraft[] = [];
  const warnings: string[] = [];
  const clientName = packet.applicant.businessName ?? packet.applicant.name;

  for (const template of templates) {
    switch (template) {
      case 'exhibit1_rental_house_vetting':
        draftExhibit1(packet, clientName, options, outbound, warnings);
        break;
      case 'exhibit2_applicant_references':
        draftApplicantEmail(
          packet,
          'exhibit2_applicant_references',
          EXHIBIT2_SUBJECT,
          renderExhibit2(),
          outbound
        );
        break;
      case 'exhibit3_us_residency':
        if (!EXHIBIT3_APPROVED) warnings.push(EXHIBIT3_UNAPPROVED_WARNING);
        draftApplicantEmail(
          packet,
          'exhibit3_us_residency',
          EXHIBIT3_SUBJECT,
          renderExhibit3({ clientName }),
          outbound
        );
        break;
    }
  }

  return { outbound, warnings };
}

function draftApplicantEmail(
  packet: CasePacket,
  template: TemplateId,
  subject: string,
  body: string,
  outbound: OutboundDraft[]
): void {
  const id = draftId(packet.caseId, template, 'applicant');
  if (alreadySent(packet, id)) return;
  outbound.push({
    draftId: id,
    template,
    rentalHouseId: null,
    to: [packet.applicant.email],
    subject,
    body,
  });
}

function draftExhibit1(
  packet: CasePacket,
  clientName: string,
  options: DraftOptions,
  outbound: OutboundDraft[],
  warnings: string[]
): void {
  const template = 'exhibit1_rental_house_vetting';
  const targets: {
    key: string;
    name: string;
    type: 'individual' | 'business';
    emails: string[];
  }[] = packet.rentalHouses.map((rh) => ({
    key: rh.id,
    name: rh.name,
    type: rh.type,
    emails: rh.contacts.map((c) => c.email).filter(Boolean),
  }));

  for (const ref of options.referredRentalHouses ?? []) {
    if (!ref.email) {
      warnings.push(
        `Applicant reference "${ref.rentalHouseName}" has no email address, so it cannot be vetted.`
      );
      continue;
    }
    targets.push({
      key: `ref:${ref.email.toLowerCase()}`,
      name: ref.rentalHouseName,
      // We do not know whether a referred house is a person or a company,
      // so we ask about the rental contract. An extra question is cheap.
      type: 'individual',
      emails: [ref.email],
    });
  }

  if (targets.length === 0) {
    warnings.push(
      'No rental houses listed on this application, so Exhibit 1 cannot be sent.'
    );
    return;
  }

  for (const t of targets) {
    if (t.emails.length === 0) {
      warnings.push(`Rental house "${t.name}" has no contact email.`);
      continue;
    }
    const id = draftId(packet.caseId, template, t.key);
    if (alreadySent(packet, id)) continue;
    outbound.push({
      draftId: id,
      template,
      rentalHouseId: t.key.startsWith('ref:') ? null : t.key,
      to: t.emails,
      subject: EXHIBIT1_SUBJECT,
      body: renderExhibit1({
        clientName,
        variant: exhibit1Variant(packet),
        rentalHouseType: t.type,
      }),
    });
  }
}
