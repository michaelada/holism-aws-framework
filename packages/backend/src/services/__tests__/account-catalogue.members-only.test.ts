/**
 * Members-only activities, from the catalogue's side.
 *
 * The rule is one sentence — an activity marked `members` may be entered only
 * by a login holding an active membership of that club — and almost all the
 * care here is about the cases where a login holds *several*, which is normal
 * rather than exceptional: a parent holds their children's.
 *
 * See docs/MEMBERS_ONLY_ENTRIES.md.
 */

jest.mock('../../config/logger');
jest.mock('../../database/pool', () => ({ db: { query: jest.fn() } }));

import { db } from '../../database/pool';
import { accountCatalogueService } from '../account-catalogue.service';

const mockDb = db as jest.Mocked<typeof db>;

const ORG = 'org-1';
const USER = 'user-1';
const TODAY = new Date('2026-08-20T00:00:00Z');

const eventRow = {
  id: 'ev-1',
  name: 'Spring Show',
  description: null,
  start_date: new Date('2026-09-20'),
  end_date: new Date('2026-09-20'),
  open_date_entries: new Date('2026-08-01'),
  entries_closing_date: new Date('2026-09-15'),
  limit_entries: false,
  entries_limit: null,
  entry_count: '0',
};

const activityRow = (over: Record<string, any> = {}) => ({
  id: 'act-1',
  event_id: 'ev-1',
  name: 'Under-12 Show Jumping',
  description: null,
  fee: '20.00',
  handling_fee_included: false,
  application_form_id: 'form-1',
  allow_specify_quantity: false,
  supported_payment_methods: '[]',
  limit_applicants: false,
  applicants_limit: null,
  use_terms_and_conditions: false,
  terms_and_conditions: null,
  entry_eligibility: 'members',
  entry_count: '0',
  mine: '0',
  ...over,
});

const memberRow = (over: Record<string, any> = {}) => ({
  id: 'mem-1',
  first_name: 'Saoirse',
  last_name: 'Byrne',
  membership_number: 'KHP-0241',
  membership_type_name: 'Junior Member',
  ...over,
});

/**
 * `listEvents` fires a fixed sequence of queries. Dispatching on the SQL rather
 * than on call order keeps these tests readable, and keeps them from breaking
 * when an unrelated query is added between two of them.
 */
const stubQueries = (options: {
  activities: any[];
  members?: any[];
  /** The cross-organisation-type set, for the third eligibility option. */
  typeMembers?: any[];
  entered?: Array<{ event_activity_id: string; member_id: string }>;
}) => {
  mockDb.query = jest.fn().mockImplementation(async (sql: string) => {
    if (sql.includes('FROM events e')) return { rows: [eventRow] };
    if (sql.includes('FROM event_activities a')) return { rows: options.activities };
    if (sql.includes('FROM organization_users me')) return { rows: options.typeMembers ?? [] };
    if (sql.includes('FROM members m')) return { rows: options.members ?? [] };
    if (sql.includes('FROM event_entries') && sql.includes('member_id = ANY')) {
      return { rows: options.entered ?? [] };
    }
    // Basket holds.
    return { rows: [] };
  });
};

const firstActivity = async () => {
  const events = await accountCatalogueService.listEvents(ORG, USER, TODAY);
  return events[0].activities[0];
};

beforeEach(() => jest.clearAllMocks());

describe('an activity open to everyone', () => {
  it('is unchanged, and carries no members', async () => {
    stubQueries({ activities: [activityRow({ entry_eligibility: 'all' })] });

    const activity = await firstActivity();

    expect(activity.membersOnly).toBe(false);
    expect(activity.eligibleMembers).toEqual([]);
    expect(activity.available).toBe(true);
  });

  it('does not go looking for memberships at all', async () => {
    /*
     * Most clubs restrict nothing. A page of open events must not pay for a
     * membership lookup whose answer it will never read.
     */
    stubQueries({ activities: [activityRow({ entry_eligibility: 'all' })] });

    await firstActivity();

    const queries = (mockDb.query as jest.Mock).mock.calls.map(([sql]) => sql);
    expect(queries.some((sql: string) => sql.includes('FROM members m'))).toBe(false);
  });

  it('still blocks a second entry from the same login', async () => {
    // The account-level rule is unchanged where there is no member to key on.
    stubQueries({ activities: [activityRow({ entry_eligibility: 'all', mine: '1' })] });

    expect((await firstActivity()).unavailableReason).toBe('already-entered');
  });
});

describe('an activity open to members only', () => {
  it('is refused, by name, to someone holding no membership', async () => {
    /*
     * Named rather than merely unavailable: someone whose membership lapsed
     * needs to know that is why, not be left to guess at a full class.
     */
    stubQueries({ activities: [activityRow()], members: [] });

    const activity = await firstActivity();

    expect(activity.available).toBe(false);
    expect(activity.unavailableReason).toBe('members-only');
    expect(activity.membersOnly).toBe(true);
  });

  it('is open to a member, and says who they are', async () => {
    stubQueries({ activities: [activityRow()], members: [memberRow()] });

    const activity = await firstActivity();

    expect(activity.available).toBe(true);
    expect(activity.eligibleMembers).toEqual([
      {
        id: 'mem-1',
        name: 'Saoirse Byrne',
        membershipTypeName: 'Junior Member',
        membershipNumber: 'KHP-0241',
        // Null for the club's own members: naming the club running the event
        // beside every name would be noise.
        organisationName: null,
        alreadyEntered: false,
      },
    ]);
  });

  it('offers every membership the login holds', async () => {
    // A parent holds their children's. This is the case the whole feature is
    // shaped around.
    stubQueries({
      activities: [activityRow()],
      members: [memberRow(), memberRow({ id: 'mem-2', first_name: 'Fionn' })],
    });

    const activity = await firstActivity();

    expect(activity.eligibleMembers.map((m) => m.name)).toEqual([
      'Saoirse Byrne',
      'Fionn Byrne',
    ]);
    expect(activity.available).toBe(true);
  });

  it('marks the child already entered without closing the activity', async () => {
    /*
     * The point of making the duplicate check per member: one child in, the
     * other still able to enter.
     */
    stubQueries({
      activities: [activityRow()],
      members: [memberRow(), memberRow({ id: 'mem-2', first_name: 'Fionn' })],
      entered: [{ event_activity_id: 'act-1', member_id: 'mem-1' }],
    });

    const activity = await firstActivity();

    expect(activity.available).toBe(true);
    expect(activity.eligibleMembers.find((m) => m.id === 'mem-1')?.alreadyEntered).toBe(true);
    expect(activity.eligibleMembers.find((m) => m.id === 'mem-2')?.alreadyEntered).toBe(false);
  });

  it('closes only once every membership is entered', async () => {
    stubQueries({
      activities: [activityRow()],
      members: [memberRow(), memberRow({ id: 'mem-2', first_name: 'Fionn' })],
      entered: [
        { event_activity_id: 'act-1', member_id: 'mem-1' },
        { event_activity_id: 'act-1', member_id: 'mem-2' },
      ],
    });

    const activity = await firstActivity();

    expect(activity.available).toBe(false);
    expect(activity.unavailableReason).toBe('members-all-entered');
  });

  it('ignores the account-level duplicate count', async () => {
    /*
     * `mine` counts entries by this login regardless of which member they were
     * for. Applying it here would block the second child on the strength of the
     * first — the exact behaviour the per-member rule replaces.
     */
    stubQueries({
      activities: [activityRow({ mine: '1' })],
      members: [memberRow(), memberRow({ id: 'mem-2', first_name: 'Fionn' })],
      entered: [{ event_activity_id: 'act-1', member_id: 'mem-1' }],
    });

    const activity = await firstActivity();

    expect(activity.unavailableReason).toBeNull();
    expect(activity.available).toBe(true);
  });

  it('lets the event’s own reason win', async () => {
    // A members-only activity in a closed event is still closed, and saying
    // "members only" would send a member off to renew for nothing.
    stubQueries({
      activities: [activityRow()],
      members: [],
    });
    mockDb.query = jest.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FROM events e')) {
        return { rows: [{ ...eventRow, entries_closing_date: new Date('2026-08-01') }] };
      }
      if (sql.includes('FROM event_activities a')) return { rows: [activityRow()] };
      if (sql.includes('FROM members m')) return { rows: [] };
      return { rows: [] };
    });

    expect((await firstActivity()).unavailableReason).toBe('entries-closed');
  });

  it('asks only for memberships that are active and in date', async () => {
    /*
     * Both conditions. Nothing flips a row to `elapsed` at midnight, so a
     * status left behind by a job that has not run must not let somebody into
     * a members-only event on a membership that expired last week.
     */
    stubQueries({ activities: [activityRow()], members: [memberRow()] });

    await firstActivity();

    const membershipQuery = (mockDb.query as jest.Mock).mock.calls
      .map(([sql]) => sql)
      .find((sql: string) => sql.includes('FROM members m'));

    expect(membershipQuery).toContain("m.status = 'active'");
    expect(membershipQuery).toContain('m.valid_until >=');
  });
});


/**
 * The third option: open to members of every club of the same type.
 *
 * A federation opening an event to its own branches. The rule sits alongside
 * "our members only" rather than replacing it, and the two must not be allowed
 * to bleed into each other — a membership of another branch must never open an
 * activity the club restricted to its own people.
 *
 * See docs/MEMBERS_ONLY_ENTRIES.md §7.
 */
describe('an activity open across the organisation type', () => {
  const orgTypeActivity = (over: Record<string, any> = {}) =>
    activityRow({ entry_eligibility: 'org-type-members', ...over });

  it('is refused with its own reason to someone in no club of the type', async () => {
    /*
     * A different reason from `members-only`, because the remedy differs: one
     * is "renew with this club", the other is "join any club in the federation".
     */
    stubQueries({ activities: [orgTypeActivity()], typeMembers: [] });

    const activity = await firstActivity();

    expect(activity.unavailableReason).toBe('org-members-only');
    expect(activity.entryEligibility).toBe('org-type-members');
  });

  it('opens to a member of another branch, and names their club', async () => {
    // "Junior Member · Ward Union Pony Club" answers the question a member
    // entering another branch's rally will otherwise ask.
    stubQueries({
      activities: [orgTypeActivity()],
      typeMembers: [
        memberRow({ organisation_id: 'org-2', organisation_name: 'Ward Union Pony Club' }),
      ],
    });

    const activity = await firstActivity();

    expect(activity.available).toBe(true);
    expect(activity.eligibleMembers[0].organisationName).toBe('Ward Union Pony Club');
  });

  it('does not name the club when it is the one running the event', async () => {
    // Repeating the host club beside every name would be noise.
    stubQueries({
      activities: [orgTypeActivity()],
      typeMembers: [memberRow({ organisation_id: ORG, organisation_name: 'Kildare Hunt Pony Club' })],
    });

    expect((await firstActivity()).eligibleMembers[0].organisationName).toBeNull();
  });

  it('asks the wider question, scoped to the organisation type', async () => {
    stubQueries({ activities: [orgTypeActivity()], typeMembers: [memberRow()] });

    await firstActivity();

    const sql = (mockDb.query as jest.Mock).mock.calls
      .map(([text]) => text)
      .find((text: string) => text.includes('FROM organization_users me'));

    // Out through the one identifier that is the same person in every club...
    expect(sql).toContain('mine.keycloak_user_id = me.keycloak_user_id');
    // ...and no further than the federation.
    expect(sql).toContain('o.organization_type_id');
  });

  it('keeps the two restrictions apart on one event', async () => {
    /*
     * The case that would be easy to get wrong by merging the two member sets:
     * a membership of another branch must not open the club's own members-only
     * activity, and the host club's own membership must open both.
     */
    stubQueries({
      activities: [
        activityRow({ id: 'act-own', entry_eligibility: 'members' }),
        orgTypeActivity({ id: 'act-type' }),
      ],
      members: [],
      typeMembers: [
        memberRow({ organisation_id: 'org-2', organisation_name: 'Ward Union Pony Club' }),
      ],
    });

    const events = await accountCatalogueService.listEvents(ORG, USER, TODAY);
    const own = events[0].activities.find((a) => a.id === 'act-own');
    const type = events[0].activities.find((a) => a.id === 'act-type');

    expect(own?.unavailableReason).toBe('members-only');
    expect(type?.available).toBe(true);
  });

  it('leaves an unrecognised value as open to all', async () => {
    // A value the constraint should prevent, but which must not fail open into
    // something *narrower* than intended or wider than the column allows.
    stubQueries({ activities: [activityRow({ entry_eligibility: 'nonsense' })] });

    const activity = await firstActivity();

    expect(activity.entryEligibility).toBe('all');
    expect(activity.membersOnly).toBe(false);
  });
});
