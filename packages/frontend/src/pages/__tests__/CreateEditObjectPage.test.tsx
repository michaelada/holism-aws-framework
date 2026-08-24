import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import CreateEditObjectPage from '../CreateEditObjectPage';
import { ApiError, NetworkError } from '../../api/client';

/**
 * Defining an object in the metadata repository, and editing one.
 *
 * This is the screen that decides what every generated form and table in the
 * product will contain, so its two riskiest behaviours are worth pinning down.
 * **Field order** is data, not decoration — it is the order the fields appear
 * in on a member-facing form, and the move buttons rewrite it. And **editing
 * must preserve `displayProperties`**, which this screen never shows: it reads
 * the existing object back and carries them across, and a save that forgets to
 * would silently wipe display configuration nobody was looking at.
 */

const { api, navigate, params } = vi.hoisted(() => ({
  api: {
    getFields: vi.fn(),
    getObjects: vi.fn(),
    createObject: vi.fn(),
    updateObject: vi.fn(),
  },
  navigate: vi.fn(),
  params: { current: {} as { objectShortName?: string } },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useParams: () => params.current,
}));

vi.mock('../../context', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMetadataApi: () => api,
}));

const FIELDS = [
  { shortName: 'first_name', displayName: 'First Name', datatype: 'text' },
  { shortName: 'last_name', displayName: 'Last Name', datatype: 'text' },
  { shortName: 'email', displayName: 'Email', datatype: 'email' },
];

const EXISTING_OBJECT = {
  shortName: 'member',
  displayName: 'Member',
  description: 'A club member',
  fields: [
    { fieldShortName: 'first_name', mandatory: true, order: 0, inTable: true },
    { fieldShortName: 'last_name', mandatory: true, order: 1, inTable: true },
  ],
  fieldGroups: [],
  wizardConfig: undefined,
  // Never rendered by this page — which is exactly why it is easy to drop.
  displayProperties: { icon: 'person', colour: '#D24400' },
};

const renderPage = () => render(<CreateEditObjectPage />);

/** The payload of the most recent create or update. */
const saved = () =>
  api.createObject.mock.calls.at(-1)?.[0] ?? api.updateObject.mock.calls.at(-1)?.[1];

beforeEach(() => {
  vi.clearAllMocks();
  params.current = {};
  api.getFields.mockResolvedValue(FIELDS);
  api.getObjects.mockResolvedValue([EXISTING_OBJECT]);
  api.createObject.mockResolvedValue({});
  api.updateObject.mockResolvedValue({});
});

describe('CreateEditObjectPage — creating', () => {
  it('loads the fields that can be put on an object', async () => {
    renderPage();

    await waitFor(() => expect(api.getFields).toHaveBeenCalled());
  });

  it('does not go looking for an object that does not exist yet', async () => {
    renderPage();

    await waitFor(() => expect(api.getFields).toHaveBeenCalled());
    expect(api.getObjects).not.toHaveBeenCalled();
  });

  it('opens on an empty form', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toHaveValue(''));
    expect(screen.getByLabelText(/display name/i)).toHaveValue('');
  });

  it('creates the object with what was typed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/short name/i), { target: { value: 'horse' } });
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Horse' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'A ride' } });
    fireEvent.submit(screen.getByLabelText(/short name/i).closest('form')!);

    await waitFor(() => expect(api.createObject).toHaveBeenCalled());
    expect(saved()).toEqual(
      expect.objectContaining({ shortName: 'horse', displayName: 'Horse', description: 'A ride' })
    );
  });

  it('returns to the object list once it has saved', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/short name/i), { target: { value: 'horse' } });
    fireEvent.submit(screen.getByLabelText(/short name/i).closest('form')!);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/objects'));
  });

  it('omits empty field groups and wizard steps rather than sending empty arrays', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/short name/i), { target: { value: 'horse' } });
    fireEvent.submit(screen.getByLabelText(/short name/i).closest('form')!);

    await waitFor(() => expect(api.createObject).toHaveBeenCalled());
    // An empty `wizardConfig` would make the renderer draw a one-step wizard
    // around a form that never asked for one.
    expect(saved().fieldGroups).toBeUndefined();
    expect(saved().wizardConfig).toBeUndefined();
  });
});

describe('CreateEditObjectPage — editing', () => {
  beforeEach(() => {
    params.current = { objectShortName: 'member' };
  });

  it('opens with the object the club already defined', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toHaveValue('member'));
    expect(screen.getByLabelText(/display name/i)).toHaveValue('Member');
    expect(screen.getByLabelText(/description/i)).toHaveValue('A club member');
  });

  it('updates in place rather than creating a second object', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toHaveValue('member'));

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Club Member' } });
    fireEvent.submit(screen.getByLabelText(/short name/i).closest('form')!);

    await waitFor(() => expect(api.updateObject).toHaveBeenCalled());
    expect(api.updateObject.mock.calls[0][0]).toBe('member');
    expect(api.createObject).not.toHaveBeenCalled();
  });

  /*
   * The quiet one. `displayProperties` is configured elsewhere and never shown
   * on this screen, so a save that builds its payload from the form alone would
   * blank it — and nobody would notice until a table lost its icon.
   */
  it('carries across the display properties it never showed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toHaveValue('member'));

    fireEvent.submit(screen.getByLabelText(/short name/i).closest('form')!);

    await waitFor(() => expect(api.updateObject).toHaveBeenCalled());
    expect(saved().displayProperties).toEqual({ icon: 'person', colour: '#D24400' });
  });

  it('says so when the object in the route does not exist', async () => {
    api.getObjects.mockResolvedValue([]);

    renderPage();

    await waitFor(() => expect(screen.getByText(/object not found/i)).toBeInTheDocument());
  });
});

describe('CreateEditObjectPage — the fields on the object', () => {
  it('adds a field row', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /add field/i }));

    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0));
  });

  it('removes the field row that was chosen', async () => {
    params.current = { objectShortName: 'member' };
    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toHaveValue('member'));

    const before = screen.getAllByRole('combobox').length;
    const deleteButtons = screen
      .getAllByRole('button')
      .filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeLessThan(before));
  });

  /*
   * Order is the order a member sees the questions in. The move buttons must
   * rewrite the `order` values, not merely reposition the rows on screen —
   * a reordering that never reaches the payload is a no-op the administrator
   * cannot see.
   */
  it('renumbers the fields when one is moved, so the saved order matches the screen', async () => {
    params.current = { objectShortName: 'member' };
    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toHaveValue('member'));

    const upButtons = screen
      .getAllByRole('button')
      .filter((b) => b.querySelector('[data-testid="ArrowUpwardIcon"]'));
    fireEvent.click(upButtons[1]);

    fireEvent.submit(screen.getByLabelText(/short name/i).closest('form')!);
    await waitFor(() => expect(api.updateObject).toHaveBeenCalled());

    const savedFields = saved().fields;
    expect(savedFields[0].fieldShortName).toBe('last_name');
    expect(savedFields[1].fieldShortName).toBe('first_name');

    /*
     * Contiguous, and in step with the position on screen. The page numbers
     * from 1 rather than 0 — asserting the base would pin an incidental choice;
     * asserting the *relationship* catches the failure that matters, which is a
     * reorder that leaves the old numbers behind.
     */
    const orders = savedFields.map((f: { order: number }) => f.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(new Set(orders).size).toBe(orders.length);
    expect(orders[1] - orders[0]).toBe(1);
  });
});

describe('CreateEditObjectPage — when something goes wrong', () => {
  it('shows the API’s own message rather than a generic one', async () => {
    api.getFields.mockRejectedValue(new ApiError(409, 'CONFLICT', 'Short name already in use'));

    renderPage();

    // The server knows why; repeating "failed to load" throws that away.
    await waitFor(() =>
      expect(screen.getByText(/short name already in use/i)).toBeInTheDocument()
    );
  });

  it('shows a network failure as a network failure', async () => {
    api.getFields.mockRejectedValue(new NetworkError('Unable to reach the server'));

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/unable to reach the server/i)).toBeInTheDocument()
    );
  });

  it('falls back to a plain message for an error it does not recognise', async () => {
    api.getFields.mockRejectedValue(new Error('kaboom'));

    renderPage();

    await waitFor(() => expect(screen.getByText(/failed to load data/i)).toBeInTheDocument());
  });

  it('reports a failed save and stays on the form', async () => {
    api.createObject.mockRejectedValue(new ApiError(409, 'CONFLICT', 'Short name already in use'));

    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/short name/i), { target: { value: 'member' } });
    fireEvent.submit(screen.getByLabelText(/short name/i).closest('form')!);

    await waitFor(() =>
      expect(screen.getByText(/short name already in use/i)).toBeInTheDocument()
    );
    expect(navigate).not.toHaveBeenCalledWith('/objects');
    expect(screen.getByLabelText(/short name/i)).toHaveValue('member');
  });

  it('lets the error be dismissed', async () => {
    api.getFields.mockRejectedValue(new Error('kaboom'));

    renderPage();
    await waitFor(() => expect(screen.getByText(/failed to load data/i)).toBeInTheDocument());

    const errorAlert = screen
      .getAllByRole('alert')
      .find((alert) => /failed to load data/i.test(alert.textContent ?? ''))!;
    fireEvent.click(within(errorAlert).getByRole('button'));

    await waitFor(() =>
      expect(screen.queryByText(/failed to load data/i)).not.toBeInTheDocument()
    );
  });
});
