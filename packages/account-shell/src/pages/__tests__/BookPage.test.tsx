import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookPage from '../BookPage';
import { makeOrganisationContext, renderWithProviders } from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';
import { CatalogueCalendar } from '../../types/account';

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

const calendar = (over: Partial<CatalogueCalendar> = {}): CatalogueCalendar => ({
  id: 'cal-1',
  name: 'Tennis court 1',
  description: 'All-weather',
  displayColour: '#336699',
  displayIcon: 'tennis',
  minDaysInAdvance: 0,
  maxDaysInAdvance: 90,
  allowCancellations: false,
  cancelDaysInAdvance: null,
  termsAndConditions: null,
  supportedPaymentMethodIds: ['pm-card'],
  available: true,
  unavailableReason: null,
  ...over,
});

/**
 * D11 — what the club has to book.
 *
 * The rules are on the card because they are what a member needs *before*
 * choosing a time: how much notice the club wants, how far ahead it takes
 * bookings, and whether the booking can be cancelled.
 */
describe('BookPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    mockExecute.mockResolvedValue([calendar()]);
  });

  it('lists the calendars', async () => {
    renderWithProviders(<BookPage />);

    expect(await screen.findByText('Tennis court 1')).toBeInTheDocument();
    expect(mockExecute).toHaveBeenCalledWith({
      url: `/api/account/${contextValue.orgCode}/catalogue/calendars`,
    });
  });

  it('opens a calendar’s availability', async () => {
    renderWithProviders(<BookPage />);

    await userEvent.click(await screen.findByText('Tennis court 1'));

    expect(mockNavigate).toHaveBeenCalledWith(`/${contextValue.orgCode}/book/cal-1`);
  });

  it('shows the club’s booking rules', async () => {
    mockExecute.mockResolvedValue([
      calendar({ minDaysInAdvance: 2, maxDaysInAdvance: 30, allowCancellations: true, cancelDaysInAdvance: 1 }),
    ]);
    renderWithProviders(<BookPage />);

    expect(await screen.findByText(/2 days’ notice/)).toBeInTheDocument();
    expect(screen.getByText(/Up to 30 days ahead/)).toBeInTheDocument();
    expect(screen.getByText(/Cancel up to 1 days before/)).toBeInTheDocument();
  });

  it('omits the notice line when the club needs none', async () => {
    renderWithProviders(<BookPage />);

    await screen.findByText('Tennis court 1');
    expect(screen.queryByText(/notice/)).not.toBeInTheDocument();
  });

  it('marks a calendar that is not taking bookings, and will not open it', async () => {
    mockExecute.mockResolvedValue([
      calendar({ available: false, unavailableReason: 'not-open-for-bookings' }),
    ]);
    renderWithProviders(<BookPage />);

    expect(await screen.findByText('Not taking bookings')).toBeInTheDocument();

    // Disabled rather than merely inert: MUI removes pointer events, so the
    // card cannot be pressed at all — which is what `userEvent` refuses to do.
    expect(screen.getByRole('button', { name: /Tennis court 1/ })).toBeDisabled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('says so when there is nothing to book', async () => {
    mockExecute.mockResolvedValue([]);
    renderWithProviders(<BookPage />);

    expect(await screen.findByText(/nothing to book/i)).toBeInTheDocument();
  });

  it('reports a failure rather than an empty club', async () => {
    mockExecute.mockRejectedValue(new Error('network'));
    renderWithProviders(<BookPage />);

    expect(await screen.findByText(/could not load the calendars/i)).toBeInTheDocument();
    expect(screen.queryByText(/nothing to book/i)).not.toBeInTheDocument();
  });

  it('marks each calendar with its own icon rather than a colour bar', () => {
    renderWithProviders(<BookPage />);

    // A column of coloured bars asks the member to remember which colour means
    // the arena; an icon says it outright.
    return screen.findByText('Tennis court 1').then(() => {
      const icon = document.querySelector('[data-testid="SportsTennisIcon"]');
      expect(icon).toBeInTheDocument();
    });
  });
});
