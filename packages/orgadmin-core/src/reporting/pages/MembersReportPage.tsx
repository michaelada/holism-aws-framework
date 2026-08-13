/**
 * Members Report Page
 * 
 * Shows membership growth and retention with filters and export functionality
 */

import React, { useEffect, useMemo, useState } from 'react';
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
  Skeleton,
  Grid,
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
import { formatCurrency } from '@aws-web-framework/orgadmin-shell/utils/currencyFormatting';

/**
 * Membership type report row, matching the backend reporting service shape
 */
interface MembershipTypeRow {
  membershipTypeId: string;
  membershipTypeName: string;
  activeMembers: number;
  pendingMembers: number;
  elapsedMembers: number;
  totalMembers: number;
  totalRevenue: number;
}

/**
 * Members Report Page Component
 */
const MembersReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
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

  const { data, error, loading, execute } = useApiGet<MembershipTypeRow[]>(
    `/api/orgadmin/organisations/${organisation?.id}/reports/members?startDate=${startDate}&endDate=${endDate}`
  );

  // Fetch report on mount and when filters change
  useEffect(() => {
    if (!organisation?.id) return;
    execute();
  }, [execute, startDate, endDate, organisation?.id]);

  const membershipTypes = data ?? [];

  // Summary totals are derived from the per-type rows
  const summary = useMemo(
    () => ({
      totalMembers: membershipTypes.reduce((sum, m) => sum + m.totalMembers, 0),
      activeMembers: membershipTypes.reduce((sum, m) => sum + m.activeMembers, 0),
      pendingMembers: membershipTypes.reduce((sum, m) => sum + m.pendingMembers, 0),
      elapsedMembers: membershipTypes.reduce((sum, m) => sum + m.elapsedMembers, 0),
      totalRevenue: membershipTypes.reduce((sum, m) => sum + m.totalRevenue, 0),
    }),
    [membershipTypes]
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
      await exportReport(runExport, organisation.id, 'members', { startDate, endDate });
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
            {t('reporting.members.backToReports')}
          </Button>
          <Typography variant="h4" gutterBottom>
            {t('reporting.members.title')}
          </Typography>
          <Typography variant="body1" color="textSecondary">
            {t('reporting.members.subtitle')}
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
            {t('reporting.members.filters')}
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
                    {t('reporting.members.summary.totalMembers')}
                  </Typography>
                  <Typography variant="h4">{summary.totalMembers}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    {t('reporting.members.summary.activeMembers', { count: summary.activeMembers })}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {t('reporting.members.summary.pendingMembers')}
                  </Typography>
                  <Typography variant="h4">{summary.pendingMembers}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {t('reporting.members.summary.elapsedMembers')}
                  </Typography>
                  <Typography variant="h4">{summary.elapsedMembers}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {t('reporting.members.summary.totalRevenue')}
                  </Typography>
                  <Typography variant="h4">
                    {formatCurrency(summary.totalRevenue, 'EUR', i18n.language)}
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
            {t('reporting.members.membershipTypeBreakdown')}
          </Typography>

          {loading && (
            <Box>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rectangular" height={60} sx={{ mb: 1 }} />
              ))}
            </Box>
          )}

          {!loading && data && membershipTypes.length > 0 && (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('reporting.members.table.membershipType')}</TableCell>
                    <TableCell align="right">{t('reporting.members.table.total')}</TableCell>
                    <TableCell align="right">{t('reporting.members.table.active')}</TableCell>
                    <TableCell align="right">{t('reporting.members.table.pending')}</TableCell>
                    <TableCell align="right">{t('reporting.members.table.elapsed')}</TableCell>
                    <TableCell align="right">{t('reporting.members.table.revenue')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {membershipTypes.map((type) => (
                    <TableRow key={type.membershipTypeId} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {type.membershipTypeName}
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
                        <Typography variant="body2">{type.pendingMembers}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{type.elapsedMembers}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          {formatCurrency(type.totalRevenue, 'EUR', i18n.language)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {!loading && data && membershipTypes.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {t('reporting.members.noData')}
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default MembersReportPage;
