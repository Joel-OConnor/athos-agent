import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { EXTRACTION_SYSTEM_PROMPT } from '../prompt';
import { extractionJsonSchema } from '../tool';
import type { Telemetry } from '../types';
import { BaseExtractor, type Attempt } from './base';

const run = promisify(execFile);

/**
 * Local development and end-to-end testing. Shells out to the Claude Code CLI,
 * which runs on whatever subscription or auth that CLI already has, so nobody
 * has to put a personal Anthropic API key in a .env file to exercise the agent.
 *
 * The call is locked down on purpose:
 *   --tools ""               no file access, no bash, no web - it reads an email
 *   --json-schema            the contract itself, so output is validated twice
 *   --strict-mcp-config      no MCP servers from the developer's own setup
 *   --disable-slash-commands no skills
 *   --no-session-persistence nothing written to the session store
 *   cwd = an empty temp dir  no CLAUDE.md from this or any other project
 *
 * That last one matters more than it looks: run from the project root, the CLI
 * would pull in this repo's CLAUDE.md and the extraction would quietly depend
 * on whatever is in it.
 */
export class ClaudeCodeExtractor extends BaseExtractor {
  readonly name = 'claude-code';
  // CLI startup dominates, and these are real subprocesses. Keep it modest.
  readonly concurrency = Number(process.env.EXTRACT_CONCURRENCY ?? 4);

  private readonly bin = process.env.CLAUDE_CODE_BIN ?? 'claude';
  private readonly model = process.env.EXTRACT_MODEL_LOCAL ?? 'sonnet';
  private readonly timeoutMs = Number(process.env.EXTRACT_TIMEOUT_MS ?? 120_000);
  private readonly sandbox: string;

  constructor(telemetry?: Telemetry) {
    super(telemetry);
    this.sandbox = mkdtempSync(join(tmpdir(), 'needs-review-extract-'));
  }

  protected async callModel(userMessage: string): Promise<Attempt> {
    const args = [
      '-p',
      userMessage,
      '--system-prompt',
      EXTRACTION_SYSTEM_PROMPT,
      '--json-schema',
      JSON.stringify(extractionJsonSchema()),
      '--output-format',
      'json',
      '--tools',
      '',
      '--model',
      this.model,
      '--no-session-persistence',
      '--strict-mcp-config',
      '--disable-slash-commands',
    ];

    const budget = process.env.EXTRACT_MAX_BUDGET_USD;
    if (budget) args.push('--max-budget-usd', budget);

    let stdout: string;
    try {
      ({ stdout } = await run(this.bin, args, {
        cwd: this.sandbox,
        timeout: this.timeoutMs,
        maxBuffer: 8 * 1024 * 1024,
      }));
    } catch (err) {
      const e = err as { code?: string; stderr?: string; message?: string };
      if (e.code === 'ENOENT') {
        throw new Error(
          `Claude Code CLI not found (tried "${this.bin}"). Install it, or set CLAUDE_CODE_BIN, or use EXTRACT_PROVIDER=anthropic.`
        );
      }
      throw new Error(
        `Claude Code CLI failed: ${e.stderr?.slice(0, 500) ?? e.message ?? 'unknown error'}`
      );
    }

    const envelope = JSON.parse(stdout) as {
      is_error?: boolean;
      subtype?: string;
      result?: string;
      structured_output?: unknown;
      total_cost_usd?: number;
      usage?: { input_tokens?: number; output_tokens?: number };
      modelUsage?: Record<string, unknown>;
    };

    if (envelope.is_error) {
      throw new Error(
        `Claude Code returned an error (${envelope.subtype ?? 'unknown'}): ${String(envelope.result ?? '').slice(0, 300)}`
      );
    }

    return {
      raw: envelope.structured_output ?? null,
      costUsd: envelope.total_cost_usd ?? null,
      inputTokens: envelope.usage?.input_tokens ?? null,
      outputTokens: envelope.usage?.output_tokens ?? null,
      model: Object.keys(envelope.modelUsage ?? {})[0] ?? this.model,
    };
  }
}
