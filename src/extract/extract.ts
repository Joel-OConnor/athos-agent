import Anthropic from '@anthropic-ai/sdk';
import type { CasePacket, Correspondence, ExtractedReply } from '../contract';
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionUserMessage } from './prompt';
import { ExtractionOutput, RECORD_REPLY_TOOL } from './tool';

export interface Extractor {
  extract(
    packet: CasePacket,
    email: Correspondence
  ): Promise<ExtractedReply>;
}

const MODEL = process.env.EXTRACT_MODEL ?? 'claude-sonnet-5-5';

/**
 * M3. The ONLY place a model's output enters the system, and it produces facts,
 * never a decision. `decide()` reads these fields; it never reads an email.
 */
export class ClaudeExtractor implements Extractor {
  constructor(private readonly client = new Anthropic()) {}

  async extract(
    packet: CasePacket,
    email: Correspondence
  ): Promise<ExtractedReply> {
    const rentalHouse =
      packet.rentalHouses.find((rh) => rh.id === email.rentalHouseId) ?? null;

    const message = buildExtractionUserMessage({
      party: email.party === 'applicant' ? 'applicant' : 'rental_house',
      rentalHouseName: rentalHouse?.name ?? null,
      clientName: packet.applicant.businessName ?? packet.applicant.name,
      subject: email.subject,
      body: email.body,
    });

    const parsed = await this.callWithRetry(message);

    return {
      ...parsed,
      correspondenceId: email.id,
      rentalHouseId: email.rentalHouseId,
    };
  }

  private async callWithRetry(
    message: string,
    attempt = 0
  ): Promise<ExtractionOutput> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: [
        {
          type: 'text',
          text: EXTRACTION_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [RECORD_REPLY_TOOL as never],
      tool_choice: { type: 'tool', name: RECORD_REPLY_TOOL.name },
      messages: [{ role: 'user', content: message }],
    });

    const block = response.content.find((c) => c.type === 'tool_use');
    const result = block
      ? ExtractionOutput.safeParse((block as { input: unknown }).input)
      : null;

    if (result?.success) return result.data;

    const strict = process.env.STRICT_EXTRACTION === '1';
    if (strict || attempt >= 1) {
      throw new Error(
        `Extraction produced no valid record_reply output: ${
          result ? JSON.stringify(result.error.issues) : 'no tool_use block'
        }`
      );
    }
    return this.callWithRetry(message, attempt + 1);
  }
}

/** Used by tests and by `npm run eval` so neither needs an API key. */
export class FixtureExtractor implements Extractor {
  constructor(private readonly byCorrespondenceId: Map<string, ExtractedReply>) {}

  async extract(
    _packet: CasePacket,
    email: Correspondence
  ): Promise<ExtractedReply> {
    const hit = this.byCorrespondenceId.get(email.id);
    if (!hit) throw new Error(`No fixture extraction for email ${email.id}`);
    return hit;
  }
}
