import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCase } from '../src/agent';
import { FixtureExtractor } from '../src/extract/extract';
import type { ExtractedReply } from '../src/contract';
import { loadCase } from './helpers';

function extractorFor(caseId: string): FixtureExtractor {
  const rows = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'extractions', `${caseId}.json`), 'utf8')
  ) as ExtractedReply[];
  return new FixtureExtractor(new Map(rows.map((r) => [r.correspondenceId, r])));
}

describe('decide', () => {
  it('approves on one strong verification without waiting for the rest', async () => {
    const result = await runCase(loadCase('007-strong-rental-house-reply.json'), {
      extractor: extractorFor('CASE-007'),
    });
    expect(result.recommendation).toBe('approve');
    expect(result.stage).toBe('verified');
    // Tallied from what came back, not the $140K requested.
    expect(result.verifiedEquipmentTotal).toBe(94_500);
  });

  it('scores a reply that instructs the agent as negative and never approves', async () => {
    const result = await runCase(loadCase('008-prompt-injection-reply.json'), {
      extractor: extractorFor('CASE-008'),
    });
    expect(result.recommendation).not.toBe('approve');
    expect(result.extracted[0]!.strength).toBe('negative');
    expect(result.verifiedEquipmentTotal).toBe(0);
    expect(result.warnings.join(' ')).toMatch(/aimed at the agent/);
  });

  it('waits, with a follow-up time, while emails are out and nothing is back', async () => {
    const packet = loadCase('007-strong-rental-house-reply.json');
    packet.correspondence = packet.correspondence.filter((c) => c.direction === 'outbound');
    packet.now = '2026-11-02T17:00:00Z';
    const result = await runCase(packet);
    expect(result.recommendation).toBe('wait');
    expect(result.stage).toBe('awaiting_rental_houses');
    expect(result.followUpAt).not.toBeNull();
  });

  it('asks the applicant for references once the rental houses have gone quiet', async () => {
    const packet = loadCase('007-strong-rental-house-reply.json');
    packet.correspondence = packet.correspondence.filter((c) => c.direction === 'outbound');
    packet.now = '2026-11-08T17:00:00Z';
    const result = await runCase(packet);
    expect(result.recommendation).toBe('send_emails');
    expect(result.outbound.map((o) => o.template)).toEqual([
      'exhibit2_applicant_references',
    ]);
  });

  it('never returns a result without at least one cited reason', async () => {
    for (const f of [
      '001-clean-100k-seon-approve.json',
      '005-seon-confirmed-fraud.json',
      '006-underwriting-gates.json',
    ]) {
      const result = await runCase(loadCase(f));
      expect(result.reasons.length).toBeGreaterThan(0);
    }
  });
});
