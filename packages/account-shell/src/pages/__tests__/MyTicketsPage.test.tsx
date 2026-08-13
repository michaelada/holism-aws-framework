import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyTicketsPage from '../MyTicketsPage';
import {
  makeOrganisationContext,
  renderWithProviders,
} from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';
import { AccountTicketSummary } from '../../types/account';

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

const ticket = (over: Partial<AccountTicketSummary> = {}): AccountTicketSummary => ({
  id: 'ticket-1',
  ticketReference: 'TKT-2026-000001',
  state: 'valid',
  eventId: 'event-1',
  eventName: 'Spring Show',
  activityName: 'Class 3',
  eventStartDate: '2026-09-12',
  eventEndDate: '2026-09-12',
  entrantName: 'Ada Adams',
  validUntil: '2026-09-12T23:59:59.000Z',
  scannedAt: null,
  ...over,
});

describe('MyTicketsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    mockExecute.mockResolvedValue([ticket()]);
  });

  it('loads the tickets for the organisation', async () => {
    renderWithProviders(<MyTicketsPage />);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith({
        url: `/api/account/${contextValue.orgCode}/tickets`,
      });
    });
  });

  it('shows the entrant name, the event and the reference', async () => {
    renderWithProviders(<MyTicketsPage />);

    expect(await screen.findByText('Ada Adams')).toBeInTheDocument();
    expect(screen.getByText(/Spring Show/)).toBeInTheDocument();
    expect(screen.getByText(/TKT-2026-000001/)).toBeInTheDocument();
  });

  it('opens the ticket when a row is clicked', async () => {
    renderWithProviders(<MyTicketsPage />);

    await userEvent.click(await screen.findByText('Ada Adams'));

    expect(mockNavigate).toHaveBeenCalledWith(`/${contextValue.orgCode}/tickets/ticket-1`);
  });

  /**
   * A member whose ticket will not scan is the person most in need of this
   * screen. Filtering used and expired tickets out would leave them with no
   * explanation at the one moment it matters.
   */
  it('shows used and expired tickets rather than hiding them', async () => {
    mockExecute.mockResolvedValue([
      ticket({ id: 't-used', state: 'used', entrantName: 'Used Entrant' }),
      ticket({ id: 't-exp', state: 'expired', entrantName: 'Expired Entrant' }),
    ]);

    renderWithProviders(<MyTicketsPage />);

    expect(await screen.findByText('Used Entrant')).toBeInTheDocument();
    expect(screen.getByText('Expired Entrant')).toBeInTheDocument();
  });

  it('distinguishes a ticket awaiting an offline payment', async () => {
    mockExecute.mockResolvedValue([ticket({ state: 'awaiting-payment' })]);

    renderWithProviders(<MyTicketsPage />);

    expect(await screen.findByText('Awaiting payment')).toBeInTheDocument();
  });

  it('tells a member with no tickets why the screen is empty', async () => {
    mockExecute.mockResolvedValue([]);

    renderWithProviders(<MyTicketsPage />);

    expect(await screen.findByText(/Tickets appear here automatically/)).toBeInTheDocument();
  });

  it('reports a failure rather than rendering an empty list', async () => {
    mockExecute.mockRejectedValue(new Error('nope'));

    renderWithProviders(<MyTicketsPage />);

    expect(await screen.findByText(/tickets could not be loaded/)).toBeInTheDocument();
  });
});
