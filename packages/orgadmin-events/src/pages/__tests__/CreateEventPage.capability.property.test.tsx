/**
 * Bug Condition Exploration Test - Capability-Based Discount Visibility
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * 
 * This test encodes the expected behavior:
 * - CreateEventPage should hide discount selector when organization lacks 'entry-discounts' capability
 * 
 * **Validates: Requirements 2.3**
 * 
 * Property 1: Fault Condition - Event Discount Selector Capability Check
 * 
 * For any organization that does NOT have the 'entry-discounts' capability enabled,
 * the CreateEventPage SHALL hide the discount selector section, preventing users
 * from seeing or interacting with discount functionality they cannot use.
 * 
 * **EXPECTED OUTCOME ON UNFIXED CODE**: These tests FAIL because the CreateEventPage
 * currently renders the DiscountSelector when discounts.length > 0, regardless of
 * whether the organization has the 'entry-discounts' capability.
 * 
 * **COUNTEREXAMPLES FOUND**:
 * - Organization with ['events'] capability: DiscountSelector is rendered (BUG)
 * - Organization with ['events', 'memberships'] capability: DiscountSelector is rendered (BUG)
 * - Organization with no capabilities: DiscountSelector is rendered (BUG)
 * 
 * The DiscountSelector component crashes with "Cannot read properties of undefined (reading 'map')"
 * because it's being rendered when it shouldn't be, proving the bug exists.
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
  DiscountSelector: vi.fn(({ discounts, selectedDiscounts, onChange, label }) => (
    <div data-testid="discount-selector">
      <label>{label}</label>
      <div>Discounts: {discounts.length}</div>
    </div>
  )),
}));

// Import the mocked DiscountSelector to track calls
import { DiscountSelector as MockedDiscountSelector } from '@aws-web-framework/components';

describe('CreateEventPage - Bug Condition Exploration', () => {
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
   * Property 1: Fault Condition - Event Discount Selector Capability Check
   * 
   * **Validates: Requirements 2.3**
   * 
   * This property tests the bug condition:
   * WHEN an organization does NOT have 'entry-discounts' capability
   * THEN the discount selector section SHALL be hidden
   * 
   * **EXPECTED OUTCOME ON UNFIXED CODE**: This test will FAIL because the
   * CreateEventPage currently shows the discount selector regardless of
   * whether the organization has the 'entry-discounts' capability.
   */
  it('Property 1: should hide discount selector when organization lacks entry-discounts capability', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate capability sets that do NOT include 'entry-discounts'
        fc.array(
          fc.constantFrom('events', 'memberships', 'forms', 'calendar', 'users'),
          { minLength: 0, maxLength: 3 }
        ),
        async (otherCapabilities) => {
          // Ensure 'entry-discounts' is NOT in the capabilities
          const capabilities = otherCapabilities.filter(cap => cap !== 'entry-discounts');
          
          // Mock hasCapability to return false for 'entry-discounts'
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

          // ASSERTION: DiscountSelector should NOT be rendered
          // This will FAIL on unfixed code because the component checks discounts.length > 0
          // instead of checking hasCapability('entry-discounts')
          expect(MockedDiscountSelector).not.toHaveBeenCalled();
        }
      ),
      {
        numRuns: 10, // Run 10 test cases with different capability combinations
        verbose: true,
      }
    );
  });

  /**
   * Concrete test case: Organization with only 'events' capability
   * 
   * This is a deterministic test that demonstrates the specific failing case
   * mentioned in the bug report.
   */
  it('Concrete case: should hide discount selector when organization has only events capability', async () => {
    // Organization has 'events' capability but NOT 'entry-discounts'
    mockHasCapability.mockImplementation((capability: string) => {
      return capability === 'events';
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

    // ASSERTION: DiscountSelector should NOT be rendered
    // This will FAIL on unfixed code - the DiscountSelector will be rendered
    expect(MockedDiscountSelector).not.toHaveBeenCalled();
  });

  /**
   * Concrete test case: Organization with multiple capabilities but not entry-discounts
   */
  it('Concrete case: should hide discount selector when organization has events and memberships but not entry-discounts', async () => {
    // Organization has multiple capabilities but NOT 'entry-discounts'
    mockHasCapability.mockImplementation((capability: string) => {
      return ['events', 'memberships'].includes(capability);
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

    // ASSERTION: DiscountSelector should NOT be rendered
    // This will FAIL on unfixed code
    expect(MockedDiscountSelector).not.toHaveBeenCalled();
  });

  /**
   * Concrete test case: Organization with no capabilities at all
   */
  it('Concrete case: should hide discount selector when organization has no capabilities', async () => {
    // Organization has NO capabilities
    mockHasCapability.mockReturnValue(false);

    renderComponent();

    // Wait for discounts to be loaded
    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/discounts/events'),
        })
      );
    }, { timeout: 3000 });

    // ASSERTION: DiscountSelector should NOT be rendered
    // This will FAIL on unfixed code
    expect(MockedDiscountSelector).not.toHaveBeenCalled();
  });
});
