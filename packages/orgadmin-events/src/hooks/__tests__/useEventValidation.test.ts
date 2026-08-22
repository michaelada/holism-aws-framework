/**
 * Unit Tests for useEventValidation
 *
 * Covers the activity validation rules, in particular that an application
 * form must always be selected for every activity on an event.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@aws-web-framework/orgadmin-shell', async () => ({
  ...(await import('@aws-web-framework/orgadmin-core/test/shellMock')).createShellMock(),
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-GB' },
  }),
}));

import { useEventValidation } from '../useEventValidation';
import type { EventFormData, EventActivityFormData } from '../../types/event.types';

const ACTIVITIES_STEP = 3;

const makeActivity = (
  overrides: Partial<EventActivityFormData> = {},
): EventActivityFormData => ({
  name: 'Junior Sailing',
  description: 'For sailors aged 8-16',
  showPublicly: true,
  applicationFormId: 'form-1',
  limitApplicants: false,
  allowSpecifyQuantity: false,
  useTermsAndConditions: false,
  fee: 0,
  supportedPaymentMethods: [],
  handlingFeeIncluded: false,
  discountIds: [],
  ...overrides,
});

const makeFormData = (activities: EventActivityFormData[]): EventFormData =>
  ({
    name: 'Summer Regatta',
    description: 'Annual regatta',
    activities,
  }) as EventFormData;

const renderValidation = () => renderHook(() => useEventValidation()).result.current;

describe('useEventValidation – activities', () => {
  it('accepts an activity that has an application form selected', () => {
    const { validateAll } = renderValidation();

    const errors = validateAll(makeFormData([makeActivity()]));

    expect(errors.activities).toBeUndefined();
  });

  it('rejects an activity with no application form selected', () => {
    const { validateAll } = renderValidation();

    const errors = validateAll(
      makeFormData([makeActivity({ applicationFormId: undefined })]),
    );

    expect(errors.activities).toBe(
      'events.activities.validation.applicationFormRequired',
    );
  });

  it('rejects an activity whose application form is an empty string', () => {
    const { validateAll } = renderValidation();

    const errors = validateAll(makeFormData([makeActivity({ applicationFormId: '' })]));

    expect(errors.activities).toBe(
      'events.activities.validation.applicationFormRequired',
    );
  });

  it('rejects when only one of several activities is missing an application form', () => {
    const { validateAll } = renderValidation();

    const errors = validateAll(
      makeFormData([
        makeActivity({ name: 'Race 1' }),
        makeActivity({ name: 'Race 2', applicationFormId: undefined }),
        makeActivity({ name: 'Race 3' }),
      ]),
    );

    expect(errors.activities).toBe(
      'events.activities.validation.applicationFormRequired',
    );
  });

  it('reports the missing name/description error before the application form error', () => {
    const { validateAll } = renderValidation();

    const errors = validateAll(
      makeFormData([makeActivity({ name: '  ', applicationFormId: undefined })]),
    );

    expect(errors.activities).toBe('events.activities.validation.allFieldsRequired');
  });

  it('reports the at-least-one error when there are no activities', () => {
    const { validateAll } = renderValidation();

    const errors = validateAll(makeFormData([]));

    expect(errors.activities).toBe('events.activities.validation.atLeastOne');
  });

  it('blocks the activities wizard step when an application form is missing', () => {
    const { validateStep } = renderValidation();

    const errors = validateStep(
      ACTIVITIES_STEP,
      makeFormData([makeActivity({ applicationFormId: undefined })]),
    );

    expect(errors.activities).toBe(
      'events.activities.validation.applicationFormRequired',
    );
  });

  it('allows the activities wizard step to advance once a form is selected', () => {
    const { validateStep } = renderValidation();

    const errors = validateStep(ACTIVITIES_STEP, makeFormData([makeActivity()]));

    expect(errors).toEqual({});
  });
});
