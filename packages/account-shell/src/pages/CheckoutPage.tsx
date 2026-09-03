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
import { formatCurrency } from '@itsplainsailing/components';
import { HoldCountdown } from '../components/HoldCountdown';
import { useAccountApi, AccountApiError } from '../hooks/useAccountApi';
import { notifyIfSettled } from '../cart/cartActivity';
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

/**
 * Stripe.js, loaded once per key.
 *
 * The key comes from the API, which reads it beside the secret key it already
 * holds. It used to come from this app's own `VITE_STRIPE_PUBLISHABLE_KEY` —
 * which is still honoured as a fallback, but was not set in this repo, so
 * `loadStripe('')` rejected, `useStripe()` stayed null, and the Pay button was
 * disabled for ever with nothing on screen to say why.
 *
 * Cached by key rather than as a single promise: the fallback and the served
 * key can differ, and a cache that ignored that would keep whichever loaded
 * first.
 */
const stripeByKey = new Map<string, Promise<Stripe | null>>();

function getStripe(publishableKey: string): Promise<Stripe | null> {
  let promise = stripeByKey.get(publishableKey);
  if (!promise) {
    promise = loadStripe(publishableKey);
    stripeByKey.set(publishableKey, promise);
  }
  return promise;
}

/** The key to mount the card form with, or null when there is none to be had. */
const publishableKeyFor = (checkout: CheckoutResult | null): string | null =>
  checkout?.publishableKey || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || null;

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

      {/*
        A card charge is due but the platform has no publishable key, so the
        form cannot be mounted at all. Said plainly: a disabled Pay button with
        no explanation is indistinguishable from a bug in the member's browser,
        and this is the club's configuration, not their card.
      */}
      {options && !publishableKeyFor(checkout) && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('checkout.cardUnavailable')}
        </Alert>
      )}

      {options && publishableKeyFor(checkout) && (
        <Elements stripe={getStripe(publishableKeyFor(checkout)!)} options={options}>
          <PaymentForm
            paymentId={checkout!.paymentId}
            orgCode={orgCode!}
            holdExpiresAt={checkout!.holdExpiresAt}
          />
        </Elements>
      )}
    </Container>
  );
};

/**
 * The card form. Separate because `useStripe`/`useElements` only work inside
 * `<Elements>`.
 */
const PaymentForm: React.FC<{
  paymentId: string;
  orgCode: string;
  /** When the hold behind this order lapses; null when it holds nothing. */
  holdExpiresAt: string | null;
}> = ({ paymentId, orgCode, holdExpiresAt }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();
  const { execute } = useAccountApi<PaymentStatus>();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [holdLapsed, setHoldLapsed] = useState(false);

  /**
   * The hold ran out while the member was on this screen.
   *
   * Two things happen, and both matter. The form is closed, so they cannot
   * start a payment for something they no longer hold. And the server is asked
   * to cancel the payment intent, which is what makes the expiry bite: without
   * it the client secret in this tab stays valid, and a laptop woken an hour
   * later could still pay for a slot that has since gone to somebody else.
   *
   * Deliberately not awaited into the UI. The member is told immediately; the
   * cancellation is a tidy-up whose guarantees live on the server, where the
   * capture-time re-check refuses the order regardless.
   */
  const abandon = useCallback(() => {
    if (submitting) return;

    setHoldLapsed(true);
    void execute({
      url: `/api/account/${orgCode}/checkout/${paymentId}/abandon`,
      method: 'POST',
    }).catch(() => {
      // Already failed, already paid, or the network went. The member has been
      // told; there is nothing useful to say about a best-effort tidy-up.
    });
  }, [execute, orgCode, paymentId, submitting]);

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
        if (status.status === 'paid' || status.status === 'failed') {
          // The basket emptied server-side while this was polling; the badge in
          // the navigation has no other way to hear about it.
          notifyIfSettled(status.status);
          return;
        }
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

      {/*
        The clock the member is racing, on the screen where they are racing it.
        Without this the countdown lives only on the basket page — which is the
        one screen they are not looking at while they type their card number.

        Hidden once they have submitted: the hold is no longer what decides the
        outcome at that point, and a timer ticking down beside "processing"
        reads as a threat to a payment already in flight.
      */}
      {holdExpiresAt && !submitting && !awaitingConfirmation && (
        <Alert severity={holdLapsed ? 'warning' : 'info'} sx={{ mb: 2 }}>
          {holdLapsed ? (
            t('checkout.holdLapsed')
          ) : (
            <Stack direction="row" spacing={1} alignItems="baseline">
              <span>{t('checkout.holdNotice')}</span>
              <HoldCountdown expiresAt={holdExpiresAt} onExpire={abandon} variant="body2" />
            </Stack>
          )}
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
        disabled={!stripe || submitting || holdLapsed}
      >
        {submitting ? t('checkout.processing') : t('checkout.pay')}
      </Button>

      {holdLapsed && (
        <Button fullWidth sx={{ mt: 1 }} onClick={() => navigate(`/${orgCode}/cart`)}>
          {t('checkout.backToBasket')}
        </Button>
      )}
    </Box>
  );
};

export default CheckoutPage;
