/**
 * Unit Tests for CreateCustomFilterDialog
 *
 * Feature: registrations-module
 * Tests: form renders all filter criteria, validation errors, save creates filter
 *
 * Requirements: 3.5
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Mock setup (MUST be before component imports) ──

vi.mock('date-fns', () => ({}));
vi.mock('date-fns/locale', () => ({ enGB: {} }));

vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: ({ label, value, onChange }: any) => (
    <div data-testid={`date-picker-${label}`}>
      <input
        data-testid={`date-input-${label}`}
        value={value ? value.toISOString() : ''}
        onChange={(e: any) => {
          const d = e.target.value ? new Date(e.target.value) : null;
          onChange?.(d);
        }}
      />
    </div>
  ),
}));

vi.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('@mui/x-date-pickers/AdapterDateFns', () => ({
  AdapterDateFns: class {},
}));

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

import CreateCustomFilterDialog from '../CreateCustomFilterDialog';

// ── Helpers ──

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
};

// ── Tests ──

describe('CreateCustomFilterDialog - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Requirement 3.5: Form renders all filter criteria
   */
  describe('Form renders all filter criteria', () => {
    it('renders filter name input', () => {
      render(<CreateCustomFilterDialog {...defaultProps} />);
      expect(screen.getByTestId('filter-name-input')).toBeTruthy();
    });

    it('renders status multi-select', () => {
      render(<CreateCustomFilterDialog {...defaultProps} />);
      expect(screen.getByTestId('status-select')).toBeTruthy();
    });

    it('renders registration types multi-select', () => {
      render(<CreateCustomFilterDialog {...defaultProps} />);
      expect(screen.getByTestId('types-select')).toBeTruthy();
    });

    it('renders label input with add button', () => {
      render(<CreateCustomFilterDialog {...defaultProps} />);
      expect(screen.getByTestId('label-input')).toBeTruthy();
      expect(screen.getByTestId('add-label-button')).toBeTruthy();
    });

    it('renders four date pickers (renewed after/before, valid until after/before)', () => {
      render(<CreateCustomFilterDialog {...defaultProps} />);
      const datePickers = screen.getAllByTestId(/^date-picker-/);
      expect(datePickers.length).toBe(4);
    });

    it('renders save and cancel buttons', () => {
      render(<CreateCustomFilterDialog {...defaultProps} />);
      expect(screen.getByTestId('save-button')).toBeTruthy();
      expect(screen.getByTestId('cancel-button')).toBeTruthy();
    });

    it('does not render dialog content when open is false', () => {
      render(<CreateCustomFilterDialog {...defaultProps} open={false} />);
      expect(screen.queryByTestId('filter-name-input')).toBeNull();
    });
  });

  /**
   * Requirement 3.5: Validation errors
   */
  describe('Validation errors', () => {
    it('shows error when filter name is empty', () => {
      render(<CreateCustomFilterDialog {...defaultProps} />);

      fireEvent.click(screen.getByTestId('save-button'));

      expect(screen.getByRole('alert').textContent).toContain(
        'registrations.filters.validation.nameRequired',
      );
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('shows error when name is provided but no criteria selected', () => {
      render(<CreateCustomFilterDialog {...defaultProps} />);

      const nameInput = screen.getByTestId('filter-name-input').querySelector('input')!;
      fireEvent.change(nameInput, { target: { value: 'My Filter' } });

      fireEvent.click(screen.getByTestId('save-button'));

      expect(screen.getByRole('alert').textContent).toContain(
        'registrations.filters.validation.criteriaRequired',
      );
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('shows error when renewed after date is later than before date', () => {
      render(<CreateCustomFilterDialog {...defaultProps} />);

      const nameInput = screen.getByTestId('filter-name-input').querySelector('input')!;
      fireEvent.change(nameInput, { target: { value: 'Date Filter' } });

      // Set after date later than before date
      const afterInput = screen.getAllByTestId(/^date-input-/)[0];
      const beforeInput = screen.getAllByTestId(/^date-input-/)[1];
      fireEvent.change(afterInput, { target: { value: '2025-12-01T00:00:00.000Z' } });
      fireEvent.change(beforeInput, { target: { value: '2025-01-01T00:00:00.000Z' } });

      fireEvent.click(screen.getByTestId('save-button'));

      expect(screen.getByRole('alert').textContent).toContain(
        'registrations.filters.validation.dateRangeInvalid',
      );
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('shows error when valid until after date is later than before date', () => {
      render(<CreateCustomFilterDialog {...defaultProps} />);

      const nameInput = screen.getByTestId('filter-name-input').querySelector('input')!;
      fireEvent.change(nameInput, { target: { value: 'Valid Until Filter' } });

      // Set valid until after > before
      const afterInput = screen.getAllByTestId(/^date-input-/)[2];
      const beforeInput = screen.getAllByTestId(/^date-input-/)[3];
      fireEvent.change(afterInput, { target: { value: '2025-12-01T00:00:00.000Z' } });
      fireEvent.change(beforeInput, { target: { value: '2025-01-01T00:00:00.000Z' } });

      fireEvent.click(screen.getByTestId('save-button'));

      expect(screen.getByRole('alert').textContent).toContain(
        'registrations.filters.validation.dateRangeInvalid',
      );
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });
  });

  /**
   * Requirement 3.5: Save creates filter
   */
  describe('Save creates filter', () => {
    it('calls onSave with filter data when name and labels are provided', () => {
      render(<CreateCustomFilterDialog {...defaultProps} />);

      // Set filter name
      const nameInput = screen.getByTestId('filter-name-input').querySelector('input')!;
      fireEvent.change(nameInput, { target: { value: 'VIP Filter' } });

      // Add a label as criterion
      const labelInput = screen.getByTestId('label-input').querySelector('input')!;
      fireEvent.change(labelInput, { target: { value: 'VIP' } });
      fireEvent.click(screen.getByTestId('add-label-button'));

      // Save
      fireEvent.click(screen.getByTestId('save-button'));

      expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
      const savedFilter = defaultProps.onSave.mock.calls[0][0];
      expect(savedFilter.name).toBe('VIP Filter');
      expect(savedFilter.registrationLabels).toEqual(['VIP']);
    });

    it('calls onSave with date range criteria', () => {
      render(<CreateCustomFilterDialog {...defaultProps} />);

      const nameInput = screen.getByTestId('filter-name-input').querySelector('input')!;
      fireEvent.change(nameInput, { target: { value: 'Date Range Filter' } });

      // Set a valid date range (after < before)
      const dateInputs = screen.getAllByTestId(/^date-input-/);
      fireEvent.change(dateInputs[0], { target: { value: '2025-01-01T00:00:00.000Z' } });
      fireEvent.change(dateInputs[1], { target: { value: '2025-12-01T00:00:00.000Z' } });

      fireEvent.click(screen.getByTestId('save-button'));

      expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
      const savedFilter = defaultProps.onSave.mock.calls[0][0];
      expect(savedFilter.name).toBe('Date Range Filter');
      expect(savedFilter.dateLastRenewedAfter).toBeInstanceOf(Date);
      expect(savedFilter.dateLastRenewedBefore).toBeInstanceOf(Date);
    });

    it('resets form after successful save', () => {
      render(<CreateCustomFilterDialog {...defaultProps} />);

      const nameInput = screen.getByTestId('filter-name-input').querySelector('input')!;
      fireEvent.change(nameInput, { target: { value: 'Temp Filter' } });

      const labelInput = screen.getByTestId('label-input').querySelector('input')!;
      fireEvent.change(labelInput, { target: { value: 'Tag' } });
      fireEvent.click(screen.getByTestId('add-label-button'));

      fireEvent.click(screen.getByTestId('save-button'));

      // After save, form should be reset
      expect(nameInput.value).toBe('');
    });

    it('resets form and calls onClose when cancel is clicked', () => {
      render(<CreateCustomFilterDialog {...defaultProps} />);

      const nameInput = screen.getByTestId('filter-name-input').querySelector('input')!;
      fireEvent.change(nameInput, { target: { value: 'Will Cancel' } });

      fireEvent.click(screen.getByTestId('cancel-button'));

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });
  });

  /**
   * Label chip management
   */
  describe('Label management', () => {
    it('adds labels as chips when add button is clicked', () => {
      render(<CreateCustomFilterDialog {...defaultProps} />);

      const labelInput = screen.getByTestId('label-input').querySelector('input')!;
      fireEvent.change(labelInput, { target: { value: 'VIP' } });
      fireEvent.click(screen.getByTestId('add-label-button'));

      expect(screen.getByText('VIP')).toBeTruthy();
    });

    it('adds labels on Enter key press', () => {
      render(<CreateCustomFilterDialog {...defaultProps} />);

      const labelInput = screen.getByTestId('label-input').querySelector('input')!;
      fireEvent.change(labelInput, { target: { value: 'Priority' } });
      fireEvent.keyPress(labelInput, { key: 'Enter', charCode: 13 });

      expect(screen.getByText('Priority')).toBeTruthy();
    });

    it('does not add duplicate labels', () => {
      render(<CreateCustomFilterDialog {...defaultProps} />);

      const labelInput = screen.getByTestId('label-input').querySelector('input')!;
      const addBtn = screen.getByTestId('add-label-button');

      fireEvent.change(labelInput, { target: { value: 'VIP' } });
      fireEvent.click(addBtn);
      fireEvent.change(labelInput, { target: { value: 'VIP' } });
      fireEvent.click(addBtn);

      const chips = screen.getAllByText('VIP');
      expect(chips.length).toBe(1);
    });
  });
});
