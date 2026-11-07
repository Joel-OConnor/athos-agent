import { renderExhibit1 } from '../src/templates/exhibit1';
import { renderExhibit2 } from '../src/templates/exhibit2';
import { MissingTemplateError, renderExhibit3 } from '../src/templates/exhibit3';
import { buildDrafts, draftId } from '../src/templates/draft';
import { loadCase } from './helpers';

describe('templates', () => {
  it('matches the approved Exhibit 1 wording, business variant', () => {
    expect(
      renderExhibit1({
        clientName: 'Whitfield Pictures LLC',
        variant: 'first_time',
        rentalHouseType: 'business',
      })
    ).toMatchSnapshot();
  });

  it('matches the approved Exhibit 1 wording, individual + higher limits', () => {
    expect(
      renderExhibit1({
        clientName: 'Whitfield Pictures LLC',
        variant: 'higher_limits',
        rentalHouseType: 'individual',
      })
    ).toMatchSnapshot();
  });

  it('asks an individual about a signed contract and a business not', () => {
    const individual = renderExhibit1({
      clientName: 'X',
      variant: 'first_time',
      rentalHouseType: 'individual',
    });
    const business = renderExhibit1({
      clientName: 'X',
      variant: 'first_time',
      rentalHouseType: 'business',
    });
    expect(individual).toContain('signed and executed rental contract');
    expect(business).not.toContain('signed and executed rental contract');
  });

  it('matches the approved Exhibit 2 wording', () => {
    expect(renderExhibit2()).toMatchSnapshot();
  });

  it('refuses to invent the US-residency email', () => {
    expect(() => renderExhibit3({ clientName: 'X' })).toThrow(MissingTemplateError);
  });

  it('drafts one Exhibit 1 per rental house with stable ids', () => {
    const packet = loadCase('001-clean-100k-seon-approve.json');
    const a = buildDrafts(packet, ['exhibit1_rental_house_vetting']);
    const b = buildDrafts(packet, ['exhibit1_rental_house_vetting']);
    expect(a.outbound).toHaveLength(2);
    expect(a.outbound.map((d) => d.draftId)).toEqual(b.outbound.map((d) => d.draftId));
    expect(a.outbound[0]!.draftId).toBe(
      draftId('CASE-001', 'exhibit1_rental_house_vetting', 'rh-1')
    );
  });

  it('does not re-draft an email already in the correspondence', () => {
    const packet = loadCase('007-strong-rental-house-reply.json');
    const { outbound } = buildDrafts(packet, ['exhibit1_rental_house_vetting']);
    expect(outbound).toHaveLength(0);
  });

  it('warns instead of drafting when there are no rental houses', () => {
    const packet = loadCase('005-seon-confirmed-fraud.json');
    const { outbound, warnings } = buildDrafts(packet, ['exhibit1_rental_house_vetting']);
    expect(outbound).toHaveLength(0);
    expect(warnings.join(' ')).toMatch(/No rental houses listed/);
  });
});
