/**
 * Merchandise Type Definitions
 * 
 * These types define the data structures for merchandise management,
 * including merchandise types, options, stock, delivery, and orders.
 */

export interface MerchandiseOptionValue {
  id: string;
  optionTypeId: string;
  name: string;
  price: number;
  sku?: string;
  stockQuantity?: number;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MerchandiseOptionType {
  id: string;
  merchandiseTypeId: string;
  name: string;
  order: number;
  optionValues: MerchandiseOptionValue[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryRule {
  id: string;
  merchandiseTypeId: string;
  minQuantity: number;
  maxQuantity?: number;
  deliveryFee: number;
  order: number;
}

export type DeliveryType = 'free' | 'fixed' | 'quantity_based';
export type OutOfStockBehavior = 'hide' | 'show_unavailable';
export type MerchandiseStatus = 'active' | 'inactive';

export interface MerchandiseType {
  id: string;
  organisationId: string;
  name: string;
  description: string;
  images: string[];
  status: MerchandiseStatus;
  
  // Options configuration
  optionTypes: MerchandiseOptionType[];
  
  // Stock management (optional)
  trackStockLevels: boolean;
  lowStockAlert?: number;
  outOfStockBehavior?: OutOfStockBehavior;
  
  // Delivery configuration
  deliveryType: DeliveryType;
  deliveryFee?: number;
  deliveryRules?: DeliveryRule[];
  
  // Order quantity rules
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
  quantityIncrements?: number;
  
  // Application form integration
  requireApplicationForm: boolean;
  applicationFormId?: string;
  
  // Payment configuration
  supportedPaymentMethods: string[];
  useTermsAndConditions: boolean;
  termsAndConditions?: string;
  
  // Email notifications
  adminNotificationEmails?: string;
  customConfirmationMessage?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentStatus = 'pending' | 'paid' | 'refunded';
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface MerchandiseOrder {
  id: string;
  organisationId: string;
  merchandiseTypeId: string;
  userId: string;
  
  // Order details
  selectedOptions: Record<string, string>;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  deliveryFee: number;
  totalPrice: number;
  
  // Form submission
  formSubmissionId?: string;
  
  // Payment
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  
  // Order status
  orderStatus: OrderStatus;
  
  // Admin notes
  adminNotes?: string;
  
  // Timestamps
  orderDate: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Populated fields (from joins)
  merchandiseType?: MerchandiseType;
  customerName?: string;
  customerEmail?: string;
}

export interface MerchandiseOrderHistory {
  id: string;
  orderId: string;
  userId: string;
  previousStatus: string;
  newStatus: string;
  notes?: string;
  createdAt: Date;
}

// Form data types for creating/editing
export interface MerchandiseTypeFormData {
  name: string;
  description: string;
  images: string[];
  status: MerchandiseStatus;
  
  optionTypes: {
    name: string;
    optionValues: {
      name: string;
      price: number;
      sku?: string;
      stockQuantity?: number;
    }[];
  }[];
  
  trackStockLevels: boolean;
  lowStockAlert?: number;
  outOfStockBehavior?: OutOfStockBehavior;
  
  deliveryType: DeliveryType;
  deliveryFee?: number;
  deliveryRules?: {
    minQuantity: number;
    maxQuantity?: number;
    deliveryFee: number;
  }[];
  
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
  quantityIncrements?: number;
  
  requireApplicationForm: boolean;
  applicationFormId?: string;
  
  supportedPaymentMethods: string[];
  useTermsAndConditions: boolean;
  termsAndConditions?: string;
  
  adminNotificationEmails?: string;
  customConfirmationMessage?: string;
}

// Price calculation result
export interface PriceCalculation {
  unitPrice: number;
  subtotal: number;
  deliveryFee: number;
  totalPrice: number;
  isValid: boolean;
  errors?: string[];
}

// Stock level indicator
export type StockLevel = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface StockInfo {
  level: StockLevel;
  quantity?: number;
  threshold?: number;
}
