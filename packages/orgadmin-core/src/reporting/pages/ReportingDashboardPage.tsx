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
                  vs previous period
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

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

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
            Reports & Analytics
          </Typography>
          <Typography variant="body1" color="textSecondary">
            High-level metrics and trends for your organisation
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<ExportIcon />}
          onClick={handleExport}
          disabled={loading || !data}
        >
          Export Report
        </Button>
      </Box>

      {/* Date Range Selector */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Date Range
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="End Date"
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
              title="Events"
              value={data.events.total}
              subtitle={`${data.events.upcoming} upcoming, ${data.events.completed} completed, ${data.events.totalAttendance} total attendance`}
              icon={<EventIcon sx={{ color: '#1976d2', fontSize: 32 }} />}
              color="#1976d2"
              trend={data.events.trend}
              trendPercentage={data.events.trendPercentage}
            />
          </Grid>

          {/* Members metric */}
          <Grid item xs={12} md={4}>
            <MetricCard
              title="Members"
              value={data.members.total}
              subtitle={`${data.members.active} active, ${data.members.new} new, ${data.members.renewals} renewals`}
              icon={<PeopleIcon sx={{ color: '#2e7d32', fontSize: 32 }} />}
              color="#2e7d32"
              trend={data.members.trend}
              trendPercentage={data.members.trendPercentage}
            />
          </Grid>

          {/* Revenue metric */}
          <Grid item xs={12} md={4}>
            <MetricCard
              title="Revenue"
              value={formatCurrency(data.revenue.total)}
              subtitle={`Events: ${formatCurrency(data.revenue.events)}, Memberships: ${formatCurrency(data.revenue.memberships)}, Merchandise: ${formatCurrency(data.revenue.merchandise)}`}
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
            Detailed Reports
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
                Events Report
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
                Members Report
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
                Revenue Report
              </Button>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Empty state - no data available */}
      {!loading && !error && !data && (
        <Alert severity="info" sx={{ mt: 3 }}>
          No reporting data available for the selected date range. Please try a different date range.
        </Alert>
      )}
    </Box>
  );
};

export default ReportingDashboardPage;
