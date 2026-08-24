import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import DeliveryConfigurationSection from '../DeliveryConfigurationSection';

/**
 * What a club charges to get an order to a member.
 *
 * The delivery fee is money, so the parsing matters: an emptied fee box must
 * become *nothing*, not `NaN` — a `NaN` fee serialises to null in one place and
 * poisons a total in another, and either way the member is charged something
 * nobody chose.
 */

type DeliveryRule = { minQuantity: number; deliveryFee: number };

let onChange: ReturnType<typeof vi.fn>;

const renderSection = ({
  deliveryType = 'fixed',
  deliveryFee = 5 as number | undefined,
  deliveryRules = [] as DeliveryRule[],
} = {}) => {
  onChange = vi.fn();
  return render(
    <DeliveryConfigurationSection
      deliveryType={deliveryType as never}
      deliveryFee={deliveryFee}
      deliveryRules={deliveryRules}
      onChange={onChange}
    />
  );
};

/** The value reported for a given field on the most recent change. */
const reportedFor = (field: string) =>
  onChange.mock.calls.filter(([name]) => name === field).at(-1)?.[1];

const numberInputs = () =>
  Array.from(document.querySelectorAll('input[type="number"]')) as HTMLInputElement[];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DeliveryConfigurationSection — the fee', () => {
  it('reports a fee that was typed as a number', () => {
    renderSection({ deliveryFee: 5 });

    const fee = numberInputs().find((i) => i.value === '5')!;
    fireEvent.change(fee, { target: { value: '7.5' } });

    expect(reportedFor('deliveryFee')).toBe(7.5);
  });

  /*
   * `parseFloat('')` is NaN. Reported as a fee it survives every truthiness
   * check on the way to the order total, where it turns the whole total into
   * NaN — a shop that cannot say what anything costs.
   */
  it('reports an emptied fee as nothing at all, never NaN', () => {
    renderSection({ deliveryFee: 5 });

    const fee = numberInputs().find((i) => i.value === '5')!;
    fireEvent.change(fee, { target: { value: '' } });

    expect(reportedFor('deliveryFee')).toBeUndefined();
  });

  it('accepts a fee of zero as a real answer, not as blank', () => {
    renderSection({ deliveryFee: 5 });

    const fee = numberInputs().find((i) => i.value === '5')!;
    fireEvent.change(fee, { target: { value: '0' } });

    // Free delivery is a choice a club makes; it is not the same as no answer.
    expect(reportedFor('deliveryFee')).toBe(0);
  });
});

describe('DeliveryConfigurationSection — how delivery is charged', () => {
  it('reports a change of delivery type', () => {
    renderSection({ deliveryType: 'fixed' });

    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    fireEvent.click(options[options.length - 1]);

    expect(onChange).toHaveBeenCalledWith('deliveryType', expect.any(String));
  });
});

describe('DeliveryConfigurationSection — quantity-based rules', () => {
  it('adds a rule that starts at one item and no charge', () => {
    renderSection({ deliveryType: 'quantity_based', deliveryRules: [] });

    const add = screen.getAllByRole('button').find((b) => /add/i.test(b.textContent ?? ''))!;
    fireEvent.click(add);

    expect(reportedFor('deliveryRules')).toEqual([{ minQuantity: 1, deliveryFee: 0 }]);
  });

  it('keeps the rules already there when another is added', () => {
    renderSection({
      deliveryType: 'quantity_based',
      deliveryRules: [{ minQuantity: 5, deliveryFee: 3 }],
    });

    const add = screen.getAllByRole('button').find((b) => /add/i.test(b.textContent ?? ''))!;
    fireEvent.click(add);

    expect(reportedFor('deliveryRules')).toHaveLength(2);
    expect(reportedFor('deliveryRules')[0]).toEqual({ minQuantity: 5, deliveryFee: 3 });
  });

  it('removes the rule that was chosen, not the last one', () => {
    renderSection({
      deliveryType: 'quantity_based',
      deliveryRules: [
        { minQuantity: 1, deliveryFee: 5 },
        { minQuantity: 10, deliveryFee: 2 },
      ],
    });

    const deleteButtons = screen
      .getAllByRole('button')
      .filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
    fireEvent.click(deleteButtons[0]);

    expect(reportedFor('deliveryRules')).toEqual([{ minQuantity: 10, deliveryFee: 2 }]);
  });

  it('edits one rule without disturbing the other', () => {
    renderSection({
      deliveryType: 'quantity_based',
      deliveryRules: [
        { minQuantity: 1, deliveryFee: 5 },
        { minQuantity: 10, deliveryFee: 2 },
      ],
    });

    const first = numberInputs().find((i) => i.value === '1')!;
    fireEvent.change(first, { target: { value: '3' } });

    const rules = reportedFor('deliveryRules');
    expect(rules[1]).toEqual({ minQuantity: 10, deliveryFee: 2 });
  });
});
