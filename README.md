# Needs Review Agent

1st-layer Needs Review for Athos Inland Marine applications. One JSON case
packet in, one JSON result out, no state between calls.

It answers one question — **is the client real?** — and recommends. It never
sends an email, never approves, never declines. A person does those.

## Quick start

```bash
npm install
npm run check                 # typecheck, lint, format, tests with coverage, eval, schema
npm run case -- fixtures/cases/001-clean-100k-seon-approve.json
npm run serve                 # POST /v0/case
```

No API key needed. Copy `.env.example` to `.env` only to change a default.

## Who reads the emails

One step calls a model. Three interchangeable backends sit behind it:

| `EXTRACT_PROVIDER` | What                                       | For                             |
| ------------------ | ------------------------------------------ | ------------------------------- |
| `claude-code`      | the local Claude Code CLI, on its own auth | development, demos — **no key** |
| `anthropic`        | the API, with `ANTHROPIC_API_KEY`          | production                      |
| `fixture`          | replays labelled extractions               | tests and CI — offline          |

Unset, it picks `anthropic` when a key is present and `claude-code` otherwise.

```bash
EXTRACT_PROVIDER=claude-code npm run eval:replies   # 113 emails, ~5 min, ~$2
```

## Layout

```
src/
  contract/      zod schemas for the packet and the result — the source of truth
  config/        thresholds.ts: every number and policy switch
  verification/  rules.ts: what makes a reply strong, weak, none or negative
  routing/       which path of the workflow a case is on
  templates/     Exhibit 1, 2, 3 and the draft builder
  extract/       the only model call, and the providers behind it
  decide/        the deterministic decision
  research/      escalation packet: web search, RDAP domain age
  agent.ts       runCase(): the pipeline
  server.ts      POST /v0/case        cli.ts   npm run case
eval/            grades the agent against fixtures/answers and fixtures/replies
fixtures/        scrubbed cases, the answer key, 113 single-email fixtures
schema/          JSON Schema of the contract, for the .NET adapter
docs/            ARCHITECTURE · VERIFICATION-RULES · EVAL-BASELINE · OPEN-QUESTIONS
```

## Read next

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — the pipeline, and why the model never decides anything
- [docs/OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md) — the sixteen policy choices, what the POC does, what Athos still has to confirm
- [docs/VERIFICATION-RULES.md](docs/VERIFICATION-RULES.md) — adding a rule
- [docs/EVAL-BASELINE.md](docs/EVAL-BASELINE.md) — where M3 stands

`npm audit` reports moderate advisories in jest's dependency tree. Nothing there
ships; the fix is a jest major downgrade, which is worse.
