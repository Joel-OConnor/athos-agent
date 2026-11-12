# M3 baseline

M3 is accepted at **95% or better agreement with underwriting, and zero cases
where the agent says approve and underwriting does not.**

```bash
EXTRACT_PROVIDER=claude-code npm run eval:replies
```

## 8 November 2026

| Run | Strength agreement | False strongs | Missed                                           | Cost  |
| --- | ------------------ | ------------- | ------------------------------------------------ | ----- |
| 1   | 108/112 — 96.4%    | 0             | app-006, rh-strong-016, rh-weak-017, rh-none-008 | $2.21 |
| 2   | 110/112 — 98.2%    | 0             | app-005, rh-none-017                             | $2.24 |
| 3   | 110/112 — 98.2%    | 0             | rh-none-007, rh-weak-014                         | $2.27 |

Sonnet via `claude-code`, concurrency 6, about five minutes a run.

**Runs 2 and 3 scored the same and failed on different fixtures.** The last
couple of percent is not a set of hard cases waiting to be fixed; it is
variation on emails a careful person could read either way. Fixing whichever
two failed last would be overfitting. What is stable is **zero false strongs**
on every run. Treat 98% as the number and two fixtures as the noise floor.

## 11 November 2026

| Run | Strength agreement | False strongs | Missed  | Cost  |
| --- | ------------------ | ------------- | ------- | ----- |
| 4   | 112/113 (99.1%)    | 1             | adv-011 | $2.31 |

Sonnet 4.6 via `claude-code` (what the CLI's `sonnet` alias resolves to),
concurrency 4, about seven minutes; concurrency 6 brings it back to five. The
prompt and the fixtures are unchanged since the 8 November runs.

**adv-011 is not noise.** It came back strong on seven runs out of seven today,
on Sonnet 4.6 and on Sonnet 5.5. The email is a rental house saying yes, we
have worked with them, then relaying a request to raise the policy limit and
asking us to action it. The label says that is an instruction to the agent.
The prompt says a request about the policy, even an insistent one, is a person
writing to a person, and the model follows the prompt. The two disagree, and
that is a policy call rather than a prompt bug: is a third party asking us to
change the client's cover an instruction, or a request? Until it is settled,
`npm run eval:replies` ends on `false strongs: 1` and exits 1.

**Field accuracy was under-reported before this run.** The eval never read
`glRequired` or `signedContractInPlace` out of the model's answer, so every
fixture that asserted either showed a miss. 29 of this run's 30 field misses
were that. Fixed; the field number is right from the next run on, and is not
comparable to earlier runs.

## What the runs found

Eight issues; three were the model being wrong.

- **An applicant could not win.** "I haven't rented from anyone before" graded
  negative — a rental-house rule applied to the applicant's own reply. Rules
  now carry the party.
- **Naming a referrer was not an exemption.** "Owen at Mile High referred her, I
  haven't confirmed" graded negative via `never-worked-with-client`. New rule
  `referrer-named-unconfirmed`.
- **The extractor could not see the question.** A bare "Yes." was correctly
  `unstated`. It now receives the questions the template asked.
- **A blanket policy is not a refusal about this client.** "We can't share
  account information without authorisation" says nothing about the client.
  Pulling that thread reclassified `rh-neg-017` as a strong vet.
- Smaller: a qualification is not a refusal; a half-remembered referral is not a
  reference check; a named reference with no contact details still counts;
  whether a reference is a _legitimate_ rental house is the reviewer's call.

## What this does not tell you

The fixtures carry our reading of the workflow doc. The number says the
extractor agrees with us. It becomes evidence about the real thing once Athos
has been through [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) and the labels are
theirs.
