import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { ExtractedReply } from '../src/contract';

export interface ExpectedCase {
  stage?: string;
  recommendation?: string;
  outboundTemplates?: string[];
  verifiedEquipmentTotal?: number;
  expectedWarningsInclude?: string[];
  needsFurtherReview?: boolean;
  actorRole?: string;
  mustNotApprove?: boolean;
}

export interface CaseFixture {
  file: string;
  packet: Record<string, unknown>;
  expected: ExpectedCase;
  notes: string;
  extractions: ExtractedReply[];
}

const ROOT = join(__dirname, '..', 'fixtures');

export function loadCases(): CaseFixture[] {
  return readdirSync(join(ROOT, 'cases'))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const packet = JSON.parse(readFileSync(join(ROOT, 'cases', f), 'utf8')) as Record<
        string,
        unknown
      >;
      const answerPath = join(ROOT, 'answers', f);
      if (!existsSync(answerPath)) {
        throw new Error(`Case ${f} has no answer key in fixtures/answers/`);
      }
      const answer = JSON.parse(readFileSync(answerPath, 'utf8')) as {
        expected: ExpectedCase;
        notes?: string;
      };
      const extPath = join(ROOT, 'extractions', `${String(packet.caseId)}.json`);
      const extractions = existsSync(extPath)
        ? (JSON.parse(readFileSync(extPath, 'utf8')) as ExtractedReply[])
        : [];
      return {
        file: basename(f),
        packet,
        expected: answer.expected,
        notes: answer.notes ?? '',
        extractions,
      };
    });
}

export { type ReplyFixture, factsOf } from './replyFixture';
import { ReplyFixture } from './replyFixture';

/**
 * Reply fixtures are grouped into one file per category, each holding an array.
 * Any fact left out of `expected` means "the email did not say".
 */
export function loadReplies(): ReplyFixture[] {
  const dir = join(ROOT, 'replies');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => {
      const raw = JSON.parse(readFileSync(join(dir, f), 'utf8')) as unknown[];
      if (!Array.isArray(raw)) {
        throw new Error(`fixtures/replies/${f} must hold an array of fixtures`);
      }
      return raw.map((row, i) => {
        const parsed = ReplyFixture.safeParse(row);
        if (!parsed.success) {
          throw new Error(
            `fixtures/replies/${f}[${i}] is not a valid reply fixture: ${JSON.stringify(parsed.error.issues)}`
          );
        }
        return parsed.data;
      });
    });
}
