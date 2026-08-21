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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { EventDateTile, formatCurrency, formatDisplayDate } from '@aws-web-framework/components';
import { useAccountApi } from '../hooks/useAccountApi';
import EventStructuredData from '../components/EventStructuredData';
import EntryStatus from '../components/EntryStatus';
import { entryWindowFor } from '../utils/entryWindow';
import usePageMetadata from '../hooks/usePageMetadata';
import type { PublicEvent } from '../types/publicEvents';

/**
 * One public event — `/{orgCode}/whats-on/{slug}`.
 *
 * **This is the page search results point at**, which is most of why it exists
 * as its own address rather than as an expanded row on the list. Forty-seven
 * events on one URL can rank for "equestrian events Ireland" and for nothing
 * else, and a result that lands a visitor on a filter page has wasted the click.
 *
 * The slug is resolved by the id embedded in it, never by the words, so a link a
 * club posted in March still works after the event is renamed in May. When the
 * words no longer match, the URL is corrected in place — one event must not be
 * reachable, and indexable, at two addresses.
 *
 * See docs/PUBLIC_EVENTS_SEO.md §1.
 */
const PublicEventPage: React.FC = () => {
  const { orgCode, slug } = useParams<{ orgCode: string; slug: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { execute } = useAccountApi<{ event: PublicEvent; canonicalSlug: string }>();

  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const locale = i18n.language;

  const load = useCallback(async () => {
    if (!orgCode || !slug) return;
    setLoading(true);
    setNotFound(false);

    /*
     * `anonymous`: the visitor may have arrived from a search result with no
     * session at all. This hook throws on failure, so a catch is the shape.
     */
    try {
      const response = await execute({
        url: `/api/public/organisations/${orgCode}/events/${slug}`,
        anonymous: true,
      });
      if (!response) throw new Error('not found');
      setEvent(response.event);
      /*
       * Correct the address in place when the event has been renamed since the
       * link was shared. `replace`, not `push` — the stale URL should not sit
       * in the visitor's history as somewhere to go back to.
       */
      if (response.canonicalSlug && response.canonicalSlug !== slug) {
        navigate(`/${orgCode}/whats-on/${response.canonicalSlug}`, { replace: true });
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [orgCode, slug, execute, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * The document's own title and description, which is what a search result and
   * a shared link actually show. Without this every public page in the product
   * is called "ItsPlainSailing".
   */
  usePageMetadata(
    event
      ? {
          title: `${event.name} · ${event.organisation.name}`,
          description:
            event.description?.slice(0, 155) ||
            t('publicEvents.metaFallback', { organisation: event.organisation.name }),
          canonical: `${window.location.origin}/account/${event.organisation.code}/whats-on/${event.slug}`,
        }
      : null
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress aria-label={t('common.loading')} />
      </Box>
    );
  }

  if (notFound || !event) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Alert severity="info">{t('publicEvents.notFound')}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/${orgCode}/whats-on`)} sx={{ mt: 2 }}>
          {t('publicEvents.backToList')}
        </Button>
      </Container>
    );
  }

  const finished = new Date(event.endDate) < new Date();
  /*
   * The same computation the member catalogue uses, not a second opinion —
   * `entryWindowFor` is what phrases this everywhere else, and two rules about
   * whether entries are open would eventually disagree.
   */
  const entryWindow = entryWindowFor(event);
  const entriesOpen = entryWindow.state === 'open' || entryWindow.state === 'closing-soon';

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      <EventStructuredData event={event} />

      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/${orgCode}/whats-on`)} sx={{ mb: 2 }}>
        {t('publicEvents.backToList')}
      </Button>

      <Stack direction="row" spacing={3} alignItems="flex-start" sx={{ mb: 3 }}>
        <EventDateTile date={event.startDate} locale={locale} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h1" sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}>
            {event.name}
          </Typography>
          <Typography color="text.secondary">{event.organisation.name}</Typography>
          {event.venue && (
            <Typography color="text.secondary">
              {[event.venue.name, event.venue.address].filter(Boolean).join(' · ')}
            </Typography>
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
            {event.eventType && <Chip size="small" label={event.eventType} />}
            {finished ? (
              <Chip size="small" label={t('publicEvents.finished')} />
            ) : (
              <EntryStatus event={event} size="medium" />
            )}
          </Stack>
        </Box>
      </Stack>

      {event.description && (
        <Typography sx={{ mb: 3 }}>{event.description}</Typography>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h2" sx={{ fontSize: '1.125rem' }} gutterBottom>
            {t('publicEvents.activities')}
          </Typography>

          <Stack divider={<Divider />} spacing={0}>
            {event.activities.map((activity) => (
              <Stack
                key={activity.id}
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                spacing={1}
                sx={{ py: 1.5 }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body1">{activity.name}</Typography>
                  {activity.description && (
                    <Typography variant="body2" color="text.secondary">
                      {activity.description}
                    </Typography>
                  )}
                  {/*
                    Listed and labelled rather than hidden. A show with eight
                    classes would look like it had three, and "members only"
                    tells a reader something true: joining is the way in.
                  */}
                  {activity.membersOnly && (
                    <Chip
                      size="small"
                      sx={{ mt: 0.5 }}
                      label={t(
                        activity.membersOnlyScope === 'organisation-type'
                          ? 'publicEvents.membersOnlyAnyBranch'
                          : 'publicEvents.membersOnly'
                      )}
                    />
                  )}
                </Box>
                <Box sx={{ textAlign: { xs: 'left', sm: 'right' }, flexShrink: 0 }}>
                  <Typography variant="body1">
                    {formatCurrency(activity.fee / 100, event.organisation.currency, locale)}
                  </Typography>
                  {activity.placesRemaining !== null && (
                    <Typography variant="body2" color="text.secondary">
                      {activity.placesRemaining === 0
                        ? t('publicEvents.soldOut')
                        : t('publicEvents.placesLeft', { count: activity.placesRemaining })}
                    </Typography>
                  )}
                  {/*
                    Enter *this* class, not "enter the event".
                    
                    A show with six classes had one button at the foot of the
                    page, which left the reader to find the class again on the
                    next screen. This goes straight to that activity's entry
                    form; signing in returns them to the same address, which is
                    what the redirect fix is for.
                    
                    Not offered once entries are closed or the class is full —
                    a button that leads to a refusal is worse than no button.
                  */}
                  {!finished && entriesOpen && activity.placesRemaining !== 0 && (
                    <Button
                      size="small"
                      variant="outlined"
                      sx={{ mt: 1 }}
                      onClick={() =>
                        navigate(
                          `/${event.organisation.code}/browse/events/${activity.id}/enter`
                        )
                      }
                    >
                      {t('publicEvents.enter')}
                    </Button>
                  )}
                </Box>
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={1}>
            {event.entriesOpenDate && (
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">{t('publicEvents.entriesOpen')}</Typography>
                <Typography variant="body2">
                  {formatDisplayDate(event.entriesOpenDate, locale)}
                </Typography>
              </Stack>
            )}
            {event.entriesClosingDate && (
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">{t('publicEvents.entriesClose')}</Typography>
                <Typography variant="body2">
                  {formatDisplayDate(event.entriesClosingDate, locale)}
                </Typography>
              </Stack>
            )}
            {event.entriesLimit !== null && (
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">{t('publicEvents.eventLimit')}</Typography>
                <Typography variant="body2">
                  {t('publicEvents.ofPlaces', {
                    remaining: event.placesRemaining,
                    limit: event.entriesLimit,
                  })}
                </Typography>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/*
        Said once, above the classes rather than under a button that no longer
        exists. Not a disclaimer — the design: a stranger who clicks "Enter" and
        lands on a sign-in wall has been ambushed; told first, the same screen is
        the expected next step.
      */}
      {!finished && entriesOpen && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          {t('publicEvents.signInNote')}
        </Typography>
      )}

      {/* Why there is nothing to click, when there is nothing to click. */}
      {!finished && !entriesOpen && (
        <Alert severity="info">
          {entryWindow.state === 'closed'
            ? t('publicEvents.entriesClosedNote')
            : t('publicEvents.entriesNotOpenNote')}
        </Alert>
      )}
    </Container>
  );
};

export default PublicEventPage;
