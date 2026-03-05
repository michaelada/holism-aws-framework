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
  Divider,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Visibility as PreviewIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { useApi } from '../../hooks/useApi';
import { useOrganisation } from '../../context/OrganisationContext';
import { useTranslation, useOnboarding } from '@aws-web-framework/orgadmin-shell';
import { FieldRenderer } from '@aws-web-framework/components';
import { useFilteredFieldTypes } from '../hooks/useFilteredFieldTypes';

const CreateFieldPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  const { t } = useTranslation();
  const { setCurrentPageId, setCurrentModule, checkModuleVisit } = useOnboarding();
  const fieldTypes = useFilteredFieldTypes();
  
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
  const [previewValue, setPreviewValue] = useState<any>('');

  // Map database field types to FieldRenderer expected types
  const mapDatatypeToRenderer = (datatype: string): string => {
    const mapping: Record<string, string> = {
      'text': 'text',
      'textarea': 'text_area',
      'number': 'number',
      'email': 'email',
      'phone': 'text',
      'date': 'date',
      'time': 'time',
      'datetime': 'datetime',
      'boolean': 'boolean',
      'select': 'single_select',
      'multiselect': 'multi_select',
      'radio': 'single_select',
      'checkbox': 'multi_select',
      'file': 'document_upload',
      'image': 'document_upload',
    };
    return mapping[datatype] || 'text';
  };

  // Transform field options for preview
  const transformOptionsForPreview = () => {
    if (fieldOptions.length === 0) {
      return {};
    }

    const options = fieldOptions.map((opt: string) => ({
      value: opt,
      label: opt,
    }));

    const displayMode = fieldType === 'radio' ? 'radio' : 'dropdown';

    return {
      options,
      displayMode,
    };
  };

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

      {/* Form and Preview */}
      <Grid container spacing={3}>
        {/* Form Section */}
        <Grid item xs={12} md={6}>
          <Paper>
            <Box component="form" onSubmit={handleCreate} noValidate>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  {t('forms.fields.fieldConfiguration')}
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
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
                          setPreviewValue(''); // Reset preview value when type changes
                          // Clear options if switching to a type that doesn't need them
                          if (!requiresOptions(e.target.value)) {
                            setFieldOptions([]);
                          }
                        }}
                        label={t('forms.fields.fieldType')}
                        disabled={saving}
                      >
                        {fieldTypes.map((type) => (
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
        </Grid>

        {/* Preview Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ position: 'sticky', top: 24 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PreviewIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">
                  {t('forms.fields.livePreview')}
                </Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />
              
              {fieldLabel ? (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('forms.fields.previewDescription')}
                  </Typography>
                  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
                    <FieldRenderer
                      fieldDefinition={{
                        shortName: generatedName || 'field_name',
                        displayName: fieldLabel || 'Field Label',
                        description: fieldDescription || '',
                        datatype: mapDatatypeToRenderer(fieldType) as any,
                        datatypeProperties: transformOptionsForPreview(),
                        validationRules: [],
                      }}
                      value={previewValue}
                      onChange={setPreviewValue}
                      disabled={false}
                      required={false}
                    />
                  </LocalizationProvider>
                </Box>
              ) : (
                <Box sx={{ 
                  textAlign: 'center', 
                  py: 6,
                  color: 'text.secondary'
                }}>
                  <PreviewIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
                  <Typography variant="body1">
                    {t('forms.fields.previewPlaceholder')}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CreateFieldPage;
