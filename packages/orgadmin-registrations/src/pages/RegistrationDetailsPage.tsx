/**
 * Registration Details Page
 * 
 * Displays detailed information about a single registration
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Autocomplete,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
  CheckCircle as ProcessedIcon,
  RadioButtonUnchecked as UnprocessedIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { Registration } from '../types/registration.types';

// Mock API hook
const useApi = () => ({
  execute: async ({ method, url }: { method: string; url: string }) => {
    return null;
  },
});

const RegistrationDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();

  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingLabels, setEditingLabels] = useState(false);
  const [newStatus, setNewStatus] = useState<'active' | 'pending' | 'elapsed'>('active');
  const [newLabels, setNewLabels] = useState<string[]>([]);
  const [availableLabels] = useState<string[]>(['VIP', 'Verified', 'Renewal', 'New']);

  useEffect(() => {
    if (id) {
      loadRegistration(id);
    }
  }, [id]);

  const loadRegistration = async (registrationId: string) => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/registrations/${registrationId}`,
      });
      setRegistration(response);
      if (response) {
        setNewStatus(response.status);
        setNewLabels(response.labels);
      }
    } catch (error) {
      console.error('Failed to load registration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/registrations');
  };

  const handleEdit = () => {
    navigate(`/orgadmin/registrations/${id}/edit`);
  };

  const handleToggleProcessed = async () => {
    if (!registration) return;
    try {
      await execute({
        method: 'PATCH',
        url: `/api/orgadmin/registrations/${id}`,
      });
      loadRegistration(id!);
    } catch (error) {
      console.error('Failed to update processed status:', error);
    }
  };

  const handleSaveStatus = async () => {
    try {
      await execute({
        method: 'PATCH',
        url: `/api/orgadmin/registrations/${id}`,
      });
      setEditingStatus(false);
      loadRegistration(id!);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleSaveLabels = async () => {
    try {
      await execute({
        method: 'PATCH',
        url: `/api/orgadmin/registrations/${id}`,
      });
      setEditingLabels(false);
      loadRegistration(id!);
    } catch (error) {
      console.error('Failed to update labels:', error);
    }
  };

  const handleDownloadFile = (fileUrl: string) => {
    window.open(fileUrl, '_blank');
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading registration...</Typography>
      </Box>
    );
  }

  if (!registration) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Registration not found</Typography>
        <Button onClick={handleBack} sx={{ mt: 2 }}>
          Back to Database
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
          <Typography variant="h4">Registration Details</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            onClick={handleToggleProcessed}
            title={registration.processed ? 'Mark Unprocessed' : 'Mark Processed'}
          >
            {registration.processed ? <ProcessedIcon color="success" /> : <UnprocessedIcon />}
          </IconButton>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={handleEdit}
          >
            Edit
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
                    Registration Number
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {registration.registrationNumber}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Entity Name
                  </Typography>
                  <Chip label={registration.entityName} color="primary" />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Owner Name
                  </Typography>
                  <Typography variant="body1">{registration.ownerName}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Registration Type
                  </Typography>
                  <Typography variant="body1">
                    {/* Would show registration type name from join */}
                    Registration Type
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Status and Dates */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Status and Dates
                </Typography>
                {!editingStatus && (
                  <Button size="small" onClick={() => setEditingStatus(true)}>
                    Change Status
                  </Button>
                )}
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Status
                  </Typography>
                  {editingStatus ? (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <FormControl size="small" sx={{ minWidth: 150 }}>
                        <Select
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value as any)}
                        >
                          <MenuItem value="pending">Pending</MenuItem>
                          <MenuItem value="active">Active</MenuItem>
                          <MenuItem value="elapsed">Elapsed</MenuItem>
                        </Select>
                      </FormControl>
                      <IconButton size="small" onClick={handleSaveStatus}>
                        <SaveIcon />
                      </IconButton>
                    </Box>
                  ) : (
                    <Chip
                      label={registration.status}
                      color={
                        registration.status === 'active' ? 'success' :
                        registration.status === 'pending' ? 'warning' : 'default'
                      }
                    />
                  )}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Date Last Renewed
                  </Typography>
                  <Typography variant="body1">
                    {new Date(registration.dateLastRenewed).toLocaleDateString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Valid Until
                  </Typography>
                  <Typography variant="body1">
                    {new Date(registration.validUntil).toLocaleDateString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Processed Status
                  </Typography>
                  <Chip
                    label={registration.processed ? 'Processed' : 'Unprocessed'}
                    color={registration.processed ? 'success' : 'default'}
                    size="small"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Labels */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Labels
                </Typography>
                {!editingLabels && (
                  <Button size="small" onClick={() => setEditingLabels(true)}>
                    Manage Labels
                  </Button>
                )}
              </Box>
              <Divider sx={{ mb: 2 }} />
              {editingLabels ? (
                <Box>
                  <Autocomplete
                    multiple
                    options={availableLabels}
                    value={newLabels}
                    onChange={(e, value) => setNewLabels(value)}
                    renderInput={(params) => (
                      <TextField {...params} label="Labels" placeholder="Add labels" />
                    )}
                    sx={{ mb: 2 }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveLabels}
                  >
                    Save Labels
                  </Button>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {registration.labels.length > 0 ? (
                    registration.labels.map((label) => (
                      <Chip key={label} label={label} />
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No labels assigned
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Payment Information */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Payment Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Payment Status
                  </Typography>
                  <Chip
                    label={registration.paymentStatus}
                    color={registration.paymentStatus === 'paid' ? 'success' : 'warning'}
                  />
                </Grid>
                {registration.paymentMethod && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Payment Method
                    </Typography>
                    <Typography variant="body1">{registration.paymentMethod}</Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Form Submission Data */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Registration Form Data
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Form submission data would be displayed here based on the application form fields.
                This includes all custom fields defined in the registration form.
              </Typography>
              {/* Uploaded files section */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Uploaded Files
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                  {/* Mock file display - would be populated from form_submission_files */}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleDownloadFile('#')}
                  >
                    Download Document.pdf
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default RegistrationDetailsPage;
