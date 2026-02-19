import React from 'react';
import {
  Box,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Typography,
  Chip,
  Paper,
} from '@mui/material';
import type { PaymentMethod } from '../types/payment-method.types';

interface PaymentMethodSelectorProps {
  paymentMethods: PaymentMethod[];
  selectedPaymentMethods: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  paymentMethods,
  selectedPaymentMethods,
  onChange,
  disabled = false,
}) => {
  const handleToggle = (paymentMethodName: string) => {
    const newSelected = selectedPaymentMethods.includes(paymentMethodName)
      ? selectedPaymentMethods.filter((pm) => pm !== paymentMethodName)
      : [...selectedPaymentMethods, paymentMethodName];
    onChange(newSelected);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Payment Methods
      </Typography>
      <FormGroup>
        {paymentMethods.map((paymentMethod) => {
          const isSelected = selectedPaymentMethods.includes(paymentMethod.name);

          return (
            <Box key={paymentMethod.id} display="flex" alignItems="center" gap={1}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isSelected}
                    onChange={() => handleToggle(paymentMethod.name)}
                    disabled={disabled}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">{paymentMethod.displayName}</Typography>
                    {paymentMethod.description && (
                      <Typography variant="caption" color="textSecondary">
                        {paymentMethod.description}
                      </Typography>
                    )}
                  </Box>
                }
              />
              {paymentMethod.requiresActivation && (
                <Chip 
                  label="Requires Activation" 
                  size="small" 
                  color="warning" 
                  variant="outlined" 
                />
              )}
            </Box>
          );
        })}
      </FormGroup>
    </Paper>
  );
};
