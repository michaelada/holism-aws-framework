import { db } from '../database/pool';
import { logger } from '../config/logger';
import { BadRequestError, ForbiddenError, NotFoundError } from '../middleware/errors';

/**
 * Event type templates, and resolving a club's settings from the chain.
 *
 * Task S0-3 of docs/EVENT_SCHEDULING_TASKS_S0_S1.md. The one piece of logic in
 * S0, and the one most likely to be reimplemented by accident later — so
 * everything that needs to know what a setting is worth for a club asks here,
 * and nothing works it out for itself.
 *
 * ## Settings are a flat map of dotted keys
 *
 * `minutesPerCompetitor.dressage`, not `{ minutesPerCompetitor: { dressage: 8 } }`.
 *
 * This is the decision the rest of the file rests on. Every setting a club can
 * see needs **its own source** ("where did 20 minutes come from?") and **its own
 * lock** — the wireframe shows a `From` column and a padlock per row, and a
 * nested object cannot carry either without inventing a path language to talk
 * about its leaves. Flat keys make merging shallow, sources exact, and locks
 * meaningful, and they cost nothing but a dot.
 *
 * ## Three levels, last wins, and only differences are stored
 *
 * ```
 * template.default_settings          the platform's
 *   → organisation-type override     a federation's
 *     → organisation override        this club's
 * ```
 *
 * An override row holds **only what differs**, which is what makes raising a
 * platform default reach every club that never overrode it. Copying whole
 * objects down the chain would silently freeze each club on the values it had
 * the day it was created.
 *
 * ## A lock beats the club, whatever the club's row says
 *
 * A key an organisation type locks is resolved to the type's value — or the
 * template's, where the type locked it without setting it — and the club's own
 * override for that key is **ignored rather than refused**. Refusing belongs at
 * the route, where there is somebody to tell; here the answer simply has to be
 * right, including for a row written before the lock existed.
 */

export type SettingSource = 'template' | 'organisation-type' | 'organisation';

export interface ResolvedSettings {
  templateId: string;
  /** The template's stable key, for logs and audit entries. */
  templateKey: string;
  /** Every setting, resolved. A flat map of dotted keys. */
  settings: Record<string, unknown>;
  /** Where each key's value came from. The screen's `From` column. */
  sources: Record<string, SettingSource>;
  /** Keys the organisation type has fixed. A club may not change these. */
  locked: string[];
}

/** The capability that turns the scheduling module on. See migration `…047`. */
export const SCHEDULING_CAPABILITY = 'event-scheduling';

/** A flat map, defensively — a column could hold anything a migration allowed. */
const asFlatMap = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asKeyList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

export interface EventTypeTemplate {
  id: string;
  key: string;
  displayName: string;
  description: string | null;
  /** Null means "no gate beyond the scheduling capability itself". */
  capability: string | null;
  schedulerKind: string;
  shape: Record<string, unknown>;
  defaultSettings: Record<string, unknown>;
  status: 'draft' | 'published' | string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateInput {
  key: string;
  displayName: string;
  description?: string | null;
  capability?: string | null;
  schedulerKind?: string;
  shape?: Record<string, unknown>;
  defaultSettings?: Record<string, unknown>;
  status?: string;
}

/** One projection, so every read of a template returns the same shape. */
const TEMPLATE_COLUMNS = `
  SELECT t.id, t.key, t.display_name, t.description, t.capability,
         t.scheduler_kind, t.shape, t.default_settings, t.status,
         t.created_at, t.updated_at
    FROM event_type_templates t`;

/**
 * The visibility predicate, exported because a test must run **this** and not a
 * copy of it.
 *
 * The gate is SQL, so a unit test with a mocked pool cannot show that it holds;
 * and a copy pasted into a test proves only that the copy works, while the two
 * drift apart from the first edit onwards. `$1` is the organisation, `$2` the
 * scheduling capability.
 */
export const TEMPLATES_FOR_ORGANISATION_SQL = `
  ${TEMPLATE_COLUMNS}
    JOIN organizations o ON o.id = $1
   WHERE t.status = 'published'
     AND COALESCE(o.enabled_capabilities, '[]'::jsonb) ? $2::text
     AND (
       t.capability IS NULL
       OR COALESCE(o.enabled_capabilities, '[]'::jsonb) ? t.capability::text
     )
   ORDER BY t.display_name`;

/**
 * The two upserts, exported for the same reason as the query above.
 *
 * `ON CONFLICT ... WHERE` has to name a **partial** index whose predicate
 * matches, and there is one such index per level — a single unique across three
 * columns would not constrain anything, because a NULL never equals a NULL.
 * Getting that wrong raises "no unique or exclusion constraint matching the ON
 * CONFLICT specification" at run time and never at compile time, so the
 * statements are run against a real schema in
 * `__tests__/integration/event-template-overrides.test.ts`.
 */
export const UPSERT_TYPE_OVERRIDE_SQL = `
  INSERT INTO event_type_setting_overrides
    (template_id, organization_type_id, settings, locked_keys)
  VALUES ($1, $2, $3::jsonb, $4::jsonb)
  ON CONFLICT (template_id, organization_type_id) WHERE organization_type_id IS NOT NULL
  DO UPDATE SET settings    = EXCLUDED.settings,
                locked_keys = EXCLUDED.locked_keys,
                updated_at  = CURRENT_TIMESTAMP`;

export const UPSERT_ORG_OVERRIDE_SQL = `
  INSERT INTO event_type_setting_overrides (template_id, organisation_id, settings)
  VALUES ($1, $2, $3::jsonb)
  ON CONFLICT (template_id, organisation_id) WHERE organisation_id IS NOT NULL
  DO UPDATE SET settings = EXCLUDED.settings, updated_at = CURRENT_TIMESTAMP`;

const toTemplate = (row: Record<string, any>): EventTypeTemplate => ({
  id: row.id,
  key: row.key,
  displayName: row.display_name,
  description: row.description ?? null,
  capability: row.capability ?? null,
  schedulerKind: row.scheduler_kind,
  shape: asFlatMap(row.shape),
  defaultSettings: asFlatMap(row.default_settings),
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class EventTypeTemplateService {
  /**
   * What a template's settings are worth for one organisation.
   *
   * **One query**, not one per level and certainly not one per key: the two
   * overrides are found by joining through the organisation's own type, so the
   * chain costs a single round trip however many settings it resolves.
   */
  async resolveSettings(templateId: string, organisationId: string): Promise<ResolvedSettings> {
    const result = await db.query(
      `SELECT t.id,
              t.key,
              t.default_settings,
              typ.settings     AS type_settings,
              typ.locked_keys  AS type_locked,
              org.settings     AS org_settings
         FROM event_type_templates t
         JOIN organizations o ON o.id = $2
         LEFT JOIN event_type_setting_overrides typ
                ON typ.template_id = t.id
               AND typ.organization_type_id = o.organization_type_id
         LEFT JOIN event_type_setting_overrides org
                ON org.template_id = t.id
               AND org.organisation_id = o.id
        WHERE t.id = $1`,
      [templateId, organisationId]
    );

    if (result.rows.length === 0) {
      /*
       * Either the template or the organisation is missing, and the caller
       * cannot act differently on which — both mean "there is nothing to
       * resolve". Told apart in the log, not in the error.
       */
      logger.warn('No settings to resolve', { templateId, organisationId });
      throw new NotFoundError('Event type template not found for this organisation');
    }

    const row = result.rows[0];
    const locked = asKeyList(row.type_locked);

    const settings: Record<string, unknown> = {};
    const sources: Record<string, SettingSource> = {};

    const apply = (values: Record<string, unknown>, source: SettingSource) => {
      for (const [key, value] of Object.entries(values)) {
        // A locked key is the organisation type's to set; the club's row for it
        // is ignored rather than refused.
        if (source === 'organisation' && locked.includes(key)) continue;
        settings[key] = value;
        sources[key] = source;
      }
    };

    apply(asFlatMap(row.default_settings), 'template');
    apply(asFlatMap(row.type_settings), 'organisation-type');
    apply(asFlatMap(row.org_settings), 'organisation');

    return {
      templateId: row.id,
      templateKey: row.key,
      settings,
      sources,
      /*
       * Every locked key, including one the type locked without setting — that
       * still forbids a club from changing it, and the value stays the
       * template's. Sorted so two callers comparing the list agree.
       */
      locked: [...locked].sort(),
    };
  }

  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------

  /** Every template, drafts included. The platform administrator's list. */
  async listTemplates(): Promise<EventTypeTemplate[]> {
    const result = await db.query(`${TEMPLATE_COLUMNS} ORDER BY t.display_name`);
    return result.rows.map(toTemplate);
  }

  async getTemplate(templateId: string): Promise<EventTypeTemplate> {
    const result = await db.query(`${TEMPLATE_COLUMNS} WHERE t.id = $1`, [templateId]);
    if (result.rows.length === 0) throw new NotFoundError('Event type template not found');
    return toTemplate(result.rows[0]);
  }

  /**
   * The templates one organisation may use.
   *
   * **This list is the gate.** A club that does not hold a template's
   * capability is not shown it and cannot name it — the screen does not decide
   * what to hide, because a screen that decides is a screen that can be asked
   * not to. Drafts are excluded here and nowhere else for the same reason.
   *
   * Two capabilities are checked, not one: `event-scheduling` turns the module
   * on at all, and the template's own capability reveals that discipline within
   * it. Both live in this predicate so that the list, the read and the write
   * cannot come to disagree about what a club may touch — a club holding
   * `equestrian-disciplines` without the module must see nothing.
   */
  async listTemplatesForOrganisation(organisationId: string): Promise<EventTypeTemplate[]> {
    const result = await db.query(TEMPLATES_FOR_ORGANISATION_SQL, [
      organisationId,
      SCHEDULING_CAPABILITY,
    ]);
    return result.rows.map(toTemplate);
  }

  /**
   * The same rule as the list, asked about one template.
   *
   * A **404**, not a 403: a club that may not see a template should not learn
   * from the error that it exists. The list and this share one predicate so
   * they cannot drift into disagreeing about what is visible.
   */
  async assertTemplateVisible(templateId: string, organisationId: string): Promise<EventTypeTemplate> {
    const visible = await this.listTemplatesForOrganisation(organisationId);
    const template = visible.find((candidate) => candidate.id === templateId);
    if (!template) {
      logger.warn('Template not available to this organisation', { templateId, organisationId });
      throw new NotFoundError('Event type template not found');
    }
    return template;
  }

  async createTemplate(input: TemplateInput): Promise<EventTypeTemplate> {
    const result = await db.query(
      `INSERT INTO event_type_templates
         (key, display_name, description, capability, scheduler_kind, shape, default_settings, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        input.key,
        input.displayName,
        input.description ?? null,
        input.capability ?? null,
        input.schedulerKind ?? 'sequential-phases',
        JSON.stringify(input.shape ?? {}),
        JSON.stringify(input.defaultSettings ?? {}),
        input.status ?? 'draft',
      ]
    );
    return this.getTemplate(result.rows[0].id);
  }

  /**
   * Update what was named, leave the rest alone.
   *
   * `COALESCE($n, column)` rather than a built-up SET list: a screen that edits
   * the shape sends the shape, and must not blank a description it never
   * loaded.
   */
  async updateTemplate(templateId: string, input: Partial<TemplateInput>): Promise<EventTypeTemplate> {
    const result = await db.query(
      `UPDATE event_type_templates
          SET display_name     = COALESCE($2, display_name),
              description      = COALESCE($3, description),
              capability       = CASE WHEN $4::boolean THEN $5 ELSE capability END,
              scheduler_kind   = COALESCE($6, scheduler_kind),
              shape            = COALESCE($7::jsonb, shape),
              default_settings = COALESCE($8::jsonb, default_settings),
              status           = COALESCE($9, status),
              updated_at       = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id`,
      [
        templateId,
        input.displayName ?? null,
        input.description ?? null,
        // Capability is the one field whose *null* is a meaning — "no gate
        // beyond scheduling" — so it needs a flag to tell "set to null" from
        // "not mentioned", which COALESCE alone cannot express.
        Object.prototype.hasOwnProperty.call(input, 'capability'),
        input.capability ?? null,
        input.schedulerKind ?? null,
        input.shape ? JSON.stringify(input.shape) : null,
        input.defaultSettings ? JSON.stringify(input.defaultSettings) : null,
        input.status ?? null,
      ]
    );
    if (result.rows.length === 0) throw new NotFoundError('Event type template not found');
    return this.getTemplate(templateId);
  }

  // ---------------------------------------------------------------------------
  // Overrides
  // ---------------------------------------------------------------------------

  /**
   * A template's settings as an organisation *type* sees them: two levels, not
   * three. The federation's screen, where locks are set.
   */
  async resolveSettingsForType(
    templateId: string,
    organizationTypeId: string
  ): Promise<ResolvedSettings> {
    const result = await db.query(
      `SELECT t.id,
              t.key,
              t.default_settings,
              typ.settings    AS type_settings,
              typ.locked_keys AS type_locked
         FROM event_type_templates t
         LEFT JOIN event_type_setting_overrides typ
                ON typ.template_id = t.id
               AND typ.organization_type_id = $2
        WHERE t.id = $1`,
      [templateId, organizationTypeId]
    );

    if (result.rows.length === 0) throw new NotFoundError('Event type template not found');

    const row = result.rows[0];
    const settings: Record<string, unknown> = {};
    const sources: Record<string, SettingSource> = {};

    for (const [key, value] of Object.entries(asFlatMap(row.default_settings))) {
      settings[key] = value;
      sources[key] = 'template';
    }
    for (const [key, value] of Object.entries(asFlatMap(row.type_settings))) {
      settings[key] = value;
      sources[key] = 'organisation-type';
    }

    return {
      templateId: row.id,
      templateKey: row.key,
      settings,
      sources,
      locked: asKeyList(row.type_locked).sort(),
    };
  }

  /** A federation's rules, and the keys it fixes. Platform administrators only. */
  async saveTypeOverride(
    templateId: string,
    organizationTypeId: string,
    input: { settings: Record<string, unknown>; lockedKeys?: string[] }
  ): Promise<ResolvedSettings> {
    const template = await this.getTemplate(templateId);

    const settings = asFlatMap(input.settings);
    const lockedKeys = [...new Set(asKeyList(input.lockedKeys))].sort();

    /*
     * Locking a key the type has not set is allowed and means "the template's
     * value, and no club may move it" — see resolveSettings. Locking a key that
     * exists at neither level is a typo, and one that would sit in the database
     * silently forbidding a setting nobody has: refused here, where the person
     * who typed it is still present.
     */
    const knownKeys = new Set([
      ...Object.keys(asFlatMap(template.defaultSettings)),
      ...Object.keys(settings),
    ]);
    const unknown = lockedKeys.filter((key) => !knownKeys.has(key));
    if (unknown.length > 0) {
      throw new BadRequestError(
        `Cannot lock a setting this template does not define: ${unknown.join(', ')}`
      );
    }

    await db.query(
      UPSERT_TYPE_OVERRIDE_SQL,
      [templateId, organizationTypeId, JSON.stringify(settings), JSON.stringify(lockedKeys)]
    );

    return this.resolveSettingsForType(templateId, organizationTypeId);
  }

  /**
   * A club's own rules.
   *
   * A locked key is **refused, not discarded**. Accepting the request and
   * quietly dropping the key would show the club its old value back with no
   * explanation and no way to tell a lock from a bug — so the write fails with
   * a 403 that names every key it refused, not merely the first.
   */
  async saveOrganisationOverride(
    templateId: string,
    organisationId: string,
    settings: Record<string, unknown>
  ): Promise<ResolvedSettings> {
    await this.assertTemplateVisible(templateId, organisationId);

    const incoming = asFlatMap(settings);
    const { locked } = await this.resolveSettings(templateId, organisationId);
    const refused = Object.keys(incoming).filter((key) => locked.includes(key));
    if (refused.length > 0) {
      logger.warn('Refused a write to locked settings', { templateId, organisationId, refused });
      throw new ForbiddenError(
        refused.length === 1
          ? `"${refused[0]}" is fixed by your organisation type and cannot be changed here`
          : `These settings are fixed by your organisation type and cannot be changed here: ${refused.join(', ')}`
      );
    }

    if (Object.keys(incoming).length === 0) {
      /*
       * Nothing of its own left, so the row goes rather than lingering as an
       * empty object. This is what "Reset to template" leaves behind, and an
       * absent row is the honest record of a club that overrides nothing.
       */
      await db.query(
        `DELETE FROM event_type_setting_overrides
          WHERE template_id = $1 AND organisation_id = $2`,
        [templateId, organisationId]
      );
    } else {
      await db.query(
        UPSERT_ORG_OVERRIDE_SQL,
        [templateId, organisationId, JSON.stringify(incoming)]
      );
    }

    return this.resolveSettings(templateId, organisationId);
  }
}

export const eventTypeTemplateService = new EventTypeTemplateService();
