/**
 * Unit tests for SettingsPage component
 *
 * The tab labels and page headings are i18n keys resolved through the shell, so
 * the assertions here resolve the same keys rather than hard-coding English.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import SettingsPage from '../SettingsPage';
import { resolveTranslation } from '../../../test/i18nTestUtils';

/*
 * The open tab lives in the URL now, so the page needs routing context. That is
 * the point of the change: a tab held in component state could not be linked,
 * survive a reload, or be reached with Back.
 */
/** Renders the router's current query string, so the URL itself is assertable. */
const LocationProbe: React.FC = () => <span data-testid="search">{useLocation().search}</span>;

const renderAt = (entry = '/settings') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <SettingsPage />
      <LocationProbe />
    </MemoryRouter>
  );

// The page reads onboarding state and registers contextual help; neither is
// under test here.
const mockSetCurrentModule = vi.fn();
const mockCheckModuleVisit = vi.fn();
vi.mock('@itsplainsailing/orgadmin-shell', () => ({
  useOnboarding: () => ({
    setCurrentModule: mockSetCurrentModule,
    checkModuleVisit: mockCheckModuleVisit,
  }),
  usePageHelp: () => undefined,
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => resolveTranslation(key, options),
    i18n: { language: 'en-GB' },
  }),
}));

// Mock the tab components
vi.mock('../../components/OrganisationDetailsTab', () => ({
  default: () => <div data-testid="organisation-details-tab">Organisation Details Tab</div>,
}));

vi.mock('../../components/PaymentSettingsTab', () => ({
  default: () => <div data-testid="payment-settings-tab">Payment Settings Tab</div>,
}));

vi.mock('../../components/EmailTemplatesTab', () => ({
  default: () => <div data-testid="email-templates-tab">Email Templates Tab</div>,
}));

vi.mock('../../components/BrandingTab', () => ({
  default: () => <div data-testid="branding-tab">Branding Tab</div>,
}));

const TAB_LABEL_KEYS = [
  'settings.organisationDetails.title',
  'settings.paymentSettings.title',
  'settings.emailTemplates.title',
  'settings.branding.title',
];

const tabLabel = (key: string) => resolveTranslation(key);

describe('SettingsPage', () => {
  it('should render settings page with translated title and subtitle', () => {
    renderAt();

    expect(screen.getByText(resolveTranslation('settings.pageTitle'))).toBeInTheDocument();
    expect(screen.getByText(resolveTranslation('settings.pageSubtitle'))).toBeInTheDocument();
  });

  it('should not render any untranslated i18n keys', () => {
    renderAt();

    // A missing translation falls through as the raw key, e.g. "settings.pageTitle"
    expect(screen.queryByText(/^settings\.[a-zA-Z.]+$/)).not.toBeInTheDocument();
  });

  it('should render all tabs using their translated labels', () => {
    renderAt();

    for (const key of TAB_LABEL_KEYS) {
      expect(screen.getByRole('tab', { name: tabLabel(key) })).toBeInTheDocument();
    }
  });

  it('should label the tab strip for assistive technology', () => {
    renderAt();

    expect(
      screen.getByRole('tablist', { name: resolveTranslation('settings.tabsAriaLabel') })
    ).toBeInTheDocument();
  });

  it('should display organisation details tab by default', () => {
    renderAt();

    expect(screen.getByTestId('organisation-details-tab')).toBeInTheDocument();
  });

  it('should switch to payment settings tab when clicked', () => {
    renderAt();

    fireEvent.click(screen.getByRole('tab', { name: tabLabel('settings.paymentSettings.title') }));

    expect(screen.getByTestId('payment-settings-tab')).toBeInTheDocument();
  });

  it('should switch to email templates tab when clicked', () => {
    renderAt();

    fireEvent.click(screen.getByRole('tab', { name: tabLabel('settings.emailTemplates.title') }));

    expect(screen.getByTestId('email-templates-tab')).toBeInTheDocument();
  });

  it('should switch to branding tab when clicked', () => {
    renderAt();

    fireEvent.click(screen.getByRole('tab', { name: tabLabel('settings.branding.title') }));

    expect(screen.getByTestId('branding-tab')).toBeInTheDocument();
  });

  it('should have correct tab accessibility attributes', () => {
    renderAt();

    TAB_LABEL_KEYS.forEach((key, index) => {
      const tab = screen.getByRole('tab', { name: tabLabel(key) });
      expect(tab).toHaveAttribute('id', `settings-tab-${index}`);
      expect(tab).toHaveAttribute('aria-controls', `settings-tabpanel-${index}`);
    });
  });

  it('should register itself with onboarding on mount', () => {
    renderAt();

    expect(mockSetCurrentModule).toHaveBeenCalledWith('settings');
    expect(mockCheckModuleVisit).toHaveBeenCalledWith('settings');
  });

  /*
   * Held in `useState`, the open tab could not be linked or shared, a reload
   * dropped the administrator back on Organisation Details, and browser Back
   * left the module rather than returning to the previous tab. For someone
   * working in twenty-minute bursts, losing your place on refresh is the
   * expensive failure.
   */
  it('opens the tab named in the URL', () => {
    renderAt('/settings?tab=branding');

    expect(
      screen.getByRole('tab', { name: resolveTranslation('settings.branding.title') })
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('falls back to the first tab when the URL names nothing', () => {
    renderAt('/settings');

    expect(
      screen.getByRole('tab', { name: resolveTranslation('settings.organisationDetails.title') })
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('falls back to the first tab rather than blanking on an unknown slug', () => {
    // A stale or mistyped link must land somewhere usable, not on no tab at all.
    renderAt('/settings?tab=nonsense');

    expect(
      screen.getByRole('tab', { name: resolveTranslation('settings.organisationDetails.title') })
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('puts the chosen tab in the URL as a readable slug', () => {
    renderAt('/settings');

    fireEvent.click(screen.getByRole('tab', { name: resolveTranslation('settings.paymentSettings.title') }));

    // A slug, not an index: `?tab=payments` survives a tab being inserted ahead
    // of it, and it is a link somebody can read.
    expect(screen.getByTestId('search')).toHaveTextContent('tab=payments');
  });
});
