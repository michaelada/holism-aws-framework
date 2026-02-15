/**
 * Lodgements Page
 * 
 * Displays lodgement history with breakdown by payment method
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useApi } from '../../hooks/useApi';
import { useTranslation } from '@aws-web-framework/orgadmin-shell/hooks/useTranslation';
import { formatDate } from '@aws-web-framework/orgadmin-shell/utils/dateFormatting';
import { formatCurrency } from '@aws-web-framework/orgadmin-shell/utils/currencyFormatting';
import { useLocale } from '@aws-web-framework/orgadmin-shell/context/LocaleContext';

interface Lodgement {
  id: string;
  date: string;
  totalAmount: number;
  cardAmount: number;
  chequeAmount: number;
  offlineAmount: number;
  transactionCount: number;
  status: 'pending' | 'completed';
}

interface LodgementSummary {
  totalLodged: number;
  totalCard: number;
  totalCheque: number;
  totalOffline: number;
  lodgementCount: number;
}

const LodgementsPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { t } = useTranslation();
  const { locale } = useLocale();
  
  const [lodgements, setLodgements] = useState<Lodgement[]>([]);
  const [summary, setSummary] = useState<LodgementSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLodgements();
  }, []);

  const loadLodgements = async () => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/payments/lodgements',
      });
      
      setLodgements(response.lodgements || []);
      
      // Calculate summary
      const totalLodged = response.lodgements.reduce((sum: number, l: Lodgement) => sum + l.totalAmount, 0);
      const totalCard = response.lodgements.reduce((sum: number, l: Lodgement) => sum + l.cardAmount, 0);
      const totalCheque = response.lodgements.reduce((sum: number, l: Lodgement) => sum + l.chequeAmount, 0);
      const totalOffline = response.lodgements.reduce((sum: number, l: Lodgement) => sum + l.offlineAmount, 0);
      
      setSummary({
        totalLodged,
        totalCard,
        totalCheque,
        totalOffline,
        lodgementCount: response.lodgements.length,
      });
    } catch (error) {
      console.error('Failed to load lodgements:', error);
      setLodgements([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/payments');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={handleBack}>
          <BackIcon />
        </IconButton>
        <Typography variant="h4">{t('payments.lodgements.title')}</Typography>
      </Box>

      {summary && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {t('payments.lodgements.totalLodged')}
                </Typography>
                <Typography variant="h5" color="primary">
                  {formatCurrency(summary.totalLodged, 'GBP', locale)}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {t('payments.lodgements.lodgementsCount', { count: summary.lodgementCount })}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {t('payments.lodgements.cardPayments')}
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(summary.totalCard, 'GBP', locale)}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {summary.totalLodged > 0 
                    ? t('payments.lodgements.percentOfTotal', { percent: ((summary.totalCard / summary.totalLodged) * 100).toFixed(1) })
                    : t('payments.lodgements.percentOfTotal', { percent: '0' })}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {t('payments.lodgements.chequePayments')}
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(summary.totalCheque, 'GBP', locale)}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {summary.totalLodged > 0 
                    ? t('payments.lodgements.percentOfTotal', { percent: ((summary.totalCheque / summary.totalLodged) * 100).toFixed(1) })
                    : t('payments.lodgements.percentOfTotal', { percent: '0' })}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {t('payments.lodgements.offlinePayments')}
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(summary.totalOffline, 'GBP', locale)}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {summary.totalLodged > 0 
                    ? t('payments.lodgements.percentOfTotal', { percent: ((summary.totalOffline / summary.totalLodged) * 100).toFixed(1) })
                    : t('payments.lodgements.percentOfTotal', { percent: '0' })}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('payments.table.date')}</TableCell>
              <TableCell align="right">{t('payments.table.totalAmount')}</TableCell>
              <TableCell align="right">{t('payments.table.card')}</TableCell>
              <TableCell align="right">{t('payments.table.cheque')}</TableCell>
              <TableCell align="right">{t('payments.table.offline')}</TableCell>
              <TableCell align="right">{t('payments.table.transactions')}</TableCell>
              <TableCell>{t('payments.table.status')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  {t('payments.loadingLodgements')}
                </TableCell>
              </TableRow>
            ) : lodgements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  {t('payments.noLodgementsFound')}
                </TableCell>
              </TableRow>
            ) : (
              lodgements.map((lodgement) => (
                <TableRow key={lodgement.id} hover>
                  <TableCell>{formatDate(new Date(lodgement.date), 'dd MMM yyyy', locale)}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="medium">
                      {formatCurrency(lodgement.totalAmount, 'GBP', locale)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(lodgement.cardAmount, 'GBP', locale)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(lodgement.chequeAmount, 'GBP', locale)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(lodgement.offlineAmount, 'GBP', locale)}
                  </TableCell>
                  <TableCell align="right">
                    {lodgement.transactionCount}
                  </TableCell>
                  <TableCell sx={{ textTransform: 'capitalize' }}>
                    {t(`common.status.${lodgement.status}`)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default LodgementsPage;
