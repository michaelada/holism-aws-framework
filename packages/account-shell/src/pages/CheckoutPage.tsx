import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { formatCurrency } from '@aws-web-framework/components';
import { useAccountApi, AccountApiError } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { CheckoutResult, PaymentStatus } from '../types/account';

/**
 * F2 — payment.
 *
 * Two things about the flow are worth stating, because both are easy to get
 * subtly wrong.
 *
 * **The client's success is not the order's success.** Stripe tells the browser
 * the card was accepted, but the order is only placed when the webhook has been
 * processed server-side. So on success this screen **polls the payment's
 * status** rather than declaring victory: a member who is told "confirmed" and
 * then finds no entry has been given a false receipt.
 *
 * **Stripe's publishable key is the platform's, not the club's.** Charges are
 * Connect destination charges made on the platform account, so the browser
 * loads the platform key and the connected account never appears here.
 */

/** Loaded once per page load; `loadStripe` is memoised by Stripe itself. */
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');
  }
  return stripePromise;
}

export const CheckoutPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { orgCode } = useAccountOrganisation();
  const { execute } = useAccountApi<CheckoutResult>();

  const [checkout, setCheckout] = useState<CheckoutResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Started once. `startCheckout` is idempotent server-side — an in-flight
   * payment is reused — but starting it repeatedly would still churn.
   */
  const started = useRef(false);

  const start = useCallback(async () => {
    if (!orgCode || started.current) return;
    started.current = true;

    try {
      const result = await execute({
        method: 'POST',
        url: `/api/account/${orgCode}/checkout`,
      });
      setCheckout(result);

      if (result.completed) {
        navigate(`/${orgCode}/orders/${result.paymentId}`, { replace: true });
      }
    } catch (err) {
      setError(
        err instanceof AccountApiError ? err.message : t('checkout.startFailed')
      );
    } finally {
      setLoading(false);
    }
  }, [execute, orgCode, navigate, t]);

  useEffect(() => {
    void start();
  }, [start]);

  const options = useMemo(
    () => (checkout?.clientSecret ? { clientSecret: checkout.clientSecret } : null),
    [checkout?.clientSecret]
  );

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
        <CircularProgress aria-label={t('common.loading')} />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 3, md: 5 } }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="outlined" onClick={() => navigate(`/${orgCode}/cart`)}>
          {t('checkout.backToBasket')}
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h1" gutterBottom>
        {t('checkout.title')}
      </Typography>

      {checkout && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack spacing={1}>
              {checkout.offlineAmount > 0 && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography>{t('checkout.payingToClub')}</Typography>
                  <Typography>
                    {formatCurrency(
                      checkout.offlineAmount / 100,
                      checkout.currency,
                      i18n.language
                    )}
                  </Typography>
                </Stack>
              )}
              {checkout.handlingFee > 0 && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography>{t('cart.handlingFee')}</Typography>
                  <Typography>
                    {formatCurrency(
                      checkout.handlingFee / 100,
                      checkout.currency,
                      i18n.language
                    )}
                  </Typography>
                </Stack>
              )}
              <Divider />
              <Stack direction="row" justifyContent="space-between">
                <Typography fontWeight={700}>{t('checkout.payingNow')}</Typography>
                <Typography fontWeight={700}>
                  {formatCurrency(checkout.amountDue / 100, checkout.currency, i18n.language)}
                </Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {options && (
        <Elements stripe={getStripe()} options={options}>
          <PaymentForm paymentId={checkout!.paymentId} orgCode={orgCode!} />
        </Elements>
      )}
    </Container>
  );
};

/**
 * The card form. Separate because `useStripe`/`useElements` only work inside
 * `<Elements>`.
 */
const PaymentForm: React.FC<{ paymentId: string; orgCode: string }> = ({
  paymentId,
  orgCode,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();
  const { execute } = useAccountApi<PaymentStatus>();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  /**
   * Wait for the webhook to land.
   *
   * Stripe having accepted the card is not the same as the order existing. The
   * webhook is usually a second or two behind, so the member is held here with
   * an explicit "confirming" state rather than being shown a receipt for an
   * order that has not been placed.
   *
   * It gives up after a bounded wait and sends them to the order page anyway —
   * which shows the real status — because an indefinite spinner is worse than
   * a page saying "still confirming".
   */
  const waitForConfirmation = useCallback(async () => {
    const deadline = Date.now() + 20_000;

    while (Date.now() < deadline) {
      try {
        const status = await execute({
          url: `/api/account/${orgCode}/payments/${paymentId}`,
        });
        if (status.status === 'paid' || status.status === 'failed') return;
      } catch {
        // Transient — keep waiting rather than failing the whole checkout.
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }, [execute, orgCode, paymentId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (result.error) {
      setError(result.error.message || t('checkout.paymentFailed'));
      setSubmitting(false);
      return;
    }

    setAwaitingConfirmation(true);
    await waitForConfirmation();
    navigate(`/${orgCode}/orders/${paymentId}`, { replace: true });
  };

  return (
    <Box component="form" onSubmit={submit}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <PaymentElement />

      {awaitingConfirmation && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t('checkout.confirming')}
        </Alert>
      )}

      <Button
        type="submit"
        variant="contained"
        size="large"
        fullWidth
        sx={{ mt: 3 }}
        disabled={!stripe || submitting}
      >
        {submitting ? t('checkout.processing') : t('checkout.pay')}
      </Button>
    </Box>
  );
};

export default CheckoutPage;
