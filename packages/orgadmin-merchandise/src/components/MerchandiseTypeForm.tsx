/**
 * Merchandise Type Form Component
 * 
 * Reusable form component for creating and editing merchandise types.
 * This is a wrapper that combines all configuration sections.
 */

import React from 'react';
import { Box } from '@mui/material';
import type { MerchandiseTypeFormData } from '../types/merchandise.types';

interface MerchandiseTypeFormProps {
  formData: MerchandiseTypeFormData;
  onChange: (field: keyof MerchandiseTypeFormData, value: any) => void;
  errors?: Partial<Record<keyof MerchandiseTypeFormData, string>>;
}

const MerchandiseTypeForm: React.FC<MerchandiseTypeFormProps> = ({
  formData,
  onChange,
  errors = {},
}) => {
  // This component serves as a wrapper/container for the form sections
  // The actual form sections are rendered in CreateMerchandiseTypePage
  // This component can be used for validation and form state management
  
  return (
    <Box>
      {/* Form sections are rendered by the parent component */}
      {/* This component provides a consistent interface for form handling */}
    </Box>
  );
};

export default MerchandiseTypeForm;
