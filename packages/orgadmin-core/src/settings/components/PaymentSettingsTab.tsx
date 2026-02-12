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

const CURRENCIES = [
  { value: 'GBP', label: '£ GBP - British Pound' },
  { value: 'EUR', label: '€ EUR - Euro' },
  { value: 'USD', label: '$ USD - US Dollar' },
  { value: 'AUD', label: '$ AUD - Australian Dollar' },
  { value: 'CAD', label: '$ CAD - Canadian Dollar' },
];

const PaymentSettingsTab: React.FC = () => {
  const { execute } = useApi();
  
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
      setError(err.message || 'Failed to load payment settings');
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
          setError('Stripe publishable key and secret key are required when Stripe is enabled');
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
      setError(err.message || 'Failed to save payment settings');
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
        Payment Settings
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Configure payment processing and accepted payment methods
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Payment settings saved successfully
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom>
            Stripe Configuration
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
            label="Enable Stripe Payments"
          />
        </Grid>

        {formData.stripeEnabled && (
          <>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Stripe Publishable Key"
                value={formData.stripePublishableKey}
                onChange={(e) => handleChange('stripePublishableKey', e.target.value)}
                placeholder="pk_live_..."
                required
                helperText="Your Stripe publishable key (starts with pk_)"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Stripe Secret Key"
                type={showSecretKey ? 'text' : 'password'}
                value={formData.stripeSecretKey}
                onChange={(e) => handleChange('stripeSecretKey', e.target.value)}
                placeholder="sk_live_..."
                required
                helperText="Your Stripe secret key (starts with sk_)"
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
                label="Stripe Webhook Secret"
                type={showWebhookSecret ? 'text' : 'password'}
                value={formData.stripeWebhookSecret}
                onChange={(e) => handleChange('stripeWebhookSecret', e.target.value)}
                placeholder="whsec_..."
                helperText="Your Stripe webhook signing secret (optional)"
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
            Payment Configuration
          </Typography>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            select
            label="Default Currency"
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
            label="Handling Fee (%)"
            type="number"
            value={formData.handlingFeePercentage}
            onChange={(e) => handleChange('handlingFeePercentage', parseFloat(e.target.value) || 0)}
            inputProps={{ min: 0, max: 100, step: 0.1 }}
            helperText="Percentage fee added to card payments"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Fixed Handling Fee"
            type="number"
            value={formData.handlingFeeFixed}
            onChange={(e) => handleChange('handlingFeeFixed', parseFloat(e.target.value) || 0)}
            inputProps={{ min: 0, step: 0.01 }}
            InputProps={{
              startAdornment: <InputAdornment position="start">£</InputAdornment>,
            }}
            helperText="Fixed fee added to card payments"
          />
        </Grid>

        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
            Offline Payments
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
            label="Enable Cheque/Offline Payments"
          />
        </Grid>

        {formData.chequePaymentsEnabled && (
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Cheque Payment Instructions"
              value={formData.chequePaymentInstructions}
              onChange={(e) => handleChange('chequePaymentInstructions', e.target.value)}
              multiline
              rows={4}
              placeholder="Please make cheques payable to..."
              helperText="Instructions shown to users when selecting cheque/offline payment"
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
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PaymentSettingsTab;
