import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrganisationDirectoryPage from '../OrganisationDirectoryPage';
import { renderWithProviders } from '../../test/renderWithProviders';

const mockExecute = vi.fn();
const mockNavigate = vi.fn();
const authState = { authenticated: false };

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

vi.mock('../../context/AuthContext', () => ({
  useAuthContext: () => authState,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const ORGANISATIONS = [
  {
    urlCode: 'khpc',
    displayName: 'Killiney Harbour Paddling Club',
    organisationType: 'Paddling Club',
    city: 'Dublin',
    country: 'Ireland',
    branding: { logoUrl: '', primaryColor: '#1976d2' },
  },
  {
    urlCode: 'asc',
    displayName: 'Athlone Swimming Club',
    organisationType: 'Swimming Club',
    city: 'Athlone',
    country: 'Ireland',
    branding: { logoUrl: '', primaryColor: '#2e7d32' },
  },
];

describe('OrganisationDirectoryPage (A1)', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockNavigate.mockReset();
    authState.authenticated = false;
    mockExecute.mockResolvedValue({ organisations: ORGANISATIONS, total: 2 });
  });

  it('lists the organisations it is given', async () => {
    renderWithProviders(<OrganisationDirectoryPage />, { route: '/', path: '/' });

    await waitFor(() =>
      expect(screen.getByText('Killiney Harbour Paddling Club')).toBeInTheDocument()
    );
    expect(screen.getByText('Athlone Swimming Club')).toBeInTheDocument();
  });

  it('loads without a session, because the directory is public', async () => {
    renderWithProviders(<OrganisationDirectoryPage />, { route: '/', path: '/' });

    await waitFor(() => expect(mockExecute).toHaveBeenCalled());
    // `anonymous` is what stops the hook attaching a bearer token. Losing it
    // would make the directory 401 for exactly the visitors it exists to serve.
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/public/organisations', anonymous: true })
    );
  });

  it('sends the search term to the server rather than filtering locally', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganisationDirectoryPage />, { route: '/', path: '/' });

    await waitFor(() => expect(mockExecute).toHaveBeenCalled());
    await user.type(screen.getByLabelText(/search organisations/i), 'kill');

    await waitFor(
      () =>
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({ params: { q: 'kill' } })
        ),
      { timeout: 2000 }
    );
  });

  it('does not fire a request per keystroke', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganisationDirectoryPage />, { route: '/', path: '/' });

    await waitFor(() => expect(mockExecute).toHaveBeenCalled());
    const before = mockExecute.mock.calls.length;

    await user.type(screen.getByLabelText(/search organisations/i), 'killiney');

    await waitFor(
      () => expect(mockExecute.mock.calls.length).toBeGreaterThan(before),
      { timeout: 2000 }
    );
    // Eight characters typed; the debounce must collapse them into far fewer
    // requests than one each.
    expect(mockExecute.mock.calls.length - before).toBeLessThan(8);
  });

  it('explains an empty result instead of showing a bare list', async () => {
    mockExecute.mockResolvedValue({ organisations: [], total: 0 });
    renderWithProviders(<OrganisationDirectoryPage />, { route: '/', path: '/' });

    await waitFor(() => expect(screen.getByText(/no organisations match/i)).toBeInTheDocument());
    expect(screen.getByText(/check the spelling/i)).toBeInTheDocument();
  });

  it('reports a failure to load rather than looking empty', async () => {
    mockExecute.mockRejectedValue(new Error('offline'));
    renderWithProviders(<OrganisationDirectoryPage />, { route: '/', path: '/' });

    await waitFor(() =>
      expect(screen.getByText(/could not load the organisation list/i)).toBeInTheDocument()
    );
    // The "no matches" copy would be a lie here — nothing was searched.
    expect(screen.queryByText(/no organisations match/i)).not.toBeInTheDocument();
  });

  it('navigates to an organisation when its card is chosen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganisationDirectoryPage />, { route: '/', path: '/' });

    await waitFor(() =>
      expect(screen.getByText('Killiney Harbour Paddling Club')).toBeInTheDocument()
    );
    await user.click(screen.getByText('Killiney Harbour Paddling Club'));

    expect(mockNavigate).toHaveBeenCalledWith('/khpc');
  });

  it('hides the "your organisations" strip from a signed-out visitor', async () => {
    renderWithProviders(<OrganisationDirectoryPage />, { route: '/', path: '/' });

    await waitFor(() => expect(mockExecute).toHaveBeenCalled());
    expect(screen.queryByText(/your organisations/i)).not.toBeInTheDocument();
  });

  it('shows the fast path to a signed-in member', async () => {
    authState.authenticated = true;
    mockExecute.mockImplementation((request: { url: string }) =>
      request.url === '/api/account/organisations'
        ? Promise.resolve([
            {
              organisationId: 'org-1',
              organisationUserId: 'ou-1',
              urlCode: 'khpc',
              displayName: 'Killiney Harbour Paddling Club',
              currency: 'EUR',
              language: 'en',
              capabilities: [],
              status: 'active',
            },
          ])
        : Promise.resolve({ organisations: ORGANISATIONS, total: 2 })
    );

    renderWithProviders(<OrganisationDirectoryPage />, { route: '/', path: '/' });

    await waitFor(() => expect(screen.getByText(/your organisations/i)).toBeInTheDocument());
  });
});
