/**
 * Event Details Page
 * 
 * Displays detailed information about a specific event
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Edit as EditIcon,
  ArrowBack as BackIcon,
  People as EntriesIcon,
} from '@mui/icons-material';
import { useTranslation, useLocale, formatCurrency } from '@aws-web-framework/orgadmin-shell';
import { formatDate } from '@aws-web-framework/orgadmin-shell';
import { useApi, useOrganisation } from '@aws-web-framework/orgadmin-core';
import type { Event, EventActivity } from '../types/event.types';
import type { Discount } from '../types/discount.types';
import { useDiscountService } from '../hooks/useDiscountService';

const EventDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { organisation } = useOrganisation();
  const discountService = useDiscountService();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [activities, setActivities] = useState<EventActivity[]>([]);
  const [eventDiscounts, setEventDiscounts] = useState<Discount[]>([]);
  const [activityDiscounts, setActivityDiscounts] = useState<Map<string, Discount[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadEvent(id);
    }
  }, [id]);

  const loadEvent = async (eventId: string) => {
    try {
      setLoading(true);
      
      // Load event details
      const eventResponse = await execute({
        method: 'GET',
        url: `/api/orgadmin/events/${eventId}`,
      });
      setEvent(eventResponse);

      // Load event activities
      const activitiesResponse = await execute({
        method: 'GET',
        url: `/api/orgadmin/events/${eventId}/activities`,
      });
      setActivities(activitiesResponse || []);

      // Load discounts for the event
      try {
        const eventDiscountsData = await discountService.getDiscountsForTarget('event', eventId);
        setEventDiscounts(eventDiscountsData);
      } catch (discountError) {
        console.error('Failed to load event discounts:', discountError);
        // Don't fail the whole page if discounts fail to load
      }

      // Load discounts for each activity
      if (activitiesResponse && activitiesResponse.length > 0) {
        const activityDiscountsMap = new Map<string, Discount[]>();
        
        await Promise.all(
          activitiesResponse.map(async (activity: EventActivity) => {
            try {
              const activityDiscountsData = await discountService.getDiscountsForTarget(
                'event_activity',
                activity.id
              );
              if (activityDiscountsData.length > 0) {
                activityDiscountsMap.set(activity.id, activityDiscountsData);
              }
            } catch (discountError) {
              console.error(`Failed to load discounts for activity ${activity.id}:`, discountError);
              // Continue loading other activities' discounts
            }
          })
        );
        
        setActivityDiscounts(activityDiscountsMap);
      }
    } catch (error) {
      console.error('Failed to load event:', error);
      setError('Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const formatDateLocale = (dateString: Date | string) => {
    return formatDate(dateString, 'dd MMM yyyy HH:mm', locale);
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !event) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Event not found'}</Alert>
        <Button
          variant="outlined"
          startIcon={<BackIcon />}
          onClick={() => navigate('/events')}
          sx={{ mt: 2 }}
        >
          {t('common.actions.back')}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{event.name}</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<EntriesIcon />}
            onClick={() => navigate(`/events/${id}/entries`)}
          >
            View Entries
          </Button>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/events/${id}/edit`)}
          >
            {t('common.actions.edit')}
          </Button>
        </Box>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="textSecondary">
                Status
              </Typography>
              <Chip
                label={t(`common.status.${event.status}`)}
                color={getStatusColor(event.status)}
                size="small"
                sx={{ mt: 1 }}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" color="textSecondary">
                Description
              </Typography>
              <Typography variant="body1" sx={{ mt: 1 }}>
                {event.description}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="textSecondary">
                Event Start Date
              </Typography>
              <Typography variant="body1" sx={{ mt: 1 }}>
                {formatDateLocale(event.startDate)}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="textSecondary">
                Event End Date
              </Typography>
              <Typography variant="body1" sx={{ mt: 1 }}>
                {formatDateLocale(event.endDate)}
              </Typography>
            </Grid>

            {event.openDateEntries && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Entries Open
                </Typography>
                <Typography variant="body1" sx={{ mt: 1 }}>
                  {formatDateLocale(event.openDateEntries)}
                </Typography>
              </Grid>
            )}

            {event.entriesClosingDate && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Entries Close
                </Typography>
                <Typography variant="body1" sx={{ mt: 1 }}>
                  {formatDateLocale(event.entriesClosingDate)}
                </Typography>
              </Grid>
            )}

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="textSecondary">
                Entry Limit
              </Typography>
              <Typography variant="body1" sx={{ mt: 1 }}>
                {event.limitEntries && event.entriesLimit
                  ? `${event.entriesLimit} ${t('common.labels.max')}`
                  : t('common.labels.unlimited')}
              </Typography>
            </Grid>

            {event.emailNotifications && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">
                  Email Notifications
                </Typography>
                <Typography variant="body1" sx={{ mt: 1 }}>
                  {event.emailNotifications}
                </Typography>
              </Grid>
            )}

            {event.addConfirmationMessage && event.confirmationMessage && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">
                  Confirmation Message
                </Typography>
                <Typography variant="body1" sx={{ mt: 1 }}>
                  {event.confirmationMessage}
                </Typography>
              </Grid>
            )}

            {/* Event Discounts */}
            {eventDiscounts.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 2 }}>
                  Applied Discounts
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {eventDiscounts.map((discount) => (
                    <Chip
                      key={discount.id}
                      label={`${discount.name} (${
                        discount.discountType === 'percentage'
                          ? `${discount.discountValue}%`
                          : formatCurrency(discount.discountValue, organisation?.currency || 'EUR', locale)
                      })`}
                      color="success"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Activities Section */}
      {activities.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Activities
            </Typography>
            {activities.map((activity, index) => (
              <Box key={activity.id} sx={{ mb: index < activities.length - 1 ? 3 : 0 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" fontWeight="medium">
                      {activity.name}
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">
                      {activity.description}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Fee
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 0.5 }}>
                      {activity.fee > 0 ? formatCurrency(activity.fee, organisation?.currency || 'EUR', locale) : 'Free'}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Visibility
                    </Typography>
                    <Chip
                      label={activity.showPublicly ? 'Public' : 'Private'}
                      color={activity.showPublicly ? 'success' : 'default'}
                      size="small"
                      sx={{ mt: 0.5 }}
                    />
                  </Grid>

                  {activity.limitApplicants && activity.applicantsLimit && (
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="textSecondary">
                        Applicant Limit
                      </Typography>
                      <Typography variant="body1" sx={{ mt: 0.5 }}>
                        {activity.applicantsLimit}
                      </Typography>
                    </Grid>
                  )}

                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Payment Methods
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 0.5 }}>
                      {activity.allowedPaymentMethod === 'both'
                        ? 'Card & Cheque'
                        : activity.allowedPaymentMethod === 'card'
                        ? 'Card Only'
                        : 'Cheque Only'}
                    </Typography>
                  </Grid>

                  {/* Activity Discounts */}
                  {activityDiscounts.has(activity.id) && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>
                        Applied Discounts
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {activityDiscounts.get(activity.id)!.map((discount) => (
                          <Chip
                            key={discount.id}
                            label={`${discount.name} (${
                              discount.discountType === 'percentage'
                                ? `${discount.discountValue}%`
                                : formatCurrency(discount.discountValue, organisation?.currency || 'EUR', locale)
                            })`}
                            color="success"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Grid>
                  )}
                </Grid>
                {index < activities.length - 1 && <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 3 }} />}
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      <Button
        variant="outlined"
        startIcon={<BackIcon />}
        onClick={() => navigate('/events')}
      >
        {t('common.actions.back')}
      </Button>
    </Box>
  );
};

export default EventDetailsPage;
