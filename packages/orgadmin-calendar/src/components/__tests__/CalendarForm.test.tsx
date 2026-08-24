import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import CalendarForm from '../CalendarForm';
import type { CalendarFormData } from '../../types/calendar.types';

/**
 * Everything a club decides about one bookable facility.
 *
 * The form holds no state — every edit is reported upward as a whole new
 * `CalendarFormData` — so what matters is that each change carries the rest of
 * the form with it. A handler that reports only its own field silently drops
 * the other twenty, and the club saves a calendar it did not configure.
 *
 * Two rules beyond that are worth pinning. The **booking window** cannot go
 * negative: a negative minimum means bookings in the past. And the
 * **handling fee** must be turned off when card payments are dropped, or it is
 * saved against a calendar that can no longer take a card.
 */

vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute: vi.fn().mockResolvedValue({ discounts: [] }) }),
}));

vi.mock('@aws-web-framework/orgadmin-shell', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-GB' } }),
  useCapabilities: () => ({ hasCapability: () => true }),
}));

vi.mock('@aws-web-framework/components', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  DiscountSelector: () => <div data-testid="discount-selector" />,
}));

const METHODS = [
  { id: 'pay-offline', name: 'Pay Offline' },
  { id: 'stripe', name: 'Card Payment (Stripe)' },
];

const base = (over: Partial<CalendarFormData> = {}): CalendarFormData =>
  ({
    name: '',
    description: '',
    displayColour: '#1976d2',
    displayIcon: null,
    status: 'open',
    enableAutomatedSchedule: false,
    scheduleRules: [],
    minDaysInAdvance: 0,
    maxDaysInAdvance: 30,
    supportedPaymentMethods: [],
    handlingFeeIncluded: false,
    discountIds: [],
    timeSlotConfigurations: [],
    blockedPeriods: [],
    useTermsAndConditions: false,
    allowCancellations: false,
    ...over,
  }) as CalendarFormData;

let onChange: ReturnType<typeof vi.fn>;

const renderForm = (formData = base(), paymentMethods = METHODS) => {
  onChange = vi.fn();
  return render(
    <CalendarForm
      formData={formData}
      onChange={onChange}
      paymentMethods={paymentMethods}
      applicationForms={[{ id: 'form-1', name: 'Booking Form' }]}
      organisation={{ id: 'org-1', currency: 'EUR' }}
    />
  );
};

/** The whole form as most recently reported. */
const reported = (): CalendarFormData => onChange.mock.calls.at(-1)![0];

const field = (key: string) => screen.getByLabelText(new RegExp(key, 'i'));

const numberInput = (key: string) =>
  screen.getByLabelText(new RegExp(key, 'i')) as HTMLInputElement;

const choosePaymentMethod = (label: RegExp) => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /supportedPaymentMethods/i }));
  const listbox = screen.getByRole('listbox');
  fireEvent.click(within(listbox).getByText(label));
  fireEvent.keyDown(listbox, { key: 'Escape' });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CalendarForm — naming the calendar', () => {
  it('reports the name without dropping the rest of the form', () => {
    renderForm(base({ description: 'Grass courts', maxDaysInAdvance: 60 }));

    fireEvent.change(field('calendarName'), { target: { value: 'Tennis Court 1' } });

    expect(reported().name).toBe('Tennis Court 1');
    // Everything else has to travel with it, or it is lost on save.
    expect(reported().description).toBe('Grass courts');
    expect(reported().maxDaysInAdvance).toBe(60);
  });

  it('reports the description', () => {
    renderForm();

    fireEvent.change(field('description'), { target: { value: 'Grass courts' } });

    expect(reported().description).toBe('Grass courts');
  });

  it('reports the colour a calendar is shown in', () => {
    renderForm();

    fireEvent.change(field('displayColour'), { target: { value: '#ff0000' } });

    expect(reported().displayColour).toBe('#ff0000');
  });

  it('reports a calendar being closed to new bookings', () => {
    renderForm(base({ status: 'open' } as never));

    fireEvent.mouseDown(screen.getByRole('combobox', { name: /calendar\.fields\.status/i }));
    fireEvent.click(screen.getByRole('listbox').querySelector('[data-value="closed"]')!);

    expect(reported().status).toBe('closed');
  });
});

describe('CalendarForm — how far ahead members can book', () => {
  it('reports the minimum notice as a number', () => {
    renderForm();

    fireEvent.change(numberInput('minDaysInAdvance'), { target: { value: '2' } });

    expect(reported().minDaysInAdvance).toBe(2);
  });

  it('refuses a negative minimum, which would allow booking the past', () => {
    renderForm();

    fireEvent.change(numberInput('minDaysInAdvance'), { target: { value: '-5' } });

    expect(reported().minDaysInAdvance).toBe(0);
  });

  it('treats a cleared window as zero rather than as NaN', () => {
    renderForm(base({ maxDaysInAdvance: 30 }));

    fireEvent.change(numberInput('maxDaysInAdvance'), { target: { value: '' } });

    // NaN days ahead makes every slot fail the window comparison.
    expect(reported().maxDaysInAdvance).toBe(0);
  });

  it('reports the furthest ahead a member may book', () => {
    renderForm();

    fireEvent.change(numberInput('maxDaysInAdvance'), { target: { value: '90' } });

    expect(reported().maxDaysInAdvance).toBe(90);
  });
});

describe('CalendarForm — the automated schedule', () => {
  it('keeps the schedule rules hidden until they are switched on', () => {
    renderForm(base({ enableAutomatedSchedule: false }));

    expect(screen.queryByText(/scheduleRules|schedule rules/i)).not.toBeInTheDocument();
  });

  it('reports the automated schedule being switched on', () => {
    renderForm(base({ enableAutomatedSchedule: false }));

    fireEvent.click(screen.getByLabelText(/enableAutomatedSchedule/i));

    expect(reported().enableAutomatedSchedule).toBe(true);
  });
});

describe('CalendarForm — payment', () => {
  it('reports the payment methods a club accepts', () => {
    renderForm();

    choosePaymentMethod(/Pay Offline/);

    expect(reported().supportedPaymentMethods).toEqual(['pay-offline']);
  });

  it('offers the handling fee only where a card can be taken', () => {
    renderForm(base({ supportedPaymentMethods: ['pay-offline'] }));

    expect(screen.queryByLabelText(/handlingFeeIncluded/i)).not.toBeInTheDocument();
  });

  it('offers the handling fee once a card method is accepted', () => {
    renderForm(base({ supportedPaymentMethods: ['stripe'] }));

    expect(screen.getByLabelText(/handlingFeeIncluded/i)).toBeInTheDocument();
  });

  it('recognises a card processor by name rather than by a fixed list of ids', () => {
    renderForm(base({ supportedPaymentMethods: ['acme-1'] }), [
      { id: 'acme-1', name: 'Acme Card Processing' },
    ]);

    expect(screen.getByLabelText(/handlingFeeIncluded/i)).toBeInTheDocument();
  });

  it('turns the handling fee off when the last card method is dropped', () => {
    renderForm(base({ supportedPaymentMethods: ['stripe'], handlingFeeIncluded: true }));

    choosePaymentMethod(/Card Payment/);

    // Left on, it is charged against a calendar no card can pay for.
    expect(reported().handlingFeeIncluded).toBe(false);
    expect(reported().supportedPaymentMethods).toEqual([]);
  });

  it('leaves the handling fee alone while a card is still accepted', () => {
    renderForm(base({ supportedPaymentMethods: ['stripe'], handlingFeeIncluded: true }));

    choosePaymentMethod(/Pay Offline/);

    expect(reported().handlingFeeIncluded).toBe(true);
    expect(reported().supportedPaymentMethods).toEqual(['stripe', 'pay-offline']);
  });
});

describe('CalendarForm — cancellations', () => {
  it('asks nothing about notice until cancellations are allowed', () => {
    renderForm(base({ allowCancellations: false }));

    expect(screen.queryByLabelText(/cancelDaysInAdvance/i)).not.toBeInTheDocument();
  });

  it('asks how much notice a cancellation needs once they are allowed', () => {
    renderForm(base({ allowCancellations: true, cancelDaysInAdvance: 1 } as never));

    expect(screen.getByLabelText(/cancelDaysInAdvance/i)).toBeInTheDocument();
  });

  it('reports cancellations being allowed', () => {
    renderForm(base({ allowCancellations: false }));

    fireEvent.click(screen.getByLabelText(/allowCancellations/i));

    expect(reported().allowCancellations).toBe(true);
  });

  it('reports the notice a cancellation needs', () => {
    renderForm(base({ allowCancellations: true, cancelDaysInAdvance: 1 } as never));

    fireEvent.change(screen.getByLabelText(/cancelDaysInAdvance/i), { target: { value: '3' } });

    expect(reported().cancelDaysInAdvance).toBe(3);
  });
});

describe('CalendarForm — terms and conditions', () => {
  it('keeps the terms box away until terms are switched on', () => {
    renderForm(base({ useTermsAndConditions: false }));

    expect(screen.queryByLabelText(/^calendar\.fields\.termsAndConditions$/i)).not.toBeInTheDocument();
  });

  it('reports terms being switched on', () => {
    renderForm(base({ useTermsAndConditions: false }));

    fireEvent.click(screen.getByLabelText(/useTermsAndConditions/i));

    expect(reported().useTermsAndConditions).toBe(true);
  });

  it('reports the terms that were written', () => {
    renderForm(base({ useTermsAndConditions: true }));

    fireEvent.change(screen.getByLabelText(/^calendar\.fields\.termsAndConditions$/i), {
      target: { value: 'Bookings are non-refundable within 24 hours.' },
    });

    expect(reported().termsAndConditions).toBe('Bookings are non-refundable within 24 hours.');
  });
});
