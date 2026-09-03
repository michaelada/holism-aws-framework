/**
 * Turning a template's settings into rows a screen can draw.
 *
 * The same panel appears three times — on the template, on an organisation type
 * and on a club — and looks nearly identical each time. That is the point of
 * the design (wireframes §2): an administrator learns it once. So the shaping
 * of it lives here rather than in two packages that would drift.
 *
 * ## Why there is no schema for a setting
 *
 * Settings are a **flat map of dotted keys** — `minutesPerCompetitor.dressage`
 * — which is what lets every setting carry its own source and its own lock.
 * Everything a screen needs follows from that map without a second list to keep
 * in step with it:
 *
 *  - **which settings exist** — the keys of `default_settings`;
 *  - **grouping** — the dots, so `minutesPerCompetitor.dressage` and
 *    `minutesPerCompetitor.xc` draw under one heading;
 *  - **the input to show** — the type of the value.
 *
 * Only the wording cannot be derived, so a template may carry a `settingLabels`
 * map in its shape. Absent one, the key is humanised. A second declaration of
 * *which settings exist* would be a list to forget to update, and the failure
 * would be a setting that resolves and is invisible.
 *
 * ## Labels are data, and are not translated
 *
 * A setting key is authored by a platform administrator, not by us, so there is
 * no i18n key to write for it — the same position as an event type name or a
 * form field label. The **chrome** around them (the column headings, the
 * buttons, the sentence naming who locked a row) is translated in the usual
 * way; the setting names are not. See CLAUDE.md §3.2.
 */

export type SettingSource = 'template' | 'organisation-type' | 'organisation';

export type SettingValueType = 'number' | 'boolean' | 'text';

export interface SettingRow {
  /** The dotted key, as stored and as sent back. */
  key: string;
  /** What to show. The leaf of the key, humanised, unless the template says. */
  label: string;
  type: SettingValueType;
  value: unknown;
  /** Which level this value came from. Absent where the caller gave no sources. */
  source?: SettingSource;
  /** Fixed by the organisation type; a club may read it but not change it. */
  locked: boolean;
}

export interface SettingGroup {
  /** The part before the first dot, or null for a setting with no dot. */
  key: string | null;
  label: string;
  rows: SettingRow[];
}

export interface DescribeSettingsInput {
  settings: Record<string, unknown>;
  sources?: Record<string, SettingSource>;
  locked?: string[];
  /** `key → wording`, from the template's shape. Optional. */
  labels?: Record<string, string>;
}

/**
 * `minutesPerCompetitor` → `Minutes per competitor`.
 *
 * Sentence case, not title case, because DESIGN.md is sentence case throughout
 * and a heading that shouts differs from every other heading on the screen.
 */
export const humaniseSettingKey = (key: string): string => {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    // A camelCase boundary, and the one before a trailing acronym, so
    // `maxHTTPRetries` becomes `max HTTP retries` rather than `max H T T P…`.
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();

  if (!spaced) return key;

  // Lowercase only the words that are not already an acronym, so `HTTP` is left
  // alone while `Competitor` becomes `competitor`.
  const words = spaced
    .split(/\s+/)
    .map((word) => (word.length > 1 && word === word.toUpperCase() ? word : word.toLowerCase()));

  return words[0].charAt(0).toUpperCase() + words[0].slice(1) + (words.length > 1 ? ' ' + words.slice(1).join(' ') : '');
};

const valueType = (value: unknown): SettingValueType => {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'text';
};

/**
 * Group and label a resolved settings map.
 *
 * **Sorted by label, not by the order the keys arrive in.** A jsonb column does
 * not preserve the order its keys were written in — Postgres stores them
 * shortest-first and then bytewise — so any "natural" order a screen appeared
 * to show would be an accident of key length, and would change when a key was
 * renamed. Alphabetical is at least the same every time, and findable.
 */
export function describeSettings({
  settings,
  sources,
  locked,
  labels,
}: DescribeSettingsInput): SettingGroup[] {
  const lockedKeys = new Set(locked ?? []);
  const groups = new Map<string | null, SettingGroup>();

  for (const [key, value] of Object.entries(settings ?? {})) {
    const dot = key.indexOf('.');
    const groupKey = dot > 0 ? key.slice(0, dot) : null;
    const leaf = dot > 0 ? key.slice(dot + 1) : key;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        // A group can be named too — `minutesPerCompetitor` as a label of its
        // own — which is how the heading reads as a phrase rather than a stem.
        label: groupKey ? labels?.[groupKey] ?? humaniseSettingKey(groupKey) : '',
        rows: [],
      });
    }

    groups.get(groupKey)!.rows.push({
      key,
      label: labels?.[key] ?? humaniseSettingKey(leaf),
      type: valueType(value),
      value,
      source: sources?.[key],
      locked: lockedKeys.has(key),
    });
  }

  const byLabel = (a: { label: string }, b: { label: string }) =>
    a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });

  for (const group of groups.values()) group.rows.sort(byLabel);

  /*
   * Ungrouped settings first. They are the plain ones — "objections window",
   * "break length" — and burying them under two named groups would make the
   * simple case the hard one to find.
   */
  const ungrouped = groups.get(null);
  const named = [...groups.values()].filter((group) => group.key !== null).sort(byLabel);

  return ungrouped ? [ungrouped, ...named] : named;
}

/** Every key in a group, for "reset this group" and for counting overrides. */
export const keysInGroups = (groups: SettingGroup[]): string[] =>
  groups.flatMap((group) => group.rows.map((row) => row.key));
