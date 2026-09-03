import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import UserGroupsPage from '../UserGroupsPage';

/**
 * Groups of account users, which discounts and mailings are aimed at.
 *
 * Two things here are worth holding still. Deleting a group does **not** rewrite
 * the discounts that name it, so when the server reports that a deleted group
 * was in use, the page has to say so — otherwise a club is left with a discount
 * rule pointing at a group that no longer exists, and no indication why it
 * stopped applying.
 *
 * The other is the member picker: somebody already in the group must not be
 * offered again, because adding them twice either errors or silently
 * double-counts the group's size.
 */

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('@itsplainsailing/orgadmin-shell', () => import('../../../test/orgadminShellMock'));
vi.mock('@itsplainsailing/orgadmin-shell/hooks/useTranslation', () =>
  import('../../../test/orgadminShellMock')
);
vi.mock('@itsplainsailing/orgadmin-shell/utils/currencyFormatting', () =>
  import('../../../test/orgadminShellMock')
);
vi.mock('@itsplainsailing/orgadmin-shell/utils/dateFormatting', () =>
  import('../../../test/orgadminShellMock')
);
vi.mock('@itsplainsailing/orgadmin-shell/context/LocaleContext', () =>
  import('../../../test/orgadminShellMock')
);

vi.mock('../../../hooks/useApi', () => ({
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
}));

const GROUP = { id: 'g-1', name: 'Committee', description: 'Runs the club', memberCount: 2 };

const MEMBERS = [
  { organisationUserId: 'u-1', firstName: 'Aoife', lastName: 'Byrne', email: 'aoife@example.com' },
];

const ACCOUNT_USERS = [
  { id: 'u-1', firstName: 'Aoife', lastName: 'Byrne', email: 'aoife@example.com' },
  { id: 'u-2', firstName: 'Cian', lastName: 'Murphy', email: 'cian@example.com' },
];

const respond = (over: Record<string, unknown> = {}) =>
  execute.mockImplementation(async ({ url, method }: { url: string; method: string }) => {
    if (method !== 'GET') return over.written ?? {};
    if (url.endsWith('/members')) return { members: over.members ?? MEMBERS };
    if (url.includes('/users/accounts/')) return over.accountUsers ?? ACCOUNT_USERS;
    if (url.endsWith('/user-groups')) return { groups: over.groups ?? [GROUP] };
    return {};
  });

const renderPage = async () => {
  renderWithProviders(<UserGroupsPage />);
  await waitFor(() => expect(execute).toHaveBeenCalled());
};

const loaded = () => screen.findByText('Committee');

const rowFor = (name: string) =>
  Array.from(document.querySelectorAll('tbody tr')).find((r) =>
    r.textContent?.includes(name)
  ) as HTMLElement;

const dialog = () => screen.getByRole('dialog');

const buttonIn = (host: HTMLElement, pattern: RegExp) =>
  within(host)
    .getAllByRole('button')
    .find((b) => pattern.test(b.textContent ?? '') || pattern.test(b.getAttribute('aria-label') ?? ''))!;

const writes = () => execute.mock.calls.map(([r]) => r).filter((r) => r.method !== 'GET');

beforeEach(() => {
  vi.clearAllMocks();
  respond();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('UserGroupsPage — listing groups', () => {
  it('reads the organisation’s groups', async () => {
    await renderPage();
    await loaded();

    expect(execute).toHaveBeenCalledWith({ method: 'GET', url: '/api/orgadmin/user-groups' });
  });

  it('shows a group with how many people are in it', async () => {
    await renderPage();
    await loaded();

    expect(within(rowFor('Committee')).getByText('2')).toBeInTheDocument();
  });

  it('shows a dash rather than a blank where a group has no description', async () => {
    respond({ groups: [{ ...GROUP, description: '' }] });
    await renderPage();
    await loaded();

    expect(within(rowFor('Committee')).getByText('—')).toBeInTheDocument();
  });

  it('says so when the groups could not be read', async () => {
    execute.mockRejectedValue(new Error('network down'));
    renderWithProviders(<UserGroupsPage />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('UserGroupsPage — creating and renaming a group', () => {
  const openCreate = () =>
    fireEvent.click(screen.getAllByRole('button').find((b) => /add|create|new/i.test(b.textContent ?? ''))!);

  it('will not save a group with no name', async () => {
    await renderPage();
    await loaded();

    openCreate();

    // An unnamed group is unpickable in every place a group is chosen.
    expect(buttonIn(dialog(), /save|create/i)).toBeDisabled();
  });

  it('creates a named group', async () => {
    await renderPage();
    await loaded();

    openCreate();
    fireEvent.change(within(dialog()).getAllByRole('textbox')[0], {
      target: { value: 'Juniors' },
    });
    fireEvent.click(buttonIn(dialog(), /save|create/i));

    await waitFor(() =>
      expect(writes()[0]).toMatchObject({
        method: 'POST',
        url: '/api/orgadmin/user-groups',
        data: { name: 'Juniors' },
      })
    );
  });

  it('updates the group being edited rather than creating another', async () => {
    await renderPage();
    await loaded();

    fireEvent.click(buttonIn(rowFor('Committee'), /edit/i));
    fireEvent.change(within(dialog()).getAllByRole('textbox')[0], {
      target: { value: 'Main Committee' },
    });
    fireEvent.click(buttonIn(dialog(), /save|update/i));

    await waitFor(() =>
      expect(writes()[0]).toMatchObject({ method: 'PUT', url: '/api/orgadmin/user-groups/g-1' })
    );
  });

  it('shows the server’s reason when a name is already taken', async () => {
    await renderPage();
    await loaded();
    execute.mockRejectedValue({ response: { data: { error: 'A group called Juniors exists' } } });

    fireEvent.click(buttonIn(rowFor('Committee'), /edit/i));
    fireEvent.click(buttonIn(dialog(), /save|update/i));

    // "Failed to save" leaves the operator retyping the same name.
    expect(await within(dialog()).findByText(/A group called Juniors exists/)).toBeInTheDocument();
  });

  it('changes nothing when the form is cancelled', async () => {
    await renderPage();
    await loaded();

    fireEvent.click(buttonIn(rowFor('Committee'), /edit/i));
    fireEvent.click(buttonIn(dialog(), /cancel/i));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes()).toHaveLength(0);
  });
});

describe('UserGroupsPage — deleting a group', () => {
  const openDelete = () => fireEvent.click(buttonIn(rowFor('Committee'), /delete/i));

  it('asks before deleting', async () => {
    await renderPage();
    await loaded();

    openDelete();

    expect(dialog()).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it('deletes the group once confirmed', async () => {
    await renderPage();
    await loaded();

    openDelete();
    fireEvent.click(buttonIn(dialog(), /delete/i));

    await waitFor(() =>
      expect(writes()[0]).toMatchObject({
        method: 'DELETE',
        url: '/api/orgadmin/user-groups/g-1',
      })
    );
  });

  /*
   * The server deletes the group but does not rewrite discounts that name it.
   * Saying nothing leaves a club with a discount that silently stops applying
   * and no way to find out why.
   */
  it('warns when discounts still point at the group it deleted', async () => {
    respond({ written: { usedByDiscounts: 3 } });
    await renderPage();
    await loaded();

    openDelete();
    fireEvent.click(buttonIn(dialog(), /delete/i));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('says nothing extra when no discount referenced it', async () => {
    respond({ written: { usedByDiscounts: 0 } });
    await renderPage();
    await loaded();

    openDelete();
    fireEvent.click(buttonIn(dialog(), /delete/i));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reports a delete that failed', async () => {
    await renderPage();
    await loaded();
    execute.mockRejectedValue(new Error('refused'));

    openDelete();
    fireEvent.click(buttonIn(dialog(), /delete/i));

    // Queried by text, not by role: the dialog stays open on failure, and MUI
    // marks everything behind it aria-hidden, which role queries skip.
    expect(await screen.findByText(/could not delete/i)).toBeInTheDocument();
  });

  it('deletes nothing when the operator backs out', async () => {
    await renderPage();
    await loaded();

    openDelete();
    fireEvent.click(buttonIn(dialog(), /cancel/i));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes()).toHaveLength(0);
  });
});

describe('UserGroupsPage — who is in a group', () => {
  const openMembers = async () => {
    fireEvent.click(buttonIn(rowFor('Committee'), /member|view/i));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  };

  it('reads the group’s members and the club’s account users', async () => {
    await renderPage();
    await loaded();

    await openMembers();

    const urls = execute.mock.calls.map(([r]) => r.url);
    expect(urls).toContain('/api/orgadmin/user-groups/g-1/members');
    expect(urls.some((u: string) => u.includes('/users/accounts/'))).toBe(true);
  });

  it('lists who is already in the group', async () => {
    await renderPage();
    await loaded();

    await openMembers();

    expect(await within(dialog()).findByText('Aoife Byrne')).toBeInTheDocument();
  });

  it('does not offer someone who is already a member', async () => {
    await renderPage();
    await loaded();
    await openMembers();

    const picker = within(dialog()).getAllByRole('combobox')[0];
    fireEvent.mouseDown(picker);
    fireEvent.change(picker, { target: { value: '' } });

    // Adding the same person twice either errors or double-counts the group.
    await waitFor(() => {
      const options = screen.queryAllByRole('option').map((o) => o.textContent ?? '');
      expect(options.some((o) => o.includes('cian@example.com'))).toBe(true);
      expect(options.some((o) => o.includes('aoife@example.com'))).toBe(false);
    });
  });

  it('removes a member from the group', async () => {
    await renderPage();
    await loaded();
    await openMembers();
    await within(dialog()).findByText('Aoife Byrne');

    fireEvent.click(buttonIn(dialog(), /remove/i));

    await waitFor(() =>
      expect(writes()[0]).toMatchObject({
        method: 'DELETE',
        url: '/api/orgadmin/user-groups/g-1/members/u-1',
      })
    );
  });

  it('re-reads the group after a member is removed', async () => {
    await renderPage();
    await loaded();
    await openMembers();
    await within(dialog()).findByText('Aoife Byrne');
    const before = execute.mock.calls.length;

    fireEvent.click(buttonIn(dialog(), /remove/i));

    // The count in the list is now wrong unless both are re-read.
    await waitFor(() => expect(execute.mock.calls.length).toBeGreaterThan(before + 1));
  });

  it('reports a removal the server refused', async () => {
    await renderPage();
    await loaded();
    await openMembers();
    await within(dialog()).findByText('Aoife Byrne');
    execute.mockRejectedValue(new Error('refused'));

    fireEvent.click(buttonIn(dialog(), /remove/i));

    // The members dialog is still open, so this is behind an aria-hidden root.
    expect(await screen.findByText(/could not remove/i)).toBeInTheDocument();
  });
});
