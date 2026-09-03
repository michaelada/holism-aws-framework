import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import EventEntryDetailsPage, { paymentStatusColour } from '../EventEntryDetailsPage';

/**
 * One entry, in full.
 *
 * A payment line for an entry used to lead here — except "here" was the
 * entrant list for the whole event, so a club arrived at two hundred names
 * having asked about one. The answers matter most: the form is gone once the
 * entry exists, and until this screen the only way to read back what an entrant
 * declared was the database.
 */

const { execute, navigate } = vi.hoisted(() => ({ execute: vi.fn(), navigate: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useParams: () => ({ id: 'event-1', entryId: 'entry-1' }),
}));

vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({
    organisation: { id: 'org-1', name: 'Kildare', currency: 'EUR' },
    setOrganisation: vi.fn(),
  }),
}));

const entry = (over: Record<string, unknown> = {}) => ({
  id: 'entry-1',
  eventId: 'event-1',
  firstName: 'Áine',
  lastName: 'McGrath',
  email: 'aine@example.test',
  quantity: 1,
  paymentStatus: 'paid',
  paymentMethod: 'card',
  entryDate: '2026-08-01T10:00:00.000Z',
  eventName: 'Spring League',
  eventStartDate: '2026-09-12T00:00:00.000Z',
  eventEndDate: null,
  activityName: '80cm',
  activityDescription: 'Open to riders who have not won at this level',
  activityFee: 25,
  formSummary: [
    { label: 'Pony name', value: 'Bramble' },
    { label: 'Medical notes', value: 'Asthma inhaler' },
  ],
  paymentId: 'pay-1',
  paymentAmount: 185.23,
  paymentDate: '2026-08-01T10:00:05.000Z',
  paymentReference: 'pi_123',
  memberId: 'member-7',
  memberName: 'Áine McGrath',
  ...over,
});

const renderPage = () =>
  render(
    <BrowserRouter>
      <EventEntryDetailsPage />
    </BrowserRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  execute.mockResolvedValue(entry());
});

describe('EventEntryDetailsPage', () => {
  it('leads with whose entry it is, and for what', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Áine McGrath' })).toBeInTheDocument();
    expect(screen.getByText('80cm — Spring League')).toBeInTheDocument();
  });

  it('reads the one entry, not the event’s whole list', async () => {
    renderPage();

    await screen.findByRole('heading', { name: 'Áine McGrath' });
    expect(execute).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/orgadmin/events/event-1/entries/entry-1',
    });
  });

  /**
   * The name as it was given.
   *
   * It is typed as one string and split at the first space only so the schema
   * has somewhere to put it. Two fields present that split as though the club
   * had asked for it.
   */
  it('shows the name as one field, not as first and last', async () => {
    execute.mockResolvedValue(entry({ firstName: 'Áine', lastName: 'de Búrca' }));
    renderPage();

    await screen.findByRole('heading', { name: 'Áine de Búrca' });
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.queryByText('First Name')).not.toBeInTheDocument();
    expect(screen.queryByText('Last Name')).not.toBeInTheDocument();
    // Not "de Búrca" as a surname of its own, nor "Áine" with a gap beside it.
    expect(screen.getAllByText('Áine de Búrca').length).toBeGreaterThan(1);
  });

  it('shows how to reach the entrant', async () => {
    renderPage();

    const email = await screen.findByRole('link', { name: 'aine@example.test' });
    expect(email).toHaveAttribute('href', 'mailto:aine@example.test');
  });

  it('shows the class, what it cost and what it is', async () => {
    renderPage();

    expect(await screen.findByText('EUR 25.00')).toBeInTheDocument();
    expect(
      screen.getByText('Open to riders who have not won at this level')
    ).toBeInTheDocument();
  });

  it('shows every answer the entrant gave, labelled', async () => {
    // The whole reason this screen exists: the form is gone once the entry is.
    renderPage();

    expect(await screen.findByText('Pony name')).toBeInTheDocument();
    expect(screen.getByText('Bramble')).toBeInTheDocument();
    expect(screen.getByText('Medical notes')).toBeInTheDocument();
  });

  it('says the class asked nothing rather than showing an empty heading', async () => {
    execute.mockResolvedValue(entry({ formSummary: [] }));
    renderPage();

    expect(
      await screen.findByText('This class asked for no additional details.')
    ).toBeInTheDocument();
  });

  it('opens the payment the entry arrived on', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Open the payment' }));
    expect(navigate).toHaveBeenCalledWith('/payments/pay-1');
  });

  it('says so when an entry is attached to no payment', async () => {
    // Added by hand, or from before baskets existed. Its status still stands.
    execute.mockResolvedValue(entry({ paymentId: null, paymentAmount: null, paymentDate: null }));
    renderPage();

    expect(
      await screen.findByText('This entry is not attached to a payment record.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open the payment' })).not.toBeInTheDocument();
  });

  it('opens the member behind the entrant', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Áine McGrath' }));
    expect(navigate).toHaveBeenCalledWith('/members/member-7');
  });

  it('says when somebody entered without a membership', async () => {
    execute.mockResolvedValue(entry({ memberId: null, memberName: null }));
    renderPage();

    expect(await screen.findByText('Not entered as a member')).toBeInTheDocument();
  });

  it('says plainly when an entry has been withdrawn', async () => {
    /*
     * Withdrawn rather than deleted, so it is still reachable — from the
     * payment that refunded it, most of all. Somebody arriving there must not
     * read it as an entry that still stands.
     */
    execute.mockResolvedValue(
      entry({
        entryStatus: 'removed',
        removedAt: '2026-08-20T09:00:00.000Z',
        removalReason: 'Withdrew before the closing date',
      })
    );
    renderPage();

    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('This entry was withdrawn on');
    expect(notice).toHaveTextContent('Withdrew before the closing date');
  });

  it('says nothing of the sort about an entry that stands', async () => {
    renderPage();

    await screen.findByRole('heading', { name: 'Áine McGrath' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reports a failure rather than an empty entry', async () => {
    execute.mockRejectedValue(new Error('network'));
    renderPage();

    expect(await screen.findByText('We could not load this entry.')).toBeInTheDocument();
  });

  /**
   * Correcting the entry.
   *
   * Beside the entrant rather than beside the answers: the name is the commoner
   * correction, and an activity that asks nothing still has one to fix.
   */
  it('offers the correction beside the entrant', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Edit this entry');
  });

  it('hands the editor the raw answers, not the formatted summary', async () => {
    /*
     * `formSummary` is display text built by the server — "Yes", "12 May 2012",
     * labels rather than field names. Editing needs the values behind it, so
     * the entry carries both and the dialog is given the raw ones.
     */
    execute.mockImplementation(({ url }: { url: string }) =>
      url.includes('application-forms')
        ? Promise.resolve({
            id: 'form-1',
            fields: [
              { id: 'f1', name: 'pony_name', label: 'Pony name', datatype: 'text', validation: {} },
            ],
          })
        : Promise.resolve(
            entry({ applicationFormId: 'form-1', formValues: { pony_name: 'Bramble' } })
          )
    );
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

    expect(await screen.findByDisplayValue('Bramble')).toBeInTheDocument();
    // Seeded from the name as given, in one field.
    expect(screen.getByDisplayValue('Áine McGrath')).toBeInTheDocument();
  });

  it('offers it for an activity that asks nothing', async () => {
    // There is still a name to correct.
    execute.mockResolvedValue(entry({ applicationFormId: null, formValues: {}, formSummary: [] }));
    renderPage();

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('re-reads the entry once a correction is saved', async () => {
    /*
     * Reloaded rather than patched in place: the summary on this page is built
     * by the server from the form's own labels and ordering, and half of it is
     * formatting the client does not repeat.
     */
    execute.mockImplementation(({ url }: { url: string }) =>
      url.includes('application-forms')
        ? Promise.resolve({ id: 'form-1', fields: [] })
        : Promise.resolve(entry())
    );
    renderPage();

    await screen.findByRole('heading', { name: 'Áine McGrath' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const reads = execute.mock.calls.filter(
      ([call]: [{ url: string }]) =>
        call.url === '/api/orgadmin/events/event-1/entries/entry-1'
    ).length;

    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(
        execute.mock.calls.filter(
          ([call]: [{ url: string }]) =>
            call.url === '/api/orgadmin/events/event-1/entries/entry-1'
        ).length
      ).toBe(reads + 1)
    );
  });

  it('offers the way back to the class list', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Back to entries' }));
    expect(navigate).toHaveBeenCalledWith('/events/event-1/entries');
  });
});

describe('paymentStatusColour', () => {
  it('marks a refund as something to notice, not as a success', () => {
    expect(paymentStatusColour('paid')).toBe('success');
    expect(paymentStatusColour('pending')).toBe('warning');
    expect(paymentStatusColour('refunded')).toBe('error');
  });

  it('falls back rather than colouring a status it does not know', () => {
    expect(paymentStatusColour('awaiting_offline')).toBe('default');
  });
});
