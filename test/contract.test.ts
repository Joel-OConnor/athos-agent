import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AgentResult, CasePacket, SCHEMA_VERSION } from '../src/contract';

const CASES = join(__dirname, '..', 'fixtures', 'cases');

describe('contract', () => {
  const files = readdirSync(CASES).filter((f) => f.endsWith('.json'));

  it('has at least one case fixture', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s parses as a CasePacket at the current schema version', (f) => {
    const raw = JSON.parse(readFileSync(join(CASES, f), 'utf8'));
    const parsed = CasePacket.parse(raw);
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('rejects a result with no reasons', () => {
    const bad = {
      schemaVersion: SCHEMA_VERSION,
      caseId: 'X',
      stage: 'triage',
      recommendation: 'wait',
      reasons: [],
      outbound: [],
      extracted: [],
      verifiedEquipmentTotal: 0,
      researchPacket: null,
      followUpAt: null,
      warnings: [],
    };
    expect(AgentResult.safeParse(bad).success).toBe(false);
  });
});
