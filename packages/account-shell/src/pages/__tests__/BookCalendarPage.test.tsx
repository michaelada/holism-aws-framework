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
  heldUntil: null,
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
    // Worded as somebody else holding it rather than as the slot being gone:
    // a hold lapses, so the member has a reason to look again in a minute.
    expect(screen.getByText('Held by someone else')).toBeInTheDocument();
  });

  it("marks the member's own held slot as theirs, with the time left on it", async () => {
    respond([
      slot({
        startTime: '09:00',
        endTime: '10:00',
        available: false,
        unavailableReason: 'in-your-basket',
        heldUntil: new Date(Date.now() + 90_000).toISOString(),
      }),
    ]);
    renderWithProviders(<BookCalendarPage />);

    // "In your basket" rather than the grey nothing an ordinary disabled slot
    // gets — the member chose this one and must not read it as lost.
    expect(await screen.findByText('In your basket')).toBeInTheDocument();
    expect(screen.getByText(/1:2\d left|1:30 left/)).toBeInTheDocument();
  });

  it('draws a slot already in the basket in red, and refuses the press', async () => {
    /*
     * The same "cannot be taken" state as a slot somebody else holds, and it
     * reads as one — rather than the disabled grey of a slot that was never on
     * offer, which says nothing about why. The caption and countdown are what
     * distinguish "yours" from "theirs".
     */
    respond([
      slot({
        startTime: '09:00',
        endTime: '10:00',
        available: false,
        unavailableReason: 'in-your-basket',
        heldUntil: new Date(Date.now() + 90_000).toISOString(),
      }),
    ]);
    renderWithProviders(<BookCalendarPage />);

    const button = await screen.findByRole('button', { name: /09:00–10:00/ });
    expect(button).toBeDisabled();
    expect(screen.getByText('In your basket')).toBeInTheDocument();
  });

  it('does not add a slot that is already in the basket when pressed', async () => {
    respond([
      slot({ available: false, unavailableReason: 'in-your-basket', heldUntil: null }),
    ]);
    renderWithProviders(<BookCalendarPage />);

    const button = await screen.findByRole('button', { name: /09:00–10:00/ });
    await userEvent.click(button).catch(() => undefined);

    // Nothing chosen, so the basket button stays refused.
    expect(screen.getByRole('button', { name: 'Add to basket' })).toBeDisabled();
  });

  it("never counts down somebody else's hold", async () => {
    // The server does not send another member's expiry, and a countdown on a
    // stranger's slot would only invite people to sit and wait for it.
    respond([
      slot({ startTime: '09:00', endTime: '10:00', available: false, unavailableReason: 'held' }),
    ]);
    renderWithProviders(<BookCalendarPage />);

    expect(await screen.findByText('Held by someone else')).toBeInTheDocument();
    expect(screen.queryByText(/left$/)).not.toBeInTheDocument();
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

  it('lets a member pick several slots at once', async () => {
    // A court is booked Tuesday *and* Thursday; one-at-a-time meant a return
    // trip through the week grid and the basket for each.
    respond([
      slot({ startTime: '09:00', endTime: '10:00' }),
      slot({ startTime: '10:00', endTime: '11:00' }),
    ]);
    renderWithProviders(<BookCalendarPage />);

    await userEvent.click(await screen.findByRole('button', { name: /09:00–10:00/ }));
    await userEvent.click(screen.getByRole('button', { name: /10:00–11:00/ }));

    expect(screen.getByText('Your slots')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('deselects a slot that is tapped again', async () => {
    renderWithProviders(<BookCalendarPage />);
    const first = await screen.findByRole('button', { name: /09:00–10:00/ });

    await userEvent.click(first);
    expect(screen.getByText('Your slot')).toBeInTheDocument();

    await userEvent.click(first);
    expect(screen.queryByText('Your slot')).not.toBeInTheDocument();
  });

  it('adds one basket item per chosen slot', async () => {
    respond([
      slot({ startTime: '09:00', endTime: '10:00' }),
      slot({ startTime: '10:00', endTime: '11:00', price: 1500 }),
    ]);
    renderWithProviders(<BookCalendarPage />);

    await userEvent.click(await screen.findByRole('button', { name: /09:00–10:00/ }));
    await userEvent.click(screen.getByRole('button', { name: /10:00–11:00/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to basket' }));

    await waitFor(() => {
      const posts = mockExecute.mock.calls.filter(
        ([call]: any[]) => call?.method === 'POST' && call?.data?.itemType === 'booking'
      );
      expect(posts).toHaveLength(2);
      expect(posts.map(([call]: any[]) => call.data.contextRef.startTime)).toEqual([
        '09:00',
        '10:00',
      ]);
    });
  });

  it('names both ends of the slot in the basket line', async () => {
    // A start time alone leaves the member checking a basket that does not say
    // how long they booked for.
    renderWithProviders(<BookCalendarPage />);

    await userEvent.click(await screen.findByRole('button', { name: /09:00–10:00/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to basket' }));

    await waitFor(() => {
      const [call] = mockExecute.mock.calls.find(
        ([c]: any[]) => c?.method === 'POST' && c?.data?.itemType === 'booking'
      )!;
      expect(call.data.description).toContain('09:00–10:00');
    });
  });

  it('drops one slot from the summary without losing the rest', async () => {
    respond([
      slot({ startTime: '09:00', endTime: '10:00' }),
      slot({ startTime: '10:00', endTime: '11:00' }),
    ]);
    renderWithProviders(<BookCalendarPage />);

    await userEvent.click(await screen.findByRole('button', { name: /09:00–10:00/ }));
    await userEvent.click(screen.getByRole('button', { name: /10:00–11:00/ }));
    await userEvent.click(screen.getByRole('button', { name: /Remove .*09:00/ }));

    expect(screen.getByText('Your slot')).toBeInTheDocument();
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
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


/**
 * Two slots that cannot both be booked, offered side by side.
 *
 * A configuration with several duration options produces overlapping rows on
 * purpose — Laois's cross-country schooling offers a three-hour morning and a
 * four-hour extended morning, both from 10:00. They are two ways to book one
 * session.
 *
 * Both were selectable, so a member picked both, the first went into the basket
 * and the second was refused there — after the fact, and with a message about a
 * row they could see was different.
 */
describe('BookCalendarPage — slots that clash with each other', () => {
  const morning = () =>
    slot({ startTime: '10:00', endTime: '13:00', duration: 180, price: 3500 });
  const extended = () =>
    slot({ startTime: '10:00', endTime: '14:00', duration: 240, price: 4500 });
  const afternoon = () =>
    slot({ startTime: '13:00', endTime: '16:00', duration: 180, price: 3500 });

  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
  });

  it('swaps the choice rather than letting both be picked', async () => {
    respond([morning(), extended()]);
    renderWithProviders(<BookCalendarPage />);

    await userEvent.click(await screen.findByRole('button', { name: /10:00–13:00/ }));
    await userEvent.click(screen.getByRole('button', { name: /10:00–14:00/ }));

    // The later click wins: they are alternatives for the same session, and a
    // member clicking "extended" after "morning" means the longer one.
    expect(screen.getByRole('button', { name: /10:00–14:00/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: /10:00–13:00/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('adds only the one that survived the swap', async () => {
    respond([morning(), extended()]);
    renderWithProviders(<BookCalendarPage />);

    await userEvent.click(await screen.findByRole('button', { name: /10:00–13:00/ }));
    await userEvent.click(screen.getByRole('button', { name: /10:00–14:00/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to basket' }));

    await waitFor(() => {
      const adds = mockExecute.mock.calls.filter(([r]) => r.method === 'POST');
      expect(adds).toHaveLength(1);
      expect(adds[0][0].data.contextRef.duration).toBe(240);
    });
  });

  it('keeps two sessions that merely abut', async () => {
    // 13:00 starts exactly where the morning ends. Touching is not
    // overlapping, and a member may well want both.
    respond([morning(), afternoon()]);
    renderWithProviders(<BookCalendarPage />);

    await userEvent.click(await screen.findByRole('button', { name: /10:00–13:00/ }));
    await userEvent.click(screen.getByRole('button', { name: /13:00–16:00/ }));

    expect(screen.getByRole('button', { name: /10:00–13:00/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: /13:00–16:00/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('shows a clashing slot as a clash, not as already in the basket', async () => {
    respond([
      morning(),
      slot({
        startTime: '10:00',
        endTime: '14:00',
        duration: 240,
        available: false,
        unavailableReason: 'clashes-with-basket',
      }),
    ]);
    renderWithProviders(<BookCalendarPage />);

    expect(await screen.findByText('Overlaps one in your basket')).toBeInTheDocument();
  });
});
