import { z } from 'zod';

/**
 * zod v4 ships JSON Schema conversion. Kept behind this shim so the tool
 * definition does not depend on which zod minor is installed.
 */
export default function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: 'draft-7', io: 'input' }) as Record<
    string,
    unknown
  >;
  // Anthropic tool input_schema must be an object schema.
  return { ...json, type: 'object' };
}
