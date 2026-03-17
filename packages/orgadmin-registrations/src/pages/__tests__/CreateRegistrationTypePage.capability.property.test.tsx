/**
 * Property Test: DiscountSelector capability gating on registration type form
 *
 * Feature: registrations-module, Property 23: DiscountSelector capability gating on registration type form
 *
 * For any organisation, the DiscountSelector component on the CreateRegistrationTypePage
 * should be visible if and only if the organisation has the "registration-discounts"
 * capability enabled.
 *
 * **Validates: Requirements 10.5, 10.8**
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import fc from 'fast-check';

// ── Mocks (hoisted before component import) ──

const mockNavigate = vi.fn();
const mockParams: { id?: string } = {};
const mockExecute = vi.fn();
const mockHasCapability = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));

vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: ({ label }: any) => <div data-testid={`date-picker-${label}`} />,
}));

vi.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('@mui/x-date-pickers/AdapterDateFns', () => ({
  AdapterDateFns: class {},
}));

vi.mock('date-fns/locale', () => ({ enGB: {} }));
vi.mock('date-fns', () => ({}));

vi.mock('react-quill', () => ({
  __esModule: true,
  default: () => <div data-testid="react-quill" />,
}));

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  useCapabilities: () => ({ hasCapability: mockHasCapability }),
  usePageHelp: () => ({ setPageHelp: vi.fn() }),
}));

vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useApi: () => ({ execute: mockExecute }),
  useOrganisation: () => ({
    organisation: { id: 'org-1', name: 'Test Org' },
  }),
}));

vi.mock('@aws-web-framework/components', () => ({
  DiscountSelector: (props: any) => (
    <div data-testid="discount-selector" data-module-type={props.moduleType} />
  ),
}));

// ── Import component after mocks ──
import CreateRegistrationTypePage from '../CreateRegistrationTypePage';

// ── Helpers ──

/** All known capabilities in the system excluding 'registration-discounts' */
const OTHER_CAPABILITIES = [
  'registrations',
  'memberships',
  'events',
  'forms',
  'calendar',
  'users',
  'payments',
] as const;

describe('Feature: registrations-module, Property 23: DiscountSelector capability gating on registration type form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams.id = undefined;
    mockExecute.mockResolvedValue([]);
  });

  /**
   * Property 23: DiscountSelector capability gating
   *
   * For any random set of capabilities:
   *   - If 'registration-discounts' IS in the set → DiscountSelector MUST be visible
   *   - If 'registration-discounts' is NOT in the set → DiscountSelector MUST be hidden
   *
   * **Validates: Requirements 10.5, 10.8**
   */
  it('Property 23: DiscountSelector is visible iff registration-discounts capability is enabled', () => {
    fc.assert(
      fc.property(
        // Generate a random subset of other capabilities
        fc.subarray([...OTHER_CAPABILITIES]),
        // Randomly decide whether registration-discounts is enabled
        fc.boolean(),
        (otherCaps, hasDiscountCap) => {
          const capabilities = new Set<string>(otherCaps);
          if (hasDiscountCap) {
            capabilities.add('registration-discounts');
          } else {
            capabilities.delete('registration-discounts');
          }

          mockHasCapability.mockImplementation((cap: string) => capabilities.has(cap));

          const { unmount } = render(<CreateRegistrationTypePage />);

          const selector = screen.queryByTestId('discount-selector');

          if (hasDiscountCap) {
            expect(selector).toBeInTheDocument();
          } else {
            expect(selector).not.toBeInTheDocument();
          }

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });
});
