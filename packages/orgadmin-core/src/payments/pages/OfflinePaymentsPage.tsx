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
import { useTranslation, useLocale, formatDate, formatCurrency } from '@aws-web-framework/orgadmin-shell';

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
  const { t } = useTranslation();
  const { locale } = useLocale();

  const [settled, setSettled] = useState(false);
  const [payments, setPayments] = useState<OfflinePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisation/payments/offline?settled=${settled}`,
      });
      setPayments(Array.isArray(response) ? response : []);
    } catch {
      setError(t('payments.offline.loadError'));
    } finally {
      setLoading(false);
    }
  }, [execute, settled, t]);

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
      });

      const outcome: FulfilmentOutcome | undefined = result?.fulfilment;

      /*
       * What the money produced, said plainly. A failed line means the member
       * has paid and has nothing — the club needs to know that now, not when
       * the member rings up.
       */
      setNotice(
        outcome && outcome.failed > 0
          ? t('payments.offline.recordedWithFailures', {
              name: payment.memberName,
              failed: outcome.failed,
            })
          : t('payments.offline.recorded', { name: payment.memberName })
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
      });
      setNotice(t('payments.offline.undone', { name: payment.memberName }));
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

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label={t('common.loading')} />
        </Box>
      ) : payments.length === 0 ? (
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
                        label={t('payments.offline.receivedOn', {
                          date: formatDate(payment.receivedAt, 'PP', locale),
                        })}
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
