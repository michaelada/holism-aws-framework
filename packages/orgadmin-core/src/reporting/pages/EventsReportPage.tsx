/**
 * Events Report Page
 * 
 * Shows event attendance and revenue with filters and export functionality
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
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Skeleton,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useApiGet } from '../../hooks/useApi';
import { useTranslation } from '@aws-web-framework/orgadmin-shell/hooks/useTranslation';
import { formatCurrency } from '@aws-web-framework/orgadmin-shell/utils/currencyFormatting';
import { formatDate } from '@aws-web-framework/orgadmin-shell/utils/dateFormatting';

/**
 * Event report data structure
 */
interface EventReport {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  totalEntries: number;
  totalRevenue: number;
  activities: {
    name: string;
    entries: number;
    revenue: number;
  }[];
}

interface EventsReportData {
  events: EventReport[];
  summary: {
    totalEvents: number;
    totalEntries: number;
    totalRevenue: number;
  };
}

/**
 * Events Report Page Component
 */
const EventsReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  // Filter state
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, error, loading, execute } = useApiGet<EventsReportData>(
    `/api/orgadmin/reports/events?startDate=${startDate}&endDate=${endDate}&status=${statusFilter}`
  );

  // Fetch report on mount and when filters change
  useEffect(() => {
    execute();
  }, [execute, startDate, endDate, statusFilter]);

  // Get status color
  const getStatusColor = (status: string): 'default' | 'primary' | 'success' | 'error' => {
    switch (status) {
      case 'published':
        return 'primary';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  // Handle export
  const handleExport = () => {
    // TODO: Implement CSV export functionality
    console.log('Export events report for date range:', startDate, 'to', endDate);
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
            {t('reporting.events.backToReports')}
          </Button>
          <Typography variant="h4" gutterBottom>
            {t('reporting.events.title')}
          </Typography>
          <Typography variant="body1" color="textSecondary">
            {t('reporting.events.subtitle')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<ExportIcon />}
          onClick={handleExport}
          disabled={loading || !data}
        >
          {t('reporting.events.exportToCSV')}
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('reporting.events.filters')}
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
            <FormControl fullWidth>
              <InputLabel>{t('reporting.filters.status')}</InputLabel>
              <Select
                value={statusFilter}
                label={t('reporting.filters.status')}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">{t('reporting.filters.all')}</MenuItem>
                <MenuItem value="draft">{t('reporting.filters.draft')}</MenuItem>
                <MenuItem value="published">{t('reporting.filters.published')}</MenuItem>
                <MenuItem value="completed">{t('reporting.filters.completed')}</MenuItem>
                <MenuItem value="cancelled">{t('reporting.filters.cancelled')}</MenuItem>
              </Select>
            </FormControl>
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
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {t('reporting.events.summary.totalEvents')}
                </Typography>
                <Typography variant="h4">{data.summary.totalEvents}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {t('reporting.events.summary.totalEntries')}
                </Typography>
                <Typography variant="h4">{data.summary.totalEntries}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {t('reporting.events.summary.totalRevenue')}
                </Typography>
                <Typography variant="h4">
                  {formatCurrency(data.summary.totalRevenue, 'EUR', i18n.language)}
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      )}

      {/* Events Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('reporting.events.eventDetails')}
          </Typography>

          {loading && (
            <Box>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rectangular" height={60} sx={{ mb: 1 }} />
              ))}
            </Box>
          )}

          {!loading && data && data.events.length > 0 && (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('reporting.events.table.eventName')}</TableCell>
                    <TableCell>{t('reporting.events.table.dateRange')}</TableCell>
                    <TableCell>{t('reporting.events.table.status')}</TableCell>
                    <TableCell align="right">{t('reporting.events.table.entries')}</TableCell>
                    <TableCell align="right">{t('reporting.events.table.revenue')}</TableCell>
                    <TableCell>{t('reporting.events.table.activities')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.events.map((event) => (
                    <TableRow key={event.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {event.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(new Date(event.startDate), 'dd MMM yyyy', i18n.language)} - {formatDate(new Date(event.endDate), 'dd MMM yyyy', i18n.language)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={event.status}
                          size="small"
                          color={getStatusColor(event.status)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{event.totalEntries}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(event.totalRevenue, 'EUR', i18n.language)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="textSecondary">
                          {t('reporting.events.table.activitiesCount', { count: event.activities.length })}
                        </Typography>
                        {event.activities.map((activity, idx) => (
                          <Typography
                            key={idx}
                            variant="caption"
                            display="block"
                            color="textSecondary"
                          >
                            {activity.name}: {activity.entries} {t('reporting.events.table.entries').toLowerCase()}, {formatCurrency(activity.revenue, 'EUR', i18n.language)}
                          </Typography>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {!loading && data && data.events.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {t('reporting.events.noData')}
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default EventsReportPage;
