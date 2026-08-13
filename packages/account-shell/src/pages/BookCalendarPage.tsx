import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { RichText, formatCurrency, formatDisplayDate } from '@aws-web-framework/components';
import { useAccountApi } from '../hooks/useAccountApi';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { AvailabilityResponse, AvailableSlot, CatalogueCalendar } from '../types/account';

/** `YYYY-MM-DD` in the member's own timezone, not UTC. */
const dateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/** The seven days from `start`, as keys. */
const weekFrom = (start: Date): string[] =>
  Array.from({ length: 7 }, (_, offset) => dateKey(addDays(start, offset)));

/**
 * D12 and D13 — the week's availability, and booking a slot from it.
 *
 * **A week at a time, not a month.** A month of a calendar with half-hour slots
 * is several thousand rows to fetch and an unreadable wall to render; a week is
 * the unit a member thinks in when booking a court, and it fits a phone.
 *
 * Taken slots are shown, greyed, with the reason — full, in use, or held by
 * somebody else mid-booking. Hiding them turns a busy Saturday into what looks
 * like a closed one, and a member deciding when to play needs to see the
 * difference.
 *
 * Choosing a slot does not hold it. The slot is re-checked when the line is
 * added to the basket, and again at fulfilment, because a court is exactly the
 * thing two people want at once.
 */
export const BookCalendarPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { calendarId } = useParams<{ calendarId: string }>();
  const { orgCode, me } = useAccountOrganisation();
  const online = useOnlineStatus();

  const { execute: executeAvailability } = useAccountApi<AvailabilityResponse>();
  const { execute: executeAdd } = useAccountApi<unknown>();

  const currency = me?.organisation.currency ?? 'EUR';
  const locale = i18n.language;

  const [weekStart, setWeekStart] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [calendar, setCalendar] = useState<CatalogueCalendar | null>(null);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [chosen, setChosen] = useState<AvailableSlot | null>(null);
  const [agreed, setAgreed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backTo = `/${orgCode}/book`;
  const days = useMemo(() => weekFrom(weekStart), [weekStart]);

  const load = useCallback(async () => {
    if (!orgCode || !calendarId) return;
    setLoading(true);
    setError(null);
    try {
      const from = days[0];
      const to = days[days.length - 1];
      const response = await executeAvailability({
        url: `/api/account/${orgCode}/catalogue/calendars/${calendarId}/availability?from=${from}&to=${to}`,
      });
      setCalendar(response?.calendar ?? null);
      setSlots(response?.slots ?? []);
    } catch (err) {
      // A calendar that has gone is a different message from a failed request.
      if ((err as { status?: number })?.status === 404) setNotFound(true);
      else setError(t('book.loadError'));
    } finally {
      setLoading(false);
    }
  }, [orgCode, calendarId, days, executeAvailability, t]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Slots grouped by day, so each day renders its own column. */
  const byDay = useMemo(() => {
    const grouped = new Map<string, AvailableSlot[]>();
    for (const day of days) grouped.set(day, []);
    for (const slot of slots) {
      if (grouped.has(slot.date)) grouped.get(slot.date)!.push(slot);
    }
    return grouped;
  }, [days, slots]);

  const termsRequired = Boolean(calendar?.termsAndConditions);
  /*
   * Offline, a slot cannot even be chosen. The grid on screen may be hours old
   * and the court long gone, so letting a member pick one and refusing at the
   * basket would be an invitation followed by a rejection. This is the one
   * screen where that matters most, because a slot is the thing two members
   * reliably want at once.
   */
  const canBook = online && Boolean(chosen) && !saving && (!termsRequired || agreed);

  const addToBasket = async () => {
    if (!chosen || !calendar || !orgCode) return;
    setSaving(true);
    setError(null);

    try {
      await executeAdd({
        method: 'POST',
        url: `/api/account/${orgCode}/cart/items`,
        data: {
          itemType: 'booking',
          /*
           * The slot in full, not an id — a slot has no row of its own until
           * it is booked. This is what the cart guard re-checks and what
           * fulfilment turns into a booking.
           */
          contextRef: {
            calendarId: calendar.id,
            date: chosen.date,
            startTime: chosen.startTime,
            duration: chosen.duration,
            places: 1,
          },
          description: `${calendar.name} — ${formatDisplayDate(chosen.date, locale)} ${chosen.startTime}`,
          unitFee: chosen.price,
          handlingFeeIncluded: false,
          supportedPaymentMethodIds: calendar.supportedPaymentMethodIds,
        },
      });

      navigate(`/${orgCode}/cart`);
    } catch (err) {
      const refusal = err instanceof Error ? err.message : t('book.addFailed');
      /*
       * The slot may have gone while the member was deciding, so the week is
       * re-read — and the refusal is set *after* that, because `load` clears
       * the error on its way in and would otherwise wipe the one message
       * explaining why the screen just changed under them.
       */
      await load();
      setChosen(null);
      setError(refusal);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !calendar) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress aria-label={t('common.loading')} />
      </Box>
    );
  }

  if (notFound) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="error">{t('book.calendarNotFound')}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backTo)} sx={{ mt: 2 }}>
          {t('book.back')}
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backTo)} sx={{ mb: 2 }}>
        {t('book.back')}
      </Button>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h1">{calendar?.name}</Typography>
        {calendar?.description && (
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {calendar.description}
          </Typography>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <IconButton
            onClick={() => setWeekStart((current) => addDays(current, -7))}
            aria-label={t('book.previousWeek')}
          >
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="h2" sx={{ fontSize: '1.125rem' }}>
            {t('book.weekOf', { date: formatDisplayDate(days[0], locale) })}
          </Typography>
          <IconButton
            onClick={() => setWeekStart((current) => addDays(current, 7))}
            aria-label={t('book.nextWeek')}
          >
            <ChevronRightIcon />
          </IconButton>
        </Stack>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress aria-label={t('common.loading')} />
          </Box>
        ) : slots.length === 0 ? (
          <Alert severity="info">{t('book.nothingThisWeek')}</Alert>
        ) : (
          <Stack spacing={2}>
            {days.map((day) => {
              const daySlots = byDay.get(day) ?? [];
              if (daySlots.length === 0) return null;

              return (
                <Box key={day}>
                  <Typography variant="subtitle2" gutterBottom>
                    {formatDisplayDate(day, locale)}
                  </Typography>
                  {/*
                    A wrapping row of buttons rather than a grid: slot lengths
                    differ between days and a fixed grid would leave holes where
                    a club runs a shorter Saturday.
                  */}
                  <ToggleButtonGroup
                    exclusive
                    value={chosen && chosen.date === day ? slotKey(chosen) : null}
                    onChange={(_event, value) => {
                      const slot = daySlots.find((candidate) => slotKey(candidate) === value);
                      setChosen(slot ?? null);
                    }}
                    sx={{ flexWrap: 'wrap', gap: 1, '& .MuiToggleButtonGroup-grouped': { border: 1, borderRadius: 1 } }}
                  >
                    {daySlots.map((slot) => (
                      <ToggleButton
                        key={slotKey(slot)}
                        value={slotKey(slot)}
                        disabled={!slot.available || !online}
                        sx={{ flexDirection: 'column', px: 1.5, py: 1, textTransform: 'none' }}
                      >
                        <Typography variant="body2" fontWeight={600}>
                          {slot.startTime}–{slot.endTime}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {slot.available
                            ? slot.price > 0
                              ? formatCurrency(slot.price / 100, currency, locale)
                              : t('book.free')
                            : t(`book.reason.${slot.unavailableReason ?? 'full'}`)}
                        </Typography>
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>
              );
            })}
          </Stack>
        )}
      </Paper>

      {chosen && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h2" gutterBottom>
            {t('book.yourSlot')}
          </Typography>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography>
                {formatDisplayDate(chosen.date, locale)}, {chosen.startTime}–{chosen.endTime}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('book.minutes', { count: chosen.duration })}
                {chosen.placesRemaining > 1 &&
                  ` · ${t('book.placesLeft', { count: chosen.placesRemaining })}`}
              </Typography>
            </Box>
            <Typography variant="h6">
              {chosen.price > 0
                ? formatCurrency(chosen.price / 100, currency, locale)
                : t('book.free')}
            </Typography>
          </Stack>
        </Paper>
      )}

      {calendar?.termsAndConditions && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h2" gutterBottom>
            {t('form.termsHeading')}
          </Typography>
          <Box
            tabIndex={0}
            sx={{
              maxHeight: 320,
              overflowY: 'auto',
              p: 2,
              mb: 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              backgroundColor: 'action.hover',
            }}
          >
            <RichText html={calendar.termsAndConditions} sx={{ fontSize: '0.875rem' }} />
          </Box>
          <Divider sx={{ mb: 2 }} />
          <FormControlLabel
            control={
              <Checkbox
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                disabled={saving}
              />
            }
            label={t('form.agreeTerms')}
          />
        </Paper>
      )}

      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button onClick={() => navigate(backTo)} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" size="large" onClick={addToBasket} disabled={!canBook}>
          {saving ? t('book.adding') : t('book.addToBasket')}
        </Button>
      </Stack>

      {!online && (
        <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 1 }}>
          {t('offline.selectionBlocked')}
        </Typography>
      )}
      {online && !chosen && (
        <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 1 }}>
          {t('book.chooseSlot')}
        </Typography>
      )}
      {chosen && termsRequired && !agreed && (
        <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 1 }}>
          {t('form.mustAgree')}
        </Typography>
      )}
    </Container>
  );
};

/** Identity of a slot within a day: its start and how long it runs. */
const slotKey = (slot: AvailableSlot): string => `${slot.startTime}|${slot.duration}`;

export default BookCalendarPage;
