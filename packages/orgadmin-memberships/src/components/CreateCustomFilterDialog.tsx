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
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Create Custom Filter</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Filter Name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                helperText="Give this filter a descriptive name"
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Member Status</InputLabel>
                <Select
                  multiple
                  value={formData.memberStatus}
                  onChange={(e) => handleChange('memberStatus', e.target.value)}
                  input={<OutlinedInput label="Member Status" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="elapsed">Elapsed</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Date Last Renewed Filters
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <DatePicker
                label="Before Date"
                value={formData.dateLastRenewedBefore ? new Date(formData.dateLastRenewedBefore) : null}
                onChange={(date) => handleChange('dateLastRenewedBefore', date)}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <DatePicker
                label="After Date"
                value={formData.dateLastRenewedAfter ? new Date(formData.dateLastRenewedAfter) : null}
                onChange={(date) => handleChange('dateLastRenewedAfter', date)}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Valid Until Filters
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <DatePicker
                label="Before Date"
                value={formData.validUntilBefore ? new Date(formData.validUntilBefore) : null}
                onChange={(date) => handleChange('validUntilBefore', date)}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <DatePicker
                label="After Date"
                value={formData.validUntilAfter ? new Date(formData.validUntilAfter) : null}
                onChange={(date) => handleChange('validUntilAfter', date)}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Member Labels
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
                  placeholder="Add label"
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
                <Button onClick={handleAddLabel}>Add</Button>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.name.trim()}>
            Save Filter
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default CreateCustomFilterDialog;
