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
import { useOrganisation } from '../../context/OrganisationContext';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import { usePageHelp } from '@aws-web-framework/orgadmin-shell';

const CreateAccountUserPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Register page for contextual help
  usePageHelp('create');

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
        // The organisation is a path segment, not inferred from the token.
        url: `/api/orgadmin/users/accounts/${organisation?.id}`,
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
          sx={{ textDecoration: 'none', cursor: 'pointer' }}        >
          {t('users.title')}
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/users/accounts')}
          sx={{ textDecoration: 'none', cursor: 'pointer' }}        >
          {t('users.tabs.accounts')}
        </Link>
        <Typography color="text.primary">{t('users.accounts.create')}</Typography>
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
        <Typography variant="h4">{t('users.accounts.create')}</Typography>
      </Box>

      {/* Success Message */}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>{t('users.accounts.createSuccess')}</Alert>
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
                  label={t('users.fields.emailAddress')}
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
                  label={t('users.fields.firstName')}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  fullWidth
                  required
                  disabled={loading || success}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('users.fields.lastName')}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  fullWidth
                  required
                  disabled={loading || success}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label={t('users.fields.phoneNumber')}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  fullWidth
                  helperText={t('users.accounts.phoneHelper')}
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
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading || success}
              startIcon={<CreateIcon />}
              size="large"
            >
              {loading ? t('users.actions.creatingUser') : t('users.actions.createUser')}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default CreateAccountUserPage;
