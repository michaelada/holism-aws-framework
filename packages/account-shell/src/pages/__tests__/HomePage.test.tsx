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
  membership: null,
  comingUp: null,
  cart: null,
  recentPayments: null,
  whatsOn: [],
});

const dashboard = (over: Partial<AccountDashboard> = {}): AccountDashboard => ({
  membership: {
    id: 'member-1',
    name: 'Family Membership 2026',
    membershipNumber: 'KHPC-0412',
    validUntil: '2027-02-25',
    daysRemaining: 200,
    canRenew: false,
    renewalNotOpen: false,
  },
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
    { kind: 'event', id: 'event-1', title: 'Summer Camp', detail: null, fee: null },
    { kind: 'merchandise', id: 'item-1', title: 'Club Polo', detail: null, fee: 2500 },
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

  it('shows the membership card with its number', async () => {
    renderWithProviders(<HomePage />);

    expect(await screen.findByText('Family Membership 2026')).toBeInTheDocument();
    expect(screen.getByText(/KHPC-0412/)).toBeInTheDocument();
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

  describe('the renewal banner', () => {
    it('leads the page when a membership is nearly up', async () => {
      mockExecute.mockResolvedValue(
        dashboard({
          membership: {
            ...dashboard().membership!,
            daysRemaining: 12,
            canRenew: true,
          },
        })
      );
      renderWithProviders(<HomePage />);

      expect(await screen.findByText(/expires in 12 days/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Renew' }));
      expect(mockNavigate).toHaveBeenCalledWith(`/${contextValue.orgCode}/browse/memberships`);
    });

    /** The same third condition as C4: due, but nothing open to renew into. */
    it('explains instead when the club has not opened renewals', async () => {
      mockExecute.mockResolvedValue(
        dashboard({
          membership: { ...dashboard().membership!, canRenew: false, renewalNotOpen: true },
        })
      );
      renderWithProviders(<HomePage />);

      expect(await screen.findByText(/has not opened renewals yet/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Renew' })).not.toBeInTheDocument();
    });

    it('says nothing while the membership has a long way to run', async () => {
      renderWithProviders(<HomePage />);

      await screen.findByText('Family Membership 2026');
      expect(screen.queryByText(/expires in/)).not.toBeInTheDocument();
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
          whatsOn: [{ kind: 'calendar', id: 'cal-1', title: 'Court 2', detail: null, fee: null }],
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
