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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  
  if (fields.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">
          {t('memberships.personConfig.selectForm')}
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('memberships.fields.fieldName')}</TableCell>
            <TableCell>{t('memberships.fields.fieldType')}</TableCell>
            <TableCell>{t('memberships.fields.required')}</TableCell>
            <TableCell align="center">{t('memberships.fields.configuration')}</TableCell>
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
                {field.required ? t('memberships.fields.yes') : t('memberships.fields.no')}
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
                    {t('memberships.fieldConfig.commonToAll')}
                  </ToggleButton>
                  <ToggleButton value="unique">
                    {t('memberships.fieldConfig.uniqueForEach')}
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
