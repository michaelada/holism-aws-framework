import { AccountCatalogueService } from '../account-catalogue.service';
import { db } from '../../database/pool';
import { ValidationError, NotFoundError } from '../../middleware/errors';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

/**
 * Calendars and their availability, as a member sees them (D11–D13).
 *
 * The arithmetic lives in `utils/slot-availability` and is tested there. What
 * this pins down is the part that belongs to the service: which calendars a
 * member may book against at all, and — the one that matters — that
 * `assertSlotAvailable` refuses a slot that has gone, because that is the only
 * thing standing between two members and the same court.
 */
describe('AccountCatalogueService — calendars', () => {
  const mockDb = db as jest.Mocked<typeof db>;
  const ORG = 'org-1';
  const CALENDAR = 'cal-1';
  // A Saturday.
  const TODAY = new Date(2026, 7, 1);
  const SATURDAY = '2026-08-08';

  const calendarRow = (over: Record<string, unknown> = {}) => ({
    id: CALENDAR,
    name: 'Tennis court 1',
    description: 'All-weather',
    display_colour: '#336699',
    status: 'open',
    min_days_in_advance: 0,
    max_days_in_advance: 90,
    use_terms_and_conditions: false,
    terms_and_conditions: null,
    supported_payment_methods: ['pm-card'],
    allow_cancellations: true,
    cancel_days_in_advance: 2,
    configuration_count: 1,
    ...over,
  });

  const configurationRow = (over: Record<string, unknown> = {}) => ({
    id: 'tsc-1',
    days_of_week: [6],
    start_time: '09:00:00',
    effective_date_start: null,
    effective_date_end: null,
    recurrence_weeks: 1,
    places_available: 2,
    min_places_required: null,
    duration_options: [{ duration: 60, price: '12.00', label: null }],
    ...over,
  });

  /**
   * The service asks four questions per availability request, plus the
   * calendar listing first. Dispatching on the SQL keeps the fixtures readable
   * when the order changes.
   */
  const respond = (over: {
    calendars?: any[];
    configurations?: any[];
    blocked?: any[];
    bookings?: any[];
    reservations?: any[];
  } = {}) => {
    mockDb.query = jest.fn().mockImplementation((sql: string) => {
      const text = String(sql);
      const rows = text.includes('FROM calendars')
        ? over.calendars ?? [calendarRow()]
        : text.includes('time_slot_configurations')
          ? over.configurations ?? [configurationRow()]
          : text.includes('blocked_periods')
            ? over.blocked ?? []
            : text.includes('FROM bookings')
              ? over.bookings ?? []
              : text.includes('slot_reservations')
                ? over.reservations ?? []
                : [];
      return Promise.resolve({ rows, rowCount: rows.length });
    });
  };

  const service = new AccountCatalogueService();

  describe('listing', () => {
    it('returns the club’s booking rules with each calendar', async () => {
      respond();

      const [calendar] = await service.listCalendars(ORG);

      expect(calendar).toMatchObject({
        id: CALENDAR,
        name: 'Tennis court 1',
        minDaysInAdvance: 0,
        maxDaysInAdvance: 90,
        allowCancellations: true,
        cancelDaysInAdvance: 2,
        available: true,
      });
    });

    it('marks an inactive calendar as not taking bookings', async () => {
      respond({ calendars: [calendarRow({ status: 'closed' })] });

      const [calendar] = await service.listCalendars(ORG);
      expect(calendar).toMatchObject({
        available: false,
        unavailableReason: 'not-open-for-bookings',
      });
    });

    /** No schedule means no slot can ever be produced, however active it is. */
    it('marks a calendar with no schedule as not bookable', async () => {
      respond({ calendars: [calendarRow({ configuration_count: 0 })] });

      expect((await service.listCalendars(ORG))[0].available).toBe(false);
    });

    it('carries terms only when the club switched them on', async () => {
      respond({
        calendars: [
          calendarRow({ use_terms_and_conditions: false, terms_and_conditions: '<p>Rules.</p>' }),
        ],
      });
      expect((await service.listCalendars(ORG))[0].termsAndConditions).toBeNull();

      respond({
        calendars: [
          calendarRow({ use_terms_and_conditions: true, terms_and_conditions: '<p>Rules.</p>' }),
        ],
      });
      expect((await service.listCalendars(ORG))[0].termsAndConditions).toBe('<p>Rules.</p>');
    });
  });

  describe('availability', () => {
    it('derives slots from the schedule, priced in minor units', async () => {
      respond();

      const { slots } = await service.listCalendarAvailability(
        ORG,
        CALENDAR,
        SATURDAY,
        SATURDAY,
        TODAY
      );

      expect(slots[0]).toMatchObject({
        date: SATURDAY,
        startTime: '09:00',
        endTime: '10:00',
        duration: 60,
        // "12.00" in the database is 1200 everywhere the money runs.
        price: 1200,
        placesAvailable: 2,
        available: true,
      });
    });

    it('subtracts confirmed bookings from the places', async () => {
      respond({
        bookings: [
          {
            booking_date: SATURDAY,
            start_time: '09:00:00',
            duration: 60,
            places_booked: 2,
            booking_status: 'confirmed',
          },
        ],
      });

      const { slots } = await service.listCalendarAvailability(
        ORG,
        CALENDAR,
        SATURDAY,
        SATURDAY,
        TODAY
      );

      expect(slots[0]).toMatchObject({ placesRemaining: 0, available: false, unavailableReason: 'full' });
    });

    it('refuses a calendar belonging to another club', async () => {
      respond({ calendars: [] });

      await expect(
        service.listCalendarAvailability(ORG, 'someone-elses', SATURDAY, SATURDAY, TODAY)
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('adding a slot to the basket', () => {
    it('accepts a slot that is still free', async () => {
      respond();

      await expect(
        service.assertSlotAvailable(ORG, CALENDAR, SATURDAY, '09:00', 60, 1, TODAY)
      ).resolves.toMatchObject({ slot: { startTime: '09:00' } });
    });

    it('accepts a time that arrives with seconds', async () => {
      respond();

      await expect(
        service.assertSlotAvailable(ORG, CALENDAR, SATURDAY, '09:00:00', 60, 1, TODAY)
      ).resolves.toBeDefined();
    });

    it('refuses a slot the schedule does not produce', async () => {
      respond();

      await expect(
        service.assertSlotAvailable(ORG, CALENDAR, SATURDAY, '03:15', 60, 1, TODAY)
      ).rejects.toThrow(/not on this calendar/i);
    });

    /** The race the whole design is arranged around. */
    it('refuses a slot taken since the member looked', async () => {
      respond({
        bookings: [
          {
            booking_date: SATURDAY,
            start_time: '09:00:00',
            duration: 60,
            places_booked: 2,
            booking_status: 'confirmed',
          },
        ],
      });

      await expect(
        service.assertSlotAvailable(ORG, CALENDAR, SATURDAY, '09:00', 60, 1, TODAY)
      ).rejects.toThrow(/fully booked/i);
    });

    it('refuses a slot somebody else is midway through booking', async () => {
      respond({
        reservations: [{ slot_date: SATURDAY, start_time: '09:00:00', duration: 60 }],
      });

      await expect(
        service.assertSlotAvailable(ORG, CALENDAR, SATURDAY, '09:00', 60, 1, TODAY)
      ).rejects.toThrow(/Somebody else/i);
    });

    it('refuses more places than are left, and says how many', async () => {
      respond({
        bookings: [
          {
            booking_date: SATURDAY,
            start_time: '09:00:00',
            duration: 60,
            places_booked: 1,
            booking_status: 'confirmed',
          },
        ],
      });

      await expect(
        service.assertSlotAvailable(ORG, CALENDAR, SATURDAY, '09:00', 60, 2, TODAY)
      ).rejects.toThrow(/Only one place is left/i);
    });

    it('refuses any slot on a calendar that has stopped taking bookings', async () => {
      respond({ calendars: [calendarRow({ status: 'closed' })] });

      await expect(
        service.assertSlotAvailable(ORG, CALENDAR, SATURDAY, '09:00', 60, 1, TODAY)
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
