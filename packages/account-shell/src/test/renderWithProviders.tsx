import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enGB from '../locales/en-GB/translation.json';
import { buildTheme } from '../theme';
import {
  AccountOrganisationContextValue,
  OrganisationState,
} from '../context/AccountOrganisationContext';
import { AccountMe, PublicOrganisationDetail } from '../types/account';

/**
 * Test harness for this package.
 *
 * i18next is initialised against the **real** en-GB catalogue rather than
 * stubbed to return keys, so assertions read as the text a member actually sees
 * and a missing translation shows up as a bare key path in the failure rather
 * than passing silently.
 */
let initialised = false;

export function setupI18n(): typeof i18n {
  if (!initialised) {
    void i18n.use(initReactI18next).init({
      resources: { 'en-GB': { translation: enGB } },
      lng: 'en-GB',
      fallbackLng: 'en-GB',
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
    initialised = true;
  }
  return i18n;
}

export const TEST_ME: AccountMe = {
  user: {
    id: 'user-1',
    email: 'member@example.com',
    firstName: 'Sam',
    lastName: 'Rivers',
  },
  organisation: {
    urlCode: 'khpc',
    displayName: 'Killiney Harbour Paddling Club',
    currency: 'EUR',
    language: 'en',
    capabilities: ['event-management', 'memberships'],
  },
};

export const TEST_PUBLIC_DETAIL: PublicOrganisationDetail = {
  urlCode: 'khpc',
  displayName: 'Killiney Harbour Paddling Club',
  organisationType: 'Paddling Club',
  city: 'Dublin',
  country: 'Ireland',
  branding: { logoUrl: '', primaryColor: '#1976d2' },
  capabilities: ['event-management', 'memberships'],
  currency: 'EUR',
  language: 'en',
  registrationOpen: true,
};

/**
 * Build a context value.
 *
 * Every field is a stable value from a single object, because pages key effects
 * on `hasCapability` and `refresh` identity — a fresh function per render would
 * loop rather than fail readably (CLAUDE.md §3.4).
 */
export function makeOrganisationContext(
  overrides: Partial<AccountOrganisationContextValue> = {}
): AccountOrganisationContextValue {
  const capabilities =
    overrides.capabilities ?? overrides.me?.organisation.capabilities ?? TEST_ME.organisation.capabilities;

  const base: AccountOrganisationContextValue = {
    orgCode: 'khpc',
    state: 'connected' as OrganisationState,
    me: TEST_ME,
    publicDetail: TEST_PUBLIC_DETAIL,
    primaryColor: '#1976d2',
    publicLoading: false,
    capabilities,
    hasCapability: (capability: string) => capabilities.includes(capability),
    refresh: async () => 'connected' as OrganisationState,
  };

  return { ...base, ...overrides, capabilities };
}

export interface RenderOpts extends Omit<RenderOptions, 'wrapper'> {
  /** Initial URL; use when a page reads `useParams`. */
  route?: string;
  /** Route pattern the component is mounted at, e.g. `/:orgCode/pending`. */
  path?: string;
}

export function renderWithProviders(
  ui: React.ReactElement,
  { route = '/khpc', path = '/:orgCode', ...options }: RenderOpts = {}
): RenderResult {
  const instance = setupI18n();

  return render(
    <I18nextProvider i18n={instance}>
      <ThemeProvider theme={buildTheme(null)}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={ui} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </I18nextProvider>,
    options
  );
}
