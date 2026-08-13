/**
 * Unit tests for SettingsPage component
 *
 * The tab labels and page headings are i18n keys resolved through the shell, so
 * the assertions here resolve the same keys rather than hard-coding English.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPage from '../SettingsPage';
import { resolveTranslation } from '../../../test/i18nTestUtils';

// The page reads onboarding state and registers contextual help; neither is
// under test here.
const mockSetCurrentModule = vi.fn();
const mockCheckModuleVisit = vi.fn();
vi.mock('@aws-web-framework/orgadmin-shell', () => ({
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
    render(<SettingsPage />);

    expect(screen.getByText(resolveTranslation('settings.pageTitle'))).toBeInTheDocument();
    expect(screen.getByText(resolveTranslation('settings.pageSubtitle'))).toBeInTheDocument();
  });

  it('should not render any untranslated i18n keys', () => {
    render(<SettingsPage />);

    // A missing translation falls through as the raw key, e.g. "settings.pageTitle"
    expect(screen.queryByText(/^settings\.[a-zA-Z.]+$/)).not.toBeInTheDocument();
  });

  it('should render all tabs using their translated labels', () => {
    render(<SettingsPage />);

    for (const key of TAB_LABEL_KEYS) {
      expect(screen.getByRole('tab', { name: tabLabel(key) })).toBeInTheDocument();
    }
  });

  it('should label the tab strip for assistive technology', () => {
    render(<SettingsPage />);

    expect(
      screen.getByRole('tablist', { name: resolveTranslation('settings.tabsAriaLabel') })
    ).toBeInTheDocument();
  });

  it('should display organisation details tab by default', () => {
    render(<SettingsPage />);

    expect(screen.getByTestId('organisation-details-tab')).toBeInTheDocument();
  });

  it('should switch to payment settings tab when clicked', () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('tab', { name: tabLabel('settings.paymentSettings.title') }));

    expect(screen.getByTestId('payment-settings-tab')).toBeInTheDocument();
  });

  it('should switch to email templates tab when clicked', () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('tab', { name: tabLabel('settings.emailTemplates.title') }));

    expect(screen.getByTestId('email-templates-tab')).toBeInTheDocument();
  });

  it('should switch to branding tab when clicked', () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('tab', { name: tabLabel('settings.branding.title') }));

    expect(screen.getByTestId('branding-tab')).toBeInTheDocument();
  });

  it('should have correct tab accessibility attributes', () => {
    render(<SettingsPage />);

    TAB_LABEL_KEYS.forEach((key, index) => {
      const tab = screen.getByRole('tab', { name: tabLabel(key) });
      expect(tab).toHaveAttribute('id', `settings-tab-${index}`);
      expect(tab).toHaveAttribute('aria-controls', `settings-tabpanel-${index}`);
    });
  });

  it('should register itself with onboarding on mount', () => {
    render(<SettingsPage />);

    expect(mockSetCurrentModule).toHaveBeenCalledWith('settings');
    expect(mockCheckModuleVisit).toHaveBeenCalledWith('settings');
  });
});
