/**
 * Shared test helper for orgadmin-core pages.
 *
 * Most pages in this package need a router and the current organisation, and
 * several also read the locale. Rendering them bare throws
 * "useOrganisation must be used within an OrganisationProvider", which is how
 * a large number of suites here used to fail.
 */

import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OrganisationProvider, Organisation } from '../context/OrganisationContext';

export const TEST_ORGANISATION = {
  id: 'org-1',
  name: 'Test Organisation',
  currency: 'EUR',
  language: 'en-GB',
  enabledCapabilities: [],
} as unknown as Organisation;

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Override the organisation in context; pass null to simulate "not loaded yet". */
  organisation?: Organisation | null;
}

export function createWrapper(organisation: Organisation | null = TEST_ORGANISATION) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <BrowserRouter>
        <OrganisationProvider organisation={organisation}>{children}</OrganisationProvider>
      </BrowserRouter>
    );
  };
}

export function renderWithProviders(
  ui: React.ReactElement,
  { organisation = TEST_ORGANISATION, ...options }: RenderWithProvidersOptions = {}
): RenderResult {
  return render(ui, { wrapper: createWrapper(organisation), ...options });
}
