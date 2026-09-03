/**
 * One entry, in full.
 *
 * `getEntryById` used to return the entry row and the two names joined onto it.
 * The org-admin entry screen needs what a secretary is asked on the phone: which
 * class and what it cost, what the entrant wrote on the form, which payment it
 * came in on, and whether they entered as a member.
 */

jest.mock('../../database/pool', () => ({ db: { query: jest.fn() } }));
jest.mock('../../config/logger');
/*
 * `formSummariesFor` is stubbed — the entry detail's answers are its own
 * concern, tested where that helper lives. `formatAnswer` is **not**: the
 * export's cells go through it, and a stub would let this suite agree that a
 * boolean renders as "true".
 */
jest.mock('../../services/application-form.service', () => ({
  applicationFormService: { getApplicationFormWithFields: jest.fn() },
}));
jest.mock('../../services/form-submission.service', () => ({
  formSubmissionService: { updateSubmission: jest.fn(), createSubmission: jest.fn() },
}));
jest.mock('../../utils/form-summary', () => ({
  ...jest.requireActual('../../utils/form-summary'),
  formSummariesFor: jest.fn(),
}));

import { Workbook } from 'exceljs';
import { EventEntryService } from '../event-entry.service';
import { db } from '../../database/pool';
import { formSummariesFor } from '../../utils/form-summary';
import { applicationFormService } from '../application-form.service';
import { formSubmissionService } from '../form-submission.service';

const mockDb = db as jest.Mocked<typeof db>;
const summaries = formSummariesFor as jest.Mock;

const service = new EventEntryService();

const row = (over: Record<string, unknown> = {}) => ({
  id: 'entry-1',
  event_id: 'event-1',
  event_activity_id: 'act-1',
  user_id: 'user-1',
  first_name: 'Áine',
  last_name: 'McGrath',
  email: 'aine@example.test',
  form_submission_id: 'sub-1',
  quantity: 1,
  payment_status: 'paid',
  payment_method: 'card',
  entry_date: new Date('2026-08-01T10:00:00Z'),
  created_at: new Date(),
  updated_at: new Date(),
  member_id: 'member-7',
  activity_name: 'Intermediate',
  activity_description: 'Open to riders who have not won at this level',
  activity_fee: '25.00',
  event_name: 'Spring League',
  start_date: new Date('2026-09-12'),
  end_date: new Date('2026-09-13'),
  member_name: 'Áine McGrath',
  payment_id: 'pay-1',
  payment_amount: '185.23',
  payment_date: new Date('2026-08-01T10:00:05Z'),
  payment_reference: 'pi_123',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  summaries.mockResolvedValue(new Map([['sub-1', [{ label: 'Pony name', value: 'Bramble' }]]]));
});

describe('getEntryById', () => {
  it('returns the entry with its activity, its event and its fee', async () => {
    mockDb.query.mockResolvedValue({ rows: [row()] } as any);

    const entry = await service.getEntryById('entry-1');

    expect(entry).toMatchObject({
      id: 'entry-1',
      firstName: 'Áine',
      email: 'aine@example.test',
      activityName: 'Intermediate',
      activityDescription: 'Open to riders who have not won at this level',
      activityFee: 25,
      eventName: 'Spring League',
    });
  });

  it('carries the answers the entrant gave', async () => {
    // The form is gone once the entry exists; this is the only place the club
    // can read back what was said on it.
    mockDb.query.mockResolvedValue({ rows: [row()] } as any);

    const entry = await service.getEntryById('entry-1');

    expect(entry?.formSummary).toEqual([{ label: 'Pony name', value: 'Bramble' }]);
    expect(summaries).toHaveBeenCalledWith(['sub-1']);
  });

  it('reports no answers rather than failing when the activity asked nothing', async () => {
    summaries.mockResolvedValue(new Map());
    mockDb.query.mockResolvedValue({ rows: [row({ form_submission_id: null })] } as any);

    const entry = await service.getEntryById('entry-1');

    expect(entry?.formSummary).toEqual([]);
  });

  it('names the payment the entry arrived on', async () => {
    mockDb.query.mockResolvedValue({ rows: [row()] } as any);

    const entry = await service.getEntryById('entry-1');

    expect(entry).toMatchObject({
      paymentId: 'pay-1',
      paymentAmount: 185.23,
      paymentReference: 'pi_123',
    });
  });

  it('leaves the payment null for an entry that came through no basket', async () => {
    // An entry added by hand, or one from before baskets existed.
    mockDb.query.mockResolvedValue({
      rows: [row({ payment_id: null, payment_amount: null, payment_date: null, payment_reference: null })],
    } as any);

    const entry = await service.getEntryById('entry-1');

    expect(entry?.paymentId).toBeNull();
    expect(entry?.paymentAmount).toBeNull();
  });

  it('says whether the entrant entered as a member', async () => {
    mockDb.query.mockResolvedValue({ rows: [row({ member_id: null, member_name: null })] } as any);

    const entry = await service.getEntryById('entry-1');

    expect(entry?.memberId).toBeNull();
    expect(entry?.memberName).toBeNull();
  });

  it('returns null for an entry that does not exist', async () => {
    mockDb.query.mockResolvedValue({ rows: [] } as any);

    await expect(service.getEntryById('nope')).resolves.toBeNull();
  });

  it('reads a free activity as zero rather than as absent', async () => {
    mockDb.query.mockResolvedValue({ rows: [row({ activity_fee: '0.00' })] } as any);

    const entry = await service.getEntryById('entry-1');

    expect(entry?.activityFee).toBe(0);
  });
});

/**
 * The export is a real workbook.
 *
 * Every Excel export in this application produced a file the operating system
 * refuses to open — `new ExcelJS()` threw "is not a constructor", because the
 * module has no default export — and every test passed, because `exceljs` was
 * globally mapped to a stand-in shaped to satisfy both import styles.
 *
 * An assertion on the bytes is the only kind that can catch that: a stubbed
 * workbook can return whatever it likes.
 */
describe('exportEntriesToExcel', () => {
  const entryRow = (over: Record<string, unknown> = {}) => ({
    id: 'entry-1',
    event_id: 'event-1',
    event_activity_id: 'act-1',
    user_id: 'user-1',
    first_name: 'Áine',
    last_name: 'McGrath',
    email: 'aine@example.test',
    quantity: 1,
    payment_status: 'paid',
    payment_method: 'card',
    entry_date: new Date('2026-08-01T10:00:00Z'),
    created_at: new Date(),
    updated_at: new Date(),
    activity_name: 'Intermediate',
    event_name: 'Spring League',
    ...over,
  });

  /**
   * The event's name, its entries, the form fields of each activity, then the
   * submissions those entries point at — the four reads the export makes.
   */
  const exporting = (
    rows: Array<Record<string, unknown>>,
    fields: Array<Record<string, unknown>> = [],
    submissions: Array<Record<string, unknown>> = []
  ) => {
    mockDb.query.mockReset();
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ name: 'Spring League' }] } as any)
      .mockResolvedValueOnce({ rows } as any)
      .mockResolvedValueOnce({ rows: fields } as any)
      .mockResolvedValue({ rows: submissions } as any);
  };

  /** Read the workbook back the way a spreadsheet would. */
  const sheetsOf = async (buffer: Buffer) => {
    const read = new Workbook();
    await read.xlsx.load(buffer as never);
    return read.worksheets.map((sheet) => ({
      name: sheet.name,
      headers: (sheet.getRow(3).values as unknown[]).slice(1).map(String),
      rows: Array.from({ length: Math.max(sheet.rowCount - 3, 0) }, (_, index) =>
        (sheet.getRow(index + 4).values as unknown[]).slice(1)
      ),
    }));
  };

  it('produces a file a spreadsheet can open', async () => {
    exporting([entryRow()]);

    const buffer = await service.exportEntriesToExcel('event-1');

    // An .xlsx is a zip archive: it starts PK\x03\x04.
    expect(buffer.subarray(0, 4).toString('hex')).toBe('504b0304');
    expect(buffer.length).toBeGreaterThan(1000);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  /**
   * The answers are why a club exports at all.
   *
   * A class list without the horse's name, the vaccination date or the
   * emergency contact is a list of names — which is what the export used to be,
   * eight fixed columns and not one of the form's.
   */
  it('gives every field of the activity’s form a column', async () => {
    exporting(
      [entryRow({ form_submission_id: 'sub-1' })],
      [
        { activity_id: 'act-1', field_name: 'pony_name', label: 'Pony name' },
        { activity_id: 'act-1', field_name: 'flu_vaccine', label: 'Flu vaccination' },
      ],
      [{ id: 'sub-1', submission_data: { pony_name: 'Bramble', flu_vaccine: '2026-03-02' } }]
    );

    const [sheet] = await sheetsOf(await service.exportEntriesToExcel('event-1'));

    /*
     * What the sheet is about on the left, the administration on the right.
     * A club reading a class list wants the date, the name and the answers to
     * its own questions; the email, the payment method and who entered are
     * looked up rather than scanned. Status is last, being the column most
     * often sorted on.
     */
    expect(sheet.headers).toEqual([
      'Entry Date',
      'Name',
      'Pony name',
      'Flu vaccination',
      'Email',
      'Payment Method',
      'Entered By',
      'Entry ID',
      'Status',
    ]);
    expect(sheet.rows[0]).toContain('Bramble');
    expect(sheet.rows[0]).toContain('2026-03-02');
  });

  it('keeps the columns in the order the form asks them', async () => {
    // A sheet whose columns are in a different order from the form is a sheet
    // somebody has to read twice.
    exporting(
      [entryRow({ form_submission_id: 'sub-1' })],
      [
        { activity_id: 'act-1', field_name: 'a', label: 'Asked first' },
        { activity_id: 'act-1', field_name: 'b', label: 'Asked second' },
      ],
      [{ id: 'sub-1', submission_data: { a: '1', b: '2' } }]
    );

    const [sheet] = await sheetsOf(await service.exportEntriesToExcel('event-1'));

    expect(sheet.headers.slice(2, 4)).toEqual(['Asked first', 'Asked second']);
  });

  it('leaves an unanswered question blank rather than shifting the row', async () => {
    /*
     * The column exists because the *form* asks it, not because somebody
     * answered — otherwise the sheet's columns change shape with its rows and
     * two entries stop lining up.
     */
    exporting(
      [entryRow({ form_submission_id: 'sub-1' })],
      [
        { activity_id: 'act-1', field_name: 'pony_name', label: 'Pony name' },
        { activity_id: 'act-1', field_name: 'notes', label: 'Medical notes' },
      ],
      [{ id: 'sub-1', submission_data: { pony_name: 'Bramble' } }]
    );

    const [sheet] = await sheetsOf(await service.exportEntriesToExcel('event-1'));

    expect(sheet.headers).toHaveLength(9);
    expect(sheet.rows[0]).toHaveLength(9);
    // The unanswered question, in its own column rather than shifting the row.
    expect(sheet.headers[3]).toBe('Medical notes');
    expect(sheet.rows[0][3]).toBe('');
  });

  it('writes an answer the way the member’s own screens read it', async () => {
    // `true` and `['a','b']` are not what a club wants in a cell.
    exporting(
      [entryRow({ form_submission_id: 'sub-1' })],
      [
        { activity_id: 'act-1', field_name: 'first_aider', label: 'First aider' },
        { activity_id: 'act-1', field_name: 'days', label: 'Days attending' },
      ],
      [{ id: 'sub-1', submission_data: { first_aider: true, days: ['Sat', 'Sun'] } }]
    );

    const [sheet] = await sheetsOf(await service.exportEntriesToExcel('event-1'));

    expect(sheet.rows[0]).toContain('Yes');
    expect(sheet.rows[0]).toContain('Sat, Sun');
  });

  /**
   * The name as it was given.
   *
   * It is typed as one string into "Who is this entry for?" and split at the
   * first space only so the schema has somewhere to put it. Two columns present
   * that split as though the club had asked for it — and a name with two words
   * after the first, or only one word at all, comes out looking wrong.
   */
  it('shows the name as one column, the way it was typed', async () => {
    exporting([entryRow({ first_name: 'Áine', last_name: 'de Búrca' })]);

    const [sheet] = await sheetsOf(await service.exportEntriesToExcel('event-1'));

    expect(sheet.headers[1]).toBe('Name');
    expect(sheet.rows[0][1]).toBe('Áine de Búrca');
  });

  /**
   * Who made the entry, which is not who it is for.
   *
   * A parent enters three children, a secretary enters half the club — and the
   * email on the entry is the account holder's too, which is why the two sit
   * together.
   */
  it('names the account holder who made the entry', async () => {
    exporting([
      entryRow({
        first_name: 'Rónán',
        last_name: 'McGrath',
        entered_by_name: 'Áine McGrath',
        email: 'aine@example.test',
      }),
    ]);

    const [sheet] = await sheetsOf(await service.exportEntriesToExcel('event-1'));

    // By name rather than by index: the tail sits after however many questions
    // the club's form asks.
    const column = sheet.headers.indexOf('Entered By');
    expect(sheet.rows[0][column]).toBe('Áine McGrath');
    // The entrant is still the entrant.
    expect(sheet.rows[0][1]).toBe('Rónán McGrath');
  });

  it('leaves the column blank where the account has since been removed', async () => {
    // The entry happened; the login behind it may not still exist.
    exporting([entryRow({ entered_by_name: null })]);

    const [sheet] = await sheetsOf(await service.exportEntriesToExcel('event-1'));

    expect(sheet.rows[0][sheet.headers.indexOf('Entered By')]).toBe('');
  });

  it('ends with the status, and asks for it by that name', async () => {
    // "Payment Status" in a column of paid/pending is a longer word for the
    // same thing, and it is the column most often sorted on.
    exporting([entryRow({ payment_status: 'pending' })]);

    const [sheet] = await sheetsOf(await service.exportEntriesToExcel('event-1'));

    expect(sheet.headers.at(-1)).toBe('Status');
    expect(sheet.rows[0].at(-1)).toBe('pending');
  });

  it('has no quantity column', async () => {
    // One on every entry, which said nothing.
    exporting([entryRow()]);

    const [sheet] = await sheetsOf(await service.exportEntriesToExcel('event-1'));

    expect(sheet.headers).not.toContain('Quantity');
  });

  it('does not leave a gap for a name of one word', async () => {
    // An open activity accepts one — and it arrived as a first name with an
    // empty "Last Name" beside it.
    exporting([entryRow({ first_name: 'Bramble', last_name: '' })]);

    const [sheet] = await sheetsOf(await service.exportEntriesToExcel('event-1'));

    expect(sheet.rows[0][1]).toBe('Bramble');
  });

  it('gives each activity its own form’s columns', async () => {
    /*
     * Two activities of one event may ask entirely different questions — an
     * entry form and a spectator's car pass — so the columns belong to the
     * sheet, not to the workbook.
     */
    exporting(
      [
        entryRow({ form_submission_id: 'sub-1' }),
        entryRow({
          id: 'entry-2',
          event_activity_id: 'act-2',
          activity_name: 'Spectator car pass',
          form_submission_id: 'sub-2',
        }),
      ],
      [
        { activity_id: 'act-1', field_name: 'pony_name', label: 'Pony name' },
        { activity_id: 'act-2', field_name: 'registration', label: 'Car registration' },
      ],
      [
        { id: 'sub-1', submission_data: { pony_name: 'Bramble' } },
        { id: 'sub-2', submission_data: { registration: '08-KE-1234' } },
      ]
    );

    const sheets = await sheetsOf(await service.exportEntriesToExcel('event-1'));

    expect(sheets.map((sheet) => sheet.name)).toEqual(['Intermediate', 'Spectator car pass']);
    expect(sheets[0].headers).toContain('Pony name');
    expect(sheets[0].headers).not.toContain('Car registration');
    expect(sheets[1].headers).toContain('Car registration');
  });

  it('keeps two activities of the same name apart', async () => {
    // A two-day event runs "80cm" on both days; merged, the sheet is a class
    // list no class ever had.
    exporting(
      [
        entryRow({ event_activity_id: 'sat' }),
        entryRow({ id: 'entry-2', event_activity_id: 'sun' }),
      ],
      []
    );

    const sheets = await sheetsOf(await service.exportEntriesToExcel('event-1'));

    // Numbered, because exceljs *throws* on a duplicate sheet name — the whole
    // export failed rather than losing a sheet.
    expect(sheets.map((sheet) => sheet.name)).toEqual(['Intermediate', 'Intermediate (2)']);
  });

  it('carries an entry with no form at all', async () => {
    // An activity that asks nothing still has entrants.
    exporting([entryRow({ form_submission_id: null })], []);

    const [sheet] = await sheetsOf(await service.exportEntriesToExcel('event-1'));

    expect(sheet.headers).toHaveLength(7);
    expect(sheet.rows[0]).toContain('Áine McGrath');
  });

  it('produces one for an event nobody entered', async () => {
    // A workbook with only headers is still a workbook; an empty file is not.
    exporting([]);

    const buffer = await service.exportEntriesToExcel('event-1');

    expect(buffer.subarray(0, 4).toString('hex')).toBe('504b0304');
  });
});

/**
 * Correcting an entry.
 *
 * The club's remedy for a member's mistake — the entrant's name typed in a
 * hurry, a vaccination date a year out — which until now meant the database.
 */
describe('updateEntryAnswers', () => {
  const form = {
    id: 'form-1',
    organisationId: 'org-1',
    fields: [
      { id: 'f1', name: 'pony_name', label: 'Pony name', datatype: 'text', validation: {} },
    ],
  };

  const entryRow = (over: Record<string, unknown> = {}) => ({
    ...row(),
    application_form_id: 'form-1',
    submission_data: { pony_name: 'Bramble' },
    ...over,
  });

  beforeEach(() => {
    (applicationFormService.getApplicationFormWithFields as jest.Mock).mockResolvedValue(form);
    (formSubmissionService.updateSubmission as jest.Mock).mockResolvedValue({ id: 'sub-1' });
    (formSubmissionService.createSubmission as jest.Mock).mockResolvedValue({ id: 'sub-new' });
  });

  it('stores the corrected answers against the existing submission', async () => {
    mockDb.query.mockResolvedValue({ rows: [entryRow()] } as never);

    await service.updateEntryAnswers('event-1', 'entry-1', { pony_name: 'Cloud' });

    expect(formSubmissionService.updateSubmission).toHaveBeenCalledWith('sub-1', {
      submissionData: { pony_name: 'Cloud' },
    });
  });

  it('refuses an entry belonging to another event', async () => {
    /*
     * The guard on the route authorises the *event*. Without this an entry id
     * from another club could be corrected by naming one of your own events —
     * and a 404 rather than a 403, because confirming the id exists is the leak.
     */
    mockDb.query.mockResolvedValue({
      rows: [entryRow({ event_id: 'somebody-elses-event' })],
    } as never);

    await expect(
      service.updateEntryAnswers('event-1', 'entry-1', { pony_name: 'Cloud' })
    ).rejects.toThrow(/not found/i);
    expect(formSubmissionService.updateSubmission).not.toHaveBeenCalled();
  });

  it('checks the answers against the form before storing them', async () => {
    // An administrator typing into a date box produces nonsense as readily as
    // anybody else, and a bad submission is a bad record, not a bad screen.
    (applicationFormService.getApplicationFormWithFields as jest.Mock).mockResolvedValue({
      ...form,
      fields: [
        { id: 'f2', name: 'dob', label: 'Date of birth', datatype: 'date', validation: {} },
      ],
    });
    mockDb.query.mockResolvedValue({ rows: [entryRow()] } as never);

    await expect(
      service.updateEntryAnswers('event-1', 'entry-1', { dob: 'sometime in May' })
    ).rejects.toThrow(/need correcting/i);
    expect(formSubmissionService.updateSubmission).not.toHaveBeenCalled();
  });

  it('creates a submission for an entry made before the form existed', async () => {
    // Refusing would leave the screen offering an edit that cannot be saved.
    mockDb.query.mockResolvedValue({
      rows: [entryRow({ form_submission_id: null, submission_data: null })],
    } as never);

    await service.updateEntryAnswers('event-1', 'entry-1', { pony_name: 'Cloud' });

    expect(formSubmissionService.createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ formId: 'form-1', submissionData: { pony_name: 'Cloud' } })
    );
    const linked = mockDb.query.mock.calls.find((call) =>
      String(call[0]).includes('SET form_submission_id')
    );
    expect(linked?.[1]).toEqual(['sub-new', 'entry-1']);
  });

  it('corrects the entrant’s name, splitting it the way an entry is stored', async () => {
    mockDb.query.mockResolvedValue({ rows: [entryRow()] } as never);

    await service.updateEntryAnswers('event-1', 'entry-1', {}, 'Áine de Búrca');

    const update = mockDb.query.mock.calls.find((call) =>
      String(call[0]).includes('SET first_name')
    );
    // Split at the first space only, as `splitName` does everywhere else.
    expect(update?.[1]).toEqual(['Áine', 'de Búrca', 'entry-1']);
  });

  it('refuses to leave the entrant list with a blank row', async () => {
    mockDb.query.mockResolvedValue({ rows: [entryRow()] } as never);

    await expect(
      service.updateEntryAnswers('event-1', 'entry-1', {}, '   ')
    ).rejects.toThrow(/name of the person/i);
  });

  it('leaves the name alone when none was sent', async () => {
    // Correcting an answer is not renaming anybody.
    mockDb.query.mockResolvedValue({ rows: [entryRow()] } as never);

    await service.updateEntryAnswers('event-1', 'entry-1', { pony_name: 'Cloud' });

    expect(
      mockDb.query.mock.calls.some((call) => String(call[0]).includes('SET first_name'))
    ).toBe(false);
  });

  /**
   * A refusal leaves the entry exactly as it was.
   *
   * The name and the answers are corrected in one sitting, so a half-applied
   * correction is worse than none: renaming before validating meant a rejected
   * form still renamed the entrant, and the club was shown an error over a
   * screen that had already changed underneath it.
   */
  it('does not rename anybody when the answers are refused', async () => {
    (applicationFormService.getApplicationFormWithFields as jest.Mock).mockResolvedValue({
      ...form,
      fields: [
        { id: 'f2', name: 'dob', label: 'Date of birth', datatype: 'date', validation: {} },
      ],
    });
    mockDb.query.mockResolvedValue({ rows: [entryRow()] } as never);

    await expect(
      service.updateEntryAnswers(
        'event-1',
        'entry-1',
        { dob: 'sometime in May' },
        'Áine de Búrca'
      )
    ).rejects.toThrow(/need correcting/i);

    expect(
      mockDb.query.mock.calls.some((call) => String(call[0]).includes('SET first_name'))
    ).toBe(false);
  });

  it('refuses answers for an activity that asks nothing, and renames nobody', async () => {
    mockDb.query.mockResolvedValue({
      rows: [entryRow({ application_form_id: null })],
    } as never);

    await expect(
      service.updateEntryAnswers('event-1', 'entry-1', { pony_name: 'Cloud' }, 'Bríd McNamara')
    ).rejects.toThrow(/no form/i);
    expect(
      mockDb.query.mock.calls.some((call) => String(call[0]).includes('SET first_name'))
    ).toBe(false);
  });

  it('corrects the name on an activity that asks nothing', async () => {
    // The commoner mistake, and the one an activity with no form still has.
    mockDb.query.mockResolvedValue({
      rows: [entryRow({ application_form_id: null })],
    } as never);

    await expect(
      service.updateEntryAnswers('event-1', 'entry-1', {}, 'Bríd McNamara')
    ).resolves.toBeDefined();
  });
});
