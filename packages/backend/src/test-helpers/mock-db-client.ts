/**
 * A stand-in for a pooled client, for suites that mock `database/pool`.
 *
 * Lives in `src/test-helpers/` rather than under `src/__tests__/` because
 * jest's `testMatch` picks up every `.ts` file under a `__tests__` directory,
 * so a helper placed there is collected as a suite and fails with "Your test
 * suite must contain at least one test".
 *
 * Several services take a client for transactional work — `discount.service.ts`
 * does, and it sits on the member-creation path — via `db.getClient()`. A mock
 * that provides only `query` returns `undefined` from `getClient()`, and the
 * failure surfaces later and unhelpfully as
 * "Cannot read properties of undefined (reading 'release')", which reads as a
 * bug in the service rather than a gap in the mock.
 *
 * Usage:
 *
 *     jest.mock('../../database/pool', () => ({
 *       db: { query: jest.fn(), getClient: jest.fn() },
 *     }));
 *
 *     beforeEach(() => {
 *       (db.getClient as jest.Mock).mockResolvedValue(createMockClient());
 *     });
 */
export interface MockPoolClient {
  query: jest.Mock;
  release: jest.Mock;
}

/**
 * `query` resolves to an empty result set by default, so the transaction
 * statements a service issues (`BEGIN`, `COMMIT`, `ROLLBACK`) succeed without
 * every suite having to enumerate them.
 */
export function createMockClient(): MockPoolClient {
  return {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: jest.fn(),
  };
}
