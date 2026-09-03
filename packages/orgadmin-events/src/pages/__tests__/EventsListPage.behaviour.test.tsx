import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import EventsListPage from '../EventsListPage';

/**
 * Every event a club runs, and the five things that can be done to one.
 *
 * Two behaviours here carry real weight. **Cloning** is how a club sets up next
 * year's fixture from last year's, and it must land on the *new* event's edit
 * page — landing on the original means the club edits the event that already
 * ran. And **the discount chips** are loaded per event from a separate service:
 * one event whose discounts fail to load must not blank the column for the
 * others, because a club reads that column to check a discount is live.
 *
 * Page furniture is covered by EventsListPage.test.tsx.
 */

const { execute, navigate, getDiscountById } = vi.hoisted(() => ({
  execute: vi.fn(),
  navigate: vi.fn(),
  getDiscountById: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

vi.mock('@itsplainsailing/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({
    organisation: { id: 'org-1', name: 'Meath' },
    setOrganisation: vi.fn(),
  }),
}));

vi.mock('../../hooks/useDiscountService', () => ({
  useDiscountService: () => ({ getDiscountById }),
}));

const event = (over: Record<string, unknown> = {}) => ({
  id: 'ev-1',
  name: 'Winter Dressage',
  description: 'Three days of dressage',
  status: 'published',
  startDate: '2026-11-18',
  endDate: '2026-11-20',
  limitEntries: false,
  discountIds: [],
  ...over,
});

const renderList = async (events: unknown[]) => {
  execute.mockImplementation(({ method }: { method: string }) =>
    method === 'GET' ? Promise.resolve(events) : Promise.resolve({ id: 'ev-clone' })
  );
  render(
    <BrowserRouter>
      <EventsListPage />
    </BrowserRouter>
  );
  await waitFor(() => expect(execute).toHaveBeenCalled());
  await waitFor(() => expect(document.querySelectorAll('tbody tr').length).toBeGreaterThan(0));
};

const listedNames = () =>
  Array.from(document.querySelectorAll('tbody tr')).map(
    (row) => row.querySelector('td:first-child p')?.textContent ?? ''
  );

const rowFor = (name: string) =>
  Array.from(document.querySelectorAll('tbody tr')).find(
    (row) => row.querySelector('td:first-child p')?.textContent === name
  ) as HTMLElement;

/** Row actions, in the order they appear: entries, view, edit, clone, delete. */
const actions = (name: string) => within(rowFor(name)).getAllByRole('button');

const search = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: text } });

beforeEach(() => {
  vi.clearAllMocks();
  getDiscountById.mockResolvedValue({ id: 'd-1', name: 'Early Bird' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EventsListPage — loading', () => {
  it('asks for this organisation’s events', async () => {
    await renderList([event()]);

    expect(execute).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/orgadmin/organisations/org-1/events',
    });
  });

  it('shows an empty list rather than crashing when there is nothing to show', async () => {
    execute.mockResolvedValue(null);
    render(
      <BrowserRouter>
        <EventsListPage />
      </BrowserRouter>
    );

    await waitFor(() => expect(execute).toHaveBeenCalled());
    // One row, and it explains itself rather than sitting blank.
    await waitFor(() => expect(document.querySelectorAll('tbody tr')).toHaveLength(1));
    expect(document.querySelector('tbody tr td')?.textContent).toBeTruthy();
  });

  it('recovers from a failed load with an empty list, not a broken page', async () => {
    execute.mockRejectedValue(new Error('network down'));
    render(
      <BrowserRouter>
        <EventsListPage />
      </BrowserRouter>
    );

    await waitFor(() => expect(execute).toHaveBeenCalled());
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });
});

describe('EventsListPage — the discounts on each event', () => {
  it('names the discounts attached to an event', async () => {
    await renderList([event({ discountIds: ['d-1'] })]);

    await waitFor(() =>
      expect(within(rowFor('Winter Dressage')).getByText('Early Bird')).toBeInTheDocument()
    );
    expect(getDiscountById).toHaveBeenCalledWith('d-1', 'org-1');
  });

  it('asks for nothing when an event has no discounts', async () => {
    await renderList([event({ discountIds: [] })]);

    expect(getDiscountById).not.toHaveBeenCalled();
  });

  it('keeps the other events’ discounts when one event’s cannot be read', async () => {
    getDiscountById.mockImplementation((id: string) =>
      id === 'bad' ? Promise.reject(new Error('gone')) : Promise.resolve({ id, name: 'Early Bird' })
    );

    await renderList([
      event({ id: 'ev-1', name: 'Winter Dressage', discountIds: ['bad'] }),
      event({ id: 'ev-2', name: 'Summer Show', discountIds: ['d-2'] }),
    ]);

    // One failure blanking the whole column would read as "no discounts live".
    await waitFor(() =>
      expect(within(rowFor('Summer Show')).getByText('Early Bird')).toBeInTheDocument()
    );
    expect(within(rowFor('Winter Dressage')).queryByText('Early Bird')).not.toBeInTheDocument();
  });
});

describe('EventsListPage — finding an event', () => {
  it('matches on the event name', async () => {
    await renderList([
      event({ id: 'ev-1', name: 'Winter Dressage' }),
      event({ id: 'ev-2', name: 'Summer Show' }),
    ]);

    search('summer');

    await waitFor(() => expect(listedNames()).toEqual(['Summer Show']));
  });

  it('matches on the description too', async () => {
    await renderList([
      event({ id: 'ev-1', name: 'Winter Dressage', description: 'Three days of dressage' }),
      event({ id: 'ev-2', name: 'Summer Show', description: 'Showjumping' }),
    ]);

    search('showjumping');

    await waitFor(() => expect(listedNames()).toEqual(['Summer Show']));
  });

  it('narrows to one status and combines with the search', async () => {
    await renderList([
      event({ id: 'ev-1', name: 'Winter Dressage', status: 'draft' }),
      event({ id: 'ev-2', name: 'Winter Show', status: 'published' }),
      event({ id: 'ev-3', name: 'Summer Show', status: 'published' }),
    ]);

    fireEvent.mouseDown(screen.getByLabelText('Status'));
    fireEvent.click(screen.getByRole('listbox').querySelector('[data-value="published"]')!);
    search('winter');

    await waitFor(() => expect(listedNames()).toEqual(['Winter Show']));
  });
});

describe('EventsListPage — acting on an event', () => {
  it('opens a new event', async () => {
    await renderList([event()]);

    fireEvent.click(screen.getByText('Create Event'));

    expect(navigate).toHaveBeenCalledWith('/events/new');
  });

  it('opens the entries for the event that was clicked', async () => {
    await renderList([event({ id: 'ev-7', name: 'Winter Dressage' })]);

    fireEvent.click(actions('Winter Dressage')[0]);

    expect(navigate).toHaveBeenCalledWith('/events/ev-7/entries');
  });

  it('opens the event itself', async () => {
    await renderList([event({ id: 'ev-7', name: 'Winter Dressage' })]);

    fireEvent.click(actions('Winter Dressage')[1]);

    expect(navigate).toHaveBeenCalledWith('/events/ev-7');
  });

  it('edits the event', async () => {
    await renderList([event({ id: 'ev-7', name: 'Winter Dressage' })]);

    fireEvent.click(actions('Winter Dressage')[2]);

    expect(navigate).toHaveBeenCalledWith('/events/ev-7/edit');
  });

  it('opens the copy for editing, never the event it was copied from', async () => {
    await renderList([event({ id: 'ev-7', name: 'Winter Dressage' })]);

    fireEvent.click(actions('Winter Dressage')[3]);

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({
        method: 'POST',
        url: '/api/orgadmin/events/ev-7/clone',
      })
    );
    // Editing the original is how last year's event gets overwritten.
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/events/ev-clone/edit'));
  });

  it('stays put when the copy could not be made', async () => {
    await renderList([event({ id: 'ev-7', name: 'Winter Dressage' })]);

    execute.mockRejectedValue(new Error('clone failed'));
    fireEvent.click(actions('Winter Dressage')[3]);

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('EventsListPage — deleting an event', () => {
  it('asks before deleting', async () => {
    await renderList([event({ id: 'ev-7', name: 'Winter Dressage' })]);

    fireEvent.click(actions('Winter Dressage')[4]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('destroys nothing when the club backs out', async () => {
    await renderList([event({ id: 'ev-7', name: 'Winter Dressage' })]);

    fireEvent.click(actions('Winter Dressage')[4]);
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button')[0]);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('deletes the event that was chosen and re-reads the list', async () => {
    await renderList([
      event({ id: 'ev-7', name: 'Winter Dressage' }),
      event({ id: 'ev-8', name: 'Summer Show' }),
    ]);

    fireEvent.click(actions('Summer Show')[4]);
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button')[1]);

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({
        method: 'DELETE',
        url: '/api/orgadmin/events/ev-8',
      })
    );
    await waitFor(() =>
      expect(execute.mock.calls.filter(([r]) => r.method === 'GET').length).toBeGreaterThan(1)
    );
  });

  it('keeps the event when the delete was refused', async () => {
    await renderList([event({ id: 'ev-7', name: 'Winter Dressage' })]);

    execute.mockRejectedValue(new Error('entries exist'));
    fireEvent.click(actions('Winter Dressage')[4]);
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button')[1]);

    // Removing the row here would say the event is gone when it is not.
    await waitFor(() => expect(rowFor('Winter Dressage')).toBeTruthy());
  });
});

/**
 * How many people have entered.
 *
 * A club looking at its programme wants to know which events are filling and
 * which nobody has taken up, and was having to open each one to find out.
 */
describe('EventsListPage — entry counts', () => {
  const entriesCell = (row: Element) => row.querySelectorAll('td')[3]?.textContent ?? '';

  it('shows the count against each event', async () => {
    await renderList([
      event({ id: 'ev-1', name: 'Winter Dressage', entryCount: 12 }),
      event({ id: 'ev-2', name: 'Spring League', entryCount: 0 }),
    ]);

    const rows = Array.from(document.querySelectorAll('tbody tr'));
    expect(entriesCell(rows[0])).toBe('12');
    expect(entriesCell(rows[1])).toBe('0');
  });

  /*
   * Absent is not none. A column that renders "not counted" as 0 tells a club
   * nobody has entered an event that may well be full.
   */
  it('shows a dash, not a zero, when the count was not returned', async () => {
    await renderList([event({ id: 'ev-1', name: 'Winter Dressage' })]);

    const [row] = Array.from(document.querySelectorAll('tbody tr'));
    expect(entriesCell(row)).toBe('—');
  });

  it('keeps the entry limit in its own column beside it', async () => {
    await renderList([
      event({ id: 'ev-1', name: 'Winter Dressage', entryCount: 12, limitEntries: true, entriesLimit: 40 }),
    ]);

    const [row] = Array.from(document.querySelectorAll('tbody tr'));
    // Entered, then the cap — two different questions, two columns.
    expect(entriesCell(row)).toBe('12');
    expect(row.querySelectorAll('td')[4]?.textContent).toContain('40');
  });
});
