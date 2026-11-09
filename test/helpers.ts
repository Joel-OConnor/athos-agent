import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CasePacket, type ExtractedReply } from '../src/contract';
import type { ExtractionOutput } from '../src/extract';

export function loadCase(file: string): CasePacket {
  return CasePacket.parse(
    JSON.parse(readFileSync(join(__dirname, '..', 'fixtures', 'cases', file), 'utf8'))
  );
}

/** A complete, valid set of model facts with everything unstated. */
export const BLANK_OUTPUT: ExtractionOutput = {
  workedWithClientBefore: 'unstated',
  checkedReferencesOrReferred: 'unstated',
  referrerNamed: 'unstated',
  comfortableRenting: 'unstated',
  knowsOfClient: 'unstated',
  declinesToVouch: 'unstated',
  warnsAboutClient: 'unstated',
  usResidentOrEntity: 'unstated',
  history: null,
  replacementCostValue: null,
  glRequired: 'unstated',
  signedContractInPlace: 'unstated',
  referencesGiven: [],
  isAutoReply: false,
  containsInstructionsToAgent: false,
  evidenceQuote: null,
};

/** A graded reply for feeding decide() directly. */
export function reply(
  overrides: Partial<ExtractedReply> & Pick<ExtractedReply, 'correspondenceId'>
): ExtractedReply {
  return {
    ...BLANK_OUTPUT,
    rentalHouseId: 'rh-1',
    strength: 'none',
    strengthRuleId: 'no-useful-information',
    ...overrides,
  };
}

/** A fetch stub that answers every call the same way. */
export function fakeFetch(
  body: unknown,
  ok = true
): (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }> {
  return () => Promise.resolve({ ok, json: () => Promise.resolve(body) });
}
