import { UserGroupService } from '../user-group.service';
import { db } from '../../database/pool';
import { ValidationError, NotFoundError } from '../../middleware/errors';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

const mockDb = db as jest.Mocked<typeof db>;
const ORG = 'org-1';
const GROUP = 'group-1';

const groupRow = (over: Record<string, any> = {}) => ({
  id: GROUP,
  organisation_id: ORG,
  name: 'Life Members',
  description: 'Members who have paid a life subscription',
  member_count: 2,
  created_at: new Date(),
  updated_at: new Date(),
  ...over,
});

describe('UserGroupService', () => {
  let service: UserGroupService;

  beforeEach(() => {
    mockDb.query.mockReset();
    service = new UserGroupService();
  });

  describe('list', () => {
    it('returns groups with their member counts', async () => {
      mockDb.query.mockResolvedValue({ rows: [groupRow()] } as any);

      const groups = await service.list(ORG);

      expect(groups[0]).toMatchObject({ id: GROUP, name: 'Life Members', memberCount: 2 });
    });

    it('scopes to the organisation', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);
      await service.list(ORG);

      const [sql, params] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain('g.organisation_id = $1');
      expect(params).toEqual([ORG]);
    });
  });

  describe('getById', () => {
    it('reports a group from another organisation as not found', async () => {
      // Scoping matters more than the message: a valid id from elsewhere must
      // not be readable.
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(service.getById(ORG, 'someone-elses')).rejects.toThrow(NotFoundError);

      const [sql, params] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain('g.organisation_id = $2');
      expect(params).toEqual(['someone-elses', ORG]);
    });
  });

  describe('create', () => {
    it('creates a named group', async () => {
      mockDb.query.mockResolvedValue({ rows: [groupRow({ member_count: 0 })] } as any);

      const group = await service.create(ORG, { name: '  Life Members  ' });

      const params = mockDb.query.mock.calls[0][1] as any[];
      expect(params[0]).toBe(ORG);
      expect(params[1]).toBe('Life Members'); // trimmed
      expect(group.memberCount).toBe(0);
    });

    it('requires a name', async () => {
      await expect(service.create(ORG, {})).rejects.toThrow(ValidationError);
      await expect(service.create(ORG, { name: '   ' })).rejects.toThrow(ValidationError);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('turns a duplicate name into a readable message', async () => {
      const duplicate: any = new Error('duplicate');
      duplicate.code = '23505';
      mockDb.query.mockRejectedValue(duplicate);

      await expect(service.create(ORG, { name: 'Life Members' })).rejects.toThrow(
        /already exists/
      );
    });

    it('stores an empty description as null rather than an empty string', async () => {
      mockDb.query.mockResolvedValue({ rows: [groupRow()] } as any);
      await service.create(ORG, { name: 'A', description: '   ' });

      const params = mockDb.query.mock.calls[0][1] as any[];
      expect(params[2]).toBeNull();
    });
  });

  describe('remove', () => {
    it('deletes and reports how many discounts still reference the group', async () => {
      // Deleting a group does not rewrite discount rules — the caller is told
      // instead, because silently editing someone's discounts is worse.
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: 2 }] } as any)
        .mockResolvedValueOnce({ rowCount: 1, rows: [] } as any);

      await expect(service.remove(ORG, GROUP)).resolves.toEqual({ usedByDiscounts: 2 });
    });

    it('reports a group that is not this organisation\'s as not found', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: 0 }] } as any)
        .mockResolvedValueOnce({ rowCount: 0, rows: [] } as any);

      await expect(service.remove(ORG, 'nope')).rejects.toThrow(NotFoundError);
    });
  });

  describe('addMembers', () => {
    const eligibleCheck = (ids: string[]) =>
      mockDb.query
        .mockResolvedValueOnce({ rows: [groupRow()] } as any)                 // getById
        .mockResolvedValueOnce({ rows: ids.map((id) => ({ id })) } as any);   // eligibility

    it('adds account users of this organisation', async () => {
      eligibleCheck(['u1', 'u2']).mockResolvedValueOnce({ rowCount: 2, rows: [] } as any);

      await expect(service.addMembers(ORG, GROUP, ['u1', 'u2'])).resolves.toBe(2);
    });

    it('only accepts active account users of this organisation', async () => {
      eligibleCheck(['u1']);
      await service.addMembers(ORG, GROUP, ['u1']).catch(() => undefined);

      const [sql] = mockDb.query.mock.calls[1];
      expect(String(sql)).toContain("user_type = 'account-user'");
      expect(String(sql)).toContain('organization_id = $2');
    });

    it('rejects the whole call when someone is not eligible', async () => {
      // Silently skipping them would produce a group that quietly omits people
      // the admin believes they added.
      eligibleCheck(['u1']); // asked for two, only one came back

      await expect(service.addMembers(ORG, GROUP, ['u1', 'outsider'])).rejects.toThrow(
        /not account users of this organisation/
      );
    });

    it('requires at least one person', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [groupRow()] } as any);
      await expect(service.addMembers(ORG, GROUP, [])).rejects.toThrow(ValidationError);
    });

    it('is safe to repeat — an existing member is not duplicated', async () => {
      eligibleCheck(['u1']).mockResolvedValueOnce({ rowCount: 0, rows: [] } as any);

      await expect(service.addMembers(ORG, GROUP, ['u1'])).resolves.toBe(0);

      const [sql] = mockDb.query.mock.calls[2];
      expect(String(sql)).toContain('ON CONFLICT');
      expect(String(sql)).toContain('DO NOTHING');
    });

    it('refuses to touch a group belonging to another organisation', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any); // getById finds nothing

      await expect(service.addMembers(ORG, 'someone-elses', ['u1'])).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('removeMember', () => {
    it('removes someone from the group', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [groupRow()] } as any)
        .mockResolvedValueOnce({ rowCount: 1, rows: [] } as any);

      await expect(service.removeMember(ORG, GROUP, 'u1')).resolves.toBeUndefined();
    });

    it('reports someone who was not in the group', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [groupRow()] } as any)
        .mockResolvedValueOnce({ rowCount: 0, rows: [] } as any);

      await expect(service.removeMember(ORG, GROUP, 'u1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listMembers', () => {
    it('checks the group belongs to the organisation before listing', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any); // getById finds nothing

      await expect(service.listMembers(ORG, 'someone-elses')).rejects.toThrow(NotFoundError);
      // The member query must never run for a group we do not own.
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('returns members with their names and emails', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [groupRow()] } as any)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'u1',
              email: 'm@x.ie',
              first_name: 'Michael',
              last_name: 'Adams',
              status: 'active',
              created_at: new Date(),
            },
          ],
        } as any);

      const members = await service.listMembers(ORG, GROUP);
      expect(members[0]).toMatchObject({
        organisationUserId: 'u1',
        firstName: 'Michael',
        email: 'm@x.ie',
      });
    });
  });
});
