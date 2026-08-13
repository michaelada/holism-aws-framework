import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { rememberResponse, recallResponse, forgetResponses } from '../responseCache';

/**
 * The last answer the server gave, kept so a member with no signal has a screen.
 *
 * The tests that matter are the privacy ones. A club device passed between
 * members must not show the previous one's payment history, so entries are keyed
 * by identity and everything goes on sign-out — that is a privacy rule, not a
 * caching one, and it is the reason the clearing behaviour is pinned here rather
 * than left to the hook that calls it.
 */
describe('responseCache', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T09:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('gives back what was stored, with when it was fetched', () => {
    rememberResponse('user-1', '/api/account/khpc/tickets', [{ id: 'ticket-1' }]);

    expect(recallResponse('user-1', '/api/account/khpc/tickets')).toEqual({
      data: [{ id: 'ticket-1' }],
      fetchedAt: '2026-08-12T09:00:00.000Z',
    });
  });

  it('knows nothing about a url it was never given', () => {
    expect(recallResponse('user-1', '/api/account/khpc/entries')).toBeNull();
  });

  /** Two members on one device: the second must not see the first's screens. */
  it('keeps one member’s answers away from another’s', () => {
    rememberResponse('user-1', '/api/account/khpc/payments', [{ total: 5500 }]);

    expect(recallResponse('user-2', '/api/account/khpc/payments')).toBeNull();
  });

  describe('clearing', () => {
    beforeEach(() => {
      rememberResponse('user-1', '/api/account/khpc/payments', [{ total: 1 }]);
      rememberResponse('user-1', '/api/account/bdtc/payments', [{ total: 2 }]);
      rememberResponse('user-2', '/api/account/khpc/payments', [{ total: 3 }]);
    });

    it('forgets everything for one identity', () => {
      forgetResponses('user-1');

      expect(recallResponse('user-1', '/api/account/khpc/payments')).toBeNull();
      expect(recallResponse('user-1', '/api/account/bdtc/payments')).toBeNull();
      // Somebody else's is not this identity's to clear.
      expect(recallResponse('user-2', '/api/account/khpc/payments')).not.toBeNull();
    });

    /** What sign-out does: it must not depend on knowing who was signed in. */
    it('forgets everything for everybody when given no identity', () => {
      forgetResponses();

      expect(recallResponse('user-1', '/api/account/khpc/payments')).toBeNull();
      expect(recallResponse('user-2', '/api/account/khpc/payments')).toBeNull();
    });

    it('leaves anything that is not ours alone', () => {
      window.localStorage.setItem('some-other-app', 'keep me');

      forgetResponses();

      expect(window.localStorage.getItem('some-other-app')).toBe('keep me');
    });

    /** Removing while iterating shifts the indices under us. */
    it('clears every entry, not every other one', () => {
      for (let index = 0; index < 8; index += 1) {
        rememberResponse('user-3', `/api/account/khpc/thing-${index}`, index);
      }

      forgetResponses();

      for (let index = 0; index < 8; index += 1) {
        expect(recallResponse('user-3', `/api/account/khpc/thing-${index}`)).toBeNull();
      }
    });
  });

  describe('when storage will not co-operate', () => {
    it('stores nothing rather than throwing when the quota is full', () => {
      const setItem = vi
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation((key: string) => {
          // The probe succeeds; the write does not — which is how a full quota
          // actually behaves.
          if (key.startsWith('account-cache:')) throw new Error('QuotaExceededError');
        });

      expect(() => rememberResponse('user-1', '/api/x', { a: 1 })).not.toThrow();
      setItem.mockRestore();
    });

    it('recalls nothing rather than throwing on a corrupted entry', () => {
      window.localStorage.setItem('account-cache:user-1:/api/x', 'not json');

      expect(recallResponse('user-1', '/api/x')).toBeNull();
    });

    it('ignores an entry with no fetch time — it cannot be labelled as stale', () => {
      window.localStorage.setItem('account-cache:user-1:/api/x', JSON.stringify({ data: 1 }));

      expect(recallResponse('user-1', '/api/x')).toBeNull();
    });
  });

  it('stores nothing for an anonymous visitor', () => {
    rememberResponse('', '/api/public/organisations', [{ id: 'org-1' }]);

    expect(window.localStorage.length).toBe(0);
  });
});
