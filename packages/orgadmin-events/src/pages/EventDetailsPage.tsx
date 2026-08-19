/**
 * Event Details Page
 * 
 * Displays detailed information about a specific event in collapsible sections.
 * Shows all event fields including basic info, dates, ticketing, and activities.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Grid,
  Typography,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Edit as EditIcon,
  ArrowBack as BackIcon,
  People as EntriesIcon,
} from '@mui/icons-material';
import { useTranslation, useLocale, formatCurrency } from '@aws-web-framework/orgadmin-shell';
import { formatDate } from '@aws-web-framework/orgadmin-shell';
import { useApi, useOrganisation } from '@aws-web-framework/orgadmin-core';
import CollapsibleSection from '../components/CollapsibleSection';
import type { Event, EventActivity } from '../types/event.types';
import type { Discount } from '../types/discount.types';
import { useDiscountService } from '../hooks/useDiscountService';

/** Helper to render a label/value pair */
const DetailField: React.FC<{ label: string; value?: React.ReactNode; show?: boolean }> = ({
  label,
  value,
  show = true,
}) => {
  if (!show || value === undefined || value === null || value === '') return null;
  return (
    <Grid item xs={12} md={6}>
      <Typography variant="subtitle2" color="textSecondary">
        {label}
      </Typography>
      <Typography variant="body1" sx={{ mt: 0.5 }}>
        {value}
      </Typography>
    </Grid>
  );
};

const DetailFieldFull: React.FC<{ label: string; value?: React.ReactNode; show?: boolean }> = ({
  label,
  value,
  show = true,
}) => {
  if (!show || value === undefined || value === null || value === '') return null;
  return (
    <Grid item xs={12}>
      <Typography variant="subtitle2" color="textSecondary">
        {label}
      </Typography>
      <Typography variant="body1" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
        {value}
      </Typography>
    </Grid>
  );
};

/** Renders HTML content (from rich text editors like ReactQuill) safely */
const HtmlField: React.FC<{ label: string; html?: string; show?: boolean }> = ({
  label,
  html,
  show = true,
}) => {
  if (!show || !html) return null;
  return (
    <Grid item xs={12}>
      <Typography variant="subtitle2" color="textSecondary">
        {label}
      </Typography>
      <Box
        sx={{
          mt: 0.5,
          '& p': { mb: 1, mt: 0 },
          '& ul, & ol': { pl: 3, mb: 1 },
          '& li': { mb: 0.25 },
          '& h1, & h2, & h3': { mt: 1.5, mb: 0.5 },
          '& a': { color: 'primary.main' },
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Grid>
  );
};

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
  const [paymentMethodMap, setPaymentMethodMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'basic-info': true,
    'event-dates': true,
    'ticketing': true,
    'activities': true,
  });

  const handleToggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }, []);

  useEffect(() => {
    if (id) {
      loadEvent(id);
    }
  }, [id]);

  const loadEvent = async (eventId: string) => {
    try {
      setLoading(true);
      const eventResponse = await execute({ method: 'GET', url: `/api/orgadmin/events/${eventId}` });
      setEvent(eventResponse);

      const activitiesResponse = await execute({ method: 'GET', url: `/api/orgadmin/events/${eventId}/activities` });
      setActivities(activitiesResponse || []);

      // Load event-level discounts from discountIds on the event
      const discountIds: string[] = eventResponse.discountIds || [];
      if (discountIds.length > 0) {
        const loaded: Discount[] = [];
        await Promise.all(
          discountIds.map(async (dId: string) => {
            try {
              const d = await execute({
                method: 'GET',
                url: `/api/orgadmin/discounts/${dId}?organisationId=${organisation?.id}`,
              });
              if (d) loaded.push(d);
            } catch { /* skip individual failures */ }
          }),
        );
        setEventDiscounts(loaded);
      }

      // Load activity-level discounts from discountIds on each activity
      if (activitiesResponse?.length > 0) {
        const map = new Map<string, Discount[]>();
        await Promise.all(
          activitiesResponse.map(async (activity: EventActivity) => {
            const actDiscountIds: string[] = (activity as any).discountIds || [];
            if (actDiscountIds.length === 0) return;
            const actLoaded: Discount[] = [];
            await Promise.all(
              actDiscountIds.map(async (dId: string) => {
                try {
                  const d = await execute({
                    method: 'GET',
                    url: `/api/orgadmin/discounts/${dId}?organisationId=${organisation?.id}`,
                  });
                  if (d) actLoaded.push(d);
                } catch { /* skip */ }
              }),
            );
            if (actLoaded.length > 0) map.set(activity.id, actLoaded);
          }),
        );
        setActivityDiscounts(map);
      }

      // Also try the target-based lookup as a fallback
      if (discountIds.length === 0) {
        try {
          const eventDiscountsData = await discountService.getDiscountsForTarget('event', eventId);
          setEventDiscounts(eventDiscountsData);
        } catch { /* ignore */ }
      }

      // Load payment methods for name resolution
      try {
        const pmResponse = await execute({ method: 'GET', url: '/api/orgadmin/payment-methods' });
        const pmArray = Array.isArray(pmResponse) ? pmResponse : [
          { id: 'pay-offline', name: 'Pay Offline' },
          { id: 'stripe', name: 'Card Payment (Stripe)' },
        ];
        const map2: Record<string, string> = {};
        pmArray.forEach((pm: { id: string; name: string }) => { map2[pm.id] = pm.name; });
        setPaymentMethodMap(map2);
      } catch { /* use empty map */ }
    } catch {
      setError('Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (dateString: Date | string) => formatDate(dateString, 'dd MMM yyyy HH:mm', locale);
  const fmtDate = (dateString: Date | string) => formatDate(dateString, 'dd MMM yyyy', locale);
  const cur = (amount: number) => formatCurrency(amount, organisation?.currency || 'EUR', locale);

  const getStatusColor = (status: string): 'success' | 'default' | 'error' | 'info' => {
    switch (status) {
      case 'published': return 'success';
      case 'draft': return 'default';
      case 'cancelled': return 'error';
      case 'completed': return 'info';
      default: return 'default';
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
        <Button variant="outlined" startIcon={<BackIcon />} onClick={() => navigate('/events')} sx={{ mt: 2 }}>
          {t('common.actions.back')}
        </Button>
      </Box>
    );
  }

  const ev = event as any; // allow access to joined fields like eventType, venue, ticketing fields

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3,
        // Wraps rather than overflowing: a non-wrapping header row pushed
        // page actions past the right edge of a phone, with nothing on
        // screen to show the page had scrolled.
        flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4">{event.name}</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<EntriesIcon />} onClick={() => navigate(`/events/${id}/entries`)}>
            View Entries
          </Button>
          <Button variant="contained" startIcon={<EditIcon />} onClick={() => navigate(`/events/${id}/edit`)}>
            {t('common.actions.edit')}
          </Button>
        </Box>
      </Box>

      {/* Basic Information */}
      <Box sx={{ mb: 3 }}>
        <CollapsibleSection
          id="basic-info"
          title="Basic Information"
          expanded={expandedSections['basic-info'] ?? true}
          onToggle={() => handleToggleSection('basic-info')}
        >
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="textSecondary">Status</Typography>
              <Chip
                label={t(`common.status.${event.status}`)}
                color={getStatusColor(event.status)}
                size="small"
                sx={{ mt: 0.5 }}
              />
            </Grid>

            <DetailField label="Event Name" value={event.name} />
            <DetailFieldFull label="Description" value={event.description} />
            <DetailField label="Email Notifications" value={event.emailNotifications} />
            <DetailField
              label="Entry Limit"
              value={
                event.limitEntries && event.entriesLimit
                  ? `${event.entriesLimit} max`
                  : 'Unlimited'
              }
            />
            <DetailFieldFull
              label="Confirmation Message"
              value={event.confirmationMessage}
              show={event.addConfirmationMessage && !!event.confirmationMessage}
            />
            <DetailField label="Event Type" value={ev.eventType?.name} show={!!ev.eventType} />
            <DetailField label="Venue" value={ev.venue?.name} show={!!ev.venue} />
            <DetailField
              label="Venue Address"
              value={ev.venue?.address}
              show={!!ev.venue?.address}
            />

            {/* Event Discounts */}
            {eventDiscounts.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>
                  Applied Discounts
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {eventDiscounts.map((discount) => (
                    <Chip
                      key={discount.id}
                      label={`${discount.name} (${
                        discount.discountType === 'percentage'
                          ? `${discount.discountValue}%`
                          : cur(discount.discountValue)
                      })`}
                      color="success"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Grid>
            )}

            <DetailField label="Created" value={ev.createdAt ? fmtDate(ev.createdAt) : undefined} />
            <DetailField label="Last Updated" value={ev.updatedAt ? fmtDate(ev.updatedAt) : undefined} />
          </Grid>
        </CollapsibleSection>
      </Box>

      {/* Event Dates */}
      <Box sx={{ mb: 3 }}>
        <CollapsibleSection
          id="event-dates"
          title="Event Dates"
          expanded={expandedSections['event-dates'] ?? true}
          onToggle={() => handleToggleSection('event-dates')}
        >
          <Grid container spacing={2}>
            <DetailField label="Event Start Date" value={fmt(event.startDate)} />
            <DetailField label="Event End Date" value={fmt(event.endDate)} />
            <DetailField
              label="Entries Open"
              value={event.openDateEntries ? fmt(event.openDateEntries) : undefined}
            />
            <DetailField
              label="Entries Close"
              value={event.entriesClosingDate ? fmt(event.entriesClosingDate) : undefined}
            />
          </Grid>
        </CollapsibleSection>
      </Box>

      {/* Ticketing Settings */}
      <Box sx={{ mb: 3 }}>
        <CollapsibleSection
          id="ticketing"
          title="Ticketing Settings"
          expanded={expandedSections['ticketing'] ?? true}
          onToggle={() => handleToggleSection('ticketing')}
        >
          <Grid container spacing={2}>
            <DetailField
              label="Generate Electronic Tickets"
              value={ev.generateElectronicTickets ? 'Yes' : 'No'}
            />
            {ev.generateElectronicTickets && (
              <>
                <DetailFieldFull label="Ticket Header Text" value={ev.ticketHeaderText} show={!!ev.ticketHeaderText} />
                <DetailFieldFull label="Ticket Instructions" value={ev.ticketInstructions} show={!!ev.ticketInstructions} />
                <DetailFieldFull label="Ticket Footer Text" value={ev.ticketFooterText} show={!!ev.ticketFooterText} />
                <DetailField
                  label="Ticket Validity Period"
                  value={ev.ticketValidityPeriod ? `${ev.ticketValidityPeriod} hours` : undefined}
                  show={!!ev.ticketValidityPeriod}
                />
                <DetailField
                  label="Ticket Background Color"
                  value={
                    ev.ticketBackgroundColor ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 24, height: 24, borderRadius: 1, border: '1px solid #ccc', bgcolor: ev.ticketBackgroundColor }} />
                        {ev.ticketBackgroundColor}
                      </Box>
                    ) : undefined
                  }
                  show={!!ev.ticketBackgroundColor}
                />
                <DetailField
                  label="Include Event Logo"
                  value={ev.includeEventLogo ? 'Yes' : 'No'}
                />
              </>
            )}
          </Grid>
        </CollapsibleSection>
      </Box>

      {/* Activities */}
      {activities.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <CollapsibleSection
            id="activities"
            title={`Activities (${activities.length})`}
            expanded={expandedSections['activities'] ?? true}
            onToggle={() => handleToggleSection('activities')}
          >
            {activities.map((activity, index) => (
              <Box key={activity.id}>
                {index > 0 && <Divider sx={{ my: 3 }} />}
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                  {activity.name}
                </Typography>
                <Grid container spacing={2}>
                  <DetailFieldFull label="Description" value={activity.description} />
                  <DetailField
                    label="Fee"
                    value={activity.fee > 0 ? cur(activity.fee) : 'Free'}
                  />
                  <DetailField
                    label="Visibility"
                    value={
                      <Chip
                        label={activity.showPublicly ? 'Public' : 'Private'}
                        color={activity.showPublicly ? 'success' : 'default'}
                        size="small"
                      />
                    }
                  />
                  <DetailField
                    label="Applicant Limit"
                    value={
                      activity.limitApplicants && activity.applicantsLimit
                        ? `${activity.applicantsLimit} max`
                        : 'Unlimited'
                    }
                  />
                  <DetailField
                    label="Allow Specify Quantity"
                    value={activity.allowSpecifyQuantity ? 'Yes' : 'No'}
                  />
                  <DetailField
                    label="Handling Fee Included"
                    value={activity.handlingFeeIncluded ? 'Yes' : 'No'}
                    show={activity.fee > 0}
                  />
                  <DetailField
                    label="Terms and Conditions"
                    value={activity.useTermsAndConditions ? 'Yes' : 'No'}
                  />
                  <HtmlField
                    label="Terms and Conditions Text"
                    html={activity.termsAndConditions}
                    show={activity.useTermsAndConditions && !!activity.termsAndConditions}
                  />
                  <DetailFieldFull
                    label="Cheque Payment Instructions"
                    value={activity.chequePaymentInstructions}
                    show={!!activity.chequePaymentInstructions}
                  />
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Payment Methods
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {activity.supportedPaymentMethods?.length > 0
                        ? activity.supportedPaymentMethods.map((pmId) => (
                            <Chip
                              key={pmId}
                              label={paymentMethodMap[pmId] || pmId}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          ))
                        : <Chip label="None configured" size="small" color="default" variant="outlined" />
                      }
                    </Box>
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
                                : cur(discount.discountValue)
                            })`}
                            color="success"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </Box>
            ))}
          </CollapsibleSection>
        </Box>
      )}

      <Button variant="outlined" startIcon={<BackIcon />} onClick={() => navigate('/events')}>
        {t('common.actions.back')}
      </Button>
    </Box>
  );
};

export default EventDetailsPage;
