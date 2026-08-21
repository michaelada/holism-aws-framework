/**
 * Keeping the audit table's monthly partitions ahead of the calendar.
 *
 * The failure this guards against is slow and silent: a missing partition sends
 * writes to the default one, which cannot be detached and dropped, and a query
 * for last week starts scanning every row ever written.
 *
 * The retention half is tested harder than it is used, because nothing calls it
 * — and the day something does, it will be deleting an audit trail.
 */

jest.mock('../../../config/logger');
jest.mock('../../../database/pool', () => ({ db: { query: jest.fn() } }));

import { db } from '../../../database/pool';
import { logger } from '../../../config/logger';
import {
  ensurePartitions,
  dropPartitionsBefore,
  defaultPartitionCount,
} from '../audit-partitions';

const mockDb = db as jest.Mocked<typeof db>;
const sql = () => mockDb.query.mock.calls.map((call) => String(call[0]));

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.query.mockResolvedValue({ rows: [] } as any);
});

describe('creating the months ahead', () => {
  it('covers this month and the next three', async () => {
    const created = await ensurePartitions(new Date('2026-08-21T10:00:00Z'));

    expect(created).toEqual([
      'audit_events_202608',
      'audit_events_202609',
      'audit_events_202610',
      'audit_events_202611',
    ]);
  });

  it('gives each partition the right month boundaries', async () => {
    await ensurePartitions(new Date('2026-08-21T10:00:00Z'));

    expect(sql()[0]).toContain("FROM ('2026-08-01') TO ('2026-09-01')");
  });

  it('rolls the year over', async () => {
    // December + 3 is March, and the naive arithmetic gives month 15.
    const created = await ensurePartitions(new Date('2026-12-15T10:00:00Z'));

    expect(created).toEqual([
      'audit_events_202612',
      'audit_events_202701',
      'audit_events_202702',
      'audit_events_202703',
    ]);
  });

  it('is idempotent, so running it on every boot costs nothing', async () => {
    await ensurePartitions(new Date('2026-08-21T10:00:00Z'));

    for (const statement of sql()) {
      expect(statement).toContain('CREATE TABLE IF NOT EXISTS');
    }
  });

  it('never throws when the database refuses', async () => {
    /*
     * A missing partition is a degradation — rows land in the default one. A
     * throw here would take the process down at boot, which means no audit
     * trail at all rather than a slower one.
     */
    mockDb.query.mockRejectedValue(new Error('permission denied for table audit_events'));

    await expect(ensurePartitions(new Date('2026-08-21T10:00:00Z'))).resolves.toEqual([]);
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('the default partition', () => {
  it('reports what has landed in it', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ count: 12 }] } as any);
    expect(await defaultPartitionCount()).toBe(12);
  });

  it('reports zero rather than failing when it cannot be read', async () => {
    mockDb.query.mockRejectedValue(new Error('no such table'));
    expect(await defaultPartitionCount()).toBe(0);
  });
});

describe('dropping old months', () => {
  const partitions = (...names: string[]) =>
    mockDb.query.mockImplementation((text: any) =>
      String(text).includes('pg_inherits')
        ? ({ rows: names.map((name) => ({ name })) } as any)
        : ({ rows: [] } as any)
    );

  it('drops only months wholly before the cutoff', async () => {
    partitions('audit_events_202603', 'audit_events_202604', 'audit_events_202605');

    // May contains the cutoff, so May holds rows that must be kept.
    const dropped = await dropPartitionsBefore(new Date('2026-05-15T00:00:00Z'));

    expect(dropped).toEqual(['audit_events_202603', 'audit_events_202604']);
  });

  it('detaches before dropping, so the month can be exported in between', async () => {
    partitions('audit_events_202603');

    await dropPartitionsBefore(new Date('2026-05-01T00:00:00Z'));

    const statements = sql().filter((s) => !s.includes('pg_inherits'));
    expect(statements[0]).toContain('DETACH PARTITION audit_events_202603');
    expect(statements[1]).toContain('DROP TABLE audit_events_202603');
  });

  it('leaves the default partition alone', async () => {
    // It is matched out by the pattern, but this is the one that would be
    // catastrophic to get wrong: it holds anything a missed rotation caught.
    partitions('audit_events_202603');
    await dropPartitionsBefore(new Date('2026-05-01T00:00:00Z'));

    expect(sql().some((s) => s.includes('audit_events_default'))).toBe(false);
  });

  it('records each drop, because removing an audit trail is itself notable', async () => {
    partitions('audit_events_202603');
    await dropPartitionsBefore(new Date('2026-05-01T00:00:00Z'));

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Dropped an audit partition'),
      expect.objectContaining({ partition: 'audit_events_202603' })
    );
  });

  it('drops nothing when everything is recent', async () => {
    partitions('audit_events_202608');
    expect(await dropPartitionsBefore(new Date('2026-05-01T00:00:00Z'))).toEqual([]);
  });
});
