/**
 * Events Report Page
 * 
 * Shows event attendance and revenue with filters and export functionality
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveTable, SortableTableCell } from '../../components';
import { useTableSort } from '../../hooks/useTableSort';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Skeleton,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useApi, useApiGet } from '../../hooks/useApi';
import { exportReport } from '../exportReport';
import { useOrganisation } from '../../context/OrganisationContext';
import { useTranslation } from '@aws-web-framework/orgadmin-shell/hooks/useTranslation';
import { formatDate } from '@aws-web-framework/orgadmin-shell/utils/dateFormatting';

/**
 * Event report row, matching the backend reporting service shape
 */
interface EventActivityRow {
  activityId: string;
  activityName: string;
  entries: number;
  revenue: number;
}

interface EventReportRow {
  eventId: string;
  eventName: string;
  startDate: string;
  endDate: string;
  totalEntries: number;
  totalRevenue: number;
  activities: EventActivityRow[];
}

/**
 * Events Report Page Component
 */
const EventsReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { format: formatMoney } = useCurrency();
  const { organisation } = useOrganisation();

  // Filter state
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const { data, error, loading, execute } = useApiGet<EventReportRow[]>(
    `/api/orgadmin/organisations/${organisation?.id}/reports/events?startDate=${startDate}&endDate=${endDate}`
  );

  // Fetch report on mount and when filters change
  useEffect(() => {
    if (!organisation?.id) return;
    execute();
  }, [execute, startDate, endDate, organisation?.id]);

  const events = data ?? [];

  // Summary totals are derived from the per-event rows
  const summary = useMemo(
    () => ({
      totalEvents: events.length,
      totalEntries: events.reduce((sum, e) => sum + e.totalEntries, 0),
      totalRevenue: events.reduce((sum, e) => sum + e.totalRevenue, 0),
    }),
    [events]
  );

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
      await exportReport(runExport, organisation.id, 'events', { startDate, endDate });
    } catch {
      setExportError(t('reporting.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const sort = useTableSort(events, {
    accessors: {
      // How many classes, which is what the column leads with.
      activities: (event) => event.activities.length,
    },
  });

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
          disabled={loading || exporting || !data}
        >
          {exporting ? t('reporting.exporting') : t('reporting.exportToExcel')}
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
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {t('reporting.events.summary.totalEvents')}
                </Typography>
                <Typography variant="h4">{summary.totalEvents}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {t('reporting.events.summary.totalEntries')}
                </Typography>
                <Typography variant="h4">{summary.totalEntries}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {t('reporting.events.summary.totalRevenue')}
                </Typography>
                <Typography variant="h4">
                  {formatMoney(summary.totalRevenue)}
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

          {!loading && data && events.length > 0 && (
            <ResponsiveTable identityColumn={t('reporting.events.table.eventName')} component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <SortableTableCell sort={sort} field="eventName">
                      {t('reporting.events.table.eventName')}
                    </SortableTableCell>
                    <SortableTableCell sort={sort} field="startDate">
                      {t('reporting.events.table.dateRange')}
                    </SortableTableCell>
                    <SortableTableCell sort={sort} field="totalEntries" align="right">
                      {t('reporting.events.table.entries')}
                    </SortableTableCell>
                    <SortableTableCell sort={sort} field="totalRevenue" align="right">
                      {t('reporting.events.table.revenue')}
                    </SortableTableCell>
                    <SortableTableCell sort={sort} field="activities">
                      {t('reporting.events.table.activities')}
                    </SortableTableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sort.rows.map((event) => (
                    <TableRow key={event.eventId} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {event.eventName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(new Date(event.startDate), 'dd MMM yyyy', i18n.language)} - {formatDate(new Date(event.endDate), 'dd MMM yyyy', i18n.language)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{event.totalEntries}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatMoney(event.totalRevenue)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="textSecondary">
                          {t('reporting.events.table.activitiesCount', { count: event.activities.length })}
                        </Typography>
                        {event.activities.map((activity) => (
                          <Typography
                            key={activity.activityId}
                            variant="caption"
                            display="block"
                            color="textSecondary"
                          >
                            {activity.activityName}: {activity.entries} {t('reporting.events.table.entries').toLowerCase()}, {formatMoney(activity.revenue)}
                          </Typography>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}

          {!loading && data && events.length === 0 && (
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
