import { db } from '../../database/pool';
import { merchandiseService } from '../merchandise.service';
import { membershipService } from '../membership.service';
import { registrationService } from '../registration.service';
import { calendarService } from '../calendar.service';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

/**
 * Soft delete across the things an organisation configures and sells.
 *
 * The rule these assert is not "add a column" but **withdrawn things stop
 * being choosable while staying resolvable**. A membership type an
 * organisation retires must vanish from the catalogue, yet last season's
 * members still hold it and their records must keep naming it. Get those the
 * wrong way round and either a member buys something that no longer exists, or
 * an order history turns into a list of blanks.
 *
 * So the tests are split accordingly: list and get-by-id must filter; the
 * delete must mark rather than remove; and the deliberate non-filters are
 * covered in `historical joins` at the bottom.
 */
describe('soft delete', () => {
  const mockDb = db as jest.Mocked<typeof db>;
  const ORG = 'org-1';

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  });

  /** The SQL of the first query a call made. */
  const firstSql = () => String((mockDb.query as jest.Mock).mock.calls[0][0]);

  describe('withdrawn rows are not listed', () => {
    it('merchandise types', async () => {
      await merchandiseService.getMerchandiseTypesByOrganisation(ORG);
      expect(firstSql()).toContain('deleted = FALSE');
    });

    it('membership types', async () => {
      await membershipService.getMembershipTypesByOrganisation(ORG);
      expect(firstSql()).toContain('deleted = FALSE');
    });

    it('registration types', async () => {
      await registrationService.getRegistrationTypesByOrganisation(ORG);
      expect(firstSql()).toContain('deleted = FALSE');
    });

    it('calendars', async () => {
      await calendarService.getCalendarsByOrganisation(ORG);
      expect(firstSql()).toContain('deleted = FALSE');
    });
  });

  /**
   * Get-by-id filters too. This is what stops a withdrawn item being reached
   * by a stale link, an old cart line, or an edit form — the id is still valid,
   * so nothing else would refuse it.
   */
  describe('withdrawn rows are not fetchable by id', () => {
    it('merchandise types', async () => {
      expect(await merchandiseService.getMerchandiseTypeById('x')).toBeNull();
      expect(firstSql()).toContain('deleted = FALSE');
    });

    it('membership types', async () => {
      expect(await membershipService.getMembershipTypeById('x')).toBeNull();
      expect(firstSql()).toContain('deleted = FALSE');
    });

    it('registration types', async () => {
      expect(await registrationService.getRegistrationTypeById('x')).toBeNull();
      expect(firstSql()).toContain('deleted = FALSE');
    });

    it('calendars', async () => {
      expect(await calendarService.getCalendarById('x')).toBeNull();
      expect(firstSql()).toContain('deleted = FALSE');
    });
  });

  describe('deleting marks rather than removes', () => {
    const cases: Array<[string, (id: string, by?: string) => Promise<void>, string]> = [
      ['merchandise type', (id, by) => merchandiseService.deleteMerchandiseType(id, by), 'merchandise_types'],
      ['membership type', (id, by) => membershipService.deleteMembershipType(id, by), 'membership_types'],
      ['registration type', (id, by) => registrationService.deleteRegistrationType(id, by), 'registration_types'],
      ['calendar', (id, by) => calendarService.deleteCalendar(id, by), 'calendars'],
    ];

    it.each(cases)('%s', async (_label, call, table) => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [], rowCount: 1 });

      await call('id-1', 'ou-9');

      const sql = firstSql();
      expect(sql).toContain(`UPDATE ${table}`);
      expect(sql).toContain('deleted = TRUE');
      expect(sql).not.toContain('DELETE FROM');
      // Attribution, as events records it.
      expect((mockDb.query as jest.Mock).mock.calls[0][1]).toEqual(['id-1', 'ou-9']);
    });

    /**
     * Withdrawing twice is a no-op, not a second stamp — the `deleted = FALSE`
     * in the WHERE means the second call matches nothing, so the record of who
     * withdrew it first survives.
     */
    it.each(cases)('%s refuses a repeat', async (_label, call) => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(call('id-1', 'ou-9')).rejects.toThrow(/already deleted/i);
    });
  });

  /**
   * The other half of the rule, and the easier half to get wrong: some reads
   * must keep seeing withdrawn rows. These are deliberately *not* filtered, and
   * a well-meaning "consistency" pass that adds `deleted = FALSE` to them would
   * blank out history rather than tidy it.
   */
  describe('historical joins keep resolving withdrawn rows', () => {
    it('merchandise order lines still name their product', () => {
      const source = require('fs').readFileSync(
        require('path').join(__dirname, '../merchandise.service.ts'),
        'utf8'
      );
      const nameLookup = "SELECT id, name FROM merchandise_types WHERE id = ANY($1)";
      expect(source).toContain(nameLookup);
      // If this ever gains a deleted filter, past orders lose their product name.
      expect(source).not.toContain(`${nameLookup.slice(0, -1)} AND deleted = FALSE)`);
    });

    it('membership reporting still counts withdrawn types', () => {
      const source = require('fs').readFileSync(
        require('path').join(__dirname, '../reporting.service.ts'),
        'utf8'
      );
      const idx = source.indexOf('FROM membership_types mt');
      expect(idx).toBeGreaterThan(-1);
      // The aggregate covers members who joined before the type was retired.
      expect(source.slice(idx, idx + 400)).not.toContain('mt.deleted = FALSE');
    });
  });
});
