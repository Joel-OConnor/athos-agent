# Fixtures

Everything here is **scrubbed**: every name, email, phone, address, IP and SEON
id is fake; the shape of the SEON data is real. CI fails on an email domain that
is not `.example` or `.test`, or a phone number that is not a 555.

## `cases/` and `answers/`

A case is one `CasePacket`, the object the adapter will build from the database,
with `now` baked in so a three-day-old case is reproducible. Its answer key has
the same filename and is filled in by underwriting:

```jsonc
{
  "caseId": "CASE-001",
  "expected": {
    "recommendation": "send_emails",
    "outboundTemplates": ["exhibit1_rental_house_vetting"],
    "needsFurtherReview": false, // optional
    "mustNotApprove": true, // the hard gate
  },
  "notes": "Why this is the right answer.",
}
```

`mustNotApprove: true` fails the build on its own if the agent approves.
Cases with inbound email need a labelled extraction in `extractions/`.

## `replies/`

One file per category, each an array. **This is where the M3 number comes
from**: 113 emails, each with the facts underwriting says it contains.

```jsonc
{
  "id": "rh-strong-002",
  "party": "rental_house",
  "rentalHouseName": "Mile High Example Rentals",
  "clientName": "Alvarez Grip Services",
  "subject": "Re: Client verification request",
  "body": "Yes we have. One job last spring, went fine. Package is 74k. GL required.",
  "expected": {
    "workedWithClientBefore": "yes",
    "replacementCostValue": 74000,
    "glRequired": "yes",
    "strength": "strong",
    "strengthRuleId": "prior-rental-history",
  },
}
```

**A fact left out of `expected` means the email did not say it**: `unstated`,
`null` or `false`. Assert only what the fixture is testing; the eval compares
only what is asserted.

`npm test` replays every fixture through the rules with no model, so a rule
change that breaks a grade fails immediately. `npm run eval:replies` runs them
through the model; see [docs/EVAL-BASELINE.md](../docs/EVAL-BASELINE.md).

Worth more coverage: values written unusually (ranges, per-day rates), replies
about the wrong client, a second reply correcting the first, more languages.
