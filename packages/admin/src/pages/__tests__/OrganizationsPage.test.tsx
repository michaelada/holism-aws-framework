import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrganizationsPage } from '../OrganizationsPage';

/**
 * Every club on the platform, and the one destructive thing a super-admin can
 * do to them.
 *
 * Organisations are never deleted — they are *deactivated*, which closes the
 * club to its members and its own administrators while keeping everything it
 * holds. That is irreversible enough to need a typed confirmation, so the
 * things worth pinning are: nothing is written before the confirmation, the
 * consequences are spelled out with real numbers, and a bulk run that partly
 * fails says exactly which clubs did not change rather than reporting success.
 *
 * The type filter lives in the URL rather than in component state, so a
 * filtered list survives opening a club and coming back.
 */

const { api, navigate, showSuccess, showError } = vi.hoisted(() => ({
  api: {
    getOrganizations: vi.fn(),
    getOrganizationTypes: vi.fn(),
    updateOrganization: vi.fn(),
  },
  navigate: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

vi.mock('../../services/organizationApi', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getOrganizations: api.getOrganizations,
  getOrganizationTypes: api.getOrganizationTypes,
  updateOrganization: api.updateOrganization,
}));

vi.mock('../../context/NotificationContext', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNotification: () => ({ showSuccess, showError, showInfo: vi.fn() }),
}));

const org = (over: Record<string, unknown> = {}) => ({
  id: 'org-1',
  name: 'meath',
  displayName: 'Meath Hunt Club',
  organizationTypeId: 'ot-1',
  status: 'active',
  urlCode: 'meath',
  domain: 'meath.example.com',
  enabledCapabilities: ['memberships'],
  adminUserCount: 2,
  accountUserCount: 140,
  ...over,
});

const TYPES = [
  { id: 'ot-1', displayName: 'Hunt Club' },
  { id: 'ot-2', displayName: 'Riding School' },
];

const renderPage = async (orgs: unknown[] = [org()], types: unknown[] = TYPES) => {
  api.getOrganizations.mockResolvedValue(orgs);
  api.getOrganizationTypes.mockResolvedValue(types);
  render(
    <MemoryRouter>
      <OrganizationsPage />
    </MemoryRouter>
  );
  await waitFor(() => expect(api.getOrganizations).toHaveBeenCalled());
};

const rowFor = (displayName: string) =>
  Array.from(document.querySelectorAll('tbody tr')).find((r) =>
    r.textContent?.includes(displayName)
  ) as HTMLElement;

const listedNames = () =>
  Array.from(document.querySelectorAll('tbody tr'))
    .map((r) => r.textContent ?? '')
    .filter((t) => t.trim() !== '');

const dialog = () => screen.getByRole('dialog');

const confirmButton = () =>
  within(dialog())
    .getAllByRole('button')
    .find((b) => /make inactive|reactivate|confirm/i.test(b.textContent ?? ''))!;

/** The typed-phrase gate on a destructive confirmation. */
const typeConfirmation = (phrase: string) =>
  fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: phrase } });

const selectRow = (displayName: string) =>
  fireEvent.click(within(rowFor(displayName)).getByRole('checkbox'));

const runBulk = (label: RegExp) =>
  fireEvent.click(screen.getAllByRole('button').find((b) => label.test(b.textContent ?? ''))!);

beforeEach(() => {
  vi.clearAllMocks();
  api.updateOrganization.mockResolvedValue({});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OrganizationsPage — loading', () => {
  it('reads the organisations and their types together', async () => {
    await renderPage();

    expect(api.getOrganizations).toHaveBeenCalled();
    expect(api.getOrganizationTypes).toHaveBeenCalled();
  });

  it('shows each organisation with the name of its type', async () => {
    await renderPage([org()]);

    expect(await screen.findByText('Meath Hunt Club')).toBeInTheDocument();
    expect(screen.getByText('Hunt Club')).toBeInTheDocument();
  });

  it('says a type is unknown rather than showing a raw id', async () => {
    await renderPage([org({ organizationTypeId: 'ot-missing' })]);

    // An id in that column tells a super-admin nothing about the club.
    expect(await screen.findByText('Unknown')).toBeInTheDocument();
  });

  it('offers a way to try again when the load failed', async () => {
    api.getOrganizations.mockRejectedValue(new Error('network down'));
    api.getOrganizationTypes.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <OrganizationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
    expect(showError).toHaveBeenCalled();
  });

  it('reloads everything when the operator tries again', async () => {
    api.getOrganizations.mockRejectedValueOnce(new Error('network down'));
    api.getOrganizationTypes.mockResolvedValue(TYPES);
    render(
      <MemoryRouter>
        <OrganizationsPage />
      </MemoryRouter>
    );
    await screen.findByText(/could not be loaded/i);

    api.getOrganizations.mockResolvedValue([org()]);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Meath Hunt Club')).toBeInTheDocument();
  });

  it('explains what an organisation is when there are none yet', async () => {
    await renderPage([]);

    expect(await screen.findByText(/no organisations yet/i)).toBeInTheDocument();
  });
});

describe('OrganizationsPage — filtering by type', () => {
  it('narrows the list to one organisation type', async () => {
    await renderPage([
      org({ id: 'a', displayName: 'Meath Hunt Club', organizationTypeId: 'ot-1' }),
      org({ id: 'b', displayName: 'Kildare Riding School', organizationTypeId: 'ot-2' }),
    ]);
    await screen.findByText('Meath Hunt Club');

    fireEvent.mouseDown(screen.getByRole('combobox', { name: /filter by type/i }));
    fireEvent.click(screen.getByRole('listbox').querySelector('[data-value="ot-2"]')!);

    await waitFor(() => expect(listedNames().join(' ')).toContain('Kildare Riding School'));
    expect(listedNames().join(' ')).not.toContain('Meath Hunt Club');
  });

  it('offers a way back to the whole list once a filter is on', async () => {
    await renderPage([org()]);
    await screen.findByText('Meath Hunt Club');

    fireEvent.mouseDown(screen.getByRole('combobox', { name: /filter by type/i }));
    fireEvent.click(screen.getByRole('listbox').querySelector('[data-value="ot-1"]')!);

    expect(await screen.findByRole('button', { name: /clear filters/i })).toBeInTheDocument();
  });

  it('shows everything again when the filter is cleared', async () => {
    await renderPage([
      org({ id: 'a', displayName: 'Meath Hunt Club', organizationTypeId: 'ot-1' }),
      org({ id: 'b', displayName: 'Kildare Riding School', organizationTypeId: 'ot-2' }),
    ]);
    await screen.findByText('Meath Hunt Club');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /filter by type/i }));
    fireEvent.click(screen.getByRole('listbox').querySelector('[data-value="ot-2"]')!);
    await waitFor(() => expect(listedNames()).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));

    await waitFor(() => expect(listedNames()).toHaveLength(2));
  });
});

describe('OrganizationsPage — opening an organisation', () => {
  it('opens the club that was clicked', async () => {
    await renderPage([org({ id: 'org-7' })]);
    await screen.findByText('Meath Hunt Club');

    fireEvent.click(screen.getByRole('button', { name: /view meath hunt club/i }));

    expect(navigate).toHaveBeenCalledWith('/organizations/org-7');
  });

  it('edits the club that was clicked', async () => {
    await renderPage([org({ id: 'org-7' })]);
    await screen.findByText('Meath Hunt Club');

    fireEvent.click(screen.getByRole('button', { name: /edit meath hunt club/i }));

    expect(navigate).toHaveBeenCalledWith('/organizations/org-7/edit');
  });

  it('starts a new organisation from the page header', async () => {
    await renderPage([org()]);
    await screen.findByText('Meath Hunt Club');

    fireEvent.click(screen.getByRole('button', { name: /create organisation/i }));

    expect(navigate).toHaveBeenCalledWith('/organizations/new');
  });

  it('starts one from the empty state, where there is no list to act on', async () => {
    await renderPage([]);
    await screen.findByText(/no organisations yet/i);

    fireEvent.click(screen.getByRole('button', { name: /create the first organisation/i }));

    expect(navigate).toHaveBeenCalledWith('/organizations/new');
  });
});

describe('OrganizationsPage — making one organisation inactive', () => {
  const openDeactivate = () =>
    fireEvent.click(screen.getByRole('button', { name: /make meath hunt club inactive/i }));

  it('asks before anything is written', async () => {
    await renderPage([org()]);
    await screen.findByText('Meath Hunt Club');

    openDeactivate();

    expect(dialog()).toBeInTheDocument();
    expect(api.updateOrganization).not.toHaveBeenCalled();
  });

  it('spells out who loses access, with real numbers', async () => {
    await renderPage([org({ accountUserCount: 140, adminUserCount: 2 })]);
    await screen.findByText('Meath Hunt Club');

    openDeactivate();

    // "Are you sure?" does not tell a super-admin what they are about to do.
    expect(dialog().textContent).toContain('140 member');
    expect(dialog().textContent).toContain('2 administrator');
  });

  it('says plainly that nothing is deleted', async () => {
    await renderPage();
    await screen.findByText('Meath Hunt Club');

    openDeactivate();

    expect(dialog().textContent).toMatch(/nothing is deleted/i);
  });

  it('will not act until the club’s name has been typed', async () => {
    await renderPage();
    await screen.findByText('Meath Hunt Club');

    openDeactivate();

    // The typed phrase is what stops a mis-click closing a club.
    expect(confirmButton()).toBeDisabled();
  });

  it('deactivates rather than deleting once confirmed', async () => {
    await renderPage([org({ id: 'org-7' })]);
    await screen.findByText('Meath Hunt Club');

    openDeactivate();
    typeConfirmation('Meath Hunt Club');
    fireEvent.click(confirmButton());

    await waitFor(() =>
      expect(api.updateOrganization).toHaveBeenCalledWith('org-7', { status: 'inactive' })
    );
  });

  it('re-reads the list so the new status is what is on screen', async () => {
    await renderPage([org()]);
    await screen.findByText('Meath Hunt Club');

    openDeactivate();
    typeConfirmation('Meath Hunt Club');
    fireEvent.click(confirmButton());

    await waitFor(() => expect(api.getOrganizations).toHaveBeenCalledTimes(2));
    expect(showSuccess).toHaveBeenCalledWith(expect.stringContaining('inactive'));
  });

  it('reports the server’s own reason for refusing', async () => {
    await renderPage();
    await screen.findByText('Meath Hunt Club');
    api.updateOrganization.mockRejectedValue({
      response: { data: { error: 'Organisation has an open billing period' } },
    });

    openDeactivate();
    typeConfirmation('Meath Hunt Club');
    fireEvent.click(confirmButton());

    await waitFor(() =>
      expect(showError).toHaveBeenCalledWith('Organisation has an open billing period')
    );
  });

  it('changes nothing when the operator backs out', async () => {
    await renderPage();
    await screen.findByText('Meath Hunt Club');

    openDeactivate();
    fireEvent.click(within(dialog()).getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.updateOrganization).not.toHaveBeenCalled();
  });
});

describe('OrganizationsPage — acting on several at once', () => {
  const twoActive = [
    org({ id: 'a', displayName: 'Meath Hunt Club' }),
    org({ id: 'b', displayName: 'Kildare Riding School' }),
  ];

  it('asks before running a bulk change', async () => {
    await renderPage(twoActive);
    await screen.findByText('Meath Hunt Club');

    selectRow('Meath Hunt Club');
    selectRow('Kildare Riding School');
    runBulk(/make inactive/i);

    expect(dialog().textContent).toContain('Meath Hunt Club');
    expect(dialog().textContent).toContain('Kildare Riding School');
    expect(api.updateOrganization).not.toHaveBeenCalled();
  });

  it('updates every organisation that was selected', async () => {
    await renderPage(twoActive);
    await screen.findByText('Meath Hunt Club');

    selectRow('Meath Hunt Club');
    selectRow('Kildare Riding School');
    runBulk(/make inactive/i);
    fireEvent.click(confirmButton());

    await waitFor(() => expect(api.updateOrganization).toHaveBeenCalledTimes(2));
    expect(api.updateOrganization).toHaveBeenCalledWith('a', { status: 'inactive' });
    expect(api.updateOrganization).toHaveBeenCalledWith('b', { status: 'inactive' });
  });

  it('names the ones that failed rather than reporting a clean run', async () => {
    await renderPage(twoActive);
    await screen.findByText('Meath Hunt Club');
    api.updateOrganization.mockImplementation(async (id: string) => {
      if (id === 'b') throw new Error('refused');
      return {};
    });

    selectRow('Meath Hunt Club');
    selectRow('Kildare Riding School');
    runBulk(/make inactive/i);
    fireEvent.click(confirmButton());

    // A partial failure reported as success leaves a club open that nobody
    // realises is still open.
    await waitFor(() =>
      expect(showError).toHaveBeenCalledWith(expect.stringContaining('Kildare Riding School'))
    );
    expect(showSuccess).not.toHaveBeenCalled();
  });

  it('says so when none of them changed', async () => {
    await renderPage(twoActive);
    await screen.findByText('Meath Hunt Club');
    api.updateOrganization.mockRejectedValue(new Error('refused'));

    selectRow('Meath Hunt Club');
    selectRow('Kildare Riding School');
    runBulk(/make inactive/i);
    fireEvent.click(confirmButton());

    await waitFor(() =>
      expect(showError).toHaveBeenCalledWith(expect.stringContaining('No organisations were updated'))
    );
  });

  it('reactivates a batch of closed clubs', async () => {
    await renderPage([
      org({ id: 'a', displayName: 'Meath Hunt Club', status: 'inactive' }),
      org({ id: 'b', displayName: 'Kildare Riding School', status: 'inactive' }),
    ]);
    await screen.findByText('Meath Hunt Club');

    selectRow('Meath Hunt Club');
    selectRow('Kildare Riding School');
    runBulk(/^reactivate$/i);
    fireEvent.click(confirmButton());

    await waitFor(() => expect(api.updateOrganization).toHaveBeenCalledWith('a', { status: 'active' }));
    expect(api.updateOrganization).toHaveBeenCalledWith('b', { status: 'active' });
  });

  it('changes nothing when a bulk run is cancelled', async () => {
    await renderPage(twoActive);
    await screen.findByText('Meath Hunt Club');

    selectRow('Meath Hunt Club');
    runBulk(/make inactive/i);
    fireEvent.click(within(dialog()).getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.updateOrganization).not.toHaveBeenCalled();
  });
});
