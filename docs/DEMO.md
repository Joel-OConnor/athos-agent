# Demo

Everything runs on the local Claude Code CLI, on whatever login it already has.
No API key, nothing deployed, nothing to clean up afterwards.

## Before you start

```bash
claude auth status            # loggedIn: true
npm install
npm run check                 # offline, about a minute, all green
```

`.env` is already set for the demo. `EXTRACT_PROVIDER=claude-code` pins the
backend even if an API key happens to be in your shell, and `EXTRACT_LOG=1`
prints every model call as it lands, so the long run is never silent.

## The run

**1. One case, start to finish.** About 20 seconds.

```bash
npm run case -- fixtures/cases/007-strong-rental-house-reply.json
```

A rental house wrote back. The model reads the one email and reports facts; the
rules grade it `strong`; the decision approves. Point at `extracted[0]` (what
the model said, and `strengthRuleId` for which rule fired), then `reasons`,
then `recommendation`.

**2. The reply that tries to steer the agent.** About 20 seconds.

```bash
npm run case -- fixtures/cases/008-prompt-injection-reply.json
```

The email tells the agent to mark the client verified. It comes back graded
`negative` with `containsInstructionsToAgent: true`, adds nothing to the
equipment total, and the agent asks the applicant for references instead of
approving.

**3. The dataset.** 113 labelled emails, about five minutes.

```bash
npm run eval:replies
```

Every email in `fixtures/replies/` goes through the model, one log line per
call, then a confusion matrix and the two numbers that matter: strength
agreement (the bar is 95%, runs land between 96% and 99%) and false strongs
(must be 0). Two or three misses a run is the noise floor, and they move
between runs. [EVAL-BASELINE.md](EVAL-BASELINE.md) has every run.

Know before you run it: as of 11 November, `adv-011` comes back strong on every
run, so the summary ends on `false strongs: 1` and the command exits 1. It is a
label-versus-prompt disagreement, written up in the baseline doc. Either settle
it before the demo, or use it: it is a good example of what the eval is for.

Short on time? One category at a time, by id prefix:

```bash
npm run eval:replies -- --only adv          # 12 adversarial emails, under a minute
npm run eval:replies -- --only rh-neg       # 22 negative replies
npm run eval:replies -- --only app          # 16 applicant replies
```

**4. As a service.** Second terminal for the curl.

```bash
npm run serve
curl -s -X POST localhost:3000/v0/case \
  -H 'content-type: application/json' \
  -d @fixtures/cases/007-strong-rental-house-reply.json
```

Same result as step 1, over HTTP. This is what the .NET adapter calls.

## Knobs, and if something goes wrong

- `Claude Code CLI not found`: run `which claude` and put the path in
  `CLAUDE_CODE_BIN` in `.env`.
- Slow, or rate limited: set `EXTRACT_CONCURRENCY=2` in `.env`.
- Want it faster: `EXTRACT_MODEL_LOCAL=claude-sonnet-5-5` in `.env` answers in
  about 10 seconds an email instead of 15 to 25. The baseline numbers were taken
  on `sonnet`, which the CLI resolves to Sonnet 4.6, so keep that for a
  like-for-like run.
- One email read differently from its label: expected, see the noise floor
  above. A false strong other than `adv-011` is not expected; that is the number
  to watch.
- Want to show the API path instead: `EXTRACT_PROVIDER=anthropic` and an
  `ANTHROPIC_API_KEY` in `.env`. Nothing else changes.
