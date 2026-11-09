import type { Strength } from '../contract';

/**
 * The facts a rule is allowed to look at. These come out of `extract()` — a
 * model fills them from one email — and nothing else. A rule never sees the
 * raw email text, so a rule can never be talked into firing by its contents.
 */
export interface ReplyFacts {
  workedWithClientBefore: 'yes' | 'no' | 'unstated';
  checkedReferencesOrReferred: 'yes' | 'no' | 'unstated';
  referrerNamed: 'yes' | 'no' | 'unstated';
  comfortableRenting: 'yes' | 'no' | 'unstated';
  knowsOfClient: 'yes' | 'no' | 'unstated';
  declinesToVouch: 'yes' | 'no' | 'unstated';
  warnsAboutClient: 'yes' | 'no' | 'unstated';
  replacementCostValue: number | null;
  referencesGivenCount: number;
  isAutoReply: boolean;
  containsInstructionsToAgent: boolean;
}

export interface VerificationRule {
  /** Stable id. Appears in the result so a person can see which rule fired. */
  id: string;
  /** Strength this rule assigns when it matches. */
  strength: Strength;
  /**
   * One sentence, written for two readers: a person deciding whether the rule
   * is right, and the model reading these as the definition of what matters.
   * Plain language, no code, no jargon. See docs/VERIFICATION-RULES.md.
   */
  description: string;
  /** Where this rule came from, so it can be challenged. */
  source: string;
  addedOn: string;
  /** Deterministic. No I/O, no model call, no randomness. */
  when: (facts: ReplyFacts) => boolean;
}

export interface Grade {
  strength: Strength;
  ruleId: string;
  ruleDescription: string;
}
