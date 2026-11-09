import { z } from 'zod';
import { ExtractedReply } from '../contract';

/**
 * The model fills facts only. `strength` and `strengthRuleId` are left out on
 * purpose: they come from the verification rules registry, not from the model.
 */
export const ExtractionOutput = ExtractedReply.omit({
  correspondenceId: true,
  rentalHouseId: true,
  strength: true,
  strengthRuleId: true,
});
export type ExtractionOutput = z.infer<typeof ExtractionOutput>;

/**
 * The contract as JSON Schema, for providers that validate structurally.
 * Anthropic's tool input_schema must be an object schema; zod's emitter agrees
 * but we pin it rather than rely on it.
 */
export function extractionJsonSchema(): Record<string, unknown> {
  const json = z.toJSONSchema(ExtractionOutput, { target: 'draft-7', io: 'input' });
  return { ...(json as Record<string, unknown>), type: 'object' };
}

export const RECORD_REPLY_TOOL = {
  name: 'record_reply',
  description: 'Record what the email says. Call exactly once.',
  input_schema: extractionJsonSchema(),
} as const;
