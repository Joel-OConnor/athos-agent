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
npm run eval:replies  # grades the extractor against 113 reply fixtures
npm run case -- fixtures/cases/001-clean-100k-seon-approve.json
npm run serve     # POST /v0/case
```

Copy `.env.example` to `.env`. **You do not need an Anthropic API key to work
on this.**

## Who reads the emails

One step in the pipeline calls a model. Three backends can be behind it, and
they are interchangeable — same prompt, same contract, same grading.

| `EXTRACT_PROVIDER` | What it is | Use it for |
|---|---|---|
| `claude-code` | The local Claude Code CLI, on whatever auth it already has | Development, end-to-end testing, demos. **No API key.** |
| `anthropic` | The Anthropic API with a key | Production |
| `fixture` | Replays labelled extractions from `fixtures/extractions/` | Tests and CI. Offline, free, deterministic. |

Unset, it takes `anthropic` when `ANTHROPIC_API_KEY` is present and
`claude-code` otherwise. A developer's machine has the CLI and no key; a
deployment has the key.

```bash
EXTRACT_PROVIDER=claude-code npm run eval:replies
EXTRACT_PROVIDER=claude-code npm run case -- fixtures/cases/007-strong-rental-house-reply.json
EXTRACT_LOG=1 ...   # print provider, latency and cost per call
```

The local path shells out to `claude -p` with `--tools ""`, `--json-schema`
(the contract itself), `--strict-mcp-config`, `--disable-slash-commands` and a
cwd in an empty temp directory, so it reads an email and nothing else and does
not pick up this project's `CLAUDE.md`. Reckon on roughly 15 seconds and a few
cents a call, so a full run is about five minutes and a couple of dollars.

Adding a fourth backend means one class with one method: see
`src/extract/providers/`.

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
  verification/ the rules registry: what makes a reply strong, weak, none, negative
  routing/      M1  which path this case is on
  templates/    M2  Exhibit 1, 2, 3 and the draft builder
  extract/      M3  the only model call, and the providers behind it
  decide/       M3  the deterministic decision
  research/     M4  escalation packet (web search, RDAP domain age)
  agent.ts      runCase(): the whole pipeline
  server.ts     POST /v0/case
  cli.ts        npm run case -- <file>
eval/           grades the agent against the answer key
fixtures/       scrubbed case packets, the answer key, and 113 single-email fixtures
docs/           ARCHITECTURE, VERIFICATION-RULES, CONTRACT, OPEN-QUESTIONS,
                and the two source documents
```

## Milestones

| | What | Done when |
|---|---|---|
| M0 | Repo, contract, fixture loader, eval runner | `npm run eval` runs and reports |
| M1 | Routing rules, no AI | Every triage case routes correctly |
| M2 | Email drafts from approved templates | Every variant matches its snapshot |
| M3 | Reading replies + deciding | 95%+ agreement across 113 reply fixtures, **zero false strongs**. Standing at 98.2% across three runs, see `docs/EVAL-BASELINE.md` |
| M4 | Research packet | Every escalation gets a packet; every finding has a source URL |
| M5 | Hardening, Docker, HTTP + CLI | Injection case passes; runs in Docker |

M0 through M2 are already scaffolded here with working code and tests. They are
a starting point, not a finished implementation — read the `OPEN` markers.

## Rules this code is built around

- The agent never sends, approves or declines. It recommends.
- Customer-facing text comes only from templates. No model writes it. Exhibit 3
  is placeholder wording pending business sign-off, so every draft of it carries
  a warning.
- How much a reply counts lives in one place, `src/verification/rules.ts`.
  Adding a rule is appending one object and one fixture.
- Every reason cites a packet field or a source URL.
- Replies are untrusted. Text aimed at the agent is scored `negative`, flagged
  in `warnings`, and contributes nothing to the equipment tally.
- No real customer data in this repo. CI fails on an email domain that is not
  `.example` or `.test`.
- `decide()` makes no network call and is fully deterministic. If you find
  yourself wanting a model call in there, put it in `extract()` instead.

## Open questions

All sixteen have working answers as of 2026-11-08, built in and marked
`WORKING Qn` in `src/config/thresholds.ts`. None is confirmed by Athos yet.
`docs/OPEN-QUESTIONS.md` is the register, and the four that still block go-live
are listed at the end of it.

## Notes

- `npm audit` reports moderate advisories in jest's transitive dependencies
  (`deepmerge`, `glob`). The fix is a jest major downgrade, which is worse.
  Nothing in that tree ships to production.
