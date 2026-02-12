import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EventEntryDetailsDialog from '../EventEntryDetailsDialog';

const mockEntry = {
  id: '1',
  eventId: '1',
  eventActivityId: '1',
  userId: '1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  quantity: 1,
  paymentStatus: 'paid' as const,
  paymentMethod: 'card' as const,
  entryDate: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('EventEntryDetailsDialog', () => {
  it('renders entry details when open', () => {
    render(
      <EventEntryDetailsDialog
        entry={mockEntry}
        open={true}
        onClose={vi.fn()}
      />
    );
    
    expect(screen.getByText('Entry Details')).toBeInTheDocument();
    expect(screen.getByText('John')).toBeInTheDocument();
    expect(screen.getByText('Doe')).toBeInTheDocument();
  });
});
