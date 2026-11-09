# M3 baseline

M3 is accepted at **95% or better agreement with underwriting, and zero cases
where the agent says approve and underwriting does not**. This records where
the extractor actually stands.

Re-run it with:

```bash
EXTRACT_PROVIDER=claude-code npm run eval:replies
```

## 8 November 2026

| Run | Provider | Strength agreement | False strongs | Cost |
|---|---|---|---|---|
| First honest run | claude-code (Sonnet) | 108/112 — **96.4%** | 0 | $2.21 |
| After four fixes | claude-code (Sonnet) | 110/112 — **98.2%** | 0 | $2.24 |
| Remaining two, fixed and re-run in isolation | claude-code (Sonnet) | 9/9 | 0 | $0.25 |

112 model calls take roughly five minutes at concurrency 6 and cost about
$2.20 of Claude Code usage. The headline number is strength agreement; field
accuracy (99.8% on the second run) is a diagnostic, not the bar.

**The 98.2% figure predates the last two fixes.** Both misses were verified
fixed in a targeted re-run, but the full set has not been run since. Re-run it
before quoting a number to anyone.

## What the runs found

Six issues, and only two of them were the model being wrong.

**An applicant could not win.** `app-006` — someone replying "this is my first
production and I haven't rented from anyone before" graded **negative**. The
`never-worked-with-client` rule was written for a rental house saying they do
not know the client, and was being applied to the applicant's own reply. An
honest first-timer was scored as a failed verification. Rules now carry the
party and the vouching rules only fire on rental-house replies.

**The extractor could not see the question.** `rh-strong-016` — a one-word
"Yes." came back as `unstated`, correctly: nothing told the model what was
being answered. It now receives the questions the template asked, which also
fixed two unrelated misses about the signed-contract question, which is only
put to individual owners.

**Two definitions were loose.** "I can't vouch for them beyond reputation" was
read as refusing to vouch; it is a qualification. "Referred by someone, I
think, can't remember who" was counted as a reference check; nobody checked
anything.

**A blanket policy is not a refusal about this client.** `rh-none-017` —
"we can't share account information without written authorisation" graded
negative. That policy applies to every customer and says nothing about this
one. Pulling that thread showed a reply I had filed as negative,
`rh-neg-017`, was really a strong vet: it confirms first-hand that they rented
to the client and the jobs went fine, then cites the same kind of blanket
policy. It is now `rh-strong-025`. The contrast with `rh-neg-008`, where the
discomfort is about this client specifically, is what the pair is for.

**A named reference with no contact details still counts.** `app-005` — the
applicant names one rental house and cannot remember the other. The named one
is a reference; the contact fields are nullable for exactly that reason.

## What this does not tell you

The fixtures are labelled with our reading of the workflow doc, not
underwriting's. A high score means the extractor agrees with us. It becomes
evidence about the real thing once Athos has been through
`docs/OPEN-QUESTIONS.md` and the labels are theirs.
