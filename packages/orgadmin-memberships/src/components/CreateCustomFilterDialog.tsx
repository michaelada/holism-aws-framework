/**
 * Create Custom Filter Dialog Component
 * 
 * Form for creating named filter sets with:
 * - Filter name
 * - Member Status multi-select
 * - Date Last Renewed filters
 * - Valid Until filters
 * - Member Labels multi-select
 */

import React, { useState } from 'react';
import {
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
  TextField,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import type { CreateMemberFilterDto } from '../types/membership.types';

interface CreateCustomFilterDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (filter: CreateMemberFilterDto) => void;
}

const CreateCustomFilterDialog: React.FC<CreateCustomFilterDialogProps> = ({
  open,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<CreateMemberFilterDto>({
    name: '',
    memberStatus: [],
    dateLastRenewedBefore: undefined,
    dateLastRenewedAfter: undefined,
    validUntilBefore: undefined,
    validUntilAfter: undefined,
    memberLabels: [],
  });

  const [labelInput, setLabelInput] = useState('');

  const handleChange = (field: keyof CreateMemberFilterDto, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddLabel = () => {
    if (labelInput.trim() && !formData.memberLabels.includes(labelInput.trim())) {
      setFormData(prev => ({
        ...prev,
        memberLabels: [...prev.memberLabels, labelInput.trim()],
      }));
      setLabelInput('');
    }
  };

  const handleRemoveLabel = (label: string) => {
    setFormData(prev => ({
      ...prev,
      memberLabels: prev.memberLabels.filter(l => l !== label),
    }));
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      return;
    }
    onSave(formData);
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      name: '',
      memberStatus: [],
      dateLastRenewedBefore: undefined,
      dateLastRenewedAfter: undefined,
      validUntilBefore: undefined,
      validUntilAfter: undefined,
      memberLabels: [],
    });
    setLabelInput('');
    onClose();
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{t('memberships.customFilter.title')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label={t('memberships.customFilter.filterName')}
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                helperText={t('memberships.customFilter.filterNameHelper')}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>{t('memberships.customFilter.memberStatus')}</InputLabel>
                <Select
                  multiple
                  value={formData.memberStatus}
                  onChange={(e) => handleChange('memberStatus', e.target.value)}
                  input={<OutlinedInput label={t('memberships.customFilter.memberStatus')} />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  <MenuItem value="active">{t('memberships.memberStatus.active')}</MenuItem>
                  <MenuItem value="pending">{t('memberships.memberStatus.pending')}</MenuItem>
                  <MenuItem value="elapsed">{t('memberships.memberStatus.elapsed')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                {t('memberships.customFilter.dateLastRenewedFilters')}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <DatePicker
                label={t('memberships.customFilter.beforeDate')}
                value={formData.dateLastRenewedBefore ? new Date(formData.dateLastRenewedBefore) : null}
                onChange={(date) => handleChange('dateLastRenewedBefore', date)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <DatePicker
                label={t('memberships.customFilter.afterDate')}
                value={formData.dateLastRenewedAfter ? new Date(formData.dateLastRenewedAfter) : null}
                onChange={(date) => handleChange('dateLastRenewedAfter', date)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                {t('memberships.customFilter.validUntilFilters')}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <DatePicker
                label={t('memberships.customFilter.beforeDate')}
                value={formData.validUntilBefore ? new Date(formData.validUntilBefore) : null}
                onChange={(date) => handleChange('validUntilBefore', date)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <DatePicker
                label={t('memberships.customFilter.afterDate')}
                value={formData.validUntilAfter ? new Date(formData.validUntilAfter) : null}
                onChange={(date) => handleChange('validUntilAfter', date)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                {t('memberships.customFilter.memberLabels')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                {formData.memberLabels.map((label) => (
                  <Chip
                    key={label}
                    label={label}
                    onDelete={() => handleRemoveLabel(label)}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  placeholder={t('memberships.fields.addLabel')}
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLabel();
                    }
                  }}
                  sx={{ flexGrow: 1 }}
                />
                <Button onClick={handleAddLabel}>{t('memberships.actions.add')}</Button>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{t('common.actions.cancel')}</Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.name.trim()}>
            {t('memberships.customFilter.saveFilter')}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default CreateCustomFilterDialog;
