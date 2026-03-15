/**
 * Discount Selector Component
 * 
 * Multi-select component for selecting discounts to apply to entities.
 * Supports search functionality and displays selected discounts as removable chips.
 * Only displays active discounts.
 * 
 * Requirements: 4.3, 4.4, 4.5, 4.6
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  TextField,
  Typography,
  CircularProgress,
  SelectChangeEvent,
  InputAdornment,
} from '@mui/material';
import {
  LocalOffer as DiscountIcon,
  Search as SearchIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

export interface Discount {
  id: string;
  name: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  status: 'active' | 'inactive' | 'expired';
  code?: string;
}

export interface DiscountSelectorProps {
  /** Array of selected discount IDs */
  selectedDiscountIds: string[];
  
  /** Callback when selection changes */
  onChange: (discountIds: string[]) => void;
  
  /** Organization ID for fetching discounts */
  organisationId: string;
  
  /** Module type to filter discounts */
  moduleType: 'events' | 'memberships' | 'calendar' | 'merchandise' | 'registrations';
  
  /** Optional: Pre-loaded discounts array (if provided, skips fetching) */
  discounts?: Discount[];
  
  /** Optional: Function to fetch discounts (required if discounts not provided) */
  fetchDiscounts?: (organisationId: string, moduleType: string) => Promise<Discount[]>;
  
  /** Optional: Disable the selector */
  disabled?: boolean;
  
  /** Optional: Label for the selector */
  label?: string;
  
  /** Optional: Helper text */
  helperText?: string;
}

export const DiscountSelector: React.FC<DiscountSelectorProps> = ({
  selectedDiscountIds,
  onChange,
  organisationId,
  moduleType,
  discounts: providedDiscounts,
  fetchDiscounts,
  disabled = false,
  label = 'Select Discounts',
  helperText,
}) => {
  const [discounts, setDiscounts] = useState<Discount[]>(providedDiscounts || []);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch discounts if not provided
  useEffect(() => {
    if (providedDiscounts) {
      setDiscounts(providedDiscounts);
      return;
    }

    if (!fetchDiscounts) {
      console.warn('DiscountSelector: Either discounts or fetchDiscounts prop must be provided');
      return;
    }

    const loadDiscounts = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedDiscounts = await fetchDiscounts(organisationId, moduleType);
        setDiscounts(fetchedDiscounts);
      } catch (err) {
        console.error('Failed to fetch discounts:', err);
        setError('Failed to load discounts');
        setDiscounts([]);
      } finally {
        setLoading(false);
      }
    };

    loadDiscounts();
  }, [organisationId, moduleType, providedDiscounts, fetchDiscounts]);

  // Filter to only active discounts
  const activeDiscounts = useMemo(() => {
    return discounts.filter(d => d.status === 'active');
  }, [discounts]);

  // Filter discounts based on search term
  const filteredDiscounts = useMemo(() => {
    if (!searchTerm) return activeDiscounts;
    
    const lowerSearch = searchTerm.toLowerCase();
    return activeDiscounts.filter(discount => 
      discount.name.toLowerCase().includes(lowerSearch) ||
      discount.description?.toLowerCase().includes(lowerSearch) ||
      discount.code?.toLowerCase().includes(lowerSearch)
    );
  }, [activeDiscounts, searchTerm]);

  // Get selected discount objects
  const selectedDiscounts = useMemo(() => {
    return (selectedDiscountIds || [])
      .map(id => activeDiscounts.find(d => d.id === id))
      .filter((d): d is Discount => d !== undefined);
  }, [selectedDiscountIds, activeDiscounts]);

  const handleSelectChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    onChange(typeof value === 'string' ? [value] : value);
  };

  const handleRemoveDiscount = (discountId: string) => {
    onChange(selectedDiscountIds.filter(id => id !== discountId));
  };

  const getDiscountLabel = (discount: Discount): string => {
    const valueStr = discount.discountType === 'percentage'
      ? `${discount.discountValue}%`
      : `$${discount.discountValue.toFixed(2)}`;
    
    return `${discount.name} (${valueStr})`;
  };

  const getDiscountValueDisplay = (discount: Discount): string => {
    return discount.discountType === 'percentage'
      ? `${discount.discountValue}%`
      : `$${discount.discountValue.toFixed(2)}`;
  };

  // Don't render if no active discounts and not loading
  if (!loading && activeDiscounts.length === 0) {
    return null;
  }

  return (
    <Box sx={{ width: '100%' }}>
      <FormControl fullWidth disabled={disabled || loading}>
        <InputLabel id="discount-selector-label">{label}</InputLabel>
        <Select
          labelId="discount-selector-label"
          multiple
          value={selectedDiscountIds || []}
          onChange={handleSelectChange}
          label={label}
          renderValue={() => null} // We'll render chips below instead
          MenuProps={{
            PaperProps: {
              style: {
                maxHeight: 400,
              },
            },
          }}
        >
          {/* Search field in dropdown */}
          <Box sx={{ px: 2, py: 1, position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search discounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {loading ? (
            <MenuItem disabled>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2">Loading discounts...</Typography>
              </Box>
            </MenuItem>
          ) : filteredDiscounts.length === 0 ? (
            <MenuItem disabled>
              <Typography variant="body2" color="textSecondary">
                {searchTerm ? 'No discounts match your search' : 'No active discounts available'}
              </Typography>
            </MenuItem>
          ) : (
            filteredDiscounts.map((discount) => (
              <MenuItem key={discount.id} value={discount.id}>
                <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" fontWeight="medium">
                      {discount.name}
                    </Typography>
                    <Chip
                      label={getDiscountValueDisplay(discount)}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ ml: 1 }}
                    />
                  </Box>
                  {discount.description && (
                    <Typography variant="caption" color="textSecondary">
                      {discount.description}
                    </Typography>
                  )}
                  <Typography variant="caption" color="textSecondary">
                    Type: {discount.discountType === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                  </Typography>
                </Box>
              </MenuItem>
            ))
          )}
        </Select>
        {helperText && (
          <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, ml: 1.5 }}>
            {helperText}
          </Typography>
        )}
        {error && (
          <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
            {error}
          </Typography>
        )}
      </FormControl>

      {/* Selected discounts as removable chips */}
      {selectedDiscounts.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
          {selectedDiscounts.map((discount) => (
            <Chip
              key={discount.id}
              icon={<DiscountIcon />}
              label={getDiscountLabel(discount)}
              onDelete={disabled ? undefined : () => handleRemoveDiscount(discount.id)}
              deleteIcon={<CloseIcon />}
              color="primary"
              variant="outlined"
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default DiscountSelector;
