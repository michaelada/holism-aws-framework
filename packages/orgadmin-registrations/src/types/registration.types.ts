/**
 * Registration Type Configuration
 * Defines a type of registration for entities (horses, boats, equipment, etc.)
 */
export interface RegistrationType {
  id: string;
  organisationId: string;
  name: string;                        // Display name (e.g., "2026 Horse Registration")
  description: string;                 // Detailed description for account users
  entityName: string;                  // Name of thing being registered (e.g., "Horse", "Boat")
  registrationFormId: string;          // Link to ApplicationForm
  registrationStatus: 'open' | 'closed'; // Open = accepting, Closed = visible but not accepting
  isRollingRegistration: boolean;      // true = rolling, false = fixed period
  validUntil?: Date;                   // For fixed period (isRollingRegistration = false)
  numberOfMonths?: number;             // For rolling (isRollingRegistration = true)
  automaticallyApprove: boolean;       // true = auto Active, false = Pending
  registrationLabels: string[];        // Tags automatically assigned to registrations
  supportedPaymentMethods: string[];   // Payment method IDs from Payments module
  useTermsAndConditions: boolean;      // Include T&Cs in application
  termsAndConditions?: string;         // Rich text T&Cs
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Registration Record
 * Represents a single entity registration
 */
export interface Registration {
  id: string;
  organisationId: string;
  registrationTypeId: string;
  userId: string;                      // Account user who owns this registration
  registrationNumber: string;          // Auto-generated unique identifier
  entityName: string;                  // Name/identifier of the registered entity
  ownerName: string;                   // Name of the account user
  formSubmissionId: string;            // Link to FormSubmission
  dateLastRenewed: Date;               // Application or renewal date
  status: 'active' | 'pending' | 'elapsed'; // Registration status
  validUntil: Date;                    // Expiry date
  labels: string[];                    // Tags assigned to this registration
  processed: boolean;                  // Admin review flag
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentMethod?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Custom Filter Set
 * Saved filter configuration for registration searches
 */
export interface RegistrationFilter {
  id: string;
  organisationId: string;
  userId: string;                      // Admin user who created filter
  name: string;                        // Display name
  registrationStatus: ('active' | 'pending' | 'elapsed')[];
  dateLastRenewedBefore?: Date;
  dateLastRenewedAfter?: Date;
  validUntilBefore?: Date;
  validUntilAfter?: Date;
  registrationLabels: string[];
  registrationTypes: string[];         // Filter by registration type IDs
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Form data for creating/editing registration types
 */
export interface RegistrationTypeFormData {
  name: string;
  description: string;
  entityName: string;
  registrationFormId: string;
  registrationStatus: 'open' | 'closed';
  isRollingRegistration: boolean;
  validUntil?: Date;
  numberOfMonths?: number;
  automaticallyApprove: boolean;
  registrationLabels: string[];
  supportedPaymentMethods: string[];
  useTermsAndConditions: boolean;
  termsAndConditions?: string;
}

/**
 * Filter options for registrations database
 */
export interface RegistrationFilterOptions {
  registrationTypeId?: string;
  status?: ('active' | 'pending' | 'elapsed')[];
  searchTerm?: string;                 // Search entity name or owner name
  labels?: string[];
  dateLastRenewedBefore?: Date;
  dateLastRenewedAfter?: Date;
  validUntilBefore?: Date;
  validUntilAfter?: Date;
}

/**
 * Batch operation types
 */
export type BatchOperationType = 'mark_processed' | 'mark_unprocessed' | 'add_labels' | 'remove_labels';

/**
 * Batch operation request
 */
export interface BatchOperationRequest {
  registrationIds: string[];
  operation: BatchOperationType;
  labels?: string[];                   // For add_labels and remove_labels operations
}
