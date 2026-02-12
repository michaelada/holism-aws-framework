/**
 * Create/Edit Group Membership Type Page
 * 
 * Form for creating or editing group membership types
 * Includes all fields from single membership type plus group-specific configuration
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
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
  Alert,
  Divider,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Save as SaveIcon, Cancel as CancelIcon, Publish as PublishIcon } from '@mui/icons-material';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import type { CreateMembershipTypeDto, FieldConfiguration } from '../types/membership.types';
import FieldConfigurationTable from '../components/FieldConfigurationTable';
import PersonConfigurationSection from '../components/PersonConfigurationSection';

// Mock API hook - will be replaced with actual implementation
const useApi = () => ({
  execute: async ({ method, url, data }: { method: string; url: string; data?: any }) => {
    console.log('API call:', method, url, data);
    return { id: '1', ...data };
  },
});

interface ApplicationForm {
  id: string;
  name: string;
  fields?: ApplicationField[];
}

interface ApplicationField {
  id: string;
  name: string;
  label: string;
  datatype: string;
  required: boolean;
}

interface PaymentMethod {
  id: string;
  name: string;
}

const CreateGroupMembershipTypePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationForms, setApplicationForms] = useState<ApplicationForm[]>([]);
  const [selectedFormFields, setSelectedFormFields] = useState<ApplicationField[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  
  const [formData, setFormData] = useState<CreateMembershipTypeDto>({
    name: '',
    description: '',
    membershipFormId: '',
    membershipStatus: 'open',
    isRollingMembership: false,
    validUntil: undefined,
    numberOfMonths: undefined,
    automaticallyApprove: false,
    memberLabels: [],
    supportedPaymentMethods: [],
    useTermsAndConditions: false,
    termsAndConditions: undefined,
    membershipTypeCategory: 'group',
    // Group-specific fields
    maxPeopleInApplication: 2,
    minPeopleInApplication: 2,
    personTitles: [],
    personLabels: [],
    fieldConfiguration: {},
  });

  const [labelInput, setLabelInput] = useState('');

  useEffect(() => {
    loadApplicationForms();
    loadPaymentMethods();
    if (isEditMode && id) {
      loadMembershipType(id);
    }
  }, [id, isEditMode]);

  useEffect(() => {
    if (formData.membershipFormId) {
      loadFormFields(formData.membershipFormId);
    }
  }, [formData.membershipFormId]);

  useEffect(() => {
    // Initialize person arrays when max people changes
    const maxPeople = formData.maxPeopleInApplication || 0;
    setFormData(prev => ({
      ...prev,
      personTitles: Array(maxPeople).fill('').map((_, i) => prev.personTitles?.[i] || ''),
      personLabels: Array(maxPeople).fill([]).map((_, i) => prev.personLabels?.[i] || []),
    }));
  }, [formData.maxPeopleInApplication]);

  const loadApplicationForms = async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/application-forms',
      });
      setApplicationForms(response || []);
    } catch (error) {
      console.error('Failed to load application forms:', error);
    }
  };

  const loadFormFields = async (formId: string) => {
    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/application-forms/${formId}/fields`,
      });
      setSelectedFormFields(response || []);
      
      // Initialize field configuration for new fields
      const newFieldConfig = { ...formData.fieldConfiguration };
      response.forEach((field: ApplicationField) => {
        if (!newFieldConfig[field.id]) {
          newFieldConfig[field.id] = 'unique';
        }
      });
      setFormData(prev => ({ ...prev, fieldConfiguration: newFieldConfig }));
    } catch (error) {
      console.error('Failed to load form fields:', error);
      setSelectedFormFields([]);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/payment-methods',
      });
      setPaymentMethods(response || [
        { id: 'pay-offline', name: 'Pay Offline' },
        { id: 'stripe', name: 'Card Payment (Stripe)' },
      ]);
    } catch (error) {
      console.error('Failed to load payment methods:', error);
      setPaymentMethods([
        { id: 'pay-offline', name: 'Pay Offline' },
        { id: 'stripe', name: 'Card Payment (Stripe)' },
      ]);
    }
  };

  const loadMembershipType = async (typeId: string) => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/membership-types/${typeId}`,
      });
      setFormData(response);
    } catch (error) {
      console.error('Failed to load membership type:', error);
      setError('Failed to load membership type');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof CreateMembershipTypeDto, value: any) => {
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

  const handleFieldConfigurationChange = (fieldId: string, configuration: FieldConfiguration) => {
    setFormData(prev => ({
      ...prev,
      fieldConfiguration: {
        ...prev.fieldConfiguration,
        [fieldId]: configuration,
      },
    }));
  };

  const handlePersonTitleChange = (index: number, title: string) => {
    const newTitles = [...(formData.personTitles || [])];
    newTitles[index] = title;
    setFormData(prev => ({ ...prev, personTitles: newTitles }));
  };

  const handlePersonLabelsChange = (index: number, labels: string[]) => {
    const newLabels = [...(formData.personLabels || [])];
    newLabels[index] = labels;
    setFormData(prev => ({ ...prev, personLabels: newLabels }));
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return 'Membership type name is required';
    }
    if (!formData.description.trim()) {
      return 'Description is required';
    }
    if (!formData.membershipFormId) {
      return 'Membership form is required';
    }
    if (!formData.isRollingMembership && !formData.validUntil) {
      return 'Valid Until date is required for fixed-period memberships';
    }
    if (formData.isRollingMembership && !formData.numberOfMonths) {
      return 'Number of months is required for rolling memberships';
    }
    if (formData.supportedPaymentMethods.length === 0) {
      return 'At least one payment method is required';
    }
    if (formData.useTermsAndConditions && !formData.termsAndConditions?.trim()) {
      return 'Terms and conditions content is required when enabled';
    }
    // Group-specific validation
    if (!formData.maxPeopleInApplication || formData.maxPeopleInApplication < 2) {
      return 'Maximum number of people must be at least 2 for group memberships';
    }
    if (!formData.minPeopleInApplication || formData.minPeopleInApplication < 2) {
      return 'Minimum number of people must be at least 2 for group memberships';
    }
    if (formData.minPeopleInApplication > formData.maxPeopleInApplication) {
      return 'Minimum number of people cannot exceed maximum';
    }
    return null;
  };

  const handleSave = async (publish: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        return;
      }

      const dataToSave = { ...formData };

      if (isEditMode && id) {
        await execute({
          method: 'PUT',
          url: `/api/orgadmin/membership-types/${id}`,
          data: dataToSave,
        });
      } else {
        await execute({
          method: 'POST',
          url: '/api/orgadmin/membership-types',
          data: dataToSave,
        });
      }

      navigate('/orgadmin/members/types');
    } catch (error) {
      console.error('Failed to save membership type:', error);
      setError('Failed to save membership type');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/orgadmin/members/types');
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          {isEditMode ? 'Edit Group Membership Type' : 'Create Group Membership Type'}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Basic Information - Same as Single */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  helperText="Display name for this membership type (e.g., 'Family Membership')"
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
                  onChange={(e) => handleChange('description', e.target.value)}
                  helperText="Detailed description displayed to members when choosing membership"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Membership Form</InputLabel>
                  <Select
                    value={formData.membershipFormId}
                    label="Membership Form"
                    onChange={(e) => handleChange('membershipFormId', e.target.value)}
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
                    onChange={(e) => handleChange('membershipStatus', e.target.value)}
                  >
                    <MenuItem value="open">Open (Accepting Applications)</MenuItem>
                    <MenuItem value="closed">Closed (Visible but Not Accepting)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Group Configuration - NEW */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Group Configuration
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Maximum Number of People"
                  value={formData.maxPeopleInApplication || ''}
                  onChange={(e) => handleChange('maxPeopleInApplication', parseInt(e.target.value) || undefined)}
                  helperText="Maximum people allowed in group application"
                  inputProps={{ min: 2, max: 20 }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Minimum Number of People"
                  value={formData.minPeopleInApplication || ''}
                  onChange={(e) => handleChange('minPeopleInApplication', parseInt(e.target.value) || undefined)}
                  helperText="Minimum people required in group application"
                  inputProps={{ min: 2, max: 20 }}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Person Configuration - NEW */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Person Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Configure optional titles and labels for each person slot in the group
            </Typography>

            <PersonConfigurationSection
              maxPeople={formData.maxPeopleInApplication || 0}
              personTitles={formData.personTitles || []}
              personLabels={formData.personLabels || []}
              onTitleChange={handlePersonTitleChange}
              onLabelsChange={handlePersonLabelsChange}
            />
          </CardContent>
        </Card>

        {/* Field Configuration - NEW */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Field Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Configure whether each form field is common to all group members or unique for each person
            </Typography>

            <FieldConfigurationTable
              fields={selectedFormFields}
              fieldConfiguration={formData.fieldConfiguration || {}}
              onChange={handleFieldConfigurationChange}
            />
          </CardContent>
        </Card>

        {/* Membership Duration - Same as Single */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Membership Duration
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.isRollingMembership}
                      onChange={(e) => handleChange('isRollingMembership', e.target.checked)}
                    />
                  }
                  label="Is Rolling Membership"
                />
                <Typography variant="body2" color="text.secondary">
                  Rolling memberships are valid for a specified number of months from payment date.
                  Fixed-period memberships have a specific end date.
                </Typography>
              </Grid>

              {!formData.isRollingMembership ? (
                <Grid item xs={12} md={6}>
                  <DatePicker
                    label="Valid Until"
                    value={formData.validUntil ? new Date(formData.validUntil) : null}
                    onChange={(date) => handleChange('validUntil', date)}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        required: true,
                        helperText: 'End date for fixed-period memberships',
                      },
                    }}
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
                    onChange={(e) => handleChange('numberOfMonths', parseInt(e.target.value) || undefined)}
                    helperText="Duration in months for rolling memberships"
                    inputProps={{ min: 1, max: 120 }}
                  />
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>

        {/* Application Settings - Same as Single */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Application Settings
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.automaticallyApprove}
                      onChange={(e) => handleChange('automaticallyApprove', e.target.checked)}
                    />
                  }
                  label="Automatically Approve Applications"
                />
                <Typography variant="body2" color="text.secondary">
                  If enabled, new applications are automatically marked as "Active". 
                  If disabled, applications require manual approval and start as "Pending".
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Member Labels
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Tags automatically assigned to members using this membership type
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
                  />
                  <Button onClick={handleAddLabel}>Add</Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Payment Settings - Same as Single */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Payment Settings
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Supported Payment Methods</InputLabel>
                  <Select
                    multiple
                    value={formData.supportedPaymentMethods}
                    label="Supported Payment Methods"
                    onChange={(e) => handleChange('supportedPaymentMethods', e.target.value)}
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
            </Grid>
          </CardContent>
        </Card>

        {/* Terms and Conditions - Same as Single */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Terms and Conditions
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.useTermsAndConditions}
                      onChange={(e) => handleChange('useTermsAndConditions', e.target.checked)}
                    />
                  }
                  label="Use Terms and Conditions"
                />
                <Typography variant="body2" color="text.secondary">
                  If enabled, applicants must agree to terms and conditions before submitting
                </Typography>
              </Grid>

              {formData.useTermsAndConditions && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Terms and Conditions Content
                  </Typography>
                  <ReactQuill
                    theme="snow"
                    value={formData.termsAndConditions || ''}
                    onChange={(value) => handleChange('termsAndConditions', value)}
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
          </CardContent>
        </Card>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={() => handleSave(false)}
            disabled={loading}
          >
            {isEditMode ? 'Save Changes' : 'Save'}
          </Button>
          {!isEditMode && (
            <Button
              variant="contained"
              color="success"
              startIcon={<PublishIcon />}
              onClick={() => handleSave(true)}
              disabled={loading}
            >
              Save and Publish
            </Button>
          )}
        </Box>
      </Box>
    </LocalizationProvider>
  );
};

export default CreateGroupMembershipTypePage;
