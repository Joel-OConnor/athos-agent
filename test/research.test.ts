import { NullSearchProvider, buildResearchPacket } from '../src/research/research';
import { domainAge, normalizeDomain } from '../src/research/rdap';
import { fakeFetch, loadCase } from './helpers';

const NOW = '2026-11-08T00:00:00Z';

describe('normalizeDomain', () => {
  it('strips scheme, path and www', () => {
    expect(normalizeDomain('https://www.example.test/about')).toBe('example.test');
    expect(normalizeDomain('example.test')).toBe('example.test');
  });

  it('is null for garbage', () => {
    expect(normalizeDomain('not a url at all ://')).toBeNull();
  });
});

describe('domainAge', () => {
  it('turns an RDAP registration event into a finding with its age', async () => {
    const finding = await domainAge(
      'https://example.test',
      NOW,
      fakeFetch({
        events: [{ eventAction: 'registration', eventDate: '2026-10-09T00:00:00Z' }],
      })
    );
    expect(finding).toMatchObject({
      kind: 'domain_age',
      sourceUrl: expect.stringContaining('rdap.org'),
    });
    expect(finding!.claim).toContain('30 days ago');
  });

  it('is null when RDAP has no registration event', async () => {
    expect(await domainAge('example.test', NOW, fakeFetch({ events: [] }))).toBeNull();
  });

  it('is null on a non-OK response', async () => {
    expect(await domainAge('example.test', NOW, fakeFetch({}, false))).toBeNull();
  });

  it('is null for an unparseable domain', async () => {
    expect(await domainAge(':::', NOW, fakeFetch({}))).toBeNull();
  });
});

describe('buildResearchPacket', () => {
  const packet = loadCase('004-under-100k-flagged-looks-fake.json');

  it('cites every finding and records what it could not find', async () => {
    const provider = {
      webSearch: jest.fn((q: string) =>
        Promise.resolve(
          q.startsWith('site:imdb.com')
            ? []
            : [
                {
                  title: 'Hale Media',
                  url: 'https://example.test/hale',
                  snippet: 'A media company',
                },
              ]
        )
      ),
    };
    const result = await buildResearchPacket(packet, provider, fakeFetch({ events: [] }));

    const kinds = result.findings.map((f) => f.kind);
    expect(kinds).toContain('web_search');
    expect(kinds).toContain('applicant_supplied_link');
    expect(
      result.notFound.some((n) => n.startsWith('No results for: site:imdb.com'))
    ).toBe(true);
    expect(result.notFound.some((n) => n.startsWith('No RDAP registration date'))).toBe(
      true
    );
    for (const f of result.findings) expect(f.sourceUrl).toMatch(/^https?:\/\//);
  });

  it('tells a person what to look at on each social link', async () => {
    const result = await buildResearchPacket(
      packet,
      new NullSearchProvider(),
      fakeFetch({ events: [] })
    );
    const social = result.findings.find((f) => f.kind === 'applicant_supplied_link');
    expect(social!.whatToCheck).toMatch(/follower/i);
  });

  it('records an RDAP failure instead of throwing', async () => {
    const failing = () => Promise.reject(new Error('network down'));
    const result = await buildResearchPacket(packet, new NullSearchProvider(), failing);
    expect(result.notFound.some((n) => n.startsWith('RDAP lookup failed'))).toBe(true);
  });

  it('gives generic guidance for an unrecognised link', async () => {
    const p = {
      ...packet,
      applicant: {
        ...packet.applicant,
        socialLinks: [
          'https://www.linkedin.com/in/x',
          'https://imdb.com/name/x',
          'https://blog.example.test',
        ],
      },
    };
    const result = await buildResearchPacket(
      p,
      new NullSearchProvider(),
      fakeFetch({ events: [] })
    );
    const notes = result.findings
      .filter((f) => f.kind === 'applicant_supplied_link')
      .map((f) => f.whatToCheck);
    expect(notes.some((n) => n?.includes('connections'))).toBe(true);
    expect(notes.some((n) => n?.includes('credits'))).toBe(true);
    expect(notes.some((n) => n?.includes('real, working'))).toBe(true);
  });
});
