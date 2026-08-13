import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import {
  formatCurrency,
  formatDateRange,
  formatDisplayDate,
} from '@aws-web-framework/components';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { AccountBooking, AccountEntry } from '../types/account';
import ActivityStatusChip from '../components/ActivityStatusChip';

type TabKey = 'entries' | 'bookings';

/**
 * C1 — My Entries & Bookings. Route `/:orgCode/entries`.
 *
 * Two datasets on one screen because they answer the same question — "what have
 * I signed up for?" — and a member does not think of an event entry and a court
 * booking as belonging to different parts of an app.
 *
 * Each tab is capability-gated independently. A club with events but no calendar
 * shows a single tab, not an empty second one, and the tabs disappear entirely
 * when only one applies.
 */
export const MyEntriesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { orgCode, me, hasCapability } = useAccountOrganisation();

  const { execute: executeEntries } = useAccountApi<AccountEntry[]>();
  const { execute: executeBookings } = useAccountApi<AccountBooking[]>();
  const { execute: executeCancel } = useAccountApi<{ refundExpected: boolean }>();

  const showEntries = hasCapability('event-management');
  const showBookings = hasCapability('calendar-bookings');

  const [entries, setEntries] = useState<AccountEntry[]>([]);
  const [bookings, setBookings] = useState<AccountBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  /** The booking a member has asked to cancel, pending their confirmation. */
  const [cancelling, setCancelling] = useState<AccountBooking | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * The tab lives in the URL so a member can link to, or reload onto, the one
   * they were looking at. It falls back to whichever tab the club actually has.
   */
  const requested = searchParams.get('tab') as TabKey | null;
  const tab: TabKey =
    requested === 'bookings' && showBookings
      ? 'bookings'
      : requested === 'entries' && showEntries
        ? 'entries'
        : showEntries
          ? 'entries'
          : 'bookings';

  const currency = me?.organisation.currency;
  const locale = i18n.language;

  const load = useCallback(async () => {
    if (!orgCode) return;
    setLoading(true);
    setFailed(false);

    // Only what the club has enabled is fetched — asking for bookings from a
    // club with no calendar would be a guaranteed 403 from the capability gate.
    const requests: Promise<unknown>[] = [];
    if (showEntries) {
      requests.push(
        executeEntries({ url: `/api/account/${orgCode}/entries` }).then(setEntries)
      );
    }
    if (showBookings) {
      requests.push(
        executeBookings({ url: `/api/account/${orgCode}/bookings` }).then(setBookings)
      );
    }

    try {
      await Promise.all(requests);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [orgCode, showEntries, showBookings, executeEntries, executeBookings]);

  useEffect(() => {
    void load();
  }, [load]);

  const bothTabs = showEntries && showBookings;

  const rows = useMemo(
    () => (tab === 'entries' ? entries : bookings),
    [tab, entries, bookings]
  );

  /**
   * Cancel, then re-read.
   *
   * The confirmation is not ceremony: a booking is a slot somebody else could
   * have had, and there is no undo. The list is re-read afterwards rather than
   * patched, because cancelling changes the row's status and its own
   * cancellability, and the server is the one that decides both.
   */
  const confirmCancellation = async () => {
    if (!cancelling || !orgCode) return;
    setSaving(true);
    setCancelError(null);

    try {
      const outcome = await executeCancel({
        method: 'POST',
        url: `/api/account/${orgCode}/bookings/${cancelling.id}/cancel`,
      });

      setCancelling(null);
      setCancelled(
        outcome?.refundExpected ? t('entries.cancelledWithRefund') : t('entries.cancelled')
      );
      await load();
    } catch (error) {
      // Shown inside the dialog: the member is still looking at it, and a
      // message behind the overlay would not be read.
      setCancelError(error instanceof Error ? error.message : t('entries.cancelFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h1" gutterBottom>
        {t('entries.title')}
      </Typography>

      {bothTabs && (
        <Tabs
          value={tab}
          onChange={(_, value: TabKey) => setSearchParams({ tab: value })}
          sx={{ mb: 2 }}
        >
          <Tab value="entries" label={t('entries.tabEntries')} />
          <Tab value="bookings" label={t('entries.tabBookings')} />
        </Tabs>
      )}

      {failed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('entries.loadError')}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label={t('common.loading')} />
        </Box>
      ) : rows.length === 0 ? (
        !failed && (
          <Stack spacing={1} sx={{ py: 4 }}>
            <Typography>
              {t(tab === 'entries' ? 'entries.empty' : 'entries.emptyBookings')}
            </Typography>
            <Typography color="text.secondary">{t('entries.emptyHint')}</Typography>
          </Stack>
        )
      ) : (
        <TableContainer component={Paper}>
          {/*
            The table scrolls horizontally rather than wrapping on a phone —
            these are dense rows and reflowing them into stacked cells loses the
            column alignment that makes a list of entries scannable.
          */}
          <Table size="small" sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                {tab === 'entries' ? (
                  <>
                    <TableCell>{t('entries.colEvent')}</TableCell>
                    <TableCell>{t('entries.colActivity')}</TableCell>
                    <TableCell>{t('entries.colDate')}</TableCell>
                    <TableCell align="right">{t('entries.colFee')}</TableCell>
                    <TableCell>{t('entries.colStatus')}</TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>{t('entries.colCalendar')}</TableCell>
                    <TableCell>{t('entries.colSlot')}</TableCell>
                    <TableCell>{t('entries.colDate')}</TableCell>
                    <TableCell align="right">{t('entries.colDuration')}</TableCell>
                    <TableCell align="right">{t('entries.colFee')}</TableCell>
                    <TableCell>{t('entries.colStatus')}</TableCell>
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {tab === 'entries'
                ? entries.map((entry) => (
                    <TableRow
                      key={entry.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/${orgCode}/entries/${entry.id}`)}
                    >
                      <TableCell>{entry.eventName}</TableCell>
                      <TableCell>{entry.activityName}</TableCell>
                      <TableCell>
                        {formatDateRange(entry.startDate, entry.endDate, locale)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(entry.fee, currency, locale)}
                      </TableCell>
                      <TableCell>
                        <ActivityStatusChip status={entry.status} />
                      </TableCell>
                    </TableRow>
                  ))
                : bookings.map((booking) => (
                    <TableRow key={booking.id} hover>
                      <TableCell>{booking.calendarName}</TableCell>
                      <TableCell>
                        {booking.startTime}–{booking.endTime}
                      </TableCell>
                      <TableCell>{formatDisplayDate(booking.bookingDate, locale)}</TableCell>
                      <TableCell align="right">
                        {t('entries.minutes', { count: booking.duration })}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(booking.totalPrice, currency, locale)}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <ActivityStatusChip status={booking.status} />
                          {/*
                            The club's policy decides this, on the server. When
                            it says no, the reason is shown rather than the row
                            simply lacking a button — a member who cannot cancel
                            should know whether that is the policy or the clock.
                          */}
                          {booking.canCancel ? (
                            <Button size="small" onClick={() => setCancelling(booking)}>
                              {t('entries.cancel')}
                            </Button>
                          ) : (
                            booking.cancellationRefusal === 'too-late' && (
                              <Typography variant="caption" color="text.secondary">
                                {t('entries.cancelTooLate', {
                                  count: booking.cancellationNoticeDays,
                                })}
                              </Typography>
                            )
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {cancelled && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setCancelled(null)}>
          {cancelled}
        </Alert>
      )}

      <Dialog open={cancelling !== null} onClose={saving ? undefined : () => setCancelling(null)}>
        <DialogTitle>{t('entries.cancelTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {cancelling &&
              t('entries.cancelConfirm', {
                calendar: cancelling.calendarName,
                date: formatDisplayDate(cancelling.bookingDate, locale),
                time: cancelling.startTime,
              })}
          </DialogContentText>
          {/*
            What happens to the money, said before the member commits rather
            than after. The club's policy decides it; this only reports it.
          */}
          {cancelling?.refundExpected && (
            <DialogContentText sx={{ mt: 1 }}>{t('entries.cancelRefund')}</DialogContentText>
          )}
          {cancelError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {cancelError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelling(null)} disabled={saving}>
            {t('entries.cancelKeep')}
          </Button>
          <Button color="error" variant="contained" onClick={confirmCancellation} disabled={saving}>
            {saving ? t('entries.cancelling') : t('entries.cancelConfirmAction')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MyEntriesPage;
