/**
 * Every number and every policy switch the workflow depends on lives here, and
 * nowhere else. Changing underwriting policy should mean editing this file.
 *
 * Entries marked OPEN Qn are not yet answered by underwriting. The value is a
 * placeholder chosen so the build can proceed; see docs/OPEN-QUESTIONS.md.
 * Do not treat a placeholder as agreed policy.
 */

export const thresholds = {
  /**
   * At or above this requested rented-equipment limit, the case is an
   * automatic referral to review regardless of SEON state.
   * Workflow: "$100K or higher". Treated as >= 100000.
   */
  referralLimitUsd: 100_000,

  /**
   * Underwriting gate, passed through untouched. Here for reference only -
   * the agent reads underwritingGates.rcvOver150k, it does not compute it.
   */
  underwritingRcvLimitUsd: 150_000,

  seon: {
    /**
     * Workflow: "as long as there are over 5, this appears to be a real person".
     * OPEN Q3: does "over 5" mean >= 6? Placeholder reads it strictly as > 5.
     */
    minEmailAccounts: 5,
    emailAccountsComparison: 'greater_than' as const,

    /**
     * Workflow: "as long as there are over 2".
     * OPEN Q3: >= 3? Placeholder reads it strictly as > 2.
     */
    minPhoneAccounts: 2,
    phoneAccountsComparison: 'greater_than' as const,

    /**
     * Workflow: IP geo "different and far away" from the applicant address is
     * a red flag.
     * OPEN Q3: miles, different state, or different country? Placeholder uses
     * all three, any of which trips the flag.
     */
    ipFarAwayMiles: 500,
    ipDifferentStateIsFlag: true,
    ipDifferentCountryIsFlag: true,

    /**
     * How the three signals combine into "looks real" vs "looks fake".
     * NOT SPECIFIED ANYWHERE in the workflow doc. This is the single biggest
     * hole in M1 routing.
     * OPEN Q11. Placeholder: a case looks real only when no signal is a flag
     * and at least one is affirmative; any flag makes it look fake.
     * Alternatives: 'all_must_pass' | 'majority' | 'any_flag_fails'.
     */
    combineRule: 'any_flag_fails' as
      | 'all_must_pass'
      | 'majority'
      | 'any_flag_fails',
  },

  verification: {
    /**
     * How many strong rental-house verifications end the chase.
     * Workflow: "Since we got one strong vet, tally up the totals ... and approve."
     */
    strongVerificationsNeeded: 1,

    /**
     * OPEN Q12: does one "never heard of them" cancel one strong verification?
     * Placeholder: a negative does not cancel a strong one, but it is always
     * surfaced as a warning for the person approving.
     */
    negativeCancelsStrong: false,

    /**
     * OPEN Q1: is "we checked references" on its own strong or weak?
     * Placeholder: weak. Strong requires prior rental history, or a referral
     * from someone the rental house knows plus stated comfort renting.
     */
    checkedReferencesAloneIsStrong: false,
  },

  timing: {
    /**
     * OPEN Q6: how long to wait on rental houses before sending Exhibit 2,
     * and whether a reminder goes out in between. Placeholders.
     */
    rentalHouseWaitDays: 3,
    rentalHouseReminderDays: null as number | null,
    applicantReferenceWaitDays: 3,
    /** After this, a case with nothing back goes to service@ either way. */
    maxCaseAgeDays: 10,
  },

  routing: {
    /**
     * OPEN Q4: under $100K, SEON flagged, signals say "looks fake" - is the
     * next step Exhibit 1 to the rental houses, same as the $100K+ path?
     * Placeholder: yes, send Exhibit 1.
     */
    underLimitLooksFakeSendsExhibit1: true,

    /**
     * OPEN Q7: applicant confirms they are NOT a US resident or entity.
     * Placeholder: recommend decline.
     */
    nonUsApplicantRecommendsDecline: true,

    /**
     * OPEN Q8: which products enter this workflow.
     * Placeholder: Inland Marine only, per the scope doc.
     */
    productsInScope: ['im_annual', 'im_short_term'] as const,
  },

  exhibit1: {
    /**
     * OPEN Q5: when is Exhibit 1 "first time working with this client" vs
     * "the client is requesting higher limits"?
     * Placeholder: higher-limits wording when the applicant has a prior Athos
     * policy, first-time wording otherwise.
     */
    higherLimitsWhenPriorPolicy: true,
  },
} as const;

export type Thresholds = typeof thresholds;
