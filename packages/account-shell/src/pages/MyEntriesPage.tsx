import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  formatCurrency,
  formatDateRange,
  formatDisplayDate,
} from '@aws-web-framework/components';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { AccountBooking, AccountEntry, ActivityStatus } from '../types/account';
import ActivityStatusChip from '../components/ActivityStatusChip';
import CartItemIcon from '../components/CartItemIcon';

/**
 * One line on the activity screen, whichever kind it is.
 *
 * The original record is kept alongside the flattened fields because a booking
 * still needs its cancellation policy and an entry still needs its id to
 * navigate to — flattening everything either kind might want would be most of
 * both types again.
 */
interface ActivityRow {
  kind: 'entry' | 'booking';
  /** Prefixed by kind: an entry and a booking could share an id. */
  id: string;
  /** A calendar's icon key; bookings only. */
  icon: string | null;
  colour: string | null;
  title: string;
  detail: string;
  /** Epoch milliseconds, for ordering. */
  on: number;
  when: string;
  fee: number | null;
  status: ActivityStatus;
  entry: AccountEntry | null;
  booking: AccountBooking | null;
}

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

  /**
   * Entries and bookings, in one list.
   *
   * They were two tables behind two tabs, which made the member do the merging:
   * a Saturday with a lesson at ten and a show entry at two was two screens,
   * and neither said what came first. One table answers "what have I got on"
   * in the order it will happen.
   *
   * The kinds keep their own detail — an entry names its activity, a booking
   * names its time and length — and are told apart by the mark on the left,
   * which for a booking is the club's own icon for that calendar.
   */
  const rows = useMemo<ActivityRow[]>(() => {
    const merged: ActivityRow[] = [
      ...entries.map((entry) => ({
        kind: 'entry' as const,
        id: `entry-${entry.id}`,
        icon: null,
        colour: null,
        title: entry.eventName,
        /*
          The class, then who it is for.
          
          A parent holds every entry in the household on one login, so four
          rows reading "Spring League · Grade 1" differ only in the child — and
          the child was the one thing the row did not say.
        */
        detail: [entry.activityName, entry.entrantName].filter(Boolean).join(' · '),
        /** Sorted on; an entry with no date sorts as far future rather than 1970. */
        on: entry.startDate ? Date.parse(entry.startDate) : Number.MAX_SAFE_INTEGER,
        when: formatDateRange(entry.startDate, entry.endDate, locale),
        fee: entry.fee,
        status: entry.status,
        entry,
        booking: null,
      })),
      ...bookings.map((booking) => ({
        kind: 'booking' as const,
        id: `booking-${booking.id}`,
        icon: booking.displayIcon,
        colour: booking.displayColour,
        title: booking.calendarName,
        detail: `${booking.startTime}–${booking.endTime} · ${t('entries.minutes', {
          count: booking.duration,
        })}`,
        on: Date.parse(booking.bookingDate),
        when: formatDisplayDate(booking.bookingDate, locale),
        fee: booking.totalPrice,
        status: booking.status,
        entry: null,
        booking,
      })),
    ];

    /*
     * Coming up first, soonest first; then what has been and gone, most recent
     * first. A single sort either way puts the least useful end at the top —
     * ascending opens on last season, descending on something months away.
     */
    const now = Date.now();
    return merged.sort((a, b) => {
      const aFuture = a.on >= now;
      const bFuture = b.on >= now;
      if (aFuture !== bFuture) return aFuture ? -1 : 1;
      return aFuture ? a.on - b.on : b.on - a.on;
    });
  }, [entries, bookings, locale, t]);

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
            <Typography>{t('entries.empty')}</Typography>
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
                {/* The mark's column carries no heading — it labels the row, not a value. */}
                <TableCell sx={{ width: 56 }} />
                <TableCell>{t('entries.colItem')}</TableCell>
                <TableCell>{t('entries.colDate')}</TableCell>
                <TableCell align="right">{t('entries.colFee')}</TableCell>
                <TableCell>{t('entries.colStatus')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  hover={row.kind === 'entry'}
                  // Only an entry has a detail screen to open. A booking's own
                  // detail is already in the row, and a cursor promising a page
                  // that does not exist is worse than none.
                  sx={row.kind === 'entry' ? { cursor: 'pointer' } : undefined}
                  onClick={
                    row.entry
                      ? () => navigate(`/${orgCode}/entries/${row.entry!.id}`)
                      : undefined
                  }
                >
                  <TableCell>
                    <CartItemIcon
                      itemType={row.kind === 'entry' ? 'event_entry' : 'booking'}
                      icon={row.icon}
                      colour={row.colour}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.detail}
                    </Typography>
                  </TableCell>
                  <TableCell>{row.when}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(row.fee, currency, locale)}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <ActivityStatusChip status={row.status} />
                      {/*
                        The club's policy decides this, on the server. When it
                        says no, the reason is shown rather than the row simply
                        lacking a button — a member who cannot cancel should
                        know whether that is the policy or the clock.

                        `stopPropagation` is not needed: only entry rows carry a
                        click, and only bookings carry this button.
                      */}
                      {row.booking?.canCancel ? (
                        <Button size="small" onClick={() => setCancelling(row.booking)}>
                          {t('entries.cancel')}
                        </Button>
                      ) : (
                        row.booking?.cancellationRefusal === 'too-late' && (
                          <Typography variant="caption" color="text.secondary">
                            {t('entries.cancelTooLate', {
                              count: row.booking.cancellationNoticeDays,
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
