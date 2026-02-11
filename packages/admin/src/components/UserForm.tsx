import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Paper,
  Typography,
  CircularProgress,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Chip,
  Autocomplete,
} from '@mui/material';
import { Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { User, CreateUserDto, UpdateUserDto, Tenant, Role } from '../types/admin.types';

interface UserFormProps {
  user?: User | null;
  tenants?: Tenant[];
  roles: Role[];
  loading: boolean;
  onSubmit: (data: CreateUserDto | UpdateUserDto) => void;
  onCancel: () => void;
  hideTenantSelection?: boolean;
}

interface FormData {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  temporaryPassword: boolean;
  emailVerified: boolean;
  phoneNumber: string;
  department: string;
  tenantId: string;
  roles: string[];
}

interface FormErrors {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  phoneNumber?: string;
}

export function UserForm({ user, tenants = [], roles, loading, onSubmit, onCancel, hideTenantSelection = false }: UserFormProps) {
  const isEditMode = !!user;

  const [formData, setFormData] = useState<FormData>({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    temporaryPassword: true,
    emailVerified: false,
    phoneNumber: '',
    department: '',
    tenantId: '',
    roles: [],
  });

  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        password: '',
        temporaryPassword: true,
        emailVerified: user.emailVerified,
        phoneNumber: user.phoneNumber || '',
        department: user.department || '',
        tenantId: user.tenants[0] || '',
        roles: user.roles || [],
      });
    } else {
      setFormData({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        password: '',
        temporaryPassword: true,
        emailVerified: false,
        phoneNumber: '',
        department: '',
        tenantId: '',
        roles: [],
      });
    }
  }, [user]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (!/^[a-zA-Z0-9._-]+$/.test(formData.username)) {
      newErrors.username = 'Username must contain only letters, numbers, dots, underscores, and hyphens';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email must be a valid email address';
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!isEditMode && !formData.password.trim()) {
      newErrors.password = 'Password is required for new users';
    } else if (formData.password && formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.phoneNumber && !/^[+]?[\d\s()-]+$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Phone number must be a valid format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof FormData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error for this field
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const handleRolesChange = (_event: any, newValue: string[]) => {
    setFormData((prev) => ({
      ...prev,
      roles: newValue,
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (isEditMode) {
      const submitData: UpdateUserDto = {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber || undefined,
        department: formData.department || undefined,
        tenantId: formData.tenantId || undefined,
        roles: formData.roles.length > 0 ? formData.roles : undefined,
      };
      onSubmit(submitData);
    } else {
      const submitData: CreateUserDto = {
        username: formData.username,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        password: formData.password || undefined,
        temporaryPassword: formData.temporaryPassword,
        emailVerified: formData.emailVerified,
        phoneNumber: formData.phoneNumber || undefined,
        department: formData.department || undefined,
        tenantId: formData.tenantId || undefined,
        roles: formData.roles.length > 0 ? formData.roles : undefined,
      };
      onSubmit(submitData);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        {isEditMode ? 'Edit User' : 'Create User'}
      </Typography>

      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
        <TextField
          fullWidth
          label="Username"
          value={formData.username}
          onChange={handleChange('username')}
          error={!!errors.username}
          helperText={errors.username || 'Unique username (letters, numbers, dots, underscores, hyphens)'}
          disabled={loading || isEditMode}
          required
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="Email"
          type="email"
          value={formData.email}
          onChange={handleChange('email')}
          error={!!errors.email}
          helperText={errors.email}
          disabled={loading}
          required
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            fullWidth
            label="First Name"
            value={formData.firstName}
            onChange={handleChange('firstName')}
            error={!!errors.firstName}
            helperText={errors.firstName}
            disabled={loading}
            required
          />

          <TextField
            fullWidth
            label="Last Name"
            value={formData.lastName}
            onChange={handleChange('lastName')}
            error={!!errors.lastName}
            helperText={errors.lastName}
            disabled={loading}
            required
          />
        </Box>

        {!isEditMode && (
          <>
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={formData.password}
              onChange={handleChange('password')}
              error={!!errors.password}
              helperText={errors.password || 'Minimum 8 characters'}
              disabled={loading}
              required
              sx={{ mb: 2 }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.temporaryPassword}
                  onChange={handleChange('temporaryPassword')}
                  disabled={loading}
                />
              }
              label="Require password change on first login"
              sx={{ mb: 2 }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.emailVerified}
                  onChange={handleChange('emailVerified')}
                  disabled={loading}
                />
              }
              label="Email verified"
              sx={{ mb: 2 }}
            />
          </>
        )}

        <TextField
          fullWidth
          label="Phone Number"
          value={formData.phoneNumber}
          onChange={handleChange('phoneNumber')}
          error={!!errors.phoneNumber}
          helperText={errors.phoneNumber || 'Optional'}
          disabled={loading}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="Department"
          value={formData.department}
          onChange={handleChange('department')}
          helperText="Optional"
          disabled={loading}
          sx={{ mb: 2 }}
        />

        {!hideTenantSelection && (
          <TextField
            fullWidth
            select
            label="Tenant"
            value={formData.tenantId}
            onChange={handleChange('tenantId')}
            helperText="Optional - assign user to a tenant"
            disabled={loading}
            sx={{ mb: 2 }}
          >
            <MenuItem value="">None</MenuItem>
            {tenants.map((tenant) => (
              <MenuItem key={tenant.id} value={tenant.id}>
                {tenant.displayName}
              </MenuItem>
            ))}
          </TextField>
        )}

        <Autocomplete
          multiple
          options={roles.map((role) => role.name)}
          value={formData.roles}
          onChange={handleRolesChange}
          disabled={loading}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Roles"
              helperText="Optional - assign roles to user"
            />
          )}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip label={option} {...getTagProps({ index })} />
            ))
          }
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
