/**
 * Component tests for DiscountsListPage
 * 
 * Tests:
 * - Table rendering
 * - Filters (status, type, scope)
 * - Search functionality
 * - Pagination
 * - Action buttons (edit, activate/deactivate, delete, view stats)
 * - Delete confirmation dialog
 * 
 * **Validates: Requirements 10.1-10.9**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DiscountsListPage from '../DiscountsListPage';
import * as useApiModule from '@aws-web-framework/orgadmin-core';
import type { Discount } from '../../types/discount.types';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockDiscounts: Discount[] = [
  {
    id: '1',
    organisationId: 'org-1',
    moduleType: 'events',
    name: 'Early Bird Discount',
    description: '10% off for early registrations',
    code: 'EARLY10',
    discountType: 'percentage',
    discountValue: 10,
    applicationScope: 'item',
    status: 'active',
    combinable: true,
    priority: 1,
    usageLimits: {
      totalUsageLimit: 100,
      currentUsageCount: 25,
    },
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
  },
  {
    id: '2',
    organisationId: 'org-1',
    moduleType: 'events',
    name: 'Group Discount',
    description: 'Fixed amount off for groups',
    discountType: 'fixed',
    discountValue: 50,
    applicationScope: 'cart',
    status: 'inactive',
    combinable: false,
    priority: 2,
    usageLimits: {
      currentUsageCount: 0,
    },
    createdAt: new Date('2024-01-20T10:00:00Z'),
    updatedAt: new Date('2024-01-20T10:00:00Z'),
  },
  {
    id: '3',
    organisationId: 'org-1',
    moduleType: 'events',
    name: 'Quantity Discount',
    description: 'Buy 2 get 1 free',
    code: 'BUY2GET1',
    discountType: 'percentage',
    discountValue: 33.33,
    applicationScope: 'quantity-based',
    status: 'expired',
    combinable: true,
    priority: 0,
    usageLimits: {
      totalUsageLimit: 50,
      currentUsageCount: 50,
    },
    createdAt: new Date('2024-01-10T10:00:00Z'),
    updatedAt: new Date('2024-01-10T10:00:00Z'),
  },
];

describe('DiscountsListPage', () => {
  const mockExecute = vi.fn();
  const mockOrganisation = { id: 'org-1', name: 'Test Organisation' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    
    // Setup default mock implementations
    vi.mocked(useApiModule.useApi).mockReturnValue({
      execute: mockExecute,
      data: null,
      error: null,
      loading: false,
      reset: vi.fn(),
    });

    vi.mocked(useApiModule.useOrganisation).mockReturnValue({
      organisation: mockOrganisation,
      setOrganisation: vi.fn(),
    });
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <DiscountsListPage />
      </BrowserRouter>
    );
  };

  describe('Table Rendering', () => {
    it('should render the page title and create button', () => {
      mockExecute.mockResolvedValue([]);
      renderComponent();

      expect(screen.getByText('Event Discounts')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create discount/i })).toBeInTheDocument();
    });

    it('should load and display discounts on mount', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/organisations/org-1/discounts/events',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
        expect(screen.getByText('Group Discount')).toBeInTheDocument();
        expect(screen.getByText('Quantity Discount')).toBeInTheDocument();
      });
    });

    it('should display loading state while fetching discounts', () => {
      mockExecute.mockImplementation(() => new Promise(() => {})); // Never resolves
      renderComponent();

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should display empty state when no discounts exist', async () => {
      mockExecute.mockResolvedValue([]);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no discounts yet/i)).toBeInTheDocument();
      });
    });

    it('should display discount codes when present', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Code: EARLY10')).toBeInTheDocument();
        expect(screen.getByText('Code: BUY2GET1')).toBeInTheDocument();
      });
    });

    it('should display discount types with chips', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        const percentageChips = screen.getAllByText('Percentage');
        const fixedChips = screen.getAllByText('Fixed Amount');
        
        expect(percentageChips).toHaveLength(2);
        expect(fixedChips).toHaveLength(1);
      });
    });

    it('should format discount values correctly', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      // Wait for all discounts to load
      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
        expect(screen.getByText('Group Discount')).toBeInTheDocument();
        expect(screen.getByText('Quantity Discount')).toBeInTheDocument();
      });

      // Check percentage values
      expect(screen.getByText('10%')).toBeInTheDocument();
      expect(screen.getByText('33.33%')).toBeInTheDocument();
      
      // Check fixed value - it should be in the document somewhere
      const allText = document.body.textContent || '';
      expect(allText).toContain('50.00');
    });

    it('should display application scopes', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Item')).toBeInTheDocument();
        expect(screen.getByText('Cart')).toBeInTheDocument();
        expect(screen.getByText('Quantity Based')).toBeInTheDocument();
      });
    });

    it('should display status chips with correct colors', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        const activeChips = screen.getAllByText('active');
        const inactiveChips = screen.getAllByText('inactive');
        const expiredChips = screen.getAllByText('expired');
        
        expect(activeChips).toHaveLength(1);
        expect(inactiveChips).toHaveLength(1);
        expect(expiredChips).toHaveLength(1);
      });
    });

    it('should display usage counts', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('25 / 100')).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
        expect(screen.getByText('50 / 50')).toBeInTheDocument();
      });
    });
  });

  describe('Filters', () => {
    it('should filter discounts by status', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      // Find all comboboxes and get the first one (Status filter)
      const selects = screen.getAllByRole('combobox');
      const statusSelect = selects[0]; // First select is Status
      
      fireEvent.mouseDown(statusSelect);
      
      // Select 'active' status
      const activeOption = await screen.findByRole('option', { name: 'Active' });
      fireEvent.click(activeOption);

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
        expect(screen.queryByText('Group Discount')).not.toBeInTheDocument();
        expect(screen.queryByText('Quantity Discount')).not.toBeInTheDocument();
      });
    });

    it('should filter discounts by type', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      // Find all comboboxes and get the second one (Type filter)
      const selects = screen.getAllByRole('combobox');
      const typeSelect = selects[1]; // Second select is Type
      
      fireEvent.mouseDown(typeSelect);
      
      // Select 'fixed' type
      const fixedOption = await screen.findByRole('option', { name: 'Fixed Amount' });
      fireEvent.click(fixedOption);

      await waitFor(() => {
        expect(screen.getByText('Group Discount')).toBeInTheDocument();
        expect(screen.queryByText('Early Bird Discount')).not.toBeInTheDocument();
        expect(screen.queryByText('Quantity Discount')).not.toBeInTheDocument();
      });
    });

    it('should filter discounts by scope', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      // Find all comboboxes and get the third one (Scope filter)
      const selects = screen.getAllByRole('combobox');
      const scopeSelect = selects[2]; // Third select is Scope
      
      fireEvent.mouseDown(scopeSelect);
      
      // Select 'cart' scope
      const cartOption = await screen.findByRole('option', { name: 'Cart' });
      fireEvent.click(cartOption);

      await waitFor(() => {
        expect(screen.getByText('Group Discount')).toBeInTheDocument();
        expect(screen.queryByText('Early Bird Discount')).not.toBeInTheDocument();
        expect(screen.queryByText('Quantity Discount')).not.toBeInTheDocument();
      });
    });

    it('should reset to first page when filters change', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      // Apply a filter
      const selects = screen.getAllByRole('combobox');
      const statusSelect = selects[0]; // First select is Status
      
      fireEvent.mouseDown(statusSelect);
      const activeOption = await screen.findByRole('option', { name: 'Active' });
      fireEvent.click(activeOption);

      // Verify pagination reset (page should be 0)
      await waitFor(() => {
        const pagination = screen.getByText(/1–1 of 1/);
        expect(pagination).toBeInTheDocument();
      });
    });
  });

  describe('Search', () => {
    it('should filter discounts by name', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search by name, description, or code...');
      fireEvent.change(searchInput, { target: { value: 'Early' } });

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
        expect(screen.queryByText('Group Discount')).not.toBeInTheDocument();
        expect(screen.queryByText('Quantity Discount')).not.toBeInTheDocument();
      });
    });

    it('should filter discounts by description', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search by name, description, or code...');
      fireEvent.change(searchInput, { target: { value: 'groups' } });

      await waitFor(() => {
        expect(screen.getByText('Group Discount')).toBeInTheDocument();
        expect(screen.queryByText('Early Bird Discount')).not.toBeInTheDocument();
        expect(screen.queryByText('Quantity Discount')).not.toBeInTheDocument();
      });
    });

    it('should filter discounts by code', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search by name, description, or code...');
      fireEvent.change(searchInput, { target: { value: 'BUY2GET1' } });

      await waitFor(() => {
        expect(screen.getByText('Quantity Discount')).toBeInTheDocument();
        expect(screen.queryByText('Early Bird Discount')).not.toBeInTheDocument();
        expect(screen.queryByText('Group Discount')).not.toBeInTheDocument();
      });
    });

    it('should be case-insensitive when searching', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search by name, description, or code...');
      fireEvent.change(searchInput, { target: { value: 'EARLY' } });

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });
    });

    it('should show "no matching discounts" message when search returns no results', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search by name, description, or code...');
      fireEvent.change(searchInput, { target: { value: 'NonexistentDiscount' } });

      await waitFor(() => {
        expect(screen.getByText('No matching discounts found')).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('should display pagination controls', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      // Check pagination is present
      expect(screen.getByText(/1–3 of 3/)).toBeInTheDocument();
    });

    it('should change rows per page', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      // Find and click the rows per page dropdown
      const rowsPerPageButton = screen.getByRole('combobox', { name: /rows per page/i });
      fireEvent.mouseDown(rowsPerPageButton);

      // Select 25 rows per page
      const option25 = await screen.findByRole('option', { name: '25' });
      fireEvent.click(option25);

      await waitFor(() => {
        expect(screen.getByText(/1–3 of 3/)).toBeInTheDocument();
      });
    });

    it('should paginate when there are more than 50 items', async () => {
      // Create 60 mock discounts
      const manyDiscounts = Array.from({ length: 60 }, (_, i) => ({
        ...mockDiscounts[0],
        id: `discount-${i}`,
        name: `Discount ${i}`,
      }));

      mockExecute.mockResolvedValue(manyDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Discount 0')).toBeInTheDocument();
      });

      // Check pagination shows correct range
      expect(screen.getByText(/1–50 of 60/)).toBeInTheDocument();

      // Navigate to next page
      const nextButton = screen.getByRole('button', { name: /next page/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/51–60 of 60/)).toBeInTheDocument();
      });
    });
  });

  describe('Action Buttons', () => {
    it('should navigate to create page when create button is clicked', () => {
      mockExecute.mockResolvedValue([]);
      renderComponent();

      const createButton = screen.getByRole('button', { name: /create discount/i });
      fireEvent.click(createButton);

      expect(mockNavigate).toHaveBeenCalledWith('/events/discounts/new');
    });

    it('should navigate to edit page when edit button is clicked', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      // Wait for edit buttons to be rendered
      await waitFor(() => {
        const editIcons = screen.getAllByTestId('EditIcon');
        expect(editIcons.length).toBeGreaterThan(0);
      });

      const editIcons = screen.getAllByTestId('EditIcon');
      const editButton = editIcons[0].closest('button');
      if (editButton) {
        fireEvent.click(editButton);
      }

      expect(mockNavigate).toHaveBeenCalledWith('/events/discounts/1/edit');
    });

    it('should toggle discount status when activate/deactivate button is clicked', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      // Wait for toggle buttons to be rendered
      await waitFor(() => {
        const toggleIcons = screen.getAllByTestId('ToggleOffIcon');
        expect(toggleIcons.length).toBeGreaterThan(0);
      });

      // Click deactivate button on active discount
      const toggleIcons = screen.getAllByTestId('ToggleOffIcon');
      const toggleButton = toggleIcons[0].closest('button');
      if (toggleButton) {
        fireEvent.click(toggleButton);
      }

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'PUT',
          url: '/api/orgadmin/discounts/1',
          data: { status: 'inactive' },
        });
      });
    });

    it('should activate inactive discount when activate button is clicked', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Group Discount')).toBeInTheDocument();
      });

      // Wait for toggle buttons to be rendered
      await waitFor(() => {
        const toggleIcons = screen.getAllByTestId('ToggleOnIcon');
        expect(toggleIcons.length).toBeGreaterThan(0);
      });

      // Click activate button on inactive discount
      const toggleIcons = screen.getAllByTestId('ToggleOnIcon');
      const toggleButton = toggleIcons[0].closest('button');
      if (toggleButton) {
        fireEvent.click(toggleButton);
      }

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'PUT',
          url: '/api/orgadmin/discounts/2',
          data: { status: 'active' },
        });
      });
    });

    it('should disable activate/deactivate button for expired discounts', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Quantity Discount')).toBeInTheDocument();
      });

      // Find the row with expired discount
      const expiredRow = screen.getByText('Quantity Discount').closest('tr');
      expect(expiredRow).toBeTruthy();
      
      // Find all buttons in the row
      const buttons = expiredRow?.querySelectorAll('button');
      
      // Find the toggle button (should be the second button - Edit, Toggle, Stats, Delete)
      const toggleButton = Array.from(buttons || []).find(btn => 
        btn.querySelector('[data-testid="ToggleOnIcon"], [data-testid="ToggleOffIcon"]')
      );
      
      expect(toggleButton).toBeTruthy();
      expect(toggleButton).toBeDisabled();
    });

    it('should navigate to stats page when view stats button is clicked', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      // Wait for stats buttons to be rendered
      await waitFor(() => {
        const statsIcons = screen.getAllByTestId('AssessmentIcon');
        expect(statsIcons.length).toBeGreaterThan(0);
      });

      const statsIcons = screen.getAllByTestId('AssessmentIcon');
      const statsButton = statsIcons[0].closest('button');
      if (statsButton) {
        fireEvent.click(statsButton);
      }

      expect(mockNavigate).toHaveBeenCalledWith('/events/discounts/1/stats');
    });
  });

  describe('Delete Confirmation', () => {
    it('should open delete confirmation dialog when delete button is clicked', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      // Wait for table to be fully rendered with action buttons
      await waitFor(() => {
        const deleteIcons = screen.getAllByTestId('DeleteIcon');
        expect(deleteIcons.length).toBeGreaterThan(0);
      });

      // Click delete button - find all delete icons and click the first one's parent button
      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      const deleteButton = deleteIcons[0].closest('button');
      if (deleteButton) {
        fireEvent.click(deleteButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Delete Discount')).toBeInTheDocument();
        expect(screen.getByText(/are you sure you want to delete the discount "Early Bird Discount"/i)).toBeInTheDocument();
        expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
      });
    });

    it('should close delete dialog when cancel is clicked', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      // Wait for table to be fully rendered with action buttons
      await waitFor(() => {
        const deleteIcons = screen.getAllByTestId('DeleteIcon');
        expect(deleteIcons.length).toBeGreaterThan(0);
      });

      // Open delete dialog - find all delete icons and click the first one's parent button
      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      const deleteButton = deleteIcons[0].closest('button');
      if (deleteButton) {
        fireEvent.click(deleteButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Delete Discount')).toBeInTheDocument();
      });

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Delete Discount')).not.toBeInTheDocument();
      });
    });

    it('should delete discount when confirmed', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      // Wait for table to be fully rendered with action buttons
      await waitFor(() => {
        const deleteIcons = screen.getAllByTestId('DeleteIcon');
        expect(deleteIcons.length).toBeGreaterThan(0);
      });

      // Open delete dialog - find all delete icons and click the first one's parent button
      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      const deleteIconButton = deleteIcons[0].closest('button');
      if (deleteIconButton) {
        fireEvent.click(deleteIconButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Delete Discount')).toBeInTheDocument();
      });

      // Confirm delete
      const confirmDeleteButton = screen.getByRole('button', { name: /^delete$/i });
      fireEvent.click(confirmDeleteButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'DELETE',
          url: '/api/orgadmin/discounts/1',
        });
      });
    });

    it('should reload discounts after successful deletion', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      // Wait for table to be fully rendered with action buttons
      await waitFor(() => {
        const deleteIcons = screen.getAllByTestId('DeleteIcon');
        expect(deleteIcons.length).toBeGreaterThan(0);
      });

      // Clear previous calls
      mockExecute.mockClear();

      // Open delete dialog - find all delete icons and click the first one's parent button
      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      const deleteIconButton = deleteIcons[0].closest('button');
      if (deleteIconButton) {
        fireEvent.click(deleteIconButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Delete Discount')).toBeInTheDocument();
      });

      // Confirm delete
      mockExecute.mockResolvedValueOnce(undefined); // DELETE response
      mockExecute.mockResolvedValueOnce(mockDiscounts.slice(1)); // GET response after delete

      const confirmDeleteButton = screen.getByRole('button', { name: /^delete$/i });
      fireEvent.click(confirmDeleteButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'DELETE',
          url: '/api/orgadmin/discounts/1',
        });
      });

      // Verify reload was called
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/organisations/org-1/discounts/events',
        });
      });
    });

    it('should display error message when delete fails', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      // Wait for table to be fully rendered with action buttons
      await waitFor(() => {
        const deleteIcons = screen.getAllByTestId('DeleteIcon');
        expect(deleteIcons.length).toBeGreaterThan(0);
      });

      // Open delete dialog - find all delete icons and click the first one's parent button
      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      const deleteIconButton = deleteIcons[0].closest('button');
      if (deleteIconButton) {
        fireEvent.click(deleteIconButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Delete Discount')).toBeInTheDocument();
      });

      // Mock delete failure
      mockExecute.mockRejectedValueOnce(new Error('Delete failed'));

      const confirmDeleteButton = screen.getByRole('button', { name: /^delete$/i });
      fireEvent.click(confirmDeleteButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to delete discount/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully when loading discounts', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExecute.mockRejectedValue(new Error('API Error'));
      
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Failed to load discounts')).toBeInTheDocument();
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should set empty array when API returns null', async () => {
      mockExecute.mockResolvedValue(null);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no discounts yet/i)).toBeInTheDocument();
      });
    });

    it('should display error message when status toggle fails', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      // Wait for table to be fully rendered with action buttons
      await waitFor(() => {
        const toggleIcons = screen.getAllByTestId('ToggleOffIcon');
        expect(toggleIcons.length).toBeGreaterThan(0);
      });

      // Mock status toggle failure
      mockExecute.mockRejectedValueOnce(new Error('Update failed'));

      // Click deactivate button - find all toggle off icons and click the first one's parent button
      const toggleIcons = screen.getAllByTestId('ToggleOffIcon');
      const toggleButton = toggleIcons[0].closest('button');
      if (toggleButton) {
        fireEvent.click(toggleButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Failed to update discount status')).toBeInTheDocument();
      });
    });

    it('should close error alert when close button is clicked', async () => {
      mockExecute.mockRejectedValue(new Error('API Error'));
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Failed to load discounts')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Failed to load discounts')).not.toBeInTheDocument();
      });
    });
  });

  describe('Combined Filters and Search', () => {
    it('should combine search and status filters', async () => {
      mockExecute.mockResolvedValue(mockDiscounts);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
      });

      // Set status filter to active - use a more specific query
      const statusSelects = screen.getAllByRole('combobox');
      const statusSelect = statusSelects.find(select => 
        select.closest('.MuiFormControl-root')?.querySelector('label')?.textContent === 'Status'
      );
      
      if (statusSelect) {
        fireEvent.mouseDown(statusSelect);
        const activeOption = await screen.findByRole('option', { name: 'Active' });
        fireEvent.click(activeOption);
      }

      // Set search term
      const searchInput = screen.getByPlaceholderText('Search by name, description, or code...');
      fireEvent.change(searchInput, { target: { value: 'Early' } });

      await waitFor(() => {
        expect(screen.getByText('Early Bird Discount')).toBeInTheDocument();
        expect(screen.queryByText('Group Discount')).not.toBeInTheDocument();
        expect(screen.queryByText('Quantity Discount')).not.toBeInTheDocument();
      });
    });
  });
});
