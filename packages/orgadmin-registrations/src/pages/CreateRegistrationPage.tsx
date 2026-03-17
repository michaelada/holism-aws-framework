/**
 * Create Registration Page
 *
 * Full-page form for creating a new registration, following the same pattern
 * as CreateMemberPage. Uses FieldRenderer for proper rendering of dynamic
 * form fields (selects, dates, booleans, file uploads, etc.).
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Typography,
  Alert,
  TextField,
  Skeleton,
  List,
  ListItemButton,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { FieldRenderer } from '@aws-web-framework/components';
import { useApi, useOrganisation } from '@aws-web-framework/orgadmin-core';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import type { RegistrationType } from '../types/registration.types';

interface ApplicationFormWithFields {
  id: string;
  name: string;
  description?: string;
  fields: Array<{
    id: string;
    name: string;
    label: string;
    datatype: string;
    order: number;
    required?: boolean;
    validation?: any;
    options?: any;
    description?: string;
  }>;
}

interface CreateRegistrationPageState {
  loading: boolean;
  error: string | null;
  registrationType: RegistrationType | null;
  formDefinition: ApplicationFormWithFields | null;
  formData: Record<string, any>;
  validationErrors: Record<string, string>;
  submitting: boolean;
}

const CreateRegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  const { t } = useTranslation();

  const typeId = searchParams.get('typeId');
  const filterState = location.state?.filterState;

  const [state, setState] = useState<CreateRegistrationPageState>({
    loading: true,
    error: null,
    registrationType: null,
    formDefinition: null,
    formData: {},
    validationErrors: {},
    submitting: false,
  });

  // Registration type selection state
  const [registrationTypes, setRegistrationTypes] = useState<RegistrationType[]>([]);
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  /**
   * Map database field types to FieldRenderer expected types
   */
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
      'single_select': 'single_select',
      'multiselect': 'multi_select',
      'multi_select': 'multi_select',
      'radio': 'single_select',
      'checkbox': 'multi_select',
      'file': 'document_upload',
      'image': 'document_upload',
      'document_upload': 'document_upload',
    };
    return mapping[datatype] || 'text';
  };

  /**
   * Transform field options from string array to {value, label} format
   */
  const transformOptions = (field: ApplicationFormWithFields['fields'][0]) => {
    const baseProperties: Record<string, any> = {};

    if (field.datatype === 'image') {
      baseProperties.fileType = 'image';
      baseProperties.acceptImages = true;
    }

    if (!field.options || !Array.isArray(field.options)) {
      return baseProperties;
    }

    const options = field.options.map((opt: string) => ({
      value: opt,
      label: opt,
    }));

    const displayMode = field.datatype === 'radio' ? 'radio' : 'dropdown';

    return { ...baseProperties, options, displayMode };
  };

  /**
   * Render a dynamic form field using FieldRenderer
   */
  const renderField = (field: ApplicationFormWithFields['fields'][0]) => {
    const fieldDefinition = {
      shortName: field.name,
      displayName: field.label,
      description: field.description || '',
      datatype: mapDatatypeToRenderer(field.datatype) as any,
      datatypeProperties: transformOptions(field),
      validationRules: field.validation?.rules || [],
    };

    return (
      <Box key={field.id} sx={{ mb: 3 }}>
        <FieldRenderer
          fieldDefinition={fieldDefinition}
          value={state.formData[field.name] || ''}
          onChange={(value: any) => {
            setState(prev => ({
              ...prev,
              formData: { ...prev.formData, [field.name]: value },
              validationErrors: { ...prev.validationErrors, [field.name]: '' },
            }));
          }}
          onBlur={() => {
            const value = state.formData[field.name];
            const error = validateField(field, value);
            if (error) {
              setState(prev => ({
                ...prev,
                validationErrors: { ...prev.validationErrors, [field.name]: error },
              }));
            }
          }}
          disabled={false}
          required={field.required || field.validation?.required || false}
          error={state.validationErrors[field.name]}
        />
        {state.validationErrors[field.name] && (
          <Typography color="error" variant="caption">
            {state.validationErrors[field.name]}
          </Typography>
        )}
      </Box>
    );
  };

  // Load on mount
  useEffect(() => {
    if (typeId && organisation?.id) {
      loadRegistrationTypeAndForm(typeId);
    } else if (organisation?.id) {
      loadRegistrationTypes();
    }
  }, [typeId, organisation?.id]);

  const loadRegistrationTypes = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisation?.id}/registration-types`,
      });
      const typesArray = Array.isArray(response) ? response : [];
      setRegistrationTypes(typesArray);

      if (typesArray.length === 0) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: t('registrations.creation.noTypesAvailable'),
        }));
      } else if (typesArray.length === 1) {
        loadRegistrationTypeAndForm(typesArray[0].id);
      } else {
        setState(prev => ({ ...prev, loading: false }));
        setShowTypeSelector(true);
      }
    } catch (error) {
      console.error('Failed to load registration types:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: t('registrations.creation.error'),
      }));
    }
  };

  const handleTypeSelect = (selectedTypeId: string) => {
    setShowTypeSelector(false);
    navigate(`/registrations/create?typeId=${selectedTypeId}`, {
      replace: true,
      state: location.state,
    });
    loadRegistrationTypeAndForm(selectedTypeId);
  };

  const loadRegistrationTypeAndForm = async (registrationTypeId: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const regType = await execute({
        method: 'GET',
        url: `/api/orgadmin/registration-types/${registrationTypeId}`,
      });

      if (!regType) {
        throw new Error('Registration type not found');
      }

      let formDefinition: ApplicationFormWithFields | null = null;
      if (regType.registrationFormId) {
        formDefinition = await execute({
          method: 'GET',
          url: `/api/orgadmin/application-forms/${regType.registrationFormId}/with-fields`,
        });
      }

      setState(prev => ({
        ...prev,
        loading: false,
        registrationType: regType,
        formDefinition: formDefinition || null,
      }));
    } catch (error) {
      console.error('Error loading registration type and form:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: t('registrations.creation.error'),
      }));
    }
  };

  const handleBack = () => {
    navigate('/registrations', {
      state: filterState ? { filterState } : undefined,
    });
  };

  const handleCancel = () => {
    navigate('/registrations', {
      state: filterState ? { filterState } : undefined,
    });
  };

  /**
   * Validate a single dynamic field
   */
  const validateField = (field: ApplicationFormWithFields['fields'][0], value: any): string | null => {
    const isRequired = field.required || field.validation?.required;
    if (isRequired) {
      if (value === null || value === undefined || value === '') {
        return t('registrations.creation.fieldRequired', { field: field.label });
      }
    }

    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (field.datatype === 'email') {
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!emailRegex.test(value)) {
        return t('registrations.creation.invalidEmail');
      }
    }

    if (field.datatype === 'number') {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return t('registrations.creation.invalidNumber');
      }
    }

    return null;
  };

  /**
   * Validate entire form
   */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate entity name
    const entityName = state.formData.entityName || '';
    if (!entityName.trim()) {
      errors.entityName = t('registrations.creation.validationError');
    }

    // Validate dynamic fields
    if (state.formDefinition?.fields) {
      for (const field of state.formDefinition.fields) {
        const value = state.formData[field.name];
        const error = validateField(field, value);
        if (error) {
          errors[field.name] = error;
        }
      }
    }

    setState(prev => ({ ...prev, validationErrors: errors }));
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (!state.registrationType || !organisation?.id) {
      setState(prev => ({ ...prev, error: 'Missing required data' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, submitting: true, error: null }));

      const status = state.registrationType.automaticallyApprove ? 'active' : 'pending';

      // Get current user ID
      const authData = await execute({
        method: 'GET',
        url: '/api/orgadmin/auth/me',
      });

      if (!authData?.user?.id) {
        throw new Error('Failed to get current user');
      }

      const currentUserId = authData.user.id;

      // Create form submission
      const formSubmission = await execute({
        method: 'POST',
        url: '/api/orgadmin/form-submissions',
        data: {
          formId: state.registrationType.registrationFormId,
          organisationId: organisation.id,
          userId: currentUserId,
          submissionType: 'registration',
          contextId: state.registrationType.id,
          submissionData: {
            entityName: state.formData.entityName?.trim(),
            ...state.formData,
          },
          status: 'approved',
        },
      });

      if (!formSubmission?.id) {
        throw new Error('Failed to create form submission');
      }

      // Create registration
      await execute({
        method: 'POST',
        url: `/api/orgadmin/organisations/${organisation.id}/registrations`,
        data: {
          registrationTypeId: state.registrationType.id,
          formSubmissionId: formSubmission.id,
          entityName: state.formData.entityName?.trim(),
          status,
        },
      });

      navigate('/registrations', {
        state: {
          successMessage: t('registrations.creation.success'),
          filterState,
        },
      });
    } catch (error) {
      console.error('Error creating registration:', error);
      setState(prev => ({
        ...prev,
        submitting: false,
        error: t('registrations.creation.error'),
      }));
    }
  };

  // Loading state
  if (state.loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBack} data-testid="back-button">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ ml: 2 }}>
            {t('registrations.creation.title')}
          </Typography>
        </Box>
        <Card>
          <CardContent>
            <Skeleton variant="text" width="40%" height={40} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" height={56} sx={{ mb: 3 }} />
            <Skeleton variant="rectangular" height={56} sx={{ mb: 3 }} />
            <Skeleton variant="rectangular" height={56} sx={{ mb: 3 }} />
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Error state (no form loaded)
  if (state.error && !state.registrationType) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBack} data-testid="back-button">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ ml: 2 }}>
            {t('registrations.creation.title')}
          </Typography>
        </Box>
        <Alert severity="error" data-testid="error-alert">{state.error}</Alert>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBack} data-testid="back-button">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ ml: 2 }}>
            {t('registrations.creation.title')}
          </Typography>
        </Box>

        {state.error && (
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            onClose={() => setState(prev => ({ ...prev, error: null }))}
            data-testid="error-alert"
          >
            {state.error}
          </Alert>
        )}

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom data-testid="registration-type-name">
              {state.registrationType?.name}
            </Typography>

            {/* Entity name field */}
            <TextField
              label={
                state.registrationType
                  ? `${state.registrationType.entityName} ${t('registrations.creation.name')}`
                  : t('registrations.creation.entityName')
              }
              value={state.formData.entityName || ''}
              onChange={(e) => {
                setState(prev => ({
                  ...prev,
                  formData: { ...prev.formData, entityName: e.target.value },
                  validationErrors: { ...prev.validationErrors, entityName: '' },
                }));
              }}
              error={!!state.validationErrors.entityName}
              helperText={state.validationErrors.entityName}
              required
              fullWidth
              sx={{ mb: 3, mt: 2 }}
              data-testid="creation-entity-name"
            />

            {/* Dynamic form fields rendered with FieldRenderer */}
            {state.formDefinition?.fields && state.formDefinition.fields.length > 0 && (
              <Box sx={{ mt: 1 }} data-testid="dynamic-form-fields">
                {[...state.formDefinition.fields]
                  .sort((a, b) => a.order - b.order)
                  .map(renderField)}
              </Box>
            )}

            {/* Status hint */}
            {state.registrationType && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }} data-testid="creation-status-hint">
                {state.registrationType.automaticallyApprove
                  ? t('registrations.creation.statusActive')
                  : t('registrations.creation.statusPending')}
              </Typography>
            )}

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button variant="outlined" onClick={handleCancel} data-testid="cancel-button">
                {t('registrations.actions.cancel')}
              </Button>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={state.submitting}
                data-testid="creation-submit-button"
              >
                {state.submitting
                  ? t('registrations.creation.submitting')
                  : t('registrations.creation.submit')}
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Registration Type Selector Dialog */}
        <Dialog
          open={showTypeSelector}
          onClose={() => { setShowTypeSelector(false); handleBack(); }}
          maxWidth="sm"
          fullWidth
          data-testid="type-selector-dialog"
        >
          <DialogTitle>{t('registrations.creation.selectType')}</DialogTitle>
          <DialogContent>
            <List>
              {registrationTypes.map((type) => (
                <ListItemButton
                  key={type.id}
                  onClick={() => handleTypeSelect(type.id)}
                  data-testid={`type-option-${type.id}`}
                >
                  <ListItemText primary={type.name} secondary={type.entityName} />
                </ListItemButton>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setShowTypeSelector(false); handleBack(); }}>
              {t('registrations.actions.cancel')}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default CreateRegistrationPage;
