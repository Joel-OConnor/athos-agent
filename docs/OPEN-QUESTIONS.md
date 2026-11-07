# Open questions for underwriting

Sixteen questions. Ten are from the build scope; six more came out of writing
the routing code, where the workflow doc reads clearly to a person but does not
give code enough to go on.

Every one maps to a placeholder in `src/config/thresholds.ts` marked `OPEN Qn`.
**A placeholder is a guess that lets the build proceed, not agreed policy.** The
answer key in `fixtures/answers/` cannot be finished until these are settled, and
M1 is accepted against that answer key.

Each question has a proposed answer. If the proposal is right, "yes" is enough.

---

## Verification

**Q1. What counts as a strong verification?**
Proposed: the rental house has rented to this client before, **or** someone they
know referred the client and they say they're comfortable renting to them. "We
checked their references" on its own is weak.
*Answer:*

**Q9. After one strong verification, do we bind at the requested limit or the
verified total?**
The workflow says tally what we have and approve without chasing the rest. It
doesn't say which number goes on the policy.
Proposed: the requested limit.
*Answer:*

**Q12. Does one "never heard of them" cancel one strong verification?**
Two rental houses, one vouches, one says they've never dealt with this client.
Proposed: no — one strong verification still stands, but the negative reply is
always surfaced to the person approving.
*Answer:*

---

## SEON signals (under $100K, flagged)

**Q3. What exactly are the three thresholds?**
- "Over 5" email accounts: does that mean 6 or more?
- "Over 2" phone accounts: 3 or more?
- "Far away" for IP vs. address: how many miles? Or is a different state enough?
  A different country?

Proposed: strictly more than 5 and more than 2. For IP, flag on any of: over 500
miles, a different state, a different country.
*Answer:*

**Q11. How do the three signals combine?** *(not in the workflow doc at all)*
Email appears on 7 accounts, phone on 1, IP is 2,000 miles away. Real or fake?
Proposed: any single flag makes it "looks fake".
Alternatives: all three must pass; or majority wins.
*Answer:*

**Q4. Under $100K, flagged, looks fake — what happens next?**
Proposed: Exhibit 1 to the rental houses, same as the $100K+ path.
*Answer:*

---

## Emails

**Q2. What does the US-residency email say?**
The workflow tells us to send one but gives no wording. We need an Exhibit 3.
Until it exists the agent refuses to render it — no model and no developer
writes customer-facing text.
*Answer (please supply the wording):*

**Q5. Exhibit 1: when is it "first time working with this client" vs. "the client
is requesting higher limits"?**
Proposed: higher limits when the applicant has a prior Athos policy; first time
otherwise.
*Answer:*

**Q6. How long do we wait on rental houses before sending Exhibit 2, and is
there a reminder in between?**
Proposed: 3 business days, no reminder.
*Answer:*

**Q16. Exhibit 1 asks about GL requirements and a signed rental contract. Who
uses those answers?**
Nothing in v1 reads them — they don't speak to "is the client real".
Proposed: capture them and show them on the Work Queue item for underwriting.
*Answer:*

---

## Outcomes

**Q7. The client confirms they are not a US resident or entity. Decline?**
Proposed: yes, recommend decline.
*Answer:*

**Q13. The application lists no rental houses at all. What then?** *(not covered)*
Proposed: go straight to Exhibit 2 and ask the applicant for two references.
*Answer:*

**Q14. The applicant sends two references that look legitimate. What then?** *(not covered)*
The workflow only says what to do when the references are *questionable* (send
everything to service@).
Proposed: send Exhibit 1 to the referenced rental houses and verify them the
normal way. Currently the code escalates instead, which is safe but slow.
*Answer:*

---

## Scope and ownership

**Q8. Which products enter this workflow?**
Proposed: Inland Marine annual and short-term only — not STP or EGL, even when
they list rental houses.
*Answer:*

**Q10. Who acts on the agent's recommendation?**
Anyone on staff in the Work Queue, or underwriters only?
Proposed: anyone for "send emails"; underwriters only for approve, escalate and
decline.
*Answer:*

**Q15. Who owns "this email already went out"?** *(engineering, not policy)*
The agent keeps no state, so it re-drafts on every call and de-duplicates from
the `correspondence` list in the packet. If that list is incomplete we will send
the same email twice.
Proposed: the Work Queue is the source of truth, and the adapter must include
every sent email in `correspondence`.
*Answer:*
