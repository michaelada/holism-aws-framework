import { entrantService } from '../entrant.service';
import { db } from '../../database/pool';
import * as catalogue from '../account-catalogue.service';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

const mockDb = db as jest.Mocked<typeof db>;
const ORG = 'org-1';
const OU = 'ou-1';
const ACTIVITY = 'act-1';

/**
 * The names offered under the entry form's name field.
 *
 * Two lists, because they answer different questions: who this account may
 * enter (its memberships) and who it has entered (the names on its past
 * entries). A parent re-entering three children every fortnight was retyping
 * all three.
 */
describe('entrantSuggestions', () => {
  const eligibility = (value: string) => ({ rows: [{ entry_eligibility: value }] } as any);
  const recent = (rows: any[]) => ({ rows } as any);

  beforeEach(() => {
    mockDb.query.mockReset();
    jest.restoreAllMocks();
  });

  it('offers the account’s memberships, with what each one is', async () => {
    jest.spyOn(catalogue, 'activeMembershipsFor').mockResolvedValue([
      { id: 'm-1', name: 'Rónán McGrath', membershipTypeName: 'Junior Member', membershipNumber: '1001' },
    ]);
    mockDb.query.mockResolvedValueOnce(eligibility('all')).mockResolvedValueOnce(recent([]));

    const result = await entrantService.entrantSuggestions(ORG, OU, ACTIVITY);

    expect(result.memberships).toEqual([
      { name: 'Rónán McGrath', memberId: 'm-1', detail: 'Junior Member' },
    ]);
  });

  it('names the club instead when the membership is with another one', async () => {
    // In a federation-wide entry, which club the membership is with is the
    // thing that distinguishes two members of the same name.
    jest.spyOn(catalogue, 'activeMembershipsAcrossType').mockResolvedValue([
      {
        id: 'm-2',
        name: 'Sarah Byrne',
        membershipTypeName: 'Senior Member',
        membershipNumber: '2002',
        organisationName: 'Ward Union Pony Club',
      },
    ]);
    mockDb.query
      .mockResolvedValueOnce(eligibility('org-type-members'))
      .mockResolvedValueOnce(recent([]));

    const result = await entrantService.entrantSuggestions(ORG, OU, ACTIVITY);

    expect(result.memberships[0].detail).toBe('Ward Union Pony Club');
  });

  it('scopes memberships the way the activity does', async () => {
    const own = jest.spyOn(catalogue, 'activeMembershipsFor').mockResolvedValue([]);
    const across = jest.spyOn(catalogue, 'activeMembershipsAcrossType').mockResolvedValue([]);
    mockDb.query.mockResolvedValueOnce(eligibility('members')).mockResolvedValueOnce(recent([]));

    await entrantService.entrantSuggestions(ORG, OU, ACTIVITY);

    // Suggesting a name the activity would then refuse is worse than none.
    expect(own).toHaveBeenCalled();
    expect(across).not.toHaveBeenCalled();
  });

  it('offers recently used names, most recent first', async () => {
    jest.spyOn(catalogue, 'activeMembershipsFor').mockResolvedValue([]);
    mockDb.query.mockResolvedValueOnce(eligibility('all')).mockResolvedValueOnce(
      recent([
        { first_name: 'Tadhg', last_name: 'Nolan', member_id: null },
        { first_name: 'Fionn', last_name: 'Doyle', member_id: 'm-9' },
      ])
    );

    const result = await entrantService.entrantSuggestions(ORG, OU, ACTIVITY);

    expect(result.recent.map((r) => r.name)).toEqual(['Tadhg Nolan', 'Fionn Doyle']);
    // A typed name has nothing behind it; a member's keeps its id so the
    // suggestion can select the membership rather than only fill the box.
    expect(result.recent[0].memberId).toBeNull();
    expect(result.recent[1].memberId).toBe('m-9');
  });

  it('asks for five, and only this account’s entries', async () => {
    jest.spyOn(catalogue, 'activeMembershipsFor').mockResolvedValue([]);
    mockDb.query.mockResolvedValueOnce(eligibility('all')).mockResolvedValueOnce(recent([]));

    await entrantService.entrantSuggestions(ORG, OU, ACTIVITY);

    const [sql, params] = mockDb.query.mock.calls[1];
    expect(String(sql)).toContain('LIMIT 5');
    expect(String(sql)).toContain('user_id = $1');
    expect(params).toEqual([OU]);
  });

  /*
   * The two lists sit one above the other. The same name in both reads as two
   * different people, and costs a fifth of a list sized for five.
   */
  it('does not repeat a name that is already offered as a membership', async () => {
    jest.spyOn(catalogue, 'activeMembershipsFor').mockResolvedValue([
      { id: 'm-1', name: 'Rónán McGrath', membershipTypeName: 'Junior Member', membershipNumber: '1001' },
    ]);
    mockDb.query.mockResolvedValueOnce(eligibility('all')).mockResolvedValueOnce(
      recent([
        { first_name: 'Rónán', last_name: 'McGrath', member_id: 'm-1' },
        { first_name: 'Tadhg', last_name: 'Nolan', member_id: null },
      ])
    );

    const result = await entrantService.entrantSuggestions(ORG, OU, ACTIVITY);

    expect(result.recent.map((r) => r.name)).toEqual(['Tadhg Nolan']);
  });

  it('refuses an activity belonging to another club', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

    await expect(entrantService.entrantSuggestions(ORG, OU, ACTIVITY)).rejects.toThrow(
      /could not be found/i
    );
  });
});
