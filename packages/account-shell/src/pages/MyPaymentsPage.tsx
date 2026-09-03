import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  formatCurrency,
  formatDisplayDate,
  formatDisplayDateTime,
} from '@aws-web-framework/components';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { AccountPayment, AccountPaymentLine } from '../types/account';

/**
 * F1 and F2 — what the member has paid, and what each payment bought.
 *
 * **One screen, not two.** F2's detail is a payment's lines and their fees;
 * that is a handful of rows, so it expands in place rather than behind a
 * navigation. A receipt a member has to leave the list to read is a receipt
 * they read once.
 *
 * **The total is card plus offline.** A single order can be part card and part
 * cheque — the basket lets a member choose per item — so a payment has two
 * amounts and one total. `payments.amount` is the legacy column that predates
 * that split and is deliberately not used.
 *
 * A line that was paid for but produced nothing shows its reason. That is the
 * club's problem to fix, but a member who is told here does not find out at the
 * gate.
 */
/**
 * Where a payment line leads.
 *
 * Each kind goes to the closest thing the account app actually has. Entries and
 * merchandise have a record of their own to open; memberships, registrations
 * and bookings do not yet, so they go to the list that holds them — which still
 * answers "where did this money go", and is honest about how far the app can
 * take them.
 *
 * A merchandise order is addressed by its **payment**, not by the order row, so
 * that link is the only one not built from `fulfilmentRef`.
 *
 * Null where there is nothing to open: an unfulfilled line has produced no
 * record, and a link that goes nowhere is worse than no link.
 */
export function lineDestination(
  line: Pick<AccountPaymentLine, 'itemType' | 'fulfilmentRef'>,
  orgCode: string | null | undefined
): string | null {
  if (!orgCode) return null;

  switch (line.itemType) {
    case 'event_entry':
      return line.fulfilmentRef ? `/${orgCode}/entries/${line.fulfilmentRef}` : null;
    case 'merchandise':
      /*
       * The shop orders list, opened at this order.
       *
       * Not `/orders/:paymentId` — that route is the order **confirmation** for
       * a whole payment, so a four-line basket landed on "Order confirmed,
       * €184" when the member had clicked the hoodie. `?order=` names the one
       * they asked about, the way the events list takes `?event=`.
       */
      return line.fulfilmentRef
        ? `/${orgCode}/orders?order=${line.fulfilmentRef}`
        : `/${orgCode}/orders`;
    case 'membership':
      return line.fulfilmentRef ? `/${orgCode}/memberships` : null;
    case 'registration':
      return line.fulfilmentRef ? `/${orgCode}/registrations` : null;
    case 'booking':
      // Bookings share the entries screen; there is no page for one alone.
      return line.fulfilmentRef ? `/${orgCode}/entries` : null;
    default:
      return null;
  }
}

export const MyPaymentsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { orgCode, me } = useAccountOrganisation();
  const { execute } = useAccountApi<AccountPayment[]>();

  const [payments, setPayments] = useState<AccountPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fallbackCurrency = me?.organisation.currency ?? 'EUR';
  const locale = i18n.language;

  const load = useCallback(async () => {
    if (!orgCode) return;
    setLoading(true);
    setFailed(false);
    try {
      setPayments((await execute({ url: `/api/account/${orgCode}/payments` })) ?? []);
    } catch {
      setFailed(true);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [execute, orgCode]);

  useEffect(() => {
    void load();
  }, [load]);

  /** The four words a payment can be in, in the member's language. */
  const statusLabel = (payment: AccountPayment): string =>
    t(`payments.status.${payment.status}`, { defaultValue: payment.status });

  const statusColour = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    if (status === 'paid') return 'success';
    if (status === 'failed') return 'error';
    if (status === 'refunded') return 'default';
    // `partially_refunded` falls through to the amber below, which is right:
    // money has gone back and some of it has not, so it is neither settled nor
    // spent.
    return 'warning';
  };

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h1" gutterBottom>
        {t('payments.title')}
      </Typography>

      {failed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('payments.loadError')}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label={t('common.loading')} />
        </Box>
      ) : payments.length === 0 && !failed ? (
        <Card>
          <CardContent>
            <Typography>{t('payments.empty')}</Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {payments.map((payment) => {
            const currency = payment.currency || fallbackCurrency;

            return (
              <Card key={payment.id}>
                <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      spacing={1}
                      sx={{ width: '100%', pr: 1 }}
                    >
                      <Box>
                        <Typography variant="h2" sx={{ fontSize: '1.125rem' }}>
                          {formatCurrency(payment.total / 100, currency, locale)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {/*
                            The time as well as the date. Two payments on one
                            day are told apart by nothing else, and a member
                            checking a card statement against this needs the
                            hour.
                          */}
                          {formatDisplayDateTime(payment.paidOn ?? payment.createdAt, locale)}
                          {payment.lines.length > 0 &&
                            ` · ${t('payments.itemCount', { count: payment.lines.length })}`}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        color={statusColour(payment.status)}
                        label={statusLabel(payment)}
                      />
                    </Stack>
                  </AccordionSummary>

                  <AccordionDetails sx={{ pt: 0 }}>
                    <Divider sx={{ mb: 1.5 }} />

                    <Stack spacing={1}>
                      {payment.lines.map((line) => {
                        const destination = lineDestination(line, orgCode);

                        return (
                          <Box key={line.id}>
                            <Stack direction="row" justifyContent="space-between" spacing={2}>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2">{line.description}</Typography>

                                {/*
                                  Who it was for.
                                  
                                  The description says what was bought and is
                                  composed when the basket is filled, so four
                                  children entered in one class give four lines
                                  reading identically. The name comes off the
                                  record the line produced.
                                */}
                                {line.subjectName && (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {line.subjectName}
                                  </Typography>
                                )}

                                {/*
                                  Through to the thing itself.
                                  
                                  Only where there is something to open: a line
                                  that has not been fulfilled — an offline order
                                  the club has not recorded yet — has produced
                                  no record, and a link to nothing is worse than
                                  no link.
                                */}
                                {destination && (
                                  <Link
                                    component="button"
                                    type="button"
                                    variant="caption"
                                    underline="hover"
                                    onClick={() => navigate(destination)}
                                    sx={{ mt: 0.25 }}
                                  >
                                    {t(`payments.view.${line.itemType}`, {
                                      defaultValue: t('payments.view.default'),
                                    })}
                                  </Link>
                                )}
                              </Box>

                              <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                                  {formatCurrency(line.fee / 100, currency, locale)}
                                </Typography>
                                {/*
                                  This line's share of the fee, where it bears
                                  one. An item whose price already absorbs it
                                  shows nothing, which is the difference between
                                  "included" and "added on" made visible on the
                                  row it applies to.
                                */}
                                {line.handlingFee > 0 && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ whiteSpace: 'nowrap' }}
                                  >
                                    {t('payments.plusHandling', {
                                      amount: formatCurrency(
                                        line.handlingFee / 100,
                                        currency,
                                        locale
                                      ),
                                    })}
                                  </Typography>
                                )}
                              </Box>
                            </Stack>
                            {line.fulfilmentError && (
                              <Alert severity="warning" sx={{ mt: 0.5 }}>
                                {t('payments.lineProblem', { reason: line.fulfilmentError })}
                              </Alert>
                            )}
                          </Box>
                        );
                      })}

                      {/*
                        Subtotal, fee, total — only where a fee was actually
                        charged.
                        
                        Without it the lines add up to less than the figure at
                        the top and nothing explains the difference. With no
                        fee they would add up exactly, and three more rows
                        would just restate the total twice.

                        The subtotal is derived from the total rather than
                        summed from the lines, so the three figures always
                        reconcile even if a line is missing from the response.
                      */}
                      {payment.handlingFee > 0 && (
                        <>
                          <Divider />
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">
                              {t('payments.subtotal')}
                            </Typography>
                            <Typography variant="body2">
                              {formatCurrency(
                                (payment.total - payment.handlingFee) / 100,
                                currency,
                                locale
                              )}
                            </Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">
                              {t('payments.handlingFee')}
                            </Typography>
                            <Typography variant="body2">
                              {formatCurrency(payment.handlingFee / 100, currency, locale)}
                            </Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" fontWeight={600}>
                              {t('payments.total')}
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                              {formatCurrency(payment.total / 100, currency, locale)}
                            </Typography>
                          </Stack>
                        </>
                      )}

                      {/*
                        Split out only when it is genuinely split. On a
                        card-only order these two lines would just repeat the
                        total in smaller type.
                      */}
                      {payment.cardAmount > 0 && payment.offlineAmount > 0 && (
                        <>
                          <Divider />
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">
                              {t('payments.paidByCard')}
                            </Typography>
                            <Typography variant="body2">
                              {formatCurrency(payment.cardAmount / 100, currency, locale)}
                            </Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">
                              {t('payments.paidOffline')}
                            </Typography>
                            <Typography variant="body2">
                              {formatCurrency(payment.offlineAmount / 100, currency, locale)}
                            </Typography>
                          </Stack>
                        </>
                      )}

                      {payment.offlineAmount > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {payment.offlineReceivedAt
                            ? t('payments.offlineReceived', {
                                date: formatDisplayDate(payment.offlineReceivedAt, locale),
                              })
                            : t('payments.offlineAwaited')}
                        </Typography>
                      )}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              </Card>
            );
          })}
        </Stack>
      )}
    </Container>
  );
};

export default MyPaymentsPage;
