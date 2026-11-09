import { z } from 'zod';
import { ExtractedReply, Strength, TemplateId } from '../src/contract';
import type { ReplyFacts } from '../src/verification';

/**
 * One inbound email plus the facts underwriting says it contains.
 *
 * Any fact left out of `expected` means "the email did not say": 'unstated'
 * for the yes/no fields, null for values, false for the flags. That keeps a
 * fixture to the few lines that matter, which is what makes it cheap enough to
 * write a hundred of them.
 */
export const ReplyFixture = z.object({
  id: z.string(),
  party: z.enum(['rental_house', 'applicant']),
  rentalHouseName: z.string().nullable(),
  clientName: z.string(),
  subject: z.string(),
  body: z.string(),
  /** Which of our emails this is a reply to. Defaults by party. */
  respondingTo: TemplateId.optional(),
  expected: ExtractedReply.omit({
    correspondenceId: true,
    rentalHouseId: true,
    strengthRuleId: true,
  })
    .partial()
    .extend({
      strength: Strength,
      strengthRuleId: z.string(),
      referencesGivenCount: z.number().int().nonnegative().optional(),
    }),
  notes: z.string().optional(),
});
export type ReplyFixture = z.infer<typeof ReplyFixture>;

export const BLANK_FACTS: ReplyFacts = {
  party: 'rental_house',
  workedWithClientBefore: 'unstated',
  checkedReferencesOrReferred: 'unstated',
  referrerNamed: 'unstated',
  comfortableRenting: 'unstated',
  knowsOfClient: 'unstated',
  declinesToVouch: 'unstated',
  warnsAboutClient: 'unstated',
  usResidentOrEntity: 'unstated',
  replacementCostValue: null,
  referencesGivenCount: 0,
  isAutoReply: false,
  containsInstructionsToAgent: false,
};

/** The fixture's `expected` block, filled out to a complete set of facts. */
export function factsOf(fixture: ReplyFixture): ReplyFacts {
  const e = fixture.expected;
  return {
    party: fixture.party,
    workedWithClientBefore:
      e.workedWithClientBefore ?? BLANK_FACTS.workedWithClientBefore,
    checkedReferencesOrReferred:
      e.checkedReferencesOrReferred ?? BLANK_FACTS.checkedReferencesOrReferred,
    referrerNamed: e.referrerNamed ?? BLANK_FACTS.referrerNamed,
    comfortableRenting: e.comfortableRenting ?? BLANK_FACTS.comfortableRenting,
    knowsOfClient: e.knowsOfClient ?? BLANK_FACTS.knowsOfClient,
    declinesToVouch: e.declinesToVouch ?? BLANK_FACTS.declinesToVouch,
    warnsAboutClient: e.warnsAboutClient ?? BLANK_FACTS.warnsAboutClient,
    usResidentOrEntity: e.usResidentOrEntity ?? BLANK_FACTS.usResidentOrEntity,
    replacementCostValue: e.replacementCostValue ?? null,
    referencesGivenCount: e.referencesGivenCount ?? e.referencesGiven?.length ?? 0,
    isAutoReply: e.isAutoReply ?? false,
    containsInstructionsToAgent: e.containsInstructionsToAgent ?? false,
  };
}
