/**
 * Membership Type Details Page
 * 
 * Displays all membership type attributes
 * Shows field configuration for group memberships
 * Shows person titles and labels for group memberships
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
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import type { MembershipType } from '../types/membership.types';

// Mock API hook - will be replaced with actual implementation
const useApi = () => ({
  execute: async ({ method, url }: { method: string; url: string }) => {
    console.log('API call:', method, url);
    return null;
  },
});

const MembershipTypeDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();

  const [membershipType, setMembershipType] = useState<MembershipType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadMembershipType(id);
    }
  }, [id]);

  const loadMembershipType = async (typeId: string) => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/membership-types/${typeId}`,
      });
      setMembershipType(response);
    } catch (error) {
      console.error('Failed to load membership type:', error);
      setError('Failed to load membership type');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/orgadmin/members/types/${id}/edit`);
  };

  const handleDelete = async () => {
    try {
      await execute({
        method: 'DELETE',
        url: `/api/orgadmin/membership-types/${id}`,
      });
      navigate('/orgadmin/members/types');
    } catch (error) {
      console.error('Failed to delete membership type:', error);
      setError('Failed to delete membership type');
    }
    setDeleteDialogOpen(false);
  };

  const handleBack = () => {
    navigate('/orgadmin/members/types');
  };

  const formatDate = (dateString: Date | string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading membership type...</Typography>
      </Box>
    );
  }

  if (error || !membershipType) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Membership type not found'}</Alert>
        <Button onClick={handleBack} sx={{ mt: 2 }}>
          Back to Membership Types
        </Button>
      </Box>
    );
  }

  const isGroupMembership = membershipType.membershipTypeCategory === 'group';

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={handleBack}>
            <BackIcon />
          </IconButton>
          <Typography variant="h4">{membershipType.name}</Typography>
          <Chip
            label={membershipType.membershipStatus}
            color={membershipType.membershipStatus === 'open' ? 'success' : 'default'}
          />
          <Chip
            label={isGroupMembership ? 'Group' : 'Single'}
            variant="outlined"
          />
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

      {/* Basic Information */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Basic Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body1">
                {membershipType.description}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Membership Form
              </Typography>
              <Typography variant="body1">
                {membershipType.membershipFormId}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Status
              </Typography>
              <Typography variant="body1">
                {membershipType.membershipStatus === 'open' ? 'Open (Accepting Applications)' : 'Closed (Not Accepting)'}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Group Configuration */}
      {isGroupMembership && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Group Configuration
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Maximum Number of People
                </Typography>
                <Typography variant="body1">
                  {membershipType.maxPeopleInApplication}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Minimum Number of People
                </Typography>
                <Typography variant="body1">
                  {membershipType.minPeopleInApplication}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Person Configuration */}
      {isGroupMembership && membershipType.personTitles && membershipType.personTitles.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Person Configuration
            </Typography>
            <Grid container spacing={2}>
              {membershipType.personTitles.map((title, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        Person {index + 1}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Title: {title || '(Not set)'}
                      </Typography>
                      {membershipType.personLabels && membershipType.personLabels[index] && (
                        <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {membershipType.personLabels[index].map((label) => (
                            <Chip key={label} label={label} size="small" />
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Field Configuration */}
      {isGroupMembership && membershipType.fieldConfiguration && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Field Configuration
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Field ID</TableCell>
                    <TableCell>Configuration</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(membershipType.fieldConfiguration).map(([fieldId, config]) => (
                    <TableRow key={fieldId}>
                      <TableCell>{fieldId}</TableCell>
                      <TableCell>
                        <Chip
                          label={config === 'common' ? 'Common to all' : 'Unique for each'}
                          size="small"
                          color={config === 'common' ? 'primary' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Membership Duration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Membership Duration
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Type
              </Typography>
              <Typography variant="body1">
                {membershipType.isRollingMembership ? 'Rolling Membership' : 'Fixed-Period Membership'}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                {membershipType.isRollingMembership ? 'Duration' : 'Valid Until'}
              </Typography>
              <Typography variant="body1">
                {membershipType.isRollingMembership
                  ? `${membershipType.numberOfMonths} months`
                  : membershipType.validUntil ? formatDate(membershipType.validUntil) : 'Not set'}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Application Settings */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Application Settings
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Automatic Approval
              </Typography>
              <Typography variant="body1">
                {membershipType.automaticallyApprove ? 'Yes (Auto-approve to Active)' : 'No (Manual approval required)'}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Member Labels
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                {membershipType.memberLabels.length > 0 ? (
                  membershipType.memberLabels.map((label) => (
                    <Chip key={label} label={label} size="small" />
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No labels configured
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Payment Settings */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Payment Settings
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Supported Payment Methods
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                {membershipType.supportedPaymentMethods.map((methodId) => (
                  <Chip key={methodId} label={methodId} size="small" />
                ))}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Terms and Conditions */}
      {membershipType.useTermsAndConditions && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Terms and Conditions
            </Typography>
            <Box
              sx={{ mt: 2 }}
              dangerouslySetInnerHTML={{ __html: membershipType.termsAndConditions || '' }}
            />
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Membership Type</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{membershipType.name}"? This action cannot be undone.
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

export default MembershipTypeDetailsPage;
