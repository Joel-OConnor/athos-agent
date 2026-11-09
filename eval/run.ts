import { runCase } from '../src/agent';
import { FixtureExtractor } from '../src/extract/extract';
import type { ExtractedReply } from '../src/contract';
import { loadCases, type CaseFixture } from './loadFixtures';
import { runReplyEval } from './replies';
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
  let needsFurtherReview: boolean | null = null;
  let actorRole = '';

  try {
    const result = await runCase(fx.packet, { extractor });
    actual = result.recommendation;
    stage = result.stage;
    templates = result.outbound.map((o) => o.template);
    total = result.verifiedEquipmentTotal;
    warnings = result.warnings;
    needsFurtherReview = result.needsFurtherReview;
    actorRole = result.actorRole;
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
  if (e.needsFurtherReview !== undefined && e.needsFurtherReview !== needsFurtherReview) {
    pass = false;
    detail.push(`needsFurtherReview expected ${e.needsFurtherReview}, got ${needsFurtherReview}`);
  }
  if (e.actorRole && e.actorRole !== actorRole) {
    pass = false;
    detail.push(`actorRole expected ${e.actorRole}, got ${actorRole}`);
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

async function main(): Promise<void> {
  const replies = process.argv.includes('--replies');
  const filterFlag = process.argv.indexOf('--only');
  const filter = filterFlag >= 0 ? process.argv[filterFlag + 1] : undefined;
  const code = replies ? await runReplyEval(filter) : await runCaseEval();
  process.exit(code);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
