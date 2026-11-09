import type { ExtractedReply } from '../contract';
import { AnthropicExtractor } from './providers/anthropic';
import { ClaudeCodeExtractor } from './providers/claudeCode';
import { FixtureExtractor } from './providers/fixture';
import { CallLog, type Extractor, type Telemetry } from './types';

export type ProviderName = 'anthropic' | 'claude-code' | 'fixture';

export const PROVIDERS: ProviderName[] = ['anthropic', 'claude-code', 'fixture'];

export interface CreateExtractorOptions {
  provider?: ProviderName;
  telemetry?: Telemetry;
  /** Required for the fixture provider. */
  extractions?: Map<string, ExtractedReply>;
}

/**
 * Which backend reads the emails.
 *
 *   anthropic    the API, with a key. Production, and the only one that runs
 *                unattended.
 *   claude-code  the local Claude Code CLI, on whatever auth it already has.
 *                Development and end-to-end testing with no API key.
 *   fixture      replays labelled extractions. Offline, deterministic, free.
 *                What the tests and CI use.
 *
 * EXTRACT_PROVIDER picks one. With nothing set we take the API when a key is
 * present and the CLI otherwise, which is the right default in both places:
 * a developer's machine has the CLI and no key, a deployment has the key.
 */
export function createExtractor(options: CreateExtractorOptions = {}): Extractor {
  const telemetry = options.telemetry ?? new CallLog();
  const provider = options.provider ?? resolveProvider();

  switch (provider) {
    case 'anthropic':
      return new AnthropicExtractor(telemetry);
    case 'claude-code':
      return new ClaudeCodeExtractor(telemetry);
    case 'fixture':
      if (!options.extractions) {
        throw new Error('The fixture provider needs `extractions`.');
      }
      return new FixtureExtractor(options.extractions);
  }
}

export function resolveProvider(): ProviderName {
  const named = process.env.EXTRACT_PROVIDER;
  if (named) {
    if (!(PROVIDERS as string[]).includes(named)) {
      throw new Error(
        `EXTRACT_PROVIDER="${named}" is not one of: ${PROVIDERS.join(', ')}`
      );
    }
    return named as ProviderName;
  }
  return process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'claude-code';
}
