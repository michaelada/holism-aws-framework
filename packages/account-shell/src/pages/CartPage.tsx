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
  Accordion,
  AccordionDetails,
  AccordionSummary,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ApplicationFormDialog from '../components/ApplicationFormDialog';
import CartItemIcon from '../components/CartItemIcon';
import { HoldCountdown } from '../components/HoldCountdown';
import { formatCurrency, formatFormAnswer } from '@aws-web-framework/components';
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

  const [changing, setChanging] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

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

  const changePaymentMethod = async (itemId: string, paymentMethodId: string) => {
    if (!orgCode) return;
    setChanging(itemId);
    try {
      await executeMutate({
        method: 'PUT',
        url: `/api/account/${orgCode}/cart/items/${itemId}/payment-method`,
        data: { paymentMethodId },
      });
      /*
       * Reloaded rather than patched locally, for the same reason as removal:
       * the handling fee is charged on the card portion of the basket, so
       * moving one item between card and offline re-prices the rest.
       */
      await load();
    } finally {
      setChanging(null);
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
                    <CartItemIcon
                      itemType={item.itemType}
                      icon={item.icon}
                      colour={item.colour}
                    />

                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography>{item.description}</Typography>

                      {/*
                        Held lines carry their own clock. A member with a court
                        and a t-shirt in one basket needs to know which of the
                        two is on a timer, and a single warning at the top of
                        the page cannot say that.

                        Reloading on expiry is what turns the countdown into the
                        `HOLD_EXPIRED` warning above and disables checkout.
                      */}
                      {item.expiresAt && (
                        <HoldCountdown
                          expiresAt={item.expiresAt}
                          onExpire={load}
                          color={item.expired ? 'error.main' : 'warning.main'}
                        />
                      )}

                      {/*
                        A rule under the title, so the control below reads as a
                        separate thing rather than as a second line of the
                        item's name. Only drawn when there is a control to
                        separate — a line above nothing is just a line.
                      */}
                      {(item.availablePaymentMethods?.length ?? 0) > 1 && (
                        <Divider sx={{ my: 1 }} />
                      )}

                      {/*
                        The method is a control, not a label: the cart picks one
                        when the item is added — card where the item takes it —
                        and this is where the member changes their mind. A plain
                        line of text left them no way to.
                      */}
                      {(item.availablePaymentMethods?.length ?? 0) > 1 ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                          {/*
                            Labelled, because a bare drop-down beside a price
                            reads as part of the item rather than as something
                            the member may change.
                          */}
                          <Typography variant="body2" color="text.secondary">
                            {t('cart.changePaymentMethod')}
                          </Typography>
                          <Select
                            size="small"
                            variant="standard"
                            value={item.paymentMethodId}
                            disabled={changing === item.id}
                            onChange={(event) =>
                              changePaymentMethod(item.id, event.target.value as string)
                            }
                            inputProps={{
                              'aria-label': t('cart.paymentMethodFor', {
                                item: item.description,
                              }),
                            }}
                          >
                            {item.availablePaymentMethods!.map((method) => (
                              <MenuItem key={method.id} value={method.id}>
                                {method.displayName}
                              </MenuItem>
                            ))}
                          </Select>
                          {item.quantity > 1 && (
                            <Typography variant="body2" color="text.secondary">
                              {`· ×${item.quantity}`}
                            </Typography>
                          )}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {item.paymentMethodDisplayName}
                          {item.quantity > 1 && ` · ×${item.quantity}`}
                        </Typography>
                      )}

                      {/*
                        What the member filled in, where they can still change
                        it. Between the form and the club receiving the entry
                        this is their only sight of it, and a mistyped pony name
                        or the wrong age group is otherwise found by the club
                        rather than by them.
                      */}
                      {(item.formSummary?.length ?? 0) > 0 && (
                        <Accordion
                          disableGutters
                          elevation={0}
                          sx={{ mt: 1, '&:before': { display: 'none' }, bgcolor: 'transparent' }}
                        >
                          <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            sx={{ px: 0, minHeight: 0, '& .MuiAccordionSummary-content': { my: 0.5 } }}
                          >
                            <Typography variant="body2" color="text.secondary">
                              {t('cart.yourAnswers', { count: item.formSummary!.length })}
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails sx={{ px: 0, pt: 0 }}>
                            <Stack spacing={0.25} sx={{ mb: 1 }}>
                              {item.formSummary!.map((answer) => (
                                <Typography key={answer.label} variant="body2">
                                  <Box component="span" color="text.secondary">
                                    {answer.label}:{' '}
                                  </Box>
                                  {formatFormAnswer(answer, locale)}
                                </Typography>
                              ))}
                            </Stack>
                            {item.formSubmissionId && (
                              <Button
                                size="small"
                                startIcon={<EditIcon />}
                                onClick={() => setEditing(item.formSubmissionId)}
                              >
                                {t('cart.editAnswers')}
                              </Button>
                            )}
                          </AccordionDetails>
                        </Accordion>
                      )}
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
                {totals!.offlineSubtotal > 0 && totals!.chargedToCardNow > 0 && (
                  /*
                   * Shown only when the two figures differ *and* there is
                   * something to pay now. Confusing them is how a member
                   * believes they have paid the club in full — but a basket
                   * that is entirely offline has nothing to charge, and
                   * "Paying now by card: €0.00" is a line that answers a
                   * question nobody asked.
                   */
                  <TotalRow
                    label={t('cart.payingNow')}
                    value={formatCurrency(totals!.chargedToCardNow / 100, currency, locale)}
                  />
                )}
              </Stack>

              {totals!.offlineSubtotal > 0 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {/*
                    "Part of this order" is only true when part of it is not.
                    A basket paid entirely offline told the member something
                    about a card payment that was never going to happen, which
                    invites them to go looking for it.
                  */}
                  {totals!.chargedToCardNow > 0
                    ? t('cart.offlineNote')
                    : t('cart.offlineNoteAll')}
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
      {editing && (
        <ApplicationFormDialog
          open
          submissionId={editing}
          /* Read from the submission when editing; unused on this path. */
          formId=""
          contextId=""
          submissionType="event_entry"
          title={t('cart.editAnswersTitle')}
          onCancel={() => setEditing(null)}
          onSubmitted={async () => {
            setEditing(null);
            // Re-read so the summary shows what was just corrected.
            await load();
          }}
        />
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
