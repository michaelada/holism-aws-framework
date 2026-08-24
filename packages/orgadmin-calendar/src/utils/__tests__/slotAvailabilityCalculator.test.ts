import { describe, it, expect } from 'vitest';
import { calculateAvailableSlots } from '../slotAvailabilityCalculator';
import type {
  TimeSlotConfiguration,
  BlockedPeriod,
  Booking,
  SlotReservation,
  DurationOption,
} from '../../types/calendar.types';

/**
 * The arithmetic that decides whether a club can take a booking.
 *
 * This is the one place in the calendar module where being wrong costs money in
 * both directions: a slot wrongly offered is a double booking the club has to
 * apologise for, and a slot wrongly withheld is a booking it never took. None
 * of it is visible from the screen — by the time a slot reaches the page the
 * decision has already been made here — so it is tested at the function.
 *
 * Dates are anchored relative to *today* because `applyBookingWindow` reads the
 * clock. Fixing a calendar date would make these tests pass until the day they
 * silently stopped meaning anything.
 */

const DAY = 24 * 60 * 60 * 1000;

/** A date N days from now, at midnight, so it lands inside the booking window. */
const daysFromNow = (n: number): Date => {
  const d = new Date(Date.now() + n * DAY);
  d.setHours(0, 0, 0, 0);
  return d;
};

const duration = (mins: number, price = 0): DurationOption => ({
  id: `dur-${mins}`,
  timeSlotConfigurationId: 'cfg-1',
  duration: mins,
  price,
  label: `${mins} minutes`,
  order: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const configuration = (over: Partial<TimeSlotConfiguration> = {}): TimeSlotConfiguration => ({
  id: 'cfg-1',
  calendarId: 'cal-1',
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  startTime: '09:00',
  effectiveDateStart: daysFromNow(-30),
  recurrenceWeeks: 1,
  placesAvailable: 1,
  durationOptions: [duration(60)],
  order: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const booking = (over: Partial<Booking> = {}): Booking =>
  ({
    id: 'bk-1',
    bookingReference: 'BK-1',
    calendarId: 'cal-1',
    userId: 'user-1',
    bookingDate: daysFromNow(1),
    startTime: '09:00',
    duration: 60,
    endTime: '10:00',
    placesBooked: 1,
    pricePerPlace: 0,
    totalPrice: 0,
    bookingStatus: 'confirmed',
    paymentStatus: 'paid',
    ...over,
  }) as Booking;

const reservation = (over: Partial<SlotReservation> = {}): SlotReservation => ({
  id: 'res-1',
  calendarId: 'cal-1',
  reservedBy: 'admin-1',
  slotDate: ymd(daysFromNow(1)),
  startTime: '09:00',
  duration: 60,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/** Slots for one day, a week out, with a generous booking window. */
const slotsFor = (
  configs: TimeSlotConfiguration[],
  {
    blocked = [] as BlockedPeriod[],
    bookings = [] as Booking[],
    reservations = [] as SlotReservation[],
    from = daysFromNow(7),
    to = daysFromNow(7),
    minDays = 0,
    maxDays = 90,
  } = {}
) => calculateAvailableSlots(configs, blocked, bookings, from, to, minDays, maxDays, reservations);

describe('calculateAvailableSlots — generating the day', () => {
  it('runs slots from the start time to the end of the day', () => {
    const slots = slotsFor([configuration({ startTime: '09:00', durationOptions: [duration(60)] })]);

    // 09:00 through 23:00 inclusive — the last slot that still ends by midnight.
    expect(slots).toHaveLength(15);
    expect(slots[0].startTime).toBe('09:00');
    expect(slots[0].endTime).toBe('10:00');
    expect(slots[slots.length - 1].startTime).toBe('23:00');
    expect(slots[slots.length - 1].endTime).toBe('00:00');
  });

  it('never offers a slot that would run past midnight', () => {
    const slots = slotsFor([
      configuration({ startTime: '23:30', durationOptions: [duration(60)] }),
    ]);

    expect(slots).toHaveLength(0);
  });

  it('offers each duration option as its own ladder of slots', () => {
    const slots = slotsFor([
      configuration({ startTime: '22:00', durationOptions: [duration(30, 10), duration(60, 18)] }),
    ]);

    const halfHours = slots.filter((s) => s.duration === 30);
    const hours = slots.filter((s) => s.duration === 60);

    expect(halfHours.map((s) => s.startTime)).toEqual([
      '22:00',
      '22:30',
      '23:00',
      '23:30',
    ]);
    expect(hours.map((s) => s.startTime)).toEqual(['22:00', '23:00']);

    // The price travels with the duration the member picked, not the slot time.
    expect(halfHours[0].price).toBe(10);
    expect(hours[0].price).toBe(18);
  });

  it('falls back to hourly slots when a configuration has no durations at all', () => {
    const slots = slotsFor([configuration({ startTime: '22:00', durationOptions: [] })]);

    expect(slots.map((s) => s.startTime)).toEqual(['22:00', '23:00']);
    expect(slots.every((s) => s.duration === 60)).toBe(true);
  });

  it('only opens the days of the week the configuration names', () => {
    const from = daysFromNow(7);
    const to = new Date(from.getTime() + 6 * DAY);
    const openOn = (from.getDay() + 2) % 7;

    const slots = calculateAvailableSlots(
      [configuration({ daysOfWeek: [openOn], startTime: '23:00' })],
      [],
      [],
      from,
      to,
      0,
      90
    );

    expect(slots).toHaveLength(1);
    expect(slots[0].date.getDay()).toBe(openOn);
  });

  it('closes before the configuration starts and after it ends', () => {
    const target = daysFromNow(7);

    const notYet = calculateAvailableSlots(
      [configuration({ startTime: '23:00', effectiveDateStart: daysFromNow(10) })],
      [], [], target, target, 0, 90
    );
    const finished = calculateAvailableSlots(
      [configuration({ startTime: '23:00', effectiveDateEnd: daysFromNow(3) })],
      [], [], target, target, 0, 90
    );

    expect(notYet).toHaveLength(0);
    expect(finished).toHaveLength(0);
  });

  it('honours a fortnightly recurrence, counting from the week it became effective', () => {
    const effectiveStart = daysFromNow(-14);
    const config = configuration({
      startTime: '23:00',
      effectiveDateStart: effectiveStart,
      recurrenceWeeks: 2,
    });

    // Two weeks on from the effective week is an "on" week; one week on is not.
    const onWeek = calculateAvailableSlots(
      [config], [], [],
      new Date(effectiveStart.getTime() + 14 * DAY),
      new Date(effectiveStart.getTime() + 14 * DAY),
      0, 90
    );
    const offWeek = calculateAvailableSlots(
      [config], [], [],
      new Date(effectiveStart.getTime() + 21 * DAY),
      new Date(effectiveStart.getTime() + 21 * DAY),
      0, 90
    );

    expect(onWeek).toHaveLength(1);
    expect(offWeek).toHaveLength(0);
  });
});

describe('calculateAvailableSlots — blocked periods', () => {
  it('removes every slot inside a blocked date range', () => {
    const blocked: BlockedPeriod = {
      id: 'blk-1',
      calendarId: 'cal-1',
      blockType: 'date_range',
      startDate: daysFromNow(6),
      endDate: daysFromNow(8),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(slotsFor([configuration({ startTime: '23:00' })], { blocked: [blocked] })).toHaveLength(0);
  });

  it('leaves the days either side of a blocked range alone', () => {
    const blocked: BlockedPeriod = {
      id: 'blk-1',
      calendarId: 'cal-1',
      blockType: 'date_range',
      startDate: daysFromNow(20),
      endDate: daysFromNow(21),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(slotsFor([configuration({ startTime: '23:00' })], { blocked: [blocked] })).toHaveLength(1);
  });

  it('removes only the slots inside a blocked time segment', () => {
    const target = daysFromNow(7);
    const blocked: BlockedPeriod = {
      id: 'blk-1',
      calendarId: 'cal-1',
      blockType: 'time_segment',
      daysOfWeek: [target.getDay()],
      startTime: '12:00',
      endTime: '14:00',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const slots = slotsFor([configuration({ startTime: '11:00' })], { blocked: [blocked] });
    const times = slots.map((s) => s.startTime);

    expect(times).toContain('11:00');
    expect(times).not.toContain('12:00');
    expect(times).not.toContain('13:00');
    expect(times).toContain('14:00');
  });

  /*
   * A club closing "18:00 to midnight" writes the end as 00:00, which is a
   * smaller number than the start. Read literally that range is empty and the
   * evening stays bookable — so the wrap has to be handled deliberately.
   */
  it('treats a time segment ending at midnight as running to the end of the day', () => {
    const target = daysFromNow(7);
    const blocked: BlockedPeriod = {
      id: 'blk-1',
      calendarId: 'cal-1',
      blockType: 'time_segment',
      daysOfWeek: [target.getDay()],
      startTime: '18:00',
      endTime: '00:00',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const times = slotsFor([configuration({ startTime: '17:00' })], { blocked: [blocked] }).map(
      (s) => s.startTime
    );

    expect(times).toEqual(['17:00']);
  });

  it('ignores a time segment blocked on a different day of the week', () => {
    const target = daysFromNow(7);
    const blocked: BlockedPeriod = {
      id: 'blk-1',
      calendarId: 'cal-1',
      blockType: 'time_segment',
      daysOfWeek: [(target.getDay() + 1) % 7],
      startTime: '00:00',
      endTime: '23:59',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(slotsFor([configuration({ startTime: '23:00' })], { blocked: [blocked] })).toHaveLength(1);
  });
});

describe('calculateAvailableSlots — the booking window', () => {
  it('withholds a slot that is sooner than the notice the club requires', () => {
    const tomorrow = daysFromNow(1);

    const slots = calculateAvailableSlots(
      [configuration({ startTime: '23:00' })],
      [], [], tomorrow, tomorrow,
      7, // a week's notice
      90
    );

    expect(slots).toHaveLength(1);
    expect(slots[0].isAvailable).toBe(false);
  });

  it('withholds a slot beyond the furthest the club will take bookings', () => {
    const farOff = daysFromNow(60);

    const slots = calculateAvailableSlots(
      [configuration({ startTime: '23:00' })],
      [], [], farOff, farOff,
      0,
      30
    );

    expect(slots).toHaveLength(1);
    expect(slots[0].isAvailable).toBe(false);
  });

  /*
   * Withheld, not removed. The slot still has to reach the screen so the member
   * can see the club is open then and simply not bookable yet; dropping it
   * makes an open day look closed.
   */
  it('keeps the slot in the list so it can be shown as unavailable', () => {
    const tomorrow = daysFromNow(1);

    const slots = calculateAvailableSlots(
      [configuration({ startTime: '23:00' })],
      [], [], tomorrow, tomorrow, 7, 90
    );

    expect(slots[0].startTime).toBe('23:00');
    expect(slots[0].isBlocked).toBe(false);
  });
});

describe('calculateAvailableSlots — places and double booking', () => {
  const target = () => daysFromNow(7);

  it('counts confirmed bookings against the places on the slot', () => {
    const day = target();
    const slots = slotsFor([configuration({ startTime: '23:00', placesAvailable: 4 })], {
      bookings: [
        booking({ bookingDate: day, startTime: '23:00', placesBooked: 3 }),
      ],
      from: day,
      to: day,
    });

    expect(slots[0].placesBooked).toBe(3);
    expect(slots[0].placesRemaining).toBe(1);
    expect(slots[0].isFull).toBe(false);
    expect(slots[0].isAvailable).toBe(true);
  });

  it('closes the slot once its last place goes', () => {
    const day = target();
    const slots = slotsFor([configuration({ startTime: '23:00', placesAvailable: 2 })], {
      bookings: [
        booking({ id: 'a', bookingDate: day, startTime: '23:00', placesBooked: 1 }),
        booking({ id: 'b', bookingDate: day, startTime: '23:00', placesBooked: 1 }),
      ],
      from: day,
      to: day,
    });

    expect(slots[0].placesRemaining).toBe(0);
    expect(slots[0].isFull).toBe(true);
    expect(slots[0].isAvailable).toBe(false);
  });

  it('gives a cancelled booking its place back', () => {
    const day = target();
    const slots = slotsFor([configuration({ startTime: '23:00', placesAvailable: 1 })], {
      bookings: [
        booking({ bookingDate: day, startTime: '23:00', bookingStatus: 'cancelled' as never }),
      ],
      from: day,
      to: day,
    });

    expect(slots[0].placesBooked).toBe(0);
    expect(slots[0].isAvailable).toBe(true);
  });

  /*
   * The double-booking case. An hour booked at 22:00 covers the half-hours at
   * 22:00 and 22:30; neither is an exact match for the booking, so without an
   * overlap check both stay on sale and the court is let twice.
   */
  it('closes the shorter slots underneath a longer booking', () => {
    const day = target();
    const slots = slotsFor(
      [configuration({ startTime: '22:00', durationOptions: [duration(30), duration(60)] })],
      {
        bookings: [booking({ bookingDate: day, startTime: '22:00', duration: 60 })],
        from: day,
        to: day,
      }
    );

    const halfHours = slots.filter((s) => s.duration === 30);
    const at2200 = halfHours.find((s) => s.startTime === '22:00');
    const at2230 = halfHours.find((s) => s.startTime === '22:30');
    const at2300 = halfHours.find((s) => s.startTime === '23:00');

    expect(at2200?.isBookedByOverlap).toBe(true);
    expect(at2200?.isAvailable).toBe(false);
    expect(at2230?.isBookedByOverlap).toBe(true);
    expect(at2230?.isAvailable).toBe(false);

    // The half hour after the booking ends is still for sale.
    expect(at2300?.isBookedByOverlap).toBe(false);
    expect(at2300?.isAvailable).toBe(true);
  });

  it('does not treat a booking as overlapping the very slot it belongs to', () => {
    const day = target();
    const slots = slotsFor([configuration({ startTime: '23:00', placesAvailable: 2 })], {
      bookings: [booking({ bookingDate: day, startTime: '23:00', duration: 60 })],
      from: day,
      to: day,
    });

    expect(slots[0].isBookedByOverlap).toBe(false);
    expect(slots[0].isAvailable).toBe(true);
    expect(slots[0].bookings).toHaveLength(1);
  });

  /*
   * The API answers with `"09:00:00"` and `"2026-03-24T00:00:00.000Z"`, while
   * the slots are built from `Date` objects and `"09:00"`. Compared raw, a
   * booking never matches its own slot and every booked slot goes back on sale.
   */
  it('matches a booking whose time and date arrive in the API’s format', () => {
    const day = target();
    const slots = slotsFor([configuration({ startTime: '23:00', placesAvailable: 1 })], {
      bookings: [
        booking({
          bookingDate: `${ymd(day)}T00:00:00.000Z` as never,
          startTime: '23:00:00',
          duration: 60,
        }),
      ],
      from: day,
      to: day,
    });

    expect(slots[0].placesBooked).toBe(1);
    expect(slots[0].isFull).toBe(true);
  });
});

describe('calculateAvailableSlots — slots an administrator has held back', () => {
  const target = () => daysFromNow(7);

  it('marks the exact slot reserved and takes it off sale', () => {
    const day = target();
    const slots = slotsFor([configuration({ startTime: '23:00' })], {
      reservations: [reservation({ slotDate: ymd(day), startTime: '23:00', duration: 60 })],
      from: day,
      to: day,
    });

    expect(slots[0].isReserved).toBe(true);
    expect(slots[0].isExactReservation).toBe(true);
    expect(slots[0].isAvailable).toBe(false);
    expect(slots[0].reservation?.id).toBe('res-1');
  });

  it('holds back the shorter slots a longer reservation covers, without calling them exact', () => {
    const day = target();
    const slots = slotsFor(
      [configuration({ startTime: '22:00', durationOptions: [duration(30), duration(60)] })],
      {
        reservations: [reservation({ slotDate: ymd(day), startTime: '22:00', duration: 60 })],
        from: day,
        to: day,
      }
    );

    const at2230 = slots.find((s) => s.duration === 30 && s.startTime === '22:30');

    expect(at2230?.isReserved).toBe(true);
    expect(at2230?.isExactReservation).toBe(false);
    expect(at2230?.isAvailable).toBe(false);
  });

  it('holds back a slot a reservation only clips', () => {
    const day = target();
    const slots = slotsFor(
      [configuration({ startTime: '22:00', durationOptions: [duration(60)] })],
      {
        // 22:30–23:00 clips the second half of the 22:00 hour.
        reservations: [reservation({ slotDate: ymd(day), startTime: '22:30', duration: 30 })],
        from: day,
        to: day,
      }
    );

    const at2200 = slots.find((s) => s.startTime === '22:00');

    expect(at2200?.isReserved).toBe(true);
    expect(at2200?.isExactReservation).toBe(false);
    expect(at2200?.isAvailable).toBe(false);
  });

  it('leaves slots on another date alone', () => {
    const day = target();
    const slots = slotsFor([configuration({ startTime: '23:00' })], {
      reservations: [reservation({ slotDate: ymd(daysFromNow(8)), startTime: '23:00' })],
      from: day,
      to: day,
    });

    expect(slots[0].isReserved).toBe(false);
    expect(slots[0].isAvailable).toBe(true);
  });
});

describe('calculateAvailableSlots — several configurations at once', () => {
  it('offers the slots from every configuration on the calendar', () => {
    const day = daysFromNow(7);
    const morning = configuration({ id: 'cfg-am', startTime: '23:00' });
    const evening = configuration({
      id: 'cfg-pm',
      startTime: '23:30',
      durationOptions: [duration(30)],
    });

    const slots = calculateAvailableSlots([morning, evening], [], [], day, day, 0, 90);

    expect(slots.map((s) => `${s.startTime}/${s.duration}`).sort()).toEqual([
      '23:00/60',
      '23:30/30',
    ]);
  });

  it('returns nothing when the calendar has no configurations', () => {
    const day = daysFromNow(7);
    expect(calculateAvailableSlots([], [], [], day, day, 0, 90)).toEqual([]);
  });
});
