# Open questions for underwriting

Sixteen questions. Ten came from the build scope; six surfaced while writing the
routing code.

All sixteen now have a **working answer**, agreed Athos-side on 2026-11-08 and
built into the agent. None has been confirmed by Athos underwriting yet.

A working answer is a guess that lets the build proceed. Each one is a single
named value in `src/config/thresholds.ts` marked `WORKING Qn`, or a single rule
in `src/verification/rules.ts`, so correcting one is a one-line change.

The shareable version of this register, for Athos to review and comment on, is
the *Needs Review Agent — Decisions for Athos Review* doc.

---

## Verification

**Q1. What counts as a strong verification?**
Prior rental history, **or** a named referrer the rental house knows plus stated
comfort renting to them. "We checked their references" alone is weak.
*Built as:* the verification rules registry, `src/verification/rules.ts`. Rules
can be added over time without touching the rest of the code; see
`docs/VERIFICATION-RULES.md` and the diagram in `docs/ARCHITECTURE.md`.

**Q9. Bind at the requested limit or the verified total?**
The requested limit. The tally is reported, never a blocker.
*Built as:* `thresholds.binding.bindAt`.

**Q12. Does one "never heard of them" cancel one strong verification?**
No. The strong one stands; the negative is surfaced to whoever approves.
*Built as:* `thresholds.verification.negativeCancelsStrong`.

---

## SEON signals (under $100K, flagged)

**Q3. What exactly are the three thresholds?**
Strictly over 5 email accounts, strictly over 2 phone accounts. For IP:
anywhere in the USA is fine, outside the US is a flag. Distance and a different
state are explicitly not flags.
*Built as:* `thresholds.seon.*`.

**Q11. How do the three signals combine?**
All three must pass.
*Built as:* `thresholds.seon.combineRule`.
*Consequence:* a signal we could not retrieve does not pass. Until the SEON
raw-response work lands, most flagged under-$100K cases will fall through to
rental-house vetting rather than resolving on signals. That is the safe
direction, but it is more email than the workflow doc implies.

**Q4. Under $100K, flagged, looks fake — what next?**
Exhibit 1 to the rental houses, and the case carries a needs-further-review
flag because the workflow doc does not settle this branch.
*Built as:* `thresholds.routing.underLimitLooksFake*`.

---

## Emails

**Q2. What does the US-residency email say?**
Generic placeholder wording is now in `src/templates/exhibit3.ts` so end-to-end
flows can be built, tested and demoed. **It has not been approved by the
business.** Every result that drafts it carries a warning. When Athos supplies
real wording, replace the body and set `EXHIBIT3_APPROVED` to true.

**Q5. Exhibit 1: "first time" or "higher limits"?**
Higher-limits wording when the applicant has an active Athos policy, first-time
otherwise.
*Built as:* `thresholds.exhibit1.higherLimitsWhenPriorPolicy`.
*Note:* the answer also implied a policy point we did not ask — that an existing
policyholder asking for a higher limit is usually approved, while a new policy
gets closer scrutiny. Worth confirming with Athos separately; the agent does not
act on it.

**Q6. How long before Exhibit 2, and is there a reminder?**
Three business days, no reminder. Counted in business days so a Friday email is
not chased on Monday.
*Built as:* `thresholds.timing.*`, `src/config/businessDays.ts`.

**Q16. Who uses the GL and signed-contract answers?**
Captured in `extracted` and shown on the Work Queue item for underwriting.
Nothing in v1 reads them — they do not speak to "is the client real".

---

## Outcomes

**Q7. The applicant is not a US resident or entity. Decline?**
Recommend decline, and flag for further review until Athos confirms that no
international business is supported.
*Built as:* `thresholds.routing.nonUsApplicant*`.

**Q13. No rental houses listed at all?**
Straight to Exhibit 2, asking the applicant for two previous references.
*Built as:* `thresholds.routing.noRentalHousesSendsExhibit2`.

**Q14. References that look good rather than questionable?**
Vet them with Exhibit 1 the normal way, and flag the case. The workflow doc
only covers the questionable-references branch, so this is our reading of it.
*Built as:* `thresholds.routing.applicantReferences*`.

---

## Scope and ownership

**Q8. Which products?**
Inland Marine annual and short-term only.
*Built as:* `thresholds.routing.productsInScope`.

**Q10. Who acts on a recommendation?**
Anyone on staff sends emails. Approve, escalate and decline are underwriters
only. The agent states this in `actorRole`; the Work Queue enforces it.
*Built as:* `thresholds.authority.*`.

**Q15. Who owns "this email already went out"?**
The Work Queue. The adapter must include every sent email in `correspondence`,
or the agent will re-draft one that already went.
*Built as:* deterministic `draftId`, `src/templates/draft.ts`.

---

## Still blocking

| What | Who | Blocks |
|---|---|---|
| Exhibit 3 wording (Q2) | Athos business | Sending any US-residency email for real |
| Whether international business is ever supported (Q7) | Athos | Confirming the decline path |
| Sign-off on all sixteen | Athos underwriting | Finishing the answer key, and M1 acceptance |
| The full SEON response in the packet | Athos engineering (.NET) | Q11 resolving on signals at all |
