/**
 * Create/Edit Merchandise Type Page
 * 
 * Comprehensive form for creating or editing merchandise types with all configuration sections.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Divider,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import { useOrganisation, useApi } from '@aws-web-framework/orgadmin-core';
import ImageGalleryUpload from '../components/ImageGalleryUpload';
import OptionsConfigurationSection from '../components/OptionsConfigurationSection';
import StockManagementSection from '../components/StockManagementSection';
import DeliveryConfigurationSection from '../components/DeliveryConfigurationSection';
import OrderQuantityRulesSection from '../components/OrderQuantityRulesSection';
import type { MerchandiseTypeFormData, MerchandiseStatus, DeliveryType } from '../types/merchandise.types';

interface PaymentMethod {
  id: string;
  name: string;
}

const CreateMerchandiseTypePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { t } = useTranslation();
  const { organisation } = useOrganisation();
  const { execute } = useApi();

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [formData, setFormData] = useState<MerchandiseTypeFormData>({
    name: '',
    description: '',
    images: [],
    status: 'active',
    optionTypes: [],
    trackStockLevels: false,
    deliveryType: 'free',
    requireApplicationForm: false,
    supportedPaymentMethods: [],
    handlingFeeIncluded: false,
    useTermsAndConditions: false,
  });

  const [saving, setSaving] = useState(false);

  const handleFieldChange = (field: keyof MerchandiseTypeFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: '/api/payment-methods',
      });
      const methods = (response as PaymentMethod[]) || [
        { id: 'pay-offline', name: 'Pay Offline' },
        { id: 'stripe', name: 'Card Payment (Stripe)' },
      ];
      setPaymentMethods(methods);
    } catch (err) {
      console.error('Failed to load payment methods:', err);
      setPaymentMethods([
        { id: 'pay-offline', name: 'Pay Offline' },
        { id: 'stripe', name: 'Card Payment (Stripe)' },
      ]);
    }
  };

  const isCardPaymentMethod = (methodId: string) => {
    const method = paymentMethods.find(pm => pm.id === methodId);
    if (!method) return methodId === 'stripe' || methodId === 'card';
    const name = (method.name || '').toLowerCase();
    return name.includes('card') || name.includes('stripe') || name.includes('helix');
  };
  const hasCardPayment = formData.supportedPaymentMethods.some(isCardPaymentMethod);
  const showHandlingFee = hasCardPayment; // Merchandise has inherent pricing (option prices)

  const handlePaymentMethodsChange = (value: any) => {
    const newMethods = value as string[];
    const newHasCard = newMethods.some(isCardPaymentMethod);
    if (!newHasCard && formData.handlingFeeIncluded) {
      setFormData(prev => ({ ...prev, handlingFeeIncluded: false, supportedPaymentMethods: newMethods }));
    } else {
      setFormData(prev => ({ ...prev, supportedPaymentMethods: newMethods }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: Implement API call
      console.log('Saving merchandise type:', formData);
      navigate('/merchandise');
    } catch (error) {
      console.error('Failed to save merchandise type:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {isEdit ? t('merchandise.editMerchandiseType') : t('merchandise.createMerchandiseType')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button onClick={() => navigate('/merchandise')}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving || !formData.name || formData.images.length === 0}
          >
            {saving ? t('merchandise.actions.saving') : t('merchandise.actions.save')}
          </Button>
        </Box>
      </Box>

      {/* Basic Information */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('merchandise.sections.basicInfo')}</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label={t('merchandise.fields.name')}
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              required
              fullWidth
            />
            <TextField
              label={t('merchandise.fields.description')}
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              multiline
              rows={3}
              required
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>{t('merchandise.fields.status')}</InputLabel>
              <Select
                value={formData.status}
                label={t('merchandise.fields.status')}
                onChange={(e) => handleFieldChange('status', e.target.value)}
              >
                <MenuItem value="active">{t('common.status.active')}</MenuItem>
                <MenuItem value="inactive">{t('common.status.inactive')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {/* Images */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <ImageGalleryUpload
            images={formData.images}
            onChange={(images) => handleFieldChange('images', images)}
          />
        </CardContent>
      </Card>

      {/* Options Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <OptionsConfigurationSection
            optionTypes={formData.optionTypes}
            onChange={(optionTypes) => handleFieldChange('optionTypes', optionTypes)}
            trackStock={formData.trackStockLevels}
          />
        </CardContent>
      </Card>

      {/* Stock Management */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <StockManagementSection
            trackStockLevels={formData.trackStockLevels}
            lowStockAlert={formData.lowStockAlert}
            outOfStockBehavior={formData.outOfStockBehavior}
            onChange={handleFieldChange}
          />
        </CardContent>
      </Card>

      {/* Delivery Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <DeliveryConfigurationSection
            deliveryType={formData.deliveryType}
            deliveryFee={formData.deliveryFee}
            deliveryRules={formData.deliveryRules}
            onChange={handleFieldChange}
          />
        </CardContent>
      </Card>

      {/* Order Quantity Rules */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <OrderQuantityRulesSection
            minOrderQuantity={formData.minOrderQuantity}
            maxOrderQuantity={formData.maxOrderQuantity}
            quantityIncrements={formData.quantityIncrements}
            onChange={handleFieldChange}
          />
        </CardContent>
      </Card>

      {/* Application Form */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('merchandise.sections.applicationForm')}</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={formData.requireApplicationForm}
                onChange={(e) => handleFieldChange('requireApplicationForm', e.target.checked)}
              />
            }
            label={t('merchandise.fields.requireApplicationForm')}
          />
          {formData.requireApplicationForm && (
            <TextField
              label={t('merchandise.fields.applicationForm')}
              select
              value={formData.applicationFormId || ''}
              onChange={(e) => handleFieldChange('applicationFormId', e.target.value)}
              fullWidth
              sx={{ mt: 2 }}
            >
              <MenuItem value="">{t('merchandise.fields.selectForm')}</MenuItem>
            </TextField>
          )}
        </CardContent>
      </Card>

      {/* Payment Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('merchandise.sections.payment')}</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>{t('merchandise.fields.supportedPaymentMethods')}</InputLabel>
              <Select
                multiple
                value={formData.supportedPaymentMethods}
                label={t('merchandise.fields.supportedPaymentMethods')}
                onChange={(e) => handlePaymentMethodsChange(e.target.value)}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const method = paymentMethods.find(m => m.id === value);
                      return <Chip key={value} label={method?.name || value} size="small" />;
                    })}
                  </Box>
                )}
              >
                {paymentMethods.map((method) => (
                  <MenuItem key={method.id} value={method.id}>
                    {method.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {showHandlingFee && (
              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.handlingFeeIncluded ?? false}
                      onChange={(e) => handleFieldChange('handlingFeeIncluded', e.target.checked)}
                    />
                  }
                  label={t('payment.handlingFeeIncluded')}
                />
                <Typography variant="body2" color="text.secondary">
                  {t('payment.handlingFeeIncludedHelper')}
                </Typography>
              </Box>
            )}
            <FormControlLabel
              control={
                <Switch
                  checked={formData.useTermsAndConditions}
                  onChange={(e) => handleFieldChange('useTermsAndConditions', e.target.checked)}
                />
              }
              label={t('merchandise.fields.useTermsAndConditions')}
            />
            {formData.useTermsAndConditions && (
              <TextField
                label={t('merchandise.fields.termsAndConditions')}
                value={formData.termsAndConditions || ''}
                onChange={(e) => handleFieldChange('termsAndConditions', e.target.value)}
                multiline
                rows={4}
                fullWidth
              />
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Email Notifications */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('merchandise.sections.emailNotifications')}</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label={t('merchandise.fields.adminNotificationEmails')}
              value={formData.adminNotificationEmails || ''}
              onChange={(e) => handleFieldChange('adminNotificationEmails', e.target.value)}
              placeholder={t('merchandise.fields.adminNotificationEmailsPlaceholder')}
              helperText={t('merchandise.fields.adminNotificationEmailsHelper')}
              fullWidth
            />
            <TextField
              label={t('merchandise.fields.customConfirmationMessage')}
              value={formData.customConfirmationMessage || ''}
              onChange={(e) => handleFieldChange('customConfirmationMessage', e.target.value)}
              multiline
              rows={3}
              placeholder={t('merchandise.fields.customConfirmationMessagePlaceholder')}
              fullWidth
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CreateMerchandiseTypePage;
