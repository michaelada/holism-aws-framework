/**
 * Who an event entry can be for.
 *
 * Two things are load-bearing here and the tests are mostly about them.
 *
 * The first is that **scope comes from the activity**, never from the caller. A
 * client that could name its own scope could ask an open club event for the
 * federation-wide roster, and the difference between "my club's members" and
 * "every club's members" is the whole of the members-only feature.
 *
 * The second is that the list offered and the list accepted are the *same*
 * list. `searchEntrants` decides what a member sees and `resolveEntrant`
 * decides what the server will take; if those two ever disagreed, a name could
 * be chosen from the dropdown and then refused on submit — or, far worse,
 * accepted when it should not have been.
 *
 * See docs/ENTRANT_NAME.md.
 */

jest.mock('../../config/logger');
jest.mock('../../database/pool', () => ({ db: { query: jest.fn() } }));

import { db } from '../../database/pool';
import { entrantService, splitName, MIN_QUERY } from '../entrant.service';
import { ValidationError } from '../../middleware/errors';

const mockDb = db as jest.Mocked<typeof db>;

const ORG = 'org-1';
const ACTIVITY = 'act-1';

const memberRow = (over: Record<string, any> = {}) => ({
  id: 'mem-1',
  first_name: 'Saoirse',
  last_name: 'Brennan',
  membership_number: '100002',
  membership_type_name: 'Junior Member',
  organisation_id: ORG,
  organisation_name: 'Kildare Hunt Pony Club',
  already_entered: false,
  ...over,
});

/** The eligibility lookup every method makes first. */
const eligibility = (value: string) => ({ rows: [{ entry_eligibility: value }] });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('the scope a name is completed against', () => {
  it('is the club for an open activity', async () => {
    mockDb.query
      .mockResolvedValueOnce(eligibility('all') as any)
      .mockResolvedValueOnce({ rows: [memberRow()] } as any);

    await entrantService.searchEntrants(ORG, ACTIVITY, 'bre');

    const sql = mockDb.query.mock.calls[1][0] as string;
    expect(sql).toContain('m.organisation_id = $1');
    expect(sql).not.toContain('organization_type_id');
  });

  it('is the club for a members-only activity', async () => {
    mockDb.query
      .mockResolvedValueOnce(eligibility('members') as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    await entrantService.searchEntrants(ORG, ACTIVITY, 'bre');

    expect(mockDb.query.mock.calls[1][0] as string).toContain('m.organisation_id = $1');
  });

  it('widens to the whole organisation type only where the activity says so', async () => {
    mockDb.query
      .mockResolvedValueOnce(eligibility('org-type-members') as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    await entrantService.searchEntrants(ORG, ACTIVITY, 'bre');

    expect(mockDb.query.mock.calls[1][0] as string).toContain('organization_type_id');
  });

  it('refuses an activity belonging to another club rather than defaulting', async () => {
    /*
     * The eligibility lookup is joined to the host organisation, so a missing
     * row means "not yours" as much as "not there". Defaulting to `all` here
     * would answer with a roster for an event that is not theirs.
     */
    mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

    await expect(entrantService.searchEntrants(ORG, ACTIVITY, 'bre')).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('never lets an unrecognised eligibility widen the scope', async () => {
    // A value outside the constraint should fail closed, to the narrow scope.
    mockDb.query
      .mockResolvedValueOnce(eligibility('something-new') as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    await entrantService.searchEntrants(ORG, ACTIVITY, 'bre');

    expect(mockDb.query.mock.calls[1][0] as string).not.toContain('organization_type_id');
  });
});

describe('what comes back', () => {
  it('only counts a membership that is both active and unexpired', async () => {
    /*
     * `status` alone is not enough: a lapsed membership keeps `status =
     * 'active'` until something sweeps it, so a rally in July would accept a
     * card that expired in March.
     */
    mockDb.query
      .mockResolvedValueOnce(eligibility('members') as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    await entrantService.searchEntrants(ORG, ACTIVITY, 'bre');

    const sql = mockDb.query.mock.calls[1][0] as string;
    expect(sql).toContain("m.status = 'active'");
    expect(sql).toContain('m.valid_until >=');
  });

  it('names the member’s own club only when it is not the host', async () => {
    // Two members called Sarah Byrne in a federation-wide rally are otherwise
    // identical rows.
    mockDb.query.mockResolvedValueOnce(eligibility('org-type-members') as any).mockResolvedValueOnce(
      {
        rows: [
          memberRow(),
          memberRow({
            id: 'mem-2',
            organisation_id: 'org-2',
            organisation_name: 'Laois Hunt Pony Club',
          }),
        ],
      } as any
    );

    const results = await entrantService.searchEntrants(ORG, ACTIVITY, 'bre');

    expect(results[0].organisationName).toBeNull();
    expect(results[1].organisationName).toBe('Laois Hunt Pony Club');
  });

  it('matches on membership number as well as name', async () => {
    // A secretary working from a paper list has the number, not the spelling.
    mockDb.query
      .mockResolvedValueOnce(eligibility('members') as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    await entrantService.searchEntrants(ORG, ACTIVITY, '100002');

    expect(mockDb.query.mock.calls[1][0] as string).toContain('m.membership_number ILIKE');
  });

  it('marks someone already entered rather than hiding them', async () => {
    // A name missing from the list reads as a bug; a disabled row answers the
    // question the member was about to ask.
    mockDb.query
      .mockResolvedValueOnce(eligibility('members') as any)
      .mockResolvedValueOnce({ rows: [memberRow({ already_entered: true })] } as any);

    const results = await entrantService.searchEntrants(ORG, ACTIVITY, 'bre');

    expect(results).toHaveLength(1);
    expect(results[0].alreadyEntered).toBe(true);
  });
});

describe('the short-query floor', () => {
  it('answers nothing, without going near the database', async () => {
    /*
     * One letter would return most of the club, which turns a name field into a
     * roster download. Refused before the eligibility lookup so it costs
     * nothing at all.
     */
    const results = await entrantService.searchEntrants(ORG, ACTIVITY, 'b');

    expect(results).toEqual([]);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('treats whitespace as nothing typed', async () => {
    expect(await entrantService.searchEntrants(ORG, ACTIVITY, '   ')).toEqual([]);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('lets the agreed minimum through', async () => {
    mockDb.query
      .mockResolvedValueOnce(eligibility('members') as any)
      .mockResolvedValueOnce({ rows: [memberRow()] } as any);

    const results = await entrantService.searchEntrants(ORG, ACTIVITY, 'b'.repeat(MIN_QUERY));

    expect(results).toHaveLength(1);
  });
});

describe('accepting a chosen member', () => {
  it('applies the same scope the search used', async () => {
    /*
     * This is the property that matters most in this file. The search decides
     * what is offered; a caller posting straight to the cart never ran it.
     */
    mockDb.query
      .mockResolvedValueOnce(eligibility('members') as any)
      .mockResolvedValueOnce({ rows: [memberRow()] } as any);

    await entrantService.resolveEntrant(ORG, ACTIVITY, 'mem-1');

    const sql = mockDb.query.mock.calls[1][0] as string;
    expect(sql).toContain('m.organisation_id = $1');
    expect(sql).toContain("m.status = 'active'");
    expect(sql).toContain('m.valid_until >=');
  });

  it('refuses a member outside the activity’s scope', async () => {
    // A member of another club, on a club-only activity: the row simply is not
    // in scope, so nothing comes back and the caller refuses the line.
    mockDb.query
      .mockResolvedValueOnce(eligibility('members') as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    expect(await entrantService.resolveEntrant(ORG, ACTIVITY, 'mem-elsewhere')).toBeNull();
  });

  it('accepts a member of another club when the activity is federation-wide', async () => {
    mockDb.query
      .mockResolvedValueOnce(eligibility('org-type-members') as any)
      .mockResolvedValueOnce({
        rows: [memberRow({ organisation_id: 'org-2', organisation_name: 'Laois Hunt Pony Club' })],
      } as any);

    const member = await entrantService.resolveEntrant(ORG, ACTIVITY, 'mem-1');

    expect(member?.organisationName).toBe('Laois Hunt Pony Club');
  });
});

describe('whether the field completes at all', () => {
  it('does not, for a club that does not run memberships', async () => {
    // A plain text box is the right answer here, not a degraded one — and the
    // roster query is not run at all.
    mockDb.query
      .mockResolvedValueOnce(eligibility('all') as any)
      .mockResolvedValueOnce({ rows: [] } as any); // no capability

    const mode = await entrantService.fieldMode(ORG, ACTIVITY);

    expect(mode.autocomplete).toBe(false);
    expect(mockDb.query).toHaveBeenCalledTimes(2);
  });

  it('does not, for a club that runs memberships but has no active member yet', async () => {
    mockDb.query
      .mockResolvedValueOnce(eligibility('all') as any)
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any) // capability
      .mockResolvedValueOnce({ rows: [] } as any); // nobody active

    expect((await entrantService.fieldMode(ORG, ACTIVITY)).autocomplete).toBe(false);
  });

  it('tests for members in the same scope it will search', async () => {
    /*
     * Asking whether the *host* club has members would offer a plain text box
     * on a federation-wide rally run by a small branch, while the roster it
     * would have completed against sat in the other twenty clubs.
     */
    mockDb.query
      .mockResolvedValueOnce(eligibility('org-type-members') as any)
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any)
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any);

    const mode = await entrantService.fieldMode(ORG, ACTIVITY);

    expect(mode.autocomplete).toBe(true);
    expect(mockDb.query.mock.calls[2][0] as string).toContain('organization_type_id');
  });

  it('allows a typed name only where entries are open to all', async () => {
    const modeFor = async (value: string) => {
      mockDb.query.mockReset();
      mockDb.query
        .mockResolvedValueOnce(eligibility(value) as any)
        .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any)
        .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any);
      return entrantService.fieldMode(ORG, ACTIVITY);
    };

    expect((await modeFor('all')).allowFreeText).toBe(true);
    expect((await modeFor('members')).allowFreeText).toBe(false);
    expect((await modeFor('org-type-members')).allowFreeText).toBe(false);
  });
});

describe('splitting a typed name for storage', () => {
  /*
   * `event_entries` keeps first and last in separate NOT NULL columns, so a
   * typed name has to become two values and neither may be null.
   */
  it('splits on the first space, keeping a compound surname whole', () => {
    expect(splitName("Mary O'Brien Kelly")).toEqual({
      firstName: 'Mary',
      lastName: "O'Brien Kelly",
    });
  });

  it('treats a single word as a whole name rather than rejecting it', () => {
    // Mononyms exist, and a club may legitimately enter a pony called Bluebell.
    expect(splitName('Bluebell')).toEqual({ firstName: 'Bluebell', lastName: '' });
  });

  it('tolerates the spacing people actually type', () => {
    expect(splitName('  Saoirse   Brennan  ')).toEqual({
      firstName: 'Saoirse',
      lastName: 'Brennan',
    });
  });

  it('yields empty strings rather than null for an empty name', () => {
    // Both columns are NOT NULL; a null here would fail the insert instead of
    // being caught by the validation that is supposed to catch it.
    expect(splitName('')).toEqual({ firstName: '', lastName: '' });
  });
});
