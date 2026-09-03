#!/usr/bin/env ts-node
/**
 * Demo seed for the events capability.
 *
 * Puts the system into a known state: one organisation type, four pony clubs, a
 * super admin, an administrator per club, members holding memberships across
 * them, and events covering every entry-window state, both limit mechanisms,
 * quantity, all three payment arrangements, application forms and discounts.
 *
 * Three of the clubs each leave something switched off on purpose, so that the
 * absence of a capability stays represented. **Meath Hunt Pony Club has every
 * capability**, including the registrations and event ticketing nothing else
 * exercises, so one login reaches the whole product.
 *
 * ## Stripe
 *
 * Each club is given a **test-mode connected account**, because a club without
 * one cannot take a card payment and the entire checkout path — authorisation,
 * capture, reversal, webhook — is then unreachable from a seeded database.
 *
 * These are created fresh against the platform's own `sk_test_` key. Nothing is
 * copied from a production platform: live and test are separate universes in
 * Stripe, and this application stores no per-organisation Stripe keys in any
 * case (see `docs/REMOVE_PER_ORG_STRIPE_KEYS.md`). A live key here is refused
 * outright, with no override.
 *
 * ## Running it
 *
 *   npm run seed:demo -- --reset     wipe all application data, then seed
 *   npm run seed:demo -- --reset-only wipe all application data and stop
 *   npm run seed:demo -- --dry-run   report what it would do, change nothing
 *   npm run seed:demo -- --no-stripe skip creating Stripe test connected accounts
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
  DISCOUNTS,
  ENTRIES,
  REGISTRATIONS,
  REGISTRATION_TYPES,
  SEED_TAG,
  capabilitiesFor,
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
  ensurePasswordCheckClient,
  purgeSeededKeycloak,
  upsertUser,
} from './keycloak';
import { collectKnownEmails, existingSeedData, resetDatabase, seedDatabase } from './database';
import {
  SeededConnectAccount,
  StripeSeeder,
  connectSettings,
  stripeConfigFromEnv,
  stripeUnavailableReason,
} from './stripe';

const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const DRY_RUN = args.includes('--dry-run');
/** Clear everything and stop, leaving the system empty rather than re-seeded. */
const RESET_ONLY = args.includes('--reset-only');
/**
 * Skip creating Stripe connected accounts.
 *
 * They are created by default when a **test** key is configured, because a club
 * without one cannot take a card payment and half the product is then
 * unreachable. This flag is for working offline, or when the Stripe account is
 * not to be touched.
 */
const NO_STRIPE = args.includes('--no-stripe');

/**
 * Leave the Keycloak realm alone on a reset.
 *
 * **The realm is shared; the database is not.** `--reset` deletes every seeded
 * realm user and creates them again with new ids, and it does that whatever
 * database it has been pointed at. Seed a scratch database with `--reset` and
 * the *development* database is left holding `organization_users` rows whose
 * `keycloak_user_id` no longer names anybody — every login then fails with
 * "User is not an organization administrator", and nothing in either place
 * looks wrong.
 *
 * With this flag the purge is skipped. `upsertUser` finds the existing users by
 * username and returns the ids they already have, so the realm comes through
 * untouched and no other database is orphaned.
 *
 * Implied whenever the target database is not the one this checkout normally
 * uses, because that is exactly the scratch-database case and nobody remembers
 * a flag for a hazard they have not met yet.
 */
const KEEP_KEYCLOAK = args.includes('--keep-keycloak');

/**
 * Seeding somewhere other than the development database.
 *
 * Keycloak and Stripe are **shared**: one realm and one test platform serve
 * whatever database is being seeded, so a scratch run's `--reset` reaches
 * straight into the environment the developer is using. It has done real
 * damage twice — orphaning every `organization_users.keycloak_user_id` in the
 * development database, and deleting the connected accounts the clubs there
 * point at.
 */
const scratchDatabase = (process.env.DATABASE_NAME ?? 'aws_framework') !== 'aws_framework';

/**
 * The realm is left alone for a scratch database whether the flag was passed or
 * not: that is exactly the case the hazard lives in, and nobody remembers a
 * flag for a hazard they have not met yet.
 */
const keepKeycloak = KEEP_KEYCLOAK || scratchDatabase;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres', 'keycloak', 'host.docker.internal']);

/**
 * The secret for the password-verification client.
 *
 * A fixed development value when nothing is set, because the backend and
 * Keycloak both have to know it and a generated one would be printed once and
 * lost. The seed refuses to run against a non-local Keycloak, so this default
 * can only ever reach a development realm; a deployed environment sets
 * `KEYCLOAK_PASSWORD_CHECK_CLIENT_SECRET` and gets its own.
 */
const PASSWORD_CHECK_SECRET =
  process.env.KEYCLOAK_PASSWORD_CHECK_CLIENT_SECRET || 'account-password-check-dev-secret';

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
    // Named from the data rather than hard-coded, so a club gaining or losing
    // a capability does not leave this line quietly lying.
    const clubsWith = (capability: string) =>
      ORGS.filter((o) => capabilitiesFor(o).includes(capability))
        .map((o) => o.displayName)
        .join(', ');

    log(`    ${MERCHANDISE.length} shop products     at ${clubsWith('merchandise')}`);
    log(`    ${CALENDARS.length} calendars         at ${clubsWith('calendar-bookings')}`);
    log(`    ${EVENTS.length} events             ${EVENTS.reduce((n, e) => n + e.activities.length, 0)} activities`);
    log(`    ${REGISTRATION_TYPES.length} registration types  ${REGISTRATIONS.length} registered ${REGISTRATION_TYPES[0]?.entityName.toLowerCase() ?? 'entities'}s at ${clubsWith('registrations')}`);
    log('');
    const stripeReason = stripeUnavailableReason(stripeConfigFromEnv());
    log(
      NO_STRIPE
        ? '  Would skip Stripe (--no-stripe).'
        : stripeReason
          ? `  Would skip Stripe — ${stripeReason}.`
          : `  Would create ${ORGS.length} Stripe test connected accounts, one per club.` +
            (RESET && scratchDatabase
              ? ' Existing accounts would be left alone — seeding a scratch database.'
              : '')
    );
    log('');
    if (RESET) {
      log(
        keepKeycloak
          ? '  Would first DELETE all application data. Keycloak users would be left alone.'
          : '  Would first DELETE all application data and every seeded Keycloak user.'
      );
    }
    if (RESET && !NO_STRIPE && !stripeReason) {
      log('  Would first delete the Stripe test accounts a previous run created.');
    }
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

  const client = await pool.connect();

  /*
   * Refuse a second seed into a database that already holds one — before
   * Keycloak is touched and before Stripe creates anything.
   *
   * This used to be discovered by the first `INSERT` instead, several hundred
   * lines and four live Stripe connected accounts later, and reported as
   * `duplicate key value violates unique constraint "organization_types_name_key"`.
   * The seed builds a fixture from an empty database rather than merging into a
   * populated one, so the answer is always `--reset`; saying so here costs one
   * query and saves the whole doomed run.
   */
  if (!RESET && !RESET_ONLY) {
    const already = await existingSeedData(client).catch((error): never => {
      client.release();
      return fail(`Could not read the database at ${dbHost}/${dbName}: ${(error as Error).message}`);
    });

    if (already) {
      client.release();
      await pool.end();
      fail(
        `${dbHost}/${dbName} already has ${already}.\n\n` +
          `  The seed builds its fixture from an empty database; it does not merge into one\n` +
          `  that already holds it. Choose one:\n\n` +
          `    npm run seed:demo -- --reset        wipe all application data, then seed\n` +
          `    npm run seed:demo -- --reset-only   wipe it and stop\n` +
          `    npm run seed:demo -- --dry-run      show what a seed would write, and change nothing`
      );
    }
  }

  const keycloak = await connectKeycloak(keycloakConfigFromEnv()).catch((error): never =>
    fail(`Could not reach Keycloak at ${kcUrl}: ${(error as Error).message}`)
  );

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
        if (keepKeycloak) {
          log('  reset: Keycloak left alone — see --keep-keycloak.');
        } else {
          const purged = await purgeSeededKeycloak(keycloak, emails);
          log(`  reset: ${purged.usersDeleted} Keycloak users, ${purged.groupsDeleted} group trees removed`);
        }
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
    if (RESET && keepKeycloak) {
      log(
        dbName === 'aws_framework'
          ? '  keycloak: left alone (--keep-keycloak). Existing users are reused.'
          : `  keycloak: left alone — seeding "${dbName}" rather than the development database.`
      );
      log('            Realm users are shared, so purging them here would orphan');
      log('            the logins of every other database pointed at this realm.');
      log('');
    }

    if (RESET && !keepKeycloak) {
      const purged = await purgeSeededKeycloak(keycloak, emails);
      log(`  reset: ${purged.usersDeleted} Keycloak users, ${purged.groupsDeleted} group trees removed`);
      log('');
    }

    /* --- The client that lets the backend verify a member's password ----- */
    const passwordCheck = await ensurePasswordCheckClient(
      keycloak,
      process.env.KEYCLOAK_PASSWORD_CHECK_CLIENT_ID || 'account-password-check',
      PASSWORD_CHECK_SECRET
    );
    log(
      `  ${passwordCheck.created ? 'created' : 'reconciled'} Keycloak client ` +
        `"${process.env.KEYCLOAK_PASSWORD_CHECK_CLIENT_ID || 'account-password-check'}"`
    );
    log('');

    /* --- Keycloak users: the database needs the ids they hand back ------- */
    const superAdminId = await upsertUser(keycloak, SUPER_ADMIN);
    /*
     * **Both** roles, because the Platform Admin needs both.
     *
     * `admin.routes` applies `requireAdminRole()` — the `admin` realm role — at
     * router level, and it is mounted on `/api/admin` *before* the more
     * specific routers, so it guards every path under that prefix. The
     * individual handlers then require `super-admin` on top.
     *
     * Granting only `super-admin`, as this did, produced a super admin who
     * could sign into the admin app and get a 403 from every request in it —
     * including the ones that list what the screen is meant to show.
     */
    for (const role of ['super-admin', 'admin']) {
      await ensureRealmRole(keycloak, superAdminId, role);
    }
    log(`  keycloak: super admin ${SUPER_ADMIN.email}  [super-admin, admin]`);

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

    /*
     * --- Stripe connected accounts --------------------------------------
     *
     * Created before the database rows so each club's account id can be
     * written into its settings in the same transaction. Stripe cannot join
     * that transaction, so a seed that fails afterwards leaves the accounts
     * behind — harmless, and the next `--reset` deletes them by their metadata.
     *
     * Nothing here copies anything from a production platform. Live and test
     * are separate universes in Stripe, and this application keeps no
     * per-organisation keys in any case — only an account id.
     */
    const connectByOrg: Record<string, Record<string, unknown>> = {};
    const stripeReason = stripeUnavailableReason(stripeConfigFromEnv());

    if (NO_STRIPE) {
      log('  stripe: skipped (--no-stripe)');
      log('');
    } else if (stripeReason) {
      log(`  stripe: skipped — ${stripeReason}`);
      log('  stripe: clubs will show as not connected and cannot take card payments');
      log('');
    } else {
      const stripe = new StripeSeeder(stripeConfigFromEnv());

      /*
       * Not for a scratch database. The connected accounts belong to the shared
       * test platform, and the development database's clubs point at them by
       * id in `settings.stripeConnect` — deleting them there leaves that
       * environment unable to take a card payment, with nothing on screen
       * saying why.
       */
      if (RESET && scratchDatabase) {
        log('  stripe: existing accounts left alone — seeding a scratch database');
      } else if (RESET) {
        const purged = await stripe.purgeSeededAccounts(SEED_TAG);
        log(`  stripe: ${purged.deleted} seeded test accounts removed${purged.failed ? `, ${purged.failed} could not be` : ''}`);
      }

      const now = new Date();
      const created: Array<{ org: (typeof ORGS)[number]; account: SeededConnectAccount }> = [];

      for (const org of ORGS) {
        const account = await stripe.createTestAccount({
          displayName: org.displayName,
          email: org.contactEmail,
          seedTag: SEED_TAG,
        });
        created.push({ org, account });
        log(`  stripe: ${org.displayName} — ${account.accountId}`);
      }

      // One pass for whatever Stripe had not finished verifying, rather than
      // waiting on each account in turn. Says so, because it can take half a
      // minute and a silent pause reads as a hang.
      if (created.some((c) => !c.account.chargesEnabled)) {
        log('  stripe: waiting for Stripe to finish verifying…');
      }
      await stripe.reconcile(created.map((c) => c.account));

      for (const { org, account } of created) {
        connectByOrg[org.key] = connectSettings(account, now);
      }

      const notReady = created.filter((c) => !c.account.chargesEnabled);
      if (notReady.length > 0) {
        log('');
        log(`  stripe: ${notReady.map((c) => c.org.displayName).join(', ')} still verifying.`);
        log('          Stripe finishes on its own; opening that club\'s Payment Settings');
        log('          re-reads the account and clears it.');
      }
      log('');
    }

    /* --- then the database, in the transaction opened above ------------- */
    const result = await seedDatabase(
      client,
      {
        superAdminId,
        orgAdminIds,
        accountUserIds,
        groups,
      },
      connectByOrg
    );
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
  ORGS.forEach((org) => {
    const note = org.allCapabilities ? '  [every capability]' : '';
    log(`    ${ORG_ADMINS[org.key].email.padEnd(34)} ${org.displayName}${note}`);
  });
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
  /*
   * Derived from the capability rather than from `extraCapabilities`, which
   * misses the club that takes everything through `allCapabilities` — it listed
   * Kildare as the only shop while Meath quietly had one too.
   */
  const clubsWith = (capability: string) =>
    ORGS.filter((o) => capabilitiesFor(o).includes(capability));

  const shopOrgs = clubsWith('merchandise');
  log(`  Shop  (${shopOrgs.map((o) => o.displayName).join(', ')})`);
  shopOrgs.forEach((org) => {
    const products = MERCHANDISE.filter((m) => m.org === org.key);
    log(`    ${String(products.length).padStart(2)} products  ${org.displayName}`);
  });
  log('    Covering free / fixed / quantity-based delivery, tracked and untracked');
  log('    stock, a sold-out item, a hidden one and an inactive one.');
  log('');

  const bookingOrgs = clubsWith('calendar-bookings');
  log(`  Bookings  (${bookingOrgs.map((o) => o.displayName).join(', ')})`);
  bookingOrgs.forEach((org) => {
    const calendars = CALENDARS.filter((c) => c.org === org.key);
    log(`    ${org.displayName.padEnd(26)} ${calendars.map((c) => c.name).join(', ')}`);
  });
  log('    Covering exclusive and shared places, a fortnightly pattern, a blocked week,');
  log('    a recurring daily gap, cancellation allowed and refused, and a closed calendar.');
  log('');

  const registrationOrgs = clubsWith('registrations');
  if (registrationOrgs.length > 0) {
    log(`  Registrations  (${registrationOrgs.map((o) => o.displayName).join(', ')})`);
    REGISTRATION_TYPES.forEach((type) => {
      const mine = REGISTRATIONS.filter((r) => r.type === type.key);
      const period = type.rolling ? `rolling, ${type.numberOfMonths} months` : 'annual, fixed end date';
      log(`    ${type.name.padEnd(26)} ${type.entityName}  (${period})  ${mine.length} registered`);
    });
    log('    A registration is about an animal, not a person: the horse, its passport');
    log('    and its owner, held under the member whose login it sits on.');
    log('');
  }

  const ticketedEvents = EVENTS.filter((e) => e.ticketing);
  if (ticketedEvents.length > 0) {
    log('  Electronic tickets');
    ticketedEvents.forEach((event) => {
      const org = ORGS.find((o) => o.key === event.org)!;
      const issued = ENTRIES.filter((entry) => entry.event === event.key);
      const scanned = issued.filter((entry) => entry.ticket?.state?.startsWith('scanned')).length;

      log(
        `    ${event.name.padEnd(34)} ${org.displayName.padEnd(24)} ` +
          `${issued.length} issued, ${scanned} scanned`
      );
    });
    log('    A ticket is issued for every entry on a ticketing event, as fulfilment does.');
    log('    The completed gate day carries the scans: one presented twice, one never used,');
    log('    one cancelled — which is what the scan history and the stats cards are for.');
    log('');
  }

  log('  Discounts');
  ORGS.forEach((org) => {
    const mine = DISCOUNTS.filter((d) => d.org === org.key);
    const byModule = [...new Set(mine.map((d) => d.module))]
      .map((m) => `${m} ${mine.filter((d) => d.module === m).length}`)
      .join(', ');
    log(`    ${org.displayName.padEnd(26)} ${mine.length}  (${byModule})`);
  });
  const codes = DISCOUNTS.filter((d) => d.code).map((d) => d.code);
  log(`    codes: ${codes.join(', ')}`);
  log('');
}

main().catch((error) => {
  process.stderr.write(`\n✖ Seed failed: ${(error as Error).message}\n`);
  process.stderr.write(`${(error as Error).stack}\n`);
  process.exit(1);
});
