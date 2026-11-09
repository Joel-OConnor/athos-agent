import {
  BaseExtractor,
  CallLog,
  buildExtractionUserMessage,
  extractionJsonSchema,
  gradeExtraction,
  type ExtractionOutput,
} from '../src/extract';
import { lastTemplateSentTo, type Attempt } from '../src/extract/providers/base';
import { BLANK_OUTPUT, loadCase } from './helpers';

/** A provider that returns whatever the test scripted, in order. */
class ScriptedExtractor extends BaseExtractor {
  readonly name = 'scripted';
  readonly concurrency = 1;
  calls = 0;
  constructor(
    private readonly script: (Attempt | Error)[],
    telemetry?: CallLog
  ) {
    super(telemetry);
  }
  protected callModel(): Promise<Attempt> {
    const next = this.script[this.calls++];
    if (next === undefined) return Promise.reject(new Error('script exhausted'));
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  }
}

const ok = (raw: unknown): Attempt => ({
  raw,
  costUsd: 0.01,
  inputTokens: 100,
  outputTokens: 20,
  model: 'test-model',
});

const CONTEXT = {
  party: 'rental_house' as const,
  rentalHouseName: 'Keslow Example Rentals',
  clientName: 'Whitfield Pictures LLC',
  subject: 'Re: verification',
  body: 'Yes, we have worked with them.',
  respondingTo: 'exhibit1_rental_house_vetting' as const,
};

describe('gradeExtraction', () => {
  it('grades the facts and keeps the email identity', () => {
    const graded = gradeExtraction(
      { ...BLANK_OUTPUT, workedWithClientBefore: 'yes' },
      { id: 'in-1', rentalHouseId: 'rh-1', party: 'rental_house' }
    );
    expect(graded.correspondenceId).toBe('in-1');
    expect(graded.strength).toBe('strong');
    expect(graded.strengthRuleId).toBe('prior-rental-history');
  });

  it('never lets an applicant vouch for themselves', () => {
    const graded = gradeExtraction(
      { ...BLANK_OUTPUT, workedWithClientBefore: 'yes' },
      { id: 'in-2', rentalHouseId: null, party: 'applicant' }
    );
    expect(graded.strength).toBe('none');
  });
});

describe('BaseExtractor', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('returns validated facts and logs one successful call', async () => {
    const log = new CallLog();
    const x = new ScriptedExtractor([ok(BLANK_OUTPUT)], log);
    const facts = await x.extractFacts(CONTEXT);
    expect(facts.workedWithClientBefore).toBe('unstated');
    expect(log.calls).toHaveLength(1);
    expect(log.calls[0]).toMatchObject({ provider: 'scripted', attempt: 0, ok: true });
  });

  it('retries once on a malformed response and logs both attempts', async () => {
    const log = new CallLog();
    const x = new ScriptedExtractor([ok({ nonsense: true }), ok(BLANK_OUTPUT)], log);
    await expect(x.extractFacts(CONTEXT)).resolves.toBeDefined();
    expect(log.calls.map((c) => c.ok)).toEqual([false, true]);
  });

  it('retries once on a thrown error, then gives up with the last issue', async () => {
    const x = new ScriptedExtractor([new Error('boom'), new Error('boom again')]);
    await expect(x.extractFacts(CONTEXT)).rejects.toThrow(/boom again/);
    expect(x.calls).toBe(2);
  });

  it('does not retry when STRICT_EXTRACTION=1', async () => {
    process.env.STRICT_EXTRACTION = '1';
    const x = new ScriptedExtractor([ok({ nonsense: true }), ok(BLANK_OUTPUT)]);
    await expect(x.extractFacts(CONTEXT)).rejects.toThrow(/extraction failed/);
    expect(x.calls).toBe(1);
  });

  it('reads a case email with the template it was replying to', async () => {
    const packet = loadCase('007-strong-rental-house-reply.json');
    const email = packet.correspondence.find((c) => c.id === 'in-1')!;
    const x = new ScriptedExtractor([
      ok({ ...BLANK_OUTPUT, workedWithClientBefore: 'yes' }),
    ]);
    const graded = await x.extract(packet, email);
    expect(graded.strength).toBe('strong');
    expect(graded.rentalHouseId).toBe('rh-1');
  });
});

describe('lastTemplateSentTo', () => {
  it('finds the Exhibit 1 sent to that rental house', () => {
    const packet = loadCase('007-strong-rental-house-reply.json');
    const email = packet.correspondence.find((c) => c.id === 'in-1')!;
    expect(lastTemplateSentTo(packet, email)).toBe('exhibit1_rental_house_vetting');
  });

  it('finds the latest applicant template, not a rental-house one', () => {
    const packet = loadCase('010-applicant-references.json');
    const email = packet.correspondence.find((c) => c.id === 'in-2')!;
    expect(lastTemplateSentTo(packet, email)).toBe('exhibit2_applicant_references');
  });

  it('is null when nothing was sent first', () => {
    const packet = loadCase('007-strong-rental-house-reply.json');
    const email = { ...packet.correspondence[2]!, sentAt: '2026-10-01T00:00:00Z' };
    expect(lastTemplateSentTo(packet, email)).toBeNull();
  });
});

describe('prompt', () => {
  it('includes the questions asked when the template is known', () => {
    expect(buildExtractionUserMessage(CONTEXT)).toContain(
      'Have you worked with this client'
    );
  });

  it('warns the model when the template is unknown', () => {
    expect(buildExtractionUserMessage({ ...CONTEXT, respondingTo: null })).toContain(
      'do not assume'
    );
  });

  it('describes the applicant as the sender when they are', () => {
    expect(
      buildExtractionUserMessage({
        ...CONTEXT,
        party: 'applicant',
        rentalHouseName: null,
      })
    ).toContain('the applicant');
  });
});

describe('CallLog', () => {
  it('totals cost only over calls that reported one', () => {
    const log = new CallLog();
    expect(log.totalCostUsd).toBeNull();
    log.record({
      ...ok(null),
      ms: 10,
      provider: 'p',
      attempt: 0,
      ok: true,
      costUsd: 0.5,
    });
    log.record({
      ...ok(null),
      ms: 5,
      provider: 'p',
      attempt: 0,
      ok: true,
      costUsd: null,
    });
    expect(log.totalCostUsd).toBe(0.5);
    expect(log.totalMs).toBe(15);
  });

  it('prints a line per call when EXTRACT_LOG=1', () => {
    const env = process.env.EXTRACT_LOG;
    process.env.EXTRACT_LOG = '1';
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    new CallLog().record({ ...ok(null), ms: 1, provider: 'p', attempt: 0, ok: false });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('FAILED'));
    spy.mockRestore();
    process.env.EXTRACT_LOG = env;
  });
});

describe('tool schema', () => {
  it('is an object schema with the model-facing fields and no grading fields', () => {
    const schema = extractionJsonSchema() as {
      type: string;
      properties: Record<string, unknown>;
    };
    expect(schema.type).toBe('object');
    expect(Object.keys(schema.properties)).toContain('workedWithClientBefore');
    expect(Object.keys(schema.properties)).not.toContain('strength');
  });

  it('matches the ExtractionOutput type', () => {
    const facts: ExtractionOutput = BLANK_OUTPUT;
    expect(facts.referencesGiven).toEqual([]);
  });
});
