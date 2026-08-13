import { decideCancellation, CancellableBooking, CancellationPolicy } from '../booking-cancellation';

/**
 * The club's cancellation policy, as it applies to a member cancelling their
 * own booking.
 *
 * The server's copy of a rule the org-admin app also checks in the browser. The
 * cases that matter are the boundaries — exactly the notice required, the day
 * itself, and a booking already past — and the fact that **nothing here moves
 * money**: `refundExpected` says what the club's policy implies, not what has
 * happened.
 */
describe('decideCancellation', () => {
  const TODAY = new Date(2026, 7, 12);

  const booking = (over: Partial<CancellableBooking> = {}): CancellableBooking => ({
    bookingStatus: 'confirmed',
    paymentStatus: 'paid',
    bookingDate: '2026-08-20',
    refundProcessed: false,
    ...over,
  });

  const policy = (over: Partial<CancellationPolicy> = {}): CancellationPolicy => ({
    allowCancellations: true,
    cancelDaysInAdvance: 2,
    refundPaymentAutomatically: false,
    ...over,
  });

  it('allows a cancellation well inside the notice period', () => {
    expect(decideCancellation(booking(), policy(), TODAY)).toMatchObject({
      canCancel: true,
      reason: null,
      daysUntil: 8,
      noticeDays: 2,
    });
  });

  it('refuses when the club does not allow cancellations at all', () => {
    expect(
      decideCancellation(booking(), policy({ allowCancellations: false }), TODAY)
    ).toMatchObject({ canCancel: false, reason: 'not-allowed' });
  });

  it('refuses one already cancelled', () => {
    expect(
      decideCancellation(booking({ bookingStatus: 'cancelled' }), policy(), TODAY)
    ).toMatchObject({ canCancel: false, reason: 'already-cancelled' });
  });

  /** Already cancelled beats every other reason — it is the plainest answer. */
  it('says already cancelled even when the club forbids cancelling', () => {
    expect(
      decideCancellation(
        booking({ bookingStatus: 'cancelled' }),
        policy({ allowCancellations: false }),
        TODAY
      ).reason
    ).toBe('already-cancelled');
  });

  describe('notice', () => {
    it('allows a booking exactly the required notice away', () => {
      expect(
        decideCancellation(booking({ bookingDate: '2026-08-14' }), policy(), TODAY).canCancel
      ).toBe(true);
    });

    it('refuses a booking one day inside the notice', () => {
      expect(
        decideCancellation(booking({ bookingDate: '2026-08-13' }), policy(), TODAY)
      ).toMatchObject({ canCancel: false, reason: 'too-late', daysUntil: 1 });
    });

    /** Zero notice means up to the day itself, not "never". */
    it('allows same-day cancellation when the club asks for no notice', () => {
      expect(
        decideCancellation(
          booking({ bookingDate: '2026-08-12' }),
          policy({ cancelDaysInAdvance: 0 }),
          TODAY
        ).canCancel
      ).toBe(true);
    });

    it('treats a missing notice setting as none required', () => {
      expect(
        decideCancellation(
          booking({ bookingDate: '2026-08-12' }),
          policy({ cancelDaysInAdvance: null }),
          TODAY
        ).canCancel
      ).toBe(true);
    });

    /**
     * "Cancellations need two days' notice" is an odd thing to read about last
     * Tuesday, so a past booking gets its own reason.
     */
    it('refuses a booking that has already happened, as passed rather than late', () => {
      expect(
        decideCancellation(booking({ bookingDate: '2026-08-01' }), policy(), TODAY)
      ).toMatchObject({ canCancel: false, reason: 'already-passed', daysUntil: -11 });
    });
  });

  describe('what happens to the money', () => {
    it('expects a refund when the club refunds automatically and the booking is paid', () => {
      expect(
        decideCancellation(booking(), policy({ refundPaymentAutomatically: true }), TODAY)
          .refundExpected
      ).toBe(true);
    });

    it('expects none when the club does not refund automatically', () => {
      expect(decideCancellation(booking(), policy(), TODAY).refundExpected).toBe(false);
    });

    it('expects none on a booking that was never paid', () => {
      expect(
        decideCancellation(
          booking({ paymentStatus: 'pending' }),
          policy({ refundPaymentAutomatically: true }),
          TODAY
        ).refundExpected
      ).toBe(false);
    });

    it('expects none when a refund has already been made', () => {
      expect(
        decideCancellation(
          booking({ refundProcessed: true }),
          policy({ refundPaymentAutomatically: true }),
          TODAY
        ).refundExpected
      ).toBe(false);
    });

    /** The screen says what *would* happen, so this is answered either way. */
    it('still says whether a refund would be due when cancelling is refused', () => {
      expect(
        decideCancellation(
          booking({ bookingDate: '2026-08-13' }),
          policy({ refundPaymentAutomatically: true }),
          TODAY
        )
      ).toMatchObject({ canCancel: false, refundExpected: true });
    });
  });

  it('reads a booking date that arrives as a Date', () => {
    expect(
      decideCancellation(booking({ bookingDate: new Date(2026, 7, 20) }), policy(), TODAY)
        .daysUntil
    ).toBe(8);
  });
});
