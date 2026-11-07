import { runCase } from '../src/agent';
import { FixtureExtractor } from '../src/extract/extract';
import type { ExtractedReply } from '../src/contract';
import { loadCases, loadReplies, type CaseFixture } from './loadFixtures';
import { printMatrix } from './report';

interface Row {
  file: string;
  expected: string;
  actual: string;
  pass: boolean;
  falseApprove: boolean;
  detail: string[];
}

async function evalCase(fx: CaseFixture): Promise<Row> {
  const detail: string[] = [];
  const extractor = new FixtureExtractor(
    new Map(fx.extractions.map((e: ExtractedReply) => [e.correspondenceId, e]))
  );

  let actual = 'ERROR';
  let stage = 'ERROR';
  let templates: string[] = [];
  let total = 0;
  let warnings: string[] = [];

  try {
    const result = await runCase(fx.packet, { extractor });
    actual = result.recommendation;
    stage = result.stage;
    templates = result.outbound.map((o) => o.template);
    total = result.verifiedEquipmentTotal;
    warnings = result.warnings;
  } catch (err) {
    detail.push(`threw: ${err instanceof Error ? err.message : String(err)}`);
  }

  const e = fx.expected;
  let pass = true;
  if (e.recommendation && e.recommendation !== actual) {
    pass = false;
    detail.push(`recommendation expected ${e.recommendation}, got ${actual}`);
  }
  if (e.stage && e.stage !== stage) {
    pass = false;
    detail.push(`stage expected ${e.stage}, got ${stage}`);
  }
  if (e.outboundTemplates) {
    const want = [...e.outboundTemplates].sort().join(',');
    const got = [...templates].sort().join(',');
    if (want !== got) {
      pass = false;
      detail.push(`outbound expected [${want}], got [${got}]`);
    }
  }
  if (e.verifiedEquipmentTotal !== undefined && e.verifiedEquipmentTotal !== total) {
    pass = false;
    detail.push(`equipment total expected ${e.verifiedEquipmentTotal}, got ${total}`);
  }
  for (const needle of e.expectedWarningsInclude ?? []) {
    if (!warnings.some((w) => w.includes(needle))) {
      pass = false;
      detail.push(`expected a warning containing "${needle}"`);
    }
  }

  const falseApprove = e.mustNotApprove === true && actual === 'approve';
  if (falseApprove) {
    pass = false;
    detail.push('FALSE APPROVE - agent approved a case underwriting would not');
  }

  return { file: fx.file, expected: e.recommendation ?? '(any)', actual, pass, falseApprove, detail };
}

async function runCaseEval(): Promise<number> {
  const cases = loadCases();
  const rows: Row[] = [];
  for (const fx of cases) rows.push(await evalCase(fx));

  console.log('\n  CASE EVAL  (routing + decisions, no model calls)\n');
  for (const r of rows) {
    console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.file}`);
    for (const d of r.detail) console.log(`        ${d}`);
  }

  printMatrix(
    'Recommendation',
    rows.map((r) => ({ expected: r.expected, actual: r.actual }))
  );

  const passed = rows.filter((r) => r.pass).length;
  const falseApproves = rows.filter((r) => r.falseApprove).length;
  const pct = rows.length === 0 ? 0 : (passed / rows.length) * 100;
  console.log(`\n  ${passed}/${rows.length} cases correct (${pct.toFixed(1)}%)`);
  console.log(`  false approves: ${falseApproves}  (must be 0)\n`);

  return falseApproves > 0 || passed < rows.length ? 1 : 0;
}

async function runReplyEval(): Promise<number> {
  const replies = loadReplies();
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('  --replies needs ANTHROPIC_API_KEY. See .env.example.');
    return 2;
  }
  console.log(`\n  REPLY EVAL  (${replies.length} emails, model calls)\n`);
  console.log('  TODO (M3): wire ClaudeExtractor against each fixture and diff');
  console.log('  every field in `expected`. Report per-field accuracy and a');
  console.log('  confusion matrix on `strength`. Hard gate: no fixture whose');
  console.log('  expected strength is negative or none may be scored strong.\n');
  return 0;
}

async function main(): Promise<void> {
  const code = process.argv.includes('--replies')
    ? await runReplyEval()
    : await runCaseEval();
  process.exit(code);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
