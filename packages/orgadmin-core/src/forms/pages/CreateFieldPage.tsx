/**
 * Create Field Page
 * 
 * Dedicated page for creating new field definitions
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CardContent,
  TextField,
  Typography,
  Alert,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Breadcrumbs,
  Link,
  Chip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useApi } from '../../hooks/useApi';
import { useOrganisation } from '../../context/OrganisationContext';
import { useTranslation, useOnboarding } from '@aws-web-framework/orgadmin-shell';

const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'email',
  'phone',
  'date',
  'time',
  'datetime',
  'boolean',
  'select',
  'multiselect',
  'radio',
  'checkbox',
  'file',
  'image',
];

const CreateFieldPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  const { t } = useTranslation();
  const { setCurrentPageId, setCurrentModule, checkModuleVisit } = useOnboarding();
  
  // Register this page with the help system
  React.useEffect(() => {
    setCurrentModule('forms');
    setCurrentPageId('create');
    checkModuleVisit('forms');
  }, [setCurrentPageId, setCurrentModule, checkModuleVisit]);
  
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldDescription, setFieldDescription] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [fieldOptions, setFieldOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Helper function to generate field name from label
  const generateFieldName = (label: string): string => {
    return label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '_'); // Replace spaces with underscores
  };

  // Check if field type requires options
  const requiresOptions = (type: string): boolean => {
    return ['select', 'multiselect', 'radio', 'checkbox'].includes(type);
  };

  // Handle adding an option
  const handleAddOption = () => {
    if (newOption.trim() && !fieldOptions.includes(newOption.trim())) {
      setFieldOptions([...fieldOptions, newOption.trim()]);
      setNewOption('');
    }
  };

  // Handle removing an option
  const handleRemoveOption = (option: string) => {
    setFieldOptions(fieldOptions.filter(o => o !== option));
  };

  const handleCancel = () => {
    navigate('/forms/fields');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation: Check if label is provided
    if (!fieldLabel.trim()) {
      setError(t('forms.fields.validation.labelRequired'));
      return;
    }

    // Validation: Check if label contains at least one alphanumeric character
    const generatedName = generateFieldName(fieldLabel);
    if (!generatedName) {
      setError(t('forms.fields.validation.labelAlphanumeric'));
      return;
    }

    // Validation: Check if options are required for certain field types
    if (requiresOptions(fieldType) && fieldOptions.length === 0) {
      setError(t('forms.fields.validation.optionsRequired', { type: fieldType }));
      return;
    }

    // Check if organization context is available
    if (!organisation?.id) {
      setError(t('forms.organisationContextMissing'));
      return;
    }

    try {
      setSaving(true);

      // Submit field creation via API
      await execute({
        method: 'POST',
        url: '/api/orgadmin/application-fields',
        data: {
          organisationId: organisation.id,
          name: generatedName,
          label: fieldLabel.trim(),
          description: fieldDescription.trim() || undefined,
          datatype: fieldType,
          options: requiresOptions(fieldType) ? fieldOptions : undefined,
        },
      });

      // Show success message and redirect after short delay
      setSuccess(true);
      setTimeout(() => {
        navigate('/forms/fields');
      }, 2000);
    } catch (err) {
      // Handle API errors
      const errorMessage = err instanceof Error ? err.message : t('forms.failedToSave');
      setError(errorMessage);
      setSaving(false);
    }
  };

  const generatedName = generateFieldName(fieldLabel);
  const showOptions = requiresOptions(fieldType);

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/')}
          sx={{ textDecoration: 'none', cursor: 'pointer' }}
        >
          {t('modules.dashboard.name')}
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/forms')}
          sx={{ textDecoration: 'none', cursor: 'pointer' }}
        >
          {t('modules.forms.name')}
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/forms/fields')}
          sx={{ textDecoration: 'none', cursor: 'pointer' }}
        >
          {t('forms.fields.title')}
        </Link>
        <Typography color="text.primary">{t('forms.fields.createField')}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<BackIcon />}
          onClick={handleCancel}
          sx={{ mr: 2 }}
        >
          {t('common.actions.back')}
        </Button>
        <Typography variant="h4">{t('forms.fields.createFieldPage')}</Typography>
      </Box>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Success Message */}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {t('forms.fields.messages.fieldCreated')}
        </Alert>
      )}

      {/* Form */}
      <Paper sx={{ maxWidth: 800 }}>
        <Box component="form" onSubmit={handleCreate} noValidate>
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  label={t('forms.fields.fieldLabel')}
                  value={fieldLabel}
                  onChange={(e) => setFieldLabel(e.target.value)}
                  fullWidth
                  required
                  autoFocus
                  helperText={
                    fieldLabel
                      ? t('forms.fields.fieldNameWillBe', { 
                          name: generatedName || t('forms.fields.invalidFieldName')
                        })
                      : t('forms.fields.fieldLabelHelper')
                  }
                  disabled={saving}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label={t('forms.fields.fieldDescription')}
                  value={fieldDescription}
                  onChange={(e) => setFieldDescription(e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                  helperText={t('forms.fields.fieldDescriptionHelper')}
                  disabled={saving}
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>{t('forms.fields.fieldType')}</InputLabel>
                  <Select
                    value={fieldType}
                    onChange={(e) => {
                      setFieldType(e.target.value);
                      // Clear options if switching to a type that doesn't need them
                      if (!requiresOptions(e.target.value)) {
                        setFieldOptions([]);
                      }
                    }}
                    label={t('forms.fields.fieldType')}
                    disabled={saving}
                  >
                    {FIELD_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {showOptions && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    {t('forms.fields.fieldOptions')} *
                  </Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {t('forms.fields.optionsRequired', { type: fieldType })}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <TextField
                      label={t('forms.fields.addOption')}
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddOption();
                        }
                      }}
                      size="small"
                      fullWidth
                      disabled={saving}
                    />
                    <Button
                      variant="outlined"
                      onClick={handleAddOption}
                      disabled={!newOption.trim() || saving}
                      startIcon={<AddIcon />}
                    >
                      {t('common.actions.add')}
                    </Button>
                  </Box>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {fieldOptions.map((option) => (
                      <Chip
                        key={option}
                        label={option}
                        onDelete={() => handleRemoveOption(option)}
                        deleteIcon={<CloseIcon />}
                        disabled={saving}
                      />
                    ))}
                  </Box>
                </Grid>
              )}
            </Grid>
          </CardContent>

          {/* Actions */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 2,
              p: 3,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Button
              onClick={handleCancel}
              disabled={saving}
              size="large"
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={saving}
              size="large"
            >
              {saving ? t('common.messages.saving') : t('forms.fields.createField')}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default CreateFieldPage;
