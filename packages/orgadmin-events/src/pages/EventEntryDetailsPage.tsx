/**
 * One entry, in full.
 *
 * A payment line for an entry used to lead to the entrant *list* for the whole
 * event: the club arrived at a table of two hundred names having asked about
 * one. This page answers the question that was actually asked — whose entry it
 * is, which class, what it cost, what they wrote on the form, and which payment
 * it came in on.
 *
 * The form answers matter most. The form itself is gone once the entry exists,
 * so until now the only way to read back what an entrant declared was the
 * database.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Link,
  Paper,
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Receipt as PaymentIcon,
} from '@mui/icons-material';
import {
  useTranslation,
  useLocale,
  formatCurrency,
  formatDate,
  formatDateTime,
} from '@aws-web-framework/orgadmin-shell';
import { useApi, useOrganisation } from '@aws-web-framework/orgadmin-core';
import EditEntryAnswersDialog from '../components/EditEntryAnswersDialog';

/** One entry, as `GET /events/:eventId/entries/:entryId` returns it. */
export interface EventEntryDetail {
  /** The activity's form and the answers as stored — what the editor needs. */
  applicationFormId?: string | null;
  formValues?: Record<string, unknown>;
  id: string;
  eventId: string;
  firstName: string;
  lastName: string;
  email: string;
  quantity: number;
  paymentStatus: string;
  paymentMethod?: string | null;
  entryDate: string;
  eventName?: string;
  eventStartDate: string | null;
  eventEndDate: string | null;
  activityName?: string;
  activityDescription: string | null;
  activityFee: number | null;
  formSummary: Array<{ label: string; value: string }>;
  paymentId: string | null;
  paymentAmount: number | null;
  paymentDate: string | null;
  paymentReference: string | null;
  memberId?: string | null;
  memberName: string | null;
  /** `removed` where the entry was withdrawn with a refund. */
  entryStatus?: string;
  removedAt?: string | null;
  removalReason?: string | null;
}

/** A label above its value, the way the event pages lay one out. */
const Field: React.FC<{ label: string; value?: React.ReactNode; span?: number }> = ({
  label,
  value,
  span = 6,
}) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <Grid item xs={12} md={span}>
      <Typography variant="subtitle2" color="textSecondary">
        {label}
      </Typography>
      <Typography variant="body1" sx={{ mt: 0.5 }}>
        {value}
      </Typography>
    </Grid>
  );
};

export const paymentStatusColour = (
  status: string
): 'success' | 'warning' | 'error' | 'default' => {
  switch (status) {
    case 'paid':
      return 'success';
    case 'pending':
      return 'warning';
    case 'refunded':
      return 'error';
    default:
      return 'default';
  }
};

const EventEntryDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: eventId, entryId } = useParams<{ id: string; entryId: string }>();
  const { execute } = useApi();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { organisation } = useOrganisation();

  const [entry, setEntry] = useState<EventEntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);

  const money = (amount: number) =>
    formatCurrency(amount, organisation?.currency || 'EUR', locale);

  const load = useCallback(async () => {
    if (!eventId || !entryId) return;
    try {
      setLoading(true);
      setFailed(false);
      setEntry(
        await execute({
          method: 'GET',
          url: `/api/orgadmin/events/${eventId}/entries/${entryId}`,
        })
      );
    } catch (error) {
      console.error('Failed to load entry:', error);
      // Not the same as an entry with nothing on it.
      setFailed(true);
      setEntry(null);
    } finally {
      setLoading(false);
    }
  }, [execute, eventId, entryId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (failed || !entry) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('events.entryDetails.notFound')}</Alert>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate(`/events/${eventId}/entries`)}
          sx={{ mt: 2 }}
        >
          {t('events.entryDetails.backToEntries')}
        </Button>
      </Box>
    );
  }

  const entrant = `${entry.firstName} ${entry.lastName}`.trim();

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4">{entrant}</Typography>
          <Typography variant="subtitle1" color="textSecondary">
            {[entry.activityName, entry.eventName].filter(Boolean).join(' — ')}
          </Typography>
        </Box>
        <Chip
          label={t(`common.status.${entry.paymentStatus}`, { defaultValue: entry.paymentStatus })}
          color={paymentStatusColour(entry.paymentStatus)}
        />
      </Box>

      {/*
        A withdrawn entry, said plainly at the top.
        
        It is off the entrant list and still here — which is the point of
        withdrawing rather than deleting — so somebody arriving from the payment
        that refunded it must not read it as an entry that still stands.
      */}
      {entry.entryStatus === 'removed' && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {entry.removedAt
            ? t('events.entryDetails.withdrawnOn', {
                date: formatDateTime(entry.removedAt, locale),
              })
            : t('events.entryDetails.withdrawn')}
          {entry.removalReason ? ` — ${entry.removalReason}` : ''}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" gutterBottom>
            {t('events.entryDetails.entrant')}
          </Typography>
          {/*
            The club's remedy for a member's mistake — the name typed in a
            hurry, an answer a year out. Beside the entrant rather than beside
            the answers, because the name is the commoner correction and an
            activity that asks nothing still has one to fix.
          */}
          <Button size="small" startIcon={<EditIcon />} onClick={() => setEditing(true)}>
            {t('events.entryDetails.answers.edit')}
          </Button>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {/*
            One name, as it was given.
            
            It is typed as one string into "Who is this entry for?" and split at
            the first space only so the schema has somewhere to put it. Showing
            two fields presents that split as though the club had asked for it:
            "Áine de Búrca" reads as a surname of "de Búrca", and a single-word
            name — which an open activity accepts — reads as a first name with
            an empty box beside it.
          */}
          <Field label={t('events.entryDetails.name')} value={entrant} />
          <Field
            label={t('events.entryDetails.email')}
            value={<Link href={`mailto:${entry.email}`}>{entry.email}</Link>}
          />
          {/*
            Whether they entered as a member, and which one. An entry carries
            its own name — a parent may enter a child who is not the account
            holder — so the two are not the same question.
          */}
          <Field
            label={t('events.entryDetails.member')}
            value={
              entry.memberId ? (
                <Link
                  component="button"
                  type="button"
                  onClick={() => navigate(`/members/${entry.memberId}`)}
                >
                  {entry.memberName ?? t('events.entryDetails.viewMember')}
                </Link>
              ) : (
                t('events.entryDetails.notAMember')
              )
            }
          />
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('events.entryDetails.theEntry')}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Field label={t('events.entryDetails.activity')} value={entry.activityName} />
          <Field
            label={t('events.entryDetails.fee')}
            value={entry.activityFee === null ? null : money(entry.activityFee)}
          />
          <Field
            label={t('events.entryDetails.activityDescription')}
            value={entry.activityDescription}
            span={12}
          />
          <Field label={t('events.entryDetails.event')} value={entry.eventName} />
          <Field
            label={t('events.entryDetails.eventDates')}
            value={
              entry.eventStartDate
                ? [entry.eventStartDate, entry.eventEndDate]
                    .filter(Boolean)
                    .map((date) => formatDate(date as string, 'dd MMM yyyy', locale))
                    .join(' – ')
                : null
            }
          />
          <Field
            label={t('events.entryDetails.entryDate')}
            value={formatDateTime(entry.entryDate, locale)}
          />
          <Field
            label={t('events.entryDetails.quantity')}
            value={entry.quantity > 1 ? entry.quantity : null}
          />
        </Grid>
      </Paper>

      {/*
        What the entrant declared. Hidden entirely where the activity asked
        nothing, rather than an empty heading implying the answers were lost.
      */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('events.entryDetails.formSubmission')}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        {entry.formSummary.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            {t('events.entryDetails.noAnswers')}
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {entry.formSummary.map((answer) => (
              <Field key={answer.label} label={answer.label} value={answer.value} />
            ))}
          </Grid>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('events.entryDetails.payment')}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        {entry.paymentId ? (
          <Grid container spacing={2}>
            <Field
              label={t('events.entryDetails.paymentStatus')}
              value={t(`common.status.${entry.paymentStatus}`, {
                defaultValue: entry.paymentStatus,
              })}
            />
            <Field
              label={t('events.entryDetails.paymentMethod')}
              value={
                entry.paymentMethod
                  ? t(`payments.paymentMethodOptions.${entry.paymentMethod}`, {
                      defaultValue: entry.paymentMethod,
                    })
                  : null
              }
            />
            <Field
              label={t('events.entryDetails.paymentTotal')}
              value={entry.paymentAmount === null ? null : money(entry.paymentAmount)}
            />
            <Field
              label={t('events.entryDetails.paymentDate')}
              value={entry.paymentDate ? formatDateTime(entry.paymentDate, locale) : null}
            />
            <Grid item xs={12}>
              {/*
                The payment, not just its number: an entry is usually one line
                of a basket, and the rest of it is what the club is asked about
                next.
              */}
              <Button
                startIcon={<PaymentIcon />}
                onClick={() => navigate(`/payments/${entry.paymentId}`)}
              >
                {t('events.entryDetails.viewPayment')}
              </Button>
            </Grid>
          </Grid>
        ) : (
          /*
            An entry added by hand, or one from before baskets existed. Its
            payment status still stands; there is simply no payment record to
            open.
          */
          <Typography variant="body2" color="textSecondary">
            {t('events.entryDetails.noPayment')}
          </Typography>
        )}
      </Paper>

      <Button startIcon={<BackIcon />} onClick={() => navigate(`/events/${eventId}/entries`)}>
        {t('events.entryDetails.backToEntries')}
      </Button>

      {eventId && entryId && (
        <EditEntryAnswersDialog
          open={editing}
          eventId={eventId}
          entryId={entryId}
          formId={entry.applicationFormId ?? null}
          values={entry.formValues ?? {}}
          entrantName={entrant}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            // Reloaded rather than patched in place: the summary is built by
            // the server from the form's labels, and half of it is formatting.
            void load();
          }}
        />
      )}
    </Box>
  );
};

export default EventEntryDetailsPage;
