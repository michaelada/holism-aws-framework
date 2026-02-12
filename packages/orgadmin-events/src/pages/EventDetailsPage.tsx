/**
 * Event Details Page
 * 
 * Displays full details of an event including all activities
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
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  People as EntriesIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import type { Event, EventActivity } from '../types/event.types';

// Mock API hook - will be replaced with actual implementation
const useApi = () => ({
  execute: async () => {
    return null;
  },
});

const EventDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [activities, setActivities] = useState<EventActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadEvent(id);
      loadActivities(id);
    }
  }, [id]);

  const loadEvent = async (_eventId: string) => {
    try {
      setLoading(true);
      const response = await execute();
      setEvent(response);
    } catch (error) {
      console.error('Failed to load event:', error);
      setEvent(null);
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async (_eventId: string) => {
    try {
      const response = await execute();
      setActivities(response || []);
    } catch (error) {
      console.error('Failed to load activities:', error);
      setActivities([]);
    }
  };

  const handleEdit = () => {
    navigate(`/orgadmin/events/${id}/edit`);
  };

  const handleViewEntries = () => {
    navigate(`/orgadmin/events/${id}/entries`);
  };

  const handleDelete = async () => {
    try {
      await execute();
      navigate('/orgadmin/events');
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  const handleBack = () => {
    navigate('/orgadmin/events');
  };

  const formatDate = (dateString: Date | string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: Date | string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'success';
      case 'draft':
        return 'default';
      case 'cancelled':
        return 'error';
      case 'completed':
        return 'info';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading event...</Typography>
      </Box>
    );
  }

  if (!event) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Event not found</Typography>
        <Button onClick={handleBack} sx={{ mt: 2 }}>
          Back to Events
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
          <Typography variant="h4">{event.name}</Typography>
          <Chip
            label={event.status}
            color={getStatusColor(event.status)}
            size="small"
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<EntriesIcon />}
            onClick={handleViewEntries}
          >
            View Entries
          </Button>
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

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Event Details
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body2" color="textSecondary">
                Description
              </Typography>
              <Typography variant="body1">
                {event.description}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">
                Start Date
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {formatDate(event.startDate)}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">
                End Date
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {formatDate(event.endDate)}
              </Typography>
            </Grid>

            {event.openDateEntries && (
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="textSecondary">
                  Entries Open
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {formatDateTime(event.openDateEntries)}
                </Typography>
              </Grid>
            )}

            {event.entriesClosingDate && (
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="textSecondary">
                  Entries Close
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {formatDateTime(event.entriesClosingDate)}
                </Typography>
              </Grid>
            )}

            {event.limitEntries && event.entriesLimit && (
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="textSecondary">
                  Entry Limit
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {event.entriesLimit} entries maximum
                </Typography>
              </Grid>
            )}

            {event.emailNotifications && (
              <Grid item xs={12}>
                <Typography variant="body2" color="textSecondary">
                  Email Notifications
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {event.emailNotifications}
                </Typography>
              </Grid>
            )}

            {event.addConfirmationMessage && event.confirmationMessage && (
              <Grid item xs={12}>
                <Typography variant="body2" color="textSecondary">
                  Confirmation Email Message
                </Typography>
                <Typography variant="body1">
                  {event.confirmationMessage}
                </Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Event Activities
          </Typography>

          {activities.length === 0 ? (
            <Typography color="textSecondary">
              No activities configured for this event
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Activity Name</TableCell>
                    <TableCell>Fee</TableCell>
                    <TableCell>Payment Method</TableCell>
                    <TableCell>Visible</TableCell>
                    <TableCell>Applicant Limit</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>
                        <Typography variant="body1" fontWeight="medium">
                          {activity.name}
                        </Typography>
                        {activity.description && (
                          <Typography variant="body2" color="textSecondary">
                            {activity.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {activity.fee > 0 ? `£${activity.fee.toFixed(2)}` : 'Free'}
                      </TableCell>
                      <TableCell>
                        {activity.fee > 0 ? activity.allowedPaymentMethod : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={activity.showPublicly ? 'Yes' : 'No'}
                          color={activity.showPublicly ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {activity.limitApplicants && activity.applicantsLimit
                          ? `${activity.applicantsLimit} max`
                          : 'Unlimited'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Event</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this event? This action cannot be undone.
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

export default EventDetailsPage;
