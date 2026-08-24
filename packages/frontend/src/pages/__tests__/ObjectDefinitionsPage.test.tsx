import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ObjectDefinitionsPage from '../ObjectDefinitionsPage';
import { ApiError, NetworkError } from '../../api/client';

/**
 * Every object definition in the repository, and what can be done to one.
 *
 * Deleting an object definition is the destructive act on this screen, and the
 * two things that matter are that it is confirmed first and that a refusal is
 * *shown*. The server refuses a delete when instances still reference the
 * object — swallowing that leaves the row on screen with no explanation, and
 * the next click is the same delete again.
 *
 * The error branches are also worth pinning: a server that answered "no" and a
 * connection that never landed both have a message worth reading, and anything
 * else needs a fallback rather than an empty alert.
 */

const { api, navigate } = vi.hoisted(() => ({
  api: {
    getObjects: vi.fn(),
    deleteObject: vi.fn(),
  },
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

vi.mock('../../context', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMetadataApi: () => api,
}));

const object = (over: Record<string, unknown> = {}) => ({
  shortName: 'member',
  displayName: 'Member',
  description: 'A club member',
  fields: [{ fieldShortName: 'first_name' }, { fieldShortName: 'last_name' }],
  ...over,
});

const renderPage = async (objects: unknown[] = [object()]) => {
  api.getObjects.mockResolvedValue(objects);
  render(<ObjectDefinitionsPage />);
  await waitFor(() => expect(api.getObjects).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
};

const rowFor = (shortName: string) =>
  Array.from(document.querySelectorAll('tbody tr')).find((row) =>
    row.querySelector('td')?.textContent === shortName
  ) as HTMLElement;

const actions = (shortName: string) => within(rowFor(shortName)).getAllByRole('button');

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('confirm', vi.fn(() => true));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ObjectDefinitionsPage — listing', () => {
  it('shows each object definition it was given', async () => {
    await renderPage([object({ shortName: 'member' }), object({ shortName: 'event', displayName: 'Event' })]);

    expect(rowFor('member')).toBeTruthy();
    expect(rowFor('event')).toBeTruthy();
  });

  it('summarises the first few fields rather than every one', async () => {
    await renderPage([
      object({
        fields: ['a', 'b', 'c', 'd', 'e'].map((f) => ({ fieldShortName: f })),
      }),
    ]);

    // A wide object would otherwise push the actions column off the screen.
    expect(within(rowFor('member')).getByText('+2 more')).toBeInTheDocument();
  });

  it('says an object has no fields rather than showing an empty cell', async () => {
    await renderPage([object({ fields: [] })]);

    expect(within(rowFor('member')).getByText('No fields')).toBeInTheDocument();
  });

  it('copes with an object whose fields were never set', async () => {
    await renderPage([object({ fields: undefined })]);

    expect(rowFor('member')).toBeTruthy();
  });

  it('invites the first definition when there are none', async () => {
    await renderPage([]);

    expect(screen.getByText(/No object definitions found/i)).toBeInTheDocument();
  });
});

describe('ObjectDefinitionsPage — when the list cannot be loaded', () => {
  it('shows what the server said it refused', async () => {
    api.getObjects.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Not permitted for this account'));
    render(<ObjectDefinitionsPage />);

    expect(await screen.findByText('Not permitted for this account')).toBeInTheDocument();
  });

  it('shows the connection message when the request never landed', async () => {
    api.getObjects.mockRejectedValue(new NetworkError('Unable to connect to server.'));
    render(<ObjectDefinitionsPage />);

    expect(await screen.findByText('Unable to connect to server.')).toBeInTheDocument();
  });

  it('falls back to something readable for anything else', async () => {
    api.getObjects.mockRejectedValue(new TypeError('x is not a function'));
    render(<ObjectDefinitionsPage />);

    // An empty alert is worse than a vague one.
    expect(await screen.findByText('Failed to load data')).toBeInTheDocument();
  });
});

describe('ObjectDefinitionsPage — navigating', () => {
  it('opens a new definition', async () => {
    await renderPage();

    fireEvent.click(screen.getByRole('button', { name: /new object|create/i }));

    expect(navigate).toHaveBeenCalledWith('/objects/new');
  });

  it('opens the instances of the object that was clicked', async () => {
    await renderPage([object({ shortName: 'member' }), object({ shortName: 'event' })]);

    fireEvent.click(actions('event')[0]);

    expect(navigate).toHaveBeenCalledWith('/objects/event/instances');
  });

  it('edits the object that was clicked', async () => {
    await renderPage([object({ shortName: 'member' }), object({ shortName: 'event' })]);

    fireEvent.click(actions('event')[1]);

    expect(navigate).toHaveBeenCalledWith('/objects/event/edit');
  });
});

describe('ObjectDefinitionsPage — deleting', () => {
  it('asks first, and does nothing if the answer is no', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    await renderPage();

    fireEvent.click(actions('member')[2]);

    expect(api.deleteObject).not.toHaveBeenCalled();
  });

  it('deletes the object that was chosen', async () => {
    await renderPage([object({ shortName: 'member' }), object({ shortName: 'event' })]);
    api.deleteObject.mockResolvedValue(undefined);

    fireEvent.click(actions('event')[2]);

    await waitFor(() => expect(api.deleteObject).toHaveBeenCalledWith('event'));
  });

  it('re-reads the list so the deleted row leaves the screen', async () => {
    await renderPage();
    api.deleteObject.mockResolvedValue(undefined);
    api.getObjects.mockResolvedValue([]);

    fireEvent.click(actions('member')[2]);

    await waitFor(() => expect(screen.getByText(/No object definitions found/i)).toBeInTheDocument());
  });

  it('shows the server’s reason when the delete is refused', async () => {
    await renderPage();
    api.deleteObject.mockRejectedValue(
      new ApiError(409, 'IN_USE', 'Object has 12 instances and cannot be deleted')
    );

    fireEvent.click(actions('member')[2]);

    // Silently failing here reads as "deleted" until the page is reloaded.
    expect(await screen.findByText('Object has 12 instances and cannot be deleted')).toBeInTheDocument();
  });

  it('reports a delete that never reached the server', async () => {
    await renderPage();
    api.deleteObject.mockRejectedValue(new NetworkError('Unable to connect to server.'));

    fireEvent.click(actions('member')[2]);

    expect(await screen.findByText('Unable to connect to server.')).toBeInTheDocument();
  });

  it('falls back to a readable message for an unexpected failure', async () => {
    await renderPage();
    api.deleteObject.mockRejectedValue(new TypeError('boom'));

    fireEvent.click(actions('member')[2]);

    expect(await screen.findByText('Failed to delete object definition')).toBeInTheDocument();
  });

  it('leaves the row in place when the delete was refused', async () => {
    await renderPage();
    api.deleteObject.mockRejectedValue(new ApiError(409, 'IN_USE', 'Still referenced'));

    fireEvent.click(actions('member')[2]);

    await screen.findByText('Still referenced');
    expect(rowFor('member')).toBeTruthy();
  });
});
