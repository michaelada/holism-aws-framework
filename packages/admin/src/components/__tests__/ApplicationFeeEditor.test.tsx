import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ApplicationFeeEditor,
  ApplicationFeeDraft,
  hasHalfSetApplicationFee,
  organisationApplicationExample,
} from '../ApplicationFeeEditor';
import type { OrganisationApplicationFee } from '../../types/organization.types';

const stripe: OrganisationApplicationFee = {
  paymentMethodId: 'pm-stripe',
  paymentMethodName: 'stripe',
  paymentMethodDisplayName: 'Pay By Card (Stripe)',
  applicationFeeFixed: 0.25,
  applicationFeePercentage: 1,
  typeDefaultFixed: 0.5,
  typeDefaultPercentage: 2,
  source: 'organisation',
};

const draftFor = (fee: OrganisationApplicationFee): ApplicationFeeDraft => ({
  paymentMethodId: fee.paymentMethodId,
  applicationFeeFixed: fee.applicationFeeFixed,
  applicationFeePercentage: fee.applicationFeePercentage,
});

const renderEditor = (
  props: Partial<React.ComponentProps<typeof ApplicationFeeEditor>> = {}
) => {
  const onChange = vi.fn();
  const fees = props.fees ?? [stripe];
  const result = render(
    <ApplicationFeeEditor
      fees={fees}
      draft={props.draft ?? fees.map(draftFor)}
      currency="EUR"
      organisationTypeName="Sailing Club"
      organisationName="Killarney Sailing Club"
      handlingRatesByMethod={{
        'pm-stripe': { fixedFee: 0.25, percentageFee: 1.5, taxPercentage: 23 },
      }}
      onChange={onChange}
      {...props}
    />
  );
  return { ...result, onChange };
};

describe('organisationApplicationExample', () => {
  it('takes the percentage on the value sold, not on the handling fee', () => {
    // 0.50 fixed + 2% of 62.00 = 0.50 + 1.24 = 1.74
    const result = organisationApplicationExample(
      { paymentMethodId: 'pm', applicationFeeFixed: 0.5, applicationFeePercentage: 2 },
      1.45
    );
    expect(result).toEqual({ amount: 1.74, configured: true });
  });

  it('reports the handling fee when the pair is unset', () => {
    const result = organisationApplicationExample(
      { paymentMethodId: 'pm', applicationFeeFixed: null, applicationFeePercentage: null },
      1.45
    );
    expect(result).toEqual({ amount: 1.45, configured: false });
  });

  it('treats a half-set pair as unconfigured rather than guessing the missing half', () => {
    const result = organisationApplicationExample(
      { paymentMethodId: 'pm', applicationFeeFixed: 0.5, applicationFeePercentage: '' },
      1.45
    );
    expect(result.configured).toBe(false);
  });
});

describe('hasHalfSetApplicationFee', () => {
  it.each([
    [{ applicationFeeFixed: 0.5, applicationFeePercentage: '' }, true],
    [{ applicationFeeFixed: '', applicationFeePercentage: 2 }, true],
    [{ applicationFeeFixed: 0.5, applicationFeePercentage: 2 }, false],
    [{ applicationFeeFixed: '', applicationFeePercentage: '' }, false],
    [{ applicationFeeFixed: null, applicationFeePercentage: null }, false],
  ])('detects %o as half-set: %s', (values, expected) => {
    expect(hasHalfSetApplicationFee([{ paymentMethodId: 'pm', ...values } as ApplicationFeeDraft]))
      .toBe(expected);
  });
});

describe('ApplicationFeeEditor', () => {
  it('shows the type default beneath each field, so divergence is visible', () => {
    renderEditor();
    expect(screen.getByText('Type default: €0.50')).toBeInTheDocument();
    expect(screen.getByText('Type default: 2%')).toBeInTheDocument();
  });

  it('says in words when the organisation differs from its type', () => {
    renderEditor();
    expect(screen.getByText(/Differs from the Sailing Club default/)).toBeInTheDocument();
  });

  it('says in words when it matches', () => {
    const matching = { ...stripe, applicationFeeFixed: 0.5, applicationFeePercentage: 2 };
    renderEditor({ fees: [matching], draft: [draftFor(matching)] });
    expect(screen.getByText(/Same as the Sailing Club default/)).toBeInTheDocument();
  });

  it('works the example against the organisation, in its own currency', () => {
    renderEditor();
    // 0.25 + 1% of 62.00 = 0.87
    expect(screen.getByText(/€0\.87/)).toBeInTheDocument();
    expect(screen.getByText(/Killarney Sailing Club receives the rest/)).toBeInTheDocument();
  });

  it('explains what an unset pair actually costs, using the handling fee', () => {
    const unset = { ...stripe, applicationFeeFixed: null, applicationFeePercentage: null };
    renderEditor({ fees: [unset], draft: [draftFor(unset)] });
    // Handling fee on €62.00 at 0.25 + 1.5% + 23% tax = €1.45
    expect(screen.getByText(/the platform keeps the handling fee/i)).toBeInTheDocument();
    expect(screen.getByText(/€1\.45/)).toBeInTheDocument();
  });

  it('refuses a half-set pair in the UI, not only in the database', () => {
    const half: ApplicationFeeDraft = {
      paymentMethodId: 'pm-stripe',
      applicationFeeFixed: 0.25,
      applicationFeePercentage: '',
    };
    renderEditor({ draft: [half] });

    expect(screen.getByText(/Set both the amount and the percentage, or clear both/))
      .toBeInTheDocument();
    expect(screen.getByText(/Finish both fields to see what the platform would keep/))
      .toBeInTheDocument();
  });

  it('reports edits to the caller', () => {
    const { onChange } = renderEditor();
    fireEvent.change(screen.getByLabelText(/Stripe\).*fixed amount/i), {
      target: { value: '0.75' },
    });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ applicationFeeFixed: 0.75 }),
    ]);
  });

  it('lets a field be cleared without snapping it to zero mid-edit', () => {
    const { onChange } = renderEditor();
    fireEvent.change(screen.getByLabelText(/Stripe\).*fixed amount/i), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ applicationFeeFixed: '' }),
    ]);
  });

  it('offers to copy the type default only when the two differ', () => {
    const onResetToTypeDefault = vi.fn();
    renderEditor({ onResetToTypeDefault });
    fireEvent.click(screen.getByRole('button', { name: /Copy the Sailing Club default/ }));
    expect(onResetToTypeDefault).toHaveBeenCalledWith('pm-stripe');
  });

  it('hides the copy action when the organisation already matches its type', () => {
    const matching = { ...stripe, applicationFeeFixed: 0.5, applicationFeePercentage: 2 };
    renderEditor({
      fees: [matching],
      draft: [draftFor(matching)],
      onResetToTypeDefault: vi.fn(),
    });
    expect(screen.queryByRole('button', { name: /Copy the Sailing Club default/ }))
      .not.toBeInTheDocument();
  });

  it('names each field by its payment method, since two can share a page', () => {
    renderEditor();
    expect(
      screen.getByLabelText('Pay By Card (Stripe) application fee, fixed amount')
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Pay By Card (Stripe) application fee, percentage')
    ).toBeInTheDocument();
  });

  it('announces the worked example politely as rates change', () => {
    const { container } = renderEditor();
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });

  it('says there is nothing to configure rather than showing an empty box', () => {
    renderEditor({ fees: [], draft: [] });
    expect(screen.getByText(/no card payment method enabled/i)).toBeInTheDocument();
  });

  it('handles a type that has no default of its own', () => {
    const noDefault = { ...stripe, typeDefaultFixed: null, typeDefaultPercentage: null };
    renderEditor({ fees: [noDefault], draft: [draftFor(noDefault)] });
    expect(screen.getAllByText(/Type default: not set/)).toHaveLength(2);
  });
});
