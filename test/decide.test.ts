import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCase } from '../src/agent';
import { FixtureExtractor } from '../src/extract';
import type { ExtractedReply } from '../src/contract';
import { fakeFetch, loadCase, reply } from './helpers';

function extractions(caseId: string): ExtractedReply[] {
  return JSON.parse(
    readFileSync(
      join(__dirname, '..', 'fixtures', 'extractions', `${caseId}.json`),
      'utf8'
    )
  ) as ExtractedReply[];
}

function extractorFor(caseId: string): FixtureExtractor {
  return new FixtureExtractor(
    new Map(extractions(caseId).map((r) => [r.correspondenceId, r]))
  );
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
    packet.correspondence = packet.correspondence.filter(
      (c) => c.direction === 'outbound'
    );
    packet.now = '2026-11-02T17:00:00Z';
    const result = await runCase(packet);
    expect(result.recommendation).toBe('wait');
    expect(result.stage).toBe('awaiting_rental_houses');
    expect(result.followUpAt).not.toBeNull();
  });

  it('asks the applicant for references once the rental houses have gone quiet', async () => {
    const packet = loadCase('007-strong-rental-house-reply.json');
    packet.correspondence = packet.correspondence.filter(
      (c) => c.direction === 'outbound'
    );
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

describe('decide: the branches the fixtures do not reach', () => {
  const base = loadCase('010-applicant-references.json');

  function run(extracted: ExtractedReply[], packetPatch: Partial<typeof base> = {}) {
    const packet = { ...base, ...packetPatch };
    return runCase(packet, {
      extractor: new FixtureExtractor(
        new Map(extracted.map((e) => [e.correspondenceId, e]))
      ),
      fetchImpl: fakeFetch({ events: [] }),
    });
  }

  it('recommends decline, flagged, when the applicant says they are not US (Q7)', async () => {
    const result = await run([
      reply({
        correspondenceId: 'in-1',
        strength: 'negative',
        strengthRuleId: 'never-worked-with-client',
      }),
      reply({ correspondenceId: 'in-2', rentalHouseId: null, usResidentOrEntity: 'no' }),
    ]);
    expect(result.recommendation).toBe('recommend_decline');
    expect(result.needsFurtherReview).toBe(true);
    expect(result.furtherReviewReasons.join(' ')).toMatch(/Q7/);
    expect(result.actorRole).toBe('underwriter');
  });

  it('escalates when the applicant names references nobody can email (Q14)', async () => {
    const result = await run([
      reply({
        correspondenceId: 'in-1',
        strength: 'negative',
        strengthRuleId: 'never-worked-with-client',
      }),
      reply({
        correspondenceId: 'in-2',
        rentalHouseId: null,
        strength: 'weak',
        strengthRuleId: 'applicant-gave-references',
        referencesGiven: [
          {
            rentalHouseName: 'Nameless Example',
            contactName: null,
            email: null,
            phone: null,
            equipmentValue: null,
            nameOnAccount: null,
          },
        ],
      }),
    ]);
    expect(result.recommendation).toBe('escalate_to_service');
    expect(result.reasons.map((r) => r.code)).toContain(
      'APPLICANT_REFERENCES_UNREACHABLE'
    );
    expect(result.researchPacket).not.toBeNull();
  });

  it('escalates when the applicant replied to Exhibit 2 with nothing usable', async () => {
    const result = await run([
      reply({
        correspondenceId: 'in-1',
        strength: 'negative',
        strengthRuleId: 'never-worked-with-client',
      }),
      reply({ correspondenceId: 'in-2', rentalHouseId: null }),
    ]);
    expect(result.recommendation).toBe('escalate_to_service');
    expect(result.reasons.map((r) => r.code)).toContain('APPLICANT_REFERENCES_UNUSABLE');
  });

  it('ages a silent case out to service@ after the limit', async () => {
    const packet = loadCase('007-strong-rental-house-reply.json');
    packet.correspondence = packet.correspondence.filter(
      (c) => c.direction === 'outbound'
    );
    packet.correspondence.push({
      ...packet.correspondence[0]!,
      id: 'out-3',
      party: 'applicant',
      rentalHouseId: null,
      template: 'exhibit2_applicant_references',
      to: [packet.applicant.email],
      sentAt: '2026-11-05T18:00:00Z',
    });
    packet.now = '2026-11-20T17:00:00Z';
    const result = await runCase(packet, { fetchImpl: fakeFetch({ events: [] }) });
    expect(result.recommendation).toBe('escalate_to_service');
    expect(result.reasons.map((r) => r.code)).toContain('CASE_AGED_OUT');
  });

  it('keeps waiting on the applicant once Exhibit 2 is out and nothing is back', async () => {
    const packet = loadCase('007-strong-rental-house-reply.json');
    packet.correspondence = packet.correspondence.filter(
      (c) => c.direction === 'outbound'
    );
    packet.correspondence.push({
      ...packet.correspondence[0]!,
      id: 'out-3',
      party: 'applicant',
      rentalHouseId: null,
      template: 'exhibit2_applicant_references',
      to: [packet.applicant.email],
      sentAt: '2026-11-05T18:00:00Z',
    });
    packet.now = '2026-11-06T17:00:00Z';
    const result = await runCase(packet);
    expect(result.recommendation).toBe('wait');
    expect(result.stage).toBe('awaiting_applicant');
  });

  it('flags a looks-fake under-$100K case for further review (Q4)', async () => {
    const result = await runCase(loadCase('004-under-100k-flagged-looks-fake.json'));
    expect(result.needsFurtherReview).toBe(true);
    expect(result.furtherReviewReasons.join(' ')).toMatch(/Q4/);
  });

  it('surfaces a negative reply as a warning but still approves on a strong one (Q12)', async () => {
    const packet = loadCase('007-strong-rental-house-reply.json');
    packet.correspondence.push({
      ...packet.correspondence[2]!,
      id: 'in-2',
      rentalHouseId: 'rh-2',
      from: 'sam.ortega@example.test',
      body: 'Never heard of them.',
    });
    const result = await runCase(packet, {
      extractor: new FixtureExtractor(
        new Map([
          [
            'in-1',
            reply({
              correspondenceId: 'in-1',
              workedWithClientBefore: 'yes',
              replacementCostValue: 94500,
              strength: 'strong',
              strengthRuleId: 'prior-rental-history',
              evidenceQuote: 'four years',
            }),
          ],
          [
            'in-2',
            reply({
              correspondenceId: 'in-2',
              rentalHouseId: 'rh-2',
              workedWithClientBefore: 'no',
              knowsOfClient: 'no',
              strength: 'negative',
              strengthRuleId: 'never-worked-with-client',
              evidenceQuote: 'Never heard of them',
            }),
          ],
        ])
      ),
    });
    expect(result.recommendation).toBe('approve');
    expect(result.warnings.join(' ')).toMatch(/was negative/);
    expect(result.verifiedEquipmentTotal).toBe(94500);
  });

  it("vets the applicant's references with Exhibit 1 and flags the case (Q14)", async () => {
    const rows = extractions('CASE-010');
    const result = await runCase(loadCase('010-applicant-references.json'), {
      extractor: new FixtureExtractor(new Map(rows.map((r) => [r.correspondenceId, r]))),
    });
    expect(result.recommendation).toBe('send_emails');
    expect(result.outbound.map((o) => o.to[0])).toEqual([
      'andre@gulfcoastexample.test',
      'mia@sunshineexample.test',
    ]);
    expect(result.needsFurtherReview).toBe(true);
  });
});
