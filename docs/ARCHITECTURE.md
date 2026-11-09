# Architecture

One JSON case packet in, one JSON result out. No state between calls.

## The pipeline

```mermaid
flowchart TB
    subgraph athos["Athos systems (not the developer's)"]
        db[("Athos DB + SEON")]
        adapter["Adapter<br/>builds the case packet"]
        queue["Work Queue item<br/>a person clicks Send or Approve"]
        mail["service@ sends the email<br/>replies go back into the packet"]
    end

    subgraph agent["Needs Review agent"]
        direction TB
        route["<b>route()</b> · deterministic<br/>which path of the workflow<br/><i>src/routing/</i>"]
        extract["<b>extract()</b> · Claude<br/>one email → facts<br/><i>src/extract/</i>"]
        grade["<b>gradeReply()</b> · deterministic<br/>facts → strength<br/><i>src/verification/</i>"]
        decide["<b>decide()</b> · deterministic<br/>facts → recommendation<br/><i>src/decide/</i>"]
        drafts["<b>buildDrafts()</b> · deterministic<br/>approved templates only<br/><i>src/templates/</i>"]
        research["<b>research()</b> · tools<br/>only on escalation<br/><i>src/research/</i>"]
    end

    subgraph config["Where the policy lives"]
        thresholds[/"<b>thresholds.ts</b><br/>every number and switch<br/>$100K, SEON thresholds,<br/>wait times, who may act"/]
        rules[/"<b>verification/rules.ts</b><br/>THE RULES REGISTRY<br/>what makes a reply<br/>strong, weak, none, negative"/]
    end

    db --> adapter --> route
    route --> extract --> grade --> decide
    route --> drafts --> decide
    decide --> research
    decide --> queue --> mail --> adapter

    thresholds -.-> route
    thresholds -.-> decide
    rules -.-> grade
    rules -.-> extract

    style rules fill:#fff3cd,stroke:#b8860b,stroke-width:2px
    style thresholds fill:#fff3cd,stroke:#b8860b,stroke-width:2px
    style extract fill:#d1e7ff,stroke:#2c5aa0,stroke-width:2px
    style research fill:#d1e7ff,stroke:#2c5aa0,stroke-width:2px
```

Blue is the only place a model runs. Yellow is the only place policy lives.

## Why the split

`extract()` turns one email into facts. It is the single point where model
output enters the system, and it produces **facts, never a verdict**: did they
say they have worked with this client, did they name a referrer, what number did
they give. It does not decide anything.

Everything downstream is ordinary code. `gradeReply()` turns facts into a
strength by walking the rules registry. `decide()` turns strengths and timing
into a recommendation. Both are deterministic: same input, same output, every
time, with no network call.

That buys three things. A recommendation can be reproduced and explained. Every
reason cites a packet field. And a bad extraction shows up as a wrong *fact* on
the Work Queue, which a person can see, rather than a wrong *verdict*, which
they cannot.

## Where verification rules reside

**`src/verification/rules.ts`** — the registry. Rules are tried in order and
the first match wins, so the list runs strongest first and ends with a
catch-all.

A rule is one object:

```ts
{
  id: 'prior-rental-history',
  strength: 'strong',
  description:
    'The rental house has rented to this client before. This is the clearest signal that the client is real.',
  source: 'Workflow doc: "Have you worked with this client before?"',
  addedOn: '2026-11-04',
  when: (f) => f.workedWithClientBefore === 'yes',
}
```

Each rule does double duty. `when` grades the reply. `description` is fed into
the extraction prompt, so the model knows which details matter and does not
report "unstated" for something the email actually answered. Adding a rule
improves both halves at once.

`docs/VERIFICATION-RULES.md` is the authoring guide: what a rule may look at,
how to write a description the model can use, and how to test one.

## Where everything else lives

| Decision | File |
|---|---|
| The $100K referral threshold, SEON thresholds, wait times, who may act | `src/config/thresholds.ts` |
| What makes a reply strong, weak, none or negative | `src/verification/rules.ts` |
| Customer-facing wording | `src/templates/exhibit*.ts` |
| Which path a case is on | `src/routing/route.ts` |
| What to recommend | `src/decide/decide.ts` |
| The shape of the packet and the result | `src/contract/` |

If a change touches anything outside the first three rows, it is a behaviour
change and needs a test.
