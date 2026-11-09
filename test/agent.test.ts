import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCase } from '../src/agent';
import { FixtureExtractor } from '../src/extract';
import type { ExtractedReply } from '../src/contract';
import { fakeFetch, loadCase } from './helpers';

function extractions(caseId: string): ExtractedReply[] {
  return JSON.parse(
    readFileSync(
      join(__dirname, '..', 'fixtures', 'extractions', `${caseId}.json`),
      'utf8'
    )
  ) as ExtractedReply[];
}

describe('runCase', () => {
  it('rejects a packet from another schema version', async () => {
    const packet = { ...loadCase('001-clean-100k-seon-approve.json'), schemaVersion: 99 };
    await expect(runCase(packet)).rejects.toThrow(/schemaVersion 99/);
  });

  it('rejects a packet that does not parse', async () => {
    await expect(runCase({ caseId: 'x' })).rejects.toThrow();
  });

  it('does not call the extractor on a path that needs no vetting', async () => {
    const extractor = new FixtureExtractor(new Map());
    const spy = jest.spyOn(extractor, 'extract');
    const packet = loadCase('007-strong-rental-house-reply.json');
    packet.underwritingGates.ofac = true;
    const result = await runCase(packet, { extractor });
    expect(result.recommendation).toBe('route_to_underwriting');
    expect(spy).not.toHaveBeenCalled();
  });

  it('attaches a research packet on escalation and nowhere else', async () => {
    const rows = extractions('CASE-010').map((e) =>
      e.correspondenceId === 'in-2' ? { ...e, referencesGiven: [] } : e
    );
    const extractor = new FixtureExtractor(
      new Map(rows.map((r) => [r.correspondenceId, r]))
    );
    const result = await runCase(loadCase('010-applicant-references.json'), {
      extractor,
      fetchImpl: fakeFetch({ events: [] }),
    });
    expect(result.recommendation).toBe('escalate_to_service');
    expect(result.researchPacket).not.toBeNull();

    const plain = await runCase(loadCase('001-clean-100k-seon-approve.json'));
    expect(plain.researchPacket).toBeNull();
  });
});
