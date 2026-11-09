import Anthropic from '@anthropic-ai/sdk';
import { EXTRACTION_SYSTEM_PROMPT } from '../prompt';
import { RECORD_REPLY_TOOL } from '../tool';
import type { Telemetry } from '../types';
import { BaseExtractor, type Attempt } from './base';

/**
 * Production. Calls the Anthropic API directly with an API key.
 *
 * Forces the record_reply tool, so the model has no way to answer in prose.
 * The system prompt is cached: every call shares all of it but the email.
 */
export class AnthropicExtractor extends BaseExtractor {
  readonly name = 'anthropic';
  readonly concurrency = Number(process.env.EXTRACT_CONCURRENCY ?? 6);
  private readonly model = process.env.EXTRACT_MODEL ?? 'claude-sonnet-5-5';
  private client: Anthropic | null = null;

  constructor(
    telemetry?: Telemetry,
    private readonly injected?: Anthropic
  ) {
    super(telemetry);
  }

  private get anthropic(): Anthropic {
    if (this.injected) return this.injected;
    if (!this.client) {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error(
          'ANTHROPIC_API_KEY is not set. Use EXTRACT_PROVIDER=claude-code to run without one.'
        );
      }
      this.client = new Anthropic();
    }
    return this.client;
  }

  protected async callModel(userMessage: string): Promise<Attempt> {
    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 1500,
      system: [
        {
          type: 'text',
          text: EXTRACTION_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [RECORD_REPLY_TOOL as never],
      tool_choice: { type: 'tool', name: RECORD_REPLY_TOOL.name },
      messages: [{ role: 'user', content: userMessage }],
    });

    const block = response.content.find((c) => c.type === 'tool_use');
    return {
      raw: block ? (block as { input: unknown }).input : null,
      // The API returns tokens, not dollars. Cost belongs to whoever owns the key.
      costUsd: null,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: this.model,
    };
  }
}
