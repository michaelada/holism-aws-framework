import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import VenuesListPage from '../VenuesListPage';
import EventTypesListPage from '../EventTypesListPage';

/**
 * The two small reference lists behind every event: where it is held, and what
 * kind of thing it is.
 *
 * Both are the same shape — list, search, a dialog that creates *or* edits, and
 * a confirmed delete — and both have the same two risks. The dialog is shared
 * between creating and editing, so it has to be *reset* when it opens for a new
 * record, or a club creating a venue after editing one silently duplicates the
 * old one's details. And a delete is refused by the server when events still
 * reference the record, which has to be shown rather than swallowed.
 *
 * Venues add coordinates, which are parsed from text: an unparsed latitude
 * puts a venue in the wrong place on every map that reads it.
 */

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('@itsplainsailing/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({
    organisation: { id: 'org-1', name: 'Meath' },
    setOrganisation: vi.fn(),
  }),
}));

const VENUE = {
  id: 'v-1',
  name: 'Punchestown',
  address: 'Naas, Co. Kildare',
  region: 'Leinster',
  latitude: 53.19,
  longitude: -6.63,
};

const EVENT_TYPE = { id: 'et-1', name: 'Dressage', description: 'Flatwork classes' };

const renderList = async (Page: React.ComponentType, rows: unknown[]) => {
  execute.mockResolvedValue(rows);
  render(
    <BrowserRouter>
      <Page />
    </BrowserRouter>
  );
  await waitFor(() => expect(execute).toHaveBeenCalled());
};

const listedNames = () =>
  Array.from(document.querySelectorAll('tbody tr'))
    .map((r) => r.querySelector('td')?.textContent ?? '')
    .filter(Boolean);

const rowFor = (name: string) =>
  Array.from(document.querySelectorAll('tbody tr')).find((r) =>
    r.textContent?.includes(name)
  ) as HTMLElement;

const buttonIn = (host: HTMLElement, pattern: RegExp) =>
  within(host)
    .getAllByRole('button')
    .find(
      (b) =>
        pattern.test(b.textContent ?? '') ||
        pattern.test(b.getAttribute('title') ?? '') ||
        pattern.test(b.getAttribute('aria-label') ?? '')
    )!;

const dialog = () => screen.getByRole('dialog');

const openCreate = () =>
  fireEvent.click(
    screen.getAllByRole('button').find((b) => /add|create|new/i.test(b.textContent ?? ''))!
  );

const search = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: text } });

const writes = () => execute.mock.calls.map(([r]) => r).filter((r) => r.method !== 'GET');

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('VenuesListPage — listing and searching', () => {
  it('reads this organisation’s venues', async () => {
    await renderList(VenuesListPage, [VENUE]);

    expect(execute).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/orgadmin/organisations/org-1/venues',
    });
  });

  it('matches a search on the venue name', async () => {
    await renderList(VenuesListPage, [
      VENUE,
      { ...VENUE, id: 'v-2', name: 'Ballindenisk', address: 'Cork' },
    ]);
    await waitFor(() => expect(listedNames()).toHaveLength(2));

    search('punchestown');

    await waitFor(() => expect(listedNames()).toEqual(['Punchestown']));
  });

  it('matches on the address too, which is how a venue is often known', async () => {
    await renderList(VenuesListPage, [
      VENUE,
      { ...VENUE, id: 'v-2', name: 'Ballindenisk', address: 'Cork' },
    ]);
    await waitFor(() => expect(listedNames()).toHaveLength(2));

    search('cork');

    await waitFor(() => expect(listedNames()).toEqual(['Ballindenisk']));
  });

  it('shows an empty list rather than a broken page when the load fails', async () => {
    execute.mockRejectedValue(new Error('network down'));
    render(
      <BrowserRouter>
        <VenuesListPage />
      </BrowserRouter>
    );

    expect(await screen.findByPlaceholderText(/search/i)).toBeInTheDocument();
  });
});

describe('VenuesListPage — creating and editing a venue', () => {
  it('will not save a venue with no name or address', async () => {
    await renderList(VenuesListPage, [VENUE]);

    openCreate();

    // Both are how a venue is identified on an entry form.
    expect(buttonIn(dialog(), /save|create/i)).toBeDisabled();
  });

  it('creates a venue under this organisation', async () => {
    await renderList(VenuesListPage, [VENUE]);

    openCreate();
    fireEvent.change(within(dialog()).getByLabelText(/name/i), { target: { value: 'Tattersalls' } });
    fireEvent.change(within(dialog()).getByLabelText(/address/i), { target: { value: 'Ratoath' } });
    fireEvent.click(buttonIn(dialog(), /save|create/i));

    await waitFor(() =>
      expect(writes()[0]).toMatchObject({
        method: 'POST',
        url: '/api/orgadmin/organisations/org-1/venues',
        data: { name: 'Tattersalls', address: 'Ratoath' },
      })
    );
  });

  it('updates the venue being edited rather than creating another', async () => {
    await renderList(VenuesListPage, [VENUE]);
    await waitFor(() => expect(listedNames()).toHaveLength(1));

    fireEvent.click(buttonIn(rowFor('Punchestown'), /edit/i));
    fireEvent.click(buttonIn(dialog(), /save|update/i));

    await waitFor(() =>
      expect(writes()[0]).toMatchObject({ method: 'PUT', url: '/api/orgadmin/venues/v-1' })
    );
  });

  it('opens an empty form for a new venue after one has been edited', async () => {
    await renderList(VenuesListPage, [VENUE]);
    await waitFor(() => expect(listedNames()).toHaveLength(1));

    fireEvent.click(buttonIn(rowFor('Punchestown'), /edit/i));
    fireEvent.click(buttonIn(dialog(), /cancel/i));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    openCreate();

    // Left populated, the club creates a second copy of the venue it just edited.
    expect(within(dialog()).getByLabelText(/name/i)).toHaveValue('');
  });

  it('sends coordinates as numbers, not as the text that was typed', async () => {
    await renderList(VenuesListPage, [VENUE]);

    openCreate();
    fireEvent.change(within(dialog()).getByLabelText(/name/i), { target: { value: 'Tattersalls' } });
    fireEvent.change(within(dialog()).getByLabelText(/address/i), { target: { value: 'Ratoath' } });
    fireEvent.change(within(dialog()).getByLabelText(/latitude/i), { target: { value: '53.51' } });
    fireEvent.change(within(dialog()).getByLabelText(/longitude/i), { target: { value: '-6.46' } });
    fireEvent.click(buttonIn(dialog(), /save|create/i));

    // A string here puts the venue nowhere on a map that reads it.
    await waitFor(() => expect(writes()[0]?.data.latitude).toBe(53.51));
    expect(writes()[0].data.longitude).toBe(-6.46);
  });

  it('sends no coordinates at all when none were given', async () => {
    await renderList(VenuesListPage, [VENUE]);

    openCreate();
    fireEvent.change(within(dialog()).getByLabelText(/name/i), { target: { value: 'Tattersalls' } });
    fireEvent.change(within(dialog()).getByLabelText(/address/i), { target: { value: 'Ratoath' } });
    fireEvent.click(buttonIn(dialog(), /save|create/i));

    // `parseFloat('')` is NaN, which serialises to null and reads as the equator.
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0].data.latitude).toBeUndefined();
  });

  it('says so when the venue could not be saved', async () => {
    await renderList(VenuesListPage, [VENUE]);
    openCreate();
    fireEvent.change(within(dialog()).getByLabelText(/name/i), { target: { value: 'Tattersalls' } });
    fireEvent.change(within(dialog()).getByLabelText(/address/i), { target: { value: 'Ratoath' } });
    execute.mockRejectedValue(new Error('refused'));

    fireEvent.click(buttonIn(dialog(), /save|create/i));

    expect((await screen.findAllByText(/failed to save/i)).length).toBeGreaterThan(0);
  });
});

describe('VenuesListPage — deleting a venue', () => {
  it('asks before deleting', async () => {
    await renderList(VenuesListPage, [VENUE]);
    await waitFor(() => expect(listedNames()).toHaveLength(1));

    fireEvent.click(buttonIn(rowFor('Punchestown'), /delete/i));

    expect(dialog()).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it('deletes the venue once confirmed and re-reads the list', async () => {
    await renderList(VenuesListPage, [VENUE]);
    await waitFor(() => expect(listedNames()).toHaveLength(1));

    fireEvent.click(buttonIn(rowFor('Punchestown'), /delete/i));
    fireEvent.click(buttonIn(dialog(), /delete|confirm/i));

    await waitFor(() =>
      expect(writes()[0]).toMatchObject({ method: 'DELETE', url: '/api/orgadmin/venues/v-1' })
    );
    await waitFor(() =>
      expect(execute.mock.calls.filter(([r]) => r.method === 'GET').length).toBeGreaterThan(1)
    );
  });

  it('says so when the venue is still in use', async () => {
    await renderList(VenuesListPage, [VENUE]);
    await waitFor(() => expect(listedNames()).toHaveLength(1));
    execute.mockRejectedValue(new Error('venue has events'));

    fireEvent.click(buttonIn(rowFor('Punchestown'), /delete/i));
    fireEvent.click(buttonIn(dialog(), /delete|confirm/i));

    // Swallowing this leaves the venue on screen with no explanation.
    expect(await screen.findByText(/delete/i, { selector: '.MuiAlert-message' })).toBeInTheDocument();
  });

  it('deletes nothing when the club backs out', async () => {
    await renderList(VenuesListPage, [VENUE]);
    await waitFor(() => expect(listedNames()).toHaveLength(1));

    fireEvent.click(buttonIn(rowFor('Punchestown'), /delete/i));
    fireEvent.click(buttonIn(dialog(), /cancel/i));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes()).toHaveLength(0);
  });
});

describe('EventTypesListPage', () => {
  it('reads this organisation’s event types', async () => {
    await renderList(EventTypesListPage, [EVENT_TYPE]);

    expect(execute).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/orgadmin/organisations/org-1/event-types',
    });
  });

  it('finds a type by name', async () => {
    await renderList(EventTypesListPage, [
      EVENT_TYPE,
      { ...EVENT_TYPE, id: 'et-2', name: 'Showjumping' },
    ]);
    await waitFor(() => expect(listedNames()).toHaveLength(2));

    search('dressage');

    await waitFor(() => expect(listedNames()).toEqual(['Dressage']));
  });

  it('creates an event type under this organisation', async () => {
    await renderList(EventTypesListPage, [EVENT_TYPE]);

    openCreate();
    fireEvent.change(within(dialog()).getByLabelText(/name/i), { target: { value: 'Eventing' } });
    fireEvent.change(within(dialog()).getByLabelText(/description/i), {
      target: { value: 'Cross-country and showjumping' },
    });
    fireEvent.click(buttonIn(dialog(), /save|create/i));

    await waitFor(() =>
      expect(writes()[0]).toMatchObject({
        method: 'POST',
        url: '/api/orgadmin/organisations/org-1/event-types',
        data: { name: 'Eventing' },
      })
    );
  });

  it('updates the type being edited rather than creating another', async () => {
    await renderList(EventTypesListPage, [EVENT_TYPE]);
    await waitFor(() => expect(listedNames()).toHaveLength(1));

    fireEvent.click(buttonIn(rowFor('Dressage'), /edit/i));
    fireEvent.click(buttonIn(dialog(), /save|update/i));

    await waitFor(() =>
      expect(writes()[0]).toMatchObject({ method: 'PUT', url: '/api/orgadmin/event-types/et-1' })
    );
  });

  it('opens an empty form for a new type after one has been edited', async () => {
    await renderList(EventTypesListPage, [EVENT_TYPE]);
    await waitFor(() => expect(listedNames()).toHaveLength(1));

    fireEvent.click(buttonIn(rowFor('Dressage'), /edit/i));
    fireEvent.click(buttonIn(dialog(), /cancel/i));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    openCreate();

    expect(within(dialog()).getByLabelText(/name/i)).toHaveValue('');
  });

  it('deletes a type once confirmed', async () => {
    await renderList(EventTypesListPage, [EVENT_TYPE]);
    await waitFor(() => expect(listedNames()).toHaveLength(1));

    fireEvent.click(buttonIn(rowFor('Dressage'), /delete/i));
    fireEvent.click(buttonIn(dialog(), /delete|confirm/i));

    await waitFor(() =>
      expect(writes()[0]).toMatchObject({ method: 'DELETE', url: '/api/orgadmin/event-types/et-1' })
    );
  });

  it('says so when a type still in use cannot be deleted', async () => {
    await renderList(EventTypesListPage, [EVENT_TYPE]);
    await waitFor(() => expect(listedNames()).toHaveLength(1));
    execute.mockRejectedValue(new Error('type has events'));

    fireEvent.click(buttonIn(rowFor('Dressage'), /delete/i));
    fireEvent.click(buttonIn(dialog(), /delete|confirm/i));

    await waitFor(() => expect(document.querySelector('.MuiAlert-message')).not.toBeNull());
  });
});
