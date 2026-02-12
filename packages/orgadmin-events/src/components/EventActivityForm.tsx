/**
 * Event Activity Form Component
 * 
 * Form for creating or editing event activities with enhanced attributes
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Collapse,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import type { EventActivityFormData } from '../types/event.types';

interface EventActivityFormProps {
  activity: EventActivityFormData;
  index: number;
  onChange: (activity: EventActivityFormData) => void;
  onRemove: () => void;
}

// Mock API hook - will be replaced with actual implementation
const useApi = () => ({
  execute: async () => {
    // Mock application forms data
    return [
      { id: '1', name: 'Standard Entry Form' },
      { id: '2', name: 'Junior Entry Form' },
      { id: '3', name: 'Family Entry Form' },
    ];
  },
});

const EventActivityForm: React.FC<EventActivityFormProps> = ({
  activity,
  index,
  onChange,
  onRemove,
}) => {
  const { execute } = useApi();
  const [expanded, setExpanded] = useState(true);
  const [applicationForms, setApplicationForms] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    loadApplicationForms();
  }, []);

  const loadApplicationForms = async () => {
    try {
      const response = await execute();
      setApplicationForms(response || []);
    } catch (error) {
      console.error('Failed to load application forms:', error);
      setApplicationForms([]);
    }
  };

  const handleChange = (field: keyof EventActivityFormData, value: any) => {
    onChange({ ...activity, [field]: value });
  };

  return (
    <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" fontWeight="medium">
          Activity {index + 1}: {activity.name || 'Untitled Activity'}
        </Typography>
        <Box>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
          <IconButton size="small" color="error" onClick={onRemove}>
            <DeleteIcon />
          </IconButton>
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              required
              label="Activity Name"
              value={activity.name}
              onChange={(e) => handleChange('name', e.target.value)}
              helperText="Activity name as it appears to members on public website"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Description"
              value={activity.description}
              onChange={(e) => handleChange('description', e.target.value)}
              helperText="Detailed description of this specific activity"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={activity.showPublicly}
                  onChange={(e) => handleChange('showPublicly', e.target.checked)}
                />
              }
              label="Show Publicly"
            />
          </Grid>

          <Grid item xs={12}>
            <FormControl fullWidth required>
              <InputLabel>Application Form</InputLabel>
              <Select
                value={activity.applicationFormId || ''}
                label="Application Form"
                onChange={(e) => handleChange('applicationFormId', e.target.value)}
              >
                <MenuItem value="">
                  <em>Select a form</em>
                </MenuItem>
                {applicationForms.map((form) => (
                  <MenuItem key={form.id} value={form.id}>
                    {form.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={activity.limitApplicants}
                  onChange={(e) => handleChange('limitApplicants', e.target.checked)}
                />
              }
              label="Limit Number of Applicants"
            />
          </Grid>

          {activity.limitApplicants && (
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Application Limit"
                value={activity.applicantsLimit || ''}
                onChange={(e) => handleChange('applicantsLimit', parseInt(e.target.value) || undefined)}
                helperText="Maximum number of applicants for this activity"
              />
            </Grid>
          )}

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={activity.allowSpecifyQuantity}
                  onChange={(e) => handleChange('allowSpecifyQuantity', e.target.checked)}
                />
              }
              label="Allow Specify Quantity"
            />
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={activity.useTermsAndConditions}
                  onChange={(e) => handleChange('useTermsAndConditions', e.target.checked)}
                />
              }
              label="Use Terms and Conditions"
            />
          </Grid>

          {activity.useTermsAndConditions && (
            <Grid item xs={12}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Terms and Conditions
              </Typography>
              <ReactQuill
                value={activity.termsAndConditions || ''}
                onChange={(value) => handleChange('termsAndConditions', value)}
                theme="snow"
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

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Fee"
              value={activity.fee}
              onChange={(e) => handleChange('fee', parseFloat(e.target.value) || 0)}
              helperText="Entry fee for this activity (0.00 for free)"
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Grid>

          {activity.fee > 0 && (
            <>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Allowed Payment Method</InputLabel>
                  <Select
                    value={activity.allowedPaymentMethod}
                    label="Allowed Payment Method"
                    onChange={(e) => handleChange('allowedPaymentMethod', e.target.value)}
                  >
                    <MenuItem value="card">Card Only</MenuItem>
                    <MenuItem value="cheque">Cheque/Offline Only</MenuItem>
                    <MenuItem value="both">Both</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {(activity.allowedPaymentMethod === 'card' || activity.allowedPaymentMethod === 'both') && (
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={activity.handlingFeeIncluded}
                        onChange={(e) => handleChange('handlingFeeIncluded', e.target.checked)}
                      />
                    }
                    label="Handling Fee Included"
                  />
                </Grid>
              )}

              {(activity.allowedPaymentMethod === 'cheque' || activity.allowedPaymentMethod === 'both') && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Cheque/Offline Payment Instructions"
                    value={activity.chequePaymentInstructions || ''}
                    onChange={(e) => handleChange('chequePaymentInstructions', e.target.value)}
                    helperText="Instructions for cheque/offline payment (who to make cheque to, bank transfer details, etc.)"
                  />
                </Grid>
              )}
            </>
          )}
        </Grid>
      </Collapse>
    </Box>
  );
};

export default EventActivityForm;
