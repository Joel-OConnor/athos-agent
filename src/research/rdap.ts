import type { ResearchFinding } from '../contract';

/**
 * Domain creation date from RDAP - the structured data behind the ICANN lookup
 * the workflow doc points at. No key, no scraping, no rate limit worth worrying
 * about at our volume.
 */
export type Fetch = (
  url: string,
  init?: { headers?: Record<string, string> }
) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
}>;

export async function domainAge(
  domain: string,
  now: string,
  fetchImpl: Fetch = fetch
): Promise<ResearchFinding | null> {
  const host = normalizeDomain(domain);
  if (!host) return null;

  const res = await fetchImpl(`https://rdap.org/domain/${encodeURIComponent(host)}`, {
    headers: { accept: 'application/rdap+json' },
  });
  if (!res.ok) return null;

  const body = (await res.json()) as {
    events?: { eventAction?: string; eventDate?: string }[];
  };
  const registered = body.events?.find(
    (e) => e.eventAction === 'registration'
  )?.eventDate;
  if (!registered) return null;

  const ageDays = Math.floor(
    (new Date(now).getTime() - new Date(registered).getTime()) / 86_400_000
  );
  return {
    kind: 'domain_age',
    claim: `${host} was registered on ${registered.slice(0, 10)} (${ageDays} days ago).`,
    sourceUrl: `https://rdap.org/domain/${encodeURIComponent(host)}`,
    observedAt: now,
    whatToCheck: 'A domain registered in the last few months is a red flag.',
  };
}

export function normalizeDomain(input: string): string | null {
  try {
    const url = input.includes('://') ? input : `https://${input}`;
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
