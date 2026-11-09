# Fixtures

Three kinds of file. All data here is **scrubbed**: every name, email, phone,
address, IP and SEON id is fake. The *shape* of the SEON data is real.

Nothing in this directory may contain real customer data. CI checks that email
domains are `.example` or `.test`.

## `cases/` — whole case packets

One JSON `CasePacket` per file, the same object the adapter will build from the
Athos database. `now` is baked in so a case that has been waiting three days is
reproducible.

Target mix (from the build scope):

- Clean $100K+ case
- SEON review, domestic
- SEON review, foreign
- SEON decline with confirmed fraud
- Under $100K flagged, looks real
- Under $100K flagged, looks fake
- Underwriting gates present
- Rental-house replies: strong, weak, "never heard of them", out-of-office, forwarded chain
- Applicant reference replies
- No reply after several days
- A reply that tries to instruct the agent

~25 files.

## `answers/` — the answer key

One per case, same filename. Filled in by **underwriting**, not by the
developer. This is what the build is graded against.

```jsonc
{
  "caseId": "CASE-001",
  "labelledBy": "underwriting",
  "expected": {
    "stage": "triage",
    "recommendation": "send_emails",
    "outboundTemplates": ["exhibit1_rental_house_vetting"],
    "verifiedEquipmentTotal": 94500,   // optional
    "expectedWarningsInclude": ["..."], // optional, substring match
    "mustNotApprove": true              // hard gate
  },
  "notes": "Why this is the right answer."
}
```

`mustNotApprove: true` is the hard gate. A case where underwriting would not
approve and the agent says `approve` fails the build, full stop, regardless of
the overall score.

## `replies/` — single emails

**This is where the M3 accuracy number comes from.** One case packet gives you
one data point; one case packet's worth of reply text gives you ten. There are
currently **112**, which is what makes "95% or better agreement" mean something
— on 20 samples a single miss costs 5 points.

One file per category, each holding an array:

| File | What it covers | Count |
|---|---|---|
| `rental-house-strong.json` | Prior history, named referrer plus comfort | 25 |
| `rental-house-weak.json` | References checked only, knows of the client | 18 |
| `rental-house-none.json` | Out-of-office, bounces, empty forwards, deflections | 20 |
| `rental-house-negative.json` | Never heard of them, declines to vouch, warnings | 21 |
| `applicant.json` | Exhibit 2 references and Exhibit 3 residency answers | 16 |
| `adversarial.json` | Replies that try to instruct the agent | 12 |

Each entry is one inbound email plus the facts underwriting says it contains:

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
    "strengthRuleId": "prior-rental-history"
  },
  "notes": "Terse. 74k must be read as 74000."
}
```

**Any fact left out of `expected` means "the email did not say"**: `unstated`
for the yes/no fields, `null` for values, `false` for the flags. That keeps a
fixture to the few lines that matter, which is what makes it cheap enough to
write a hundred of them.

`strength` and `strengthRuleId` are what the verification rules should produce
from those facts. `test/verification.test.ts` checks every fixture against the
registry with no model involved, so a rule change that breaks an existing grade
fails immediately.

### Running them against the model

```bash
npm run eval:replies              # all 112, needs ANTHROPIC_API_KEY
npm run eval:replies -- --only adv   # just the adversarial ones
```

Where it stands today is recorded in `docs/EVAL-BASELINE.md`.

It reports per-field accuracy, a strength confusion matrix, and the hard gate:
**no reply underwriting called negative or none may come back strong.** That is
how a bad client gets approved, so it fails the run on its own regardless of
the overall percentage.

### What to add next

The shapes worth more coverage, in rough order of how often they bite:

- Values written in unusual ways: ranges, "high five figures", per-day rates
  that must not be read as the package total
- Replies that answer about the wrong client
- Threads where a second reply corrects the first
- More languages, and machine-translated English
- Longer forwarded chains where the answer is three messages down
