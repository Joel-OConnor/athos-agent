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

This is where the M3 accuracy number actually comes from. One case packet gives
you one data point; one case packet's worth of reply text gives you ten. Writing
reply fixtures is cheap, so **aim for 100+** — that is the only way "95% or
better agreement" means anything.

Each file is one inbound email plus the facts underwriting says it contains.
Grade the extractor against these with `npm run eval -- --replies` (needs an
API key).

Variants worth covering for each strength: plain answer, answers 3 of 5
questions, value written as prose vs. a table, forwarded chain, long signature
block and legal disclaimer, out-of-office, bounce, "please talk to my
colleague", reply in a different language, and a reply with text aimed at the
agent.
