import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import FieldsListPage from '../FieldsListPage';

/**
 * The library of reusable fields every form in the product is built from.
 *
 * Deleting one is the consequential act: a field is referenced by forms, and
 * the answers already collected are keyed on its name — so the delete is
 * confirmed first, and a refusal has to be shown rather than swallowed, or the
 * operator believes a field is gone while forms still ask for it.
 *
 * Searching matters more here than on most lists, because a club with fifty
 * fields finds one by the label a member sees *or* by the name the data is
 * stored under, and those are different strings.
 */

const { execute, navigate } = vi.hoisted(() => ({ execute: vi.fn(), navigate: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

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

const field = (over: Record<string, unknown> = {}) => ({
  id: 'f-1',
  name: 'date_of_birth',
  label: 'Date of Birth',
  description: 'When the member was born',
  datatype: 'date',
  createdAt: '2026-01-15T10:00:00Z',
  ...over,
});

const renderPage = async (fields: unknown[] = [field()]) => {
  execute.mockResolvedValue(fields);
  renderWithProviders(<FieldsListPage />);
  await waitFor(() => expect(execute).toHaveBeenCalled());
};

const listedLabels = () =>
  Array.from(document.querySelectorAll('tbody tr'))
    .map((r) => r.querySelector('td')?.textContent ?? '')
    .filter(Boolean);

const rowFor = (label: string) =>
  Array.from(document.querySelectorAll('tbody tr')).find((r) =>
    r.textContent?.includes(label)
  ) as HTMLElement;

const search = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: text } });

const buttonIn = (host: HTMLElement, pattern: RegExp) =>
  within(host)
    .getAllByRole('button')
    .find(
      (b) =>
        pattern.test(b.textContent ?? '') ||
        pattern.test(b.getAttribute('title') ?? '') ||
        pattern.test(b.getAttribute('aria-label') ?? '')
    )!;

const writes = () => execute.mock.calls.map(([r]) => r).filter((r) => r.method !== 'GET');

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FieldsListPage — listing the fields', () => {
  it('reads the organisation’s fields', async () => {
    await renderPage();

    expect(execute).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/orgadmin/application-fields',
    });
  });

  it('shows each field', async () => {
    await renderPage([field({ id: 'a', label: 'Date of Birth' }), field({ id: 'b', label: 'Nickname' })]);

    await waitFor(() => expect(listedLabels()).toHaveLength(2));
  });

  it('shows an empty list rather than a broken page when the load fails', async () => {
    execute.mockRejectedValue(new Error('network down'));
    renderWithProviders(<FieldsListPage />);

    await waitFor(() => expect(execute).toHaveBeenCalled());
    expect(await screen.findByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('copes with a server that answers with nothing', async () => {
    await renderPage(null as never);

    await waitFor(() => expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument());
  });
});

describe('FieldsListPage — finding a field', () => {
  it('matches on the label a member sees', async () => {
    await renderPage([
      field({ id: 'a', label: 'Date of Birth', name: 'date_of_birth' }),
      field({ id: 'b', label: 'Nickname', name: 'nickname' }),
    ]);

    search('birth');

    await waitFor(() => expect(listedLabels()).toHaveLength(1));
  });

  it('matches on the stored name too, which is what appears in exports', async () => {
    await renderPage([
      field({ id: 'a', label: 'Date of Birth', name: 'date_of_birth' }),
      field({ id: 'b', label: 'Nickname', name: 'nickname' }),
    ]);

    search('nickname');

    await waitFor(() => expect(listedLabels()).toHaveLength(1));
  });

  it('narrows to one field type', async () => {
    await renderPage([
      field({ id: 'a', label: 'Date of Birth', datatype: 'date' }),
      field({ id: 'b', label: 'Nickname', datatype: 'text' }),
    ]);
    await waitFor(() => expect(listedLabels()).toHaveLength(2));

    fireEvent.mouseDown(screen.getByRole('combobox', { name: /fieldType|field type/i }));
    fireEvent.click(screen.getByRole('listbox').querySelector('[data-value="text"]')!);

    await waitFor(() => expect(listedLabels()).toEqual(['Nickname']));
  });

  it('shows everything again when the search is cleared', async () => {
    await renderPage([
      field({ id: 'a', label: 'Date of Birth', name: 'date_of_birth' }),
      field({ id: 'b', label: 'Nickname', name: 'nickname' }),
    ]);

    search('birth');
    await waitFor(() => expect(listedLabels()).toHaveLength(1));
    search('');

    await waitFor(() => expect(listedLabels()).toHaveLength(2));
  });
});

describe('FieldsListPage — deleting a field', () => {
  const openDelete = () => fireEvent.click(buttonIn(rowFor('Date of Birth'), /delete/i));

  it('asks before deleting anything', async () => {
    await renderPage();
    await waitFor(() => expect(listedLabels()).toHaveLength(1));

    openDelete();

    // Forms reference this field, and answers are keyed on its name.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it('deletes the field that was chosen', async () => {
    await renderPage([field({ id: 'f-7', label: 'Date of Birth' })]);
    await waitFor(() => expect(listedLabels()).toHaveLength(1));

    openDelete();
    fireEvent.click(buttonIn(screen.getByRole('dialog'), /delete/i));

    await waitFor(() =>
      expect(writes()[0]).toMatchObject({
        method: 'DELETE',
        url: '/api/orgadmin/application-fields/f-7',
      })
    );
  });

  it('re-reads the list so the deleted field leaves the screen', async () => {
    await renderPage();
    await waitFor(() => expect(listedLabels()).toHaveLength(1));

    openDelete();
    fireEvent.click(buttonIn(screen.getByRole('dialog'), /delete/i));

    await waitFor(() =>
      expect(execute.mock.calls.filter(([r]) => r.method === 'GET').length).toBeGreaterThan(1)
    );
  });

  it('says so when the delete was refused', async () => {
    await renderPage();
    await waitFor(() => expect(listedLabels()).toHaveLength(1));
    execute.mockRejectedValue(new Error('field is in use'));

    openDelete();
    fireEvent.click(buttonIn(screen.getByRole('dialog'), /delete/i));

    // Queried by text: the dialog stays open, and MUI hides the rest from
    // role queries while it does.
    expect(await screen.findByText(/failed to delete/i)).toBeInTheDocument();
  });

  it('deletes nothing when the operator backs out', async () => {
    await renderPage();
    await waitFor(() => expect(listedLabels()).toHaveLength(1));

    openDelete();
    fireEvent.click(buttonIn(screen.getByRole('dialog'), /cancel/i));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes()).toHaveLength(0);
  });
});

describe('FieldsListPage — going elsewhere', () => {
  it('starts a new field', async () => {
    await renderPage();
    await waitFor(() => expect(listedLabels()).toHaveLength(1));

    fireEvent.click(
      screen.getAllByRole('button').find((b) => /create|new|add/i.test(b.textContent ?? ''))!
    );

    expect(navigate).toHaveBeenCalledWith('/forms/fields/new');
  });

  it('edits the field that was clicked', async () => {
    await renderPage([field({ id: 'f-7', label: 'Date of Birth' })]);
    await waitFor(() => expect(listedLabels()).toHaveLength(1));

    fireEvent.click(buttonIn(rowFor('Date of Birth'), /edit/i));

    expect(navigate).toHaveBeenCalledWith('/forms/fields/f-7/edit');
  });
});
