/**
 * Discount Types
 * 
 * Type definitions for the discount management system.
 * These types match the backend discount.types.ts structure.
 */

export type ModuleType = 'events' | 'memberships' | 'calendar' | 'merchandise' | 'registrations';
export type DiscountType = 'percentage' | 'fixed';
export type ApplicationScope = 'item' | 'category' | 'cart' | 'quantity-based';
export type DiscountStatus = 'active' | 'inactive' | 'expired';

export interface QuantityRules {
  minimumQuantity: number;
  applyToQuantity?: number;
  applyEveryN?: number;
}

export interface EligibilityCriteria {
  requiresCode: boolean;
  membershipTypes?: string[];
  userGroups?: string[];
  minimumPurchaseAmount?: number;
  maximumDiscountAmount?: number;
}

export interface UsageLimits {
  totalUsageLimit?: number;
  perUserLimit?: number;
  currentUsageCount: number;
}

export interface Discount {
  id: string;
  organisationId: string;
  moduleType: ModuleType;
  
  // Basic Information
  name: string;
  description?: string;
  code?: string;
  
  // Discount Configuration
  discountType: DiscountType;
  discountValue: number;
  applicationScope: ApplicationScope;
  quantityRules?: QuantityRules;
  
  // Eligibility
  eligibilityCriteria?: EligibilityCriteria;
  
  // Validity
  validFrom?: Date | string;
  validUntil?: Date | string;
  
  // Usage
  usageLimits?: UsageLimits;
  
  // Combination
  combinable: boolean;
  priority: number;
  
  // Status
  status: DiscountStatus;
  
  // Metadata
  createdAt: Date | string;
  updatedAt: Date | string;
  createdBy?: string;
}

export interface CreateDiscountDto {
  name: string;
  description?: string;
  code?: string;
  discountType: DiscountType;
  discountValue: number;
  applicationScope: ApplicationScope;
  quantityRules?: QuantityRules;
  eligibilityCriteria?: EligibilityCriteria;
  validFrom?: Date | string;
  validUntil?: Date | string;
  usageLimits?: Omit<UsageLimits, 'currentUsageCount'>;
  combinable?: boolean;
  priority?: number;
  status?: DiscountStatus;
}

export interface UpdateDiscountDto {
  name?: string;
  description?: string;
  code?: string;
  discountValue?: number;
  quantityRules?: QuantityRules;
  eligibilityCriteria?: EligibilityCriteria;
  validFrom?: Date | string;
  validUntil?: Date | string;
  usageLimits?: Partial<UsageLimits>;
  combinable?: boolean;
  priority?: number;
  status?: DiscountStatus;
}

export interface DiscountApplication {
  id: string;
  discountId: string;
  targetType: string;
  targetId: string;
  appliedAt: Date | string;
  appliedBy?: string;
}

export interface DiscountUsage {
  id: string;
  discountId: string;
  userId: string;
  transactionType: string;
  transactionId: string;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  appliedAt: Date | string;
}

export interface UsageStats {
  totalUses: number;
  remainingUses?: number;
  totalDiscountGiven: number;
  averageDiscountAmount: number;
  topUsers: Array<{
    userId: string;
    usageCount: number;
    totalDiscountReceived: number;
  }>;
}

export interface AppliedDiscount {
  discountId: string;
  discountName: string;
  discountAmount: number;
}

export interface DiscountResult {
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  appliedDiscounts: AppliedDiscount[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  categoryId?: string;
}

export interface CartDiscountResult {
  items: Array<{
    itemId: string;
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
    appliedDiscounts: AppliedDiscount[];
  }>;
  cartTotal: {
    originalAmount: number;
    totalDiscount: number;
    finalAmount: number;
  };
}

// API Request/Response Types
export interface GetDiscountsParams {
  organisationId: string;
  moduleType?: ModuleType;
  status?: DiscountStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ApplyDiscountRequest {
  targetType: string;
  targetId: string;
}

export interface ValidateDiscountRequest {
  discountId: string;
  userId: string;
  amount: number;
  quantity: number;
}

export interface ValidateCodeRequest {
  code: string;
  organisationId: string;
  userId: string;
  amount: number;
}

export interface CalculateDiscountRequest {
  discountIds: string[];
  itemPrice: number;
  quantity: number;
}

export interface CalculateCartRequest {
  cartItems: CartItem[];
  userId: string;
}

export interface GetUsageParams {
  discountId: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  page?: number;
  limit?: number;
}
