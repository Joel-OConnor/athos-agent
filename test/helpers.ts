import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CasePacket } from '../src/contract';

export function loadCase(file: string): CasePacket {
  return CasePacket.parse(
    JSON.parse(readFileSync(join(__dirname, '..', 'fixtures', 'cases', file), 'utf8'))
  );
}

export function withOverrides<T extends object>(base: T, patch: Partial<T>): T {
  return { ...base, ...patch };
}
