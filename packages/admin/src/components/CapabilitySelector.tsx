import React from 'react';
import {
  Box,
  FormControl,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Typography,
  Chip,
  Paper,
} from '@mui/material';
import type { Capability } from '../types/organization.types';

interface CapabilitySelectorProps {
  capabilities: Capability[];
  selectedCapabilities: string[];
  onChange: (selected: string[]) => void;
  defaultCapabilities?: string[];
  disabled?: boolean;
}

export const CapabilitySelector: React.FC<CapabilitySelectorProps> = ({
  capabilities,
  selectedCapabilities,
  onChange,
  defaultCapabilities = [],
  disabled = false,
}) => {
  const handleToggle = (capabilityName: string) => {
    const newSelected = selectedCapabilities.includes(capabilityName)
      ? selectedCapabilities.filter((c) => c !== capabilityName)
      : [...selectedCapabilities, capabilityName];
    onChange(newSelected);
  };

  const coreServices = capabilities.filter((c) => c.category === 'core-service');
  const additionalFeatures = capabilities.filter((c) => c.category === 'additional-feature');

  const renderCapabilityGroup = (title: string, caps: Capability[]) => (
    <Box mb={3}>
      <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
        {title}
      </Typography>
      <FormGroup>
        {caps.map((capability) => {
          const isDefault = defaultCapabilities.includes(capability.name);
          const isSelected = selectedCapabilities.includes(capability.name);

          return (
            <Box key={capability.id} display="flex" alignItems="center" gap={1}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isSelected}
                    onChange={() => handleToggle(capability.name)}
                    disabled={disabled}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">{capability.displayName}</Typography>
                    {capability.description && (
                      <Typography variant="caption" color="textSecondary">
                        {capability.description}
                      </Typography>
                    )}
                  </Box>
                }
              />
              {isDefault && (
                <Chip label="Default" size="small" color="primary" variant="outlined" />
              )}
            </Box>
          );
        })}
      </FormGroup>
    </Box>
  );

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Capabilities
      </Typography>
      {renderCapabilityGroup('Core Services', coreServices)}
      {renderCapabilityGroup('Additional Features', additionalFeatures)}
    </Paper>
  );
};
