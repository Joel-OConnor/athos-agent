import type Anthropic from '@anthropic-ai/sdk';
import { AnthropicExtractor, CallLog } from '../src/extract';
import { BLANK_OUTPUT } from './helpers';

const CONTEXT = {
  party: 'rental_house' as const,
  rentalHouseName: 'X',
  clientName: 'Y',
  subject: 's',
  body: 'b',
  respondingTo: null,
};

interface Request {
  tool_choice: { type: string; name: string };
  tools: unknown[];
  system: { cache_control?: unknown }[];
}
type Create = jest.Mock<Promise<{ content: unknown[]; usage: object }>, [Request]>;

function fakeClient(content: unknown[]): { client: Anthropic; create: Create } {
  const create: Create = jest.fn((_req: Request) =>
    Promise.resolve({ content, usage: { input_tokens: 40, output_tokens: 12 } })
  );
  return { client: { messages: { create } } as unknown as Anthropic, create };
}

describe('AnthropicExtractor', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.STRICT_EXTRACTION = '1';
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('forces the record_reply tool and reads its input', async () => {
    const { client, create } = fakeClient([{ type: 'tool_use', input: BLANK_OUTPUT }]);
    const log = new CallLog();
    const facts = await new AnthropicExtractor(log, client).extractFacts(CONTEXT);
    expect(facts.isAutoReply).toBe(false);

    const req = create.mock.calls[0]![0] as {
      tool_choice: { name: string };
      tools: unknown[];
    };
    expect(req.tool_choice).toEqual({ type: 'tool', name: 'record_reply' });
    expect(req.tools).toHaveLength(1);
    expect(log.calls[0]).toMatchObject({
      provider: 'anthropic',
      inputTokens: 40,
      costUsd: null,
    });
  });

  it('fails validation when the model answered in prose', async () => {
    const { client } = fakeClient([{ type: 'text', text: 'Sure, they look fine.' }]);
    await expect(
      new AnthropicExtractor(new CallLog(), client).extractFacts(CONTEXT)
    ).rejects.toThrow(/extraction failed/);
  });

  it('caches the system prompt', async () => {
    const { client, create } = fakeClient([{ type: 'tool_use', input: BLANK_OUTPUT }]);
    await new AnthropicExtractor(new CallLog(), client).extractFacts(CONTEXT);
    const req = create.mock.calls[0]![0];
    expect(req.system[0]!.cache_control).toEqual({ type: 'ephemeral' });
  });
});
