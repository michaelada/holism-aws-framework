/**
 * Create Custom Filter Dialog
 *
 * Dialog for creating custom filter sets for registration searches.
 * Validates: filter name required, at least one criterion, date range consistency.
 *
 * Requirements: 3.5
 */

import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import type { RegistrationFilter } from '../types/registration.types';

interface CreateCustomFilterDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (filter: RegistrationFilter) => void;
}

const CreateCustomFilterDialog: React.FC<CreateCustomFilterDialogProps> = ({
  open,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();

  const [filterName, setFilterName] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState<string[]>([]);
  const [dateLastRenewedAfter, setDateLastRenewedAfter] = useState<Date | null>(null);
  const [dateLastRenewedBefore, setDateLastRenewedBefore] = useState<Date | null>(null);
  const [validUntilAfter, setValidUntilAfter] = useState<Date | null>(null);
  const [validUntilBefore, setValidUntilBefore] = useState<Date | null>(null);
  const [registrationLabels, setRegistrationLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [registrationTypes, setRegistrationTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleStatusChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setRegistrationStatus(typeof value === 'string' ? value.split(',') : value);
  };

  const handleTypesChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setRegistrationTypes(typeof value === 'string' ? value.split(',') : value);
  };

  const handleAddLabel = () => {
    const trimmed = labelInput.trim();
    if (trimmed && !registrationLabels.includes(trimmed)) {
      setRegistrationLabels((prev) => [...prev, trimmed]);
      setLabelInput('');
    }
  };

  const handleDeleteLabel = (label: string) => {
    setRegistrationLabels((prev) => prev.filter((l) => l !== label));
  };

  const hasCriteria = (): boolean => {
    return (
      registrationStatus.length > 0 ||
      dateLastRenewedAfter !== null ||
      dateLastRenewedBefore !== null ||
      validUntilAfter !== null ||
      validUntilBefore !== null ||
      registrationLabels.length > 0 ||
      registrationTypes.length > 0
    );
  };

  const validate = (): string | null => {
    if (!filterName.trim()) {
      return t('registrations.filters.validation.nameRequired');
    }
    if (!hasCriteria()) {
      return t('registrations.filters.validation.criteriaRequired');
    }
    if (
      dateLastRenewedAfter &&
      dateLastRenewedBefore &&
      dateLastRenewedAfter > dateLastRenewedBefore
    ) {
      return t('registrations.filters.validation.dateRangeInvalid');
    }
    if (
      validUntilAfter &&
      validUntilBefore &&
      validUntilAfter > validUntilBefore
    ) {
      return t('registrations.filters.validation.dateRangeInvalid');
    }
    return null;
  };

  const handleSave = () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const filter: RegistrationFilter = {
      id: '',
      organisationId: '',
      userId: '',
      name: filterName.trim(),
      registrationStatus: registrationStatus as RegistrationFilter['registrationStatus'],
      ...(dateLastRenewedAfter && { dateLastRenewedAfter }),
      ...(dateLastRenewedBefore && { dateLastRenewedBefore }),
      ...(validUntilAfter && { validUntilAfter }),
      ...(validUntilBefore && { validUntilBefore }),
      registrationLabels,
      registrationTypes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    onSave(filter);
    handleReset();
  };

  const handleReset = () => {
    setFilterName('');
    setRegistrationStatus([]);
    setDateLastRenewedAfter(null);
    setDateLastRenewedBefore(null);
    setValidUntilAfter(null);
    setValidUntilBefore(null);
    setRegistrationLabels([]);
    setLabelInput('');
    setRegistrationTypes([]);
    setError(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{t('registrations.filters.createTitle')}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }} role="alert">
              {error}
            </Alert>
          )}

          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Filter Name */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('registrations.filters.name')}
                required
                value={filterName}
                onChange={(e) => {
                  setFilterName(e.target.value);
                  if (error) setError(null);
                }}
                data-testid="filter-name-input"
              />
            </Grid>

            {/* Registration Status */}
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>{t('registrations.filters.status')}</InputLabel>
                <Select
                  multiple
                  value={registrationStatus}
                  onChange={handleStatusChange}
                  input={<OutlinedInput label={t('registrations.filters.status')} />}
                  data-testid="status-select"
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  <MenuItem value="active">{t('registrations.status.active')}</MenuItem>
                  <MenuItem value="pending">{t('registrations.status.pending')}</MenuItem>
                  <MenuItem value="elapsed">{t('registrations.status.elapsed')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Registration Types */}
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>{t('registrations.filters.registrationTypes')}</InputLabel>
                <Select
                  multiple
                  value={registrationTypes}
                  onChange={handleTypesChange}
                  input={<OutlinedInput label={t('registrations.filters.registrationTypes')} />}
                  data-testid="types-select"
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {/* Registration types would be loaded from API in production */}
                </Select>
              </FormControl>
            </Grid>

            {/* Labels */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                {t('registrations.filters.labels')}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1, minHeight: 32 }}>
                {registrationLabels.map((label) => (
                  <Chip
                    key={label}
                    label={label}
                    onDelete={() => handleDeleteLabel(label)}
                    size="small"
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  label={t('registrations.filters.addLabel')}
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLabel();
                    }
                  }}
                  sx={{ flexGrow: 1 }}
                  data-testid="label-input"
                />
                <Button onClick={handleAddLabel} data-testid="add-label-button">
                  {t('registrations.actions.add')}
                </Button>
              </Box>
            </Grid>

            {/* Date Last Renewed Range */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                {t('registrations.filters.dateLastRenewed')}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <DatePicker
                label={t('registrations.filters.afterDate')}
                value={dateLastRenewedAfter}
                onChange={(date) => {
                  setDateLastRenewedAfter(date);
                  if (error) setError(null);
                }}
                slotProps={{
                  textField: { fullWidth: true, 'data-testid': 'renewed-after-date' } as any,
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <DatePicker
                label={t('registrations.filters.beforeDate')}
                value={dateLastRenewedBefore}
                onChange={(date) => {
                  setDateLastRenewedBefore(date);
                  if (error) setError(null);
                }}
                slotProps={{
                  textField: { fullWidth: true, 'data-testid': 'renewed-before-date' } as any,
                }}
              />
            </Grid>

            {/* Valid Until Range */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                {t('registrations.filters.validUntil')}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <DatePicker
                label={t('registrations.filters.afterDate')}
                value={validUntilAfter}
                onChange={(date) => {
                  setValidUntilAfter(date);
                  if (error) setError(null);
                }}
                slotProps={{
                  textField: { fullWidth: true, 'data-testid': 'valid-after-date' } as any,
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <DatePicker
                label={t('registrations.filters.beforeDate')}
                value={validUntilBefore}
                onChange={(date) => {
                  setValidUntilBefore(date);
                  if (error) setError(null);
                }}
                slotProps={{
                  textField: { fullWidth: true, 'data-testid': 'valid-before-date' } as any,
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} data-testid="cancel-button">
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            data-testid="save-button"
          >
            {t('registrations.filters.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default CreateCustomFilterDialog;
