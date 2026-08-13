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
  FormControl,
  InputLabel,
  Select,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Event as EventIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon,
  FileDownload as ExportIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useApi, useApiGet } from '../../hooks/useApi';
import { exportReport, ReportType } from '../exportReport';
import { useOrganisation } from '../../context/OrganisationContext';
import { useTranslation } from '@aws-web-framework/orgadmin-shell/hooks/useTranslation';
import { formatCurrency } from '@aws-web-framework/orgadmin-shell/utils/currencyFormatting';

/**
 * Reporting dashboard metrics data structure
 */
interface ReportingMetrics {
  totalEvents: number;
  totalMembers: number;
  totalRevenue: number;
  totalPayments: number;
  recentEvents: number;
  recentMembers: number;
  recentRevenue: number;
  recentPayments: number;
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
  const { organisation } = useOrganisation();
  const navigate = useNavigate();

  // Recent activity window (days), matching the backend's recentDays parameter
  const [recentDays, setRecentDays] = useState<number>(30);

  const { data, error, loading, execute } = useApiGet<ReportingMetrics>(
    `/api/orgadmin/organisations/${organisation?.id}/reports/dashboard?recentDays=${recentDays}`
  );

  // Fetch metrics on mount and when the window changes
  useEffect(() => {
    if (!organisation?.id) return;
    execute();
  }, [execute, recentDays, organisation?.id]);

  /*
   * The dashboard summarises three reports and is not one itself, so there is
   * no "the dashboard report" to download. The button offers the three, over
   * the window the dashboard is currently showing.
   */
  const { execute: runExport } = useApi<Blob>();
  const [exportMenu, setExportMenu] = useState<HTMLElement | null>(null);
  const [exporting, setExporting] = useState<ReportType | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const windowStart = () => {
    const from = new Date();
    from.setDate(from.getDate() - recentDays);
    return from.toISOString().split('T')[0];
  };

  const handleExport = async (reportType: ReportType) => {
    setExportMenu(null);
    if (!organisation?.id) return;

    setExporting(reportType);
    setExportError(null);
    try {
      await exportReport(runExport, organisation.id, reportType, {
        startDate: windowStart(),
        endDate: new Date().toISOString().split('T')[0],
      });
    } catch {
      setExportError(t('reporting.exportFailed'));
    } finally {
      setExporting(null);
    }
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
          onClick={(event) => setExportMenu(event.currentTarget)}
          disabled={loading || exporting !== null || !data}
        >
          {exporting ? t('reporting.exporting') : t('reporting.dashboard.exportReport')}
        </Button>
        <Menu
          anchorEl={exportMenu}
          open={Boolean(exportMenu)}
          onClose={() => setExportMenu(null)}
        >
          {(['events', 'members', 'revenue'] as ReportType[]).map((reportType) => (
            <MenuItem key={reportType} onClick={() => handleExport(reportType)}>
              {t(`reporting.${reportType}.title`)}
            </MenuItem>
          ))}
        </Menu>
      </Box>

      {/* Recent activity window selector */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('reporting.dashboard.period')}
          </Typography>
          <FormControl sx={{ minWidth: 240 }}>
            <InputLabel id="reporting-period-label">
              {t('reporting.dashboard.period')}
            </InputLabel>
            <Select
              labelId="reporting-period-label"
              label={t('reporting.dashboard.period')}
              value={recentDays}
              onChange={(e) => setRecentDays(Number(e.target.value))}
            >
              {[7, 30, 90].map((days) => (
                <MenuItem key={days} value={days}>
                  {t('reporting.dashboard.lastNDays', { days })}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
              value={data.totalEvents}
              subtitle={t('reporting.metrics.recentSubtitle', {
                count: data.recentEvents,
                days: recentDays,
              })}
              icon={<EventIcon sx={{ color: '#1976d2', fontSize: 32 }} />}
              color="#1976d2"
            />
          </Grid>

          {/* Members metric */}
          <Grid item xs={12} md={4}>
            <MetricCard
              title={t('reporting.metrics.members')}
              value={data.totalMembers}
              subtitle={t('reporting.metrics.recentSubtitle', {
                count: data.recentMembers,
                days: recentDays,
              })}
              icon={<PeopleIcon sx={{ color: '#2e7d32', fontSize: 32 }} />}
              color="#2e7d32"
            />
          </Grid>

          {/* Revenue metric */}
          <Grid item xs={12} md={4}>
            <MetricCard
              title={t('reporting.metrics.revenue')}
              value={formatCurrency(data.totalRevenue, 'EUR', i18n.language)}
              subtitle={t('reporting.metrics.recentSubtitle', {
                count: formatCurrency(data.recentRevenue, 'EUR', i18n.language),
                days: recentDays,
              })}
              icon={<MoneyIcon sx={{ color: '#ed6c02', fontSize: 32 }} />}
              color="#ed6c02"
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
                onClick={() => navigate('/reporting/events')}
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
                onClick={() => navigate('/reporting/members')}
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
                onClick={() => navigate('/reporting/revenue')}
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
