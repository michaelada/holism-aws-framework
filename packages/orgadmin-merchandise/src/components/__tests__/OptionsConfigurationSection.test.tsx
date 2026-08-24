import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OptionsConfigurationSection from '../OptionsConfigurationSection';

/**
 * The variants a club sells an item in — sizes, colours, and what each costs.
 *
 * This is a nested list: option *types* each hold option *values*, and every
 * edit rebuilds the whole structure and hands it upward. The failure mode is
 * always the same shape — an edit that reaches the right value but the wrong
 * type, or that flattens its siblings on the way past. A shop that quietly
 * loses "Large" from its shirts sells sizes it does not stock.
 */

type OptionValue = { name: string; price: number; sku?: string; stockQuantity?: number };
type OptionType = { name: string; optionValues: OptionValue[] };

const size = (): OptionType => ({
  name: 'Size',
  optionValues: [
    { name: 'Small', price: 25 },
    { name: 'Large', price: 28 },
  ],
});

const colour = (): OptionType => ({
  name: 'Colour',
  optionValues: [{ name: 'Navy', price: 0 }],
});

let onChange: ReturnType<typeof vi.fn>;

const renderSection = (optionTypes: OptionType[] = [], trackStock = false) => {
  onChange = vi.fn();
  return render(
    <OptionsConfigurationSection
      optionTypes={optionTypes}
      onChange={onChange}
      trackStock={trackStock}
    />
  );
};

const reported = (): OptionType[] => onChange.mock.calls.at(-1)![0];

const buttonsMatching = (pattern: RegExp) =>
  screen.getAllByRole('button').filter((b) => pattern.test(b.textContent ?? ''));

const deleteButtons = () =>
  screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OptionsConfigurationSection — option types', () => {
  it('adds an empty option type for the club to name', () => {
    renderSection();

    fireEvent.click(buttonsMatching(/add option type|add type|add/i)[0]);

    expect(reported()).toHaveLength(1);
    expect(reported()[0].name).toBe('');
    expect(reported()[0].optionValues).toEqual([]);
  });

  it('keeps the types already there when another is added', () => {
    renderSection([size()]);

    fireEvent.click(buttonsMatching(/add option type|add type/i)[0]);

    expect(reported()).toHaveLength(2);
    expect(reported()[0].name).toBe('Size');
    expect(reported()[0].optionValues).toHaveLength(2);
  });

  it('renames the type that was edited, and only that one', () => {
    renderSection([size(), colour()]);

    fireEvent.change(screen.getByDisplayValue('Size'), { target: { value: 'Shirt Size' } });

    expect(reported()[0].name).toBe('Shirt Size');
    expect(reported()[1].name).toBe('Colour');
  });

  it('keeps a renamed type’s values intact', () => {
    renderSection([size()]);

    fireEvent.change(screen.getByDisplayValue('Size'), { target: { value: 'Shirt Size' } });

    // Renaming a type must not be a way to lose everything it holds.
    expect(reported()[0].optionValues.map((v) => v.name)).toEqual(['Small', 'Large']);
  });

  it('removes the type that was chosen, not the last one', () => {
    renderSection([size(), colour()]);

    fireEvent.click(deleteButtons()[0]);

    expect(reported()).toHaveLength(1);
    expect(reported()[0].name).toBe('Colour');
  });
});

describe('OptionsConfigurationSection — the values inside a type', () => {
  it('adds a free, unnamed value to the type it was asked for', () => {
    renderSection([size(), colour()]);

    const addValueButtons = buttonsMatching(/add value|add option value/i);
    fireEvent.click(addValueButtons[1]);

    // The second type gained one; the first is untouched.
    expect(reported()[1].optionValues).toHaveLength(2);
    expect(reported()[1].optionValues[1]).toEqual({ name: '', price: 0 });
    expect(reported()[0].optionValues).toHaveLength(2);
  });

  it('renames a value without disturbing its siblings', () => {
    renderSection([size()]);

    fireEvent.change(screen.getByDisplayValue('Small'), { target: { value: 'Extra Small' } });

    expect(reported()[0].optionValues[0].name).toBe('Extra Small');
    expect(reported()[0].optionValues[1].name).toBe('Large');
  });

  it('changes a value’s price without disturbing the others', () => {
    renderSection([size()]);

    const priceInputs = Array.from(
      document.querySelectorAll('input[type="number"]')
    ) as HTMLInputElement[];
    const smallPrice = priceInputs.find((i) => i.value === '25')!;
    fireEvent.change(smallPrice, { target: { value: '26' } });

    expect(onChange).toHaveBeenCalled();
    expect(reported()[0].optionValues[1].price).toBe(28);
  });

  it('removes a value from the right type', () => {
    renderSection([size(), colour()]);

    const before = deleteButtons().length;
    // Delete controls belong to both types and their values; the value rows of
    // the first type sit between the two type headers.
    fireEvent.click(deleteButtons()[1]);

    expect(before).toBeGreaterThan(2);
    expect(reported()[0].optionValues.length + reported()[1].optionValues.length).toBe(2);
  });

  it('edits values in one type without leaking into another', () => {
    renderSection([size(), colour()]);

    fireEvent.change(screen.getByDisplayValue('Navy'), { target: { value: 'Racing Green' } });

    expect(reported()[1].optionValues[0].name).toBe('Racing Green');
    expect(reported()[0].optionValues.map((v) => v.name)).toEqual(['Small', 'Large']);
  });
});

describe('OptionsConfigurationSection — stock tracking', () => {
  it('asks for stock levels only when the club tracks stock', () => {
    const { unmount } = renderSection([size()], false);
    const withoutTracking = document.querySelectorAll('input').length;
    unmount();

    renderSection([size()], true);
    const withTracking = document.querySelectorAll('input').length;

    // A shop that does not count stock should not be asked to.
    expect(withTracking).toBeGreaterThan(withoutTracking);
  });
});

describe('OptionsConfigurationSection — with nothing configured', () => {
  it('still offers a way to add the first option type', () => {
    renderSection([]);

    expect(buttonsMatching(/add/i).length).toBeGreaterThan(0);
  });

  it('reports nothing until something is done', () => {
    renderSection([]);

    expect(onChange).not.toHaveBeenCalled();
  });
});
