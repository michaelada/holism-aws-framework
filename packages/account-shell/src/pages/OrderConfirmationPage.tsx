import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { formatCurrency } from '@aws-web-framework/components';
import { useAccountApi, AccountApiError } from '../hooks/useAccountApi';
import { notifyIfSettled } from '../cart/cartActivity';
import { PaymentStatus } from '../types/account';

/**
 * F3 — the order's outcome.
 *
 * Shows the payment's real server-side status rather than assuming success,
 * and re-checks while it is still pending. A member arriving here from checkout
 * may beat the webhook by a second or two, and the honest thing is to say
 * "confirming" rather than to show a receipt for an order that is not placed.
 */
const POLL_INTERVAL_MS = 2000;
const POLL_ATTEMPTS = 10;

export const OrderConfirmationPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { orgCode, paymentId } = useParams<{ orgCode: string; paymentId: string }>();
  const { execute } = useAccountApi<PaymentStatus>();

  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const load = useCallback(async () => {
    if (!orgCode || !paymentId) return;
    try {
      const status = await execute({ url: `/api/account/${orgCode}/payments/${paymentId}` });
      setPayment(status);
      setNotFound(false);
      /*
       * Also announced here, and not only from the checkout screen, because the
       * confirmation can arrive after that screen gave up waiting — and because
       * a member can reach this page directly, returning from a bank's 3-D
       * Secure step or opening the link again later.
       */
      notifyIfSettled(status?.status);
    } catch (error) {
      if (error instanceof AccountApiError && error.status === 404) setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [execute, orgCode, paymentId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Keep checking while the payment is pending, for a bounded number of tries.
   *
   * Polling forever would hammer the API for an order that may have genuinely
   * failed upstream; stopping leaves the member with an accurate "still
   * confirming" and a way to refresh.
   */
  useEffect(() => {
    if (!payment || payment.status !== 'pending' || attempts >= POLL_ATTEMPTS) return;

    const timer = setTimeout(() => {
      setAttempts((count) => count + 1);
      void load();
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [payment, attempts, load]);

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
        <CircularProgress aria-label={t('common.loading')} />
      </Container>
    );
  }

  if (notFound || !payment) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 3, md: 5 } }}>
        <Alert severity="warning">{t('order.notFound')}</Alert>
      </Container>
    );
  }

  const paid = payment.status === 'paid';
  const failed = payment.status === 'failed';
  const awaitingOffline = payment.status === 'awaiting_offline';
  const pending = payment.status === 'pending';

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, md: 5 } }}>
      <Paper sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={2}>
          {paid && (
            <Stack direction="row" spacing={1} alignItems="center">
              <CheckCircleIcon color="success" />
              <Typography variant="h1">{t('order.paidTitle')}</Typography>
            </Stack>
          )}
          {awaitingOffline && <Typography variant="h1">{t('order.offlineTitle')}</Typography>}
          {pending && <Typography variant="h1">{t('order.pendingTitle')}</Typography>}
          {failed && <Typography variant="h1">{t('order.failedTitle')}</Typography>}

          {paid && <Typography color="text.secondary">{t('order.paidBody')}</Typography>}
          {awaitingOffline && (
            <Typography color="text.secondary">{t('order.offlineBody')}</Typography>
          )}
          {pending && (
            <Alert severity="info">{t('order.pendingBody')}</Alert>
          )}
          {failed && (
            <Alert severity="error">
              {payment.failureMessage || t('order.failedBody')}
            </Alert>
          )}

          <Divider />

          {payment.amount > 0 && (
            <Stack direction="row" justifyContent="space-between">
              <Typography>{t('order.paidByCard')}</Typography>
              <Typography>
                {formatCurrency(payment.amount / 100, payment.currency, i18n.language)}
              </Typography>
            </Stack>
          )}
          {payment.offlineAmount > 0 && (
            <Stack direction="row" justifyContent="space-between">
              <Typography>{t('order.dueToClub')}</Typography>
              <Typography>
                {formatCurrency(payment.offlineAmount / 100, payment.currency, i18n.language)}
              </Typography>
            </Stack>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ pt: 2 }}>
            {failed ? (
              <Button variant="contained" onClick={() => navigate(`/${orgCode}/cart`)}>
                {t('order.tryAgain')}
              </Button>
            ) : (
              <Button variant="contained" onClick={() => navigate(`/${orgCode}/entries`)}>
                {t('order.viewEntries')}
              </Button>
            )}
            <Button onClick={() => navigate(`/${orgCode}`)}>{t('order.home')}</Button>
          </Stack>
        </Stack>
      </Paper>
    </Container>
  );
};

export default OrderConfirmationPage;
