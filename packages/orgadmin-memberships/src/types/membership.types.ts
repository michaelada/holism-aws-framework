/**
 * Membership Type Category
 */
export type MembershipTypeCategory = 'single' | 'group';

/**
 * Membership Status
 */
export type MembershipStatus = 'open' | 'closed';

/**
 * Member Status
 */
export type MemberStatus = 'active' | 'pending' | 'elapsed';

/**
 * Payment Status
 */
export type PaymentStatus = 'pending' | 'paid' | 'refunded';

/**
 * Field Configuration for Group Memberships
 */
export type FieldConfiguration = 'common' | 'unique';

/**
 * Discount Validation Result Interface
 */
export interface DiscountValidationResult {
  valid: boolean;
  errors: Array<{
    discountId: string;
    reason: 'not_found' | 'wrong_organisation' | 'wrong_module_type' | 'inactive';
    message: string;
  }>;
}

/**
 * Membership Type Interface
 */
export interface MembershipType {
  id: string;
  organisationId: string;
  name: string;
  description: string;
  membershipFormId: string;
  membershipStatus: MembershipStatus;
  isRollingMembership: boolean;
  validUntil?: Date | string;
  numberOfMonths?: number;
  automaticallyApprove: boolean;
  memberLabels: string[];
  supportedPaymentMethods: string[];
  useTermsAndConditions: boolean;
  termsAndConditions?: string;
  membershipTypeCategory: MembershipTypeCategory;
  // Group-specific fields
  maxPeopleInApplication?: number;
  minPeopleInApplication?: number;
  personTitles?: string[];
  personLabels?: string[][];
  fieldConfiguration?: Record<string, FieldConfiguration>;
  discountIds: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Member Interface
 */
export interface Member {
  id: string;
  organisationId: string;
  membershipTypeId: string;
  membershipTypeName?: string; // Optional: membership type name for display
  userId: string;
  membershipNumber: string;
  name?: string; // Optional: member name from form submission
  firstName: string;
  lastName: string;
  formSubmissionId: string;
  dateLastRenewed: Date | string;
  status: MemberStatus;
  validUntil: Date | string;
  labels: string[];
  processed: boolean;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  // Group membership fields
  groupMembershipId?: string;
  personSlot?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Member Filter Interface
 */
export interface MemberFilter {
  id: string;
  organisationId: string;
  userId: string;
  name: string;
  memberStatus: MemberStatus[];
  dateLastRenewedBefore?: Date | string;
  dateLastRenewedAfter?: Date | string;
  validUntilBefore?: Date | string;
  validUntilAfter?: Date | string;
  memberLabels: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Create Membership Type DTO
 */
export interface CreateMembershipTypeDto {
  name: string;
  description: string;
  membershipFormId: string;
  membershipStatus: MembershipStatus;
  isRollingMembership: boolean;
  validUntil?: Date | string;
  numberOfMonths?: number;
  automaticallyApprove: boolean;
  memberLabels: string[];
  supportedPaymentMethods: string[];
  useTermsAndConditions: boolean;
  termsAndConditions?: string;
  membershipTypeCategory: MembershipTypeCategory;
  // Group-specific fields
  maxPeopleInApplication?: number;
  minPeopleInApplication?: number;
  personTitles?: string[];
  personLabels?: string[][];
  fieldConfiguration?: Record<string, FieldConfiguration>;
  discountIds?: string[];
}

/**
 * Update Membership Type DTO
 */
export interface UpdateMembershipTypeDto extends Partial<CreateMembershipTypeDto> {}

/**
 * Create Member Filter DTO
 */
export interface CreateMemberFilterDto {
  name: string;
  memberStatus: MemberStatus[];
  dateLastRenewedBefore?: Date | string;
  dateLastRenewedAfter?: Date | string;
  validUntilBefore?: Date | string;
  validUntilAfter?: Date | string;
  memberLabels: string[];
}

/**
 * Update Member DTO
 */
export interface UpdateMemberDto {
  status?: MemberStatus;
  labels?: string[];
  processed?: boolean;
  membershipNumber?: string;
}

/**
 * Batch Operation Type
 */
export type BatchOperationType = 'mark_processed' | 'mark_unprocessed' | 'add_labels' | 'remove_labels';

/**
 * Batch Operation DTO
 */
export interface BatchOperationDto {
  memberIds: string[];
  operation: BatchOperationType;
  labels?: string[];
}
