import type { CasePacket, Correspondence, ExtractedReply, TemplateId } from '../contract';
import type { ExtractionOutput } from './tool';

/**
 * What the model needs to read one email. Deliberately not the case packet, so
 * a reply fixture can be graded without inventing a whole case around it.
 */
export interface ExtractionContext {
  party: 'rental_house' | 'applicant';
  /**
   * Which of our templates this is a reply to. Without it a bare "Yes." cannot
   * be attributed to anything, and the model is right to report nothing.
   */
  respondingTo: TemplateId | null;
  rentalHouseName: string | null;
  clientName: string;
  subject: string;
  body: string;
}

/** One model call, for the cost and latency log (M5). */
export interface ExtractionCall {
  provider: string;
  model: string;
  ms: number;
  costUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  attempt: number;
  ok: boolean;
}

export interface Telemetry {
  record(call: ExtractionCall): void;
}

/** Collects calls so the eval can report totals. Set EXTRACT_LOG=1 to print. */
export class CallLog implements Telemetry {
  readonly calls: ExtractionCall[] = [];

  record(call: ExtractionCall): void {
    this.calls.push(call);
    if (process.env.EXTRACT_LOG === '1') {
      const cost = call.costUsd === null ? '-' : `$${call.costUsd.toFixed(4)}`;
      console.error(
        `  [extract] ${call.provider} ${call.model} ${call.ms}ms ${cost} attempt=${call.attempt} ${call.ok ? 'ok' : 'FAILED'}`
      );
    }
  }

  get totalCostUsd(): number | null {
    const known = this.calls.filter((c) => c.costUsd !== null);
    return known.length === 0 ? null : known.reduce((n, c) => n + (c.costUsd ?? 0), 0);
  }

  get totalMs(): number {
    return this.calls.reduce((n, c) => n + c.ms, 0);
  }
}

export interface Extractor {
  /** Names the provider in logs and in the eval header. */
  readonly name: string;
  /** How many of these can sensibly run at once. */
  readonly concurrency: number;
  /** One email in, facts out. No grading. */
  extractFacts(context: ExtractionContext): Promise<ExtractionOutput>;
  /** One email from a case, graded by the verification rules. */
  extract(packet: CasePacket, email: Correspondence): Promise<ExtractedReply>;
}
