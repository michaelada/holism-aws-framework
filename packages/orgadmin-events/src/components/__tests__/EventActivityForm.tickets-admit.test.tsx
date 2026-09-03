/**
 * How many people one ticket admits.
 *
 * A club sets it per activity — one for a day ticket, four for a family
 * ticket — and it is copied onto each ticket at issue, so what the gate
 * enforces is what the holder was sold. The field's whole job is to be a whole
 * number of at least one: an activity that admits nobody is not a setting, it
 * is a broken gate. See docs/GATE_SCANNING.md.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { stableExecute, stableOrganisation } = vi.hoisted(() => ({
  stableExecute: (config: { url: string }) =>
    config.url.includes('application-forms')
      ? Promise.resolve([])
      : Promise.resolve({ discounts: [] }),
  stableOrganisation: { id: 'org-1', currency: 'GBP' },
}));

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
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-GB' } }),
  useLocale: () => ({ locale: 'en-GB' }),
  formatCurrency: (value: number, currency: string) => `${currency} ${value.toFixed(2)}`,
}));

import EventActivityForm from '../EventActivityForm';
import type { EventActivityFormData } from '../../types/event.types';

const makeActivity = (overrides: Partial<EventActivityFormData> = {}): EventActivityFormData => ({
  name: 'Gate entry',
  description: 'One day pass',
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

const renderForm = (activity: EventActivityFormData, onChange = vi.fn()) => {
  render(
    <EventActivityForm
      activity={activity}
      index={0}
      onChange={onChange}
      onRemove={vi.fn()}
      paymentMethods={[]}
    />,
  );
  return { onChange, field: screen.getByLabelText(/ticketsAdmit/i) as HTMLInputElement };
};

describe('people admitted per ticket', () => {
  it('starts at one, which is what every ticket meant before this existed', () => {
    const { field } = renderForm(makeActivity());

    expect(field).toHaveValue(1);
  });

  it('shows what an activity already has', () => {
    const { field } = renderForm(makeActivity({ ticketsAdmit: 4 }));

    expect(field).toHaveValue(4);
  });

  it('passes a new number up', () => {
    const { onChange, field } = renderForm(makeActivity());

    fireEvent.change(field, { target: { value: '4' } });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ticketsAdmit: 4 }));
  });

  it('will not let an activity admit nobody', () => {
    const { onChange, field } = renderForm(makeActivity({ ticketsAdmit: 2 }));

    fireEvent.change(field, { target: { value: '0' } });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ticketsAdmit: 1 }));
  });

  it('reads an emptied box as one rather than as nothing', () => {
    const { onChange, field } = renderForm(makeActivity({ ticketsAdmit: 3 }));

    fireEvent.change(field, { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ticketsAdmit: 1 }));
  });
});
