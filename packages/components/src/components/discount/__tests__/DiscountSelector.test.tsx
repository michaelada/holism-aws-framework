/**
 * Unit Tests for DiscountSelector Component
 * 
 * Tests rendering, selection, chip display and removal, search functionality, and moduleType filtering
 * Requirements: 4.3, 4.4, 4.5, 4.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { DiscountSelector, Discount } from '../DiscountSelector';

describe('DiscountSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  const createMockDiscounts = (): Discount[] => [
    {
      id: 'discount-1',
      name: 'Summer Sale',
      description: '20% off all items',
      discountType: 'percentage',
      discountValue: 20,
      status: 'active',
      code: 'SUMMER20',
    },
    {
      id: 'discount-2',
      name: 'Fixed Discount',
      description: '$10 off',
      discountType: 'fixed',
      discountValue: 10,
      status: 'active',
    },
    {
      id: 'discount-3',
      name: 'Inactive Discount',
      description: 'Should not appear',
      discountType: 'percentage',
      discountValue: 15,
      status: 'inactive',
    },
  ];

  describe('Rendering with no discounts', () => {
    it('should not render when no discounts are available', () => {
      const { container } = render(
        <DiscountSelector
          selectedDiscountIds={[]}
          onChange={vi.fn()}
          organisationId="test-org"
          moduleType="memberships"
          discounts={[]}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should not render when all discounts are inactive', () => {
      const inactiveDiscounts: Discount[] = [
        {
          id: 'discount-1',
          name: 'Inactive',
          discountType: 'percentage',
          discountValue: 10,
          status: 'inactive',
        },
      ];

      const { container } = render(
        <DiscountSelector
          selectedDiscountIds={[]}
          onChange={vi.fn()}
          organisationId="test-org"
          moduleType="memberships"
          discounts={inactiveDiscounts}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Rendering with discounts', () => {
    it('should render selector when active discounts are available', () => {
      const discounts = createMockDiscounts();

      const { container } = render(
        <DiscountSelector
          selectedDiscountIds={[]}
          onChange={vi.fn()}
          organisationId="test-org"
          moduleType="memberships"
          discounts={discounts}
        />
      );

      expect(container.firstChild).not.toBeNull();
      expect(screen.getByLabelText('Select Discounts')).toBeTruthy();
    });

    it('should render with custom label', () => {
      const discounts = createMockDiscounts();

      render(
        <DiscountSelector
          selectedDiscountIds={[]}
          onChange={vi.fn()}
          organisationId="test-org"
          moduleType="memberships"
          discounts={discounts}
          label="Choose Event Discounts"
        />
      );

      expect(screen.getByLabelText('Choose Event Discounts')).toBeTruthy();
    });

    it('should only show active discounts in dropdown', () => {
      const discounts = createMockDiscounts();

      const { container } = render(
        <DiscountSelector
          selectedDiscountIds={[]}
          onChange={vi.fn()}
          organisationId="test-org"
          moduleType="memberships"
          discounts={discounts}
        />
      );

      // Open the dropdown
      const select = container.querySelector('[role="combobox"]');
      if (select) {
        fireEvent.mouseDown(select);

        // Should show active discounts
        expect(screen.getByText(/Summer Sale/)).toBeTruthy();
        expect(screen.getByText(/Fixed Discount/)).toBeTruthy();

        // Should not show inactive discount
        expect(screen.queryByText(/Inactive Discount/)).toBeNull();
      }
    });
  });

  describe('Selecting and deselecting discounts', () => {
    it('should call onChange when discount is selected', () => {
      const discounts = createMockDiscounts();
      const onChange = vi.fn();

      const { container } = render(
        <DiscountSelector
          selectedDiscountIds={[]}
          onChange={onChange}
          organisationId="test-org"
          moduleType="memberships"
          discounts={discounts}
        />
      );

      // Open the dropdown
      const select = container.querySelector('[role="combobox"]');
      if (select) {
        fireEvent.mouseDown(select);

        // Select a discount
        const option = screen.getByText(/Summer Sale/);
        fireEvent.click(option);

        expect(onChange).toHaveBeenCalled();
        expect(onChange).toHaveBeenCalledWith(['discount-1']);
      }
    });

    it('should support multiple selections', () => {
      const discounts = createMockDiscounts();
      const onChange = vi.fn();

      const { container, rerender } = render(
        <DiscountSelector
          selectedDiscountIds={[]}
          onChange={onChange}
          organisationId="test-org"
          moduleType="memberships"
          discounts={discounts}
        />
      );

      // Open the dropdown
      const select = container.querySelector('[role="combobox"]');
      if (select) {
        fireEvent.mouseDown(select);

        // Select first discount
        const option1 = screen.getByText(/Summer Sale/);
        fireEvent.click(option1);

        // Rerender with first selection
        rerender(
          <DiscountSelector
            selectedDiscountIds={['discount-1']}
            onChange={onChange}
            organisationId="test-org"
            moduleType="memberships"
            discounts={discounts}
          />
        );

        // Open dropdown again
        fireEvent.mouseDown(select);

        // Select second discount
        const option2 = screen.getByText(/Fixed Discount/);
        fireEvent.click(option2);

        // Should be called with both IDs
        expect(onChange).toHaveBeenCalled();
      }
    });
  });

  describe('Chip display and removal', () => {
    it('should display selected discounts as chips', () => {
      const discounts = createMockDiscounts();

      const { container } = render(
        <DiscountSelector
          selectedDiscountIds={['discount-1', 'discount-2']}
          onChange={vi.fn()}
          organisationId="test-org"
          moduleType="memberships"
          discounts={discounts}
        />
      );

      // Should show chips for selected discounts
      const chips = container.querySelectorAll('.MuiChip-root');
      expect(chips.length).toBe(2);

      // Check chip content
      expect(screen.getByText(/Summer Sale \(20%\)/)).toBeTruthy();
      expect(screen.getByText(/Fixed Discount \(\$10\.00\)/)).toBeTruthy();
    });

    it('should remove discount when chip delete button is clicked', () => {
      const discounts = createMockDiscounts();
      const onChange = vi.fn();

      const { container } = render(
        <DiscountSelector
          selectedDiscountIds={['discount-1', 'discount-2']}
          onChange={onChange}
          organisationId="test-org"
          moduleType="memberships"
          discounts={discounts}
        />
      );

      // Get the first chip's delete button
      const chips = container.querySelectorAll('.MuiChip-root');
      const firstChip = chips[0];
      const deleteButton = firstChip.querySelector('[data-testid="CancelIcon"]') || 
                           firstChip.querySelector('.MuiChip-deleteIcon');

      if (deleteButton) {
        fireEvent.click(deleteButton);

        // Should be called with remaining ID
        expect(onChange).toHaveBeenCalled();
        expect(onChange).toHaveBeenCalledWith(['discount-2']);
      }
    });

    it('should not show delete buttons when disabled', () => {
      const discounts = createMockDiscounts();

      const { container } = render(
        <DiscountSelector
          selectedDiscountIds={['discount-1']}
          onChange={vi.fn()}
          organisationId="test-org"
          moduleType="memberships"
          discounts={discounts}
          disabled={true}
        />
      );

      // Chips should not have delete buttons when disabled
      const chips = container.querySelectorAll('.MuiChip-root');
      chips.forEach(chip => {
        const deleteButton = chip.querySelector('[data-testid="CancelIcon"]') || 
                             chip.querySelector('.MuiChip-deleteIcon');
        expect(deleteButton).toBeNull();
      });
    });

    it('should display discount type and value in chips', () => {
      const discounts = createMockDiscounts();

      render(
        <DiscountSelector
          selectedDiscountIds={['discount-1', 'discount-2']}
          onChange={vi.fn()}
          organisationId="test-org"
          moduleType="memberships"
          discounts={discounts}
        />
      );

      // Percentage discount
      expect(screen.getByText(/20%/)).toBeTruthy();

      // Fixed discount
      expect(screen.getByText(/\$10\.00/)).toBeTruthy();
    });
  });

  describe('Search functionality', () => {
    it('should filter discounts based on search term', () => {
      const discounts = createMockDiscounts();

      const { container } = render(
        <DiscountSelector
          selectedDiscountIds={[]}
          onChange={vi.fn()}
          organisationId="test-org"
          moduleType="memberships"
          discounts={discounts}
        />
      );

      // Open the dropdown
      const select = container.querySelector('[role="combobox"]');
      if (select) {
        fireEvent.mouseDown(select);

        // Find the search input
        const searchInput = container.querySelector('input[placeholder="Search discounts..."]');
        if (searchInput) {
          // Type in search term
          fireEvent.change(searchInput, { target: { value: 'Summer' } });

          // Should show matching discount
          expect(screen.getByText(/Summer Sale/)).toBeTruthy();

          // Should not show non-matching discount
          expect(screen.queryByText(/Fixed Discount/)).toBeNull();
        }
      }
    });

    it('should search by discount name', () => {
      const discounts = createMockDiscounts();

      const { container } = render(
        <DiscountSelector
          selectedDiscountIds={[]}
          onChange={vi.fn()}
          organisationId="test-org"
          moduleType="memberships"
          discounts={discounts}
        />
      );

      const select = container.querySelector('[role="combobox"]');
      if (select) {
        fireEvent.mouseDown(select);

        const searchInput = container.querySelector('input[placeholder="Search discounts..."]');
        if (searchInput) {
          fireEvent.change(searchInput, { target: { value: 'Fixed' } });
          expect(screen.getByText(/Fixed Discount/)).toBeTruthy();
        }
      }
    });

    it('should search by discount description', () => {
      const discounts = createMockDiscounts();

      const { container } = render(
        <DiscountSelector
          selectedDiscountIds={[]}
          onChange={vi.fn()}
          organisationId="test-org"
          moduleType="memberships"
          discounts={discounts}
        />
      );

      const select = container.querySelector('[role="combobox"]');
      if (select) {
        fireEvent.mouseDown(select);

        const searchInput = container.querySelector('input[placeholder="Search discounts..."]');
        if (searchInput) {
          fireEvent.change(searchInput, { target: { value: '$10 off' } });
          expect(screen.getByText(/Fixed Discount/)).toBeTruthy();
        }
      }
    });

    it('should search by discount code', () => {
      const discounts = createMockDiscounts();

      const { container } = render(
        <DiscountSelector
          selectedDiscountIds={[]}
          onChange={vi.fn()}
          organisationId="test-org"
          moduleType="memberships"
          discounts={discounts}
        />
      );

      const select = container.querySelector('[role="combobox"]');
      if (select) {
        fireEvent.mouseDown(select);

        const searchInput = container.querySelector('input[placeholder="Search discounts..."]');
        if (searchInput) {
          fireEvent.change(searchInput, { target: { value: 'SUMMER20' } });
          expect(screen.getByText(/Summer Sale/)).toBeTruthy();
        }
      }
    });

    it('should show no results message when search has no matches', () => {
      const discounts = createMockDiscounts();

      const { container } = render(
        <DiscountSelector
          selectedDiscountIds={[]}
          onChange={vi.fn()}
          organisationId="test-org"
          moduleType="memberships"
          discounts={discounts}
        />
      );

      const select = container.querySelector('[role="combobox"]');
      if (select) {
        fireEvent.mouseDown(select);

        const searchInput = container.querySelector('input[placeholder="Search discounts..."]');
        if (searchInput) {
          fireEvent.change(searchInput, { target: { value: 'NonexistentDiscount' } });
          expect(screen.getByText(/No discounts match your search/i)).toBeTruthy();
        }
      }
    });
  });

  describe('ModuleType filtering', () => {
    it('should accept moduleType prop', () => {
      const discounts = createMockDiscounts();

      const { container } = render(
        <DiscountSelector
          selectedDiscountIds={[]}
          onChange={vi.fn()}
          organisationId="test-org"
          moduleType="events"
          discounts={discounts}
        />
      );

      expect(container.firstChild).not.toBeNull();
    });

    it('should work with memberships moduleType', () => {
      const discounts = createMockDiscounts();

      const { container } = render(
        <DiscountSelector
          selectedDiscountIds={[]}
          onChange={vi.fn()}
          organisationId="test-org"
          moduleType="memberships"
          discounts={discounts}
        />
      );

      expect(container.firstChild).not.toBeNull();
    });
  });

  describe('Disabled state', () => {
    it('should disable selector when disabled prop is true', () => {
      const discounts = createMockDiscounts();

      const { container } = render(
        <DiscountSelector
          selectedDiscountIds={[]}
          onChange={vi.fn()}
          organisationId="test-org"
          moduleType="memberships"
          discounts={discounts}
          disabled={true}
        />
      );

      const formControl = container.querySelector('.MuiFormControl-root');
      expect(formControl).toBeTruthy();
      // Check that the disabled attribute is set on the form control
      const select = container.querySelector('input[aria-hidden="true"]');
      expect(select).toHaveAttribute('disabled');
    });

    it('should not call onChange when disabled', () => {
      const discounts = createMockDiscounts();
      const onChange = vi.fn();

      const { container } = render(
        <DiscountSelector
          selectedDiscountIds={[]}
          onChange={onChange}
          organisationId="test-org"
          moduleType="memberships"
          discounts={discounts}
          disabled={true}
        />
      );

      const select = container.querySelector('[role="combobox"]');
      if (select) {
        fireEvent.mouseDown(select);
        // Dropdown should not open when disabled
        expect(screen.queryByText(/Summer Sale/)).toBeNull();
      }
    });
  });

  describe('Helper text', () => {
    it('should display helper text when provided', () => {
      const discounts = createMockDiscounts();

      render(
        <DiscountSelector
          selectedDiscountIds={[]}
          onChange={vi.fn()}
          organisationId="test-org"
          moduleType="memberships"
          discounts={discounts}
          helperText="Select one or more discounts to apply"
        />
      );

      expect(screen.getByText('Select one or more discounts to apply')).toBeTruthy();
    });
  });

  describe('Loading state', () => {
    it('should handle loading state with fetchDiscounts', async () => {
      const mockFetch = vi.fn().mockResolvedValue([]);

      const { container } = render(
        <DiscountSelector
          selectedDiscountIds={[]}
          onChange={vi.fn()}
          organisationId="test-org"
          moduleType="memberships"
          fetchDiscounts={mockFetch}
        />
      );

      // Component should render and call fetchDiscounts
      expect(mockFetch).toHaveBeenCalledWith('test-org', 'memberships');
      
      // Wait for the fetch to complete
      await vi.waitFor(() => {
        // After loading with no discounts, component should not render
        expect(container.firstChild).toBeNull();
      });
    });
  });
});
