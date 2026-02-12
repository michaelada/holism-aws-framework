/**
 * Options Configuration Section Component
 * 
 * Manages multiple option types (Size, Color, Pack, etc.) with add/remove functionality.
 * Supports reordering and price configuration for each option value.
 */

import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  TextField,
  Typography,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';

interface OptionValue {
  name: string;
  price: number;
  sku?: string;
  stockQuantity?: number;
}

interface OptionType {
  name: string;
  optionValues: OptionValue[];
}

interface OptionsConfigurationSectionProps {
  optionTypes: OptionType[];
  onChange: (optionTypes: OptionType[]) => void;
  trackStock?: boolean;
}

const OptionsConfigurationSection: React.FC<OptionsConfigurationSectionProps> = ({
  optionTypes,
  onChange,
  trackStock = false,
}) => {
  const handleAddOptionType = () => {
    onChange([...optionTypes, { name: '', optionValues: [] }]);
  };

  const handleRemoveOptionType = (index: number) => {
    const updated = optionTypes.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleOptionTypeNameChange = (index: number, name: string) => {
    const updated = [...optionTypes];
    updated[index] = { ...updated[index], name };
    onChange(updated);
  };

  const handleAddOptionValue = (typeIndex: number) => {
    const updated = [...optionTypes];
    updated[typeIndex] = {
      ...updated[typeIndex],
      optionValues: [...updated[typeIndex].optionValues, { name: '', price: 0 }],
    };
    onChange(updated);
  };

  const handleRemoveOptionValue = (typeIndex: number, valueIndex: number) => {
    const updated = [...optionTypes];
    updated[typeIndex] = {
      ...updated[typeIndex],
      optionValues: updated[typeIndex].optionValues.filter((_, i) => i !== valueIndex),
    };
    onChange(updated);
  };

  const handleOptionValueChange = (
    typeIndex: number,
    valueIndex: number,
    field: keyof OptionValue,
    value: any
  ) => {
    const updated = [...optionTypes];
    updated[typeIndex] = {
      ...updated[typeIndex],
      optionValues: updated[typeIndex].optionValues.map((ov, i) =>
        i === valueIndex ? { ...ov, [field]: value } : ov
      ),
    };
    onChange(updated);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Options Configuration</Typography>
        <Button startIcon={<AddIcon />} onClick={handleAddOptionType}>
          Add Option Type
        </Button>
      </Box>

      {optionTypes.map((optionType, typeIndex) => (
        <Card key={typeIndex} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
              <DragIcon sx={{ cursor: 'move', color: 'text.secondary' }} />
              <TextField
                label="Option Type Name"
                value={optionType.name}
                onChange={(e) => handleOptionTypeNameChange(typeIndex, e.target.value)}
                placeholder="e.g., Size, Color, Pack Type"
                fullWidth
                required
              />
              <IconButton onClick={() => handleRemoveOptionType(typeIndex)} color="error">
                <DeleteIcon />
              </IconButton>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Option Values
            </Typography>

            {optionType.optionValues.map((optionValue, valueIndex) => (
              <Box key={valueIndex} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                <DragIcon sx={{ cursor: 'move', color: 'text.secondary' }} />
                <TextField
                  label="Name"
                  value={optionValue.name}
                  onChange={(e) =>
                    handleOptionValueChange(typeIndex, valueIndex, 'name', e.target.value)
                  }
                  placeholder="e.g., Small, Medium, Large"
                  required
                />
                <TextField
                  label="Price"
                  type="number"
                  value={optionValue.price}
                  onChange={(e) =>
                    handleOptionValueChange(typeIndex, valueIndex, 'price', parseFloat(e.target.value) || 0)
                  }
                  inputProps={{ min: 0, step: 0.01 }}
                  required
                />
                <TextField
                  label="SKU"
                  value={optionValue.sku || ''}
                  onChange={(e) =>
                    handleOptionValueChange(typeIndex, valueIndex, 'sku', e.target.value)
                  }
                  placeholder="Optional"
                />
                {trackStock && (
                  <TextField
                    label="Stock Quantity"
                    type="number"
                    value={optionValue.stockQuantity || 0}
                    onChange={(e) =>
                      handleOptionValueChange(typeIndex, valueIndex, 'stockQuantity', parseInt(e.target.value) || 0)
                    }
                    inputProps={{ min: 0 }}
                  />
                )}
                <IconButton onClick={() => handleRemoveOptionValue(typeIndex, valueIndex)} color="error">
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}

            <Button
              startIcon={<AddIcon />}
              onClick={() => handleAddOptionValue(typeIndex)}
              size="small"
            >
              Add Option Value
            </Button>
          </CardContent>
        </Card>
      ))}

      {optionTypes.length === 0 && (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          No option types configured. Click "Add Option Type" to get started.
        </Typography>
      )}
    </Box>
  );
};

export default OptionsConfigurationSection;
