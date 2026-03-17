/**
 * Property Tests for CreateRegistrationTypePage
 *
 * Property 3: Registration type form submission sends correct HTTP method
 * Property 4: Edit form pre-population round trip
 * Property 5: API error preserves form data
 *
 * **Validates: Requirements 2.4, 2.6, 2.7, 2.9**
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import fc from 'fast-check';

const mockNavigate = vi.fn();
const mockExecute = vi.fn();
let mockParams: Record<string, string> = {};

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
  default: ({ value, onChange }: any) => (
    <textarea data-testid="react-quill" value={value || ''} onChange={(e: any) => onChange?.(e.target.value)} />
  ),
}));
vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  useCapabilities: () => ({ hasCapability: (cap: string) => cap === 'registration-discounts' }),
}));
vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useApi: () => ({ execute: mockExecute }),
  useOrganisation: () => ({ organisation: { id: 'org-1', name: 'Test Org' } }),
}));
vi.mock('@aws-web-framework/components', () => ({
  DiscountSelector: () => <div data-testid="discount-selector" />,
}));

import CreateRegistrationTypePage from '../CreateRegistrationTypePage';

// ── Generators ──

const safeStr = (min = 1, max = 20) =>
  fc.string({ minLength: min, maxLength: max }).filter(s => s.trim().length > 0).map(s => s.trim());

// Use rolling registration to avoid DatePicker interaction issues in create mode
const formDataArb = fc.record({
  name: safeStr(1, 30),
  description: safeStr(1, 50),
  entityName: safeStr(1, 20),
  registrationFormId: fc.constant('form-1'),
  registrationStatus: fc.constantFrom('open' as const, 'closed' as const),
  isRollingRegistration: fc.constant(true),
  validUntil: fc.constant(undefined as Date | undefined),
  numberOfMonths: fc.constant(12),
  automaticallyApprove: fc.boolean(),
  registrationLabels: fc.constant([] as string[]),
  supportedPaymentMethods: fc.constant(['pay-offline']),
  useTermsAndConditions: fc.constant(false),
  termsAndConditions: fc.constant(undefined as string | undefined),
  discountIds: fc.constant([] as string[]),
});

const editIdArb = fc.stringMatching(/^[a-zA-Z0-9]{1,12}$/);

// ── Helpers ──

const FORMS = [{ id: 'form-1', name: 'Default Form' }];
const PAY = [{ id: 'pay-offline', name: 'Pay Offline' }];

function setupCreate() {
  mockExecute.mockImplementation(({ url, method }: any) => {
    if (url?.includes('/application-forms')) return Promise.resolve(FORMS);
    if (url?.includes('/payment-methods')) return Promise.resolve(PAY);
    if (method === 'POST') return Promise.resolve({ id: 'new-1' });
    return Promise.resolve([]);
  });
}

function setupEdit(typeId: string, data: any) {
  mockExecute.mockImplementation(({ url, method }: any) => {
    if (url?.includes('/application-forms')) return Promise.resolve(FORMS);
    if (url?.includes('/payment-methods')) return Promise.resolve(PAY);
    if (url === `/api/orgadmin/registration-types/${typeId}` && method === 'GET')
      return Promise.resolve({ ...data });
    if (method === 'PUT') return Promise.resolve({ id: typeId });
    return Promise.resolve([]);
  });
}

/** Find MUI TextField input by label prefix */
function inp(c: HTMLElement, prefix: string) {
  const label = Array.from(c.querySelectorAll('label')).find(l =>
    (l.textContent || '').startsWith(prefix),
  );
  if (!label) return null;
  const id = label.getAttribute('for');
  if (!id) return null;
  return c.querySelector('#' + CSS.escape(id)) as HTMLInputElement | HTMLTextAreaElement | null;
}

function findBtn(c: HTMLElement, re: RegExp) {
  return Array.from(c.querySelectorAll('button')).find(b =>
    re.test(b.textContent || ''),
  ) as HTMLButtonElement | null;
}

/** Find and click a checkbox by its label text */
function clickCheckbox(c: HTMLElement, labelText: string) {
  const labels = Array.from(c.querySelectorAll('label'));
  const label = labels.find(l => (l.textContent || '').includes(labelText));
  if (label) {
    const checkbox = label.querySelector('input[type="checkbox"]') ||
      label.parentElement?.querySelector('input[type="checkbox"]');
    if (checkbox) fireEvent.click(checkbox);
  }
}

// ── Property 3 ──

describe('Feature: registrations-module, Property 3: Registration type form submission sends correct HTTP method', () => {
  afterEach(() => { cleanup(); });

  it('Property 3: Create mode sends POST, edit mode sends PUT', { timeout: 120000 }, async () => {
    await fc.assert(
      fc.asyncProperty(formDataArb, fc.boolean(), editIdArb, async (data, isEdit, typeId) => {
        vi.clearAllMocks();
        if (isEdit) { mockParams = { id: typeId }; setupEdit(typeId, data); }
        else { mockParams = {}; setupCreate(); }

        const { container, unmount } = render(<CreateRegistrationTypePage />);
        await waitFor(() => { expect(inp(container, 'Name')).toBeTruthy(); });

        if (isEdit) {
          await waitFor(() => { expect(inp(container, 'Name')?.value).toBe(data.name); });
        } else {
          // Wait for auto-selection of form and payment method
          await waitFor(() => {
            expect(mockExecute).toHaveBeenCalledTimes(2); // forms + payment methods
          });
        }

        fireEvent.change(inp(container, 'Name')!, { target: { value: data.name } });
        fireEvent.change(inp(container, 'Description')!, { target: { value: data.description } });
        fireEvent.change(inp(container, 'Entity Name')!, { target: { value: data.entityName } });

        // For create mode, check rolling registration and set months
        if (!isEdit) {
          clickCheckbox(container, 'Is Rolling Registration');
          // Wait for the Number of Months field to appear
          await waitFor(() => { expect(inp(container, 'Number of Months')).toBeTruthy(); });
          const monthsInput = inp(container, 'Number of Months');
          if (monthsInput) {
            fireEvent.change(monthsInput, { target: { value: '12' } });
          }
        }

        const re = isEdit ? /registrations\.actions\.update/i : /registrations\.actions\.saveAndPublish/i;
        const b = findBtn(container, re);
        if (b) await act(async () => { fireEvent.click(b); });

        await waitFor(() => {
          if (isEdit) {
            expect(mockExecute).toHaveBeenCalledWith(
              expect.objectContaining({ method: 'PUT', url: `/api/orgadmin/registration-types/${typeId}` }),
            );
          } else {
            expect(mockExecute).toHaveBeenCalledWith(
              expect.objectContaining({ method: 'POST', url: '/api/orgadmin/registration-types' }),
            );
          }
        });

        unmount();
      }),
      { numRuns: 20 },
    );
  });
});

// ── Property 4 ──

describe('Feature: registrations-module, Property 4: Edit form pre-population round trip', () => {
  afterEach(() => { cleanup(); });

  it('Property 4: Edit form pre-populates all fields', { timeout: 120000 }, async () => {
    await fc.assert(
      fc.asyncProperty(formDataArb, editIdArb, async (data, typeId) => {
        vi.clearAllMocks();
        mockParams = { id: typeId };
        setupEdit(typeId, data);

        const { container, unmount } = render(<CreateRegistrationTypePage />);
        await waitFor(() => { expect(inp(container, 'Name')?.value).toBe(data.name); });

        expect(inp(container, 'Description')?.value).toBe(data.description);
        expect(inp(container, 'Entity Name')?.value).toBe(data.entityName);

        unmount();
      }),
      { numRuns: 20 },
    );
  });
});

// ── Property 5 ──

describe('Feature: registrations-module, Property 5: API error preserves form data', () => {
  afterEach(() => { cleanup(); });

  it('Property 5: API error retains form values', { timeout: 120000 }, async () => {
    await fc.assert(
      fc.asyncProperty(formDataArb, async (data) => {
        vi.clearAllMocks();
        mockParams = {};

        mockExecute.mockImplementation(({ url, method }: any) => {
          if (url?.includes('/application-forms')) return Promise.resolve(FORMS);
          if (url?.includes('/payment-methods')) return Promise.resolve(PAY);
          if (method === 'POST') return Promise.reject(new Error('Server error'));
          return Promise.resolve([]);
        });

        const { container, unmount } = render(<CreateRegistrationTypePage />);
        await waitFor(() => { expect(inp(container, 'Name')).toBeTruthy(); });

        fireEvent.change(inp(container, 'Name')!, { target: { value: data.name } });
        fireEvent.change(inp(container, 'Description')!, { target: { value: data.description } });
        fireEvent.change(inp(container, 'Entity Name')!, { target: { value: data.entityName } });

        // Check rolling registration and set months
        clickCheckbox(container, 'Is Rolling Registration');
        await waitFor(() => { expect(inp(container, 'Number of Months')).toBeTruthy(); });
        const monthsInput = inp(container, 'Number of Months');
        if (monthsInput) {
          fireEvent.change(monthsInput, { target: { value: '12' } });
        }

        const b = findBtn(container, /registrations\.actions\.saveAndPublish/i);
        if (b) await act(async () => { fireEvent.click(b); });

        await waitFor(() => { expect(container.querySelector('[role="alert"]')).toBeTruthy(); });

        expect(inp(container, 'Name')?.value).toBe(data.name);
        expect(inp(container, 'Description')?.value).toBe(data.description);
        expect(inp(container, 'Entity Name')?.value).toBe(data.entityName);
        expect(mockNavigate).not.toHaveBeenCalled();

        unmount();
      }),
      { numRuns: 20 },
    );
  });
});
