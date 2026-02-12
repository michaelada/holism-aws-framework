/**
 * Field Configuration Table Component
 * 
 * Displays all fields from selected membership form with toggle for each field:
 * Common to all / Unique for each person
 * Only shown for group membership types
 */

import React from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { FieldConfiguration } from '../types/membership.types';

interface ApplicationField {
  id: string;
  name: string;
  label: string;
  datatype: string;
  required: boolean;
}

interface FieldConfigurationTableProps {
  fields: ApplicationField[];
  fieldConfiguration: Record<string, FieldConfiguration>;
  onChange: (fieldId: string, configuration: FieldConfiguration) => void;
}

const FieldConfigurationTable: React.FC<FieldConfigurationTableProps> = ({
  fields,
  fieldConfiguration,
  onChange,
}) => {
  if (fields.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">
          Select a membership form to configure field sharing
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Field Name</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Required</TableCell>
            <TableCell align="center">Configuration</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {fields.map((field) => (
            <TableRow key={field.id}>
              <TableCell>
                <Typography variant="body2" fontWeight="medium">
                  {field.label}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {field.datatype}
                </Typography>
              </TableCell>
              <TableCell>
                {field.required ? 'Yes' : 'No'}
              </TableCell>
              <TableCell align="center">
                <ToggleButtonGroup
                  value={fieldConfiguration[field.id] || 'unique'}
                  exclusive
                  onChange={(_, value) => {
                    if (value !== null) {
                      onChange(field.id, value);
                    }
                  }}
                  size="small"
                >
                  <ToggleButton value="common">
                    Common to all
                  </ToggleButton>
                  <ToggleButton value="unique">
                    Unique for each
                  </ToggleButton>
                </ToggleButtonGroup>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default FieldConfigurationTable;
