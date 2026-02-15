/**
 * Reporting Dashboard Page
 * 
 * Displays high-level metrics with charts and trends
 * Shows: events, members, revenue trends with date range selector
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Alert,
  Skeleton,
  Button,
  TextField,
  Stack,
} from '@mui/material';
import {
  Event as EventIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon,
  FileDownload as ExportIcon,
} from '@mui/icons-material';
import { useApiGet } from '../../hooks/useApi';
import { useTranslation } from '@aws-web-framework/orgadmin-shell/hooks/useTranslation';
import { formatCurrency } from '@aws-web-framework/orgadmin-shell/utils/currencyFormatting';

/**
 * Reporting dashboard metrics data structure
 */
interface ReportingMetrics {
  events: {
    total: number;
    upcoming: number;
    completed: number;
    totalAttendance: number;
    trend: 'up' | 'down' | 'stable';
    trendPercentage: number;
  };
  members: {
    total: number;
    active: number;
    new: number;
    renewals: number;
    trend: 'up' | 'down' | 'stable';
    trendPercentage: number;
  };
  revenue: {
    total: number;
    events: number;
    memberships: number;
    merchandise: number;
    trend: 'up' | 'down' | 'stable';
    trendPercentage: number;
  };
}

/**
 * Metric card component with trend indicator
 */
interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: 'up' | 'down' | 'stable';
  trendPercentage?: number;
  loading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color,
  trend,
  trendPercentage,
  loading = false,
}) => {
  const { t } = useTranslation();

  const getTrendColor = () => {
    if (trend === 'up') return '#2e7d32';
    if (trend === 'down') return '#d32f2f';
    return '#757575';
  };

  const getTrendIcon = () => {
    if (trend === 'up') return '↑';
    if (trend === 'down') return '↓';
    return '→';
  };

  return (
    <Card
      sx={{
        height: '100%',
        background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
        border: `1px solid ${color}30`,
      }}
    >
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" color="textSecondary" gutterBottom>
            {title}
          </Typography>
          <Box
            sx={{
              bgcolor: `${color}20`,
              borderRadius: '50%',
              p: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>

        {loading ? (
          <Skeleton variant="text" width="60%" height={48} />
        ) : (
          <>
            <Typography variant="h3" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
              {value}
            </Typography>

            {trend && trendPercentage !== undefined && (
              <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                <Typography
                  variant="body2"
                  sx={{
                    color: getTrendColor(),
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {getTrendIcon()} {Math.abs(trendPercentage)}%
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {t('reporting.dashboard.vsPreviousPeriod')}
                </Typography>
              </Box>
            )}

            {subtitle && (
              <Typography variant="body2" color="textSecondary">
                {subtitle}
              </Typography>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Reporting Dashboard Page Component
 */
const ReportingDashboardPage: React.FC = () => {
  const { t, i18n } = useTranslation();

  // Date range state
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const { data, error, loading, execute } = useApiGet<ReportingMetrics>(
    `/api/orgadmin/reports/dashboard?startDate=${startDate}&endDate=${endDate}`
  );

  // Fetch metrics on mount and when date range changes
  useEffect(() => {
    execute();
  }, [execute, startDate, endDate]);

  // Handle export
  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export report for date range:', startDate, 'to', endDate);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {t('reporting.dashboard.title')}
          </Typography>
          <Typography variant="body1" color="textSecondary">
            {t('reporting.dashboard.subtitle')}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<ExportIcon />}
          onClick={handleExport}
          disabled={loading || !data}
        >
          {t('reporting.dashboard.exportReport')}
        </Button>
      </Box>

      {/* Date Range Selector */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('reporting.dashboard.dateRange')}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label={t('reporting.dashboard.startDate')}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label={t('reporting.dashboard.endDate')}
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

      {/* Loading state - show skeleton cards */}
      {loading && !data && (
        <Grid container spacing={3}>
          {[1, 2, 3].map((i) => (
            <Grid item xs={12} md={4} key={i}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="60%" height={32} />
                  <Skeleton variant="text" width="80%" height={48} sx={{ mt: 2 }} />
                  <Skeleton variant="text" width="50%" height={24} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Metrics grid */}
      {!loading && data && (
        <Grid container spacing={3}>
          {/* Events metric */}
          <Grid item xs={12} md={4}>
            <MetricCard
              title={t('reporting.metrics.events')}
              value={data.events.total}
              subtitle={t('reporting.metrics.eventsSubtitle', {
                upcoming: data.events.upcoming,
                completed: data.events.completed,
                totalAttendance: data.events.totalAttendance,
              })}
              icon={<EventIcon sx={{ color: '#1976d2', fontSize: 32 }} />}
              color="#1976d2"
              trend={data.events.trend}
              trendPercentage={data.events.trendPercentage}
            />
          </Grid>

          {/* Members metric */}
          <Grid item xs={12} md={4}>
            <MetricCard
              title={t('reporting.metrics.members')}
              value={data.members.total}
              subtitle={t('reporting.metrics.membersSubtitle', {
                active: data.members.active,
                new: data.members.new,
                renewals: data.members.renewals,
              })}
              icon={<PeopleIcon sx={{ color: '#2e7d32', fontSize: 32 }} />}
              color="#2e7d32"
              trend={data.members.trend}
              trendPercentage={data.members.trendPercentage}
            />
          </Grid>

          {/* Revenue metric */}
          <Grid item xs={12} md={4}>
            <MetricCard
              title={t('reporting.metrics.revenue')}
              value={formatCurrency(data.revenue.total, 'EUR', i18n.language)}
              subtitle={t('reporting.metrics.revenueSubtitle', {
                events: formatCurrency(data.revenue.events, 'EUR', i18n.language),
                memberships: formatCurrency(data.revenue.memberships, 'EUR', i18n.language),
                merchandise: formatCurrency(data.revenue.merchandise, 'EUR', i18n.language),
              })}
              icon={<MoneyIcon sx={{ color: '#ed6c02', fontSize: 32 }} />}
              color="#ed6c02"
              trend={data.revenue.trend}
              trendPercentage={data.revenue.trendPercentage}
            />
          </Grid>
        </Grid>
      )}

      {/* Quick Links to Detailed Reports */}
      {!loading && data && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            {t('reporting.dashboard.detailedReports')}
          </Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={4}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<EventIcon />}
                href="/reporting/events"
                sx={{ py: 2 }}
              >
                {t('reporting.reports.eventsReport')}
              </Button>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<PeopleIcon />}
                href="/reporting/members"
                sx={{ py: 2 }}
              >
                {t('reporting.reports.membersReport')}
              </Button>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<TrendingUpIcon />}
                href="/reporting/revenue"
                sx={{ py: 2 }}
              >
                {t('reporting.reports.revenueReport')}
              </Button>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Empty state - no data available */}
      {!loading && !error && !data && (
        <Alert severity="info" sx={{ mt: 3 }}>
          {t('reporting.dashboard.noData')}
        </Alert>
      )}
    </Box>
  );
};

export default ReportingDashboardPage;
