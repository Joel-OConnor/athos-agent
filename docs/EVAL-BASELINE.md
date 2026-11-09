# M3 baseline

M3 is accepted at **95% or better agreement with underwriting, and zero cases
where the agent says approve and underwriting does not**. This records where
the extractor actually stands.

Re-run it with:

```bash
EXTRACT_PROVIDER=claude-code npm run eval:replies
```

## 8 November 2026 — three full runs

| Run | Strength agreement | False strongs | Which fixtures missed | Cost |
|---|---|---|---|---|
| 1 | 108/112 — **96.4%** | 0 | app-006, rh-strong-016, rh-weak-017, rh-none-008 | $2.21 |
| 2, after fixes | 110/112 — **98.2%** | 0 | app-005, rh-none-017 | $2.24 |
| 3, after more fixes | 110/112 — **98.2%** | 0 | rh-none-007, rh-weak-014 | $2.27 |

All on `claude-code` with Sonnet. 112 calls take about five minutes at
concurrency 6 and cost about $2.25 of Claude Code usage. Field accuracy ran
98.4%, 99.8% and 99.1%; it is a diagnostic, not the bar.

### Read the third run carefully

Runs 2 and 3 both scored 98.2% and **failed on completely different
fixtures**. The two that failed in run 2 passed in run 3, and vice versa.

That tells you more than the number does. The remaining couple of percent is
not a stable set of hard cases waiting to be fixed — it is run-to-run variation
on emails that are genuinely ambiguous, where a careful person could read them
either way. Fixing the specific fixtures that failed on the last run would be
overfitting to a sample.

What is stable across all three runs is the part that matters: **zero false
strongs**, every time. Nothing underwriting called negative or none has ever
come back as a strong verification.

So: treat 98% as the working number and the noise floor as about two fixtures.
Chase a regression, not the last two points.

## What the runs found

Eight issues, and only three of them were the model being wrong. The rest were
my rules or my labels, which is the more useful kind of finding.

**An applicant could not win.** `app-006` — someone replying "this is my first
production and I haven't rented from anyone before" graded **negative**. The
`never-worked-with-client` rule was written for a rental house saying they do
not know the client, and was being applied to the applicant's own reply. Rules
now carry the party, and the vouching rules only fire on rental-house replies.

**Naming a referrer was not an exemption.** `rh-weak-014` — "Priya was referred
to us by Owen at Mile High, I haven't spoken to Owen to confirm" graded
**negative**, because `never-worked-with-client` did not check `referrerNamed`.
A rental house pointing us at a referral chain was being read as one that had
never heard of the client. The rule now excludes it, and there is a new
`referrer-named-unconfirmed` rule for the real signal: a referral exists, and
nobody has verified it.

**The extractor could not see the question.** `rh-strong-016` — a one-word
"Yes." came back as `unstated`, correctly. It now receives the questions the
template asked, which also fixed two misses about the signed-contract question,
which Exhibit 1 only puts to individual owners.

**A blanket policy is not a refusal about this client.** `rh-none-017` — "we
can't share account information without written authorisation" applies to every
customer. Pulling that thread showed a reply filed as negative was really a
strong vet: it confirms first-hand that they rented to the client and the jobs
went fine, then cites the same kind of policy. It is now `rh-strong-025`, and
sits against `rh-neg-008` where the discomfort is about this client.

**One fixture was testing two things.** `rh-none-007` mixed a clarification
request with "I can't find any record of them". The second is a claim about the
client; the first is not. Split into `rh-none-007` (a pure question) and
`rh-neg-023` (a pure claim), and both now grade cleanly.

**Smaller ones.** "I can't vouch beyond reputation" is a qualification, not a
refusal. "Referred by someone, I think, can't remember who" is not a reference
check. A named rental house with no contact details is still a reference, and
whether a reference is a *legitimate* rental house is the reviewer's judgement,
not the extractor's.

## What this does not tell you

The fixtures are labelled with our reading of the workflow doc, not
underwriting's. A high score means the extractor agrees with us. It becomes
evidence about the real thing once Athos has been through
`docs/OPEN-QUESTIONS.md` and the labels are theirs.
