import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import AnnouncementsListPage, { stateColour } from '../AnnouncementsListPage';

/**
 * Every notice a club has written, and whether it is showing.
 *
 * The list has one job the club cannot get anywhere else: telling a notice that
 * is up now from one that is not yet and one that is over. There is no draft
 * flag — the window is the only control — so the badge is derived, and getting
 * it wrong means a club believing they have told their members something they
 * have not.
 */

const { execute, navigate } = vi.hoisted(() => ({ execute: vi.fn(), navigate: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

/*
 * Only `useApi` is replaced. The rest of the module is the real thing —
 * `useTableSort` and `SortableTableCell` among it — so the sorting the table
 * offers is exercised here rather than stubbed away.
 */
vi.mock('@itsplainsailing/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
}));

vi.mock('@itsplainsailing/orgadmin-shell', async () => {
  const { createShellMock } = await import('@itsplainsailing/orgadmin-core/test/shellMock');
  return createShellMock();
});

const NOW = new Date('2026-09-03T12:00:00.000Z');

const announcement = (over: Record<string, unknown> = {}) => ({
  id: 'ann-1',
  organisationId: 'org-1',
  title: 'Clubhouse closed Saturday',
  description: '<p>The floor is being replaced.</p>',
  startsAt: '2026-09-01T09:00:00.000Z',
  endsAt: '2026-09-06T18:00:00.000Z',
  imageUrl: null,
  imagePlacement: null,
  showing: true,
  createdAt: '2026-08-30T10:00:00.000Z',
  updatedAt: '2026-08-30T10:00:00.000Z',
  ...over,
});

const answer = (...announcements: unknown[]) =>
  execute.mockResolvedValue({ announcements });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  answer(announcement());
});

describe('AnnouncementsListPage', () => {
  it('lists what the club has written', async () => {
    render(<AnnouncementsListPage />);

    expect(await screen.findByText('Clubhouse closed Saturday')).toBeInTheDocument();
    expect(execute).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/orgadmin/announcements',
    });
  });

  it('tells the three states apart from the window alone', async () => {
    answer(
      announcement(),
      announcement({
        id: 'ann-2',
        title: 'AGM: 14 October',
        startsAt: '2026-10-01T00:00:00.000Z',
        endsAt: '2026-10-15T00:00:00.000Z',
      }),
      announcement({
        id: 'ann-3',
        title: 'Winter league results',
        startsAt: '2026-02-02T00:00:00.000Z',
        endsAt: '2026-03-01T00:00:00.000Z',
      })
    );
    render(<AnnouncementsListPage />);

    expect(await screen.findByText('Showing now')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Finished')).toBeInTheDocument();
  });

  it('says until when, under the badge', async () => {
    // "Showing now" immediately begs the question, and a club scheduling around
    // a weekend needs the times, not only the dates.
    render(<AnnouncementsListPage />);

    expect(await screen.findByText(/01\/09\/2026.*–.*06\/09\/2026/)).toBeInTheDocument();
  });

  it('says what an image is used for, or that there is none', async () => {
    answer(
      announcement({ imageUrl: 'https://signed', imagePlacement: 'background' }),
      announcement({ id: 'ann-2', title: 'AGM' })
    );
    render(<AnnouncementsListPage />);

    expect(await screen.findByText('Background')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('says what an empty list means, rather than showing an empty table', async () => {
    /*
     * A club that has never written one cannot otherwise tell whether members
     * are seeing nothing or the screen failed.
     */
    answer();
    render(<AnnouncementsListPage />);

    expect(
      await screen.findByText(
        'No announcements yet. Members see nothing on their home page until you write one.'
      )
    ).toBeInTheDocument();
  });

  it('reports a failure rather than an empty club', async () => {
    execute.mockResolvedValue(null);
    render(<AnnouncementsListPage />);

    expect(await screen.findByText('We could not load the announcements.')).toBeInTheDocument();
  });

  it('opens the editor for a new one', async () => {
    render(<AnnouncementsListPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'New announcement' }));
    expect(navigate).toHaveBeenCalledWith('/announcements/new');
  });

  it('opens the editor for an existing one', async () => {
    render(<AnnouncementsListPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(navigate).toHaveBeenCalledWith('/announcements/ann-1/edit');
  });

  it('asks before removing a notice, naming it', async () => {
    // Deleting is real here — nothing was paid and nothing granted — so the
    // confirmation is the only thing between a click and a lost notice.
    render(<AnnouncementsListPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Clubhouse closed Saturday');
    expect(execute).toHaveBeenCalledTimes(1); // the load, and nothing else yet
  });

  it('removes it once confirmed, and re-reads the list', async () => {
    render(<AnnouncementsListPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({
        method: 'DELETE',
        url: '/api/orgadmin/announcements/ann-1',
      })
    );
    await waitFor(() =>
      expect(
        execute.mock.calls.filter(([call]) => call.method === 'GET').length
      ).toBe(2)
    );
  });
});

describe('stateColour', () => {
  it('marks what is up now, and leaves the rest quiet', () => {
    expect(stateColour('showing')).toBe('success');
    expect(stateColour('scheduled')).toBe('info');
    expect(stateColour('finished')).toBe('default');
  });
});
