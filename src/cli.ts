#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { runCase } from './agent';

/**
 * Run one case file:
 *   npm run case -- fixtures/cases/001-clean-100k.json
 *
 * Add --no-ai to skip the model call entirely (triage-only paths).
 */
async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: npm run case -- <path-to-case.json>');
    process.exit(2);
  }
  const packet = JSON.parse(readFileSync(file, 'utf8'));
  const result = await runCase(packet);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
