# Adding a verification rule

A verification rule answers one question: **how much does this reply count
toward "the client is real"?** The answer is one of `strong`, `weak`, `none` or
`negative`.

All of them live in `src/verification/rules.ts`. That file is the only place
this judgement is made. Nothing in the routing code, the decision code or the
prompt duplicates it.

## What a rule looks at

A rule sees `ReplyFacts` — a flat set of answers a model pulled out of one
email — and nothing else. It never sees the email text.

That is deliberate. A rule that read the email could be argued into firing by
whoever wrote the email. A rule that reads only `workedWithClientBefore === 'yes'`
cannot: the worst a hostile email can do is make the model report a wrong fact,
and a wrong fact is visible on the Work Queue in a way a wrong verdict is not.

So: **no reading email text, no network calls, no dates, no randomness.** If a
rule needs a fact that does not exist yet, add the field to `ExtractedReply` in
`src/contract/result.ts`, add it to `ReplyFacts`, and describe it in the prompt
so the model knows to fill it.

## Order matters

Rules are tried top to bottom and the first match wins. The list runs:

1. Negatives that override everything (injection, warnings about the client)
2. Auto-replies and bounces
3. Strong signals
4. Weak signals
5. A catch-all that returns `none`

Put a new rule where it belongs in that order. A strong rule placed below a weak
one that also matches will never fire.

## Writing the description

The `description` is read by two audiences, which is why it is prose and not a
comment.

A **person** reviewing whether the rule is right, often someone at Athos who
does not read code. They should be able to agree or disagree with the sentence
on its own.

The **model**, during extraction. Every description is pasted into the
extraction prompt as the list of things that matter. This is what stops the
model answering "unstated" to a question the email did answer, in words the
prompt never anticipated.

What works for both:

- **One sentence, stating the situation, not the code.** "The rental house has
  rented to this client before." Not "workedWithClientBefore is yes."
- **Plain words a person at Athos would use.** No field names, no booleans, no
  jargon.
- **Say when both halves are required.** "Someone they know referred this
  client, *and* they say they are comfortable renting to them. Both halves are
  required." The model will otherwise accept either one.
- **Say what makes it weak rather than strong**, if that is the point. "Helpful,
  but it is their judgement rather than first-hand knowledge." The contrast is
  what the model needs to tell two near-identical replies apart.
- **Do not write instructions.** "Set strength to strong when..." is wrong — the
  model does not set strength. Describe the situation; the code grades it.

Keep descriptions under about 30 words. They all go in every prompt, and a long
list of long sentences makes the important ones harder to find.

## Adding one

1. Append the rule in the right position in `verificationRules`.
2. Fill in `source` — where the rule comes from, so someone can challenge it.
   A line in the workflow doc, a question number, a decision and its date.
3. Add a reply fixture in `fixtures/replies/` that exercises it: a realistic
   email, the facts it contains, and the `strength` and `strengthRuleId` you
   expect.
4. `npm test`. `test/verification.test.ts` replays every reply fixture through
   the registry, so a rule that breaks an existing grade fails there.
5. `npm run eval` to confirm no case-level recommendation moved.

## What does not belong here

Thresholds and policy switches — the $100K line, how long to wait, who may
approve — live in `src/config/thresholds.ts`.

How many strong verifications are needed to approve is a threshold, not a rule.
A rule grades one reply. The decision about a whole case is in
`src/decide/decide.ts`.
