import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Box,
  Typography,
} from '@mui/material';
import { VpnKey as VpnKeyIcon } from '@mui/icons-material';
import { User, ResetPasswordDto } from '../types/admin.types';

interface PasswordResetDialogProps {
  open: boolean;
  user: User | null;
  loading: boolean;
  onSubmit: (data: ResetPasswordDto) => void;
  onCancel: () => void;
}

interface FormData {
  password: string;
  confirmPassword: string;
  temporary: boolean;
}

interface FormErrors {
  password?: string;
  confirmPassword?: string;
}

export function PasswordResetDialog({
  open,
  user,
  loading,
  onSubmit,
  onCancel,
}: PasswordResetDialogProps) {
  const [formData, setFormData] = useState<FormData>({
    password: '',
    confirmPassword: '',
    temporary: true,
  });

  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      // Reset form when dialog opens
      setFormData({
        password: '',
        confirmPassword: '',
        temporary: true,
      });
      setErrors({});
    }
  }, [open]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm the password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    const submitData: ResetPasswordDto = {
      password: formData.password,
      temporary: formData.temporary,
    };

    onSubmit(submitData);
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="password-reset-dialog-title"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="password-reset-dialog-title">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <VpnKeyIcon />
          Reset Password
        </Box>
      </DialogTitle>

      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent>
          {user && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Resetting password for user: <strong>{user.username}</strong> ({user.email})
            </Typography>
          )}

          <TextField
            fullWidth
            label="New Password"
            type="password"
            value={formData.password}
            onChange={handleChange('password')}
            error={!!errors.password}
            helperText={errors.password || 'Minimum 8 characters'}
            disabled={loading}
            required
            autoFocus
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Confirm Password"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange('confirmPassword')}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword}
            disabled={loading}
            required
            sx={{ mb: 2 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={formData.temporary}
                onChange={handleChange('temporary')}
                disabled={loading}
              />
            }
            label="Require password change on next login"
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            startIcon={loading ? <CircularProgress size={20} /> : <VpnKeyIcon />}
            disabled={loading}
          >
            Reset Password
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
