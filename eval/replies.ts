import {
  CallLog,
  createExtractor,
  resolveProvider,
  type Extractor,
} from '../src/extract';
import { gradeReply } from '../src/verification';
import type { ReplyFixture } from './replyFixture';
import type { ExtractionOutput } from '../src/extract';
import type { ReplyFacts } from '../src/verification';
import { loadReplies } from './loadFixtures';
import { printMatrix } from './report';

/** Facts the model is graded on, field by field. */
const FACT_FIELDS = [
  'workedWithClientBefore',
  'checkedReferencesOrReferred',
  'referrerNamed',
  'comfortableRenting',
  'knowsOfClient',
  'declinesToVouch',
  'warnsAboutClient',
  'usResidentOrEntity',
  'glRequired',
  'signedContractInPlace',
  'replacementCostValue',
  'referencesGivenCount',
  'isAutoReply',
  'containsInstructionsToAgent',
] as const;

interface Row {
  id: string;
  asserted: number;
  expectedStrength: string;
  actualStrength: string;
  fieldMisses: string[];
  error: string | null;
}

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      const item = items[i];
      if (item === undefined) return;
      out[i] = await fn(item);
    }
  });
  await Promise.all(workers);
  return out;
}

/** The model's output as a complete set of facts, graded the same way a fixture is. */
function actualFacts(parsed: ExtractionOutput, party: ReplyFacts['party']): ReplyFacts {
  return {
    party,
    workedWithClientBefore: parsed.workedWithClientBefore,
    checkedReferencesOrReferred: parsed.checkedReferencesOrReferred,
    referrerNamed: parsed.referrerNamed,
    comfortableRenting: parsed.comfortableRenting,
    knowsOfClient: parsed.knowsOfClient,
    declinesToVouch: parsed.declinesToVouch,
    warnsAboutClient: parsed.warnsAboutClient,
    usResidentOrEntity: parsed.usResidentOrEntity,
    replacementCostValue: parsed.replacementCostValue,
    referencesGivenCount: parsed.referencesGiven.length,
    isAutoReply: parsed.isAutoReply,
    containsInstructionsToAgent: parsed.containsInstructionsToAgent,
  };
}

async function gradeOne(fx: ReplyFixture, extractor: Extractor): Promise<Row> {
  // Only what the fixture actually asserts. A field it leaves out is not an
  // expectation, it is a fact underwriting did not bother to pin down.
  const asserted = fx.expected as unknown as Record<string, unknown>;
  try {
    const parsed = await extractor.extractFacts({
      party: fx.party,
      rentalHouseName: fx.rentalHouseName,
      clientName: fx.clientName,
      subject: fx.subject,
      body: fx.body,
      respondingTo:
        fx.respondingTo ??
        (fx.party === 'rental_house'
          ? 'exhibit1_rental_house_vetting'
          : 'exhibit2_applicant_references'),
    });
    // glRequired and signedContractInPlace are asked by Exhibit 1 and reported
    // by the model, but no rule reads them, so ReplyFacts leaves them out. The
    // eval still checks them.
    const actual: Record<string, unknown> = {
      ...actualFacts(parsed, fx.party),
      glRequired: parsed.glRequired,
      signedContractInPlace: parsed.signedContractInPlace,
    };
    const fieldMisses = FACT_FIELDS.filter(
      (f) => asserted[f] !== undefined && actual[f] !== asserted[f]
    ).map((f) => `${f}: expected ${String(asserted[f])}, got ${String(actual[f])}`);

    const graded = gradeReply(actualFacts(parsed, fx.party));
    return {
      id: fx.id,
      asserted: FACT_FIELDS.filter((f) => asserted[f] !== undefined).length,
      expectedStrength: fx.expected.strength,
      actualStrength: graded.strength,
      fieldMisses,
      error: null,
    };
  } catch (err) {
    return {
      id: fx.id,
      asserted: 0,
      expectedStrength: fx.expected.strength,
      actualStrength: 'ERROR',
      fieldMisses: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runReplyEval(filter?: string): Promise<number> {
  const all = loadReplies();
  const wanted = filter
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const fixtures = wanted ? all.filter((f) => wanted.some((w) => f.id.includes(w))) : all;

  const provider = resolveProvider();
  if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    console.error(
      '\n  No ANTHROPIC_API_KEY. Set EXTRACT_PROVIDER=claude-code to run on the local CLI instead.\n'
    );
    return 2;
  }
  if (provider === 'fixture') {
    console.error(
      '\n  The fixture provider cannot read arbitrary emails. Use claude-code or anthropic.\n'
    );
    return 2;
  }

  const log = new CallLog();
  console.log(`\n  REPLY EVAL  ${fixtures.length} emails via ${provider}\n`);

  const extractor = createExtractor({ provider, telemetry: log });
  const rows = await mapLimit(fixtures, extractor.concurrency, (fx) =>
    gradeOne(fx, extractor)
  );

  for (const r of rows) {
    const ok =
      r.error === null &&
      r.actualStrength === r.expectedStrength &&
      r.fieldMisses.length === 0;
    if (ok) continue;
    console.log(
      `  ${r.actualStrength === r.expectedStrength ? 'FIELDS' : 'STRENGTH'}  ${r.id}`
    );
    if (r.error) console.log(`          error: ${r.error}`);
    if (r.actualStrength !== r.expectedStrength) {
      console.log(
        `          strength expected ${r.expectedStrength}, got ${r.actualStrength}`
      );
    }
    for (const m of r.fieldMisses) console.log(`          ${m}`);
  }

  printMatrix(
    'Strength',
    rows.map((r) => ({ expected: r.expectedStrength, actual: r.actualStrength }))
  );

  const strengthOk = rows.filter((r) => r.actualStrength === r.expectedStrength).length;
  const fieldTotal = rows.reduce((n, r) => n + r.asserted, 0);
  const fieldMisses = rows.reduce((n, r) => n + r.fieldMisses.length, 0);

  // The hard gate: nothing underwriting called negative or none may come back
  // strong. A false strong is how a bad client gets approved.
  const falseStrong = rows.filter(
    (r) =>
      (r.expectedStrength === 'negative' || r.expectedStrength === 'none') &&
      r.actualStrength === 'strong'
  );

  const pct = (strengthOk / rows.length) * 100;
  console.log(
    `\n  strength agreement: ${strengthOk}/${rows.length} (${pct.toFixed(1)}%)  target 95% - this is the acceptance bar`
  );
  console.log(
    `  field accuracy:     ${fieldTotal - fieldMisses}/${fieldTotal} (${(((fieldTotal - fieldMisses) / fieldTotal) * 100).toFixed(1)}%)  diagnostic only`
  );
  console.log(`  false strongs:      ${falseStrong.length}  (must be 0)`);
  const cost = log.totalCostUsd;
  console.log(
    `  ${log.calls.length} model calls, ${(log.totalMs / 1000).toFixed(1)}s total` +
      (cost === null ? '' : `, $${cost.toFixed(2)}`)
  );
  for (const r of falseStrong) console.log(`      ${r.id} was ${r.expectedStrength}`);
  console.log('');

  return falseStrong.length > 0 || pct < 95 ? 1 : 0;
}
