import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrganisationSwitcherPage from '../OrganisationSwitcherPage';
import {
  makeOrganisationContext,
  renderWithProviders,
} from '../../test/renderWithProviders';
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

const membership = (over: Record<string, unknown> = {}) => ({
  organisationId: 'org-1',
  organisationUserId: 'ou-1',
  urlCode: 'khpc',
  displayName: 'Killiney Harbour Paddling Club',
  currency: 'EUR',
  language: 'en',
  capabilities: [],
  status: 'active',
  ...over,
});

const render = () =>
  renderWithProviders(<OrganisationSwitcherPage />, { route: '/switch', path: '/switch' });

describe('OrganisationSwitcherPage (A7)', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockNavigate.mockReset();
    contextValue = makeOrganisationContext();
    mockExecute.mockResolvedValue({ organisations: [membership()] });
  });

  it('lists the organisations the member belongs to', async () => {
    render();
    expect(
      await screen.findByText('Killiney Harbour Paddling Club')
    ).toBeInTheDocument();
  });

  it('switches by navigating, not by signing in again', async () => {
    const user = userEvent.setup();
    mockExecute.mockResolvedValue({ organisations: [
      membership(),
      membership({
        organisationId: 'org-2',
        urlCode: 'asc',
        displayName: 'Athlone Swimming Club',
      }),
    ] });

    render();
    await user.click(await screen.findByText('Athlone Swimming Club'));

    // The Keycloak token is realm-wide, so switching is a URL and context
    // change. Any re-authentication here would be a bug, not a safeguard.
    expect(mockNavigate).toHaveBeenCalledWith('/asc');
  });

  it('marks which organisation is currently open', async () => {
    render();
    expect(await screen.findByText('Current')).toBeInTheDocument();
  });

  it('keeps a pending membership visible rather than appearing to lose it', async () => {
    mockExecute.mockResolvedValue({ organisations: [
      membership({ status: 'pending', displayName: 'Waiting Club', urlCode: 'wait' }),
    ] });
    render();

    expect(await screen.findByText('Waiting Club')).toBeInTheDocument();
    expect(screen.getByText('Awaiting approval')).toBeInTheDocument();
  });

  it('shows a rejected membership with its status', async () => {
    mockExecute.mockResolvedValue({ organisations: [
      membership({ status: 'rejected', displayName: 'Closed Club', urlCode: 'closed' }),
    ] });
    render();

    expect(await screen.findByText('Not approved')).toBeInTheDocument();
  });

  it('offers the directory to someone who belongs to nothing yet', async () => {
    const user = userEvent.setup();
    mockExecute.mockResolvedValue({ organisations: [] });
    render();

    expect(
      await screen.findByText('You do not belong to any organisations yet.')
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Find a club' }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('does not strand the member when the list cannot be loaded', async () => {
    mockExecute.mockRejectedValue(new Error('offline'));
    render();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Find a club' })).toBeInTheDocument());
  });
});
