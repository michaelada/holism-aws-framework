/**
 * Discount Summary Component
 * 
 * Displays applied discounts with price breakdown.
 * Shows original price, discount amounts, and final price.
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Divider,
  Chip,
  Stack,
} from '@mui/material';
import {
  LocalOffer as DiscountIcon,
  TrendingDown as SavingsIcon,
} from '@mui/icons-material';

export interface AppliedDiscount {
  discountId: string;
  discountName: string;
  discountAmount: number;
}

export interface DiscountSummaryProps {
  discounts: Array<{
    id: string;
    name: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
  }>;
  originalAmount: number;
  finalAmount: number;
  appliedDiscounts: AppliedDiscount[];
  currency?: string;
  showSavingsPercentage?: boolean;
}

export const DiscountSummary: React.FC<DiscountSummaryProps> = ({
  discounts,
  originalAmount,
  finalAmount,
  appliedDiscounts,
  currency = '$',
  showSavingsPercentage = true,
}) => {
  // Don't render if no discounts applied
  if (appliedDiscounts.length === 0) {
    return null;
  }

  const totalDiscount = originalAmount - finalAmount;
  const savingsPercentage = originalAmount > 0 
    ? ((totalDiscount / originalAmount) * 100).toFixed(1)
    : '0';

  const formatAmount = (amount: number): string => {
    return `${currency}${amount.toFixed(2)}`;
  };

  return (
    <Paper 
      variant="outlined" 
      sx={{ 
        p: 2, 
        bgcolor: 'success.50',
        borderColor: 'success.main',
        borderWidth: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <DiscountIcon color="success" />
        <Typography variant="h6" color="success.main">
          Discounts Applied
        </Typography>
      </Box>

      <Stack spacing={1.5}>
        {/* Original Amount */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="textSecondary">
            Original Price:
          </Typography>
          <Typography variant="body2">
            {formatAmount(originalAmount)}
          </Typography>
        </Box>

        <Divider />

        {/* Individual Discounts */}
        {appliedDiscounts.map((applied) => {
          const discount = discounts.find(d => d.id === applied.discountId);
          
          return (
            <Box 
              key={applied.discountId}
              sx={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="success.dark">
                  {applied.discountName}
                </Typography>
                {discount && (
                  <Chip
                    label={
                      discount.discountType === 'percentage'
                        ? `${discount.discountValue}%`
                        : formatAmount(discount.discountValue)
                    }
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                )}
              </Box>
              <Typography variant="body2" color="success.dark" fontWeight="medium">
                -{formatAmount(applied.discountAmount)}
              </Typography>
            </Box>
          );
        })}

        <Divider />

        {/* Total Discount */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body1" fontWeight="medium" color="success.dark">
            Total Discount:
          </Typography>
          <Typography variant="body1" fontWeight="medium" color="success.dark">
            -{formatAmount(totalDiscount)}
          </Typography>
        </Box>

        {/* Final Amount */}
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            pt: 1,
            borderTop: 2,
            borderColor: 'success.main',
          }}
        >
          <Typography variant="h6" color="success.main">
            Final Price:
          </Typography>
          <Typography variant="h6" color="success.main">
            {formatAmount(finalAmount)}
          </Typography>
        </Box>

        {/* Savings Badge */}
        {showSavingsPercentage && totalDiscount > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
            <Chip
              icon={<SavingsIcon />}
              label={`You save ${savingsPercentage}%!`}
              color="success"
              sx={{ fontWeight: 'bold' }}
            />
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

export default DiscountSummary;
