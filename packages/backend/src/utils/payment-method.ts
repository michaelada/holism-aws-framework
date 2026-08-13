/**
 * Payment method classification.
 *
 * The platform has no type column on payment_methods — a method is treated as a
 * card method if its *name* says so. That is the existing convention (see
 * `isCardPaymentMethod` in orgadmin-events' EventActivityForm), and it is what
 * decides whether the handling-fee options appear.
 *
 * The consequence worth knowing: renaming a payment method can change
 * behaviour. A method renamed away from these tokens stops attracting a
 * handling fee.
 *
 * This duplicates the front-end rule. Per project rule §1.5 the shared copy
 * belongs in packages/components once the account-user application needs it;
 * until then the two must be changed together.
 */

const CARD_TOKENS = ['card', 'stripe', 'helix'];

export function isCardPaymentMethod(name: string | undefined | null): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return CARD_TOKENS.some((token) => lower.includes(token));
}
