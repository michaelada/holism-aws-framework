import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { EventDateTile, formatCurrency } from '@itsplainsailing/components';
import EntryStatus from '../components/EntryStatus';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import usePageMetadata from '../hooks/usePageMetadata';
import type { PublicEvent } from '../types/publicEvents';

/**
 * A club's public programme — `/{orgCode}/whats-on`.
 *
 * The first page in this product with no signed-in reader. Two consequences
 * shape it:
 *
 *  - **No filter rail.** A club with eleven public events does not need faceted
 *    search, and a panel holding three options looks like a page that failed to
 *    load. The platform listing is where filtering belongs.
 *  - **The reader may be a stranger.** So the club is named once at the top
 *    rather than on every row, and the page closes by telling them how to join —
 *    which is the second thing this page is for.
 *
 * Entries are still made through the account application. Every route out of
 * here goes to the member app, which signs the visitor in or offers to connect
 * them first.
 *
 * See docs/PUBLIC_EVENTS.md §4.1.
 */
const PublicEventsPage: React.FC = () => {
  const { orgCode } = useParams<{ orgCode: string }>();
  const { me, publicDetail } = useAccountOrganisation();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { execute } = useAccountApi<PublicEvent[]>();

  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const locale = i18n.language;
  /*
   * From the *public* record, not from `/me`.
   *
   * A visitor arriving from a search result has no session, so `me` is null and
   * the page headed itself "What's on at" with nothing after it. `publicDetail`
   * is fetched for every organisation regardless of session, which is exactly
   * the case this page is for; `me` is kept as a fallback for the signed-in
   * reader who arrives before it lands.
   */
  const organisationName = publicDetail?.displayName ?? me?.organisation.displayName ?? '';

  const load = useCallback(async () => {
    if (!orgCode) return;
    setLoading(true);
    setFailed(false);

    /*
     * `anonymous` is required, not optional: without it the hook attaches a
     * session and resolves an organisation, and a visitor arriving from a
     * search result has neither.
     *
     * This hook *throws* on failure — unlike orgadmin-core's `useApi`, which
     * returns null — so a catch is the right shape here.
     */
    try {
      setEvents(
        (await execute({
          url: `/api/public/organisations/${orgCode}/events`,
          anonymous: true,
        })) ?? []
      );
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [orgCode, execute]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * The club's programme is a page a club shares a link to, so it needs its own
   * title and description like any other. Without this it reported
   * "ItsPlainSailing" — the same as every other route — in search results and
   * in every link preview.
   */
  usePageMetadata(
    organisationName
      ? {
          title: t('publicEvents.title', { organisation: organisationName }),
          description: t('publicEvents.metaList', { organisation: organisationName }),
          canonical: `${window.location.origin}/account/${orgCode}/whats-on`,
        }
      : null
  );

  /** Past events sink; they are kept, not hidden. */
  const now = Date.now();
  const upcoming = events.filter((event) => new Date(event.endDate).getTime() >= now);
  const past = events.filter((event) => new Date(event.endDate).getTime() < now);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress aria-label={t('common.loading')} />
      </Box>
    );
  }

  const row = (event: PublicEvent, finished: boolean) => {
    const from = event.activities.length
      ? Math.min(...event.activities.map((activity) => activity.fee))
      : null;

    return (
      <Card
        key={event.id}
        sx={{
          mb: 2,
          opacity: finished ? 0.72 : 1,
          cursor: 'pointer',
          transition: 'box-shadow 120ms ease',
          '&:hover': { boxShadow: 3 },
        }}
        onClick={() => navigate(`/${orgCode}/whats-on/${event.slug}`)}
      >
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            {/* The date leads. A programme is scanned for *when*. */}
            <EventDateTile date={event.startDate} locale={locale} />

            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="h3" sx={{ fontSize: '1.125rem' }}>
                {event.name}
              </Typography>
              {event.venue && (
                <Typography variant="body2" color="text.secondary">
                  {[event.venue.name, event.venue.region].filter(Boolean).join(' · ')}
                </Typography>
              )}

              <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap alignItems="center">
                {event.eventType && <Chip size="small" label={event.eventType} />}
                {/*
                  A finished event says only that. Showing "closes in 3 days"
                  beside "Finished" would be two contradictory claims, and the
                  reassuring one is the one that gets believed.
                */}
                {finished ? (
                  <Chip size="small" label={t('publicEvents.finished')} />
                ) : (
                  <EntryStatus event={event} />
                )}
              </Stack>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('publicEvents.activityCount', { count: event.activities.length })}
                {from !== null &&
                  ` · ${t('publicEvents.from', {
                    price: formatCurrency(from / 100, event.organisation.currency, locale),
                  })}`}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h1" sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' } }} gutterBottom>
        {t('publicEvents.title', { organisation: organisationName })}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        {t('publicEvents.subtitle')}
      </Typography>

      {failed && <Alert severity="error" sx={{ mb: 3 }}>{t('publicEvents.loadError')}</Alert>}

      {!failed && events.length === 0 && (
        <Alert severity="info">{t('publicEvents.empty')}</Alert>
      )}

      {upcoming.map((event) => row(event, false))}

      {past.length > 0 && (
        <>
          <Divider sx={{ my: 4 }} />
          <Typography variant="h2" sx={{ fontSize: '1.125rem', mb: 2 }}>
            {t('publicEvents.previously')}
          </Typography>
          {past.map((event) => row(event, true))}
        </>
      )}

      {/*
        The page's second job. Someone reading a club's programme without an
        account is a prospective member, and this is the only place in the
        product where that is reliably true.
      */}
      <Card sx={{ mt: 5 }}>
        <CardContent>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <Typography variant="body2">
              {t('publicEvents.enterPrompt', { organisation: organisationName })}
            </Typography>
            <Button variant="contained" onClick={() => navigate(`/${orgCode}`)}>
              {t('publicEvents.signInOrCreate')}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
};

export default PublicEventsPage;
