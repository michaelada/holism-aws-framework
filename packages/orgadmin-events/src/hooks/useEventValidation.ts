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
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
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
 * Validates the Activities step (step 3).
 * - At least one activity is required
 * - Every activity must have a non-empty name and description
 */
function validateActivities(
  formData: EventFormData,
  t: (key: string) => string,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (formData.activities.length === 0) {
    errors.activities = t('events.activities.validation.atLeastOne');
  } else {
    const invalidActivities = formData.activities.filter(
      (activity) => !activity.name.trim() || !activity.description.trim(),
    );
    if (invalidActivities.length > 0) {
      errors.activities = t('events.activities.validation.allFieldsRequired');
    }
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
   *   1 – Event Dates (no validation currently)
   *   2 – Ticketing Settings (no validation currently)
   *   3 – Activities (at least one, all fields required)
   *   4 – Review & Confirm (no validation – read-only)
   */
  const validateStep = useCallback(
    (step: number, formData: EventFormData): Record<string, string> => {
      switch (step) {
        case 0:
          return validateBasicInfo(formData, t);
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
