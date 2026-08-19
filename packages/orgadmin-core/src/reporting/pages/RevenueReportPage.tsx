/**
 * Revenue Report Page
 * 
 * Shows revenue breakdown by source with charts and export functionality
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useCurrency } from '../../hooks/useCurrency';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  Button,
  TextField,
  Stack,
  Skeleton,
  Grid,
  LinearProgress,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  ArrowBack as BackIcon,
  Event as EventIcon,
  People as PeopleIcon,
  ShoppingCart as MerchandiseIcon,
  CalendarToday as CalendarIcon,
  ConfirmationNumber as TicketIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useApi, useApiGet } from '../../hooks/useApi';
import { exportReport } from '../exportReport';
import { useOrganisation } from '../../context/OrganisationContext';
import { useTranslation } from '@aws-web-framework/orgadmin-shell/hooks/useTranslation';

/**
 * Revenue source row, matching the backend reporting service shape
 */
interface RevenueSourceRow {
  source: string;
  totalRevenue: number;
  transactionCount: number;
  averageTransaction: number;
  currency: string;
}

/**
 * Revenue Report Page Component
 */
const RevenueReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { format: formatMoney } = useCurrency();
  const { organisation } = useOrganisation();

  // Filter state
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const { data, error, loading, execute } = useApiGet<RevenueSourceRow[]>(
    `/api/orgadmin/organisations/${organisation?.id}/reports/revenue?startDate=${startDate}&endDate=${endDate}`
  );

  // Fetch report on mount and when filters change
  useEffect(() => {
    if (!organisation?.id) return;
    execute();
  }, [execute, startDate, endDate, organisation?.id]);

  const sources = data ?? [];

  // Summary and per-source share are derived from the source rows
  const summary = useMemo(() => {
    const totalRevenue = sources.reduce((s, r) => s + r.totalRevenue, 0);
    const totalTransactions = sources.reduce((s, r) => s + r.transactionCount, 0);
    const top = sources.reduce<RevenueSourceRow | null>(
      (best, r) => (!best || r.totalRevenue > best.totalRevenue ? r : best),
      null
    );
    return {
      totalRevenue,
      totalTransactions,
      averageTransactionValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
      topSource: top?.source ?? '',
    };
  }, [sources]);

  // Format percentage
  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  // Get source icon
  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'events':
        return <EventIcon />;
      case 'memberships':
        return <PeopleIcon />;
      case 'merchandise':
        return <MerchandiseIcon />;
      case 'calendar':
        return <CalendarIcon />;
      case 'tickets':
        return <TicketIcon />;
      default:
        return <EventIcon />;
    }
  };

  // Get source color
  const getSourceColor = (source: string): string => {
    switch (source) {
      case 'events':
        return '#1976d2';
      case 'memberships':
        return '#2e7d32';
      case 'merchandise':
        return '#ed6c02';
      case 'calendar':
        return '#9c27b0';
      case 'registrations':
        return '#0288d1';
      case 'tickets':
        return '#d32f2f';
      default:
        return '#757575';
    }
  };

  // Handle export
  /*
   * The workbook is the server's to build — it has the same queries this page
   * reads, and rows the page never fetched. A failure is shown rather than
   * logged: an export that does nothing looks identical to one that is still
   * running.
   */
  const { execute: runExport } = useApi<Blob>();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!organisation?.id) return;

    setExporting(true);
    setExportError(null);
    try {
      await exportReport(runExport, organisation.id, 'revenue', { startDate, endDate });
    } catch {
      setExportError(t('reporting.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/reporting')}
            sx={{ mb: 1 }}
          >
            {t('reporting.revenue.backToReports')}
          </Button>
          <Typography variant="h4" gutterBottom>
            {t('reporting.revenue.title')}
          </Typography>
          <Typography variant="body1" color="textSecondary">
            {t('reporting.revenue.subtitle')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<ExportIcon />}
          onClick={handleExport}
          disabled={loading || exporting || !data}
        >
          {exporting ? t('reporting.exporting') : t('reporting.exportToExcel')}
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('reporting.revenue.dateRange')}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label={t('reporting.filters.startDate')}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label={t('reporting.filters.endDate')}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Error state */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {exportError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setExportError(null)}>
          {exportError}
        </Alert>
      )}

      {/* Summary Cards */}
      {!loading && data && (
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {t('reporting.revenue.summary.totalRevenue')}
                  </Typography>
                  <Typography variant="h4">
                    {formatMoney(summary.totalRevenue)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {t('reporting.revenue.summary.totalTransactions')}
                  </Typography>
                  <Typography variant="h4">{summary.totalTransactions}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {t('reporting.revenue.summary.avgTransaction')}
                  </Typography>
                  <Typography variant="h4">
                    {formatMoney(summary.averageTransactionValue)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {t('reporting.revenue.summary.topSource')}
                  </Typography>
                  <Typography variant="h4" sx={{ textTransform: 'capitalize' }}>
                    {summary.topSource ? t(`reporting.revenue.sources.${summary.topSource}`) : '-'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Revenue by Source */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('reporting.revenue.revenueBySource')}
          </Typography>

          {loading && (
            <Box>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rectangular" height={80} sx={{ mb: 2 }} />
              ))}
            </Box>
          )}

          {!loading && data && sources.length > 0 && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              {sources.map((source) => {
                const percentage =
                  summary.totalRevenue > 0
                    ? (source.totalRevenue / summary.totalRevenue) * 100
                    : 0;
                return (
                  <Box key={source.source}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box
                          sx={{
                            color: getSourceColor(source.source),
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {getSourceIcon(source.source)}
                        </Box>
                        <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                          {t(`reporting.revenue.sources.${source.source}`)}
                        </Typography>
                      </Box>
                      <Box textAlign="right">
                        <Typography variant="body1" fontWeight="medium">
                          {formatMoney(source.totalRevenue)}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {t('reporting.revenue.table.transactions', { count: source.transactionCount })}
                        </Typography>
                      </Box>
                    </Box>
                    <Box display="flex" alignItems="center" gap={1}>
                      <LinearProgress
                        variant="determinate"
                        value={percentage}
                        sx={{
                          flex: 1,
                          height: 8,
                          borderRadius: 4,
                          bgcolor: `${getSourceColor(source.source)}20`,
                          '& .MuiLinearProgress-bar': {
                            bgcolor: getSourceColor(source.source),
                          },
                        }}
                      />
                      <Typography variant="body2" color="textSecondary" sx={{ minWidth: 45 }}>
                        {formatPercentage(percentage)}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )}

          {!loading && data && sources.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {t('reporting.revenue.noData')}
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default RevenueReportPage;
