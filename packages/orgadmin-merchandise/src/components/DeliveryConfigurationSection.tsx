/**
 * Delivery Configuration Section Component
 * 
 * Handles delivery type selection and configuration (free, fixed, quantity-based).
 */

import React from 'react';
import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import type { DeliveryType } from '../types/merchandise.types';

interface DeliveryRule {
  minQuantity: number;
  maxQuantity?: number;
  deliveryFee: number;
}

interface DeliveryConfigurationSectionProps {
  deliveryType: DeliveryType;
  deliveryFee?: number;
  deliveryRules?: DeliveryRule[];
  onChange: (field: string, value: any) => void;
}

const DeliveryConfigurationSection: React.FC<DeliveryConfigurationSectionProps> = ({
  deliveryType,
  deliveryFee,
  deliveryRules = [],
  onChange,
}) => {
  const { t } = useTranslation();

  const handleAddRule = () => {
    onChange('deliveryRules', [...deliveryRules, { minQuantity: 1, deliveryFee: 0 }]);
  };

  const handleRemoveRule = (index: number) => {
    onChange('deliveryRules', deliveryRules.filter((_, i) => i !== index));
  };

  const handleRuleChange = (index: number, field: keyof DeliveryRule, value: any) => {
    const updated = deliveryRules.map((rule, i) =>
      i === index ? { ...rule, [field]: value } : rule
    );
    onChange('deliveryRules', updated);
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {t('merchandise.delivery.title')}
      </Typography>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>{t('merchandise.delivery.deliveryType')}</InputLabel>
        <Select
          value={deliveryType}
          label={t('merchandise.delivery.deliveryType')}
          onChange={(e) => onChange('deliveryType', e.target.value)}
        >
          <MenuItem value="free">{t('merchandise.delivery.freeDelivery')}</MenuItem>
          <MenuItem value="fixed">{t('merchandise.delivery.fixedFee')}</MenuItem>
          <MenuItem value="quantity_based">{t('merchandise.delivery.quantityBased')}</MenuItem>
        </Select>
      </FormControl>

      {deliveryType === 'fixed' && (
        <TextField
          label={t('merchandise.delivery.deliveryFee')}
          type="number"
          value={deliveryFee || 0}
          onChange={(e) => onChange('deliveryFee', parseFloat(e.target.value) || 0)}
          inputProps={{ min: 0, step: 0.01 }}
          fullWidth
          required
        />
      )}

      {deliveryType === 'quantity_based' && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t('merchandise.delivery.deliveryRules')}
          </Typography>
          {deliveryRules.map((rule, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
              <TextField
                label={t('merchandise.delivery.minQuantity')}
                type="number"
                value={rule.minQuantity}
                onChange={(e) => handleRuleChange(index, 'minQuantity', parseInt(e.target.value) || 1)}
                inputProps={{ min: 1 }}
                required
              />
              <TextField
                label={t('merchandise.delivery.maxQuantity')}
                type="number"
                value={rule.maxQuantity || ''}
                onChange={(e) => handleRuleChange(index, 'maxQuantity', e.target.value ? parseInt(e.target.value) : undefined)}
                inputProps={{ min: 1 }}
                placeholder={t('merchandise.delivery.maxQuantityPlaceholder')}
              />
              <TextField
                label={t('merchandise.delivery.deliveryFee')}
                type="number"
                value={rule.deliveryFee}
                onChange={(e) => handleRuleChange(index, 'deliveryFee', parseFloat(e.target.value) || 0)}
                inputProps={{ min: 0, step: 0.01 }}
                required
              />
              <IconButton onClick={() => handleRemoveRule(index)} color="error">
                <DeleteIcon />
              </IconButton>
            </Box>
          ))}
          <Button startIcon={<AddIcon />} onClick={handleAddRule} size="small">
            {t('merchandise.delivery.addRule')}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default DeliveryConfigurationSection;
