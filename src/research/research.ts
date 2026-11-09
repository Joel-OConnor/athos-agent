import type { CasePacket, ResearchPacket, ResearchFinding } from '../contract';
import { domainAge, normalizeDomain, type Fetch } from './rdap';

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

export interface ResearchProvider {
  /** Free-text web search. M4. Returns results with real URLs or an empty list. */
  webSearch(query: string): Promise<SearchHit[]>;
}

/**
 * M4. Builds the packet a person reads before choosing between decline and
 * Stripe Selfie ID. It gathers and cites; it never renders a verdict.
 *
 * Does NOT scrape LinkedIn, Instagram or Facebook. Links the applicant gave us
 * are passed through with a note on what to look at, per the scope doc.
 */
export async function buildResearchPacket(
  packet: CasePacket,
  provider: ResearchProvider,
  fetchImpl?: Fetch
): Promise<ResearchPacket> {
  const findings: ResearchFinding[] = [];
  const notFound: string[] = [];
  const now = packet.now;
  const name = packet.applicant.name;
  const business = packet.applicant.businessName;
  const city = packet.applicant.address.city;
  const state = packet.applicant.address.state;

  const queries = [
    [name, city, state].filter(Boolean).join(' '),
    business ? [business, city, state].filter(Boolean).join(' ') : null,
    `site:imdb.com ${business ?? name}`,
  ].filter((q): q is string => Boolean(q));

  for (const q of queries) {
    const hits = await provider.webSearch(q);
    if (hits.length === 0) {
      notFound.push(`No results for: ${q}`);
      continue;
    }
    for (const hit of hits.slice(0, 5)) {
      findings.push({
        kind: q.startsWith('site:imdb.com') ? 'imdb' : 'web_search',
        claim: `${hit.title} — ${hit.snippet}`.slice(0, 500),
        sourceUrl: hit.url,
        observedAt: now,
        whatToCheck: null,
      });
    }
  }

  for (const site of packet.applicant.websites) {
    const host = normalizeDomain(site);
    if (!host) continue;
    try {
      const finding = await domainAge(host, now, fetchImpl);
      if (finding) findings.push(finding);
      else notFound.push(`No RDAP registration date for ${host}`);
    } catch {
      notFound.push(`RDAP lookup failed for ${host}`);
    }
  }

  for (const link of packet.applicant.socialLinks) {
    findings.push({
      kind: 'applicant_supplied_link',
      claim: `Applicant supplied this link: ${link}`,
      sourceUrl: link,
      observedAt: now,
      whatToCheck: whatToCheckFor(link),
    });
  }

  return { findings, notFound };
}

function whatToCheckFor(link: string): string {
  const host = normalizeDomain(link) ?? '';
  if (host.includes('linkedin')) {
    return 'How many connections, and whether anyone has written a recommendation.';
  }
  if (host.includes('imdb')) {
    return 'Previous credits and work history.';
  }
  if (host.includes('instagram') || host.includes('facebook')) {
    return 'Post volume and engagement, follower count (over 1K is best), and how long ago the page started - a recent page is a red flag.';
  }
  return 'Whether the page supports the applicant being a real, working person or business.';
}

/** Stand-in so the pipeline runs with no search provider wired up. */
export class NullSearchProvider implements ResearchProvider {
  webSearch(): Promise<SearchHit[]> {
    return Promise.resolve([]);
  }
}
