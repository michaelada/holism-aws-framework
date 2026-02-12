/**
 * Registration Type Form Component
 * 
 * Reusable form component for creating and editing registration types
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import type { RegistrationTypeFormData } from '../types/registration.types';

interface RegistrationTypeFormProps {
  formData: RegistrationTypeFormData;
  onChange: (field: keyof RegistrationTypeFormData, value: any) => void;
  applicationForms: Array<{ id: string; name: string }>;
  paymentMethods: Array<{ id: string; name: string }>;
  labelInput: string;
  onLabelInputChange: (value: string) => void;
  onAddLabel: () => void;
  onRemoveLabel: (label: string) => void;
}

const RegistrationTypeForm: React.FC<RegistrationTypeFormProps> = ({
  formData,
  onChange,
  applicationForms,
  paymentMethods,
  labelInput,
  onLabelInputChange,
  onAddLabel,
  onRemoveLabel,
}) => {
  return (
    <Grid container spacing={3}>
      {/* Basic Information */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Name"
                  required
                  value={formData.name}
                  onChange={(e) => onChange('name', e.target.value)}
                  helperText="Display name for this registration type (e.g., '2026 Horse Registration')"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  required
                  multiline
                  rows={3}
                  value={formData.description}
                  onChange={(e) => onChange('description', e.target.value)}
                  helperText="Detailed description displayed to account users"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Entity Name"
                  required
                  value={formData.entityName}
                  onChange={(e) => onChange('entityName', e.target.value)}
                  helperText="Name of the thing being registered (e.g., 'Horse', 'Boat', 'Equipment')"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Registration Status</InputLabel>
                  <Select
                    value={formData.registrationStatus}
                    label="Registration Status"
                    onChange={(e) => onChange('registrationStatus', e.target.value)}
                  >
                    <MenuItem value="open">Open (Accepting Applications)</MenuItem>
                    <MenuItem value="closed">Closed (Visible but Not Accepting)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Registration Form */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Registration Form
            </Typography>
            <FormControl fullWidth required>
              <InputLabel>Application Form</InputLabel>
              <Select
                value={formData.registrationFormId}
                label="Application Form"
                onChange={(e) => onChange('registrationFormId', e.target.value)}
              >
                {applicationForms.map((form) => (
                  <MenuItem key={form.id} value={form.id}>
                    {form.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Select the form that defines required fields for entity registration
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Duration Settings */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Duration Settings
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.isRollingRegistration}
                      onChange={(e) => onChange('isRollingRegistration', e.target.checked)}
                    />
                  }
                  label="Is Rolling Registration"
                />
                <Typography variant="caption" color="text.secondary" display="block">
                  Rolling registrations are valid for a specified number of months from payment date.
                  Fixed-period registrations have a specific end date.
                </Typography>
              </Grid>
              {!formData.isRollingRegistration ? (
                <Grid item xs={12} md={6}>
                  <DatePicker
                    label="Valid Until"
                    value={formData.validUntil || null}
                    onChange={(date) => onChange('validUntil', date)}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        required: true,
                        helperText: 'End date for fixed-period registrations',
                      },
                    }}
                  />
                </Grid>
              ) : (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Number of Months"
                    type="number"
                    required
                    value={formData.numberOfMonths || ''}
                    onChange={(e) => onChange('numberOfMonths', parseInt(e.target.value) || undefined)}
                    helperText="Duration in months for rolling registrations"
                    inputProps={{ min: 1 }}
                  />
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Approval Settings */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Approval Settings
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.automaticallyApprove}
                  onChange={(e) => onChange('automaticallyApprove', e.target.checked)}
                />
              }
              label="Automatically Approve Applications"
            />
            <Typography variant="caption" color="text.secondary" display="block">
              When enabled, new applications are automatically marked as "Active".
              When disabled, applications require manual review and are marked as "Pending".
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Labels */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Registration Labels
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                label="Add Label"
                value={labelInput}
                onChange={(e) => onLabelInputChange(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onAddLabel();
                  }
                }}
                helperText="Tags automatically assigned to registrations using this type"
              />
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={onAddLabel}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    background: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Add
                </button>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {formData.registrationLabels.map((label) => (
                <Chip
                  key={label}
                  label={label}
                  onDelete={() => onRemoveLabel(label)}
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Payment Methods */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Payment Configuration
            </Typography>
            <FormControl fullWidth required>
              <InputLabel>Supported Payment Methods</InputLabel>
              <Select
                multiple
                value={formData.supportedPaymentMethods}
                label="Supported Payment Methods"
                onChange={(e) => onChange('supportedPaymentMethods', e.target.value)}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const method = paymentMethods.find(m => m.id === value);
                      return <Chip key={value} label={method?.name || value} size="small" />;
                    })}
                  </Box>
                )}
              >
                {paymentMethods.map((method) => (
                  <MenuItem key={method.id} value={method.id}>
                    {method.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </CardContent>
        </Card>
      </Grid>

      {/* Terms and Conditions */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Terms and Conditions
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.useTermsAndConditions}
                  onChange={(e) => onChange('useTermsAndConditions', e.target.checked)}
                />
              }
              label="Use Terms and Conditions"
            />
            {formData.useTermsAndConditions && (
              <Box sx={{ mt: 2 }}>
                <ReactQuill
                  theme="snow"
                  value={formData.termsAndConditions || ''}
                  onChange={(value) => onChange('termsAndConditions', value)}
                  placeholder="Enter terms and conditions..."
                  style={{ height: '200px', marginBottom: '50px' }}
                />
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default RegistrationTypeForm;
