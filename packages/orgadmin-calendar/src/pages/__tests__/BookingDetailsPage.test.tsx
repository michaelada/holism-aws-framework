import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BookingDetailsPage from '../BookingDetailsPage';

/**
 * One booking, in full — the page a club opens when a member rings up about it.
 *
 * Its job is to answer questions accurately: who booked, when, for how long,
 * what they paid. The two states worth pinning are the ones that are easy to get
 * wrong and awful when they are: a booking that has not loaded must say so
 * rather than render blanks, and Cancel Booking must not be offered for a
 * booking that is already cancelled.
 */

const { execute, navigate, params } = vi.hoisted(() => ({
  execute: vi.fn(),
  navigate: vi.fn(),
  params: { current: { id: 'bk-1' } as { id?: string } },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useParams: () => params.current,
}));

vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({ organisation: { id: 'org-1', name: 'Meath' }, setOrganisation: vi.fn() }),
}));

vi.mock('@aws-web-framework/orgadmin-shell', async () => {
  const { createShellMock } = await import('@aws-web-framework/orgadmin-core/test/shellMock');
  return createShellMock();
});

const BOOKING = {
  id: 'bk-1',
  bookingReference: 'BK-2026-000001',
  calendarName: 'Main Arena',
  userName: 'Aoife McNamara',
  userEmail: 'aoife@example.test',
  bookingDate: '2026-09-14',
  startTime: '09:00',
  endTime: '10:00',
  duration: 60,
  placesBooked: 2,
  totalPrice: 25,
  bookingStatus: 'confirmed',
  paymentStatus: 'paid',
};

beforeEach(() => {
  execute.mockReset();
  navigate.mockReset();
  params.current = { id: 'bk-1' };
  execute.mockResolvedValue(BOOKING);
});

describe('BookingDetailsPage — loading', () => {
  it('fetches the booking named in the route', async () => {
    render(<BookingDetailsPage />);

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/orgadmin/bookings/bk-1',
      })
    );
  });

  it('says the booking was not found rather than rendering an empty page', async () => {
    execute.mockResolvedValue(null);

    render(<BookingDetailsPage />);

    await waitFor(() => expect(screen.getByText(/booking not found/i)).toBeInTheDocument());
  });

  it('says the same when the request fails, instead of sitting on a spinner', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    execute.mockRejectedValue(new Error('network'));

    render(<BookingDetailsPage />);

    await waitFor(() => expect(screen.getByText(/booking not found/i)).toBeInTheDocument());
  });

  it('asks for nothing when the route carries no booking id', async () => {
    params.current = {};

    render(<BookingDetailsPage />);

    await new Promise((r) => setTimeout(r, 20));
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('BookingDetailsPage — answering the member’s questions', () => {
  it('leads with the reference the member will quote', async () => {
    render(<BookingDetailsPage />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'BK-2026-000001' })).toBeInTheDocument()
    );
  });

  it('shows when it is, how long for, and how many places', async () => {
    render(<BookingDetailsPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'BK-2026-000001' })).toBeInTheDocument()
    );

    expect(screen.getByText(/09:00/)).toBeInTheDocument();
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
    expect(screen.getByText(/60 min/)).toBeInTheDocument();
    expect(screen.getByText(/: 2$/)).toBeInTheDocument();
  });

  it('shows who booked it and how to reach them', async () => {
    render(<BookingDetailsPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'BK-2026-000001' })).toBeInTheDocument()
    );

    expect(screen.getByText(/Aoife McNamara/)).toBeInTheDocument();
    expect(screen.getByText(/aoife@example\.test/)).toBeInTheDocument();
  });

  it('shows a dash where the booking has no contact details, not "undefined"', async () => {
    execute.mockResolvedValue({ ...BOOKING, userName: undefined, userEmail: undefined });

    render(<BookingDetailsPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'BK-2026-000001' })).toBeInTheDocument()
    );

    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/—/).length).toBeGreaterThan(0);
  });

  it('shows the total as money', async () => {
    render(<BookingDetailsPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'BK-2026-000001' })).toBeInTheDocument()
    );

    expect(screen.getByText(/25\.00/)).toBeInTheDocument();
  });

  it('shows whether it has been paid for', async () => {
    render(<BookingDetailsPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'BK-2026-000001' })).toBeInTheDocument()
    );

    expect(screen.getByText(/paid/i)).toBeInTheDocument();
  });
});

describe('BookingDetailsPage — what can still be done to it', () => {
  it('offers to cancel a confirmed booking', async () => {
    render(<BookingDetailsPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'BK-2026-000001' })).toBeInTheDocument()
    );

    expect(screen.getByRole('button', { name: /cancel booking/i })).toBeInTheDocument();
  });

  it('does not offer to cancel a booking that is already cancelled', async () => {
    execute.mockResolvedValue({ ...BOOKING, bookingStatus: 'cancelled' });

    render(<BookingDetailsPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'BK-2026-000001' })).toBeInTheDocument()
    );

    // Offering it invites a second cancellation and a second refund.
    expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument();
  });

  it('goes back to the bookings list', async () => {
    render(<BookingDetailsPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'BK-2026-000001' })).toBeInTheDocument()
    );

    fireEvent.click(screen.getAllByRole('button', { name: /bookings/i })[0]);

    expect(navigate).toHaveBeenCalledWith('/calendar/bookings');
  });
});
