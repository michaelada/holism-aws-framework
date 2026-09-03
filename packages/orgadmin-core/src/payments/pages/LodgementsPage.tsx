/**
 * Lodgements — money that actually reached the club's bank account.
 *
 * This replaces a screen of the same name that summed our own `payments` table
 * by day and payment method. That is what the club *charged*; it is not what
 * arrived. The two differ by fees, by refunds, by Stripe's payout schedule, and
 * by the plain fact that a card payment on Monday is in nobody's bank on
 * Monday. A treasurer reconciling against a bank statement needs the second
 * number, and had no way to see it.
 *
 * Every figure here comes from the club's own Stripe account rather than from
 * our database, so it agrees with the statement by construction.
 *
 * See docs/LODGEMENTS.md.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ResponsiveTable, SortableTableCell } from '../../components';
import { useTableSort } from '../../hooks/useTableSort';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useCurrency } from '../../hooks/useCurrency';
import { useTranslation, useLocale, formatDate } from '@itsplainsailing/orgadmin-shell';

export interface Lodgement {
  id: string;
  arrivalDate: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'in_transit' | 'canceled' | 'failed';
  failureMessage: string | null;
  destination: string | null;
}

interface LodgementPage {
  lodgements: Lodgement[];
  nextCursor: string | null;
  notYetPaidOut: { amount: number; currency: string } | null;
}

/**
 * Colour carries the same meaning it does everywhere else in the product: green
 * for done, amber for in flight, red for something a club must act on.
 */
const STATUS_COLOUR: Record<Lodgement['status'], 'success' | 'warning' | 'error' | 'default'> = {
  paid: 'success',
  pending: 'warning',
  in_transit: 'warning',
  canceled: 'default',
  failed: 'error',
};

const LodgementsPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { format: formatMoney } = useCurrency();

  const [lodgements, setLodgements] = useState<Lodgement[]>([]);
  const [notYetPaidOut, setNotYetPaidOut] = useState<LodgementPage['notYetPaidOut']>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  /**
   * Two problems that are not "loading failed": never connected, and connected
   * but no longer reachable. Both are configuration with a remedy the
   * administrator can act on, and both send them to the same place.
   */
  const [connection, setConnection] = useState<'none' | 'invalid' | null>(null);
  const [failed, setFailed] = useState(false);

  /**
   * What a failure means, decided in one place.
   *
   * A connection problem is not an error to report as one: it has a cause the
   * administrator can fix and a place to go and fix it. Matched on the message
   * because that is all `useApi` passes on — the codes the backend sets
   * (`STRIPE_ACCESS_REVOKED`) do not survive the trip — so the wording is
   * asserted on both sides of the wire.
   *
   * Flags rather than messages, so the loader below need not name `t`. Naming
   * it would rebuild the loader on every render and refetch without end.
   */
  const classify = useCallback((message: string) => {
    if (/not connected to Stripe/i.test(message)) setConnection('none');
    else if (/no longer valid/i.test(message)) setConnection('invalid');
    else setFailed(true);
  }, []);

  const load = useCallback(
    async (after: string | null) => {
      after ? setLoadingMore(true) : setLoading(true);
      setFailed(false);
      setConnection(null);

      /*
       * `onError`, not `catch`.
       *
       * `useApi.execute` **returns null** when a request fails; it does not
       * throw. A `try/catch` around it is dead code, and the null then flows
       * into `response?.lodgements ?? []` and renders as "No lodgements yet" —
       * an outage reported to a club as *"no money has reached your bank"*.
       * Which is the single most alarming thing this screen could say, and it
       * would be false.
       *
       * `onError` is the hook's own answer to this and hands over the message
       * at the moment of failure.
       */
      let failure: string | null = null;

      try {
        const response: LodgementPage | null = await execute({
          method: 'GET',
          url: `/api/orgadmin/organisation/payments/lodgements${after ? `?cursor=${after}` : ''}`,
          onError: (message: string) => {
            failure = message;
          },
        });

        if (failure !== null || !response) {
          classify(failure ?? '');
          return;
        }

        setLodgements((current) =>
          after ? [...current, ...(response.lodgements ?? [])] : response.lodgements ?? []
        );
        setNotYetPaidOut(response.notYetPaidOut ?? null);
        setCursor(response.nextCursor ?? null);
      } catch (error) {
        // Both routes reach the same judgement. `execute` returning null is what
        // happens in a browser; a rejection is what a test double does — and a
        // failure must not mean different things depending on which it was.
        classify(error instanceof Error ? error.message : '');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [execute, classify]
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  /*
   * Above the loading return: a hook after an early return is a hook that does
   * not always run. Stripe hands these back newest first and the screen keeps
   * that, so the sort opens on the order a club already reads it in.
   */
  const sort = useTableSort(lodgements, {
    initial: { field: 'arrivalDate', direction: 'desc' },
  });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label={t('common.loading')} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t('payments.lodgements.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('payments.lodgements.subtitle')}
      </Typography>

      {failed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('payments.lodgements.loadError')}
        </Alert>
      )}

      {connection ? (
        <Alert
          severity={connection === 'invalid' ? 'warning' : 'info'}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/settings?tab=payments')}>
              {t('payments.lodgements.goToSettings')}
            </Button>
          }
        >
          {t(
            connection === 'invalid'
              ? 'payments.lodgements.connectionInvalid'
              : 'payments.lodgements.notConnected'
          )}
        </Alert>
      ) : (
        <>
          {/*
            A card, never a row. This money has no date and has not moved; a row
            in the table would be a lodgement that has not happened.
          */}
          {notYetPaidOut && notYetPaidOut.amount > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  spacing={1}
                >
                  <Box>
                    <Typography variant="subtitle1">
                      {t('payments.lodgements.notYetPaidOut')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('payments.lodgements.notYetPaidOutHint')}
                    </Typography>
                  </Box>
                  <Typography variant="h5">{formatMoney(notYetPaidOut.amount / 100)}</Typography>
                </Stack>
              </CardContent>
            </Card>
          )}

          {lodgements.length === 0 && !failed ? (
            <Alert severity="info">{t('payments.lodgements.empty')}</Alert>
          ) : (
            <>
              {/* Scrolls within itself; the page never scrolls sideways. */}
              <ResponsiveTable identityColumn={t('payments.lodgements.columnDate')} component={Card} sx={{ overflowX: 'auto' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <SortableTableCell sort={sort} field="arrivalDate">
                        {t('payments.lodgements.columnDate')}
                      </SortableTableCell>
                      <SortableTableCell sort={sort} field="amount" align="right">
                        {t('payments.lodgements.columnAmount')}
                      </SortableTableCell>
                      <SortableTableCell sort={sort} field="status">
                        {t('payments.lodgements.columnStatus')}
                      </SortableTableCell>
                      <SortableTableCell sort={sort} field="destination">
                        {t('payments.lodgements.columnAccount')}
                      </SortableTableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sort.rows.map((lodgement) => (
                      <TableRow
                        key={lodgement.id}
                        hover
                        onClick={() => navigate(`/payments/lodgements/${lodgement.id}`)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          {formatDate(lodgement.arrivalDate, 'PP', locale)}
                          {/*
                            The reason a club opened this screen at all. Kept on
                            the row rather than behind the drill-down: someone
                            chasing missing money should not have to click to
                            find out it failed.
                          */}
                          {lodgement.failureMessage && (
                            <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
                              {lodgement.failureMessage}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">{formatMoney(lodgement.amount / 100)}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={STATUS_COLOUR[lodgement.status] ?? 'default'}
                            label={t(`payments.lodgements.status.${lodgement.status}`)}
                          />
                        </TableCell>
                        <TableCell>{lodgement.destination ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTable>

              {/*
                Stripe gives a cursor and no total, so there is no page count to
                show and nothing honest to put on a paginator.
              */}
              {cursor && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Button onClick={() => void load(cursor)} disabled={loadingMore}>
                    {loadingMore
                      ? t('common.loading')
                      : t('payments.lodgements.showMore')}
                  </Button>
                </Box>
              )}
            </>
          )}
        </>
      )}
    </Box>
  );
};

export default LodgementsPage;
