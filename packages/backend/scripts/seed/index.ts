#!/usr/bin/env ts-node
/**
 * Demo seed for the events capability.
 *
 * Puts the system into a known state: one organisation type, three pony clubs,
 * a super admin, an administrator per club, eight members holding fifteen
 * memberships across them, and thirteen events covering every entry-window
 * state, both limit mechanisms, quantity, all three payment arrangements, four
 * application forms and seven discounts.
 *
 * ## Running it
 *
 *   npm run seed:demo -- --reset     wipe all application data, then seed
 *   npm run seed:demo -- --reset-only wipe all application data and stop
 *   npm run seed:demo -- --dry-run   report what it would do, change nothing
 *   npm run seed:demo                seed on top of what is there (rarely what you want)
 *
 * ## Why it refuses to run by default
 *
 * `--reset` deletes every organisation, event, membership, form, discount and
 * user login in the database, and every Keycloak user it can prove it created.
 * That is exactly what was asked for and it is unrecoverable, so the script
 * checks where it is pointed before doing any of it:
 *
 *   - `NODE_ENV=production` is refused outright, with no override.
 *   - A database host that is not localhost is refused unless
 *     `SEED_ALLOW_REMOTE_DB=yes` is set.
 *   - A Keycloak URL that is not localhost is refused on the same terms.
 *
 * The guards are deliberately environment-based rather than a prompt: this will
 * end up in a CI job or an npm script eventually, and a prompt that can be
 * piped past is not a guard.
 */

import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Pool } from 'pg';
import {
  ACCOUNT_USERS,
  EVENTS,
  MEMBERS,
  MEMBERSHIP_TYPES,
  CALENDARS,
  MERCHANDISE,
  ORGS,
  ORG_ADMINS,
  ORG_TYPE,
  SEED_PASSWORD,
  SUPER_ADMIN,
} from './dataset';
import {
  addUserToGroup,
  connectKeycloak,
  ensureOrgGroups,
  ensureRealmRole,
  keycloakConfigFromEnv,
  purgeSeededKeycloak,
  upsertUser,
} from './keycloak';
import { collectKnownEmails, resetDatabase, seedDatabase } from './database';

const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const DRY_RUN = args.includes('--dry-run');
/** Clear everything and stop, leaving the system empty rather than re-seeded. */
const RESET_ONLY = args.includes('--reset-only');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres', 'keycloak', 'host.docker.internal']);

const log = (msg: string) => process.stdout.write(`${msg}\n`);
const fail = (msg: string): never => {
  process.stderr.write(`\n✖ ${msg}\n\n`);
  process.exit(1);
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function guard(): { dbHost: string; dbName: string; kcUrl: string } {
  if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
    fail('NODE_ENV is production. This script will not run against a production environment.');
  }

  const dbHost = process.env.DATABASE_HOST || 'localhost';
  const dbName = process.env.DATABASE_NAME || 'aws_framework';
  const kcUrl = process.env.KEYCLOAK_ADMIN_BASE_URL || process.env.KEYCLOAK_URL || 'http://localhost:8080';

  if (!LOCAL_HOSTS.has(dbHost) && process.env.SEED_ALLOW_REMOTE_DB !== 'yes') {
    fail(
      `Database host is "${dbHost}", which is not local.\n` +
        `  This script deletes all application data. If you really mean to point it there,\n` +
        `  re-run with SEED_ALLOW_REMOTE_DB=yes.`
    );
  }

  if (!LOCAL_HOSTS.has(hostOf(kcUrl)) && process.env.SEED_ALLOW_REMOTE_KEYCLOAK !== 'yes') {
    fail(
      `Keycloak is at "${kcUrl}", which is not local.\n` +
        `  This script deletes Keycloak users. If you really mean it,\n` +
        `  re-run with SEED_ALLOW_REMOTE_KEYCLOAK=yes.`
    );
  }

  return { dbHost, dbName, kcUrl };
}

async function main(): Promise<void> {
  const { dbHost, dbName, kcUrl } = guard();

  log('');
  log('  Its Plain Sailing — events demo seed');
  log(`  database : ${dbHost}/${dbName}`);
  log(`  keycloak : ${kcUrl} (realm ${process.env.KEYCLOAK_ADMIN_REALM || process.env.KEYCLOAK_REALM || 'aws-framework'})`);
  const mode = DRY_RUN
    ? 'dry run — nothing will change'
    : RESET_ONLY
      ? 'RESET ONLY — clears everything and stops'
      : RESET
        ? 'RESET then seed'
        : 'seed only';
  log(`  mode     : ${mode}`);
  log('');

  if (DRY_RUN) {
    log('  Would create:');
    log(`    1 organisation type   ${ORG_TYPE.displayName}`);
    log(`    ${ORGS.length} organisations       ${ORGS.map((o) => o.displayName).join(', ')}`);
    log(`    1 super admin         ${SUPER_ADMIN.email}`);
    log(`    ${Object.keys(ORG_ADMINS).length} organisation admins`);
    log(`    ${ACCOUNT_USERS.length} account logins      across ${ACCOUNT_USERS.reduce((n, u) => n + u.orgs.length, 0)} club affiliations`);
    log(`    ${MEMBERSHIP_TYPES.length} membership types    ${MEMBERS.length} members for this season`);
    log(`    ${MERCHANDISE.length} shop products     at ${ORGS.find((o) => o.extraCapabilities?.includes('merchandise'))?.displayName}`);
    log(`    ${CALENDARS.length} calendars         at ${ORGS.find((o) => o.extraCapabilities?.includes('calendar-bookings'))?.displayName}`);
    log(`    ${EVENTS.length} events              ${EVENTS.reduce((n, e) => n + e.activities.length, 0)} activities`);
    log('');
    if (RESET) log('  Would first DELETE all application data and every seeded Keycloak user.');
    log('');
    return;
  }

  const pool = new Pool({
    host: dbHost,
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    database: dbName,
    user: process.env.DATABASE_USER || 'framework_user',
    password: process.env.DATABASE_PASSWORD || 'framework_password',
  });

  const keycloak = await connectKeycloak(keycloakConfigFromEnv()).catch((error): never =>
    fail(`Could not reach Keycloak at ${kcUrl}: ${(error as Error).message}`)
  );

  const client = await pool.connect();

  try {
    /*
     * The reset and the seed share one transaction.
     *
     * They used to be two: the reset committed, then the seed opened its own
     * transaction. A seed that failed after that — against a database missing a
     * migration, say — rolled back its own work and left the database wiped and
     * empty, which is the worst of the two outcomes and the one nobody asks
     * for. Sharing a transaction means a failed seed leaves everything exactly
     * as it was found.
     *
     * `--reset-only` is the deliberate exception: clearing and stopping is the
     * whole point of it, so it commits on its own.
     */
    let emails: string[] = [];

    if (RESET || RESET_ONLY) {
      // Emails must be read before the tables are cleared — afterwards there is
      // no way to tell which realm users belonged to the platform.
      emails = await collectKnownEmails(client);
    }

    await client.query('BEGIN');

    if (RESET || RESET_ONLY) {
      const deleted = await resetDatabase(client);
      const totalRows = Object.values(deleted).reduce((a, b) => a + b, 0);
      log(`  reset: ${totalRows} rows deleted across ${Object.keys(deleted).length} tables`);

      if (RESET_ONLY) {
        await client.query('COMMIT');
        const purged = await purgeSeededKeycloak(keycloak, emails);
        log(`  reset: ${purged.usersDeleted} Keycloak users, ${purged.groupsDeleted} group trees removed`);
        log('');
        log('  --reset-only: stopping here. Nothing was seeded.');
        log('');
        return;
      }
    }

    /*
     * Keycloak cannot join the transaction, so it is cleared here — after the
     * database rows are gone but before the new users are made. A failure
     * between the two leaves orphaned realm users, which the next run adopts by
     * username rather than duplicating.
     */
    if (RESET) {
      const purged = await purgeSeededKeycloak(keycloak, emails);
      log(`  reset: ${purged.usersDeleted} Keycloak users, ${purged.groupsDeleted} group trees removed`);
      log('');
    }

    /* --- Keycloak users: the database needs the ids they hand back ------- */
    const superAdminId = await upsertUser(keycloak, SUPER_ADMIN);
    await ensureRealmRole(keycloak, superAdminId, 'super-admin');
    log(`  keycloak: super admin ${SUPER_ADMIN.email}`);

    const groups: Record<string, { orgGroupId: string; adminsGroupId: string; membersGroupId: string }> = {};
    const orgAdminIds: Record<string, string> = {};

    for (const org of ORGS) {
      groups[org.key] = await ensureOrgGroups(keycloak, ORG_TYPE.name, org.name);
      const admin = ORG_ADMINS[org.key];
      orgAdminIds[org.key] = await upsertUser(keycloak, admin);
      await addUserToGroup(keycloak, orgAdminIds[org.key], groups[org.key].adminsGroupId);
      log(`  keycloak: ${org.displayName} — admin ${admin.email}`);
    }

    const accountUserIds: Record<string, string> = {};
    for (const user of ACCOUNT_USERS) {
      accountUserIds[user.email] = await upsertUser(keycloak, user);
      for (const orgKey of user.orgs) {
        await addUserToGroup(keycloak, accountUserIds[user.email], groups[orgKey].membersGroupId);
      }
    }
    log(`  keycloak: ${ACCOUNT_USERS.length} member logins`);
    log('');

    /* --- then the database, in the transaction opened above ------------- */
    const result = await seedDatabase(client, {
      superAdminId,
      orgAdminIds,
      accountUserIds,
      groups,
    });
    await client.query('COMMIT');

    log('  seeded:');
    Object.entries(result.counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([table, count]) => log(`    ${String(count).padStart(5)}  ${table}`));

    printCredentials();
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function printCredentials(): void {
  log('');
  log('  ─────────────────────────────────────────────────────────────');
  log(`  Every login below uses the password:  ${SEED_PASSWORD}`);
  log('  ─────────────────────────────────────────────────────────────');
  log('');
  log('  Platform admin  (http://localhost:5174)');
  log(`    ${SUPER_ADMIN.email}`);
  log('');
  log('  Organisation admins  (http://localhost:5175)');
  ORGS.forEach((org) => log(`    ${ORG_ADMINS[org.key].email.padEnd(34)} ${org.displayName}`));
  log('');
  log('  Members  (http://localhost:5176/account/<code>)');
  ACCOUNT_USERS.forEach((user) => {
    const codes = user.orgs.map((k) => ORGS.find((o) => o.key === k)!.urlCode).join(', ');
    const note = user.status === 'pending' ? '  [awaiting approval]' : '';
    log(`    ${user.email.padEnd(34)} ${codes}${note}`);
  });
  log('');
  log('  Membership types  (per club: Junior, Senior, Family, Associate; Founder at KHPC)');
  ORGS.forEach((org) => {
    const count = MEMBERS.filter((m) => m.org === org.key).length;
    log(`    ${org.displayName.padEnd(26)} ${count} members this season`);
  });
  log('');
  /*
   * Grouped by holder *and club*, which is how C4 lists them. Counting across
   * clubs would report someone with one membership in each of three as a parent
   * holding three, which is a different thing entirely.
   */
  log('  Logins holding more than one membership in the same club');
  const byHolder = new Map<string, number>();
  MEMBERS.forEach((m) => {
    const key = `${m.email}\u0000${m.org}`;
    byHolder.set(key, (byHolder.get(key) ?? 0) + 1);
  });
  [...byHolder.entries()]
    .filter(([, count]) => count > 1)
    .forEach(([key, count]) => {
      const [email, orgKey] = key.split('\u0000');
      const club = ORGS.find((o) => o.key === orgKey)!.displayName;
      log(`    ${email.padEnd(34)} ${count} in ${club}`);
    });
  log('');
  const dueSoon = MEMBERS.filter((m) => m.season === 'expiring').length;
  log(`  ${dueSoon} memberships are due for renewal within the next 30 days.`);
  log('');
  const shopOrgs = ORGS.filter((o) => o.extraCapabilities?.includes('merchandise'));
  shopOrgs.forEach((org) => {
    const products = MERCHANDISE.filter((m) => m.org === org.key);
    log(`  Shop  (${org.displayName} only — the other clubs have no merchandise capability)`);
    log(`    ${products.length} products, covering free / fixed / quantity-based delivery,`);
    log('    tracked and untracked stock, a sold-out item, a hidden one and an inactive one.');
  });
  log('');
  const bookingOrgs = ORGS.filter((o) => o.extraCapabilities?.includes('calendar-bookings'));
  bookingOrgs.forEach((org) => {
    const calendars = CALENDARS.filter((c) => c.org === org.key);
    log(`  Bookings  (${org.displayName} only — the other clubs have no calendar capability)`);
    log(`    ${calendars.length} calendars: ${calendars.map((c) => c.name).join(', ')}`);
    log('    Covering exclusive and shared places, a fortnightly pattern, a blocked week,');
    log('    a recurring daily gap, cancellation allowed and refused, and a closed calendar.');
  });
  log('');
  log('  Discount codes: EARLYBIRD, SPRING24 (expired), BASKET10, WINTER20');
  log('');
}

main().catch((error) => {
  process.stderr.write(`\n✖ Seed failed: ${(error as Error).message}\n`);
  process.stderr.write(`${(error as Error).stack}\n`);
  process.exit(1);
});
