/**
 * Event Management Types
 * 
 * Type definitions for events, activities, and entries
 */

export interface Event {
  id: string;
  organisationId: string;
  name: string;                        // Event Name (public display)
  description: string;                 // Detailed event information
  eventOwner: string;                  // User ID, defaults to creator
  emailNotifications: string;          // Comma-separated email list
  startDate: Date | string;            // Event Start Date
  endDate: Date | string;              // Event End Date (defaults to startDate)
  openDateEntries?: Date | string;     // When entries open
  entriesClosingDate?: Date | string;  // When entries close
  limitEntries: boolean;               // Limit Number Of Event Entries
  entriesLimit?: number;               // Entry limit if limitEntries is true
  addConfirmationMessage: boolean;     // Add Message To Confirmation Email
  confirmationMessage?: string;        // Message text if addConfirmationMessage is true
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface EventActivity {
  id: string;
  eventId: string;
  name: string;                        // Activity Name (public display)
  description: string;                 // Activity-specific details
  showPublicly: boolean;               // Show Publicly toggle
  applicationFormId?: string;          // Link to Form Builder form
  limitApplicants: boolean;            // Limit Number of Applicants
  applicantsLimit?: number;            // Limit if limitApplicants is true
  allowSpecifyQuantity: boolean;       // Allow ordering multiple entries
  useTermsAndConditions: boolean;      // Use Terms and Conditions
  termsAndConditions?: string;         // Rich text T&Cs
  fee: number;                         // Entry fee (0.00 for free)
  allowedPaymentMethod: 'card' | 'cheque' | 'both';  // Payment methods
  handlingFeeIncluded: boolean;        // For card payments
  chequePaymentInstructions?: string;  // Instructions for cheque/offline
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface EventEntry {
  id: string;
  eventId: string;
  eventActivityId: string;
  userId: string;                      // Account user who submitted
  firstName: string;
  lastName: string;
  email: string;
  formSubmissionId?: string;           // Link to form submission data
  quantity: number;                    // If allowSpecifyQuantity is true
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentMethod?: 'card' | 'cheque';
  entryDate: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface EventFormData {
  name: string;
  description: string;
  eventOwner: string;
  emailNotifications: string;
  startDate: Date | string;
  endDate: Date | string;
  openDateEntries?: Date | string;
  entriesClosingDate?: Date | string;
  limitEntries: boolean;
  entriesLimit?: number;
  addConfirmationMessage: boolean;
  confirmationMessage?: string;
  status: 'draft' | 'published';
  activities: EventActivityFormData[];
  // Ticketing configuration (conditional on event-ticketing capability)
  generateElectronicTickets?: boolean;
  ticketHeaderText?: string;
  ticketInstructions?: string;
  ticketFooterText?: string;
  ticketValidityPeriod?: number;
  includeEventLogo?: boolean;
  ticketBackgroundColor?: string;
}

export interface EventActivityFormData {
  name: string;
  description: string;
  showPublicly: boolean;
  applicationFormId?: string;
  limitApplicants: boolean;
  applicantsLimit?: number;
  allowSpecifyQuantity: boolean;
  useTermsAndConditions: boolean;
  termsAndConditions?: string;
  fee: number;
  allowedPaymentMethod: 'card' | 'cheque' | 'both';
  handlingFeeIncluded: boolean;
  chequePaymentInstructions?: string;
}

export interface EventEntryFilter {
  activityId?: string;
  searchName?: string;
  paymentStatus?: 'pending' | 'paid' | 'refunded';
  dateFrom?: Date | string;
  dateTo?: Date | string;
}
