import type { CasePacket, Correspondence, ExtractedReply } from '../../contract';
import type { ExtractionOutput } from '../tool';
import type { ExtractionContext, Extractor } from '../types';

/**
 * Offline. Replays extractions underwriting has already labelled, so the tests
 * and the case eval run with no model, no key and no network, and give the
 * same answer every time.
 *
 * This is what CI uses. It is not a stand-in for the model: it proves the
 * routing and the decision logic, never the reading.
 */
export class FixtureExtractor implements Extractor {
  readonly name = 'fixture';
  readonly concurrency = 32;

  constructor(private readonly byCorrespondenceId: Map<string, ExtractedReply>) {}

  async extract(
    _packet: CasePacket,
    email: Correspondence
  ): Promise<ExtractedReply> {
    const hit = this.byCorrespondenceId.get(email.id);
    if (!hit) {
      throw new Error(
        `No labelled extraction for email ${email.id}. Add it to fixtures/extractions/, or run with a real provider.`
      );
    }
    return hit;
  }

  async extractFacts(_context: ExtractionContext): Promise<ExtractionOutput> {
    throw new Error(
      'The fixture provider replays whole cases; it cannot read an arbitrary email. Use EXTRACT_PROVIDER=claude-code or anthropic.'
    );
  }
}
