/**
 * What a discount has actually done.
 *
 * The list's *View Usage* icon has always navigated to `…/discounts/:id/stats`;
 * no module ever registered that path, so every club that clicked it got Page
 * Not Found. This is the page it was reaching for.
 *
 * Shared the way `DiscountsListPage` is — one implementation, a `moduleType`
 * for the base path — because a discount on a membership and a discount on an
 * entry are the same record read the same way, and five copies of this page
 * would disagree within a month.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ArrowBack as BackIcon, Edit as EditIcon } from '@mui/icons-material';
import {
  useApi,
  useOrganisation,
  SortableTableCell,
  useTableSort,
} from '@itsplainsailing/orgadmin-core';
import { useTranslation, formatCurrency, useLocale } from '@itsplainsailing/orgadmin-shell';
import type { Discount, DiscountStatus } from '../types/discount.types';

export interface DiscountUsage {
  totalUses: number;
  /** Absent where the discount has no cap — not zero, which reads as used up. */
  remainingUses?: number;
  totalDiscountGiven: number;
  averageDiscountAmount: number;
  topUsers: Array<{
    userId: string;
    name?: string;
    usageCount: number;
    totalDiscountReceived: number;
  }>;
}

interface DiscountUsagePageProps {
  moduleType?: 'events' | 'memberships' | 'registrations' | 'merchandise' | 'calendar';
}

/** The module's own section of the org-admin, so Back lands where they came from. */
export const basePathFor = (moduleType: string): string =>
  ({
    memberships: '/members',
    registrations: '/registrations',
    merchandise: '/merchandise',
    calendar: '/calendar',
  })[moduleType] || '/events';

export const statusColour = (status: DiscountStatus): 'success' | 'default' | 'error' => {
  switch (status) {
    case 'active':
      return 'success';
    case 'expired':
      return 'error';
    default:
      return 'default';
  }
};

/** One array, so a page with no usage yet does not re-sort on every render. */
const NO_USERS: DiscountUsage['topUsers'] = [];

const DiscountUsagePage: React.FC<DiscountUsagePageProps> = ({ moduleType = 'events' }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  const { t } = useTranslation();
  const { locale } = useLocale();

  const [discount, setDiscount] = useState<Discount | null>(null);
  const [usage, setUsage] = useState<DiscountUsage | null>(null);

  /*
   * The server returns these in its own order — most uses first. Sorting is
   * offered on top of that rather than instead of it: the list opens as it
   * arrived, and a click reorders it.
   */
  const sort = useTableSort(usage?.topUsers ?? NO_USERS);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const base = basePathFor(moduleType);
  const money = (amount: number) =>
    formatCurrency(amount, organisation?.currency || 'EUR', locale);

  const load = useCallback(async () => {
    if (!id || !organisation?.id) return;

    setLoading(true);
    setFailed(false);
    try {
      /*
       * Both together: the numbers mean little without the discount they belong
       * to — "12 uses" of what, and against which cap.
       */
      const [detail, stats] = await Promise.all([
        execute({
          method: 'GET',
          url: `/api/orgadmin/discounts/${id}?organisationId=${organisation.id}`,
        }),
        execute({ method: 'GET', url: `/api/orgadmin/discounts/${id}/stats` }),
      ]);

      if (!detail) {
        setFailed(true);
        return;
      }
      setDiscount(detail);
      setUsage(stats);
    } catch (error) {
      console.error('Failed to load discount usage:', error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [execute, id, organisation?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (failed || !discount) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('discounts.usage.notFound')}
        </Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate(`${base}/discounts`)}>
          {t('discounts.usage.backToDiscounts')}
        </Button>
      </Box>
    );
  }

  const figures: Array<{ label: string; value: string }> = [
    { label: t('discounts.usage.timesUsed'), value: String(usage?.totalUses ?? 0) },
    { label: t('discounts.usage.totalGiven'), value: money(usage?.totalDiscountGiven ?? 0) },
    { label: t('discounts.usage.average'), value: money(usage?.averageDiscountAmount ?? 0) },
    {
      label: t('discounts.usage.remaining'),
      value:
        usage?.remainingUses === undefined
          ? t('discounts.usage.noLimit')
          : String(usage.remainingUses),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Typography variant="h4">{discount.name}</Typography>
        <Chip
          label={t(`discounts.status.${discount.status}`)}
          color={statusColour(discount.status)}
          size="small"
        />
      </Box>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        {discount.code
          ? t('discounts.usage.subtitleWithCode', { code: discount.code })
          : t('discounts.usage.subtitle')}
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {figures.map((figure) => (
          <Grid item xs={12} sm={6} md={3} key={figure.label}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary">
                  {figure.label}
                </Typography>
                <Typography variant="h5">{figure.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('discounts.usage.whoUsedIt')}
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {/*
          A discount nobody has used yet is the ordinary case for one just
          created, and says so — a table of nothing under four zeroes reads as a
          page that failed to load.
        */}
        {(usage?.topUsers.length ?? 0) === 0 ? (
          <Typography variant="body2">{t('discounts.usage.notUsedYet')}</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <SortableTableCell sort={sort} field="name">
                  {t('discounts.usage.member')}
                </SortableTableCell>
                <SortableTableCell sort={sort} field="usageCount" align="right">
                  {t('discounts.usage.uses')}
                </SortableTableCell>
                <SortableTableCell sort={sort} field="totalDiscountReceived" align="right">
                  {t('discounts.usage.received')}
                </SortableTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sort.rows.map((user) => (
                <TableRow key={user.userId}>
                  {/* A member since removed still counts as a use. */}
                  <TableCell>{user.name || t('discounts.usage.unknownMember')}</TableCell>
                  <TableCell align="right">{user.usageCount}</TableCell>
                  <TableCell align="right">{money(user.totalDiscountReceived)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate(`${base}/discounts`)}>
          {t('discounts.usage.backToDiscounts')}
        </Button>
        <Button
          startIcon={<EditIcon />}
          onClick={() => navigate(`${base}/discounts/${discount.id}/edit`)}
        >
          {t('discounts.tooltips.edit')}
        </Button>
      </Box>
    </Box>
  );
};

export default DiscountUsagePage;
