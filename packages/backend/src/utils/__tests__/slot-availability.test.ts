import {
  calculateAvailableSlots,
  SlotConfiguration,
  BlockedPeriod,
  ExistingBooking,
  ExistingReservation,
} from '../slot-availability';

/**
 * The rules that decide whether a member may book a slot.
 *
 * This is the server's copy of an algorithm the org-admin app also implements
 * in the browser. The two must agree, so the cases here are the ones where a
 * naive implementation drifts: recurrence, effective dates, blocks that wrap
 * past midnight, and — the one that matters most — a booking of a *different
 * length* lying across a slot.
 */
describe('calculateAvailableSlots', () => {
  // A Saturday, so day-of-week arithmetic is visible in the fixtures.
  const TODAY = new Date(2026, 7, 1);

  const config = (over: Partial<SlotConfiguration> = {}): SlotConfiguration => ({
    daysOfWeek: [6],
    startTime: '09:00',
    effectiveDateStart: null,
    effectiveDateEnd: null,
    recurrenceWeeks: 1,
    placesAvailable: 2,
    minPlacesRequired: null,
    durationOptions: [{ duration: 60, price: 1000 }],
    ...over,
  });

  const run = (over: Partial<Parameters<typeof calculateAvailableSlots>[0]> = {}) =>
    calculateAvailableSlots({
      configurations: [config()],
      blockedPeriods: [],
      bookings: [],
      reservations: [],
      from: '2026-08-08',
      to: '2026-08-08',
      minDaysInAdvance: 0,
      maxDaysInAdvance: 90,
      today: TODAY,
      ...over,
    });

  describe('generating slots', () => {
    it('produces a series from the start time, stepping by the duration', () => {
      const slots = run();

      expect(slots[0]).toMatchObject({
        date: '2026-08-08',
        startTime: '09:00',
        endTime: '10:00',
        duration: 60,
        price: 1000,
      });
      expect(slots[1].startTime).toBe('10:00');
      // 09:00 to midnight, in hours.
      expect(slots).toHaveLength(15);
    });

    it('offers each duration option as its own series', () => {
      const slots = run({
        configurations: [
          config({
            startTime: '09:00',
            durationOptions: [
              { duration: 30, price: 600 },
              { duration: 60, price: 1000 },
            ],
          }),
        ],
      });

      const atNine = slots.filter((slot) => slot.startTime === '09:00');
      expect(atNine.map((slot) => slot.duration).sort()).toEqual([30, 60]);
      expect(atNine.find((slot) => slot.duration === 30)?.price).toBe(600);
    });

    it('only produces slots on the days the club named', () => {
      const slots = run({ from: '2026-08-03', to: '2026-08-09' });

      // The 8th is the only Saturday in that week.
      expect([...new Set(slots.map((slot) => slot.date))]).toEqual(['2026-08-08']);
    });

    it('stops at the end of the day rather than running past midnight', () => {
      const slots = run({
        configurations: [config({ startTime: '23:00', durationOptions: [{ duration: 90, price: 0 }] })],
      });

      expect(slots).toHaveLength(0);
    });

    it('gives a configuration with no durations an hour', () => {
      const slots = run({ configurations: [config({ durationOptions: [] })] });

      expect(slots[0]).toMatchObject({ duration: 60, price: 0 });
    });

    it('produces one slot when two configurations describe the same time', () => {
      const slots = run({ configurations: [config(), config()] });

      expect(slots.filter((slot) => slot.startTime === '09:00')).toHaveLength(1);
    });
  });

  describe('effective dates and recurrence', () => {
    it('ignores a day before the configuration takes effect', () => {
      const slots = run({
        configurations: [config({ effectiveDateStart: '2026-08-15' })],
      });

      expect(slots).toHaveLength(0);
    });

    it('ignores a day after it lapses', () => {
      const slots = run({ configurations: [config({ effectiveDateEnd: '2026-08-01' })] });

      expect(slots).toHaveLength(0);
    });

    /** Every other Saturday: the 8th is on, the 15th is not. */
    it('honours a fortnightly recurrence from the effective start', () => {
      const fortnightly = config({ recurrenceWeeks: 2, effectiveDateStart: '2026-08-08' });

      expect(
        run({ configurations: [fortnightly], from: '2026-08-08', to: '2026-08-08' }).length
      ).toBeGreaterThan(0);
      expect(
        run({ configurations: [fortnightly], from: '2026-08-15', to: '2026-08-15' })
      ).toHaveLength(0);
      expect(
        run({ configurations: [fortnightly], from: '2026-08-22', to: '2026-08-22' }).length
      ).toBeGreaterThan(0);
    });
  });

  describe('blocked periods', () => {
    const dateRange = (start: string, end: string): BlockedPeriod => ({
      blockType: 'date_range',
      startDate: start,
      endDate: end,
      daysOfWeek: null,
      startTime: null,
      endTime: null,
    });

    const timeSegment = (startTime: string, endTime: string): BlockedPeriod => ({
      blockType: 'time_segment',
      startDate: null,
      endDate: null,
      daysOfWeek: [6],
      startTime,
      endTime,
    });

    it('removes a day inside a maintenance range', () => {
      expect(run({ blockedPeriods: [dateRange('2026-08-07', '2026-08-09')] })).toHaveLength(0);
    });

    it('leaves days outside it alone', () => {
      expect(run({ blockedPeriods: [dateRange('2026-08-01', '2026-08-07')] }).length).toBeGreaterThan(
        0
      );
    });

    it('removes the times inside a recurring closure', () => {
      const slots = run({ blockedPeriods: [timeSegment('09:00', '12:00')] });

      expect(slots.map((slot) => slot.startTime)).not.toContain('09:00');
      expect(slots.map((slot) => slot.startTime)).toContain('12:00');
    });

    /** 18:00 → 00:00 means "from six", not "no time at all". */
    it('reads a closure that wraps past midnight as running to the end of the day', () => {
      const slots = run({ blockedPeriods: [timeSegment('18:00', '00:00')] });

      expect(slots.map((slot) => slot.startTime)).toContain('17:00');
      expect(slots.map((slot) => slot.startTime)).not.toContain('18:00');
      expect(slots.map((slot) => slot.startTime)).not.toContain('23:00');
    });

    it('ignores a closure on another day of the week', () => {
      const slots = run({
        blockedPeriods: [{ ...timeSegment('09:00', '12:00'), daysOfWeek: [0] }],
      });

      expect(slots.map((slot) => slot.startTime)).toContain('09:00');
    });
  });

  describe('the booking window', () => {
    it('offers nothing before the club’s notice period', () => {
      // The 8th is seven days out; the club wants fourteen.
      expect(run({ minDaysInAdvance: 14 })).toHaveLength(0);
    });

    it('offers nothing beyond how far ahead the club takes bookings', () => {
      expect(run({ maxDaysInAdvance: 3 })).toHaveLength(0);
    });

    it('offers the day when it falls inside the window', () => {
      expect(run({ minDaysInAdvance: 1, maxDaysInAdvance: 30 }).length).toBeGreaterThan(0);
    });
  });

  describe('what is already taken', () => {
    const booking = (over: Partial<ExistingBooking> = {}): ExistingBooking => ({
      bookingDate: '2026-08-08',
      startTime: '09:00',
      duration: 60,
      placesBooked: 1,
      bookingStatus: 'confirmed',
      ...over,
    });

    it('counts a booking against the places on the slot', () => {
      const [nine] = run({ bookings: [booking()] });

      expect(nine).toMatchObject({
        startTime: '09:00',
        placesBooked: 1,
        placesRemaining: 1,
        available: true,
      });
    });

    it('closes the slot when the last place goes', () => {
      const [nine] = run({ bookings: [booking({ placesBooked: 2 })] });

      expect(nine).toMatchObject({ placesRemaining: 0, available: false, unavailableReason: 'full' });
    });

    it('ignores a cancelled booking', () => {
      const [nine] = run({ bookings: [booking({ placesBooked: 2, bookingStatus: 'cancelled' })] });

      expect(nine.available).toBe(true);
    });

    /**
     * The case a naive implementation gets wrong: an hour booked at 09:00 also
     * takes the two half-hours inside it, because the court is in use.
     */
    it('takes out the shorter slots an overlapping booking covers', () => {
      const slots = run({
        configurations: [
          config({
            durationOptions: [
              { duration: 30, price: 600 },
              { duration: 60, price: 1000 },
            ],
          }),
        ],
        bookings: [booking({ duration: 60, placesBooked: 1 })],
      });

      const halfNine = slots.find((slot) => slot.startTime === '09:30' && slot.duration === 30);
      expect(halfNine).toMatchObject({ available: false, unavailableReason: 'in-use' });

      // The exact slot is still a place-count question, not an overlap one.
      const nineHour = slots.find((slot) => slot.startTime === '09:00' && slot.duration === 60);
      expect(nineHour).toMatchObject({ available: true, placesRemaining: 1 });
    });

    it('leaves a slot after the booking ends alone', () => {
      const slots = run({ bookings: [booking()] });

      expect(slots.find((slot) => slot.startTime === '10:00')?.available).toBe(true);
    });

    it('ignores a booking on another date', () => {
      const [nine] = run({ bookings: [booking({ bookingDate: '2026-08-15', placesBooked: 2 })] });

      expect(nine.available).toBe(true);
    });

    it('reads a time that arrives with seconds', () => {
      const [nine] = run({ bookings: [booking({ startTime: '09:00:00', placesBooked: 2 })] });

      expect(nine.available).toBe(false);
    });

    it('reads a date that arrives as a Date', () => {
      const [nine] = run({
        bookings: [booking({ bookingDate: new Date(2026, 7, 8) as never, placesBooked: 2 })],
      });

      expect(nine.available).toBe(false);
    });
  });

  describe('slots somebody else is holding', () => {
    const reservation = (over: Partial<ExistingReservation> = {}): ExistingReservation => ({
      slotDate: '2026-08-08',
      startTime: '09:00',
      duration: 60,
      ...over,
    });

    it('closes a held slot, and says it is held rather than full', () => {
      const [nine] = run({ reservations: [reservation()] });

      expect(nine).toMatchObject({ available: false, unavailableReason: 'held' });
    });

    it('closes the slots a hold overlaps', () => {
      const slots = run({
        configurations: [config({ durationOptions: [{ duration: 30, price: 600 }] })],
        reservations: [reservation({ duration: 60 })],
      });

      expect(slots.find((slot) => slot.startTime === '09:30')?.unavailableReason).toBe('held');
      expect(slots.find((slot) => slot.startTime === '10:00')?.available).toBe(true);
    });
  });

  it('returns slots in the order a member reads them', () => {
    const slots = run({
      from: '2026-08-08',
      to: '2026-08-15',
      configurations: [
        config({
          daysOfWeek: [6],
          durationOptions: [
            { duration: 60, price: 1000 },
            { duration: 30, price: 600 },
          ],
        }),
      ],
    });

    const keys = slots.map((slot) => `${slot.date} ${slot.startTime} ${slot.duration}`);
    expect(keys).toEqual([...keys].sort());
  });
});
