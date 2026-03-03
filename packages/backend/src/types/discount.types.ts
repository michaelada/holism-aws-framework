// Type definitions for the Discount Management System

export type ModuleType = 'events' | 'memberships' | 'calendar' | 'merchandise' | 'registrations';
export type DiscountType = 'percentage' | 'fixed';
export type ApplicationScope = 'item' | 'category' | 'cart' | 'quantity-based';
export type DiscountStatus = 'active' | 'inactive' | 'expired';

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
  validFrom?: Date;
  validUntil?: Date;
  
  // Usage
  usageLimits?: UsageLimits;
  
  // Combination
  combinable: boolean;
  priority: number;
  
  // Status
  status: DiscountStatus;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

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

export interface CreateDiscountDto {
  organisationId: string;
  moduleType: ModuleType;
  name: string;
  description?: string;
  code?: string;
  discountType: DiscountType;
  discountValue: number;
  applicationScope: ApplicationScope;
  quantityRules?: QuantityRules;
  eligibilityCriteria?: EligibilityCriteria;
  validFrom?: Date;
  validUntil?: Date;
  usageLimits?: Omit<UsageLimits, 'currentUsageCount'>;
  combinable?: boolean;
  priority?: number;
  status?: DiscountStatus;
  createdBy?: string;
}

export interface UpdateDiscountDto {
  name?: string;
  description?: string;
  code?: string;
  discountValue?: number;
  quantityRules?: QuantityRules;
  eligibilityCriteria?: EligibilityCriteria;
  validFrom?: Date;
  validUntil?: Date;
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
  appliedAt: Date;
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
  appliedAt: Date;
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

// Calculation result interfaces
export interface DiscountResult {
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  appliedDiscounts: AppliedDiscount[];
}

export interface AppliedDiscount {
  discountId: string;
  discountName: string;
  discountAmount: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

export interface CartDiscountResult {
  originalTotal: number;
  discountTotal: number;
  finalTotal: number;
  itemResults: Array<{
    itemId: string;
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
    appliedDiscounts: AppliedDiscount[];
  }>;
  cartLevelDiscounts: AppliedDiscount[];
}

export interface TransactionDetails {
  transactionType: string;
  transactionId: string;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
}
