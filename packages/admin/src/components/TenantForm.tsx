import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Paper,
  Typography,
  CircularProgress,
} from '@mui/material';
import { Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { Tenant, CreateTenantDto, UpdateTenantDto } from '../types/admin.types';

interface TenantFormProps {
  tenant?: Tenant | null;
  loading: boolean;
  onSubmit: (data: CreateTenantDto | UpdateTenantDto) => void;
  onCancel: () => void;
}

interface FormData {
  name: string;
  displayName: string;
  domain: string;
}

interface FormErrors {
  name?: string;
  displayName?: string;
  domain?: string;
}

export function TenantForm({ tenant, loading, onSubmit, onCancel }: TenantFormProps) {
  const isEditMode = !!tenant;

  const [formData, setFormData] = useState<FormData>({
    name: '',
    displayName: '',
    domain: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name,
        displayName: tenant.displayName,
        domain: tenant.domain || '',
      });
    } else {
      setFormData({
        name: '',
        displayName: '',
        domain: '',
      });
    }
  }, [tenant]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (!/^[a-z0-9-]+$/.test(formData.name)) {
      newErrors.name = 'Name must contain only lowercase letters, numbers, and hyphens';
    }

    if (!formData.displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    }

    if (formData.domain && !/^[a-z0-9.-]+$/.test(formData.domain)) {
      newErrors.domain = 'Domain must be a valid domain name';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof FormData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    const submitData: CreateTenantDto | UpdateTenantDto = {
      name: formData.name,
      displayName: formData.displayName,
      domain: formData.domain || undefined,
    };

    onSubmit(submitData);
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        {isEditMode ? 'Edit Tenant' : 'Create Tenant'}
      </Typography>

      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
        <TextField
          fullWidth
          label="Name"
          value={formData.name}
          onChange={handleChange('name')}
          error={!!errors.name}
          helperText={errors.name || 'Unique identifier (lowercase, numbers, hyphens only)'}
          disabled={loading || isEditMode}
          required
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="Display Name"
          value={formData.displayName}
          onChange={handleChange('displayName')}
          error={!!errors.displayName}
          helperText={errors.displayName || 'Human-readable name'}
          disabled={loading}
          required
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="Domain"
          value={formData.domain}
          onChange={handleChange('domain')}
          error={!!errors.domain}
          helperText={errors.domain || 'Optional domain for the tenant'}
          disabled={loading}
          sx={{ mb: 3 }}
        />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
            disabled={loading}
          >
            {isEditMode ? 'Update' : 'Create'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
