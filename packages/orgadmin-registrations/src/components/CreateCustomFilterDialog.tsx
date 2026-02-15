/**
 * Create Custom Filter Dialog
 * 
 * Dialog for creating custom filter sets for registration searches
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  Grid,
  OutlinedInput,
  SelectChangeEvent,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';

interface CreateCustomFilterDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (filter: any) => void;
}

const CreateCustomFilterDialog: React.FC<CreateCustomFilterDialogProps> = ({
  open,
  onClose,
  onSave,
}) => {
  const [filterName, setFilterName] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState<string[]>([]);
  const [dateLastRenewedBefore, setDateLastRenewedBefore] = useState<Date | null>(null);
  const [dateLastRenewedAfter, setDateLastRenewedAfter] = useState<Date | null>(null);
  const [validUntilBefore, setValidUntilBefore] = useState<Date | null>(null);
  const [validUntilAfter, setValidUntilAfter] = useState<Date | null>(null);
  const [registrationLabels, setRegistrationLabels] = useState<string[]>([]);
  const [registrationTypes, setRegistrationTypes] = useState<string[]>([]);

  // Mock data - would be loaded from API
  const availableLabels = ['VIP', 'Verified', 'Renewal', 'New'];
  const availableTypes = [
    { id: '1', name: '2026 Horse Registration' },
    { id: '2', name: 'Annual Boat Registration' },
  ];

  const handleStatusChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setRegistrationStatus(typeof value === 'string' ? value.split(',') : value);
  };

  const handleLabelsChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setRegistrationLabels(typeof value === 'string' ? value.split(',') : value);
  };

  const handleTypesChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setRegistrationTypes(typeof value === 'string' ? value.split(',') : value);
  };

  const handleSave = () => {
    const filter = {
      name: filterName,
      registrationStatus,
      dateLastRenewedBefore,
      dateLastRenewedAfter,
      validUntilBefore,
      validUntilAfter,
      registrationLabels,
      registrationTypes,
    };
    onSave(filter);
    handleReset();
  };

  const handleReset = () => {
    setFilterName('');
    setRegistrationStatus([]);
    setDateLastRenewedBefore(null);
    setDateLastRenewedAfter(null);
    setValidUntilBefore(null);
    setValidUntilAfter(null);
    setRegistrationLabels([]);
    setRegistrationTypes([]);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Create Custom Filter</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Filter Name"
                required
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                helperText="Give this filter a descriptive name"
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Registration Status</InputLabel>
                <Select
                  multiple
                  value={registrationStatus}
                  onChange={handleStatusChange}
                  input={<OutlinedInput label="Registration Status" />}
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
              <FormControl fullWidth>
                <InputLabel>Registration Types</InputLabel>
                <Select
                  multiple
                  value={registrationTypes}
                  onChange={handleTypesChange}
                  input={<OutlinedInput label="Registration Types" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => {
                        const type = availableTypes.find(t => t.id === value);
                        return <Chip key={value} label={type?.name || value} size="small" />;
                      })}
                    </Box>
                  )}
                >
                  {availableTypes.map((type) => (
                    <MenuItem key={type.id} value={type.id}>
                      {type.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Registration Labels</InputLabel>
                <Select
                  multiple
                  value={registrationLabels}
                  onChange={handleLabelsChange}
                  input={<OutlinedInput label="Registration Labels" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {availableLabels.map((label) => (
                    <MenuItem key={label} value={label}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ mb: 1 }}>
                <strong>Date Last Renewed Filters</strong>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <DatePicker
                label="Before Date"
                value={dateLastRenewedBefore}
                onChange={(date) => setDateLastRenewedBefore(date)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    helperText="Show registrations renewed before this date"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <DatePicker
                label="After Date"
                value={dateLastRenewedAfter}
                onChange={(date) => setDateLastRenewedAfter(date)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    helperText="Show registrations renewed after this date"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ mb: 1 }}>
                <strong>Valid Until Filters</strong>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <DatePicker
                label="Before Date"
                value={validUntilBefore}
                onChange={(date) => setValidUntilBefore(date)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    helperText="Show registrations expiring before this date"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <DatePicker
                label="After Date"
                value={validUntilAfter}
                onChange={(date) => setValidUntilAfter(date)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    helperText="Show registrations expiring after this date"
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!filterName.trim()}
          >
            Save Filter
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default CreateCustomFilterDialog;
