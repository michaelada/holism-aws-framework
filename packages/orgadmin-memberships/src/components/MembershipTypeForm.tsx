/**
 * Membership Type Form Component
 * 
 * Reusable form component for both single and group types
 * Handles conditional field display based on Is Rolling Membership
 * Handles conditional T&Cs editor
 * Handles group-specific fields (person configuration)
 * Field validation
 */

import React from 'react';
import {
  Box,
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
import type { CreateMembershipTypeDto } from '../types/membership.types';

interface MembershipTypeFormProps {
  formData: CreateMembershipTypeDto;
  onChange: (field: keyof CreateMembershipTypeDto, value: any) => void;
  applicationForms: Array<{ id: string; name: string }>;
  paymentMethods: Array<{ id: string; name: string }>;
}

const MembershipTypeForm: React.FC<MembershipTypeFormProps> = ({
  formData,
  onChange,
  applicationForms,
  paymentMethods,
}) => {
  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            required
            label="Name"
            value={formData.name}
            onChange={(e) => onChange('name', e.target.value)}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            required
            multiline
            rows={3}
            label="Description"
            value={formData.description}
            onChange={(e) => onChange('description', e.target.value)}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth required>
            <InputLabel>Membership Form</InputLabel>
            <Select
              value={formData.membershipFormId}
              label="Membership Form"
              onChange={(e) => onChange('membershipFormId', e.target.value)}
            >
              {applicationForms.map((form) => (
                <MenuItem key={form.id} value={form.id}>
                  {form.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth required>
            <InputLabel>Membership Status</InputLabel>
            <Select
              value={formData.membershipStatus}
              label="Membership Status"
              onChange={(e) => onChange('membershipStatus', e.target.value)}
            >
              <MenuItem value="open">Open</MenuItem>
              <MenuItem value="closed">Closed</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.isRollingMembership}
                onChange={(e) => onChange('isRollingMembership', e.target.checked)}
              />
            }
            label="Is Rolling Membership"
          />
        </Grid>

        {!formData.isRollingMembership ? (
          <Grid item xs={12} md={6}>
            <DatePicker
              label="Valid Until"
              value={formData.validUntil ? new Date(formData.validUntil) : null}
              onChange={(date) => onChange('validUntil', date)}
              slotProps={{ textField: { fullWidth: true, required: true } }}
            />
          </Grid>
        ) : (
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              required
              type="number"
              label="Number of Months"
              value={formData.numberOfMonths || ''}
              onChange={(e) => onChange('numberOfMonths', parseInt(e.target.value) || undefined)}
              inputProps={{ min: 1, max: 120 }}
            />
          </Grid>
        )}

        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.automaticallyApprove}
                onChange={(e) => onChange('automaticallyApprove', e.target.checked)}
              />
            }
            label="Automatically Approve Applications"
          />
        </Grid>

        <Grid item xs={12}>
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
        </Grid>

        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.useTermsAndConditions}
                onChange={(e) => onChange('useTermsAndConditions', e.target.checked)}
              />
            }
            label="Use Terms and Conditions"
          />
        </Grid>

        {formData.useTermsAndConditions && (
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Terms and Conditions Content
            </Typography>
            <ReactQuill
              theme="snow"
              value={formData.termsAndConditions || ''}
              onChange={(value) => onChange('termsAndConditions', value)}
              modules={{
                toolbar: [
                  [{ header: [1, 2, 3, false] }],
                  ['bold', 'italic', 'underline'],
                  [{ list: 'ordered' }, { list: 'bullet' }],
                  ['clean'],
                ],
              }}
            />
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default MembershipTypeForm;
