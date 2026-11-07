import { writeFileSync, mkdirSync } from 'node:fs';
import { z } from 'zod';
import { AgentResult, CasePacket } from '../src/contract';

/**
 * Emits JSON Schema for both halves of the contract, so the .NET adapter can
 * generate types from the same source of truth the agent validates against.
 */
mkdirSync('schema', { recursive: true });
for (const [name, schema] of [
  ['case-packet', CasePacket],
  ['agent-result', AgentResult],
] as const) {
  const json = z.toJSONSchema(schema as z.ZodType, { target: 'draft-7' });
  writeFileSync(`schema/${name}.schema.json`, JSON.stringify(json, null, 2) + '\n');
  console.log(`wrote schema/${name}.schema.json`);
}
