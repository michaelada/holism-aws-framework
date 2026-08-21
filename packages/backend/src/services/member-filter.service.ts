import { db } from '../database/pool';
import { logger } from '../config/logger';

/**
 * Saved filters over the members database.
 *
 * A club with two thousand members asks the same handful of questions every
 * month — who has lapsed, who is due to renew before the show, who is tagged as
 * a committee member. A filter is that question, named and kept.
 *
 * ## Whose filter is it
 *
 * The table carries both `organisation_id` and `user_id`, and the reading here
 * is **organisation-wide**: a filter saved by one administrator is visible to
 * every administrator of that club. `user_id` records who made it, not who may
 * see it.
 *
 * That is the useful behaviour — a committee shares its questions, and a
 * secretary going on holiday does not take the club's saved filters with them —
 * and it is also the one that matches the column the list is indexed on. If
 * per-administrator privacy is ever wanted, it belongs as an explicit
 * `shared` flag rather than as a silent scoping rule.
 *
 * See docs/MEMBER_CUSTOM_FILTERS.md.
 */

export type MemberStatus = 'active' | 'pending' | 'elapsed';

export interface MemberFilter {
  id: string;
  organisationId: string;
  userId: string;
  name: string;
  memberStatus: MemberStatus[];
  dateLastRenewedBefore: string | null;
  dateLastRenewedAfter: string | null;
  validUntilBefore: string | null;
  validUntilAfter: string | null;
  memberLabels: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMemberFilterDto {
  name: string;
  memberStatus?: MemberStatus[];
  dateLastRenewedBefore?: string | null;
  dateLastRenewedAfter?: string | null;
  validUntilBefore?: string | null;
  validUntilAfter?: string | null;
  memberLabels?: string[];
}

const STATUSES: ReadonlySet<string> = new Set(['active', 'pending', 'elapsed']);

/**
 * A date column, or null.
 *
 * The dialog sends whatever its picker produced — a `Date`, an ISO timestamp, or
 * an empty string when the field was left alone. All three reach a `date`
 * column, and an empty string is a cast error rather than "no bound", which is
 * the difference between a filter that saves and a 500.
 */
function dateOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;

  // Date-only: a renewal bound is a day, and keeping a time would make
  // "renewed before the 1st" depend on what o'clock it was saved at.
  return parsed.toISOString().slice(0, 10);
}

/** Only the statuses that exist, de-duplicated, order preserved. */
const cleanStatuses = (values: unknown): MemberStatus[] => {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((v) => typeof v === 'string' && STATUSES.has(v)))] as MemberStatus[];
};

/** Labels as typed, trimmed, blanks dropped. */
const cleanLabels = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values
        .filter((v) => typeof v === 'string')
        .map((v) => (v as string).trim())
        .filter(Boolean)
    ),
  ];
};

function rowToFilter(row: any): MemberFilter {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    userId: row.user_id,
    name: row.name,
    memberStatus: row.member_status ?? [],
    /*
     * `date` columns come back as `Date` objects in the server's timezone.
     * Sent on as an ISO instant they shift by the offset, so a bound saved as
     * the 1st arrives at the browser as the 31st of the month before.
     */
    dateLastRenewedBefore: asDateString(row.date_last_renewed_before),
    dateLastRenewedAfter: asDateString(row.date_last_renewed_after),
    validUntilBefore: asDateString(row.valid_until_before),
    validUntilAfter: asDateString(row.valid_until_after),
    memberLabels: row.member_labels ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const asDateString = (value: unknown): string | null => {
  if (!value) return null;
  if (value instanceof Date) {
    // Local parts, not `toISOString()`, which converts to UTC first.
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
};

class MemberFilterService {
  /** Every saved filter for a club, newest name-order first for a menu. */
  async listForOrganisation(organisationId: string): Promise<MemberFilter[]> {
    const result = await db.query(
      `SELECT * FROM member_filters WHERE organisation_id = $1 ORDER BY name ASC`,
      [organisationId]
    );
    return result.rows.map(rowToFilter);
  }

  async getById(id: string, organisationId: string): Promise<MemberFilter | null> {
    const result = await db.query(
      `SELECT * FROM member_filters WHERE id = $1 AND organisation_id = $2`,
      [id, organisationId]
    );
    return result.rows[0] ? rowToFilter(result.rows[0]) : null;
  }

  async create(
    organisationId: string,
    organisationUserId: string,
    data: CreateMemberFilterDto
  ): Promise<MemberFilter> {
    const name = (data.name ?? '').trim();
    if (!name) throw new Error('A filter needs a name');

    const result = await db.query(
      `INSERT INTO member_filters
         (organisation_id, user_id, name, member_status,
          date_last_renewed_before, date_last_renewed_after,
          valid_until_before, valid_until_after, member_labels)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        organisationId,
        organisationUserId,
        name,
        JSON.stringify(cleanStatuses(data.memberStatus)),
        dateOrNull(data.dateLastRenewedBefore),
        dateOrNull(data.dateLastRenewedAfter),
        dateOrNull(data.validUntilBefore),
        dateOrNull(data.validUntilAfter),
        JSON.stringify(cleanLabels(data.memberLabels)),
      ]
    );

    logger.info('Member filter created', { organisationId, name });
    return rowToFilter(result.rows[0]);
  }

  /**
   * Scoped by organisation in the statement itself, not by a prior read.
   *
   * A delete that checks ownership and then deletes by id alone is two
   * statements with a gap between them; one statement cannot be raced.
   */
  async remove(id: string, organisationId: string): Promise<boolean> {
    const result = await db.query(
      `DELETE FROM member_filters WHERE id = $1 AND organisation_id = $2`,
      [id, organisationId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

export const memberFilterService = new MemberFilterService();
