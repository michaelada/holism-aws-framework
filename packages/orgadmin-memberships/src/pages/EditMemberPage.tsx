/**
 * Edit Member Page
 * 
 * Page for editing an existing member's information including:
 * - Member record fields (status, labels, processed)
 * - Form submission data (all dynamic form fields)
 * - Membership number (with validation)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
  Alert,
  FormControlLabel,
  Skeleton,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { FieldRenderer } from '@aws-web-framework/components';
import { useApi } from '@aws-web-framework/orgadmin-core';
import { useTranslation } from 'react-i18next';
import type { Member, MemberStatus } from '../types/membership.types';

/**
 * Application Form with Fields Interface
 */
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
    validation?: any;
    options?: any;
    description?: string;
  }>;
}

/**
 * File Metadata Interface
 * Represents uploaded file metadata stored in submission_data
 */
interface FileMetadata {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
}

/**
 * Edit Member Page State Interface
 */
interface EditMemberPageState {
  loading: boolean;
  error: string | null;
  errorType: 'network' | 'api' | 'validation' | null;
  member: Member | null;
  membershipType: any | null;
  formDefinition: ApplicationFormWithFields | null;
  formSubmission: any | null;
  formData: Record<string, any>;
  validationErrors: Record<string, string>;
  submitting: boolean;
  // Member record fields
  status: MemberStatus;
  processed: boolean;
  labels: string[];
  membershipNumber: string;
  newLabel: string;
  uploadedFileIds: string[]; // Track uploaded files for cleanup
  uploadingFiles: Record<string, boolean>; // Track upload progress per field
}

const EditMemberPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  const { t } = useTranslation();

  // State management
  const [state, setState] = useState<EditMemberPageState>({
    loading: true,
    error: null,
    errorType: null,
    member: null,
    membershipType: null,
    formDefinition: null,
    formSubmission: null,
    formData: {},
    validationErrors: {},
    submitting: false,
    status: 'pending',
    processed: false,
    labels: [],
    membershipNumber: '',
    newLabel: '',
    uploadedFileIds: [],
    uploadingFiles: {},
  });

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
      'multiselect': 'multi_select',
      'radio': 'single_select',
      'checkbox': 'multi_select',
      'file': 'document_upload',
      'image': 'document_upload',
    };
    return mapping[datatype] || 'text';
  };

  /**
   * Transform field options from string array to {value, label} format
   */
  const transformOptions = (field: ApplicationFormWithFields['fields'][0]) => {
    const baseProperties: Record<string, any> = {};

    // Add file type property for image fields
    if (field.datatype === 'image') {
      baseProperties.fileType = 'image';
      baseProperties.acceptImages = true;
    }

    if (!field.options || !Array.isArray(field.options)) {
      return baseProperties;
    }

    // Convert string array to {value, label} format
    const options = field.options.map((opt: string) => ({
      value: opt,
      label: opt,
    }));

    // Set displayMode based on field type
    const displayMode = field.datatype === 'radio' ? 'radio' : 'dropdown';

    return {
      ...baseProperties,
      options,
      displayMode,
    };
  };

  /**
   * Upload file to S3 and return metadata
   */
  const uploadFileToS3 = async (
    file: File,
    fieldId: string,
    fieldType: 'file' | 'image'
  ): Promise<FileMetadata> => {
    if (!state.membershipType || !state.member?.organisationId) {
      throw new Error('Missing required data for file upload');
    }

    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('organizationId', state.member.organisationId);
    formData.append('formId', state.membershipType.membershipFormId);
    formData.append('fieldId', fieldId);
    formData.append('fieldType', fieldType);

    try {
      // Upload to S3 via the file upload endpoint
      const response = await execute({
        method: 'POST',
        url: '/api/orgadmin/files/upload',
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response?.success || !response?.file) {
        throw new Error('File upload failed');
      }

      const uploadedFile = response.file;

      // Return file metadata
      return {
        fileId: uploadedFile.fileId,
        fileName: uploadedFile.fileName,
        fileSize: uploadedFile.fileSize,
        mimeType: uploadedFile.mimeType,
        url: '', // URL will be generated on-demand when viewing
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Failed to upload file. Please try again.'
      );
    }
  };

  /**
   * Delete uploaded file from S3 (for cleanup)
   */
  const deleteUploadedFile = async (fileId: string): Promise<void> => {
    try {
      await execute({
        method: 'DELETE',
        url: `/api/orgadmin/files/${fileId}`,
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      // Don't throw - cleanup is best-effort
    }
  };

  /**
   * Validate a single dynamic field
   */
  const validateField = (field: ApplicationFormWithFields['fields'][0], value: any): string | null => {
    // Check required validation
    if (field.validation?.required) {
      if (value === null || value === undefined || value === '') {
        return t('memberships.validation.fieldRequired', `${field.label} is required`);
      }
    }

    // If field is empty and not required, skip other validations
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // Email format validation
    if (field.datatype === 'email') {
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!emailRegex.test(value)) {
        return t('memberships.validation.invalidEmail', 'Invalid email format');
      }
    }

    // Number range validation
    if (field.datatype === 'number') {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return t('memberships.validation.invalidNumber', 'Invalid number');
      }
      
      if (field.validation?.min !== undefined && numValue < field.validation.min) {
        return t('memberships.validation.numberTooSmall', `Value must be at least ${field.validation.min}`);
      }
      
      if (field.validation?.max !== undefined && numValue > field.validation.max) {
        return t('memberships.validation.numberTooLarge', `Value must be at most ${field.validation.max}`);
      }
    }

    // Text length validation
    if (field.datatype === 'text' || field.datatype === 'textarea') {
      const strValue = String(value);
      
      if (field.validation?.minLength !== undefined && strValue.length < field.validation.minLength) {
        return t('memberships.validation.textTooShort', `Must be at least ${field.validation.minLength} characters`);
      }
      
      if (field.validation?.maxLength !== undefined && strValue.length > field.validation.maxLength) {
        return t('memberships.validation.textTooLong', `Must be at most ${field.validation.maxLength} characters`);
      }
    }

    // Pattern validation
    if (field.validation?.pattern) {
      const regex = new RegExp(field.validation.pattern);
      if (!regex.test(String(value))) {
        return t('memberships.validation.invalidFormat', 'Invalid format');
      }
    }

    return null;
  };

  /**
   * Render a dynamic form field using FieldRenderer
   */
  const renderField = (field: ApplicationFormWithFields['fields'][0]) => {
    // Convert ApplicationFormField to FieldDefinition format expected by FieldRenderer
    const fieldDefinition = {
      shortName: field.name,
      displayName: field.label,
      description: field.description || '',
      datatype: mapDatatypeToRenderer(field.datatype) as any,
      datatypeProperties: transformOptions(field),
      validationRules: field.validation?.rules || [],
    };

    // Get the current value
    let currentValue = state.formData[field.name] || '';
    
    // For file/document fields, filter out empty objects
    if ((field.datatype === 'file' || field.datatype === 'image') && Array.isArray(currentValue)) {
      currentValue = currentValue.filter((file: any) => {
        // Keep only files that have actual data (name, size, url, etc.)
        return file && typeof file === 'object' && Object.keys(file).length > 0 && (file.name || file.url || file.fileName);
      });
    }

    // Check if this is a file upload field
    const isFileField = field.datatype === 'file' || field.datatype === 'image';

    return (
      <Box key={field.id} sx={{ mb: 3 }}>
        <FieldRenderer
          fieldDefinition={fieldDefinition}
          value={currentValue}
          onChange={async (value: any) => {
            // Handle file upload fields specially
            if (isFileField && value && Array.isArray(value)) {
              // Check if value contains File objects (not already uploaded)
              const hasFileObjects = value.some((item: any) => item instanceof File);
              
              if (hasFileObjects) {
                // Validate files before upload for image fields
                if (field.datatype === 'image') {
                  const invalidFiles = value.filter((item: any) => {
                    if (!(item instanceof File)) return false;
                    // Check if file is an image
                    return !item.type.startsWith('image/');
                  });

                  if (invalidFiles.length > 0) {
                    const invalidNames = invalidFiles.map((f: File) => f.name).join(', ');
                    setState(prev => ({
                      ...prev,
                      validationErrors: {
                        ...prev.validationErrors,
                        [field.name]: `Only image files are allowed. Invalid files: ${invalidNames}`,
                      },
                    }));
                    return; // Don't proceed with upload
                  }
                }

                // Mark field as uploading
                setState(prev => ({
                  ...prev,
                  uploadingFiles: {
                    ...prev.uploadingFiles,
                    [field.name]: true,
                  },
                }));

                try {
                  // Upload all File objects and convert to metadata
                  const uploadedMetadata: FileMetadata[] = [];
                  const fileIds: string[] = [];

                  for (const item of value) {
                    if (item instanceof File) {
                      // Upload the file with field type
                      const fieldType = field.datatype === 'image' ? 'image' : 'file';
                      const metadata = await uploadFileToS3(item, field.id, fieldType);
                      uploadedMetadata.push(metadata);
                      fileIds.push(metadata.fileId);
                    } else if (item && typeof item === 'object' && 'fileId' in item) {
                      // Already uploaded metadata
                      uploadedMetadata.push(item as FileMetadata);
                    }
                  }

                  // Update state with metadata instead of File objects
                  setState(prev => ({
                    ...prev,
                    formData: {
                      ...prev.formData,
                      [field.name]: uploadedMetadata,
                    },
                    uploadedFileIds: [...prev.uploadedFileIds, ...fileIds],
                    uploadingFiles: {
                      ...prev.uploadingFiles,
                      [field.name]: false,
                    },
                    validationErrors: {
                      ...prev.validationErrors,
                      [field.name]: '',
                    },
                  }));
                } catch (error) {
                  // Handle upload error
                  const errorMessage = error instanceof Error
                    ? error.message
                    : 'Failed to upload file';

                  setState(prev => ({
                    ...prev,
                    uploadingFiles: {
                      ...prev.uploadingFiles,
                      [field.name]: false,
                    },
                    validationErrors: {
                      ...prev.validationErrors,
                      [field.name]: errorMessage,
                    },
                  }));
                }
                return;
              }
            }

            // Non-file fields or already-uploaded files
            setState(prev => ({
              ...prev,
              formData: {
                ...prev.formData,
                [field.name]: value,
              },
              validationErrors: {
                ...prev.validationErrors,
                [field.name]: '',
              },
            }));
          }}
          onBlur={() => {
            const value = state.formData[field.name];
            const error = validateField(field, value);
            if (error) {
              setState(prev => ({
                ...prev,
                validationErrors: {
                  ...prev.validationErrors,
                  [field.name]: error,
                },
              }));
            }
          }}
          disabled={state.uploadingFiles[field.name] || false}
          required={field.validation?.required || false}
          error={state.validationErrors[field.name]}
        />
        {state.uploadingFiles[field.name] && (
          <Typography color="primary" variant="caption" sx={{ mt: 1, display: 'block' }}>
            {t('memberships.uploadingFile', 'Uploading file...')}
          </Typography>
        )}
        {state.validationErrors[field.name] && (
          <Typography color="error" variant="caption">
            {state.validationErrors[field.name]}
          </Typography>
        )}
      </Box>
    );
  };

  // Load member data on mount
  useEffect(() => {
    if (id) {
      loadMember(id);
    }
  }, [id]);

  /**
   * Load member and all related data
   */
  const loadMember = async (memberId: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null, errorType: null }));

      // Load member
      const member = await execute({
        method: 'GET',
        url: `/api/orgadmin/members/${memberId}`,
      });

      if (!member) {
        throw new Error('Member not found');
      }

      // Load membership type
      const membershipType = await execute({
        method: 'GET',
        url: `/api/orgadmin/membership-types/${member.membershipTypeId}`,
      });

      if (!membershipType) {
        throw new Error('Membership type not found');
      }

      // Load form definition
      const formDefinition = await execute({
        method: 'GET',
        url: `/api/orgadmin/application-forms/${membershipType.membershipFormId}/with-fields`,
      });

      if (!formDefinition) {
        throw new Error('Form definition not found');
      }

      // Load form submission
      const formSubmission = await execute({
        method: 'GET',
        url: `/api/orgadmin/form-submissions/${member.formSubmissionId}`,
      });

      if (!formSubmission) {
        throw new Error('Form submission not found');
      }

      // Initialize state with loaded data
      setState(prev => ({
        ...prev,
        loading: false,
        member,
        membershipType,
        formDefinition,
        formSubmission,
        formData: formSubmission.submissionData || {},
        status: member.status,
        processed: member.processed,
        labels: member.labels || [],
        membershipNumber: member.membershipNumber || '',
      }));
    } catch (error) {
      console.error('Error loading member:', error);
      
      let errorType: 'network' | 'api' = 'api';
      let errorMessage = 'Failed to load member';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('timeout')) {
          errorType = 'network';
          errorMessage = t('memberships.errors.networkError', 'Network error. Please check your connection and try again.');
        } else if (errorMessage.includes('not found')) {
          errorMessage = t('memberships.errors.notFound', 'The requested member was not found.');
        } else {
          errorMessage = t('memberships.errors.loadFailed', 'Failed to load member. Please try again.');
        }
      }
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        errorType,
      }));
    }
  };

  /**
   * Handle back button click
   */
  const handleBack = () => {
    navigate(`/members/${id}`);
  };

  /**
   * Handle retry button click (for network errors)
   */
  const handleRetry = () => {
    if (id) {
      loadMember(id);
    }
  };

  /**
   * Handle cancel button click
   */
  const handleCancel = () => {
    navigate(`/members/${id}`);
  };

  /**
   * Handle add label
   */
  const handleAddLabel = () => {
    const trimmedLabel = state.newLabel.trim();
    if (trimmedLabel && !state.labels.includes(trimmedLabel)) {
      setState(prev => ({
        ...prev,
        labels: [...prev.labels, trimmedLabel],
        newLabel: '',
      }));
    }
  };

  /**
   * Handle remove label
   */
  const handleRemoveLabel = (labelToRemove: string) => {
    setState(prev => ({
      ...prev,
      labels: prev.labels.filter(label => label !== labelToRemove),
    }));
  };

  /**
   * Validate entire form
   */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Validate membership number
    if (!state.membershipNumber.trim()) {
      errors.membershipNumber = t('memberships.validation.membershipNumberRequired', 'Membership number is required');
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
    
    setState(prev => ({
      ...prev,
      validationErrors: errors,
    }));
    
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    if (!state.member) {
      setState(prev => ({
        ...prev,
        error: 'Missing required data for submission',
      }));
      return;
    }

    try {
      setState(prev => ({ ...prev, submitting: true, error: null }));

      // Step 1: Update form submission data
      await execute({
        method: 'PATCH',
        url: `/api/orgadmin/form-submissions/${state.member.formSubmissionId}`,
        data: {
          submissionData: state.formData,
        },
      });

      // Step 2: Update member record
      await execute({
        method: 'PATCH',
        url: `/api/orgadmin/members/${state.member.id}`,
        data: {
          status: state.status,
          processed: state.processed,
          labels: state.labels,
          membershipNumber: state.membershipNumber,
        },
      });

      // Success! Clear uploaded file IDs (no cleanup needed on success)
      setState(prev => ({ ...prev, uploadedFileIds: [] }));

      // Navigate back to member details
      navigate(`/members/${id}`, {
        state: {
          successMessage: t('memberships.memberUpdatedSuccessfully', 'Member updated successfully'),
        },
      });
    } catch (error) {
      console.error('Error updating member:', error);

      // Cleanup orphaned files on submission failure
      if (state.uploadedFileIds.length > 0) {
        for (const fileId of state.uploadedFileIds) {
          await deleteUploadedFile(fileId);
        }
        setState(prev => ({ ...prev, uploadedFileIds: [] }));
      }
      
      let errorType: 'network' | 'api' | 'validation' = 'api';
      let errorMessage = 'Failed to update member';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('timeout')) {
          errorType = 'network';
          errorMessage = t('memberships.errors.networkError', 'Network error. Please check your connection and try again.');
        } else if (errorMessage.includes('already exists') || errorMessage.includes('duplicate') || errorMessage.includes('Membership number')) {
          errorType = 'validation';
          errorMessage = t('memberships.errors.duplicateMembershipNumber', 'This membership number already exists. Please use a different number.');
        } else if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('required')) {
          errorType = 'validation';
          errorMessage = t('memberships.errors.validationError', 'Validation error. Please check your input and try again.');
        } else {
          errorMessage = t('memberships.errors.updateFailed', 'Failed to update member. Please try again.');
        }
      }
      
      setState(prev => ({
        ...prev,
        submitting: false,
        error: errorMessage,
        errorType,
      }));
    }
  };

  // Render loading state
  if (state.loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBack}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ ml: 2 }}>
            {t('memberships.actions.editMember')}
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

  // Render error state
  if (state.error && !state.member) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBack}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ ml: 2 }}>
            {t('memberships.actions.editMember')}
          </Typography>
        </Box>
        <Alert 
          severity="error"
          action={
            state.errorType === 'network' ? (
              <Button color="inherit" size="small" onClick={handleRetry}>
                {t('common.retry', 'Retry')}
              </Button>
            ) : undefined
          }
        >
          {state.error}
        </Alert>
      </Box>
    );
  }

  // Render form
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBack}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ ml: 2 }}>
            {t('memberships.actions.editMember')}
          </Typography>
        </Box>

        {/* Error alert */}
        {state.error && (
          <Alert 
            severity="error"
            sx={{ mb: 3 }}
            onClose={() => setState(prev => ({ ...prev, error: null, errorType: null }))}
            action={
              state.errorType === 'network' ? (
                <Button color="inherit" size="small" onClick={handleRetry}>
                  {t('common.retry', 'Retry')}
                </Button>
              ) : undefined
            }
          >
            {state.error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Member Record Fields */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('memberships.sections.membershipInfo')}
                </Typography>

                {/* Membership Number */}
                <TextField
                  label={t('memberships.fields.membershipNumber')}
                  value={state.membershipNumber}
                  onChange={(e) => {
                    setState(prev => ({
                      ...prev,
                      membershipNumber: e.target.value,
                      validationErrors: {
                        ...prev.validationErrors,
                        membershipNumber: '',
                      },
                    }));
                  }}
                  error={!!state.validationErrors.membershipNumber}
                  helperText={state.validationErrors.membershipNumber}
                  required
                  fullWidth
                  sx={{ mb: 3 }}
                />

                {/* Status */}
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>{t('memberships.fields.status')}</InputLabel>
                  <Select
                    value={state.status}
                    label={t('memberships.fields.status')}
                    onChange={(e) => setState(prev => ({ ...prev, status: e.target.value as MemberStatus }))}
                  >
                    <MenuItem value="pending">{t('memberships.memberStatus.pending')}</MenuItem>
                    <MenuItem value="active">{t('memberships.memberStatus.active')}</MenuItem>
                    <MenuItem value="elapsed">{t('memberships.memberStatus.elapsed')}</MenuItem>
                  </Select>
                </FormControl>

                {/* Processed */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={state.processed}
                      onChange={(e) => setState(prev => ({ ...prev, processed: e.target.checked }))}
                    />
                  }
                  label={t('memberships.fields.processed')}
                  sx={{ mb: 2 }}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Labels */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('memberships.table.labels')}
                </Typography>

                {/* Existing labels */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  {state.labels.length > 0 ? (
                    state.labels.map((label) => (
                      <Chip
                        key={label}
                        label={label}
                        onDelete={() => handleRemoveLabel(label)}
                      />
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t('memberships.labels.noLabelsAssigned')}
                    </Typography>
                  )}
                </Box>

                {/* Add new label */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    label={t('memberships.labels.addLabel', 'Add Label')}
                    value={state.newLabel}
                    onChange={(e) => setState(prev => ({ ...prev, newLabel: e.target.value }))}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLabel();
                      }
                    }}
                    size="small"
                    fullWidth
                  />
                  <Button
                    variant="outlined"
                    onClick={handleAddLabel}
                    disabled={!state.newLabel.trim()}
                  >
                    {t('common.add', 'Add')}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Form Submission Data */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('memberships.sections.applicationFormData', 'Application Form Data')}
                </Typography>

                {/* Dynamic form fields */}
                {state.formDefinition?.fields && state.formDefinition.fields.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    {[...state.formDefinition.fields]
                      .sort((a, b) => a.order - b.order)
                      .map(renderField)}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button
            variant="outlined"
            onClick={handleCancel}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={state.submitting}
          >
            {state.submitting
              ? t('memberships.updating', 'Updating...')
              : t('memberships.updateMember', 'Update Member')}
          </Button>
        </Box>
      </Box>
    </LocalizationProvider>
  );
};

export default EditMemberPage;
