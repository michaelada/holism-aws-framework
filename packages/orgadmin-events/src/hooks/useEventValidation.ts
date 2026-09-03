/**
 * useEventValidation Hook
 *
 * Extracted from CreateEventPage – encapsulates all form validation logic.
 * Provides `validateAll` (used on save) and `validateStep` (used by the wizard
 * when advancing between steps).
 *
 * Both CreateEventPage and EditEventPage consume this hook so that validation
 * rules stay identical across the two flows.
 */

import { useCallback } from 'react';
import { useTranslation } from '@itsplainsailing/orgadmin-shell';
import type { EventFormData } from '../types/event.types';

export interface UseEventValidationReturn {
  validateAll: (formData: EventFormData) => Record<string, string>;
  validateStep: (step: number, formData: EventFormData) => Record<string, string>;
}

/**
 * Validates the Basic Information step (step 0).
 * - name is required
 * - description is required
 */
function validateBasicInfo(
  formData: EventFormData,
  t: (key: string) => string,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!formData.name.trim()) {
    errors.name = t('events.basicInfo.validation.nameRequired');
  }
  if (!formData.description.trim()) {
    errors.description = t('events.basicInfo.validation.descriptionRequired');
  }

  return errors;
}

/**
 * Validates the Event Dates step (step 1).
 *
 * All four dates are required. An event runs between two dates and takes
 * entries between two others, and a club cannot be asked to guess any of them
 * later — an event with no entry window is one the server treats as *always*
 * open (`open_date_entries IS NULL OR …` in public-event.service), which is
 * never what somebody meant to create.
 *
 * The form used to fill absent entry dates with the current time, which hid the
 * omission rather than catching it: a new event was created closed to entries
 * and an edited one silently acquired a window. See
 * docs/EVENT_ENTRY_DATE_INVENTION_FIX.md.
 *
 * The ordering rules are asserted here as well as auto-corrected in
 * `useEventForm.handleChange`. The handler only fires when a *picker* changes,
 * so an event loaded with an inconsistent pair — legacy data, or a value typed
 * into the text input — would otherwise reach the server unchecked.
 */
function validateDates(
  formData: EventFormData,
  t: (key: string) => string,
): Record<string, string> {
  const errors: Record<string, string> = {};

  // `undefined` is the absent case; an invalid Date is what a half-typed value
  // in the picker's text input produces, and it must not count as present.
  const given = (value: unknown): Date | null => {
    if (value === null || value === undefined || value === '') return null;
    const date = value instanceof Date ? value : new Date(value as string);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const startDate = given(formData.startDate);
  const endDate = given(formData.endDate);
  const openDateEntries = given(formData.openDateEntries);
  const entriesClosingDate = given(formData.entriesClosingDate);

  if (!startDate) errors.startDate = t('events.dates.validation.startDateRequired');
  if (!endDate) errors.endDate = t('events.dates.validation.endDateRequired');
  if (!openDateEntries) {
    errors.openDateEntries = t('events.dates.validation.openDateEntriesRequired');
  }
  if (!entriesClosingDate) {
    errors.entriesClosingDate = t('events.dates.validation.entriesClosingDateRequired');
  }

  if (startDate && endDate && endDate < startDate) {
    errors.endDate = t('events.dates.validation.endBeforeStart');
  }
  if (openDateEntries && entriesClosingDate && entriesClosingDate <= openDateEntries) {
    errors.entriesClosingDate = t('events.dates.validation.closingBeforeOpening');
  }

  return errors;
}

/**
 * Validates the Activities step (step 3).
 * - At least one activity is required
 * - Every activity must have a non-empty name and description
 * - Every activity must have an application form selected
 */
function validateActivities(
  formData: EventFormData,
  t: (key: string) => string,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (formData.activities.length === 0) {
    errors.activities = t('events.activities.validation.atLeastOne');
    return errors;
  }

  const invalidActivities = formData.activities.filter(
    (activity) => !activity.name.trim() || !activity.description.trim(),
  );
  if (invalidActivities.length > 0) {
    errors.activities = t('events.activities.validation.allFieldsRequired');
    return errors;
  }

  // An application form is mandatory – entries cannot be captured without one.
  const missingApplicationForm = formData.activities.filter(
    (activity) => !activity.applicationFormId,
  );
  if (missingApplicationForm.length > 0) {
    errors.activities = t('events.activities.validation.applicationFormRequired');
  }

  return errors;
}

export function useEventValidation(): UseEventValidationReturn {
  const { t } = useTranslation();

  /**
   * Validates all form sections at once. Used when saving the event
   * (both draft and publish).
   */
  const validateAll = useCallback(
    (formData: EventFormData): Record<string, string> => {
      return {
        ...validateBasicInfo(formData, t),
        ...validateDates(formData, t),
        ...validateActivities(formData, t),
      };
    },
    [t],
  );

  /**
   * Validates a single wizard step. Used by the wizard's Next button
   * to block advancement on invalid data.
   *
   * Step mapping:
   *   0 – Basic Information (name, description)
   *   1 – Event Dates (all four required, and in order)
   *   2 – Ticketing Settings (no validation currently)
   *   3 – Activities (at least one, all fields required)
   *   4 – Review & Confirm (no validation – read-only)
   */
  const validateStep = useCallback(
    (step: number, formData: EventFormData): Record<string, string> => {
      switch (step) {
        case 0:
          return validateBasicInfo(formData, t);
        case 1:
          return validateDates(formData, t);
        case 3:
          return validateActivities(formData, t);
        default:
          return {};
      }
    },
    [t],
  );

  return { validateAll, validateStep };
}
