import {
  deriveActivityStatus,
  isPaid,
  isPast,
  daysUntil,
  isDueForRenewal,
  RENEWAL_WINDOW_DAYS,
} from '../activity-status';

/** Fixed so nothing here depends on the day the suite runs. */
const TODAY = new Date('2026-06-15T09:30:00Z');

describe('isPaid', () => {
  it('treats the club as still waiting for the unpaid states', () => {
    for (const status of ['pending', 'unpaid', 'failed', 'awaiting_payment']) {
      expect(isPaid(status)).toBe(false);
    }
  });

  it('treats a settled payment as paid', () => {
    expect(isPaid('paid')).toBe(true);
    expect(isPaid('complete')).toBe(true);
  });

  it('is case-insensitive, because the column is free text', () => {
    expect(isPaid('PENDING')).toBe(false);
    expect(isPaid('Paid')).toBe(true);
  });

  it('treats a missing payment status as unpaid', () => {
    // Defaulting the other way would show "confirmed" for something nobody has
    // paid for, which is the more damaging mistake.
    expect(isPaid(null)).toBe(false);
    expect(isPaid(undefined)).toBe(false);
    expect(isPaid('')).toBe(false);
  });
});

describe('isPast', () => {
  it('is false for something happening today', () => {
    // An event finishing today is still today's event; calling it completed
    // while the member is standing at it would be wrong.
    expect(isPast('2026-06-15', TODAY)).toBe(false);
  });

  it('is true only once the day has fully passed', () => {
    expect(isPast('2026-06-14', TODAY)).toBe(true);
    expect(isPast('2026-06-16', TODAY)).toBe(false);
  });

  it('ignores the time of day on both sides', () => {
    // Otherwise the answer would depend on the hour the query happened to run.
    expect(isPast('2026-06-15T23:59:00Z', TODAY)).toBe(false);
    expect(isPast('2026-06-14T00:00:01Z', TODAY)).toBe(true);
  });

  it('handles a missing or unparseable date without throwing', () => {
    expect(isPast(null, TODAY)).toBe(false);
    expect(isPast('not a date', TODAY)).toBe(false);
  });
});

describe('deriveActivityStatus', () => {
  it('shows an unpaid future entry as awaiting payment', () => {
    expect(
      deriveActivityStatus({ paymentStatus: 'pending', occursOn: '2026-07-01' }, TODAY)
    ).toBe('awaiting-payment');
  });

  it('shows a paid future entry as confirmed', () => {
    expect(
      deriveActivityStatus({ paymentStatus: 'paid', occursOn: '2026-07-01' }, TODAY)
    ).toBe('confirmed');
  });

  it('shows a past entry as completed', () => {
    expect(
      deriveActivityStatus({ paymentStatus: 'paid', occursOn: '2026-01-01' }, TODAY)
    ).toBe('completed');
  });

  it('prefers cancelled over completed for a cancelled past booking', () => {
    // The member did not attend. Showing "completed" would misrepresent their
    // own history back to them.
    expect(
      deriveActivityStatus(
        { recordStatus: 'cancelled', paymentStatus: 'paid', occursOn: '2026-01-01' },
        TODAY
      )
    ).toBe('cancelled');
  });

  it('prefers cancelled over awaiting payment', () => {
    expect(
      deriveActivityStatus(
        { recordStatus: 'cancelled', paymentStatus: 'pending', occursOn: '2026-07-01' },
        TODAY
      )
    ).toBe('cancelled');
  });

  it('prefers completed over awaiting payment once the date has passed', () => {
    // An unpaid balance on something that has already happened is a debt to
    // settle with the club, not something the member can still act on.
    expect(
      deriveActivityStatus({ paymentStatus: 'pending', occursOn: '2026-01-01' }, TODAY)
    ).toBe('completed');
  });

  it('treats a rejected or refused record as cancelled', () => {
    for (const recordStatus of ['rejected', 'refused']) {
      expect(deriveActivityStatus({ recordStatus, occursOn: '2026-07-01' }, TODAY)).toBe(
        'cancelled'
      );
    }
  });

  it('falls back to awaiting payment when there is no date at all', () => {
    expect(deriveActivityStatus({ paymentStatus: 'pending' }, TODAY)).toBe(
      'awaiting-payment'
    );
    expect(deriveActivityStatus({ paymentStatus: 'paid' }, TODAY)).toBe('confirmed');
  });

  it('only ever returns one of the four words the screens know', () => {
    const allowed = ['awaiting-payment', 'confirmed', 'completed', 'cancelled'];
    for (const recordStatus of [null, 'confirmed', 'cancelled', 'active', 'weird']) {
      for (const paymentStatus of [null, 'paid', 'pending', 'odd']) {
        for (const occursOn of [null, '2026-01-01', '2026-12-31']) {
          expect(allowed).toContain(
            deriveActivityStatus({ recordStatus, paymentStatus, occursOn }, TODAY)
          );
        }
      }
    }
  });
});

describe('daysUntil', () => {
  it('counts whole days ahead', () => {
    expect(daysUntil('2026-06-25', TODAY)).toBe(10);
  });

  it('is zero on the day itself', () => {
    expect(daysUntil('2026-06-15', TODAY)).toBe(0);
  });

  it('goes negative once passed', () => {
    expect(daysUntil('2026-06-05', TODAY)).toBe(-10);
  });

  it('returns null rather than NaN for a missing date', () => {
    expect(daysUntil(null, TODAY)).toBeNull();
    expect(daysUntil('nonsense', TODAY)).toBeNull();
  });
});

describe('isDueForRenewal', () => {
  it('is due inside the renewal window', () => {
    expect(isDueForRenewal({ status: 'active', validUntil: '2026-07-01' }, TODAY)).toBe(true);
  });

  it('is not due while there is still plenty of time', () => {
    expect(isDueForRenewal({ status: 'active', validUntil: '2026-12-31' }, TODAY)).toBe(false);
  });

  it('is due exactly on the boundary', () => {
    const boundary = new Date(TODAY);
    boundary.setDate(boundary.getDate() + RENEWAL_WINDOW_DAYS);
    expect(isDueForRenewal({ status: 'active', validUntil: boundary }, TODAY)).toBe(true);
  });

  it('still offers renewal to a membership that has just lapsed', () => {
    // A member a week late should be able to rejoin rather than be told to
    // start again from scratch.
    expect(isDueForRenewal({ status: 'active', validUntil: '2026-06-08' }, TODAY)).toBe(true);
  });

  it('does not offer renewal for a cancelled or pending membership', () => {
    expect(isDueForRenewal({ status: 'cancelled', validUntil: '2026-07-01' }, TODAY)).toBe(false);
    expect(isDueForRenewal({ status: 'pending', validUntil: '2026-07-01' }, TODAY)).toBe(false);
  });

  it('does not offer renewal without an expiry date', () => {
    expect(isDueForRenewal({ status: 'active', validUntil: null }, TODAY)).toBe(false);
  });
});
