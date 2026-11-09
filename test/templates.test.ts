import { renderExhibit1 } from '../src/templates/exhibit1';
import { renderExhibit2 } from '../src/templates/exhibit2';
import {
  EXHIBIT3_APPROVED,
  EXHIBIT3_UNAPPROVED_WARNING,
  renderExhibit3,
} from '../src/templates/exhibit3';
import { buildDrafts, draftId, recipientKeyOf } from '../src/templates/draft';
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

  it('renders the placeholder US-residency email and flags it as unapproved', () => {
    expect(EXHIBIT3_APPROVED).toBe(false);
    expect(renderExhibit3({ clientName: 'Whitfield Pictures LLC' })).toMatchSnapshot();
  });

  it('warns on every draft of the unapproved US-residency email', () => {
    const packet = loadCase('002-seon-review-foreign.json');
    const { outbound, warnings } = buildDrafts(packet, ['exhibit3_us_residency']);
    expect(outbound).toHaveLength(1);
    expect(warnings).toContain(EXHIBIT3_UNAPPROVED_WARNING);
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

  it('vets rental houses the applicant named (Q14)', () => {
    const packet = loadCase('001-clean-100k-seon-approve.json');
    const { outbound } = buildDrafts(packet, ['exhibit1_rental_house_vetting'], {
      referredRentalHouses: [
        {
          rentalHouseName: 'Gulf Coast Example Rentals',
          contactName: 'Andre Soto',
          email: 'andre@gulfcoastexample.test',
          phone: null,
          equipmentValue: 30000,
          nameOnAccount: null,
        },
      ],
    });
    expect(outbound).toHaveLength(3);
    expect(outbound[2]!.to).toEqual(['andre@gulfcoastexample.test']);
  });
});

describe('draft edge cases', () => {
  it('warns about a rental house with no contact email and skips it', () => {
    const packet = loadCase('001-clean-100k-seon-approve.json');
    packet.rentalHouses[1]!.contacts = [];
    const { outbound, warnings } = buildDrafts(packet, ['exhibit1_rental_house_vetting']);
    expect(outbound).toHaveLength(1);
    expect(warnings.join(' ')).toMatch(/no contact email/);
  });

  it('warns about an applicant reference with no email (Q14)', () => {
    const packet = loadCase('001-clean-100k-seon-approve.json');
    const { outbound, warnings } = buildDrafts(
      packet,
      ['exhibit1_rental_house_vetting'],
      {
        referredRentalHouses: [
          {
            rentalHouseName: 'Nameless Example',
            contactName: null,
            email: null,
            phone: null,
            equipmentValue: null,
            nameOnAccount: null,
          },
        ],
      }
    );
    expect(outbound).toHaveLength(2);
    expect(warnings.join(' ')).toMatch(/cannot be vetted/);
  });

  it('does not re-draft Exhibit 2 once it has gone out', () => {
    const packet = loadCase('010-applicant-references.json');
    const { outbound } = buildDrafts(packet, ['exhibit2_applicant_references']);
    expect(outbound).toHaveLength(0);
  });

  it('uses first-time wording when prior-policy status is unknown', () => {
    const packet = loadCase('001-clean-100k-seon-approve.json');
    packet.applicant.hasPriorAthosPolicy = null;
    const { outbound } = buildDrafts(packet, ['exhibit1_rental_house_vetting']);
    expect(outbound[0]!.body).toContain('first time');
  });

  it('uses higher-limits wording for an existing policyholder (Q5)', () => {
    const packet = loadCase('003-under-100k-flagged-looks-real.json');
    const { outbound } = buildDrafts(packet, ['exhibit1_rental_house_vetting']);
    expect(outbound[0]!.body).toContain('requesting higher limits');
  });
});

describe('draft ids survive a round trip through the Work Queue (Q15)', () => {
  it('recovers the applicant key from a sent Exhibit 2 or 3', () => {
    expect(
      recipientKeyOf({
        rentalHouseId: null,
        template: 'exhibit2_applicant_references',
        to: ['a@b.test'],
      })
    ).toBe('applicant');
    expect(
      recipientKeyOf({
        rentalHouseId: null,
        template: 'exhibit3_us_residency',
        to: ['a@b.test'],
      })
    ).toBe('applicant');
  });

  it('recovers the rental-house id when there is one', () => {
    expect(
      recipientKeyOf({
        rentalHouseId: 'rh-9',
        template: 'exhibit1_rental_house_vetting',
        to: ['x@y.test'],
      })
    ).toBe('rh-9');
  });

  it('recovers a referred house from its address, case-insensitively', () => {
    expect(
      recipientKeyOf({
        rentalHouseId: null,
        template: 'exhibit1_rental_house_vetting',
        to: ['Andre@GulfCoastExample.test'],
      })
    ).toBe('ref:andre@gulfcoastexample.test');
  });

  it('does not re-draft Exhibit 1 to a referred house once it has gone out', () => {
    const packet = loadCase('010-applicant-references.json');
    packet.correspondence.push({
      ...packet.correspondence[0]!,
      id: 'out-9',
      rentalHouseId: null,
      to: ['andre@gulfcoastexample.test'],
    });
    const { outbound } = buildDrafts(packet, ['exhibit1_rental_house_vetting'], {
      referredRentalHouses: [
        {
          rentalHouseName: 'Gulf Coast Example Rentals',
          contactName: null,
          email: 'andre@gulfcoastexample.test',
          phone: null,
          equipmentValue: null,
          nameOnAccount: null,
        },
        {
          rentalHouseName: 'Sunshine Example Camera',
          contactName: null,
          email: 'mia@sunshineexample.test',
          phone: null,
          equipmentValue: null,
          nameOnAccount: null,
        },
      ],
    });
    expect(outbound.map((o) => o.to[0])).toEqual(['mia@sunshineexample.test']);
  });
});
