# The contract

Version 0. The developer refines this in M1; we sign off before M2.

The source of truth is the zod schema in `src/contract/`, not this file.
`npm run schema` emits JSON Schema for both halves so the .NET adapter can
generate types from the same definition the agent validates against.

## Case packet (in)

| Field | What it holds |
|---|---|
| `schemaVersion` | Must match the agent's. Bumped when a field changes. |
| `caseId`, `product` | Case id; `im_annual` or `im_short_term` |
| `applicant` | Name, business name, email, phone, address, websites and social links they gave, and whether they have a prior Athos policy |
| `rentedEquipmentLimit` | Requested rented equipment limit, USD |
| `underwritingGates` | Gates already hit: OFAC, Mexico, RCV over $150K, claims, trailers, TIB |
| `seon` | State (approve / review / decline), fraud score, fraud reasons, the three signals, and the full SEON response when we have it |
| `rentalHouses` | Each rental house: name, individual or business, contacts, stated equipment value |
| `correspondence` | Every email sent and received so far, oldest first, tagged by party and template |
| `now` | Current time, so tests control how long the case has been waiting |

### `seon.signals`

The three values the workflow doc reads off the SEON report:
`emailAccountCount`, `phoneAccountCount`, and the IP geolocation
(`ipCountry`, `ipRegion`, `ipCity`, `ipDistanceMilesFromAddress`).

**These are an Athos-side gap.** Today only the verified flag, score, blackbox
score and fraud reasons are stored on Customer. These three live in the SEON
report email and the SEON dashboard. Either store the raw response (a database
change, so a .NET handoff) or look them up from SEON at review time.

`null` means "we could not get it", which is **not** the same as zero. The agent
treats a null signal as unknown and says so in `warnings`. It never treats a
null as a failed check.

## Result (out)

| Field | What it holds |
|---|---|
| `stage` | triage, awaiting_rental_houses, awaiting_applicant, verified, escalated, done |
| `recommendation` | continue, route_to_underwriting, send_emails, wait, approve, escalate_to_service, recommend_decline |
| `reasons` | Each reason with the packet field or source URL it rests on |
| `outbound` | Drafted emails: `draftId`, recipients, template, subject, body |
| `extracted` | What each reply said, plus a strength (strong, weak, none, negative) |
| `verifiedEquipmentTotal` | Equipment value tallied from replies. Does not block approval. |
| `researchPacket` | Only on escalation: findings, each with a source URL |
| `followUpAt` | When to look again if nothing arrives |
| `warnings` | Anything a person must know that is not a reason |

### `draftId`

`${caseId}:${template}:${recipientKey}`.

The agent holds no state, so the same call made twice produces the same ids.
That is what lets the Work Queue tell a re-draft from a new email. **The Work
Queue, not the agent, is the source of truth for what has actually been sent** —
if `correspondence` is incomplete, the agent will re-draft an email that already
went out. See OPEN Q15.
