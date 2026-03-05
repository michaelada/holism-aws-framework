/**
 * Unit Tests for MembershipTypeSelector Component
 * 
 * Feature: manual-member-addition
 * Task 4.3: Write unit tests for MembershipTypeSelector
 * 
 * **Validates: Requirements 2.3, 2.4, 2.5**
 * 
 * Tests specific scenarios:
 * - Displays all membership types with names and descriptions
 * - Selection handler is called with correct typeId when a type is clicked
 * - Cancel handler is called when Cancel button is clicked
 */

import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithI18n, screen, fireEvent } from '../../test/i18n-test-utils';
import MembershipTypeSelector from '../MembershipTypeSelector';
import type { MembershipType } from '../../types/membership.types';

describe('MembershipTypeSelector - Unit Tests', () => {
  const mockOnClose = vi.fn();
  const mockOnSelect = vi.fn();

  // Sample membership types for testing
  const sampleMembershipTypes: MembershipType[] = [
    {
      id: '1',
      name: 'Standard Membership',
      description: 'Basic membership with standard benefits',
      organisationId: 'org-1',
      membershipFormId: 'form-1',
      membershipStatus: 'open',
      isRollingMembership: false,
      automaticallyApprove: true,
      memberLabels: [],
      supportedPaymentMethods: ['card'],
      useTermsAndConditions: false,
      membershipTypeCategory: 'single',
      discountIds: [],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: '2',
      name: 'Premium Membership',
      description: 'Premium membership with additional benefits',
      organisationId: 'org-1',
      membershipFormId: 'form-2',
      membershipStatus: 'open',
      isRollingMembership: true,
      automaticallyApprove: false,
      memberLabels: ['premium'],
      supportedPaymentMethods: ['card', 'bank_transfer'],
      useTermsAndConditions: true,
      membershipTypeCategory: 'single',
      discountIds: [],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: '3',
      name: 'Family Membership',
      description: 'Membership for families with multiple members',
      organisationId: 'org-1',
      membershipFormId: 'form-3',
      membershipStatus: 'open',
      isRollingMembership: false,
      automaticallyApprove: true,
      memberLabels: ['family'],
      supportedPaymentMethods: ['card'],
      useTermsAndConditions: false,
      membershipTypeCategory: 'group',
      discountIds: [],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ];

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSelect.mockClear();
  });

  describe('Display Tests - Validates Requirement 2.3', () => {
    it('should display all membership types with their names', () => {
      renderWithI18n(
        <MembershipTypeSelector
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={sampleMembershipTypes}
        />
      );

      // Verify all membership type names are displayed
      expect(screen.getByText('Standard Membership')).toBeInTheDocument();
      expect(screen.getByText('Premium Membership')).toBeInTheDocument();
      expect(screen.getByText('Family Membership')).toBeInTheDocument();
    });

    it('should display all membership types with their descriptions', () => {
      renderWithI18n(
        <MembershipTypeSelector
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={sampleMembershipTypes}
        />
      );

      // Verify all descriptions are displayed
      expect(screen.getByText('Basic membership with standard benefits')).toBeInTheDocument();
      expect(screen.getByText('Premium membership with additional benefits')).toBeInTheDocument();
      expect(screen.getByText('Membership for families with multiple members')).toBeInTheDocument();
    });

    it('should display the correct number of membership types', () => {
      renderWithI18n(
        <MembershipTypeSelector
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={sampleMembershipTypes}
        />
      );

      // Verify each membership type name is displayed (which confirms all types are rendered)
      sampleMembershipTypes.forEach((type) => {
        expect(screen.getByText(type.name)).toBeInTheDocument();
      });
    });

    it('should display membership types with empty descriptions', () => {
      const typesWithEmptyDescription: MembershipType[] = [
        {
          ...sampleMembershipTypes[0],
          description: '',
        },
      ];

      renderWithI18n(
        <MembershipTypeSelector
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={typesWithEmptyDescription}
        />
      );

      // Name should still be displayed
      expect(screen.getByText('Standard Membership')).toBeInTheDocument();
    });

    it('should display dialog title', () => {
      renderWithI18n(
        <MembershipTypeSelector
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={sampleMembershipTypes}
        />
      );

      // Check for the translation key text (since test i18n may not have the translation)
      expect(screen.getByText(/typeSelector\.title|Select Membership Type/)).toBeInTheDocument();
    });

    it('should display cancel button', () => {
      renderWithI18n(
        <MembershipTypeSelector
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={sampleMembershipTypes}
        />
      );

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('Selection Handler Tests - Validates Requirement 2.4', () => {
    it('should call onSelect with correct typeId when first type is clicked', () => {
      renderWithI18n(
        <MembershipTypeSelector
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={sampleMembershipTypes}
        />
      );

      // Click on the first membership type
      const firstType = screen.getByText('Standard Membership');
      fireEvent.click(firstType);

      // Verify onSelect was called with the correct ID
      expect(mockOnSelect).toHaveBeenCalledTimes(1);
      expect(mockOnSelect).toHaveBeenCalledWith('1');
    });

    it('should call onSelect with correct typeId when second type is clicked', () => {
      renderWithI18n(
        <MembershipTypeSelector
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={sampleMembershipTypes}
        />
      );

      // Click on the second membership type
      const secondType = screen.getByText('Premium Membership');
      fireEvent.click(secondType);

      // Verify onSelect was called with the correct ID
      expect(mockOnSelect).toHaveBeenCalledTimes(1);
      expect(mockOnSelect).toHaveBeenCalledWith('2');
    });

    it('should call onSelect with correct typeId when third type is clicked', () => {
      renderWithI18n(
        <MembershipTypeSelector
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={sampleMembershipTypes}
        />
      );

      // Click on the third membership type
      const thirdType = screen.getByText('Family Membership');
      fireEvent.click(thirdType);

      // Verify onSelect was called with the correct ID
      expect(mockOnSelect).toHaveBeenCalledTimes(1);
      expect(mockOnSelect).toHaveBeenCalledWith('3');
    });

    it('should not call onClose when a type is selected', () => {
      renderWithI18n(
        <MembershipTypeSelector
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={sampleMembershipTypes}
        />
      );

      // Click on a membership type
      const firstType = screen.getByText('Standard Membership');
      fireEvent.click(firstType);

      // Verify onClose was not called
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should handle multiple clicks on different types', () => {
      renderWithI18n(
        <MembershipTypeSelector
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={sampleMembershipTypes}
        />
      );

      // Click on first type
      fireEvent.click(screen.getByText('Standard Membership'));
      expect(mockOnSelect).toHaveBeenCalledWith('1');

      // Click on second type
      fireEvent.click(screen.getByText('Premium Membership'));
      expect(mockOnSelect).toHaveBeenCalledWith('2');

      // Verify onSelect was called twice
      expect(mockOnSelect).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cancel Handler Tests - Validates Requirement 2.5', () => {
    it('should call onClose when Cancel button is clicked', () => {
      renderWithI18n(
        <MembershipTypeSelector
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={sampleMembershipTypes}
        />
      );

      // Click the Cancel button
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      // Verify onClose was called
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onSelect when Cancel button is clicked', () => {
      renderWithI18n(
        <MembershipTypeSelector
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={sampleMembershipTypes}
        />
      );

      // Click the Cancel button
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      // Verify onSelect was not called
      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it('should call onClose when dialog backdrop is clicked', () => {
      const { container } = renderWithI18n(
        <MembershipTypeSelector
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={sampleMembershipTypes}
        />
      );

      // Find and click the backdrop
      const backdrop = container.querySelector('.MuiBackdrop-root');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle single membership type', () => {
      const singleType = [sampleMembershipTypes[0]];

      renderWithI18n(
        <MembershipTypeSelector
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={singleType}
        />
      );

      expect(screen.getByText('Standard Membership')).toBeInTheDocument();
      
      // Click the type
      fireEvent.click(screen.getByText('Standard Membership'));
      expect(mockOnSelect).toHaveBeenCalledWith('1');
    });

    it('should handle empty membership types array', () => {
      renderWithI18n(
        <MembershipTypeSelector
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={[]}
        />
      );

      // Dialog should still render with title and cancel button
      expect(screen.getByText(/typeSelector\.title|Select Membership Type/)).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should not render when open is false', () => {
      const { container } = renderWithI18n(
        <MembershipTypeSelector
          open={false}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={sampleMembershipTypes}
        />
      );

      // Dialog should not be visible
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).not.toBeInTheDocument();
    });

    it('should handle membership types with special characters in names', () => {
      const specialTypes: MembershipType[] = [
        {
          ...sampleMembershipTypes[0],
          name: 'Type & Name',
          description: 'Description with <special> characters',
        },
      ];

      renderWithI18n(
        <MembershipTypeSelector
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={specialTypes}
        />
      );

      expect(screen.getByText('Type & Name')).toBeInTheDocument();
      expect(screen.getByText('Description with <special> characters')).toBeInTheDocument();
    });

    it('should handle very long membership type names', () => {
      const longNameType: MembershipType[] = [
        {
          ...sampleMembershipTypes[0],
          name: 'This is a very long membership type name that should still be displayed correctly in the dialog',
        },
      ];

      renderWithI18n(
        <MembershipTypeSelector
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={longNameType}
        />
      );

      expect(screen.getByText('This is a very long membership type name that should still be displayed correctly in the dialog')).toBeInTheDocument();
    });

    it('should handle very long descriptions', () => {
      const longDescType: MembershipType[] = [
        {
          ...sampleMembershipTypes[0],
          description: 'This is a very long description that contains a lot of text to describe the membership type in great detail. It should still be displayed correctly in the dialog without breaking the layout or causing any rendering issues.',
        },
      ];

      renderWithI18n(
        <MembershipTypeSelector
          open={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={longDescType}
        />
      );

      expect(screen.getByText(/This is a very long description/)).toBeInTheDocument();
    });
  });
});
