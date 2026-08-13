import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyEntriesPage from '../MyEntriesPage';
import {
  makeOrganisationContext,
  renderWithProviders,
  TEST_ME,
} from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';

const mockExecute = vi.fn();
const mockNavigate = vi.fn();
let contextValue: AccountOrganisationContextValue = makeOrganisationContext();

vi.mock('../../hooks/useAccountApi', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useAccountApi')>(
    '../../hooks/useAccountApi'
  );
  return {
    ...actual,
    useAccountApi: () => ({
      execute: mockExecute,
      loading: false,
      error: null,
      reset: () => undefined,
    }),
  };
});

vi.mock('../../context/AccountOrganisationContext', async () => {
  const actual = await vi.importActual<
    typeof import('../../context/AccountOrganisationContext')
  >('../../context/AccountOrganisationContext');
  return { ...actual, useAccountOrganisation: () => contextValue };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const ENTRY = {
  id: 'entry-1',
  eventId: 'event-1',
  eventName: 'Summer Regatta',
  activityId: 'activity-1',
  activityName: 'Junior Single Sculls',
  startDate: '2026-07-01',
  endDate: '2026-07-01',
  quantity: 1,
  fee: 25,
  paymentStatus: 'paid',
  paymentMethod: 'card',
  entryDate: '2026-05-01T10:00:00Z',
  status: 'confirmed' as const,
};

const BOOKING = {
  id: 'booking-1',
  bookingReference: 'BK-001',
  calendarId: 'cal-1',
  calendarName: 'Court 1',
  bookingDate: '2026-07-05',
  startTime: '09:00',
  endTime: '10:00',
  duration: 60,
  placesBooked: 2,
  totalPrice: 30,
  paymentStatus: 'pending',
  bookingStatus: 'confirmed',
  cancelledAt: null,
  canCancel: true,
  cancellationRefusal: null,
  cancellationNoticeDays: 2,
  refundExpected: false,
  status: 'awaiting-payment' as const,
};

const withCapabilities = (capabilities: string[]) =>
  makeOrganisationContext({
    capabilities,
    me: { ...TEST_ME, organisation: { ...TEST_ME.organisation, capabilities } },
  });

const respond = () => {
  mockExecute.mockImplementation((request: { url: string }) =>
    request.url.endsWith('/bookings')
      ? Promise.resolve([BOOKING])
      : Promise.resolve([ENTRY])
  );
};

const render = (route = '/khpc/entries') =>
  renderWithProviders(<MyEntriesPage />, { route, path: '/:orgCode/entries' });

describe('MyEntriesPage (C1)', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockNavigate.mockReset();
    contextValue = withCapabilities(['event-management', 'calendar-bookings']);
    respond();
  });

  it('lists the entries with their event and activity', async () => {
    render();

    expect(await screen.findByText('Summer Regatta')).toBeInTheDocument();
    expect(screen.getByText('Junior Single Sculls')).toBeInTheDocument();
  });

  it('shows the shared status vocabulary rather than the raw payment status', async () => {
    render();

    // "Confirmed", not "paid" — the four words are what the member is taught.
    expect(await screen.findByText('Confirmed')).toBeInTheDocument();
    expect(screen.queryByText('paid')).not.toBeInTheDocument();
  });

  it('formats the fee in the club\'s currency', async () => {
    render();
    expect(await screen.findByText('€25.00')).toBeInTheDocument();
  });

  it('opens an entry when its row is chosen', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByText('Summer Regatta'));
    expect(mockNavigate).toHaveBeenCalledWith('/khpc/entries/entry-1');
  });

  it('switches to bookings and shows their own columns', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('tab', { name: 'Bookings' }));

    expect(await screen.findByText('Court 1')).toBeInTheDocument();
    expect(screen.getByText('09:00–10:00')).toBeInTheDocument();
    expect(screen.getByText('Awaiting payment')).toBeInTheDocument();
  });

  it('opens on the tab named in the URL', async () => {
    render('/khpc/entries?tab=bookings');
    expect(await screen.findByText('Court 1')).toBeInTheDocument();
  });

  /**
   * Each tab is gated independently. A club with events but no calendar must not
   * be shown an empty Bookings tab suggesting a feature it does not have.
   */
  it('shows no tabs at all when only one area is enabled', async () => {
    contextValue = withCapabilities(['event-management']);
    render();

    await waitFor(() => expect(screen.getByText('Summer Regatta')).toBeInTheDocument());
    expect(screen.queryByRole('tab', { name: 'Bookings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Entries' })).not.toBeInTheDocument();
  });

  it('does not request bookings from a club with no calendar', async () => {
    contextValue = withCapabilities(['event-management']);
    render();

    await waitFor(() => expect(mockExecute).toHaveBeenCalled());
    // The capability middleware would refuse it anyway; asking guarantees a 403.
    const urls = mockExecute.mock.calls.map((call) => call[0].url);
    expect(urls.some((url: string) => url.endsWith('/bookings'))).toBe(false);
  });

  it('falls back to bookings when the club has no events', async () => {
    contextValue = withCapabilities(['calendar-bookings']);
    render();

    expect(await screen.findByText('Court 1')).toBeInTheDocument();
  });

  it('ignores a tab in the URL the club does not have', async () => {
    contextValue = withCapabilities(['event-management']);
    render('/khpc/entries?tab=bookings');

    // A stale or hand-edited link must not land on a tab that cannot exist.
    expect(await screen.findByText('Summer Regatta')).toBeInTheDocument();
  });

  it('explains an empty list rather than showing a bare table', async () => {
    mockExecute.mockResolvedValue([]);
    render();

    expect(await screen.findByText('You have no entries yet.')).toBeInTheDocument();
  });

  it('reports a failure instead of looking empty', async () => {
    mockExecute.mockRejectedValue(new Error('offline'));
    render();

    expect(await screen.findByText('We could not load your entries.')).toBeInTheDocument();
    expect(screen.queryByText('You have no entries yet.')).not.toBeInTheDocument();
  });
});
/**
 * Self-cancellation (C1's bookings tab).
 *
 * Whether a member may cancel is the club's policy, decided on the server and
 * returned with each booking — the screen never works it out. Cancelling is
 * confirmed first: a booking is a slot somebody else could have had, and there
 * is no undo.
 */
describe('MyEntriesPage — cancelling a booking', () => {
  const respond = (booking: Record<string, unknown> = {}) => {
    mockExecute.mockImplementation((request: { url: string; method?: string }) => {
      if (request.method === 'POST') return Promise.resolve({ refundExpected: false });
      if (request.url.includes('/bookings')) {
        return Promise.resolve([{ ...BOOKING, ...booking }]);
      }
      return Promise.resolve([]);
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = withCapabilities(['calendar-bookings']);
    respond();
  });

  it('offers cancellation when the club’s policy allows it', async () => {
    renderWithProviders(<MyEntriesPage />);

    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('says why instead, when the notice period has passed', async () => {
    respond({ canCancel: false, cancellationRefusal: 'too-late', cancellationNoticeDays: 2 });
    renderWithProviders(<MyEntriesPage />);

    expect(await screen.findByText(/2 days’ notice needed/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  /** A calendar that forbids it says nothing — there is no policy to explain. */
  it('offers nothing when the club does not allow members to cancel', async () => {
    respond({ canCancel: false, cancellationRefusal: 'not-allowed' });
    renderWithProviders(<MyEntriesPage />);

    await screen.findByText('Court 1');
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.queryByText(/notice needed/)).not.toBeInTheDocument();
  });

  it('asks before cancelling, naming the booking', async () => {
    renderWithProviders(<MyEntriesPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Cancel this booking?')).toBeInTheDocument();
    expect(screen.getByText(/Court 1 on .* at 09:00/)).toBeInTheDocument();
    // Nothing has happened yet.
    expect(mockExecute).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('leaves the booking alone when the member backs out', async () => {
    renderWithProviders(<MyEntriesPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));

    await waitFor(() => expect(screen.queryByText('Cancel this booking?')).not.toBeInTheDocument());
    expect(mockExecute).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('cancels, then re-reads the list rather than patching it', async () => {
    renderWithProviders(<MyEntriesPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: `/api/account/${contextValue.orgCode}/bookings/booking-1/cancel`,
        })
      )
    );
    expect(await screen.findByText('Your booking is cancelled.')).toBeInTheDocument();
    // The re-read: two GETs for bookings, before and after.
    const reads = mockExecute.mock.calls.filter(
      (call) => !call[0].method && String(call[0].url).includes('/bookings')
    );
    expect(reads.length).toBeGreaterThan(1);
  });

  /** What happens to the money, said before the member commits. */
  it('warns of a refund before cancelling, and confirms it after', async () => {
    mockExecute.mockImplementation((request: { url: string; method?: string }) => {
      if (request.method === 'POST') return Promise.resolve({ refundExpected: true });
      if (request.url.includes('/bookings')) {
        return Promise.resolve([{ ...BOOKING, refundExpected: true }]);
      }
      return Promise.resolve([]);
    });
    renderWithProviders(<MyEntriesPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.getByText(/club refunds cancellations/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));

    expect(await screen.findByText(/The club will refund you/)).toBeInTheDocument();
  });

  /** The server decides, and its refusal has to reach the member. */
  it('shows a refusal from the server inside the dialog', async () => {
    mockExecute.mockImplementation((request: { url: string; method?: string }) => {
      if (request.method === 'POST') {
        return Promise.reject(new Error('Cancellations need at least 2 days’ notice'));
      }
      if (request.url.includes('/bookings')) return Promise.resolve([BOOKING]);
      return Promise.resolve([]);
    });
    renderWithProviders(<MyEntriesPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));

    expect(await screen.findByText(/need at least 2 days/)).toBeInTheDocument();
    // Still open, so the member can read it.
    expect(screen.getByText('Cancel this booking?')).toBeInTheDocument();
  });
});
