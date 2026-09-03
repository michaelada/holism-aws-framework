import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import BookingsListPage from '../BookingsListPage';

/**
 * Every booking the club holds, in one list.
 *
 * The rows carry money and dates, and both are formatted rather than printed —
 * a booking shown at the wrong time or the wrong price is a dispute at the gate.
 * So the tests assert what a row actually says, not that a row exists.
 */

const { execute, navigate } = vi.hoisted(() => ({
  execute: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

vi.mock('@itsplainsailing/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({ organisation: { id: 'org-1', name: 'Meath' }, setOrganisation: vi.fn() }),
}));

vi.mock('@itsplainsailing/orgadmin-shell', async () => {
  const { createShellMock } = await import('@itsplainsailing/orgadmin-core/test/shellMock');
  return createShellMock();
});

const BOOKINGS = [
  {
    id: 'bk-1',
    bookingReference: 'BK-2026-000001',
    calendarName: 'Main Arena',
    userName: 'Aoife McNamara',
    bookingDate: '2026-09-14',
    startTime: '09:00',
    duration: 60,
    totalPrice: 25,
    bookingStatus: 'confirmed',
  },
  {
    id: 'bk-2',
    bookingReference: 'BK-2026-000002',
    calendarName: 'Lunge Pen',
    userName: 'Séamus Donnelly',
    bookingDate: '2026-09-15',
    startTime: '14:30',
    duration: 30,
    totalPrice: 12.5,
    bookingStatus: 'cancelled',
  },
];

const dataRows = () =>
  Array.from(document.querySelectorAll('tbody tr')).filter((row) => row.children.length > 1);

beforeEach(() => {
  execute.mockReset();
  navigate.mockReset();
  execute.mockResolvedValue(BOOKINGS);
});

describe('BookingsListPage — loading', () => {
  it('asks for the bookings of the organisation being worked in', async () => {
    render(<BookingsListPage />);

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/orgadmin/organisations/org-1/bookings',
      })
    );
  });

  it('shows a row for every booking', async () => {
    render(<BookingsListPage />);

    await waitFor(() => expect(dataRows()).toHaveLength(2));
  });

  it('says there are none rather than showing an empty table', async () => {
    execute.mockResolvedValue([]);

    render(<BookingsListPage />);

    await waitFor(() => expect(screen.getByText(/no bookings/i)).toBeInTheDocument());
  });

  it('empties the list when the request fails, instead of holding the last club’s bookings', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    execute.mockRejectedValue(new Error('network'));

    render(<BookingsListPage />);

    await waitFor(() => expect(screen.getByText(/no bookings/i)).toBeInTheDocument());
  });

  it('copes with the API answering with nothing at all', async () => {
    execute.mockResolvedValue(null);

    render(<BookingsListPage />);

    await waitFor(() => expect(screen.getByText(/no bookings/i)).toBeInTheDocument());
  });
});

describe('BookingsListPage — what a row says', () => {
  it('shows the reference, the facility and who booked it', async () => {
    render(<BookingsListPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    const row = within(dataRows()[0] as HTMLElement);
    expect(row.getByText('BK-2026-000001')).toBeInTheDocument();
    expect(row.getByText('Main Arena')).toBeInTheDocument();
    expect(row.getByText('Aoife McNamara')).toBeInTheDocument();
  });

  it('shows the date the way a club reads it, not the way the API sends it', async () => {
    render(<BookingsListPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    // dd/MM/yyyy — "09/14/2026" would be a different day to an Irish club.
    expect(within(dataRows()[0] as HTMLElement).getByText('14/09/2026')).toBeInTheDocument();
  });

  it('shows the time and the length of the booking', async () => {
    render(<BookingsListPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    const row = within(dataRows()[0] as HTMLElement);
    expect(row.getByText('09:00')).toBeInTheDocument();
    expect(row.getByText(/60/)).toBeInTheDocument();
  });

  it('shows the price as money, including the fractional one', async () => {
    render(<BookingsListPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    expect(within(dataRows()[0] as HTMLElement).getByText(/25/)).toBeInTheDocument();
    // 12.5 must not render as "12.5" — half a euro is "0.50".
    expect(within(dataRows()[1] as HTMLElement).getByText(/12\.50/)).toBeInTheDocument();
  });

  it('shows a dash where a booking has lost its calendar name', async () => {
    execute.mockResolvedValue([{ ...BOOKINGS[0], calendarName: undefined }]);

    render(<BookingsListPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(1));

    expect(within(dataRows()[0] as HTMLElement).getByText('—')).toBeInTheDocument();
  });

  it('distinguishes a cancelled booking from a confirmed one', async () => {
    render(<BookingsListPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    expect(within(dataRows()[0] as HTMLElement).getByText('confirmed')).toBeInTheDocument();
    expect(within(dataRows()[1] as HTMLElement).getByText('cancelled')).toBeInTheDocument();
  });
});

describe('BookingsListPage — where the actions go', () => {
  it('opens the booking on that row, by its own id', async () => {
    render(<BookingsListPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    fireEvent.click(within(dataRows()[1] as HTMLElement).getAllByRole('button')[0]);

    expect(navigate).toHaveBeenCalledWith('/calendar/bookings/bk-2');
  });

  it('switches to the calendar view of the same bookings', async () => {
    render(<BookingsListPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    fireEvent.click(screen.getByRole('button', { name: /calendar booking view/i }));

    expect(navigate).toHaveBeenCalledWith('/calendar/bookings/calendar-view');
  });
});
