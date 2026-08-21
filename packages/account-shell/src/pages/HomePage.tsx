import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { formatCurrency, formatDisplayDate } from '@aws-web-framework/components';
import ActivityStatusChip from '../components/ActivityStatusChip';
import MembershipCard from '../components/MembershipCard';
import WhatsOnCard from '../components/WhatsOnCard';
import { useBookingsLabel } from '../hooks/useBookingsLabel';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { AccountDashboard, DashboardWhatsOn } from '../types/account';

/**
 * B3 — Home / My Dashboard. Route `/:orgCode`.
 *
 * **One request, and every section decided on the server.** A card is absent —
 * not empty — when the club has not enabled that area: an empty "Your orders"
 * card for a club that sells nothing reads as a broken page, and a member
 * cannot tell it apart from having no orders.
 *
 * Nothing here computes anything. The renewal window, the cart total and its
 * handling fee, the entry statuses: all come from the services that own them.
 * A dashboard that worked out its own answers would begin to disagree with the
 * screens it links to.
 */
export const HomePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { orgCode, me } = useAccountOrganisation();
  const { execute } = useAccountApi<AccountDashboard>();

  const [dashboard, setDashboard] = useState<AccountDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const firstName = me?.user.firstName;
  const fallbackCurrency = me?.organisation.currency ?? 'EUR';
  const locale = i18n.language;

  const load = useCallback(async () => {
    if (!orgCode) return;
    setLoading(true);
    setFailed(false);
    try {
      setDashboard(await execute({ url: `/api/account/${orgCode}/dashboard` }));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [execute, orgCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const bookingsLabel = useBookingsLabel();

  /*
   * Bookings out of the general row and into their own. They recur where the
   * rest are one-offs, and the club names the area itself, so mixing them in
   * under "What's on" buries both facts.
   */
  const activeMemberships = dashboard?.memberships ?? [];
  const bookingWhatsOn = dashboard?.whatsOn.filter((item) => item.kind === 'calendar') ?? [];
  const shopWhatsOn = dashboard?.whatsOn.filter((item) => item.kind === 'merchandise') ?? [];
  const eventWhatsOn = dashboard?.whatsOn.filter((item) => item.kind === 'event') ?? [];
  const registrationWhatsOn =
    dashboard?.whatsOn.filter((item) => item.kind === 'registration') ?? [];
  const externalEvents = dashboard?.externalEvents ?? [];

  /** Where each teaser leads — the screen that can actually do the thing. */
  const whatsOnTarget = (item: DashboardWhatsOn): string => {
    switch (item.kind) {
      case 'event':
        return `/${orgCode}/browse/events`;
      case 'merchandise':
        return `/${orgCode}/shop/${item.id}`;
      case 'calendar':
        return `/${orgCode}/book/${item.id}`;
      case 'registration':
        return `/${orgCode}/register-interest/${item.id}`;
      default:
        return `/${orgCode}`;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h1">
        {firstName ? t('home.welcome', { name: firstName }) : t('home.welcomeAnonymous')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {me?.organisation.displayName}
      </Typography>

      {failed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('home.loadError')}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label={t('common.loading')} />
        </Box>
      ) : (
        dashboard && (
          <Stack spacing={3}>
            {/*
              The basket gets a row to itself, at the left edge.

              It used to be the second cell of the two-column summary grid, so
              with anything beside it the card sat in the right-hand half while
              every row below started at the left — which reads as a stray
              margin rather than as a column.

              First, too: a basket with something in it is the most actionable
              thing on this page, and it is what the member came back to finish.
            */}
            {dashboard.cart && (
              <Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        {/*
                          The title belongs to the card, as it does on the
                          summary card below it — "Coming up" carries its own.
                          Lifting it out made this the odd one of the pair.

                          What made the block look indented was the grid, not
                          this: it was the second cell of a two-column row, so
                          the card sat in the right-hand half. It has a row to
                          itself now, so the card's edge lines up with the
                          teasers below whatever the title does.

                          The cart mark is the same orange as the count in the
                          navigation, so the two read as one thing: the badge
                          says there is something in the basket, and this is
                          where it is.
                        */}
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          <ShoppingCartIcon
                            sx={{ color: 'warning.main', fontSize: '1.25rem' }}
                            aria-hidden
                          />
                          <Typography variant="h2" sx={{ fontSize: '1.125rem' }}>
                            {t('home.cart')}
                          </Typography>
                        </Stack>

                        {/*
                          The button sits level with the figures rather than
                          under them, which takes a whole row off the card's
                          height — this is a summary, and it should not be
                          taller than the teasers beneath it.

                          `space-between` rather than a margin: the figures grow
                          with the basket (an added handling-fee line, a longer
                          total) and the button stays pinned to the right edge
                          whatever they do.
                        */}
                        <Stack
                          direction="row"
                          spacing={2}
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2">
                              {t('home.cartSummary', {
                                count: dashboard.cart.itemCount,
                                total: formatCurrency(
                                  dashboard.cart.total / 100,
                                  dashboard.cart.currency || fallbackCurrency,
                                  locale
                                ),
                              })}
                            </Typography>
                            {dashboard.cart.handlingFee > 0 && (
                              <Typography variant="body2" color="text.secondary">
                                {t('home.cartHandling', {
                                  fee: formatCurrency(
                                    dashboard.cart.handlingFee / 100,
                                    dashboard.cart.currency || fallbackCurrency,
                                    locale
                                  ),
                                })}
                              </Typography>
                            )}
                          </Box>

                          <Button
                            size="small"
                            variant="contained"
                            // Never squeezed to fit: a wrapped "Go to / basket"
                            // is worse than the figures beside it eliding.
                            sx={{ flexShrink: 0 }}
                            onClick={() => navigate(`/${orgCode}/cart`)}
                          >
                            {t('home.goToCart')}
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/*
              The same gutter as the teaser rows below, which is what makes the
              two line up: at `spacing={2}` a half-width summary card is exactly
              two quarter-width teasers plus the gap between them. At a
              different spacing the left edges still meet but the right ones do
              not, and the page reads as slightly broken without it being
              obvious why.
            */}
            <Grid container spacing={2}>
              {dashboard.comingUp && dashboard.comingUp.length > 0 && (
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h2" sx={{ fontSize: '1.125rem' }} gutterBottom>
                        {t('home.comingUp')}
                      </Typography>
                      <Stack spacing={1.5} divider={<Divider />}>
                        {dashboard.comingUp.map((item) => (
                          <Box key={`${item.kind}-${item.id}`}>
                            <Stack direction="row" justifyContent="space-between" spacing={1}>
                              <Typography variant="body2" fontWeight={600}>
                                {item.title}
                              </Typography>
                              <ActivityStatusChip status={item.status} />
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                              {formatDisplayDate(item.on, locale)}
                              {item.detail ? ` · ${item.detail}` : ''}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                      <Button
                        size="small"
                        sx={{ mt: 2 }}
                        onClick={() => navigate(`/${orgCode}/entries`)}
                      >
                        {t('home.seeAll')}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>

            {/*
              Two rows, not one. Bookings are a different kind of thing from a
              one-off event or a shirt — they recur, and a club renames the area
              to match what it actually books — so they get their own heading
              under the club's own word for them rather than being mixed in.
            */}
            {/*
              Upcoming events lead, memberships follow.

              What is *on* is the thing a member comes back to the home screen
              to find out; a membership they already hold changes a couple of
              times a year and is reference rather than news. Both are absent
              entirely when empty — a club whose events the member has already
              been through gets no empty heading.
            */}
            {eventWhatsOn.length > 0 && (
              <Box>
                {/*
                  "View all" beside the heading, not under the cards.

                  Four teasers look like the whole programme, and a member who
                  reads them as such never opens the events page. Putting the
                  way out level with the title says there is more before they
                  have finished scanning what is here.
                */}
                <Stack
                  direction="row"
                  alignItems="baseline"
                  justifyContent="space-between"
                  sx={{ mb: 1 }}
                >
                  <Typography variant="h2" sx={{ fontSize: '1.125rem' }}>
                    {t('home.upcomingEvents')}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => navigate(`/${orgCode}/browse/events`)}
                  >
                    {t('home.viewAll')}
                  </Button>
                </Stack>
                <Grid container spacing={2}>
                  {eventWhatsOn.map((item) => (
                    <Grid item xs={12} sm={6} md={3} key={`${item.kind}-${item.id}`}>
                      <WhatsOnCard
                        item={item}
                        currency={fallbackCurrency}
                        locale={locale}
                        showKind={false}
                        onOpen={() => navigate(whatsOnTarget(item))}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {/*
              Events another branch is running.

              Kept in its own section, below the club's own, and labelled with
              the organising club on every row. A member glancing at the home
              page must never mistake one of these for something their own club
              is putting on — the date, the entry rules and the money are all
              somebody else's.
            */}
            {externalEvents.length > 0 && (
              <Box>
                <Typography variant="h2" sx={{ fontSize: '1.125rem' }} gutterBottom>
                  {t('home.externalEvents')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {/*
                    Named rather than described. "Organisations of the same
                    type" is how the platform thinks about it; "Irish Pony
                    Clubs" is what the member belongs to, and is the only form
                    of the sentence they can check against what they know.
                  */}
                  {t('home.externalEventsHint', {
                    organisationType: dashboard?.organisationTypeName ?? '',
                  })}
                </Typography>
                <Grid container spacing={2}>
                  {externalEvents.map((event) => (
                    <Grid item xs={12} sm={6} md={3} key={event.id}>
                      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardContent sx={{ flexGrow: 1 }}>
                          <Chip
                            size="small"
                            label={t('home.externalEventBadge')}
                            sx={{ mb: 1 }}
                          />
                          <Typography variant="subtitle1">{event.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {event.organisationName}
                          </Typography>
                          {event.startDate && (
                            <Typography variant="body2" color="text.secondary">
                              {formatDisplayDate(event.startDate, locale)}
                            </Typography>
                          )}
                        </CardContent>
                        <CardActions>
                          {/*
                            Two different invitations. Being asked to join
                            something you already belong to reads as the
                            software not knowing you.
                          */}
                          <Button
                            size="small"
                            onClick={() => navigate(`/${event.organisationCode}`)}
                          >
                            {event.alreadyJoined
                              ? t('home.externalEventOpen', { organisation: event.organisationName })
                              : t('home.externalEventAccount', { organisation: event.organisationName })}
                          </Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {activeMemberships.length > 0 && (
              <Box>
                <Typography variant="h2" sx={{ fontSize: '1.125rem' }} gutterBottom>
                  {t('home.memberships')}
                </Typography>
                <Grid container spacing={2}>
                  {activeMemberships.map((membership) => (
                    <Grid item xs={12} sm={6} md={3} key={membership.id}>
                      <MembershipCard
                        membership={membership}
                        locale={locale}
                        onRenew={() => navigate(`/${orgCode}/browse/memberships`)}
                        onOpen={() => navigate(`/${orgCode}/memberships`)}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {bookingWhatsOn.length > 0 && (
              <Box>
                <Typography variant="h2" sx={{ fontSize: '1.125rem' }} gutterBottom>
                  {bookingsLabel}
                </Typography>
                <Grid container spacing={2}>
                  {bookingWhatsOn.map((item) => (
                    <Grid item xs={12} sm={6} md={3} key={`${item.kind}-${item.id}`}>
                      <WhatsOnCard
                        item={item}
                        currency={fallbackCurrency}
                        locale={locale}
                        showKind={false}
                        onOpen={() => navigate(whatsOnTarget(item))}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {registrationWhatsOn.length > 0 && (
              <Box>
                <Typography variant="h2" sx={{ fontSize: '1.125rem' }} gutterBottom>
                  {t('home.registrations')}
                </Typography>
                <Grid container spacing={2}>
                  {registrationWhatsOn.map((item) => (
                    <Grid item xs={12} sm={6} md={3} key={`${item.kind}-${item.id}`}>
                      <WhatsOnCard
                        item={item}
                        currency={fallbackCurrency}
                        locale={locale}
                        showKind={false}
                        onOpen={() => navigate(whatsOnTarget(item))}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {/*
              The shop last, and in its own row: a product is browsed rather
              than scheduled, and a thumbnail beside a date tile in the same row
              makes both harder to scan.
            */}
            {shopWhatsOn.length > 0 && (
              <Box>
                <Typography variant="h2" sx={{ fontSize: '1.125rem' }} gutterBottom>
                  {t('home.shop')}
                </Typography>
                <Grid container spacing={2}>
                  {shopWhatsOn.map((item) => (
                    <Grid item xs={12} sm={6} md={3} key={`${item.kind}-${item.id}`}>
                      <WhatsOnCard
                        item={item}
                        currency={fallbackCurrency}
                        locale={locale}
                        showKind={false}
                        onOpen={() => navigate(whatsOnTarget(item))}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {/*
              A club with nothing enabled and a member with nothing on: better
              to say so than to render a page of whitespace.
            */}
            {activeMemberships.length === 0 &&
              !dashboard.comingUp?.length &&
              !dashboard.cart &&
              dashboard.whatsOn.length === 0 && (
                <Card>
                  <CardContent>
                    <Typography color="text.secondary">{t('home.nothingYet')}</Typography>
                  </CardContent>
                </Card>
              )}
          </Stack>
        )
      )}
    </Container>
  );
};

export default HomePage;
