/**
 * Members Report Page
 * 
 * Shows membership growth and retention with filters and export functionality
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
  Grid,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  ArrowBack as BackIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useApiGet } from '../../hooks/useApi';

/**
 * Membership type report data structure
 */
interface MembershipTypeReport {
  id: string;
  name: string;
  totalMembers: number;
  activeMembers: number;
  newMembers: number;
  renewals: number;
  expiringMembers: number;
  revenue: number;
}

interface MembersReportData {
  membershipTypes: MembershipTypeReport[];
  summary: {
    totalMembers: number;
    activeMembers: number;
    newMembers: number;
    renewals: number;
    expiringMembers: number;
    totalRevenue: number;
    growthRate: number;
    retentionRate: number;
  };
}

/**
 * Members Report Page Component
 */
const MembersReportPage: React.FC = () => {
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

  const { data, error, loading, execute } = useApiGet<MembersReportData>(
    `/api/orgadmin/reports/members?startDate=${startDate}&endDate=${endDate}&status=${statusFilter}`
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

  // Format percentage
  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  // Handle export
  const handleExport = () => {
    // TODO: Implement CSV export functionality
    console.log('Export members report for date range:', startDate, 'to', endDate);
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
            Members Report
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Membership growth and retention analysis
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
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="expired">Expired</MenuItem>
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
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Total Members
                  </Typography>
                  <Typography variant="h4">{data.summary.totalMembers}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    {data.summary.activeMembers} active
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    New Members
                  </Typography>
                  <Typography variant="h4">{data.summary.newMembers}</Typography>
                  <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                    {data.summary.growthRate >= 0 ? (
                      <TrendingUpIcon fontSize="small" color="success" />
                    ) : (
                      <TrendingDownIcon fontSize="small" color="error" />
                    )}
                    <Typography
                      variant="caption"
                      color={data.summary.growthRate >= 0 ? 'success.main' : 'error.main'}
                    >
                      {formatPercentage(Math.abs(data.summary.growthRate))} growth
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Renewals
                  </Typography>
                  <Typography variant="h4">{data.summary.renewals}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    {formatPercentage(data.summary.retentionRate)} retention
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Total Revenue
                  </Typography>
                  <Typography variant="h4">
                    {formatCurrency(data.summary.totalRevenue)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {data.summary.expiringMembers} expiring soon
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Membership Types Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Membership Type Breakdown
          </Typography>

          {loading && (
            <Box>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rectangular" height={60} sx={{ mb: 1 }} />
              ))}
            </Box>
          )}

          {!loading && data && data.membershipTypes.length > 0 && (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Membership Type</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Active</TableCell>
                    <TableCell align="right">New</TableCell>
                    <TableCell align="right">Renewals</TableCell>
                    <TableCell align="right">Expiring</TableCell>
                    <TableCell align="right">Revenue</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.membershipTypes.map((type) => (
                    <TableRow key={type.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {type.name}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{type.totalMembers}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={type.activeMembers}
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{type.newMembers}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{type.renewals}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        {type.expiringMembers > 0 ? (
                          <Chip
                            label={type.expiringMembers}
                            size="small"
                            color="warning"
                            variant="outlined"
                          />
                        ) : (
                          <Typography variant="body2">0</Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          {formatCurrency(type.revenue)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {!loading && data && data.membershipTypes.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              No membership data found for the selected filters. Try adjusting your date range or status filter.
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default MembersReportPage;
