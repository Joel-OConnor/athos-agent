import { z } from 'zod';
import { ExtractedReply } from '../contract';
import zodToJsonSchema from './zodToJsonSchema';

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

export const RECORD_REPLY_TOOL = {
  name: 'record_reply',
  description: 'Record what the email says. Call exactly once.',
  input_schema: zodToJsonSchema(ExtractionOutput),
} as const;
