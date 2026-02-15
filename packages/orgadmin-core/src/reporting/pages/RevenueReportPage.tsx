/**
 * Revenue Report Page
 * 
 * Shows revenue breakdown by source with charts and export functionality
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  Button,
  TextField,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
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
import { useApiGet } from '../../hooks/useApi';
import { useTranslation } from '@aws-web-framework/orgadmin-shell/hooks/useTranslation';
import { formatCurrency } from '@aws-web-framework/orgadmin-shell/utils/currencyFormatting';

/**
 * Revenue source data structure
 */
interface RevenueSource {
  source: 'events' | 'memberships' | 'merchandise' | 'calendar' | 'registrations' | 'tickets';
  amount: number;
  percentage: number;
  transactionCount: number;
}

interface MonthlyRevenue {
  month: string;
  events: number;
  memberships: number;
  merchandise: number;
  calendar: number;
  registrations: number;
  tickets: number;
  total: number;
}

interface RevenueReportData {
  sources: RevenueSource[];
  monthlyBreakdown: MonthlyRevenue[];
  summary: {
    totalRevenue: number;
    totalTransactions: number;
    averageTransactionValue: number;
    topSource: string;
  };
}

/**
 * Revenue Report Page Component
 */
const RevenueReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  // Filter state
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const { data, error, loading, execute } = useApiGet<RevenueReportData>(
    `/api/orgadmin/reports/revenue?startDate=${startDate}&endDate=${endDate}`
  );

  // Fetch report on mount and when filters change
  useEffect(() => {
    execute();
  }, [execute, startDate, endDate]);

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
  const handleExport = () => {
    // TODO: Implement CSV export functionality
    console.log('Export revenue report for date range:', startDate, 'to', endDate);
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
          disabled={loading || !data}
        >
          {t('reporting.revenue.exportToCSV')}
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
                    {formatCurrency(data.summary.totalRevenue, 'EUR', i18n.language)}
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
                  <Typography variant="h4">{data.summary.totalTransactions}</Typography>
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
                    {formatCurrency(data.summary.averageTransactionValue, 'EUR', i18n.language)}
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
                    {t(`reporting.revenue.sources.${data.summary.topSource}`)}
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

          {!loading && data && data.sources.length > 0 && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              {data.sources.map((source) => (
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
                        {formatCurrency(source.amount, 'EUR', i18n.language)}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {t('reporting.revenue.table.transactions', { count: source.transactionCount })}
                      </Typography>
                    </Box>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    <LinearProgress
                      variant="determinate"
                      value={source.percentage}
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
                      {formatPercentage(source.percentage)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          )}

          {!loading && data && data.sources.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {t('reporting.revenue.noData')}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('reporting.revenue.monthlyBreakdown')}
          </Typography>

          {loading && (
            <Box>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rectangular" height={60} sx={{ mb: 1 }} />
              ))}
            </Box>
          )}

          {!loading && data && data.monthlyBreakdown.length > 0 && (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('reporting.revenue.table.month')}</TableCell>
                    <TableCell align="right">{t('reporting.revenue.table.events')}</TableCell>
                    <TableCell align="right">{t('reporting.revenue.table.memberships')}</TableCell>
                    <TableCell align="right">{t('reporting.revenue.table.merchandise')}</TableCell>
                    <TableCell align="right">{t('reporting.revenue.table.calendar')}</TableCell>
                    <TableCell align="right">{t('reporting.revenue.table.registrations')}</TableCell>
                    <TableCell align="right">{t('reporting.revenue.table.tickets')}</TableCell>
                    <TableCell align="right">{t('reporting.revenue.table.total')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.monthlyBreakdown.map((month) => (
                    <TableRow key={month.month} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {month.month}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(month.events, 'EUR', i18n.language)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(month.memberships, 'EUR', i18n.language)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(month.merchandise, 'EUR', i18n.language)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(month.calendar, 'EUR', i18n.language)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(month.registrations, 'EUR', i18n.language)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(month.tickets, 'EUR', i18n.language)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold">
                          {formatCurrency(month.total, 'EUR', i18n.language)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {!loading && data && data.monthlyBreakdown.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {t('reporting.revenue.noMonthlyData')}
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default RevenueReportPage;
