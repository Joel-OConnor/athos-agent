import { verificationRules } from './rules';
import type { Grade, ReplyFacts } from './types';

/**
 * First matching rule wins. Deterministic: the same facts always grade the
 * same way, and the result names the rule so a person can disagree with it.
 */
export function gradeReply(facts: ReplyFacts): Grade {
  for (const rule of verificationRules) {
    if (rule.when(facts)) {
      return {
        strength: rule.strength,
        ruleId: rule.id,
        ruleDescription: rule.description,
      };
    }
  }
  // verificationRules ends with a catch-all, so this is unreachable.
  return {
    strength: 'none',
    ruleId: 'no-rule-matched',
    ruleDescription: 'No verification rule matched.',
  };
}
