import React, { useCallback, useEffect, useState } from 'react';
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
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { formatCurrency, formatDisplayDate } from '@aws-web-framework/components';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { AccountPayment } from '../types/account';

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
export const MyPaymentsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
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
                          {formatDisplayDate(payment.paidOn ?? payment.createdAt, locale)}
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
                      {payment.lines.map((line) => (
                        <Box key={line.id}>
                          <Stack direction="row" justifyContent="space-between" spacing={2}>
                            <Typography variant="body2">{line.description}</Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                              {formatCurrency(line.fee / 100, currency, locale)}
                            </Typography>
                          </Stack>
                          {line.fulfilmentError && (
                            <Alert severity="warning" sx={{ mt: 0.5 }}>
                              {t('payments.lineProblem', { reason: line.fulfilmentError })}
                            </Alert>
                          )}
                        </Box>
                      ))}

                      {payment.handlingFee > 0 && (
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            {t('payments.handlingFee')}
                          </Typography>
                          <Typography variant="body2">
                            {formatCurrency(payment.handlingFee / 100, currency, locale)}
                          </Typography>
                        </Stack>
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
