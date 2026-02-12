/**
 * Unit tests for FormsListPage component
 * Tests form list rendering, filtering, and search functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import FormsListPage from '../FormsListPage';
import * as useApiModule from '../../../hooks/useApi';

// Mock the useApi hook
vi.mock('../../../hooks/useApi');

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockForms = [
  {
    id: '1',
    name: 'Event Registration Form',
    description: 'Form for event registrations',
    status: 'published' as const,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    name: 'Membership Application',
    description: 'Form for membership applications',
    status: 'draft' as const,
    createdAt: '2024-01-20T10:00:00Z',
    updatedAt: '2024-01-20T10:00:00Z',
  },
  {
    id: '3',
    name: 'Volunteer Sign-up',
    description: 'Form for volunteer registrations',
    status: 'published' as const,
    createdAt: '2024-01-25T10:00:00Z',
    updatedAt: '2024-01-25T10:00:00Z',
  },
];

describe('FormsListPage', () => {
  const mockExecute = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    
    // Setup default mock implementation
    vi.mocked(useApiModule.useApi).mockReturnValue({
      execute: mockExecute,
      data: null,
      error: null,
      loading: false,
      reset: vi.fn(),
    });
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <FormsListPage />
      </BrowserRouter>
    );
  };

  describe('Form List Rendering', () => {
    it('should render the page title and create button', () => {
      mockExecute.mockResolvedValue([]);
      renderComponent();

      expect(screen.getByText('Application Forms')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create form/i })).toBeInTheDocument();
    });

    it('should load and display forms on mount', async () => {
      mockExecute.mockResolvedValue(mockForms);
      renderComponent();

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/application-forms',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Event Registration Form')).toBeInTheDocument();
        expect(screen.getByText('Membership Application')).toBeInTheDocument();
        expect(screen.getByText('Volunteer Sign-up')).toBeInTheDocument();
      });
    });

    it('should display loading state while fetching forms', () => {
      mockExecute.mockImplementation(() => new Promise(() => {})); // Never resolves
      renderComponent();

      expect(screen.getByText('Loading forms...')).toBeInTheDocument();
    });

    it('should display empty state when no forms exist', async () => {
      mockExecute.mockResolvedValue([]);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no forms yet/i)).toBeInTheDocument();
      });
    });

    it('should display form status chips with correct colors', async () => {
      mockExecute.mockResolvedValue(mockForms);
      renderComponent();

      await waitFor(() => {
        const publishedChips = screen.getAllByText('published');
        const draftChips = screen.getAllByText('draft');
        
        expect(publishedChips).toHaveLength(2);
        expect(draftChips).toHaveLength(1);
      });
    });

    it('should format dates correctly', async () => {
      mockExecute.mockResolvedValue(mockForms);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('15 Jan 2024')).toBeInTheDocument();
        expect(screen.getByText('20 Jan 2024')).toBeInTheDocument();
        expect(screen.getByText('25 Jan 2024')).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filtering', () => {
    it('should filter forms by search term in name', async () => {
      mockExecute.mockResolvedValue(mockForms);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Event Registration Form')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search forms...');
      fireEvent.change(searchInput, { target: { value: 'Event' } });

      await waitFor(() => {
        expect(screen.getByText('Event Registration Form')).toBeInTheDocument();
        expect(screen.queryByText('Membership Application')).not.toBeInTheDocument();
        expect(screen.queryByText('Volunteer Sign-up')).not.toBeInTheDocument();
      });
    });

    it('should filter forms by search term in description', async () => {
      mockExecute.mockResolvedValue(mockForms);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Event Registration Form')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search forms...');
      fireEvent.change(searchInput, { target: { value: 'volunteer' } });

      await waitFor(() => {
        expect(screen.getByText('Volunteer Sign-up')).toBeInTheDocument();
        expect(screen.queryByText('Event Registration Form')).not.toBeInTheDocument();
        expect(screen.queryByText('Membership Application')).not.toBeInTheDocument();
      });
    });

    it('should filter forms by status', async () => {
      mockExecute.mockResolvedValue(mockForms);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Event Registration Form')).toBeInTheDocument();
      });

      const statusSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(statusSelect);
      
      const draftOption = await screen.findByRole('option', { name: /draft/i });
      fireEvent.click(draftOption);

      await waitFor(() => {
        expect(screen.getByText('Membership Application')).toBeInTheDocument();
        expect(screen.queryByText('Event Registration Form')).not.toBeInTheDocument();
        expect(screen.queryByText('Volunteer Sign-up')).not.toBeInTheDocument();
      });
    });

    it('should combine search and status filters', async () => {
      mockExecute.mockResolvedValue(mockForms);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Event Registration Form')).toBeInTheDocument();
      });

      // Set status filter to published
      const statusSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(statusSelect);
      const publishedOption = await screen.findByRole('option', { name: /published/i });
      fireEvent.click(publishedOption);

      // Set search term
      const searchInput = screen.getByPlaceholderText('Search forms...');
      fireEvent.change(searchInput, { target: { value: 'Event' } });

      await waitFor(() => {
        expect(screen.getByText('Event Registration Form')).toBeInTheDocument();
        expect(screen.queryByText('Membership Application')).not.toBeInTheDocument();
        expect(screen.queryByText('Volunteer Sign-up')).not.toBeInTheDocument();
      });
    });

    it('should show "no forms match" message when filters return no results', async () => {
      mockExecute.mockResolvedValue(mockForms);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Event Registration Form')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search forms...');
      fireEvent.change(searchInput, { target: { value: 'NonexistentForm' } });

      await waitFor(() => {
        expect(screen.getByText(/no forms match your filters/i)).toBeInTheDocument();
      });
    });

    it('should be case-insensitive when searching', async () => {
      mockExecute.mockResolvedValue(mockForms);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Event Registration Form')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search forms...');
      fireEvent.change(searchInput, { target: { value: 'MEMBERSHIP' } });

      await waitFor(() => {
        expect(screen.getByText('Membership Application')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to create form page when create button is clicked', async () => {
      mockExecute.mockResolvedValue([]);
      renderComponent();

      const createButton = screen.getByRole('button', { name: /create form/i });
      fireEvent.click(createButton);

      expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/forms/new');
    });

    it('should navigate to edit page when edit button is clicked', async () => {
      mockExecute.mockResolvedValue(mockForms);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Event Registration Form')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit');
      fireEvent.click(editButtons[0]);

      expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/forms/1/edit');
    });

    it('should navigate to preview page when preview button is clicked', async () => {
      mockExecute.mockResolvedValue(mockForms);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Event Registration Form')).toBeInTheDocument();
      });

      const previewButtons = screen.getAllByTitle('Preview');
      fireEvent.click(previewButtons[0]);

      expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/forms/1/preview');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExecute.mockRejectedValue(new Error('API Error'));
      
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no forms yet/i)).toBeInTheDocument();
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should set empty array when API returns null', async () => {
      mockExecute.mockResolvedValue(null);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no forms yet/i)).toBeInTheDocument();
      });
    });
  });
});
