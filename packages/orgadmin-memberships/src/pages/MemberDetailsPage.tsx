/**
 * Member Details Page
 * 
 * Display all member information from application form
 * Show membership type, number, status, dates
 * Display payment status and method
 * Show uploaded files with download links
 * Status change controls and label management
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Typography,
  Alert,
  FormControlLabel,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import type { Member } from '../types/membership.types';

// Mock API hook
const useApi = () => ({
  execute: async ({ method, url }: { method: string; url: string }) => {
    return null;
  },
});

const MemberDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();

  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadMember(id);
    }
  }, [id]);

  const loadMember = async (memberId: string) => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/members/${memberId}`,
      });
      setMember(response);
    } catch (error) {
      console.error('Failed to load member:', error);
      setError('Failed to load member');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!member) return;
    try {
      await execute({
        method: 'PATCH',
        url: `/api/orgadmin/members/${member.id}`,
      });
      setMember({ ...member, status: newStatus as any });
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleProcessedToggle = async () => {
    if (!member) return;
    try {
      await execute({
        method: 'PATCH',
        url: `/api/orgadmin/members/${member.id}`,
      });
      setMember({ ...member, processed: !member.processed });
    } catch (error) {
      console.error('Failed to toggle processed status:', error);
    }
  };

  const handleBack = () => {
    navigate('/members');
  };

  const handleEdit = () => {
    navigate(`/orgadmin/members/${id}/edit`);
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
        <Typography>Loading member...</Typography>
      </Box>
    );
  }

  if (error || !member) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Member not found'}</Alert>
        <Button onClick={handleBack} sx={{ mt: 2 }}>
          Back to Members
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={handleBack}>
            <BackIcon />
          </IconButton>
          <Typography variant="h4">
            {member.firstName} {member.lastName}
          </Typography>
          <Chip label={member.status} color={member.status === 'active' ? 'success' : 'default'} />
        </Box>
        <Button variant="outlined" startIcon={<EditIcon />} onClick={handleEdit}>
          Edit
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Membership Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Membership Number
                  </Typography>
                  <Typography variant="body1">{member.membershipNumber}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Membership Type
                  </Typography>
                  <Typography variant="body1">{member.membershipTypeId}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Date Last Renewed
                  </Typography>
                  <Typography variant="body1">{formatDate(member.dateLastRenewed)}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Valid Until
                  </Typography>
                  <Typography variant="body1">{formatDate(member.validUntil)}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Status Management
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={member.status}
                      label="Status"
                      onChange={(e) => handleStatusChange(e.target.value)}
                    >
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="elapsed">Elapsed</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={member.processed}
                        onChange={handleProcessedToggle}
                      />
                    }
                    label="Processed"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Labels
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {member.labels.length > 0 ? (
                  member.labels.map((label) => (
                    <Chip key={label} label={label} />
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No labels assigned
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Payment Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Payment Status
                  </Typography>
                  <Chip
                    label={member.paymentStatus}
                    color={member.paymentStatus === 'paid' ? 'success' : 'default'}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Payment Method
                  </Typography>
                  <Typography variant="body1">{member.paymentMethod || 'Not specified'}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MemberDetailsPage;
