import { ATHOS_SIGNATURE } from './signature';

export type Exhibit1Variant = 'first_time' | 'higher_limits';

export interface Exhibit1Input {
  clientName: string;
  variant: Exhibit1Variant;
  /** An individual rental house is asked about a signed rental contract; a business is not. */
  rentalHouseType: 'individual' | 'business';
}

const VARIANT_SENTENCE: Record<Exhibit1Variant, string> = {
  first_time: 'This is the first time we’re working with this client',
  higher_limits: 'The client is requesting higher limits',
};

export const EXHIBIT1_SUBJECT = 'Client verification request – Athos Insurance';

/**
 * Exhibit 1: rental-house vetting. Wording is verbatim from the workflow doc.
 * The agent fills the client name, picks the variant sentence, and keeps or
 * drops the signed-contract bullet. Nothing else may change.
 */
export function renderExhibit1(input: Exhibit1Input): string {
  const contractBullet =
    input.rentalHouseType === 'individual'
      ? '\n\t•\tWill you have a signed and executed rental contract in place before the rental occurs?'
      : '';

  return `Hello,

We have a mutual client named ${input.clientName}, who we are helping to finalize their current insurance needs.   ${VARIANT_SENTENCE[input.variant]}, so we are reaching out for more information to finalize our underwriting and verification process.

Please reply to this email and confirm the below:

\t•\tHave you worked with this client before?
\t•\tIf yes, what is your history with this client?
\t•\tIf no, have you checked any references and/or was this client referred by someone you know and you feel comfortable renting to this customer?
\t•\tPlease provide the total replacement cost value of the equipment (including sales tax) they are renting from you.
\t•\tDo you require general liability insurance or any other extra coverages for their insurance to be sufficient?${contractBullet}

We appreciate your time and look forward to hearing back from you soon.

${ATHOS_SIGNATURE}`;
}
