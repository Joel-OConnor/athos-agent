import type {
  CasePacket,
  Correspondence,
  ExtractedReply,
  TemplateId,
} from '../../contract';
import { buildExtractionUserMessage } from '../prompt';
import { gradeExtraction } from '../gradeExtraction';
import { ExtractionOutput } from '../tool';
import type { ExtractionContext, Extractor, Telemetry } from '../types';
import { CallLog } from '../types';

/**
 * The last template we sent down this thread. A rental house is answering the
 * Exhibit 1 we sent them; the applicant is answering whichever of Exhibit 2 or
 * 3 went out most recently.
 */
export function lastTemplateSentTo(
  packet: CasePacket,
  email: Correspondence
): TemplateId | null {
  const sentBefore = packet.correspondence
    .filter(
      (c) =>
        c.direction === 'outbound' &&
        c.template !== null &&
        c.sentAt <= email.sentAt &&
        (email.rentalHouseId === null
          ? c.rentalHouseId === null
          : c.rentalHouseId === email.rentalHouseId)
    )
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  return sentBefore.at(-1)?.template ?? null;
}

export interface Attempt {
  /** Whatever the provider got back, before validation. */
  raw: unknown;
  costUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  model: string;
}

/**
 * Everything the providers share: building the prompt, validating what comes
 * back against the contract, retrying once, logging the call, and grading.
 *
 * A provider answers one question - given this prompt, what did the model say?
 * It never decides a strength; `gradeExtraction` does that from the rules.
 */
export abstract class BaseExtractor implements Extractor {
  abstract readonly name: string;
  abstract readonly concurrency: number;

  constructor(readonly telemetry: Telemetry = new CallLog()) {}

  /** One call to whatever is behind this provider. */
  protected abstract callModel(userMessage: string): Promise<Attempt>;

  async extractFacts(context: ExtractionContext): Promise<ExtractionOutput> {
    const userMessage = buildExtractionUserMessage(context);
    let lastIssue = 'no response';

    for (let attempt = 0; attempt < 2; attempt++) {
      const started = Date.now();
      let got: Attempt | null = null;
      let parsed: ExtractionOutput | null = null;
      try {
        got = await this.callModel(userMessage);
        const result = ExtractionOutput.safeParse(got.raw);
        if (result.success) parsed = result.data;
        else lastIssue = JSON.stringify(result.error.issues).slice(0, 400);
      } catch (err) {
        lastIssue = err instanceof Error ? err.message : String(err);
      }

      this.telemetry.record({
        provider: this.name,
        model: got?.model ?? 'unknown',
        ms: Date.now() - started,
        costUsd: got?.costUsd ?? null,
        inputTokens: got?.inputTokens ?? null,
        outputTokens: got?.outputTokens ?? null,
        attempt,
        ok: parsed !== null,
      });

      if (parsed !== null) return parsed;
      if (process.env.STRICT_EXTRACTION === '1') break;
    }

    throw new Error(`[${this.name}] extraction failed: ${lastIssue}`);
  }

  async extract(packet: CasePacket, email: Correspondence): Promise<ExtractedReply> {
    const rentalHouse =
      packet.rentalHouses.find((rh) => rh.id === email.rentalHouseId) ?? null;
    const facts = await this.extractFacts({
      party: email.party === 'applicant' ? 'applicant' : 'rental_house',
      rentalHouseName: rentalHouse?.name ?? null,
      clientName: packet.applicant.businessName ?? packet.applicant.name,
      subject: email.subject,
      body: email.body,
      respondingTo: lastTemplateSentTo(packet, email),
    });
    return gradeExtraction(facts, {
      id: email.id,
      rentalHouseId: email.rentalHouseId,
      party: email.party === 'applicant' ? 'applicant' : 'rental_house',
    });
  }
}
