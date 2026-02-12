/**
 * Ticketing types for event ticketing with QR codes
 */

// Ticket status types
export type TicketStatus = 'issued' | 'scanned' | 'cancelled' | 'expired';
export type TicketScanStatus = 'not_scanned' | 'scanned';

// Event ticketing configuration (extends Event model)
export interface EventTicketingConfig {
  eventId: string;
  generateElectronicTickets: boolean;
  
  // Ticket customization
  ticketHeaderText?: string;
  ticketInstructions?: string;
  ticketFooterText?: string;
  ticketValidityPeriod?: number; // Hours before event
  
  // Ticket template settings
  includeEventLogo: boolean;
  ticketBackgroundColor?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// Electronic Ticket entity
export interface ElectronicTicket {
  id: string;
  ticketReference: string; // e.g., "TKT-2024-001234"
  qrCode: string; // Unique UUID for QR code validation
  
  // Event and booking linkage
  eventId: string;
  eventActivityId?: string;
  eventEntryId: string;
  
  // Customer information
  userId: string;
  customerName: string;
  customerEmail: string;
  
  // Ticket details
  issueDate: Date;
  validFrom?: Date;
  validUntil: Date;
  
  // Scan tracking
  scanStatus: TicketScanStatus;
  scanDate?: Date;
  scanLocation?: string;
  scanCount: number;
  
  // Status
  status: TicketStatus;
  
  // Metadata
  ticketData: Record<string, any>; // JSONB: Additional ticket data
  
  createdAt: Date;
  updatedAt: Date;
}

// Ticket scan history for audit trail
export interface TicketScanHistory {
  id: string;
  ticketId: string;
  scanDate: Date;
  scanLocation?: string;
  scannedBy?: string;
  scanResult: 'valid' | 'invalid' | 'already_scanned' | 'expired';
  notes?: string;
  createdAt: Date;
}

// Ticketing dashboard statistics
export interface TicketingDashboardStats {
  eventId?: string;
  totalTicketsIssued: number;
  ticketsScanned: number;
  ticketsNotScanned: number;
  scanPercentage: number;
  lastScanTime?: Date;
  ticketsByEvent: Array<{
    eventId: string;
    eventName: string;
    totalTickets: number;
    scannedTickets: number;
  }>;
  ticketsByActivity: Array<{
    eventActivityId: string;
    activityName: string;
    totalTickets: number;
    scannedTickets: number;
  }>;
  recentScans: Array<{
    ticketReference: string;
    customerName: string;
    eventName: string;
    scanDate: Date;
  }>;
}

// Filter options for ticket list
export interface TicketFilters {
  eventId?: string;
  eventActivityId?: string;
  scanStatus?: TicketScanStatus[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchTerm?: string; // Search by customer name, email, or ticket reference
}

// Batch operation types
export type BatchTicketOperation = 'mark_scanned' | 'mark_not_scanned';

export interface BatchTicketOperationRequest {
  ticketIds: string[];
  operation: BatchTicketOperation;
  notes?: string;
}

export interface BatchTicketOperationResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors?: Array<{
    ticketId: string;
    error: string;
  }>;
}
