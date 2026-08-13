import { AccountMembership } from '../types/account';

/**
 * Unwrap `GET /api/account/organisations`.
 *
 * That endpoint is the **only** one in the account API that wraps its list:
 * it answers `{ organisations: [...] }` while every other list — entries,
 * bookings, memberships, tickets, the catalogue — answers with the bare array.
 * Three separate screens read it, and all three originally treated the response
 * as the array, in two different ways:
 *
 *  - the switcher and the directory stored the envelope and then called `.map`
 *    on it, blanking the page;
 *  - the awaiting-approval screen called `.filter` inside a `.then`, so the
 *    `TypeError` was swallowed by the adjacent `.catch` and the member was
 *    quietly told they belonged to no other clubs.
 *
 * The second is the worse failure: it looks like an answer. Hence one helper
 * rather than three unwrappings — the shape is surprising, so it should be
 * described in one place.
 *
 * Also tolerates a response that is not the expected object at all, which is
 * what arrives when something other than the API answers the origin.
 */
export function toMemberships(response: unknown): AccountMembership[] {
  if (Array.isArray(response)) {
    // Defensive: if the endpoint is ever changed to answer bare, like its
    // siblings, callers keep working rather than silently emptying.
    return response as AccountMembership[];
  }

  const organisations = (response as { organisations?: unknown } | null)?.organisations;
  return Array.isArray(organisations) ? (organisations as AccountMembership[]) : [];
}
