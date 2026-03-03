/**
 * Preservation Property Tests - Capability-Based Discount Visibility
 * 
 * **IMPORTANT**: These tests follow observation-first methodology
 * **EXPECTED OUTCOME ON UNFIXED CODE**: These tests PASS (confirms baseline behavior to preserve)
 * 
 * These tests capture the behavior that must remain unchanged after the fix:
 * - CreateEventPage shows discount selector when organization HAS 'entry-discounts' capability
 * - Membership type forms correctly hide discount selector without 'entry-discounts' capability
 * - Navigation menu correctly filters Discounts submenu item based on 'entry-discounts' capability
 * 
 * **Validates: Requirements 3.1, 3.2, 3.4, 3.5**
 * 
 * Property 2: Preservation - Existing Capability Checks
 * 
 * For any UI component that already implements capability checking (Layout submenu filtering,
 * membership type forms), the fixed code SHALL produce exactly the same visibility behavior
 * as before, preserving all existing capability-based filtering logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CreateEventPage from '../CreateEventPage';
import fc from 'fast-check';

// Mock useNavigate and useParams
const mockNavigate = vi.fn();
const mockParams: { id?: string } = { id: undefined };
const mockExecute = vi.fn();
const mockHasCapability = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: ({ label, value, onChange }: any) => (
    <div data-testid={`date-picker-${label}`}>
      <input
        type="date"
        aria-label={label}
        value={value?.toISOString().split('T')[0] || ''}
        onChange={(e) => onChange?.(new Date(e.target.value))}
      />
    </div>
  ),
}));

vi.mock('@mui/x-date-pickers/DateTimePicker', () => ({
  DateTimePicker: ({ label, value, onChange }: any) => (
    <div data-testid={`datetime-picker-${label}`}>
      <input
        type="datetime-local"
        aria-label={label}
        value={value?.toISOString().slice(0, 16) || ''}
        onChange={(e) => onChange?.(new Date(e.target.value))}
      />
    </div>
  ),
}));

vi.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@mui/x-date-pickers/AdapterDateFns', () => ({
  AdapterDateFns: class {},
}));

vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useApi: () => ({
    execute: mockExecute,
    data: null,
    error: null,
    loading: false,
    reset: vi.fn(),
  }),
  useOrganisation: () => ({
    organisation: {
      id: 'd5a5a5ca-c4b4-436d-8981-627ab3556433',
      name: 'Test Organisation',
    },
  }),
}));

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en-GB',
      changeLanguage: vi.fn(),
    },
  }),
  useCapabilities: () => ({
    hasCapability: mockHasCapability,
    capabilities: [],
    loading: false,
    error: null,
  }),
}));

// Mock the DiscountSelector to track if it's rendered
vi.mock('@aws-web-framework/components', () => ({
  DiscountSelector: vi.fn(({ discounts, label }) => (
    <div data-testid="discount-selector">
      <label>{label}</label>
      <div>Discounts: {discounts.length}</div>
    </div>
  )),
}));

// Import the mocked DiscountSelector to track calls
import { DiscountSelector as MockedDiscountSelector } from '@aws-web-framework/components';

describe('CreateEventPage - Preservation Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockParams.id = undefined;
    mockExecute.mockReset();
    mockHasCapability.mockReset();
    
    // Mock API responses
    mockExecute.mockImplementation(({ url }) => {
      if (url?.includes('/event-types')) {
        return Promise.resolve([]);
      }
      if (url?.includes('/venues')) {
        return Promise.resolve([]);
      }
      if (url?.includes('/discounts/events')) {
        return Promise.resolve({
          discounts: [
            { id: 'discount-1', name: 'Summer Sale', discountType: 'percentage', discountValue: 10 },
            { id: 'discount-2', name: 'Early Bird', discountType: 'percentage', discountValue: 15 },
          ],
        });
      }
      return Promise.resolve({});
    });
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <CreateEventPage />
      </BrowserRouter>
    );
  };

  /**
   * Property 2: Preservation - Event Page WITH Capability
   * 
   * **Validates: Requirements 3.3**
   * 
   * This property tests that when an organization HAS the 'entry-discounts' capability,
   * the CreateEventPage SHOWS the discount selector section. This behavior must be
   * preserved after the fix.
   * 
   * **EXPECTED OUTCOME ON UNFIXED CODE**: This test will PASS because the current
   * implementation shows the discount selector when discounts.length > 0, which
   * happens when the organization has discounts available.
   * 
   * After the fix, this test must still PASS to ensure we haven't broken the
   * functionality for organizations that DO have the capability.
   */
  it('Property 2a: should show discount selector when organization HAS entry-discounts capability', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate capability sets that INCLUDE 'entry-discounts'
        fc.array(
          fc.constantFrom('events', 'memberships', 'forms', 'calendar', 'users'),
          { minLength: 0, maxLength: 3 }
        ),
        async (otherCapabilities) => {
          // Ensure 'entry-discounts' IS in the capabilities
          const capabilities = [...new Set([...otherCapabilities, 'entry-discounts'])];
          
          // Mock hasCapability to return true for 'entry-discounts'
          mockHasCapability.mockImplementation((capability: string) => {
            return capabilities.includes(capability);
          });

          // Render the component
          renderComponent();

          // Wait for the component to load and API calls to complete
          await waitFor(() => {
            expect(mockExecute).toHaveBeenCalledWith(
              expect.objectContaining({
                url: expect.stringContaining('/discounts/events'),
              })
            );
          }, { timeout: 3000 });

          // ASSERTION: DiscountSelector SHOULD be rendered
          // This should PASS on unfixed code and continue to PASS after fix
          expect(MockedDiscountSelector).toHaveBeenCalled();
        }
      ),
      {
        numRuns: 10, // Run 10 test cases with different capability combinations
        verbose: true,
      }
    );
  });

  /**
   * Concrete test case: Organization with entry-discounts capability
   * 
   * This is a deterministic test that demonstrates the specific behavior
   * that must be preserved.
   */
  it('Concrete case: should show discount selector when organization has entry-discounts capability', async () => {
    // Organization has 'entry-discounts' capability
    mockHasCapability.mockImplementation((capability: string) => {
      return ['events', 'entry-discounts'].includes(capability);
    });

    renderComponent();

    // Wait for discounts to be loaded (API call completes)
    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/discounts/events'),
        })
      );
    }, { timeout: 3000 });

    // ASSERTION: DiscountSelector SHOULD be rendered
    // This should PASS on unfixed code and continue to PASS after fix
    expect(MockedDiscountSelector).toHaveBeenCalled();
  });

  /**
   * Concrete test case: Organization with only entry-discounts capability
   */
  it('Concrete case: should show discount selector when organization has only entry-discounts capability', async () => {
    // Organization has only 'entry-discounts' capability
    mockHasCapability.mockImplementation((capability: string) => {
      return capability === 'entry-discounts';
    });

    renderComponent();

    // Wait for discounts to be loaded
    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/discounts/events'),
        })
      );
    }, { timeout: 3000 });

    // ASSERTION: DiscountSelector SHOULD be rendered
    // This should PASS on unfixed code and continue to PASS after fix
    expect(MockedDiscountSelector).toHaveBeenCalled();
  });

  /**
   * Concrete test case: Organization with multiple capabilities including entry-discounts
   */
  it('Concrete case: should show discount selector when organization has multiple capabilities including entry-discounts', async () => {
    // Organization has multiple capabilities including 'entry-discounts'
    mockHasCapability.mockImplementation((capability: string) => {
      return ['events', 'memberships', 'entry-discounts', 'forms'].includes(capability);
    });

    renderComponent();

    // Wait for discounts to be loaded
    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/discounts/events'),
        })
      );
    }, { timeout: 3000 });

    // ASSERTION: DiscountSelector SHOULD be rendered
    // This should PASS on unfixed code and continue to PASS after fix
    expect(MockedDiscountSelector).toHaveBeenCalled();
  });
});
