/**
 * Registration Type Details Page
 * 
 * Displays detailed information about a registration type
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  Typography,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { RegistrationType } from '../types/registration.types';

// Mock API hook - will be replaced with actual implementation
const useApi = () => ({
  execute: async ({ method, url }: { method: string; url: string }) => {
    console.log('API call:', method, url);
    return null;
  },
});

const RegistrationTypeDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();

  const [registrationType, setRegistrationType] = useState<RegistrationType | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadRegistrationType(id);
    }
  }, [id]);

  const loadRegistrationType = async (typeId: string) => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/registration-types/${typeId}`,
      });
      setRegistrationType(response);
    } catch (error) {
      console.error('Failed to load registration type:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/orgadmin/registrations/types/${id}/edit`);
  };

  const handleDelete = async () => {
    try {
      await execute({
        method: 'DELETE',
        url: `/api/orgadmin/registration-types/${id}`,
      });
      navigate('/orgadmin/registrations/types');
    } catch (error) {
      console.error('Failed to delete registration type:', error);
    }
  };

  const handleBack = () => {
    navigate('/orgadmin/registrations/types');
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading registration type...</Typography>
      </Box>
    );
  }

  if (!registrationType) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Registration type not found</Typography>
        <Button onClick={handleBack} sx={{ mt: 2 }}>
          Back to List
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={handleBack}>
            Back
          </Button>
          <Typography variant="h4">{registrationType.name}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={handleEdit}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Name
                  </Typography>
                  <Typography variant="body1">{registrationType.name}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Entity Name
                  </Typography>
                  <Chip label={registrationType.entityName} color="primary" />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body1">{registrationType.description}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Status
                  </Typography>
                  <Chip
                    label={registrationType.registrationStatus}
                    color={registrationType.registrationStatus === 'open' ? 'success' : 'default'}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Duration Settings */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Duration Settings
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Registration Type
                  </Typography>
                  <Typography variant="body1">
                    {registrationType.isRollingRegistration ? 'Rolling Registration' : 'Fixed-Period Registration'}
                  </Typography>
                </Grid>
                {registrationType.isRollingRegistration ? (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Duration
                    </Typography>
                    <Typography variant="body1">
                      {registrationType.numberOfMonths} months from payment date
                    </Typography>
                  </Grid>
                ) : (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Valid Until
                    </Typography>
                    <Typography variant="body1">
                      {registrationType.validUntil ? new Date(registrationType.validUntil).toLocaleDateString() : 'N/A'}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Approval Settings */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Approval Settings
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body1">
                {registrationType.automaticallyApprove
                  ? 'Applications are automatically approved and marked as Active'
                  : 'Applications require manual review and are marked as Pending'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Labels */}
        {registrationType.registrationLabels.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Registration Labels
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {registrationType.registrationLabels.map((label) => (
                    <Chip key={label} label={label} />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Payment Methods */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Payment Configuration
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Supported Payment Methods
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {registrationType.supportedPaymentMethods.map((method) => (
                  <Chip key={method} label={method} variant="outlined" />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Terms and Conditions */}
        {registrationType.useTermsAndConditions && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Terms and Conditions
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box
                  dangerouslySetInnerHTML={{ __html: registrationType.termsAndConditions || '' }}
                  sx={{ '& p': { mb: 1 } }}
                />
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Registration Type</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this registration type? This action cannot be undone.
            All associated registrations will remain but will no longer be linked to this type.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RegistrationTypeDetailsPage;
