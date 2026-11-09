import { ClaudeExtractor } from '../src/extract/extract';
import { gradeReply } from '../src/verification';
import { BLANK_FACTS, factsOf } from '../src/fixtures/replyFixture';
import type { ReplyFixture } from '../src/fixtures/replyFixture';
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
  expectedStrength: string;
  actualStrength: string;
  fieldMisses: string[];
  error: string | null;
}

/** Keep the burst small; this runs against a capped key. */
const CONCURRENCY = 6;

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

function actualFacts(parsed: Record<string, unknown>): Record<string, unknown> {
  return {
    ...BLANK_FACTS,
    ...parsed,
    referencesGivenCount: Array.isArray(parsed.referencesGiven)
      ? parsed.referencesGiven.length
      : 0,
  };
}

async function gradeOne(fx: ReplyFixture, extractor: ClaudeExtractor): Promise<Row> {
  const expected = factsOf(fx);
  try {
    const parsed = await extractor.extractFacts({
      party: fx.party,
      rentalHouseName: fx.rentalHouseName,
      clientName: fx.clientName,
      subject: fx.subject,
      body: fx.body,
    });
    const actual = actualFacts(parsed as unknown as Record<string, unknown>);
    const want = expected as unknown as Record<string, unknown>;
    const fieldMisses = FACT_FIELDS.filter(
      (f) => want[f] !== undefined && actual[f] !== want[f]
    ).map((f) => `${f}: expected ${String(want[f])}, got ${String(actual[f])}`);

    const graded = gradeReply(actual as never);
    return {
      id: fx.id,
      expectedStrength: fx.expected.strength,
      actualStrength: graded.strength,
      fieldMisses,
      error: null,
    };
  } catch (err) {
    return {
      id: fx.id,
      expectedStrength: fx.expected.strength,
      actualStrength: 'ERROR',
      fieldMisses: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runReplyEval(filter?: string): Promise<number> {
  const all = loadReplies();
  const fixtures = filter ? all.filter((f) => f.id.includes(filter)) : all;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('\n  --replies needs ANTHROPIC_API_KEY. See .env.example.\n');
    return 2;
  }

  console.log(
    `\n  REPLY EVAL  ${fixtures.length} emails through ${process.env.EXTRACT_MODEL ?? 'claude-sonnet-5-5'}\n`
  );

  const extractor = new ClaudeExtractor();
  const rows = await mapLimit(fixtures, CONCURRENCY, (fx) => gradeOne(fx, extractor));

  for (const r of rows) {
    const ok = r.error === null && r.actualStrength === r.expectedStrength && r.fieldMisses.length === 0;
    if (ok) continue;
    console.log(`  ${r.actualStrength === r.expectedStrength ? 'FIELDS' : 'STRENGTH'}  ${r.id}`);
    if (r.error) console.log(`          error: ${r.error}`);
    if (r.actualStrength !== r.expectedStrength) {
      console.log(`          strength expected ${r.expectedStrength}, got ${r.actualStrength}`);
    }
    for (const m of r.fieldMisses) console.log(`          ${m}`);
  }

  printMatrix(
    'Strength',
    rows.map((r) => ({ expected: r.expectedStrength, actual: r.actualStrength }))
  );

  const strengthOk = rows.filter((r) => r.actualStrength === r.expectedStrength).length;
  const fieldTotal = rows.length * FACT_FIELDS.length;
  const fieldMisses = rows.reduce((n, r) => n + r.fieldMisses.length, 0);

  // The hard gate: nothing underwriting called negative or none may come back
  // strong. A false strong is how a bad client gets approved.
  const falseStrong = rows.filter(
    (r) =>
      (r.expectedStrength === 'negative' || r.expectedStrength === 'none') &&
      r.actualStrength === 'strong'
  );

  const pct = (strengthOk / rows.length) * 100;
  console.log(`\n  strength agreement: ${strengthOk}/${rows.length} (${pct.toFixed(1)}%)  target 95%`);
  console.log(
    `  field accuracy:     ${fieldTotal - fieldMisses}/${fieldTotal} (${(((fieldTotal - fieldMisses) / fieldTotal) * 100).toFixed(1)}%)`
  );
  console.log(`  false strongs:      ${falseStrong.length}  (must be 0)`);
  for (const r of falseStrong) console.log(`      ${r.id} was ${r.expectedStrength}`);
  console.log('');

  return falseStrong.length > 0 || pct < 95 ? 1 : 0;
}
