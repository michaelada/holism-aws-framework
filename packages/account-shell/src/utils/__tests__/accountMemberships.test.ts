import { describe, it, expect } from 'vitest';
import { toMemberships } from '../accountMemberships';

/**
 * `GET /api/account/organisations` is the one account endpoint that wraps its
 * list. Every screen that reads it got the unwrapping wrong, in two ways — one
 * crashed on `.map`, one swallowed a `TypeError` in a `.then` and reported "no
 * other organisations" instead. The second is why this is worth a test: a
 * silently empty list looks like a legitimate answer.
 */
describe('toMemberships', () => {
  const membership = {
    organisationId: 'org-1',
    organisationUserId: 'ou-1',
    urlCode: 'khpc',
    displayName: 'Kildare Hunt Pony Club',
    currency: 'EUR',
    language: 'en-GB',
    capabilities: [],
    status: 'active',
  };

  it('unwraps the envelope the endpoint actually returns', () => {
    expect(toMemberships({ organisations: [membership] })).toEqual([membership]);
  });

  it('returns an empty list for an empty envelope', () => {
    expect(toMemberships({ organisations: [] })).toEqual([]);
  });

  /** So callers keep working if the endpoint is ever aligned with its siblings. */
  it('accepts a bare array too', () => {
    expect(toMemberships([membership])).toEqual([membership]);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an HTML string', '<!doctype html><html></html>'],
    ['an object with no organisations key', { total: 0 }],
    ['organisations that is not an array', { organisations: 'nope' }],
  ])('returns an empty list for %s rather than throwing', (_label, input) => {
    expect(toMemberships(input)).toEqual([]);
  });
});
