import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateCalendarPage from '../CreateCalendarPage';

/**
 * Creating a bookable facility, and editing one.
 *
 * One component serves both, deciding from the route which it is — and that
 * decision picks the verb, the URL and whether an existing calendar is loaded
 * first. Getting it wrong means an edit that silently creates a duplicate
 * facility, which members then book into while the club watches the wrong one.
 */

const { execute, navigate, params } = vi.hoisted(() => ({
  execute: vi.fn(),
  navigate: vi.fn(),
  params: { current: {} as { id?: string } },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useParams: () => params.current,
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

const EXISTING = {
  id: 'cal-1',
  name: 'Main Arena',
  description: 'Sand surface, floodlit',
  status: 'open',
  scheduleRules: [],
  timeSlotConfigurations: [],
  blockedPeriods: [],
};

/** Answer by URL, so a page making four requests is not order-dependent. */
const respondWith = (calendar: unknown = EXISTING) => {
  execute.mockImplementation(async ({ url, method }: { url: string; method: string }) => {
    if (url.includes('/payment-methods')) return [{ id: 'pay-offline', name: 'Pay Offline' }];
    if (url.includes('/application-forms')) return [{ id: 'form-1', name: 'Booking Form' }];
    if (method === 'GET' && url.includes('/calendars/')) return calendar;
    return { id: 'cal-new' };
  });
};

const fillRequiredFields = () => {
  fireEvent.change(screen.getByLabelText(/calendar name/i), {
    target: { value: 'New Arena' },
  });
  fireEvent.change(screen.getByLabelText(/description/i), {
    target: { value: 'A new bookable space' },
  });
};

beforeEach(() => {
  execute.mockReset();
  navigate.mockReset();
  params.current = {};
  respondWith();
});

describe('CreateCalendarPage — creating', () => {
  it('does not go looking for a calendar that does not exist yet', async () => {
    render(<CreateCalendarPage />);

    await waitFor(() => expect(execute).toHaveBeenCalled());
    expect(execute).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', url: expect.stringMatching(/\/calendars\/[^/]+$/) })
    );
  });

  it('posts the new calendar, scoped to the organisation being worked in', async () => {
    render(<CreateCalendarPage />);
    await waitFor(() => expect(screen.getByLabelText(/calendar name/i)).toBeInTheDocument());

    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /save calendar/i }));

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/api/orgadmin/calendars',
          data: expect.objectContaining({
            name: 'New Arena',
            description: 'A new bookable space',
            // Without this a calendar is created belonging to nobody.
            organisationId: 'org-1',
          }),
        })
      )
    );
  });

  it('returns to the list once it has saved', async () => {
    render(<CreateCalendarPage />);
    await waitFor(() => expect(screen.getByLabelText(/calendar name/i)).toBeInTheDocument());

    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /save calendar/i }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/calendar'));
  });

  it('stays on the form when saving fails, so the typing is not lost', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<CreateCalendarPage />);
    await waitFor(() => expect(screen.getByLabelText(/calendar name/i)).toBeInTheDocument());

    fillRequiredFields();
    execute.mockRejectedValue(new Error('network'));
    fireEvent.click(screen.getByRole('button', { name: /save calendar/i }));

    await waitFor(() => expect(screen.getByLabelText(/calendar name/i)).toHaveValue('New Arena'));
    expect(navigate).not.toHaveBeenCalledWith('/calendar');
  });
});

describe('CreateCalendarPage — required fields', () => {
  it('refuses to save a calendar with no name', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<CreateCalendarPage />);
    await waitFor(() => expect(screen.getByLabelText(/calendar name/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Only a description' } });
    fireEvent.click(screen.getByRole('button', { name: /save calendar/i }));

    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(execute).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
  });

  it('refuses to save a calendar with no description', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<CreateCalendarPage />);
    await waitFor(() => expect(screen.getByLabelText(/calendar name/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/calendar name/i), { target: { value: 'Only a name' } });
    fireEvent.click(screen.getByRole('button', { name: /save calendar/i }));

    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(execute).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
  });
});

describe('CreateCalendarPage — editing', () => {
  beforeEach(() => {
    params.current = { id: 'cal-1' };
  });

  it('loads the calendar it was asked to edit', async () => {
    render(<CreateCalendarPage />);

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/orgadmin/calendars/cal-1',
      })
    );
  });

  it('opens with what the club already saved, rather than an empty form', async () => {
    render(<CreateCalendarPage />);

    await waitFor(() =>
      expect(screen.getByLabelText(/calendar name/i)).toHaveValue('Main Arena')
    );
    expect(screen.getByLabelText(/description/i)).toHaveValue('Sand surface, floodlit');
  });

  it('updates the calendar in place instead of creating a second one', async () => {
    render(<CreateCalendarPage />);
    await waitFor(() => expect(screen.getByLabelText(/calendar name/i)).toHaveValue('Main Arena'));

    fireEvent.change(screen.getByLabelText(/calendar name/i), {
      target: { value: 'Main Arena (resurfaced)' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save calendar/i }));

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          url: '/api/orgadmin/calendars/cal-1',
          data: expect.objectContaining({ name: 'Main Arena (resurfaced)' }),
        })
      )
    );
    expect(execute).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
  });

  it('survives a calendar that comes back without its child collections', async () => {
    // The API omits empty arrays; reading `.map` off undefined would white-screen
    // the edit form for any calendar with no rules configured yet.
    respondWith({ id: 'cal-1', name: 'Bare', description: 'No children', status: 'open' });

    render(<CreateCalendarPage />);

    await waitFor(() => expect(screen.getByLabelText(/calendar name/i)).toHaveValue('Bare'));
  });

  it('leaves the form usable when the calendar cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    execute.mockRejectedValue(new Error('network'));

    render(<CreateCalendarPage />);

    // Not stuck on a spinner: a failed load must still let the administrator out.
    await waitFor(() => expect(screen.getByLabelText(/calendar name/i)).toBeInTheDocument());
  });
});

describe('CreateCalendarPage — leaving', () => {
  it('goes back to the list without saving', async () => {
    render(<CreateCalendarPage />);
    await waitFor(() => expect(screen.getByLabelText(/calendar name/i)).toBeInTheDocument());

    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(navigate).toHaveBeenCalledWith('/calendar');
    expect(execute).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
  });
});
