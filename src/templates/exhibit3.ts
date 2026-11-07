/**
 * Exhibit 3: US residency / entity confirmation.
 *
 * OPEN Q2. The workflow doc tells us to send this email but never gives its
 * wording. Until underwriting supplies it, rendering throws rather than
 * inventing customer-facing text - no AI and no developer writes this.
 *
 * To unblock: replace the body below with underwriting's wording and delete
 * the throw.
 */
export const EXHIBIT3_SUBJECT = 'Confirmation of US residency – Athos Insurance';

export class MissingTemplateError extends Error {
  constructor(templateId: string) {
    super(
      `Template "${templateId}" has no approved wording yet. See docs/OPEN-QUESTIONS.md (Q2).`
    );
    this.name = 'MissingTemplateError';
  }
}

export function renderExhibit3(_input: { clientName: string }): string {
  throw new MissingTemplateError('exhibit3_us_residency');
}

/** True once underwriting has supplied the wording. */
export const EXHIBIT3_AVAILABLE = false;
