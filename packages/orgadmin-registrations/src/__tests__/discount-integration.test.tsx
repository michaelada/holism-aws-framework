/**
 * Integration Test: End-to-end Discount Integration Workflow
 *
 * Feature: registrations-module
 * Tests the discount integration across module config, page wrappers,
 * and the CreateRegistrationTypePage DiscountSelector.
 *
 * Validates: Requirements 10.1-10.9
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mock setup (MUST be before component imports) ──

const mockNavigate = vi.fn();
const mockExecute = vi.fn();
const mockHasCapability = vi.fn();
let mockParams: Record<string, string> = {};

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));

vi.mock('date-fns', () => ({}));
vi.mock('date-fns/locale', () => ({ enGB: {} }));

vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: ({ label, value, onChange }: any) => (
    <div data-testid={`date-picker-${label}`}>
      <input
        data-testid={`date-input-${label}`}
        value={value || ''}
        onChange={(e: any) => onChange?.(e.target.value)}
      />
    </div>
  ),
}));

vi.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('@mui/x-date-pickers/AdapterDateFns', () => ({
  AdapterDateFns: class {},
}));

vi.mock('react-quill', () => ({
  __esModule: true,
  default: ({ value, onChange }: any) => (
    <textarea
      data-testid="react-quill"
      value={value || ''}
      onChange={(e: any) => onChange?.(e.target.value)}
    />
  ),
}));

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en' },
  }),
  useCapabilities: () => ({ hasCapability: mockHasCapability }),
  formatDate: (_d: any, _f: string, _l: string) => '01 Jan 2025',
  usePageHelp: () => ({ setPageHelp: vi.fn() }),
}));

vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useApi: () => ({ execute: mockExecute }),
  useOrganisation: () => ({
    organisation: { id: 'org-1', name: 'Test Org' },
  }),
}));

// Capture DiscountSelector props for assertions
let capturedDiscountSelectorProps: any = null;

vi.mock('@aws-web-framework/components', () => ({
  DiscountSelector: (props: any) => {
    capturedDiscountSelectorProps = props;
    return (
      <div
        data-testid="discount-selector"
        data-module-type={props.moduleType}
        data-selected-ids={JSON.stringify(props.selectedDiscountIds)}
      >
        <button
          data-testid="discount-change-trigger"
          onClick={() => props.onChange(['disc-1', 'disc-2'])}
        >
          Change Discounts
        </button>
      </div>
    );
  },
}));

// Capture events module page props
let capturedEventsDiscountsListProps: any = null;
let capturedEventsCreateDiscountProps: any = null;

vi.mock('@aws-web-framework/orgadmin-events', () => ({
  DiscountsListPage: (props: any) => {
    capturedEventsDiscountsListProps = props;
    return <div data-testid="events-discounts-list" data-module-type={props.moduleType} />;
  },
  CreateDiscountPage: (props: any) => {
    capturedEventsCreateDiscountProps = props;
    return <div data-testid="events-create-discount" data-module-type={props.moduleType} />;
  },
}));

// ── Import components after mocks ──
import DiscountsListPage from '../pages/DiscountsListPage';
import CreateDiscountPage from '../pages/CreateDiscountPage';
import EditDiscountPage from '../pages/EditDiscountPage';
import CreateRegistrationTypePage from '../pages/CreateRegistrationTypePage';

// ── Helpers ──

const FORMS = [{ id: 'form-1', name: 'Default Form' }];
const PAY_METHODS = [{ id: 'pay-offline', name: 'Pay Offline' }];

function inp(container: HTMLElement, prefix: string) {
  const label = Array.from(container.querySelectorAll('label')).find((l) =>
    (l.textContent || '').startsWith(prefix),
  );
  if (!label) return null;
  const id = label.getAttribute('for');
  if (!id) return null;
  return container.querySelector('#' + CSS.escape(id)) as HTMLInputElement | HTMLTextAreaElement | null;
}

function findBtn(container: HTMLElement, re: RegExp) {
  return Array.from(container.querySelectorAll('button')).find((b) =>
    re.test(b.textContent || ''),
  ) as HTMLButtonElement | null;
}

function clickCheckbox(container: HTMLElement, labelText: string) {
  const labels = Array.from(container.querySelectorAll('label'));
  const label = labels.find((l) => (l.textContent || '').includes(labelText));
  if (label) {
    const checkbox =
      label.querySelector('input[type="checkbox"]') ||
      label.parentElement?.querySelector('input[type="checkbox"]');
    if (checkbox) fireEvent.click(checkbox);
  }
}

// ── Tests ──

describe('Discount Integration Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = {};
    capturedDiscountSelectorProps = null;
    capturedEventsDiscountsListProps = null;
    capturedEventsCreateDiscountProps = null;
  });

  /**
   * Step 1: Verify discount sub-menu item is visible when capability is enabled
   * Validates: Requirements 10.9, 1.5, 1.6
   */
  describe('Step 1: Discount sub-menu visibility via capability', () => {
    it('discount sub-menu item exists with registration-discounts capability in module config', async () => {
      const { registrationsModule } = await import('../module.config');

      const discountsItem = registrationsModule.subMenuItems?.find(
        (item: any) => item.path === '/registrations/discounts',
      );

      expect(discountsItem).toBeDefined();
      expect(discountsItem!.capability).toBe('registration-discounts');
      expect(discountsItem!.label).toBeTruthy();
    });

    it('non-discount sub-menu items have no capability gating', async () => {
      const { registrationsModule } = await import('../module.config');

      const nonDiscountItems = registrationsModule.subMenuItems?.filter(
        (item: any) => item.path !== '/registrations/discounts',
      );

      expect(nonDiscountItems).toBeDefined();
      expect(nonDiscountItems!.length).toBe(2);
      for (const item of nonDiscountItems!) {
        expect(item.capability).toBeUndefined();
      }
    });
  });

  /**
   * Step 2: Verify DiscountsListPage wrapper renders events module page with moduleType="registrations"
   * Validates: Requirements 10.1, 10.4
   */
  describe('Step 2: DiscountsListPage wrapper', () => {
    it('renders events DiscountsListPage with moduleType="registrations"', () => {
      render(<DiscountsListPage />);

      const eventsPage = screen.getByTestId('events-discounts-list');
      expect(eventsPage).toBeInTheDocument();
      expect(eventsPage).toHaveAttribute('data-module-type', 'registrations');
      expect(capturedEventsDiscountsListProps.moduleType).toBe('registrations');
    });
  });

  /**
   * Step 3: Verify CreateDiscountPage wrapper renders events module page with moduleType="registrations"
   * Validates: Requirements 10.2
   */
  describe('Step 3: CreateDiscountPage wrapper', () => {
    it('renders events CreateDiscountPage with moduleType="registrations"', () => {
      render(<CreateDiscountPage />);

      const eventsPage = screen.getByTestId('events-create-discount');
      expect(eventsPage).toBeInTheDocument();
      expect(eventsPage).toHaveAttribute('data-module-type', 'registrations');
      expect(capturedEventsCreateDiscountProps.moduleType).toBe('registrations');
    });
  });

  /**
   * Step 4: Verify EditDiscountPage wrapper renders events module page with moduleType="registrations"
   * Validates: Requirements 10.3
   */
  describe('Step 4: EditDiscountPage wrapper', () => {
    it('renders events CreateDiscountPage (edit mode) with moduleType="registrations"', () => {
      render(<EditDiscountPage />);

      const eventsPage = screen.getByTestId('events-create-discount');
      expect(eventsPage).toBeInTheDocument();
      expect(eventsPage).toHaveAttribute('data-module-type', 'registrations');
      expect(capturedEventsCreateDiscountProps.moduleType).toBe('registrations');
    });
  });

  /**
   * Step 5: Verify DiscountSelector appears on CreateRegistrationTypePage when capability is enabled
   * Validates: Requirements 10.5
   */
  describe('Step 5: DiscountSelector visibility with capability enabled', () => {
    it('shows DiscountSelector when registration-discounts capability is enabled', () => {
      mockHasCapability.mockImplementation((cap: string) => cap === 'registration-discounts');
      mockExecute.mockResolvedValue([]);

      render(<CreateRegistrationTypePage />);

      expect(screen.getByTestId('discount-selector')).toBeInTheDocument();
      expect(capturedDiscountSelectorProps.moduleType).toBe('registrations');
      expect(capturedDiscountSelectorProps.organisationId).toBe('org-1');
    });
  });

  /**
   * Step 6: Verify DiscountSelector is hidden when capability is disabled
   * Validates: Requirements 10.8
   */
  describe('Step 6: DiscountSelector hidden without capability', () => {
    it('hides DiscountSelector when registration-discounts capability is disabled', () => {
      mockHasCapability.mockReturnValue(false);
      mockExecute.mockResolvedValue([]);

      render(<CreateRegistrationTypePage />);

      expect(screen.queryByTestId('discount-selector')).not.toBeInTheDocument();
    });
  });

  /**
   * Step 7: Verify discount IDs are included in form submission when saving a registration type
   * Validates: Requirements 10.7
   */
  describe('Step 7: Discount IDs included in form submission', () => {
    it('includes selected discountIds when submitting the registration type form', async () => {
      mockHasCapability.mockImplementation((cap: string) => cap === 'registration-discounts');

      mockExecute.mockImplementation(({ url, method }: any) => {
        if (url?.includes('/application-forms')) return Promise.resolve(FORMS);
        if (url?.includes('/payment-methods')) return Promise.resolve(PAY_METHODS);
        if (method === 'POST') return Promise.resolve({ id: 'type-new' });
        return Promise.resolve([]);
      });

      const { container } = render(<CreateRegistrationTypePage />);

      // Wait for form to load
      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      // Fill required fields
      fireEvent.change(inp(container, 'Name')!, { target: { value: 'Horse Reg 2026' } });
      fireEvent.change(inp(container, 'Description')!, { target: { value: 'Horse registration' } });
      fireEvent.change(inp(container, 'Entity Name')!, { target: { value: 'Horse' } });

      // Enable rolling registration and set months
      clickCheckbox(container, 'Is Rolling Registration');
      await waitFor(() => {
        expect(inp(container, 'Number of Months')).toBeTruthy();
      });
      fireEvent.change(inp(container, 'Number of Months')!, { target: { value: '12' } });

      // Select discounts via the mock trigger
      fireEvent.click(screen.getByTestId('discount-change-trigger'));

      // Verify discount IDs updated in the selector
      await waitFor(() => {
        const selector = screen.getByTestId('discount-selector');
        const selectedIds = JSON.parse(selector.getAttribute('data-selected-ids') || '[]');
        expect(selectedIds).toEqual(['disc-1', 'disc-2']);
      });

      // Submit the form
      const saveBtn = findBtn(container, /registrations\.actions\.saveAndPublish/);
      expect(saveBtn).toBeTruthy();
      fireEvent.click(saveBtn!);

      // Verify POST was sent with discountIds in the payload
      await waitFor(() => {
        const postCall = mockExecute.mock.calls.find(
          (call: any) => call[0]?.method === 'POST' && call[0]?.url === '/api/orgadmin/registration-types',
        );
        expect(postCall).toBeTruthy();
        expect(postCall![0].data.discountIds).toEqual(['disc-1', 'disc-2']);
      });

      // Verify navigation after save
      expect(mockNavigate).toHaveBeenCalledWith('/registrations/types');
    });
  });

  /**
   * Verify discount routes are gated behind registration-discounts capability
   * Validates: Requirements 10.9
   */
  describe('Discount routes capability gating', () => {
    it('all discount routes have registration-discounts capability', async () => {
      const { registrationsModule } = await import('../module.config');

      const discountPaths = [
        'registrations/discounts',
        'registrations/discounts/new',
        'registrations/discounts/:id/edit',
      ];

      for (const path of discountPaths) {
        const route = registrationsModule.routes.find((r: any) => r.path === path);
        expect(route).toBeDefined();
        expect(route!.capability).toBe('registration-discounts');
      }
    });
  });
});
