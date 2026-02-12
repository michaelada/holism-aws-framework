/**
 * Stock Management Section Component
 * 
 * Handles stock tracking configuration including low stock alerts and out-of-stock behavior.
 */

import React from 'react';
import {
  Box,
  FormControlLabel,
  Switch,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
} from '@mui/material';
import type { OutOfStockBehavior } from '../types/merchandise.types';

interface StockManagementSectionProps {
  trackStockLevels: boolean;
  lowStockAlert?: number;
  outOfStockBehavior?: OutOfStockBehavior;
  onChange: (field: string, value: any) => void;
}

const StockManagementSection: React.FC<StockManagementSectionProps> = ({
  trackStockLevels,
  lowStockAlert,
  outOfStockBehavior,
  onChange,
}) => {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Stock Management
      </Typography>

      <FormControlLabel
        control={
          <Switch
            checked={trackStockLevels}
            onChange={(e) => onChange('trackStockLevels', e.target.checked)}
          />
        }
        label="Track Stock Levels"
      />

      {trackStockLevels && (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Low Stock Alert Threshold"
            type="number"
            value={lowStockAlert || ''}
            onChange={(e) => onChange('lowStockAlert', parseInt(e.target.value) || undefined)}
            inputProps={{ min: 0 }}
            helperText="Alert when stock falls below this quantity"
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel>Out of Stock Behavior</InputLabel>
            <Select
              value={outOfStockBehavior || 'hide'}
              label="Out of Stock Behavior"
              onChange={(e) => onChange('outOfStockBehavior', e.target.value)}
            >
              <MenuItem value="hide">Hide from customers</MenuItem>
              <MenuItem value="show_unavailable">Show as unavailable</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}
    </Box>
  );
};

export default StockManagementSection;
