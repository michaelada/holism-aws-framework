import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookCalendarPage from '../BookCalendarPage';
import { makeOrganisationContext, renderWithProviders } from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';
import { AvailableSlot, CatalogueCalendar } from '../../types/account';

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
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ calendarId: 'cal-1' }),
  };
});

/** Today, so the fixtures land inside whatever week the page opens on. */
const todayKey = (() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
})();

const calendar = (over: Partial<CatalogueCalendar> = {}): CatalogueCalendar => ({
  id: 'cal-1',
  name: 'Tennis court 1',
  description: 'All-weather',
  displayColour: '#336699',
  minDaysInAdvance: 0,
  maxDaysInAdvance: 90,
  allowCancellations: true,
  cancelDaysInAdvance: 2,
  termsAndConditions: null,
  supportedPaymentMethodIds: ['pm-card'],
  available: true,
  unavailableReason: null,
  ...over,
});

const slot = (over: Partial<AvailableSlot> = {}): AvailableSlot => ({
  date: todayKey,
  startTime: '09:00',
  endTime: '10:00',
  duration: 60,
  price: 1200,
  placesAvailable: 1,
  placesBooked: 0,
  placesRemaining: 1,
  available: true,
  unavailableReason: null,
  ...over,
});

const respond = (slots: AvailableSlot[] = [slot()], over: Partial<CatalogueCalendar> = {}) => {
  mockExecute.mockImplementation((request: { url: string; method?: string }) => {
    if (request.method === 'POST') return Promise.resolve({});
    return Promise.resolve({ calendar: calendar(over), slots });
  });
};

/**
 * D12/D13 — a week of availability, and booking from it.
 *
 * Taken slots are shown and disabled rather than dropped: a member deciding
 * when to play needs to tell a busy Saturday from a closed one. Choosing does
 * not hold anything — the slot is checked again when it reaches the basket, and
 * once more at fulfilment.
 */
describe('BookCalendarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    respond();
  });

  it('asks for one week of availability at a time', async () => {
    renderWithProviders(<BookCalendarPage />);

    await waitFor(() => expect(mockExecute).toHaveBeenCalled());
    const url = String(mockExecute.mock.calls[0][0].url);
    expect(url).toContain(`/catalogue/calendars/cal-1/availability`);

    const from = url.match(/from=([\d-]+)/)?.[1] ?? '';
    const to = url.match(/to=([\d-]+)/)?.[1] ?? '';
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    expect(days).toBe(6);
  });

  it('shows the calendar and its free slots with prices', async () => {
    renderWithProviders(<BookCalendarPage />);

    expect(await screen.findByText('Tennis court 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /09:00–10:00/ })).toBeEnabled();
    expect(screen.getByText('€12.00')).toBeInTheDocument();
  });

  it('shows a free slot as free rather than as nothing', async () => {
    respond([slot({ price: 0 })]);
    renderWithProviders(<BookCalendarPage />);

    expect(await screen.findByText('Free')).toBeInTheDocument();
  });

  it('shows taken slots, disabled, with the reason', async () => {
    respond([
      slot({ startTime: '09:00', endTime: '10:00', available: false, unavailableReason: 'full' }),
      slot({ startTime: '10:00', endTime: '11:00', available: false, unavailableReason: 'in-use' }),
      slot({ startTime: '11:00', endTime: '12:00', available: false, unavailableReason: 'held' }),
    ]);
    renderWithProviders(<BookCalendarPage />);

    expect(await screen.findByRole('button', { name: /09:00–10:00/ })).toBeDisabled();
    expect(screen.getByText('Full')).toBeInTheDocument();
    expect(screen.getByText('Taken')).toBeInTheDocument();
    expect(screen.getByText('Being booked')).toBeInTheDocument();
  });

  it('will not add to the basket until a slot is chosen', async () => {
    renderWithProviders(<BookCalendarPage />);

    expect(await screen.findByRole('button', { name: 'Add to basket' })).toBeDisabled();
    expect(screen.getByText('Choose a slot')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /09:00–10:00/ }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add to basket' })).toBeEnabled()
    );
  });

  it('summarises the chosen slot before it is committed to', async () => {
    renderWithProviders(<BookCalendarPage />);
    await userEvent.click(await screen.findByRole('button', { name: /09:00–10:00/ }));

    expect(screen.getByText('Your slot')).toBeInTheDocument();
    expect(screen.getByText('60 minutes')).toBeInTheDocument();
  });

  it('sends the whole slot to the basket, since a slot has no id', async () => {
    renderWithProviders(<BookCalendarPage />);
    await userEvent.click(await screen.findByRole('button', { name: /09:00–10:00/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to basket' }));

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: `/api/account/${contextValue.orgCode}/cart/items`,
          data: expect.objectContaining({
            itemType: 'booking',
            unitFee: 1200,
            contextRef: {
              calendarId: 'cal-1',
              date: todayKey,
              startTime: '09:00',
              duration: 60,
              places: 1,
            },
          }),
        })
      )
    );
    expect(mockNavigate).toHaveBeenCalledWith(`/${contextValue.orgCode}/cart`);
  });

  it('moves a week at a time', async () => {
    renderWithProviders(<BookCalendarPage />);
    await screen.findByText('Tennis court 1');
    const firstFrom = String(mockExecute.mock.calls[0][0].url).match(/from=([\d-]+)/)?.[1] ?? '';

    await userEvent.click(screen.getByRole('button', { name: 'Next week' }));

    await waitFor(() => {
      const latest = String(mockExecute.mock.calls.at(-1)?.[0].url).match(/from=([\d-]+)/)?.[1] ?? '';
      expect((Date.parse(latest) - Date.parse(firstFrom)) / 86_400_000).toBe(7);
    });
  });

  it('says when a week has nothing in it', async () => {
    respond([]);
    renderWithProviders(<BookCalendarPage />);

    expect(await screen.findByText(/Nothing is available this week/i)).toBeInTheDocument();
  });

  describe('terms', () => {
    it('will not add until they are accepted', async () => {
      respond([slot()], { termsAndConditions: '<p>Leave the court as you found it.</p>' });
      renderWithProviders(<BookCalendarPage />);

      await userEvent.click(await screen.findByRole('button', { name: /09:00–10:00/ }));
      expect(screen.getByText('Leave the court as you found it.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add to basket' })).toBeDisabled();

      await userEvent.click(screen.getByRole('checkbox'));

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Add to basket' })).toBeEnabled()
      );
    });
  });

  /**
   * The race this whole design is arranged around: the slot went while the
   * member was deciding. The refusal is shown *and* the week is re-read, so the
   * screen agrees with what it has just said.
   */
  it('reports a slot lost to somebody else and re-reads the week', async () => {
    let taken = false;
    mockExecute.mockImplementation((request: { url: string; method?: string }) => {
      if (request.method === 'POST') {
        taken = true;
        return Promise.reject(new Error('Somebody else is booking that slot'));
      }
      return Promise.resolve({
        calendar: calendar(),
        slots: [taken ? slot({ available: false, unavailableReason: 'held' }) : slot()],
      });
    });

    renderWithProviders(<BookCalendarPage />);
    await userEvent.click(await screen.findByRole('button', { name: /09:00–10:00/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to basket' }));

    expect(await screen.findByText('Somebody else is booking that slot')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /09:00–10:00/ })).toBeDisabled()
    );
    expect(mockNavigate).not.toHaveBeenCalledWith(`/${contextValue.orgCode}/cart`);
  });

  it('says so when the calendar has gone', async () => {
    mockExecute.mockRejectedValue(Object.assign(new Error('gone'), { status: 404 }));
    renderWithProviders(<BookCalendarPage />);

    expect(await screen.findByText(/no longer available/i)).toBeInTheDocument();
  });
});
/**
 * "Never allow selection offline" — the capability table's rule for this
 * screen, and the one place it matters most.
 *
 * The grid a member is looking at may be hours old and the court long gone.
 * Letting them pick a slot and refusing at the basket would be an invitation
 * followed by a rejection.
 */
describe('BookCalendarPage — offline', () => {
  const setOnline = (online: boolean) => {
    Object.defineProperty(window.navigator, 'onLine', { value: online, configurable: true });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    respond();
    setOnline(false);
  });

  afterEach(() => setOnline(true));

  it('will not let a slot be chosen at all', async () => {
    renderWithProviders(<BookCalendarPage />);

    expect(await screen.findByRole('button', { name: /09:00–10:00/ })).toBeDisabled();
  });

  it('says why, naming staleness rather than only the connection', async () => {
    renderWithProviders(<BookCalendarPage />);

    await screen.findByText('Tennis court 1');
    expect(screen.getByText(/Availability may be out of date/)).toBeInTheDocument();
  });

  it('keeps the button unavailable', async () => {
    renderWithProviders(<BookCalendarPage />);

    await screen.findByText('Tennis court 1');
    expect(screen.getByRole('button', { name: 'Add to basket' })).toBeDisabled();
  });

  /** Still readable: the week is what a member checks before travelling. */
  it('still shows the week it last fetched', async () => {
    renderWithProviders(<BookCalendarPage />);

    expect(await screen.findByRole('button', { name: /09:00–10:00/ })).toBeInTheDocument();
    expect(screen.getByText('€12.00')).toBeInTheDocument();
  });
});
