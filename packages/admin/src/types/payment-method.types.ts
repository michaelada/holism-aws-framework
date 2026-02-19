/**
 * Payment Method Types (Frontend)
 * 
 * Type definitions for the payment methods configuration system.
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
