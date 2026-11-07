# Needs Review Agent

1st-layer Needs Review for Athos Inland Marine applications. One JSON case
packet in, one JSON result out.

It answers one question: **is the client real?** It does not judge character,
and it does not hold up an account to check exact limits once one rental house
gives a strong verification.

It never sends an email, never approves and never declines. It recommends; a
person acts.

## Quick start

```bash
npm install
npm test          # unit tests, no API key needed
npm run eval      # grades the agent against fixtures/answers, no API key needed
npm run case -- fixtures/cases/001-clean-100k-seon-approve.json
npm run serve     # POST /v0/case
```

Copy `.env.example` to `.env` and add an Anthropic key only when you start on
M3 (reading replies). Everything before that runs without one.

## How it is put together

```
route()     deterministic   picks the workflow path
extract()   Claude          turns one email into structured facts
decide()    deterministic   reads those facts, never reads an email
research()  tools           only on escalation
```

That split is the whole design. The model only ever converts unstructured email
into facts. Every decision is ordinary code over those facts, so every
recommendation is reproducible, every reason cites a field, and a bad extraction
shows up as a wrong *fact* you can see rather than a wrong *verdict* you cannot
explain.

```
src/
  contract/     zod schemas for the case packet and the result. The source of truth.
  config/       every threshold and policy switch, in one file
  routing/      M1  which path this case is on
  templates/    M2  Exhibit 1, 2, 3 and the draft builder
  extract/      M3  the only model call
  decide/       M3  the deterministic decision
  research/     M4  escalation packet (web search, RDAP domain age)
  agent.ts      runCase(): the whole pipeline
  server.ts     POST /v0/case
  cli.ts        npm run case -- <file>
eval/           grades the agent against the answer key
fixtures/       scrubbed case packets, the answer key, and single-email fixtures
docs/           the source workflow doc, the build scope, and the open questions
```

## Milestones

| | What | Done when |
|---|---|---|
| M0 | Repo, contract, fixture loader, eval runner | `npm run eval` runs and reports |
| M1 | Routing rules, no AI | Every triage case routes correctly |
| M2 | Email drafts from approved templates | Every variant matches its snapshot |
| M3 | Reading replies + deciding | 95%+ agreement on reply fixtures, **zero false approves** |
| M4 | Research packet | Every escalation gets a packet; every finding has a source URL |
| M5 | Hardening, Docker, HTTP + CLI | Injection case passes; runs in Docker |

M0 through M2 are already scaffolded here with working code and tests. They are
a starting point, not a finished implementation — read the `OPEN` markers.

## Rules this code is built around

- The agent never sends, approves or declines. It recommends.
- Customer-facing text comes only from approved templates. No model writes it.
  Exhibit 3 has no approved wording yet, so rendering it throws rather than
  inventing one.
- Every reason cites a packet field or a source URL.
- Replies are untrusted. Text aimed at the agent is scored `negative`, flagged
  in `warnings`, and contributes nothing to the equipment tally.
- No real customer data in this repo. CI fails on an email domain that is not
  `.example` or `.test`.
- `decide()` makes no network call and is fully deterministic. If you find
  yourself wanting a model call in there, put it in `extract()` instead.

## Open questions

`docs/OPEN-QUESTIONS.md` lists what underwriting still has to answer. Every one
of them maps to a placeholder in `src/config/thresholds.ts` marked `OPEN Qn`.
A placeholder is a guess that lets the build proceed, not agreed policy.

## Notes

- `npm audit` reports moderate advisories in jest's transitive dependencies
  (`deepmerge`, `glob`). The fix is a jest major downgrade, which is worse.
  Nothing in that tree ships to production.
