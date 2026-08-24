import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithI18n } from '../../test/i18n-test-utils';
import MembershipTypeForm from '../MembershipTypeForm';
import type { CreateMembershipTypeDto } from '../../types/membership.types';

/**
 * The fields shared by the single and group membership forms.
 *
 * The form reports each change upward rather than holding state, so what it
 * owns is *which* fields exist for a given configuration:
 *
 *  - a rolling membership has a term in months and no end date; a fixed one has
 *    an end date and no term. Showing both invites a club to fill in two
 *    contradictory answers;
 *  - the handling-fee option only makes sense when a card is accepted and there
 *    is something to charge — and when the club stops accepting cards, an
 *    already-ticked handling fee has to be turned off, or it is saved against a
 *    membership that can no longer be paid for by card.
 */

const base = (over: Partial<CreateMembershipTypeDto> = {}): CreateMembershipTypeDto =>
  ({
    name: '',
    description: '',
    membershipFormId: '',
    membershipStatus: 'open',
    isRollingMembership: false,
    automaticallyApprove: false,
    memberLabels: [],
    supportedPaymentMethods: [],
    fee: 0,
    handlingFeeIncluded: false,
    useTermsAndConditions: false,
    membershipTypeCategory: 'single',
    discountIds: [],
    ...over,
  }) as CreateMembershipTypeDto;

const FORMS = [{ id: 'form-1', name: 'Membership Application' }];
const METHODS = [
  { id: 'pay-offline', name: 'Pay Offline' },
  { id: 'stripe', name: 'Card Payment (Stripe)' },
];

let onChange: ReturnType<typeof vi.fn>;

const renderForm = (formData = base(), methods = METHODS) => {
  onChange = vi.fn();
  return renderWithI18n(
    <MembershipTypeForm
      formData={formData}
      onChange={onChange}
      applicationForms={FORMS}
      paymentMethods={methods}
      organisation={{ id: 'org-1', currency: 'EUR' }}
    />
  );
};

/*
 * The suite's i18n catalogue carries only a handful of keys, so most labels
 * render as the key itself. Matching either form keeps these assertions
 * readable now and still correct once a key is translated.
 */
const label = (key: string, english: string) => new RegExp(`${key}|${english}`, 'i');

const FIELD = {
  membershipForm: label('membershipForm', 'membership form'),
  membershipStatus: label('membershipStatus', 'membership status'),
  rolling: label('isRollingMembership', 'rolling'),
  months: label('numberOfMonths', 'number of months'),
  validUntil: label('validUntil', 'valid until'),
  fee: /^(payment\.fee|fee \(|fee$)/i,
  paymentMethods: label('supportedPaymentMethods', 'payment methods'),
  handlingFee: label('handlingFeeIncluded', 'handling fee'),
  terms: label('useTermsAndConditions', 'terms and conditions'),
  autoApprove: label('automaticallyApprove', 'automatically approve'),
};

/** The value reported for a field on the most recent change. */
const reportedFor = (field: string) =>
  onChange.mock.calls.filter(([name]) => name === field).at(-1)?.[1];

const combo = (name: RegExp) => screen.getByRole('combobox', { name });

const choosePaymentMethods = (labels: RegExp[]) => {
  fireEvent.mouseDown(combo(FIELD.paymentMethods));
  const listbox = screen.getByRole('listbox');
  labels.forEach((label) => fireEvent.click(within(listbox).getByText(label)));
  fireEvent.keyDown(listbox, { key: 'Escape' });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MembershipTypeForm — the basics', () => {
  it('reports the name as it is typed', () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Junior Member' } });

    expect(reportedFor('name')).toBe('Junior Member');
  });

  it('reports the description', () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: 'Under 18s' } });

    expect(reportedFor('description')).toBe('Under 18s');
  });

  it('offers the club’s own application forms', () => {
    renderForm();

    fireEvent.mouseDown(combo(FIELD.membershipForm));

    expect(within(screen.getByRole('listbox')).getByText('Membership Application')).toBeInTheDocument();
  });

  it('reports the chosen application form', () => {
    renderForm();

    fireEvent.mouseDown(combo(FIELD.membershipForm));
    fireEvent.click(within(screen.getByRole('listbox')).getByText('Membership Application'));

    expect(reportedFor('membershipFormId')).toBe('form-1');
  });

  it('reports a membership being closed to new applications', () => {
    renderForm();

    fireEvent.mouseDown(combo(FIELD.membershipStatus));
    fireEvent.click(screen.getByRole('listbox').querySelector('[data-value="closed"]')!);

    expect(reportedFor('membershipStatus')).toBe('closed');
  });
});

describe('MembershipTypeForm — how long a membership lasts', () => {
  it('asks for an end date on a fixed-period membership, and not a term', () => {
    renderForm(base({ isRollingMembership: false }));

    // The suite's setup stubs `DatePicker` out entirely, so the date field is
    // identified by what it replaces: the term must not be on screen.
    expect(screen.queryByLabelText(FIELD.months)).not.toBeInTheDocument();
    expect(screen.getByTestId('date-picker')).toBeInTheDocument();
  });

  it('asks for a term on a rolling membership, and not an end date', () => {
    renderForm(base({ isRollingMembership: true }));

    // Both at once invites two contradictory answers about when it ends.
    expect(screen.getByLabelText(FIELD.months)).toBeInTheDocument();
    expect(screen.queryByLabelText(FIELD.validUntil)).not.toBeInTheDocument();
  });

  it('reports the switch to a rolling membership', () => {
    renderForm(base({ isRollingMembership: false }));

    fireEvent.click(screen.getByLabelText(FIELD.rolling));

    expect(reportedFor('isRollingMembership')).toBe(true);
  });

  it('reports a term as a number, not as typed text', () => {
    renderForm(base({ isRollingMembership: true }));

    fireEvent.change(screen.getByLabelText(FIELD.months), { target: { value: '18' } });

    expect(reportedFor('numberOfMonths')).toBe(18);
  });

  it('reports a cleared term as nothing rather than as zero months', () => {
    renderForm(base({ isRollingMembership: true, numberOfMonths: 12 }));

    fireEvent.change(screen.getByLabelText(FIELD.months), { target: { value: '' } });

    // Zero would be a membership that expires the moment it is bought.
    expect(reportedFor('numberOfMonths')).toBeUndefined();
  });
});

describe('MembershipTypeForm — the fee', () => {
  it('reports a fee as a number', () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(FIELD.fee), { target: { value: '45.50' } });

    expect(reportedFor('fee')).toBe(45.5);
  });

  it('treats an emptied fee box as free rather than as NaN', () => {
    renderForm(base({ fee: 45 }));

    fireEvent.change(screen.getByLabelText(FIELD.fee), { target: { value: '' } });

    // A NaN fee poisons every total it is added into.
    expect(reportedFor('fee')).toBe(0);
  });
});

describe('MembershipTypeForm — the handling fee', () => {
  it('stays hidden when the club takes no card payments', () => {
    renderForm(base({ supportedPaymentMethods: ['pay-offline'], fee: 50 }));

    expect(screen.queryByLabelText(FIELD.handlingFee)).not.toBeInTheDocument();
  });

  it('stays hidden on a free membership, where there is nothing to add it to', () => {
    renderForm(base({ supportedPaymentMethods: ['stripe'], fee: 0 }));

    expect(screen.queryByLabelText(FIELD.handlingFee)).not.toBeInTheDocument();
  });

  it('appears once a card payment is accepted for a fee', () => {
    renderForm(base({ supportedPaymentMethods: ['stripe'], fee: 50 }));

    expect(screen.getByLabelText(FIELD.handlingFee)).toBeInTheDocument();
  });

  it('recognises a card method by its name, not only by a known id', () => {
    renderForm(
      base({ supportedPaymentMethods: ['acme-1'], fee: 50 }),
      [{ id: 'acme-1', name: 'Acme Card Processing' }]
    );

    // Clubs are onboarded onto new processors; the option must not vanish.
    expect(screen.getByLabelText(FIELD.handlingFee)).toBeInTheDocument();
  });

  it('assumes an unknown "stripe" id is a card even when the list is empty', () => {
    renderForm(base({ supportedPaymentMethods: ['stripe'], fee: 50 }), []);

    expect(screen.getByLabelText(FIELD.handlingFee)).toBeInTheDocument();
  });

  it('reports the handling fee being included', () => {
    renderForm(base({ supportedPaymentMethods: ['stripe'], fee: 50 }));

    fireEvent.click(screen.getByLabelText(FIELD.handlingFee));

    expect(reportedFor('handlingFeeIncluded')).toBe(true);
  });

  it('turns an included handling fee off when card payments are dropped', () => {
    renderForm(
      base({ supportedPaymentMethods: ['stripe'], fee: 50, handlingFeeIncluded: true })
    );

    // Deselect Stripe, leaving offline payment only.
    choosePaymentMethods([/Card Payment/]);

    // Left on, it is saved against a membership no card can pay for.
    expect(reportedFor('handlingFeeIncluded')).toBe(false);
    expect(reportedFor('supportedPaymentMethods')).toEqual([]);
  });

  it('leaves the handling fee alone while a card method is still accepted', () => {
    renderForm(
      base({ supportedPaymentMethods: ['stripe'], fee: 50, handlingFeeIncluded: true })
    );

    choosePaymentMethods([/Pay Offline/]);

    expect(reportedFor('handlingFeeIncluded')).toBeUndefined();
    expect(reportedFor('supportedPaymentMethods')).toEqual(['stripe', 'pay-offline']);
  });
});

describe('MembershipTypeForm — terms and conditions', () => {
  it('keeps the editor out of the way until terms are turned on', () => {
    renderForm(base({ useTermsAndConditions: false }));

    expect(screen.queryByTestId('quill-editor')).not.toBeInTheDocument();
  });

  it('offers an editor once terms are turned on', () => {
    renderForm(base({ useTermsAndConditions: true }));

    expect(screen.getByTestId('quill-editor')).toBeInTheDocument();
  });

  it('reports what was written into the terms', () => {
    renderForm(base({ useTermsAndConditions: true }));

    fireEvent.change(screen.getByTestId('quill-editor'), {
      target: { value: '<p>Members agree to…</p>' },
    });

    expect(reportedFor('termsAndConditions')).toBe('<p>Members agree to…</p>');
  });

  it('reports terms being switched on', () => {
    renderForm(base({ useTermsAndConditions: false }));

    fireEvent.click(screen.getByLabelText(FIELD.terms));

    expect(reportedFor('useTermsAndConditions')).toBe(true);
  });
});

describe('MembershipTypeForm — approving applications', () => {
  it('reports applications being approved automatically', () => {
    renderForm();

    fireEvent.click(screen.getByLabelText(FIELD.autoApprove));

    expect(reportedFor('automaticallyApprove')).toBe(true);
  });
});
