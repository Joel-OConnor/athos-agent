import {
  ClaudeCodeExtractor,
  type ProcessRunner,
} from '../src/extract/providers/claudeCode';
import { CallLog } from '../src/extract';
import { BLANK_OUTPUT } from './helpers';

const CONTEXT = {
  party: 'rental_house' as const,
  rentalHouseName: 'X',
  clientName: 'Y',
  subject: 's',
  body: 'b',
  respondingTo: null,
};

function envelope(extra: Record<string, unknown>): string {
  return JSON.stringify({
    type: 'result',
    is_error: false,
    total_cost_usd: 0.02,
    usage: { input_tokens: 10, output_tokens: 5 },
    modelUsage: { 'claude-sonnet-x': {} },
    ...extra,
  });
}

describe('ClaudeCodeExtractor', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.STRICT_EXTRACTION = '1';
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('locks the CLI down and asks for the contract as JSON schema', async () => {
    const runner = jest.fn<ReturnType<ProcessRunner>, Parameters<ProcessRunner>>(() =>
      Promise.resolve({ stdout: envelope({ structured_output: BLANK_OUTPUT }) })
    );
    const x = new ClaudeCodeExtractor(new CallLog(), runner);
    await x.extractFacts(CONTEXT);

    const [bin, args, opts] = runner.mock.calls[0]!;
    expect(bin).toBe('claude');
    expect(args).toEqual(
      expect.arrayContaining(['-p', '--tools', '', '--output-format', 'json'])
    );
    expect(args).toContain('--json-schema');
    expect(args).toContain('--strict-mcp-config');
    expect(args).toContain('--no-session-persistence');
    // Never the project directory: that would pull in this repo's CLAUDE.md.
    expect(opts.cwd).not.toBe(process.cwd());
  });

  it('reports the CLI model and cost in telemetry', async () => {
    const log = new CallLog();
    const x = new ClaudeCodeExtractor(log, () =>
      Promise.resolve({ stdout: envelope({ structured_output: BLANK_OUTPUT }) })
    );
    await x.extractFacts(CONTEXT);
    expect(log.calls[0]).toMatchObject({
      provider: 'claude-code',
      model: 'claude-sonnet-x',
      costUsd: 0.02,
      ok: true,
    });
  });

  it('passes a budget cap through when one is set', async () => {
    process.env.EXTRACT_MAX_BUDGET_USD = '1.50';
    const runner = jest.fn<ReturnType<ProcessRunner>, Parameters<ProcessRunner>>(() =>
      Promise.resolve({ stdout: envelope({ structured_output: BLANK_OUTPUT }) })
    );
    await new ClaudeCodeExtractor(new CallLog(), runner).extractFacts(CONTEXT);
    expect(runner.mock.calls[0]![1]).toEqual(
      expect.arrayContaining(['--max-budget-usd', '1.50'])
    );
  });

  it('says how to proceed when the CLI is not installed', async () => {
    const x = new ClaudeCodeExtractor(new CallLog(), () =>
      Promise.reject(Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' }))
    );
    await expect(x.extractFacts(CONTEXT)).rejects.toThrow(/EXTRACT_PROVIDER=anthropic/);
  });

  it('surfaces stderr when the CLI fails', async () => {
    const x = new ClaudeCodeExtractor(new CallLog(), () =>
      Promise.reject(Object.assign(new Error('exit 1'), { stderr: 'rate limited' }))
    );
    await expect(x.extractFacts(CONTEXT)).rejects.toThrow(/rate limited/);
  });

  it('treats an is_error envelope as a failure', async () => {
    const x = new ClaudeCodeExtractor(new CallLog(), () =>
      Promise.resolve({
        stdout: envelope({
          is_error: true,
          subtype: 'error_max_turns',
          result: 'too long',
        }),
      })
    );
    await expect(x.extractFacts(CONTEXT)).rejects.toThrow(/error_max_turns/);
  });

  it('fails validation when structured_output is missing', async () => {
    const x = new ClaudeCodeExtractor(new CallLog(), () =>
      Promise.resolve({ stdout: envelope({ result: 'some prose instead' }) })
    );
    await expect(x.extractFacts(CONTEXT)).rejects.toThrow(/extraction failed/);
  });
});

describe('ClaudeCodeExtractor: blank values from a copied .env.example', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('falls back to the default binary, model and timeout', async () => {
    process.env.CLAUDE_CODE_BIN = '';
    process.env.EXTRACT_MODEL_LOCAL = '';
    process.env.EXTRACT_TIMEOUT_MS = '';
    process.env.STRICT_EXTRACTION = '1';
    const runner = jest.fn<ReturnType<ProcessRunner>, Parameters<ProcessRunner>>(() =>
      Promise.resolve({ stdout: envelope({ structured_output: BLANK_OUTPUT }) })
    );
    await new ClaudeCodeExtractor(new CallLog(), runner).extractFacts(CONTEXT);
    const [bin, args, opts] = runner.mock.calls[0]!;
    expect(bin).toBe('claude');
    expect(args).toEqual(expect.arrayContaining(['--model', 'sonnet']));
    expect(opts.timeout).toBe(120_000);
  });
});
