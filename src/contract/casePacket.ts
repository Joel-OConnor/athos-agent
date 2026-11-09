import { z } from 'zod';
import { IsoDateTime, Party, Product, TemplateId } from './common';

export const Applicant = z.object({
  name: z.string(),
  businessName: z.string().nullable(),
  email: z.email(),
  phone: z.string().nullable(),
  address: z.object({
    line1: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    postalCode: z.string().nullable(),
    country: z.string().nullable(), // ISO-3166 alpha-2 where known
  }),
  websites: z.array(z.string()).default([]),
  socialLinks: z.array(z.string()).default([]),
  hasPriorAthosPolicy: z.boolean().nullable(),
});
export type Applicant = z.infer<typeof Applicant>;

/**
 * Underwriting gates already decided elsewhere. The agent passes these through
 * untouched - it never decides a gate.
 */
export const UnderwritingGates = z.object({
  ofac: z.boolean(),
  mexico: z.boolean(),
  rcvOver150k: z.boolean(),
  claims: z.boolean(),
  trailers: z.boolean(),
  tib: z.boolean(),
});
export type UnderwritingGates = z.infer<typeof UnderwritingGates>;

/**
 * The three signals the workflow doc reads off the SEON report.
 *
 * Athos-side gap: today only verified/score/blackbox/fraudReasons are stored on
 * Customer. These three live in the SEON report email and dashboard only.
 * Null means "we could not get it", which is NOT the same as zero - the agent
 * must not treat a null as a failed check.
 */
export const SeonSignals = z.object({
  emailAccountCount: z.number().int().nonnegative().nullable(),
  phoneAccountCount: z.number().int().nonnegative().nullable(),
  ipCountry: z.string().nullable(),
  ipRegion: z.string().nullable(),
  ipCity: z.string().nullable(),
  ipDistanceMilesFromAddress: z.number().nonnegative().nullable(),
});
export type SeonSignals = z.infer<typeof SeonSignals>;

export const Seon = z.object({
  state: z.enum(['approve', 'review', 'decline']),
  fraudScore: z.number().nullable(),
  blackboxScore: z.number().nullable(),
  fraudReasons: z.array(z.string()).default([]),
  /** True only when SEON itself confirms fraud with no doubt. Rare. */
  confirmedFraud: z.boolean().default(false),
  signals: SeonSignals,
  /** Full SEON response when we have it. Shape is SEON's, not ours. */
  raw: z.unknown().optional(),
});
export type Seon = z.infer<typeof Seon>;

export const RentalHouseContact = z.object({
  name: z.string().nullable(),
  email: z.email(),
  phone: z.string().nullable(),
});

export const RentalHouse = z.object({
  id: z.string(),
  name: z.string(),
  /** Drives the "signed and executed rental contract" line in Exhibit 1. */
  type: z.enum(['individual', 'business']),
  contacts: z.array(RentalHouseContact).default([]),
  /** What the applicant said they are renting from this house, USD. */
  statedEquipmentValue: z.number().nonnegative().nullable(),
});
export type RentalHouse = z.infer<typeof RentalHouse>;

export const Correspondence = z.object({
  id: z.string(),
  direction: z.enum(['outbound', 'inbound']),
  party: Party,
  /** Which rental house this relates to, when it relates to one. */
  rentalHouseId: z.string().nullable(),
  template: TemplateId.nullable(), // set on outbound Athos email
  from: z.string(),
  to: z.array(z.string()).default([]),
  subject: z.string(),
  body: z.string(),
  sentAt: IsoDateTime,
});
export type Correspondence = z.infer<typeof Correspondence>;

export const CasePacket = z.object({
  schemaVersion: z.number().int(),
  caseId: z.string(),
  product: Product,
  applicant: Applicant,
  /** Requested rented equipment limit, USD. */
  rentedEquipmentLimit: z.number().nonnegative(),
  underwritingGates: UnderwritingGates,
  seon: Seon,
  rentalHouses: z.array(RentalHouse).default([]),
  /** Every email sent and received so far, oldest first. */
  correspondence: z.array(Correspondence).default([]),
  /** Current time, injected so tests control how long a case has waited. */
  now: IsoDateTime,
});
export type CasePacket = z.infer<typeof CasePacket>;
