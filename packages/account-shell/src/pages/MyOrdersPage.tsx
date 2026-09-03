import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { formatCurrency, formatDisplayDate } from '@aws-web-framework/components';
import ActivityStatusChip from '../components/ActivityStatusChip';
import { useAccountApi } from '../hooks/useAccountApi';
import { useSearchParams } from 'react-router-dom';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { AccountMerchandiseOrder } from '../types/account';

/**
 * C8 — what the member has ordered from the shop.
 *
 * Two statuses are shown, because they answer different questions and a club
 * genuinely uses both. `ActivityStatusChip` carries the shared vocabulary —
 * awaiting payment, confirmed, cancelled — which is about *the money*. The
 * club's own order status is about *the goods*: pending, processing, ready for
 * collection. A member wants "have I paid?" and "can I collect it?" and one
 * chip cannot say both.
 *
 * There is no detail screen. An order is its options, its quantity and its
 * price — all of which fit on the card — so a second page would be one more
 * click to see the same six facts.
 */
export const MyOrdersPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { orgCode, me } = useAccountOrganisation();

  /**
   * The order a member arrived for, named in the URL.
   *
   * A payment's detail links here as `?order={id}` — the shop has no page for
   * one order, so this is the list opened at the right card. Without it a
   * four-line basket sent them to a page of orders with nothing marking the one
   * they clicked, which is the same failure the events list had.
   */
  const [searchParams] = useSearchParams();
  const requestedOrder = searchParams.get('order');
  const { execute } = useAccountApi<AccountMerchandiseOrder[]>();

  const [orders, setOrders] = useState<AccountMerchandiseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const currency = me?.organisation.currency ?? 'EUR';
  const locale = i18n.language;

  const load = useCallback(async () => {
    if (!orgCode) return;
    setLoading(true);
    setFailed(false);
    try {
      setOrders((await execute({ url: `/api/account/${orgCode}/orders` })) ?? []);
    } catch {
      setFailed(true);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [execute, orgCode]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * Scroll to it once the orders are in, then take the parameter out of the
   * URL — it has been consumed, and leaving it would re-scroll on every
   * re-render. The outline stays, because that is what marks the card.
   */
  useEffect(() => {
    if (!requestedOrder || orders.length === 0) return;
    if (!orders.some((order) => order.id === requestedOrder)) return;

    document
      .getElementById(`order-${requestedOrder}`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [requestedOrder, orders]);

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h1" gutterBottom>
        {t('orders.title')}
      </Typography>

      {failed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('orders.loadError')}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label={t('common.loading')} />
        </Box>
      ) : orders.length === 0 && !failed ? (
        <Card>
          <CardContent>
            <Typography gutterBottom>{t('orders.empty')}</Typography>
            <Button variant="contained" onClick={() => navigate(`/${orgCode}/shop`)} sx={{ mt: 1 }}>
              {t('orders.visitShop')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {orders.map((order) => (
            <Card
              key={order.id}
              id={`order-${order.id}`}
              /*
                Marked, not just scrolled to: a card halfway down a list is
                found by the scroll and then lost again the moment the member
                looks away from where the page landed.
              */
              sx={
                order.id === requestedOrder
                  ? { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 }
                  : undefined
              }
            >
              <CardContent>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  spacing={1}
                >
                  <Box>
                    <Typography variant="h2" sx={{ fontSize: '1.125rem' }}>
                      {order.itemName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('orders.placedOn', {
                        date: formatDisplayDate(order.orderDate, locale),
                      })}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ActivityStatusChip status={order.status} />
                    {order.orderStatus && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`orders.status.${order.orderStatus}`, {
                          defaultValue: order.orderStatus,
                        })}
                      />
                    )}
                  </Stack>
                </Stack>

                <Divider sx={{ my: 1.5 }} />

                <Stack spacing={0.5}>
                  {Object.entries(order.options).map(([name, value]) => (
                    <Typography key={name} variant="body2">
                      <Box component="span" color="text.secondary">
                        {name}:{' '}
                      </Box>
                      {value}
                    </Typography>
                  ))}

                  <Typography variant="body2">
                    <Box component="span" color="text.secondary">
                      {t('orders.quantity')}:{' '}
                    </Box>
                    {order.quantity}
                  </Typography>

                  {order.deliveryFee > 0 && (
                    <Typography variant="body2">
                      <Box component="span" color="text.secondary">
                        {t('orders.delivery')}:{' '}
                      </Box>
                      {formatCurrency(order.deliveryFee / 100, currency, locale)}
                    </Typography>
                  )}

                  <Typography variant="h6" sx={{ pt: 0.5 }}>
                    {formatCurrency(order.totalPrice / 100, currency, locale)}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Container>
  );
};

export default MyOrdersPage;
