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

/**
 * The names offered under a **membership application's** name field.
 *
 * The application asks the same question an entry does — who is this for — and
 * the answer comes from the same two places: the people this account already
 * holds memberships for, and the names it has used on entries.
 *
 * What it does **not** do is search the club's roster. An application creates a
 * membership rather than resolving to one, and offering other families' names
 * would be neither useful nor anybody's business.
 */
describe('applicantSuggestions', () => {
  const TYPE = 'type-1';
  const found = { rows: [{ '?column?': 1 }] } as any;

  beforeEach(() => {
    mockDb.query.mockReset();
  });

  it('offers the people this account already holds memberships for', async () => {
    mockDb.query
      .mockResolvedValueOnce(found)
      .mockResolvedValueOnce({
        rows: [
          { id: 'm-1', first_name: 'Rónán', last_name: 'McGrath', membership_type_name: 'Junior Member', status: 'active' },
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const result = await entrantService.applicantSuggestions(ORG, OU, TYPE);

    expect(result.memberships).toEqual([
      {
        name: 'Rónán McGrath',
        memberId: null,
        fillFromMembershipId: 'm-1',
        detail: 'Junior Member',
      },
    ]);
  });

  it('offers a lapsed membership too, which is who they are renewing', async () => {
    // Hiding it hides exactly the name they are about to type.
    mockDb.query
      .mockResolvedValueOnce(found)
      .mockResolvedValueOnce({
        rows: [
          { id: 'm-1', first_name: 'Éabha', last_name: 'McGrath', membership_type_name: 'Junior Member', status: 'elapsed' },
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const result = await entrantService.applicantSuggestions(ORG, OU, TYPE);

    expect(result.memberships.map((m) => m.name)).toEqual(['Éabha McGrath']);
  });

  it('carries no membership id, because this is not a renewal', async () => {
    /*
     * On an entry the id proves eligibility. Here it would read as "renew this
     * one", which is a different journey with its own route.
     */
    mockDb.query
      .mockResolvedValueOnce(found)
      .mockResolvedValueOnce({
        rows: [{ id: 'm-1', first_name: 'Rónán', last_name: 'McGrath', membership_type_name: 'Junior', status: 'active' }],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const result = await entrantService.applicantSuggestions(ORG, OU, TYPE);

    expect(result.memberships[0].memberId).toBeNull();
  });

  it('says which membership each name’s answers can be copied from', async () => {
    /*
     * Distinct from `memberId`, and the distinction is the point. That field
     * says "this record is for that member"; this one says "the club already
     * holds this person's answers", which is what lets the form fill itself in
     * when the applicant is chosen — and fill in *again* when a different one
     * is, instead of leaving the first person's details under the second's
     * name.
     */
    mockDb.query
      .mockResolvedValueOnce(found)
      .mockResolvedValueOnce({
        rows: [
          { id: 'm-1', first_name: 'Áine', last_name: 'McGrath', membership_type_name: 'Senior', status: 'active' },
          { id: 'm-2', first_name: 'Rónán', last_name: 'McGrath', membership_type_name: 'Junior', status: 'active' },
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const result = await entrantService.applicantSuggestions(ORG, OU, TYPE);

    expect(result.memberships.map((m) => m.fillFromMembershipId)).toEqual(['m-1', 'm-2']);
  });

  it('offers the names used on past entries as well', async () => {
    mockDb.query
      .mockResolvedValueOnce(found)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({
        rows: [{ first_name: 'Bríd', last_name: 'McNamara', member_id: null }],
      } as any);

    const result = await entrantService.applicantSuggestions(ORG, OU, TYPE);

    expect(result.recent).toEqual([{ name: 'Bríd McNamara', memberId: null, detail: null }]);
    // A name used once on an entry has no application on file to copy.
    expect(result.recent[0].fillFromMembershipId).toBeUndefined();
  });

  it('does not offer the same name in both lists', async () => {
    // They sit one above the other; the same name in both reads as two people.
    mockDb.query
      .mockResolvedValueOnce(found)
      .mockResolvedValueOnce({
        rows: [{ id: 'm-1', first_name: 'Rónán', last_name: 'McGrath', membership_type_name: 'Junior', status: 'active' }],
      } as any)
      .mockResolvedValueOnce({
        rows: [{ first_name: 'rónán', last_name: 'mcgrath', member_id: null }],
      } as any);

    const result = await entrantService.applicantSuggestions(ORG, OU, TYPE);

    expect(result.recent).toEqual([]);
  });

  it('never searches the club’s roster', async () => {
    mockDb.query
      .mockResolvedValueOnce(found)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    await entrantService.applicantSuggestions(ORG, OU, TYPE);

    // Only this account's own members are read: every query naming `members`
    // is filtered by the caller's own user id.
    // `FROM members ` with the space: `membership_types` starts the same way,
    // and the type check is a legitimate read that names no member.
    for (const [sql, params] of mockDb.query.mock.calls) {
      if (String(sql).includes('FROM members ')) {
        expect(String(sql)).toContain('m.user_id = $1');
        expect(params).toContain(OU);
      }
    }
  });

  it('refuses a membership type belonging to another club', async () => {
    // The caller's own names, but the URL should not be a way to ask a club
    // they have nothing to do with.
    mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

    await expect(entrantService.applicantSuggestions(ORG, OU, TYPE)).rejects.toThrow(
      /could not be found/i
    );
  });
});
