import { db } from '../database/pool';
import { logger } from '../config/logger';
import { NotFoundError } from '../middleware/errors';

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

/** A flat map, defensively — a column could hold anything a migration allowed. */
const asFlatMap = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asKeyList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

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
}

export const eventTypeTemplateService = new EventTypeTemplateService();
