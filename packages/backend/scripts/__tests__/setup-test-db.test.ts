/**
 * The test-database setup script.
 *
 * Tested for the two things that made its predecessor useless: it has to build
 * the schema from **migrations** rather than from DDL copied into the script,
 * and it must never be pointed at the development database.
 */

const mockConnect = jest.fn();
const mockQuery = jest.fn();
const mockEnd = jest.fn();
const mockExecFile = jest.fn();

jest.mock('pg', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    query: mockQuery,
    end: mockEnd,
  })),
}));

jest.mock('child_process', () => ({ execFileSync: mockExecFile }));
// The script reads `.env.test` at import; the environment is set per test here.
jest.mock('dotenv', () => ({ config: jest.fn() }));

import { setupTestDatabase } from '../setup-test-db';

let logSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.DATABASE_NAME = 'aws_framework_test';
  process.env.DATABASE_HOST = 'localhost';
  process.env.DATABASE_PORT = '5432';
  process.env.DATABASE_USER = 'framework_user';
  process.env.DATABASE_PASSWORD = 'framework_password';

  mockConnect.mockResolvedValue(undefined);
  mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
  mockEnd.mockResolvedValue(undefined);

  logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => logSpy.mockRestore());

describe('setupTestDatabase', () => {
  it('creates the database when it is not there', async () => {
    await setupTestDatabase();

    expect(mockQuery).toHaveBeenCalledWith('SELECT 1 FROM pg_database WHERE datname = $1', [
      'aws_framework_test',
    ]);
    expect(mockQuery).toHaveBeenCalledWith('CREATE DATABASE "aws_framework_test"');
  });

  it('leaves an existing database alone', async () => {
    mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ '?column?': 1 }] });

    await setupTestDatabase();

    expect(mockQuery).not.toHaveBeenCalledWith(expect.stringContaining('CREATE DATABASE'));
  });

  /*
   * The whole point of the rewrite. The shell script this replaces created
   * three of the seventy-four tables by hand and never ran a migration, so
   * every suite touching anything else failed on a missing relation.
   */
  it('builds the schema by running the migrations', async () => {
    await setupTestDatabase();

    expect(mockExecFile).toHaveBeenCalledWith(
      'npx',
      ['node-pg-migrate', 'up', '-m', 'migrations'],
      expect.objectContaining({
        env: expect.objectContaining({
          DATABASE_URL:
            'postgresql://framework_user:framework_password@localhost:5432/aws_framework_test',
        }),
      })
    );
  });

  it('closes the admin connection even when the lookup fails', async () => {
    mockQuery.mockRejectedValue(new Error('permission denied'));

    await expect(setupTestDatabase()).rejects.toThrow('permission denied');
    expect(mockEnd).toHaveBeenCalled();
  });

  it('refuses the development database, and migrates nothing', async () => {
    process.env.DATABASE_NAME = 'aws_framework';

    await expect(setupTestDatabase()).rejects.toThrow(/development database/);
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('says how to start Postgres when it cannot be reached', async () => {
    mockConnect.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(setupTestDatabase()).rejects.toThrow(/docker compose up -d postgres/);
    expect(mockExecFile).not.toHaveBeenCalled();
  });
});
