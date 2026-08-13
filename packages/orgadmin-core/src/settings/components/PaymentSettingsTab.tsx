/**
 * Payment Settings Tab
 *
 * Form for managing the organisation's payment methods — Helix-Pay and offline
 * (cheque) payments.
 *
 * Card payments via Stripe are **not** configured here. Under Connect
 * destination charges the platform holds the only Stripe credentials (from the
 * environment) and the organisation holds only a connected account id, so the
 * organisation's entire Stripe configuration is the onboarding flow in
 * `StripeConnectPanel` above. The per-organisation key fields that used to sit
 * here belonged to the older direct-charge model and were never read — see
 * docs/ACCOUNT_USER_APP_PHASE8_CHECKOUT.md §1.
 */

import React, { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Save as SaveIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../hooks/useApi';
import StripeConnectPanel from './StripeConnectPanel';

interface PaymentSettings {
  helixPayEnabled: boolean;
  helixPayApiKey: string;
  chequePaymentsEnabled: boolean;
  chequePaymentInstructions: string;
}

const PaymentSettingsTab: React.FC = () => {
  const { execute } = useApi();
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [showHelixApiKey, setShowHelixApiKey] = useState(false);
  const [helixPaySupported, setHelixPaySupported] = useState(false);

  const [formData, setFormData] = useState<PaymentSettings>({
    helixPayEnabled: false,
    helixPayApiKey: '',
    chequePaymentsEnabled: false,
    chequePaymentInstructions: '',
  });

  useEffect(() => {
    loadPaymentSettings();
  }, []);

  const loadPaymentSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load saved payment settings and the org's enabled payment methods.
      // Helix-Pay options are only shown when the org has a Helix-Pay
      // payment method enabled (configured by the super admin).
      const [response, methods] = await Promise.all([
        execute({
          method: 'GET',
          url: '/api/orgadmin/organisation/payment-settings',
        }),
        execute({
          method: 'GET',
          url: '/api/orgadmin/payment-methods',
        }),
      ]);

      if (Array.isArray(methods)) {
        setHelixPaySupported(
          methods.some((pm: { name?: string }) =>
            (pm.name || '').toLowerCase().includes('helix')
          )
        );
      }

      if (response) {
        setFormData({
          helixPayEnabled: response.helixPayEnabled || false,
          helixPayApiKey: response.helixPayApiKey || '',
          chequePaymentsEnabled: response.chequePaymentsEnabled || false,
          chequePaymentInstructions: response.chequePaymentInstructions || '',
        });
      }
    } catch (err: any) {
      setError(err.message || t('settings.paymentSettings.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof PaymentSettings, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setSuccess(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Validate Helix-Pay API key if enabled
      if (formData.helixPayEnabled && !formData.helixPayApiKey) {
        setError(t('settings.paymentSettings.validation.helixPayApiKeyRequired'));
        setSaving(false);
        return;
      }

      await execute({
        method: 'PUT',
        url: '/api/orgadmin/organisation/payment-settings',
        data: formData,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || t('settings.paymentSettings.messages.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/*
        Connect onboarding comes first, because nothing else on this tab
        matters until it is done: without a connected account the club cannot
        be paid at all, and checkout refuses it.
      */}
      <StripeConnectPanel />

      <Divider sx={{ my: 4 }} />

      <Typography variant="h6" gutterBottom>
        {t('settings.paymentSettings.title')}
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        {t('settings.paymentSettings.subtitle')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {t('settings.paymentSettings.messages.saveSuccess')}
        </Alert>
      )}

      <Grid container spacing={3}>
        {helixPaySupported && (
          <>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                {t('settings.paymentSettings.sections.helixPay')}
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.helixPayEnabled}
                    onChange={(e) => handleChange('helixPayEnabled', e.target.checked)}
                  />
                }
                label={t('settings.paymentSettings.fields.helixPayEnabled')}
              />
            </Grid>

            {formData.helixPayEnabled && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('settings.paymentSettings.fields.helixPayApiKey')}
                  type={showHelixApiKey ? 'text' : 'password'}
                  value={formData.helixPayApiKey}
                  onChange={(e) => handleChange('helixPayApiKey', e.target.value)}
                  placeholder={t('settings.paymentSettings.fields.helixPayApiKeyPlaceholder')}
                  required
                  helperText={t('settings.paymentSettings.fields.helixPayApiKeyHelper')}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowHelixApiKey(!showHelixApiKey)}
                          edge="end"
                        >
                          {showHelixApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            )}
          </>
        )}

        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
            {t('settings.paymentSettings.sections.offlinePayments')}
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.chequePaymentsEnabled}
                onChange={(e) => handleChange('chequePaymentsEnabled', e.target.checked)}
              />
            }
            label={t('settings.paymentSettings.fields.chequePaymentsEnabled')}
          />
        </Grid>

        {formData.chequePaymentsEnabled && (
          <Grid item xs={12}>
            <TextField
              fullWidth
              label={t('settings.paymentSettings.fields.chequePaymentInstructions')}
              value={formData.chequePaymentInstructions}
              onChange={(e) => handleChange('chequePaymentInstructions', e.target.value)}
              multiline
              rows={4}
              placeholder={t('settings.paymentSettings.fields.chequePaymentInstructionsPlaceholder')}
              helperText={t('settings.paymentSettings.fields.chequePaymentInstructionsHelper')}
            />
          </Grid>
        )}

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t('settings.actions.saving') : t('settings.actions.saveChanges')}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PaymentSettingsTab;
