import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import EditEventPage from '../EditEventPage';

/**
 * Editing an event that already exists.
 *
 * The screen is one long form in collapsible sections, and the thing worth
 * pinning is what happens when a save is rejected by validation: the section
 * holding the first bad field has to be *expanded and scrolled to*. Without
 * that, the page reports "fix the errors" while every error is inside a section
 * that is collapsed and off-screen, which reads as a save button that does
 * nothing.
 *
 * The other is the draft/publish pair: both write the same form, and the status
 * they send is the only difference. Sending the wrong one either publishes a
 * half-finished event to the public page or quietly unpublishes a live one.
 */

const { execute, navigate, params } = vi.hoisted(() => ({
  execute: vi.fn(),
  navigate: vi.fn(),
  params: { current: { id: 'ev-1' } as { id?: string } },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useParams: () => params.current,
}));

vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({
    organisation: { id: 'org-1', name: 'Meath', currency: 'EUR' },
    setOrganisation: vi.fn(),
  }),
}));

const EVENT = {
  id: 'ev-1',
  name: 'Winter Dressage',
  description: 'Three days of dressage',
  eventOwner: 'Aoife Byrne',
  emailNotifications: 'entries@example.com',
  startDate: '2026-11-18T09:00:00Z',
  endDate: '2026-11-20T17:00:00Z',
  openDateEntries: '2026-10-01T09:00:00Z',
  entriesClosingDate: '2026-11-10T17:00:00Z',
  limitEntries: false,
  status: 'draft',
  showOnOrganisationPage: true,
  showOnPlatformPage: false,
  // A saveable event needs at least one complete activity behind it: entries
  // cannot be captured without one, and validation refuses the save otherwise.
  activities: [
    {
      id: 'act-1',
      name: 'Class 3',
      description: 'Preliminary',
      applicationFormId: 'form-1',
      discountIds: [],
    },
  ],
  discountIds: [],
};

const respond = (over: Record<string, unknown> = {}) =>
  execute.mockImplementation(async ({ url, method }: { url: string; method: string }) => {
    if (method !== 'GET') return over.saved ?? {};
    if (url.includes('/event-types')) return [];
    if (url.includes('/venues')) return [];
    if (url.includes('/discounts')) return { discounts: [] };
    if (url.includes('/activities')) return [];
    if (url.includes('/events/')) return 'event' in over ? over.event : EVENT;
    return [];
  });

const renderPage = async () => {
  render(
    <BrowserRouter>
      <EditEventPage />
    </BrowserRouter>
  );
  await waitFor(() => expect(execute).toHaveBeenCalled());
};

const loaded = () => screen.findByDisplayValue('Winter Dressage');

const nameBox = () => screen.getByDisplayValue('Winter Dressage');

const clickButton = (pattern: RegExp) =>
  fireEvent.click(screen.getAllByRole('button').find((b) => pattern.test(b.textContent ?? ''))!);

/** The write the page made, if any. */
const saved = () => execute.mock.calls.map(([r]) => r).find((r) => r.method === 'PUT');

beforeEach(() => {
  vi.clearAllMocks();
  params.current = { id: 'ev-1' };
  respond();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  /*
   * `restoreAllMocks` below strips the implementation from the shared
   * `matchMedia` stub the setup file installs, and MUI reads `.matches` off it
   * on every render — so it is re-established here rather than once globally.
   */
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  // The error-scrolling path schedules work on the next frame.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('EditEventPage — loading the event', () => {
  it('reads the event named in the route', async () => {
    await renderPage();
    await loaded();

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', url: '/api/orgadmin/events/ev-1' })
    );
  });

  it('shows the event’s existing details rather than a blank form', async () => {
    await renderPage();

    expect(await loaded()).toBeInTheDocument();
  });

  it('reads the event types and venues a club can choose from', async () => {
    await renderPage();
    await loaded();

    const urls = execute.mock.calls.map(([r]) => r.url);
    expect(urls.some((u: string) => u.includes('/event-types'))).toBe(true);
    expect(urls.some((u: string) => u.includes('/venues'))).toBe(true);
  });
});

describe('EditEventPage — saving', () => {
  it('saves as a draft without publishing', async () => {
    await renderPage();
    await loaded();

    clickButton(/draft/i);

    await waitFor(() => expect(saved()).toBeDefined());
    expect(saved()!.url).toBe('/api/orgadmin/events/ev-1');
    expect(saved()!.data.status).toBe('draft');
  });

  it('publishes when asked to publish', async () => {
    await renderPage();
    await loaded();

    clickButton(/publish/i);

    // The two buttons write the same form; only the status separates them.
    await waitFor(() => expect(saved()).toBeDefined());
    expect(saved()!.data.status).toBe('published');
  });

  it('carries the edits into the save', async () => {
    await renderPage();
    await loaded();

    fireEvent.change(nameBox(), { target: { value: 'Winter Dressage Series' } });
    clickButton(/draft/i);

    await waitFor(() => expect(saved()).toBeDefined());
    expect(saved()!.data.name).toBe('Winter Dressage Series');
  });

  it('returns to the events list once saved', async () => {
    await renderPage();
    await loaded();

    clickButton(/draft/i);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/events'));
  });

  it('stays on the form and says so when the save is refused', async () => {
    await renderPage();
    await loaded();
    execute.mockRejectedValue(new Error('server refused'));

    clickButton(/draft/i);

    // Navigating away would lose every edit made on this long form.
    // Several alerts can be on screen at once: the banner and the field errors.
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0);
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('EditEventPage — when the form is not valid', () => {
  it('refuses to save an event with no name', async () => {
    await renderPage();
    await loaded();

    fireEvent.change(nameBox(), { target: { value: '' } });
    clickButton(/draft/i);

    await screen.findAllByRole('alert');
    expect(saved()).toBeUndefined();
  });

  it('brings the section holding the first error into view', async () => {
    await renderPage();
    await loaded();

    fireEvent.change(nameBox(), { target: { value: '' } });
    clickButton(/draft/i);

    // Otherwise the page says "fix the errors" with every error off-screen.
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
  });

  it('lets the operator correct the problem and save', async () => {
    await renderPage();
    await loaded();

    fireEvent.change(nameBox(), { target: { value: '' } });
    clickButton(/draft/i);
    await screen.findAllByRole('alert');

    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Winter Dressage' } });
    clickButton(/draft/i);

    await waitFor(() => expect(saved()).toBeDefined());
  });
});

describe('EditEventPage — leaving', () => {
  it('returns to the events list without saving', async () => {
    await renderPage();
    await loaded();

    clickButton(/cancel/i);

    expect(saved()).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith('/events');
  });

  it('asks for nothing when the route carries no event', async () => {
    params.current = {};
    render(
      <BrowserRouter>
        <EditEventPage />
      </BrowserRouter>
    );

    // `/events/undefined` is a 404 dressed up as a real request.
    await waitFor(() =>
      expect(
        execute.mock.calls.some(([r]) => String(r.url).includes('undefined'))
      ).toBe(false)
    );
  });
});
