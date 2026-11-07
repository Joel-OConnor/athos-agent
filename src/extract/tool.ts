import { z } from 'zod';
import { ExtractedReply } from '../contract';
import zodToJsonSchema from './zodToJsonSchema';

/** The model fills this and nothing else. Validated with zod on the way back. */
export const ExtractionOutput = ExtractedReply.omit({
  correspondenceId: true,
  rentalHouseId: true,
});
export type ExtractionOutput = z.infer<typeof ExtractionOutput>;

export const RECORD_REPLY_TOOL = {
  name: 'record_reply',
  description: 'Record what the email says. Call exactly once.',
  input_schema: zodToJsonSchema(ExtractionOutput),
} as const;
