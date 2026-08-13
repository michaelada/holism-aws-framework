import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MultiSelectRenderer } from '../renderers/MultiSelectRenderer';
import { FieldDatatype } from '../../../types';
import type { FieldDefinition } from '../../../types';

const field = (displayMode?: string): FieldDefinition => ({
  shortName: 'dietary',
  displayName: 'Dietary needs',
  description: '',
  datatype: FieldDatatype.MULTI_SELECT,
  datatypeProperties: {
    options: [
      { value: 'veg', label: 'Vegetarian' },
      { value: 'gf', label: 'Gluten free' },
      { value: 'df', label: 'Dairy free' },
    ],
    ...(displayMode ? { displayMode } : {}),
  },
});

/**
 * Two presentations of one control. The dropdown suits a long option list; the
 * row of checkboxes suits the handful a club usually writes, where making the
 * member open something to see three choices is a click for nothing.
 */
describe('MultiSelectRenderer', () => {
  describe('checkbox display mode', () => {
    it('lays the choices out as checkboxes, all visible without opening anything', () => {
      render(
        <MultiSelectRenderer fieldDefinition={field('checkbox')} value={[]} onChange={vi.fn()} />
      );

      expect(screen.getAllByRole('checkbox')).toHaveLength(3);
      expect(screen.getByRole('checkbox', { name: 'Vegetarian' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Gluten free' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Dairy free' })).toBeInTheDocument();

      // And not the dropdown it used to be.
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('lays them out in a row', () => {
      const { container } = render(
        <MultiSelectRenderer fieldDefinition={field('checkbox')} value={[]} onChange={vi.fn()} />
      );

      const group = container.querySelector('.MuiFormGroup-root');
      expect(group).toBeTruthy();
      expect(group).toHaveClass('MuiFormGroup-row');
    });

    it('names the group so the field is announced, not just drawn', () => {
      render(
        <MultiSelectRenderer fieldDefinition={field('checkbox')} value={[]} onChange={vi.fn()} required />
      );

      const group = screen.getByRole('group', { name: /Dietary needs/ });
      expect(within(group).getAllByRole('checkbox')).toHaveLength(3);
    });

    it('shows which choices are already made', () => {
      render(
        <MultiSelectRenderer fieldDefinition={field('checkbox')} value={['veg', 'df']} onChange={vi.fn()} />
      );

      expect(screen.getByRole('checkbox', { name: 'Vegetarian' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Dairy free' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Gluten free' })).not.toBeChecked();
    });

    it('adds a ticked choice to the answer', () => {
      const onChange = vi.fn();
      render(
        <MultiSelectRenderer fieldDefinition={field('checkbox')} value={['veg']} onChange={onChange} />
      );

      fireEvent.click(screen.getByRole('checkbox', { name: 'Dairy free' }));

      expect(onChange).toHaveBeenCalledWith(['veg', 'df']);
    });

    it('removes an un-ticked choice and leaves the rest alone', () => {
      const onChange = vi.fn();
      render(
        <MultiSelectRenderer
          fieldDefinition={field('checkbox')}
          value={['veg', 'gf', 'df']}
          onChange={onChange}
        />
      );

      fireEvent.click(screen.getByRole('checkbox', { name: 'Gluten free' }));

      expect(onChange).toHaveBeenCalledWith(['veg', 'df']);
    });

    it('starts from empty when the value is not an array', () => {
      const onChange = vi.fn();
      render(<MultiSelectRenderer fieldDefinition={field('checkbox')} value={''} onChange={onChange} />);

      expect(screen.getAllByRole('checkbox').every((box) => !(box as HTMLInputElement).checked)).toBe(
        true
      );

      fireEvent.click(screen.getByRole('checkbox', { name: 'Vegetarian' }));
      expect(onChange).toHaveBeenCalledWith(['veg']);
    });

    it('disables every choice when the field is disabled', () => {
      render(
        <MultiSelectRenderer fieldDefinition={field('checkbox')} value={[]} onChange={vi.fn()} disabled />
      );

      for (const box of screen.getAllByRole('checkbox')) {
        expect(box).toBeDisabled();
      }
    });

    it('shows the error in place of the description', () => {
      render(
        <MultiSelectRenderer
          fieldDefinition={{
            ...field('checkbox'),
            description: 'Tell us about allergies',
          }}
          value={[]}
          onChange={vi.fn()}
          error="Pick at least one"
        />
      );

      expect(screen.getByText('Pick at least one')).toBeInTheDocument();
      expect(screen.queryByText('Tell us about allergies')).not.toBeInTheDocument();
    });
  });

  describe('dropdown display mode', () => {
    it('is still the default for a long option list', () => {
      render(<MultiSelectRenderer fieldDefinition={field()} value={[]} onChange={vi.fn()} />);

      expect(screen.getByRole('combobox', { name: /Dietary needs/ })).toBeInTheDocument();
      // The choices are behind it, not on the page.
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('offers the choices as checkboxes once opened', () => {
      render(<MultiSelectRenderer fieldDefinition={field()} value={['veg']} onChange={vi.fn()} />);

      // MUI opens on mouseDown, not click (CLAUDE.md §3.4).
      fireEvent.mouseDown(screen.getByRole('combobox', { name: /Dietary needs/ }));

      const options = within(screen.getByRole('listbox')).getAllByRole('option');
      expect(options.map((option) => option.textContent)).toEqual([
        'Vegetarian',
        'Gluten free',
        'Dairy free',
      ]);
    });
  });
});
