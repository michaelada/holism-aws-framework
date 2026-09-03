import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EditTicketingSettingsPage from '../EditTicketingSettingsPage';

/**
 * What a club's electronic tickets say, and whether they are issued at all.
 *
 * Two things here are worth pinning. The **payload**: the form holds every
 * field as a string, and the API wants a number for the validity period and
 * nothing at all for the fields left blank — send `""` and the ticket prints an
 * empty heading; send `"30"` and the validity is meaningless. And the
 * **404**: an event that has no ticketing at all must say so specifically,
 * because "failed to load" sends an administrator looking for a network fault
 * that is not there.
 */

const { execute, navigate, params } = vi.hoisted(() => ({
  execute: vi.fn(),
  navigate: vi.fn(),
  params: { current: { eventId: 'ev-1' } as { eventId?: string } },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useParams: () => params.current,
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

const CONFIG = {
  generateElectronicTickets: true,
  ticketHeaderText: 'Meath Hunt Pony Club',
  ticketInstructions: 'Show this at the gate',
  ticketFooterText: 'No refunds',
  ticketValidityPeriod: 30,
  ticketBackgroundColor: '#ffffff',
};

const respondWith = (config: unknown = CONFIG, sales: unknown = { eventName: 'Winter Dressage' }) => {
  execute.mockImplementation(async ({ url, method }: { url: string; method: string }) => {
    if (method === 'GET' && url.includes('/ticketing-config')) return config;
    if (method === 'GET' && url.includes('/ticket-sales')) return sales;
    return {};
  });
};

/** The body of the most recent PUT. */
const savedPayload = () => {
  const puts = execute.mock.calls.map((c) => c[0]).filter((a) => a?.method === 'PUT');
  return puts[puts.length - 1]?.data;
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <EditTicketingSettingsPage />
    </MemoryRouter>
  );

beforeEach(() => {
  /*
   * Fake timers, because a successful save schedules `navigate` 500ms later.
   * Left real, that timer outlives its own test and fires during the next one —
   * which made the failed-save test see a navigation it had not caused.
   */
  vi.useFakeTimers({ shouldAdvanceTime: true });
  execute.mockReset();
  navigate.mockReset();
  params.current = { eventId: 'ev-1' };
  respondWith();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('EditTicketingSettingsPage — loading', () => {
  it('fetches the configuration for the event in the route', async () => {
    renderPage();

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/orgadmin/events/ev-1/ticketing-config',
      })
    );
  });

  it('opens with what the club already saved', async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByDisplayValue('Meath Hunt Pony Club')).toBeInTheDocument()
    );
    expect(screen.getByDisplayValue('Show this at the gate')).toBeInTheDocument();
    expect(screen.getByDisplayValue('30')).toBeInTheDocument();
  });

  /*
   * The event name comes from a second request that is allowed to fail — it is
   * a heading, not a setting. Losing it must not lose the form.
   */
  it('still shows the form when the event name cannot be fetched', async () => {
    execute.mockImplementation(async ({ url }: { url: string }) => {
      if (url.includes('/ticket-sales')) throw new Error('network');
      return CONFIG;
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByDisplayValue('Meath Hunt Pony Club')).toBeInTheDocument()
    );
  });

  it('fills in sensible blanks for a configuration that has never been set', async () => {
    respondWith({});

    renderPage();

    await waitFor(() => expect(execute).toHaveBeenCalled());
    // Not "undefined" in the boxes, and a real colour rather than an empty one.
    expect(screen.queryByDisplayValue('undefined')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('#ffffff')).toBeInTheDocument();
  });

  it('says the event is not ticketed when the API answers 404', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    execute.mockRejectedValue({ status: 404 });

    renderPage();

    // Distinct from a network failure: the administrator is on the wrong event,
    // not looking at a broken system.
    await waitFor(() => expect(screen.getByText(/invalid|not.*ticket/i)).toBeInTheDocument());
  });

  it('reports an ordinary failure differently from a 404', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    execute.mockRejectedValue(new Error('network'));

    renderPage();

    await waitFor(() => expect(screen.getByText(/failed|error/i)).toBeInTheDocument());
  });

  it('asks for nothing when the route carries no event', async () => {
    params.current = {};

    renderPage();

    await new Promise((r) => setTimeout(r, 20));
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('EditTicketingSettingsPage — saving', () => {
  it('sends the validity period as a number, not the string the form holds', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('30')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(savedPayload()).toBeDefined());
    expect(savedPayload().ticketValidityPeriod).toBe(30);
    expect(typeof savedPayload().ticketValidityPeriod).toBe('number');
  });

  it('omits an empty validity period rather than sending an unparseable one', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('30')).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue('30'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(savedPayload()).toBeDefined());
    // `parseInt("")` is NaN, which serialises to null and means nothing.
    expect(savedPayload().ticketValidityPeriod).toBeUndefined();
  });

  it('omits the text fields that were cleared, so a ticket prints no empty heading', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByDisplayValue('Meath Hunt Pony Club')).toBeInTheDocument()
    );

    fireEvent.change(screen.getByDisplayValue('Meath Hunt Pony Club'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(savedPayload()).toBeDefined());
    expect(savedPayload().ticketHeaderText).toBeUndefined();
  });

  it('keeps the text a club typed', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByDisplayValue('Show this at the gate')).toBeInTheDocument()
    );

    fireEvent.change(screen.getByDisplayValue('Show this at the gate'), {
      target: { value: 'Bring photo ID' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(savedPayload()?.ticketInstructions).toBe('Bring photo ID'));
  });

  it('puts to the event it loaded, not to a new record', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('30')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          url: '/api/orgadmin/events/ev-1/ticketing-config',
        })
      )
    );
  });

  it('says it saved, then returns to the overview', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('30')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    // The redirect is deliberately delayed so the confirmation is readable.
    expect(navigate).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(navigate).toHaveBeenCalledWith('/tickets');
  });

  it('says it did not save, and stays on the form', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('30')).toBeInTheDocument());

    execute.mockRejectedValue(new Error('network'));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    // A failed save that navigates away looks exactly like a successful one.
    expect(navigate).not.toHaveBeenCalled();
  });
});

/**
 * Designing the ticket.
 *
 * A club can put a picture on it, choose where the picture goes and how the
 * ticket is laid out, and see the result before anybody is admitted with it.
 * The preview is the same renderer that prints — a preview drawn separately
 * drifts, and what it gets wrong first is exactly what is being checked.
 */
describe('EditTicketingSettingsPage — the ticket design', () => {
  it('offers the four placements and the three layouts', async () => {
    renderPage();
    await screen.findByRole('radio', { name: 'Stacked' });

    for (const placement of ['Header', 'Footer', 'Top right', 'Background']) {
      expect(screen.getByRole('radio', { name: placement })).toBeInTheDocument();
    }
    for (const layout of ['Stacked', 'Side by side', 'Compact']) {
      expect(screen.getByRole('radio', { name: layout })).toBeInTheDocument();
    }
  });

  it('does not offer a placement until there is an image', async () => {
    // A placement with no picture renders as nothing.
    renderPage();
    await screen.findByRole('radio', { name: 'Stacked' });

    expect(screen.getByRole('radio', { name: 'Background' })).toBeDisabled();
  });

  it('says a background will be darkened, before one is chosen', async () => {
    renderPage();
    await screen.findByRole('radio', { name: 'Stacked' });

    expect(
      screen.getByText('Background images are darkened so the text stays readable.')
    ).toBeInTheDocument();
  });

  it('says the QR code is always on white, and why', async () => {
    // The one thing a club cannot restyle. Saying so beats a club discovering
    // it, or worse, expecting to be able to.
    renderPage();
    await screen.findByRole('radio', { name: 'Stacked' });

    expect(screen.getByText(/QR code always sits on white/)).toBeInTheDocument();
  });

  it('shows a preview of the ticket, rendered by the thing that prints it', async () => {
    renderPage();

    const preview = await screen.findByTitle('Preview');
    await waitFor(() => expect(preview.getAttribute('srcdoc')).toContain('Winter Dressage'));
    // The white QR panel is in it, because it is in every ticket.
    expect(preview.getAttribute('srcdoc')).toMatch(/\.qr\s*\{[^}]*background:\s*#ffffff/i);
  });

  it('saves the layout and the placement with the rest', async () => {
    renderPage();
    await screen.findByRole('radio', { name: 'Stacked' });

    fireEvent.click(screen.getByRole('radio', { name: 'Compact' }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(savedPayload()?.ticketLayout).toBe('compact'));
  });

  it('sends no placement while there is no image', async () => {
    // Otherwise a club that removed a picture keeps a design that claims one.
    renderPage();
    await screen.findByRole('radio', { name: 'Stacked' });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(savedPayload()).toBeDefined());
    expect(savedPayload()?.ticketImagePlacement).toBeNull();
  });

  it('opens on the design the club already saved', async () => {
    respondWith({
      ...CONFIG,
      ticketImageUrl: 'https://signed.example.test/banks.jpg',
      ticketImagePlacement: 'background',
      ticketLayout: 'sideBySide',
    });
    renderPage();
    await screen.findByRole('radio', { name: 'Stacked' });

    expect(screen.getByRole('radio', { name: 'Background' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Side by side' })).toBeChecked();
    // And the placement can be changed, because there *is* a picture.
    expect(screen.getByRole('radio', { name: 'Header' })).not.toBeDisabled();
  });

  it('uploads a chosen image after the configuration is saved', async () => {
    /*
     * In that order: the S3 key is derived from the event and the row has to
     * exist, and a form that uploaded first would leave an orphan object behind
     * whenever somebody changed their mind.
     */
    renderPage();
    await screen.findByRole('radio', { name: 'Stacked' });

    const file = new File(['x'], 'banks.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Ticket image (optional)'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      const calls = execute.mock.calls.map((call) => call[0]);
      const put = calls.findIndex((call) => call?.method === 'PUT');
      const upload = calls.findIndex((call) => String(call?.url).endsWith('/ticketing-config/image'));
      expect(upload).toBeGreaterThan(put);
    });
  });
});

/**
 * The preview shows what was chosen.
 *
 * Reported from the product: *"I am selecting an image for the Ticket, but when
 * I do it does not appear on the preview, plus the preview is all darkened."*
 * Two faults — the renderer dropped `blob:` URLs, and the text colour keyed off
 * the image placement rather than the background actually behind the words.
 */
describe('EditTicketingSettingsPage — the preview shows the chosen image', () => {
  /** jsdom has no real FileReader result, so this stands in for one. */
  const readsAsDataUrl = (dataUrl: string) => {
    class StubReader {
      public result: string | null = null;
      public onload: (() => void) | null = null;
      readAsDataURL() {
        this.result = dataUrl;
        this.onload?.();
      }
      abort() {}
    }
    vi.stubGlobal('FileReader', StubReader);
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('puts a chosen image into the preview before it is uploaded', async () => {
    readsAsDataUrl('data:image/png;base64,CHOSEN');
    renderPage();
    await screen.findByRole('radio', { name: 'Stacked' });

    fireEvent.change(screen.getByLabelText('Ticket image (optional)'), {
      target: { files: [new File(['x'], 'banks.jpg', { type: 'image/jpeg' })] },
    });

    const preview = await screen.findByTitle('Preview');
    await waitFor(() =>
      expect(preview.getAttribute('srcdoc')).toContain('data:image/png;base64,CHOSEN')
    );
  });

  it('lets the placement be chosen once there is one', async () => {
    // It stays disabled with no picture, which is what made the whole thing
    // look inert when the picture was silently dropped.
    readsAsDataUrl('data:image/png;base64,CHOSEN');
    renderPage();
    await screen.findByRole('radio', { name: 'Stacked' });

    fireEvent.change(screen.getByLabelText('Ticket image (optional)'), {
      target: { files: [new File(['x'], 'banks.jpg', { type: 'image/jpeg' })] },
    });

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Background' })).not.toBeDisabled()
    );
  });

  it('shows a dark ticket with light text, so it can be read', async () => {
    // The seeded clubs' ticket colour is a deep green.
    respondWith({ ...CONFIG, ticketBackgroundColor: '#123c2b' });
    renderPage();

    const preview = await screen.findByTitle('Preview');
    await waitFor(() => expect(preview.getAttribute('srcdoc')).toContain('#123c2b'));
    expect(preview.getAttribute('srcdoc')).toMatch(/color:\s*#ffffff/);
  });
});
