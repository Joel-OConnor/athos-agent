import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gradeReply, verificationRules } from '../src/verification';
import type { ReplyFacts } from '../src/verification';

const BLANK: ReplyFacts = {
  workedWithClientBefore: 'unstated',
  checkedReferencesOrReferred: 'unstated',
  referrerNamed: 'unstated',
  comfortableRenting: 'unstated',
  knowsOfClient: 'unstated',
  declinesToVouch: 'unstated',
  warnsAboutClient: 'unstated',
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

  it('matches every reply fixture', () => {
    const dir = join(__dirname, '..', 'fixtures', 'replies');
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
      const fx = JSON.parse(readFileSync(join(dir, f), 'utf8')) as {
        expected: Record<string, unknown>;
      };
      const facts: ReplyFacts = {
        ...BLANK,
        ...(fx.expected as Partial<ReplyFacts>),
        referencesGivenCount: Number(fx.expected.referencesGivenCount ?? 0),
      };
      const g = gradeReply(facts);
      expect([f, g.strength]).toEqual([f, fx.expected.strength]);
      expect([f, g.ruleId]).toEqual([f, fx.expected.strengthRuleId]);
    }
  });
});
