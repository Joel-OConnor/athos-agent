import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { AgentResult, CasePacket } from '../src/contract';

/**
 * Emits JSON Schema for both halves of the contract so the .NET adapter can
 * generate types from the same source of truth the agent validates against.
 *
 *   npm run schema          write schema/*.schema.json
 *   npm run schema:check    fail if the committed files are stale (CI)
 */
const check = process.argv.includes('--check');
const targets = [
  ['case-packet', CasePacket],
  ['agent-result', AgentResult],
] as const;

mkdirSync('schema', { recursive: true });
let stale = 0;
for (const [name, schema] of targets) {
  const path = `schema/${name}.schema.json`;
  const next =
    JSON.stringify(z.toJSONSchema(schema, { target: 'draft-7' }), null, 2) + '\n';
  if (check) {
    const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
    if (current !== next) {
      console.error(
        `${path} is out of date. Run \`npm run schema\` and commit the result.`
      );
      stale += 1;
    }
  } else {
    writeFileSync(path, next);
    console.log(`wrote ${path}`);
  }
}
if (stale > 0) process.exit(1);
