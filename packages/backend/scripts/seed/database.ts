import { PoolClient } from 'pg';
import { randomUUID } from 'crypto';
import { productArtwork } from './artwork';
import {
  birthDateForAge,
  dateOnly,
  dayOffset,
  membershipEnd,
  seasonEnd,
} from './dates';
import {
  ACCOUNT_USERS,
  DISCOUNTS,
  EVENTS,
  EVENT_TYPES,
  FIELDS,
  FORMS,
  CALENDARS,
  MEMBERS,
  MEMBERSHIP_TYPES,
  MERCHANDISE,
  REGISTRATIONS,
  REGISTRATION_TYPES,
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
  const person = ACCOUNT_USERS.find((u) => u.email === member.email)!;
  const county = { kildare: 'Kildare', laois: 'Laois', ward: 'Meath', meath: 'Meath' }[member.org];
  const junior = member.type === 'junior' || member.type === 'family';

  return {
    rider_name: `${person.firstName} ${person.lastName}`,
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
        `INSERT INTO venues (organisation_id, name, address) VALUES ($1,$2,$3) RETURNING id`,
        [orgIds[org.key], venue.name, venue.address]
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
          field.label,
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
        [orgIds[org.key], form.name, form.description]
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

  /* --- events and activities -------------------------------------------- */
  for (const event of EVENTS) {
    const orgId = orgIds[event.org];
    const eventDiscountIds = discountIdsFor(event.org, event.discounts);

    const r = await client.query(
      `INSERT INTO events
         (organisation_id, name, description, event_owner, start_date, end_date,
          open_date_entries, entries_closing_date, limit_entries, entries_limit,
          add_confirmation_message, confirmation_message, status,
          event_type_id, venue_id, discount_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id`,
      [
        orgId,
        event.name,
        event.description,
        orgAdminRowIds[event.org],
        dateOnly(event.startDays),
        dateOnly(event.endDays),
        event.openDays === null ? null : dayOffset(event.openDays),
        event.closeDays === null ? null : dayOffset(event.closeDays),
        event.limitEntries ?? false,
        event.entriesLimit ?? null,
        event.addConfirmationMessage ?? false,
        event.confirmationMessage ?? null,
        event.status,
        eventTypeIds[event.org][event.eventType],
        venueIds[event.org][event.venue],
        JSON.stringify(eventDiscountIds),
      ]
    );
    const eventId = r.rows[0].id as string;
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
            ticket_footer_text, ticket_validity_period, include_event_logo, ticket_background_color)
         VALUES ($1,TRUE,$2,$3,$4,$5,$6,$7)`,
        [
          eventId,
          event.ticketing.headerText,
          event.ticketing.instructions,
          event.ticketing.footerText ?? '',
          event.ticketing.validityPeriod ?? null,
          event.ticketing.includeLogo ?? false,
          event.ticketing.backgroundColour ?? null,
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
            discount_ids, supported_payment_methods, entry_eligibility)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
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
        ]
      );
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

    await client.query(
      `INSERT INTO members
         (organisation_id, membership_type_id, user_id, membership_number, first_name, last_name,
          form_submission_id, date_last_renewed, status, valid_until, labels, processed,
          payment_status, payment_method, group_membership_id, person_slot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
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
    bump('members');
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

    await client.query(
      `INSERT INTO registrations
         (organisation_id, registration_type_id, user_id, registration_number, entity_name,
          owner_name, form_submission_id, date_last_renewed, status, valid_until, labels,
          processed, payment_status, payment_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
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
  }

  /* --- merchandise -------------------------------------------------------- */
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

  /* --- calendars ---------------------------------------------------------- */
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

  return { orgTypeId, orgIds, superAdminEmail: SUPER_ADMIN.email, counts };
}
