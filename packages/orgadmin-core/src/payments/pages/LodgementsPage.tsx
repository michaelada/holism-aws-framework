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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={handleBack}>
          <BackIcon />
        </IconButton>
        <Typography variant="h4">Lodgements</Typography>
      </Box>

      {summary && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Total Lodged
                </Typography>
                <Typography variant="h5" color="primary">
                  {formatCurrency(summary.totalLodged)}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {summary.lodgementCount} lodgements
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Card Payments
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(summary.totalCard)}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {summary.totalLodged > 0 
                    ? `${((summary.totalCard / summary.totalLodged) * 100).toFixed(1)}% of total`
                    : '0% of total'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Cheque Payments
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(summary.totalCheque)}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {summary.totalLodged > 0 
                    ? `${((summary.totalCheque / summary.totalLodged) * 100).toFixed(1)}% of total`
                    : '0% of total'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Offline Payments
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(summary.totalOffline)}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {summary.totalLodged > 0 
                    ? `${((summary.totalOffline / summary.totalLodged) * 100).toFixed(1)}% of total`
                    : '0% of total'}
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
              <TableCell>Date</TableCell>
              <TableCell align="right">Total Amount</TableCell>
              <TableCell align="right">Card</TableCell>
              <TableCell align="right">Cheque</TableCell>
              <TableCell align="right">Offline</TableCell>
              <TableCell align="right">Transactions</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  Loading lodgements...
                </TableCell>
              </TableRow>
            ) : lodgements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No lodgements yet.
                </TableCell>
              </TableRow>
            ) : (
              lodgements.map((lodgement) => (
                <TableRow key={lodgement.id} hover>
                  <TableCell>{formatDate(lodgement.date)}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="medium">
                      {formatCurrency(lodgement.totalAmount)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(lodgement.cardAmount)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(lodgement.chequeAmount)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(lodgement.offlineAmount)}
                  </TableCell>
                  <TableCell align="right">
                    {lodgement.transactionCount}
                  </TableCell>
                  <TableCell sx={{ textTransform: 'capitalize' }}>
                    {lodgement.status}
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
