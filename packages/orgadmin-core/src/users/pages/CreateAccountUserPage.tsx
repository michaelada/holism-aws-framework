/**
 * Create Account User Page
 * 
 * Dedicated page for creating account users in the organization
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
  Paper,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  PersonAdd as CreateIcon,
} from '@mui/icons-material';
import { useApi } from '../../hooks/useApi';

const CreateAccountUserPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!email || !firstName || !lastName) {
      setError('Please fill in all required fields');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await execute({
        method: 'POST',
        url: '/api/orgadmin/users/accounts',
        data: {
          email,
          firstName,
          lastName,
          phone,
        },
      });

      setSuccess(true);
      
      // Redirect after short delay
      setTimeout(() => {
        navigate('/users/accounts');
      }, 2000);
    } catch (error: any) {
      console.error('Failed to create account user:', error);
      setError(error.response?.data?.message || 'Failed to create account user');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/users/accounts');
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/users/accounts')}
          sx={{ textDecoration: 'none', cursor: 'pointer' }}
        >
          User Management
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/users/accounts')}
          sx={{ textDecoration: 'none', cursor: 'pointer' }}
        >
          Account Users
        </Link>
        <Typography color="text.primary">Create Account User</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<BackIcon />}
          onClick={handleCancel}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Typography variant="h4">Create Account User</Typography>
      </Box>

      {/* Success Message */}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Account user created successfully! Redirecting...
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Form */}
      <Paper sx={{ maxWidth: 800 }}>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="body2" color="textSecondary" paragraph>
              Create a new account user who can enter events, purchase merchandise, make bookings,
              and register for programmes. They will receive an email with instructions to set up
              their account.
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  required
                  autoFocus
                  helperText="The user will receive account setup instructions at this email"
                  disabled={loading || success}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  fullWidth
                  required
                  disabled={loading || success}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  fullWidth
                  required
                  disabled={loading || success}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Phone Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  fullWidth
                  helperText="Optional - can be used for notifications and contact"
                  disabled={loading || success}
                />
              </Grid>
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
              disabled={loading || success}
              size="large"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading || success}
              startIcon={<CreateIcon />}
              size="large"
            >
              {loading ? 'Creating User...' : 'Create User'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default CreateAccountUserPage;
