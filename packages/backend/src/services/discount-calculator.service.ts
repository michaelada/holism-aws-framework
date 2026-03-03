import {
  Discount,
  DiscountResult,
  AppliedDiscount,
  CartItem,
  CartDiscountResult,
} from '../types/discount.types';

/**
 * Discount Calculator Service
 * 
 * Handles all discount calculation logic including:
 * - Single item discounts (percentage and fixed)
 * - Quantity-based discounts
 * - Multiple discount application with priority and combination rules
 * - Cart-level discount calculations
 */
export class DiscountCalculatorService {
  /**
   * Round monetary value to 2 decimal places
   */
  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Ensure final price is never negative
   */
  private ensureNonNegative(amount: number): number {
    return Math.max(0, amount);
  }

  /**
   * Calculate discount for a single item
   * Supports both percentage and fixed amount discounts
   */
  calculateItemDiscount(
    discount: Discount,
    itemPrice: number,
    quantity: number
  ): DiscountResult {
    const originalAmount = this.roundMoney(itemPrice * quantity);
    let discountAmount = 0;

    // Check for zero maximum discount cap early
    if (discount.eligibilityCriteria?.maximumDiscountAmount === 0) {
      return {
        originalAmount,
        discountAmount: 0,
        finalAmount: originalAmount,
        appliedDiscounts: [],
      };
    }

    if (discount.discountType === 'percentage') {
      // Cap percentage at 100% to prevent over-discounting
      const cappedPercentage = Math.min(discount.discountValue, 100);
      // Percentage discount: (price * quantity * percentage / 100)
      discountAmount = this.roundMoney((originalAmount * cappedPercentage) / 100);
    } else {
      // Fixed amount discount: min(discount value, total price)
      discountAmount = Math.min(discount.discountValue, originalAmount);
      discountAmount = this.roundMoney(discountAmount);
    }

    // Apply maximum discount cap if specified
    if (discount.eligibilityCriteria?.maximumDiscountAmount) {
      discountAmount = Math.min(
        discountAmount,
        discount.eligibilityCriteria.maximumDiscountAmount
      );
      discountAmount = this.roundMoney(discountAmount);
    }

    // Ensure discount never exceeds original amount (handles rounding errors)
    discountAmount = Math.min(discountAmount, originalAmount);

    const finalAmount = this.ensureNonNegative(
      this.roundMoney(originalAmount - discountAmount)
    );

    return {
      originalAmount,
      discountAmount,
      finalAmount,
      appliedDiscounts: [
        {
          discountId: discount.id,
          discountName: discount.name,
          discountAmount,
        },
      ],
    };
  }

  /**
   * Calculate quantity-based discount
   * Examples:
   * - Buy 2 get 1 free: minimumQuantity=3, applyToQuantity=1
   * - Every 3rd item free: minimumQuantity=3, applyEveryN=3
   */
  calculateQuantityDiscount(
    discount: Discount,
    itemPrice: number,
    quantity: number
  ): DiscountResult {
    const originalAmount = this.roundMoney(itemPrice * quantity);
    let discountAmount = 0;

    if (!discount.quantityRules) {
      return {
        originalAmount,
        discountAmount: 0,
        finalAmount: originalAmount,
        appliedDiscounts: [],
      };
    }

    // Check for zero maximum discount cap early
    if (discount.eligibilityCriteria?.maximumDiscountAmount === 0) {
      return {
        originalAmount,
        discountAmount: 0,
        finalAmount: originalAmount,
        appliedDiscounts: [],
      };
    }

    const { minimumQuantity, applyToQuantity, applyEveryN } = discount.quantityRules;

    // Check if minimum quantity is met
    if (quantity < minimumQuantity) {
      return {
        originalAmount,
        discountAmount: 0,
        finalAmount: originalAmount,
        appliedDiscounts: [],
      };
    }

    // Calculate how many items get the discount
    let discountedItems = 0;

    if (applyToQuantity !== undefined) {
      // Apply discount to specific number of items (e.g., buy 2 get 1 free)
      discountedItems = applyToQuantity;
    } else if (applyEveryN !== undefined) {
      // Apply discount every N items (e.g., every 3rd item free)
      discountedItems = Math.floor(quantity / applyEveryN);
    }

    // Calculate discount based on type
    if (discount.discountType === 'percentage') {
      // Cap percentage at 100% to prevent over-discounting
      const cappedPercentage = Math.min(discount.discountValue, 100);
      const discountedItemsTotal = this.roundMoney(itemPrice * discountedItems);
      discountAmount = this.roundMoney(
        (discountedItemsTotal * cappedPercentage) / 100
      );
    } else {
      // Fixed amount per discounted item
      discountAmount = this.roundMoney(discount.discountValue * discountedItems);
      // Cannot exceed total price
      discountAmount = Math.min(discountAmount, originalAmount);
    }

    // Apply maximum discount cap if specified
    if (discount.eligibilityCriteria?.maximumDiscountAmount) {
      discountAmount = Math.min(
        discountAmount,
        discount.eligibilityCriteria.maximumDiscountAmount
      );
      discountAmount = this.roundMoney(discountAmount);
    }

    // Ensure discount never exceeds original amount (handles rounding errors)
    discountAmount = Math.min(discountAmount, originalAmount);

    const finalAmount = this.ensureNonNegative(
      this.roundMoney(originalAmount - discountAmount)
    );

    return {
      originalAmount,
      discountAmount,
      finalAmount,
      appliedDiscounts: [
        {
          discountId: discount.id,
          discountName: discount.name,
          discountAmount,
        },
      ],
    };
  }

  /**
   * Apply multiple discounts to an item
   * Handles priority sorting and combination rules
   */
  applyMultipleDiscounts(
    discounts: Discount[],
    itemPrice: number,
    quantity: number
  ): DiscountResult {
    if (discounts.length === 0) {
      const originalAmount = this.roundMoney(itemPrice * quantity);
      return {
        originalAmount,
        discountAmount: 0,
        finalAmount: originalAmount,
        appliedDiscounts: [],
      };
    }

    // Sort by priority (descending)
    const sortedDiscounts = [...discounts].sort((a, b) => b.priority - a.priority);

    const originalAmount = this.roundMoney(itemPrice * quantity);
    let currentAmount = originalAmount;
    const appliedDiscounts: AppliedDiscount[] = [];

    // Check if highest priority discount is non-combinable
    if (!sortedDiscounts[0].combinable) {
      // Apply only the highest priority discount
      const result =
        sortedDiscounts[0].applicationScope === 'quantity-based'
          ? this.calculateQuantityDiscount(sortedDiscounts[0], itemPrice, quantity)
          : this.calculateItemDiscount(sortedDiscounts[0], itemPrice, quantity);

      return result;
    }

    // Apply discounts sequentially
    for (const discount of sortedDiscounts) {
      if (!discount.combinable) {
        // Stop at first non-combinable discount
        break;
      }

      let discountAmount = 0;

      if (discount.applicationScope === 'quantity-based') {
        // For quantity-based, calculate on original price
        const result = this.calculateQuantityDiscount(discount, itemPrice, quantity);
        discountAmount = result.discountAmount;
      } else {
        // For other types, calculate on current amount
        if (discount.discountType === 'percentage') {
          // Cap percentage at 100% to prevent over-discounting
          const cappedPercentage = Math.min(discount.discountValue, 100);
          discountAmount = this.roundMoney(
            (currentAmount * cappedPercentage) / 100
          );
        } else {
          discountAmount = Math.min(discount.discountValue, currentAmount);
          discountAmount = this.roundMoney(discountAmount);
        }

        // Apply maximum discount cap if specified
        if (discount.eligibilityCriteria?.maximumDiscountAmount) {
          discountAmount = Math.min(
            discountAmount,
            discount.eligibilityCriteria.maximumDiscountAmount
          );
          discountAmount = this.roundMoney(discountAmount);
        }
      }

      // Ensure discount doesn't exceed current amount
      discountAmount = Math.min(discountAmount, currentAmount);

      if (discountAmount > 0) {
        appliedDiscounts.push({
          discountId: discount.id,
          discountName: discount.name,
          discountAmount,
        });

        currentAmount = this.ensureNonNegative(
          this.roundMoney(currentAmount - discountAmount)
        );
      }
    }

    const totalDiscountAmount = this.roundMoney(
      appliedDiscounts.reduce((sum, d) => sum + d.discountAmount, 0)
    );

    // Ensure total discount doesn't exceed original amount
    const cappedTotalDiscount = Math.min(totalDiscountAmount, originalAmount);

    return {
      originalAmount,
      discountAmount: cappedTotalDiscount,
      finalAmount: this.ensureNonNegative(
        this.roundMoney(originalAmount - cappedTotalDiscount)
      ),
      appliedDiscounts,
    };
  }

  /**
   * Calculate discounts for entire cart
   * Handles both item-level and cart-level discounts
   */
  calculateCartDiscounts(
    cartItems: CartItem[],
    discounts: Discount[]
  ): CartDiscountResult {
    const itemResults: CartDiscountResult['itemResults'] = [];
    let originalTotal = 0;
    let discountTotal = 0;

    // Separate item-level and cart-level discounts
    const itemLevelDiscounts = discounts.filter(
      (d) => d.applicationScope === 'item' || d.applicationScope === 'quantity-based'
    );
    const cartLevelDiscounts = discounts.filter((d) => d.applicationScope === 'cart');

    // Apply item-level discounts
    for (const item of cartItems) {
      const applicableDiscounts = itemLevelDiscounts.filter((d) => {
        // Filter by category if applicable
        if (d.applicationScope === 'category' && item.category) {
          // Category matching logic would go here
          return true;
        }
        return true;
      });

      const result = this.applyMultipleDiscounts(
        applicableDiscounts,
        item.price,
        item.quantity
      );

      itemResults.push({
        itemId: item.id,
        originalAmount: result.originalAmount,
        discountAmount: result.discountAmount,
        finalAmount: result.finalAmount,
        appliedDiscounts: result.appliedDiscounts,
      });

      originalTotal = this.roundMoney(originalTotal + result.originalAmount);
      discountTotal = this.roundMoney(discountTotal + result.discountAmount);
    }

    // Calculate subtotal after item-level discounts
    let currentTotal = this.ensureNonNegative(
      this.roundMoney(originalTotal - discountTotal)
    );

    // Apply cart-level discounts
    const cartLevelApplied: AppliedDiscount[] = [];
    for (const discount of cartLevelDiscounts.sort((a, b) => b.priority - a.priority)) {
      if (!discount.combinable && cartLevelApplied.length > 0) {
        break;
      }

      let cartDiscountAmount = 0;
      if (discount.discountType === 'percentage') {
        // Cap percentage at 100% to prevent over-discounting
        const cappedPercentage = Math.min(discount.discountValue, 100);
        cartDiscountAmount = this.roundMoney(
          (currentTotal * cappedPercentage) / 100
        );
      } else {
        cartDiscountAmount = Math.min(discount.discountValue, currentTotal);
        cartDiscountAmount = this.roundMoney(cartDiscountAmount);
      }

      // Apply maximum discount cap if specified
      if (discount.eligibilityCriteria?.maximumDiscountAmount) {
        cartDiscountAmount = Math.min(
          cartDiscountAmount,
          discount.eligibilityCriteria.maximumDiscountAmount
        );
        cartDiscountAmount = this.roundMoney(cartDiscountAmount);
      }

      // Ensure cart discount doesn't exceed current total
      cartDiscountAmount = Math.min(cartDiscountAmount, currentTotal);

      if (cartDiscountAmount > 0) {
        cartLevelApplied.push({
          discountId: discount.id,
          discountName: discount.name,
          discountAmount: cartDiscountAmount,
        });

        currentTotal = this.ensureNonNegative(
          this.roundMoney(currentTotal - cartDiscountAmount)
        );
        discountTotal = this.roundMoney(discountTotal + cartDiscountAmount);
      }
    }

    // Final safety check to ensure non-negative total
    const finalTotal = this.ensureNonNegative(currentTotal);
    
    // Adjust discount total if needed to maintain consistency
    const adjustedDiscountTotal = this.roundMoney(originalTotal - finalTotal);

    return {
      originalTotal,
      discountTotal: adjustedDiscountTotal,
      finalTotal,
      itemResults,
      cartLevelDiscounts: cartLevelApplied,
    };
  }
}

export const discountCalculatorService = new DiscountCalculatorService();
