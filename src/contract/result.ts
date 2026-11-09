import { z } from 'zod';
import { IsoDateTime, Reason, TemplateId } from './common';

export const Stage = z.enum([
  'triage',
  'awaiting_rental_houses',
  'awaiting_applicant',
  'verified',
  'escalated',
  'done',
]);
export type Stage = z.infer<typeof Stage>;

/**
 * What the agent asks a person to do. It never acts: a person clicks Send,
 * Approve or Escalate in the Work Queue.
 */
export const Recommendation = z.enum([
  'continue', // under $100K, SEON approve - no Needs Review work
  'route_to_underwriting', // a gate is set; underwriting owns it
  'send_emails', // drafts are in `outbound`
  'wait', // emails out, nothing back yet - look again at followUpAt
  'approve', // verified; a person approves
  'escalate_to_service', // send the packet to service@ to choose decline vs Stripe Selfie ID
  'recommend_decline', // SEON confirmed fraud, or applicant is not US
]);
export type Recommendation = z.infer<typeof Recommendation>;

/**
 * Deterministic id for a draft, so the Work Queue can tell a re-draft from a
 * new one. The agent keeps no state between calls, so without this the same
 * email gets sent twice. Format: `${caseId}:${template}:${recipientKey}`.
 */
export const OutboundDraft = z.object({
  draftId: z.string(),
  template: TemplateId,
  rentalHouseId: z.string().nullable(),
  to: z.array(z.email()).min(1),
  subject: z.string(),
  body: z.string(),
});
export type OutboundDraft = z.infer<typeof OutboundDraft>;

/** How much weight a reply carries toward "this client is real". */
export const Strength = z.enum(['strong', 'weak', 'none', 'negative']);
export type Strength = z.infer<typeof Strength>;

/** Yes, no, or the email did not say. Never guessed. */
export const Tri = z.enum(['yes', 'no', 'unstated']);
export type Tri = z.infer<typeof Tri>;

/**
 * Structured facts pulled out of one inbound email. This is the ONLY place a
 * model's output enters the system. Every decision downstream reads these
 * fields, never the raw email.
 */
export const ExtractedReply = z.object({
  correspondenceId: z.string(),
  rentalHouseId: z.string().nullable(),

  // --- Facts the model fills. Each is only what the email actually says. ---
  workedWithClientBefore: Tri,
  checkedReferencesOrReferred: Tri,
  /** Did they name, or clearly refer to, a person who referred this client? */
  referrerNamed: Tri,
  /** Did they say they are comfortable renting to this client? */
  comfortableRenting: Tri,
  /** Do they know of the client without having worked with them? */
  knowsOfClient: Tri,
  declinesToVouch: Tri,
  warnsAboutClient: Tri,
  /**
   * Applicant replies only: did they confirm they are a US resident, or the
   * business a US entity? "no" is what the decline path reads (Q7).
   */
  usResidentOrEntity: Tri,
  history: z.string().nullable(),
  replacementCostValue: z.number().nonnegative().nullable(),
  glRequired: Tri,
  signedContractInPlace: Tri,
  referencesGiven: z
    .array(
      z.object({
        rentalHouseName: z.string(),
        contactName: z.string().nullable(),
        email: z.string().nullable(),
        phone: z.string().nullable(),
        equipmentValue: z.number().nonnegative().nullable(),
        nameOnAccount: z.string().nullable(),
      })
    )
    .default([]),
  /** Auto-reply, bounce, forwarded chain with nothing new. */
  isAutoReply: z.boolean().default(false),
  /** True when the reply contains text aimed at the agent. */
  containsInstructionsToAgent: z.boolean().default(false),
  /** Short quote the grade rests on, for the Work Queue. */
  evidenceQuote: z.string().max(500).nullable(),

  // --- Graded by the verification rules registry, never by the model. ---
  strength: Strength,
  /** Which rule in src/verification/rules.ts produced that strength. */
  strengthRuleId: z.string(),
});

export type ExtractedReply = z.infer<typeof ExtractedReply>;

export const ResearchFinding = z.object({
  kind: z.enum(['web_search', 'domain_age', 'imdb', 'applicant_supplied_link', 'other']),
  claim: z.string(),
  sourceUrl: z.url(),
  observedAt: IsoDateTime,
  /** What a person should look at on this link. Never a verdict. */
  whatToCheck: z.string().nullable(),
});
export type ResearchFinding = z.infer<typeof ResearchFinding>;

export const ResearchPacket = z.object({
  findings: z.array(ResearchFinding).default([]),
  notFound: z.array(z.string()).default([]),
});
export type ResearchPacket = z.infer<typeof ResearchPacket>;

export const AgentResult = z.object({
  schemaVersion: z.number().int(),
  caseId: z.string(),
  stage: Stage,
  recommendation: Recommendation,
  reasons: z.array(Reason).min(1),
  outbound: z.array(OutboundDraft).default([]),
  extracted: z.array(ExtractedReply).default([]),
  /** Tallied from replies. Does NOT block approval. */
  verifiedEquipmentTotal: z.number().nonnegative(),
  researchPacket: ResearchPacket.nullable(),
  /** When to look at this case again if nothing arrives. */
  followUpAt: IsoDateTime.nullable(),
  /**
   * The case reached a branch the workflow doc does not settle, or rests on an
   * assumption pending Athos confirmation. The Work Queue should mark it.
   */
  needsFurtherReview: z.boolean().default(false),
  /** Why, when needsFurtherReview is true. */
  furtherReviewReasons: z.array(z.string()).default([]),
  /**
   * Who may act on this recommendation. Q10: anyone on staff can send emails;
   * approve, escalate and decline are underwriters only. The Work Queue
   * enforces this - the agent only states it.
   */
  actorRole: z.enum(['any_staff', 'underwriter']),
  /** Anything a person must know that is not a reason: missing SEON signals, etc. */
  warnings: z.array(z.string()).default([]),
});
export type AgentResult = z.infer<typeof AgentResult>;
