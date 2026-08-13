/**
 * Ticketing Module Tests
 * 
 * Unit tests for ticketing dashboard, components, and utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TicketingDashboardPage from '../pages/TicketingDashboardPage';
import TicketDetailsDialog from '../components/TicketDetailsDialog';
import BatchTicketOperationsDialog from '../components/BatchTicketOperationsDialog';
import TicketingStatsCards from '../components/TicketingStatsCards';
import type { ElectronicTicket } from '../types/ticketing.types';

/*
 * The ticket-generation utilities are tested in `packages/components`, where
 * they now live — the account-user app renders the same ticket, so they are
 * shared code (CLAUDE.md §1.5).
 */

// Mock data
const mockTicket: ElectronicTicket = {
  id: '1',
  ticketReference: 'TKT-2024-000001',
  qrCode: '123e4567-e89b-12d3-a456-426614174000',
  eventId: 'event-1',
  eventActivityId: 'activity-1',
  eventEntryId: 'entry-1',
  userId: 'user-1',
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  issueDate: new Date('2024-01-01'),
  validFrom: new Date('2024-01-01'),
  validUntil: new Date('2024-12-31'),
  scanStatus: 'not_scanned',
  scanDate: undefined,
  scanLocation: undefined,
  scanCount: 0,
  status: 'issued',
  ticketData: {
    eventName: 'Test Event',
    activityName: 'Test Activity',
  },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockTickets: ElectronicTicket[] = [
  mockTicket,
  {
    ...mockTicket,
    id: '2',
    ticketReference: 'TKT-2024-000002',
    scanStatus: 'scanned',
    scanDate: new Date('2024-01-15'),
    scanCount: 1,
  },
];

describe('TicketingDashboardPage', () => {
  it('renders dashboard with title', () => {
    render(
      <BrowserRouter>
        <TicketingDashboardPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Event Ticketing')).toBeInTheDocument();
  });

  it('displays filters section', () => {
    render(
      <BrowserRouter>
        <TicketingDashboardPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Filters')).toBeInTheDocument();
    // Check for filter inputs - use getAllByText since these labels appear in multiple places (filters and table headers)
    const eventLabels = screen.getAllByText('Event');
    expect(eventLabels.length).toBeGreaterThan(0);
    const activityLabels = screen.getAllByText('Event Activity');
    expect(activityLabels.length).toBeGreaterThan(0);
    const scanStatusLabels = screen.getAllByText('Scan Status');
    expect(scanStatusLabels.length).toBeGreaterThan(0);
  });

  it('displays export button', () => {
    render(
      <BrowserRouter>
        <TicketingDashboardPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Export to Excel')).toBeInTheDocument();
  });

  it('displays refresh button', () => {
    render(
      <BrowserRouter>
        <TicketingDashboardPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });
});

describe('TicketDetailsDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnUpdate = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnUpdate.mockClear();
  });

  it('renders ticket details when open', () => {
    render(
      <TicketDetailsDialog
        open={true}
        ticket={mockTicket}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText('Ticket Details')).toBeInTheDocument();
    // Use getAllByText since ticket reference appears multiple times (QR code section and ticket info)
    const ticketRefs = screen.getAllByText(mockTicket.ticketReference);
    expect(ticketRefs.length).toBeGreaterThan(0);
    expect(screen.getByText(mockTicket.customerName)).toBeInTheDocument();
    expect(screen.getByText(mockTicket.customerEmail)).toBeInTheDocument();
  });

  it('displays QR code section', () => {
    render(
      <TicketDetailsDialog
        open={true}
        ticket={mockTicket}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText('QR Code')).toBeInTheDocument();
  });

  it('shows mark as scanned button for unscanned tickets', () => {
    render(
      <TicketDetailsDialog
        open={true}
        ticket={mockTicket}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText('Mark as Scanned')).toBeInTheDocument();
  });

  it('shows mark as not scanned button for scanned tickets', () => {
    const scannedTicket = { ...mockTicket, scanStatus: 'scanned' as const };
    render(
      <TicketDetailsDialog
        open={true}
        ticket={scannedTicket}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText('Mark as Not Scanned')).toBeInTheDocument();
  });

  it('displays resend email button', () => {
    render(
      <TicketDetailsDialog
        open={true}
        ticket={mockTicket}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText('Resend Email')).toBeInTheDocument();
  });

  it('displays download PDF button', () => {
    render(
      <TicketDetailsDialog
        open={true}
        ticket={mockTicket}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText('Download PDF')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <TicketDetailsDialog
        open={true}
        ticket={mockTicket}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    );

    const closeButtons = screen.getAllByText('Close');
    fireEvent.click(closeButtons[0]);
    expect(mockOnClose).toHaveBeenCalled();
  });
});

describe('BatchTicketOperationsDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnComplete.mockClear();
  });

  it('renders dialog with mark scanned operation', () => {
    render(
      <BatchTicketOperationsDialog
        open={true}
        ticketIds={['1', '2']}
        operation="mark_scanned"
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    expect(screen.getByText('Mark Tickets as Scanned')).toBeInTheDocument();
    expect(screen.getByText(/Mark 2 ticket\(s\) as scanned\?/)).toBeInTheDocument();
  });

  it('renders dialog with mark not scanned operation', () => {
    render(
      <BatchTicketOperationsDialog
        open={true}
        ticketIds={['1', '2']}
        operation="mark_not_scanned"
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    expect(screen.getByText('Mark Tickets as Not Scanned')).toBeInTheDocument();
    expect(screen.getByText(/Mark 2 ticket\(s\) as not scanned\?/)).toBeInTheDocument();
  });

  it('displays confirm button', () => {
    render(
      <BatchTicketOperationsDialog
        open={true}
        ticketIds={['1', '2']}
        operation="mark_scanned"
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('displays cancel button', () => {
    render(
      <BatchTicketOperationsDialog
        open={true}
        ticketIds={['1', '2']}
        operation="mark_scanned"
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });
});

describe('TicketingStatsCards', () => {
  it('displays total tickets issued', () => {
    render(<TicketingStatsCards tickets={mockTickets} />);

    expect(screen.getByText('Total Tickets Issued')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('displays tickets scanned count', () => {
    render(<TicketingStatsCards tickets={mockTickets} />);

    expect(screen.getByText('Tickets Scanned')).toBeInTheDocument();
    // Use getAllByText since "1" appears in both scanned and not scanned cards
    const ones = screen.getAllByText('1');
    expect(ones.length).toBeGreaterThan(0);
  });

  it('displays tickets not scanned count', () => {
    render(<TicketingStatsCards tickets={mockTickets} />);

    expect(screen.getByText('Tickets Not Scanned')).toBeInTheDocument();
    // Use getAllByText since "1" appears in both scanned and not scanned cards
    const ones = screen.getAllByText('1');
    expect(ones.length).toBeGreaterThan(0);
  });

  it('displays last scan time', () => {
    render(<TicketingStatsCards tickets={mockTickets} />);

    expect(screen.getByText('Last Scan Time')).toBeInTheDocument();
  });

  it('calculates scan percentage correctly', () => {
    render(<TicketingStatsCards tickets={mockTickets} />);

    // 1 out of 2 tickets scanned = 50%
    // Use getAllByText since "50% of total" appears in both scanned and not scanned cards
    const percentages = screen.getAllByText('50% of total');
    expect(percentages.length).toBeGreaterThan(0);
  });
});
