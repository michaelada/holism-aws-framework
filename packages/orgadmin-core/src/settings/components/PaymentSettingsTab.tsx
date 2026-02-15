/**
 * Payment Settings Tab
 * 
 * Form for managing Stripe configuration, currency, and payment method settings
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Grid,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
  MenuItem,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Save as SaveIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../hooks/useApi';

interface PaymentSettings {
  stripeEnabled: boolean;
  stripePublishableKey: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  defaultCurrency: string;
  acceptedPaymentMethods: string[];
  handlingFeePercentage: number;
  handlingFeeFixed: number;
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
  
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  
  const [formData, setFormData] = useState<PaymentSettings>({
    stripeEnabled: false,
    stripePublishableKey: '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    defaultCurrency: 'GBP',
    acceptedPaymentMethods: ['card'],
    handlingFeePercentage: 0,
    handlingFeeFixed: 0,
    chequePaymentsEnabled: false,
    chequePaymentInstructions: '',
  });

  const CURRENCIES = [
    { value: 'GBP', label: t('settings.organisationDetails.currencies.gbp') },
    { value: 'EUR', label: t('settings.organisationDetails.currencies.eur') },
    { value: 'USD', label: t('settings.organisationDetails.currencies.usd') },
    { value: 'AUD', label: t('settings.organisationDetails.currencies.aud') },
    { value: 'CAD', label: t('settings.organisationDetails.currencies.cad') },
  ];

  useEffect(() => {
    loadPaymentSettings();
  }, []);

  const loadPaymentSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/organisation/payment-settings',
      });
      
      if (response) {
        setFormData({
          stripeEnabled: response.stripeEnabled || false,
          stripePublishableKey: response.stripePublishableKey || '',
          stripeSecretKey: response.stripeSecretKey || '',
          stripeWebhookSecret: response.stripeWebhookSecret || '',
          defaultCurrency: response.defaultCurrency || 'GBP',
          acceptedPaymentMethods: response.acceptedPaymentMethods || ['card'],
          handlingFeePercentage: response.handlingFeePercentage || 0,
          handlingFeeFixed: response.handlingFeeFixed || 0,
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

      // Validate Stripe keys if enabled
      if (formData.stripeEnabled) {
        if (!formData.stripePublishableKey || !formData.stripeSecretKey) {
          setError(t('settings.paymentSettings.validation.stripeKeysRequired'));
          setSaving(false);
          return;
        }
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
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom>
            {t('settings.paymentSettings.sections.stripeConfig')}
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.stripeEnabled}
                onChange={(e) => handleChange('stripeEnabled', e.target.checked)}
              />
            }
            label={t('settings.paymentSettings.fields.stripeEnabled')}
          />
        </Grid>

        {formData.stripeEnabled && (
          <>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('settings.paymentSettings.fields.stripePublishableKey')}
                value={formData.stripePublishableKey}
                onChange={(e) => handleChange('stripePublishableKey', e.target.value)}
                placeholder={t('settings.paymentSettings.fields.stripePublishableKeyPlaceholder')}
                required
                helperText={t('settings.paymentSettings.fields.stripePublishableKeyHelper')}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('settings.paymentSettings.fields.stripeSecretKey')}
                type={showSecretKey ? 'text' : 'password'}
                value={formData.stripeSecretKey}
                onChange={(e) => handleChange('stripeSecretKey', e.target.value)}
                placeholder={t('settings.paymentSettings.fields.stripeSecretKeyPlaceholder')}
                required
                helperText={t('settings.paymentSettings.fields.stripeSecretKeyHelper')}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowSecretKey(!showSecretKey)}
                        edge="end"
                      >
                        {showSecretKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('settings.paymentSettings.fields.stripeWebhookSecret')}
                type={showWebhookSecret ? 'text' : 'password'}
                value={formData.stripeWebhookSecret}
                onChange={(e) => handleChange('stripeWebhookSecret', e.target.value)}
                placeholder={t('settings.paymentSettings.fields.stripeWebhookSecretPlaceholder')}
                helperText={t('settings.paymentSettings.fields.stripeWebhookSecretHelper')}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                        edge="end"
                      >
                        {showWebhookSecret ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </>
        )}

        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
            {t('settings.paymentSettings.sections.paymentConfig')}
          </Typography>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            select
            label={t('settings.paymentSettings.fields.defaultCurrency')}
            value={formData.defaultCurrency}
            onChange={(e) => handleChange('defaultCurrency', e.target.value)}
          >
            {CURRENCIES.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('settings.paymentSettings.fields.handlingFeePercentage')}
            type="number"
            value={formData.handlingFeePercentage}
            onChange={(e) => handleChange('handlingFeePercentage', parseFloat(e.target.value) || 0)}
            inputProps={{ min: 0, max: 100, step: 0.1 }}
            helperText={t('settings.paymentSettings.fields.handlingFeePercentageHelper')}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('settings.paymentSettings.fields.handlingFeeFixed')}
            type="number"
            value={formData.handlingFeeFixed}
            onChange={(e) => handleChange('handlingFeeFixed', parseFloat(e.target.value) || 0)}
            inputProps={{ min: 0, step: 0.01 }}
            InputProps={{
              startAdornment: <InputAdornment position="start">£</InputAdornment>,
            }}
            helperText={t('settings.paymentSettings.fields.handlingFeeFixedHelper')}
          />
        </Grid>

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
