import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  Grid,
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
import { RichText, formatCurrency, formatDisplayDate } from '@itsplainsailing/components';
import { HoldCountdown } from '../components/HoldCountdown';
import { useAccountApi } from '../hooks/useAccountApi';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { AvailabilityResponse, AvailableSlot, CatalogueCalendar, CartItemType } from '../types/account';

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

/** Minutes since midnight, for comparing slots that start on the same day. */
const minutesOf = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

/**
 * Whether two slots on this calendar cannot both be taken.
 *
 * The same test the server applies to a hold: same day, and the times cross.
 * A calendar with several duration options from one start produces overlapping
 * rows on purpose — 10:00–13:00 and 10:00–14:00 are two ways to book the same
 * morning, not two mornings.
 */
const overlaps = (a: AvailableSlot, b: AvailableSlot): boolean => {
  if (a.date !== b.date) return false;
  const aStart = minutesOf(a.startTime);
  const bStart = minutesOf(b.startTime);
  return aStart < bStart + b.duration && bStart < aStart + a.duration;
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
  /*
   * Several slots at once, not one.
   *
   * A member booking a court books Tuesday *and* Thursday, and a lesson block
   * is the same slot several weeks running. One-at-a-time meant a return trip
   * through the week grid and the basket for each, and nothing about the
   * underlying booking prevents more than one — each becomes its own cart item.
   */
  const [chosen, setChosen] = useState<AvailableSlot[]>([]);
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

  /*
   * Fetch again when one of the member's own holds lapses.
   *
   * Their slot has just gone back into circulation, and the grid is still
   * drawing it as theirs. Several holds can lapse in the same second, so this
   * has to survive being called a few times over — `load` simply re-reads.
   */
  const reloadAvailability = useCallback(() => {
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
  const canBook = online && chosen.length > 0 && !saving && (!termsRequired || agreed);

  const addToBasket = async () => {
    if (chosen.length === 0 || !calendar || !orgCode) return;
    setSaving(true);
    setError(null);

    try {
      /*
       * One request per slot, in the order they were picked, rather than one
       * request carrying several. The cart's guard re-checks each slot as it
       * arrives, and a batch would have to decide what to do when the third of
       * five has gone — adding them singly means the member keeps whatever was
       * still free and is told about the one that was not.
       *
       * Sequential rather than parallel: they are writes against the same cart,
       * and the slot guard reads it.
       */
      for (const slot of chosen) {
        await executeAdd({
          method: 'POST',
          url: `/api/account/${orgCode}/cart/items`,
          data: {
            itemType: 'booking' satisfies CartItemType,
            /*
             * The slot in full, not an id — a slot has no row of its own until
             * it is booked. This is what the cart guard re-checks and what
             * fulfilment turns into a booking.
             */
            contextRef: {
              calendarId: calendar.id,
              date: slot.date,
              startTime: slot.startTime,
              duration: slot.duration,
              places: 1,
            },
            /*
             * Both ends of the slot. A start time alone leaves the member
             * checking a basket that does not say how long they booked for,
             * which is the thing that differs between two bookings of the same
             * court on the same morning.
             */
            description:
              `${calendar.name} — ${formatDisplayDate(slot.date, locale)} ` +
              `${slot.startTime}–${slot.endTime}`,
            unitFee: slot.price,
            handlingFeeIncluded: false,
            supportedPaymentMethodIds: calendar.supportedPaymentMethodIds,
          },
        });
      }

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
      setChosen([]);
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

      {/*
        The week on the left, the basket beside it.

        A member choosing several slots is running a total in their head, and
        a summary below the fold makes them scroll to check it after every
        tap. Kept sticky so it stays with them as they work down the week,
        and stacked underneath on a phone, where there is no room beside
        anything.
      */}
      {/*
        Items stretch rather than sitting at flex-start: a sticky element can
        only travel inside its own parent, so a column shrunk to its content
        height has nowhere to stick to and the basket scrolls away like anything
        else. Letting the column match the week's height is what gives it room.
      */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
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
                      // Not `exclusive`: a member books Tuesday and Thursday in
                      // one go, or the same slot several weeks running.
                      value={chosen.filter((slot) => slot.date === day).map(slotKey)}
                      onChange={(_event, keys: string[]) => {
                        /*
                         * The group reports only its own day, so the days it does
                         * not know about are carried through untouched — a
                         * wholesale replace would clear every other day's
                         * selection the moment this one changed.
                         */
                        const stillChosen = daySlots.filter((slot) => keys.includes(slotKey(slot)));

                        /*
                         * Two slots that overlap cannot both be booked.
                         *
                         * A calendar offering several lengths from one start —
                         * a three-hour morning and a four-hour extended
                         * morning — produces overlapping rows by design. Both
                         * were selectable, and the second was then refused at
                         * the basket, after the first had already gone in.
                         *
                         * The later choice wins and the one it clashes with is
                         * dropped, because they are alternatives for the same
                         * session: a member clicking "extended morning" after
                         * "morning" means the longer one. The dropped row
                         * visibly deselects, so nothing happens silently.
                         */
                        const withoutClashes = stillChosen.reduce<AvailableSlot[]>(
                          (kept, slot) => [...kept.filter((other) => !overlaps(other, slot)), slot],
                          []
                        );

                        setChosen((previous) => [
                          ...previous.filter((slot) => slot.date !== day),
                          ...withoutClashes,
                        ]);
                      }}
                      sx={{ flexWrap: 'wrap', gap: 1, '& .MuiToggleButtonGroup-grouped': { border: 1, borderRadius: 1 } }}
                    >
                      {daySlots.map((slot) => (
                        <ToggleButton
                          key={slotKey(slot)}
                          value={slotKey(slot)}
                          disabled={!slot.available || !online}
                          /*
                          Chosen slots go green rather than the default grey
                          fill. With several selectable at once, "which ones
                          have I picked?" is the question the grid has to answer
                          at a glance, and a selected-but-grey button reads as
                          disabled next to the ones that genuinely are.
                        */
                        sx={{
                          flexDirection: 'column',
                          px: 1.5,
                          py: 1,
                          textTransform: 'none',
                          '&.Mui-selected': {
                            backgroundColor: 'success.main',
                            borderColor: 'success.main',
                            color: 'success.contrastText',
                            '& .MuiTypography-root': { color: 'inherit' },
                            '&:hover': { backgroundColor: 'success.dark' },
                          },
                          /*
                            A slot already in the member's basket is drawn in
                            red and cannot be pressed.

                            It is the same "not available to take" state as a
                            slot somebody else holds, and it reads as one — but
                            not as the disabled grey of a slot that was never on
                            offer, which says nothing about why. The countdown
                            underneath, and the "In your basket" caption, are
                            what tell the member this one is theirs.
                          */
                          ...(slot.unavailableReason === 'in-your-basket' && {
                            '&.Mui-disabled': {
                              backgroundColor: 'error.light',
                              borderColor: 'error.main',
                              color: 'error.contrastText',
                              '& .MuiTypography-root': { color: 'inherit' },
                            },
                          }),
                        }}
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
                          {/*
                            Only ever the member's own hold: the server does not
                            send anybody else's expiry, so this cannot become a
                            countdown to somebody else's slot freeing up.
                          */}
                          {slot.heldUntil && (
                            <HoldCountdown
                              expiresAt={slot.heldUntil}
                              color="inherit"
                              onExpire={reloadAvailability}
                            />
                          )}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Box
            sx={{
              position: { md: 'sticky' },
              top: { md: 16 },
              /*
                A member with a dozen slots chosen would otherwise have a basket
                taller than the screen, and the add button — the point of the
                column — would sit below the fold with no way to reach it. It
                scrolls within itself instead.
              */
              maxHeight: { md: 'calc(100vh - 32px)' },
              overflowY: { md: 'auto' },
            }}
          >
            {chosen.length > 0 && (
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h2" gutterBottom>
                  {t('book.yourSlot', { count: chosen.length })}
                </Typography>

                <Stack divider={<Divider />} spacing={0}>
                  {/*
                    Listed in time order rather than the order they were tapped: the
                    member is checking a plan, and a plan reads chronologically.
                  */}
                  {[...chosen]
                    .sort((a, b) =>
                      a.date === b.date
                        ? a.startTime.localeCompare(b.startTime)
                        : a.date.localeCompare(b.date)
                    )
                    .map((slot) => (
                      <Stack
                        key={slotKey(slot)}
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ py: 1.25 }}
                      >
                        <Box>
                          <Typography>
                            {formatDisplayDate(slot.date, locale)}, {slot.startTime}–{slot.endTime}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('book.minutes', { count: slot.duration })}
                            {slot.placesRemaining > 1 &&
                              ` · ${t('book.placesLeft', { count: slot.placesRemaining })}`}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="h6">
                            {slot.price > 0
                              ? formatCurrency(slot.price / 100, currency, locale)
                              : t('book.free')}
                          </Typography>
                          <IconButton
                            size="small"
                            aria-label={t('book.removeSlot', {
                              date: formatDisplayDate(slot.date, locale),
                              time: slot.startTime,
                            })}
                            onClick={() =>
                              setChosen((previous) =>
                                previous.filter((candidate) => slotKey(candidate) !== slotKey(slot))
                              )
                            }
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>
                    ))}
                </Stack>

                {/*
                  A total only once there is more than one slot to add up. Repeating a
                  single slot's price as its own total says nothing.
                */}
                {chosen.length > 1 && (
                  <>
                    <Divider sx={{ mt: 1 }} />
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ pt: 1.5 }}
                    >
                      <Typography fontWeight={600}>{t('book.total')}</Typography>
                      <Typography variant="h6" fontWeight={700}>
                        {formatCurrency(
                          chosen.reduce((sum, slot) => sum + slot.price, 0) / 100,
                          currency,
                          locale
                        )}
                      </Typography>
                    </Stack>
                  </>
                )}
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
            {online && chosen.length === 0 && (
              <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 1 }}>
                {t('book.chooseSlot')}
              </Typography>
            )}
            {chosen && termsRequired && !agreed && (
              <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 1 }}>
                {t('form.mustAgree')}
              </Typography>
            )}
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

/** Identity of a slot within a day: its start and how long it runs. */
/**
 * Identifies one slot across the whole week.
 *
 * The date is part of the key because a member may now pick several slots at
 * once: without it, 10:00 on Saturday and 10:00 on Sunday are the same key, and
 * selecting one would toggle the other.
 */
const slotKey = (slot: AvailableSlot): string =>
  `${slot.date}|${slot.startTime}|${slot.duration}`;

export default BookCalendarPage;
