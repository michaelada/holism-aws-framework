import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCalendarView } from '../useCalendarView';

/**
 * The hook the booking screens are built on.
 *
 * It is the only thing standing between four separate API calls and the grid an
 * administrator reserves slots in, and almost everything it does is a decision
 * rather than a passthrough: which calendar to open on, what to do when a
 * request fails, what a mutation invalidates. Those decisions are invisible from
 * the page — a wrong one shows up as an empty calendar, not an error — so they
 * are tested here.
 */

const { execute, organisation } = vi.hoisted(() => ({
  execute: vi.fn(),
  organisation: { current: { id: 'org-1', name: 'Meath Hunt Pony Club' } as { id: string } | null },
}));

vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({ organisation: organisation.current, setOrganisation: vi.fn() }),
}));

const CALENDARS = [
  { id: 'cal-1', name: 'Main Arena' },
  { id: 'cal-2', name: 'Cross-Country Course' },
];

/** A calendar whose one configuration opens a single 23:00 hour every day. */
const calendarDetail = (over: Record<string, unknown> = {}) => ({
  id: 'cal-1',
  name: 'Main Arena',
  minDaysInAdvance: 0,
  maxDaysInAdvance: 90,
  timeSlotConfigurations: [
    {
      id: 'cfg-1',
      calendarId: 'cal-1',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startTime: '23:00',
      effectiveDateStart: new Date(Date.now() - 30 * 86400000),
      recurrenceWeeks: 1,
      placesAvailable: 2,
      durationOptions: [
        { id: 'd1', timeSlotConfigurationId: 'cfg-1', duration: 60, price: 20, label: 'Hour', order: 1 },
      ],
      order: 1,
    },
  ],
  blockedPeriods: [],
  ...over,
});

/** Answer each of the hook's four requests by URL rather than by call order. */
const respondWith = ({
  calendars = CALENDARS as unknown,
  detail = calendarDetail() as unknown,
  bookings = [] as unknown,
  reservations = [] as unknown,
} = {}) => {
  execute.mockImplementation(async ({ url }: { url: string }) => {
    if (url.endsWith('/calendars')) return calendars;
    if (url.includes('/bookings/range')) return bookings;
    if (url.includes('/reservations')) return reservations;
    if (url.includes('/calendars/')) return detail;
    return null;
  });
};

beforeEach(() => {
  execute.mockReset();
  organisation.current = { id: 'org-1' };
  respondWith();
});

describe('useCalendarView — opening the screen', () => {
  it('opens on the first calendar, so the grid is never empty for want of a choice', async () => {
    const { result } = renderHook(() => useCalendarView());

    await waitFor(() => expect(result.current.calendars).toHaveLength(2));
    await waitFor(() => expect(result.current.selectedCalendar?.id).toBe('cal-1'));
  });

  it('opens on the calendar it was given, rather than the first one', async () => {
    respondWith({ detail: calendarDetail({ id: 'cal-2', name: 'Cross-Country Course' }) });

    const { result } = renderHook(() => useCalendarView('cal-2'));

    await waitFor(() => expect(result.current.selectedCalendar?.id).toBe('cal-2'));
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining('/calendars/cal-2') })
    );
  });

  it('asks nothing at all until it knows which organisation it is in', async () => {
    organisation.current = null;

    renderHook(() => useCalendarView());

    // Every URL this hook builds contains an organisation or a calendar id, so
    // firing before the organisation resolves would fetch another club's data.
    await new Promise((r) => setTimeout(r, 20));
    expect(execute).not.toHaveBeenCalled();
  });

  it('turns the calendar and its bookings into bookable slots', async () => {
    const { result } = renderHook(() => useCalendarView());

    await waitFor(() => expect(result.current.slots.length).toBeGreaterThan(0));

    const slot = result.current.slots[0];
    expect(slot.startTime).toBe('23:00');
    expect(slot.duration).toBe(60);
    expect(slot.price).toBe(20);
    expect(slot.placesAvailable).toBe(2);
  });

  it('carries a booking through to the slot it was made against', async () => {
    const day = new Date();
    day.setDate(day.getDate() + 2);
    const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;

    respondWith({
      bookings: [
        {
          id: 'bk-1',
          bookingDate: ymd,
          startTime: '23:00:00',
          duration: 60,
          placesBooked: 2,
          bookingStatus: 'confirmed',
        },
      ],
    });

    const { result } = renderHook(() => useCalendarView());

    await waitFor(() => expect(result.current.slots.length).toBeGreaterThan(0));

    const booked = result.current.slots.find(
      (s) => s.date.getDate() === day.getDate() && s.startTime === '23:00'
    );
    expect(booked?.placesBooked).toBe(2);
    expect(booked?.isFull).toBe(true);
  });
});

describe('useCalendarView — when a request fails', () => {
  it('reports the calendars failing and leaves the list empty rather than stale', async () => {
    execute.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useCalendarView());

    await waitFor(() => expect(result.current.error).toBe('Failed to load calendars'));
    expect(result.current.calendars).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('reports the calendar data failing separately from the list', async () => {
    execute.mockImplementation(async ({ url }: { url: string }) => {
      if (url.endsWith('/calendars')) return CALENDARS;
      throw new Error('network');
    });

    const { result } = renderHook(() => useCalendarView());

    await waitFor(() => expect(result.current.error).toBe('Failed to load calendar data'));
    // The list survived, so the administrator can still pick a different one.
    expect(result.current.calendars).toHaveLength(2);
  });

  it('stops loading whether the request worked or not', async () => {
    execute.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useCalendarView());

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('empties the grid when no calendar is selected, rather than showing the last one', async () => {
    respondWith({ calendars: [] });

    const { result } = renderHook(() => useCalendarView());

    await waitFor(() => expect(result.current.calendars).toEqual([]));
    expect(result.current.selectedCalendar).toBeNull();
    expect(result.current.slots).toEqual([]);
    expect(result.current.reservations).toEqual([]);
  });
});

describe('useCalendarView — holding and releasing slots', () => {
  it('reserves a slot and reloads, so the grid shows the hold immediately', async () => {
    const { result } = renderHook(() => useCalendarView());
    await waitFor(() => expect(result.current.slots.length).toBeGreaterThan(0));

    execute.mockClear();
    await act(async () => {
      await result.current.reserveSlot({
        calendarId: 'cal-1',
        slotDate: '2026-09-01',
        startTime: '23:00',
        duration: 60,
        reason: 'Maintenance',
      } as never);
    });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/api/orgadmin/calendars/cal-1/reservations',
        data: expect.objectContaining({ slotDate: '2026-09-01', reason: 'Maintenance' }),
      })
    );
    // A reservation the screen cannot see is a slot that gets double-booked.
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining('/reservations?') })
    );
  });

  it('frees a slot and reloads', async () => {
    const { result } = renderHook(() => useCalendarView());
    await waitFor(() => expect(result.current.slots.length).toBeGreaterThan(0));

    execute.mockClear();
    await act(async () => {
      await result.current.freeSlot('res-9');
    });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'DELETE', url: '/api/orgadmin/reservations/res-9' })
    );
  });

  it('cancels a booking with the reason and refund decision the administrator made', async () => {
    const { result } = renderHook(() => useCalendarView());
    await waitFor(() => expect(result.current.slots.length).toBeGreaterThan(0));

    execute.mockClear();
    await act(async () => {
      await result.current.releaseBooking('bk-7', 'Waterlogged', true);
    });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/api/orgadmin/bookings/bk-7/cancel',
        data: { reason: 'Waterlogged', refund: true },
      })
    );
  });

  /*
   * Rethrown, not swallowed. The dialog that asked for the reservation needs to
   * know it failed so it can stay open — an error the hook keeps to itself
   * looks to the administrator like the hold was taken.
   */
  it.each([
    ['reserveSlot', 'Failed to reserve slot'],
    ['freeSlot', 'Failed to free slot'],
    ['releaseBooking', 'Failed to release booking'],
  ])('surfaces a failed %s to its caller as well as to the screen', async (method, message) => {
    const { result } = renderHook(() => useCalendarView());
    await waitFor(() => expect(result.current.slots.length).toBeGreaterThan(0));

    execute.mockRejectedValue(new Error('network'));

    /*
     * Caught inside `act`, not outside it. Letting the rejection escape the act
     * callback means React never runs its flush, and the `setError` the hook
     * made on the way out is still sitting unapplied when the assertion reads
     * it — the test then reports "no error was set" about a hook that set one.
     */
    let thrown: unknown;
    await act(async () => {
      try {
        if (method === 'reserveSlot') {
          await result.current.reserveSlot({ calendarId: 'cal-1' } as never);
        } else if (method === 'freeSlot') {
          await result.current.freeSlot('res-1');
        } else {
          await result.current.releaseBooking('bk-1', 'x', false);
        }
      } catch (error) {
        thrown = error;
      }
    });

    // Rethrown, so the dialog that asked for it can stay open …
    expect(thrown).toBeInstanceOf(Error);
    // … and recorded, so the screen can say what went wrong.
    expect(result.current.error).toBe(message);
  });
});

describe('useCalendarView — changing what is shown', () => {
  it('refetches when the administrator picks a different calendar', async () => {
    const { result } = renderHook(() => useCalendarView());
    await waitFor(() => expect(result.current.selectedCalendar?.id).toBe('cal-1'));

    respondWith({ detail: calendarDetail({ id: 'cal-2', name: 'Cross-Country Course' }) });
    act(() => result.current.selectCalendar('cal-2'));

    await waitFor(() => expect(result.current.selectedCalendar?.id).toBe('cal-2'));
  });

  it('refetches for the new dates, and asks the API only for those dates', async () => {
    const { result } = renderHook(() => useCalendarView());
    await waitFor(() => expect(result.current.slots.length).toBeGreaterThan(0));

    execute.mockClear();
    const start = new Date(2026, 8, 1);
    const end = new Date(2026, 8, 7);
    act(() => result.current.setDateRange(start, end));

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('start=2026-09-01&end=2026-09-07'),
        })
      )
    );
  });
});
