import { AgentResult, CasePacket, SCHEMA_VERSION, type ExtractedReply } from './contract';
import { route } from './routing/route';
import { decide } from './decide/decide';
import { createExtractor, type Extractor } from './extract';
import {
  NullSearchProvider,
  buildResearchPacket,
  type ResearchProvider,
} from './research/research';
import type { Fetch } from './research/rdap';

export interface RunOptions {
  extractor?: Extractor;
  searchProvider?: ResearchProvider;
  /** For RDAP lookups. Tests pass a stub so nothing touches the network. */
  fetchImpl?: Fetch;
}

/**
 * One case packet in, one result out. Holds no state between calls.
 *
 * The order matters and is the whole design:
 *   route    - deterministic
 *   extract  - the only model call, and it only produces facts
 *   decide   - deterministic, reads facts, never reads an email
 *   research - only on escalation
 */
export async function runCase(
  input: unknown,
  options: RunOptions = {}
): Promise<AgentResult> {
  const packet: CasePacket = CasePacket.parse(input);
  if (packet.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Case packet schemaVersion ${packet.schemaVersion} is not supported (expected ${SCHEMA_VERSION}).`
    );
  }

  const routeDecision = route(packet);

  const inbound = packet.correspondence.filter((c) => c.direction === 'inbound');
  let extracted: ExtractedReply[] = [];
  if (inbound.length > 0 && routeDecision.path === 'vet_rental_houses') {
    const extractor = options.extractor ?? createExtractor();
    extracted = await Promise.all(
      inbound.map((email) => extractor.extract(packet, email))
    );
  }

  const result = decide({ packet, routeDecision, extracted });

  if (result.recommendation === 'escalate_to_service') {
    result.researchPacket = await buildResearchPacket(
      packet,
      options.searchProvider ?? new NullSearchProvider(),
      options.fetchImpl
    );
  }

  return AgentResult.parse(result);
}
