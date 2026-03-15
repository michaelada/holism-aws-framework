/**
 * Create Member Page
 * 
 * Page for manually creating a new member with dynamic form fields
 * based on the selected membership type's form definition.
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
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { FieldRenderer } from '@aws-web-framework/components';
import { useApi } from '@aws-web-framework/orgadmin-core';
import { useOrganisation } from '@aws-web-framework/orgadmin-core';
import { useTranslation } from 'react-i18next';
import type { MembershipType } from '../types/membership.types';
import MembershipTypeSelector from '../components/MembershipTypeSelector';

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
 * Organization Type Configuration Interface
 */
interface OrganizationTypeConfig {
  id: string;
  name: string;
  membershipNumbering: 'internal' | 'external';
  membershipNumberUniqueness: 'organization_type' | 'organization';
  initialMembershipNumber: number;
}

/**
 * Create Member Page State Interface
 */
interface CreateMemberPageState {
  loading: boolean;
  error: string | null;
  errorType: 'network' | 'api' | 'validation' | null;
  membershipType: MembershipType | null;
  formDefinition: ApplicationFormWithFields | null;
  organizationTypeConfig: OrganizationTypeConfig | null;
  formData: Record<string, any>;
  validationErrors: Record<string, string>;
  submitting: boolean;
  uploadedFileIds: string[]; // Track uploaded files for cleanup
  uploadingFiles: Record<string, boolean>; // Track upload progress per field
}

const CreateMemberPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  const { t } = useTranslation();

  const typeId = searchParams.get('typeId');
  const filterState = location.state?.filterState;

  // State management
  const [state, setState] = useState<CreateMemberPageState>({
    loading: true,
    error: null,
    errorType: null,
    membershipType: null,
    formDefinition: null,
    organizationTypeConfig: null,
    formData: {},
    validationErrors: {},
    submitting: false,
    uploadedFileIds: [],
    uploadingFiles: {},
  });

  // State for membership type selection
  const [membershipTypes, setMembershipTypes] = useState<MembershipType[]>([]);
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
    if (!state.membershipType || !organisation?.id) {
      throw new Error('Missing required data for file upload');
    }

    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('organizationId', organisation.id);
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

    // Check if this is a file upload field
    const isFileField = field.datatype === 'file' || field.datatype === 'image';

    return (
      <Box key={field.id} sx={{ mb: 3 }}>
        <FieldRenderer
          fieldDefinition={fieldDefinition}
          value={state.formData[field.name] || ''}
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
                    const errorMsg = `Only image files are allowed. Invalid files: ${invalidNames}`;
                    setState(prev => ({
                      ...prev,
                      validationErrors: {
                        ...prev.validationErrors,
                        [field.name]: errorMsg,
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
              // Clear validation error when user starts typing
              validationErrors: {
                ...prev.validationErrors,
                [field.name]: '',
              },
            }));
          }}
          onBlur={() => {
            // Validate field on blur
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

  // Load membership type and form definition on mount
  useEffect(() => {
    if (typeId && organisation?.id) {
      // TypeId provided - load the specific membership type
      loadMembershipTypeAndForm(typeId);
    } else if (organisation?.id) {
      // No typeId - load all membership types to show selector
      loadMembershipTypes();
    }
  }, [typeId, organisation?.id]);

  /**
   * Load all membership types for selection
   */
  const loadMembershipTypes = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null, errorType: null }));

      const types = await execute({
        method: 'GET',
        url: '/api/orgadmin/membership-types',
      });

      const typesArray = Array.isArray(types) ? types : [];
      setMembershipTypes(typesArray);

      if (typesArray.length === 0) {
        // No membership types available
        setState(prev => ({
          ...prev,
          loading: false,
          error: t('memberships.errors.noTypesAvailable', 'No membership types available'),
          errorType: 'validation',
        }));
      } else if (typesArray.length === 1) {
        // Only one type - auto-select it
        loadMembershipTypeAndForm(typesArray[0].id);
      } else {
        // Multiple types - show selector
        setState(prev => ({ ...prev, loading: false }));
        setShowTypeSelector(true);
      }
    } catch (error) {
      console.error('Failed to load membership types:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: t('memberships.errors.loadTypesFailed', 'Failed to load membership types'),
        errorType: 'api',
      }));
    }
  };

  /**
   * Handle membership type selection from dialog
   */
  const handleTypeSelect = (selectedTypeId: string) => {
    setShowTypeSelector(false);
    // Update URL with selected type ID
    navigate(`/members/create?typeId=${selectedTypeId}`, {
      replace: true,
      state: location.state,
    });
    // Load the selected membership type
    loadMembershipTypeAndForm(selectedTypeId);
  };

  /**
   * Handle membership type selector close
   */
  const handleTypeSelectorClose = () => {
    setShowTypeSelector(false);
    // Navigate back to members database
    handleBack();
  };

  /**
   * Load membership type and associated form definition
   */
  const loadMembershipTypeAndForm = async (membershipTypeId: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null, errorType: null }));

      // Load membership type
      const membershipType = await execute({
        method: 'GET',
        url: `/api/orgadmin/membership-types/${membershipTypeId}`,
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

      // Load organization type configuration
      let organizationTypeConfig: OrganizationTypeConfig | null = null;
      if (organisation?.organizationTypeId) {
        try {
          const orgType = await execute({
            method: 'GET',
            url: `/api/organization-types/${organisation.organizationTypeId}`,
          });
          
          if (orgType) {
            organizationTypeConfig = {
              id: orgType.id,
              name: orgType.name,
              membershipNumbering: orgType.membershipNumbering || 'internal',
              membershipNumberUniqueness: orgType.membershipNumberUniqueness || 'organization',
              initialMembershipNumber: orgType.initialMembershipNumber || 1000000,
            };
          }
        } catch (error) {
          console.error('Failed to load organization type config:', error);
          // Continue without config - will default to internal mode
        }
      }

      setState(prev => ({
        ...prev,
        loading: false,
        membershipType,
        formDefinition,
        organizationTypeConfig,
      }));
    } catch (error) {
      console.error('Error loading membership type and form:', error);
      
      // Categorize error type
      let errorType: 'network' | 'api' = 'api';
      let errorMessage = 'Failed to load form';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        // Network errors typically have specific messages or no response
        if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('timeout')) {
          errorType = 'network';
          errorMessage = t('memberships.errors.networkError', 'Network error. Please check your connection and try again.');
        } else if (errorMessage.includes('not found')) {
          errorMessage = t('memberships.errors.notFound', 'The requested membership type or form was not found.');
        } else {
          errorMessage = t('memberships.errors.loadFailed', 'Failed to load form. Please try again.');
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
    navigate('/members', {
      state: filterState ? { filterState } : undefined,
    });
  };

  /**
   * Handle retry button click (for network errors)
   */
  const handleRetry = () => {
    if (typeId) {
      loadMembershipTypeAndForm(typeId);
    }
  };

  /**
   * Handle cancel button click
   */
  const handleCancel = () => {
    navigate('/members', {
      state: filterState ? { filterState } : undefined,
    });
  };

  /**
   * Validate name field
   */
  const validateNameField = (value: string): string | null => {
    const trimmedValue = value.trim();
    
    if (!trimmedValue) {
      return t('memberships.validation.nameRequired', 'Name is required');
    }
    
    if (trimmedValue.length < 1) {
      return t('memberships.validation.nameTooShort', 'Name must be at least 1 character');
    }
    
    if (trimmedValue.length > 255) {
      return t('memberships.validation.nameTooLong', 'Name must not exceed 255 characters');
    }
    
    return null;
  };

  /**
   * Handle name field change
   */
  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setState(prev => ({
      ...prev,
      formData: {
        ...prev.formData,
        name: value,
      },
      // Clear validation error when user starts typing
      validationErrors: {
        ...prev.validationErrors,
        name: '',
      },
    }));
  };

  /**
   * Handle name field blur (validate on blur)
   */
  const handleNameBlur = () => {
    const nameValue = state.formData.name || '';
    const error = validateNameField(nameValue);
    
    if (error) {
      setState(prev => ({
        ...prev,
        validationErrors: {
          ...prev.validationErrors,
          name: error,
        },
      }));
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
   * Validate all dynamic fields
   */
  const validateAllFields = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (state.formDefinition?.fields) {
      for (const field of state.formDefinition.fields) {
        const value = state.formData[field.name];
        const error = validateField(field, value);
        if (error) {
          errors[field.name] = error;
        }
      }
    }

    return errors;
  };

  /**
   * Validate entire form
   */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Validate name field
    const nameError = validateNameField(state.formData.name || '');
    if (nameError) {
      errors.name = nameError;
    }
    
    // Validate membership number field (only for external mode)
    if (state.organizationTypeConfig?.membershipNumbering === 'external') {
      const membershipNumber = state.formData.membershipNumber || '';
      if (!membershipNumber.trim()) {
        errors.membershipNumber = t('memberships.validation.membershipNumberRequired', 'Membership number is required');
      }
    }
    
    // Validate dynamic fields
    const fieldErrors = validateAllFields();
    Object.assign(errors, fieldErrors);
    
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

    // Check that we have all required data
    if (!state.membershipType || !organisation?.id) {
      setState(prev => ({
        ...prev,
        error: 'Missing required data for submission',
      }));
      return;
    }

    try {
      setState(prev => ({ ...prev, submitting: true, error: null }));

      // Get current user ID
      const authData = await execute({
        method: 'GET',
        url: '/api/orgadmin/auth/me',
      });

      if (!authData?.user?.id) {
        throw new Error('Failed to get current user');
      }

      const currentUserId = authData.user.id;

      // Step 1: Create form submission record
      const submissionPayload = {
        formId: state.membershipType.membershipFormId,
        organisationId: organisation.id,
        userId: currentUserId,
        submissionType: 'membership_application',
        contextId: state.membershipType.id, // Use membership type ID as context
        submissionData: state.formData,
        status: 'approved',
      };

      console.log('Creating form submission with payload:', submissionPayload);
      console.log('contextId type:', typeof submissionPayload.contextId);
      console.log('contextId value:', submissionPayload.contextId);

      const formSubmission = await execute({
        method: 'POST',
        url: '/api/orgadmin/form-submissions',
        data: submissionPayload,
      });

      if (!formSubmission?.id) {
        throw new Error('Failed to create form submission');
      }

      // Step 2: Extract first and last name from the name field
      const nameParts = (state.formData.name || '').trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0] || '';

      // Step 3: Create member record with form submission ID
      const memberPayload: any = {
        organisationId: organisation.id,
        membershipTypeId: state.membershipType.id,
        userId: currentUserId,
        firstName,
        lastName,
        formSubmissionId: formSubmission.id,
        status: state.membershipType.automaticallyApprove ? 'active' : 'pending',
      };

      // Include membership number only for external mode
      if (state.organizationTypeConfig?.membershipNumbering === 'external') {
        memberPayload.membershipNumber = state.formData.membershipNumber;
      }

      const member = await execute({
        method: 'POST',
        url: '/api/orgadmin/members',
        data: memberPayload,
      });

      if (!member?.id) {
        throw new Error('Failed to create member');
      }

      // Success! Clear uploaded file IDs (no cleanup needed on success)
      setState(prev => ({ ...prev, uploadedFileIds: [] }));

      // Navigate back to members database
      // For internal mode, include the generated membership number in the success message
      const successMessage = state.organizationTypeConfig?.membershipNumbering === 'internal' && member.membershipNumber
        ? t('memberships.memberCreatedWithNumber', `Member created successfully with membership number ${member.membershipNumber}`)
        : t('memberships.memberCreatedSuccessfully', 'Member created successfully');

      navigate('/members', {
        state: {
          successMessage,
          createdMemberName: state.formData.name,
          filterState,
        },
      });
    } catch (error) {
      console.error('Error creating member:', error);

      // Cleanup orphaned files on submission failure
      if (state.uploadedFileIds.length > 0) {
        for (const fileId of state.uploadedFileIds) {
          await deleteUploadedFile(fileId);
        }
        setState(prev => ({ ...prev, uploadedFileIds: [] }));
      }
      
      // Categorize error type
      let errorType: 'network' | 'api' | 'validation' = 'api';
      let errorMessage = 'Failed to create member';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        // Network errors
        if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('timeout')) {
          errorType = 'network';
          errorMessage = t('memberships.errors.networkError', 'Network error. Please check your connection and try again.');
        }
        // Duplicate membership number error (external mode)
        else if (errorMessage.includes('already exists') || errorMessage.includes('duplicate') || errorMessage.includes('Membership number')) {
          errorType = 'validation';
          // Use the error message from the API if it contains membership number info
          if (errorMessage.includes('Membership number')) {
            errorMessage = errorMessage;
          } else {
            errorMessage = t('memberships.errors.duplicateMembershipNumber', 'This membership number already exists. Please use a different number.');
          }
        }
        // Validation errors
        else if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('required')) {
          errorType = 'validation';
          errorMessage = t('memberships.errors.validationError', 'Validation error. Please check your input and try again.');
        }
        // API errors
        else {
          errorMessage = t('memberships.errors.createFailed', 'Failed to create member. Please try again.');
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

  // Render loading state with skeleton loader
  if (state.loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBack} data-testid="back-button">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ ml: 2 }}>
            {t('memberships.addMember', 'Add New Member')}
          </Typography>
        </Box>
        <Card>
          <CardContent>
            {/* Skeleton loader for form definition */}
            <Skeleton variant="text" width="40%" height={40} sx={{ mb: 2 }} data-testid="skeleton-title" />
            <Skeleton variant="rectangular" height={56} sx={{ mb: 3 }} data-testid="skeleton-field-1" />
            <Skeleton variant="rectangular" height={56} sx={{ mb: 3 }} data-testid="skeleton-field-2" />
            <Skeleton variant="rectangular" height={56} sx={{ mb: 3 }} data-testid="skeleton-field-3" />
            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Skeleton variant="rectangular" width={100} height={36} data-testid="skeleton-button-1" />
              <Skeleton variant="rectangular" width={150} height={36} data-testid="skeleton-button-2" />
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Render error state (when loading failed and no form is available)
  if (state.error && !state.membershipType) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBack} data-testid="back-button">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ ml: 2 }}>
            {t('memberships.addMember', 'Add New Member')}
          </Typography>
        </Box>
        <Alert 
          severity="error" 
          data-testid="error-alert"
          action={
            state.errorType === 'network' ? (
              <Button 
                color="inherit" 
                size="small" 
                onClick={handleRetry}
                data-testid="retry-button"
              >
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

  // Render form (with error alert if there's an error)
  // LocalizationProvider must be at page level (not in DateRenderer component) to work around
  // Vite module resolution issue in development mode. In a monorepo setup, Vite may load multiple
  // instances of @mui/x-date-pickers from different packages, breaking React context propagation.
  // Placing the provider here ensures it wraps all date/time/datetime fields in the form.
  // See: .kiro/specs/date-picker-localization-fix/design.md for full technical details.
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBack} data-testid="back-button">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ ml: 2 }}>
            {t('memberships.addMember', 'Add New Member')}
          </Typography>
        </Box>

        {/* Error alert - displayed above the form */}
        {state.error && (
          <Alert 
            severity="error" 
            data-testid="error-alert"
            sx={{ mb: 3 }}
            onClose={() => setState(prev => ({ ...prev, error: null, errorType: null }))}
            action={
              state.errorType === 'network' ? (
                <Button 
                  color="inherit" 
                  size="small" 
                  onClick={handleRetry}
                  data-testid="retry-button"
                >
                  {t('common.retry', 'Retry')}
                </Button>
              ) : undefined
            }
          >
            {state.error}
          </Alert>
        )}

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom data-testid="membership-type-name">
              {state.membershipType?.name}
            </Typography>

            {/* Name field (always required) */}
            <TextField
              label={t('memberships.name', 'Name')}
              value={state.formData.name || ''}
              onChange={handleNameChange}
              onBlur={handleNameBlur}
              error={!!state.validationErrors.name}
              helperText={state.validationErrors.name}
              required
              fullWidth
              sx={{ mb: 3, mt: 2 }}
              data-testid="name-field"
              inputProps={{
                'data-testid': 'name-input',
              }}
            />

            {/* Membership Number field (only for external mode) */}
            {state.organizationTypeConfig?.membershipNumbering === 'external' && (
              <TextField
                label={t('memberships.membershipNumber', 'Membership Number')}
                value={state.formData.membershipNumber || ''}
                onChange={(e) => {
                  setState(prev => ({
                    ...prev,
                    formData: {
                      ...prev.formData,
                      membershipNumber: e.target.value,
                    },
                    validationErrors: {
                      ...prev.validationErrors,
                      membershipNumber: '',
                    },
                  }));
                }}
                onBlur={() => {
                  const value = state.formData.membershipNumber || '';
                  if (!value.trim()) {
                    setState(prev => ({
                      ...prev,
                      validationErrors: {
                        ...prev.validationErrors,
                        membershipNumber: t('memberships.validation.membershipNumberRequired', 'Membership number is required'),
                      },
                    }));
                  }
                }}
                error={!!state.validationErrors.membershipNumber}
                helperText={state.validationErrors.membershipNumber || t('memberships.membershipNumberHelp', 'Enter the existing membership number from your external system')}
                required
                fullWidth
                sx={{ mb: 3 }}
                data-testid="membership-number-field"
                inputProps={{
                  'data-testid': 'membership-number-input',
                }}
              />
            )}

            {/* Dynamic form fields rendered from form definition */}
            {state.formDefinition?.fields && state.formDefinition.fields.length > 0 && (
              <Box sx={{ mt: 3 }}>
                {[...state.formDefinition.fields]
                  .sort((a, b) => a.order - b.order)
                  .map(renderField)}
              </Box>
            )}

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button
                variant="outlined"
                onClick={handleCancel}
                data-testid="cancel-button"
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={state.submitting}
                data-testid="submit-button"
              >
                {state.submitting
                  ? t('memberships.creating', 'Creating...')
                  : t('memberships.createMember', 'Create Member')}
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Membership Type Selector Dialog */}
        <MembershipTypeSelector
          open={showTypeSelector}
          onClose={handleTypeSelectorClose}
          onSelect={handleTypeSelect}
          membershipTypes={membershipTypes}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default CreateMemberPage;
