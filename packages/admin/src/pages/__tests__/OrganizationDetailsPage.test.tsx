import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrganizationDetailsPage } from '../OrganizationDetailsPage';

/**
 * One club, its administrators and the roles they hold.
 *
 * The riskiest thing here is editing an administrator's roles. It is not one
 * request but a *reconciliation*: roles the operator removed have to be
 * unassigned and roles they added assigned, and only those. Re-sending the
 * whole set would strip and re-grant permissions the person still holds, and a
 * removal that is skipped leaves someone with access the operator believes they
 * took away.
 *
 * Deleting a role is the other one. A role several administrators hold is not
 * the same decision as an unused one, so the confirmation counts them first.
 */

const { api, navigate, showSuccess, showError, params } = vi.hoisted(() => ({
  api: {
    getOrganizationById: vi.fn(),
    getOrganizationUsers: vi.fn(),
    getOrganizationRoles: vi.fn(),
    getCapabilities: vi.fn(),
    updateOrganizationUser: vi.fn(),
    deleteOrganizationUser: vi.fn(),
    assignRoleToUser: vi.fn(),
    removeRoleFromUser: vi.fn(),
    updateOrganizationRole: vi.fn(),
    deleteOrganizationRole: vi.fn(),
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

const ORG = {
  id: 'org-1',
  name: 'meath',
  displayName: 'Meath Hunt Club',
  organizationTypeId: 'ot-1',
  status: 'active',
  enabledCapabilities: ['memberships', 'events'],
};

const USER = {
  id: 'user-1',
  email: 'aoife@example.com',
  firstName: 'Aoife',
  lastName: 'Byrne',
  status: 'active',
  roles: ['role-1'],
};

const ROLES = [
  { id: 'role-1', name: 'treasurer', displayName: 'Treasurer', description: 'Money', capabilityPermissions: {}, isSystemRole: false },
  { id: 'role-2', name: 'secretary', displayName: 'Secretary', description: '', capabilityPermissions: {}, isSystemRole: false },
];

const renderPage = async (over: Record<string, unknown> = {}) => {
  api.getOrganizationById.mockResolvedValue(over.org ?? ORG);
  api.getOrganizationUsers.mockResolvedValue(over.users ?? [USER]);
  api.getOrganizationRoles.mockResolvedValue(over.roles ?? ROLES);
  api.getCapabilities.mockResolvedValue(over.capabilities ?? [{ id: 'c-1', name: 'memberships' }]);
  render(
    <MemoryRouter>
      <OrganizationDetailsPage />
    </MemoryRouter>
  );
  await waitFor(() => expect(api.getOrganizationById).toHaveBeenCalled());
  // The club's name appears in the header and again in the overview beneath it.
  await screen.findAllByText('Meath Hunt Club');
};

const openTab = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }));

const dialog = () => screen.getByRole('dialog');

const confirmIn = (label: RegExp) =>
  fireEvent.click(
    within(dialog())
      .getAllByRole('button')
      .find((b) => label.test(b.textContent ?? ''))!
  );

beforeEach(() => {
  vi.clearAllMocks();
  params.current = { id: 'org-1' };
  api.updateOrganizationUser.mockResolvedValue({});
  api.deleteOrganizationUser.mockResolvedValue(undefined);
  api.assignRoleToUser.mockResolvedValue(undefined);
  api.removeRoleFromUser.mockResolvedValue(undefined);
  api.updateOrganizationRole.mockResolvedValue({});
  api.deleteOrganizationRole.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OrganizationDetailsPage — loading', () => {
  it('reads the club, its administrators, its roles and the capabilities together', async () => {
    await renderPage();

    expect(api.getOrganizationById).toHaveBeenCalledWith('org-1');
    expect(api.getOrganizationUsers).toHaveBeenCalledWith('org-1', 'org-admin');
    expect(api.getOrganizationRoles).toHaveBeenCalledWith('org-1');
    expect(api.getCapabilities).toHaveBeenCalled();
  });

  it('asks only for administrators, not for every account holder', async () => {
    await renderPage();

    // A club's members are not its administrators; listing them here would be
    // both wrong and enormous.
    expect(api.getOrganizationUsers).toHaveBeenCalledWith('org-1', 'org-admin');
  });

  it('says so when the club could not be loaded', async () => {
    api.getOrganizationById.mockRejectedValue(new Error('network down'));
    api.getOrganizationUsers.mockResolvedValue([]);
    api.getOrganizationRoles.mockResolvedValue([]);
    api.getCapabilities.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <OrganizationDetailsPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(showError).toHaveBeenCalled());
  });

  it('asks for nothing when the route carries no organisation', async () => {
    params.current = {};
    render(
      <MemoryRouter>
        <OrganizationDetailsPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.getOrganizationById).not.toHaveBeenCalled());
  });
});

describe('OrganizationDetailsPage — moving between tabs', () => {
  it('counts the administrators and roles on their tabs', async () => {
    await renderPage();

    expect(screen.getByRole('tab', { name: /administrator users \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /roles \(2\)/i })).toBeInTheDocument();
  });

  it('lists the capabilities the club has been granted', async () => {
    await renderPage();

    openTab(/capabilities/i);

    expect(await screen.findByText('memberships')).toBeInTheDocument();
    expect(screen.getByText('events')).toBeInTheDocument();
  });

  it('lists the administrators', async () => {
    await renderPage();

    openTab(/administrator users/i);

    expect(await screen.findByText('aoife@example.com')).toBeInTheDocument();
  });

  it('lists the roles', async () => {
    await renderPage();

    openTab(/roles \(/i);

    expect(await screen.findByText('Treasurer')).toBeInTheDocument();
  });
});

describe('OrganizationDetailsPage — editing an administrator', () => {
  const openEdit = async () => {
    openTab(/administrator users/i);
    await screen.findByText('aoife@example.com');
    fireEvent.click(screen.getByRole('button', { name: /edit aoife byrne/i }));
  };

  it('opens with the person’s current details', async () => {
    await renderPage();

    await openEdit();

    expect(within(dialog()).getByDisplayValue('Aoife')).toBeInTheDocument();
    expect(within(dialog()).getByDisplayValue('aoife@example.com')).toBeInTheDocument();
  });

  it('saves a changed name', async () => {
    await renderPage();
    await openEdit();

    fireEvent.change(within(dialog()).getByDisplayValue('Aoife'), {
      target: { value: 'Aoife Marie' },
    });
    confirmIn(/save|update/i);

    await waitFor(() =>
      expect(api.updateOrganizationUser).toHaveBeenCalledWith(
        'org-1',
        'user-1',
        expect.objectContaining({ firstName: 'Aoife Marie' })
      )
    );
  });

  it('touches no roles when none were changed', async () => {
    await renderPage();
    await openEdit();

    confirmIn(/save|update/i);

    // Re-granting a role someone already holds is a permissions change nobody
    // asked for, and it shows up in the audit trail as one.
    await waitFor(() => expect(api.updateOrganizationUser).toHaveBeenCalled());
    expect(api.assignRoleToUser).not.toHaveBeenCalled();
    expect(api.removeRoleFromUser).not.toHaveBeenCalled();
  });

  it('reports what went wrong when the save was refused', async () => {
    await renderPage();
    await openEdit();
    api.updateOrganizationUser.mockRejectedValue({
      response: { data: { error: 'Email already in use' } },
    });

    confirmIn(/save|update/i);

    await waitFor(() => expect(showError).toHaveBeenCalledWith('Email already in use'));
  });

  it('changes nothing when the operator cancels', async () => {
    await renderPage();
    await openEdit();

    confirmIn(/cancel/i);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.updateOrganizationUser).not.toHaveBeenCalled();
  });
});

describe('OrganizationDetailsPage — removing an administrator', () => {
  const openDelete = async () => {
    openTab(/administrator users/i);
    await screen.findByText('aoife@example.com');
    fireEvent.click(screen.getByRole('button', { name: /delete aoife byrne/i }));
  };

  it('asks first, and says what stays behind', async () => {
    await renderPage();

    await openDelete();

    expect(dialog().textContent).toContain('Aoife Byrne');
    // What they created belongs to the club, not to them; saying so stops an
    // operator hesitating over losing a season's events.
    expect(dialog().textContent).toMatch(/stays with the organisation/i);
    expect(api.deleteOrganizationUser).not.toHaveBeenCalled();
  });

  it('removes the administrator once confirmed', async () => {
    await renderPage();
    await openDelete();

    confirmIn(/remove administrator/i);

    await waitFor(() =>
      expect(api.deleteOrganizationUser).toHaveBeenCalledWith('org-1', 'user-1')
    );
    expect(showSuccess).toHaveBeenCalled();
  });

  it('re-reads the club so the list matches what happened', async () => {
    await renderPage();
    await openDelete();

    confirmIn(/remove administrator/i);

    await waitFor(() => expect(api.getOrganizationUsers).toHaveBeenCalledTimes(2));
  });

  it('reports a refusal rather than pretending it worked', async () => {
    await renderPage();
    await openDelete();
    api.deleteOrganizationUser.mockRejectedValue({
      response: { data: { error: 'Last administrator cannot be removed' } },
    });

    confirmIn(/remove administrator/i);

    await waitFor(() =>
      expect(showError).toHaveBeenCalledWith('Last administrator cannot be removed')
    );
  });

  it('removes nobody when the operator backs out', async () => {
    await renderPage();
    await openDelete();

    confirmIn(/cancel/i);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.deleteOrganizationUser).not.toHaveBeenCalled();
  });
});

describe('OrganizationDetailsPage — deleting a role', () => {
  const openDeleteRole = async (name = 'Treasurer') => {
    openTab(/roles \(/i);
    await screen.findByText(name);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`delete role ${name}`, 'i') }));
  };

  it('counts the administrators who would lose the permissions', async () => {
    await renderPage({
      users: [USER, { ...USER, id: 'user-2', firstName: 'Cian', lastName: 'Murphy', roles: ['role-1'] }],
    });

    await openDeleteRole();

    // "Delete this role?" without the count hides who it affects.
    expect(dialog().textContent).toMatch(/2 administrators currently hold/i);
  });

  it('says plainly when nobody holds the role', async () => {
    await renderPage();

    await openDeleteRole('Secretary');

    expect(dialog().textContent).toMatch(/no administrators currently hold/i);
  });

  it('counts holders when roles come back as objects rather than ids', async () => {
    await renderPage({
      users: [{ ...USER, roles: [{ id: 'role-1', name: 'treasurer' }] }],
    });

    await openDeleteRole();

    // The API has returned both shapes; counting only one silently reads zero.
    expect(dialog().textContent).toMatch(/1 administrator currently holds/i);
  });

  it('deletes the role once confirmed', async () => {
    await renderPage();
    await openDeleteRole();

    confirmIn(/delete role/i);

    await waitFor(() =>
      expect(api.deleteOrganizationRole).toHaveBeenCalledWith('org-1', 'role-1')
    );
  });

  it('reports a refusal', async () => {
    await renderPage();
    await openDeleteRole();
    api.deleteOrganizationRole.mockRejectedValue({
      response: { data: { error: 'Role is in use' } },
    });

    confirmIn(/delete role/i);

    await waitFor(() => expect(showError).toHaveBeenCalledWith('Role is in use'));
  });

  it('deletes nothing when cancelled', async () => {
    await renderPage();
    await openDeleteRole();

    confirmIn(/cancel/i);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.deleteOrganizationRole).not.toHaveBeenCalled();
  });
});

describe('OrganizationDetailsPage — going elsewhere', () => {
  it('adds an administrator on its own screen', async () => {
    await renderPage();

    openTab(/administrator users/i);
    fireEvent.click(await screen.findByRole('button', { name: /add administrator user/i }));

    expect(navigate).toHaveBeenCalledWith('/organizations/org-1/users/add');
  });

  it('creates a role on its own screen', async () => {
    await renderPage();

    openTab(/roles \(/i);
    fireEvent.click(await screen.findByRole('button', { name: /create role|add role/i }));

    expect(navigate).toHaveBeenCalledWith('/organizations/org-1/roles/create');
  });
});
