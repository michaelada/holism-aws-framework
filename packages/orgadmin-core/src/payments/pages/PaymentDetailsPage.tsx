/**
 * Payment Details Page
 * 
 * Shows full payment details including related transaction information
 * Provides refund functionality with confirmation dialog
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useCurrency } from '../../hooks/useCurrency';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
  Link,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Undo as RefundIcon,
  Undo as UndoIcon,
  PriceCheck as ReceivedIcon,
} from '@mui/icons-material';
import { useApi } from '../../hooks/useApi';
import RefundDialog, { RefundRequest } from '../components/RefundDialog';
import { SortableTableCell } from '../../components';
import { useTableSort } from '../../hooks/useTableSort';
import { useTranslation } from '@itsplainsailing/orgadmin-shell/hooks/useTranslation';
import { formatDateTime } from '@itsplainsailing/orgadmin-shell/utils/dateFormatting';
import { useLocale } from '@itsplainsailing/orgadmin-shell/context/LocaleContext';

/**
 * A payment, named the way the API names one.
 *
 * This described fields the endpoint has never returned — `date`, `status`,
 * `type`, `customerName`, and a `relatedTransaction` object that was
 * dereferenced without a guard and would have blanked the page the moment it
 * loaded. A hand-written interface over an untyped response is an assertion,
 * not a check, and nothing failed until somebody opened the screen.
 */
interface Payment {
  id: string;
  /** Set when the money moved. Null on a payment still owed. */
  paymentDate: string | null;
  createdAt: string;
  updatedAt: string;
  amount: number;
  currency: string;
  paymentStatus: string;
  paymentType: string;
  paymentMethod: string;
  paymentProvider: string | null;
  /** The provider's own reference — a Stripe payment intent, typically. */
  providerTransactionId: string | null;
  /** What the payment was for, where it is about a single thing. */
  contextId: string | null;
  userName: string | null;
  userEmail: string | null;
  /** The handling fee added on, in minor units. Zero where it was included. */
  handlingFee?: number;
  /** When an offline payment was recorded as received. Null until it is. */
  offlineReceivedAt?: string | null;
  /** What the payment bought. Empty for a payment raised with no lines. */
  lines: PaymentLine[];
  /** Money that went back, most recent first. */
  refunds: RefundRecord[];
  /** How an offline settlement got where it is, oldest first. */
  settlement: SettlementEvent[];
}

/** One refund recorded against this payment. */
interface RefundRecord {
  id: string;
  refundAmount: number;
  refundReason: string | null;
  refundStatus: string;
  refundDate: string | null;
  requestedAt: string;
  requestedByName: string | null;
  requestedByEmail: string | null;
  /** How the amount was arrived at: `full`, `lessHandlingFee`, `items`, `amount`. */
  refundScope: string;
  /** The items it covered. Empty for every scope but `items`. */
  items: Array<{ lineId: string; description: string; amount: number }>;
}

/** One act on an offline settlement: recorded as received, or undone. */
interface SettlementEvent {
  occurredAt: string;
  kind: 'received' | 'undone';
  actorName: string | null;
  actorEmail: string | null;
  itemsCreated: number | null;
  itemsFailed: number | null;
}

/** One thing in the basket this payment settled. */
interface PaymentLine {
  id: string;
  itemType: string;
  description: string;
  /** Minor units. */
  fee: number;
  handlingFee: number;
  /** How this line was settled: a basket may be part card and part offline. */
  paymentMethod: string | null;
  status: string;
  fulfilled: boolean;
  /** The record it produced, or null where it has produced nothing yet. */
  fulfilmentRef: string | null;
  subjectName: string | null;
  contextRef: Record<string, unknown> | null;
  /** Minor units already refunded against this line. */
  refundedAmount: number;
  /** `removed` where the entry this line produced has been withdrawn. */
  entryStatus: string | null;
}

/**
 * Where a line leads in the org-admin app.
 *
 * Each kind goes to the closest thing this app has. An entry has no page of its
 * own — it lives on its event's entrant list — so it is reached through the
 * event named in the line's `contextRef`, which is what the basket recorded.
 * Registrations and bookings have no per-record page either and go to the list
 * that holds them.
 *
 * Null where there is nothing to open: a line that has not been fulfilled has
 * produced no record, and a link to nothing is worse than no link.
 */
/** One array, so a page still loading does not re-sort a new empty list. */
const NO_SETTLEMENT: SettlementEvent[] = [];

export function lineDestination(line: PaymentLine): string | null {
  const eventId = (line.contextRef as { eventId?: string } | null)?.eventId;

  switch (line.itemType) {
    case 'event_entry':
      /*
       * The entry itself, not the entrant list for the whole event. The list
       * answers "who is coming"; a payment line asks "what is this one entry" —
       * whose it was, what they wrote on the form, what it cost.
       */
      return line.fulfilmentRef && eventId
        ? `/events/${eventId}/entries/${line.fulfilmentRef}`
        : null;
    case 'membership':
      return line.fulfilmentRef ? `/members/${line.fulfilmentRef}` : null;
    case 'merchandise':
      return line.fulfilmentRef ? `/merchandise/orders/${line.fulfilmentRef}` : null;
    case 'registration':
      // The registration itself. This led to the whole database of them —
      // `registrations/:id` has existed all along.
      return line.fulfilmentRef ? `/registrations/${line.fulfilmentRef}` : null;
    case 'booking':
      return line.fulfilmentRef ? `/calendar/bookings/${line.fulfilmentRef}` : null;
    default:
      return null;
  }
}

/**
 * Where one item of a basket stands.
 *
 * Not the payment's status: a basket can hold one line refunded, one still owed
 * offline and two paid for, and "has *this* one been refunded?" is asked of the
 * item. Derived from what has gone back against the line rather than stored,
 * because the money is the fact and a second column recording the same thing
 * would be free to disagree with it.
 *
 * A line is refunded when its own fee **and** its share of the handling fee
 * have gone back — that is what the member paid for it, and what a refund of it
 * returns.
 */
export function itemStatus(line: PaymentLine): string {
  const owed = line.fee + line.handlingFee;

  if (line.refundedAmount >= owed && owed > 0) return 'refunded';
  if (line.refundedAmount > 0) return 'partially_refunded';
  return line.status;
}

/**
 * The colour of an item's state.
 *
 * The same reading as the payment's own chip: amber where money has moved and
 * something is unresolved — an unpaid line, or one only part of which has gone
 * back — so a basket half refunded is not read as settled.
 */
export const itemStatusColour = (
  status: string
): 'success' | 'warning' | 'info' | 'default' => {
  switch (status) {
    case 'paid':
      return 'success';
    case 'refunded':
      return 'info';
    case 'partially_refunded':
    case 'pending':
      return 'warning';
    default:
      return 'default';
  }
};

/**
 * When the payment happened.
 *
 * `paymentDate` is the moment the money moved and is null until it does, so an
 * unpaid payment falls back to when it was raised.
 */
const paymentMoment = (payment: Payment): Date =>
  new Date(payment.paymentDate ?? payment.createdAt);

const PaymentDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { execute } = useApi();
  const { t } = useTranslation();
  const { format: formatMoney } = useCurrency();
  const { locale } = useLocale();
  
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundProcessing, setRefundProcessing] = useState(false);
  const [settling, setSettling] = useState(false);
  const [notice, setNotice] = useState<{ text: string; severity: 'success' | 'warning' } | null>(
    null
  );
  const [actionError, setActionError] = useState<string | null>(null);

  /*
   * The basket behind this payment. A payment raised without lines — an older
   * one, or a manual lodgement — simply has none, so the table says so rather
   * than the page failing on an absent array.
   */
  const lines = useMemo(() => payment?.lines ?? [], [payment]);
  /*
   * What went back. A payment can be refunded more than once, so the screen
   * totals them rather than showing "the" refund.
   */
  const refunds = useMemo(() => payment?.refunds ?? [], [payment]);
  /*
   * Three tables on this page, three sorts — the basket, what went back, and
   * what the club did about it. Each has its own state, because they are three
   * lists about one payment rather than three views of one list.
   *
   * Declared here, above the loading and not-found returns further down: a
   * hook after an early return is a hook that does not always run.
   */
  const lineSort = useTableSort(lines, {
    accessors: {
      // The item's own state, which the column shows as a chip and the row
      // computes — `itemStatus` reads the refunded amount against what is owed.
      itemStatus,
    },
  });
  const refundSort = useTableSort(refunds, {
    initial: { field: 'requestedAt', direction: 'desc' },
    accessors: {
      requestedBy: (refund) => refund.requestedByName ?? refund.requestedByEmail,
    },
  });
  const settlementSort = useTableSort(payment?.settlement ?? NO_SETTLEMENT, {
    accessors: {
      who: (event) => event.actorName ?? event.actorEmail,
    },
  });

  const refundedTotal = useMemo(
    () => refunds.reduce((total, refund) => total + refund.refundAmount, 0),
    [refunds]
  );

  const lineTotals = useMemo(
    () =>
      lines.reduce(
        (total, line) => ({
          fee: total.fee + line.fee,
          handlingFee: total.handlingFee + line.handlingFee,
        }),
        { fee: 0, handlingFee: 0 }
      ),
    [lines]
  );

  useEffect(() => {
    if (id) {
      loadPayment();
    }
  }, [id]);

  const loadPayment = async () => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/payments/${id}`,
      });
      setPayment(response);
    } catch (error) {
      console.error('Failed to load payment:', error);
      setPayment(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/payments');
  };

  const handleOpenRefundDialog = () => {
    setRefundDialogOpen(true);
  };

  const handleCloseRefundDialog = () => setRefundDialogOpen(false);

  const handleRefund = async (request: RefundRequest) => {
    if (!payment) return;

    try {
      setRefundProcessing(true);
      /*
       * The scope, not an amount. Only `amount` sends a figure — every other
       * scope is computed by the server from the payment itself, or a client
       * could refund the whole of a payment while calling it one line of it and
       * the status would follow the label rather than the money.
       */
      await execute({
        method: 'POST',
        url: `/api/orgadmin/payments/${payment.id}/refund`,
        data: request,
      });

      // Reload: the status, the refund history and what is left on each line
      // all move together.
      await loadPayment();
      handleCloseRefundDialog();
    } catch (error) {
      console.error('Failed to process refund:', error);
    } finally {
      setRefundProcessing(false);
    }
  };

  /**
   * Recording the money as arrived, or undoing that, without leaving the page.
   *
   * The same two endpoints the Offline Payments screen calls. An administrator
   * who has opened a payment to look at it should not have to go and find it
   * again in a list to act on it.
   *
   * `throwOnError`, because `execute` answers `null` on a refusal: undoing a
   * receipt that has released records must say so rather than say "Undone".
   */
  const settle = async (received: boolean) => {
    if (!payment) return;

    setSettling(true);
    setActionError(null);
    setNotice(null);

    try {
      const result = await execute({
        method: received ? 'POST' : 'DELETE',
        url: `/api/orgadmin/organisation/payments/${payment.id}/received`,
        throwOnError: true,
      });

      const failed = received ? (result?.fulfilment?.failed ?? 0) : 0;
      setNotice(
        failed > 0
          ? {
              text: t('payments.offline.recordedWithFailures', {
                name: payment.userName ?? t('payments.unknownPayer'),
                failed,
              }),
              severity: 'warning',
            }
          : {
              text: received
                ? t('payments.offline.recorded', {
                    name: payment.userName ?? t('payments.unknownPayer'),
                  })
                : t('payments.offline.undone', {
                    name: payment.userName ?? t('payments.unknownPayer'),
                  }),
              severity: 'success',
            }
      );

      await loadPayment();
    } catch (error) {
      // The server's own words: for a refusal they are what the administrator
      // needs to read.
      setActionError(
        error instanceof Error ? error.message : t('payments.offline.recordFailed')
      );
    } finally {
      setSettling(false);
    }
  };

  const getStatusColor = (status: Payment['paymentStatus']) => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'pending':
        return 'warning';
      case 'refunded':
        return 'info';
      case 'partially_refunded':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('payments.loadingPayment')}</Typography>
      </Box>
    );
  }

  if (!payment) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('payments.paymentNotFound')}</Typography>
        <Button onClick={handleBack} sx={{ mt: 2 }}>
          {t('payments.actions.backToPayments')}
        </Button>
      </Box>
    );
  }

  /*
   * A part-refunded payment can be refunded again — that is what refunding one
   * item at a time means. A fully refunded one has nothing left.
   */
  const canRefund =
    payment.paymentStatus === 'paid' || payment.paymentStatus === 'partially_refunded';

  /*
   * Only a payment the club is actually owed offline money on. `awaiting_offline`
   * is what a finished offline checkout writes and what the Offline Payments
   * screen selects on, so the two agree about which payments are outstanding.
   */
  const canMarkReceived = payment.paymentStatus === 'awaiting_offline';

  /*
   * And only one that was received. Whether the undo will be *allowed* is the
   * server's to say — it refuses once the receipt has released records — so the
   * button is offered and the refusal is shown in its own words.
   */
  const canUndoReceipt = Boolean(payment.offlineReceivedAt);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3,
        // Wraps rather than overflowing: a non-wrapping header row pushed
        // page actions past the right edge of a phone, with nothing on
        // screen to show the page had scrolled.
        flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={handleBack}>
            <BackIcon />
          </IconButton>
          <Typography variant="h4">{t('payments.paymentDetails')}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {/*
            The offline settlement, from the payment itself.
            
            The same two endpoints the Offline Payments screen calls: somebody
            who has opened a payment to look at it should not have to go and
            find it again in a list to record the cheque.
          */}
          {canMarkReceived && (
            <Button
              variant="contained"
              startIcon={<ReceivedIcon />}
              onClick={() => settle(true)}
              disabled={settling}
            >
              {t('payments.offline.markReceived')}
            </Button>
          )}
          {canUndoReceipt && (
            <Button
              variant="outlined"
              startIcon={<UndoIcon />}
              onClick={() => settle(false)}
              disabled={settling}
            >
              {t('payments.offline.undo')}
            </Button>
          )}
          {canRefund && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<RefundIcon />}
              onClick={handleOpenRefundDialog}
            >
              {t('payments.actions.requestRefund')}
            </Button>
          )}
        </Box>
      </Box>

      {notice && (
        <Alert severity={notice.severity} sx={{ mb: 3 }} onClose={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}
      {actionError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('payments.details.paymentInformation')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('payments.details.paymentId')}
                </Typography>
                <Typography variant="body1">{payment.id}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('payments.details.amount')}
                </Typography>
                <Typography variant="h5" color="primary">
                  {formatMoney(payment.amount)}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('payments.details.status')}
                </Typography>
                <Chip
                  label={t(`common.status.${payment.paymentStatus}`, {
                    defaultValue: payment.paymentStatus,
                  })}
                  color={getStatusColor(payment.paymentStatus)}
                  sx={{ mt: 0.5 }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('payments.details.paymentMethod')}
                </Typography>
                <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                  {t(`payments.paymentMethodOptions.${payment.paymentMethod}`)}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('payments.details.date')}
                </Typography>
                <Typography variant="body1">
                  {formatDateTime(paymentMoment(payment), locale)}
                </Typography>
              </Box>

              {payment.providerTransactionId && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    {t('payments.details.transactionId')}
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {payment.providerTransactionId}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('payments.details.customerInformation')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('payments.details.name')}
                </Typography>
                <Typography variant="body1">
                  {payment.userName ?? t('payments.unknownPayer')}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('payments.details.email')}
                </Typography>
                <Typography variant="body1">{payment.userEmail ?? ''}</Typography>
              </Box>

              {/* No phone number on a payment: the endpoint does not return one. */}
            </CardContent>
          </Card>

          {/*
            What the payment bought, line by line.

            The payment row is a total; this is the answer to "for what". Each
            line names the item, who it was for, how it was settled and what
            share of the handling fee it bore — and opens the record it
            produced. A basket of four used to be a single figure with a
            "Related Transaction" card beside it that named nothing.
          */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('payments.details.items')}
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {lines.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  {t('payments.details.noItems')}
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <SortableTableCell sort={lineSort} field="description">
                        {t('payments.details.item')}
                      </SortableTableCell>
                      <SortableTableCell sort={lineSort} field="paymentMethod">
                        {t('payments.details.method')}
                      </SortableTableCell>
                      <SortableTableCell sort={lineSort} field="itemStatus">
                        {t('payments.details.itemStatus')}
                      </SortableTableCell>
                      <SortableTableCell sort={lineSort} field="fee" align="right">
                        {t('payments.details.amount')}
                      </SortableTableCell>
                      <SortableTableCell sort={lineSort} field="handlingFee" align="right">
                        {t('payments.details.handlingFee')}
                      </SortableTableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lineSort.rows.map((line) => {
                      const destination = lineDestination(line);
                      const status = itemStatus(line);

                      return (
                        <TableRow key={line.id}>
                          <TableCell>
                            <Typography variant="body2">{line.description}</Typography>

                            {/*
                              Who it was for. The description says what was
                              bought and is composed when the basket is filled,
                              so two children in one class give two identical
                              lines.
                            */}
                            {line.subjectName && (
                              <Typography variant="caption" color="textSecondary" display="block">
                                {line.subjectName}
                              </Typography>
                            )}

                            {/*
                              Whether the entry this line produced went with the
                              refund. Beside the item rather than in the status
                              column, because it is a fact about the entry — the
                              money and the entry are separate decisions.
                            */}
                            {line.entryStatus === 'removed' && (
                              <Chip
                                size="small"
                                sx={{ mt: 0.5 }}
                                label={t('payments.details.entryWithdrawn')}
                              />
                            )}

                            {destination ? (
                              <Link
                                component="button"
                                type="button"
                                variant="caption"
                                underline="hover"
                                onClick={() => navigate(destination)}
                              >
                                {t(`payments.details.view.${line.itemType}`, {
                                  defaultValue: t('payments.details.view.default'),
                                })}
                              </Link>
                            ) : (
                              /*
                                Nothing to open. On an unpaid offline order that
                                is expected — a membership is not created until
                                the money arrives — so it says which, rather
                                than leaving a gap that reads as a broken link.
                              */
                              <Typography variant="caption" color="textSecondary" display="block">
                                {t('payments.details.notYetCreated')}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {line.paymentMethod
                              ? t(`payments.paymentMethodOptions.${line.paymentMethod}`, {
                                  defaultValue: line.paymentMethod,
                                })
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {/*
                              The item's own state. A basket can hold one line
                              refunded and three not, and the payment's status
                              says nothing about which is which.
                            */}
                            <Chip
                              size="small"
                              label={t(`common.status.${status}`, { defaultValue: status })}
                              color={itemStatusColour(status)}
                            />
                            {/*
                              How much went back, where only part of it did.
                              "Partly refunded" without a figure leaves the club
                              to work out how much from two other columns.
                            */}
                            {status === 'partially_refunded' && (
                              <Typography variant="caption" color="textSecondary" display="block">
                                {t('payments.details.refunded', {
                                  amount: formatMoney(line.refundedAmount / 100),
                                })}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">{formatMoney(line.fee / 100)}</TableCell>
                          <TableCell align="right">
                            {line.handlingFee > 0 ? formatMoney(line.handlingFee / 100) : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>

                  {/*
                    The arithmetic behind the single figure at the top of the
                    page: what the items cost, what the handling fee added, and
                    what was actually charged. A basket part-paid by card and
                    part offline still totals to the payment's own amount.
                  */}
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3}>{t('payments.details.subtotal')}</TableCell>
                      <TableCell align="right">{formatMoney(lineTotals.fee / 100)}</TableCell>
                      <TableCell align="right">
                        {lineTotals.handlingFee > 0
                          ? formatMoney(lineTotals.handlingFee / 100)
                          : '—'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={4}>
                        <strong>{t('payments.details.total')}</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>
                          {formatMoney((lineTotals.fee + lineTotals.handlingFee) / 100)}
                        </strong>
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/*
          What went back.

          This replaces a "Refund Information" card built from fields the
          payment row does not have, which rendered a box of "N/A" for any
          refunded payment. Refunds live in their own table, one row per refund
          — a payment can be refunded twice — and each says who asked, when, how
          much and why. Hidden entirely when there are none: an empty card on
          every payment ever taken is noise.
        */}
        {refunds.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('payments.refunds.history')}
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {/*
                  How much of the payment has gone back. A part refund leaves
                  the payment `paid` — there is no partial status — so this line
                  is the only thing that says so.
                */}
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  {t('payments.refunds.refundedOf', {
                    refunded: formatMoney(refundedTotal),
                    total: formatMoney(payment.amount),
                  })}
                </Typography>

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <SortableTableCell sort={refundSort} field="requestedAt">
                        {t('payments.refunds.when')}
                      </SortableTableCell>
                      <SortableTableCell sort={refundSort} field="requestedBy">
                        {t('payments.refunds.requestedBy')}
                      </SortableTableCell>
                      <SortableTableCell sort={refundSort} field="refundReason">
                        {t('payments.refunds.reason')}
                      </SortableTableCell>
                      <SortableTableCell sort={refundSort} field="refundStatus">
                        {t('payments.refunds.status')}
                      </SortableTableCell>
                      <SortableTableCell sort={refundSort} field="refundAmount" align="right">
                        {t('payments.refunds.amount')}
                      </SortableTableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {refundSort.rows.map((refund) => (
                      <TableRow key={refund.id}>
                        <TableCell>{formatDateTime(refund.requestedAt, locale)}</TableCell>
                        <TableCell>
                          {refund.requestedByName ??
                            refund.requestedByEmail ??
                            t('payments.refunds.requesterUnknown')}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{refund.refundReason ?? '—'}</Typography>
                          {/*
                            How the amount was arrived at, and — where the
                            refund named items — which ones. A €25 line on a
                            €185 basket means little without them.
                          */}
                          <Typography variant="caption" color="textSecondary" display="block">
                            {t(`payments.refunds.scopes.${refund.refundScope}`, {
                              defaultValue: refund.refundScope,
                            })}
                            {(refund.items ?? []).length > 0
                              ? `: ${(refund.items ?? [])
                                  .map((item) => item.description)
                                  .join(', ')}`
                              : ''}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={t(`payments.refunds.statuses.${refund.refundStatus}`, {
                              defaultValue: refund.refundStatus,
                            })}
                            color={refund.refundStatus === 'completed' ? 'success' : 'warning'}
                          />
                        </TableCell>
                        <TableCell align="right">{formatMoney(refund.refundAmount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/*
          How an offline settlement got where it is.

          Read from the audit trail rather than the payment row, because an undo
          nulls `offline_received_at` and `offline_received_by` — a payment
          marked received in error and put back looks exactly like one nobody
          ever touched. Shown for any payment with settlement acts against it,
          including a mixed basket where only part was owed offline.
        */}
        {payment.settlement?.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('payments.settlement.history')}
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <SortableTableCell sort={settlementSort} field="occurredAt">
                        {t('payments.settlement.when')}
                      </SortableTableCell>
                      <SortableTableCell sort={settlementSort} field="kind">
                        {t('payments.settlement.what')}
                      </SortableTableCell>
                      <SortableTableCell sort={settlementSort} field="who">
                        {t('payments.settlement.who')}
                      </SortableTableCell>
                      <SortableTableCell sort={settlementSort} field="itemsCreated" align="right">
                        {t('payments.settlement.released')}
                      </SortableTableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {settlementSort.rows.map((event, index) => (
                      <TableRow key={`${event.occurredAt}-${index}`}>
                        <TableCell>{formatDateTime(event.occurredAt, locale)}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={t(`payments.settlement.kinds.${event.kind}`)}
                            color={event.kind === 'received' ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          {event.actorName ?? event.actorEmail ?? t('audit.unknownActor')}
                        </TableCell>
                        <TableCell align="right">
                          {/*
                            Null on an act recorded before the trail carried
                            counts — a dash, rather than a zero that would claim
                            the receipt released nothing.
                          */}
                          {event.itemsCreated === null
                            ? '—'
                            : t('payments.settlement.itemsCreated', {
                                count: event.itemsCreated,
                              })}
                          {event.itemsFailed ? (
                            <Typography variant="caption" color="error" display="block">
                              {t('payments.settlement.itemsFailed', { count: event.itemsFailed })}
                            </Typography>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      <RefundDialog
        open={refundDialogOpen}
        remaining={payment.amount - refundedTotal}
        handlingFee={payment.handlingFee ?? 0}
        lines={lines}
        processing={refundProcessing}
        formatMoney={formatMoney}
        onClose={handleCloseRefundDialog}
        onConfirm={handleRefund}
      />
    </Box>
  );
};

export default PaymentDetailsPage;
