import {
  AvailableSlot,
  calculateAvailableSlots,
  SlotConfiguration,
  BlockedPeriod,
  ExistingBooking,
  ExistingReservation,
  ExistingHold,
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

/**
 * Soft holds — slots sitting in somebody's basket.
 *
 * The cases that matter are the ones where a hold has to behave like a booking
 * (it takes places, and one of a different length blocks the time entirely)
 * while still being told apart from one: it lapses, and it is worded
 * differently to the member who owns it.
 */
describe('calculateAvailableSlots — basket holds', () => {
  const TODAY = new Date(2026, 7, 1);

  const config = (over: Partial<SlotConfiguration> = {}): SlotConfiguration => ({
    daysOfWeek: [6],
    startTime: '09:00',
    effectiveDateStart: null,
    effectiveDateEnd: null,
    recurrenceWeeks: 1,
    placesAvailable: 1,
    minPlacesRequired: null,
    durationOptions: [{ duration: 60, price: 1000 }],
    ...over,
  });

  const hold = (over: Partial<ExistingHold> = {}): ExistingHold => ({
    slotDate: '2026-08-08',
    startTime: '09:00',
    duration: 60,
    places: 1,
    heldByViewer: false,
    live: true,
    expiresAt: '2026-08-01T10:02:00.000Z',
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

  const at = (slots: ReturnType<typeof run>, startTime: string) =>
    slots.find((slot) => slot.startTime === startTime)!;

  it('leaves slots alone when nothing is held', () => {
    expect(at(run(), '09:00')).toMatchObject({
      available: true,
      unavailableReason: null,
      heldUntil: null,
    });
  });

  it("shows another member's hold as held, not as gone", () => {
    // The whole point: the slot is still listed, with a reason that says it may
    // come back. A member who sees it vanish assumes it was booked.
    expect(at(run({ holds: [hold()] }), '09:00')).toMatchObject({
      available: false,
      unavailableReason: 'held',
    });
  });

  it("never leaks how long somebody else's hold has left", () => {
    expect(at(run({ holds: [hold()] }), '09:00').heldUntil).toBeNull();
  });

  it("calls the member's own hold what it is, and dates it", () => {
    const slot = at(run({ holds: [hold({ heldByViewer: true })] }), '09:00');

    expect(slot.unavailableReason).toBe('in-your-basket');
    expect(slot.heldUntil).toBe('2026-08-01T10:02:00.000Z');
  });

  it('prefers the viewer’s own hold when the slot is held by both', () => {
    // "In your basket" is actionable; "somebody has this" is not, and they
    // cannot add it a second time either way.
    const slot = at(
      run({
        configurations: [config({ placesAvailable: 2 })],
        holds: [hold(), hold({ heldByViewer: true })],
      }),
      '09:00'
    );

    expect(slot.unavailableReason).toBe('in-your-basket');
  });

  it('takes places rather than the whole slot when there is room for more', () => {
    const slot = at(run({ configurations: [config({ placesAvailable: 3 })], holds: [hold()] }), '09:00');

    expect(slot).toMatchObject({ available: true, placesRemaining: 2 });
  });

  it('counts holds against the same cap as bookings', () => {
    const slot = at(
      run({
        configurations: [config({ placesAvailable: 2 })],
        bookings: [
          {
            bookingDate: '2026-08-08',
            startTime: '09:00',
            duration: 60,
            placesBooked: 1,
            bookingStatus: 'confirmed',
          } as ExistingBooking,
        ],
        holds: [hold()],
      }),
      '09:00'
    );

    expect(slot).toMatchObject({ available: false, unavailableReason: 'held', placesRemaining: 0 });
  });

  it('says full, not held, when the bookings alone used the slot up', () => {
    // Nothing is coming back, and "held" would have a member wait for a slot
    // that will never free up.
    const slot = at(
      run({
        bookings: [
          {
            bookingDate: '2026-08-08',
            startTime: '09:00',
            duration: 60,
            placesBooked: 1,
            bookingStatus: 'confirmed',
          } as ExistingBooking,
        ],
      }),
      '09:00'
    );

    expect(slot.unavailableReason).toBe('full');
  });

  it('blocks the time when a hold of a different length lies across it', () => {
    // The same rule bookings follow: a two-hour hold from 09:00 is using the
    // court at 10:00, whatever shape the slot on offer is.
    const slots = run({
      configurations: [config({ durationOptions: [{ duration: 60, price: 1000 }] })],
      holds: [hold({ startTime: '09:30', duration: 120 })],
    });

    expect(at(slots, '10:00').unavailableReason).toBe('held');
    expect(at(slots, '09:00').unavailableReason).toBe('held');
    expect(at(slots, '12:00').available).toBe(true);
  });

  it('ignores holds on other days', () => {
    expect(at(run({ holds: [hold({ slotDate: '2026-08-15' })] }), '09:00').available).toBe(true);
  });

  it("does not let a club official's block be mistaken for a member's basket", () => {
    // A reservation is somebody at the club taking the court out; it is not
    // going to lapse in two minutes, and it is never "in your basket".
    const slot = at(
      run({
        reservations: [{ slotDate: '2026-08-08', startTime: '09:00', duration: 60 }],
        holds: [hold({ heldByViewer: true })],
      }),
      '09:00'
    );

    expect(slot.unavailableReason).toBe('held');
  });

  it('treats a hold with no places recorded as taking one', () => {
    const slot = at(run({ holds: [hold({ places: 0 })] }), '09:00');

    expect(slot.unavailableReason).toBe('held');
  });
});


/**
 * A basket line whose hold has lapsed.
 *
 * The two halves pull apart here, and conflating them is what produced the
 * report: the member had two slots in their basket, the two-minute hold had run
 * out, and the calendar showed them as free — while the add guard, which reads
 * the basket rather than the clock, refused a second copy. The screen
 * contradicted itself.
 *
 * A lapsed hold reserves nothing. The viewer's own lapsed *line* is still in
 * their basket.
 */
describe('calculateAvailableSlots — a hold that has lapsed', () => {
  const TODAY = new Date(2026, 7, 1);

  const config = (over: Partial<SlotConfiguration> = {}): SlotConfiguration => ({
    daysOfWeek: [6],
    startTime: '09:00',
    effectiveDateStart: null,
    effectiveDateEnd: null,
    recurrenceWeeks: 1,
    placesAvailable: 1,
    minPlacesRequired: null,
    durationOptions: [{ duration: 60, price: 1000 }],
    ...over,
  });

  const lapsed = (over: Partial<ExistingHold> = {}): ExistingHold => ({
    slotDate: '2026-08-08',
    startTime: '09:00',
    duration: 60,
    places: 1,
    heldByViewer: false,
    live: false,
    expiresAt: '2026-08-01T09:00:00.000Z',
    ...over,
  });

  /** The same slot, still held. `hold` in the block above is scoped to it. */
  const inForce = (over: Partial<ExistingHold> = {}): ExistingHold =>
    lapsed({ live: true, expiresAt: '2026-08-01T10:02:00.000Z', ...over });

  const run = (holds: ExistingHold[], over: Partial<SlotConfiguration> = {}) =>
    calculateAvailableSlots({
      configurations: [config(over)],
      blockedPeriods: [],
      bookings: [],
      reservations: [],
      holds,
      from: '2026-08-08',
      to: '2026-08-08',
      minDaysInAdvance: 0,
      maxDaysInAdvance: 90,
      today: TODAY,
    }).find((slot) => slot.startTime === '09:00')!;

  it('puts a stranger’s lapsed hold back on sale', () => {
    // The whole point of an expiry: an abandoned basket must not keep a court
    // out of circulation.
    expect(run([lapsed()])).toMatchObject({ available: true, unavailableReason: null });
  });

  it('still shows the viewer their own lapsed line as theirs', () => {
    /*
     * It is in their basket until they remove it or check out, and the add
     * guard refuses a second copy regardless of the clock. Showing it as free
     * is an invitation followed by a refusal.
     */
    expect(run([lapsed({ heldByViewer: true })])).toMatchObject({
      available: false,
      unavailableReason: 'in-your-basket',
    });
  });

  it('does not let the viewer’s lapsed line reserve a place', () => {
    // Their hold is gone. The slot is genuinely available to everybody else,
    // and the count has to say so or the club loses a bookable place.
    expect(run([lapsed({ heldByViewer: true })]).placesRemaining).toBe(1);
  });

  it('lets a stranger take a place the viewer’s lapsed line no longer holds', () => {
    const slot = run(
      [lapsed({ heldByViewer: true }), inForce({ places: 1 })],
      { placesAvailable: 2 }
    );

    // One place taken by the live hold, one still free — the lapsed line takes
    // nothing — but it is still the viewer's own basket line.
    expect(slot.placesRemaining).toBe(1);
    expect(slot.unavailableReason).toBe('in-your-basket');
  });

  it('counts a live hold exactly as before', () => {
    expect(run([inForce()])).toMatchObject({
      available: false,
      unavailableReason: 'held',
      placesRemaining: 0,
    });
  });

  it('treats a hold with no live flag as in force', () => {
    // A caller that predates the distinction keeps the old behaviour rather
    // than silently freeing every slot.
    const { live, ...withoutFlag } = lapsed();
    expect(run([withoutFlag as ExistingHold]).unavailableReason).toBe('held');
  });
});


/**
 * Two slots that cannot both be taken, on a calendar that offers both.
 *
 * A configuration with several duration options produces **overlapping rows by
 * design**: Laois's cross-country schooling offers a three-hour morning and a
 * four-hour extended morning, both from 10:00. They are two ways to book one
 * session, not two sessions.
 *
 * Reported as: picking both added the first and refused the second with "that
 * slot is already in your basket" — about a row the member could see was a
 * different one — while the grid painted both as theirs.
 */
describe('calculateAvailableSlots — a slot that clashes with the basket', () => {
  const TODAY = new Date(2026, 7, 1);

  /** 10:00, offered at three hours and at four. */
  const config = (duration: number): SlotConfiguration => ({
    daysOfWeek: [6],
    startTime: '10:00',
    effectiveDateStart: null,
    effectiveDateEnd: null,
    recurrenceWeeks: 1,
    placesAvailable: 4,
    minPlacesRequired: null,
    durationOptions: [{ duration, price: 3500 }],
  });

  const mine = (duration: number): ExistingHold => ({
    slotDate: '2026-08-08',
    startTime: '10:00',
    duration,
    places: 1,
    heldByViewer: true,
    live: true,
    expiresAt: '2026-08-01T10:03:00.000Z',
  });

  const run = (holds: ExistingHold[]) =>
    calculateAvailableSlots({
      configurations: [config(180), config(240)],
      blockedPeriods: [],
      bookings: [],
      reservations: [],
      holds,
      from: '2026-08-08',
      to: '2026-08-08',
      minDaysInAdvance: 0,
      maxDaysInAdvance: 90,
      today: TODAY,
    });

  const at = (slots: AvailableSlot[], startTime: string, duration: number) =>
    slots.find((slot) => slot.startTime === startTime && slot.duration === duration)!;

  it('calls the one in the basket what it is', () => {
    expect(at(run([mine(180)]), '10:00', 180)).toMatchObject({
      available: false,
      unavailableReason: 'in-your-basket',
    });
  });

  it('calls the overlapping one a clash, not a duplicate', () => {
    // The member can see it is a different row; saying it is "already in your
    // basket" is a statement they know to be false.
    expect(at(run([mine(180)]), '10:00', 240)).toMatchObject({
      available: false,
      unavailableReason: 'clashes-with-basket',
    });
  });

  it('gives the clashing row no countdown of its own', () => {
    // A countdown implies it frees up when the clock runs out, which is not
    // what it is waiting on — it waits on the basket line being removed.
    expect(at(run([mine(180)]), '10:00', 240).heldUntil).toBeNull();
    expect(at(run([mine(180)]), '10:00', 180).heldUntil).not.toBeNull();
  });

  it('leaves a session that merely abuts alone', () => {
    // 13:00 starts exactly where the three-hour morning ends. Touching is not
    // overlapping, and a member may well want both.
    expect(at(run([mine(180)]), '13:00', 180)).toMatchObject({
      available: true,
      unavailableReason: null,
    });
  });

  it('is about the viewer, not about anybody else', () => {
    /*
     * A stranger's overlapping hold still blocks the row — the resource is in
     * use, which is the same rule a confirmed booking of a different length
     * follows. What must not happen is calling it a *clash with your basket*,
     * which would send the member looking for something they never added.
     */
    const someoneElse = { ...mine(180), heldByViewer: false };

    expect(at(run([someoneElse]), '10:00', 240).unavailableReason).toBe('held');
  });
});
