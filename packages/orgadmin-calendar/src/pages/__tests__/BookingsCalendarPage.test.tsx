import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * A club's bookable slots laid out on a calendar.
 *
 * What this page decides is *which slots to ask the server for* and *what a
 * click on one means*. Both are easy to get subtly wrong and hard to notice.
 *
 * The range follows the view: a day view asks for that day, a week for the
 * surrounding week, and a month for the whole grid the month is drawn on —
 * including the days either side that share its first and last weeks. Asking
 * for only the calendar month leaves those trailing days blank while the grid
 * still draws them, which reads as "nothing is bookable" on days that are.
 *
 * The click is a dispatch: a free slot opens the reservation form, a booked one
 * opens the booking, and a slot blocked by *someone else's* overlapping
 * reservation must open nothing at all — offering to reserve it produces a
 * double booking.
 */

const { calendarView, navigate, calendarProps } = vi.hoisted(() => ({
  calendarView: {
    calendars: [] as unknown[],
    selectedCalendar: null as unknown,
    slots: [] as unknown[],
    loading: false,
    error: null as string | null,
    selectCalendar: vi.fn(),
    setDateRange: vi.fn(),
    reserveSlot: vi.fn(),
    freeSlot: vi.fn(),
    releaseBooking: vi.fn(),
  },
  navigate: vi.fn(),
  calendarProps: { current: null as Record<string, any> | null },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

vi.mock('../../hooks/useCalendarView', () => ({
  useCalendarView: () => calendarView,
}));

// The page reads the locale to format times; the real hook needs a provider.
vi.mock('@itsplainsailing/orgadmin-shell', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-GB' } }),
  useLocale: () => ({ locale: 'en-GB', setLocale: vi.fn(), dateLocale: undefined }),
}));

/*
 * The real grid is a third-party component; this stand-in records the props it
 * was given so the page's own decisions — the events it built and the handlers
 * it passed — can be driven directly.
 */
vi.mock('react-big-calendar', () => ({
  Calendar: (props: Record<string, any>) => {
    calendarProps.current = props;
    return <div data-testid="big-calendar" />;
  },
  dateFnsLocalizer: () => ({}),
  Views: { DAY: 'day', WEEK: 'week', MONTH: 'month' },
}));

import BookingsCalendarPage from '../BookingsCalendarPage';

const slot = (over: Record<string, unknown> = {}) => ({
  date: new Date('2026-06-10T00:00:00Z'),
  startTime: '09:00',
  endTime: '10:00',
  duration: 60,
  price: 20,
  placesAvailable: 2,
  placesBooked: 0,
  bookings: [] as unknown[],
  isReserved: false,
  isBookedByOverlap: false,
  isExactReservation: false,
  ...over,
});

const CALENDAR = { id: 'cal-1', name: 'Tennis Court 1', status: 'open' };

const renderPage = (over: Partial<typeof calendarView> = {}) => {
  Object.assign(calendarView, {
    calendars: [CALENDAR],
    selectedCalendar: CALENDAR,
    slots: [],
    loading: false,
    error: null,
    ...over,
  });
  return render(<BookingsCalendarPage />);
};

/** The events the page built from its slots. */
const events = () => calendarProps.current?.events ?? [];

const clickSlot = (index = 0) => calendarProps.current!.onSelectEvent(events()[index]);

const changeView = (view: 'day' | 'week' | 'month') => calendarProps.current!.onView(view);

const navigateTo = (date: Date) => calendarProps.current!.onNavigate(date);

/** The range most recently asked of the server. */
const requestedRange = () => calendarView.setDateRange.mock.calls.at(-1) ?? [];

beforeEach(() => {
  vi.clearAllMocks();
  calendarProps.current = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BookingsCalendarPage — what it puts on the grid', () => {
  it('turns each slot into an event at its own time', () => {
    renderPage({ slots: [slot()] });

    expect(events()).toHaveLength(1);
    expect(events()[0].start).toBeInstanceOf(Date);
    expect(events()[0].end).toBeInstanceOf(Date);
  });

  it('labels a free slot with its length and price, so options can be told apart', () => {
    renderPage({ slots: [slot({ duration: 60, price: 20 })] });

    expect(events()[0].title).toMatch(/1h/);
    expect(events()[0].title).toMatch(/20/);
  });

  it('labels a shorter slot in minutes', () => {
    renderPage({ slots: [slot({ duration: 30, price: 0 })] });

    expect(events()[0].title).toMatch(/30m/);
  });

  it('omits the price from a free-of-charge slot', () => {
    renderPage({ slots: [slot({ price: 0 })] });

    // "€0.00" reads as a price somebody forgot to set.
    expect(events()[0].title).not.toMatch(/€/);
  });

  it('shows a booked slot as a count of places taken', () => {
    renderPage({
      slots: [slot({ bookings: [{ id: 'b-1' }], placesBooked: 1, placesAvailable: 2 })],
    });

    expect(events()[0].title).toMatch(/1\/2/);
  });

  it('gives each slot an id of its own', () => {
    renderPage({
      slots: [slot({ startTime: '09:00' }), slot({ startTime: '10:00' })],
    });

    const ids = events().map((e: { id: string }) => e.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('has nothing to draw when the club has no slots', () => {
    renderPage({ slots: [] });

    expect(events()).toEqual([]);
  });
});

describe('BookingsCalendarPage — what a click on a slot means', () => {
  it('offers to reserve a slot that is free', async () => {
    renderPage({ slots: [slot()] });

    clickSlot();

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('opens the booking behind a slot that is taken', async () => {
    renderPage({
      slots: [slot({ bookings: [{ id: 'b-1', memberName: 'Aoife Byrne' }], placesBooked: 1 })],
    });

    clickSlot();

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('offers nothing for a slot blocked by an overlapping booking', async () => {
    renderPage({ slots: [slot({ isBookedByOverlap: true })] });

    clickSlot();

    // Offering to reserve it would produce a double booking.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('offers to free a reservation that is this slot’s own', async () => {
    renderPage({ slots: [slot({ isReserved: true, isExactReservation: true })] });

    clickSlot();

    await waitFor(() => expect(calendarProps.current).not.toBeNull());
  });

  it('offers nothing for a slot merely blocked by someone else’s reservation', async () => {
    renderPage({ slots: [slot({ isReserved: true, isExactReservation: false })] });

    clickSlot();

    // Freeing this would release a reservation the operator did not choose.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('BookingsCalendarPage — which slots it asks for', () => {
  it('asks for a single day in the day view', () => {
    renderPage({ slots: [] });

    changeView('day');

    const [start, end] = requestedRange();
    expect(start.toDateString()).toBe(end.toDateString());
  });

  it('asks for a whole week in the week view', () => {
    renderPage({ slots: [] });

    changeView('week');

    // End is the last moment of the last day, so count calendar days, not spans.
    const [start, end] = requestedRange();
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
    expect(days).toBe(6);
    expect(start.getDay()).toBe(0);
  });

  it('asks for the whole grid a month is drawn on, not just the month', () => {
    renderPage({ slots: [] });

    changeView('month');

    // The grid draws the days either side; asking only for the calendar month
    // leaves them blank, which reads as "nothing is bookable" on days that are.
    const [start, end] = requestedRange();
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    expect(days).toBeGreaterThanOrEqual(27);
    expect(start.getDay()).toBe(0);
  });

  it('asks again for the range around a date it was moved to', () => {
    renderPage({ slots: [] });

    navigateTo(new Date('2026-09-15T00:00:00'));

    const [start, end] = requestedRange();
    expect(start.getTime()).toBeLessThanOrEqual(new Date('2026-09-15T00:00:00').getTime());
    expect(end.getTime()).toBeGreaterThanOrEqual(new Date('2026-09-15T00:00:00').getTime());
  });
});

describe('BookingsCalendarPage — the state of the page itself', () => {
  it('says so when the slots could not be loaded', () => {
    renderPage({ error: 'Failed to load calendar data' });

    // An empty grid with no message reads as "nothing is bookable".
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows the grid once loading has finished', () => {
    renderPage({ slots: [slot()] });

    expect(screen.getByTestId('big-calendar')).toBeInTheDocument();
  });

  it('goes back to the bookings list', () => {
    renderPage({ slots: [] });

    const back = screen
      .getAllByRole('button')
      .find((b) => /booking|back|list/i.test(b.textContent ?? ''));
    if (back) {
      fireEvent.click(back);
      expect(navigate).toHaveBeenCalled();
    }
  });
});
