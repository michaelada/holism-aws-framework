/**
 * Create/Edit Merchandise Type Page
 * 
 * Comprehensive form for creating or editing merchandise types with all configuration sections.
 */

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
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
import ImageGalleryUpload from '../components/ImageGalleryUpload';
import OptionsConfigurationSection from '../components/OptionsConfigurationSection';
import StockManagementSection from '../components/StockManagementSection';
import DeliveryConfigurationSection from '../components/DeliveryConfigurationSection';
import OrderQuantityRulesSection from '../components/OrderQuantityRulesSection';
import type { MerchandiseTypeFormData, MerchandiseStatus, DeliveryType } from '../types/merchandise.types';

const CreateMerchandiseTypePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

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
    useTermsAndConditions: false,
  });

  const [saving, setSaving] = useState(false);

  const handleFieldChange = (field: keyof MerchandiseTypeFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
          {isEdit ? 'Edit Merchandise Type' : 'Create Merchandise Type'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button onClick={() => navigate('/merchandise')}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving || !formData.name || formData.images.length === 0}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      </Box>

      {/* Basic Information */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Basic Information</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              multiline
              rows={3}
              required
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                label="Status"
                onChange={(e) => handleFieldChange('status', e.target.value)}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
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
          <Typography variant="h6" sx={{ mb: 2 }}>Application Form</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={formData.requireApplicationForm}
                onChange={(e) => handleFieldChange('requireApplicationForm', e.target.checked)}
              />
            }
            label="Require Application Form"
          />
          {formData.requireApplicationForm && (
            <TextField
              label="Application Form"
              select
              value={formData.applicationFormId || ''}
              onChange={(e) => handleFieldChange('applicationFormId', e.target.value)}
              fullWidth
              sx={{ mt: 2 }}
            >
              <MenuItem value="">Select a form...</MenuItem>
            </TextField>
          )}
        </CardContent>
      </Card>

      {/* Payment Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Payment Configuration</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={formData.useTermsAndConditions}
                onChange={(e) => handleFieldChange('useTermsAndConditions', e.target.checked)}
              />
            }
            label="Use Terms and Conditions"
          />
          {formData.useTermsAndConditions && (
            <TextField
              label="Terms and Conditions"
              value={formData.termsAndConditions || ''}
              onChange={(e) => handleFieldChange('termsAndConditions', e.target.value)}
              multiline
              rows={4}
              fullWidth
              sx={{ mt: 2 }}
            />
          )}
        </CardContent>
      </Card>

      {/* Email Notifications */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Email Notifications</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Admin Notification Emails"
              value={formData.adminNotificationEmails || ''}
              onChange={(e) => handleFieldChange('adminNotificationEmails', e.target.value)}
              placeholder="email1@example.com, email2@example.com"
              helperText="Comma-separated email addresses"
              fullWidth
            />
            <TextField
              label="Custom Confirmation Message"
              value={formData.customConfirmationMessage || ''}
              onChange={(e) => handleFieldChange('customConfirmationMessage', e.target.value)}
              multiline
              rows={3}
              placeholder="Custom message to include in order confirmation emails"
              fullWidth
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CreateMerchandiseTypePage;
