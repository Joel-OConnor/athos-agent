import { ATHOS_SIGNATURE } from './signature';

/**
 * Exhibit 3: US residency / entity confirmation.
 *
 * Q2: the workflow doc tells us to send this email but gives no wording. The
 * body below is a DRAFT written to match the voice and structure of Exhibits 1
 * and 2. It has not been approved by the business.
 *
 * Every result that drafts it carries a warning saying so, so nobody sends it
 * by accident. When Athos supplies the approved wording, replace the body and
 * set EXHIBIT3_APPROVED to true.
 *
 * It deliberately does not ask for personal identity documents. The workflow
 * already has a route for that (Stripe Selfie ID, via service@), and asking for
 * a driver's license or passport over email is both worse security and a
 * heavier ask than confirming where a business is registered.
 */
export const EXHIBIT3_SUBJECT =
  'One more step to finalize your coverage – Athos Insurance';

/** False until the business signs off on the wording. */
export const EXHIBIT3_APPROVED = false as boolean;

export const EXHIBIT3_UNAPPROVED_WARNING =
  'The US-residency email (Exhibit 3) uses draft wording pending business approval. Review before sending. See docs/OPEN-QUESTIONS.md (Q2).';

export function renderExhibit3(input: { clientName: string }): string {
  return `Hello,

Thank you for submitting your application.

Before we can finalize coverage for ${input.clientName}, we need to confirm where you and your business are based.

Please reply to this email and confirm the below:

\t•\tAre you a United States resident, or is the business applying for this coverage a United States entity?
\t•\tIf the business is a US entity, what state is it registered in, and what name is it registered under?
\t•\tWhat is the primary US address where the rented equipment will be used?
\t•\tIf you have documentation confirming your business registration, please attach it to your reply.

We appreciate your time and look forward to hearing back from you soon.

${ATHOS_SIGNATURE}`;
}
