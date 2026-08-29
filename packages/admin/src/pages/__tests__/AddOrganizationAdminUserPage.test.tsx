import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddOrganizationAdminUserPage } from '../AddOrganizationAdminUserPage';

/**
 * Giving someone administrator access to a club.
 *
 * The part worth pinning is what happens *after* the account is created. Roles
 * are assigned in a second round of requests, and by then the user already
 * exists — so a failed role assignment must not be reported as "the
 * administrator could not be created". That message sent operators back to
 * retry, where they hit a duplicate-email error and concluded nothing had
 * worked, while a role-less administrator sat in Keycloak.
 *
 * The validation in front of it is ordinary but load-bearing: this form sets a
 * temporary password, and a short one is a real account with a weak credential.
 */

const { api, navigate, showSuccess, showError, params } = vi.hoisted(() => ({
  api: {
    getOrganizationById: vi.fn(),
    getOrganizationRoles: vi.fn(),
    createOrganizationAdminUser: vi.fn(),
    assignRoleToUser: vi.fn(),
  },
  navigate: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  params: { current: { id: 'org-1' } as { id?: string } },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useParams: () => params.current,
}));

vi.mock('../../services/organizationApi', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...api,
}));

vi.mock('../../context/NotificationContext', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNotification: () => ({ showSuccess, showError, showInfo: vi.fn() }),
}));

const ORG = { id: 'org-1', name: 'meath', displayName: 'Meath Hunt Club' };

const ROLES = [
  { id: 'role-1', name: 'treasurer', displayName: 'Treasurer', capabilityPermissions: {} },
  { id: 'role-2', name: 'secretary', displayName: 'Secretary', capabilityPermissions: {} },
];

const renderPage = async (roles: unknown[] = ROLES) => {
  api.getOrganizationById.mockResolvedValue(ORG);
  api.getOrganizationRoles.mockResolvedValue(roles);
  render(
    <MemoryRouter>
      <AddOrganizationAdminUserPage />
    </MemoryRouter>
  );
  await waitFor(() => expect(api.getOrganizationById).toHaveBeenCalled());
  await screen.findByLabelText(/email address/i);
};

const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const fillValidForm = ({ skip }: { skip?: string } = {}) => {
  if (skip !== 'email') type(/email address/i, 'aoife@example.com');
  if (skip !== 'first') type(/first name/i, 'Aoife');
  if (skip !== 'last') type(/last name/i, 'Byrne');
  if (skip !== 'password') type(/temporary password/i, 'sup3r-secret');
};

const submit = () => fireEvent.click(screen.getByRole('button', { name: /create user/i }));

/** Roles are chosen from a multiple Select, whose menu stays open afterwards. */
const chooseRole = (roleId: string) => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /roles/i }));
  const listbox = screen.getByRole('listbox');
  fireEvent.click(listbox.querySelector(`[data-value="${roleId}"]`)!);
  fireEvent.keyDown(listbox, { key: 'Escape' });
  return true;
};

beforeEach(() => {
  vi.clearAllMocks();
  params.current = { id: 'org-1' };
  api.createOrganizationAdminUser.mockResolvedValue({ id: 'user-9' });
  api.assignRoleToUser.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AddOrganizationAdminUserPage — arriving', () => {
  it('reads the club and the roles it can grant', async () => {
    await renderPage();

    expect(api.getOrganizationById).toHaveBeenCalledWith('org-1');
    expect(api.getOrganizationRoles).toHaveBeenCalledWith('org-1');
  });

  it('says so when the club’s details could not be read', async () => {
    api.getOrganizationById.mockRejectedValue(new Error('network down'));
    api.getOrganizationRoles.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <AddOrganizationAdminUserPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(showError).toHaveBeenCalled());
  });
});

describe('AddOrganizationAdminUserPage — what it refuses to send', () => {
  const expectRefusal = async (pattern: RegExp) => {
    submit();
    expect((await screen.findByRole('alert')).textContent).toMatch(pattern);
    expect(api.createOrganizationAdminUser).not.toHaveBeenCalled();
  };

  it('refuses a form with no email', async () => {
    await renderPage();
    fillValidForm({ skip: 'email' });

    await expectRefusal(/required/i);
  });

  it('refuses a form with no first name', async () => {
    await renderPage();
    fillValidForm({ skip: 'first' });

    await expectRefusal(/required/i);
  });

  it('refuses a form with no last name', async () => {
    await renderPage();
    fillValidForm({ skip: 'last' });

    await expectRefusal(/required/i);
  });

  it('refuses an address that could never receive the invitation', async () => {
    await renderPage();
    fillValidForm();
    type(/email address/i, 'aoife-at-example');

    await expectRefusal(/valid email/i);
  });

  it('refuses a temporary password short enough to guess', async () => {
    await renderPage();
    fillValidForm();
    type(/temporary password/i, 'short');

    // This creates a real account; a weak credential here is a live one.
    await expectRefusal(/at least 8 characters/i);
  });
});

describe('AddOrganizationAdminUserPage — creating the administrator', () => {
  it('creates the account under the club in the route', async () => {
    await renderPage();
    fillValidForm();

    submit();

    await waitFor(() =>
      expect(api.createOrganizationAdminUser).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ email: 'aoife@example.com', firstName: 'Aoife' })
      )
    );
  });

  it('assigns nothing when no role was chosen', async () => {
    await renderPage();
    fillValidForm();

    submit();

    await waitFor(() => expect(api.createOrganizationAdminUser).toHaveBeenCalled());
    expect(api.assignRoleToUser).not.toHaveBeenCalled();
  });

  it('returns to the club once the account exists', async () => {
    await renderPage();
    fillValidForm();

    submit();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/organizations/org-1'));
    expect(showSuccess).toHaveBeenCalledWith(expect.stringContaining('aoife@example.com'));
  });

  it('assigns the roles that were chosen', async () => {
    await renderPage();
    fillValidForm();
    const chosen = chooseRole('role-1');

    submit();

    await waitFor(() => expect(api.createOrganizationAdminUser).toHaveBeenCalled());
    if (chosen) {
      await waitFor(() =>
        expect(api.assignRoleToUser).toHaveBeenCalledWith('org-1', 'user-9', 'role-1')
      );
    }
  });

  it('says the account was created even when a role could not be attached', async () => {
    await renderPage();
    fillValidForm();
    const chosen = chooseRole('role-1');
    api.assignRoleToUser.mockRejectedValue(new Error('role gone'));

    submit();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/organizations/org-1'));
    if (chosen) {
      // Reporting this as a failed creation sends the operator back to a
      // duplicate-email error, with a role-less administrator already live.
      expect(showError).toHaveBeenCalledWith(expect.stringContaining('was created'));
      expect(showSuccess).not.toHaveBeenCalled();
    }
  });
});

describe('AddOrganizationAdminUserPage — when the account cannot be created', () => {
  it('shows the server’s own explanation', async () => {
    await renderPage();
    fillValidForm();
    api.createOrganizationAdminUser.mockRejectedValue({
      response: { data: { message: 'Email already registered' } },
    });

    submit();

    expect((await screen.findByRole('alert')).textContent).toContain('Email already registered');
  });

  it('falls back to something an operator can act on', async () => {
    await renderPage();
    fillValidForm();
    api.createOrganizationAdminUser.mockRejectedValue(new Error('boom'));

    submit();

    // "boom" tells them nothing; the fallback names the likely cause.
    expect((await screen.findByRole('alert')).textContent).toMatch(/already in use/i);
  });

  it('stays on the form so nothing typed is lost', async () => {
    await renderPage();
    fillValidForm();
    api.createOrganizationAdminUser.mockRejectedValue(new Error('boom'));

    submit();

    await screen.findByRole('alert');
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/email address/i)).toHaveValue('aoife@example.com');
  });

  it('lets the operator try again after a failure', async () => {
    await renderPage();
    fillValidForm();
    api.createOrganizationAdminUser.mockRejectedValueOnce(new Error('boom'));

    submit();
    await screen.findByRole('alert');
    submit();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/organizations/org-1'));
  });
});

describe('AddOrganizationAdminUserPage — leaving', () => {
  it('goes back to the club without creating anything', async () => {
    await renderPage();
    fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(api.createOrganizationAdminUser).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/organizations/org-1');
  });
});
