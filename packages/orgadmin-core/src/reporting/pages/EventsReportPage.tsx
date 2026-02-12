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

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-IE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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
            onClick={() => navigate('/orgadmin/reporting')}
            sx={{ mb: 1 }}
          >
            Back to Reports
          </Button>
          <Typography variant="h4" gutterBottom>
            Events Report
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Event attendance and revenue analysis
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<ExportIcon />}
          onClick={handleExport}
          disabled={loading || !data}
        >
          Export to CSV
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Filters
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
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="published">Published</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
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
                  Total Events
                </Typography>
                <Typography variant="h4">{data.summary.totalEvents}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Total Entries
                </Typography>
                <Typography variant="h4">{data.summary.totalEntries}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Total Revenue
                </Typography>
                <Typography variant="h4">
                  {formatCurrency(data.summary.totalRevenue)}
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
            Event Details
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
                    <TableCell>Event Name</TableCell>
                    <TableCell>Date Range</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Entries</TableCell>
                    <TableCell align="right">Revenue</TableCell>
                    <TableCell>Activities</TableCell>
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
                          {formatDate(event.startDate)} - {formatDate(event.endDate)}
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
                          {formatCurrency(event.totalRevenue)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="textSecondary">
                          {event.activities.length} activities
                        </Typography>
                        {event.activities.map((activity, idx) => (
                          <Typography
                            key={idx}
                            variant="caption"
                            display="block"
                            color="textSecondary"
                          >
                            {activity.name}: {activity.entries} entries, {formatCurrency(activity.revenue)}
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
              No events found for the selected filters. Try adjusting your date range or status filter.
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default EventsReportPage;
