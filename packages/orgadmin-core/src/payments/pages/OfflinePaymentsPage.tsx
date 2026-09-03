/**
 * Offline Payments (I1, I2)
 *
 * Cheques and transfers a member has committed to but the club has not yet
 * recorded as arrived.
 *
 * **This screen is what stands between a member and the thing they paid for.**
 * A member choosing to pay offline checks out into `awaiting_offline`, and
 * fulfilment deliberately defers everything except an event entry until the
 * money is recorded — a membership runs for a year, and granting one before the
 * cheque clears gives it away. So until an administrator marks a payment
 * received here, no membership, order, booking or registration exists, and the
 * member's own payments screen reads "the club has still to record this as
 * received".
 *
 * Marking one runs that deferred fulfilment immediately and reports what it
 * produced, so an administrator sees the consequence of the click rather than
 * having to go looking for it.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useApi } from '../../hooks/useApi';
import { useTranslation, useLocale, formatDate, formatCurrency } from '@itsplainsailing/orgadmin-shell';

interface OfflinePaymentLine {
  description: string;
  /** Minor units. */
  fee: number;
}

interface OfflinePayment {
  id: string;
  memberName: string;
  memberEmail: string;
  currency: string;
  status: string;
  placedAt: string;
  receivedAt: string | null;
  /**
   * The administrator who recorded it. Null when nobody has, and also when the
   * one who did has since left the organisation — the settlement stands either
   * way, so a date can arrive without a name.
   */
  receivedBy: string | null;
  /** What the member owes offline — not the order total. */
  offlineAmount: number;
  cardAmount: number;
  handlingFee: number;
  lines: OfflinePaymentLine[];
}

interface FulfilmentOutcome {
  fulfilled: number;
  failed: number;
  complete: boolean;
}

const OfflinePaymentsPage: React.FC = () => {
  const { execute } = useApi();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { locale } = useLocale();

  const [settled, setSettled] = useState(false);
  const [payments, setPayments] = useState<OfflinePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** A message already in the reader's language: a server refusal, or a translated action failure. */
  const [error, setError] = useState<string | null>(null);
  /**
   * The list failing is held as a flag, not a message, so `load` need not name
   * `t` — see the comment in the catch below.
   */
  const [loadFailed, setLoadFailed] = useState(false);
  /**
   * What just happened, and how well. Recording a payment can half-succeed —
   * the money is settled but a membership or ticket could not be created — and
   * that must not be announced with a tick. It read "Recorded, but 1 item(s)
   * could not be created" beside a green success icon, which is the one
   * combination guaranteed to be skimmed past.
   */
  const [notice, setNotice] = useState<{ text: string; severity: 'success' | 'warning' } | null>(
    null
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    setError(null);
    /*
     * `useApi.execute` returns null on failure rather than throwing, so the
     * `catch` below never runs in a browser — only under a mock that rejects.
     * Without `onError` a failed load fell through to `Array.isArray(null)` and
     * rendered "Nothing is waiting on an offline payment", telling a club there
     * was no money to chase when in fact nobody had been able to ask.
     */
    let errored = false;

    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisation/payments/offline?settled=${settled}`,
        onError: () => {
          errored = true;
        },
      });

      if (errored || response === null) {
        setLoadFailed(true);
        return;
      }
      setPayments(Array.isArray(response) ? response : []);
    } catch {
      /*
       * Record *that* it failed; the render decides what to say. Naming `t`
       * here would put it in the dependency array below, and this page once
       * looped on exactly that — a fresh `t` per render meant a fresh `load`
       * per render, and the effect re-fired until the API answered 429 and then
       * the browser ran out of sockets. The hook is fixed; this keeps the page
       * correct regardless. Translating at render also means the message
       * follows a language change instead of freezing at fetch time.
       */
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [execute, settled]);

  useEffect(() => {
    void load();
  }, [load]);

  const markReceived = async (payment: OfflinePayment) => {
    setBusyId(payment.id);
    setError(null);
    setNotice(null);

    try {
      const result = await execute({
        method: 'POST',
        url: `/api/orgadmin/organisation/payments/${payment.id}/received`,
        // Or a refusal is reported as a success: `execute` answers `null` on an
        // error unless it is asked to throw, and the `catch` below never fires.
        throwOnError: true,
      });

      const outcome: FulfilmentOutcome | undefined = result?.fulfilment;

      /*
       * What the money produced, said plainly. A failed line means the member
       * has paid and has nothing — the club needs to know that now, not when
       * the member rings up.
       */
      setNotice(
        outcome && outcome.failed > 0
          ? {
              text: t('payments.offline.recordedWithFailures', {
                name: payment.memberName,
                failed: outcome.failed,
              }),
              severity: 'warning',
            }
          : { text: t('payments.offline.recorded', { name: payment.memberName }), severity: 'success' }
      );

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('payments.offline.recordFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const undo = async (payment: OfflinePayment) => {
    setBusyId(payment.id);
    setError(null);
    setNotice(null);

    try {
      await execute({
        method: 'DELETE',
        url: `/api/orgadmin/organisation/payments/${payment.id}/received`,
        // The refusal is the whole point of this call's error path: undoing a
        // receipt that has released records must say so, not say "Undone".
        throwOnError: true,
      });
      setNotice({
        text: t('payments.offline.undone', { name: payment.memberName }),
        severity: 'success',
      });
      await load();
    } catch (err) {
      // The refusal an administrator most needs to read: the receipt has
      // already produced records, and undoing it would strand them.
      setError(err instanceof Error ? err.message : t('payments.offline.undoFailed'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t('payments.offline.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {t('payments.offline.subtitle')}
      </Typography>

      <Tabs
        value={settled ? 'settled' : 'outstanding'}
        onChange={(_event, value) => setSettled(value === 'settled')}
        sx={{ mb: 2 }}
      >
        <Tab value="outstanding" label={t('payments.offline.tabOutstanding')} />
        <Tab value="settled" label={t('payments.offline.tabSettled')} />
      </Tabs>

      {(error || loadFailed) && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => {
            setError(null);
            setLoadFailed(false);
          }}
        >
          {error ?? t('payments.offline.loadError')}
        </Alert>
      )}
      {notice && (
        <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label={t('common.loading')} />
        </Box>
      ) : payments.length === 0 && !loadFailed ? (
        /*
         * `!loadFailed` matters. Without it a failed load showed the error
         * alert *and* "Nothing is waiting on an offline payment" directly
         * beneath it — two contradictory statements, of which the reassuring
         * one is the one that gets believed.
         */
        <Alert severity="info">
          {settled ? t('payments.offline.noneSettled') : t('payments.offline.noneOutstanding')}
        </Alert>
      ) : (
        <Stack spacing={2}>
          {payments.map((payment) => (
            <Card key={payment.id}>
              <CardContent>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  spacing={1}
                >
                  <Box>
                    <Typography variant="h6">{payment.memberName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('payments.offline.placedOn', {
                        date: formatDate(payment.placedAt, 'PP', locale),
                      })}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1} alignItems="center">
                    {/*
                      The figure to look for on the statement is the offline
                      half, not the order total — a mixed order's card half has
                      already been taken.
                    */}
                    <Typography variant="h6">
                      {formatCurrency(payment.offlineAmount / 100, payment.currency, locale)}
                    </Typography>
                    {payment.receivedAt ? (
                      <Chip
                        size="small"
                        color="success"
                        /*
                         * Who, not just when. The column was always written and
                         * never read back, so an administrator could see that a
                         * payment had been marked received but not by whom —
                         * which is the half that matters when it was marked in
                         * error and somebody has to ask.
                         */
                        label={
                          payment.receivedBy
                            ? t('payments.offline.receivedByOn', {
                                name: payment.receivedBy,
                                date: formatDate(payment.receivedAt, 'PP', locale),
                              })
                            : t('payments.offline.receivedByUnknownOn', {
                                date: formatDate(payment.receivedAt, 'PP', locale),
                              })
                        }
                      />
                    ) : (
                      <Chip size="small" color="warning" label={t('payments.offline.awaiting')} />
                    )}
                  </Stack>
                </Stack>

                {payment.cardAmount > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {t('payments.offline.alsoPaidByCard', {
                      amount: formatCurrency(payment.cardAmount / 100, payment.currency, locale),
                    })}
                  </Typography>
                )}

                <Divider sx={{ my: 1.5 }} />

                <Stack spacing={0.5}>
                  {payment.lines.map((line, index) => (
                    <Stack
                      key={`${payment.id}-${index}`}
                      direction="row"
                      justifyContent="space-between"
                    >
                      <Typography variant="body2">{line.description}</Typography>
                      <Typography variant="body2">
                        {formatCurrency(line.fee / 100, payment.currency, locale)}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>

                <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
                  {/*
                    Into the payment itself: this card shows what is owed and
                    who owes it, and the next question — what was in the basket,
                    what has been refunded, how it was settled — is a page away
                    rather than a search away.
                  */}
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => navigate(`/payments/${payment.id}`)}
                  >
                    {t('payments.offline.viewPayment')}
                  </Button>
                  {payment.receivedAt ? (
                    <Button
                      size="small"
                      color="inherit"
                      disabled={busyId === payment.id}
                      onClick={() => undo(payment)}
                    >
                      {t('payments.offline.undo')}
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      size="small"
                      disabled={busyId === payment.id}
                      onClick={() => markReceived(payment)}
                    >
                      {busyId === payment.id
                        ? t('payments.offline.recording')
                        : t('payments.offline.markReceived')}
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default OfflinePaymentsPage;
