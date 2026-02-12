import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EventActivityForm from '../EventActivityForm';

const mockActivity = {
  name: 'Test Activity',
  description: 'Test Description',
  showPublicly: true,
  limitApplicants: false,
  allowSpecifyQuantity: false,
  useTermsAndConditions: false,
  fee: 0,
  allowedPaymentMethod: 'both' as const,
  handlingFeeIncluded: false,
};

describe('EventActivityForm', () => {
  it('renders activity form', () => {
    render(
      <EventActivityForm
        activity={mockActivity}
        index={0}
        onChange={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    
    expect(screen.getByText(/Activity 1/i)).toBeInTheDocument();
  });

  it('displays activity name field', () => {
    render(
      <EventActivityForm
        activity={mockActivity}
        index={0}
        onChange={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    
    expect(screen.getByLabelText(/Activity Name/i)).toBeInTheDocument();
  });
});
