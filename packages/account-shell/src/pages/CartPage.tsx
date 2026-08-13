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
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { formatCurrency } from '@aws-web-framework/components';
import { useAccountApi } from '../hooks/useAccountApi';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { CartView } from '../types/account';

/**
 * F1 — the basket.
 *
 * Every figure shown here comes from the server's own calculation. Nothing is
 * added up in the browser: the handling fee depends on which items are being
 * paid by card, on the organisation type's fee configuration and on tax, and a
 * second implementation of that arithmetic would eventually disagree with the
 * one that takes the money.
 *
 * The fee is shown as its own line rather than folded into the total, because a
 * member who sees a figure they did not expect at the card form abandons the
 * basket.
 */
export const CartPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { orgCode } = useAccountOrganisation();
  const online = useOnlineStatus();
  const { execute } = useAccountApi<CartView>();
  const { execute: executeMutate } = useAccountApi<unknown>();

  const [cart, setCart] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const locale = i18n.language;

  const load = useCallback(async () => {
    if (!orgCode) return;
    setLoading(true);
    setFailed(false);
    try {
      setCart(await execute({ url: `/api/account/${orgCode}/cart` }));
    } catch {
      setFailed(true);
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, [execute, orgCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const removeItem = async (itemId: string) => {
    if (!orgCode) return;
    setRemoving(itemId);
    try {
      await executeMutate({
        method: 'DELETE',
        url: `/api/account/${orgCode}/cart/items/${itemId}`,
      });
      // Reloaded rather than spliced locally: removing an item changes the
      // handling fee for everything else in the basket.
      await load();
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 10, textAlign: 'center' }}>
        <CircularProgress aria-label={t('common.loading')} />
      </Container>
    );
  }

  const currency = cart?.currency;
  const totals = cart?.totals;
  const empty = !cart || cart.items.length === 0;

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h1" gutterBottom>
        {t('cart.title')}
      </Typography>

      {failed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('cart.loadError')}
        </Alert>
      )}

      {/*
        A lapsed hold means the place is no longer reserved. Checkout refuses in
        this state, so the basket has to say why rather than letting the member
        press Pay and be told no.
      */}
      {cart?.warnings?.some((warning) => warning.code === 'HOLD_EXPIRED') && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('cart.holdExpired')}
        </Alert>
      )}

      {empty ? (
        !failed && (
          <Stack spacing={2} sx={{ py: 4 }}>
            <Typography>{t('cart.empty')}</Typography>
            <Box>
              <Button variant="contained" onClick={() => navigate(`/${orgCode}/browse`)}>
                {t('cart.browse')}
              </Button>
            </Box>
          </Stack>
        )
      ) : (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Stack divider={<Divider />} spacing={1}>
                {cart!.items.map((item) => (
                  <Stack
                    key={item.id}
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    sx={{ py: 1 }}
                  >
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography>{item.description}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.paymentMethodDisplayName}
                        {item.quantity > 1 && ` · ×${item.quantity}`}
                      </Typography>
                    </Box>
                    <Typography>{formatCurrency(item.fee / 100, currency, locale)}</Typography>
                    <IconButton
                      aria-label={t('cart.remove', { item: item.description })}
                      onClick={() => removeItem(item.id)}
                      disabled={removing === item.id}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={1}>
                {totals!.offlineSubtotal > 0 && (
                  <TotalRow
                    label={t('cart.offlineSubtotal')}
                    value={formatCurrency(totals!.offlineSubtotal / 100, currency, locale)}
                  />
                )}
                {totals!.cardSubtotal > 0 && (
                  <TotalRow
                    label={t('cart.cardSubtotal')}
                    value={formatCurrency(totals!.cardSubtotal / 100, currency, locale)}
                  />
                )}
                {totals!.handlingFee.net > 0 && (
                  <TotalRow
                    label={t('cart.handlingFee')}
                    value={formatCurrency(totals!.handlingFee.net / 100, currency, locale)}
                  />
                )}
                {totals!.handlingFee.tax > 0 && (
                  <TotalRow
                    label={t('cart.handlingFeeTax')}
                    value={formatCurrency(totals!.handlingFee.tax / 100, currency, locale)}
                  />
                )}

                <Divider sx={{ my: 1 }} />

                <TotalRow
                  strong
                  label={t('cart.orderTotal')}
                  value={formatCurrency(totals!.orderTotal / 100, currency, locale)}
                />
                {totals!.offlineSubtotal > 0 && (
                  // The two figures differ whenever anything is being paid
                  // offline, and confusing them is how a member believes they
                  // have paid the club in full.
                  <TotalRow
                    label={t('cart.payingNow')}
                    value={formatCurrency(totals!.chargedToCardNow / 100, currency, locale)}
                  />
                )}
              </Stack>

              {totals!.offlineSubtotal > 0 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {t('cart.offlineNote')}
                </Alert>
              )}

              <Button
                variant="contained"
                size="large"
                fullWidth
                sx={{ mt: 3 }}
                disabled={!online}
                onClick={() => navigate(`/${orgCode}/checkout`)}
              >
                {t('cart.checkout')}
              </Button>
              {/*
                Stopped here rather than at the payment step: checkout takes a
                member through a provider and a webhook, and beginning that with
                no connection wastes their time at the worst moment.
              */}
              {!online && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  textAlign="center"
                  sx={{ mt: 1 }}
                >
                  {t('offline.actionBlocked')}
                </Typography>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Container>
  );
};

const TotalRow: React.FC<{ label: string; value: string; strong?: boolean }> = ({
  label,
  value,
  strong,
}) => (
  <Stack direction="row" justifyContent="space-between">
    <Typography fontWeight={strong ? 700 : 400}>{label}</Typography>
    <Typography fontWeight={strong ? 700 : 400}>{value}</Typography>
  </Stack>
);

export default CartPage;
