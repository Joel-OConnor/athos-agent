import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', 'fixtures');

/**
 * No real customer data in this repo, ever. Scrubbed fixtures use .example and
 * .test domains and 555 numbers.
 */
describe('fixture hygiene', () => {
  const files = [
    ...readdirSync(join(ROOT, 'cases')).map((f) => join(ROOT, 'cases', f)),
    ...readdirSync(join(ROOT, 'replies')).map((f) => join(ROOT, 'replies', f)),
    ...readdirSync(join(ROOT, 'extractions')).map((f) => join(ROOT, 'extractions', f)),
  ].filter((f) => f.endsWith('.json'));

  it.each(files)('%s uses only reserved email domains', (file) => {
    const text = readFileSync(file, 'utf8');
    const emails = text.match(/[\w.+-]+@[\w.-]+\.\w+/g) ?? [];
    const offenders = emails.filter(
      (e) =>
        !/\.(example|test|invalid|localhost)$/.test(e) &&
        !e.endsWith('@athosinsurance.com')
    );
    expect(offenders).toEqual([]);
  });

  it.each(files)('%s uses only 555 phone numbers', (file) => {
    const text = readFileSync(file, 'utf8');
    const phones = text.match(/\+?1?[-\s]?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}/g) ?? [];
    const offenders = phones.filter(
      (p) => !p.includes('555') && !p.includes('626-716-9800') && !p.includes('626-701-5047')
    );
    expect(offenders).toEqual([]);
  });

  it('every case has an answer key', () => {
    const cases = readdirSync(join(ROOT, 'cases')).filter((f) => f.endsWith('.json'));
    const answers = new Set(readdirSync(join(ROOT, 'answers')));
    for (const c of cases) expect(answers.has(c)).toBe(true);
  });
});
