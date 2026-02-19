import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentMethodSelector } from '../PaymentMethodSelector';
import type { PaymentMethod } from '../../types/payment-method.types';

describe('PaymentMethodSelector', () => {
  const mockPaymentMethods: PaymentMethod[] = [
    {
      id: '1',
      name: 'pay-offline',
      displayName: 'Pay Offline',
      description: 'Payment instructions will be provided in the confirmation email.',
      requiresActivation: false,
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: '2',
      name: 'stripe',
      displayName: 'Pay By Card (Stripe)',
      description: 'Accept card payments through Stripe.',
      requiresActivation: true,
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: '3',
      name: 'helix-pay',
      displayName: 'Pay By Card (Helix-Pay)',
      description: 'Accept card payments through Helix-Pay.',
      requiresActivation: true,
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ];

  const defaultProps = {
    paymentMethods: mockPaymentMethods,
    selectedPaymentMethods: [],
    onChange: vi.fn(),
  };

  it('should render all provided payment methods', () => {
    render(<PaymentMethodSelector {...defaultProps} />);

    expect(screen.getByText('Pay Offline')).toBeInTheDocument();
    expect(screen.getByText('Pay By Card (Stripe)')).toBeInTheDocument();
    expect(screen.getByText('Pay By Card (Helix-Pay)')).toBeInTheDocument();
  });

  it('should display payment method descriptions', () => {
    render(<PaymentMethodSelector {...defaultProps} />);

    expect(screen.getByText('Payment instructions will be provided in the confirmation email.')).toBeInTheDocument();
    expect(screen.getByText('Accept card payments through Stripe.')).toBeInTheDocument();
    expect(screen.getByText('Accept card payments through Helix-Pay.')).toBeInTheDocument();
  });

  it('should indicate selected payment methods', () => {
    render(
      <PaymentMethodSelector
        {...defaultProps}
        selectedPaymentMethods={['pay-offline', 'stripe']}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked(); // pay-offline
    expect(checkboxes[1]).toBeChecked(); // stripe
    expect(checkboxes[2]).not.toBeChecked(); // helix-pay
  });

  it('should call onChange callback when checkbox is toggled', () => {
    const onChange = vi.fn();
    render(<PaymentMethodSelector {...defaultProps} onChange={onChange} />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Click pay-offline

    expect(onChange).toHaveBeenCalledWith(['pay-offline']);
  });

  it('should add payment method to selection when unchecked checkbox is clicked', () => {
    const onChange = vi.fn();
    render(
      <PaymentMethodSelector
        {...defaultProps}
        selectedPaymentMethods={['pay-offline']}
        onChange={onChange}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // Click stripe

    expect(onChange).toHaveBeenCalledWith(['pay-offline', 'stripe']);
  });

  it('should remove payment method from selection when checked checkbox is clicked', () => {
    const onChange = vi.fn();
    render(
      <PaymentMethodSelector
        {...defaultProps}
        selectedPaymentMethods={['pay-offline', 'stripe']}
        onChange={onChange}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Click pay-offline

    expect(onChange).toHaveBeenCalledWith(['stripe']);
  });

  it('should disable all checkboxes when disabled prop is true', () => {
    render(<PaymentMethodSelector {...defaultProps} disabled={true} />);

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((checkbox) => {
      expect(checkbox).toBeDisabled();
    });
  });

  it('should display activation requirement indicator for methods that require activation', () => {
    render(<PaymentMethodSelector {...defaultProps} />);

    const activationChips = screen.getAllByText('Requires Activation');
    expect(activationChips).toHaveLength(2); // stripe and helix-pay
  });

  it('should not display activation requirement indicator for methods that do not require activation', () => {
    render(<PaymentMethodSelector {...defaultProps} />);

    // Pay Offline should not have the "Requires Activation" chip
    const payOfflineSection = screen.getByText('Pay Offline').closest('div');
    expect(payOfflineSection).toBeInTheDocument();
    
    // Count total activation chips - should be 2 (not 3)
    const activationChips = screen.getAllByText('Requires Activation');
    expect(activationChips).toHaveLength(2);
  });

  it('should render with empty payment methods array', () => {
    render(
      <PaymentMethodSelector
        {...defaultProps}
        paymentMethods={[]}
      />
    );

    expect(screen.getByText('Payment Methods')).toBeInTheDocument();
    const checkboxes = screen.queryAllByRole('checkbox');
    expect(checkboxes).toHaveLength(0);
  });

  it('should handle payment methods without descriptions', () => {
    const methodsWithoutDesc: PaymentMethod[] = [
      {
        id: '1',
        name: 'test-method',
        displayName: 'Test Method',
        requiresActivation: false,
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ];

    render(
      <PaymentMethodSelector
        {...defaultProps}
        paymentMethods={methodsWithoutDesc}
      />
    );

    expect(screen.getByText('Test Method')).toBeInTheDocument();
  });
});
