import { ATHOS_SIGNATURE } from './signature';

/**
 * Exhibit 3: US residency / entity confirmation.
 *
 * Q2: the workflow doc tells us to send this email but gives no wording. The
 * body below is GENERIC PLACEHOLDER TEXT written so end-to-end flows can be
 * built, tested and demoed. It has not been approved by the business.
 *
 * Every result that drafts it carries a warning saying so, so nobody sends it
 * by accident. When Athos supplies the real wording, replace the body and set
 * EXHIBIT3_APPROVED to true.
 */
export const EXHIBIT3_SUBJECT = 'Confirmation of US residency – Athos Insurance';

/** False until the business signs off on the wording. */
export const EXHIBIT3_APPROVED = false;

export const EXHIBIT3_UNAPPROVED_WARNING =
  'The US-residency email (Exhibit 3) uses placeholder wording pending business approval. Review before sending. See docs/OPEN-QUESTIONS.md (Q2).';

export function renderExhibit3(input: { clientName: string }): string {
  return `Hello,

Thank you for submitting your application.

As part of our standard verification process, we need to confirm one detail before we can finalize coverage for ${input.clientName}.

Please reply to this email and confirm the following:

\t•\tAre you a resident of the United States, or is the business applying for coverage a United States entity?
\t•\tIf the business is a US entity, in which state is it registered?
\t•\tWhat is the primary US address where the rented equipment will be used?

If you have documentation confirming the above, please attach it to your reply.

We appreciate your time and look forward to hearing back from you soon.

${ATHOS_SIGNATURE}`;
}
