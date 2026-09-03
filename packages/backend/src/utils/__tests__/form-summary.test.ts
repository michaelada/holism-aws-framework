/**
 * Stored answers, joined back to the questions that produced them.
 *
 * `submission_data` is keyed by field name and holds raw values; the labels
 * live on the form. Only joining the two produces "Pony name: Bramble" rather
 * than `{"pony_name":"Bramble"}`.
 */

jest.mock('../../database/pool', () => ({ db: { query: jest.fn() } }));

import { db } from '../../database/pool';
import { formSummariesFor, formatAnswer } from '../form-summary';

const mockDb = db as jest.Mocked<typeof db>;

const row = (over: Record<string, unknown> = {}) => ({
  submission_id: 'sub-1',
  submission_data: { pony_name: 'Bramble' },
  field_name: 'pony_name',
  label: 'Pony name',
  datatype: 'text',
  order: 1,
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe('formatAnswer', () => {
  it('reads a boolean and a list the way a person writes them', () => {
    // Done on the server so the same answer reads the same wherever it is
    // shown — the basket, the member's own record, the club's export.
    expect(formatAnswer(true)).toBe('Yes');
    expect(formatAnswer(false)).toBe('No');
    expect(formatAnswer(['Sat', 'Sun'])).toBe('Sat, Sun');
  });

  it('treats an unanswered field as empty', () => {
    expect(formatAnswer(null)).toBe('');
    expect(formatAnswer(undefined)).toBe('');
    expect(formatAnswer('   ')).toBe('');
  });
});

describe('formSummariesFor', () => {
  it('carries the field’s datatype with its answer', async () => {
    /*
     * A date is stored as an ISO string, which is right for storing and
     * unreadable on a page. The screen formats it in the viewer's locale — but
     * only if it knows the answer is a date, which is what this carries.
     */
    mockDb.query.mockResolvedValue({
      rows: [
        row({
          field_name: 'rider_dob',
          label: 'Date of birth',
          datatype: 'date',
          submission_data: { rider_dob: '2012-05-04T00:00:00.000Z' },
        }),
      ],
    } as never);

    const summaries = await formSummariesFor(['sub-1']);

    expect(summaries.get('sub-1')).toEqual([
      { label: 'Date of birth', value: '2012-05-04T00:00:00.000Z', datatype: 'date' },
    ]);
  });

  it('leaves an unanswered optional field out', async () => {
    // A summary is for confirming what was said; a list of blanks buries it.
    mockDb.query.mockResolvedValue({
      rows: [row(), row({ field_name: 'notes', label: 'Notes', order: 2 })],
    } as never);

    const summaries = await formSummariesFor(['sub-1']);

    expect(summaries.get('sub-1')).toHaveLength(1);
  });

  it('asks nothing when there are no submissions', async () => {
    await expect(formSummariesFor([null, undefined])).resolves.toEqual(new Map());
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('falls back to the field name where a form has no label', async () => {
    mockDb.query.mockResolvedValue({ rows: [row({ label: null })] } as never);

    expect(summariesValue(await formSummariesFor(['sub-1']))).toBe('pony_name');
  });
});

/** The label of the one answer, for the test above. */
const summariesValue = (summaries: Map<string, Array<{ label: string }>>) =>
  summaries.get('sub-1')![0].label;
