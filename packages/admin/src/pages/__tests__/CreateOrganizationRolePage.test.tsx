import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CreateOrganizationRolePage } from '../CreateOrganizationRolePage';

/**
 * Defining a role a club's administrators can hold.
 *
 * A role's `name` is what the backend and the permission checks key on, so it
 * has to stay URL-friendly. The form generates it from the display name as it
 * is typed — that generation is the thing worth pinning, because a role named
 * "Treasurer & Secretary" that silently becomes `treasurer-&-secretary` is
 * rejected by the server after the operator has filled in everything else.
 *
 * The other rule is that a role granting nothing is not worth creating: it
 * gives whoever holds it no access at all, and reads on screen exactly like a
 * working one.
 */

const { api, navigate, showSuccess, showError, params } = vi.hoisted(() => ({
  api: {
    getOrganizationById: vi.fn(),
    getCapabilities: vi.fn(),
    createOrganizationRole: vi.fn(),
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

const CAPABILITIES = [
  { id: 'c-1', name: 'memberships', displayName: 'Memberships' },
  { id: 'c-2', name: 'events', displayName: 'Events' },
];

const renderPage = async () => {
  api.getOrganizationById.mockResolvedValue(ORG);
  api.getCapabilities.mockResolvedValue(CAPABILITIES);
  render(
    <MemoryRouter>
      <CreateOrganizationRolePage />
    </MemoryRouter>
  );
  await waitFor(() => expect(api.getOrganizationById).toHaveBeenCalled());
  await screen.findByLabelText(/display name/i);
};

const nameIt = (displayName: string) =>
  fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: displayName } });

const roleName = () => screen.getByLabelText(/role name/i) as HTMLInputElement;

const submit = () => fireEvent.click(screen.getByRole('button', { name: /create role/i }));

/*
 * Grant something, so the "at least one permission" rule is satisfied. Ticking
 * a capability only *selects* it; the permission is what the quick-add applies.
 */
const grantSomething = () => {
  fireEvent.click(screen.getByRole('button', { name: /all as read/i }));
};

const alertText = async () => (await screen.findByRole('alert')).textContent ?? '';

beforeEach(() => {
  vi.clearAllMocks();
  params.current = { id: 'org-1' };
  api.createOrganizationRole.mockResolvedValue({ id: 'role-9' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CreateOrganizationRolePage — arriving', () => {
  it('reads the club and the capabilities a role can grant', async () => {
    await renderPage();

    expect(api.getOrganizationById).toHaveBeenCalledWith('org-1');
    expect(api.getCapabilities).toHaveBeenCalled();
  });

  it('says so when the club could not be read', async () => {
    api.getOrganizationById.mockRejectedValue(new Error('network down'));
    api.getCapabilities.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <CreateOrganizationRolePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(showError).toHaveBeenCalled());
  });
});

describe('CreateOrganizationRolePage — naming the role', () => {
  it('generates a URL-friendly name as the display name is typed', async () => {
    await renderPage();

    nameIt('Treasurer');

    expect(roleName()).toHaveValue('treasurer');
  });

  it('replaces spaces and punctuation rather than passing them to the server', async () => {
    await renderPage();

    nameIt('Treasurer & Secretary');

    // `treasurer-&-secretary` is rejected server-side after the whole form is
    // filled in — the generation is what stops that ever being sent.
    expect(roleName().value).toMatch(/^[a-z0-9-]+$/);
  });

  it('does not leave a name starting or ending in a hyphen', async () => {
    await renderPage();

    nameIt('  Treasurer!  ');

    expect(roleName().value).toBe('treasurer');
  });

  it('collapses a run of punctuation into a single hyphen', async () => {
    await renderPage();

    nameIt('Head — Groundskeeper');

    expect(roleName().value).toBe('head-groundskeeper');
  });
});

describe('CreateOrganizationRolePage — what it refuses to send', () => {
  const expectRefusal = async (pattern: RegExp) => {
    submit();
    expect(await alertText()).toMatch(pattern);
    expect(api.createOrganizationRole).not.toHaveBeenCalled();
  };

  it('refuses a role with no name', async () => {
    await renderPage();
    grantSomething();

    await expectRefusal(/required/i);
  });

  it('refuses a role that grants nothing', async () => {
    await renderPage();
    nameIt('Treasurer');

    // Whoever holds it gets no access, and it reads like a working role.
    await expectRefusal(/at least one capability/i);
  });

  it('refuses a hand-edited name that is not URL-friendly', async () => {
    await renderPage();
    nameIt('Treasurer');
    fireEvent.change(roleName(), { target: { value: 'Treasurer Role' } });
    grantSomething();

    await expectRefusal(/lowercase letters, numbers, and hyphens/i);
  });
});

describe('CreateOrganizationRolePage — creating the role', () => {
  it('creates it under the club in the route', async () => {
    await renderPage();
    nameIt('Treasurer');
    grantSomething();

    submit();

    await waitFor(() =>
      expect(api.createOrganizationRole).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ displayName: 'Treasurer', name: 'treasurer' })
      )
    );
  });

  it('sends the permissions that were granted', async () => {
    await renderPage();
    nameIt('Treasurer');
    grantSomething();

    submit();

    await waitFor(() => expect(api.createOrganizationRole).toHaveBeenCalled());
    const sent = api.createOrganizationRole.mock.calls[0][1];
    expect(Object.keys(sent.capabilityPermissions).length).toBeGreaterThan(0);
  });

  it('returns to the club once the role exists', async () => {
    await renderPage();
    nameIt('Treasurer');
    grantSomething();

    submit();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/organizations/org-1'));
    expect(showSuccess).toHaveBeenCalled();
  });

  it('shows the server’s own explanation of a refusal', async () => {
    await renderPage();
    nameIt('Treasurer');
    grantSomething();
    api.createOrganizationRole.mockRejectedValue({
      response: { data: { message: 'A role with that name already exists' } },
    });

    submit();

    expect(await alertText()).toContain('A role with that name already exists');
  });

  it('stays on the form so the permissions just set are not lost', async () => {
    await renderPage();
    nameIt('Treasurer');
    grantSomething();
    api.createOrganizationRole.mockRejectedValue(new Error('boom'));

    submit();

    await screen.findByRole('alert');
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/display name/i)).toHaveValue('Treasurer');
  });

  it('lets the operator dismiss the failure and try again', async () => {
    await renderPage();
    nameIt('Treasurer');
    grantSomething();
    api.createOrganizationRole.mockRejectedValueOnce(new Error('boom'));

    submit();
    await screen.findByRole('alert');
    submit();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/organizations/org-1'));
  });
});

describe('CreateOrganizationRolePage — leaving', () => {
  it('goes back to the club without creating anything', async () => {
    await renderPage();
    nameIt('Treasurer');

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(api.createOrganizationRole).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/organizations/org-1');
  });
});
