import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { MemoryRouter } from 'react-router-dom';
import MembershipTypesListPage from '../MembershipTypesListPage';

/**
 * Every membership a club offers, and the way into creating another.
 *
 * Single and group memberships are built on different screens, so the create
 * button is a menu rather than a link — picking the wrong destination lands a
 * secretary in a form with no group configuration at all, which they only
 * discover after filling it in.
 *
 * The filters are the other half: a club with two dozen types uses them to find
 * one, and status and category have to narrow together rather than replace one
 * another.
 */

const { execute, navigate } = vi.hoisted(() => ({ execute: vi.fn(), navigate: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

vi.mock('@itsplainsailing/orgadmin-shell', async () => {
  const { shellMock } = await import('../../test/shell-mock');
  return shellMock();
});

vi.mock('@itsplainsailing/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({
    organisation: { id: 'org-1', name: 'Meath' },
    setOrganisation: vi.fn(),
  }),
}));

const membershipType = (over: Record<string, unknown> = {}) => ({
  id: 'mt-1',
  name: 'Junior Member',
  description: 'Under 18s',
  membershipStatus: 'open',
  membershipTypeCategory: 'single',
  ...over,
});

const renderList = async (types: unknown[]) => {
  execute.mockResolvedValue(types);
  renderWithI18n(
    <MemoryRouter>
      <MembershipTypesListPage />
    </MemoryRouter>
  );
  await waitFor(() => expect(execute).toHaveBeenCalled());
  await waitFor(() => expect(document.querySelectorAll('tbody tr').length).toBeGreaterThan(0));
};

const listedNames = () =>
  Array.from(document.querySelectorAll('tbody tr'))
    .map((row) => row.querySelector('td:first-child p')?.textContent ?? '')
    .filter(Boolean);

const rowFor = (name: string) =>
  Array.from(document.querySelectorAll('tbody tr')).find(
    (row) => row.querySelector('td:first-child p')?.textContent === name
  ) as HTMLElement;

const search = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: text } });

const chooseFilter = (name: RegExp, value: string) => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name }));
  fireEvent.click(screen.getByRole('listbox').querySelector(`[data-value="${value}"]`)!);
};

const openCreateMenu = () => fireEvent.click(screen.getByText('Create Membership Type'));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MembershipTypesListPage — loading', () => {
  it('asks for the club’s membership types', async () => {
    await renderList([membershipType()]);

    expect(execute).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/orgadmin/membership-types',
    });
  });

  it('shows an empty list rather than a broken page when the load fails', async () => {
    execute.mockRejectedValue(new Error('network down'));
    renderWithI18n(
      <MemoryRouter>
        <MembershipTypesListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(execute).toHaveBeenCalled());
    expect(await screen.findByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('copes with a server that answers with nothing', async () => {
    execute.mockResolvedValue(null);
    renderWithI18n(
      <MemoryRouter>
        <MembershipTypesListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(execute).toHaveBeenCalled());
    await waitFor(() => expect(listedNames()).toEqual([]));
  });
});

describe('MembershipTypesListPage — finding a type', () => {
  it('matches on the name', async () => {
    await renderList([
      membershipType({ id: 'a', name: 'Junior Member' }),
      membershipType({ id: 'b', name: 'Senior Member' }),
    ]);

    search('junior');

    await waitFor(() => expect(listedNames()).toEqual(['Junior Member']));
  });

  it('matches on the description, where the detail actually is', async () => {
    await renderList([
      membershipType({ id: 'a', name: 'Junior Member', description: 'Under 18s' }),
      membershipType({ id: 'b', name: 'Senior Member', description: 'Over 65s' }),
    ]);

    search('over 65');

    await waitFor(() => expect(listedNames()).toEqual(['Senior Member']));
  });

  it('narrows to the types still accepting applications', async () => {
    await renderList([
      membershipType({ id: 'a', name: 'Open Type', membershipStatus: 'open' }),
      membershipType({ id: 'b', name: 'Closed Type', membershipStatus: 'closed' }),
    ]);

    chooseFilter(/status/i, 'open');

    await waitFor(() => expect(listedNames()).toEqual(['Open Type']));
  });

  it('narrows to group memberships', async () => {
    await renderList([
      membershipType({ id: 'a', name: 'Family', membershipTypeCategory: 'group' }),
      membershipType({ id: 'b', name: 'Junior', membershipTypeCategory: 'single' }),
    ]);

    chooseFilter(/type/i, 'group');

    await waitFor(() => expect(listedNames()).toEqual(['Family']));
  });

  it('applies status, category and search together', async () => {
    await renderList([
      membershipType({ id: 'a', name: 'Family Open', membershipTypeCategory: 'group', membershipStatus: 'open' }),
      membershipType({ id: 'b', name: 'Family Closed', membershipTypeCategory: 'group', membershipStatus: 'closed' }),
      membershipType({ id: 'c', name: 'Junior Open', membershipTypeCategory: 'single', membershipStatus: 'open' }),
    ]);

    chooseFilter(/status/i, 'open');
    chooseFilter(/type/i, 'group');
    search('family');

    // Each filter narrows what the last one left, rather than replacing it.
    await waitFor(() => expect(listedNames()).toEqual(['Family Open']));
  });

  it('shows everything again when the search is cleared', async () => {
    await renderList([
      membershipType({ id: 'a', name: 'Junior Member' }),
      membershipType({ id: 'b', name: 'Senior Member' }),
    ]);

    search('junior');
    await waitFor(() => expect(listedNames()).toHaveLength(1));
    search('');

    await waitFor(() => expect(listedNames()).toHaveLength(2));
  });
});

describe('MembershipTypesListPage — creating a type', () => {
  it('asks which kind rather than guessing', async () => {
    await renderList([membershipType()]);

    openCreateMenu();

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the single-membership form', async () => {
    await renderList([membershipType()]);

    openCreateMenu();
    fireEvent.click(within(screen.getByRole('menu')).getAllByRole('menuitem')[0]);

    expect(navigate).toHaveBeenCalledWith('/members/types/new/single');
  });

  it('opens the group-membership form, which the single one cannot stand in for', async () => {
    await renderList([membershipType()]);

    openCreateMenu();
    fireEvent.click(within(screen.getByRole('menu')).getAllByRole('menuitem')[1]);

    expect(navigate).toHaveBeenCalledWith('/members/types/new/group');
  });

  it('closes the menu once a choice is made', async () => {
    await renderList([membershipType()]);

    openCreateMenu();
    fireEvent.click(within(screen.getByRole('menu')).getAllByRole('menuitem')[0]);

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });
});

describe('MembershipTypesListPage — opening a type', () => {
  it('opens the type that was clicked', async () => {
    await renderList([
      membershipType({ id: 'mt-7', name: 'Junior Member' }),
      membershipType({ id: 'mt-8', name: 'Senior Member' }),
    ]);

    fireEvent.click(within(rowFor('Senior Member')).getAllByRole('button')[0]);

    expect(navigate).toHaveBeenCalledWith('/members/types/mt-8');
  });

  it('edits the type that was clicked', async () => {
    await renderList([
      membershipType({ id: 'mt-7', name: 'Junior Member' }),
      membershipType({ id: 'mt-8', name: 'Senior Member' }),
    ]);

    fireEvent.click(within(rowFor('Senior Member')).getAllByRole('button')[1]);

    expect(navigate).toHaveBeenCalledWith('/members/types/mt-8/edit');
  });
});
