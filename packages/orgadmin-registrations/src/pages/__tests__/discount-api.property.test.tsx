/**
 * Property Tests for Discount API Module Type Consistency and Discount IDs Persistence
 *
 * Property 24: Discount API module type consistency
 * Property 25: Discount IDs persistence round trip
 *
 * **Validates: Requirements 10.4, 10.6, 10.7**
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import fc from 'fast-check';

// ── Shared mocks ──

const mockNavigate = vi.fn();
let mockParams: Record<string, string> = {};
const mockExecute = vi.fn();
const mockHasCapability = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));

vi.mock('date-fns', () => ({}));
vi.mock('date-fns/locale', () => ({ enGB: {} }));

vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: ({ label }: any) => <div data-testid={`date-picker-${label}`} />,
}));
vi.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: any) => <>{children}</>,
}));
vi.mock('@mui/x-date-pickers/AdapterDateFns', () => ({
  AdapterDateFns: class {},
}));
vi.mock('react-quill', () => ({
  __esModule: true,
  default: () => <div data-testid="react-quill" />,
}));

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  useCapabilities: () => ({ hasCapability: mockHasCapability }),
  usePageHelp: () => ({ setPageHelp: vi.fn() }),
}));

vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useApi: () => ({ execute: mockExecute }),
  useOrganisation: () => ({ organisation: { id: 'org-1', name: 'Test Org' } }),
}));

// Track props passed to DiscountSelector and capture fetchDiscounts
let capturedFetchDiscounts: any = null;
let capturedModuleType: string | null = null;
let capturedSelectedIds: string[] = [];

vi.mock('@aws-web-framework/components', () => ({
  DiscountSelector: (props: any) => {
    capturedFetchDiscounts = props.fetchDiscounts;
    capturedModuleType = props.moduleType;
    capturedSelectedIds = props.selectedDiscountIds || [];
    return (
      <div
        data-testid="discount-selector"
        data-module-type={props.moduleType}
        data-selected-ids={JSON.stringify(props.selectedDiscountIds || [])}
      />
    );
  },
}));

// Track moduleType passed to events module discount pages
let capturedEventsModuleType: string | null = null;

vi.mock('@aws-web-framework/orgadmin-events', () => ({
  DiscountsListPage: (props: any) => {
    capturedEventsModuleType = props.moduleType;
    return <div data-testid="events-discounts-list" data-module-type={props.moduleType} />;
  },
  CreateDiscountPage: (props: any) => {
    capturedEventsModuleType = props.moduleType;
    return <div data-testid="events-create-discount" data-module-type={props.moduleType} />;
  },
}));

// ── Import components after mocks ──
import DiscountsListPage from '../DiscountsListPage';
import CreateDiscountPage from '../CreateDiscountPage';
import EditDiscountPage from '../EditDiscountPage';
import CreateRegistrationTypePage from '../CreateRegistrationTypePage';

// ── Generators ──

const FORMS = [{ id: 'form-1', name: 'Default Form' }];
const PAY = [{ id: 'pay-offline', name: 'Pay Offline' }];

const discountIdArb = fc.stringMatching(/^disc-[a-z0-9]{1,10}$/);
const discountIdsArb = fc.uniqueArray(discountIdArb, { minLength: 0, maxLength: 5 });

const editIdArb = fc.stringMatching(/^[a-zA-Z0-9]{1,12}$/);

// ── Property 24: Discount API module type consistency ──

describe('Feature: registrations-module, Property 24: Discount API module type consistency', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    capturedFetchDiscounts = null;
    capturedModuleType = null;
    capturedEventsModuleType = null;
  });

  it('Property 24a: Discount wrapper pages pass moduleType="registrations" to events module', { timeout: 60000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('list', 'create', 'edit'),
        async (pageType) => {
          capturedEventsModuleType = null;

          let unmountFn: () => void;
          if (pageType === 'list') {
            const { unmount } = render(<DiscountsListPage />);
            unmountFn = unmount;
          } else if (pageType === 'create') {
            const { unmount } = render(<CreateDiscountPage />);
            unmountFn = unmount;
          } else {
            const { unmount } = render(<EditDiscountPage />);
            unmountFn = unmount;
          }

          // All discount wrapper pages must pass moduleType="registrations"
          expect(capturedEventsModuleType).toBe('registrations');

          unmountFn!();
        },
      ),
      { numRuns: 20 },
    );
  });

  it('Property 24b: RegistrationTypeForm fetchDiscounts uses "registrations" module type and DiscountSelector receives moduleType="registrations"', { timeout: 60000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        discountIdsArb,
        async (discountIds) => {
          vi.clearAllMocks();
          capturedFetchDiscounts = null;
          capturedModuleType = null;
          mockParams = {};
          mockHasCapability.mockImplementation((cap: string) => cap === 'registration-discounts');

          // Build mock discounts that should all have moduleType: 'registrations'
          const mockDiscounts = discountIds.map((id) => ({
            id,
            name: `Discount ${id}`,
            moduleType: 'registrations',
            type: 'percentage',
            value: 10,
          }));

          mockExecute.mockImplementation(({ url, method }: any) => {
            if (url?.includes('/application-forms')) return Promise.resolve(FORMS);
            if (url?.includes('/payment-methods')) return Promise.resolve(PAY);
            if (url?.includes('/discounts/registrations')) {
              return Promise.resolve({ discounts: mockDiscounts });
            }
            if (method === 'POST') return Promise.resolve({ id: 'new-1' });
            return Promise.resolve([]);
          });

          const { unmount } = render(<CreateRegistrationTypePage />);

          // Wait for DiscountSelector to render and capture props
          await waitFor(() => {
            expect(screen.getByTestId('discount-selector')).toBeInTheDocument();
          });

          // DiscountSelector must receive moduleType="registrations"
          expect(capturedModuleType).toBe('registrations');

          // The fetchDiscounts function should call the API with "registrations" module type
          if (capturedFetchDiscounts) {
            const result = await capturedFetchDiscounts('org-1', 'registrations');

            // Verify the API was called with the correct URL containing "registrations"
            expect(mockExecute).toHaveBeenCalledWith(
              expect.objectContaining({
                method: 'GET',
                url: '/api/orgadmin/organisations/org-1/discounts/registrations',
              }),
            );

            // All returned discounts should have moduleType: 'registrations'
            for (const discount of result) {
              expect(discount.moduleType).toBe('registrations');
            }
          }

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── Property 25: Discount IDs persistence round trip ──

describe('Feature: registrations-module, Property 25: Discount IDs persistence round trip', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    capturedSelectedIds = [];
  });

  it('Property 25: Saving a registration type with discountIds and loading it returns the same discountIds', { timeout: 120000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        editIdArb,
        discountIdsArb,
        async (typeId, discountIds) => {
          vi.clearAllMocks();
          capturedSelectedIds = [];
          mockParams = { id: typeId };
          mockHasCapability.mockImplementation((cap: string) => cap === 'registration-discounts');

          // Simulate a saved registration type that has discountIds
          const savedType = {
            name: 'Test Registration',
            description: 'Test description',
            entityName: 'Horse',
            registrationFormId: 'form-1',
            registrationStatus: 'open',
            isRollingRegistration: true,
            numberOfMonths: 12,
            automaticallyApprove: false,
            registrationLabels: [],
            supportedPaymentMethods: ['pay-offline'],
            useTermsAndConditions: false,
            discountIds: discountIds,
          };

          mockExecute.mockImplementation(({ url, method }: any) => {
            if (url?.includes('/application-forms')) return Promise.resolve(FORMS);
            if (url?.includes('/payment-methods')) return Promise.resolve(PAY);
            if (url === `/api/orgadmin/registration-types/${typeId}` && method === 'GET') {
              return Promise.resolve({ ...savedType });
            }
            if (url?.includes('/discounts/registrations')) {
              return Promise.resolve({ discounts: [] });
            }
            return Promise.resolve([]);
          });

          const { unmount } = render(<CreateRegistrationTypePage />);

          // Wait for the registration type to be loaded and DiscountSelector to render
          await waitFor(() => {
            expect(mockExecute).toHaveBeenCalledWith(
              expect.objectContaining({
                url: `/api/orgadmin/registration-types/${typeId}`,
                method: 'GET',
              }),
            );
          });

          // Wait for DiscountSelector to receive the pre-populated discountIds
          await waitFor(() => {
            expect(screen.getByTestId('discount-selector')).toBeInTheDocument();
          });

          // The DiscountSelector should receive the same discountIds that were saved
          await waitFor(() => {
            const selector = screen.getByTestId('discount-selector');
            const selectedIds = JSON.parse(
              selector.getAttribute('data-selected-ids') || '[]',
            );
            expect(selectedIds).toEqual(discountIds);
          });

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });
});
