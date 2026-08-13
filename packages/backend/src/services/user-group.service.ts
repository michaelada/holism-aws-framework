import { db } from '../database/pool';
import { logger } from '../config/logger';
import { ValidationError, NotFoundError } from '../middleware/errors';

/**
 * Groups of account users within an organisation.
 *
 * The only consumer today is discount eligibility: a discount can be restricted
 * to members of named groups, and `discount-validator.service` enforces that by
 * querying `user_group_members`. Until this existed the criterion could be
 * enforced but never configured, so it was unusable — see
 * docs/SCHEMA_DRIFT_AUDIT.md §6.
 *
 * Everything here is scoped by organisation. A group id from another
 * organisation is treated as not found rather than acted on.
 */

export interface UserGroup {
  id: string;
  organisationId: string;
  name: string;
  description: string | null;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserGroupMember {
  organisationUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  addedAt: Date;
}

export class UserGroupService {
  private rowToGroup(row: any): UserGroup {
    return {
      id: row.id,
      organisationId: row.organisation_id,
      name: row.name,
      description: row.description,
      memberCount: Number(row.member_count ?? 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /** Every group in an organisation, with how many members each holds. */
  async list(organisationId: string): Promise<UserGroup[]> {
    const result = await db.query(
      `SELECT g.*, COUNT(m.id)::int AS member_count
       FROM user_groups g
       LEFT JOIN user_group_members m ON m.user_group_id = g.id
       WHERE g.organisation_id = $1
       GROUP BY g.id
       ORDER BY g.name`,
      [organisationId]
    );
    return result.rows.map((row: any) => this.rowToGroup(row));
  }

  async getById(organisationId: string, id: string): Promise<UserGroup> {
    const result = await db.query(
      `SELECT g.*, COUNT(m.id)::int AS member_count
       FROM user_groups g
       LEFT JOIN user_group_members m ON m.user_group_id = g.id
       WHERE g.id = $1 AND g.organisation_id = $2
       GROUP BY g.id`,
      [id, organisationId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('User group not found');
    }
    return this.rowToGroup(result.rows[0]);
  }

  async create(
    organisationId: string,
    data: { name?: string; description?: string }
  ): Promise<UserGroup> {
    const name = data.name?.trim();
    if (!name) {
      throw new ValidationError('A group name is required');
    }

    try {
      const result = await db.query(
        `INSERT INTO user_groups (organisation_id, name, description)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [organisationId, name, data.description?.trim() || null]
      );

      logger.info(`User group created: ${name} for organisation ${organisationId}`);
      return this.rowToGroup({ ...result.rows[0], member_count: 0 });
    } catch (error: any) {
      // Names are unique per organisation, matching how event types and venues
      // behave — the message has to say so rather than surfacing a constraint.
      if (error.code === '23505') {
        throw new ValidationError('A group with this name already exists');
      }
      throw error;
    }
  }

  async update(
    organisationId: string,
    id: string,
    data: { name?: string; description?: string }
  ): Promise<UserGroup> {
    const updates: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let n = 1;

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new ValidationError('A group name is required');
      updates.push(`name = $${n++}`);
      values.push(name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${n++}`);
      values.push(data.description?.trim() || null);
    }

    values.push(id, organisationId);

    try {
      const result = await db.query(
        `UPDATE user_groups SET ${updates.join(', ')}
         WHERE id = $${n++} AND organisation_id = $${n}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('User group not found');
      }
      return this.getById(organisationId, id);
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ValidationError('A group with this name already exists');
      }
      throw error;
    }
  }

  /**
   * Delete a group.
   *
   * Memberships go with it (the foreign key cascades), but any discount whose
   * eligibility names this group keeps the now-dangling id. That is reported
   * rather than silently repaired: rewriting somebody's discount rules as a
   * side effect of deleting a group would be worse than telling them.
   */
  async remove(organisationId: string, id: string): Promise<{ usedByDiscounts: number }> {
    const usage = await db.query(
      `SELECT COUNT(*)::int AS count FROM discounts
       WHERE organisation_id = $1
         AND eligibility_criteria -> 'userGroups' @> $2::jsonb`,
      [organisationId, JSON.stringify([id])]
    );

    const result = await db.query(
      'DELETE FROM user_groups WHERE id = $1 AND organisation_id = $2',
      [id, organisationId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('User group not found');
    }

    logger.info(`User group ${id} deleted from organisation ${organisationId}`);
    return { usedByDiscounts: usage.rows[0]?.count ?? 0 };
  }

  /** Who is in a group. */
  async listMembers(organisationId: string, groupId: string): Promise<UserGroupMember[]> {
    await this.getById(organisationId, groupId); // 404s if not this organisation's

    const result = await db.query(
      `SELECT ou.id, ou.email, ou.first_name, ou.last_name, ou.status, m.created_at
       FROM user_group_members m
       JOIN organization_users ou ON ou.id = m.user_id
       WHERE m.user_group_id = $1
       ORDER BY ou.last_name, ou.first_name`,
      [groupId]
    );

    return result.rows.map((row: any) => ({
      organisationUserId: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      status: row.status,
      addedAt: row.created_at,
    }));
  }

  /**
   * Put account users into a group.
   *
   * Only account users of the same organisation may be added — a valid id from
   * elsewhere, or an org-admin id, is rejected rather than quietly ignored, so
   * a mistake surfaces instead of producing a group that silently omits people.
   *
   * Adding someone already in the group is a no-op, so the call is safe to
   * repeat.
   */
  async addMembers(
    organisationId: string,
    groupId: string,
    organisationUserIds: string[]
  ): Promise<number> {
    await this.getById(organisationId, groupId);

    if (!Array.isArray(organisationUserIds) || organisationUserIds.length === 0) {
      throw new ValidationError('Select at least one member to add');
    }

    const eligible = await db.query(
      `SELECT id FROM organization_users
       WHERE id = ANY($1::uuid[]) AND organization_id = $2 AND user_type = 'account-user'`,
      [organisationUserIds, organisationId]
    );

    const eligibleIds = eligible.rows.map((row: any) => row.id);
    const rejected = organisationUserIds.filter((id) => !eligibleIds.includes(id));
    if (rejected.length > 0) {
      throw new ValidationError(
        `${rejected.length} of the selected people are not account users of this organisation`
      );
    }

    const result = await db.query(
      `INSERT INTO user_group_members (user_group_id, user_id)
       SELECT $1, unnest($2::uuid[])
       ON CONFLICT ON CONSTRAINT user_group_members_unique DO NOTHING`,
      [groupId, eligibleIds]
    );

    return result.rowCount ?? 0;
  }

  async removeMember(
    organisationId: string,
    groupId: string,
    organisationUserId: string
  ): Promise<void> {
    await this.getById(organisationId, groupId);

    const result = await db.query(
      'DELETE FROM user_group_members WHERE user_group_id = $1 AND user_id = $2',
      [groupId, organisationUserId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('That person is not in this group');
    }
  }

  /**
   * The groups an account user belongs to.
   *
   * Not used by discount validation — that query goes the other way, from a
   * user and a set of group ids — but it is what a member's detail page needs.
   */
  async listGroupsForUser(
    organisationId: string,
    organisationUserId: string
  ): Promise<Array<Pick<UserGroup, 'id' | 'name'>>> {
    const result = await db.query(
      `SELECT g.id, g.name
       FROM user_group_members m
       JOIN user_groups g ON g.id = m.user_group_id
       WHERE m.user_id = $1 AND g.organisation_id = $2
       ORDER BY g.name`,
      [organisationUserId, organisationId]
    );
    return result.rows.map((row: any) => ({ id: row.id, name: row.name }));
  }
}

export const userGroupService = new UserGroupService();
