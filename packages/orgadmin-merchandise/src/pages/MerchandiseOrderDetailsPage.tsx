/**
 * Merchandise Order Details Page
 * 
 * Displays complete order information with pricing breakdown and status management.
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import { Edit as EditIcon, Print as PrintIcon } from '@mui/icons-material';
import { useTranslation, formatCurrency, formatDate } from '@aws-web-framework/orgadmin-shell';
import { useApi } from '@aws-web-framework/orgadmin-core';
import OrderStatusUpdateDialog from '../components/OrderStatusUpdateDialog';
import type { MerchandiseOrder, OrderStatus } from '../types/merchandise.types';

const MerchandiseOrderDetailsPage: React.FC = () => {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { execute } = useApi();
  const [order, setOrder] = useState<MerchandiseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      setNotFound(false);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/merchandise-orders/${id}`,
      });
      if (response) {
        const orderData = response as MerchandiseOrder;
        setOrder(orderData);
        setAdminNotes(orderData.adminNotes || '');
      } else {
        setNotFound(true);
      }
    } catch (err) {
      console.error('Failed to load order:', err);
      setError(t('merchandise.errors.loadOrderFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: OrderStatus, notes?: string, sendEmail?: boolean) => {
    try {
      await execute({
        method: 'PUT',
        url: `/api/orgadmin/merchandise-orders/${id}/status`,
        data: { status: newStatus, notes, sendEmail },
      });
      setStatusDialogOpen(false);
      await loadOrder();
    } catch (err) {
      console.error('Failed to update status:', err);
      setError(t('merchandise.errors.updateStatusFailed'));
    }
  };

  const handleSaveNotes = async () => {
    try {
      setNotesSaved(false);
      await execute({
        method: 'PUT',
        url: `/api/orgadmin/merchandise-orders/${id}/notes`,
        data: { adminNotes },
      });
      setNotesSaved(true);
    } catch (err) {
      console.error('Failed to save notes:', err);
      setError(t('merchandise.errors.saveNotesFailed'));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('common.messages.loading')}</Typography>
      </Box>
    );
  }

  if (notFound || !order) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('merchandise.orderNotFound')}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Order #{order.id}</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button startIcon={<PrintIcon />} onClick={handlePrint}>
            {t('common.actions.print')}
          </Button>
          <Button
            startIcon={<EditIcon />}
            variant="contained"
            onClick={() => setStatusDialogOpen(true)}
          >
            {t('merchandise.orders.updateStatus')}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>{t('merchandise.orders.orderInformation')}</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">{t('merchandise.orders.orderDate')}:</Typography>
                  <Typography>{formatDate(order.orderDate, 'PPpp', i18n.language)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">{t('merchandise.orders.customer')}:</Typography>
                  <Typography>{order.customerName || 'N/A'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">{t('merchandise.orders.email')}:</Typography>
                  <Typography>{order.customerEmail || 'N/A'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">{t('merchandise.orders.orderStatus')}:</Typography>
                  <Chip label={order.orderStatus} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">{t('merchandise.orders.paymentStatus')}:</Typography>
                  <Chip label={order.paymentStatus} />
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>{t('merchandise.orders.orderItems')}</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">{t('merchandise.orders.merchandiseType')}:</Typography>
                  <Typography>{order.merchandiseType?.name || 'N/A'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">{t('merchandise.orders.selectedOptions')}:</Typography>
                  <Typography>
                    {Object.entries(order.selectedOptions).map(([key, value]) => `${key}: ${value}`).join(', ') || 'N/A'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">{t('merchandise.orders.quantity')}:</Typography>
                  <Typography>{order.quantity}</Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">{t('merchandise.orders.unitPrice')}:</Typography>
                  <Typography>{formatCurrency(order.unitPrice, 'EUR', i18n.language)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">{t('merchandise.orders.subtotal')}:</Typography>
                  <Typography>{formatCurrency(order.subtotal, 'EUR', i18n.language)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">{t('merchandise.orders.deliveryFee')}:</Typography>
                  <Typography>{formatCurrency(order.deliveryFee, 'EUR', i18n.language)}</Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6">{t('merchandise.orders.total')}:</Typography>
                  <Typography variant="h6">{formatCurrency(order.totalPrice, 'EUR', i18n.language)}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>{t('merchandise.orders.adminNotes')}</Typography>
              <TextField
                multiline
                rows={4}
                value={adminNotes}
                onChange={(e) => {
                  setAdminNotes(e.target.value);
                  setNotesSaved(false);
                }}
                placeholder={t('merchandise.orders.adminNotesPlaceholder')}
                fullWidth
                sx={{ mb: 2 }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button variant="contained" onClick={handleSaveNotes}>
                  {t('common.actions.save')}
                </Button>
                {notesSaved && (
                  <Typography variant="body2" color="success.main">
                    {t('common.messages.saved')}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>{t('merchandise.orders.orderHistory')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('merchandise.orders.noHistory')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <OrderStatusUpdateDialog
        open={statusDialogOpen}
        currentStatus={order.orderStatus}
        onClose={() => setStatusDialogOpen(false)}
        onUpdate={handleStatusUpdate}
      />
    </Box>
  );
};

export default MerchandiseOrderDetailsPage;
