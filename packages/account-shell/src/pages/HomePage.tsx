import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
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
  const otherWhatsOn =
    dashboard?.whatsOn.filter(
      (item) => item.kind !== 'calendar' && item.kind !== 'merchandise'
    ) ?? [];

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

              {dashboard.cart && (
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h2" sx={{ fontSize: '1.125rem' }} gutterBottom>
                        {t('home.cart')}
                      </Typography>
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
                      <Button
                        size="small"
                        variant="contained"
                        sx={{ mt: 2 }}
                        onClick={() => navigate(`/${orgCode}/cart`)}
                      >
                        {t('home.goToCart')}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {dashboard.recentPayments && (
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h2" sx={{ fontSize: '1.125rem' }} gutterBottom>
                        {t('home.recentPayments')}
                      </Typography>
                      <Stack spacing={1}>
                        {dashboard.recentPayments.map((payment) => (
                          <Stack
                            key={payment.id}
                            direction="row"
                            justifyContent="space-between"
                            spacing={1}
                          >
                            <Typography variant="body2" color="text.secondary">
                              {formatDisplayDate(payment.on, locale)}
                            </Typography>
                            <Typography variant="body2">
                              {formatCurrency(
                                payment.total / 100,
                                payment.currency || fallbackCurrency,
                                locale
                              )}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                      <Button
                        size="small"
                        sx={{ mt: 2 }}
                        onClick={() => navigate(`/${orgCode}/payments`)}
                      >
                        {t('home.allPayments')}
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
              Memberships first among the rows: they are the thing a member
              already holds, where everything below is something they might
              take up. Absent entirely when there are none — a club with
              memberships the member has not joined gets no empty heading.
            */}
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

            {otherWhatsOn.length > 0 && (
              <Box>
                <Typography variant="h2" sx={{ fontSize: '1.125rem' }} gutterBottom>
                  {t('home.whatsOn')}
                </Typography>
                <Grid container spacing={2}>
                  {otherWhatsOn.map((item) => (
                    <Grid item xs={12} sm={6} md={3} key={`${item.kind}-${item.id}`}>
                      <WhatsOnCard
                        item={item}
                        currency={fallbackCurrency}
                        locale={locale}
                        onOpen={() => navigate(whatsOnTarget(item))}
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
              !dashboard.recentPayments &&
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
