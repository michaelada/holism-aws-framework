import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from '../HomePage';
import { makeOrganisationContext, renderWithProviders } from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';
import { AccountDashboard } from '../../types/account';

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

/** A club with nothing enabled: every optional section absent. */
const empty = (): AccountDashboard => ({
  memberships: null,
  comingUp: null,
  cart: null,
  recentPayments: null,
  whatsOn: [],
});

const dashboard = (over: Partial<AccountDashboard> = {}): AccountDashboard => ({
  memberships: [
    {
      id: 'member-1',
      name: 'Family Membership 2026',
      memberName: 'Niamh Walsh',
      membershipNumber: 'KHPC-0412',
      validUntil: '2027-02-25',
      daysRemaining: 200,
      canRenew: false,
      renewalNotOpen: false,
    },
  ],
  comingUp: [
    {
      kind: 'entry',
      id: 'entry-1',
      title: 'Spring Hunter Trials',
      detail: 'Class 2',
      on: '2026-09-14',
      startTime: null,
      status: 'confirmed',
    },
    {
      kind: 'booking',
      id: 'booking-1',
      title: 'Court 1',
      detail: '10:00–11:00',
      on: '2026-09-14',
      startTime: '10:00',
      status: 'awaiting-payment',
    },
  ],
  cart: { itemCount: 4, total: 28845, handlingFee: 145, currency: 'EUR' },
  recentPayments: [
    { id: 'pay-1', total: 4500, status: 'paid', currency: 'EUR', on: '2026-01-12T00:00:00.000Z' },
  ],
  whatsOn: [
    {
      kind: 'event',
      id: 'event-1',
      title: 'Summer Camp',
      detail: null,
      fee: null,
      startDate: '2026-09-01',
      endDate: null,
      entriesOpenDate: '2026-07-01T09:00:00Z',
      entriesClosingDate: '2026-10-01T09:00:00Z',
      entriesLimit: null,
      placesRemaining: null,
      icon: null,
      colour: null,
    },
    {
      kind: 'merchandise',
      id: 'item-1',
      title: 'Club Polo',
      detail: null,
      fee: 2500,
      startDate: null,
      endDate: null,
      entriesOpenDate: null,
      entriesClosingDate: null,
      entriesLimit: null,
      placesRemaining: null,
      icon: null,
      colour: null,
    },
  ],
  ...over,
});

/**
 * B3 — the member's home screen.
 *
 * **Absent, not empty.** A `null` section means the club has not enabled that
 * area, and the card is not rendered at all: an empty "Your basket" for a club
 * that sells nothing reads as a broken page, and a member cannot tell it apart
 * from having an empty basket.
 *
 * Nothing on this screen computes anything — the renewal rule, the cart total
 * and the statuses all arrive decided.
 */
describe('HomePage (B3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    mockExecute.mockResolvedValue(dashboard());
  });

  it('greets the member and names the club', async () => {
    renderWithProviders(<HomePage />);

    expect(await screen.findByText(/Welcome back/)).toBeInTheDocument();
    expect(
      screen.getByText(contextValue.me!.organisation.displayName)
    ).toBeInTheDocument();
  });

  it('asks for the whole dashboard in one request', async () => {
    renderWithProviders(<HomePage />);

    await screen.findByText('Coming up');
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith({
      url: `/api/account/${contextValue.orgCode}/dashboard`,
    });
  });

  it('shows what is coming up, entries and bookings together', async () => {
    renderWithProviders(<HomePage />);

    expect(await screen.findByText('Spring Hunter Trials')).toBeInTheDocument();
    expect(screen.getByText('Court 1')).toBeInTheDocument();
    // Each carries the status it arrived with.
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Awaiting payment')).toBeInTheDocument();
  });

  it('gives every membership its own card, named for the member', async () => {
    // A parent holding four needs all four, not the soonest with the rest
    // hidden until they think to open C4.
    const [first] = dashboard().memberships!;
    mockExecute.mockResolvedValue(
      dashboard({
        memberships: [
          { ...first!, id: 'm1', memberName: 'Conor McGrath' },
          { ...first!, id: 'm2', memberName: 'Éabha McGrath' },
          { ...first!, id: 'm3', memberName: 'Rónán McGrath' },
        ],
      })
    );
    renderWithProviders(<HomePage />);

    expect(await screen.findByText('Memberships')).toBeInTheDocument();
    expect(screen.getByText('Conor McGrath')).toBeInTheDocument();
    expect(screen.getByText('Éabha McGrath')).toBeInTheDocument();
    expect(screen.getByText('Rónán McGrath')).toBeInTheDocument();
  });

  it('shows the membership card with its number', async () => {
    renderWithProviders(<HomePage />);

    expect(await screen.findByText('Family Membership 2026')).toBeInTheDocument();
    expect(screen.getByText(/KHPC-0412/)).toBeInTheDocument();
  });

  it('renders no memberships section when the member holds none', async () => {
    mockExecute.mockResolvedValue(dashboard({ memberships: [] }));
    renderWithProviders(<HomePage />);

    await screen.findByText('Upcoming events');
    // An empty heading is worse than no heading.
    expect(screen.queryByText('Memberships')).not.toBeInTheDocument();
  });

  it('shows the basket with its handling fee', async () => {
    renderWithProviders(<HomePage />);

    expect(await screen.findByText(/4 items · €288\.45/)).toBeInTheDocument();
    expect(screen.getByText(/incl\. €1\.45 handling/)).toBeInTheDocument();
  });

  it('shows recent payments', async () => {
    renderWithProviders(<HomePage />);

    expect(await screen.findByText('Recent payments')).toBeInTheDocument();
    expect(screen.getByText('€45.00')).toBeInTheDocument();
  });

  /**
   * The card is the link.
   *
   * Each membership card carried a "View memberships" button. With four cards
   * in the row that was the same words four times, while the obvious target —
   * the card itself — did nothing at all.
   */
  describe('opening a membership from the home screen', () => {
    it('takes the whole card to My Memberships', async () => {
      renderWithProviders(<HomePage />);

      const [first] = dashboard().memberships!;
      await screen.findByText(first!.memberName as string);

      await userEvent.click(screen.getByText(first!.memberName as string));

      expect(mockNavigate).toHaveBeenCalledWith(`/${contextValue.orgCode}/memberships`);
    });

    it('no longer repeats a link inside every card', async () => {
      renderWithProviders(<HomePage />);

      await screen.findByText('Memberships');
      expect(screen.queryByRole('button', { name: 'View memberships' })).not.toBeInTheDocument();
    });

    it('keeps renew as its own button, not folded into the card', async () => {
      /*
       * Renewal goes somewhere else — the membership catalogue — so it stays a
       * separate control. Nesting it inside the card's own button would also be
       * invalid markup that browsers resolve by firing both.
       */
      const [first] = dashboard().memberships!;
      mockExecute.mockResolvedValue(
        dashboard({ memberships: [{ ...first!, daysRemaining: 10, canRenew: true } as any] })
      );
      renderWithProviders(<HomePage />);

      await userEvent.click(await screen.findByRole('button', { name: 'Renew' }));

      expect(mockNavigate).toHaveBeenCalledWith(`/${contextValue.orgCode}/browse/memberships`);
      expect(mockNavigate).not.toHaveBeenCalledWith(`/${contextValue.orgCode}/memberships`);
    });
  });

  describe('renewal, on the card that needs it', () => {
    const withMembership = (over: Record<string, unknown>) => {
      const [first] = dashboard().memberships!;
      return dashboard({ memberships: [{ ...first!, ...over } as any] });
    };

    it('offers a renew button when the membership is nearly up', async () => {
      mockExecute.mockResolvedValue(withMembership({ daysRemaining: 12, canRenew: true }));
      renderWithProviders(<HomePage />);

      expect(await screen.findByText(/Expires in 12 days/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Renew' }));
      expect(mockNavigate).toHaveBeenCalledWith(`/${contextValue.orgCode}/browse/memberships`);
    });

    /** The same third condition as C4: due, but nothing open to renew into. */
    it('explains instead when the club has not opened renewals', async () => {
      mockExecute.mockResolvedValue(
        withMembership({ canRenew: false, renewalNotOpen: true })
      );
      renderWithProviders(<HomePage />);

      expect(await screen.findByText(/has not opened renewals yet/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Renew' })).not.toBeInTheDocument();
    });

    it('offers renewal only on the membership that needs it', async () => {
      const [first] = dashboard().memberships!;
      mockExecute.mockResolvedValue(
        dashboard({
          memberships: [
            { ...first!, id: 'm1', memberName: 'Due Soon', daysRemaining: 9, canRenew: true },
            { ...first!, id: 'm2', memberName: 'Months Left' },
          ],
        })
      );
      renderWithProviders(<HomePage />);

      await screen.findByText('Due Soon');
      expect(screen.getAllByRole('button', { name: 'Renew' })).toHaveLength(1);
    });

    it('says nothing while the membership has a long way to run', async () => {
      renderWithProviders(<HomePage />);

      await screen.findByText('Family Membership 2026');
      expect(screen.queryByText(/Expires in/)).not.toBeInTheDocument();
    });
  });

  describe('what’s on', () => {
    it('teases a few things and leads each to the screen that can do it', async () => {
      renderWithProviders(<HomePage />);

      await userEvent.click(await screen.findByText('Club Polo'));
      expect(mockNavigate).toHaveBeenCalledWith(`/${contextValue.orgCode}/shop/item-1`);
    });

    it('sends a calendar teaser to that calendar', async () => {
      mockExecute.mockResolvedValue(
        dashboard({
          // Named differently from the booking on the "coming up" card: the
          // same court legitimately appears in both, and the click has to be
          // aimed at the teaser.
          whatsOn: [
            {
              kind: 'calendar',
              id: 'cal-1',
              title: 'Court 2',
              detail: null,
              fee: null,
              startDate: null,
              endDate: null,
              entriesOpenDate: null,
              entriesClosingDate: null,
              entriesLimit: null,
              placesRemaining: null,
              icon: null,
              colour: null,
            },
          ],
        })
      );
      renderWithProviders(<HomePage />);

      await userEvent.click(await screen.findByText('Court 2'));
      expect(mockNavigate).toHaveBeenCalledWith(`/${contextValue.orgCode}/book/cal-1`);
    });

    it('sends a registration teaser to that scheme', async () => {
      mockExecute.mockResolvedValue(
        dashboard({
          whatsOn: [
            { kind: 'registration', id: 'rt-1', title: 'Horse registration', detail: 'Horse', fee: 4500 },
          ],
        })
      );
      renderWithProviders(<HomePage />);

      await userEvent.click(await screen.findByText('Horse registration'));
      expect(mockNavigate).toHaveBeenCalledWith(
        `/${contextValue.orgCode}/register-interest/rt-1`
      );
    });

    it('prices a teaser only when the thing has one price', async () => {
      renderWithProviders(<HomePage />);

      await screen.findByText('Club Polo');
      // An event's price lives on its activities and they differ, so it has none.
      expect(screen.getByText('€25.00')).toBeInTheDocument();
    });

    it('gives bookings their own row under the club’s own word for them', async () => {
      contextValue = makeOrganisationContext({
        publicDetail: {
          ...(makeOrganisationContext().publicDetail as any),
          branding: { logoUrl: '', primaryColor: '#1976d2', bookingsLabel: 'Court Booking' },
        },
      } as any);

      mockExecute.mockResolvedValue(
        dashboard({
          whatsOn: [
            {
              kind: 'merchandise', id: 'm1', title: 'Club Polo', detail: null, fee: 2500,
              startDate: null, endDate: null, entriesOpenDate: null, entriesClosingDate: null,
              entriesLimit: null, placesRemaining: null, icon: null, colour: null,
            },
            {
              kind: 'calendar', id: 'c1', title: 'Outdoor arena', detail: null, fee: null,
              startDate: null, endDate: null, entriesOpenDate: null, entriesClosingDate: null,
              entriesLimit: null, placesRemaining: null, icon: 'equestrian', colour: '#2e7d32',
            },
          ],
        })
      );
      renderWithProviders(<HomePage />);

      // Three rows now: bookings under the club's word, the shop under its own
      // heading, and "What's on" only for what belongs in neither.
      expect(await screen.findByText('Court Booking')).toBeInTheDocument();
      expect(screen.getByText('Shop')).toBeInTheDocument();
      expect(screen.getByText('Outdoor arena')).toBeInTheDocument();
      expect(screen.getByText('Club Polo')).toBeInTheDocument();
      // Nothing left for the general row, so it is absent rather than empty.
      expect(screen.queryByText('Upcoming events')).not.toBeInTheDocument();
    });

    it('does not head a bookings row when the club has no calendars', async () => {
      renderWithProviders(<HomePage />);

      await screen.findByText('Summer Camp');
      // The default fixture has no calendar teaser, so no second heading.
      expect(screen.queryByText('Bookings')).not.toBeInTheDocument();
    });

    it('offers a way through to the full events list', async () => {
      // Four teasers look like the whole programme, and a member who reads them
      // as such never opens the events page.
      renderWithProviders(<HomePage />);

      await screen.findByText('Upcoming events');
      await userEvent.click(screen.getByRole('button', { name: 'View all' }));

      expect(mockNavigate).toHaveBeenCalledWith(`/${contextValue.orgCode}/browse/events`);
    });

    it('dates an event teaser with a calendar tile', async () => {
      renderWithProviders(<HomePage />);

      await screen.findByText('Summer Camp');
      // The tile is announced as one date rather than as four scraps of text.
      expect(
        screen.getByRole('group', { name: /1 September 2026/ })
      ).toBeInTheDocument();
    });

    it('shows the entry status beneath an event teaser', async () => {
      renderWithProviders(<HomePage />);

      await screen.findByText('Summer Camp');
      expect(screen.getByText('Open')).toBeInTheDocument();
    });

    it('gives a shop item no date and no entry status', async () => {
      renderWithProviders(<HomePage />);

      await screen.findByText('Club Polo');
      // Only one teaser has a window, so only one status chip may exist.
      expect(screen.queryAllByText('Open')).toHaveLength(1);
    });
  });

  describe('sections the club has not enabled', () => {
    it('renders no card at all rather than an empty one', async () => {
      mockExecute.mockResolvedValue(dashboard({ cart: null, recentPayments: null }));
      renderWithProviders(<HomePage />);

      await screen.findByText('Coming up');
      expect(screen.queryByText('Your basket')).not.toBeInTheDocument();
      expect(screen.queryByText('Recent payments')).not.toBeInTheDocument();
    });

    it('says something rather than showing a page of whitespace', async () => {
      mockExecute.mockResolvedValue(empty());
      renderWithProviders(<HomePage />);

      expect(await screen.findByText(/nothing here yet/i)).toBeInTheDocument();
    });
  });

  it('reports a failure rather than a blank dashboard', async () => {
    mockExecute.mockRejectedValue(new Error('network'));
    renderWithProviders(<HomePage />);

    expect(await screen.findByText(/could not load your home page/i)).toBeInTheDocument();
  });
});
