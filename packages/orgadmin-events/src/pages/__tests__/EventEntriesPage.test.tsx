import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import EventEntriesPage, { groupByActivity, matchesSearch } from '../EventEntriesPage';

/**
 * Who has entered, in classes.
 *
 * The page this replaced showed First name / Last name / Status / Submitted in
 * hard-coded English, reading `entry.status` and `entry.createdAt` — fields the
 * endpoint has never returned, so two of its four columns were empty on every
 * row. It also flattened six classes into one table, which is not how a club
 * reads an entry list.
 */

const { execute, navigate } = vi.hoisted(() => ({ execute: vi.fn(), navigate: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useParams: () => ({ id: 'event-1' }),
}));

vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({
    organisation: { id: 'org-1', name: 'Kildare' },
    setOrganisation: vi.fn(),
  }),
}));

const entry = (over: Record<string, unknown> = {}) => ({
  id: 'entry-1',
  eventId: 'event-1',
  eventActivityId: 'act-80',
  firstName: 'Áine',
  lastName: 'McGrath',
  email: 'aine@example.test',
  paymentStatus: 'paid',
  entryDate: '2026-08-01T10:00:00.000Z',
  activityName: '80cm',
  ...over,
});

/** The page loads the event and its entries together. */
const respond = (entries: unknown[]) =>
  execute.mockImplementation(({ url }: { url: string }) =>
    Promise.resolve(url.endsWith('/entries') ? entries : { id: 'event-1', name: 'Spring League' })
  );

const renderPage = () =>
  render(
    <BrowserRouter>
      <EventEntriesPage />
    </BrowserRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  respond([]);
});

describe('EventEntriesPage', () => {
  it('names the event it is showing entries for', async () => {
    renderPage();

    expect(await screen.findByText('Entries')).toBeInTheDocument();
    expect(screen.getByText('Spring League')).toBeInTheDocument();
  });

  it('groups the entries by class', async () => {
    respond([
      entry(),
      entry({ id: 'e2', firstName: 'Rónán', eventActivityId: 'act-100', activityName: '1.00m' }),
      entry({ id: 'e3', firstName: 'Bríd' }),
    ]);
    renderPage();

    // The heading for each class, with its own count beside it — the number an
    // organiser checks against a limit.
    expect(await screen.findByText('1.00m')).toBeInTheDocument();
    expect(screen.getByText('80cm')).toBeInTheDocument();
    expect(screen.getByText('2 entries')).toBeInTheDocument();
    expect(screen.getByText('1 entry')).toBeInTheDocument();
  });

  it('shows who entered, how to reach them and when they entered', async () => {
    respond([entry()]);
    renderPage();

    expect(await screen.findByText('Áine McGrath')).toBeInTheDocument();
    expect(screen.getByText('aine@example.test')).toBeInTheDocument();
    // The suite's `formatDateTime` returns the raw value, so this is the date
    // the endpoint sent rather than a rendering of it.
    expect(screen.getByText('2026-08-01T10:00:00.000Z')).toBeInTheDocument();
  });

  it('opens the entry that was clicked', async () => {
    respond([entry({ id: 'entry-9' })]);
    renderPage();

    fireEvent.click(await screen.findByText('Áine McGrath'));
    expect(navigate).toHaveBeenCalledWith('/events/event-1/entries/entry-9');
  });

  it('filters across every class at once', async () => {
    respond([
      entry(),
      entry({ id: 'e2', firstName: 'Rónán', eventActivityId: 'act-100', activityName: '1.00m' }),
    ]);
    renderPage();

    await screen.findByText('Áine McGrath');
    fireEvent.change(screen.getByPlaceholderText('Search by name, email or class…'), {
      target: { value: 'Rónán' },
    });

    expect(screen.getByText('Rónán McGrath')).toBeInTheDocument();
    expect(screen.queryByText('Áine McGrath')).not.toBeInTheDocument();
    // The class that no longer has entries goes with them.
    expect(screen.queryByText('80cm')).not.toBeInTheDocument();
  });

  it('says how many of the entries are being shown', async () => {
    respond([entry(), entry({ id: 'e2', firstName: 'Rónán' })]);
    renderPage();

    expect(await screen.findByText('Showing 2 of 2 entries')).toBeInTheDocument();
  });

  it('tells an empty event from a filtered one', async () => {
    respond([entry()]);
    renderPage();

    await screen.findByText('Áine McGrath');
    fireEvent.change(screen.getByPlaceholderText('Search by name, email or class…'), {
      target: { value: 'nobody' },
    });

    expect(screen.getByText('No entries match your search.')).toBeInTheDocument();
  });

  it('says nobody has entered when nobody has', async () => {
    renderPage();

    expect(await screen.findByText('Nobody has entered yet.')).toBeInTheDocument();
  });

  it('reports a failure rather than looking like an empty event', async () => {
    execute.mockRejectedValue(new Error('network'));
    renderPage();

    expect(await screen.findByText('We could not load the entries.')).toBeInTheDocument();
  });

  /**
   * A failed export must not be saved as a file.
   *
   * `execute` answers `null` on an error, and `new Blob([null])` is the
   * four-byte text "null" — which the browser saves as `..._entries.xlsx` and
   * the operating system then refuses to open. The download looked like it had
   * worked; the file *was* the error.
   */
  it('says so when the export fails, rather than downloading the error', async () => {
    const created = vi.spyOn(URL, 'createObjectURL');
    respond([entry()]);
    renderPage();
    await screen.findByText('Áine McGrath');

    execute.mockResolvedValueOnce(null);
    fireEvent.click(screen.getByRole('button', { name: /Export to Excel/i }));

    expect(
      await screen.findByText('We could not produce the export. Nothing has been downloaded.')
    ).toBeInTheDocument();
    expect(created).not.toHaveBeenCalled();
    created.mockRestore();
  });

  it('downloads the workbook the server sent', async () => {
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    const revoked = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    respond([entry()]);
    renderPage();
    await screen.findByText('Áine McGrath');

    const workbook = new Blob(['PK\u0003\u0004'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    execute.mockResolvedValueOnce(workbook);
    fireEvent.click(screen.getByRole('button', { name: /Export to Excel/i }));

    await waitFor(() => expect(created).toHaveBeenCalledWith(workbook));
    expect(revoked).toHaveBeenCalled();
    created.mockRestore();
    revoked.mockRestore();
  });

  it('offers the export only when there is something to export', async () => {
    renderPage();

    expect(await screen.findByRole('button', { name: /Export to Excel/i })).toBeDisabled();
  });
});

/**
 * The grouping itself.
 */
describe('groupByActivity', () => {
  it('keeps two classes apart even where they share a name', () => {
    // A two-day event runs "80cm" on both days; merging them produces a class
    // list no class ever had.
    const groups = groupByActivity(
      [
        entry({ eventActivityId: 'sat', activityName: '80cm' }),
        entry({ id: 'e2', eventActivityId: 'sun', activityName: '80cm' }),
      ] as never,
      'Unassigned'
    );

    expect(groups).toHaveLength(2);
  });

  it('orders the classes the same way twice', () => {
    const groups = groupByActivity(
      [
        entry({ eventActivityId: 'c', activityName: 'Open' }),
        entry({ id: 'e2', eventActivityId: 'a', activityName: '1.00m' }),
        entry({ id: 'e3', eventActivityId: 'b', activityName: '80cm' }),
      ] as never,
      'Unassigned'
    );

    expect(groups.map((group) => group.activityName)).toEqual(['1.00m', '80cm', 'Open']);
  });

  it('gives an entry with no class name somewhere to go', () => {
    // Rather than a group headed by "undefined".
    const groups = groupByActivity([entry({ activityName: undefined })] as never, 'Unassigned');

    expect(groups[0].activityName).toBe('Unassigned');
  });
});

describe('matchesSearch', () => {
  it('matches on name, email or class', () => {
    expect(matchesSearch(entry() as never, 'mcgrath')).toBe(true);
    expect(matchesSearch(entry() as never, 'AINE@EXAMPLE')).toBe(true);
    expect(matchesSearch(entry() as never, '80cm')).toBe(true);
    expect(matchesSearch(entry() as never, 'walsh')).toBe(false);
  });

  it('matches everything on an empty search', () => {
    expect(matchesSearch(entry() as never, '')).toBe(true);
  });
});
