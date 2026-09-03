import { PoolClient } from 'pg';
/*
 * The cart's own fee arithmetic, not a copy of it. A fixture that computed
 * handling fees its own way would be a second implementation of the rule the
 * member is charged by, and the two would drift.
 */
import { allocateHandlingFee, calculateHandlingFee } from '../../src/utils/handling-fee';
import { randomUUID } from 'crypto';
import { productArtwork } from './artwork';
import { signTicketCode } from '../../src/services/ticket-token.service';
import {
  birthDateForAge,
  dateOnly,
  dayOffset,
  membershipEnd,
  seasonEnd,
} from './dates';
import {
  ACCOUNT_USERS,
  BOOKINGS,
  DISCOUNTS,
  ENTRIES,
  EVENTS,
  EVENT_TYPES,
  FIELDS,
  FORMS,
  CALENDARS,
  MEMBERS,
  MEMBERSHIP_TYPES,
  MERCHANDISE,
  SHOP_ORDERS,
  REFUNDS,
  ANNOUNCEMENTS,
  REGISTRATIONS,
  REGISTRATION_TYPES,
  SeedEntry,
  SeedMember,
  SeedRegistration,
  capabilitiesFor,
  ORGS,
  ORG_ADMINS,
  ORG_ADMIN_ALSO_ADMINISTERS,
  ORG_TYPE,
  SUPER_ADMIN,
  SeedOrg,
  VENUES,
  assertEventDates,
} from './dataset';

/**
 * Database side of the seed.
 *
 * Two things are worth knowing before reading the SQL.
 *
 * **Column naming is inconsistent and it is not a typo here.** The platform
 * tables use American spelling (`organizations`, `organization_users`,
 * `organization_id`) while the feature tables added later use British
 * (`events.organisation_id`, `discounts.organisation_id`,
 * `application_forms.organisation_id`). Both spellings below are deliberate and
 * match what is actually in the schema.
 *
 * **Everything runs in one transaction.** A seed that half-applies is worse
 * than one that fails: the operator is left with three organisations, one set
 * of events and no obvious way to tell what is missing.
 */

export { dayOffset };

/**
 * Plausible answers for a member's application form.
 *
 * Keyed by the field's `name`, which is what `application_fields` stores and
 * what the form renderer reads back — keying by the seed's own field keys would
 * produce submissions that display as empty.
 */
/**
 * A registration's answers, keyed the way the form renderer reads them.
 *
 * The dataset writes answers under the seed's own field keys (`horseName`)
 * because that is what a human editing it can follow; `form_submissions`
 * has to hold the field *names* (`horse_name`). Translating here keeps the
 * dataset readable without producing submissions that display as blanks.
 *
 * A field the dataset does not answer is simply absent rather than empty: the
 * optional ones — a stable name, a microchip — are optional precisely so some
 * registrations can be missing them.
 */
const registrationSubmission = (
  registration: SeedRegistration
): Record<string, unknown> => {
  const byKey = new Map(FIELDS.map((field) => [field.key, field.name]));
  const answers: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(registration.answers)) {
    const name = byKey.get(key);
    if (!name) {
      throw new Error(
        `${registration.entityName} answers "${key}", which is not a field in FIELDS.`
      );
    }
    answers[name] = value;
  }

  return answers;
};

const memberSubmission = (member: SeedMember): Record<string, unknown> => {
  const county = { kildare: 'Kildare', laois: 'Laois', ward: 'Meath', meath: 'Meath' }[member.org];
  const junior = member.type === 'junior' || member.type === 'family';

  /*
   * No `rider_name`. The application carries the name.
   *
   * "Who is this membership for?" is answered on the application and travels to
   * `createMembership` on the basket line; the membership forms no longer have
   * the field, so answering it here would write an orphan key into
   * `submission_data` that no form displays.
   */
  return {
    // An age, resolved against the run date. A fixed birth year would quietly
    // turn a junior member into an adult a few seasons from now.
    rider_dob: birthDateForAge(junior ? 13 : 38),
    rider_email: member.email,
    rider_phone: '+353 87 000 0000',
    age_group: junior ? 'Under 12' : '18+',
    address_line: '1 Main Street',
    county,
    guardian_name: junior ? 'Parent or guardian on file' : '',
    guardian_phone: junior ? '+353 87 111 1111' : '',
    emergency_contact_name: 'Emergency contact on file',
    emergency_contact_phone: '+353 87 222 2222',
    medical_notes: '',
    photo_consent: true,
  };
};

/**
 * Answers for an entry's application form.
 *
 * Keyed by field `name`, like every other submission the seed writes. The
 * entrant's own name leads — an entry is *about* the person named on it, not
 * about whoever's login it sits under, and a form filled in with the account
 * holder's name for every child would misrepresent the one thing these rows
 * exist to demonstrate.
 *
 * Deliberately partial. The seeded entry forms ask for more than this, and a
 * submission that answers only what it plausibly knows is the honest fixture:
 * `shortEntry` is satisfied, `fullEntry` is not, and a screen that renders a
 * missing answer as blank is worth having something to render it against.
 */
const entrySubmission = (entry: SeedEntry): Record<string, unknown> => {
  const county = { kildare: 'Kildare', laois: 'Laois', ward: 'Meath', meath: 'Meath' }[entry.org];

  /*
   * No `rider_name`. The entry carries the name.
   *
   * "Who is this entry for?" is answered on the entry itself and written to
   * `event_entries.first_name` / `last_name`; an entry form that asks again
   * produces two names for one entrant, never reconciled. The entry forms no
   * longer have the field, so answering it here would write an orphan key into
   * `submission_data` that no form displays.
   */
  return {
    rider_email: entry.email,
    rider_phone: '+353 87 000 0000',
    pony_name: 'Cloud',
    county,
    emergency_contact_name: 'Emergency contact on file',
    emergency_contact_phone: '+353 87 222 2222',
  };
};

/**
 * A payment line, held back until every record it could belong to exists.
 *
 * Payments are written last rather than beside the thing they paid for,
 * because a basket holds several things and they are created in different
 * loops — an entry here, a membership there, a shop order later. Collecting the
 * lines and grouping them at the end is what lets one payment cover four of
 * them, which is what a real basket does and what the payment detail screen
 * exists to show.
 *
 * `basket` is the grouping key. Items that name the same one share a payment;
 * anything without a shared name gets its own, which is the ordinary case.
 */
interface PendingPaymentLine {
  basket: string;
  org: SeedOrg['key'];
  orgUserId: string;
  itemType: 'event_entry' | 'membership' | 'registration' | 'merchandise' | 'booking';
  contextId: string;
  contextRef: Record<string, unknown>;
  description: string;
  /** Minor units, as `payment_transactions.fee` holds it. */
  feeMinor: number;
  /**
   * Card or offline, per line rather than per basket.
   *
   * A basket can be settled both ways at once — some items paid for now, some
   * on the day — and the handling fee is charged only on the card side.
   */
  isCard: boolean;
  /**
   * Whether the item's price already absorbs its handling fee.
   *
   * Set on the item, not on the purchase: it is the club's decision about that
   * product or class. An included item is excluded from the fee-bearing base,
   * because charging on it bills the member twice.
   */
  handlingFeeIncluded: boolean;
  formSubmissionId: string | null;
  status: 'paid' | 'pending' | 'refunded';
  /** When it was bought. Backdates the payment and, where paid, the receipt. */
  on: Date;
  /**
   * The record the line produced.
   *
   * Written to `fulfilment_ref`, which is what the member's payment detail
   * follows to show who an entry was for and to link through to it. A seeded
   * payment without it is a payment whose lines lead nowhere.
   */
  fulfilmentRef: string;
}

export interface SeedResult {
  orgTypeId: string;
  orgIds: Record<string, string>;
  superAdminEmail: string;
  counts: Record<string, number>;
}

/* ------------------------------------------------------------------ reset */

/**
 * Every email the database knows about, gathered *before* anything is deleted.
 *
 * The Keycloak purge needs this: once `organization_users` is gone there is no
 * way left to work out which realm users belonged to the platform.
 */
export async function collectKnownEmails(client: PoolClient): Promise<string[]> {
  const emails: string[] = [];

  try {
    const result = await client.query(
      `SELECT DISTINCT email FROM organization_users WHERE email IS NOT NULL`
    );
    result.rows.forEach((r) => emails.push(r.email as string));
  } catch (error: unknown) {
    // An un-migrated database is not a reason to refuse to clean Keycloak. The
    // dataset's own emails below are enough to purge what this script created.
    if ((error as { code?: string }).code !== '42P01') throw error;
  }

  // The super admin has no organisation_users row — it is a realm role, not a
  // membership — so it would otherwise survive every reset.
  emails.push(SUPER_ADMIN.email);
  ACCOUNT_USERS.forEach((u) => emails.push(u.email));
  Object.values(ORG_ADMINS).forEach((a) => emails.push(a.email));
  return [...new Set(emails)];
}

/**
 * What a previous seed has already left in the database.
 *
 * The seed builds a known fixture from an empty database; it does not merge
 * into one that already holds it. Run twice without `--reset` it used to get as
 * far as the very first insert and fail on
 * `duplicate key value violates unique constraint "organization_types_name_key"`
 * — a message that names a constraint rather than the mistake, and says nothing
 * about the flag that fixes it.
 *
 * Worse, it got there **last**. By the time that insert runs the seed has
 * already reconciled every Keycloak user and created four live Stripe test
 * connected accounts, so each doomed re-run left four more of them behind.
 * Checked up front, before any of that, so a re-run costs nothing.
 *
 * Returns a description of what is already there, or null for a clean database.
 */
export async function existingSeedData(client: PoolClient): Promise<string | null> {
  const found: string[] = [];

  const orgType = await client.query('SELECT 1 FROM organization_types WHERE name = $1', [
    ORG_TYPE.name,
  ]);
  if (orgType.rowCount) found.push(`the "${ORG_TYPE.name}" organisation type`);

  const orgs = await client.query('SELECT name FROM organizations WHERE name = ANY($1)', [
    ORGS.map((o) => o.name),
  ]);
  if (orgs.rowCount) {
    found.push(
      orgs.rowCount === ORGS.length
        ? `all ${ORGS.length} of its clubs`
        : `${orgs.rowCount} of its ${ORGS.length} clubs`
    );
  }

  return found.length > 0 ? found.join(' and ') : null;
}

/**
 * Clears all application data.
 *
 * Ordered child-to-parent. Several of these tables do have `ON DELETE CASCADE`
 * from `organizations`, but not all of them do and relying on cascade would
 * make the blast radius depend on which migration last touched a foreign key.
 * Deleting explicitly means the list below *is* the blast radius, reviewable in
 * one place.
 *
 * `TRUNCATE ... CASCADE` was rejected for the opposite reason: it would silently
 * reach tables that are not named here.
 */
export async function resetDatabase(client: PoolClient): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  const tables = [
    // Money and carts first — they reference nearly everything else.
    'discount_usage',
    'discount_applications',
    'payment_transactions',
    'refunds',
    'payments',
    'cart_items',
    'carts',
    // Events and what hangs off them.
    'ticket_scan_history',
    'electronic_tickets',
    'event_entries',
    'event_ticketing_config',
    'event_activities',
    'events',
    'event_types',
    'venues',
    // Other capability modules, so a reset leaves nothing behind anywhere.
    'booking_history',
    'bookings',
    'slot_reservations',
    'blocked_periods',
    'schedule_rules',
    'time_slot_configurations',
    'duration_options',
    'calendars',
    'merchandise_order_history',
    'merchandise_orders',
    'merchandise_option_values',
    'merchandise_option_types',
    'merchandise_types',
    'delivery_rules',
    'registrations',
    'registration_filters',
    'registration_types',
    'members',
    'member_filters',
    'membership_number_sequences',
    'membership_types',
    // Forms and submissions.
    'form_submission_files',
    'form_submissions',
    'application_form_fields',
    'application_forms',
    'application_fields',
    // Discounts themselves, now that nothing references them.
    'organisation_announcements',
    'discounts',
    // Users, roles and the organisations they belong to.
    'user_group_members',
    'user_groups',
    'organization_user_roles',
    'organization_admin_roles',
    'organization_users',
    'user_onboarding_preferences',
    'org_payment_method_data',
    'organization_payment_application_fees',
    'organization_type_payment_fees',
    'organization_audit_log',
    'reports',
    'organizations',
    'organization_types',
  ];

  /*
   * Only delete from tables that actually exist.
   *
   * The obvious version wraps each DELETE in try/catch and swallows 42P01
   * ("relation does not exist"). That does not work inside a transaction: the
   * first failed statement aborts it, and every statement afterwards fails with
   * "current transaction is aborted" regardless of the catch. Asking the
   * catalogue first is both correct and cheaper than one round trip per miss.
   */
  const present = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [tables]
  );
  const existing = new Set(present.rows.map((r) => r.table_name as string));

  for (const table of tables) {
    if (!existing.has(table)) continue;
    const result = await client.query(`DELETE FROM ${table}`);
    if (result.rowCount) counts[table] = result.rowCount;
  }

  return counts;
}

/* ------------------------------------------------------------------- seed */

export async function seedDatabase(
  client: PoolClient,
  keycloak: {
    superAdminId: string;
    orgAdminIds: Record<string, string>;
    accountUserIds: Record<string, string>;
    groups: Record<string, { orgGroupId: string }>;
  },
  /**
   * Stripe connected accounts, keyed by organisation.
   *
   * Merged into `settings.stripeConnect`, which is the only per-club Stripe
   * state this application keeps. Absent when the seed ran without Stripe —
   * every club is then simply not connected, which is what an unconfigured
   * platform looks like anyway.
   */
  stripeConnect: Record<string, Record<string, unknown>> = {}
): Promise<SeedResult> {
  const counts: Record<string, number> = {};
  const bump = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);

  /* --- organisation type ------------------------------------------------ */

  /*
   * Every capability the seed is about to write must be a real one.
   *
   * The seed inserts straight into the table, so nothing would otherwise stop
   * it writing a name the platform has never heard of. The admin API validates
   * on *edit*, which means the failure surfaces much later and somewhere else:
   * a super-admin changing an unrelated field is told "Invalid capabilities
   * provided" about names they never entered.
   *
   * Checked here, once, against the same catalogue the API validates against.
   */
  const catalogue = await client.query('SELECT name FROM capabilities WHERE is_active = TRUE');
  const known = new Set(catalogue.rows.map((row: { name: string }) => row.name));
  const phantom = [
    ...new Set([
      ...ORG_TYPE.defaultCapabilities,
      ...ORGS.flatMap((org) => capabilitiesFor(org)),
    ]),
  ].filter((name) => !known.has(name));

  if (phantom.length > 0) {
    throw new Error(
      (phantom.length === 1
        ? `The seed names a capability that does not exist: ${phantom[0]}. `
        : `The seed names ${phantom.length} capabilities that do not exist: ${phantom.join(', ')}. `) +
        `Add it to the capabilities table, or correct ORG_TYPE.defaultCapabilities — an ` +
        `organisation carrying a name that is not a capability can be created and never edited again.`
    );
  }

  const typeResult = await client.query(
    `INSERT INTO organization_types
       (name, display_name, description, currency, language, default_locale,
        default_capabilities, membership_numbering, membership_number_uniqueness,
        initial_membership_number, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active')
     RETURNING id`,
    [
      ORG_TYPE.name,
      ORG_TYPE.displayName,
      ORG_TYPE.description,
      ORG_TYPE.currency,
      ORG_TYPE.language,
      ORG_TYPE.defaultLocale,
      JSON.stringify(ORG_TYPE.defaultCapabilities),
      ORG_TYPE.membershipNumbering,
      ORG_TYPE.membershipNumberUniqueness,
      ORG_TYPE.initialMembershipNumber,
    ]
  );
  const orgTypeId = typeResult.rows[0].id as string;
  bump('organization_types');

  /* --- payment methods available on the platform ------------------------ */
  const methodRows = await client.query(`SELECT id, name FROM payment_methods`);
  const methodId: Record<string, string> = {};
  methodRows.rows.forEach((r) => (methodId[r.name] = r.id));

  /*
   * Payment method **ids**, not names.
   *
   * `supported_payment_methods` is compared against `cart_items.payment_method_id`
   * — a uuid — and the org-admin pickers match on `pm.id` too. Storing the
   * seed's own slugs produced lists nothing could ever match, so every add to
   * basket was refused with "that payment method is not accepted for this item".
   */
  const methodIdsFor = (names: readonly string[]): string[] =>
    names.map((name) => methodId[name]).filter(Boolean);

  /* --- handling + application fees on the type -------------------------- */
  for (const name of ['pay-offline', 'stripe']) {
    if (!methodId[name]) continue;
    const isCard = name !== 'pay-offline';
    await client.query(
      `INSERT INTO organization_type_payment_fees
         (organization_type_id, payment_method_id, fixed_fee, percentage_fee, tax_percentage,
          application_fee_fixed, application_fee_percentage)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        orgTypeId,
        methodId[name],
        isCard ? ORG_TYPE.handlingFee.fixedFee : 0,
        isCard ? ORG_TYPE.handlingFee.percentageFee : 0,
        isCard ? ORG_TYPE.handlingFee.taxPercentage : 0,
        isCard ? ORG_TYPE.applicationFee.fixed : null,
        isCard ? ORG_TYPE.applicationFee.percentage : null,
      ]
    );
    bump('organization_type_payment_fees');
  }

  /* --- organisations ---------------------------------------------------- */
  const orgIds: Record<string, string> = {};

  for (const org of ORGS) {
    const result = await client.query(
      `INSERT INTO organizations
         (organization_type_id, keycloak_group_id, name, display_name, url_code, domain,
          contact_name, contact_email, status, currency, language, enabled_capabilities, settings)
       VALUES ($1,$2,$3,$4,$5,NULL,$6,$7,'active',$8,$9,$10,$11)
       RETURNING id`,
      [
        orgTypeId,
        keycloak.groups[org.key].orgGroupId,
        org.name,
        org.displayName,
        org.urlCode,
        org.contactName,
        org.contactEmail,
        ORG_TYPE.currency,
        ORG_TYPE.defaultLocale,
        JSON.stringify(capabilitiesFor(org)),
        // The club's own settings, plus its connected account when there is
        // one. `settings` is a single jsonb blob that several features share,
        // so this is a merge rather than a write.
        JSON.stringify(
          stripeConnect[org.key]
            ? { ...org.settings, stripeConnect: stripeConnect[org.key] }
            : org.settings
        ),
      ]
    );
    orgIds[org.key] = result.rows[0].id;
    bump('organizations');

    // Payment methods this club has switched on.
    for (const pm of org.paymentMethods) {
      if (!methodId[pm]) continue;
      await client.query(
        `INSERT INTO org_payment_method_data (organization_id, payment_method_id, status, payment_data)
         VALUES ($1,$2,'active','{}'::jsonb)`,
        [orgIds[org.key], methodId[pm]]
      );
      bump('org_payment_method_data');
    }

    // Copy-on-create of the platform share, matching what the application does
    // when an organisation is created through the admin UI.
    for (const pm of ['pay-offline', 'stripe']) {
      if (!methodId[pm]) continue;
      const isCard = pm !== 'pay-offline';
      const override = org.applicationFee;
      const fixed = !isCard ? null : override ? override.fixed : ORG_TYPE.applicationFee.fixed;
      const pct = !isCard ? null : override ? override.percentage : ORG_TYPE.applicationFee.percentage;
      await client.query(
        `INSERT INTO organization_payment_application_fees
           (organization_id, payment_method_id, application_fee_fixed, application_fee_percentage)
         VALUES ($1,$2,$3,$4)`,
        [orgIds[org.key], methodId[pm], fixed, pct]
      );
      bump('organization_payment_application_fees');
    }
  }

  /* --- users ------------------------------------------------------------ */
  const orgAdminRowIds: Record<string, string> = {};

  for (const org of ORGS) {
    const admin = ORG_ADMINS[org.key];
    const result = await client.query(
      `INSERT INTO organization_users
         (organization_id, keycloak_user_id, user_type, email, first_name, last_name, status)
       VALUES ($1,$2,'org-admin',$3,$4,$5,'active')
       RETURNING id`,
      [orgIds[org.key], keycloak.orgAdminIds[org.key], admin.email, admin.firstName, admin.lastName]
    );
    orgAdminRowIds[org.key] = result.rows[0].id;
    bump('organization_users');

    // A full-permission role, so the admin can reach every capability the
    // organisation has rather than signing in to an empty menu.
    const roleResult = await client.query(
      // `organization_id` here, American — unlike events/discounts/forms, which
      // use the British spelling. Both are in the live schema.
      `INSERT INTO organization_admin_roles
         (organization_id, name, display_name, description, capability_permissions, is_system_role)
       VALUES ($1,'full-administrator','Full Administrator',
               'Seeded role with every permission.',$2,true)
       RETURNING id`,
      [
        orgIds[org.key],
        // The club's own capabilities, not the type's: granting a role
        // something the club has not switched on gives an administrator menu
        // entries leading to endpoints that refuse them.
        JSON.stringify(
          Object.fromEntries(capabilitiesFor(org).map((c) => [c, 'admin']))
        ),
      ]
    );
    bump('organization_admin_roles');

    await client.query(
      `INSERT INTO organization_user_roles (organization_user_id, organization_admin_role_id)
       VALUES ($1,$2)`,
      [orgAdminRowIds[org.key], roleResult.rows[0].id]
    );
    bump('organization_user_roles');
  }

  /*
   * A second club for one administrator, so the switcher has something to show.
   *
   * Reuses the **same Keycloak identity** — which is the whole point, and what
   * `createAdminUser` now does for real when an address already exists. Given
   * the full-administrator role of the club being joined, not of their own:
   * roles are held in an organisation, and granting one club's permissions in
   * another is the escalation the role middleware was fixed to prevent.
   */
  for (const [adminKey, alsoAdministers] of Object.entries(ORG_ADMIN_ALSO_ADMINISTERS)) {
    const admin = ORG_ADMINS[adminKey as SeedOrg['key']];

    for (const targetKey of alsoAdministers ?? []) {
      const membership = await client.query(
        `INSERT INTO organization_users
           (organization_id, keycloak_user_id, user_type, email, first_name, last_name, status)
         VALUES ($1,$2,'org-admin',$3,$4,$5,'active')
         RETURNING id`,
        [
          orgIds[targetKey],
          keycloak.orgAdminIds[adminKey as SeedOrg['key']],
          admin.email,
          admin.firstName,
          admin.lastName,
        ]
      );
      bump('organization_users');

      const targetRole = await client.query(
        `SELECT id FROM organization_admin_roles
          WHERE organization_id = $1 AND name = 'full-administrator'`,
        [orgIds[targetKey]]
      );

      await client.query(
        `INSERT INTO organization_user_roles (organization_user_id, organization_admin_role_id)
         VALUES ($1,$2)`,
        [membership.rows[0].id, targetRole.rows[0].id]
      );
      bump('organization_user_roles');
    }
  }

  // Keyed by organisation then email: a member row points at the person's
  // membership *of that club*, and someone in three clubs has three of them.
  const accountUserRowIds: Record<string, Record<string, string>> = {};

  for (const user of ACCOUNT_USERS) {
    for (const orgKey of user.orgs) {
      const r = await client.query(
        `INSERT INTO organization_users
           (organization_id, keycloak_user_id, user_type, email, first_name, last_name, status)
         VALUES ($1,$2,'account-user',$3,$4,$5,$6)
         RETURNING id`,
        [
          orgIds[orgKey],
          keycloak.accountUserIds[user.email],
          user.email,
          user.firstName,
          user.lastName,
          user.status ?? 'active',
        ]
      );
      accountUserRowIds[orgKey] ??= {};
      accountUserRowIds[orgKey][user.email] = r.rows[0].id;
      bump('organization_users');
    }
  }

  /* --- event types and venues ------------------------------------------- */
  const eventTypeIds: Record<string, Record<string, string>> = {};
  const venueIds: Record<string, Record<string, string>> = {};

  for (const org of ORGS) {
    eventTypeIds[org.key] = {};
    venueIds[org.key] = {};

    for (const name of EVENT_TYPES) {
      const r = await client.query(
        `INSERT INTO event_types (organisation_id, name, description) VALUES ($1,$2,$3) RETURNING id`,
        [orgIds[org.key], name, `${name} events run by ${org.displayName}.`]
      );
      eventTypeIds[org.key][name] = r.rows[0].id;
      bump('event_types');
    }

    for (const venue of VENUES[org.key]) {
      const r = await client.query(
        `INSERT INTO venues (organisation_id, name, address, region)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [orgIds[org.key], venue.name, venue.address, venue.region]
      );
      venueIds[org.key][venue.name] = r.rows[0].id;
      bump('venues');
    }
  }

  /* --- application fields and forms ------------------------------------- */
  const fieldIds: Record<string, Record<string, string>> = {};
  const formIds: Record<string, Record<string, string>> = {};

  for (const org of ORGS) {
    fieldIds[org.key] = {};
    formIds[org.key] = {};

    for (const field of FIELDS) {
      const r = await client.query(
        `INSERT INTO application_fields
           (organisation_id, name, label, description, datatype, validation, options)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [
          orgIds[org.key],
          field.name,
          field.label[org.key],
          field.description ?? null,
          field.datatype,
          field.validation ? JSON.stringify(field.validation) : null,
          field.options ? JSON.stringify(field.options) : null,
        ]
      );
      fieldIds[org.key][field.key] = r.rows[0].id;
      bump('application_fields');
    }

    for (const form of FORMS) {
      const r = await client.query(
        `INSERT INTO application_forms (organisation_id, name, description, status)
         VALUES ($1,$2,$3,'active') RETURNING id`,
        [orgIds[org.key], form.name[org.key], form.description]
      );
      formIds[org.key][form.key] = r.rows[0].id;
      bump('application_forms');

      let order = 0;
      let lastGroup: string | undefined;
      let groupOrder = 0;
      for (const entry of form.fields) {
        if (entry.group && entry.group !== lastGroup) {
          groupOrder += 1;
          lastGroup = entry.group;
        }
        await client.query(
          `INSERT INTO application_form_fields
             (form_id, field_id, "order", group_name, group_order, wizard_step, wizard_step_title)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            formIds[org.key][form.key],
            fieldIds[org.key][entry.field],
            order++,
            entry.group ?? null,
            entry.group ? groupOrder : null,
            entry.wizardStep ?? null,
            entry.wizardStepTitle ?? null,
          ]
        );
        bump('application_form_fields');
      }
    }
  }

  /* --- discounts -------------------------------------------------------- */
  /*
   * Keyed by organisation *then* discount key.
   *
   * A flat key-to-id map let one club's discount attach to another's records:
   * membership types are defined once and created for every club, so a lookup
   * that ignored the organisation gave Ward's family membership Kildare's
   * discount. Scoping the map means a key resolves to this club's own version
   * or to nothing.
   */
  const discountIds: Record<string, Record<string, string>> = {};

  /**
   * The ids behind a list of discount keys, skipping any that were not seeded.
   *
   * Written to the entity's own `discount_ids` array, which is what the front
   * ends read to decide what to offer.
   */
  const discountIdsFor = (orgKey: SeedOrg['key'], keys?: string[]): string[] =>
    (keys ?? [])
      .map((key) => discountIds[orgKey]?.[key])
      .filter(Boolean) as string[];

  /**
   * The same attachment recorded the other way round, in
   * `discount_applications`.
   *
   * Both are written because both are in the schema and different code paths
   * read different ones — the entity array drives the screens, the join table
   * is what a "where is this discount used?" question is answered from.
   */
  const applyDiscounts = async (
    c: PoolClient,
    keys: string[] | undefined,
    targetType: string,
    targetId: string,
    orgKey: SeedOrg['key']
  ): Promise<void> => {
    for (const key of keys ?? []) {
      const discountId = discountIds[orgKey]?.[key];
      if (!discountId) continue;
      await c.query(
        `INSERT INTO discount_applications (discount_id, target_type, target_id, applied_by)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (discount_id, target_type, target_id) DO NOTHING`,
        [discountId, targetType, targetId, orgAdminRowIds[orgKey]]
      );
      bump('discount_applications');
    }
  };

  for (const discount of DISCOUNTS) {
    const r = await client.query(
      `INSERT INTO discounts
         (organisation_id, module_type, name, description, code, discount_type, discount_value,
          application_scope, quantity_rules, eligibility_criteria, valid_from, valid_until,
          usage_limits, combinable, priority, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id`,
      [
        orgIds[discount.org],
        discount.module,
        discount.name,
        discount.description,
        discount.code ?? null,
        discount.discountType,
        discount.discountValue,
        discount.applicationScope,
        discount.quantityRules ? JSON.stringify(discount.quantityRules) : null,
        discount.eligibilityCriteria ? JSON.stringify(discount.eligibilityCriteria) : null,
        discount.validFromDays !== undefined ? dayOffset(discount.validFromDays) : null,
        discount.validUntilDays !== undefined ? dayOffset(discount.validUntilDays) : null,
        discount.usageLimits ? JSON.stringify(discount.usageLimits) : null,
        discount.combinable ?? true,
        discount.priority ?? 0,
        discount.status ?? 'active',
        orgAdminRowIds[discount.org],
      ]
    );
    discountIds[discount.org] ??= {};
    discountIds[discount.org][discount.key] = r.rows[0].id;
    bump('discounts');
  }

  /**
   * Every payment line, written after all four loops have run.
   *
   * See `PendingPaymentLine`: a basket can hold an entry, a membership and a
   * shop order, and those are created in different places.
   */
  const paymentLines: PendingPaymentLine[] = [];

  /* --- events and activities -------------------------------------------- */
  /**
   * Event and activity ids, keyed the way `ENTRIES` names them.
   *
   * Event keys are unique across all four clubs, so this needs no organisation
   * level; activity names are unique within their event.
   */
  const eventIds: Record<string, string> = {};
  const activityIds: Record<string, Record<string, string>> = {};

  for (const event of EVENTS) {
    const orgId = orgIds[event.org];
    const eventDiscountIds = discountIdsFor(event.org, event.discounts);

    assertEventDates(event);

    const r = await client.query(
      `INSERT INTO events
         (organisation_id, name, description, event_owner, start_date, end_date,
          open_date_entries, entries_closing_date, limit_entries, entries_limit,
          add_confirmation_message, confirmation_message, status,
          event_type_id, venue_id, discount_ids,
          show_on_organisation_page, show_on_platform_page)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id`,
      [
        orgId,
        event.name,
        event.description,
        orgAdminRowIds[event.org],
        dateOnly(event.startDays),
        dateOnly(event.endDays),
        dayOffset(event.openDays),
        dayOffset(event.closeDays),
        event.limitEntries ?? false,
        event.entriesLimit ?? null,
        event.addConfirmationMessage ?? false,
        event.confirmationMessage ?? null,
        event.status,
        eventTypeIds[event.org][event.eventType],
        venueIds[event.org][event.venue],
        JSON.stringify(eventDiscountIds),
        // Defaulted here rather than relying on the column default, so the seed
        // states what it means for every row it writes.
        event.showOnOrganisationPage ?? false,
        event.showOnPlatformPage ?? false,
      ]
    );
    const eventId = r.rows[0].id as string;
    eventIds[event.key] = eventId;
    activityIds[event.key] = {};
    bump('events');

    /*
     * Electronic tickets, where the club has asked for them.
     *
     * Gated on the capability rather than on the dataset alone: an event
     * configured for ticketing under a club without `event-ticketing` would
     * write a row that no screen can reach, and silently.
     */
    if (event.ticketing) {
      if (!capabilitiesFor(ORGS.find((o) => o.key === event.org)!).includes('event-ticketing')) {
        throw new Error(
          `"${event.name}" is configured for tickets but ${event.org} has no event-ticketing ` +
            `capability. Add it to that organisation, or drop the ticketing block.`
        );
      }

      await client.query(
        `INSERT INTO event_ticketing_config
           (event_id, generate_electronic_tickets, ticket_header_text, ticket_instructions,
            ticket_footer_text, ticket_validity_period, ticket_background_color,
            ticket_layout)
         VALUES ($1,TRUE,$2,$3,$4,$5,$6,$7)`,
        [
          eventId,
          event.ticketing.headerText,
          event.ticketing.instructions,
          event.ticketing.footerText ?? '',
          event.ticketing.validityPeriod ?? null,
          event.ticketing.backgroundColour ?? null,
          // Absent means the default, which is what every ticket looked like
          // before a club could choose.
          event.ticketing.layout ?? 'stacked',
        ]
      );
      bump('event_ticketing_config');
    }

    for (const discountKey of event.discounts ?? []) {
      if (!discountIds[event.org]?.[discountKey]) continue;
      await client.query(
        `INSERT INTO discount_applications (discount_id, target_type, target_id, applied_by)
         VALUES ($1,'event',$2,$3)`,
        [discountIds[event.org][discountKey], eventId, orgAdminRowIds[event.org]]
      );
      bump('discount_applications');
    }

    const org = ORGS.find((o) => o.key === event.org) as SeedOrg;
    const clubHasCard = org.paymentMethods.includes('stripe');

    for (const activity of event.activities) {
      /*
       * A club without a card provider cannot offer card payment, whatever the
       * activity asks for. Seeding `card` on such a club would produce an
       * activity nobody can pay for, which looks like a bug rather than a
       * fixture.
       */
      const wanted =
        activity.payment === 'card' ? ['stripe'] :
        activity.payment === 'offline' ? ['pay-offline'] :
        ['pay-offline', 'stripe'];
      const supported = wanted.filter((m) => m === 'pay-offline' || clubHasCard);
      const effective = supported.length > 0 ? supported : ['pay-offline'];

      const activityDiscountIds = discountIdsFor(event.org, activity.discounts);

      const ar = await client.query(
        `INSERT INTO event_activities
           (event_id, name, description, show_publicly, application_form_id,
            limit_applicants, applicants_limit, allow_specify_quantity,
            use_terms_and_conditions, terms_and_conditions, fee,
            allowed_payment_method, handling_fee_included,
            discount_ids, supported_payment_methods, entry_eligibility, tickets_admit)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING id`,
        [
          eventId,
          activity.name,
          activity.description,
          activity.showPublicly ?? true,
          activity.form ? formIds[event.org][activity.form] : null,
          activity.limitApplicants ?? false,
          activity.applicantsLimit ?? null,
          activity.allowSpecifyQuantity ?? false,
          activity.useTermsAndConditions ?? false,
          activity.useTermsAndConditions
            ? 'Entries are non-refundable once the closing date has passed. Hats and body protectors to current standards are required.'
            : null,
          activity.fee,
          effective.length === 1 ? effective[0] : 'any',
          activity.handlingFeeIncluded ?? false,
          JSON.stringify(activityDiscountIds),
          JSON.stringify(methodIdsFor(effective)),
          // Defaulted here rather than relying on the column default, so the
          // seed states what it means for every row it writes.
          activity.entryEligibility ?? 'all',
          activity.ticketsAdmit ?? 1,
        ]
      );
      activityIds[event.key][activity.name] = ar.rows[0].id as string;
      bump('event_activities');

      for (const discountKey of activity.discounts ?? []) {
        if (!discountIds[event.org]?.[discountKey]) continue;
        await client.query(
          `INSERT INTO discount_applications (discount_id, target_type, target_id, applied_by)
           VALUES ($1,'event_activity',$2,$3)`,
          [discountIds[event.org][discountKey], ar.rows[0].id, orgAdminRowIds[event.org]]
        );
        bump('discount_applications');
      }
    }
  }

  /* --- membership types -------------------------------------------------- */
  const membershipTypeIds: Record<string, Record<string, string>> = {};

  for (const org of ORGS) {
    membershipTypeIds[org.key] = {};

    for (const type of MEMBERSHIP_TYPES) {
      if (type.onlyOrgs && !type.onlyOrgs.includes(org.key)) continue;

      /*
       * A type can only offer what its club has switched on. Ward Union has no
       * Stripe, so every type there ends up offline-only rather than advertising
       * a card option that checkout could not honour.
       */
      const methods = org.paymentMethods;

      const r = await client.query(
        `INSERT INTO membership_types
           (organisation_id, name, description, membership_form_id, membership_status,
            is_rolling_membership, valid_until, number_of_months, automatically_approve,
            member_labels, supported_payment_methods, use_terms_and_conditions,
            terms_and_conditions, membership_type_category, min_people_in_application,
            max_people_in_application, person_titles, handling_fee_included, fee, discount_ids)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         RETURNING id`,
        [
          orgIds[org.key],
          type.name,
          type.description,
          formIds[org.key][type.form],
          type.status,
          Boolean(type.rolling),
          type.rolling ? null : seasonEnd(0),
          type.rolling?.months ?? null,
          type.automaticallyApprove,
          JSON.stringify(type.memberLabels),
          JSON.stringify(methodIdsFor(methods)),
          type.useTermsAndConditions ?? false,
          type.useTermsAndConditions
            ? 'Membership runs to the end of the season and is not transferable. Hats and body protectors to current standards are required at all mounted activities.'
            : null,
          type.category,
          type.people?.min ?? null,
          type.people?.max ?? null,
          type.people ? JSON.stringify(type.people.titles) : null,
          type.handlingFeeIncluded ?? false,
          type.fee,
          JSON.stringify(discountIdsFor(org.key, type.discounts)),
        ]
      );

      membershipTypeIds[org.key][type.key] = r.rows[0].id;
      bump('membership_types');

      await applyDiscounts(client, type.discounts, 'membership_type', r.rows[0].id, org.key);
    }
  }

  /* --- members ----------------------------------------------------------- */

  /*
   * Membership numbers, one running count per club, and the sequence table is
   * then set to each club's next free value. Skipping that last step would
   * leave the generator handing out numbers this seed has already used, and the
   * first member created through the UI would be rejected.
   *
   * Each club counts from its own band — 100000, 200000, 300000 — rather than
   * all starting at the type's initial number. `members.membership_number`
   * carries a UNIQUE constraint across the whole table, while the organisation
   * type is configured `membership_number_uniqueness = 'organization'`; taken
   * literally that configuration lets two clubs both allocate 100000, and the
   * second insert fails. Banding sidesteps the contradiction here, but it is
   * the schema that needs reconciling, not just this seed.
   */
  const numberBand = (orgKey: SeedOrg['key']): number =>
    ORG_TYPE.initialMembershipNumber + ORGS.findIndex((o) => o.key === orgKey) * 100000;

  const nextNumber: Record<string, number> = {};
  /**
   * Member row ids by club and full name, for linking an entry to the
   * membership it was made under.
   *
   * By name because that is what `ENTRIES` has: an entry names a person, and
   * whether a membership stands behind that name is the question being asked.
   * Two members of one club with the same name would collide here — the seed
   * has none, and a real collision is a data problem the fixture should not
   * pretend to solve.
   */
  const memberRowIds: Record<string, string> = {};
  const householdIds: Record<string, string> = {};
  const householdSlots: Record<string, number> = {};

  for (const member of MEMBERS) {
    const type = MEMBERSHIP_TYPES.find((t) => t.key === member.type)!;
    const orgUserId = accountUserRowIds[member.org]?.[member.email];

    if (!orgUserId) {
      throw new Error(
        `Member ${member.email} is not an account user of ${member.org}. ` +
          `Add the organisation to their entry in ACCOUNT_USERS.`
      );
    }

    const submission = await client.query(
      `INSERT INTO form_submissions
         (form_id, organisation_id, user_id, submission_type, context_id, submission_data, status)
       VALUES ($1,$2,$3,'membership',$4,$5,$6)
       RETURNING id`,
      [
        formIds[member.org][type.form],
        orgIds[member.org],
        orgUserId,
        membershipTypeIds[member.org][member.type],
        JSON.stringify(memberSubmission(member)),
        member.status === 'pending' ? 'pending' : 'approved',
      ]
    );
    bump('form_submissions');

    nextNumber[member.org] ??= numberBand(member.org);
    const membershipNumber = nextNumber[member.org]++;

    let groupMembershipId: string | null = null;
    let personSlot: number | null = null;

    if (member.household) {
      householdIds[member.household] ??= randomUUID();
      householdSlots[member.household] = (householdSlots[member.household] ?? 0) + 1;
      groupMembershipId = householdIds[member.household];
      personSlot = householdSlots[member.household];
    }

    /*
     * Whose membership it is, which is not always whose login it is under. A
     * parent holds their children's: the row carries the child's name while
     * `user_id` points at the parent.
     */
    const holder = ACCOUNT_USERS.find((u) => u.email === member.email)!;
    const firstName = member.firstName ?? holder.firstName;
    const lastName = member.lastName ?? holder.lastName;

    const validUntil = type.rolling
      ? dateOnly(-member.renewedDaysAgo + type.rolling.months * 30)
      : membershipEnd(member.season);

    const memberRow = await client.query(
      `INSERT INTO members
         (organisation_id, membership_type_id, user_id, membership_number, first_name, last_name,
          form_submission_id, date_last_renewed, status, valid_until, labels, processed,
          payment_status, payment_method, group_membership_id, person_slot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id`,
      [
        orgIds[member.org],
        membershipTypeIds[member.org][member.type],
        orgUserId,
        String(membershipNumber),
        firstName,
        lastName,
        submission.rows[0].id,
        dateOnly(-member.renewedDaysAgo),
        member.status,
        validUntil,
        JSON.stringify([...type.memberLabels, ...(member.labels ?? [])]),
        member.status !== 'pending',
        member.paymentStatus,
        member.payment ?? null,
        groupMembershipId,
        personSlot,
      ]
    );
    memberRowIds[`${member.org}|${firstName} ${lastName}`] = memberRow.rows[0].id as string;
    bump('members');

    /*
     * The money behind the membership, collected rather than written now: it
     * may share a basket with an entry or a shop order created in a later loop.
     * A membership is bought through a basket like anything else, and a fixture
     * without the payment left the member's Payments page empty while their
     * membership said it was paid for.
     *
     * A refunded membership keeps a refunded payment rather than none — the
     * money did move, and a history that omits it is the one shape a member
     * would query.
     */
    paymentLines.push({
      basket: member.basket ?? `member-${memberRow.rows[0].id}`,
      org: member.org,
      orgUserId,
      itemType: 'membership',
      contextId: membershipTypeIds[member.org][member.type],
      contextRef: { membershipTypeId: membershipTypeIds[member.org][member.type] },
      description: `${type.name} — ${firstName} ${lastName}`,
      feeMinor: Math.round(type.fee * 100),
      formSubmissionId: submission.rows[0].id,
      status: member.paymentStatus,
      isCard: member.payment === 'stripe',
      handlingFeeIncluded: type.handlingFeeIncluded ?? false,
      on: dayOffset(-member.renewedDaysAgo),
      fulfilmentRef: memberRow.rows[0].id,
    });
  }

  for (const [orgKey, next] of Object.entries(nextNumber)) {
    await client.query(
      `INSERT INTO membership_number_sequences (organization_type_id, organization_id, next_number)
       VALUES ($1,$2,$3)
       ON CONFLICT (organization_type_id, organization_id)
       DO UPDATE SET next_number = EXCLUDED.next_number, updated_at = NOW()`,
      [orgTypeId, orgIds[orgKey], next]
    );
    bump('membership_number_sequences');
  }

  /* --- entries ------------------------------------------------------------ */

  /*
   * Entries that have already been made, mirroring what `fulfilment.service`
   * writes when a basket is paid for: the names travel on the entry itself, a
   * `member_id` links it to the membership when there is one behind the name,
   * and a form submission is created wherever the activity asks for one.
   *
   * `entry_date` is backdated, which is the only part a real entry cannot do.
   * It is what makes the order meaningful — an account's most recently used
   * names are the ones the entry form offers back first.
   */
  for (const entry of ENTRIES) {
    const eventId = eventIds[entry.event];
    const activityId = activityIds[entry.event]?.[entry.activity];

    if (!activityId) {
      throw new Error(
        `Entry for ${entry.firstName} ${entry.lastName} names "${entry.activity}" in ` +
          `"${entry.event}", which has no such activity.`
      );
    }

    const orgUserId = accountUserRowIds[entry.org]?.[entry.email];
    if (!orgUserId) {
      throw new Error(
        `${entry.email} entered ${entry.event} but is not an account user of ${entry.org}. ` +
          `Add the organisation to their entry in ACCOUNT_USERS.`
      );
    }

    const activity = EVENTS.find((e) => e.key === entry.event)!.activities.find(
      (a) => a.name === entry.activity
    )!;

    /*
     * Null where the name has no membership behind it — a friend entered on an
     * open activity. Not an error: it is the case the `member_id` column is
     * nullable for, and the one an entrant suggestion with nothing to link to
     * comes from.
     */
    const memberId = memberRowIds[`${entry.org}|${entry.firstName} ${entry.lastName}`] ?? null;

    let submissionId: string | null = null;
    if (activity.form) {
      const submission = await client.query(
        `INSERT INTO form_submissions
           (form_id, organisation_id, user_id, submission_type, context_id, submission_data, status)
         VALUES ($1,$2,$3,'event_entry',$4,$5,'approved')
         RETURNING id`,
        [
          formIds[entry.org][activity.form],
          orgIds[entry.org],
          orgUserId,
          activityId,
          JSON.stringify(entrySubmission(entry)),
        ]
      );
      submissionId = submission.rows[0].id;
      bump('form_submissions');
    }

    const entryRow = await client.query(
      `INSERT INTO event_entries
         (event_id, event_activity_id, user_id, first_name, last_name, email,
          form_submission_id, quantity, payment_status, payment_method, member_id, entry_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8,$9,$10,$11)
       RETURNING id`,
      [
        eventId,
        activityId,
        orgUserId,
        entry.firstName,
        entry.lastName,
        entry.email,
        submissionId,
        entry.paymentStatus,
        entry.payment,
        memberId,
        dayOffset(-entry.enteredDaysAgo),
      ]
    );
    const entryId = entryRow.rows[0].id as string;
    bump('event_entries');

    /*
     * And the money behind it, collected for the same reason: an entry very
     * often shares a basket with another entry, and did not used to share
     * anything at all — the fixture wrote entries with no payment behind them,
     * which is a state the application cannot reach. A checkout writes the
     * payment; fulfilment then writes the entry.
     */
    paymentLines.push({
      basket: entry.basket ?? `entry-${entryId}`,
      org: entry.org,
      orgUserId,
      itemType: 'event_entry',
      contextId: activityId,
      contextRef: { activityId, eventId, entrantName: `${entry.firstName} ${entry.lastName}` },
      description: `${EVENTS.find((e) => e.key === entry.event)!.name} — ${entry.activity}`,
      feeMinor: Math.round(activity.fee * 100),
      formSubmissionId: submissionId,
      status: entry.paymentStatus,
      isCard: entry.payment === 'card',
      handlingFeeIncluded: activity.handlingFeeIncluded ?? false,
      on: dayOffset(-entry.enteredDaysAgo),
      fulfilmentRef: entryId,
    });

    /*
     * The ticket, where the event issues them.
     *
     * Written for **every** entry on a ticketing event, because that is what
     * `fulfilment.service` does — it calls `issueTicketForEntry` after creating
     * the entry, and the fixture should not be able to produce an entry the
     * application would have ticketed and this one did not.
     *
     * The reference comes from the same sequence the service uses, so a seeded
     * ticket and one issued by the running application cannot collide. Validity
     * mirrors `issueTicketForEntry` too: from the start of the event day —
     * *not* the moment of issue, or a ticket bought in March reads as
     * valid-since-March on its face — until the end of the last day plus the
     * configured period.
     */
    const seedEvent = EVENTS.find((e) => e.key === entry.event)!;

    if (entry.ticket && !seedEvent.ticketing) {
      throw new Error(
        `Entry for ${entry.firstName} ${entry.lastName} names a ticket state on ` +
          `"${seedEvent.name}", which issues no tickets. Add a ticketing block to that event, ` +
          `or drop the ticket state.`
      );
    }

    if (seedEvent.ticketing) {
      const state = entry.ticket?.state ?? 'issued';
      const validFrom = dayOffset(seedEvent.startDays);
      validFrom.setHours(0, 0, 0, 0);
      const validUntil = dayOffset(
        (seedEvent.endDays ?? seedEvent.startDays) + (seedEvent.ticketing.validityPeriod ?? 0)
      );
      validUntil.setHours(23, 59, 59, 999);

      // Scanned on the day, at the gate, rather than at some arbitrary hour.
      const scannedAt = dayOffset(seedEvent.startDays);
      scannedAt.setHours(9, 20, 0, 0);
      const scannedAgain = dayOffset(seedEvent.startDays);
      scannedAgain.setHours(11, 45, 0, 0);

      const scans = state === 'scanned' ? 1 : state === 'scannedTwice' ? 2 : 0;

      const ticket = await client.query(
        `INSERT INTO electronic_tickets
           (ticket_reference, event_id, event_activity_id, event_entry_id, user_id,
            customer_name, customer_email, issue_date, valid_from, valid_until,
            scan_status, scan_date, scan_location, scan_count, status, ticket_data,
            admits, created_at, updated_at)
         VALUES ('TKT-' || to_char($8::timestamp, 'YYYY') || '-' ||
                   lpad(nextval('electronic_ticket_reference_seq')::text, 6, '0'),
                 $1,$2,$3,$4,$5,$6,$7,$9,$10,$11,$12,$13,$14,$15,'{}'::jsonb,
                 -- Read from the activity rather than passed in, exactly as
                 -- issueTicketForEntry copies it: a seeded ticket that
                 -- disagreed with the code's own issue path would be a fixture
                 -- teaching the wrong thing.
                 COALESCE((SELECT a.tickets_admit FROM event_activities a WHERE a.id = $2), 1),
                 $8,$8)
         RETURNING id, qr_code, event_id, valid_until`,
        [
          eventId,
          activityId,
          entryId,
          orgUserId,
          `${entry.firstName} ${entry.lastName}`,
          entry.email,
          dayOffset(-entry.enteredDaysAgo),
          dayOffset(-entry.enteredDaysAgo),
          validFrom,
          validUntil,
          scans > 0 ? 'scanned' : 'not_scanned',
          // The most recent scan, which is what the ticket row records.
          scans === 2 ? scannedAgain : scans === 1 ? scannedAt : null,
          scans > 0 ? (entry.ticket?.location ?? 'Main gate') : null,
          scans,
          state === 'cancelled' ? 'cancelled' : 'issued',
        ]
      );
      bump('electronic_tickets');

      /*
       * Sign the seeded ticket the way `issueTicketForEntry` signs a real one,
       * so a developer pointing the scanner at a demo ticket is exercising the
       * real path. With no key configured this is a no-op and the fixture keeps
       * its plain identifier — which is exactly what a pre-signing ticket
       * carries, so that case stays represented too.
       */
      {
        const issued = ticket.rows[0];
        const token = signTicketCode(issued.qr_code, issued.event_id, issued.valid_until);
        if (token) {
          await client.query('UPDATE electronic_tickets SET qr_token = $2 WHERE id = $1', [
            issued.id,
            token,
          ]);
        }
      }

      /*
       * Every scan, not only the last. The ticket row keeps the latest; the
       * history is what shows a ticket presented twice — which is the whole
       * point of keeping a history rather than a flag.
       *
       * `success` is what the application records for a scan, including a
       * repeat: `updateTicketScanStatus` writes that value for every scan and
       * the count is what tells a duplicate from an admission.
       */
      for (const [index, at] of [scannedAt, scannedAgain].slice(0, scans).entries()) {
        await client.query(
          `INSERT INTO ticket_scan_history
             (ticket_id, scan_date, scan_location, scanned_by, scan_result, notes, created_at)
           VALUES ($1,$2,$3,$4,'success',$5,$2)`,
          [
            ticket.rows[0].id,
            at,
            entry.ticket?.location ?? 'Main gate',
            orgAdminRowIds[entry.org],
            index === 0
              ? 'Ticket scanned successfully'
              : 'Ticket presented a second time at the gate',
          ]
        );
        bump('ticket_scan_history');
      }
    }
  }

  /* --- registrations ------------------------------------------------------ */

  /*
   * Registering a horse rather than a person.
   *
   * The shape mirrors memberships — a form submission, then the record that
   * points at it — because that is genuinely what the module does. What differs
   * is the subject: `entity_name` is the horse, `owner_name` is whoever the
   * passport says owns it, and `user_id` is the member whose login it sits
   * under. Those three are allowed to be three different answers, which is why
   * a registration is not just a membership with another label.
   */
  const registrationTypeIds: Record<string, string> = {};

  for (const type of REGISTRATION_TYPES) {
    const org = ORGS.find((o) => o.key === type.org)!;

    if (!capabilitiesFor(org).includes('registrations')) {
      throw new Error(
        `Registration type "${type.name}" is under ${type.org}, which has no registrations ` +
          `capability. Add it to that organisation, or move the type.`
      );
    }

    const result = await client.query(
      `INSERT INTO registration_types
         (organisation_id, name, description, entity_name, registration_form_id,
          registration_status, is_rolling_registration, valid_until, number_of_months,
          automatically_approve, registration_labels, supported_payment_methods,
          use_terms_and_conditions, terms_and_conditions, handling_fee_included,
          discount_ids, fee)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id`,
      [
        orgIds[type.org],
        type.name,
        type.description,
        type.entityName,
        formIds[type.org][type.form],
        type.status,
        type.rolling ?? false,
        // A rolling type counts months from the day it is taken out, so it has
        // no fixed end; an annual one lapses on a date shared by every horse.
        type.rolling ? null : dateOnly(type.validUntilDays ?? 365),
        type.rolling ? type.numberOfMonths ?? 12 : null,
        type.automaticallyApprove ?? false,
        JSON.stringify(type.labels ?? []),
        JSON.stringify(methodIdsFor(org.paymentMethods)),
        type.useTermsAndConditions ?? false,
        type.termsAndConditions ?? '',
        type.handlingFeeIncluded ?? false,
        JSON.stringify(discountIdsFor(type.org, type.discounts ?? [])),
        /*
         * Raw, like every other fee the seed writes. The dataset holds major
         * units throughout — an activity at `fee: 25` is €25 — and dividing
         * here would have made registrations the one exception, which is
         * exactly the kind of inconsistency that produces a €3,500 horse.
         */
        type.fee,
      ]
    );
    registrationTypeIds[type.key] = result.rows[0].id;
    bump('registration_types');
  }

  let nextRegistrationNumber = 1;

  for (const registration of REGISTRATIONS) {
    const type = REGISTRATION_TYPES.find((t) => t.key === registration.type)!;
    const orgUserId = accountUserRowIds[type.org]?.[registration.owner];

    if (!orgUserId) {
      throw new Error(
        `${registration.owner} registered ${registration.entityName} with ${type.org}, but is ` +
          `not an account user there. Add the organisation to their ACCOUNT_USERS entry.`
      );
    }

    const submission = await client.query(
      `INSERT INTO form_submissions
         (form_id, organisation_id, user_id, submission_type, context_id, submission_data, status)
       VALUES ($1,$2,$3,'registration',$4,$5,$6)
       RETURNING id`,
      [
        formIds[type.org][type.form],
        orgIds[type.org],
        orgUserId,
        registrationTypeIds[type.key],
        // Keyed by each field's `name`, not the seed's own key — the form
        // renderer reads back by name, and a submission keyed the other way
        // displays as a set of blanks.
        JSON.stringify(registrationSubmission(registration)),
        registration.status === 'pending' ? 'pending' : 'approved',
      ]
    );
    bump('form_submissions');

    const registrationRow = await client.query(
      `INSERT INTO registrations
         (organisation_id, registration_type_id, user_id, registration_number, entity_name,
          owner_name, form_submission_id, date_last_renewed, status, valid_until, labels,
          processed, payment_status, payment_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [
        orgIds[type.org],
        registrationTypeIds[type.key],
        orgUserId,
        `MH-${String(nextRegistrationNumber++).padStart(4, '0')}`,
        registration.entityName,
        registration.ownerName,
        submission.rows[0].id,
        dateOnly(-registration.renewedDaysAgo),
        registration.status,
        dateOnly(registration.validUntilDays),
        JSON.stringify(registration.labels ?? []),
        registration.processed ?? registration.status !== 'pending',
        registration.paymentStatus,
        registration.payment ?? null,
      ]
    );
    bump('registrations');

    /*
     * A registration is bought like anything else, so it carries its payment
     * too — and can share a basket, which is how a member renewing a horse's
     * papers alongside an entry looks on the payments screen.
     */
    paymentLines.push({
      basket: registration.basket ?? `registration-${registrationRow.rows[0].id}`,
      org: type.org,
      orgUserId,
      itemType: 'registration',
      contextId: registrationTypeIds[registration.type],
      contextRef: { registrationTypeId: registrationTypeIds[registration.type] },
      description: `${type.name} — ${registration.entityName}`,
      feeMinor: Math.round(type.fee * 100),
      formSubmissionId: submission.rows[0].id,
      status: registration.paymentStatus,
      isCard: registration.payment === 'stripe',
      handlingFeeIncluded: type.handlingFeeIncluded ?? false,
      on: dayOffset(-registration.renewedDaysAgo),
      fulfilmentRef: registrationRow.rows[0].id,
    });
  }

  /* --- merchandise -------------------------------------------------------- */
  /** Product ids by `MERCHANDISE` key, so `SHOP_ORDERS` can name what was bought. */
  const merchandiseIds: Record<string, string> = {};

  for (const item of MERCHANDISE) {
    /*
     * A club without the capability must not end up with a shop. The dataset
     * only lists Kildare's, but checking here means adding a product under the
     * wrong club fails loudly rather than seeding rows no screen can reach.
     */
    if (!capabilitiesFor(ORGS.find((o) => o.key === item.org)!).includes('merchandise')) {
      throw new Error(
        `${item.name} is under ${item.org}, which has no merchandise capability. ` +
          `Add 'merchandise' to that organisation's extraCapabilities, or move the product.`
      );
    }

    // Whatever the club has switched on; a shop cannot offer card without one.
    const effective = ORGS.find((o) => o.key === item.org)!.paymentMethods;

    const r = await client.query(
      `INSERT INTO merchandise_types
         (organisation_id, name, description, images, status, track_stock_levels,
          low_stock_alert, out_of_stock_behavior, delivery_type, delivery_fee,
          min_order_quantity, max_order_quantity, quantity_increments,
          require_application_form, application_form_id, supported_payment_methods,
          use_terms_and_conditions, terms_and_conditions, custom_confirmation_message,
          handling_fee_included, discount_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING id`,
      [
        orgIds[item.org],
        item.name,
        item.description,
        // The application refuses a product with no image, and a shop of
        // identical coloured tiles tests nothing about a shop, so each product
        // gets a drawing of itself.
        JSON.stringify(productArtwork(item.key, item.imageColour, item.imageCount)),
        item.status,
        item.trackStock ?? false,
        item.lowStockAlert ?? null,
        // Only meaningful for a tracked item; left null otherwise rather than
        // recording a behaviour that can never apply.
        item.trackStock ? item.outOfStock ?? 'show_unavailable' : null,
        item.deliveryType,
        item.deliveryType === 'fixed' ? item.deliveryFee ?? 0 : null,
        item.minOrder ?? 1,
        item.maxOrder ?? null,
        item.increments ?? null,
        Boolean(item.form),
        item.form ? formIds[item.org][item.form] : null,
        JSON.stringify(methodIdsFor(effective)),
        item.useTermsAndConditions ?? false,
        item.useTermsAndConditions
          ? 'Club kit is made to order and cannot be returned once printed. Sizes are as manufactured; please check the size guide before ordering.'
          : null,
        item.confirmationMessage ?? null,
        item.handlingFeeIncluded ?? false,
        JSON.stringify(discountIdsFor(item.org, item.discounts)),
      ]
    );

    const merchandiseId = r.rows[0].id;
    merchandiseIds[item.key] = merchandiseId;
    bump('merchandise_types');

    await applyDiscounts(client, item.discounts, 'merchandise', merchandiseId, item.org);

    for (const [band, [minQuantity, maxQuantity, fee]] of (item.delivery ?? []).entries()) {
      await client.query(
        `INSERT INTO delivery_rules
           (merchandise_type_id, min_quantity, max_quantity, delivery_fee, "order")
         VALUES ($1,$2,$3,$4,$5)`,
        [merchandiseId, minQuantity, maxQuantity, fee, band]
      );
      bump('delivery_rules');
    }

    for (const [typeOrder, option] of item.options.entries()) {
      const optionType = await client.query(
        `INSERT INTO merchandise_option_types (merchandise_type_id, name, "order")
         VALUES ($1,$2,$3) RETURNING id`,
        [merchandiseId, option.name, typeOrder]
      );
      bump('merchandise_option_types');

      for (const [valueOrder, value] of option.values.entries()) {
        await client.query(
          `INSERT INTO merchandise_option_values
             (option_type_id, name, price, sku, stock_quantity, "order")
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            optionType.rows[0].id,
            value.name,
            value.price,
            value.sku ?? null,
            // Null rather than zero when the club does not track stock: zero
            // reads as sold out, which is a different claim from "not counted".
            item.trackStock ? value.stock ?? 0 : null,
            valueOrder,
          ]
        );
        bump('merchandise_option_values');
      }
    }
  }

  /* --- shop orders --------------------------------------------------------- */

  for (const order of SHOP_ORDERS) {
    const item = MERCHANDISE.find((m) => m.key === order.item);
    if (!item || item.org !== order.org) {
      throw new Error(`Shop order names "${order.item}", which ${order.org} does not sell.`);
    }

    const chosen = item.options
      .flatMap((option) => option.values.map((value) => ({ option: option.name, ...value })))
      .find((value) => value.name === order.option);
    if (!chosen) {
      throw new Error(
        `Shop order for "${item.name}" names the option "${order.option}", which it does not offer.`
      );
    }

    const orgUserId = accountUserRowIds[order.org]?.[order.email];
    if (!orgUserId) {
      throw new Error(
        `${order.email} ordered from ${order.org} but is not an account user there.`
      );
    }

    const subtotal = chosen.price * order.quantity;
    const orderedOn = dayOffset(-order.orderedDaysAgo);

    const orderRow = await client.query(
      `INSERT INTO merchandise_orders
         (organisation_id, merchandise_type_id, user_id, selected_options, quantity,
          unit_price, subtotal, delivery_fee, total_price, payment_status, payment_method,
          order_status, order_date, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,$7,$8,$9,$10,$11,$11,$11)
       RETURNING id`,
      [
        orgIds[order.org],
        merchandiseIds[order.item],
        orgUserId,
        JSON.stringify({ [chosen.option]: chosen.name }),
        order.quantity,
        chosen.price,
        subtotal,
        order.paymentStatus,
        order.payment,
        order.paymentStatus === 'paid' ? 'paid' : 'pending',
        orderedOn,
      ]
    );
    bump('merchandise_orders');

    paymentLines.push({
      basket: order.basket ?? `order-${orderRow.rows[0].id}`,
      org: order.org,
      orgUserId,
      itemType: 'merchandise',
      contextId: merchandiseIds[order.item],
      contextRef: { merchandiseTypeId: merchandiseIds[order.item], options: { [chosen.option]: chosen.name } },
      description:
        order.quantity > 1
          ? `${item.name} — ${chosen.name} × ${order.quantity}`
          : `${item.name} — ${chosen.name}`,
      feeMinor: Math.round(subtotal * 100),
      formSubmissionId: null,
      status: order.paymentStatus,
      isCard: order.payment === 'card',
      handlingFeeIncluded: item.handlingFeeIncluded ?? false,
      on: orderedOn,
      fulfilmentRef: orderRow.rows[0].id,
    });
  }

  /* --- calendars ---------------------------------------------------------- */
  const calendarIds: Record<string, string> = {};

  for (const calendar of CALENDARS) {
    if (!capabilitiesFor(ORGS.find((o) => o.key === calendar.org)!).includes('calendar-bookings')) {
      throw new Error(
        `${calendar.name} is under ${calendar.org}, which has no calendar-bookings capability. ` +
          `Add 'calendar-bookings' to that organisation's extraCapabilities, or move the calendar.`
      );
    }

    const r = await client.query(
      `INSERT INTO calendars
         (organisation_id, name, description, display_colour, status,
          enable_automated_schedule, min_days_in_advance, max_days_in_advance,
          use_terms_and_conditions, terms_and_conditions, supported_payment_methods,
          allow_cancellations, cancel_days_in_advance, refund_payment_automatically,
          send_reminder_emails, reminder_hours_before, handling_fee_included,
          discount_ids, display_icon)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING id`,
      [
        orgIds[calendar.org],
        calendar.name,
        calendar.description,
        calendar.colour,
        calendar.status,
        Boolean(calendar.schedule?.length),
        calendar.minDaysInAdvance ?? 0,
        calendar.maxDaysInAdvance ?? 90,
        calendar.useTermsAndConditions ?? false,
        calendar.useTermsAndConditions
          ? 'Facilities are booked at your own risk. Hats and body protectors to current standards are required, and the arena must be left as found.'
          : null,
        JSON.stringify(methodIdsFor(ORGS.find((o) => o.key === calendar.org)!.paymentMethods)),
        calendar.allowCancellations ?? false,
        // Only meaningful when cancellations are allowed at all.
        calendar.allowCancellations ? calendar.cancelDaysInAdvance ?? null : null,
        calendar.allowCancellations ? calendar.refundAutomatically ?? false : false,
        calendar.sendReminders ?? false,
        calendar.sendReminders ? calendar.reminderHoursBefore ?? 24 : null,
        calendar.handlingFeeIncluded ?? false,
        JSON.stringify(discountIdsFor(calendar.org, calendar.discounts)),
        calendar.icon ?? null,
      ]
    );

    const calendarId = r.rows[0].id;
    calendarIds[calendar.key] = calendarId;
    bump('calendars');

    await applyDiscounts(client, calendar.discounts, 'calendar', calendarId, calendar.org);

    for (const [slotOrder, slot] of calendar.slots.entries()) {
      const config = await client.query(
        `INSERT INTO time_slot_configurations
           (calendar_id, days_of_week, start_time, effective_date_start, effective_date_end,
            recurrence_weeks, places_available, min_places_required, "order")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [
          calendarId,
          JSON.stringify(slot.days),
          slot.startTime,
          dateOnly(slot.fromDays ?? 0),
          slot.untilDays === null || slot.untilDays === undefined
            ? null
            : dateOnly(slot.untilDays),
          slot.recurrenceWeeks ?? 1,
          slot.places ?? 1,
          slot.minPlaces ?? null,
          slotOrder,
        ]
      );
      bump('time_slot_configurations');

      for (const [durationOrder, [duration, price, label]] of slot.durations.entries()) {
        await client.query(
          `INSERT INTO duration_options
             (time_slot_configuration_id, duration, price, label, "order")
           VALUES ($1,$2,$3,$4,$5)`,
          [config.rows[0].id, duration, price, label, durationOrder]
        );
        bump('duration_options');
      }
    }

    for (const period of calendar.blocked ?? []) {
      await client.query(
        `INSERT INTO blocked_periods
           (calendar_id, block_type, start_date, end_date, days_of_week, start_time, end_time, reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          calendarId,
          period.type,
          period.fromDays === undefined ? null : dateOnly(period.fromDays),
          period.toDays === undefined ? null : dateOnly(period.toDays),
          period.days ? JSON.stringify(period.days) : null,
          period.startTime ?? null,
          period.endTime ?? null,
          period.reason,
        ]
      );
      bump('blocked_periods');
    }

    for (const [ruleOrder, [days, action, timeOfDay, reason]] of (
      calendar.schedule ?? []
    ).entries()) {
      await client.query(
        `INSERT INTO schedule_rules
           (calendar_id, start_date, end_date, action, time_of_day, reason, "order")
         VALUES ($1,$2,NULL,$3,$4,$5,$6)`,
        [calendarId, dateOnly(days), action, timeOfDay, reason, ruleOrder]
      );
      bump('schedule_rules');
    }
  }

  /* --- bookings ----------------------------------------------------------- */

  /*
   * Bookings members have already made, and the payments they made them on.
   *
   * The calendars and their slots were seeded and no booking ever was, so no
   * payment anywhere carried a `booking` line — the payment screens could not
   * be checked against one, and neither could the click-through to a booking.
   *
   * Written the way `calendar.service.createBooking` writes one: the end time
   * derived from the start and the duration, the price taken from the duration
   * option rather than restated, and a `BK-<year>-<n>` reference.
   */
  let bookingSequence = 0;

  for (const booking of BOOKINGS) {
    const calendar = CALENDARS.find((c) => c.key === booking.calendar);
    if (!calendar || calendar.org !== booking.org) {
      throw new Error(
        `Booking for ${booking.email} names calendar "${booking.calendar}", which does not exist ` +
          `under ${booking.org}.`
      );
    }

    const slot = calendar.slots.find((s) => s.startTime === booking.startTime);
    const duration = slot?.durations.find(([minutes]) => minutes === booking.duration);
    if (!slot || !duration) {
      throw new Error(
        `Booking for ${booking.email} asks for ${booking.startTime} × ${booking.duration}min on ` +
          `"${calendar.name}", which offers no such slot. A seeded booking outside its own slot is ` +
          `a state the application cannot produce.`
      );
    }

    /*
     * The nearest day the slot actually runs.
     *
     * `daysFromNow` is a target: a fixed offset lands on a different weekday
     * every time the seed runs, so a booking pinned to one would sit outside
     * its own slot most days of the week. Searched outwards from the target so
     * a past booking stays past and a future one stays future.
     */
    const direction = booking.daysFromNow < 0 ? -1 : 1;
    let offset = booking.daysFromNow;
    for (let step = 0; step < 7; step += 1) {
      const candidate = dayOffset(offset);
      if (slot.days.includes(candidate.getDay())) break;
      offset += direction;
    }

    const bookedOn = dayOffset(offset);
    const [durationMinutes, pricePerPlace] = duration;
    const places = booking.places ?? 1;
    const total = pricePerPlace * places;

    const [startHours, startMinutes] = booking.startTime.split(':').map(Number);
    const endTotal = startHours * 60 + startMinutes + durationMinutes;
    const endTime =
      `${String(Math.floor(endTotal / 60) % 24).padStart(2, '0')}:` +
      `${String(endTotal % 60).padStart(2, '0')}`;

    bookingSequence += 1;
    const reference = `BK-${bookedOn.getFullYear()}-${String(bookingSequence).padStart(6, '0')}`;
    /*
     * When it was booked. A fortnight before the slot unless the fixture says
     * otherwise — two bookings sharing a basket were paid for in one go, so
     * they cannot have been booked on different days.
     */
    const bookedAt = dayOffset(
      booking.bookedDaysAgo === undefined ? offset - 14 : -booking.bookedDaysAgo
    );

    const bookingRow = await client.query(
      `INSERT INTO bookings
         (booking_reference, calendar_id, user_id, booking_date, start_time, duration, end_time,
          places_booked, price_per_place, total_price, booking_status, payment_status,
          payment_method, cancelled_at, cancellation_reason, refund_processed,
          booked_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,false,$16,$16,$16)
       RETURNING id`,
      [
        reference,
        calendarIds[calendar.key],
        accountUserRowIds[booking.org][booking.email],
        dateOnly(offset),
        booking.startTime,
        durationMinutes,
        endTime,
        places,
        pricePerPlace,
        total,
        booking.status ?? 'confirmed',
        booking.paymentStatus,
        booking.payment === 'card' ? 'stripe' : 'pay-offline',
        booking.status === 'cancelled' ? bookedAt : null,
        booking.status === 'cancelled'
          ? 'Cancelled by the member — horse lame, arena released in time.'
          : null,
        bookedAt,
      ]
    );
    bump('bookings');

    paymentLines.push({
      basket: booking.basket ?? `booking-${bookingRow.rows[0].id}`,
      org: booking.org,
      orgUserId: accountUserRowIds[booking.org][booking.email],
      itemType: 'booking',
      contextId: calendarIds[calendar.key],
      contextRef: {
        calendarId: calendarIds[calendar.key],
        bookingDate: dateOnly(offset),
        startTime: booking.startTime,
      },
      description: `${calendar.name} — ${duration[2]}, ${dateOnly(offset)} ${booking.startTime}`,
      feeMinor: Math.round(total * 100),
      isCard: booking.payment === 'card',
      handlingFeeIncluded: calendar.handlingFeeIncluded ?? false,
      formSubmissionId: null,
      status: booking.paymentStatus,
      on: bookedAt,
      fulfilmentRef: bookingRow.rows[0].id,
    });
  }

  /* --- payments ----------------------------------------------------------- */

  /*
   * One payment per basket, written last.
   *
   * Grouped rather than one-per-item because that is what a basket is: a family
   * entering two children, renewing a membership and buying a shirt pays once,
   * and the payment carries a line for each. Written the way
   * `checkout.service` writes one — the payment, then a `payment_transactions`
   * line per item — so the member's payment detail has the same shape whether
   * the row came from a real checkout or from here.
   *
   * `fulfilment_ref` is set on every line, which is what lets that screen name
   * who an entry was for and link through to it.
   */
  const baskets = new Map<string, PendingPaymentLine[]>();
  for (const line of paymentLines) {
    const key = `${line.org}|${line.orgUserId}|${line.basket}`;
    baskets.set(key, [...(baskets.get(key) ?? []), line]);
  }

  /*
   * The handling fee, as the org type charges it.
   *
   * `fixedFee` is stored in major units on the type and read back in minor
   * ones, so it is converted here the way `organizationTypePaymentFeeService`
   * converts it. `percentageFee` is a percentage either way.
   */
  const feeConfig = {
    fixedFee: Math.round(ORG_TYPE.handlingFee.fixedFee * 100),
    percentageFee: ORG_TYPE.handlingFee.percentageFee,
    taxPercentage: ORG_TYPE.handlingFee.taxPercentage,
  };

  for (const lines of baskets.values()) {
    const [first] = lines;

    /*
     * A basket settles once, so every line shares its status — but **not
     * necessarily its method**. Some items paid for by card now and some owed
     * to the club on the day is an ordinary basket, and the one the payment
     * detail has to be able to explain.
     */
    const mixedStatus = lines.find((l) => l.status !== first.status);
    if (mixedStatus) {
      throw new Error(
        `Basket "${first.basket}" mixes payment states: ${first.description} is ` +
          `${first.status} and ${mixedStatus.description} is ${mixedStatus.status}. ` +
          `A basket is paid for once.`
      );
    }

    /*
     * The same arithmetic the cart runs, from the same module — not a second
     * implementation of it. The fee is charged on card lines that do **not**
     * already absorb it; an included item in the base would bill the member
     * twice, and a basket of nothing but included items attracts no fee at all,
     * fixed element included.
     */
    const cardLines = lines.filter((l) => l.isCard);
    const offlineSubtotal = lines
      .filter((l) => !l.isCard)
      .reduce((sum, l) => sum + l.feeMinor, 0);
    const cardSubtotal = cardLines.reduce((sum, l) => sum + l.feeMinor, 0);

    const feeBearing = cardLines.filter((l) => !l.handlingFeeIncluded);
    const handling = calculateHandlingFee(
      feeBearing.reduce((sum, l) => sum + l.feeMinor, 0),
      feeConfig
    );

    /*
     * The fee split across the lines that bear it, largest-remainder, so the
     * parts sum to the total exactly. Same helper the checkout uses.
     */
    const allocations = allocateHandlingFee(
      lines.map((l) => ({
        id: l.fulfilmentRef,
        fee: l.feeMinor,
        paymentMethodId: l.isCard ? 'stripe' : 'pay-offline',
        isCard: l.isCard,
        handlingFeeIncluded: l.handlingFeeIncluded,
      })),
      handling.total
    );

    const cardAmount = cardSubtotal + handling.total;
    const settled = first.status === 'paid' || first.status === 'refunded';

    const payment = await client.query(
      `INSERT INTO payments
         (organisation_id, user_id, payment_type, context_id, amount, currency,
          payment_method, payment_status, payment_date, handling_fee,
          offline_amount, card_amount, created_at, updated_at)
       VALUES ($1,$2,'cart',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
       RETURNING id`,
      [
        orgIds[first.org],
        first.orgUserId,
        // The single-line case keeps its context; a basket of several has no
        // one thing it is "for", and the lines carry that instead.
        lines.length === 1 ? first.contextId : null,
        // Major units, like the column; the minor-unit figures sit beside it.
        (offlineSubtotal + cardAmount) / 100,
        ORG_TYPE.currency,
        // What the payment was taken by, which is the card provider wherever
        // anything at all was taken now. `checkout.service` does the same.
        cardLines.length > 0 ? 'card' : 'offline',
        /*
         * `awaiting_offline`, not `pending`, for money the club is owed.
         *
         * `pending` is a *card* payment in flight — a checkout somebody opened
         * and has not finished — and the application excludes it from both the
         * member's payment history and the club's offline list, because it is
         * not an obligation anybody has taken on. An offline order is the
         * opposite: checkout finished, the cart closed, and the club is waiting
         * for a cheque. `checkout.service.markAwaitingOfflinePayment` writes
         * that status, and the club's Offline Payments screen selects on it.
         *
         * Seeded as `pending`, these orders existed in neither place.
         */
        first.status === 'pending' && !cardLines.length ? 'awaiting_offline' : first.status,
        settled ? first.on : null,
        handling.total,
        offlineSubtotal,
        cardAmount,
        first.on,
      ]
    );
    bump('payments');

    for (const line of lines) {
      await client.query(
        `INSERT INTO payment_transactions
           (payment_id, organisation_id, item_type, context_id, context_ref,
            description, fee, handling_fee, payment_method_id, form_submission_id,
            status, fulfilled_at, fulfilment_ref, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)`,
        [
          payment.rows[0].id,
          orgIds[line.org],
          line.itemType,
          line.contextId,
          JSON.stringify(line.contextRef),
          line.description,
          line.feeMinor,
          allocations[line.fulfilmentRef] ?? 0,
          methodId[line.isCard ? 'stripe' : 'pay-offline'] ?? null,
          line.formSubmissionId,
          line.status,
          /*
           * The seed creates the entry or membership itself, so every line has
           * produced something and is marked fulfilled. Real fulfilment defers
           * memberships and registrations on an unpaid offline order — they
           * would hand over a year's entitlement before the money arrives — so
           * that one state is not represented here.
           */
          line.on,
          line.fulfilmentRef,
          line.on,
        ]
      );
      bump('payment_transactions');
    }

    /*
     * What went back out again.
     *
     * A refund is a record in its own table, not a status: `refunds` holds the
     * amount, the reason and the administrator who authorised it, and that is
     * what both the payment's own history and the Refunds screen read. The
     * seed used to set a membership payment's status to `refunded` and write
     * no refund at all, so every one of those screens was empty against data
     * that claimed a refund had happened.
     *
     * Matched by basket where the fixture names one, and otherwise by the
     * payer — a single-line payment has no basket name of its own, only the
     * synthetic key given to it here.
     */
    const refunds = REFUNDS.filter(
      (refund) =>
        refund.org === first.org &&
        (refund.basket
          ? refund.basket === first.basket
          : refund.email !== undefined &&
            accountUserRowIds[first.org]?.[refund.email] === first.orgUserId &&
            first.status === 'refunded')
    );

    let refundedMinor = 0;

    for (const refund of refunds) {
      const requestedAt = dayOffset(-refund.daysAgo);

      /*
       * The line a refund of one item is about.
       *
       * Matched on the description, narrowed by the entrant where two lines of
       * a basket read identically — which two children entered in the same
       * class do. Exactly one must match: a fixture that quietly matched none
       * would write a refund linked to nothing, which is the state this was
       * added to fix.
       */
      const matched = refund.item
        ? lines.filter(
            (line) =>
              (!refund.item!.description ||
                line.description.includes(refund.item!.description)) &&
              (!refund.item!.subject ||
                String((line.contextRef as { entrantName?: string })?.entrantName ?? '') ===
                  refund.item!.subject)
          )
        : [];

      if (refund.item && matched.length !== 1) {
        throw new Error(
          `Refund "${refund.reason}" names an item (${JSON.stringify(refund.item)}) matching ` +
            `${matched.length} lines of basket "${first.basket}". A refund of one item must name one.`
        );
      }

      const [refundedLine] = matched;

      /*
       * What the member paid for that line: its own fee plus the share of the
       * handling fee it bore. Taken from the line rather than restated in the
       * fixture, so the two cannot drift.
       */
      const amountMinor = refundedLine
        ? refundedLine.feeMinor + (allocations[refundedLine.fulfilmentRef] ?? 0)
        : (refund.amountMinor ?? offlineSubtotal + cardAmount);
      refundedMinor += amountMinor;

      const refundRow = await client.query(
        `INSERT INTO refunds
           (payment_id, organisation_id, refund_amount, refund_reason, refund_status,
            refund_provider, refund_date, requested_by, requested_at, refund_scope,
            created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$9,$9)
         RETURNING id`,
        [
          payment.rows[0].id,
          orgIds[first.org],
          // Major units, like the column. No amount means the whole payment.
          amountMinor / 100,
          refund.reason,
          refund.status,
          cardLines.length > 0 ? 'stripe' : null,
          // A refund that has not been sent has no date, which is what tells
          // the two states apart on the screen.
          refund.status === 'completed' ? requestedAt : null,
          orgAdminRowIds[first.org],
          requestedAt,
          /*
           * How the amount was arrived at. A fixture naming an item is the
           * `items` scope and is linked to the line below; one naming an amount
           * is the arbitrary scope; one naming neither is the whole payment.
           */
          refundedLine ? 'items' : refund.amountMinor === undefined ? 'full' : 'amount',
        ]
      );
      bump('refunds');

      /*
       * The link, which is what makes the item itself show as refunded and
       * stops it being refunded a second time. A seeded refund used to name an
       * item in its reason and link to nothing, so the screens disagreed: the
       * refund said the cap had gone back and the cap said it was paid for.
       */
      if (refundedLine) {
        await client.query(
          `INSERT INTO refund_transactions (refund_id, payment_transaction_id, amount)
           VALUES ($1, (SELECT id FROM payment_transactions
                         WHERE payment_id = $2 AND fulfilment_ref = $3), $4)`,
          [refundRow.rows[0].id, payment.rows[0].id, refundedLine.fulfilmentRef, amountMinor]
        );
        bump('refund_transactions');
      }
    }

    /*
     * What the refunds leave the payment as.
     *
     * `partially_refunded` is a real status now, and a payment with €25 back
     * out of €185 is exactly what it is for. Written here rather than in the
     * fixture so the two cannot disagree: the status follows the money.
     */
    if (refundedMinor > 0) {
      await client.query(
        `UPDATE payments SET payment_status = $2, updated_at = NOW() WHERE id = $1`,
        [
          payment.rows[0].id,
          refundedMinor >= offlineSubtotal + cardAmount ? 'refunded' : 'partially_refunded',
        ]
      );
    }
  }

  /* --- announcements ---------------------------------------------------- */

  /*
   * A club's notices to its members. Only for clubs that have the capability —
   * writing them for a club without it would seed rows nothing ever reads and
   * make "no announcements" impossible to demonstrate.
   *
   * `created_by` is left null: the seed's administrators exist, but attributing
   * a notice to one of them says something the fixture does not know, and the
   * column is nullable precisely because an announcement outlives its author.
   */
  for (const announcement of ANNOUNCEMENTS) {
    const org = ORGS.find((o) => o.key === announcement.org)!;
    if (!capabilitiesFor(org).includes('org-announcements')) continue;

    await client.query(
      `INSERT INTO organisation_announcements
         (organisation_id, title, description, starts_at, ends_at, image_placement,
          link_label, link_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [
        orgIds[announcement.org],
        announcement.title,
        announcement.description,
        dayOffset(announcement.fromDays),
        dayOffset(announcement.untilDays),
        /*
         * Null unless the fixture names a placement, and no fixture does: the
         * seed writes no S3 objects, and a placement with no image would be a
         * card claiming a background it has no picture for.
         */
        announcement.image ?? null,
        announcement.link?.label ?? null,
        announcement.link?.url ?? null,
      ]
    );
    bump('organisation_announcements');
  }

  return { orgTypeId, orgIds, superAdminEmail: SUPER_ADMIN.email, counts };
}
