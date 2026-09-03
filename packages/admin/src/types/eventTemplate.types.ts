import type { SettingSource } from '@itsplainsailing/components';

/**
 * Event type templates — the platform's definition of a discipline.
 *
 * A club's `event_types` row is free text with no behaviour. A discipline that
 * knows how to schedule itself is defined once, here, and a club's event type
 * points at it. See docs/EVENT_SCHEDULING_AND_SCORING_PROPOSAL.md §2.
 */

/** One phase of the discipline — dressage, cross country, show jumping. */
export interface TemplatePhase {
  key: string;
  name: string;
  /** Which kind of resource it runs on, by `TemplateResourceKind.key`. */
  resourceKind: string;
}

/** A kind of place a phase happens in: arena, course, court, lane. */
export interface TemplateResourceKind {
  key: string;
  defaultLabel: string;
}

/**
 * What a competitor brings — a horse, a boat, a dog.
 *
 * `registration-then-field` prefers a registered record and falls back to a
 * form field, which is the answer to §8's fifth question: a registration is a
 * first-class record where the club uses registrations, and a form field named
 * on the entry where it does not.
 */
export interface TemplateEntity {
  mode: 'none' | 'field' | 'registration-then-field';
  label?: string;
  registrationType?: string;
  formFieldKey?: string;
}

/**
 * The part a club cannot override.
 *
 * Every field is optional because a draft is half-written by definition, and a
 * template saved before its phases are decided must still load.
 */
export interface TemplateShape {
  phases?: TemplatePhase[];
  /** `strict` runs the phases in the order above; `any` lets them interleave. */
  phaseOrder?: 'strict' | 'any';
  /** Whether reordering is a legitimate variation of this discipline. */
  clubMayReorder?: boolean;
  resourceKinds?: TemplateResourceKind[];
  entity?: TemplateEntity;
  /** `settingKey → wording`, for the settings panel. Optional throughout. */
  settingLabels?: Record<string, string>;
}

export interface EventTypeTemplate {
  id: string;
  key: string;
  displayName: string;
  description: string | null;
  /** Null means "no gate beyond `event-scheduling`". */
  capability: string | null;
  schedulerKind: string;
  shape: TemplateShape;
  /** A flat map of dotted keys. See `describeSettings`. */
  defaultSettings: Record<string, unknown>;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface EventTypeTemplateInput {
  key: string;
  displayName: string;
  description?: string | null;
  capability?: string | null;
  schedulerKind?: string;
  shape?: TemplateShape;
  defaultSettings?: Record<string, unknown>;
  status?: string;
}

/** What the rules endpoints answer with, at either scope. */
export interface ResolvedEventRules {
  templateId: string;
  templateKey: string;
  settings: Record<string, unknown>;
  sources: Record<string, SettingSource>;
  locked: string[];
}

/**
 * The schedulers a template may use.
 *
 * One is implemented. The other two are named on the screen because a platform
 * administrator choosing "sequential phases" should be able to see what it is
 * being chosen instead of — and they are the known future tenants, differing in
 * how slots are *populated* rather than in anything around them (proposal §3.5).
 */
export const SCHEDULER_KINDS = [
  {
    value: 'sequential-phases',
    label: 'Sequential phases',
    help: 'Each competitor takes their turn, one at a time.',
    available: true,
  },
  {
    value: 'heats-and-finals',
    label: 'Heats and finals',
    help: 'Not built yet — swimming and athletics.',
    available: false,
  },
  {
    value: 'bracket',
    label: 'Bracket',
    help: 'Not built yet — tennis and other knockouts.',
    available: false,
  },
] as const;
