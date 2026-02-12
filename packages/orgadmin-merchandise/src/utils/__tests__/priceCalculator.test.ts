/**
 * Price Calculator Utility Tests
 */

import { describe, it, expect } from 'vitest';
import {
  calculateUnitPrice,
  calculateDeliveryFee,
  validateQuantity,
  calculatePrice,
  validateDeliveryRules,
  getValidOrderQuantities,
  formatPrice,
} from '../priceCalculator';
import type { MerchandiseType, DeliveryRule } from '../../types/merchandise.types';

describe('priceCalculator', () => {
  const mockMerchandiseType: MerchandiseType = {
    id: '1',
    organisationId: 'org1',
    name: 'Test Product',
    description: 'Test Description',
    images: [],
    status: 'active',
    optionTypes: [
      {
        id: 'opt1',
        merchandiseTypeId: '1',
        name: 'Size',
        order: 1,
        optionValues: [
          { id: 'val1', optionTypeId: 'opt1', name: 'Small', price: 10, order: 1, createdAt: new Date(), updatedAt: new Date() },
          { id: 'val2', optionTypeId: 'opt1', name: 'Large', price: 15, order: 2, createdAt: new Date(), updatedAt: new Date() },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    trackStockLevels: false,
    deliveryType: 'free',
    requireApplicationForm: false,
    supportedPaymentMethods: [],
    useTermsAndConditions: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('calculateUnitPrice', () => {
    it('should calculate unit price based on selected options', () => {
      const selectedOptions = { opt1: 'val1' };
      const price = calculateUnitPrice(mockMerchandiseType, selectedOptions);
      expect(price).toBe(10);
    });

    it('should return 0 for no selected options', () => {
      const price = calculateUnitPrice(mockMerchandiseType, {});
      expect(price).toBe(0);
    });
  });

  describe('calculateDeliveryFee', () => {
    it('should return 0 for free delivery', () => {
      const fee = calculateDeliveryFee(mockMerchandiseType, 5);
      expect(fee).toBe(0);
    });

    it('should return fixed fee for fixed delivery', () => {
      const typeWithFixed = { ...mockMerchandiseType, deliveryType: 'fixed' as const, deliveryFee: 5 };
      const fee = calculateDeliveryFee(typeWithFixed, 10);
      expect(fee).toBe(5);
    });

    it('should calculate quantity-based delivery fee', () => {
      const rules: DeliveryRule[] = [
        { id: '1', merchandiseTypeId: '1', minQuantity: 1, maxQuantity: 5, deliveryFee: 5, order: 1 },
        { id: '2', merchandiseTypeId: '1', minQuantity: 6, maxQuantity: 10, deliveryFee: 8, order: 2 },
      ];
      const typeWithRules = { ...mockMerchandiseType, deliveryType: 'quantity_based' as const, deliveryRules: rules };
      
      expect(calculateDeliveryFee(typeWithRules, 3)).toBe(5);
      expect(calculateDeliveryFee(typeWithRules, 7)).toBe(8);
    });
  });

  describe('validateQuantity', () => {
    it('should validate minimum quantity', () => {
      const typeWithMin = { ...mockMerchandiseType, minOrderQuantity: 5 };
      const result = validateQuantity(typeWithMin, 3);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Minimum order quantity is 5');
    });

    it('should validate maximum quantity', () => {
      const typeWithMax = { ...mockMerchandiseType, maxOrderQuantity: 10 };
      const result = validateQuantity(typeWithMax, 15);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Maximum order quantity is 10');
    });

    it('should validate quantity increments', () => {
      const typeWithIncrements = { ...mockMerchandiseType, quantityIncrements: 6 };
      const result = validateQuantity(typeWithIncrements, 7);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Quantity must be in multiples of 6');
    });

    it('should pass validation for valid quantity', () => {
      const result = validateQuantity(mockMerchandiseType, 5);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('calculatePrice', () => {
    it('should calculate complete price breakdown', () => {
      const selectedOptions = { opt1: 'val1' };
      const result = calculatePrice(mockMerchandiseType, selectedOptions, 2);
      
      expect(result.isValid).toBe(true);
      expect(result.unitPrice).toBe(10);
      expect(result.subtotal).toBe(20);
      expect(result.deliveryFee).toBe(0);
      expect(result.totalPrice).toBe(20);
    });

    it('should return invalid for invalid quantity', () => {
      const typeWithMin = { ...mockMerchandiseType, minOrderQuantity: 5 };
      const result = calculatePrice(typeWithMin, {}, 2);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('validateDeliveryRules', () => {
    it('should detect overlapping rules', () => {
      const rules: DeliveryRule[] = [
        { id: '1', merchandiseTypeId: '1', minQuantity: 1, maxQuantity: 10, deliveryFee: 5, order: 1 },
        { id: '2', merchandiseTypeId: '1', minQuantity: 8, maxQuantity: 15, deliveryFee: 8, order: 2 },
      ];
      const result = validateDeliveryRules(rules);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should pass validation for non-overlapping rules', () => {
      const rules: DeliveryRule[] = [
        { id: '1', merchandiseTypeId: '1', minQuantity: 1, maxQuantity: 5, deliveryFee: 5, order: 1 },
        { id: '2', merchandiseTypeId: '1', minQuantity: 6, maxQuantity: 10, deliveryFee: 8, order: 2 },
      ];
      const result = validateDeliveryRules(rules);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getValidOrderQuantities', () => {
    it('should generate valid quantities based on rules', () => {
      const typeWithRules = {
        ...mockMerchandiseType,
        minOrderQuantity: 2,
        maxOrderQuantity: 10,
        quantityIncrements: 2,
      };
      const quantities = getValidOrderQuantities(typeWithRules, 10);
      expect(quantities).toEqual([2, 4, 6, 8, 10]);
    });
  });

  describe('formatPrice', () => {
    it('should format price with currency symbol', () => {
      expect(formatPrice(10.5)).toBe('€10.50');
      expect(formatPrice(10.5, '$')).toBe('$10.50');
    });
  });
});
