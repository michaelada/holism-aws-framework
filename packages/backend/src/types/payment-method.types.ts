/**
 * Payment Method Types
 * 
 * Type definitions for the payment methods configuration system.
 * Supports flexible payment provider integration with JSON-based configuration storage.
 */

/**
 * Payment method status for organization associations
 */
export type PaymentMethodStatus = 'inactive' | 'active';

/**
 * Payment method master data
 * Represents a system-wide payment option (e.g., "Pay Offline", "Stripe", "Helix-Pay")
 */
export interface PaymentMethod {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  requiresActivation: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for creating a new payment method
 */
export interface CreatePaymentMethodDto {
  name: string;
  displayName: string;
  description?: string;
  requiresActivation: boolean;
}

/**
 * DTO for updating an existing payment method
 */
export interface UpdatePaymentMethodDto {
  displayName?: string;
  description?: string;
  requiresActivation?: boolean;
  isActive?: boolean;
}

/**
 * Organization-specific payment method configuration
 * Associates a payment method with an organization and stores provider-specific data
 */
export interface OrgPaymentMethodData {
  id: string;
  organizationId: string;
  paymentMethodId: string;
  status: PaymentMethodStatus;
  paymentData: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  
  // Populated fields
  paymentMethod?: PaymentMethod;
}

/**
 * DTO for creating an organization-payment method association
 */
export interface CreateOrgPaymentMethodDataDto {
  organizationId: string;
  paymentMethodId: string;
  status?: PaymentMethodStatus;
  paymentData?: Record<string, any>;
}

/**
 * DTO for updating an organization-payment method association
 */
export interface UpdateOrgPaymentMethodDataDto {
  status?: PaymentMethodStatus;
  paymentData?: Record<string, any>;
}
