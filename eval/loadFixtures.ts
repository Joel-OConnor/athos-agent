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
      const packet = JSON.parse(
        readFileSync(join(ROOT, 'cases', f), 'utf8')
      ) as Record<string, unknown>;
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

export interface ReplyFixture {
  id: string;
  party: 'rental_house' | 'applicant';
  rentalHouseName: string | null;
  clientName: string;
  subject: string;
  body: string;
  expected: Record<string, unknown>;
  notes?: string;
}

export function loadReplies(): ReplyFixture[] {
  const dir = join(ROOT, 'replies');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as ReplyFixture);
}
