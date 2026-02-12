/**
 * Order Quantity Rules Section Component
 * 
 * Handles minimum, maximum, and increment quantity rules for orders.
 */

import React from 'react';
import { Box, TextField, Typography } from '@mui/material';

interface OrderQuantityRulesSectionProps {
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
  quantityIncrements?: number;
  onChange: (field: string, value: any) => void;
}

const OrderQuantityRulesSection: React.FC<OrderQuantityRulesSectionProps> = ({
  minOrderQuantity,
  maxOrderQuantity,
  quantityIncrements,
  onChange,
}) => {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Order Quantity Rules
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Minimum Order Quantity"
          type="number"
          value={minOrderQuantity || 1}
          onChange={(e) => onChange('minOrderQuantity', parseInt(e.target.value) || 1)}
          inputProps={{ min: 1 }}
          helperText="Minimum items that must be ordered"
          fullWidth
        />

        <TextField
          label="Maximum Order Quantity"
          type="number"
          value={maxOrderQuantity || ''}
          onChange={(e) => onChange('maxOrderQuantity', e.target.value ? parseInt(e.target.value) : undefined)}
          inputProps={{ min: 1 }}
          helperText="Maximum items allowed per order (leave empty for no limit)"
          placeholder="No limit"
          fullWidth
        />

        <TextField
          label="Quantity Increments"
          type="number"
          value={quantityIncrements || ''}
          onChange={(e) => onChange('quantityIncrements', e.target.value ? parseInt(e.target.value) : undefined)}
          inputProps={{ min: 1 }}
          helperText="Must order in multiples of this number (e.g., 6 for packs of 6)"
          placeholder="Any quantity"
          fullWidth
        />
      </Box>
    </Box>
  );
};

export default OrderQuantityRulesSection;
