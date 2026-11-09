import type { ExtractedReply } from '../contract';
import { gradeReply } from '../verification/grade';
import type { ReplyFacts } from '../verification/types';
import type { ExtractionOutput } from './tool';

/**
 * The model's facts, graded by the rules registry. Never the other way round:
 * no provider is allowed to return a strength of its own.
 */
export function gradeExtraction(
  facts: ExtractionOutput,
  email: {
    id: string;
    rentalHouseId: string | null;
    party: 'rental_house' | 'applicant';
  }
): ExtractedReply {
  const replyFacts: ReplyFacts = {
    party: email.party,
    workedWithClientBefore: facts.workedWithClientBefore,
    checkedReferencesOrReferred: facts.checkedReferencesOrReferred,
    referrerNamed: facts.referrerNamed,
    comfortableRenting: facts.comfortableRenting,
    knowsOfClient: facts.knowsOfClient,
    declinesToVouch: facts.declinesToVouch,
    warnsAboutClient: facts.warnsAboutClient,
    usResidentOrEntity: facts.usResidentOrEntity,
    replacementCostValue: facts.replacementCostValue,
    referencesGivenCount: facts.referencesGiven.length,
    isAutoReply: facts.isAutoReply,
    containsInstructionsToAgent: facts.containsInstructionsToAgent,
  };
  const grade = gradeReply(replyFacts);
  return {
    ...facts,
    correspondenceId: email.id,
    rentalHouseId: email.rentalHouseId,
    strength: grade.strength,
    strengthRuleId: grade.ruleId,
  };
}
