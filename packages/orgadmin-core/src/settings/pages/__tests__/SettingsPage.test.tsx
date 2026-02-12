/**
 * Unit tests for SettingsPage component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPage from '../SettingsPage';

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

describe('SettingsPage', () => {
  it('should render settings page with title', () => {
    render(<SettingsPage />);
    
    expect(screen.getByText('Organisation Settings')).toBeInTheDocument();
    expect(screen.getByText("Manage your organisation's configuration and preferences")).toBeInTheDocument();
  });

  it('should render all tabs', () => {
    render(<SettingsPage />);
    
    expect(screen.getByText('Organisation Details')).toBeInTheDocument();
    expect(screen.getByText('Payment Settings')).toBeInTheDocument();
    expect(screen.getByText('Email Templates')).toBeInTheDocument();
    expect(screen.getByText('Branding')).toBeInTheDocument();
  });

  it('should display organisation details tab by default', () => {
    render(<SettingsPage />);
    
    expect(screen.getByTestId('organisation-details-tab')).toBeInTheDocument();
  });

  it('should switch to payment settings tab when clicked', () => {
    render(<SettingsPage />);
    
    const paymentTab = screen.getByText('Payment Settings');
    fireEvent.click(paymentTab);
    
    expect(screen.getByTestId('payment-settings-tab')).toBeInTheDocument();
  });

  it('should switch to email templates tab when clicked', () => {
    render(<SettingsPage />);
    
    const emailTab = screen.getByText('Email Templates');
    fireEvent.click(emailTab);
    
    expect(screen.getByTestId('email-templates-tab')).toBeInTheDocument();
  });

  it('should switch to branding tab when clicked', () => {
    render(<SettingsPage />);
    
    const brandingTab = screen.getByText('Branding');
    fireEvent.click(brandingTab);
    
    expect(screen.getByTestId('branding-tab')).toBeInTheDocument();
  });

  it('should have correct tab accessibility attributes', () => {
    render(<SettingsPage />);
    
    const firstTab = screen.getByRole('tab', { name: /organisation details/i });
    expect(firstTab).toHaveAttribute('id', 'settings-tab-0');
    expect(firstTab).toHaveAttribute('aria-controls', 'settings-tabpanel-0');
  });
});
