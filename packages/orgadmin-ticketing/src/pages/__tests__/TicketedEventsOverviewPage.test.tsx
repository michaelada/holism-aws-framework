import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import TicketedEventsOverviewPage from '../TicketedEventsOverviewPage';

/**
 * How every ticketed event is doing on the gate.
 *
 * The numbers are the whole point of the screen — issued, scanned, not scanned
 * and the percentage between them — and they are what a club looks at while
 * deciding whether to keep the gate open. The other thing worth pinning is that
 * a row and the buttons inside it go to *different* places: the settings button
 * must not also trigger the row's own navigation.
 */

const { execute, navigate } = vi.hoisted(() => ({
  execute: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

vi.mock('@itsplainsailing/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({ organisation: { id: 'org-1', name: 'Meath' }, setOrganisation: vi.fn() }),
}));

vi.mock('@itsplainsailing/orgadmin-shell', async () => {
  const { createShellMock } = await import('@itsplainsailing/orgadmin-core/test/shellMock');
  return createShellMock();
});

const EVENTS = [
  {
    eventId: 'ev-1',
    eventName: 'Winter Dressage Series',
    eventDate: '2026-11-18',
    totalTickets: 120,
    ticketsScanned: 90,
    ticketsNotScanned: 30,
    scanPercentage: 75,
  },
  {
    eventId: 'ev-2',
    eventName: 'Summer Pony Camp',
    eventDate: '2026-09-29',
    totalTickets: 40,
    ticketsScanned: 13,
    ticketsNotScanned: 27,
    scanPercentage: 32.5,
  },
];

const dataRows = () =>
  Array.from(document.querySelectorAll('tbody tr')).filter((row) => row.children.length > 1);

beforeEach(() => {
  execute.mockReset();
  navigate.mockReset();
  execute.mockResolvedValue(EVENTS);
});

describe('TicketedEventsOverviewPage — loading', () => {
  it('asks for the ticketed events of the organisation being worked in', async () => {
    render(<TicketedEventsOverviewPage />);

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/orgadmin/organisations/org-1/ticketed-events',
      })
    );
  });

  it('shows a row for every ticketed event', async () => {
    render(<TicketedEventsOverviewPage />);

    await waitFor(() => expect(dataRows()).toHaveLength(2));
    expect(screen.getByText('Winter Dressage Series')).toBeInTheDocument();
    expect(screen.getByText('Summer Pony Camp')).toBeInTheDocument();
  });

  it('says what went wrong rather than showing an empty table', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    execute.mockRejectedValue(new Error('network'));

    render(<TicketedEventsOverviewPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('copes with the API answering with nothing at all', async () => {
    execute.mockResolvedValue(null);

    render(<TicketedEventsOverviewPage />);

    await waitFor(() => expect(execute).toHaveBeenCalled());
    expect(dataRows()).toHaveLength(0);
  });
});

describe('TicketedEventsOverviewPage — the numbers on the gate', () => {
  it('shows how many tickets were issued, scanned and not', async () => {
    render(<TicketedEventsOverviewPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    const row = within(dataRows()[0] as HTMLElement);
    expect(row.getByText('120')).toBeInTheDocument();
    expect(row.getByText('90')).toBeInTheDocument();
    expect(row.getByText('30')).toBeInTheDocument();
  });

  it('shows the scan rate to one decimal place, so 32.5% is not rounded to 33%', async () => {
    render(<TicketedEventsOverviewPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    expect(within(dataRows()[0] as HTMLElement).getByText('75.0%')).toBeInTheDocument();
    expect(within(dataRows()[1] as HTMLElement).getByText('32.5%')).toBeInTheDocument();
  });

  it('shows a whole-number rate with its decimal, rather than switching format', async () => {
    render(<TicketedEventsOverviewPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    // "75%" beside "32.5%" reads as two different measurements.
    expect(within(dataRows()[0] as HTMLElement).queryByText('75%')).not.toBeInTheDocument();
  });

  it('handles an event that has sold nothing yet without dividing by zero', async () => {
    execute.mockResolvedValue([
      {
        eventId: 'ev-3',
        eventName: 'Autumn Hunter Trials',
        eventDate: '2026-10-05',
        totalTickets: 0,
        ticketsScanned: 0,
        ticketsNotScanned: 0,
        scanPercentage: 0,
      },
    ]);

    render(<TicketedEventsOverviewPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(1));

    expect(within(dataRows()[0] as HTMLElement).getByText('0.0%')).toBeInTheDocument();
  });
});

describe('TicketedEventsOverviewPage — where a click goes', () => {
  it('opens the event’s tickets when the row is clicked', async () => {
    render(<TicketedEventsOverviewPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    fireEvent.click(dataRows()[0] as HTMLElement);

    expect(navigate).toHaveBeenCalledWith('/tickets/ev-1');
  });

  it('opens the tickets of the row that was clicked, not always the first', async () => {
    render(<TicketedEventsOverviewPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    fireEvent.click(dataRows()[1] as HTMLElement);

    expect(navigate).toHaveBeenCalledWith('/tickets/ev-2');
  });

  /*
   * The settings button sits inside a row that is itself clickable. Without the
   * click being stopped, one press fires both handlers and the administrator
   * lands on the tickets list having asked for the settings.
   */
  it('opens the settings from the settings button, and only the settings', async () => {
    render(<TicketedEventsOverviewPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    const buttons = within(dataRows()[0] as HTMLElement).getAllByRole('button');
    fireEvent.click(buttons[1]);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/tickets/ev-1/settings');
  });

  it('opens the tickets from the view button, without also firing the row', async () => {
    render(<TicketedEventsOverviewPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    const buttons = within(dataRows()[1] as HTMLElement).getAllByRole('button');
    fireEvent.click(buttons[0]);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/tickets/ev-2');
  });
});
