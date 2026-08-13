import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import TicketPage from '../TicketPage';
import {
  makeOrganisationContext,
  renderWithProviders,
} from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';
import { AccountTicketDetail } from '../../types/account';

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
    useParams: () => ({ ticketId: 'ticket-1' }),
  };
});

/*
 * The QR is drawn on the device rather than fetched, which is what makes the
 * screen work with no signal. Stubbed so the test asserts that the payload
 * reaches the renderer, without depending on canvas in jsdom.
 */
vi.mock('@aws-web-framework/components', async () => {
  const actual = await vi.importActual<typeof import('@aws-web-framework/components')>(
    '@aws-web-framework/components'
  );
  return {
    ...actual,
    generateQRCodeDataURL: vi.fn(async () => 'data:image/png;base64,STUB'),
  };
});

const detail = (over: Partial<AccountTicketDetail> = {}): AccountTicketDetail => ({
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
  qrCode: 'a3f1c2d4-0000-4000-8000-000000000000',
  entrantEmail: 'ada@example.com',
  validFrom: '2026-09-12T00:00:00.000Z',
  organisationName: 'Kildare Hunt Pony Club',
  config: {
    headerText: 'Admit one',
    instructions: 'Show this at the gate.',
    footerText: 'Registered charity 12345',
    includeEventLogo: false,
    backgroundColour: null,
  },
  ...over,
});

describe('TicketPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    mockExecute.mockResolvedValue(detail());
  });

  it('loads the ticket by id', async () => {
    renderWithProviders(<TicketPage />);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith({
        url: `/api/account/${contextValue.orgCode}/tickets/ticket-1`,
      });
    });
  });

  it('renders the organisation configuration rather than fixed wording', async () => {
    renderWithProviders(<TicketPage />);

    expect(await screen.findByText('Admit one')).toBeInTheDocument();
    expect(screen.getByText('Show this at the gate.')).toBeInTheDocument();
    expect(screen.getByText('Registered charity 12345')).toBeInTheDocument();
    expect(screen.getByText('Kildare Hunt Pony Club')).toBeInTheDocument();
  });

  it('renders the QR from the payload and labels it with the reference', async () => {
    renderWithProviders(<TicketPage />);

    const qr = await screen.findByAltText(/TKT-2026-000001/);
    expect(qr).toHaveAttribute('src', 'data:image/png;base64,STUB');
  });

  /**
   * A member who scanned in and out needs to see why the ticket will not scan
   * again — the frame stays, the QR dims, and the banner says when.
   */
  it('shows a used ticket with a banner rather than hiding it', async () => {
    mockExecute.mockResolvedValue(
      detail({ state: 'used', scannedAt: '2026-09-12T09:52:00.000Z' })
    );

    renderWithProviders(<TicketPage />);

    expect(await screen.findByText(/was used on/i)).toBeInTheDocument();
    expect(screen.getByText('TKT-2026-000001')).toBeInTheDocument();
  });

  it('explains an expired ticket', async () => {
    mockExecute.mockResolvedValue(detail({ state: 'expired' }));

    renderWithProviders(<TicketPage />);

    expect(await screen.findByText(/expired on/i)).toBeInTheDocument();
  });

  it('explains a ticket that is waiting on an offline payment', async () => {
    mockExecute.mockResolvedValue(detail({ state: 'awaiting-payment' }));

    renderWithProviders(<TicketPage />);

    expect(await screen.findByText(/not valid yet/i)).toBeInTheDocument();
  });

  it('reports a ticket that cannot be loaded', async () => {
    mockExecute.mockRejectedValue(new Error('nope'));

    renderWithProviders(<TicketPage />);

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument();
  });
});
