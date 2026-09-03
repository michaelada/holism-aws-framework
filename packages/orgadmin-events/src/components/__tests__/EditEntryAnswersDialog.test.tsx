import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditEntryAnswersDialog, { isRequired } from '../EditEntryAnswersDialog';

/**
 * Correcting an entry.
 *
 * The club's remedy for a member's mistake — the entrant's name typed in a
 * hurry, an answer a year out — which until now meant asking somebody with
 * database access.
 *
 * The part worth pinning down: **every field of the form, answered or not**. A
 * question the member skipped is exactly the one an administrator is most
 * likely to be filling in, and the read-only view leaves it out.
 */

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('@itsplainsailing/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
}));

const field = (over: Record<string, unknown> = {}) => ({
  id: 'f1',
  name: 'pony_name',
  label: 'Pony name',
  datatype: 'text',
  validation: {},
  ...over,
});

const onSaved = vi.fn();
const onClose = vi.fn();

const renderDialog = (
  props: Partial<React.ComponentProps<typeof EditEntryAnswersDialog>> = {}
) =>
  render(
    <EditEntryAnswersDialog
      open
      eventId="event-1"
      entryId="entry-1"
      formId="form-1"
      values={{ pony_name: 'Bramble' }}
      entrantName="Áine McGrath"
      onClose={onClose}
      onSaved={onSaved}
      {...props}
    />
  );

const respond = (fields: unknown[]) =>
  execute.mockImplementation(({ method }: { method: string }) =>
    method === 'GET' ? Promise.resolve({ id: 'form-1', fields }) : Promise.resolve({})
  );

beforeEach(() => {
  vi.clearAllMocks();
  respond([field()]);
});

describe('EditEntryAnswersDialog', () => {
  it('opens on the entrant’s name and their existing answers', async () => {
    renderDialog();

    expect(await screen.findByDisplayValue('Áine McGrath')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bramble')).toBeInTheDocument();
  });

  it('shows a question nobody answered, as an empty box', async () => {
    /*
     * The whole point. The read-only summary drops blanks — right for reading
     * and useless for editing, because the skipped question is the one being
     * filled in.
     */
    respond([field(), field({ id: 'f2', name: 'notes', label: 'Medical notes' })]);
    renderDialog();

    const notes = await screen.findByLabelText('Medical notes');
    expect(notes).toHaveValue('');
  });

  it('sends the name and the answers together', async () => {
    renderDialog();

    const pony = await screen.findByLabelText('Pony name');
    await userEvent.clear(pony);
    await userEvent.type(pony, 'Cloud');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          url: '/api/orgadmin/events/event-1/entries/entry-1/answers',
          data: { name: 'Áine McGrath', answers: { pony_name: 'Cloud' } },
          throwOnError: true,
        })
      )
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('corrects the entrant’s name as one field, not two', async () => {
    // It is typed as one string and split for storage; asking for "first" and
    // "last" here would ask the club to maintain a split it never made.
    renderDialog();

    const name = await screen.findByDisplayValue('Áine McGrath');
    await userEvent.clear(name);
    await userEvent.type(name, 'Áine de Búrca');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Áine de Búrca' }) })
      )
    );
    expect(screen.queryByLabelText(/First name/i)).not.toBeInTheDocument();
  });

  it('will not save an entry with no name on it', async () => {
    // A blank row is the one thing an entrant list cannot be.
    renderDialog();

    await userEvent.clear(await screen.findByDisplayValue('Áine McGrath'));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(
      screen.getByText('Enter the name of the person this entry is for.')
    ).toBeInTheDocument();
  });

  it('holds the save while a required answer is missing', async () => {
    respond([field({ validation: { required: true } })]);
    renderDialog({ values: {} });

    await screen.findByLabelText(/Pony name/);
    expect(await screen.findByText(/Still needed: Pony name/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('reports a refusal in the server’s own words', async () => {
    // `execute` answers null on an error unless asked to throw, which is how a
    // refusal came to read as a save elsewhere in this codebase.
    execute.mockImplementation(({ method }: { method: string }) =>
      method === 'GET'
        ? Promise.resolve({ id: 'form-1', fields: [field()] })
        : Promise.reject(new Error('Some answers need correcting'))
    );
    renderDialog();

    await userEvent.click(await screen.findByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Some answers need correcting')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('opens on what is stored, not on the last edit', async () => {
    const { rerender } = renderDialog();
    const pony = await screen.findByLabelText('Pony name');
    await userEvent.clear(pony);
    await userEvent.type(pony, 'Abandoned edit');

    rerender(
      <EditEntryAnswersDialog
        open={false}
        eventId="event-1"
        entryId="entry-1"
        formId="form-1"
        values={{ pony_name: 'Bramble' }}
        entrantName="Áine McGrath"
        onClose={onClose}
        onSaved={onSaved}
      />
    );
    rerender(
      <EditEntryAnswersDialog
        open
        eventId="event-1"
        entryId="entry-1"
        formId="form-1"
        values={{ pony_name: 'Bramble' }}
        entrantName="Áine McGrath"
        onClose={onClose}
        onSaved={onSaved}
      />
    );

    expect(await screen.findByDisplayValue('Bramble')).toBeInTheDocument();
  });

  it('still edits the name on an activity that asks nothing', async () => {
    renderDialog({ formId: null });

    expect(await screen.findByDisplayValue('Áine McGrath')).toBeInTheDocument();
    // No form to fetch, so none is fetched.
    expect(execute).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining('application-forms') })
    );
  });
});

describe('isRequired', () => {
  it('reads the flag from either place a form records it', () => {
    expect(isRequired(field({ required: true }) as never)).toBe(true);
    expect(isRequired(field({ validation: { required: true } }) as never)).toBe(true);
    expect(isRequired(field() as never)).toBe(false);
  });
});
