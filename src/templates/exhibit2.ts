import { ATHOS_SIGNATURE } from './signature';

export const EXHIBIT2_SUBJECT =
  'Final verification step – previous rental house references';

/**
 * Exhibit 2: asks the applicant for two previous rental-house references.
 * Wording is verbatim from the workflow doc and takes no variables.
 */
export function renderExhibit2(): string {
  return `Hello,

Thank you for submitting your application.

In order to complete the final step of your verification, please provide the following for at least 2 previous rental houses you have worked with in the past:

\t•\tRental House Company or Name
\t•\tReplacement Value of Equipment you rented
\t•\tContact name of person at Rental House
\t•\tRental House Phone number and email address
\t•\tWhat is the name they have on account on file for your company

We appreciate your time and look forward to hearing back from you soon.

${ATHOS_SIGNATURE}`;
}
