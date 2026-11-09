import {
  AnthropicExtractor,
  ClaudeCodeExtractor,
  FixtureExtractor,
  createExtractor,
  resolveProvider,
} from '../src/extract';
import type { ExtractedReply } from '../src/contract';

describe('extraction providers', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('takes the API when a key is present and the CLI otherwise', () => {
    delete process.env.EXTRACT_PROVIDER;
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    expect(resolveProvider()).toBe('anthropic');

    delete process.env.ANTHROPIC_API_KEY;
    expect(resolveProvider()).toBe('claude-code');
  });

  it('lets EXTRACT_PROVIDER override either way', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    process.env.EXTRACT_PROVIDER = 'claude-code';
    expect(resolveProvider()).toBe('claude-code');
    expect(createExtractor()).toBeInstanceOf(ClaudeCodeExtractor);
  });

  it('rejects a provider name that does not exist', () => {
    process.env.EXTRACT_PROVIDER = 'openai';
    expect(() => resolveProvider()).toThrow(/not one of/);
  });

  it('does not need a key until the API provider actually calls', () => {
    delete process.env.ANTHROPIC_API_KEY;
    // Constructing must not throw: the eval builds an extractor before it
    // knows whether it will use one.
    const extractor = new AnthropicExtractor();
    expect(extractor.name).toBe('anthropic');
  });

  it('tells you how to run without a key when the API provider has none', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.STRICT_EXTRACTION = '1';
    await expect(
      new AnthropicExtractor().extractFacts({
        party: 'rental_house',
        rentalHouseName: 'X',
        clientName: 'Y',
        subject: 's',
        body: 'b',
        respondingTo: null,
      })
    ).rejects.toThrow(/EXTRACT_PROVIDER=claude-code/);
  });

  it('gives every provider a name and a sane concurrency', () => {
    const rows: { name: string; concurrency: number }[] = [
      new AnthropicExtractor(),
      new ClaudeCodeExtractor(),
      new FixtureExtractor(new Map()),
    ];
    for (const r of rows) {
      expect(r.name).not.toBe('');
      expect(r.concurrency).toBeGreaterThan(0);
    }
  });

  it('says what is missing when a fixture extraction is not labelled', async () => {
    const extractor = new FixtureExtractor(new Map<string, ExtractedReply>());
    await expect(
      extractor.extract(
        {} as never,
        {
          id: 'in-9',
          rentalHouseId: null,
          party: 'applicant',
        } as never
      )
    ).rejects.toThrow(/fixtures\/extractions/);
  });

  it('refuses to let the fixture provider read an arbitrary email', async () => {
    await expect(
      new FixtureExtractor(new Map()).extractFacts({
        party: 'rental_house',
        rentalHouseName: null,
        clientName: 'Y',
        subject: 's',
        body: 'b',
        respondingTo: null,
      })
    ).rejects.toThrow(/cannot read an arbitrary email/);
  });

  it('needs labelled extractions to build the fixture provider', () => {
    expect(() => createExtractor({ provider: 'fixture' })).toThrow(/needs/);
  });
});

describe('createExtractor: the factory', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('builds the API provider when asked', () => {
    expect(createExtractor({ provider: 'anthropic' })).toBeInstanceOf(AnthropicExtractor);
  });

  it('builds the fixture provider with labelled extractions', () => {
    expect(
      createExtractor({ provider: 'fixture', extractions: new Map() })
    ).toBeInstanceOf(FixtureExtractor);
  });
});
