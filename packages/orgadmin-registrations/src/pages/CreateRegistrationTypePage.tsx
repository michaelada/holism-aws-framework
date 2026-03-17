/**
 * Create/Edit Registration Type Page
 *
 * Thin page wrapper that delegates form rendering to RegistrationTypeForm.
 * Handles routing (create vs edit mode), data fetching for edit, and API submission.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import { useApi } from '@aws-web-framework/orgadmin-core';
import RegistrationTypeForm from '../components/RegistrationTypeForm';
import type { RegistrationTypeFormData } from '../types/registration.types';

const CreateRegistrationTypePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  const { t } = useTranslation();
  const isEditMode = Boolean(id);

  const [initialValues, setInitialValues] = useState<RegistrationTypeFormData | undefined>(undefined);

  useEffect(() => {
    if (isEditMode && id) {
      loadRegistrationType(id);
    }
  }, [id, isEditMode]);

  const loadRegistrationType = async (typeId: string) => {
    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/registration-types/${typeId}`,
      });
      setInitialValues(response);
    } catch (error) {
      console.error('Failed to load registration type:', error);
    }
  };

  const handleSubmit = async (data: RegistrationTypeFormData) => {
    if (isEditMode && id) {
      await execute({
        method: 'PUT',
        url: `/api/orgadmin/registration-types/${id}`,
        data,
      });
    } else {
      await execute({
        method: 'POST',
        url: '/api/orgadmin/registration-types',
        data,
      });
    }
    navigate('/registrations/types');
  };

  const handleCancel = () => {
    navigate('/registrations/types');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {isEditMode ? t('registrations.editRegistrationType') : t('registrations.createRegistrationType')}
      </Typography>

      <RegistrationTypeForm
        initialValues={initialValues}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isEditing={isEditMode}
      />
    </Box>
  );
};

export default CreateRegistrationTypePage;
