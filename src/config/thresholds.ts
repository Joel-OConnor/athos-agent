/**
 * Every number and every policy switch the workflow depends on lives here, and
 * nowhere else. Changing underwriting policy should mean editing this file.
 *
 * Status of each entry:
 *   WORKING Qn  - answered by Athos-side review on 2026-11-08, pending Athos
 *                 confirmation. See docs/OPEN-QUESTIONS.md.
 *   OPEN Qn     - still unanswered; the value is a placeholder.
 *
 * How a reply is graded is NOT here. That lives in the verification rules
 * registry, src/verification/rules.ts, so rules can be added over time without
 * touching this file. See docs/VERIFICATION-RULES.md.
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
    /** WORKING Q3. Workflow: "over 5" email accounts, read strictly as > 5. */
    minEmailAccounts: 5,
    emailAccountsComparison: 'greater_than' as const,

    /** WORKING Q3. Workflow: "over 2" phone accounts, read strictly as > 2. */
    minPhoneAccounts: 2,
    phoneAccountsComparison: 'greater_than' as const,

    /**
     * WORKING Q3. Anywhere in the USA is fine; outside the US is a flag.
     * Distance and a different state are explicitly NOT flags, so a Burbank
     * applicant working out of Atlanta does not trip this.
     */
    ipDifferentCountryIsFlag: true,
    ipDifferentStateIsFlag: false,
    ipFarAwayMiles: null as number | null,

    /**
     * WORKING Q11. All three signals must pass for a flagged under-$100K case
     * to be treated as a real person.
     *
     * Consequence worth knowing: a signal we could not retrieve does not pass,
     * so until the SEON raw-response work lands, most flagged under-$100K cases
     * will fall through to rental-house vetting rather than resolving here.
     * That is the safe direction, but it is more email than the workflow doc
     * implies.
     */
    combineRule: 'all_must_pass' as
      | 'all_must_pass'
      | 'majority'
      | 'any_flag_fails',
  },

  verification: {
    /**
     * How many strong verifications end the chase.
     * Workflow: "Since we got one strong vet, tally up the totals ... and approve."
     */
    strongVerificationsNeeded: 1,

    /**
     * WORKING Q12. A negative reply does not cancel a strong one, but it is
     * always surfaced to whoever approves.
     */
    negativeCancelsStrong: false,
  },

  timing: {
    /** WORKING Q6. Three business days on the rental houses, no reminder. */
    rentalHouseWaitBusinessDays: 3,
    rentalHouseReminderBusinessDays: null as number | null,
    applicantReferenceWaitBusinessDays: 3,
    /** After this, a case with nothing usable goes to service@ either way. */
    maxCaseAgeBusinessDays: 10,
  },

  routing: {
    /**
     * WORKING Q4. Under $100K, flagged, signals say "looks fake": send
     * Exhibit 1, and flag the case for further review. The workflow doc does
     * not settle this branch, so a person should look at it.
     */
    underLimitLooksFakeSendsExhibit1: true,
    underLimitLooksFakeNeedsFurtherReview: true,

    /**
     * WORKING Q7. An applicant who confirms they are not a US resident or
     * entity is a decline, unless Athos supports international business.
     * Flagged for further review until Athos confirms.
     */
    nonUsApplicantRecommendsDecline: true,
    nonUsApplicantNeedsFurtherReview: true,

    /** WORKING Q8. Inland Marine annual and short-term only. */
    productsInScope: ['im_annual', 'im_short_term'] as const,

    /**
     * WORKING Q13. An application with no rental houses listed goes straight
     * to Exhibit 2, asking the applicant for two previous references.
     */
    noRentalHousesSendsExhibit2: true,

    /**
     * WORKING Q14. References the applicant supplies are vetted the normal
     * way - Exhibit 1 to each one with a contact email - and the case is
     * flagged for further review. The workflow doc only covers the
     * questionable-references branch, so this is our reading of it.
     */
    applicantReferencesGetExhibit1: true,
    applicantReferencesNeedFurtherReview: true,
  },

  binding: {
    /**
     * WORKING Q9. After one strong verification we bind at the requested
     * limit, not the verified total. The tally is reported, never a blocker.
     */
    bindAt: 'requested_limit' as 'requested_limit' | 'verified_total',
  },

  authority: {
    /**
     * WORKING Q10. Anyone on staff may send drafted emails. Approve, escalate
     * and decline are underwriters only. The Work Queue enforces it.
     */
    sendEmails: 'any_staff' as const,
    approveEscalateDecline: 'underwriter' as const,
  },

  exhibit1: {
    /**
     * WORKING Q5. Higher-limits wording when the applicant has an active Athos
     * policy; first-time wording otherwise.
     */
    higherLimitsWhenPriorPolicy: true,
  },
} as const;

export type Thresholds = typeof thresholds;
