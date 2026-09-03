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
  whatsOn: [],
  announcements: [],
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
  announcements: [],
  ...over,
});

const announcement = (over: Record<string, unknown> = {}) => ({
  id: 'ann-1',
  title: 'Clubhouse closed Saturday',
  description: '<p>The floor is being replaced.</p>',
  startsAt: '2026-09-01T09:00:00.000Z',
  endsAt: '2026-09-06T18:00:00.000Z',
  imageUrl: null,
  imagePlacement: null,
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

  /*
   * Removed as a card: payments have their own page, and a member's home screen
   * is for what they can act on rather than a receipt they have already had.
   */
  it('does not carry a recent-payments card', async () => {
    renderWithProviders(<HomePage />);

    await screen.findByText('Coming up');
    expect(screen.queryByText('Recent payments')).not.toBeInTheDocument();
  });

  it('leads with what is on, then what the member already holds', async () => {
    /*
     * Order, asserted by document position rather than by reading the markup:
     * "what is on" is what a member opens the home screen to find out, where a
     * membership they already hold is reference. A reorder that undid this
     * would otherwise pass every other case on the page.
     */
    renderWithProviders(<HomePage />);

    const events = await screen.findByRole('heading', { name: 'Upcoming events' });
    const memberships = screen.getByRole('heading', { name: 'Memberships' });

    // eslint-disable-next-line no-bitwise
    expect(events.compareDocumentPosition(memberships) & Node.DOCUMENT_POSITION_FOLLOWING).
      toBeTruthy();
  });

  /**
   * The basket card carries its own title, as its neighbours do.
   *
   * "Coming up" titles itself; lifting this one out made it the odd one of the
   * pair. What made the block look indented
   * was the grid — it was the second cell of a two-column row — and it has a
   * row to itself now, so the card's edge lines up regardless.
   */
  describe('the basket block', () => {
    it('titles the card from inside it, like the cards beside it', async () => {
      renderWithProviders(<HomePage />);

      const heading = await screen.findByRole('heading', { name: 'Your basket' });

      expect(heading.closest('.MuiCard-root')).not.toBeNull();
    });

    it('marks it with the same orange as the basket count in the menu', async () => {
      const { container } = renderWithProviders(<HomePage />);

      await screen.findByRole('heading', { name: 'Your basket' });
      expect(container.querySelector('[data-testid="ShoppingCartIcon"]')).toBeInTheDocument();
    });

    it('still shows what is in it, and the way to it', async () => {
      renderWithProviders(<HomePage />);

      expect(await screen.findByRole('heading', { name: 'Your basket' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to basket' })).toBeInTheDocument();
    });

    it('puts the button level with the figures, not under them', async () => {
      /*
       * A whole row off the card's height. Asserted structurally rather than by
       * pixel: the two share a flex row, which is what keeps the button pinned
       * right as the figures grow — a handling-fee line, a longer total.
       */
      renderWithProviders(<HomePage />);

      const button = await screen.findByRole('button', { name: 'Go to basket' });
      const row = button.parentElement!;

      expect(row).toHaveStyle({ display: 'flex', justifyContent: 'space-between' });
      expect(row).toHaveTextContent(/item/i);
    });
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

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining(`/${contextValue.orgCode}/browse/memberships`)
      );
      expect(mockNavigate).not.toHaveBeenCalledWith(`/${contextValue.orgCode}/memberships`);
    });

    it('carries which membership is being renewed', async () => {
      /*
       * Reported from the product: renewing from here opened a blank
       * application, while renewing the same membership from My Memberships
       * opened it filled in. `?renew=` is the whole difference — the form reads
       * it to know whose details these are, and without it the two Renew
       * buttons led to two different journeys.
       */
      const [first] = dashboard().memberships!;
      mockExecute.mockResolvedValue(
        dashboard({
          memberships: [{ ...first!, id: 'member-9', daysRemaining: 15, canRenew: true } as any],
        })
      );
      renderWithProviders(<HomePage />);

      await userEvent.click(await screen.findByRole('button', { name: 'Renew' }));

      expect(mockNavigate).toHaveBeenCalledWith(
        `/${contextValue.orgCode}/browse/memberships?renew=member-9`
      );
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
      // With `?renew=` on it — see "carries which membership is being renewed".
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining(`/${contextValue.orgCode}/browse/memberships`)
      );
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

    /*
     * The reported behaviour. Every other kind of teaser opens the thing on the
     * card; an event opened the programme it belonged to, with every row
     * collapsed — so a member who had just chosen an event was asked to find it
     * again among eighteen dates.
     */
    it('opens the event itself, not the list it is in', async () => {
      renderWithProviders(<HomePage />);

      await userEvent.click(await screen.findByText('Summer Camp'));

      expect(mockNavigate).toHaveBeenCalledWith(
        `/${contextValue.orgCode}/browse/events/event-1`
      );
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
      mockExecute.mockResolvedValue(dashboard({ cart: null }));
      renderWithProviders(<HomePage />);

      await screen.findByText('Coming up');
      expect(screen.queryByText('Your basket')).not.toBeInTheDocument();
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

/**
 * The "Coming up" card lines up with the rows beneath it.
 *
 * `Stack` sets `margin: 0` on every direct child, which cancels the negative
 * margin a spaced `Grid container` relies on. The container was a direct child
 * of the page's `Stack`, so its item kept `padding-left: 16px` with nothing to
 * take it back and the card sat 16px right of every other section. jsdom
 * computes no layout, so this asserts the structure that caused it rather than
 * the pixels: the container must sit inside something, not directly under the
 * Stack.
 */
describe('HomePage — Coming up alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    mockExecute.mockResolvedValue(dashboard());
  });

  it('does not hang a grid container directly off the page Stack', async () => {
    renderWithProviders(<HomePage />);

    await screen.findByText('Coming up');

    const containers = document.querySelectorAll('.MuiGrid-container');
    expect(containers.length).toBeGreaterThan(0);

    for (const container of containers) {
      expect(container.parentElement?.classList.contains('MuiStack-root')).toBe(false);
    }
  });

  it('wraps it the way the sections below it are wrapped', async () => {
    renderWithProviders(<HomePage />);

    const heading = await screen.findByText('Coming up');
    const container = heading.closest('.MuiGrid-container');

    expect(container).not.toBeNull();
    // A plain Box, exactly as "Upcoming events" and "Shop" already do it.
    expect(container!.parentElement?.className).toContain('MuiBox-root');
  });
});

/**
 * Who the entry is for, on the home page.
 *
 * A parent holds every entry in the household on one login. Four children in
 * the same class made four rows reading "Spring Hunter Trials · Class 2" and
 * nothing else — the child was the only thing that told them apart, and the
 * only thing the row did not say.
 */
describe('HomePage — who the entry is for', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
  });

  it('names the entrant beside the class', async () => {
    mockExecute.mockResolvedValue(
      dashboard({
        comingUp: [
          {
            kind: 'entry',
            id: 'entry-1',
            title: 'Spring Hunter Trials',
            detail: 'Class 2',
            entrantName: 'Rónán McGrath',
            on: '2026-09-14',
            startTime: null,
            status: 'confirmed',
          },
        ],
      })
    );

    renderWithProviders(<HomePage />);

    expect(await screen.findByText(/Rónán McGrath/)).toBeInTheDocument();
    expect(screen.getByText(/Class 2/)).toBeInTheDocument();
  });

  it('tells two entries in the same class apart', async () => {
    mockExecute.mockResolvedValue(
      dashboard({
        comingUp: [
          { kind: 'entry', id: 'e-1', title: 'Spring Hunter Trials', detail: 'Class 2', entrantName: 'Rónán McGrath', on: '2026-09-14', startTime: null, status: 'confirmed' },
          { kind: 'entry', id: 'e-2', title: 'Spring Hunter Trials', detail: 'Class 2', entrantName: 'Éabha McGrath', on: '2026-09-14', startTime: null, status: 'confirmed' },
        ],
      })
    );

    renderWithProviders(<HomePage />);

    expect(await screen.findByText(/Rónán McGrath/)).toBeInTheDocument();
    expect(screen.getByText(/Éabha McGrath/)).toBeInTheDocument();
  });

  /* A booking is made by the account holder, so there is nobody else to name. */
  it('adds nothing to a booking', async () => {
    mockExecute.mockResolvedValue(
      dashboard({
        comingUp: [
          {
            kind: 'booking',
            id: 'booking-1',
            title: 'Court 1',
            detail: '10:00–11:00',
            entrantName: null,
            on: '2026-09-15',
            startTime: '10:00',
            status: 'confirmed',
          },
        ],
      })
    );

    renderWithProviders(<HomePage />);

    const line = await screen.findByText(/10:00–11:00/);
    // The date and the time, and no trailing separator where a name would be.
    expect(line.textContent).not.toMatch(/·\s*$/);
  });
});

/**
 * How the teasers are laid out.
 *
 * Four across was right when this column was the whole page. It is two thirds
 * of one once a club has notices to show, and four cards in that space squash
 * an event's name into three lines.
 */
describe('B3 — the rows of teasers', () => {
  it('lays them out three across, not four', async () => {
    mockExecute.mockResolvedValue(dashboard());

    const { container } = renderWithProviders(<HomePage />);
    await screen.findByText(/Welcome back/);

    // The cards are `md={4}`; nothing on this page is four-across any more.
    expect(container.querySelectorAll('.MuiGrid-grid-md-3')).toHaveLength(0);
    expect(container.querySelectorAll('.MuiGrid-grid-md-4').length).toBeGreaterThan(0);
  });

  it('keeps every row of them the same width', async () => {
    /*
     * Events, external events, memberships, bookings, registrations and the
     * shop are the same kind of card in the same column. One row a different
     * width from the rest reads as a mistake, which is why they share a single
     * definition rather than six literals.
     */
    // The default fixture already spans three of the six rows: an event, a
    // shop item and a membership.
    mockExecute.mockResolvedValue(dashboard());

    const { container } = renderWithProviders(<HomePage />);
    await screen.findByText(/Welcome back/);

    /*
     * Every grid item that holds a teaser, whatever section it is in. The two
     * summary cells at the top (`md={6}`) and the announcements column are not
     * teasers and are left out by looking only at the small breakpoints these
     * carry.
     */
    const teasers = Array.from(container.querySelectorAll('.MuiGrid-grid-sm-6'));
    // Three sections' worth in this fixture: an event, a shop item, a membership.
    expect(teasers).toHaveLength(3);
    for (const teaser of teasers) {
      expect(teaser.className).toContain('MuiGrid-grid-md-4');
    }
  });
});

/**
 * The club's notices, in the right-hand third.
 *
 * Two requirements pull against each other and both have to hold: with
 * announcements the page is two thirds and one third, and **without** them it
 * is the page exactly as it was before this feature existed — not the same page
 * inside a grid that happens to be full width.
 */
describe('B3 — announcements', () => {
  const withNotices = (...announcements: unknown[]) =>
    mockExecute.mockResolvedValue(dashboard({ announcements } as never));

  it('shows what the club is saying, under a heading that says who is speaking', async () => {
    // Without a heading a photograph in a sidebar reads as an advertisement.
    withNotices(announcement());

    renderWithProviders(<HomePage />);

    expect(await screen.findByText('Notices')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Clubhouse closed Saturday' })).toBeInTheDocument();
    expect(screen.getByText('The floor is being replaced.')).toBeInTheDocument();
  });

  it('gives the notices a third and the rest of the page two', async () => {
    withNotices(announcement());

    const { container } = renderWithProviders(<HomePage />);
    await screen.findByText('Notices');

    expect(container.querySelector('.MuiGrid-grid-md-8')).not.toBeNull();
    expect(container.querySelector('.MuiGrid-grid-md-4')).not.toBeNull();
  });

  it('puts them first on a narrow screen', async () => {
    /*
     * The club is telling its members something, and on a phone the
     * alternative is a notice nobody scrolls to. `order: -1` is the base rule;
     * the `md` override that restores the right-hand column lives in a media
     * query, which jsdom does not apply — so what is asserted here is exactly
     * the narrow-screen case.
     */
    withNotices(announcement());

    const { container } = renderWithProviders(<HomePage />);
    await screen.findByText('Notices');

    const column = screen.getByTestId('announcements-column');
    /*
     * Read from the emitted rule rather than from `getComputedStyle`: Emotion
     * injects a class, and jsdom does not resolve it back to a computed value.
     */
    const rules = Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent ?? '')
      .join('');
    const ordering = Array.from(column.classList).find((name) =>
      new RegExp(`\\.${name}\\b[^{]*\\{[^}]*order:-1`).test(rules)
    );
    expect(ordering).toBeDefined();
  });

  it('shows several, newest first as the server sent them', async () => {
    withNotices(
      announcement(),
      announcement({ id: 'ann-2', title: 'Summer camp booking is open' })
    );

    renderWithProviders(<HomePage />);

    const headings = await screen.findAllByRole('heading', { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Clubhouse closed Saturday',
      'Summer camp booking is open',
    ]);
  });

  it('leaves the page exactly as it was when there is nothing to say', async () => {
    /*
     * A club without the capability and a club with nothing showing are the
     * same case. No column, and no wrapping grid either — `md={12}` and no
     * wrapper are not quite the same thing, and the difference shows up in the
     * margins of every card below.
     */
    mockExecute.mockResolvedValue(dashboard());

    const { container } = renderWithProviders(<HomePage />);
    await screen.findByText(/Welcome back/);

    expect(screen.queryByText('Notices')).not.toBeInTheDocument();
    expect(container.querySelector('.MuiGrid-grid-md-8')).toBeNull();
  });

  it('renders a background notice over a darkened picture', async () => {
    // The club uploads whatever photograph it has; legibility is the card's job.
    withNotices(
      announcement({ imageUrl: 'https://signed.example.test/x.jpg', imagePlacement: 'background' })
    );

    renderWithProviders(<HomePage />);

    expect(await screen.findByTestId('announcement-scrim')).toBeInTheDocument();
  });
});
