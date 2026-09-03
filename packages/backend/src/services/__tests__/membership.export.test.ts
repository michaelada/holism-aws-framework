/**
 * The member database as a workbook.
 *
 * The button that asks for this used to be `console.log('Exporting
 * members...')`, so the plainest property matters most: it produces a file a
 * spreadsheet can open.
 *
 * After that, the shape. **One sheet per membership type**, each carrying a
 * column for every field of that type's form — because the columns belong to
 * the form, and two types may ask entirely different questions. A single flat
 * table could only hold the union of every form, giving every member a row of
 * blanks under questions their own application never asked.
 */

import { Workbook } from 'exceljs';
import { MembershipService } from '../membership.service';
import { db } from '../../database/pool';

jest.mock('../../database/pool', () => ({ db: { query: jest.fn() } }));
jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const service = new MembershipService();
const query = db.query as jest.Mock;

const ORG = '11111111-1111-4111-8111-111111111111';
const ADULT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FAMILY = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const member = (over: Record<string, unknown> = {}) => ({
  id: '22222222-2222-4222-8222-222222222222',
  organisation_id: ORG,
  membership_type_id: ADULT,
  membership_type_name: 'Adult',
  user_id: 'u1',
  membership_number: 'KHP-0001',
  member_name: 'Saoirse Ní Bhriain',
  first_name: 'Saoirse',
  last_name: 'Ní Bhriain',
  form_submission_id: '33333333-3333-4333-8333-333333333333',
  date_last_renewed: new Date('2026-03-01'),
  status: 'active',
  valid_until: new Date('2027-03-01'),
  labels: ['Committee'],
  processed: true,
  payment_status: 'paid',
  payment_method: 'card',
  created_at: new Date(),
  updated_at: new Date(),
  ...over,
});

/**
 * The three reads the export makes, in order: the members, the form fields per
 * type, then the submissions behind them.
 */
const answering = ({
  members = [member()] as any[],
  fields = [] as any[],
  submissions = [] as any[],
} = {}) => {
  query.mockReset();
  query
    .mockResolvedValueOnce({ rows: members })
    .mockResolvedValueOnce({ rows: fields })
    .mockResolvedValueOnce({ rows: submissions });
};

const field = (membershipTypeId: string, name: string, label: string) => ({
  membership_type_id: membershipTypeId,
  field_name: name,
  label,
});

/** Read the workbook back, so the assertions are about a real file. */
const readBack = async (buffer: Buffer) => {
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer as any);
  return workbook;
};

/** Headers live on row 3: a merged title, a blank, then the header row. */
const headersOf = (sheet: any): string[] =>
  (sheet.getRow(3).values as unknown[]).slice(1).map(String);

const rowValues = (sheet: any, rowNumber: number): unknown[] =>
  (sheet.getRow(rowNumber).values as unknown[]).slice(1);

describe('exporting members', () => {
  it('produces a workbook a spreadsheet can open', async () => {
    answering();

    const workbook = await readBack(await service.exportMembersToExcel(ORG));
    const sheet = workbook.getWorksheet('Adult')!;

    expect(sheet).toBeDefined();
    expect(headersOf(sheet)).toContain('Membership Number');
    // Title, blank, headers, one member.
    expect(sheet.rowCount).toBe(4);
  });

  it('names each sheet after the membership type it holds', async () => {
    answering({
      members: [member(), member({ id: 'm2', membership_type_id: FAMILY, membership_type_name: 'Family' })],
    });

    const workbook = await readBack(await service.exportMembersToExcel(ORG));

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Adult', 'Family']);
  });

  it('gives each type a column for every field of its own form', async () => {
    answering({
      members: [
        member(),
        member({ id: 'm2', membership_type_id: FAMILY, membership_type_name: 'Family',
                 form_submission_id: '44444444-4444-4444-8444-444444444444' }),
      ],
      fields: [
        field(ADULT, 'boatClass', 'Boat class'),
        field(FAMILY, 'children', 'Number of children'),
        field(FAMILY, 'emergency', 'Emergency contact'),
      ],
    });

    const workbook = await readBack(await service.exportMembersToExcel(ORG));

    /*
     * The point of the split: each sheet asks its own questions and neither
     * carries the other's. A single table would give every Adult a blank
     * "Number of children" column.
     */
    expect(headersOf(workbook.getWorksheet('Adult')!)).toContain('Boat class');
    expect(headersOf(workbook.getWorksheet('Adult')!)).not.toContain('Number of children');

    const family = headersOf(workbook.getWorksheet('Family')!);
    expect(family).toContain('Number of children');
    expect(family).toContain('Emergency contact');
    expect(family).not.toContain('Boat class');
  });

  it('fills those columns with what the member answered', async () => {
    answering({
      fields: [field(ADULT, 'boatClass', 'Boat class'), field(ADULT, 'crew', 'Sails with crew')],
      submissions: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          submission_data: { boatClass: 'Laser', crew: true },
        },
      ],
    });

    const workbook = await readBack(await service.exportMembersToExcel(ORG));
    const sheet = workbook.getWorksheet('Adult')!;
    const headers = headersOf(sheet);
    const values = rowValues(sheet, 4);

    expect(values[headers.indexOf('Boat class')]).toBe('Laser');
    // Formatted the way the member's own screens format it, not as `true`.
    expect(values[headers.indexOf('Sails with crew')]).toBe('Yes');
  });

  it('leaves an unanswered question blank rather than dropping the column', async () => {
    answering({
      fields: [field(ADULT, 'boatClass', 'Boat class'), field(ADULT, 'dietary', 'Dietary needs')],
      submissions: [
        { id: '33333333-3333-4333-8333-333333333333', submission_data: { boatClass: 'Laser' } },
      ],
    });

    const workbook = await readBack(await service.exportMembersToExcel(ORG));
    const sheet = workbook.getWorksheet('Adult')!;
    const headers = headersOf(sheet);

    // A question nobody answered still has a column — the club asked it, and
    // a missing column reads as a question never put.
    expect(headers).toContain('Dietary needs');
    expect(rowValues(sheet, 4)[headers.indexOf('Dietary needs')] ?? '').toBe('');
  });

  it('keeps the administration columns either side of the answers', async () => {
    answering({ fields: [field(ADULT, 'boatClass', 'Boat class')] });

    const headers = headersOf((await readBack(await service.exportMembersToExcel(ORG))).getWorksheet('Adult')!);

    expect(headers.slice(0, 4)).toEqual(['Membership Number', 'Name', 'First Name', 'Last Name']);
    expect(headers[4]).toBe('Boat class');
    expect(headers.slice(5)).toEqual([
      'Date Last Renewed',
      'Status',
      'Valid Until',
      'Labels',
      'Processed',
      'Payment Status',
      'Payment Method',
    ]);
  });

  it('gives two types of the same name a sheet each rather than throwing', async () => {
    // exceljs refuses a duplicate sheet name, which would lose the whole
    // export rather than one sheet.
    answering({
      members: [member(), member({ id: 'm2', membership_type_id: FAMILY, membership_type_name: 'Adult' })],
    });

    const workbook = await readBack(await service.exportMembersToExcel(ORG));

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Adult', 'Adult (2)']);
  });

  it('sanitises a type name Excel will not accept', async () => {
    answering({ members: [member({ membership_type_name: 'Junior / Cadet [2026]' })] });

    const workbook = await readBack(await service.exportMembersToExcel(ORG));

    expect(workbook.worksheets[0].name).toBe('Junior _ Cadet _2026_');
  });

  it('writes a date-only value as text, so it cannot walk backwards', async () => {
    /*
     * `date_last_renewed` and `valid_until` are Postgres `date` columns, which
     * node-postgres hands back as a Date at **local midnight**. Written as a
     * Date, a 12 July renewal in Ireland is stored as 2026-07-11T23:00Z and
     * Excel shows 11 July — every date a day early through the summer, and
     * right in the winter, which is how it survives being checked.
     */
    answering({
      members: [
        member({
          date_last_renewed: new Date('2026-07-12T00:00:00'),
          valid_until: new Date('2026-12-31T00:00:00'),
        }),
      ],
    });

    const workbook = await readBack(await service.exportMembersToExcel(ORG));
    const sheet = workbook.getWorksheet('Adult')!;
    const headers = headersOf(sheet);
    const values = rowValues(sheet, 4);

    expect(values[headers.indexOf('Date Last Renewed')]).toBe('2026-07-12');
    expect(values[headers.indexOf('Valid Until')]).toBe('2026-12-31');
  });

  it('leaves a missing date blank rather than printing an epoch', async () => {
    answering({ members: [member({ date_last_renewed: null, valid_until: null })] });

    const workbook = await readBack(await service.exportMembersToExcel(ORG));
    const sheet = workbook.getWorksheet('Adult')!;
    const headers = headersOf(sheet);
    const values = rowValues(sheet, 4);

    expect(values[headers.indexOf('Date Last Renewed')] ?? '').toBe('');
  });

  it('narrows to the ids it was given, and scopes them to the organisation', async () => {
    answering();

    await service.exportMembersToExcel(ORG, ['22222222-2222-4222-8222-222222222222']);

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain('m.id = ANY($2::uuid[])');
    // The organisation is in the statement too, so an id from another club
    // selects nothing rather than exporting somebody else's member.
    expect(sql).toContain('m.organisation_id = $1');
    expect(values).toEqual([ORG, ['22222222-2222-4222-8222-222222222222']]);
  });

  it('exports the whole organisation when it is given no ids', async () => {
    answering();

    await service.exportMembersToExcel(ORG, []);

    const [sql, values] = query.mock.calls[0];
    expect(sql).not.toContain('ANY($2');
    expect(values).toEqual([ORG]);
  });

  it('still opens when nothing matches, and says why', async () => {
    answering({ members: [] });

    const workbook = await readBack(await service.exportMembersToExcel(ORG));

    // A workbook with no sheets cannot be opened at all.
    expect(workbook.worksheets).toHaveLength(1);
    expect(workbook.getWorksheet('Members')!.getCell('A3').value).toBe(
      'No members match the current filters.'
    );
  });

  it('reads every submission in one query rather than one per member', async () => {
    answering({
      members: [member(), member({ id: 'm2', form_submission_id: '44444444-4444-4444-8444-444444444444' })],
    });

    await service.exportMembersToExcel(ORG);

    // Three reads for the whole export, whatever the roster size: the members,
    // the fields, the submissions.
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[2][0]).toContain('ANY($1::uuid[])');
  });
});
