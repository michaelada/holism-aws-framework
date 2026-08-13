import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
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
              The renewal banner leads the page because it is the only thing
              here with a deadline. It uses the same rule as C4 — including the
              case where renewal is due but the club has nothing open yet, which
              gets a note rather than a button that goes nowhere.
            */}
            {dashboard.membership?.canRenew && (
              <Alert
                severity="warning"
                action={
                  <Button
                    size="small"
                    onClick={() => navigate(`/${orgCode}/browse/memberships`)}
                  >
                    {t('home.renew')}
                  </Button>
                }
              >
                {t('home.expiringSoon', {
                  name: dashboard.membership.name,
                  count: dashboard.membership.daysRemaining ?? 0,
                  date: formatDisplayDate(dashboard.membership.validUntil, locale),
                })}
              </Alert>
            )}
            {dashboard.membership?.renewalNotOpen && (
              <Alert severity="info">{t('home.renewalNotOpen')}</Alert>
            )}

            <Grid container spacing={3}>
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

              {dashboard.membership && (
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h2" sx={{ fontSize: '1.125rem' }} gutterBottom>
                        {t('home.membership')}
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {dashboard.membership.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('home.membershipUntil', {
                          date: formatDisplayDate(dashboard.membership.validUntil, locale),
                        })}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('home.membershipNumber', {
                          number: dashboard.membership.membershipNumber,
                        })}
                      </Typography>
                      <Button
                        size="small"
                        sx={{ mt: 2 }}
                        onClick={() => navigate(`/${orgCode}/memberships`)}
                      >
                        {t('home.viewMemberships')}
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
              Only things the member can actually act on — the catalogues return
              unavailable rows with reasons, which is right on a listing page and
              wrong on a teaser.
            */}
            {dashboard.whatsOn.length > 0 && (
              <Box>
                <Typography variant="h2" sx={{ fontSize: '1.125rem' }} gutterBottom>
                  {t('home.whatsOn')}
                </Typography>
                <Grid container spacing={2}>
                  {dashboard.whatsOn.map((item) => (
                    <Grid item xs={12} sm={6} md={3} key={`${item.kind}-${item.id}`}>
                      <Card sx={{ height: '100%' }}>
                        <CardActionArea
                          onClick={() => navigate(whatsOnTarget(item))}
                          sx={{ height: '100%', alignItems: 'stretch' }}
                        >
                          <CardContent>
                            <Typography variant="caption" color="text.secondary">
                              {t(`home.kind.${item.kind}`)}
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                              {item.title}
                            </Typography>
                            {item.fee !== null && (
                              <Typography variant="body2" color="text.secondary">
                                {item.fee > 0
                                  ? formatCurrency(item.fee / 100, fallbackCurrency, locale)
                                  : t('home.free')}
                              </Typography>
                            )}
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {/*
              A club with nothing enabled and a member with nothing on: better
              to say so than to render a page of whitespace.
            */}
            {!dashboard.membership &&
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
