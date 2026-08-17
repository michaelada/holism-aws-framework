import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntryDetailPage from '../EntryDetailPage';
import {
  makeOrganisationContext,
  renderWithProviders,
} from '../../test/renderWithProviders';
import { AccountApiError } from '../../hooks/useAccountApi';
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

const DETAIL = {
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
  firstName: 'Sam',
  lastName: 'Rivers',
  email: 'sam@example.com',
  formSubmissionId: 'fs-1',
  formSummary: [] as Array<{ label: string; value: string }>,
  eventDescription: 'Annual regatta',
  activityDescription: 'Under 18',
  confirmationMessage: null as string | null,
};

const render = () =>
  renderWithProviders(<EntryDetailPage />, {
    route: '/khpc/entries/entry-1',
    path: '/:orgCode/entries/:entryId',
  });

describe('EntryDetailPage (C2)', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockNavigate.mockReset();
    contextValue = makeOrganisationContext();
    mockExecute.mockResolvedValue(DETAIL);
  });

  it('shows the entry with its event, activity and entrant', async () => {
    render();

    expect(await screen.findByText('Summer Regatta')).toBeInTheDocument();
    expect(screen.getByText('Junior Single Sculls')).toBeInTheDocument();
    expect(screen.getByText(/Sam Rivers/)).toBeInTheDocument();
  });

  it('requests only the entry named in the URL', async () => {
    render();

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/api/account/khpc/entries/entry-1' })
      )
    );
  });

  /**
   * Q6 — entries are not self-cancellable. The club's contact route is offered
   * instead of an action the platform will not honour.
   */
  it('offers no way to cancel', async () => {
    render();

    await waitFor(() => expect(screen.getByText('Summer Regatta')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /cancel|withdraw/i })).not.toBeInTheDocument();
    expect(screen.getByText(/cannot be cancelled here/i)).toBeInTheDocument();
  });

  /**
   * Rendering the stored submission against the *current* form definition would
   * silently drop answers to since-deleted fields. Saying so is better than
   * showing a rendering that is quietly wrong.
   */
  it('shows a confirmation message the club chose to publish', async () => {
    mockExecute.mockResolvedValue({ ...DETAIL, confirmationMessage: 'See you there' });
    render();

    expect(await screen.findByText('See you there')).toBeInTheDocument();
  });

  it('reports an entry that is not the member\'s own as simply not found', async () => {
    mockExecute.mockRejectedValue(new AccountApiError('gone', 404, 'ENTRY_NOT_FOUND'));
    render();

    expect(await screen.findByText('We could not find that entry.')).toBeInTheDocument();
    // Not "forbidden" — the member should not learn the id belongs to someone.
    expect(screen.queryByText(/permission|forbidden/i)).not.toBeInTheDocument();
  });

  it('distinguishes a load failure from a missing entry', async () => {
    mockExecute.mockRejectedValue(new AccountApiError('boom', 500));
    render();

    expect(await screen.findByText('We could not load your entry.')).toBeInTheDocument();
  });

  it('offers a way back even when the entry could not be loaded', async () => {
    const user = userEvent.setup();
    mockExecute.mockRejectedValue(new AccountApiError('gone', 404));
    render();

    await user.click(await screen.findByRole('button', { name: /back to my entries/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/khpc/entries');
  });
});


/**
 * The answers the member gave when they entered.
 *
 * This screen is the only place they can be seen: the form is gone once the
 * entry exists, and the submission endpoint serves only lines still in an open
 * basket. It used to say "your answers are not available to view here" — about
 * answers the member had typed minutes earlier, on an entry still awaiting
 * payment.
 */
describe('EntryDetailPage — your answers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
  });

  it('shows every answer, labelled and in order', async () => {
    mockExecute.mockResolvedValue({
      ...DETAIL,
      formSummary: [
        { label: 'Rider name', value: 'Sam Rivers' },
        { label: 'Dietary requirements', value: 'Gluten free' },
      ],
    });
    render();

    expect(await screen.findByText('Rider name')).toBeInTheDocument();
    expect(screen.getByText('Sam Rivers')).toBeInTheDocument();
    expect(screen.getByText('Dietary requirements')).toBeInTheDocument();
    expect(screen.getByText('Gluten free')).toBeInTheDocument();
  });

  it('no longer claims the answers cannot be shown', async () => {
    mockExecute.mockResolvedValue({
      ...DETAIL,
      formSummary: [{ label: 'Rider name', value: 'Sam Rivers' }],
    });
    render();

    await screen.findByText('Rider name');
    expect(screen.queryByText(/not available to view/i)).not.toBeInTheDocument();
  });

  it('says the entry had no form, rather than showing an empty heading', async () => {
    // A real case — plenty of activities ask nothing — and a different
    // statement from "we cannot show you what you wrote".
    mockExecute.mockResolvedValue({ ...DETAIL, formSummary: [] });
    render();

    expect(await screen.findByText(/no form to fill in/i)).toBeInTheDocument();
  });

  it('shows the answers on an entry that is still awaiting payment', async () => {
    // The reported case: the entry is not paid for yet, and its answers are
    // exactly what the member wants to check before paying.
    mockExecute.mockResolvedValue({
      ...DETAIL,
      status: 'awaiting-payment' as const,
      paymentStatus: 'pending',
      formSummary: [{ label: 'Dietary requirements', value: 'Gluten free' }],
    });
    render();

    expect(await screen.findByText('Gluten free')).toBeInTheDocument();
  });
});
