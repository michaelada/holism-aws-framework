/**
 * Create and migrate the test database.
 *
 * The backend's integration suites — routes, services and workflows that
 * exercise real SQL — connect to `aws_framework_test` rather than mocking the
 * pool. Without that database they all fail at once with
 * `Failed to connect to database: AggregateError`, which says nothing about
 * what is actually missing. This is what creates it.
 *
 * **Why not the shell script this replaces.** That one created the database and
 * then hand-wrote three tables (`field_definitions`, `object_definitions`,
 * `object_fields`) copied out of migration `1707000000000`. The schema has 74
 * tables. Every suite that touched any of the other 71 failed on a missing
 * relation, and the copied DDL was one more place for the schema to drift.
 * Migrations are the schema; this runs them.
 *
 * It also no longer needs `psql` and `pg_isready` on the PATH. Postgres
 * normally runs in Docker here, so the host has the database without having the
 * client tools — the old script exited with "PostgreSQL is not running" on a
 * machine where it plainly was.
 *
 * Safe to re-run: the database is created only if absent, and migrations that
 * have already run are skipped.
 */

import { execFileSync } from 'child_process';
import path from 'path';
import { config } from 'dotenv';
import { Client } from 'pg';

config({ path: path.resolve(__dirname, '../.env.test') });

/**
 * Exported and throwing rather than calling `process.exit` at the point of
 * failure, so the refusals below can be tested for. A script that guards the
 * development database is worth a test, and a guard that ends the process
 * cannot have one.
 */
export async function setupTestDatabase(): Promise<void> {
  const host = process.env.DATABASE_HOST || 'localhost';
  const port = Number(process.env.DATABASE_PORT || 5432);
  const user = process.env.DATABASE_USER || 'framework_user';
  const password = process.env.DATABASE_PASSWORD || 'framework_password';
  const database = process.env.DATABASE_NAME || 'aws_framework_test';

  /*
   * This creates and migrates whatever it is pointed at, and `.env.test` is an
   * ordinary file somebody can mistype. Refusing the development name costs
   * nothing and keeps the database holding a developer's own data out of reach.
   */
  if (database === 'aws_framework') {
    throw new Error(
      `Refusing to set up "${database}": that is the development database. ` +
        `Check DATABASE_NAME in packages/backend/.env.test.`
    );
  }

  const admin = new Client({ host, port, user, password, database: 'postgres' });

  try {
    await admin.connect();
  } catch (error) {
    throw new Error(
      `Could not reach Postgres at ${host}:${port} — ${
        error instanceof Error ? error.message : String(error)
      }\n\nStart it first:\n  docker compose up -d postgres`
    );
  }

  try {
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);

    if (existing.rowCount === 0) {
      // The name cannot be a bound parameter in CREATE DATABASE, and it comes
      // from a local env file rather than a request — but quote it anyway, so a
      // name with a hyphen works and nothing can be appended to it.
      await admin.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
      console.log(`Created ${database}`);
    } else {
      console.log(`${database} already exists`);
    }
  } finally {
    await admin.end();
  }

  console.log('Running migrations…');
  execFileSync('npx', ['node-pg-migrate', 'up', '-m', 'migrations'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: `postgresql://${user}:${password}@${host}:${port}/${database}`,
    },
  });

  console.log(`\n${database} is ready. Run the suite with: npm test`);
}

/* Only when run as a script, so importing it in a test does not start it. */
if (require.main === module) {
  setupTestDatabase().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
