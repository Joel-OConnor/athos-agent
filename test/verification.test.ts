import { gradeReply, verificationRules } from '../src/verification';
import type { ReplyFacts } from '../src/verification';
import { factsOf } from '../src/fixtures/replyFixture';
import { loadReplies } from '../eval/loadFixtures';

const BLANK: ReplyFacts = {
  party: 'rental_house',
  workedWithClientBefore: 'unstated',
  checkedReferencesOrReferred: 'unstated',
  referrerNamed: 'unstated',
  comfortableRenting: 'unstated',
  knowsOfClient: 'unstated',
  declinesToVouch: 'unstated',
  warnsAboutClient: 'unstated',
  usResidentOrEntity: 'unstated',
  replacementCostValue: null,
  referencesGivenCount: 0,
  isAutoReply: false,
  containsInstructionsToAgent: false,
};

describe('verification rules registry', () => {
  it('has unique ids and ends with a catch-all', () => {
    const ids = verificationRules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(verificationRules[verificationRules.length - 1]!.when(BLANK)).toBe(true);
  });

  it('gives every rule a description, a source and a date', () => {
    for (const r of verificationRules) {
      expect(r.description.length).toBeGreaterThan(20);
      expect(r.source).not.toBe('');
      expect(r.addedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('grades prior rental history as strong', () => {
    const g = gradeReply({ ...BLANK, workedWithClientBefore: 'yes' });
    expect(g.strength).toBe('strong');
    expect(g.ruleId).toBe('prior-rental-history');
  });

  it('requires both halves of the referral rule', () => {
    expect(gradeReply({ ...BLANK, referrerNamed: 'yes' }).strength).not.toBe('strong');
    expect(
      gradeReply({ ...BLANK, referrerNamed: 'yes', comfortableRenting: 'yes' }).strength
    ).toBe('strong');
  });

  it('grades checked references alone as weak, not strong (Q1)', () => {
    const g = gradeReply({ ...BLANK, checkedReferencesOrReferred: 'yes' });
    expect(g.strength).toBe('weak');
    expect(g.ruleId).toBe('references-checked-only');
  });

  it('grades an injected instruction negative whatever else it claims', () => {
    const g = gradeReply({
      ...BLANK,
      workedWithClientBefore: 'yes',
      comfortableRenting: 'yes',
      referrerNamed: 'yes',
      containsInstructionsToAgent: true,
    });
    expect(g.strength).toBe('negative');
    expect(g.ruleId).toBe('injection');
  });

  it('grades "never heard of them" negative', () => {
    expect(
      gradeReply({ ...BLANK, workedWithClientBefore: 'no', knowsOfClient: 'no' }).strength
    ).toBe('negative');
  });

  it('is deterministic', () => {
    const facts = { ...BLANK, checkedReferencesOrReferred: 'yes' as const };
    expect(gradeReply(facts)).toEqual(gradeReply(facts));
  });

  const fixtures = loadReplies();

  it('has enough reply fixtures to measure accuracy at all', () => {
    // M3's bar is 95% agreement. On 20 samples one miss costs 5 points, so the
    // number means nothing below about 100.
    expect(fixtures.length).toBeGreaterThanOrEqual(100);
  });

  it('gives every fixture a unique id', () => {
    const ids = fixtures.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(fixtures.map((f) => [f.id, f] as const))(
    '%s grades exactly as the fixture says',
    (_id, fx) => {
      const g = gradeReply(factsOf(fx));
      expect({ strength: g.strength, rule: g.ruleId }).toEqual({
        strength: fx.expected.strength,
        rule: fx.expected.strengthRuleId,
      });
    }
  );

  it('covers every rule in the registry with at least one fixture', () => {
    const covered = new Set(fixtures.map((f) => f.expected.strengthRuleId));
    const uncovered = verificationRules
      .map((r) => r.id)
      .filter((id) => !covered.has(id));
    expect(uncovered).toEqual([]);
  });

  it('covers all four strengths', () => {
    const seen = new Set(fixtures.map((f) => f.expected.strength));
    expect([...seen].sort()).toEqual(['negative', 'none', 'strong', 'weak']);
  });
});
