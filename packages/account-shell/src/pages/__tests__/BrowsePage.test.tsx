import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BrowsePage from '../BrowsePage';
import {
  makeOrganisationContext,
  renderWithProviders,
  TEST_ME,
} from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';

const mockExecute = vi.fn();
let contextValue: AccountOrganisationContextValue = makeOrganisationContext();

vi.mock('../../hooks/useAccountApi', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useAccountApi')>(
    '../../hooks/useAccountApi'
  );
  return {
    ...actual,
    useAccountApi: () => ({ execute: mockExecute, loading: false, error: null, reset: () => undefined }),
  };
});

vi.mock('../../context/AccountOrganisationContext', async () => {
  const actual = await vi.importActual<
    typeof import('../../context/AccountOrganisationContext')
  >('../../context/AccountOrganisationContext');
  return { ...actual, useAccountOrganisation: () => contextValue };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const activity = (over: Record<string, unknown> = {}) => ({
  id: 'act-1',
  name: 'Junior Single Sculls',
  description: null,
  entriesLimit: null,
  termsAndConditions: null,
  fee: 2500,
  handlingFeeIncluded: true,
  applicationFormId: null,
  allowSpecifyQuantity: false,
  supportedPaymentMethodIds: ['pm-card'],
  placesRemaining: null,
  available: true,
  unavailableReason: null,
  ...over,
});

const event = (over: Record<string, unknown> = {}) => ({
  id: 'event-1',
  name: 'Summer Regatta',
  description: null,
  startDate: '2026-07-01',
  endDate: '2026-07-02',
  entriesOpenDate: null,
  entriesClosingDate: '2026-06-20',
  entriesLimit: null,
  placesRemaining: null,
  available: true,
  unavailableReason: null,
  activities: [activity()],
  ...over,
});

const withCapabilities = (capabilities: string[]) =>
  makeOrganisationContext({
    capabilities,
    me: { ...TEST_ME, organisation: { ...TEST_ME.organisation, capabilities } },
  });

const respond = (events: unknown[] = [event()], types: unknown[] = []) => {
  mockExecute.mockImplementation((request: { url: string; method?: string }) => {
    if (request.method === 'POST') return Promise.resolve({});
    if (request.url.includes('membership-types')) return Promise.resolve(types);
    return Promise.resolve(events);
  });
};

/**
 * Events and memberships are separate pages now, not tabs — so a test picks the
 * one it means rather than clicking across.
 */
const render = (section: 'events' | 'memberships' = 'events') =>
  renderWithProviders(<BrowsePage section={section} />, {
    route: `/khpc/browse/${section}`,
    path: '/:orgCode/browse/:section',
  });

describe('BrowsePage (D1/D4)', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockNavigate.mockReset();
    contextValue = withCapabilities(['event-management', 'memberships']);
    respond();
  });

  it('lists the events and their activities', async () => {
    render();
    expect(await screen.findByText('Summer Regatta')).toBeInTheDocument();
    expect(screen.getByText('Junior Single Sculls')).toBeInTheDocument();
  });

  it('adds an activity to the basket', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Add to basket' }));

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/api/account/khpc/cart/items',
          data: expect.objectContaining({
            itemType: 'event_entry',
            unitFee: 2500,
          }),
        })
      )
    );
  });

  it('re-reads the catalogue after adding, in case that was the last place', async () => {
    const user = userEvent.setup();
    render();

    await waitFor(() => expect(screen.getByText('Summer Regatta')).toBeInTheDocument());
    const before = mockExecute.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Add to basket' }));

    await waitFor(() => expect(mockExecute.mock.calls.length).toBeGreaterThan(before + 1));
  });

  /**
   * Unavailable things are shown with their reason rather than hidden — a
   * member looking for an event they know exists is better served by "entries
   * closed" than by an empty list.
   */
  /**
   * The entry window and capacity, which decide whether a member enters now or
   * assumes there is time. These render from dates and counts rather than from
   * the server's `unavailableReason`, so they need their own coverage.
   */
  describe('entry window and capacity', () => {
    const inDays = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString();
    };

    it('says entries are not open yet for a distant opening date', async () => {
      respond([event({ entriesOpenDate: inDays(60), entriesClosingDate: inDays(90) })]);
      render();

      expect(await screen.findByText(/Entries open/)).toBeInTheDocument();
    });

    it('counts down when entries open soon', async () => {
      respond([event({ entriesOpenDate: inDays(3), entriesClosingDate: inDays(30) })]);
      render();

      expect(await screen.findByText('Entries open in 3 days')).toBeInTheDocument();
    });

    it('warns when entries are closing soon', async () => {
      respond([event({ entriesClosingDate: inDays(2) })]);
      render();

      expect(await screen.findByText('Closes in 2 days')).toBeInTheDocument();
    });

    it('shows the event limit and what is left of it', async () => {
      respond([event({ entriesClosingDate: inDays(30), entriesLimit: 50, placesRemaining: 12 })]);
      render();

      expect(await screen.findByText('12 of 50 places left')).toBeInTheDocument();
    });

    it('says entries are full when nothing is left', async () => {
      respond([event({ entriesClosingDate: inDays(30), entriesLimit: 50, placesRemaining: 0 })]);
      render();

      expect(await screen.findByText('Entries full')).toBeInTheDocument();
    });

    /**
     * "Entries closed" beside "3 places left" reads as an invitation to try
     * anyway, and the places are not really available.
     */
    it('hides the places count once the window has shut', async () => {
      respond([
        event({
          entriesClosingDate: inDays(-5),
          entriesLimit: 50,
          placesRemaining: 3,
          available: false,
          unavailableReason: 'entries-closed',
        }),
      ]);
      render();

      expect(await screen.findByText(/Entries closed/)).toBeInTheDocument();
      expect(screen.queryByText(/places left/)).not.toBeInTheDocument();
    });

    it('renders the date as a calendar tile', async () => {
      respond([event({ startDate: '2026-08-20', endDate: '2026-08-20' })]);
      render();

      expect(await screen.findByText('AUG')).toBeInTheDocument();
      expect(screen.getByText('Thursday')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
    });
  });

  it('explains why a closed event cannot be entered', async () => {
    respond([event({ available: false, unavailableReason: 'entries-closed' })]);
    render();

    expect(await screen.findByText('Summer Regatta')).toBeInTheDocument();
    // The chip names the date — "entries closed" alone leaves a member
    // wondering whether they missed it by a day or a month.
    expect(screen.getAllByText(/Entries closed/).length).toBeGreaterThan(0);
  });

  it('offers no add button for a full activity', async () => {
    respond([
      event({
        activities: [
          activity({ available: false, unavailableReason: 'activity-full', placesRemaining: 0 }),
        ],
      }),
    ]);
    render();

    expect(await screen.findByText('Full')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to basket' })).not.toBeInTheDocument();
  });

  it('says so when the member has already entered', async () => {
    respond([
      event({ activities: [activity({ available: false, unavailableReason: 'already-entered' })] }),
    ]);
    render();

    expect(await screen.findByText('Already entered')).toBeInTheDocument();
  });

  it('warns about remaining places only when the number is small', async () => {
    respond([event({ activities: [activity({ placesRemaining: 2 })] })]);
    render();

    // "47 places left" is noise; "2 places left" is why someone acts now.
    expect(await screen.findByText(/2 places left/)).toBeInTheDocument();
  });

  it('does not count down a cap that is nowhere near reached', async () => {
    respond([event({ activities: [activity({ placesRemaining: 47 })] })]);
    render();

    await waitFor(() => expect(screen.getByText('Junior Single Sculls')).toBeInTheDocument());
    expect(screen.queryByText(/places left/)).not.toBeInTheDocument();
  });

  it('shows membership types on their own tab', async () => {
    const user = userEvent.setup();
    respond(
      [event()],
      [
        {
          id: 'mt-1',
          name: 'Full Member',
          description: null,
          validUntil: '2026-12-31',
          membershipFormId: null,
          automaticallyApprove: false,
          fee: 5000,
          handlingFeeIncluded: true,
          supportedPaymentMethodIds: ['pm-card'],
          available: true,
          unavailableReason: null,
        },
      ]
    );
    render();

    render('memberships');

    // No tab to click: the memberships catalogue is its own page.
    expect(await screen.findByText('Full Member')).toBeInTheDocument();
  });

  it('requests only what the club has enabled', async () => {
    contextValue = withCapabilities(['event-management']);
    render();

    await waitFor(() => expect(mockExecute).toHaveBeenCalled());
    const urls = mockExecute.mock.calls.map((call) => call[0].url);
    expect(urls.some((url: string) => url.includes('membership-types'))).toBe(false);
  });

  /**
   * A membership with no form submission is paid for and then fails at
   * fulfilment, because `members.form_submission_id` is NOT NULL. Collecting
   * the answers before the item enters the basket is what closes that.
   */
  it('sends the member to the entry page for an item with terms but no form', async () => {
    const user = userEvent.setup();
    respond([
      event({
        activities: [activity({ applicationFormId: null, termsAndConditions: 'Be careful.' })],
      }),
    ]);
    render();

    await user.click(await screen.findByRole('button', { name: 'Add to basket' }));

    const posts = mockExecute.mock.calls.filter((call) => call[0].method === 'POST');
    expect(posts).toHaveLength(0);
    expect(mockNavigate).toHaveBeenCalledWith('/khpc/browse/events/act-1/enter');
  });

  it('sends the member to the entry page for an item with a form', async () => {
    const user = userEvent.setup();
    respond([event({ activities: [activity({ applicationFormId: 'form-1' })] })]);
    render();

    await user.click(await screen.findByRole('button', { name: 'Add to basket' }));

    // Nothing has been added yet — the form comes first, and it is now a page
    // rather than a dialog, because club forms can be long and terms have to be
    // readable.
    const posts = mockExecute.mock.calls.filter((call) => call[0].method === 'POST');
    expect(posts).toHaveLength(0);
    expect(mockNavigate).toHaveBeenCalledWith('/khpc/browse/events/act-1/enter');
  });

  it('adds straight away when there is no form to complete', async () => {
    const user = userEvent.setup();
    respond([event({ activities: [activity({ applicationFormId: null })] })]);
    render();

    await user.click(await screen.findByRole('button', { name: 'Add to basket' }));

    await waitFor(() =>
      expect(
        mockExecute.mock.calls.some((call) => call[0].method === 'POST')
      ).toBe(true)
    );
  });

  /**
   * An earlier version added membership lines at zero, on the assumption that
   * pricing lived on the application form. It does not — it is a property of
   * the membership type — so every membership was free.
   */
  it('adds a membership at the price the club set', async () => {
    const user = userEvent.setup();
    contextValue = withCapabilities(['memberships']);
    respond(
      [],
      [
        {
          id: 'mt-1',
          name: 'Full Member',
          description: null,
          validUntil: '2026-12-31',
          membershipFormId: null,
          automaticallyApprove: false,
          fee: 5000,
          handlingFeeIncluded: true,
          supportedPaymentMethodIds: ['pm-card'],
          available: true,
          unavailableReason: null,
        },
      ]
    );
    // Explicit now: the section comes from the route rather than being inferred
    // from which capability happens to be enabled.
    render('memberships');

    expect(await screen.findByText('€50.00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({ itemType: 'membership', unitFee: 5000 }),
        })
      )
    );
  });

  it('reports a failure to load', async () => {
    mockExecute.mockRejectedValue(new Error('offline'));
    render();

    expect(await screen.findByText('We could not load what is available.')).toBeInTheDocument();
  });
});
