/**
 * Create/Edit Merchandise Type Page
 * 
 * Comprehensive form for creating or editing merchandise types with all configuration sections.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
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
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useTranslation, useCapabilities } from '@aws-web-framework/orgadmin-shell';
import { useOrganisation, useApi } from '@aws-web-framework/orgadmin-core';
import { DiscountSelector } from '@aws-web-framework/components';
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
  const { hasCapability } = useCapabilities();
  const { organisation } = useOrganisation();
  const { execute } = useApi();

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [applicationForms, setApplicationForms] = useState<{id: string, name: string}[]>([]);

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const handleFieldChange = (field: keyof MerchandiseTypeFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  useEffect(() => {
    if (id) {
      loadMerchandiseType(id);
    }
  }, [id]);

  useEffect(() => {
    if (formData.requireApplicationForm && organisation?.id) {
      loadApplicationForms();
    }
  }, [formData.requireApplicationForm, organisation?.id]);

  const loadMerchandiseType = async (merchandiseTypeId: string) => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/merchandise-types/${merchandiseTypeId}`,
      });
      if (response) {
        const data = response as any;
        setFormData({
          name: data.name || '',
          description: data.description || '',
          images: data.images || [],
          status: data.status || 'active',
          optionTypes: (data.optionTypes || []).map((ot: any) => ({
            name: ot.name,
            optionValues: (ot.optionValues || []).map((ov: any) => ({
              name: ov.name,
              price: ov.price,
              sku: ov.sku,
              stockQuantity: ov.stockQuantity,
            })),
          })),
          trackStockLevels: data.trackStockLevels ?? false,
          lowStockAlert: data.lowStockAlert,
          outOfStockBehavior: data.outOfStockBehavior,
          deliveryType: data.deliveryType || 'free',
          deliveryFee: data.deliveryFee,
          deliveryRules: data.deliveryRules?.map((r: any) => ({
            minQuantity: r.minQuantity,
            maxQuantity: r.maxQuantity,
            deliveryFee: r.deliveryFee,
          })),
          minOrderQuantity: data.minOrderQuantity,
          maxOrderQuantity: data.maxOrderQuantity,
          quantityIncrements: data.quantityIncrements,
          requireApplicationForm: data.requireApplicationForm ?? false,
          applicationFormId: data.applicationFormId,
          supportedPaymentMethods: data.supportedPaymentMethods || [],
          handlingFeeIncluded: data.handlingFeeIncluded ?? false,
          useTermsAndConditions: data.useTermsAndConditions ?? false,
          termsAndConditions: data.termsAndConditions,
          discountIds: data.discountIds,
          adminNotificationEmails: data.adminNotificationEmails,
          customConfirmationMessage: data.customConfirmationMessage,
        });
        // Store signed URLs for display (separate from S3 keys)
        setImageUrls(data.imageUrls || []);
      }
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Failed to load merchandise type';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/payment-methods',
      });
      setPaymentMethods((response as PaymentMethod[]) || []);
    } catch (err) {
      console.error('Failed to load payment methods:', err);
      setError(t('merchandise.errors.paymentMethodsLoadFailed'));
      setPaymentMethods([]);
    }
  };

  const loadApplicationForms = async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisation?.id}/application-forms`,
      });
      setApplicationForms(response || []);
    } catch (err) {
      console.error('Failed to load application forms:', err);
      setApplicationForms([]);
    }
  };

  const isCardPaymentMethod = (methodId: string) => {
    const method = paymentMethods.find(pm => pm.id === methodId);
    if (!method) return methodId === 'stripe' || methodId === 'card';
    const name = (method.name || '').toLowerCase();
    return name.includes('card') || name.includes('stripe') || name.includes('helix');
  };

  const fetchDiscounts = useCallback(async (organisationId: string, moduleType: string) => {
    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisationId}/discounts/${moduleType}`,
      });
      return response.discounts || [];
    } catch (error) {
      console.error('Failed to fetch discounts:', error);
      return [];
    }
  }, [execute]);
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
    setError(null);
    try {
      if (isEdit) {
        await execute({
          method: 'PUT',
          url: `/api/orgadmin/merchandise-types/${id}`,
          data: formData,
        });
      } else {
        await execute({
          method: 'POST',
          url: '/api/orgadmin/merchandise-types',
          data: { ...formData, organisationId: organisation?.id },
        });
      }
      navigate('/merchandise');
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Failed to save merchandise type';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('common.loading')}</Typography>
      </Box>
    );
  }

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

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

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
            imageUrls={imageUrls}
            onChange={(images) => handleFieldChange('images', images)}
            organisationId={organisation?.id || ''}
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
              {applicationForms.map((form) => (
                <MenuItem key={form.id} value={form.id}>
                  {form.name}
                </MenuItem>
              ))}
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
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t('merchandise.fields.termsAndConditionsContent')}
                </Typography>
                <ReactQuill
                  theme="snow"
                  value={formData.termsAndConditions || ''}
                  onChange={(value) => handleFieldChange('termsAndConditions', value)}
                  modules={{
                    toolbar: [
                      [{ header: [1, 2, 3, false] }],
                      ['bold', 'italic', 'underline'],
                      [{ list: 'ordered' }, { list: 'bullet' }],
                      ['clean'],
                    ],
                  }}
                />
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Discounts */}
      {hasCapability('merchandise-discounts') && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>{t('merchandise.sections.discounts')}</Typography>
            <DiscountSelector
              selectedDiscountIds={formData.discountIds || []}
              onChange={(discountIds) => handleFieldChange('discountIds', discountIds)}
              organisationId={organisation?.id || ''}
              moduleType="merchandise"
              fetchDiscounts={fetchDiscounts}
              label={t('merchandise.fields.selectDiscounts')}
              helperText={t('merchandise.fields.selectDiscountsHelper')}
              currencyCode={organisation?.currency || 'EUR'}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('merchandise.fields.noDiscountsHint')}
            </Typography>
          </CardContent>
        </Card>
      )}

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
