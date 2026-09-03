import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyMembershipsPage from '../MyMembershipsPage';
import {
  makeOrganisationContext,
  renderWithProviders,
} from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';
import { AccountMembershipRecord } from '../../types/account';

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

const membership = (over: Partial<AccountMembershipRecord> = {}): AccountMembershipRecord => ({
  id: 'member-1',
  membershipNumber: 'M-0001',
  membershipTypeId: 'mt-1',
  membershipTypeName: 'Full Member',
  memberName: 'Niamh Walsh',
  status: 'active',
  validUntil: '2026-12-31',
  dateLastRenewed: '2026-01-01',
  paymentStatus: 'paid',
  daysRemaining: 200,
  formSummary: [],
  canRenew: false,
  renewalNotOpen: false,
  ...over,
});

const render = () =>
  renderWithProviders(<MyMembershipsPage />, {
    route: '/khpc/memberships',
    path: '/:orgCode/memberships',
  });

describe('MyMembershipsPage (C4) — whose membership it is', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockNavigate.mockReset();
    contextValue = makeOrganisationContext();
  });

  it('leads each card with the member, not the membership type', async () => {
    mockExecute.mockResolvedValue([membership({ memberName: 'Conor McGrath' })]);
    render();

    // Whose it is, is what a parent is looking for; what kind, is the detail.
    const name = await screen.findByText('Conor McGrath');
    expect(name.tagName).toBe('H6');
    expect(screen.getByText('Full Member')).toBeInTheDocument();
  });

  it('distinguishes a parent’s several memberships of the same type', async () => {
    mockExecute.mockResolvedValue([
      membership({ id: 'm1', membershipNumber: 'M-0001', memberName: 'Conor McGrath' }),
      membership({ id: 'm2', membershipNumber: 'M-0002', memberName: 'Éabha McGrath' }),
      membership({ id: 'm3', membershipNumber: 'M-0003', memberName: 'Rónán McGrath' }),
    ]);
    render();

    // Without the names these are three identical "Full Member" cards.
    expect(await screen.findByText('Conor McGrath')).toBeInTheDocument();
    expect(screen.getByText('Éabha McGrath')).toBeInTheDocument();
    expect(screen.getByText('Rónán McGrath')).toBeInTheDocument();
  });

  it('falls back to the type when no member name is recorded', async () => {
    mockExecute.mockResolvedValue([membership({ memberName: '' })]);
    render();

    // A card headed by nothing would be worse than one headed by the type.
    const heading = await screen.findByText('Full Member');
    expect(heading.tagName).toBe('H6');
  });
});

describe('MyMembershipsPage (C4)', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockNavigate.mockReset();
    contextValue = makeOrganisationContext();
    mockExecute.mockResolvedValue([membership()]);
  });

  it('shows the membership with its type and number', async () => {
    render();

    expect(await screen.findByText('Full Member')).toBeInTheDocument();
    expect(screen.getByText(/M-0001/)).toBeInTheDocument();
  });

  it('does not count down a membership with months left to run', async () => {
    render();

    await waitFor(() => expect(screen.getByText('Full Member')).toBeInTheDocument());
    // A countdown at 200 days is noise, not information.
    expect(screen.queryByText(/Expires in/)).not.toBeInTheDocument();
  });

  it('counts down once the membership is close to expiring', async () => {
    mockExecute.mockResolvedValue([membership({ daysRemaining: 12, canRenew: true })]);
    render();

    expect(await screen.findByText('Expires in 12 days')).toBeInTheDocument();
  });

  it('says a lapsed membership has expired rather than counting backwards', async () => {
    // A naive countdown would render "Expires in -6 days".
    mockExecute.mockResolvedValue([membership({ daysRemaining: -6, canRenew: true })]);
    render();

    expect(await screen.findByText('Expired 6 days ago')).toBeInTheDocument();
    expect(screen.queryByText(/-6/)).not.toBeInTheDocument();
  });

  /**
   * Renewal happens in the membership catalogue, which offers a type the member
   * holds and is within 30 days of losing rather than refusing it as
   * `already-a-member`. This used to point at `/join`, a route that never
   * existed — the button worked and led to the catch-all redirect.
   *
   * The membership is named in the URL so the application form at the end of
   * the journey can open filled in from it. A parent holds several and the form
   * cannot guess whose details to carry over. See
   * docs/MEMBERSHIP_RENEWAL_PREFILL.md.
   */
  it('sends a renewing member to the catalogue, naming what they are renewing', async () => {
    const user = userEvent.setup();
    mockExecute.mockResolvedValue([
      membership({ id: 'member-9', daysRemaining: 12, canRenew: true }),
    ]);
    render();

    await user.click(await screen.findByRole('button', { name: 'Renew' }));
    expect(mockNavigate).toHaveBeenCalledWith('/khpc/browse/memberships?renew=member-9');
  });

  /**
   * The third condition of the C4 rule. Without it the member gets a button
   * that leads to a page with nothing on it.
   */
  it('explains that renewals are not open instead of offering a dead button', async () => {
    mockExecute.mockResolvedValue([
      membership({ daysRemaining: 12, canRenew: false, renewalNotOpen: true }),
    ]);
    render();

    expect(await screen.findByText('Renewals are not open yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Renew' })).not.toBeInTheDocument();
  });

  it('shows neither a button nor a notice when renewal is simply not due', async () => {
    render();

    await waitFor(() => expect(screen.getByText('Full Member')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Renew' })).not.toBeInTheDocument();
    expect(screen.queryByText('Renewals are not open yet.')).not.toBeInTheDocument();
  });

  it('does not offer renewal on a cancelled membership', async () => {
    mockExecute.mockResolvedValue([
      membership({ status: 'cancelled', canRenew: false, renewalNotOpen: false }),
    ]);
    render();

    await waitFor(() => expect(screen.getByText('Full Member')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Renew' })).not.toBeInTheDocument();
  });

  it('explains an empty list', async () => {
    mockExecute.mockResolvedValue([]);
    render();

    expect(await screen.findByText('You have no memberships yet.')).toBeInTheDocument();
  });

  it('reports a failure instead of looking empty', async () => {
    mockExecute.mockRejectedValue(new Error('offline'));
    render();

    expect(await screen.findByText('We could not load your memberships.')).toBeInTheDocument();
    expect(screen.queryByText('You have no memberships yet.')).not.toBeInTheDocument();
  });
});


/**
 * What the member filled in when they applied.
 *
 * The application form is gone once the membership exists, so this card is the
 * only place a member can check the pony's name or the emergency contact they
 * gave — and spot what needs correcting before the club needs it.
 */
describe('MyMembershipsPage — the details behind a membership', () => {
  const withAnswers = () =>
    membership({
      formSummary: [
        { label: 'Rider name', value: 'Niamh Walsh' },
        { label: 'Pony name', value: 'Bramble' },
        { label: 'Medical notes', value: 'Asthma inhaler\ncarried in the tack box' },
      ],
    });

  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
  });

  it('keeps the answers out of the way until they are asked for', async () => {
    /*
     * Fifteen rows of reference material would bury the number and the expiry
     * date, which is what most people open this screen for.
     *
     * Not in the document at all, rather than merely hidden: the accordion
     * unmounts while collapsed, so the answers are also out of reach of a page
     * search and of a screen reader walking the card.
     */
    mockExecute.mockResolvedValue([withAnswers()]);
    renderWithProviders(<MyMembershipsPage />);

    expect(await screen.findByText(/Your details/)).toBeInTheDocument();
    expect(screen.queryByText('Bramble')).not.toBeInTheDocument();
  });

  it('shows every answer, labelled, once expanded', async () => {
    mockExecute.mockResolvedValue([withAnswers()]);
    renderWithProviders(<MyMembershipsPage />);

    await userEvent.click(await screen.findByText(/Your details/));

    expect(await screen.findByText('Pony name')).toBeInTheDocument();
    expect(screen.getByText('Bramble')).toBeInTheDocument();
    expect(screen.getByText('Rider name')).toBeInTheDocument();
    // Twice over: the card is headed by the member's name, and the form asked
    // for it too. Both are correct, so this counts rather than expecting one.
    expect(screen.getAllByText('Niamh Walsh')).toHaveLength(2);
  });

  it('counts the answers, so the label says what is behind it', async () => {
    mockExecute.mockResolvedValue([withAnswers()]);
    renderWithProviders(<MyMembershipsPage />);

    /*
     * The count, not the exact phrasing. What matters is that the label says
     * how much is behind it; the wording around the number is copy and has
     * already been shortened once.
     */
    expect(await screen.findByText(/Your details \(3\b/)).toBeInTheDocument();
  });

  it('shows no expander at all when the club asked nothing', async () => {
    // An empty accordion is worse than none: it invites a click that reveals
    // nothing, and implies the club lost the answers.
    mockExecute.mockResolvedValue([membership({ formSummary: [] })]);
    renderWithProviders(<MyMembershipsPage />);

    await screen.findByText('Niamh Walsh');
    expect(screen.queryByText(/Your details/)).not.toBeInTheDocument();
  });
});
