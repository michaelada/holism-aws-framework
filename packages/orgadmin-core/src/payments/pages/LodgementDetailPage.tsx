/**
 * One lodgement, and the payments that made it up.
 *
 * The screen exists to close a gap that otherwise has to be closed by hand: a
 * club sees €2,104.00 on its bank statement and needs to know which members'
 * money that is, what each of them bought, and why the figure is not the sum of
 * what they were charged.
 *
 * Two money columns, deliberately. **Charged** is what the member paid;
 * **into this lodgement** is what reached the bank. The difference is the
 * platform's cut, and explaining that difference is the whole point.
 *
 * Stripe's own processing fee is *not* shown as a deduction, because under
 * destination charges the platform pays it — it never touches the club's money.
 * Showing it here would understate what the club received and misname who paid
 * it. See docs/LODGEMENTS.md §2.
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
  Collapse,
  Divider,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowRight as CollapsedIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useCurrency } from '../../hooks/useCurrency';
import { useTranslation, useLocale, formatDate } from '@aws-web-framework/orgadmin-shell';
import type { Lodgement } from './LodgementsPage';

interface BasketItem {
  description: string;
  itemType: string;
  quantity: number | null;
  fee: number;
  handlingFee: number;
}

interface LodgementLine {
  id: string;
  type: 'payment' | 'refund' | 'adjustment' | 'other';
  description: string | null;
  createdAt: string;
  net: number;
  currency: string;
  paymentId: string | null;
  memberName: string | null;
  memberEmail: string | null;
  grossCharged: number | null;
  applicationFee: number | null;
  basket: BasketItem[];
}

interface LodgementDetail extends Lodgement {
  lines: LodgementLine[];
  totalCharged: number;
  totalFees: number;
  totalRefunded: number;
}

const STATUS_COLOUR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  paid: 'success',
  pending: 'warning',
  in_transit: 'warning',
  canceled: 'default',
  failed: 'error',
};

const LodgementDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { execute } = useApi();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { format: formatMoney } = useCurrency();

  const [detail, setDetail] = useState<LodgementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);

    // `useApi.execute` returns null on failure rather than throwing, so a
    // `catch` alone would leave this page rendering an empty lodgement as
    // though the payout contained nothing. See the note in LodgementsPage.
    let errored = false;

    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisation/payments/lodgements/${id}`,
        onError: () => {
          errored = true;
        },
      });

      if (errored || !response) setFailed(true);
      else setDetail(response);
    } catch {
      // A flag, not a message: naming `t` here would rebuild this callback on
      // every render and refetch without end.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [execute, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label={t('common.loading')} />
      </Box>
    );
  }

  if (failed || !detail) {
    return (
      <Box sx={{ p: 3 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/payments/lodgements')}>
          {t('payments.lodgements.backToList')}
        </Button>
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('payments.lodgements.detailLoadError')}
        </Alert>
      </Box>
    );
  }

  const rowLabel = (line: LodgementLine): string => {
    if (line.memberName) return line.memberName;
    if (line.type === 'refund') return t('payments.lodgements.lineRefund');
    if (line.type === 'adjustment') return t('payments.lodgements.lineAdjustment');
    return line.description || t('payments.lodgements.lineUnknown');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Button
        startIcon={<BackIcon />}
        onClick={() => navigate('/payments/lodgements')}
        sx={{ mb: 2 }}
      >
        {t('payments.lodgements.backToList')}
      </Button>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 1 }}
      >
        <Typography variant="h4">
          {t('payments.lodgements.detailTitle', {
            date: formatDate(detail.arrivalDate, 'PP', locale),
          })}
        </Typography>
        <Chip
          size="small"
          color={STATUS_COLOUR[detail.status] ?? 'default'}
          label={t(`payments.lodgements.status.${detail.status}`)}
        />
      </Stack>
      {detail.destination && (
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {detail.destination}
        </Typography>
      )}

      {detail.failureMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {detail.failureMessage}
        </Alert>
      )}

      {/* The reconciliation. Whoever opened this page came for this box. */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('payments.lodgements.howThisAddsUp')}
          </Typography>

          <Stack spacing={1}>
            <SummaryRow
              label={t('payments.lodgements.summaryCharged', { count: detail.lines.length })}
              value={formatMoney(detail.totalCharged / 100)}
            />
            <SummaryRow
              label={t('payments.lodgements.summaryFees')}
              value={`− ${formatMoney(detail.totalFees / 100)}`}
            />
            {detail.totalRefunded !== 0 && (
              <SummaryRow
                label={t('payments.lodgements.summaryRefunds')}
                value={formatMoney(detail.totalRefunded / 100)}
              />
            )}
            <Divider />
            <SummaryRow
              label={t('payments.lodgements.summaryIntoBank')}
              value={formatMoney(detail.amount / 100)}
              strong
            />
          </Stack>

          {/*
            Said explicitly, because its absence from the arithmetic above is
            otherwise indistinguishable from an omission.
          */}
          <Alert severity="info" sx={{ mt: 2 }} icon={false}>
            {t('payments.lodgements.stripeFeeNote')}
          </Alert>
        </CardContent>
      </Card>

      <Typography variant="h6" gutterBottom>
        {t('payments.lodgements.paymentsIn')}
      </Typography>

      <TableContainer component={Card} sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 48 }} />
              <TableCell>{t('payments.lodgements.columnMember')}</TableCell>
              <TableCell>{t('payments.lodgements.columnDate')}</TableCell>
              <TableCell align="right">{t('payments.lodgements.columnCharged')}</TableCell>
              <TableCell align="right">{t('payments.lodgements.columnIntoLodgement')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {detail.lines.map((line) => {
              const open = expanded === line.id;
              // Only a resolved payment has a basket to open.
              const expandable = Boolean(line.paymentId);

              return (
                <React.Fragment key={line.id}>
                  <TableRow
                    hover={expandable}
                    onClick={() => expandable && setExpanded(open ? null : line.id)}
                    sx={{ cursor: expandable ? 'pointer' : 'default' }}
                  >
                    <TableCell>
                      {expandable && (
                        <IconButton
                          size="small"
                          aria-label={t(
                            open
                              ? 'payments.lodgements.collapseLine'
                              : 'payments.lodgements.expandLine'
                          )}
                          aria-expanded={open}
                        >
                          {open ? <ExpandIcon /> : <CollapsedIcon />}
                        </IconButton>
                      )}
                    </TableCell>
                    <TableCell>
                      {rowLabel(line)}
                      {/*
                        Shown rather than hidden. A missing row would break the
                        total and read as a bug in the arithmetic; an honest row
                        explains itself.
                      */}
                      {!line.paymentId && line.type === 'payment' && (
                        <Typography variant="body2" color="text.secondary">
                          {t('payments.lodgements.lineUnmatched')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(line.createdAt, 'PP', locale)}</TableCell>
                    <TableCell align="right">
                      {line.grossCharged === null ? '—' : formatMoney(line.grossCharged / 100)}
                    </TableCell>
                    <TableCell align="right">{formatMoney(line.net / 100)}</TableCell>
                  </TableRow>

                  {expandable && (
                    <TableRow>
                      <TableCell sx={{ py: 0, borderBottom: open ? undefined : 'none' }} colSpan={5}>
                        <Collapse in={open} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 2, pl: { xs: 0, sm: 4 } }}>
                            <Typography variant="subtitle2" gutterBottom>
                              {t('payments.lodgements.inTheBasket')}
                            </Typography>

                            <Stack spacing={0.5} sx={{ mb: 2 }}>
                              {line.basket.map((item, index) => (
                                <SummaryRow
                                  key={`${line.id}-${index}`}
                                  label={
                                    item.quantity && item.quantity > 1
                                      ? `${item.description} × ${item.quantity}`
                                      : item.description
                                  }
                                  value={formatMoney(item.fee / 100)}
                                />
                              ))}
                            </Stack>

                            <Divider />
                            <Stack spacing={0.5} sx={{ mt: 1 }}>
                              <SummaryRow
                                label={t('payments.lodgements.chargedToMember')}
                                value={formatMoney((line.grossCharged ?? 0) / 100)}
                              />
                              <SummaryRow
                                label={t('payments.lodgements.platformFee')}
                                value={`− ${formatMoney((line.applicationFee ?? 0) / 100)}`}
                              />
                              <Divider />
                              <SummaryRow
                                label={t('payments.lodgements.intoThisLodgement')}
                                value={formatMoney(line.net / 100)}
                                strong
                              />
                            </Stack>

                            <Box sx={{ mt: 2 }}>
                              {/* This screen reports; the payment page acts. */}
                              <Button
                                size="small"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  navigate(`/payments/${line.paymentId}`);
                                }}
                              >
                                {t('payments.lodgements.viewPayment')}
                              </Button>
                            </Box>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}

            {/* The reconciliation the whole screen is for. */}
            <TableRow>
              <TableCell colSpan={4} sx={{ fontWeight: 600 }}>
                {t('payments.lodgements.total')}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                {formatMoney(detail.amount / 100)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

/** Label left, money right — the shape every figure on this page takes. */
const SummaryRow: React.FC<{ label: string; value: string; strong?: boolean }> = ({
  label,
  value,
  strong,
}) => (
  <Stack
    direction={{ xs: 'column', sm: 'row' }}
    justifyContent="space-between"
    sx={{ fontWeight: strong ? 600 : undefined }}
  >
    <Typography variant="body2" sx={{ fontWeight: 'inherit' }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 'inherit' }}>
      {value}
    </Typography>
  </Stack>
);

export default LodgementDetailPage;
