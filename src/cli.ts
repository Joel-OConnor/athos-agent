#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { runCase } from './agent';
import { loadDotEnv } from './env';

/**
 * Run one case file:
 *   npm run case -- fixtures/cases/001-clean-100k-seon-approve.json
 *
 * Settings come from the environment, and from .env when there is one.
 */
async function main(): Promise<void> {
  loadDotEnv();
  const file = process.argv[2];
  if (!file) {
    console.error('usage: npm run case -- <path-to-case.json>');
    process.exit(2);
  }
  const packet: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const result = await runCase(packet);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
