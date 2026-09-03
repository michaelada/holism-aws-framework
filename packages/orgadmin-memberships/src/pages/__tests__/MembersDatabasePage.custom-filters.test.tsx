import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import MembersDatabasePage from '../MembersDatabasePage';
import * as useApiModule from '@itsplainsailing/orgadmin-core';
import { createTestI18n } from '../../test/i18n-test-utils';

/**
 * Saved filters over the members database.
 *
 * Three separate stubs used to make this look finished: a dialog that handed
 * its payload to a callback which dropped it, no create endpoint at all, and a
 * list endpoint returning a hard-coded `[]`. The filter a club created went
 * nowhere and the dropdown was empty every time.
 *
 * So the first test here is the plain one that would have caught it: pressing
 * Save must send the filter somewhere.
 */

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: vi.fn(),
}));

vi.mock('@itsplainsailing/orgadmin-core', async () => ({
  ...(await vi.importActual('@itsplainsailing/orgadmin-core')),
  useApi: vi.fn(),
  useOrganisation: vi.fn(),
}));

vi.mock('@itsplainsailing/orgadmin-shell', async () => {
  // Shared, so a new shell hook cannot break this suite — see test/shell-mock.ts
  const { shellMock } = await import('../../test/shell-mock');
  return shellMock();
});

const member = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  organisationId: 'org-1',
  membershipTypeId: 'mt-1',
  userId: 'u1',
  membershipNumber: 'KHP-0001',
  firstName: 'Saoirse',
  lastName: 'Ní Bhriain',
  formSubmissionId: 'fs1',
  dateLastRenewed: '2026-03-01',
  status: 'active',
  validUntil: '2027-03-01',
  labels: [],
  processed: true,
  paymentStatus: 'paid',
  createdAt: '2026-03-01',
  updatedAt: '2026-03-01',
  ...over,
});

const filter = (over: Record<string, unknown> = {}) => ({
  id: 'f1',
  organisationId: 'org-1',
  userId: 'u1',
  name: 'Lapsed members',
  memberStatus: [],
  dateLastRenewedBefore: null,
  dateLastRenewedAfter: null,
  validUntilBefore: null,
  validUntilAfter: null,
  memberLabels: [],
  createdAt: '2026-08-01',
  updatedAt: '2026-08-01',
  ...over,
});

const testI18n = createTestI18n('en-GB');

/*
 * The shared test bundle is minimal — `filters` carries only `status` — so half
 * the strings on this page resolve and half come back as their keys. The ones
 * these tests press are added here so every assertion reads as the words a user
 * sees, rather than as whichever happened to be in the fixture.
 */
testI18n.addResourceBundle(
  'en-GB',
  'translation',
  {
    common: { actions: { cancel: 'Cancel', delete: 'Delete' } },
    memberships: {
      filters: {
        customFilter: 'Custom Filter',
        createFilter: 'Create Filter',
        none: 'None',
      },
      customFilter: {
        title: 'Create Custom Filter',
        filterName: 'Filter Name',
        saveFilter: 'Save Filter',
        saveFailed: 'The filter could not be saved. Please try again.',
        deleteFilter: 'Delete filter',
        deleteConfirmTitle: 'Delete this filter?',
        deleteConfirmBody:
          '“{{name}}” will be removed for every administrator of this organisation. The members themselves are not affected.',
        deleteFailed: 'The filter could not be deleted. Please try again.',
      },
    },
  },
  true,
  true
);

/** Renders the page with the given members and saved filters. */
const setup = ({
  members = [] as any[],
  filters = [] as any[],
  onPost = undefined as undefined | ((body: any) => any),
  deleteFails = false,
} = {}) => {
  let current = [...filters];

  const execute = vi.fn().mockImplementation(({ url, method, data, onError }) => {
    if (url.includes('/member-filters') && method === 'POST') {
      const saved = onPost ? onPost(data) : { ...filter(), ...data, id: 'new-filter' };
      if (saved) current = [...current, saved];
      return Promise.resolve(saved);
    }
    if (url.includes('/member-filters') && method === 'DELETE') {
      if (deleteFails) {
        // What `useApi` does on a refusal: resolve null, having called onError.
        onError?.('Failed');
        return Promise.resolve(null);
      }
      const id = String(url).split('/').pop();
      current = current.filter((f) => f.id !== id);
      // A 204 resolves to null too — which is the whole difficulty.
      return Promise.resolve(null);
    }
    if (url.includes('/member-filters')) return Promise.resolve(current);
    if (url.includes('/membership-types')) return Promise.resolve([{ id: 'mt-1', name: 'Junior' }]);
    if (url.includes('/members')) return Promise.resolve(members);
    return Promise.resolve([]);
  });

  vi.mocked(useApiModule.useApi).mockReturnValue({
    execute,
    data: null,
    error: null,
    loading: false,
    reset: vi.fn(),
  } as never);

  vi.mocked(useApiModule.useOrganisation).mockReturnValue({
    organisation: { id: 'org-1', name: 'Kildare Hunt Pony Club' } as never,
    setOrganisation: vi.fn(),
    loading: false,
  } as never);

  const view = render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <MembersDatabasePage />
      </MemoryRouter>
    </I18nextProvider>
  );

  return { ...view, execute };
};

const postCalls = (execute: ReturnType<typeof vi.fn>) =>
  execute.mock.calls.map((c) => c[0]).filter((c: any) => c.method === 'POST');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useNavigate).mockReturnValue(vi.fn());
});

describe('saving a filter', () => {
  it('sends the filter to the server', async () => {
    /*
     * The test that was missing. `onSave` closed the dialog and reloaded the
     * list without ever posting, so a filter could be "created" indefinitely
     * and the dropdown stayed empty.
     */
    const { execute } = setup();
    await waitFor(() => expect(execute).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Create Filter' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Filter Name/i), {
      target: { value: 'Lapsed members' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Filter' }));

    await waitFor(() => {
      const posts = postCalls(execute);
      expect(posts).toHaveLength(1);
      expect(posts[0].url).toContain('/api/orgadmin/member-filters');
      expect(posts[0].data).toMatchObject({ name: 'Lapsed members' });
    });
  });

  it('reloads the list afterwards, so the new filter appears', async () => {
    const { execute } = setup();
    await waitFor(() => expect(execute).toHaveBeenCalled());

    const listCallsBefore = execute.mock.calls.filter((c) =>
      String(c[0].url).includes('/member-filters') && c[0].method !== 'POST'
    ).length;

    fireEvent.click(screen.getByRole('button', { name: 'Create Filter' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Filter Name/i), { target: { value: 'X' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Filter' }));

    await waitFor(() => {
      const after = execute.mock.calls.filter((c) =>
        String(c[0].url).includes('/member-filters') && c[0].method !== 'POST'
      ).length;
      expect(after).toBeGreaterThan(listCallsBefore);
    });
  });

  it('says so when the save is refused', async () => {
    /*
     * `useApi.execute` resolves to null on failure rather than throwing. Left
     * unchecked the dialog closes and the list reloads unchanged — which looks
     * exactly like the bug being fixed here.
     */
    const { execute } = setup({ onPost: () => null });
    await waitFor(() => expect(execute).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Create Filter' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Filter Name/i), { target: { value: 'X' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Filter' }));

    expect(await screen.findByText(/could not be saved/i)).toBeInTheDocument();
  });
});

describe('listing filters', () => {
  it('offers every saved filter in the dropdown', async () => {
    setup({ filters: [filter({ id: 'f1', name: 'Lapsed members' }), filter({ id: 'f2', name: 'Committee' })] });

    fireEvent.mouseDown(await screen.findByLabelText('Custom Filter'));
    const listbox = await screen.findByRole('listbox');

    expect(within(listbox).getByText('Lapsed members')).toBeInTheDocument();
    expect(within(listbox).getByText('Committee')).toBeInTheDocument();
  });
});

describe('applying a filter', () => {
  const show = async (savedFilter: any, members: any[]) => {
    setup({ members, filters: [savedFilter] });

    fireEvent.mouseDown(await screen.findByLabelText('Custom Filter'));
    const listbox = await screen.findByRole('listbox');
    fireEvent.click(within(listbox).getByText(savedFilter.name));

    // The status toggle defaults to "current", which hides elapsed members
    // whatever the saved filter says — switch it to All for these.
    fireEvent.click(screen.getByRole('button', { name: 'All' }));

  };

  it('narrows by status', async () => {
    await show(filter({ memberStatus: ['elapsed'] }), [
      member({ id: 'm1', name: 'Kavanagh', status: 'active' }),
      member({ id: 'm2', name: 'Donnelly', status: 'elapsed' }),
    ]);

    await waitFor(() => expect(screen.queryByText('Kavanagh')).not.toBeInTheDocument());
    expect(screen.getByText('Donnelly')).toBeInTheDocument();
  });

  it('matches any of the chosen labels, not all of them', async () => {
    // "Committee or Junior" is the useful question.
    await show(filter({ memberLabels: ['Committee', 'Junior'] }), [
      member({ id: 'm1', name: 'Kavanagh', labels: ['Committee'] }),
      member({ id: 'm2', name: 'Donnelly', labels: [] }),
    ]);

    await waitFor(() => expect(screen.getByText('Kavanagh')).toBeInTheDocument());
    expect(screen.queryByText('Donnelly')).not.toBeInTheDocument();
  });

  it('narrows by a date bound', async () => {
    await show(filter({ validUntilBefore: '2026-12-31' }), [
      member({ id: 'm1', name: 'Kavanagh', validUntil: '2026-06-30' }),
      member({ id: 'm2', name: 'Donnelly', validUntil: '2027-06-30' }),
    ]);

    await waitFor(() => expect(screen.getByText('Kavanagh')).toBeInTheDocument());
    expect(screen.queryByText('Donnelly')).not.toBeInTheDocument();
  });

  it('treats an empty clause as no narrowing at all', async () => {
    // A filter that names no status matches every status, which is what
    // somebody means by leaving the field alone.
    await show(filter({ memberStatus: [], memberLabels: [] }), [
      member({ id: 'm1', name: 'Kavanagh', status: 'active' }),
      member({ id: 'm2', name: 'Donnelly', status: 'elapsed' }),
    ]);

    await waitFor(() => expect(screen.getByText('Kavanagh')).toBeInTheDocument());
    expect(screen.getByText('Donnelly')).toBeInTheDocument();
  });

  it('shows everybody again when the filter is cleared', async () => {
    await show(filter({ memberStatus: ['elapsed'] }), [
      member({ id: 'm1', name: 'Kavanagh', status: 'active' }),
      member({ id: 'm2', name: 'Donnelly', status: 'elapsed' }),
    ]);

    await waitFor(() => expect(screen.queryByText('Kavanagh')).not.toBeInTheDocument());

    fireEvent.mouseDown(screen.getByLabelText('Custom Filter'));
    const listbox = await screen.findByRole('listbox');
    fireEvent.click(within(listbox).getByText('None'));

    await waitFor(() => expect(screen.getByText('Kavanagh')).toBeInTheDocument());
  });
});

describe('deleting a filter', () => {
  const choose = async (name: string) => {
    fireEvent.mouseDown(await screen.findByLabelText('Custom Filter'));
    const listbox = await screen.findByRole('listbox');
    fireEvent.click(within(listbox).getByText(name));
  };

  it('offers no delete button until a filter is chosen', async () => {
    setup({ filters: [filter({ name: 'Lapsed members' })] });
    await screen.findByRole('button', { name: 'Create Filter' });

    // Nothing is selected, so there is nothing to remove.
    expect(screen.queryByRole('button', { name: 'Delete filter' })).not.toBeInTheDocument();

    await choose('Lapsed members');
    expect(await screen.findByRole('button', { name: 'Delete filter' })).toBeInTheDocument();
  });

  it('asks first, naming the filter, and does nothing until confirmed', async () => {
    const { execute } = setup({ filters: [filter({ name: 'Lapsed members' })] });
    await choose('Lapsed members');

    fireEvent.click(await screen.findByRole('button', { name: 'Delete filter' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Lapsed members/)).toBeInTheDocument();
    // And says it is shared, because it is.
    expect(within(dialog).getByText(/every administrator/i)).toBeInTheDocument();

    expect(execute.mock.calls.some((c) => c[0].method === 'DELETE')).toBe(false);
  });

  it('deletes the chosen filter when confirmed', async () => {
    const { execute } = setup({ filters: [filter({ id: 'f9', name: 'Lapsed members' })] });
    await choose('Lapsed members');

    fireEvent.click(await screen.findByRole('button', { name: 'Delete filter' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      const del = execute.mock.calls.map((c) => c[0]).find((c: any) => c.method === 'DELETE');
      expect(del?.url).toContain('/api/orgadmin/member-filters/f9');
    });
  });

  it('clears the selection, so the roster is not narrowed by a filter that is gone', async () => {
    setup({
      members: [member({ id: 'm1', name: 'Kavanagh', status: 'active' })],
      filters: [filter({ id: 'f9', name: 'Lapsed members', memberStatus: ['elapsed'] })],
    });
    await choose('Lapsed members');

    // The filter is on: the active member is hidden.
    await waitFor(() => expect(screen.queryByText('Kavanagh')).not.toBeInTheDocument());

    fireEvent.click(await screen.findByRole('button', { name: 'Delete filter' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));

    // Gone from the menu, and the roster is whole again.
    await waitFor(() => expect(screen.getByText('Kavanagh')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Delete filter' })).not.toBeInTheDocument();
  });

  it('keeps the filter and says so when the delete is refused', async () => {
    /*
     * A 204 and a failure both resolve to null, so without `onError` a refused
     * delete would remove the filter from the screen and leave it on the
     * server — the screen and the database quietly disagreeing.
     */
    setup({ filters: [filter({ name: 'Lapsed members' })], deleteFails: true });
    await choose('Lapsed members');

    fireEvent.click(await screen.findByRole('button', { name: 'Delete filter' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/could not be deleted/i)).toBeInTheDocument();

    // The dialog animates closed, and while it is there MUI marks the rest of
    // the page `aria-hidden` — so the button behind it is not in the tree yet.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Delete filter' })).toBeInTheDocument();
  });

  it('leaves everything alone on cancel', async () => {
    const { execute } = setup({ filters: [filter({ name: 'Lapsed members' })] });
    await choose('Lapsed members');

    fireEvent.click(await screen.findByRole('button', { name: 'Delete filter' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(execute.mock.calls.some((c) => c[0].method === 'DELETE')).toBe(false);
    expect(screen.getByRole('button', { name: 'Delete filter' })).toBeInTheDocument();
  });
});
