/**
 * Unit Tests for the mandatory Application Form field on EventActivityForm.
 *
 * The application form is mandatory for every activity: the field is marked
 * required, the placeholder cannot be selected to clear an existing choice,
 * and once the user attempts to save an unselected field is flagged.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mock setup (MUST be before component imports) ──

// Hoisted so the vi.mock factories below can reference these safely.
// The component reloads its data whenever `execute` or `organisation` change
// identity, so both must be stable or the load effect loops forever.
const { mockExecute, stableExecute, stableOrganisation } = vi.hoisted(() => {
  const forms = [
    { id: 'form-1', name: 'Junior Entry Form' },
    { id: 'form-2', name: 'Senior Entry Form' },
  ];
  const execute = vi.fn((config: { url: string }) =>
    config.url.includes('application-forms')
      ? Promise.resolve(forms)
      : Promise.resolve({ discounts: [] }),
  );
  return {
    mockExecute: execute,
    stableExecute: (config: { url: string }) => execute(config),
    stableOrganisation: { id: 'org-1', currency: 'GBP' },
  };
});

vi.mock('react-quill', () => ({
  __esModule: true,
  default: () => <div data-testid="react-quill" />,
}));

vi.mock('react-quill/dist/quill.snow.css', () => ({}));

vi.mock('@itsplainsailing/components', () => ({
  DiscountSelector: () => <div data-testid="discount-selector" />,
}));

vi.mock('@itsplainsailing/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute: stableExecute }),
  useOrganisation: () => ({ organisation: stableOrganisation }),
}));

vi.mock('@itsplainsailing/orgadmin-shell', async () => ({
  ...(await import('@itsplainsailing/orgadmin-core/test/shellMock')).createShellMock(),
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-GB' },
  }),
  useLocale: () => ({ locale: 'en-GB' }),
  formatCurrency: (value: number, currency: string) => `${currency} ${value.toFixed(2)}`,
}));

import EventActivityForm from '../EventActivityForm';
import type { EventActivityFormData } from '../../types/event.types';

const makeActivity = (
  overrides: Partial<EventActivityFormData> = {},
): EventActivityFormData => ({
  name: 'Junior Sailing',
  description: 'For sailors aged 8-16',
  showPublicly: true,
  applicationFormId: undefined,
  limitApplicants: false,
  allowSpecifyQuantity: false,
  useTermsAndConditions: false,
  fee: 0,
  supportedPaymentMethods: [],
  handlingFeeIncluded: false,
  discountIds: [],
  ...overrides,
});

const renderForm = (
  props: Partial<React.ComponentProps<typeof EventActivityForm>> = {},
) =>
  render(
    <EventActivityForm
      activity={makeActivity()}
      index={0}
      onChange={vi.fn()}
      onRemove={vi.fn()}
      paymentMethods={[]}
      {...props}
    />,
  );

const REQUIRED_MESSAGE = 'events.activities.validation.applicationFormRequired';

/**
 * Waits for the application forms to load, then opens the dropdown.
 * MUI's Select opens on mouseDown rather than click.
 */
const openApplicationFormSelect = async () => {
  await waitFor(() => expect(mockExecute).toHaveBeenCalled());

  const combobox = screen.getByRole('combobox', {
    name: /events\.activities\.activity\.applicationForm/i,
  });
  await waitFor(() => expect(combobox).not.toHaveAttribute('aria-disabled', 'true'));

  fireEvent.mouseDown(combobox);
};

describe('EventActivityForm – mandatory Application Form', () => {
  beforeEach(() => {
    mockExecute.mockClear();
  });

  it('marks the application form field as required', async () => {
    renderForm();

    const label = await screen.findByText('events.activities.activity.applicationForm');
    // MUI renders the required asterisk inside the label element.
    expect(label.textContent).toContain('*');
  });

  it('does not flag the empty field before the user attempts to save', async () => {
    renderForm();

    await screen.findByText('events.activities.activity.applicationForm');
    expect(screen.queryByText(REQUIRED_MESSAGE)).not.toBeInTheDocument();
  });

  it('flags the empty field once the parent reports validation errors', async () => {
    renderForm({ showErrors: true });

    expect(await screen.findByText(REQUIRED_MESSAGE)).toBeInTheDocument();
  });

  it('does not flag the field when a form is selected, even after a failed save', async () => {
    renderForm({
      activity: makeActivity({ applicationFormId: 'form-1' }),
      showErrors: true,
    });

    await screen.findByText('events.activities.activity.applicationForm');
    expect(screen.queryByText(REQUIRED_MESSAGE)).not.toBeInTheDocument();
  });

  it('reports the selected form to the parent', async () => {
    const onChange = vi.fn();
    renderForm({ onChange });

    await openApplicationFormSelect();

    fireEvent.click(await screen.findByRole('option', { name: 'Senior Entry Form' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ applicationFormId: 'form-2' }),
    );
  });

  it('does not offer the placeholder as a way to clear an existing selection', async () => {
    renderForm({ activity: makeActivity({ applicationFormId: 'form-1' }) });

    await openApplicationFormSelect();

    const placeholder = await screen.findByRole('option', {
      name: 'events.activities.activity.selectForm',
    });
    expect(placeholder).toHaveAttribute('aria-disabled', 'true');
  });
});
