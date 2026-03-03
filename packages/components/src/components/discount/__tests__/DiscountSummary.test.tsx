/**
 * Unit Tests for DiscountSummary Component
 * Tests rendering with no discounts, single discount, multiple discounts, and price calculations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DiscountSummary, DiscountSummaryProps } from '../DiscountSummary';

describe('DiscountSummary', () => {
  beforeEach(() => {
    cleanup();
  });

  const createMockDiscounts = () => [
    {
      id: 'discount-1',
      name: 'Summer Sale',
      discountType: 'percentage' as const,
      discountValue: 20,
    },
    {
      id: 'discount-2',
      name: 'Fixed Discount',
      discountType: 'fixed' as const,
      discountValue: 10,
    },
  ];

  describe('Rendering with no discounts', () => {
    it('should not render when no discounts are applied', () => {
      const { container } = render(
        <DiscountSummary
          discounts={[]}
          originalAmount={100}
          finalAmount={100}
          appliedDiscounts={[]}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should not render when appliedDiscounts array is empty', () => {
      const discounts = createMockDiscounts();
      const { container } = render(
        <DiscountSummary
          discounts={discounts}
          originalAmount={100}
          finalAmount={100}
          appliedDiscounts={[]}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Rendering with single discount', () => {
    it('should render with a single percentage discount', () => {
      const discounts = createMockDiscounts();
      const appliedDiscounts = [
        {
          discountId: 'discount-1',
          discountName: 'Summer Sale',
          discountAmount: 20,
        },
      ];

      render(
        <DiscountSummary
          discounts={discounts}
          originalAmount={100}
          finalAmount={80}
          appliedDiscounts={appliedDiscounts}
        />
      );

      expect(screen.getByText('Discounts Applied')).toBeTruthy();
      expect(screen.getByText('Summer Sale')).toBeTruthy();
      expect(screen.getByText('20%')).toBeTruthy();
      expect(screen.getByText('Original Price:')).toBeTruthy();
      expect(screen.getByText('$100.00')).toBeTruthy();
      expect(screen.getAllByText(/\$20\.00/).length).toBeGreaterThan(0);
      expect(screen.getByText('Final Price:')).toBeTruthy();
      expect(screen.getByText('$80.00')).toBeTruthy();
    });

    it('should render with a single fixed discount', () => {
      const discounts = createMockDiscounts();
      const appliedDiscounts = [
        {
          discountId: 'discount-2',
          discountName: 'Fixed Discount',
          discountAmount: 10,
        },
      ];

      render(
        <DiscountSummary
          discounts={discounts}
          originalAmount={100}
          finalAmount={90}
          appliedDiscounts={appliedDiscounts}
        />
      );

      expect(screen.getByText('Fixed Discount')).toBeTruthy();
      expect(screen.getByText('$10.00')).toBeTruthy();
      expect(screen.getAllByText(/\$10\.00/).length).toBeGreaterThan(0);
      expect(screen.getByText('$90.00')).toBeTruthy();
    });

    it('should display savings percentage for single discount', () => {
      const discounts = createMockDiscounts();
      const appliedDiscounts = [
        {
          discountId: 'discount-1',
          discountName: 'Summer Sale',
          discountAmount: 20,
        },
      ];

      render(
        <DiscountSummary
          discounts={discounts}
          originalAmount={100}
          finalAmount={80}
          appliedDiscounts={appliedDiscounts}
        />
      );

      expect(screen.getByText('You save 20.0%!')).toBeTruthy();
    });
  });

  describe('Rendering with multiple discounts', () => {
    it('should render multiple applied discounts', () => {
      const discounts = createMockDiscounts();
      const appliedDiscounts = [
        {
          discountId: 'discount-1',
          discountName: 'Summer Sale',
          discountAmount: 20,
        },
        {
          discountId: 'discount-2',
          discountName: 'Fixed Discount',
          discountAmount: 10,
        },
      ];

      render(
        <DiscountSummary
          discounts={discounts}
          originalAmount={100}
          finalAmount={70}
          appliedDiscounts={appliedDiscounts}
        />
      );

      expect(screen.getByText('Summer Sale')).toBeTruthy();
      expect(screen.getByText('Fixed Discount')).toBeTruthy();
      expect(screen.getByText('-$20.00')).toBeTruthy();
      expect(screen.getByText('-$10.00')).toBeTruthy();
    });

    it('should display total discount for multiple discounts', () => {
      const discounts = createMockDiscounts();
      const appliedDiscounts = [
        {
          discountId: 'discount-1',
          discountName: 'Summer Sale',
          discountAmount: 20,
        },
        {
          discountId: 'discount-2',
          discountName: 'Fixed Discount',
          discountAmount: 10,
        },
      ];

      render(
        <DiscountSummary
          discounts={discounts}
          originalAmount={100}
          finalAmount={70}
          appliedDiscounts={appliedDiscounts}
        />
      );

      expect(screen.getByText('Total Discount:')).toBeTruthy();
      expect(screen.getByText('-$30.00')).toBeTruthy();
    });

    it('should calculate correct savings percentage for multiple discounts', () => {
      const discounts = createMockDiscounts();
      const appliedDiscounts = [
        {
          discountId: 'discount-1',
          discountName: 'Summer Sale',
          discountAmount: 20,
        },
        {
          discountId: 'discount-2',
          discountName: 'Fixed Discount',
          discountAmount: 10,
        },
      ];

      render(
        <DiscountSummary
          discounts={discounts}
          originalAmount={100}
          finalAmount={70}
          appliedDiscounts={appliedDiscounts}
        />
      );

      expect(screen.getByText('You save 30.0%!')).toBeTruthy();
    });

    it('should render each discount with its chip badge', () => {
      const discounts = createMockDiscounts();
      const appliedDiscounts = [
        {
          discountId: 'discount-1',
          discountName: 'Summer Sale',
          discountAmount: 20,
        },
        {
          discountId: 'discount-2',
          discountName: 'Fixed Discount',
          discountAmount: 10,
        },
      ];

      const { container } = render(
        <DiscountSummary
          discounts={discounts}
          originalAmount={100}
          finalAmount={70}
          appliedDiscounts={appliedDiscounts}
        />
      );

      // Check for percentage chip
      expect(screen.getByText('20%')).toBeTruthy();
      
      // Check for fixed amount chip
      expect(screen.getByText('$10.00')).toBeTruthy();
      
      // Verify chips are rendered
      const chips = container.querySelectorAll('.MuiChip-root');
      expect(chips.length).toBeGreaterThanOrEqual(2); // At least 2 discount chips (plus savings chip)
    });
  });

  describe('Price calculations display', () => {
    it('should display original amount correctly', () => {
      const discounts = createMockDiscounts();
      const appliedDiscounts = [
        {
          discountId: 'discount-1',
          discountName: 'Summer Sale',
          discountAmount: 25.50,
        },
      ];

      render(
        <DiscountSummary
          discounts={discounts}
          originalAmount={127.50}
          finalAmount={102.00}
          appliedDiscounts={appliedDiscounts}
        />
      );

      expect(screen.getByText('$127.50')).toBeTruthy();
    });

    it('should display discount amounts with correct formatting', () => {
      const discounts = createMockDiscounts();
      const appliedDiscounts = [
        {
          discountId: 'discount-1',
          discountName: 'Summer Sale',
          discountAmount: 25.50,
        },
      ];

      render(
        <DiscountSummary
          discounts={discounts}
          originalAmount={127.50}
          finalAmount={102.00}
          appliedDiscounts={appliedDiscounts}
        />
      );

      expect(screen.getAllByText(/\$25\.50/).length).toBeGreaterThan(0);
    });

    it('should display final amount correctly', () => {
      const discounts = createMockDiscounts();
      const appliedDiscounts = [
        {
          discountId: 'discount-1',
          discountName: 'Summer Sale',
          discountAmount: 25.50,
        },
      ];

      render(
        <DiscountSummary
          discounts={discounts}
          originalAmount={127.50}
          finalAmount={102.00}
          appliedDiscounts={appliedDiscounts}
        />
      );

      expect(screen.getByText('$102.00')).toBeTruthy();
    });

    it('should calculate total discount correctly', () => {
      const discounts = createMockDiscounts();
      const appliedDiscounts = [
        {
          discountId: 'discount-1',
          discountName: 'Summer Sale',
          discountAmount: 15.75,
        },
        {
          discountId: 'discount-2',
          discountName: 'Fixed Discount',
          discountAmount: 10.25,
        },
      ];

      render(
        <DiscountSummary
          discounts={discounts}
          originalAmount={100}
          finalAmount={74}
          appliedDiscounts={appliedDiscounts}
        />
      );

      // Total discount = 100 - 74 = 26
      expect(screen.getByText('-$26.00')).toBeTruthy();
    });

    it('should format amounts to 2 decimal places', () => {
      const discounts = createMockDiscounts();
      const appliedDiscounts = [
        {
          discountId: 'discount-1',
          discountName: 'Summer Sale',
          discountAmount: 33.333,
        },
      ];

      render(
        <DiscountSummary
          discounts={discounts}
          originalAmount={100}
          finalAmount={66.667}
          appliedDiscounts={appliedDiscounts}
        />
      );

      // Should round to 2 decimal places
      expect(screen.getByText('$100.00')).toBeTruthy();
      expect(screen.getAllByText(/\$33\.33/).length).toBeGreaterThan(0);
      expect(screen.getByText('$66.67')).toBeTruthy();
    });

    it('should handle zero discount amount', () => {
      const discounts = createMockDiscounts();
      const appliedDiscounts = [
        {
          discountId: 'discount-1',
          discountName: 'Summer Sale',
          discountAmount: 0,
        },
      ];

      render(
        <DiscountSummary
          discounts={discounts}
          originalAmount={100}
          finalAmount={100}
          appliedDiscounts={appliedDiscounts}
        />
      );

      expect(screen.getAllByText(/\$0\.00/).length).toBeGreaterThan(0);
      // Savings badge should not show when discount is 0
      expect(screen.queryByText(/You save/)).toBeNull();
    });

    it('should use custom currency symbol', () => {
      const discounts = createMockDiscounts();
      const appliedDiscounts = [
        {
          discountId: 'discount-1',
          discountName: 'Summer Sale',
          discountAmount: 20,
        },
      ];

      render(
        <DiscountSummary
          discounts={discounts}
          originalAmount={100}
          finalAmount={80}
          appliedDiscounts={appliedDiscounts}
          currency="€"
        />
      );

      expect(screen.getByText('€100.00')).toBeTruthy();
      expect(screen.getAllByText(/€20\.00/).length).toBeGreaterThan(0);
      expect(screen.getByText('€80.00')).toBeTruthy();
    });

    it('should hide savings percentage when showSavingsPercentage is false', () => {
      const discounts = createMockDiscounts();
      const appliedDiscounts = [
        {
          discountId: 'discount-1',
          discountName: 'Summer Sale',
          discountAmount: 20,
        },
      ];

      render(
        <DiscountSummary
          discounts={discounts}
          originalAmount={100}
          finalAmount={80}
          appliedDiscounts={appliedDiscounts}
          showSavingsPercentage={false}
        />
      );

      expect(screen.queryByText(/You save/)).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle discount without matching discount definition', () => {
      const discounts = createMockDiscounts();
      const appliedDiscounts = [
        {
          discountId: 'discount-999',
          discountName: 'Unknown Discount',
          discountAmount: 15,
        },
      ];

      render(
        <DiscountSummary
          discounts={discounts}
          originalAmount={100}
          finalAmount={85}
          appliedDiscounts={appliedDiscounts}
        />
      );

      // Should still render the discount name and amount
      expect(screen.getByText('Unknown Discount')).toBeTruthy();
      expect(screen.getAllByText(/\$15\.00/).length).toBeGreaterThan(0);
      // But no chip should be shown since discount definition is not found
    });

    it('should handle zero original amount', () => {
      const discounts = createMockDiscounts();
      const appliedDiscounts = [
        {
          discountId: 'discount-1',
          discountName: 'Summer Sale',
          discountAmount: 0,
        },
      ];

      render(
        <DiscountSummary
          discounts={discounts}
          originalAmount={0}
          finalAmount={0}
          appliedDiscounts={appliedDiscounts}
        />
      );

      expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
      // Savings badge should not show when discount is 0
      expect(screen.queryByText(/You save/)).toBeNull();
    });

    it('should handle large discount amounts', () => {
      const discounts = createMockDiscounts();
      const appliedDiscounts = [
        {
          discountId: 'discount-1',
          discountName: 'Huge Sale',
          discountAmount: 9999.99,
        },
      ];

      render(
        <DiscountSummary
          discounts={discounts}
          originalAmount={10000}
          finalAmount={0.01}
          appliedDiscounts={appliedDiscounts}
        />
      );

      expect(screen.getByText('$10000.00')).toBeTruthy();
      expect(screen.getAllByText(/\$9999\.99/).length).toBeGreaterThan(0);
      expect(screen.getByText('$0.01')).toBeTruthy();
    });
  });
});
