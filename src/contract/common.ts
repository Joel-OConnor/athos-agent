import { z } from 'zod';

/**
 * Bump when a field is added, removed or retyped. The adapter and the agent
 * must agree on this number; the service rejects a packet it does not know.
 */
export const SCHEMA_VERSION = 0;

export const IsoDateTime = z.string().datetime({ offset: true });

export const Product = z.enum(['im_annual', 'im_short_term']);
export type Product = z.infer<typeof Product>;

export const Party = z.enum(['athos', 'applicant', 'rental_house']);
export type Party = z.infer<typeof Party>;

/** Approved customer-facing templates. No free text ever reaches a customer. */
export const TemplateId = z.enum([
  'exhibit1_rental_house_vetting',
  'exhibit2_applicant_references',
  'exhibit3_us_residency', // OPEN QUESTION Q2: wording not yet supplied.
]);
export type TemplateId = z.infer<typeof TemplateId>;

/**
 * Every reason the agent gives must point at something a person can open:
 * a field in the case packet, or a URL.
 */
export const Evidence = z.object({
  field: z.string().optional(), // dot path into the case packet, e.g. "seon.signals.emailAccountCount"
  sourceUrl: z.string().url().optional(),
  quote: z.string().max(500).optional(),
});
export type Evidence = z.infer<typeof Evidence>;

export const Reason = z.object({
  code: z.string(), // stable machine code, e.g. "LIMIT_AT_OR_OVER_100K"
  message: z.string(), // one line a person can read
  evidence: z.array(Evidence).min(1),
});
export type Reason = z.infer<typeof Reason>;
