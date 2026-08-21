/**
 * Saved filters over the members database.
 *
 * This existed as three stubs that looked finished: a dialog that discarded
 * what it collected, no create endpoint at all, and a list endpoint that
 * returned a hard-coded `[]`. So the tests here are deliberately about the
 * plumbing being real — that a filter written is a filter read back — as much
 * as about the edges.
 */

jest.mock('../../config/logger');
jest.mock('../../database/pool', () => ({ db: { query: jest.fn() } }));

import { db } from '../../database/pool';
import { memberFilterService } from '../member-filter.service';

const mockDb = db as jest.Mocked<typeof db>;

const ORG = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';
const ID = '33333333-3333-3333-3333-333333333333';

const row = (over: Record<string, unknown> = {}) => ({
  id: ID,
  organisation_id: ORG,
  user_id: USER,
  name: 'Lapsed since the show',
  member_status: ['elapsed'],
  date_last_renewed_before: null,
  date_last_renewed_after: null,
  valid_until_before: null,
  valid_until_after: null,
  member_labels: [],
  created_at: new Date('2026-08-01T10:00:00Z'),
  updated_at: new Date('2026-08-01T10:00:00Z'),
  ...over,
});

/** The values handed to the last statement. */
const params = () => mockDb.query.mock.calls[mockDb.query.mock.calls.length - 1][1] as any[];
const sql = () => String(mockDb.query.mock.calls[mockDb.query.mock.calls.length - 1][0]);

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.query.mockResolvedValue({ rows: [row()], rowCount: 1 } as any);
});

describe('listing', () => {
  it('returns a club’s filters', async () => {
    const filters = await memberFilterService.listForOrganisation(ORG);

    expect(filters).toHaveLength(1);
    expect(filters[0]).toMatchObject({ id: ID, name: 'Lapsed since the show' });
  });

  it('is scoped to the organisation', async () => {
    await memberFilterService.listForOrganisation(ORG);

    expect(sql()).toContain('organisation_id = $1');
    expect(params()).toEqual([ORG]);
  });

  it('shows every administrator the same filters', async () => {
    /*
     * `user_id` records who saved it, not who may see it. A committee shares
     * its questions, and a secretary going on holiday does not take the club's
     * saved filters with them.
     */
    await memberFilterService.listForOrganisation(ORG);

    expect(sql()).not.toContain('user_id =');
  });

  it('orders by name, because this fills a menu', async () => {
    await memberFilterService.listForOrganisation(ORG);
    expect(sql()).toContain('ORDER BY name');
  });
});

describe('creating', () => {
  it('writes the filter and returns it', async () => {
    const filter = await memberFilterService.create(ORG, USER, {
      name: 'Lapsed since the show',
      memberStatus: ['elapsed'],
      memberLabels: [],
    });

    expect(sql()).toContain('INSERT INTO member_filters');
    expect(filter.id).toBe(ID);
  });

  it('records who saved it', async () => {
    await memberFilterService.create(ORG, USER, { name: 'Anything' });
    expect(params().slice(0, 2)).toEqual([ORG, USER]);
  });

  it('refuses a filter with no name', async () => {
    await expect(memberFilterService.create(ORG, USER, { name: '   ' })).rejects.toThrow(
      /needs a name/
    );
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('trims the name', async () => {
    await memberFilterService.create(ORG, USER, { name: '  Committee  ' });
    expect(params()[2]).toBe('Committee');
  });

  describe('dates', () => {
    it('stores an empty date as no bound, not as a cast error', async () => {
      /*
       * The dialog sends whatever its picker produced, and an untouched field
       * is an empty string. Passed to a `date` column that is a 500, which is
       * the difference between a filter that saves and one that does not.
       */
      await memberFilterService.create(ORG, USER, {
        name: 'x',
        dateLastRenewedBefore: '',
        validUntilAfter: undefined,
      });

      expect(params()[4]).toBeNull();
      expect(params()[7]).toBeNull();
    });

    it('accepts a Date and an ISO string alike', async () => {
      await memberFilterService.create(ORG, USER, {
        name: 'x',
        dateLastRenewedBefore: new Date('2026-06-15T00:00:00Z') as never,
        validUntilBefore: '2026-07-20T13:45:00.000Z',
      });

      expect(params()[4]).toBe('2026-06-15');
      expect(params()[6]).toBe('2026-07-20');
    });

    it('keeps a bound as a day, not an instant', async () => {
      // "Renewed before the 1st" must not depend on what o'clock it was saved.
      await memberFilterService.create(ORG, USER, {
        name: 'x',
        dateLastRenewedAfter: '2026-06-15T23:30:00.000Z',
      });

      expect(params()[5]).toBe('2026-06-15');
    });

    it('treats an unparseable date as no bound rather than throwing', async () => {
      await memberFilterService.create(ORG, USER, { name: 'x', validUntilBefore: 'soon' });
      expect(params()[6]).toBeNull();
    });
  });

  describe('statuses and labels', () => {
    it('keeps only statuses that exist', async () => {
      await memberFilterService.create(ORG, USER, {
        name: 'x',
        memberStatus: ['active', 'lapsed' as never, 'elapsed'],
      });

      expect(JSON.parse(params()[3])).toEqual(['active', 'elapsed']);
    });

    it('de-duplicates', async () => {
      await memberFilterService.create(ORG, USER, {
        name: 'x',
        memberStatus: ['active', 'active'],
        memberLabels: ['Committee', 'Committee'],
      });

      expect(JSON.parse(params()[3])).toEqual(['active']);
      expect(JSON.parse(params()[8])).toEqual(['Committee']);
    });

    it('trims labels and drops blank ones', async () => {
      await memberFilterService.create(ORG, USER, {
        name: 'x',
        memberLabels: ['  Committee  ', '   ', 'Junior'],
      });

      expect(JSON.parse(params()[8])).toEqual(['Committee', 'Junior']);
    });

    it('stores empty arrays rather than null when nothing was chosen', async () => {
      await memberFilterService.create(ORG, USER, { name: 'x' });

      expect(JSON.parse(params()[3])).toEqual([]);
      expect(JSON.parse(params()[8])).toEqual([]);
    });
  });
});

describe('reading dates back', () => {
  it('does not shift a date by the server timezone', async () => {
    /*
     * `date` columns arrive as `Date` objects at local midnight. Sent on with
     * `toISOString()` they become the previous day anywhere east of UTC, so a
     * bound saved as the 1st reads back as the 31st.
     */
    mockDb.query.mockResolvedValue({
      rows: [row({ valid_until_before: new Date(2026, 5, 15) })],
      rowCount: 1,
    } as any);

    const [filter] = await memberFilterService.listForOrganisation(ORG);

    expect(filter.validUntilBefore).toBe('2026-06-15');
  });

  it('leaves an absent bound null', async () => {
    const [filter] = await memberFilterService.listForOrganisation(ORG);
    expect(filter.validUntilBefore).toBeNull();
  });
});

describe('deleting', () => {
  it('scopes the delete in the statement itself', async () => {
    // Checking ownership and then deleting by id is two statements with a gap
    // between them; one statement cannot be raced.
    await memberFilterService.remove(ID, ORG);

    expect(sql()).toContain('organisation_id = $2');
    expect(params()).toEqual([ID, ORG]);
  });

  it('reports whether anything was deleted', async () => {
    expect(await memberFilterService.remove(ID, ORG)).toBe(true);

    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    expect(await memberFilterService.remove(ID, ORG)).toBe(false);
  });
});

describe('fetching one', () => {
  it('will not read another club’s filter', async () => {
    await memberFilterService.getById(ID, ORG);
    expect(params()).toEqual([ID, ORG]);
  });

  it('returns null when there is no such filter', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    expect(await memberFilterService.getById(ID, ORG)).toBeNull();
  });
});
