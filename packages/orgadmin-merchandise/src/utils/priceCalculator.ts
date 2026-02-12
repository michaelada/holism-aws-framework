/**
 * Price Calculator Utility
 * 
 * Provides functions for calculating prices, delivery fees, and validating quantities
 * for merchandise orders.
 */

import type {
  MerchandiseType,
  MerchandiseOptionType,
  DeliveryRule,
  PriceCalculation,
} from '../types/merchandise.types';

/**
 * Calculate unit price based on selected options
 */
export function calculateUnitPrice(
  merchandiseType: MerchandiseType,
  selectedOptions: Record<string, string>
): number {
  let totalPrice = 0;
  
  for (const optionType of merchandiseType.optionTypes) {
    const selectedValueId = selectedOptions[optionType.id];
    if (!selectedValueId) continue;
    
    const optionValue = optionType.optionValues.find(ov => ov.id === selectedValueId);
    if (optionValue) {
      totalPrice += optionValue.price;
    }
  }
  
  return totalPrice;
}

/**
 * Calculate delivery fee based on delivery type and quantity
 */
export function calculateDeliveryFee(
  merchandiseType: MerchandiseType,
  quantity: number
): number {
  switch (merchandiseType.deliveryType) {
    case 'free':
      return 0;
      
    case 'fixed':
      return merchandiseType.deliveryFee || 0;
      
    case 'quantity_based':
      if (!merchandiseType.deliveryRules || merchandiseType.deliveryRules.length === 0) {
        return 0;
      }
      
      // Find the applicable delivery rule
      const sortedRules = [...merchandiseType.deliveryRules].sort((a, b) => a.order - b.order);
      
      for (const rule of sortedRules) {
        const meetsMin = quantity >= rule.minQuantity;
        const meetsMax = rule.maxQuantity === undefined || rule.maxQuantity === null || quantity <= rule.maxQuantity;
        
        if (meetsMin && meetsMax) {
          return rule.deliveryFee;
        }
      }
      
      // If no rule matches, return 0
      return 0;
      
    default:
      return 0;
  }
}

/**
 * Validate quantity against rules (min, max, increments)
 */
export function validateQuantity(
  merchandiseType: MerchandiseType,
  quantity: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check minimum quantity
  const minQuantity = merchandiseType.minOrderQuantity || 1;
  if (quantity < minQuantity) {
    errors.push(`Minimum order quantity is ${minQuantity}`);
  }
  
  // Check maximum quantity
  if (merchandiseType.maxOrderQuantity && quantity > merchandiseType.maxOrderQuantity) {
    errors.push(`Maximum order quantity is ${merchandiseType.maxOrderQuantity}`);
  }
  
  // Check quantity increments
  if (merchandiseType.quantityIncrements && merchandiseType.quantityIncrements > 1) {
    if (quantity % merchandiseType.quantityIncrements !== 0) {
      errors.push(`Quantity must be in multiples of ${merchandiseType.quantityIncrements}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate complete price breakdown
 */
export function calculatePrice(
  merchandiseType: MerchandiseType,
  selectedOptions: Record<string, string>,
  quantity: number
): PriceCalculation {
  // Validate quantity first
  const quantityValidation = validateQuantity(merchandiseType, quantity);
  
  if (!quantityValidation.isValid) {
    return {
      unitPrice: 0,
      subtotal: 0,
      deliveryFee: 0,
      totalPrice: 0,
      isValid: false,
      errors: quantityValidation.errors,
    };
  }
  
  // Calculate unit price
  const unitPrice = calculateUnitPrice(merchandiseType, selectedOptions);
  
  // Calculate subtotal
  const subtotal = unitPrice * quantity;
  
  // Calculate delivery fee
  const deliveryFee = calculateDeliveryFee(merchandiseType, quantity);
  
  // Calculate total
  const totalPrice = subtotal + deliveryFee;
  
  return {
    unitPrice,
    subtotal,
    deliveryFee,
    totalPrice,
    isValid: true,
  };
}

/**
 * Validate delivery rules for overlapping ranges
 */
export function validateDeliveryRules(rules: DeliveryRule[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (rules.length === 0) {
    return { isValid: true, errors: [] };
  }
  
  // Sort rules by minQuantity
  const sortedRules = [...rules].sort((a, b) => a.minQuantity - b.minQuantity);
  
  // Check for overlaps
  for (let i = 0; i < sortedRules.length - 1; i++) {
    const currentRule = sortedRules[i];
    const nextRule = sortedRules[i + 1];
    
    // If current rule has no max, it covers all remaining quantities
    if (currentRule.maxQuantity === undefined || currentRule.maxQuantity === null) {
      errors.push(`Rule ${i + 1} has no maximum quantity and overlaps with subsequent rules`);
      continue;
    }
    
    // Check if current rule's max overlaps with next rule's min
    if (currentRule.maxQuantity >= nextRule.minQuantity) {
      errors.push(`Rules ${i + 1} and ${i + 2} have overlapping quantity ranges`);
    }
  }
  
  // Check for gaps
  for (let i = 0; i < sortedRules.length - 1; i++) {
    const currentRule = sortedRules[i];
    const nextRule = sortedRules[i + 1];
    
    if (currentRule.maxQuantity !== undefined && currentRule.maxQuantity !== null) {
      if (currentRule.maxQuantity + 1 < nextRule.minQuantity) {
        errors.push(`Gap between rules ${i + 1} and ${i + 2}: quantities ${currentRule.maxQuantity + 1} to ${nextRule.minQuantity - 1} are not covered`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get valid order quantities based on rules
 */
export function getValidOrderQuantities(
  merchandiseType: MerchandiseType,
  maxToShow: number = 20
): number[] {
  const minQuantity = merchandiseType.minOrderQuantity || 1;
  const maxQuantity = merchandiseType.maxOrderQuantity || maxToShow;
  const increment = merchandiseType.quantityIncrements || 1;
  
  const quantities: number[] = [];
  
  for (let q = minQuantity; q <= maxQuantity && quantities.length < maxToShow; q += increment) {
    quantities.push(q);
  }
  
  return quantities;
}

/**
 * Format price for display
 */
export function formatPrice(price: number, currency: string = '€'): string {
  return `${currency}${price.toFixed(2)}`;
}

/**
 * Calculate price for all option combinations
 */
export function calculateAllCombinationPrices(
  optionTypes: MerchandiseOptionType[]
): Array<{ combination: Record<string, string>; price: number; label: string }> {
  if (optionTypes.length === 0) {
    return [];
  }
  
  // Generate all combinations
  const combinations: Array<{ combination: Record<string, string>; price: number; label: string }> = [];
  
  function generateCombinations(
    currentIndex: number,
    currentCombination: Record<string, string>,
    currentPrice: number,
    currentLabel: string[]
  ) {
    if (currentIndex === optionTypes.length) {
      combinations.push({
        combination: { ...currentCombination },
        price: currentPrice,
        label: currentLabel.join(' / '),
      });
      return;
    }
    
    const optionType = optionTypes[currentIndex];
    
    for (const optionValue of optionType.optionValues) {
      generateCombinations(
        currentIndex + 1,
        { ...currentCombination, [optionType.id]: optionValue.id },
        currentPrice + optionValue.price,
        [...currentLabel, `${optionType.name}: ${optionValue.name}`]
      );
    }
  }
  
  generateCombinations(0, {}, 0, []);
  
  return combinations;
}
