import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import CalendarsListPage from '../CalendarsListPage';

/**
 * The screen a club lands on to run its bookable facilities.
 *
 * What is worth testing here is not that a table appears — it is the three
 * things the page decides on the club's behalf: what the filters actually
 * filter, where each action navigates, and what happens to the list when the
 * request behind it fails. Each of those is invisible until it is wrong, and
 * the last one decides whether a failure looks like "no calendars" or like a
 * problem.
 */

const { execute, navigate } = vi.hoisted(() => ({
  execute: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({ organisation: { id: 'org-1', name: 'Meath' }, setOrganisation: vi.fn() }),
}));

vi.mock('@aws-web-framework/orgadmin-shell', async () => {
  const { createShellMock } = await import('@aws-web-framework/orgadmin-core/test/shellMock');
  return createShellMock();
});

const CALENDARS = [
  {
    id: 'cal-1',
    name: 'Main Arena',
    description: 'Sand surface, floodlit',
    status: 'open',
  },
  {
    id: 'cal-2',
    name: 'Cross-Country Course',
    description: 'Closed over winter',
    status: 'closed',
  },
  {
    id: 'cal-3',
    name: 'Lunge Pen',
    description: 'Small circular arena',
    status: 'open',
  },
];

const renderPage = () => render(<CalendarsListPage />);

/**
 * Names currently rendered in the table body, in order.
 *
 * The name is the *second* cell — the first carries the calendar's colour
 * swatch — and the loading and empty states are a single cell spanning the
 * table, which is skipped rather than read as a calendar called "No calendars
 * match your filters".
 */
const listedNames = () =>
  Array.from(document.querySelectorAll('tbody tr'))
    .filter((row) => row.children.length > 1)
    .map((row) => row.children[1]?.textContent?.trim())
    .filter(Boolean);

beforeEach(() => {
  execute.mockReset();
  navigate.mockReset();
  execute.mockResolvedValue(CALENDARS);
});

describe('CalendarsListPage — loading the club’s calendars', () => {
  it('asks for the calendars of the organisation being worked in', async () => {
    renderPage();

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/orgadmin/organisations/org-1/calendars',
      })
    );
  });

  it('lists every calendar the club has', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('Main Arena')).toBeInTheDocument());
    expect(screen.getByText('Cross-Country Course')).toBeInTheDocument();
    expect(screen.getByText('Lunge Pen')).toBeInTheDocument();
  });

  it('shows an empty list rather than stale rows when the request fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    execute.mockRejectedValue(new Error('network'));

    renderPage();

    // A failed load must not leave the previous club's calendars on screen, and
    // must not hang on the loading row forever.
    await waitFor(() => expect(listedNames()).toHaveLength(0));
    expect(screen.queryByText('Main Arena')).not.toBeInTheDocument();
  });

  it('copes with the API answering with nothing at all', async () => {
    execute.mockResolvedValue(null);

    renderPage();

    await waitFor(() => expect(execute).toHaveBeenCalled());
    expect(listedNames()).toHaveLength(0);
  });
});

describe('CalendarsListPage — finding one calendar among many', () => {
  it('searches the name', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Main Arena')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'lunge' } });

    await waitFor(() => expect(listedNames()).toEqual(['Lunge Pen']));
  });

  it('searches the description too, because that is where a club writes what a facility is', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Main Arena')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'floodlit' } });

    await waitFor(() => expect(listedNames()).toEqual(['Main Arena']));
  });

  it('ignores case, so a hurried search still finds the calendar', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Main Arena')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'MAIN ARENA' } });

    await waitFor(() => expect(listedNames()).toEqual(['Main Arena']));
  });

  it('shows nothing rather than everything when a search matches no calendar', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Main Arena')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'swimming pool' } });

    await waitFor(() => expect(listedNames()).toHaveLength(0));
  });

  it('narrows to the calendars that are open', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Main Arena')).toBeInTheDocument());

    // MUI's Select opens on mouseDown, not click (CLAUDE.md §3.4).
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(within(screen.getByRole('listbox')).getByText('Open'));

    await waitFor(() => expect(listedNames()).toEqual(['Main Arena', 'Lunge Pen']));
  });

  it('narrows to the calendars that are closed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Main Arena')).toBeInTheDocument());

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(within(screen.getByRole('listbox')).getByText('Closed'));

    await waitFor(() => expect(listedNames()).toEqual(['Cross-Country Course']));
  });

  it('combines the search and the status filter rather than choosing between them', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Main Arena')).toBeInTheDocument());

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(within(screen.getByRole('listbox')).getByText('Open'));
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'arena' } });

    // "Lunge Pen" is open and its description says "arena", so both survive.
    await waitFor(() => expect(listedNames()).toEqual(['Main Arena', 'Lunge Pen']));
  });
});

describe('CalendarsListPage — where the actions go', () => {
  it('opens the new-calendar form', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Main Arena')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /create calendar/i }));

    expect(navigate).toHaveBeenCalledWith('/calendar/new');
  });

  it('opens the calendar being viewed, by its own id', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Main Arena')).toBeInTheDocument());

    const secondRow = document.querySelectorAll('tbody tr')[1];
    fireEvent.click(within(secondRow as HTMLElement).getAllByRole('button')[0]);

    expect(navigate).toHaveBeenCalledWith('/calendar/cal-2');
  });

  it('opens the edit form for the calendar on that row', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Main Arena')).toBeInTheDocument());

    const firstRow = document.querySelectorAll('tbody tr')[0];
    fireEvent.click(within(firstRow as HTMLElement).getAllByRole('button')[1]);

    expect(navigate).toHaveBeenCalledWith('/calendar/cal-1/edit');
  });
});

describe('CalendarsListPage — opening and closing a facility', () => {
  it('closes a calendar that is open, and says so without waiting for a reload', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Main Arena')).toBeInTheDocument());

    const firstRow = document.querySelectorAll('tbody tr')[0] as HTMLElement;
    const buttons = within(firstRow).getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({
        method: 'PATCH',
        url: '/api/orgadmin/calendars/cal-1/status',
      })
    );

    // The row updates in place; a club that has just closed a facility should
    // not have to wonder whether it took.
    await waitFor(() => {
      const row = document.querySelectorAll('tbody tr')[0] as HTMLElement;
      expect(within(row).getByText(/closed/i)).toBeInTheDocument();
    });
  });

  it('leaves the row as it was when the change fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderPage();
    await waitFor(() => expect(screen.getByText('Main Arena')).toBeInTheDocument());

    execute.mockRejectedValue(new Error('network'));

    const firstRow = document.querySelectorAll('tbody tr')[0] as HTMLElement;
    const buttons = within(firstRow).getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);

    // Claiming a facility is closed when the server never agreed would send
    // members to a locked gate.
    await waitFor(() => {
      const row = document.querySelectorAll('tbody tr')[0] as HTMLElement;
      expect(within(row).getByText(/open/i)).toBeInTheDocument();
    });
  });
});
