import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import InviteAdminUserPage from '../InviteAdminUserPage';
import CreateAccountUserPage from '../CreateAccountUserPage';

/**
 * The two ways a person is added to a club: as an administrator who runs it,
 * and as an account user who belongs to it.
 *
 * They differ in exactly one consequential way, and it is the reason to test
 * them together. An administrator without a role can sign in and see nothing —
 * a support call that looks like a broken account — so at least one role is
 * required. An account user has no roles at all, and demanding one would block
 * the ordinary case.
 *
 * Both create a real Keycloak identity and send a real invitation, so neither
 * should ever be sent with an address that cannot receive one.
 */

const { execute, navigate } = vi.hoisted(() => ({ execute: vi.fn(), navigate: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

vi.mock('@aws-web-framework/orgadmin-shell', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell/hooks/useTranslation', () =>
  import('../../../test/orgadminShellMock')
);
vi.mock('@aws-web-framework/orgadmin-shell/utils/currencyFormatting', () =>
  import('../../../test/orgadminShellMock')
);
vi.mock('@aws-web-framework/orgadmin-shell/utils/dateFormatting', () =>
  import('../../../test/orgadminShellMock')
);
vi.mock('@aws-web-framework/orgadmin-shell/context/LocaleContext', () =>
  import('../../../test/orgadminShellMock')
);

vi.mock('../../../hooks/useApi', () => ({
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
}));

const ROLES = [
  { id: 'role-1', name: 'Treasurer' },
  { id: 'role-2', name: 'Secretary' },
];

const respondForInvite = (over: Record<string, unknown> = {}) =>
  execute.mockImplementation(async ({ method }: { method: string }) => {
    if (method === 'GET') return 'roles' in over ? over.roles : ROLES;
    // `in`, not `??`: a deliberate null result is the case under test.
    return 'created' in over ? over.created : { id: 'user-9' };
  });

const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const fillPerson = ({ skip }: { skip?: string } = {}) => {
  if (skip !== 'email') type(/email/i, 'aoife@example.com');
  if (skip !== 'first') type(/first name/i, 'Aoife');
  if (skip !== 'last') type(/last name/i, 'Byrne');
};

const submit = (pattern: RegExp) =>
  fireEvent.click(screen.getAllByRole('button').find((b) => pattern.test(b.textContent ?? ''))!);

const created = () => execute.mock.calls.map(([r]) => r).find((r) => r.method === 'POST');

const alertText = async () => (await screen.findByRole('alert')).textContent ?? '';

const chooseRole = (roleId: string) => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /roles/i }));
  const listbox = screen.getByRole('listbox');
  fireEvent.click(listbox.querySelector(`[data-value="${roleId}"]`)!);
  // A multiple Select keeps its menu open, and the backdrop blocks the form.
  fireEvent.keyDown(listbox, { key: 'Escape' });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('InviteAdminUserPage — inviting an administrator', () => {
  const renderPage = async () => {
    respondForInvite();
    renderWithProviders(<InviteAdminUserPage />);
    await waitFor(() => expect(execute).toHaveBeenCalled());
    await screen.findByLabelText(/email/i);
  };

  it('offers the roles this organisation defines', async () => {
    await renderPage();

    expect(execute).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/orgadmin/users/roles/org-1',
    });
  });

  it('carries on when the roles cannot be read', async () => {
    execute.mockRejectedValue(new Error('network down'));
    renderWithProviders(<InviteAdminUserPage />);

    // The page is still usable; it simply has no roles to offer.
    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument();
  });

  it('refuses an invitation with missing details', async () => {
    await renderPage();
    fillPerson({ skip: 'first' });

    submit(/invite|send/i);

    expect(await alertText()).toMatch(/required/i);
    expect(created()).toBeUndefined();
  });

  it('refuses an address that could never receive the invitation', async () => {
    await renderPage();
    fillPerson();
    type(/email/i, 'aoife-at-example');

    submit(/invite|send/i);

    expect(await alertText()).toMatch(/valid email/i);
    expect(created()).toBeUndefined();
  });

  it('refuses an administrator with no role at all', async () => {
    await renderPage();
    fillPerson();

    submit(/invite|send/i);

    // They could sign in and see nothing, which reads as a broken account.
    expect(await alertText()).toMatch(/at least one role/i);
    expect(created()).toBeUndefined();
  });

  it('invites the administrator with the roles chosen', async () => {
    await renderPage();
    fillPerson();
    chooseRole('role-1');

    submit(/invite|send/i);

    await waitFor(() => expect(created()).toBeDefined());
    expect(created()!.url).toBe('/api/orgadmin/users/admins/org-1');
    expect(created()!.data).toMatchObject({
      email: 'aoife@example.com',
      roleIds: ['role-1'],
    });
  });

  it('returns to the administrator list once the invitation is sent', async () => {
    await renderPage();
    fillPerson();
    chooseRole('role-1');

    submit(/invite|send/i);

    await waitFor(() => expect(created()).toBeDefined());
    await vi.advanceTimersByTimeAsync(2000);
    expect(navigate).toHaveBeenCalledWith('/users/admins');
  });

  it('stays put when the server answered with nothing', async () => {
    respondForInvite({ created: null });
    renderWithProviders(<InviteAdminUserPage />);
    await screen.findByLabelText(/email/i);
    fillPerson();
    chooseRole('role-1');

    submit(/invite|send/i);

    // A null result means the request failed; treating it as success would
    // report an invitation that was never sent.
    await waitFor(() => expect(created()).toBeDefined());
    await vi.advanceTimersByTimeAsync(2000);
    expect(navigate).not.toHaveBeenCalledWith('/users/admins');
  });

  it('shows the server’s own reason for a refusal', async () => {
    await renderPage();
    fillPerson();
    chooseRole('role-1');
    execute.mockRejectedValue({ response: { data: { error: 'Email already invited' } } });

    submit(/invite|send/i);

    expect(await alertText()).toContain('Email already invited');
  });

  it('leaves without inviting anyone when cancelled', async () => {
    await renderPage();
    fillPerson();

    submit(/cancel/i);

    expect(created()).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith('/users/admins');
  });
});

describe('CreateAccountUserPage — adding a member account', () => {
  const renderPage = async () => {
    execute.mockResolvedValue({ id: 'user-9' });
    renderWithProviders(<CreateAccountUserPage />);
    await screen.findByLabelText(/email/i);
  };

  it('refuses an account with missing details', async () => {
    await renderPage();
    fillPerson({ skip: 'last' });

    submit(/create|add/i);

    expect(await alertText()).toMatch(/required/i);
    expect(created()).toBeUndefined();
  });

  it('refuses an address that could never receive the invitation', async () => {
    await renderPage();
    fillPerson();
    type(/email/i, 'not-an-address');

    submit(/create|add/i);

    expect(await alertText()).toMatch(/valid email/i);
    expect(created()).toBeUndefined();
  });

  it('asks for no role, because an account user has none', async () => {
    await renderPage();
    fillPerson();

    submit(/create|add/i);

    // Requiring a role here would block the ordinary case entirely.
    await waitFor(() => expect(created()).toBeDefined());
  });

  it('creates the account under this organisation', async () => {
    await renderPage();
    fillPerson();

    submit(/create|add/i);

    await waitFor(() => expect(created()).toBeDefined());
    expect(created()!.url).toBe('/api/orgadmin/users/accounts/org-1');
    expect(created()!.data).toMatchObject({ email: 'aoife@example.com', lastName: 'Byrne' });
  });

  it('includes a phone number when one was given', async () => {
    await renderPage();
    fillPerson();
    type(/phone/i, '+353 87 123 4567');

    submit(/create|add/i);

    await waitFor(() => expect(created()).toBeDefined());
    expect(created()!.data.phone).toBe('+353 87 123 4567');
  });

  it('returns to the account list once the account exists', async () => {
    await renderPage();
    fillPerson();

    submit(/create|add/i);

    await waitFor(() => expect(created()).toBeDefined());
    await vi.advanceTimersByTimeAsync(2000);
    expect(navigate).toHaveBeenCalledWith('/users/accounts');
  });

  it('shows the server’s own reason for a refusal', async () => {
    await renderPage();
    fillPerson();
    execute.mockRejectedValue({ response: { data: { message: 'That email already has an account' } } });

    submit(/create|add/i);

    expect(await alertText()).toContain('That email already has an account');
  });

  it('leaves without creating anything when cancelled', async () => {
    await renderPage();
    fillPerson();

    submit(/cancel/i);

    expect(created()).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith('/users/accounts');
  });
});
