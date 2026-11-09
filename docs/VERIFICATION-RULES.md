# Adding a verification rule

A rule answers one question: **how much does this reply count toward "the
client is real"?** — `strong`, `weak`, `none` or `negative`. All of them live in
`src/verification/rules.ts`. Nothing else duplicates that judgement.

## What a rule sees

`ReplyFacts`: who wrote the reply, and the flat set of answers the model pulled
out of it. Never the email text. A rule that read the email could be argued
into firing by whoever wrote it; a rule that reads
`workedWithClientBefore === 'yes'` cannot.

So: no email text, no network, no dates, no randomness. If you need a fact that
does not exist, add it to `ExtractedReply` in `src/contract/result.ts`, to
`ReplyFacts`, and to the prompt.

Most rules are guarded by `fromRentalHouse`. An applicant cannot vouch for
themselves, and one who says "I've never rented before" is being honest, not
failing a check.

## Order matters

First match wins. The list runs: negatives that override everything (injection,
warnings), auto-replies, strong, weak, then a catch-all `none`. A strong rule
placed below a weak one that also matches never fires.

## The description does two jobs

It is read by a person at Athos deciding whether the rule is right, and it is
pasted into the extraction prompt so the model knows which details matter.

- One plain sentence stating the situation, not the code. "The rental house has
  rented to this client before." Not "workedWithClientBefore is yes."
- Say when both halves are required. "…and they say they are comfortable
  renting to them. Both halves are required."
- Say what makes it weak rather than strong, if that is the point.
- No instructions. The model does not set strength; describe, do not direct.
- Under about 30 words. They all go in every prompt.

## Adding one

1. Append it in the right position, with a `source` someone can challenge.
2. Add a reply fixture in `fixtures/replies/` that exercises it.
3. `npm test` — every fixture is replayed through the registry.
4. `npm run eval` — confirm no case-level recommendation moved.

Thresholds and switches go in `src/config/thresholds.ts`, not here. A rule
grades one reply; how many strong replies approve a case is a threshold.
