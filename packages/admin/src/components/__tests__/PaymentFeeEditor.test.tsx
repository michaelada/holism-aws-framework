import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  PaymentFeeEditor,
  exampleFee,
  currencySymbol,
  EXAMPLE_CHARGE,
  type PaymentFeeEditorMethod,
  exampleApplicationFee,
  hasIncompleteRates,
} from '../PaymentFeeEditor';

const stripe: PaymentFeeEditorMethod = {
  paymentMethodId: 'pm-stripe',
  displayName: 'Pay By Card (Stripe)',
  fixedFee: 0.25,
  percentageFee: 1.5,
  taxPercentage: 23,
};

const helix: PaymentFeeEditorMethod = {
  paymentMethodId: 'pm-helix',
  displayName: 'Pay By Card (Helix-Pay)',
  fixedFee: 0.2,
  percentageFee: 1.75,
  taxPercentage: 23,
};

const renderEditor = (props: Partial<React.ComponentProps<typeof PaymentFeeEditor>> = {}) => {
  const onChange = vi.fn();
  const result = render(
    <PaymentFeeEditor
      methods={[stripe]}
      currency="EUR"
      onChange={onChange}
      {...props}
    />
  );
  return { ...result, onChange };
};

describe('exampleFee', () => {
  it('matches the backend calculation for the documented rates', () => {
    // €62.00 charge: 0.25 + 1.5% = 1.18, plus 23% tax 0.27 = 1.45.
    // The same figures the backend's handling-fee tests assert.
    expect(exampleFee({ fixedFee: 0.25, percentageFee: 1.5, taxPercentage: 23 }))
      .toEqual({ net: 1.18, tax: 0.27, total: 1.45 });
  });

  it('omits tax when the rate is zero', () => {
    const fee = exampleFee({ fixedFee: 0.25, percentageFee: 1.5, taxPercentage: 0 });
    expect(fee.tax).toBe(0);
    expect(fee.total).toBe(fee.net);
  });

  it('charges the fixed element even at a zero percentage', () => {
    expect(exampleFee({ fixedFee: 0.25, percentageFee: 0, taxPercentage: 0 }).total)
      .toBe(0.25);
  });

  it('rounds twice, not once, so tax is charged on the rounded fee', () => {
    // net rounds to 1.18 before tax is applied; taxing the unrounded value
    // would give a different cent.
    const fee = exampleFee({ fixedFee: 0.25, percentageFee: 1.5, taxPercentage: 23 });
    expect(fee.net + fee.tax).toBeCloseTo(fee.total, 10);
  });
});

describe('currencySymbol', () => {
  it('maps known currencies', () => {
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('GBP')).toBe('£');
  });

  it('falls back to the code for anything else', () => {
    expect(currencySymbol('SEK')).toBe('SEK');
  });
});

describe('PaymentFeeEditor', () => {
  it('renders a card per payment method', () => {
    renderEditor({ methods: [stripe, helix] });
    expect(screen.getByText('Pay By Card (Stripe)')).toBeInTheDocument();
    expect(screen.getByText('Pay By Card (Helix-Pay)')).toBeInTheDocument();
  });

  it('shows the three rate fields in the organisation type currency', () => {
    renderEditor();
    expect(screen.getByLabelText(/Stripe\) fixed fee/i)).toHaveValue(0.25);
    expect(screen.getByLabelText(/Stripe\) percentage fee/i)).toHaveValue(1.5);
    expect(screen.getByLabelText(/Stripe\) tax on fee/i)).toHaveValue(23);
    // Two currency adornments now — the handling fee's and the platform
    // share's — so the assertion is that the symbol is shown, not that it is
    // shown once.
    expect(screen.getAllByText('€').length).toBeGreaterThan(0);
  });

  it('shows a worked example so a mistyped rate is obvious', () => {
    renderEditor();
    // The whole point of the example: 1.5% reads very differently from 15%.
    // The figure appears twice — once as what the member pays, once as what the
    // platform keeps when no application fee is configured — so both are
    // accepted rather than requiring a single match.
    expect(screen.getAllByText(/€1\.45/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(new RegExp(`€${EXAMPLE_CHARGE}\\.00`)).length
    ).toBeGreaterThan(0);
  });

  it('drops the tax clause from the example when tax is zero', () => {
    renderEditor({ methods: [{ ...stripe, taxPercentage: 0 }] });
    expect(screen.queryByText(/plus 0% tax/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/€1\.18/).length).toBeGreaterThan(0);
  });

  it('reports edits to the caller', () => {
    const { onChange } = renderEditor();
    fireEvent.change(screen.getByLabelText(/fixed fee/i), { target: { value: '0.5' } });

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ paymentMethodId: 'pm-stripe', fixedFee: 0.5 }),
    ]);
  });

  it('lets a field be cleared without snapping it to zero mid-edit', () => {
    const { onChange } = renderEditor();
    fireEvent.change(screen.getByLabelText(/fixed fee/i), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ fixedFee: '' }),
    ]);
  });

  it('warns how many organisations a handling-fee change affects', () => {
    renderEditor({ organisationCount: 14 });
    // The count now appears twice — once in this warning and once in the
    // platform-share note below it — so the assertion is on the sentence that
    // distinguishes them, not on the number alone.
    expect(screen.getByText(/Payments already taken are unaffected/)).toBeInTheDocument();
    expect(screen.getAllByText(/14 organisations/).length).toBeGreaterThan(0);
  });

  it('uses the singular for one organisation', () => {
    renderEditor({ organisationCount: 1 });
    expect(screen.getAllByText(/1 organisation$/).length).toBeGreaterThan(0);
  });

  it('shows no warning when no organisations exist yet', () => {
    renderEditor({ organisationCount: 0 });
    expect(screen.queryByText(/Changing these fees affects/)).not.toBeInTheDocument();
  });

  /**
   * The two blocks in this editor inherit by different rules, a few pixels
   * apart: handling fees are live, so a change here re-prices every
   * organisation of the type; the platform share is copy-on-create, so a change
   * here reaches only organisations created afterwards. Leaving that implicit
   * is how an operator discovers it the expensive way.
   */
  it('says the platform share is a default for new organisations only', () => {
    renderEditor({ organisationCount: 14 });
    // `<strong>new</strong>` splits the sentence across text nodes, so the
    // assertion matches a contiguous fragment rather than the whole sentence.
    expect(
      screen.getByText(/organisations of this type start with/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/each carries its own platform share/i)
    ).toBeInTheDocument();
  });

  it('omits the inheritance note when the type has no organisations yet', () => {
    renderEditor({ organisationCount: 0 });
    expect(screen.queryByText(/organisations of this type start with/i)).not.toBeInTheDocument();
  });

  it('restores a method to the platform default', () => {
    const { onChange } = renderEditor({
      methods: [{ ...stripe, fixedFee: 9, percentageFee: 9, taxPercentage: 9 }],
      defaults: [
        {
          paymentMethodId: 'pm-stripe',
          name: 'stripe',
          displayName: 'Pay By Card (Stripe)',
          fixedFee: 0.25,
          percentageFee: 1.5,
          taxPercentage: 0,
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: /reset all .* rates/i }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ fixedFee: 0.25, percentageFee: 1.5, taxPercentage: 0 }),
    ]);
  });

  it('clears the platform share when resetting, not just the handling fee', () => {
    // The reset used to restore the three handling-fee fields and silently
    // leave a mistyped application fee in place, so "reset" did not mean reset.
    const { onChange } = renderEditor({
      methods: [
        {
          ...stripe,
          fixedFee: 9,
          percentageFee: 9,
          taxPercentage: 9,
          applicationFeeFixed: 4,
          applicationFeePercentage: 7,
        },
      ],
      defaults: [
        {
          paymentMethodId: 'pm-stripe',
          name: 'stripe',
          displayName: 'Pay By Card (Stripe)',
          fixedFee: 0.25,
          percentageFee: 1.5,
          taxPercentage: 0,
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: /reset all .* rates/i }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        fixedFee: 0.25,
        percentageFee: 1.5,
        taxPercentage: 0,
        applicationFeeFixed: null,
        applicationFeePercentage: null,
      }),
    ]);
  });

  it('offers no reset when the platform has no default for the method', () => {
    renderEditor({ defaults: [] });
    expect(screen.queryByRole('button', { name: /reset all .* rates/i }))
      .not.toBeInTheDocument();
  });

  it('flags a cleared handling-fee field instead of letting it save as zero', () => {
    // `Number('') || 0` on the save path meant a field cleared for retyping was
    // written as a zero fee for every organisation of the type.
    renderEditor({
      methods: [{ ...stripe, fixedFee: '' as unknown as number }],
    });

    expect(screen.getByText(/Required — enter 0 for no fixed fee/i)).toBeInTheDocument();
    expect(hasIncompleteRates([{ ...stripe, fixedFee: '' as unknown as number }])).toBe(true);
    expect(hasIncompleteRates([stripe])).toBe(false);
  });

  it('explains itself when there are no card methods to configure', () => {
    renderEditor({ methods: [] });
    expect(screen.getByText(/No card payment methods are available/i)).toBeInTheDocument();
  });

  it('disables every field while saving', () => {
    renderEditor({ disabled: true });
    expect(screen.getByLabelText(/fixed fee/i)).toBeDisabled();
    expect(screen.getByLabelText(/percentage fee/i)).toBeDisabled();
    expect(screen.getByLabelText(/tax on fee/i)).toBeDisabled();
  });

  /**
   * The platform's share is a different question from the member's surcharge,
   * and confusing the two is the risk this editor exists to reduce.
   */
  describe('platform share (Connect application fee)', () => {
    it('offers both application fee fields', () => {
      renderEditor();
      expect(screen.getByLabelText(/application fee \(fixed\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/application fee \(%\)/i)).toBeInTheDocument();
    });

    it('says the platform keeps the handling fee when nothing is configured', () => {
      renderEditor();
      // The behaviour in force before this was configurable — an unset field
      // must not read as "the platform takes nothing".
      expect(screen.getByText(/Not set/i)).toBeInTheDocument();
    });

    it('states plainly that it does not change what the member pays', () => {
      renderEditor();
      expect(screen.getByText(/does not change what the\s+member pays/i)).toBeInTheDocument();
    });

    it('reports edits to the caller', () => {
      const onChange = vi.fn();
      renderEditor({ onChange });

      fireEvent.change(screen.getByLabelText(/application fee \(%\)/i), {
        target: { value: '2' },
      });

      expect(onChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ applicationFeePercentage: 2 }),
        ])
      );
    });
  });

  describe('exampleApplicationFee', () => {
    const method = { paymentMethodId: 'pm', displayName: 'Stripe', fixedFee: 0.25, percentageFee: 1.5, taxPercentage: 0 };

    it('falls back to the handling fee when unconfigured', () => {
      expect(exampleApplicationFee(method as never, 1.18)).toEqual({
        amount: 1.18,
        configured: false,
      });
    });

    it('treats a half-filled pair as unconfigured', () => {
      // One box filled and one empty is an unfinished form, not a deliberate 0%.
      expect(
        exampleApplicationFee({ ...method, applicationFeeFixed: 0.5 } as never, 1.18).configured
      ).toBe(false);
    });

    it('computes the configured share on the charge', () => {
      // 0.50 + 2% of 62 = 0.50 + 1.24 = 1.74
      expect(
        exampleApplicationFee(
          { ...method, applicationFeeFixed: 0.5, applicationFeePercentage: 2 } as never,
          1.18
        )
      ).toEqual({ amount: 1.74, configured: true });
    });

    it('treats an explicit zero as configured', () => {
      expect(
        exampleApplicationFee(
          { ...method, applicationFeeFixed: 0, applicationFeePercentage: 0 } as never,
          1.18
        )
      ).toEqual({ amount: 0, configured: true });
    });
  });
});
