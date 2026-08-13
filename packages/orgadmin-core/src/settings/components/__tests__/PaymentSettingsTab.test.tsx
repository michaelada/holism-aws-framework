/**
 * Unit tests for PaymentSettingsTab component
 *
 * The tab loads two things in parallel on mount — the saved settings and the
 * organisation's enabled payment methods — so the API mock here is keyed on the
 * request rather than on call order.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PaymentSettingsTab from '../PaymentSettingsTab';
import * as useApiModule from '../../../hooks/useApi';
import { resolveTranslation } from '../../../test/i18nTestUtils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => resolveTranslation(key, options),
    i18n: { language: 'en-GB' },
  }),
}));

const label = (key: string) => resolveTranslation(key);
const field = (name: string) => label(`settings.paymentSettings.fields.${name}`);

/**
 * MUI appends " *" to the label of a required field, so match on the label's
 * start rather than the whole string.
 */
const fieldLabel = (name: string) =>
  new RegExp(`^${field(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);

const SETTINGS_URL = '/api/orgadmin/organisation/payment-settings';
const METHODS_URL = '/api/orgadmin/payment-methods';

describe('PaymentSettingsTab', () => {
  const mockExecute = vi.fn();

  /** Matches the backend's PaymentSettings contract. */
  const mockPaymentSettings = {
    helixPayEnabled: false,
    helixPayApiKey: '',
    chequePaymentsEnabled: true,
    chequePaymentInstructions: 'Please make cheques payable to Test Org',
  };

  /**
   * Route the mock by request. `settings`/`methods` override the payloads and
   * `save` decides how the PUT resolves.
   */
  const mockApi = ({
    settings = mockPaymentSettings,
    methods = [{ id: 'pm-1', name: 'Card Payment' }],
    save = { success: true } as unknown,
    saveRejects = false,
  }: {
    settings?: Record<string, unknown> | null;
    methods?: Array<{ id: string; name: string }>;
    save?: unknown;
    saveRejects?: boolean;
  } = {}) => {
    mockExecute.mockImplementation((config: { method: string; url: string }) => {
      if (config.method === 'PUT') {
        return saveRejects ? Promise.reject(save) : Promise.resolve(save);
      }
      if (config.url === METHODS_URL) return Promise.resolve(methods);
      return Promise.resolve(settings);
    });
  };

  const saveButton = () =>
    screen.getByRole('button', { name: label('settings.actions.saveChanges') });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useApiModule, 'useApi').mockReturnValue({
      data: null,
      error: null,
      loading: false,
      execute: mockExecute,
      reset: vi.fn(),
    } as any);
    mockApi();
  });

  describe('Loading', () => {
    it('should load payment settings on mount', async () => {
      render(<PaymentSettingsTab />);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({ method: 'GET', url: SETTINGS_URL });
      });
    });

    it('should load the enabled payment methods on mount', async () => {
      render(<PaymentSettingsTab />);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({ method: 'GET', url: METHODS_URL });
      });
    });

    it('should display a loading state while fetching', () => {
      mockExecute.mockImplementation(() => new Promise(() => {}));

      render(<PaymentSettingsTab />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should display the saved settings after loading', async () => {
      render(<PaymentSettingsTab />);

      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Please make cheques payable to Test Org')
        ).toBeInTheDocument();
      });
    });
  });

  /**
   * Stripe is configured entirely through Connect onboarding
   * (`StripeConnectPanel`), never through this form. Organisations onboarded
   * before the move to Connect destination charges may still have the old
   * direct-charge keys stored, so the guard is that the tab neither renders nor
   * re-submits them.
   */
  describe('Stripe credentials are not part of this form', () => {
    const LEGACY_KEYS = {
      stripeEnabled: true,
      stripePublishableKey: 'pk_test_123',
      stripeSecretKey: 'sk_test_123',
      stripeWebhookSecret: 'whsec_test_123',
    };

    it('should not render legacy per-organisation Stripe keys returned by the API', async () => {
      mockApi({ settings: { ...mockPaymentSettings, ...LEGACY_KEYS } });

      render(<PaymentSettingsTab />);

      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Please make cheques payable to Test Org')
        ).toBeInTheDocument();
      });

      expect(screen.queryByDisplayValue('pk_test_123')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('sk_test_123')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('whsec_test_123')).not.toBeInTheDocument();
    });

    it('should not write Stripe keys back when saving', async () => {
      mockApi({ settings: { ...mockPaymentSettings, ...LEGACY_KEYS } });

      render(<PaymentSettingsTab />);

      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Please make cheques payable to Test Org')
        ).toBeInTheDocument();
      });

      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'PUT', url: SETTINGS_URL })
        );
      });

      const put = mockExecute.mock.calls
        .map(([config]) => config)
        .find((config: { method: string }) => config.method === 'PUT');
      expect(Object.keys(put.data).filter(key => key.startsWith('stripe'))).toEqual([]);
    });
  });

  describe('Helix-Pay configuration', () => {
    it('should hide the Helix-Pay section when the organisation has no Helix-Pay method', async () => {
      render(<PaymentSettingsTab />);

      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Please make cheques payable to Test Org')
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByText(label('settings.paymentSettings.sections.helixPay'))
      ).not.toBeInTheDocument();
    });

    it('should show the Helix-Pay section when a Helix-Pay method is enabled', async () => {
      mockApi({ methods: [{ id: 'pm-2', name: 'Helix-Pay' }] });

      render(<PaymentSettingsTab />);

      await waitFor(() => {
        expect(
          screen.getByText(label('settings.paymentSettings.sections.helixPay'))
        ).toBeInTheDocument();
      });

      expect(screen.getByRole('checkbox', { name: field('helixPayEnabled') })).toBeInTheDocument();
    });

    it('should require an API key when Helix-Pay is enabled', async () => {
      mockApi({
        methods: [{ id: 'pm-2', name: 'Helix-Pay' }],
        settings: { ...mockPaymentSettings, helixPayEnabled: true, helixPayApiKey: '' },
      });

      render(<PaymentSettingsTab />);

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: field('helixPayEnabled') })).toBeChecked();
      });

      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(
          screen.getByText(label('settings.paymentSettings.validation.helixPayApiKeyRequired'))
        ).toBeInTheDocument();
      });
    });

    it('should save the Helix-Pay API key', async () => {
      mockApi({
        methods: [{ id: 'pm-2', name: 'Helix-Pay' }],
        settings: { ...mockPaymentSettings, helixPayEnabled: true, helixPayApiKey: 'hp_key_1' },
      });

      render(<PaymentSettingsTab />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('hp_key_1')).toBeInTheDocument();
      });

      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'PUT',
            url: SETTINGS_URL,
            data: expect.objectContaining({ helixPayEnabled: true, helixPayApiKey: 'hp_key_1' }),
          })
        );
      });
    });
  });

  describe('Offline payments', () => {
    it('should toggle cheque payments', async () => {
      render(<PaymentSettingsTab />);

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: field('chequePaymentsEnabled') })).toBeChecked();
      });

      fireEvent.click(screen.getByRole('checkbox', { name: field('chequePaymentsEnabled') }));

      expect(
        screen.getByRole('checkbox', { name: field('chequePaymentsEnabled') })
      ).not.toBeChecked();
    });

    it('should show cheque instructions when cheque payments are enabled', async () => {
      render(<PaymentSettingsTab />);

      await waitFor(() => {
        expect(screen.getByLabelText(fieldLabel('chequePaymentInstructions'))).toBeInTheDocument();
      });

      expect(
        screen.getByDisplayValue('Please make cheques payable to Test Org')
      ).toBeInTheDocument();
    });
  });

  describe('Saving', () => {
    it('should save payment settings when the save button is clicked', async () => {
      render(<PaymentSettingsTab />);

      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Please make cheques payable to Test Org')
        ).toBeInTheDocument();
      });

      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'PUT', url: SETTINGS_URL })
        );
      });
    });

    it('should display a success message after a successful save', async () => {
      render(<PaymentSettingsTab />);

      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Please make cheques payable to Test Org')
        ).toBeInTheDocument();
      });

      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(
          screen.getByText(label('settings.paymentSettings.messages.saveSuccess'))
        ).toBeInTheDocument();
      });
    });

    it('should display an error message when the save fails', async () => {
      mockApi({ save: { message: 'Failed to save' }, saveRejects: true });

      render(<PaymentSettingsTab />);

      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Please make cheques payable to Test Org')
        ).toBeInTheDocument();
      });

      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(screen.getByText('Failed to save')).toBeInTheDocument();
      });
    });
  });

  describe('Secret visibility', () => {
    it('should toggle visibility for the Helix-Pay API key', async () => {
      mockApi({
        methods: [{ id: 'pm-2', name: 'Helix-Pay' }],
        settings: { ...mockPaymentSettings, helixPayEnabled: true, helixPayApiKey: 'hp_key_1' },
      });

      render(<PaymentSettingsTab />);

      await waitFor(() => {
        expect(screen.getByLabelText(fieldLabel('helixPayApiKey'))).toBeInTheDocument();
      });

      const apiKey = screen.getByLabelText(fieldLabel('helixPayApiKey'));
      expect(apiKey).toHaveAttribute('type', 'password');

      const toggle = apiKey.parentElement!.querySelector('button')!;
      fireEvent.click(toggle);

      expect(screen.getByLabelText(fieldLabel('helixPayApiKey'))).toHaveAttribute('type', 'text');
    });
  });
});
