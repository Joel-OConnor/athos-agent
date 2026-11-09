import type { Product } from '../contract';

/**
 * Every number and every policy switch the workflow depends on, in one place.
 * Changing underwriting policy should mean editing the values below, and the
 * type is what says which values are allowed.
 *
 * Status of each entry:
 *   WORKING Qn  answered Athos-side on 2026-11-08, pending Athos confirmation.
 *               See docs/OPEN-QUESTIONS.md.
 *
 * How a reply is graded is NOT here. That lives in the verification rules
 * registry, src/verification/rules.ts, so rules can be added over time without
 * touching this file.
 */

export type Comparison = 'greater_than' | 'at_least';
export type CombineRule = 'positive_unless_flagged' | 'all_must_pass' | 'majority';
export type BindAt = 'requested_limit' | 'verified_total';
export type ActorRole = 'any_staff' | 'underwriter';

export interface Thresholds {
  /** At or above this requested limit the case is referred to review whatever SEON said. */
  referralLimitUsd: number;
  /** Reference only. The agent reads underwritingGates.rcvOver150k; it never computes it. */
  underwritingRcvLimitUsd: number;

  seon: {
    minEmailAccounts: number;
    emailAccountsComparison: Comparison;
    minPhoneAccounts: number;
    phoneAccountsComparison: Comparison;
    ipDifferentCountryIsFlag: boolean;
    ipDifferentStateIsFlag: boolean;
    ipFarAwayMiles: number | null;
    combineRule: CombineRule;
  };

  verification: {
    strongVerificationsNeeded: number;
    negativeCancelsStrong: boolean;
  };

  timing: {
    rentalHouseWaitBusinessDays: number;
    rentalHouseReminderBusinessDays: number | null;
    applicantReferenceWaitBusinessDays: number;
    maxCaseAgeBusinessDays: number;
  };

  routing: {
    underLimitLooksFakeSendsExhibit1: boolean;
    underLimitLooksFakeNeedsFurtherReview: boolean;
    nonUsApplicantRecommendsDecline: boolean;
    nonUsApplicantNeedsFurtherReview: boolean;
    productsInScope: readonly Product[];
    noRentalHousesSendsExhibit2: boolean;
    applicantReferencesGetExhibit1: boolean;
    applicantReferencesNeedFurtherReview: boolean;
  };

  binding: { bindAt: BindAt };

  authority: {
    sendEmails: ActorRole;
    approveEscalateDecline: ActorRole;
  };

  exhibit1: { higherLimitsWhenPriorPolicy: boolean };
}

export const thresholds: Thresholds = {
  // Workflow: "$100K or higher". Treated as >= 100000.
  referralLimitUsd: 100_000,
  underwritingRcvLimitUsd: 150_000,

  seon: {
    // WORKING Q3. "over 5" email accounts and "over 2" phone accounts, read strictly.
    minEmailAccounts: 5,
    emailAccountsComparison: 'greater_than',
    minPhoneAccounts: 2,
    phoneAccountsComparison: 'greater_than',

    // WORKING Q3. Anywhere in the USA is fine; outside the US is a flag.
    // Distance and a different state are explicitly not flags.
    ipDifferentCountryIsFlag: true,
    ipDifferentStateIsFlag: false,
    ipFarAwayMiles: null,

    // WORKING Q11. The doc treats each account count on its own as positive
    // evidence ("this appears to be a real person") and the IP location only
    // as a red flag. So: at least one positive and no red flag. A signal we
    // could not retrieve is not evidence either way.
    combineRule: 'positive_unless_flagged',
  },

  verification: {
    // Workflow: "Since we got one strong vet, tally up the totals ... and approve."
    strongVerificationsNeeded: 1,
    // WORKING Q12. A negative reply does not cancel a strong one; it is surfaced.
    negativeCancelsStrong: false,
  },

  timing: {
    // WORKING Q6. Three business days on the rental houses, no reminder.
    rentalHouseWaitBusinessDays: 3,
    rentalHouseReminderBusinessDays: null,
    applicantReferenceWaitBusinessDays: 3,
    // After this, a case with nothing usable goes to service@ either way.
    maxCaseAgeBusinessDays: 10,
  },

  routing: {
    // WORKING Q4. Looks fake under $100K: Exhibit 1, and flag for a person.
    underLimitLooksFakeSendsExhibit1: true,
    underLimitLooksFakeNeedsFurtherReview: true,
    // WORKING Q7. Not a US resident or entity: recommend decline, flagged until
    // Athos confirms international business is never written.
    nonUsApplicantRecommendsDecline: true,
    nonUsApplicantNeedsFurtherReview: true,
    // WORKING Q8.
    productsInScope: ['im_annual', 'im_short_term'],
    // WORKING Q13. Nobody to vet: ask the applicant for references.
    noRentalHousesSendsExhibit2: true,
    // WORKING Q14. POC behaviour pending Athos: vet applicant references with
    // Exhibit 1 and flag the case.
    applicantReferencesGetExhibit1: true,
    applicantReferencesNeedFurtherReview: true,
  },

  // WORKING Q9. Bind at the requested limit; the tally never blocks.
  binding: { bindAt: 'requested_limit' },

  // WORKING Q10. Anyone sends; underwriters approve, escalate, decline.
  authority: { sendEmails: 'any_staff', approveEscalateDecline: 'underwriter' },

  // WORKING Q5. Higher-limits wording when they already hold an Athos policy.
  exhibit1: { higherLimitsWhenPriorPolicy: true },
};
