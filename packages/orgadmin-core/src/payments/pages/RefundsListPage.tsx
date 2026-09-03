/**
 * Refunds — money that went back out.
 *
 * Its own screen rather than a status filter on the payments list. A payments
 * list filtered to `refunded` answers a different question: it shows the
 * payments at their original amounts, says nothing about how much of each was
 * returned, and misses entirely a payment only part of which was refunded —
 * which stays `paid`, because this application has no partial status.
 *
 * What a club asks of this screen is "what have we sent back, and who
 * authorised it", so the amount refunded and the administrator who asked for it
 * are the two columns it is built around.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Visibility as ViewIcon } from '@mui/icons-material';
import { ResponsiveTable, SortableTableCell } from '../../components';
import { useTableSort } from '../../hooks/useTableSort';
import { useApi } from '../../hooks/useApi';
import { useCurrency } from '../../hooks/useCurrency';
import { useTranslation, useLocale, formatDateTime } from '@aws-web-framework/orgadmin-shell';

/** A refund, named the way `GET /refunds` names one. */
export interface Refund {
  id: string;
  paymentId: string;
  refundAmount: number;
  refundReason: string | null;
  refundStatus: string;
  refundDate: string | null;
  requestedAt: string;
  requestedByName: string | null;
  requestedByEmail: string | null;
  paymentAmount: number;
  paymentStatus: string;
  paymentMethod: string;
  payerName: string | null;
  payerEmail: string | null;
}

/**
 * Whether the whole payment went back.
 *
 * A part refund leaves the payment `paid`, so without saying which is which the
 * list reads as though every payment here was reversed.
 */
export const isFullRefund = (refund: Refund): boolean =>
  refund.refundAmount >= refund.paymentAmount;

const RefundsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { format: formatMoney } = useCurrency();

  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setFailed(false);
      const response = await execute({ method: 'GET', url: '/api/orgadmin/refunds' });
      setRefunds(response ?? []);
    } catch (error) {
      console.error('Failed to load refunds:', error);
      // An empty table and a broken one must not look the same: one says the
      // club has refunded nothing, the other that we cannot tell.
      setFailed(true);
      setRefunds([]);
    } finally {
      setLoading(false);
    }
  }, [execute]);

  useEffect(() => {
    void load();
  }, [load]);

  const sort = useTableSort(refunds, {
    initial: { field: 'requestedAt', direction: 'desc' },
    accessors: {
      requestedBy: (refund) => refund.requestedByName ?? refund.requestedByEmail,
    },
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t('payments.refunds.title')}
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        {t('payments.refunds.subtitle')}
      </Typography>

      <Card>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          <ResponsiveTable identityColumn={t('payments.refunds.payer')} component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <SortableTableCell sort={sort} field="requestedAt">
                    {t('payments.refunds.when')}
                  </SortableTableCell>
                  <SortableTableCell sort={sort} field="payerName">
                    {t('payments.refunds.payer')}
                  </SortableTableCell>
                  <SortableTableCell sort={sort} field="refundAmount" align="right">
                    {t('payments.refunds.amount')}
                  </SortableTableCell>
                  <SortableTableCell sort={sort} field="paymentAmount" align="right">
                    {t('payments.refunds.ofPayment')}
                  </SortableTableCell>
                  <SortableTableCell sort={sort} field="requestedBy">
                    {t('payments.refunds.requestedBy')}
                  </SortableTableCell>
                  <SortableTableCell sort={sort} field="refundReason">
                    {t('payments.refunds.reason')}
                  </SortableTableCell>
                  <SortableTableCell sort={sort} field="refundStatus">
                    {t('payments.refunds.status')}
                  </SortableTableCell>
                  <TableCell align="right">{t('payments.table.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      {t('common.messages.loading')}
                    </TableCell>
                  </TableRow>
                ) : failed ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      {t('payments.refunds.loadFailed')}
                    </TableCell>
                  </TableRow>
                ) : refunds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      {t('payments.refunds.none')}
                    </TableCell>
                  </TableRow>
                ) : (
                  sort.rows.map((refund) => (
                    <TableRow key={refund.id} hover>
                      <TableCell>
                        {formatDateTime(refund.requestedAt, locale)}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {refund.payerName ?? t('payments.unknownPayer')}
                        </Typography>
                        {refund.payerEmail && (
                          <Typography variant="caption" color="textSecondary">
                            {refund.payerEmail}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">{formatMoney(refund.refundAmount)}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatMoney(refund.paymentAmount)}
                        </Typography>
                        {/*
                          Part or whole. Without it a €25 refund of a €185
                          basket reads as a reversed payment.
                        */}
                        <Typography variant="caption" color="textSecondary">
                          {isFullRefund(refund)
                            ? t('payments.refunds.inFull')
                            : t('payments.refunds.inPart')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {refund.requestedByName ??
                          refund.requestedByEmail ??
                          t('payments.refunds.requesterUnknown')}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>
                        <Typography variant="body2">
                          {refund.refundReason ?? '—'}
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
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          aria-label={t('payments.refunds.viewPayment')}
                          onClick={() => navigate(`/payments/${refund.paymentId}`)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RefundsListPage;
