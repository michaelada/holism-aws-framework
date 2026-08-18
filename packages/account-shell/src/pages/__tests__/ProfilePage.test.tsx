import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfilePage from '../ProfilePage';
import {
  makeOrganisationContext,
  renderWithProviders,
} from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';
import { AccountProfile } from '../../types/account';

const mockExecute = vi.fn();
const mockCreateAccountUrl = vi.fn(() => 'https://kc.example/realms/r/account/');
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

vi.mock('../../context/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../../context/AuthContext')>(
    '../../context/AuthContext'
  );
  return {
    ...actual,
    useAuthContext: () => ({
      keycloak: { createAccountUrl: mockCreateAccountUrl },
      authenticated: true,
      loading: false,
      error: null,
      token: 't',
      user: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      getToken: () => 't',
    }),
  };
});

/** The locale switch is a global side effect; assert it was asked for, not that it happened. */
const mockChangeLocale = vi.fn();
vi.mock('../../i18n/config', async () => {
  const actual = await vi.importActual<typeof import('../../i18n/config')>('../../i18n/config');
  return { ...actual, changeLocale: (...args: unknown[]) => mockChangeLocale(...args) };
});

const profile = (over: Partial<AccountProfile> = {}): AccountProfile => ({
  id: 'ou-1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Adams',
  phone: '0871234567',
  status: 'active',
  memberSince: '2025-01-04T09:00:00.000Z',
  lastLogin: '2026-08-01T10:00:00.000Z',
  preferredLanguage: null,
  organisationCount: 1,
  ...over,
});

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    mockExecute.mockResolvedValue(profile());
  });

  it('loads the profile on mount', async () => {
    renderWithProviders(<ProfilePage />);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith({
        url: `/api/account/${contextValue.orgCode}/profile`,
      });
    });
  });

  it('shows the member’s current details', async () => {
    renderWithProviders(<ProfilePage />);

    expect(await screen.findByDisplayValue('Ada')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Adams')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0871234567')).toBeInTheDocument();
  });

  /**
   * The email is the sign-in address. Editing it here without verification
   * would let a typo lock the member out, so it is read-only and the change
   * goes through Keycloak.
   */
  it('shows the email but does not allow it to be edited', async () => {
    renderWithProviders(<ProfilePage />);

    const email = await screen.findByDisplayValue('ada@example.com');
    expect(email).toBeDisabled();
  });

  it('saves the edited details', async () => {
    renderWithProviders(<ProfilePage />);

    const firstName = await screen.findByDisplayValue('Ada');
    await userEvent.clear(firstName);
    await userEvent.type(firstName, 'Adaline');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          url: `/api/account/${contextValue.orgCode}/profile`,
          data: expect.objectContaining({ firstName: 'Adaline' }),
        })
      );
    });
  });

  it('sends null rather than an empty phone number', async () => {
    renderWithProviders(<ProfilePage />);

    const phone = await screen.findByDisplayValue('0871234567');
    await userEvent.clear(phone);
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ phone: null }) })
      );
    });
  });

  /**
   * A member who has just chosen French and is still looking at English has no
   * way to tell whether the setting took.
   */
  it('applies the chosen language immediately after saving', async () => {
    mockExecute.mockResolvedValue(profile({ preferredLanguage: 'fr-FR' }));

    renderWithProviders(<ProfilePage />);

    await screen.findByDisplayValue('Ada');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(mockChangeLocale).toHaveBeenCalledWith('fr-FR'));
  });

  /** With one club there is nothing to warn about. */
  it('does not warn about sharing when the member belongs to one organisation', async () => {
    renderWithProviders(<ProfilePage />);

    await screen.findByDisplayValue('Ada');
    expect(screen.queryByText(/shared across all/i)).not.toBeInTheDocument();
  });

  it('warns that details are shared when the member belongs to several', async () => {
    mockExecute.mockResolvedValue(profile({ organisationCount: 3 }));

    renderWithProviders(<ProfilePage />);

    expect(await screen.findByText(/shared across all 3 organisations/i)).toBeInTheDocument();
  });

  /**
   * P2 — leaving the app mid-task is disorienting without warning, so the
   * handoff is confirmed first.
   */
  /*
   * Both credential changes used to hand off to Keycloak's account console,
   * behind an interstitial warning the member they were about to leave. They
   * are dialogs in the app now (P4/P5), so the console is never opened and the
   * warning has nothing left to warn about.
   */
  it('changes the password in the app rather than on Keycloak’s pages', async () => {
    renderWithProviders(<ProfilePage />);

    await screen.findByDisplayValue('Ada');
    await userEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByLabelText(/^current password/i)).toBeInTheDocument();
    expect(mockCreateAccountUrl).not.toHaveBeenCalled();
    expect(screen.queryByText(/brought straight back/i)).not.toBeInTheDocument();
  });

  it('changes the email address in the app too, and says nothing moves yet', async () => {
    renderWithProviders(<ProfilePage />);

    await screen.findByDisplayValue('Ada');
    await userEvent.click(screen.getByRole('button', { name: /change email address/i }));

    expect(await screen.findByLabelText(/^new email address/i)).toBeInTheDocument();
    // The member signs in with this address, so the dialog must not imply the
    // change has already happened.
    expect(screen.getByText(/Nothing changes until you follow it/i)).toBeInTheDocument();
    expect(mockCreateAccountUrl).not.toHaveBeenCalled();
  });

  it('reports a failure to load', async () => {
    mockExecute.mockRejectedValue(new Error('nope'));

    renderWithProviders(<ProfilePage />);

    expect(await screen.findByText(/profile could not be loaded/i)).toBeInTheDocument();
  });
});
