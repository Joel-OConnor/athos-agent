import { z } from 'zod';
import { ExtractedReply, Strength } from '../contract';
import type { ReplyFacts } from '../verification';

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
    ...BLANK_FACTS,
    ...(Object.fromEntries(
      Object.entries(e).filter(
        ([k, v]) => v !== undefined && k in BLANK_FACTS
      )
    ) as Partial<ReplyFacts>),
    referencesGivenCount:
      e.referencesGivenCount ?? e.referencesGiven?.length ?? 0,
  };
}
