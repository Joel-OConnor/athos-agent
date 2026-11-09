# Questions for Athos

Sixteen places where the Needs Review workflow doc does not give code enough to
go on. Each has a **POC choice** — what the agent does today — so the build
could proceed. **None is confirmed by Athos.** The sample cases are labelled
with these choices, so the agent's test results mean "it does what we think the
doc says" until Athos has been through this list.

Every choice is one value in `src/config/thresholds.ts` (marked `WORKING Qn`)
or one rule in `src/verification/rules.ts`. Correcting one is a one-line change.

| #   | Question                                     | POC choice                                                          | Athos                              |
| --- | -------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------- |
| 1   | What is a strong verification?               | Prior rental history, or a named referrer plus stated comfort       | Confirm                            |
| 2   | What does the US-residency email say?        | A draft in Athos's voice; flagged unapproved on every send          | **Supply wording**                 |
| 3   | The three SEON thresholds?                   | Over 5 email accounts, over 2 phone; IP flags only outside the US   | Confirm                            |
| 4   | Under $100K, flagged, looks fake?            | Exhibit 1 to the rental houses, and flag the case                   | Confirm                            |
| 5   | Exhibit 1: first time, or higher limits?     | Higher limits when there is an existing Athos policy                | Confirm                            |
| 6   | How long before Exhibit 2?                   | Three business days, no reminder                                    | Confirm                            |
| 7   | Applicant is not a US resident or entity?    | Recommend decline, and flag the case                                | **Is international ever written?** |
| 8   | Which products?                              | Inland Marine annual and short-term only                            | Confirm                            |
| 9   | Bind at the requested or the verified limit? | Requested                                                           | Confirm                            |
| 10  | Who acts on a recommendation?                | Anyone sends emails; underwriters approve, escalate, decline        | Confirm                            |
| 11  | How do the three SEON signals combine?       | At least one account count passes, and the IP is not outside the US | Confirm                            |
| 12  | Does a negative cancel a strong?             | No; the strong stands, the negative is shown to the approver        | Confirm                            |
| 13  | No rental houses listed?                     | Straight to Exhibit 2                                               | Confirm                            |
| 14  | Good references from the applicant?          | Vet them with Exhibit 1, and flag the case                          | **Decide**                         |
| 15  | Who owns "already sent"?                     | The Work Queue; the adapter must put every sent email in the packet | Confirm (engineering)              |
| 16  | Who uses the GL and contract answers?        | Captured and shown on the Work Queue item                           | Confirm                            |

A "yes" is enough where the POC choice is right.

## Verification

**Q1 — strong verification.** Prior rental history, or someone the rental house
knows referred the client _and_ they say they are comfortable renting. "We
checked their references" alone is weak. Two refinements from testing: an
applicant cannot vouch for themselves, and a rental house citing a blanket
policy ("we don't give references") is not refusing to vouch for _this_ client.
`verification/rules.ts`.

**Q9 — which limit.** The requested limit. The tally from replies is on the
file and never blocks. `binding.bindAt`.

**Q12 — negative versus strong.** One "never heard of them" does not cancel one
strong vet. It is surfaced to whoever approves. `verification.negativeCancelsStrong`.

## SEON signals (under $100K, flagged)

**Q3 — thresholds.** Strictly over 5 email accounts, strictly over 2 phone
accounts. Anywhere in the USA is fine; outside the US is a flag. Distance and a
different state are not flags. `seon.*`.

**Q11 — how they combine.** The doc says of each account count on its own
"this appears to be a real person" — positive evidence. Of the IP it says only
that a mismatch "is a red flag". So: at least one positive and no red flag. A
signal we could not retrieve is not evidence either way. `seon.combineRule`;
`all_must_pass` and `majority` are still selectable.

**Q4 — looks fake.** Exhibit 1 to the rental houses, and the case carries
`needsFurtherReview` because the doc does not settle this branch.
`routing.underLimitLooksFake*`.

## Emails

**Q2 — US-residency email.** The doc says to send one and gives no text. A
draft in the voice of Exhibits 1 and 2 is in `templates/exhibit3.ts`. It asks
whether they are a US resident or entity, where the business is registered and
under what name, and the US address where the equipment will be used. It does
not ask for identity documents — Stripe Selfie ID already covers that. Every
draft of it carries a warning until `EXHIBIT3_APPROVED` is set.

**Q5 — Exhibit 1 wording.** "Requesting higher limits" when the applicant holds
an Athos policy, "first time working with this client" otherwise. This picks a
sentence and nothing else. `exhibit1.higherLimitsWhenPriorPolicy`.

**Q6 — timing.** Three business days on the rental houses before Exhibit 2, no
reminder. A Friday email is not chased on Monday. `timing.*`.

**Q16 — GL and signed-contract answers.** Captured in `extracted` and shown on
the Work Queue item. Nothing in v1 reads them.

## Outcomes

**Q7 — not US.** Recommend decline, flagged until Athos says whether
international business is ever written. `routing.nonUsApplicant*`.

**Q13 — no rental houses.** Straight to Exhibit 2. `routing.noRentalHousesSendsExhibit2`.

**Q14 — good references.** The doc covers _questionable_ references (send to
service@) and nothing else. The POC vets the named houses with Exhibit 1 and
flags the case, because approving on the applicant's own unverified claim would
contradict the workflow. **This is a placeholder, not an answer.**
`routing.applicantReferences*`.

## Scope and ownership

**Q8 — products.** Inland Marine annual and short-term. `routing.productsInScope`.

**Q10 — who acts.** Every result carries `actorRole`: `any_staff` to send,
`underwriter` to approve, escalate or decline. The Work Queue enforces it.
`authority.*`.

**Q15 — already sent.** The agent keeps no state and de-duplicates drafts by a
stable id. If the adapter leaves a sent email out of `correspondence`, that
email is drafted again. `templates/draft.ts`.

## What blocks go-live

| What                                           | Who                      | Blocks                                              |
| ---------------------------------------------- | ------------------------ | --------------------------------------------------- |
| A yes or a correction on each of the sixteen   | Athos underwriting       | Finishing the answer key; M1 acceptance             |
| Exhibit 3 wording (Q2)                         | Athos business           | Sending any US-residency email for real             |
| Whether international business is written (Q7) | Athos                    | The decline path                                    |
| A decision on Q14                              | Athos underwriting       | Replacing the placeholder                           |
| The full SEON response in the case packet      | Athos engineering (.NET) | Most flagged under-$100K cases resolving on signals |
