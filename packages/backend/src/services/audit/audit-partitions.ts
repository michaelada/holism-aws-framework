import { db } from '../../database/pool';
import { logger } from '../../config/logger';

/**
 * Keeping the audit table's partitions ahead of the calendar.
 *
 * `audit_events` is partitioned by month. The migration created four — last
 * month through two months out — which is enough to start and not enough to
 * keep running: on the first of the month three months from now, writes would
 * land in `audit_events_default`.
 *
 * That would not lose anything. It would quietly undo the reason for
 * partitioning, because the default partition cannot be detached and dropped
 * the way a month can, and a query for last week would start scanning every
 * row ever written. So this runs on boot and daily after that.
 *
 * ## Retention
 *
 * The user was explicit that there is no enforced policy yet, and that dropping
 * old months should be a scheduled task added later. So `dropPartitionsBefore`
 * exists and **nothing calls it**. It takes a date rather than reading a
 * configured number of months, because deleting an audit trail on a
 * config-file default is exactly the accident worth designing out.
 *
 * Detach then drop, in two statements: a detached partition is an ordinary
 * table, which can be exported before it goes.
 *
 * See docs/AUDIT_TRAIL_AND_SESSIONS.md §5.
 */

/** How far ahead to keep partitions. Three months of slack on a daily job. */
const MONTHS_AHEAD = 3;

const monthName = (date: Date): string =>
  `audit_events_${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

const startOfMonth = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const addMonths = (date: Date, count: number): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1));

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Create any missing partition from this month to `MONTHS_AHEAD` out.
 *
 * Idempotent — `IF NOT EXISTS` — so running it on every boot costs three
 * no-op statements.
 */
export async function ensurePartitions(now: Date = new Date()): Promise<string[]> {
  const created: string[] = [];

  for (let i = 0; i <= MONTHS_AHEAD; i++) {
    const from = addMonths(startOfMonth(now), i);
    const to = addMonths(from, 1);
    const name = monthName(from);

    try {
      /*
       * The identifier is derived from a date, never from input — there is no
       * caller-supplied string anywhere in this statement.
       */
      await db.query(
        `CREATE TABLE IF NOT EXISTS ${name}
           PARTITION OF audit_events FOR VALUES FROM ('${isoDate(from)}') TO ('${isoDate(to)}')`
      );
      created.push(name);
    } catch (error) {
      /*
       * Never fatal. A missing partition means rows land in the default one,
       * which is a degradation; a throw here would take the process down and
       * mean no audit trail at all.
       */
      logger.error('Could not create an audit partition', { partition: name, error });
    }
  }

  return created;
}

/** Anything currently sitting in the default partition — a rotation that was missed. */
export async function defaultPartitionCount(): Promise<number> {
  try {
    const result = await db.query('SELECT COUNT(*)::int AS count FROM audit_events_default');
    return result.rows[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Detach and drop every month wholly before `cutoff`.
 *
 * Nothing calls this. It is the piece a scheduled task would use once the club
 * decides on a retention period, and it is deliberately explicit about the
 * date so that decision has to be made rather than inherited from a default.
 *
 * Returns what it dropped, so the caller can record it — dropping part of an
 * audit trail is itself an auditable act.
 */
export async function dropPartitionsBefore(cutoff: Date): Promise<string[]> {
  const boundary = startOfMonth(cutoff);
  const dropped: string[] = [];

  const result = await db.query(
    `SELECT child.relname AS name
       FROM pg_inherits
       JOIN pg_class parent ON parent.oid = pg_inherits.inhparent
       JOIN pg_class child  ON child.oid  = pg_inherits.inhrelid
      WHERE parent.relname = 'audit_events'
        AND child.relname ~ '^audit_events_[0-9]{6}$'
      ORDER BY child.relname`
  );

  for (const row of result.rows) {
    const stamp = String(row.name).slice(-6);
    const year = Number(stamp.slice(0, 4));
    const month = Number(stamp.slice(4, 6));
    const partitionStart = new Date(Date.UTC(year, month - 1, 1));

    // Wholly before, not overlapping: a partition containing the cutoff day
    // holds rows that must be kept.
    if (addMonths(partitionStart, 1) > boundary) continue;

    // Detached first, so the month is an ordinary table that can be exported
    // between these two statements if anybody wants it.
    await db.query(`ALTER TABLE audit_events DETACH PARTITION ${row.name}`);
    await db.query(`DROP TABLE ${row.name}`);

    dropped.push(row.name);
    logger.warn('Dropped an audit partition', { partition: row.name });
  }

  return dropped;
}

/**
 * Run on boot, then daily.
 *
 * Daily rather than monthly because a monthly timer is a timer that has to fire
 * on the right day: a process restarted on the 1st would skip it.
 */
export function startPartitionRotation(): NodeJS.Timeout {
  void ensurePartitions();

  const timer = setInterval(
    () => {
      void ensurePartitions();
    },
    24 * 60 * 60 * 1000
  );

  // Never a reason to hold the process open.
  timer.unref?.();
  return timer;
}
