import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  formatCurrency,
  formatDateRange,
  formatDisplayDateTime,
} from '@aws-web-framework/components';
import { useAccountApi, AccountApiError } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { AccountEntryDetail } from '../types/account';
import ActivityStatusChip from '../components/ActivityStatusChip';

/**
 * C2 — Entry detail. Route `/:orgCode/entries/:entryId`.
 *
 * **There is deliberately no cancel action** (Q6). Entries cannot be withdrawn
 * by the member; the club's contact details are offered instead. Bookings are
 * the one self-cancellable thing, and that belongs to a later phase.
 *
 * "Your answers" is not rendered here. The stored `form_submissions` row has to
 * be read against the form definition **as it was at submission time** — using
 * the current definition would silently drop answers to since-deleted fields,
 * which is worse than not showing them. The endpoint for that does not exist
 * yet, so the panel says so plainly rather than showing a wrong rendering.
 */
export const EntryDetailPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { orgCode, entryId } = useParams<{ orgCode: string; entryId: string }>();
  const { me } = useAccountOrganisation();
  const { execute } = useAccountApi<AccountEntryDetail>();

  const [entry, setEntry] = useState<AccountEntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);

  const currency = me?.organisation.currency;
  const locale = i18n.language;

  const load = useCallback(async () => {
    if (!orgCode || !entryId) return;
    setLoading(true);
    setNotFound(false);
    setFailed(false);
    try {
      setEntry(await execute({ url: `/api/account/${orgCode}/entries/${entryId}` }));
    } catch (error) {
      // 404 covers both "no such entry" and "not yours" — the API does not
      // distinguish them, and neither should this screen.
      if (error instanceof AccountApiError && error.status === 404) {
        setNotFound(true);
      } else {
        setFailed(true);
      }
      setEntry(null);
    } finally {
      setLoading(false);
    }
  }, [execute, orgCode, entryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const back = (
    <Button
      startIcon={<ArrowBackIcon />}
      onClick={() => navigate(`/${orgCode}/entries`)}
      sx={{ mb: 2 }}
    >
      {t('entry.backToEntries')}
    </Button>
  );

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 10, textAlign: 'center' }}>
        <CircularProgress aria-label={t('common.loading')} />
      </Container>
    );
  }

  if (notFound || failed || !entry) {
    return (
      <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
        {back}
        <Alert severity={notFound ? 'warning' : 'error'}>
          {t(notFound ? 'entry.notFound' : 'entry.loadError')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      {back}

      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          sx={{ mb: 2 }}
        >
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h1">{entry.eventName}</Typography>
            <Typography color="text.secondary">{entry.activityName}</Typography>
          </Box>
          <ActivityStatusChip status={entry.status} size="medium" />
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Stack spacing={1}>
          <Field label={t('entries.colDate')}>
            {formatDateRange(entry.startDate, entry.endDate, locale)}
          </Field>
          <Field label={t('entry.entrant')}>
            {entry.firstName} {entry.lastName} · {entry.email}
          </Field>
          <Field label={t('entries.colFee')}>
            {formatCurrency(entry.fee, currency, locale)}
          </Field>
          <Field label={t('entry.reference')}>
            {formatDisplayDateTime(entry.entryDate, locale)}
          </Field>
        </Stack>

        {entry.confirmationMessage && (
          <Alert severity="info" sx={{ mt: 3 }}>
            {entry.confirmationMessage}
          </Alert>
        )}

        <Divider sx={{ my: 3 }} />

        <Typography variant="h2" gutterBottom>
          {t('entry.yourAnswers')}
        </Typography>
        <Typography color="text.secondary">{t('entry.answersUnavailable')}</Typography>

        <Divider sx={{ my: 3 }} />

        {/* No cancel button — see the note on this component. */}
        <Typography variant="body2" color="text.secondary">
          {t('entry.noCancel')}
        </Typography>
      </Paper>
    </Container>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0, sm: 2 }}>
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>
      {label}
    </Typography>
    <Typography variant="body2">{children}</Typography>
  </Stack>
);

export default EntryDetailPage;
